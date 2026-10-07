// offense.js — IA offensive : rôles (handler, dump, cutters), stack, cuts

// =====================================================================
//  Rôles offensifs : porteur, « dump » (relais) et coupeurs ordonnés
// =====================================================================
function dumpSlot(ax, ay, dir, open) {
  return { x: clamp(ax - dir * 4, 1, W - 1), y: clamp(ay - open * 5, 2, H - 2) };
}
function stackY(ay) { return clamp(H / 2 + (ay - H / 2) * 0.3, 9, H - 9); }

function assignRoles(t, h) {
  const dir = dirOf(t), open = -closedOf(1 - t);
  const others = TEAMS[t].filter(p => p !== h);
  const ds = dumpSlot(h.x, h.y, dir, open);
  const dump = nearest(others, ds.x, ds.y);
  const cutters = others.filter(p => p !== dump);
  if (formOf(t) === 'vert') cutters.sort((a, b) => dir * (a.x - b.x));
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
  if (form === 'vert') {
    const start = Math.min(9, Math.max(3, avail * 0.3));
    const sp = clamp((avail - start) / Math.max(1, n - 0.5), 1.6, 4.5);
    return { x: clamp(ax + dir * (start + sp * idx), 1.5, W - 1.5), y: stackY(ay) };
  }
  const lanes = n >= 3 ? [6, H / 2, H - 6] : n === 2 ? [10, H - 10] : [H / 2];
  const depth = Math.min(14, Math.max(4, avail * 0.55));
  return { x: clamp(ax + dir * depth, 1.5, W - 1.5), y: lanes[Math.min(idx, lanes.length - 1)] };
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
  const deep = room > 20 && Math.random() < 0.33;
  let c, sy = stackY(ay);
  if (form === 'vert') {
    c = deep ? ready[0] : ready[ready.length - 1];          // l'avant part en profondeur, l'arrière coupe vers le disque
    if (deep) { c.cx = ax + dir * rand(22, 30); c.cy = sy + open * rand(2, 7); }
    else { c.cx = ax + dir * rand(5, 9); c.cy = sy + open * rand(8, 12); }
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

function attackerAI(p, t, ax, ay, dir, open, form, dt) {
  p.timer -= dt;
  if (p.role === 'holder') {                                // ancien porteur : il suit le jeu derrière
    const s = dumpSlot(ax, ay, dir, open);
    p.tx = s.x - dir * 2; p.ty = clamp(s.y + open * 7, 2, H - 2); p.sp = SPD.jog; return;
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
    case 'stack': p.tx = slot.x; p.ty = slot.y; p.sp = SPD.jog; break;
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
        if (form === 'vert') {                               // dégage côté fermé puis retourne au bout de la colonne
          const ord = G.order[t], i = ord.indexOf(p);
          if (i >= 0) { ord.splice(i, 1); ord.push(p); }
          p.wx = p.x + dir * 2; p.wy = clamp(stackY(ay) - open * 5, 2, H - 2); p.wDone = false;
        } else p.wDone = true;
      }
      break;
    case 'clear':
      p.sp = SPD.jog + 1.5;
      if (!p.wDone) { p.tx = p.wx; p.ty = p.wy; if (dist(p.x, p.y, p.wx, p.wy) < 1.5) p.wDone = true; }
      else { p.tx = slot.x; p.ty = slot.y; if (dist(p.x, p.y, slot.x, slot.y) < 1.5) p.state = 'stack'; }
      if (p.timer <= 0) p.state = 'stack';
      break;
  }
  p.tx = clamp(p.tx, 1, W - 1); p.ty = clamp(p.ty, 1.5, H - 1.5);
}

