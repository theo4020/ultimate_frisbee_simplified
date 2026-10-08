// fx.js — Retours au joueur : sons synthétisés (aucun fichier audio), particules,
// traînée du disque, secousses d'écran et vibrations sur téléphone.
// Côté hôte, chaque effet est aussi envoyé à l'invité pour qu'il le voie et l'entende.

const FX = { muted: false, ctx: null, parts: [], shake: 0, trail: [], out: [], pop: 0, lastCount: 0 };
try { FX.muted = localStorage.getItem('uf-muted') === '1'; } catch (e) { }

// ---------- audio ----------
function audioCtx() {
  if (FX.muted || typeof window === 'undefined') return null;
  if (!FX.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { FX.ctx = new AC(); } catch (e) { return null; }
  }
  if (FX.ctx.state === 'suspended') FX.ctx.resume().catch(() => {});
  return FX.ctx;
}
// les navigateurs n'autorisent le son qu'après une première action du joueur
if (typeof window !== 'undefined' && window.addEventListener) {
  const unlock = () => { audioCtx(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
}

function tone(freq, dur, opt = {}) {
  const a = audioCtx(); if (!a) return;
  const t0 = a.currentTime + (opt.delay || 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = opt.type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t0 + dur);
  const v = opt.vol || 0.15;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + Math.min(0.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
let noiseBuf = null;
function noise(dur, opt = {}) {
  const a = audioCtx(); if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = a.currentTime + (opt.delay || 0);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf;
  f.type = opt.filter || 'bandpass'; f.Q.value = opt.q || 1;
  f.frequency.setValueAtTime(opt.freq || 1000, t0);
  if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, t0 + dur);
  const v = opt.vol || 0.2;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  throw: () => noise(0.28, { freq: 700, to: 2600, q: 1.4, vol: 0.18 }),
  pull: () => { whistle(); noise(0.6, { freq: 500, to: 2200, q: 1.2, vol: 0.2, delay: 0.25 }); },
  catch: () => { tone(240, 0.09, { type: 'triangle', vol: 0.22 }); noise(0.04, { filter: 'highpass', freq: 3000, vol: 0.12 }); },
  block: () => { noise(0.18, { filter: 'lowpass', freq: 1200, vol: 0.4 }); tone(140, 0.18, { type: 'square', to: 60, vol: 0.12 }); },
  int: () => { noise(0.15, { filter: 'lowpass', freq: 1500, vol: 0.35 }); tone(392, 0.12, { type: 'triangle', vol: 0.18, delay: 0.05 }); tone(587, 0.16, { type: 'triangle', vol: 0.18, delay: 0.14 }); },
  layout: () => noise(0.32, { filter: 'lowpass', freq: 500, to: 180, vol: 0.28 }),
  turn: () => { tone(330, 0.16, { type: 'square', vol: 0.06 }); tone(220, 0.26, { type: 'square', vol: 0.06, delay: 0.14 }); },
  score: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.18, delay: i * 0.09 })),
  stall: () => whistle(),
  double: () => { tone(440, 0.1, { type: 'square', vol: 0.08 }); tone(440, 0.1, { type: 'square', vol: 0.08, delay: 0.16 }); },
  call: () => tone(660, 0.07, { type: 'triangle', vol: 0.1 }),
  land: () => noise(0.12, { filter: 'lowpass', freq: 700, vol: 0.18 }),
  tick: () => tone(880, 0.05, { vol: 0.05 }),
  tickHi: () => tone(1100, 0.06, { type: 'triangle', vol: 0.1 }),
  qte: q => q >= 0.82 && q <= 0.95 ? [1047, 1568].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.2, delay: i * 0.07 }))
    : tone(q > 0.95 ? 300 : 520, 0.14, { type: 'square', vol: 0.08 })
};
function whistle() { tone(2300, 0.32, { type: 'sine', vol: 0.12 }); tone(2450, 0.32, { type: 'sine', vol: 0.06 }); }

// ---------- particules ----------
const TEAM_COL = ['#3b82f6', '#ef4444'];
function burst(x, y, n, opt) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (opt.speed || 6) * (0.4 + Math.random() * 0.8);
    FX.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: (opt.life || 0.6) * (0.6 + Math.random() * 0.6),
      color: Array.isArray(opt.color) ? opt.color[i % opt.color.length] : opt.color, size: opt.size || 0.35,
      kind: opt.kind || 'dot', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, drag: opt.drag || 3 });
  }
}
function ring(x, y, color, maxR, life) { FX.parts.push({ x, y, t: 0, life: life || 0.45, color, maxR: maxR || 2.5, kind: 'ring', vx: 0, vy: 0 }); }
function vibrate(p) { try { if (navigator.vibrate && document.body.classList.contains('touch')) navigator.vibrate(p); } catch (e) { } }

// ---------- événements ----------
function fxPlay(name, x, y, team) {
  try { if (SOUNDS[name]) SOUNDS[name](team); } catch (e) { }
  const c = TEAM_COL[team] || '#fff';
  switch (name) {
    case 'catch': ring(x, y, 'rgba(255,255,255,.9)', 2.2, 0.35); break;
    case 'block': burst(x, y, 14, { color: ['#f87171', '#fb923c', '#fde68a'], speed: 9, life: 0.5 }); ring(x, y, '#f87171', 3, 0.4); FX.shake = Math.max(FX.shake, 7); vibrate(60); break;
    case 'int': burst(x, y, 18, { color: [c, '#fde68a', '#fff'], speed: 10, life: 0.6 }); ring(x, y, c, 3.5, 0.5); FX.shake = Math.max(FX.shake, 9); vibrate([40, 30, 60]); break;
    case 'layout': burst(x, y, 10, { color: ['#a3e635', '#65a30d', '#d9f99d'], speed: 4, life: 0.5, size: 0.3 }); vibrate(25); break;
    case 'turn': burst(x, y, 8, { color: ['#cbd5e1', '#94a3b8'], speed: 3, life: 0.5, size: 0.28 }); break;
    case 'score': {
      const ex = team === 0 ? W - EZ / 2 : EZ / 2;
      for (let i = 0; i < 70; i++) {
        FX.parts.push({ x: ex + (Math.random() - 0.5) * EZ, y: Math.random() * H, vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 5,
          t: 0, life: 1.2 + Math.random() * 0.8, color: [c, '#facc15', '#fff'][i % 3], size: 0.85, kind: 'confetti', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, drag: 0.6, grav: 5 });
      }
      FX.shake = Math.max(FX.shake, 5); FX.pop = 1; vibrate([60, 40, 120]); break;
    }
    case 'double': if (disc.holder) ring(disc.holder.x, disc.holder.y, '#f87171', STALL_R, 0.6); break;
    case 'stall': FX.shake = Math.max(FX.shake, 4); vibrate(80); break;
    case 'pull': ring(x, y, 'rgba(255,255,255,.8)', 3, 0.5); break;
    case 'call': ring(x, y, '#facc15', 2.2, 0.6); ring(x, y, 'rgba(250,204,21,.6)', 3.4, 0.8); break;
    case 'land': burst(x, y, 6, { color: ['#d9f99d', '#a3e635'], speed: 2.5, life: 0.45, size: 0.25 }); break;
  }
}
function fxEvent(name, x, y, team) {
  fxPlay(name, x, y, team);
  if (G.net === 'host') FX.out.push([name, Math.round(x * 10) / 10, Math.round(y * 10) / 10, team]);
}

// ---------- mise à jour et rendu ----------
function fxUpdate(dt) {
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i];
    p.t += dt;
    if (p.t >= p.life) { FX.parts.splice(i, 1); continue; }
    if (p.kind !== 'ring') {
      const k = Math.max(0, 1 - (p.drag || 0) * dt);
      p.vx *= k; p.vy = p.vy * k + (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; if (p.vr) p.rot += p.vr * dt;
    }
  }
  FX.shake = Math.max(0, FX.shake - dt * 30);
  FX.pop = Math.max(0, FX.pop - dt * 1.5);
  // traînée du disque en vol
  if (disc.mode === 'air') { FX.trail.push([disc.x, disc.y, disc.z]); if (FX.trail.length > 14) FX.trail.shift(); }
  else FX.trail.length = 0;
  // tic du stall count (plus marqué à partir de 7)
  const n = disc.mode === 'held' && G.stall > 0 && G.phase === 'play' ? Math.min(10, Math.floor(G.stall) + 1) : 0;
  if (n !== FX.lastCount) { if (n >= 7) SOUNDS.tickHi(); else if (n >= 1) SOUNDS.tick(); FX.lastCount = n; }
}
function drawTrail() {
  const tr = FX.trail; if (tr.length < 2) return;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 1; i < tr.length; i++) {
    const a = i / tr.length;
    ctx.strokeStyle = `rgba(255,255,255,${(a * 0.5).toFixed(3)})`; ctx.lineWidth = Math.max(1, a * 0.5 * S);
    ctx.beginPath();
    ctx.moveTo(X(tr[i - 1][0]), Y(tr[i - 1][1]) - tr[i - 1][2] * S * 1.2);
    ctx.lineTo(X(tr[i][0]), Y(tr[i][1]) - tr[i][2] * S * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}
function drawParticles() {
  ctx.save();
  for (const p of FX.parts) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0, a);
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color; ctx.lineWidth = 3 * a + 1;
      circle(X(p.x), Y(p.y), (0.4 + (p.t / p.life) * p.maxR) * S); ctx.stroke();
    } else if (p.kind === 'confetti') {
      ctx.save(); ctx.translate(X(p.x), Y(p.y)); ctx.rotate(p.rot); ctx.fillStyle = p.color;
      ctx.fillRect(-p.size * S / 2, -p.size * S / 4, p.size * S, p.size * S / 2); ctx.restore();
    } else {
      ctx.fillStyle = p.color; circle(X(p.x), Y(p.y), p.size * S * (0.5 + a * 0.5)); ctx.fill();
    }
  }
  ctx.restore();
}
function toggleMute() {
  FX.muted = !FX.muted;
  try { localStorage.setItem('uf-muted', FX.muted ? '1' : '0'); } catch (e) { }
  if (!FX.muted) audioCtx();
  const b = document.getElementById('muteB'); if (b) b.textContent = FX.muted ? '🔇' : '🔊';
}
