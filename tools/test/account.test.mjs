// Comptes côté serveur (worker/index.js), sans Cloudflare : création, connexion, sauvegarde, pseudo réservé au classement.
import worker, { Board, Accounts, Gallery, Reports } from '../../worker/index.js';
import { fakeState, fakeNs, makeDO } from './lib.mjs';

export default async function (t) {
  const as = fakeState(), acc = k => as.db.prepare('SELECT * FROM accounts WHERE k = ?').get(k);
  const bs = fakeState(), gs = fakeState();
  const env = { ASSETS: { fetch: async () => new Response('page') }, ACCOUNTS: fakeNs(await makeDO(Accounts, as)), BOARD: fakeNs(await makeDO(Board, bs)), GALLERY: fakeNs(await makeDO(Gallery, gs)) };
  let ipN = 0;
  const call = async (path, body, { ip, h = { 'Sec-Fetch-Site': 'same-origin' }, e = env } = {}) => {
    const r = await worker.fetch(new Request('https://jeu.example' + path, { method: 'POST', headers: { ...h, 'CF-Connecting-IP': ip || '10.1.0.' + (ipN++) }, body: JSON.stringify(body) }), e);
    return { s: r.status, j: await r.json() };
  };
  const A = (op, b, o) => call('/api/account/' + op, b, o);

  t.group('Création');
  const r1 = await A('register', { name: 'Théo', password: 'huck-1234', data: { 'uf-ach': '{"tuto":1}' } });
  t.ok(r1.s === 200 && r1.j.token && r1.j.name === 'Théo', 'compte créé, jeton reçu', r1.j);
  const rec = acc('théo');
  t.ok(rec && !JSON.stringify(rec).includes('huck-1234') && rec.hash && rec.salt, 'le mot de passe n’est jamais stocké, seulement son empreinte');
  t.ok((await A('register', { name: 'THÉO', password: 'autre-0000' })).s === 409, 'pseudo déjà pris (majuscules comprises)');
  t.ok((await A('register', { name: 'ab', password: 'xxxx' })).s === 400, 'pseudo trop court refusé');
  t.ok((await A('register', { name: 'Léa', password: 'abc' })).s === 400, 'mot de passe trop court refusé');
  t.ok((await A('register', { name: 'Max', password: 'abcd' }, { h: { 'Sec-Fetch-Site': 'cross-site' } })).s === 403, 'un autre site ne peut pas créer de compte');
  t.ok((await A('register', { name: 'Max', password: 'abcd' }, { e: { ASSETS: env.ASSETS } })).s === 503, 'sans stockage : 503');

  t.group('Connexion et sauvegarde');
  const bad = await A('login', { name: 'Théo', password: 'mauvais' });
  t.ok(bad.s === 401, 'mauvais mot de passe refusé');
  const lg = await A('login', { name: 'théo', password: 'huck-1234' });
  t.ok(lg.s === 200 && lg.j.name === 'Théo' && lg.j.data['uf-ach'] === '{"tuto":1}', 'connexion : on retrouve les données du compte', lg.j);
  const sv = await A('save', { name: 'Théo', token: lg.j.token, data: { 'uf-ach': '{"tuto":1,"huck":2}' } });
  t.ok(sv.s === 200 && sv.j.updated, 'sauvegarde avec le jeton');
  const ld = await A('load', { name: 'Théo', token: r1.j.token });
  t.ok(ld.j.data['uf-ach'].includes('huck'), 'l’autre appareil (autre jeton) voit la sauvegarde');
  t.ok((await A('save', { name: 'Théo', token: 'faux', data: { a: '1' } })).s === 401, 'sauvegarde refusée sans bon jeton');
  t.ok((await A('save', { name: 'Théo', token: lg.j.token, data: { big: 'x'.repeat(70000) } })).s === 413, 'données trop volumineuses refusées');
  for (let k = 0; k < 10; k++) await A('login', { name: 'Théo', password: 'nope' }, { ip: '6.6.6.6' });
  t.ok((await A('login', { name: 'Théo', password: 'huck-1234' }, { ip: '6.6.6.6' })).s === 429, 'trop d’essais ratés depuis une adresse : bloqué un moment');

  t.group('Pseudo réservé au classement');
  const s1 = await call('/api/scores', { name: 'THÉO', wins: 2, diff: 3 });
  t.ok(s1.s === 403, 'sans être connecté, impossible d’utiliser le pseudo d’un compte', s1.j);
  const s3 = await call('/api/scores', { name: 'théo', wins: 2, diff: 3, token: lg.j.token });
  t.ok(s3.s === 200 && s3.j.top[0].name === 'Théo', 'connecté : score enregistré, avec l’écriture du compte', s3.j);
  t.ok((await call('/api/scores', { name: 'Libre', wins: 1, diff: 1 })).s === 200, 'un pseudo sans compte reste utilisable');

  t.group('Déconnexion et suppression');
  await A('logout', { name: 'Théo', token: lg.j.token });
  t.ok((await A('load', { name: 'Théo', token: lg.j.token })).s === 401, 'après déconnexion, le jeton ne marche plus');
  t.ok((await A('delete', { name: 'Théo', token: r1.j.token })).s === 200 && !acc('théo'), 'compte supprimé');
  t.ok((await A('register', { name: 'Théo', password: 'nouveau1' })).s === 200, 'le pseudo redevient libre');

  t.group('Changer de pseudo');
  const nt = (await A('login', { name: 'Théo', password: 'nouveau1' })).j.token;
  await call('/api/scores', { name: 'Théo', wins: 3, diff: 4, token: nt }, { ip: '30.0.0.1' });
  await call('/api/gallery', { op: 'publish', name: 'Théo', token: nt, sys: { kind: 'off', id: 'abc123', name: 'Mon huck', pos: [[8, 2], [14, 1], [20, 0], [-3, -5]], steps: [] } });
  await call('/api/gallery', { op: 'like', name: 'Théo', token: nt, id: gs.db.prepare('SELECT id FROM items').get().id });
  await A('register', { name: 'Pris', password: 'abcd' });
  t.ok((await A('rename', { name: 'Théo', token: nt, newName: 'pris' })).s === 409, 'nouveau pseudo déjà pris par un compte : refusé');
  t.ok((await A('rename', { name: 'Théo', token: nt, newName: 'libre' })).s === 409, 'nouveau pseudo déjà au classement (joueur sans compte) : refusé');
  t.ok((await A('rename', { name: 'Théo', token: 'faux', newName: 'Théodore' })).s === 401, 'sans le bon jeton : refusé');
  const rn = await A('rename', { name: 'Théo', token: nt, newName: 'Théodore' });
  t.ok(rn.s === 200 && rn.j.name === 'Théodore' && acc('théodore') && !acc('théo'), 'pseudo changé', rn.j);
  t.ok((await A('load', { name: 'Théodore', token: nt })).s === 200, 'le compte garde ses jetons et ses données');
  t.ok((await A('login', { name: 'Théodore', password: 'nouveau1' })).s === 200, 'même mot de passe');
  t.ok(bs.db.prepare("SELECT name FROM scores WHERE k = 'théodore'").get()?.name === 'Théodore' && !bs.db.prepare("SELECT 1 FROM scores WHERE k = 'théo'").get(), 'sa ligne du classement prend le nouveau nom');
  const it = gs.db.prepare('SELECT author, bykey FROM items').get(), lk = gs.db.prepare('SELECT user FROM likes').get();
  t.ok(it.author === 'Théodore' && it.bykey === 'théodore' && lk.user === 'théodore', 'ses publications et ses ❤ dans la galerie suivent', { it, lk });
  const other = await A('load', { name: 'Théo', token: nt });
  t.ok(other.s === 409 && other.j.renamed === 'Théodore', 'un autre appareil resté sur l’ancien pseudo apprend le nouveau', other.j);
  t.ok((await A('register', { name: 'Théo', password: 'abcd' })).s === 200, 'l’ancien pseudo redevient libre');
  t.ok((await A('rename', { name: 'Théodore', token: nt, newName: 'THÉODORE' })).s === 200 && acc('théodore').name === 'THÉODORE', 'changer seulement les majuscules marche aussi');

  t.group('Mot de passe oublié (admin)');
  const envA = Object.assign({}, env, { ADMINS: 'Chef, autre' });
  const chef = (await A('register', { name: 'Chef', password: 'chef-0001' })).j.token;
  const lost = await A('register', { name: 'Perdu', password: 'oublie-99', data: { 'uf-ach': '{"win":1}' } });
  await call('/api/scores', { name: 'Perdu', wins: 4, diff: 2, token: lost.j.token }, { ip: '40.0.0.1' });
  t.ok((await A('reset', { name: 'Théo', token: (await A('login', { name: 'Théo', password: 'abcd' })).j.token, target: 'Perdu' }, { e: envA })).s === 403, 'un joueur qui n’est pas admin : refusé');
  t.ok((await A('reset', { name: 'Chef', token: 'faux', target: 'Perdu' }, { e: envA })).s === 401, 'admin sans bon jeton : refusé');
  t.ok((await A('reset', { name: 'Chef', token: chef, target: 'Perdu' })).s === 403, 'sans liste d’admins : personne');
  t.ok((await A('reset', { name: 'Chef', token: chef, target: 'Personne' }, { e: envA })).s === 404, 'compte inconnu : 404');
  const lgA = await A('login', { name: 'chef', password: 'chef-0001' }, { e: envA });
  t.ok(lgA.j.admin === true && (await A('login', { name: 'Perdu', password: 'oublie-99' }, { e: envA })).j.admin === false, 'la connexion dit si le compte est admin', lgA.j);
  const rs = await A('reset', { name: 'Chef', token: chef, target: 'perdu' }, { e: envA });
  t.ok(rs.s === 200 && rs.j.name === 'Perdu' && /^[a-z]+-\d{4}$/.test(rs.j.password), 'admin : nouveau mot de passe temporaire', rs.j);
  t.ok((await A('load', { name: 'Perdu', token: lost.j.token })).s === 401, 'ses appareils sont déconnectés');
  t.ok((await A('login', { name: 'Perdu', password: 'oublie-99' })).s === 401, 'l’ancien mot de passe ne marche plus');
  const back = await A('login', { name: 'Perdu', password: rs.j.password });
  t.ok(back.s === 200 && back.j.data['uf-ach'] === '{"win":1}', 'avec le nouveau : il retrouve son profil', back.j);
  t.ok(bs.db.prepare("SELECT wins FROM scores WHERE k = 'perdu'").get()?.wins === 4, 'et sa place au classement');

  t.group('Signalements : qui les envoie, et lecture par les admins');
  const qrps = fakeState(), qenvR = Object.assign({}, envA, { REPORTS: fakeNs(await makeDO(Reports, qrps)) });
  const qrep = d => ({ v: 'ultimate-report-1', desc: d, ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', mode: 'solo', phase: 'play', score: [0, 0], errors: [], frames: [] });
  const qs1 = await call('/api/report', Object.assign(qrep('bug avec compte'), { user: { name: 'Perdu', account: 'Perdu' }, auth: { name: 'Perdu', token: back.j.token } }), { e: qenvR, ip: '50.0.0.1' });
  const qs2 = await call('/api/report', Object.assign(qrep('bug sans compte'), { user: { name: 'Zoé' } }), { e: qenvR, ip: '50.0.0.2' });
  const qs3 = await call('/api/report', Object.assign(qrep('faux compte'), { user: { name: 'Chef' }, auth: { name: 'Chef', token: 'faux' } }), { e: qenvR, ip: '50.0.0.3' });
  const qrows = qrps.db.prepare('SELECT user, data FROM reports ORDER BY at').all();
  t.ok(qs1.s === 200 && qs2.s === 200 && qs3.s === 200 && qrows.map(r => r.user).join() === 'Perdu,Zoé (sans compte),Chef (sans compte)', 'chaque rapport garde qui l’a envoyé (compte vérifié, sinon pseudo marqué « sans compte »)', qrows.map(r => r.user));
  t.ok(!qrows.some(r => r.data.includes(back.j.token) || r.data.includes('"auth"')), 'le jeton du compte n’est jamais gardé dans le rapport');
  const qR2 = (b, e = qenvR) => call('/api/reports', b, { e });
  t.ok((await qR2({ name: 'Perdu', token: back.j.token })).s === 403 && (await qR2({ name: 'Chef', token: 'faux' })).s === 401, 'liste des rapports : réservée aux admins connectés');
  const qL = await qR2({ name: 'Chef', token: chef });
  t.ok(qL.s === 200 && qL.j.total === 3 && qL.j.reports.length === 3 && qL.j.reports.every(r => r.user && r.at && !r.data), 'admin : les derniers rapports (qui, quand, description), sans le détail', qL.j);
  const qone = await qR2({ name: 'Chef', token: chef, id: qL.j.reports.find(r => r.descr === 'bug avec compte').id });
  t.ok(qone.s === 200 && qone.j.desc === 'bug avec compte' && qone.j.user.verified === 'Perdu', 'admin : un rapport complet', qone.j.desc);
  const sp = await worker.fetch(new Request('https://jeu.example/api/account/setpw', { method: 'POST', headers: { 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ name: 'Perdu', password: 'pirate-1' }) }), envA);
  t.ok((await sp.text()) === 'page' && (await A('login', { name: 'Perdu', password: 'pirate-1' })).s === 401, 'l’opération interne n’est pas accessible directement');

  t.group('Recopie de l’ancien stockage (une seule fois)');
  const old = new Map([['u:ancien', { name: 'Ancien', salt: 's', hash: 'h', tokens: ['tok1'], data: { 'uf-ach': '{"a":1}' }, created: 5, updated: 6 }]]);
  const st = fakeState(old), A2 = await makeDO(Accounts, st);
  const c1 = await (await A2.fetch(new Request('https://acc/', { method: 'POST', body: JSON.stringify({ op: 'load', name: 'Ancien', token: 'tok1' }) }))).json();
  t.ok(c1.name === 'Ancien' && c1.data['uf-ach'] === '{"a":1}', 'un compte de l’ancien stockage est retrouvé dans la table', c1);
  st.db.prepare("DELETE FROM accounts").run(); await makeDO(Accounts, st);
  t.ok(st.db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n === 0, 'la recopie ne se refait pas (sinon un compte supprimé reviendrait)');
}
