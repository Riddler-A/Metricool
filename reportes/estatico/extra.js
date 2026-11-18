// Copiar enlaces, cambiar entre página y WhatsApp, y confirmar antes de borrar.
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copiar]');
  if (!b) return;
  try {
    await navigator.clipboard.writeText(b.dataset.copiar);
    const antes = b.textContent;
    b.textContent = 'Copiado';
    setTimeout(() => { b.textContent = antes; }, 1500);
  } catch {
    window.prompt('Copia el texto:', b.dataset.copiar);
  }
});

function mostrarTipo() {
  const tipo = document.querySelector('[data-tipo]:checked')?.value;
  for (const caja of document.querySelectorAll('[data-para]')) {
    const visible = caja.dataset.para === tipo;
    caja.hidden = !visible;
    for (const campo of caja.querySelectorAll('input')) campo.required = visible && (campo.name === 'destino' || campo.name === 'numero');
  }
}
document.addEventListener('change', (e) => { if (e.target.matches('[data-tipo]')) mostrarTipo(); });
mostrarTipo();

document.addEventListener('submit', (e) => {
  const mensaje = e.target.dataset.confirmar;
  if (mensaje && !window.confirm(mensaje)) e.preventDefault();
});
