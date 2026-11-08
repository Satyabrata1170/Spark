/* ==========================================================
   Spark – shared core
   Storage (localStorage), seed data, helpers, navbar, footer,
   modals, toasts, theme. Exposes everything on window.DA
   ========================================================== */
(function () {
  'use strict';

  const KEYS = {
    users: 'spark_users', bookings: 'spark_bookings', session: 'spark_session',
    settings: 'spark_settings', reports: 'spark_reports', likes: 'spark_likes',
    messages: 'spark_messages', seeded: 'spark_seeded_v1', center: 'spark_seed_center'
  };
  const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };
  const CATEGORIES = [
    { key: 'woman', label: 'Women' },
    { key: 'man', label: 'Men' },
    { key: 'young-woman', label: 'Young women (18–25)' },
    { key: 'young-man', label: 'Young men (18–25)' },
    { key: 'married-woman', label: 'Married women' },
    { key: 'single-mother', label: 'Single mothers' },
    { key: 'sugar-mummy', label: 'Sugar mummy' },
    { key: 'sugar-daddy', label: 'Sugar daddy' }
  ];
  const DEFAULT_SETTINGS = {
    theme: 'light', siteName: 'Spark', tagline: 'Meet people nearby', maintenance: false,
    notifEmail: true, notifPush: true, notifBookings: true, notifReports: true
  };

  /* ---------- tiny helpers ---------- */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('Storage full?', e); } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  const emit = n => window.dispatchEvent(new CustomEvent(n));
  const catLabel = k => (CATEGORIES.find(c => c.key === k) || { label: k }).label;

  /* ---------- geo ---------- */
  function distKm(a, b) {
    const R = 6371, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  /* Other people only ever see an APPROXIMATE position (±~180 m) */
  function approx(u) {
    const h = hash(u.id);
    return { lat: u.lat + ((h % 100) - 50) * 0.000035, lng: u.lng + (((h >> 3) % 100) - 50) * 0.000035 };
  }
  const seedCenter = () => LS.get(KEYS.center, DEFAULT_CENTER);

  /* ---------- dummy avatars (head + shoulders by gender) ---------- */
  const avCache = {};
  function avatarFor(gender, seed) {
    const key = gender + seed;
    if (avCache[key]) return avCache[key];
    const skins = ['#f6d3b3', '#e8b98a', '#c98f5f', '#9b6a43', '#f9e0c7'];
    const hairs = ['#2a1a14', '#4a2e1e', '#8a4b22', '#111827', '#6b3f2a'];
    const skin = skins[seed % 5], hair = hairs[(seed + 2) % 5];
    const bg = gender === 'female' ? ['#ffd6e7', '#ff9ec4'] : gender === 'male' ? ['#d4e6ff', '#8fb8ff'] : ['#e5dcff', '#b8a4ff'];
    const shirt = gender === 'female' ? '#ff4d8d' : gender === 'male' ? '#2f80ff' : '#7c5cff';
    let back = '', front = '';
    if (gender === 'female') {
      back = `<path d="M22 46c-4 22 2 40 10 46h36c8-6 14-24 10-46-3-20-14-30-28-30S25 26 22 46z" fill="${hair}"/>`;
      front = `<path d="M30 44c4-12 14-18 24-14 8 3 14 10 16 20-8-4-14-10-18-16-6 8-14 12-22 10z" fill="${hair}"/>`;
    } else if (gender === 'male') {
      front = `<path d="M29 46c-2-16 8-26 21-26s23 10 21 26c-4-8-8-12-12-14-10 4-20 4-30 14z" fill="${hair}"/>`;
    } else {
      front = `<path d="M29 44c0-14 9-24 21-24s21 10 21 24c-8-4-14-8-18-12-8 6-16 10-24 12z" fill="${hair}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/>${back}<path d="M18 100c2-18 16-26 32-26s30 8 32 26z" fill="${shirt}"/><rect x="43" y="62" width="14" height="14" rx="5" fill="${skin}"/><ellipse cx="50" cy="48" rx="19" ry="22" fill="${skin}"/>${front}<circle cx="43" cy="49" r="1.8" fill="#222"/><circle cx="57" cy="49" r="1.8" fill="#222"/><path d="M44 58q6 5 12 0" stroke="#b5483a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
    return (avCache[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }
  const avatar = u => (u && u.photo) || avatarFor(u ? u.gender : 'other', u ? hash(u.id) : 0);

  /* ---------- data layer ---------- */
  const getUsers = () => LS.get(KEYS.users, []);
  const saveUsers = a => LS.set(KEYS.users, a);
  const getUser = id => getUsers().find(u => u.id === id) || null;
  function updateUser(id, patch) {
    const all = getUsers(); const i = all.findIndex(u => u.id === id);
    if (i < 0) return null;
    all[i] = Object.assign(all[i], patch); saveUsers(all); return all[i];
  }
  const getBookings = () => LS.get(KEYS.bookings, []);
  const saveBookings = a => LS.set(KEYS.bookings, a);
  const getReports = () => LS.get(KEYS.reports, []);
  const saveReports = a => LS.set(KEYS.reports, a);
  const settings = () => Object.assign({}, DEFAULT_SETTINGS, LS.get(KEYS.settings, {}));
  const saveSettings = s => LS.set(KEYS.settings, s);

  const session = () => LS.get(KEYS.session, null);
  const setSession = s => LS.set(KEYS.session, s);
  function me() {
    const s = session(); if (!s) return null;
    if (s.role === 'admin') return { id: 'admin', role: 'admin', name: 'Administrator' };
    const u = getUser(s.id);
    if (!u || u.suspended) { LS.del(KEYS.session); return null; }
    return u;
  }
  function logout() {
    const m = me();
    if (m && m.role !== 'admin') updateUser(m.id, { online: false, status: 'unavailable' });
    LS.del(KEYS.session);
    window.location.href = 'index.html';
  }

  function mkUser(o) {
    return Object.assign({
      id: uid('u'), role: 'user', username: '', email: '', password: '', name: '', age: null, gender: null,
      categories: [], city: '', bio: '', interests: [], photo: null, lat: null, lng: null,
      status: 'unavailable', online: false, shareLocation: false, locAsked: false, profileComplete: false,
      suspended: false, verified: false, dummy: false, joined: new Date().toISOString(), bookingPrefs: null
    }, o);
  }

  function seedData() {
    if (LS.get(KEYS.seeded, false)) return;
    const c = DEFAULT_CENTER, now = Date.now(), day = 86400000;
    const base = [
      ['Aanya', 'female', 24, [], 'Coffee, sketching and sunrise walks.', ['art', 'coffee', 'walks']],
      ['Rohan', 'male', 29, [], 'Weekend cyclist and amateur chef.', ['cycling', 'cooking']],
      ['Meera', 'female', 34, ['single-mother'], 'Mum of one, loves live music and quiet cafés.', ['music', 'cafés']],
      ['Kabir', 'male', 31, [], 'Product designer. Dog person. Bad at chess.', ['design', 'dogs', 'chess']],
      ['Isha', 'female', 23, [], 'Student, bookworm, always up for a bookshop crawl.', ['books', 'travel']],
      ['Arjun', 'male', 27, [], 'Photographer chasing golden hour.', ['photography', 'hiking']],
      ['Naina', 'female', 41, ['married-woman'], 'Open to new friendships and good conversation.', ['wine', 'theatre']],
      ['Vikram', 'male', 49, ['sugar-daddy'], 'Entrepreneur who enjoys fine dining and travel.', ['travel', 'golf']],
      ['Priya', 'female', 36, ['single-mother'], 'Yoga teacher. Slow mornings, big laughs.', ['yoga', 'food']],
      ['Dev', 'male', 26, [], 'Musician, plays guitar at open mics.', ['music', 'film']],
      ['Sara', 'female', 45, ['sugar-mummy'], 'Founder, loves art galleries and sailing.', ['art', 'sailing']],
      ['Neil', 'male', 33, [], 'Runner, reader, builder of tiny robots.', ['running', 'robots']],
      ['Tara', 'female', 44, ['sugar-mummy'], 'Fashion consultant. Elegant dinners over small talk.', ['fashion', 'dining']],
      ['Ayaan', 'male', 22, [], 'Gamer by night, football by day.', ['gaming', 'football']]
    ];
    const users = base.map((b, i) => {
      const ang = i * 0.9 + 0.3, rad = 0.004 + i * 0.0022;
      return mkUser({
        id: 'd' + (i + 1), dummy: true, name: b[0], username: b[0].toLowerCase() + (i + 1),
        email: b[0].toLowerCase() + (i + 1) + '@example.com', password: 'demo123', gender: b[1], age: b[2],
        categories: b[3], bio: b[4], interests: b[5], city: 'Bengaluru',
        lat: c.lat + Math.sin(ang) * rad, lng: c.lng + Math.cos(ang) * rad * 1.1,
        status: i % 4 === 3 ? 'unavailable' : 'available', online: i % 5 !== 4, shareLocation: true,
        locAsked: true, profileComplete: true, verified: i % 2 === 0,
        joined: new Date(now - (i % 9) * day * 1.5 - 3600000).toISOString()
      });
    });
    users.push(mkUser({
      id: 'u_demo', name: 'Demo User', username: 'demo', email: 'demo@spark.app', password: 'demo123', gender: 'male', age: 30,
      bio: 'Demo account – try everything!', interests: ['demo', 'testing'], city: 'Bengaluru',
      lat: c.lat + 0.0015, lng: c.lng - 0.0012, status: 'available', online: true, shareLocation: true,
      locAsked: true, profileComplete: true, verified: true, joined: new Date(now - 2 * day).toISOString()
    }));
    saveUsers(users);
    const d = (n) => new Date(now + n * day).toISOString().slice(0, 10);
    saveBookings([
      { id: 'b1', fromId: 'd1', toId: 'u_demo', date: d(2), time: '18:30', duration: 60, type: 'Coffee', note: 'Hi! Coffee near MG Road?', status: 'pending', created: now - day },
      { id: 'b2', fromId: 'd6', toId: 'd3', date: d(1), time: '19:00', duration: 90, type: 'Dinner', note: '', status: 'confirmed', created: now - 2 * day },
      { id: 'b3', fromId: 'd2', toId: 'd5', date: d(-3), time: '11:00', duration: 60, type: 'Walk', note: '', status: 'completed', created: now - 6 * day },
      { id: 'b4', fromId: 'd10', toId: 'd9', date: d(4), time: '17:00', duration: 45, type: 'Video call', note: '', status: 'pending', created: now - 3600000 },
      { id: 'b5', fromId: 'd12', toId: 'd1', date: d(-6), time: '16:00', duration: 60, type: 'Coffee', note: '', status: 'completed', created: now - 9 * day },
      { id: 'b6', fromId: 'd4', toId: 'd7', date: d(3), time: '20:00', duration: 120, type: 'Event', note: 'Gallery opening', status: 'confirmed', created: now - 5 * day }
    ]);
    saveReports([
      { id: 'r1', reporterId: 'd1', targetId: 'd8', reason: 'Inappropriate message', status: 'open', created: now - 3600000 * 5 },
      { id: 'r2', reporterId: 'd9', targetId: 'd12', reason: 'Fake profile photo', status: 'open', created: now - day },
      { id: 'r3', reporterId: 'd5', targetId: 'd2', reason: 'Spam', status: 'resolved', created: now - 4 * day }
    ]);
    LS.set(KEYS.center, c);
    LS.set(KEYS.seeded, true);
  }

  /* After a real user shares location far from the demo city, move the dummy
     people next to them so the map is never empty. */
  function relocateDummies(lat, lng) {
    const sc = seedCenter();
    if (distKm(sc, { lat, lng }) < 15) return;
    const dLat = lat - sc.lat, dLng = lng - sc.lng;
    const users = getUsers();
    users.forEach(u => { if (u.dummy && u.lat != null) { u.lat += dLat; u.lng += dLng; } });
    saveUsers(users);
    LS.set(KEYS.center, { lat, lng });
  }

  function resetDemoData() {
    Object.values(KEYS).forEach(k => { if (k !== KEYS.settings) LS.del(k); });
    seedData();
  }

  /* ---------- categories & visibility ---------- */
  function catsOf(u) {
    const s = new Set(u.categories || []);
    if (u.gender === 'female') { s.add('woman'); if (u.age <= 25) s.add('young-woman'); }
    if (u.gender === 'male') { s.add('man'); if (u.age <= 25) s.add('young-man'); }
    return [...s];
  }
  function matches(u, p) {
    const c = catsOf(u);
    if (p.hide && p.hide.some(k => c.includes(k))) return false;
    if (p.show && p.show.length && !p.show.some(k => c.includes(k))) return false;
    if (p.minAge && u.age < p.minAge) return false;
    if (p.maxAge && u.age > p.maxAge) return false;
    return true;
  }
  const visibleUsers = () => getUsers().filter(u =>
    u.role !== 'admin' && !u.suspended && u.profileComplete && u.status === 'available' && u.shareLocation && u.lat != null);

  /* ---------- UI: logo / toasts / modals ---------- */
  const LOGO = `<svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d8d"/><stop offset="1" stop-color="#ff9a44"/></linearGradient></defs><path class="logo-pin" d="M24 4C14.6 4 7 11.3 7 20.3c0 11.6 15.2 22.6 16.1 23.3.5.4 1.3.4 1.8 0C25.8 42.9 41 31.9 41 20.3 41 11.3 33.4 4 24 4z" fill="url(#lg)"/><path class="logo-heart" d="M24 28.5c-5.5-3.7-8.5-6.6-8.5-10 0-2.6 2-4.5 4.4-4.5 1.6 0 3.2.9 4.1 2.3.9-1.4 2.5-2.3 4.1-2.3 2.4 0 4.4 1.9 4.4 4.5 0 3.4-3 6.3-8.5 10z" fill="#fff"/></svg>`;

  function toast(msg, type) {
    let w = document.getElementById('toasts');
    if (!w) { w = document.createElement('div'); w.id = 'toasts'; w.className = 'toast-wrap'; document.body.appendChild(w); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok'); t.textContent = msg; w.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 3200);
  }
  function openModal(name, opts) {
    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    const m = document.getElementById(name + 'Modal'); if (!m) return;
    m.dataset.lock = opts && opts.lock ? '1' : '';
    m.classList.add('open'); document.body.classList.add('no-scroll');
    const f = m.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),textarea,select');
    if (f) setTimeout(() => f.focus(), 60);
  }
  function closeModal(name) {
    const list = name ? [document.getElementById(name + 'Modal')] : [...document.querySelectorAll('.modal.open')];
    list.forEach(m => m && m.classList.remove('open'));
    if (!document.querySelector('.modal.open')) document.body.classList.remove('no-scroll');
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings().theme === 'dark' ? 'dark' : 'light');
  }
  function ensureBackground() {
    if (document.querySelector('.bg-anim')) return;
    const b = document.createElement('div'); b.className = 'bg-anim'; b.innerHTML = '<span></span><span></span><span></span>';
    document.body.prepend(b);
  }

  function modalsHtml() {
    return `
<div class="modal" id="loginModal" role="dialog" aria-modal="true" aria-label="Login"><div class="modal-card">
  <button class="modal-x" data-close aria-label="Close">×</button>
  <div class="modal-logo">${LOGO}</div>
  <h2 class="center">Welcome back</h2><p class="muted center">Log in to see who's around you.</p>
  <form id="loginForm" novalidate>
    <label>Email or username<input name="username" autocomplete="username" required></label>
    <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
    <p class="form-error" id="loginError" role="alert"></p>
    <button class="btn btn-primary btn-block" type="submit">Login</button>
  </form>
  <p class="muted center" style="margin-top:14px">New here? <a href="#" data-open="signup">Create an account</a></p>
  <p class="hint">Demo member: <code>demo</code> / <code>demo123</code></p>
</div></div>

<div class="modal" id="signupModal" role="dialog" aria-modal="true" aria-label="Sign up"><div class="modal-card">
  <button class="modal-x" data-close aria-label="Close">×</button>
  <div class="modal-logo">${LOGO}</div>
  <h2 class="center">Join Spark</h2><p class="muted center">Takes less than a minute.</p>
  <form id="signupForm" novalidate>
    <label>Full name<input name="name" autocomplete="name" required></label>
    <div class="two">
      <label>Username<input name="username" autocomplete="username" required></label>
      <label>Email<input type="email" name="email" autocomplete="email" required></label>
    </div>
    <div class="two">
      <label>Password<input type="password" name="password" autocomplete="new-password" required></label>
      <label>Confirm<input type="password" name="confirm" autocomplete="new-password" required></label>
    </div>
    <label class="check"><input type="checkbox" name="adult" required><span>I am <b>18 or older</b> and agree to the <a href="privacy.html" target="_blank">Privacy Policy</a>.</span></label>
    <p class="form-error" id="signupError" role="alert"></p>
    <button class="btn btn-primary btn-block" type="submit">Create account</button>
  </form>
  <p class="muted center" style="margin-top:14px">Already a member? <a href="#" data-open="login">Login</a></p>
</div></div>

<div class="modal" id="onboardModal" role="dialog" aria-modal="true" aria-label="Complete your profile"><div class="modal-card wide">
  <h2>Tell us about you</h2><p class="muted">This info builds your profile and is saved to the app database.</p>
  <form id="onboardForm" novalidate>
    <div class="label-like">I am a…</div>
    <div class="opt-row">
      <label class="opt"><input type="radio" name="gender" value="female"><span><b>♀</b>Woman</span></label>
      <label class="opt"><input type="radio" name="gender" value="male"><span><b>♂</b>Man</span></label>
      <label class="opt"><input type="radio" name="gender" value="other"><span><b>⚧</b>Other</span></label>
    </div>
    <div class="two">
      <label>Age (18+)<input type="number" name="age" min="18" max="99" required></label>
      <label>City<input name="city" placeholder="e.g. Bengaluru" required></label>
    </div>
    <label>About you<textarea name="bio" rows="3" maxlength="240" placeholder="A few words about you…"></textarea></label>
    <label>Interests <small>(comma separated)</small><input name="interests" placeholder="music, travel, coffee"></label>
    <div class="label-like">I describe myself as <small class="muted">(optional)</small></div>
    <div class="chips" id="selfChips"></div>
    <p class="form-error" id="onboardError" role="alert"></p>
    <button class="btn btn-primary btn-block" type="submit">Save &amp; continue</button>
  </form>
</div></div>

<div class="modal" id="locationModal" role="dialog" aria-modal="true" aria-label="Enable location"><div class="modal-card center">
  <button class="modal-x" data-close aria-label="Close">×</button>
  <div class="loc-art">📍</div>
  <h2>Enable your location?</h2>
  <p class="muted">Spark uses your location to show people around you on the map. While you are <b>Available</b>, others in your area see an <b>approximate</b> position (not your exact spot). Switch to <b>Unavailable</b> anytime to disappear.</p>
  <div class="loc-actions">
    <button class="btn btn-primary btn-block" id="locAllow">Enable location</button>
    <div id="locCityBox" hidden>
      <label style="text-align:left">Or choose a city<select id="locCity"></select></label>
      <button class="btn btn-ghost btn-block" id="locCityBtn">Use this city</button>
    </div>
    <button class="btn btn-ghost btn-block" id="locNo">Not now</button>
  </div>
  <p class="hint">You stay in control – change this anytime in your profile.</p>
</div></div>`;
  }

  /* ---------- header & footer ---------- */
  const statusLabel = s => s === 'available' ? 'Available' : 'Unavailable';
  function renderHeader() {
    const host = document.getElementById('site-header'); if (!host) return;
    const st = settings(), m = me();
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const links = [['index.html', 'Home'], ['discover.html', 'Discover'], ['booking.html', 'Booking'], ['about.html', 'About'], ['contact.html', 'Contact']]
      .map(([h, t]) => `<li><a href="${h}" class="${page === h ? 'active' : ''}">${t}</a></li>`).join('');
    let right;
    if (!m) {
      right = `<button class="btn btn-ghost" data-open="login">Login</button><button class="btn btn-primary" data-open="signup">Sign Up</button>`;
    } else if (m.role === 'admin') {
      right = `<div class="dropdown"><button class="avatar-btn" data-dd aria-label="Account menu"><span class="avatar-letter">A</span></button>
        <div class="dd-menu right"><div class="dd-head"><strong>Administrator</strong></div><button data-logout>🚪 Logout</button></div></div>`;
    } else {
      right = `
      <div class="dropdown"><button class="status-btn" data-dd aria-label="Set availability"><span class="dot ${m.status}"></span><span>${statusLabel(m.status)}</span><span class="caret">▾</span></button>
        <div class="dd-menu right">
          <button data-set-status="available"><span class="dot available"></span> Available</button>
          <button data-set-status="unavailable"><span class="dot unavailable"></span> Unavailable</button>
        </div></div>
      <div class="dropdown"><button class="avatar-btn" data-dd aria-label="Account menu"><img src="${avatar(m)}" alt="Your profile"><span class="dot-badge ${m.status}"></span></button>
        <div class="dd-menu right">
          <div class="dd-head"><strong>${esc(m.name)}</strong><br><span class="muted tiny">${esc(m.email)}</span></div>
          <a href="profile.html">👤 My Profile</a><a href="booking.html">📅 My Bookings</a><a href="discover.html">🔥 Discover</a>
          <button data-logout>🚪 Logout</button>
        </div></div>`;
    }
    host.innerHTML = (st.maintenance && (!m || m.role !== 'admin') ? '<div class="maint">Scheduled maintenance – some features may be slow.</div>' : '') +
      `<nav class="nav" aria-label="Main">
        <a class="brand" href="index.html">${LOGO}<span>${esc(st.siteName)}</span></a>
        <button class="burger" id="burger" aria-label="Menu" aria-expanded="false">☰</button>
        <ul class="nav-links" id="navLinks">${links}</ul>
        <div class="nav-right">${right}</div>
      </nav>`;
  }
  function renderFooter() {
    const host = document.getElementById('site-footer'); if (!host) return;
    const st = settings();
    host.className = 'site-footer';
    host.innerHTML = `<div class="container"><div class="foot-grid">
      <div><a class="brand" href="index.html">${LOGO}<span>${esc(st.siteName)}</span></a><p class="muted" style="margin-top:10px">${esc(st.tagline)}. A location-aware dating &amp; meetup demo built with HTML5, CSS3 and vanilla JavaScript.</p></div>
      <div><h4>Explore</h4><ul><li><a href="index.html">Live map</a></li><li><a href="discover.html">Discover</a></li><li><a href="booking.html">Book a session</a></li></ul></div>
      <div><h4>Company</h4><ul><li><a href="about.html">About us</a></li><li><a href="contact.html">Contact</a></li><li><a href="privacy.html">Privacy policy</a></li></ul></div>
      <div><h4>Stay safe</h4><p class="muted tiny">18+ only. Meet in public places, tell a friend where you're going and never send money to someone you haven't met.</p></div>
    </div><div class="foot-bottom"><span>© ${new Date().getFullYear()} ${esc(st.siteName)}. All rights reserved.</span><span>Made with ♥ for real-world connections</span></div></div>`;
  }

  function setStatus(s) {
    const m = me(); if (!m || m.role === 'admin') return;
    updateUser(m.id, { status: s, online: true });
    renderHeader();
    toast(s === 'available' ? "You're Available – nearby people can see you." : "You're Unavailable – you're hidden from the map.");
    if (s === 'available' && (m.lat == null || !m.shareLocation)) setTimeout(() => openModal('location'), 400);
    emit('spark:status');
  }

  function requireUser() {
    const m = me();
    const ok = m && m.role !== 'admin';
    document.querySelectorAll('[data-gate]').forEach(e => e.hidden = !!ok);
    document.querySelectorAll('[data-app]').forEach(e => e.hidden = !ok);
    return ok ? m : null;
  }

  /* ---------- global events ---------- */
  function bindGlobal() {
    document.addEventListener('click', e => {
      const t = e.target;
      const op = t.closest('[data-open]');
      if (op) { e.preventDefault(); openModal(op.dataset.open); return; }
      if (t.closest('[data-close]')) { closeModal(); return; }
      if (t.classList && t.classList.contains('modal') && t.dataset.lock !== '1') { closeModal(); return; }
      const dd = t.closest('[data-dd]');
      if (dd) { const p = dd.parentElement, was = p.classList.contains('open'); document.querySelectorAll('.dropdown.open').forEach(x => x.classList.remove('open')); if (!was) p.classList.add('open'); return; }
      const ss = t.closest('[data-set-status]');
      if (ss) { setStatus(ss.dataset.setStatus); }
      if (t.closest('[data-logout]')) { logout(); return; }
      if (t.closest('#burger')) { const l = document.getElementById('navLinks'); const o = l.classList.toggle('open'); t.closest('#burger').setAttribute('aria-expanded', o); return; }
      document.querySelectorAll('.dropdown.open').forEach(x => x.classList.remove('open'));
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { const m = document.querySelector('.modal.open'); if (m && m.dataset.lock !== '1') closeModal(); }
    });
    window.addEventListener('storage', e => {
      if (e.key === KEYS.settings) applyTheme();
      if (e.key === KEYS.session || e.key === KEYS.users) renderHeader();
    });
  }

  function revealOnScroll() {
    const els = document.querySelectorAll('.reveal'); if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12 });
    els.forEach(e => io.observe(e));
  }

  /* contact form (any page that has it) */
  function bindContact() {
    const f = document.getElementById('contactForm'); if (!f) return;
    f.addEventListener('submit', e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f).entries());
      if (!d.name.trim() || !/^\S+@\S+\.\S+$/.test(d.email) || d.message.trim().length < 10) { toast('Please fill all fields (message ≥ 10 characters).', 'err'); return; }
      const all = LS.get(KEYS.messages, []);
      all.unshift({ id: uid('m'), name: d.name.trim(), email: d.email.trim(), subject: d.subject, message: d.message.trim(), created: Date.now() });
      LS.set(KEYS.messages, all); f.reset(); toast('Message sent – we will get back to you soon!');
    });
  }

  /* ---------- init ---------- */
  function init() {
    seedData();
    applyTheme();
    ensureBackground();
    const header = document.getElementById('site-header'); if (header) header.classList.add('site-header');
    if (document.body.dataset.page !== 'admin') {
      const wrap = document.createElement('div'); wrap.innerHTML = modalsHtml();
      while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    }
    renderHeader(); renderFooter(); bindGlobal(); bindContact(); revealOnScroll();
  }

  window.DA = {
    KEYS, CATEGORIES, DEFAULT_CENTER, DEFAULT_SETTINGS, LS, uid, esc, hash, emit, catLabel,
    distKm, approx, seedCenter, avatar, avatarFor, LOGO,
    users: getUsers, saveUsers, getUser, updateUser, mkUser,
    bookings: getBookings, saveBookings, reports: getReports, saveReports,
    settings, saveSettings, session, setSession, me, logout, relocateDummies, resetDemoData,
    catsOf, matches, visibleUsers, toast, openModal, closeModal, applyTheme,
    renderHeader, renderFooter, setStatus, requireUser, statusLabel
  };
  init();
})();
