/* ==========================================================
   Spark – booking sessions (localStorage)
   ========================================================== */
(function () {
  'use strict';
  if (document.body.dataset.page !== 'booking') return;
  const DA = window.DA, esc = DA.esc;
  const me0 = DA.requireUser(); if (!me0) return;
  const $ = id => document.getElementById(id);

  const prefs = Object.assign({ show: [], hide: [], minAge: 18, maxAge: 60, radius: 25, onlyAvailable: true }, me0.bookingPrefs || {});
  let selected = null, tab = 'sent';
  const distText = km => km < 1 ? Math.round(km * 1000 / 50) * 50 + ' m' : km.toFixed(1) + ' km';

  /* ---- preference chips ---- */
  function drawChips() {
    $('showChips').innerHTML = DA.CATEGORIES.map(c => `<span class="chip${prefs.show.includes(c.key) ? ' on' : ''}" data-show="${c.key}" role="button" tabindex="0">${esc(c.label)}</span>`).join('');
    $('hideChips').innerHTML = DA.CATEGORIES.map(c => `<span class="chip${prefs.hide.includes(c.key) ? ' no' : ''}" data-hide="${c.key}" role="button" tabindex="0">${esc(c.label)}</span>`).join('');
  }
  const toggle = (arr, k) => { const i = arr.indexOf(k); if (i >= 0) arr.splice(i, 1); else arr.push(k); };
  $('showChips').addEventListener('click', e => { const c = e.target.closest('[data-show]'); if (!c) return; const k = c.dataset.show; toggle(prefs.show, k); prefs.hide = prefs.hide.filter(x => x !== k); change(); });
  $('hideChips').addEventListener('click', e => { const c = e.target.closest('[data-hide]'); if (!c) return; const k = c.dataset.hide; toggle(prefs.hide, k); prefs.show = prefs.show.filter(x => x !== k); change(); });
  ['bMin', 'bMax', 'bRadius', 'bAvail'].forEach(id => $(id).addEventListener('change', () => {
    prefs.minAge = Math.max(18, parseInt($('bMin').value, 10) || 18);
    prefs.maxAge = Math.min(99, parseInt($('bMax').value, 10) || 99);
    prefs.radius = parseFloat($('bRadius').value); prefs.onlyAvailable = $('bAvail').checked; change();
  }));
  function change() { DA.updateUser(me0.id, { bookingPrefs: prefs }); drawChips(); drawResults(); }

  /* ---- results ---- */
  function drawResults() {
    const me = DA.me(); const origin = me.lat != null ? { lat: me.lat, lng: me.lng } : null;
    let list = DA.users().filter(u => u.id !== me.id && u.profileComplete && !u.suspended && (!prefs.onlyAvailable || u.status === 'available') && DA.matches(u, prefs));
    list.forEach(u => { u._d = origin && u.lat != null ? DA.distKm(origin, u) : null; });
    list = list.filter(u => u._d == null || u._d <= prefs.radius);
    list.sort((a, b) => (a._d == null) - (b._d == null) || a._d - b._d);
    $('bCount').textContent = list.length;
    $('bResults').innerHTML = list.length ? list.map(u => `<div class="result${selected === u.id ? ' sel' : ''}" data-id="${esc(u.id)}" tabindex="0">
      <img src="${DA.avatar(u)}" alt=""><div class="grow"><strong>${esc(u.name)}, ${u.age}</strong> <span class="dot ${u.status}" title="${DA.statusLabel(u.status)}"></span><br>
      <small class="muted">${u._d != null ? distText(u._d) + ' · ' : ''}${esc(u.city || '')}</small>
      <div>${DA.catsOf(u).slice(0, 3).map(k => `<span class="chip static">${esc(DA.catLabel(k))}</span>`).join(' ')}</div></div>
      <button class="btn btn-sm ${selected === u.id ? 'btn-primary' : 'btn-ghost'}" type="button">${selected === u.id ? 'Selected' : 'Select'}</button></div>`).join('')
      : '<div class="empty">No one matches these preferences. Try widening age, distance or turning off "Available now only".</div>';
  }
  $('bResults').addEventListener('click', e => { const r = e.target.closest('[data-id]'); if (r) select(r.dataset.id); });

  function select(id) {
    selected = id; const u = DA.getUser(id);
    $('selPerson').innerHTML = u ? `<div class="sel-person"><img src="${DA.avatar(u)}" alt=""><div><strong>${esc(u.name)}, ${u.age}</strong><br><small class="muted">${esc(u.city || '')} · ${DA.statusLabel(u.status)}</small></div></div>`
      : '<div class="notice">Select someone from the list to continue.</div>';
    drawResults();
  }

  /* ---- form ---- */
  const form = $('bForm');
  const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  form.date.min = today.toISOString().slice(0, 10);
  form.addEventListener('submit', e => {
    e.preventDefault(); const err = $('bError'); err.textContent = '';
    if (!selected) { err.textContent = 'Please select a person first.'; return; }
    if (!form.date.value || !form.time.value) { err.textContent = 'Please choose a date and time.'; return; }
    if (new Date(form.date.value + 'T' + form.time.value) <= new Date()) { err.textContent = 'Please choose a time in the future.'; return; }
    const me = DA.me(), all = DA.bookings();
    if (all.some(b => b.fromId === me.id && b.toId === selected && b.date === form.date.value && b.time === form.time.value && !['cancelled', 'declined'].includes(b.status))) { err.textContent = 'You already sent this request.'; return; }
    all.unshift({ id: DA.uid('b'), fromId: me.id, toId: selected, date: form.date.value, time: form.time.value, duration: +form.duration.value, type: form.type.value, note: form.note.value.trim(), status: 'pending', created: Date.now() });
    DA.saveBookings(all); form.reset(); form.date.min = today.toISOString().slice(0, 10);
    DA.toast('Request sent! You will be notified when it is accepted.'); tab = 'sent'; drawTabs(); drawBookings();
  });

  /* ---- my sessions ---- */
  function drawTabs() { document.querySelectorAll('[data-btab]').forEach(t => t.classList.toggle('on', t.dataset.btab === tab)); }
  document.querySelectorAll('[data-btab]').forEach(t => t.addEventListener('click', () => { tab = t.dataset.btab; drawTabs(); drawBookings(); }));
  function drawBookings() {
    const me = DA.me();
    const list = DA.bookings().filter(b => tab === 'sent' ? b.fromId === me.id : b.toId === me.id).sort((a, b) => b.created - a.created);
    $('myBookings').innerHTML = list.length ? list.map(b => {
      const other = DA.getUser(tab === 'sent' ? b.toId : b.fromId) || { name: 'Deleted user', gender: 'other', id: 'x' };
      let acts = '';
      if (tab === 'received' && b.status === 'pending') acts = `<button class="btn btn-sm btn-green" data-a="confirmed" data-id="${b.id}">Accept</button><button class="btn btn-sm btn-ghost" data-a="declined" data-id="${b.id}">Decline</button>`;
      else if (b.status === 'pending' || b.status === 'confirmed') acts = `<button class="btn btn-sm btn-ghost" data-a="cancelled" data-id="${b.id}">Cancel</button>` + (b.status === 'confirmed' ? `<button class="btn btn-sm btn-primary" data-a="completed" data-id="${b.id}">Mark completed</button>` : '');
      return `<div class="bk"><div class="who"><img src="${DA.avatar(other)}" alt=""><div><strong>${esc(other.name)}</strong> <span class="badge ${b.status}">${b.status}</span><br>
        <small class="muted">${esc(b.type)} · ${esc(b.date)} ${esc(b.time)} · ${b.duration} min${b.note ? ' · “' + esc(b.note) + '”' : ''}</small></div></div><div style="display:flex;gap:6px;flex-wrap:wrap">${acts}</div></div>`;
    }).join('') : `<div class="empty">${tab === 'sent' ? 'You have not sent any requests yet.' : 'No requests received yet.'}</div>`;
  }
  $('myBookings').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const all = DA.bookings(), bk = all.find(x => x.id === b.dataset.id); if (!bk) return;
    bk.status = b.dataset.a; DA.saveBookings(all); DA.toast('Session ' + bk.status + '.'); drawBookings();
  });

  /* ---- go ---- */
  $('bMin').value = prefs.minAge; $('bMax').value = prefs.maxAge; $('bRadius').value = String(prefs.radius); $('bAvail').checked = prefs.onlyAvailable;
  const pre = new URLSearchParams(location.search).get('user');
  drawChips(); drawResults(); drawTabs(); drawBookings();
  if (pre && DA.getUser(pre)) select(pre); else select(null);
  window.addEventListener('storage', e => { if (e.key === DA.KEYS.bookings) drawBookings(); if (e.key === DA.KEYS.users) drawResults(); });
})();
