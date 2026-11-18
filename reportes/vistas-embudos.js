// Pantallas del diseñador de embudos: lista y editor.

const { pagina, encabezado, esc, fechaLarga, diaMexico } = require('./vistas');
const { FUENTES, PLANTILLAS } = require('./embudos');
const g = require('./graficas');

const R = '/reportes';

function opcionesFuente(elegida) {
  const grupos = {};
  for (const [clave, [etiqueta, grupo]] of Object.entries(FUENTES)) (grupos[grupo] ??= []).push([clave, etiqueta]);
  return Object.entries(grupos)
    .map(([grupo, ops]) => `<optgroup label="${esc(grupo)}">${ops.map(([k, e]) => `<option value="${k}"${k === elegida ? ' selected' : ''}>${esc(e)}</option>`).join('')}</optgroup>`)
    .join('');
}

// Vista previa con números de ejemplo: cada etapa conserva más o menos la mitad.
function vistaPrevia(embudo) {
  const etapas = (embudo.etapas || []).filter((e) => e.nombre);
  if (etapas.length < 2) return '<p class="nota">Agrega al menos dos etapas para ver la vista previa.</p>';
  let v = 10000;
  const datos = etapas.map((e, i) => {
    if (i > 0) v = Math.round(v * (i === 1 ? 0.12 : 0.45));
    return { etiqueta: e.nombre, valor: v };
  });
  return `${g.embudo({ etapas: datos, etiqueta: 'Vista previa del embudo' })}<p class="nota">Números de ejemplo, solo para ver la forma. En el reporte salen las cifras reales de cada periodo.</p>`;
}

function lista({ embudos, mensaje }) {
  const tarjetas = embudos.length
    ? embudos
        .map(
          (e) => `<li class="tarjeta">
  <div>
    <h3>${esc(e.cliente || 'Sin cliente')} · ${esc(e.nombre)}</h3>
    <p>${(e.etapas || []).map((x) => esc(x.nombre)).join(' → ')}</p>
  </div>
  <div class="acciones"><a class="boton secundario" href="${R}/embudos/${esc(e.id)}/editar">Editar</a></div>
</li>`
        )
        .join('')
    : '<li class="vacio">Todavía no hay embudos. Crea el de tu primer cliente.</li>';
  const plantillas = Object.entries(PLANTILLAS)
    .map(([k, p]) => `<option value="${k}">${esc(p.nombre)}</option>`)
    .join('');
  return pagina({
    titulo: 'Embudos',
    css: 'formulario.css',
    cuerpo: `${encabezado(`<a href="${R}/">Reportes</a> / Embudos`)}
<main class="contenedor">
  ${mensaje ? `<p class="aviso exito">${esc(mensaje)}</p>` : ''}
  <h1>Embudos de clientes</h1>
  <p class="nota">El embudo (o customer journey) son los pasos que da una persona desde que ve al negocio hasta que compra. Diseña uno por cliente y elígelo en su reporte: ahí se ve cuántas personas llegan a cada etapa y dónde se pierden.</p>
  <form method="post" action="${R}/embudos/nuevo" class="bloque">
    <h2>Crear embudo</h2>
    <div class="rejilla">
      <label class="campo"><span>Cliente</span><input type="text" name="cliente" required maxlength="80" placeholder="Nombre del negocio"></label>
      <label class="campo"><span>Empezar con</span><select name="plantilla">${plantillas}</select></label>
    </div>
    <button class="boton" type="submit">Crear embudo</button>
  </form>
  <ul class="lista">${tarjetas}</ul>
</main>`,
  });
}

function editor({ embudo, mensaje, usos }) {
  const fila = (e, i) => `<li class="etapa" data-etapa>
  <span class="etapa-num" aria-hidden="true">${i + 1}</span>
  <input type="hidden" name="etapas.${i}.id" value="${esc(e.id)}">
  <label class="campo"><span>Nombre de la etapa</span><input type="text" name="etapas.${i}.nombre" value="${esc(e.nombre)}" maxlength="60" placeholder="Ej. Agendaron cita"></label>
  <label class="campo"><span>De dónde sale el número</span><select name="etapas.${i}.fuente">${opcionesFuente(e.fuente)}</select></label>
  <label class="campo etapa-nota"><span>Qué cuenta (opcional)</span><input type="text" name="etapas.${i}.nota" value="${esc(e.nota)}" maxlength="140" placeholder="Ej. Citas confirmadas por WhatsApp"></label>
  <div class="etapa-acciones">
    <button type="button" class="boton terciario" data-subir aria-label="Subir etapa">↑</button>
    <button type="button" class="boton terciario" data-bajar aria-label="Bajar etapa">↓</button>
    <button type="button" class="boton terciario" data-quitar-etapa>Quitar</button>
  </div>
</li>`;
  return pagina({
    titulo: `Embudo de ${embudo.cliente || 'cliente'}`,
    css: 'formulario.css',
    cuerpo: `${encabezado(`<a href="${R}/">Reportes</a> / <a href="${R}/embudos/">Embudos</a> / ${esc(embudo.cliente || embudo.nombre)}`)}
<main class="contenedor">
  ${mensaje ? `<p class="aviso exito">${esc(mensaje)}</p>` : ''}
  <form method="post" action="${R}/embudos/${esc(embudo.id)}/guardar" id="formulario-embudo">
    <section class="bloque">
      <h2>Embudo</h2>
      <div class="rejilla">
        <label class="campo"><span>Cliente</span><input type="text" name="cliente" value="${esc(embudo.cliente)}" maxlength="80" required></label>
        <label class="campo"><span>Nombre del embudo</span><input type="text" name="nombre" value="${esc(embudo.nombre)}" maxlength="80"></label>
      </div>
      <p class="nota">Actualizado el ${esc(fechaLarga(diaMexico(embudo.actualizado || embudo.creado)))}${usos ? ` · lo usan ${usos} reporte${usos === 1 ? '' : 's'}` : ''}.</p>
    </section>

    <section class="bloque">
      <h2>Etapas, de arriba hacia abajo</h2>
      <p class="nota">La primera etapa es la más grande (normalmente "Nos vieron"). Si una etapa no sale de Postiz ni de la pauta, elige <strong>Se escribe a mano en cada reporte</strong> y en el reporte aparecerá una casilla para su número. Máximo 10 etapas.</p>
      <ol class="etapas" id="etapas">${(embudo.etapas || []).map(fila).join('')}</ol>
      <button type="button" class="boton secundario" data-agregar-etapa>Agregar etapa</button>
      <template id="plantilla-etapa">${fila({ id: '', nombre: '', fuente: 'manual', nota: '' }, 0)}</template>
    </section>

    <section class="bloque">
      <h2>Vista previa</h2>
      ${vistaPrevia(embudo)}
    </section>

    <div class="acciones-fijas">
      <a class="boton secundario" href="${R}/embudos/">Volver</a>
      <button class="boton" type="submit">Guardar embudo</button>
    </div>
  </form>
  <form method="post" action="${R}/embudos/${esc(embudo.id)}/borrar" class="zona-peligro" data-confirmar="¿Borrar este embudo? Los reportes que lo usan volverán al embudo general.">
    <button class="boton peligro" type="submit">Borrar embudo</button>
  </form>
</main>
<script src="${R}/estatico/embudo.js" defer></script>`,
  });
}

module.exports = { lista, editor };
