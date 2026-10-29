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
    const tiles = await p.evaluate(() => ({ n: document.querySelectorAll('.stile:not(.wx)').length, all: Object.values(STYLES).flat().length, locked: document.querySelectorAll('.stile.locked').length }));
    t.ok(tiles.n === tiles.all && tiles.locked > 5, 'tous les visuels sont listés, la plupart verrouillés au départ', tiles);
    await p.click('.stile[data-cat=disc][data-id=flamme]');
    t.ok(await p.evaluate(() => styleGet().disc === 'blanc' && /Roi des airs/.test(document.getElementById('toast').textContent)), 'un visuel verrouillé ne se choisit pas : on dit quel succès le débloque');
    await p.click('.stile[data-cat=disc][data-id=arcenciel]');
    t.ok(await p.evaluate(() => styleGet().disc === 'arcenciel' && document.querySelector('.stile[data-id=arcenciel]').classList.contains('on')), 'un visuel débloqué (succès « Par-dessus ») se choisit et reste choisi');
    await p.reload(); await p.waitForFunction(() => typeof G !== 'undefined' && G.attract);
    t.ok(await p.evaluate(() => styleOf('disc') === 'arcenciel'), 'le choix est gardé (navigateur, et compte s’il y en a un)');
    await p.evaluate(() => storeSet('uf-ach', {}));
    t.ok(await p.evaluate(() => styleOf('disc') === 'blanc'), 'succès effacés : on revient au style de base');

    await p.evaluate(() => storeSet('uf-acc', { name: 'Admin', token: 'x', admin: true }));
    t.ok(await p.evaluate(() => Object.values(STYLES).flat().every(styleUnlocked) && styleOf('disc') === 'arcenciel'), 'compte admin : tous les visuels sont débloqués');
    await p.evaluate(() => { try { localStorage.removeItem('uf-acc'); } catch (e) { } });

    t.group('Mon style : le temps, dans le dossier de chaque terrain');
    await p.evaluate(() => { const a = {}; ACH.forEach(x => a[x.id] = 1); delete a.wins10; storeSet('uf-ach', a); showStyle(); });
    await p.click('.stile[data-cat=field][data-id=plage]');
    const fo = await p.evaluate(() => ({ field: styleGet().field, folder: (document.querySelector('.sfolder') || {}).dataset?.field, n: document.querySelectorAll('.sfolder .stile').length, want: FIELD_WX.plage.length,
      nightLocked: document.querySelector('.sfolder .stile[data-id=nuit]').classList.contains('locked') }));
    t.ok(fo.field === 'plage' && fo.folder === 'plage' && fo.n === fo.want, 'choisir un terrain ouvre son dossier, avec ses temps', fo);
    await p.click('.sfolder .stile[data-id=nuit]');
    t.ok(await p.evaluate(() => weatherOf('plage') === 'jour' && /Habitué/.test(document.getElementById('toast').textContent)), 'un temps verrouillé ne se choisit pas : on dit quel succès le débloque');
    await p.click('.sfolder .stile[data-id=coucher]');
    const wx = await p.evaluate(() => ({ plage: weatherOf('plage'), gazon: weatherOf('gazon'), on: document.querySelector('.sfolder .stile[data-id=coucher]').classList.contains('on'), salle: document.querySelectorAll('.stile[data-id=salle] .sfold').length }));
    t.ok(wx.plage === 'coucher' && wx.gazon === 'jour' && wx.on, 'le temps est gardé pour ce terrain seulement', wx);
    t.ok(wx.salle === 0, 'la salle n’a pas de météo (pas de dossier)', wx);
    await p.evaluate(() => { const s = styleGet(); s.field = 'salle'; s.wx = { salle: 'pluie' }; styleSet(s); });
    t.ok(await p.evaluate(() => weatherOf() === 'jour'), 'un temps impossible pour ce terrain revient au temps normal');
    await p.evaluate(() => { closeAllCards(); showLobby(); });

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
      for (const [f, ws] of Object.entries(FIELD_WX)) for (const w of ws) { styleSet({ field: f, wx: { [f]: w } }); await wait(); if (weatherOf() === w) out.push(f + '/' + w); }
      return { out, snowDisc: (styleSet({ disc: 'blanc', field: 'neige' }), discSkin()) };
    });
    const nWx = await p.evaluate(() => Object.values(FIELD_WX).flat().length);
    t.ok(drawn.out.length === 20 + nWx, 'chaque combinaison est dessinée (vue de dessus et inclinée), et chaque temps de chaque terrain', drawn.out.length);
    t.ok(drawn.snowDisc === 'orange', 'lisibilité : sur la neige, le disque blanc devient orange', drawn.snowDisc);

    t.group('Appel de cut sur un coéquipier (dans un vrai navigateur)');
    const pkb = await p.evaluate(async () => {
      G.phase = 'play'; G.off = G.me; G.pickup = null; const h = TEAMS[G.me][0]; holdDisc(h); h.think = 99;
      const q = TEAMS[G.me][3]; doCall(q.x, q.y);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const on = myPick() === q; doCall(q.x, q.y); return { on, off: !myPick() };
    });
    t.ok(pkb.on && pkb.off, 'clic droit / tap sur un coéquipier : il est désigné (anneau doré), un 2e appel l’annule', pkb);

    t.group('Écran de fin : panneau du score, moment du match, équipes, joueurs en ligne');
    const sm = await p.evaluate(() => {
      newMatchStats(); G.score = [5, 3]; G.ms.points = [[0, 30], [1, 20]]; G.ms.team[0].thr = 10; G.ms.team[0].comp = 9;
      const R = { frames: [], team: 0 }; REPLAY.mom = R;
      G.ms.mom = { s: 1000, k: 'callahan', t: 0, sc: [4, 3], txt: 'Callahan de Théo' };
      renderSummary(matchSummary()); const el = document.getElementById('summary');
      const one = { led: el.querySelectorAll('.sumBoard .led').length, mom: /Callahan de Théo/.test(el.textContent), rows: el.querySelectorAll('.cmp').length, ai: el.querySelectorAll('.sumP').length, players: el.querySelectorAll('.huCard').length, replay: !!document.getElementById('momReplayB') };
      G.ms.hu = { 0: { n: 'Théo', t: 0, thr: 3, comp: 2, ast: 1, gol: 0, blk: 0, lay: 0, to: 1 }, 3: { n: 'Max', t: 1, thr: 1, comp: 1, ast: 0, gol: 1, blk: 1, lay: 1, to: 0 } };
      renderSummary(matchSummary()); one.players2 = el.querySelectorAll('.huCard').length; one.txt = el.querySelector('.huCard').textContent.replace(/\s+/g, ' ');
      renderSummary(null); REPLAY.mom = null; return one;
    });
    t.ok(sm.led === 2 && sm.mom && sm.rows >= 6 && sm.ai === 0, 'le score en points lumineux, le moment du match, les équipes comparées, sans stats par joueur IA', sm);
    t.ok(sm.replay, 'en solo : le moment du match se revoit au ralenti', sm);
    t.ok(sm.players === 0 && sm.players2 === 2 && /Théo/.test(sm.txt) && /1assist0point/.test(sm.txt), 'en ligne (plusieurs humains) : une carte par joueur humain', sm);

    t.group('Habillage : caméra qui suit le jeu, police');
    const cam = await p.evaluate(async () => {
      const fr = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      CTRL.view = 'top'; resize(); CTRL.cam = 'suivi'; G.phase = 'play'; await fr(90);
      const z = CAM.z, rect = canvas.getBoundingClientRect(), pt = { x: 61.3, y: 12.7 };
      const w = toWorld({ clientX: rect.left + X(pt.x), clientY: rect.top + Y(pt.y) });
      CTRL.cam = 'fixe'; await fr(150);
      return { z: +z.toFixed(2), back: +CAM.z.toFixed(3), err: +Math.hypot(w.x - pt.x, w.y - pt.y).toFixed(3), font: document.fonts ? document.fonts.check("800 20px 'Barlow Condensed'") : true };
    });
    t.ok(cam.z > 1.1 && cam.err < 0.01, 'caméra « suit le jeu » : elle zoome, et la visée tombe toujours au bon endroit', cam);
    t.ok(cam.back === 1, 'caméra fixe : tout le terrain revient', cam);
    t.ok(cam.font, 'la police des titres est chargée (embarquée, marche hors ligne)', cam);

    t.group('Son : musique dans les menus, public en match');
    const au = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      FX.muted = false; audioCtx(); CTRL.music = 'menus'; CTRL.vol.crowd = 100;
      await wait(1200); const match = { playing: AU.playing, murmur: !!(AU.bus && AU.bus.crowd) || typeof crowdStart === 'function' };       // (on est en match ici)
      goMainMenu && showLobby(); await wait(1500); const menu = { playing: AU.playing, step: AU.step };
      CTRL.music = 'off'; await wait(2500); const off = { playing: AU.playing };
      CTRL.music = 'menus'; toggleMute(); await wait(300); const muted = { playing: AU.playing }; toggleMute();
      return { match, menu, off, muted, ctx: !!FX.ctx };
    });
    t.ok(!au.ctx || (au.menu.playing && au.menu.step > 0), 'dans les menus, la musique joue', au);
    t.ok(!au.ctx || (!au.match.playing && !au.match.murmur), 'en match (réglage « Menus ») : pas de musique, et pas de murmure de fond', au);
    t.ok(!au.ctx || (!au.off.playing && !au.muted.playing), 'musique coupée dans Commandes, ou bouton 🔊 : silence', au);
    const smp = await p.evaluate(async () => {
      for (let k = 0; k < 50 && !Object.values(SAMPLES).every(Boolean); k++) await new Promise(r => setTimeout(r, 100));
      if (!FX.ctx) return { ctx: false };
      const r = { ctx: true, loaded: Object.keys(SAMPLES).filter(k => SAMPLES[k]), app: SAMPLES.cheer && +SAMPLES.cheer.duration.toFixed(1), ooh: SAMPLES.ooh && +SAMPLES.ooh.duration.toFixed(1) };
      r.plays = crowdSample('cheer', { vol: 0.5 }) && crowdSample('ooh', { vol: 0.5 }) && sfxSample('whistle', { vol: 0.3 });
      CTRL.vol.crowd = 0; r.offSilent = !crowdSample('ooh'); r.sfxStill = sfxSample('catch'); CTRL.vol.crowd = 100;
      ['score', 'block', 'layout', 'turn', 'throw', 'catch', 'stall'].forEach(n => fxPlay(n, 0, 0, G.me));
      return r;
    });
    t.ok(!smp.ctx || (smp.loaded.length === 7 && smp.app > 6 && smp.ooh > 1.5 && smp.plays), 'les 7 enregistrements sont chargés (public, sifflet, réception, lancer) et joués', smp);
    t.ok(!smp.ctx || (smp.offSilent && smp.sfxStill), 'volume du public à 0 : plus de public, mais les bruits du jeu restent', smp);

    t.group('Son : volumes');
    const vo = await p.evaluate(async () => {
      FX.muted = false; audioCtx(); CTRL.music = 'tout';
      closeAllCards(); openCard('ctrlCard'); renderCtrl();
      const set = (k, v) => { const el = document.querySelector('.vol[data-k=' + k + ']'); el.value = v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); };
      set('fx', 40); set('music', 0); set('crowd', 25);
      await new Promise(r => setTimeout(r, 1500));
      const B = AU.bus, saved = JSON.parse(localStorage.getItem('uf-ctrl')).vol;
      const r = { saved, sfx: B && +B.sfx.gain.value.toFixed(2), music: B && +B.music.gain.value.toFixed(3), cfx: B && +B.crowdFx.gain.value.toFixed(2), label: document.getElementById('volv-music').textContent, ctx: !!FX.ctx };
      set('fx', 100); set('music', 100); set('crowd', 100); CTRL.music = 'menus'; closeAllCards();
      return r;
    });
    t.ok(vo.saved.fx === 40 && vo.saved.music === 0 && vo.saved.crowd === 25 && vo.label === 'Coupé', 'trois curseurs de volume dans Commandes, gardés dans le navigateur', vo);
    t.ok(!vo.ctx || (vo.sfx === 0.4 && vo.music === 0 && vo.cfx === 0.25), 'les volumes s’appliquent (effets, musique, réactions du public)', vo);

    t.ok(!errs.length, 'aucune erreur', errs);
  } finally { await browser.close(); await srv.close(); }
}
