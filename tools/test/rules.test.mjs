// Règles et IA, sans navigateur : matchs IA contre IA, Callahan, interceptions, mode infini, tournoi.
import { loadGame } from './lib.mjs';

export default async function (t, { quick }) {
  const g = loadGame(), R = c => g.run(c);

  t.group('Matchs IA contre IA');
  const games = quick ? 3 : 8;
  const r = R(`(() => {
    let pts = 0, stuck = 0, frames = 0;
    for (let k = 0; k < ${games}; k++) {
      G.score = [0, 0]; G.receiving = k % 2;
      for (;;) { const f = __playPoint(); if (f < 0) { stuck++; break; } pts++; frames += f; if (G.phase === 'over') break; }
    }
    const s = G.stats;
    return { pts, stuck, sec: frames / 60 / pts, comp: s.comps / s.throws, to: (s.blocks + s.ints + s.stalls + s.ground + s.out + (s.drops || 0)) / pts,
      blocks: s.blocks, ints: s.ints, phase: G.phase, pre: (s.preCatch || 0) / s.throws };
  })()`);
  t.ok(r.stuck === 0, 'aucun point bloqué', r);
  t.ok(r.phase === 'over', 'les matchs vont au bout', r.phase);
  t.ok(r.comp > 0.75 && r.comp < 0.99, 'taux de passes réussies réaliste (75–99 %)', +r.comp.toFixed(2));
  t.ok(r.to > 0.15 && r.to < 3, 'turnovers par point réalistes (0,15–3)', +r.to.toFixed(2));
  t.ok(r.sec > 8 && r.sec < 150, 'durée d’un point raisonnable', +r.sec.toFixed(0));
  t.ok(r.blocks + r.ints > 0, 'la défense arrête des passes', r);
  t.ok(r.pre > 0.3 && r.pre < 0.98, 'sur une passe sûre, tout le monde se replace avant la réception', +r.pre.toFixed(2));

  t.group('Replacement pendant la passe');
  const pc = R(`(() => {                                       // une passe courte et libre : rôles et défense attribués dès le lancer
    G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
    for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && G.stall > 1); f++) __tick();
    if (!(disc.mode === 'held' && disc.holder)) { G.off = 0; G.phase = 'play'; holdDisc(TEAMS[0][0]); }   // rare : on force la situation
    const h = disc.holder, t = h.team, q = TEAMS[t].filter(p => p !== h).sort((a, b) => dist(a.x, a.y, h.x, h.y) - dist(b.x, b.y, h.x, h.y))[0];
    h.x = W / 2 - 3; h.y = H / 2; q.x = W / 2 + 3; q.y = H / 2;     // milieu du terrain, loin des en-buts : la situation ne dépend pas de la partie jouée
    for (const p of TEAMS[t]) p.vx = p.vy = 0;
    for (const d of TEAMS[1 - t]) { d.x = W - 2 + (t ? -W + 4 : 0); d.y = 2; d.vx = d.vy = 0; }  // défenseurs loin : personne ne peut couper
    G.stats.preCatch = 0; Object.assign(G.wind, { x: 0, y: 0, kmh: 0 });   // sans vent : le disque arrive pile sur le receveur
    throwDisc(h, q.x, q.y, 0, 0, 'normal');
    const r = disc.intended;
    return { pre: G.stats.preCatch, inOrder: G.order[t].includes(r), throwerIsCutter: G.order[t].includes(h) || h.role === 'dump', marked: TEAMS[1 - t].some(d => d.match === r) || defFormOf(1 - t) !== 'man' };
  })()`);
  t.ok(pc.pre === 1 && !pc.inOrder && pc.throwerIsCutter && pc.marked, 'au lancer : le receveur devient porteur, le lanceur reprend un rôle (coupeur ou relais), un défenseur le prend', pc);

  t.group('Layout demandé pour le receveur IA');
  const dv = R(`[2.5, 3, 3.4].map(off => {                // passe à côté d'un receveur immobile ; layout demandé dès le lancer
    G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
    for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held'); f++) __tick();
    if (!(disc.mode === 'held' && disc.holder)) { G.off = 0; G.phase = 'play'; holdDisc(TEAMS[0][0]); }
    const h = disc.holder, t = h.team, q = TEAMS[t].find(p => p !== h);
    h.x = 40; h.y = 18; q.x = 55; q.y = 12;
    for (const d of TEAMS[1 - t]) { d.x = t ? 3 : 97; d.y = 2; d.vx = d.vy = 0; }
    for (const p of TEAMS[t]) { p.vx = p.vy = 0; if (p !== h && p !== q) { p.x = 30; p.y = 33; } }
    G.wind = { x: 0, y: 0, kmh: 0 };                                // sans vent : la passe arrive là où elle est visée
    throwDisc(h, q.x, q.y + off, 0, 0, 'normal');
    const r = disc.intended; if (r !== q) return { bad: 'receveur' };
    r.diveArmed = true; armedDive(r);
    const now = r.dive > 0, x0 = r.x, y0 = r.y, _dc = dropChance; let at = -1;
    dropChance = () => -1;                                           // pas de drop au hasard (vent, mains) : on teste le plongeon
    for (let f = 0; f < 600 && disc.mode === 'air'; f++) {
      __tick();
      if (r.dive > 0 && at < 0) at = disc.t / disc.dur;
      if (at < 0 && disc.mode === 'air') { r.x = x0; r.y = y0; r.vx = r.vy = 0; }   // il attend sur place : seul le layout peut l'amener au disque
    }
    dropChance = _dc;
    return { now, at: +at.toFixed(2), caught: disc.holder === r };
  })`);
  t.ok(dv.every(d => !d.now && d.at > 0.2), 'il ne plonge pas tout de suite vers le disque : il attend le bon moment', dv);
  t.ok(dv.every(d => d.caught), 'il plonge là où sera le disque et l’attrape', dv);

  t.group('Défense individuelle : entre son joueur et le disque');
  const ms = R(`(() => {                                       // disque en (40, centre) ; attaquants un peu partout devant
    const ax = 40, ay = H / 2, dir = 1, open = 1, out = [];
    for (const [px, py] of [[52, 2], [52, H - 2], [50, H / 2 + 2], [46, 8], [56, 30], [34, 12]]) {
      const [tx, ty] = manSpot(px, py, ax, ay, dir, open), d0 = dist(px, py, ax, ay), d1 = dist(tx, ty, ax, ay), r = dist(tx, ty, px, py);
      out.push(d1 < d0 - 0.8 && r > 1 && r < 2.1);              // plus près du disque que son joueur, à 1-2 m de lui
    }
    return out;
  })()`);
  t.ok(ms.every(Boolean), 'où que soit son joueur, le défenseur se place entre lui et le disque, à 1-2 m', ms);

  t.group('Zone : l’arrière près de l’en-but');
  const zb = R(`(() => {                                       // l'équipe 0 attaque près de l'en-but adverse, défense en zone
    const t = 0, d = 1, dir = dirOf(t), goal = dir > 0 ? W - EZ : EZ, keep = defFormOf; defFormOf = () => 'zone';
    G.off = t; const h = TEAMS[t][0]; h.x = goal - dir * 8; h.y = H / 2; holdDisc(h);
    TEAMS[t].forEach((p, i) => { if (p !== h) { p.x = goal - dir * (2 + i); p.y = 5 + i * 6; } });
    const back = () => { const s = zoneSlots(d, h.x, h.y, dir, closedOf(d)); return dir * (s[1].x - goal); };
    const near = back();
    TEAMS[t][3].x = goal + dir * 10;                               // un attaquant au fond de l'en-but : l'arrière le suit
    const deep = back();
    defFormOf = keep;
    return { near: +near.toFixed(1), deep: +deep.toFixed(1) };
  })()`);
  t.ok(zb.near <= 5.01 && zb.near > -1, 'personne au fond : l’arrière reste vers le début de l’en-but, pas collé au fond du terrain', zb);
  t.ok(zb.deep >= 11.9 && zb.deep <= 12.1, 'un attaquant au fond de l’en-but : l’arrière va se placer derrière lui', zb);

  t.group('Relais : jamais collé au porteur');
  const dp = R(`(() => {
    let n = 0, close = 0;
    for (let k = 0; k < 10; k++) {
      G.score = [0, 0]; G.receiving = k % 2; newWind(); startPoint();
      for (let f = 0; f < 20000 && (G.phase === 'play' || G.phase === 'pull'); f++) { __tick();
        if (G.phase !== 'play' || disc.mode !== 'held' || !disc.holder || G.holdT < 2) continue;   // 2 s après la réception (le temps de s'écarter)
        const h = disc.holder, d = TEAMS[h.team].find(p => p.role === 'dump'); if (!d) continue;
        n++; if (dist(d.x, d.y, h.x, h.y) < 3) close++; }
    }
    return { n, close };
  })()`);
  t.ok(dp.n > 30 && dp.close / dp.n < 0.025, '2 s après la réception, le relais est (presque) toujours à plus de 3 m', dp);

  t.group('Niveaux : mêmes idées, stats et choix de passe différents');
  const lvq = R(`(() => { const keys = o => Object.keys(o).sort().join(); const L = [AI_LEVELS.facile, AI_LEVELS.normal, AI_LEVELS.difficile, LEGEND, SUPER, endlessLevel(20)];
    return { same: L.every(o => keys(o) === keys(AI_LEVELS.normal)), greed: L.map(o => o.greed), hands: L.map(o => o.hands) }; })()`);
  t.ok(lvq.same, 'tous les niveaux (mode infini compris) ont les mêmes réglages', lvq);
  t.ok(lvq.greed.every((g, i) => i === 0 || g <= lvq.greed[i - 1]) && lvq.greed[0] > lvq.greed[1], 'le débutant prend plus de risques dans ses passes', lvq.greed);
  t.ok(lvq.hands.every((g, i) => i === 0 || g <= lvq.hands[i - 1]), 'et droppe plus souvent', lvq.hands);

  t.group('Vol du disque : hauteur réaliste');
  const zn = R(`(() => { const z = (L, s, c) => +heightAt(s / L, 0, 'normal', L, c || 0).toFixed(2);
    return { short: [z(8, 1), z(8, 4), z(8, 7)], mid: z(16, 8), long: [z(30, 1), z(30, 15), z(30, 29)], curved: [z(20, 2, 1), z(20, 10, 1)], flat: [z(20, 2), z(20, 10)] }; })()`);
  t.ok(zn.short.every(v => v >= 1 && v <= 1.6), 'passe courte : à hauteur de poitrine, contestable', zn);
  t.ok(zn.mid < 2.2 && zn.long[1] > 2.8, 'passe moyenne atteignable debout, passe longue hors de portée au milieu', zn);
  t.ok(zn.long[0] < 2 && zn.long[2] < 2, 'lâchée et rattrapée à hauteur de main', zn);
  t.ok(zn.curved.every((v, i) => v > zn.flat[i]), 'une passe courbée monte plus vite et plus haut', zn);

  t.group('Course : accélération réaliste');
  const acc = R(`(() => { const p = TEAMS[0][1]; Object.assign(p, { x: 10, y: 10, vx: 0, vy: 0, tx: 90, ty: 10, sp: SPD.cut, dive: 0, down: 0, jump: 0, jprep: 0, jrec: 0 });
    const v = []; for (let f = 1; f <= 120; f++) { steer(p, 1 / 60); if (f % 30 === 0) v.push(+Math.hypot(p.vx, p.vy).toFixed(2)); }
    p.tx = 0; let back = 0; for (let f = 1; f <= 600 && p.vx > -1; f++) { steer(p, 1 / 60); back = f / 60; }
    return { v, back: +back.toFixed(2), est: +runTime(20, 0, SPD.cut).toFixed(2) }; })()`);
  t.ok(acc.v[0] > 2 && acc.v[0] < 4 && acc.v[3] > 7, 'vitesse de pointe en ~1,3 s', acc);
  t.ok(acc.back > 0.55 && acc.back < 1, 'faire demi-tour en pleine course coûte du temps', acc);
  t.ok(acc.est > 3 && acc.est < 3.5, 'estimation du temps de course cohérente', acc);

  t.group('En ligne : visée du porteur coéquipier');
  const al = R(`(() => { const keep = [G.net, G.humans, G.myId, G.me, G.phase, G.off];
    const p = TEAMS[0][1]; G.phase = 'play'; G.off = 0; holdDisc(p);
    G.net = 'host'; G.myId = 0; G.humans = [{ id: 0, team: 0, sel: TEAMS[0][0] }, { id: 1, team: 0, sel: p, inp: { x: 60, y: 10, aim: true, aiming: true, curve: 0.5, high: false } }]; syncMe();
    const mate = allyAim(); G.humans[1].team = 1; G.humans[0].team = 1; syncMe(); const opp = allyAim();
    [G.net, G.humans, G.myId, G.me, G.phase, G.off] = keep; syncMe();
    return { mate: !!mate && mate.curve === 0.5, opp: !!opp }; })()`);
  t.ok(al.mate && !al.opp, 'un coéquipier humain vise : son aperçu de passe s’affiche, pas chez l’adversaire', al);

  t.group('Formation perso : consignes des postes');
  const ps = R(`(() => {
    const keep = G.ai.osys; G.ai.osys = cleanSystem({ kind: 'off', name: 'Test', pos: [[8, 4], [14, -4], [20, 0], [-3.5, -5]],
      postes: [{ role: 'cutter', zone: 'open', when: 'auto' }, { role: 'cutter', zone: 'auto', when: 'never' }, { role: 'deep', zone: 'deep', fake: 'no' }, { role: 'dump', when: 'stall' }] });
    const cuts = [], roles = new Set(); let never = 0;
    const _st = startCut; startCut = function (p, x, y, d) {
      const h = disc.holder, P = p.poste;
      if (h && P && !G.oplay && !p.free) { const f = dirOf(p.team) * (x - h.x), sOpen = -closedOf(1 - p.team) * (y - h.y); cuts.push({ i: p.sysIdx, f, s: sOpen, z: P.zone }); if (P.when === 'never') never++; }
      const r = _st(p, x, y, d); if (P && P.fake === 'no' && !G.oplay) cuts[cuts.length - 1].st = p.state; return r; };
    for (let k = 0; k < 6; k++) { G.score = [0, 0]; G.receiving = k % 2; newWind(); startPoint();
      for (let f = 0; f < 60 * 90 && (G.phase === 'play' || G.phase === 'pull'); f++) { __tick();
        if (disc.mode === 'held') for (const q of TEAMS[G.off]) if (q.poste) roles.add(q.poste.role + ':' + q.role); } }
    startCut = _st; G.ai.osys = keep;
    const open = cuts.filter(c => c.z === 'open'), deep = cuts.filter(c => c.z === 'deep');
    return { n: cuts.length, openOk: open.length > 0 && open.every(c => c.s >= 2.9), deepOk: deep.length > 0 && deep.every(c => c.f >= 17.9),
      noFake: deep.every(c => c.st === 'cut'), never, dump: roles.has('dump:dump'), roles: [...roles] }; })()`);
  t.ok(ps.openOk && ps.deepOk, 'zone de coupe respectée (côté open, en profondeur)', ps);
  t.ok(ps.never === 0, '« jamais » : ce poste ne coupe pas', ps);
  t.ok(ps.noFake, '« sans feinte » : la coupe part tout de suite', ps);
  t.ok(ps.dump, 'poste « relais » : il joue le relais', ps);

  t.group('Consignes d’équipe avant le point');
  const od = R(`(() => { const keep = Object.assign({}, G.ai); const res = {};
    G.ai.huck = 'plus'; G.ai.high = 'moins'; res.style = aiStyle(1); G.ai.risk = 'ose'; res.risk = riskOf(1);
    for (const hp of ['jamais', 'toujours']) { G.ai.help = hp; let n = 0;
      for (let k = 0; k < 3; k++) { G.score = [0, 0]; G.receiving = k % 2; newWind(); startPoint();
        for (let f = 0; f < 60 * 60 && (G.phase === 'play' || G.phase === 'pull'); f++) { __tick(); if (G.dB && G.dB.help && G.dbT > 0.32) n++; } }
      res[hp] = n; }
    Object.keys(G.ai).forEach(k => delete G.ai[k]); Object.assign(G.ai, keep); return res; })()`);
  t.ok(od.style.huck > 1.5 && od.style.high < 0.5 && od.risk[1] > 0, 'jeu long, passes hautes et risque suivent les consignes', od);
  t.ok(od.jamais === 0 && od.toujours > 0, 'aide en défense : jamais / toujours', od);

  t.group('Courbe et vent');
  const cw = R(`(() => { const k = G.wind.kmh; G.wind.kmh = 0; const calm = [throwErr(20, 0, 'normal'), throwErr(20, 1, 'normal')];
    G.wind.kmh = 25; const windy = [throwErr(20, 0, 'normal'), throwErr(20, 1, 'normal')]; G.wind.kmh = k; return { calm, windy }; })()`);
  t.ok(Math.abs(cw.windy[0] - 0.6 * 1.55) < 0.01, 'passe droite dans le vent : imprécision inchangée', cw);
  t.ok(cw.windy[1] / cw.calm[1] > 2.5 && cw.windy[0] / cw.calm[0] < 1.6, 'passe très courbée dans le vent : bien plus aléatoire', cw);

  t.group('Coupe demandée dans sa direction de course');
  const cf = R(`(() => { const c = TEAMS[0][2]; Object.assign(c, { x: 40, y: 15, vx: 7, vy: 0 }); startCut(c, 60, 16, false);
    const st = c.state; Object.assign(c, { x: 40, y: 15, vx: -6, vy: 0 }); startCut(c, 60, 16, false); return { same: st, back: c.state }; })()`);
  t.ok(cf.same === 'cut' && cf.back === 'jab', 'déjà lancé vers la cible : il continue sans s’arrêter (feinte seulement sinon)', cf);

  t.group('Tutoriel : plonger en défense');
  const td = R(`(() => {
    const keepH = G.humans, keepS = G.series; G.series = null; G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    tutoStart(); tutoGo(TUTO_STEPS.findIndex(s => s.title === 'Plonger en défense'));
    const msgs = []; let last = '', cue = -1;
    for (let f = 0; f < 60 * 8 && !G.tuto.done; f++) {
      Object.assign(G.pointer, { x: 50.5, y: 20.9, last: G.time, active: true });     // le joueur attend à sa place…
      __tick(); tutoFrame(1 / 60);
      if (G.msg !== last) { last = G.msg; msgs.push(last); }
      if (cue < 0 && /PLONGE/.test(G.msg)) { cue = f; doDive(50, 18.5); }          // …et plonge au signal
    }
    const r = { msgs, done: G.tuto.done, lblock: G.tuto.lblock };
    tutoCleanup(); G.humans = keepH; G.series = keepS; syncMe();
    return r;
  })()`);
  t.ok(td.msgs.slice(0, 3).join() === 'Passe dans 3…,Passe dans 2…,Passe dans 1…' && td.msgs.some(m => /PLONGE/.test(m)), 'compte à rebours, puis le signal « PLONGE ! »', td.msgs);
  t.ok(td.done && td.lblock, 'plonger au signal contre la passe (layout block)', td);

  t.group('Tutoriel : contrer une passe haute');
  const tj = R(`(() => {
    const keepH = G.humans, keepS = G.series; G.series = null; G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    tutoStart(); tutoGo(TUTO_STEPS.findIndex(s => s.title === 'Contrer une passe haute'));
    const msgs = []; let last = '', cue = -1;
    for (let f = 0; f < 60 * 8 && !G.tuto.done; f++) {
      const me = TEAMS[0][0]; Object.assign(G.pointer, { x: me.x, y: me.y, last: G.time, active: true });
      __tick(); tutoFrame(1 / 60);
      if (G.msg !== last) { last = G.msg; msgs.push(last); }
      if (cue < 0 && /SAUTE/.test(G.msg)) cue = f;
      if (cue >= 0 && f === cue + 12) doJump();                    // saute 0,2 s après le signal (temps de réaction)
    }
    const r = { msgs, done: G.tuto.done, blocked: G.tuto.blocked };
    tutoCleanup(); G.humans = keepH; G.series = keepS; syncMe();
    return r;
  })()`);
  t.ok(tj.msgs.slice(0, 3).join() === 'Il lance dans 3…,Il lance dans 2…,Il lance dans 1…' && tj.msgs.some(m => /SAUTE/.test(m)), 'compte à rebours, puis le signal « SAUTE ! »', tj.msgs);
  t.ok(tj.done && tj.blocked, 'sauter au signal contre la passe haute au lâcher', tj);

  t.group('Pull automatique');
  const ap = R(`(() => {
    const keepH = G.humans; G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe(); G.form.puller = 'cap';
    G.score = [0, 0]; G.receiving = 1; newWind(); startPoint();
    for (let f = 0; f < 60 * 20 && !pullReady(); f++) pullTick(1 / 60, 0.78 / 60);
    const first = pullLeft();
    for (let k = 0; k < 30 * 60; k++) pullTick(1 / 60, 0.78 / 60);
    const half = pullLeft(), stillPull = G.phase === 'pull';
    for (let k = 0; k < 31 * 60 && G.phase === 'pull'; k++) pullTick(1 / 60, 0.78 / 60);
    const r = { first, half, stillPull, after: G.phase };
    G.humans = keepH; syncMe(); return r;
  })()`);
  t.ok(ap.first === 60 && ap.half === 30 && ap.stillPull, 'pulleur humain : 60 s pour pull, le temps restant est affiché', ap);
  t.ok(ap.after !== 'pull', 'au bout de 60 s, le pull part tout seul', ap);

  t.group('Duels et contres');
  const du = R(`(() => {                                       // contres : la chance baisse si la passe est courte ou le défenseur au bout du bras
    disc.sx = 40; disc.sy = 18; disc.ex = 44; disc.ey = 18; disc.x = 42; disc.y = 18;
    const d = TEAMS[1][0]; d.x = disc.x; d.y = disc.y + 0.1; const near = blockOdds(d, false); d.y = disc.y + 0.95; const far = blockOdds(d, false);
    return { near, far };
  })()`);
  t.ok(du.near > 0.88 && du.far > 0.45 && du.far < 0.6, 'en plein dans les bras ~90 %, du bout des doigts ~50 %', du);
  t.ok(R("!/Math\\.random/.test(String(update).split('duel :')[1].split('defStop')[0])"), 'duel : aucun tirage au sort, seul le placement compte');

  t.group('Mode infini : réglages par défaut');
  const ec = R(`(() => { G.form.first = 'r'; G.form.allyLevel = 'normal'; G.me = 0;
    endlessCfgIn(); const inside = [G.form.first, G.form.allyLevel];
    G.form.allyLevel = 'facile'; endlessCfgOut(); const after = [G.form.first, G.form.allyLevel];
    endlessCfgIn(); const again = G.form.allyLevel; endlessCfgOut();
    return { inside, after, again }; })()`);
  t.ok(ec.inside.join() === '0,difficile', 'l’adversaire pulle et les coéquipiers IA sont difficiles', ec);
  t.ok(ec.after.join() === 'r,normal', 'en sortant, les réglages du match rapide reviennent', ec);
  t.ok(ec.again === 'facile', 'un réglage changé en mode infini est gardé pour la prochaine fois', ec);

  t.group('Interceptions');
  const ir = R(`(() => {                                       // 600 arrêts au milieu du terrain, sans jouer la suite
    const keep = [interception, turnover, msTurnover]; let n = 0;
    interception = () => n++; turnover = () => {}; msTurnover = () => {};
    disc.x = W / 2; disc.y = H / 2;
    for (let k = 0; k < 600; k++) defStop(TEAMS[1][0], 'Block');
    [interception, turnover, msTurnover] = keep;
    return n / 600;
  })()`);
  t.ok(ir > 0.26 && ir < 0.41, '1 arrêt sur 3 est une interception (hors en-but)', +ir.toFixed(2));

  t.group('Callahan : un arrêt dans l’en-but adverse est toujours une interception qui marque');
  const cal = R(`(() => {
    let ok = 0;
    for (let k = 0; k < 20; k++) {
      G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
      for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held'); f++) __tick();
      const d = 1 - G.off, p = TEAMS[d][0];
      let x = 0; while (x < W && !inScoreZone(d, x)) x += 1;
      x += 3; disc.x = x; disc.y = H / 2; p.x = x; p.y = H / 2;
      const before = G.score[d];
      defStop(p, 'Contre');
      if (G.score[d] === before + 1) ok++;
    }
    return ok;
  })()`);
  t.ok(cal === 20, 'Callahan à chaque fois (20 essais)', cal);

  t.group('Mode infini');
  const lv = R(`[0, 0.5, 1, 2, 4, 6, 9, 11, 14, 20].map(d => endlessLevel(d))`);
  let mono = true;
  for (let i = 1; i < lv.length; i++) if (!(lv[i].react <= lv[i - 1].react && lv[i].block >= lv[i - 1].block && lv[i].err <= lv[i - 1].err)) mono = false;
  t.ok(mono, 'la difficulté ne baisse jamais (réaction, contres, précision)');
  t.ok(lv[0].react === R('AI_LEVELS.facile.react') && lv[2].react === R('AI_LEVELS.normal.react') && lv[4].react === R('AI_LEVELS.difficile.react'), 'facile au 1er match, normal au 2e, difficile (Titans) au 5e');
  t.ok(lv[6].react < lv[4].react && lv[8].react < lv[6].react && lv[9].react < lv[8].react && lv[9].block > lv[8].block, 'continue de monter après difficile, et encore après le 15e match');
  const far = R('endlessLevel(200)');
  t.ok(far.react >= 0.2 && far.block <= 0.99 && far.speed <= 1.3 && far.err >= 0.1, 'même très loin, les réglages restent dans des limites possibles', far);
  R('showMenu = () => {}; showEndless = () => {};');            // pas d'écran ici
  const e = R(`(() => {
    G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    G.series = { endless: true, cur: 0, opp: endlessOpp(0), pts: ENDLESS_PTS, wins: 0, diff: 0 };
    newMatch();
    const pts = winPts(), lv0 = aiLvl(1).react;
    G.score = [1, 1]; const lvMid = aiLvl(1).react;              // la difficulté monte aussi pendant le match
    G.score = [2, 1]; onMatchOver();
    const afterWin = { wins: G.series.wins, diff: G.series.diff, done: !!G.series.done };
    endlessNext();
    const second = { cur: G.series.cur, name: G.series.opp.name, score: G.score.slice() };
    G.score = [0, 2]; onMatchOver();
    const loc = endlessLocal();
    return { pts, lv0, lvMid, afterWin, second, done: G.series.done, wins: G.series.wins, diff: G.series.diff, best: loc.best, runs: loc.runs.length,
      names: new Set(Array.from({ length: 18 }, (_, i) => endlessOpp(i).name)).size, team: (computeTeams(), tn(1)) };
  })()`);
  t.ok(e.pts === 2, 'matchs en 2 points', e.pts);
  t.ok(e.lvMid < e.lv0, 'l’adversaire devient plus vif au fil des points', [e.lv0, e.lvMid]);
  t.ok(e.afterWin.wins === 1 && e.afterWin.diff === 1 && !e.afterWin.done, 'victoire 2–1 : 1 match gagné, écart +1, la série continue', e.afterWin);
  t.ok(e.second.cur === 1 && e.second.score.join() === '0,0' && e.second.name !== R('endlessOpp(0).name'), 'match suivant : nouvel adversaire, score remis à zéro', e.second);
  t.ok(e.done && e.wins === 1 && e.diff === -1, 'défaite 0–2 : série terminée, écart -1', e);
  t.ok(e.best === 1 && e.runs === 1, 'record personnel gardé dans le navigateur', e);
  t.ok(e.names === 18, '18 adversaires différents avant de recommencer les noms', e.names);
  t.ok(e.team === R('G.series.opp.name'), 'le nom de l’adversaire s’affiche', e.team);

  t.group('Mini-tournoi');
  const s = R(`(() => { G.series = { cur: 2 }; const r = [oppLevel() === AI_LEVELS.difficile, winPts(), serOpp().name]; G.series = null; return r; })()`);
  t.ok(s[0] && s[1] === 5 && s[2] === 'Titans', 'tour 3 : Titans, niveau difficile, 5 points', s);
}
