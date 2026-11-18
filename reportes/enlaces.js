// Enlaces rastreables: redes.alexisconsultor.com/r/<nombre> cuenta el clic y manda a la
// persona a su destino (una página o un chat de WhatsApp con mensaje ya escrito).
//
// Privacidad: no se guarda la IP ni nada de la persona; solo cuántos clics hubo por día.
// Los "únicos" se calculan en memoria con un hash diario y se pierden al reiniciar.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

// Vistas previas de redes y buscadores: no son personas, no se cuentan.
const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegram|twitterbot|linkedinbot|discordbot|slackbot|embedly|preview|headless|curl|wget|python-requests|go-http-client/i;

function carpeta(datos) {
  const dir = path.join(datos, 'enlaces');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function slugValido(s) {
  return SLUG.test(String(s || ''));
}

// "Café Norte - Menú" → "cafe-norte-menu"
function aSlug(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

// Solo destinos http(s). WhatsApp se arma aquí a partir del número y el mensaje.
function destinoValido(url) {
  try {
    const u = new URL(String(url || ''));
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname && String(url).length <= 2000;
  } catch {
    return false;
  }
}

function whatsapp(numero, mensaje) {
  const digitos = String(numero || '').replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 15) return null;
  // Números de México de 10 dígitos: se agrega la lada del país.
  const completo = digitos.length === 10 ? `52${digitos}` : digitos;
  const texto = String(mensaje || '').trim().slice(0, 500);
  return `https://wa.me/${completo}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

async function leer(datos, slug) {
  if (!slugValido(slug)) return null;
  try {
    return JSON.parse(await fsp.readFile(path.join(carpeta(datos), `${slug}.json`), 'utf8'));
  } catch {
    return null;
  }
}

async function todos(datos) {
  const dir = carpeta(datos);
  const nombres = (await fsp.readdir(dir)).filter((n) => n.endsWith('.json'));
  const lista = (await Promise.all(nombres.map((n) => leer(datos, n.slice(0, -5))))).filter(Boolean);
  return lista.sort((a, b) => String(a.cliente).localeCompare(String(b.cliente), 'es') || String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

// Escrituras en fila por enlace, para que dos clics al mismo tiempo no se pisen.
const colas = new Map();
function enFila(slug, fn) {
  const previa = colas.get(slug) || Promise.resolve();
  const siguiente = previa.then(fn, fn);
  colas.set(slug, siguiente.catch(() => {}));
  return siguiente;
}

async function escribir(datos, enlace) {
  const archivo = path.join(carpeta(datos), `${enlace.slug}.json`);
  const tmp = `${archivo}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(enlace, null, 2), { mode: 0o600 });
  await fsp.rename(tmp, archivo);
}

async function guardar(datos, enlace) {
  return enFila(enlace.slug, () => escribir(datos, { ...enlace, actualizado: new Date().toISOString() }));
}

async function borrar(datos, slug) {
  if (!slugValido(slug)) return;
  const papelera = path.join(datos, 'papelera');
  fs.mkdirSync(papelera, { recursive: true });
  await enFila(slug, () => fsp.rename(path.join(carpeta(datos), `${slug}.json`), path.join(papelera, `enlace-${slug}-${Date.now()}.json`)));
}

// ---------- Clics ----------

const sal = crypto.randomBytes(16);
const vistos = new Map(); // "slug|día" → Set de huellas del día

function diaMexico(fecha = new Date()) {
  return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

function esBot(req) {
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || BOTS.test(ua)) return true;
  // Navegadores que cargan la página por adelantado (no es un clic real).
  const proposito = String(req.headers.purpose || req.headers['sec-purpose'] || req.headers['x-purpose'] || '');
  return /prefetch|preview/i.test(proposito);
}

// Cuenta el clic y devuelve el destino (o null si el enlace no existe o está pausado).
async function registrarClic(datos, slug, req) {
  const enlace = await leer(datos, slug);
  if (!enlace || enlace.pausado) return null;
  if (req.method !== 'GET' || esBot(req)) return enlace.destino;
  const dia = diaMexico();
  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
  const huella = crypto.createHmac('sha256', sal).update(`${dia}|${ip}|${req.headers['user-agent'] || ''}`).digest('hex').slice(0, 16);
  const llave = `${slug}|${dia}`;
  if (!vistos.has(llave)) {
    // Solo se guardan los días recientes en memoria.
    if (vistos.size > 5000) vistos.clear();
    vistos.set(llave, new Set());
  }
  const set = vistos.get(llave);
  const unico = !set.has(huella);
  set.add(huella);
  await enFila(slug, async () => {
    const actual = await leer(datos, slug);
    if (!actual) return;
    actual.clics ??= {};
    actual.unicos ??= {};
    actual.clics[dia] = (actual.clics[dia] || 0) + 1;
    if (unico) actual.unicos[dia] = (actual.unicos[dia] || 0) + 1;
    await escribir(datos, actual);
  });
  return enlace.destino;
}

// Clics entre dos fechas (YYYY-MM-DD, incluidas).
function clicsEntre(enlace, desde, hasta, campo = 'clics') {
  let total = 0;
  for (const [dia, n] of Object.entries(enlace?.[campo] || {})) {
    if (dia >= desde && dia <= hasta) total += n;
  }
  return total;
}

function totalClics(enlace, campo = 'clics') {
  return Object.values(enlace?.[campo] || {}).reduce((s, n) => s + n, 0);
}

// Enlaces de un cliente (por nombre, sin importar mayúsculas ni espacios).
function deCliente(lista, cliente) {
  const c = String(cliente || '').trim().toLowerCase();
  return c ? lista.filter((e) => String(e.cliente || '').trim().toLowerCase() === c) : [];
}

module.exports = {
  slugValido,
  aSlug,
  destinoValido,
  whatsapp,
  leer,
  todos,
  guardar,
  borrar,
  registrarClic,
  clicsEntre,
  totalClics,
  deCliente,
  esBot,
  diaMexico,
};
