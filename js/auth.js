/* ==========================================================
   Spark – authentication, onboarding and location popup
   Everything is simulated with localStorage (no backend).
   !! Demo only: passwords are stored in plain text and the
   !! admin/admin check happens in the browser. Replace with real
   !! server-side authentication before going live.
   ========================================================== */
(function () {
  'use strict';
  const DA = window.DA;
  const $ = id => document.getElementById(id);

  const CITIES = [
    ['Bengaluru', 12.9716, 77.5946], ['Mumbai', 19.0760, 72.8777], ['Delhi', 28.6139, 77.2090],
    ['Hyderabad', 17.3850, 78.4867], ['Chennai', 13.0827, 80.2707], ['Kolkata', 22.5726, 88.3639],
    ['London', 51.5072, -0.1276], ['New York', 40.7128, -74.0060], ['Dubai', 25.2048, 55.2708], ['Sydney', -33.8688, 151.2093]
  ];

  /* ---------- LOGIN (same form for members and admin) ---------- */
  const loginForm = $('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      const err = $('loginError'); err.textContent = '';
      const username = loginForm.username.value.trim();
      const password = loginForm.password.value;
      if (!username || !password) { err.textContent = 'Please enter your username/email and password.'; return; }

      if (username === 'admin' && password === 'admin') {
        DA.setSession({ id: 'admin', role: 'admin' });
        window.location.href = 'admin.html';
        return;
      }
      const q = username.toLowerCase();
      const user = DA.users().find(u => u.role !== 'admin' && (u.email.toLowerCase() === q || u.username.toLowerCase() === q));
      if (!user || user.password !== password) { err.textContent = 'Incorrect username/email or password.'; return; }
      if (user.suspended) { err.textContent = 'This account has been suspended. Please contact support.'; return; }
      DA.updateUser(user.id, { online: true });
      DA.setSession({ id: user.id, role: 'user' });
      window.location.href = 'index.html';
    });
  }

  /* ---------- SIGN UP ---------- */
  const signupForm = $('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', e => {
      e.preventDefault();
      const err = $('signupError'); err.textContent = '';
      const f = signupForm;
      const name = f.name.value.trim(), username = f.username.value.trim(), email = f.email.value.trim().toLowerCase();
      const pw = f.password.value;
      if (name.length < 2) { err.textContent = 'Please enter your full name.'; return; }
      if (!/^[A-Za-z0-9_.]{3,20}$/.test(username)) { err.textContent = 'Username: 3–20 letters, numbers, dots or underscores.'; return; }
      if (username.toLowerCase() === 'admin') { err.textContent = 'That username is reserved.'; return; }
      if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Please enter a valid email address.'; return; }
      if (pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
      if (pw !== f.confirm.value) { err.textContent = 'Passwords do not match.'; return; }
      if (!f.adult.checked) { err.textContent = 'You must be 18 or older to join.'; return; }
      const all = DA.users();
      if (all.some(u => u.email.toLowerCase() === email)) { err.textContent = 'An account with this email already exists.'; return; }
      if (all.some(u => u.username.toLowerCase() === username.toLowerCase())) { err.textContent = 'That username is taken.'; return; }

      const u = DA.mkUser({ name, username, email, password: pw, online: true, status: 'unavailable' });
      all.push(u); DA.saveUsers(all);
      DA.setSession({ id: u.id, role: 'user' });
      f.reset(); DA.renderHeader();
      DA.toast('Welcome to Spark, ' + name.split(' ')[0] + '!');
      DA.openModal('onboard', { lock: true });
    });
  }

  /* ---------- ONBOARDING: gender + more details -> "database" ---------- */
  const onboardForm = $('onboardForm');
  const SELF_TAGS = ['married-woman', 'single-mother', 'sugar-mummy', 'sugar-daddy'];
  if (onboardForm) {
    const chips = $('selfChips');
    chips.innerHTML = SELF_TAGS.map(k => `<span class="chip" data-self="${k}" role="button" tabindex="0">${DA.esc(DA.catLabel(k))}</span>`).join('');
    chips.addEventListener('click', e => { const c = e.target.closest('[data-self]'); if (c) c.classList.toggle('on'); });
    chips.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const c = e.target.closest('[data-self]'); if (c) { e.preventDefault(); c.classList.toggle('on'); } } });

    onboardForm.addEventListener('submit', e => {
      e.preventDefault();
      const err = $('onboardError'); err.textContent = '';
      const m = DA.me(); if (!m || m.role === 'admin') return;
      const f = onboardForm;
      const gender = (f.querySelector('input[name=gender]:checked') || {}).value;
      const age = parseInt(f.age.value, 10), city = f.city.value.trim();
      if (!gender) { err.textContent = 'Please choose your gender.'; return; }
      if (!(age >= 18 && age <= 99)) { err.textContent = 'You must be 18 or older (age 18–99).'; return; }
      if (!city) { err.textContent = 'Please enter your city.'; return; }
      DA.updateUser(m.id, {
        gender, age, city, bio: f.bio.value.trim().slice(0, 240),
        interests: f.interests.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8),
        categories: [...chips.querySelectorAll('.chip.on')].map(c => c.dataset.self),
        profileComplete: true
      });
      DA.closeModal(); DA.renderHeader(); DA.emit('spark:profile');
      DA.toast('Profile saved!');
      setTimeout(() => DA.openModal('location'), 350);
    });
  }

  /* ---------- LOCATION popup (Uber-style) ---------- */
  const citySel = $('locCity');
  if (citySel) {
    citySel.innerHTML = CITIES.map((c, i) => `<option value="${i}">${c[0]}</option>`).join('');
    const finish = (lat, lng, msg) => {
      const m = DA.me(); if (!m || m.role === 'admin') return;
      DA.updateUser(m.id, { lat, lng, shareLocation: true, locAsked: true });
      DA.relocateDummies(lat, lng);
      DA.closeModal(); DA.toast(msg || 'Location enabled.');
      DA.emit('spark:location');
    };
    $('locAllow').addEventListener('click', () => {
      if (!navigator.geolocation) { $('locCityBox').hidden = false; DA.toast('Geolocation is not supported – pick a city instead.', 'err'); return; }
      $('locAllow').textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition(
        p => { $('locAllow').textContent = 'Enable location'; finish(p.coords.latitude, p.coords.longitude, 'Location enabled – you can now appear on the map.'); },
        () => { $('locAllow').textContent = 'Try again'; $('locCityBox').hidden = false; DA.toast('Could not read your location. Choose a city instead.', 'err'); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
    $('locCityBtn').addEventListener('click', () => {
      const c = CITIES[+citySel.value]; finish(c[1], c[2], 'Using ' + c[0] + ' as your location.');
    });
    $('locNo').addEventListener('click', () => {
      const m = DA.me(); if (m && m.role !== 'admin') DA.updateUser(m.id, { locAsked: true });
      DA.closeModal(); DA.toast('You can enable location later from the map or your profile.');
    });
  }

  /* ---------- on every page load: finish incomplete profile / ask location ---------- */
  const m = DA.me();
  if (m && m.role !== 'admin') {
    if (!m.profileComplete) DA.openModal('onboard', { lock: true });
    else if (!m.locAsked) setTimeout(() => DA.openModal('location'), 600);
  }

  DA.CITIES = CITIES;
})();
