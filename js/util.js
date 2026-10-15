// util.js — Canvas, conversions mètres → pixels, outils mathématiques

// =====================================================================
//  Canvas
// =====================================================================
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let S = 10, dpr = 1;
const TOUCH_HUD = 26;                                      // hauteur du bandeau du haut sur écran tactile (px)
// Le terrain occupe toute la place disponible, en largeur comme en hauteur (utile sur téléphone en paysage)
function resize() {
  const stage = canvas.parentElement, wrap = stage.parentElement;
  let availW, availH;
  if (document.body.classList.contains('touch')) {
    // téléphone / tablette (paysage) : le terrain prend tout l'écran sous un fin bandeau ; les commandes flottent sur les bords
    availW = window.innerWidth; availH = window.innerHeight - TOUCH_HUD;
  } else {
    // PC : le terrain prend toute la largeur et la hauteur de la fenêtre (le texte d'aide reste en dessous, on peut défiler)
    const others = [...wrap.children].filter(e => e !== stage && e.id !== 'hint').reduce((h, e) => h + e.offsetHeight, 0);
    availW = wrap.clientWidth; availH = window.innerHeight - others - 24;
  }
  S = Math.max(3, Math.min(availW / (W + 2 * M), availH / (H + 2 * M)));
  const w = (W + 2 * M) * S, h = (H + 2 * M) * S;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  stage.style.width = w + 'px';
  const sh = document.body.classList.contains('touch') ? window.innerHeight : h;
  document.body.style.setProperty('--joy', Math.round(clamp(sh * 0.36, 100, 170)) + 'px');   // joystick à la taille de l'écran
  document.body.style.setProperty('--tb', Math.round(clamp(sh * 0.17, 52, 78)) + 'px');
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
const inField = (x, y) => x >= 0 && x <= W && y >= 0 && y <= H;
// disque repris dans un en-but (pas sur une réception) : ramené sur la ligne d'en-but la plus proche
const lineSpot = (x, y) => (x < EZ ? { x: EZ, y } : x > W - EZ ? { x: W - EZ, y } : null);
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
const flightTime = d => 0.45 + d / 19;                    // 10 m : ~1 s · 30 m : ~2 s
// hauteur max d'une passe haute ou d'un pull (une passe haute monte bien plus haut)
const peakOf = (dur, kind) => (0.8 + dur / (THROWS[kind] || THROWS.normal).dur * 1.1) * (THROWS[kind] || THROWS.normal).peak;
const discPeak = () => peakOf(disc.dur, disc.kind);
// Vol du disque (voir la fiche « Fondations physiques ») : hauteur à l'instant u (0 → 1) du vol
//  • passe normale : lâchée vers 1 m, elle monte vers sa hauteur de croisière, plane, puis redescend vers 1,3 m
//    chez le receveur. Courte, elle reste à hauteur de poitrine (contestable : c'est le timing qui la protège) ;
//    longue, elle croise plus haut. Une passe courbée est lâchée plus inclinée : elle monte plus vite et plus haut.
//  • passe haute : lâchée au-dessus de la tête, à hauteur de saut, puis elle monte haut et ne redescend qu'à l'arrivée
//  • pull : une grande cloche
const PASS_Z0 = 1.0, PASS_ZEND = 1.3, CURVE_RISE = 0.8;
const cruiseZ = (L, curve) => clamp(1.4 + Math.max(0, L - 10) * 0.08, 1.4, 4) + CURVE_RISE * Math.min(1, Math.abs(curve || 0));
const smooth = x => x * x * (3 - 2 * x);                   // montée progressive : le disque reste longtemps à portée près du lanceur
function heightAt(u, peak, kind, len, curve) {
  if (kind === 'high') {
    if (u < 0.45) return 2.3 + (peak - 2.3) * (u / 0.45) * (u / 0.45);
    return peak * Math.sin(Math.PI / 2 * Math.min(1, (1 - u) / 0.55));
  }
  if (kind === 'pull') return PASS_Z0 + (Math.max(peak, 3) - PASS_Z0) * Math.sin(Math.PI * u);
  const L = len || 15, c = Math.min(1, Math.abs(curve || 0)), top = cruiseZ(L, c), s = u * L;
  const rise = clamp(0.4 * L, 2, 12) * (1 - 0.4 * c), fall = clamp(0.4 * L, 2, 12);
  const up = s < rise ? PASS_Z0 + (top - PASS_Z0) * smooth(s / rise) : top;
  const down = L - s < fall ? PASS_ZEND + (top - PASS_ZEND) * smooth((L - s) / fall) : top;
  return Math.min(up, down);
}
const discLen = () => dist(disc.sx, disc.sy, disc.ex, disc.ey);
const discKind = () => (disc.pull ? 'pull' : disc.kind);
const discZ = u => heightAt(u, discPeak(), discKind(), discLen(), disc.curveV);
// Course : temps pour parcourir d mètres en partant à la vitesse v0 dans cette direction (négative : il s'éloigne),
// avec l'accélération et le freinage de RUN, jusqu'à la vitesse de pointe vmax
function runTime(d, v0, vmax) {
  let t = 0;
  if (v0 < 0) { t = -v0 / RUN.dec; d += v0 * v0 / (2 * RUN.dec); v0 = 0; }
  if (d <= 0) return t;
  if (v0 >= vmax) return t + d / vmax;
  const a = RUN.acc, sAcc = (vmax * vmax - v0 * v0) / (2 * a);
  if (d <= sAcc) return t + (Math.sqrt(v0 * v0 + 2 * a * d) - v0) / a;
  return t + (vmax - v0) / a + (d - sAcc) / vmax;
}
// temps pour que le joueur p arrive à moins de « reach » mètres de (x, y), vu sa vitesse actuelle
function reachTime(p, x, y, vmax, reach) {
  const dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy), d = l - (reach || 0);
  if (d <= 0) return 0;
  const vx = p.vx || 0, vy = p.vy || 0, along = (vx * dx + vy * dy) / l, side = Math.abs(vx * dy - vy * dx) / l;
  return runTime(d, along, vmax) + side / RUN.lat * 0.5;      // la vitesse sur le côté doit d'abord être corrigée
}
// hauteur gagnée en sautant : JUMP_H pour un humain, selon son niveau pour un joueur IA
const jumpH = p => (typeof controllerOf === 'function' && controllerOf(p) ? JUMP_H : (aiLvl(p.team).jump || JUMP_H));
// hauteur gagnée par un joueur en plein saut (0 au sol, jumpH au sommet)
const jumpLift = p => (p.jump > 0 ? jumpH(p) * Math.sin(Math.PI * (1 - p.jump / JUMP_T)) : 0);

