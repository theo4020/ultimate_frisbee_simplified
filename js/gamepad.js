// gamepad.js — Manette (API Gamepad du navigateur, disposition « standard » Xbox / PlayStation)
//  Stick gauche : déplacer le curseur de visée quand tu as le disque (stick droit : réglage fin), sinon courir avec ton joueur
//  A / RT : lancer au curseur (sans le disque : saut) · B : layout · X : appel de cut au curseur (sans le disque : switch) · Y : passe haute
//  LB / RB : courbe · Start : valider le menu · pendant le pull : stick = visée, A = valider puis arrêter la jauge, B = retour

const GP = { prev: [], aim: null, holder: null, idx: -1, DEAD: 0.22, dt: 1 / 60, last: 0, noLay: -9 };
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
  const now = performance.now() / 1000; GP.dt = clamp(now - (GP.last || now), 0, 0.05); GP.last = now;
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
// B quand le layout n'est pas possible : on explique au lieu de ne rien faire
function gpNoLayout() {
  if (G.time - GP.noLay < 3) return; GP.noLay = G.time;
  flash(attacking() ? 'Layout en attaque : quand le disque vole vers ton équipe' : 'Layout impossible maintenant', true);
}
function gpPlay(sx, sy, m, press) {
  // menus
  if (G.replay) { if (press(0) || press(1) || press(9)) stopReplay(); return; }
  if (press(8)) { goMainMenu(); return; }                    // Select / Back : menu principal
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
  if (canThrow()) {                                           // visée : le stick déplace un curseur, A lance, X appelle un cut au curseur
    const h = disc.holder, pad = gpPad();
    if (!GP.aim || GP.holder !== h) {                          // nouvelle possession : curseur un peu devant le porteur
      GP.aim = [clamp(h.x + dirOf(h.team) * 10, 1, W - 1), clamp(h.y, 1, H - 1)]; GP.holder = h;
    }
    const mm = m > 0 ? (m - GP.DEAD) / (1 - GP.DEAD) : 0;     // lent au début (passes courtes), rapide stick à fond
    let vx = 0, vy = 0;
    if (mm > 0) { const v = 4 + 40 * Math.pow(mm, 2); vx = sx / m * v; vy = sy / m * v; }
    let rx = pad.axes[2] || 0, ry = pad.axes[3] || 0; const rm = Math.hypot(rx, ry);   // stick droit : réglage fin
    if (rm > GP.DEAD) { const v = 9 * (rm - GP.DEAD) / (1 - GP.DEAD); vx += rx / rm * v; vy += ry / rm * v; }
    let ax = GP.aim[0] + vx * GP.dt, ay = GP.aim[1] + vy * GP.dt;
    const dx = ax - h.x, dy = ay - h.y, d = Math.hypot(dx, dy), maxD = JOY_MAXD + 3;
    if (d > maxD) { ax = h.x + dx / d * maxD; ay = h.y + dy / d * maxD; }
    GP.aim = [clamp(ax, 0.5, W - 0.5), clamp(ay, 0.5, H - 0.5)];
    G.pointer.x = GP.aim[0]; G.pointer.y = GP.aim[1]; G.pointer.active = true; G.aiming = true;
    if (press(0) || press(7)) { doThrow(GP.aim[0], GP.aim[1], G.curve); GP.aim = null; GP.holder = null; G.aiming = false; G.pointer.active = false; }
    else if (press(2)) doCall(GP.aim[0], GP.aim[1]);
    if (press(1)) gpNoLayout();
    return;
  }
  if (GP.aim) { GP.aim = null; GP.holder = null; G.aiming = false; }
  if (press(0)) userJump();
  const h = meH(), sel = h && h.sel;
  if (sel && (defending() || !soloStyle(h.team))) {            // déplacement de ton joueur
    if (m > 0) {
      G.pointer.x = sel.x + sx / Math.max(0.01, Math.hypot(sx, sy)) * m * 3.2; G.pointer.y = sel.y + sy / Math.max(0.01, Math.hypot(sx, sy)) * m * 3.2;
      G.pointer.down = true; G.pointer.active = true; G.pointer.last = G.time; sendInput();
    } else if (G.pointer.down) { G.pointer.x = sel.x; G.pointer.y = sel.y; G.pointer.down = false; G.pointer.last = G.time; sendInput(true); }
  }
  if (press(1) && !canLayout()) gpNoLayout();
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
      const hd = disc.holder, l = Math.hypot(sx, sy);           // appel devant le porteur, dans la direction du stick
      const ux = l > 0 ? sx / l : dirOf(G.me), uy = l > 0 ? sy / l : 0;
      doCall(clamp(hd.x + ux * 15, 1, W - 1), clamp(hd.y + uy * 15, 2, H - 2));
    }
  }
}
