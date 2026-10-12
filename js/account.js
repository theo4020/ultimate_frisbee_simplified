// account.js — Compte joueur : pseudo réservé + mot de passe, et tout le profil retrouvé sur n'importe quel appareil.
// Le serveur (worker/index.js, /api/account/*) ne garde qu'une empreinte du mot de passe ; l'appareil, lui, garde le pseudo,
// le mot de passe (affichable dans le panneau Compte) et un jeton de connexion.
// Sauvegardé : tout ce que le jeu mémorise (profil, succès, records, tournoi, réglages de match, équipes…),
// sauf ce qui dépend de l'appareil (commandes, son).

const ACC_SKIP = new Set(['uf-acc', 'uf-ctrl', 'uf-muted', 'uf-news-seen']);
const accGet = () => { const a = storeGet('uf-acc', null); return a && a.name && a.token ? a : null; };
const accSet = a => (a ? storeSet('uf-acc', a) : (() => { try { localStorage.removeItem('uf-acc'); } catch (e) { } })());
function accData() {
  const o = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('uf-') && !ACC_SKIP.has(k)) o[k] = localStorage.getItem(k); } } catch (e) { }
  return o;
}
function accApply(data) {
  if (!data || typeof data !== 'object') return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k.startsWith('uf-') && !ACC_SKIP.has(k)) localStorage.removeItem(k); }
    for (const k in data) if (k.startsWith('uf-') && !ACC_SKIP.has(k) && typeof data[k] === 'string') localStorage.setItem(k, data[k]);
  } catch (e) { }
}
function accApi(op, body) {
  return fetch('api/account/' + op, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: op === 'save' })
    .then(r => r.json().catch(() => ({})).then(j => (r.ok ? j : { error: j.error || (r.status === 404 ? 'comptes indisponibles ici (ils marchent sur ' + NEW_HOST + ')' : 'erreur ' + r.status), status: r.status })))
    .catch(() => ({ error: 'serveur injoignable' }));
}
// mot de passe proposé à la création (lisible, facile à recopier)
function accSuggest() {
  const W = ['disque', 'huck', 'layout', 'stack', 'force', 'pull', 'flick', 'cut', 'zone', 'mark'];
  return W[Math.floor(Math.random() * W.length)] + '-' + String(Math.floor(1000 + Math.random() * 9000));
}

// ---------- sauvegarde automatique ----------
let accTimer = 0, accState = '';
function accTouch(k) {                                         // appelé par storeSet (teams.js) à chaque changement
  if (!accGet() || ACC_SKIP.has(k)) return;
  clearTimeout(accTimer); accTimer = setTimeout(accSave, 2500);
}
function accSave() {
  const a = accGet(); if (!a) return Promise.resolve(null);
  clearTimeout(accTimer);
  accState = 'Sauvegarde…'; accRender();
  return accApi('save', { name: a.name, token: a.token, data: accData() }).then(j => {
    if (j.status === 401) return accRelogin().then(ok => (ok ? accSave() : null));
    accState = j.error ? '⚠️ Non sauvegardé : ' + j.error : '✅ Sauvegardé';
    if (!j.error) accSet(Object.assign(accGet() || a, { synced: j.updated }));
    accRender();
    return j;
  });
}
// jeton expiré (trop d'appareils, compte reconnecté ailleurs…) : on se reconnecte avec le mot de passe gardé ici
function accRelogin() {
  const a = storeGet('uf-acc', null); if (!a || !a.password) return Promise.resolve(false);
  return accApi('login', { name: a.name, password: a.password }).then(j => {
    if (j.error) { accState = '⚠️ ' + j.error; accRender(); return false; }
    accSet(Object.assign(a, { token: j.token })); return true;
  });
}
// au lancement : si le compte a été modifié sur un autre appareil, on reprend ses données
function accStartup() {
  const a = accGet(); if (!a) return;
  accApi('load', { name: a.name, token: a.token }).then(j => {
    if (j.status === 401) { accRelogin().then(ok => ok && accStartup()); return; }
    if (j.error) { accState = '⚠️ ' + j.error; accRender(); return; }
    if (j.updated && j.updated !== a.synced && j.data) {
      accApply(j.data); accSet(Object.assign(a, { synced: j.updated }));
      try { sessionStorage.setItem('uf-acc-reload', '1'); } catch (e) { }
      location.reload();
    } else { accState = '✅ À jour'; accRender(); }
  });
}

// ---------- créer, se connecter, se déconnecter ----------
function accDone(j, name, password, msg) {
  $('accMsg').textContent = '';
  storeSet('uf-name', j.name);
  accSet({ name: j.name, password, token: j.token, synced: j.updated || 0 });
  if (j.data) {                                               // compte existant : ses données remplacent celles de cet appareil
    accApply(j.data); accSet(Object.assign(accGet(), { synced: j.updated }));
    try { sessionStorage.setItem('uf-acc-reload', msg); } catch (e) { }
    location.reload(); return;
  }
  accState = ''; accSave();
  syncNameUI(); accRender(); toast(msg);
}
function accRegister() {
  const name = cleanName($('accNewName').value), password = $('accNewPw').value;
  $('accMsg').textContent = 'Création…';
  accApi('register', { name, password, data: accData() }).then(j => {
    if (j.error) { $('accMsg').textContent = '⚠️ ' + j.error; return; }
    accDone(Object.assign(j, { data: null }), name, password, '✅ Compte créé : ' + j.name);
  });
}
function accLogin() {
  const name = cleanName($('accLogName').value), password = $('accLogPw').value;
  $('accMsg').textContent = 'Connexion…';
  accApi('login', { name, password }).then(j => {
    if (j.error) { $('accMsg').textContent = '⚠️ ' + j.error; return; }
    accDone(j, name, password, '✅ Connecté : ' + j.name);
  });
}
function accLogout() {
  const a = accGet(); if (!a) return;
  accSave().then(() => accApi('logout', { name: a.name, token: a.token }));
  accSet(null); accState = '';
  syncNameUI(); accRender(); toast('Déconnecté. Ton profil reste sur cet appareil.');
}
function accDelete() {
  const a = accGet(); if (!a) return;
  askConfirm(`Supprimer le compte ${a.name} ? Ses données en ligne seront effacées (ton profil reste sur cet appareil) et le pseudo redeviendra libre.`, 'Supprimer', () => {
    accApi('delete', { name: a.name, token: a.token }).then(j => {
      if (j.error) { $('accMsg').textContent = '⚠️ ' + j.error; return; }
      accSet(null); accState = ''; syncNameUI(); accRender(); toast('Compte supprimé.');
    });
  });
}

// ---------- affichage ----------
let accTab = 'new', accShowPw = false;
function syncNameUI() {
  const a = accGet();
  $('pname').value = myName(); $('pname').readOnly = !!a;
  $('pname').title = a ? 'Pseudo de ton compte' : '';
  $('accB').textContent = a ? '👤 Compte ✓' : '👤 Créer un compte';
  $('accB').classList.toggle('on', !!a);
}
function accRender() {
  if (!$('accBody') || $('accountCard').style.display === 'none') return;
  const a = accGet(), msg = $('accMsg').textContent;
  if (a) {
    const pw = storeGet('uf-acc', {}).password || '';
    $('accBody').innerHTML = `
      <p>Connecté en tant que <b>${esc(a.name)}</b>. Ton profil, tes succès, tes records et tes réglages sont sauvegardés en ligne :
        connecte-toi avec ce pseudo et ce mot de passe sur un autre appareil pour tout retrouver.</p>
      <div class="accRow"><span>Pseudo</span><b>${esc(a.name)}</b></div>
      <div class="accRow"><span>Mot de passe</span><b class="pw">${accShowPw ? esc(pw) : '•'.repeat(Math.max(6, pw.length))}</b>
        <button id="accEye" class="ghost">${accShowPw ? 'Masquer' : 'Afficher'}</button></div>
      <p class="net">${esc(accState)}</p>
      <div class="accBtns"><button id="accSaveB">Sauvegarder maintenant</button><button id="accOut">Se déconnecter</button><button id="accDel" class="ghost">Supprimer le compte</button></div>`;
    $('accEye').onclick = () => { accShowPw = !accShowPw; accRender(); };
    $('accSaveB').onclick = accSave; $('accOut').onclick = accLogout; $('accDel').onclick = accDelete;
  } else {
    $('accBody').innerHTML = `
      <p>Un compte réserve ton pseudo (personne d'autre ne peut l'utiliser, au classement non plus) et garde ton profil
        pour le retrouver sur n'importe quel appareil.</p>
      <div class="accTabs"><button data-t="new" class="${accTab === 'new' ? 'on' : ''}">Créer un compte</button><button data-t="log" class="${accTab === 'log' ? 'on' : ''}">J'ai déjà un compte</button></div>
      ${accTab === 'new' ? `
        <div class="accRow"><span>Pseudo</span><input id="accNewName" class="tname" maxlength="12" autocomplete="off" spellcheck="false" placeholder="3 à 12 caractères"></div>
        <div class="accRow"><span>Mot de passe</span><input id="accNewPw" class="tname" maxlength="64" autocomplete="off" spellcheck="false"></div>
        <p class="net">Tu pourras revoir ton mot de passe ici, dans Compte, sur cet appareil.</p>
        <button id="accGo" class="primary">Créer mon compte</button>`
      : `
        <div class="accRow"><span>Pseudo</span><input id="accLogName" class="tname" maxlength="12" autocomplete="off" spellcheck="false"></div>
        <div class="accRow"><span>Mot de passe</span><input id="accLogPw" class="tname" type="password" maxlength="64" autocomplete="off"></div>
        <p class="net">Les données du compte remplaceront celles de cet appareil.</p>
        <button id="accGo" class="primary">Se connecter</button>`}`;
    $('accBody').querySelectorAll('.accTabs button').forEach(b => { b.onclick = () => { accTab = b.dataset.t; $('accMsg').textContent = ''; accRender(); }; });
    if (accTab === 'new') { $('accNewName').value = myName(); $('accNewPw').value = accSuggest(); $('accGo').onclick = accRegister; }
    else { $('accLogName').value = myName(); $('accGo').onclick = accLogin; }
    for (const el of $('accBody').querySelectorAll('input')) el.addEventListener('keydown', e => { if (e.key === 'Enter') $('accGo').click(); });
  }
  $('accMsg').textContent = msg;
}

if (typeof document !== 'undefined' && document.getElementById('accB')) {
  $('accB').addEventListener('click', () => { $('accMsg').textContent = ''; openCard('accountCard'); accRender(); });
  $('accBack').addEventListener('click', closeCard);
  syncNameUI();
  window.addEventListener('pagehide', () => { if (accTimer) accSave(); });  // on quitte la page : dernière sauvegarde
  document.addEventListener('DOMContentLoaded', () => {
    let after = null; try { after = sessionStorage.getItem('uf-acc-reload'); sessionStorage.removeItem('uf-acc-reload'); } catch (e) { }
    if (after) { accState = '✅ À jour'; if (after.length > 1) setTimeout(() => toast(after + ' — profil chargé'), 600); }
    else accStartup();
  });
}
