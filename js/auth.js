// Autenticación simulada (estática) según enunciado.
(function () {
  var USERS = [
    { username: 'demo', password: 'ucab2026', name: 'Demo UCAB' }
  ];
  var TOKEN_KEY = 'skydash:token';
  var USER_KEY = 'skydash:user';

  window.SkyAuth = {
    login: function (username, password) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          var u = USERS.find(function (x) { return x.username === username && x.password === password; });
          if (!u) return reject(new Error('Usuario o contraseña incorrectos.'));
          var token = 'sk_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
          try {
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(USER_KEY, JSON.stringify({ username: u.username, name: u.name }));
          } catch (e) {}
          resolve({ token: token, user: { username: u.username, name: u.name } });
        }, 900);
      });
    },
    logout: function () {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        sessionStorage.clear();
      } catch (e) {}
      window.location.replace('/login.html');
    },
    isAuthed: function () {
      try { return !!localStorage.getItem(TOKEN_KEY); } catch (e) { return false; }
    },
    user: function () {
      try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
    },
    requireAuth: function () {
      if (!this.isAuthed()) { window.location.replace('/login.html'); }
    },
    redirectIfAuthed: function () {
      if (this.isAuthed()) { window.location.replace('/app.html'); }
    }
  };
})();