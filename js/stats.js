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
    team: [0, 1].map(() => ({ thr: 0, comp: 0, to: 0, blk: 0, int: 0, long: 0, huck: 0, huckOk: 0, high: 0, pos: 0, lay: 0 })),
    points: [], ptT: 0,
    hu: {},                                                   // par humain (id) : ce que TOI tu as fait (en ligne, chacun sa ligne)
    mom: null                                                  // moment du match : la plus belle action qui a marqué
  };
  if (typeof REPLAY !== 'undefined') REPLAY.mom = null;
}
// humain qui joue ce joueur (pour ses stats) : lanceur → celui qui lance pour lui ; sinon celui qui le dirige
function msHumOf(p, throwing) {
  if (!p || typeof teamHumans !== 'function') return null;
  const hs = teamHumans(p.team);
  if (hs.length === 1 && G.off === p.team) return throwing ? hs[0] : null;   // seul en attaque : il lance, l'IA fait les cuts
  return hs.find(h => h.sel === p) || null;
}
function msHu(h) {
  if (!G.ms || !h) return null;
  return G.ms.hu[h.id] || (G.ms.hu[h.id] = { n: humanLabel(h), t: h.team, thr: 0, comp: 0, ast: 0, gol: 0, blk: 0, lay: 0, to: 0 });
}
const msName = (p, h) => (h ? humanLabel(h) : plName(p));
// une action qui marque : on garde la plus belle (Callahan > point en plongeon > longue passe)
function msMoment(m) {
  if (!G.ms || (G.ms.mom && G.ms.mom.s >= m.s)) return;
  m.sc = G.score.slice(); G.ms.mom = m; G.ms.momFresh = true;
}
const msPl = p => (G.ms && p ? G.ms.pl[players.indexOf(p)] : null);
const msTeam = t => (G.ms ? G.ms.team[t] : null);

// appelé depuis les événements de jeu
function msThrow(h, d, kind) {
  const a = msPl(h); if (!a) return;
  a.thr++; const T = msTeam(h.team); T.thr++;
  if (d > 25) T.huck++;
  if (kind === 'high') T.high++;
  const u = msHumOf(h, true); disc.thH = u ? u.id : -1;
  const b = msHu(u); if (b) b.thr++;
}
function msCatch(p, scored) {
  const th = disc.thrower, a = msPl(th); if (!a || disc.pull) return;
  a.comp++; const T = msTeam(p.team); T.comp++;
  const d = dist(disc.sx, disc.sy, p.x, p.y);
  if (d > T.long) T.long = d;
  if (d > 25) T.huckOk++;
  if (scored) { msPl(p).gol++; a.ast++; }
  const tu = disc.thH >= 0 ? G.ms.hu[disc.thH] : null, cu = msHumOf(p), c = msHu(cu);
  if (tu) { tu.comp++; if (scored) tu.ast++; }
  if (c && scored) c.gol++;
  if (scored) {
    const by = msName(th, tu && humanById(disc.thH)), to = msName(p, cu), lay = p.dive > 0;
    msMoment({ s: d + (lay ? 40 : 0), k: lay ? 'layout' : d > 25 ? 'huck' : 'pass', t: p.team, d: Math.round(d),
      txt: lay ? `Point en plongeon de ${to}, sur une passe de ${Math.round(d)} m de ${by}` : `Passe de ${Math.round(d)} m de ${by} pour ${to}` });
  }
}
function msLayout(p) {
  if (!G.ms) return;
  msTeam(p.team).lay++;
  const b = msHu(msHumOf(p)); if (b) b.lay++;
}
function msCallahan(p) {
  if (!G.ms) return;
  msPl(p).gol++;
  const u = msHumOf(p), b = msHu(u); if (b) b.gol++;
  msMoment({ s: 1000, k: 'callahan', t: p.team, txt: `Callahan de ${msName(p, u)} : interception dans l’en-but adverse` });
}
function msTurnover(culprit, kind, defender) {                 // kind : 'drop' | 'throw' | 'stall'
  if (!G.ms) return;
  const c = msPl(culprit);
  if (c) { if (kind === 'drop') c.drp++; c.to++; msTeam(culprit.team).to++; }
  const cu = kind === 'drop' ? msHu(msHumOf(culprit)) : kind === 'stall' ? msHu(msHumOf(culprit, true)) : disc.thH >= 0 ? G.ms.hu[disc.thH] : null;
  if (cu) cu.to++;
  const du = msHu(msHumOf(defender)); if (du) du.blk++;
  const d = msPl(defender);
  if (d) { if (kind === 'int') { d.int++; msTeam(defender.team).int++; } else { d.blk++; msTeam(defender.team).blk++; } }
}
function msPoint(t) {
  if (!G.ms) return;
  G.ms.points.push([t, Math.round(G.ms.ptT)]);
}

// ---------- résumé ----------
const plName = p => PLAYER_NAMES[p.team][p.i];
// objet compact (envoyé tel quel aux invités en ligne)
function matchSummary() {
  if (!G.ms) return null;
  return { score: G.score.slice(), teams: G.teams.map(o => Object.assign({}, o)), team: G.ms.team.map(o => Object.assign({}, o)),
    points: G.ms.points.slice(), hu: Object.keys(G.ms.hu).map(id => Object.assign({ id: +id }, G.ms.hu[id])).filter(o => o.t >= 0), mom: G.ms.mom };
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
// écran de fin : le panneau du score, le moment du match, l'équipe contre l'équipe, et chaque humain en ligne
// (pas de stats par joueur IA : ils sont tous pareils, ça n'avait pas de sens)
const pl_ = (n, w) => w + (n > 1 ? 's' : '');
function renderSummary(sum) {
  const el = document.getElementById('summary');
  if (!el) return;
  if (!sum) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  const col = t => esc((PALETTE[sum.teams[t].color] || PALETTE.bleu)[0]);
  const nm = t => esc(sum.teams[t].name);
  const T = sum.team, pct = (a, b) => (b ? Math.round(100 * a / b) : 0);
  const led = n => (typeof ledDigits === 'function' ? ledDigits(n) : `<b>${n}</b>`);
  const pos = T[0].pos + T[1].pos;
  // [libellé, valeur affichée, valeur comparée, plus c'est haut mieux c'est ?]
  const rows = [
    ['Passes réussies', o => `${o.comp}/${o.thr} <small>${pct(o.comp, o.thr)} %</small>`, o => pct(o.comp, o.thr), 1],
    ['Possession', o => pct(o.pos || 0, pos) + ' %', o => o.pos || 0, 1, () => pos > 0],
    ['Pertes de balle', o => o.to, o => o.to, 0],
    ['Blocks + interceptions', o => o.blk + o.int, o => o.blk + o.int, 1],
    ['Hucks réussis <small>(> 25 m)</small>', o => `${o.huckOk}/${o.huck}`, o => o.huckOk, 1],
    ['Plus longue passe', o => Math.round(o.long) + ' m', o => o.long, 1],
    ['Plongeons', o => o.lay || 0, o => o.lay || 0, 1, () => T[0].lay !== undefined]
  ].filter(r => !r[4] || r[4]());
  const bar = (a, b) => { const s_ = a + b; return s_ > 0 ? Math.round(100 * a / s_) : 50; };
  const cmp = rows.map(([l, f, v, up]) => {
    const a = v(T[0]), b = v(T[1]), w = bar(a, b), best = a === b ? -1 : (a > b) === !!up ? 0 : 1;
    return `<div class="cmp"><span class="${best === 0 ? 'best' : ''}">${f(T[0])}</span><em>${l}</em><span class="${best === 1 ? 'best' : ''}">${f(T[1])}</span>
      <i class="cbar"><b style="width:${w}%;background:${col(0)}"></b><b style="width:${100 - w}%;background:${col(1)}"></b></i></div>`;
  }).join('');
  const dots = sum.points.map(([t], k) => `<i style="background:${col(t)}" title="Point ${k + 1}"></i>`).join('');
  const m = sum.mom;
  const canReplay = !G.net && typeof REPLAY !== 'undefined' && REPLAY.mom;
  const KIND = { callahan: '🦅 Callahan', layout: '🤸 Plongeon décisif', huck: '🚀 Huck', pass: '🥏 Le point' };
  const momHtml = m ? `<div class="sumMom" style="--tc:${col(m.t)}"><div class="smHead"><span>Moment du match</span><b>${KIND[m.k] || ''}</b></div>
      <p>${esc(m.txt)}${m.sc ? ` <small>(${m.t === 0 ? m.sc[0] + 1 : m.sc[0]}–${m.t === 1 ? m.sc[1] + 1 : m.sc[1]})</small>` : ''}</p>
      ${canReplay ? '<button id="momReplayB" class="ghost">🎬 Revoir au ralenti</button>' : ''}</div>` : '';
  const hu = (sum.hu || []).slice().sort((a, b) => a.t - b.t || (b.gol + b.ast + b.blk) - (a.gol + a.ast + a.blk));
  const huHtml = hu.length >= 2 ? `<div class="sumH"><div class="smHead"><span>Les joueurs</span></div>${hu.map(o => `
      <div class="huCard" style="--tc:${col(o.t)}"><b>${esc(o.n)}</b>
        <span><i>${o.comp}/${o.thr}</i>passes</span><span><i>${o.ast}</i>${pl_(o.ast, 'décisive')}</span><span><i>${o.gol}</i>${pl_(o.gol, 'point')}</span>
        <span><i>${o.blk}</i>${pl_(o.blk, 'block')}</span><span><i>${o.lay}</i>${pl_(o.lay, 'plongeon')}</span><span><i>${o.to}</i>${pl_(o.to, 'perte')}</span></div>`).join('')}</div>` : '';
  el.innerHTML = `
    <div class="sumBoard">
      <span class="sbName" style="--tc:${col(0)}">${nm(0)}</span>
      <span class="sbLed">${led(sum.score[0])}</span><span class="sbSep">–</span><span class="sbLed">${led(sum.score[1])}</span>
      <span class="sbName r" style="--tc:${col(1)}">${nm(1)}</span>
    </div>
    <div class="sumDots" title="Déroulé des points">${dots}</div>
    ${momHtml}
    <div class="sumCmp"><div class="smHead"><span style="color:${col(0)}">${nm(0)}</span><span style="color:${col(1)}">${nm(1)}</span></div>${cmp}</div>
    ${huHtml}`;
  const rb = document.getElementById('momReplayB');
  if (rb) rb.addEventListener('click', () => startReplay('mom'));
}
