// tuto.js — Tutoriel interactif avec Coach Disco : petits défis guidés (toutes les commandes du jeu), chacun passable.
// Les étapes placent les joueurs, en « figent » certains (pin), et attendent un événement de jeu
// (réception, point, turnover, pull) pour valider. Chaque défi rapporte des étoiles : ★ réussi, ★★ du premier coup,
// ★★★ du premier coup et en moins de « par » secondes. Le coach présente chaque étape et commente (avec humour).

// Coach Disco : ses réactions (tirées au hasard)
const COACH = {
  name: 'Coach Disco', face: '🧢',
  win: ['Propre. Même ma grand-mère n’aurait pas fait mieux, et elle a un sacré bras.', 'Joli ! Je verse une larme. Non, c’est la sueur.',
    'Voilà ! Tu vois, quand tu veux.', 'Magnifique. Je le mets dans ma vidéo de fin de saison.', 'Parfait. Bon, je retourne à mon thermos de café.',
    'Ça, c’est du jeu ! Les tribunes sont debout. Enfin, le pigeon sur la tribune.'],
  fail: ['Le disque, c’est l’objet rond. Pas le sol.', 'Presque ! Enfin… dans une autre dimension.', 'Pas grave, moi aussi j’ai raté mon premier. Et le deuxième. Allez !',
    'On recommence, personne n’a rien vu. Sauf moi. Et le pigeon.', 'Respire. Visualise. Et réessaie.', 'C’était une feinte, c’est ça ? Bien sûr que c’était une feinte.']
};
const pickLine = a => a[Math.floor(Math.random() * a.length)];

// ---------- conseils de Coach Disco, la première fois qu'on rencontre un petit jeu ----------
// une bulle en haut de l'écran, sans mettre le jeu en pause ni bloquer de clic (elle part seule) ; une seule fois par conseil
const TIPS = {
  start: () => `Compte à rebours : 3, 2, 1… PULL ! ${isTouchUI() ? 'Tape l’écran' : 'Clic ou Espace'} pile au « PULL » et ton équipe part en trombe. Trop tôt ? Hors-jeu, et je siffle.`,
  offside: () => 'Hors-jeu ! Quand ton équipe pulle, l’adversaire repart du brick ; quand elle reçoit, elle attend que la défense se place. On ne vole pas le départ !',
  // les bases, pour qui n'a pas fait le tutoriel
  throw: () => isTouchUI() ? (CTRL.sling ? 'Le disque est à toi ! Tire le doigt en arrière, à l’opposé d’un coéquipier démarqué (anneau vert), et lâche.' : 'Le disque est à toi ! Glisse le doigt vers un coéquipier démarqué (anneau vert) et lâche pour lancer.')
    : 'Le disque est à toi ! Vise un coéquipier démarqué (anneau vert), maintiens le clic et relâche pour lancer.',
  defend: () => 'En défense, tu diriges le joueur à l’anneau jaune : ' + (isTouchUI() ? (CTRL.move === 'joystick' ? 'pose le doigt et glisse pour courir, bouton Layout pour plonger sur le disque.' : 'tape ou glisse pour le déplacer, glisse vite pour plonger.') : 'il suit ta souris, clic pour plonger sur le disque.'),
  mark: () => `Te voilà en mark ! ${isTouchUI() ? 'Gauche, droite' : 'Souris à gauche, à droite'} : tu fermes un côté du thrower. Pour la quitter, vise plus loin, je ne te retiens pas.`
};
let tipT = 0, tipSeen = null, tutoC = { t: -99, v: false };
function coachTip(k) {
  if (tipT > 0 || (tipSeen && tipSeen[k])) return;                 // (appelé à chaque image : la mémoire évite de relire le stockage)
  const seen = storeGet('uf-tips', {}) || {}; tipSeen = seen;
  if (seen[k]) return;
  seen[k] = 1; storeSet('uf-tips', seen);
  $('ctText').textContent = '« ' + TIPS[k]() + ' »'; $('coachTip').style.display = '';
  tipT = 7;
}
function tipsFrame(dt) {
  if (tipT > 0) { tipT -= dt; if (tipT <= 0) $('coachTip').style.display = 'none'; }
  if (G.attract || G.tuto || G.practice || G.spectator || G.replay || !$('overlay').classList.contains('hidden')) return;
  const me = meH(); if (!me || (me.team !== 0 && me.team !== 1)) return;
  const st = G.net === 'guest' ? G.netStart : startNet();
  if (st && st[0] >= 1) coachTip('start');
  const off = G.net === 'guest' ? G.netOffside : G.offside && G.offside.team;
  if (off === me.team) coachTip('offside');
  if (G.time - tutoC.t > 2) tutoC = { t: G.time, v: !!storeGet('uf-tuto', false) };
  if (!tutoC.v && G.phase === 'play') {        // pas de tutoriel : les deux gestes de base, la première fois
    if (canThrow()) coachTip('throw');
    else if (disc.holder && disc.holder.team !== me.team && me.sel && controllerOf(me.sel) === me) coachTip('defend');
  }
  const s = me.sel, h = disc.holder;
  if (CTRL.markAssist && s && h && disc.mode === 'held' && G.phase === 'play' && h.team !== me.team && dist(s.x, s.y, h.x, h.y) < STALL_R) coachTip('mark');
}

const TUTO_STEPS = [
  {
    title: 'Se déplacer',
    coach: 'Bienvenue au camp ! Moi c’est Coach Disco : 30 ans de terrain, zéro genou intact. Première leçon : courir. Oui, même ça.', par: 14,
    ctx: 'move',
    text: {
      mouse: 'Ton joueur (anneau jaune) <b>suit la souris</b>. Amène-le dans les 3 cercles, l’un après l’autre.',
      touch: () => CTRL.move === 'follow' ? 'Garde le doigt sur l’écran : ton joueur (anneau jaune) <b>suit ton doigt</b>. Amène-le dans les 3 cercles, l’un après l’autre.'
        : '<b>Tape</b> (ou glisse) là où tu veux aller : ton joueur (anneau jaune) y court. Amène-le dans les 3 cercles, l’un après l’autre.',
      joy: 'Pose le doigt n’importe où et <b>glisse</b> : ton joueur (anneau jaune) court dans cette direction. Amène-le dans les 3 cercles, l’un après l’autre.',
      pad: 'Le <b>stick gauche</b> déplace ton joueur (anneau jaune). Amène-le dans les 3 cercles, l’un après l’autre.'
    },
    setup() {
      tutoReset(); G.tuto.spots = TUTO_SPOTS.slice();
      tutoPut(1, [[70, 18.5], [80, 8], [80, 29], [90, 6], [90, 31]]);
      tutoPut(0, [[40, 18.5], [72, 8], [72, 29], [86, 6], [86, 31]]);
      tutoGive(TEAMS[1][0]);
      const h = meH(); if (h) h.sel = TEAMS[0][0];
    },
    frame() {                                                    // un cercle atteint : le suivant s'allume
      const T = G.tuto, sp = T.spots, me = (meH() || {}).sel;
      if (T.done || !sp || !sp.length || !me) return;
      if (dist(me.x, me.y, sp[0][0], sp[0][1]) < TUTO_SPOT_R) {
        sp.shift(); try { SOUNDS.catch(); } catch (e) { }
        if (sp.length) flash((TUTO_SPOTS.length - sp.length) + ' / ' + TUTO_SPOTS.length, true); else tutoSuccess('Bien couru !');
      }
    },
    pin(p) { return [[70, 18.5], [80, 8], [80, 29], [90, 6], [90, 31]][p.i]; },
    pinD(d) { return d === (meH() || {}).sel ? null : [[40, 18.5], [72, 8], [72, 29], [86, 6], [86, 31]][d.i]; },
    hold() { return true; }                                    // le porteur adverse garde le disque
  },
  {
    title: 'Lancer',
    coach: 'Un disque, ça se lance vers un coéquipier. Pas comme une assiette chez mamie.', par: 16,
    text: {
      mouse: 'Vise un coéquipier libre (anneau vert) : <b>maintiens le clic</b>, puis relâche. Réussis 2 passes.',
      touch: () => CTRL.sling ? 'Pose le doigt n’importe où et <b>tire en arrière</b>, à l’opposé de la passe, puis relâche. Réussis 2 passes.' : 'Pose le doigt n’importe où et <b>glisse vers ton coéquipier</b>, puis relâche. Réussis 2 passes.',
      joy: 'Pose le doigt n’importe où et <b>glisse vers ton coéquipier</b>, puis relâche. Réussis 2 passes.',
      pad: 'Mets le curseur sur un coéquipier libre avec le stick gauche, puis <b>A</b>. Réussis 2 passes.'
    },
    setup() {
      tutoReset();
      tutoPut(0, [[30, 18.5], [42, 11], [41, 26], [24, 8], [24, 29]]);
      tutoFarDefense();
      tutoGive(TEAMS[0][0]);
    },
    pin(p) {
      if (p.team === 1) return tutoFar(p);
      const h = disc.holder; if (!h || disc.mode !== 'held') return null;
      const mates = TEAMS[0].filter(q => q !== h), k = mates.indexOf(p);
      const hx = Math.min(h.x, W - EZ - 15);
      return [[hx + 13, 10], [hx + 12, 27], [hx - 7, 7], [hx - 7, 30]][k];
    },
    on(ev, p) { if (ev === 'catch' && p.team === 0 && ++G.tuto.count >= 2) tutoSuccess('Bien joué !'); else if (ev === 'catch') flash('1 / 2', true); }
  },
  {
    title: 'La courbe',
    coach: 'Un défenseur sur la ligne droite ? On fait le tour, comme le disque. C’est ça, la courbe.', par: 16,
    ctx: 'throw',
    text: {
      mouse: () => `Un défenseur bloque la ligne droite. Ajoute de la <b>courbe</b> (${tutoCmd('curveL')} / ${tutoCmd('curveR')} ou molette) pour passer à côté.`,
      touch: 'Un défenseur bloque la ligne droite. Pendant que tu vises, glisse un <b>2<sup>e</sup> doigt sur le côté</b> pour courber la passe.',
      joy: 'Un défenseur bloque la ligne droite. Règle la <b>courbe</b> avec le curseur du bord droit, puis lance à côté de lui.',
      pad: 'Un défenseur bloque la ligne droite. Ajoute de la <b>courbe</b> avec LB / RB, puis lance à côté de lui.'
    },
    setup() {
      tutoReset(); G.tuto.wall = true;
      tutoPut(0, [[35, 18.5], [50, 18.5], [27, 6], [27, 31], [22, 18.5]]);
      tutoFarDefense();
      tutoPut(1, [[42.5, 18.5]], true);
      tutoGive(TEAMS[0][0]);
    },
    pin(p) {
      if (p.team === 1) return p.i === 0 ? [42.5, 18.5] : tutoFar(p);
      if (p === disc.holder) return null;
      return [[35, 18.5], [50, 18.5], [27, 6], [27, 31], [22, 18.5]][p.i];
    },
    on(ev, p) {
      if (ev === 'catch' && p.team === 0) tutoSuccess(Math.abs(disc.curveV) >= 0.2 ? 'Superbe courbe !' : 'Passé !');
      if (ev === 'turnover') tutoFail('Bloqué ! Ajoute plus de courbe.');
    }
  },
  {
    title: 'Le pied de pivot',
    coach: 'La mark te colle ? Change de pied. Elle suivra… avec un temps de retard. Hé hé.', par: 16,
    ctx: 'throw',
    text: {
      mouse: () => `Ta mark ferme le côté de ton coéquipier (sa zone rouge). <b>${keysOf('pivot').map(keyName).join(' / ')}</b> change de pied : le disque passe de l’autre côté de la mark. Pivote, attends que le disque soit passé de l’autre côté, puis lance.`,
      touch: 'Ta mark ferme le côté de ton coéquipier (sa zone rouge). <b>Tape ton joueur</b> pour changer de pied : le disque passe de l’autre côté de la mark. Pivote, attends que le disque soit passé de l’autre côté, puis lance.',
      joy: 'Ta mark ferme le côté de ton coéquipier (sa zone rouge). Un appui sur <b>Pivot</b> (bord droit) change de pied : le disque passe de l’autre côté de la mark. Pivote, attends que le disque soit passé de l’autre côté, puis lance.',
      pad: 'Ta mark ferme le côté de ton coéquipier (sa zone rouge). Un appui sur <b>Y</b> change de pied : le disque passe de l’autre côté de la mark. Pivote, attends que le disque soit passé de l’autre côté, puis lance avec A.'
    },
    setup() {
      tutoReset(); G.tuto.mark = true; G.tuto.level = 'facile'; G.tuto.piv = -1;
      Object.assign(G.ai, { off: 'vert', def: 'man', force: 'haut', play: 'none', dplay: 'none' });   // force haut : la mark ferme le bas
      tutoPut(0, TUTO_PIV);
      tutoFarDefense();
      tutoGive(TEAMS[0][0]);
      const m = TEAMS[1][0]; m.match = TEAMS[0][0]; [m.x, m.y] = markSpot(1, TEAMS[0][0].x, TEAMS[0][0].y); m.tx = m.x; m.ty = m.y;
    },
    frame() { const h = disc.holder; if (disc.mode === 'held' && h && h.team === 0) G.tuto.piv = h.pivY || 0; },
    pin(p) {
      if (p.team === 1) return p.i === 0 ? null : tutoFar(p);   // la mark joue vraiment : elle suit ton pivot
      if (p === disc.holder) return null;
      return TUTO_PIV[p.i];
    },
    on(ev, p) {
      if (ev === 'catch' && p.team === 0) { if (G.tuto.piv > 0.3) tutoSuccess('Bien pivoté !'); else tutoFail('Passé, mais change de pied pour contourner la mark !'); }
      if (ev === 'turnover') tutoFail(G.tuto.piv > 0.3 ? 'Contré : attends que le disque soit passé de l’autre côté avant de lancer !' : 'Contré par la mark ! Change d’abord de pied.');
    }
  },
  {
    title: 'La hauteur de passe',
    coach: 'Un mur de défenseurs ? On passe par-dessus. Plus c’est haut, plus c’est beau… et plus ça part de travers.', par: 16,
    ctx: 'throw',
    text: {
      mouse: () => `Un mur bloque le passage. Monte ta passe tout en haut (<b>${tutoCmd('loftUp')}</b>, jauge à côté de ton joueur), puis lance par-dessus. Plus elle est haute, plus elle vole longtemps et part de travers.`,
      touch: 'Un mur bloque le passage. Pendant la visée, glisse un <b>2<sup>e</sup> doigt vers ton joueur</b> pour monter la passe tout en haut (jauge à côté de lui), puis lance par-dessus.',
      joy: 'Un mur bloque le passage. Monte le <b>curseur de hauteur</b> (bord droit) tout en haut, puis lance par-dessus.',
      pad: 'Un mur bloque le passage. <b>Croix ↑</b> pour monter la passe tout en haut, puis lance par-dessus avec A.'
    },
    setup() {
      tutoReset(); G.tuto.wall = true;
      tutoPut(0, [[35, 18.5], [52, 18.5], [27, 6], [27, 31], [22, 18.5]]);
      tutoPut(1, TUTO_WALL, true);
      tutoGive(TEAMS[0][0]);
    },
    pin(p) {
      if (p.team === 1) return TUTO_WALL[p.i];
      if (p === disc.holder) return null;
      return [[35, 18.5], [52, 18.5], [27, 6], [27, 31], [22, 18.5]][p.i];
    },
    on(ev, p) {
      if (ev === 'catch' && p.team === 0) { if (disc.kind === 'high') tutoSuccess('Passe haute réussie !'); else tutoFail('Passé, mais essaie la passe haute !'); }
      if (ev === 'turnover') tutoFail(disc.kind === 'high' ? (disc.loft < 0.95 ? 'Bloqué : monte-la encore plus haut !' : 'Raté, réessaie !') : `Bloqué ! Monte la passe tout en haut (${tutoCmd('loftUp')}).`);
    }
  },
  {
    title: 'Lire le cône',
    coach: 'Une passe en l’air, c’est une promesse floue. Le cône te dit où elle peut tomber… à toi de deviner où elle tombe vraiment.', par: 10,
    ctx: 'move',
    text: {
      mouse: 'Une passe va partir (compte à rebours). Elle tombera <b>quelque part dans le cercle</b>, qui rétrécit pendant le vol : cours-y et <b>touche le disque</b> avant qu’il tombe.',
      touch: () => (CTRL.move === 'joystick' ? 'Avec le joystick, cours' : 'Tape le terrain pour courir') + ' vers le <b>cercle d’arrivée</b> : la passe tombera quelque part dedans (il rétrécit pendant le vol). <b>Touche le disque</b> avant qu’il tombe.',
      joy: 'Une passe va partir. Elle tombera <b>quelque part dans le cercle</b>, qui rétrécit pendant le vol : cours-y avec le joystick et <b>touche le disque</b> avant qu’il tombe.',
      pad: 'Une passe va partir. Elle tombera <b>quelque part dans le cercle</b>, qui rétrécit pendant le vol : cours-y avec le stick et <b>touche le disque</b> avant qu’il tombe.'
    },
    setup() {
      tutoReset(); G.tuto.sure = true;
      Object.assign(G.form, { def: 'man', force: 'straight', dplay: 'none', play: 'none' });
      G.tuto.target = TUTO_CONE[Math.floor(Math.random() * TUTO_CONE.length)];
      tutoPut(1, [[72, 18.5], [64, 18.5], [88, 5], [88, 32], [84, 18.5]]);
      tutoPut(0, [[49, 18.5], [95, 4], [95, 11], [95, 26], [95, 33]]);
      tutoGive(TEAMS[1][0]);
      const h = meH(); if (h) h.sel = TEAMS[0][0];
      G.tuto.armT = 2;
    },
    frame() {
      const T = G.tuto;
      if (T.done || T.thrown) return;
      const n = Math.ceil(T.armT - (T.holdT || 0)); if (n > 0 && n !== T.cd) { T.cd = n; flash('Passe dans ' + n + '…', true); }
    },
    pin(p) { return p === disc.holder && disc.mode === 'held' ? null : [[72, 18.5], [64, 18.5], [88, 5], [88, 32], [84, 18.5]][p.i]; },
    pinD(d) { return d === (meH() || {}).sel ? null : tutoFar(d); },
    hold(h, dt) {
      const T = G.tuto;
      if (T.thrown || T.done) return true;
      T.holdT = (T.holdT || 0) + dt;
      if (T.holdT >= T.armT) { T.thrown = true; throwDisc(h, T.target[0], T.target[1], 0, 1.4, 0.6); }
      return true;
    },
    on(ev, p) {
      // réussi : il a touché le disque, ou il était sous le disque à l'arrivée (il l'aurait attrapé)
      const me = TEAMS[0][0];                                 // (après une interception, on n'a plus de joueur « sélectionné »)
      if (ev === 'turnover') { if (me && (G.tuto.stopBy === me || dist(me.x, me.y, disc.x, disc.y) < 2.2)) tutoSuccess('Bien lu ! 🎯'); else tutoFail('Il est tombé… fonce vers le cercle dès le lancer !'); }
      if (ev === 'catch' && p.team === 1) tutoFail('Attrapé par l’adversaire : va chercher le disque !');
    }
  },
  {
    title: 'Appeler un cut',
    coach: 'Tes coéquipiers sont collés comme des chewing-gums. Les IA ne voient pas tout : montre-leur un espace libre.', par: 16,
    text: {
      mouse: 'Tes coéquipiers sont marqués. <b>Clic droit</b> sur un espace libre : l’un d’eux y court. Lance-lui.',
      touch: 'Tes coéquipiers sont marqués. <b>Tape un espace libre</b> : l’un d’eux y court. Lance-lui.',
      pad: 'Tes coéquipiers sont marqués. Mets le curseur sur un espace libre et appuie sur <b>X</b>, puis lance-lui.'
    },
    setup() {
      tutoReset(); G.tuto.wall = true;
      tutoPut(0, [[35, 18.5]].concat(TUTO_STACK));
      tutoPut(1, TUTO_STACK.map(([x, y]) => [x + 0.6, y + 1]).concat([[95, 33]]), true);
      tutoGive(TEAMS[0][0]);
    },
    pin(p) {
      if (p.team === 0) {
        if (p === TEAMS[0][0] || (p.called && G.time - p.called < 6)) return null;   // appelé : il fait son cut
        return TUTO_STACK[p.i - 1];
      }
      return null;
    },
    pinD(d) {                                                  // chaque défenseur colle « son » attaquant, sauf celui qui coupe
      if (d.i >= 4) return [95, 33];
      const a = TEAMS[0].filter(q => q !== TEAMS[0][0])[d.i];
      if (!a || (a.called && G.time - a.called < 6)) return TUTO_STACK[d.i].map((v, j) => v + (j ? 1 : 0.6));
      return [a.x + 0.6, a.y + 1];
    },
    on(ev, p) {
      if (ev === 'catch' && p.team === 0) { if (p.called && G.time - p.called < 8) tutoSuccess('Parfait, c’est ça le jeu !'); else tutoFail('Passé, mais appelle un cut avant de lancer !'); }
      if (ev === 'turnover') tutoFail(G.tuto.called ? 'Bloqué ! Attends qu’il soit démarqué.' : 'Bloqué ! Appelle d’abord un cut dans l’espace libre.');
    }
  },
  {
    title: 'Appeler un play',
    coach: 'Un play, c’est une chorégraphie : toi tu appelles, eux ils dansent.', par: 16,
    plays: true,                                               // les plays sont permis à cette étape
    text: {
      mouse: () => `Tu as choisi un <b>Play 1 : Huck</b>. Appelle-le : touche <b>${tutoCmd('play1')}</b> ou bouton <b>▶ Huck</b> en haut du terrain. Le cutter ★ part en deep : lance long, devant lui.`,
      touch: 'Tu as choisi un <b>Play 1 : Huck</b>. Touche le bouton <b>▶ Huck</b> en haut du terrain : le cutter ★ part en deep. Lance long, devant lui.',
      pad: 'Tu as choisi un <b>Play 1 : Huck</b>. Appuie sur la croix <b>←</b> : le cutter ★ part en deep. Lance long, devant lui.'
    },
    setup() {
      tutoReset(); G.tuto.wall = true;
      G.form.play1 = 'huck';
      tutoPut(0, [[30, 18.5]].concat(TUTO_STACK));
      tutoPut(1, TUTO_STACK.map(([x, y]) => [x + 0.6, y + 1]).concat([[95, 33]]), true);
      tutoGive(TEAMS[0][0]);
    },
    pin(p) {
      if (p.team === 0) {
        if (p === TEAMS[0][0] || (G.oplay && G.oplay.targets.includes(p))) return null;   // le coupeur du play part
        return TUTO_STACK[p.i - 1];
      }
      return null;
    },
    pinD(d) {                                                  // les défenseurs collent leur attaquant ; celui du huck réagit en retard
      if (d.i >= 4) return [95, 33];
      const a = TEAMS[0].filter(q => q !== TEAMS[0][0])[d.i];
      if (!a) return TUTO_STACK[d.i];
      if (G.oplay && G.oplay.targets.includes(a)) return G.oplay.t < 1.2 ? [a.x - 3, a.y + 1] : null;
      return [a.x + 0.6, a.y + 1];
    },
    on(ev, p) {
      if (ev === 'catch' && p.team === 0) { if (G.tuto.played) tutoSuccess('Bien joué : un play bien appelé, et c’est une passe facile !'); else tutoFail('Passé, mais appelle d’abord ton play !'); }
      if (ev === 'turnover') tutoFail(G.tuto.played ? 'Raté ! Lance un peu plus devant le cutter ★.' : `Bloqué ! Appelle d’abord ton play (${tutoCmd('play1')} ou ▶).`);
    }
  },
  {
    title: 'Duel en l’air',
    noAutoJump: true,                                          // c'est toi qui fais sauter ton receveur
    coach: 'Le disque est à celui qui saute le plus haut. Ou au bon moment. Idéalement les deux.', par: 12,
    ctx: 'move',
    text: {
      mouse: () => `Ton receveur est collé. Lance-lui, puis <b>${tutoCmd('jump')}</b> (ou clic droit) pendant le vol : il saute et gagne le duel.`,
      touch: 'Ton receveur est collé. Lance-lui, puis <b>tape ton receveur</b> pendant le vol : il saute et gagne le duel.',
      joy: 'Ton receveur est collé. Lance-lui, puis touche <b>Saut</b> pendant le vol : il gagne le duel.',
      pad: 'Ton receveur est collé. Lance-lui, puis <b>A</b> pendant le vol : il saute et gagne le duel.'
    },
    setup() {
      tutoReset(); G.tuto.wall = true;
      tutoPut(0, [[38, 18.5], [52, 18.5], [30, 6], [30, 31], [26, 18.5]]);
      tutoPut(1, [[95, 4], [51.2, 19.1]], true);
      tutoGive(TEAMS[0][0]);
    },
    pin(p) {
      if (p.team === 1) return p.i === 1 ? [51.2, 19.1] : tutoFar(p);
      if (p === disc.holder) return null;
      return [[38, 18.5], [52, 18.5], [30, 6], [30, 31], [26, 18.5]][p.i];
    },
    on(ev, p) {
      if (ev === 'catch' && p.team === 0) { if (p.jump > 0) tutoSuccess('Duel gagné ! 🙌'); else tutoFail('Attrapé, mais saute pour gagner le duel !'); }
      if (ev === 'turnover') tutoFail(disc.thrower && disc.intended && disc.intended.jump > 0 ? 'Duel perdu… saute un peu plus tôt !' : `Contré : fais sauter ton receveur (${tutoCmd('jump', 'tape ton receveur')}) !`);
    }
  },
  {
    title: 'Changer de joueur',
    coach: 'Ton défenseur fait du tourisme à l’autre bout du terrain. Prends-en un plus utile.', par: 8,
    ctx: 'move',
    text: {
      mouse: () => `Ton défenseur (anneau jaune) est loin du disque. <b>${tutoCmd('switch')}</b> prend le plus proche (entouré en gris), ou clique sur un joueur.`,
      touch: 'Ton défenseur (anneau jaune) est loin du disque. <b>Tape le défenseur</b> le plus proche pour le prendre.',
      joy: 'Ton défenseur (anneau jaune) est loin du disque. Touche <b>Switch</b> pour prendre le plus proche.',
      pad: 'Ton défenseur (anneau jaune) est loin du disque. <b>X</b> prend le plus proche (entouré en gris).'
    },
    setup() {
      tutoReset();
      tutoPut(1, [[62, 18.5], [54, 10], [54, 27], [70, 6], [70, 31]]);
      tutoPut(0, [[56, 18.5], [50, 10], [50, 27], [40, 4], [40, 33]]);
      tutoGive(TEAMS[1][0]);
      const h = meH(); if (h) h.sel = TEAMS[0][3];               // ton joueur est loin du disque
    },
    pin(p) { return [[62, 18.5], [54, 10], [54, 27], [70, 6], [70, 31]][p.i]; },
    pinD(d) { return [[56, 18.5], [50, 10], [50, 27], [40, 4], [40, 33]][d.i]; },
    hold() { return true; },                                   // le porteur garde le disque
    on(ev) { if (ev === 'switch') tutoSuccess('Bien vu, tu as pris le bon joueur !'); }
  },
  {
    title: 'Plonger en défense',
    coach: 'Le layout : la plus belle façon de finir couvert d’herbe. Au signal, tu plonges !', par: 10,
    ctx: 'move',
    text: {
      mouse: () => `Une passe va passer à côté de toi (compte à rebours en bas). Dès que <b>PLONGE !</b> s'affiche, <b>clique sur sa trajectoire</b> (ou ${tutoCmd('dive')}).`,
      touch: 'Une passe va passer à côté de toi (compte à rebours en bas). Dès que <b>PLONGE !</b> s\'affiche, <b>glisse vite vers sa trajectoire</b>.',
      joy: 'Une passe va passer à côté de toi (compte à rebours en bas). Dès que <b>PLONGE !</b> s\'affiche, oriente le joystick vers elle et touche <b>Layout</b>.',
      pad: 'Une passe va passer à côté de toi (compte à rebours en bas). Dès que <b>PLONGE !</b> s\'affiche, stick vers elle et <b>B</b>.'
    },
    still: true,
    setup() {
      tutoReset();
      Object.assign(G.form, { def: 'man', force: 'straight', dplay: 'none', play: 'none' });
      tutoPut(1, [[64, 18.5], [48, 18.5], [80, 5], [80, 32], [76, 18.5]]);
      tutoPut(0, [[50.5, 20.5], [95, 4], [95, 11], [95, 26], [95, 33]]);
      tutoGive(TEAMS[1][0]);
      const h = meH(); if (h) h.sel = TEAMS[0][0];
      G.tuto.armT = 3;                                           // toujours 3 s : compte à rebours, puis signal « PLONGE ! »
    },
    frame() {                                                    // compte à rebours avant la passe, puis le bon moment pour plonger
      const T = G.tuto, me = TEAMS[0][0];
      if (T.done) return;
      if (!T.thrown) { const n = Math.ceil(T.armT - (T.holdT || 0)); if (n > 0 && n !== T.cd) { T.cd = n; flash('Passe dans ' + n + '…', true); } return; }
      if (T.cued || disc.mode !== 'air') return;
      const u0 = disc.t / disc.dur;                             // point de la trajectoire le plus proche de toi, à portée d'un plongeon
      let bu = -1, bd = 2.8;
      for (let u = u0; u <= 1; u += 0.01) {
        const [x, y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u), d = dist(x, y, me.x, me.y);
        if (d < bd && discZ(u) < REACH_DIVE) { bd = d; bu = u; }
      }
      if (bu >= 0 && (bu - u0) * disc.dur <= DIVE_T + 0.03) { T.cued = true; flash('PLONGE ! 🥏', true); }   // le disque y arrive à la fin du plongeon
    },
    pin(p) { return p === disc.holder && disc.mode === 'held' ? null : [[64, 18.5], [48, 18.5], [80, 5], [80, 32], [76, 18.5]][p.i]; },
    pinD(d) { return d.i === 0 ? [50.5, 20.5] : tutoFar(d); },
    hold(h, dt) {
      const T = G.tuto;
      if (T.thrown || T.done) return true;
      T.holdT = (T.holdT || 0) + dt;
      if (T.holdT >= T.armT) { T.thrown = true; throwDisc(h, 48, 18.5, 0, 0.05); }
      return true;
    },
    on(ev, p) {
      if (ev === 'turnover' && G.off === 0) tutoSuccess(G.tuto.lblock ? 'Layout block ! 💪' : 'Contré !');
      if (ev === 'catch' && p.team === 1) tutoFail(TEAMS[0][0].down > 0 || TEAMS[0][0].dive > 0 ? 'Pas loin ! Plonge un peu plus tôt, vers la trajectoire.' : 'Plonge juste avant que le disque passe !');
    }
  },
  {
    title: 'Blocker une passe haute',
    coach: 'Le thrower lève le disque : il prépare une passe haute. Devine quand il lâche… et saute !', par: 10,
    ctx: 'move',
    text: {
      mouse: () => `Le thrower a armé une passe haute (compte à rebours en bas). Dès que <b>SAUTE !</b> s'affiche, saute (${tutoCmd('jump')} ou clic droit) : tu blockes au lâcher.`,
      touch: 'Le thrower a armé une passe haute (compte à rebours en bas). Dès que <b>SAUTE !</b> s\'affiche, <b>tape ton joueur</b> pour sauter : tu blockes au lâcher.',
      joy: 'Le thrower a armé une passe haute (compte à rebours en bas). Dès que <b>SAUTE !</b> s\'affiche, touche <b>Saut</b> : tu blockes au lâcher.',
      pad: 'Le thrower a armé une passe haute (compte à rebours en bas). Dès que <b>SAUTE !</b> s\'affiche, <b>A</b> pour sauter : tu blockes au lâcher.'
    },
    setup() {
      tutoReset(); G.tuto.level = 'facile';
      Object.assign(G.form, { def: 'man', force: 'straight', dplay: 'none', play: 'none' });
      Object.assign(G.ai, { off: 'vert', def: 'man', force: 'haut', play: 'none', dplay: 'none' });
      tutoPut(1, [[60, 18.5], [45, 18.5]], true);
      tutoPut(0, [[58.6, 18.5], [6, 4], [6, 12], [6, 25], [6, 33]]);
      tutoGive(TEAMS[1][0]);
      G.tuto.armT = 3;                                           // toujours 3 s : compte à rebours, puis signal « SAUTE ! »
    },
    frame() {
      const T = G.tuto, h = disc.holder, w = h && disc.mode === 'held' && h.windup;
      if (T.done || !w) return;
      const n = Math.ceil(w.t);
      if (w.t > JUMP_CUE && n !== T.cd) { T.cd = n; flash('Il lance dans ' + n + '…', true); }
      if (w.t <= JUMP_CUE && !T.cued) { T.cued = true; flash('SAUTE ! 🙌', true); }
    },
    pin(p) {                                                 // les deux équipes : le porteur et ton défenseur libres, le receveur à 45 m
      if (p.team === 1) return p.i === 0 ? null : p.i === 1 ? [45, 18.5] : tutoFar(p);
      return p.i === 0 ? null : [6, [4, 12, 25, 33][p.i - 1]];
    },
    hold(h, dt) {                                            // le porteur arme puis lance au bout de 3 s
      const T = G.tuto;
      if (T.done) return true;
      if (!h.windup) h.windup = { t: T.armT };
      h.windup.t -= dt;
      if (h.windup.t <= 0) { h.windup = null; throwDisc(h, 45, 18.5, 0, 0.3, 'high'); }
      return true;
    },
    on(ev, p) {
      if (ev === 'turnover' && G.off === 0) { if (G.tuto.blocked) tutoSuccess('Contré au lâcher ! 💪'); else tutoFail('Passe ratée par le thrower : on recommence.'); }
      if (ev === 'catch' && p.team === 1) tutoFail(G.tuto.jumped ? 'Mauvais moment… recommence !' : `Il est passé : saute (${tutoCmd('jump')}) au bon moment !`);
    }
  },
  {
    title: 'Le pull',
    coach: 'Le pull, c’est l’engagement : long, haut, dans le vert. Et on ne vise pas la buvette.', par: 16,
    text: {
      mouse: 'Clique sur la zone visée, puis arrête la jauge dans le <b>vert</b> (clic ou Espace).',
      touch: () => (CTRL.sling ? 'Tire en arrière pour viser' : 'Glisse vers la zone visée') + ', relâche, puis <b>tape</b> pour arrêter la jauge dans le vert.',
      joy: 'Glisse vers la zone visée, relâche, puis <b>tape</b> pour arrêter la jauge dans le vert.',
      pad: 'Vise avec le stick, <b>A</b>, puis A pour arrêter la jauge dans le vert.'
    },
    setup() {
      tutoReset();
      G.receiving = 1;
      startPull();
    },
    on(ev, q) {
      if (ev === 'pull') tutoSuccess(q >= PULL.PERFECT[0] && q <= PULL.PERFECT[1] ? 'Pull parfait ! 🥏' : 'Pull lancé !', 2.6);
    }
  }
];
// deux parcours : débutant (de quoi jouer un premier match) puis avancé ; les étapes sont rangées dans cet ordre
const TUTO_COURSES = {
  base: { name: 'Débutant', steps: ['Se déplacer', 'Lancer', 'La courbe', 'Lire le cône', 'Appeler un cut', 'Changer de joueur', 'Plonger en défense'] },
  adv: { name: 'Avancé', steps: ['Le pied de pivot', 'La hauteur de passe', 'Appeler un play', 'Duel en l’air', 'Blocker une passe haute', 'Le pull'] }
};
{ const order = TUTO_COURSES.base.steps.concat(TUTO_COURSES.adv.steps); TUTO_STEPS.sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title)); }
const TUTO_BASE_N = TUTO_COURSES.base.steps.length;
const tutoCourseOf = k => (k >= TUTO_BASE_N ? 'adv' : 'base');
const tutoRange = c => (c === 'adv' ? [TUTO_BASE_N, TUTO_STEPS.length] : [0, TUTO_BASE_N]);
const TUTO_WALL = [[43.5, 18.5], [43.5, 16.3], [43.5, 20.7], [43.5, 14.1], [43.5, 22.9]];
const TUTO_STACK = [[46, 18.5], [50, 18.5], [54, 18.5], [58, 18.5]];
const TUTO_CONE = [[42, 11.5], [42, 25.5], [39, 18.5]];               // lire le cône : arrivées possibles de la passe

// ---------- outils des étapes ----------
function tutoReset() {
  players.forEach(p => Object.assign(p, { vx: 0, vy: 0, dive: 0, down: 0, jump: 0, jprep: 0, jrec: 0, jumpCd: 0, jumpAt: 0, windup: null, react: 0, tag: '', inT: 0, state: 'stack', role: 'cutter',
    match: null, diveTried: false, called: 0, freeAcc: 0, free: false }));
  Object.assign(G, { oplay: null, dplay: null, pendingOPlay: null, pullPending: false, carryTo: null, stall: 0, marker: null, dbl: null,
    pickup: null, loft: LOFT.N, score: [0, 0], celebrate: null, scorer: null, phase: 'play', pull: null });
  Object.assign(G.tuto, { spots: null, mark: false, piv: 0, wall: false, level: null, count: 0, called: false, played: false, jumped: false, blocked: false, lblock: false, thrown: false, holdT: 0, cd: 0, cued: false, sure: false, stopBy: null, target: null });
  G.wind = { x: 0, y: 0, kmh: 0 };                             // pas de vent pendant le tutoriel
  setCurve(0);
  disc.pull = false; disc.kind = 'normal'; disc.loft = LOFT.N;
  $('overlay').classList.add('hidden'); G.menuShown = false;
}
function tutoPut(t, spots, all) {
  TEAMS[t].forEach((p, k) => { const s = spots[k]; if (s) { p.x = p.tx = s[0]; p.y = p.ty = s[1]; } else if (all) { p.x = p.tx = 95; p.y = p.ty = 4 + k * 7; } });
}
const TUTO_SPOTS = [[52, 11], [30, 28], [56, 26]], TUTO_SPOT_R = 1.6;   // se déplacer : les cercles à atteindre
const TUTO_PIV = [[35, 18.5], [37, 28], [24, 6], [22, 18.5], [24, 31]];   // pied de pivot : le receveur est côté fermé
const tutoFar = p => [95, 4 + p.i * 7];
function tutoFarDefense() { tutoPut(1, TEAMS[1].map(tutoFar)); }
function tutoGive(p) {
  G.off = p.team;
  holdDisc(p);
  if (TUTO_STEPS[G.tuto.step].pin) TEAMS[p.team].forEach(q => { if (q !== p) q.state = 'stack'; });   // joueurs placés : pas de course affichée
  setupDefense(1 - p.team, p);
  updateSelected();
}
// joueur figé par l'étape en cours (appelé par sim.js)
function tutoPin(p) {
  const T = G.tuto, S = T && TUTO_STEPS[T.step];
  if (!S) return false;
  const at = p.team !== G.off && S.pinD ? S.pinD(p) : S.pin ? S.pin(p) : null;   // pinD : l'équipe qui défend (toi ou l'IA), pin : l'autre
  if (!at) return false;
  p.tx = clamp(at[0], 0.5, W - 0.5); p.ty = clamp(at[1], 0.5, H - 0.5); p.sp = SPD.cut;
  return true;
}

// ---------- déroulé ----------
function tutoStart(course) {
  if (typeof course !== 'string') course = 'base';
  backToSolo();
  G.series = null; G.ms = null;
  G.tuto = { course, step: 0, t: 0, wait: 0, after: null, saved: { def: G.form.def, force: G.form.force, play: G.form.play, play1: G.form.play1, dplay: G.form.dplay }, inp: '', stars: {}, tries: 0, last: -1 };
  $('lobbyCard').style.display = 'none';
  $('tutoBox').style.display = '';
  tutoGo(tutoRange(course)[0]);
}
function tutoGo(k, retry) {
  const T = G.tuto; if (!T) return;
  T.tries = retry && T.last === k ? T.tries + 1 : 0; T.last = k;  // nouvel essai de la même étape (après un raté), ou nouvelle étape
  T.step = k; T.t = 0; T.wait = 0; T.after = null; T.done = false; T.finished = false;
  if (k >= TUTO_STEPS.length) { tutoFinish(); return; }
  T.course = tutoCourseOf(k);
  TUTO_STEPS[k].setup();
  tutoText(true);
  tutoIntro(retry);
}
// carte du coach avant l'étape (le jeu attend) : le résultat de l'étape d'avant, sa phrase, puis « C'est parti »
function tutoIntro(retry) {
  const T = G.tuto, S = TUTO_STEPS[T.step], [a, b] = tutoRange(T.course);
  T.intro = true; G.paused = true;
  $('ccRes').innerHTML = T.res ? `<b>${starStr(T.res.n)}</b> « ${T.res.line} »` : '';
  $('ccLine').textContent = retry ? (T.failMsg ? T.failMsg + ' ' : '') + pickLine(COACH.fail) : S.coach;
  $('ccStep').textContent = `${TUTO_COURSES[T.course].name} · étape ${T.step - a + 1} / ${b - a} · ${S.title}`;
  $('ccGo').textContent = retry ? 'On réessaie ▶' : 'C’est parti ▶';
  $('coachCard').style.display = '';
  T.res = null; T.failMsg = '';
}
function tutoPlayStep() {
  const T = G.tuto; if (!T || !T.intro) return;
  T.intro = false; T.t = 0; G.paused = false;
  $('coachCard').style.display = 'none';
}
const coachOpen = () => !!(G.tuto && G.tuto.intro);
// texte adapté à la façon de jouer : manette, souris, ou téléphone (gestes ou boutons selon les réglages de l'étape)
function tutoInput(S) {
  if (G.gpActive) return 'pad';
  if (!isTouchUI()) return 'mouse';
  const btn = S && (S.ctx === 'throw' ? CTRL.throwUI === 'boutons' : S.ctx === 'move' ? CTRL.move === 'joystick' : false);
  return btn ? 'joy' : 'touch';
}
// commande à utiliser, telle que réglée par le joueur (touches choisies, gestes ou boutons, manette)
function tutoCmd(a, touchAlt) {
  const inp = tutoInput(G.tuto && TUTO_STEPS[G.tuto.step]);
  if (inp === 'mouse') return keysOf(a).map(keyName).join(' / ') + (a === 'loftUp' ? ' ou molette' : '');
  if (a === 'play1') return inp === 'pad' ? 'croix ←' : 'bouton ▶';
  if (inp === 'pad') return { pivot: 'Y', loftUp: 'croix ↑', jump: 'A', dive: 'B', switch: 'X', curveL: 'LB', curveR: 'RB' }[a];
  if (inp === 'joy') return { pivot: 'bouton Pivot', loftUp: 'curseur de hauteur', jump: 'bouton Saut', dive: 'bouton Layout', switch: 'bouton Switch', curveL: 'curseur', curveR: 'curseur' }[a];
  return touchAlt || { pivot: 'tape ton joueur', loftUp: '2e doigt vers ton joueur', jump: 'tape ton joueur', dive: 'glisse vite', switch: 'tape un coéquipier', curveL: '2e doigt', curveR: '2e doigt' }[a];
}
function tutoText(force) {
  const T = G.tuto, S = TUTO_STEPS[T.step], inp = tutoInput(S), sig = inp + JSON.stringify(CTRL);
  if (!S || (!force && sig === T.inp)) return;               // on réaffiche si la façon de jouer ou les réglages changent
  T.inp = sig;
  $('tutoTitle').textContent = S.title;
  const [a, b] = tutoRange(T.course);
  $('tutoStep').textContent = `${TUTO_COURSES[T.course].name} · étape ${T.step - a + 1} / ${b - a}`;
  const tx = S.text[inp] || S.text.touch;
  $('tutoText').innerHTML = '<div class="tins">' + (typeof tx === 'function' ? tx() : tx) + '</div>';
  $('tutoSkip').style.display = ''; $('tutoSkip').textContent = 'Passer l’étape ▸'; $('tutoMatch').style.display = 'none';
  $('tutoQuit').textContent = 'Quitter ✕';
  resize();
}
function tutoEvent(ev, a) {
  const T = G.tuto; if (!T || T.done) return;
  const S = TUTO_STEPS[T.step];
  if (S && S.on) S.on(ev, a);
  if (!T.done && (ev === 'turnover' || ev === 'score')) tutoFail('Raté ! On recommence.');   // toute perte non prévue relance l'étape
}
// bulle du coach (bilan de fin de parcours)
const coachHtml = line => line ? `<div class="coach"><span class="cface">${COACH.face}</span><span><b>${COACH.name}</b> « ${line} »</span></div>` : '';
const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
function tutoSuccess(msg, delay) {
  const T = G.tuto; T.done = true;
  const S = TUTO_STEPS[T.step], n = 1 + (T.tries === 0 ? 1 : 0) + (T.tries === 0 && T.t <= ((S && S.par) || 15) ? 1 : 0);
  if (S) T.stars[S.title] = Math.max(T.stars[S.title] || 0, n);
  flash(msg + '  ' + starStr(n), true);
  T.res = { n, line: pickLine(COACH.win) };                   // affiché en haut de la carte de l'étape suivante
  try { SOUNDS.score(); } catch (e) { }
  T.wait = Math.max(delay || 0, 2.2); T.after = tutoNext;
}
function tutoFail(msg) {
  const T = G.tuto; T.done = true;
  flash(msg, true); T.failMsg = msg;
  T.wait = 1.7; T.after = () => tutoGo(T.step, true);
}
function tutoFrame(dt) {
  const T = G.tuto;
  if (T.intro) return;                                        // carte du coach ouverte : le jeu attend
  T.t += dt;
  tutoText(false);
  const S = TUTO_STEPS[T.step]; if (S && S.frame && !T.done) S.frame(dt);
  if (T.wait > 0) { T.wait -= dt; if (T.wait <= 0 && T.after) { const f = T.after; T.after = null; f(); } }
}
// étape suivante du parcours, ou la fin du parcours
function tutoNext() { const T = G.tuto; if (!T) return; if (T.step + 1 >= tutoRange(T.course)[1]) tutoFinish(); else tutoGo(T.step + 1); }
function tutoFinish() {
  const T = G.tuto, adv = T.course === 'adv';
  T.intro = false; G.paused = false; $('coachCard').style.display = 'none';
  storeSet(adv ? 'uf-tuto2' : 'uf-tuto', true);
  achEvent(adv ? 'tuto2' : 'tuto');
  T.done = true; T.finished = true; T.step = TUTO_STEPS.length;   // plus d'étape en cours : jeu libre derrière le message
  // bilan : les étoiles de chaque défi, et le mot de la fin du coach
  const steps = TUTO_COURSES[T.course].steps, got = steps.reduce((n, t) => n + (T.stars[t] || 0), 0), max = steps.length * 3;
  const best = storeGet('uf-tuto-stars', {}) || {}; steps.forEach(t => { if ((T.stars[t] || 0) > (best[t] || 0)) best[t] = T.stars[t]; }); storeSet('uf-tuto-stars', best);
  const end = got >= max * 0.9 ? 'Je n’ai plus rien à t’apprendre. Enfin si, mais pas aujourd’hui.'
    : got >= max * 0.6 ? 'Pas mal du tout ! Encore quelques tours de terrain et tu me piques ma place.'
    : 'Tu es arrivé au bout, c’est l’essentiel. Le talent, ça vient en jouant !';
  $('tutoTitle').textContent = 'Bravo ! 🎉';
  $('tutoStep').textContent = `${TUTO_COURSES[T.course].name} terminé · ${got} / ${max} ★`;
  $('tutoText').innerHTML = coachHtml(end) + '<div class="tins tstars">' + steps.map(t => `<span>${t} <b>${starStr(T.stars[t] || 0)}</b></span>`).join('') + '</div>'
    + '<div class="tins">' + (adv
      ? 'Pied de pivot, hauteur de passe, plays, duels en l’air, block au lâcher, pull : tu as tout vu. Dans le menu d’avant-point, choisis ta formation, ta défense, tes consignes et deux plays à appeler en jeu. Allez, viens défier mon équipe !'
      : 'Tu sais te déplacer, lancer, courber, lire le cône, appeler un cut, changer de joueur et plonger : de quoi jouer ton premier match. L’avancé t’apprend ensuite à battre la mark, les plays, les duels en l’air et le pull.') + '</div>';
  $('tutoSkip').textContent = adv ? 'Défier l’équipe du coach ▶' : 'Continuer avec l’avancé ▶';
  $('tutoMatch').style.display = adv ? 'none' : '';
  $('tutoMatch').textContent = 'Défier l’équipe du coach ▶';
  $('tutoQuit').textContent = 'Menu';
  resize();
}
function tutoPlay() { tutoCleanup(); G.series = null; G.form.level = 'facile'; newMatch(); showMenu('first'); flash('🧢 L’équipe du coach t’attend (IA facile) !', true); }
function tutoCleanup() {
  const T = G.tuto; if (!T) return;
  Object.assign(G.form, T.saved);
  G.tuto = null; G.paused = false; $('coachCard').style.display = 'none';
  $('tutoBox').style.display = 'none'; resize();
  G.phase = 'menu'; G.receiving = 0; disc.pull = false;
  newWind(); placeForPoint();
}
function tutoQuit() { tutoCleanup(); showLobby(); }
if (typeof document !== 'undefined' && document.getElementById('tutoB')) {
  $('tutoB').addEventListener('click', () => showLobby('', 'tuto'));
  $('tutoBaseB').addEventListener('click', () => tutoStart('base'));
  $('tutoAdvB').addEventListener('click', () => tutoStart('adv'));
  $('tutoBack').addEventListener('click', () => showLobby());
  $('tutoQuit').addEventListener('click', tutoQuit);
  $('tutoMatch').addEventListener('click', tutoPlay);
  $('ccGo').addEventListener('click', e => { e.stopPropagation(); tutoPlayStep(); });
  $('coachCard').addEventListener('click', tutoPlayStep);
  $('tutoSkip').addEventListener('click', () => {
    const T = G.tuto; if (!T) return;
    if (T.finished) { if (T.course === 'base') tutoStart('adv'); else tutoPlay(); return; }
    tutoNext();
  });
}

// tutoriel « contrer une passe haute » : signal de saut à 0,4 s du lâcher (préparation du saut + montée jusqu'en haut)
const JUMP_CUE = 0.4;
// lanceur scénarisé par l'étape en cours (sinon l'IA normale)
function tutoHold(h, dt) {
  const S = G.tuto && TUTO_STEPS[G.tuto.step];
  return !!(S && S.hold && S.hold(h, dt));
}

// cercles de l'étape « Se déplacer » : le prochain en jaune, les suivants en pointillés
function drawTuto() {
  const sp = G.tuto && G.tuto.spots; if (!sp || !sp.length) return;
  ctx.save();
  sp.forEach(([x, y], k) => {
    const r = TUTO_SPOT_R * S * (k ? 1 : 1 + Math.sin(G.time * 5) * 0.06);
    ctx.lineWidth = 2.5; ctx.setLineDash(k ? [5, 5] : []);
    ctx.strokeStyle = k ? 'rgba(255,255,255,.45)' : '#facc15'; ctx.fillStyle = k ? 'rgba(255,255,255,.06)' : 'rgba(250,204,21,.22)';
    circle(X(x), Y(y), r); ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}
