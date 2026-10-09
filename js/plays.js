// plays.js — Plays de départ (attaque et défense)

// =====================================================================
//  Plays de départ
// =====================================================================
function startCut(c, x, y, deep) {
  const dir = dirOf(c.team), open = -closedOf(1 - c.team);
  c.cx = x; c.cy = y; clampPt(c);
  c.wx = c.x + dir * (deep ? -2 : 2); c.wy = c.y + (deep ? open : -open) * 1.2;
  c.role = 'cutter'; c.state = 'jab'; c.timer = 0.3;
}

function startOPlay() {
  const P = G.oplay; if (!P) return;
  const t = P.team, h = disc.holder, ord = G.order[t], dir = dirOf(t), open = -closedOf(1 - t);
  const byOpen = ord.slice().sort((a, b) => open * (b.y - a.y));    // du côté ouvert vers le côté fermé
  const dump = TEAMS[t].find(p => p.role === 'dump');
  if (P.type === 'huck') {
    P.a = formOf(t) === 'vert' ? ord[0] : byOpen[0];
    P.a.tag = '★'; P.a.state = 'park'; P.a.cx = P.a.x; P.a.cy = P.a.y;
  } else if (P.type === 'split') {
    P.a = byOpen[0]; P.b = byOpen[byOpen.length - 1];
    for (const c of [P.a, P.b]) { c.tag = '1'; c.state = 'park'; c.cx = c.x; c.cy = c.y; }
  } else if (P.type === 'give') {
    P.b = dump; P.giver = h; P.dur = 7;
    dump.tag = '1'; dump.state = 'park'; dump.role = 'cutter';
    dump.cx = clamp(h.x - dir * 1.5, 1, W - 1); dump.cy = clamp(h.y + open * 6.5, 2, H - 2);
    P.targets = [dump];
  } else if (P.type === 'swing') {                           // le dump se place derrière, côté break
    P.b = dump; P.giver = h; P.dur = 8;
    dump.tag = '1'; dump.state = 'park'; dump.role = 'cutter';
    dump.cx = clamp(h.x - dir * 3, 1, W - 1); dump.cy = clamp(h.y - open * 6.5, 2, H - 2);
    P.targets = [dump];
  } else if (P.type === 'flood') {
    P.a = byOpen[0]; P.a.tag = '1'; P.dur = 7;
    P.a.state = 'park'; P.a.cx = h.x + dir * 13; P.a.cy = H / 2 + open * 3; clampPt(P.a);
    TEAMS[t].filter(p => p !== h && p !== P.a).forEach((p, i) => {
      p.state = 'park'; p.role = 'cutter'; p.cx = h.x + dir * (6 + i * 7); p.cy = H / 2 - open * (11 + (i % 2) * 3); clampPt(p);
    });
  }
}

function updatePlays(dt, ax, ay, dir, open) {
  const P = G.oplay;
  if (P) {
    P.t += dt;
    if (P.team !== G.off || P.t > P.dur) endOPlay();
    else if (disc.mode === 'held') {
      if (P.type === 'huck' && P.phase === 0 && P.t > 0.6) {
        startCut(P.a, ax + dir * rand(30, 36), clamp(P.a.y + open * 4, 4, H - 4), true);
        P.targets = [P.a]; P.phase = 1;
      } else if (P.type === 'split' && P.phase === 0 && P.t > 0.5) {
        startCut(P.a, ax + dir * rand(6, 9), ay + open * rand(8, 11), false);
        startCut(P.b, ax + dir * rand(6, 9), ay - open * rand(8, 11), false);
        P.targets = [P.a, P.b]; P.phase = 1;
      } else if (P.type === 'flood') {
        if (P.phase === 0 && P.t > 1.4) {
          startCut(P.a, ax + dir * rand(5, 8), ay + open * rand(8, 11), false);
          P.targets = [P.a]; P.phase = 1;
        } else if (P.phase === 1 && P.a.state === 'hold') {
          startCut(P.a, ax + dir * rand(24, 30), clamp(ay + open * 8, 3, H - 3), true); P.phase = 2;
        }
      }
    }
  }
  if (P && G.oplay && P.type === 'give' && P.phase === 0 && !P.went && disc.mode === 'air' && disc.intended === P.b) {
    const g = P.giver;                                       // « donne et VA » : il part dès que le disque quitte sa main
    if (!G.order[g.team].includes(g)) G.order[g.team].unshift(g);
    startCut(g, g.x + dir * rand(9, 12), g.y + open * 5, false);
    g.tag = '2'; P.went = true;
  }
  const D = G.dplay;
  if (D) {
    D.t += dt;
    const over = D.team === G.off || (D.type === 'double' ? D.throws >= 1 : D.type === 'junk' ? D.throws >= 2 : D.t > 6) || D.t > 12;
    if (over) endDPlay();
  }
}

function playOnCatch(p) {
  const P = G.oplay;
  if (!P || P.team !== p.team) return;
  if (P.type === 'give' && P.phase === 0 && p === P.b) {   // le relais a reçu : l'ancien porteur file vers l'avant
    const g = P.giver;
    if (!G.order[p.team].includes(g)) G.order[p.team].unshift(g);
    if (g.state !== 'jab' && g.state !== 'cut') {
      const dir = dirOf(p.team), open = -closedOf(1 - p.team);
      startCut(g, g.x + dir * rand(9, 12), g.y + open * 5, false);
    }
    P.b.tag = ''; g.tag = '2'; P.a = g; P.targets = [g]; P.phase = 1; P.dur = P.t + 3;
    return;
  }
  if (P.type === 'swing' && P.phase === 0 && p === P.b) {    // le dump a le disque : un cutter attaque l'autre côté
    const dir = dirOf(p.team), side = Math.sign(p.y - P.giver.y) || 1;
    const tx = p.x + dir * rand(8, 11), ty = clamp(p.y + side * rand(6, 9), 2, H - 2);
    const c = nearest(G.order[p.team].filter(q => q !== p && q !== P.giver), tx, ty);
    P.b.tag = '';
    if (c) { startCut(c, tx, ty, false); c.tag = '2'; P.a = c; P.targets = [c]; P.phase = 1; P.dur = P.t + 3.5; return; }
  }
  if (P.t > 0.05) endOPlay();
}

function endOPlay() {
  for (const p of players) {
    p.tag = p.tag === 'S' || p.tag === '2d' ? p.tag : '';
    if (p.state === 'park') { p.state = 'clear'; p.wDone = true; p.timer = 4; }
  }
  if (G.oplay && disc.holder && disc.mode === 'held' && G.oplay.team === disc.holder.team) assignRolesKeep(G.oplay.team);
  G.oplay = null; G.cutT = 0.5;
}
// après un play : on redonne un relais et un ordre propres sans casser les courses en cours
function assignRolesKeep(t) {
  const keep = new Map(TEAMS[t].map(p => [p, [p.state, p.cx, p.cy, p.timer, p.wDone]]));
  assignRoles(t, disc.holder);
  for (const p of G.order[t]) {
    const [st, cx, cy, tm, wd] = keep.get(p);
    if (st === 'jab' || st === 'cut' || st === 'hold' || st === 'clear') Object.assign(p, { state: st, cx, cy, timer: tm, wDone: wd });
  }
}

function startDPlay() {
  const D = G.dplay; if (!D) return;
  const atkDump = TEAMS[1 - D.team].find(p => p.role === 'dump');
  const dfn = TEAMS[D.team], form = defFormOf(D.team);
  if (D.type === 'safety') D.d = form === 'man' ? dfn.find(d => d.match === atkDump) : dfn.find(d => d.zslot === 4);
  else if (D.type === 'double') D.d = form === 'man' ? dfn.find(d => d.match === atkDump) : dfn.find(d => d.zslot === 3);
  if (D.d) D.d.tag = D.type === 'safety' ? 'S' : '2d';
}

function endDPlay() {
  const D = G.dplay; G.dplay = null;
  if (D.d) D.d.tag = '';
  if (D.type === 'junk' && D.team !== G.off) {             // bascule vers la défense de base
    const h = disc.mode === 'held' ? disc.holder : G.pickup;
    if (h) setupDefense(D.team, h);
  }
}

