// defense.js — IA défensive : man, zone (cup), courses vers le disque, layout, double team

// =====================================================================
//  Défense : individuelle (avec marquage orienté) ou zone (cup)
// =====================================================================
function assignMan(defT, h) {
  const atk = TEAMS[1 - defT].slice().sort((a, b) => (a === h ? -1 : b === h ? 1 : dist(a.x, a.y, h.x, h.y) - dist(b.x, b.y, h.x, h.y)));
  const pool = TEAMS[defT].slice();
  for (const a of atk) {
    const d = nearest(pool, a.x, a.y);
    d.match = a; pool.splice(pool.indexOf(d), 1);
  }
}

// zone (cup) : places relatives au disque, en m (f = vers la profondeur, s = côté open ; négatif = côté fermé)
const ZONE = { cupF: 4, cupOpen: 4.5, cupClosed: 3.5, cupPull: 0.45, cupReach: 13, deepMin: 16, deepBehind: 3, midF: [6, 21], midIdle: 12 };
function zoneSlots(defT, ax, ay, dir, closed) {
  if (defFormOf(defT) === 'mix') return mixSlots(dsysOf(defT), defT, ax, ay, dir, closed);
  if (defFormOf(defT) === 'clam') return clamSlots(defT, ax, ay, dir, closed);
  const open = -closed, atk = TEAMS[1 - defT], s = [];
  s[0] = { x: ax + dir * 1.0, y: ay + closed * 1.3 };                       // marqueur
  let deepA = null, dd = -1e9;
  for (const a of atk) { const dep = dir * (a.x - ax); if (dep > dd) { dd = dep; deepA = a; } }
  const deepDepth = Math.max(ZONE.deepMin, dd + ZONE.deepBehind);           // derrière l'attaquant le plus profond
  s[1] = { x: ax + dir * deepDepth, y: H / 2 * 0.4 + (deepA ? deepA.y : H / 2) * 0.6 };   // arrière
  s[2] = { x: ax + dir * ZONE.cupF, y: ay + open * ZONE.cupOpen };         // cup côté ouvert
  s[3] = { x: ax + dir * ZONE.cupF, y: ay - open * ZONE.cupClosed };       // cup côté fermé
  for (const k of [2, 3]) {                                                 // le cup se décale vers la passe courte la plus proche
    const side = k === 2 ? open : -open;
    let tgt = null, bd = ZONE.cupReach;
    for (const a of atk) {
      if (a === disc.holder) continue;
      const dep = dir * (a.x - ax), lat = (a.y - ay) * side;
      const dd = Math.hypot(dep, a.y - ay);
      if (dep > -3 && lat > -1 && dd < bd) { bd = dd; tgt = a; }
    }
    if (tgt) { s[k].x = ax + (tgt.x - ax) * ZONE.cupPull; s[k].y = ay + (tgt.y - ay) * ZONE.cupPull; }
  }
  let midA = null, best = 1e9;                                              // milieu : l'attaquant le plus dangereux au centre
  for (const a of atk) {
    if (a === disc.holder) continue;
    const dep = dir * (a.x - ax);
    if (dep > ZONE.midF[0] && dep < ZONE.midF[1]) { const sc = Math.abs(a.y - H / 2) + Math.abs(dep - ZONE.midIdle) * 0.5; if (sc < best) { best = sc; midA = a; } }
  }
  s[4] = midA ? { x: midA.x - dir * 1, y: midA.y * 0.7 + ay * 0.3 } : { x: ax + dir * ZONE.midIdle, y: H / 2 * 0.5 + ay * 0.5 };
  return keepOutOfCircle(s, ax, ay, defT);
}
// Clam : la mark, deux « pinces » devant le disque (under cuts côté open et au centre), deux deep qui se partagent la largeur
function clamSlots(defT, ax, ay, dir, closed) {
  const open = -closed, atk = TEAMS[1 - defT].filter(a => a !== disc.holder), s = [];
  const [mx, my] = markSpot(defT, ax, ay);
  s[0] = { x: mx, y: my };
  const near = (x, y, r) => { const [a, d] = nearestD(atk, x, y); return a && d < r ? a : null; };
  const pinch = (x, y) => { const a = near(x, y, 7); return a ? { x: (x + a.x) / 2 + dir * 0.6, y: (y + a.y) / 2 } : { x, y }; };
  if (forceOf(defT) === 'straight') {                                       // straight up : les deux côtés sont ouverts → une pince de chaque côté
    s[2] = pinch(ax + dir * 8, clamp(ay + 6, 3, H - 3)); s[3] = pinch(ax + dir * 8, clamp(ay - 6, 3, H - 3));
  } else {
    s[2] = pinch(ax + dir * 8, ay + open * 6);                              // pince côté open
    s[3] = pinch(ax + dir * 10, ay * 0.4 + H / 2 * 0.6 - open * 1.5);       // pince centrale
  }
  let dd = 18;
  for (const a of atk) dd = Math.max(dd, dir * (a.x - ax) + 2.5);
  const deepY = side => { let best = side < 0 ? H * 0.28 : H * 0.72;        // chaque deep suit l'attaquant le plus profond de sa moitié
    let bd = -1e9; for (const a of atk) { if ((a.y - H / 2) * side < 0) continue; const dep = dir * (a.x - ax); if (dep > bd) { bd = dep; best = a.y * 0.6 + best * 0.4; } }
    return best; };
  s[1] = { x: ax + dir * dd, y: deepY(-1) };
  s[4] = { x: ax + dir * dd, y: deepY(1) };
  return keepOutOfCircle(s, ax, ay, defT);
}
// limite du fond pour une zone : inutile d'aller au-delà du début de l'en-but (+5 m), sauf pour suivre un attaquant
// placé plus loin (à 2 m derrière lui) — sinon, disque près de l'en-but, l'arrière se collait au fond du terrain pour rien
function zoneBackLine(defT) {
  const t = 1 - defT, dir = dirOf(t);
  let lim = (dir > 0 ? W - EZ : EZ) + dir * 5;
  for (const a of TEAMS[t]) if (a !== disc.holder && dir * (a.x + dir * 2 - lim) > 0) lim = a.x + dir * 2;
  return lim;
}
function keepOutOfCircle(s, ax, ay, defT) {
  if (defT !== undefined) {
    const lim = zoneBackLine(defT), dir = dirOf(1 - defT);
    for (const o of s) if (o && dir * (o.x - lim) > 0) o.x = lim;
  }
  for (let k = 1; k < 5; k++) {                                              // seul le marqueur entre dans le cercle de stall
    const o = s[k], dd = dist(o.x, o.y, ax, ay), lim = STALL_R + 0.9;
    if (dd < lim) { const f = lim / Math.max(dd, 0.01); o.x = ax + (o.x - ax) * f; o.y = ay + (o.y - ay) * f; }
  }
  for (const o of s) { o.x = clamp(o.x, 0.5, W - 0.5); o.y = clamp(o.y, 0.5, H - 0.5); }
  return s;
}

function assignZone(defT, hx, hy) {
  const s = zoneSlots(defT, hx, hy, dirOf(1 - defT), closedOf(defT));
  const pool = TEAMS[defT].slice();
  for (const k of [0, 1, 4, 2, 3]) {
    const d = nearest(pool, s[k].x, s[k].y);
    d.zslot = k; pool.splice(pool.indexOf(d), 1);
  }
}

function setupDefense(defT, h) {
  const f = defFormOf(defT);
  if (f === 'man') assignMan(defT, h); else if (f === 'mix') assignMix(defT, h); else assignZone(defT, h.x, h.y);
}

// =====================================================================
//  Défense perso (systems.js) : la mark + 4 défenseurs, chacun en individuelle ou en zone
// =====================================================================
// à chaque réception : la mark va au plus proche ; chaque poste en individuelle garde l'attaquant le plus proche de sa place
// (il garde le même s'il le peut) ; chaque poste en zone prend le défenseur restant le plus proche de sa place
function assignMix(defT, h) {
  const D = dsysOf(defT); if (!D) return;
  const dir = dirOf(1 - defT), open = -closedOf(defT), spots = sysWorld(D.postes.map(q => q.pos), h.x, h.y, dir, open);
  const pool = TEAMS[defT].slice(), atk = TEAMS[1 - defT].filter(a => a !== h);
  const take = d => { pool.splice(pool.indexOf(d), 1); return d; };
  const [mx, my] = markSpot(defT, h.x, h.y);
  const mk = take(nearest(pool, mx, my)); mk.mission = { type: 'mark' }; mk.match = h; mk.zslot = 0;
  D.postes.forEach((P, k) => {
    if (P.mission !== 'man') return;
    const keep = pool.find(d => d.mission && d.mission.type === 'man' && d.mission.k === k && atk.includes(d.match));
    const a = keep ? keep.match : nearest(atk, spots[k][0], spots[k][1]); if (!a) return;
    atk.splice(atk.indexOf(a), 1);
    const d = take(keep || nearest(pool, a.x, a.y)); d.mission = { type: 'man', k, P }; d.match = a; d.zslot = k + 1;
  });
  D.postes.forEach((P, k) => {
    if (P.mission === 'man' || !pool.length) return;
    const d = take(nearest(pool, spots[k][0], spots[k][1])); d.mission = { type: 'zone', k, P }; d.match = null; d.zslot = k + 1;
  });
  for (const d of pool) { d.mission = { type: 'zone', k: 0, P: D.postes[0] }; d.match = null; d.zslot = 1; }   // (moins de 5 joueurs)
}
// places des postes en zone (0 = la mark), selon leur comportement
function mixSlots(D, defT, ax, ay, dir, closed) {
  const open = -closed, [mx, my] = markSpot(defT, ax, ay), atk = TEAMS[1 - defT].filter(a => a !== disc.holder);
  const w = sysWorld(D.postes.map(q => q.pos), ax, ay, dir, open), s = [{ x: mx, y: my }];
  D.postes.forEach((P, k) => {
    let [x, y] = w[k];
    if (P.behave === 'shift') { const [a, d] = nearestD(atk, x, y); if (a && d < 7) { x += (a.x - x) * 0.3; y += (a.y - y) * 0.3; } }
    else if (P.behave === 'deep') {                          // suit l'attaquant le plus profond de son côté du terrain
      let deepA = null, dd = -1e9;
      for (const a of atk) { if ((a.y - H / 2) * (y - H / 2) < -20) continue; const dep = dir * (a.x - ax); if (dep > dd) { dd = dep; deepA = a; } }
      if (deepA) { x = ax + dir * Math.max(dir * (x - ax), dd + 3); y = y * 0.4 + deepA.y * 0.6; }
    } else if (P.behave === 'press') { const k2 = 0.45; x += (ax - x) * k2; y += (ay - y) * k2; }   // se rapproche du porteur (hors du cercle)
    s[k + 1] = { x, y };
  });
  return keepOutOfCircle(s, ax, ay, defT);
}
const MAN_GAP = { serre: 0.8, lache: 3 };
// individuelle perso : côté où il se place (entre lui et le disque, côté profondeur, open ou break) et distance
function mixManSpot(P, px, py, ax, ay, dir, open) {
  if (P.side === 'auto' && P.gap === 'normal') return manSpot(px, py, ax, ay, dir, open);
  let ux, uy;
  if (P.side === 'deep') { ux = dir; uy = 0; }
  else if (P.side === 'open') { ux = dir * 0.3; uy = open; }
  else if (P.side === 'break') { ux = dir * 0.3; uy = -open; }
  else { ux = ax - px; uy = ay - py; }
  const l = Math.hypot(ux, uy) || 1, c = MAN_GAP[P.gap] || clamp(dist(px, py, ax, ay) * 0.12, 1.1, 2) + (P.side === 'deep' ? 1.5 : 0);
  return [px + ux / l * c, py + uy / l * c];
}

// =====================================================================
//  Lecture collective (3 fois par seconde) : changements, aide, passe probable
// =====================================================================
// readK = qualité de la lecture collective : la même idée à tous les niveaux (changements, aide, ligne de passe),
// juste un peu plus fiable chez les meilleurs (facile 0,47, normal 0,55 … légende 0,8)
const readK = t => clamp(0.25 + aiLvl(t).anticip, 0, 1);
function defenseBrain(defT, dt) {
  G.dbT = (G.dbT || 0) - dt;
  if (G.dbT > 0) return;
  G.dbT = 0.33;
  const B = G.dB = { team: defT, help: null, read: null };
  const h = disc.holder, k = readK(defT);
  if (disc.mode !== 'held' || !h || h.team === defT || k <= 0) return;
  const dfn = TEAMS[defT].filter(d => !userControls(d)), atk = TEAMS[1 - defT].filter(a => a !== h), form = defFormOf(defT), man = form === 'man';
  const mix = form === 'mix', P = d => (mix && d.mission && d.mission.P) || null;
  // défense perso : double team dès le stall choisi, par le défenseur le plus proche qui a le droit d'aider
  const D = mix && dsysOf(defT), dbl = D ? +D.mark.double : 0;
  if (dbl && G.stall >= dbl) B.double = nearest(dfn.filter(d => d.mission && d.mission.type !== 'mark' && !(P(d) && P(d).help === 'non')), h.x, h.y);
  const dir = dirOf(1 - defT);
  // 1) changement : deux défenseurs qui se croisent échangent leurs attaquants si c'est nettement plus court
  const canSwap = d => !mix || (d.mission && d.mission.type === 'man' && d.mission.P.swap === 'oui');
  //    (une bonne lecture voit l'échange plus tôt : il suffit qu'il fasse gagner moins de terrain)
  if (man || mix) {
    for (const d1 of dfn) for (const d2 of dfn) {
      if (d1 === d2 || !d1.match || !d2.match || d1.match === h || d2.match === h || !canSwap(d1) || !canSwap(d2) || dist(d1.x, d1.y, d2.x, d2.y) > 6) continue;
      const now = dist(d1.x, d1.y, d1.match.x, d1.match.y) + dist(d2.x, d2.y, d2.match.x, d2.match.y);
      const sw = dist(d1.x, d1.y, d2.match.x, d2.match.y) + dist(d2.x, d2.y, d1.match.x, d1.match.y);
      // la profondeur d'abord : après l'échange, le plus profond des deux attaquants ne doit pas se retrouver plus « dans le dos »
      const deepA = dir * (d1.match.x - d2.match.x) > 0 ? d1.match : d2.match, behind = (d, a) => Math.max(0, dir * (a.x - d.x));
      const behindNow = behind(deepA === d1.match ? d1 : d2, deepA), behindSw = behind(deepA === d1.match ? d2 : d1, deepA);
      if (sw < now - (4 + (1 - k) * 4) && behindSw <= behindNow + 0.5) { const a = d1.match; d1.match = d2.match; d2.match = a; }
    }
  }
  // 2) passe probable : l'attaquant le plus dangereux (ligne de passe ouverte, terrain gagné, défenseur loin)
  let best = null, bv = -1e9;
  for (const a of atk) {
    const tx = a.state === 'cut' || a.state === 'jab' ? a.cx : a.x, ty = a.state === 'cut' || a.state === 'jab' ? a.cy : a.y;
    const lane = clamp(laneSlack(h, tx, ty, tx, ty, 0, TEAMS[defT]), -1, 0.6), gain = dir * (tx - h.x);
    const g = (man || mix) && TEAMS[defT].find(d => d.match === a) || nearest(TEAMS[defT], a.x, a.y);
    const sep = g ? dist(g.x, g.y, a.x, a.y) : 9;
    const v = lane * 4 + gain * 0.12 + sep * 0.5;
    if (v > bv) { bv = v; best = { a, x: tx, y: ty, sep, lane }; }
  }
  if (!best) return;
  B.read = best;
  // 3) aide : si cet attaquant est vraiment libre, le défenseur le mieux placé (et dont le joueur est moins dangereux) ferme la ligne
  //    (consigne d'équipe : jamais · parfois = attaquant vraiment libre · toujours = dès qu'il se démarque un peu)
  const help = ORDERS.help[(cfg(defT) || {}).help] ?? 1;
  const threat = dir * (best.x - h.x);                                   // terrain que cette passe ferait gagner
  if (help && threat > 3 && (help === 2 ? best.sep > 3 && best.lane > -0.15 : best.sep > 4 && best.lane > 0)) {
    const px = h.x + (best.x - h.x) * 0.65, py = h.y + (best.y - h.y) * 0.65;
    let hb = null, hv = 1e9;
    for (const d of dfn) {
      if (d === G.marker || d === B.double || ((man || mix) && (d.match === best.a || d.match === h)) || (P(d) && P(d).help === 'non')) continue;
      const own = (man || mix) && d.match ? dir * (d.match.x - h.x) : 0;   // son propre joueur : derrière le disque = peu dangereux
      if (own > threat + 4) continue;                                    // la profondeur d'abord : on ne lâche pas un joueur plus profond pour aider devant
      const v = dist(d.x, d.y, px, py) + clamp(own, -10, 25) * 0.3;
      if (v < hv) { hv = v; hb = d; }
    }
    if (hb && hv < (help === 2 ? 18 : 14)) B.help = { d: hb, x: px, y: py, w: (help === 2 ? 0.6 : 0.45) + 0.5 * k };
  }
}

// Où un défenseur peut-il couper la trajectoire avant le disque ? (lecture du jeu commune, predict.js)
const bestIntercept = firstTouch;

// ---------- gestes de base, communs à l'individuelle, à la zone et à la défense perso ----------
// double team : juste hors du cercle de stall, côté open (un 2e défenseur dans le cercle serait sanctionné)
function doubleSpot(dir, open) { const k = (STALL_R + 0.7) / Math.hypot(0.6, 1); return [disc.x + dir * 0.6 * k, disc.y + open * k]; }
// aide : il quitte un peu son joueur pour fermer la ligne vers l'attaquant libre (B = lecture collective)
function helpSpot(d, B, dir, lean, k) {
  const a = d.match && seen(d, d.match), ant = aiLvl(d.team).anticip;   // son joueur, là où il le croit (vision.js)
  const ox = a ? a.x + a.vx * ant + dir * 0.4 : d.tx, oy = a ? a.y + a.vy * ant + lean : d.ty, w = B.help.w * (k || 1);
  return [ox + (B.help.x - ox) * w, oy + (B.help.y - oy) * w];
}
// passe probable vers son joueur : il se glisse dans la ligne de passe (individuelle) / vers le receveur (zone)
function lineShift(d, R, k) {
  if (disc.holder) { const lx = disc.holder.x - d.tx, ly = disc.holder.y - d.ty, l = Math.hypot(lx, ly) || 1; d.tx += lx / l * 1.4 * k; d.ty += ly / l * 1.4 * k; }
}
function zoneShift(d, R, k) { d.tx += (R.x - d.tx) * k; d.ty += (R.y - d.ty) * k; }
const brainOf = d => (G.dB && G.dB.team === d.team ? G.dB : null);

function defenderAI(d, ax, ay, dir, closed, form, slots) {
  const open = -closed;
  const lean = forceOf(d.team) === 'straight' ? 0 : open;     // straight up : la mark ne ferme aucun côté, personne ne penche d'un côté
  d.sp = SPD.def;
  if (disc.mode === 'air' && !disc.pull) {
    const bi = bestIntercept(d);
    if (bi) {
      d.tx = bi.x; d.ty = bi.y; d.sp = SPD.sprint; d.react = 0.1;
      if (!d.diveTried && bi.tA < 0.32 && bi.r > ARM_R + 0.3 && bi.r < diveReach(Math.hypot(d.vx, d.vy))) { d.diveTried = true; diveTo(d, bi.x, bi.y); }   // trop loin pour les bras : layout
      return;
    }
    if ((form === 'man' || (form === 'mix' && d.mission && d.mission.type === 'man')) && d.match === disc.intended) { [d.tx, d.ty] = seenEnd(d); d.sp = SPD.sprint; return; }
  }
  const DP = G.dplay;
  if (DP && DP.d === d && DP.team === d.team) {
    if (DP.type === 'safety') {
      const s = slots[1];
      d.tx = s.x; d.ty = clamp(s.y + (form !== 'man' ? (s.y > H / 2 ? -7 : 7) : 0), 1, H - 1); return;
    }
    if (DP.type === 'double' && disc.mode === 'held') {            // juste hors du cercle, côté open
      const [x, y] = doubleSpot(dir, open); d.tx = clamp(x, 0.5, W - 0.5); d.ty = clamp(y, 0.5, H - 0.5); d.react = 0.1; return;
    }
  }
  if (form === 'mix') mixDefender(d, ax, ay, dir, open, slots);
  else if (form === 'man') {
    const a = d.match;
    if (!a) { d.tx = d.x; d.ty = d.y; return; }
    const marking = ((disc.mode === 'held' || disc.mode === 'carry') && disc.holder === a) || (disc.mode === 'ground' && G.pickup === a);
    if (marking) {                                          // marquage : côté fermé (ou devant en straight up)
      [d.tx, d.ty] = markSpot(d.team, disc.x, disc.y); d.react = 0.08;
    } else if (brainOf(d) && brainOf(d).help && brainOf(d).help.d === d) {   // aide : il ferme la ligne vers l'attaquant libre
      [d.tx, d.ty] = helpSpot(d, brainOf(d), dir, lean); d.react = Math.min(d.react, 0.1);
    } else {                                                // on anticipe la course et on se place entre lui et l'espace qu'il veut
      const ant = aiLvl(d.team).anticip, ag = seen(d, a), px = ag.x + ag.vx * ant, py = ag.y + ag.vy * ant;   // là où il le croit (vision.js)
      [d.tx, d.ty] = manSpot(px, py, ax, ay, dir, lean);
      const R = brainOf(d) && brainOf(d).read;
      if (R && R.a === a) { lineShift(d, R, readK(d.team)); d.react = Math.min(d.react, 0.12); }   // c'est lui que le porteur regarde
    }
  } else {
    const s = slots[d.zslot]; d.tx = s.x; d.ty = s.y;
    if (d.zslot === 0) d.react = 0.08;
    const R = brainOf(d) && brainOf(d).read;               // zone : le plus proche de la passe probable se décale vers elle
    if (R && d.zslot !== 0 && nearest(TEAMS[d.team].filter(q => q.zslot !== 0), R.x, R.y) === d) zoneShift(d, R, readK(d.team) * 0.35);
  }
  avoidDoubleTeam(d, form);
  d.tx = clamp(d.tx, 0.5, W - 0.5); d.ty = clamp(d.ty, 0.5, H - 0.5);
}

// défense perso : la mission du défenseur (mark, individuelle, zone), la double team et l'aide
function mixDefender(d, ax, ay, dir, open, slots) {
  const M = d.mission || { type: 'zone', P: null }, B = brainOf(d);
  if (B && B.double === d && disc.mode === 'held') { [d.tx, d.ty] = doubleSpot(dir, open); d.react = 0.1; return; }   // double team
  if (M.type === 'mark') { [d.tx, d.ty] = markSpot(d.team, disc.x, disc.y); d.react = 0.08; return; }
  if (M.type === 'man' && d.match) {
    const a = d.match, ant = aiLvl(d.team).anticip;
    if (B && B.help && B.help.d === d) { [d.tx, d.ty] = helpSpot(d, B, dir, 0); d.react = Math.min(d.react, 0.1); return; }   // aide
    if (M.P.gap === 'serre') d.react = Math.min(d.react, 0.1);
    const ag = seen(d, a);                                   // là où il le croit (vision.js)
    [d.tx, d.ty] = mixManSpot(M.P, ag.x + ag.vx * ant, ag.y + ag.vy * ant, ax, ay, dir, M.P.side === 'auto' && forceOf(d.team) === 'straight' ? 0 : open);
    const R = B && B.read;
    if (R && R.a === a && M.P.side === 'auto') lineShift(d, R, readK(d.team));   // c'est lui que le porteur regarde
    return;
  }
  const s = slots[d.zslot] || slots[1]; d.tx = s.x; d.ty = s.y;   // zone
  if (B && B.help && B.help.d === d) { const a = d.match; d.match = null; [d.tx, d.ty] = helpSpot(d, B, dir, 0, 0.6); d.match = a; return; }   // zone : aide depuis sa place
  const R = B && B.read;
  if (R && M.P && M.P.behave === 'shift' && nearest(TEAMS[d.team].filter(q => q.mission && q.mission.type === 'zone'), R.x, R.y) === d) zoneShift(d, R, readK(d.team) * 0.35);
}
// Placement en individuelle : toujours entre son joueur et le disque (sur la ligne de passe), à 1 à 2 m de lui,
// en anticipant sa course, un peu côté open ; s'il est très loin devant, un peu plus en retrait pour ne pas se faire passer dans le dos.
function manSpot(px, py, ax, ay, dir, open) {
  let ux = ax - px, uy = ay - py; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;   // vers le disque
  const depth = dir * (px - ax), deep = clamp((depth - 18) / 10, 0, 0.6);                // huck possible : il garde aussi le deep
  ux = ux * (1 - deep) + dir * deep; uy = uy * (1 - deep) + open * 0.25;
  const m = Math.hypot(ux, uy) || 1, c = clamp(l * 0.12, 1.1, 2);
  return [px + ux / m * c, py + uy / m * c];
}

// règle : un seul défenseur (la mark) dans le cercle du handler, sauf s'il garde un autre attaquant
function guardingOther(d, x, y) {
  const h = disc.holder;
  if (['man', 'mix'].includes(defFormOf(d.team)) && d.match && d.match !== h && dist(d.match.x, d.match.y, x, y) < 3.5) return true;
  return TEAMS[1 - d.team].some(a => a !== h && dist(a.x, a.y, x, y) < 2.2);
}
function avoidDoubleTeam(d, form) {
  if (disc.mode !== 'held' || !disc.holder) return;
  const h = disc.holder;
  const markerOk = G.marker && G.marker.team === d.team && dist(G.marker.x, G.marker.y, h.x, h.y) < STALL_R;
  const isMark = markerOk ? G.marker === d : (form === 'man' ? d.match === h : form === 'mix' ? !!d.mission && d.mission.type === 'mark' : d.zslot === 0);
  if (G.dB && G.dB.double === d) return;                    // double team voulue (défense perso) : il reste juste hors du cercle
  if (isMark) return;
  const lim = STALL_R + 0.8, dc = dist(d.x, d.y, h.x, h.y);
  if (dc < STALL_R && !guardingOther(d, d.x, d.y)) {        // déjà dans le cercle : il en sort par le chemin le plus court
    const ux = dc > 0.01 ? (d.x - h.x) / dc : dirOf(d.team === 0 ? 1 : 0), uy = dc > 0.01 ? (d.y - h.y) / dc : 0;
    d.tx = clamp(h.x + ux * lim, 0.5, W - 0.5); d.ty = clamp(h.y + uy * lim, 0.5, H - 0.5); d.sp = SPD.sprint; d.react = 0.1;
    return;
  }
  const dd = dist(d.tx, d.ty, h.x, h.y);
  if (dd >= lim || guardingOther(d, d.tx, d.ty)) return;
  const ux = dd > 0.01 ? (d.tx - h.x) / dd : dirOf(h.team), uy = dd > 0.01 ? (d.ty - h.y) / dd : 0;
  d.tx = clamp(h.x + ux * lim, 0.5, W - 0.5); d.ty = clamp(h.y + uy * lim, 0.5, H - 0.5);
}
function diveTo(p, x, y) {
  if (p.dive > 0 || p.down > 0 || p.jump > 0 || p.jprep > 0) return;
  [p.vx, p.vy] = diveVel(p, x, y);
  p.dive = DIVE_T; G.stats.dives++;
  fxEvent('layout', p.x, p.y, p.team);
}

