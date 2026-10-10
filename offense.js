// offense.js — IA offensive : rôles (handler, dump, cutters), stack, cuts

// =====================================================================
//  Rôles offensifs : porteur, « dump » (relais) et coupeurs ordonnés
// =====================================================================
function dumpSlot(ax, ay, dir, open) {
  return { x: clamp(ax - dir * 4, 1, W - 1), y: clamp(ay - open * 5, 2, H - 2) };
}
function stackY(ay) { return clamp(H / 2 + (ay - H / 2) * 0.3, 9, H - 9); }
// ligne du stack : au centre (vertical) ou le long de la ligne côté break (side stack)
const isColumn = form => form === 'vert' || form === 'side';
function lineY(t, ay, form) {
  if (form !== 'side') return stackY(ay);
  const open = -closedOf(1 - t);
  return clamp(H / 2 - open * 11, 5, H - 5);
}

function assignRoles(t, h) {
  const dir = dirOf(t), open = -closedOf(1 - t);
  const others = TEAMS[t].filter(p => p !== h);
  const ds = dumpSlot(h.x, h.y, dir, open);
  const dump = nearest(others, ds.x, ds.y);
  const cutters = others.filter(p => p !== dump);
  if (isColumn(formOf(t))) cutters.sort((a, b) => dir * (a.x - b.x));
  else cutters.sort((a, b) => a.y - b.y);
  G.order[t] = cutters;
  cutters.forEach(p => { p.role = 'cutter'; p.state = 'stack'; p.timer = 0; });
  dump.role = 'dump'; dump.state = 'set'; dump.timer = rand(1, 2);
  h.role = 'holder';
  G.cutT = rand(0.3, 0.8);
}

function cutterSlot(p, t, ax, ay, dir, form) {
  const ord = G.order[t], n = Math.max(1, ord.length);
  let idx = ord.indexOf(p); if (idx < 0) idx = n - 1;
  const avail = depthLeft(ax, dir);
  if (isColumn(form)) {
    const start = Math.min(9, Math.max(3, avail * 0.3));
    const sp = clamp((avail - start) / Math.max(1, n - 0.5), 1.6, 4.5);
    return { x: clamp(ax + dir * (start + sp * idx), 1.5, W - 1.5), y: lineY(t, ay, form) };
  }
  const lanes = n >= 3 ? [6, H / 2, H - 6] : n === 2 ? [10, H - 10] : [H / 2];
  const depth = Math.min(14, Math.max(4, avail * 0.55));
  return { x: clamp(ax + dir * depth, 1.5, W - 1.5), y: lanes[Math.min(idx, lanes.length - 1)] };
}

// un joueur resté loin derrière le jeu remonte en courant au lieu de trottiner
function hustle(p, base) {
  return dist(p.x, p.y, p.tx, p.ty) > 7 ? Math.max(base, SPD.cut * 0.92) : base;
}

// Juste après une réception, un cutter propose aussitôt la passe suivante (continuation),
// de préférence celui qui est déjà lancé vers l'avant côté open.
function continuationCut(t, h) {
  if (G.oplay && G.oplay.team === t) return;
  const dir = dirOf(t), open = -closedOf(1 - t);
  const room = depthLeft(h.x, dir);
  if (room < 4) return;
  const tx = h.x + dir * Math.min(rand(8, 13), room - 1), ty = clamp(h.y + open * rand(3, 8), 2, H - 2);
  let best = null, bv = 1e9;
  for (const c of G.order[t]) {
    const ahead = dir * (c.x - h.x);                          // déjà devant le disque = bien placé
    const v = dist(c.x, c.y, tx, ty) - Math.max(0, Math.min(ahead, 12)) * 0.5 + Math.max(0, -dir * (c.vx || 0)) * 0.6;
    if (v < bv) { bv = v; best = c; }
  }
  if (!best) return;
  best.cx = tx; best.cy = ty; clampPt(best);
  best.wx = best.x; best.wy = best.y;
  best.role = 'cutter'; best.state = 'cut'; best.timer = 2.2;      // pas de feinte : il est déjà en mouvement
  G.cutT = rand(0.8, 1.3);
}
function clampPt(o) { o.cx = clamp(o.cx, 1.5, W - 1.5); o.cy = clamp(o.cy, 1.5, H - 1.5); }

// Un seul coupeur à la fois : c'est ce qui rend la structure lisible
function runCutSequencer(t, ax, ay, dir, open, form, dt) {
  if (disc.mode !== 'held') return;
  if (G.oplay && G.oplay.team === t) return;                // le play dirige les courses
  G.cutT -= dt;
  const ord = G.order[t];
  if (G.cutT > 0 || ord.some(p => p.state === 'jab' || p.state === 'cut')) return;
  const ready = ord.filter(p => p.state === 'stack' && dist(p.x, p.y, p.tx, p.ty) < 4);
  if (!ready.length) return;
  const room = depthLeft(ax, dir);
  const deep = room > 20 && Math.random() < clamp(0.45 + (aiStyle(t).huck - 1) * 0.18, 0.3, 0.65);   // deep cuts (plus encore chez les Faucons)
  let c, sy = lineY(t, ay, form);
  if (isColumn(form)) {
    c = deep ? ready[0] : ready[ready.length - 1];          // l'avant part en profondeur, l'arrière coupe vers le disque
    const side = form === 'side' ? 1.6 : 1;                   // side stack : les cuts traversent tout l'open side
    if (deep) { c.cx = ax + dir * rand(22, 30); c.cy = sy + open * rand(2, 7) * side; }
    else { c.cx = ax + dir * rand(5, 9); c.cy = sy + open * rand(8, 12) * side; }
  } else {
    const byOpen = ready.slice().sort((a, b) => open * (b.y - a.y));
    c = deep ? byOpen[Math.floor(Math.random() * byOpen.length)] : byOpen[0];
    if (deep) { c.cx = ax + dir * rand(24, 32); c.cy = c.y; }
    else { c.cx = ax + dir * rand(4, 7); c.cy = c.y * 0.5 + ay * 0.5 + open * 2; }
  }
  clampPt(c);
  // feinte : un pas dans la direction opposée avant de couper
  c.wx = c.x + dir * (deep ? -2 : 2); c.wy = c.y + (deep ? open : -open) * 1.2;
  c.state = 'jab'; c.timer = 0.35;
  G.cutT = rand(0.9, 1.5);                                   // cuts plus rapprochés : le stall count va vite
}

// Un attaquant laissé seul (son défenseur est parti ailleurs) file dans l'espace libre,
// de préférence côté open et vers l'avant : laisser son joueur doit coûter cher.
const FREE_R = 6;
function isAbandoned(p, t) {
  if (defFormOf(1 - t) !== 'man' || p === disc.holder) return false;
  const dfn = TEAMS[1 - t], g = dfn.find(d => d.match === p);
  return (!g || dist(g.x, g.y, p.x, p.y) > FREE_R + 2) && nearestD(dfn, p.x, p.y)[1] > 5;
}
function freeSpace(p, t, ax, ay, dir, open) {
  const dfn = TEAMS[1 - t];
  let best = null, bv = -1e9;
  for (const k of [10, 14, 18, 23, 28]) {
    const x = ax + dir * k;
    if (x < 1 || x > W - 1) continue;
    for (const y of [4, 10, 16, 21, 27, 33]) {
      const room = Math.min(12, nearestD(dfn, x, y)[1]);
      // il se place là où le handler peut lui lancer (ligne de passe dégagée)
      const lane = disc.holder ? clamp(laneSlack(disc.holder, x, y, x, y, 0, dfn), -1, 0.6) : 0;
      const v = room * 1.1 + lane * 6 + k * 0.18 + (open * (y - ay) > 0 ? 1.5 : 0) - dist(p.x, p.y, x, y) * 0.22;
      if (v > bv) { bv = v; best = [x, y]; }
    }
  }
  return best;
}
function attackerAI(p, t, ax, ay, dir, open, form, dt) {
  p.timer -= dt;
  // attaquant lâché par son défenseur : il coupe tout de suite vers un espace libre où le handler peut le servir
  p.freeAcc = isAbandoned(p, t) ? (p.freeAcc || 0) + dt : 0;   // lâché depuis un moment (pas juste un décalage)
  p.free = p.freeAcc > 0.7;
  if (p.free && disc.mode === 'held' && disc.holder && disc.holder.team === t && p.role === 'cutter'
      && p.state !== 'jab' && p.state !== 'cut' && (p.freeT = (p.freeT || 0) - dt) <= 0) {
    const sp = freeSpace(p, t, ax, ay, dir, open);
    if (sp) { startCut(p, sp[0], sp[1], dir * (sp[0] - p.x) > 12); p.state = 'cut'; p.timer = 1.8; }
    p.freeT = 0.8;
  }
  if (p.role === 'holder') {                                // ancien porteur : il suit le jeu derrière
    const s = dumpSlot(ax, ay, dir, open);
    p.tx = s.x - dir * 2; p.ty = clamp(s.y + open * 7, 2, H - 2); p.sp = hustle(p, SPD.jog); return;
  }
  if (p.role === 'dump') {
    const s = dumpSlot(ax, ay, dir, open);
    if (p.state === 'set') {
      p.tx = s.x; p.ty = s.y; p.sp = SPD.jog + 1;
      if (disc.mode === 'held' && G.stall > 4.5 && p.timer <= 0) {   // compte élevé : le relais vient chercher le disque
        p.state = 'reset'; p.timer = 1.8;
        if (Math.random() < 0.5) { p.cx = ax - dir * 2; p.cy = ay + open * 5; }
        else { p.cx = ax + dir * 4; p.cy = ay - open * 5; }
        clampPt(p);
      }
    } else {
      p.tx = p.cx; p.ty = p.cy; p.sp = SPD.cut;
      if (p.timer <= 0) { p.state = 'set'; p.timer = 2.5; }
    }
    return;
  }
  const slot = cutterSlot(p, t, ax, ay, dir, form);
  switch (p.state) {
    case 'stack': p.tx = slot.x; p.ty = slot.y; p.sp = hustle(p, SPD.jog); break;
    case 'park': p.tx = p.cx; p.ty = p.cy; p.sp = SPD.jog + 1; break;
    case 'jab':
      p.tx = p.wx; p.ty = p.wy; p.sp = SPD.cut * 0.8;
      if (p.timer <= 0) { p.state = 'cut'; p.timer = 2.4; }
      break;
    case 'cut':
      p.tx = p.cx; p.ty = p.cy; p.sp = p.tag === '★' ? 8.4 : SPD.cut;      // le coupeur du huck a un départ lancé
      if (p.timer <= 0 || dist(p.x, p.y, p.cx, p.cy) < 0.8) { p.state = 'hold'; p.timer = 0.7; G.cutT = Math.min(G.cutT, rand(0.2, 0.7)); }
      break;
    case 'hold':
      p.tx = p.cx; p.ty = p.cy; p.sp = 1.5;
      if (p.timer <= 0) {
        p.state = 'clear'; p.timer = 4;
        if (isColumn(form)) {                                // dégage côté fermé puis retourne au bout de la colonne
          const ord = G.order[t], i = ord.indexOf(p);
          if (i >= 0) { ord.splice(i, 1); ord.push(p); }
          p.wx = p.x + dir * 2; p.wy = clamp(lineY(t, ay, form) - open * (form === 'side' ? 2 : 5), 2, H - 2); p.wDone = false;
        } else p.wDone = true;
      }
      break;
    case 'clear':
      p.sp = hustle(p, SPD.jog + 1.5);
      if (!p.wDone) { p.tx = p.wx; p.ty = p.wy; if (dist(p.x, p.y, p.wx, p.wy) < 1.5) p.wDone = true; }
      else { p.tx = slot.x; p.ty = slot.y; if (dist(p.x, p.y, slot.x, slot.y) < 1.5) p.state = 'stack'; }
      if (p.timer <= 0) p.state = 'stack';
      break;
  }
  p.tx = clamp(p.tx, 1, W - 1); p.ty = clamp(p.ty, 1.5, H - 1.5);
}

