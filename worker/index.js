// worker/index.js — Cloudflare Worker : sert le site (fichiers statiques), GET /api/turn → { iceServers: [...] }
// /api/gallery (galerie de systèmes : list, get, publish, unpublish, like — voir plus bas)
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

// ---------- galerie de systèmes ----------
// Chacun publie ses systèmes (compte obligatoire) ; tout le monde les parcourt, les essaie et les ajoute ; un ❤ par compte.
// Les pseudos listés dans la variable GALLERY_ADMINS (séparés par des virgules) peuvent retirer n'importe quelle publication.
const GAL_MAX = 2000, GAL_PER_USER = 20, GAL_LIST = 60;
const num = (v, a, b) => (typeof v === 'number' && isFinite(v) ? Math.round(Math.min(b, Math.max(a, v)) * 10) / 10 : null);
const pt = p => (Array.isArray(p) && num(p[0], -12, 40) !== null && num(p[1], -18, 18) !== null ? [num(p[0], -12, 40), num(p[1], -18, 18)] : null);
const ROLES = ['normal', 'serre', 'profond', 'double'];
function validSys(o) {                                           // même règles que cleanSystem (js/systems.js), côté serveur
  if (!o || typeof o !== 'object' || (o.kind !== 'off' && o.kind !== 'def')) return null;
  const name = String(o.name || '').replace(/[<>&"'`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) return null;
  const id = typeof o.id === 'string' && /^[a-z0-9]{3,12}$/.test(o.id) ? o.id : null;
  if (o.kind === 'off') {
    const pos = Array.isArray(o.pos) ? o.pos.slice(0, 4).map(pt) : [];
    if (pos.length !== 4 || pos.includes(null)) return null;
    const steps = (Array.isArray(o.steps) ? o.steps : []).slice(0, 12).map(s => s && Number.isInteger(s.p) && s.p >= 0 && s.p < 4 && pt(s.to)
      ? { p: s.p, to: pt(s.to), wait: num(s.wait, 0, 3) ?? 0.6 } : null).filter(Boolean);
    return { id, kind: 'off', name, pos, steps, setup: !!o.setup };
  }
  const zone = Array.isArray(o.zone) ? o.zone.slice(0, 4).map(pt) : [];
  if (zone.length !== 4 || zone.includes(null)) return null;
  const roles = Array.from({ length: 5 }, (_, i) => (Array.isArray(o.roles) && ROLES.includes(o.roles[i]) ? o.roles[i] : 'normal'));
  return { id, kind: 'def', name, mode: o.mode === 'man' ? 'man' : 'zone', zone, roles };
}
const sysInfo = s => (s.kind === 'off' ? s.steps.length + ' course' + (s.steps.length > 1 ? 's' : '') : s.mode === 'zone' ? 'zone' : 'individuelle');
export class Gallery {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const b = await request.json(), S = this.state.storage;
    let idx = (await S.get('idx')) || [];
    const lc = s => String(s || '').toLowerCase();
    if (b.op === 'list') {
      let L = idx;
      if (b.kind === 'off' || b.kind === 'def') L = L.filter(e => e.kind === b.kind);
      if (b.q) { const q = lc(b.q).slice(0, 30); L = L.filter(e => lc(e.name).includes(q) || lc(e.by).includes(q)); }
      if (b.mine && b.user) L = L.filter(e => lc(e.by) === lc(b.user));
      L = L.slice().sort(b.sort === 'new' ? (x, y) => y.at - x.at : (x, y) => y.likes - x.likes || y.at - x.at).slice(0, GAL_LIST);
      const liked = b.user ? new Set((await S.get('likes:' + lc(b.user))) || []) : new Set();
      return json({ items: L.map(e => ({ ...e, liked: liked.has(e.id) })), total: idx.length });
    }
    if (b.op === 'get') {
      const it = await S.get('i:' + b.id), e = idx.find(x => x.id === b.id);
      return it && e ? json({ item: { ...e, sys: it } }) : json({ error: 'publication introuvable' }, 404);
    }
    if (b.op === 'publish') {
      const sys = b.sys, user = b.user;
      let e = idx.find(x => lc(x.by) === lc(user) && x.src && x.src === sys.id);   // même système republié : on met à jour
      if (!e) {
        if (idx.filter(x => lc(x.by) === lc(user)).length >= GAL_PER_USER) return json({ error: GAL_PER_USER + ' publications au plus par compte' }, 429);
        if (idx.length >= GAL_MAX) return json({ error: 'galerie pleine' }, 507);
        e = { id: crypto.randomUUID().slice(0, 8), src: sys.id, by: user, likes: 0, at: Date.now() };
        idx.push(e);
      }
      Object.assign(e, { kind: sys.kind, name: sys.name, info: sysInfo(sys), up: Date.now() });
      await S.put('i:' + e.id, { ...sys, id: undefined });
      await S.put('idx', idx);
      return json({ id: e.id });
    }
    if (b.op === 'unpublish') {
      const e = idx.find(x => x.id === b.id);
      if (!e) return json({ error: 'publication introuvable' }, 404);
      if (lc(e.by) !== lc(b.user) && !b.admin) return json({ error: 'seul son auteur peut la retirer' }, 403);
      idx = idx.filter(x => x !== e);
      await S.delete('i:' + e.id); await S.put('idx', idx);
      return json({ ok: true });
    }
    if (b.op === 'like') {
      const e = idx.find(x => x.id === b.id);
      if (!e) return json({ error: 'publication introuvable' }, 404);
      const key = 'likes:' + lc(b.user), mine = new Set((await S.get(key)) || []);
      if (mine.has(e.id)) { mine.delete(e.id); e.likes = Math.max(0, e.likes - 1); } else { mine.add(e.id); e.likes++; }
      await S.put(key, [...mine]); await S.put('idx', idx);
      return json({ likes: e.likes, liked: mine.has(e.id) });
    }
    return json({ error: 'action inconnue' }, 400);
  }
}
async function gallery(request, env) {
  if (!env.GALLERY) return json({ error: 'galerie indisponible' }, 503);
  if (request.method !== 'POST') return json({ error: 'POST seulement' }, 405);
  if (!sameSite(request)) return json({ error: 'interdit' }, 403);
  let b = null;
  try { b = await request.json(); } catch (e) { }
  if (!b || typeof b !== 'object' || !['list', 'get', 'publish', 'unpublish', 'like'].includes(b.op)) return json({ error: 'requête invalide' }, 400);
  const out = { op: b.op, id: typeof b.id === 'string' ? b.id.slice(0, 12) : '', kind: b.kind, sort: b.sort, q: typeof b.q === 'string' ? b.q : '', mine: !!b.mine };
  // qui est-ce ? (obligatoire pour publier, retirer, aimer ; facultatif pour lister : on renvoie alors ses ❤)
  if (b.name && b.token && env.ACCOUNTS) {
    const c = await (await accStub(env).fetch('https://acc/', { method: 'POST', body: JSON.stringify({ op: 'check', name: cleanName(b.name), token: String(b.token) }) })).json();
    if (c.ok) { out.user = c.name; out.admin = String(env.GALLERY_ADMINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(c.name.toLowerCase()); }
  }
  if (['publish', 'unpublish', 'like'].includes(b.op) && !out.user) return json({ error: 'connecte-toi à ton compte pour ça' }, 401);
  if (b.op === 'publish') { out.sys = validSys(b.sys); if (!out.sys || !out.sys.id) return json({ error: 'système invalide' }, 400); }
  return env.GALLERY.get(env.GALLERY.idFromName('main')).fetch('https://gal/', { method: 'POST', body: JSON.stringify(out) });
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
    if (path === '/api/gallery') return gallery(request, env);
    const m = /^\/api\/account\/(register|login|save|load|logout|delete)$/.exec(path);
    if (m) return account(request, env, m[1]);
    return env.ASSETS.fetch(request);
  }
};
