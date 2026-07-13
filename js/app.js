(function () {
  window.SkyAuth.requireAuth();

  var user = window.SkyAuth.user();
  var greetEl = document.getElementById('user-greeting');
  if (user && greetEl) greetEl.textContent = 'Hola, ' + user.name;

  document.getElementById('logout-btn').addEventListener('click', function () {
    window.SkyAuth.logout();
  });

  // ---------- Estado ----------
  var current = null; // { lat, lon, name }
  var FAV_KEY = 'skydash:favs';
  var LAST_KEY = 'skydash:last';

  // ---------- Toast ----------
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  // ---------- Offline badge ----------
  var offlineBadge = document.getElementById('offline-badge');
  function updateOffline() {
    var off = !navigator.onLine;
    offlineBadge.hidden = !off;
    if (off) toast('Estás sin conexión. Mostrando datos guardados.');
  }
  window.addEventListener('online', updateOffline);
  window.addEventListener('offline', updateOffline);
  updateOffline();

  // ---------- Weather code helpers ----------
  var WMO = {
    0: { d: 'Despejado', e: '☀️' },
    1: { d: 'Mayormente despejado', e: '🌤️' },
    2: { d: 'Parcialmente nublado', e: '⛅' },
    3: { d: 'Nublado', e: '☁️' },
    45: { d: 'Niebla', e: '🌫️' },
    48: { d: 'Niebla con escarcha', e: '🌫️' },
    51: { d: 'Llovizna ligera', e: '🌦️' },
    53: { d: 'Llovizna', e: '🌦️' },
    55: { d: 'Llovizna intensa', e: '🌧️' },
    56: { d: 'Llovizna helada', e: '🌧️' },
    57: { d: 'Llovizna helada intensa', e: '🌧️' },
    61: { d: 'Lluvia ligera', e: '🌧️' },
    63: { d: 'Lluvia', e: '🌧️' },
    65: { d: 'Lluvia intensa', e: '🌧️' },
    66: { d: 'Lluvia helada', e: '🌧️' },
    67: { d: 'Lluvia helada intensa', e: '🌧️' },
    71: { d: 'Nieve ligera', e: '🌨️' },
    73: { d: 'Nieve', e: '🌨️' },
    75: { d: 'Nieve intensa', e: '❄️' },
    77: { d: 'Granizo', e: '❄️' },
    80: { d: 'Chubascos ligeros', e: '🌦️' },
    81: { d: 'Chubascos', e: '🌧️' },
    82: { d: 'Chubascos intensos', e: '⛈️' },
    85: { d: 'Chubascos de nieve', e: '🌨️' },
    86: { d: 'Chubascos de nieve intensos', e: '❄️' },
    95: { d: 'Tormenta', e: '⛈️' },
    96: { d: 'Tormenta con granizo', e: '⛈️' },
    99: { d: 'Tormenta severa', e: '⛈️' }
  };
  function wmo(code) { return WMO[code] || { d: '—', e: '🌡️' }; }

  // ---------- Mapa ----------
  var map = L.map('map', { zoomControl: true, worldCopyJump: true }).setView([10.4806, -66.9036], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  var marker = null;
  function setMarker(lat, lon, emoji) {
    var icon = L.divIcon({
      className: 'weather-marker-wrap',
      html: '<div class="weather-marker">' + (emoji || '📍') + '</div>',
      iconSize: [40, 40],
      iconAnchor: [20, 34]
    });
    if (marker) {
      marker.setLatLng([lat, lon]);
      marker.setIcon(icon);
    } else {
      marker = L.marker([lat, lon], { icon: icon }).addTo(map);
    }
  }

  map.on('click', function (e) {
    selectLocation(e.latlng.lat, e.latlng.lng);
  });

  // ---------- Geocoding ----------
  function reverseGeocode(lat, lon) {
    var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&zoom=10&addressdetails=1';
    return fetch(url, { headers: { 'Accept-Language': 'es' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d) return null;
        var a = d.address || {};
        var name = a.city || a.town || a.village || a.municipality || a.county || a.state || d.display_name || 'Ubicación';
        var region = a.state || a.country || '';
        return { name: name, region: region };
      })
      .catch(function () { return null; });
  }

  function forwardGeocode(q) {
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
    return fetch(url, { headers: { 'Accept-Language': 'es' } })
      .then(function (r) { return r.json(); })
      .then(function (arr) {
        if (!arr || !arr.length) return null;
        var it = arr[0];
        return { lat: parseFloat(it.lat), lon: parseFloat(it.lon), name: it.display_name.split(',')[0], region: it.display_name };
      });
  }

  // ---------- Weather (Open-Meteo) ----------
  function fetchWeather(lat, lon) {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7';
    return fetch(url).then(function (r) { return r.json(); });
  }

  // ---------- Panel UI ----------
  var els = {
    locName: document.getElementById('loc-name'),
    locCoords: document.getElementById('loc-coords'),
    loading: document.getElementById('weather-loading'),
    empty: document.getElementById('weather-empty'),
    content: document.getElementById('weather-content'),
    curEmoji: document.getElementById('current-emoji'),
    curTemp: document.getElementById('current-temp'),
    curDesc: document.getElementById('current-desc'),
    feels: document.getElementById('stat-feels'),
    hum: document.getElementById('stat-hum'),
    wind: document.getElementById('stat-wind'),
    mm: document.getElementById('stat-mm'),
    forecast: document.getElementById('forecast-list'),
    favBtn: document.getElementById('fav-btn'),
    favIcon: document.getElementById('fav-icon')
  };

  function renderWeather(loc, data) {
    var c = data.current || {};
    els.loading.hidden = true;
    var d = data.daily || {};
    var w = wmo(c.weather_code);
    els.locName.textContent = loc.name;
    els.locCoords.textContent = (loc.region ? loc.region + ' · ' : '') +
      loc.lat.toFixed(3) + ', ' + loc.lon.toFixed(3);
    els.curEmoji.textContent = w.e;
    els.curTemp.textContent = Math.round(c.temperature_2m);
    els.curDesc.textContent = w.d;
    els.feels.textContent = Math.round(c.apparent_temperature) + '°';
    els.hum.textContent = Math.round(c.relative_humidity_2m) + '%';
    els.wind.textContent = Math.round(c.wind_speed_10m) + ' km/h';
    var mx = d.temperature_2m_max ? Math.round(d.temperature_2m_max[0]) : '—';
    var mn = d.temperature_2m_min ? Math.round(d.temperature_2m_min[0]) : '—';
    els.mm.textContent = mx + '° / ' + mn + '°';

    // 7 días
    els.forecast.innerHTML = '';
    var days = (d.time || []);
    var globalMin = Math.min.apply(null, d.temperature_2m_min || [0]);
    var globalMax = Math.max.apply(null, d.temperature_2m_max || [1]);
    var range = Math.max(1, globalMax - globalMin);
    days.forEach(function (t, i) {
      var dt = new Date(t + 'T00:00');
      var dayName = i === 0 ? 'Hoy' : dt.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
      var mxi = d.temperature_2m_max[i];
      var mni = d.temperature_2m_min[i];
      var wi = wmo(d.weather_code[i]);
      var left = ((mni - globalMin) / range) * 100;
      var width = Math.max(6, ((mxi - mni) / range) * 100);
      var li = document.createElement('li');
      li.innerHTML =
        '<span class="f-day">' + dayName + '</span>' +
        '<span class="f-icon" title="' + wi.d + '">' + wi.e + '</span>' +
        '<span class="f-bar"><span class="f-bar-fill" style="left:' + left + '%;width:' + width + '%"></span></span>' +
        '<span class="f-temps">' + Math.round(mxi) + '° <span class="min">' + Math.round(mni) + '°</span></span>';
      els.forecast.appendChild(li);
    });

    els.empty.hidden = true;
    els.content.hidden = false;
    els.favBtn.disabled = false;
    updateFavIcon();
    setMarker(loc.lat, loc.lon, w.e);
  }

  function showLoading(v) {
    els.loading.hidden = !v;
    if (v) { els.empty.hidden = true; els.content.hidden = true; }
  }

  // ---------- Selección de ubicación ----------
  function selectLocation(lat, lon, presetName) {
    current = { lat: lat, lon: lon, name: presetName || 'Cargando…', region: '' };
    els.locName.textContent = current.name;
    els.locCoords.textContent = lat.toFixed(3) + ', ' + lon.toFixed(3);
    showLoading(true);

    map.flyTo([lat, lon], Math.max(map.getZoom(), 9), { duration: 0.8 });

    var geocodeP = presetName ? Promise.resolve({ name: presetName, region: '' }) : reverseGeocode(lat, lon);

    Promise.all([fetchWeather(lat, lon), geocodeP])
      .then(function (res) {
        var data = res[0];
        var geo = res[1] || { name: 'Ubicación (' + lat.toFixed(2) + ', ' + lon.toFixed(2) + ')', region: '' };
        current = { lat: lat, lon: lon, name: geo.name, region: geo.region };
        renderWeather(current, data);
        // Cachear última consulta para modo offline
        try {
          localStorage.setItem(LAST_KEY, JSON.stringify({ loc: current, data: data, ts: Date.now() }));
        } catch (e) {}
        showLoading(false);
      })
      .catch(function (err) {
        console.error(err);
        showLoading(false);
        toast('No se pudo obtener el clima. ¿Sin conexión?');
      });
  }

  // ---------- Búsqueda ----------
  var searchForm = document.getElementById('search-form');
  var searchInput = document.getElementById('search-input');
  var searchSpinner = document.getElementById('search-spinner');
  searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = searchInput.value.trim();
    if (!q) return;
    searchSpinner.hidden = false;
    forwardGeocode(q).then(function (r) {
      searchSpinner.hidden = true;
      if (!r) { toast('No se encontró "' + q + '".'); return; }
      selectLocation(r.lat, r.lon, r.name);
    }).catch(function () {
      searchSpinner.hidden = true;
      toast('Error al buscar. Revisa tu conexión.');
    });
  });

  // ---------- Favoritos ----------
  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; }
  }
  function setFavs(arr) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); } catch (e) {}
    renderFavs();
  }
  function favKey(f) { return f.lat.toFixed(3) + ',' + f.lon.toFixed(3); }
  function isFav(loc) {
    if (!loc) return false;
    var k = favKey(loc);
    return getFavs().some(function (f) { return favKey(f) === k; });
  }
  function toggleFav() {
    if (!current) return;
    var favs = getFavs();
    var k = favKey(current);
    var i = favs.findIndex(function (f) { return favKey(f) === k; });
    if (i >= 0) { favs.splice(i, 1); toast('Ubicación eliminada de favoritos.'); }
    else {
      favs.unshift({ lat: current.lat, lon: current.lon, name: current.name, region: current.region, emoji: els.curEmoji.textContent, temp: els.curTemp.textContent });
      toast('Ubicación guardada.');
    }
    setFavs(favs);
    updateFavIcon();
  }
  function updateFavIcon() {
    els.favIcon.textContent = isFav(current) ? '★' : '☆';
  }
  els.favBtn.addEventListener('click', toggleFav);

  function renderFavs() {
    var list = document.getElementById('fav-list');
    var empty = document.getElementById('fav-empty');
    var count = document.getElementById('fav-count');
    var favs = getFavs();
    count.textContent = favs.length;
    list.innerHTML = '';
    empty.hidden = favs.length > 0;
    favs.forEach(function (f, idx) {
      var li = document.createElement('li');
      li.innerHTML =
        '<span class="fav-emoji">' + (f.emoji || '📍') + '</span>' +
        '<span class="fav-name">' + f.name + '</span>' +
        '<span class="fav-temp">' + (f.temp ? f.temp + '°' : '') + '</span>' +
        '<button class="fav-remove" aria-label="Eliminar">✕</button>';
      li.addEventListener('click', function (e) {
        if (e.target.classList.contains('fav-remove')) {
          var arr = getFavs(); arr.splice(idx, 1); setFavs(arr); updateFavIcon();
          return;
        }
        selectLocation(f.lat, f.lon, f.name);
      });
      list.appendChild(li);
    });
  }
  renderFavs();

  // ---------- Restaurar última consulta ----------
  try {
    var last = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
    if (last && last.loc && last.data) {
      current = last.loc;
      renderWeather(last.loc, last.data);
      map.setView([last.loc.lat, last.loc.lon], 9);
    }
  } catch (e) {}
})();