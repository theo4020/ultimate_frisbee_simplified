// tools/simulate.js — Fait jouer l'IA contre elle-même, sans navigateur, pour vérifier
// que rien ne casse et mesurer l'équilibre. Usage : node tools/simulate.js [matchs] [niveau des Rouges]
// (les Bleus restent au niveau normal ; sans niveau, les deux équipes sont au niveau normal)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]).filter(f => !f.includes('secrets'));

// faux navigateur minimal
const mk = () => new Proxy(function () {}, {
  get: (t, k) => k === 'clientWidth' ? 1000 : k === 'children' ? [] : k === 'offsetHeight' ? 0
    : k === 'classList' ? { add() {}, remove() {}, toggle() {}, contains() { return false; } }
    : k === 'style' ? { setProperty() {} } : mk(),
  apply: () => mk(), set: () => true
});
const sandbox = {
  console, Math, JSON, Date, Set, Map, Array, Object, Number, String, Promise, setTimeout: () => 0, clearTimeout() {},
  document: { getElementById: () => mk(), querySelectorAll: () => [], body: mk(), documentElement: mk(), head: mk(), addEventListener() {} },
  window: { addEventListener() {}, devicePixelRatio: 1, innerHeight: 800, innerWidth: 1200 },
  location: { hash: '', href: 'http://x/' }, navigator: {}, localStorage: { getItem() { return null; }, setItem() {} },
  performance: { now: () => 0 }, requestAnimationFrame() {}
};
vm.createContext(sandbox);
const code = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
const games = +process.argv[2] || 20, level = process.argv[3] || 'normal';
vm.runInContext(code + `
;(function () {
  G.humans = []; G.myId = -1; G.attract = false;
  aiLvl = t => AI_LEVELS[t === 1 ? '${level}' : 'normal'];   // simulation : niveau imposé par équipe
  let won = [0, 0], thrDist = 0, thrN = 0, longN = 0, longOk = 0, pendingLong = false;
  const kinds = {}, strat = {};
  const sk = () => formOf(G.off) + '/' + defFormOf(1 - G.off) + (defFormOf(1 - G.off) !== 'zone' ? '-' + forceOf(1 - G.off) : '');
  const _td = throwDisc; throwDisc = function (h, x, y, c, e, k) { const d = dist(h.x, h.y, x, y); thrDist += d; thrN++; pendingLong = d > 25; if (d > 25) longN++;
    k = k || 'normal'; (kinds[k] = kinds[k] || [0, 0])[0]++; const st = sk(); (strat[st] = strat[st] || [0, 0])[0]++; return _td(h, x, y, c, e, k); };
  const _cd = catchDisc; catchDisc = function (p) { if (pendingLong && !disc.pull && p.team === disc.team) longOk++; pendingLong = false;
    if (!disc.pull && p.team === disc.team) { kinds[disc.kind][1]++; const st = sk(); (strat[st] = strat[st] || [0, 0])[1]++; } return _cd(p); };
  const _to = turnover; turnover = function (...a) { pendingLong = false; return _to(...a); };
  let pts = 0, secs = [], stuck = 0, pullPerfect = 0, pulls = 0, dbl = 0;
  const _lp = launchPull; launchPull = function (x, y, c, q) { pulls++; if (q >= 0.82 && q <= 0.95) pullPerfect++; return _lp(x, y, c, q); };
  const _fl = flash; flash = function (m, l) { if (m === 'Double team !') dbl++; return _fl(m, l); };
  for (let g = 0; g < ${games}; g++) {
    G.score = [0, 0]; G.receiving = g % 2;
    for (;;) {
      newWind(); startPoint();
      let f = 0;
      while ((G.phase === 'play' || G.phase === 'pull') && f < 60 * 600) {
        const dt = 0.78 / 60;
        if (G.phase === 'pull') pullTick(1 / 60); else { G.gt += dt; update(dt); }
        G.time += 1 / 60; f++;
        fxUpdate(1 / 60);
      }
      if (f >= 60 * 600) { stuck++; break; }
      pts++; secs.push(f / 60);
      if (G.phase === 'over') break;
    }
    won[0] += G.score[0]; won[1] += G.score[1];
  }
  secs.sort((a, b) => a - b);
  const s = G.stats;
  console.log(JSON.stringify({ 'niveau Rouges': '${level}', 'points Bleus/Rouges': won.join(' / '), matchs: ${games}, points: pts, bloques: stuck, 'sec/point (médiane)': +secs[secs.length >> 1].toFixed(0),
    'lancer moyen (m)': +(thrDist / thrN).toFixed(1), 'lancers > 25 m %': +(100 * longN / thrN).toFixed(0), 'réussite > 25 m %': +(100 * longOk / Math.max(1, longN)).toFixed(0), 'passes réussies %': +(100 * s.comps / s.throws).toFixed(0), 'turnovers/point': +((s.blocks + s.ints + s.stalls + s.ground + s.out + (s.drops || 0)) / pts).toFixed(2),
    pulls, 'pulls parfaits': pullPerfect, kinds: Object.fromEntries(Object.entries(kinds).map(([k, [a, b]]) => [k, a + ' (' + Math.round(100 * b / a) + '%)'])),
    strat: Object.fromEntries(Object.entries(strat).sort().map(([k, [a, b]]) => [k, a + ' (' + Math.round(100 * b / a) + '%)'])), 'double teams': dbl, stalls: s.stalls, blocks: s.blocks, ints: s.ints, drops: s.drops || 0 }));
})();`, sandbox);
