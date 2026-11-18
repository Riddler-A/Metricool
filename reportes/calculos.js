// Números, variaciones y resúmenes a partir de los datos de Postiz.
// Todo es puro (sin red ni disco) para poder probarlo con `node --test`.

// "12,500" → 12500 · "4.5%" → 4.5 · "$1,200.50" → 1200.5 · "" → null
function numero(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const limpio = String(valor).replace(/[\s,$%]/g, '').replace(/MXN/i, '');
  if (limpio === '' || !/^-?\d*\.?\d+$/.test(limpio)) return null;
  return Number(limpio);
}

const fmtEntero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const fmtDecimal = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

// Da formato para el reporte. Si no es un número, se respeta lo que se escribió.
function mostrar(valor, formato) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return '';
  if (formato === 'texto' || formato === 'enlace' || !formato) return String(valor).trim();
  const n = numero(valor);
  if (n === null) return String(valor).trim();
  if (formato === 'porcentaje') return `${fmtDecimal.format(n)}%`;
  if (formato === 'dinero') return fmtDinero.format(n);
  return Number.isInteger(n) ? fmtEntero.format(n) : fmtDecimal.format(n);
}

// Variación porcentual entre dos valores. null si no se puede calcular.
function variacion(actual, anterior) {
  const a = numero(actual);
  const b = numero(anterior);
  if (a === null || b === null || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

function mostrarVariacion(v) {
  if (v === null) return '';
  const signo = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${signo}${fmtDecimal.format(Math.abs(v))}%`;
}

// Interacciones ÷ alcance × 100 (fórmula fija de Prisma CN).
function tasaEngagement({ likes, comentarios, guardados, compartidos, alcance }) {
  const r = numero(alcance);
  if (!r) return null;
  const partes = [likes, comentarios, guardados, compartidos].map(numero);
  if (partes.every((p) => p === null)) return null;
  const total = partes.reduce((s, p) => s + (p || 0), 0);
  return redondear((total / r) * 100, 2);
}

function redondear(n, decimales = 0) {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

// Llena los campos que se pueden calcular solos, sin pisar lo que se escribió a mano.
function completarCalculados(datos) {
  const d = structuredClone(datos || {});
  const vis = d.embudo?.visibilidad || {};
  const int = d.embudo?.interaccion || {};
  for (const periodo of ['actual', 'anterior']) {
    const eng = int.engagement?.[periodo];
    if (eng === undefined || String(eng).trim() === '') {
      const t = tasaEngagement({
        likes: int.likes?.[periodo],
        comentarios: int.comentarios?.[periodo],
        guardados: int.guardados?.[periodo],
        compartidos: int.compartidos?.[periodo],
        alcance: vis.alcance?.[periodo],
      });
      if (t !== null) {
        d.embudo ??= {};
        d.embudo.interaccion ??= {};
        d.embudo.interaccion.engagement ??= {};
        d.embudo.interaccion.engagement[periodo] = String(t);
      }
    }
  }
  return d;
}

// Estado de un KPI contra su meta. Se asume que "más es mejor".
function estadoKpi(actual, meta) {
  const a = numero(actual);
  const m = numero(meta);
  if (a === null || m === null) return '';
  return a >= m ? 'Cumplida' : 'Por debajo';
}

// Costo por resultado y fila de totales de la pauta.
function resumenPauta(campanas) {
  const filas = (campanas || []).map((c) => {
    const inv = numero(c.inversion);
    const res = numero(c.resultados);
    return { ...c, costo: inv !== null && res ? redondear(inv / res, 2) : null };
  });
  const suma = (k) => {
    const vals = filas.map((f) => numero(f[k])).filter((v) => v !== null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
  };
  const inversion = suma('inversion');
  const resultados = suma('resultados');
  return {
    filas,
    total: {
      inversion,
      resultados,
      alcance: suma('alcance'),
      costo: inversion !== null && resultados ? redondear(inversion / resultados, 2) : null,
    },
  };
}

// ---------- Datos de Postiz ----------

// Postiz entrega las métricas como [{ label, data: [{ total, date }] }].
// Las etiquetas cambian según la red; aquí se normalizan.
const ETIQUETAS = {
  alcance: ['reach', 'alcance'],
  impresiones: ['views', 'impressions', 'video views', 'plays'],
  likes: ['likes', 'like', 'reactions'],
  comentarios: ['comments', 'comment', 'replies'],
  guardados: ['saves', 'saved', 'bookmarks', 'favorites'],
  compartidos: ['shares', 'share', 'reposts', 'retweets'],
  nuevos: ['follower count', 'followers', 'new followers', 'follows'],
};

function claveDeEtiqueta(label) {
  const l = String(label || '').toLowerCase().replace(/_/g, ' ').trim();
  for (const [clave, nombres] of Object.entries(ETIQUETAS)) {
    if (nombres.includes(l)) return clave;
  }
  return null;
}

// Suma una serie de métricas, opcionalmente solo entre dos fechas (YYYY-MM-DD).
function sumarMetricas(analytics, desde, hasta) {
  const total = {};
  for (const m of analytics || []) {
    const clave = claveDeEtiqueta(m.label);
    if (!clave) continue;
    for (const p of m.data || []) {
      if (desde && (p.date < desde || p.date > hasta)) continue;
      const n = numero(p.total);
      if (n === null) continue;
      total[clave] = (total[clave] || 0) + n;
    }
  }
  return total;
}

// Formato de la publicación según sus archivos.
function formatoPublicacion(post) {
  let medios = post.image;
  if (typeof medios === 'string') {
    try { medios = JSON.parse(medios); } catch { medios = []; }
  }
  medios = Array.isArray(medios) ? medios : [];
  const esVideo = (m) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(m?.path || m?.url || '');
  if (medios.some(esVideo)) return 'video';
  if (medios.length > 1) return 'carrusel';
  if (medios.length === 1) return 'imagen';
  return 'texto';
}

const NOMBRE_FORMATO = { video: 'Reel / video', carrusel: 'Carrusel', imagen: 'Imagen estática', texto: 'Solo texto' };

function textoCorto(html, max = 70) {
  const t = String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function interaccionesDe(m) {
  return (m.likes || 0) + (m.comentarios || 0) + (m.guardados || 0) + (m.compartidos || 0);
}

// Resume las publicaciones de un periodo. `publicaciones` = [{ post, metricas }]
// donde metricas ya viene normalizado con sumarMetricas.
function resumenPublicaciones(publicaciones) {
  const tot = { alcance: 0, impresiones: 0, likes: 0, comentarios: 0, guardados: 0, compartidos: 0 };
  const conDatos = publicaciones.filter((p) => Object.keys(p.metricas || {}).length);
  for (const { metricas } of conDatos) {
    for (const k of Object.keys(tot)) tot[k] += metricas[k] || 0;
  }
  const engagement = tasaEngagement({ ...tot, alcance: tot.alcance });

  const filas = conDatos.map(({ post, metricas }) => ({
    post,
    formato: formatoPublicacion(post),
    alcance: metricas.alcance || 0,
    interacciones: interaccionesDe(metricas),
    engagement: metricas.alcance ? (interaccionesDe(metricas) / metricas.alcance) * 100 : null,
    red: post.integration?.providerIdentifier || post.integration?.identifier || '',
    tags: (post.tags || []).map((t) => t.tag?.name || t.name).filter(Boolean),
  }));

  const ordenadas = [...filas].sort((a, b) => b.interacciones - a.interacciones || b.alcance - a.alcance);
  const aFila = (f) => ({
    publicacion: textoCorto(f.post.content),
    enlace: f.post.releaseURL || '',
    formato: NOMBRE_FORMATO[f.formato],
    alcance: String(f.alcance),
    interacciones: String(f.interacciones),
  });
  const mejores = ordenadas.slice(0, 3).map(aFila);
  // Las peores no repiten a las mejores cuando hay menos de 6 publicaciones.
  const peores = ordenadas.slice(3).slice(-3).reverse().map(aFila);

  const promedios = (grupo) => {
    const conAlcance = grupo.filter((f) => f.engagement !== null);
    return {
      publicaciones: String(grupo.length),
      alcance: grupo.length ? String(Math.round(grupo.reduce((s, f) => s + f.alcance, 0) / grupo.length)) : '',
      engagement: conAlcance.length
        ? String(redondear(conAlcance.reduce((s, f) => s + f.engagement, 0) / conAlcance.length, 2))
        : '',
    };
  };

  const formatos = {};
  for (const clave of ['video', 'carrusel', 'imagen']) {
    const grupo = filas.filter((f) => f.formato === clave);
    if (grupo.length) formatos[clave] = promedios(grupo);
  }

  const porPilar = new Map();
  for (const f of filas) for (const t of f.tags) porPilar.set(t, [...(porPilar.get(t) || []), f]);
  const pilares = [...porPilar.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([pilar, grupo]) => ({ pilar, ...promedios(grupo) }));

  const porRed = new Map();
  for (const f of filas) porRed.set(f.red, [...(porRed.get(f.red) || []), f]);
  const redes = [...porRed.entries()].map(([red, grupo]) => {
    const m = grupo.reduce(
      (s, f) => ({ alcance: s.alcance + f.alcance, inter: s.inter + f.interacciones }),
      { alcance: 0, inter: 0 }
    );
    return {
      red: NOMBRE_RED[red] || red,
      alcance: String(m.alcance),
      engagement: m.alcance ? String(redondear((m.inter / m.alcance) * 100, 2)) : '',
      publicaciones: String(grupo.length),
    };
  });

  return {
    totales: { ...tot, engagement },
    publicaciones: publicaciones.length,
    conDatos: conDatos.length,
    mejores,
    peores,
    formatos,
    pilares,
    redes,
  };
}

const NOMBRE_RED = {
  instagram: 'Instagram',
  'instagram-standalone': 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  'linkedin-page': 'LinkedIn',
  youtube: 'YouTube',
  threads: 'Threads',
  x: 'X',
  pinterest: 'Pinterest',
  gmb: 'Google Business',
};

// Periodo anterior de la misma duración, justo antes del actual.
function periodoAnterior(inicio, fin) {
  const dia = 24 * 3600 * 1000;
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fin}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  const dias = Math.round((b - a) / dia) + 1;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  return { inicio: iso(a - dias * dia), fin: iso(a - dia), dias };
}

module.exports = {
  numero,
  mostrar,
  variacion,
  mostrarVariacion,
  tasaEngagement,
  completarCalculados,
  estadoKpi,
  resumenPauta,
  claveDeEtiqueta,
  sumarMetricas,
  formatoPublicacion,
  resumenPublicaciones,
  periodoAnterior,
  textoCorto,
  NOMBRE_RED,
};
