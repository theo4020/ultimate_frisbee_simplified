// defense.js — IA défensive : man, zone (cup), interceptions, layout, double team

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

// Où un défenseur peut-il couper la trajectoire avant le disque ?
function bestIntercept(d) {
  const u0 = disc.t / disc.dur, peak = peakOf(disc.dur);
  for (let u = u0 + 0.03; u <= 1.001; u += 0.04) {
    const [x, y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u);
    if (Math.sin(Math.PI * u) * peak > 1.9) continue;
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
      d.tx = s.x; d.ty = clamp(s.y + (form === 'zone' ? (s.y > H / 2 ? -7 : 7) : 0), 1, H - 1); return;
    }
    if (DP.type === 'double' && disc.mode === 'held') {            // juste hors du cercle, côté open
      const k = (STALL_R + 0.7) / Math.hypot(0.6, 1);
      d.tx = clamp(disc.x + dir * 0.6 * k, 0.5, W - 0.5); d.ty = clamp(disc.y + open * k, 0.5, H - 0.5); d.react = 0.1; return;
    }
  }
  if (form === 'man') {
    const a = d.match;
    if (!a) { d.tx = d.x; d.ty = d.y; return; }
    const marking = (disc.mode === 'held' && disc.holder === a) || (disc.mode === 'ground' && G.pickup === a);
    if (marking) {                                          // marquage : on se place côté fermé
      d.tx = disc.x + dir * 1.0; d.ty = disc.y + closed * 1.3; d.react = 0.08;
    } else {                                                // on anticipe la course et on protège le côté ouvert
      const px = a.x + a.vx * 0.15, py = a.y + a.vy * 0.15;
      const depth = dir * (a.x - ax);
      d.tx = px + dir * (depth > 17 ? 1.8 : 0.4);
      d.ty = py + open * 1.0;
    }
  } else {
    const s = slots[d.zslot]; d.tx = s.x; d.ty = s.y;
    if (d.zslot === 0) d.react = 0.08;
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
  if (p.dive > 0 || p.down > 0) return;
  let dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy);
  if (l < 0.3) { dx = p.vx; dy = p.vy; l = Math.hypot(dx, dy); }
  if (l < 0.01) { dx = 1; dy = 0; l = 1; }
  p.vx = dx / l * SPD.dive; p.vy = dy / l * SPD.dive;
  p.dive = DIVE_T; G.stats.dives++;
  fxEvent('layout', p.x, p.y, p.team);
}

