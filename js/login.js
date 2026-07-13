(function () {
  window.SkyAuth.redirectIfAuthed();

  var form = document.getElementById('login-form');
  var btn = document.getElementById('login-btn');
  var label = btn.querySelector('.btn-label');
  var spinner = btn.querySelector('.spinner');
  var errorBox = document.getElementById('login-error');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorBox.hidden = true;
    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value;

    if (!username || !password) {
      errorBox.textContent = 'Completa usuario y contraseña.';
      errorBox.hidden = false;
      return;
    }

    btn.disabled = true;
    label.textContent = 'Validando…';
    spinner.hidden = false;

    window.SkyAuth.login(username, password)
      .then(function () { window.location.replace('/app.html'); })
      .catch(function (err) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
        btn.disabled = false;
        label.textContent = 'Iniciar sesión';
        spinner.hidden = true;
      });
  });
})();