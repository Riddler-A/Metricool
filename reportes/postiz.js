// Habla con Postiz usando la misma sesión de quien abrió el reporte (su cookie).
// Así no hace falta ninguna llave extra y cada quien solo ve lo de su organización.

const calc = require('./calculos');

const BASE = process.env.POSTIZ_INTERNO || 'http://postiz:5000/api';

async function pedir(cookie, ruta, { timeout = 30000 } = {}) {
  const r = await fetch(`${BASE}${ruta}`, {
    headers: { cookie, accept: 'application/json' },
    signal: AbortSignal.timeout(timeout),
  });
  if (r.status === 401 || r.status === 403) {
    const e = new Error('Sesión vencida');
    e.sesion = true;
    throw e;
  }
  if (!r.ok) throw new Error(`Postiz respondió ${r.status} en ${ruta.split('?')[0]}`);
  return r.json();
}

// Usuario de la sesión, o null si no hay sesión válida.
async function sesion(cookie) {
  if (!cookie || !/(^|;\s*)auth=/.test(cookie)) return null;
  try {
    return await pedir(cookie, '/user/self', { timeout: 8000 });
  } catch {
    return null;
  }
}

async function cuentas(cookie) {
  const { integrations = [] } = await pedir(cookie, '/integrations/list');
  return integrations
    .filter((i) => !i.disabled)
    .map((i) => ({
      id: i.id,
      nombre: i.name,
      red: calc.NOMBRE_RED[i.identifier] || i.identifier,
      identificador: i.identifier,
      cliente: i.customer?.name || '',
    }));
}

// La lista de Postiz viene "minificada" (llaves de una letra); aquí se expande.
function expandir(post) {
  const n = post.n || post.integration || {};
  return {
    id: post.i ?? post.id,
    content: post.c ?? post.content,
    publishDate: post.d ?? post.publishDate,
    releaseURL: post.u ?? post.releaseURL,
    state: post.s ?? post.state,
    integration: { id: n.i ?? n.id, providerIdentifier: n.pi ?? n.providerIdentifier, name: n.n ?? n.name },
    tags: (post.tg ?? post.tags ?? []).map((t) => ({ tag: { name: t.t?.n ?? t.tag?.name } })),
  };
}

async function publicaciones(cookie, inicio, fin, idsCuentas) {
  const q = new URLSearchParams({
    startDate: `${inicio}T00:00:00.000Z`,
    endDate: `${fin}T23:59:59.999Z`,
  });
  const resp = await pedir(cookie, `/posts?${q}`);
  const lista = (resp.p ?? resp.posts ?? []).map(expandir);
  return lista.filter(
    (p) =>
      p.state === 'PUBLISHED' &&
      idsCuentas.includes(p.integration.id) &&
      p.publishDate >= `${inicio}T00:00:00` &&
      p.publishDate <= `${fin}T23:59:59.999Z`
  );
}

// Archivos de la publicación (para saber si es video, carrusel o imagen).
async function medios(cookie, id) {
  try {
    const r = await pedir(cookie, `/posts/${encodeURIComponent(id)}`);
    const p = r.posts?.[0] ?? r;
    return p.image ?? [];
  } catch (e) {
    if (e.sesion) throw e;
    return [];
  }
}

async function metricasPublicacion(cookie, id) {
  try {
    const datos = await pedir(cookie, `/analytics/post/${encodeURIComponent(id)}?date=90`);
    return calc.sumarMetricas(Array.isArray(datos) ? datos : []);
  } catch (e) {
    if (e.sesion) throw e;
    return {};
  }
}

// Corre `fn` sobre la lista con pocas peticiones a la vez para no saturar a Postiz
// ni a la API de cada red.
async function enLotes(lista, fn, tamano = 4) {
  const res = [];
  for (let i = 0; i < lista.length; i += tamano) {
    res.push(...(await Promise.all(lista.slice(i, i + tamano).map(fn))));
  }
  return res;
}

async function periodo(cookie, inicio, fin, idsCuentas) {
  const posts = await publicaciones(cookie, inicio, fin, idsCuentas);
  return enLotes(posts, async (post) => ({
    post: { ...post, image: await medios(cookie, post.id) },
    metricas: await metricasPublicacion(cookie, post.id),
  }));
}

// Métricas de la cuenta día por día (alcance y seguidores nuevos), sumando todas las
// cuentas elegidas. Se pide una sola vez desde el inicio del periodo anterior.
// Las redes solo guardan unos 30 a 90 días hacia atrás.
async function seriesCuentas(cookie, idsCuentas, desde) {
  const dias = Math.min(90, Math.ceil((Date.now() - Date.parse(`${desde}T00:00:00Z`)) / 86400000) + 1);
  const series = [];
  for (const id of idsCuentas) {
    try {
      const s = await pedir(cookie, `/analytics/${encodeURIComponent(id)}?date=${dias}`);
      // Solo las métricas que vienen por día (las de total del periodo traen un solo punto).
      series.push(...(Array.isArray(s) ? s : []).filter((m) => (m.data || []).length > 1));
    } catch (e) {
      if (e.sesion) throw e;
    }
  }
  return series;
}

function sumaSerie(dias, clave) {
  const vals = Object.values(dias).map((d) => d[clave]).filter((v) => v !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}

// Junta todo lo que se puede llenar solo. Devuelve también avisos para el equipo.
async function traerDatos(cookie, { inicio, fin, cuentas: ids }) {
  const ant = calc.periodoAnterior(inicio, fin);
  if (!ant) throw new Error('Revisa las fechas del periodo.');
  if (!ids?.length) throw new Error('Elige al menos una cuenta de Postiz.');

  const [actual, anterior] = [await periodo(cookie, inicio, fin, ids), await periodo(cookie, ant.inicio, ant.fin, ids)];
  const ra = calc.resumenPublicaciones(actual);
  const rb = calc.resumenPublicaciones(anterior);
  const cuenta = await seriesCuentas(cookie, ids, ant.inicio);
  const diasA = calc.seriePorDia(cuenta, inicio, fin);
  const diasB = calc.seriePorDia(cuenta, ant.inicio, ant.fin);
  const nuevosA = sumaSerie(diasA, 'nuevos');
  const nuevosB = sumaSerie(diasB, 'nuevos');

  // Serie diaria para las gráficas del periodo actual.
  const publicadasPorDia = {};
  for (const { post } of actual) {
    const f = String(post.publishDate || '').slice(0, 10);
    publicadasPorDia[f] = (publicadasPorDia[f] || 0) + 1;
  }
  const dias = calc.listaDias(inicio, fin).map((fecha) => ({
    fecha,
    alcance: diasA[fecha]?.alcance ?? null,
    nuevos: diasA[fecha]?.nuevos ?? null,
    publicaciones: publicadasPorDia[fecha] || 0,
  }));

  const avisos = [];
  if (!ra.publicaciones) avisos.push('No hay publicaciones publicadas en el periodo para esas cuentas.');
  else if (ra.conDatos < ra.publicaciones)
    avisos.push(`${ra.publicaciones - ra.conDatos} de ${ra.publicaciones} publicaciones no trajeron métricas (la red no las entregó).`);
  if (nuevosB === null) avisos.push('Seguidores nuevos del periodo anterior: la red solo guarda unos 30 días; llénalo a mano.');

  const par = (a, b) => ({ actual: a === null || a === undefined ? '' : String(a), anterior: b === null || b === undefined ? '' : String(b) });
  const t = (r, k) => (r.conDatos ? r.totales[k] : null);

  return {
    anterior: ant,
    avisos,
    series: { dias, ranking: ra.ranking, importado: new Date().toISOString() },
    datos: {
      embudo: {
        visibilidad: {
          alcance: par(t(ra, 'alcance'), t(rb, 'alcance')),
          impresiones: par(t(ra, 'impresiones'), t(rb, 'impresiones')),
          nuevos: par(nuevosA, nuevosB),
        },
        interaccion: {
          engagement: par(t(ra, 'engagement'), t(rb, 'engagement')),
          likes: par(t(ra, 'likes'), t(rb, 'likes')),
          comentarios: par(t(ra, 'comentarios'), t(rb, 'comentarios')),
          guardados: par(t(ra, 'guardados'), t(rb, 'guardados')),
          compartidos: par(t(ra, 'compartidos'), t(rb, 'compartidos')),
        },
      },
      contenido: {
        mejores: ra.mejores,
        peores: ra.peores,
        formatos: ra.formatos,
        pilares: ra.pilares,
      },
      porRed: ra.redes.length > 1 ? { filas: ra.redes } : undefined,
    },
  };
}

module.exports = { sesion, cuentas, traerDatos };
