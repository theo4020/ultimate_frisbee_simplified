// render.js — Rendu du terrain, des joueurs, du disque et des repères

// =====================================================================
//  Rendu
// =====================================================================
// en ligne : visée d'un coéquipier humain qui a le disque (visible seulement par son équipe)
function allyAim() {
  if (!G.net || G.phase !== 'play' || disc.mode !== 'held' || !disc.holder || disc.holder.team !== G.me || G.spectator) return null;
  const th = throwerHuman();
  if (!th || th.id === G.myId) return null;
  const a = G.net === 'guest' ? G.netAim : (() => { const i = inputOf(th); return i.aim ? { x: i.x, y: i.y, curve: i.curve || 0, kind: i.high ? 'high' : 'normal', aiming: !!i.aiming } : null; })();
  return a && isFinite(a.x) && isFinite(a.y) ? a : null;
}
function drawAim(h, px, py, curve, kind, aiming, ally) {
  const K = THROWS[kind] || THROWS.normal; kind = THROWS[kind] ? kind : 'normal';
  let tx = px, ty = py, dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 0.01;
  if (d > K.max) { tx = h.x + dx / d * K.max; ty = h.y + dy / d * K.max; d = K.max; }
  if (d < K.min && d >= CANCEL_R) { tx = h.x + dx / d * K.min; ty = h.y + dy / d * K.min; d = K.min; }
  const [sx, sy] = releasePoint(h, tx, ty), [cx, cy] = ctrlFor(sx, sy, tx, ty, curve);
  const dur = throwDur(h.x, h.y, tx, ty, kind);
  const [wx, wy] = drift(dur, kind), ex = tx + wx, ey = ty + wy;
  ctx.save();
  const cancel = aiming && dist(px, py, h.x, h.y) < CANCEL_R;
  ctx.globalAlpha = (cancel ? 0.3 : !ally && kindLocked() ? 0.35 : 1) * (ally ? 0.6 : 1);   // changement de passe en cours : aperçu estompé
  drawFlightPath(sx, sy, cx, cy, ex, ey, peakOf(dur, kind), 0, aiming ? 0.95 : 0.7, aiming ? 3 : 2, kind === 'high' ? [2, 5] : [6, 5], kind, curve);
  ctx.strokeStyle = aiming ? 'rgba(250,204,21,.95)' : 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
  const er = throwErr(d, curve, kind) + Math.hypot(wx, wy) * 0.08;
  circle(X(ex), Y(ey), Math.max(er * S, 4)); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fill(); ctx.stroke();
  if (Math.hypot(wx, wy) > 0.6) {                         // croix = point visé, le vent emmène le disque jusqu'au cercle
    ctx.strokeStyle = 'rgba(125,211,252,.9)'; ctx.lineWidth = 2; const k = 5;
    ctx.beginPath(); ctx.moveTo(X(tx) - k, Y(ty) - k); ctx.lineTo(X(tx) + k, Y(ty) + k); ctx.moveTo(X(tx) + k, Y(ty) - k); ctx.lineTo(X(tx) - k, Y(ty) + k); ctx.stroke();
  }
  if (kind !== 'normal') {                                  // rappel du type de lancer choisi
    ctx.font = `800 ${Math.max(10, S * 1.3)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#facc15';
    ctx.fillText(K.name.toUpperCase(), X(ex), Y(ey) - Math.max(er * S, 4) - 4);
  }
  ctx.restore();
}
function canThrow() { const h = throwerHuman(); return G.phase === 'play' && !!h && h.id === G.myId; }
function defending() { return G.phase === 'play' && G.off !== G.me; }
// couleur selon la hauteur : rouge = contrable (même en plongeon), jaune = contrable debout,
// rose = seulement en sautant, bleu = trop haut
// palette Okabe-Ito, lisible par les daltoniens : vermillon, jaune, rose, bleu ciel
const HC = ['213,94,0', '240,228,66', '204,121,167', '86,180,233'];
function heightColor(z, a) {
  const c = HC;
  return `rgba(${z < REACH_DIVE ? c[0] : z < REACH_STAND ? c[1] : z < REACH_STAND + JUMP_H ? c[2] : c[3]},${a})`;
}
function drawFlightPath(sx, sy, cx, cy, ex, ey, peak, u0, alpha, width, dash, kind, curve) {
  const step = 0.025, len = dist(sx, sy, ex, ey), iso = isoView(), keep = isoText;
  if (iso) {                                                 // vue inclinée : l'ombre de la trajectoire au sol…
    ctx.save(); ctx.strokeStyle = `rgba(10,30,18,${0.55 * alpha})`; ctx.lineWidth = width + 1; ctx.lineCap = 'round'; ctx.beginPath();
    for (let u = u0; u <= 1.0001; u += step) { const [x, y] = bez(sx, sy, cx, cy, ex, ey, Math.min(1, u)); if (u === u0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y)); }
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * alpha})`; ctx.lineWidth = 2;   // point d'arrivée au sol : une croix
    const q = 0.7 * S; ctx.beginPath(); ctx.moveTo(X(ex) - q, Y(ey) - q); ctx.lineTo(X(ex) + q, Y(ey) + q); ctx.moveTo(X(ex) + q, Y(ey) - q); ctx.lineTo(X(ex) - q, Y(ey) + q); ctx.stroke();
    ctx.restore();
  }
  ctx.save(); if (iso) screenT();                             // … et la trajectoire elle-même, à sa vraie hauteur
  ctx.lineWidth = width; ctx.lineCap = 'round'; if (dash) ctx.setLineDash(dash);
  const P = u => { const [x, y] = bez(sx, sy, cx, cy, ex, ey, Math.min(1, u)); return iso ? [X(x), IY(y, heightAt(Math.min(1, u), peak, kind, len, curve))] : [X(x), Y(y)]; };
  let [px, py] = P(u0);
  for (let u = u0 + step; u <= 1.0001; u += step) {
    const [x, y] = P(u), um = u - step / 2;
    ctx.strokeStyle = heightColor(heightAt(um, peak, kind, len, curve), alpha);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
    px = x; py = y;
  }
  ctx.restore(); isoText = keep;
}
function drawHeightLegend() {
  const fs = Math.max(9, S * 1.15), x0 = X(0.8), y0 = Y(0.8) + fs;
  ctx.save(); ctx.font = `600 ${fs}px system-ui`; ctx.textAlign = 'left';
  const items = [['contrable', REACH_DIVE - 0.1], ['debout seulement', REACH_STAND - 0.1], ['en sautant', REACH_STAND + JUMP_H * 0.5], ['trop haut', REACH_STAND + JUMP_H + 0.5]];
  let x = x0;
  ctx.fillStyle = 'rgba(15,23,42,.55)';
  const wTot = items.reduce((w, [t]) => w + ctx.measureText(t).width + fs * 1.8, fs * 0.6);
  ctx.fillRect(x0 - fs * 0.4, y0 - fs * 1.05, wTot, fs * 1.5);
  for (const [t, z] of items) {
    ctx.fillStyle = heightColor(z, 1); circle(x + fs * 0.35, y0 - fs * 0.32, fs * 0.35); ctx.fill();
    ctx.fillStyle = '#e2e8f0'; ctx.fillText(t, x + fs * 0.9, y0);
    x += ctx.measureText(t).width + fs * 1.8;
  }
  ctx.restore();
}
// bulles du chat rapide (en ligne) : au-dessus du joueur de la personne, sinon en haut du terrain
function drawEmotes() {
  if (!G.emotes.length) return;
  G.emotes = G.emotes.filter(e => G.time - e.t < 2.6);
  let free = 0;
  ctx.save(); ctx.textAlign = 'center';
  for (const e of G.emotes) {
    const h = humanById(e.id), p = h && h.sel;
    const a = Math.min(1, (2.6 - (G.time - e.t)) * 2), fs = Math.max(13, S * 1.9);
    let x, y;
    if (p) { x = X(p.x); y = Y(p.y) - 1.9 * S - fs * 0.6; }
    else { x = X(W / 2) + (free++ - 0.5) * fs * 5; y = Y(H - 2.5); }
    const txt = (h ? humanLabel(h) + ' ' : '') + e.e;
    ctx.font = `800 ${fs}px system-ui`;
    const w = ctx.measureText(txt).width + fs;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - fs * 1.05, w, fs * 1.5, fs * 0.5) : ctx.rect(x - w / 2, y - fs * 1.05, w, fs * 1.5); ctx.fill();
    ctx.fillStyle = h && h.team >= 0 ? tdark(h.team) : '#0f172a'; ctx.fillText(txt, x, y);
  }
  ctx.restore();
}
// état visuel du saut : -1 = accroupi (préparation), sinon hauteur gagnée en l'air
const jumpVis = p => (G.net === 'guest' ? (p.lift || 0) : p.jprep > 0 ? -1 : jumpLift(p));
// ---------- joueurs vus de dessus : épaules (maillot), tête, bras, numéro ----------
const SKIN = ['#f1c7a3', '#d9a37a', '#a8714f', '#7a4b32', '#e8b88f'];
const HAIR = ['#3b2f2a', '#1f2937', '#a16207', '#7c2d12', '#57534e'];
// orientation lissée : sens de la course, sinon vers le disque (ou vers la cible pendant un lancer)
function faceOf(p) {
  let target;
  if (p.throwT > 0 && p.throwA !== undefined) target = p.throwA;
  else if (Math.hypot(p.vx, p.vy) > 0.8) target = Math.atan2(p.vy, p.vx);
  else target = Math.atan2(disc.y - p.y, disc.x - p.x) || 0;
  if (p.face === undefined || isNaN(p.face)) p.face = target;
  const d = Math.atan2(Math.sin(target - p.face), Math.cos(target - p.face));
  p.face += d * Math.min(1, (FX.dt || 0.016) * 12);
  return p.face;
}
function roundRectPath(x, y, w, h, rr) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, rr); else ctx.rect(x, y, w, h);
}
// lying = plongeon / au sol ; scale = saut (plus gros) ou accroupi (plus petit)
// le porteur se penche (corps décalé) du côté de son pied de pivot, comme le disque dans sa main
function pivLean(p) {
  if (p !== disc.holder || disc.mode !== 'held' || !p.pivY) return [0, 0];
  const [bx, by] = pivotAxis(p), k = p.pivY * PIVOT_R * 0.38;
  return [bx * k, by * k];
}
function drawBody(p, x, y, r, face, o) {
  const k = (p.team * 5 + p.i) % 5, light = (G.teams[p.team] || {}).color === 'blanc' || (G.teams[p.team] || {}).color === 'jaune';
  ctx.save(); ctx.translate(x, y); ctx.rotate(face); ctx.scale(o.scale || 1, o.scale || 1);
  ctx.lineCap = 'round';
  const arm = (x1, y1, x2, y2) => { ctx.strokeStyle = SKIN[k]; ctx.lineWidth = r * 0.36; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  if (o.lying) {                                            // allongé, bras tendus vers l'avant
    arm(r * 0.5, -r * 0.45, r * 1.9, -r * 0.35); arm(r * 0.5, r * 0.45, r * 1.9, r * 0.35);
    ctx.fillStyle = tcol(p.team); ctx.strokeStyle = tdark(p.team); ctx.lineWidth = 2;
    roundRectPath(-r * 1.3, -r * 0.62, r * 2.2, r * 1.24, r * 0.6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = HAIR[k]; circle(r * 1.05, 0, r * 0.45); ctx.fill();
  } else {
    const sw = o.swing || 0;                                // balancement des bras en courant
    if (o.throwing) { arm(0, r * 0.85, r * 1.75, r * 0.55); arm(0, -r * 0.85, -r * 0.3, -r * 1.15); }
    else if (o.jumping) { arm(0, r * 0.8, r * 0.5, r * 1.5); arm(0, -r * 0.8, r * 0.5, -r * 1.5); }
    else { arm(0, r * 0.85, sw * r * 0.75, r * 1.12); arm(0, -r * 0.85, -sw * r * 0.75, -r * 1.12); }
    ctx.fillStyle = tcol(p.team); ctx.strokeStyle = tdark(p.team); ctx.lineWidth = 2;
    roundRectPath(-r * 0.58, -r * 1.05, r * 1.16, r * 2.1, r * 0.56); ctx.fill(); ctx.stroke();
    if (r >= 8) {                                           // numéro dans le dos
      ctx.save(); ctx.rotate(-face); ctx.fillStyle = light ? 'rgba(15,23,42,.75)' : 'rgba(255,255,255,.85)';
      ctx.font = `800 ${Math.round(r * 0.78)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const bx = -Math.cos(face) * r * 0.62, by = -Math.sin(face) * r * 0.62;
      ctx.fillText(String(p.i + 1), bx, by); ctx.restore();
    }
    ctx.fillStyle = HAIR[k]; circle(r * 0.12, 0, r * 0.5); ctx.fill();
  }
  ctx.restore();
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }

// ---------- vue inclinée (côté tribune) ----------
// Le sol est dessiné avec une transformation qui l'aplatit (groundT) : tout ce qui est « au sol » marche sans changement.
// Les textes sont redressés ; les joueurs debout, le disque en l'air et sa trajectoire sont dessinés à l'écran (screenT),
// à leur hauteur réelle (IY).
let isoText = false;
const CTX_FILL = ctx.fillText;
ctx.fillText = function (t, x, y, w) {
  if (!isoText) return w === undefined ? CTX_FILL.call(this, t, x, y) : CTX_FILL.call(this, t, x, y, w);
  this.save(); this.translate(x, y); this.scale(1, 1 / isoK);
  if (w === undefined) CTX_FILL.call(this, t, 0, 0); else CTX_FILL.call(this, t, 0, 0, w);
  this.restore();
};
function groundT() {
  if (isoView()) { ctx.setTransform(dpr, 0, 0, dpr * isoK, 0, dpr * ISO_HEAD * S); isoText = true; }
  else { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); isoText = false; }
}
function screenT() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); isoText = false; }
function inScreen(fn) { const t = isoText; ctx.save(); screenT(); try { fn(); } finally { ctx.restore(); isoText = t; } }
// joueurs en vue inclinée : le même personnage chibi que vu de dessus (maillot arrondi aux couleurs de l'équipe,
// grosse tête, cheveux, bras courts), vu de face ou de dos selon où il regarde ; (sx, sy) = ses pieds à l'écran
function drawChibi(p, sx, sy, r, face, o) {
  const k = (p.team * 5 + p.i) % 5, u = r * (o.scale || 1), sw = o.swing || 0;
  const fx = Math.cos(face), back = Math.sin(face) < -0.25;   // il regarde vers le fond : on le voit de dos
  const light = (G.teams[p.team] || {}).color === 'blanc' || (G.teams[p.team] || {}).color === 'jaune';
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = Math.max(2, u * 0.26);                 // jambes courtes
  ctx.beginPath(); ctx.moveTo(sx - u * 0.22, sy - u * 0.35); ctx.lineTo(sx - u * 0.24 - sw * u * 0.14, sy - u * 0.05);
  ctx.moveTo(sx + u * 0.22, sy - u * 0.35); ctx.lineTo(sx + u * 0.24 + sw * u * 0.14, sy - u * 0.05); ctx.stroke();
  const arm = (ax, ay, bx, by) => { ctx.strokeStyle = SKIN[k]; ctx.lineWidth = Math.max(2, u * 0.26); ctx.beginPath(); ctx.moveTo(sx + ax * u, sy - ay * u); ctx.lineTo(sx + bx * u, sy - by * u); ctx.stroke(); };
  if (o.jumping) { arm(-0.45, 0.95, -0.6, 1.75); arm(0.45, 0.95, 0.6, 1.75); }      // bras levés
  else if (o.throwing) { arm(-0.45 * fx, 0.9, -0.62 * fx, 0.55); arm(0.45 * fx, 0.9, 1.05 * fx, 0.85); }
  else { arm(-0.48, 0.9, -0.62 - sw * 0.2, 0.5); arm(0.48, 0.9, 0.62 + sw * 0.2, 0.5); }
  ctx.fillStyle = tcol(p.team); ctx.strokeStyle = tdark(p.team); ctx.lineWidth = 2;   // maillot arrondi
  roundRectPath(sx - u * 0.52, sy - u * 1.18, u * 1.04, u * 0.86, u * 0.4); ctx.fill(); ctx.stroke();
  if (u >= 8) {                                              // numéro (dans le dos, ou sur le ventre)
    ctx.fillStyle = light ? 'rgba(15,23,42,.75)' : 'rgba(255,255,255,.9)'; ctx.font = `800 ${Math.round(u * 0.5)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(p.i + 1), sx, sy - u * 0.74); ctx.textBaseline = 'alphabetic';
  }
  const hy = sy - u * 1.62, hr = u * 0.56;                   // grosse tête
  ctx.fillStyle = SKIN[k]; circle(sx, hy, hr); ctx.fill();
  ctx.fillStyle = HAIR[k];
  if (back) { circle(sx, hy - u * 0.04, hr * 0.98); ctx.fill(); }                    // de dos : les cheveux
  else {
    ctx.beginPath(); ctx.arc(sx, hy - u * 0.05, hr * 1.0, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();
    const ex = sx + fx * hr * 0.32, ey = hy + hr * 0.12;     // les yeux, tournés vers où il regarde
    ctx.fillStyle = '#0f172a'; circle(ex - hr * 0.25, ey, Math.max(1, hr * 0.11)); ctx.fill(); circle(ex + hr * 0.25, ey, Math.max(1, hr * 0.11)); ctx.fill();
  }
  ctx.restore();
}
function arrow(x1, y1, x2, y2, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke(); ctx.setLineDash([]);
  const a = Math.atan2(y2 - y1, x2 - x1), s = 9;
  ctx.beginPath(); ctx.moveTo(X(x2), Y(y2));
  ctx.lineTo(X(x2) - s * Math.cos(a - 0.45), Y(y2) - s * Math.sin(a - 0.45));
  ctx.lineTo(X(x2) - s * Math.cos(a + 0.45), Y(y2) - s * Math.sin(a + 0.45)); ctx.fill();
  ctx.restore();
}

// vue inclinée : le disque à sa hauteur (en main, en l'air, levé pour une passe haute), son ombre au sol
function drawIsoDisc(dx, dy, tell) {
  const z = disc.mode === 'air' ? disc.z : tell ? 2.6 : disc.mode === 'held' || disc.mode === 'carry' ? 0.7 : 0.05;   // en main : à hauteur des mains du personnage
  if (disc.mode === 'air') {                                 // au sol : ombre nette (plus petite et plus pâle quand il est haut) et anneau de hauteur
    const hz = Math.min(1, disc.z / 6);
    ctx.fillStyle = `rgba(0,0,0,${0.6 - 0.3 * hz})`; circle(X(dx), Y(dy), (0.75 - 0.25 * hz) * S); ctx.fill();
    ctx.strokeStyle = '#0b1d12'; ctx.lineWidth = 4.5; circle(X(dx), Y(dy), 1.15 * S); ctx.stroke();
    ctx.strokeStyle = heightColor(disc.z, 1); ctx.lineWidth = 2.5; circle(X(dx), Y(dy), 1.15 * S); ctx.stroke();
  }
  inScreen(() => {
    const sx = X(dx), sy = IY(dy, z);
    if (disc.mode === 'air' || tell) {                       // trait vertical plein jusqu'au sol : on lit la hauteur et l'endroit
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(11,29,18,.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx, IY(dy, 0)); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.strokeStyle = disc.mode === 'air' ? heightColor(disc.z, 1) : 'rgba(196,181,253,.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, IY(dy, 0)); ctx.lineTo(sx, sy); ctx.stroke();
    }
    if (tell) {
      ctx.strokeStyle = 'rgba(196,181,253,.95)'; ctx.lineWidth = 2.5; circle(sx, sy, 0.95 * S + Math.sin(G.time * 14) * 2); ctx.stroke();
      ctx.font = `800 ${Math.max(10, S * 1.25)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#ddd6fe';
      ctx.fillText('↑ passe haute', sx, sy - S * 1.6);
    }
    const rd = 0.6 * S * (1 + Math.min(z, 6) * 0.05);
    ctx.beginPath(); ctx.ellipse(sx, sy, rd * 1.3, rd * 0.65, 0, 0, Math.PI * 2);    // un disque vu de biais, bien contrasté
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.stroke();
  });
}
function drawField() {
  const cw = canvas.width / dpr, ch = canvas.height / dpr;
  ctx.fillStyle = '#1a6b35'; ctx.fillRect(0, 0, cw, ch);
  if (FX.shake > 0) ctx.translate((Math.random() - 0.5) * FX.shake, (Math.random() - 0.5) * FX.shake);   // secousse
  for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? '#1f7a3d' : '#22843f'; ctx.fillRect(X(i * 10), Y(0), 10 * S, H * S); }
  ctx.fillStyle = rgba(tcol(0), 0.22); ctx.fillRect(X(W - EZ), Y(0), EZ * S, H * S);
  ctx.fillStyle = rgba(tcol(1), 0.22); ctx.fillRect(X(0), Y(0), EZ * S, H * S);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = `600 ${Math.max(10, S * 1.6)}px system-ui`; ctx.textAlign = 'center';
  ctx.fillText('Les ' + tn(0), X(W - EZ / 2), Y(H / 2 - 1)); ctx.fillText('marquent ici', X(W - EZ / 2), Y(H / 2 + 1.5));
  ctx.fillText('Les ' + tn(1), X(EZ / 2), Y(H / 2 - 1)); ctx.fillText('marquent ici', X(EZ / 2), Y(H / 2 + 1.5));
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
  ctx.strokeRect(X(0), Y(0), W * S, H * S);
  ctx.beginPath(); ctx.moveTo(X(EZ), Y(0)); ctx.lineTo(X(EZ), Y(H)); ctx.moveTo(X(W - EZ), Y(0)); ctx.lineTo(X(W - EZ), Y(H)); ctx.stroke();
  // points de brick (croix) et plots orange aux coins des en-buts
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; const kx = 0.6 * S;
  for (const bx of [EZ + 12, W - EZ - 12]) { ctx.beginPath(); ctx.moveTo(X(bx) - kx, Y(H / 2) - kx); ctx.lineTo(X(bx) + kx, Y(H / 2) + kx); ctx.moveTo(X(bx) + kx, Y(H / 2) - kx); ctx.lineTo(X(bx) - kx, Y(H / 2) + kx); ctx.stroke(); }
  for (const cx of [0, EZ, W - EZ, W]) for (const cy of [0, H]) {
    ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.moveTo(X(cx), Y(cy) - 0.7 * S); ctx.lineTo(X(cx) + 0.55 * S, Y(cy) + 0.4 * S); ctx.lineTo(X(cx) - 0.55 * S, Y(cy) + 0.4 * S); ctx.closePath(); ctx.fill();
  }
  // léger vignettage
  const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = vg; ctx.fillRect(-20, -20, cw + 40, ch + 40);
}
function draw() {
  const cw = canvas.width / dpr, ch = canvas.height / dpr, iso = isoView();
  screenT();
  if (iso) {                                                 // vue inclinée : au fond, la tribune d'en face
    const g = ctx.createLinearGradient(0, 0, 0, ISO_HEAD * S); g.addColorStop(0, '#0b1220'); g.addColorStop(1, '#14301f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  }
  groundT();
  drawField();

  drawStreaks();
  drawPractice();
  drawTuto();
  const playing = G.phase === 'play';
  const myAttack = playing && G.off === G.me && !G.practice, ME = G.me, mySel = (meH() || {}).sel || null;

  // Ta passe : la zone où la mark peut contrer en se fendant (lancer dedans = risqué) — seulement quand c'est toi qui lances
  if (canThrow() && (!G.tuto || G.tuto.mark)) {
    const mk = markOf(disc.holder);
    if (mk) { ctx.fillStyle = 'rgba(239,68,68,.13)'; ctx.strokeStyle = 'rgba(248,113,113,.45)'; ctx.lineWidth = 1.5;
      circle(X(mk.x), Y(mk.y), (ARM_R + MARK_LUNGE) * S); ctx.fill(); ctx.stroke(); }
  }

  // Structure offensive de ton équipe (repère visuel)
  if (myAttack && disc.mode === 'held') {
    const ord = G.order[ME], dir = dirOf(ME), ax = disc.x, ay = disc.y;
    if (ord.length) {
      const f = formOf(ME), a = cutterSlot(ord[0], ME, ax, ay, dir, f), b = cutterSlot(ord[ord.length - 1], ME, ax, ay, dir, f);
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      if (isColumn(f)) ctx.fillRect(X(Math.min(a.x, b.x) - 1.5), Y(a.y - 1.8), (Math.abs(b.x - a.x) + 3) * S, 3.6 * S);
      else ctx.fillRect(X(a.x - 1.5), Y(1), 3 * S, (H - 2) * S);
    }
  }

  // Zone de stall et break side imposé par la force
  if (playing && disc.mode === 'held' && !G.practice) {
    const h = disc.holder, defT = 1 - G.off, closed = closedOf(defT), dir = dirOf(G.off);
    const counting = G.marker && G.stall > 0;
    ctx.save();
    ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5;
    ctx.strokeStyle = counting ? 'rgba(250,204,21,.75)' : 'rgba(255,255,255,.4)';
    circle(X(h.x), Y(h.y), STALL_R * S); ctx.stroke();
    ctx.restore();
    const straight = forceOf(defT) === 'straight';
    ctx.fillStyle = 'rgba(239,68,68,.16)';
    ctx.beginPath(); ctx.moveTo(X(h.x), Y(h.y));
    if (straight) { const a0 = dir > 0 ? 0 : Math.PI; ctx.arc(X(h.x), Y(h.y), 6 * S, a0 - 0.6, a0 + 0.6); }   // straight up : l'avant est fermé
    else if (closed > 0) ctx.arc(X(h.x), Y(h.y), 6 * S, 0, Math.PI); else ctx.arc(X(h.x), Y(h.y), 6 * S, Math.PI, Math.PI * 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(254,202,202,.85)'; ctx.font = `600 ${Math.max(9, S * 1.2)}px system-ui`; ctx.textAlign = 'center';
    if (straight) ctx.fillText('fermé', X(h.x + dir * 4.6), Y(h.y) + 4);
    else ctx.fillText('break side', X(h.x), Y(h.y + closed * 5.2) + 4);
    if (defT === ME) {                                     // où se placer pour marquer selon ta force
      const [mx, my] = markSpot(defT, h.x, h.y);
      ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(250,204,21,.8)'; ctx.lineWidth = 1.5;
      circle(X(mx), Y(my), 0.8 * S); ctx.stroke(); ctx.restore();
    }
  }

  // Courses en cours de tes coéquipiers
  if (myAttack) for (const p of TEAMS[ME]) {
    if (p.state === 'jab' || p.state === 'cut') arrow(p.x, p.y, p.cx, p.cy, 'rgba(255,255,255,.55)');
    else if (p.role === 'dump' && p.state === 'reset') arrow(p.x, p.y, p.cx, p.cy, 'rgba(250,204,21,.6)');
  }

  // Lien vers ton vis-à-vis en individuelle
  if (defending() && mySel && ['man', 'mix'].includes(defFormOf(ME)) && mySel.match) {
    const a = mySel, b = a.match;
    ctx.save(); ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(250,204,21,.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke(); ctx.restore();
  }

  // Aperçu du lancer (le tien, ou celui d'un coéquipier humain qui vise, en ligne)
  if (canThrow() && G.pointer.active) drawAim(disc.holder, G.pointer.x, G.pointer.y, G.curve, G.throwKind, G.aiming, false);
  else { const A = allyAim(); if (A) drawAim(disc.holder, A.x, A.y, A.curve, A.kind, A.aiming, true); }

  // Trajectoire restante du disque en vol, colorée selon la hauteur
  if (disc.mode === 'air') {
    const u0 = Math.min(1, disc.t / disc.dur);
    drawFlightPath(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, discPeak(), u0, 0.7, 2.5, [5, 4], discKind(), disc.curveV);
  }
  if (playing && (disc.mode === 'air' || (canThrow() && G.pointer.active))) { if (iso) inScreen(drawHeightLegend); else drawHeightLegend(); }

  // Joueurs
  const r = 0.95 * S, swT = switchTarget(meH());
  for (const p of players) {
    const jl = Math.max(0, jumpVis(p)), [lx, ly] = pivLean(p);
    ctx.fillStyle = `rgba(0,0,0,${0.25 - jl * 0.08})`; circle(X(p.x + lx) + 2 + jl * 3, Y(p.y + ly) + 3 + jl * 3, r * (1 - jl * 0.15)); ctx.fill();
  }
  const rings = p => {                                       // repères au sol autour d'un joueur
    if (p === disc.holder && (disc.mode === 'held' || disc.mode === 'carry')) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; circle(X(p.x), Y(p.y), r + 4); ctx.stroke();
    }
    if (myAttack && disc.mode === 'held' && p.team === ME && p !== disc.holder && nearestD(TEAMS[1 - ME], p.x, p.y)[1] > 2.8) {
      ctx.strokeStyle = 'rgba(74,222,128,.95)'; ctx.lineWidth = 2.5; circle(X(p.x), Y(p.y), r + 3); ctx.stroke();
    }
    if (p === mySel && playing) { ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; circle(X(p.x), Y(p.y), r + 5); ctx.stroke(); }
    if (p === G.dbl && disc.mode === 'held') {                // défenseur en double team
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = '#f87171'; ctx.lineWidth = 3; circle(X(p.x), Y(p.y), r + 5); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#fca5a5'; ctx.font = `800 ${Math.max(9, S * 1.2)}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText('double team', X(p.x), Y(p.y) + r + Math.max(12, S * 1.6));
    }
    if (p === swT) { ctx.strokeStyle = 'rgba(203,213,225,.85)'; ctx.lineWidth = 3; circle(X(p.x), Y(p.y), r + 5); ctx.stroke(); }
    if (disc.mode === 'air' && p === disc.intended) {
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
      circle(X(p.x), Y(p.y), r + 4); ctx.stroke(); ctx.restore();
    }
  };
  const bodyO = p => {
    const jv = jumpVis(p), jl = Math.max(0, jv), crouch = jv < 0;   // saut : accroupi, puis il grossit et s'élève
    const lying = p.dive > 0 || p.down > 0, face = lying ? (Math.atan2(p.vy, p.vx) || faceOf(p)) : faceOf(p);
    if (lying) p.face = face;
    p.stride = (p.stride || 0) + Math.hypot(p.vx, p.vy) * (FX.dt || 0.016) * 1.6;
    return { jl, lying, face, scale: (1 + jl * 0.22) * (crouch ? 0.84 : 1), throwing: p.throwT > 0, jumping: jl > 0.05, swing: Math.hypot(p.vx, p.vy) > 1 ? Math.sin(p.stride) : 0 };
  };
  if (!iso) for (const p of players) {
    ctx.globalAlpha = p.down > 0 ? 0.6 : 1;
    const o = bodyO(p), hop = celebrateHop(p) * S + o.jl * S * 0.9;   // (et saut de joie après un point)
    const [lx, ly] = pivLean(p);                                // porteur : le corps se penche du côté de son pied de pivot
    drawBody(p, X(p.x + lx), Y(p.y + ly) - hop, r * 1.06, o.face, o);
    ctx.globalAlpha = 1;
    rings(p);
  } else {                                                    // vue inclinée : repères et joueurs au sol, puis les joueurs debout
    const O = new Map(players.map(p => [p, bodyO(p)]));
    for (const p of players) {
      rings(p);
      const o = O.get(p);
      if (o.lying) { ctx.globalAlpha = p.down > 0 ? 0.6 : 1; drawBody(p, X(p.x), Y(p.y), r * 1.06, o.face, o); ctx.globalAlpha = 1; }
    }
    inScreen(() => {
      for (const p of players.slice().sort((a, b) => a.y - b.y)) {   // du fond vers le devant
        const o = O.get(p); if (o.lying) continue;
        const [lx, ly] = pivLean(p), z = o.jl + celebrateHop(p) * 0.6;
        drawChibi(p, X(p.x + lx), IY(p.y + ly, z), r * 0.95, o.face, o);
      }
    });
  }

  // Humains : étiquette (pseudo, ou « J2 ») sous des joueurs contrôlés par d'autres personnes,
  // et numéros 1 à 5 sous tes joueurs (touches du clavier pour en prendre un)
  ctx.textAlign = 'center';
  for (const h of G.humans) {
    if (!h.sel || h.id === G.myId) continue;
    const p = h.sel;
    ctx.font = `800 ${Math.max(10, S * 1.25)}px system-ui`;
    const lw = ctx.measureText(humanLabel(h)).width + S * 0.8;
    ctx.fillStyle = 'rgba(15,23,42,.8)'; ctx.fillRect(X(p.x) - lw / 2, Y(p.y) + r + 2, lw, S * 1.6);
    ctx.fillStyle = tlabel(p.team); ctx.fillText(humanLabel(h), X(p.x), Y(p.y) + r + 2 + S * 1.25);
  }
  drawEmotes();
  if (playing && !isTouchUI() && canSwitchNow(meH())) {
    ctx.font = `700 ${Math.max(9, S * 1.05)}px system-ui`;
    TEAMS[ME].forEach((p, k) => {
      if (takenByOther(p, meH())) return;
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(String(k + 1), X(p.x) + r * 0.95, Y(p.y) + r * 1.25);
    });
  }

  // Repères des plays
  ctx.font = `800 ${Math.max(11, S * 1.6)}px system-ui`; ctx.textAlign = 'center';
  const headY = p => (iso ? IY(p.y, Math.max(0, jumpVis(p))) - r * 2.2 : Y(p.y) - r);   // au-dessus de la tête
  const overHead = fn => (iso ? inScreen(fn) : fn());
  overHead(() => { for (const p of players) {
    if (!p.tag || hiddenFromMe(p.team)) continue;           // en ligne : on ne voit pas qui joue le play adverse
    const label = p.tag === '2d' ? '2' : p.tag;
    ctx.fillStyle = 'rgba(15,23,42,.75)'; circle(X(p.x), headY(p) - 9, Math.max(8, S * 1.1)); ctx.fill();
    ctx.fillStyle = '#facc15'; ctx.fillText(label, X(p.x), headY(p) - 9 + Math.max(4, S * 0.55));
  } });

  // Compte du marqueur
  if (disc.mode === 'held' && G.stall > 0) overHead(() => {
    const n = Math.min(10, Math.floor(G.stall) + 1);
    ctx.fillStyle = n >= 8 ? '#f87171' : '#facc15';
    ctx.font = `700 ${Math.max(12, S * 2)}px system-ui`; ctx.textAlign = 'center';
    ctx.fillText(n, X(disc.x), headY(disc.holder) - 8);
  });

  // remontée du disque : pointillés jusqu'à la ligne / au brick
  if (disc.mode === 'carry' && G.carryTo && disc.holder) {
    ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(disc.holder.x), Y(disc.holder.y)); ctx.lineTo(X(G.carryTo.x), Y(G.carryTo.y)); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,255,255,.9)'; circle(X(G.carryTo.x), Y(G.carryTo.y), 0.45 * S); ctx.fill();
    ctx.font = `600 ${Math.max(9, S * 1.2)}px system-ui`; ctx.textAlign = 'center';
    ctx.fillText('reprise du jeu', X(G.carryTo.x), Y(G.carryTo.y) - 0.9 * S);
    ctx.restore();
  }
  drawTrail();
  // Disque
  if (disc.mode !== 'dead') {
    let dx = disc.x, dy = disc.y;
    const tell = playing && highTell();                     // passe haute en préparation : disque levé au-dessus de la tête
    if ((disc.mode === 'held' || disc.mode === 'carry') && !tell) {   // dans la main : du côté de son pivot (sinon du côté où il regarde)
      const h = disc.holder, pv = disc.mode === 'held' ? h.pivY || 0 : 0;
      const f = h.face !== undefined ? h.face : (dirOf(h.team) > 0 ? 0 : Math.PI);
      const [rx, ry] = releasePoint(h, h.x, h.y), w = Math.min(1, Math.abs(pv) * 1.5);
      dx += (Math.cos(f + 0.5) * 0.95) * (1 - w) + (rx - h.x) * w; dy += (Math.sin(f + 0.5) * 0.95) * (1 - w) + (ry - h.y) * w;
    }
    if (iso) drawIsoDisc(dx, dy, tell);
    else {
    const lift = disc.mode === 'air' ? disc.z * S * 1.2 : tell ? 1.9 * S : 0;
    if (tell) {
      ctx.save(); ctx.strokeStyle = 'rgba(196,181,253,.9)'; ctx.lineWidth = 2; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(X(dx), Y(dy)); ctx.lineTo(X(dx), Y(dy) - lift); ctx.stroke();
      ctx.setLineDash([]); ctx.strokeStyle = 'rgba(196,181,253,.95)'; ctx.lineWidth = 2.5;
      circle(X(dx), Y(dy) - lift, 0.95 * S + Math.sin(G.time * 14) * 2); ctx.stroke();
      ctx.font = `800 ${Math.max(10, S * 1.25)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#ddd6fe';
      ctx.fillText('↑ passe haute', X(dx), Y(dy) - lift - S * 1.3);
      ctx.restore();
    }
    if (disc.mode === 'air') {                                // ombre + anneau coloré = hauteur, trait = altitude
      ctx.fillStyle = 'rgba(0,0,0,.3)'; circle(X(dx), Y(dy), 0.45 * S); ctx.fill();
      ctx.strokeStyle = heightColor(disc.z, 0.95); ctx.lineWidth = 2.5; circle(X(dx), Y(dy), 1.05 * S); ctx.stroke();
      ctx.strokeStyle = heightColor(disc.z, 0.7); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(dx), Y(dy)); ctx.lineTo(X(dx), Y(dy) - lift); ctx.stroke();
    }
    circle(X(dx), Y(dy) - lift, 0.5 * S * (1 + disc.z * 0.12));
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  drawParticles();
  drawPullUI();
  screenT();                                                // la suite (messages) se dessine à l'écran, pas au sol
  const hw = typeof hostWaitMsg === 'function' ? hostWaitMsg() : '';
  if (hw) {                                                   // en ligne : l'hôte ne répond plus pour l'instant
    ctx.save(); ctx.font = `700 ${Math.max(13, S * 1.9)}px system-ui`; ctx.textAlign = 'center';
    const w = ctx.measureText(hw).width + S * 3, y = ch * 0.3;
    ctx.fillStyle = 'rgba(15,23,42,.85)'; ctx.fillRect(cw / 2 - w / 2, y - S * 2.2, w, S * 3.4);
    ctx.fillStyle = '#fde68a'; ctx.fillText(hw, cw / 2, y); ctx.restore();
  }
  if (G.msgT > 0) {                                         // message central, avec un petit effet de « pop »
    const sc = 1 + FX.pop * 0.5 + Math.max(0, G.msgT - 1.5) * 0.6;
    ctx.save(); ctx.translate(cw / 2, G.tuto ? ch * 0.86 : ch / 2); ctx.scale(sc, sc);   // tutoriel : en bas, hors de l'action (au milieu du terrain)
    ctx.globalAlpha = Math.min(1, G.msgT);
    ctx.font = `800 ${Math.max(18, S * 3.4)}px system-ui`; ctx.textAlign = 'center';
    const txt = hiddenFromMe(G.msgTeam) ? G.msgAlt : G.msg;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(txt, 2, 2);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0);
    ctx.restore();
  }
}

