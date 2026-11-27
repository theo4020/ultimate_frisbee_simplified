// daily.js — Défi du jour : le même pour tout le monde, un essai officiel par jour, des scores à partager.
// Chaque jour, 4 épreuves :
//  1. Trouve la passe (5 contre 5) : les 4 receveurs font chacun une coupe écrite d'avance (la même pour tous : où et
//     quand), les défenseurs les suivent. Une seule passe, au bon moment, la plus longue possible vers l'en-but.
//     Score : les mètres gagnés (0 si elle est perdue ou si le compte arrive au bout). Le plus grand gagne.
//  2. Attaque (5 contre 5) : marquer depuis la situation donnée, sans limite de temps. Une perte de disque ajoute
//     DAILY.PEN s et on te rend le disque là où il a été perdu. Score : le temps (le plus petit gagne).
//  3. Défense (3 contre 3) : la ligne avance à chaque passe reçue par l'adversaire (elle ne recule pas sur une passe en
//     arrière). S'il marque : DAILY.GOAL m de plus et on rejoue, jusqu'à ce que ta défense récupère le disque (au plus
//     DAILY.MAXG points encaissés). Score : les mètres concédés (le plus petit gagne).
//  4. L'épreuve du jour, qui change chaque jour (DAILY_X) : une variante rapide d'une des épreuves (garder le disque,
//     enchaîner les passes, huck, jeu ralenti ou accéléré, défense en infériorité numérique).
// Les situations sont tirées à partir du numéro du jour (même tirage pour tous) ; pendant le défi, le hasard du jeu (IA,
// rafales) part du même tirage pour tout le monde, puis suit ce que chacun fait. Le jour change à minuit, heure de Paris.

const DAILY = { EPOCH: Date.UTC(2026, 10, 19), PEN: 10, GOAL: 80, MAXG: 3, KEEP: 90, PASSES: 30, BKEEP: 15, BPASS: 5, KEY: 'uf-daily2', ARCH: 'uf-daily2-arch' };   // jour n° 1 : le 19 novembre 2026 · ARCH : défis passés rejoués (archives)
const DAILY_NAMES = { pass: 'Trouve la passe', att: 'Attaque', def: 'Défense' };
const DAILY_ICON = { pass: '🎯', att: '⏱', def: '📏' };
// l'épreuve du jour : base = la façon de jouer et de compter (voir dailyFrame, dailyTurn, dailyScored)
const DAILY_X = {
  keep: { base: 'keep', name: 'Garde le disque', icon: '🔒', lvl: 'difficile', boost: true, d: [38, 48],
    how: `Garde le disque le plus longtemps possible contre des adversaires au niveau maximum, plus rapides que d'habitude. Défense individuelle : pas de passe facile. Tu marques : <b>+${DAILY.BKEEP} s de bonus</b>, on repart et le chrono continue (${DAILY.KEEP} s de jeu au plus).` },
  huck: { base: 'huck', name: 'Huck', icon: '🚀', d: [58, 64],
    how: 'Depuis ton camp, marque en 2 passes au plus. Score : le terrain gagné (0 si tu perds le disque).' },
  slow: { base: 'att', name: 'Ralenti', icon: '🐢', lvl: 'difficile', speed: 0.6, d: [34, 46],
    how: 'Le jeu tourne à 60 % de sa vitesse : plus facile à lire, mais l\'adversaire est au niveau maximum. Marque le plus vite possible (temps de jeu).' },
  passes: { base: 'passes', name: 'Passes', icon: '🔁', lvl: 'difficile', boost: true, d: [38, 48],
    how: `Enchaîne le plus de passes possible contre des adversaires au niveau maximum, plus rapides, en défense individuelle, jusqu'à la première perte (${DAILY.PASSES} au plus). Tu marques : <b>+${DAILY.BPASS} passes de bonus</b> et on repart.` },
  outnum: { base: 'def', name: 'Défense en infériorité', icon: '🫣', lvl: 'facile', n: [3, 4], d: [45, 55],
    how: '3 contre 4 : ils sont faibles mais plus nombreux. La ligne avance à chaque passe ; un point encaissé, +80 m et on rejoue.' },
  fast: { base: 'att', name: 'Accéléré', icon: '⏩', speed: 1.5, d: [34, 46],
    how: 'Le jeu tourne 50 % plus vite. Marque le plus vite possible (temps de jeu).' },
  high: { base: 'att', name: 'Que des passes hautes', icon: '🎢', loft: LOFT.MAX, d: [34, 46],
    how: `Toutes tes passes partent en passe haute. Marque le plus vite possible ; une perte de disque, +${DAILY.PEN} s.` },
  nocurve: { base: 'att', name: 'Sans courbe', icon: '➡️', nocurve: true, d: [34, 46],
    how: `Seulement des passes droites, sans courbe. Marque le plus vite possible ; une perte de disque, +${DAILY.PEN} s.` },
  stall5: { base: 'att', name: 'Stall court', icon: '⏳', stall: 5, d: [34, 46],
    how: `Le compte s'arrête à 5 au lieu de 10 : lance vite ! Marque le plus vite possible ; une perte de disque, +${DAILY.PEN} s.` },
  crazy: { base: 'att', name: 'Vent fou', icon: '🌪️', crazy: true, d: [34, 46],
    how: `Le vent (20 à 28 km/h) change de direction à chaque passe. Marque le plus vite possible ; une perte de disque, +${DAILY.PEN} s.` },
  oneone: { base: 'oneone', name: '1 contre 1', icon: '🧍', d: [40, 50],
    how: 'Tu défends seul sur leur meilleur coupeur (pas de changement de joueur). Score : les passes qu\'il reçoit ; s\'ils marquent, +2 et on rejoue (3 points au plus), jusqu\'à ce que ta défense récupère le disque.' }
};
const DAILY_X_ORDER = ['keep', 'huck', 'slow', 'oneone', 'high', 'passes', 'outnum', 'nocurve', 'fast', 'stall5', 'crazy'];
// nom et icône d'une épreuve (ou d'un résultat), épreuve du jour comprise
const dailyName = s => (s.x ? DAILY_X[s.x].name : DAILY_NAMES[s.type]);
const dailyIcon = s => (s.x ? DAILY_X[s.x].icon : DAILY_ICON[s.type]);

// numéro du défi d'une date : le jour à Paris (le même pour tout le monde, il change à minuit heure française)
function dailyNum(d) {
  d = d || new Date();
  let y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  try { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).split('-'); y = +p[0]; m = +p[1] - 1; day = +p[2]; } catch (e) { }
  return Math.floor((Date.UTC(y, m, day) - DAILY.EPOCH) / 864e5) + 1;
}
// petit générateur de hasard réglé (le même tirage partout)
function dailyRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// mélange (Fisher-Yates) : le même sur tous les navigateurs (un tri au hasard dépend du navigateur)
function dailyShuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// les 4 épreuves du jour n (d : distance du porteur à l'en-but qu'il attaque)
// forceX : une épreuve du jour imposée (épreuve libre)
function dailyGen(n, forceX) {
  const r = dailyRng(n * 7919 + 17), R = (a, b) => a + (b - a) * r(), P = o => o[Math.floor(r() * o.length)];
  const x = forceX || DAILY_X_ORDER[((n - 1) % DAILY_X_ORDER.length + DAILY_X_ORDER.length) % DAILY_X_ORDER.length], X0 = DAILY_X[x];
  const sits = [['pass', 40, 58], ['att', 34, 46], ['def', 40, 55], [X0.base, X0.d[0], X0.d[1], x]].map(([type, d0, d1, xk], k) => {
    const kmh = r() < 0.25 ? 0 : Math.round(R(6, 26)), a = Math.floor(r() * 8) * Math.PI / 4;
    const s = { type, k, d: Math.round(R(d0, d1)), y: Math.round(R(7, H - 7)), wind: { x: Math.cos(a) * kmh / 3.6, y: Math.sin(a) * kmh / 3.6, kmh },
      def: type === 'att' || type === 'keep' || type === 'passes' || type === 'huck' ? P(['man', 'man', 'zone', 'clam']) : 'man', force: P(['haut', 'bas', 'middle', 'straight']), off: P(['vert', 'ho', 'side']) };
    if (type === 'keep' || type === 'passes') s.def = 'man';     // garder le disque : en zone, on se ferait des passes sans fin sans avancer
    if (xk) s.x = xk;
    return s;
  });
  return { n, sits };
}

// ---------- résultats gardés dans le navigateur ----------
const dailyAll = () => { const o = storeGet(DAILY.KEY, {}); return o && typeof o === 'object' ? o : {}; };
const dailyDone = n => dailyAll()[n] || null;
const dailyArch = () => { const o = storeGet(DAILY.ARCH, {}); return o && typeof o === 'object' ? o : {}; };
const dailyDate = n => new Date(DAILY.EPOCH + (n - 1) * 864e5).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
function dailyStreak() {
  const all = dailyAll(); let n = dailyNum(), k = 0;
  if (!all[n]) n--;                                            // pas encore joué aujourd'hui : la série d'hier compte encore
  while (all[n]) { k++; n--; }
  return k;
}
// l'épreuve d'un résultat (r.k : sa place dans le défi du jour ; anciens résultats : leur rang)
const dailySitOf = (n, r, i) => dailyGen(n).sits[r.k !== undefined ? r.k : i];
// cases du partage, selon l'épreuve
function dailyMark(type, v, s) {
  if (type === 'pass') return v >= 25 ? '🟩' : v >= 12 ? '🟨' : '🟥';
  if (type === 'att') { const par = 6 + s.d / 4; return v <= par ? '🟩' : v <= par * 2 ? '🟨' : '🟥'; }
  if (type === 'keep') return v >= 60 ? '🟩' : v >= 25 ? '🟨' : '🟥';
  if (type === 'passes') return v >= 12 ? '🟩' : v >= 5 ? '🟨' : '🟥';
  if (type === 'huck') return v >= s.d - 0.5 ? '🟩' : v >= s.d * 0.5 ? '🟨' : '🟥';
  if (type === 'oneone') return v <= 1 ? '🟩' : v <= 3 ? '🟨' : '🟥';
  const k = s && s.x === 'outnum' ? 2 : 1;                     // défense
  return v <= 8 * k ? '🟩' : v <= 25 * k ? '🟨' : '🟥';
}
function dailyFmt(type, v) {
  if (type === 'att' || type === 'keep') return v.toFixed(1) + ' s';
  if (type === 'passes') return Math.round(v) + (Math.round(v) > 1 ? ' passes' : ' passe');
  if (type === 'oneone') return Math.round(v) + (Math.round(v) > 1 ? ' réceptions' : ' réception');
  return Math.round(v) + ' m';
}
// le titre de la journée (repris dans le partage) : ce qu'on a fait de mieux
function dailyTitle(n, res) {
  const S = res.map((r, i) => dailySitOf(n, r, i)), M = res.map((r, i) => dailyMark(r.type, r.v, S[i])), g = M.filter(m => m === '🟩').length;
  const has = (t, f) => res.some((r, i) => r.type === t && f(r.v, S[i]));
  if (res.length >= 4 && g === res.length) return '🏆 Journée parfaite';
  if (has('pass', v => v >= 35)) return '🚀 Huckeur fou';
  if (has('huck', (v, s) => v >= s.d - 0.5)) return '🎯 Missile';
  if (has('def', (v, s) => v <= 3 && s.x !== 'outnum')) return '🧱 Mur défensif';
  if (has('att', (v, s) => v <= (6 + s.d / 4) * 0.6)) return '⚡ Éclair';
  if (has('keep', v => v >= DAILY.KEEP)) return '🔒 Coffre-fort';
  if (has('passes', v => v >= 20)) return '🔁 Métronome';
  if (has('oneone', v => v === 0)) return '🕶️ Ombre';
  if (g >= 2) return '💪 Belle journée';
  if (!g) return '🌱 Ça ira mieux demain';
  return '🥏 Joueur du jour';
}

// ---------- le défi en jeu ----------
// only : une seule épreuve (son rang) ; free : épreuve libre (situation au hasard, rien n'est gardé ni partagé)
function dailyStart(n, official, only, free) {
  backToSolo();
  G.series = null; G.ms = null;
  const gen = free ? free.gen : dailyGen(n);
  if (only !== undefined) gen.sits = [gen.sits[only]];
  G.daily = Object.assign(gen, { official: official && only === undefined, i: 0, res: [], wait: 0, after: null, t: 0, pen: 0, turns: 0, goals: 0, line: 0, x0: 0, gain: 0, passes: 0, recv: 0, bonus: 0, thrown: false, cont: false, free: !!free, freeX: free ? free.x : null, lockP: null, man: null, stallMax: 10,
    keep: { form: Object.assign({}, G.form), ai: Object.assign({}, G.ai), rnd: Math.random }, bench: null, nb: [5, 5], boost: false });
  Object.assign(G.form, { level: 'normal', allyLevel: 'normal', play: 'none', dplay: 'none', points: '99' });   // mêmes adversaires et coéquipiers pour tous
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard', 'dailyCard', 'endlessCard']) $(id).style.display = 'none';
  $('overlay').classList.add('hidden'); G.menuShown = false;
  $('dailyBox').style.display = '';
  newMatchStats(); dailySit(); dailyIntro(); resize();
}
// joueurs sur le terrain : nb = [ton équipe, l'adversaire] (défense : 3 contre 3, ou 3 contre 4) ; les autres sur le banc
function dailyBench(nb) {
  const D = G.daily;
  if (D.nb[0] === nb[0] && D.nb[1] === nb[1]) return;
  if (D.bench) {                                               // d'abord tout le monde revient
    for (const b of D.bench) TEAMS[b.team].push(b);
    for (const t of [0, 1]) TEAMS[t].sort((a, b) => a.i - b.i);
    D.bench = null;
  }
  if (nb[0] < 5 || nb[1] < 5) { D.bench = []; for (const t of [0, 1]) D.bench.push(...TEAMS[t].splice(nb[t])); }
  players.length = 0; for (const t of [0, 1]) players.push(...TEAMS[t]);
  for (const t of [0, 1]) G.order[t] = [];
  G.form.def = nb[0] < 5 ? 'man' : D.keep.form.def;
  D.nb = nb.slice();
  visReset();
}
const dailySitNow = () => G.daily.sits[G.daily.i];
const dailyType = () => dailySitNow().type;
// mise en place de l'épreuve en cours (ou rejouée : point encaissé en défense, point marqué en « garde le disque »)
function dailySit() {
  const D = G.daily, s = D.sits[D.i], X0 = s.x ? DAILY_X[s.x] : {}, a = s.type === 'def' || s.type === 'oneone' ? 1 : 0, d = 1 - a;
  const again = D.cont || D.goals > 0;
  dailyBench(s.type === 'def' ? X0.n || [3, 3] : [5, 5]);
  Math.random = dailyRng(D.n * 1009 + s.k * 101 + D.goals * 13 + (D.cont ? 977 : 0) + 7);   // le même hasard pour tout le monde, au départ
  G.form.level = X0.lvl || 'normal'; D.boost = !!X0.boost;    // adversaires de l'épreuve du jour (humans.js : aiLvl)
  D.stallMax = X0.stall || 10; D.lockP = null; D.man = null;   // stall court (sim.js) ; 1 contre 1 : ton défenseur, sans changement (humans.js)
  if (s.type === 'oneone') G.form.def = 'man';
  SPEEDS.daily = SPEEDS.normal * (X0.speed || 1); G.form.speed = X0.speed ? 'daily' : D.keep.form.speed;   // jeu ralenti / accéléré
  G.score = [0, 0]; G.wind = Object.assign({}, s.wind); G.gt = 0;
  Object.assign(G.ai, { off: s.off, def: s.def, force: s.force, play: 'none', dplay: 'none', restart: 'pose' });
  Object.assign(G, { phase: 'play', oplay: null, dplay: null, pendingOPlay: null, pullPending: false, carryTo: null, stall: 0, marker: null, dbl: null, pickup: null, loft: LOFT.N, aiPlayTried: true });
  disc.pull = false;
  players.forEach(p => Object.assign(p, { vx: 0, vy: 0, dive: 0, down: 0, jump: 0, jprep: 0, jrec: 0, jumpCd: 0, react: 0, tag: '', windup: null, callTo: null, guess: null }));
  // le porteur, à s.d m de l'en-but qu'il attaque ; ses coéquipiers à leur place, la défense en place
  const dir = dirOf(a), line = dir > 0 ? W - EZ : EZ, h = TEAMS[a][0], open = -closedOf(d);
  h.x = line - dir * s.d; h.y = s.y; G.off = a;
  TEAMS[a].forEach((p, k) => { if (k) { p.x = h.x + dir * (6 + k * 3); p.y = [5, 13, 24, 32][k - 1]; } });
  for (let pass = 0; pass < 2; pass++) {
    holdDisc(h);
    for (const p of TEAMS[a]) {
      if (p === h) continue;
      const q = p.role === 'dump' ? dumpSlot(h.x, h.y, dir, open) : cutterSlot(p, a, h.x, h.y, dir, formOf(a));
      p.x = clamp(q.x, 1, W - 1); p.y = clamp(q.y, 1, H - 1);
    }
  }
  // trouve la passe : 4 receveurs à des profondeurs différentes, étalés en largeur
  const rr = dailyRng(D.n * 31 + 5);
  if (s.type === 'pass') {
    const depths = [[8, 13], [15, 21], [23, 30], [32, 40]], lanes = dailyShuffle([4, 13, 24, 33], rr);
    TEAMS[a].slice(1).forEach((p, k) => { const [d0, d1] = depths[k]; p.x = clamp(h.x + dir * (d0 + (d1 - d0) * rr()), 2, W - 2); p.y = clamp(lanes[k] + (rr() - 0.5) * 4, 2, H - 2); });
  }
  TEAMS[d].forEach((p, k) => { p.x = h.x + dir * (8 + k); p.y = H / 2 + (k - (TEAMS[d].length - 1) / 2) * 3; });
  setupDefense(d, h);
  const slots = zoneSlots(d, h.x, h.y, dir, -open);
  for (const p of TEAMS[d]) { defenderAI(p, h.x, h.y, dir, -open, defFormOf(d), slots); p.x = p.tx; p.y = p.ty; }
  D.cuts = null;
  if (s.type === 'pass') {
    // (les défenseurs collent à leur attaquant : c'est la coupe qui crée l'ouverture, un court instant)
    // les coupes : une par receveur, à tour de rôle (vers le disque, en profondeur, vers le côté open ou le côté break)
    const kinds = dailyShuffle(['under', 'deep', 'open', 'break'], rr), times = dailyShuffle([0.7, 2.0, 3.3, 4.6], rr);
    D.cuts = TEAMS[a].slice(1).map((p, k) => {
      const kd = kinds[k], side = kd === 'break' ? -open : open, sy = p.y < H / 2 ? 1 : -1;
      const fx = kd === 'under' ? -(5 + rr() * 4) : kd === 'deep' ? 13 + rr() * 8 : 3 + rr() * 5;
      const fy = kd === 'under' ? sy * (4 + rr() * 4) : kd === 'deep' ? -sy * rr() * 4 : side * (7 + rr() * 5);
      return { p, x0: p.x, y0: p.y, t0: times[k], kind: kd, x: clamp(p.x + dir * fx, 3, W - 3), y: clamp(p.y + fy, 2.5, H - 2.5) };
    });
  }
  if (s.type === 'oneone') {                                   // leur meilleur coupeur : le plus avancé (hors porteur) ; ton défenseur, celui qui le marque
    D.man = TEAMS[a].filter(p => p !== h).sort((p, q) => dirOf(a) * (q.x - p.x))[0];
    D.lockP = TEAMS[d].find(q => q.match === D.man) || nearest(TEAMS[d], D.man.x, D.man.y);
    D.lockP.x = D.man.x + dirOf(a) * 1.2; D.lockP.y = D.man.y;
  }
  holdDisc(h); visReset(); updateSelected();
  if (!D.goals && !D.cont) { D.t = 0; D.pen = 0; D.turns = 0; D.passes = 0; D.recv = 0; D.bonus = 0; }
  D.lastH1 = h;
  D.cont = false; D.line = 0; D.x0 = h.x; D.gain = 0; D.thrown = false; D.lastH = h;
  const tag = D.sits.length > 1 ? `${D.i + 1}/${D.sits.length} · ` : '';
  D.go = () => flash(tag + (s.x ? `${X0.icon} ${X0.name} !` : s.type === 'pass' ? 'Trouve la passe : regarde les coupes !' : s.type === 'att' ? `Marque ! (à ${s.d} m de l'en-but)` : D.goals ? 'On rejoue : défends !' : 'Défends : recule-les le moins possible'), true);
  if (again) D.go();                                           // (point rejoué : on repart tout de suite ; sinon, dailyIntro attend le joueur)
  dailyHud();
}
// avant chaque épreuve : ce qu'il faut faire, et le joueur lance quand il est prêt (le jeu attend)
const DAILY_DEF = { man: 'défense individuelle', zone: 'défense en zone', clam: 'défense « clam »' };
function dailyIntro() {
  const D = G.daily, s = dailySitNow(), X0 = s.x ? DAILY_X[s.x] : null;
  G.phase = 'daily'; D.wait = 0; D.intro = true;
  $('dIntroStep').textContent = D.free ? '🎲 Épreuve libre' : (D.sits.length > 1 ? `Épreuve ${D.i + 1} sur ${D.sits.length}` : `Défi #${D.n}`) + (s.x ? ' · l’épreuve du jour' : '');
  $('dIntroName').textContent = `${dailyIcon(s)} ${dailyName(s)}`;
  $('dIntroHow').innerHTML = X0 ? X0.how : DAILY_HOW[s.type];
  const att = s.type !== 'def' && s.type !== 'oneone', w = G.wind && G.wind.kmh ? `vent ${Math.round(G.wind.kmh)} km/h` : 'pas de vent';
  $('dIntroSit').textContent = [att ? `à ${s.d} m de l'en-but` : null, w, att ? 'en face : ' + (DAILY_DEF[s.def] || s.def) : null].filter(Boolean).join(' · ');
  $('dailyIntro').style.display = ''; dailyHud();
  setTimeout(() => { try { $('dIntroGo').focus(); } catch (e) { } }, 50);
}
function dailyIntroGo() {
  const D = G.daily; if (!D || !D.intro) return;
  D.intro = false; $('dailyIntro').style.display = 'none';
  G.phase = 'play'; D.go(); dailyHud();
}
function dailyFrame(dt) {
  const D = G.daily; if (!D) return;
  if (G.dailyPop && !G.replay) G.dailyPop.t += dt;
  if (D.wait > 0) { if (!G.replay) D.wait -= dt; if (D.wait <= 0) D.after(); return; }
  if (G.phase !== 'play' || G.paused) return;
  const type = dailyType(), s = dailySitNow();
  D.t += dt * SPEEDS[G.form.speed];
  const caught = (disc.mode === 'held' || disc.mode === 'carry') && disc.holder && disc.holder.team === 0 && disc.holder !== D.lastH;
  if (type === 'pass') {
    if (disc.mode === 'air') D.thrown = true;
    if (D.thrown && (disc.mode === 'held' || disc.mode === 'carry') && disc.holder && disc.holder.team === 0) { D.gain = Math.max(0, dirOf(0) * (disc.holder.x - D.x0)); dailyNext('Attrapé !'); return; }
  }
  if (caught) D.lastH = disc.holder;
  // épreuves du jour : passes hautes, sans courbe (imposées au lanceur), vent qui tourne à chaque passe
  const X0 = s.x ? DAILY_X[s.x] : {};
  if (X0.loft && canThrow() && G.loft !== X0.loft) setLoft(X0.loft, true);
  if (X0.nocurve && G.curve) setCurve(0);
  if (X0.crazy && caught) { const a = Math.random() * Math.PI * 2, kmh = 20 + Math.random() * 8; G.wind = { x: Math.cos(a) * kmh / 3.6, y: Math.sin(a) * kmh / 3.6, kmh }; flash('🌪️ Le vent tourne !', true); }
  if (D.lockP) for (const hh of teamHumans(D.lockP.team)) hh.sel = D.lockP;   // 1 contre 1 : pas de changement de joueur
  if (type === 'oneone' && disc.mode === 'held' && disc.holder && disc.holder.team === 1 && disc.holder !== D.lastH1) { if (disc.holder === D.man) D.recv++; D.lastH1 = disc.holder; }
  if (type === 'keep' && D.t >= DAILY.KEEP) { D.t = DAILY.KEEP; dailyNext('Coffre-fort ! 🔒'); return; }
  if (type === 'passes' && caught && ++D.passes >= DAILY.PASSES) { dailyNext('Quel enchaînement ! 🔁'); return; }
  if (type === 'huck' && caught) {
    D.passes++; D.gain = Math.max(D.gain, dirOf(0) * (disc.holder.x - D.x0));
    if (D.passes >= 2) { dailyNext('2 passes, pas de point'); return; }
  }
  if (type === 'def' && disc.mode === 'held' && disc.holder && disc.holder.team === 1) D.line = Math.max(D.line, dirOf(1) * (disc.x - D.x0));
  dailyHud();
}
// trouve la passe : avant la passe, les receveurs suivent leur coupe écrite (sim.js) ; ensuite, le jeu normal
function dailyPin(p) {
  const D = G.daily, c = D.cuts && !D.thrown && disc.mode === 'held' && D.cuts.find(q => q.p === p);
  if (!c) return false;
  if (D.t < c.t0) { p.tx = c.x0; p.ty = c.y0; p.sp = SPD.jog; }
  else { p.tx = c.x; p.ty = c.y; p.sp = SPD.cut * aiLvl(p.team).speed; }
  return true;
}
// adversaires « plus rapides que d'habitude » (épreuve du jour) : humans.js, aiLvl
const DAILY_BOOST = new Map();
function dailyBoost(L) {
  if (!DAILY_BOOST.has(L)) DAILY_BOOST.set(L, Object.assign({}, L, { speed: L.speed * 1.15, react: L.react * 0.8 }));
  return DAILY_BOOST.get(L);
}
// une pause courte (le message reste à l'écran ; un ralenti peut passer avant), puis la suite
function dailyPause(sec, fn) { const D = G.daily; G.phase = 'daily'; D.wait = sec; D.after = () => { G.phase = 'play'; fn(); }; }
function dailyVal() {
  const D = G.daily, t = dailyType();
  return t === 'pass' || t === 'huck' ? D.gain : t === 'att' ? D.t + D.pen : t === 'keep' ? Math.min(DAILY.KEEP, D.t) + D.bonus : t === 'passes' ? D.passes + D.bonus : t === 'oneone' ? D.recv + D.goals * 2 : D.line + D.goals * DAILY.GOAL;
}
// ---------- les moments forts : le score en grand, le public, un ralenti sur une belle passe ----------
const DAILY_PRAISE = { '🟩': ['Superbe !', 'Énorme !', 'Magnifique !'], '🟨': ['Pas mal !', 'Bien joué', 'Correct'], '🟥': ['Raté…', 'Aïe…', 'Ça arrive'] };
function dailyMoment(type, v, s, msg) {
  const m = dailyMark(type, v, s), praise = DAILY_PRAISE[m][Math.floor(G.time * 7) % 3];
  G.dailyPop = { big: dailyFmt(type, v), sub: `${msg} · ${praise}`, m, t: 0 }; G.msgT = 0;   // (le message va sous le score, pas par-dessus)
  try {
    const au = typeof crowdSample === 'function';
    if (m === '🟩') { if (!au || !crowdSample('cheer', { vol: 0.5 })) SOUNDS.cheer(); }
    else if (m === '🟨') { if (au) crowdSample('cheer-short', { vol: 0.4 }); }
    else if (au) crowdSample('sigh', { vol: 0.35 });
  } catch (e) { }
  return m;
}
// ralenti des dernières secondes (la passe réussie de « Trouve la passe ») ; rend sa durée (s)
function dailyReplay(sec) {
  if (typeof startReplay !== 'function' || !REPLAY.frames.length) return 0;
  const fr = REPLAY.frames.slice(-Math.round(sec / REPLAY.STEP)); fr.push(replayFrame());
  for (let i = 0; i < 6; i++) fr.push(fr[fr.length - 1]);
  if (fr.length < 10) return 0;
  REPLAY.last = { frames: fr, team: 0, score: [0, 0] }; startReplay('last');
  return fr.length * REPLAY.STEP / 0.55;
}
// l'épreuve est finie : on note, puis la suivante (ou la fin)
function dailyNext(msg) {
  const D = G.daily, v = dailyVal(), type = dailyType(), s = dailySitNow();
  D.res.push({ type, k: s.k, x: s.x, v: Math.round(v * 10) / 10, turns: D.turns, goals: D.goals });
  const m = dailyMoment(type, v, s, msg);
  dailyHud();
  const slow = type === 'pass' && m === '🟩' ? dailyReplay(3.2) : 0;   // une belle passe : on la revoit au ralenti
  dailyPause(2.4 + slow, () => { D.i++; D.goals = 0; G.dailyPop = null; if (D.i >= D.sits.length) dailyFinish(); else { dailySit(); dailyIntro(); } });
}
// perte de disque (events.js : turnover, interception) — rend true si le défi s'en occupe
function dailyTurn(x, y, msg) {
  const D = G.daily; if (!D || G.phase !== 'play') return false;
  const type = dailyType();
  if (type === 'pass' || type === 'huck') { disc.mode = 'dead'; disc.holder = null; D.gain = 0; dailyNext(msg + ' : 0 m'); return true; }
  if (type === 'keep' || type === 'passes') { disc.mode = 'dead'; disc.holder = null; dailyNext(msg); return true; }
  if (type === 'def' || type === 'oneone') { disc.mode = 'dead'; disc.holder = null; fxPlay('catch', x, y, 0); dailyNext('Disque récupéré ! 🛡️'); return true; }
  // attaque : +PEN s, et on te rend le disque là où il a été perdu
  D.pen += DAILY.PEN; D.turns++;
  if (G.oplay) endOPlay();
  disc.mode = 'ground'; disc.holder = null; disc.z = 0;
  disc.x = clamp(x, 0.5, W - 0.5); disc.y = clamp(y, 0.5, H - 0.5);
  G.off = 0; G.carryTo = lineSpot(disc.x, disc.y); G.groundAt = G.gt; G.stall = 0; G.marker = null;
  G.pickup = pickupFor(0, disc.x, disc.y); assignRoles(0, G.pickup); setupDefense(1, G.pickup);
  updateSelected(); flash(`${msg} · +${DAILY.PEN} s, on te rend le disque`, true); dailyHud();
  return true;
}
// point marqué (events.js : scorePoint)
function dailyScored(t) {
  const D = G.daily, type = dailyType(), s = dailySitNow();
  if (type === 'pass') { D.gain = Math.max(0, dirOf(0) * (disc.x - D.x0)); dailyNext('Dans l’en-but ! 🥏'); return; }
  if (type === 'att') { dailyNext('Point ! 🥏'); return; }
  if (type === 'huck') { D.gain = s.d; dailyNext('Point ! 🚀'); return; }
  if (type === 'keep' || type === 'passes') {                  // garder le disque : on repart du départ, le compte continue
    if (type === 'passes') D.passes++;
    const b = type === 'keep' ? DAILY.BKEEP : DAILY.BPASS; D.bonus += b;
    D.cont = true; flash(`Point ! Bonus +${b}${type === 'keep' ? ' s' : ' passes'} · on repart, ça continue`, true); dailyHud();
    try { if (typeof crowdSample !== 'function' || !crowdSample('cheer-short', { vol: 0.45 })) SOUNDS.cheer(); } catch (e) { }
    dailyPause(1.5, dailySit); return;
  }
  if (type === 'oneone' && G.scorer === D.man) D.recv++;      // (la réception dans l'en-but compte aussi)
  D.goals++; D.line = 0;                                       // défense : point encaissé, on rejoue l'épreuve
  if (D.goals >= DAILY.MAXG) { dailyNext(`${D.goals} points encaissés, on passe à la suite`); return; }
  flash(type === 'oneone' ? 'Point encaissé : +2' : `Point encaissé : +${DAILY.GOAL} m`, true); dailyHud();
  dailyPause(2, dailySit);
}
function dailyRestore() {
  const D = G.daily; if (!D) return;
  Math.random = D.keep.rnd;
  dailyBench([5, 5]);
  Object.assign(G.form, D.keep.form); Object.assign(G.ai, D.keep.ai);
  G.daily = null; G.dailyPop = null; G.score = [0, 0]; $('dailyIntro').style.display = 'none';
  if (G.replay) stopReplay();
  $('dailyBox').style.display = 'none';
}
function dailyFinish() {
  const D = G.daily, single = D.sits.length === 1, run = { n: D.n, res: D.res, official: D.official, single };
  if (D.free) { const x = D.freeX; dailyRestore(); G.phase = 'menu'; placeForPoint(); showFree(x, run); resize(); return; }
  if (D.official && !dailyDone(D.n)) { const all = dailyAll(); all[D.n] = { res: D.res, at: Date.now() }; storeSet(DAILY.KEY, all); }
  else if (!D.official && !single && D.n < dailyNum()) { const ar = dailyArch(); ar[D.n] = { res: D.res, at: Date.now() }; storeSet(DAILY.ARCH, ar); }   // archives : ton dernier essai
  dailyRestore();
  G.phase = 'menu'; placeForPoint();
  showDaily(D.n, run); resize();
}
function dailyQuit() {
  if (!G.daily) return;
  if (G.daily.free) { const x = G.daily.freeX; dailyRestore(); G.phase = 'menu'; placeForPoint(); showFree(x); resize(); return; }
  const n = G.daily.n; dailyRestore();
  G.phase = 'menu'; placeForPoint(); showDaily(n); resize();
}

// ---------- affichage ----------
const DAILY_HOW = {
  pass: 'Tes receveurs coupent chacun à leur tour : lance au bon moment, le plus loin possible. Une seule passe ; perdue (ou stall), elle vaut 0 m.',
  att: `Marque le plus vite possible. Une perte de disque : <b>+${DAILY.PEN} s</b>, et on te le rend.`,
  def: `3 contre 3 : la ligne avance à chaque passe. Un point encaissé : <b>+${DAILY.GOAL} m</b> et on rejoue. Change de joueur pour aller au disque.`
};
function dailyHud() {
  const D = G.daily; if (!D) return;
  const s = dailySitNow(), type = s.type, done = D.res.map(r => dailyMark(r.type, r.v, D.sits.find(q => q.k === r.k) || s)).join('');
  $('dailyStats').textContent = (D.sits.length > 1 ? `${D.i + 1}/${D.sits.length} ${done} · ` : '') + (type === 'pass' ? (D.thrown ? 'la passe vole…' : `stall ${Math.floor(G.stall)}`)
    : type === 'att' ? `⏱ ${D.t.toFixed(1)} s` + (D.pen ? ` + ${D.pen} s` : '')
    : type === 'keep' ? `🔒 ${Math.min(DAILY.KEEP, D.t).toFixed(1)} s` + (D.bonus ? ` + ${D.bonus} s` : '')
    : type === 'passes' ? `🔁 ${D.passes} passe${D.passes > 1 ? 's' : ''}` + (D.bonus ? ` + ${D.bonus}` : '')
    : type === 'huck' ? `🚀 ${Math.round(D.gain)} m · passe ${Math.min(2, D.passes + 1)}/2`
    : type === 'oneone' ? `🧍 ${D.recv} réception${D.recv > 1 ? 's' : ''}` + (D.goals ? ` + ${D.goals * 2}` : '')
    : `📏 ${Math.round(D.line)} m` + (D.goals ? ` + ${D.goals * DAILY.GOAL} m` : '')) + (D.stallMax !== 10 ? ` · stall max ${D.stallMax}` : '');
  $('dailyTitle').textContent = D.free ? `🎲 Épreuve libre · ${dailyName(s)}` : `Défi #${D.n} · ${dailyName(s)}` + (D.official ? '' : ' (entraînement)');
  $('dailyText').innerHTML = s.x ? DAILY_X[s.x].how : DAILY_HOW[type];
}
// trouve la passe : la coupe écrite d'un receveur (tant que la passe n'est pas partie)
const dailyCutOf = p => { const D = G.daily; return D && D.cuts && !D.thrown && D.wait <= 0 ? D.cuts.find(c => c.p === p) || null : null; };
// ses flèches : où et quand chaque receveur va couper (bleu : à venir, avec le compte à rebours ; jaune : il coupe)
function drawDailyCuts() {
  const D = G.daily; if (!D || !D.cuts || D.thrown || D.wait > 0) return;
  ctx.save(); ctx.font = `700 ${Math.max(10, S * 1.05)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of D.cuts) {
    const p = c.p, left = c.t0 - D.t, going = left <= 0, sx = going ? p.x : c.x0, sy = going ? p.y : c.y0;
    if (going && dist(p.x, p.y, c.x, c.y) < 1) continue;           // arrivé : plus de flèche
    const col = going ? 'rgba(250,204,21,.95)' : 'rgba(125,211,252,.9)', a = Math.atan2(c.y - sy, c.x - sx), hs = 11;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = going ? 3.5 : 2.5; ctx.setLineDash(going ? [] : [7, 5]);
    ctx.beginPath(); ctx.moveTo(X(sx), Y(sy)); ctx.lineTo(X(c.x) - hs * 0.7 * Math.cos(a), Y(c.y) - hs * 0.7 * Math.sin(a)); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(X(c.x), Y(c.y)); ctx.lineTo(X(c.x) - hs * Math.cos(a - 0.45), Y(c.y) - hs * Math.sin(a - 0.45)); ctx.lineTo(X(c.x) - hs * Math.cos(a + 0.45), Y(c.y) - hs * Math.sin(a + 0.45)); ctx.fill();
    // longueur de la coupe au milieu de la flèche ; avant son départ, le compte à rebours au-dessus du joueur
    const mx = X((sx + c.x) / 2), my = Y((sy + c.y) / 2), L = Math.round(dist(c.x0, c.y0, c.x, c.y)) + ' m';
    const pill = (txt, x, y, bg) => { const w = ctx.measureText(txt).width + 10, h = S * 1.05 + 6; ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.fillStyle = '#0f172a'; ctx.fillText(txt, x, y + 0.5); };
    pill(L, mx, my, col);
    if (!going) pill(left.toFixed(1) + ' s', X(p.x), Y(p.y) - S * 2.2, 'rgba(226,232,240,.95)');
  }
  ctx.restore();
}
// le score de l'épreuve en grand, au milieu du terrain (il grossit, puis s'efface)
function drawDailyPop() {
  const P = G.dailyPop; if (!P || G.replay) return;
  const k = Math.min(1, P.t / 0.25), sc = 0.6 + 0.4 * (1 - (1 - k) ** 3) + (k >= 1 ? 0.03 * Math.sin(P.t * 6) : 0), al = Math.min(1, P.t / 0.12);
  const col = P.m === '🟩' ? '#4ade80' : P.m === '🟨' ? '#facc15' : '#f87171', cx = X(W / 2), cy = Y(H / 2);
  ctx.save(); ctx.globalAlpha = al; ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.max(36, S * 6.5)}px system-ui`; ctx.lineWidth = Math.max(5, S * 0.7); ctx.strokeStyle = 'rgba(15,23,42,.85)';
  ctx.strokeText(P.big, 0, 0); ctx.fillStyle = col; ctx.fillText(P.big, 0, 0);
  ctx.font = `800 ${Math.max(16, S * 2.4)}px system-ui`; ctx.lineWidth = Math.max(3, S * 0.4);
  ctx.strokeText(P.sub, 0, S * 4.6); ctx.fillStyle = '#fff'; ctx.fillText(P.sub, 0, S * 4.6);
  ctx.restore();
}
// la ligne jusqu'où l'adversaire a avancé (défense) ; la ligne de départ du lancer (trouve la passe, huck)
function drawDaily() {
  const D = G.daily; if (!D) return;
  drawDailyPop();
  if (D.wait > 0) return;
  drawDailyCuts();
  if (D.man) {                                                 // 1 contre 1 : le coupeur que tu marques (cible rouge)
    const r = 1.9 * (X(1) - X(0)), pulse = 0.6 + 0.4 * Math.sin(G.time * 6);
    ctx.save(); ctx.strokeStyle = `rgba(248,113,113,${pulse})`; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(X(D.man.x), Y(D.man.y), r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  const type = dailyType(); if (type !== 'def' && type !== 'pass' && type !== 'huck') return;
  const x = type === 'def' ? D.x0 + dirOf(1) * D.line : D.x0;
  ctx.save(); ctx.strokeStyle = 'rgba(250,204,21,.85)'; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
  ctx.beginPath(); ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(H)); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `700 ${Math.max(11, S * 1.3)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#facc15';
  ctx.fillText(type === 'def' ? Math.round(D.line) + ' m' : '0 m', X(x), Y(0) - 6);
  ctx.restore();
}
// notes en lettres (lien partagé) : 🟩 g, 🟨 y, 🟥 r — et retour
const dailyCode = marks => [...marks].map(m => ({ '🟩': 'g', '🟨': 'y', '🟥': 'r' })[m] || '').join('');
const dailyMarksOf = code => /^[gyr]{4}$/.test(code || '') ? [...code].map(c => ({ g: '🟩', y: '🟨', r: '🟥' })[c]).join('') : '';
// le défi d'un ami (lien partagé ?defi=n&r=gyrr) : ses carrés, pour te mesurer à lui
let dailyFriend = null;
function dailyShareText(n, run) {
  const marks = run.res.map((r, i) => dailyMark(r.type, r.v, dailySitOf(n, r, i))).join('');
  const url = String(location.href || '').split(/[?#]/)[0] + '?defi=' + n + '&r=' + dailyCode(marks);   // r : l'aperçu du lien montre tes carrés (worker)
  return `🥏 Ultimate du jour #${n} ${marks}\n${dailyTitle(n, run.res)}\n` + run.res.map((r, i) => dailyIcon(Object.assign({}, r, { x: dailySitOf(n, r, i).x })) + ' ' + dailyFmt(r.type, r.v)).join(' · ') + `\n${url}`;
}
// le panneau du défi : avant (règles, Commencer), après (scores, titre, Partager, rejouer une épreuve)
function showDaily(n, run) {
  n = n || dailyNum();
  const today = dailyNum(), done = dailyDone(n), arch = dailyArch()[n], sits = dailyGen(n).sits, sx = sits[3];
  const full = run || null;
  const res = full || (done && Object.assign({ n, official: true }, done)) || (arch && Object.assign({ n, official: false }, arch));
  G.menuShown = true;
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard', 'endlessCard']) $(id).style.display = 'none';
  $('dailyCard').style.display = ''; $('overlay').classList.remove('hidden');
  $('dailyHead').textContent = n !== today ? `📚 Défi #${n} · ${dailyDate(n)}` : `📅 Défi du jour #${n}`;
  const streak = dailyStreak();
  $('dailyRules').innerHTML = `Quatre épreuves, les mêmes pour tout le monde ${n === today ? 'aujourd’hui' : 'ce jour-là'} :<br>`
    + `🎯 <b>Trouve la passe</b> : tes receveurs coupent chacun à leur tour ; une seule passe, au bon moment, la plus longue possible (0 m si elle est perdue).<br>`
    + `⏱ <b>Attaque</b>, 5 contre 5 : marque le plus vite possible ; une perte de disque, +${DAILY.PEN} s.<br>`
    + `📏 <b>Défense</b>, 3 contre 3 : la ligne jaune avance à chaque passe ; un point encaissé, +${DAILY.GOAL} m et on rejoue.<br>`
    + `${DAILY_X[sx.x].icon} <b>L'épreuve du jour : ${DAILY_X[sx.x].name}</b>. ${DAILY_X[sx.x].how}`
    + (streak ? `<br>Série : <b>${streak} jour${streak > 1 ? 's' : ''}</b> 🔥` : '');
  // les scores : chaque épreuve se rejoue seule (↻), pour s'entraîner
  const line = (r, i) => { const s = dailySitOf(n, r, i); return `${dailyMark(r.type, r.v, s)} ${dailyIcon(s)} ${dailyName(s)} : <b>${dailyFmt(r.type, r.v)}</b>` + (r.turns ? ` (${r.turns} perte${r.turns > 1 ? 's' : ''})` : '') + (r.goals ? ` (${r.goals} point${r.goals > 1 ? 's' : ''} encaissé${r.goals > 1 ? 's' : ''})` : ''); };
  let h = '';
  if (res) h += `<span class="dailyTitle">${dailyTitle(n, res.res)}</span><br><b>${res.official ? (n === today ? 'Tes scores' : 'Tes scores du jour même') : n === today ? 'Scores (entraînement, non comptés)' : 'Ton dernier essai (archives)'}</b><br>`
    + res.res.map((r, i) => line(r, i)).join('<br>');
  const fr = dailyFriend && dailyFriend.n === n ? dailyFriend.marks : '';
  if (fr) {                                                     // venu par le lien d'un ami : ses carrés, puis la comparaison
    const mine = res ? res.res.map((r, i) => dailyMark(r.type, r.v, dailySitOf(n, r, i))).join('') : '';
    const pts = m => [...m].reduce((a, c) => a + (c === '🟩' ? 2 : c === '🟨' ? 1 : 0), 0);
    const vs = !mine ? 'À toi de faire mieux !' : pts(mine) > pts(fr) ? 'Tu as fait mieux 🎉' : pts(mine) === pts(fr) ? 'Égalité !' : 'Ton ami a fait mieux… pour cette fois';
    $('dailyFriendBox').innerHTML = `<span class="dailyFriend">🤝 Ton ami : <b>${fr}</b>` + (mine ? ` · toi : <b>${mine}</b>` : '') + `<br>${vs}</span>`;
  }
  $('dailyFriendBox').style.display = fr ? '' : 'none';
  $('dailyRes').innerHTML = h; $('dailyRes').style.display = h ? '' : 'none';
  const official = n === today && !done, newbie = !storeGet('uf-tuto', false);
  $('dailyNew').style.display = newbie ? '' : 'none';            // nouveau joueur (souvent arrivé par un lien partagé) : le tutoriel d'abord
  $('dailyGo').textContent = official ? (newbie ? 'Jouer quand même ▶' : 'Commencer ▶') : n !== today ? (res ? 'Rejouer tout ce défi ▶' : 'Jouer ce défi ▶') : 'Tout rejouer pour s’entraîner ▶';
  $('dailyGo').classList.toggle('primary', official && !newbie);
  $('dailyGo').onclick = () => dailyStart(n, official);
  $('dailyShare').style.display = done ? '' : 'none';
  $('dailyShare').textContent = 'Partager 📤';
  $('dailyShare').onclick = () => {
    const r = dailyDone(n); if (!r) return;
    const txt = dailyShareText(n, r);
    if (navigator.share && isTouchUI()) navigator.share({ text: txt }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => { $('dailyShare').textContent = 'Copié ✓'; setTimeout(() => { $('dailyShare').textContent = 'Partager 📤'; }, 1500); }).catch(() => prompt('Copie ce texte :', txt));
    else prompt('Copie ce texte :', txt);
  };
  // archives : tous les défis passés, à rejouer quand on veut (hors compétition)
  dailyArchList(n, today);
}
// ---------- épreuve libre : n'importe quelle épreuve, situation au hasard, rien n'est gardé ni partagé ----------
const DAILY_ALL = ['pass', 'att', 'def', ...DAILY_X_ORDER];
function dailyFree(x) {
  if (x === 'rand') x = DAILY_ALL[Math.floor(Math.random() * DAILY_ALL.length)];
  const seed = 100000 + Math.floor(Math.random() * 900000), gen = dailyGen(seed, DAILY_X[x] ? x : null), k = { pass: 0, att: 1, def: 2 }[x];
  dailyStart(seed, false, k === undefined ? 3 : k, { gen, x });
}
function showFree(x, run) {
  G.menuShown = true;
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard', 'endlessCard']) $(id).style.display = 'none';
  $('dailyCard').style.display = ''; $('overlay').classList.remove('hidden');
  $('dailyHead').textContent = '🎲 Épreuve libre'; $('dailyFriendBox').style.display = 'none';
  const it = k => { const s = { type: DAILY_X[k] ? DAILY_X[k].base : k, x: DAILY_X[k] ? k : undefined }; return `<button class="ghost freeOne${k === x ? ' on' : ''}" data-x="${k}">${dailyIcon(s)} ${dailyName(s)}</button>`; };
  $('dailyRules').innerHTML = `N'importe quelle épreuve, dans une situation tirée au hasard, autant de fois que tu veux. Pour t'entraîner : rien n'est gardé ni partagé.<br><span class="dailyFree">${DAILY_ALL.map(it).join('')}<button class="ghost freeOne" data-x="rand">🎲 Au hasard</button></span>`;
  if (run && run.res[0]) {
    const r = run.res[0], s = run.res[0].x ? { type: r.type, x: r.x } : { type: r.type };
    $('dailyRes').innerHTML = `<b>Ton score : </b>${dailyIcon(s)} ${dailyName(s)} : <b>${dailyFmt(r.type, r.v)}</b>` + (r.turns ? ` (${r.turns} perte${r.turns > 1 ? 's' : ''})` : '');
    $('dailyRes').style.display = '';
  } else $('dailyRes').style.display = 'none';
  $('dailyNew').style.display = 'none';
  $('dailyGo').textContent = x ? 'Encore une (autre situation) ▶' : '🎲 Une épreuve au hasard ▶'; $('dailyGo').classList.add('primary');
  $('dailyGo').onclick = () => dailyFree(x || 'rand');
  $('dailyShare').style.display = 'none';
  $('dailyPast').innerHTML = '<button class="ghost" id="freeBackB">📅 Retour au défi du jour</button>';
  $('freeBackB').addEventListener('click', () => showDaily());
  $('dailyRules').querySelectorAll('.freeOne').forEach(b => b.addEventListener('click', () => dailyFree(b.dataset.x)));
}
let dailyArchOpen = false;
function dailyArchList(cur, today) {
  const nPast = today - 1, ar = dailyArch(), el = $('dailyPast');
  if (nPast < 1) { el.innerHTML = '📚 Archives : les défis passés arriveront ici dès demain. <button class="ghost" id="dailyFreeB">🎲 Épreuve libre</button>'; $('dailyFreeB').addEventListener('click', () => showFree()); return; }
  const marks = (k, r) => r.res.map((x, i) => dailyMark(x.type, x.v, dailySitOf(k, x, i))).join('');
  let h = `<button class="ghost" id="dailyArchB">📚 Archives (${nPast} défi${nPast > 1 ? 's' : ''} passé${nPast > 1 ? 's' : ''}) ${dailyArchOpen ? '▴' : '▾'}</button>`;
  if (cur !== today) h += ` <button class="ghost" data-n="${today}">📅 Défi du jour</button>`;
  h += ' <button class="ghost" id="dailyFreeB">🎲 Épreuve libre</button>';
  if (dailyArchOpen) {
    h += '<span class="dailyArch">';
    for (let k = nPast; k >= 1; k--) {
      const d = dailyDone(k), a = ar[k], r = d || a;
      h += `<button class="ghost${k === cur ? ' on' : ''}" data-n="${k}">#${k} · ${dailyDate(k)}${r ? ' ' + marks(k, r) : ''}${d ? ' ✓' : ''}</button>`;
    }
    h += '</span><br>✓ : joué le jour même · les archives se rejouent autant que tu veux, sans compter.';
  }
  el.innerHTML = h;
  $('dailyArchB').addEventListener('click', () => { dailyArchOpen = !dailyArchOpen; dailyArchList(cur, today); });
  $('dailyFreeB').addEventListener('click', () => showFree());
  el.querySelectorAll('button[data-n]').forEach(b => b.addEventListener('click', () => showDaily(+b.dataset.n)));
}
// bouton de l'accueil : numéro du jour, et tes scores s'il est déjà fait
function dailyHomeTxt() {
  const n = dailyNum(), d = dailyDone(n), sx = dailyGen(n).sits[3];
  return d ? `Fait : ${dailyTitle(n, d.res)} · reviens demain !` : `#${n} · trouve la passe, attaque, défense + ${DAILY_X[sx.x].icon} ${DAILY_X[sx.x].name} · un essai par jour`;
}
if (typeof document !== 'undefined' && document.getElementById('dailyB')) {
  $('dailyB').addEventListener('click', () => { backToSolo(); showDaily(); });
  $('dailyQuit').addEventListener('click', dailyQuit);
  $('dIntroGo').addEventListener('click', dailyIntroGo);
  $('dailyBack').addEventListener('click', () => { $('dailyCard').style.display = 'none'; showLobby(); });
  $('dailyTutoB').addEventListener('click', () => { $('dailyCard').style.display = 'none'; G.afterTuto = 'daily'; tutoStart('base'); });
}
