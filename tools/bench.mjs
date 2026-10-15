// bench.mjs — Banc de réalisme : des matchs IA contre IA à chaque niveau, et les chiffres à comparer à de vrais matchs
// (voir la fiche « Fondations physiques »). Usage : node tools/bench.mjs [points par niveau, 60 par défaut]
import { loadGame } from './test/lib.mjs';

const N = +process.argv[2] || 60;
const TARGET = {
  facile: { comp: [75, 85], to: [3, 5] },
  normal: { comp: [85, 92], to: [1.5, 3] },
  difficile: { comp: [92, 96], to: [0.5, 1.5] }
};
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '–');
for (const lv of ['facile', 'normal', 'difficile']) {
  const g = loadGame();
  const r = g.run(`(() => {
    G.form.level = '${lv}';
    const B = { thr: 0, comp: 0, block: 0, int: 0, drop: 0, throw: 0, stall: 0, pts: 0, sec: 0, by: {} };
    const bucket = L => (L < 10 ? '<10' : L < 20 ? '10-20' : L < 30 ? '20-30' : '30+');
    let cur = null;
    const th = throwDisc; throwDisc = function (h, tx, ty, c, e, k) { const ok = th.apply(this, arguments); if (ok) { cur = bucket(discLen()); B.thr++; (B.by[cur] = B.by[cur] || { n: 0, cut: 0 }).n++; } return ok; };
    const mc = msCatch; msCatch = function (p, s) { if (cur) { B.comp++; B.by[cur].ok = (B.by[cur].ok || 0) + 1; } cur = null; return mc.apply(this, arguments); };
    const mt = msTurnover; msTurnover = function (p, kind) {
      B[kind] = (B[kind] || 0) + 1;
      if (cur && (kind === 'block' || kind === 'int')) B.by[cur].cut++;
      cur = null; return mt.apply(this, arguments);
    };
    for (let k = 0; k < ${N}; k++) { G.score = [0, 0]; G.receiving = k % 2; const f = __playPoint(); if (f > 0) { B.pts++; B.sec += f / 60; } }
    return B;
  })()`);
  const to = r.block + r.int + r.drop + r.throw + r.stall, T = TARGET[lv];
  console.log(`\n== ${lv} (${r.pts} points) ==`);
  console.log(`passes réussies   ${pct(r.comp, r.thr)} %   (visé ${T.comp[0]}–${T.comp[1]} %)`);
  console.log(`pertes par point  ${(to / r.pts).toFixed(2)}     (visé ${T.to[0]}–${T.to[1]})`);
  console.log(`  contres ${pct(r.block + r.int, to)} % · mauvais lancers ${pct(r.throw, to)} % · drops ${pct(r.drop, to)} % · stalls ${pct(r.stall, to)} %`);
  console.log(`durée d'un point  ${(r.sec / r.pts).toFixed(0)} s · passes par point ${(r.thr / r.pts).toFixed(1)}`);
  console.log('passes coupées    ' + ['<10', '10-20', '20-30', '30+'].map(k => `${k} m : ${r.by[k] ? pct(r.by[k].cut, r.by[k].n) + ' % (réussies ' + pct(r.by[k].ok || 0, r.by[k].n) + ' %, ' + r.by[k].n + ')' : '–'}`).join(' · '));
}
