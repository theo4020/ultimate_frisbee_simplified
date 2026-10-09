// events.js — Événements : réception, interception, turnover, point ; sélection du défenseur

// =====================================================================
//  Événements de jeu
// =====================================================================
function holdDisc(p) {
  disc.mode = 'held'; disc.holder = p; disc.x = p.x; disc.y = p.y; disc.z = 0; G.carryTo = null;
  players.forEach(q => { q.windup = null; q.jumpAt = 0; }); G.tellSeen = false;
  p.vx = p.vy = 0;
  G.stall = 0; G.holdT = 0; G.marker = null; G.dbl = null; G.pickup = null;
  players.forEach(q => { q.inT = 0; }); p.think = rand(0.6, 1.4);
  assignRoles(p.team, p);
  if (!G.pullPending) continuationCut(p.team, p);
  if (defFormOf(1 - p.team) !== 'man') assignZone(1 - p.team, p.x, p.y);
  playOnCatch(p);
  for (const d of TEAMS[1 - p.team]) d.react = Math.min(d.react, rand(0.04, 0.1));   // la défense réagit tout de suite à la réception
  if (G.pullPending) { G.pullPending = false; afterPull(p); }   // première possession après le pull
}

function catchDisc(p) {
  if (disc.pull) { pullCaught(p); return; }
  if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) { G.stats.out++; msTurnover(disc.thrower, 'throw'); turnover(p.x, p.y, 'Out ! Turnover'); return; }
  // le vent fait bouger le disque : plus de drops ; une passe haute retombe en flottant, plus dure à attraper
  const K = THROWS[disc.kind] || THROWS.normal;
  const dropP = Math.min(0.12, G.wind.kmh * 0.002 * (0.5 + disc.dur * 0.5)) + K.drop + K.dropWind * G.wind.kmh;
  if (Math.random() < dropP) { G.stats.drops = (G.stats.drops || 0) + 1; msTurnover(p, 'drop'); turnover(p.x, p.y, 'Drop ! Turnover'); return; }
  G.stats.comps++;
  const scored = inScoreZone(p.team, p.x);
  msCatch(p, scored);
  if (G.tuto) tutoEvent('catch', p);
  if (!scored) fxEvent('catch', p.x, p.y, p.team);
  if (scored) { G.scorer = p; scorePoint(p.team); return; }
  holdDisc(p);
}

function interception(p) {
  G.stats.ints++;
  msTurnover(disc.thrower, 'int', p);
  fxEvent('int', p.x, p.y, p.team);
  if (G.oplay) endOPlay();
  if (G.dplay) endDPlay();
  G.off = p.team;
  if (inScoreZone(p.team, p.x)) { if (G.ms) msPl(p).gol++; G.scorer = p; scorePoint(p.team, 'Callahan !'); return; }
  p.dive = 0; p.down = 0;
  p.x = clamp(p.x, EZ, W - EZ); p.y = clamp(p.y, 0.5, H - 0.5);
  holdDisc(p); setupDefense(1 - p.team, p); updateSelected();
  flash('Interception !');
  if (G.tuto) tutoEvent('turnover');
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
  if (G.tuto) tutoEvent('turnover');
}

function scorePoint(t, label) {
  fxEvent('score', disc.x, disc.y, t);
  disc.mode = 'dead';
  if (G.tuto) { tutoEvent('score', t); return; }               // tutoriel : pas de vrai score
  G.score[t]++;
  msPoint(t);
  flash(label || `Point pour les ${tn(t)} !`);
  G.receiving = 1 - t;
  G.phase = G.score[t] >= WIN ? 'over' : 'between';
  G.betweenT = 2.2;                                            // le temps de la célébration
  G.celebrate = { team: t, x: G.scorer ? G.scorer.x : disc.x, y: G.scorer ? G.scorer.y : disc.y };
  if (G.phase === 'over') onMatchOver();
}

