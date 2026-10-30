// pull.js — Le pull (engagement) au début de chaque point.
// L'équipe qui défend lance le disque à l'équipe qui reçoit :
//   1) on choisit la zone visée et la courbe,
//   2) on arrête une jauge (QTE) : dans le vert = pull long et haut, ce qui laisse
//      le temps à sa défense de monter ; trop tôt = pull court ; tout au bout = trop fort.
// Règles WFDF 2025-2028 (section 7) :
//  • pull attrapé : on joue de là (ramené à la ligne s'il est attrapé dans son en-but) ;
//  • pull qui tombe dans le terrain : on joue là où il s'arrête ;
//  • pull qui sort sans toucher le terrain (7.12) : le « brick » est une option, pas une obligation : l'équipe qui
//    reçoit choisit le brick OU l'endroit où le disque est sorti — l'IA prend le meilleur des deux (jamais de terrain perdu) ;
//  • hors-jeu de l'équipe qui pulle (7.5.2) : l'équipe qui reçoit laisse tomber le disque sans le toucher, puis joue
//    comme si elle avait appelé « brick » ;
//  • hors-jeu de l'équipe qui reçoit (7.5.1) : le jeu reprend comme après un temps mort (check), là où elle a le disque.

const PULL = { BRICK: 12, MAX: 72, AUTO_T: 60, GAUGE_HZ: 0.8, PERFECT: [0.82, 0.95] };
const goalLine = t => (dirOf(t) > 0 ? EZ : W - EZ);   // ligne d'en-but que l'équipe t défend

const PULL_YS = [4, 11, 18.5, 26, 33], REGROUP_SPD = 11;   // places sur la ligne · vitesse de mise en place (m/s)
// joueur qui va pulle : celui de l'humain désigné s'il a un joueur fixe, sinon le plus proche du centre de la ligne
function pullerPlayer(d, by) {
  const h = by != null && humanById(by);
  if (h && h.sel && h.sel.team === d && teamHumans(d).length > 1) return h.sel;
  return nearest(TEAMS[d], goalLine(d), H / 2);
}
// chacun rejoint sa place sur sa ligne d'en-but en marchant (pas de téléportation) ; le pulleur prend le centre
function setPullSpots(puller) {
  const r = G.receiving, d = 1 - r;
  const spots = (team, center) => {
    const rest = TEAMS[team].filter(p => p !== center).sort((a, b) => a.y - b.y);
    const ys = center ? PULL_YS.filter((y, k) => k !== 2) : PULL_YS;
    rest.forEach((p, k) => { p.tx = goalLine(team); p.ty = ys[k]; });
    if (center) { center.tx = goalLine(team); center.ty = PULL_YS[2]; }
  };
  spots(r, null); spots(d, puller || null);
}
function regroupStep(dt) {
  for (const p of players) {
    if (p.dive > 0 || p.down > 0 || p.jump > 0 || p.jprep > 0) { steer(p, dt); continue; }
    p.sp = REGROUP_SPD; steer(p, dt);
  }
  if ((disc.mode === 'held' || disc.mode === 'carry') && disc.holder) { disc.x = disc.holder.x; disc.y = disc.holder.y; }
}
// entre deux points (menu de stratégie ouvert) : les joueurs vont déjà se placer pour le pull suivant
function regroupTick(dt) {
  if (G.phase !== 'between') return;
  const d = 1 - G.receiving, by = choosePuller(d);
  setPullSpots(pullerPlayer(d, by));
  regroupStep(dt);
}
// les deux équipes doivent être en place sur leur ligne avant le pull
function pullReady() {
  if (G.net === 'guest') return !!G.netPullReady;
  if (!G.pull || !disc.holder) return false;
  return players.every(p => dist(p.x, p.y, p.tx, p.ty) < (p === disc.holder ? 0.6 : 2.5));   // les deux équipes en place
}
// début de match (derrière le premier menu) : les équipes sont déjà alignées sur leurs lignes
function placeOnPullLines() {
  const d = 1 - G.receiving, puller = pullerPlayer(d, choosePuller(d));
  setPullSpots(puller);
  players.forEach(p => { p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0; p.dive = p.down = 0; });
  Object.assign(disc, { mode: 'held', holder: puller, x: puller.x, y: puller.y, z: 0, pull: false });
  G.off = G.receiving;
  visReset();
}
function placeForPull() {
  const r = G.receiving, d = 1 - r;
  players.forEach(p => {
    p.dive = p.down = 0; p.jump = p.jprep = p.jrec = p.jumpAt = 0; p.windup = null; p.react = 0; p.tag = ''; p.inT = 0;
    p.state = 'stack'; p.role = 'cutter'; p.match = null;
  });
  const puller = pullerPlayer(d, G.pull ? G.pull.by : null);
  setPullSpots(puller);
  Object.assign(disc, { mode: 'held', holder: puller, x: puller.x, y: puller.y, z: 0, pull: false });
  Object.assign(G, { off: r, oplay: null, stall: 0, marker: null, dbl: null, pickup: null, sel: [null, null], order: [[], []] });
}

function startPull() {
  const pt = 1 - G.receiving;
  G.pull = { team: pt, t: 0, aiT: rand(1.0, 1.8), by: choosePuller(pt) };
  placeForPull();
  G.phase = 'pull';
  G.pullCount = G.pullCount || [0, 0]; G.pullCount[pt]++;
  G.pullUI = { stage: 'aim', t0: 0, x: 0, y: 0, q: 0 };
  G.pullPending = false;
  G.offside = null; G.startGo = null; G.checkT = 0;
  for (const h of G.humans) h.startDone = false;
  G.curve = 0; const cr = document.getElementById('curveRange'); if (cr) cr.value = 0;
}

// c'est le capitaine de l'équipe qui pulle (le seul humain de l'équipe en solo)
// qui pulle : choisi par le capitaine (lui-même, un coéquipier, chacun son tour, ou l'IA). null = l'IA pulle
function choosePuller(t) {
  const hs = teamHumans(t);
  if (!hs.length) return null;
  const v = String(cfg(t).puller || 'cap');
  if (v === 'ai') return null;
  if (v === 'rot') return hs[((G.pullCount || [0, 0])[t]) % hs.length].id;
  const h = hs.find(o => String(o.id) === v);
  return (h || hs[0]).id;
}
const localPuller = () => G.phase === 'pull' && !!G.pull && G.pull.by != null && G.pull.by === G.myId;
function pullFlash() {
  if (!G.pull) return;
  // seulement quand c'est à toi : pour les autres, le bandeau du terrain (« L'adversaire prépare son pull… ») le dit déjà
  if (localPuller()) flash('À toi de puller !', true);
}

// position de la jauge (0 → 1 → 0…), en temps réel
function gaugePos() {
  const ui = G.pullUI;
  if (ui.stage === 'sent') return ui.q;
  const ph = ((G.time - ui.t0) * PULL.GAUGE_HZ) % 1;
  return ph < 0.5 ? ph * 2 : 2 - ph * 2;
}
function clampPullAim(h, x, y) {
  const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy) || 1;
  return d > PULL.MAX ? [h.x + dx / d * PULL.MAX, h.y + dy / d * PULL.MAX] : [x, y];
}

// ---------- actions du joueur qui pulle ----------
function pullPointerDown(wx, wy) {
  const ui = G.pullUI, h = disc.holder;
  if (!localPuller() || !h) return;
  if (ui.stage === 'aim') {
    if (!pullReady()) { flash('Attends que ton équipe soit en place', true); return; }
    [ui.x, ui.y] = clampPullAim(h, wx, wy);
    ui.stage = 'power'; ui.t0 = G.time;
  } else if (ui.stage === 'power') pullStop();
}
function pullStop() {
  const ui = G.pullUI;
  if (!localPuller() || ui.stage !== 'power') return;
  ui.q = gaugePos(); ui.stage = 'sent';
  try { SOUNDS.qte(ui.q); } catch (e) { }
  const q = ui.q;
  setTimeout(() => doPull(ui.x, ui.y, G.curve, q), 250);       // on laisse voir où la jauge s'est arrêtée
}
function pullBack() { if (localPuller() && G.pullUI.stage === 'power') G.pullUI.stage = 'aim'; }
function doPull(x, y, curve, q) {
  if (!localPuller()) return;                                 // seul le pulleur désigné peut pulle
  if (G.net === 'guest') netSend({ t: 'pull', x, y, curve, q });
  else requestPull(x, y, curve, q);
}
// un humain a arrêté sa jauge : s'il y a d'autres joueurs humains, le pull attend le « PULL ! » du compte à rebours
function requestPull(x, y, curve, q) {
  if (G.phase !== 'pull' || !G.pull) return;
  G.pull.pend = { x: +x, y: +y, curve: +curve || 0, q: +q || 0 }; G.pull.cd = null;
  if (!startOn()) { const pd = G.pull.pend; G.pull.pend = null; launchPull(pd.x, pd.y, pd.curve, pd.q); }
}

// ---------- IA et temps limite ----------
function pullTick(dt, gdt) {
  if (G.phase !== 'pull' || !G.pull) return;
  regroupStep(gdt || dt);                                      // mise en place en marchant
  if (!pullReady()) return;                                    // on attend que tout le monde soit en place
  G.pull.t += dt;                                              // temps réel : pull automatique au bout de 60 s
  if (G.pull.by != null && !humanById(G.pull.by)) G.pull.by = null;   // le pulleur choisi est parti : l'IA prend le relais
  if (G.pull.pend) { if (startOn()) startTick(dt); else { const pd = G.pull.pend; G.pull.pend = null; launchPull(pd.x, pd.y, pd.curve, pd.q); } return; }   // pull humain : compte à rebours
  if (G.pull.by == null) {
    if (startOn()) startTick(dt);                              // départ façon course : le pull part au feu vert
    else { G.pull.aiT -= gdt || dt; if (G.pull.aiT <= 0) aiPull(); }
  }
  else if (G.pull.t > PULL.AUTO_T) aiPull();                    // personne ne pulle : pull automatique
}
// secondes avant le pull automatique (pulleur humain qui tarde) ; null si l'IA pulle elle-même
function pullLeft() {
  if (G.phase !== 'pull' || !G.pull || G.pull.by == null) return null;
  if (G.net === 'guest') return G.netPullLeft == null ? null : G.netPullLeft;
  return Math.max(0, Math.ceil(PULL.AUTO_T - G.pull.t));
}
function aiPull() {
  const r = G.receiving, gl = goalLine(r), dr = dirOf(r), h = disc.holder;
  let ax = gl + dr * rand(-6, 12), ay = H / 2 + rand(-9, 9);
  const [wx, wy] = drift(3.8); ax -= wx; ay -= wy;               // compense le vent
  const u = Math.random();
  const q = u < 0.08 ? rand(0.95, 1) : u < 0.55 ? rand(0.82, 0.95) : rand(0.45, 0.82);
  [ax, ay] = clampPullAim(h, ax, ay);
  launchPull(ax, ay, rand(-0.5, 0.5), q);
}

// ---------- le pull part ----------
function launchPull(ax, ay, curve, q) {
  if (G.phase !== 'pull' || !disc.holder) return;
  const pulledBy = G.pull ? G.pull.by : null;
  const r = G.receiving, d = 1 - r, h = disc.holder;
  curve = clamp(+curve || 0, -1, 1); q = clamp(+q || 0, 0, 1);
  [ax, ay] = clampPullAim(h, ax, ay);
  const [p0, p1] = PULL.PERFECT;
  let f, err;
  let lat = 0;                                                  // écart sur le côté (perpendiculaire au pull)
  if (q > p1) {                                                 // trop fort : il part de travers et perd de la distance
    const over = (q - p1) / (1 - p1);
    f = 0.8 - over * 0.12; err = 1.5;
    lat = (Math.random() < 0.5 ? -1 : 1) * rand(6, 9 + over * 5);
  }
  else if (q >= p0) { f = 1; err = 1.2; }                       // parfait
  else { f = 0.5 + 0.5 * q / p0; err = 2.5; }                   // trop tôt : court
  const hang = q > p1 ? 2.0 : 1.8 + 2.4 * Math.min(1, q / p0);  // temps de vol (s)
  const pdx = ax - h.x, pdy = ay - h.y, pl = Math.hypot(pdx, pdy) || 1;
  const tx = h.x + pdx * f - pdy / pl * lat, ty = h.y + pdy * f + pdx / pl * lat;
  const ea = rand(0, Math.PI * 2), er = err * Math.sqrt(Math.random());
  const aimX = tx + Math.cos(ea) * er, aimY = ty + Math.sin(ea) * er;
  const dur = Math.max(hang, flightTime(dist(h.x, h.y, aimX, aimY)) * 1.2);
  const [wx, wy] = drift(dur);
  const [cx, cy] = ctrlFor(h.x, h.y, aimX, aimY, curve);
  Object.assign(disc, { mode: 'air', holder: null, sx: h.x, sy: h.y, ex: aimX + wx, ey: aimY + wy, cx, cy,
    t: 0, dur, thrower: h, team: r, rolled: new Set(), bd: new Map(), pull: true, wa: 0, kind: 'normal', loft: LOFT.N, curveV: curve, cone: 0, coneOff: null });
  players.forEach(p => { p.guess = null; });
  disc.intended = nearest(TEAMS[r], disc.ex, disc.ey);
  G.phase = 'play'; G.off = r; G.pullPending = true; G.pull = null;
  assignRoles(r, disc.intended);
  setupDefense(d, disc.intended);
  updateSelected();
  players.forEach(p => { p.react = 0; p.diveTried = true; });
  fxEvent('pull', h.x, h.y, d);
  if (G.offside) G.msgT = Math.max(G.msgT, 1.8);               // hors-jeu annoncé : on le laisse affiché (pas écrasé par la qualité du pull)
  else flash(q > p1 ? 'Pull trop fort !' : q >= p0 ? 'Pull parfait !' : 'Pull court');
  if (G.tuto) tutoEvent('pull', q);
  if (q >= p0 && q <= p1 && pulledBy === G.myId) achEvent('pull', d);
}

// réception du pull à la volée
function pullCaught(p) {
  disc.pull = false;
  const off = pullerOffside();
  if (off) { const b = offsideSpot(); startCarry(p, b.x, b.y, ''); return; }   // hors-jeu de l'équipe qui pulle : brick (normalement on ne l'attrape pas, voir sim.js)
  // un pull se droppe (3 fois moins souvent qu'une passe) : l'équipe qui a pullé récupère le disque là où il tombe
  if (Math.random() < dropChance() * PULL_DROP) { G.pullPending = false; G.dplay = null; G.stats.drops = (G.stats.drops || 0) + 1; msTurnover(p, 'drop'); turnover(p.x, p.y, 'Pull droppé ! Turnover'); return; }
  fxEvent('catch', p.x, p.y, p.team);
  // attrapé dans un en-but ou depuis l'extérieur : il ramène le disque à pied (ligne d'en-but ou bord du terrain)
  const x = clamp(p.x, 0.5, W - 0.5), y = clamp(p.y, 0.5, H - 0.5), L = lineSpot(x, y);
  if (L) { startCarry(p, L.x, L.y, ''); return; }
  if (x !== p.x || y !== p.y) { startCarry(p, x, y, ''); return; }
  holdDisc(p);
}
const brickX = r => goalLine(r) + dirOf(r) * PULL.BRICK;
// le joueur ramène le disque à pied jusqu'à la ligne d'en-but ou au brick avant que le jeu reprenne
function startCarry(p, x, y, msg) {
  Object.assign(disc, { mode: 'carry', holder: p, x: p.x, y: p.y, z: 0 });
  G.carryTo = { x, y }; G.pickup = null; G.stall = 0; G.marker = null;
  p.vx = p.vy = 0;
  assignRoles(p.team, p);
  setupDefense(1 - p.team, p);
  if (msg) flash(msg);
}
// le pull touche le sol sans être attrapé
function pullLanded(ex, ey) {
  const r = G.receiving;
  disc.pull = false;
  const out = ex < 0 || ex > W || ey < 0 || ey > H;
  // le disque est ramassé là où il s'arrête (ou là où il est sorti), puis ramené si besoin
  let [x, y] = out ? crossPoint() : [ex, ey];
  x = clamp(x, 0.5, W - 0.5); y = clamp(y, 0.5, H - 0.5);
  let msg = '';
  if (pullerOffside()) { G.carryTo = offsideSpot(); msg = ''; }   // hors-jeu de l'équipe qui pulle (7.5.2) : brick
  else if (out) {                                                // 7.12 : brick, ou là où il est sorti (ramené hors de l'en-but)
    const c = pullOutChoice(x, y); G.carryTo = c.spot; msg = c.brick ? 'Out ! Brick' : 'Out ! Repris où il est sorti';
  } else G.carryTo = lineSpot(x, y);
  pullToSpot(x, y, null, msg);
}
// pull sorti sans toucher le terrain : le brick, ou le point de sortie (dans la zone centrale) s'il fait gagner du terrain
function pullOutChoice(x, y) {
  const r = G.receiving, b = { x: brickX(r), y: H / 2 };
  const here = { x: clamp(x, EZ, W - EZ), y: clamp(y, 0.5, H - 0.5) };
  const gain = q => dirOf(r) * (q.x - goalLine(r));
  return gain(here) > gain(b) + 1 ? { spot: here, brick: false } : { spot: b, brick: true };
}
function pullToSpot(x, y, catcher, msg) {
  const r = G.receiving;
  Object.assign(disc, { mode: 'ground', holder: null, x, y, z: 0 });
  G.groundAt = G.gt;
  G.pickup = catcher || nearest(TEAMS[r], x, y);
  assignRoles(r, G.pickup);
  setupDefense(1 - r, G.pickup);
  fxEvent('land', x, y, r);
  if (msg) flash(msg);
}
// première possession après le pull : les plays démarrent maintenant
function afterPull(p) {
  if (G.offside && G.offside.team === p.team) { G.checkT = START.CHECK_T; flash('Check : la défense se place', true); }   // l'équipe qui reçoit était hors-jeu
  G.offside = null;
  if (G.dplay) { G.dplay.t = 0; startDPlay(); }
  G.aiPlayTried = false;                                      // nouvelle possession : l'IA pourra appeler un play
}

// ---------- départ au pull, façon départ de course (facultatif) ----------
// Quand l'IA pulle (hors tutoriel), un compte à rebours 3, 2, 1 puis « PULL ! » : le pull part au « PULL ».
//  • appuyer (clic, tape, Espace, A) dans les START.GOOD s après le « PULL » : départ parfait, ton équipe part en trombe ;
//  • appuyer pendant le compte à rebours (dès le « 2 ») : faux départ = hors-jeu (règles WFDF 7.3 à 7.5) :
//      – équipe qui pulle : l'équipe qui reçoit laisse tomber le disque et joue comme si elle avait appelé « brick » ;
//      – équipe qui reçoit : reprise arrêtée (check) : la défense a le temps de se placer avant le premier lancer ;
//  • ne rien faire : départ normal, comme avant.
// Une équipe IA (sans humain) part parfois trop tôt, plus souvent en facile.
const START = { LIGHT: 0.5, N: 3, GOOD: 0.25, BOOST_T: 1.8, BOOST_K: 1.35, CHECK_T: 2.5, AI_OFF: 0.045 };
// (aussi quand un humain pulle : une fois sa jauge arrêtée, le compte à rebours part pour tous les autres joueurs humains,
//  coéquipiers compris — son pull part au « PULL ! »)
const startOn = () => !G.attract && !G.tuto && !G.practice && !!G.pull && (G.pull.by == null ? G.humans.some(h => h.team === 0 || h.team === 1)
  : !!G.pull.pend && G.humans.some(h => (h.team === 0 || h.team === 1) && h.id !== G.pull.by));
const lightsOn = cd => (cd == null || cd < 0 ? 0 : Math.min(START.N, Math.floor(cd / START.LIGHT) + 1));
const pullerOffside = () => !!G.offside && G.offside.team === 1 - G.receiving;
function startTick(dt) {
  const P = G.pull;
  if (P.cd == null) {                                          // un court temps avant le 1er feu ; l'IA tire son éventuel faux départ
    P.cd = -0.5;
    const d = P.team, L = aiLvl(d);
    if (!teamHumans(d).length && Math.random() < START.AI_OFF * (L.react || 1) ** 2) {
      const c = TEAMS[d].filter(p => p !== disc.holder);
      P.aiOff = { at: rand(0.7, 1.35), p: c[Math.floor(Math.random() * c.length)] };
    }
  }
  const was = lightsOn(P.cd); P.cd += dt; const now = lightsOn(P.cd);
  if (now > was) try { SOUNDS.tick(); } catch (e) { }
  if (P.aiOff && !G.offside && P.cd >= P.aiOff.at) offside(P.team, P.aiOff.p, false);
  if (P.cd >= START.N * START.LIGHT) { try { SOUNDS.tickHi(); } catch (e) { } G.startGo = G.time; const pd = P.pend; if (pd) { P.pend = null; launchPull(pd.x, pd.y, pd.curve, pd.q); } else aiPull(); }
}
// hors-jeu de l'équipe t (p : le joueur qui est parti trop tôt, il fait un pas au-delà de sa ligne)
function offside(t, p, human) {
  if (G.offside) return;
  G.offside = { team: t };
  if (p) { p.tx = clamp(p.x + dirOf(t) * 5.5, 1, W - 1); p.ty = p.y; fxEvent('offside', p.x, p.y, t); }   // il part trop tôt, s'arrête… et s'en veut
  const pt = G.pull ? G.pull.team : 1 - G.receiving;
  flash((human ? 'Faux départ ! ' : '') + `Offside des ${tn(t)}`, true);   // (le détail est dans le bandeau sous le compte à rebours)
  try { whistle(); } catch (e) { }
}
// hors-jeu de l'équipe qui pulle (7.5.2) : l'équipe qui reçoit joue « comme si elle avait appelé brick »
function offsideSpot() { const r = G.receiving; return { x: brickX(r), y: H / 2 }; }
// fenêtre où un appui sert au départ (pendant les feux, ou juste après le vert)
function startWindow() {
  if (G.net === 'guest') { const s = G.netStart; return !!s && (s[0] > 0 || (s[1] >= 0 && s[1] <= START.GOOD + 0.1)); }
  if (G.phase === 'pull' && G.pull && G.pull.cd != null) return G.pull.cd >= 0;
  return G.phase === 'play' && G.startGo != null && G.time - G.startGo <= START.GOOD;
}
// appui d'un joueur (clic, tape, Espace, A, ou message d'un invité) : true s'il a servi au départ (il ne fait alors rien d'autre)
function startPress(h) {
  h = h || meH();
  if (!h || (h.team !== 0 && h.team !== 1) || (h.id === G.myId && G.spectator) || !startWindow()) return false;
  if (G.pull && G.pull.by != null && G.pull.by === h.id) return false;   // le pulleur lui-même ne prend pas le départ
  if (G.net === 'guest') {
    if (!h.startDone) { h.startDone = true; netSend({ t: 'start' }); const s = G.netStart; if (s && s[0] === 0 && s[1] >= 0 && s[1] <= START.GOOD) unlock('start'); }
    return true;
  }
  if (h.startDone) return true;
  if (G.phase === 'pull') {
    if (lightsOn(G.pull.cd) < 2) return true;                   // 1er feu : trop tôt pour compter (l'appui ne fait rien)
    h.startDone = true;
    offside(h.team, h.sel || nearest(TEAMS[h.team].filter(p => p !== disc.holder), goalLine(h.team), H / 2), true);
    return true;
  }
  h.startDone = true;                                          // au vert : départ parfait pour son équipe
  for (const p of TEAMS[h.team]) if (!controllerOf(p) || controllerOf(p) === h) p.boostT = START.BOOST_T;
  if (h.id === G.myId) { flash('Départ parfait ! 🚀', true); if (!G.tuto) unlock('start'); } else flash(`${humanLabel(h)} : départ parfait ! 🚀`, true);
  try { SOUNDS.qte(0.9); } catch (e) { }
  return true;
}
// état pour les invités : [feux allumés (0 à 3), secondes depuis le vert (-1 : pas de vert)]
function startNet() {
  const n = G.phase === 'pull' && G.pull ? lightsOn(G.pull.cd) : 0, go = G.startGo != null && G.phase === 'play' ? G.time - G.startGo : -1;
  return n || (go >= 0 && go < 1) ? [n, go >= 0 && go < 1 ? +go.toFixed(2) : -1] : 0;
}
// compte à rebours du départ (au-dessus du terrain), façon panneau de score : 3, 2, 1 en points lumineux, puis « PULL ! »
// (pour l'IA qui pulle ; l'appui pile au « PULL » donne un départ parfait) — et bandeau du check
function ledDraw(c, txt, cx, cy, dot) {
  const ds = String(txt).split(''), w = ds.length * 6 - 1;
  const x0 = cx - w * dot / 2, y0 = cy - 3.5 * dot;
  ds.forEach((ch, k) => {
    const f = (typeof LED_FONT !== 'undefined' && LED_FONT[+ch]) || '';
    for (let i = 0; i < 35; i++) {
      const on = f[i] === '1'; c.fillStyle = on ? '#ffd23f' : 'rgba(255,190,60,.1)';
      c.beginPath(); c.arc(x0 + (k * 6 + (i % 5) + 0.5) * dot, y0 + (Math.floor(i / 5) + 0.5) * dot, dot * 0.4, 0, 7); c.fill();
    }
  });
}
function drawStartUI() {
  const st = G.net === 'guest' ? G.netStart : startNet();
  const fs = Math.max(11, S * 1.5);
  if (st) inScreen(() => {
    const [n, go] = st, pull = go >= 0 && go < 0.6, cx = X(W / 2), cy = SY(7), dot = Math.max(3, CAM.S0 * 0.42), ph = dot * 9.5, pw = pull ? dot * 26 : dot * 9;
    if (!pull && !(n > 0)) return;                                // entre le « PULL ! » et la fin : rien (pas de panneau vide)
    ctx.save();
    ctx.fillStyle = '#05070d'; ctx.strokeStyle = '#1c2438'; ctx.lineWidth = 2;                    // le panneau
    roundRectPath(cx - pw / 2, cy - ph / 2, pw, ph, dot * 1.2); ctx.fill(); ctx.stroke();
    ctx.shadowColor = 'rgba(255,180,30,.85)'; ctx.shadowBlur = dot * 0.9;
    if (pull) {
      ctx.fillStyle = '#ffd23f'; ctx.font = `800 ${Math.round(dot * 6.4)}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PULL !', cx, cy + dot * 0.3);
    } else if (n > 0) ledDraw(ctx, START.N - n + 1, cx, cy, dot);
    ctx.restore();
    if (n > 0 && !(G.net === 'guest' ? G.netOffside === 0 || G.netOffside === 1 : G.offside)) {   // (après un hors-jeu, le bandeau prend sa place)
      ctx.font = `600 ${fs * 0.75}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#f8fafc';
      ctx.fillText(isTouchUI() ? 'Tape au « PULL » : départ parfait · trop tôt = hors-jeu' : 'Clic ou Espace au « PULL » : départ parfait · trop tôt = hors-jeu', cx, cy + ph / 2 + fs * 1.1);
    }
  });
  drawOffsideCall();
  // hors-jeu : bandeau jusqu'à la reprise (le message central passe vite)
  const off = G.net === 'guest' ? G.netOffside : G.offside && G.offside.team;
  if (off === 0 || off === 1) inScreen(() => {
    const pt = G.pull ? G.pull.team : 1 - G.receiving;
    const t = `Offside des ${tn(off)} : ` + (off === pt ? `les ${tn(1 - off)} laissent tomber le disque et repartiront du brick` : 'check à la réception');
    ctx.font = `700 ${fs * 0.85}px system-ui`; ctx.textAlign = 'center';
    const w = ctx.measureText(t).width + fs * 1.4, y = SY(11.5);   // sous le compte à rebours (le bas est pour les conseils du coach)
    ctx.fillStyle = 'rgba(127,29,29,.85)'; ctx.fillRect(X(W / 2) - w / 2, y - fs * 1.0, w, fs * 1.5);
    ctx.fillStyle = '#fee2e2'; ctx.fillText(t, X(W / 2), y);
  });
  const ck = G.net === 'guest' ? G.netCheck : G.checkT;
  if (ck > 0 && G.phase === 'play') inScreen(() => {
    ctx.font = `700 ${fs}px system-ui`; ctx.textAlign = 'center';
    const t = `Check… ${Math.ceil(ck)}`, w = ctx.measureText(t).width + fs * 1.4;
    ctx.fillStyle = 'rgba(15,23,42,.75)'; ctx.fillRect(X(W / 2) - w / 2, SY(2.5) - fs * 1.1, w, fs * 1.6);
    ctx.fillStyle = '#fde68a'; ctx.fillText(t, X(W / 2), SY(2.5));
  });
}

// ---------- affichage (visée, jauge) ----------
function drawPullUI() {
  if (G.phase !== 'pull' || !disc.holder) return;
  const h = disc.holder, fs = Math.max(11, S * 1.5);
  ctx.save(); ctx.textAlign = 'center';
  const label = (txt, y) => inScreen(() => {                 // bandeau à l'écran (redressé en vue inclinée)
    ctx.font = `700 ${fs}px system-ui`; ctx.textAlign = 'center';
    const w = ctx.measureText(txt).width + fs * 1.4;
    ctx.fillStyle = 'rgba(15,23,42,.72)'; ctx.fillRect(X(W / 2) - w / 2, y - fs * 1.1, w, fs * 1.6);
    ctx.fillStyle = '#f8fafc'; ctx.fillText(txt, X(W / 2), y);
  });
  if (!pullReady()) {
    label(G.pull && G.pull.team === G.me && !G.spectator ? 'Mise en place pour le pull…' : 'L’autre équipe se met en place…', SY(2.5) + fs);
    ctx.restore(); return;
  }
  const left = pullLeft();                                     // pulleur humain : temps avant le pull automatique
  if (left != null) inScreen(() => {
    ctx.font = `600 ${fs * 0.8}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = left <= 10 ? '#fbbf24' : 'rgba(248,250,252,.8)';
    ctx.fillText(`Pull automatique dans ${left} s`, X(W / 2), SY(2.5) + fs * 2.4);
  });
  if (!localPuller()) {
    const by = G.pull && G.pull.by != null && humanById(G.pull.by);
    label(G.pull && G.pull.team === G.me && !G.spectator ? (by ? `${humanLabel(by)} prépare le pull…` : 'Ton équipe prépare le pull…')
      : by ? `${humanLabel(by)} prépare son pull…` : 'L’adversaire prépare son pull…', SY(2.5) + fs);
    ctx.restore(); return;
  }
  const ui = G.pullUI;
  let ax, ay;
  if (ui.stage === 'aim') {
    ax = G.pointer.active ? G.pointer.x : h.x + dirOf(h.team) * 50; ay = G.pointer.active ? G.pointer.y : H / 2;
    [ax, ay] = clampPullAim(h, ax, ay);
  } else { ax = ui.x; ay = ui.y; }
  // trajectoire d'un pull parfait (avec la dérive du vent)
  const [cx, cy] = ctrlFor(h.x, h.y, ax, ay, G.curve), [wx, wy] = drift(4.2);
  ctx.setLineDash([7, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(250,204,21,.9)';
  ctx.beginPath(); ctx.moveTo(X(h.x), Y(h.y)); ctx.quadraticCurveTo(X(cx), Y(cy), X(ax + wx), Y(ay + wy)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(250,204,21,.9)'; ctx.fillStyle = 'rgba(250,204,21,.15)';
  circle(X(ax + wx), Y(ay + wy), 2.5 * S); ctx.fill(); ctx.stroke();
  if (Math.hypot(wx, wy) > 0.8) {
    const k = 5; ctx.strokeStyle = 'rgba(125,211,252,.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(ax) - k, Y(ay) - k); ctx.lineTo(X(ax) + k, Y(ay) + k); ctx.moveTo(X(ax) + k, Y(ay) - k); ctx.lineTo(X(ax) - k, Y(ay) + k); ctx.stroke();
  }
  if (ui.stage === 'aim') {
    label(isTouchUI() ? 'Pull : pose le doigt n’importe où et glisse pour viser (courbe : bord droit)' : 'Pull : clique sur la zone visée (courbe : A/E ou molette)', SY(2.5) + fs);
  } else inScreen(() => {
    // jauge QTE (à l'écran)
    const bw = Math.min(W * 0.45 * S, 420), bh = Math.max(14, S * 1.6), bx = X(W / 2) - bw / 2, by = SY(H - 3.5);
    const [p0, p1] = PULL.PERFECT, g = gaugePos();
    ctx.fillStyle = 'rgba(15,23,42,.8)'; ctx.fillRect(bx - 6, by - 6, bw + 12, bh + 12);
    const grad = ctx.createLinearGradient(bx, 0, bx + bw * p0, 0);
    grad.addColorStop(0, '#475569'); grad.addColorStop(1, '#eab308');
    ctx.fillStyle = grad; ctx.fillRect(bx, by, bw * p0, bh);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(bx + bw * p0, by, bw * (p1 - p0), bh);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(bx + bw * p1, by, bw * (1 - p1), bh);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * g - 3, by - 5, 6, bh + 10);
    label(ui.stage === 'sent' ? (g >= p0 && g <= p1 ? 'Parfait !' : g > p1 ? 'Trop fort !' : 'Trop tôt…')
      : (isTouchUI() ? 'Tape pour arrêter la jauge dans le vert !' : 'Clique ou Espace pour arrêter la jauge dans le vert !'), by - fs * 0.9);
  });
  ctx.restore();
}
const isTouchUI = () => typeof document !== 'undefined' && document.body && document.body.classList && document.body.classList.contains('touch');

// hors-jeu : un joueur de l'équipe adverse surgit en grand et fait le signe officiel (WFDF) : les deux bras croisés en X
// au-dessus de la tête, poings fermés — « OFFSIDE ! » (pendant ~2,5 s ; G.offFx posé par l'effet « offside », fx.js)
function drawOffsideCall() {
  const F = G.offFx; if (!F) return;
  const a = G.time - F.t0; if (a > 2.6) { G.offFx = null; return; }
  inScreen(() => {
    const cw = canvas.width / dpr, ch = canvas.height / dpr, u = Math.max(26, Math.min(cw, ch) * 0.09);
    const pop = a < 0.25 ? 1 - (1 - a / 0.25) ** 3 : 1, fade = a > 2.2 ? 1 - (a - 2.2) / 0.4 : 1;
    const cx = cw * 0.5, cy = ch * 0.56 + (1 - pop) * u * 3, k = pop * (1 + 0.04 * Math.sin(a * 9));
    const col = teamColor(1 - F.team), dark = tdark(1 - F.team), skin = '#e8b88f';
    ctx.save(); ctx.globalAlpha = Math.max(0, fade); ctx.translate(cx, cy); ctx.scale(k, k); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // le signe officiel (style illustration à plat, contours foncés) : buste, bras levés, avant-bras croisés en X
    // au-dessus de la tête, mains ouvertes
    const OL = '#1f2937', ow = Math.max(2, u * 0.07), sw = Math.sin(Math.min(1, a / 0.35) * Math.PI / 2), hair = '#f4c542';
    const outl = () => { ctx.strokeStyle = OL; ctx.lineWidth = ow; ctx.stroke(); };
    ctx.beginPath(); ctx.moveTo(-u * 0.82, u * 1.25); ctx.lineTo(-u * 0.92, u * 0.5);                      // buste (maillot de l'équipe qui l'annonce)
    ctx.quadraticCurveTo(-u * 0.9, u * 0.05, -u * 0.35, u * 0.02); ctx.lineTo(u * 0.35, u * 0.02); ctx.quadraticCurveTo(u * 0.9, u * 0.05, u * 0.92, u * 0.5);
    ctx.lineTo(u * 0.82, u * 1.25); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); outl();
    ctx.beginPath(); ctx.moveTo(-u * 0.2, u * 0.02); ctx.quadraticCurveTo(0, u * 0.3, u * 0.2, u * 0.02); ctx.fillStyle = skin; ctx.fill(); outl();   // encolure
    ctx.beginPath(); ctx.ellipse(-u * 0.08, -u * 0.5, u * 0.5, u * 0.45, 0, 0, 7); ctx.fillStyle = hair; ctx.fill(); outl();   // queue de cheval (derrière)
    ctx.beginPath(); ctx.ellipse(0, -u * 0.42, u * 0.36, u * 0.44, 0, 0, 7); ctx.fillStyle = '#fbe3cf'; ctx.fill(); outl();   // visage
    ctx.beginPath(); ctx.ellipse(0, -u * 0.62, u * 0.38, u * 0.28, 0, Math.PI, Math.PI * 2); ctx.quadraticCurveTo(u * 0.05, -u * 0.6, -u * 0.38, -u * 0.62); ctx.fillStyle = hair; ctx.fill(); outl();   // frange
    ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(-u * 0.13, -u * 0.38, u * 0.04, 0, 7); ctx.arc(u * 0.13, -u * 0.38, u * 0.04, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -u * 0.18, u * 0.07, u * 0.06, 0, 0, 7); ctx.fill();                   // bouche ouverte : il l'annonce
    // bras : épaule → coude (à côté de la tête) → poignets croisés au-dessus → mains ouvertes ; de bas (repos) à levés
    const L = (r, f) => r + (f - r) * sw, aw = u * 0.3;
    const arm = sd => {
      const sh = [sd * u * 0.8, u * 0.3], el = [sd * L(u * 1.2, u * 1.08), L(u * 0.9, -u * 0.7)], hd = [-sd * L(-u * 1.1, u * 0.5), L(u * 1.4, -u * 1.72)];
      const path = () => { ctx.beginPath(); ctx.moveTo(...sh); ctx.lineTo(...el); ctx.lineTo(...hd); };
      path(); ctx.strokeStyle = OL; ctx.lineWidth = aw + ow * 2; ctx.stroke();
      path(); ctx.strokeStyle = sd < 0 ? col : col; ctx.lineWidth = aw; ctx.stroke();                     // manches
      ctx.beginPath(); const m = [(sh[0] + el[0] * 2) / 3, (sh[1] + el[1] * 2) / 3]; ctx.moveTo(...m); ctx.lineTo(...el); ctx.lineTo(...hd);
      ctx.strokeStyle = skin; ctx.lineWidth = aw - ow * 0.2; ctx.stroke();                                // avant-bras nus
      const ang = Math.atan2(hd[1] - el[1], hd[0] - el[0]);                                               // main ouverte, doigts serrés
      ctx.save(); ctx.translate(...hd); ctx.rotate(ang);
      ctx.beginPath(); ctx.ellipse(u * 0.12, 0, u * 0.22, u * 0.15, 0, 0, 7); ctx.fillStyle = skin; ctx.fill(); outl();
      ctx.beginPath(); ctx.ellipse(u * 0.02, sd * u * 0.14, u * 0.1, u * 0.055, sd * 0.6, 0, 7); ctx.fill(); outl();   // pouce
      ctx.restore();
    };
    arm(1); arm(-1);                                                                                      // le bras gauche passe devant au croisement
    // « OFFSIDE ! » dans une bulle
    ctx.font = `800 ${Math.round(u * 0.62)}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText('OFFSIDE !').width, bx = u * 1.45 + tw / 2, by = -u * 1.75;
    ctx.fillStyle = '#fff'; roundRectPath(bx - tw / 2 - u * 0.3, by - u * 0.45, tw + u * 0.6, u * 0.9, u * 0.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - tw / 2, by + u * 0.3); ctx.lineTo(bx - tw / 2 - u * 0.5, by + u * 0.75); ctx.lineTo(bx - tw / 2 + u * 0.35, by + u * 0.42); ctx.fill();
    ctx.fillStyle = '#b91c1c'; ctx.fillText('OFFSIDE !', bx, by + 1);
    ctx.restore();
  });
}
