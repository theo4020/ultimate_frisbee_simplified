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
const canLayout = () => G.phase === 'play' && (defending() || (disc.mode === 'air' && disc.team === G.me && !disc.pull));
function userJump() { if (canJump()) { doJump(); G.pointer.last = G.time; } }
function userDive() { if (canLayout()) { doDive(G.pointer.x, G.pointer.y); G.pointer.last = G.time; } }
function toWorld(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / S - M, y: (e.clientY - r.top) / S - M }; }
function setPointer(e) { const w = toWorld(e); G.pointer.x = w.x; G.pointer.y = w.y; G.pointer.active = true; G.pointer.last = G.time; sendInput(); }
const attacking = () => G.phase === 'play' && G.off === G.me;
// taper / cliquer sur un de ses joueurs pour le prendre (s'il est géré par l'IA)
function trySelectAt(w) {
  const h = meH(); if (!canSwitchNow(h)) return false;
  const [p, d] = nearestD(TEAMS[G.me].filter(q => !takenByOther(q, h)), w.x, w.y);
  if (p && d < 2.2 && p !== h.sel) { doSelect(p); return true; }
  return false;
}

const isTouch = () => document.body.classList.contains('touch');
// sur téléphone, le terrain sert à taper (prendre un joueur, appeler un cut) ; le joystick gère le reste
const touchField = e => e.pointerType !== 'mouse' && isTouch() && G.phase === 'play';
canvas.addEventListener('pointermove', e => { if (!touchField(e)) setPointer(e); });
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (FD && FD.id === e.pointerId) return;                   // lancer « glissé » en cours (téléphone)
  G.gpActive = false;
  if (G.replay) { stopReplay(); return; }
  if (G.phase === 'pull') {                                  // pull : choisir la cible, puis arrêter la jauge
    setPointer(e); const w = toWorld(e); pullPointerDown(w.x, w.y); return;
  }
  if (touchField(e)) {                                       // téléphone : on note le tap, on agit au relâchement
    const w = toWorld(e); G.tap = { x: w.x, y: w.y, t: G.time }; return;
  }
  if (e.button === 2) {                                      // clic droit en attaque : appeler un cut vers cet espace
    const w = toWorld(e);
    if (attacking()) doCall(w.x, w.y);
    return;
  }
  Object.assign(G.pointer, { down: true, downT: G.time, type: e.pointerType });
  setPointer(e);
  G.pointer.downX = G.pointer.x; G.pointer.downY = G.pointer.y;
  if (canThrow()) G.aiming = true;
  else if (canLayout() && e.pointerType === 'mouse') userDive();
  canvas.setPointerCapture(e.pointerId);
  sendInput(true);
});
function pointerEnd(e) {
  if (FD && FD.id === e.pointerId) return;
  if (G.phase === 'pull') return;
  if (touchField(e)) {
    const tap = G.tap; G.tap = null;
    if (!tap || G.time - tap.t > 0.4) return;
    const w = toWorld(e);
    if (dist(w.x, w.y, tap.x, tap.y) > 2.5) return;
    if (trySelectAt(w)) return;                              // tap sur un de tes joueurs : tu le prends
    if (attacking()) doCall(w.x, w.y);                       // sinon en attaque : appel d'espace
    return;
  }
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
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', e => { if (FD && FD.id === e.pointerId) return; G.pointer.down = false; G.aiming = false; G.tap = null; sendInput(true); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); adjustCurve(e.deltaY > 0 ? 0.1 : -0.1); }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') { if (e.key === 'Enter' && e.target.id === 'joinCode') $('joinGo').click(); return; }
  const k = e.key.toLowerCase();
  if (G.replay) { if (k === 'escape' || k === ' ' || k === 'enter') { e.preventDefault(); stopReplay(); } return; }
  if (k === 'z' || k === 'w') { cycleThrowKind(); return; }
  if (k === 'a' || k === 'q' || k === 'arrowleft') adjustCurve(-0.25);
  else if (k === 'e' || k === 'd' || k === 'arrowright') adjustCurve(0.25);
  else if ((k === ' ' || k === 'enter') && localPuller()) { e.preventDefault(); pullStop(); }
  else if (k === 'escape' && localPuller()) pullBack();
  else if (k === ' ') { e.preventDefault(); switchDefender(); }
  else if (k >= '1' && k <= '5') {                           // touches 1 à 5 : prendre ce joueur (s'il est géré par l'IA)
    const h = meH(), p = TEAMS[G.me][+k - 1];
    if (canSwitchNow(h) && p && !takenByOther(p, h)) doSelect(p);
  }
  else if (k === 'f' || k === 'shift') userDive();
  else if (k === 's') userJump();
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

// ---------- joystick virtuel (téléphone) ----------
// • quand tu as le disque : la direction vise, l'inclinaison règle la distance, relâcher lance
//   (revenir au centre avant de relâcher annule) ;
// • sinon (défense, ou attaque à plusieurs) : il déplace ton joueur.
const JOY_DEAD = 0.18, JOY_MAXD = 50;
const joy = { active: false, id: null, dx: 0, dy: 0, aim: null, mode: null };
function joyMode() {
  if (G.phase !== 'play') return null;
  if (canThrow()) return isTouch() ? null : 'throw';           // téléphone : on lance en glissant n'importe où (voir plus bas)
  const h = meH();
  if (h && h.sel && (defending() || !soloStyle(h.team))) return 'move';
  return null;
}
function joyUpdate(e) {
  const r = $('joy').getBoundingClientRect(), R0 = r.width / 2;
  let dx = (e.clientX - r.left - R0) / R0, dy = (e.clientY - r.top - R0) / R0;
  const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  joy.dx = dx; joy.dy = dy;
  $('knob').style.transform = `translate(${dx * R0 * 0.62}px, ${dy * R0 * 0.62}px)`;
}
$('joy').addEventListener('pointerdown', e => {
  e.preventDefault(); joy.active = true; joy.id = e.pointerId; joy.mode = joyMode();
  $('joy').setPointerCapture(e.pointerId); joyUpdate(e);
});
$('joy').addEventListener('pointermove', e => { if (joy.active && e.pointerId === joy.id) joyUpdate(e); });
function joyEnd(e) {
  if (e.pointerId !== joy.id) return;
  if (joy.mode === 'throw') {
    if (joy.aim && canThrow()) doThrow(joy.aim[0], joy.aim[1], G.curve);
    G.aiming = false; G.pointer.active = false;
  } else {
    const sel = (meH() || {}).sel;
    if (sel) { G.pointer.x = sel.x; G.pointer.y = sel.y; }      // il s'arrête là où il est
    G.pointer.down = false; G.pointer.last = G.time; sendInput(true);
  }
  joy.active = false; joy.dx = joy.dy = 0; joy.aim = null; joy.mode = null; $('knob').style.transform = '';
}
$('joy').addEventListener('pointerup', joyEnd);
$('joy').addEventListener('pointercancel', joyEnd);
// à chaque image
function joyFrame() {
  const mode = joyMode();
  document.body.classList.toggle('joyon', !!mode);
  document.body.classList.toggle('canlayout', canLayout());
  document.body.classList.toggle('canswitch', canSwitchNow(meH()));
  document.body.classList.toggle('canjump', canJump());
  if (!joy.active) return;
  if (joy.mode !== mode) { joy.mode = mode; joy.aim = null; G.aiming = false; }
  const m = Math.hypot(joy.dx, joy.dy);
  if (mode === 'throw') {                                     // visée : direction + distance
    const h = disc.holder;
    if (m < JOY_DEAD) { joy.aim = null; G.aiming = false; G.pointer.active = false; return; }
    const d = (m - JOY_DEAD) / (1 - JOY_DEAD) * JOY_MAXD + 3;
    joy.aim = [h.x + joy.dx / m * d, h.y + joy.dy / m * d];
    G.pointer.x = joy.aim[0]; G.pointer.y = joy.aim[1]; G.pointer.active = true; G.aiming = true;
  } else if (mode === 'move') {                               // déplacement : la vitesse suit l'inclinaison
    const sel = meH().sel, k = m < 0.12 ? 0 : 3.2;
    G.pointer.x = sel.x + joy.dx * k; G.pointer.y = sel.y + joy.dy * k;
    G.pointer.down = true; G.pointer.active = true; G.pointer.last = G.time;
    sendInput();
  }
}
function touchDive() {
  if (!canLayout()) return;
  if (!defending()) { doDive(disc.ex, disc.ey); return; }   // attaque : le receveur plonge vers le disque
  const sel = (meH() || {}).sel; if (!sel) return;
  let dx = joy.dx, dy = joy.dy;
  if (Math.hypot(dx, dy) < 0.2) { dx = sel.vx; dy = sel.vy; }            // sinon dans le sens de sa course
  if (Math.hypot(dx, dy) < 0.2) { dx = disc.x - sel.x; dy = disc.y - sel.y; } // sinon vers le disque
  const l = Math.hypot(dx, dy) || 1;
  doDive(sel.x + dx / l * 3, sel.y + dy / l * 3);
}
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


// ---------- téléphone : lancer en glissant depuis n'importe où ----------
// Le doigt se pose n'importe où (hors boutons) : un joystick apparaît sous lui. La direction du glissé vise,
// sa longueur règle la distance, relâcher lance. Revenir près du point de départ annule.
// Un simple tap (sans glisser) garde son rôle : prendre un joueur ou appeler un cut.
let FD = null;
const FD_DEAD = 16;                                          // px : en dessous, pas de lancer (annulation)
const fdRadius = () => clamp(window.innerHeight * 0.32, 80, 150);
const fdOnUI = t => !!(t && t.closest && t.closest('button, input, #controls, #tbtns, #joy, #tutoBox, #overlay, #hud, #emoBar, #curveV, #highB'));
window.addEventListener('pointerdown', e => {
  if (!isTouch() || e.pointerType === 'mouse' || FD || !canThrow() || fdOnUI(e.target)) return;
  FD = { id: e.pointerId, x0: e.clientX, y0: e.clientY, len: 0, aim: null, t: G.time };
  const el = $('fjoy'); el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px';
  el.style.width = el.style.height = fdRadius() * 2 + 'px'; el.style.display = 'block';
  $('fknob').style.transform = '';
}, true);
window.addEventListener('pointermove', e => {
  if (!FD || e.pointerId !== FD.id) return;
  const R = fdRadius();
  let dx = e.clientX - FD.x0, dy = e.clientY - FD.y0;
  const len = Math.hypot(dx, dy); FD.len = len;
  const k = len > R ? R / len : 1;
  $('fknob').style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  if (!canThrow()) return;
  const h = disc.holder;
  if (len < FD_DEAD) { FD.aim = null; G.aiming = false; G.pointer.active = false; return; }
  const m = Math.min(1, (len - FD_DEAD) / (R - FD_DEAD)), d = 3 + m * JOY_MAXD;
  FD.aim = [h.x + dx / len * d, h.y + dy / len * d];
  G.pointer.x = FD.aim[0]; G.pointer.y = FD.aim[1]; G.pointer.active = true; G.aiming = true;
}, true);
function fdEnd(e, cancel) {
  if (!FD || e.pointerId !== FD.id) return;
  const f = FD; FD = null;
  $('fjoy').style.display = 'none';
  G.aiming = false; G.pointer.active = false;
  if (cancel) return;
  if (f.aim && canThrow()) { doThrow(f.aim[0], f.aim[1], G.curve); return; }
  if (f.len < 12 && G.time - f.t < 0.4) {                    // simple tap : prendre un joueur ou appeler un cut
    const r = canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    const w = toWorld(e);
    if (!trySelectAt(w) && attacking()) doCall(w.x, w.y);
  }
}
window.addEventListener('pointerup', e => fdEnd(e, false), true);
window.addEventListener('pointercancel', e => fdEnd(e, true), true);

// ---------- téléphone : curseur de courbe vertical sur le bord droit ----------
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
$('highB').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleHigh(); });
