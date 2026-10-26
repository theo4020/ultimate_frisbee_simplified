// review-play.mjs — Relecture en jouant : des « joueurs robots » jouent de vraies parties dans Chromium, avec la souris
// et le clavier comme un humain (visée, lancers, déplacements, pull). Note les erreurs, points, pertes, messages, repère
// un porteur bloqué, et prend des captures régulières.
// Usage : [VIEW=iso] node tools/review-play.mjs <dossier de sortie> [niveau] [points] [solo|coop]
//   solo : un match rapide contre l'IA · coop : mode infini à plusieurs, hôte + invité (faux réseau de tools/test/fakepeer.js)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright, startServer } from './test/lib.mjs';

const out = process.argv[2] || 'review-out', level = process.argv[3] || 'normal', maxPts = +process.argv[4] || 4, mode = process.argv[5] || 'solo';
fs.mkdirSync(out, { recursive: true });
const { chromium } = playwright();
const srv = await startServer();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
if (mode === 'coop') await ctx.addInitScript(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'test', 'fakepeer.js'), 'utf8'));
const log = [];
const L = (...a) => log.push(a.join(' '));
const watch = (p, tag) => {
  p.on('pageerror', e => L('ERREUR', tag, ':', e.message, (e.stack || '').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error' && !/secrets\.js|Failed to load/.test(m.text())) L('ERREUR console', tag, ':', m.text()); });
};
const ready = p => p.waitForFunction(() => typeof G !== 'undefined' && G.attract);
const spy = p => p.evaluate(() => { window.__msgs = []; const f = flash; flash = function (m) { window.__msgs.push([+G.gt.toFixed(1), m]); return f.apply(this, arguments); }; });

// ---------- mise en place ----------
const pages = [];
const host = await ctx.newPage(); watch(host, 'hôte'); pages.push(host);
await host.goto(srv.url + 'index.html'); await ready(host); await host.fill('#pname', 'Robot');
if (mode === 'coop') {
  await host.click('#onlineMenuB'); await host.click('#coopB'); await host.click('#endGo');
  await host.waitForFunction(() => /^[A-Z0-9]{4}$/.test(document.getElementById('hostCode').textContent));
  const code = await host.textContent('#hostCode');
  const g = await ctx.newPage(); watch(g, 'invité'); pages.push(g);
  await g.goto(srv.url + 'index.html'); await ready(g); await g.fill('#pname', 'Robot2');
  await g.goto('about:blank'); await g.goto(srv.url + 'index.html#join=' + code);
  await g.waitForFunction(() => G.net === 'guest' && G.myId > 0, null, { timeout: 10000 });
  await g.click('#teamB0');
  await host.waitForFunction(() => G.humans.length === 2 && G.humans.every(h => h.team === 0), null, { timeout: 5000 });
  await host.click('#startOnline');
  await g.waitForFunction(() => document.getElementById('stratCard').style.display !== 'none', null, { timeout: 5000 });
} else {
  await host.click('#soloMenuB'); await host.click('#soloB');
  await host.evaluate(lv => { const b = document.querySelector('.opt[data-g=level][data-v=' + lv + ']'); if (b) b.click(); G.form.level = lv; }, level);
}
for (const p of pages) await spy(p);
if (process.env.VIEW) for (const p of pages) await p.evaluate(v => { CTRL.view = v; resize(); }, process.env.VIEW);   // VIEW=iso : vue inclinée

// ---------- un pas du robot : lit le jeu, puis bouge la souris / lance / pulle ----------
const readState = p => p.evaluate(() => {
  const r = canvas.getBoundingClientRect();
  const sc = (x, y) => ({ x: r.left + (x + M) * S, y: r.top + (isoView() ? (y + M) * S * isoK + ISO_HEAD * S : (y + M) * S) });
  const segD = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, l = vx * vx + vy * vy || 1, u = clamp(((px - ax) * vx + (py - ay) * vy) / l, 0, 1); return dist(px, py, ax + u * vx, ay + u * vy); };
  const h = meH(), sel = canThrow() ? disc.holder : h && h.sel, me = G.me, dr = dirOf(me);
  const o = { phase: G.phase, score: G.score.join('-'), off: G.off, gt: G.gt };
  if (G.phase === 'pull') {
    o.puller = localPuller(); o.stage = G.pullUI && G.pullUI.stage; o.ready = G.net === 'guest' || pullReady();
    if (o.puller && disc.holder) { const gl = goalLine(G.receiving); o.tgt = sc(gl + dirOf(G.receiving) * 4, H / 2); o.gauge = o.stage === 'power' ? gaugePos() : 0; }
    return o;
  }
  if (G.phase !== 'play' || !sel) return o;
  o.can = canThrow();
  if (o.can) {
    let best = null, bs = -1e9;
    for (const q of TEAMS[me]) {
      if (q === sel) continue;
      const lx = q.x + q.vx * 0.7, ly = clamp(q.y + q.vy * 0.7, 1, H - 1), d = dist(sel.x, sel.y, lx, ly);
      if (d < 5 || d > 38) continue;
      let near = 99; for (const e of TEAMS[1 - me]) near = Math.min(near, dist(e.x, e.y, lx, ly), 2 * segD(e.x, e.y, sel.x, sel.y, lx, ly));
      const s = dr * (lx - sel.x) + 3 * Math.min(near, 5) - (near < 2 ? 30 : 0) + (inScoreZone(me, lx) ? 25 : 0);
      if (s > bs) { bs = s; best = sc(lx, ly); }
    }
    o.tgt = best; o.stall = G.stall; o.holdT = G.holdT || 0;
    if (o.holdT > 6 && G.stall === 0 && !window.__dumped) {          // personne ne marque le porteur : on note la scène
      window.__dumped = true;
      o.dump = JSON.stringify({ dmode: disc.mode, pickup: G.pickup && G.pickup.i, paused: G.paused, form: defFormOf(1 - me), dplay: G.dplay && G.dplay.type,
        h: [+sel.x.toFixed(1), +sel.y.toFixed(1)], defs: TEAMS[1 - me].map(d => [d.i, +d.x.toFixed(1), +d.y.toFixed(1), +(d.tx || 0).toFixed(1), +(d.ty || 0).toFixed(1), d.role]) });
    }
  } else if (disc.team === me && disc.mode === 'air') o.mv = sc(disc.ex, disc.ey);
  else if (attacking()) o.mv = sc(clamp(sel.x + dr * 10, 2, W - 2), H / 2 + Math.sin(G.gt * 0.7 + sel.i) * 10);
  else {                                                      // défense : sur l'attaquant le plus proche, côté de sa zone
    let m = null, md = 1e9; for (const q of TEAMS[1 - me]) { const d = dist(q.x, q.y, sel.x, sel.y); if (d < md) { md = d; m = q; } }
    o.mv = sc(m.x - dirOf(1 - me) * (disc.holder === m ? 1.5 : -2.5) + m.vx * 0.4, m.y + m.vy * 0.4);
    if (disc.mode === 'air' && dist(disc.ex, disc.ey, sel.x, sel.y) < 6) o.mv = sc(disc.ex, disc.ey);
  }
  return o;
});
async function step(p, st) {
  if (await p.isVisible('#go')) { await p.waitForTimeout(300); if (await p.isEnabled('#go')) await p.click('#go').catch(() => { }); return; }
  if (st.phase === 'pull' && st.puller && st.ready && st.tgt) {
    if (st.stage === 'aim') await p.mouse.click(st.tgt.x, st.tgt.y);
    else if (st.stage === 'power' && st.gauge > 0.84 && st.gauge < 0.92) await p.keyboard.press(' ');
  }
  if (st.phase === 'play') {
    if (st.can && st.tgt && (st.stall > 0.6 || st.holdT > 9)) { await p.mouse.move(st.tgt.x, st.tgt.y); await p.waitForTimeout(60); await p.mouse.down(); await p.mouse.up(); }
    else if (st.mv) await p.mouse.move(st.mv.x, st.mv.y, { steps: 2 });
  }
}

// ---------- la partie ----------
const shot = async (p, name) => { await p.screenshot({ path: path.join(out, name + '.png') }); };
const T0 = Date.now();
let lastShot = 0, nShot = 0, lastScore = '0-0', lastOff = null, desync = 0;
while (Date.now() - T0 < 9 * 60e3) {
  const sts = [];
  for (const p of pages) sts.push(await readState(p));
  const st = sts[0];
  if (st.phase === 'over') { L('FIN', st.score); await shot(host, 'fin'); break; }
  if (st.score !== lastScore) {
    L('POINT', st.score, 't=' + st.gt.toFixed(0)); lastScore = st.score; await shot(pages[pages.length - 1], 'point-' + st.score);
    if (st.score.split('-').reduce((a, b) => +a + +b) >= maxPts) break;
  }
  if (st.phase === 'play' && lastOff !== null && st.off !== lastOff) L('CHANGEMENT → attaque', st.off, 't=' + st.gt.toFixed(1));
  if (st.phase === 'play') lastOff = st.off;
  for (const s of sts) if (s.dump) { L('PORTEUR NON MARQUÉ', s.dump); await shot(host, 'non-marque'); }
  if (mode === 'coop' && sts[1] && sts[1].phase === 'play' && st.phase === 'play' && sts[1].score !== st.score) desync++;
  for (let i = 0; i < pages.length; i++) await step(pages[i], sts[i]);
  if (Date.now() - lastShot > 25e3) { lastShot = Date.now(); nShot++; for (let i = 0; i < pages.length; i++) await shot(pages[i], 'jeu-' + nShot + (i ? '-invite' : '')); }
  await host.waitForTimeout(40);
}
for (const [i, p] of pages.entries()) {
  const msgs = await p.evaluate(() => window.__msgs || []), stats = await p.evaluate(() => G.stats);
  L('\nMESSAGES ' + (i ? 'invité' : 'hôte') + '\n' + msgs.map(m => m.join(' ')).join('\n') + '\nSTATS ' + JSON.stringify(stats));
}
if (desync) L('score différent entre hôte et invité sur', desync, 'lectures');
fs.writeFileSync(path.join(out, 'log.txt'), log.join('\n'));
console.log(log.filter(l => !l.startsWith('\nMESSAGES')).join('\n'));
await browser.close(); await srv.close();
