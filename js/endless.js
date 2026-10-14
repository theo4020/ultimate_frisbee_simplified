// endless.js — Mode infini : des matchs en 2 points enchaînés contre des adversaires de plus en plus forts.
// La difficulté monte en continu (un peu à chaque point joué, beaucoup à chaque match) ; la série s'arrête à la
// première défaite. Score = matchs gagnés, puis écart de points. Classement mondial via /api/scores (worker/index.js),
// et tes meilleures séries gardées dans le navigateur.

const ENDLESS_PTS = 2;
// niveaux de référence (d = numéro du match à partir de 0, plus la montée pendant le match) :
//   facile au 1er match, normal au 2e, difficile (Titans) au 5e, légende au 10e, surhumain au 15e,
//   puis ça ne s'arrête jamais : chaque match rend l'adversaire encore un peu plus fort (voir endlessLevel)
const LEGEND = { react: 0.55, anticip: 0.55, block: 0.78, speed: 1.09, err: 0.45, safe: 0.14, hands: 0.0008, greed: 0.03 };
const SUPER = { react: 0.45, anticip: 0.65, block: 0.85, speed: 1.13, err: 0.35, safe: 0.18, hands: 0.0005, greed: 0 };
const ENDLESS_STEPS = [[0, AI_LEVELS.facile], [1, AI_LEVELS.normal], [4, AI_LEVELS.difficile], [9, LEGEND], [14, SUPER]];
// au-delà du dernier palier : plus vif, plus précis, plus rapide à chaque match, sans jamais dépasser des limites humaines
const BEYOND = { react: [0.92, 0.2], anticip: [0.05, 1], block: [0.88, 0.97], speed: [0.02, 1.3], err: [0.9, 0.1], safe: [0.01, 0.3], hands: [0.88, 0.0002] };
function endlessLevel(d) {
  const S = ENDLESS_STEPS;
  if (d <= S[0][0]) return S[0][1];
  const [dl, L] = S[S.length - 1];
  if (d > dl) {
    const k = d - dl, B = BEYOND;
    return {
      react: Math.max(B.react[1], L.react * B.react[0] ** k),                     // temps de réaction : -8 % par match
      anticip: Math.min(B.anticip[1], L.anticip + B.anticip[0] * k),
      block: Math.min(B.block[1], 1 - (1 - L.block) * B.block[0] ** k),           // contres manqués : -12 % par match
      speed: Math.min(B.speed[1], L.speed + B.speed[0] * k),
      err: Math.max(B.err[1], L.err * B.err[0] ** k),                             // imprécision : -10 % par match
      safe: Math.min(B.safe[1], L.safe + B.safe[0] * k),
      hands: Math.max(B.hands[1], L.hands * B.hands[0] ** k),                     // drops : -12 % par match
      greed: 0
    };
  }
  for (let i = 1; i < S.length; i++) {
    if (d <= S[i][0]) {
      const [d0, a] = S[i - 1], [d1, b] = S[i], k = (d - d0) / (d1 - d0), o = {};
      for (const key in a) o[key] = a[key] + (b[key] - a[key]) * k;
      return o;
    }
  }
  return S[S.length - 1][1];
}
// difficulté du moment : le numéro du match, plus jusqu'à 0,6 au fil des points du match
const endlessD = () => G.series.cur + 0.6 * Math.min(1, (G.score[0] + G.score[1]) / (2 * ENDLESS_PTS - 1));

const ENDLESS_NAMES = ['Écureuils', 'Mouettes', 'Hérissons', 'Renards', 'Castors', 'Faucons', 'Loups', 'Pumas', 'Requins', 'Ours',
  'Aigles', 'Panthères', 'Cyclones', 'Volcans', 'Dragons', 'Titans', 'Météores', 'Légendes'];
const ENDLESS_COLORS = ['orange', 'turquoise', 'violet', 'rose', 'jaune', 'noir', 'rouge', 'blanc'];
const endlessTier = d => (d < 1 ? 'Débutants' : d < 3 ? 'Bon niveau' : d < 5 ? 'Très forts' : d < 7 ? 'Élite' : d < 11 ? 'Légendaires' : d < 15 ? 'Surhumains' : 'Imbattables ?');

// adversaire du match n (0, 1, 2…) : nom, couleur, style de jeu (repris des équipes du tournoi), niveau calculé en direct
function endlessOpp(n) {
  const name = ENDLESS_NAMES[n % ENDLESS_NAMES.length] + (n >= ENDLESS_NAMES.length ? ' ' + (Math.floor(n / ENDLESS_NAMES.length) + 1) : '');
  const style = SERIES[n < 1 ? 0 : n < 4 ? 1 : 2].style;      // styles des Écureuils, puis des Faucons, puis des Titans dès le 5e match
  return { name, color: ENDLESS_COLORS[n % ENDLESS_COLORS.length], style, level: () => endlessLevel(endlessD()),
    blurb: `Adversaire n° ${n + 1} · ${endlessTier(n)}. Premier à ${ENDLESS_PTS} points ; une défaite et la série s'arrête.` };
}
// réglages propres au mode infini, gardés à part : par défaut l'adversaire pulle (tu commences en attaque) et tes coéquipiers IA
// sont « difficile » ; ceux du match rapide sont remis en sortant (retour au menu)
const END_KEYS = ['first', 'allyLevel'];
function endlessCfgIn() {
  if (G.endKeep) return;
  G.endKeep = {}; for (const k of END_KEYS) G.endKeep[k] = G.form[k];
  const c = storeGet('uf-endless-cfg', null) || {};
  G.form.first = SAVE_KEYS.first.includes(c.first) ? c.first : String(G.me);
  G.form.allyLevel = SAVE_KEYS.allyLevel.includes(c.allyLevel) ? c.allyLevel : 'difficile';
}
function endlessCfgOut() {
  if (!G.endKeep) return;
  const c = {}; for (const k of END_KEYS) c[k] = G.form[k];
  storeSet('uf-endless-cfg', c);
  Object.assign(G.form, G.endKeep); G.endKeep = null;
  saveSettings();
}
function endlessStart() {
  backToSolo();
  endlessCfgIn();
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
  if (S.coop) { S.toSave = true; return; }                     // à plusieurs : pas de record personnel, l'hôte enregistre l'équipe
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
  G.phase = 'menu';                                            // sinon « Jouer le point » croirait le match encore fini et sauterait au suivant
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
// le panneau du mode infini sert aussi au mode à plusieurs (coop.js) :
//   'solo' · 'coop' (accueil à plusieurs, puis fin de série chez l'hôte) · 'coopGuest' (fin de série chez un invité)
let endMode = 'solo';
const coopMode = () => endMode !== 'solo';
const scoresUrl = () => 'api/scores' + (coopMode() ? '?mode=coop' : '');
const runName = n => (coopMode() ? String(n || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24) : cleanName(n));
const idsKey = () => (coopMode() ? 'uf-coop-ids' : 'uf-endless-ids');
function endlessFetch() {
  return fetch(scoresUrl(), { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => (boardCache = j && Array.isArray(j.top) ? j : null)).catch(() => (boardCache = null));
}
const BOARD_LOADING = 'Chargement du classement…';
function endlessSubmit(name, wins, diff) {
  return fetch(scoresUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, wins, diff, token: coopMode() ? undefined : (accGet() || {}).token }) })
    .then(r => r.json().then(j => (r.ok ? j : { error: j.error || 'erreur ' + r.status })))
    .then(j => { if (j.top) { boardCache = j; if (j.id) storeSet(idsKey(), storeGet(idsKey(), []).concat([j.id]).slice(-20)); } return j; })
    .catch(() => ({ error: 'classement injoignable' }));
}

// ---------- panneau ----------
const winsTxt = w => `${w} match${w > 1 ? 's' : ''} gagné${w > 1 ? 's' : ''}`;
function showEndless(run, mode) {
  endMode = mode || 'solo';
  G.menuShown = true;
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard']) $(id).style.display = 'none';
  $('endlessCard').style.display = ''; $('overlay').classList.remove('hidden');
  const loc = endlessLocal(), coop = coopMode();
  $('endTitle').textContent = coop ? '♾️ Mode infini à plusieurs' : '♾️ Mode infini';
  $('endText').innerHTML = run
    ? `Série terminée : <b>${winsTxt(run.wins)}</b> (écart ${run.diff > 0 ? '+' : ''}${run.diff}).` + (run.best ? ' Nouveau record personnel ! 🏅' : '')
      + (endMode === 'coopGuest' ? ' L’hôte peut enregistrer l’équipe au classement et relancer une série.' : '')
    : coop ? `Alliez-vous contre l'IA : jusqu'à 5 joueurs dans la même équipe, des matchs en ${ENDLESS_PTS} points contre des adversaires de plus en plus forts, jusqu'à votre première défaite. Classement à part, par équipe.`
    : `Des matchs en ${ENDLESS_PTS} points contre des équipes de plus en plus fortes, jusqu'à ta première défaite. Va le plus loin possible !`;
  $('endBest').textContent = !coop && loc.best ? `Ton record : ${winsTxt(loc.best)}.` : '';
  $('endGo').textContent = run ? 'Rejouer ▶' : coop ? 'Créer la partie ▶' : 'Commencer ▶';
  $('endGo').style.display = endMode === 'coopGuest' ? 'none' : '';
  $('endBack').textContent = endMode === 'coopGuest' ? '← Quitter la partie' : coop && run ? '← Retour à la salle' : '← Retour';
  // fin de série : on propose d'enregistrer le score sous un pseudo (ou un nom d'équipe ; vide = pas enregistré)
  endRun = run && run.toSave ? run : null;
  $('endSave').style.display = endRun ? '' : 'none';
  $('endGo').classList.toggle('primary', !endRun);
  $('endSaveTitle').textContent = coop ? 'Enregistrer votre équipe au classement à plusieurs ?' : 'Enregistrer ton score au classement mondial ?';
  $('endSaveName').maxLength = coop ? 24 : 12;
  $('endSaveName').placeholder = coop ? 'Nom de l’équipe' : 'Ton pseudo';
  if (endRun) { $('endSaveName').value = coop ? coopTeamName() : myName(); $('endSaveName').readOnly = !coop && !!accGet(); }
  $('endStatus').textContent = BOARD_LOADING;
  boardCache = null; renderBoard();
  endlessFetch().then(() => {                                  // réponse du serveur : classement mondial, ou message s'il n'y en a pas ici
    if ($('endStatus').textContent === BOARD_LOADING) $('endStatus').textContent = boardCache ? '' : 'Classement mondial indisponible ici (il marche sur ' + NEW_HOST + ').';
    renderBoard();
  });
}
let endRun = null;
const rankTxt = r => (r === 1 ? '1er' : r + 'e');
function endlessSave(skip) {
  const run = endRun, name = skip ? '' : runName($('endSaveName').value), coop = coopMode();
  if (!run) return;
  run.toSave = false; endRun = null;
  $('endSave').style.display = 'none'; $('endGo').classList.add('primary');
  if (!name) { $('endStatus').textContent = 'Score non enregistré.'; return; }
  if (!coop && !accGet()) { storeSet('uf-name', name); $('pname').value = name; }   // le pseudo est gardé pour la prochaine fois
  $('endStatus').textContent = 'Envoi…';
  endlessSubmit(name, run.wins, run.diff).then(j => {
    if (j.error) $('endStatus').textContent = '⚠️ Score non enregistré : ' + j.error + '.';
    else if (j.kept === false) $('endStatus').textContent = `${name} a déjà fait mieux (${winsTxt(j.best.wins)}) : ce score reste au classement, ${rankTxt(j.rank)}.`;
    else $('endStatus').textContent = j.rank <= 100 ? `🌍 ${name} : ${rankTxt(j.rank)} du classement ${coop ? 'à plusieurs' : 'mondial'} !` : 'Score enregistré (au-delà de la 100e place).';
    renderBoard();
  });
}
function renderBoard() {
  const mine = new Set(storeGet(idsKey(), []));
  if (!boardCache) {                                           // pas de classement mondial ici : tes meilleures séries (solo)
    const runs = coopMode() ? [] : endlessLocal().runs;
    $('endBoardTitle').textContent = coopMode() ? 'Classement à plusieurs' : 'Tes meilleures séries';
    $('endBoard').innerHTML = runs.length ? runs.map((r, i) => `<li><span class="rk">${i + 1}</span><b>${esc(myName() || 'Toi')}</b><span>${r.wins} 🏆</span><small>${r.diff > 0 ? '+' : ''}${r.diff}</small></li>`).join('')
      : '<li class="empty">Aucune série pour l’instant.</li>';
    return;
  }
  $('endBoardTitle').textContent = coopMode() ? '🌍 Classement à plusieurs' : '🌍 Classement mondial';
  $('endBoard').innerHTML = boardCache.top.length ? boardCache.top.slice(0, 50).map((e, i) =>
    `<li class="${mine.has(e.id) ? 'me' : ''}"><span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><b>${esc(e.name)}</b><span>${e.wins} 🏆</span><small>${e.diff > 0 ? '+' : ''}${e.diff}</small></li>`).join('')
    : '<li class="empty">Personne pour l’instant : soyez les premiers !</li>';
}
if (typeof document !== 'undefined' && document.getElementById('endGo')) {
  $('soloMenuB').addEventListener('click', () => showLobby('', 'solo'));
  $('soloBack').addEventListener('click', () => showLobby());
  $('endlessB').addEventListener('click', () => { backToSolo(); showEndless(null); });
  $('endGo').addEventListener('click', () => (endMode === 'solo' ? endlessStart() : G.net === 'host' && G.series ? coopRestart() : coopHost()));
  $('endSaveB').addEventListener('click', () => endlessSave(false));
  $('endSkipB').addEventListener('click', () => endlessSave(true));
  $('endSaveName').addEventListener('keydown', e => { if (e.key === 'Enter') endlessSave(false); });
  $('endBack').addEventListener('click', () => {
    $('endlessCard').style.display = 'none';
    if (endMode === 'coopGuest') { netError(''); return; }                      // l'invité quitte la partie
    if (endMode === 'coop' && G.net === 'host') { coopToRoom(); return; }       // l'hôte revient à la salle (on garde les joueurs)
    G.series = null; showLobby('', endMode === 'solo' ? 'solo' : 'online');
  });
}
