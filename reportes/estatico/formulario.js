// Agregar filas, fotos de anuncios, CSV de campañas y confirmaciones.

// ---------- Agregar fila ----------
document.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-agregar-fila]');
  if (!boton) return;
  const tabla = boton.previousElementSibling;
  const cuerpo = tabla.tBodies[0];
  const ultima = cuerpo.rows[cuerpo.rows.length - 1];
  const nueva = ultima.cloneNode(true);
  const indice = cuerpo.rows.length;
  for (const campo of nueva.querySelectorAll('input, select')) {
    if (campo.name) campo.name = campo.name.replace(/\.(\d+)\.([A-Za-z0-9]+)$/, `.${indice}.$2`);
    campo.value = '';
  }
  for (const img of nueva.querySelectorAll('.vista-previa')) { img.removeAttribute('src'); img.hidden = true; }
  for (const b of nueva.querySelectorAll('[data-quitar-imagen]')) b.hidden = true;
  cuerpo.appendChild(nueva);
  nueva.querySelector('input:not([type=hidden]), select')?.focus();
});

// ---------- Fotos de anuncios ----------
// Se reduce en el navegador a 1200 px como máximo y se manda como JPG; así viaja poco y el
// servidor solo tiene que revisarla y guardarla.
const MAX_LADO = 1200;

function reducir(archivo) {
  return new Promise((ok, mal) => {
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return mal(new Error('Elige una imagen JPG, PNG o WebP.'));
    if (archivo.size > 20 * 1024 * 1024) return mal(new Error('La imagen pesa más de 20 MB.'));
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.round(img.width * escala);
      lienzo.height = Math.round(img.height * escala);
      const ctx = lienzo.getContext('2d');
      ctx.fillStyle = '#fff'; // las PNG transparentes quedan sobre blanco
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      ok(lienzo.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

document.addEventListener('change', async (e) => {
  const entrada = e.target;
  const celda = entrada.closest('[data-imagen]');
  if (celda && entrada.type === 'file' && entrada.files[0]) {
    try {
      const dataUrl = await reducir(entrada.files[0]);
      celda.querySelector('input[name$=".imagenNueva"]').value = dataUrl;
      const img = celda.querySelector('.vista-previa');
      img.src = dataUrl;
      img.hidden = false;
      celda.querySelector('[data-quitar-imagen]').hidden = false;
      marcarCambio();
    } catch (err) {
      window.alert(err.message);
    }
    entrada.value = '';
    return;
  }

  // ---------- CSV de campañas ----------
  if (entrada.matches('[data-csv]') && entrada.files[0]) {
    const archivo = entrada.files[0];
    if (archivo.size > 3 * 1024 * 1024) {
      window.alert('El archivo pesa más de 3 MB. Exporta solo el reporte de campañas.');
      entrada.value = '';
      return;
    }
    const caja = entrada.closest('details');
    caja.querySelector('input[name="csv.contenido"]').value = await archivo.text();
  }
});

document.addEventListener('click', (e) => {
  const quitar = e.target.closest('[data-quitar-imagen]');
  if (!quitar) return;
  const celda = quitar.closest('[data-imagen]');
  for (const h of celda.querySelectorAll('input[type=hidden]')) h.value = '';
  const img = celda.querySelector('.vista-previa');
  img.removeAttribute('src');
  img.hidden = true;
  quitar.hidden = true;
  marcarCambio();
});

// ---------- Confirmaciones ----------
document.addEventListener('submit', (e) => {
  const mensaje = e.target.dataset.confirmar;
  if (mensaje && !window.confirm(mensaje)) e.preventDefault();
});

// Avisa si se intenta salir con cambios sin guardar.
let cambios = false;
function marcarCambio() { cambios = true; }
const formulario = document.getElementById('formulario');
if (formulario) {
  formulario.addEventListener('input', marcarCambio);
  formulario.addEventListener('submit', () => { cambios = false; });
  window.addEventListener('beforeunload', (e) => { if (cambios) e.preventDefault(); });
}
