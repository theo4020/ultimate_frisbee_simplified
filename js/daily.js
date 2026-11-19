// daily.js — Défi du jour : le même pour tout le monde, un essai officiel par jour, un score à partager.
// Chaque jour, 3 épreuves :
//  1. Trouve la passe (5 contre 5) : tout le monde est figé ; une seule passe, la plus longue possible vers l'en-but.
//     Score : les mètres gagnés (0 si elle est perdue). Le plus grand gagne.
//  2. Attaque (5 contre 5) : marquer depuis la situation donnée, sans limite de temps. Une perte de disque ajoute
//     DAILY.PEN s et on te rend le disque là où il a été perdu. Score : le temps (le plus petit gagne).
//  3. Défense (3 contre 3) : la ligne avance à chaque passe reçue par l'adversaire (elle ne recule pas sur une passe en
//     arrière). S'il marque : DAILY.GOAL m de plus et on rejoue, jusqu'à ce que ta défense récupère le disque (au plus
//     DAILY.MAXG points encaissés). Score : les mètres concédés (le plus petit gagne).
// Les situations sont tirées à partir du numéro du jour (même tirage pour tous) ; pendant le défi, le hasard du jeu (IA,
// rafales) part du même tirage pour tout le monde, puis suit ce que chacun fait.

const DAILY = { EPOCH: Date.UTC(2026, 10, 19), PEN: 10, GOAL: 80, MAXG: 3, KEY: 'uf-daily2' };   // jour n° 1 : le 19 novembre 2026
const DAILY_NAMES = { pass: 'Trouve la passe', att: 'Attaque', def: 'Défense' };
const DAILY_ICON = { pass: '🎯', att: '⏱', def: '📏' };

// numéro du défi d'une date (jour local)
function dailyNum(d) { d = d || new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DAILY.EPOCH) / 864e5) + 1; }
// petit générateur de hasard réglé (le même tirage partout)
function dailyRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// les 3 épreuves du jour n (d : distance du porteur à l'en-but qu'il attaque)
function dailyGen(n) {
  const r = dailyRng(n * 7919 + 17), R = (a, b) => a + (b - a) * r(), P = o => o[Math.floor(r() * o.length)];
  const sits = [['pass', 40, 58], ['att', 34, 46], ['def', 40, 55]].map(([type, d0, d1]) => {
    const kmh = r() < 0.25 ? 0 : Math.round(R(6, 26)), a = Math.floor(r() * 8) * Math.PI / 4;
    return { type, d: Math.round(R(d0, d1)), y: Math.round(R(7, H - 7)), wind: { x: Math.cos(a) * kmh / 3.6, y: Math.sin(a) * kmh / 3.6, kmh },
      def: type === 'att' ? P(['man', 'man', 'zone', 'clam']) : 'man', force: P(['haut', 'bas', 'middle', 'straight']), off: P(['vert', 'ho', 'side']) };
  });
  return { n, sits };
}

// ---------- résultats gardés dans le navigateur ----------
const dailyAll = () => { const o = storeGet(DAILY.KEY, {}); return o && typeof o === 'object' ? o : {}; };
const dailyDone = n => dailyAll()[n] || null;
function dailyStreak() {
  const all = dailyAll(); let n = dailyNum(), k = 0;
  if (!all[n]) n--;                                            // pas encore joué aujourd'hui : la série d'hier compte encore
  while (all[n]) { k++; n--; }
  return k;
}
// cases du partage, selon l'épreuve
function dailyMark(type, v, s) {
  if (type === 'pass') return v >= 25 ? '🟩' : v >= 12 ? '🟨' : '🟥';
  if (type === 'att') { const par = 6 + s.d / 4; return v <= par ? '🟩' : v <= par * 2 ? '🟨' : '🟥'; }
  return v <= 8 ? '🟩' : v <= 25 ? '🟨' : '🟥';
}
const dailyFmt = (type, v) => (type === 'att' ? v.toFixed(1) + ' s' : Math.round(v) + ' m');

// ---------- le défi en jeu ----------
function dailyStart(n, official) {
  backToSolo();
  G.series = null; G.ms = null;
  G.daily = Object.assign(dailyGen(n), { official, i: 0, res: [], wait: 0, after: null, t: 0, pen: 0, turns: 0, goals: 0, line: 0, x0: 0, gain: 0, thrown: false,
    keep: { form: Object.assign({}, G.form), ai: Object.assign({}, G.ai), rnd: Math.random }, bench: null });
  Object.assign(G.form, { level: 'normal', allyLevel: 'normal', play: 'none', dplay: 'none', points: '99' });   // mêmes adversaires et coéquipiers pour tous
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard', 'dailyCard', 'endlessCard']) $(id).style.display = 'none';
  $('overlay').classList.add('hidden'); G.menuShown = false;
  $('dailyBox').style.display = '';
  newMatchStats(); dailySit(); resize();
}
// 3 contre 3 (défense) : deux joueurs de chaque équipe sur le banc ; retour à 5 contre 5 ensuite
function dailyBench(on) {
  const D = G.daily;
  if (on && !D.bench) {
    D.bench = [];
    for (const t of [0, 1]) D.bench.push(...TEAMS[t].splice(3));
    for (const b of D.bench) players.splice(players.indexOf(b), 1);
    for (const t of [0, 1]) G.order[t] = [];
    G.form.def = 'man';
  } else if (!on && D.bench) {
    for (const b of D.bench) TEAMS[b.team].push(b);
    players.length = 0; for (const t of [0, 1]) { TEAMS[t].sort((a, b) => a.i - b.i); players.push(...TEAMS[t]); }
    for (const t of [0, 1]) G.order[t] = [];
    G.form.def = D.keep.form.def; D.bench = null;
  }
  visReset();
}
const dailyType = () => G.daily.sits[G.daily.i].type;
// mise en place de l'épreuve en cours (ou rejouée après un point encaissé en défense)
function dailySit() {
  const D = G.daily, s = D.sits[D.i], a = s.type === 'def' ? 1 : 0, d = 1 - a;
  dailyBench(s.type === 'def');
  Math.random = dailyRng(D.n * 1009 + D.i * 101 + D.goals * 13 + 7);   // le même hasard pour tout le monde, au départ
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
    const depths = [[8, 13], [15, 21], [23, 30], [32, 40]], lanes = [4, 13, 24, 33].sort(() => rr() - 0.5);
    TEAMS[a].slice(1).forEach((p, k) => { const [d0, d1] = depths[k]; p.x = clamp(h.x + dir * (d0 + (d1 - d0) * rr()), 2, W - 2); p.y = clamp(lanes[k] + (rr() - 0.5) * 4, 2, H - 2); });
  }
  TEAMS[d].forEach((p, k) => { p.x = h.x + dir * (8 + k); p.y = H / 2 + (k - (TEAMS[d].length - 1) / 2) * 3; });
  setupDefense(d, h);
  const slots = zoneSlots(d, h.x, h.y, dir, -open);
  for (const p of TEAMS[d]) { defenderAI(p, h.x, h.y, dir, -open, defFormOf(d), slots); p.x = p.tx; p.y = p.ty; }
  if (s.type === 'pass')                                       // chaque défenseur décalé de son attaquant : devant, derrière ou à côté, plus ou moins loin
    for (const q of TEAMS[d]) { if (!q.match || q.match === h) continue; const an = rr() * Math.PI * 2, m = 1.5 + rr() * 4; q.x = clamp(q.match.x + Math.cos(an) * m, 1, W - 1); q.y = clamp(q.match.y + Math.sin(an) * m, 1, H - 1); }
  holdDisc(h); visReset(); updateSelected();
  if (!D.goals) { D.t = 0; D.pen = 0; D.turns = 0; }
  D.line = 0; D.x0 = h.x; D.gain = 0; D.thrown = false;
  G.freeze = s.type === 'pass';                                // (main.js : le jeu attend la passe)
  flash(`${D.i + 1}/3 · ` + (s.type === 'pass' ? 'Trouve la passe la plus longue !' : s.type === 'att' ? `Marque ! (à ${s.d} m de l'en-but)` : D.goals ? 'On rejoue : défends !' : 'Défends : recule-les le moins possible'), true);
  dailyHud();
}
function dailyFrame(dt) {
  const D = G.daily; if (!D) return;
  if (D.wait > 0) { D.wait -= dt; if (D.wait <= 0) D.after(); return; }
  if (G.phase !== 'play' || G.paused) return;
  const type = dailyType();
  if (type === 'pass') {
    if (G.freeze && disc.mode === 'air') { G.freeze = false; D.thrown = true; }   // la passe est partie : le jeu reprend
    if (D.thrown && (disc.mode === 'held' || disc.mode === 'carry') && disc.holder && disc.holder.team === 0) { D.gain = Math.max(0, dirOf(0) * (disc.holder.x - D.x0)); dailyNext('Attrapé !'); return; }
  } else D.t += dt * SPEEDS[G.form.speed];
  if (type === 'def' && disc.mode === 'held' && disc.holder && disc.holder.team === 1) D.line = Math.max(D.line, dirOf(1) * (disc.x - D.x0));
  dailyHud();
}
// une pause courte (le message reste à l'écran), puis la suite
function dailyPause(sec, fn) { const D = G.daily; G.phase = 'daily'; G.freeze = false; D.wait = sec; D.after = () => { G.phase = 'play'; fn(); }; }
function dailyVal() { const D = G.daily, t = dailyType(); return t === 'pass' ? D.gain : t === 'att' ? D.t + D.pen : D.line + D.goals * DAILY.GOAL; }
// l'épreuve est finie : on note, puis la suivante (ou la fin)
function dailyNext(msg) {
  const D = G.daily, v = dailyVal(), type = dailyType();
  D.res.push({ type, v: Math.round(v * 10) / 10, turns: D.turns, goals: D.goals });
  flash(`${msg} · ${dailyFmt(type, v)}`, true); dailyHud();
  dailyPause(2.2, () => { D.i++; D.goals = 0; if (D.i >= D.sits.length) dailyFinish(); else dailySit(); });
}
// perte de disque (events.js : turnover, interception) — rend true si le défi s'en occupe
function dailyTurn(x, y, msg) {
  const D = G.daily; if (!D || G.phase !== 'play') return false;
  const type = dailyType();
  if (type === 'pass') { disc.mode = 'dead'; disc.holder = null; D.gain = 0; dailyNext(msg + ' : 0 m'); return true; }
  if (type === 'def') { disc.mode = 'dead'; disc.holder = null; fxPlay('catch', x, y, 0); dailyNext('Disque récupéré ! 🛡️'); return true; }
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
  const D = G.daily, type = dailyType();
  if (type === 'pass') { D.gain = Math.max(0, dirOf(0) * (disc.x - D.x0)); dailyNext('Dans l’en-but ! 🥏'); return; }
  if (type === 'att') { dailyNext('Point ! 🥏'); return; }
  D.goals++; D.line = 0;                                       // défense : point encaissé, on rejoue l'épreuve
  if (D.goals >= DAILY.MAXG) { dailyNext(`${D.goals} points encaissés, on passe à la suite`); return; }
  flash(`Point encaissé : +${DAILY.GOAL} m`, true); dailyHud();
  dailyPause(2, dailySit);
}
function dailyRestore() {
  const D = G.daily; if (!D) return;
  Math.random = D.keep.rnd;
  dailyBench(false);
  Object.assign(G.form, D.keep.form); Object.assign(G.ai, D.keep.ai);
  G.daily = null; G.freeze = false; G.score = [0, 0];
  $('dailyBox').style.display = 'none';
}
function dailyFinish() {
  const D = G.daily, run = { n: D.n, res: D.res, official: D.official };
  if (D.official && !dailyDone(D.n)) { const all = dailyAll(); all[D.n] = { res: D.res, at: Date.now() }; storeSet(DAILY.KEY, all); }
  dailyRestore();
  G.phase = 'menu'; placeForPoint();
  showDaily(D.n, run); resize();
}
function dailyQuit() {
  if (!G.daily) return;
  const n = G.daily.n; dailyRestore();
  G.phase = 'menu'; placeForPoint(); showDaily(n); resize();
}

// ---------- affichage ----------
const DAILY_HOW = {
  pass: 'Tout le monde est figé : vise le receveur qui te fait gagner le plus de terrain. Une seule passe ; perdue, elle vaut 0 m.',
  att: `Marque le plus vite possible. Une perte de disque : <b>+${DAILY.PEN} s</b>, et on te le rend.`,
  def: `3 contre 3 : la ligne avance à chaque passe. Un point encaissé : <b>+${DAILY.GOAL} m</b> et on rejoue. Change de joueur pour aller au disque.`
};
function dailyHud() {
  const D = G.daily; if (!D) return;
  const type = dailyType(), v = dailyVal(), done = D.res.map((r, k) => dailyMark(r.type, r.v, D.sits[k])).join('');
  $('dailyStats').textContent = `${D.i + 1}/3 ${done} · ` + (type === 'pass' ? (D.thrown ? 'la passe vole…' : 'à toi de lancer')
    : type === 'att' ? `⏱ ${D.t.toFixed(1)} s` + (D.pen ? ` + ${D.pen} s` : '')
    : `📏 ${Math.round(D.line)} m` + (D.goals ? ` + ${D.goals * DAILY.GOAL} m` : ''));
  $('dailyTitle').textContent = `Défi #${D.n} · ${DAILY_NAMES[type]}` + (D.official ? '' : ' (entraînement)');
  $('dailyText').innerHTML = DAILY_HOW[type];
}
// la ligne jusqu'où l'adversaire a avancé (défense) ; la ligne de départ du lancer (trouve la passe)
function drawDaily() {
  const D = G.daily; if (!D || D.wait > 0) return;
  const type = dailyType(); if (type === 'att') return;
  const x = type === 'def' ? D.x0 + dirOf(1) * D.line : D.x0;
  ctx.save(); ctx.strokeStyle = 'rgba(250,204,21,.85)'; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
  ctx.beginPath(); ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(H)); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `700 ${Math.max(11, S * 1.3)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#facc15';
  ctx.fillText(type === 'def' ? Math.round(D.line) + ' m' : '0 m', X(x), Y(0) - 6);
  ctx.restore();
}
function dailyShareText(n, run) {
  const sits = dailyGen(n).sits, marks = run.res.map((r, k) => dailyMark(r.type, r.v, sits[k])).join('');
  const url = String(location.href || '').split(/[?#]/)[0] + '?defi=' + n;
  return `🥏 Ultimate du jour #${n} ${marks}\n` + run.res.map(r => DAILY_ICON[r.type] + ' ' + dailyFmt(r.type, r.v)).join(' · ') + `\n${url}`;
}
// le panneau du défi : avant (règles, Commencer), après (scores, Partager, rejouer pour s'entraîner)
function showDaily(n, run) {
  n = n || dailyNum();
  const today = dailyNum(), done = dailyDone(n), res = run || (done && Object.assign({ n, official: true }, done)), sits = dailyGen(n).sits;
  G.menuShown = true;
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard', 'endlessCard']) $(id).style.display = 'none';
  $('dailyCard').style.display = ''; $('overlay').classList.remove('hidden');
  $('dailyHead').textContent = `📅 Défi du jour #${n}` + (n !== today ? ' (jour passé)' : '');
  const streak = dailyStreak();
  $('dailyRules').innerHTML = `Trois épreuves, les mêmes pour tout le monde aujourd'hui :<br>`
    + `🎯 <b>Trouve la passe</b> : tout est figé, une seule passe, la plus longue possible (0 m si elle est perdue).<br>`
    + `⏱ <b>Attaque</b>, 5 contre 5 : marque le plus vite possible ; une perte de disque, +${DAILY.PEN} s.<br>`
    + `📏 <b>Défense</b>, 3 contre 3 : la ligne jaune avance à chaque passe ; un point encaissé, +${DAILY.GOAL} m et on rejoue.`
    + (streak ? `<br>Série : <b>${streak} jour${streak > 1 ? 's' : ''}</b> 🔥` : '');
  if (res) {
    $('dailyRes').innerHTML = `<b>${res.official ? 'Tes scores' : 'Scores (entraînement, non comptés)'}</b><br>`
      + res.res.map((r, k) => `${dailyMark(r.type, r.v, sits[k])} ${DAILY_ICON[r.type]} ${DAILY_NAMES[r.type]} : ${dailyFmt(r.type, r.v)}` + (r.turns ? ` (${r.turns} perte${r.turns > 1 ? 's' : ''})` : '') + (r.goals ? ` (${r.goals} point${r.goals > 1 ? 's' : ''} encaissé${r.goals > 1 ? 's' : ''})` : '')).join('<br>');
    $('dailyRes').style.display = '';
  } else $('dailyRes').style.display = 'none';
  const official = n === today && !done;
  $('dailyGo').textContent = official ? 'Commencer ▶' : 'Rejouer pour s’entraîner ▶';
  $('dailyGo').classList.toggle('primary', official);
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
  // les jours passés (pour s'entraîner, hors compétition)
  const past = []; for (let k = today - 1; k >= Math.max(1, today - 6); k--) past.push(k);
  $('dailyPast').innerHTML = past.length ? 'Jours passés : ' + past.map(k => `<button class="ghost" data-n="${k}">#${k}${dailyDone(k) ? ' ✓' : ''}</button>`).join(' ') : '';
  $('dailyPast').querySelectorAll('button').forEach(b => b.addEventListener('click', () => showDaily(+b.dataset.n)));
}
// bouton de l'accueil : numéro du jour, et tes scores s'il est déjà fait
function dailyHomeTxt() {
  const n = dailyNum(), d = dailyDone(n);
  return d ? `Fait : ${d.res.map(r => DAILY_ICON[r.type] + ' ' + dailyFmt(r.type, r.v)).join(' · ')} · reviens demain !` : `#${n} · trouve la passe, attaque, défense : le même pour tout le monde, un essai par jour`;
}
if (typeof document !== 'undefined' && document.getElementById('dailyB')) {
  $('dailyB').addEventListener('click', () => { backToSolo(); showDaily(); });
  $('dailyQuit').addEventListener('click', dailyQuit);
  $('dailyBack').addEventListener('click', () => { $('dailyCard').style.display = 'none'; showLobby(); });
}
