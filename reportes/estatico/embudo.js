// Diseñador de embudos: agregar, quitar y reordenar etapas.
const lista = document.getElementById('etapas');
const MAX = 10;

// Los nombres llevan el número de etapa (etapas.0.nombre…): se rehacen tras cada cambio.
function renumerar() {
  [...lista.querySelectorAll('[data-etapa]')].forEach((li, i) => {
    li.querySelector('.etapa-num').textContent = i + 1;
    for (const campo of li.querySelectorAll('[name]')) campo.name = campo.name.replace(/^etapas\.\d+\./, `etapas.${i}.`);
    li.querySelector('[data-subir]').disabled = i === 0;
    li.querySelector('[data-bajar]').disabled = i === lista.children.length - 1;
  });
  document.querySelector('[data-agregar-etapa]').disabled = lista.children.length >= MAX;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const li = b.closest('[data-etapa]');
  if (b.matches('[data-agregar-etapa]')) {
    if (lista.children.length >= MAX) return;
    const nueva = document.getElementById('plantilla-etapa').content.firstElementChild.cloneNode(true);
    lista.appendChild(nueva);
    renumerar();
    nueva.querySelector('input[type=text]').focus();
  } else if (b.matches('[data-quitar-etapa]') && li) {
    if (lista.children.length <= 2 && !window.confirm('Un embudo necesita al menos dos etapas. ¿Quitarla de todos modos?')) return;
    li.remove();
    renumerar();
  } else if (b.matches('[data-subir]') && li?.previousElementSibling) {
    li.parentNode.insertBefore(li, li.previousElementSibling);
    renumerar();
    li.querySelector('[data-subir]').focus();
  } else if (b.matches('[data-bajar]') && li?.nextElementSibling) {
    li.parentNode.insertBefore(li.nextElementSibling, li);
    renumerar();
    li.querySelector('[data-bajar]').focus();
  }
});

document.addEventListener('submit', (e) => {
  const mensaje = e.target.dataset.confirmar;
  if (mensaje && !window.confirm(mensaje)) e.preventDefault();
});

if (lista) renumerar();
