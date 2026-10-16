// plays.js — Plays de départ (attaque et défense)

// =====================================================================
//  Plays de départ
// =====================================================================
function startCut(c, x, y, deep) {
  c.sprintPark = false;
  const dir = dirOf(c.team), open = -closedOf(1 - c.team);
  c.cx = x; c.cy = y; clampPt(c);
  c.wx = c.x + dir * (deep ? -2 : 2); c.wy = c.y + (deep ? open : -open) * 1.2;
  c.role = 'cutter'; c.state = 'jab'; c.timer = 0.3;
  // déjà lancé dans cette direction : pas de feinte (elle le forcerait à s'arrêter), il continue sa course
  // (ou consigne de son poste : sans feinte)
  const dx = c.cx - c.x, dy = c.cy - c.y, l = Math.hypot(dx, dy), sp = Math.hypot(c.vx || 0, c.vy || 0);
  if ((c.poste && c.poste.fake === 'no') || (l > 0.5 && sp > 2 && (c.vx * dx + c.vy * dy) / (l * sp) > 0.5)) { c.state = 'cut'; c.timer = Math.max(2.4, l / SPD.cut + 0.6); }
}

// ---------- plays d'attaque : appelés en jeu par le porteur (touches, boutons, ou l'IA), joués depuis là où sont les joueurs ----------
// Chaque équipe choisit Play 1 et Play 2 avant le point (cfg.play1 / cfg.play2 ; 'sys' = système perso, voir systems.js).
const playOf = (t, n) => { const c = cfg(t); return c ? c['play' + n] || 'none' : 'none'; };
function playSys(t, n) { const s = sysOf(t, 'p' + n + 'sys'); return s && (s.kind === 'play' || (s.kind === 'off' && s.steps)) ? s : null; }
// peut-on appeler un play maintenant ? (l'équipe a le disque en main et aucun play n'est en cours)
function canCallPlay(t, n) {
  const ty = playOf(t, n);
  return G.phase === 'play' && disc.mode === 'held' && disc.holder && disc.holder.team === t && !G.oplay && !G.practice
    && (!G.tuto || !!(TUTO_STEPS[G.tuto.step] || {}).plays)
    && ty !== 'none' && (ty !== 'sys' || !!playSys(t, n));
}
function callPlay(t, n) {
  if (!canCallPlay(t, n)) return false;
  const ty = playOf(t, n);
  G.oplay = { type: ty, team: t, t: 0, phase: 0, dur: 6, targets: [], a: null, b: null, n, sys: ty === 'sys' ? playSys(t, n) : null };
  startOPlay();
  if (G.oplay && G.tuto) G.tuto.played = true;
  if (G.oplay) flash('Play : ' + (ty === 'sys' ? G.oplay.sys.name : PLAY_NAMES[ty]) + ' !', false, t, 'Play appelé !');
  return !!G.oplay;
}
// joueur le mieux placé pour un rôle : celui qui arrive le plus vite au point (x, y)
const closestTo = (list, x, y) => list.slice().sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))[0] || null;

function startOPlay() {
  const P = G.oplay; if (!P) return;
  const t = P.team, h = disc.holder, dir = dirOf(t), open = -closedOf(1 - t);
  if (!h) { G.oplay = null; return; }
  const free = TEAMS[t].filter(p => p !== h && !userControls(p));
  const behind = free.slice().sort((a, b) => dir * (a.x - b.x));          // du plus en arrière au plus en avant
  const room = depthLeft(h.x, dir);
  if (P.type === 'huck') {                                   // le plus en avant (et le plus libre) part tout de suite en profondeur
    const opp = TEAMS[1 - t], score = p => dir * (p.x - h.x) + nearestD(opp, p.x, p.y)[1] * 1.5;
    const c = free.filter(p => p.role !== 'dump').sort((a, b) => score(b) - score(a))[0] || free[0];
    if (!c) { G.oplay = null; return; }
    P.a = c; c.tag = '★';
    startCut(c, h.x + dir * Math.min(rand(28, 34), room - 1), clamp(c.y + open * 4, 4, H - 4), true);
    P.targets = [c]; P.phase = 1; P.dur = 5;
  } else if (P.type === 'split') {                           // deux coupes en même temps : côté open et côté break
    const xo = h.x + dir * rand(6, 9), yo = clamp(h.y + open * rand(8, 11), 2, H - 2), yb = clamp(h.y - open * rand(8, 11), 2, H - 2);
    P.a = closestTo(free, xo, yo); P.b = closestTo(free.filter(p => p !== P.a), xo, yb);
    if (!P.a || !P.b) { G.oplay = null; return; }
    startCut(P.a, xo, yo, false); startCut(P.b, xo, yb, false);
    for (const c of [P.a, P.b]) c.tag = '1';
    P.targets = [P.a, P.b]; P.phase = 1; P.dur = 4;
  } else if (P.type === 'give' || P.type === 'swing') {      // le joueur le plus en arrière vient donner un relais court
    const b = behind[0]; if (!b) { G.oplay = null; return; }
    P.b = b; P.giver = h; P.dur = 7; b.tag = '1';
    b.role = 'cutter'; b.state = 'park';                      // il file tout de suite à côté du porteur et y reste pour la passe
    b.cx = clamp(h.x - dir * (P.type === 'give' ? 1.5 : 3), 1, W - 1); b.cy = clamp(h.y + (P.type === 'give' ? open : -open) * 6.5, 2, H - 2);
    P.targets = [b];
  } else if (P.type === 'flood') {                           // iso : tout le monde dégage côté break, un seul attaque l'open side
    const xi = h.x + dir * rand(5, 8), yi = clamp(h.y + open * rand(8, 11), 2, H - 2);
    P.a = closestTo(free, xi, yi); if (!P.a) { G.oplay = null; return; }
    P.a.tag = '1'; P.dur = 6;
    free.filter(p => p !== P.a).forEach((p, i) => {
      p.state = 'park'; p.role = 'cutter'; p.cx = h.x + dir * (6 + i * 7); p.cy = H / 2 - open * (11 + (i % 2) * 3); clampPt(p);
    });
    P.t0 = 0.5;                                              // le temps que l'espace s'ouvre, puis l'iso coupe
    P.targets = [P.a];
  } else if (P.type === 'sys') {                             // système perso : chaque rôle ①–④ au joueur le plus proche de sa place
    const S = P.sys, spots = sysWorld(playPos(S), h.x, h.y, dir, open), pool = free.slice();
    P.map = [];
    for (let k = 0; k < 4; k++) { const q = closestTo(pool, spots[k][0], spots[k][1]); P.map[k] = q; if (q) { pool.splice(pool.indexOf(q), 1); q.tag = String(k + 1); } }
    P.i = 0; P.timer = S.steps.length ? Math.min(0.4, S.steps[0].wait) : 0; P.dur = 1e9; P.ax = h.x; P.ay = h.y;
    if (!S.steps.length) { endOPlay(); return; }
    if (S.setup) {                                           // option : chacun file d'abord à sa place (1,5 s au plus), puis les courses
      P.setupT = 1.5;
      P.map.forEach((q, k) => { if (q) { q.role = 'cutter'; q.state = 'park'; q.cx = spots[k][0]; q.cy = spots[k][1]; q.sprintPark = true; } });
    }
  }
}
// système perso appelé comme play : ses courses dans l'ordre, relatives au disque au moment de l'appel
function sysPlayTick(P, dt, dir, open) {
  const S = P.sys;
  if (P.setupT > 0) {                                        // mise en place : on part dès que tout le monde y est, ou au bout de 1,5 s
    P.setupT -= dt;
    if (P.setupT > 0 && P.map.some(q => q && dist(q.x, q.y, q.cx, q.cy) > 1.5)) return;
    P.setupT = 0;
  }
  P.timer -= dt;
  if (P.timer > 0) return;
  if (P.i >= S.steps.length) {
    if (P.map.every(q => !q || !SYS_BUSY.includes(q.state))) endOPlay();
    return;
  }
  const st = S.steps[P.i], q = P.map[st.p];
  if (q && SYS_BUSY.includes(q.state) && q.sysCut && !userControls(q)) return;   // il finit sa course précédente, puis enchaîne de là
  P.i++; P.timer = P.i < S.steps.length ? S.steps[P.i].wait : 0.5;
  if (!q || q === disc.holder || userControls(q)) return;
  const [[x, y]] = sysWorld([st.to], P.ax, P.ay, dir, open);
  startCut(q, x, y, st.to[0] > 18);
  q.sysCut = true; q.sysStay = S.steps.slice(P.i).some(s => s.p === st.p);
  P.targets = [q];
}

function updatePlays(dt, ax, ay, dir, open) {
  const P = G.oplay;
  if (P) {
    P.t += dt;
    if (P.team !== G.off || P.t > P.dur) endOPlay();
    else if (P.type === 'sys') { if (disc.mode === 'held' || disc.mode === 'air') sysPlayTick(P, dt, dir, open); }
    else if (disc.mode === 'held' && P.type === 'flood') {
      if (P.phase === 0 && P.t > P.t0) {
        startCut(P.a, ax + dir * rand(5, 8), ay + open * rand(8, 11), false);
        P.targets = [P.a]; P.phase = 1;
      } else if (P.phase === 1 && P.a.state === 'hold') {
        startCut(P.a, ax + dir * rand(24, 30), clamp(ay + open * 8, 3, H - 3), true); P.phase = 2;
      }
    }
  }
  if (P && G.oplay && P.type === 'give' && P.phase === 0 && !P.went && disc.mode === 'air' && disc.intended === P.b) {
    const g = P.giver;                                       // « donne et VA » : il part dès que le disque quitte sa main
    if (!G.order[g.team].includes(g)) G.order[g.team].unshift(g);
    startCut(g, g.x + dir * rand(9, 12), g.y + open * 5, false);
    g.tag = '2'; P.went = true;
  }
  const D = G.dplay;
  if (D) {
    D.t += dt;
    const over = D.team === G.off || (D.type === 'double' ? D.throws >= 1 : D.type === 'junk' ? D.throws >= 2 : D.t > 6) || D.t > 12;
    if (over) endDPlay();
  }
}

function playOnCatch(p) {
  const P = G.oplay;
  if (!P || P.team !== p.team) return;
  if (P.type === 'give' && P.phase === 0 && p === P.b) {   // le relais a reçu : l'ancien porteur file vers l'avant
    const g = P.giver;
    if (!G.order[p.team].includes(g)) G.order[p.team].unshift(g);
    if (g.state !== 'jab' && g.state !== 'cut') {
      const dir = dirOf(p.team), open = -closedOf(1 - p.team);
      startCut(g, g.x + dir * rand(9, 12), g.y + open * 5, false);
    }
    P.b.tag = ''; g.tag = '2'; P.a = g; P.targets = [g]; P.phase = 1; P.dur = P.t + 3;
    return;
  }
  if (P.type === 'swing' && P.phase === 0 && p === P.b) {    // le dump a le disque : un cutter attaque l'autre côté
    const dir = dirOf(p.team), side = Math.sign(p.y - P.giver.y) || 1;
    const tx = p.x + dir * rand(8, 11), ty = clamp(p.y + side * rand(6, 9), 2, H - 2);
    const c = nearest(G.order[p.team].filter(q => q !== p && q !== P.giver), tx, ty);
    P.b.tag = '';
    if (c) { startCut(c, tx, ty, false); c.tag = '2'; P.a = c; P.targets = [c]; P.phase = 1; P.dur = P.t + 3.5; return; }
  }
  if (P.t > 0.05) endOPlay();
}

function endOPlay() {
  for (const p of players) {
    p.tag = p.tag === 'S' || p.tag === '2d' ? p.tag : '';
    if (p.state === 'park') { p.state = 'clear'; p.wDone = true; p.timer = 4; }
  }
  if (G.oplay && disc.holder && disc.mode === 'held' && G.oplay.team === disc.holder.team) assignRolesKeep(G.oplay.team);
  G.oplay = null; G.cutT = 0.5;
}
// après un play : on redonne un relais et un ordre propres sans casser les courses en cours
function assignRolesKeep(t) {
  const keep = new Map(TEAMS[t].map(p => [p, [p.state, p.cx, p.cy, p.timer, p.wDone]]));
  assignRoles(t, disc.holder);
  for (const p of G.order[t]) {
    const [st, cx, cy, tm, wd] = keep.get(p);
    if (st === 'jab' || st === 'cut' || st === 'hold' || st === 'clear') Object.assign(p, { state: st, cx, cy, timer: tm, wDone: wd });
  }
}

function startDPlay() {
  const D = G.dplay; if (!D) return;
  const atkT = 1 - D.team, atkDump = TEAMS[atkT].find(p => p.role === 'dump')
    || (G.order[atkT] || []).slice().sort((a, b) => dirOf(atkT) * (a.x - b.x))[0];
  const dfn = TEAMS[D.team], form = defFormOf(D.team);
  const by = k => (form !== 'zone' && form !== 'clam' && dfn.find(d => d.match === atkDump)) || dfn.find(d => d.zslot === k);
  if (D.type === 'safety') D.d = by(4);
  else if (D.type === 'double') D.d = by(3);
  if (D.d) D.d.tag = D.type === 'safety' ? 'S' : '2d';
}

function endDPlay() {
  const D = G.dplay; G.dplay = null;
  if (D.d) D.d.tag = '';
  if (D.type === 'junk' && D.team !== G.off) {             // bascule vers la défense de base
    const h = disc.mode === 'held' ? disc.holder : G.pickup;
    if (h) setupDefense(D.team, h);
  }
}

