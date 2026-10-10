// tuto.js — Tutoriel interactif : petites étapes guidées (toutes les commandes du jeu), chacune passable.
// Les étapes placent les joueurs, en « figent » certains (pin), et attendent un événement de jeu
// (réception, point, turnover, pull) pour valider.

const TUTO_STEPS = [
  {
    title: 'Lancer',
    text: {
      mouse: 'Tu as le disque (anneau blanc). Vise un coéquipier démarqué (anneau vert), maintiens le clic et relâche pour lancer. <b>Réussis 2 passes.</b>',
      touch: 'Tu as le disque (anneau blanc). Pose le doigt <b>n’importe où</b> sur l’écran et glisse vers un coéquipier démarqué (anneau vert) : plus tu glisses loin, plus tu lances loin. Relâche pour lancer. <b>Réussis 2 passes.</b>',
      pad: 'Tu as le disque (anneau blanc). Déplace le curseur de visée avec le stick gauche (doucement pour une passe courte) sur un coéquipier démarqué (anneau vert), puis A pour lancer. <b>Réussis 2 passes.</b>'
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
    text: {
      mouse: 'Un défenseur bloque la ligne droite vers ton coéquipier. Ajoute de la <b>courbe</b> avant de lancer : touches <b>A</b> / <b>E</b> ou la molette. L’aperçu montre la trajectoire : fais-la passer à côté du défenseur.',
      touch: 'Un défenseur bloque la ligne droite vers ton coéquipier. Ajoute de la <b>courbe</b> avec le curseur sur le <b>bord droit</b> de l’écran avant de lancer : l’aperçu montre la trajectoire, fais-la passer à côté du défenseur.',
      pad: 'Un défenseur bloque la ligne droite vers ton coéquipier. Ajoute de la <b>courbe</b> avec LB / RB avant de lancer : l’aperçu montre la trajectoire, fais-la passer à côté du défenseur.'
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
    title: 'La passe haute',
    text: {
      mouse: 'Cette fois, tout un mur bloque le passage. Appuie sur <b>Z</b> pour <b>armer</b> une passe haute (la défense voit ton disque levé), puis vise et lance quand tu veux : le disque passe par-dessus la défense. Attention, elle est imprécise avec la distance et le vent.',
      touch: 'Cette fois, tout un mur bloque le passage. Touche <b>Passe haute</b> (bord droit) pour l’<b>armer</b> (la défense voit ton disque levé), puis glisse pour lancer quand tu veux : le disque passe par-dessus la défense. Attention, elle est imprécise avec la distance et le vent.',
      pad: 'Cette fois, tout un mur bloque le passage. Appuie sur <b>Y</b> pour <b>armer</b> une passe haute, puis vise et lance avec A quand tu veux : le disque passe par-dessus la défense. Attention, elle est imprécise avec la distance et le vent.'
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
      if (ev === 'turnover') tutoFail(disc.kind === 'high' ? 'Raté, réessaie !' : 'Bloqué ! Choisis la passe haute (Z).');
    }
  },
  {
    title: 'Appeler un cut',
    text: {
      mouse: 'Tes coéquipiers sont tous marqués de près. Fais un <b>clic droit</b> dans un espace libre : le coéquipier le plus proche y coupe. Lance-lui le disque quand il est démarqué (anneau vert).',
      touch: 'Tes coéquipiers sont tous marqués de près. <b>Tape un espace libre</b> du terrain : le coéquipier le plus proche y coupe. Lance-lui le disque quand il est démarqué (anneau vert).',
      pad: 'Tes coéquipiers sont tous marqués de près. Place le curseur de visée dans un espace libre et appuie sur <b>X</b> : un coéquipier coupe vers cet endroit. Lance-lui le disque quand il est démarqué.'
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
    title: 'Layout en attaque',
    text: {
      mouse: 'Ton coéquipier (anneau vert) ne bouge pas. Lance <b>2 à 4 m à côté de lui</b>, puis pendant le vol <b>clic</b> (ou <b>F</b>) : il plonge en <b>layout</b> pour attraper le disque.',
      touch: 'Ton coéquipier (anneau vert) ne bouge pas. Lance <b>2 à 4 m à côté de lui</b>, puis pendant le vol touche <b>Layout</b> : il plonge pour attraper le disque.',
      pad: 'Ton coéquipier (anneau vert) ne bouge pas. Lance <b>2 à 4 m à côté de lui</b>, puis pendant le vol appuie sur <b>B</b> : il plonge en <b>layout</b> pour attraper le disque.'
    },
    still: true,                                               // le receveur reste immobile : c'est toi qui le fais plonger
    setup() {
      tutoReset(); G.tuto.wall = true;
      tutoPut(0, [[36, 18.5], [50, 18.5], [28, 5], [28, 32], [24, 18.5]]);
      tutoFarDefense();
      tutoGive(TEAMS[0][0]);
    },
    pin(p) {
      if (p.team === 1) return tutoFar(p);
      if (p === disc.holder && disc.mode === 'held') return null;
      return [[36, 18.5], [50, 18.5], [28, 5], [28, 32], [24, 18.5]][p.i];
    },
    on(ev, p) {
      if (ev === 'catch' && p.team === 0) { if (p.dive > 0 || p.down > 0) tutoSuccess('Superbe layout ! 🙌'); else tutoFail('Attrapé sans plonger : vise un peu plus loin de lui.'); }
      if (ev === 'turnover') tutoFail(TEAMS[0].some(q => q.down > 0 || q.dive > 0) ? 'Raté : plonge un peu plus tôt ou vise plus près.' : 'Plonge pendant le vol du disque !');
    }
  },
  {
    title: 'Duel en l’air',
    text: {
      mouse: 'Ton receveur est collé par un défenseur. Lance-lui le disque, puis appuie sur <b>S</b> pour que ton receveur saute : le plus haut au bon moment gagne le <b>duel</b>. Sans saut, le défenseur contre.',
      touch: 'Ton receveur est collé par un défenseur. Lance-lui le disque, puis touche <b>Saut</b> pour que ton receveur saute : le plus haut au bon moment gagne le <b>duel</b>. Sans saut, le défenseur contre.',
      pad: 'Ton receveur est collé par un défenseur. Lance-lui le disque, puis appuie sur <b>A</b> pendant le vol pour que ton receveur saute : le plus haut au bon moment gagne le <b>duel</b>.'
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
      if (ev === 'turnover') tutoFail(disc.thrower && disc.intended && disc.intended.jump > 0 ? 'Duel perdu… saute un peu plus tôt !' : 'Contré : fais sauter ton receveur (S) !');
    }
  },
  {
    title: 'Marquer',
    text: {
      mouse: 'Maintenant pour de vrai : la défense joue (niveau facile). Fais avancer le disque et fais-le attraper dans l’<b>en-but adverse</b> (la zone colorée à droite). Lance avant que le compte du marqueur arrive à 10 !',
      touch: 'Maintenant pour de vrai : la défense joue (niveau facile). Fais avancer le disque et fais-le attraper dans l’<b>en-but adverse</b> (la zone colorée à droite). Lance avant que le compte du marqueur arrive à 10 !',
      pad: 'Maintenant pour de vrai : la défense joue (niveau facile). Fais avancer le disque et fais-le attraper dans l’<b>en-but adverse</b> (à droite). Lance avant que le compte arrive à 10 !'
    },
    setup() {
      tutoReset(); G.tuto.level = 'facile';
      Object.assign(G.ai, { off: 'vert', def: 'man', force: 'haut', play: 'none', dplay: 'none' });
      tutoPut(0, [[60, 18.5], [56, 12], [66, 18], [71, 18], [76, 18]]);
      tutoPut(1, [[61, 17.2], [57, 13], [67, 19], [72, 19], [77, 19]]);
      tutoGive(TEAMS[0][0]);
    },
    on(ev, t) {
      if (ev === 'score') { if (t === 0) tutoSuccess('POINT ! 🎉'); else tutoFail('L’adversaire a marqué, on recommence.'); }
      if (ev === 'turnover' && G.off === 1) tutoFail('Turnover ! On recommence.');
    }
  },
  {
    title: 'Changer de joueur',
    text: {
      mouse: 'En défense, tu contrôles un seul joueur (anneau jaune), et il est loin du disque. <b>Espace</b> : tu prends le défenseur le plus proche du disque (entouré en gris). Tu peux aussi <b>cliquer sur un de tes joueurs</b> ou utiliser les touches <b>1 à 5</b>.',
      touch: 'En défense, tu contrôles un seul joueur (anneau jaune), et il est loin du disque. Touche <b>Switch</b> : tu prends le défenseur le plus proche du disque (entouré en gris). Tu peux aussi <b>taper un de tes joueurs</b>.',
      pad: 'En défense, tu contrôles un seul joueur (anneau jaune), et il est loin du disque. Appuie sur <b>X</b> : tu prends le défenseur le plus proche du disque (entouré en gris).'
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
    text: {
      mouse: 'L’adversaire va lancer à son coéquipier, juste à côté de toi. Ton défenseur ne bouge pas : <b>clique sur la trajectoire</b> (ou <b>F</b>) juste avant que le disque passe pour plonger en <b>layout</b> et le contrer.',
      touch: 'L’adversaire va lancer à son coéquipier, juste à côté de toi. Oriente le <b>joystick</b> vers la trajectoire et touche <b>Layout</b> juste avant que le disque passe pour le contrer.',
      pad: 'L’adversaire va lancer à son coéquipier, juste à côté de toi. Oriente le <b>stick</b> vers la trajectoire et appuie sur <b>B</b> juste avant que le disque passe pour le contrer.'
    },
    still: true,
    setup() {
      tutoReset();
      Object.assign(G.form, { def: 'man', force: 'straight', dplay: 'none', play: 'none' });
      tutoPut(1, [[64, 18.5], [48, 18.5], [80, 5], [80, 32], [76, 18.5]]);
      tutoPut(0, [[51, 21.2], [95, 4], [95, 11], [95, 26], [95, 33]]);
      tutoGive(TEAMS[1][0]);
      const h = meH(); if (h) h.sel = TEAMS[0][0];
      G.tuto.armT = rand(2.2, 3.2);
    },
    pin(p) { return p === disc.holder && disc.mode === 'held' ? null : [[64, 18.5], [48, 18.5], [80, 5], [80, 32], [76, 18.5]][p.i]; },
    pinD(d) { return d.i === 0 ? [51, 21.2] : tutoFar(d); },
    hold(h, dt) {
      const T = G.tuto;
      if (T.thrown || T.done) return true;
      T.holdT = (T.holdT || 0) + dt;
      if (T.holdT >= T.armT) { T.thrown = true; throwDisc(h, 48, 18.5, 0, 0.05); }
      return true;
    },
    on(ev, p) {
      if (ev === 'turnover' && G.off === 0) { if (G.tuto.lblock) tutoSuccess('Layout block ! 💪'); else tutoFail('Passe ratée par le lanceur : on recommence.'); }
      if (ev === 'catch' && p.team === 1) tutoFail(TEAMS[0][0].down > 0 || TEAMS[0][0].dive > 0 ? 'Pas loin ! Plonge un peu plus tôt, vers la trajectoire.' : 'Plonge juste avant que le disque passe !');
    }
  },
  {
    title: 'Défendre',
    text: {
      mouse: 'À toi de défendre. Ton joueur (anneau jaune) suit la souris : colle ton attaquant. Quand le disque passe à ta portée, <b>clic</b> (ou F) pour plonger en layout. <b>Espace</b> prend le joueur le plus proche du disque. <b>Récupère le disque !</b>',
      touch: 'À toi de défendre. Déplace ton joueur (anneau jaune) avec le joystick et colle ton attaquant. Bouton <b>Layout</b> pour plonger sur un disque à ta portée, <b>Switch</b> pour prendre le joueur le plus proche du disque. <b>Récupère le disque !</b>',
      pad: 'À toi de défendre. Déplace ton joueur (anneau jaune) avec le stick gauche et colle ton attaquant. <b>B</b> pour plonger en layout, <b>X</b> pour changer de joueur. <b>Récupère le disque !</b>'
    },
    setup() {
      tutoReset(); G.tuto.level = 'facile';
      Object.assign(G.form, { def: 'man', force: 'haut', dplay: 'none', play: 'none' });
      Object.assign(G.ai, { off: 'vert', def: 'man', force: 'haut', play: 'none', dplay: 'none' });
      tutoPut(1, [[62, 18.5], [58, 26], [52, 18], [47, 18], [42, 18]]);
      tutoPut(0, [[61, 19.8], [57, 25], [51, 19], [46, 19], [41, 19]]);
      tutoGive(TEAMS[1][0]);
    },
    on(ev, t) {
      if (ev === 'turnover' && G.off === 0) tutoSuccess('Disque récupéré ! 💪');
      if (ev === 'score') tutoFail('Ils ont marqué… recommence !');
    }
  },
  {
    title: 'Contrer une passe haute',
    text: {
      mouse: 'Tu marques le porteur. Il a <b>armé une passe haute</b> (disque levé) et la lancera quand il voudra, par-dessus toi. Saute (<b>S</b>) juste avant qu’il lance : ton saut met un court instant à décoller. Réagir au lâcher est trop tard, il faut deviner !',
      touch: 'Tu marques le porteur. Il a <b>armé une passe haute</b> (disque levé) et la lancera quand il voudra, par-dessus toi. Touche <b>Saut</b> juste avant qu’il lance : ton saut met un court instant à décoller. Réagir au lâcher est trop tard, il faut deviner !',
      pad: 'Tu marques le porteur. Il a <b>armé une passe haute</b> (disque levé) et la lancera quand il voudra, par-dessus toi. Saute (<b>A</b>) juste avant qu’il lance : ton saut met un court instant à décoller. Il faut deviner !'
    },
    setup() {
      tutoReset(); G.tuto.level = 'facile';
      Object.assign(G.form, { def: 'man', force: 'straight', dplay: 'none', play: 'none' });
      Object.assign(G.ai, { off: 'vert', def: 'man', force: 'haut', play: 'none', dplay: 'none' });
      tutoPut(1, [[60, 18.5], [45, 18.5]], true);
      tutoPut(0, [[58.6, 18.5], [6, 4], [6, 12], [6, 25], [6, 33]]);
      tutoGive(TEAMS[1][0]);
      G.tuto.armT = rand(1.0, 2.6);
    },
    pin(p) {
      if (p.team === 1) return p.i === 1 ? [45, 18.5] : null;
      return p.i === 0 ? null : [6, [4, 12, 25, 33][p.i - 1]];
    },
    pinD(d) { return d.i === 0 ? null : d.i === 1 ? [45, 18.5] : tutoFar(d); },
    hold(h, dt) {                                            // le porteur arme puis lance après un délai imprévisible
      const T = G.tuto;
      if (T.done) return true;
      if (!h.windup) h.windup = { t: T.armT };
      h.windup.t -= dt;
      if (h.windup.t <= 0) { h.windup = null; throwDisc(h, 45, 18.5, 0, 0.3, 'high'); }
      return true;
    },
    on(ev, p) {
      if (ev === 'turnover' && G.off === 0) { if (G.tuto.blocked) tutoSuccess('Contré ! Bien deviné 💪'); else tutoFail('Passe ratée par le lanceur : on recommence.'); }
      if (ev === 'catch' && p.team === 1) tutoFail(G.tuto.jumped ? 'Mauvais moment… recommence !' : 'Il est passé : saute (S) au bon moment !');
    }
  },
  {
    title: 'Le pull',
    text: {
      mouse: 'Chaque point commence par un <b>pull</b> : l’équipe qui défend lance le disque à l’autre. Clique sur la zone visée dans le camp adverse, puis arrête la jauge dans le <b>vert</b> (clic ou Espace) pour un pull long et haut.',
      touch: 'Chaque point commence par un <b>pull</b> : l’équipe qui défend lance le disque à l’autre. Pose le doigt n’importe où et glisse vers la zone visée dans le camp adverse (plus tu glisses loin, plus le pull est long), relâche, puis tape pour arrêter la jauge dans le <b>vert</b>.',
      pad: 'Chaque point commence par un <b>pull</b>. Vise avec le stick, A pour valider, puis A pour arrêter la jauge dans le <b>vert</b>.'
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
const TUTO_WALL = [[43.5, 18.5], [43.5, 16.3], [43.5, 20.7], [43.5, 14.1], [43.5, 22.9]];
const TUTO_STACK = [[46, 18.5], [50, 18.5], [54, 18.5], [58, 18.5]];

// ---------- outils des étapes ----------
function tutoReset() {
  players.forEach(p => Object.assign(p, { vx: 0, vy: 0, dive: 0, down: 0, jump: 0, jprep: 0, jrec: 0, jumpCd: 0, jumpAt: 0, windup: null, react: 0, tag: '', inT: 0, state: 'stack', role: 'cutter',
    match: null, diveTried: false, called: 0, freeAcc: 0, free: false }));
  Object.assign(G, { oplay: null, dplay: null, pendingOPlay: null, pullPending: false, carryTo: null, stall: 0, marker: null, dbl: null,
    pickup: null, throwKind: 'normal', score: [0, 0], celebrate: null, scorer: null, phase: 'play', pull: null });
  Object.assign(G.tuto, { wall: false, level: null, count: 0, called: false, jumped: false, blocked: false, lblock: false, thrown: false, holdT: 0 });
  G.wind = { x: 0, y: 0, kmh: 0 };                             // pas de vent pendant le tutoriel
  setCurve(0);
  disc.pull = false; disc.kind = 'normal';
  $('overlay').classList.add('hidden'); G.menuShown = false;
}
function tutoPut(t, spots, all) {
  TEAMS[t].forEach((p, k) => { const s = spots[k]; if (s) { p.x = p.tx = s[0]; p.y = p.ty = s[1]; } else if (all) { p.x = p.tx = 95; p.y = p.ty = 4 + k * 7; } });
}
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
  const at = p.team === 1 && S.pinD ? S.pinD(p) : S.pin ? S.pin(p) : null;
  if (!at) return false;
  p.tx = clamp(at[0], 0.5, W - 0.5); p.ty = clamp(at[1], 0.5, H - 0.5); p.sp = SPD.cut;
  return true;
}

// ---------- déroulé ----------
function tutoStart() {
  backToSolo();
  G.series = null; G.ms = null;
  G.tuto = { step: 0, t: 0, wait: 0, after: null, saved: { def: G.form.def, force: G.form.force, play: G.form.play, dplay: G.form.dplay }, inp: '' };
  $('lobbyCard').style.display = 'none';
  $('tutoBox').style.display = '';
  tutoGo(0);
}
function tutoGo(k) {
  const T = G.tuto; if (!T) return;
  T.step = k; T.t = 0; T.wait = 0; T.after = null; T.done = false;
  if (k >= TUTO_STEPS.length) { tutoFinish(); return; }
  TUTO_STEPS[k].setup();
  tutoText(true);
}
function tutoInput() { return G.gpActive ? 'pad' : isTouchUI() ? 'touch' : 'mouse'; }
function tutoText(force) {
  const T = G.tuto, S = TUTO_STEPS[T.step], inp = tutoInput();
  if (!S || (!force && inp === T.inp)) return;
  T.inp = inp;
  $('tutoTitle').textContent = S.title;
  $('tutoStep').textContent = `Étape ${T.step + 1} / ${TUTO_STEPS.length}`;
  $('tutoText').innerHTML = S.text[inp];
  $('tutoSkip').style.display = ''; $('tutoSkip').textContent = 'Passer l’étape ▸';
  $('tutoQuit').textContent = 'Quitter ✕';
  resize();
}
function tutoEvent(ev, a) {
  const T = G.tuto; if (!T || T.done) return;
  const S = TUTO_STEPS[T.step];
  if (S && S.on) S.on(ev, a);
}
function tutoSuccess(msg, delay) {
  const T = G.tuto; T.done = true;
  flash(msg, true);
  try { SOUNDS.score(); } catch (e) { }
  T.wait = delay || 1.6; T.after = () => tutoGo(T.step + 1);
}
function tutoFail(msg) {
  const T = G.tuto; T.done = true;
  flash(msg, true);
  T.wait = 1.5; T.after = () => tutoGo(T.step);
}
function tutoFrame(dt) {
  const T = G.tuto;
  T.t += dt;
  tutoText(false);
  if (T.wait > 0) { T.wait -= dt; if (T.wait <= 0 && T.after) { const f = T.after; T.after = null; f(); } }
}
function tutoFinish() {
  storeSet('uf-tuto', true);
  achEvent('tuto');
  const T = G.tuto; T.done = true; T.step = TUTO_STEPS.length;
  $('tutoTitle').textContent = 'Bravo ! 🎉';
  $('tutoStep').textContent = '';
  $('tutoText').innerHTML = 'Tu connais toutes les commandes : lancer, courber, passe haute, appeler un cut, layout en attaque, duel en l’air, marquer, changer de joueur, layout en défense, défendre, contrer à la mark et puller. Les menus d’avant-point te laissent aussi choisir ta stratégie et des combinaisons (plays). À toi de jouer !';
  $('tutoSkip').textContent = 'Jouer un match ▶';
  $('tutoQuit').textContent = 'Menu';
  resize();
}
function tutoCleanup() {
  const T = G.tuto; if (!T) return;
  Object.assign(G.form, T.saved);
  G.tuto = null;
  $('tutoBox').style.display = 'none'; resize();
  G.phase = 'menu'; G.receiving = 0; disc.pull = false;
  newWind(); placeForPoint();
}
function tutoQuit() { tutoCleanup(); showLobby(); }
if (typeof document !== 'undefined' && document.getElementById('tutoB')) {
  $('tutoB').addEventListener('click', tutoStart);
  $('tutoQuit').addEventListener('click', tutoQuit);
  $('tutoSkip').addEventListener('click', () => {
    const T = G.tuto; if (!T) return;
    if (T.step >= TUTO_STEPS.length) { tutoCleanup(); G.series = null; newMatch(); showMenu('first'); return; }
    tutoGo(T.step + 1);
  });
}

// lanceur scénarisé par l'étape en cours (sinon l'IA normale)
function tutoHold(h, dt) {
  const S = G.tuto && TUTO_STEPS[G.tuto.step];
  return !!(S && S.hold && S.hold(h, dt));
}
