/* ==========================================================
   Spark – admin panel (localStorage)
   NOTE: this guard is client-side only and is NOT real security.
   A production admin area needs server-side authentication.
   ========================================================== */
(function () {
  'use strict';
  if (document.body.dataset.page !== 'admin') return;
  const DA = window.DA, esc = DA.esc;
  const s = DA.session();
  if (!s || s.role !== 'admin') { window.location.replace('index.html'); return; }
  const $ = id => document.getElementById(id);
  const fmtDate = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const members = () => DA.users().filter(u => u.role !== 'admin');
  const nameOf = id => { const u = DA.getUser(id); return u ? u.name : 'Deleted user'; };

  /* ---------- navigation ---------- */
  const titles = { dashboard: 'Dashboard Overview', users: 'User Management', bookings: 'Booking Management', reports: 'Reports', settings: 'Settings' };
  function show(sec) {
    document.querySelectorAll('.adm-sec').forEach(x => x.classList.toggle('on', x.id === 'sec-' + sec));
    document.querySelectorAll('[data-sec]').forEach(b => b.classList.toggle('on', b.dataset.sec === sec));
    $('admTitle').textContent = titles[sec]; $('admSide').classList.remove('open');
    ({ dashboard: drawDash, users: drawUsers, bookings: drawBookings, reports: drawReports, settings: drawSettings })[sec]();
    try { history.replaceState(null, '', '#' + sec); } catch (e) {}
  }
  document.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => show(b.dataset.sec)));
  $('admBurger').addEventListener('click', () => $('admSide').classList.toggle('open'));
  $('admLogout').addEventListener('click', () => DA.logout());
  $('admBrand').innerHTML = DA.LOGO + '<span>' + esc(DA.settings().siteName) + ' Admin</span>';
  $('admTheme').addEventListener('click', () => { const st = DA.settings(); st.theme = st.theme === 'dark' ? 'light' : 'dark'; DA.saveSettings(st); DA.applyTheme(); drawSettings(); });

  /* ---------- dashboard ---------- */
  function drawDash() {
    const us = members(), bk = DA.bookings(), rp = DA.reports();
    const week = Date.now() - 7 * 86400000;
    const card = (ico, n, label) => `<div class="scard"><div class="ico">${ico}</div><b>${n}</b><span>${label}</span></div>`;
    $('statCards').innerHTML = [
      card('👥', us.length, 'Total Users'), card('🟢', us.filter(u => u.online && !u.suspended).length, 'Online Users'),
      card('✅', us.filter(u => u.status === 'available' && !u.suspended).length, 'Available Users'),
      card('📅', bk.length, 'Bookings'), card('🚩', rp.filter(r => r.status === 'open').length, 'Open Reports')
    ].join('');
    $('anCards').innerHTML = [
      card('🪪', us.filter(u => u.profileComplete).length, 'Total Profiles'),
      card('🆕', us.filter(u => new Date(u.joined).getTime() >= week).length, 'New Registrations (7d)'),
      card('⚡', us.filter(u => u.online && !u.suspended).length, 'Active Users'),
      card('🤝', bk.filter(b => b.status === 'confirmed').length, 'Meetings Scheduled')
    ].join('');
    // registrations per day
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; });
    const counts = days.map(d => us.filter(u => { const j = new Date(u.joined); return j >= d && j < new Date(d.getTime() + 86400000); }).length);
    const max = Math.max(1, ...counts);
    $('regBars').innerHTML = days.map((d, i) => `<div class="bar"><span>${counts[i]}</span><i style="height:${Math.round(counts[i] / max * 100)}%"></i><span>${d.toLocaleDateString(undefined, { weekday: 'short' })}</span></div>`).join('');
    // splits
    const seg = (el, leg, parts) => {
      const tot = parts.reduce((a, p) => a + p[1], 0) || 1;
      $(el).innerHTML = parts.map(p => `<i style="width:${p[1] / tot * 100}%;background:${p[2]}"></i>`).join('');
      $(leg).innerHTML = parts.map(p => `<span style="color:${p[2]}">●</span> ${p[0]} ${p[1]}`).join(' &nbsp; ');
    };
    seg('genderSplit', 'genderLegend', [['Women', us.filter(u => u.gender === 'female').length, '#ff4d8d'], ['Men', us.filter(u => u.gender === 'male').length, '#2f80ff'], ['Other', us.filter(u => u.gender === 'other').length, '#7c5cff']]);
    seg('bkSplit', 'bkLegend', [['Pending', bk.filter(b => b.status === 'pending').length, '#f59e0b'], ['Confirmed', bk.filter(b => b.status === 'confirmed').length, '#22c55e'], ['Completed', bk.filter(b => b.status === 'completed').length, '#2f80ff'], ['Cancelled', bk.filter(b => ['cancelled', 'declined'].includes(b.status)).length, '#ef4444']]);
  }

  /* ---------- users ---------- */
  function statusBadge(u) {
    if (u.suspended) return '<span class="badge suspended">Suspended</span>';
    return `<span class="badge ${u.status}">${DA.statusLabel(u.status)}</span> ${u.online ? '<span class="dot available" title="Online"></span>' : ''}`;
  }
  function drawUsers() {
    const q = $('uSearch').value.trim().toLowerCase(), f = $('uFilter').value;
    const list = members().filter(u => {
      const hay = (u.name + ' ' + u.email + ' ' + u.username + ' ' + (u.city || '')).toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (f === 'available') return u.status === 'available' && !u.suspended;
      if (f === 'unavailable') return u.status === 'unavailable' && !u.suspended;
      if (f === 'online') return u.online;
      if (f === 'suspended') return u.suspended;
      return true;
    });
    $('uBody').innerHTML = list.length ? list.map(u => `<tr>
      <td><img class="tbl-av" src="${DA.avatar(u)}" alt=""></td>
      <td><strong>${esc(u.name)}</strong><br><small class="muted">${esc(u.email)}</small></td>
      <td>${u.age == null ? '–' : u.age}</td><td>${esc(u.city || '–')}</td><td>${statusBadge(u)}</td>
      <td><div class="acts"><button class="btn btn-sm btn-ghost" data-v="${u.id}">View</button><button class="btn btn-sm btn-primary" data-e="${u.id}">Edit</button><button class="btn btn-sm btn-danger" data-d="${u.id}">Delete</button></div></td></tr>`).join('')
      : '<tr><td colspan="6" class="empty">No users found.</td></tr>';
  }
  $('uSearch').addEventListener('input', drawUsers); $('uFilter').addEventListener('change', drawUsers);
  $('uBody').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.v) viewUser(b.dataset.v); if (b.dataset.e) editUser(b.dataset.e);
    if (b.dataset.d) {
      const u = DA.getUser(b.dataset.d);
      if (u && confirm('Delete ' + u.name + '? Their bookings will be removed too.')) {
        DA.saveUsers(DA.users().filter(x => x.id !== u.id));
        DA.saveBookings(DA.bookings().filter(x => x.fromId !== u.id && x.toId !== u.id));
        DA.toast('User deleted.'); drawUsers();
      }
    }
  });

  const uForm = $('uForm'); let editing = null;
  function viewUser(id) {
    const u = DA.getUser(id); if (!u) return;
    $('uModalTitle').textContent = 'User details'; uForm.hidden = true; $('uView').hidden = false;
    $('uView').innerHTML = `<div class="view-grid"><img src="${DA.avatar(u)}" alt=""><dl class="kv">
      <dt>Name</dt><dd>${esc(u.name)} ${u.verified ? '✔' : ''}</dd><dt>Username</dt><dd>@${esc(u.username)}</dd><dt>Email</dt><dd>${esc(u.email)}</dd>
      <dt>Age / Gender</dt><dd>${u.age == null ? '–' : u.age} · ${esc(u.gender || '–')}</dd><dt>City</dt><dd>${esc(u.city || '–')}</dd>
      <dt>Status</dt><dd>${statusBadge(u)}</dd><dt>Location</dt><dd>${u.lat != null ? u.lat.toFixed(4) + ', ' + u.lng.toFixed(4) : 'Not shared'}</dd>
      <dt>Categories</dt><dd>${DA.catsOf(u).map(k => esc(DA.catLabel(k))).join(', ') || '–'}</dd><dt>Joined</dt><dd>${fmtDate(u.joined)}</dd>
      <dt>Bio</dt><dd>${esc(u.bio || '–')}</dd></dl></div>`;
    DA.openModal('u');
  }
  function openForm(u) {
    editing = u ? u.id : null; $('uModalTitle').textContent = u ? 'Edit user' : 'Add user';
    $('uView').hidden = true; uForm.hidden = false; $('uError').textContent = '';
    uForm.reset();
    const d = u || { gender: 'female', status: 'unavailable', password: '' };
    ['name', 'username', 'email', 'password', 'age', 'gender', 'city', 'status', 'bio'].forEach(k => { uForm[k].value = d[k] == null ? '' : d[k]; });
    uForm.verified.checked = !!d.verified; uForm.suspended.checked = !!d.suspended;
    DA.openModal('u');
  }
  const editUser = id => { const u = DA.getUser(id); if (u) openForm(u); };
  $('uAdd').addEventListener('click', () => openForm(null));
  uForm.addEventListener('submit', e => {
    e.preventDefault(); const err = $('uError'); err.textContent = '';
    const f = uForm, name = f.name.value.trim(), username = f.username.value.trim(), email = f.email.value.trim().toLowerCase();
    const age = parseInt(f.age.value, 10);
    if (name.length < 2) { err.textContent = 'Name is required.'; return; }
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(username) || username.toLowerCase() === 'admin') { err.textContent = 'Invalid username (3–20 letters/numbers, not "admin").'; return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Enter a valid email.'; return; }
    if (f.password.value.length < 6) { err.textContent = 'Password needs at least 6 characters.'; return; }
    if (!(age >= 18 && age <= 99)) { err.textContent = 'Members must be 18 or older.'; return; }
    const all = DA.users();
    if (all.some(u => u.id !== editing && u.email.toLowerCase() === email)) { err.textContent = 'Email already in use.'; return; }
    if (all.some(u => u.id !== editing && u.username.toLowerCase() === username.toLowerCase())) { err.textContent = 'Username already in use.'; return; }
    const patch = {
      name, username, email, password: f.password.value, age, gender: f.gender.value, city: f.city.value.trim(), status: f.status.value,
      bio: f.bio.value.trim(), verified: f.verified.checked, suspended: f.suspended.checked, profileComplete: true
    };
    if (editing) DA.updateUser(editing, patch);
    else {
      const c = DA.seedCenter();
      all.push(DA.mkUser(Object.assign({ lat: c.lat + (Math.random() - .5) * .02, lng: c.lng + (Math.random() - .5) * .02, shareLocation: true, locAsked: true }, patch)));
      DA.saveUsers(all);
    }
    DA.closeModal(); DA.toast(editing ? 'User updated.' : 'User added.'); drawUsers();
  });

  /* ---------- bookings ---------- */
  let bs = 'pending';
  document.querySelectorAll('[data-bs]').forEach(t => t.addEventListener('click', () => { bs = t.dataset.bs; document.querySelectorAll('[data-bs]').forEach(x => x.classList.toggle('on', x === t)); drawBookings(); }));
  function drawBookings() {
    const want = bs === 'cancelled' ? ['cancelled', 'declined'] : [bs];
    const list = DA.bookings().filter(b => want.includes(b.status)).sort((a, b) => b.created - a.created);
    $('bBody').innerHTML = list.length ? list.map(b => {
      let acts = '';
      if (b.status === 'pending') acts += `<button class="btn btn-sm btn-green" data-a="confirmed" data-id="${b.id}">Confirm</button>`;
      if (b.status === 'confirmed') acts += `<button class="btn btn-sm btn-primary" data-a="completed" data-id="${b.id}">Complete</button>`;
      if (['pending', 'confirmed'].includes(b.status)) acts += `<button class="btn btn-sm btn-ghost" data-a="cancelled" data-id="${b.id}">Cancel</button>`;
      acts += `<button class="btn btn-sm btn-danger" data-a="delete" data-id="${b.id}">Delete</button>`;
      return `<tr><td>${esc(nameOf(b.fromId))}</td><td>${esc(nameOf(b.toId))}</td><td>${esc(b.date)} ${esc(b.time)}<br><small class="muted">${b.duration} min</small></td><td>${esc(b.type)}</td><td><span class="badge ${b.status}">${b.status}</span></td><td><div class="acts">${acts}</div></td></tr>`;
    }).join('') : '<tr><td colspan="6" class="empty">No bookings in this list.</td></tr>';
  }
  $('bBody').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    let all = DA.bookings();
    if (b.dataset.a === 'delete') { if (!confirm('Delete this booking?')) return; all = all.filter(x => x.id !== b.dataset.id); }
    else { const bk = all.find(x => x.id === b.dataset.id); if (bk) bk.status = b.dataset.a; }
    DA.saveBookings(all); DA.toast('Booking updated.'); drawBookings();
  });

  /* ---------- reports & messages ---------- */
  function drawReports() {
    const rp = DA.reports().sort((a, b) => b.created - a.created);
    $('rBody').innerHTML = rp.length ? rp.map(r => `<tr><td>${esc(nameOf(r.targetId))}</td><td>${esc(nameOf(r.reporterId))}</td><td>${esc(r.reason)}</td><td><span class="badge ${r.status}">${r.status}</span></td>
      <td><div class="acts">${r.status === 'open' ? `<button class="btn btn-sm btn-green" data-r="resolved" data-id="${r.id}">Resolve</button><button class="btn btn-sm btn-ghost" data-r="dismissed" data-id="${r.id}">Dismiss</button>` : ''}
      ${DA.getUser(r.targetId) ? `<button class="btn btn-sm btn-danger" data-sus="${r.targetId}">Suspend user</button>` : ''}</div></td></tr>`).join('')
      : '<tr><td colspan="5" class="empty">No reports.</td></tr>';
    const ms = DA.LS.get(DA.KEYS.messages, []);
    $('mBody').innerHTML = ms.length ? ms.map(m => `<tr><td><strong>${esc(m.name)}</strong><br><small class="muted">${esc(m.email)}</small></td><td>${esc(m.subject)}</td><td style="max-width:340px">${esc(m.message)}</td><td>${fmtDate(m.created)}</td><td><button class="btn btn-sm btn-danger" data-m="${m.id}">Delete</button></td></tr>`).join('')
      : '<tr><td colspan="5" class="empty">No messages yet. Messages sent from the Contact page appear here.</td></tr>';
  }
  $('rBody').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.r) { const all = DA.reports(), r = all.find(x => x.id === b.dataset.id); if (r) r.status = b.dataset.r; DA.saveReports(all); DA.toast('Report ' + b.dataset.r + '.'); }
    if (b.dataset.sus) { DA.updateUser(b.dataset.sus, { suspended: true, status: 'unavailable', online: false }); DA.toast('User suspended.'); }
    drawReports();
  });
  $('mBody').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; DA.LS.set(DA.KEYS.messages, DA.LS.get(DA.KEYS.messages, []).filter(m => m.id !== b.dataset.m)); drawReports(); });

  /* ---------- settings ---------- */
  function drawSettings() {
    const st = DA.settings();
    $('sDark').checked = st.theme === 'dark'; $('sName').value = st.siteName; $('sTag').value = st.tagline; $('sMaint').checked = st.maintenance;
    $('nEmail').checked = st.notifEmail; $('nPush').checked = st.notifPush; $('nBook').checked = st.notifBookings; $('nRep').checked = st.notifReports;
  }
  const saveToggle = (id, key) => $(id).addEventListener('change', e => { const st = DA.settings(); st[key] = e.target.checked; DA.saveSettings(st); DA.applyTheme(); DA.toast('Setting saved.'); });
  saveToggle('nEmail', 'notifEmail'); saveToggle('nPush', 'notifPush'); saveToggle('nBook', 'notifBookings'); saveToggle('nRep', 'notifReports');
  $('sDark').addEventListener('change', e => { const st = DA.settings(); st.theme = e.target.checked ? 'dark' : 'light'; DA.saveSettings(st); DA.applyTheme(); });
  $('sSave').addEventListener('click', () => {
    const st = DA.settings(); st.siteName = $('sName').value.trim() || 'Spark'; st.tagline = $('sTag').value.trim() || 'Meet people nearby'; st.maintenance = $('sMaint').checked;
    DA.saveSettings(st); $('admBrand').innerHTML = DA.LOGO + '<span>' + esc(st.siteName) + ' Admin</span>'; DA.toast('Website settings saved.');
  });
  $('sReset').addEventListener('click', () => {
    if (!confirm('Reset all demo members, bookings and reports? (Your own settings are kept.)')) return;
    const keep = DA.session(); DA.resetDemoData(); DA.setSession(keep); DA.toast('Demo data reset.'); show('dashboard');
  });

  window.addEventListener('storage', () => { const on = document.querySelector('.adm-sec.on'); if (on) show(on.id.replace('sec-', '')); });
  const start = (location.hash || '#dashboard').slice(1);
  show(titles[start] ? start : 'dashboard');
})();
