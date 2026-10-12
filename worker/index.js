// worker/index.js — Cloudflare Worker : sert le site (fichiers statiques), GET /api/turn → { iceServers: [...] }
// /api/scores (classement du mode infini : GET → { top }, POST { name, wins, diff, token? } → { rank, id, top })
// et /api/account/* (comptes joueurs : register, login, save, logout, delete — voir plus bas).
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
// matchs en 2 points : chaque victoire rapporte +1 ou +2 d'écart et la défaite finale -1 ou -2, d'où wins - 2 ≤ diff ≤ 2 × wins - 1.
// (les scores de l'ancienne formule en 3 points étaient rangés sous une autre clé : le classement repart de zéro)
const BOARD_KEY = 'top-2pts', BOARD_MAX = 100, BOARD_SHOW = 50, BOARD_WAIT = 20 * 1000;       // une série toutes les 20 s au plus par adresse IP
const cleanName = n => String(n || '').replace(/[<>&"'`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
const cmpRun = (a, b) => b.wins - a.wins || b.diff - a.diff || a.at - b.at;
function validRun(b) {
  const wins = b && b.wins, diff = b && b.diff;
  if (!Number.isInteger(wins) || !Number.isInteger(diff) || wins < 0 || wins > 500) return null;
  if (diff < wins - 2 || diff > 2 * wins - 1) return null;
  const name = cleanName(b.name);
  return name ? { name, wins, diff } : null;                  // sans pseudo, pas de place au classement
}
export class Board {
  constructor(state) { this.state = state; this.last = new Map(); }
  async fetch(request) {
    let top = (await this.state.storage.get(BOARD_KEY)) || [];
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
    await this.state.storage.put(BOARD_KEY, top);
    return json({ kept: true, rank, id: rank <= BOARD_MAX ? e.id : null, top: top.slice(0, BOARD_SHOW) });
  }
}
// ---------- comptes ----------
// Un compte = un pseudo réservé + un mot de passe + les données du joueur (profil, succès, records…), pour les
// retrouver sur n'importe quel appareil. Le mot de passe n'est jamais gardé : seulement son empreinte (PBKDF2 salé).
// Après connexion, l'appareil reçoit un jeton qui sert aux sauvegardes (5 appareils connectés au plus).
const DATA_MAX = 64 * 1024, LOGIN_TRIES = 10, LOGIN_WINDOW = 10 * 60 * 1000;
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function pwHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 10000 }, key, 256));
}
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
export class Accounts {
  constructor(state) { this.state = state; this.tries = new Map(); }
  async fetch(request) {
    const { op, name, password, token, data, ip } = await request.json();
    const key = 'u:' + String(name || '').toLowerCase(), now = Date.now();
    const acc = await this.state.storage.get(key);
    const authed = () => acc && token && acc.tokens.includes(token);
    if (op === 'check') return json({ registered: !!acc, ok: !!authed(), name: acc ? acc.name : null });
    if (op === 'register') {
      if (acc) return json({ error: 'ce pseudo est déjà pris' }, 409);
      const salt = randHex(16), t = randHex(16);
      await this.state.storage.put(key, { name, salt, hash: await pwHash(password, salt), tokens: [t], data: data || null, created: now, updated: now });
      return json({ name, token: t, data: data || null });
    }
    if (op === 'login') {
      const tr = (this.tries.get(ip) || []).filter(x => now - x < LOGIN_WINDOW);
      if (tr.length >= LOGIN_TRIES) return json({ error: 'trop d’essais, réessaie dans quelques minutes' }, 429);
      if (!acc || (await pwHash(password, acc.salt)) !== acc.hash) {
        tr.push(now); this.tries.set(ip, tr); if (this.tries.size > 5000) this.tries.clear();
        return json({ error: 'pseudo ou mot de passe incorrect' }, 401);
      }
      const t = randHex(16);
      acc.tokens = acc.tokens.concat([t]).slice(-5);
      await this.state.storage.put(key, acc);
      return json({ name: acc.name, token: t, data: acc.data, updated: acc.updated });
    }
    if (!authed()) return json({ error: 'session expirée, reconnecte-toi' }, 401);
    if (op === 'save') { acc.data = data; acc.updated = now; await this.state.storage.put(key, acc); return json({ updated: now }); }
    if (op === 'load') return json({ name: acc.name, data: acc.data, updated: acc.updated });
    if (op === 'logout') { acc.tokens = acc.tokens.filter(x => x !== token); await this.state.storage.put(key, acc); return json({ ok: true }); }
    if (op === 'delete') { await this.state.storage.delete(key); return json({ ok: true }); }
    return json({ error: 'action inconnue' }, 400);
  }
}
const accStub = env => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('main'));
async function account(request, env, op) {
  if (!env.ACCOUNTS) return json({ error: 'comptes non configurés' }, 503);
  if (request.method !== 'POST') return json({ error: 'POST seulement' }, 405);
  if (!sameSite(request)) return json({ error: 'interdit' }, 403);
  let b = null;
  try { b = await request.json(); } catch (e) { }
  if (!b || typeof b !== 'object') return json({ error: 'requête invalide' }, 400);
  const name = cleanName(b.name);
  if (name.length < 3) return json({ error: 'pseudo trop court (3 caractères au moins)' }, 400);
  const password = typeof b.password === 'string' ? b.password : '';
  if ((op === 'register' || op === 'login') && (password.length < 4 || password.length > 64)) return json({ error: 'mot de passe de 4 à 64 caractères' }, 400);
  let data = null;
  if (op === 'save' || op === 'register') {
    data = b.data && typeof b.data === 'object' ? b.data : null;
    if (data && JSON.stringify(data).length > DATA_MAX) return json({ error: 'données trop volumineuses' }, 413);
    if (op === 'save' && !data) return json({ error: 'rien à sauvegarder' }, 400);
  }
  const body = { op, name, password, token: typeof b.token === 'string' ? b.token : '', data, ip: request.headers.get('CF-Connecting-IP') || '?' };
  return accStub(env).fetch('https://acc/', { method: 'POST', body: JSON.stringify(body) });
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
  if (env.ACCOUNTS) {                                          // pseudo d'un compte : seulement par son propriétaire, et écrit comme lui
    const c = await (await accStub(env).fetch('https://acc/', { method: 'POST', body: JSON.stringify({ op: 'check', name: run.name, token: typeof body.token === 'string' ? body.token : '' }) })).json();
    if (c.registered && !c.ok) return json({ error: 'ce pseudo appartient à un compte : connecte-toi pour l’utiliser' }, 403);
    if (c.registered) run.name = c.name;
  }
  const ip = request.headers.get('CF-Connecting-IP') || '?';
  return stub.fetch('https://board/', { method: 'POST', body: JSON.stringify({ run, ip }) });
}

export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/turn') return request.method === 'GET' ? turn(request, env) : json({ error: 'GET seulement' }, 405);
    if (path === '/api/scores') return scores(request, env);
    const m = /^\/api\/account\/(register|login|save|load|logout|delete)$/.exec(path);
    if (m) return account(request, env, m[1]);
    return env.ASSETS.fetch(request);
  }
};
