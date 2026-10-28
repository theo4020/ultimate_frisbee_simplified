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
    await host.click('#onlineMenuB'); await host.click('#hostB');
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
    await guest.evaluate(() => { const s = cleanSystem(Object.assign(SYS_NEW.off(), { id: 'abc123', name: 'Mon huck' })); s.postes[0].zone = 'break'; sysSave([s]); G.form.osys = s.id; });
    await guest.evaluate(() => setOpt('force', 'bas'));
    await host.waitForFunction(() => cfg(1).force === 'bas', null, { timeout: 3000 }).catch(() => {});
    t.ok(await host.evaluate(() => cfg(1).force === 'bas'), 'un choix du capitaine invité part tout de suite chez l’hôte (avant « Prêt »)');
    await host.click('#go'); await guest.click('#go');
    await host.waitForFunction(() => G.phase === 'pull' || G.phase === 'play', null, { timeout: 8000 });
    t.ok(true, 'les deux capitaines prêts : le point démarre');
    t.ok(await host.evaluate(() => { const s = osysOf(1); return !!s && s.name === 'Mon huck' && s.postes[0].zone === 'break'; }), 'l’hôte joue la formation perso de l’invité (avec ses consignes)');
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
    await guest.mouse.move(aim.x, aim.y);
    await host.waitForFunction(() => { const g = G.humans.find(h => h.id !== G.myId); return g && inputOf(g).aim; }, null, { timeout: 3000 }).catch(() => {});
    t.ok(await host.evaluate(() => !!netAimOut() && !allyAim()), 'l’invité vise : l’hôte reçoit sa visée, mais ne l’affiche pas (équipe adverse)');
    await guest.mouse.down(); await guest.mouse.up();
    await host.waitForFunction(n => G.stats.throws > n, th, { timeout: 5000 }).catch(() => {});
    t.ok((await host.evaluate(() => G.stats.throws)) === th + 1, 'la passe de l’invité est jouée chez l’hôte');
    const fl = await guest.evaluate(() => new Promise(res => setTimeout(() => { const a = disc.t; setTimeout(() => res({ mode: disc.mode, a, b: disc.t, dur: disc.dur }), 120); }, 60)));
    t.ok(fl.mode !== 'air' || (fl.b > fl.a && fl.b < fl.dur), 'pendant le vol, l’invité suit le temps de vol (trajectoire affichée)', fl);

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

    t.group('Hôte qui change d’onglet');
    await host.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const hb = await host.evaluate(() => ({ bg: bgActive(), t: G.time }));
    await host.waitForTimeout(1500);
    const ha = await host.evaluate(() => ({ bg: bgActive(), t: G.time }));
    t.ok(hb.bg && ha.t - hb.t > 1, 'onglet caché : le jeu de l’hôte continue (au rythme d’un Worker)', { hb, ha });
    t.ok(await guest.evaluate(() => G.time - lastRecv < 1 && !hostWaitMsg()), 'l’invité reçoit toujours le jeu');
    await host.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    t.ok(await host.evaluate(() => !bgActive()), 'onglet revenu : retour à l’affichage normal');
    t.ok(await guest.evaluate(() => { lastRecv = G.time - 5; return /En attente de l’hôte/.test(hostWaitMsg()); }), 'hôte muet depuis quelques secondes : l’invité voit « En attente de l’hôte »');

    t.group('Réactions');
    await guest.bringToFront();
    t.ok(await guest.isVisible('#emoToggle') && !(await guest.isVisible('#emoList')), 'un seul petit bouton 😀 sur le terrain');
    t.ok(await guest.evaluate(() => getComputedStyle(document.getElementById('emoBar')).pointerEvents === 'none'), 'autour du bouton, le terrain reste cliquable');
    await guest.click('#emoToggle');
    t.ok(await guest.isVisible('#emoList'), 'le toucher ouvre la liste des réactions');
    const ne = await host.evaluate(() => G.emotes.length);
    await guest.click('#emoList button');
    await host.waitForFunction(n => G.emotes.length > n, ne, { timeout: 3000 }).catch(() => {});
    t.ok((await host.evaluate(() => G.emotes.length)) > ne && !(await guest.isVisible('#emoList')), 'réaction envoyée, la liste se referme');

    t.group('Code de la partie dans le menu');
    await guest.click('#menuB');
    t.ok(await guest.isVisible('#gmCodeBox') && (await guest.textContent('#gmCode')) === code, 'menu ☰ de l’invité : le code pour inviter d’autres joueurs', await guest.textContent('#gmCode'));
    await guest.click('#gmResume');
    await host.bringToFront(); await host.click('#menuB');
    t.ok((await host.textContent('#gmCode')) === code, 'et chez l’hôte');
    await host.click('#gmResume');
    await guest.bringToFront();

    t.group('Réseau difficile');
    {
      await guest.bringToFront();
      const net = (p, o) => p.evaluate(o => Object.assign(FAKENET, o), o);
      const inPlay = () => host.evaluate(() => { closeAllCards(); G.pz = null; if (G.phase !== 'play') { G.phase = 'play'; G.menuShown = false; document.getElementById('overlay').classList.add('hidden'); const p = TEAMS[0][0]; G.off = 0; p.x = W / 2; p.y = H / 2; holdDisc(p); } });
      await inPlay();
      // 1. lenteur et irrégularité (120 ms ± 80 ms dans chaque sens)
      await net(host, { lag: 120, jitter: 80 }); await net(guest, { lag: 120, jitter: 80 });
      const smooth = await guest.evaluate(async () => {
        const fr = () => new Promise(r => requestAnimationFrame(r)); let worst = 0, n = 0, prev = players.map(p => [p.x, p.y]);
        const t0 = performance.now();
        while (performance.now() - t0 < 2500) { await fr(); const cur = players.map(p => [p.x, p.y]); worst = Math.max(worst, ...cur.map((c, i) => Math.hypot(c[0] - prev[i][0], c[1] - prev[i][1]))); prev = cur; n++; }
        return { worst: +worst.toFixed(2), n, wait: hostWaitMsg(), recv: +(G.time - lastRecv).toFixed(2) };
      });
      t.ok(smooth.worst < 0.6 && !smooth.wait, 'réseau lent et irrégulier : chez l’invité, les joueurs avancent sans sauts', smooth);
      await net(host, { lag: 0, jitter: 0 }); await net(guest, { lag: 0, jitter: 0 });

      // 2. wifi coupé 3 s : rien ne casse, pas de rafale de 3 s d'effets d'un coup au retour
      await inPlay();
      await guest.evaluate(() => { window.__fx = 0; const f = fxPlay; fxPlay = function () { window.__fx++; return f.apply(this, arguments); }; });
      await host.evaluate(() => { window.__fxi = setInterval(() => fxEvent('catch', 50, 18, 0), 100); });   // un effet toutes les 0,1 s chez l'hôte
      await net(guest, { down: true }); await guest.waitForTimeout(3000);
      await guest.evaluate(() => { window.__fx = 0; }); await net(guest, { down: false });
      await guest.waitForFunction(() => G.time - lastRecv < 0.3, null, { timeout: 5000 }).catch(() => { });
      await guest.waitForTimeout(250);
      const blip = await guest.evaluate(() => ({ fx: window.__fx, reconn: !!G.reconn, net: G.net, me: G.me, recv: +(G.time - lastRecv).toFixed(2) }));
      await host.evaluate(() => clearInterval(window.__fxi));
      t.ok(blip.net === 'guest' && !blip.reconn && blip.me === 1 && blip.recv < 0.5, 'wifi coupé 3 s : la partie reprend toute seule', blip);
      t.ok(blip.fx < 15, 'au retour, seuls les effets récents sont joués (pas 3 s d’effets d’un coup)', blip);

      // 3. wifi coupé 10 s (l'invité est l'héritier) : il ne crée pas sa propre partie, il se reconnecte et garde sa place
      await net(guest, { down: true }); await guest.waitForTimeout(9000);
      const mid = await guest.evaluate(() => ({ net: G.net, reconn: !!G.reconn, msg: hostWaitMsg() }));
      t.ok(mid.net === 'guest' && mid.reconn && /Reconnexion/.test(mid.msg), 'coupure longue : l’invité affiche « Reconnexion… » (et ne reprend pas la partie à son compte)', mid);
      await net(guest, { down: false });
      await guest.waitForFunction(() => G.net === 'guest' && hostConn && hostConn.open && !G.reconn && G.time - lastRecv < 0.5, null, { timeout: 10000 }).catch(() => { });
      const back = await Promise.all([guest.evaluate(() => ({ net: G.net, me: G.me, spec: G.spectator, id: G.myId, reconn: !!G.reconn })), host.evaluate(() => ({ hum: G.humans.map(h => [h.id, h.team]), conns: conns.size, msg: G.msg }))]);
      t.ok(back[0].net === 'guest' && !back[0].reconn && back[0].me === 1 && !back[0].spec, 'réseau revenu : l’invité est reconnecté et joue toujours les Rouges', back);
      t.ok(back[1].hum.length === 2 && back[1].hum.some(([id, tm]) => id === back[0].id && tm === 1) && back[1].conns === 1, 'chez l’hôte : même joueur, même équipe, une seule connexion', back);

      // 4. la liaison directe échoue (changement de réseau, wifi → 4G) : reconnexion tout de suite
      await guest.evaluate(() => FAKENET.fail());
      await guest.waitForFunction(() => G.net === 'guest' && hostConn && hostConn.open && !G.reconn && G.time - lastRecv < 0.5, null, { timeout: 8000 }).catch(() => { });
      const ice = await Promise.all([guest.evaluate(() => ({ net: G.net, me: G.me, reconn: !!G.reconn })), host.evaluate(() => G.humans.map(h => [h.id, h.team]))]);
      t.ok(ice[0].net === 'guest' && !ice[0].reconn && ice[0].me === 1 && ice[1].length === 2, 'liaison perdue (changement de réseau) : reconnexion automatique, même équipe', ice);

      // 5. le service de mise en relation se reconnecte (téléphone revenu sur l'appli) : rien ne change
      const before = await host.evaluate(() => ({ hum: G.humans.length, started: G.started }));
      await host.evaluate(() => { peer.disconnected = true; peer.reconnect(); }); await guest.evaluate(() => { peer.disconnected = true; peer.reconnect(); });
      await guest.waitForTimeout(600);
      const after = await Promise.all([host.evaluate(() => ({ hum: G.humans.length, started: G.started })), guest.evaluate(() => ({ me: G.me, spec: G.spectator }))]);
      t.ok(after[0].hum === before.hum && after[0].started && after[1].me === 1 && !after[1].spec, 'reconnexion au service : la salle n’est pas remise à zéro, l’invité ne rejoint pas une 2e fois', { before, after });

      // 6. page rechargée en pleine partie : on retrouve sa place
      const gid = await guest.evaluate(() => G.myId);
      await guest.reload(); await guest.waitForFunction(() => typeof G !== 'undefined' && G.net === 'guest' && G.myId > 0 && G.started, null, { timeout: 15000 }).catch(() => { });
      await guest.waitForTimeout(500);
      const rl = await Promise.all([guest.evaluate(() => ({ id: G.myId, me: G.me, spec: G.spectator })), host.evaluate(() => G.humans.map(h => [h.id, h.team]))]);
      t.ok(rl[0].id === gid && rl[0].me === 1 && !rl[0].spec && rl[1].length === 2, 'page rechargée : l’invité retrouve sa place chez les Rouges', { gid, rl });
      await guest.bringToFront();
      await guest.evaluate(() => { const o = document.getElementById('overlay'); if (o && !o.classList.contains('hidden') && G.phase === 'play') o.classList.add('hidden'); });
    }

    t.group('Départ de l’invité');
    await guest.click('#menuB'); await guest.click('#gmQuit');
    if (await guest.isVisible('#askBox')) await guest.click('#askYes');
    t.ok(await guest.isVisible('#lobbyOnline'), 'l’invité quitte et retrouve la section En ligne');
    await host.waitForFunction(() => G.humans.length === 1, null, { timeout: 15000 });
    t.ok(await guest.isVisible('#rejoinB') && (await guest.textContent('#rejoinTxt')).includes(code), 'bouton pour revenir dans la partie quittée');
    await guest.click('#rejoinB');
    await host.waitForFunction(() => G.humans.length === 2, null, { timeout: 10000 }).catch(() => {});
    t.ok(await host.evaluate(() => G.humans.length === 2), 'il revient dans la partie');
    await guest.evaluate(() => netError(''));
    await host.waitForFunction(() => G.humans.length === 1, null, { timeout: 15000 });
    t.ok(await host.evaluate(() => G.net === 'host' && (G.phase === 'play' || G.phase === 'between' || G.phase === 'pull' || G.phase === 'over')), 'la partie continue chez l’hôte');
    await ctx.close();

    t.group('Mode infini à plusieurs');
    const cx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
    await cx.addInitScript(shim);
    const h2 = await cx.newPage(), g2 = await cx.newPage();
    for (const [n, p] of [['hôte coop', h2], ['invité coop', g2]]) p.on('pageerror', e => errs.push(n + ' : ' + e.message));
    await h2.goto(srv.url + 'index.html'); await ready(h2);
    await h2.fill('#pname', 'Théo');
    await h2.click('#onlineMenuB');
    t.ok(await h2.isVisible('#coopB') && await h2.isVisible('#hostB') && await h2.isVisible('#joinB'), 'section En ligne : mode infini à plusieurs, créer, rejoindre');
    await h2.click('#coopB');
    t.ok(await h2.isVisible('#endlessCard') && (await h2.textContent('#endTitle')).includes('plusieurs'), 'accueil du mode à plusieurs, avec son classement');
    await h2.click('#endGo');
    await h2.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.getElementById('hostCode').textContent));
    const code2 = await h2.textContent('#hostCode');
    await g2.goto(srv.url + 'index.html'); await ready(g2);
    await g2.fill('#pname', 'Léa');
    await g2.goto('about:blank'); await g2.goto(srv.url + 'index.html#join=' + code2);
    await h2.waitForFunction(() => G.humans.length === 2, null, { timeout: 10000 });
    await g2.waitForFunction(() => G.coopRoom === true, null, { timeout: 5000 });
    t.ok(!(await g2.isVisible('#teamB1')) && await g2.isVisible('#coopNote'), 'chez l’invité : on ne peut rejoindre que les Bleus');
    await g2.click('#teamB0');
    await h2.waitForFunction(() => G.humans.every(h => h.team === 0), null, { timeout: 5000 });
    await h2.click('#startOnline');
    await g2.waitForFunction(() => document.getElementById('stratCard').style.display !== 'none' && /Match 1/.test(document.getElementById('ovTitle').textContent), null, { timeout: 5000 });
    t.ok((await g2.textContent('#ovTitle')).includes('Écureuils'), 'l’invité voit le 1er adversaire de la série', await g2.textContent('#ovTitle'));
    await h2.evaluate(() => setOpt('off', 'ho'));
    await g2.waitForFunction(() => /Horizontal/.test(document.getElementById('captainNote').textContent), null, { timeout: 3000 }).catch(() => {});
    t.ok(!(await g2.isVisible('#stratRows')) && (await g2.textContent('#captainNote')).includes('Horizontal stack'), 'le coéquipier voit la stratégie choisie par son capitaine, en direct', await g2.textContent('#captainNote'));
    await h2.evaluate(() => { const f = cleanSystem(Object.assign(SYS_NEW.off(), { id: 'frm123', name: 'Forme du cap' })); const s = cleanSystem({ kind: 'play', id: 'cap123', name: 'Plan du cap', base: 'sys:frm123', steps: [{ p: 0, to: [8, 6], wait: 0.3 }] }); sysSave([f, s]); G.form.p1sys = s.id; setOpt('play1', 'sys'); });
    await g2.waitForFunction(() => playOf(0, 1) === 'sys' && playSys(0, 1) && playSys(0, 1).name === 'Plan du cap', null, { timeout: 3000 }).catch(() => {});
    t.ok(await g2.evaluate(() => !sysList().some(x => x.id === 'cap123') && playSys(0, 1) && playSys(0, 1).name === 'Plan du cap' && playSys(0, 1).pos.length === 4),
      'le coéquipier peut appeler le play perso du capitaine, même sans l’avoir dans ses systèmes');
    t.ok(await h2.evaluate(() => G.series && G.series.coop && G.form.first === '0' && G.form.allyLevel === 'difficile' && aiLvl(1).react === AI_LEVELS.facile.react),
      'chez l’hôte : série lancée, l’IA pulle, coéquipiers IA difficiles, adversaire au niveau du 1er match');
    const finish = (a, b) => h2.evaluate(([a, b]) => { G.score = [a, b]; G.phase = 'over'; onMatchOver(); showMenu('over'); }, [a, b]);
    await finish(2, 1);
    await g2.waitForFunction(() => G.series && G.series.wins === 1, null, { timeout: 5000 });
    t.ok(/1 match gagné/.test(await g2.textContent('#ovText')), 'match gagné : l’invité voit la série avancer', await g2.textContent('#ovText'));
    await h2.click('#go');
    await g2.waitForFunction(() => /Match 2/.test(document.getElementById('ovTitle').textContent), null, { timeout: 5000 });
    t.ok(true, 'le capitaine enchaîne : match 2 pour tout le monde');
    await finish(0, 2);
    await h2.click('#go');
    await g2.waitForFunction(() => document.getElementById('endlessCard').style.display !== 'none', null, { timeout: 5000 });
    t.ok(!(await g2.isVisible('#endGo')) && (await g2.textContent('#endText')).includes('1 match gagné'), 'défaite : fin de série chez l’invité');
    t.ok(await h2.isVisible('#endSave') && (await h2.inputValue('#endSaveName')) === 'Théo + Léa', 'chez l’hôte : enregistrer l’équipe, nom proposé', await h2.inputValue('#endSaveName'));
    await h2.click('#endSaveB');
    await h2.waitForFunction(() => /classement/.test(document.getElementById('endStatus').textContent), null, { timeout: 5000 }).catch(() => {});
    t.ok(srv.coop('SELECT name, wins FROM scores').some(r => r.name === 'Théo + Léa' && r.wins === 1) && !srv.board('SELECT name FROM scores').some(r => r.name === 'Théo + Léa'),
      'score de l’équipe dans le classement à plusieurs (pas dans le solo)', await h2.textContent('#endStatus'));
    await h2.click('#endBack');
    await g2.waitForFunction(() => document.getElementById('lobbyRoom').style.display !== 'none', null, { timeout: 5000 });
    t.ok(await h2.isVisible('#startOnline'), 'retour à la salle, avec les mêmes joueurs');
    await cx.close();
    t.group('Changement d’hôte en mode infini à plusieurs');
    {
      const cx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
      await cx.addInitScript(shim);
      const h4 = await cx.newPage(), a4 = await cx.newPage(), b4 = await cx.newPage();
      for (const [n, p] of [['hôte 4', h4], ['invité A4', a4], ['invité B4', b4]]) p.on('pageerror', e => errs.push(n + ' : ' + e.message));
      const ready4 = p => p.waitForFunction(() => typeof G !== 'undefined' && G.attract);
      await h4.goto(srv.url + 'index.html'); await ready4(h4);
      await h4.click('#onlineMenuB'); await h4.click('#coopB'); await h4.click('#endGo');
      await h4.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.getElementById('hostCode').textContent));
      const code4 = await h4.textContent('#hostCode');
      for (const p of [a4, b4]) { await p.goto(srv.url + 'index.html#join=' + code4); await p.waitForFunction(() => G.net === 'guest' && G.myId > 0 && G.coopRoom, null, { timeout: 10000 }); await p.click('#teamB0'); }
      await h4.waitForFunction(() => G.humans.length === 3 && G.humans.every(h => h.team === 0), null, { timeout: 8000 });
      await h4.click('#startOnline');
      await a4.waitForFunction(() => document.getElementById('stratCard').style.display !== 'none' && G.series && G.series.coop, null, { timeout: 5000 });
      await h4.click('#go');
      await h4.waitForFunction(() => G.phase === 'play', null, { timeout: 30000 });
      await a4.waitForFunction(() => Array.isArray(G.heir) && G.heir[0] === G.myId, null, { timeout: 5000 });
      await h4.evaluate(() => { for (const c of conns.values()) c.close(); });
      await h4.close();
      await a4.waitForFunction(() => G.net === 'host', null, { timeout: 8000 });
      await b4.waitForFunction(() => G.net === 'guest' && hostConn && hostConn.open, null, { timeout: 15000 });
      const s4 = await a4.evaluate(() => ({ coop: !!(G.series && G.series.coop), lvl: !!(G.series && G.series.opp && typeof G.series.opp.level === 'function'), cur: G.series && G.series.cur, room: G.coopRoom, cap: captain(0) && captain(0).id === G.myId }));
      t.ok(s4.coop && s4.lvl && s4.cur === 0 && s4.room && s4.cap, 'le nouvel hôte reprend la série (adversaire, niveau) et devient capitaine', s4);
      await b4.waitForTimeout(1000);
      t.ok(await b4.evaluate(() => G.time - lastRecv < 1 && G.me === 0), 'l’autre invité continue la série avec lui');
      await cx.close();
    }

    t.group('Changement d’hôte');
    {
      const cx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
      await cx.addInitScript(shim);
      const h3 = await cx.newPage(), a3 = await cx.newPage(), b3 = await cx.newPage();
      for (const [n, p] of [['hôte 3', h3], ['invité A', a3], ['invité B', b3]]) p.on('pageerror', e => errs.push(n + ' : ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
      const ready = p => p.waitForFunction(() => typeof G !== 'undefined' && G.attract);
      await h3.goto(srv.url + 'index.html'); await ready(h3);
      await h3.click('#onlineMenuB'); await h3.click('#hostB');
      await h3.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.getElementById('hostCode').textContent));
      const code3 = await h3.textContent('#hostCode');
      for (const p of [a3, b3]) { await p.goto(srv.url + 'index.html#join=' + code3); await p.waitForFunction(() => G.net === 'guest' && G.myId > 0, null, { timeout: 10000 }); }
      await h3.waitForFunction(() => G.humans.length === 3, null, { timeout: 10000 });
      await b3.click('#teamB1');
      await h3.waitForFunction(() => G.humans.some(h => h.team === 1), null, { timeout: 5000 });
      await h3.evaluate(() => { G.form.puller = 'ai'; });
      await h3.click('#startOnline');
      await h3.waitForFunction(() => document.getElementById('stratCard').style.display !== 'none', null, { timeout: 5000 });
      await b3.waitForFunction(() => document.getElementById('stratCard').style.display !== 'none', null, { timeout: 5000 });
      await b3.evaluate(() => { G.form.puller = 'ai'; });
      await h3.click('#go'); await b3.click('#go');
      await h3.waitForFunction(() => G.phase === 'play', null, { timeout: 30000 });
      await a3.waitForFunction(() => Array.isArray(G.heir), null, { timeout: 5000 });
      const heir = await a3.evaluate(() => [G.heir[0], G.myId]);
      t.ok(heir[0] === heir[1], 'l’héritier annoncé est le premier invité arrivé', heir);
      const score0 = await h3.evaluate(() => G.score.slice());
      await h3.evaluate(() => { for (const c of conns.values()) c.close(); });   // l'hôte s'en va
      await h3.close();
      await a3.waitForFunction(() => G.net === 'host', null, { timeout: 8000 });
      t.ok(true, 'l’invité A reprend la partie');
      await b3.waitForFunction(() => G.net === 'guest' && hostConn && hostConn.open && G.time - lastRecv < 1, null, { timeout: 15000 });
      t.ok(true, 'l’invité B se reconnecte au nouvel hôte');
      const st = await a3.evaluate(() => ({ hum: G.humans.map(h => [h.id, h.team]), phase: G.phase, score: G.score, conns: conns.size }));
      t.ok(!st.hum.some(([id]) => id === 0) && st.hum.some(([id, team]) => team === 1) && st.conns === 1, 'l’ancien hôte n’est plus dans la partie, l’invité B garde sa place (Rouges)', st);
      t.ok(JSON.stringify(st.score) === JSON.stringify(score0) && ['play', 'between', 'pull'].includes(st.phase), 'même score, la partie continue', { st, score0 });
      const m0 = await b3.evaluate(() => players.map(p => p.x).join());
      await b3.waitForTimeout(1200);
      t.ok((await b3.evaluate(() => players.map(p => p.x).join())) !== m0 || await a3.evaluate(() => G.phase !== 'play'), 'l’invité B reçoit à nouveau le jeu en direct');
      t.ok(await b3.evaluate(() => G.me === 1 && !G.spectator), 'l’invité B joue toujours les Rouges');
      await cx.close();
    }
  } finally {
    await browser.close(); await srv.close();
  }
  t.group('Erreurs JavaScript');
  t.ok(errs.length === 0, 'aucune erreur dans les pages', errs.slice(0, 5));
}
