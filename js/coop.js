// coop.js — Mode infini à plusieurs : jusqu'à 5 joueurs en ligne dans la même équipe (les Bleus), contre une IA
// de plus en plus forte (mêmes adversaires et même montée de difficulté que le mode infini solo, voir endless.js).
// L'hôte fait tourner la série ; les invités reçoivent où on en est avec chaque menu (« ser »). Une défaite et la série
// s'arrête : l'hôte peut enregistrer l'équipe au classement à part (/api/scores?mode=coop), relancer, ou revenir à la salle.

function coopHost() {                                          // accueil → création de la salle
  $('endlessCard').style.display = 'none';
  G.coopRoom = true;
  hostGame();
}
const newCoopSeries = () => ({ endless: true, coop: true, cur: 0, opp: endlessOpp(0), pts: ENDLESS_PTS, wins: 0, diff: 0 });
function coopStart() {                                         // « Lancer la partie » dans la salle
  endlessCfgIn();                                              // réglages du mode infini : l'IA pulle, coéquipiers IA difficiles
  G.started = true; G.series = newCoopSeries();
  newMatch(); G.phase = 'menu';
  broadcastRoom();
  placeForPoint();
  showMenu('first');
}
// après l'écran de fin de match, quand le capitaine est prêt : match suivant, ou fin de la série
function coopNext() {
  const S = G.series;
  if (S.done) { coopEnd(); return; }
  S.cur++; S.opp = endlessOpp(S.cur);
  if (S.cur >= 4) unlock('endless5');
  G.phase = 'menu';
  newMatch();
  showMenu('first');
}
function coopEnd() {
  const S = G.series;
  netSend({ t: 'coopEnd', wins: S.wins, diff: S.diff });
  showEndless(S, 'coop');
}
function coopRestart() {                                       // « Rejouer » : nouvelle série avec les mêmes joueurs
  G.series = newCoopSeries();
  G.phase = 'menu';
  newMatch();
  showMenu('first');
}
function coopToRoom() {                                        // retour à la salle : on garde les joueurs connectés
  G.started = false; G.series = null; G.phase = 'menu'; G.score = [0, 0];
  broadcastRoom();
  showRoom();
}
// où en est la série, envoyé aux invités avec chaque menu
function coopSer() {
  const S = G.series;
  if (G.net !== 'host' || !S || !S.coop) return null;
  return { cur: S.cur, wins: S.wins, diff: S.diff, done: !!S.done, opp: { name: S.opp.name, color: S.opp.color, blurb: S.opp.blurb } };
}
function coopGuestEnd(m) {
  showEndless({ wins: m.wins | 0, diff: m.diff | 0 }, 'coopGuest');
}
// nom d'équipe proposé pour le classement : les pseudos des joueurs (24 caractères au plus)
function coopTeamName() {
  const n = teamHumans(0).map(humanLabel).join(' + ');
  return n.length <= 24 ? n : n.slice(0, 23) + '…';
}

if (typeof document !== 'undefined' && document.getElementById('coopB')) {
  $('onlineMenuB').addEventListener('click', () => showLobby('', 'online'));
  $('onlineBack').addEventListener('click', () => showLobby());
  const rejoin = () => {                                        // revenir dans la dernière partie rejointe
    const last = storeGet('uf-last-room', null); if (!last) return;
    ['lobbyOnline', 'lobbyHome'].forEach(id => { $(id).style.display = 'none'; }); $('lobbyJoin').style.display = ''; $('joinCode').value = last.code;
    joinGame(last.code);
  };
  $('rejoinB').addEventListener('click', rejoin);
  $('rejoinHomeB').addEventListener('click', rejoin);
  $('coopB').addEventListener('click', () => { backToSolo(); showEndless(null, 'coop'); });
}
