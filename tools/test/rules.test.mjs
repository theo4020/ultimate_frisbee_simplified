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
  t.ok(r.comp > 0.75 && r.comp < 0.97, 'taux de passes réussies réaliste (75–97 %)', +r.comp.toFixed(2));
  t.ok(r.to > 0.5 && r.to < 3, 'turnovers par point réalistes (0,5–3)', +r.to.toFixed(2));
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
    G.stats.preCatch = 0;
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
    for (let k = 0; k < 4; k++) {
      G.score = [0, 0]; G.receiving = k % 2; newWind(); startPoint();
      for (let f = 0; f < 20000 && (G.phase === 'play' || G.phase === 'pull'); f++) { __tick();
        if (G.phase !== 'play' || disc.mode !== 'held' || !disc.holder || G.holdT < 1.5) continue;   // 1,5 s après la réception
        const h = disc.holder, d = TEAMS[h.team].find(p => p.role === 'dump'); if (!d) continue;
        n++; if (dist(d.x, d.y, h.x, h.y) < 3) close++; }
    }
    return { n, close };
  })()`);
  t.ok(dp.n > 100 && dp.close / dp.n < 0.01, '1,5 s après la réception, le relais est (presque) toujours à plus de 3 m', dp);

  t.group('Niveaux : mêmes idées, stats et choix de passe différents');
  const lvq = R(`(() => { const keys = o => Object.keys(o).sort().join(); const L = [AI_LEVELS.facile, AI_LEVELS.normal, AI_LEVELS.difficile, LEGEND, SUPER, endlessLevel(20)];
    return { same: L.every(o => keys(o) === keys(AI_LEVELS.normal)), greed: L.map(o => o.greed), hands: L.map(o => o.hands) }; })()`);
  t.ok(lvq.same, 'tous les niveaux (mode infini compris) ont les mêmes réglages', lvq);
  t.ok(lvq.greed.every((g, i) => i === 0 || g <= lvq.greed[i - 1]) && lvq.greed[0] > lvq.greed[1], 'le débutant prend plus de risques dans ses passes', lvq.greed);
  t.ok(lvq.hands.every((g, i) => i === 0 || g <= lvq.hands[i - 1]), 'et droppe plus souvent', lvq.hands);

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
  t.ok(far.react >= 0.2 && far.block <= 0.97 && far.speed <= 1.3 && far.err >= 0.1, 'même très loin, les réglages restent dans des limites possibles', far);
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
