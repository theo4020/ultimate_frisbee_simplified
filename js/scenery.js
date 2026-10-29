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

// abords : tout reste dans la marge (M = 2 m) autour des lignes, discret, sous les joueurs
function paintSurroundings(c, F, fid, px, py, S0, cw, ch) {
  const s = S0, R = seeded(4242);
  const rr = (x, y, w, h, r, fill) => { c.fillStyle = fill; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fill(); };
  const top = -M * 0.62, bot = H + M * 0.62;                     // au milieu de la marge, en haut et en bas
  if (fid === 'stade') {                                         // panneaux autour du terrain
    const band = M * 0.42 * s, txt = ['ULTIMATE', 'SPIRIT OF THE GAME', 'FAIR-PLAY', 'ULTIMATE FRISBEE'];
    c.font = `800 ${Math.max(8, band * 0.62)}px ${UI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const y of [0, ch - band]) for (let i = 0, x = 0; x < cw; i++, x += cw / 6) {
      rr(x + 2, y + 1, cw / 6 - 4, band - 2, 3, i % 2 ? '#1e3a8a' : '#0f172a');
      c.fillStyle = i % 2 ? '#bfdbfe' : '#facc15'; c.fillText(txt[i % txt.length], x + cw / 12, y + band / 2 + 1);
    }
    c.textBaseline = 'alphabetic';
  }
  if (fid === 'plage') {                                         // la mer en haut : écume
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1.5, s * 0.12);
    for (let k = 0; k < 2; k++) { c.beginPath(); for (let x = 0; x <= cw; x += 6) { const y = py(-M * (0.35 + k * 0.3)) + Math.sin(x / (s * 2.2) + k * 1.7) * s * 0.18; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
    for (const [x, col] of [[18, '#f472b6'], [52, '#facc15'], [80, '#22d3ee']]) {   // serviettes rayées et parasols, en bas
      const X0 = px(x), Y0 = py(H + 0.35), w = 1.2 * s, h = 1.5 * s;
      rr(X0, Y0, w, h, 2, col); c.fillStyle = 'rgba(255,255,255,.7)'; for (let j = 1; j < 4; j += 2) c.fillRect(X0, Y0 + h * j / 4, w, h / 8);
      softShadow(c, px(x + 2.4) + s * 0.4, py(H + 1.1) + s * 0.5, s * 1.1, 0.25);
      for (let j = 0; j < 8; j++) { c.fillStyle = j % 2 ? '#fff' : col; c.beginPath(); c.moveTo(px(x + 2.4), py(H + 1.1)); c.arc(px(x + 2.4), py(H + 1.1), s * 0.95, j * Math.PI / 4, (j + 1) * Math.PI / 4); c.fill(); }
    }
    return;
  }
  if (fid === 'neige') {                                         // congères le long des côtés
    for (const y of [-M * 0.75, H + M * 0.75]) for (let x = -1; x < W + 2; x += 2.6 + R() * 2) {
      softShadow(c, px(x) + s * 0.4, py(y) + s * 0.5, s * (0.9 + R() * 0.6), 0.12);
      c.fillStyle = '#f8fafc'; c.beginPath(); c.arc(px(x), py(y), s * (0.7 + R() * 0.55), 0, 7); c.fill();
    }
    return;
  }
  if (fid === 'espace') return;
  // banc des remplaçants de chaque équipe (en haut : équipe 0, en bas : équipe 1), sacs, gourdes, disques de rechange
  for (const [t, y] of [[0, top], [1, bot]]) {
    const bx = W / 2 - 4 + (t ? 3 : -3), Y0 = py(y) - 0.32 * s;
    softShadow(c, px(bx + 3) + s * 0.4, Y0 + s * 0.6, s * 3.2, 0.18);
    rr(px(bx), Y0, 6 * s, 0.64 * s, 3, '#475569'); rr(px(bx), Y0, 6 * s, 0.22 * s, 3, '#64748b');
    for (let j = 0; j < 3; j++) {                                 // remplaçants (vus de dessus : épaules et tête)
      const x = px(bx + 1 + j * 2), yy = Y0 + 0.32 * s;
      c.fillStyle = tcol(t); c.beginPath(); c.ellipse(x, yy, 0.62 * s, 0.38 * s, 0, 0, 7); c.fill();
      c.fillStyle = HAIR[(j + t * 2) % HAIR.length]; c.beginPath(); c.arc(x, yy, 0.28 * s, 0, 7); c.fill();
    }
    for (let j = 0; j < 3; j++) {                                 // sacs aux couleurs de l'équipe
      const x = px(bx - 2.2 - j * 1.4 + R() * 0.3), yy = py(y) - 0.25 * s;
      softShadow(c, x + s * 0.55, yy + s * 0.55, s * 0.7, 0.2);
      rr(x, yy, 0.9 * s, 0.6 * s, 0.2 * s, j === 1 ? '#334155' : tdark(t)); rr(x + 0.15 * s, yy + 0.1 * s, 0.6 * s, 0.18 * s, 0.08 * s, 'rgba(255,255,255,.18)');
    }
    for (let j = 0; j < 2; j++) {                                 // gourdes
      const x = px(bx + 6.6 + j * 0.6), yy = py(y);
      c.fillStyle = j ? '#38bdf8' : '#e2e8f0'; c.beginPath(); c.arc(x, yy, 0.2 * s, 0, 7); c.fill();
      c.fillStyle = '#0f172a'; c.beginPath(); c.arc(x, yy, 0.09 * s, 0, 7); c.fill();
    }
    const dx = px(bx + 8.2), dy = py(y);                          // pile de disques
    for (let j = 0; j < 3; j++) { c.fillStyle = ['#f8fafc', '#facc15', '#f97316'][j]; c.strokeStyle = 'rgba(15,23,42,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(dx + j * 0.12 * s, dy - j * 0.1 * s, 0.42 * s, 0, 7); c.fill(); c.stroke(); }
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
