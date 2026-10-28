// events.js — Événements : réception, interception, turnover, point ; sélection du défenseur

// =====================================================================
//  Événements de jeu
// =====================================================================
function holdDisc(p) {
  disc.mode = 'held'; disc.holder = p; disc.x = p.x; disc.y = p.y; disc.z = 0; G.carryTo = null;
  players.forEach(q => { q.windup = null; q.jumpAt = 0; q.bluffed = false; }); G.tellSeen = false;
  // il garde son élan et freine (sim.js) ; il regarde d'abord dans la direction de sa course (lecture du jeu, throwing.js)
  p.pivY = 0; p.pivTo = 0; p.pivLock = 0; G.mkShade = 0; G.pivHolder = null;                    // il reçoit face au jeu, sans pivot
  const sp = Math.hypot(p.vx, p.vy); p.face = sp > 1.5 ? Math.atan2(p.vy, p.vx) : (dirOf(p.team) > 0 ? 0 : Math.PI);
  if (p.dive > 0 || p.down > 0) { p.vx *= 0.5; p.vy *= 0.5; }
  p.dive = p.down = 0; p.jump = p.jprep = p.jrec = 0;           // réception en layout ou en saut : il se relève avec le disque
  G.stall = 0; G.holdT = 0; G.marker = null; G.dbl = null; G.pickup = null;
  players.forEach(q => { q.inT = 0; }); p.think = Math.max(0.35 * aiLvl(p.team).react, aiLvl(p.team).lift || 0);   // le temps de lever la tête et lire le jeu
  visCatch(p);
  assignRoles(p.team, p);
  if (!G.pullPending) continuationCut(p.team, p);
  const df = defFormOf(1 - p.team);
  if (df === 'mix') assignMix(1 - p.team, p); else if (df !== 'man') assignZone(1 - p.team, p.x, p.y);
  playOnCatch(p);
  for (const d of TEAMS[1 - p.team]) d.react = Math.min(d.react, rand(0.04, 0.1));   // la défense réagit tout de suite à la réception
  if (G.pullPending) { G.pullPending = false; afterPull(p); }   // première possession après le pull
}

// chance de drop due au disque lui-même (passe ou pull) : le vent et le temps de vol, plus le type de lancer
const PULL_DROP = 1 / 3;                                       // un pull se droppe 3 fois moins souvent qu'une passe
function dropChance() {
  const K = throwK(disc.loft);
  return Math.min(0.012, G.wind.kmh * 0.00012 * (0.5 + disc.dur * 0.5)) + K.drop + K.dropWind * G.wind.kmh;   // 20 km/h : ~0,2 % sur une passe courte
}
// chance de drop d'une réception (voir la fiche « Fondations physiques ») : une prise simple, à hauteur de poitrine,
// sans défenseur ni vent, ne se droppe presque jamais ; ce qui la rend difficile :
//   disque rapide à l'arrivée · prise en extension (loin du corps, en plongeon, en l'air) · bras d'un défenseur tout près
function catchOdds(p) {
  const v = discLen() / Math.max(0.2, disc.dur), reachD = dist(p.x, p.y, disc.x, disc.y);
  const near = nearestD(TEAMS[1 - p.team], p.x, p.y)[1];
  return 0.001
    + Math.max(0, v - 19) * 0.001                                       // 25 m/s : +0,6 %
    + Math.max(0, reachD - 0.9) * 0.008 + (p.dive > 0 ? 0.008 : 0) + (p.jump > 0 && disc.z > REACH_STAND ? 0.005 : 0)
    + Math.max(0, 1.2 - near) * 0.015                                   // défenseur au contact : +1,5 %
    + dropChance();
}
function catchDisc(p) {
  if (disc.pull) { pullCaught(p); return; }
  const hands = controllerOf(p) ? 0 : aiLvl(p.team).hands || 0;   // mains du niveau (joueurs IA)
  if (!G.tuto && !G.practice && Math.random() < catchOdds(p) + hands) { G.stats.drops = (G.stats.drops || 0) + 1; msTurnover(p, 'drop'); turnover(p.x, p.y, 'Drop ! Turnover'); return; }
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
  if (inScoreZone(p.team, disc.x)) { if (G.ms) msPl(p).gol++; G.scorer = p; achEvent('callahan', p.team); achEvent('goal', p.team); fxEvent('callahan', p.x, p.y, p.team); scorePoint(p.team, '🦅 CALLAHAN !'); return; }
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
  if (G.tuto) G.tuto.stopBy = p;                                // tutoriel : qui a arrêté la passe
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
  G.pickup = pickupFor(G.off, disc.x, disc.y);
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

