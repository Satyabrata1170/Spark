/* ==========================================================
   Spark – vanilla JS slippy map (no libraries, no API key)
   Uses OpenStreetMap raster tiles. Also contains the
   home-page map logic and the Discover page logic.
   To use Google Maps instead, see README.md.
   ========================================================== */
(function () {
  'use strict';
  const DA = window.DA, esc = DA.esc, TILE = 256;

  /* ---------- MiniMap ---------- */
  class MiniMap {
    constructor(el, opts) {
      opts = opts || {};
      this.el = el; this.center = opts.center || DA.DEFAULT_CENTER; this.zoom = opts.zoom || 14; this.dark = !!opts.dark;
      el.classList.add('mm');
      el.classList.toggle('mm-dark', this.dark);
      el.innerHTML = '<div class="mm-tiles"></div><div class="mm-markers"></div><div class="mm-attr">© OpenStreetMap contributors</div>';
      this.tilesEl = el.querySelector('.mm-tiles'); this.markersEl = el.querySelector('.mm-markers');
      this.tiles = new Map(); this.markers = []; this.meMarker = null; this.raf = 0;
      this.onMapClick = null;
      this.bind();
      if ('ResizeObserver' in window) new ResizeObserver(() => this.render()).observe(el);
      this.render();
    }
    size() { return { w: this.el.clientWidth, h: this.el.clientHeight }; }
    worldPx(lat, lng, z) {
      z = z == null ? this.zoom : z;
      const s = TILE * Math.pow(2, z), r = lat * Math.PI / 180;
      return { x: (lng + 180) / 360 * s, y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * s };
    }
    latLng(x, y) {
      const s = TILE * Math.pow(2, this.zoom), n = Math.PI - 2 * Math.PI * y / s;
      return { lat: 180 / Math.PI * Math.atan(.5 * (Math.exp(n) - Math.exp(-n))), lng: x / s * 360 - 180 };
    }
    toScreen(lat, lng) {
      const c = this.worldPx(this.center.lat, this.center.lng), p = this.worldPx(lat, lng), s = this.size();
      return { x: p.x - c.x + s.w / 2, y: p.y - c.y + s.h / 2 };
    }
    tileUrl(z, x, y) {
      return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    }
    setDark(d) {
      if (this.dark === d) return;
      this.dark = d;
      this.el.classList.toggle('mm-dark', d);
    }
    schedule() { if (this.raf) return; this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); }); }
    render() {
      const s = this.size(); if (!s.w || !s.h) return;
      const z = this.zoom, n = Math.pow(2, z), c = this.worldPx(this.center.lat, this.center.lng);
      const x0 = Math.floor((c.x - s.w / 2) / TILE), x1 = Math.floor((c.x + s.w / 2) / TILE);
      const y0 = Math.floor((c.y - s.h / 2) / TILE), y1 = Math.floor((c.y + s.h / 2) / TILE);
      const need = new Set();
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        if (y < 0 || y >= n) continue;
        const key = z + '/' + x + '/' + y; need.add(key);
        let img = this.tiles.get(key);
        if (!img) {
          img = document.createElement('img'); img.className = 'mm-tile'; img.alt = ''; img.draggable = false;
          img.onerror = () => { img.style.visibility = 'hidden'; };
          img.src = this.tileUrl(z, ((x % n) + n) % n, y);
          this.tilesEl.appendChild(img); this.tiles.set(key, img);
        }
        img.style.transform = `translate(${Math.round(x * TILE - c.x + s.w / 2)}px,${Math.round(y * TILE - c.y + s.h / 2)}px)`;
      }
      this.tiles.forEach((img, k) => { if (!need.has(k)) { img.remove(); this.tiles.delete(k); } });
      this.place();
    }
    place() {
      const put = m => { const p = this.toScreen(m.lat, m.lng); m.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`; };
      this.markers.forEach(put); if (this.meMarker) put(this.meMarker);
    }
    setMarkers(items) {
      const old = new Map(this.markers.map(m => [m.id, m]));
      const next = items.map(it => {
        let m = old.get(it.id);
        if (m && m.html === it.html) { m.lat = it.lat; m.lng = it.lng; m.onClick = it.onClick; old.delete(it.id); return m; }
        const el = document.createElement('button');
        el.type = 'button'; el.className = 'marker'; el.setAttribute('aria-label', 'Profile marker');
        el.innerHTML = '<div class="marker-body">' + it.html + '</div>';
        el.addEventListener('click', ev => { ev.stopPropagation(); if (m.onClick) m.onClick(); });
        m = { id: it.id, lat: it.lat, lng: it.lng, html: it.html, onClick: it.onClick, el };
        this.markersEl.appendChild(el); return m;
      });
      old.forEach(m => m.el.remove());
      this.markers = next; this.place();
    }
    setMe(pos, hidden) {
      if (!pos) { if (this.meMarker) { this.meMarker.el.remove(); this.meMarker = null; } return; }
      if (!this.meMarker) {
        const el = document.createElement('div'); el.className = 'marker me-marker'; el.style.pointerEvents = 'none';
        el.innerHTML = '<div class="marker-body"><div class="me-dot"></div></div>'; this.markersEl.appendChild(el);
        this.meMarker = { el, lat: 0, lng: 0 };
      }
      this.meMarker.lat = pos.lat; this.meMarker.lng = pos.lng;
      this.meMarker.el.classList.toggle('hidden-me', !!hidden); this.place();
    }
    setView(lat, lng, z) {
      this.center = { lat, lng }; if (z != null) this.setZoomOnly(z); this.render();
    }
    setZoomOnly(z) { z = Math.max(3, Math.min(18, z)); if (z !== this.zoom) { this.zoom = z; this.tiles.forEach(i => i.remove()); this.tiles.clear(); } }
    zoomBy(d) { this.setZoomOnly(this.zoom + d); this.render(); }
    bind() {
      const el = this.el; let down = null, moved = false;
      el.addEventListener('pointerdown', e => {
        if (e.target.closest('.marker') || e.target.closest('.panel,.hero-card,.user-card,.map-ctrl')) return;
        down = { x: e.clientX, y: e.clientY, c: this.worldPx(this.center.lat, this.center.lng), id: e.pointerId }; moved = false;
        try { el.setPointerCapture(e.pointerId); } catch (x) {} el.classList.add('drag');
      });
      el.addEventListener('pointermove', e => {
        if (!down || e.pointerId !== down.id) return;
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        this.center = this.latLng(down.c.x - dx, down.c.y - dy); this.schedule();
      });
      const up = e => {
        if (!down) return; el.classList.remove('drag');
        if (!moved && this.onMapClick) this.onMapClick(); down = null;
      };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      let wl = 0;
      el.addEventListener('wheel', e => {
        e.preventDefault(); const now = Date.now(); if (now - wl < 140) return; wl = now; this.zoomBy(e.deltaY < 0 ? 1 : -1);
      }, { passive: false });
      el.addEventListener('dblclick', e => { if (!e.target.closest('.marker,.panel,.hero-card,.user-card,.map-ctrl')) this.zoomBy(1); });
    }
  }
  window.MiniMap = MiniMap;

  /* ---------- shared helpers ---------- */
  const pinHtml = (u, locked) =>
    `<div class="pin ${esc(u.gender)}${locked ? ' locked' : ''}"><img src="${DA.avatar(u)}" alt=""><i class="sdot"></i></div>` +
    `<span class="ptip">${locked ? 'Log in to view' : esc(u.name) + ', ' + u.age}</span>`;
  const distText = km => km < 1 ? Math.max(50, Math.round(km * 1000 / 50) * 50) + ' m' : km.toFixed(1) + ' km';
  const userOrigin = m => (m && m.role !== 'admin' && m.lat != null) ? { lat: m.lat, lng: m.lng } : null;
  const currentUser = () => { const m = DA.me(); return m && m.role !== 'admin' ? m : null; };
  const likes = () => DA.LS.get(DA.KEYS.likes, {});
  function toggleLike(meId, otherId) {
    const l = likes(); const a = l[meId] || []; const i = a.indexOf(otherId);
    if (i >= 0) a.splice(i, 1); else a.push(otherId);
    l[meId] = a; DA.LS.set(DA.KEYS.likes, l); return i < 0;
  }

  /* ---------- HOME PAGE ---------- */
  function initHome() {
    const el = document.getElementById('map');
    if (!el || document.body.dataset.page !== 'home') return;
    const $ = id => document.getElementById(id);
    const start = userOrigin(currentUser()) || DA.seedCenter();
    const map = new MiniMap(el, { center: start, zoom: 15, dark: DA.settings().theme === 'dark' });
    window.sparkMap = map;
    const state = { cat: 'all', min: 18, max: 60, radius: 25 };

    // filter chips
    const chipDefs = [{ key: 'all', label: 'Everyone' }].concat(DA.CATEGORIES);
    $('homeChips').innerHTML = chipDefs.map(c => `<span class="chip${c.key === 'all' ? ' on' : ''}" data-cat="${c.key}" role="button" tabindex="0">${esc(c.label)}</span>`).join('');
    $('homeChips').addEventListener('click', e => {
      const c = e.target.closest('[data-cat]'); if (!c) return;
      state.cat = c.dataset.cat;
      $('homeChips').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); refresh();
    });
    const readFilters = () => {
      state.min = Math.max(18, parseInt($('fMin').value, 10) || 18);
      state.max = Math.min(99, parseInt($('fMax').value, 10) || 99);
      state.radius = parseFloat($('fRadius').value) || 25; refresh();
    };
    ['fMin', 'fMax'].forEach(i => $(i).addEventListener('change', readFilters));
    $('fRadius').addEventListener('change', readFilters);

    // map controls
    $('zoomIn').onclick = () => map.zoomBy(1);
    $('zoomOut').onclick = () => map.zoomBy(-1);
    $('locateMe').onclick = () => {
      const m = currentUser();
      if (!m) { DA.openModal('login'); return; }
      if (m.lat == null) { DA.openModal('location'); return; }
      map.setView(m.lat, m.lng, 16);
    };
    // status switch inside panel
    $('statusSwitch').addEventListener('click', e => { const b = e.target.closest('[data-status]'); if (b) DA.setStatus(b.dataset.status); });
    map.onMapClick = () => { $('userCard').hidden = true; };

    function showCard(u, origin) {
      const m = currentUser(); const liked = m && (likes()[m.id] || []).includes(u.id);
      const d = origin ? distText(DA.distKm(origin, u)) + ' away' : 'Distance unknown';
      const card = $('userCard');
      card.innerHTML = `<div class="uc-top"><img src="${DA.avatar(u)}" alt="${esc(u.name)}">
        <div style="flex:1;min-width:0"><h3>${esc(u.name)}, ${u.age} ${u.verified ? '<span class="verified">✔ Verified</span>' : ''}</h3>
        <p class="muted tiny"><span class="dot available"></span> Available · ${d} · ${esc(u.city || '')}</p>
        <p style="font-size:.9rem;margin-top:4px">${esc(u.bio || '')}</p></div>
        <button class="icon-btn" data-act="close" aria-label="Close">×</button></div>
        <div class="chips" style="margin:10px 0 0">${DA.catsOf(u).map(k => `<span class="chip static">${esc(DA.catLabel(k))}</span>`).join('')}${(u.interests || []).map(i => `<span class="chip static">#${esc(i)}</span>`).join('')}</div>
        <div class="uc-actions"><button class="btn btn-ghost" data-act="like">${liked ? '♥ Liked' : '♡ Like'}</button><a class="btn btn-primary" href="booking.html?user=${encodeURIComponent(u.id)}">📅 Request to meet</a></div>`;
      card.hidden = false;
      card.onclick = e => {
        const a = e.target.closest('[data-act]'); if (!a) return;
        if (a.dataset.act === 'close') card.hidden = true;
        if (a.dataset.act === 'like' && m) { const on = toggleLike(m.id, u.id); a.textContent = on ? '♥ Liked' : '♡ Like'; DA.toast(on ? 'You liked ' + u.name : 'Like removed'); }
      };
    }

    function refresh() {
      const m = currentUser();
      $('heroCard').hidden = !!m; $('nearbyPanel').hidden = !m;
      const origin = userOrigin(m) || DA.seedCenter();
      let list = DA.visibleUsers().filter(u => !m || u.id !== m.id).filter(u =>
        (state.cat === 'all' || DA.catsOf(u).includes(state.cat)) && u.age >= state.min && u.age <= state.max && DA.distKm(origin, u) <= state.radius);
      list.forEach(u => { u._d = DA.distKm(origin, u); }); list.sort((a, b) => a._d - b._d);
      map.setMarkers(list.map(u => { const p = DA.approx(u); return { id: u.id, lat: p.lat, lng: p.lng, html: pinHtml(u, !m), onClick: () => m ? showCard(u, userOrigin(m)) : DA.openModal('login') }; }));
      if (m && m.lat != null) map.setMe({ lat: m.lat, lng: m.lng }, m.status !== 'available'); else map.setMe(null);
      if (!m) return;
      $('nearCount').textContent = list.length;
      $('statusSwitch').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.status === m.status));
      $('visNote').textContent = m.status === 'available'
        ? (m.lat != null && m.shareLocation ? "You're visible to nearby people (approximate location only)." : 'Enable location so nearby people can see you.')
        : "You're hidden. Switch to Available to appear on the map.";
      $('nearList').innerHTML = list.length ? list.slice(0, 30).map(u => `<li class="near-item ${esc(u.gender)}" data-id="${esc(u.id)}" tabindex="0">
          <img src="${DA.avatar(u)}" alt=""><div style="flex:1;min-width:0"><strong>${esc(u.name)}, ${u.age}</strong><small>${m.lat != null ? distText(u._d) + ' · ' : ''}${esc((u.bio || '').slice(0, 40))}</small></div><span class="dot available"></span></li>`).join('')
        : '<li class="empty">No one matches these filters right now.</li>';
    }
    $('nearList').addEventListener('click', e => {
      const li = e.target.closest('[data-id]'); if (!li) return;
      const u = DA.getUser ? DA.getUser(li.dataset.id) : DA.users().find(x => x.id === li.dataset.id); if (!u) return;
      const p = DA.approx(u); map.setView(p.lat, p.lng, 17); showCard(u, userOrigin(currentUser()));
    });

    ['spark:status', 'spark:profile'].forEach(n => window.addEventListener(n, refresh));
    window.addEventListener('spark:location', () => { const m = currentUser(); if (m && m.lat != null) map.setView(m.lat, m.lng, 15); refresh(); });
    window.addEventListener('storage', e => { if (e.key === DA.KEYS.users || e.key === DA.KEYS.session) refresh(); if (e.key === DA.KEYS.settings) map.setDark(DA.settings().theme === 'dark'); });
    refresh();

    // simulated "real-time" movement of dummy people + other tabs update through the storage event
    setInterval(() => {
      const users = DA.users(); let ch = false;
      users.forEach(u => { if (u.dummy && u.status === 'available' && u.lat != null) { u.lat += (Math.random() - .5) * 0.0005; u.lng += (Math.random() - .5) * 0.0005; ch = true; } });
      if (Math.random() < .3) {
        const d = users.filter(u => u.dummy), u = d[Math.floor(Math.random() * d.length)];
        if (u) { u.status = u.status === 'available' ? 'unavailable' : 'available'; u.online = u.status === 'available' || Math.random() > .5; ch = true; }
      }
      if (ch) { DA.saveUsers(users); refresh(); }
    }, 8000);
  }

  /* ---------- DISCOVER PAGE ---------- */
  function initDiscover() {
    if (document.body.dataset.page !== 'discover') return;
    const m = DA.requireUser(); if (!m) return;
    const $ = id => document.getElementById(id);
    const state = { cat: 'all', min: 18, max: 80, sort: 'near', avail: true };
    const passed = new Set();
    const chipDefs = [{ key: 'all', label: 'Everyone' }].concat(DA.CATEGORIES);
    $('dChips').innerHTML = chipDefs.map(c => `<span class="chip${c.key === 'all' ? ' on' : ''}" data-cat="${c.key}" role="button" tabindex="0">${esc(c.label)}</span>`).join('');
    $('dChips').addEventListener('click', e => { const c = e.target.closest('[data-cat]'); if (!c) return; state.cat = c.dataset.cat; $('dChips').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); render(); });
    ['dMin', 'dMax', 'dSort', 'dAvail'].forEach(id => $(id).addEventListener('change', () => {
      state.min = Math.max(18, parseInt($('dMin').value, 10) || 18); state.max = Math.min(99, parseInt($('dMax').value, 10) || 99);
      state.sort = $('dSort').value; state.avail = $('dAvail').checked; render();
    }));

    function render() {
      const me = DA.me(); const origin = userOrigin(me); const myLikes = likes()[me.id] || [];
      let list = DA.users().filter(u => u.id !== me.id && u.profileComplete && !u.suspended && !passed.has(u.id) &&
        (!state.avail || u.status === 'available') && (state.cat === 'all' || DA.catsOf(u).includes(state.cat)) && u.age >= state.min && u.age <= state.max);
      list.forEach(u => { u._d = origin && u.lat != null ? DA.distKm(origin, u) : 9999; });
      list.sort((a, b) => state.sort === 'age' ? a.age - b.age : state.sort === 'new' ? new Date(b.joined) - new Date(a.joined) : a._d - b._d);
      $('dCount').textContent = list.length + ' people';
      $('dEmpty').hidden = list.length > 0;
      $('dGrid').innerHTML = list.map(u => `<article class="pcard${u.status !== 'available' ? ' dim' : ''}" data-id="${esc(u.id)}">
        <img class="ph" src="${DA.avatar(u)}" alt="${esc(u.name)}" loading="lazy">
        <span class="tag-st"><span class="dot ${u.status}"></span>${DA.statusLabel(u.status)}${u._d < 9999 ? ' · ' + distText(u._d) : ''}</span>
        <div class="over"><h3>${esc(u.name)}, ${u.age} ${u.verified ? '<span class="verified" style="color:#8fc1ff">✔</span>' : ''}</h3><p>${esc(u.bio || '')}</p>
        <div class="pc-actions"><button class="pass" data-act="pass" aria-label="Pass">✕</button><button class="like${myLikes.includes(u.id) ? ' on' : ''}" data-act="like" aria-label="Like">♥</button><button class="book" data-act="book" aria-label="Request to meet">📅</button></div></div></article>`).join('');
    }
    $('dGrid').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const card = b.closest('.pcard'), id = card.dataset.id, me = DA.me();
      if (b.dataset.act === 'pass') { card.classList.add('leaving'); passed.add(id); setTimeout(render, 380); }
      if (b.dataset.act === 'like') { const on = toggleLike(me.id, id); b.classList.toggle('on', on); if (on) { card.classList.add('liked'); setTimeout(() => card.classList.remove('liked'), 600); } DA.toast(on ? 'You liked ' + DA.getUser(id).name : 'Like removed'); }
      if (b.dataset.act === 'book') window.location.href = 'booking.html?user=' + encodeURIComponent(id);
    });
    window.addEventListener('storage', e => { if (e.key === DA.KEYS.users) render(); });
    render();
  }

  initHome();
  initDiscover();
})();
