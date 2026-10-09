// series.js — Mini-tournoi : trois matchs contre des adversaires de plus en plus forts.
// La progression est gardée dans le navigateur (on peut revenir plus tard).

function seriesState() {
  const s = storeGet('uf-series', null);
  if (s && Array.isArray(s.res) && s.res.length === 3 && Number.isInteger(s.round)) return s;
  return { round: 0, res: [null, null, null], tries: [0, 0, 0] };
}
const LVL_NAME = { facile: 'Facile', normal: 'Normal', difficile: 'Difficile' };

function showSeries() {
  G.menuShown = true; G.series = null;
  for (const id of ['lobbyCard', 'stratCard']) $(id).style.display = 'none';
  $('seriesCard').style.display = '';
  const s = seriesState(), champ = s.round >= SERIES.length;
  $('seriesText').textContent = champ ? 'Tu as battu les trois équipes : tu es champion ! 🏆 Tu peux rejouer le tournoi depuis le début.'
    : s.round === 0 && !s.tries[0] ? 'Trois matchs, trois adversaires de plus en plus forts. Gagne pour passer au tour suivant ; si tu perds, retente ta chance autant de fois que tu veux.'
    : `Prochain match : tour ${s.round + 1} sur 3.`;
  $('seriesList').innerHTML = SERIES.map((o, k) => {
    const done = s.res[k], cur = k === s.round, col = PALETTE[o.color][0];
    const st = done ? `<span class="sres win">Gagné ${done[0]}–${done[1]}</span>`
      : cur ? `<span class="sres">${s.tries[k] ? s.tries[k] + ' essai' + (s.tries[k] > 1 ? 's' : '') : 'À jouer'}</span>`
      : '<span class="sres lock">🔒</span>';
    return `<li class="${done ? 'done' : cur ? 'cur' : 'lock'}"><i style="background:${col}"></i><div><b>Tour ${k + 1} · ${esc(o.name)}</b>
      <small>${LVL_NAME[o.level]} — ${esc(o.blurb)}</small></div>${st}</li>`;
  }).join('');
  $('seriesGo').style.display = champ ? 'none' : '';
  if (!champ) $('seriesGo').textContent = `Jouer le tour ${s.round + 1} contre les ${SERIES[s.round].name} ▶`;
  $('seriesReset').style.display = s.round > 0 || s.tries.some(Boolean) ? '' : 'none';
  $('seriesReset').classList.toggle('primary', champ);
  $('overlay').classList.remove('hidden');
}
function seriesPlay() {
  const s = seriesState();
  if (s.round >= SERIES.length) return;
  backToSolo();
  G.series = { cur: s.round };
  newMatch();
  $('seriesCard').style.display = 'none';
  showMenu('first');
}
// fin d'un match (tous modes) : résumé, et résultat du tournoi
function onMatchOver() {
  computeTeams();
  G.lastSummary = matchSummary();
  if (!G.series) return;
  const s = seriesState(), k = G.series.cur, won = G.score[G.me] > G.score[1 - G.me];
  s.tries[k] = (s.tries[k] || 0) + 1;
  if (won) { s.res[k] = [G.score[G.me], G.score[1 - G.me]]; if (s.round === k) s.round = k + 1; }
  storeSet('uf-series', s);
  G.series.won = won;
}
if (typeof document !== 'undefined' && document.getElementById('seriesGo')) {
  $('seriesGo').addEventListener('click', seriesPlay);
  $('seriesB').addEventListener('click', () => { backToSolo(); showSeries(); });
  $('seriesReset').addEventListener('click', () => { storeSet('uf-series', null); showSeries(); });
  $('seriesBack').addEventListener('click', () => { $('seriesCard').style.display = 'none'; showLobby(); });
}
