// Reemplaza "Postiz" por el nombre de la marca en el título de la pestaña.
// Next.js cambia el <title> al navegar, por eso se vigila con un MutationObserver.
(function () {
  var BRAND_NAME = 'Prisma CN · Redes';

  function fixTitle() {
    if (document.title.indexOf('Postiz') !== -1) {
      document.title = document.title.replace(/Postiz/g, BRAND_NAME);
    }
  }

  fixTitle();
  new MutationObserver(fixTitle).observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
