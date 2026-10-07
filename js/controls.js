// controls.js — Contrôles : souris, clavier, tactile, joystick virtuel

// =====================================================================
//  Contrôles (souris, clavier, tactile)
// =====================================================================
function adjustCurve(v) { setCurve(Math.round((G.curve + v) * 100) / 100); }
function setCurve(v) { G.curve = clamp(v, -1, 1); $('curveRange').value = G.curve; }
function switchDefender() { if (defending()) doSwitch(G.me); }
function userDive() { if (defending()) { doDive(G.me, G.pointer.x, G.pointer.y); G.pointer.last = G.time; } }
function toWorld(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / S - M, y: (e.clientY - r.top) / S - M }; }
function setPointer(e) { const w = toWorld(e); G.pointer.x = w.x; G.pointer.y = w.y; G.pointer.active = true; G.pointer.last = G.time; sendInput(); }

const isTouch = () => document.body.classList.contains('touch');
// sur téléphone en défense, le terrain ne sert qu'à taper sur un de ses joueurs (le joystick gère le déplacement)
const touchDefense = e => e.pointerType !== 'mouse' && isTouch() && defending();
canvas.addEventListener('pointermove', e => { if (!touchDefense(e)) setPointer(e); });
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (G.phase === 'pull') {                                  // pull : choisir la cible, puis arrêter la jauge
    setPointer(e); const w = toWorld(e); pullPointerDown(w.x, w.y); return;
  }
  if (touchDefense(e)) {
    const w = toWorld(e), [p, d] = nearestD(TEAMS[G.me], w.x, w.y);
    if (p && d < 2.5) doSelect(G.me, p);
    return;
  }
  Object.assign(G.pointer, { down: true, downT: G.time, type: e.pointerType });
  setPointer(e);
  G.pointer.downX = G.pointer.x; G.pointer.downY = G.pointer.y;
  if (canThrow()) G.aiming = true;
  else if (defending() && e.pointerType === 'mouse') userDive();
  canvas.setPointerCapture(e.pointerId);
  sendInput(true);
});
function pointerEnd(e) {
  if (G.phase === 'pull' || touchDefense(e)) return;
  setPointer(e);
  G.pointer.down = false;
  if (G.aiming && canThrow()) {
    const h = disc.holder;
    if (dist(G.pointer.x, G.pointer.y, h.x, h.y) >= CANCEL_R) doThrow(G.pointer.x, G.pointer.y, G.curve);
  } else if (defending() && e.pointerType !== 'mouse' && G.time - G.pointer.downT < 0.25
    && dist(G.pointer.x, G.pointer.y, G.pointer.downX, G.pointer.downY) < 1.5) userDive();
  G.aiming = false;
  sendInput(true);
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', e => { G.pointer.down = false; G.aiming = false; sendInput(true); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); adjustCurve(e.deltaY > 0 ? 0.1 : -0.1); }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') { if (e.key === 'Enter') $('joinGo').click(); return; }
  const k = e.key.toLowerCase();
  if (k === 'a' || k === 'q' || k === 'arrowleft') adjustCurve(-0.25);
  else if (k === 'e' || k === 'd' || k === 'arrowright') adjustCurve(0.25);
  else if ((k === ' ' || k === 'enter') && localPuller()) { e.preventDefault(); pullStop(); }
  else if (k === 'escape' && localPuller()) pullBack();
  else if (k === ' ') { e.preventDefault(); switchDefender(); }
  else if (k === 'f' || k === 'shift') userDive();
  else if (k === 'enter' && G.menuShown && $('stratCard').style.display !== 'none' && !$('go').disabled) $('go').click();
});
$('curveL').addEventListener('click', () => adjustCurve(-0.25));
$('curveR').addEventListener('click', () => adjustCurve(0.25));
$('curveRange').addEventListener('input', e => setCurve(+e.target.value));
$('switchD').addEventListener('click', switchDefender);
$('diveB').addEventListener('click', userDive);
$('muteB').addEventListener('click', toggleMute);
if (FX.muted) $('muteB').textContent = '🔇';

// ---------- joystick virtuel (téléphone, en défense) ----------
const joy = { active: false, id: null, dx: 0, dy: 0 };
function joyUpdate(e) {
  const r = $('joy').getBoundingClientRect(), R0 = r.width / 2;
  let dx = (e.clientX - r.left - R0) / R0, dy = (e.clientY - r.top - R0) / R0;
  const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  joy.dx = dx; joy.dy = dy;
  $('knob').style.transform = `translate(${dx * R0 * 0.62}px, ${dy * R0 * 0.62}px)`;
}
$('joy').addEventListener('pointerdown', e => {
  e.preventDefault(); joy.active = true; joy.id = e.pointerId;
  $('joy').setPointerCapture(e.pointerId); joyUpdate(e);
});
$('joy').addEventListener('pointermove', e => { if (joy.active && e.pointerId === joy.id) joyUpdate(e); });
function joyEnd(e) {
  if (e.pointerId !== joy.id) return;
  joy.active = false; joy.dx = joy.dy = 0; $('knob').style.transform = '';
  const sel = G.sel[G.me];
  if (sel) { G.pointer.x = sel.x; G.pointer.y = sel.y; }      // il s'arrête là où il est
  G.pointer.down = false; G.pointer.last = G.time; sendInput(true);
}
$('joy').addEventListener('pointerup', joyEnd);
$('joy').addEventListener('pointercancel', joyEnd);
// à chaque image : le joystick place la cible juste devant le défenseur (la vitesse suit l'inclinaison)
function joyFrame() {
  if (!joy.active || !defending()) return;
  const sel = G.sel[G.me]; if (!sel) return;
  const m = Math.hypot(joy.dx, joy.dy), k = m < 0.12 ? 0 : 3.2;
  G.pointer.x = sel.x + joy.dx * k; G.pointer.y = sel.y + joy.dy * k;
  G.pointer.down = true; G.pointer.active = true; G.pointer.last = G.time;
  sendInput();
}
function touchDive() {
  if (!defending()) return;
  const sel = G.sel[G.me]; if (!sel) return;
  let dx = joy.dx, dy = joy.dy;
  if (Math.hypot(dx, dy) < 0.2) { dx = sel.vx; dy = sel.vy; }            // sinon dans le sens de sa course
  if (Math.hypot(dx, dy) < 0.2) { dx = disc.x - sel.x; dy = disc.y - sel.y; } // sinon vers le disque
  const l = Math.hypot(dx, dy) || 1;
  doDive(G.me, sel.x + dx / l * 3, sel.y + dy / l * 3);
}
for (const [id, fn] of [['tDive', touchDive], ['tSwitch', switchDefender]])
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

