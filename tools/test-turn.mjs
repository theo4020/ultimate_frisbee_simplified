// Test de functions/api/turn.js sans Cloudflare ni Metered (tout est simulé) : node tools/test-turn.mjs
import { onRequestGet } from '../functions/api/turn.js';
const store = new Map(); let calls = 0, n = 0, clock = 1e12, fail = false;
globalThis.caches = { default: { match: async k => store.has(k) ? new Response(store.get(k)) : undefined, put: async (k, r) => store.set(k, await r.text()) } };
Date.now = () => clock;
globalThis.fetch = async (url, o) => {
  calls++; if (fail) return new Response('x', { status: 401 });
  if (o && o.method === 'POST') { n++; return Response.json({ apiKey: 'k' + n }); }
  const k = new URL(url).searchParams.get('apiKey');
  return Response.json([{ urls: 'turn:a', username: 'u-' + k, credential: 'p' }]);
};
const env = { METERED_APP: 'app', METERED_SECRET_KEY: 's' };
const req = (h = { 'Sec-Fetch-Site': 'same-origin' }) => new Request('https://x.pages.dev/api/turn', { headers: h });
const get = async (h, e = env) => { const r = await onRequestGet({ request: req(h), env: e }); return [r.status, await r.json()]; };
const user = async () => (await get())[1].iceServers[0].username;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
ok((await get({ 'Sec-Fetch-Site': 'cross-site' }))[0] === 403, 'autre site refusé');
ok((await get({ Origin: 'https://evil.com' }))[0] === 403, 'mauvaise origine refusée');
ok((await get(undefined, {}))[0] === 503, 'non configuré → 503');
ok(await user() === 'u-k1', 'premier appel crée un identifiant');
const c1 = calls; ok(await user() === 'u-k1' && calls === c1, 'servi depuis le cache, aucun appel Metered');
clock += 6.5 * 3600e3; ok(await user() === 'u-k1' && n === 2, '6h30 : prépare le suivant, sert encore l’ancien');
clock += 60e3; ok(await user() === 'u-k1' && n === 2, '+1 min : suivant pas encore actif');
clock += 120e3; ok(await user() === 'u-k2', '+3 min : bascule sur le nouveau');
const c2 = calls; ok(await user() === 'u-k2' && calls === c2, 'cache du nouveau');
fail = true; clock += 20 * 3600e3; ok((await get())[0] === 502, "erreur Metered → 502");
