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
const flightTime = d => 0.35 + d / 24;
// hauteur max du disque : plus haute = plus longtemps hors de portée (une passe haute monte bien plus haut)
const peakOf = (dur, kind) => (0.8 + dur / (THROWS[kind] || THROWS.normal).dur * 1.1) * (THROWS[kind] || THROWS.normal).peak;
const discPeak = () => peakOf(disc.dur, disc.kind);
// hauteur du disque à l'instant u (0 → 1) du vol
//  • passe normale : lâchée vers 0,9 m, au-dessus des bras après RISE_T, redescend pendant les FALL_T dernières secondes
//  • passe haute : lâchée au-dessus de la tête, à hauteur de saut (une mark debout ne la touche pas,
//    une mark qui saute au bon moment oui), puis elle monte hors de portée et ne redescend qu'à l'arrivée
function heightAt(u, peak, kind, len, curve) {
  if (kind === 'high') {
    if (u < 0.45) return 2.3 + (peak - 2.3) * (u / 0.45) * (u / 0.45);
    return peak * Math.sin(Math.PI / 2 * Math.min(1, (1 - u) / 0.55));
  }
  // passe normale : sa hauteur dépend de la distance parcourue depuis le lanceur (et de celle qui reste jusqu'au receveur) :
  //   au lancer : cercle de stall (STALL_R) → en plongeant ; 3 m de plus → debout ; encore 3 m → en sautant ;
  //   à l'arrivée, les mêmes zones 1,5 fois plus longues (le disque redescend plus doucement qu'il ne monte) ;
  //   entre les deux, hors de portée ; une passe courbée monte plus vite (zones du lancer jusqu'à 40 % plus courtes)
  const L = len || 15, top = Math.max(NORMAL_TOP, peak);
  const kUp = 1 - CURVE_RISE * Math.min(1, Math.abs(curve || 0));
  return Math.min(normalZ(u * L, 0.9, top, kUp), normalZ((1 - u) * L, 1.0, top, 1.5));
}
const discLen = () => dist(disc.sx, disc.sy, disc.ex, disc.ey);
const discZ = u => heightAt(u, discPeak(), disc.kind, discLen(), disc.curveV);
// hauteur d'une passe normale à s mètres de son extrémité (lancer ou réception), en partant de z0 ; k allonge les zones
const PASS_STAND = 3, PASS_JUMP = 3, CURVE_RISE = 0.4;                            // longueur des zones « debout » et « en sautant » au lancer (m)
function normalZ(s, z0, top, k) {
  const a = STALL_R * k, b = a + PASS_STAND * k, c = b + PASS_JUMP * k, dive = REACH_DIVE, stand = REACH_STAND, jump = REACH_STAND + JUMP_H;
  if (s <= a) return z0 + (dive - z0) * s / a;
  if (s <= b) return dive + (stand - dive) * (s - a) / (b - a);
  if (s <= c) return stand + (jump - stand) * (s - b) / (c - b);
  return jump + (top - jump) * Math.min(1, (s - c) / 4);
}
// hauteur gagnée par un joueur en plein saut (0 au sol, JUMP_H au sommet)
const jumpLift = p => (p.jump > 0 ? JUMP_H * Math.sin(Math.PI * (1 - p.jump / JUMP_T)) : 0);

