// stats.js — Statistiques du match et résumé de fin de partie

function newMatch() {
  G.score = [0, 0]; G.receiving = firstReceiver();
  newMatchStats();
}
// équipe qui commence en attaque (elle reçoit le premier pull) : choisie dans le menu, ou tirée au sort
function firstReceiver() {
  const f = G.form.first;
  if (f === '0' || f === '1') return +f;
  if (G.firstRoll !== 0 && G.firstRoll !== 1) G.firstRoll = Math.random() < 0.5 ? 0 : 1;
  return G.firstRoll;
}
function newMatchStats() {
  G.ms = {
    pl: players.map(() => ({ thr: 0, comp: 0, ast: 0, gol: 0, blk: 0, int: 0, drp: 0, to: 0 })),
    team: [0, 1].map(() => ({ thr: 0, comp: 0, to: 0, blk: 0, int: 0, long: 0, huck: 0, huckOk: 0, high: 0 })),
    points: [], ptT: 0
  };
}
const msPl = p => (G.ms && p ? G.ms.pl[players.indexOf(p)] : null);
const msTeam = t => (G.ms ? G.ms.team[t] : null);

// appelé depuis les événements de jeu
function msThrow(h, d, kind) {
  const a = msPl(h); if (!a) return;
  a.thr++; const T = msTeam(h.team); T.thr++;
  if (d > 25) T.huck++;
  if (kind === 'high') T.high++;
}
function msCatch(p, scored) {
  const th = disc.thrower, a = msPl(th); if (!a || disc.pull) return;
  a.comp++; const T = msTeam(p.team); T.comp++;
  const d = dist(disc.sx, disc.sy, p.x, p.y);
  if (d > T.long) T.long = d;
  if (d > 25) T.huckOk++;
  if (scored) { msPl(p).gol++; a.ast++; }
}
function msTurnover(culprit, kind, defender) {                 // kind : 'drop' | 'throw' | 'stall'
  if (!G.ms) return;
  const c = msPl(culprit);
  if (c) { if (kind === 'drop') c.drp++; c.to++; msTeam(culprit.team).to++; }
  const d = msPl(defender);
  if (d) { if (kind === 'int') { d.int++; msTeam(defender.team).int++; } else { d.blk++; msTeam(defender.team).blk++; } }
}
function msPoint(t) {
  if (!G.ms) return;
  G.ms.points.push([t, Math.round(G.ms.ptT)]);
}

// ---------- résumé ----------
const plName = p => PLAYER_NAMES[p.team][p.i];
function mvpScore(s) { return s.gol * 3 + s.ast * 3 + s.blk * 3 + s.int * 4 + s.comp * 0.4 - s.to * 2 - s.drp * 1.5; }
// objet compact (envoyé tel quel aux invités en ligne)
function matchSummary() {
  if (!G.ms) return null;
  const pl = players.map((p, k) => Object.assign({ t: p.team, i: p.i, n: plName(p), v: +mvpScore(G.ms.pl[k]).toFixed(1) }, G.ms.pl[k]));
  const best = pl.slice().sort((a, b) => b.v - a.v)[0];
  return { score: G.score.slice(), teams: G.teams.map(o => Object.assign({}, o)), team: G.ms.team.map(o => Object.assign({}, o)),
    pl, mvp: best && best.v > 0 ? best.t * N + best.i : -1, points: G.ms.points.slice() };
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function statLine(s) {
  const bits = [];
  if (s.gol) bits.push(s.gol + (s.gol > 1 ? ' buts' : ' but'));
  if (s.ast) bits.push(s.ast + (s.ast > 1 ? ' assists' : ' assist'));
  if (s.blk + s.int) bits.push((s.blk + s.int) + ((s.blk + s.int) > 1 ? ' blocks' : ' block'));
  if (s.comp) bits.push(s.comp + (s.comp > 1 ? ' passes' : ' passe'));
  return bits.join(', ') || 'discret';
}
function renderSummary(sum) {
  const el = document.getElementById('summary');
  if (!el) return;
  if (!sum) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  const col = t => esc((PALETTE[sum.teams[t].color] || PALETTE.bleu)[0]);
  const nm = t => esc(sum.teams[t].name);
  const T = sum.team, pct = o => (o.thr ? Math.round(100 * o.comp / o.thr) : 0) + ' %';
  const rows = [
    ['Passes réussies', o => `${o.comp}/${o.thr} <small>(${pct(o)})</small>`],
    ['Turnovers', o => o.to],
    ['Blocks + interceptions', o => o.blk + o.int],
    ['Plus longue passe', o => Math.round(o.long) + ' m'],
    ['Hucks réussis (> 25 m)', o => `${o.huckOk}/${o.huck}`]
  ];
  const dots = sum.points.map(([t]) => `<i style="background:${col(t)}"></i>`).join('');
  const mvp = sum.mvp >= 0 ? sum.pl[sum.mvp] : null;
  const plRows = t => sum.pl.filter(o => o.t === t).sort((a, b) => b.v - a.v).map(o =>
    `<tr><td>${esc(o.n)}</td><td>${o.gol}</td><td>${o.ast}</td><td>${o.blk + o.int}</td><td>${o.comp}/${o.thr}</td><td>${o.to}</td></tr>`).join('');
  el.innerHTML = `
    <div class="sumScore"><span style="color:${col(0)}">${nm(0)}</span> <b>${sum.score[0]} – ${sum.score[1]}</b> <span style="color:${col(1)}">${nm(1)}</span></div>
    <div class="sumDots" title="Déroulé des points">${dots}</div>
    ${mvp ? `<div class="mvp">⭐ MVP : <b style="color:${col(mvp.t)}">${esc(mvp.n)}</b> (${nm(mvp.t)}) — ${esc(statLine(mvp))}</div>` : ''}
    <table class="sumT"><tr><th></th><th style="color:${col(0)}">${nm(0)}</th><th style="color:${col(1)}">${nm(1)}</th></tr>
      ${rows.map(([l, f]) => `<tr><td>${l}</td><td>${f(T[0])}</td><td>${f(T[1])}</td></tr>`).join('')}</table>
    <details><summary>Stats des joueurs</summary>
      ${[0, 1].map(t => `<table class="sumP"><tr><th style="color:${col(t)}">${nm(t)}</th><th title="Buts">B</th><th title="Assists">A</th><th title="Blocks et interceptions">D</th><th title="Passes réussies / tentées">Passes</th><th title="Turnovers">TO</th></tr>${plRows(t)}</table>`).join('')}
    </details>`;
}
