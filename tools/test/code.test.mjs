// Code : deux fichiers ne doivent pas déclarer la même fonction ou constante globale (le second écraserait le premier).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

export default async function (t) {
  t.group('Noms globaux uniques');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]).filter(f => !f.includes('secrets'));
  const seen = new Map(), dup = [];
  for (const f of files) {
    for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/^(?:async\s+)?(?:function\s*\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (seen.has(m[1]) && seen.get(m[1]) !== f) dup.push(`${m[1]} (${seen.get(m[1])} et ${f})`);
      else seen.set(m[1], f);
    }
  }
  t.ok(dup.length === 0, 'aucun nom déclaré dans deux fichiers', dup);
  t.ok(seen.size > 100, 'les déclarations sont bien lues', seen.size);
}
