// Règles et IA, sans navigateur : matchs IA contre IA, Callahan, interceptions, mode infini, tournoi.
import { loadGame } from './lib.mjs';

export default async function (t, { quick }) {
  const g = loadGame(), R = c => g.run(c);

  t.group('Matchs IA contre IA');
  const games = quick ? 3 : 4;
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
    visReset();                                                     // (la défense voit tout le monde : on teste la géométrie de la zone)
    const back = () => { const s = zoneSlots(d, h.x, h.y, dir, closedOf(d)); return dir * (s[1].x - goal); };
    const near = back();
    TEAMS[t][3].x = goal + dir * 10;                               // un attaquant au fond de l'en-but : l'arrière le suit
    visReset();
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
        if (G.phase !== 'play' || disc.mode !== 'held' || !disc.holder || G.holdT < 1.5) continue;   // 1,5 s après la réception (le temps de s'écarter)
        const h = disc.holder, d = TEAMS[h.team].find(p => p.role === 'dump'); if (!d) continue;
        n++; if (dist(d.x, d.y, h.x, h.y) < 3) close++; }
    }
    return { n, close };
  })()`);
  t.ok(dp.n > 30 && dp.close / dp.n < 0.04, '1,5 s après la réception, le relais est (presque) toujours à plus de 3 m', dp);

  t.group('Niveaux : mêmes idées, stats et choix de passe différents');
  const lvq = R(`(() => { const keys = o => Object.keys(o).sort().join(); const L = [AI_LEVELS.facile, AI_LEVELS.normal, AI_LEVELS.difficile, LEGEND, SUPER, endlessLevel(20)];
    return { same: L.every(o => keys(o) === keys(AI_LEVELS.normal)), greed: L.map(o => o.greed), hands: L.map(o => o.hands) }; })()`);
  t.ok(lvq.same, 'tous les niveaux (mode infini compris) ont les mêmes réglages', lvq);
  t.ok(lvq.greed.every((g, i) => i === 0 || g <= lvq.greed[i - 1]) && lvq.greed[0] > lvq.greed[1], 'le débutant prend plus de risques dans ses passes', lvq.greed);
  t.ok(lvq.hands.every((g, i) => i === 0 || g <= lvq.hands[i - 1]), 'et droppe plus souvent', lvq.hands);

  t.group('Vol du disque : hauteur réaliste');
  const zn = R(`(() => { const z = (L, s, c) => +heightAt(discU(s / L), 0, 'normal', L, c || 0).toFixed(2);   // hauteur à s mètres du lanceur
    return { short: [z(8, 1), z(8, 4), z(8, 7)], mid: z(16, 8), long: [z(30, 1), z(30, 15), z(30, 29)], curved: [z(20, 2, 1), z(20, 10, 1)], flat: [z(20, 2), z(20, 10)] }; })()`);
  t.ok(zn.short.every(v => v >= 1 && v <= 1.6), 'passe courte : à hauteur de poitrine, contestable', zn);
  t.ok(zn.mid < 2.2 && zn.long[1] > 2.2 && zn.long[1] < 2.8, 'passe moyenne atteignable debout, passe longue à plat : au milieu, seulement en sautant', zn);
  t.ok(zn.curved[1] > zn.flat[1] + 0.8, 'la courbe fait monter la passe', zn);
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
      const r = _st(p, x, y, d); if (P && P.fake === 'no' && !G.oplay && !p.free && cuts.length) cuts[cuts.length - 1].st = p.state; return r; };
    for (let k = 0; k < 12; k++) { G.score = [0, 0]; G.receiving = k % 2; newWind(); startPoint();
      for (let f = 0; f < 60 * 90 && (G.phase === 'play' || G.phase === 'pull'); f++) { __tick();
        if (disc.mode === 'held') for (const q of TEAMS[G.off]) if (q.poste) roles.add(q.poste.role + ':' + q.role); } }
    startCut = _st; G.ai.osys = keep;
    const open = cuts.filter(c => c.z === 'open'), deep = cuts.filter(c => c.z === 'deep');
    return { n: cuts.length, openOk: open.length > 0 && open.every(c => c.s >= 2.9), deepOk: deep.every(c => c.f >= 17.9), nDeep: deep.length,
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

  t.group('Réception en pleine course');
  const rc = R(`(() => { G.score = [0, 0]; G.receiving = 0; newWind(); startPoint(); for (let f = 0; f < 6000 && G.phase !== 'play'; f++) __tick();
    const p = TEAMS[0][2]; G.off = 0; Object.assign(p, { x: 50, y: 18, vx: 7, vy: 0 }); holdDisc(p); p.think = 0;
    const th0 = G.stats.throws; for (let f = 0; f < 12; f++) __tick(); const early = Math.hypot(p.vx, p.vy), thrownEarly = G.stats.throws > th0;
    for (let f = 0; f < 60; f++) __tick(); return { early: +early.toFixed(2), late: disc.holder === p ? +Math.hypot(p.vx, p.vy).toFixed(2) : 0, thrownEarly, moved: +(p.x - 50).toFixed(2) }; })()`);
  t.ok(rc.early > 3 && rc.early < 6 && rc.late < 0.1 && rc.moved > 1, 'attrapé en courant : il freine sur 2–3 pas avant de s’arrêter', rc);
  t.ok(!rc.thrownEarly, 'l’IA ne lance pas avant de s’être arrêtée', rc);

  t.group('Duel porteur / mark');
  R(`function __near(h) { G.dplay = null; for (const d of TEAMS[1]) d.match = null; const m = TEAMS[1][0]; m.match = h; for (const d of TEAMS[1]) { if (d === m) { [d.x, d.y] = markSpot(1, h.x, h.y); } else { d.x = h.x + dirOf(0) * 20; } d.vx = d.vy = 0; } G.marker = m; }`);
  const du2 = R(`(() => { G.score = [0, 0]; G.receiving = 0; newWind(); startPoint(); for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && !G.pullPending); f++) __tick();
    G.dplay = null; G.oplay = null; const keepAi = Object.assign({}, G.ai); Object.assign(G.ai, { dplay: 'none', def: 'man', force: 'bas', dsys: null });
    const h = TEAMS[0][0]; G.off = 0; Object.assign(h, { x: 50, y: 18, vx: 0, vy: 0 }); holdDisc(h); h.think = 99; setupDefense(1, h); __near(h);
    const c = closedOf(1), mkOk = () => { const m = TEAMS[1][0]; return +((m.y - h.y) * c).toFixed(2); };
    for (let f = 0; f < 90; f++) { h.think = 99; __tick(); } const rest = mkOk();
    h.pivTo = 1; for (let f = 0; f < 45; f++) { h.think = 99; __tick(); } const followBreak = mkOk(), rp = releasePoint(h, h.x, h.y), rel = [rp[1], dirOf(0) * (rp[0] - h.x)];
    h.pivTo = -1; for (let f = 0; f < 45; f++) { h.think = 99; __tick(); } const followOpen = mkOk();
    // une passe côté break lâchée juste à côté de la mark : souvent contrée ; la même côté open : jamais par la mark
    let blkB = 0, blkO = 0;
    for (let k = 0; k < 40; k++) for (const side of [1, -1]) {
      G.phase = 'play'; G.off = 0; Object.assign(h, { x: 50, y: 18, vx: 0, vy: 0 }); holdDisc(h); h.think = 99; setupDefense(1, h); __near(h);
      for (let f = 0; f < 70; f++) { h.think = 99; h.pivTo = side; __tick(); }
      const m = markOf(h); if (!m) continue; const keep = G.stats.blocks + G.stats.ints;
      throwDisc(h, h.x + dirOf(0) * 6, h.y + side * c * 6, 0, 0, 'normal');
      for (let f = 0; f < 30 && disc.mode === 'air'; f++) __tick();
      if (G.stats.blocks + G.stats.ints > keep) { if (side === 1) blkB++; else blkO++; } }
    Object.assign(G.ai, keepAi); return { rest, followBreak, followOpen, relSide: +((rel[0] - h.y) * c).toFixed(2), relBack: +rel[1].toFixed(2), blkB, blkO }; })()`);
  t.ok(du2.followBreak > du2.followOpen + 0.3 && du2.followBreak > du2.rest + 0.2, 'la mark suit le pivot du porteur (côté break : elle ferme ; côté open : elle concède)', du2);
  t.ok(du2.blkB >= 10 && du2.blkO <= 3, 'passe côté break dans la mark : souvent contrée ; côté open : libre', du2);
  t.ok(du2.relSide > 0.5 && du2.relBack < 0, 'pivot côté fermé : sur le côté de la mark et un peu vers l’arrière', du2);

  t.group('Coupe demandée dans sa direction de course');
  const cf = R(`(() => { const c = TEAMS[0][2]; Object.assign(c, { x: 40, y: 15, vx: 7, vy: 0 }); startCut(c, 60, 16, false);
    const st = c.state; Object.assign(c, { x: 40, y: 15, vx: -6, vy: 0 }); startCut(c, 60, 16, false); return { same: st, back: c.state }; })()`);
  t.ok(cf.same === 'cut' && cf.back === 'jab', 'déjà lancé vers la cible : il continue sans s’arrêter (feinte seulement sinon)', cf);

  t.group('Tutoriel : lire le cône (Coach Disco)');
  const tc = R(`(() => {
    const keepH = G.humans, keepS = G.series; G.series = null; G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    const run = chase => {
      tutoStart(); tutoGo(TUTO_STEPS.findIndex(s => s.title === 'Lire le cône')); tutoPlayStep();
      const coach = document.getElementById ? true : true;
      for (let f = 0; f < 60 * 8 && !G.tuto.done; f++) {
        const me = meH().sel;
        const [x, y] = chase && disc.mode === 'air' ? [disc.ex, disc.ey] : [me.x, me.y];   // il court vers l'arrivée (ou reste planté)
        Object.assign(G.pointer, { x, y, last: G.time, active: true, down: true });
        __tick(); tutoFrame(1 / 60);
      }
      const r = { done: G.tuto.done, ok: G.tuto.after === tutoNext, cone: disc.cone > 1, stars: Object.values(G.tuto.stars)[0] || 0 };
      tutoCleanup(); return r;
    };
    const r = { chase: run(true), idle: run(false) };
    G.humans = keepH; G.series = keepS; syncMe();
    return r;
  })()`);
  t.ok(tc.chase.done && tc.chase.ok && tc.chase.stars >= 2, 'courir vers le cercle d’arrivée et toucher le disque réussit le défi (étoiles)', tc);
  t.ok(tc.idle.done && !tc.idle.ok, 'rester planté : le disque tombe, on recommence', tc);

  t.group('Tutoriel : le receveur IA saute pour une passe haute');
  const tjp = R(`(() => {
    const keepH = G.humans, keepS = G.series; G.series = null; G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    tutoStart(); tutoGo(TUTO_STEPS.findIndex(s => s.title === 'La hauteur de passe')); tutoPlayStep();
    __tick(); throwDisc(disc.holder, 52, 18.5, 0, 0.3, 1); let jumped = false;
    for (let f = 0; f < 60 * 5 && !G.tuto.done; f++) { __tick(); tutoFrame(1 / 60); if (TEAMS[0][1].jump > 0 || TEAMS[0][1].jprep > 0) jumped = true; }
    const r = { ok: G.tuto.after === tutoNext, jumped }; tutoCleanup(); G.humans = keepH; G.series = keepS; syncMe(); return r;
  })()`);
  t.ok(tjp.ok && tjp.jumped, 'passe haute par-dessus le mur : le receveur saute et l’attrape', tjp);

  t.group('Tutoriel : plonger en défense');
  const td = R(`(() => {
    const keepH = G.humans, keepS = G.series; G.series = null; G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    tutoStart(); tutoGo(TUTO_STEPS.findIndex(s => s.title === 'Plonger en défense')); tutoPlayStep();
    const msgs = []; let last = '', cue = -1;
    for (let f = 0; f < 60 * 8 && !G.tuto.done; f++) {
      Object.assign(G.pointer, { x: 50.5, y: 20.5, last: G.time, active: true });     // le joueur attend à sa place…
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

  t.group('Rôles selon la position (pas de rôle attitré)');
  const rl = R(`(() => {
    const keepH = G.humans; G.humans = []; G.form.osys = ''; G.ai.osys = '';
    G.off = 0; G.phase = 'play'; G.pickup = null; G.oplay = null;
    const h = TEAMS[0][0]; Object.assign(h, { x: 50, y: 18, vx: 0, vy: 0 });
    [[44, 22], [62, 18], [68, 18], [74, 18]].forEach(([x, y], k) => Object.assign(TEAMS[0][k + 1], { x, y, vx: 0, vy: 0 }));
    holdDisc(h); h.think = 99;
    const first = TEAMS[0].filter(p => p.role === 'dump').map(p => p.i);
    const c = TEAMS[0][3]; Object.assign(c, { x: 40, y: 10, state: 'stack' });             // un coupeur revient loin derrière le disque
    const d0 = TEAMS[0][1]; Object.assign(d0, { x: 58, y: 24, state: 'set' });             // l'ancien relais est remonté
    G.cutT = 0; for (let f = 0; f < 3; f++) { h.think = 99; G.stall = 0; __tick(); }
    const r = { first, cRole: c.role, cIdx: c.hIdx, oldRole: d0.role, order: G.order[0].map(p => p.i) };
    G.humans = keepH; return r;
  })()`);
  t.ok(rl.first.length === 1 && rl.first[0] === 1, 'à la réception : le plus en arrière devient handler', rl);
  t.ok(rl.cRole === 'dump' && rl.oldRole === 'cutter', 'un coupeur revenu derrière le disque devient handler, le handler remonté devient coupeur', rl);

  t.group('Lecture du jeu commune (predict.js)');
  const pr = R(`(() => { const d = TEAMS[1][0]; Object.assign(d, { x: 50, y: 18, vx: 0, vy: 0 }); const r = {
    arms: touchTime(d, 50.5, 18, 1.5, 0.2), high: touchTime(d, 52, 18, 4, 0.2), jumpOnly: touchTime(d, 54, 18, 2.5, 0.2), stand: touchTime(d, 54, 18, 2, 0.2),
    dive: touchTime(d, 53, 18, 1.2, 0), run: reachTime(d, 53, 18, SPD.sprint * aiLvl(1).speed, ARM_R) };
    const a = TEAMS[0][1]; Object.assign(a, { x: 40, y: 18, vx: 0, vy: 0 }); r.recv = recvTime(a, 50, 18); r.guard = guardTime(d, 40, 18);
    return r; })()`);
  t.ok(pr.arms < 0 && pr.high === Infinity, 'disque dans les bras : déjà touché ; trop haut : impossible', pr);
  t.ok(pr.jumpOnly > pr.stand + 0.3, 'seulement en sautant : moins sûr que debout', pr);
  t.ok(pr.dive < pr.run, 'disque bas : le plongeon arrive avant la course', pr);
  t.ok(pr.recv > 1 && pr.recv < 3 && pr.guard > 1, 'courses réalistes (accélération comprise)', pr);

  t.group('Joystick : lâcher pour s’arrêter');
  const js = R(`(() => {
    const keepH = G.humans; G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    G.off = 1; G.phase = 'play'; G.pickup = null; holdDisc(TEAMS[1][0]); TEAMS[1][0].think = 99;
    const me = TEAMS[0][2]; meH().sel = me; Object.assign(me, { x: 30, y: 18, vx: 0, vy: 0 });
    for (let f = 0; f < 60; f++) { Object.assign(G.pointer, { x: me.x + 3.2, y: me.y, active: true, last: G.time }); __tick(); }   // il court vers la droite
    const v0 = me.vx, x0 = me.x; joyBrake(me);                                                   // doigt levé
    let back = false, maxX = x0;
    for (let f = 0; f < 120; f++) { G.pointer.last = G.time; __tick(); if (me.vx < -0.2) back = true; maxX = Math.max(maxX, me.x); }
    const r = { v0, slide: maxX - x0, back, left: Math.hypot(me.vx, me.vy) }; G.humans = keepH; syncMe(); return r;
  })()`);
  t.ok(js.v0 > 4 && !js.back && js.slide < 2.6 && js.left < 0.3, 'il freine et s’arrête, sans revenir sur ses pas', js);

  t.group('Tutoriel : se déplacer');
  const tmv = R(`(() => {
    const keepH = G.humans, keepS = G.series; G.series = null; G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    tutoStart(); tutoGo(TUTO_STEPS.findIndex(s => s.title === 'Se déplacer')); tutoPlayStep();
    const msgs = [], step = G.tuto.step; let last = G.msg, f = 0;
    for (; f < 60 * 20 && G.tuto.step === step; f++) {
      const sp = (G.tuto.spots && G.tuto.spots[0]) || [50, 18];
      Object.assign(G.pointer, { x: sp[0], y: sp[1], last: G.time, active: true });   // le joueur va vers le cercle allumé
      __tick(); tutoFrame(1 / 60);
      if (G.msg !== last) { last = G.msg; msgs.push(last); }
    }
    const r = { msgs, s: f / 60, next: TUTO_STEPS[G.tuto.step] && TUTO_STEPS[G.tuto.step].title };
    tutoCleanup(); G.humans = keepH; G.series = keepS; syncMe();
    return r;
  })()`);
  t.ok(/^1 \/ 3,2 \/ 3,Bien couru !  ★/.test(tmv.msgs.join()) && tmv.next === 'Lancer' && tmv.s < 18, 'les 3 cercles l’un après l’autre, puis l’étape suivante', tmv);

  t.group('Tutoriel : le pied de pivot');
  const tpv = R(`(() => {
    const keepH = G.humans, keepS = G.series; G.series = null; G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    const run = piv => { const out = {};
      for (let k = 0; k < 6; k++) {
        tutoStart(); tutoGo(TUTO_STEPS.findIndex(s => s.title === 'Le pied de pivot')); tutoPlayStep();
        for (let f = 0; f < 30; f++) { __tick(); tutoFrame(1 / 60); }
        if (piv) { pivotBtnDown(); pivotBtnUp(); for (let f = 0; f < 36; f++) { __tick(); tutoFrame(1 / 60); } }   // pivote, attend que le disque soit passé
        doThrow(TEAMS[0][1].x, TEAMS[0][1].y, 0);
        for (let f = 0; f < 300 && !G.tuto.after; f++) { __tick(); tutoFrame(1 / 60); }
        const m = /Bien pivoté/.test(G.msg) ? 'ok' : 'ko'; out[m] = (out[m] || 0) + 1; tutoCleanup();
      }
      return out; };
    const r = { piv: run(true), none: run(false), zone: (() => { tutoStart(); tutoGo(TUTO_STEPS.findIndex(s => s.title === 'Le pied de pivot')); tutoPlayStep(); __tick(); const z = !!markOf(disc.holder) && G.tuto.mark; tutoCleanup(); return z; })() };
    G.humans = keepH; G.series = keepS; syncMe();
    return r;
  })()`);
  t.ok(tpv.zone, 'la mark joue vraiment dans cette étape (zone rouge, elle peut contrer)', tpv);
  t.ok(tpv.piv.ok === 6, 'changer de pied puis lancer côté fermé : la passe contourne la mark', tpv);
  t.ok(!tpv.none.ok, 'sans changer de pied : pas validé (contré, ou « change de pied »)', tpv);

  t.group('Tutoriel : contrer une passe haute');
  const tj = R(`(() => {
    const keepH = G.humans, keepS = G.series; G.series = null; G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    tutoStart(); tutoGo(TUTO_STEPS.findIndex(s => s.title === 'Blocker une passe haute')); tutoPlayStep();
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
  const ir = R(`(() => {                                       // sans hasard : dans le corps = interception, du bout des bras = block
    const keep = [interception, turnover, msTurnover]; let n = 0;
    interception = () => n++; turnover = () => {}; msTurnover = () => {};
    disc.x = W / 2; disc.y = H / 2; const d = TEAMS[1][0]; d.dive = 0; d.jump = 0;
    const r = {};
    n = 0; defStop(d, 'Block', 0.3); r.body = n;
    n = 0; defStop(d, 'Block', 0.8); r.arms = n;
    n = 0; for (let k = 0; k < 50; k++) defStop(d, 'Block', 0.3); r.same = n;
    [interception, turnover, msTurnover] = keep;
    // et le contre lui-même : un disque à portée est toujours contré (50 passes identiques → 50 blocks)
    return r;
  })()`);
  const dt2 = R(`(() => {                                      // la même passe, droit sur un défenseur posé sur la ligne : toujours contrée
    let stops = 0, n = 0;
    for (let k = 0; k < 12; k++) {
      G.score = [0, 0]; G.receiving = 0; newWind(); G.wind = { x: 0, y: 0, kmh: 0 }; startPoint();
      for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && !G.pullPending && disc.holder.team === 0); f++) __tick();
      if (G.phase !== 'play') continue;
      const h = disc.holder, dir = dirOf(0), r = TEAMS[0].find(p => p !== h), d = TEAMS[1][1];
      TEAMS[0].forEach(q => { if (q !== h && q !== r) { q.x = 40 - dir * 12; q.y = 3 + q.i * 7; } });   // les autres attaquants loin de la passe
      h.x = 40; h.y = 18; r.x = 40 + dir * 14; r.y = 18; d.x = 40 + dir * 7; d.y = 18.3; h.pivY = 0; h.pivTo = 0;
      TEAMS[1].forEach(q => { if (q !== d) { q.x = 40 - dir * 15; q.y = 3 + q.i * 7; } q.vx = q.vy = 0; q.think = 99; q.react = 99; q.dive = q.down = q.jump = q.jprep = 0; });   // (personne au sol après un plongeon)
      d.react = 99; holdDisc(h); G.marker = null; TEAMS[1].forEach(q => { q.tx = q.x; q.ty = q.y; });   // (ils restent sur place)
      const before = G.stats.blocks + G.stats.ints;
      throwDisc(h, r.x, r.y, 0, 0, 0.0); n++;
      for (let f = 0; f < 300 && disc.mode === 'air'; f++) { TEAMS[1].forEach(q => { q.react = 99; q.tx = q.x; q.ty = q.y; q.vx = q.vy = 0; }); __tick(); }
      if (G.stats.blocks + G.stats.ints > before) stops++;
    }
    return { stops, n };
  })()`);
  t.ok(dt2.n >= 8 && dt2.stops === dt2.n, 'la même passe sur un défenseur à portée est contrée à chaque fois', dt2);
  t.ok(ir.body === 1 && ir.arms === 0 && ir.same === 50, 'pas de hasard : disque dans le corps = interception, du bout des bras = block, toujours pareil', ir);

  t.group('Callahan : un arrêt dans l’en-but adverse est toujours une interception qui marque');
  const cal = R(`(() => {
    let ok = 0, fx = null;
    for (let k = 0; k < 20; k++) {
      G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
      for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held'); f++) __tick();
      const d = 1 - G.off, p = TEAMS[d][0];
      let x = 0; while (x < W && !inScoreZone(d, x)) x += 1;
      x += 3; disc.x = x; disc.y = H / 2; p.x = x; p.y = H / 2;
      const before = G.score[d]; FX.parts.length = 0;
      defStop(p, 'Contre');
      if (G.score[d] === before + 1) ok++;
      if (k === 0) fx = { stars: FX.parts.filter(q => q.kind === 'star').length, rings: FX.parts.filter(q => q.kind === 'ring' && q.color === '#facc15').length, msg: G.msg };
    }
    return { ok, fx };
  })()`);
  t.ok(cal.ok === 20, 'Callahan à chaque fois (20 essais)', cal.ok);
  t.ok(cal.fx.stars >= 30 && cal.fx.rings >= 3 && /CALLAHAN/.test(cal.fx.msg), 'un Callahan se fête en grand : ondes dorées, pluie d’étoiles, « 🦅 CALLAHAN ! »', cal.fx);

  t.group('Individuelle : un attaquant parti au fond, dans le dos de son défenseur, est rattrapé');
  const deepR = R(`(() => {
    const keepAi = G.ai.def; G.ai.def = 'man';
    const out = [];
    for (let k = 0; k < 20 && out.length < 4; k++) {           // 4 essais valides (parfois l'attaque perd le disque avant)
      G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
      for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && !G.pullPending && disc.holder.team === 0); f++) __tick();
      if (G.phase !== 'play' || disc.holder.team !== 0) continue;
      const h = disc.holder, dir = dirOf(0), a = TEAMS[0].find(p => p !== h), d = TEAMS[1].find(q => q.match === a);
      if (!d) continue;
      const gx = dir > 0 ? W - 6 : 6;                            // il file au fond de l'en-but adverse
      a.x = clamp(h.x + dir * 6, 1, W - 1); a.y = 6 + (k % 6) * 4; d.x = a.x - dir * 1.5; d.y = a.y;
      for (let f = 0; f < 60 * 12; f++) {                       // il court ~7 s puis attend au fond : 5 s pour que son défenseur arrive
        h.think = 99; G.stall = 0;
        const y0 = a.y, nx = Math.abs(gx - a.x) < 0.2 ? gx : a.x + dir * 7.6 / 60;   // il court à 7,6 m/s (vitesse d'un cut), puis s'arrête au fond
        __tick();
        a.x = nx; a.y = y0; a.vx = nx === gx ? 0 : dir * 7.6; a.vy = 0; a.tx = gx; a.ty = y0;
        if (G.phase !== 'play' || disc.mode !== 'held') break;
      }
      if (G.phase !== 'play' || disc.mode !== 'held' || disc.holder !== h) continue;   // le jeu a bougé entre-temps : essai non valable
      out.push(+nearestD(TEAMS[1], a.x, a.y)[1].toFixed(1));   // un défenseur est revenu sur lui (le sien, ou celui qui a échangé)
    }
    G.ai.def = keepAi; G.receiving = 0;
    return out;
  })()`);
  t.ok(deepR.length >= 3 && deepR.filter(x => x < 4).length >= deepR.length * 0.75, 'un défenseur le voit (coups d’œil vers son joueur) et sprinte pour revenir sur lui', deepR);

  t.group('Vent : il change la hauteur du vol, et pousse de plus en plus');
  const wv = R(`(() => {
    const keep = G.wind; G.wind = { x: 8, y: 0, kmh: 29 };          // vent fort vers la droite
    const z = (sx, ex) => { const wa = windAlong(sx, 18, ex, 18); return { wa: +wa.toFixed(1), mid: +heightAt(0.5, 3, 0.3, 30, 0, wa).toFixed(2), end: +heightAt(1, 3, 0.3, 30, 0, wa).toFixed(2), start: +heightAt(0, 3, 0.3, 30, 0, wa).toFixed(2), late: +heightAt(0.85, 3, 0.3, 30, 0, wa).toFixed(2) }; };
    const calm = (() => { G.wind = { x: 0, y: 0, kmh: 0 }; const r = z(30, 60); G.wind = { x: 8, y: 0, kmh: 29 }; return r; })();
    const r = { head: z(60, 30), tail: z(30, 60), calm };
    // poussée progressive : au milieu du vol, le disque n'a pris qu'environ un quart de sa dérive (elle croît comme le carré du temps)
    const [mx] = bez(0, 0, 15, 0, 30, 0, 0.5), [nx] = bez(0, 0, 15, 0, 30 + 4, 0, 0.5); r.midDrift = +((nx - mx) / 4).toFixed(2);
    G.wind = keep; return r;
  })()`);
  t.ok(wv.head.mid > wv.calm.mid * 1.15 && wv.tail.mid < wv.calm.mid * 0.85, 'vent de face : le disque monte et plane ; vent de dos : il reste plus bas', wv);
  t.ok(wv.tail.late < wv.calm.late && Math.abs(wv.head.start - wv.calm.start) < 0.01 && Math.abs(wv.tail.end - wv.calm.end) < 0.01, 'les deux bouts du vol ne bougent pas (lâcher, réception) ; de dos il retombe plus tôt', wv);
  t.ok(wv.midDrift > 0.3 && wv.midDrift < 0.6, 'la dérive du vent arrive surtout en fin de vol (le disque ralentit)', wv);

  t.group('IA : pas de passe vers un souvenir');
  const ghost = R(`(() => {
    const oT = throwDisc; let n = 0, far = [];
    throwDisc = function (h) { const r = oT.apply(this, arguments); if (disc.mode === 'air' && !disc.pull) { n++;
      const nm = Math.min(...TEAMS[h.team].filter(q => q !== h).map(q => dist(q.x, q.y, disc.rx, disc.ry))); if (nm > 26) far.push(Math.round(nm)); } return r; };
    for (let k = 0; k < 12; k++) __playPoint();
    throwDisc = oT; return { n, far };
  })()`);
  t.ok(ghost.n > 40 && ghost.far.length === 0, 'aucune passe visée à plus de 26 m de tous les coéquipiers (coéquipier pas vu depuis longtemps)', ghost);
  t.group('Retours de playtest : célébration, vitesse des passes, réception');
  const pt = R(`(() => {
    FX.parts.length = 0; fxPlay('score', 80, 18, 0);
    const xs = FX.parts.filter(q => q.kind === 'confetti').map(q => q.x);
    const p = TEAMS[0][1]; holdDisc(p); const think = p.think;
    return { spread: Math.max(...xs) - Math.min(...xs), n: xs.length, think, f5: flightTime(5), f30: flightTime(30), v5: 5 / flightTime(5), v30: 30 / flightTime(30) };
  })()`);
  t.ok(pt.n > 50 && pt.spread > 70, 'un point se fête sur tout le terrain (plus de « mauvais côté »)', pt);
  t.ok(pt.v5 < 6 && pt.v30 > pt.v5 * 2, 'une passe courte est douce, la vitesse grandit avec la distance', pt);
  t.ok(pt.think >= 0.45, 'après une réception, le porteur IA prend un instant avant de relancer', pt);
  const fd = R(`(() => { const p = TEAMS[0][1]; p.x = 50; p.y = 18; Object.assign(disc, { sx: 20, sy: 18, ex: 50, ey: 18, x: 50, y: 18, z: 1.2, loft: 0.3, pull: false });
    TEAMS[1].forEach(d => { d.x = 10; d.y = 2; }); G.wind = { x: 0, y: 0, kmh: 0 };
    disc.dur = flightTime(30); const slow = catchOdds(p); disc.dur = flightTime(30) * 0.55; const fast = catchOdds(p); return { slow, fast }; })()`);
  t.ok(fd.fast > fd.slow + 0.02, 'une passe trop rapide se droppe plus souvent', fd);

  t.group('À plusieurs : le dernier porteur reprend le disque attrapé par l’IA');
  const tk = R(`(() => {
    const keepH = G.humans, keepTake = G.form.take, out = {};
    for (const take of ['oui', 'non']) {
      G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
      for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && !G.pullPending); f++) __tick();
      const A0 = TEAMS[0][0], B0 = TEAMS[0][1], C = TEAMS[0][3];
      G.humans = [{ id: 0, team: 0, sel: A0 }, { id: 5, team: 0, sel: B0, name: 'Léa' }]; G.myId = 0; G.form.take = take; G.off = 0;
      holdDisc(A0); throwDisc(A0, A0.x + dirOf(0) * 8, A0.y, 0, 0, 0.3);   // A (humain 0) lance…
      holdDisc(C);                                                       // … un coéquipier IA attrape
      out[take] = { aHasC: G.humans[0].sel === C, bSame: G.humans[1].sel === B0 };
    }
    G.humans = keepH; G.form.take = keepTake; G.myId = 0; syncMe(); G.lastHumanHolder = {};
    return out;
  })()`);
  t.ok(tk.oui.aHasC && tk.oui.bSame, 'activé : l’humain qui vient de lancer prend le contrôle du coéquipier IA qui attrape', tk);
  t.ok(!tk.non.aHasC, 'désactivé (« L’IA le garde ») : le coéquipier IA garde le disque', tk);

  t.group('Départ pour tous : le pull d’un humain attend le compte à rebours, ses coéquipiers prennent le départ');
  const hp = R(`(() => {
    const keepH = G.humans; G.score = [0, 0]; G.receiving = 1; newWind();
    G.humans = [{ id: 0, team: 0, sel: null }, { id: 5, team: 0, sel: null, name: 'Léa' }]; G.myId = 0; syncMe();
    G.form.puller = 'cap'; startPoint();
    for (let f = 0; f < 6000 && !(G.phase === 'pull' && pullReady()); f++) pullTick(1 / 60, 1 / 60);
    G.pull.by = 0; const r = {};
    requestPull(70, 18, 0, 0.88); r.waits = G.phase === 'pull' && !!G.pull.pend;      // le pull ne part pas tout de suite
    for (let f = 0; f < 150 && !(G.pull && lightsOn(G.pull.cd) >= 2); f++) pullTick(1 / 60, 1 / 60);
    r.pullerPress = startPress(G.humans[0]); r.offAfterPuller = !!G.offside;            // le pulleur, lui, ne prend pas le départ
    r.matePress = startPress(G.humans[1]); r.off = G.offside && G.offside.team;          // son coéquipier part trop tôt : offside
    const guilty = TEAMS[0].filter(q => q !== disc.holder).sort((a, b) => Math.abs(b.tx - b.x) - Math.abs(a.tx - a.x))[0];
    r.runs = Math.abs(guilty.tx - guilty.x) > 4; r.fx = !!G.offFx;
    for (let f = 0; f < 200 && G.phase === 'pull'; f++) pullTick(1 / 60, 1 / 60);
    r.launched = disc.mode === 'air' && disc.pull;
    G.humans = keepH; G.myId = 0; syncMe(); G.offside = null; G.offFx = null; G.receiving = 0;
    return r;
  })()`);
  t.ok(hp.waits && hp.launched, 'le pull d’un humain part au « PULL ! » du compte à rebours', hp);
  t.ok(hp.pullerPress === false && !hp.offAfterPuller && hp.matePress && hp.off === 0, 'ses coéquipiers prennent le départ (trop tôt = offside), pas le pulleur', hp);
  t.ok(hp.runs && hp.fx, 'le fautif part trop tôt de quelques mètres, et le signe « offside » s’affiche', hp);

  t.group('Appel de cut : désigner le coéquipier qui partira');
  const pk = R(`(() => {
    G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
    for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && !G.pullPending && disc.holder.team === 0); f++) __tick();
    const h = G.humans[0] || { id: 0, team: 0, sel: null }, d = disc.holder, dir = dirOf(0);
    const mates = TEAMS[0].filter(p => p !== d), A = mates[0], B = mates[1];
    mates.slice(2).forEach((q, k) => { q.x = d.x - dir * 3; q.y = 14 + k * 4; });   // les autres : loin des points d'appel
    A.x = d.x - dir * 8; A.y = 6; B.x = d.x + dir * 10; B.y = 30; A.callT = 0; B.callT = 0;   // A loin du point visé, B tout près
    callFor(h, A.x + 0.5, A.y);                                  // appel sur A : il est désigné
    const picked = h.callPick === A;
    callFor(h, B.x + 2, B.y);                                    // appel dans l'espace, près de B : c'est quand même A qui part
    const r = { picked, aCut: A.callT > 0, bCut: B.callT > 0, cleared: !h.callPick };
    callFor(h, A.x, A.y); callFor(h, A.x, A.y); r.toggled = !h.callPick;   // deux fois sur lui : il n'est plus désigné
    return r;
  })()`);
  t.ok(pk.picked && pk.aCut && !pk.bCut && pk.cleared, 'appel sur un coéquipier : il est désigné, et c’est lui qui fait le cut suivant (pas le plus proche)', pk);
  t.ok(pk.toggled, 'un 2e appel sur lui annule la désignation', pk);

  t.group('Receveur seul : il laisse venir le disque pour gagner du terrain');
  const lc = R(`(() => {
    const out = [];
    for (const alone of [true, false]) {
      G.score = [0, 0]; G.receiving = 0; newWind(); G.wind = { x: 0, y: 0, kmh: 0 }; startPoint();
      for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && !G.pullPending && disc.holder.team === 0); f++) __tick();
      const h = disc.holder, dir = dirOf(0), r = TEAMS[0].find(p => p !== h);
      h.x = 40; h.y = 18; if (dir < 0) h.x = 60;
      r.x = h.x + dir * 22; r.y = 18; r.vx = dir * 6; r.vy = 0;
      TEAMS[1].forEach((d, k) => { d.x = alone ? h.x - dir * 15 : r.x + dir * 2; d.y = alone ? 4 + k * 7 : 18 + (k - 2) * 0.8; d.vx = d.vy = 0; });
      visReset();
      holdDisc(h); throwDisc(h, h.x + dir * 36, 18, 0, 0, 0.3); disc.intended = r;
      const L = runPoint(r), E = (() => { const keep = LATE.GAIN; LATE.GAIN = 1e9; const e = runPoint(r); LATE.GAIN = keep; return e; })();
      out.push({ alone, late: +L[0].toFixed(1), early: +E[0].toFixed(1), gain: +(dir * (L[0] - E[0])).toFixed(1) });
    }
    return out;
  })()`);
  t.ok(lc[0].gain >= 3, 'personne autour : il attrape plus loin (le plus tard possible) au lieu de s’arrêter au plus tôt', lc);
  t.ok(lc[1].gain === 0, 'un défenseur peut disputer le disque : il l’attaque au plus tôt, comme avant', lc);

  t.group('Pull sorti : brick seulement s’il fait gagner du terrain (WFDF 7.12), hors-jeu (7.5.2)');
  const po = R(`(() => {
    const out = [];
    for (const r of [0, 1]) {
      G.receiving = r; G.offside = null; const d = dirOf(r), gl = goalLine(r), b = brickX(r);
      const deep = pullOutChoice(gl + d * 40, -1), short = pullOutChoice(gl + d * 6, H + 1), ez = pullOutChoice(gl - d * 5, -1);
      out.push({ r, deep: deep.brick ? 'brick' : +deep.spot.x.toFixed(1), want: gl + d * 40, short: short.brick, ez: ez.brick, ezx: ez.spot.x, b });
    }
    G.receiving = 0; G.offside = { team: 1 }; const off = offsideSpot(); G.offside = null;
    return { out, off, brick0: brickX(0) };
  })()`);
  t.ok(po.out.every(o => o.deep === o.want), 'pull sorti loin chez l’adversaire : repris là où il est sorti (pas de brick qui fait reculer)', po.out);
  t.ok(po.out.every(o => o.short && o.ez && o.ezx === o.b), 'pull sorti près de son en-but (ou dedans) : brick', po.out);
  t.ok(po.off.x === po.brick0 && po.off.y > 18 && po.off.y < 19, 'hors-jeu de l’équipe qui pulle : brick', po);
  const pl = R(`(() => {                                      // hors-jeu de l'équipe qui pulle : personne n'attrape le pull
    let caught = 0, n = 0;
    for (let k = 0; k < 6; k++) {
      G.score = [0, 0]; G.receiving = k % 2; newWind(); startPoint();
      for (let f = 0; f < 6000 && G.phase !== 'pull'; f++) __tick();
      for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.pull); f++) { if (G.phase === 'pull' && !G.offside) G.offside = { team: 1 - G.receiving }; __tick(); }
      for (let f = 0; f < 6000 && disc.mode === 'air'; f++) __tick();
      n++; if (disc.mode !== 'ground') caught++;                // il est par terre (personne ne l'a attrapé), en attente d'être ramassé
    }
    const res = { caught, n, mode: disc.mode, carry: G.carryTo, brick: brickX(G.receiving) };
    G.offside = null; G.receiving = 0; return res;
  })()`);
  t.ok(pl.caught === 0 && pl.carry && Math.abs(pl.carry.x - pl.brick) < 0.6, 'hors-jeu de l’équipe qui pulle : le pull n’est pas attrapé, le disque repart du brick', pl);

  t.group('Écran de fin : stats par équipe, par humain, moment du match');
  const es = R(`(() => {
    const humans0 = G.humans; newMatchStats(); G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
    for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held'); f++) __tick();
    for (let f = 0; f < 600; f++) __tick();
    const pos = G.ms.team[0].pos + G.ms.team[1].pos;
    // deux humains dans la même équipe : chacun sa ligne (lanceur, receveur qui marque, défenseur)
    const A = TEAMS[0][0], B = TEAMS[0][1], D = TEAMS[1][2];
    G.humans = [{ id: 0, team: 0, sel: A, name: 'Théo' }, { id: 4, team: 0, sel: B, name: 'Léa' }, { id: 7, team: 1, sel: D, name: 'Max' }];
    G.off = 0; disc.mode = 'held'; disc.holder = A; msThrow(A, 40, 'normal');
    Object.assign(disc, { thrower: A, sx: 10, sy: 10, pull: false }); B.x = 50; B.y = 10; B.dive = 0.2;
    msCatch(B, true);
    disc.thH = 0; msTurnover(A, 'block', D);
    const sum = matchSummary(); G.humans = humans0; B.dive = 0;
    return { pos, hu: sum.hu, mom: sum.mom, pl: 'pl' in sum, team: sum.team[0] };
  })()`);
  const hu = id => es.hu.find(o => o.id === id) || {};
  t.ok(es.pos > 5, 'temps de possession compté pendant le jeu', es.pos);
  t.ok(hu(0).thr === 1 && hu(0).comp === 1 && hu(0).ast === 1 && hu(0).to === 1 && hu(4).gol === 1 && hu(7).blk === 1 && hu(0).n === 'Théo',
    'chaque humain a sa ligne : passe décisive, point, block, perte', es.hu);
  t.ok(es.mom && es.mom.k === 'layout' && /Léa/.test(es.mom.txt) && /Théo/.test(es.mom.txt) && /40 m/.test(es.mom.txt), 'moment du match : le point en plongeon, avec les pseudos', es.mom);
  t.ok(!es.pl, 'plus de stats par joueur IA dans le résumé', es.pl);
  const eca = R(`(() => { newMatchStats(); G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
    for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held'); f++) __tick();
    const d = 1 - G.off, p = TEAMS[d][0]; let x = 0; while (x < W && !inScoreZone(d, x)) x += 1;
    x += 3; disc.x = x; disc.y = H / 2; p.x = x; p.y = H / 2; interception(p); return matchSummary().mom; })()`);
  t.ok(eca && eca.k === 'callahan', 'un Callahan devient le moment du match', eca);

  t.group('Mode infini');
  const lv = R(`[0, 0.5, 1, 2, 4, 6, 9, 11, 14, 20].map(d => endlessLevel(d))`);
  let mono = true;
  for (let i = 1; i < lv.length; i++) if (!(lv[i].react <= lv[i - 1].react && lv[i].block >= lv[i - 1].block && lv[i].err <= lv[i - 1].err)) mono = false;
  t.ok(mono, 'la difficulté ne baisse jamais (réaction, contres, précision)');
  t.ok(lv[0].react === R('AI_LEVELS.facile.react') && lv[2].react === R('AI_LEVELS.normal.react') && lv[4].react === R('AI_LEVELS.difficile.react'), 'facile au 1er match, normal au 2e, difficile (Titans) au 5e');
  t.ok(lv[6].react < lv[4].react && lv[8].react < lv[6].react && lv[9].react < lv[8].react && lv[9].err < lv[8].err, 'continue de monter après difficile, et encore après le 15e match');
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

  t.group('Changement de côté après un point');
  const sd = R(`(() => {
    G.score = [0, 0]; const a = [dirOf(0), goalLine(0), inScoreZone(0, 95)];
    G.score = [1, 0]; const b = [dirOf(0), dirOf(1), goalLine(0), goalLine(1), inScoreZone(0, 5), inScoreZone(1, 95)];
    G.receiving = 1; placeOnPullLines(); const blue = TEAMS[0].every(p => p.x > W / 2), red = TEAMS[1].every(p => p.x < W / 2);
    G.score = [0, 0]; return { a, b, blue, red };
  })()`);
  t.ok(sd.a[0] === 1 && sd.a[1] === 18 && sd.a[2], '1er point : les Bleus attaquent vers la droite', sd);
  t.ok(sd.b[0] === -1 && sd.b[1] === 1 && sd.b[2] === 82 && sd.b[3] === 18 && sd.b[4] && sd.b[5], 'après le point des Bleus, chacun change de sens', sd);
  t.ok(sd.blue && sd.red, 'les Bleus (qui ont marqué à droite) restent à droite pour puller, les Rouges vont à gauche', sd);

  t.group('Cône d’incertitude : chacun devine l’arrivée selon sa lecture du jeu');
  const cn = R(`(() => {
    G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
    for (let f = 0; f < 3000 && !(G.phase === 'play' && disc.mode === 'held' && disc.holder && !disc.pull); f++) __tick();
    const h = disc.holder.team === 0 ? disc.holder : TEAMS[0][0], out = { n: 0, facile: 0, difficile: 0, cone: 0, end: 0, seenStart: 0 };   // lanceur des Bleus : la défense est l'IA réglée par le niveau
    G.off = 0;
    for (let k = 0; k < 40; k++) {
      for (const lv of ['facile', 'difficile']) {
        G.form.level = lv; holdDisc(h); throwDisc(h, h.x + dirOf(h.team) * 25, h.y, 0, 1, 0.3);
        out.cone += disc.cone;
        const o = TEAMS[1 - h.team].filter(p => p.guess);
        out[lv] += o.reduce((s, p) => s + Math.hypot(p.guess[0], p.guess[1]), 0) / o.length / disc.cone;
        const q = o[0], [x0, y0] = seenAt(q, 0);
        out.seenStart = Math.max(out.seenStart, dist(x0, y0, disc.sx, disc.sy));
        disc.t = disc.dur; const [x1, y1] = seenEnd(q); out.end = Math.max(out.end, dist(x1, y1, disc.ex, disc.ey));
        out.n++;
      }
    }
    G.form.level = 'normal';
    return { cone: out.cone / out.n, facile: out.facile / 40, difficile: out.difficile / 40, end: out.end, start: out.seenStart };
  })()`);
  t.ok(cn.cone > 1.5 && cn.cone < 4, 'passe de 25 m : cercle d’arrivée de quelques mètres au lâcher', cn);
  t.ok(cn.facile > cn.difficile * 1.6, 'une IA facile lit l’arrivée bien moins bien qu’une difficile', cn);
  t.ok(cn.end < 1e-6 && cn.start < 1e-6, 'l’erreur fond : nulle au départ du disque et à son arrivée', cn);

  t.group('Vision limitée des IA : coups d’œil et mémoire');
  const vi = R(`(() => {
    G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
    const h = TEAMS[0][0], q = TEAMS[1][3];
    h.x = 50; h.y = 18; q.x = 30; q.y = 18; q.vx = 0; q.vy = 0;              // q est derrière le porteur (qui regarde vers la droite)
    holdDisc(h); visReset(); h.scanI = 0;
    q.x = 32; q.vx = 3;                                                     // q bouge sans être vu
    G.gt += 0.5; glance(h);                                                 // coup d'œil devant : q n'est pas dans le champ
    const behind = seen(h, q), staleX = behind.x, isGhost = behind !== q && behind.src === q;
    const r = TEAMS[1][4]; r.x = 70; r.y = 18; G.gt += 0.1; h.scanI = 0; glance(h);       // devant lui : vu tout de suite
    const front = seen(h, r);
    return { staleX, isGhost, front: Math.abs(front.x - 70) < 1e-6,
      look: [AI_LEVELS.facile.look, AI_LEVELS.normal.look, AI_LEVELS.difficile.look], ext: [AI_LEVELS.facile.ext, AI_LEVELS.difficile.ext] };
  })()`);
  t.ok(vi.isGhost && vi.staleX < 31.5, 'un joueur hors de son champ de vision : il le croit encore à sa dernière position vue', vi);
  t.ok(vi.front, 'un joueur dans son champ : position à jour au coup d’œil', vi);
  t.ok(vi.look[0] > vi.look[1] && vi.look[1] > vi.look[2] && vi.ext[0] < vi.ext[1], 'facile : coups d’œil plus rares et moins d’anticipation que difficile', vi);

  t.group('Porteur jamais laissé sans mark');
  const um = R(`(() => {
    const _a = aiThrow, out = [];
    aiThrow = function (h, ...r) { if (h.team === 0) return; return _a(h, ...r); };   // le porteur garde le disque
    for (let k = 0; k < 12; k++) {
      G.score = [0, 0]; G.receiving = 0; G.form.def = 'man'; newWind(); startPoint();
      G.phase = 'play'; G.off = 0; const h = TEAMS[0][0]; h.x = 50; h.y = 18; holdDisc(h);
      const wrong = () => { for (const d of TEAMS[1]) d.match = TEAMS[0][1 + (d.i % 4)]; };   // personne n'est attribué au porteur
      for (const d of TEAMS[1]) { d.x = 20; d.y = 5 + d.i * 6; }
      let first = -1; for (let f = 0; f < 60 * 8 && G.phase === 'play'; f++) { wrong(); G.dplay = null; __tick(); if (first < 0 && G.stall > 0) first = +(f / 60).toFixed(1); }
      out.push(first);
    }
    aiThrow = _a;
    return out;
  })()`);
  t.ok(um.every(x => x >= 0 && x < 6), 'défenseurs tous pris ailleurs : le plus proche vient marquer (le compte démarre en moins de 6 s)', um);

  t.group('Retours visuels légers');
  const fxr = R(`(() => {
    G.score = [0, 0]; G.receiving = 0; newWind(); startPoint(); G.phase = 'play'; FX.parts.length = 0;
    const p = TEAMS[0][1], rnd = Math.random; Math.random = () => 0.99; catchDisc(p); Math.random = rnd;   // pas de drop au hasard
    const pop = FX.parts.some(q => q.kind === 'pop'), ring = FX.parts.some(q => q.kind === 'ring');
    for (let i = 0; i < 30; i++) fxUpdate(1 / 60);
    return { pop, ring, gone: !FX.parts.some(q => q.kind === 'pop') };
  })()`);
  t.ok(fxr.pop && fxr.ring && fxr.gone, 'une réception : petit rond blanc + onde, effacés en moins d’une demi-seconde', fxr);

  t.group('Pull : le receveur le rattrape, les autres se placent là où le jeu reprendra');
  const pullCk = R(`(() => { let caught = 0, landedIn = 0, ezOk = 0, ez = 0;
    const _pc = pullCaught; pullCaught = function () { caught++; return _pc.apply(this, arguments); };
    const _pl = pullLanded; pullLanded = function (ex, ey) { if (inField(ex, ey)) landedIn++; return _pl.apply(this, arguments); };
    for (let k = 0; k < 30; k++) {
      G.score = [k % 2, 0]; G.receiving = k % 2; newWind(); startPoint(); let f = 0; while (G.phase === 'pull' && f < 4000) { __tick(); f++; }
      const L = disc.mode === 'air' ? lineSpot(disc.ex, disc.ey) : null, r = G.receiving;
      for (let i = 0; i < 400 && disc.mode === 'air'; i++) __tick();
      if (L) { ez++; const o = TEAMS[r].filter(p => p !== disc.holder && p !== disc.intended), mx = o.reduce((a, p) => a + p.x, 0) / o.length; if (dirOf(r) * (mx - L.x) > 3) ezOk++; }
    }
    pullCaught = _pc; pullLanded = _pl;
    return { caught, landedIn, ez, ezOk };
  })()`);
  t.ok(pullCk.caught >= 0.8 * (pullCk.caught + pullCk.landedIn), 'les pulls dans le terrain sont presque tous rattrapés (le receveur ne court plus sous un disque hors de portée)', pullCk);
  t.ok(pullCk.ezOk === pullCk.ez, 'pull dans l’en-but : les coéquipiers se placent devant la ligne, là où le jeu reprendra', pullCk);
}
