// ui.js — HUD, menus, actions du joueur

// =====================================================================
//  HUD et menu
// =====================================================================
const $ = id => document.getElementById(id);
let hudKey = '';
// téléphone : on va bientôt avoir le disque (passe ou pull en l'air vers soi, disque à ramasser) -> on peut déjà régler la courbe
function throwSoon() {
  const h = meH(); if (!h || h.team < 0 || G.spectator || G.phase !== 'play') return false;
  const mine = p => !!p && p.team === h.team && (soloStyle(h.team) || p === h.sel);
  if (disc.mode === 'air') return disc.pull ? mine(nearest(TEAMS[h.team], disc.ex, disc.ey)) : disc.team === h.team && mine(disc.intended);
  if (disc.mode === 'ground') return mine(G.pickup);
  return disc.mode === 'carry' && mine(disc.holder);
}
function updateHud() {
  $('s0').textContent = G.score[0]; $('s1').textContent = G.score[1];
  $('dot').style.left = ((G.curve + 1) / 2 * 100) + '%';
  const ME = G.me, OP = 1 - ME, pulling = localPuller(), att = G.off === ME && G.phase !== 'pull';
  const op = G.oplay ? G.oplay.type : '', dp = G.dplay ? G.dplay.type : '';
  const hk = G.humans.map(h => h.id + ':' + h.team).join(',');
  const ct = canThrow();
  $('throwSel').style.display = ct || (att && G.phase === 'play' && soloStyle(ME)) ? '' : 'none';
  document.querySelectorAll('.tk').forEach(b => b.classList.toggle('on', b.dataset.k === G.throwKind));
  // téléphone : courbe (bord droit) quand on lance ou qu'on pulle, bouton passe haute quand on a le disque
  document.body.classList.toggle('curveon', ct || localPuller() || throwSoon());
  document.body.classList.toggle('highon', ct);
  $('highB').classList.toggle('on', G.throwKind === 'high');
  $('highB').innerHTML = G.throwKind === 'high' ? 'Armée ✓<br><small>annuler</small>' : 'Passe<br>haute';
  $('curveVThumb').style.top = ((G.curve + 1) / 2 * 100) + '%';
  const key = [att, G.phase, pulling, G.phase === 'play', forceOf(0), forceOf(1), formOf(0), formOf(1), defFormOf(0), defFormOf(1), op, dp, G.wind.kmh, G.net, G.me, hk,
    tn(0), tn(1), tcol(0), tcol(1), G.spectator, !!G.gpActive, !!G.tuto, !!G.attract, !!G.practice].join('|');
  if (key === hudKey) return;
  hudKey = key;
  const lbl = t => {                                           // « toi », « toi + 2 », « IA », « 3 joueurs »
    const n = teamHumans(t).length;
    if (G.attract) return 'IA';
    if (t === ME && !G.spectator) return n > 1 ? `toi + ${n - 1}` : 'toi';
    return n ? (n > 1 ? `${n} joueurs` : G.spectator ? '1 joueur' : 'adversaire') : 'IA';
  };
  $('nameB').textContent = `${tn(0)} (${lbl(0)})`; $('nameB').style.color = tlabel(0);
  $('nameR').textContent = `${tn(1)} (${lbl(1)})`; $('nameR').style.color = tlabel(1);
  $('windArrow').style.transform = `rotate(${Math.atan2(G.wind.y, G.wind.x) * 180 / Math.PI}deg)`;
  $('windArrow').style.opacity = G.wind.kmh < 4 ? 0.3 : 1;
  $('windTxt').textContent = Math.round(G.wind.kmh) + ' km/h';
  const myPlay = (op && G.oplay.team === ME) ? op : (dp && G.dplay.team === ME) ? dp : '';
  const oppPlay = (op && G.oplay.team === OP) ? op : (dp && G.dplay.team === OP) ? dp : '';
  const playTxt = myPlay ? ` · play ${PLAY_NAMES[myPlay]}` : '', oppTxt = oppPlay ? ` · play ${PLAY_NAMES[oppPlay]}` : '';
  $('status').innerHTML = G.attract ? '<b>Match de démonstration</b>' : G.practice ? '<b>Entraînement</b> · lance dans la cible' : G.spectator ? `<b>Spectateur</b> · tu regardes la partie` : G.phase === 'pull'
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
  $('jumpB').style.display = G.phase === 'pull' || G.spectator ? 'none' : '';
  $('switchD').style.display = G.phase === 'pull' || (att && !multi) ? 'none' : '';
  document.body.classList.toggle('defend', !att && G.phase === 'play');
  $('hint').innerHTML = G.spectator ? '<i>Mode spectateur</i> : tu regardes la partie. Les boutons d’émojis permettent quand même d’encourager les joueurs.'
    : G.phase === 'pull'
    ? (pulling ? '<i>Pull</i> : clique sur la zone visée (A/E ou molette pour la courbe), puis arrête la jauge dans le vert (clic ou Espace). Échap pour revenir à la visée. Un pull long et haut laisse le temps à ta défense de monter.' : '<i>Pull</i> : le disque arrive, ton équipe se met en place.')
    : att
    ? (multi ? '<i>Attaque à plusieurs</i> : ton joueur (anneau jaune) suit la souris ; quand il a le disque, vise et relâche pour lancer. <i>Espace / 1 à 5</i> = prendre un joueur géré par l’IA.'
             : '<i>Attaque</i> : vise et relâche pour lancer (relâche sur ton joueur pour annuler).')
    + ' <i>Z</i> = armer / désarmer la passe haute (la défense voit le disque levé et doit deviner quand tu lances). <i>S</i> = saut du receveur pendant le vol (duel en l’air). <i>Clic droit</i> sur le terrain = le coéquipier IA le plus proche attaque cet espace. <i>F / clic pendant le vol</i> = layout du receveur. Anneau vert = coéquipier démarqué. Zone rouge = break side : ajoute de la courbe (A/E, molette) pour contourner la mark. Cercle pointillé = zone de stall. Couleur de la trajectoire : rouge = contrable, orange = contrable debout seulement, violet = en sautant, bleu = trop haut.'
    : '<i>Défense</i> : ton joueur (anneau jaune) suit la souris ou le doigt. <i>Clic / tap / F</i> = layout. <i>S</i> = saut (contrer une passe haute au lâcher à la mark, ou à l’arrivée). <i>Espace</i> = switch vers le joueur en gris, <i>1 à 5</i> = prendre ce joueur. Entre dans le cercle du handler pour lancer le stall (un seul défenseur dedans, sinon double team). L’anneau sous le disque en vol : rouge = contrable, orange = debout seulement, violet = en sautant, bleu = trop haut.';
  if (G.gpActive) $('hint').innerHTML = '🎮 <i>Manette</i> : stick gauche = déplacer le curseur de visée / courir (stick droit = visée fine) · A ou RT = lancer au curseur (sans le disque : saut) · B = layout · X = appel de cut au curseur (sans le disque : switch) · Y = passe haute · LB/RB = courbe · Start = menu. ' + $('hint').innerHTML;
  $('emoBar').style.display = G.net && G.started ? '' : 'none';
  resize();
}

function refreshOptions() {
  renderPullerRow();
  document.querySelectorAll('.opt').forEach(b => b.classList.toggle('on', G.form[b.dataset.g] === b.dataset.v));
  $('descOff').textContent = DESCS[G.form.off];
  $('descDef').textContent = DESCS[G.form.def];
  $('descForce').textContent = DESCS[G.form.force];
  $('rowForce').style.display = G.form.def !== 'zone' ? '' : 'none';
  $('descPlay').textContent = PLAYS[G.form.play];
  $('descDPlay').textContent = DPLAYS[G.form.dplay];
  $('rowPlay').style.display = G.receiving === G.me ? '' : 'none';
  $('rowDPlay').style.display = G.receiving !== G.me ? '' : 'none';
  $('ovWind').textContent = 'Vent pour ce point : ' + windLabel() + '.' + (G.net === 'guest' ? ' (réglé par l’hôte)' : '');
  const hostSide = G.net !== 'guest';                        // le vent et la vitesse sont réglés par l'hôte
  $('hostOnlyWind').style.display = hostSide ? '' : 'none';
  $('rowSpeed').style.display = hostSide ? '' : 'none';
  $('rowPoints').style.display = hostSide && !G.series ? '' : 'none';
  // première attaque : avant le début d'un match (premier menu, ou revanche)
  $('rowFirst').style.display = hostSide && (G.lastMenu === 'first' || G.lastMenu === 'over') ? '' : 'none';
  $('firstB0').textContent = tn(0) + (G.me === 0 && !G.spectator ? ' (toi)' : '');
  $('firstB1').textContent = tn(1) + (G.me === 1 && !G.spectator ? ' (toi)' : '');
  $('rowLevel').style.display = $('descLevel').style.display = hostSide && !G.series ? '' : 'none';
  $('rowOpp').style.display = !G.net && !G.series ? '' : 'none';
  if (document.activeElement !== $('tname')) $('tname').value = G.form.tname;
  if (document.activeElement !== $('oname')) $('oname').value = G.form.oname;
  $('tname').placeholder = DEFAULT_TEAMS[G.me].name; $('oname').placeholder = DEFAULT_TEAMS[1 - G.me].name;
  computeTeams();
  document.querySelectorAll('.sw').forEach(b => {
    const mine = b.parentNode.dataset.for === 'tcol', t = mine ? G.me : 1 - G.me;
    b.classList.toggle('on', G.teams[t] && G.teams[t].color === b.dataset.k);
  });
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
  G.menuShown = true; G.series = null;
  $('lobbyCard').style.display = ''; $('stratCard').style.display = 'none'; $('seriesCard').style.display = 'none'; $('profileCard').style.display = 'none';
  const tutoDone = storeGet('uf-tuto', false), s = seriesState();
  $('tutoTxt').textContent = tutoDone ? 'Revoir les bases (3 minutes)' : 'Nouveau ? Commence ici : les bases en 3 minutes';
  $('tutoB').classList.toggle('primary', !tutoDone);
  $('seriesTxt').textContent = s.round >= SERIES.length ? 'Champion ! 🏆 Rejoue quand tu veux'
    : s.round > 0 || s.tries[0] ? `En cours : tour ${s.round + 1} sur 3 contre les ${SERIES[s.round].name}` : 'Trois matchs contre des équipes de plus en plus fortes';
  if (!G.net && !G.attract) startAttract();                     // un vrai match se joue derrière le menu
  const rj = rejoinInfo();
  $('rejoinB').style.display = rj ? '' : 'none';
  if (rj) $('rejoinTxt').textContent = `Partie ${rj.code} : ta connexion a coupé, reprends ta place.`;
  $('lobbyHome').style.display = ''; $('lobbyRoom').style.display = 'none'; $('lobbyJoin').style.display = 'none';
  $('lobbyErr').textContent = err || '';
  $('overlay').classList.remove('hidden');
}
function showMenu(kind) {
  G.menuShown = true;
  if (G.net !== 'guest') newWind();
  hudKey = ''; G.lastMenu = kind;
  computeTeams();
  $('lobbyCard').style.display = 'none'; $('seriesCard').style.display = 'none'; $('profileCard').style.display = 'none'; $('stratCard').style.display = '';
  const ME = G.me, side = `les ${tn(ME)} et tu attaques vers la ${ME === 0 ? 'droite' : 'gauche'}`;
  const S_ = G.series;
  if (kind === 'over') {
    const won = G.score[ME] > G.score[1 - ME];
    $('ovTitle').textContent = G.spectator ? `Victoire des ${tn(G.score[0] > G.score[1] ? 0 : 1)}` : won ? 'Victoire ! 🥏' : 'Défaite…';
    $('ovText').textContent = S_ ? (won ? (S_.cur === SERIES.length - 1 ? 'Tu remportes le tournoi ! 🏆' : `Tu passes au tour ${S_.cur + 2} !`) : 'Éliminé… tu peux retenter ce match depuis le tournoi.')
      : G.spectator ? 'Fin du match.' : 'Change de stratégie et retente ta chance.';
    $('go').textContent = S_ ? 'Suite du tournoi ▶' : G.net ? 'Revanche ▶' : 'Rejouer ▶';
    if (G.net === 'guest' && G.netSummary) G.lastSummary = G.netSummary;
    renderSummary(G.lastSummary);
  } else if (kind === 'first') {
    $('ovTitle').textContent = S_ ? `Tournoi · tour ${S_.cur + 1} : contre les ${SERIES[S_.cur].name}` : G.net ? 'Partie en ligne' : 'Ultimate Frisbee';
    $('ovText').textContent = (S_ ? SERIES[S_.cur].blurb + ' ' : '') + `Premier à ${winPts()} points. Tu joues ${side}.` + (G.spectator ? '' : '');
    if (G.spectator) $('ovText').textContent = 'Tu regardes la partie en spectateur.';
    $('go').textContent = 'Jouer le point ▶';
    renderSummary(null);
    if (G.net !== 'guest') { G.receiving = firstReceiver(); placeForPoint(); }
    updateFirstText();
  } else {
    $('ovTitle').textContent = `${tn(0)} ${G.score[0]} – ${G.score[1]} ${tn(1)}`;
    $('ovText').textContent = G.spectator ? 'Les capitaines choisissent leur stratégie…' : G.receiving === ME ? 'Tu reçois le disque : choisis ta stratégie.' : 'L’adversaire attaque : prépare ta défense.';
    $('go').textContent = 'Jouer le point ▶';
    renderSummary(null);
  }
  $('replayB').style.display = kind !== 'first' && REPLAY.last ? '' : 'none';
  $('stratCard').scrollTop = 0;
  G.readyIds = new Set(); G.lastMenu = kind;
  $('go').disabled = false;
  refreshOptions();
  refreshCaptainUI();
  $('overlay').classList.remove('hidden');
  if (G.net === 'host') netSend({ t: 'menu', kind, score: G.score, rec: G.receiving, wind: G.wind, teams: G.teams, pts: winPts(), sum: kind === 'over' ? G.lastSummary : null });
}
// en ligne : seul le capitaine de chaque équipe choisit la stratégie et se déclare prêt
function updateFirstText() {
  if (G.lastMenu !== 'first' || G.spectator) return;
  const base = $('ovText').textContent.replace(/ (Tu commences en attaque|L’adversaire commence en attaque)\.$/, '');
  $('ovText').textContent = base + (G.receiving === G.me ? ' Tu commences en attaque.' : ' L’adversaire commence en attaque.');
}
function refreshCaptainUI() {
  if (!$('stratRows')) return;
  renderPullerRow();
  const c = captain(G.me), isCap = !G.net || (c && c.id === G.myId);
  $('stratRows').classList.toggle('locked', !isCap);
  $('stratRows').style.display = G.spectator ? 'none' : '';
  $('captainNote').textContent = G.spectator ? 'Mode spectateur : les capitaines choisissent leur stratégie.' : G.net && !isCap && c ? `Stratégie choisie par ton capitaine (${humanLabel(c)}).` : '';
  $('go').style.display = isCap ? '' : 'none';
  if (!G.net) { $('oppReady').textContent = ''; return; }
  const waiting = [0, 1].map(captain).filter(h => h && !(G.readyIds && G.readyIds.has(h.id)) && h.id !== G.myId);
  $('oppReady').textContent = !isCap ? 'En attente des capitaines…'
    : waiting.length ? 'En attente de : ' + waiting.map(humanLabel).join(', ') : '';
}
function setOpt(g, v) {
  G.form[g] = v;
  if (g === 'first' && G.lastMenu === 'first') {              // premier menu : on applique tout de suite (plays proposés, texte)
    G.receiving = firstReceiver(); placeForPoint(); updateFirstText();
    if (G.net === 'host') netSend({ t: 'rec', rec: G.receiving });
  }
  if (g === 'windMode') { newWind(); hudKey = ''; }
  refreshOptions(); saveSettings();
  if (G.net === 'host' && ['windMode'].includes(g)) netSend({ t: 'wind', wind: G.wind });
}
document.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => setOpt(b.dataset.g, b.dataset.v)));
document.querySelectorAll('.wdir').forEach(b => b.addEventListener('click', () => {
  G.form.windDir = +b.dataset.d; newWind(); hudKey = ''; refreshOptions();
  if (G.net === 'host') netSend({ t: 'wind', wind: G.wind });
}));
$('windKmh').addEventListener('input', e => {
  G.form.windKmh = +e.target.value; newWind(); hudKey = ''; refreshOptions(); saveSettings();
  if (G.net === 'host') netSend({ t: 'wind', wind: G.wind });
});
// noms et couleurs d'équipe
document.querySelectorAll('.swatches').forEach(box => {
  box.innerHTML = Object.keys(PALETTE).map(k => `<button class="sw" data-k="${k}" title="${k}" style="background:${PALETTE[k][0]}"></button>`).join('');
  box.querySelectorAll('.sw').forEach(b => b.addEventListener('click', () => { G.form[box.dataset.for] = b.dataset.k; hudKey = ''; refreshOptions(); saveSettings(); }));
});
for (const id of ['tname', 'oname']) $(id).addEventListener('input', e => { G.form[id] = e.target.value.slice(0, 16); hudKey = ''; computeTeams(); saveSettings(); });

const myCfg = () => ({ off: G.form.off, def: G.form.def, force: G.form.force, play: G.form.play, dplay: G.form.dplay, allyLevel: G.form.allyLevel,
  tname: G.form.tname, tcol: G.form.tcol, puller: G.form.puller });
$('replayB').addEventListener('click', startReplay);
$('go').addEventListener('click', () => {
  saveSettings();
  if (!G.net) {                                             // solo
    if (G.series && G.phase === 'over') { showSeries(); return; }
    if (G.phase === 'over' || G.phase === 'menu') newMatch();
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
  if (G.phase === 'over' || G.phase === 'menu') newMatch();
  startPoint();
}

// =====================================================================
//  Actions du joueur (appliquées ici, ou envoyées à l'hôte si on est l'invité)
// =====================================================================
// changement de type de passe : court délai pendant lequel on ne peut pas lancer
// (un lancer demandé pendant ce délai part dès qu'il est fini, si on a toujours le disque)
const kindLocked = () => G.time - (G.kindAt || -9) < KIND_DELAY;
function setKind(k) { if (THROWS[k] && k !== G.throwKind) { G.throwKind = k; G.kindAt = G.time; } }
function pendingThrowTick() {
  const P = G.pendThrow; if (!P) return;
  if (!canThrow() || disc.holder !== P.holder) { G.pendThrow = null; return; }
  if (!kindLocked()) { G.pendThrow = null; doThrow(P.x, P.y, P.curve); }
}
function doThrow(x, y, curve) {
  if (kindLocked() && canThrow()) { G.pendThrow = { x, y, curve, holder: disc.holder }; return; }
  G.pendThrow = null;
  const kind = G.throwKind;
  G.throwKind = 'normal';                                   // après chaque lancer, on revient au lancer normal
  if (G.net === 'guest') { netSend({ t: 'throw', x, y, curve, kind }); return; }
  if (canThrow()) throwDisc(disc.holder, x, y, curve, 1, kind);
}
function setThrowKind(k) { setKind(k); }
// armer / désarmer la passe haute (les défenseurs voient le disque levé tant qu'elle est armée)
function toggleHigh() { setKind(G.throwKind === 'high' ? 'normal' : 'high'); }
function cycleThrowKind() { setKind(THROW_ORDER[(THROW_ORDER.indexOf(G.throwKind) + 1) % THROW_ORDER.length]); }
document.querySelectorAll('.tk').forEach(b => b.addEventListener('click', () => setThrowKind(b.dataset.k)));

// chat rapide en ligne
$('emoBar').innerHTML = EMOTES.map((e, k) => `<button data-e="${k}">${e}</button>`).join('');
$('emoBar').querySelectorAll('button').forEach(b => b.addEventListener('click', () => sendEmote(+b.dataset.e)));
let emoT = -9;
function sendEmote(k) {
  if (!G.net || G.time - emoT < 1.2 || !EMOTES[k]) return;
  emoT = G.time;
  if (G.net === 'guest') netSend({ t: 'emo', e: k });
  else hostEmote(G.myId, k);
}
function doDive(x, y) {
  if (G.net === 'guest') { netSend({ t: 'dive', x, y }); return; }
  diveFor(meH(), x, y);
}
function doJump() {
  if (G.net === 'guest') { netSend({ t: 'jump' }); return; }
  jumpFor(meH());
}
const canJump = () => !!jumpTarget(meH());
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

// ---------- retour au menu principal (depuis un match, le menu d'avant-point, le tutoriel, l'entraînement, en ligne) ----------
// confirmation dans le jeu (les fenêtres du navigateur peuvent être bloquées) ; en solo, le jeu se met en pause
function askConfirm(text, yesLabel, onYes) {
  $('askText').textContent = text; $('askYes').textContent = yesLabel;
  $('askBox').style.display = ''; G.paused = true;
  const close = () => { $('askBox').style.display = 'none'; G.paused = false; $('askYes').onclick = $('askNo').onclick = null; };
  $('askNo').onclick = close;
  $('askYes').onclick = () => { close(); onYes(); };
}
function goMainMenu() {
  const inMatch = !G.attract && (G.phase === 'play' || G.phase === 'pull' || G.score[0] + G.score[1] > 0);
  if (G.net) { askConfirm(G.net === 'host' ? 'Quitter la partie ? Elle se terminera pour tous les joueurs.' : 'Quitter la partie en ligne ?', 'Quitter', leaveToMenu); return; }
  if (!G.tuto && !G.practice && inMatch) { askConfirm('Abandonner le match en cours ?', 'Abandonner', leaveToMenu); return; }
  leaveToMenu();
}
function leaveToMenu() {
  G.replay = null; FX.parts.length = 0; G.msgT = 0;
  if (G.tuto) { tutoQuit(); return; }
  if (G.practice) { practiceQuit(); return; }
  if (G.net) { storeSet('uf-rejoin', null); G.joinCode = null; netError(''); return; }
  backToSolo(); showLobby();
}
$('menuB').addEventListener('click', goMainMenu);
$('menuBack').addEventListener('click', goMainMenu);

// ---------- qui pulle (en ligne : choisi par le capitaine) ----------
function renderPullerRow() {
  const show = !G.spectator && !G.tuto && teamHumans(G.me).length > 0;
  $('rowPuller').style.display = show ? '' : 'none';
  if (!show) return;
  const hs = teamHumans(G.me), valid = ['cap', 'rot', 'ai'].concat(hs.map(h => String(h.id)));
  if (!valid.includes(String(G.form.puller))) G.form.puller = 'cap';
  const opts = hs.map(h => [String(h.id), !G.net ? 'Moi' : humanLabel(h) + (h.id === G.myId ? ' (moi)' : '')]);
  if (hs.length > 1) opts.push(['rot', 'Chacun son tour']);
  opts.push(['ai', 'IA']);
  const cur = G.form.puller === 'cap' && captain(G.me) ? String(captain(G.me).id) : String(G.form.puller);
  $('pullerOpts').innerHTML = opts.map(([v, l]) => `<button class="popt${v === cur ? ' on' : ''}" data-v="${esc(v)}">${esc(l)}</button>`).join('');
  $('pullerOpts').querySelectorAll('.popt').forEach(b => b.addEventListener('click', () => { G.form.puller = b.dataset.v; renderPullerRow(); }));
  $('descPuller').textContent = cur === 'rot' ? 'Les joueurs de ton équipe pullent à tour de rôle.' : cur === 'ai' ? 'Le pull est fait automatiquement par l’IA.'
    : 'Ce joueur fera le pull quand ton équipe défend (il prend le disque à la place du pulleur).';
}
