// throwing.js — Lancers : trajectoire, erreur, vent, choix de passe de l'IA

// =====================================================================
//  Lancers
// =====================================================================
// Imprécision maximale (m) d'un lancer. La passe haute se dégrade vite avec la distance et le vent :
// sans vent, environ 1,2 m à 10 m, 3,4 m à 20 m, 6,6 m à 30 m (passe normale : 0,3 / 0,6 / 0,9 m).
function throwErr(d, curve, kind) {
  const w = G.wind.kmh;
  if (kind === 'high') return (0.07 * d + 0.005 * d * d + Math.abs(curve) * 1.2) * (1 + w * 0.04);
  return (d * 0.03 + Math.abs(curve) * 0.8) * (1 + w * 0.02);
}
// kind : 'normal' ou 'high' (passe haute, par-dessus la défense), voir THROWS
function throwDisc(h, tx, ty, curve, errScale, kind) {
  kind = THROWS[kind] ? kind : 'normal';
  const K = THROWS[kind];
  let dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 0.01;
  if (d < 2) return false;
  if (d > K.max) { tx = h.x + dx / d * K.max; ty = h.y + dy / d * K.max; d = K.max; }
  if (d < K.min) { tx = h.x + dx / d * K.min; ty = h.y + dy / d * K.min; d = K.min; }
  const er = throwErr(d, curve, kind) * errScale * Math.sqrt(Math.random());
  const ea = rand(0, Math.PI * 2);
  const ax = tx + Math.cos(ea) * er, ay = ty + Math.sin(ea) * er;          // point réellement visé
  const dur = throwDur(h.x, h.y, ax, ay, kind);
  const [wx0, wy0] = drift(dur, kind);
  const gk = rand(0.8, 1.2), ga = rand(-0.15, 0.15);                        // rafale imprévisible pendant le vol
  const wx = (wx0 * Math.cos(ga) - wy0 * Math.sin(ga)) * gk, wy = (wx0 * Math.sin(ga) + wy0 * Math.cos(ga)) * gk;
  const ex = ax + wx, ey = ay + wy;                                        // le vent déplace l'arrivée
  const [cx, cy] = ctrlFor(h.x, h.y, ax, ay, curve);
  Object.assign(disc, { mode: 'air', holder: null, sx: h.x, sy: h.y, ex, ey, cx, cy,
    t: 0, dur, thrower: h, team: h.team, rolled: new Set(), kind, curveV: curve,
    rx: tx + wx0, ry: ty + wy0 });                                          // là où la passe devait arriver (sans erreur)
  msThrow(h, d, kind);
  if (G.dplay && G.dplay.team !== h.team) G.dplay.throws++;
  disc.intended = nearest(TEAMS[h.team], ex, ey, h);
  players.forEach(p => { p.diveTried = false; p.jumpTried = false; if (p.team !== h.team) p.react = 0; });
  G.stall = 0; G.stats.throws++;
  fxEvent('throw', h.x, h.y, h.team);
  return true;
}

// Marge de sécurité d'une trajectoire (positive = aucun défenseur ne peut l'atteindre à temps)
function laneSlack(h, aimX, aimY, tx, ty, curve, opp, kind) {
  const dur = throwDur(h.x, h.y, aimX, aimY, kind), peak = peakOf(dur, kind);
  const [cx, cy] = ctrlFor(h.x, h.y, aimX, aimY, curve);
  let min = 9;
  for (let u = 0.04; u <= 1.001; u += 0.06) {
    const z = heightAt(u, peak, kind);
    if (z > REACH_STAND + JUMP_H) continue;
    const jumpOnly = z > REACH_STAND;                         // à portée seulement en sautant : moins risqué
    const [x, y] = bez(h.x, h.y, cx, cy, tx, ty, u), tA = u * dur;
    for (const o of opp) {
      const r = dist(o.x, o.y, x, y);
      const s = (r < 1.1 ? -1 : (r - 1.05) / SPD.def + 0.3 - tA) + (jumpOnly ? 0.45 : 0);
      if (s < min) min = s;
    }
  }
  return min;
}

// release = fin de l'armement d'une passe haute : on choisit la meilleure passe haute à cet instant
function aiThrow(h, release) {
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
    const pSpeed = Math.hypot(p.vx, p.vy);
    for (const [cx0, cy0] of cands) {
      const d = dist(h.x, h.y, cx0, cy0);
      if (d < 4 || d > 48 || cx0 < 0.8 || cx0 > W - 0.8 || cy0 < 0.8 || cy0 > H - 0.8) continue;
      const gain = dir * (cx0 - h.x), long = gain > 20;
      // lancers essayés : normal avec 3 courbes ; passe haute par-dessus la défense (receveur peu mobile, pas trop loin)
      const opts = [['normal', -0.5], ['normal', 0], ['normal', 0.5]];
      if (d >= 8 && d <= 26 && pSpeed < (release ? 8 : 6)) opts.push(['high', 0]);
      for (const [kind, curve] of opts) {
        if (release && kind !== 'high') continue;
        const [aimX, aimY] = aimFor(h, cx0, cy0, kind);
        if (dist(h.x, h.y, aimX, aimY) > THROWS[kind].max) continue;
        const slack = laneSlack(h, aimX, aimY, cx0, cy0, curve, opp, kind);
        const kindCost = kind === 'high' ? (release ? 0 : 0.1 + G.wind.kmh * 0.04 + throwErr(d, 0, kind) * 0.2) : 0;
        // les passes qui font avancer le jeu valent plus, les longues encore plus (huck)
        const v = clamp(slack, -1, 0.6) * 4 + gain * 0.3 + (long ? 2.2 : 0) + (inScoreZone(t, cx0) ? 8 : 0)
          + (G.stall > 5 && p.role === 'dump' ? 2.5 : 0) + (p.free ? 4 : 0) + playBonus - Math.abs(curve) * 0.6 - d * (0.02 + G.wind.kmh * 0.003) - kindCost;
        // un huck peut être un peu disputé : le disque passe au-dessus de la défense au milieu
        const minSlack = (playBonus && P.type === 'huck' ? -0.15 : long || p.free ? -0.08 : 0.05) + aiLvl(t).safe + (kind === 'high' ? (release ? -0.15 : 0) : 0);
        if (slack < minSlack && press < 8.3) continue;
        if (v > bv) { bv = v; best = { tx: aimX, ty: aimY, curve, kind }; }
      }
    }
  }
  if (release) {                                            // passe haute armée : on la lance, ou on renonce
    if (best && best.kind === 'high') throwDisc(h, best.tx, best.ty, best.curve, 0.85 * aiLvl(t).err, 'high');
    else h.think = 0.2;
    return;
  }
  if (!best && press > 9) {                                 // filet de sécurité : aucune option propre, on lance au plus proche
    const p = nearest(TEAMS[t], h.x + dir * 8, h.y, h);
    if (p) { const [ax2, ay2] = aimFor(h, clamp(p.x, 1, W - 1), clamp(p.y, 1, H - 1)); best = { tx: ax2, ty: ay2, curve: 0 }; bv = 9; }
  }
  if (!best || (bv < 3.2 - press * 0.35 && press < 6)) { h.think = 0.25; return; }
  if (best.kind === 'high') { h.windup = { t: rand(...HIGH_WINDUP) }; return; }   // il arme sa passe haute (visible), lancera plus tard
  throwDisc(h, best.tx, best.ty, best.curve, 0.85 * aiLvl(t).err, best.kind);
}
