// throwing.js — Lancers : trajectoire, erreur, vent, choix de passe de l'IA

// =====================================================================
//  Lancers
// =====================================================================
function throwDisc(h, tx, ty, curve, errScale) {
  let dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 0.01;
  if (d < 2) return false;
  if (d > 50) { tx = h.x + dx / d * 50; ty = h.y + dy / d * 50; d = 50; }
  const er = (d * 0.03 + Math.abs(curve) * 0.8) * (1 + G.wind.kmh * 0.02) * errScale * Math.sqrt(Math.random());
  const ea = rand(0, Math.PI * 2);
  const ax = tx + Math.cos(ea) * er, ay = ty + Math.sin(ea) * er;          // point réellement visé
  const dur = throwDur(h.x, h.y, ax, ay);
  const [wx0, wy0] = drift(dur);
  const gk = rand(0.8, 1.2), ga = rand(-0.15, 0.15);                        // rafale imprévisible pendant le vol
  const wx = (wx0 * Math.cos(ga) - wy0 * Math.sin(ga)) * gk, wy = (wx0 * Math.sin(ga) + wy0 * Math.cos(ga)) * gk;
  const ex = ax + wx, ey = ay + wy;                                        // le vent déplace l'arrivée
  const [cx, cy] = ctrlFor(h.x, h.y, ax, ay, curve);
  Object.assign(disc, { mode: 'air', holder: null, sx: h.x, sy: h.y, ex, ey, cx, cy,
    t: 0, dur, thrower: h, team: h.team, rolled: new Set() });
  if (G.dplay && G.dplay.team !== h.team) G.dplay.throws++;
  disc.intended = nearest(TEAMS[h.team], ex, ey, h);
  players.forEach(p => { p.diveTried = false; if (p.team !== h.team) p.react = 0; });
  G.stall = 0; G.stats.throws++;
  fxEvent('throw', h.x, h.y, h.team);
  return true;
}

// Marge de sécurité d'une trajectoire (positive = aucun défenseur ne peut l'atteindre à temps)
function laneSlack(h, aimX, aimY, tx, ty, curve, opp) {
  const dur = throwDur(h.x, h.y, aimX, aimY), peak = peakOf(dur);
  const [cx, cy] = ctrlFor(h.x, h.y, aimX, aimY, curve);
  let min = 9;
  for (let u = 0.04; u <= 1.001; u += 0.06) {
    if (Math.sin(Math.PI * u) * peak > 2.0) continue;
    const [x, y] = bez(h.x, h.y, cx, cy, tx, ty, u), tA = u * dur;
    for (const o of opp) {
      const r = dist(o.x, o.y, x, y);
      const s = r < 1.1 ? -1 : (r - 1.05) / SPD.def + 0.3 - tA;
      if (s < min) min = s;
    }
  }
  return min;
}

function aiThrow(h) {
  const t = h.team, dir = dirOf(t), opp = TEAMS[1 - t];
  const press = Math.max(G.stall, G.holdT * 0.8);           // même sans marqueur, l'IA finit par lancer
  let best = null, bv = -1e9;
  for (const p of TEAMS[t]) {
    if (p === h) continue;
    let tx = p.x, ty = p.y;
    for (let it = 0; it < 2; it++) {                         // anticipe la course du receveur
      const ft = flightTime(dist(h.x, h.y, tx, ty));
      tx = p.x + p.vx * ft * 0.9; ty = p.y + p.vy * ft * 0.9;
    }
    const P = G.oplay, playBonus = P && P.team === t && P.targets.includes(p) ? 3 : 0;
    if (P && P.team === t && P.t < 3.5 && press < 5 && !playBonus) continue;   // l'IA joue son play jusqu'au bout
    // cibles : là où sera le receveur, et pour un joueur qui file vers l'avant, l'espace devant lui (passe longue)
    const cands = [[tx, ty]];
    const fwd = dir * p.vx;
    if (fwd > 3) {
      for (const extra of [6, 12]) {
        const sx = tx + dir * extra, sy = ty + (p.vy || 0) * 0.3;
        const ft = flightTime(dist(h.x, h.y, sx, sy));
        if (dist(p.x, p.y, sx, sy) / SPD.cut <= ft + 0.25) cands.push([sx, sy]);   // il peut y arriver à temps
      }
    }
    for (const [cx0, cy0] of cands) {
      const d = dist(h.x, h.y, cx0, cy0);
      if (d < 4 || d > 48 || cx0 < 0.8 || cx0 > W - 0.8 || cy0 < 0.8 || cy0 > H - 0.8) continue;
      const [aimX, aimY] = aimFor(h, cx0, cy0);
      if (dist(h.x, h.y, aimX, aimY) > 50) continue;
      const gain = dir * (cx0 - h.x), long = gain > 20;
      for (const curve of [-0.5, 0, 0.5]) {
        const slack = laneSlack(h, aimX, aimY, cx0, cy0, curve, opp);
        // les passes qui font avancer le jeu valent plus, les longues encore plus (huck)
        const v = clamp(slack, -1, 0.6) * 4 + gain * 0.3 + (long ? 2.2 : 0) + (inScoreZone(t, cx0) ? 8 : 0)
          + (G.stall > 5 && p.role === 'dump' ? 2.5 : 0) + (p.free ? 4 : 0) + playBonus - Math.abs(curve) * 0.6 - d * (0.02 + G.wind.kmh * 0.003);
        // un huck peut être un peu disputé : le disque passe au-dessus de la défense au milieu
        const minSlack = (playBonus && P.type === 'huck' ? -0.15 : long || p.free ? -0.08 : 0.05) + aiLvl(t).safe;
        if (slack < minSlack && press < 8.3) continue;
        if (v > bv) { bv = v; best = { tx: aimX, ty: aimY, curve }; }
      }
    }
  }
  if (!best && press > 9) {                                 // filet de sécurité : aucune option propre, on lance au plus proche
    const p = nearest(TEAMS[t], h.x + dir * 8, h.y, h);
    if (p) { const [ax2, ay2] = aimFor(h, clamp(p.x, 1, W - 1), clamp(p.y, 1, H - 1)); best = { tx: ax2, ty: ay2, curve: 0 }; bv = 9; }
  }
  if (!best || (bv < 3.2 - press * 0.35 && press < 6)) { h.think = 0.25; return; }
  throwDisc(h, best.tx, best.ty, best.curve, 0.85 * aiLvl(t).err);
}

