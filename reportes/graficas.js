// Gráficas del reporte como SVG en línea: se ven igual en pantalla y en el PDF,
// sin librerías ni internet.
//
// Colores (validados con el revisor de paletas: se distinguen con daltonismo y
// tienen contraste ≥ 3:1 sobre blanco):
//   este periodo → terracota #A85C32 · periodo anterior / referencia → gris #4A4A4A
// El dorado no se usa en marcas: sobre blanco no llega a 3:1.
// Reglas: un solo eje por gráfica, leyenda cuando hay dos series, valores en tinta
// de texto (no del color de la serie) y <title> en cada marca para el tooltip.

const ACTUAL = '#A85C32';
const ANTERIOR = '#4A4A4A';
const REJILLA = '#E2DED6';
const TINTA = '#000000';
const TINTA2 = '#4A4A4A';

const compacto = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });
const entero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(n, formato) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (formato === 'porcentaje') return `${decimal.format(n)}%`;
  if (formato === 'dinero') return `$${entero.format(n)}`;
  return Math.abs(n) >= 10000 ? compacto.format(n) : Number.isInteger(n) ? entero.format(n) : decimal.format(n);
}

// Máximo "redondo" para el eje (1, 2, 2.5, 5 × 10ⁿ).
function techo(max) {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

// Barra horizontal con el extremo de datos redondeado (4 px) y el inicio recto en la base.
function barraH(x, y, w, h, color, titulo) {
  if (w <= 0) return '';
  const r = Math.min(4, w, h / 2);
  return `<path d="M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z" fill="${color}"><title>${esc(titulo)}</title></path>`;
}

// Columna vertical: extremo superior redondeado, base recta.
function barraV(x, y, w, h, color, titulo) {
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `<path d="M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z" fill="${color}"><title>${esc(titulo)}</title></path>`;
}

function leyenda(series, y = 14) {
  let x = 0;
  return series
    .map(([nombre, color]) => {
      const g = `<rect x="${x}" y="${y - 9}" width="10" height="10" rx="2" fill="${color}"/><text x="${x + 15}" y="${y}" class="g-leyenda">${esc(nombre)}</text>`;
      x += 30 + nombre.length * 6.4;
      return g;
    })
    .join('');
}

function svg(ancho, alto, cuerpo, etiqueta) {
  return `<figure class="grafica"><svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${esc(etiqueta)}" xmlns="http://www.w3.org/2000/svg">${cuerpo}</svg></figure>`;
}

// ---------- Barras horizontales (una serie) ----------
// filas: [{ etiqueta, valor, nota? }]
function barras({ filas, formato, etiqueta, ancho = 640 }) {
  const datos = filas.filter((f) => Number.isFinite(f.valor));
  if (!datos.length) return '';
  const izq = 150;
  const der = datos.some((f) => f.nota) ? 190 : 70;
  const alto = 26;
  const gap = 10;
  const max = Math.max(...datos.map((f) => f.valor), 0);
  const escala = (ancho - izq - der) / (max || 1);
  const cuerpo = datos
    .map((f, i) => {
      const y = i * (alto + gap);
      const w = Math.max(f.valor > 0 ? 2 : 0, f.valor * escala);
      return `<text x="${izq - 10}" y="${y + alto / 2 + 4}" text-anchor="end" class="g-etiqueta">${esc(f.etiqueta)}</text>
${barraH(izq, y, w, alto, ACTUAL, `${f.etiqueta}: ${fmt(f.valor, formato)}`)}
<text x="${izq + w + 8}" y="${y + alto / 2 + 4}" class="g-valor">${esc(fmt(f.valor, formato))}${f.nota ? `<tspan class="g-nota"> ${esc(f.nota)}</tspan>` : ''}</text>`;
    })
    .join('');
  return svg(ancho, datos.length * (alto + gap) - gap + 2, cuerpo, etiqueta);
}

// ---------- Comparación este periodo vs anterior ----------
// filas: [{ etiqueta, actual, anterior }]
function comparacion({ filas, formato, etiqueta, ancho = 640 }) {
  const datos = filas.filter((f) => Number.isFinite(f.actual) || Number.isFinite(f.anterior));
  if (!datos.length) return '';
  const izq = 150;
  const der = 70;
  const h = 14;
  const grupo = h * 2 + 2 + 16; // dos barras, 2 px de separación y aire entre grupos
  const arriba = 28;
  const max = Math.max(...datos.flatMap((f) => [f.actual || 0, f.anterior || 0]), 0);
  const escala = (ancho - izq - der) / (max || 1);
  const cuerpo = datos
    .map((f, i) => {
      const y = arriba + i * grupo;
      const wa = Number.isFinite(f.actual) ? Math.max(f.actual > 0 ? 2 : 0, f.actual * escala) : 0;
      const wb = Number.isFinite(f.anterior) ? Math.max(f.anterior > 0 ? 2 : 0, f.anterior * escala) : 0;
      return `<text x="${izq - 10}" y="${y + h + 4}" text-anchor="end" class="g-etiqueta">${esc(f.etiqueta)}</text>
${barraH(izq, y, wa, h, ACTUAL, `${f.etiqueta}, este periodo: ${fmt(f.actual, formato)}`)}
<text x="${izq + wa + 6}" y="${y + h - 3}" class="g-valor">${esc(fmt(f.actual, formato))}</text>
${barraH(izq, y + h + 2, wb, h, ANTERIOR, `${f.etiqueta}, periodo anterior: ${fmt(f.anterior, formato)}`)}
<text x="${izq + wb + 6}" y="${y + 2 * h - 1}" class="g-valor tenue">${esc(fmt(f.anterior, formato))}</text>`;
    })
    .join('');
  return svg(ancho, arriba + datos.length * grupo - 14, leyenda([['Este periodo', ACTUAL], ['Periodo anterior', ANTERIOR]]) + cuerpo, etiqueta);
}

// ---------- Columnas verticales (una serie en el tiempo) ----------
// puntos: [{ etiqueta, valor }]
function columnas({ puntos, formato, etiqueta, ancho = 640, alto = 190, resaltarUltimo = false }) {
  if (!puntos.length || puntos.every((p) => !Number.isFinite(p.valor))) return '';
  const izq = 44;
  const abajo = 22;
  const arriba = 16;
  const max = techo(Math.max(...puntos.map((p) => p.valor || 0)));
  const area = alto - abajo - arriba;
  const paso = (ancho - izq) / puntos.length;
  const w = Math.max(4, Math.min(36, paso * 0.6));
  const cada = Math.ceil(puntos.length / 12);
  let cuerpo = ejeY(izq, arriba, area, ancho, max, formato);
  cuerpo += puntos
    .map((p, i) => {
      const x = izq + i * paso + (paso - w) / 2;
      const h = Number.isFinite(p.valor) ? (p.valor / max) * area : 0;
      const color = resaltarUltimo && i < puntos.length - 1 ? ANTERIOR : ACTUAL;
      const etq = i % cada === 0 || (i === puntos.length - 1 && i % cada >= cada / 2) ? `<text x="${x + w / 2}" y="${alto - 6}" text-anchor="middle" class="g-eje">${esc(p.etiqueta)}</text>` : '';
      const valor = resaltarUltimo && puntos.length <= 12 ? `<text x="${x + w / 2}" y="${arriba + area - h - 5}" text-anchor="middle" class="g-valor chico">${esc(fmt(p.valor, formato))}</text>` : '';
      return barraV(x, arriba + area - h, w, h, color, `${p.etiqueta}: ${fmt(p.valor, formato)}`) + valor + etq;
    })
    .join('');
  return svg(ancho, alto, cuerpo, etiqueta);
}

function ejeY(izq, arriba, area, ancho, max, formato) {
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k;
    const y = arriba + area - (v / max) * area;
    g += `<line x1="${izq}" x2="${ancho}" y1="${y}" y2="${y}" stroke="${REJILLA}" stroke-width="${k === 0 ? 1 : 0.6}"/>`;
    g += `<text x="${izq - 6}" y="${y + 3}" text-anchor="end" class="g-eje">${esc(fmt(v, formato))}</text>`;
  }
  return g;
}

// ---------- Línea diaria con marcas de días con publicación ----------
// puntos: [{ fecha: 'YYYY-MM-DD', valor }], marcas: Set de fechas con publicación
function lineaDiaria({ puntos, marcas = new Set(), formato, etiqueta, ancho = 640, alto = 210 }) {
  const datos = puntos.filter((p) => Number.isFinite(p.valor));
  if (datos.length < 2) return '';
  const izq = 44;
  const abajo = 40;
  const arriba = 22;
  const area = alto - abajo - arriba;
  const max = techo(Math.max(...datos.map((p) => p.valor)));
  const n = puntos.length;
  const xDe = (i) => izq + 6 + (i / (n - 1)) * (ancho - izq - 12);
  const yDe = (v) => arriba + area - (v / max) * area;

  let cuerpo = ejeY(izq, arriba, area, ancho, max, formato);
  // Línea de 2 px; se corta donde falta el dato.
  let d = '';
  puntos.forEach((p, i) => {
    if (!Number.isFinite(p.valor)) return;
    const previo = i > 0 && Number.isFinite(puntos[i - 1].valor);
    d += `${previo ? 'L' : 'M'}${xDe(i).toFixed(1)},${yDe(p.valor).toFixed(1)}`;
  });
  cuerpo += `<path d="${d}" fill="none" stroke="${ACTUAL}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

  // Punto y valor del día más alto; los demás solo con tooltip.
  const mayor = datos.reduce((a, b) => (b.valor > a.valor ? b : a));
  puntos.forEach((p, i) => {
    if (!Number.isFinite(p.valor)) return;
    const esMayor = p === mayor;
    cuerpo += `<circle cx="${xDe(i)}" cy="${yDe(p.valor)}" r="${esMayor ? 4 : 2.5}" fill="${ACTUAL}" stroke="#fff" stroke-width="1.5"><title>${esc(diaCorto(p.fecha))}: ${esc(fmt(p.valor, formato))}${marcas.has(p.fecha) ? ' · día con publicación' : ''}</title></circle>`;
    if (esMayor) cuerpo += `<text x="${xDe(i)}" y="${yDe(p.valor) - 9}" text-anchor="middle" class="g-valor chico">${esc(fmt(p.valor, formato))}</text>`;
  });

  // Fila de marcas bajo el eje: días con publicación (no es un segundo eje).
  const yMarcas = arriba + area + 9;
  puntos.forEach((p, i) => {
    if (marcas.has(p.fecha)) cuerpo += `<path d="M${xDe(i) - 4},${yMarcas + 6}L${xDe(i)},${yMarcas}L${xDe(i) + 4},${yMarcas + 6}Z" fill="${ANTERIOR}"><title>${esc(diaCorto(p.fecha))}: se publicó</title></path>`;
  });
  const cada = Math.ceil(n / 8);
  puntos.forEach((p, i) => {
    if (i % cada === 0 || (i === n - 1 && i % cada >= cada / 2)) cuerpo += `<text x="${xDe(i)}" y="${alto - 6}" text-anchor="middle" class="g-eje">${esc(diaCorto(p.fecha))}</text>`;
  });
  if (marcas.size) {
    cuerpo += `<path d="M${ancho - 128},14L${ancho - 124},8L${ancho - 120},14Z" fill="${ANTERIOR}"/><text x="${ancho - 114}" y="14" class="g-leyenda">Día con publicación</text>`;
  }
  return svg(ancho, alto, cuerpo, etiqueta);
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function diaCorto(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${Number(m[3])} ${MES[Number(m[2]) - 1]}` : iso || '';
}
function mesCorto(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(iso || '');
  return m ? `${MES[Number(m[2]) - 1]} ${m[1].slice(2)}` : iso || '';
}

// ---------- Embudo ----------
// etapas: [{ etiqueta, valor }] de arriba hacia abajo. Muestra cuántos pasan a la siguiente.
function embudo({ etapas, etiqueta, ancho = 640 }) {
  const datos = etapas.filter((e) => Number.isFinite(e.valor));
  if (datos.length < 2) return '';
  const alto = 30;
  const gap = 12;
  const izq = 190; // columna de etiquetas
  const der = 150; // columna de cifras
  const area = ancho - izq - der;
  const centro = izq + area / 2;
  const max = Math.max(...datos.map((e) => e.valor)) || 1;
  // Raíz cuadrada para que las etapas de abajo (cientos de veces menores) sigan viéndose.
  const w = (v) => Math.max(6, Math.sqrt(v / max) * area);
  let cuerpo = '';
  datos.forEach((e, i) => {
    const y = i * (alto + gap);
    const ancho_ = w(e.valor);
    const ant = i > 0 ? datos[i - 1].valor : null;
    const pct = ant ? (e.valor / ant) * 100 : null;
    const nota = pct !== null ? ` (${decimal.format(pct)}% de la etapa anterior)` : '';
    cuerpo += `<text x="${izq - 12}" y="${y + alto / 2 + 4}" text-anchor="end" class="g-etiqueta">${esc(e.etiqueta)}</text>`;
    cuerpo += `<rect x="${centro - ancho_ / 2}" y="${y}" width="${ancho_}" height="${alto}" rx="4" fill="${ACTUAL}"><title>${esc(e.etiqueta)}: ${esc(entero.format(e.valor))}${esc(nota)}</title></rect>`;
    cuerpo += `<text x="${ancho - der + 12}" y="${y + (pct !== null ? alto / 2 - 1 : alto / 2 + 4)}" class="g-valor">${esc(fmt(e.valor))}</text>`;
    if (pct !== null) cuerpo += `<text x="${ancho - der + 12}" y="${y + alto / 2 + 12}" class="g-paso">${esc(decimal.format(pct))}% de la etapa anterior</text>`;
  });
  return svg(ancho, datos.length * (alto + gap) - gap, cuerpo, etiqueta);
}

module.exports = { barras, comparacion, columnas, lineaDiaria, embudo, fmt, diaCorto, mesCorto, ACTUAL, ANTERIOR };
