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

// chance de drop du disque en vol (passe ou pull) : le vent et le temps de vol, plus le type de lancer
const PULL_DROP = 1 / 3;                                       // un pull se droppe 3 fois moins souvent qu'une passe
function dropChance() {
  const K = THROWS[disc.kind] || THROWS.normal;
  return Math.min(0.12, G.wind.kmh * 0.0015 * (0.5 + disc.dur * 0.5)) + K.drop + K.dropWind * G.wind.kmh;
}
function catchDisc(p) {
  if (disc.pull) { pullCaught(p); return; }
  // le vent fait bouger le disque : plus de drops ; une passe haute retombe en flottant, plus dure à attraper
  const hands = G.tuto || G.practice || controllerOf(p) ? 0 : aiLvl(p.team).hands || 0;   // mains du niveau (joueurs IA)
  if (Math.random() < dropChance() + hands) { G.stats.drops = (G.stats.drops || 0) + 1; msTurnover(p, 'drop'); turnover(p.x, p.y, 'Drop ! Turnover'); return; }
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

// interception : le défenseur garde le disque (dans l'en-but adverse, c'est toujours un Callahan : point immédiat)
function interception(p) {
  if (G.practice) { practiceMiss('Intercepté !'); return; }
  G.stats.ints++;
  msTurnover(disc.thrower, 'int', p);
  fxEvent('int', p.x, p.y, p.team);
  if (G.oplay) endOPlay();
  if (G.dplay) endDPlay();
  G.off = p.team;
  if (inScoreZone(p.team, disc.x)) { if (G.ms) msPl(p).gol++; G.scorer = p; achEvent('callahan', p.team); achEvent('goal', p.team); scorePoint(p.team, 'Callahan !'); return; }
  p.dive = 0; p.down = 0;
  const x = clamp(p.x, 0.5, W - 0.5), y = clamp(p.y, 0.5, H - 0.5), L = lineSpot(x, y);
  if (L) startCarry(p, L.x, L.y, '');                          // intercepté dans son en-but : il ramène le disque à la ligne
  else if (x !== p.x || y !== p.y) startCarry(p, x, y, '');    // depuis l'extérieur : il rentre
  else holdDisc(p);
  setupDefense(1 - p.team, p); updateSelected();
  flash('Interception !');
  if (G.tuto) tutoEvent('turnover');
}
// un défenseur arrête la passe : 1 fois sur 3 il l'intercepte, et toujours dans l'en-but adverse (Callahan) ; sinon block
const INT_CHANCE = 1 / 3;
function defStop(p, msg) {
  if (inScoreZone(p.team, disc.x) || Math.random() < INT_CHANCE) { interception(p); return; }
  G.stats.blocks++; msTurnover(disc.thrower, 'block', p); turnover(disc.x, disc.y, msg, 'block');
}

function turnover(x, y, msg, kind) {
  if (G.practice) { practiceMiss(kind === 'block' ? 'Contré par le défenseur !' : msg); return; }
  G.aiPlayTried = false;                                       // nouvelle possession : l'IA pourra appeler un play
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

