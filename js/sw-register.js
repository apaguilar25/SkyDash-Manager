if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    // Registro relativo: funciona tanto en local como en GitHub Pages
    // bajo /SkyDash-Manager/ sin depender de rutas absolutas.
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('SW no registrado', err);
    });
  });
}
