// Embudos (customer journey) por cliente. Cada embudo es una lista de etapas y cada
// etapa dice de dónde sale su número: de un dato del reporte (Postiz o capturado) o de
// una cifra que se escribe a mano en cada reporte.

const fsp = require('node:fs/promises');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const calc = require('./calculos');

// ---------- Fuentes de datos para una etapa ----------

const n = (v) => calc.numero(v);
const suma = (vals) => (vals.every((v) => v === null) ? null : vals.reduce((s, v) => s + (v || 0), 0));

function pauta(d, k) {
  const vals = (d.pauta?.campanas || []).map((c) => n(c?.[k]));
  return suma(vals.length ? vals : [null]);
}

// { clave: [etiqueta, grupo, (datos, periodo) => número | null] }
const FUENTES = {
  alcance: ['Alcance (personas que nos vieron)', 'Redes', (d, p) => n(d.embudo?.visibilidad?.alcance?.[p])],
  impresiones: ['Impresiones', 'Redes', (d, p) => n(d.embudo?.visibilidad?.impresiones?.[p])],
  interacciones: ['Interacciones (likes + comentarios + guardados + compartidos)', 'Redes', (d, p) => {
    const i = d.embudo?.interaccion || {};
    return suma(['likes', 'comentarios', 'guardados', 'compartidos'].map((k) => n(i[k]?.[p])));
  }],
  nuevos: ['Seguidores nuevos', 'Redes', (d, p) => n(d.embudo?.visibilidad?.nuevos?.[p])],
  visitas: ['Visitas al perfil', 'Redes', (d, p) => n(d.embudo?.visibilidad?.visitas?.[p])],
  clics: ['Clics al link', 'Conversión', (d, p) => n(d.embudo?.conversion?.clics?.[p])],
  dm: ['Mensajes directos (DM)', 'Conversión', (d, p) => n(d.embudo?.conversion?.dm?.[p])],
  whatsapp: ['Conversaciones por WhatsApp', 'Conversión', (d, p) => n(d.embudo?.conversion?.whatsapp?.[p])],
  mensajes: ['Mensajes (DM + WhatsApp)', 'Conversión', (d, p) => suma([n(d.embudo?.conversion?.dm?.[p]), n(d.embudo?.conversion?.whatsapp?.[p])])],
  ventas: ['Citas, cotizaciones o ventas', 'Conversión', (d, p) => n(d.embudo?.conversion?.ventas?.[p])],
  pautaAlcance: ['Alcance de la pauta', 'Pauta', (d, p) => (p === 'actual' ? pauta(d, 'alcance') : null)],
  pautaClics: ['Clics de la pauta', 'Pauta', (d, p) => (p === 'actual' ? pauta(d, 'clics') : null)],
  pautaResultados: ['Resultados de la pauta', 'Pauta', (d, p) => (p === 'actual' ? pauta(d, 'resultados') : null)],
  manual: ['Se escribe a mano en cada reporte', 'A mano', null],
};

// ---------- Plantillas para empezar rápido ----------

const PLANTILLAS = {
  servicios: {
    nombre: 'Servicios con cita',
    etapas: [
      ['Nos vieron', 'alcance'],
      ['Interactuaron', 'interacciones'],
      ['Nos escribieron', 'mensajes'],
      ['Agendaron', 'manual', 'Citas agendadas que llegaron por redes'],
      ['Se volvieron clientes', 'ventas'],
    ],
  },
  local: {
    nombre: 'Negocio con local (café, restaurante, tienda)',
    etapas: [
      ['Nos vieron', 'alcance'],
      ['Interactuaron', 'interacciones'],
      ['Visitaron el perfil', 'visitas'],
      ['Pidieron ubicación o informes', 'mensajes'],
      ['Nos visitaron o compraron', 'ventas'],
    ],
  },
  tienda: {
    nombre: 'Tienda en línea',
    etapas: [
      ['Nos vieron', 'alcance'],
      ['Entraron al sitio', 'clics'],
      ['Agregaron al carrito', 'manual', 'Carritos creados (de la tienda en línea)'],
      ['Compraron', 'ventas'],
    ],
  },
  vacio: { nombre: 'Embudo en blanco', etapas: [['Nos vieron', 'alcance'], ['', 'manual']] },
};

// ---------- Almacenamiento (un JSON por embudo) ----------

const idValido = (id) => /^[a-f0-9]{16}$/.test(id || '');

function carpeta(datos) {
  const dir = path.join(datos, 'embudos');
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
  const nombres = (await fsp.readdir(dir)).filter((x) => /^[a-f0-9]{16}\.json$/.test(x));
  const lista = (await Promise.all(nombres.map((x) => leer(datos, x.slice(0, 16))))).filter(Boolean);
  return lista.sort((a, b) => String(a.cliente || a.nombre).localeCompare(String(b.cliente || b.nombre), 'es'));
}

async function escribir(datos, embudo) {
  embudo.actualizado = new Date().toISOString();
  const archivo = path.join(carpeta(datos), `${embudo.id}.json`);
  const tmp = `${archivo}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(embudo, null, 2), { mode: 0o600 });
  await fsp.rename(tmp, archivo);
}

async function borrar(datos, id) {
  if (!idValido(id)) return;
  const papelera = path.join(datos, 'papelera');
  fs.mkdirSync(papelera, { recursive: true });
  await fsp.rename(path.join(carpeta(datos), `${id}.json`), path.join(papelera, `embudo-${id}-${Date.now()}.json`));
}

const nuevoId = () => crypto.randomBytes(8).toString('hex');
// Empieza con letra: si fuera solo dígitos, el formulario lo tomaría por una fila de tabla.
const idEtapa = () => `e${crypto.randomBytes(4).toString('hex').slice(0, 7)}`;

function desdePlantilla(clave, cliente = '') {
  const p = PLANTILLAS[clave] || PLANTILLAS.servicios;
  return {
    id: nuevoId(),
    creado: new Date().toISOString(),
    nombre: p.nombre,
    cliente,
    etapas: p.etapas.map(([nombre, fuente, nota]) => ({ id: idEtapa(), nombre, fuente, nota: nota || '' })),
  };
}

// Valida lo que llega del diseñador: máximo 10 etapas, fuentes conocidas, textos cortos.
function limpiar(enviado, previo) {
  const etapas = (Array.isArray(enviado.etapas) ? enviado.etapas : [])
    .map((e) => ({
      id: /^e[a-f0-9]{7}$/.test(e?.id || '') ? e.id : idEtapa(),
      nombre: String(e?.nombre || '').trim().slice(0, 60),
      fuente: FUENTES[e?.fuente] ? e.fuente : 'manual',
      nota: String(e?.nota || '').trim().slice(0, 140),
    }))
    .filter((e) => e.nombre)
    .slice(0, 10);
  return {
    ...previo,
    nombre: String(enviado.nombre || '').trim().slice(0, 80) || 'Embudo',
    cliente: String(enviado.cliente || '').trim().slice(0, 80),
    etapas,
  };
}

// ---------- Cálculo para un reporte ----------

// Devuelve [{ id, nombre, fuente, actual, anterior, pasa, pasaAnterior }] y la mayor fuga.
function calcular(embudo, datos) {
  const manual = datos.embudoEtapas || {};
  const etapas = (embudo?.etapas || []).map((e) => {
    const f = FUENTES[e.fuente];
    const valor = (p) => (e.fuente === 'manual' || !f ? n(manual[e.id]?.[p]) : f[2](datos, p));
    return { ...e, actual: valor('actual'), anterior: valor('anterior') };
  });
  // Qué parte de la etapa anterior llegó a esta.
  const pct = (a, b) => (a !== null && b ? (a / b) * 100 : null);
  etapas.forEach((e, i) => {
    e.pasa = i > 0 ? pct(e.actual, etapas[i - 1].actual) : null;
    e.pasaAnterior = i > 0 ? pct(e.anterior, etapas[i - 1].anterior) : null;
  });
  // La mayor fuga: el paso con menor porcentaje que pasa (sin contar la primera etapa).
  const pasos = etapas.slice(1).filter((e) => e.pasa !== null);
  const fuga = pasos.length ? pasos.reduce((a, b) => (b.pasa < a.pasa ? b : a)) : null;
  const iFuga = fuga ? etapas.indexOf(fuga) : -1;
  const total = etapas.length > 1 && etapas[0].actual && etapas.at(-1).actual !== null
    ? (etapas.at(-1).actual / etapas[0].actual) * 100
    : null;
  return { etapas, fuga: fuga ? { desde: etapas[iFuga - 1].nombre, hasta: fuga.nombre, pasa: fuga.pasa } : null, total };
}

module.exports = { FUENTES, PLANTILLAS, leer, todos, escribir, borrar, desdePlantilla, limpiar, calcular, idValido };
