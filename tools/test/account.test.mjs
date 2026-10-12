// Comptes côté serveur (worker/index.js), sans Cloudflare : création, connexion, sauvegarde, pseudo réservé au classement.
import worker, { Board, Accounts } from '../../worker/index.js';
import { fakeState, fakeNs } from './lib.mjs';

export default async function (t) {
  const accStore = new Map(), boardStore = new Map();
  const env = { ASSETS: { fetch: async () => new Response('page') }, ACCOUNTS: fakeNs(new Accounts(fakeState(accStore))), BOARD: fakeNs(new Board(fakeState(boardStore))) };
  let ipN = 0;
  const call = async (path, body, { ip, h = { 'Sec-Fetch-Site': 'same-origin' }, e = env } = {}) => {
    const r = await worker.fetch(new Request('https://jeu.example' + path, { method: 'POST', headers: { ...h, 'CF-Connecting-IP': ip || '10.1.0.' + (ipN++) }, body: JSON.stringify(body) }), e);
    return { s: r.status, j: await r.json() };
  };
  const A = (op, b, o) => call('/api/account/' + op, b, o);

  t.group('Création');
  const r1 = await A('register', { name: 'Théo', password: 'huck-1234', data: { 'uf-ach': '{"tuto":1}' } });
  t.ok(r1.s === 200 && r1.j.token && r1.j.name === 'Théo', 'compte créé, jeton reçu', r1.j);
  const rec = accStore.get('u:théo');
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
  t.ok((await A('delete', { name: 'Théo', token: r1.j.token })).s === 200 && !accStore.has('u:théo'), 'compte supprimé');
  t.ok((await A('register', { name: 'Théo', password: 'nouveau1' })).s === 200, 'le pseudo redevient libre');
}
