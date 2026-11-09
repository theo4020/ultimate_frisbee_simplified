// util.js — Canvas, conversions mètres → pixels, outils mathématiques

// =====================================================================
//  Canvas
// =====================================================================
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let S = 10, dpr = 1;
// caméra (scenery.js : camFrame) : S zoomé et décalage de l'image ; S0 = échelle sans zoom
const CAM = { ox: 0, oy: 0, z: 1, fx: 50, fy: 18.5, punch: 0, S0: 10 };
// police des titres, du tableau des scores et des grands messages (fonts/, embarquée : marche hors ligne)
const UI_FONT = "'Barlow Condensed', system-ui, sans-serif";
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
  CAM.S0 = S; CAM.z = 1; CAM.ox = CAM.oy = 0;
  const w = (W + 2 * M) * S, h = fieldH() * S;
  dpr = window.devicePixelRatio || 1;
  if (typeof ecoOn === 'function' && ecoOn()) dpr = Math.min(dpr, 1.5);   // mode économie : moins de pixels à peindre
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
const X = x => (x + M) * S + CAM.ox, Y = y => (y + M) * S + CAM.oy;
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
// trajectoire du disque (u = part du temps de vol écoulée) : il part vite et ralentit en fin de course
// (vitesse ×(1 + DISC_EASE) au lâcher, ×(1 - DISC_EASE) à l'arrivée ; même durée totale)
const DISC_EASE = 0.5;
const discS = u => u + DISC_EASE * u * (1 - u);
const discU = s => (DISC_EASE ? ((1 + DISC_EASE) - Math.sqrt((1 + DISC_EASE) ** 2 - 4 * DISC_EASE * s)) / (2 * DISC_EASE) : s);   // l'inverse : instant où il a fait cette part du trajet
function bez(sx, sy, cx, cy, ex, ey, u) {
  u = discS(u);
  const a = 1 - u;
  return [a * a * sx + 2 * a * u * cx + u * u * ex, a * a * sy + 2 * a * u * cy + u * u * ey];
}
const flightTime = d => 0.75 + d / 21;                    // vitesse qui grandit avec la distance : 5 m : ~1 s (passe douce) · 10 m : ~1,2 s · 30 m : ~2,2 s
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
// vent le long de la passe (m/s) : > 0 = vent de face, < 0 = vent de dos (vent moyen, sans les rafales)
function windAlong(sx, sy, ex, ey) {
  if (typeof G !== 'undefined' && G.tuto) return 0;            // tutoriel : vols réglés à l'avance, sans effet du vent sur la hauteur
  const dx = ex - sx, dy = ey - sy, d = Math.hypot(dx, dy) || 1, w = (typeof G !== 'undefined' && G.wind) || { x: 0, y: 0 };
  return -((w.x || 0) * dx + (w.y || 0) * dy) / d;
}
// le vent change la hauteur du vol : de face, le disque prend de la portance (il monte et plane) ; de dos, il en perd
// (il reste bas et retombe plus tôt). wa : vent de face en m/s (windAlong). Les deux bouts du vol ne bougent pas.
const WIND_LIFT = { K: 0.045, MIN: 0.6, MAX: 1.45 };
// (u : part du temps de vol, comme bez ; la hauteur suit la position sur la trajectoire, donc elle aussi « part vite »)
function heightAt(u, peak, kind, len, curve, wa) {
  if (kind !== 'pull') u = discS(u);                            // (le pull : il monte et redescend en suivant le temps, il plane)
  const z = heightAt0(u, peak, kind, len, curve);
  if (!wa) return z;
  const f = clamp(1 + WIND_LIFT.K * wa, WIND_LIFT.MIN, WIND_LIFT.MAX), z0 = kind === 'pull' ? PASS_Z0 : PASS_Z0, z1 = kind === 'pull' ? PASS_Z0 : PASS_ZEND;
  const chord = z0 + (z1 - z0) * u;
  // vent de dos : la chute arrive plus tôt (la fin du vol s'écrase un peu plus que le début)
  const g = f >= 1 ? f : 1 - (1 - f) * (0.6 + 0.8 * u);
  return Math.max(0.15, chord + (z - chord) * g);
}
function heightAt0(u, peak, kind, len, curve) {
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
// Vol réel du disque en l'air : on le fait voler avec des forces (le temps u va de 0 au lâcher à 1 à l'arrivée) —
//  • sa vitesse de départ ;
//  • un freinage constant (il part ×1.5 plus vite qu'en moyenne et arrive ×0.5, comme discS) ;
//  • la force de la courbe, toujours de côté par rapport à sa direction du moment : elle le fait tourner, de plus en plus
//    serré à mesure qu'il ralentit (le « hook » de fin de vol) ;
//  • le vent : une force constante dans sa direction, plus forte quand le disque est haut. Face au vent il ralentit,
//    vent dans le dos il accélère, et comme la courbe suit la direction du disque, le vent ne casse pas la courbe.
// La force de la courbe est réglée pour que, sans vent, la passe ait le même creux que la courbe choisie (bez) ; la
// vitesse de départ, pour qu'il arrive là où le jeu l'attend (ex, ey). Table calculée une fois par vol (hôte et invités).
const FLY = { N: 60, ALONG: 0.5, STOP: 0.4, HOOK: 0.3 };
const driftHf = z => clamp(0.1 + 0.36 * z, 0.25, 2.2);         // le vent pousse plus fort en hauteur
// une intégration du vol (point milieu) ; rend l'arrivée et l'écart moyen à la corde (côté +), et remplit out si demandé
function flySim(Q, v0x, v0y, L, out) {
  const n = FLY.N, h = 1 / n, D = Q.D, hf = Q.hf, vm = Q.vm || 1, FX = Q.Fx, FY = Q.Fy, AL = FLY.ALONG, ST = FLY.STOP * vm, HK = FLY.HOOK * vm;
  let ax = 0, ay = 0;
  // accélération : freinage, courbe (de côté), vent (dans l'axe du vol il compte moitié ; freinage et vent de face
  // s'effacent quand le disque est presque arrêté : il ne repart jamais en arrière)
  const acc = (vx, vy, f) => {
    const sp = Math.sqrt(vx * vx + vy * vy) || 1e-6, ux = vx / sp, uy = vy / sp, fx = FX * f, fy = FY * f, fa = fx * ux + fy * uy;
    const slow = sp < ST ? sp / ST : 1, dd = -D * slow + (fa < 0 ? fa * AL * slow : fa * AL);
    const lc = sp < HK ? L * sp / HK : L;                          // (presque arrêté face au vent : le hook ne se resserre plus)
    ax = dd * ux + fx - fa * ux - lc * vy; ay = dd * uy + fy - fa * uy + lc * vx;
  };
  let x = Q.sx, y = Q.sy, vx = v0x, vy = v0y, dev = 0;
  if (out) { out.p = [[x, y]]; out.v = [[vx, vy]]; }
  for (let i = 0; i < n; i++) {
    acc(vx, vy, hf[2 * i]);
    const mx = vx + ax * h / 2, my = vy + ay * h / 2;
    acc(mx, my, hf[2 * i + 1]);
    x += mx * h; y += my * h; vx += ax * h; vy += ay * h;
    dev += ((x - Q.sx) * Q.nx + (y - Q.sy) * Q.ny) / n;
    if (out) { out.p.push([x, y]); out.v.push([vx, vy]); }
  }
  return [x, y, dev];
}
// petit Newton (différences finies) : trouve les inconnues k pour que F(k) = 0
function flySolve(k, F, it) {
  for (let r = 0; r < (it || 8); r++) {
    const f0 = F(k), m = k.length, J = [];
    if (Math.hypot(...f0) < 0.01) break;
    for (let j = 0; j < m; j++) { const e = 1e-3 * (1 + Math.abs(k[j])), kk = k.slice(); kk[j] += e; const f1 = F(kk); J.push(f1.map((v, i) => (v - f0[i]) / e)); }
    const dk = linSolve(J, f0.map(v => -v)); if (!dk) break;   // J[j][i] = dFi/dkj
    for (let j = 0; j < m; j++) k[j] += clamp(dk[j], -60, 60);
  }
  return k;
}
function linSolve(Jt, b) {                                       // Jt[j][i] = dFi/dkj ; résout Σj Jt[j][i]·x[j] = b[i]
  const m = b.length, A = b.map((bi, i) => [...Jt.map(c => c[i]), bi]);
  for (let c = 0; c < m; c++) {
    let p = c; for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-9) return null; [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < m; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let q = c; q <= m; q++) A[r][q] -= f * A[c][q]; }
  }
  return A.map((r, i) => r[m] / r[i]);
}
// P : { sx, sy, cx, cy, ex, ey, wdx, wdy } (le disque, ou la passe qu'on vise) ; zs(u) : hauteur à l'instant u.
// Table gardée dans P.fly tant que la passe ne change pas.
function flyTableFor(P, zs) {
  const T0 = P.fly, wdx = P.wdx || 0, wdy = P.wdy || 0;
  if (T0 && T0.sx === P.sx && T0.sy === P.sy && T0.ex === P.ex && T0.ey === P.ey && T0.cx === P.cx && T0.cy === P.cy && T0.wdx === wdx && T0.wdy === wdy && T0.cv === P.curveV && T0.lo === P.loft) return T0;
  const n = FLY.N, ax = P.ex - wdx, ay = P.ey - wdy;             // ax, ay : arrivée sans vent
  const cl = Math.hypot(ax - P.sx, ay - P.sy) || 1e-6, nx = -(ay - P.sy) / cl, ny = (ax - P.sx) / cl;
  // creux voulu (sans vent) : celui de la courbe bez, échantillonné au même rythme (s = discS(u))
  let want = 0;
  for (let i = 1; i <= n; i++) { const s = discS(i / n), a = 1 - s; want += (2 * a * s * ((P.cx - P.sx) * nx + (P.cy - P.sy) * ny)) / n; }
  const hfr = []; let hm = 0;
  for (let i = 0; i <= 2 * n; i++) { const f = driftHf(zs(i / (2 * n))); hfr.push(f); hm += f / (2 * n + 1); }
  const Q = { sx: P.sx, sy: P.sy, nx, ny, D: 0, hf: hfr, Fx: 0, Fy: 0 };
  // 1) sans vent : vitesse de départ et force de la courbe
  const v0 = 1.5 * cl, g = [(ax - P.sx) / cl * v0, (ay - P.sy) / cl * v0, 0];
  const calm = flySolve(g, k => { Q.D = Q.vm = Math.hypot(k[0], k[1]); Q.D *= 2 / 3; const r = flySim(Q, k[0], k[1], k[2]); return [r[0] - ax, r[1] - ay, r[2] - want]; });
  const L = calm[2]; Q.vm = Math.hypot(calm[0], calm[1]); Q.D = Q.vm * 2 / 3;
  // 2) avec le vent (force qui, seule, déporterait le disque de wd) : on retrouve la vitesse de départ pour arriver en (ex, ey)
  let k = [calm[0], calm[1]];
  if (wdx || wdy) {
    Q.Fx = 2 * wdx / (hm || 1); Q.Fy = 2 * wdy / (hm || 1);
    k = flySolve(k, kk => { const r = flySim(Q, kk[0], kk[1], L); return [r[0] - P.ex, r[1] - P.ey]; });
  }
  const out = {}; flySim(Q, k[0], k[1], L, out);
  // petit recalage : l'arrivée tombe pile sur (ex, ey) (l'écart restant, réparti au fil du vol)
  const ex0 = out.p[n][0] - P.ex, ey0 = out.p[n][1] - P.ey;
  for (let i = 0; i <= n; i++) { const w = i / n; out.p[i][0] -= ex0 * w; out.p[i][1] -= ey0 * w; out.v[i][0] -= ex0; out.v[i][1] -= ey0; }
  // disque penché par la courbe (bord intérieur plus bas) : à chaque instant, un vent qui souffle vers l'intérieur du virage
  // arrive par en dessous et le porte, un vent vers l'extérieur tape le dessus et le plaque — ça change au fil du vol,
  // à mesure que le disque tourne (lb : portance, comme un vent de face, voir heightAt)
  const bk = P.pull || !L || !G.wind || G.tuto ? 0 : Math.min(1, Math.abs(P.curveV || 0)) * (1 - 0.6 * loftW(loftOf(P.loft === undefined ? LOFT.N : P.loft)));
  const lb = out.v.map(([vx, vy]) => { if (!bk) return 0; const sp = Math.hypot(vx, vy) || 1, sg = Math.sign(L); return BANK.LIFT * bk * (G.wind.x * -vy * sg + G.wind.y * vx * sg) / sp; });
  return (P.fly = { sx: P.sx, sy: P.sy, ex: P.ex, ey: P.ey, cx: P.cx, cy: P.cy, wdx, wdy, cv: P.curveV, lo: P.loft, p: out.p, v: out.v, lb });
}
// position à l'instant u (interpolation de Hermite : la courbe reste lisse entre les pas)
function flyAt(T, u) {
  const n = T.p.length - 1, f = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i, h = 1 / n;
  const p0 = T.p[i], p1 = T.p[i + 1], v0 = T.v[i], v1 = T.v[i + 1], t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  return [h00 * p0[0] + h10 * h * v0[0] + h01 * p1[0] + h11 * h * v1[0], h00 * p0[1] + h10 * h * v0[1] + h01 * p1[1] + h11 * h * v1[1]];
}
// portance du disque penché à l'instant u (0 sans table)
function flyLb(T, u) { if (!T || !T.lb) return 0; const n = T.lb.length - 1, f = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)); return T.lb[i] + (T.lb[i + 1] - T.lb[i]) * (f - i); }
// le disque en vol (discZ0 : sans la portance du disque penché, pour calculer le vol)
const discZ0 = u => heightAt(u, discPeak(), discKind(), discLen(), disc.curveV, disc.wa || 0);
const flyTable = () => flyTableFor(disc, discZ0);
const discZ = u => heightAt(u, discPeak(), discKind(), discLen(), disc.curveV, (disc.wa || 0) + flyLb(flyTable(), u));
const discAt = u => flyAt(flyTable(), u);                        // position à l'instant u du vol
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

