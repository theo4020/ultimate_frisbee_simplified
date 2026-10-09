// gamepad.js — Manette (API Gamepad du navigateur, disposition « standard » Xbox / PlayStation)
//  Stick gauche : viser quand tu as le disque (direction + distance), sinon courir avec ton joueur
//  A : lancer (sans le disque : saut) · B : layout · X : switch (ou appel de cut en attaque) · Y : passe haute
//  LB / RB : courbe · Start : valider le menu · pendant le pull : stick = visée, A = valider puis arrêter la jauge, B = retour

const GP = { prev: [], aim: null, idx: -1, DEAD: 0.22 };
window.addEventListener('gamepadconnected', e => { GP.idx = e.gamepad.index; flash('Manette connectée 🎮', true); });
window.addEventListener('gamepaddisconnected', e => { if (e.gamepad.index === GP.idx) { GP.idx = -1; G.gpActive = false; } });

function gpPad() {
  if (!navigator.getGamepads) return null;
  const list = navigator.getGamepads();
  if (GP.idx >= 0 && list[GP.idx]) return list[GP.idx];
  for (const p of list) if (p && p.connected) { GP.idx = p.index; return p; }
  return null;
}
function gamepadFrame() {
  const pad = gpPad();
  if (!pad) return;
  const btn = i => !!(pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5));
  const press = i => btn(i) && !GP.prev[i];
  let sx = pad.axes[0] || 0, sy = pad.axes[1] || 0;
  const m = Math.hypot(sx, sy);
  if (m < GP.DEAD) { sx = sy = 0; }
  const any = m >= GP.DEAD || pad.buttons.some(b => b && b.pressed);
  if (any && !G.gpActive) { G.gpActive = true; hudKey = ''; }
  if (G.gpActive) gpPlay(sx, sy, Math.min(1, m), press);
  GP.prev = pad.buttons.map((b, i) => btn(i));
}
function gpPlay(sx, sy, m, press) {
  // menus
  if (G.replay) { if (press(0) || press(1) || press(9)) stopReplay(); return; }
  const ov = !$('overlay').classList.contains('hidden');
  if (ov) {
    if (press(0) || press(9)) {
      if ($('stratCard').style.display !== 'none' && $('go').style.display !== 'none' && !$('go').disabled) $('go').click();
      else if ($('seriesCard').style.display !== 'none' && $('seriesGo').style.display !== 'none') $('seriesGo').click();
      else if ($('lobbyCard').style.display !== 'none' && $('lobbyHome').style.display !== 'none') $('soloB').click();
    }
    return;
  }
  if (press(4)) adjustCurve(-0.25);
  if (press(5)) adjustCurve(0.25);
  if (press(3)) cycleThrowKind();
  // pull
  if (G.phase === 'pull') {
    if (!localPuller()) return;
    const h = disc.holder, ui = G.pullUI;
    if (ui.stage === 'aim' && h) {
      const d = m > 0 ? 25 + m * 47 : 50, ux = m > 0 ? sx / Math.hypot(sx, sy) : dirOf(h.team), uy = m > 0 ? sy / Math.hypot(sx, sy) : 0;
      G.pointer.x = h.x + ux * d; G.pointer.y = h.y + uy * d; G.pointer.active = true;
      if (press(0)) pullPointerDown(G.pointer.x, G.pointer.y);
    } else if (ui.stage === 'power') {
      if (press(0)) pullStop();
      if (press(1)) pullBack();
    }
    return;
  }
  if (G.phase !== 'play') return;
  if (canThrow()) {                                           // visée : direction + distance, A pour lancer
    const h = disc.holder;
    if (m > 0) {
      const d = 3 + m * JOY_MAXD;
      GP.aim = [h.x + sx / Math.hypot(sx, sy) * d, h.y + sy / Math.hypot(sx, sy) * d];
      G.pointer.x = GP.aim[0]; G.pointer.y = GP.aim[1]; G.pointer.active = true; G.aiming = true;
    } else if (GP.aim) { GP.aim = null; G.aiming = false; G.pointer.active = false; }
    if ((press(0) || press(7)) && GP.aim) { doThrow(GP.aim[0], GP.aim[1], G.curve); GP.aim = null; G.aiming = false; G.pointer.active = false; }
    if (press(2)) { const h2 = disc.holder; doCall(clamp(h2.x + dirOf(G.me) * 15, 1, W - 1), clamp(h2.y + (sy || 0) * 10, 2, H - 2)); }
    return;
  }
  GP.aim = null;
  if (press(0)) userJump();
  const h = meH(), sel = h && h.sel;
  if (sel && (defending() || !soloStyle(h.team))) {            // déplacement de ton joueur
    if (m > 0) {
      G.pointer.x = sel.x + sx / Math.max(0.01, Math.hypot(sx, sy)) * m * 3.2; G.pointer.y = sel.y + sy / Math.max(0.01, Math.hypot(sx, sy)) * m * 3.2;
      G.pointer.down = true; G.pointer.active = true; G.pointer.last = G.time; sendInput();
    } else if (G.pointer.down) { G.pointer.x = sel.x; G.pointer.y = sel.y; G.pointer.down = false; G.pointer.last = G.time; sendInput(true); }
  }
  if (press(1) && canLayout()) {
    if (!defending()) doDive(disc.ex, disc.ey);
    else if (sel) {
      let dx = sx, dy = sy;
      if (Math.hypot(dx, dy) < 0.2) { dx = sel.vx; dy = sel.vy; }
      if (Math.hypot(dx, dy) < 0.2) { dx = disc.x - sel.x; dy = disc.y - sel.y; }
      const l = Math.hypot(dx, dy) || 1;
      doDive(sel.x + dx / l * 3, sel.y + dy / l * 3);
    }
    G.pointer.last = G.time;
  }
  if (press(2)) {
    if (canSwitchNow(h)) doSwitch();
    else if (attacking() && disc.mode === 'held' && disc.holder) {
      const hd = disc.holder; doCall(clamp(hd.x + dirOf(G.me) * 15, 1, W - 1), clamp(hd.y + sy * 10, 2, H - 2));
    }
  }
}
