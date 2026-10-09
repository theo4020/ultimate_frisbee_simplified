// point.js — Mise en place et lancement d'un point

// =====================================================================
//  Mise en place d'un point
// =====================================================================
function placeForPoint() {
  const r = G.receiving, d = 1 - r, dir = dirOf(r), open = -closedOf(d);
  const h = TEAMS[r][0];
  h.x = r === 0 ? EZ : W - EZ; h.y = H / 2;
  TEAMS[r].forEach((p, k) => { if (k) { p.x = h.x + dir * (6 + k * 3); p.y = [5, 13, 24, 32][k - 1]; } });
  players.forEach(p => { p.vx = p.vy = 0; p.dive = p.down = 0; p.react = 0; p.tag = ''; });
  G.off = r; G.oplay = null;
  // les deux équipes démarrent déjà en place, comme après l'engagement
  for (let pass = 0; pass < 2; pass++) {
    holdDisc(h);
    for (const p of TEAMS[r]) {
      if (p === h) continue;
      const s = p.role === 'dump' ? dumpSlot(h.x, h.y, dir, open) : cutterSlot(p, r, h.x, h.y, dir, formOf(r));
      p.x = s.x; p.y = s.y;
    }
  }
  TEAMS[d].forEach((p, k) => { p.x = h.x + dir * (8 + k); p.y = H / 2 + (k - 2) * 3; });
  setupDefense(d, h);
  const slots = zoneSlots(d, h.x, h.y, dir, -open);
  for (const p of TEAMS[d]) { defenderAI(p, h.x, h.y, dir, -open, defFormOf(d), slots); p.x = p.tx; p.y = p.ty; }
}

function startPoint() {
  const pick = o => o[Math.floor(Math.random() * o.length)];
  G.ai.off = pick(['vert', 'vert', 'ho', 'side']);
  G.ai.def = Math.random() < 0.55 ? 'man' : pick(['zone', 'zone', 'clam']);
  G.ai.force = pick(['haut', 'bas', 'middle', 'haut', 'bas', 'straight']);
  G.ai.play = Math.random() < 0.5 ? 'none' : pick(['huck', 'split', 'give', 'flood', 'swing']);
  G.ai.dplay = Math.random() < 0.5 ? 'none' : pick(['safety', 'double', 'junk']);
  const r = G.receiving, d = 1 - r;
  if (!G.ms) newMatchStats();
  G.ms.ptT = 0;
  replayReset(); G.celebrate = null; G.scorer = null; FX.celebrate = null; G.throwKind = 'normal';
  const oType = cfg(r).play, dType = cfg(d).dplay;
  G.dplay = dType === 'none' ? null : { type: dType, team: d, t: 0, throws: 0, d: null };
  G.pendingOPlay = oType;                                     // le play d'attaque démarre à la première possession
  startPull();                                                // chaque point commence par un pull (voir pull.js)
  G.menuShown = false; G.readyIds = new Set();
  updateSelected();
  document.getElementById('overlay').classList.add('hidden');
  pullFlash();
  if (G.net === 'host') netSend({ t: 'start', r });
}
function startFlash(r) {                                      // message de début de point, vu de chaque côté
  const mine = cfg(G.me);
  if (r === G.me) flash(mine.play !== 'none' ? 'Play : ' + PLAY_NAMES[mine.play] + ' !' : 'À toi de lancer !', true);
  else flash(mine.dplay !== 'none' ? 'Play : ' + PLAY_NAMES[mine.dplay] + ' !' : 'Défends !', true);
}

