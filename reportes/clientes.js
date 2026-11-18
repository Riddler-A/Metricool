// Registro del cliente: un enlace privado (redes.alexisconsultor.com/c/<llave>) donde quien
// dirige el negocio escribe cuántas citas, ventas o reservas llegaron por redes. Las cifras
// llegan solas al reporte y al embudo.
//
// La llave tiene 128 bits al azar: no se puede adivinar. Si se comparte por error, se
// genera otra y la anterior deja de funcionar.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const calc = require('./calculos');

const MAX_REGISTROS = 500;
const idValido = (id) => /^[a-f0-9]{16}$/.test(id || '');
const llaveValida = (k) => /^[a-f0-9]{32}$/.test(k || '');
const fechaValida = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f || '') && !Number.isNaN(Date.parse(`${f}T00:00:00Z`));

function carpeta(datos) {
  const dir = path.join(datos, 'clientes');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function leer(datos, id) {
  if (!idValido(id)) return null;
  try {
    return JSON.parse(await fsp.readFile(path.join(carpeta(datos), `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}

async function todos(datos) {
  const dir = carpeta(datos);
  const nombres = (await fsp.readdir(dir)).filter((n) => /^[a-f0-9]{16}\.json$/.test(n));
  const lista = (await Promise.all(nombres.map((n) => leer(datos, n.slice(0, 16))))).filter(Boolean);
  return lista.sort((a, b) => String(a.cliente).localeCompare(String(b.cliente), 'es'));
}

// Busca por llave comparando en tiempo constante (no da pistas de cuántos caracteres acertó).
async function porLlave(datos, llave) {
  if (!llaveValida(llave)) return null;
  const buscada = Buffer.from(llave);
  for (const c of await todos(datos)) {
    if (c.llave && crypto.timingSafeEqual(Buffer.from(c.llave), buscada)) return c;
  }
  return null;
}

// Un solo proceso escribe; la fila evita que dos envíos al mismo tiempo se pisen.
let fila = Promise.resolve();
function guardar(datos, cliente) {
  const tarea = fila.then(async () => {
    cliente.actualizado = new Date().toISOString();
    const archivo = path.join(carpeta(datos), `${cliente.id}.json`);
    const tmp = `${archivo}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(cliente, null, 2), { mode: 0o600 });
    await fsp.rename(tmp, archivo);
  });
  fila = tarea.catch(() => {});
  return tarea;
}

async function borrar(datos, id) {
  if (!idValido(id)) return;
  const papelera = path.join(datos, 'papelera');
  fs.mkdirSync(papelera, { recursive: true });
  await fsp.rename(path.join(carpeta(datos), `${id}.json`), path.join(papelera, `cliente-${id}-${Date.now()}.json`));
}

function nuevo(nombreCliente) {
  return {
    id: crypto.randomBytes(8).toString('hex'),
    llave: crypto.randomBytes(16).toString('hex'),
    cliente: String(nombreCliente || '').trim().slice(0, 80),
    creado: new Date().toISOString(),
    registros: [],
  };
}

function nuevaLlave(cliente) {
  return { ...cliente, llave: crypto.randomBytes(16).toString('hex') };
}

// Qué le preguntamos al cliente: siempre ventas/citas, más las etapas "a mano" de su embudo.
function campos(embudo) {
  const base = [{ id: 'ventas', nombre: 'Citas, cotizaciones o ventas que llegaron por redes', nota: 'Cuenta solo las personas que dijeron venir de redes o de un anuncio.' }];
  const manuales = (embudo?.etapas || [])
    .filter((e) => e.fuente === 'manual' && e.nombre)
    .map((e) => ({ id: e.id, nombre: e.nombre, nota: e.nota || '' }));
  return [...base, ...manuales];
}

// Lo que manda el cliente: fechas válidas, números enteros entre 0 y 1,000,000.
function limpiarRegistro(enviado, listaCampos) {
  const desde = String(enviado.desde || '');
  const hasta = String(enviado.hasta || '');
  if (!fechaValida(desde) || !fechaValida(hasta)) throw new Error('Revisa las fechas.');
  if (hasta < desde) throw new Error('La fecha final no puede ser antes de la inicial.');
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000 + 1;
  if (dias > 62) throw new Error('El periodo puede ser de hasta 2 meses.');
  const valores = {};
  for (const c of listaCampos) {
    const v = String(enviado[c.id] ?? '').trim();
    if (v === '') continue;
    const n = calc.numero(v);
    if (n === null || n < 0 || n > 1e6 || !Number.isInteger(n)) throw new Error(`"${c.nombre}" debe ser un número entero.`);
    valores[c.id] = n;
  }
  if (!Object.keys(valores).length) throw new Error('Escribe al menos un número.');
  return {
    id: crypto.randomBytes(6).toString('hex'),
    desde,
    hasta,
    valores,
    nota: String(enviado.nota || '').trim().slice(0, 500),
    creado: new Date().toISOString(),
  };
}

function agregarRegistro(cliente, registro) {
  const registros = [...(cliente.registros || []), registro].slice(-MAX_REGISTROS);
  return { ...cliente, registros };
}

// Suma lo que el cliente reportó dentro de un periodo. Si un registro cruza el inicio o el
// fin del periodo, se reparte en proporción a los días que caen dentro.
function sumaEntre(cliente, desde, hasta) {
  const ini = Date.parse(`${desde}T00:00:00Z`);
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  const total = {};
  let registros = 0;
  for (const r of cliente?.registros || []) {
    const a = Date.parse(`${r.desde}T00:00:00Z`);
    const b = Date.parse(`${r.hasta}T00:00:00Z`);
    const traslape = (Math.min(b, fin) - Math.max(a, ini)) / 86400000 + 1;
    if (traslape <= 0) continue;
    const parte = traslape / ((b - a) / 86400000 + 1);
    registros++;
    for (const [k, v] of Object.entries(r.valores || {})) total[k] = (total[k] || 0) + v * parte;
  }
  for (const k of Object.keys(total)) total[k] = Math.round(total[k]);
  return { total, registros };
}

function deCliente(lista, nombre) {
  const c = String(nombre || '').trim().toLowerCase();
  return (c && lista.find((x) => String(x.cliente || '').trim().toLowerCase() === c)) || null;
}

module.exports = {
  leer,
  todos,
  porLlave,
  guardar,
  borrar,
  nuevo,
  nuevaLlave,
  campos,
  limpiarRegistro,
  agregarRegistro,
  sumaEntre,
  deCliente,
  idValido,
  llaveValida,
};
