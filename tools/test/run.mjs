// Suite de tests du jeu.
//   node tools/test/run.mjs           tout (règles, serveur, interface, en ligne) — il faut Playwright (voir README)
//   node tools/test/run.mjs --quick   sans navigateur (règles + serveur) : c'est ce que lance Cloudflare avant chaque mise en ligne
//   node tools/test/run.mjs ui        seulement les fichiers dont le nom contient « ui »
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
for (const f of files) {
  console.log('▶ ' + f.replace('.test.mjs', ''));
  const t = tester(f);
  try { await (await import(path.join(dir, f))).default(t, { quick }); }
  catch (e) { t.fail.push('erreur : ' + (e.stack || e).toString().split('\n').slice(0, 4).join(' | ')); console.log('    ✗ ' + t.fail[t.fail.length - 1]); }
  passed += t.pass; failed += t.fail.length;
  console.log(`  ${t.fail.length ? '❌' : '✅'} ${t.pass} ok${t.fail.length ? ', ' + t.fail.length + ' échec(s)' : ''}`);
}
console.log(`\n${failed ? '❌' : '✅'} ${passed} vérifications réussies, ${failed} échec(s) — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(failed ? 1 : 0);
