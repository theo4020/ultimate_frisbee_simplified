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
  const SYS = `cleanSystem(Object.assign(SYS_NEW.off(), { steps: [{ p: 0, to: [6, 10], wait: 0.3 }, { p: 0, to: [18, 12], wait: 0.5 }, { p: 2, to: [30, 6], wait: 0.5 }, { p: 1, to: [9, -8], wait: 0.6 }] }))`;
  R('globalThis.__miss = []');                                  // places manquées (détail affiché en cas d'échec)
  for (const mode of ['formation', 'play', 'zone', 'man']) {
    const r = R(`(() => {
      const c0 = Object.assign({}, G.ai), c1 = Object.assign({}, G.ai), keep = cfg;
      cfg = t => t === 0 ? c0 : c1;
      if ('${mode}' === 'formation') { c0.osys = ${SYS}; c0.play1 = c0.play2 = 'none'; }
      if ('${mode}' === 'play') { c0.play1 = c0.play2 = 'sys'; c0.p1sys = c0.p2sys = ${SYS}; }
      if ('${mode}' === 'zone') c0.dsys = cleanSystem(SYS_NEW.def());
      if ('${mode}' === 'man') c0.dsys = cleanSystem(Object.assign(SYS_NEW.def(), { mode: 'man', roles: ['serre', 'profond', 'double', 'normal', 'normal'] }));
      let stuck = 0, pts = 0, cuts = 0, onSpot = 0, checks = 0, plays = 0, chained = 0, chainChecks = 0;
      const _st = startCut; startCut = function (c, x, y, d) {
        const P = G.oplay, before = c.state, r = _st(c, x, y, d);
        if (c.team === 0) cuts++;
        if (P && P.type === 'sys' && P.team === 0 && P.i === 2 && P.map[0] === c) { chainChecks++; if (before === 'park') chained++; }
        return r; };
      const _cp = callPlay; callPlay = function (t, n) { const r = _cp(t, n); if (r && t === 0 && G.oplay.type === 'sys') plays++; return r; };
      for (let k = 0; k < ${games}; k++) { G.score = [0, 0]; G.receiving = k % 2;
        for (;;) { newWind(); startPoint(); let f = 0;
          while ((G.phase === 'play' || G.phase === 'pull') && f < 36000) { __tick(); f++;
            if (f % 8 === 0 && osysOf(0) && G.off === 0 && disc.mode === 'held' && G.stall > 1 && !G.pullPending && !G.oplay
                && !TEAMS[0].some(q => ['jab', 'cut', 'park'].includes(q.state))) {           // personne ne coupe : chacun vise sa place
              for (const p of TEAMS[0]) if (p.state === 'stack' && p.role === 'cutter' && p.sysIdx >= 0 && p !== disc.holder) { checks++; if (dist(p.tx, p.ty, ...sysWorld(osysOf(0).pos, disc.x, disc.y, dirOf(0), -closedOf(1))[p.sysIdx]) < 0.5
                || Math.abs(dist(p.tx, p.ty, disc.x, disc.y) - HOLDER_ROOM) < 0.05) onSpot++;
                else if (globalThis.__miss) __miss.push({ i: p.sysIdx, tgt: [+p.tx.toFixed(1), +p.ty.toFixed(1)], spot: sysWorld(osysOf(0).pos, disc.x, disc.y, dirOf(0), -closedOf(1))[p.sysIdx].map(v => +v.toFixed(1)), pos: [+p.x.toFixed(1), +p.y.toFixed(1)], h: [+disc.x.toFixed(1), +disc.y.toFixed(1)], others: TEAMS[0].filter(q => q !== p).map(q => q.state).join() }); }   // (ou il contourne le porteur pour y aller)
            } }
          if (f >= 36000) { stuck++; break; } pts++; if (G.phase === 'over') break; } }
      startCut = _st; callPlay = _cp; cfg = keep;
      return { stuck, pts, cuts, spot: checks ? onSpot / checks : 1, checks, plays, chain: chainChecks ? chained / chainChecks : 1, chainChecks };
    })()`);
    t.ok(r.stuck === 0 && r.pts > 0, `${mode} : aucun point bloqué`, r);
    if (mode === 'formation') { t.ok(r.cuts > 30, 'formation perso : les joueurs coupent librement depuis leurs places', r.cuts); t.ok(r.spot >= 0.85 || r.checks * (1 - r.spot) <= 1, 'au repos, chacun vise sa place de la formation (un écart isolé toléré)', JSON.stringify(r) + ' ' + R('JSON.stringify(__miss.slice(0, 3))')); }   // (si personne n'a été au repos, rien à vérifier)
    if (mode === 'play') {
      t.ok(r.plays >= 1, 'play perso : l’IA l’appelle et il se joue', r.plays);   // (moins de possessions depuis que les passes sont moins contrables)

    }
  }

  t.group('Plays appelés en jeu');
  const pl = R(`(() => {
    const out = {};
    for (const ty of ['huck', 'split', 'give', 'flood', 'swing']) {
      G.humans = []; G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
      for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && G.stall > 1); f++) __tick();
      if (!(G.phase === 'play' && disc.mode === 'held' && disc.holder)) { G.off = 0; G.phase = 'play'; G.pickup = null; holdDisc(TEAMS[0][0]); }   // rare : on force la situation
      G.oplay = null; const t = G.off; const c = cfg(t); c.play1 = ty;
      const ok = callPlay(t, 1), P = G.oplay;
      for (let f = 0; f < 18; f++) __tick();                      // 0,3 s plus tard : le play est déjà en route
      const moving = P && TEAMS[t].some(q => q !== disc.holder && ['jab', 'cut', 'park'].includes(q.state));
      out[ty] = { ok, moving, again: callPlay(t, 1) };
    }
    return out; })()`);
  for (const [ty, o] of Object.entries(pl)) t.ok(o.ok && o.moving && !o.again, `${ty} : appelé, ses joueurs partent tout de suite depuis là où ils sont (pas deux plays à la fois)`, o);
  const ch = R(`(() => {                                          // play perso, porteur qui garde le disque : les courses s'enchaînent
    G.humans = []; G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
    for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && G.stall > 1); f++) __tick();
    if (!(G.phase === 'play' && disc.mode === 'held' && disc.holder)) { G.off = 0; G.phase = 'play'; G.pickup = null; holdDisc(TEAMS[0][0]); }
    const t = G.off, c = cfg(t); c.play1 = 'sys'; c.p1sys = ${SYS}; G.oplay = null;
    callPlay(t, 1); const P = G.oplay, q = P.map[0], starts = [];
    const _st = startCut; startCut = function (p, x, y, d) { if (p === q) starts.push({ x: p.x, y: p.y, st: p.state, by: (new Error().stack.split(String.fromCharCode(10))[2] || '').trim().split(' ')[1] }); return _st(p, x, y, d); };
    for (let f = 0; f < 2400 && G.oplay === P; f++) { disc.holder.think = 99; G.stall = 0; __tick(); }
    startCut = _st;
    return { n: starts.length, second: starts[1] && starts[1].st, ended: G.oplay !== P, by: starts.map(s => s.by).join() };
  })()`);
  const su = R(`(() => {                                          // option « se mettre en place » : chacun file d'abord à sa place
    G.humans = []; G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
    for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && G.stall > 1); f++) __tick();
    if (!(G.phase === 'play' && disc.mode === 'held' && disc.holder)) { G.off = 0; G.phase = 'play'; G.pickup = null; holdDisc(TEAMS[0][0]); }
    const t = G.off, c = cfg(t); c.play1 = 'sys'; c.p1sys = Object.assign(${SYS}, { setup: true }); G.oplay = null;
    callPlay(t, 1); const P = G.oplay, parked = P.map.filter(Boolean).every(q => q.state === 'park' && q.sprintPark);
    let firstAt = -1, f = 0;
    const _st = startCut; startCut = function (p, x, y, d) { if (firstAt < 0) firstAt = f; return _st(p, x, y, d); };
    for (; f < 400 && firstAt < 0; f++) { disc.holder.think = 99; G.stall = 0; __tick(); }
    startCut = _st;
    return { parked, wait: firstAt / 60 * 0.78 };
  })()`);
  t.ok(su.parked && su.wait < 1.8, '« se mettre en place » : chacun file à sa place, puis les courses partent (1,5 s au plus)', su);
  t.ok(ch.n === 2 && ch.second === 'park' && ch.ended, 'deux courses de suite pour un joueur : la 2e part de la fin de la 1re, puis le play se termine', ch);

  t.group('Où les systèmes comptent');
  const ex = R(`(() => { const s = cleanSystem(SYS_NEW.off()); G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    sysSave([s]); G.form.osys = s.id; const solo = !!osysOf(0);
    G.series = { endless: true, cur: 0, opp: endlessOpp(0), pts: 2, wins: 0, diff: 0 }; const inf = !!osysOf(0);
    G.series = { cur: 1 }; const tour = !!osysOf(0); G.series = null; G.humans = []; G.myId = -1; G.form.osys = null; return { solo, inf, tour }; })()`);
  t.ok(ex.solo && ex.tour && ex.inf, 'utilisés en match, en tournoi et en mode infini', ex);
}
