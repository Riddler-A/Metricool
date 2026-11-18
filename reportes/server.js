// Reportes de resultados de Prisma CN, dentro de redes.alexisconsultor.com/reportes.
// Node sin dependencias. Solo entra quien tiene sesión abierta en Postiz.

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const vistas = require('./vistas');
const postiz = require('./postiz');
const { armar, mezclar } = require('./datos');

const PUERTO = Number(process.env.PORT || 8080);
const DATOS = process.env.DATOS_REPORTES || '/data';
const PAPELERA = path.join(DATOS, 'papelera');
const R = '/reportes';
const MAX_CUERPO = 512 * 1024;
const ESTATICOS = {
  'formulario.css': 'text/css; charset=utf-8',
  'reporte.css': 'text/css; charset=utf-8',
  'formulario.js': 'text/javascript; charset=utf-8',
  'reporte.js': 'text/javascript; charset=utf-8',
};

fs.mkdirSync(PAPELERA, { recursive: true });

// ---------- Almacenamiento (un JSON por reporte) ----------

const idValido = (id) => /^[a-f0-9]{16}$/.test(id || '');
const archivo = (id) => path.join(DATOS, `${id}.json`);

async function leer(id) {
  if (!idValido(id)) return null;
  try {
    return JSON.parse(await fsp.readFile(archivo(id), 'utf8'));
  } catch {
    return null;
  }
}

async function escribir(reporte) {
  reporte.actualizado = new Date().toISOString();
  const tmp = `${archivo(reporte.id)}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(reporte, null, 2), { mode: 0o600 });
  await fsp.rename(tmp, archivo(reporte.id));
}

async function todos() {
  const nombres = (await fsp.readdir(DATOS)).filter((n) => /^[a-f0-9]{16}\.json$/.test(n));
  const lista = (await Promise.all(nombres.map((n) => leer(n.slice(0, 16))))).filter(Boolean);
  return lista.sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)));
}

function nuevo(autor, base = {}) {
  return {
    id: crypto.randomBytes(8).toString('hex'),
    creado: new Date().toISOString(),
    autor,
    meta: base.meta || {},
    datos: base.datos || {},
    avisos: [],
  };
}

// ---------- HTTP ----------

function responder(res, estado, html, extra = {}) {
  res.writeHead(estado, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy':
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; form-action 'self'; frame-ancestors 'self'; base-uri 'none'",
    ...extra,
  });
  res.end(html);
}

function redirigir(res, destino) {
  res.writeHead(303, { location: destino, 'cache-control': 'no-store' });
  res.end();
}

function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    let tam = 0;
    const partes = [];
    req.on('data', (c) => {
      tam += c.length;
      if (tam > MAX_CUERPO) {
        mal(Object.assign(new Error('Formulario demasiado grande'), { estado: 413 }));
        req.destroy();
      } else partes.push(c);
    });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', mal);
  });
}

// Los POST solo se aceptan desde el mismo sitio (protección CSRF).
function mismoOrigen(req) {
  const origen = req.headers.origin || req.headers.referer || '';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    return new URL(origen).hostname === String(host).split(':')[0];
  } catch {
    return false;
  }
}

async function manejar(req, res) {
  const url = new URL(req.url, 'http://local');
  let ruta = url.pathname;
  if (!ruta.startsWith(R)) return responder(res, 404, 'No encontrado');
  ruta = ruta.slice(R.length) || '/';

  if (ruta.startsWith('/estatico/')) {
    const nombre = ruta.slice('/estatico/'.length);
    if (!ESTATICOS[nombre]) return responder(res, 404, 'No encontrado');
    res.writeHead(200, { 'content-type': ESTATICOS[nombre], 'cache-control': 'no-cache' });
    return fs.createReadStream(path.join(__dirname, 'estatico', nombre)).pipe(res);
  }

  if (ruta === '/salud') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }

  const cookie = req.headers.cookie || '';
  const usuario = await postiz.sesion(cookie);
  if (!usuario) return redirigir(res, `/auth/login?returnUrl=${encodeURIComponent(url.pathname)}`);

  if (req.method === 'POST' && !mismoOrigen(req)) {
    return responder(res, 403, vistas.error({ titulo: 'Solicitud rechazada', mensaje: 'La solicitud no vino de esta página.' }));
  }

  if (ruta === '/' && req.method === 'GET') {
    return responder(res, 200, vistas.lista({ reportes: await todos(), mensaje: url.searchParams.get('m') }));
  }

  if (ruta === '/nuevo' && req.method === 'POST') {
    const r = nuevo(usuario.email);
    await escribir(r);
    return redirigir(res, `${R}/${r.id}/editar`);
  }

  const m = /^\/([a-f0-9]{16})\/(editar|ver|guardar|borrar|duplicar)$/.exec(ruta);
  if (!m) return responder(res, 404, vistas.error({ titulo: 'No encontrado', mensaje: 'Esa página no existe.' }));
  const [, id, accion] = m;
  const reporte = await leer(id);
  if (!reporte) return responder(res, 404, vistas.error({ titulo: 'No encontrado', mensaje: 'Ese reporte no existe o se borró.' }));

  if (accion === 'editar' && req.method === 'GET') {
    let cuentas = [];
    let errorCuentas = '';
    try {
      cuentas = await postiz.cuentas(cookie);
    } catch (e) {
      errorCuentas = `No se pudieron leer las cuentas de Postiz (${e.message}).`;
    }
    return responder(res, 200, vistas.formulario({ reporte, cuentas, errorCuentas, mensaje: url.searchParams.get('m') }));
  }

  if (accion === 'ver' && req.method === 'GET') {
    return responder(res, 200, vistas.reporte({ reporte, otros: await todos() }));
  }

  if (req.method !== 'POST') return responder(res, 405, 'Método no permitido');

  if (accion === 'borrar') {
    await fsp.rename(archivo(id), path.join(PAPELERA, `${id}-${Date.now()}.json`));
    return redirigir(res, `${R}/?m=${encodeURIComponent('Reporte movido a la papelera.')}`);
  }

  if (accion === 'duplicar') {
    // Para el siguiente periodo se conservan cliente, cuentas, objetivos y metas.
    const kpis = (reporte.datos?.resumen?.kpis || []).map((k) => ({ kpi: k.kpi, meta: k.meta }));
    const copia = nuevo(usuario.email, {
      meta: { cliente: reporte.meta?.cliente, redes: reporte.meta?.redes, cuentas: reporte.meta?.cuentas },
      datos: { resumen: { kpis }, objetivos: reporte.datos?.objetivos, metodologia: { fuentes: reporte.datos?.metodologia?.fuentes } },
    });
    await escribir(copia);
    return redirigir(res, `${R}/${copia.id}/editar?m=${encodeURIComponent('Copia lista: pon las fechas del nuevo periodo.')}`);
  }

  if (accion === 'guardar') {
    const cuerpo = new URLSearchParams(await leerCuerpo(req));
    const enviado = armar(cuerpo.entries());
    reporte.meta = { ...(enviado.meta || {}), cuentas: enviado.meta?.cuentas || [] };
    reporte.datos = enviado.datos || {};
    const que = cuerpo.get('accion');
    let mensaje = 'Guardado.';

    if (que === 'importar') {
      try {
        const traido = await postiz.traerDatos(cookie, reporte.meta);
        reporte.datos = mezclar(reporte.datos, traido.datos);
        reporte.series = traido.series;
        reporte.avisos = traido.avisos;
        const hoy = vistas.diaMexico();
        reporte.datos.metodologia ??= {};
        reporte.datos.metodologia.fecha = hoy;
        if (!reporte.datos.metodologia.fuentes)
          reporte.datos.metodologia.fuentes = 'Estadísticas de cada red obtenidas a través de Postiz';
        if (!reporte.datos.metodologia.notas)
          reporte.datos.metodologia.notas =
            'Alcance, impresiones e interacciones son la suma de las publicaciones del periodo (una persona puede contarse en más de una publicación).';
        mensaje = 'Datos de Postiz actualizados. Revisa los avisos y completa lo que falta a mano.';
      } catch (e) {
        if (e.sesion) return redirigir(res, `/auth/login?returnUrl=${encodeURIComponent(`${R}/${id}/editar`)}`);
        reporte.avisos = [`No se pudieron traer los datos: ${e.message}`];
        mensaje = 'Guardado, pero no se pudieron traer los datos de Postiz.';
      }
    }

    await escribir(reporte);
    if (que === 'ver') return redirigir(res, `${R}/${id}/ver`);
    return redirigir(res, `${R}/${id}/editar?m=${encodeURIComponent(mensaje)}`);
  }

  return responder(res, 404, 'No encontrado');
}

const servidor = http.createServer((req, res) => {
  manejar(req, res).catch((e) => {
    console.error(new Date().toISOString(), req.method, req.url, e);
    if (!res.headersSent) {
      responder(res, e.estado || 500, vistas.error({ titulo: 'Algo salió mal', mensaje: e.estado ? e.message : 'Error interno. Intenta de nuevo.' }));
    } else res.end();
  });
});

servidor.headersTimeout = 20000;
servidor.requestTimeout = 300000; // traer datos de Postiz puede tardar
servidor.listen(PUERTO, () => console.log(`Reportes en el puerto ${PUERTO}, datos en ${DATOS}`));

process.on('SIGTERM', () => servidor.close(() => process.exit(0)));

