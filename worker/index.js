// worker/index.js — Cloudflare Worker : sert le site (fichiers statiques), GET /api/turn → { iceServers: [...] }
// /api/gallery (galerie de systèmes : list, get, publish, unpublish, like — voir plus bas)
// /api/scores (classement du mode infini : GET → { top }, POST { name, wins, diff, token? } → { rank, id, top } ;
//              ?mode=coop : classement à part du mode infini à plusieurs, avec un nom d'équipe)
// et /api/account/* (comptes joueurs : register, login, save, logout, delete, rename — voir plus bas).
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

// ---------- stockage : de vraies tables SQL (lisibles et modifiables dans Cloudflare → Durable Objects → Data Studio) ----------
// sql(state) : all(requête, ...valeurs) → lignes · one(...) → première ligne ou null · run(...) pour écrire.
function sql(state) {
  const S = state.storage.sql;
  const all = (q, ...b) => S.exec(q, ...b).toArray();
  return { all, one: (q, ...b) => all(q, ...b)[0] || null, run: (q, ...b) => { S.exec(q, ...b); } };
}
// une seule fois : recopie les données de l'ancien stockage « clé → valeur » dans les tables (elles restent aussi à l'ancien endroit)
async function migrateOnce(state, db, copy) {
  db.run('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');
  if (db.one("SELECT v FROM meta WHERE k = 'kv_migrated'")) return;
  await copy();
  db.run("INSERT INTO meta (k, v) VALUES ('kv_migrated', ?)", String(Date.now()));
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
// mode infini à plusieurs : classement à part (un autre objet Board, « coop »), nom d'équipe jusqu'à 24 caractères
const cleanTeam = n => String(n || '').replace(/[<>&"'`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
function validRun(b, coop) {
  const wins = b && b.wins, diff = b && b.diff;
  if (!Number.isInteger(wins) || !Number.isInteger(diff) || wins < 0 || wins > 500) return null;
  if (diff < wins - 2 || diff > 2 * wins - 1) return null;
  const name = coop ? cleanTeam(b.name) : cleanName(b.name);
  return name ? { name, wins, diff } : null;                  // sans pseudo, pas de place au classement
}
export class Board {
  constructor(state) {
    this.state = state; this.last = new Map(); this.db = sql(state);
    state.blockConcurrencyWhile(async () => {
      // classement : une ligne par pseudo (k = pseudo en minuscules)
      this.db.run('CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY, k TEXT UNIQUE, name TEXT, wins INTEGER, diff INTEGER, at INTEGER)');
      await migrateOnce(state, this.db, async () => {
        for (const e of (await state.storage.get(BOARD_KEY)) || [])
          this.db.run('INSERT OR IGNORE INTO scores (id, k, name, wins, diff, at) VALUES (?, ?, ?, ?, ?, ?)', e.id, e.name.toLowerCase(), e.name, e.wins, e.diff, e.at);
      });
    });
  }
  top(n) { return this.db.all('SELECT id, name, wins, diff, at FROM scores ORDER BY wins DESC, diff DESC, at ASC LIMIT ?', n); }
  rankOf(e) { return this.db.one('SELECT COUNT(*) AS n FROM scores WHERE wins > ? OR (wins = ? AND (diff > ? OR (diff = ? AND at < ?)))', e.wins, e.wins, e.diff, e.diff, e.at).n + 1; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/has') { const { k } = await request.json(); return json({ has: !!this.db.one('SELECT 1 AS x FROM scores WHERE k = ?', k) }); }
    if (path === '/rename') {                                   // un compte change de pseudo : sa ligne du classement suit
      const { from, to } = await request.json();
      this.db.run('UPDATE scores SET k = ?, name = ? WHERE k = ?', to.toLowerCase(), to, from);
      return json({ ok: true });
    }
    if (request.method !== 'POST') return json({ top: this.top(BOARD_SHOW) });
    const { run, ip } = await request.json(), now = Date.now();
    if (now - (this.last.get(ip) || 0) < BOARD_WAIT) return json({ error: 'trop de scores envoyés, réessaie dans un instant' }, 429);
    this.last.set(ip, now);
    if (this.last.size > 5000) this.last.clear();
    const e = { id: crypto.randomUUID().slice(0, 8), ...run, at: now }, k = run.name.toLowerCase();
    const old = this.db.one('SELECT id, name, wins, diff, at FROM scores WHERE k = ?', k);
    if (old && cmpRun(old, e) <= 0) {                           // ce pseudo a déjà fait mieux (ou autant) : on garde l'ancien
      return json({ kept: false, best: { wins: old.wins, diff: old.diff }, rank: this.rankOf(old), id: old.id, top: this.top(BOARD_SHOW) });
    }
    this.db.run('DELETE FROM scores WHERE k = ?', k);
    this.db.run('INSERT INTO scores (id, k, name, wins, diff, at) VALUES (?, ?, ?, ?, ?, ?)', e.id, k, e.name, e.wins, e.diff, e.at);
    const rank = this.rankOf(e);
    this.db.run('DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY wins DESC, diff DESC, at ASC LIMIT ?)', BOARD_MAX);
    return json({ kept: true, rank, id: rank <= BOARD_MAX ? e.id : null, top: this.top(BOARD_SHOW) });
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
  constructor(state) {
    this.state = state; this.tries = new Map(); this.db = sql(state);
    state.blockConcurrencyWhile(async () => {
      // comptes : k = pseudo en minuscules ; tokens et data en JSON (data = profil sauvegardé du joueur)
      this.db.run('CREATE TABLE IF NOT EXISTS accounts (k TEXT PRIMARY KEY, name TEXT, salt TEXT, hash TEXT, tokens TEXT, data TEXT, created INTEGER, updated INTEGER)');
      // ancien pseudo → nouveau, pour prévenir les autres appareils d'un compte qui a changé de pseudo
      this.db.run('CREATE TABLE IF NOT EXISTS aliases (old TEXT PRIMARY KEY, name TEXT)');
      await migrateOnce(state, this.db, async () => {
        for (const [key, a] of await state.storage.list({ prefix: 'u:' })) this.put(key.slice(2), a);
      });
    });
  }
  get(k) {
    const r = this.db.one('SELECT * FROM accounts WHERE k = ?', k);
    return r ? { name: r.name, salt: r.salt, hash: r.hash, tokens: JSON.parse(r.tokens || '[]'), data: r.data ? JSON.parse(r.data) : null, created: r.created, updated: r.updated } : null;
  }
  put(k, a) {
    this.db.run('INSERT OR REPLACE INTO accounts (k, name, salt, hash, tokens, data, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      k, a.name, a.salt, a.hash, JSON.stringify(a.tokens || []), a.data ? JSON.stringify(a.data) : null, a.created || 0, a.updated || 0);
  }
  async fetch(request) {
    const { op, name, password, token, data, ip, newName } = await request.json();
    const k = String(name || '').toLowerCase(), now = Date.now();
    const acc = this.get(k);
    if (!acc && op !== 'check' && op !== 'register') {          // ancien pseudo d'un compte renommé : on donne le nouveau
      const al = this.db.one('SELECT name FROM aliases WHERE old = ?', k);
      if (al) return json({ error: 'ce compte s’appelle maintenant ' + al.name, renamed: al.name }, 409);
    }
    const authed = () => acc && token && acc.tokens.includes(token);
    if (op === 'check') return json({ registered: !!acc, ok: !!authed(), name: acc ? acc.name : null });
    if (op === 'register') {
      if (acc) return json({ error: 'ce pseudo est déjà pris' }, 409);
      const salt = randHex(16), t = randHex(16);
      this.db.run('DELETE FROM aliases WHERE old = ?', k);        // un ancien pseudo libéré peut être repris
      this.put(k, { name, salt, hash: await pwHash(password, salt), tokens: [t], data: data || null, created: now, updated: now });
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
      this.put(k, acc);
      return json({ name: acc.name, token: t, data: acc.data, updated: acc.updated });
    }
    if (!authed()) return json({ error: 'session expirée, reconnecte-toi' }, 401);
    if (op === 'save') { acc.data = data; acc.updated = now; this.put(k, acc); return json({ updated: now }); }
    if (op === 'load') return json({ name: acc.name, data: acc.data, updated: acc.updated });
    if (op === 'logout') { acc.tokens = acc.tokens.filter(x => x !== token); this.put(k, acc); return json({ ok: true }); }
    if (op === 'delete') { this.db.run('DELETE FROM accounts WHERE k = ?', k); return json({ ok: true }); }
    if (op === 'rename') {                                       // nouveau pseudo : tout le compte le suit (jetons, données)
      const nk = newName.toLowerCase();
      if (nk !== k && this.get(nk)) return json({ error: 'ce pseudo est déjà pris' }, 409);
      this.db.run('DELETE FROM accounts WHERE k = ?', k);
      this.put(nk, Object.assign(acc, { name: newName, updated: now }));
      if (nk !== k) {
        this.db.run('DELETE FROM aliases WHERE old = ?', nk);
        this.db.run('UPDATE aliases SET name = ? WHERE lower(name) = ?', newName, k);   // renommages en chaîne
        this.db.run('INSERT OR REPLACE INTO aliases (old, name) VALUES (?, ?)', k, newName);
      }
      return json({ name: newName, updated: now });
    }
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
  if (op === 'rename') return renameAccount(env, body, cleanName(b.newName));
  return accStub(env).fetch('https://acc/', { method: 'POST', body: JSON.stringify(body) });
}
// changer de pseudo : le compte, sa ligne du classement et ses publications de la galerie prennent le nouveau nom
async function renameAccount(env, body, to) {
  if (to.length < 3) return json({ error: 'pseudo trop court (3 caractères au moins)' }, 400);
  const from = body.name.toLowerCase(), post = (stub, url, o) => stub.fetch(url, { method: 'POST', body: JSON.stringify(o) }).then(r => r.json());
  const board = env.BOARD && env.BOARD.get(env.BOARD.idFromName('main'));
  // le nouveau pseudo a déjà un score (joueur sans compte) : on ne lui prend pas sa place
  if (board && to.toLowerCase() !== from && (await post(board, 'https://board/has', { k: to.toLowerCase() })).has)
    return json({ error: 'ce pseudo est déjà au classement : choisis-en un autre' }, 409);
  const r = await accStub(env).fetch('https://acc/', { method: 'POST', body: JSON.stringify(Object.assign(body, { newName: to })) });
  const j = await r.json();
  if (!r.ok) return json(j, r.status);
  if (board) await post(board, 'https://board/rename', { from, to });
  if (env.GALLERY) await post(env.GALLERY.get(env.GALLERY.idFromName('main')), 'https://gal/rename', { from, to });
  return json(j);
}

// ---------- galerie de systèmes ----------
// Chacun publie ses systèmes (compte obligatoire) ; tout le monde les parcourt, les essaie et les ajoute ; un ❤ par compte.
// Les pseudos listés dans la variable GALLERY_ADMINS (séparés par des virgules) peuvent retirer n'importe quelle publication.
const GAL_MAX = 2000, GAL_PER_USER = 20, GAL_LIST = 60;
const num = (v, a, b) => (typeof v === 'number' && isFinite(v) ? Math.round(Math.min(b, Math.max(a, v)) * 10) / 10 : null);
const pt = p => (Array.isArray(p) && num(p[0], -12, 40) !== null && num(p[1], -18, 18) !== null ? [num(p[0], -12, 40), num(p[1], -18, 18)] : null);
const ROLES = ['normal', 'serre', 'profond', 'double'];
const cleanSteps = st => (Array.isArray(st) ? st : []).slice(0, 12).map(s => s && Number.isInteger(s.p) && s.p >= 0 && s.p < 4 && pt(s.to)
  ? { p: s.p, to: pt(s.to), wait: num(s.wait, 0, 3) ?? 0.6 } : null).filter(Boolean);
function validSys(o) {                                           // même règles que cleanSystem (js/systems.js), côté serveur
  if (!o || typeof o !== 'object' || !['off', 'play', 'def'].includes(o.kind)) return null;
  const name = String(o.name || '').replace(/[<>&"'`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) return null;
  const id = typeof o.id === 'string' && /^[a-z0-9]{3,12}$/.test(o.id) ? o.id : null;
  if (o.kind === 'off') {
    const pos = Array.isArray(o.pos) ? o.pos.slice(0, 4).map(pt) : [];
    if (pos.length !== 4 || pos.includes(null)) return null;
    const steps = cleanSteps(o.steps);
    const P = { role: ['cutter', 'dump', 'deep'], zone: ['auto', 'open', 'break', 'deep', 'under'], when: ['auto', 'turn', 'catch', 'stall', 'never'], after: ['auto', 'back', 'clear', 'chain'], fake: ['yes', 'no'] };
    const postes = Array.from({ length: 4 }, (_, i) => { const q = Array.isArray(o.postes) && o.postes[i] || {}, r = {}; for (const k in P) r[k] = P[k].includes(q[k]) ? q[k] : P[k][0]; return r; });
    return steps.length ? { id, kind: 'off', name, pos, postes, steps, setup: !!o.setup } : { id, kind: 'off', name, pos, postes };
  }
  if (o.kind === 'play') {
    const base = typeof o.base === 'string' && /^(vert|ho|side|sys:[a-z0-9]{3,12})$/.test(o.base) ? o.base : 'vert';
    const pos = Array.isArray(o.pos) ? o.pos.slice(0, 4).map(pt) : [];
    return Object.assign({ id, kind: 'play', name, base, steps: cleanSteps(o.steps), setup: !!o.setup }, pos.length === 4 && !pos.includes(null) ? { pos } : {});
  }
  if (Array.isArray(o.postes)) {                                  // défense : la mark + 4 défenseurs (zone ou individuelle)
    const one = (v, list) => (list.includes(String(v)) ? String(v) : list[0]);
    const m = o.mark || {}, mark = { force: one(m.force, ['menu', 'haut', 'bas', 'middle', 'straight']), dist: one(m.dist, ['normale', 'serree', 'lache']), double: one(m.double, ['0', '4', '6', '8']) };
    const postes = Array.from({ length: 4 }, (_, i) => { const q = o.postes[i] || {};
      return { mission: one(q.mission, ['zone', 'man']), pos: pt(q.pos) || [10, 0], side: one(q.side, ['auto', 'deep', 'open', 'break']), gap: one(q.gap, ['normal', 'serre', 'lache']),
        behave: one(q.behave, ['shift', 'place', 'deep', 'press']), help: one(q.help, ['oui', 'non']), swap: one(q.swap, ['oui', 'non']) }; });
    return { id, kind: 'def', name, mark, postes };
  }
  const zone = Array.isArray(o.zone) ? o.zone.slice(0, 4).map(pt) : [];
  if (zone.length !== 4 || zone.includes(null)) return null;
  const roles = Array.from({ length: 5 }, (_, i) => (Array.isArray(o.roles) && ROLES.includes(o.roles[i]) ? o.roles[i] : 'normal'));
  return { id, kind: 'def', name, mode: o.mode === 'man' ? 'man' : 'zone', zone, roles };
}
const sysInfo = s => (s.kind === 'play' ? s.steps.length + ' course' + (s.steps.length > 1 ? 's' : '') : s.kind === 'off' ? 'formation'
  : s.postes ? (n => (n === 4 ? 'zone' : n ? 'mixte' : 'individuelle'))(s.postes.filter(q => q.mission === 'zone').length) : s.mode === 'zone' ? 'zone' : 'individuelle');
export class Gallery {
  constructor(state) {
    this.state = state; this.db = sql(state);
    state.blockConcurrencyWhile(async () => {
      // galerie : une ligne par publication (sys = le système complet, en JSON) ; likes : une ligne par ❤ (compte, publication)
      this.db.run('CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, src TEXT, author TEXT, bykey TEXT, kind TEXT, name TEXT, info TEXT, likes INTEGER, at INTEGER, up INTEGER, sys TEXT)');
      this.db.run('CREATE TABLE IF NOT EXISTS likes (user TEXT, item TEXT, PRIMARY KEY (user, item))');
      await migrateOnce(state, this.db, async () => {
        for (const e of (await state.storage.get('idx')) || []) {
          const sys = await state.storage.get('i:' + e.id);
          this.db.run('INSERT OR IGNORE INTO items (id, src, author, bykey, kind, name, info, likes, at, up, sys) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            e.id, e.src || null, e.by, e.by.toLowerCase(), e.kind, e.name, e.info || '', e.likes || 0, e.at || 0, e.up || e.at || 0, JSON.stringify(sys || {}));
        }
        for (const [key, ids] of await state.storage.list({ prefix: 'likes:' }))
          for (const id of ids || []) this.db.run('INSERT OR IGNORE INTO likes (user, item) VALUES (?, ?)', key.slice(6), id);
      });
    });
  }
  async fetch(request) {
    const b = await request.json(), db = this.db, lc = s => String(s || '').toLowerCase();
    if (new URL(request.url).pathname === '/rename') {         // un compte change de pseudo : ses publications et ses ❤ suivent
      db.run('UPDATE items SET author = ?, bykey = ? WHERE bykey = ?', b.to, lc(b.to), b.from);
      db.run('UPDATE likes SET user = ? WHERE user = ?', lc(b.to), b.from);
      return json({ ok: true });
    }
    const COLS = 'id, src, author AS "by", kind, name, info, likes, at, up';
    if (b.op === 'list') {
      const where = [], args = [];
      if (['off', 'play', 'def'].includes(b.kind)) { where.push('kind = ?'); args.push(b.kind); }
      if (b.mine && b.user) { where.push('bykey = ?'); args.push(lc(b.user)); }
      let L = db.all(`SELECT ${COLS} FROM items ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${b.sort === 'new' ? 'at DESC' : 'likes DESC, at DESC'}`, ...args);
      if (b.q) { const q = lc(b.q).slice(0, 30); L = L.filter(e => lc(e.name).includes(q) || lc(e.by).includes(q)); }   // en JS : minuscules avec accents
      L = L.slice(0, GAL_LIST);
      const liked = new Set(b.user ? db.all('SELECT item FROM likes WHERE user = ?', lc(b.user)).map(r => r.item) : []);
      return json({ items: L.map(e => ({ ...e, liked: liked.has(e.id) })), total: db.one('SELECT COUNT(*) AS n FROM items').n });
    }
    if (b.op === 'get') {
      const r = db.one(`SELECT ${COLS}, sys FROM items WHERE id = ?`, b.id);
      if (!r) return json({ error: 'publication introuvable' }, 404);
      const { sys, ...e } = r;
      return json({ item: { ...e, sys: JSON.parse(sys) } });
    }
    if (b.op === 'publish') {
      const sys = b.sys, user = b.user, now = Date.now(), { id: _, ...body } = sys;
      const e = db.one('SELECT id FROM items WHERE bykey = ? AND src = ?', lc(user), sys.id);   // même système republié : on met à jour
      if (e) {
        db.run('UPDATE items SET kind = ?, name = ?, info = ?, up = ?, sys = ? WHERE id = ?', sys.kind, sys.name, sysInfo(sys), now, JSON.stringify(body), e.id);
        return json({ id: e.id });
      }
      if (db.one('SELECT COUNT(*) AS n FROM items WHERE bykey = ?', lc(user)).n >= GAL_PER_USER) return json({ error: GAL_PER_USER + ' publications au plus par compte' }, 429);
      if (db.one('SELECT COUNT(*) AS n FROM items').n >= GAL_MAX) return json({ error: 'galerie pleine' }, 507);
      const id = crypto.randomUUID().slice(0, 8);
      db.run('INSERT INTO items (id, src, author, bykey, kind, name, info, likes, at, up, sys) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
        id, sys.id, user, lc(user), sys.kind, sys.name, sysInfo(sys), now, now, JSON.stringify(body));
      return json({ id });
    }
    if (b.op === 'unpublish') {
      const e = db.one('SELECT bykey FROM items WHERE id = ?', b.id);
      if (!e) return json({ error: 'publication introuvable' }, 404);
      if (e.bykey !== lc(b.user) && !b.admin) return json({ error: 'seul son auteur peut la retirer' }, 403);
      db.run('DELETE FROM items WHERE id = ?', b.id); db.run('DELETE FROM likes WHERE item = ?', b.id);
      return json({ ok: true });
    }
    if (b.op === 'like') {
      if (!db.one('SELECT id FROM items WHERE id = ?', b.id)) return json({ error: 'publication introuvable' }, 404);
      const u = lc(b.user), had = db.one('SELECT 1 AS x FROM likes WHERE user = ? AND item = ?', u, b.id);
      if (had) db.run('DELETE FROM likes WHERE user = ? AND item = ?', u, b.id); else db.run('INSERT INTO likes (user, item) VALUES (?, ?)', u, b.id);
      const n = db.one('SELECT COUNT(*) AS n FROM likes WHERE item = ?', b.id).n;
      db.run('UPDATE items SET likes = ? WHERE id = ?', n, b.id);
      return json({ likes: n, liked: !had });
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
  const coop = new URL(request.url).searchParams.get('mode') === 'coop';   // ?mode=coop : classement du mode infini à plusieurs
  const stub = env.BOARD.get(env.BOARD.idFromName(coop ? 'coop' : 'main'));
  if (request.method === 'GET') return stub.fetch('https://board/');
  if (request.method !== 'POST') return json({ error: 'GET ou POST' }, 405);
  if (!sameSite(request)) return json({ error: 'interdit' }, 403);
  let body = null;
  try { body = await request.json(); } catch (e) { }
  const run = validRun(body, coop);
  if (!run) return json({ error: body && !(coop ? cleanTeam : cleanName)(body.name) ? (coop ? 'nom d’équipe manquant' : 'pseudo manquant') : 'score invalide' }, 400);
  if (env.ACCOUNTS && !coop) {                                          // pseudo d'un compte : seulement par son propriétaire, et écrit comme lui
    const c = await (await accStub(env).fetch('https://acc/', { method: 'POST', body: JSON.stringify({ op: 'check', name: run.name, token: typeof body.token === 'string' ? body.token : '' }) })).json();
    if (c.registered && !c.ok) return json({ error: 'ce pseudo appartient à un compte : connecte-toi pour l’utiliser' }, 403);
    if (c.registered) run.name = c.name;
  }
  const ip = request.headers.get('CF-Connecting-IP') || '?';
  return stub.fetch('https://board/', { method: 'POST', body: JSON.stringify({ run, ip }) });
}

// ---------- rapports de bug (bouton 🐞 du jeu) ----------
// Gardés dans un objet Reports (table reports, visible dans Data Studio : les 300 derniers) et, si la variable secrète
// REPORT_WEBHOOK contient l'adresse d'un webhook Discord, envoyés aussitôt dans ce salon (résumé + rapport complet en pièce jointe).
const REPORT_MAX = 256 * 1024, REPORT_KEEP = 300, REPORT_WAIT = 30 * 1000;
export class Reports {
  constructor(state) {
    this.state = state; this.last = new Map(); this.db = sql(state);
    state.blockConcurrencyWhile(async () => {
      this.db.run('CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, at INTEGER, descr TEXT, mode TEXT, device TEXT, data TEXT)');
    });
  }
  async fetch(request) {
    const { r, ip, device } = await request.json(), now = Date.now();
    if (now - (this.last.get(ip) || 0) < REPORT_WAIT) return json({ error: 'un rapport vient déjà d’être envoyé, réessaie dans un instant' }, 429);
    this.last.set(ip, now); if (this.last.size > 5000) this.last.clear();
    const id = crypto.randomUUID().slice(0, 8);
    this.db.run('INSERT INTO reports (id, at, descr, mode, device, data) VALUES (?, ?, ?, ?, ?, ?)', id, now, String(r.desc || '').slice(0, 1000), String(r.mode || ''), device, JSON.stringify(r));
    this.db.run('DELETE FROM reports WHERE id NOT IN (SELECT id FROM reports ORDER BY at DESC LIMIT ?)', REPORT_KEEP);
    return json({ id });
  }
}
// appareil en clair pour le résumé : « iPhone · Safari », « Windows · Chrome »…
function deviceOf(ua, touch) {
  const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? 'iPad' : 'iPhone') : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '?';
  const br = /OPR\//.test(ua) ? 'Opera' : /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '?';
  return os + ' · ' + br + (touch ? ' · tactile' : '');
}
async function report(request, env) {
  if (!env.REPORTS) return json({ error: 'rapports indisponibles ici' }, 503);
  if (request.method !== 'POST') return json({ error: 'POST seulement' }, 405);
  if (!sameSite(request)) return json({ error: 'interdit' }, 403);
  const txt = await request.text();
  if (txt.length > REPORT_MAX) return json({ error: 'rapport trop volumineux' }, 413);
  let r = null; try { r = JSON.parse(txt); } catch (e) { }
  if (!r || r.v !== 'ultimate-report-1') return json({ error: 'rapport invalide' }, 400);
  const device = deviceOf(String(r.ua || ''), !!r.touch);
  const res = await env.REPORTS.get(env.REPORTS.idFromName('main')).fetch('https://rep/', { method: 'POST', body: JSON.stringify({ r, ip: request.headers.get('CF-Connecting-IP') || '?', device }) });
  const j = await res.json();
  if (!res.ok) return json(j, res.status);
  let notified = false;
  if (env.REPORT_WEBHOOK) {                                     // message instantané (Discord) : résumé lisible + fichier complet
    try {
      const who = (r.humans || []).find(h => h.id === r.myId);
      const msg = `🐞 **Rapport ${j.id}** — ${String(r.desc || '(sans description)').slice(0, 900)}\n` +
        `Mode : ${r.mode} · phase ${r.phase} · score ${(r.score || []).join('–')}${r.net ? ' · en ligne (' + r.net + ')' : ''}${who && who.name ? ' · ' + who.name : ''}\n${device}` +
        ((r.errors || []).length ? `\n⚠️ Erreurs : ${r.errors.slice(0, 3).join(' | ').slice(0, 500)}` : '');
      const form = new FormData();
      form.append('payload_json', JSON.stringify({ content: msg.replace(/@/g, '@\u200b') }));
      form.append('files[0]', new Blob([txt], { type: 'application/json' }), 'rapport-' + j.id + '.json');
      notified = (await fetch(env.REPORT_WEBHOOK, { method: 'POST', body: form })).ok;
    } catch (e) { }
  }
  return json({ id: j.id, notified });
}

export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/report') return report(request, env);
    if (path === '/api/turn') return request.method === 'GET' ? turn(request, env) : json({ error: 'GET seulement' }, 405);
    if (path === '/api/scores') return scores(request, env);
    if (path === '/api/gallery') return gallery(request, env);
    const m = /^\/api\/account\/(register|login|save|load|logout|delete|rename)$/.exec(path);
    if (m) return account(request, env, m[1]);
    return env.ASSETS.fetch(request);
  }
};
