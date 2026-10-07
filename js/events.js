// events.js — Événements : réception, interception, turnover, point ; sélection du défenseur

// =====================================================================
//  Événements de jeu
// =====================================================================
function holdDisc(p) {
  disc.mode = 'held'; disc.holder = p; disc.x = p.x; disc.y = p.y; disc.z = 0;
  p.vx = p.vy = 0;
  G.stall = 0; G.holdT = 0; G.marker = null; G.dbl = null; G.pickup = null;
  players.forEach(q => { q.inT = 0; }); p.think = rand(0.6, 1.4);
  assignRoles(p.team, p);
  if (defFormOf(1 - p.team) === 'zone') assignZone(1 - p.team, p.x, p.y);
  playOnCatch(p);
  if (G.pullPending) { G.pullPending = false; afterPull(p); }   // première possession après le pull
}

function catchDisc(p) {
  if (disc.pull) { pullCaught(p); return; }
  if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) { G.stats.out++; turnover(p.x, p.y, 'Out ! Turnover'); return; }
  const dropP = Math.min(0.12, G.wind.kmh * 0.002 * (0.5 + disc.dur * 0.5));   // le vent fait bouger le disque : plus de drops
  if (Math.random() < dropP) { G.stats.drops = (G.stats.drops || 0) + 1; turnover(p.x, p.y, 'Drop ! Turnover'); return; }
  G.stats.comps++;
  if (!inScoreZone(p.team, p.x)) fxEvent('catch', p.x, p.y, p.team);
  if (inScoreZone(p.team, p.x)) { scorePoint(p.team); return; }
  holdDisc(p);
}

function interception(p) {
  G.stats.ints++;
  fxEvent('int', p.x, p.y, p.team);
  if (G.oplay) endOPlay();
  if (G.dplay) endDPlay();
  G.off = p.team;
  if (inScoreZone(p.team, p.x)) { scorePoint(p.team, 'Callahan !'); return; }
  p.dive = 0; p.down = 0;
  p.x = clamp(p.x, EZ, W - EZ); p.y = clamp(p.y, 0.5, H - 0.5);
  holdDisc(p); setupDefense(1 - p.team, p); updateSelected();
  flash('Interception !');
}

function turnover(x, y, msg, kind) {
  fxEvent(kind || 'turn', x, y, 1 - G.off);
  if (G.oplay) endOPlay();
  if (G.dplay) endDPlay();
  G.off = 1 - G.off;
  disc.mode = 'ground'; disc.holder = null; disc.z = 0;
  disc.x = clamp(x, EZ, W - EZ); disc.y = clamp(y, 0.5, H - 0.5);
  G.stall = 0; G.marker = null;
  G.pickup = nearest(TEAMS[G.off], disc.x, disc.y);
  assignRoles(G.off, G.pickup);
  setupDefense(1 - G.off, G.pickup);
  updateSelected(); flash(msg);
}

function scorePoint(t, label) {
  G.score[t]++;
  fxEvent('score', disc.x, disc.y, t);
  disc.mode = 'dead';
  flash(label || (t === 0 ? 'POINT pour les Bleus !' : 'Point pour les Rouges'));
  G.receiving = 1 - t;
  G.phase = G.score[t] >= WIN ? 'over' : 'between';
  G.betweenT = 1.6;
}

// =====================================================================
//  Contrôle du joueur en défense
// =====================================================================
function updateSelected() {
  for (let t = 0; t < 2; t++) {
    G.sel[t] = human(t) && G.off !== t ? nearest(TEAMS[t], disc.x, disc.y) : null;
    inputOf(t).last = -1e9;
  }
}
// joueur que la touche Espace sélectionnera (entouré en gris)
function switchTarget(t) {
  if (G.phase !== 'play' || G.off === t || !human(t)) return null;
  const [rx, ry] = disc.mode === 'air' ? [disc.ex, disc.ey] : [disc.x, disc.y];
  return nearest(TEAMS[t], rx, ry, G.sel[t]);
}
function userControls(d) {
  const t = d.team, inp = inputOf(t);
  return human(t) && G.off !== t && d === G.sel[t] && (inp.down || G.time - inp.last < 2.5);
}

