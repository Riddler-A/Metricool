// Pruebas: node --test reportes/pruebas.test.js
// Usan un Postiz simulado, así que no necesitan redes conectadas.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const calc = require('./calculos');

test('numero entiende cómo se escribe en México', () => {
  assert.equal(calc.numero('12,500'), 12500);
  assert.equal(calc.numero('4.5%'), 4.5);
  assert.equal(calc.numero('$1,200.50 MXN'), 1200.5);
  assert.equal(calc.numero(''), null);
  assert.equal(calc.numero('2 horas'), null);
});

test('variación y formato', () => {
  assert.equal(calc.variacion(118, 100), 18);
  assert.equal(calc.variacion(5, 0), null);
  assert.equal(calc.mostrarVariacion(-12.34), '−12.3%');
  assert.equal(calc.mostrar('12500', 'numero'), '12,500');
  assert.equal(calc.mostrar('4.25', 'porcentaje'), '4.3%');
  assert.equal(calc.mostrar('2 horas', 'numero'), '2 horas');
});

test('engagement con la fórmula de Prisma CN', () => {
  assert.equal(calc.tasaEngagement({ likes: 80, comentarios: 10, guardados: 6, compartidos: 4, alcance: 2000 }), 5);
  assert.equal(calc.tasaEngagement({ likes: 80, alcance: '' }), null);
});

test('completarCalculados llena el engagement sin pisar lo escrito', () => {
  const d = calc.completarCalculados({
    embudo: {
      visibilidad: { alcance: { actual: '2000', anterior: '1000' } },
      interaccion: {
        engagement: { actual: '', anterior: '9' },
        likes: { actual: '100', anterior: '50' },
      },
    },
  });
  assert.equal(d.embudo.interaccion.engagement.actual, '5');
  assert.equal(d.embudo.interaccion.engagement.anterior, '9');
});

test('periodo anterior de la misma duración', () => {
  assert.deepEqual(calc.periodoAnterior('2026-10-01', '2026-10-31'), { inicio: '2026-08-31', fin: '2026-09-30', dias: 31 });
  assert.equal(calc.periodoAnterior('2026-10-31', '2026-10-01'), null);
});

test('pauta: costo por resultado y totales', () => {
  const r = calc.resumenPauta([
    { campana: 'A', inversion: '1,000', resultados: '50' },
    { campana: 'B', inversion: '500', resultados: '0' },
  ]);
  assert.equal(r.filas[0].costo, 20);
  assert.equal(r.filas[1].costo, null);
  assert.equal(r.total.inversion, 1500);
  assert.equal(r.total.costo, 30);
});

// ---------- Postiz simulado ----------

function publicacion(id, dia, cuenta, red, etiqueta) {
  return {
    i: id,
    c: `<p>Publicación ${id} con un texto de ejemplo para el reporte</p>`,
    d: `2026-10-${dia}T15:00:00.000Z`,
    u: `https://instagram.com/p/${id}`,
    s: 'PUBLISHED',
    n: { i: cuenta, pi: red, n: 'Cuenta' },
    tg: etiqueta ? [{ t: { n: etiqueta } }] : [],
  };
}

const POSTS = [
  publicacion('a1', '03', 'ig1', 'instagram', 'Educativo'),
  publicacion('a2', '08', 'ig1', 'instagram', 'Testimonios'),
  publicacion('a3', '12', 'fb1', 'facebook', 'Educativo'),
  publicacion('a4', '20', 'ig1', 'instagram', 'Promocional'),
  publicacion('a5', '25', 'otra', 'instagram', ''), // cuenta no elegida
  { ...publicacion('a6', '28', 'ig1', 'instagram', ''), s: 'ERROR' }, // no publicada
];
const METRICAS = {
  a1: { Reach: 1000, Views: 1500, Likes: 50, Comments: 5, Saves: 10, Shares: 5 },
  a2: { Reach: 3000, Views: 4000, Likes: 200, Comments: 20, Saves: 30, Shares: 10 },
  a3: { Reach: 500, Views: 600, Likes: 10, Comments: 1, Saves: 0, Shares: 1 },
  a4: { Reach: 2000, Views: 2500, Likes: 40, Comments: 4, Saves: 2, Shares: 2 },
};
const MEDIOS = { a1: [{ path: 'x.mp4' }], a2: [{ path: '1.jpg' }, { path: '2.jpg' }], a3: [{ path: '1.jpg' }], a4: [{ path: '1.jpg' }] };

function simulador() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (o, s = 200) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (!/auth=ok/.test(req.headers.cookie || '')) return json({ msg: 'no' }, 401);
    if (url.pathname === '/api/user/self') return json({ email: 'equipo@prisma.test' });
    if (url.pathname === '/api/integrations/list') return json({ integrations: [{ id: 'ig1', name: 'Cliente IG', identifier: 'instagram' }, { id: 'fb1', name: 'Cliente FB', identifier: 'facebook' }] });
    if (url.pathname === '/api/posts') {
      const desde = url.searchParams.get('startDate');
      const hasta = url.searchParams.get('endDate');
      return json({ p: POSTS.filter((p) => p.d >= desde && p.d <= hasta) });
    }
    let m = /^\/api\/posts\/(\w+)$/.exec(url.pathname);
    if (m) return json({ posts: [{ id: m[1], image: MEDIOS[m[1]] || [] }] });
    m = /^\/api\/analytics\/post\/(\w+)$/.exec(url.pathname);
    if (m) return json(Object.entries(METRICAS[m[1]] || {}).map(([label, total]) => ({ label, data: [{ total, date: '2026-10-31' }] })));
    m = /^\/api\/analytics\/(\w+)$/.exec(url.pathname);
    if (m) return json([{ label: 'Follower Count', data: [{ total: 7, date: '2026-10-05' }, { total: 3, date: '2026-10-20' }, { total: 9, date: '2026-09-10' }] }]);
    json({}, 404);
  });
}

test('traerDatos arma el reporte con datos de Postiz', async (t) => {
  const srv = simulador();
  await new Promise((ok) => srv.listen(0, ok));
  t.after(() => srv.close());
  process.env.POSTIZ_INTERNO = `http://127.0.0.1:${srv.address().port}/api`;
  delete require.cache[require.resolve('./postiz')];
  const postiz = require('./postiz');

  assert.equal(await postiz.sesion('otra=1'), null);
  assert.equal((await postiz.sesion('auth=ok')).email, 'equipo@prisma.test');

  const r = await postiz.traerDatos('auth=ok', { inicio: '2026-10-01', fin: '2026-10-31', cuentas: ['ig1', 'fb1'] });
  const v = r.datos.embudo.visibilidad;
  const i = r.datos.embudo.interaccion;
  assert.equal(v.alcance.actual, '6500');
  assert.equal(v.impresiones.actual, '8600');
  assert.equal(v.nuevos.actual, '20'); // 10 por cuenta × 2 cuentas
  assert.equal(v.nuevos.anterior, '18');
  assert.equal(i.likes.actual, '300');
  // (300 + 30 + 42 + 18) / 6500 × 100 = 6.0
  assert.equal(i.engagement.actual, '6');
  assert.equal(v.alcance.anterior, ''); // no hubo publicaciones en septiembre

  const c = r.datos.contenido;
  assert.equal(c.mejores[0].enlace, 'https://instagram.com/p/a2');
  assert.equal(c.mejores[0].formato, 'Carrusel');
  assert.equal(c.mejores.length, 3);
  assert.equal(c.peores.length, 1); // con 4 publicaciones solo queda 1 sin repetir
  assert.equal(c.peores[0].enlace, 'https://instagram.com/p/a3');
  assert.equal(c.formatos.video.publicaciones, '1');
  assert.equal(c.formatos.imagen.publicaciones, '2');
  assert.equal(c.pilares[0].pilar, 'Educativo');
  assert.equal(c.pilares[0].publicaciones, '2');
  assert.equal(r.datos.porRed.filas.length, 2);
  assert.deepEqual(r.avisos, []);
});

test('el formulario se vuelve objeto y la importación no borra lo escrito a mano', () => {
  const { armar, mezclar } = require('./datos');
  const obj = armar([
    ['meta.cliente', 'Café Norte'],
    ['meta.cuentas', 'ig1'],
    ['meta.cuentas', 'fb1'],
    ['datos.contenido.mejores.0.enlace', 'https://instagram.com/p/a2'],
    ['datos.contenido.mejores.0.porque', 'Gancho claro en el primer segundo'],
    ['datos.contenido.mejores.1.porque', ''],
    ['datos.embudo.visibilidad.visitas.actual', '320'],
    ['otra.cosa', 'x'],
    ['datos.__proto__.x', 'x'],
  ]);
  assert.deepEqual(obj.meta.cuentas, ['ig1', 'fb1']);
  assert.equal(obj.datos.contenido.mejores.length, 1);
  assert.equal(obj.otra, undefined);
  assert.equal({}.x, undefined);

  const m = mezclar(obj.datos, {
    contenido: { mejores: [{ enlace: 'https://instagram.com/p/a2', alcance: '3000' }] },
    embudo: { visibilidad: { alcance: { actual: '6500', anterior: '' } } },
  });
  assert.equal(m.contenido.mejores[0].porque, 'Gancho claro en el primer segundo');
  assert.equal(m.contenido.mejores[0].alcance, '3000');
  assert.equal(m.embudo.visibilidad.visitas.actual, '320');
  assert.equal(m.embudo.visibilidad.alcance.actual, '6500');
});
