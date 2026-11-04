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
    const pt2 = await p.evaluate(async () => {
      const fr = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      G.phase = 'play'; G.off = G.me; G.checkT = 0; const h = TEAMS[G.me][0]; holdDisc(h); h.think = 99;
      const early = canThrow(); await new Promise(r => setTimeout(r, 850)); const later = canThrow();   // un instant après la réception
      const q = TEAMS[G.me][2]; disc.intended = null; let sp = { x: 50, y: 18 }, bd = 0;
      TEAMS[G.me].forEach((o, i) => { if (o !== h) { o.x = 30 + i * 9; o.y = 30; o.vx = o.vy = 0; } }); sp = { x: 60, y: 6 };   // coéquipiers bien séparés, endroit libre
      doCall(q.x, q.y); doCall(sp.x, sp.y);                                                   // désigné, puis l'endroit voulu
      const arrowFor = !!q.callTo && Math.abs(q.callTo[0] - sp.x) < 1.5;
      const piv0 = G.pivSel; window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' })); await fr(3);
      return { early, later, arrowFor, pivFlip: G.pivSel !== piv0 };
    });
    t.ok(!pt2.early && pt2.later, 'juste après la réception, on ne peut pas encore relancer (un instant de stabilisation)', pt2);
    t.ok(pt2.arrowFor, 'coéquipier désigné puis endroit : il y part, avec une flèche jusqu’à l’endroit voulu', pt2);
    t.ok(pt2.pivFlip, 'avec le disque, Espace change de pied de pivot', pt2);
    // juste après une réception, pas de lancer (même délai pour tout le monde) ; un instant après, un clic lance
    const spot = await p.evaluate(() => {
      G.phase = 'play'; G.off = G.me; G.checkT = 0; G.oplay = null; const h = TEAMS[G.me][0]; h.x = 40; h.y = 18; h.vx = h.vy = 0; holdDisc(h); h.think = 99;
      TEAMS[1 - G.me].forEach((d, i) => { d.x = 90; d.y = 4 + i * 7; });
      const early = !canThrow(); doThrow(60, 18, 0);                                              // tout de suite : refusé
      const r = canvas.getBoundingClientRect(); return { x: r.left + X(55), y: r.top + Y(18), early, mode: disc.mode };
    });
    await p.waitForFunction(() => G.time - G.recvAt > RECV_T + 0.05, null, { timeout: 8000 });   // (temps de jeu)
    await p.mouse.move(spot.x, spot.y); await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(100);
    const hc = await p.evaluate(() => disc.mode);
    t.ok(spot.early && spot.mode === 'held' && hc === 'air', 'juste après une réception, pas de lancer ; un instant après, le clic lance', { spot, hc });
    const la = await p.evaluate(async () => {
      G.phase = 'play'; G.off = G.me; G.checkT = 0; G.oplay = null; G.wind = { x: 0, y: 0, kmh: 0 };
      const h = TEAMS[G.me][0]; h.x = 40; h.y = 18; h.vx = h.vy = 0; holdDisc(h); h.think = 99; G.recvAt = -9;
      const mx = h.x + dirOf(G.me) * 20, my = 18; setCurve(0.8); doThrow(mx, my, G.curve);
      const want = launchAim(h, mx, my, 0.8);
      return { mode: disc.mode, rx: +disc.rx.toFixed(1), ry: +disc.ry.toFixed(1), want: want.map(v => +v.toFixed(1)), off: +Math.abs(disc.ry - 18).toFixed(1) };
    });
    t.ok(la.mode === 'air' && Math.abs(la.rx - la.want[0]) < 0.2 && Math.abs(la.ry - la.want[1]) < 0.2 && la.off > 5, 'ta passe courbée part vers la souris et arrive où la courbe l’emmène (comme l’aperçu)', la);
    const ez = await p.evaluate(() => {
      G.phase = 'play'; G.off = G.me; G.checkT = 0; G.receiving = G.me; G.oplay = null;
      const c = TEAMS[G.me][1]; c.x = goalLine(G.me) - dirOf(G.me) * 6; c.y = 12; c.vx = c.vy = 0; c.think = 99;
      disc.pull = true; disc.mode = 'air'; G.offside = null; pullCaught(c);                       // pull attrapé au fond de ton en-but
      const r = { pull: disc.mode, x: +disc.x.toFixed(1), cx: +c.x.toFixed(1) };
      turnover(goalLine(1 - G.off) - dirOf(1 - G.off) * 6, 12, 'test');                           // disque au sol dans un en-but
      r.ground = !!G.carryTo && G.carryTo.x === goalLine(G.off); return r;
    });
    t.ok(ez.pull === 'held' && ez.x === ez.cx && ez.ground, 'pull attrapé dans son en-but : on joue de là ; disque ramassé dans un en-but : ramené à la ligne', ez);
    const rp = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      G.phase = 'play'; G.paused = false; await wait(700); const n0 = DBG.frames.length, t0 = DBG.frames.length ? DBG.frames[DBG.frames.length - 1].t : 0;
      openCard('gameMenuCard'); const snapT = DBG.snap.frames.length ? DBG.snap.frames[DBG.snap.frames.length - 1].t : 0;
      G.paused = false; await wait(800);                          // (en ligne, le jeu continue pendant qu'on écrit)
      const r = reportNow(); closeAllCards();
      return { grew: n0 > 0 && t0 > 0, sameFrames: r.frames.length && r.frames[r.frames.length - 1].t === snapT, sentAfter: r.sentAfter, noMenu: r.frames.every(f => f.ph === 'play' || f.ph === 'pull') };
    });
    t.ok(rp.grew && rp.sameFrames && rp.noMenu, 'signalement : les 10 dernières secondes de jeu avant d’ouvrir le menu (pas le temps passé à écrire, ni les menus)', rp);
    const cv = await p.evaluate(async () => {
      const fr = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      G.phase = 'play'; G.off = G.me; G.checkT = 0; const h = TEAMS[G.me][0]; holdDisc(h); h.think = 99; await new Promise(r => setTimeout(r, 850));
      setCurve(0.6); await fr(3); const before = G.curve;
      throwDisc(h, h.x + dirOf(G.me) * 10, h.y, G.curve, 1, 0.3); await fr(3);              // ta passe part : la courbe repart de zéro
      return { before, after: G.curve };
    });
    t.ok(cv.before > 0.5 && cv.after === 0, 'après ta passe, la courbe revient à zéro pour la suivante', cv);

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
      CTRL.view = 'top'; resize(); CTRL.cam = 'suivi'; G.phase = 'play'; G.paused = true;   // joueurs groupés (et figés) : la caméra zoome
      holdDisc(TEAMS[G.me][0]); players.forEach((q, i) => { q.x = 50 + (i % 4) * 2; q.y = 16 + (i % 3) * 2; q.vx = q.vy = 0; }); disc.x = 50; disc.y = 16;
      await fr(90); G.paused = false;
      const z = CAM.z, rect = canvas.getBoundingClientRect(), pt = { x: 61.3, y: 12.7 };
      const w = toWorld({ clientX: rect.left + X(pt.x), clientY: rect.top + Y(pt.y) });
      CTRL.cam = 'fixe'; for (let k = 0; k < 40 && CAM.z !== 1; k++) await new Promise(r => setTimeout(r, 100));   // (en temps réel : le rythme des images varie)
      return { z: +z.toFixed(2), back: +CAM.z.toFixed(3), err: +Math.hypot(w.x - pt.x, w.y - pt.y).toFixed(3), font: document.fonts ? document.fonts.check("800 20px 'Barlow Condensed'") : true };
    });
    t.ok(cam.z > 1.1 && cam.err < 0.01, 'caméra « suit le jeu » : elle zoome, et la visée tombe toujours au bon endroit', cam);
    t.ok(cam.back === 1, 'caméra fixe : tout le terrain revient', cam);
    const cf = await p.evaluate(async () => {
      const fr = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      CTRL.cam = 'suivi'; const cw = canvas.width / dpr, ch = canvas.height / dpr;
      const keep = players.map(q => [q.x, q.y]);
      players.forEach((q, i) => { q.x = i < 5 ? 18 : 82; q.y = 4 + (i % 5) * 7; });     // au pull : chaque équipe sur sa ligne
      const pull = +camTarget(cw, ch).z.toFixed(2);
      players.forEach((q, i) => { q.x = 50 + (i % 3); q.y = 18 + (i % 4); });            // tout le monde groupé : on zoome
      const tight = +camTarget(cw, ch).z.toFixed(2);
      G.paused = true; let maxStep = 0, last = CAM.z;                                       // le zoom change en douceur
      for (let k = 0; k < 40; k++) { camFrame(1 / 60); maxStep = Math.max(maxStep, Math.abs(CAM.z - last)); last = CAM.z; }
      const ph = G.phase; G.phase = 'over'; for (let k = 0; k < 240; k++) camFrame(1 / 60); const over = +CAM.z.toFixed(3); G.phase = ph;   // fin de match : tout le terrain
      players.forEach((q, i) => { [q.x, q.y] = keep[i]; }); G.paused = false; CTRL.cam = 'fixe'; await fr(150);
      return { pull, tight, maxStep: +maxStep.toFixed(3), over };
    });
    t.ok(cf.pull < 1.15 && cf.tight > 1.4, 'le cadre contient tous les joueurs : au pull presque tout le terrain, groupés on zoome', cf);
    t.ok(cf.over === 1, 'fin de match (la ronde et ses boutons) : la caméra revient sur tout le terrain', cf);
    t.ok(cf.maxStep < 0.03, 'le zoom accélère et freine en douceur (pas de saut d’une image à l’autre)', cf);
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

    t.group('Match rapide : stratégie de l’adversaire');
    const op = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      goMainMenu(); await wait(200);
      document.getElementById('soloMenuB').click(); document.getElementById('soloB').click(); await wait(200);
      const r = { tabs: document.getElementById('watchTabs').offsetParent !== null, auto: cfg(1) === G.ai };
      document.querySelector('.wtab[data-t="1"]').click(); await wait(50);
      r.shows = G.form.off === G.ai.off && document.getElementById('oppAuto').textContent.includes('IA');
      const other = ['vert', 'ho', 'side'].find(x => x !== G.ai.off); const sel = document.getElementById('selOff'); sel.value = other; sel.dispatchEvent(new Event('change'));
      r.custom = cfg(1).off === other && cfg(1) !== G.ai && cfg(0).off !== undefined && !G.spectator;
      document.getElementById('oppAuto').click(); await wait(50);
      r.back = cfg(1) === G.ai; document.querySelector('.wtab[data-t="0"]').click();
      return r;
    });
    t.ok(op.tabs && op.auto && op.shows, 'en jouant aussi : onglet de l’adversaire, sa stratégie choisie par l’IA par défaut', op);
    t.ok(op.custom && op.back, 'tu peux la changer (il joue tes choix), et « L’IA choisit » revient comme avant', op);
    t.group('Mode spectateur : l’IA contre l’IA, tu règles les deux équipes');
    const wt = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      goMainMenu(); await wait(200);
      document.getElementById('soloMenuB').click(); document.getElementById('soloB').click(); await wait(200);
      const mine = G.form.off === 'side' ? 'vert' : 'side'; setOpt('off', mine);
      setOpt('watch', 'oui'); await wait(50);
      const r = { spec: G.spectator, tabs: document.getElementById('watchTabs').offsetParent !== null, rows: document.getElementById('stratRows').offsetParent !== null };
      document.querySelector('.wtab[data-t="1"]').click(); await wait(50);
      const sel = document.getElementById('selOff'); sel.value = 'ho'; sel.dispatchEvent(new Event('change'));
      r.blue = cfg(0).off === mine; r.red = cfg(1).off === 'ho'; r.saved = (storeGet('uf-settings', {}) || {}).off === mine;
      G.tossed = true; G.form.first = '0'; document.getElementById('go').click();
      for (let k = 0; k < 400 && G.phase !== 'play'; k++) await wait(50);
      await wait(1500);
      r.play = G.phase === 'play'; r.noHuman = !canThrow() && !TEAMS[0].concat(TEAMS[1]).some(q => controllerOf(q)); r.forms = [formOf(0), formOf(1)];
      const fr = () => new Promise(q => requestAnimationFrame(q)), per = async () => { let a = G.gt, n = 0; for (let k = 0; k < 30; k++) { await fr(); n++; } return (G.gt - a) / n; };   // temps de jeu par image
      const k1 = await per(); G.form.wspeed = '4'; const k4 = await per(); G.form.wspeed = '1';
      r.speedUp = { k1: +k1.toFixed(4), k4: +k4.toFixed(4) };
      leaveToMenu(); await wait(100);
      r.after = { watch: G.form.watch, off: G.form.off, spec: G.spectator };
      return r;
    });
    t.ok(wt.spec && wt.tabs && wt.rows, 'avant le match, « Je regarde » : onglets Bleus / Rouges, les réglages restent visibles', wt);
    t.ok(wt.blue && wt.red && wt.saved, 'chaque onglet règle son équipe (et tes réglages enregistrés restent ceux des Bleus)', wt);
    t.ok(wt.play && wt.noHuman && wt.forms[0] !== 'ho' && wt.forms[1] === 'ho', 'le match se joue IA contre IA, avec les stratégies choisies', wt);
    t.ok(wt.speedUp.k1 > 0 && wt.speedUp.k4 > 3 * wt.speedUp.k1, 'spectateur accéléré ×4 : le jeu avance environ 4 fois plus vite par image', wt.speedUp);
    t.ok(wt.after.watch === 'non' && wt.after.off !== 'ho' && !wt.after.spec, 'retour au menu : tu rejoues normalement, avec tes réglages', wt);
    t.group('Toss quand la première attaque est au hasard');
    const ts = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      goMainMenu(); await wait(200);
      document.getElementById('soloMenuB').click(); document.getElementById('soloB').click(); await wait(200);
      setOpt('first', 'r'); const txt = document.getElementById('ovText').textContent;
      document.getElementById('go').click(); await wait(100);
      const shown = document.getElementById('tossCard').style.display !== 'none';
      document.getElementById('tossSame').click(); await wait(1700);
      const won = document.getElementById('tossPick').style.display !== 'none';
      if (won) document.getElementById('tossDef').click();
      const goShown = document.getElementById('tossGo').style.display !== 'none', rec = G.firstRoll;
      document.getElementById('tossGo').click(); await wait(300);
      return { txt: /toss/i.test(txt), shown, won, goShown, rec, receiving: G.receiving, phase: G.phase, faces: document.querySelectorAll('.tdisc svg').length, sign: document.querySelector('.tsign').textContent };
    });
    t.ok(ts.txt && ts.shown && ts.faces === 2 && ['=', '≠'].includes(ts.sign), 'au hasard : un toss avec deux disques (posés à l’endroit ou à l’envers, = ou ≠ entre eux) avant le premier point', ts);
    t.ok(ts.goShown && (ts.rec === 0 || ts.rec === 1) && (!ts.won || ts.rec === 1 - 0) && ['pull', 'play'].includes(ts.phase), 'gagné : tu choisis (ici défendre) ; perdu : l’adversaire choisit ; puis le point commence', ts);
    await p.evaluate(() => setOpt('first', '0'));
    t.group('Menu ☰ en mode infini');
    const gr = await p.evaluate(() => {
      storeSet('uf-endless', { best: 3, runs: [] }); endlessStart(); G.series.cur = 2; G.series.wins = 2; G.series.opp = endlessOpp(2); G.score = [1, 0];
      openCard('gameMenuCard'); const run = document.getElementById('gmRun'), r = { vis: run.style.display !== 'none', txt: run.textContent.replace(/\s+/g, ' ') };
      closeCard(); leaveToMenu(); openCard('gameMenuCard'); r.after = document.getElementById('gmRun').style.display; closeCard(); return r;
    });
    t.ok(gr.vis && /Match 3 contre les Hérissons/.test(gr.txt) && /1 – 0/.test(gr.txt) && /2 matchs gagnés/.test(gr.txt) && /record : 3 matchs/.test(gr.txt) && gr.after === 'none', 'mode infini : le menu ☰ montre le match, l’adversaire, le score, la série et le record', gr);

    t.ok(!errs.length, 'aucune erreur', errs);
  } finally { await browser.close(); await srv.close(); }
}
