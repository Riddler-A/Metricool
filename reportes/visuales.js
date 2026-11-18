// Qué gráfica va en cada parte del reporte. Cada función devuelve HTML o '' si no
// hay datos suficientes (así nunca se imprime una gráfica vacía).

const calc = require('./calculos');
const g = require('./graficas');

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const n = (v) => calc.numero(v);
const par = (obj) => ({ actual: n(obj?.actual), anterior: n(obj?.anterior) });

function interacciones(int, periodo) {
  const vals = ['likes', 'comentarios', 'guardados', 'compartidos'].map((k) => n(int?.[k]?.[periodo]));
  return vals.every((v) => v === null) ? null : vals.reduce((s, v) => s + (v || 0), 0);
}

// ---------- Tarjetas de resumen (número grande + variación) ----------

function tarjeta(etiqueta, actual, anterior, formato) {
  if (actual === null || actual === undefined) return '';
  const v = calc.variacion(actual, anterior);
  const clase = v === null ? '' : v > 0 ? 'sube' : v < 0 ? 'baja' : '';
  const flecha = v === null ? '' : v > 0 ? '▲ ' : v < 0 ? '▼ ' : '';
  return `<div class="tarjeta-dato">
  <span class="td-etiqueta">${esc(etiqueta)}</span>
  <strong class="td-valor">${esc(calc.mostrar(actual, formato))}</strong>
  <span class="td-var ${clase}">${v === null ? 'sin comparación' : `${flecha}${esc(calc.mostrarVariacion(v))} vs. periodo anterior`}</span>
</div>`;
}

function tarjetasResumen(d) {
  const vis = d.embudo?.visibilidad || {};
  const int = d.embudo?.interaccion || {};
  const conv = d.embudo?.conversion || {};
  const mensajes = (p) => {
    const a = n(conv.dm?.[p]);
    const b = n(conv.whatsapp?.[p]);
    return a === null && b === null ? null : (a || 0) + (b || 0);
  };
  const html = [
    tarjeta('Alcance', n(vis.alcance?.actual), n(vis.alcance?.anterior), 'numero'),
    tarjeta('Interacciones', interacciones(int, 'actual'), interacciones(int, 'anterior'), 'numero'),
    tarjeta('Tasa de engagement', n(int.engagement?.actual), n(int.engagement?.anterior), 'porcentaje'),
    tarjeta('Seguidores nuevos', n(vis.nuevos?.actual), n(vis.nuevos?.anterior), 'numero'),
    tarjeta('Mensajes (DM + WhatsApp)', mensajes('actual'), mensajes('anterior'), 'numero'),
    tarjeta('Ventas o citas', n(conv.ventas?.actual), n(conv.ventas?.anterior), 'numero'),
  ].filter(Boolean);
  return html.length ? `<div class="tarjetas-datos">${html.join('')}</div>` : '';
}

// ---------- Embudo con los datos del periodo ----------

function graficaEmbudo(d) {
  const vis = d.embudo?.visibilidad || {};
  const int = d.embudo?.interaccion || {};
  const conv = d.embudo?.conversion || {};
  const dm = n(conv.dm?.actual);
  const wa = n(conv.whatsapp?.actual);
  const etapas = [
    { etiqueta: 'Nos vieron (alcance)', valor: n(vis.alcance?.actual) },
    { etiqueta: 'Interactuaron', valor: interacciones(int, 'actual') },
    { etiqueta: 'Visitaron el perfil', valor: n(vis.visitas?.actual) },
    { etiqueta: 'Dieron clic al link', valor: n(conv.clics?.actual) },
    { etiqueta: 'Nos escribieron', valor: dm === null && wa === null ? null : (dm || 0) + (wa || 0) },
    { etiqueta: 'Compraron o agendaron', valor: n(conv.ventas?.actual) },
  ].filter((e) => e.valor !== null);
  const svg = g.embudo({ etapas, etiqueta: 'Embudo del periodo: cuántas personas llegaron a cada etapa' });
  return svg ? `<h3>El embudo del periodo</h3>${svg}<p class="pie-grafica">Cada barra es una etapa; a la derecha, qué parte de la etapa anterior llegó hasta ahí.</p>` : '';
}

// ---------- Series diarias (vienen de "Traer datos de Postiz") ----------

function graficasDiarias(series) {
  const dias = series?.dias || [];
  if (!dias.length) return '';
  const marcas = new Set(dias.filter((x) => x.publicaciones > 0).map((x) => x.fecha));
  let html = '';
  const alcance = g.lineaDiaria({
    puntos: dias.map((x) => ({ fecha: x.fecha, valor: x.alcance })),
    marcas,
    etiqueta: 'Alcance de la cuenta por día',
  });
  if (alcance) html += `<h3>Alcance de la cuenta por día</h3>${alcance}`;
  if (dias.some((x) => x.nuevos)) {
    html += `<h3>Seguidores nuevos por día</h3>${g.columnas({
      puntos: dias.map((x) => ({ etiqueta: g.diaCorto(x.fecha), valor: x.nuevos })),
      etiqueta: 'Seguidores nuevos por día',
      alto: 150,
    })}`;
  }
  return html;
}

// ---------- Interacción: este periodo vs anterior ----------

function graficaInteraccion(d) {
  const int = d.embudo?.interaccion || {};
  const filas = [
    ['Likes', 'likes'],
    ['Comentarios', 'comentarios'],
    ['Guardados', 'guardados'],
    ['Compartidos', 'compartidos'],
  ].map(([etiqueta, k]) => ({ etiqueta, ...par(int[k]) }))
    .filter((f) => f.actual !== null || f.anterior !== null)
    .map((f) => ({ etiqueta: f.etiqueta, actual: f.actual ?? NaN, anterior: f.anterior ?? NaN }));
  const svg = g.comparacion({ filas, etiqueta: 'Interacciones: este periodo contra el anterior' });
  return svg ? `<h3>Interacciones: este periodo contra el anterior</h3>${svg}` : '';
}

// ---------- Ranking de publicaciones (como el de Metricool) ----------

function ranking(series) {
  const filas = series?.ranking || [];
  if (!filas.length) return '';
  const celda = (v, f) => `<td class="num">${v === null || v === undefined ? '—' : esc(calc.mostrar(v, f))}</td>`;
  const cuerpo = filas
    .map((p) => {
      const img = p.miniatura ? `<img src="${esc(p.miniatura)}" alt="" loading="lazy">` : '<span class="sin-miniatura"></span>';
      const texto = p.enlace && /^https?:\/\//.test(p.enlace) ? `<a href="${esc(p.enlace)}">${esc(p.texto || 'Ver publicación')}</a>` : esc(p.texto);
      return `<tr><td class="miniatura">${img}</td><td><span class="rk-meta">${esc(g.diaCorto(p.fecha))} · ${esc(p.red)} · ${esc(p.formato)}</span><br>${texto}</td>${celda(p.alcance, 'numero')}${celda(p.likes, 'numero')}${celda(p.comentarios, 'numero')}${celda(p.guardados, 'numero')}${celda(p.compartidos, 'numero')}${celda(p.engagement, 'porcentaje')}</tr>`;
    })
    .join('');
  return `<h3>Ranking de publicaciones del periodo</h3>
<p class="pie-grafica">Ordenadas por alcance${filas.length === 10 ? ' (las 10 primeras)' : ''}.</p>
<table class="ranking"><thead><tr><th></th><th>Publicación</th><th class="num">Alcance</th><th class="num">Me gusta</th><th class="num">Coment.</th><th class="num">Guard.</th><th class="num">Compart.</th><th class="num">Engag.</th></tr></thead><tbody>${cuerpo}</tbody></table>`;
}

// ---------- Formatos y redes ----------

function graficaFormatos(d) {
  const f = d.contenido?.formatos || {};
  const filas = [
    ['Reel / video', 'video'],
    ['Carrusel', 'carrusel'],
    ['Imagen estática', 'imagen'],
    ['Historias', 'historias'],
  ]
    .map(([etiqueta, k]) => ({
      etiqueta,
      valor: n(f[k]?.alcance),
      nota: n(f[k]?.engagement) !== null ? `· ${calc.mostrar(f[k].engagement, 'porcentaje')} engagement` : '',
    }))
    .filter((x) => x.valor !== null);
  if (filas.length < 2) return '';
  return `<h3>Alcance promedio por formato</h3>${g.barras({ filas, etiqueta: 'Alcance promedio por formato' })}`;
}

function graficaRedes(d) {
  const filas = (d.porRed?.filas || [])
    .map((r) => ({ etiqueta: r.red, valor: n(r.alcance), nota: n(r.engagement) !== null ? `· ${calc.mostrar(r.engagement, 'porcentaje')} engagement` : '' }))
    .filter((x) => x.etiqueta && x.valor !== null);
  if (filas.length < 2) return '';
  return `<h3>Alcance por red</h3>${g.barras({ filas, etiqueta: 'Alcance por red' })}`;
}

// ---------- Pauta: tarjetas como las de Meta Ads ----------

function tarjetasPauta(d) {
  const filas = (d.pauta?.campanas || []).filter((c) => c && Object.values(c).some((v) => String(v ?? '').trim()));
  if (!filas.length) return '';
  const { total } = calc.resumenPauta(filas);
  const t = (etiqueta, valor, formato) =>
    valor === null || valor === undefined
      ? ''
      : `<div class="tarjeta-dato"><span class="td-etiqueta">${esc(etiqueta)}</span><strong class="td-valor">${esc(calc.mostrar(valor, formato))}</strong></div>`;
  const html = [
    t('Inversión', total.inversion, 'dinero'),
    t('Impresiones', total.impresiones, 'numero'),
    t('Alcance', total.alcance, 'numero'),
    t('Clics', total.clics, 'numero'),
    t('Resultados', total.resultados, 'numero'),
    t('Costo por resultado', total.costo, 'dinero'),
    t('CPM', total.cpm, 'dinero'),
    t('CPC', total.cpc, 'dinero'),
    t('CTR', total.ctr, 'porcentaje'),
  ].filter(Boolean);
  return html.length ? `<div class="tarjetas-datos">${html.join('')}</div>` : '';
}

// ---------- Historial: reportes anteriores del mismo cliente ----------

function historial(reporte, otros) {
  const cliente = String(reporte.meta?.cliente || '').trim().toLowerCase();
  if (!cliente || !reporte.meta?.inicio) return '';
  const previos = (otros || [])
    .filter((r) => r.id !== reporte.id && String(r.meta?.cliente || '').trim().toLowerCase() === cliente && r.meta?.fin && r.meta.fin < reporte.meta.inicio)
    .sort((a, b) => a.meta.fin.localeCompare(b.meta.fin))
    .slice(-11);
  if (!previos.length) return '';
  const punto = (r) => {
    const d = calc.completarCalculados(r.datos || {});
    return {
      etiqueta: g.mesCorto(r.meta.inicio),
      alcance: n(d.embudo?.visibilidad?.alcance?.actual),
      engagement: n(d.embudo?.interaccion?.engagement?.actual),
    };
  };
  const puntos = [...previos, reporte].map(punto);
  let html = '';
  if (puntos.filter((p) => p.alcance !== null).length >= 2) {
    html += `<h3>Alcance de los últimos periodos</h3>${g.columnas({ puntos: puntos.map((p) => ({ etiqueta: p.etiqueta, valor: p.alcance })), etiqueta: 'Alcance por periodo', alto: 170, resaltarUltimo: true })}`;
  }
  if (puntos.filter((p) => p.engagement !== null).length >= 2) {
    html += `<h3>Tasa de engagement de los últimos periodos</h3>${g.columnas({ puntos: puntos.map((p) => ({ etiqueta: p.etiqueta, valor: p.engagement })), formato: 'porcentaje', etiqueta: 'Engagement por periodo', alto: 170, resaltarUltimo: true })}`;
  }
  return html ? `${html}<p class="pie-grafica">En terracota, este periodo; en gris, los anteriores (de los reportes guardados de este cliente).</p>` : '';
}

module.exports = {
  tarjetasResumen,
  graficaEmbudo,
  graficasDiarias,
  graficaInteraccion,
  ranking,
  graficaFormatos,
  graficaRedes,
  tarjetasPauta,
  historial,
};
