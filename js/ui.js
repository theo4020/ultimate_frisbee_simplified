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
  $('highB').innerHTML = G.throwKind === 'high' ? 'Haute ✓<br><small>annuler</small>' : 'Pivot<br><small>maintenir : haute</small>';
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
  const K = a => keysOf(a).map(keyName).join('/');            // touches réglées dans le panneau Commandes
  $('hint').innerHTML = G.spectator ? '<i>Mode spectateur</i> : tu regardes la partie. Bouton <b>👥 Équipes</b> (en haut) pour rejoindre une équipe s’il reste une place. Les émojis permettent d’encourager les joueurs.'
    : G.phase === 'pull'
    ? (pulling ? '<i>Pull</i> : clique sur la zone visée (' + K('curveL') + ' / ' + K('curveR') + ' ou molette pour la courbe), puis arrête la jauge dans le vert (clic ou Espace). Échap pour revenir à la visée. Un pull long et haut laisse le temps à ta défense de monter.' : '<i>Pull</i> : le disque arrive, ton équipe se met en place.')
    : att
    ? (multi ? '<i>Attaque à plusieurs</i> : ton joueur (anneau jaune) suit la souris ; quand il a le disque, vise et relâche pour lancer. <i>' + K('switch') + ' / 1 à 5</i> = prendre un joueur géré par l’IA.'
             : '<i>Attaque</i> : vise et relâche pour lancer (relâche sur ton joueur pour annuler).')
    + ' <i>' + K('high') + '</i> = armer / désarmer la passe haute (la défense voit le disque levé et doit deviner quand tu lances). <i>' + K('jump') + '</i> = saut du receveur pendant le vol (duel en l’air). <i>Clic droit</i> = saut (en défense, ou du receveur pendant le vol) ; avec le disque, clic droit sur le terrain = le coéquipier IA le plus proche attaque cet espace. <i>Clic sur un coéquipier</i> = tu le prends. <i>' + K('dive') + ' / clic pendant le vol</i> = layout du receveur. Anneau vert = coéquipier démarqué. Zone rouge = break side : ajoute de la courbe (' + K('curveL') + ' / ' + K('curveR') + ', molette) pour contourner la mark. Cercle pointillé = zone de stall. Couleur de la trajectoire : rouge = contrable, orange = contrable debout seulement, violet = en sautant, bleu = trop haut.'
    : '<i>Défense</i> : ton joueur (anneau jaune) suit la souris ou le doigt. <i>Clic / ' + K('dive') + '</i> = layout. <i>' + K('jump') + '</i> = saut (contrer une passe haute au lâcher à la mark, ou à l’arrivée). <i>' + K('switch') + '</i> = switch vers le joueur en gris, <i>1 à 5</i> = prendre ce joueur. Entre dans le cercle du handler pour lancer le stall (un seul défenseur dedans, sinon double team). L’anneau sous le disque en vol : rouge = contrable, orange = debout seulement, violet = en sautant, bleu = trop haut.';
  if (G.gpActive) $('hint').innerHTML = '🎮 <i>Manette</i> : stick gauche = déplacer le curseur de visée / courir (stick droit = visée fine) · A ou RT = lancer au curseur (sans le disque : saut) · B = layout · X = appel de cut au curseur (sans le disque : switch) · Y = passe haute · LB/RB = courbe · Start = menu. ' + $('hint').innerHTML;
  $('emoBar').style.display = G.net && G.started ? '' : 'none';
  resize();
}

function refreshOptions() {
  renderPullerRow();
  renderSelects();
  document.querySelectorAll('.opt').forEach(b => b.classList.toggle('on', G.form[b.dataset.g] === b.dataset.v));
  const os = pickedSys('osys'), ds = pickedSys('dsys');
  $('descOff').textContent = os ? `Ta formation « ${os.name} » : chacun prend sa place et attaque l’espace libre depuis là.` : DESCS[G.form.off];
  $('descRestart').textContent = DESCS['restart_' + G.form.restart];
  $('descFlow').textContent = G.form.flow === 'flow' ? 'Le jeu continue dès la réception : un coupeur propose tout de suite la passe suivante.'
    : 'Après chaque passe, chacun se replace dans la formation ; on n’enchaîne que si un coupeur est déjà lancé.';
  $('descDef').textContent = ds ? `Ta défense « ${ds.name} » : ${sysInfo(ds)}, chaque défenseur suit ses consignes.` + (ds.mark.force !== 'menu' ? ` ${MARK_OPTS.force[ds.mark.force]} (choisie dans la défense).` : '') : DESCS[G.form.def];
  $('descForce').textContent = DESCS[G.form.force];
  $('rowForce').style.display = (ds ? ds.mark.force === 'menu' : G.form.def !== 'zone') ? '' : 'none';
  const pd = n => { const ty = G.form['play' + n], ps = ty === 'sys' && pickedSys('p' + n + 'sys');
    return ty === 'none' ? '' : ps ? `★ ${ps.name} : tes courses, jouées depuis où sont les joueurs.` : PLAYS[ty]; };
  $('descPlay').innerHTML = [1, 2].map(n => pd(n) && `<b>Play ${n}</b> : ${esc(pd(n))}`).filter(Boolean).join('<br>')
    + `<br><i>Avec le disque, appelle-les quand tu veux : ${keysOf('play1').map(keyName)[0] || '?'} / ${keysOf('play2').map(keyName)[0] || '?'}, boutons ▶ sur le terrain, ou ← / → à la manette.</i>`;
  $('descDPlay').textContent = DPLAYS[G.form.dplay];
  $('ordersSum').textContent = ordersText(G.form) ? '· ' + ordersText(G.form) : '';
  $('rowPlay').style.display = G.spectator ? 'none' : '';
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
function showLobby(err, view) {
  if (typeof endlessCfgOut === 'function') endlessCfgOut();
  G.menuShown = true; G.teamsOpen = null; G.series = null;
  $('lobbyCard').style.display = ''; for (const id of ['stratCard', 'seriesCard', 'profileCard', 'endlessCard']) $(id).style.display = 'none';
  const tutoDone = storeGet('uf-tuto', false), s = seriesState();
  $('tutoTxt').textContent = tutoDone ? 'Revoir les commandes (5 minutes)' : 'Nouveau ? Commence ici : toutes les commandes en 5 minutes';
  $('tutoB').classList.toggle('primary', !tutoDone);
  $('seriesTxt').textContent = s.round >= SERIES.length ? 'Champion ! 🏆 Rejoue quand tu veux'
    : s.round > 0 || s.tries[0] ? `En cours : tour ${s.round + 1} sur 3 contre les ${SERIES[s.round].name}` : 'Trois matchs contre des équipes de plus en plus fortes';
  if (!G.net && !G.attract) startAttract();                     // un vrai match se joue derrière le menu
  $('lobbyHome').style.display = view ? 'none' : ''; $('lobbySolo').style.display = view === 'solo' ? '' : 'none';
  $('lobbyOnline').style.display = view === 'online' ? '' : 'none';
  const last = storeGet('uf-last-room', null), lastOk = last && /^[A-Z0-9]{4}$/.test(last.code) && Date.now() - last.at < 3 * 3600e3;
  $('rejoinB').style.display = lastOk ? '' : 'none';                     // revenir dans la dernière partie rejointe (3 h)
  if (lastOk) $('rejoinTxt').textContent = 'Code ' + last.code + ' · si l’hôte joue encore';
  $('lobbyRoom').style.display = 'none'; $('lobbyJoin').style.display = 'none';
  const eb = endlessLocal().best;
  $('endlessTxt').textContent = eb ? `Ton record : ${eb} match${eb > 1 ? 's' : ''} gagné${eb > 1 ? 's' : ''}. Bats-le !` : 'Enchaîne les matchs en 2 points, de plus en plus durs : jusqu’où iras-tu ?';
  $('lobbyErr').textContent = err || '';
  $('overlay').classList.remove('hidden');
}
function showMenu(kind) {
  G.menuShown = true; G.teamsOpen = null;
  if (G.net !== 'guest') newWind();
  hudKey = ''; G.lastMenu = kind;
  computeTeams();
  for (const id of ['lobbyCard', 'seriesCard', 'profileCard', 'endlessCard']) $(id).style.display = 'none';
  $('stratCard').style.display = '';
  const ME = G.me, side = `les ${tn(ME)} et tu attaques vers la ${ME === 0 ? 'droite' : 'gauche'}`;
  const S_ = G.series;
  if (kind === 'over') {
    const won = G.score[ME] > G.score[1 - ME];
    $('ovTitle').textContent = G.spectator ? `Victoire des ${tn(G.score[0] > G.score[1] ? 0 : 1)}` : won ? 'Victoire ! 🥏' : 'Défaite…';
    $('ovText').textContent = S_ && S_.endless ? endlessOverText(won)
      : S_ ? (won ? (S_.cur === SERIES.length - 1 ? 'Tu remportes le tournoi ! 🏆' : `Tu passes au tour ${S_.cur + 2} !`) : 'Éliminé… tu peux retenter ce match depuis le tournoi.')
      : G.spectator ? 'Fin du match.' : 'Change de stratégie et retente ta chance.';
    $('go').textContent = S_ && S_.endless ? (won ? 'Match suivant ▶' : 'Voir le classement ▶') : S_ ? 'Suite du tournoi ▶' : G.net ? 'Revanche ▶' : 'Rejouer ▶';
    if (G.net === 'guest' && G.netSummary) G.lastSummary = G.netSummary;
    renderSummary(G.lastSummary);
  } else if (kind === 'first') {
    $('ovTitle').textContent = S_ ? (S_.endless ? `♾️ Match ${S_.cur + 1} : contre les ${serOpp().name}` : `Tournoi · tour ${S_.cur + 1} : contre les ${serOpp().name}`) : G.net ? 'Partie en ligne' : 'Ultimate Frisbee';
    $('ovText').textContent = (S_ ? serOpp().blurb + ' ' : '') + `Premier à ${winPts()} points. Tu joues ${side}.` + (G.spectator ? '' : '');
    if (G.spectator) $('ovText').textContent = 'Tu regardes la partie en spectateur.';
    $('go').textContent = 'Jouer le point ▶';
    renderSummary(null);
    if (G.net !== 'guest') { G.receiving = firstReceiver(); placeOnPullLines(); }
    updateFirstText();
  } else {
    $('ovTitle').textContent = `${tn(0)} ${G.score[0]} – ${G.score[1]} ${tn(1)}`;
    $('ovText').textContent = G.spectator ? 'Les capitaines choisissent leur stratégie…' : G.receiving === ME ? 'Tu reçois le disque : choisis ta stratégie.' : 'L’adversaire attaque : prépare ta défense.';
    $('go').textContent = 'Jouer le point ▶';
    renderSummary(null);
  }
  $('replayB').style.display = kind !== 'first' && REPLAY.last && !G.net ? '' : 'none';
  $('stratCard').scrollTop = 0;
  G.readyIds = new Set(); G.lastMenu = kind;
  $('go').disabled = false;
  refreshOptions();
  refreshCaptainUI();
  $('overlay').classList.remove('hidden');
  if (G.net === 'host') netSend({ t: 'menu', kind, score: G.score, rec: G.receiving, wind: G.wind, teams: G.teams, pts: winPts(), sum: kind === 'over' ? G.lastSummary : null, ser: coopSer() });
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
  $('stratRows').style.display = G.spectator || (G.net && !isCap) ? 'none' : '';   // les coéquipiers voient le résumé ci-dessous
  $('captainNote').innerHTML = G.spectator ? 'Mode spectateur : les capitaines choisissent leur stratégie. Bouton 👥 Équipes pour jouer.'
    : G.net && !isCap && c ? `Stratégie choisie par ton capitaine (${esc(humanLabel(c))}) :<div class="capStrat">${stratSummary(cfg(G.me))}</div>` : '';
  $('go').style.display = isCap ? '' : 'none';
  if (!G.net) { $('oppReady').textContent = ''; return; }
  const waiting = [0, 1].map(captain).filter(h => h && !(G.readyIds && G.readyIds.has(h.id)) && h.id !== G.myId);
  $('oppReady').textContent = !isCap ? 'En attente des capitaines…'
    : waiting.length ? 'En attente de : ' + waiting.map(humanLabel).join(', ') : '';
}
// consignes d'équipe qui ne sont pas « normales », en quelques mots
function ordersText(c) {
  const t = [];
  if (c.huck && c.huck !== 'normal') t.push(c.huck === 'plus' ? 'plus de jeu long' : 'moins de jeu long');
  if (c.high && c.high !== 'normal') t.push(c.high === 'plus' ? 'plus de passes hautes' : 'moins de passes hautes');
  if (c.risk && c.risk !== 'normal') t.push(c.risk === 'ose' ? 'osé' : 'prudent');
  if (c.help && c.help !== 'parfois') t.push(c.help === 'jamais' ? 'jamais d’aide' : 'aide toujours');
  return t.join(', ');
}
// résumé (lecture seule) de la stratégie d'un capitaine, pour ses coéquipiers
function stratSummary(c) {
  c = c || DEFAULT_CFG;
  const lbl = (g, v) => esc((SEL_LISTS[g].find(o => o[0] === v) || [0, v || '—'])[1]);
  const sn = s => (s && typeof s === 'object' && s.name ? '★ ' + esc(s.name) : '');
  const zone = c.dsys && typeof c.dsys === 'object' ? c.dsys.mark && c.dsys.mark.force !== 'menu' : c.def === 'zone';
  const rows = [['Formation', sn(c.osys) || lbl('off', c.off)], ['Défense', sn(c.dsys) || lbl('def', c.def)]];
  if (!zone) rows.push(['Force', lbl('force', c.force)]);
  rows.push(['Play 1', c.play1 === 'sys' ? sn(c.p1sys) || '—' : lbl('play1', c.play1)], ['Play 2', c.play2 === 'sys' ? sn(c.p2sys) || '—' : lbl('play2', c.play2)],
    ['Play de défense', lbl('dplay', c.dplay)], ['Reprise', c.restart === 'rapide' ? 'Rapide' : 'Posée'], ['Coéquipiers IA', esc(LVL_NAME[c.allyLevel] || 'Normal')]);
  rows.splice(1, 0, ['Style', c.flow === 'flow' ? 'Enchaîné' : 'Structuré']);
  if (ordersText(c)) rows.push(['Consignes', esc(ordersText(c))]);
  return rows.map(([a, b]) => `<span><b>${a}</b> ${b}</span>`).join('');
}
// systèmes perso proposés dans le menu ; « picked » = celui choisi et encore existant
const sysAllowed = () => true;                                // partout où l'on choisit sa stratégie (mode infini compris)
const pickedSys = k => (sysAllowed() && G.form[k] ? sysById(G.form[k]) : null);
// menus déroulants du menu d'avant-point : classiques, puis « Mes systèmes » (attaque et défense)
const SEL_LISTS = {
  off: [['vert', 'Vertical stack'], ['ho', 'Horizontal stack'], ['side', 'Side stack']],
  def: [['man', 'Man (individuelle)'], ['zone', 'Zone'], ['clam', 'Clam']],
  force: [['haut', 'Force haut'], ['bas', 'Force bas'], ['middle', 'Force middle'], ['straight', 'Straight up']],
  play1: [['none', 'Aucun'], ['huck', 'Huck'], ['split', 'Double cut'], ['give', 'Give and go'], ['flood', 'Iso'], ['swing', 'Dump-swing']],
  dplay: [['none', 'Aucun'], ['safety', 'Deep safety'], ['double', 'Poach'], ['junk', 'Junk']]
};
SEL_LISTS.play2 = SEL_LISTS.play1;
const SEL_IDS = { off: 'selOff', def: 'selDef', force: 'selForce', play1: 'selPlay1', play2: 'selPlay2', dplay: 'selDPlay' };
// clé du système perso associé à chaque menu ('osys' formation, 'dsys' défense, 'p1sys'/'p2sys' plays) et genre de système
const SEL_SYS = { off: ['osys', 'off'], def: ['dsys', 'def'], play1: ['p1sys', 'play'], play2: ['p2sys', 'play'] };
function renderSelects() {
  for (const g in SEL_IDS) {
    const el = $(SEL_IDS[g]), [sk, kind] = SEL_SYS[g] || [null, null];
    let html = SEL_LISTS[g].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    if (sk && sysAllowed()) {
      const mine = sysList().filter(s => s.kind === kind);
      html = `<optgroup label="Classiques">${html}</optgroup><optgroup label="Mes systèmes">`
        + mine.map(s => `<option value="sys:${s.id}">★ ${esc(s.name)}</option>`).join('')
        + `<option value="edit">✏️ ${mine.length ? 'Créer ou modifier…' : 'Créer un système…'}</option></optgroup>`;
    }
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    const ps = sk && (g.startsWith('play') ? G.form[g] === 'sys' : true) && pickedSys(sk);
    el.value = ps ? 'sys:' + ps.id : G.form[g] === 'sys' ? 'none' : G.form[g];
  }
}
for (const g in SEL_IDS) $(SEL_IDS[g]).addEventListener('change', e => {
  const v = e.target.value;
  if (v === 'edit') { refreshOptions(); openSystems(); return; }   // remet le choix actuel, puis ouvre l'éditeur
  if (v.startsWith('sys:')) {
    if (g.startsWith('play')) { G.form[SEL_SYS[g][0]] = v.slice(4); setOpt(g, 'sys'); }
    else setOpt(SEL_SYS[g][0], v.slice(4));
  } else setOpt(g, v);
});
// en ligne, capitaine invité : ses choix partent tout de suite chez l'hôte, pour que ses coéquipiers les voient
function shareCfg() {
  const c = captain(G.me);
  if (G.net === 'guest' && c && c.id === G.myId && !G.spectator) netSend({ t: 'cfg', cfg: myCfg() });
}
function setOpt(g, v) {
  if (g === 'off') G.form.osys = null;                         // une formation de base remplace le système perso
  if (g === 'def') G.form.dsys = null;
  G.form[g] = v;
  if (g === 'first' && G.lastMenu === 'first') {              // premier menu : on applique tout de suite (plays proposés, texte)
    G.receiving = firstReceiver(); placeOnPullLines(); updateFirstText();
    if (G.net === 'host') netSend({ t: 'rec', rec: G.receiving });
  }
  if (g === 'windMode') { newWind(); hudKey = ''; }
  refreshOptions(); saveSettings(); shareCfg();
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
  tname: G.form.tname, tcol: G.form.tcol, puller: G.form.puller, restart: G.form.restart, flow: G.form.flow, huck: G.form.huck, high: G.form.high, risk: G.form.risk, help: G.form.help,
  osys: pickedSys('osys'), dsys: pickedSys('dsys'), play1: G.form.play1, play2: G.form.play2,
  p1sys: G.form.play1 === 'sys' ? playOut(pickedSys('p1sys')) : null, p2sys: G.form.play2 === 'sys' ? playOut(pickedSys('p2sys')) : null });   // en ligne, les systèmes entiers partent chez l'hôte
$('replayB').addEventListener('click', startReplay);
$('go').addEventListener('click', () => {
  saveSettings();
  if (!G.net) {                                             // solo
    if (G.series && G.phase === 'over') { if (G.series.endless) endlessNext(); else showSeries(); return; }
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
  if (G.series && G.series.coop && G.phase === 'over') { coopNext(); return; }   // mode infini à plusieurs : match suivant ou fin
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
// Bouton pivot (Z, Y à la manette, bouton à l'écran, appui sur ton porteur au doigt) :
//  appui court = changer de pied de pivot (côté open ↔ côté fermé, la mark suit : feinte possible) ;
//  maintenu PIVOT_HOLD s = armer la passe haute (le temps de maintien compte dans sa préparation) ; appui court si armée = annuler
const PIVOT_HOLD = 0.3, PB = { down: false, at: 0, done: false };
function pivotBtnDown() { if (!canThrow() || PB.down) return; PB.down = true; PB.at = G.time; PB.done = false; }
function pivotBtnCancel() { PB.down = false; }
function pivotBtnUp() {
  if (!PB.down) return;
  PB.down = false;
  if (PB.done || !canThrow()) return;
  if (G.throwKind === 'high') setKind('normal'); else togglePivot();
}
function togglePivot() { if (G.pivHolder !== disc.holder) { G.pivHolder = disc.holder; G.pivSel = -1; } G.pivSel = G.pivSel > 0 ? -1 : 1; sendInput(true); }
function pivotBtnFrame() {
  if (disc.mode === 'held' && disc.holder !== G.pivHolder) { G.pivHolder = disc.holder; G.pivSel = -1; }   // nouvelle réception : pivot côté open
  if (PB.down && !PB.done && G.time - PB.at >= PIVOT_HOLD) {
    PB.done = true;
    if (canThrow() && G.throwKind !== 'high') { setKind('high'); G.kindAt -= PIVOT_HOLD; }
  }
}
// armer / désarmer la passe haute (les défenseurs voient le disque levé tant qu'elle est armée)
function toggleHigh() { setKind(G.throwKind === 'high' ? 'normal' : 'high'); }
function cycleThrowKind() { setKind(THROW_ORDER[(THROW_ORDER.indexOf(G.throwKind) + 1) % THROW_ORDER.length]); }
document.querySelectorAll('.tk').forEach(b => b.addEventListener('click', () => setThrowKind(b.dataset.k)));

// chat rapide en ligne
// un seul petit bouton 😀 sur le terrain ; la liste des réactions ne s'ouvre qu'en le touchant (et se referme seule)
$('emoBar').innerHTML = '<button id="emoToggle" title="Réactions">😀</button><span id="emoList">'
  + EMOTES.map((e, k) => `<button data-e="${k}">${e}</button>`).join('') + '</span>';
let emoCloseT = null;
function emoOpen(on) {
  $('emoBar').classList.toggle('open', on);
  clearTimeout(emoCloseT);
  if (on) emoCloseT = setTimeout(() => emoOpen(false), 4000);
}
$('emoToggle').addEventListener('click', () => emoOpen(!$('emoBar').classList.contains('open')));
$('emoList').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { sendEmote(+b.dataset.e); emoOpen(false); }));
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
// appeler Play 1 ou Play 2 (le porteur humain) ; l'invité demande à l'hôte
function doPlay(n) {
  if (!canThrow()) return;
  if (G.net === 'guest') { netSend({ t: 'callplay', n }); return; }
  callPlay(G.me, n);
}
// boutons ▶ sur le terrain : visibles quand tu as le disque et qu'un play peut être appelé
function playBtnsFrame() {
  const show = canThrow() && !G.replay && $('overlay').classList.contains('hidden');
  document.body.classList.toggle('tutoplays', !!G.tuto && show && (canCallPlay(G.me, 1) || canCallPlay(G.me, 2)));
  for (const n of [1, 2]) {
    const b = $('play' + n + 'B'), ok = show && canCallPlay(G.me, n);
    b.style.display = ok ? '' : 'none';
    if (ok) { const ty = playOf(G.me, n), s = ty === 'sys' && playSys(G.me, n), txt = `▶ ${s ? s.name : PLAY_NAMES[ty]}` + (isTouch() ? '' : ` (${keyName(keysOf('play' + n)[0] || '?')})`); if (b.textContent !== txt) b.textContent = txt; }
  }
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
  if (G.net) { netError(''); return; }
  backToSolo(); showLobby();
}
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

// pointerdown (et pas click) : un 2e doigt peut appeler un play pendant que le 1er vise, sans interrompre la visée
for (const n of [1, 2]) $('play' + n + 'B').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); doPlay(n); });
