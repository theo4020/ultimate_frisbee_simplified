// scenery.js — Habillage de la vue de dessus et caméra
//  • terrain pré-rendu dans une image (redessinée seulement si la taille, le terrain ou les équipes changent) : herbe
//    texturée et tondue en damier, lignes peintes à la craie, lumière du soleil, abords du terrain (banc des remplaçants,
//    sacs, gourdes, disques de rechange, panneaux au stade, serviettes à la plage, congères à la neige…) ;
//  • soleil commun : les ombres du disque et des joueurs partent toutes du même côté (en bas à droite). Le disque et les
//    joueurs restent dessinés à leur vraie place : seule l'ombre s'écarte avec la hauteur (lisible, comme vu de dessus) ;
//  • caméra « suit le jeu » (réglage Commandes, coupée par défaut) : léger zoom qui suit le disque, petit à-coup sur les
//    points. Elle agit sur S et sur le décalage CAM.ox / CAM.oy de X() / Y() (util.js) : tout le dessin et la visée suivent.

// ombre au soleil : décalage (en mètres) pour un objet à la hauteur z (m)
const SUN = { x: 0.55, y: 0.8 };
const sunOff = z => [SUN.x * (0.18 + z * 0.42), SUN.y * (0.18 + z * 0.42)];
// ombre douce (dégradé) au sol, centrée en (x, y) pixels, rayon r pixels, opacité a
function softShadow(c, x, y, r, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}

// ---------- textures (une petite tuile répétée) ----------
// hasard fixe : la même herbe à chaque fois (pas de scintillement quand l'image est refaite)
const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const TEX = {};
function texTile(kind) {
  const k = kind + '|' + dpr;
  if (TEX[k] !== undefined) return TEX[k];
  if (typeof document === 'undefined' || !kind) return (TEX[k] = null);
  const T = Math.round(160 * dpr), cv = document.createElement('canvas'); cv.width = cv.height = T;
  const c = cv.getContext('2d'), R = seeded(kind.length * 977 + 13), u = dpr;
  if (kind === 'herbe') {                                     // brins d'herbe courts, clairs et sombres, et quelques trèfles
    c.lineCap = 'round';
    for (let i = 0; i < 1900; i++) {
      const x = R() * T, y = R() * T, l = (1.6 + R() * 2.6) * u, a = -Math.PI / 2 + (R() - 0.5) * 0.9, light = R() < 0.5;
      c.strokeStyle = light ? `rgba(255,255,220,${0.05 + R() * 0.07})` : `rgba(0,30,0,${0.07 + R() * 0.09})`;
      c.lineWidth = (0.6 + R() * 0.7) * u; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    for (let i = 0; i < 26; i++) { c.fillStyle = `rgba(20,83,45,${0.18 + R() * 0.15})`; const x = R() * T, y = R() * T; for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(x + Math.cos(j * 2.1) * 1.3 * u, y + Math.sin(j * 2.1) * 1.3 * u, 1.2 * u, 0, 7); c.fill(); } }
  } else if (kind === 'sable' || kind === 'terre') {           // grains (et petits cailloux sur la terre battue)
    for (let i = 0; i < 2600; i++) { const d = R() < 0.5; c.fillStyle = d ? `rgba(80,40,10,${0.06 + R() * 0.1})` : `rgba(255,250,230,${0.06 + R() * 0.12})`; c.fillRect(R() * T, R() * T, (0.7 + R()) * u, (0.7 + R()) * u); }
    if (kind === 'terre') for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,237,213,${0.15 + R() * 0.2})`; c.beginPath(); c.arc(R() * T, R() * T, (0.6 + R() * 1.1) * u, 0, 7); c.fill(); }
  } else if (kind === 'neige') {                               // poudreuse : reflets et creux bleutés
    for (let i = 0; i < 900; i++) { c.fillStyle = R() < 0.7 ? `rgba(255,255,255,${0.25 + R() * 0.4})` : `rgba(100,116,139,${0.06 + R() * 0.08})`; c.beginPath(); c.arc(R() * T, R() * T, (0.5 + R() * 1.4) * u, 0, 7); c.fill(); }
  } else if (kind === 'bois') {                                // veines du parquet
    for (let i = 0; i < 70; i++) { c.strokeStyle = `rgba(60,30,10,${0.05 + R() * 0.07})`; c.lineWidth = (0.5 + R() * 0.8) * u; const y = R() * T; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(T * 0.3, y + (R() - 0.5) * 6 * u, T * 0.7, y + (R() - 0.5) * 6 * u, T, y); c.stroke(); }
  } else return (TEX[k] = null);
  return (TEX[k] = cv);
}
const TEX_OF = { gazon: 'herbe', stade: 'herbe', plage: 'sable', terre: 'terre', neige: 'neige', salle: 'bois' };

// ---------- le terrain (dans le contexte c, à l'échelle S0, sans caméra) ----------
// tR : l'équipe qui marque à droite (en-but de droite à sa couleur)
function paintField(c, F, fid, tR, S0, cw, ch) {
  const px = x => (x + M) * S0, py = y => (y + M) * S0, grass = F === FIELDS.gazon || F === FIELDS.stade;
  c.fillStyle = F.bg; c.fillRect(0, 0, cw, ch);
  if (fid === 'plage') {                                         // plage : du sable autour, la mer seulement en haut
    c.fillStyle = '#c9a66b'; c.fillRect(0, py(-1.1), cw, ch);
    const g = c.createLinearGradient(0, 0, 0, py(-1.1)); g.addColorStop(0, '#0369a1'); g.addColorStop(1, '#38bdf8');
    c.fillStyle = g; c.fillRect(0, 0, cw, py(-1.1));
  }
  const tile = texTile(TEX_OF[fid]);
  const texture = (x, y, w, h, a) => {                         // texture répétée sur un rectangle
    if (!tile) return;
    const pat = c.createPattern(tile, 'repeat'); if (!pat) return;
    if (pat.setTransform && typeof DOMMatrix === 'function') pat.setTransform(new DOMMatrix().scale(1 / dpr));
    c.save(); c.globalAlpha = a; c.fillStyle = pat; c.fillRect(x, y, w, h); c.restore();
  };
  // abords : herbe plus haute et plus sombre autour du terrain
  texture(0, 0, cw, ch, 0.8);
  // aire de jeu : bandes de tonte (et damier sur l'herbe), texture
  for (let i = 0; i < 10; i++) { c.fillStyle = F.s[i % 2 ? 0 : 1]; c.fillRect(px(i * 10), py(0), 10 * S0 + 0.5, H * S0); }
  if (grass) { c.fillStyle = 'rgba(255,255,255,.03)'; for (let j = 0; j < 5; j += 2) c.fillRect(px(0), py(j * H / 5), W * S0, H / 5 * S0); }
  texture(px(0), py(0), W * S0, H * S0, 1);
  if (F.stars) { c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 90; i++) { const sx = (i * 37.3) % W, sy = (i * 23.7 + (i % 7) * 5.1) % H; c.beginPath(); c.arc(px(sx), py(sy), Math.max(0.6, S0 * (0.06 + (i % 3) * 0.04)), 0, 7); c.fill(); } }
  if (F.planks) { c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; for (let y = 1.5; y < H; y += 1.5) { c.beginPath(); c.moveTo(px(0), py(y)); c.lineTo(px(W), py(y)); c.stroke(); } }
  // en-buts aux couleurs des équipes
  c.fillStyle = rgba(tcol(tR), F.ez); c.fillRect(px(W - EZ), py(0), EZ * S0, H * S0);
  c.fillStyle = rgba(tcol(1 - tR), F.ez); c.fillRect(px(0), py(0), EZ * S0, H * S0);
  c.fillStyle = F.txt; c.font = `700 ${Math.max(11, S0 * 1.9)}px ${UI_FONT}`; c.textAlign = 'center';
  c.fillText('LES ' + tn(tR).toUpperCase(), px(W - EZ / 2), py(H / 2 - 1)); c.fillText('MARQUENT ICI', px(W - EZ / 2), py(H / 2 + 1.6));
  c.fillText('LES ' + tn(1 - tR).toUpperCase(), px(EZ / 2), py(H / 2 - 1)); c.fillText('MARQUENT ICI', px(EZ / 2), py(H / 2 + 1.6));
  // lignes peintes : un trait franc, puis un passage usé (la craie n'est jamais parfaite)
  const lines = () => { c.strokeRect(px(0), py(0), W * S0, H * S0); c.beginPath(); c.moveTo(px(EZ), py(0)); c.lineTo(px(EZ), py(H)); c.moveTo(px(W - EZ), py(0)); c.lineTo(px(W - EZ), py(H)); c.stroke(); };
  c.strokeStyle = F.line; c.lineWidth = Math.max(2, S0 * 0.14); lines();
  c.save(); c.setLineDash([S0 * 0.9, S0 * 0.35, S0 * 0.25, S0 * 0.6]); c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = Math.max(1, S0 * 0.06); lines(); c.restore();
  const kx = 0.6 * S0;                                         // points de brick
  c.strokeStyle = F.line; c.lineWidth = Math.max(2, S0 * 0.12);
  for (const bx of [EZ + 12, W - EZ - 12]) { c.beginPath(); c.moveTo(px(bx) - kx, py(H / 2) - kx); c.lineTo(px(bx) + kx, py(H / 2) + kx); c.moveTo(px(bx) + kx, py(H / 2) - kx); c.lineTo(px(bx) - kx, py(H / 2) + kx); c.stroke(); }
  paintSurroundings(c, F, fid, px, py, S0, cw, ch);
  for (const cx of [0, EZ, W - EZ, W]) for (const cy of [0, H]) {   // plots orange aux coins des en-buts (avec leur ombre)
    const x = px(cx), y = py(cy), s = S0;
    softShadow(c, x + s * 0.35, y + s * 0.45, s * 0.75, 0.3);
    c.fillStyle = '#f97316'; c.beginPath(); c.arc(x, y, s * 0.55, 0, 7); c.fill();
    c.fillStyle = '#fdba74'; c.beginPath(); c.arc(x - s * 0.12, y - s * 0.12, s * 0.22, 0, 7); c.fill();
  }
  // lumière : soleil en haut à gauche (jour) ; vignettage ; halos des projecteurs (stade)
  if (!F.lights && !F.stars) {
    const g = c.createLinearGradient(0, 0, cw, ch); g.addColorStop(0, 'rgba(255,250,220,.08)'); g.addColorStop(0.55, 'rgba(255,250,220,0)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
    c.fillStyle = g; c.fillRect(0, 0, cw, ch);
  }
  const vg = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${F.vg})`);
  c.fillStyle = vg; c.fillRect(0, 0, cw, ch);
  if (F.lights) for (const [lx, ly] of [[0, 0], [W, 0], [0, H], [W, H], [W / 2, 0], [W / 2, H]]) {
    const g = c.createRadialGradient(px(lx), py(ly), 0, px(lx), py(ly), 30 * S0);
    g.addColorStop(0, 'rgba(254,249,195,.22)'); g.addColorStop(1, 'rgba(254,249,195,0)');
    c.fillStyle = g; c.fillRect(px(lx) - 30 * S0, py(ly) - 30 * S0, 60 * S0, 60 * S0);
  }
}

// abords, dans la marge (M = 3,2 m) : à l'extérieur le public (animé, voir drawCrowd), puis les panneaux (stade), puis,
// près des lignes, le banc des remplaçants, les sacs, les gourdes, les disques… ; tout reste sous les joueurs
const CROWD_BAND = 1.25;                                         // profondeur du public, au bord extérieur de la marge
function paintSurroundings(c, F, fid, px, py, S0, cw, ch) {
  const s = S0, R = seeded(4242);
  const rr = (x, y, w, h, r, fill) => { c.fillStyle = fill; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill(); };
  const inner = M - CROWD_BAND, top = -inner * 0.55, bot = H + inner * 0.55;   // milieu de la bande proche des lignes
  if (fid !== 'espace' && fid !== 'plage') {                     // gradins sous le public : un sol plus sombre
    c.fillStyle = 'rgba(15,23,42,.28)';
    c.fillRect(0, 0, cw, CROWD_BAND * s); c.fillRect(0, ch - CROWD_BAND * s, cw, CROWD_BAND * s);
    c.fillRect(0, 0, CROWD_BAND * s, ch); c.fillRect(cw - CROWD_BAND * s, 0, CROWD_BAND * s, ch);
  }
  if (fid === 'stade') {                                         // panneaux entre le public et le terrain
    const band = 0.8 * s, txt = ['ULTIMATE', 'SPIRIT OF THE GAME', 'FAIR-PLAY', 'ULTIMATE FRISBEE'];
    c.font = `800 ${Math.max(8, band * 0.66)}px ${UI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const y of [CROWD_BAND * s, ch - CROWD_BAND * s - band]) for (let i = 0, x = CROWD_BAND * s; x < cw - CROWD_BAND * s - 4; i++, x += (cw - 2 * CROWD_BAND * s) / 6) {
      const w = (cw - 2 * CROWD_BAND * s) / 6;
      rr(x + 2, y + 1, w - 4, band - 2, 3, i % 2 ? '#1e3a8a' : '#0f172a');
      c.fillStyle = i % 2 ? '#bfdbfe' : '#facc15'; c.fillText(txt[i % txt.length], x + w / 2, y + band / 2 + 1);
    }
    c.textBaseline = 'alphabetic';
  }
  if (fid === 'plage') {                                         // serviettes rayées et parasols, en bas (la mer est en haut, animée)
    for (const [x, col] of [[14, '#f472b6'], [40, '#facc15'], [64, '#22d3ee'], [86, '#a78bfa']]) {
      const X0 = px(x), Y0 = py(H + 0.5), w = 1.6 * s, h = 2.1 * s;
      softShadow(c, X0 + w / 2 + s * 0.4, Y0 + h / 2 + s * 0.5, s * 1.4, 0.2);
      rr(X0, Y0, w, h, 3, col); c.fillStyle = 'rgba(255,255,255,.7)'; for (let j = 1; j < 4; j += 2) c.fillRect(X0, Y0 + h * j / 4, w, h / 8);
      const ux = px(x + 3.2), uy = py(H + 1.6);
      softShadow(c, ux + s * 0.6, uy + s * 0.8, s * 1.6, 0.25);
      for (let j = 0; j < 8; j++) { c.fillStyle = j % 2 ? '#fff' : col; c.beginPath(); c.moveTo(ux, uy); c.arc(ux, uy, s * 1.35, j * Math.PI / 4, (j + 1) * Math.PI / 4); c.fill(); }
    }
    return;
  }
  if (fid === 'neige') {                                         // congères le long des côtés
    for (const y of [top, bot]) for (let x = -1; x < W + 2; x += 3 + R() * 2.5) {
      softShadow(c, px(x) + s * 0.5, py(y) + s * 0.6, s * (1.2 + R() * 0.7), 0.13);
      c.fillStyle = '#f8fafc'; c.beginPath(); c.arc(px(x), py(y), s * (0.9 + R() * 0.6), 0, 7); c.fill();
    }
    return;
  }
  if (fid === 'espace') return;
  // banc des remplaçants de chaque équipe (en haut : équipe 0, en bas : équipe 1), sacs, gourdes, disques de rechange
  for (const [t, y] of [[0, top], [1, bot]]) {
    const bx = W / 2 - 5 + (t ? 4 : -4), Y0 = py(y) - 0.5 * s;
    softShadow(c, px(bx + 4) + s * 0.5, Y0 + s * 0.8, s * 4.2, 0.2);
    rr(px(bx), Y0, 8 * s, 1.0 * s, 4, '#475569'); rr(px(bx), Y0, 8 * s, 0.32 * s, 4, '#64748b');
    for (let j = 0; j < 4; j++) {                                 // remplaçants (vus de dessus : épaules et tête)
      const x = px(bx + 1 + j * 2), yy = Y0 + 0.5 * s;
      c.fillStyle = tcol(t); c.beginPath(); c.ellipse(x, yy, 0.8 * s, 0.5 * s, 0, 0, 7); c.fill();
      c.fillStyle = HAIR[(j + t * 2) % HAIR.length]; c.beginPath(); c.arc(x, yy, 0.36 * s, 0, 7); c.fill();
    }
    for (let j = 0; j < 3; j++) {                                 // sacs aux couleurs de l'équipe
      const x = px(bx - 2.6 - j * 1.9 + R() * 0.4), yy = py(y) - 0.42 * s;
      softShadow(c, x + s * 0.75, yy + s * 0.7, s * 1.0, 0.22);
      rr(x, yy, 1.35 * s, 0.85 * s, 0.28 * s, j === 1 ? '#334155' : tdark(t)); rr(x + 0.22 * s, yy + 0.14 * s, 0.9 * s, 0.24 * s, 0.1 * s, 'rgba(255,255,255,.2)');
    }
    for (let j = 0; j < 3; j++) {                                 // gourdes
      const x = px(bx + 8.8 + j * 0.85), yy = py(y);
      softShadow(c, x + s * 0.2, yy + s * 0.25, s * 0.4, 0.25);
      c.fillStyle = ['#e2e8f0', '#38bdf8', '#f472b6'][j]; c.beginPath(); c.arc(x, yy, 0.3 * s, 0, 7); c.fill();
      c.fillStyle = '#0f172a'; c.beginPath(); c.arc(x, yy, 0.13 * s, 0, 7); c.fill();
    }
    const dx = px(bx + 11.6), dy = py(y);                         // pile de disques
    softShadow(c, dx + s * 0.35, dy + s * 0.4, s * 0.9, 0.25);
    for (let j = 0; j < 3; j++) { c.fillStyle = ['#f8fafc', '#facc15', '#f97316'][j]; c.strokeStyle = 'rgba(15,23,42,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(dx + j * 0.16 * s, dy - j * 0.14 * s, 0.6 * s, 0, 7); c.fill(); c.stroke(); }
  }
}

// ---------- animations du terrain (chaque image, peu coûteuses) ----------
// public : une rangée de spectateurs vus de dessus tout autour, qui bougent, applaudissent, et explosent de joie sur un point
// (CAM.hype : 1 sur un point, ~0,6 sur un beau geste, retombe en quelques secondes)
let CROWD = null;
function crowdPeople() {
  if (CROWD) return CROWD;
  const R = seeded(777), P = [], shirt = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#f8fafc', '#f97316', '#a855f7', '#0ea5e9', '#e11d48', '#334155'];
  const add = (x, y) => P.push({ x, y, c: shirt[Math.floor(R() * shirt.length)], h: HAIR[Math.floor(R() * HAIR.length)], ph: R() * 6.3, clap: R() < 0.45, fan: R() < 0.12 });
  const y0 = -M + CROWD_BAND * 0.5, y1 = H + M - CROWD_BAND * 0.5, x0 = -M + CROWD_BAND * 0.5, x1 = W + M - CROWD_BAND * 0.5;
  for (let x = -M + 0.6; x < W + M - 0.4; x += 0.95 + R() * 0.5) { add(x, y0 + (R() - 0.5) * 0.35); add(x + 0.3, y1 + (R() - 0.5) * 0.35); }
  for (let y = -M + CROWD_BAND + 0.5; y < H + M - CROWD_BAND - 0.4; y += 1 + R() * 0.5) { add(x0 + (R() - 0.5) * 0.3, y); add(x1 + (R() - 0.5) * 0.3, y); }
  return (CROWD = P);
}
function drawCrowd(fid) {
  if (fid === 'espace') return;
  const P = crowdPeople(), t = G.time, hype = CAM.hype || 0, s = S, toCenter = q => Math.atan2(H / 2 - q.y, W / 2 - q.x);
  const shirts = new Map();
  for (const q of P) {
    if (fid === 'plage' && q.y < 0) continue;                    // la mer est en haut
    const x = X(q.x), y = Y(q.y); if (x < -20 || y < -20 || x > canvas.width / dpr + 20 || y > canvas.height / dpr + 20) continue;
    const jump = hype > 0.3 ? Math.max(0, Math.sin(t * 9 + q.ph)) * hype : 0, bob = 1 + Math.sin(t * 2 + q.ph) * 0.03 + jump * 0.22;
    const a = toCenter(q), ca = Math.cos(a), sa = Math.sin(a), w = 0.5 * s * bob;
    // bras : applaudissements (mains qui se rejoignent devant), bras levés et agités sur un point
    const armsUp = hype > 0.45 || q.fan, clapK = q.clap || hype > 0.2 ? (Math.sin(t * (hype > 0.2 ? 16 : 11) + q.ph) + 1) / 2 : 0.5;
    const lx = -sa, ly = ca;                                       // côté (perpendiculaire au regard)
    if (armsUp || q.clap || hype > 0.2) {                          // bras visibles seulement quand il applaudit ou lève les bras
      const reach = armsUp ? 0.7 + Math.sin(t * 10 + q.ph) * 0.1 : 0.38, spread = armsUp ? 0.5 : 0.08 + clapK * 0.2;
      ctx.strokeStyle = '#d6a77a'; ctx.lineWidth = Math.max(1, 0.13 * s); ctx.beginPath();
      for (const sd of [1, -1]) { ctx.moveTo(x + lx * sd * w * 0.7, y + ly * sd * w * 0.7); ctx.lineTo(x + (ca * reach + lx * sd * spread) * s, y + (sa * reach + ly * sd * spread) * s); }
      ctx.stroke();
    }
    if (!shirts.has(q.c)) shirts.set(q.c, []); shirts.get(q.c).push([x, y, w, a]);
    q._x = x; q._y = y; q._w = w;
  }
  for (const [col, L] of shirts) { ctx.fillStyle = col; ctx.beginPath(); for (const [x, y, w, a] of L) { const r = a + Math.PI / 2; ctx.moveTo(x + w * Math.cos(r), y + w * Math.sin(r)); ctx.ellipse(x, y, w, w * 0.62, r, 0, 7); } ctx.fill(); }
  ctx.beginPath();
  const heads = new Map();                                        // têtes (couleur de cheveux), un peu vers l'arrière
  for (const q of P) if (q._x !== undefined && !(fid === 'plage' && q.y < 0)) { const a = toCenter(q), hx = q._x - Math.cos(a) * q._w * 0.12, hy = q._y - Math.sin(a) * q._w * 0.12; if (!heads.has(q.h)) heads.set(q.h, []); heads.get(q.h).push([hx, hy, q._w * 0.46]); }
  for (const [col, L] of heads) { ctx.fillStyle = col; ctx.beginPath(); for (const [x, y, r] of L) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 7); } ctx.fill(); }
  for (const q of P) q._x = undefined;
  CAM.hype = Math.max(0, hype - (FX.dt || 0.016) * 0.28);
}
// herbe qui bouge : des vagues de vent qui passent sur le terrain (bandes claires), et des touffes qui ondulent
let TUFTS = null;
function drawGrassWind(fid) {
  if (fid === 'plage') { drawSea(); return; }
  if (fid !== 'gazon' && fid !== 'stade') return;
  const t = G.time, wk = Math.min(1, (G.wind ? G.wind.kmh : 10) / 25), ang = G.wind && G.wind.kmh > 1 ? Math.atan2(G.wind.y, G.wind.x) : 0.3;
  const ux = Math.cos(ang), uy = Math.sin(ang), L = 60;
  ctx.save(); ctx.beginPath(); ctx.rect(X(0), Y(0), W * S, H * S); ctx.clip();
  for (let k = 0; k < 3; k++) {                                   // vagues : une bande claire qui glisse dans le sens du vent
    const d = ((t * (3 + wk * 7) + k * L / 3) % L) - L / 2, cx = W / 2 + ux * d, cy = H / 2 + uy * d;
    const g = ctx.createLinearGradient(X(cx - ux * 7), Y(cy - uy * 7), X(cx + ux * 7), Y(cy + uy * 7));
    const a = 0.035 + wk * 0.04;
    g.addColorStop(0, 'rgba(255,255,230,0)'); g.addColorStop(0.5, `rgba(255,255,230,${a})`); g.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = g; ctx.fillRect(X(0), Y(0), W * S, H * S);
  }
  ctx.restore();
  if (!TUFTS) { const R = seeded(99); TUFTS = []; for (let i = 0; i < 170; i++) TUFTS.push({ x: R() * (W + 2 * M) - M, y: R() * (H + 2 * M) - M, ph: R() * 6.3, l: 0.35 + R() * 0.35, d: R() < 0.5 }); }
  const sway = (q, i) => (Math.sin(t * (1.6 + wk * 2.4) + q.ph + q.x * 0.15) * 0.5 + 0.5) * (0.15 + wk * 0.5);
  for (const dark of [false, true]) {
    ctx.strokeStyle = dark ? 'rgba(10,50,20,.35)' : 'rgba(190,242,100,.28)'; ctx.lineWidth = Math.max(1, S * 0.07); ctx.beginPath();
    for (const q of TUFTS) {
      if (q.d !== dark) continue;
      const x = X(q.x), y = Y(q.y), b = sway(q), l = q.l * S;
      for (let j = -1; j <= 1; j++) {
        const bx = x + j * S * 0.12; ctx.moveTo(bx, y);
        ctx.quadraticCurveTo(bx + (ux * b * 0.5 + j * 0.08) * l, y - l * 0.6 + uy * b * l * 0.5, bx + (ux * b + j * 0.2) * l, y - l + uy * b * l);
      }
    }
    ctx.stroke();
  }
}
// plage : la mer en haut, l'écume avance et recule
function drawSea() {
  const t = G.time, s = S;
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = Math.max(1.5, s * 0.13);
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    const base = -M * (0.3 + k * 0.22) + Math.sin(t * 0.9 + k * 2) * 0.25;
    for (let x = -M; x <= W + M; x += 0.8) { const y = base + Math.sin(x * 0.45 + t * 1.3 + k * 1.7) * 0.18; x === -M ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)); }
    ctx.stroke();
  }
}

// ---------- au sol : herbe soulevée par un plongeon, poussière ou neige en courant ----------
const GROUND_BITS = { gazon: ['#4ade80', '#16a34a', '#86efac'], stade: ['#22c55e', '#15803d'], plage: ['#e7c98f', '#c9a66b'], terre: ['#fb923c', '#c2410c'], neige: ['#ffffff', '#e2e8f0'], salle: null, espace: null };
function groundFx(p, spd) {
  const cols = GROUND_BITS[styleOf('field')]; if (!cols || G.attract && Math.random() < 0.5) return;
  const dt = FX.dt || 0.016;
  if (p.dive > 0 && spd > 2 && Math.random() < dt * 40) {      // plongeon : des brins giclent derrière lui
    const a = Math.atan2(p.vy, p.vx) + Math.PI + (Math.random() - 0.5) * 1.4, v = 2 + Math.random() * 3;
    FX.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v + p.vx * 0.3, vy: Math.sin(a) * v + p.vy * 0.3, t: 0, life: 0.45 + Math.random() * 0.3,
      color: cols[Math.floor(Math.random() * cols.length)], size: 0.16 + Math.random() * 0.1, kind: 'dot', rot: 0, vr: 0, drag: 3.5 });
  }
  const loose = cols && styleOf('field') !== 'gazon' && styleOf('field') !== 'stade';   // sable, terre, neige : petite poussière au sprint
  if (loose && spd > 5 && !(p.dive > 0) && Math.random() < dt * 6)
    FX.parts.push({ x: p.x - p.vx * 0.04, y: p.y - p.vy * 0.04, vx: -p.vx * 0.1, vy: -p.vy * 0.1, t: 0, life: 0.5, color: cols[1] || cols[0], size: 0.32, kind: 'dot', rot: 0, vr: 0, drag: 4 });
}

// ---------- caméra ----------
// suit le jeu : zoom léger (téléphone : plus fort, les joueurs sont plus gros), centré sur le disque (en vol : vers son
// arrivée), sans jamais montrer le vide autour du terrain. À-coup de zoom sur un point (CAM.punch).
function camFrame(dt) {
  const cw = canvas.width / dpr, ch = canvas.height / dpr;
  const on = CTRL.cam === 'suivi' && !isoView() && !G.attract && !G.replay && !G.tuto && ['play', 'pull', 'between', 'over'].includes(G.phase);
  CAM.punch = Math.max(0, CAM.punch - dt * 1.4);
  let zt = 1, tx = W / 2, ty = H / 2;
  if (on) {
    zt = (isTouchUI() ? 1.45 : 1.22) + 0.14 * Math.sin(Math.min(1, CAM.punch) * Math.PI);
    if (disc.mode === 'air') { tx = disc.x * 0.6 + disc.ex * 0.4; ty = disc.y * 0.6 + disc.ey * 0.4; } else { tx = disc.x; ty = disc.y; }
    if (!isFinite(tx) || !isFinite(ty)) { tx = W / 2; ty = H / 2; }
  }
  const k = Math.min(1, dt * 2.6);
  CAM.z += (zt - CAM.z) * Math.min(1, dt * 2.2); CAM.fx += (tx - CAM.fx) * k; CAM.fy += (ty - CAM.fy) * k;
  if (Math.abs(CAM.z - 1) < 0.002 && !on) { CAM.z = 1; S = CAM.S0; CAM.ox = CAM.oy = 0; return; }
  S = CAM.S0 * CAM.z;
  const fw = (W + 2 * M) * S, fh = fieldH() * S;
  CAM.ox = clamp(cw / 2 - (CAM.fx + M) * S, cw - fw, 0); CAM.oy = clamp(ch / 2 - (CAM.fy + M) * S, ch - fh, 0);
}
