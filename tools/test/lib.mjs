// lib.mjs — Outils communs aux tests : vérifications, jeu chargé sans navigateur, petit serveur local.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

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

// ---------- faux stockage Cloudflare (Durable Objects) ----------
export const fakeState = store => ({ storage: { get: async k => structuredClone(store.get(k)), put: async (k, v) => { store.set(k, structuredClone(v)); }, delete: async k => store.delete(k) } });
export const fakeNs = obj => ({ idFromName: () => 'main', get: () => ({ fetch: (u, o) => obj.fetch(new Request(u, o)) }) });

// ---------- serveur local : les fichiers du site + le vrai worker (/api/turn, /api/scores) ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
export async function startServer({ turnEnv = false } = {}) {
  const { default: worker, Board, Accounts } = await import(path.join(ROOT, 'worker', 'index.js'));
  const store = new Map();
  const board = new Board(fakeState(store)), accStore = new Map(), accounts = new Accounts(fakeState(accStore));
  const ASSETS = {
    async fetch(req) {
      let p = decodeURIComponent(new URL(req.url).pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, path.normalize(p));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response('introuvable', { status: 404 });
      return new Response(fs.readFileSync(f), { headers: { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' } });
    }
  };
  const env = { ASSETS, BOARD: fakeNs(board), ACCOUNTS: fakeNs(accounts) };
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
  return { url, board: store, accounts: accStore, close: () => new Promise(r => server.close(r)) };
}
