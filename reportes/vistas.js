// HTML de las tres pantallas: lista de reportes, formulario y reporte final.

const { SECCIONES, GLOSARIO, FORMULA_ENGAGEMENT } = require('./esquema');
const calc = require('./calculos');
const visuales = require('./visuales');

const R = '/reportes';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const vacio = (v) => v === undefined || v === null || String(v).trim() === '';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

// Fecha YYYY-MM-DD en hora de México (el servidor guarda en UTC).
function diaMexico(iso) {
  const d = new Date(iso || Date.now());
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

function rango(inicio, fin) {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inicio || '');
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fin || '');
  if (!a || !b) return [inicio, fin].filter(Boolean).join(' al ');
  if (a[1] === b[1] && a[2] === b[2]) return `${Number(a[3])} al ${Number(b[3])} de ${MESES[Number(a[2]) - 1]} de ${a[1]}`;
  if (a[1] === b[1]) return `${Number(a[3])} de ${MESES[Number(a[2]) - 1]} al ${fechaLarga(fin)}`;
  return `${fechaLarga(inicio)} al ${fechaLarga(fin)}`;
}

function pagina({ titulo, cuerpo, css, clase = '' }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(titulo)} · Prisma CN · Redes</title>
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="${R}/estatico/${css}">
</head>
<body class="${clase}">
${cuerpo}
</body>
</html>`;
}

function encabezado(subtitulo) {
  return `<header class="barra">
  <a class="marca" href="${R}/"><img src="/prisma-brand/simbolo-negro.png" alt="" width="28" height="29"><span>Prisma CN · Reportes</span></a>
  <nav><a href="${R}/">Reportes</a><a href="${R}/embudos/">Embudos</a><a href="/launches">Volver a Postiz</a></nav>
</header>${subtitulo ? `<p class="migas">${subtitulo}</p>` : ''}`;
}

// ---------- Lista ----------

function lista({ reportes, mensaje }) {
  const filas = reportes.length
    ? reportes
        .map(
          (r) => `<li class="tarjeta">
  <div>
    <h3>${esc(r.meta?.cliente || 'Sin cliente')}</h3>
    <p>${esc(rango(r.meta?.inicio, r.meta?.fin) || 'Sin periodo')} · actualizado ${esc(fechaLarga(diaMexico(r.actualizado)))}</p>
  </div>
  <div class="acciones">
    <a class="boton secundario" href="${R}/${esc(r.id)}/editar">Editar</a>
    <a class="boton secundario" href="${R}/${esc(r.id)}/ver">Ver reporte</a>
    <form method="post" action="${R}/${esc(r.id)}/duplicar"><button class="boton secundario" type="submit">Duplicar para el siguiente periodo</button></form>
  </div>
</li>`
        )
        .join('\n')
    : '<li class="vacio">Todavía no hay reportes. Crea el primero.</li>';

  return pagina({
    titulo: 'Reportes',
    css: 'formulario.css',
    cuerpo: `${encabezado()}
<main class="contenedor">
  ${mensaje ? `<p class="aviso">${esc(mensaje)}</p>` : ''}
  <div class="titular">
    <h1>Reportes de resultados</h1>
    <form method="post" action="${R}/nuevo"><button class="boton" type="submit">Crear reporte</button></form>
  </div>
  <p class="nota">Un reporte por cliente y por periodo. Los datos de las publicaciones se traen de Postiz; lo demás (conversión, pauta, comunidad, interpretación) se llena a mano.</p>
  <ul class="lista">${filas}</ul>
</main>`,
  });
}

// ---------- Formulario ----------

function campoForm(seccion, campo, datos) {
  const base = `datos.${seccion.clave}.${campo.clave}`;
  const valor = datos?.[seccion.clave]?.[campo.clave];
  const ayuda = campo.ayuda ? `<small>${esc(campo.ayuda)}</small>` : '';

  if (campo.tipo === 'texto') {
    return `<label class="campo"><span>${esc(campo.etiqueta)}</span>${ayuda}<input type="text" name="${base}" value="${esc(valor)}"></label>`;
  }
  if (campo.tipo === 'parrafo') {
    return `<label class="campo"><span>${esc(campo.etiqueta)}</span>${ayuda}<textarea name="${base}" rows="3">${esc(valor)}</textarea></label>`;
  }
  if (campo.tipo === 'metricas') {
    const cab = campo.columnas.map((c) => `<th>${esc(c.titulo)}</th>`).join('');
    const filas = campo.filas
      .map((f) => {
        const celdas = campo.columnas
          .map((c) => {
            const v = valor?.[f.clave]?.[c.clave];
            const tipo = (c.formato || f.formato) === 'texto' ? 'text' : 'text" inputmode="decimal';
            return `<td><input type="${tipo}" name="${base}.${f.clave}.${c.clave}" value="${esc(v)}" aria-label="${esc(f.etiqueta)}: ${esc(c.titulo)}"></td>`;
          })
          .join('');
        const marca = f.calculo === 'engagement' ? ' <em class="auto">se calcula solo</em>' : f.auto ? ' <em class="auto">Postiz</em>' : '';
        return `<tr><th scope="row">${esc(f.etiqueta)}${marca}</th>${celdas}</tr>`;
      })
      .join('');
    return `<div class="tabla-campo">${campo.titulo ? `<h4>${esc(campo.titulo)}</h4>` : ''}${ayuda}
<table><thead><tr><th>${esc(campo.primeraColumna || 'Métrica')}</th>${cab}</tr></thead><tbody>${filas}</tbody></table></div>`;
  }
  if (campo.tipo === 'tabla') {
    const filas = Array.isArray(valor) ? valor : [];
    const n = Math.max(campo.filasMin || 1, filas.length);
    const cab = campo.columnas
      .map((c) => `<th>${esc(c.titulo)}${c.auto ? ' <em class="auto">Postiz</em>' : ''}</th>`)
      .join('');
    const celda = (c, i) => {
      const nombre = `${base}.${i}.${c.clave}`;
      const v = filas[i]?.[c.clave];
      const etq = `${esc(c.titulo)} ${i + 1}`;
      if (c.formato === 'opciones') {
        const ops = ['', ...c.opciones].map((o) => `<option value="${esc(o)}"${o === v ? ' selected' : ''}>${esc(o || '—')}</option>`).join('');
        return `<td><select name="${nombre}" aria-label="${etq}">${ops}</select></td>`;
      }
      if (c.formato === 'imagen') {
        // La foto se reduce en el navegador y viaja como texto en imagenNueva; el servidor
        // la revisa, la guarda y deja aquí solo su nombre de archivo.
        const actual = /^[a-f0-9]{16}\.(jpg|png)$/.test(v || '') ? v : '';
        return `<td class="celda-imagen" data-imagen>
  <input type="hidden" name="${nombre}" value="${esc(actual)}">
  <input type="hidden" name="${base}.${i}.imagenNueva" value="">
  <img class="vista-previa" alt=""${actual ? ` src="${R}/imagenes/${esc(actual)}"` : ' hidden'}>
  <label class="boton terciario">Elegir foto<input type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="${etq}"></label>
  <button type="button" class="boton terciario" data-quitar-imagen${actual ? '' : ' hidden'}>Quitar</button>
</td>`;
      }
      return `<td><input type="${c.formato === 'enlace' ? 'url' : 'text'}" name="${nombre}" value="${esc(v)}" aria-label="${etq}"></td>`;
    };
    const fila = (i) => `<tr>${campo.columnas.map((c) => celda(c, i)).join('')}</tr>`;
    const cuerpo = Array.from({ length: n }, (_, i) => fila(i)).join('');
    const puedeAgregar = !campo.filasMax || n < campo.filasMax;
    const csv = campo.importarCsv
      ? `<details class="importar-csv">
  <summary>Importar campañas desde un archivo de Meta, TikTok o Google Ads</summary>
  <p class="nota">Exporta el reporte de campañas en CSV (Administrador de anuncios de Meta, TikTok Ads Manager o Google Ads → Campañas → Descargar → CSV). Se reconocen columnas en español e inglés. Las campañas de esa plataforma se reemplazan; las fotos que ya pusiste se conservan si el nombre de la campaña coincide.</p>
  <div class="rejilla">
    <label class="campo"><span>Plataforma</span><select name="csv.plataforma"><option>Meta</option><option>TikTok</option><option>Google Ads</option></select></label>
    <label class="campo"><span>Archivo CSV</span><input type="file" accept=".csv,text/csv" data-csv></label>
  </div>
  <input type="hidden" name="csv.contenido" value="">
  <button class="boton secundario" type="submit" name="accion" value="importarCsv">Importar campañas</button>
</details>`
      : '';
    return `<div class="tabla-campo">${campo.titulo ? `<h4>${esc(campo.titulo)}</h4>` : ''}${ayuda}
<table data-base="${base}"><thead><tr>${cab}</tr></thead><tbody>${cuerpo}</tbody></table>
${puedeAgregar ? '<button type="button" class="boton terciario" data-agregar-fila>Agregar fila</button>' : ''}${csv}</div>`;
  }
  return '';
}

function estadoSeries(series) {
  if (!series?.importado) return '<p class="nota">Las gráficas diarias y el ranking de publicaciones aparecen al usar "Traer datos de Postiz".</p>';
  const dias = (series.dias || []).filter((x) => x.alcance !== null || x.nuevos !== null).length;
  return `<p class="nota">Datos para gráficas traídos el ${esc(fechaLarga(diaMexico(series.importado)))}: ${dias} días con cifras y ${(series.ranking || []).length} publicaciones en el ranking. Se actualizan cada vez que traes datos.</p>`;
}

// Selector del embudo y casillas para las etapas que se escriben a mano.
function embudoEnFormulario(reporte, listaEmbudos, embudo) {
  const elegido = embudo?.id || '';
  const ops = ['<option value="">Embudo general (automático)</option>']
    .concat(listaEmbudos.map((e) => `<option value="${esc(e.id)}"${e.id === elegido ? ' selected' : ''}>${esc(e.cliente || 'Sin cliente')} · ${esc(e.nombre)}</option>`))
    .join('');
  let manuales = '';
  const etapasManuales = (embudo?.etapas || []).filter((e) => e.fuente === 'manual');
  if (etapasManuales.length) {
    const val = reporte.datos?.embudoEtapas || {};
    const celda = (e, p) => `<td><input type="text" inputmode="decimal" name="datos.embudoEtapas.${esc(e.id)}.${p}" value="${esc(val[e.id]?.[p])}" aria-label="${esc(e.nombre)}: ${p === 'actual' ? 'este periodo' : 'periodo anterior'}"></td>`;
    const filas = etapasManuales.map((e) => `<tr><th scope="row">${esc(e.nombre)}${e.nota ? `<small>${esc(e.nota)}</small>` : ''}</th>${celda(e, 'actual')}${celda(e, 'anterior')}</tr>`).join('');
    manuales = `<div class="tabla-campo"><h4>Etapas que se escriben a mano</h4><table><thead><tr><th>Etapa</th><th>Este periodo</th><th>Periodo anterior</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }
  const resumen = embudo ? `Etapas: ${embudo.etapas.map((e) => esc(e.nombre)).join(' → ')}. ` : 'El embudo general usa alcance, interacciones, visitas, clics, mensajes y ventas. ';
  return `<div class="embudo-elegido">
  <label class="campo"><span>Embudo de este reporte</span><select name="meta.embudo">${ops}</select></label>
  <p class="nota">${resumen}<a href="${R}/embudos/">Diseñar o editar embudos</a>. Si cambias de embudo, guarda para ver sus casillas.</p>
  ${manuales}
</div>`;
}

function formulario({ reporte, cuentas, errorCuentas, mensaje, embudos: listaEmbudos = [], embudo = null }) {
  const m = reporte.meta || {};
  const d = reporte.datos || {};
  const ant = calc.periodoAnterior(m.inicio, m.fin);
  const elegidas = new Set(m.cuentas || []);

  const listaCuentas = cuentas.length
    ? cuentas
        .map(
          (c) =>
            `<label class="opcion"><input type="checkbox" name="meta.cuentas" value="${esc(c.id)}"${elegidas.has(c.id) ? ' checked' : ''}> ${esc(c.nombre)} <small>${esc(c.red)}${c.cliente ? ` · ${esc(c.cliente)}` : ''}</small></label>`
        )
        .join('')
    : `<p class="nota">${esc(errorCuentas || 'Todavía no hay redes conectadas en Postiz. Puedes llenar el reporte a mano.')}</p>`;

  const secciones = SECCIONES.map(
    (s) => `<section class="bloque" id="s-${s.clave}">
  <h2>${esc(s.titulo)}${s.opcional ? ' <span class="etiqueta">opcional</span>' : ''}</h2>
  ${s.ayuda ? `<p class="nota">${esc(s.ayuda)}</p>` : ''}
  ${s.intro ? `<p class="nota">${esc(s.intro)}</p>` : ''}
  ${s.clave === 'embudo' ? embudoEnFormulario(reporte, listaEmbudos, embudo) : ''}
  ${s.campos.map((c) => campoForm(s, c, d)).join('\n')}
</section>`
  ).join('\n');

  const avisos = (reporte.avisos || []).length
    ? `<div class="aviso"><strong>Al traer los datos de Postiz:</strong><ul>${reporte.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>`
    : '';

  return pagina({
    titulo: m.cliente ? `Reporte de ${m.cliente}` : 'Reporte nuevo',
    css: 'formulario.css',
    cuerpo: `${encabezado(`<a href="${R}/">Reportes</a> / ${esc(m.cliente || 'Reporte nuevo')}`)}
<main class="contenedor">
<form method="post" action="${R}/${esc(reporte.id)}/guardar" id="formulario">
  ${mensaje ? `<p class="aviso exito">${esc(mensaje)}</p>` : ''}
  ${avisos}

  <details class="bloque interno">
    <summary>Uso interno: cómo llenar el reporte</summary>
    <ol>
      <li>Un reporte por cliente y por periodo. Para el mes siguiente usa <strong>Duplicar</strong> en la lista.</li>
      <li>Lo marcado como <em class="auto">Postiz</em> se llena con <strong>Traer datos de Postiz</strong>; puedes corregirlo a mano.</li>
      <li>Las secciones opcionales o vacías <strong>no aparecen</strong> en el reporte. Nunca se entrega una sección vacía.</li>
      <li>Cada tabla lleva su <strong>Qué significa</strong>. Sin interpretación, el dato no se entrega: la vista previa te avisa cuáles faltan.</li>
      <li>Que quien dirige el negocio entienda el resumen ejecutivo en 2 minutos.</li>
      <li>Antes del primer reporte de cada cliente: confirmar que hay forma de medir conversión (link con UTM, link de WhatsApp con mensaje prellenado y acuerdo para reportar leads o ventas).</li>
    </ol>
    <table>
      <thead><tr><th>Dato</th><th>Quién lo obtiene</th><th>De dónde sale</th></tr></thead>
      <tbody>
        <tr><td>Alcance, impresiones, likes, comentarios, guardados, compartidos, mejores publicaciones</td><td>Automático</td><td>Postiz (botón "Traer datos de Postiz")</td></tr>
        <tr><td>Visitas al perfil, clics al link, seguidores totales</td><td>Alexis → a mano</td><td>Meta Business Suite / estadísticas de cada red</td></tr>
        <tr><td>Mensajes recibidos y tiempo de respuesta</td><td>Alexis → a mano</td><td>Bandeja de Meta Business Suite / WhatsApp Business</td></tr>
        <tr><td>Inversión y resultados de pauta</td><td>Alexis → a mano</td><td>Administrador de anuncios</td></tr>
        <tr><td>Leads, citas o ventas que llegaron por redes</td><td>Cliente → Alexis</td><td>Registro del cliente (se pide cada cierre de mes)</td></tr>
        <tr><td>Objetivos y metas del periodo</td><td>Alexis</td><td>Propuesta o plan acordado con el cliente</td></tr>
      </tbody>
    </table>
  </details>

  <section class="bloque" id="s-portada">
    <h2>Portada</h2>
    <div class="rejilla">
      <label class="campo"><span>Cliente</span><input type="text" name="meta.cliente" value="${esc(m.cliente)}" required></label>
      <label class="campo"><span>Redes incluidas</span><input type="text" name="meta.redes" value="${esc(m.redes)}" placeholder="Instagram / Facebook / TikTok"></label>
      <label class="campo"><span>Inicio del periodo</span><input type="date" name="meta.inicio" value="${esc(m.inicio)}" required></label>
      <label class="campo"><span>Fin del periodo</span><input type="date" name="meta.fin" value="${esc(m.fin)}" required></label>
      <label class="campo"><span>Fecha de entrega</span><input type="date" name="meta.entrega" value="${esc(m.entrega)}"></label>
      <div class="campo"><span>Periodo de comparación</span><p class="calculado">${ant ? esc(rango(ant.inicio, ant.fin)) : 'Se calcula al poner las fechas'}</p></div>
    </div>
    ${estadoSeries(reporte.series)}
    <fieldset class="campo">
      <legend>Cuentas de Postiz que entran en el reporte</legend>
      <div class="opciones">${listaCuentas}</div>
    </fieldset>
  </section>

  ${secciones}

  <div class="acciones-fijas">
    <button class="boton secundario" type="submit" name="accion" value="importar">Traer datos de Postiz</button>
    <button class="boton secundario" type="submit" name="accion" value="guardar">Guardar</button>
    <button class="boton" type="submit" name="accion" value="ver">Guardar y ver reporte</button>
  </div>
</form>
<form method="post" action="${R}/${esc(reporte.id)}/borrar" class="zona-peligro" data-confirmar="¿Borrar este reporte? Se mueve a la papelera del servidor.">
  <button class="boton peligro" type="submit">Borrar reporte</button>
</form>
</main>
<script src="${R}/estatico/formulario.js" defer></script>`,
  });
}

// ---------- Reporte final ----------

function variacionCelda(a, b) {
  const v = calc.variacion(a, b);
  if (v === null) return '<td class="num tenue">—</td>';
  const flecha = v > 0 ? '▲' : v < 0 ? '▼' : '';
  return `<td class="num ${v > 0 ? 'sube' : v < 0 ? 'baja' : ''}">${flecha} ${esc(calc.mostrarVariacion(v))}</td>`;
}

function tablaMetricas(campo, valor) {
  const filas = campo.filas.filter((f) => campo.columnas.some((c) => !vacio(valor?.[f.clave]?.[c.clave])));
  if (!filas.length) return '';
  const conVar = !campo.sinVariacion && campo.columnas.length === 2;
  const cab = campo.columnas.map((c) => `<th class="num">${esc(c.titulo)}</th>`).join('') + (conVar ? '<th class="num">Variación</th>' : '');
  const cuerpo = filas
    .map((f) => {
      const celdas = campo.columnas
        .map((c) => `<td class="num">${esc(calc.mostrar(valor[f.clave]?.[c.clave], c.formato === 'texto' ? 'texto' : f.formato || c.formato))}</td>`)
        .join('');
      const v = conVar ? variacionCelda(valor[f.clave]?.actual, valor[f.clave]?.anterior) : '';
      return `<tr><th scope="row">${esc(f.etiqueta)}</th>${celdas}${v}</tr>`;
    })
    .join('');
  return `${campo.titulo ? `<h3>${esc(campo.titulo)}</h3>` : ''}<table><thead><tr><th>${esc(campo.primeraColumna || 'Métrica')}</th>${cab}</tr></thead><tbody>${cuerpo}</tbody></table>`;
}

function filasConDatos(valor) {
  return (Array.isArray(valor) ? valor : []).filter((f) => f && Object.values(f).some((v) => !vacio(v)));
}

function tablaLibre(campo, valor) {
  const filas = filasConDatos(valor);
  if (!filas.length) return '';

  if (campo.especial === 'kpis') {
    const cuerpo = filas
      .map((f) => {
        const estado = calc.estadoKpi(f.actual, f.meta);
        return `<tr><th scope="row">${esc(f.kpi)}</th><td class="num">${esc(calc.mostrar(f.actual, 'numero'))}</td><td class="num">${esc(calc.mostrar(f.anterior, 'numero'))}</td>${variacionCelda(f.actual, f.anterior)}<td class="num">${esc(calc.mostrar(f.meta, 'numero'))}</td><td>${estado ? `<span class="estado ${estado === 'Cumplida' ? 'ok' : 'no'}">${estado}</span>` : ''}</td></tr>`;
      })
      .join('');
    return `<table class="kpis"><thead><tr><th>KPI</th><th class="num">Este periodo</th><th class="num">Periodo anterior</th><th class="num">Variación</th><th class="num">Meta</th><th>Estado</th></tr></thead><tbody>${cuerpo}</tbody></table>`;
  }

  if (campo.especial === 'pauta') return visuales.campanasPauta(filas);

  const columnas = campo.columnas.filter((c) => c.clave !== 'enlace');
  const enlace = campo.columnas.some((c) => c.clave === 'enlace');
  const cab = (campo.numerada ? '<th>#</th>' : '') + columnas.map((c) => `<th${c.formato !== 'texto' ? ' class="num"' : ''}>${esc(c.titulo)}</th>`).join('');
  const cuerpo = filas
    .map((f, i) => {
      const celdas = columnas
        .map((c, j) => {
          let contenido = esc(calc.mostrar(f[c.clave], c.formato));
          if (j === 0 && enlace && /^https?:\/\//.test(f.enlace || '')) {
            contenido = `<a href="${esc(f.enlace)}">${contenido || 'Ver publicación'}</a>`;
          }
          return `<td${c.formato !== 'texto' ? ' class="num"' : ''}>${contenido}</td>`;
        })
        .join('');
      return `<tr>${campo.numerada ? `<td>${i + 1}</td>` : ''}${celdas}</tr>`;
    })
    .join('');
  return `${campo.titulo ? `<h3>${esc(campo.titulo)}</h3>` : ''}<table><thead><tr>${cab}</tr></thead><tbody>${cuerpo}</tbody></table>`;
}

function parrafo(texto, etiqueta, clase = '') {
  if (vacio(texto)) return '';
  const html = esc(texto).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  return etiqueta
    ? `<p class="${clase}"><strong>${esc(etiqueta)}:</strong> ${html}</p>`
    : `<p class="${clase}">${html}</p>`;
}

// Cómo se imprime cada sección. Si una sección no tiene nada, no se imprime.
// Gráficas que se intercalan en el reporte, antes o después de ciertos campos.
// Cada gráfica va con su título en un bloque que no se parte entre páginas.
const bloque = (html) => (html ? `<div class="bloque-grafica">${html}</div>` : '');

function graficasAntes(clave, d) {
  if (clave === 'pauta.campanas') return bloque(visuales.tarjetasPauta(d));
  return '';
}

function graficasDespues(clave, d, extra) {
  const html = graficaDe(clave, d, extra);
  // El embudo del cliente ya trae sus propios bloques (gráfica aparte de la tabla).
  return clave === 'embudo.frase' && extra.embudo ? html : bloque(html);
}

function graficaDe(clave, d, extra) {
  switch (clave) {
    case 'resumen.frase': return visuales.tarjetasResumen(d);
    case 'resumen.alerta': return visuales.historial(extra.reporte, extra.otros);
    case 'embudo.frase': return extra.embudo ? visuales.embudoCliente(extra.embudo, d) : visuales.graficaEmbudo(d);
    case 'embudo.visibilidad': return visuales.graficasDiarias(extra.reporte.series);
    case 'embudo.interaccion': return visuales.graficaInteraccion(d);
    case 'porRed.filas': return visuales.graficaRedes(d);
    case 'contenido.frase': return visuales.ranking(extra.reporte.series);
    case 'contenido.formatos': return visuales.graficaFormatos(d);
    default: return '';
  }
}

function seccionReporte(s, d, extra = { reporte: {} }) {
  const v = d[s.clave] || {};
  let html = '';
  for (const c of s.campos) {
    const val = v[c.clave];
    html += graficasAntes(`${s.clave}.${c.clave}`, d);
    if (c.tipo === 'metricas') html += tablaMetricas(c, val);
    else if (c.tipo === 'tabla') html += tablaLibre(c, val);
    else if (c.tipo === 'parrafo' || c.tipo === 'texto') {
      if (s.clave === 'comunidad') continue; // se arma abajo como lista
      const esQue = /que$/i.test(c.clave) && c.clave !== 'frase';
      const esFrase = c.clave === 'frase';
      const etiqueta = esQue ? 'Qué significa' : esFrase ? '' : c.etiqueta;
      html += parrafo(val, etiqueta, esQue ? 'interpretacion' : esFrase ? 'entrada' : '');
    }
    html += graficasDespues(`${s.clave}.${c.clave}`, d, extra);
  }
  if (s.clave === 'comunidad') {
    const li = [];
    if (!vacio(v.positivo)) li.push(`<li><strong>Comentario positivo destacado:</strong> ${esc(v.positivo)}</li>`);
    if (!vacio(v.negativo)) li.push(`<li><strong>Comentario negativo o queja destacada:</strong> ${esc(v.negativo)}${!vacio(v.atendio) ? ` → <strong>Cómo se atendió:</strong> ${esc(v.atendio)}` : ''}</li>`);
    if (!vacio(v.pregunta)) li.push(`<li><strong>Pregunta que se repite:</strong> ${esc(v.pregunta)}${!vacio(v.oportunidad) ? ` → <strong>Oportunidad de contenido:</strong> ${esc(v.oportunidad)}` : ''}</li>`);
    if (li.length) html += `<h3>Lo que dijo tu comunidad</h3><ul class="comunidad">${li.join('')}</ul>`;
  }
  if (s.clave === 'metodologia') {
    const li = [];
    if (!vacio(v.fuentes)) li.push(`<li><strong>Fuente de los datos:</strong> ${esc(v.fuentes)}</li>`);
    if (!vacio(v.fecha)) li.push(`<li><strong>Fecha de extracción:</strong> ${esc(v.fecha)}</li>`);
    li.push(`<li>${esc(FORMULA_ENGAGEMENT)}</li>`);
    if (!vacio(v.notas)) li.push(`<li><strong>Notas:</strong> ${esc(v.notas)}</li>`);
    html = `<ul>${li.join('')}</ul>`;
  }
  if (!html) return '';
  return `<section class="seccion" id="r-${s.clave}"><h2>${esc(s.titulo)}</h2>${s.intro ? `<p>${esc(s.intro)}</p>` : ''}${html}</section>`;
}

// Revisión para el equipo (no se imprime): lo que falta antes de entregar.
function pendientes(d) {
  const p = [];
  for (const s of SECCIONES) {
    if (s.anexo) continue;
    const v = d[s.clave] || {};
    const tieneDatos = s.campos.some((c) => {
      const val = v[c.clave];
      if (c.tipo === 'metricas') return val && Object.values(val).some((f) => f && Object.values(f).some((x) => !vacio(x)));
      if (c.tipo === 'tabla') return filasConDatos(val).length > 0;
      return false;
    });
    if (!tieneDatos) {
      if (!s.opcional && !s.campos.some((c) => !vacio(v[c.clave]) && typeof v[c.clave] === 'string'))
        p.push(`${s.titulo}: está vacía, así que no aparece en el reporte.`);
      continue;
    }
    const ques = s.campos.filter((c) => c.tipo === 'parrafo' && /que$/i.test(c.clave) && c.clave !== 'frase');
    for (const q of ques) if (vacio(v[q.clave])) p.push(`${s.titulo}: falta "${q.etiqueta}".`);
  }
  if (vacio(d.resumen?.frase)) p.push('Resumen ejecutivo: falta la conclusión del mes.');
  return p;
}

function reporte({ reporte, otros = [], embudo = null }) {
  const m = reporte.meta || {};
  const d = calc.completarCalculados(reporte.datos || {});
  const ant = calc.periodoAnterior(m.inicio, m.fin);
  const falta = pendientes(d);

  const portada = `<section class="portada">
  <div class="portada-marca"><img src="/prisma-brand/simbolo-dorado.png" alt="Prisma CN" width="64" height="66"><span>PRISMA CN</span></div>
  <div class="portada-titulo">
    <p class="sobretitulo">Reporte de resultados de redes sociales</p>
    <h1>${esc(m.cliente || 'Cliente')}</h1>
    <p class="periodo">${esc(rango(m.inicio, m.fin))}</p>
  </div>
  <dl class="portada-datos">
    ${ant ? `<div><dt>Periodo de comparación</dt><dd>${esc(rango(ant.inicio, ant.fin))}</dd></div>` : ''}
    ${!vacio(m.redes) ? `<div><dt>Redes incluidas</dt><dd>${esc(m.redes)}</dd></div>` : ''}
    ${!vacio(m.entrega) ? `<div><dt>Fecha de entrega</dt><dd>${esc(fechaLarga(m.entrega))}</dd></div>` : ''}
    <div><dt>Preparado por</dt><dd>Prisma CN, Consultoría de Negocios</dd></div>
  </dl>
</section>`;

  const cuerpo = SECCIONES.filter((s) => !s.anexo).map((s) => seccionReporte(s, d, { reporte, otros, embudo })).join('\n');
  const glosario = `<section class="seccion anexo"><h2>Anexo</h2><h3>Glosario</h3><table><thead><tr><th>Métrica</th><th>Qué mide, en palabras simples</th></tr></thead><tbody>${GLOSARIO.map(([a, b]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table>
${seccionReporte(SECCIONES.find((s) => s.anexo), d).replace('<section class="seccion"', '<div class="sub"').replace(/<\/section>$/, '</div>').replace('<h2>', '<h3>').replace('</h2>', '</h3>')}</section>`;

  return pagina({
    titulo: `Reporte ${m.cliente || ''} ${rango(m.inicio, m.fin)}`.trim(),
    css: 'reporte.css',
    cuerpo: `<div class="herramientas no-imprimir">
  <a class="boton secundario" href="${R}/${esc(reporte.id)}/editar">Volver a editar</a>
  <button class="boton" type="button" data-imprimir>Descargar PDF</button>
  <p>En la ventana de impresión elige <strong>Guardar como PDF</strong> y activa <strong>Gráficos de fondo</strong>.</p>
  ${falta.length ? `<div class="revision"><strong>Antes de entregar (${falta.length}):</strong><ul>${falta.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : '<div class="revision ok">Listo para entregar: no falta ninguna interpretación.</div>'}
</div>
<main class="documento">
${portada}
${cuerpo}
${glosario}
<footer class="cierre"><img src="/prisma-brand/simbolo-negro.png" alt="" width="24" height="25"><span>Prisma CN, Consultoría de Negocios · estrategias@alexisconsultor.com · WhatsApp +52 33 2846 7395</span></footer>
</main>
<script src="${R}/estatico/reporte.js" defer></script>`,
  });
}

function error({ titulo, mensaje, estado = 400 }) {
  return pagina({
    titulo,
    css: 'formulario.css',
    cuerpo: `${encabezado()}<main class="contenedor"><h1>${esc(titulo)}</h1><p>${esc(mensaje)}</p><p><a class="boton secundario" href="${R}/">Volver a los reportes</a></p></main>`,
  });
}

module.exports = { lista, formulario, reporte, error, pendientes, diaMexico, pagina, encabezado, esc, fechaLarga };
