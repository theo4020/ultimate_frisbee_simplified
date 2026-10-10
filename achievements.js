// achievements.js — Profil du joueur : statistiques de carrière et succès (gardés dans le navigateur)

const ACH = [
  { id: 'tuto', icon: '🎓', name: 'Diplômé', desc: 'Terminer le tutoriel' },
  { id: 'goal', icon: '🥏', name: 'Premier point', desc: 'Marquer un point' },
  { id: 'win', icon: '🏅', name: 'Première victoire', desc: 'Gagner un match' },
  { id: 'shutout', icon: '🧱', name: 'Blanchissage', desc: 'Gagner un match sans encaisser de point' },
  { id: 'huck40', icon: '🚀', name: 'Bombe', desc: 'Réussir une passe de 40 m ou plus' },
  { id: 'high', icon: '🌈', name: 'Par-dessus', desc: 'Réussir une passe haute' },
  { id: 'layout', icon: '🤸', name: 'Plongeon', desc: 'Attraper ou contrer le disque en layout' },
  { id: 'skyblock', icon: '✋', name: 'Contre en l’air', desc: 'Contrer un disque en sautant' },
  { id: 'duel', icon: '👑', name: 'Roi des airs', desc: 'Gagner un duel en l’air' },
  { id: 'callahan', icon: '🦅', name: 'Callahan', desc: 'Intercepter le disque dans l’en-but adverse' },
  { id: 'pull', icon: '🎯', name: 'Pull parfait', desc: 'Arrêter la jauge du pull dans le vert' },
  { id: 'practice10', icon: '🏹', name: 'Tireur d’élite', desc: 'Enchaîner 10 cibles à l’entraînement' },
  { id: 'online', icon: '🌐', name: 'Esprit d’équipe', desc: 'Gagner un match en ligne' },
  { id: 'champion', icon: '🏆', name: 'Champion', desc: 'Remporter le mini-tournoi' }
];
const CAREER0 = { matches: 0, wins: 0, scored: 0, conceded: 0, passes: 0, throws: 0, blocks: 0, longest: 0, hucks: 0, high: 0, duels: 0, pulls: 0, practiceBest: 0, titles: 0 };
function careerGet() { const c = storeGet('uf-career', null); return Object.assign({}, CAREER0, c && typeof c === 'object' ? c : {}); }
function careerSet(c) { storeSet('uf-career', c); }
function achGet() { const a = storeGet('uf-ach', null); return a && typeof a === 'object' ? a : {}; }
function careerAdd(k, v) { const c = careerGet(); c[k] = (c[k] || 0) + (v === undefined ? 1 : v); careerSet(c); }
function careerMax(k, v) { const c = careerGet(); if (v > (c[k] || 0)) { c[k] = v; careerSet(c); } }

function unlock(id) {
  const a = achGet();
  if (a[id]) return;
  const A = ACH.find(x => x.id === id); if (!A) return;
  a[id] = Date.now(); storeSet('uf-ach', a);
  toast(`${A.icon} Succès débloqué : <b>${A.name}</b>`);
  try { [784, 988, 1319].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.14, delay: i * 0.08 })); } catch (e) { }
}
function toast(html) {
  const el = typeof document !== 'undefined' && document.getElementById('toast');
  if (!el) return;
  el.innerHTML = html; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3200);
}
// est-ce « mon » équipe qui a fait ça ? (pas pendant la démo, ni en spectateur)
const mineT = t => !G.attract && !G.spectator && t === G.me && !!meH();

// événements de jeu (appelés depuis events.js, sim.js, pull.js, practice.js, tuto.js)
function achEvent(type, a, b) {
  if (type === 'tuto') { unlock('tuto'); return; }
  if (type === 'practice') { careerMax('practiceBest', a); if (a >= 10) unlock('practice10'); return; }
  if (G.attract) return;
  if (G.tuto || G.practice) return;
  switch (type) {
    case 'catch': {                                          // a = receveur, b = distance
      if (!mineT(a.team)) return;
      if (b >= 40) unlock('huck40');
      if (b > 25) careerAdd('hucks');
      careerMax('longest', Math.round(b));
      if (disc.kind === 'high') { unlock('high'); careerAdd('high'); }
      if (a.dive > 0 || a.down > 0) unlock('layout');
      break;
    }
    case 'goal': if (mineT(a)) unlock('goal'); break;
    case 'callahan': if (mineT(a)) unlock('callahan'); break;
    case 'duel': if (mineT(a)) { unlock('duel'); careerAdd('duels'); } break;
    case 'skyblock': if (mineT(a)) unlock('skyblock'); break;
    case 'layoutblock': if (mineT(a)) unlock('layout'); break;
    case 'pull': if (mineT(a)) { unlock('pull'); careerAdd('pulls'); } break;
  }
}
// fin de match : statistiques de carrière
function achMatchOver() {
  if (G.attract || G.spectator || !meH() || G.tuto || G.practice) return;
  const me = G.me, op = 1 - me, won = G.score[me] > G.score[op];
  const c = careerGet();
  c.matches++; if (won) c.wins++;
  c.scored += G.score[me]; c.conceded += G.score[op];
  if (G.ms) { const T = G.ms.team[me]; c.passes += T.comp; c.throws += T.thr; c.blocks += T.blk + T.int; }
  if (won && G.series && G.series.cur === SERIES.length - 1) c.titles++;
  careerSet(c);
  if (won) unlock('win');
  if (won && G.score[op] === 0) unlock('shutout');
  if (won && G.net) unlock('online');
  if (won && G.series && G.series.cur === SERIES.length - 1) unlock('champion');
}

// invité en ligne : il ne fait pas tourner la partie, on compte seulement le résultat du match
function achGuestOver(score) {
  if (G.spectator || !meH()) return;
  const me = G.me, op = 1 - me, won = score[me] > score[op], c = careerGet();
  c.matches++; if (won) c.wins++; c.scored += score[me]; c.conceded += score[op]; careerSet(c);
  if (won) { unlock('win'); unlock('online'); if (score[op] === 0) unlock('shutout'); }
}
// ---------- carte Profil ----------
function showProfile() {
  G.menuShown = true;
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard']) $(id).style.display = 'none';
  $('profileCard').style.display = '';
  const c = careerGet(), a = achGet(), n = ACH.filter(x => a[x.id]).length;
  const pct = c.throws ? Math.round(100 * c.passes / c.throws) + ' %' : '–';
  const rows = [['Matchs joués', c.matches], ['Victoires', c.wins + (c.matches ? ` (${Math.round(100 * c.wins / c.matches)} %)` : '')],
    ['Points marqués / encaissés', `${c.scored} / ${c.conceded}`], ['Passes réussies', `${c.passes} (${pct})`], ['Blocks et interceptions', c.blocks],
    ['Plus longue passe', c.longest ? c.longest + ' m' : '–'], ['Hucks réussis (> 25 m)', c.hucks], ['Passes hautes réussies', c.high],
    ['Duels gagnés', c.duels], ['Pulls parfaits', c.pulls], ['Record à l’entraînement', c.practiceBest + ' cibles'], ['Tournois gagnés', c.titles]];
  $('profileName').textContent = myName() || 'Joueur';
  $('profileStats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('profileAchTitle').textContent = `Succès (${n} / ${ACH.length})`;
  $('profileAch').innerHTML = ACH.map(x => `<div class="ach ${a[x.id] ? 'on' : ''}" title="${esc(x.desc)}"><i>${a[x.id] ? x.icon : '🔒'}</i><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></div>`).join('');
  $('overlay').classList.remove('hidden');
}
if (typeof document !== 'undefined' && document.getElementById('profileB')) {
  $('profileB').addEventListener('click', showProfile);
  $('profileBack').addEventListener('click', () => { $('profileCard').style.display = 'none'; showLobby(); });
  $('profileReset').addEventListener('click', () => askConfirm('Effacer tes statistiques et tes succès ?', 'Effacer',
    () => { storeSet('uf-career', null); storeSet('uf-ach', null); showProfile(); }));
}
