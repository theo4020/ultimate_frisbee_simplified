// Systèmes de jeu perso (systems.js), sans navigateur : validation, placement, et matchs IA qui les jouent.
import { loadGame } from './lib.mjs';

export default async function (t, { quick }) {
  const g = loadGame(), R = c => g.run(c);

  t.group('Validation');
  const v = R(`(() => {
    const bad = [null, 3, {}, { kind: 'x' }].map(cleanSystem);
    const o = cleanSystem({ kind: 'off', name: '<b>Huck</b>', pos: [[999, -999]], steps: Array.from({ length: 30 }, () => ({ p: 1, to: [10, 2], wait: 99 })).concat([{ p: 7, to: [1, 1] }]) });
    const d = cleanSystem({ kind: 'def', mode: 'man', roles: ['serre', 'hack', 'double'] });
    return { bad, o, d };
  })()`);
  t.ok(v.bad.every(x => x === null), 'les données invalides sont rejetées');
  t.ok(v.o.name === 'bHuck/b' && v.o.pos.length === 4 && v.o.pos[0][0] === 40 && v.o.pos[0][1] === -18, 'nom nettoyé, positions ramenées sur le terrain', v.o.pos[0]);
  t.ok(v.o.steps.length === 12 && v.o.steps.every(s => s.wait <= 3 && s.p === 1), '12 courses au plus, délais bornés, joueurs inconnus retirés');
  t.ok(v.d.mode === 'man' && v.d.roles.join() === 'serre,normal,double,normal,normal', 'rôles inconnus remplacés par « normal »', v.d.roles);

  t.group('Placement autour du disque');
  const w = R(`(() => { const mid = sysWorld([[10, 5]], 50, H / 2, 1, 1)[0], flip = sysWorld([[10, 5]], 50, H / 2, -1, -1)[0];
    const edge = sysWorld([[5, 10], [5, 14]], 50, H - 3, 1, 1); return { mid, flip, edge }; })()`);
  t.ok(w.mid[0] === 60 && w.mid[1] === 37 / 2 + 5, 'vers l’avant et côté open');
  t.ok(w.flip[0] === 40 && w.flip[1] === 37 / 2 - 5, 'se retourne avec le sens d’attaque et le côté forcé');
  t.ok(w.edge.every(p => p[1] <= 37 - 1.5) && Math.abs((w.edge[1][1] - w.edge[0][1]) - 4) < 0.01, 'près d’une ligne, la formation glisse en bloc au lieu de s’écraser', w.edge);

  t.group('Matchs avec des systèmes perso');
  const games = quick ? 2 : 5;
  for (const mode of ['off', 'zone', 'man']) {
    const r = R(`(() => {
      const c0 = Object.assign({}, G.ai), c1 = Object.assign({}, G.ai), keep = cfg;
      cfg = t => t === 0 ? c0 : c1;
      if ('${mode}' === 'off') c0.osys = cleanSystem(Object.assign(SYS_NEW.off(), { steps: [{ p: 0, to: [6, 10], wait: 0.6 }, { p: 0, to: [18, 12], wait: 1 }, { p: 2, to: [32, 6], wait: 1 }, { p: 1, to: [9, -8], wait: 1.2 }] }));
      if ('${mode}' === 'zone') c0.dsys = cleanSystem(SYS_NEW.def());
      if ('${mode}' === 'man') c0.dsys = cleanSystem(Object.assign(SYS_NEW.def(), { mode: 'man', roles: ['serre', 'profond', 'double', 'normal', 'normal'] }));
      let stuck = 0, pts = 0, sysCuts = 0, onSpot = 0, checks = 0;
      let chained = 0, chainChecks = 0;
      const _st = startCut; startCut = function (c, x, y, d) { const before = [c.x, c.y, c.state]; const r = _st(c, x, y, d);
        if (c.team === 0 && osysOf(0) && G.sysQ) { sysCuts++; if (G.sysQ.i === 2 && c.sysIdx === 0) { chainChecks++; if (before[2] === 'park') chained++; } } return r; };
      for (let k = 0; k < ${games}; k++) { G.score = [0, 0]; G.receiving = k % 2;
        for (;;) { newWind(); startPoint(); let f = 0;
          while ((G.phase === 'play' || G.phase === 'pull') && f < 36000) { __tick(); f++;
            if (f % 30 === 0 && osysOf(0) && G.off === 0 && disc.mode === 'held' && G.stall > 1 && !G.pullPending) {   // les joueurs au repos rejoignent leur place
              for (const p of TEAMS[0]) if (p.state === 'stack' && p.role === 'cutter' && p.sysIdx >= 0 && p !== disc.holder) { checks++; if (dist(p.tx, p.ty, ...sysWorld(osysOf(0).pos, disc.x, disc.y, dirOf(0), -closedOf(1))[p.sysIdx]) < 0.5) onSpot++; }
            } }
          if (f >= 36000) { stuck++; break; } pts++; if (G.phase === 'over') break; } }
      startCut = _st; cfg = keep;
      return { stuck, pts, sysCuts, spot: checks ? onSpot / checks : 1, chain: chainChecks ? chained / chainChecks : 1, chainChecks };
    })()`);
    t.ok(r.stuck === 0 && r.pts > 0, `${mode} : aucun point bloqué`, r);
    if (mode === 'off') { t.ok(r.sysCuts > 20, 'les courses du système sont jouées', r.sysCuts); t.ok(r.spot > 0.95, 'les joueurs au repos visent leur place du système', r.spot);
      t.ok(r.chainChecks > 3 && r.chain > 0.8, 'deux courses de suite pour un joueur : la 2e part de la fin de la 1re (il ne revient pas en place entre les deux)', r); }
  }

  t.group('Où les systèmes ne comptent pas');
  const ex = R(`(() => { const s = cleanSystem(SYS_NEW.off()); G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    sysSave([s]); G.form.osys = s.id; const solo = !!osysOf(0);
    G.series = { endless: true, cur: 0, opp: endlessOpp(0), pts: 2, wins: 0, diff: 0 }; const inf = !!osysOf(0);
    G.series = { cur: 1 }; const tour = !!osysOf(0); G.series = null; G.humans = []; G.myId = -1; G.form.osys = null; return { solo, inf, tour }; })()`);
  t.ok(ex.solo && ex.tour && !ex.inf, 'utilisés en match et en tournoi, pas en mode infini', ex);
}
