// events.js — Événements : réception, turnover, point ; sélection du défenseur

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

// chance de drop du disque en vol (passe ou pull) : le vent et le temps de vol, plus le type de lancer
function dropChance() {
  const K = THROWS[disc.kind] || THROWS.normal;
  return Math.min(0.12, G.wind.kmh * 0.0015 * (0.5 + disc.dur * 0.5)) + K.drop + K.dropWind * G.wind.kmh;
}
function catchDisc(p) {
  if (disc.pull) { pullCaught(p); return; }
  // le vent fait bouger le disque : plus de drops ; une passe haute retombe en flottant, plus dure à attraper
  if (Math.random() < dropChance()) { G.stats.drops = (G.stats.drops || 0) + 1; msTurnover(p, 'drop'); turnover(p.x, p.y, 'Drop ! Turnover'); return; }
  G.stats.comps++;
  const scored = inScoreZone(p.team, disc.x);                   // le point se joue là où le disque est attrapé
  msCatch(p, scored);
  if (!disc.pull) achEvent('catch', p, dist(disc.sx, disc.sy, p.x, p.y));
  if (scored) achEvent('goal', p.team);
  if (G.tuto) tutoEvent('catch', p);
  if (!scored) fxEvent('catch', p.x, p.y, p.team);
  if (scored) { G.scorer = p; scorePoint(p.team); return; }
  if (!inField(p.x, p.y)) { startCarry(p, clamp(p.x, 0.5, W - 0.5), clamp(p.y, 0.5, H - 0.5), ''); return; }   // attrapé depuis l'extérieur : il rentre
  holdDisc(p);
}

function turnover(x, y, msg, kind) {
  if (G.practice) { practiceMiss(kind === 'block' ? 'Contré par le défenseur !' : msg); return; }
  fxEvent(kind || 'turn', x, y, 1 - G.off);
  if (G.oplay) endOPlay();
  if (G.dplay) endDPlay();
  G.off = 1 - G.off;
  disc.mode = 'ground'; disc.holder = null; disc.z = 0;
  disc.x = clamp(x, 0.5, W - 0.5); disc.y = clamp(y, 0.5, H - 0.5);   // ramassé là où il est tombé
  G.carryTo = lineSpot(disc.x, disc.y);                        // repris dans un en-but : ramené à la ligne
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

