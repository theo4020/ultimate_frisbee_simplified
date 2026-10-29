// Petits jeux dans le jeu, dans un vrai navigateur : départ au pull façon course (feux, départ parfait, hors-jeu)
// et mark aimantée (qu'on peut quitter à tout moment).
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
    const startMatch = async first => {
      await p.evaluate(f => { goMainMenu && G.phase !== 'menu' && (G.phase = 'menu'); showLobby(); document.getElementById('soloMenuB').click(); document.getElementById('soloB').click(); G.form.first = f; document.getElementById('go').click(); }, first);
    };

    t.group('Départ au pull : faux départ de l’équipe qui reçoit');
    await p.evaluate(() => { START.AI_OFF = 0; });               // pas de faux départ de l'IA, sauf dans le test qui le demande
    await p.evaluate(() => { storeSet('uf-tuto', true); storeSet('uf-showopts', true); });   // joueur qui a fait le tutoriel : pas les conseils de base
    await startMatch('0');                                    // on reçoit : l'IA adverse pulle avec les feux
    await p.waitForFunction(() => G.phase === 'pull' && G.pull && lightsOn(G.pull.cd) >= 2, null, { timeout: 20000 });
    t.ok(await p.evaluate(() => startOn() && G.pull.by == null), 'l’IA pulle : les feux s’allument');
    t.ok(await p.isVisible('#coachTip') && /vert/.test(await p.textContent('#ctText')), 'première fois : Coach Disco explique les feux (sans pause)', await p.textContent('#ctText'));
    t.ok(await p.evaluate(() => !G.paused && (storeGet('uf-tips', {}) || {}).start === 1), 'le conseil est noté : il ne reviendra pas');
    await p.keyboard.press(' ');
    t.ok(await p.evaluate(() => G.offside && G.offside.team === G.me), 'Espace pendant les feux : faux départ, hors-jeu de ton équipe');
    await p.evaluate(() => { window.__dc = dropChance; window.dropChance = () => -1; });   // pas de pull droppé (hasard) pendant ce test
    await p.waitForFunction(() => G.phase === 'play' && disc.mode === 'held', null, { timeout: 20000 });
    const ck = await p.evaluate(() => ({ ck: G.checkT, can: canThrow(), holder: disc.holder.team === G.me }));
    await p.evaluate(() => { window.dropChance = window.__dc; });
    t.ok(ck.ck > 1 && !ck.can && ck.holder, 'à la réception : check, on ne peut pas encore lancer', ck);
    await p.waitForFunction(() => G.checkT === 0, null, { timeout: 6000 }).catch(() => { });
    t.ok(await p.evaluate(() => G.checkT === 0), 'le check se termine tout seul');

    t.group('Départ au pull : départ parfait');
    await p.evaluate(() => { START.AI_OFF = 0; G.score = [0, 1]; G.receiving = G.me; G.phase = 'between'; G.menuShown = false; startPoint(); });
    await p.waitForFunction(() => G.phase === 'play' && G.startGo != null, null, { timeout: 20000, polling: 'raf' });
    await p.keyboard.press(' ');
    const bo = await p.evaluate(() => ({ n: TEAMS[G.me].filter(q => q.boostT > 0).length, opp: TEAMS[1 - G.me].filter(q => q.boostT > 0).length, off: G.offside }));
    t.ok(bo.n >= 4 && bo.opp === 0 && !bo.off, 'Espace au vert : ton équipe part en trombe (pas l’adversaire), sans hors-jeu', bo);

    t.group('Départ au pull : faux départ de l’équipe qui pulle → brick');
    await p.evaluate(() => { G.form.puller = 'ai'; G.score = [1, 1]; G.receiving = 1 - G.me; G.phase = 'between'; G.menuShown = false; startPoint(); });
    await p.waitForFunction(() => G.phase === 'pull' && G.pull && lightsOn(G.pull.cd) >= 2, null, { timeout: 20000 });
    t.ok(await p.evaluate(() => G.pull.team === G.me && G.pull.by == null), 'ton équipe pulle (pulleur : IA) : feux aussi');
    await p.keyboard.press(' ');
    await p.waitForFunction(() => G.phase === 'play' && (disc.mode === 'held' || disc.mode === 'carry') && disc.holder && disc.holder.team !== G.me, null, { timeout: 20000 });
    await p.waitForFunction(() => disc.mode === 'held', null, { timeout: 15000 }).catch(() => { });
    const br = await p.evaluate(() => { const r = G.receiving; return { x: +disc.holder.x.toFixed(1), brick: brickX(r), ahead: dirOf(r) * (disc.holder.x - brickX(r)) }; });
    t.ok(br.ahead >= -0.5, 'l’équipe adverse repart du brick (ou de plus loin)', br);
    await p.evaluate(() => { G.form.puller = 'cap'; });

    t.group('Départ au pull : l’IA aussi part parfois trop tôt');
    await p.evaluate(() => { START.AI_OFF = 10; G.score = [2, 1]; G.receiving = G.me; G.phase = 'between'; G.menuShown = false; startPoint(); });
    await p.waitForFunction(() => G.offside || G.phase === 'play', null, { timeout: 20000 });
    t.ok(await p.evaluate(() => G.offside && G.offside.team !== G.me), 'faux départ de l’équipe IA qui pulle : hors-jeu signalé');
    await p.waitForFunction(() => disc.mode === 'held' && disc.holder.team === G.me, null, { timeout: 20000 }).catch(() => { });
    t.ok(await p.evaluate(() => dirOf(G.me) * (disc.holder.x - brickX(G.me)) >= -0.5), 'ton équipe repart du brick (ou de plus loin)');
    await p.evaluate(() => { START.AI_OFF = 0.045; });

    t.group('Mark aimantée');
    const setup = side => p.evaluate(s => {
      closeAllCards(); document.getElementById('overlay').classList.add('hidden'); G.menuShown = false; G.paused = false;
      G.oplay = null; G.dplay = null; G.pickup = null; G.off = 1 - G.me; G.phase = 'play'; G.checkT = 0; G.carryTo = null;
      const o = TEAMS[1 - G.me][0]; o.x = 50; o.y = 18.5; o.vx = o.vy = 0; holdDisc(o); o.think = 99;   // le porteur attend
      const h = meH(), d = TEAMS[G.me][0]; selectFor(h, d); d.x = o.x + dirOf(o.team) * 2; d.y = o.y; d.vx = d.vy = 0;
      G.pointer.bx = undefined; G.pointer.x = o.x + dirOf(o.team) * 0.8; G.pointer.y = o.y + s * 1.2; G.pointer.last = G.time;
    }, side);
    // attente en temps de jeu (la machine de test peut ralentir les images : on ne compte pas en temps réel)
    const gwait = async sec => { const t0 = await p.evaluate(() => G.gt); await p.waitForFunction(t => G.gt >= t, t0 + sec, { timeout: 15000, polling: 'raf' }); };
    const look = () => p.evaluate(() => { const d = meH().sel, h = disc.holder; return { on: !!d.markOn, dx: +(dirOf(h.team) * (d.x - h.x)).toFixed(2), dy: +(d.y - h.y).toFixed(2), mk: G.marker === d, stall: +G.stall.toFixed(1), shade: +G.mkShade.toFixed(2), ph: G.phase, mode: disc.mode, ht: h && h.team, me: G.me, ctl: !!controllerOf(d), pz: G.paused, pull: !!G.pull }; });
    await p.evaluate(() => { tipT = 0; tipSeen = null; document.getElementById('coachTip').style.display = 'none'; const s = storeGet('uf-tips', {}) || {}; delete s.mark; storeSet('uf-tips', s); });
    await setup(1);
    await gwait(1.2);
    const m1 = await look();
    t.ok(await p.isVisible('#coachTip') && /mark/.test(await p.textContent('#ctText')), 'première mark : Coach Disco explique l’aimant et comment la quitter', await p.textContent('#ctText'));
    t.ok(m1.on && m1.mk && m1.dx > 0.6 && m1.dx < 1.6 && Math.abs(m1.dy - 1.2) < 0.5 && m1.stall > 0, 'dans le cercle : ton joueur se cale devant le porteur, du côté visé, et compte le stall', m1);
    await p.evaluate(() => { G.pointer.y = disc.holder.y - 1.2; }); await gwait(1.5);
    const m2 = await look();
    t.ok(m2.on && Math.abs(m2.dy + 1.2) < 0.5 && Math.sign(m2.shade) !== Math.sign(m1.shade), 'viser de l’autre côté : la mark ferme l’autre côté', { m1, m2 });
    await p.evaluate(() => { const h = disc.holder; G.pointer.x = h.x + dirOf(h.team) * 12; G.pointer.y = h.y + 8; }); await gwait(1.6);
    const m3 = await look();
    t.ok(!m3.on && Math.hypot(m3.dx, m3.dy) > 4, 'viser plus loin : l’aimant lâche, ton joueur court où il veut', m3);
    t.ok(!m3.mk && m3.stall < 1, 'la mark quitte le cercle : le compte repart de zéro (un coéquipier IA peut reprendre la mark)', { m2, m3 });
    // joystick (téléphone) : la cible est à 3,2 m du joueur dans la direction du stick
    await setup(1); await gwait(0.7);
    await p.evaluate(() => { const d = meH().sel, h = disc.holder; G.pointer.x = d.x + dirOf(h.team) * 3.2; G.pointer.y = d.y; }); await gwait(0.15);
    for (let k = 0; k < 6; k++) { await p.evaluate(() => { const d = meH().sel, h = disc.holder; G.pointer.x = d.x + dirOf(h.team) * 3.2; G.pointer.y = d.y; }); await gwait(0.12); }
    const m5 = await look();
    t.ok(!m5.on && m5.dx > 2.5, 'au joystick : pousser vers l’extérieur quitte aussi la mark', m5);
    await p.evaluate(() => { CTRL.markAssist = false; });
    await setup(1); await p.evaluate(() => { G.pointer.y = disc.holder.y + 3; }); await gwait(1.2);
    const m4 = await look();
    t.ok(!m4.on && m4.dy > 2.3, 'réglage coupé : ton joueur va simplement où tu vises (sans se caler à 1,6 m)', m4);
    await p.evaluate(() => { CTRL.markAssist = true; });

    t.group('Feinte de pivot contre une mark IA');
    const fe = await p.evaluate(async () => {
      closeAllCards(); document.getElementById('overlay').classList.add('hidden'); G.menuShown = false; G.paused = false;
      G.phase = 'play'; G.off = G.me; G.pickup = null; G.oplay = null; G.dplay = null; G.checkT = 0;
      const h = TEAMS[G.me][0]; h.x = 50; h.y = 18; h.vx = h.vy = 0; holdDisc(h); h.think = 99;
      const d = TEAMS[1 - G.me][0]; d.x = h.x + dirOf(G.me) * 1.4; d.y = 18.5;
      const fr = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      await fr(40); const s0 = G.mkShade;
      togglePivot(); await fr(5); togglePivot();                 // aller-retour rapide : la feinte
      let peak = s0; for (let k = 0; k < 20; k++) { await fr(1); peak = Math.max(peak, G.mkShade); }
      return { s0: +s0.toFixed(2), peak: +peak.toFixed(2), piv: +h.pivY.toFixed(2) };
    });
    t.ok(fe.peak - fe.s0 > 0.25 && fe.piv < -0.9, 'un aller-retour rapide de pivot décale la mark du mauvais côté (le porteur, lui, est revenu)', fe);

    t.ok(!errs.length, 'aucune erreur', errs);
  } finally { await browser.close(); await srv.close(); }
}
