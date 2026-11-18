// Agregar filas a las tablas y confirmar antes de borrar.
document.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-agregar-fila]');
  if (!boton) return;
  const tabla = boton.previousElementSibling;
  const cuerpo = tabla.tBodies[0];
  const ultima = cuerpo.rows[cuerpo.rows.length - 1];
  const nueva = ultima.cloneNode(true);
  const indice = cuerpo.rows.length;
  for (const input of nueva.querySelectorAll('input')) {
    input.name = input.name.replace(/\.(\d+)\.([A-Za-z0-9]+)$/, `.${indice}.$2`);
    input.value = '';
  }
  cuerpo.appendChild(nueva);
  nueva.querySelector('input')?.focus();
});

document.addEventListener('submit', (e) => {
  const mensaje = e.target.dataset.confirmar;
  if (mensaje && !window.confirm(mensaje)) e.preventDefault();
});

// Avisa si se intenta salir con cambios sin guardar.
const formulario = document.getElementById('formulario');
if (formulario) {
  let cambios = false;
  formulario.addEventListener('input', () => { cambios = true; });
  formulario.addEventListener('submit', () => { cambios = false; });
  window.addEventListener('beforeunload', (e) => { if (cambios) e.preventDefault(); });
}
