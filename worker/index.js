// worker/index.js — Cloudflare Worker : sert le site (fichiers statiques) et GET /api/turn → { iceServers: [...] }
// /api/turn donne des identifiants TURN (relais Cloudflare) TEMPORAIRES. Le jeton reste ici, côté serveur : il n'apparaît
// jamais dans le site. Réglages (Workers → ultimate-frisbee → Settings → Variables and Secrets) :
//   TURN_KEY_ID         identifiant de la clé TURN (Realtime → TURN)
//   TURN_KEY_API_TOKEN  jeton de cette clé (type « Secret »)

const TTL = 4 * 3600;                                          // un identifiant vaut 4 h (largement plus qu'un match)

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

async function turn(request, env) {
  // seulement depuis les pages du jeu (un autre site ne peut pas se servir du relais) ; « none » = adresse tapée à la main (diagnostic)
  const site = request.headers.get('Sec-Fetch-Site'), origin = request.headers.get('Origin');
  if ((site && site !== 'same-origin' && site !== 'none') || (origin && origin !== new URL(request.url).origin)) return json({ error: 'interdit' }, 403);
  const missing = ['TURN_KEY_ID', 'TURN_KEY_API_TOKEN'].filter(k => !env[k]);
  if (missing.length) {                                        // seulement des NOMS (jamais de valeurs), pour comprendre le réglage
    const seen = Object.keys(env).filter(k => k !== 'ASSETS');
    return json({ error: 'relais non configuré : manque ' + missing.join(' et ') + ' — variables vues : ' + (seen.join(', ') || 'aucune') }, 503);
  }
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.TURN_KEY_API_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TTL })
    });
    if (!r.ok) throw new Error('refusé par Cloudflare (' + r.status + ')');
    const { iceServers } = await r.json();
    if (!Array.isArray(iceServers) || !iceServers.length) throw new Error('réponse vide');
    // le port 53 est bloqué par les navigateurs : on le retire pour ne pas attendre pour rien
    const ice = iceServers.map(s => ({ ...s, urls: [].concat(s.urls).filter(u => !/:53(\?|$)/.test(u)) })).filter(s => s.urls.length);
    return json({ iceServers: ice });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === '/api/turn') return request.method === 'GET' ? turn(request, env) : json({ error: 'GET seulement' }, 405);
    return env.ASSETS.fetch(request);
  }
};
