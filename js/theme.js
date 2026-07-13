// Aplica el tema antes del render para evitar parpadeo.
(function () {
  var saved = null;
  try { saved = localStorage.getItem('skydash:theme'); } catch (e) {}
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);

  window.SkyTheme = {
    get: function () { return document.documentElement.getAttribute('data-theme'); },
    set: function (t) {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('skydash:theme', t); } catch (e) {}
    },
    toggle: function () { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
    bind: function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function () { window.SkyTheme.toggle(); });
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    window.SkyTheme.bind(document.getElementById('theme-toggle'));
  });
})();