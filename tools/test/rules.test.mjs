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
      blocks: s.blocks, ints: s.ints, phase: G.phase };
  })()`);
  t.ok(r.stuck === 0, 'aucun point bloqué', r);
  t.ok(r.phase === 'over', 'les matchs vont au bout', r.phase);
  t.ok(r.comp > 0.75 && r.comp < 0.97, 'taux de passes réussies réaliste (75–97 %)', +r.comp.toFixed(2));
  t.ok(r.to > 0.5 && r.to < 3, 'turnovers par point réalistes (0,5–3)', +r.to.toFixed(2));
  t.ok(r.sec > 8 && r.sec < 150, 'durée d’un point raisonnable', +r.sec.toFixed(0));
  t.ok(r.blocks + r.ints > 0, 'la défense arrête des passes', r);

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
  const lv = R(`[0, 1, 2, 3, 5, 7, 10, 14, 20].map(d => endlessLevel(d))`);
  let mono = true;
  for (let i = 1; i < lv.length; i++) if (!(lv[i].react <= lv[i - 1].react && lv[i].block >= lv[i - 1].block && lv[i].err <= lv[i - 1].err)) mono = false;
  t.ok(mono, 'la difficulté ne baisse jamais (réaction, contres, précision)');
  t.ok(lv[0].react === R('AI_LEVELS.facile.react') && lv[5].react === R('AI_LEVELS.difficile.react'), 'commence en facile, passe par difficile au 8e match');
  t.ok(lv[8].react < lv[5].react, 'continue de monter après difficile');
  R('showMenu = () => {}; showEndless = () => {};');            // pas d'écran ici
  const e = R(`(() => {
    G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    G.series = { endless: true, cur: 0, opp: endlessOpp(0), pts: ENDLESS_PTS, wins: 0, diff: 0 };
    newMatch();
    const pts = winPts(), lv0 = aiLvl(1).react;
    G.score = [2, 2]; const lvMid = aiLvl(1).react;              // la difficulté monte aussi pendant le match
    G.score = [3, 1]; onMatchOver();
    const afterWin = { wins: G.series.wins, diff: G.series.diff, done: !!G.series.done };
    endlessNext();
    const second = { cur: G.series.cur, name: G.series.opp.name, score: G.score.slice() };
    G.score = [2, 3]; onMatchOver();
    const loc = endlessLocal();
    return { pts, lv0, lvMid, afterWin, second, done: G.series.done, wins: G.series.wins, diff: G.series.diff, best: loc.best, runs: loc.runs.length,
      names: new Set(Array.from({ length: 18 }, (_, i) => endlessOpp(i).name)).size, team: (computeTeams(), tn(1)) };
  })()`);
  t.ok(e.pts === 3, 'matchs en 3 points', e.pts);
  t.ok(e.lvMid < e.lv0, 'l’adversaire devient plus vif au fil des points', [e.lv0, e.lvMid]);
  t.ok(e.afterWin.wins === 1 && e.afterWin.diff === 2 && !e.afterWin.done, 'victoire 3–1 : 1 match gagné, écart +2, la série continue', e.afterWin);
  t.ok(e.second.cur === 1 && e.second.score.join() === '0,0' && e.second.name !== R('endlessOpp(0).name'), 'match suivant : nouvel adversaire, score remis à zéro', e.second);
  t.ok(e.done && e.wins === 1 && e.diff === 1, 'défaite 2–3 : série terminée, écart +1', e);
  t.ok(e.best === 1 && e.runs === 1, 'record personnel gardé dans le navigateur', e);
  t.ok(e.names === 18, '18 adversaires différents avant de recommencer les noms', e.names);
  t.ok(e.team === R('G.series.opp.name'), 'le nom de l’adversaire s’affiche', e.team);

  t.group('Mini-tournoi');
  const s = R(`(() => { G.series = { cur: 2 }; const r = [oppLevel() === AI_LEVELS.difficile, winPts(), serOpp().name]; G.series = null; return r; })()`);
  t.ok(s[0] && s[1] === 5 && s[2] === 'Titans', 'tour 3 : Titans, niveau difficile, 5 points', s);
}
