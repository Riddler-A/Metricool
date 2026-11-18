// Convierte el formulario en el objeto del reporte y mezcla lo que trae Postiz.
// Sin red ni disco, para poder probarlo.

// "datos.embudo.visibilidad.alcance.actual" → objeto anidado. Las llaves numéricas
// se vuelven arreglos (filas de tabla).
function armar(pares) {
  const raiz = {};
  for (const [nombre, valor] of pares) {
    if (!/^(meta|datos)(\.[A-Za-z0-9]+)+$/.test(nombre) || nombre.split('.').length > 6) continue;
    if (nombre === 'meta.cuentas') {
      (raiz.meta ??= {}).cuentas ??= [];
      raiz.meta.cuentas.push(valor);
      continue;
    }
    const partes = nombre.split('.');
    let nodo = raiz;
    for (const p of partes.slice(0, -1)) {
      if (p === '__proto__' || p === 'constructor' || p === 'prototype') break;
      nodo = nodo[p] ??= {};
    }
    nodo[partes.at(-1)] = String(valor).slice(0, 5000);
  }
  return aArreglos(raiz);
}

function aArreglos(nodo) {
  if (!nodo || typeof nodo !== 'object') return nodo;
  const llaves = Object.keys(nodo);
  if (llaves.length && llaves.every((k) => /^\d+$/.test(k))) {
    return llaves.sort((a, b) => a - b).map((k) => aArreglos(nodo[k])).filter((f) => f && Object.values(f).some((v) => String(v).trim() !== ''));
  }
  for (const k of llaves) nodo[k] = aArreglos(nodo[k]);
  return nodo;
}

// Pone lo que trajo Postiz encima de lo escrito, sin borrar lo que se escribió a mano
// en columnas que Postiz no llena (por ejemplo "Por qué funcionó").
function mezclar(datos, importado) {
  const d = structuredClone(datos || {});
  for (const [sec, campos] of Object.entries(importado)) {
    if (!campos) continue;
    d[sec] ??= {};
    for (const [campo, valor] of Object.entries(campos)) {
      if (Array.isArray(valor)) {
        const previas = Array.isArray(d[sec][campo]) ? d[sec][campo] : [];
        d[sec][campo] = valor.map((fila) => {
          const igual = previas.find((p) => (fila.enlace && p.enlace === fila.enlace) || (fila.pilar && p.pilar === fila.pilar) || (fila.red && p.red === fila.red));
          return { ...(igual || {}), ...fila };
        });
      } else if (valor && typeof valor === 'object') {
        d[sec][campo] ??= {};
        for (const [fila, cols] of Object.entries(valor)) {
          d[sec][campo][fila] = { ...(d[sec][campo][fila] || {}) };
          for (const [col, v] of Object.entries(cols || {})) if (v !== '') d[sec][campo][fila][col] = v;
        }
      }
    }
  }
  return d;
}

module.exports = { armar, mezclar };
