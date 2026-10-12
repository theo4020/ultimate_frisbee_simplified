// endless.js — Mode infini : des matchs en 3 points enchaînés contre des adversaires de plus en plus forts.
// La difficulté monte en continu (un peu à chaque point joué, beaucoup à chaque match) ; la série s'arrête à la
// première défaite. Score = matchs gagnés, puis écart de points. Classement mondial via /api/scores (worker/index.js),
// et tes meilleures séries gardées dans le navigateur.

const ENDLESS_PTS = 3;
// niveaux de référence : la difficulté d passe par facile (0), normal (3), difficile (7), légende (14 et au-delà)
const LEGEND = { react: 0.55, anticip: 0.55, block: 0.78, speed: 1.09, err: 0.45, safe: 0.14 };
const ENDLESS_STEPS = [[0, AI_LEVELS.facile], [3, AI_LEVELS.normal], [7, AI_LEVELS.difficile], [14, LEGEND]];
function endlessLevel(d) {
  const S = ENDLESS_STEPS;
  if (d <= S[0][0]) return S[0][1];
  for (let i = 1; i < S.length; i++) {
    if (d <= S[i][0]) {
      const [d0, a] = S[i - 1], [d1, b] = S[i], k = (d - d0) / (d1 - d0), o = {};
      for (const key in a) o[key] = a[key] + (b[key] - a[key]) * k;
      return o;
    }
  }
  return S[S.length - 1][1];
}
// difficulté du moment : le numéro du match, plus jusqu'à 0,8 au fil des points du match
const endlessD = () => G.series.cur + 0.8 * Math.min(1, (G.score[0] + G.score[1]) / (2 * ENDLESS_PTS - 1));

const ENDLESS_NAMES = ['Écureuils', 'Mouettes', 'Hérissons', 'Renards', 'Castors', 'Faucons', 'Loups', 'Pumas', 'Requins', 'Ours',
  'Aigles', 'Panthères', 'Cyclones', 'Volcans', 'Dragons', 'Titans', 'Météores', 'Légendes'];
const ENDLESS_COLORS = ['orange', 'turquoise', 'violet', 'rose', 'jaune', 'noir', 'rouge', 'blanc'];
const endlessTier = d => (d < 2 ? 'Débutants' : d < 5 ? 'Bon niveau' : d < 8 ? 'Très forts' : d < 12 ? 'Élite' : 'Légendaires');

// adversaire du match n (0, 1, 2…) : nom, couleur, style de jeu (repris des équipes du tournoi), niveau calculé en direct
function endlessOpp(n) {
  const name = ENDLESS_NAMES[n % ENDLESS_NAMES.length] + (n >= ENDLESS_NAMES.length ? ' ' + (Math.floor(n / ENDLESS_NAMES.length) + 1) : '');
  const style = SERIES[Math.min(SERIES.length - 1, Math.floor(n / 3))].style;
  return { name, color: ENDLESS_COLORS[n % ENDLESS_COLORS.length], style, level: () => endlessLevel(endlessD()),
    blurb: `Adversaire n° ${n + 1} · ${endlessTier(n)}. Premier à ${ENDLESS_PTS} points ; une défaite et la série s'arrête.` };
}
function endlessStart() {
  backToSolo();
  G.series = { endless: true, cur: 0, opp: endlessOpp(0), pts: ENDLESS_PTS, wins: 0, diff: 0 };
  newMatch();
  $('endlessCard').style.display = 'none'; $('lobbyCard').style.display = 'none';
  showMenu('first');
}
// fin d'un match (appelé par onMatchOver)
function endlessOver(won) {
  const S = G.series;
  S.diff += G.score[G.me] - G.score[1 - G.me];
  if (won) { S.wins++; return; }
  S.done = true;
  const loc = endlessLocal();
  S.best = S.wins > loc.best;
  loc.best = Math.max(loc.best, S.wins);
  loc.runs = loc.runs.concat([{ wins: S.wins, diff: S.diff, at: Date.now() }]).sort(cmpRun).slice(0, 5);
  storeSet('uf-endless', loc);
  S.toSave = true;                                             // le joueur choisit ensuite d'enregistrer (avec un pseudo) ou non
}
const endlessOverText = won => won
  ? `${G.series.wins} match${G.series.wins > 1 ? 's' : ''} gagné${G.series.wins > 1 ? 's' : ''} d'affilée ! Prochain adversaire : les ${endlessOpp(G.series.cur + 1).name}, encore un peu plus forts.`
  : `Fin de la série : ${G.series.wins} match${G.series.wins > 1 ? 's' : ''} gagné${G.series.wins > 1 ? 's' : ''}.` + (G.series.best ? ' Nouveau record personnel ! 🏅' : '');
function endlessNext() {
  const S = G.series;
  if (S.done) { showEndless(S); return; }
  S.cur++; S.opp = endlessOpp(S.cur);
  newMatch();
  showMenu('first');
}

// ---------- scores ----------
const cmpRun = (a, b) => b.wins - a.wins || b.diff - a.diff || a.at - b.at;
function endlessLocal() {
  const o = storeGet('uf-endless', null);
  return o && Array.isArray(o.runs) ? o : { best: 0, runs: [] };
}
let boardCache = null;                                         // { top: [...] } ou null si pas de classement mondial
function endlessFetch() {
  return fetch('api/scores', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => (boardCache = j && Array.isArray(j.top) ? j : null)).catch(() => (boardCache = null));
}
function endlessSubmit(name, wins, diff) {
  return fetch('api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, wins, diff }) })
    .then(r => r.json().then(j => (r.ok ? j : { error: j.error || 'erreur ' + r.status })))
    .then(j => { if (j.top) { boardCache = j; if (j.id) storeSet('uf-endless-ids', storeGet('uf-endless-ids', []).concat([j.id]).slice(-20)); } return j; })
    .catch(() => ({ error: 'classement injoignable' }));
}

// ---------- panneau ----------
function showEndless(run) {
  G.menuShown = true;
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard']) $(id).style.display = 'none';
  $('endlessCard').style.display = ''; $('overlay').classList.remove('hidden');
  const loc = endlessLocal();
  $('endText').innerHTML = run
    ? `Série terminée : <b>${run.wins} match${run.wins > 1 ? 's' : ''} gagné${run.wins > 1 ? 's' : ''}</b> (écart ${run.diff > 0 ? '+' : ''}${run.diff}).` + (run.best ? ' Nouveau record personnel ! 🏅' : '')
    : `Des matchs en ${ENDLESS_PTS} points contre des équipes de plus en plus fortes, jusqu'à ta première défaite. Va le plus loin possible !`;
  $('endBest').textContent = loc.best ? `Ton record : ${loc.best} match${loc.best > 1 ? 's' : ''} gagné${loc.best > 1 ? 's' : ''}.` : '';
  $('endGo').textContent = run ? 'Rejouer ▶' : 'Commencer ▶';
  // fin de série : on propose d'enregistrer le score sous un pseudo (vide = pas enregistré)
  endRun = run && run.toSave ? run : null;
  $('endSave').style.display = endRun ? '' : 'none';
  $('endGo').classList.toggle('primary', !endRun);
  if (endRun) $('endSaveName').value = myName();
  $('endStatus').textContent = 'Chargement du classement…';
  renderBoard();
  endlessFetch().then(() => { if ($('endStatus').textContent === 'Chargement du classement…') $('endStatus').textContent = ''; renderBoard(); });
}
let endRun = null;
const rankTxt = r => (r === 1 ? '1er' : r + 'e');
function endlessSave(skip) {
  const run = endRun, name = skip ? '' : cleanName($('endSaveName').value);
  if (!run) return;
  run.toSave = false; endRun = null;
  $('endSave').style.display = 'none'; $('endGo').classList.add('primary');
  if (!name) { $('endStatus').textContent = 'Score non enregistré.'; return; }
  storeSet('uf-name', name); $('pname').value = name;          // le pseudo est gardé pour la prochaine fois
  $('endStatus').textContent = 'Envoi…';
  endlessSubmit(name, run.wins, run.diff).then(j => {
    if (j.error) $('endStatus').textContent = '⚠️ Score non enregistré : ' + j.error + '.';
    else if (j.kept === false) $('endStatus').textContent = `${name} a déjà fait mieux (${j.best.wins} match${j.best.wins > 1 ? 's' : ''} gagné${j.best.wins > 1 ? 's' : ''}) : ce score reste au classement, ${rankTxt(j.rank)}.`;
    else $('endStatus').textContent = j.rank <= 100 ? `🌍 ${name} est ${rankTxt(j.rank)} du classement mondial !` : 'Score enregistré (au-delà de la 100e place).';
    renderBoard();
  });
}
function renderBoard() {
  const mine = new Set(storeGet('uf-endless-ids', []));
  if (!boardCache) {                                           // pas de classement mondial ici : tes meilleures séries
    const runs = endlessLocal().runs;
    $('endBoardTitle').textContent = 'Tes meilleures séries';
    $('endBoard').innerHTML = runs.length ? runs.map((r, i) => `<li><span class="rk">${i + 1}</span><b>${esc(myName() || 'Toi')}</b><span>${r.wins} 🏆</span><small>${r.diff > 0 ? '+' : ''}${r.diff}</small></li>`).join('')
      : '<li class="empty">Aucune série pour l’instant.</li>';
    if ($('endStatus').textContent === 'Chargement du classement…') $('endStatus').textContent = 'Classement mondial indisponible ici (il marche sur ' + NEW_HOST + ').';
    return;
  }
  $('endBoardTitle').textContent = '🌍 Classement mondial';
  $('endBoard').innerHTML = boardCache.top.length ? boardCache.top.slice(0, 50).map((e, i) =>
    `<li class="${mine.has(e.id) ? 'me' : ''}"><span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><b>${esc(e.name)}</b><span>${e.wins} 🏆</span><small>${e.diff > 0 ? '+' : ''}${e.diff}</small></li>`).join('')
    : '<li class="empty">Personne pour l’instant : sois le premier !</li>';
}
if (typeof document !== 'undefined' && document.getElementById('endGo')) {
  $('soloMenuB').addEventListener('click', () => showLobby('', 'solo'));
  $('soloBack').addEventListener('click', () => showLobby());
  $('endlessB').addEventListener('click', () => { backToSolo(); showEndless(null); });
  $('endGo').addEventListener('click', endlessStart);
  $('endSaveB').addEventListener('click', () => endlessSave(false));
  $('endSkipB').addEventListener('click', () => endlessSave(true));
  $('endSaveName').addEventListener('keydown', e => { if (e.key === 'Enter') endlessSave(false); });
  $('endBack').addEventListener('click', () => { $('endlessCard').style.display = 'none'; G.series = null; showLobby('', 'solo'); });
}
