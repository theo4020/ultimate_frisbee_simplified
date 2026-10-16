// throwing.js — Lancers : trajectoire, erreur, vent, choix de passe de l'IA

// =====================================================================
//  Lancers
// =====================================================================
// Imprécision maximale (m) d'un lancer. La passe haute se dégrade vite avec la distance et le vent :
// sans vent, environ 1,2 m à 10 m, 3,4 m à 20 m, 6,6 m à 30 m (passe normale : 0,3 / 0,6 / 0,9 m).
// Passe normale courbée : plus elle est courbée, plus le vent la rend imprévisible (droite : comme avant ;
// pleine courbe : l'effet du vent sur l'imprécision est multiplié par 4)
function throwErr(d, curve, kind) {
  const w = G.wind.kmh, c = Math.min(1, Math.abs(curve || 0));
  if (kind === 'high') return (0.07 * d + 0.005 * d * d + c * 1.2) * (1 + w * 0.012);
  return (d * 0.03 + c * 0.8) * (1 + w * 0.022 * (1 + 3 * c));
}
// Pivot : le porteur pivote de part et d'autre de la mark (h.pivY : +1 = côté fermé, un peu vers l'arrière, pour la
// contourner ; -1 = côté open, un peu vers l'avant), et lâche le disque jusqu'à PIVOT_R m de son corps.
// L'axe du pivot est perpendiculaire à la direction porteur → mark (sans mark : là où elle se placerait).
function pivotAxis(h) {
  // axe fixe : calculé depuis la place de base de la mark (pas sa position réelle, qui suit le pivot : sinon ça tourne en rond)
  const c = closedOf(1 - h.team), d = dirOf(h.team), [mx, my] = markSpotFor(1 - h.team, h.x, h.y, 0);
  let ux = mx - h.x, uy = my - h.y;
  const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
  let bx = -uy, by = ux;                                           // perpendiculaire…
  if (by * c < 0 || (Math.abs(by) < 0.05 && bx * d > 0)) { bx = -bx; by = -by; }   // …du côté fermé (et vers l'arrière)
  return [bx, by];
}
// side = pivot supposé (sinon son pivot actuel)
function releasePoint(h, tx, ty, side) {
  const s = side === undefined ? (h.pivY || 0) : side, [bx, by] = pivotAxis(h);
  return [h.x + bx * s * PIVOT_R, h.y + by * s * PIVOT_R];
}
// pivot pour lancer vers (tx, ty) : côté fermé si la passe part de ce côté-là de l'axe (break, relais derrière côté fermé),
// sinon côté open (passes vers l'avant et côté open)
function pivotFor(h, tx, ty) {
  const [bx, by] = pivotAxis(h);
  return (tx - h.x) * bx + (ty - h.y) * by > 0 ? 1 : -1;
}
// la mark du porteur (défenseur à moins de 3 m qui le marque), sinon null
const markOf = h => { const m = G.marker; return m && h && m.team !== h.team && dist(m.x, m.y, h.x, h.y) < STALL_R ? m : null; };
// vitesse des passes d'un joueur IA selon son niveau (un humain lance à la vitesse normale)
// chance de feinter (par décision) quand la mark ferme la passe voulue
const FAKE_P = { facile: 0.12, normal: 0.3, difficile: 0.45 };
const aiLvlName = t => { const L = aiLvl(t); return L.react >= 1.2 ? 'facile' : L.react <= 0.85 ? 'difficile' : 'normal'; };
const throwSpd = h => (controllerOf(h) ? 1 : aiLvl(h.team).tspd || 1);
// kind : 'normal' ou 'high' (passe haute, par-dessus la défense), voir THROWS
function throwDisc(h, tx, ty, curve, errScale, kind) {
  kind = THROWS[kind] ? kind : 'normal';
  const K = THROWS[kind];
  let dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 0.01;
  if (d < 2) return false;
  if (d > K.max) { tx = h.x + dx / d * K.max; ty = h.y + dy / d * K.max; d = K.max; }
  if (d < K.min) { tx = h.x + dx / d * K.min; ty = h.y + dy / d * K.min; d = K.min; }
  const run = Math.hypot(h.vx || 0, h.vy || 0);                // lancer en courant (pas encore arrêté) : moins précis
  const er = throwErr(d, curve, kind) * errScale * (1 + run * 0.15) * Math.sqrt(Math.random());
  const ea = rand(0, Math.PI * 2);
  const ax = tx + Math.cos(ea) * er, ay = ty + Math.sin(ea) * er;          // point réellement visé
  const dur = throwDur(h.x, h.y, ax, ay, kind) * throwSpd(h);
  const [wx0, wy0] = drift(dur, kind);
  const cw = kind === 'high' ? 1 : 1 + 1.4 * Math.min(1, Math.abs(curve || 0));    // une passe courbée subit plus les rafales
  const gv = kind === 'high' ? [0.07, 0.05] : [0.16 * cw, 0.11 * cw];        // petite rafale imprévisible pendant le vol
  const gk = rand(1 - gv[0], 1 + gv[0]), ga = rand(-gv[1], gv[1]);
  const wx = (wx0 * Math.cos(ga) - wy0 * Math.sin(ga)) * gk, wy = (wx0 * Math.sin(ga) + wy0 * Math.cos(ga)) * gk;
  const ex = ax + wx, ey = ay + wy;                                        // le vent déplace l'arrivée
  const [sx, sy] = releasePoint(h, ax, ay), [cx, cy] = ctrlFor(sx, sy, ax, ay, curve);
  disc.mark = (G.tuto && !G.tuto.mark) || G.practice ? null : markOf(h);           // elle peut se fendre vers le disque au lâcher (sim.js)
  Object.assign(disc, { mode: 'air', holder: null, sx, sy, ex, ey, cx, cy,
    t: 0, dur, thrower: h, team: h.team, rolled: new Set(), kind, curveV: curve, pull: false,
    rx: tx + wx0, ry: ty + wy0 });                                          // là où la passe devait arriver (sans erreur)
  msThrow(h, d, kind);
  if (G.dplay && G.dplay.team !== h.team) G.dplay.throws++;
  disc.intended = nearest(TEAMS[h.team], ex, ey, h);
  players.forEach(p => { p.diveTried = false; p.diveArmed = false; p.jumpTried = false; if (p.team !== h.team) p.react = rand(0.2, 0.3) * aiLvl(p.team).react; });   // la défense voit le lancer, puis réagit (course, plongeon)
  G.stall = 0; G.stats.throws++;
  fxEvent('throw', h.x, h.y, h.team);
  preCatch();
  return true;
}
// Passe lancée qui va être attrapée (le receveur arrive à temps et aucun défenseur ne peut la couper) :
// attaquants et défenseurs se placent tout de suite comme si le receveur avait déjà le disque au point de réception
// (rôles d'attaque, défenseur attribué à chacun), au lieu d'attendre la réception pour se réorganiser.
function preCatch() {
  const p = disc.intended;
  if (!p || disc.pull || G.tuto || G.practice) return;
  const [x, y, ok] = runPoint(p);
  if (!ok || inScoreZone(p.team, x)) return;
  const safe = !TEAMS[1 - p.team].some(d => bestIntercept(d));
  if (!safe && flowOf(p.team)) return;                      // structuré : l'attaque se replace dès le lancer, même si la passe est disputée
  const ox = p.x, oy = p.y;
  p.x = x; p.y = y;                                          // le temps du calcul, le receveur est « déjà » au point de réception
  assignRoles(p.team, p); if (safe) setupDefense(1 - p.team, p);
  p.x = ox; p.y = oy;
  G.stats.preCatch = (G.stats.preCatch || 0) + 1;
}

// Marge de sécurité d'une trajectoire (positive = aucun défenseur ne peut l'atteindre à temps, en secondes) :
// pour chaque point du vol à portée, temps de réaction + course du défenseur, comparé au temps du disque
function laneSlack(h, aimX, aimY, tx, ty, curve, opp, kind, side) {
  if (side === undefined && kind !== 'high') side = pivotFor(h, aimX, aimY);   // comme le ferait le lanceur : il pivotera du bon côté
  const dur = throwDur(h.x, h.y, aimX, aimY, kind) * throwSpd(h), peak = peakOf(dur, kind);
  const [sx, sy] = releasePoint(h, aimX, aimY, side), [cx, cy] = ctrlFor(sx, sy, aimX, aimY, curve);
  // la mark : là où elle est, ou là où elle sera si le porteur doit encore pivoter (elle suit son pivot)
  const mk = disc.holder === h ? markOf(h) : null, piv = side !== undefined && Math.abs((h.pivY || 0) - side) > 0.35;
  const mkPos = mk && piv ? markSpotFor(mk.team, h.x, h.y, side) : mk ? [mk.x, mk.y] : null;
  const L = opp.length ? aiLvl(opp[0].team) : AI_LEVELS.normal, react = 0.25 * L.react, vmax = SPD.def * L.speed;
  const jumpMax = REACH_STAND + (L.jump || JUMP_H), len = dist(sx, sy, tx, ty);
  let min = 9;
  for (let u = 0.04; u <= 1.001; u += 0.06) {
    const z = heightAt(u, peak, kind, len, curve);
    if (z > jumpMax) continue;
    const jumpOnly = z > REACH_STAND;                         // à portée seulement en sautant : moins risqué
    const [x, y] = bez(sx, sy, cx, cy, tx, ty, u), tA = u * dur;
    for (const o of opp) {
      let s;
      if (o === mk) s = dist(mkPos[0], mkPos[1], x, y) < ARM_R + (tA < MARK_LUNGE_T ? MARK_LUNGE : 0) ? -0.6 : 9;   // la mark se fend au lâcher
      else s = dist(o.x, o.y, x, y) < ARM_R ? -0.6 : reachTime(o, x, y, vmax, ARM_R) + react - tA;
      s += jumpOnly ? 0.45 : 0;
      if (s < min) min = s;
    }
  }
  return min;
}

// release = fin de l'armement d'une passe haute : on choisit la meilleure passe haute à cet instant
function aiThrow(h, release) {
  const t = h.team, dir = dirOf(t), opp = TEAMS[1 - t];
  const press = Math.max(G.stall, G.holdT * 0.8);           // même sans marqueur, l'IA finit par lancer
  const ST = aiStyle(t), L = aiLvl(t), RK = riskOf(t), greed = clamp((L.greed || 0) + RK[1], 0, 1);   // greed : un débutant force les passes (et la consigne « osé »)
  if (!release && !G.aiPlayTried && !G.oplay) {              // une fois par possession, l'IA appelle parfois un de ses deux plays
    G.aiPlayTried = true;
    if (Math.random() < 0.5 && callPlay(t, Math.random() < 0.6 ? 1 : 2)) { h.think = 0.35; return; }
  }
  let best = null, bv = -1e9, rawV = -1e9, want = 0;
  const mkH = markOf(h), oppNoMk = mkH ? opp.filter(o => o !== mkH) : opp;
  for (const p of TEAMS[t]) {
    if (p === h) continue;
    let tx = p.x, ty = p.y;
    for (let it = 0; it < 2; it++) {                         // anticipe la course du receveur
      const ft = flightTime(dist(h.x, h.y, tx, ty));
      tx = p.x + p.vx * ft * 0.9; ty = p.y + p.vy * ft * 0.9;
    }
    const P = G.oplay, playBonus = P && P.team === t && P.targets.includes(p) ? 3 : 0;
    // play en cours : tant que ses coupeurs sont en route, l'IA attend leur appel (mais pas trop longtemps)
    if (P && P.team === t && P.t < 2.5 && press < 5 && !playBonus && P.targets.some(q => q.state === 'jab' || q.state === 'cut' || q.state === 'park')) continue;
    // cibles : là où sera le receveur, et pour un joueur qui file vers l'avant, l'espace devant lui (passe longue)
    const cands = [[tx, ty]];
    const fwd = dir * p.vx;
    if (fwd > 3) {
      for (const extra of ST.huck > 1.3 ? [6, 12, 18] : [6, 12]) {
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
        const side = kind === 'high' ? (h.pivY || 0) : pivotFor(h, aimX, aimY);   // passe haute : par-dessus la mark, pas de pivot
        if (kind !== 'high' && G.holdT < (h.pivLock || 0) && side !== h.pivTo) continue;   // il vient de pivoter : il regarde de ce côté
        const slack = laneSlack(h, aimX, aimY, cx0, cy0, curve, opp, kind, side);
        const kindCost = kind === 'high' ? (release ? 0 : (0.1 + G.wind.kmh * 0.04 + throwErr(d, 0, kind) * 0.2) / ST.high + (ST.high < 1 ? 1.5 : 0)) : 0;
        // les passes qui font avancer le jeu valent plus, les longues encore plus (huck)
        const v = clamp(slack, -1, 0.6) * 4 * (1 - 0.45 * greed) + gain * 0.3 * (1 + 0.6 * greed) + (long ? 2.2 * ST.huck * (1 + greed) : 0) + (Math.random() - 0.5) * 4 * greed + (inScoreZone(t, cx0) ? 8 : 0)
          + (G.stall > 5 && p.role === 'dump' ? 2.5 : 0) + (p.free ? 4 : 0) + playBonus - Math.abs(curve) * (0.6 + G.wind.kmh * 0.03) - d * (0.02 + G.wind.kmh * 0.003) - kindCost;   // courbe dans le vent : risquée
        // un huck peut être un peu disputé : le disque passe au-dessus de la défense au milieu
        const minSlack = (playBonus && P.type === 'huck' ? -0.15 : long ? -0.08 - (ST.huck - 1) * 0.25 : p.free ? -0.08 : 0.05) + L.safe + RK[0] - 0.45 * greed + (kind === 'high' ? (release ? -0.15 : 0) : 0);
        if (slack < minSlack && press < 8.3) {
          // fermée seulement par la mark ? c'est une passe à aller chercher par une feinte
          if (mkH && kind !== 'high' && v > rawV && laneSlack(h, aimX, aimY, cx0, cy0, curve, oppNoMk, kind, side) >= minSlack) { rawV = v; want = side; }
          continue;
        }
        if (v > bv) { bv = v; best = { tx: aimX, ty: aimY, curve, kind, side }; }
      }
    }
  }
  if (release) {                                            // passe haute armée : on la lance, ou on renonce
    if (best && best.kind === 'high') throwDisc(h, best.tx, best.ty, best.curve, 0.85 * L.err, 'high');
    else h.think = 0.2;
    return;
  }
  if (!best && press > 9) {                                 // filet de sécurité : aucune option propre, on lance au plus proche
    const p = nearest(TEAMS[t], h.x + dir * 8, h.y, h);
    if (p) { const [ax2, ay2] = aimFor(h, clamp(p.x, 1, W - 1), clamp(p.y, 1, H - 1)); best = { tx: ax2, ty: ay2, curve: 0, kind: 'normal', side: pivotFor(h, ax2, ay2) }; bv = 9; }
  }
  if (!best || (bv < 3.2 - 1.2 * greed - press * 0.35 && press < 6)) {
    // feinte : la passe qu'il veut est fermée par la mark → il pivote de l'autre côté pour l'attirer, puis reviendra
    const mk = markOf(h);
    if (mk && want && G.holdT > 0.6 && G.stall < 6 && Math.random() < FAKE_P[aiLvlName(t)]) { h.pivTo = -want; h.pivLock = 0; h.think = rand(0.3, 0.45); return; }
    h.think = 0.25; return;
  }
  if (best.kind !== 'high' && Math.abs((h.pivY || 0) - best.side) > 0.35 && G.stall < 9.4) {   // il doit d'abord pivoter (la mark va suivre)
    h.pivTo = best.side; h.pivLock = G.holdT + 0.7; h.think = PIVOT_T * aiLvl(t).react * 0.9; return;
  }
  if (best.kind === 'high') { h.windup = { t: rand(...HIGH_WINDUP) }; return; }   // il arme sa passe haute (visible), lancera plus tard
  // bluff : il arme une passe haute sans vraiment la vouloir, pour faire sauter la mark (puis lance ce qui est ouvert)
  if (G.marker && dist(G.marker.x, G.marker.y, h.x, h.y) < 3 && !h.bluffed && Math.random() < ST.bluff * 0.3) {
    h.bluffed = true; h.windup = { t: rand(0.5, 1.1), bluff: true }; return;
  }
  throwDisc(h, best.tx, best.ty, best.curve, 0.85 * L.err, best.kind);
}

