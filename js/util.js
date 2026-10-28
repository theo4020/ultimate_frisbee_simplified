// util.js — Canvas, conversions mètres → pixels, outils mathématiques

// =====================================================================
//  Canvas
// =====================================================================
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let S = 10, dpr = 1;
const TOUCH_HUD = 26;                                      // hauteur du bandeau du haut sur écran tactile (px)
// Vue inclinée (réglage « Vue », côté tribune) : le sol est vu en biais (aplati par isoK), les joueurs et le disque
// se dressent au-dessus ; ISO_HEAD m de place en haut pour la hauteur des passes. La logique du jeu reste en 2D (mètres).
let isoK = 0.62;                                           // aplatissement du sol : ajusté à l'écran (resize)
const ISO_HEAD = 7, ISO_Z = 0.9;
const isoView = () => typeof CTRL !== 'undefined' && CTRL.view === 'iso';
const fieldH = () => (isoView() ? (H + 2 * M) * isoK + ISO_HEAD : H + 2 * M);   // hauteur du dessin, en m
// Le terrain occupe toute la place disponible, en largeur comme en hauteur (utile sur téléphone en paysage)
function resize() {
  const stage = canvas.parentElement, wrap = stage.parentElement;
  let availW, availH;
  if (document.body.classList.contains('touch')) {
    // téléphone / tablette (paysage) : le terrain prend tout l'écran sous un fin bandeau ; les commandes flottent sur les bords
    availW = window.innerWidth; availH = window.innerHeight - TOUCH_HUD;
    // consignes du tutoriel / de l'entraînement : le terrain passe dessous au lieu d'être caché par elles
    // (consignes en haut : le terrain commence dessous ; en bas, pendant les boutons de play : il s'arrête au-dessus)
    const box = ['tutoBox', 'pracBox'].map(id => document.getElementById(id)).find(e => e && e.offsetHeight > 0);
    const low = box && box.offsetTop > window.innerHeight / 2;
    const top = box && !low ? box.offsetTop + box.offsetHeight + 4 : 0;
    stage.style.marginTop = top ? top + 'px' : '';
    if (top) availH = window.innerHeight - top;
    if (low) availH = box.offsetTop - TOUCH_HUD - 4;
  } else {
    // PC : le terrain prend toute la largeur et la hauteur de la fenêtre (le texte d'aide reste en dessous, on peut défiler)
    // (les fenêtres qui flottent par-dessus, comme la carte du coach, ne prennent pas de place)
    const others = [...wrap.children].filter(e => e !== stage && e.id !== 'hint' && !(typeof getComputedStyle === 'function' && /fixed|absolute/.test(getComputedStyle(e).position)))
      .reduce((h, e) => h + e.offsetHeight, 0);
    availW = wrap.clientWidth; availH = window.innerHeight - others - 24;
  }
  if (isoView()) isoK = clamp((availH / (availW / (W + 2 * M)) - ISO_HEAD) / (H + 2 * M), 0.5, 0.72);   // le terrain occupe la hauteur dispo
  S = Math.max(3, Math.min(availW / (W + 2 * M), availH / fieldH()));
  const w = (W + 2 * M) * S, h = fieldH() * S;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  stage.style.width = w + 'px';
  const sh = document.body.classList.contains('touch') ? window.innerHeight : h;
  document.body.style.setProperty('--joy', Math.round(clamp(sh * 0.36, 100, 170)) + 'px');   // joystick à la taille de l'écran
  document.body.style.setProperty('--tb', Math.round(clamp(sh * 0.17, 52, 78)) + 'px');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth);
  const rh = document.getElementById('rotateHint');                 // téléphone en portrait : le conseil va sous le terrain (pas dessus)
  if (rh && document.body.classList.contains('touch')) rh.style.top = Math.round(canvas.getBoundingClientRect().bottom + 10) + 'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

// =====================================================================
//  Outils
// =====================================================================
const X = x => (x + M) * S, Y = y => (y + M) * S;
// vue inclinée : point du terrain (x, y) à la hauteur z (m) → ordonnée à l'écran (px)
const IY = (y, z) => Y(y) * isoK + ISO_HEAD * S - (z || 0) * S * ISO_Z;
// ordonnée à l'écran d'un repère dessiné « à l'écran » (étiquettes, bulles, bandeaux), dans les deux vues
const SY = (y, z) => (isoView() ? IY(y, z) : Y(y) - (z || 0) * S);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b, c, d) => Math.hypot(c - a, d - b);
// côtés : au premier point, les Bleus attaquent vers la droite ; après chaque point, l'équipe qui a marqué reste du côté
// où elle a marqué (elle y pulle) et l'autre change de côté — les deux équipes changent donc de sens à chaque point
const sidesFlipped = () => !G.tuto && !G.practice && (G.score[0] + G.score[1]) % 2 === 1;
const dirOf = t => ((t === 0) !== sidesFlipped() ? 1 : -1);
const inScoreZone = (t, x) => (dirOf(t) > 0 ? x > W - EZ : x < EZ);
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
// (passe normale ou rasante, et pull : la formule normale ; plus haute : celle de la passe haute, à durée égale)
const peakOf = (dur, kind) => { const l = loftOf(kind); return l > LOFT.N ? (0.8 + dur / throwK(l).dur * 1.1) * 2.4 : 0.8 + dur * 1.1; };
const discPeak = () => peakOf(disc.dur, disc.pull ? 'normal' : disc.loft);
// Vol du disque (voir la fiche « Fondations physiques ») : hauteur à l'instant u (0 → 1) du vol
//  • passe normale : lâchée vers 1 m, elle décrit une courbe jusqu'à son sommet, puis redescend vers 1,3 m chez le
//    receveur. Courte, elle reste à hauteur de poitrine (contestable : c'est le timing qui la protège) ;
//    longue, elle monte plus haut. Une passe courbée est lâchée plus inclinée : elle monte plus vite et plus haut.
//  • passe haute : lâchée au-dessus de la tête, à hauteur de saut, puis elle monte haut et ne redescend qu'à l'arrivée
//  • pull : une grande cloche
const PASS_Z0 = 1.0, PASS_ZEND = 1.3, CURVE_RISE = 0.8;
// sans courbe, une passe reste plus à plat (20 m : ~1,95 m, 30 m : ~2,5 m) ; la courbe la fait monter (comme avant à pleine courbe)
const cruiseZ = (L, curve) => { const c = Math.min(1, Math.abs(curve || 0));
  return clamp(1.4 + Math.max(0, L - 10) * (0.055 + 0.025 * c), 1.4, 3 + c) + CURVE_RISE * c; };
const smooth = x => x * x * (3 - 2 * x);                   // montée progressive : le disque reste longtemps à portée près du lanceur
function heightAt(u, peak, kind, len, curve) {
  if (kind === 'pull') return PASS_Z0 + (Math.max(peak, 3) - PASS_Z0) * Math.sin(Math.PI * u);
  const l = loftOf(kind), w = loftW(l);
  // passe normale : une vraie courbe (pas de palier) ; elle monte en ralentissant jusqu'au sommet, puis redescend vers le
  // receveur ; courbée, elle monte plus vite et culmine plus tôt ; rasante, elle reste plus à plat
  const L = len || 15, c = Math.min(1, Math.abs(curve || 0)), top = PASS_Z0 + (cruiseZ(L, c) - PASS_Z0) * (1 - 0.6 * loftLow(l)), up = 0.5 - 0.15 * c;
  let zn;
  if (u < up) { const k = 1 - u / up; zn = top - (top - PASS_Z0) * k * k; }
  else { const k = Math.min(1, (u - up) / (1 - up)); zn = top - (top - PASS_ZEND) * k * k; }
  if (w <= 0) return zn;
  // passe haute : une cloche douce ; elle quitte la main en montant doucement (contrable au lâcher par une mark qui saute),
  // passe le sommet sans à-coup, redescend vers les mains. Entre les deux : un mélange des deux vols.
  const A = 0.45, z0 = 2.3, z1 = 1.5;
  const zh = u < A ? z0 + (peak - z0) * smooth(u / A) : z1 + (peak - z1) * Math.cos(Math.PI / 2 * Math.min(1, (u - A) / (1 - A)));
  return zn + (zh - zn) * w;
}
const discLen = () => dist(disc.sx, disc.sy, disc.ex, disc.ey);
const discKind = () => (disc.pull ? 'pull' : disc.loft);
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

