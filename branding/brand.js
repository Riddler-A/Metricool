// Ajustes de marca que necesitan JavaScript. Next.js vuelve a dibujar la página al
// navegar, por eso todo se vigila con un MutationObserver.
(function () {
  var BRAND_NAME = 'Prisma CN · Redes';

  // Reemplaza "Postiz" por el nombre de la marca en el título de la pestaña.
  function fixTitle() {
    if (document.title.indexOf('Postiz') !== -1) {
      document.title = document.title.replace(/Postiz/g, BRAND_NAME);
    }
  }

  // Agrega "Reportes" al menú de la izquierda, copiando el estilo del botón "Media".
  // Es un enlace normal (no de Next.js) porque los reportes son otra aplicación.
  var ICONO_REPORTES =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="21" viewBox="0 0 20 21" fill="none" aria-hidden="true">' +
    '<path d="M11.667 2.5H5.833c-.92 0-1.666.746-1.666 1.667v12.5c0 .92.746 1.666 1.666 1.666h8.334c.92 0 1.666-.746 1.666-1.666V6.667L11.667 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M11.667 2.5v4.167h4.166M7.5 14.167v-2.5M10 14.167v-4.167M12.5 14.167v-1.667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function addReportsLink() {
    if (document.querySelector('a[data-prisma-reportes]')) return;
    var media = document.querySelector('a[href="/media"]');
    if (!media) return;
    var link = media.cloneNode(true);
    link.setAttribute('href', '/reportes/');
    link.setAttribute('title', 'Reportes');
    link.setAttribute('data-prisma-reportes', '');
    var partes = link.children;
    if (partes[0]) partes[0].innerHTML = ICONO_REPORTES;
    if (partes[1]) partes[1].textContent = 'Reportes';
    media.parentNode.insertBefore(link, media.nextSibling);
  }

  function apply() {
    fixTitle();
    addReportsLink();
  }

  apply();
  new MutationObserver(apply).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
