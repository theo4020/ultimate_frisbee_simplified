// practice.js — Mode entraînement : lancer sur des cibles, à son rythme.
// Options : vent (aucun / léger / fort) et un défenseur planté dans la ligne (pour s'exercer à la courbe
// et à la passe haute). La cible rétrécit tant que la série continue.

function practiceStart() {
  backToSolo();
  G.series = null; G.ms = null;
  G.practice = { score: 0, tries: 0, streak: 0, best: storeGet('uf-practice-best', 0) | 0, wind: '0', def: false, target: null, wait: 0, spots: null };
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard']) $(id).style.display = 'none';
  $('overlay').classList.add('hidden'); G.menuShown = false;
  $('pracBox').style.display = '';
  practiceRound(); practiceUI(); resize();
}
function practiceQuit() {
  if (!G.practice) return;
  G.practice = null;
  $('pracBox').style.display = 'none'; resize();
  G.phase = 'menu'; newWind(); placeForPoint(); showLobby();
}
function practiceWind() {
  const P = G.practice, kmh = P.wind === '0' ? 0 : P.wind === '1' ? rand(8, 16) : rand(22, 32), a = rand(0, Math.PI * 2);
  G.wind = { x: Math.cos(a) * kmh / 3.6, y: Math.sin(a) * kmh / 3.6, kmh };
}
// nouvelle cible : le lanceur, la cible, et (option) un défenseur entre les deux
function practiceRound() {
  const P = G.practice;
  players.forEach(p => Object.assign(p, { vx: 0, vy: 0, dive: 0, down: 0, jump: 0, jprep: 0, jrec: 0, jumpCd: 0, react: 0, tag: '', match: null, windup: null }));
  Object.assign(G, { phase: 'play', oplay: null, dplay: null, pendingOPlay: null, pullPending: false, carryTo: null, stall: 0, marker: null, dbl: null, pickup: null, throwKind: 'normal' });
  disc.pull = false;
  practiceWind();
  const h = TEAMS[0][0];
  h.x = rand(22, 40); h.y = rand(8, H - 8);
  let tx, ty, d;
  for (let k = 0; k < 40; k++) {
    d = rand(10, 38); const a = rand(-1.05, 1.05);
    tx = h.x + Math.cos(a) * d; ty = h.y + Math.sin(a) * d;
    if (tx > 3 && tx < W - 2 && ty > 2.5 && ty < H - 2.5) break;
  }
  tx = clamp(tx, 3, W - 2); ty = clamp(ty, 2.5, H - 2.5);
  P.target = { x: tx, y: ty, r: Math.max(1.3, 2.4 - P.streak * 0.12) };
  // coéquipiers et adversaires rangés hors du jeu ; le défenseur (option) se plante dans la ligne
  const spots = new Map();
  TEAMS[0].forEach((p, k) => { if (k) spots.set(p, [1.5, 2 + k * 2]); });
  TEAMS[1].forEach((p, k) => spots.set(p, [1.5, H - 2 - k * 2]));
  if (P.def) { const f = rand(5.6, 7.5) / dist(h.x, h.y, tx, ty); spots.set(TEAMS[1][0], [h.x + (tx - h.x) * f, h.y + (ty - h.y) * f]); }
  for (const [p, s] of spots) { p.x = p.tx = s[0]; p.y = p.ty = s[1]; }
  P.spots = spots; P.wait = 0;
  G.off = 0; holdDisc(h); updateSelected();
}
function practicePin(p) {
  const s = G.practice.spots && G.practice.spots.get(p);
  if (!s) return false;
  p.tx = s[0]; p.ty = s[1]; p.sp = SPD.cut;
  return true;
}
// le disque retombe : dans la cible ?
function practiceLanded(x, y) {
  const P = G.practice, T = P.target, d = dist(x, y, T.x, T.y);
  P.tries++;
  Object.assign(disc, { mode: 'ground', holder: null, x: clamp(x, -1, W + 1), y: clamp(y, -1, H + 1), z: 0 });
  if (d <= T.r) {
    P.score++; P.streak++;
    if (P.streak > P.best) { P.best = P.streak; storeSet('uf-practice-best', P.best); }
    flash(d <= T.r * 0.35 ? 'Dans le mille ! 🎯' : 'Touché !', true); fxPlay('catch', x, y, 0);
    achEvent('practice', P.streak);
  } else { P.streak = 0; flash(`Raté de ${(d - T.r).toFixed(1)} m`, true); fxPlay('land', x, y, 0); }
  P.wait = 1.0; practiceUI();
}
function practiceMiss(msg) {
  const P = G.practice;
  P.tries++; P.streak = 0; P.wait = 1.1;
  Object.assign(disc, { mode: 'ground', holder: null, z: 0 });
  flash(msg, true); practiceUI();
}
function practiceFrame(dt) {
  const P = G.practice;
  if (P.wait > 0) { P.wait -= dt; if (P.wait <= 0) practiceRound(); }
}
function practiceUI() {
  const P = G.practice; if (!P) return;
  $('pracStats').textContent = `Cibles ${P.score} / ${P.tries} · série ${P.streak} · record ${P.best}`;
  $('pracWind').textContent = 'Vent : ' + { 0: 'aucun', 1: 'léger', 2: 'fort' }[P.wind];
  $('pracDef').textContent = 'Défenseur : ' + (P.def ? 'oui' : 'non');
  $('pracText').innerHTML = isTouchUI()
    ? 'Glisse pour lancer dans la cible. Courbe : curseur à droite ; <b>Passe haute</b> pour passer par-dessus le défenseur. La cible rétrécit si tu enchaînes.'
    : 'Lance dans la cible. Courbe avec A / E ou la molette ; <b>Z</b> pour armer une passe haute par-dessus le défenseur. La cible rétrécit si tu enchaînes.';
}
// cible dessinée sur le terrain
function drawPractice() {
  const P = G.practice; if (!P || !P.target) return;
  const T = P.target, pulse = 1 + Math.sin(G.time * 4) * 0.04;
  ctx.save();
  [[1, 'rgba(250,204,21,.25)'], [0.66, 'rgba(255,255,255,.35)'], [0.35, 'rgba(239,68,68,.55)']].forEach(([k, c]) => {
    ctx.fillStyle = c; circle(X(T.x), Y(T.y), T.r * k * S * pulse); ctx.fill();
  });
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; circle(X(T.x), Y(T.y), T.r * S * pulse); ctx.stroke();
  if (disc.mode === 'held' && disc.holder) {
    ctx.font = `700 ${Math.max(10, S * 1.3)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(Math.round(dist(disc.holder.x, disc.holder.y, T.x, T.y)) + ' m', X(T.x), Y(T.y) - T.r * S - 6);
  }
  ctx.restore();
}
if (typeof document !== 'undefined' && document.getElementById('pracB')) {
  $('pracB').addEventListener('click', practiceStart);
  $('pracQuit').addEventListener('click', practiceQuit);
  $('pracWind').addEventListener('click', () => { const P = G.practice; if (!P) return; P.wind = { 0: '1', 1: '2', 2: '0' }[P.wind]; practiceWind(); practiceUI(); });
  $('pracDef').addEventListener('click', () => { const P = G.practice; if (!P) return; P.def = !P.def; if (disc.mode === 'held') practiceRound(); practiceUI(); });
}
