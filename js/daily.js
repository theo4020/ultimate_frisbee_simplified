// daily.js — Défi du jour : le même pour tout le monde, un essai officiel par jour, un score à partager.
// Un jour sur deux en attaque, un jour sur deux en défense, 3 situations à chaque fois :
//  • attaque (5 contre 5) : marquer depuis la situation donnée, sans limite de temps. Le chrono tourne ; une perte de
//    disque ajoute DAILY.PEN s et on te rend le disque là où il a été perdu. Score : le temps total (le plus petit gagne).
//  • défense (3 contre 3) : la ligne avance à chaque passe reçue par l'adversaire (elle ne recule pas sur une passe en
//    arrière). S'il marque : DAILY.GOAL m de plus et on rejoue la situation, jusqu'à ce que ta défense récupère le disque.
//    Score : les mètres concédés (le plus petit gagne). Au bout de DAILY.MAXG points encaissés, on passe à la suite.
// Les situations sont tirées à partir du numéro du jour (même tirage pour tous) ; pendant le défi, le hasard du jeu (IA,
// rafales) part du même tirage pour tout le monde, puis suit ce que chacun fait.

const DAILY = { EPOCH: Date.UTC(2026, 10, 18), PEN: 10, GOAL: 80, MAXG: 3 };   // jour n° 1 : le 18 novembre 2026 · MAXG : points encaissés au plus, puis on passe à la suite

// numéro du défi d'une date (jour local)
function dailyNum(d) { d = d || new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DAILY.EPOCH) / 864e5) + 1; }
const dailyKind = n => (n % 2 ? 'att' : 'def');
const DAILY_NAMES = { att: 'Attaque', def: 'Défense' };
// petit générateur de hasard réglé (le même tirage partout)
function dailyRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// les 3 situations du jour n : de loin, du milieu, tout près de l'en-but
function dailyGen(n) {
  const r = dailyRng(n * 7919 + 17), R = (a, b) => a + (b - a) * r(), P = o => o[Math.floor(r() * o.length)], kind = dailyKind(n);
  const sits = (kind === 'att' ? [[52, 60], [32, 40], [14, 20]] : [[55, 62], [40, 46], [26, 32]]).map(([d0, d1]) => {
    const kmh = r() < 0.25 ? 0 : Math.round(R(6, 26)), a = Math.floor(r() * 8) * Math.PI / 4;
    return { d: Math.round(R(d0, d1)), y: Math.round(R(7, H - 7)), wind: { x: Math.cos(a) * kmh / 3.6, y: Math.sin(a) * kmh / 3.6, kmh },
      def: kind === 'att' ? P(['man', 'man', 'zone', 'clam']) : 'man', force: P(['haut', 'bas', 'middle', 'straight']), off: P(['vert', 'ho', 'side']) };
  });
  return { n, kind, sits };
}

// ---------- résultats gardés dans le navigateur ----------
const dailyAll = () => { const o = storeGet('uf-daily', {}); return o && typeof o === 'object' ? o : {}; };
const dailyDone = n => dailyAll()[n] || null;
function dailyStreak() {
  const all = dailyAll(); let n = dailyNum(), k = 0;
  if (!all[n]) n--;                                            // pas encore joué aujourd'hui : la série d'hier compte encore
  while (all[n]) { k++; n--; }
  return k;
}
// cases du partage : attaque (temps de la situation, pénalités comprises), défense (mètres concédés)
function dailyMark(kind, v, s) {
  if (kind === 'att') { const par = 6 + s.d / 4; return v <= par ? '🟩' : v <= par * 2 ? '🟨' : '🟥'; }
  return v <= 8 ? '🟩' : v <= 25 ? '🟨' : '🟥';
}
const dailyFmt = (kind, v) => (kind === 'att' ? v.toFixed(1) + ' s' : Math.round(v) + ' m');

// ---------- le défi en jeu ----------
function dailyStart(n, official) {
  backToSolo();
  G.series = null; G.ms = null;
  const D = G.daily = Object.assign(dailyGen(n), { official, i: 0, res: [], wait: 0, after: null, t: 0, pen: 0, turns: 0, goals: 0, line: 0, x0: 0,
    keep: { form: Object.assign({}, G.form), ai: Object.assign({}, G.ai), rnd: Math.random }, bench: null });
  Object.assign(G.form, { level: 'normal', allyLevel: 'normal', play: 'none', dplay: 'none', points: '99' });   // mêmes adversaires et coéquipiers pour tous
  if (D.kind === 'def') {                                       // 3 contre 3 : deux joueurs de chaque équipe sur le banc
    D.bench = [];
    for (const t of [0, 1]) D.bench.push(...TEAMS[t].splice(3));
    for (const b of D.bench) players.splice(players.indexOf(b), 1);
    for (const t of [0, 1]) G.order[t] = [];
    G.form.def = 'man';
  }
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard', 'dailyCard', 'endlessCard']) $(id).style.display = 'none';
  $('overlay').classList.add('hidden'); G.menuShown = false;
  $('dailyBox').style.display = '';
  newMatchStats(); dailySit(); resize();
}
// mise en place de la situation en cours (ou rejouée après un point encaissé en défense)
function dailySit() {
  const D = G.daily, s = D.sits[D.i], a = D.kind === 'att' ? 0 : 1, d = 1 - a;
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
  TEAMS[d].forEach((p, k) => { p.x = h.x + dir * (8 + k); p.y = H / 2 + (k - (TEAMS[d].length - 1) / 2) * 3; });
  setupDefense(d, h);
  const slots = zoneSlots(d, h.x, h.y, dir, -open);
  for (const p of TEAMS[d]) { defenderAI(p, h.x, h.y, dir, -open, defFormOf(d), slots); p.x = p.tx; p.y = p.ty; }
  holdDisc(h); visReset(); updateSelected();
  if (!D.goals) { D.t = 0; D.pen = 0; D.turns = 0; }
  D.line = 0; D.x0 = h.x;
  flash(`${D.i + 1}/3 · ` + (D.kind === 'att' ? `Marque ! (à ${s.d} m de l'en-but)` : D.goals ? 'On rejoue : défends !' : 'Défends : recule-les le moins possible'), true);
  dailyHud();
}
function dailyFrame(dt) {
  const D = G.daily; if (!D) return;
  if (D.wait > 0) { D.wait -= dt; if (D.wait <= 0) D.after(); return; }
  if (G.phase !== 'play' || G.paused) return;
  D.t += dt * SPEEDS[G.form.speed];
  if (D.kind === 'def' && disc.mode === 'held' && disc.holder && disc.holder.team === 1) D.line = Math.max(D.line, dirOf(1) * (disc.x - D.x0));
  dailyHud();
}
// une pause courte (le message reste à l'écran), puis la suite
function dailyPause(sec, fn) { const D = G.daily; G.phase = 'daily'; D.wait = sec; D.after = () => { G.phase = 'play'; fn(); }; }
const dailyVal = () => { const D = G.daily; return D.kind === 'att' ? D.t + D.pen : D.line + D.goals * DAILY.GOAL; };
// la situation est finie : on note, puis la suivante (ou la fin)
function dailyNext(msg) {
  const D = G.daily, v = dailyVal();
  D.res.push({ v: Math.round(v * 10) / 10, turns: D.turns, goals: D.goals });
  flash(`${msg} · ${dailyFmt(D.kind, v)}`, true); dailyHud();
  dailyPause(2, () => { D.i++; D.goals = 0; if (D.i >= D.sits.length) dailyFinish(); else dailySit(); });
}
// perte de disque (events.js : turnover, interception) — rend true si le défi s'en occupe
function dailyTurn(x, y, msg) {
  const D = G.daily; if (!D || G.phase !== 'play') return false;
  if (D.kind === 'def') { disc.mode = 'dead'; disc.holder = null; fxPlay('catch', x, y, 0); dailyNext('Disque récupéré ! 🛡️'); return true; }
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
  const D = G.daily;
  if (D.kind === 'att') { dailyNext('Point ! 🥏'); return; }
  D.goals++; D.line = 0;                                       // défense : point encaissé, on rejoue la situation
  if (D.goals >= DAILY.MAXG) { dailyNext(`${D.goals} points encaissés, on passe à la suite`); return; }
  flash(`Point encaissé : +${DAILY.GOAL} m`, true); dailyHud();
  dailyPause(2, dailySit);
}
function dailyRestore() {
  const D = G.daily; if (!D) return;
  Math.random = D.keep.rnd;
  if (D.bench) {
    for (const b of D.bench) TEAMS[b.team].push(b);
    players.length = 0; for (const t of [0, 1]) { TEAMS[t].sort((a, b) => a.i - b.i); players.push(...TEAMS[t]); }
    for (const t of [0, 1]) G.order[t] = [];
  }
  visReset();                                                   // (les joueurs revenus du banc : tout le monde se revoit)
  Object.assign(G.form, D.keep.form); Object.assign(G.ai, D.keep.ai);
  G.daily = null; G.score = [0, 0];
  $('dailyBox').style.display = 'none';
}
function dailyFinish() {
  const D = G.daily, total = Math.round(D.res.reduce((s, r) => s + r.v, 0) * 10) / 10, run = { n: D.n, kind: D.kind, total, res: D.res, official: D.official };
  if (D.official && !dailyDone(D.n)) { const all = dailyAll(); all[D.n] = { kind: D.kind, total, res: D.res, at: Date.now() }; storeSet('uf-daily', all); }
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
function dailyHud() {
  const D = G.daily; if (!D) return;
  const v = dailyVal(), done = D.res.map((r, k) => dailyMark(D.kind, r.v, D.sits[k])).join('');
  $('dailyStats').textContent = `${D.i + 1}/3 ${done} · ` + (D.kind === 'att'
    ? `⏱ ${D.t.toFixed(1)} s` + (D.pen ? ` + ${D.pen} s` : '')
    : `📏 ${Math.round(D.line)} m` + (D.goals ? ` + ${D.goals * DAILY.GOAL} m` : ''));
  $('dailyTitle').textContent = `Défi du jour #${D.n} · ${DAILY_NAMES[D.kind]}` + (D.official ? '' : ' (entraînement)');
  $('dailyText').innerHTML = D.kind === 'att'
    ? `Marque le plus vite possible. Une perte de disque : <b>+${DAILY.PEN} s</b>, et on te le rend.`
    : `3 contre 3 : la ligne avance à chaque passe. Un point encaissé : <b>+${DAILY.GOAL} m</b> et on rejoue. Change de joueur pour aller au disque.`;
}
// la ligne jusqu'où l'adversaire a avancé (défense)
function drawDaily() {
  const D = G.daily; if (!D || D.kind !== 'def') return;
  const x = D.x0 + dirOf(1) * D.line;
  ctx.save(); ctx.strokeStyle = 'rgba(250,204,21,.85)'; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
  ctx.beginPath(); ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(H)); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `700 ${Math.max(11, S * 1.3)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#facc15';
  ctx.fillText(Math.round(D.line) + ' m', X(x), Y(0) - 6);
  ctx.restore();
}
function dailyShareText(n, run) {
  const marks = run.res.map((r, k) => dailyMark(run.kind, r.v, dailyGen(n).sits[k])).join('');
  const url = String(location.href || '').split(/[?#]/)[0] + '?defi=' + n;
  return `🥏 Ultimate du jour #${n} · ${DAILY_NAMES[run.kind]}\n${marks} ${dailyFmt(run.kind, run.total)}` + (run.kind === 'att' ? ' ⏱' : ' 📏') + `\n${url}`;
}
// le panneau du défi : avant (règles, Commencer), après (score, Partager, rejouer pour s'entraîner)
function showDaily(n, run) {
  n = n || dailyNum();
  const today = dailyNum(), done = dailyDone(n), kind = dailyKind(n), res = run || (done && Object.assign({ n, official: true }, done));
  G.menuShown = true;
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard', 'endlessCard']) $(id).style.display = 'none';
  $('dailyCard').style.display = ''; $('overlay').classList.remove('hidden');
  $('dailyHead').textContent = `📅 Défi du jour #${n} · ${DAILY_NAMES[kind]}` + (n !== today ? ' (jour passé)' : '');
  const streak = dailyStreak();
  $('dailyRules').innerHTML = (kind === 'att'
    ? `<b>Attaque, 5 contre 5</b> : 3 situations, marque le plus vite possible. Pas de limite de temps, mais une perte de disque ajoute <b>${DAILY.PEN} s</b> (on te rend le disque).`
    : `<b>Défense, 3 contre 3</b> : 3 situations. La ligne jaune avance à chaque passe reçue par l'adversaire. S'il marque : <b>+${DAILY.GOAL} m</b> et on rejoue, jusqu'à ce que tu récupères le disque (${DAILY.MAXG} points au plus). Change de joueur pour aller au disque.`)
    + ` Le plus petit score gagne.` + (streak ? ` · Série : <b>${streak} jour${streak > 1 ? 's' : ''}</b> 🔥` : '');
  if (res) {
    $('dailyRes').innerHTML = `<b>${res.official ? 'Ton score' : 'Score (entraînement, non compté)'} : ${dailyFmt(res.kind, res.total)}</b><br>`
      + res.res.map((r, k) => `${dailyMark(res.kind, r.v, dailyGen(n).sits[k])} Situation ${k + 1} : ${dailyFmt(res.kind, r.v)}` + (r.turns ? ` (${r.turns} perte${r.turns > 1 ? 's' : ''})` : '') + (r.goals ? ` (${r.goals} point${r.goals > 1 ? 's' : ''} encaissé${r.goals > 1 ? 's' : ''})` : '')).join('<br>');
    $('dailyRes').style.display = '';
  } else $('dailyRes').style.display = 'none';
  const official = n === today && !done;
  $('dailyGo').textContent = official ? 'Commencer ▶' : 'Rejouer pour s’entraîner ▶';
  $('dailyGo').classList.toggle('primary', official);
  $('dailyGo').onclick = () => dailyStart(n, official);
  $('dailyShare').style.display = done || (run && run.official) ? '' : 'none';
  $('dailyShare').onclick = () => {
    const r = dailyDone(n); if (!r) return;
    const txt = dailyShareText(n, r);
    if (navigator.share && isTouchUI()) navigator.share({ text: txt }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => { $('dailyShare').textContent = 'Copié ✓'; setTimeout(() => { $('dailyShare').textContent = 'Partager 📤'; }, 1500); }).catch(() => prompt('Copie ce texte :', txt));
    else prompt('Copie ce texte :', txt);
  };
  $('dailyShare').textContent = 'Partager 📤';
  // les jours passés (pour s'entraîner, hors compétition)
  const past = []; for (let k = today - 1; k >= Math.max(1, today - 6); k--) past.push(k);
  $('dailyPast').innerHTML = past.length ? 'Jours passés : ' + past.map(k => `<button class="ghost" data-n="${k}">#${k} ${DAILY_NAMES[dailyKind(k)]}${dailyDone(k) ? ' ✓' : ''}</button>`).join(' ') : '';
  $('dailyPast').querySelectorAll('button').forEach(b => b.addEventListener('click', () => showDaily(+b.dataset.n)));
}
// bouton de l'accueil : numéro du jour, et ton score s'il est déjà fait
function dailyHomeTxt() {
  const n = dailyNum(), d = dailyDone(n);
  return d ? `Fait : ${dailyFmt(d.kind, d.total)} · reviens demain !` : `#${n} · ${DAILY_NAMES[dailyKind(n)]} : le même pour tout le monde, un essai par jour`;
}
if (typeof document !== 'undefined' && document.getElementById('dailyB')) {
  $('dailyB').addEventListener('click', () => { backToSolo(); showDaily(); });
  $('dailyQuit').addEventListener('click', dailyQuit);
  $('dailyBack').addEventListener('click', () => { $('dailyCard').style.display = 'none'; showLobby(); });
}
