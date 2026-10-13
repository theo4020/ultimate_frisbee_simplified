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

function zoneSlots(defT, ax, ay, dir, closed) {
  const D = dsysOf(defT); if (D && D.mode === 'zone' && defFormOf(defT) === 'zone') return sysZoneSlots(D, defT, ax, ay, dir, closed);
  if (defFormOf(defT) === 'clam') return clamSlots(defT, ax, ay, dir, closed);
  const open = -closed, atk = TEAMS[1 - defT], s = [];
  s[0] = { x: ax + dir * 1.0, y: ay + closed * 1.3 };                       // marqueur
  let deepA = null, dd = -1e9;
  for (const a of atk) { const dep = dir * (a.x - ax); if (dep > dd) { dd = dep; deepA = a; } }
  const deepDepth = Math.max(20, dd + 3);
  s[1] = { x: ax + dir * deepDepth, y: H / 2 * 0.4 + (deepA ? deepA.y : H / 2) * 0.6 };   // arrière
  s[2] = { x: ax + dir * 4, y: ay + open * 4.5 };                          // cup côté ouvert
  s[3] = { x: ax + dir * 4, y: ay - open * 3.5 };                          // cup côté fermé
  for (const k of [2, 3]) {                                                 // le cup se décale vers la passe courte la plus proche
    const side = k === 2 ? open : -open;
    let tgt = null, bd = 13;
    for (const a of atk) {
      if (a === disc.holder) continue;
      const dep = dir * (a.x - ax), lat = (a.y - ay) * side;
      const dd = Math.hypot(dep, a.y - ay);
      if (dep > -3 && lat > -1 && dd < bd) { bd = dd; tgt = a; }
    }
    if (tgt) { s[k].x = ax + (tgt.x - ax) * 0.45; s[k].y = ay + (tgt.y - ay) * 0.45; }
  }
  let midA = null, best = 1e9;                                              // milieu : l'attaquant le plus dangereux au centre
  for (const a of atk) {
    if (a === disc.holder) continue;
    const dep = dir * (a.x - ax);
    if (dep > 6 && dep < 21) { const sc = Math.abs(a.y - H / 2) + Math.abs(dep - 12) * 0.5; if (sc < best) { best = sc; midA = a; } }
  }
  s[4] = midA ? { x: midA.x - dir * 1, y: midA.y * 0.7 + ay * 0.3 } : { x: ax + dir * 12, y: H / 2 * 0.5 + ay * 0.5 };
  return keepOutOfCircle(s, ax, ay);
}
// Clam : la mark, deux « pinces » devant le disque (under cuts côté open et au centre), deux deep qui se partagent la largeur
function clamSlots(defT, ax, ay, dir, closed) {
  const open = -closed, atk = TEAMS[1 - defT].filter(a => a !== disc.holder), s = [];
  const [mx, my] = markSpot(defT, ax, ay);
  s[0] = { x: mx, y: my };
  const near = (x, y, r) => { const [a, d] = nearestD(atk, x, y); return a && d < r ? a : null; };
  const pinch = (x, y) => { const a = near(x, y, 7); return a ? { x: (x + a.x) / 2 + dir * 0.6, y: (y + a.y) / 2 } : { x, y }; };
  s[2] = pinch(ax + dir * 8, ay + open * 6);                                // pince côté open
  s[3] = pinch(ax + dir * 10, ay * 0.4 + H / 2 * 0.6 - open * 1.5);         // pince centrale
  let dd = 18;
  for (const a of atk) dd = Math.max(dd, dir * (a.x - ax) + 2.5);
  const deepY = side => { let best = side < 0 ? H * 0.28 : H * 0.72;        // chaque deep suit l'attaquant le plus profond de sa moitié
    let bd = -1e9; for (const a of atk) { if ((a.y - H / 2) * side < 0) continue; const dep = dir * (a.x - ax); if (dep > bd) { bd = dep; best = a.y * 0.6 + best * 0.4; } }
    return best; };
  s[1] = { x: ax + dir * dd, y: deepY(-1) };
  s[4] = { x: ax + dir * dd, y: deepY(1) };
  return keepOutOfCircle(s, ax, ay);
}
function keepOutOfCircle(s, ax, ay) {
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
  if (defFormOf(defT) === 'man') assignMan(defT, h); else assignZone(defT, h.x, h.y);
}

// =====================================================================
//  Lecture collective (3 fois par seconde) : changements, aide, passe probable
// =====================================================================
// readK = qualité de lecture selon le niveau (facile 0 : chacun pour soi … légende 1 : défense très collective)
const readK = t => clamp((aiLvl(t).anticip - 0.1) / 0.45, 0, 1);
function defenseBrain(defT, dt) {
  G.dbT = (G.dbT || 0) - dt;
  if (G.dbT > 0) return;
  G.dbT = 0.33;
  const B = G.dB = { team: defT, help: null, read: null };
  const h = disc.holder, k = readK(defT);
  if (disc.mode !== 'held' || !h || h.team === defT || k <= 0) return;
  const dfn = TEAMS[defT].filter(d => !userControls(d)), atk = TEAMS[1 - defT].filter(a => a !== h), man = defFormOf(defT) === 'man';
  const dir = dirOf(1 - defT);
  // 1) changement : deux défenseurs qui se croisent échangent leurs attaquants si c'est nettement plus court
  if (man && Math.random() < k) {
    for (const d1 of dfn) for (const d2 of dfn) {
      if (d1 === d2 || !d1.match || !d2.match || d1.match === h || d2.match === h || dist(d1.x, d1.y, d2.x, d2.y) > 6) continue;
      const now = dist(d1.x, d1.y, d1.match.x, d1.match.y) + dist(d2.x, d2.y, d2.match.x, d2.match.y);
      const sw = dist(d1.x, d1.y, d2.match.x, d2.match.y) + dist(d2.x, d2.y, d1.match.x, d1.match.y);
      if (sw < now - 5) { const a = d1.match; d1.match = d2.match; d2.match = a; }
    }
  }
  // 2) passe probable : l'attaquant le plus dangereux (ligne de passe ouverte, terrain gagné, défenseur loin)
  let best = null, bv = -1e9;
  for (const a of atk) {
    const tx = a.state === 'cut' || a.state === 'jab' ? a.cx : a.x, ty = a.state === 'cut' || a.state === 'jab' ? a.cy : a.y;
    const lane = clamp(laneSlack(h, tx, ty, tx, ty, 0, TEAMS[defT]), -1, 0.6), gain = dir * (tx - h.x);
    const g = man ? TEAMS[defT].find(d => d.match === a) : nearest(TEAMS[defT], a.x, a.y);
    const sep = g ? dist(g.x, g.y, a.x, a.y) : 9;
    const v = lane * 4 + gain * 0.12 + sep * 0.5;
    if (v > bv) { bv = v; best = { a, x: tx, y: ty, sep, lane }; }
  }
  if (!best) return;
  B.read = best;
  // 3) aide : si cet attaquant est vraiment libre, le défenseur le mieux placé (et dont le joueur est moins dangereux) ferme la ligne
  if (best.sep > 4 && best.lane > 0) {
    const px = h.x + (best.x - h.x) * 0.65, py = h.y + (best.y - h.y) * 0.65;
    let hb = null, hv = 1e9;
    for (const d of dfn) {
      if (d === G.marker || (man && (d.match === best.a || d.match === h))) continue;
      const own = man && d.match ? dir * (d.match.x - h.x) : 0;          // son propre joueur : derrière le disque = peu dangereux
      const v = dist(d.x, d.y, px, py) + clamp(own, -10, 25) * 0.3;
      if (v < hv) { hv = v; hb = d; }
    }
    if (hb && hv < 14) B.help = { d: hb, x: px, y: py, w: 0.45 + 0.5 * k };
  }
}

// Où un défenseur peut-il couper la trajectoire avant le disque ?
function bestIntercept(d) {
  const u0 = disc.t / disc.dur, peak = discPeak();
  for (let u = u0 + 0.03; u <= 1.001; u += 0.04) {
    const [x, y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u);
    if (heightAt(u, peak, disc.kind) > 1.9) continue;
    const tA = (u - u0) * disc.dur;
    const r = dist(d.x, d.y, x, y);
    if (Math.max(0, r - 0.9) / SPD.sprint + 0.12 <= tA) return { x, y, tA, r };
  }
  return null;
}

function defenderAI(d, ax, ay, dir, closed, form, slots) {
  const open = -closed;
  d.sp = SPD.def;
  if (disc.mode === 'air' && !disc.pull) {
    const bi = bestIntercept(d);
    if (bi) {
      d.tx = bi.x; d.ty = bi.y; d.sp = SPD.sprint; d.react = 0.1;
      if (!d.diveTried && bi.tA < 0.32 && bi.r > 1 && bi.r < 2.8) { d.diveTried = true; if (Math.random() < 0.55) diveTo(d, bi.x, bi.y); }
      return;
    }
    if (form === 'man' && d.match === disc.intended) { d.tx = disc.ex; d.ty = disc.ey; d.sp = SPD.sprint; return; }
  }
  const DP = G.dplay;
  if (DP && DP.d === d && DP.team === d.team) {
    if (DP.type === 'safety') {
      const s = slots[1];
      d.tx = s.x; d.ty = clamp(s.y + (form !== 'man' ? (s.y > H / 2 ? -7 : 7) : 0), 1, H - 1); return;
    }
    if (DP.type === 'double' && disc.mode === 'held') {            // juste hors du cercle, côté open
      const k = (STALL_R + 0.7) / Math.hypot(0.6, 1);
      d.tx = clamp(disc.x + dir * 0.6 * k, 0.5, W - 0.5); d.ty = clamp(disc.y + open * k, 0.5, H - 0.5); d.react = 0.1; return;
    }
  }
  if (form === 'man') {
    const a = d.match; let sp = null;
    if (!a) { d.tx = d.x; d.ty = d.y; return; }
    const marking = ((disc.mode === 'held' || disc.mode === 'carry') && disc.holder === a) || (disc.mode === 'ground' && G.pickup === a);
    if (marking) {                                          // marquage : côté fermé (ou devant en straight up)
      [d.tx, d.ty] = markSpot(d.team, disc.x, disc.y); d.react = 0.08;
    } else if (G.dB && G.dB.team === d.team && G.dB.help && G.dB.help.d === d) {   // aide : il ferme la ligne vers l'attaquant libre
      const H_ = G.dB.help, ant = aiLvl(d.team).anticip;
      const ox = a.x + a.vx * ant + dir * 0.4, oy = a.y + a.vy * ant + open;
      d.tx = ox + (H_.x - ox) * H_.w; d.ty = oy + (H_.y - oy) * H_.w; d.react = Math.min(d.react, 0.1);
    } else if (dsysOf(d.team) && dsysOf(d.team).mode === 'man' && (sp = sysManSpot(dsysOf(d.team), d, a, ax, ay, dir, open))) {
      [d.tx, d.ty] = sp;                                    // rôle donné dans le système perso (serré, profond, double team)
    } else {                                                // on anticipe la course et on protège le côté ouvert
      const ant = aiLvl(d.team).anticip, px = a.x + a.vx * ant, py = a.y + a.vy * ant;
      const depth = dir * (a.x - ax);
      d.tx = px + dir * (depth > 17 ? 1.8 : 0.4);
      d.ty = py + open * 1.0;
      const R = G.dB && G.dB.team === d.team && G.dB.read;
      if (R && R.a === a && disc.holder) {                  // c'est lui que le porteur regarde : il se glisse dans la ligne de passe
        const k = readK(d.team), lx = disc.holder.x - d.tx, ly = disc.holder.y - d.ty, l = Math.hypot(lx, ly) || 1;
        d.tx += lx / l * 1.4 * k; d.ty += ly / l * 1.4 * k; d.react = Math.min(d.react, 0.12);
      }
    }
  } else {
    const s = slots[d.zslot]; d.tx = s.x; d.ty = s.y;
    if (d.zslot === 0) d.react = 0.08;
    const R = G.dB && G.dB.team === d.team && G.dB.read;   // zone : le plus proche de la passe probable se décale vers elle
    if (R && d.zslot !== 0 && nearest(TEAMS[d.team].filter(q => q.zslot !== 0), R.x, R.y) === d) {
      const k = readK(d.team) * 0.35; d.tx += (R.x - d.tx) * k; d.ty += (R.y - d.ty) * k;
    }
  }
  avoidDoubleTeam(d, form);
  d.tx = clamp(d.tx, 0.5, W - 0.5); d.ty = clamp(d.ty, 0.5, H - 0.5);
}

// règle : un seul défenseur (la mark) dans le cercle du handler, sauf s'il garde un autre attaquant
function guardingOther(d, x, y) {
  const h = disc.holder;
  if (defFormOf(d.team) === 'man' && d.match && d.match !== h && dist(d.match.x, d.match.y, x, y) < 3.5) return true;
  return TEAMS[1 - d.team].some(a => a !== h && dist(a.x, a.y, x, y) < 2.2);
}
function avoidDoubleTeam(d, form) {
  if (disc.mode !== 'held' || !disc.holder) return;
  const h = disc.holder;
  const markerOk = G.marker && G.marker.team === d.team && dist(G.marker.x, G.marker.y, h.x, h.y) < STALL_R;
  const isMark = markerOk ? G.marker === d : (form === 'man' ? d.match === h : d.zslot === 0);
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
  let dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy);
  if (l < 0.3) { dx = p.vx; dy = p.vy; l = Math.hypot(dx, dy); }
  if (l < 0.01) { dx = 1; dy = 0; l = 1; }
  p.vx = dx / l * SPD.dive; p.vy = dy / l * SPD.dive;
  p.dive = DIVE_T; G.stats.dives++;
  fxEvent('layout', p.x, p.y, p.team);
}

