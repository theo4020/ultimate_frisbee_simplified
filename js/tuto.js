// tuto.js — Tutoriel interactif : petites étapes guidées (toutes les commandes du jeu), chacune passable.
// Les étapes placent les joueurs, en « figent » certains (pin), et attendent un événement de jeu
// (réception, point, turnover, pull) pour valider.

const TUTO_STEPS = [
  {
    title: 'Lancer',
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
    text: {
      mouse: 'Un défenseur bloque la ligne droite. Ajoute de la <b>courbe</b> (A / E ou molette) pour passer à côté.',
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
    title: 'La passe haute',
    text: {
      mouse: 'Un mur bloque le passage. <b>Z</b> arme la passe haute, puis lance par-dessus.',
      touch: 'Un mur bloque le passage. <b>Tape ton porteur</b> pour armer la passe haute, puis lance par-dessus.',
      joy: 'Un mur bloque le passage. Touche <b>Passe haute</b> (bord droit), puis lance par-dessus.',
      pad: 'Un mur bloque le passage. <b>Y</b> arme la passe haute, puis lance par-dessus avec A.'
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
    title: 'Layout en attaque',
    text: {
      mouse: 'Ton coéquipier ne bouge pas. Lance à 2–4 m de lui, puis <b>clic</b> (ou F) pendant le vol : il plonge.',
      touch: 'Ton coéquipier ne bouge pas. Lance à 2–4 m de lui, puis <b>glisse vite</b> n’importe où pendant le vol : il plonge.',
      joy: 'Ton coéquipier ne bouge pas. Lance à 2–4 m de lui, puis touche <b>Layout</b> pendant le vol : il plonge.',
      pad: 'Ton coéquipier ne bouge pas. Lance à 2–4 m de lui, puis <b>B</b> pendant le vol : il plonge.'
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
      mouse: 'Ton receveur est collé. Lance-lui, puis <b>S</b> pendant le vol : il saute et gagne le duel.',
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
      if (ev === 'turnover') tutoFail(disc.thrower && disc.intended && disc.intended.jump > 0 ? 'Duel perdu… saute un peu plus tôt !' : 'Contré : fais sauter ton receveur (S) !');
    }
  },
  {
    title: 'Changer de joueur',
    text: {
      mouse: 'Ton défenseur (anneau jaune) est loin du disque. <b>Espace</b> prend le plus proche (entouré en gris), ou clique sur un joueur.',
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
    text: {
      mouse: 'Une passe va passer à côté de toi. Juste avant, <b>clique sur sa trajectoire</b> (ou F) : layout block.',
      touch: 'Une passe va passer à côté de toi. Juste avant, <b>glisse vite vers sa trajectoire</b> : layout block.',
      joy: 'Une passe va passer à côté de toi. Juste avant, oriente le joystick vers elle et touche <b>Layout</b>.',
      pad: 'Une passe va passer à côté de toi. Juste avant, stick vers elle et <b>B</b> : layout block.'
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
      if (ev === 'turnover' && G.off === 0) tutoSuccess(G.tuto.lblock ? 'Layout block ! 💪' : 'Contré !');
      if (ev === 'catch' && p.team === 1) tutoFail(TEAMS[0][0].down > 0 || TEAMS[0][0].dive > 0 ? 'Pas loin ! Plonge un peu plus tôt, vers la trajectoire.' : 'Plonge juste avant que le disque passe !');
    }
  },
  {
    title: 'Contrer une passe haute',
    text: {
      mouse: 'Le porteur a armé une passe haute. <b>Saute (S)</b> juste avant qu’il lance : il faut deviner !',
      touch: 'Le porteur a armé une passe haute. <b>Tape ton joueur</b> pour sauter juste avant qu’il lance : il faut deviner !',
      joy: 'Le porteur a armé une passe haute. Touche <b>Saut</b> juste avant qu’il lance : il faut deviner !',
      pad: 'Le porteur a armé une passe haute. <b>A</b> pour sauter juste avant qu’il lance : il faut deviner !'
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
function tutoInput() { return G.gpActive ? 'pad' : isTouchUI() ? (gestures() ? 'touch' : 'joy') : 'mouse'; }
function tutoText(force) {
  const T = G.tuto, S = TUTO_STEPS[T.step], inp = tutoInput();
  if (!S || (!force && inp === T.inp)) return;
  T.inp = inp;
  $('tutoTitle').textContent = S.title;
  $('tutoStep').textContent = `Étape ${T.step + 1} / ${TUTO_STEPS.length}`;
  const tx = S.text[inp] || S.text.touch; $('tutoText').innerHTML = typeof tx === 'function' ? tx() : tx;
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
  $('tutoText').innerHTML = 'Tu connais toutes les commandes : lancer, courber, passe haute, appeler un cut, layout, duel en l’air, changer de joueur, layout block, contre en saut et pull. Les menus d’avant-point te laissent aussi choisir ta stratégie et des combinaisons (plays). À toi de jouer !';
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
