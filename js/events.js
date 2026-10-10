// events.js — Événements : réception, interception, turnover, point ; sélection du défenseur

// =====================================================================
//  Événements de jeu
// =====================================================================
function holdDisc(p) {
  disc.mode = 'held'; disc.holder = p; disc.x = p.x; disc.y = p.y; disc.z = 0; G.carryTo = null;
  players.forEach(q => { q.windup = null; q.jumpAt = 0; q.bluffed = false; }); G.tellSeen = false;
  p.vx = p.vy = 0;
  p.dive = p.down = 0; p.jump = p.jprep = p.jrec = 0;           // réception en layout ou en saut : il se relève avec le disque
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
  if (!disc.pull) achEvent('catch', p, dist(disc.sx, disc.sy, p.x, p.y));
  if (scored) achEvent('goal', p.team);
  if (G.tuto) tutoEvent('catch', p);
  if (!scored) fxEvent('catch', p.x, p.y, p.team);
  if (scored) { G.scorer = p; scorePoint(p.team); return; }
  holdDisc(p);
}

function interception(p) {
  if (G.practice) { practiceMiss('Intercepté !'); return; }
  G.stats.ints++;
  msTurnover(disc.thrower, 'int', p);
  fxEvent('int', p.x, p.y, p.team);
  if (G.oplay) endOPlay();
  if (G.dplay) endDPlay();
  G.off = p.team;
  if (inScoreZone(p.team, p.x)) { if (G.ms) msPl(p).gol++; G.scorer = p; achEvent('callahan', p.team); achEvent('goal', p.team); scorePoint(p.team, 'Callahan !'); return; }
  p.dive = 0; p.down = 0;
  p.x = clamp(p.x, 0.5, W - 0.5); p.y = clamp(p.y, 0.5, H - 0.5);
  if (inScoreZone(1 - p.team, p.x)) startCarry(p, goalLine(p.team), p.y, '');   // intercepté dans son en-but : il ramène le disque à la ligne
  else holdDisc(p);
  setupDefense(1 - p.team, p); updateSelected();
  flash('Interception !');
  if (G.tuto) tutoEvent('turnover');
}

function turnover(x, y, msg, kind) {
  if (G.practice) { practiceMiss(kind === 'block' ? 'Contré par le défenseur !' : msg); return; }
  fxEvent(kind || 'turn', x, y, 1 - G.off);
  if (G.oplay) endOPlay();
  if (G.dplay) endDPlay();
  G.off = 1 - G.off;
  disc.mode = 'ground'; disc.holder = null; disc.z = 0;
  disc.x = clamp(x, 0.5, W - 0.5); disc.y = clamp(y, 0.5, H - 0.5);   // ramassé là où il est tombé
  G.carryTo = inScoreZone(1 - G.off, disc.x) ? { x: goalLine(G.off), y: disc.y } : null;   // dans son en-but : ramené à la ligne
  G.groundAt = G.gt;
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
  if (G.attract) { G.phase = 'between'; G.betweenT = 1.8; G.celebrate = { team: t, x: G.scorer ? G.scorer.x : disc.x, y: G.scorer ? G.scorer.y : disc.y }; return; }
  flash(label || `Point pour les ${tn(t)} !`);
  G.receiving = 1 - t;
  G.phase = G.score[t] >= winPts() ? 'over' : 'between';
  G.betweenT = 2.2;                                            // le temps de la célébration
  G.celebrate = { team: t, x: G.scorer ? G.scorer.x : disc.x, y: G.scorer ? G.scorer.y : disc.y };
  if (G.phase === 'over') onMatchOver();
}
