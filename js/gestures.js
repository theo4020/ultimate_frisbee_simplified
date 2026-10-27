// gestures.js — Téléphone : tout le tactile sur le terrain (les boutons éventuels dépendent des réglages, voir ctrl.js).
//  Avec le disque (ou pour le pull) :
//   • lancer : poser le doigt n'importe où et tirer en arrière (lance-pierre) — ou vers la cible, selon les réglages ;
//     la longueur règle la distance, relâcher lance, revenir au point de départ annule ;
//   • courbe et hauteur : pendant la visée, un 2e doigt glisse — sur le côté, il « pousse » la trajectoire de ce côté
//     (courbe) ; le long de la passe, vers le porteur = passe plus haute, vers la cible = plus basse ;
//   • taper ton porteur : changer de pied de pivot · taper ailleurs : appeler un cut.
//  Sans le disque :
//   • taper un endroit : ton joueur y va · taper un coéquipier : tu le prends · taper ton joueur : il saute ;
//   • glisser vite n'importe où : layout dans cette direction ;
//   • option « le joueur suit le doigt » : doigt maintenu, ton joueur le suit ;
//   • option « joystick et boutons » : poser le doigt n'importe où et glisser, ton joueur court dans cette direction (controls.js).

// Chaque doigt est suivi à part (plusieurs doigts à la fois) : un tap reste un tap même si un autre doigt vise ou courbe.
//  • le premier doigt qui glisse quand tu as le disque devient le doigt de visée ;
//  • un autre doigt qui glisse pendant la visée règle la courbe ou la hauteur (selon le sens où il part) ;
//  • un doigt qui se lève sans avoir glissé est un tap ; vite et loin, c'est un glissé (layout).
const GS = { ptr: new Map(), aim: null };
const GS_DEAD = 16, GS_TAP = 12, GS_SWIPE = 30;               // px
const gsReady = e => gestures() && e.pointerType !== 'mouse' && !fdOnUI(e.target) && !G.replay && !G.paused && !G.pz
  && $('overlay').classList.contains('hidden') && (G.phase === 'play' || G.phase === 'pull');
const gsAimCtx = () => canThrow() || fdPull();

window.addEventListener('pointerdown', e => {
  if (!gsReady(e)) return;
  if (startWindow()) return;                                  // départ au pull : le tap sert au départ (controls.js)
  if (G.phase === 'pull' && !fdPull()) return;                // pendant la jauge, le tap l'arrête (controls.js)
  const F = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t: G.time, len: 0, role: null };
  if (G.phase === 'play' && canThrow()) { const w = toWorld(e), h = disc.holder; if (h && pickDist(w, h) < 2.5) { F.pb = true; pivotBtnDown(); } }   // doigt sur ton porteur : pied de pivot
  GS.ptr.set(e.pointerId, F);
}, true);

window.addEventListener('pointermove', e => {
  const F = GS.ptr.get(e.pointerId); if (!F) return;
  const dx = e.clientX - F.x0, dy = e.clientY - F.y0, len = Math.hypot(dx, dy);
  F.len = Math.max(F.len, len);
  if (F.pb && F.len >= GS_TAP) { F.pb = false; pivotBtnCancel(); }   // il glisse : c'est une visée, pas le bouton pivot
  if (!F.role && len >= GS_DEAD) {                            // ce doigt commence à glisser : quel rôle ?
    if (gsAimCtx() && !GS.aim) {
      F.role = 'aim'; F.pull = fdPull(); GS.aim = F;
      const el = $('fjoy'); el.style.left = F.x0 + 'px'; el.style.top = F.y0 + 'px';
      el.style.width = el.style.height = fdRadius() * 2 + 'px'; el.style.display = 'block';
    } else if (GS.aim) { F.role = 'shape'; F.cx = e.clientX; F.cy = e.clientY; F.c0 = G.curve; F.l0 = G.loft; }
    else if (CTRL.move === 'joystick' && joyMode() && !joy.active) { F.role = 'stick'; joyStart(F.id, F.x0, F.y0); }   // joystick flottant
  }
  if (F.role === 'stick') { joyMove(e.clientX, e.clientY); return; }
  if (F.role === 'aim') {
    const R = fdRadius(), k = len > R ? R / len : 1;
    $('fknob').style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    if (!(F.pull ? fdPull() : canThrow())) return;
    if (len < GS_DEAD) { F.aimAt = null; G.aiming = false; G.pointer.active = false; return; }
    const ax = CTRL.sling ? -dx : dx, ay = CTRL.sling ? -dy : dy;
    F.dir = [ax / len, ay / len];
    const m = Math.min(1, (len - GS_DEAD) / (R - GS_DEAD)), h = disc.holder;
    const d = F.pull ? 25 + m * (PULL.MAX - 25) : 3 + m * JOY_MAXD;
    F.aimAt = [h.x + F.dir[0] * d, h.y + F.dir[1] * d];
    G.pointer.x = F.aimAt[0]; G.pointer.y = F.aimAt[1]; G.pointer.active = true; G.aiming = !F.pull;
  } else if (F.role === 'shape') {                            // 2e doigt : courbe (sur le côté) ou hauteur (le long de la passe)
    const A = GS.aim, dir = A && A.dir; if (!dir) return;
    const mx = e.clientX - F.cx, my = e.clientY - F.cy, lat = mx * -dir[1] + my * dir[0], lon = mx * dir[0] + my * dir[1];
    if (!F.axis && Math.hypot(lat, lon) > 14) F.axis = Math.abs(lat) >= Math.abs(lon) ? 'curve' : 'loft';   // le premier sens choisi reste
    if (F.axis === 'curve') setCurve(Math.round((F.c0 + lat / 110) * 20) / 20);
    else if (F.axis === 'loft' && canThrow()) setLoft(Math.round((F.l0 - lon / 150) * 20) / 20);   // vers le porteur : plus haute
  } else if (!F.role && CTRL.move === 'follow' && G.time - F.t > 0.25 && gsCanMove()) {   // réglage : le joueur suit le doigt
    F.role = 'follow';
  }
  if (F.role === 'follow' && gsCanMove()) {
    const w = toWorld(e);
    Object.assign(G.pointer, { x: w.x, y: w.y, active: true, down: true, last: G.time });
    sendInput();
  }
}, true);

function gsEnd(e, cancel) {
  const F = GS.ptr.get(e.pointerId); if (!F) return;
  GS.ptr.delete(e.pointerId);
  if (F.pb) { if (cancel) pivotBtnCancel(); else pivotBtnUp(); }
  const dx = e.clientX - F.x0, dy = e.clientY - F.y0, len = Math.hypot(dx, dy), dt = G.time - F.t;
  if (F.role === 'aim') {
    GS.aim = null; $('fjoy').style.display = 'none'; G.aiming = false;
    if (!cancel && F.aimAt && len >= GS_DEAD) {
      if (F.pull) { if (fdPull()) { G.pointer.active = true; pullPointerDown(F.aimAt[0], F.aimAt[1]); } }
      else if (canThrow()) { G.pointer.active = false; doThrow(F.aimAt[0], F.aimAt[1], G.curve); }
    } else G.pointer.active = false;
    return;
  }
  if (F.role === 'stick') { joyEnd(); return; }
  if (F.role === 'shape' || cancel) return;
  if (F.role === 'follow') { G.pointer.down = false; G.pointer.last = G.time; sendInput(true); return; }
  if (len >= GS_SWIPE && dt < 0.3) {                          // glissé rapide : layout
    if (!gsAimCtx() && CTRL.move !== 'joystick' && canLayout()) { doDive(...stickDive(dx, dy)); G.pointer.last = G.time; }
    return;
  }
  if (F.len < GS_TAP && dt < 0.4 && G.phase === 'play') {     // tap
    const w = toWorld(e);
    if (canThrow()) gsTapWithDisc(w); else gsTap(w);
  }
}
window.addEventListener('pointerup', e => gsEnd(e, false), true);
window.addEventListener('pointercancel', e => gsEnd(e, true), true);

// peut-on déplacer son joueur (défense, ou attaque à plusieurs sans le disque) ?
function gsCanMove() {
  const h = meH(), sel = h && h.sel;
  return !!sel && G.phase === 'play' && (defending() || !soloStyle(h.team)) && !(disc.holder === sel && disc.mode !== 'air');
}
// tap avec le disque : sur ton porteur = pivot (géré à l'appui, voir pivotBtnDown), ailleurs = appel de cut
function gsTapWithDisc(w) {
  const h = disc.holder; if (!h) return;
  if (pickDist(w, h) >= 2.5 && attacking()) doCall(w.x, w.y);
}
// tap sans le disque : prendre un coéquipier, sauter, se déplacer, ou appeler un cut
function gsTap(w) {
  const h = meH(); if (!h || h.team < 0 || G.phase !== 'play') return;
  const sel = h.sel, jt = jumpTarget(h), dj = jt ? pickDist(w, jt) : 1e9;
  if (canSwitchNow(h)) {
    const [q, dq] = nearestPick(TEAMS[G.me].filter(p => p !== sel && !takenByOther(p, h)), w);
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
