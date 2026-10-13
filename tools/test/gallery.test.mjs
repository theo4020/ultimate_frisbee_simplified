// Galerie côté serveur (worker/index.js), sans Cloudflare : publier, lister, aimer, retirer, données invalides refusées.
import worker, { Accounts, Gallery } from '../../worker/index.js';
import { fakeState, fakeNs } from './lib.mjs';

export default async function (t) {
  const gs = new Map();
  const env = { ASSETS: { fetch: async () => new Response('') }, ACCOUNTS: fakeNs(new Accounts(fakeState(new Map()))), GALLERY: fakeNs(new Gallery(fakeState(gs))), GALLERY_ADMINS: 'Modo' };
  let ip = 0;
  const post = async (path, body, h = { 'Sec-Fetch-Site': 'same-origin' }) => {
    const r = await worker.fetch(new Request('https://jeu.example' + path, { method: 'POST', headers: { ...h, 'CF-Connecting-IP': '10.2.0.' + (ip++) }, body: JSON.stringify(body) }), env);
    return { s: r.status, j: await r.json() };
  };
  const reg = async name => (await post('/api/account/register', { name, password: 'mdp-' + name })).j.token;
  const G_ = (op, b, who) => post('/api/gallery', Object.assign({ op }, who || {}, b));
  const theo = { name: 'Théo', token: await reg('Théo') }, lea = { name: 'Léa', token: await reg('Léa') }, modo = { name: 'Modo', token: await reg('Modo') };
  const sys = { id: 'abc123', kind: 'off', name: 'Huck <b>fou</b>', pos: [[8, 2], [14, 1], [20, 0], [-3, -5]], steps: [{ p: 0, to: [30, 5], wait: 0.6 }], setup: true };

  t.group('Publier');
  t.ok((await G_('publish', { sys })).s === 401, 'sans compte : refusé');
  t.ok((await G_('publish', { sys }, { name: 'Théo', token: 'faux' })).s === 401, 'mauvais jeton : refusé');
  const p1 = await G_('publish', { sys }, theo);
  t.ok(p1.s === 200 && p1.j.id, 'avec un compte : publié', p1.j);
  const p2 = await G_('publish', { sys: { ...sys, name: 'Huck v2' } }, theo);
  t.ok(p2.j.id === p1.j.id, 'republier le même système le met à jour (pas de doublon)');
  t.ok((await G_('publish', { sys: { ...sys, pos: [[1, 1]] } }, theo)).s === 400, 'système invalide refusé');
  t.ok((await G_('publish', { sys: { kind: 'def', id: 'zzz111', name: 'Zone', mode: 'zone', zone: [[5, 6], [5, -5], [13, 0], [25, 0]], roles: ['hack'] } }, lea)).s === 200, 'une défense se publie aussi');
  t.ok((await post('/api/gallery', { op: 'list' }, { 'Sec-Fetch-Site': 'cross-site' })).s === 403, 'un autre site ne peut pas utiliser la galerie');

  t.group('Lister et voir');
  const all = await G_('list', {});
  t.ok(all.j.items.length === 2 && all.j.items.every(e => !e.sys), 'liste légère (sans le détail des systèmes)', all.j.items);
  t.ok((await G_('list', { kind: 'def' })).j.items.length === 1, 'filtre attaques / défenses');
  t.ok((await G_('list', { q: 'lé' })).j.items[0].by === 'Léa', 'recherche par auteur');
  const one = await G_('get', { id: p1.j.id });
  t.ok(one.j.item.name === 'Huck v2' && one.j.item.sys.steps.length === 1 && one.j.item.sys.setup === true && one.j.item.by === 'Théo', 'une publication complète, avec son auteur', one.j.item);
  t.ok(!JSON.stringify(one.j).includes('<b>'), 'noms nettoyés');

  t.group('Aimer');
  t.ok((await G_('like', { id: p1.j.id })).s === 401, 'sans compte : pas de ❤');
  const l1 = await G_('like', { id: p1.j.id }, lea);
  t.ok(l1.j.likes === 1 && l1.j.liked, 'un ❤');
  t.ok((await G_('list', { sort: 'top' }, lea)).j.items[0].liked === true, 'la liste montre mes ❤');
  t.ok((await G_('like', { id: p1.j.id }, lea)).j.likes === 0, 'retoucher retire le ❤ (un seul par compte)');
  await G_('like', { id: p1.j.id }, lea); await G_('like', { id: p1.j.id }, modo);
  t.ok((await G_('list', { sort: 'top' })).j.items[0].likes === 2, 'tri par nombre de ❤');

  t.group('Retirer');
  t.ok((await G_('unpublish', { id: p1.j.id }, lea)).s === 403, 'seul l’auteur peut retirer sa publication');
  const zid = (await G_('list', { kind: 'def' })).j.items[0].id;
  t.ok((await G_('unpublish', { id: zid }, modo)).s === 200, 'un modérateur (GALLERY_ADMINS) peut retirer n’importe quoi');
  t.ok((await G_('unpublish', { id: p1.j.id }, theo)).s === 200 && (await G_('list', {})).j.items.length === 0, 'l’auteur retire la sienne');
  for (let k = 0; k < 21; k++) await G_('publish', { sys: { ...sys, id: 'sys' + String(k).padStart(3, '0') } }, lea);
  t.ok((await G_('list', { q: 'léa' })).j.items.length === 20, '20 publications au plus par compte');
}
