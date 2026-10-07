// sim.js — Boucle de simulation : déplacements, stall count, vol du disque

// =====================================================================
//  Boucle de simulation
// =====================================================================
function steer(p, dt) {
  if (p.dive > 0) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.dive -= dt;
    if (p.dive <= 0) p.down = DOWN_T;
    return;
  }
  if (p.down > 0) {
    p.down -= dt; const k = Math.max(0, 1 - 7 * dt); p.vx *= k; p.vy *= k;
    p.x += p.vx * dt; p.y += p.vy * dt; return;
  }
  const dx = p.tx - p.x, dy = p.ty - p.y, l = Math.hypot(dx, dy);
  const want = Math.min(p.sp, l * 2.5);
  const dvx = (l > 0.01 ? dx / l * want : 0) - p.vx, dvy = (l > 0.01 ? dy / l * want : 0) - p.vy;
  const dl = Math.hypot(dvx, dvy), maxd = (p.team === G.off ? ACC.atk : ACC.def) * dt;
  const k = dl > maxd ? maxd / dl : 1;
  p.vx += dvx * k; p.vy += dvy * k;
  p.x += p.vx * dt; p.y += p.vy * dt;
}

function update(dt) {
  const off = G.off, def = 1 - off, dir = dirOf(off);
  const atk = TEAMS[off], dfn = TEAMS[def];
  const [ax, ay] = anchor();
  const oform = formOf(off), dform = defFormOf(def), closed = closedOf(def), open = -closed;

  updatePlays(dt, ax, ay, dir, open);
  runCutSequencer(off, ax, ay, dir, open, oform, dt);
  for (const p of atk) {
    if (disc.mode === 'held' && disc.holder === p) { p.tx = p.x; p.ty = p.y; p.sp = 0; p.vx = p.vy = 0; continue; }
    if (disc.mode === 'ground' && G.pickup === p) { p.tx = disc.x; p.ty = disc.y; p.sp = SPD.cut; continue; }
    if (disc.mode === 'air' && disc.intended === p) { p.tx = disc.ex; p.ty = disc.ey; p.sp = SPD.cut; continue; }
    attackerAI(p, off, ax, ay, dir, open, oform, dt);
  }
  const slots = zoneSlots(def, ax, ay, dir, closed);
  for (const d of dfn) {
    if (userControls(d)) { const inp = inputOf(d.team); d.tx = inp.x; d.ty = inp.y; d.sp = SPD.user; continue; }
    d.react -= dt;
    if (d.react > 0) continue;                             // temps de réaction : c'est ce qui crée des démarquages
    d.react = dform === 'zone' ? rand(0.1, 0.18) : rand(0.18, 0.3);
    defenderAI(d, ax, ay, dir, closed, defFormOf(def), slots);
  }

  for (const p of players) if (p !== disc.holder || disc.mode !== 'held') steer(p, dt);
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      const minD = (a === disc.holder || b === disc.holder) && a.team !== b.team ? 1.5 : 1.2;   // pas de contact avec le handler
      if (d > 0.001 && d < minD) {
        const push = (minD - d) * 0.5, nx = dx / d, ny = dy / d;
        if (a !== disc.holder && a !== G.pickup) { a.x -= nx * push; a.y -= ny * push; }
        if (b !== disc.holder && b !== G.pickup) { b.x += nx * push; b.y += ny * push; }
      }
    }
  for (const p of players) { p.x = clamp(p.x, -2, W + 2); p.y = clamp(p.y, -2, H + 2); }

  if (disc.mode === 'held') {
    const h = disc.holder;
    disc.x = h.x; disc.y = h.y;
    G.holdT += dt;
    // règle WFDF : si la mark sort des 3 m (ici STALL_R) ou si un autre défenseur devient la mark, le compte repart à 1
    if (!(G.marker && G.marker.team !== h.team && dist(G.marker.x, G.marker.y, h.x, h.y) < STALL_R)) {
      const form = defFormOf(def);
      const desig = dfn.find(d => (form === 'man' ? d.match === h : d.zslot === 0) && dist(d.x, d.y, h.x, h.y) < STALL_R);
      const [mk, md] = nearestD(dfn, h.x, h.y);
      G.marker = desig || (md < STALL_R ? mk : null);
      G.stall = 0;
    }
    // double team : un autre défenseur dans le cercle sans garder personne → compte gelé, et -1 (règle WFDF)
    // (un défenseur qui traverse le cercle a 1,5 s pour en sortir)
    for (const d of dfn) {
      const inside = d !== G.marker && dist(d.x, d.y, h.x, h.y) < STALL_R && !guardingOther(d, d.x, d.y);
      d.inT = inside ? (d.inT || 0) + dt : 0;
    }
    const dbl = dfn.find(d => d.inT > 1.5) || null;
    if (dbl && !G.dbl && G.marker) { G.stall = Math.max(0, Math.floor(G.stall) - 1); flash('Double team !'); fxEvent('double', h.x, h.y, def); }
    G.dbl = G.marker ? dbl : null;
    if (G.marker && !G.dbl) G.stall += dt;
    if (G.stall >= 10) { G.stats.stalls++; turnover(h.x, h.y, 'Stall 10 ! Turnover', 'stall'); return; }
    if (G.ctrl[off] === 'ai') { h.think -= dt; if (h.think <= 0) aiThrow(h); }
  } else if (disc.mode === 'air') {
    disc.t += dt;
    const u = Math.min(1, disc.t / disc.dur);
    [disc.x, disc.y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u);
    disc.z = Math.sin(Math.PI * u) * peakOf(disc.dur);
    for (const p of players) {
      if (p === disc.thrower) continue;
      const d = dist(p.x, p.y, disc.x, disc.y);
      if (p.team !== disc.team) {
        if (disc.pull) continue;                           // on ne contre pas un pull
        const diving = p.dive > 0;
        const reach = diving ? 1.9 : 1.05, high = diving ? REACH_DIVE : REACH_STAND;
        if (u > 0.03 && d < reach && disc.z < high && !disc.rolled.has(p)) {
          disc.rolled.add(p);
          const r = Math.random();
          if (r < (diving ? 0.3 : 0.2)) { interception(p); return; }
          if (r < (diving ? 0.85 : 0.6)) { G.stats.blocks++; turnover(disc.x, disc.y, diving ? 'Layout block !' : 'Block !', 'block'); return; }
        }
      } else if (u > 0.45 && d < 1.3 && disc.z < 2.3) { catchDisc(p); return; }
    }
    if (u >= 1) {
      if (disc.pull) {
        const [c, cd] = nearestD(TEAMS[disc.team], disc.ex, disc.ey);
        if (c && cd < 1.9) catchDisc(c); else pullLanded(disc.ex, disc.ey);
        return;
      }
      const out = disc.ex < 0 || disc.ex > W || disc.ey < 0 || disc.ey > H;
      const [c, cd] = nearestD(TEAMS[disc.team], disc.ex, disc.ey, disc.thrower);
      if (!out && c && cd < 1.9) { catchDisc(c); return; }
      if (out) G.stats.out++; else G.stats.ground++;
      turnover(disc.ex, disc.ey, out ? 'Out ! Turnover' : 'Turnover');
    }
  } else if (disc.mode === 'ground') {
    const p = G.pickup;
    if (p && dist(p.x, p.y, disc.x, disc.y) < 1.2) { p.x = disc.x; p.y = disc.y; holdDisc(p); }
  }
}

