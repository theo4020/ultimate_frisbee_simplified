// Test de worker/index.js sans Cloudflare (tout est simulé) : node tools/test-worker.mjs
import worker from '../worker/index.js';
let status = 201, last = null;
globalThis.fetch = async (url, o) => {
  last = { url, o };
  if (status !== 201) return new Response('x', { status });
  return Response.json({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' },
    { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'p' }] }, { status: 201 });
};
const env = { TURN_KEY_ID: 'kid', TURN_KEY_API_TOKEN: 'tok', ASSETS: { fetch: async () => new Response('page') } };
const call = async (path, h = { 'Sec-Fetch-Site': 'same-origin' }, e = env, method = 'GET') => {
  const r = await worker.fetch(new Request('https://jeu.example' + path, { headers: h, method }), e);
  return [r.status, await r.text()];
};
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
ok((await call('/index.html'))[1] === 'page', 'les pages du site passent aux fichiers statiques');
ok((await call('/api/turn', { 'Sec-Fetch-Site': 'cross-site' }))[0] === 403, 'autre site refusé');
ok((await call('/api/turn', { Origin: 'https://evil.com' }))[0] === 403, 'mauvaise origine refusée');
ok((await call('/api/turn', { 'Sec-Fetch-Site': 'none' }))[0] === 200, 'adresse ouverte à la main (diagnostic) acceptée');
{ const [st, bd] = await call('/api/turn', undefined, { ASSETS: env.ASSETS, TURN_KEY: 'secret-value' });
  ok(st === 503 && bd.includes('TURN_KEY_ID et TURN_KEY_API_TOKEN') && bd.includes('TURN_KEY') && !bd.includes('secret-value'), 'non configuré → 503, noms seulement'); }
ok((await call('/api/turn', undefined, env, 'POST'))[0] === 405, 'POST refusé');
const [s, b] = await call('/api/turn'), ice = JSON.parse(b).iceServers;
ok(s === 200 && ice.length === 2, 'identifiants renvoyés');
ok(last.url.includes('/keys/kid/') && last.o.headers.Authorization === 'Bearer tok' && JSON.parse(last.o.body).ttl === 14400, 'appel Cloudflare correct (clé, jeton, 4 h)');
ok(!b.includes(':53'), 'port 53 retiré');
ok(!b.includes('tok'), 'le jeton ne sort jamais');
status = 401; ok((await call('/api/turn'))[0] === 502, 'erreur Cloudflare → 502');
