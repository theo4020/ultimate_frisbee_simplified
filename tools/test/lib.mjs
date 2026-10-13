// lib.mjs — Outils communs aux tests : vérifications, jeu chargé sans navigateur, petit serveur local.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// SQLite de Node (22.13+) : sert à imiter le stockage de Cloudflare ; absent sur un Node plus ancien
export const SQLITE = (() => { try { process.removeAllListeners('warning'); return createRequire(import.meta.url)('node:sqlite').DatabaseSync; } catch (e) { return null; } })();
export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------- vérifications ----------
// t.ok(condition, message) ; t.group(nom) pour titrer ; les échecs sont comptés et listés à la fin par run.mjs
export function tester(name) {
  const t = { name, pass: 0, fail: [], cur: '' };
  t.group = g => { t.cur = g; console.log('  · ' + g); };
  t.ok = (c, msg, extra) => {
    if (c) { t.pass++; return true; }
    const m = (t.cur ? t.cur + ' — ' : '') + msg + (extra !== undefined ? ' (' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) + ')' : '');
    t.fail.push(m); console.log('    ✗ ' + m); return false;
  };
  return t;
}

// ---------- le jeu sans navigateur (comme tools/simulate.js) ----------
export function loadGame() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]).filter(f => !f.includes('secrets'));
  const mk = () => new Proxy(function () { }, {
    get: (t, k) => k === 'clientWidth' ? 1000 : k === 'children' ? [] : k === 'offsetHeight' ? 0
      : k === 'classList' ? { add() { }, remove() { }, toggle() { }, contains() { return false; } }
      : k === 'style' ? { setProperty() { } } : mk(),
    apply: () => mk(), set: () => true
  });
  const store = new Map();
  const sandbox = {
    console: { log() { }, warn() { }, error: console.error }, Math, JSON, Date, Set, Map, Array, Object, Number, String, Promise,
    setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
    document: { getElementById: () => mk(), querySelectorAll: () => [], body: mk(), documentElement: mk(), head: mk(), addEventListener() { } },
    window: { addEventListener() { }, devicePixelRatio: 1, innerHeight: 800, innerWidth: 1200 },
    location: { hash: '', href: 'http://x/', hostname: 'x' }, navigator: {}, history: { replaceState() { } },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), key: () => null, length: 0 },
    performance: { now: () => 0 }, requestAnimationFrame() { }, fetch: () => Promise.reject(new Error('hors ligne'))
  };
  vm.createContext(sandbox);
  vm.runInContext(files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n'), sandbox, { filename: 'jeu.js' });
  const run = code => vm.runInContext(code, sandbox);
  run(`G.humans = []; G.myId = -1; G.attract = false;
    function __tick() { const dt = 0.78 / 60; if (G.phase === 'pull') pullTick(1 / 60); else { G.gt += dt; update(dt); } G.time += 1 / 60; fxUpdate(1 / 60); }
    // joue un point entier (IA contre IA) ; renvoie le nombre d'images, ou -1 s'il ne finit pas en 10 min de jeu
    function __playPoint() { newWind(); startPoint(); let f = 0; while ((G.phase === 'play' || G.phase === 'pull') && f < 36000) { __tick(); f++; } return f >= 36000 ? -1 : f; }`);
  return { run, sandbox };
}
// fait avancer la simulation jusqu'à ce que cond (code JS) soit vrai ; renvoie le temps écoulé (s), ou -1
export function advance(game, cond, maxSec = 120) {
  return game.run(`(() => { for (let f = 0; f < ${maxSec * 60}; f++) { if (${cond}) return f / 60; __tick(); } return -1; })()`);
}

// ---------- Playwright (tests dans un vrai navigateur) ----------
export function playwright() {
  const req = createRequire(import.meta.url);
  for (const p of ['playwright', 'playwright-core']) { try { return req(p); } catch (e) { } }
  throw new Error('Playwright absent : cd tools/test && npm install && npx playwright install chromium');
}

// ---------- faux stockage Cloudflare (Durable Objects) : clé → valeur + vraie base SQLite (node:sqlite) ----------
// store : Map de l'ancien stockage « clé → valeur » (pour tester la recopie) ; renvoie aussi .db pour lire les tables
export function fakeState(store = new Map()) {
  if (!SQLITE) throw new Error('node:sqlite indisponible : il faut Node 22.13 ou plus');
  const db = new SQLITE(':memory:');
  const norm = v => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v);
  return {
    db, store,
    blockConcurrencyWhile: async fn => fn(),
    storage: {
      get: async k => structuredClone(store.get(k)), put: async (k, v) => { store.set(k, structuredClone(v)); }, delete: async k => store.delete(k),
      list: async ({ prefix = '' } = {}) => new Map([...store].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])),
      sql: { exec: (q, ...b) => { const rows = db.prepare(q).all(...b.map(norm)); return { toArray: () => rows, one: () => rows[0] }; } }
    }
  };
}
// les constructeurs lancent leur préparation (tables, recopie) : on attend qu'elle soit finie
export async function makeDO(Cls, state) { const o = new Cls(state); await new Promise(r => setTimeout(r, 0)); return o; }
export const fakeNs = obj => ({ idFromName: () => 'main', get: () => ({ fetch: (u, o) => obj.fetch(new Request(u, o)) }) });

// ---------- serveur local : les fichiers du site + le vrai worker (/api/turn, /api/scores) ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
export async function startServer({ turnEnv = false } = {}) {
  const { default: worker, Board, Accounts, Gallery } = await import(path.join(ROOT, 'worker', 'index.js'));
  const store = new Map();
  const bs = fakeState(), as = fakeState(), gs = fakeState();
  const board = await makeDO(Board, bs), accounts = await makeDO(Accounts, as), gallery = await makeDO(Gallery, gs);
  const ASSETS = {
    async fetch(req) {
      let p = decodeURIComponent(new URL(req.url).pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, path.normalize(p));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response('introuvable', { status: 404 });
      return new Response(fs.readFileSync(f), { headers: { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' } });
    }
  };
  const env = { ASSETS, BOARD: fakeNs(board), ACCOUNTS: fakeNs(accounts), GALLERY: fakeNs(gallery), GALLERY_ADMINS: 'Admin' };
  if (turnEnv) Object.assign(env, { TURN_KEY_ID: 'test', TURN_KEY_API_TOKEN: 'test' });
  const server = http.createServer(async (rq, rs) => {
    const chunks = []; for await (const c of rq) chunks.push(c);
    const req = new Request('http://' + rq.headers.host + rq.url, { method: rq.method, headers: rq.headers, body: chunks.length && rq.method !== 'GET' ? Buffer.concat(chunks) : undefined });
    const res = await worker.fetch(req, env);
    rs.writeHead(res.status, Object.fromEntries(res.headers));
    rs.end(Buffer.from(await res.arrayBuffer()));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const q = st => (sqlText, ...b) => st.db.prepare(sqlText).all(...b);   // lire les tables pendant un test
  return { url, board: q(bs), accounts: q(as), gallery: q(gs), close: () => new Promise(r => server.close(r)) };
}
