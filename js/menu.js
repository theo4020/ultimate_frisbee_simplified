// menu.js — Menu en jeu (☰), pause pour tout le monde en ligne, panneau Commandes, signalement d'un problème.

// ---------- cartes par-dessus le jeu (on revient toujours à l'écran d'avant) ----------
const CARDS = ['lobbyCard', 'stratCard', 'seriesCard', 'profileCard', 'gameMenuCard', 'ctrlCard', 'reportCard', 'feedbackCard', 'repListCard', 'newsCard', 'moveCard', 'endlessCard', 'accountCard', 'sysCard', 'styleCard'];
const cardStack = [];
function openCard(id) {
  const shown = CARDS.find(c => $(c).style.display !== 'none') || null;
  cardStack.push({ card: shown, hidden: $('overlay').classList.contains('hidden'), menuShown: G.menuShown, paused: G.paused });
  for (const c of CARDS) $(c).style.display = c === id ? '' : 'none';
  $('overlay').classList.remove('hidden'); G.menuShown = true;
  if (!G.net) G.paused = true;                                 // solo : le jeu attend
  if (id === 'ctrlCard') { keyWait = null; renderCtrl(); }
  if (id === 'gameMenuCard') renderGameMenu();
}
function closeCard() {
  const s = cardStack.pop(); if (!s) return;
  for (const c of CARDS) $(c).style.display = c === s.card ? '' : 'none';
  $('overlay').classList.toggle('hidden', s.hidden);
  G.menuShown = s.menuShown; G.paused = s.paused; keyWait = null;
  if (s.card === 'stratCard') refreshCaptainUI();
}
function closeAllCards() { while (cardStack.length) closeCard(); }
// le point démarre : les panneaux ouverts par-dessus le menu d'avant-point se ferment
function resetCards() { cardStack.length = 0; for (const c of ['gameMenuCard', 'ctrlCard', 'reportCard', 'feedbackCard']) $(c).style.display = 'none'; G.paused = false; }

// ---------- menu en jeu ----------
function renderGameMenu() {
  $('gmCodeBox').style.display = G.net && G.roomCode ? '' : 'none';   // en ligne : le code pour inviter d'autres joueurs
  $('gmCode').textContent = G.roomCode || '';
  $('gmNet').textContent = typeof netQualityText === 'function' ? netQualityText() : '';
  $('gmPause').style.display = G.net && G.started ? '' : 'none';
  $('gmPause').textContent = G.pz ? (canUnpause() ? '▶ Relancer la partie' : '⏸ En pause…') : '⏸ Pause pour tout le monde';
  $('gmQuit').textContent = G.net ? '✕ Quitter la partie en ligne' : G.tuto ? '✕ Quitter le tutoriel' : G.practice ? '✕ Quitter l’entraînement' : '✕ Quitter le match';
}
$('menuB').addEventListener('click', () => { if ($('gameMenuCard').style.display === 'none') openCard('gameMenuCard'); });
$('gmResume').addEventListener('click', closeCard);
$('gmCopy').addEventListener('click', () => copyInvite($('gmCopy')));
$('gmCtrl').addEventListener('click', () => openCard('ctrlCard'));
$('gmReport').addEventListener('click', () => { $('repStatus').textContent = ''; $('repOut').style.display = 'none'; $('repSend').disabled = false; openCard('reportCard'); });
$('gmQuit').addEventListener('click', () => { closeAllCards(); goMainMenu(); });
$('gmPause').addEventListener('click', () => { togglePause(); closeCard(); });
$('ctrlB').addEventListener('click', () => openCard('ctrlCard'));
// mode Halloween (citrouille en haut du menu) : en jeu, on ne voit que dans la direction de sa souris (render-iso.js)
function refreshHalloB() {
  const b = $('halloB'); b.classList.toggle('on', HALLO.on); b.innerHTML = HALLO.on ? '🎃<small>ON</small>' : '🎃';
  b.title = HALLO.on ? 'Mode Halloween : activé (on ne voit que dans la direction de sa souris) — toucher pour le couper' : 'Mode Halloween : désactivé — toucher pour l’activer';
}
$('halloB').addEventListener('click', () => {
  setHalloween(!HALLO.on);
  flash(HALLO.on ? '🎃 Mode Halloween : en jeu, tu ne vois que dans la direction de ta souris !' : 'Mode Halloween coupé', true);
});
refreshHalloB();
$('ctrlBack').addEventListener('click', closeCard);
$('repBack').addEventListener('click', closeCard);

// ---------- pause pour tout le monde (en ligne) ----------
// n'importe qui met en pause (son pseudo s'affiche) ; seul lui ou l'hôte relance. L'hôte arrête la simulation.
const canUnpause = () => !!G.pz && (G.pz.by === G.myId || G.net === 'host');
function setPause(id, on) {                                  // côté hôte
  if (on && !G.pz) { const h = humanById(id); G.pz = { by: id, name: h ? humanLabel(h) : '?' }; }
  else if (!on && G.pz && (G.pz.by === id || id === G.hostId)) G.pz = null;
}
function togglePause() {
  if (!G.net) return;
  const on = !G.pz;
  if (!on && !canUnpause()) return;
  if (G.net === 'guest') netSend({ t: 'pause', on }); else setPause(G.myId, on);
}
$('pauseResume').addEventListener('click', togglePause);
function pauseFrame() {
  const show = !!(G.net && G.pz);
  $('pauseBanner').style.display = show ? '' : 'none';
  if (!show) return;
  $('pauseText').textContent = '⏸ Pause demandée par ' + G.pz.name;
  $('pauseResume').style.display = canUnpause() ? '' : 'none';
}

// ---------- signalement : état du jeu + ses 10 dernières secondes ----------
const DBG = { frames: [], acc: 0, errors: [] };
window.addEventListener('error', ev => { DBG.errors.push(String(ev.message || ev.error || '?').slice(0, 200) + (ev.filename ? ' @' + ev.filename.split('/').pop() + ':' + ev.lineno : '')); if (DBG.errors.length > 10) DBG.errors.shift(); });
window.addEventListener('unhandledrejection', ev => { DBG.errors.push('promise: ' + String(ev.reason).slice(0, 200)); if (DBG.errors.length > 10) DBG.errors.shift(); });
function dbgRecord(dt) {                                      // 5 images par seconde, 10 s gardées
  DBG.acc += dt; if (DBG.acc < 0.2) return; DBG.acc = 0;
  DBG.frames.push({ t: +G.time.toFixed(1), ph: G.phase, off: G.off, d: [disc.mode, r1(disc.x), r1(disc.y), idx(disc.holder)],
    p: players.map(p => [r1(p.x), r1(p.y), p.dive > 0 ? 1 : p.down > 0 ? 2 : p.jump > 0 ? 3 : 0]) });
  if (DBG.frames.length > 50) DBG.frames.shift();
}
function buildReport() {
  const pl = p => ({ x: r2(p.x), y: r2(p.y), vx: r2(p.vx), vy: r2(p.vy), tx: r2(p.tx), ty: r2(p.ty), sp: r2(p.sp), role: p.role, state: p.state,
    dive: r2(p.dive), down: r2(p.down), jump: r2(p.jump), jprep: r2(p.jprep), match: idx(p.match), zslot: p.zslot });
  return {
    v: 'ultimate-report-1', at: new Date().toISOString(), desc: $('repDesc').value.slice(0, 1000),
    user: { name: myName(), account: (accGet() || {}).name || null },   // qui l'envoie (le serveur vérifie le compte)
    ua: navigator.userAgent, screen: [innerWidth, innerHeight], touch: isTouch(), gamepad: !!G.gpActive, ctrl: CTRL,
    net: G.net, myId: G.myId, me: G.me, spectator: G.spectator, humans: G.humans.map(h => ({ id: h.id, team: h.team, sel: idx(h.sel), name: h.name || '' })),
    mode: G.tuto ? 'tuto ' + G.tuto.step : G.practice ? 'practice' : G.series ? 'series ' + G.series.cur : G.net ? 'online' : 'solo',
    phase: G.phase, off: G.off, score: G.score, receiving: G.receiving, stall: r2(G.stall), marker: idx(G.marker), pickup: idx(G.pickup), carryTo: G.carryTo,
    wind: G.wind, curve: G.curve, loft: G.loft, form: G.form, ai: G.ai, pull: G.pull, pullUI: G.pullUI, oplay: G.oplay && G.oplay.type, dplay: G.dplay && G.dplay.type,
    disc: { mode: disc.mode, holder: idx(disc.holder), x: r2(disc.x), y: r2(disc.y), z: r2(disc.z || 0), sx: r2(disc.sx), sy: r2(disc.sy), cx: r2(disc.cx), cy: r2(disc.cy),
      ex: r2(disc.ex), ey: r2(disc.ey), t: r2(disc.t), dur: r2(disc.dur), team: disc.team, intended: idx(disc.intended), kind: disc.kind, loft: disc.loft, pull: !!disc.pull },
    diag: { perf: typeof perfDiag === 'function' ? perfDiag() : null, net: typeof netDiag === 'function' ? netDiag() : null },   // fluidité, connexion
    players: players.map(pl), frames: DBG.frames, errors: DBG.errors
  };
}
// envoi direct au développeur (serveur du site : /api/report) ; si ça échoue, on propose de copier le rapport
$('repSend').addEventListener('click', () => {
  const a = accGet(), txt = JSON.stringify(Object.assign(buildReport(), a ? { auth: { name: a.name, token: a.token } } : {}));   // le jeton ne sert qu'à vérifier le compte (il n'est pas gardé)
  $('repSend').disabled = true; $('repStatus').textContent = 'Envoi…';
  fetch('api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: txt })
    .then(r => r.json().catch(() => ({})).then(j => (r.ok ? j : { error: j.error || 'erreur ' + r.status })))
    .catch(() => ({ error: 'serveur injoignable' }))
    .then(j => {
      $('repSend').disabled = false;
      if (j.error) { $('repStatus').textContent = '⚠️ Envoi impossible (' + j.error + ') : touche « Copier le rapport » et envoie-le au développeur.'; return; }
      $('repDesc').value = '';
      $('repStatus').textContent = '✅ Rapport envoyé au développeur (n° ' + j.id + '). Merci !';
    });
});
$('repCopy').addEventListener('click', () => {
  const txt = JSON.stringify(buildReport());
  const fallback = () => {
    $('repOut').style.display = ''; $('repOut').value = txt; $('repOut').focus(); $('repOut').select();
    $('repStatus').textContent = 'Copie automatique impossible : sélectionne tout le texte ci-dessous, copie-le et envoie-le au développeur.';
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => { $('repStatus').textContent = '✅ Rapport copié (' + Math.round(txt.length / 1024) + ' Ko) : colle-le dans un message au développeur.'; }, fallback);
  else fallback();
});
// recharger un rapport (outil de diagnostic, depuis la console) : loadReport(<texte du rapport>)
function loadReport(r) {
  if (typeof r === 'string') r = JSON.parse(r);
  Object.assign(G.form, r.form || {}); Object.assign(G.ai, r.ai || {});
  G.off = r.off; G.score = r.score; G.receiving = r.receiving; G.wind = r.wind; G.curve = r.curve || 0; G.stall = r.stall || 0;
  r.players.forEach((q, i) => Object.assign(players[i], q, { match: q.match >= 0 ? players[q.match] : null }));
  const d = r.disc;
  Object.assign(disc, d, { holder: d.holder >= 0 ? players[d.holder] : null, intended: d.intended >= 0 ? players[d.intended] : null, rolled: new Set() });
  G.pickup = r.pickup >= 0 ? players[r.pickup] : null; G.carryTo = r.carryTo;
  G.phase = r.phase === 'pull' || r.phase === 'play' ? r.phase : 'play';
  $('overlay').classList.add('hidden'); G.menuShown = false;
}

// ---------- admin : lire les signalements et les avis (et savoir qu'il y en a de nouveaux) ----------
// les listes sont relues en arrivant au menu principal et toutes les 2 minutes ; « vu » jusqu'au plus récent ouvert (gardé avec le compte)
const repAdmin = () => { const a = typeof accGet === 'function' && accGet(); return a && a.admin ? a : null; };
const REPK = {
  bug: { cache: [], seen: 'uf-rep-seen', btn: 'repAdminB', badge: 'repBadge', title: '🐞 Signalements', none: 'Aucun rapport pour l’instant.', one: 'rapport' },
  avis: { cache: [], seen: 'uf-fb-seen', btn: 'fbAdminB', badge: 'fbBadge', title: '💬 Avis des joueurs', none: 'Aucun avis pour l’instant.', one: 'avis' }
};
let repAt = -1e9, repKind = 'bug';
let repCache = REPK.bug.cache;                                  // (compatibilité)
const repPost = body => fetch('api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(r => r.json().catch(() => ({})).then(j => (r.ok ? j : { error: j.error || 'erreur ' + r.status }))).catch(() => ({ error: 'serveur injoignable' }));
const repNew = k => { const K = REPK[k], seen = +storeGet(K.seen, 0) || 0; return repAdmin() ? K.cache.filter(r => r.at > seen).length : 0; };
function repBadge() {
  let any = 0;
  for (const k of Object.keys(REPK)) { const n = repNew(k), b = $(REPK[k].badge); b.style.display = n ? '' : 'none'; b.textContent = n; any += n; }
  $('menuB').textContent = any ? '☰ Menu ' + (repNew('bug') ? '🐞' : '💬') : '☰ Menu';
}
function repPoll(force) {
  const a = repAdmin();
  for (const k of Object.keys(REPK)) $(REPK[k].btn).style.display = a ? '' : 'none';
  if (!a) { for (const k of Object.keys(REPK)) REPK[k].cache = []; repBadge(); return; }
  if (!force && G.time - repAt < 120) return;
  repAt = G.time;
  for (const k of Object.keys(REPK)) repPost({ name: a.name, token: a.token, kind: k }).then(j => { if (Array.isArray(j.reports)) { REPK[k].cache = j.reports; repBadge(); } });
}
function repRender(status) {
  const K = REPK[repKind], list = K.cache, seen = +storeGet(K.seen, 0) || 0, day = t => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  $('repListTitle').textContent = K.title;
  $('repListStatus').textContent = status || (list.length ? list.length + ' ' + K.one + (list.length > 1 && K.one !== 'avis' ? 's' : '') + ' (les plus récents en haut)' : K.none);
  $('repList').innerHTML = list.map(r => `<li class="${r.at > seen ? 'new' : ''}"><div class="rh"><b>${esc(r.user || 'anonyme')}</b><span>${day(r.at)}</span><span>${esc(r.mode || '')}</span><span>${esc(r.device || '')}</span><span>n° ${esc(r.id)}</span></div>
    <div class="rd">${esc(r.descr || '(sans description)')}</div><button data-id="${esc(r.id)}">Copier ${repKind === 'avis' ? 'l’avis' : 'le rapport'} complet</button></li>`).join('');
  $('repList').querySelectorAll('button').forEach(b => b.addEventListener('click', () => repCopyOne(b.dataset.id, b)));
}
function repCopyOne(id, btn) {
  const a = repAdmin(); if (!a) return;
  btn.textContent = '…';
  repPost({ name: a.name, token: a.token, id }).then(j => {
    if (j.error) { btn.textContent = '⚠️ ' + j.error; return; }
    const txt = JSON.stringify(j), fallback = () => { $('repListOut').style.display = ''; $('repListOut').value = txt; $('repListOut').select(); btn.textContent = 'Sélectionné ci-dessous'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => { btn.textContent = 'Copié ✓'; }, fallback); else fallback();
  });
}
function repOpen(kind) {
  repKind = kind; const K = REPK[kind];
  openCard('repListCard'); $('repListOut').style.display = 'none';
  repRender('Chargement…');
  const a = repAdmin(); if (!a) return;
  repPost({ name: a.name, token: a.token, kind }).then(j => {
    if (j.error) { repRender('⚠️ ' + j.error); return; }
    K.cache = j.reports || []; if (kind === 'bug') repCache = K.cache; repRender();
    if (K.cache.length) storeSet(K.seen, Math.max(+storeGet(K.seen, 0) || 0, K.cache[0].at));   // ouverts : tous vus
    repBadge();
  });
}
$('repAdminB').addEventListener('click', () => repOpen('bug'));
$('fbAdminB').addEventListener('click', () => repOpen('avis'));
$('repListBack').addEventListener('click', closeCard);

// ---------- « Donner mon avis » (menu principal et menu en jeu) : un retour libre, rangé à part des signalements ----------
// (pas de smileys : un clic suffisait, et on n'écrivait plus rien ; un vrai mot est bien plus utile)
function fbOpen() {
  $('fbStatus').textContent = ''; $('fbSend').disabled = false;
  openCard('feedbackCard');
}
$('fbSend').addEventListener('click', () => {
  const txt = $('fbText').value.trim();
  if (txt.length < 3) { $('fbStatus').textContent = 'Écris quelques mots avant d’envoyer.'; return; }
  const a = accGet(), body = {
    v: 'ultimate-report-1', kind: 'avis', at: new Date().toISOString(), desc: txt.slice(0, 1000),
    user: { name: myName(), account: (a || {}).name || null }, ua: navigator.userAgent, screen: [innerWidth, innerHeight], touch: isTouch(),
    mode: G.tuto ? 'tuto' : G.practice ? 'practice' : G.series ? (G.series.endless ? 'infini' : 'tournoi') : G.net ? 'en ligne' : G.attract ? 'menu' : 'solo',
    phase: G.phase, score: G.score, net: G.net, career: typeof careerGet === 'function' ? careerGet() : null,
    diag: { perf: typeof perfDiag === 'function' ? perfDiag() : null, net: typeof netDiag === 'function' ? netDiag() : null }, errors: DBG.errors, frames: []
  };
  if (a) body.auth = { name: a.name, token: a.token };              // (vérifie le compte, n'est pas gardé)
  $('fbSend').disabled = true; $('fbStatus').textContent = 'Envoi…';
  fetch('api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(r => r.json().catch(() => ({})).then(j => (r.ok ? j : { error: j.error || 'erreur ' + r.status })))
    .catch(() => ({ error: 'serveur injoignable' }))
    .then(j => {
      $('fbSend').disabled = false;
      if (j.error) { $('fbStatus').textContent = '⚠️ Envoi impossible (' + j.error + '). Réessaie dans un instant.'; return; }
      $('fbText').value = '';
      $('fbStatus').textContent = '✅ Merci ! Ton avis est bien arrivé.';
    });
});
$('feedbackB').addEventListener('click', fbOpen);
$('gmFeedback').addEventListener('click', fbOpen);
$('fbBack').addEventListener('click', closeCard);
setInterval(() => repPoll(false), 120000);
