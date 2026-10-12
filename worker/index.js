// worker/index.js — Cloudflare Worker : sert le site (fichiers statiques), GET /api/turn → { iceServers: [...] }
// et /api/scores (classement du mode infini : GET → { top }, POST { name, wins, diff } → { rank, id, top }).
// /api/turn donne des identifiants TURN (relais Cloudflare) TEMPORAIRES. Le jeton reste ici, côté serveur : il n'apparaît
// jamais dans le site. Réglages (Workers → ultimate-frisbee → Settings → Variables and Secrets) :
//   TURN_KEY_ID         identifiant de la clé TURN (Realtime → TURN)
//   TURN_KEY_API_TOKEN  jeton de cette clé (type « Secret »)

const TTL = 4 * 3600;                                          // un identifiant vaut 4 h (largement plus qu'un match)

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

// la requête vient-elle des pages du jeu ? (« none » = adresse tapée à la main, pour le diagnostic)
function sameSite(request) {
  const site = request.headers.get('Sec-Fetch-Site'), origin = request.headers.get('Origin');
  return !((site && site !== 'same-origin' && site !== 'none') || (origin && origin !== new URL(request.url).origin));
}

async function turn(request, env) {
  // seulement depuis les pages du jeu (un autre site ne peut pas se servir du relais)
  if (!sameSite(request)) return json({ error: 'interdit' }, 403);
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

// ---------- classement du mode infini ----------
// Un pseudo n'a qu'une ligne : un nouveau score ne la remplace que s'il est meilleur.
// Un seul « Durable Object » (Board) garde les 100 meilleures séries dans le stockage de Cloudflare (rien à configurer :
// il est déclaré dans wrangler.jsonc). Le score vient du navigateur, donc on vérifie qu'il est possible :
// chaque match gagné rapporte +1 à +3 points d'écart et la défaite finale -1 à -3, d'où wins - 3 ≤ diff ≤ 3 × wins - 1.
const BOARD_MAX = 100, BOARD_SHOW = 50, BOARD_WAIT = 20 * 1000;       // une série toutes les 20 s au plus par adresse IP
const cleanName = n => String(n || '').replace(/[<>&"'`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
const cmpRun = (a, b) => b.wins - a.wins || b.diff - a.diff || a.at - b.at;
function validRun(b) {
  const wins = b && b.wins, diff = b && b.diff;
  if (!Number.isInteger(wins) || !Number.isInteger(diff) || wins < 0 || wins > 500) return null;
  if (diff < wins - 3 || diff > 3 * wins - 1) return null;
  const name = cleanName(b.name);
  return name ? { name, wins, diff } : null;                  // sans pseudo, pas de place au classement
}
export class Board {
  constructor(state) { this.state = state; this.last = new Map(); }
  async fetch(request) {
    let top = (await this.state.storage.get('top')) || [];
    if (request.method !== 'POST') return json({ top: top.slice(0, BOARD_SHOW) });
    const { run, ip } = await request.json(), now = Date.now();
    if (now - (this.last.get(ip) || 0) < BOARD_WAIT) return json({ error: 'trop de scores envoyés, réessaie dans un instant' }, 429);
    this.last.set(ip, now);
    if (this.last.size > 5000) this.last.clear();
    const e = { id: crypto.randomUUID().slice(0, 8), ...run, at: now };
    const key = run.name.toLowerCase(), old = top.find(o => o.name.toLowerCase() === key);
    if (old && cmpRun(old, e) <= 0) {                           // ce pseudo a déjà fait mieux (ou autant) : on garde l'ancien
      return json({ kept: false, best: { wins: old.wins, diff: old.diff }, rank: top.indexOf(old) + 1, id: old.id, top: top.slice(0, BOARD_SHOW) });
    }
    top = top.filter(o => o !== old);
    top.push(e); top.sort(cmpRun);
    const rank = top.indexOf(e) + 1;
    top = top.slice(0, BOARD_MAX);
    await this.state.storage.put('top', top);
    return json({ kept: true, rank, id: rank <= BOARD_MAX ? e.id : null, top: top.slice(0, BOARD_SHOW) });
  }
}
async function scores(request, env) {
  if (!env.BOARD) return json({ error: 'classement non configuré' }, 503);
  const stub = env.BOARD.get(env.BOARD.idFromName('main'));
  if (request.method === 'GET') return stub.fetch('https://board/');
  if (request.method !== 'POST') return json({ error: 'GET ou POST' }, 405);
  if (!sameSite(request)) return json({ error: 'interdit' }, 403);
  let body = null;
  try { body = await request.json(); } catch (e) { }
  const run = validRun(body);
  if (!run) return json({ error: body && !cleanName(body.name) ? 'pseudo manquant' : 'score invalide' }, 400);
  const ip = request.headers.get('CF-Connecting-IP') || '?';
  return stub.fetch('https://board/', { method: 'POST', body: JSON.stringify({ run, ip }) });
}

export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/turn') return request.method === 'GET' ? turn(request, env) : json({ error: 'GET seulement' }, 405);
    if (path === '/api/scores') return scores(request, env);
    return env.ASSETS.fetch(request);
  }
};
