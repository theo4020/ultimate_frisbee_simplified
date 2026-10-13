// Galerie dans le navigateur : publier depuis un appareil, voir / aimer / ajouter depuis un autre, retirer.
import { playwright, startServer } from './lib.mjs';

export default async function (t) {
  const { chromium } = playwright();
  const srv = await startServer();
  const browser = await chromium.launch();
  const errs = [];
  const device = async (tag, mobile) => {
    const c = await browser.newContext(mobile ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } : { viewport: { width: 1100, height: 760 } });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(tag + ' : ' + e.message));
    await p.goto(srv.url + 'index.html'); await p.waitForFunction(() => typeof G !== 'undefined' && G.attract);
    return p;
  };
  const account = async (p, name) => {
    await p.click('#accB'); await p.fill('#accNewName', name); await p.click('#accGo');
    await p.waitForFunction(() => document.getElementById('accB').textContent.includes('✓'));
    await p.click('#accBack');
  };
  try {
    t.group('Publier (ordinateur)');
    const a = await device('ordi');
    await a.evaluate(() => sysSave([Object.assign(SYS_NEW.off(), { id: 'aaa111', name: 'Mon huck', steps: [{ p: 0, to: [30, 5], wait: 0.6 }] })]));
    await a.click('#sysB');
    await a.click('#sysItems [data-a="pub"]');
    t.ok((await a.textContent('#toast')).includes('compte'), 'sans compte : on propose d’en créer un');
    await a.click('#sysBack');
    await account(a, 'Auteur');
    await a.click('#sysB'); await a.click('#sysItems [data-a="pub"]');
    await a.waitForFunction(() => sysList()[0].pub, null, { timeout: 5000 });
    t.ok(await a.isVisible('#sysItems [data-a="pub"].on'), 'publié : le bouton 🌍 le montre');
    await a.click('#sysTabs [data-t="gal"]');
    await a.waitForFunction(() => document.querySelectorAll('#galItems li').length > 0, null, { timeout: 5000 });
    t.ok((await a.textContent('#galItems')).includes('Mon huck') && await a.isVisible('#galItems [data-a="del"]'), 'il apparaît dans la galerie, avec ✕ pour son auteur');

    t.group('Voir, aimer, ajouter (téléphone)');
    const b = await device('mobile', true);
    await b.click('#sysB'); await b.click('#sysTabs [data-t="gal"]');
    await b.waitForFunction(() => document.querySelectorAll('#galItems li').length > 0, null, { timeout: 5000 });
    t.ok((await b.textContent('#galItems')).includes('par Auteur') && !(await b.isVisible('#galItems [data-a="del"]')), 'visible par tous, sans ✕ pour les autres');
    await b.click('#galItems [data-a="like"]');
    t.ok((await b.textContent('#galStatus')).includes('compte'), 'sans compte : pas de ❤');
    await b.click('#galItems [data-a="view"]');
    await b.waitForFunction(() => ED.ro && document.getElementById('sysEdit').style.display !== 'none', null, { timeout: 5000 });
    t.ok(await b.isVisible('#edAdd') && !(await b.isVisible('#edSave')) && (await b.textContent('#edBy')).includes('Auteur'), 'aperçu en lecture seule, avec l’auteur');
    t.ok(await b.evaluate(() => document.getElementById('edName').readOnly), 'on ne peut pas modifier l’original');
    await b.click('#edAdd');
    t.ok(await b.evaluate(() => sysList().length === 1 && sysList()[0].name === 'Mon huck' && sysList()[0].by === 'Auteur' && !sysList()[0].pub), 'ajouté à mes systèmes, avec le nom de l’auteur');
    await b.click('#edCancel');
    t.ok(await b.isVisible('#galView'), 'retour à la galerie');
    await b.click('#galBack');
    await account(b, 'Fan');
    await b.click('#sysB'); await b.click('#sysTabs [data-t="gal"]');
    await b.waitForFunction(() => document.querySelectorAll('#galItems li').length > 0);
    await b.click('#galItems [data-a="like"]');
    await b.waitForFunction(() => document.querySelector('#galItems .like.on'), null, { timeout: 5000 });
    t.ok((await b.textContent('#galItems .like')).includes('1'), 'avec un compte : ❤ 1');

    t.group('Retirer');
    await a.click('#galItems [data-a="del"]'); await a.click('#askYes');
    await a.waitForFunction(() => !document.querySelector('#galItems li .gi'), null, { timeout: 5000 });
    t.ok(await a.evaluate(() => !sysList()[0].pub), 'retiré : le système redevient « non publié »');
  } finally { await browser.close(); await srv.close(); }
  t.group('Erreurs JavaScript');
  t.ok(errs.length === 0, 'aucune erreur dans les pages', errs.slice(0, 5));
}
