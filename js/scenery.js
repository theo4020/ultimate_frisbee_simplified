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
const TEX_OF = { gazon: 'herbe', herbes: 'herbe', stade: 'herbe', prairie: 'herbe', plage: 'sable', terre: 'terre', neige: 'neige', salle: 'bois' };

// ---------- le terrain (dans le contexte c, à l'échelle S0, sans caméra) ----------
// tR : l'équipe qui marque à droite (en-but de droite à sa couleur)
function paintField(c, F, fid, tR, S0, cw, ch) {
  const px = x => (x + M) * S0, py = y => (y + M) * S0, grass = F === FIELDS.gazon || F === FIELDS.stade || F === FIELDS.herbes;
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

// abords, dans la marge (M = 2 m), au même niveau que le banc : remplaçants, sacs, gourdes, disques, et quelques spectateurs
// debout le long des lignes de côté (animés, voir drawCrowd), comme au bord d'un vrai terrain d'ultimate ; panneaux au
// bord extérieur (stade) ; tout reste sous les joueurs
const SIDE_Y = 1.0;                                              // distance (m) de la ligne de côté au banc et au public
function paintSurroundings(c, F, fid, px, py, S0, cw, ch) {
  const s = S0, R = seeded(4242);
  const rr = (x, y, w, h, r, fill) => { c.fillStyle = fill; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill(); };
  const top = -SIDE_Y, bot = H + SIDE_Y;
  if (fid === 'stade') {                                         // panneaux entre le public et le terrain
    const band = 0.5 * s, txt = ['ULTIMATE', 'SPIRIT OF THE GAME', 'FAIR-PLAY', 'ULTIMATE FRISBEE'];
    c.font = `800 ${Math.max(8, band * 0.66)}px ${UI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const y of [0, ch - band]) for (let i = 0, x = 0; x < cw - 4; i++, x += cw / 6) {
      const w = cw / 6;
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
  const R = seeded(777), P = [], pick = a => a[Math.floor(R() * a.length)];
  const SHIRT = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#f8fafc', '#f97316', '#a855f7', '#0ea5e9', '#e11d48', '#334155', '#14b8a6', '#f472b6'];
  const HAIRS = ['#3b2f2a', '#1f2937', '#a16207', '#7c2d12', '#e5c07b', '#d1d5db', '#57534e', '#f59e0b', '#111827'];
  const SKINS = ['#f1c7a3', '#d9a37a', '#a8714f', '#7a4b32', '#e8b88f', '#c68642'];
  const add = (x, y) => P.push({
    x, y, ph: R() * 6.3, clap: R() < 0.4, fan: R() < 0.1,
    size: R() < 0.12 ? 0.72 : 0.9 + R() * 0.25,                   // quelques enfants
    shirt: pick(SHIRT), stripe: R() < 0.22 ? pick(SHIRT) : null, skin: pick(SKINS),
    hair: R() < 0.07 ? null : pick(HAIRS),                         // (crâne rasé)
    hat: R() < 0.28 ? { c: pick(['#ef4444', '#0f172a', '#facc15', '#f8fafc', '#2563eb', '#16a34a']), brim: R() < 0.7 } : null,
    flag: R() < 0.1 ? (R() < 0.5 ? 0 : 1) : -1,                   // drapeau d'une équipe
    chair: R() < 0.22, chairC: pick(['#475569', '#1d4ed8', '#b91c1c', '#15803d']), turn: (R() - 0.5) * 0.9
  });
  // petits groupes clairsemés le long des deux lignes de côté, hors de la zone du banc
  for (const y of [-SIDE_Y - 0.15, H + SIDE_Y + 0.15]) for (let x = 1.5; x < W - 1; x += 1.6 + R() * 2.4) {
    if (Math.abs(x - 52) < 19) continue;                         // le banc, les sacs, les gourdes
    if (R() < 0.3) { x += 3 + R() * 5; continue; }               // des trous entre les groupes
    add(x, y + (R() - 0.5) * 0.4);
  }
  return (CROWD = P);
}
// chaque spectateur vu de dessus : chaise éventuelle, bras (applaudit, lève les bras), épaules (t-shirt uni ou rayé),
// tête (cheveux, casquette, ou crâne rasé), drapeau d'une équipe pour certains
function drawCrowd(fid) {
  if (fid === 'espace') return;
  const P = crowdPeople(), t = G.time, hype = CAM.hype || 0, s = S, cw = canvas.width / dpr, ch = canvas.height / dpr;
  ctx.save(); ctx.lineCap = 'round';
  for (const q of P) {
    if (fid === 'plage' && q.y < 0) continue;                    // la mer est en haut
    const x = X(q.x), y = Y(q.y); if (x < -20 || y < -20 || x > cw + 20 || y > ch + 20) continue;
    const jump = hype > 0.3 ? Math.max(0, Math.sin(t * 9 + q.ph)) * hype : 0, bob = 1 + Math.sin(t * 2 + q.ph) * 0.03 + jump * 0.22;
    const a = Math.atan2(H / 2 - q.y, W / 2 - q.x) + q.turn, w = 0.55 * s * q.size * bob;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);               // repère du spectateur : x vers le terrain
    if (q.chair) { ctx.fillStyle = q.chairC; ctx.fillRect(-w * 1.25, -w * 0.95, w * 1.1, w * 1.9); }   // chaise pliante derrière lui
    softShadow(ctx, w * 0.3, w * 0.4, w * 1.3, 0.25);
    const armsUp = hype > 0.45 || q.fan, clapping = q.clap || hype > 0.2;
    if (armsUp || clapping) {
      const ck = (Math.sin(t * (hype > 0.2 ? 16 : 11) + q.ph) + 1) / 2, reach = armsUp ? 1.35 + Math.sin(t * 10 + q.ph) * 0.15 : 0.75, spread = armsUp ? 0.95 : 0.12 + ck * 0.35;
      ctx.strokeStyle = q.skin; ctx.lineWidth = Math.max(1, w * 0.26); ctx.beginPath();
      for (const sd of [1, -1]) { ctx.moveTo(0, sd * w * 0.62); ctx.lineTo(reach * w, sd * spread * w); }
      ctx.stroke();
    }
    if (q.flag >= 0) {                                            // drapeau tenu en l'air, qui flotte
      const fx = w * 1.2, fy = -w * 0.9, f = Math.sin(t * 6 + q.ph) * w * 0.25;
      ctx.strokeStyle = '#78350f'; ctx.lineWidth = Math.max(1, w * 0.12); ctx.beginPath(); ctx.moveTo(w * 0.5, -w * 0.5); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = tcol(q.flag); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - w * 1.3, fy - w * 0.4 + f); ctx.lineTo(fx - w * 0.1, fy - w * 1.0); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = q.shirt; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.62, w, 0, 0, 7); ctx.fill();
    if (q.stripe) { ctx.save(); ctx.clip(); ctx.fillStyle = q.stripe; for (let k = -2; k <= 2; k++) ctx.fillRect(-w, k * w * 0.42 - w * 0.1, w * 2, w * 0.2); ctx.restore(); }
    const hr = w * 0.48;
    if (q.hat) {
      ctx.fillStyle = q.hat.c; ctx.beginPath(); ctx.arc(-w * 0.05, 0, hr, 0, 7); ctx.fill();
      if (q.hat.brim) { ctx.beginPath(); ctx.ellipse(hr * 0.75, 0, hr * 0.55, hr * 0.7, 0, -Math.PI / 2, Math.PI / 2); ctx.fill(); }   // visière vers le terrain
    } else { ctx.fillStyle = q.hair || q.skin; ctx.beginPath(); ctx.arc(-w * 0.05, 0, hr, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
  CAM.hype = Math.max(0, hype - (FX.dt || 0.016) * 0.28);
}
// herbe qui bouge : des milliers de brins, animés à l'avance. On dessine une fois quelques images d'une « tuile » d'herbe
// (12 m de côté, brins en touffes qui ondulent chacun à leur rythme, en boucle) ; à chaque image du jeu, on recouvre le
// terrain avec la tuile du moment (fondu entre deux images : mouvement fluide). Refait seulement si le vent change.
const GRASS = { frames: null, key: '', T: 12, N: 12, todo: null };
// dense (terrain « Prairie ») : 10 fois plus de brins, plus longs et couvrants — on ne voit plus que l'herbe. Les images
// sont fabriquées une par image du jeu (pas d'à-coup) ; en attendant, la première sert pour toutes.
function grassFrames(dense) {
  const wk = Math.min(1, (G.wind ? G.wind.kmh : 10) / 25), ang = G.wind && G.wind.kmh > 1 ? Math.atan2(G.wind.y, G.wind.x) : 0.3;
  const key = [CAM.S0.toFixed(2), dpr, Math.round(wk * 10), Math.round(ang * 8), dense ? 1 : 0].join('|');
  if (GRASS.key !== key) {
    GRASS.key = key; GRASS.frames = [];
    const u = CAM.S0 * dpr, size = Math.max(64, Math.round(GRASS.T * u)), R = seeded(dense ? 8765 : 4321), tufts = [];
    const GREENS = ['rgba(12,60,24,.55)', 'rgba(170,230,110,.42)'];
    const DENSE = ['#14532d', '#166534', '#15803d', '#16a34a', '#22c55e', '#4d7c0f', '#65a30d', '#3f6212'];
    const n0 = GRASS.T * GRASS.T * (dense ? 8.5 : 0.85);
    for (let i = 0; i < n0; i++) {                                  // touffes de 2 à 4 brins
      const n = 2 + Math.floor(R() * 3), blades = [];
      for (let k = 0; k < n; k++) blades.push({ dx: (R() - 0.5) * 0.3, l: (dense ? 0.35 : 0.22) + R() * (dense ? 0.5 : 0.38), lean: (R() - 0.5) * 0.5, ph: R() * 6.3, amp: 0.6 + R() * 0.8 });
      tufts.push({ x: R() * GRASS.T, y: R() * GRASS.T, blades, col: dense ? Math.floor(R() * DENSE.length) : (R() < 0.5 ? 0 : 1) });
    }
    tufts.sort((a, b) => a.y - b.y);                                // (dense : les brins du bas recouvrent ceux du haut)
    GRASS.todo = { size, u, tufts, wk, ux: Math.cos(ang), uy: Math.sin(ang), cols: dense ? DENSE : GREENS, dense, f: 0 };
  }
  const T = GRASS.todo;
  if (T && T.f < GRASS.N) {                                         // une image de plus à chaque appel
    const cv = document.createElement('canvas'); cv.width = cv.height = T.size;
    const c = cv.getContext('2d'), ph = T.f / GRASS.N * Math.PI * 2, size = T.size, u = T.u;
    c.lineCap = 'round'; c.lineWidth = Math.max(1, u * (T.dense ? 0.08 : 0.06));
    T.cols.forEach((col, ci) => {
      c.strokeStyle = col; c.beginPath();
      for (const q of T.tufts) {
        if (q.col !== ci) continue;
        for (const b of q.blades) {
          const sw = Math.sin(ph + b.ph) * (0.1 + T.wk * 0.38) * b.amp;   // une boucle complète sur les N images
          const bend = b.lean + sw, l = b.l * u;
          for (const [ox, oy] of [[0, 0], [size, 0], [0, size], [-size, 0], [0, -size]]) {   // brins qui débordent : la tuile se raccorde
            const bx = q.x * u + b.dx * u + ox, by = q.y * u + oy;
            if (bx < -l || by < -l * 2 || bx > size + l || by > size + l) continue;
            const tx = bx + (T.ux * bend + b.lean * 0.3) * l, ty = by - l * 0.85 + T.uy * bend * l * 0.6;
            c.moveTo(bx, by); c.quadraticCurveTo(bx + (tx - bx) * 0.35, by - l * 0.5, tx, ty);
          }
        }
      }
      c.stroke();
    });
    GRASS.frames.push(cv); T.f++;
  }
  return GRASS.frames;
}
function drawGrassWind(fid) {
  if (fid === 'plage') { drawSea(); return; }
  if (fid !== 'herbes' && fid !== 'prairie') return;            // (gazon, stade : tondus ras, pas de brins qui dépassent)
  const dense = fid === 'prairie', fr = grassFrames(dense), wk = Math.min(1, (G.wind ? G.wind.kmh : 10) / 25);
  if (!fr.length) return;
  const n = fr.length < GRASS.N ? 1 : GRASS.N;                    // (images pas encore toutes prêtes : la première)
  const pos = (G.time * (0.45 + wk * 0.9) * GRASS.N) % GRASS.N, i = n === 1 ? 0 : Math.floor(pos), k = n === 1 ? 0 : pos - i;   // vitesse selon le vent
  const cw = canvas.width / dpr, ch = canvas.height / dpr;
  const m = typeof DOMMatrix === 'function' ? new DOMMatrix().translate(CAM.ox, CAM.oy).scale(CAM.z / dpr) : null;
  for (const [img, a] of [[fr[i], 1], [fr[(i + 1) % n], k]]) {
    if (!img || a <= 0) continue;
    const pat = ctx.createPattern(img, 'repeat'); if (!pat) continue;
    if (m && pat.setTransform) pat.setTransform(m);
    ctx.globalAlpha = a; ctx.fillStyle = pat; ctx.fillRect(0, 0, cw, ch);
  }
  ctx.globalAlpha = 1;
  if (dense) fieldMarks();
}
// herbe dense : les repères du jeu repassent par-dessus (en-buts, lignes, bricks, plots), sinon on ne les verrait plus
function fieldMarks() {
  const F = fieldTheme(), cele = (G.phase === 'between' || G.phase === 'over') && G.celebrate && (!G.menuShown || G.attract) && G.betweenT > 0 && !G.tuto && !G.practice;
  const tR = (dirOf(0) > 0) !== !!cele ? 0 : 1, s = S;
  ctx.fillStyle = rgba(tcol(tR), 0.22); ctx.fillRect(X(W - EZ), Y(0), EZ * s, H * s);
  ctx.fillStyle = rgba(tcol(1 - tR), 0.22); ctx.fillRect(X(0), Y(0), EZ * s, H * s);
  ctx.strokeStyle = F.line; ctx.lineWidth = Math.max(2, s * 0.16);
  ctx.strokeRect(X(0), Y(0), W * s, H * s);
  ctx.beginPath(); ctx.moveTo(X(EZ), Y(0)); ctx.lineTo(X(EZ), Y(H)); ctx.moveTo(X(W - EZ), Y(0)); ctx.lineTo(X(W - EZ), Y(H)); ctx.stroke();
  const kx = 0.6 * s; ctx.lineWidth = Math.max(2, s * 0.12);
  for (const bx of [EZ + 12, W - EZ - 12]) { ctx.beginPath(); ctx.moveTo(X(bx) - kx, Y(H / 2) - kx); ctx.lineTo(X(bx) + kx, Y(H / 2) + kx); ctx.moveTo(X(bx) + kx, Y(H / 2) - kx); ctx.lineTo(X(bx) - kx, Y(H / 2) + kx); ctx.stroke(); }
  for (const cx of [0, EZ, W - EZ, W]) for (const cy of [0, H]) { ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(X(cx), Y(cy), s * 0.55, 0, 7); ctx.fill(); }
  ctx.fillStyle = F.txt; ctx.font = `700 ${Math.max(11, s * 1.9)}px ${UI_FONT}`; ctx.textAlign = 'center';
  ctx.fillText('LES ' + tn(tR).toUpperCase(), X(W - EZ / 2), Y(H / 2 - 1)); ctx.fillText('MARQUENT ICI', X(W - EZ / 2), Y(H / 2 + 1.6));
  ctx.fillText('LES ' + tn(1 - tR).toUpperCase(), X(EZ / 2), Y(H / 2 - 1)); ctx.fillText('MARQUENT ICI', X(EZ / 2), Y(H / 2 + 1.6));
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
const GROUND_BITS = { prairie: ['#4ade80', '#16a34a', '#86efac'], herbes: ['#4ade80', '#16a34a', '#86efac'], gazon: ['#4ade80', '#16a34a', '#86efac'], stade: ['#22c55e', '#15803d'], plage: ['#e7c98f', '#c9a66b'], terre: ['#fb923c', '#c2410c'], neige: ['#ffffff', '#e2e8f0'], salle: null, espace: null };
function groundFx(p, spd) {
  const cols = GROUND_BITS[styleOf('field')]; if (!cols || G.attract && Math.random() < 0.5) return;
  const dt = FX.dt || 0.016;
  if (p.dive > 0 && spd > 2 && Math.random() < dt * 40) {      // plongeon : des brins giclent derrière lui
    const a = Math.atan2(p.vy, p.vx) + Math.PI + (Math.random() - 0.5) * 1.4, v = 2 + Math.random() * 3;
    FX.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v + p.vx * 0.3, vy: Math.sin(a) * v + p.vy * 0.3, t: 0, life: 0.45 + Math.random() * 0.3,
      color: cols[Math.floor(Math.random() * cols.length)], size: 0.16 + Math.random() * 0.1, kind: 'dot', rot: 0, vr: 0, drag: 3.5 });
  }
  const loose = cols && !['gazon', 'herbes', 'stade', 'prairie'].includes(styleOf('field'));   // sable, terre, neige : petite poussière au sprint
  if (loose && spd > 5 && !(p.dive > 0) && Math.random() < dt * 6)
    FX.parts.push({ x: p.x - p.vx * 0.04, y: p.y - p.vy * 0.04, vx: -p.vx * 0.1, vy: -p.vy * 0.1, t: 0, life: 0.5, color: cols[1] || cols[0], size: 0.32, kind: 'dot', rot: 0, vr: 0, drag: 4 });
}

// ---------- disque vivant ----------
// rotation (rapide en vol, elle ralentit au sol), tremblement d'un lancer imprécis (grand cône), rebond et roulé à
// l'atterrissage : il arrive de 0,9 m en arrière et finit à sa place exacte
const DL = { spin: 0, mode: '', land: null };
function discLife() {
  const dt = FX.dt || 0.016, air = disc.mode === 'air';
  if (DL.mode === 'air' && disc.mode === 'ground') {                 // (attrapé ou point marqué : pas de rebond)
    const vx = disc.ex - disc.cx, vy = disc.ey - disc.cy, l = Math.hypot(vx, vy) || 1;
    DL.land = { t: 0, ux: vx / l, uy: vy / l };
  }
  if (disc.mode !== 'ground') DL.land = null;
  DL.mode = disc.mode;
  const sp = air ? 16 + Math.min(14, discLen() * 0.25) : DL.land && DL.land.t < 0.7 ? 9 * (1 - DL.land.t / 0.7) : 0;
  DL.spin = (DL.spin + dt * sp) % (Math.PI * 200);
  let ox = 0, oy = 0, hop = 0;
  if (DL.land) {
    const L = DL.land, k = Math.min(1, L.t / 0.7), e = 1 - Math.pow(1 - k, 3);
    ox = -L.ux * 0.9 * (1 - e); oy = -L.uy * 0.9 * (1 - e);
    hop = L.t < 0.45 ? Math.abs(Math.sin(L.t / 0.45 * Math.PI * 2)) * 0.35 * (1 - L.t / 0.45) : 0;
    L.t += dt;
  }
  const wob = air && !disc.pull ? clamp(((disc.cone || 0) - 1.5) / 6, 0, 1) * 0.16 * Math.sin(G.time * 24) : 0;
  return { spin: DL.spin, ox, oy, hop, wob };
}

// ---------- vent visible : drapeaux aux coins du terrain, feuilles par grand vent ----------
const LEAVES = [];
function drawWindLife(fid) {
  if (fid === 'espace' || fid === 'salle') return;
  const t = G.time, dt = FX.dt || 0.016, wv = G.wind || { x: 0, y: 0, kmh: 0 }, kmh = wv.kmh || 0;
  const ang = kmh > 0.5 ? Math.atan2(wv.y, wv.x) : Math.PI / 2, wk = Math.min(1, kmh / 30), s = S;
  // drapeaux : le tissu part dans le sens du vent ; il pend presque sans vent, claque et ondule quand ça souffle
  for (const [fx, fy] of [[-0.9, -0.9], [W + 0.9, -0.9], [-0.9, H + 0.9], [W + 0.9, H + 0.9]]) {
    const px = X(fx), py = Y(fy), len = (1.7 + wk * 1.3) * s, wid = 1.1 * s;
    const a = ang + Math.sin(t * (2 + wk * 6) + fx) * (0.12 + wk * 0.12) * (kmh < 2 ? 0.2 : 1), ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    softShadow(ctx, px + s * 0.25, py + s * 0.3, s * 0.35, 0.35);
    ctx.fillStyle = (fx < 0) === (fy < 0) ? '#facc15' : '#ef4444';
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let k = 0; k <= 6; k++) {                               // bord ondulé du tissu
      const u = k / 6, w = Math.sin(u * 5 - t * (6 + wk * 10)) * wid * 0.18 * (0.3 + wk) * u;
      ctx.lineTo(px + ca * len * u + nx * w, py + sa * len * u + ny * w);
    }
    ctx.lineTo(px + nx * wid * (1 - 0.15 * wk), py + ny * wid * (1 - 0.15 * wk));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, Math.max(2, s * 0.24), 0, 7); ctx.fill(); ctx.stroke();   // le poteau, vu d'en haut
  }
  // feuilles : seulement par vent fort, elles traversent le terrain en tourbillonnant
  if (kmh > 15 && !G.attract && LEAVES.length < 22 && Math.random() < dt * (kmh - 12) * 0.12) {
    const ux = Math.cos(ang), uy = Math.sin(ang), along = Math.random();
    const sx = ux > 0 ? -M : W + M, sy = uy > 0 ? -M : H + M;     // elles entrent par le côté d'où vient le vent
    const fromSide = Math.abs(ux) > Math.abs(uy) ? Math.random() < 0.8 : Math.random() < 0.2;
    LEAVES.push({ x: fromSide ? sx : -M + along * (W + 2 * M), y: fromSide ? -M + along * (H + 2 * M) : sy, r: Math.random() * 6, vr: (Math.random() - 0.5) * 6,
      c: ['#a16207', '#ca8a04', '#9a3412', '#65a30d'][Math.floor(Math.random() * 4)], ph: Math.random() * 6, sz: 0.25 + Math.random() * 0.15 });
  }
  for (let i = LEAVES.length - 1; i >= 0; i--) {
    const L = LEAVES[i], v = kmh / 3.6 * 0.55;
    L.x += (Math.cos(ang) * v + Math.sin(t * 2 + L.ph) * 0.8) * dt; L.y += (Math.sin(ang) * v + Math.cos(t * 1.7 + L.ph) * 0.8) * dt; L.r += L.vr * dt;
    if (L.x < -M - 2 || L.x > W + M + 2 || L.y < -M - 2 || L.y > H + M + 2 || kmh < 10) { LEAVES.splice(i, 1); continue; }
    const x = X(L.x), y = Y(L.y), w = L.sz * s;
    ctx.save(); ctx.translate(x, y); ctx.rotate(L.r); ctx.fillStyle = L.c;
    ctx.beginPath(); ctx.ellipse(0, 0, w, w * 0.5 * Math.abs(Math.cos(t * 3 + L.ph)) + w * 0.12, 0, 0, 7); ctx.fill(); ctx.restore();
  }
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
