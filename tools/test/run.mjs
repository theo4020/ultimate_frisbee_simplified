// Suite de tests du jeu.
//   node tools/test/run.mjs           tout (règles, serveur, interface, en ligne) — il faut Playwright (voir README)
//   node tools/test/run.mjs --quick   sans navigateur (règles + serveur) : c'est ce que lance Cloudflare avant chaque mise en ligne
//   node tools/test/run.mjs ui        seulement les fichiers dont le nom contient « ui »
//   JOBS=1 node tools/test/run.mjs    un fichier après l'autre (par défaut : 2 en parallèle)
import { tester, SQLITE } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const quick = process.argv.includes('--quick');
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const BROWSER = ['ui', 'online'], NEEDS_SQL = ['account', 'gallery', 'worker'];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs')).sort()
  .filter(f => !quick || !BROWSER.some(b => f.startsWith(b)))
  .filter(f => !only.length || only.some(o => f.includes(o)))
  .filter(f => { if (SQLITE || !NEEDS_SQL.some(n => f.startsWith(n))) return true; console.log(`⚠️ ${f} sauté : il faut Node 22.13+ (node:sqlite)`); return false; });

let failed = 0, passed = 0;
const t0 = Date.now();
// un fichier de tests, dans ce processus
async function runOne(f) {
  console.log('▶ ' + f.replace('.test.mjs', ''));
  const t = tester(f);
  try { await (await import(path.join(dir, f))).default(t, { quick }); }
  catch (e) { t.fail.push('erreur : ' + (e.stack || e).toString().split('\n').slice(0, 4).join(' | ')); console.log('    ✗ ' + t.fail[t.fail.length - 1]); }
  console.log(`  ${t.fail.length ? '❌' : '✅'} ${t.pass} ok${t.fail.length ? ', ' + t.fail.length + ' échec(s)' : ''}`);
  return [t.pass, t.fail.length];
}
const one = (process.argv.find(a => a.startsWith('--one=')) || '').slice(6);
if (one) {                                                    // processus enfant : un seul fichier, résultat sur la dernière ligne
  const [p, f] = await runOne(one);
  console.log('@@ ' + p + ' ' + f); process.exit(0);
}
// plusieurs fichiers : ils tournent en parallèle (JOBS processus, 2 par défaut), sorties affichées dans l'ordre
const JOBS = Math.max(1, +(process.env.JOBS || 2));
if (JOBS === 1 || files.length === 1) {
  for (const f of files) { const [p, fl] = await runOne(f); passed += p; failed += fl; }
} else {
  const { spawn } = await import('node:child_process');
  // les plus longs d'abord, pour bien remplir les processus
  const COST = { systems: 48, ui: 41, rules: 40, online: 30, 'ui-account': 10, account: 8, 'ui-systems': 6, 'ui-gallery': 6 };   // secondes environ
  const order = files.slice().sort((a, b) => (COST[b.replace('.test.mjs', '')] || 1) - (COST[a.replace('.test.mjs', '')] || 1));
  const out = new Map(); let next = 0;
  const work = () => new Promise(done => {
    const go = () => {
      if (next >= order.length) return done();
      const f = order[next++]; let buf = '';
      const c = spawn(process.execPath, [fileURLToPath(import.meta.url), '--one=' + f].concat(quick ? ['--quick'] : []), { env: process.env });
      c.stdout.on('data', d => { buf += d; }); c.stderr.on('data', d => { buf += d; });
      c.on('close', () => { out.set(f, buf); go(); });
    };
    go();
  });
  await Promise.all(Array.from({ length: Math.min(JOBS, files.length) }, work));
  for (const f of files) {
    const buf = out.get(f) || '', m = buf.match(/@@ (\d+) (\d+)\s*$/);
    process.stdout.write(buf.replace(/@@ \d+ \d+\s*$/, ''));
    if (m) { passed += +m[1]; failed += +m[2]; } else { failed++; console.log('    ✗ ' + f + ' : le processus s’est arrêté sans résultat'); }
  }
}
console.log(`\n${failed ? '❌' : '✅'} ${passed} vérifications réussies, ${failed} échec(s) — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(failed ? 1 : 0);
