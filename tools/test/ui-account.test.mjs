// Comptes dans le navigateur : création sur un appareil, connexion sur un autre, profil retrouvé, pseudo réservé.
import { playwright, startServer } from './lib.mjs';

export default async function (t) {
  const { chromium } = playwright();
  const srv = await startServer();
  const browser = await chromium.launch();
  const errs = [];
  const device = async (tag, mobile) => {
    const c = await browser.newContext(mobile ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } : { viewport: { width: 1100, height: 760 } });
    const p = await c.newPage();
    p.on('pageerror', e => errs.push(tag + ' : ' + e.message));
    await p.goto(srv.url + 'index.html');
    await p.waitForFunction(() => typeof G !== 'undefined' && G.attract);
    return p;
  };
  const endRun = async p => {                                   // une série du mode infini perdue d'entrée, jusqu'à la proposition d'enregistrer
    await p.click('#soloMenuB'); await p.click('#endlessB'); await p.click('#endGo');
    await p.evaluate(() => { G.score = [0, 1]; G.phase = 'play'; G.lastMenu = null; $('overlay').classList.add('hidden'); G.menuShown = false; scorePoint(1 - G.me, 'T'); });
    await p.waitForFunction(() => G.lastMenu === 'over' && G.menuShown); await p.click('#go');
  };
  try {
    t.group('Créer un compte (ordinateur)');
    const a = await device('ordi');
    await a.fill('#pname', 'Joueur1');
    await a.evaluate(() => { storeSet('uf-endless', { best: 3, runs: [{ wins: 3, diff: 4, at: 1 }] }); storeSet('uf-ach', { tuto: 1 }); });
    t.ok((await a.textContent('#accB')).includes('Créer un compte'), 'bouton « Créer un compte » à côté du pseudo');
    await a.click('#accB');
    t.ok((await a.inputValue('#accNewName')) === 'Joueur1' && (await a.inputValue('#accNewPw')).length >= 6, 'pseudo repris, mot de passe proposé');
    await a.fill('#accNewPw', 'mon-mdp-42');
    await a.click('#accGo');
    await a.waitForFunction(() => document.getElementById('accB').textContent.includes('✓'), null, { timeout: 5000 });
    t.ok(await a.evaluate(() => document.getElementById('pname').readOnly), 'connecté : le pseudo est celui du compte');
    t.ok((await a.textContent('#accBody')).includes('Joueur1'), 'le panneau montre le compte');
    await a.click('#accEye');
    t.ok((await a.textContent('#accBody')).includes('mon-mdp-42'), 'le mot de passe peut être affiché');
    await a.waitForFunction(() => /Sauvegardé/.test(document.getElementById('accBody').textContent), null, { timeout: 8000 });
    const row = srv.accounts('SELECT * FROM accounts WHERE k = ?', 'joueur1')[0], rec = row && { ...row, data: JSON.parse(row.data) };
    t.ok(rec && JSON.parse(rec.data['uf-endless']).best === 3 && !JSON.stringify(rec).includes('mon-mdp-42'), 'profil envoyé au serveur, sans le mot de passe');
    await a.click('#accBack');
    await a.evaluate(() => storeSet('uf-tuto', true));
    await a.waitForFunction(() => /Sauvegardé/.test(document.getElementById('accBody').textContent) || true);
    await a.waitForTimeout(3500);
    t.ok(JSON.parse(srv.accounts('SELECT data FROM accounts WHERE k = ?', 'joueur1')[0].data)['uf-tuto'] === 'true', 'un changement est sauvegardé tout seul');

    t.group('Se connecter sur un autre appareil (téléphone)');
    const b = await device('mobile', true);
    await b.click('#accB');
    await b.click('.accTabs button[data-t="log"]');
    await b.fill('#accLogName', 'joueur1'); await b.fill('#accLogPw', 'faux-mdp');
    await b.click('#accGo');
    await b.waitForFunction(() => /incorrect/.test(document.getElementById('accMsg').textContent));
    t.ok(true, 'mauvais mot de passe : message clair');
    await b.fill('#accLogPw', 'mon-mdp-42');
    await Promise.all([b.waitForNavigation(), b.click('#accGo')]);
    await b.waitForFunction(() => typeof G !== 'undefined' && G.attract);
    const st = await b.evaluate(() => ({ name: myName(), best: storeGet('uf-endless', {}).best, tuto: storeGet('uf-tuto', false), ro: document.getElementById('pname').readOnly }));
    t.ok(st.name === 'Joueur1' && st.best === 3 && st.tuto === true && st.ro, 'profil retrouvé : pseudo, record, tutoriel fait', st);
    t.ok((await b.textContent('#endlessTxt')).includes('3 matchs'), 'le record s’affiche sur ce téléphone');

    t.group('Classement avec le compte');
    await endRun(b);
    t.ok(await b.evaluate(() => document.getElementById('endSaveName').readOnly && document.getElementById('endSaveName').value === 'Joueur1'), 'pseudo du compte imposé');
    await b.click('#endSaveB');
    await b.waitForFunction(() => /classement mondial|non enregistré/.test(document.getElementById('endStatus').textContent), null, { timeout: 8000 });
    t.ok(srv.board('SELECT name FROM scores')[0].name === 'Joueur1', 'score enregistré sous le compte', srv.board('SELECT * FROM scores'));
    const c = await device('autre');
    await endRun(c);
    await c.fill('#endSaveName', 'JOUEUR1'); await c.click('#endSaveB');
    await c.waitForFunction(() => /non enregistré/.test(document.getElementById('endStatus').textContent), null, { timeout: 8000 });
    t.ok((await c.textContent('#endStatus')).includes('compte'), 'quelqu’un d’autre ne peut pas prendre ce pseudo', await c.textContent('#endStatus'));

    t.group('Changer de pseudo');
    await b.click('#endBack').catch(() => {});
    await b.evaluate(() => { openCard('accountCard'); accRender(); });
    await b.click('#accRenameB');
    await b.fill('#accRenameIn', 'Joueur9'); await b.click('#accRenameGo');
    await b.waitForFunction(() => document.getElementById('pname').value === 'Joueur9', null, { timeout: 8000 }).catch(() => {});
    t.ok((await b.inputValue('#pname')) === 'Joueur9' && (await b.textContent('#accBody')).includes('Joueur9'), 'pseudo du compte changé', await b.inputValue('#pname'));
    t.ok(srv.board('SELECT name FROM scores').some(r => r.name === 'Joueur9') && !srv.board('SELECT name FROM scores').some(r => r.name === 'Joueur1'), 'le classement affiche le nouveau pseudo');
    await a.evaluate(() => accSave());
    await a.waitForFunction(() => storeGet('uf-acc', {}).name === 'Joueur9', null, { timeout: 8000 }).catch(() => {});
    t.ok(await a.evaluate(() => storeGet('uf-acc', {}).name === 'Joueur9' && document.getElementById('pname').value === 'Joueur9'), 'l’autre appareil suit le nouveau pseudo tout seul');

    t.group('Déconnexion');
    await a.click('#accB'); await a.click('#accOut');
    t.ok(!(await a.evaluate(() => document.getElementById('pname').readOnly)) && (await a.textContent('#accB')).includes('Créer'), 'déconnecté : pseudo de nouveau modifiable');
    t.ok(await a.evaluate(() => storeGet('uf-endless', {}).best === 3), 'le profil reste sur l’appareil');
  } finally { await browser.close(); await srv.close(); }
  t.group('Erreurs JavaScript');
  t.ok(errs.length === 0, 'aucune erreur dans les pages', errs.slice(0, 5));
}
