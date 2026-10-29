// throwing.js — Lancers : trajectoire, erreur, vent, choix de passe de l'IA

// =====================================================================
//  Lancers
// =====================================================================
// Imprécision maximale (m) d'un lancer. La passe haute se dégrade vite avec la distance et le vent :
// sans vent, environ 1,2 m à 10 m, 3,4 m à 20 m, 6,6 m à 30 m (passe normale : 0,3 / 0,6 / 0,9 m).
// Passe normale courbée : plus elle est courbée, plus le vent la rend imprévisible (droite : comme avant ;
// pleine courbe : l'effet du vent sur l'imprécision est multiplié par 4)
// Plus la passe est haute, plus elle est imprécise (on mélange les deux formules) ; une passe rasante est un peu plus précise.
function throwErr(d, curve, kind) {
  const w = G.wind.kmh, c = Math.min(1, Math.abs(curve || 0)), l = loftOf(kind), hw = loftW(l);
  const en = (d * 0.03 + c * 0.8) * (1 + w * 0.022 * (1 + 3 * c)) * (1 - 0.25 * loftLow(l));
  if (hw <= 0) return en;
  return en + ((0.07 * d + 0.005 * d * d + c * 1.2) * (1 + w * 0.012) - en) * hw;
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
const throwSpd = h => (controllerOf(h) ? 1 : aiLvl(h.team).tspd || 1);
// kind : hauteur de la passe (0 → 1, voir LOFT ; 'normal' / 'high' acceptés)
function throwDisc(h, tx, ty, curve, errScale, kind) {
  const loft = loftOf(kind), K = throwK(loft), hw = loftW(loft);
  kind = loft;
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
  const cw = 1 + 1.4 * Math.min(1, Math.abs(curve || 0)) * (1 - hw);       // une passe courbée subit plus les rafales
  const gv = [0.16 * cw + (0.07 - 0.16 * cw) * hw, 0.11 * cw + (0.05 - 0.11 * cw) * hw];   // petite rafale imprévisible pendant le vol
  const gk = rand(1 - gv[0], 1 + gv[0]), ga = rand(-gv[1], gv[1]);
  const wx = (wx0 * Math.cos(ga) - wy0 * Math.sin(ga)) * gk, wy = (wx0 * Math.sin(ga) + wy0 * Math.cos(ga)) * gk;
  const ex = ax + wx, ey = ay + wy;                                        // le vent déplace l'arrivée
  const [sx, sy] = releasePoint(h, ax, ay), [cx, cy] = ctrlFor(sx, sy, ax, ay, curve);
  disc.mark = (G.tuto && !G.tuto.mark) || G.practice ? null : markOf(h);           // elle peut se fendre vers le disque au lâcher (sim.js)
  Object.assign(disc, { mode: 'air', holder: null, sx, sy, ex, ey, cx, cy,
    t: 0, dur, thrower: h, team: h.team, rolled: new Set(), bd: new Map(), wa: windAlong(sx, sy, ex, ey), kind: loftLabel(loft), loft, curveV: curve, pull: false,
    rx: tx + wx0, ry: ty + wy0 });                                          // là où la passe devait arriver (sans erreur)
  // cône d'incertitude (voir CONE) : rayon au lâcher, décalage du cercle affiché, et l'idée que chacun se fait de l'arrivée
  const r0 = coneR(d, curve, loft, wx0, wy0), oa = rand(0, Math.PI * 2), om = r0 * CONE.SHOW * Math.sqrt(Math.random());
  disc.cone = r0; disc.coneOff = [Math.cos(oa) * om, Math.sin(oa) * om];
  makeGuesses(h);
  msThrow(h, d, loftLabel(loft));
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
function laneSlack(h, aimX, aimY, tx, ty, curve, opp, kind, side, misread) {
  if (side === undefined && loftOf(kind) < LOFT.HIGH) side = pivotFor(h, aimX, aimY);   // comme le ferait le lanceur : il pivotera du bon côté
  const dur = throwDur(h.x, h.y, aimX, aimY, kind) * throwSpd(h), peak = peakOf(dur, kind);
  const [sx, sy] = releasePoint(h, aimX, aimY, side), [cx, cy] = ctrlFor(sx, sy, aimX, aimY, curve), len = dist(sx, sy, tx, ty);
  // la mark : là où elle est, ou là où elle sera si le porteur doit encore pivoter (elle suit son pivot)
  const mk = disc.holder === h ? markOf(h) : null, piv = side !== undefined && Math.abs((h.pivY || 0) - side) > 0.35;
  const mark = mk ? { p: mk, ...(([x, y]) => ({ x, y }))(piv ? markSpotFor(mk.team, h.x, h.y, side) : [mk.x, mk.y]) } : null;
  const wa = windAlong(sx, sy, tx, ty);
  return pathSlack({ sx, sy, cx, cy, ex: tx, ey: ty, dur, z: u => heightAt(u, peak, kind, len, curve, wa) }, opp, mark, misread || 0);
}

// release = fin de l'armement d'une passe haute : on choisit la meilleure passe haute à cet instant
function aiThrow(h, release) {
  const t = h.team, dir = dirOf(t), opp = TEAMS[1 - t];
  const press = Math.max(G.stall, G.holdT * 0.8);           // même sans marqueur, l'IA finit par lancer
  const ST = aiStyle(t), L = aiLvl(t), RK = riskOf(t), greed = clamp((L.greed || 0) + RK[1], 0, 1);   // greed : un débutant force les passes (et la consigne « osé »)
  let best = null, bv = -1e9, rawV = -1e9, want = 0;
  // il juge les passes sur ce qu'il a vu (vision.js) : coéquipiers et défenseurs à leur position de mémoire
  const mkH = markOf(h), oppS = seenAll(h, opp), oppNoMk = mkH ? oppS.filter(o => (o.src || o) !== mkH) : oppS;
  for (const pr of TEAMS[t]) {
    if (pr === h) continue;
    const p = seen(h, pr);
    let tx = p.x, ty = p.y;
    for (let it = 0; it < 2; it++) {                         // anticipe la course du receveur
      const ft = flightTime(dist(h.x, h.y, tx, ty));
      tx = p.x + p.vx * ft * 0.9; ty = p.y + p.vy * ft * 0.9;
    }
    const P = G.oplay, playBonus = P && P.team === t && P.targets.includes(pr) ? 3 : 0;
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
      // le receveur doit pouvoir y être à temps (avec sa vraie accélération), avec une petite marge pour l'imprécision du lancer
      const early = throwDur(h.x, h.y, cx0, cy0, 'normal') * throwSpd(h) - recvTime(p, cx0, cy0);
      if (early < 0.1 && !controllerOf(pr)) continue;
      const gain = dir * (cx0 - h.x), long = gain > 20;
      // lancers essayés : normal avec 3 courbes ; rasante (tendue, rapide) ; lob et passe haute par-dessus la défense
      // (receveur peu mobile, pas trop loin)
      const opts = [[LOFT.N, -0.5], [LOFT.N, 0], [LOFT.N, 0.5]];
      if (d <= 25) opts.push([0.1, 0]);
      if (d >= 10 && d <= 34 && pSpeed < 8) opts.push([0.6, 0]);
      if (d >= 8 && d <= 26 && pSpeed < (release ? 8 : 6)) opts.push([1, 0]);
      for (const [kind, curve] of opts) {
        const hi = kind >= LOFT.HIGH, hw = loftW(kind);
        if (release && !hi) continue;
        const [aimX, aimY] = aimFor(h, cx0, cy0, kind);
        if (dist(h.x, h.y, aimX, aimY) > throwK(kind).max) continue;
        const side = hi ? (h.pivY || 0) : pivotFor(h, aimX, aimY);   // passe haute : par-dessus la mark, pas de pivot
        if (!hi && G.holdT < (h.pivLock || 0) && side !== h.pivTo) continue;   // il vient de pivoter : il regarde de ce côté
        const slack = laneSlack(h, aimX, aimY, cx0, cy0, curve, oppS, kind, side, L.misread);   // un joueur qui lit mal voit des passes ouvertes qui ne le sont pas
        const kindCost = hw > 0 ? (release ? 0 : ((0.1 + G.wind.kmh * 0.04 + throwErr(d, 0, kind) * 0.2) / ST.high + (ST.high < 1 ? 1.5 : 0)) * hw)
          : loftLow(kind) * 0.5;                                // rasante : seulement quand elle apporte vraiment quelque chose
        // les passes qui font avancer le jeu valent plus, les longues encore plus (huck)
        const v = clamp(slack, -1, 0.6) * 4 * (1 - 0.45 * greed) + gain * 0.3 * (1 + 0.6 * greed) + (long ? 2.2 * ST.huck * (1 + greed) : 0) + (inScoreZone(t, cx0) ? 8 : 0)
          + (G.stall > 5 && p.role === 'dump' ? 2.5 : 0) + (p.free ? 4 : 0) + playBonus - Math.abs(curve) * (0.6 + G.wind.kmh * 0.03) - d * (0.02 + G.wind.kmh * 0.003) - kindCost;   // courbe dans le vent : risquée
        // un huck peut être un peu disputé : le disque passe au-dessus de la défense au milieu
        const minSlack = (playBonus && P.type === 'huck' ? -0.15 : long ? -0.08 - (ST.huck - 1) * 0.25 : p.free ? -0.08 : 0.05) + L.safe + RK[0] - 0.45 * greed + (hi && release ? -0.15 : 0)
          - Math.max(0, press - 3) * 0.07;                    // le compte monte : il accepte peu à peu une passe un peu disputée
        if (slack < minSlack && press < 8.3) {
          // fermée seulement par la mark ? c'est une passe à aller chercher par une feinte
          if (mkH && !hi && v > rawV && laneSlack(h, aimX, aimY, cx0, cy0, curve, oppNoMk, kind, side, L.misread) >= minSlack) { rawV = v; want = side; }
          continue;
        }
        if (v > bv) { bv = v; best = { tx: aimX, ty: aimY, curve, kind, hi, side }; }
      }
    }
  }
  if (release) {                                            // passe haute armée : on la lance, ou on renonce
    if (best && best.hi) throwDisc(h, best.tx, best.ty, best.curve, 0.85 * L.err, best.kind);
    else h.think = 0.2;
    return;
  }
  if (!best && press > 9) {                                 // filet de sécurité : aucune option propre, on lance au plus proche
    const p = nearest(TEAMS[t], h.x + dir * 8, h.y, h);
    if (p) { const [ax2, ay2] = aimFor(h, clamp(p.x, 1, W - 1), clamp(p.y, 1, H - 1)); best = { tx: ax2, ty: ay2, curve: 0, kind: LOFT.N, hi: false, side: pivotFor(h, ax2, ay2) }; bv = 9; }
  }
  if (!best || (bv < 3.2 - 1.2 * greed - press * 0.35 && press < 6)) {
    // rien de bon : une fois par possession, l'IA appelle un de ses plays pour créer l'option qui manque
    if (!G.aiPlayTried && !G.oplay && G.holdT > 0.6) { G.aiPlayTried = true; if (callPlay(t, 1) || callPlay(t, 2)) { h.think = 0.35; return; } }
    // feinte : la passe qu'il veut est fermée par la mark → il pivote de l'autre côté pour l'attirer, puis reviendra
    const mk = markOf(h);
    if (mk && want && G.holdT > 0.6 && G.stall < 6 && Math.random() < (L.fake || 0.3)) { h.pivTo = -want; h.pivLock = 0; h.think = rand(0.3, 0.45); return; }
    h.think = 0.25; return;
  }
  if (!best.hi && Math.abs((h.pivY || 0) - best.side) > 0.35 && G.stall < 9.4) {   // il doit d'abord pivoter (la mark va suivre)
    h.pivTo = best.side; h.pivLock = G.holdT + 0.7; h.think = PIVOT_T * aiLvl(t).react * 0.9; return;
  }
  if (best.hi) { h.windup = { t: rand(...HIGH_WINDUP), loft: best.kind }; return; }   // il arme sa passe haute (disque levé, visible), lancera plus tard
  // bluff : il arme une passe haute sans vraiment la vouloir, pour faire sauter la mark (puis lance ce qui est ouvert)
  if (G.marker && dist(G.marker.x, G.marker.y, h.x, h.y) < 3 && !h.bluffed && Math.random() < ST.bluff * 0.3) {
    h.bluffed = true; h.windup = { t: rand(0.5, 1.1), bluff: true, loft: 1 }; return;
  }
  throwDisc(h, best.tx, best.ty, best.curve, 0.85 * L.err, best.kind);
}

