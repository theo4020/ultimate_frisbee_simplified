// util.js — Canvas, conversions mètres → pixels, outils mathématiques

// =====================================================================
//  Canvas
// =====================================================================
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let S = 10, dpr = 1;
// Le terrain occupe toute la place disponible, en largeur comme en hauteur (utile sur téléphone en paysage)
function resize() {
  const stage = canvas.parentElement, wrap = stage.parentElement;
  const others = [...wrap.children].filter(e => e !== stage).reduce((h, e) => h + e.offsetHeight, 0);
  const availW = wrap.clientWidth, availH = window.innerHeight - others - 30;
  S = Math.max(3, Math.min(availW / (W + 2 * M), availH / (H + 2 * M)));
  const w = (W + 2 * M) * S, h = (H + 2 * M) * S;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  stage.style.width = w + 'px';
  stage.style.setProperty('--joy', Math.round(clamp(h * 0.4, 90, 150)) + 'px');   // joystick à la taille de l'écran
  stage.style.setProperty('--tb', Math.round(clamp(h * 0.2, 54, 80)) + 'px');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

// =====================================================================
//  Outils
// =====================================================================
const X = x => (x + M) * S, Y = y => (y + M) * S;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b, c, d) => Math.hypot(c - a, d - b);
const dirOf = t => (t === 0 ? 1 : -1);                    // les Bleus attaquent vers la droite
const inScoreZone = (t, x) => (t === 0 ? x > W - EZ : x < EZ);
const depthLeft = (ax, dir) => (dir > 0 ? W - 1.5 - ax : ax - 1.5);

function nearestD(list, x, y, exclude) {
  let b = null, bd = 1e9;
  for (const p of list) {
    if (p === exclude) continue;
    const d = dist(p.x, p.y, x, y);
    if (d < bd) { bd = d; b = p; }
  }
  return [b, bd];
}
const nearest = (list, x, y, ex) => nearestD(list, x, y, ex)[0];

// Trajectoire du disque : courbe de Bézier quadratique
function ctrlFor(sx, sy, ex, ey, curve) {
  const dx = ex - sx, dy = ey - sy, d = Math.hypot(dx, dy) || 0.01;
  return [(sx + ex) / 2 - dy / d * curve * d * 0.4, (sy + ey) / 2 + dx / d * curve * d * 0.4];
}
function bez(sx, sy, cx, cy, ex, ey, u) {
  const a = 1 - u;
  return [a * a * sx + 2 * a * u * cx + u * u * ex, a * a * sy + 2 * a * u * cy + u * u * ey];
}
const flightTime = d => 0.35 + d / 24;
const peakOf = dur => 0.8 + dur * 1.1;                  // hauteur max du disque : plus haute = plus longtemps hors de portée

