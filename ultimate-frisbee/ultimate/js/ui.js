// ui.js — HUD, menus, actions du joueur

// =====================================================================
//  HUD et menu
// =====================================================================
const $ = id => document.getElementById(id);
let hudKey = '';
function updateHud() {
  $('s0').textContent = G.score[0]; $('s1').textContent = G.score[1];
  $('dot').style.left = ((G.curve + 1) / 2 * 100) + '%';
  const ME = G.me, OP = 1 - ME, pulling = localPuller(), att = G.off === ME && G.phase !== 'pull';
  const op = G.oplay ? G.oplay.type : '', dp = G.dplay ? G.dplay.type : '';
  const key = [att, G.phase, pulling, G.phase === 'play', forceOf(0), forceOf(1), formOf(0), formOf(1), defFormOf(0), defFormOf(1), op, dp, G.wind.kmh, G.net, G.me, G.ctrl.join()].join('|');
  if (key === hudKey) return;
  hudKey = key;
  const opp = G.ctrl[OP] === 'ai' ? 'IA' : 'adversaire';
  $('nameB').textContent = ME === 0 ? 'Bleus (toi)' : `Bleus (${opp})`;
  $('nameR').textContent = ME === 1 ? 'Rouges (toi)' : `Rouges (${opp})`;
  $('windArrow').style.transform = `rotate(${Math.atan2(G.wind.y, G.wind.x) * 180 / Math.PI}deg)`;
  $('windArrow').style.opacity = G.wind.kmh < 4 ? 0.3 : 1;
  $('windTxt').textContent = Math.round(G.wind.kmh) + ' km/h';
  const myPlay = (op && G.oplay.team === ME) ? op : (dp && G.dplay.team === ME) ? dp : '';
  const oppPlay = (op && G.oplay.team === OP) ? op : (dp && G.dplay.team === OP) ? dp : '';
  const playTxt = myPlay ? ` · play ${PLAY_NAMES[myPlay]}` : '', oppTxt = oppPlay ? ` · play ${PLAY_NAMES[oppPlay]}` : '';
  $('status').innerHTML = G.phase === 'pull'
    ? (pulling ? '<b>Pull</b> · vise, choisis la courbe, puis arrête la jauge dans le vert' : '<b>Pull</b> · ' + (G.receiving === ME ? 'tu reçois le pull' : 'ton équipe pulle'))
    : att
    ? `<b>Attaque</b> · ${NAMES[formOf(ME)]}${playTxt} — en face : ${NAMES[defFormOf(OP)]}, ${NAMES[forceOf(OP)]}${oppTxt}`
    : `<b>Défense</b> · ${NAMES[defFormOf(ME)]}, ${NAMES[forceOf(ME)]}${playTxt} — en face : ${NAMES[formOf(OP)]}${oppTxt}`;
  const curveOn = att || pulling;
  $('curveL').style.display = $('curveR').style.display = curveOn ? '' : 'none';
  $('curveTouch').style.visibility = curveOn ? 'visible' : 'hidden';
  $('curveBox').style.visibility = curveOn ? 'visible' : 'hidden';
  $('diveB').style.display = $('switchD').style.display = att || G.phase === 'pull' ? 'none' : '';
  document.body.classList.toggle('defend', !att && G.phase === 'play');
  $('hint').innerHTML = G.phase === 'pull'
    ? (pulling ? '<i>Pull</i> : clique sur la zone visée (A/E ou molette pour la courbe), puis arrête la jauge dans le vert (clic ou Espace). Échap pour revenir à la visée. Un pull long et haut laisse le temps à ta défense de monter.' : '<i>Pull</i> : le disque arrive, ton équipe se met en place.')
    : att
    ? '<i>Attaque</i> : vise et relâche pour lancer (relâche sur ton joueur pour annuler). Anneau vert = coéquipier démarqué. Zone rouge = break side : ajoute de la courbe (A/E, molette) pour contourner la mark. Cercle pointillé = zone de stall. Couleur de la trajectoire : rouge = contrable, orange = contrable debout seulement, bleu = trop haut.'
    : '<i>Défense</i> : ton joueur (anneau jaune) suit la souris ou le doigt. <i>Clic / tap / F</i> = layout. <i>Espace</i> = switch vers le joueur en gris. Entre dans le cercle du handler pour lancer le stall (un seul défenseur dedans, sinon double team). L’anneau sous le disque en vol : rouge = contrable, orange = debout seulement, bleu = trop haut.';
  resize();
}

function refreshOptions() {
  document.querySelectorAll('.opt').forEach(b => b.classList.toggle('on', G.form[b.dataset.g] === b.dataset.v));
  $('descOff').textContent = DESCS[G.form.off];
  $('descDef').textContent = DESCS[G.form.def];
  $('descForce').textContent = DESCS[G.form.force];
  $('rowForce').style.display = G.form.def === 'man' ? '' : 'none';
  $('descPlay').textContent = PLAYS[G.form.play];
  $('descDPlay').textContent = DPLAYS[G.form.dplay];
  $('rowPlay').style.display = G.receiving === G.me ? '' : 'none';
  $('rowDPlay').style.display = G.receiving !== G.me ? '' : 'none';
  $('ovWind').textContent = 'Vent pour ce point : ' + windLabel() + '.' + (G.net === 'guest' ? ' (réglé par l’hôte)' : '');
  const hostSide = G.net !== 'guest';                        // le vent et la vitesse sont réglés par l'hôte
  $('hostOnlyWind').style.display = hostSide ? '' : 'none';
  $('rowSpeed').style.display = hostSide ? '' : 'none';
  $('windCtl').style.display = G.form.windMode === 'fixed' ? '' : 'none';
  document.querySelectorAll('.wdir').forEach(b => b.classList.toggle('on', +b.dataset.d === G.form.windDir));
  $('windKmh').value = G.form.windKmh;
  $('windKmhTxt').textContent = G.form.windKmh + ' km/h';
}
function showLobby(err) {
  G.menuShown = true;
  $('lobbyCard').style.display = ''; $('stratCard').style.display = 'none';
  $('lobbyHome').style.display = ''; $('lobbyHost').style.display = 'none'; $('lobbyJoin').style.display = 'none';
  $('lobbyErr').textContent = err || '';
  $('overlay').classList.remove('hidden');
}
function showMenu(kind) {
  G.menuShown = true;
  if (G.net !== 'guest') newWind();
  hudKey = '';
  $('lobbyCard').style.display = 'none'; $('stratCard').style.display = '';
  const ME = G.me, side = ME === 0 ? 'les Bleus et tu attaques vers la droite' : 'les Rouges et tu attaques vers la gauche';
  if (kind === 'over') {
    const won = G.score[ME] > G.score[1 - ME];
    $('ovTitle').textContent = won ? 'Victoire ! 🥏' : 'Défaite…';
    $('ovText').textContent = `Score final : ${G.score[0]} – ${G.score[1]}. Change de stratégie et retente ta chance.`;
    $('go').textContent = 'Rejouer ▶';
  } else if (kind === 'first') {
    $('ovTitle').textContent = G.net ? 'Partie en ligne' : 'Ultimate Frisbee';
    $('ovText').textContent = `Premier à 5 points. Tu joues ${side}.`;
    $('go').textContent = 'Jouer le point ▶';
  } else {
    $('ovTitle').textContent = `Bleus ${G.score[0]} – ${G.score[1]} Rouges`;
    $('ovText').textContent = G.receiving === ME ? 'Tu reçois le disque : choisis ta stratégie.' : 'L’adversaire attaque : prépare ta défense.';
    $('go').textContent = 'Jouer le point ▶';
  }
  G.ready = [false, false];
  $('go').disabled = false;
  $('oppReady').textContent = G.net ? 'L’adversaire choisit sa stratégie…' : '';
  refreshOptions();
  $('overlay').classList.remove('hidden');
  if (G.net === 'host') netSend({ t: 'menu', kind, score: G.score, rec: G.receiving, wind: G.wind });
}
function setOpt(g, v) {
  G.form[g] = v;
  if (g === 'windMode') { newWind(); hudKey = ''; }
  refreshOptions();
  if (G.net === 'host' && ['windMode'].includes(g)) netSend({ t: 'wind', wind: G.wind });
}
document.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => setOpt(b.dataset.g, b.dataset.v)));
document.querySelectorAll('.wdir').forEach(b => b.addEventListener('click', () => {
  G.form.windDir = +b.dataset.d; newWind(); hudKey = ''; refreshOptions();
  if (G.net === 'host') netSend({ t: 'wind', wind: G.wind });
}));
$('windKmh').addEventListener('input', e => {
  G.form.windKmh = +e.target.value; newWind(); hudKey = ''; refreshOptions();
  if (G.net === 'host') netSend({ t: 'wind', wind: G.wind });
});
const myCfg = () => ({ off: G.form.off, def: G.form.def, force: G.form.force, play: G.form.play, dplay: G.form.dplay });
$('go').addEventListener('click', () => {
  if (!G.net) {                                             // solo
    if (G.phase === 'over' || G.phase === 'menu') { G.score = [0, 0]; G.receiving = 0; }
    startPoint(); return;
  }
  G.ready[G.me] = true;
  $('go').disabled = true; $('go').textContent = 'Prêt ✓ — en attente de l’adversaire…';
  if (G.net === 'guest') netSend({ t: 'ready', cfg: myCfg() });
  else tryStartOnline();
});
function tryStartOnline() {
  if (!(G.ready[0] && G.ready[1])) return;
  if (G.phase === 'over' || G.phase === 'menu') { G.score = [0, 0]; G.receiving = 0; }
  startPoint();
}

// =====================================================================
//  Actions du joueur (appliquées ici, ou envoyées à l'hôte si on est l'invité)
// =====================================================================
function doThrow(x, y, curve) {
  if (G.net === 'guest') { netSend({ t: 'throw', x, y, curve }); return; }
  if (canThrow()) throwDisc(disc.holder, x, y, curve, 1);
}
function doDive(t, x, y) {
  if (G.net === 'guest') { netSend({ t: 'dive', x, y }); return; }
  if (G.phase === 'play' && G.off !== t && G.sel[t]) { diveTo(G.sel[t], x, y); inputOf(t).last = G.time; }
}
function doSelect(t, p) {
  if (G.net === 'guest') { netSend({ t: 'select', i: players.indexOf(p) }); return; }
  if (G.phase === 'play' && G.off !== t && p && p.team === t) { G.sel[t] = p; inputOf(t).last = -1e9; }
}
function doSwitch(t) {
  if (G.net === 'guest') { netSend({ t: 'switch' }); G.pointer.last = -1e9; return; }
  const n = switchTarget(t);
  if (n) { G.sel[t] = n; inputOf(t).last = -1e9; }
}

