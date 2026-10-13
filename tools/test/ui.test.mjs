// Interface dans un vrai navigateur (Chromium) : menus, modes solo, mode infini + classement, menu en jeu,
// tutoriel, gestes tactiles sur téléphone. Le site est servi par le vrai worker (lib.mjs → startServer).
import { playwright, startServer } from './lib.mjs';

export default async function (t) {
  const { chromium } = playwright();
  const srv = await startServer();
  const browser = await chromium.launch();
  const errs = [];
  const watch = (p, tag) => {
    p.on('pageerror', e => errs.push(tag + ' : ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/secrets\.js|Failed to load resource/.test(m.text())) errs.push(tag + ' console : ' + m.text()); });
  };
  const vis = (p, sel) => p.isVisible(sel);
  try {
    // ---------- ordinateur ----------
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
    const p = await ctx.newPage(); watch(p, 'ordi');
    await p.goto(srv.url + 'index.html');
    await p.waitForFunction(() => typeof G !== 'undefined' && G.attract);

    t.group('Menu principal');
    t.ok(await vis(p, '#lobbyHome'), 'le menu principal s’affiche');
    t.ok(await vis(p, '#moveAlert'), 'bandeau « le jeu change d’adresse » (on n’est pas sur la nouvelle)');
    t.ok(+(await p.textContent('#newsBadge')) > 0, 'badge des nouveautés non lues');
    for (const id of ['tutoB', 'soloMenuB', 'hostB', 'joinB', 'ctrlB', 'profileB', 'newsB']) t.ok(await vis(p, '#' + id), 'bouton ' + id);
    t.ok(!(await vis(p, '#pracB')) && !(await vis(p, '#seriesB')), 'les modes solo ne sont plus sur l’accueil');
    await p.fill('#pname', 'Testeur');

    t.group('Nouveautés et changement d’adresse');
    await p.click('#newsB');
    t.ok(await vis(p, '#newsCard') && (await p.locator('#newsList .post').count()) >= 5, 'fil des nouveautés');
    await p.click('#newsBack');
    t.ok(!(await vis(p, '#newsBadge')), 'badge effacé une fois lu');
    await p.click('#moveAlert');
    const href = await p.getAttribute('#moveGo', 'href');
    t.ok(/^https:\/\/ultimate-frisbee-simplified\.theosyle42\.workers\.dev\/#import=/.test(href), 'le lien emporte le profil', href.slice(0, 80));
    await p.click('#moveBack');
    t.ok(await vis(p, '#lobbyHome'), 'retour à l’accueil');

    t.group('Section Solo');
    await p.click('#soloMenuB');
    for (const id of ['endlessB', 'soloB', 'seriesB', 'pracB']) t.ok(await vis(p, '#' + id), 'bouton ' + id);
    await p.click('#soloBack');
    t.ok(await vis(p, '#lobbyHome'), '« Retour » ramène à l’accueil');

    t.group('Mode infini et classement');
    await p.click('#soloMenuB'); await p.click('#endlessB');
    t.ok(await vis(p, '#endlessCard'), 'panneau du mode infini');
    await p.waitForFunction(() => !/Chargement/.test(document.getElementById('endStatus').textContent));
    t.ok((await p.textContent('#endBoardTitle')).includes('mondial'), 'classement mondial chargé', await p.textContent('#endBoardTitle'));
    await p.click('#endGo');
    t.ok((await p.textContent('#ovTitle')).includes('Match 1'), 'match 1 annoncé', await p.textContent('#ovTitle'));
    t.ok((await p.textContent('#ovText')).includes('2 points'), 'premier à 2 points');
    t.ok(await p.evaluate(() => [...document.querySelectorAll('#selOff option')].some(o => o.value === 'edit')), 'mes systèmes sont proposés en mode infini');
    const finish = async win => {                               // fin de match forcée : le dernier point est marqué
      await p.evaluate(w => { G.score = w ? [1, 0] : [0, 1]; G.phase = 'play'; G.lastMenu = null; $('overlay').classList.add('hidden'); G.menuShown = false; scorePoint(w ? G.me : 1 - G.me, 'Test'); }, win);
      await p.waitForFunction(() => G.lastMenu === 'over' && G.menuShown, null, { timeout: 15000 });
    };
    await finish(true);
    t.ok((await p.textContent('#go')).includes('Match suivant'), 'victoire : bouton « Match suivant »');
    await p.click('#go');
    t.ok((await p.textContent('#ovTitle')).includes('Match 2'), 'match 2 contre un nouvel adversaire', await p.textContent('#ovTitle'));
    await p.click('#go');                                           // « Jouer le point » lance bien le match 2 (et ne saute pas au 3)
    await p.waitForFunction(() => G.phase === 'pull' || G.phase === 'play', null, { timeout: 5000 }).catch(() => {});
    t.ok(await p.evaluate(() => (G.phase === 'pull' || G.phase === 'play') && G.series.cur === 1), 'le match 2 se joue vraiment', await p.evaluate(() => [G.phase, G.series.cur]));
    await finish(false);
    t.ok((await p.textContent('#go')).includes('classement'), 'défaite : bouton « Voir le classement »');
    await p.click('#go');
    t.ok(await vis(p, '#endSave'), 'fin de série : on propose d’enregistrer le score');
    t.ok((await p.inputValue('#endSaveName')) === 'Testeur', 'le pseudo est déjà rempli');
    t.ok(srv.board.get('top-2pts') === undefined, 'rien n’est envoyé avant d’avoir choisi');
    await p.fill('#endSaveName', 'Champion'); await p.click('#endSaveB');
    await p.waitForFunction(() => /classement mondial|non enregistré/.test(document.getElementById('endStatus').textContent), null, { timeout: 8000 });
    t.ok((await p.textContent('#endStatus')).includes('Champion est 1er'), 'score enregistré : 1er du classement', await p.textContent('#endStatus'));
    t.ok(!(await vis(p, '#endSave')), 'le formulaire disparaît');
    t.ok(await p.evaluate(() => myName()) === 'Champion', 'le pseudo choisi est gardé pour la suite');
    t.ok((await p.textContent('#endBoard li.me')).includes('Champion'), 'ma ligne est en évidence avec mon pseudo');
    t.ok((await p.textContent('#endBest')).includes('1 match'), 'record personnel affiché');
    t.ok(srv.board.get('top-2pts')[0].wins === 1 && srv.board.get('top-2pts')[0].diff === 0, 'le serveur a reçu 1 match, écart 0 (2–0 puis 0–2)', srv.board.get('top-2pts'));
    await p.click('#endGo'); await finish(false); await p.click('#go');           // 2e série, perdue d'entrée : on n'enregistre pas
    await p.fill('#endSaveName', ''); await p.click('#endSaveB');
    t.ok((await p.textContent('#endStatus')).includes('non enregistré') && srv.board.get('top-2pts').length === 1, 'pseudo vide : score non enregistré');
    await p.click('#endBack');
    t.ok(await vis(p, '#lobbySolo'), 'retour à la section Solo');
    t.ok((await p.textContent('#endlessTxt')).includes('record'), 'le record s’affiche sur le bouton');

    t.group('Match rapide et menu en jeu');
    await p.click('#soloB');
    await p.evaluate(() => { G.form.first = String(G.me); });  // on reçoit : l'IA pulle
    await p.click('#go');
    await p.waitForFunction(() => G.phase === 'pull' || G.phase === 'play');
    await p.waitForFunction(() => G.phase === 'play', null, { timeout: 30000 });
    await p.evaluate(() => { G.off = G.me; G.oplay = null; holdDisc(TEAMS[G.me][0]); TEAMS[G.me][0].x = W / 2; disc.x = W / 2; });
    await p.waitForFunction(() => canThrow() && document.getElementById('play1B').style.display !== 'none', null, { timeout: 5000 }).catch(() => {});
    t.ok(await vis(p, '#play1B') && await vis(p, '#play2B'), 'avec le disque : boutons ▶ Play 1 / Play 2');
    t.ok((await p.textContent('#play1B')).includes('Huck') && (await p.textContent('#play1B')).includes('(R)'), 'le bouton nomme le play et sa touche', await p.textContent('#play1B'));
    await p.keyboard.press('r');
    t.ok(await p.evaluate(() => G.oplay && G.oplay.type === 'huck'), 'touche R : le Play 1 est appelé');
    await p.waitForTimeout(200);
    t.ok(!(await vis(p, '#play1B')), 'pendant le play, les boutons disparaissent');
    await p.click('#menuB');
    t.ok(await vis(p, '#gameMenuCard') && await p.evaluate(() => G.paused), 'menu ☰ : le jeu se met en pause');
    await p.click('#gmCtrl');
    t.ok(await vis(p, '#ctrlCard'), 'panneau Commandes');
    await p.click('#ctrlBack'); await p.click('#gmReport');
    await p.fill('#repDesc', 'un test avec des espaces');
    t.ok((await p.inputValue('#repDesc')) === 'un test avec des espaces', 'les espaces passent dans la description');
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    await p.click('#repCopy');
    await p.waitForFunction(() => document.getElementById('repStatus').textContent.length > 0);
    t.ok(/copié|sélectionne/.test(await p.textContent('#repStatus')), 'rapport copié', await p.textContent('#repStatus'));
    await p.click('#repBack'); await p.click('#gmResume');
    t.ok(!(await p.evaluate(() => G.paused)) && !(await vis(p, '#gameMenuCard')), 'reprise du jeu');
    await p.click('#menuB'); await p.click('#gmQuit');
    t.ok(await vis(p, '#askBox'), 'abandonner un match demande confirmation');
    await p.click('#askYes');
    t.ok(await vis(p, '#lobbyHome'), 'quitter ramène au menu principal');

    t.group('Tutoriel');
    await p.click('#tutoB');
    await p.waitForFunction(() => G.tuto);
    t.ok(await vis(p, '#tutoBox'), 'consignes du tutoriel affichées');
    for (let k = 0; k < 15 && await p.evaluate(() => !!G.tuto); k++) { await p.click('#tutoSkip'); await p.waitForTimeout(150); }
    t.ok(await p.evaluate(() => !G.tuto) && await vis(p, '#stratCard'), 'toutes les étapes passent, puis un match commence');
    await p.click('#menuBack');
    if (await vis(p, '#askBox')) await p.click('#askYes');
    t.ok(await vis(p, '#lobbyHome'), '« Menu principal » depuis le menu d’avant-match');

    t.group('Entraînement et mini-tournoi');
    await p.click('#soloMenuB'); await p.click('#pracB');
    t.ok(await p.evaluate(() => !!G.practice) && await vis(p, '#pracBox'), 'entraînement lancé');
    await p.click('#pracQuit');
    await p.click('#soloMenuB'); await p.click('#seriesB');
    t.ok(await vis(p, '#seriesCard') && (await p.locator('#seriesList li').count()) === 3, 'mini-tournoi : 3 adversaires');
    await p.click('#seriesBack');
    t.ok(await vis(p, '#lobbySolo'), 'retour à la section Solo');
    await ctx.close();

    // ---------- téléphone ----------
    t.group('Téléphone : lancer au lance-pierre');
    const m = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const q = await m.newPage(); watch(q, 'mobile');
    await q.goto(srv.url + 'index.html');
    await q.waitForFunction(() => typeof G !== 'undefined' && G.attract);
    t.ok(await q.evaluate(() => document.body.classList.contains('touch')), 'mode tactile détecté');
    await q.click('#soloMenuB'); await q.click('#soloB');
    await q.evaluate(() => { G.form.first = String(G.me); });  // l'IA adverse pulle : on reçoit le disque
    await q.click('#go');
    await q.waitForFunction(() => G.phase === 'play', null, { timeout: 30000 });
    await q.evaluate(() => { G.off = G.me; G.pickup = null; holdDisc(TEAMS[G.me][0]); });   // on donne le disque à notre équipe
    await q.waitForFunction(() => canThrow(), null, { timeout: 5000 });
    const before = await q.evaluate(() => G.stats.throws);
    const pt = await q.evaluate(() => { const r = canvas.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, dir: dirOf(G.me) }; });
    const cdp = await m.newCDPSession(q);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [{ x, y, id: 1 }] });
    await touch('touchStart', pt.x, pt.y);
    for (let k = 1; k <= 8; k++) { await touch('touchMove', pt.x - pt.dir * k * 14, pt.y); await q.waitForTimeout(16); }   // tirer en arrière
    t.ok(await q.evaluate(() => G.aiming && G.pointer.active), 'la visée apparaît pendant le glissé');
    await touch('touchEnd', pt.x - pt.dir * 112, pt.y);
    await q.waitForTimeout(300);
    t.ok((await q.evaluate(() => G.stats.throws)) === before + 1, 'relâcher lance le disque');
    t.ok(await q.evaluate(d => disc.mode === 'air' ? Math.sign(disc.ex - disc.sx) === d : true, pt.dir), 'le disque part dans le sens opposé au glissé');

    t.group('Téléphone : appeler un play pendant la visée');
    await q.waitForTimeout(400);
    await q.evaluate(() => { G.off = G.me; G.oplay = null; G.pickup = null; const p = TEAMS[G.me][0]; p.x = W / 2; p.y = H / 2; holdDisc(p); });
    await q.waitForFunction(() => canThrow() && document.getElementById('play1B').style.display !== 'none', null, { timeout: 5000 });
    const th0 = await q.evaluate(() => G.stats.throws);
    const bb = await q.locator('#play1B').boundingBox(), bx = bb.x + bb.width / 2, by = bb.y + bb.height / 2;
    const two = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    await two('touchStart', [{ x: pt.x, y: pt.y, id: 1 }]);
    for (let k = 1; k <= 5; k++) { await two('touchMove', [{ x: pt.x - pt.dir * k * 14, y: pt.y, id: 1 }]); await q.waitForTimeout(16); }
    const f1 = { x: pt.x - pt.dir * 70, y: pt.y, id: 1 };
    await two('touchStart', [f1, { x: bx, y: by, id: 2 }]);              // 2e doigt sur ▶ Play 1, le 1er vise toujours
    await two('touchEnd', [{ x: bx, y: by, id: 2 }]);
    t.ok(await q.evaluate(() => !!G.oplay && G.oplay.n === 1), 'un 2e doigt sur ▶ appelle le play pendant que le 1er vise');
    t.ok(await q.evaluate(() => G.aiming), 'la visée continue');
    for (let k = 6; k <= 8; k++) { await two('touchMove', [{ x: pt.x - pt.dir * k * 14, y: pt.y, id: 1 }]); await q.waitForTimeout(16); }
    await two('touchEnd', [{ x: pt.x - pt.dir * 112, y: pt.y, id: 1 }]);
    await q.waitForTimeout(300);
    t.ok((await q.evaluate(() => G.stats.throws)) === th0 + 1, 'puis le lancer part normalement');
    await m.close();
  } finally {
    await browser.close(); await srv.close();
  }
  t.group('Erreurs JavaScript');
  t.ok(errs.length === 0, 'aucune erreur dans la page', errs.slice(0, 5));
}
