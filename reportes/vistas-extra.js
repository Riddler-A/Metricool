// Pantallas de enlaces rastreables, registro de clientes y la página pública del cliente.

const { pagina, encabezado, esc, fechaLarga, diaMexico } = require('./vistas');
const enlaces = require('./enlaces');
const calc = require('./calculos');

const R = '/reportes';

function sumarDias(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

function listaClientes(nombres) {
  return `<datalist id="clientes-conocidos">${[...new Set(nombres.filter(Boolean))].sort().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
}

function botonCopiar(texto) {
  return `<button type="button" class="boton terciario" data-copiar="${esc(texto)}">Copiar</button>`;
}

// ---------- Enlaces rastreables ----------

function listaEnlaces({ lista, base, clientes, mensaje, error }) {
  const hoy = enlaces.diaMexico();
  const hace30 = sumarDias(hoy, -29);
  const filas = lista.length
    ? lista
        .map((e) => {
          const corto = `${base}/r/${e.slug}`;
          const destinoCorto = e.tipo === 'whatsapp' ? `WhatsApp ${esc(e.numero || '')}` : esc(e.destino.replace(/^https?:\/\//, '').slice(0, 50));
          return `<tr${e.pausado ? ' class="pausado"' : ''}>
  <td><strong>${esc(e.nombre)}</strong><br><small>${esc(e.cliente || 'Sin cliente')}${e.canal ? ` · ${esc(e.canal)}` : ''}${e.pausado ? ' · <em>pausado</em>' : ''}</small></td>
  <td><code>${esc(corto)}</code> ${botonCopiar(corto)}<br><small>→ ${destinoCorto}</small></td>
  <td class="num">${esc(calc.mostrar(enlaces.clicsEntre(e, hace30, hoy), 'numero'))}<br><small>${esc(calc.mostrar(enlaces.clicsEntre(e, hace30, hoy, 'unicos'), 'numero'))} personas</small></td>
  <td class="num">${esc(calc.mostrar(enlaces.totalClics(e), 'numero'))}</td>
  <td><form method="post" action="${R}/enlaces/${esc(e.slug)}/${e.pausado ? 'reanudar' : 'pausar'}"><button class="boton terciario" type="submit">${e.pausado ? 'Reanudar' : 'Pausar'}</button></form>
      <form method="post" action="${R}/enlaces/${esc(e.slug)}/borrar" data-confirmar="¿Borrar este enlace? Quien lo tenga ya no llegará a ningún lado."><button class="boton terciario" type="submit">Borrar</button></form></td>
</tr>`;
        })
        .join('')
    : '<tr><td colspan="5" class="vacio">Todavía no hay enlaces. Crea el primero arriba.</td></tr>';

  return pagina({
    titulo: 'Enlaces rastreables',
    css: 'formulario.css',
    cuerpo: `${encabezado(`<a href="${R}/">Reportes</a> / Enlaces`)}
<main class="contenedor">
  ${mensaje ? `<p class="aviso exito">${esc(mensaje)}</p>` : ''}
  ${error ? `<p class="aviso">${esc(error)}</p>` : ''}
  <h1>Enlaces rastreables</h1>
  <p class="nota">En lugar de poner el link directo en la biografía, en una publicación o en un anuncio, pon el enlace corto. Cada clic se cuenta y la persona llega a su destino igual. No se guarda nada de quien da clic. Usa un enlace distinto por red (Instagram, TikTok, anuncio…) para saber de dónde viene cada clic.</p>
  <form method="post" action="${R}/enlaces/nuevo" class="bloque" id="nuevo-enlace">
    <h2>Crear enlace</h2>
    <div class="rejilla">
      <label class="campo"><span>Cliente</span><input type="text" name="cliente" list="clientes-conocidos" required maxlength="80"></label>
      <label class="campo"><span>Nombre (para ti)</span><input type="text" name="nombre" required maxlength="60" placeholder="Ej. Menú en la biografía"></label>
      <label class="campo"><span>Dónde lo vas a poner (opcional)</span><input type="text" name="canal" maxlength="40" placeholder="Ej. Instagram bio, anuncio Meta"></label>
      <label class="campo"><span>Nombre del enlace corto (opcional)</span><input type="text" name="slug" maxlength="40" pattern="[a-z0-9-]+" placeholder="se arma solo: cafe-norte-menu"><small>Solo minúsculas, números y guiones.</small></label>
    </div>
    <fieldset class="campo">
      <legend>A dónde lleva</legend>
      <label class="opcion"><input type="radio" name="tipo" value="web" checked data-tipo> Una página (sitio, menú, tienda, formulario)</label>
      <label class="opcion"><input type="radio" name="tipo" value="whatsapp" data-tipo> Un chat de WhatsApp con mensaje ya escrito</label>
    </fieldset>
    <div data-para="web"><label class="campo"><span>Dirección de la página</span><input type="url" name="destino" placeholder="https://..."></label></div>
    <div data-para="whatsapp" hidden class="rejilla">
      <label class="campo"><span>Número de WhatsApp</span><input type="tel" name="numero" placeholder="33 1234 5678"><small>Con 10 dígitos se agrega +52 solo.</small></label>
      <label class="campo"><span>Mensaje que ya va escrito</span><input type="text" name="mensaje" maxlength="500" placeholder="Hola, vi su publicación y quiero informes"></label>
    </div>
    <button class="boton" type="submit">Crear enlace</button>
  </form>
  <div class="tabla-campo">
  <table class="tabla-enlaces"><thead><tr><th>Enlace</th><th>Enlace corto y destino</th><th class="num">Clics (30 días)</th><th class="num">Total</th><th></th></tr></thead><tbody>${filas}</tbody></table>
  </div>
  ${listaClientes(clientes)}
</main>
<script src="${R}/estatico/extra.js" defer></script>`,
  });
}

// ---------- Registro de clientes (lado del equipo) ----------

function listaRegistros({ lista, base, clientes, mensaje }) {
  const tarjetas = lista.length
    ? lista
        .map((c) => {
          const ultimo = (c.registros || []).at(-1);
          return `<li class="tarjeta">
  <div><h3>${esc(c.cliente)}</h3><p>${(c.registros || []).length} registros${ultimo ? ` · el último del ${esc(fechaLarga(ultimo.desde))} al ${esc(fechaLarga(ultimo.hasta))}` : ' · todavía sin registros'}</p></div>
  <div class="acciones"><a class="boton secundario" href="${R}/clientes/${esc(c.id)}">Ver y compartir</a></div>
</li>`;
        })
        .join('')
    : '<li class="vacio">Todavía no hay registros de clientes.</li>';
  return pagina({
    titulo: 'Registro de clientes',
    css: 'formulario.css',
    cuerpo: `${encabezado(`<a href="${R}/">Reportes</a> / Registro de clientes`)}
<main class="contenedor">
  ${mensaje ? `<p class="aviso exito">${esc(mensaje)}</p>` : ''}
  <h1>Registro de clientes</h1>
  <p class="nota">Cada cliente recibe un enlace privado (sin usuario ni contraseña) donde escribe cuántas citas, ventas o reservas llegaron por redes. Lo que escribe entra solo a su reporte y a su embudo al usar "Traer datos".</p>
  <form method="post" action="${R}/clientes/nuevo" class="bloque">
    <h2>Crear registro para un cliente</h2>
    <label class="campo"><span>Cliente (igual que en sus reportes)</span><input type="text" name="cliente" list="clientes-conocidos" required maxlength="80"></label>
    <button class="boton" type="submit">Crear</button>
  </form>
  <ul class="lista">${tarjetas}</ul>
  ${listaClientes(clientes)}
</main>
<script src="${R}/estatico/extra.js" defer></script>`,
  });
}

function detalleRegistro({ cliente, base, campos, mensaje }) {
  const enlace = `${base}/c/${cliente.llave}`;
  const nombreCampo = Object.fromEntries(campos.map((c) => [c.id, c.nombre]));
  const filas = [...(cliente.registros || [])]
    .reverse()
    .map(
      (r) => `<tr><td>${esc(fechaLarga(r.desde))} al ${esc(fechaLarga(r.hasta))}<br><small>enviado el ${esc(fechaLarga(diaMexico(r.creado)))}</small></td>
<td>${Object.entries(r.valores || {}).map(([k, v]) => `${esc(nombreCampo[k] || 'Dato de una etapa que ya no existe')}: <strong>${esc(calc.mostrar(v, 'numero'))}</strong>`).join('<br>')}${r.nota ? `<br><small>“${esc(r.nota)}”</small>` : ''}</td>
<td><form method="post" action="${R}/clientes/${esc(cliente.id)}/quitar" data-confirmar="¿Quitar este registro?"><input type="hidden" name="registro" value="${esc(r.id)}"><button class="boton terciario" type="submit">Quitar</button></form></td></tr>`
    )
    .join('');
  const mensajeWa = `Hola, te comparto el enlace para que nos digas cada semana cuántas personas llegaron por redes: ${enlace}`;
  return pagina({
    titulo: `Registro de ${cliente.cliente}`,
    css: 'formulario.css',
    cuerpo: `${encabezado(`<a href="${R}/">Reportes</a> / <a href="${R}/clientes/">Registro de clientes</a> / ${esc(cliente.cliente)}`)}
<main class="contenedor">
  ${mensaje ? `<p class="aviso exito">${esc(mensaje)}</p>` : ''}
  <h1>${esc(cliente.cliente)}</h1>
  <section class="bloque">
    <h2>Enlace para el cliente</h2>
    <p><code class="enlace-grande">${esc(enlace)}</code></p>
    <p>${botonCopiar(enlace)} <button type="button" class="boton terciario" data-copiar="${esc(mensajeWa)}">Copiar mensaje para WhatsApp</button> <a class="boton terciario" href="${esc(enlace)}" target="_blank" rel="noopener">Ver como el cliente</a></p>
    <p class="nota">Quien tenga este enlace puede escribir registros, así que compártelo solo con el cliente. Si se comparte por error, cámbialo: el anterior deja de funcionar.</p>
    <p class="nota">Qué se le pregunta: ${campos.map((c) => esc(c.nombre)).join(' · ')}. Las etapas "a mano" de su embudo se agregan solas.</p>
    <form method="post" action="${R}/clientes/${esc(cliente.id)}/llave" data-confirmar="¿Cambiar el enlace? El anterior dejará de funcionar y tendrás que mandarle el nuevo."><button class="boton secundario" type="submit">Cambiar enlace</button></form>
  </section>
  <section class="bloque">
    <h2>Lo que ha registrado</h2>
    ${filas ? `<table><thead><tr><th>Periodo</th><th>Datos</th><th></th></tr></thead><tbody>${filas}</tbody></table>` : '<p class="nota">Todavía no ha registrado nada.</p>'}
  </section>
  <form method="post" action="${R}/clientes/${esc(cliente.id)}/borrar" class="zona-peligro" data-confirmar="¿Borrar el registro de este cliente? Su enlace dejará de funcionar."><button class="boton peligro" type="submit">Borrar registro del cliente</button></form>
</main>
<script src="${R}/estatico/extra.js" defer></script>`,
  });
}

// ---------- Página pública del cliente ----------

// Semana anterior completa (lunes a domingo), en hora de México.
function semanaPasada() {
  const hoy = enlaces.diaMexico();
  const dow = new Date(`${hoy}T12:00:00Z`).getUTCDay() || 7; // lunes = 1 … domingo = 7
  const lunes = sumarDias(hoy, -(dow - 1) - 7);
  return { desde: lunes, hasta: sumarDias(lunes, 6) };
}

function paginaCliente({ cliente, campos, mensaje, error, valores = {} }) {
  const s = semanaPasada();
  const recientes = [...(cliente.registros || [])].slice(-5).reverse();
  const nombreCampo = Object.fromEntries(campos.map((c) => [c.id, c.nombre]));
  return pagina({
    titulo: `Registro de resultados · ${cliente.cliente}`,
    css: 'formulario.css',
    clase: 'publica',
    cuerpo: `<header class="barra"><span class="marca"><img src="/prisma-brand/simbolo-negro.png" alt="" width="28" height="29"><span>Prisma CN</span></span></header>
<main class="contenedor angosto">
  ${mensaje ? `<p class="aviso exito">${esc(mensaje)}</p>` : ''}
  ${error ? `<p class="aviso">${esc(error)}</p>` : ''}
  <h1>Hola, ${esc(cliente.cliente)}</h1>
  <p>Cuéntanos cuántas personas llegaron por redes sociales. Con estos números medimos lo que de verdad le importa a tu negocio, no solo los likes. Te toma un minuto.</p>
  <form method="post" class="bloque">
    <div class="rejilla">
      <label class="campo"><span>Desde</span><input type="date" name="desde" value="${esc(valores.desde || s.desde)}" required></label>
      <label class="campo"><span>Hasta</span><input type="date" name="hasta" value="${esc(valores.hasta || s.hasta)}" required></label>
    </div>
    ${campos
      .map(
        (c) => `<label class="campo"><span>${esc(c.nombre)}</span>${c.nota ? `<small>${esc(c.nota)}</small>` : ''}<input type="number" name="${esc(c.id)}" min="0" max="1000000" step="1" inputmode="numeric" value="${esc(valores[c.id])}"></label>`
      )
      .join('')}
    <label class="campo"><span>¿Algo que debamos saber? (opcional)</span><textarea name="nota" rows="2" maxlength="500">${esc(valores.nota)}</textarea></label>
    <button class="boton" type="submit">Enviar números</button>
  </form>
  ${recientes.length ? `<section class="bloque"><h2>Lo último que nos enviaste</h2><ul class="simple">${recientes.map((r) => `<li>${esc(fechaLarga(r.desde))} al ${esc(fechaLarga(r.hasta))}: ${Object.entries(r.valores).map(([k, v]) => `${esc(nombreCampo[k] || 'dato')} <strong>${esc(calc.mostrar(v, 'numero'))}</strong>`).join(' · ')}</li>`).join('')}</ul><p class="nota">Si te equivocaste, envía el dato correcto y avísanos por WhatsApp para quitar el anterior.</p></section>` : ''}
  <p class="nota">Prisma CN, Consultoría de Negocios · estrategias@alexisconsultor.com · WhatsApp +52 33 2846 7395</p>
</main>`,
  });
}

function noEncontrado() {
  return pagina({
    titulo: 'Enlace no válido',
    css: 'formulario.css',
    clase: 'publica',
    cuerpo: `<header class="barra"><span class="marca"><img src="/prisma-brand/simbolo-negro.png" alt="" width="28" height="29"><span>Prisma CN</span></span></header>
<main class="contenedor angosto"><h1>Este enlace ya no funciona</h1><p>Puede que haya cambiado. Escríbenos por WhatsApp al +52 33 2846 7395 y te mandamos el nuevo.</p></main>`,
  });
}

module.exports = { listaEnlaces, listaRegistros, detalleRegistro, paginaCliente, noEncontrado, semanaPasada };
