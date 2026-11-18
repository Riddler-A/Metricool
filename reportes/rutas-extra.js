// Rutas de enlaces rastreables y registro de clientes.
//   Públicas (sin sesión): /r/<enlace> y /c/<llave>
//   Del equipo (con sesión de Postiz): /reportes/enlaces/… y /reportes/clientes/…

const enlaces = require('./enlaces');
const clientes = require('./clientes');
const embudos = require('./embudos');
const vistasExtra = require('./vistas-extra');

const R = '/reportes';

// Dirección pública para armar los enlaces que se comparten.
function base(req) {
  const env = String(process.env.URL_PUBLICA || '').replace(/\/+$/, '');
  if (env) return env;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${host}`;
}

// Límite sencillo por IP para el formulario público (evita que alguien lo llene en bucle).
const intentos = new Map();
function demasiados(ip, max = 20, ventanaMs = 3600000) {
  const ahora = Date.now();
  const lista = (intentos.get(ip) || []).filter((t) => ahora - t < ventanaMs);
  lista.push(ahora);
  intentos.set(ip, lista);
  if (intentos.size > 10000) intentos.clear();
  return lista.length > max;
}

async function nombresConocidos(DATOS, todosReportes) {
  const [rep, emb, cli] = await Promise.all([todosReportes(), embudos.todos(DATOS), clientes.todos(DATOS)]);
  return [...rep.map((r) => r.meta?.cliente), ...emb.map((e) => e.cliente), ...cli.map((c) => c.cliente)];
}

async function camposDe(DATOS, cliente) {
  const embudo = (await embudos.todos(DATOS)).find(
    (e) => String(e.cliente || '').trim().toLowerCase() === String(cliente.cliente || '').trim().toLowerCase()
  );
  return clientes.campos(embudo);
}

// Devuelve true si atendió la petición.
async function publicas(req, res, url, h) {
  const ruta = url.pathname;

  let m = /^\/r\/([a-z0-9-]{1,40})\/?$/.exec(ruta);
  if (m) {
    const destino = await enlaces.registrarClic(h.DATOS, m[1], req);
    if (!destino) {
      h.responder(res, 404, vistasExtra.noEncontrado());
      return true;
    }
    res.writeHead(302, { location: destino, 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'strict-origin-when-cross-origin' });
    res.end();
    return true;
  }

  m = /^\/c\/([a-f0-9]{32})\/?$/.exec(ruta);
  if (m) {
    const cliente = await clientes.porLlave(h.DATOS, m[1]);
    if (!cliente) {
      h.responder(res, 404, vistasExtra.noEncontrado(), { 'x-robots-tag': 'noindex' });
      return true;
    }
    const campos = await camposDe(h.DATOS, cliente);
    if (req.method === 'POST') {
      const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
      if (!h.mismoOrigen(req) || demasiados(ip)) {
        h.responder(res, 429, vistasExtra.paginaCliente({ cliente, campos, error: 'Recibimos demasiados envíos. Intenta más tarde o escríbenos por WhatsApp.' }), { 'x-robots-tag': 'noindex' });
        return true;
      }
      const enviado = Object.fromEntries(new URLSearchParams(await h.leerCuerpo(req, 64 * 1024)));
      try {
        const registro = clientes.limpiarRegistro(enviado, campos);
        await clientes.guardar(h.DATOS, clientes.agregarRegistro(cliente, registro));
        res.writeHead(303, { location: `${ruta}?ok=1`, 'cache-control': 'no-store' });
        res.end();
      } catch (e) {
        h.responder(res, 400, vistasExtra.paginaCliente({ cliente, campos, error: e.message, valores: enviado }), { 'x-robots-tag': 'noindex' });
      }
      return true;
    }
    const mensaje = url.searchParams.get('ok') ? '¡Gracias! Recibimos tus números.' : '';
    h.responder(res, 200, vistasExtra.paginaCliente({ cliente, campos, mensaje }), { 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' });
    return true;
  }
  return false;
}

// Rutas del equipo, ya con sesión. `ruta` viene sin el prefijo /reportes.
async function equipo(req, res, url, ruta, h) {
  const volver = (destino, msj, clave = 'm') => h.redirigir(res, `${destino}${msj ? `?${clave}=${encodeURIComponent(msj)}` : ''}`);

  // ----- Enlaces -----
  if (ruta === '/enlaces' || ruta === '/enlaces/') {
    h.responder(res, 200, vistasExtra.listaEnlaces({ lista: await enlaces.todos(h.DATOS), base: base(req), clientes: await nombresConocidos(h.DATOS, h.todos), mensaje: url.searchParams.get('m'), error: url.searchParams.get('e') }));
    return true;
  }
  if (ruta === '/enlaces/nuevo' && req.method === 'POST') {
    const f = Object.fromEntries(new URLSearchParams(await h.leerCuerpo(req, 64 * 1024)));
    const cliente = String(f.cliente || '').trim().slice(0, 80);
    const nombre = String(f.nombre || '').trim().slice(0, 60);
    const slug = f.slug ? String(f.slug).trim().toLowerCase() : enlaces.aSlug(`${cliente} ${nombre}`);
    const tipo = f.tipo === 'whatsapp' ? 'whatsapp' : 'web';
    const destino = tipo === 'whatsapp' ? enlaces.whatsapp(f.numero, f.mensaje) : String(f.destino || '').trim();
    let error = '';
    if (!cliente || !nombre) error = 'Escribe el cliente y el nombre del enlace.';
    else if (!enlaces.slugValido(slug)) error = 'El nombre del enlace corto solo puede llevar minúsculas, números y guiones (máximo 40).';
    else if (!destino || !enlaces.destinoValido(destino)) error = tipo === 'whatsapp' ? 'Revisa el número de WhatsApp (10 dígitos, o con lada de país).' : 'La dirección debe empezar con https:// o http://';
    else if (await enlaces.leer(h.DATOS, slug)) error = `Ya existe un enlace llamado "${slug}". Elige otro nombre.`;
    if (error) return volver(`${R}/enlaces/`, error, 'e'), true;
    await enlaces.guardar(h.DATOS, {
      slug,
      cliente,
      nombre,
      canal: String(f.canal || '').trim().slice(0, 40),
      tipo,
      destino,
      numero: tipo === 'whatsapp' ? String(f.numero || '').trim().slice(0, 25) : '',
      creado: new Date().toISOString(),
      autor: h.usuario.email,
      clics: {},
      unicos: {},
    });
    volver(`${R}/enlaces/`, `Enlace creado: ${base(req)}/r/${slug}`);
    return true;
  }
  let m = /^\/enlaces\/([a-z0-9-]{1,40})\/(pausar|reanudar|borrar)$/.exec(ruta);
  if (m && req.method === 'POST') {
    const enlace = await enlaces.leer(h.DATOS, m[1]);
    if (!enlace) return volver(`${R}/enlaces/`, 'Ese enlace ya no existe.', 'e'), true;
    if (m[2] === 'borrar') {
      await enlaces.borrar(h.DATOS, m[1]);
      return volver(`${R}/enlaces/`, 'Enlace movido a la papelera.'), true;
    }
    await enlaces.guardar(h.DATOS, { ...enlace, pausado: m[2] === 'pausar' });
    return volver(`${R}/enlaces/`, m[2] === 'pausar' ? 'Enlace pausado: quien dé clic verá un aviso.' : 'Enlace activo otra vez.'), true;
  }

  // ----- Registro de clientes -----
  if (ruta === '/clientes' || ruta === '/clientes/') {
    h.responder(res, 200, vistasExtra.listaRegistros({ lista: await clientes.todos(h.DATOS), base: base(req), clientes: await nombresConocidos(h.DATOS, h.todos), mensaje: url.searchParams.get('m') }));
    return true;
  }
  if (ruta === '/clientes/nuevo' && req.method === 'POST') {
    const f = Object.fromEntries(new URLSearchParams(await h.leerCuerpo(req, 16 * 1024)));
    const nombre = String(f.cliente || '').trim().slice(0, 80);
    if (!nombre) return volver(`${R}/clientes/`, 'Escribe el nombre del cliente.'), true;
    const existente = clientes.deCliente(await clientes.todos(h.DATOS), nombre);
    if (existente) return h.redirigir(res, `${R}/clientes/${existente.id}?m=${encodeURIComponent('Ese cliente ya tenía registro.')}`), true;
    const nuevo = clientes.nuevo(nombre);
    await clientes.guardar(h.DATOS, nuevo);
    h.redirigir(res, `${R}/clientes/${nuevo.id}?m=${encodeURIComponent('Listo. Copia el enlace y mándaselo al cliente.')}`);
    return true;
  }
  m = /^\/clientes\/([a-f0-9]{16})(?:\/(llave|quitar|borrar))?$/.exec(ruta);
  if (m) {
    const cliente = await clientes.leer(h.DATOS, m[1]);
    if (!cliente) return volver(`${R}/clientes/`, 'Ese registro ya no existe.'), true;
    if (!m[2] && req.method === 'GET') {
      h.responder(res, 200, vistasExtra.detalleRegistro({ cliente, base: base(req), campos: await camposDe(h.DATOS, cliente), mensaje: url.searchParams.get('m') }));
      return true;
    }
    if (req.method !== 'POST') return false;
    const aqui = `${R}/clientes/${cliente.id}`;
    if (m[2] === 'llave') {
      await clientes.guardar(h.DATOS, clientes.nuevaLlave(cliente));
      return volver(aqui, 'Enlace cambiado. Mándale el nuevo al cliente; el anterior ya no funciona.'), true;
    }
    if (m[2] === 'quitar') {
      const f = Object.fromEntries(new URLSearchParams(await h.leerCuerpo(req, 4096)));
      await clientes.guardar(h.DATOS, { ...cliente, registros: (cliente.registros || []).filter((r) => r.id !== f.registro) });
      return volver(aqui, 'Registro quitado.'), true;
    }
    if (m[2] === 'borrar') {
      await clientes.borrar(h.DATOS, cliente.id);
      return volver(`${R}/clientes/`, 'Registro del cliente movido a la papelera.'), true;
    }
  }
  return false;
}

// Datos para "Traer datos": clics de los enlaces y lo que registró el cliente.
async function datosDelCliente(DATOS, nombreCliente, inicio, fin, ant) {
  const lista = enlaces.deCliente(await enlaces.todos(DATOS), nombreCliente);
  const avisos = [];
  const datos = { embudo: { conversion: {} } };
  const par = (a, b) => ({ actual: String(a), anterior: String(b) });

  let resumenEnlaces = [];
  if (lista.length) {
    const web = lista.filter((e) => e.tipo !== 'whatsapp');
    const wa = lista.filter((e) => e.tipo === 'whatsapp');
    const suma = (l, d, h) => l.reduce((s, e) => s + enlaces.clicsEntre(e, d, h), 0);
    if (web.length) datos.embudo.conversion.clics = par(suma(web, inicio, fin), suma(web, ant.inicio, ant.fin));
    if (wa.length) datos.embudo.conversion.abrieronWhatsapp = par(suma(wa, inicio, fin), suma(wa, ant.inicio, ant.fin));
    resumenEnlaces = lista.map((e) => ({
      nombre: e.nombre,
      canal: e.canal || '',
      tipo: e.tipo,
      actual: enlaces.clicsEntre(e, inicio, fin),
      anterior: enlaces.clicsEntre(e, ant.inicio, ant.fin),
      unicos: enlaces.clicsEntre(e, inicio, fin, 'unicos'),
    }));
  }

  const registro = clientes.deCliente(await clientes.todos(DATOS), nombreCliente);
  if (registro) {
    const a = clientes.sumaEntre(registro, inicio, fin);
    const b = clientes.sumaEntre(registro, ant.inicio, ant.fin);
    if (a.registros || b.registros) {
      const val = (s, k) => (s.total[k] === undefined ? '' : String(s.total[k]));
      if (a.total.ventas !== undefined || b.total.ventas !== undefined) datos.embudo.conversion.ventas = { actual: val(a, 'ventas'), anterior: val(b, 'ventas') };
      const etapas = {};
      for (const k of new Set([...Object.keys(a.total), ...Object.keys(b.total)])) {
        if (k !== 'ventas') etapas[k] = { actual: val(a, k), anterior: val(b, k) };
      }
      if (Object.keys(etapas).length) datos.embudoEtapas = etapas;
    }
    if (!a.registros) avisos.push(`${nombreCliente} no registró números en este periodo (registro del cliente).`);
  }
  return { datos, avisos, resumenEnlaces, hayAlgo: lista.length > 0 || !!registro };
}

module.exports = { publicas, equipo, datosDelCliente, base };
