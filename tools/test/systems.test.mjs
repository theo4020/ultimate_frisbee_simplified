// Systèmes de jeu perso (systems.js), sans navigateur : validation, placement, et matchs IA qui les jouent.
import { loadGame } from './lib.mjs';

export default async function (t, { quick }) {
  const g = loadGame(), R = c => g.run(c);

  t.group('Validation');
  const v = R(`(() => {
    const bad = [null, 3, {}, { kind: 'x' }].map(cleanSystem);
    const o = cleanSystem({ kind: 'play', name: '<b>Huck</b>', base: 'hack', pos: [[999, -999]], steps: Array.from({ length: 30 }, () => ({ p: 1, to: [10, 2], wait: 99 })).concat([{ p: 7, to: [1, 1] }]) });
    const f = cleanSystem({ kind: 'off', pos: [[999, -999]], postes: [{ role: 'dump', zone: 'nope' }] });
    const d = cleanSystem({ kind: 'def', mode: 'man', roles: ['serre', 'serre', 'double'] });
    const nd = cleanSystem({ kind: 'def', mark: { force: 'x', double: 4 }, postes: [{ mission: 'man', side: 'deep', gap: '??' }, { mission: 'zone', behave: 'press' }] });
    const mig = migrateSystems([cleanSystem({ kind: 'off', id: 'old123', name: 'Vieux', pos: [[5, 5], [8, 0], [12, 0], [16, 0]], steps: [{ p: 1, to: [20, 5], wait: 0.5 }] })]);
    return { bad, o, f, d, nd, mig };
  })()`);
  t.ok(v.bad.every(x => x === null), 'les données invalides sont rejetées');
  t.ok(v.o.name === 'bHuck/b' && v.o.base === 'vert' && v.o.pos[0][0] === 40 && v.o.pos[0][1] === -18, 'play : nom nettoyé, formation inconnue → vertical, positions ramenées sur le terrain', v.o);
  t.ok(v.o.steps.length === 12 && v.o.steps.every(s => s.wait <= 3 && s.p === 1), '12 courses au plus, délais bornés, joueurs inconnus retirés');
  t.ok(v.f.postes[0].role === 'dump' && v.f.postes[0].zone === 'auto' && v.f.postes.length === 4 && !v.f.steps, 'formation : consignes inconnues remplacées par « au choix »', v.f.postes[0]);
  t.ok(v.d.postes.every(p => p.mission === 'man') && v.d.postes[0].gap === 'serre' && v.d.mark.double === '6', 'ancienne défense individuelle convertie en missions', v.d);
  t.ok(v.nd.mark.force === 'menu' && v.nd.mark.double === '4' && v.nd.postes[0].side === 'deep' && v.nd.postes[0].gap === 'normal' && v.nd.postes[1].behave === 'press' && v.nd.postes[2].mission === 'zone', 'défense perso : valeurs inconnues remplacées', v.nd);
  t.ok(v.mig.length === 2 && v.mig[0].kind === 'off' && !v.mig[0].steps && v.mig[1].kind === 'play' && v.mig[1].base === 'sys:old123' && v.mig[1].steps.length === 1, 'ancienne attaque avec courses → une formation + un play', v.mig);

  t.group('Placement autour du disque');
  const w = R(`(() => { const mid = sysWorld([[10, 5]], 50, H / 2, 1, 1)[0], flip = sysWorld([[10, 5]], 50, H / 2, -1, -1)[0];
    const edge = sysWorld([[5, 10], [5, 14]], 50, H - 3, 1, 1); return { mid, flip, edge }; })()`);
  t.ok(w.mid[0] === 60 && w.mid[1] === 37 / 2 + 5, 'vers l’avant et côté open');
  t.ok(w.flip[0] === 40 && w.flip[1] === 37 / 2 - 5, 'se retourne avec le sens d’attaque et le côté forcé');
  t.ok(w.edge.every(p => p[1] <= 37 - 1.5) && Math.abs((w.edge[1][1] - w.edge[0][1]) - 4) < 0.01, 'près d’une ligne, la formation glisse en bloc au lieu de s’écraser', w.edge);

  t.group('Matchs avec des systèmes perso');
  const games = 2;                                         // (3 matchs n'apportaient rien de plus, et coûtaient 15 s)
  const FORM = `cleanSystem(SYS_NEW.off())`;
  const SYS = `cleanSystem({ kind: 'play', name: 'P', base: 'vert', steps: [{ p: 1, to: [6, 10], wait: 0.3 }, { p: 1, to: [18, 12], wait: 0.5 }, { p: 2, to: [30, 6], wait: 0.5 }, { p: 3, to: [9, -8], wait: 0.6 }] })`;
  R('globalThis.__miss = []');                                  // places manquées (détail affiché en cas d'échec)
  for (const mode of ['formation', 'play', 'zone', 'man', 'mixte']) {
    const r = R(`(() => {
      const c0 = Object.assign({}, G.ai), c1 = Object.assign({}, G.ai), keep = cfg;
      cfg = t => t === 0 ? c0 : c1;
      if ('${mode}' === 'formation') { c0.osys = ${FORM}; c0.play1 = c0.play2 = 'none'; }
      if ('${mode}' === 'play') { c0.play1 = c0.play2 = 'sys'; c0.p1sys = c0.p2sys = ${SYS}; }
      if ('${mode}' === 'zone') c0.dsys = cleanSystem(SYS_NEW.def());
      if ('${mode}' === 'man') c0.dsys = cleanSystem({ kind: 'def', mark: { double: '4' }, postes: [{ mission: 'man', gap: 'serre' }, { mission: 'man', side: 'deep' }, { mission: 'man', side: 'open' }, { mission: 'man' }] });
      if ('${mode}' === 'mixte') c0.dsys = cleanSystem({ kind: 'def', mark: { dist: 'lache', force: 'straight' }, postes: [{ mission: 'man' }, { mission: 'man', gap: 'lache' }, { mission: 'zone', pos: [12, 0], behave: 'press' }, { mission: 'zone', pos: [25, 0], behave: 'deep' }] });
      let stuck = 0, pts = 0, cuts = 0, onSpot = 0, checks = 0, plays = 0, chained = 0, chainChecks = 0, mixOk = 0, mixChecks = 0, dbl = 0;
      const _st = startCut; startCut = function (c, x, y, d) {
        const P = G.oplay, before = c.state, r = _st(c, x, y, d);
        if (c.team === 0) cuts++;
        if (P && P.type === 'sys' && P.team === 0 && P.i === 2 && P.map[1] === c) { chainChecks++; if (before === 'park') chained++; }
        return r; };
      const _cp = callPlay; callPlay = function (t, n) { const r = _cp(t, n); if (r && t === 0 && G.oplay.type === 'sys') plays++; return r; };
      for (let k = 0; k < ${games}; k++) { G.score = [0, 0]; G.receiving = k % 2;
        for (;;) { newWind(); startPoint(); let f = 0;
          while ((G.phase === 'play' || G.phase === 'pull') && f < 36000) { __tick(); f++;
            if (f % 15 === 0 && dsysOf(0) && G.phase === 'play' && G.off === 1 && disc.mode === 'held' && !G.dplay) { mixChecks++;   // défense perso : une mark, ses individuelles ont un joueur, ses zones une place
              const D = dsysOf(0), ms = TEAMS[0].filter(d => d.mission);
              if (ms.filter(d => d.mission.type === 'mark').length === 1 && ms.filter(d => d.mission.type === 'man').every(d => d.match && d.match !== disc.holder || G.dB && G.dB.double === d)
                && ms.filter(d => d.mission.type === 'man').length === D.postes.filter(p => p.mission === 'man').length) mixOk++;
              if (G.dB && G.dB.double) dbl++; }
            if (f % 8 === 0 && osysOf(0) && G.off === 0 && disc.mode === 'held' && G.stall > 1 && !G.pullPending && !G.oplay
                && !TEAMS[0].some(q => ['jab', 'cut', 'park'].includes(q.state))) {           // personne ne coupe : chacun vise sa place
              for (const p of TEAMS[0]) if (p.state === 'stack' && p.role === 'cutter' && p.sysIdx >= 0 && p !== disc.holder) { checks++; if (dist(p.tx, p.ty, ...sysWorld(osysOf(0).pos, disc.x, disc.y, dirOf(0), -closedOf(1))[p.sysIdx]) < 0.5
                || Math.abs(dist(p.tx, p.ty, disc.x, disc.y) - HOLDER_ROOM) < 0.05
                || dist(...sysWorld(osysOf(0).pos, disc.x, disc.y, dirOf(0), -closedOf(1))[p.sysIdx], disc.x, disc.y) < HOLDER_ROOM + 0.1) onSpot++;   // place trop près du porteur : il s'en écarte
                else if (globalThis.__miss) __miss.push({ i: p.sysIdx, tgt: [+p.tx.toFixed(1), +p.ty.toFixed(1)], spot: sysWorld(osysOf(0).pos, disc.x, disc.y, dirOf(0), -closedOf(1))[p.sysIdx].map(v => +v.toFixed(1)), pos: [+p.x.toFixed(1), +p.y.toFixed(1)], h: [+disc.x.toFixed(1), +disc.y.toFixed(1)], others: TEAMS[0].filter(q => q !== p).map(q => q.state).join() }); }   // (ou il contourne le porteur pour y aller)
            } }
          if (f >= 36000) { stuck++; break; } pts++; if (G.phase === 'over') break; } }
      startCut = _st; callPlay = _cp; cfg = keep;
      return { stuck, pts, cuts, spot: checks ? onSpot / checks : 1, checks, plays, chain: chainChecks ? chained / chainChecks : 1, chainChecks, mix: mixChecks ? mixOk / mixChecks : 1, mixChecks, dbl };
    })()`);
    t.ok(r.stuck === 0 && r.pts > 0, `${mode} : aucun point bloqué`, r);
    if (mode === 'formation') { t.ok(r.cuts > 20, 'formation perso : les joueurs coupent librement depuis leurs places', r.cuts); t.ok(r.spot >= 0.85 || r.checks * (1 - r.spot) <= 1, 'au repos, chacun vise sa place de la formation (un écart isolé toléré)', JSON.stringify(r) + ' ' + R('JSON.stringify(__miss.slice(0, 3))')); }   // (si personne n'a été au repos, rien à vérifier)
    if (mode === 'man' || mode === 'mixte') t.ok(r.mix > 0.9, `${mode} : chaque défenseur suit sa mission (une mark, individuelles avec un joueur)`, r);
    if (mode === 'play') {
      t.ok(r.plays >= 1, 'play perso : l’IA l’appelle et il se joue', r.plays);   // (moins de possessions depuis que les passes sont moins contrables)

    }
  }

  const db = R(`(() => { const c1 = Object.assign({}, G.ai), keep = cfg; cfg = t => t === 0 ? c1 : G.ai;   // double team dès le stall choisi
    c1.dsys = cleanSystem({ kind: 'def', mark: { double: '4' }, postes: [{ mission: 'man' }, { mission: 'man' }, { mission: 'man' }, { mission: 'man' }] });
    G.score = [0, 0]; G.receiving = 1; newWind(); startPoint(); for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && !G.pullPending); f++) __tick();
    G.humans = []; G.dplay = null; G.oplay = null; const h = TEAMS[1][1]; G.off = 1; holdDisc(h); setupDefense(0, h); h.think = 99;
    G.stall = 3; G.dbT = 0; defenseBrain(0, 0.4); const before = !!(G.dB && G.dB.double);
    G.stall = 4.5; G.dbT = 0; defenseBrain(0, 0.4); const after = !!(G.dB && G.dB.double); cfg = keep; return { before, after }; })()`);
  t.ok(!db.before && db.after, 'défense perso : double team dès le stall choisi', db);

  t.group('Plays appelés en jeu');
  const pl = R(`(() => {
    const out = {};
    for (const ty of ['huck', 'split', 'give', 'flood', 'swing']) {
      G.humans = []; G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
      for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && G.stall > 1); f++) __tick();
      if (!(G.phase === 'play' && disc.mode === 'held' && disc.holder)) { G.off = 0; G.phase = 'play'; G.pickup = null; holdDisc(TEAMS[0][0]); }   // rare : on force la situation
      G.oplay = null; const t = G.off; const c = cfg(t); c.play1 = ty;
      const ok = callPlay(t, 1), P = G.oplay;
      for (let f = 0; f < 18; f++) { if (disc.holder) disc.holder.think = 99; __tick(); }   // le porteur garde le disque : on regarde les courses                      // 0,3 s plus tard : le play est déjà en route
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
    callPlay(t, 1); const P = G.oplay, q = P.map[1], starts = [];
    const _st = startCut; startCut = function (p, x, y, d) { if (p === q) starts.push({ x: p.x, y: p.y, st: p.state, by: (new Error().stack.split(String.fromCharCode(10))[2] || '').trim().split(' ')[1] }); return _st(p, x, y, d); };
    for (let f = 0; f < 2400 && G.oplay === P; f++) { if (disc.holder) { disc.holder.think = 99; disc.holder.windup = null; } G.stall = 0; __tick(); }
    startCut = _st;
    const pl = starts.filter(s => s.by === 'sysPlayTick');                 // ses courses du play (l'IA peut le relancer une fois les siennes finies)
    return { n: pl.length, second: pl[1] && pl[1].st, ended: G.oplay !== P, by: starts.map(s => s.by).join() };
  })()`);
  const su = R(`(() => {                                          // option « se mettre en place » : chacun file d'abord à sa place
    G.humans = []; G.score = [0, 0]; G.receiving = 0; newWind(); startPoint();
    for (let f = 0; f < 6000 && !(G.phase === 'play' && disc.mode === 'held' && G.stall > 1); f++) __tick();
    if (!(G.phase === 'play' && disc.mode === 'held' && disc.holder)) { G.off = 0; G.phase = 'play'; G.pickup = null; holdDisc(TEAMS[0][0]); }
    const t = G.off, c = cfg(t); c.play1 = 'sys'; c.p1sys = Object.assign(${SYS}, { setup: true }); G.oplay = null;
    callPlay(t, 1); const P = G.oplay, parked = P.map.filter(Boolean).every(q => q.state === 'park' && q.sprintPark);
    let firstAt = -1, f = 0;
    const _st = startCut; startCut = function (p, x, y, d) { if (firstAt < 0) firstAt = f; return _st(p, x, y, d); };
    for (; f < 400 && firstAt < 0; f++) { if (disc.holder) { disc.holder.think = 99; disc.holder.windup = null; } G.stall = 0; __tick(); }
    startCut = _st;
    return { parked, wait: firstAt / 60 };
  })()`);
  t.ok(su.parked && su.wait < 2.1, '« se mettre en place » : chacun file à sa place (1,5 s au plus), puis les courses partent', su);
  t.ok(ch.n === 2 && ch.second === 'park' && ch.ended, 'deux courses de suite pour un joueur : la 2e part de la fin de la 1re, puis le play se termine', ch);

  t.group('Où les systèmes comptent');
  const ex = R(`(() => { const s = cleanSystem(SYS_NEW.off()); G.humans = [{ id: 0, team: 0, sel: null }]; G.myId = 0; syncMe();
    sysSave([s]); G.form.osys = s.id; const solo = !!osysOf(0);
    G.series = { endless: true, cur: 0, opp: endlessOpp(0), pts: 2, wins: 0, diff: 0 }; const inf = !!osysOf(0);
    G.series = { cur: 1 }; const tour = !!osysOf(0); G.series = null; G.humans = []; G.myId = -1; G.form.osys = null; return { solo, inf, tour }; })()`);
  t.ok(ex.solo && ex.tour && ex.inf, 'utilisés en match, en tournoi et en mode infini', ex);
}
