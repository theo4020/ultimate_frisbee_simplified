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
  const hk = G.humans.map(h => h.id + ':' + h.team).join(',');
  const key = [att, G.phase, pulling, G.phase === 'play', forceOf(0), forceOf(1), formOf(0), formOf(1), defFormOf(0), defFormOf(1), op, dp, G.wind.kmh, G.net, G.me, hk].join('|');
  if (key === hudKey) return;
  hudKey = key;
  const lbl = t => {                                           // « toi », « toi + 2 », « IA », « 3 joueurs »
    const n = teamHumans(t).length;
    if (t === ME) return n > 1 ? `toi + ${n - 1}` : 'toi';
    return n ? (n > 1 ? `${n} joueurs` : 'adversaire') : 'IA';
  };
  $('nameB').textContent = `Bleus (${lbl(0)})`;
  $('nameR').textContent = `Rouges (${lbl(1)})`;
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
  const multi = !soloStyle(ME) && human(ME);
  $('diveB').style.display = G.phase === 'pull' ? 'none' : '';
  $('switchD').style.display = G.phase === 'pull' || (att && !multi) ? 'none' : '';
  document.body.classList.toggle('defend', !att && G.phase === 'play');
  $('hint').innerHTML = G.phase === 'pull'
    ? (pulling ? '<i>Pull</i> : clique sur la zone visée (A/E ou molette pour la courbe), puis arrête la jauge dans le vert (clic ou Espace). Échap pour revenir à la visée. Un pull long et haut laisse le temps à ta défense de monter.' : '<i>Pull</i> : le disque arrive, ton équipe se met en place.')
    : att
    ? (multi ? '<i>Attaque à plusieurs</i> : ton joueur (anneau jaune) suit la souris ; quand il a le disque, vise et relâche pour lancer. <i>Espace / 1 à 5</i> = prendre un joueur géré par l’IA.'
             : '<i>Attaque</i> : vise et relâche pour lancer (relâche sur ton joueur pour annuler).')
    + ' <i>Clic droit</i> sur le terrain = le coéquipier IA le plus proche attaque cet espace. <i>F / clic pendant le vol</i> = layout du receveur. Anneau vert = coéquipier démarqué. Zone rouge = break side : ajoute de la courbe (A/E, molette) pour contourner la mark. Cercle pointillé = zone de stall. Couleur de la trajectoire : rouge = contrable, orange = contrable debout seulement, bleu = trop haut.'
    : '<i>Défense</i> : ton joueur (anneau jaune) suit la souris ou le doigt. <i>Clic / tap / F</i> = layout. <i>Espace</i> = switch vers le joueur en gris, <i>1 à 5</i> = prendre ce joueur. Entre dans le cercle du handler pour lancer le stall (un seul défenseur dedans, sinon double team). L’anneau sous le disque en vol : rouge = contrable, orange = debout seulement, bleu = trop haut.';
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
  $('rowLevel').style.display = $('descLevel').style.display = hostSide ? '' : 'none';
  const LVL_TXT = { facile: 'lents à réagir, peu de contres, lancers imprécis.', normal: 'équilibrés.',
    difficile: 'vifs, ils anticipent les courses, contrent plus souvent et lancent juste.' };
  $('descLevel').textContent = 'Joueurs ' + LVL_TXT[G.form.level] + ' S’applique aux équipes sans aucun joueur humain' + (G.net ? ' (réglé par l’hôte).' : '.');
  $('descAlly').textContent = 'Les joueurs IA de ton équipe : ' + LVL_TXT[G.form.allyLevel] + (G.net ? ' Chaque capitaine règle ceux de son équipe.' : '');
  $('windCtl').style.display = G.form.windMode === 'fixed' ? '' : 'none';
  document.querySelectorAll('.wdir').forEach(b => b.classList.toggle('on', +b.dataset.d === G.form.windDir));
  $('windKmh').value = G.form.windKmh;
  $('windKmhTxt').textContent = G.form.windKmh + ' km/h';
}
function showLobby(err) {
  G.menuShown = true;
  $('lobbyCard').style.display = ''; $('stratCard').style.display = 'none';
  $('lobbyHome').style.display = ''; $('lobbyRoom').style.display = 'none'; $('lobbyJoin').style.display = 'none';
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
  G.readyIds = new Set(); G.lastMenu = kind;
  $('go').disabled = false;
  refreshOptions();
  refreshCaptainUI();
  $('overlay').classList.remove('hidden');
  if (G.net === 'host') netSend({ t: 'menu', kind, score: G.score, rec: G.receiving, wind: G.wind });
}
// en ligne : seul le capitaine de chaque équipe choisit la stratégie et se déclare prêt
function refreshCaptainUI() {
  if (!$('stratRows')) return;
  const c = captain(G.me), isCap = !G.net || (c && c.id === G.myId);
  $('stratRows').classList.toggle('locked', !isCap);
  $('captainNote').textContent = G.net && !isCap && c ? `Stratégie choisie par ton capitaine (${humanLabel(c)}).` : '';
  $('go').style.display = isCap ? '' : 'none';
  if (!G.net) { $('oppReady').textContent = ''; return; }
  const waiting = [0, 1].map(captain).filter(h => h && !(G.readyIds && G.readyIds.has(h.id)) && h.id !== G.myId);
  $('oppReady').textContent = !isCap ? 'En attente des capitaines…'
    : waiting.length ? 'En attente de : ' + waiting.map(humanLabel).join(', ') : '';
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
const myCfg = () => ({ off: G.form.off, def: G.form.def, force: G.form.force, play: G.form.play, dplay: G.form.dplay, allyLevel: G.form.allyLevel });
$('go').addEventListener('click', () => {
  if (!G.net) {                                             // solo
    if (G.phase === 'over' || G.phase === 'menu') { G.score = [0, 0]; G.receiving = 0; }
    startPoint(); return;
  }
  $('go').disabled = true; $('go').textContent = 'Prêt ✓ — en attente des autres…';
  if (G.net === 'guest') netSend({ t: 'ready', cfg: myCfg() });
  else { (G.readyIds = G.readyIds || new Set()).add(G.myId); tryStartOnline(); }
});
function tryStartOnline() {
  if (G.net !== 'host' || !G.started || !G.menuShown || $('stratCard').style.display === 'none') return;
  const caps = [0, 1].map(captain).filter(Boolean);
  if (!caps.every(h => G.readyIds && G.readyIds.has(h.id))) return;
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
function doDive(x, y) {
  if (G.net === 'guest') { netSend({ t: 'dive', x, y }); return; }
  diveFor(meH(), x, y);
}
function doSelect(p) {
  if (G.net === 'guest') { netSend({ t: 'select', i: players.indexOf(p) }); return; }
  selectFor(meH(), p);
}
function doSwitch() {
  if (G.net === 'guest') { netSend({ t: 'switch' }); G.pointer.last = -1e9; return; }
  const h = meH(), n = switchTarget(h);
  if (n) selectFor(h, n);
}
function doCall(x, y) {
  if (G.net === 'guest') { netSend({ t: 'call', x, y }); return; }
  callFor(meH(), x, y);
}
