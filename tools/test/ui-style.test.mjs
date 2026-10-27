// « Mon style » dans un vrai navigateur : visuels verrouillés par les succès, choix gardés, et dessin du jeu avec chaque
// disque, terrain, tenue et célébration (dans les deux vues), sans erreur.
import { playwright, startServer } from './lib.mjs';

export default async function (t) {
  const { chromium } = playwright();
  const srv = await startServer();
  const browser = await chromium.launch();
  const errs = [];
  try {
    const p = await (await browser.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + 'index.html');
    await p.waitForFunction(() => typeof G !== 'undefined' && G.attract);

    t.group('Mon style : carte et verrous');
    await p.evaluate(() => storeSet('uf-ach', { high: 1 }));
    await p.click('#styleB');
    t.ok(await p.isVisible('#styleCard'), 'la carte « Mon style » s’ouvre depuis le menu principal');
    const tiles = await p.evaluate(() => ({ n: document.querySelectorAll('.stile').length, all: Object.values(STYLES).flat().length, locked: document.querySelectorAll('.stile.locked').length }));
    t.ok(tiles.n === tiles.all && tiles.locked > 5, 'tous les visuels sont listés, la plupart verrouillés au départ', tiles);
    await p.click('.stile[data-cat=disc][data-id=flamme]');
    t.ok(await p.evaluate(() => styleGet().disc === 'blanc' && /Roi des airs/.test(document.getElementById('toast').textContent)), 'un visuel verrouillé ne se choisit pas : on dit quel succès le débloque');
    await p.click('.stile[data-cat=disc][data-id=arcenciel]');
    t.ok(await p.evaluate(() => styleGet().disc === 'arcenciel' && document.querySelector('.stile[data-id=arcenciel]').classList.contains('on')), 'un visuel débloqué (succès « Par-dessus ») se choisit et reste choisi');
    await p.reload(); await p.waitForFunction(() => typeof G !== 'undefined' && G.attract);
    t.ok(await p.evaluate(() => styleOf('disc') === 'arcenciel'), 'le choix est gardé (navigateur, et compte s’il y en a un)');
    await p.evaluate(() => storeSet('uf-ach', {}));
    t.ok(await p.evaluate(() => styleOf('disc') === 'blanc'), 'succès effacés : on revient au style de base');

    t.group('Mon style : le jeu se dessine avec chaque visuel');
    await p.evaluate(() => { const a = {}; ACH.forEach(x => a[x.id] = 1); storeSet('uf-ach', a); });
    await p.evaluate(() => { document.getElementById('soloMenuB').click(); document.getElementById('soloB').click(); G.form.first = String(G.me); document.getElementById('go').click(); });
    await p.waitForFunction(() => G.phase === 'play', null, { timeout: 30000 });
    const drawn = await p.evaluate(async () => {
      const out = [], wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const v of ['top', 'iso']) {
        CTRL.view = v; resize();
        for (let k = 0; k < 10; k++) {
          styleSet({ disc: STYLES.disc[k % STYLES.disc.length].id, field: STYLES.field[k % STYLES.field.length].id, jersey: STYLES.jersey[k % STYLES.jersey.length].id, hair: STYLES.hair[k % STYLES.hair.length].id, acc: STYLES.acc[k % STYLES.acc.length].id, cele: STYLES.cele[k % STYLES.cele.length].id });
          G.off = G.me; G.pickup = null; const h = TEAMS[G.me][0]; holdDisc(h); h.think = 99;
          throwDisc(h, TEAMS[G.me][2].x, TEAMS[G.me][2].y, 0.4, 1, 0.5);
          fxPlay('score', 0, 0, G.me);
          await wait(); out.push(v + ':' + styleOf('field'));
        }
      }
      CTRL.view = 'top'; resize();
      return { out, snowDisc: (styleSet({ disc: 'blanc', field: 'neige' }), discSkin()) };
    });
    t.ok(drawn.out.length === 20, 'chaque combinaison est dessinée (vue de dessus et inclinée)', drawn.out.length);
    t.ok(drawn.snowDisc === 'orange', 'lisibilité : sur la neige, le disque blanc devient orange', drawn.snowDisc);

    t.ok(!errs.length, 'aucune erreur', errs);
  } finally { await browser.close(); await srv.close(); }
}
