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
const imagenes = require('./imagenes');
const pautaCsv = require('./pauta-csv');
const embudos = require('./embudos');
const vistasEmbudos = require('./vistas-embudos');
const rutasExtra = require('./rutas-extra');
const vistasExtra = require('./vistas-extra');
const calc = require('./calculos');

const PUERTO = Number(process.env.PORT || 8080);
const DATOS = process.env.DATOS_REPORTES || '/data';
const PAPELERA = path.join(DATOS, 'papelera');
const R = '/reportes';
const MAX_CUERPO = 12 * 1024 * 1024; // incluye fotos de anuncios y el CSV de campañas
const ESTATICOS = {
  'formulario.css': 'text/css; charset=utf-8',
  'reporte.css': 'text/css; charset=utf-8',
  'formulario.js': 'text/javascript; charset=utf-8',
  'reporte.js': 'text/javascript; charset=utf-8',
  'embudo.js': 'text/javascript; charset=utf-8',
  'extra.js': 'text/javascript; charset=utf-8',
};

// El embudo de un reporte: el elegido, o si nunca se eligió, el del mismo cliente.
function embudoDe(reporte, lista) {
  const elegido = reporte.meta?.embudo;
  if (elegido !== undefined) return lista.find((e) => e.id === elegido) || null;
  const cliente = String(reporte.meta?.cliente || '').trim().toLowerCase();
  return (cliente && lista.find((e) => String(e.cliente || '').trim().toLowerCase() === cliente)) || null;
}

function camposEmbudo(cuerpo) {
  const etapas = [];
  for (const [k, v] of cuerpo.entries()) {
    const m = /^etapas\.(\d{1,2})\.(id|nombre|fuente|nota)$/.exec(k);
    if (m) (etapas[Number(m[1])] ??= {})[m[2]] = v;
  }
  return { nombre: cuerpo.get('nombre'), cliente: cuerpo.get('cliente'), etapas: etapas.filter(Boolean) };
}

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
      "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; form-action 'self'; frame-ancestors 'self'; base-uri 'none'",
    ...extra,
  });
  res.end(html);
}

function redirigir(res, destino) {
  res.writeHead(303, { location: destino, 'cache-control': 'no-store' });
  res.end();
}

function leerCuerpo(req, maximo = MAX_CUERPO) {
  return new Promise((ok, mal) => {
    let tam = 0;
    const partes = [];
    req.on('data', (c) => {
      tam += c.length;
      if (tam > maximo) {
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
  const ayudas = { DATOS, responder, redirigir, leerCuerpo, mismoOrigen, todos };

  // Públicas: enlaces rastreables (/r/…) y registro del cliente (/c/…). No piden sesión.
  if (/^\/[rc]\//.test(ruta)) {
    if (await rutasExtra.publicas(req, res, url, ayudas)) return;
    return responder(res, 404, vistasExtra.noEncontrado());
  }
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

  if (ruta.startsWith('/imagenes/') && req.method === 'GET') {
    return imagenes.servir(DATOS, ruta.slice('/imagenes/'.length), res);
  }

  if (/^\/(enlaces|clientes)(\/|$)/.test(ruta) && (await rutasExtra.equipo(req, res, url, ruta, { ...ayudas, usuario }))) return;

  // ---------- Diseñador de embudos ----------
  if (ruta === '/embudos' || ruta === '/embudos/') {
    if (req.method !== 'GET') return responder(res, 405, 'Método no permitido');
    return responder(res, 200, vistasEmbudos.lista({ embudos: await embudos.todos(DATOS), mensaje: url.searchParams.get('m') }));
  }
  if (ruta === '/embudos/nuevo' && req.method === 'POST') {
    const cuerpo = new URLSearchParams(await leerCuerpo(req));
    const e = embudos.desdePlantilla(cuerpo.get('plantilla'), String(cuerpo.get('cliente') || '').trim().slice(0, 80));
    await embudos.escribir(DATOS, e);
    return redirigir(res, `${R}/embudos/${e.id}/editar`);
  }
  const me = /^\/embudos\/([a-f0-9]{16})\/(editar|guardar|borrar)$/.exec(ruta);
  if (me) {
    const [, idE, accionE] = me;
    const embudo = await embudos.leer(DATOS, idE);
    if (!embudo) return responder(res, 404, vistas.error({ titulo: 'No encontrado', mensaje: 'Ese embudo no existe o se borró.' }));
    if (accionE === 'editar' && req.method === 'GET') {
      const usos = (await todos()).filter((r) => r.meta?.embudo === idE).length;
      return responder(res, 200, vistasEmbudos.editor({ embudo, usos, mensaje: url.searchParams.get('m') }));
    }
    if (req.method !== 'POST') return responder(res, 405, 'Método no permitido');
    if (accionE === 'borrar') {
      await embudos.borrar(DATOS, idE);
      return redirigir(res, `${R}/embudos/?m=${encodeURIComponent('Embudo movido a la papelera.')}`);
    }
    const limpio = embudos.limpiar(camposEmbudo(new URLSearchParams(await leerCuerpo(req))), embudo);
    await embudos.escribir(DATOS, limpio);
    const aviso = limpio.etapas.length < 2 ? 'Guardado. Agrega al menos dos etapas para que el embudo se dibuje.' : 'Embudo guardado.';
    return redirigir(res, `${R}/embudos/${idE}/editar?m=${encodeURIComponent(aviso)}`);
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
    const lista = await embudos.todos(DATOS);
    return responder(res, 200, vistas.formulario({ reporte, cuentas, errorCuentas, mensaje: url.searchParams.get('m'), embudos: lista, embudo: embudoDe(reporte, lista) }));
  }

  if (accion === 'ver' && req.method === 'GET') {
    return responder(res, 200, vistas.reporte({ reporte, otros: await todos(), embudo: embudoDe(reporte, await embudos.todos(DATOS)) }));
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
      meta: { cliente: reporte.meta?.cliente, redes: reporte.meta?.redes, cuentas: reporte.meta?.cuentas, embudo: reporte.meta?.embudo },
      datos: { resumen: { kpis }, objetivos: reporte.datos?.objetivos, metodologia: { fuentes: reporte.datos?.metodologia?.fuentes } },
    });
    await escribir(copia);
    return redirigir(res, `${R}/${copia.id}/editar?m=${encodeURIComponent('Copia lista: pon las fechas del nuevo periodo.')}`);
  }

  if (accion === 'guardar') {
    const cuerpo = new URLSearchParams(await leerCuerpo(req));
    const avisos = [];

    // Fotos nuevas de campañas: se revisan y guardan, y en su lugar queda el nombre del archivo.
    for (const [k, v] of [...cuerpo.entries()]) {
      const m = /^datos\.pauta\.campanas\.(\d{1,3})\.imagenNueva$/.exec(k);
      if (!m) continue;
      cuerpo.delete(k);
      if (!v) continue;
      try {
        cuerpo.set(`datos.pauta.campanas.${m[1]}.imagen`, await imagenes.guardar(DATOS, v));
      } catch (e) {
        avisos.push(`Foto de la campaña ${Number(m[1]) + 1}: ${e.message}`);
      }
    }
    const csvTexto = cuerpo.get('csv.contenido') || '';
    const csvPlataforma = cuerpo.get('csv.plataforma') || '';
    cuerpo.delete('csv.contenido');
    cuerpo.delete('csv.plataforma');

    const enviado = armar(cuerpo.entries());
    reporte.meta = { ...(enviado.meta || {}), cuentas: enviado.meta?.cuentas || [] };
    if (reporte.meta.embudo !== undefined && !embudos.idValido(reporte.meta.embudo)) reporte.meta.embudo = '';
    reporte.datos = enviado.datos || {};
    for (const c of reporte.datos.pauta?.campanas || []) {
      if (c.imagen && !imagenes.valida(c.imagen)) c.imagen = '';
    }
    const que = cuerpo.get('accion');
    let mensaje = 'Guardado.';
    reporte.avisos = avisos;

    if (que === 'importarCsv') {
      try {
        if (!csvTexto) throw new Error('Elige el archivo CSV.');
        if (csvTexto.length > 3 * 1024 * 1024) throw new Error('El archivo es demasiado grande (máximo 3 MB).');
        const { filas, avisos: avisosCsv } = pautaCsv.leer(csvTexto, csvPlataforma);
        reporte.datos.pauta ??= {};
        reporte.datos.pauta.campanas = pautaCsv.combinar(reporte.datos.pauta.campanas, filas, csvPlataforma);
        reporte.avisos.push(...avisosCsv);
        mensaje = `${filas.length === 1 ? "Se importó 1 campaña" : `Se importaron ${filas.length} campañas`} de ${csvPlataforma}. Agrega la foto de cada una si quieres que aparezca.`;
      } catch (e) {
        reporte.avisos.push(`No se pudo importar el archivo: ${e.message}`);
        mensaje = 'Guardado, pero no se pudo importar el archivo.';
      }
    }

    if (que === 'importar') {
      const ant = calc.periodoAnterior(reporte.meta.inicio, reporte.meta.fin);
      const traidos = [];
      if (!ant) {
        reporte.avisos.push('Pon las fechas del periodo para poder traer datos.');
      } else {
        // 1) Postiz (solo si se eligieron cuentas).
        if (reporte.meta.cuentas?.length) {
          try {
            const traido = await postiz.traerDatos(cookie, reporte.meta);
            reporte.datos = mezclar(reporte.datos, traido.datos);
            reporte.series = { ...(reporte.series || {}), ...traido.series };
            reporte.avisos.push(...traido.avisos);
            traidos.push('Postiz');
            reporte.datos.metodologia ??= {};
            if (!reporte.datos.metodologia.notas)
              reporte.datos.metodologia.notas =
                'Alcance, impresiones e interacciones son la suma de las publicaciones del periodo (una persona puede contarse en más de una publicación).';
          } catch (e) {
            if (e.sesion) return redirigir(res, `/auth/login?returnUrl=${encodeURIComponent(`${R}/${id}/editar`)}`);
            reporte.avisos.push(`No se pudieron traer los datos de Postiz: ${e.message}`);
          }
        }
        // 2) Enlaces rastreables y registro del cliente (por nombre de cliente).
        const extra = await rutasExtra.datosDelCliente(DATOS, reporte.meta.cliente, reporte.meta.inicio, reporte.meta.fin, ant);
        if (extra.hayAlgo) {
          reporte.datos = mezclar(reporte.datos, { embudo: extra.datos.embudo });
          // Las etapas "a mano" del embudo: se ponen tal cual, sin borrar lo escrito si viene vacío.
          for (const [etapa, v] of Object.entries(extra.datos.embudoEtapas || {})) {
            reporte.datos.embudoEtapas ??= {};
            reporte.datos.embudoEtapas[etapa] ??= {};
            for (const p of ['actual', 'anterior']) if (v[p] !== '') reporte.datos.embudoEtapas[etapa][p] = v[p];
          }
          reporte.series = { ...(reporte.series || {}), enlaces: extra.resumenEnlaces };
          reporte.avisos.push(...extra.avisos);
          traidos.push('enlaces y registro del cliente');
        }
        if (traidos.length) {
          reporte.datos.metodologia ??= {};
          reporte.datos.metodologia.fecha = vistas.diaMexico();
          if (!reporte.datos.metodologia.fuentes)
            reporte.datos.metodologia.fuentes = `Estadísticas de cada red vía Postiz, enlaces rastreables de Prisma CN y registro del negocio`;
          mensaje = `Datos actualizados (${traidos.join(' + ')}). Revisa los avisos y completa lo que falta a mano.`;
        } else if (!reporte.avisos.length) {
          reporte.avisos.push('No hay de dónde traer datos: elige cuentas de Postiz, crea enlaces rastreables o un registro para este cliente.');
        }
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

