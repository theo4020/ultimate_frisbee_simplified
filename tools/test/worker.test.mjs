// Serveur (worker/index.js), sans Cloudflare : relais TURN et classement du mode infini (tout est simulé).
import worker, { Board, Reports } from '../../worker/index.js';
import { fakeState, makeDO, fakeNsByName } from './lib.mjs';

export default async function (t) {
  const realFetch = globalThis.fetch;
  let status = 201, last = null;
  globalThis.fetch = async (url, o) => {
    last = { url, o };
    if (status !== 201) return new Response('x', { status });
    return Response.json({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' },
      { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'p' }] }, { status: 201 });
  };
  const bs = fakeState(), board = await makeDO(Board, bs), nScores = () => bs.db.prepare('SELECT COUNT(*) AS n FROM scores').get().n;
  const env = { TURN_KEY_ID: 'kid', TURN_KEY_API_TOKEN: 'tok', ASSETS: { fetch: async () => new Response('page') },
    BOARD: { idFromName: () => 'main', get: () => ({ fetch: (u, o) => board.fetch(new Request(u, o)) }) } };
  const SAME = { 'Sec-Fetch-Site': 'same-origin' };
  const call = async (path, { h = SAME, e = env, method = 'GET', body, ip = '1.1.1.1' } = {}) => {
    const r = await worker.fetch(new Request('https://jeu.example' + path, { headers: { ...h, 'CF-Connecting-IP': ip }, method, body: body && JSON.stringify(body) }), e);
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (err) { }
    return { s: r.status, txt, j };
  };
  try {
    t.group('Pages du site');
    t.ok((await call('/index.html')).txt === 'page', 'les pages passent aux fichiers statiques');

    t.group('Relais TURN (/api/turn)');
    t.ok((await call('/api/turn', { h: { 'Sec-Fetch-Site': 'cross-site' } })).s === 403, 'un autre site est refusé');
    t.ok((await call('/api/turn', { h: { Origin: 'https://evil.com' } })).s === 403, 'une mauvaise origine est refusée');
    t.ok((await call('/api/turn', { h: { 'Sec-Fetch-Site': 'none' } })).s === 200, 'adresse ouverte à la main (diagnostic) acceptée');
    const nc = await call('/api/turn', { e: { ASSETS: env.ASSETS, TURN_KEY: 'secret-value' } });
    t.ok(nc.s === 503 && nc.txt.includes('TURN_KEY_ID et TURN_KEY_API_TOKEN') && !nc.txt.includes('secret-value'), 'non configuré : 503 avec les noms des variables, jamais leurs valeurs', nc.txt);
    t.ok((await call('/api/turn', { method: 'POST' })).s === 405, 'POST refusé');
    const ok = await call('/api/turn');
    t.ok(ok.s === 200 && ok.j.iceServers.length === 2, 'identifiants renvoyés', ok.txt);
    t.ok(last.url.includes('/keys/kid/') && last.o.headers.Authorization === 'Bearer tok' && JSON.parse(last.o.body).ttl === 14400, 'appel à Cloudflare correct (clé, jeton, 4 h)');
    t.ok(!ok.txt.includes(':53'), 'le port 53 (bloqué par les navigateurs) est retiré');
    t.ok(!ok.txt.includes('tok'), 'le jeton ne sort jamais');
    status = 401; t.ok((await call('/api/turn')).s === 502, 'erreur de Cloudflare → 502'); status = 201;

    t.group('Classement (/api/scores)');
    t.ok((await call('/api/scores')).j.top.length === 0, 'vide au départ');
    const p1 = await call('/api/scores', { method: 'POST', body: { name: 'Théo', wins: 4, diff: 7 } });
    t.ok(p1.s === 200 && p1.j.rank === 1 && p1.j.id && p1.j.top[0].name === 'Théo', 'un score est enregistré et classé', p1.txt);
    t.ok((await call('/api/scores', { method: 'POST', body: { name: 'Léa', wins: 6, diff: 9 } })).s === 429, 'pas deux scores en 20 s depuis la même adresse');
    const p2 = await call('/api/scores', { method: 'POST', body: { name: 'Léa', wins: 6, diff: 9 }, ip: '2.2.2.2' });
    const p3 = await call('/api/scores', { method: 'POST', body: { name: '<b>Max</b>   le    grand du jeu', wins: 5, diff: 6 }, ip: '3.3.3.3' });
    t.ok(p2.j.rank === 1 && p3.j.rank === 2, 'tri par matchs gagnés', [p2.j.rank, p3.j.rank]);
    t.ok(p3.j.top[1].name === 'bMax/b le gr', 'pseudo nettoyé (pas de HTML, 12 caractères)', p3.j.top[1].name);
    const anon = await call('/api/scores', { method: 'POST', body: { name: '  ', wins: 0, diff: -3 }, ip: '4.4.4.4' });
    t.ok(anon.s === 400 && anon.j.error === 'pseudo manquant', 'sans pseudo : pas enregistré', anon.txt);
    const low = await call('/api/scores', { method: 'POST', body: { name: 'théo', wins: 2, diff: 3 }, ip: '6.6.6.6' });
    t.ok(low.j.kept === false && low.j.best.wins === 4 && low.j.top.filter(e => e.name.toLowerCase() === 'théo').length === 1, 'même pseudo, score plus faible : l’ancien est gardé', low.txt);
    const high = await call('/api/scores', { method: 'POST', body: { name: 'Théo', wins: 8, diff: 12 }, ip: '7.7.7.7' });
    const theo = high.j.top.filter(e => e.name.toLowerCase() === 'théo');
    t.ok(high.j.kept && high.j.rank === 1 && theo.length === 1 && theo[0].wins === 8, 'même pseudo, meilleur score : il remplace l’ancien (une seule ligne)', theo);
    for (const [b, why] of [[{ wins: 5, diff: 40 }, 'écart impossible'], [{ wins: 3, diff: 0 }, 'écart trop négatif'], [{ wins: 4, diff: 8 }, 'écart de l’ancienne formule en 3 points'], [{ wins: 2.5, diff: 3 }, 'nombre non entier'],
      [{ wins: 9999, diff: 9999 }, 'trop de matchs'], [{ name: 'x' }, 'champs manquants'], [null, 'corps vide']])
      t.ok((await call('/api/scores', { method: 'POST', body: b, ip: '9.9.9.' + why.length })).s === 400, 'score refusé : ' + why);
    t.ok((await call('/api/scores', { method: 'POST', body: { wins: 1, diff: 1 }, h: { 'Sec-Fetch-Site': 'cross-site' }, ip: '5.5.5.5' })).s === 403, 'un autre site ne peut pas envoyer de score');
    for (let k = 0; k < 120; k++) await call('/api/scores', { method: 'POST', body: { name: 'b' + k, wins: 1, diff: 1 }, ip: '10.0.0.' + k });
    const full = await call('/api/scores');
    t.ok(nScores() === 100 && full.j.top.length === 50, '100 scores gardés, 50 affichés', [nScores(), full.j.top.length]);
    t.ok(full.j.top[0].name === 'Théo' && full.j.top[1].name === 'Léa', 'les meilleurs restent en tête');
    t.ok((await call('/api/scores', { e: { ASSETS: env.ASSETS } })).s === 503, 'sans stockage : 503');

    t.group('Classement à plusieurs (/api/scores?mode=coop)');
    const env2 = Object.assign({}, env, { BOARD: fakeNsByName(Board, { main: { st: bs, obj: board } }) });
    const c1 = await call('/api/scores?mode=coop', { method: 'POST', body: { name: 'Théo + Léa + Max le grand', wins: 3, diff: 4 }, ip: '20.0.0.1', e: env2 });
    t.ok(c1.s === 200 && c1.j.top.length === 1 && c1.j.top[0].name === 'Théo + Léa + Max le gran', 'une équipe est enregistrée (nom jusqu’à 24 caractères)', c1.txt);
    t.ok((await call('/api/scores?mode=coop', { e: env2 })).j.top.length === 1 && !(await call('/api/scores', { e: env2 })).j.top.some(e => e.name.startsWith('Théo +')), 'classement à part : rien dans le classement solo');
    t.ok((await call('/api/scores?mode=coop', { method: 'POST', body: { name: '', wins: 1, diff: 1 }, ip: '20.0.0.2', e: env2 })).j.error === 'nom d’équipe manquant', 'sans nom d’équipe : refusé');
  } finally { globalThis.fetch = realFetch; }

  t.group('Rapports de bug (/api/report)');
  {
    const rs = fakeState(), reports = await makeDO(Reports, rs); let hook = null;
    const keep = globalThis.fetch; globalThis.fetch = async (url, o) => { hook = { url, form: o.body }; return new Response('{}', { status: 200 }); };
    const e2 = { ASSETS: { fetch: async () => new Response('page') }, REPORTS: { idFromName: () => 'main', get: () => ({ fetch: (u, o) => reports.fetch(new Request(u, o)) }) }, REPORT_WEBHOOK: 'https://discord.com/api/webhooks/x/y' };
    const send = (body, ip = '40.0.0.1', h = { 'Sec-Fetch-Site': 'same-origin' }) => worker.fetch(new Request('https://jeu.example/api/report', { method: 'POST', headers: { ...h, 'CF-Connecting-IP': ip }, body }), e2).then(async r => ({ s: r.status, j: await r.json() }));
    const rep = { v: 'ultimate-report-1', desc: 'les joueurs sont figés @everyone', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Safari/604.1', touch: true, mode: 'series 5', phase: 'play', score: [1, 0], errors: [], frames: [] };
    const ok = await send(JSON.stringify(rep));
    const row = rs.db.prepare('SELECT * FROM reports').get();
    t.ok(ok.s === 200 && ok.j.id && row && row.descr.startsWith('les joueurs sont figés') && row.device === 'iPhone · Safari · tactile', 'rapport gardé sur le serveur (description, appareil)', ok.j);
    const content = hook && JSON.parse(hook.form.get('payload_json')).content, file = hook && hook.form.get('files[0]');
    t.ok(ok.j.notified && hook.url.includes('discord.com') && content.includes('figés') && content.includes('iPhone') && !content.includes('@everyone') && file && file.size > 50, 'message Discord : résumé lisible, rapport complet en pièce jointe, sans mention @everyone', content);
    t.ok((await send(JSON.stringify(rep))).s === 429, 'pas deux rapports en 30 s depuis la même adresse');
    t.ok((await send('{"v":"autre"}', '40.0.0.2')).s === 400, 'rapport invalide refusé');
    t.ok((await send('x'.repeat(300000), '40.0.0.3')).s === 413, 'rapport trop gros refusé');
    t.ok((await send(JSON.stringify(rep), '40.0.0.4', { 'Sec-Fetch-Site': 'cross-site' })).s === 403, 'un autre site ne peut pas envoyer de rapport');
    globalThis.fetch = keep;
  }

  t.group('Classement : recopie de l’ancien stockage');
  const st = fakeState(new Map([['top-2pts', [{ id: 'aa', name: 'Ancien', wins: 7, diff: 9, at: 1 }, { id: 'bb', name: 'Autre', wins: 2, diff: 1, at: 2 }]]]));
  const B2 = await makeDO(Board, st), top = (await (await B2.fetch(new Request('https://board/'))).json()).top;
  t.ok(top.length === 2 && top[0].name === 'Ancien' && top[0].wins === 7, 'les scores de l’ancien stockage sont dans la table', top);
}
