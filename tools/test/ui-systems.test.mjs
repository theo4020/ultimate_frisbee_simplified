// Éditeur de systèmes dans le navigateur : créer une attaque (placer, dessiner une course), une défense, les choisir avant un point.
import { playwright, startServer } from './lib.mjs';

export default async function (t) {
  const { chromium } = playwright();
  const srv = await startServer();
  const browser = await chromium.launch();
  const errs = [];
  try {
    for (const [tag, opts] of [['ordinateur', { viewport: { width: 1100, height: 760 } }], ['téléphone', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }]]) {
      t.group('Éditeur — ' + tag);
      const c = await browser.newContext(opts), p = await c.newPage();
      p.on('pageerror', e => errs.push(tag + ' : ' + e.message));
      await p.goto(srv.url + 'index.html');
      await p.waitForFunction(() => typeof G !== 'undefined' && G.attract);
      await p.click('#sysB');
      t.ok(await p.isVisible('#sysItems .empty'), 'liste vide au départ');
      await p.click('#sysNewOff');
      await p.locator('#edField').scrollIntoViewIfNeeded();
      const box = { ...(await p.locator('#edField').boundingBox()) };
      const px = (f, s) => [box.x + (f + 10) / 48 * box.width, box.y + (18.5 - s) / 37 * box.height];
      const drag = async (a, b) => { await p.mouse.move(...px(...a)); await p.mouse.down(); await p.mouse.move(...px(...b), { steps: 6 }); await p.mouse.up(); };
      await drag([8, 2], [11, 7]);
      const pos0 = await p.evaluate(() => ED.sys.pos[0]);
      t.ok(Math.abs(pos0[0] - 11) < 1 && Math.abs(pos0[1] - 7) < 1, 'glisser un joueur change sa place', pos0);
      const n0 = await p.evaluate(() => ED.sys.steps.length);
      await p.click('#edModes [data-m="cut"]');
      Object.assign(box, await p.locator('#edField').boundingBox());   // le texte d'aide change : le terrain peut bouger
      await drag([14, 1], [30, -9]);
      const st = await p.evaluate(() => ED.sys.steps.at(-1));
      t.ok((await p.evaluate(() => ED.sys.steps.length)) === n0 + 1 && st.p === 1 && Math.abs(st.to[0] - 30) < 1, 'mode Courses : glisser depuis un joueur ajoute sa course', st);
      t.ok((await p.locator('#edSteps li').count()) === n0 + 1, 'la course apparaît dans la liste');
      t.ok(n0 === 0, 'nouvelle attaque : aucune course par défaut', n0);
      await drag([30, -9], [36, 4]);                                // depuis la fin de sa course : la suivante s'enchaîne
      const ch = await p.evaluate(() => ({ n: ED.sys.steps.length, last: ED.sys.steps.at(-1) }));
      t.ok(ch.n === 2 && ch.last.p === 1, 'glisser depuis le bout d’une flèche enchaîne une course du même joueur', ch);
      await p.click('#edSteps [data-rm="1"]');
      t.ok((await p.evaluate(() => ED.sys.steps.length)) === 1, 'une course se supprime');
      await p.click('#edModes [data-m="post"]');
      t.ok((await p.locator('#edSteps .poste').count()) === 4 && (await p.evaluate(() => ED.sys.postes[3].role)) === 'dump', 'mode Consignes : un bloc par poste (départ : vertical avec un relais)');
      await p.selectOption('select[data-p="1"][data-k="when"]', 'never');
      await p.fill('#edName', 'Mon huck'); await p.click('#edSave');
      t.ok((await p.textContent('#sysItems')).includes('Mon huck'), 'enregistré dans la liste');
      t.ok(await p.evaluate(() => storeGet('uf-systems', []).some(x => x.name === 'Mon huck' && x.postes[1].when === 'never')), 'les consignes sont enregistrées avec le système');
      await p.click('#sysNewDef'); await p.click('#edModes [data-m="man"]');
      await p.selectOption('select[data-r="0"]', 'double'); await p.fill('#edName', 'Pression'); await p.click('#edSave');
      t.ok((await p.locator('#sysItems li').count()) === 2, 'défense enregistrée aussi');
      t.ok(await p.evaluate(() => storeGet('uf-systems', []).length === 2), 'gardé dans le navigateur (et avec le compte)');
      await p.click('#sysBack');

      t.group('Choisir ses systèmes — ' + tag);
      await p.click('#soloMenuB'); await p.click('#soloB');
      const offVals = await p.$$eval('#selOff option', o => o.map(x => x.value));
      t.ok(offVals.slice(0, 3).join() === 'vert,ho,side' && offVals.some(v => v.startsWith('sys:')) && offVals.at(-1) === 'edit', 'menu déroulant : classiques, puis mes systèmes, puis « créer ou modifier »', offVals);
      const pick = async (sel) => { const v = await p.$$eval(sel + ' option', o => o.map(x => x.value).find(v => v.startsWith('sys:'))); await p.selectOption(sel, v); };
      await pick('#selOff'); await pick('#selDef');
      t.ok(await p.evaluate(() => osysOf(0) && osysOf(0).name === 'Mon huck' && dsysOf(0) && dsysOf(0).roles[0] === 'double'), 'les deux systèmes sont actifs');
      t.ok(await p.isVisible('#selForce'), 'individuelle : le choix du force reste proposé');
      const p1 = await p.$$eval('#selPlay1 option', o => o.map(x => x.value).find(v => v.startsWith('sys:')));
      await p.selectOption('#selPlay1', p1);
      t.ok(await p.evaluate(() => G.form.play1 === 'sys' && playSys(0, 1) && playSys(0, 1).name === 'Mon huck'), 'un système perso peut servir de Play 1');
      await p.selectOption('#selOff', 'ho');
      t.ok(await p.evaluate(() => !osysOf(0) && G.form.off === 'ho'), 'une formation de base remplace le système');
      await pick('#selOff');
      await p.selectOption('#selOff', 'edit');
      t.ok(await p.isVisible('#sysCard'), '« Créer ou modifier… » ouvre l’éditeur');
      t.ok(await p.evaluate(() => osysOf(0) && document.getElementById('selOff').value.startsWith('sys:')), 'le système choisi reste sélectionné');
      await p.click('#sysItems [data-a="del"]'); await p.click('#askYes');
      await p.click('#sysBack');
      t.ok(await p.evaluate(() => !osysOf(0) && ![...document.querySelectorAll('#selOff option')].some(o => o.value.startsWith('sys:')) && document.getElementById('selOff').value === 'ho'), 'système supprimé : il disparaît du menu, la formation de base revient');
      await p.click('#go');
      await p.waitForFunction(() => G.phase === 'pull' || G.phase === 'play');
      t.ok(true, 'le point démarre');
      await c.close();
    }
  } finally { await browser.close(); await srv.close(); }
  t.group('Erreurs JavaScript');
  t.ok(errs.length === 0, 'aucune erreur dans les pages', errs.slice(0, 5));
}
