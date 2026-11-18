// Lee el CSV de campañas que exporta cada plataforma (Meta, TikTok o Google Ads) y lo
// convierte en filas de la tabla de pauta. Los nombres de columna cambian según el idioma
// y la plataforma, así que se buscan por sinónimos.

const PLATAFORMAS = ['Meta', 'TikTok', 'Google Ads'];

// En orden de preferencia: primero se busca el nombre exacto y luego uno que empiece igual.
const SINONIMOS = {
  campana: ['nombre de la campana', 'campaign name', 'campana', 'campaign'],
  objetivo: ['objetivo', 'objective', 'tipo de campana', 'campaign type', 'objetivo de la campana'],
  inversion: ['importe gastado', 'amount spent', 'gasto', 'spend', 'costo', 'cost', 'total cost', 'coste'],
  impresiones: ['impresiones', 'impressions', 'impr', 'impr.'],
  alcance: ['alcance', 'reach'],
  clics: ['clics en el enlace', 'link clicks', 'clics', 'clicks', 'clics (todos)', 'clicks (all)', 'clicks (destination)'],
  resultados: ['resultados', 'results', 'conversiones', 'conversions', 'conversions (all)'],
};

const OBLIGATORIAS = ['campana', 'inversion'];

function normalizar(t) {
  return String(t || '')
    .replace(/^﻿/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*\((mxn|usd|eur|\$)\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// CSV con comillas, separado por coma, punto y coma o tabulador.
function filasCsv(texto) {
  const t = String(texto || '').replace(/^﻿/, '');
  const muestra = t.split(/\r?\n/).slice(0, 10).join('\n');
  const sep = ['\t', ';', ','].map((s) => [s, muestra.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const filas = [];
  let fila = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila); }
  return filas.filter((f) => f.some((c) => c.trim() !== ''));
}

// "1,234.56" (México/EUA) o "1.234,56" (Europa) → "1234.56"
function cifra(v) {
  let s = String(v ?? '').replace(/[^\d.,-]/g, '');
  if (!s || s === '-' || s === '--') return '';
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^-?\d+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  return Number.isFinite(Number(s)) ? s : '';
}

function columnas(encabezado) {
  const norm = encabezado.map(normalizar);
  const mapa = {};
  for (const [clave, sinonimos] of Object.entries(SINONIMOS)) {
    let idx = -1;
    for (const s of sinonimos) {
      idx = norm.indexOf(s);
      if (idx >= 0) break;
    }
    if (idx < 0) {
      for (const s of sinonimos) {
        idx = norm.findIndex((h) => h.startsWith(s) && !/\bid\b/.test(h));
        if (idx >= 0) break;
      }
    }
    if (idx >= 0) mapa[clave] = idx;
  }
  return mapa;
}

// Devuelve { filas, avisos } o lanza un error si no se reconoce el archivo.
function leer(texto, plataforma) {
  if (!PLATAFORMAS.includes(plataforma)) throw new Error('Elige la plataforma del archivo.');
  const filas = filasCsv(texto);
  // Google Ads pone una o dos líneas de título antes del encabezado: se busca la fila que
  // tenga la columna de campaña.
  const iEnc = filas.findIndex((f) => {
    const m = columnas(f);
    return m.campana !== undefined && m.inversion !== undefined;
  });
  if (iEnc < 0) {
    throw new Error('No encontré las columnas de nombre de campaña y de inversión/costo. Revisa que sea el reporte de campañas en CSV.');
  }
  const mapa = columnas(filas[iEnc]);
  const avisos = [];
  for (const [clave, nombre] of [['impresiones', 'impresiones'], ['alcance', 'alcance'], ['clics', 'clics'], ['resultados', 'resultados']]) {
    if (mapa[clave] === undefined) avisos.push(`El archivo no trae la columna de ${nombre}; llénala a mano si la necesitas.`);
  }
  const resultado = [];
  for (const f of filas.slice(iEnc + 1)) {
    const nombre = String(f[mapa.campana] ?? '').trim();
    // Filas de totales o vacías (Meta pone una sin nombre; Google Ads, "Total: ...").
    if (!nombre || /^total\b/i.test(normalizar(nombre)) || nombre === '--') continue;
    const fila = { plataforma, campana: nombre.slice(0, 200) };
    if (mapa.objetivo !== undefined) fila.objetivo = String(f[mapa.objetivo] ?? '').trim().slice(0, 120);
    for (const k of ['inversion', 'impresiones', 'alcance', 'clics', 'resultados']) {
      if (mapa[k] !== undefined) fila[k] = cifra(f[mapa[k]]);
    }
    resultado.push(fila);
    if (resultado.length >= 50) {
      avisos.push('Solo se importaron las primeras 50 campañas.');
      break;
    }
  }
  if (!resultado.length) throw new Error('El archivo no trae campañas (solo encabezados o totales).');
  return { filas: resultado, avisos };
}

// Reemplaza las campañas de esa plataforma y conserva foto y objetivo de las que ya existían
// con el mismo nombre.
function combinar(previas, nuevas, plataforma) {
  const clave = (c) => normalizar(c.campana);
  const anteriores = (previas || []).filter((c) => c.plataforma === plataforma);
  const otras = (previas || []).filter((c) => c.plataforma !== plataforma);
  return [
    ...otras,
    ...nuevas.map((n) => {
      const igual = anteriores.find((a) => clave(a) === clave(n));
      return { ...n, imagen: igual?.imagen || '', objetivo: n.objetivo || igual?.objetivo || '' };
    }),
  ];
}

module.exports = { leer, combinar, filasCsv, cifra, PLATAFORMAS };
