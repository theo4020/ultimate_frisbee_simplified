// pull.js — Le pull (engagement) au début de chaque point.
// L'équipe qui défend lance le disque à l'équipe qui reçoit :
//   1) on choisit la zone visée et la courbe,
//   2) on arrête une jauge (QTE) : dans le vert = pull long et haut, ce qui laisse
//      le temps à sa défense de monter ; trop tôt = pull court ; tout au bout = trop fort.
// Si le pull sort des limites, l'équipe qui reçoit repart du « brick ».

const PULL = { BRICK: 12, MAX: 72, AUTO_T: 25, GAUGE_HZ: 0.8, PERFECT: [0.82, 0.95] };
const goalLine = t => (t === 0 ? EZ : W - EZ);   // ligne d'en-but que l'équipe t défend

const PULL_YS = [4, 11, 18.5, 26, 33], REGROUP_SPD = 11;   // places sur la ligne · vitesse de mise en place (m/s)
// joueur qui va pulle : celui de l'humain désigné s'il a un joueur fixe, sinon le plus proche du centre de la ligne
function pullerPlayer(d, by) {
  const h = by != null && humanById(by);
  if (h && h.sel && h.sel.team === d && teamHumans(d).length > 1) return h.sel;
  return nearest(TEAMS[d], goalLine(d), H / 2);
}
// chacun rejoint sa place sur sa ligne d'en-but en marchant (pas de téléportation) ; le pulleur prend le centre
function setPullSpots(puller) {
  const r = G.receiving, d = 1 - r;
  const spots = (team, center) => {
    const rest = TEAMS[team].filter(p => p !== center).sort((a, b) => a.y - b.y);
    const ys = center ? PULL_YS.filter((y, k) => k !== 2) : PULL_YS;
    rest.forEach((p, k) => { p.tx = goalLine(team); p.ty = ys[k]; });
    if (center) { center.tx = goalLine(team); center.ty = PULL_YS[2]; }
  };
  spots(r, null); spots(d, puller || null);
}
function regroupStep(dt) {
  for (const p of players) {
    if (p.dive > 0 || p.down > 0 || p.jump > 0 || p.jprep > 0) { steer(p, dt); continue; }
    p.sp = REGROUP_SPD; steer(p, dt);
  }
  if ((disc.mode === 'held' || disc.mode === 'carry') && disc.holder) { disc.x = disc.holder.x; disc.y = disc.holder.y; }
}
// entre deux points (menu de stratégie ouvert) : les joueurs vont déjà se placer pour le pull suivant
function regroupTick(dt) {
  if (G.phase !== 'between') return;
  const d = 1 - G.receiving, by = choosePuller(d);
  setPullSpots(pullerPlayer(d, by));
  regroupStep(dt);
}
// l'équipe qui pulle doit être en place sur sa ligne avant de pouvoir lancer
function pullReady() {
  if (G.net === 'guest') return !!G.netPullReady;
  if (!G.pull || !disc.holder) return false;
  const d = G.pull.team;
  return TEAMS[d].every(p => dist(p.x, p.y, p.tx, p.ty) < (p === disc.holder ? 0.6 : 8));   // le pulleur à sa place, les autres presque arrivés
}
// début de match (derrière le premier menu) : les équipes sont déjà alignées sur leurs lignes
function placeOnPullLines() {
  const d = 1 - G.receiving, puller = pullerPlayer(d, choosePuller(d));
  setPullSpots(puller);
  players.forEach(p => { p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0; p.dive = p.down = 0; });
  Object.assign(disc, { mode: 'held', holder: puller, x: puller.x, y: puller.y, z: 0, pull: false });
  G.off = G.receiving;
}
function placeForPull() {
  const r = G.receiving, d = 1 - r;
  players.forEach(p => {
    p.dive = p.down = 0; p.jump = p.jprep = p.jrec = p.jumpAt = 0; p.windup = null; p.react = 0; p.tag = ''; p.inT = 0;
    p.state = 'stack'; p.role = 'cutter'; p.match = null;
  });
  const puller = pullerPlayer(d, G.pull ? G.pull.by : null);
  setPullSpots(puller);
  Object.assign(disc, { mode: 'held', holder: puller, x: puller.x, y: puller.y, z: 0, pull: false });
  Object.assign(G, { off: r, oplay: null, stall: 0, marker: null, dbl: null, pickup: null, sel: [null, null], order: [[], []] });
}

function startPull() {
  const pt = 1 - G.receiving;
  G.pull = { team: pt, t: 0, aiT: rand(1.0, 1.8), by: choosePuller(pt) };
  placeForPull();
  G.phase = 'pull';
  G.pullCount = G.pullCount || [0, 0]; G.pullCount[pt]++;
  G.pullUI = { stage: 'aim', t0: 0, x: 0, y: 0, q: 0 };
  G.pullPending = false;
  G.curve = 0; const cr = document.getElementById('curveRange'); if (cr) cr.value = 0;
}

// c'est le capitaine de l'équipe qui pulle (le seul humain de l'équipe en solo)
// qui pulle : choisi par le capitaine (lui-même, un coéquipier, chacun son tour, ou l'IA). null = l'IA pulle
function choosePuller(t) {
  const hs = teamHumans(t);
  if (!hs.length) return null;
  const v = String(cfg(t).puller || 'cap');
  if (v === 'ai') return null;
  if (v === 'rot') return hs[((G.pullCount || [0, 0])[t]) % hs.length].id;
  const h = hs.find(o => String(o.id) === v);
  return (h || hs[0]).id;
}
const localPuller = () => G.phase === 'pull' && !!G.pull && G.pull.by != null && G.pull.by === G.myId;
function pullFlash() {
  if (!G.pull) return;
  const by = G.pull.by != null && humanById(G.pull.by);
  flash(G.spectator ? 'Pull !' : G.pull.team === G.me ? (localPuller() ? 'À toi de puller !' : by ? `${humanLabel(by)} pulle…` : 'Ton équipe pulle…') : 'Pull adverse…', true);
}

// position de la jauge (0 → 1 → 0…), en temps réel
function gaugePos() {
  const ui = G.pullUI;
  if (ui.stage === 'sent') return ui.q;
  const ph = ((G.time - ui.t0) * PULL.GAUGE_HZ) % 1;
  return ph < 0.5 ? ph * 2 : 2 - ph * 2;
}
function clampPullAim(h, x, y) {
  const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy) || 1;
  return d > PULL.MAX ? [h.x + dx / d * PULL.MAX, h.y + dy / d * PULL.MAX] : [x, y];
}

// ---------- actions du joueur qui pulle ----------
function pullPointerDown(wx, wy) {
  const ui = G.pullUI, h = disc.holder;
  if (!localPuller() || !h) return;
  if (ui.stage === 'aim') {
    if (!pullReady()) { flash('Attends que ton équipe soit en place', true); return; }
    [ui.x, ui.y] = clampPullAim(h, wx, wy);
    ui.stage = 'power'; ui.t0 = G.time;
  } else if (ui.stage === 'power') pullStop();
}
function pullStop() {
  const ui = G.pullUI;
  if (!localPuller() || ui.stage !== 'power') return;
  ui.q = gaugePos(); ui.stage = 'sent';
  try { SOUNDS.qte(ui.q); } catch (e) { }
  const q = ui.q;
  setTimeout(() => doPull(ui.x, ui.y, G.curve, q), 250);       // on laisse voir où la jauge s'est arrêtée
}
function pullBack() { if (localPuller() && G.pullUI.stage === 'power') G.pullUI.stage = 'aim'; }
function doPull(x, y, curve, q) {
  if (!localPuller()) return;                                 // seul le pulleur désigné peut pulle
  if (G.net === 'guest') netSend({ t: 'pull', x, y, curve, q });
  else launchPull(x, y, curve, q);
}

// ---------- IA et temps limite ----------
function pullTick(dt, gdt) {
  if (G.phase !== 'pull' || !G.pull) return;
  regroupStep(gdt || dt);                                      // mise en place en marchant
  if (!pullReady()) return;                                    // on attend que l'équipe qui pulle soit en place
  G.pull.t += dt;
  if (G.pull.by != null && !humanById(G.pull.by)) G.pull.by = null;   // le pulleur choisi est parti : l'IA prend le relais
  if (G.pull.by == null) { G.pull.aiT -= dt; if (G.pull.aiT <= 0) aiPull(); }
  else if (G.pull.t > PULL.AUTO_T) aiPull();                    // personne ne pulle : pull automatique
}
function aiPull() {
  const r = G.receiving, gl = goalLine(r), dr = dirOf(r), h = disc.holder;
  let ax = gl + dr * rand(-6, 12), ay = H / 2 + rand(-9, 9);
  const [wx, wy] = drift(3.8); ax -= wx; ay -= wy;               // compense le vent
  const u = Math.random();
  const q = u < 0.08 ? rand(0.95, 1) : u < 0.55 ? rand(0.82, 0.95) : rand(0.45, 0.82);
  [ax, ay] = clampPullAim(h, ax, ay);
  launchPull(ax, ay, rand(-0.5, 0.5), q);
}

// ---------- le pull part ----------
function launchPull(ax, ay, curve, q) {
  if (G.phase !== 'pull' || !disc.holder) return;
  const pulledBy = G.pull ? G.pull.by : null;
  const r = G.receiving, d = 1 - r, h = disc.holder;
  curve = clamp(+curve || 0, -1, 1); q = clamp(+q || 0, 0, 1);
  [ax, ay] = clampPullAim(h, ax, ay);
  const [p0, p1] = PULL.PERFECT;
  let f, err;
  let lat = 0;                                                  // écart sur le côté (perpendiculaire au pull)
  if (q > p1) {                                                 // trop fort : il part de travers et perd de la distance
    const over = (q - p1) / (1 - p1);
    f = 0.8 - over * 0.12; err = 1.5;
    lat = (Math.random() < 0.5 ? -1 : 1) * rand(6, 9 + over * 5);
  }
  else if (q >= p0) { f = 1; err = 1.2; }                       // parfait
  else { f = 0.5 + 0.5 * q / p0; err = 2.5; }                   // trop tôt : court
  const hang = q > p1 ? 2.0 : 1.8 + 2.4 * Math.min(1, q / p0);  // temps de vol (s)
  const pdx = ax - h.x, pdy = ay - h.y, pl = Math.hypot(pdx, pdy) || 1;
  const tx = h.x + pdx * f - pdy / pl * lat, ty = h.y + pdy * f + pdx / pl * lat;
  const ea = rand(0, Math.PI * 2), er = err * Math.sqrt(Math.random());
  const aimX = tx + Math.cos(ea) * er, aimY = ty + Math.sin(ea) * er;
  const dur = Math.max(hang, flightTime(dist(h.x, h.y, aimX, aimY)) * 1.2);
  const [wx, wy] = drift(dur);
  const [cx, cy] = ctrlFor(h.x, h.y, aimX, aimY, curve);
  Object.assign(disc, { mode: 'air', holder: null, sx: h.x, sy: h.y, ex: aimX + wx, ey: aimY + wy, cx, cy,
    t: 0, dur, thrower: h, team: r, rolled: new Set(), pull: true, kind: 'normal', curveV: curve });
  disc.intended = nearest(TEAMS[r], disc.ex, disc.ey);
  G.phase = 'play'; G.off = r; G.pullPending = true; G.pull = null;
  assignRoles(r, disc.intended);
  setupDefense(d, disc.intended);
  updateSelected();
  players.forEach(p => { p.react = 0; p.diveTried = true; });
  fxEvent('pull', h.x, h.y, d);
  flash(q > p1 ? 'Pull trop fort !' : q >= p0 ? 'Pull parfait !' : 'Pull court');
  if (G.tuto) tutoEvent('pull', q);
  if (q >= p0 && q <= p1 && pulledBy === G.myId) achEvent('pull', d);
}

// réception du pull à la volée
function pullCaught(p) {
  const r = G.receiving;
  disc.pull = false;
  fxEvent('catch', p.x, p.y, p.team);
  const outside = p.x < 0 || p.x > W || p.y < 0 || p.y > H;
  const landsOut = disc.ex < 0 || disc.ex > W || disc.ey < 0 || disc.ey > H;
  if (outside && landsOut) { startCarry(p, brickX(r), H / 2, 'Out ! Brick'); return; }   // pull qui sortait : brick
  // attrapé hors du terrain alors qu'il allait retomber dedans : réception valable, on rentre le disque au plus près
  let x = clamp(p.x, 0, W), y = clamp(p.y, 0.5, H - 0.5);
  if (inScoreZone(1 - r, x)) x = goalLine(r);                  // dans son en-but : on le ramène sur la ligne
  if (outside || x !== p.x) { startCarry(p, x, y, ''); return; }
  holdDisc(p);
}
const brickX = r => goalLine(r) + dirOf(r) * PULL.BRICK;
// le joueur ramène le disque à pied jusqu'à la ligne d'en-but ou au brick avant que le jeu reprenne
function startCarry(p, x, y, msg) {
  Object.assign(disc, { mode: 'carry', holder: p, x: p.x, y: p.y, z: 0 });
  G.carryTo = { x, y }; G.pickup = null; G.stall = 0; G.marker = null;
  p.vx = p.vy = 0;
  assignRoles(p.team, p);
  setupDefense(1 - p.team, p);
  if (msg) flash(msg);
}
// le pull touche le sol sans être attrapé
function pullLanded(ex, ey) {
  const r = G.receiving;
  disc.pull = false;
  const out = ex < 0 || ex > W || ey < 0 || ey > H;
  // le disque est ramassé là où il s'arrête (ou là où il est sorti), puis ramené si besoin
  const x = clamp(ex, 0.5, W - 0.5), y = clamp(ey, 0.5, H - 0.5);
  if (out) G.carryTo = { x: brickX(r), y: H / 2 };
  else if (inScoreZone(1 - r, x)) G.carryTo = { x: goalLine(r), y };
  else G.carryTo = null;
  pullToSpot(x, y, null, out ? 'Out ! Brick' : '');
}
function pullToSpot(x, y, catcher, msg) {
  const r = G.receiving;
  Object.assign(disc, { mode: 'ground', holder: null, x, y, z: 0 });
  G.groundAt = G.gt;
  G.pickup = catcher || nearest(TEAMS[r], x, y);
  assignRoles(r, G.pickup);
  setupDefense(1 - r, G.pickup);
  fxEvent('land', x, y, r);
  if (msg) flash(msg);
}
// première possession après le pull : les plays démarrent maintenant
function afterPull(p) {
  if (G.dplay) { G.dplay.t = 0; startDPlay(); }
  const oType = G.pendingOPlay;
  G.pendingOPlay = null;
  if (oType && oType !== 'none' && p.team === G.receiving) {
    G.oplay = { type: oType, team: p.team, t: 0, phase: 0, dur: 6, targets: [], a: null, b: null };
    startOPlay();
  }
}

// ---------- affichage (visée, jauge) ----------
function drawPullUI() {
  if (G.phase !== 'pull' || !disc.holder) return;
  const h = disc.holder, fs = Math.max(11, S * 1.5);
  ctx.save(); ctx.textAlign = 'center';
  const label = (txt, y) => {
    ctx.font = `700 ${fs}px system-ui`;
    const w = ctx.measureText(txt).width + fs * 1.4;
    ctx.fillStyle = 'rgba(15,23,42,.72)'; ctx.fillRect(X(W / 2) - w / 2, y - fs * 1.1, w, fs * 1.6);
    ctx.fillStyle = '#f8fafc'; ctx.fillText(txt, X(W / 2), y);
  };
  if (!pullReady()) {
    label(G.pull && G.pull.team === G.me && !G.spectator ? 'Mise en place pour le pull…' : 'L’autre équipe se met en place…', Y(2.5) + fs);
    ctx.restore(); return;
  }
  if (!localPuller()) {
    const by = G.pull && G.pull.by != null && humanById(G.pull.by);
    label(G.pull && G.pull.team === G.me && !G.spectator ? (by ? `${humanLabel(by)} prépare le pull…` : 'Ton équipe prépare le pull…')
      : by ? `${humanLabel(by)} prépare son pull…` : 'L’adversaire prépare son pull…', Y(2.5) + fs);
    ctx.restore(); return;
  }
  const ui = G.pullUI;
  let ax, ay;
  if (ui.stage === 'aim') {
    ax = G.pointer.active ? G.pointer.x : h.x + dirOf(h.team) * 50; ay = G.pointer.active ? G.pointer.y : H / 2;
    [ax, ay] = clampPullAim(h, ax, ay);
  } else { ax = ui.x; ay = ui.y; }
  // trajectoire d'un pull parfait (avec la dérive du vent)
  const [cx, cy] = ctrlFor(h.x, h.y, ax, ay, G.curve), [wx, wy] = drift(4.2);
  ctx.setLineDash([7, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(250,204,21,.9)';
  ctx.beginPath(); ctx.moveTo(X(h.x), Y(h.y)); ctx.quadraticCurveTo(X(cx), Y(cy), X(ax + wx), Y(ay + wy)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(250,204,21,.9)'; ctx.fillStyle = 'rgba(250,204,21,.15)';
  circle(X(ax + wx), Y(ay + wy), 2.5 * S); ctx.fill(); ctx.stroke();
  if (Math.hypot(wx, wy) > 0.8) {
    const k = 5; ctx.strokeStyle = 'rgba(125,211,252,.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(ax) - k, Y(ay) - k); ctx.lineTo(X(ax) + k, Y(ay) + k); ctx.moveTo(X(ax) + k, Y(ay) - k); ctx.lineTo(X(ax) - k, Y(ay) + k); ctx.stroke();
  }
  if (ui.stage === 'aim') {
    label(isTouchUI() ? 'Pull : pose le doigt n’importe où et glisse pour viser (courbe : bord droit)' : 'Pull : clique sur la zone visée (courbe : A/E ou molette)', Y(2.5) + fs);
  } else {
    // jauge QTE
    const bw = Math.min(W * 0.45 * S, 420), bh = Math.max(14, S * 1.6), bx = X(W / 2) - bw / 2, by = Y(H - 3.5);
    const [p0, p1] = PULL.PERFECT, g = gaugePos();
    ctx.fillStyle = 'rgba(15,23,42,.8)'; ctx.fillRect(bx - 6, by - 6, bw + 12, bh + 12);
    const grad = ctx.createLinearGradient(bx, 0, bx + bw * p0, 0);
    grad.addColorStop(0, '#475569'); grad.addColorStop(1, '#eab308');
    ctx.fillStyle = grad; ctx.fillRect(bx, by, bw * p0, bh);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(bx + bw * p0, by, bw * (p1 - p0), bh);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(bx + bw * p1, by, bw * (1 - p1), bh);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * g - 3, by - 5, 6, bh + 10);
    label(ui.stage === 'sent' ? (g >= p0 && g <= p1 ? 'Parfait !' : g > p1 ? 'Trop fort !' : 'Trop tôt…')
      : (isTouchUI() ? 'Tape pour arrêter la jauge dans le vert !' : 'Clique ou Espace pour arrêter la jauge dans le vert !'), by - fs * 0.9);
  }
  ctx.restore();
}
const isTouchUI = () => typeof document !== 'undefined' && document.body && document.body.classList && document.body.classList.contains('touch');
