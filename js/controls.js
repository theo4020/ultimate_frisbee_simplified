// controls.js — Contrôles : souris, clavier, tactile, joystick virtuel

// =====================================================================
//  Contrôles (souris, clavier, tactile)
// =====================================================================
function adjustCurve(v) { setCurve(Math.round((G.curve + v) * 100) / 100); }
function setCurve(v) {
  G.curve = clamp(v, -1, 1); $('curveRange').value = G.curve;
  const th = $('curveVThumb'); if (th) th.style.top = ((G.curve + 1) / 2 * 100) + '%';
}
function switchDefender() { if (canSwitchNow(meH())) doSwitch(); }
// layout possible en défense, et en attaque quand ton équipe a le disque en l'air
// layout : en défense ; à plusieurs dans l'équipe, à tout moment avec ton joueur (s'il n'a pas le disque) ;
// seul en attaque, quand ton équipe a le disque en l'air
function canLayout() {
  if (G.phase !== 'play' || G.spectator) return false;
  if (defending()) return true;
  const h = meH();
  if (h && !soloStyle(G.me)) return !!h.sel && !(disc.holder === h.sel && (disc.mode === 'held' || disc.mode === 'carry'));
  return disc.mode === 'air' && disc.team === G.me && !disc.pull;
}
// point visé par un layout au stick (téléphone, manette) : dans la direction du stick, sinon de sa course, sinon vers le disque
function stickDive(dx, dy) {
  const sel = (meH() || {}).sel;
  if (!sel || (attacking() && soloStyle(G.me))) return [disc.ex, disc.ey];   // seul en attaque : le receveur va au disque
  if (Math.hypot(dx, dy) < 0.2) { dx = sel.vx; dy = sel.vy; }
  if (Math.hypot(dx, dy) < 0.2) { dx = disc.x - sel.x; dy = disc.y - sel.y; }
  const l = Math.hypot(dx, dy) || 1;
  return [sel.x + dx / l * 3, sel.y + dy / l * 3];
}
function userJump() { if (canJump()) { doJump(); G.pointer.last = G.time; } }
function userDive() { if (canLayout()) { doDive(G.pointer.x, G.pointer.y); G.pointer.last = G.time; } }
function toWorld(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / S - M, y: (e.clientY - r.top) / S - M }; }
function setPointer(e) { const w = toWorld(e); G.pointer.x = w.x; G.pointer.y = w.y; G.pointer.active = true; G.pointer.last = G.time; sendInput(); }
const attacking = () => G.phase === 'play' && G.off === G.me;
// taper / cliquer sur un de ses joueurs pour le prendre (s'il est géré par l'IA)
function trySelectAt(w, r = 2.2) {
  const h = meH(); if (!canSwitchNow(h)) return false;
  const [p, d] = nearestD(TEAMS[G.me].filter(q => !takenByOther(q, h)), w.x, w.y);
  if (p && d < r && p !== h.sel) { doSelect(p); return true; }
  return false;
}

const isTouch = () => document.body.classList.contains('touch');
// téléphone : tout le tactile est géré par gestures.js (ici : souris et stylet)
const touchUI = e => e.pointerType !== 'mouse' && isTouch();
// souris : la visée suit le curseur partout dans la fenêtre (pas seulement sur le terrain), et un clic hors du terrain
// (bords de l'écran, sauf sur un bouton ou un menu) compte comme un clic sur le terrain : on peut viser et lancer hors des lignes
const inGame = () => (G.phase === 'play' || G.phase === 'pull') && $('overlay').classList.contains('hidden') && !G.paused;
window.addEventListener('pointermove', e => { if (!touchUI(e) && (e.target === canvas || inGame())) setPointer(e); });
window.addEventListener('pointerdown', e => {
  if (e.target === canvas || touchUI(e) || e.pointerType !== 'mouse' || !inGame() || fdOnUI(e.target)) return;
  fieldDown(e);
});
window.addEventListener('contextmenu', e => { if (inGame() && !fdOnUI(e.target)) e.preventDefault(); });
canvas.addEventListener('pointerdown', fieldDown);
function fieldDown(e) {
  e.preventDefault();
  G.gpActive = false;
  if (G.replay) { stopReplay(); return; }
  if (touchUI(e)) {                                          // téléphone : gestures.js ; ici, seulement le tap qui arrête la jauge du pull
    if (G.phase === 'pull' && G.pullUI && G.pullUI.stage === 'power') pullStop();
    return;
  }
  if (G.phase === 'pull') { setPointer(e); const w = toWorld(e); pullPointerDown(w.x, w.y); return; }   // pull : la cible, puis la jauge
  if (e.button === 2) {                                      // clic droit : saut dès que tu contrôles un joueur ; sinon (tu lances, seul en attaque) appel de cut, ou saut du receveur pendant le vol
    const w = toWorld(e);
    const h = meH(), mine = h && h.sel && !(disc.holder === h.sel && disc.mode !== 'air');
    if (mine) userJump();                                     // tu contrôles un joueur (sans le disque) : il saute, toujours
    else if (attacking() && disc.mode === 'held') doCall(w.x, w.y);   // tu lances : appel de cut
    else if (canJump()) userJump();                           // seul en attaque, disque en vol : ton receveur saute
    return;
  }
  Object.assign(G.pointer, { down: true, downT: G.time, type: e.pointerType });
  setPointer(e);
  G.pointer.downX = G.pointer.x; G.pointer.downY = G.pointer.y;
  if (canThrow()) G.aiming = true;
  else if (trySelectAt(G.pointer, 1.6)) { /* clic sur un coéquipier géré par l'IA : tu le prends */ }
  else if (canLayout() && e.pointerType === 'mouse') userDive();
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
  sendInput(true);
}
function pointerEnd(e) {
  if (touchUI(e) || G.phase === 'pull' || !G.pointer.down) return;
  if (e.button === 2) return;
  setPointer(e);
  G.pointer.down = false;
  if (G.aiming && canThrow()) {
    const h = disc.holder;
    if (dist(G.pointer.x, G.pointer.y, h.x, h.y) >= CANCEL_R) doThrow(G.pointer.x, G.pointer.y, G.curve);
  }
  G.aiming = false;
  sendInput(true);
}
window.addEventListener('pointerup', pointerEnd);            // relâché n'importe où (même hors du terrain)
canvas.addEventListener('pointercancel', e => { if (touchUI(e)) return; G.pointer.down = false; G.aiming = false; sendInput(true); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); adjustCurve(e.deltaY > 0 ? 0.1 : -0.1); }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target.type !== 'range'))) { if (e.key === 'Enter' && e.target.id === 'joinCode') $('joinGo').click(); return; }
  const k = e.key.toLowerCase();
  if (keyWait) { e.preventDefault(); captureKey(k); return; }   // réglage d'une touche (panneau Commandes)
  if (G.replay) { if (k === 'escape' || k === ' ' || k === 'enter') { e.preventDefault(); stopReplay(); } return; }
  if (keyIs('play1', k)) { doPlay(1); return; }
  if (keyIs('play2', k)) { doPlay(2); return; }
  if (keyIs('high', k)) { if (!e.repeat) pivotBtnDown(); return; }
  if (keyIs('curveL', k)) adjustCurve(-0.25);
  else if (keyIs('curveR', k)) adjustCurve(0.25);
  else if ((k === ' ' || k === 'enter') && localPuller()) { e.preventDefault(); pullStop(); }
  else if (k === 'escape' && localPuller()) pullBack();
  else if (keyIs('switch', k)) { e.preventDefault(); switchDefender(); }
  else if (k >= '1' && k <= '5') {                           // touches 1 à 5 : prendre ce joueur (s'il est géré par l'IA)
    const h = meH(), p = TEAMS[G.me][+k - 1];
    if (canSwitchNow(h) && p && !takenByOther(p, h)) doSelect(p);
  }
  else if (keyIs('dive', k)) userDive();
  else if (keyIs('jump', k)) userJump();
  else if (k === 'enter' && G.menuShown && $('stratCard').style.display !== 'none' && !$('go').disabled) $('go').click();
});
$('curveL').addEventListener('click', () => adjustCurve(-0.25));
$('curveR').addEventListener('click', () => adjustCurve(0.25));
$('curveRange').addEventListener('input', e => setCurve(+e.target.value));
$('switchD').addEventListener('click', switchDefender);
$('diveB').addEventListener('click', userDive);
$('jumpB').addEventListener('click', userJump);
$('muteB').addEventListener('click', toggleMute);
if (FX.muted) $('muteB').textContent = '🔇';

// ---------- joystick flottant (téléphone, réglage « Sans le disque : joystick et boutons ») ----------
// pose le doigt n'importe où sur le terrain et glisse : ton joueur court dans la direction « point de départ → doigt »,
// d'autant plus vite que le doigt est loin (défense, ou attaque à plusieurs) ; les lancers restent des gestes (gestures.js)
const JOY_MAXD = 50;
const joy = { active: false, id: null, dx: 0, dy: 0, mode: null, x0: 0, y0: 0 };
function joyMode() {
  if (G.phase !== 'play' || !isTouch() || CTRL.move !== 'joystick' || canThrow()) return null;
  const h = meH();
  if (h && h.sel && (defending() || !soloStyle(h.team))) return 'move';
  return null;
}
const joyRadius = () => clamp(window.innerHeight * 0.17, 48, 85);   // px : doigt à cette distance du départ = pleine vitesse
// appelé par gestures.js quand un doigt commence à glisser alors que ton joueur peut courir
function joyStart(id, x0, y0) {
  Object.assign(joy, { active: true, id, x0, y0, dx: 0, dy: 0, mode: joyMode() });
  const el = $('joy'), R = joyRadius();
  el.style.left = x0 + 'px'; el.style.top = y0 + 'px'; el.style.width = el.style.height = R * 2 + 'px';
  document.body.classList.add('joyheld');
}
function joyMove(x, y) {
  const R = joyRadius();
  let dx = (x - joy.x0) / R, dy = (y - joy.y0) / R;
  const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  joy.dx = dx; joy.dy = dy;
  $('knob').style.transform = `translate(${dx * R}px, ${dy * R}px)`;
}
function joyEnd() {
  if (!joy.active) return;
  const sel = (meH() || {}).sel;
  if (sel) { G.pointer.x = sel.x; G.pointer.y = sel.y; }        // il s'arrête là où il est
  G.pointer.down = false; G.pointer.last = G.time; sendInput(true);
  joy.active = false; joy.id = null; joy.dx = joy.dy = 0; joy.mode = null; $('knob').style.transform = '';
  document.body.classList.remove('joyheld');
}
// à chaque image
function joyFrame() {
  const mode = joyMode();
  document.body.classList.toggle('joyon', !!mode);
  if (joy.active && G.phase !== 'play') joyEnd();             // fin du point : le doigt ne commande plus rien
  document.body.classList.toggle('canlayout', canLayout());
  document.body.classList.toggle('canswitch', canSwitchNow(meH()));
  document.body.classList.toggle('canjump', canJump());
  if (!joy.active) return;
  joy.mode = mode;
  const m = Math.hypot(joy.dx, joy.dy);
  if (mode === 'move') {                                      // déplacement : la vitesse suit l'inclinaison
    const sel = meH().sel, k = m < 0.15 ? 0 : 3.2;
    G.pointer.x = sel.x + joy.dx * k; G.pointer.y = sel.y + joy.dy * k;
    G.pointer.down = true; G.pointer.active = true; G.pointer.last = G.time;
    sendInput();
  }
}
function touchDive() { if (canLayout()) doDive(...stickDive(joy.dx, joy.dy)); }
for (const [id, fn] of [['tDive', touchDive], ['tSwitch', switchDefender], ['tJump', userJump]])
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
const fsOK = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
if (!fsOK) $('fsB').style.setProperty('display', 'none', 'important');
$('fsB').addEventListener('click', () => {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else {
    const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
  }
  setTimeout(resize, 300);
});


// ---------- téléphone : outils communs aux gestes (gestures.js) ----------
const fdPull = () => G.phase === 'pull' && localPuller() && G.pullUI && G.pullUI.stage === 'aim' && !!disc.holder;
const fdRadius = () => clamp(window.innerHeight * 0.32, 80, 150);
const fdOnUI = t => !!(t && t.closest && t.closest('button, input, textarea, #controls, #tbtns, #tutoBox, #pracBox, #overlay, #hud, #curveV, #highB, #pauseBanner'));

// ---------- téléphone, réglage « Courbe et passe haute : boutons » : curseur de courbe et bouton sur le bord droit ----------
// haut = courbe ↶ (comme A), bas = courbe ↷ (comme E)
function curveVFrom(e) {
  const r = $('curveV').getBoundingClientRect();
  const v = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
  setCurve(Math.round(v * 20) / 20);
}
let curveVId = null;
$('curveV').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); curveVId = e.pointerId; $('curveV').setPointerCapture(e.pointerId); curveVFrom(e); });
$('curveV').addEventListener('pointermove', e => { if (e.pointerId === curveVId) curveVFrom(e); });
$('curveV').addEventListener('pointerup', e => { if (e.pointerId === curveVId) curveVId = null; });
$('curveV').addEventListener('pointercancel', () => { curveVId = null; });
$('curveV').addEventListener('dblclick', () => setCurve(0));
$('highB').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pivotBtnDown(); });
$('highB').addEventListener('pointerup', e => { e.preventDefault(); e.stopPropagation(); pivotBtnUp(); });
$('highB').addEventListener('pointercancel', () => pivotBtnCancel());
window.addEventListener('keyup', e => { if (keyIs('high', e.key.toLowerCase())) pivotBtnUp(); });
