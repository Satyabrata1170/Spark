/* ==========================================================
   Spark – profile page (localStorage)
   ========================================================== */
(function () {
  'use strict';
  if (document.body.dataset.page !== 'profile') return;
  const DA = window.DA, esc = DA.esc;
  if (!DA.requireUser()) return;
  const $ = id => document.getElementById(id);
  const SELF = ['married-woman', 'single-mother', 'sugar-mummy', 'sugar-daddy'];
  const form = $('pForm');

  const chips = $('pSelf');
  chips.innerHTML = SELF.map(k => `<span class="chip" data-self="${k}" role="button" tabindex="0">${esc(DA.catLabel(k))}</span>`).join('');
  chips.addEventListener('click', e => { const c = e.target.closest('[data-self]'); if (c) c.classList.toggle('on'); });

  function draw() {
    const m = DA.me(); if (!m || m.role === 'admin') return;
    $('pAvatar').src = DA.avatar(m);
    $('pName').textContent = m.name;
    $('pMeta').textContent = [m.age ? m.age + ' yrs' : '', m.city, '@' + m.username].filter(Boolean).join(' · ');
    $('pBadges').innerHTML = (m.verified ? '<span class="chip static" style="color:var(--blue)">✔ Verified</span>' : '') +
      DA.catsOf(m).map(k => `<span class="chip static">${esc(DA.catLabel(k))}</span>`).join('') +
      `<span class="chip static"><span class="dot ${m.status}"></span> ${DA.statusLabel(m.status)}</span>`;
    $('pStatus').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.status === m.status));

    form.name.value = m.name || ''; form.age.value = m.age || ''; form.city.value = m.city || ''; form.username.value = m.username || '';
    form.bio.value = m.bio || ''; form.interests.value = (m.interests || []).join(', ');
    const g = form.querySelector(`input[name=gender][value="${m.gender}"]`); if (g) g.checked = true;
    chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', (m.categories || []).includes(c.dataset.self)));

    $('tShare').checked = !!m.shareLocation;
    $('locText').textContent = m.lat != null ? `${m.lat.toFixed(3)}, ${m.lng.toFixed(3)}` : 'Not set – tap Update to enable';
    $('tDark').checked = DA.settings().theme === 'dark';

    const bks = DA.bookings(), sent = bks.filter(b => b.fromId === m.id), rec = bks.filter(b => b.toId === m.id);
    const likes = DA.LS.get(DA.KEYS.likes, {})[m.id] || [];
    $('pStats').innerHTML = [
      [sent.length, 'Requests sent'], [rec.filter(b => b.status === 'pending').length, 'Pending for me'],
      [bks.filter(b => (b.fromId === m.id || b.toId === m.id) && b.status === 'confirmed').length, 'Confirmed'], [likes.length, 'People liked']
    ].map(s => `<div class="stat"><b>${s[0]}</b><span>${s[1]}</span></div>`).join('');
    $('pReqSummary').textContent = `${rec.filter(b => b.status === 'pending').length} request(s) waiting for your answer · ${sent.length} sent.`;
  }

  form.addEventListener('submit', e => {
    e.preventDefault(); const err = $('pError'); err.textContent = '';
    const m = DA.me(); const age = parseInt(form.age.value, 10);
    const gender = (form.querySelector('input[name=gender]:checked') || {}).value;
    const username = form.username.value.trim();
    if (form.name.value.trim().length < 2) { err.textContent = 'Please enter your name.'; return; }
    if (!gender) { err.textContent = 'Please choose your gender.'; return; }
    if (!(age >= 18 && age <= 99)) { err.textContent = 'Age must be 18 or older.'; return; }
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(username) || username.toLowerCase() === 'admin') { err.textContent = 'Invalid username.'; return; }
    if (DA.users().some(u => u.id !== m.id && u.username.toLowerCase() === username.toLowerCase())) { err.textContent = 'That username is taken.'; return; }
    DA.updateUser(m.id, {
      name: form.name.value.trim(), age, gender, city: form.city.value.trim(), username, bio: form.bio.value.trim().slice(0, 240),
      interests: form.interests.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8),
      categories: [...chips.querySelectorAll('.chip.on')].map(c => c.dataset.self), profileComplete: true
    });
    DA.renderHeader(); draw(); DA.toast('Profile updated.');
  });

  $('pStatus').addEventListener('click', e => { const b = e.target.closest('[data-status]'); if (b) { DA.setStatus(b.dataset.status); draw(); } });
  window.addEventListener('spark:status', draw); window.addEventListener('spark:location', draw);

  $('tShare').addEventListener('change', e => {
    const m = DA.me();
    if (e.target.checked && m.lat == null) { e.target.checked = false; DA.openModal('location'); return; }
    DA.updateUser(m.id, { shareLocation: e.target.checked }); DA.toast(e.target.checked ? 'Location sharing on.' : 'Location sharing off – you are hidden.');
  });
  $('updateLoc').addEventListener('click', () => DA.openModal('location'));
  $('tDark').addEventListener('change', e => { const s = DA.settings(); s.theme = e.target.checked ? 'dark' : 'light'; DA.saveSettings(s); DA.applyTheme(); });

  /* photo: resize to 320px and keep as data URL */
  $('pPhoto').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    if (!/^image\//.test(file.type)) { DA.toast('Please choose an image file.', 'err'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 320 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        DA.updateUser(DA.me().id, { photo: c.toDataURL('image/jpeg', .82) }); DA.renderHeader(); draw(); DA.toast('Photo updated.');
      };
      img.onerror = () => DA.toast('Could not read that image.', 'err'); img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  $('pLogout').addEventListener('click', () => DA.logout());
  $('deleteAcct').addEventListener('click', () => {
    if (!confirm('Delete your account permanently? This cannot be undone.')) return;
    const m = DA.me();
    DA.saveUsers(DA.users().filter(u => u.id !== m.id));
    DA.saveBookings(DA.bookings().filter(b => b.fromId !== m.id && b.toId !== m.id));
    DA.LS.del(DA.KEYS.session); window.location.href = 'index.html';
  });

  draw();
})();
