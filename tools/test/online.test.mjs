// Jeu en ligne dans deux onglets (hôte + invité). PeerJS est remplacé par fakepeer.js (les onglets se parlent
// directement), ce qui teste tout le jeu en ligne sauf le réseau lui-même : salle d'attente, équipes, départ,
// états envoyés à l'invité, ses commandes, pause pour tout le monde, départ d'un joueur.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright, startServer } from './lib.mjs';

export default async function (t) {
  const { chromium } = playwright();
  const shim = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fakepeer.js'), 'utf8');
  const srv = await startServer();
  const browser = await chromium.launch();
  const errs = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
    await ctx.addInitScript(shim);
    const host = await ctx.newPage(), guest = await ctx.newPage();
    for (const [n, p] of [['hôte', host], ['invité', guest]]) p.on('pageerror', e => errs.push(n + ' : ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
    const ready = p => p.waitForFunction(() => typeof G !== 'undefined' && G.attract);

    t.group('Salle d’attente');
    await host.goto(srv.url + 'index.html'); await ready(host);
    await host.fill('#pname', 'Hôte');
    await host.click('#hostB');
    await host.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.getElementById('hostCode').textContent));
    const code = await host.textContent('#hostCode');
    t.ok(true, 'partie créée, code ' + code);
    await guest.goto(srv.url + 'index.html'); await ready(guest);
    await guest.fill('#pname', 'Invité');
    await guest.goto('about:blank');
    await guest.goto(srv.url + 'index.html#join=' + code);
    await host.waitForFunction(() => G.humans.length === 2, null, { timeout: 10000 });
    t.ok(await guest.evaluate(() => G.net === 'guest' && G.spectator), 'l’invité arrive en spectateur');
    await guest.click('#teamB1');
    await host.waitForFunction(() => G.humans.some(h => h.id !== 0 && h.team === 1), null, { timeout: 5000 });
    t.ok(true, 'l’invité rejoint les Rouges');
    t.ok((await host.textContent('#rosterR')).includes('Invité'), 'son pseudo apparaît chez l’hôte');

    t.group('Début de la partie');
    await host.click('#startOnline');
    await guest.waitForFunction(() => document.getElementById('stratCard').style.display !== 'none', null, { timeout: 5000 });
    // l'invité (capitaine des Rouges) choisit un système perso : il doit partir chez l'hôte avec sa stratégie
    await guest.evaluate(() => { const s = cleanSystem(Object.assign(SYS_NEW.off(), { id: 'abc123', name: 'Mon huck', steps: [{ p: 0, to: [6, 10], wait: 0.6 }, { p: 2, to: [32, 6], wait: 1 }, { p: 1, to: [9, -8], wait: 1 }] })); sysSave([s]); G.form.osys = s.id; });
    await host.click('#go'); await guest.click('#go');
    await host.waitForFunction(() => G.phase === 'pull' || G.phase === 'play', null, { timeout: 8000 });
    t.ok(true, 'les deux capitaines prêts : le point démarre');
    t.ok(await host.evaluate(() => { const s = osysOf(1); return !!s && s.name === 'Mon huck' && s.steps.length === 3; }), 'l’hôte joue le système perso de l’invité');
    // le pull : si c'est l'invité (capitaine des Rouges) qui pulle, il clique deux fois (direction puis puissance)
    for (let k = 0; k < 40 && await host.evaluate(() => G.phase === 'pull'); k++) {
      for (const p of [host, guest]) {
        if (await p.evaluate(() => typeof localPuller === 'function' && localPuller())) {
          const pt = await p.evaluate(() => { const r = canvas.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
          await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(450); await p.mouse.click(pt.x, pt.y);
        }
      }
      await host.waitForTimeout(500);
    }
    await host.waitForFunction(() => G.phase === 'play', null, { timeout: 30000 });
    t.ok(true, 'le jeu commence après le pull');
    const d0 = await guest.evaluate(() => [disc.x, disc.y, players[0].x]);
    await guest.waitForTimeout(1500);
    const d1 = await guest.evaluate(() => [disc.x, disc.y, players[0].x]);
    t.ok(d0.join() !== d1.join(), 'l’invité reçoit les mouvements en direct');
    const sync = await Promise.all([host, guest].map(p => p.evaluate(() => players.map(q => [q.x, q.y]))));
    const gap = Math.max(...sync[0].map((a, i) => Math.hypot(a[0] - sync[1][i][0], a[1] - sync[1][i][1])));
    t.ok(gap < 6, 'positions identiques chez l’hôte et l’invité (à quelques mètres près)', +gap.toFixed(1));

    t.group('Commandes de l’invité');
    t.ok(await guest.evaluate(() => G.me === 1 && !G.spectator), 'l’invité joue les Rouges');
    // on donne le disque aux Rouges ; seul humain de son équipe, l'invité lance pour toute l'équipe
    await host.evaluate(() => { const p = TEAMS[1].reduce((a, b) => (Math.abs(b.x - W / 2) < Math.abs(a.x - W / 2) ? b : a)); G.off = 1; p.x = W / 2; p.y = H / 2; holdDisc(p); p.think = 99; });   // au milieu : la passe test ne marque pas
    await guest.waitForFunction(() => canThrow(), null, { timeout: 5000 });
    await guest.bringToFront(); await guest.keyboard.press('t');      // l'invité appelle son Play 2 : l'hôte le lance
    await host.waitForFunction(() => G.oplay && G.oplay.team === 1, null, { timeout: 3000 }).catch(() => {});
    t.ok(await host.evaluate(() => !!G.oplay && G.oplay.team === 1 && G.oplay.n === 2), 'l’invité appelle un play : il se joue chez l’hôte');
    // chez l'invité, le porteur glisse vers sa nouvelle place (positions lissées) : on vise une fois qu'il y est
    await guest.waitForFunction(() => canThrow() && disc.holder && Math.abs(disc.holder.x - W / 2) < 0.3 && Math.abs(disc.holder.y - H / 2) < 0.3, null, { timeout: 5000 }).catch(() => {});
    const th = await host.evaluate(() => G.stats.throws);
    const aim = await guest.evaluate(() => {               // un point du terrain à ~10 m devant, qui n'est pas sous un bouton (▶ plays, etc.)
      const r = canvas.getBoundingClientRect(), h = disc.holder;
      for (const [fx, fy] of [[10, 0], [10, 4], [10, -4], [8, 6], [8, -6], [12, 0]]) {
        const x = r.left + X(h.x + fx * dirOf(1)), y = r.top + Y(clamp(h.y + fy, 2, H - 2));
        if (document.elementFromPoint(x, y) === canvas) return { x, y };
      }
      return { x: r.left + X(h.x + 10 * dirOf(1)), y: r.top + Y(h.y) }; });
    await guest.mouse.move(aim.x, aim.y); await guest.mouse.down(); await guest.mouse.up();
    await host.waitForFunction(n => G.stats.throws > n, th, { timeout: 5000 }).catch(() => {});
    t.ok((await host.evaluate(() => G.stats.throws)) === th + 1, 'la passe de l’invité est jouée chez l’hôte');

    t.group('Ce que l’adversaire ne voit pas');
    await host.evaluate(() => { G.oplay = null; const p = TEAMS[0].reduce((a, b) => (Math.abs(b.x - W / 2) < Math.abs(a.x - W / 2) ? b : a)); G.off = 0; p.x = W / 2; p.y = H / 2; holdDisc(p); p.think = 99; G.form.play1 = 'split'; });
    await host.evaluate(() => callPlay(0, 1));
    await guest.bringToFront();
    await guest.waitForFunction(() => G.msgT > 0 && G.msgTeam === 0, null, { timeout: 3000 }).catch(() => {});
    const seen = await guest.evaluate(() => ({ hidden: hiddenFromMe(G.msgTeam), alt: G.msgAlt, real: G.msg, tagged: players.filter(p => p.tag && p.team === 0).length, tagsShown: players.filter(p => p.tag && p.team === 0 && !hiddenFromMe(p.team)).length }));
    t.ok(seen.hidden && seen.alt === 'Play appelé !', 'l’adversaire voit qu’un play est appelé, sans savoir lequel', seen);
    t.ok(seen.tagged > 0 && seen.tagsShown === 0, 'les joueurs concernés par le play adverse ne sont pas signalés', seen);
    t.ok(await host.evaluate(() => !hiddenFromMe(G.msgTeam) && G.msg.includes('Double cut')), 'l’équipe qui attaque voit le nom du play');
    const rings = await guest.evaluate(() => { const n = FX.parts.length; fxPlay('call', 50, 18, 0); return FX.parts.length - n; });
    t.ok(rings === 0, 'un appel de cut adverse ne s’affiche pas');
    t.ok(await guest.evaluate(() => { const n = FX.parts.length; fxPlay('call', 50, 18, 1); return FX.parts.length > n; }), 'un appel de cut de son équipe s’affiche');

    t.group('Pause pour tout le monde');
    await guest.click('#menuB'); await guest.click('#gmPause');
    await host.waitForFunction(() => !!G.pz, null, { timeout: 5000 });
    await host.waitForFunction(() => document.getElementById('pauseText').textContent.includes('Invité'), null, { timeout: 3000 }).catch(() => {});
    t.ok((await host.textContent('#pauseText')).includes('Invité'), 'l’hôte voit qui a mis en pause', await host.textContent('#pauseText'));
    const gt = await host.evaluate(() => G.gt); await host.waitForTimeout(500);
    t.ok((await host.evaluate(() => G.gt)) === gt, 'le jeu est arrêté pendant la pause');
    await guest.bringToFront();                                  // onglet en arrière-plan : le navigateur y met le jeu en veille
    await guest.waitForFunction(() => document.getElementById('pauseBanner').style.display !== 'none', null, { timeout: 5000 });
    await guest.click('#pauseResume');
    await host.waitForFunction(() => !G.pz, null, { timeout: 5000 });
    t.ok(true, 'celui qui a mis en pause relance');

    t.group('Départ de l’invité');
    await guest.click('#menuB'); await guest.click('#gmQuit');
    if (await guest.isVisible('#askBox')) await guest.click('#askYes');
    t.ok(await guest.isVisible('#lobbyHome'), 'l’invité quitte et retrouve le menu principal');
    await host.waitForFunction(() => G.humans.length === 1, null, { timeout: 15000 });
    t.ok(await host.evaluate(() => G.net === 'host' && (G.phase === 'play' || G.phase === 'between' || G.phase === 'pull' || G.phase === 'over')), 'la partie continue chez l’hôte');
    await ctx.close();
  } finally {
    await browser.close(); await srv.close();
  }
  t.group('Erreurs JavaScript');
  t.ok(errs.length === 0, 'aucune erreur dans les pages', errs.slice(0, 5));
}
