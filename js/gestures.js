// gestures.js — Téléphone : tout le tactile sur le terrain (les boutons éventuels dépendent des réglages, voir ctrl.js).
//  Avec le disque (ou pour le pull) :
//   • lancer : poser le doigt n'importe où et tirer en arrière (lance-pierre) — ou vers la cible, selon les réglages ;
//     la longueur règle la distance, relâcher lance, revenir au point de départ annule ;
//   • courbe : pendant la visée, un 2e doigt glisse sur le côté et « pousse » la trajectoire de ce côté ;
//   • taper ton porteur : armer / désarmer la passe haute · taper ailleurs : appeler un cut.
//  Sans le disque :
//   • taper un endroit : ton joueur y va · taper un coéquipier : tu le prends · taper ton joueur : il saute ;
//   • glisser vite n'importe où : layout dans cette direction ;
//   • option « le joueur suit le doigt » : doigt maintenu, ton joueur le suit.

const GS = { prim: null, curve: null };
const GS_DEAD = 16, GS_TAP = 12, GS_SWIPE = 30;               // px
const gsReady = e => gestures() && e.pointerType !== 'mouse' && !fdOnUI(e.target) && !G.replay && !G.paused && !G.pz
  && $('overlay').classList.contains('hidden') && (G.phase === 'play' || G.phase === 'pull');

window.addEventListener('pointerdown', e => {
  if (!gsReady(e)) return;
  const P = GS.prim;
  if (P) {                                                    // 2e doigt pendant la visée : courbe
    if (P.sling && !GS.curve) GS.curve = { id: e.pointerId, x0: e.clientX, y0: e.clientY, c0: G.curve };
    return;
  }
  if (G.phase === 'pull' && !fdPull()) return;                // pendant la jauge, le tap l'arrête (controls.js)
  const sling = canThrow() || fdPull();
  GS.prim = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t: G.time, len: 0, sling, pull: fdPull(), aim: null, dir: null, follow: false };
  if (sling) {
    const el = $('fjoy'); el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px';
    el.style.width = el.style.height = fdRadius() * 2 + 'px'; el.style.display = 'block'; $('fknob').style.transform = '';
  }
}, true);

window.addEventListener('pointermove', e => {
  const C = GS.curve, P = GS.prim;
  if (C && e.pointerId === C.id) {                            // courbe : déplacement du 2e doigt perpendiculaire à la passe
    if (!P || !P.dir) return;
    const lat = (e.clientX - C.x0) * -P.dir[1] + (e.clientY - C.y0) * P.dir[0];
    setCurve(Math.round((C.c0 + lat / 110) * 20) / 20);
    return;
  }
  if (!P || e.pointerId !== P.id) return;
  const dx = e.clientX - P.x0, dy = e.clientY - P.y0, len = Math.hypot(dx, dy);
  P.len = Math.max(P.len, len);
  if (P.sling) {
    const R = fdRadius(), k = len > R ? R / len : 1;
    $('fknob').style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    if (!(P.pull ? fdPull() : canThrow())) return;
    if (len < GS_DEAD) { P.aim = null; G.aiming = false; G.pointer.active = false; return; }
    const ax = CTRL.sling ? -dx : dx, ay = CTRL.sling ? -dy : dy;
    P.dir = [ax / len, ay / len];
    const m = Math.min(1, (len - GS_DEAD) / (R - GS_DEAD)), h = disc.holder;
    const d = P.pull ? 25 + m * (PULL.MAX - 25) : 3 + m * JOY_MAXD;
    P.aim = [h.x + P.dir[0] * d, h.y + P.dir[1] * d];
    G.pointer.x = P.aim[0]; G.pointer.y = P.aim[1]; G.pointer.active = true; G.aiming = !P.pull;
    return;
  }
  if (CTRL.move === 'follow' && G.time - P.t > 0.25 && gsCanMove()) {   // réglage : le joueur suit le doigt
    const w = toWorld(e);
    Object.assign(G.pointer, { x: w.x, y: w.y, active: true, down: true, last: G.time });
    P.follow = true; sendInput();
  }
}, true);

function gsEnd(e, cancel) {
  if (GS.curve && e.pointerId === GS.curve.id) { GS.curve = null; return; }
  const P = GS.prim;
  if (!P || e.pointerId !== P.id) return;
  GS.prim = null; GS.curve = null;
  $('fjoy').style.display = 'none';
  const dx = e.clientX - P.x0, dy = e.clientY - P.y0, len = Math.hypot(dx, dy), dt = G.time - P.t;
  if (P.sling) {
    G.aiming = false;
    if (!cancel && P.aim && len >= GS_DEAD) {
      if (P.pull) { if (fdPull()) { G.pointer.active = true; pullPointerDown(P.aim[0], P.aim[1]); } }
      else if (canThrow()) { G.pointer.active = false; doThrow(P.aim[0], P.aim[1], G.curve); }
      return;
    }
    G.pointer.active = false;
    if (!cancel && !P.pull && P.len < GS_TAP && dt < 0.4) gsTapWithDisc(toWorld(e));
    return;
  }
  if (P.follow) { G.pointer.down = false; G.pointer.last = G.time; sendInput(true); return; }
  if (cancel) return;
  if (len >= GS_SWIPE && dt < 0.3) { if (CTRL.move !== 'joystick' && canLayout()) { doDive(...stickDive(dx, dy)); G.pointer.last = G.time; } return; }
  if (P.len < GS_TAP && dt < 0.4) gsTap(toWorld(e));
}
window.addEventListener('pointerup', e => gsEnd(e, false), true);
window.addEventListener('pointercancel', e => gsEnd(e, true), true);

// peut-on déplacer son joueur (défense, ou attaque à plusieurs sans le disque) ?
function gsCanMove() {
  const h = meH(), sel = h && h.sel;
  return !!sel && G.phase === 'play' && (defending() || !soloStyle(h.team)) && !(disc.holder === sel && disc.mode !== 'air');
}
// tap avec le disque : sur ton porteur = passe haute, ailleurs = appel de cut
function gsTapWithDisc(w) {
  const h = disc.holder; if (!h) return;
  if (dist(w.x, w.y, h.x, h.y) < 2.5) toggleHigh();
  else if (attacking()) doCall(w.x, w.y);
}
// tap sans le disque : prendre un coéquipier, sauter, se déplacer, ou appeler un cut
function gsTap(w) {
  const h = meH(); if (!h || h.team < 0 || G.phase !== 'play') return;
  const sel = h.sel, jt = jumpTarget(h), dj = jt ? dist(w.x, w.y, jt.x, jt.y) : 1e9;
  if (canSwitchNow(h)) {
    const [q, dq] = nearestD(TEAMS[G.me].filter(p => p !== sel && !takenByOther(p, h)), w.x, w.y);
    if (q && dq < 1.5 && dq < dj) { doSelect(q); return; }
  }
  if (CTRL.move === 'joystick') { if (attacking() && !gsCanMove()) doCall(w.x, w.y); return; }   // joystick : saut et course par les boutons
  if (jt && dj < 2) { userJump(); return; }
  if (gsCanMove()) {
    Object.assign(G.pointer, { x: w.x, y: w.y, active: true, down: false, last: G.time });
    sendInput(true);
    ring(w.x, w.y, 'rgba(255,255,255,.55)', 1.2, 0.4);        // repère de destination
    return;
  }
  if (attacking()) doCall(w.x, w.y);
}
