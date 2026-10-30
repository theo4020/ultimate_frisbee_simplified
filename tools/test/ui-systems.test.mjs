// Éditeur de systèmes dans le navigateur : créer une attaque (placer, dessiner une course), une défense, les choisir avant un point.
import { playwright, startServer } from './lib.mjs';

const devicePixelRatioIsOne = e => e.dpr === 1 && e.ratio === 1;
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
      await p.click('#sysNewOff');                                   // ---- formation : placer, puis consignes
      await p.locator('#edField').scrollIntoViewIfNeeded();
      const box = { ...(await p.locator('#edField').boundingBox()) };
      const px = (f, s) => [box.x + (f + 10) / 48 * box.width, box.y + (18.5 - s) / 37 * box.height];
      const drag = async (a, b) => { await p.mouse.move(...px(...a)); await p.mouse.down(); await p.mouse.move(...px(...b), { steps: 6 }); await p.mouse.up(); };
      await drag([10, 1], [11, 7]);
      const pos0 = await p.evaluate(() => ED.sys.pos[0]);
      t.ok(Math.abs(pos0[0] - 11) < 1 && Math.abs(pos0[1] - 7) < 1, 'formation : glisser un joueur change sa place', pos0);
      t.ok(!(await p.isVisible('#edModes [data-m="cut"]')), 'une formation n’a pas de courses (ce sont les plays)');
      await p.click('#edModes [data-m="post"]');
      t.ok((await p.locator('#edSteps .poste').count()) === 4 && (await p.evaluate(() => ED.sys.postes[3].role)) === 'dump', 'mode Consignes : un bloc par poste (départ : vertical avec un relais)');
      await p.selectOption('select[data-p="1"][data-k="when"]', 'never');
      await p.fill('#edName', 'Ma forme'); await p.click('#edSave');
      t.ok(await p.evaluate(() => storeGet('uf-systems', []).some(x => x.name === 'Ma forme' && x.kind === 'off' && x.postes[1].when === 'never')), 'formation enregistrée avec ses consignes');
      await p.click('#sysNewPlay');                                  // ---- play : formation de départ + courses
      const bases = await p.$$eval('#edBaseSel option', o => o.map(x => x.value));
      t.ok(bases.slice(0, 3).join() === 'vert,ho,side' && bases.some(v => v.startsWith('sys:')), 'play : départ depuis une formation du jeu ou une des tiennes', bases);
      const fid = bases.find(v => v.startsWith('sys:')); await p.selectOption('#edBaseSel', fid);
      Object.assign(box, await p.locator('#edField').boundingBox());
      t.ok(await p.evaluate(() => JSON.stringify(playPos(ED.sys)) === JSON.stringify(sysById(ED.sys.base.slice(4)).pos)), 'les joueurs partent des places de la formation choisie');
      const fp = await p.evaluate(() => playPos(ED.sys)[1]);
      await drag(fp, [30, -9]);
      const st = await p.evaluate(() => ED.sys.steps.at(-1));
      t.ok((await p.evaluate(() => ED.sys.steps.length)) === 1 && st.p === 1 && Math.abs(st.to[0] - 30) < 1, 'glisser depuis un joueur ajoute sa course', st);
      t.ok((await p.locator('#edSteps li').count()) === 1, 'la course apparaît dans la liste');
      await p.locator('#edField').scrollIntoViewIfNeeded(); Object.assign(box, await p.locator('#edField').boundingBox());   // la liste des courses a pu décaler le terrain
      await drag([30, -9], [36, 4]);                                // depuis la fin de sa course : la suivante s'enchaîne
      const ch = await p.evaluate(() => ({ n: ED.sys.steps.length, last: ED.sys.steps.at(-1) }));
      t.ok(ch.n === 2 && ch.last.p === 1, 'glisser depuis le bout d’une flèche enchaîne une course du même joueur', ch);
      await p.click('#edSteps [data-rm="1"]');
      t.ok((await p.evaluate(() => ED.sys.steps.length)) === 1, 'une course se supprime');
      await p.fill('#edName', 'Mon huck'); await p.click('#edSave');
      t.ok(await p.evaluate(() => storeGet('uf-systems', []).some(x => x.name === 'Mon huck' && x.kind === 'play' && x.base.startsWith('sys:') && x.pos.length === 4)), 'play enregistré (avec les places de sa formation)');
      await p.click('#sysNewDef');                                   // ---- défense : missions mélangées
      await p.click('#edModes [data-m="post"]');
      t.ok((await p.locator('#edSteps .poste').count()) === 5, 'défense : la mark + 4 défenseurs');
      await p.selectOption('select[data-dp="0"][data-k="mission"]', 'man');
      t.ok(await p.isVisible('select[data-dp="0"][data-k="side"]') && !(await p.isVisible('select[data-dp="0"][data-k="behave"]')), 'en individuelle : placement et distance (plus de comportement de zone)');
      await p.selectOption('select[data-mk="double"]', '4'); await p.selectOption('select[data-mk="force"]', 'straight');
      await p.fill('#edName', 'Pression'); await p.click('#edSave');
      t.ok((await p.locator('#sysItems li').count()) === 3, 'formation, play et défense dans la liste');
      t.ok(await p.evaluate(() => storeGet('uf-systems', []).some(x => x.kind === 'def' && x.postes[0].mission === 'man' && x.mark.double === '4')), 'gardé dans le navigateur (et avec le compte)');
      await p.click('#sysBack');

      t.group('Choisir ses systèmes — ' + tag);
      await p.click('#soloMenuB'); await p.click('#soloB');
      const offVals = await p.$$eval('#selOff option', o => o.map(x => x.value));
      t.ok(offVals.slice(0, 3).join() === 'vert,ho,side' && offVals.some(v => v.startsWith('sys:')) && offVals.at(-1) === 'edit', 'menu déroulant : classiques, puis mes systèmes, puis « créer ou modifier »', offVals);
      const pick = async (sel) => { const v = await p.$$eval(sel + ' option', o => o.map(x => x.value).find(v => v.startsWith('sys:'))); await p.selectOption(sel, v); };
      await pick('#selOff'); await pick('#selDef');
      t.ok(await p.evaluate(() => osysOf(0) && osysOf(0).name === 'Ma forme' && dsysOf(0) && dsysOf(0).name === 'Pression'), 'formation et défense perso actives');
      await p.evaluate(() => { G.dplay = null; });             // le match de fond peut avoir lancé une junk, qui change la défense
      t.ok(!(await p.isVisible('#selForce')) && await p.evaluate(() => forceOf(0) === 'straight'), 'défense avec sa propre force : le menu de force est masqué');
      const p1 = await p.$$eval('#selPlay1 option', o => o.map(x => x.value).find(v => v.startsWith('sys:')));
      await p.selectOption('#selPlay1', p1);
      t.ok(await p.evaluate(() => G.form.play1 === 'sys' && playSys(0, 1) && playSys(0, 1).name === 'Mon huck'), 'un play perso peut servir de Play 1');
      t.ok(!(await p.$$eval('#selPlay1 option', o => o.map(x => x.textContent))).some(x => x.includes('Ma forme')), 'les formations ne sont pas proposées comme plays');
      await p.selectOption('#selOff', 'ho');
      t.ok(await p.evaluate(() => !osysOf(0) && G.form.off === 'ho'), 'une formation de base remplace le système');
      await pick('#selOff');
      await p.selectOption('#selOff', 'edit');
      t.ok(await p.isVisible('#sysCard'), '« Créer ou modifier… » ouvre l’éditeur');
      t.ok(await p.evaluate(() => osysOf(0) && document.getElementById('selOff').value.startsWith('sys:')), 'le système choisi reste sélectionné');
      await p.click('#sysItems [data-a="del"]'); await p.click('#askYes');
      await p.click('#sysBack');
      t.ok(await p.evaluate(() => !osysOf(0) && ![...document.querySelectorAll('#selOff option')].some(o => o.value.startsWith('sys:')) && document.getElementById('selOff').value === 'ho'), 'système supprimé : il disparaît du menu, la formation de base revient');
      await p.evaluate(() => { G.tossed = true; }); await p.click('#go');
      await p.waitForFunction(() => G.phase === 'pull' || G.phase === 'play');
      t.ok(true, 'le point démarre');
      t.group('Mode économie');
      const eco = await p.evaluate(() => {
        CTRL.eco = 'auto'; ecoReset(); G.paused = false; G.pz = false; resize();
        const full = canvas.width, pr = G.phase;
        G.phase = 'play'; for (let i = 0; i < 60; i++) ecoWatch(16.7);           // fluide : rien ne change
        const smooth = ecoOn();
        for (let i = 0; i < 200; i++) ecoWatch(45);                             // ~22 images/s pendant plus de 6 s
        const r = { smooth, on: ecoOn(), saved: localStorage.getItem('uf-eco'), ratio: canvas.width / full, dpr, toast: document.getElementById('toast').textContent };
        CTRL.eco = 'off'; r.offNow = ecoOn(); CTRL.eco = 'auto'; ecoReset(); resize(); r.reset = !ecoOn() && !localStorage.getItem('uf-eco'); G.phase = pr;
        return r;
      });
      t.ok(!eco.smooth && eco.on && eco.saved === '1' && /économie/.test(eco.toast), 'image qui saccade : le mode économie s’allume tout seul (et le dit)', eco);
      t.ok(eco.dpr <= 1.5 && (eco.ratio < 1 || devicePixelRatioIsOne(eco)), 'moins de pixels à peindre', eco);
      t.ok(!eco.offNow && eco.reset, '« Jamais » le coupe, revenir en automatique repart de zéro', eco);
      await c.close();
    }
  } finally { await browser.close(); await srv.close(); }
  t.group('Erreurs JavaScript');
  t.ok(errs.length === 0, 'aucune erreur dans les pages', errs.slice(0, 5));
}
