// functions/api/turn.js — Cloudflare Pages Function : GET /api/turn → { iceServers: [...] }
// Donne au jeu des identifiants TURN (relais Metered) TEMPORAIRES. La clé secrète Metered reste ici, côté serveur :
// elle n'apparaît jamais dans le site. Réglages (Cloudflare Pages → Settings → Variables and Secrets) :
//   METERED_APP         nom de l'application Metered (ce qui est avant .metered.live)
//   METERED_SECRET_KEY  clé secrète Metered (type « Secret »)
// Un identifiant vit 8 h. Il est partagé par tous les joueurs (mis en cache) et renouvelé 2 h avant la fin ;
// le nouveau n'est servi qu'au bout de 2 min 30 (Metered met jusqu'à 2 min à l'activer).

const LIFETIME = 8 * 3600, ROTATE_BEFORE = 2 * 3600 * 1000, WARMUP = 150 * 1000;
const CACHE_KEY = 'https://turn-cache.internal/ultimate-frisbee';

// état gardé en mémoire (tant que Cloudflare garde la fonction chaude) et dans le cache Cloudflare (qui peut être inactif sur *.pages.dev)
let mem = null;
async function loadState() {
  if (mem) return mem;
  try { const r = await caches.default.match(CACHE_KEY); if (r) return (mem = await r.json()); } catch (e) { }
  return (mem = {});
}
async function saveState(st) {
  mem = st;
  try { await caches.default.put(CACHE_KEY, new Response(JSON.stringify(st), { headers: { 'Cache-Control': 'max-age=' + LIFETIME } })); } catch (e) { }
}
async function createCredential(env, now) {
  const base = `https://${env.METERED_APP}.metered.live/api/v1/turn`;
  const c = await fetch(`${base}/credential?secretKey=${encodeURIComponent(env.METERED_SECRET_KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiryInSeconds: LIFETIME, label: 'ultimate-frisbee-auto' })
  });
  if (!c.ok) throw new Error('création refusée par Metered (' + c.status + ')');
  const { apiKey } = await c.json();
  const l = await fetch(`${base}/credentials?apiKey=${encodeURIComponent(apiKey)}`);
  if (!l.ok) throw new Error('liste des serveurs refusée par Metered (' + l.status + ')');
  const ice = await l.json();
  if (!Array.isArray(ice) || !ice.length) throw new Error('réponse Metered vide');
  return { ice, exp: now + LIFETIME * 1000, created: now };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

export async function onRequestGet({ request, env }) {
  // seulement depuis les pages du jeu (un autre site ne peut pas se servir du relais)
  const site = request.headers.get('Sec-Fetch-Site'), origin = request.headers.get('Origin');
  const self = new URL(request.url).origin;
  if ((site && site !== 'same-origin') || (origin && origin !== self)) return json({ error: 'interdit' }, 403);
  if (!env.METERED_APP || !env.METERED_SECRET_KEY) return json({ error: 'relais non configuré' }, 503);

  const now = Date.now();
  try {
    const st = await loadState();
    const valid = c => c && c.exp - now > 10 * 60 * 1000;           // encore au moins 10 min
    if (st.next && now - st.next.created > WARMUP && (!valid(st.cur) || st.cur.exp - now < ROTATE_BEFORE)) {
      st.cur = st.next; st.next = null; await saveState(st);        // le nouvel identifiant est actif : on bascule
    }
    if (valid(st.cur) && st.cur.exp - now > ROTATE_BEFORE) return json({ iceServers: st.cur.ice });
    if (!st.next) { st.next = await createCredential(env, now); await saveState(st); }   // on prépare le suivant
    return json({ iceServers: valid(st.cur) ? st.cur.ice : st.next.ice });                // tout premier appel : le neuf
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
