// menu.js — Menu en jeu (☰), pause pour tout le monde en ligne, panneau Commandes, signalement d'un problème.

// ---------- cartes par-dessus le jeu (on revient toujours à l'écran d'avant) ----------
const CARDS = ['lobbyCard', 'stratCard', 'seriesCard', 'profileCard', 'gameMenuCard', 'ctrlCard', 'reportCard', 'newsCard', 'moveCard', 'endlessCard', 'accountCard', 'sysCard'];
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
function resetCards() { cardStack.length = 0; for (const c of ['gameMenuCard', 'ctrlCard', 'reportCard']) $(c).style.display = 'none'; G.paused = false; }

// ---------- menu en jeu ----------
function renderGameMenu() {
  $('gmPause').style.display = G.net && G.started ? '' : 'none';
  $('gmPause').textContent = G.pz ? (canUnpause() ? '▶ Relancer la partie' : '⏸ En pause…') : '⏸ Pause pour tout le monde';
  $('gmQuit').textContent = G.net ? '✕ Quitter la partie en ligne' : G.tuto ? '✕ Quitter le tutoriel' : G.practice ? '✕ Quitter l’entraînement' : '✕ Quitter le match';
}
$('menuB').addEventListener('click', () => { if ($('gameMenuCard').style.display === 'none') openCard('gameMenuCard'); });
$('gmResume').addEventListener('click', closeCard);
$('gmCtrl').addEventListener('click', () => openCard('ctrlCard'));
$('gmReport').addEventListener('click', () => { $('repStatus').textContent = ''; $('repOut').style.display = 'none'; openCard('reportCard'); });
$('gmQuit').addEventListener('click', () => { closeAllCards(); goMainMenu(); });
$('gmPause').addEventListener('click', () => { togglePause(); closeCard(); });
$('ctrlB').addEventListener('click', () => openCard('ctrlCard'));
$('ctrlBack').addEventListener('click', closeCard);
$('repBack').addEventListener('click', closeCard);

// ---------- pause pour tout le monde (en ligne) ----------
// n'importe qui met en pause (son pseudo s'affiche) ; seul lui ou l'hôte relance. L'hôte arrête la simulation.
const canUnpause = () => !!G.pz && (G.pz.by === G.myId || G.net === 'host');
function setPause(id, on) {                                  // côté hôte
  if (on && !G.pz) { const h = humanById(id); G.pz = { by: id, name: h ? humanLabel(h) : '?' }; }
  else if (!on && G.pz && (G.pz.by === id || id === 0)) G.pz = null;
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
    ua: navigator.userAgent, screen: [innerWidth, innerHeight], touch: isTouch(), gamepad: !!G.gpActive, ctrl: CTRL,
    net: G.net, myId: G.myId, me: G.me, spectator: G.spectator, humans: G.humans.map(h => ({ id: h.id, team: h.team, sel: idx(h.sel), name: h.name || '' })),
    mode: G.tuto ? 'tuto ' + G.tuto.step : G.practice ? 'practice' : G.series ? 'series ' + G.series.cur : G.net ? 'online' : 'solo',
    phase: G.phase, off: G.off, score: G.score, receiving: G.receiving, stall: r2(G.stall), marker: idx(G.marker), pickup: idx(G.pickup), carryTo: G.carryTo,
    wind: G.wind, curve: G.curve, throwKind: G.throwKind, form: G.form, ai: G.ai, pull: G.pull, pullUI: G.pullUI, oplay: G.oplay && G.oplay.type, dplay: G.dplay && G.dplay.type,
    disc: { mode: disc.mode, holder: idx(disc.holder), x: r2(disc.x), y: r2(disc.y), z: r2(disc.z || 0), sx: r2(disc.sx), sy: r2(disc.sy), cx: r2(disc.cx), cy: r2(disc.cy),
      ex: r2(disc.ex), ey: r2(disc.ey), t: r2(disc.t), dur: r2(disc.dur), team: disc.team, intended: idx(disc.intended), kind: disc.kind, pull: !!disc.pull },
    players: players.map(pl), frames: DBG.frames, errors: DBG.errors
  };
}
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
