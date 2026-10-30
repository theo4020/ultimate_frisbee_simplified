// render.js — Rendu du terrain, des joueurs, du disque et des repères

// =====================================================================
//  Rendu
// =====================================================================
// en ligne : visée d'un coéquipier humain qui a le disque (visible seulement par son équipe)
function allyAim() {
  if (!G.net || G.phase !== 'play' || disc.mode !== 'held' || !disc.holder || disc.holder.team !== G.me || G.spectator) return null;
  const th = throwerHuman();
  if (!th || th.id === G.myId) return null;
  const a = G.net === 'guest' ? G.netAim : (() => { const i = inputOf(th); return i.aim ? { x: i.x, y: i.y, curve: i.curve || 0, kind: loftOf(i.loft), aiming: !!i.aiming } : null; })();
  return a && isFinite(a.x) && isFinite(a.y) ? a : null;
}
function drawAim(h, px, py, curve, kind, aiming, ally) {
  kind = loftOf(kind); const K = throwK(kind);
  let tx = px, ty = py, dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 0.01;
  if (d > K.max) { tx = h.x + dx / d * K.max; ty = h.y + dy / d * K.max; d = K.max; }
  if (d < K.min && d >= CANCEL_R) { tx = h.x + dx / d * K.min; ty = h.y + dy / d * K.min; d = K.min; }
  const [sx, sy] = releasePoint(h, tx, ty), [cx, cy] = ctrlFor(sx, sy, tx, ty, curve);
  const dur = throwDur(h.x, h.y, tx, ty, kind);
  const [wx, wy] = drift(dur, kind), ex = tx + wx, ey = ty + wy;
  ctx.save();
  const cancel = aiming && dist(px, py, h.x, h.y) < CANCEL_R;
  ctx.globalAlpha = (cancel ? 0.3 : !ally && kindLocked() ? 0.35 : 1) * (ally ? 0.6 : 1);   // changement de passe en cours : aperçu estompé
  // disque en main : la trajectoire et le cercle d'atterrissage (le cône n'apparaît qu'une fois le disque lancé)
  const er = coneR(d, curve, kind, wx, wy);
  drawFlightPath(sx, sy, cx, cy, ex, ey, peakOf(dur, kind), 0, aiming ? 0.95 : 0.7, aiming ? 3 : 2, kind >= LOFT.HIGH ? [2, 5] : [6, 5], kind, curve);
  ctx.strokeStyle = aiming ? 'rgba(250,204,21,.95)' : 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
  circle(X(ex), Y(ey), Math.max(er * S, 4)); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill(); ctx.stroke();
  if (Math.hypot(wx, wy) > 0.6) {                         // croix = point visé, le vent emmène le disque jusqu'au cercle
    ctx.strokeStyle = 'rgba(125,211,252,.9)'; ctx.lineWidth = 2; const k = 5;
    ctx.beginPath(); ctx.moveTo(X(tx) - k, Y(ty) - k); ctx.lineTo(X(tx) + k, Y(ty) + k); ctx.moveTo(X(tx) + k, Y(ty) - k); ctx.lineTo(X(tx) - k, Y(ty) + k); ctx.stroke();
  }
  if (Math.abs(kind - LOFT.N) > 0.04) {                     // rappel de la hauteur choisie
    ctx.font = `800 ${Math.max(10, S * 1.3)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#facc15';
    ctx.fillText('PASSE ' + loftName(kind).toUpperCase(), X(ex), Y(ey) - Math.max(er * S, 4) - 4);
  }
  ctx.restore();
}
// après une réception, il faut un instant (RECV_T s) pour se stabiliser avant de relancer : les enchaînements restent
// naturels, et un clic pensé pour un plongeon juste au moment du catch ne part pas en passe
const RECV_T = 0.45;
function recvReady() {
  if (disc.mode !== 'held' || !disc.holder) { G.recvHolder = null; return false; }
  if (G.recvHolder !== disc.holder) { G.recvHolder = disc.holder; G.recvAt = G.time; }
  return G.time - G.recvAt >= RECV_T || !!G.tuto && !G.tuto.recvWait;
}
function canThrow() { const h = throwerHuman(); return G.phase === 'play' && !!h && h.id === G.myId && !((G.net === 'guest' ? G.netCheck : G.checkT) > 0) && recvReady(); }
function defending() { return G.phase === 'play' && G.off !== G.me; }
// couleur selon la hauteur : rouge = contrable (même en plongeon), jaune = contrable debout,
// rose = seulement en sautant, bleu = trop haut
// palette Okabe-Ito, lisible par les daltoniens : vermillon, jaune, rose, bleu ciel
const HC = ['213,94,0', '240,228,66', '204,121,167', '86,180,233'];
// hauteur du disque levé dans la main selon la passe préparée (m)
const loftZ = l => 1.0 + 1.3 * loftW(l) - 0.25 * loftLow(l);
// jauge de hauteur à côté du porteur (vue par tout le monde, l'adversaire compris) : rasante en bas, passe haute en haut ;
// (sx, sy) = pieds du porteur à l'écran
function drawLoftGauge(h, sx, sy, l) {
  const r = Math.max(10, S * 1.1), gh = Math.max(32, S * 4.2), gw = Math.max(7, S * 0.75);
  const x = sx + r * 1.5 * (h.x > W - 6 ? -1 : 1), y0 = sy - (isoView() ? ISO_HEAD * 0.35 * S : 0) - gh * 0.3, top = y0 - gh;
  const fy = y0 - gh * l, ny = y0 - gh * LOFT.N, hot = l >= LOFT.TELL;
  ctx.save();
  ctx.fillStyle = 'rgba(15,23,42,.75)'; ctx.fillRect(x - gw / 2 - 2, top - 2, gw + 4, gh + 4);
  ctx.fillStyle = hot ? '#a78bfa' : l < LOFT.N ? '#7dd3fc' : '#facc15';
  ctx.fillRect(x - gw / 2, fy, gw, y0 - fy);
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5;                         // repère de la passe normale
  ctx.beginPath(); ctx.moveTo(x - gw / 2 - 3, ny); ctx.lineTo(x + gw / 2 + 3, ny); ctx.stroke();
  ctx.font = `800 ${Math.max(10, S * 1.15)}px system-ui`; ctx.textAlign = 'center';
  ctx.fillStyle = hot ? '#ddd6fe' : l < LOFT.N ? '#bae6fd' : '#fef08a';
  ctx.fillText((l < LOFT.N ? '↓ ' : '↑ ') + loftName(l), x, top - 5);
  ctx.restore();
}
function heightColor(z, a) {
  const c = HC;
  return `rgba(${z < REACH_DIVE ? c[0] : z < REACH_STAND ? c[1] : z < REACH_STAND + JUMP_H ? c[2] : c[3]},${a})`;
}
// cône d'incertitude d'une passe en vol : là où le disque peut encore aller. Il part du disque (u0) et s'élargit jusqu'au
// cercle d'arrivée de rayon r ; G_(v) = point au sol de la trajectoire affichée, zf(v) = hauteur (couleur de chaque tranche)
function drawCone(G_, u0, r, alpha, zf) {
  const step = 0.04, L = [], R = [], V = [];
  for (let v = u0; v <= 1.0001; v += step) {
    const vv = Math.min(1, v), [x, y] = G_(vv), [x2, y2] = G_(Math.min(1, vv + 0.01)), [x1, y1] = G_(Math.max(0, vv - 0.01));
    let nx = -(y2 - y1), ny = x2 - x1; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const hw = r * (u0 >= 1 ? 1 : (vv - u0) / (1 - u0));
    L.push([X(x + nx * hw), Y(y + ny * hw)]); R.push([X(x - nx * hw), Y(y - ny * hw)]); V.push(vv);
  }
  const [ex, ey] = G_(1), rr = Math.max(0.25, r) * S, col = (v, a) => (zf ? heightColor(zf(v), a) : `rgba(255,255,255,${a})`);
  ctx.save(); ctx.lineWidth = 1.5;
  for (let i = 0; i + 1 < L.length; i++) {                    // chaque tranche du cône prend la couleur de la hauteur du disque à cet endroit
    const vm = (V[i] + V[i + 1]) / 2;
    ctx.fillStyle = col(vm, (zf ? 0.3 : 0.13) * alpha);
    ctx.beginPath(); ctx.moveTo(L[i][0], L[i][1]); ctx.lineTo(L[i + 1][0], L[i + 1][1]); ctx.lineTo(R[i + 1][0], R[i + 1][1]); ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = col(vm, (zf ? 0.75 : 0.4) * alpha);
    ctx.beginPath(); ctx.moveTo(L[i][0], L[i][1]); ctx.lineTo(L[i + 1][0], L[i + 1][1]); ctx.moveTo(R[i][0], R[i][1]); ctx.lineTo(R[i + 1][0], R[i + 1][1]); ctx.stroke();
  }
  ctx.fillStyle = col(1, 0.22 * alpha); ctx.strokeStyle = zf ? col(1, 0.95 * alpha) : `rgba(255,255,255,${0.85 * alpha})`; ctx.lineWidth = 2;   // cercle d'arrivée
  circle(X(ex), Y(ey), rr); ctx.fill(); ctx.stroke();
  ctx.restore();
}
// trajectoire colorée selon la hauteur (visée du lanceur, pull) ; une passe en vol ne montre que son cône (drawCone)
function drawFlightPath(sx, sy, cx, cy, ex, ey, peak, u0, alpha, width, dash, kind, curve) {
  const step = 0.025, len = dist(sx, sy, ex, ey), iso = isoView(), keep = isoText, wa = kind === 'pull' ? 0 : windAlong(sx, sy, ex, ey);
  const Gp = v => bez(sx, sy, cx, cy, ex, ey, v);
  if (iso) {                                                 // vue inclinée : l'ombre de la trajectoire au sol…
    ctx.save(); ctx.strokeStyle = `rgba(10,30,18,${0.55 * alpha})`; ctx.lineWidth = width + 1; ctx.lineCap = 'round'; ctx.beginPath();
    for (let u = u0; u <= 1.0001; u += step) { const [x, y] = Gp(Math.min(1, u)); if (u === u0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y)); }
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * alpha})`; ctx.lineWidth = 2;   // point d'arrivée au sol : une croix
    const q = 0.7 * S; ctx.beginPath(); ctx.moveTo(X(ex) - q, Y(ey) - q); ctx.lineTo(X(ex) + q, Y(ey) + q); ctx.moveTo(X(ex) + q, Y(ey) - q); ctx.lineTo(X(ex) - q, Y(ey) + q); ctx.stroke();
    ctx.restore();
  }
  ctx.save(); if (iso) screenT();                             // … et la trajectoire elle-même, à sa vraie hauteur
  ctx.lineWidth = width; ctx.lineCap = 'round'; if (dash) ctx.setLineDash(dash);
  const P = u => { const [x, y] = Gp(Math.min(1, u)); return iso ? [X(x), IY(y, heightAt(Math.min(1, u), peak, kind, len, curve, wa))] : [X(x), Y(y)]; };
  let [px, py] = P(u0);
  for (let u = u0 + step; u <= 1.0001; u += step) {
    const [x, y] = P(u), um = u - step / 2;
    ctx.strokeStyle = heightColor(heightAt(um, peak, kind, len, curve, wa), alpha);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
    px = x; py = y;
  }
  ctx.restore(); isoText = keep;
}
function drawHeightLegend() {
  // dans la marge au-dessus du terrain (elle ne cache plus l'en-but ni les joueurs)
  const fs = Math.max(9, Math.min(S * 1.15, S * M / 1.7)), x0 = X(0) + fs * 0.4, y0 = (isoView() ? SY(0) : Y(0)) - fs * 0.5;
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
  const keep = isoText; ctx.save(); screenT(); ctx.textAlign = 'center';   // bulles à l'écran (redressées en vue inclinée)
  for (const e of G.emotes) {
    const h = humanById(e.id), p = h && h.sel;
    const a = Math.min(1, (2.6 - (G.time - e.t)) * 2), fs = Math.max(13, S * 1.9);
    let x, y;
    if (p) { x = X(p.x); y = SY(p.y) - (isoView() ? 2.4 : 1.9) * S - fs * 0.6; }
    else { x = X(W / 2) + (free++ - 0.5) * fs * 5; y = SY(H - 2.5); }
    const txt = (h ? humanLabel(h) + ' ' : '') + e.e;
    ctx.font = `800 ${fs}px system-ui`;
    const w = ctx.measureText(txt).width + fs;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - fs * 1.05, w, fs * 1.5, fs * 0.5) : ctx.rect(x - w / 2, y - fs * 1.05, w, fs * 1.5); ctx.fill();
    ctx.fillStyle = h && h.team >= 0 ? tdark(h.team) : '#0f172a'; ctx.fillText(txt, x, y);
  }
  ctx.restore(); isoText = keep;
}
// état visuel du saut : -1 = accroupi (préparation), sinon hauteur gagnée en l'air
const jumpVis = p => (G.net === 'guest' && !(typeof PRED !== 'undefined' && PRED.p === p) ? (p.lift || 0) : p.jprep > 0 ? -1 : jumpLift(p));   // ton joueur prédit : son propre saut
// ---------- joueurs vus de dessus : épaules (maillot), tête, bras, numéro ----------
// allure de chaque joueur (peau, cheveux, coupe, chaussures) : fixe pour un même joueur, différente d'un joueur à l'autre.
// Même taille pour tous (la coupe reste dans le gabarit de la tête). « Mon style » garde la priorité sur la couleur des cheveux.
const SKIN = ['#f1c7a3', '#d9a37a', '#a8714f', '#7a4b32', '#e8b88f', '#5c3a24', '#c68a5e'];
const HAIR = ['#3b2f2a', '#1f2937', '#a16207', '#7c2d12', '#57534e', '#d6b370', '#0b0b0f'];
const CUTS = ['court', 'long', 'queue', 'rase', 'boucles', 'chignon'];
const SHOES = ['#1e293b', '#f8fafc', '#ef4444', '#22c55e', '#f97316', '#3b82f6', '#facc15', '#a855f7'];
function lookOf(p) {
  const k = p.team * 5 + p.i;
  return p._look && p._look.k === k ? p._look : (p._look = {
    k, skin: SKIN[(k * 3 + 1) % SKIN.length], hair: HAIR[(k * 5 + 2) % HAIR.length], cut: CUTS[(k * 7 + p.team) % CUTS.length],
    shoe: SHOES[(k * 5 + 3) % SHOES.length] });
}
// cheveux vus de dessus, tête au centre (hx, 0), rayon hr, le joueur regarde vers +x
function hairTop(c, L, col, hx, hr) {
  c.fillStyle = col;
  switch (L.cut) {
    case 'long': c.beginPath(); c.ellipse(hx - hr * 0.45, 0, hr * 0.95, hr * 0.92, 0, 0, 7); c.fill(); circle(hx, 0, hr); c.fill(); break;
    case 'queue': c.beginPath(); c.ellipse(hx - hr * 1.12, 0, hr * 0.48, hr * 0.28, 0, 0, 7); c.fill(); circle(hx, 0, hr); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)'; circle(hx - hr * 0.86, 0, hr * 0.14); c.fill(); break;
    case 'rase': c.fillStyle = L.skin; circle(hx, 0, hr); c.fill(); c.globalAlpha = 0.5; c.fillStyle = col; circle(hx - hr * 0.08, 0, hr * 0.88); c.fill(); c.globalAlpha = 1; break;
    case 'boucles': circle(hx, 0, hr * 0.8); c.fill(); for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2; circle(hx + Math.cos(a) * hr * 0.72, Math.sin(a) * hr * 0.72, hr * 0.32); c.fill(); } break;
    case 'chignon': circle(hx, 0, hr); c.fill(); c.fillStyle = 'rgba(0,0,0,.28)'; circle(hx - hr * 0.3, 0, hr * 0.44); c.fill(); c.fillStyle = col; circle(hx - hr * 0.33, -hr * 0.04, hr * 0.36); c.fill(); break;
    default: circle(hx, 0, hr); c.fill();
  }
}
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
  const L = lookOf(p), light = (G.teams[p.team] || {}).color === 'blanc' || (G.teams[p.team] || {}).color === 'jaune';
  ctx.save(); ctx.translate(x, y); ctx.rotate(face); ctx.scale(o.scale || 1, o.scale || 1);
  ctx.lineCap = 'round';
  const arm = (x1, y1, x2, y2) => {                           // bras (peau) avec la main un peu plus foncée
    ctx.strokeStyle = L.skin; ctx.lineWidth = r * 0.36; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.arc(x2, y2, r * 0.17, 0, 7); ctx.fill();
  };
  const armTo = (side, ang, len) => arm(0, side * r * 0.82, Math.cos(ang) * r * len, side * r * 0.82 + Math.sin(ang) * r * len);
  // volume : reflet du soleil (en haut à gauche de l'écran, quelle que soit l'orientation du joueur)
  const shine = (w, h) => { const a = -2.35 - face, g = ctx.createRadialGradient(Math.cos(a) * w * 0.3, Math.sin(a) * h * 0.3, 0, 0, 0, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)'); return g; };
  const head = (hx, hr) => {
    hairTop(ctx, L, hairOf(p, L.hair), hx, hr);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; const a = -2.35 - face; circle(hx + Math.cos(a) * hr * 0.35, Math.sin(a) * hr * 0.35, hr * 0.42); ctx.fill();
  };
  if (o.lying) {                                            // allongé, bras tendus vers l'avant
    arm(r * 0.5, -r * 0.45, r * 1.9, -r * 0.35); arm(r * 0.5, r * 0.45, r * 1.9, r * 0.35);
    ctx.fillStyle = L.shoe; ctx.beginPath(); ctx.ellipse(-r * 1.55, -r * 0.3, r * 0.32, r * 0.18, 0, 0, 7); ctx.ellipse(-r * 1.55, r * 0.3, r * 0.32, r * 0.18, 0, 0, 7); ctx.fill();   // pieds
    ctx.fillStyle = tcol(p.team); ctx.strokeStyle = tdark(p.team); ctx.lineWidth = 2;
    roundRectPath(-r * 1.3, -r * 0.62, r * 2.2, r * 1.24, r * 0.6); ctx.fill();
    if (mineStyle(p)) jerseyPattern(ctx, -r * 1.3, -r * 0.62, r * 2.2, r * 1.24, light);   // maillot de ton équipe (Mon style)
    ctx.fillStyle = shine(r * 1.1, r * 0.62); roundRectPath(-r * 1.3, -r * 0.62, r * 2.2, r * 1.24, r * 0.6); ctx.fill();
    roundRectPath(-r * 1.3, -r * 0.62, r * 2.2, r * 1.24, r * 0.6); ctx.stroke();
    head(r * 1.05, r * 0.45);
  } else {
    const sw = o.swing || 0, run = o.run || 0;
    // pieds : ils avancent l'un après l'autre en courant, côte à côte à l'arrêt
    const st = Math.sin(o.stride || 0) * r * 0.95 * run;
    ctx.fillStyle = L.shoe; ctx.strokeStyle = 'rgba(15,23,42,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(st, r * 0.34, r * 0.36, r * 0.21, 0, 0, 7); ctx.ellipse(-st, -r * 0.34, r * 0.36, r * 0.21, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(st + r * 0.14, r * 0.34, r * 0.13, r * 0.08, 0, 0, 7); ctx.ellipse(-st + r * 0.14, -r * 0.34, r * 0.13, r * 0.08, 0, 0, 7); ctx.fill();
    // bras : lancer (armé puis relâché, côté coup droit ou revers), réception (vers le disque), joie, course
    if (o.throwing) {
      const t = o.throwK, sd = o.side || 1, a = sd * (2.4 - t * 2.9);   // de l'arrière vers l'avant, en travers
      armTo(sd, a, 1.55); armTo(-sd, -sd * 1.9, 0.85);
    } else if (o.reach !== undefined) { const a = o.reach - face; armTo(1, a, 1.5); armTo(-1, a, 1.5); }
    else if (o.ring) { armTo(1, 1.45, 1.55); armTo(-1, -1.45, 1.55); }   // ronde : bras sur les épaules des voisins
    else if (o.sad) { arm(0, r * 0.85, r * 0.15, r * 0.42); arm(0, -r * 0.85, r * 0.15, -r * 0.42); }   // mains sur la tête
    else if (o.five !== undefined) { const a = o.five - face, sd = Math.sin(a) >= 0 ? 1 : -1; armTo(sd, a, 1.7); arm(0, -sd * r * 0.85, sw * r * 0.5, -sd * r * 1.12); }
    else if (o.cele) { armTo(1, 0.55, 1.45); armTo(-1, -0.55, 1.45); }
    else if (o.jumping) { arm(0, r * 0.8, r * 0.5, r * 1.5); arm(0, -r * 0.8, r * 0.5, -r * 1.5); }
    else if (o.hold) { armTo(1, 0.45, 1.25); arm(0, -r * 0.85, -sw * r * 0.5, -r * 1.12); }
    else { arm(0, r * 0.85, sw * r * 0.75, r * 1.12); arm(0, -r * 0.85, -sw * r * 0.75, -r * 1.12); }
    ctx.fillStyle = tcol(p.team); ctx.strokeStyle = tdark(p.team); ctx.lineWidth = 2;
    roundRectPath(-r * 0.58, -r * 1.05, r * 1.16, r * 2.1, r * 0.56); ctx.fill();
    if (mineStyle(p)) jerseyPattern(ctx, -r * 0.58, -r * 1.05, r * 1.16, r * 2.1, light);   // maillot de ton équipe (Mon style)
    ctx.fillStyle = shine(r * 0.58, r * 1.05); roundRectPath(-r * 0.58, -r * 1.05, r * 1.16, r * 2.1, r * 0.56); ctx.fill();
    roundRectPath(-r * 0.58, -r * 1.05, r * 1.16, r * 2.1, r * 0.56); ctx.stroke();
    if (r >= 8) {                                           // numéro dans le dos
      ctx.save(); ctx.rotate(-face); ctx.fillStyle = light ? 'rgba(15,23,42,.75)' : 'rgba(255,255,255,.88)';
      ctx.font = `800 ${Math.round(r * 0.82)}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const bx = -Math.cos(face) * r * 0.62, by = -Math.sin(face) * r * 0.62;
      ctx.fillText(String(p.i + 1), bx, by); ctx.restore();
    }
    head(r * 0.12, r * 0.5);
    if (accOn(p)) accTop(ctx, r * 0.12, 0, r * 0.5);            // tenue de ton équipe (Mon style)
  }
  ctx.restore();
}
// départ parfait : trois traits de vitesse derrière le joueur (comme dans une BD), qui s'effacent avec le boost
function speedLines(p, spd) {
  const ux = p.vx / spd, uy = p.vy / spd, nx = -uy, ny = ux, a = Math.min(1, p.boostT / 0.6) * 0.75, L = (1.4 + spd * 0.22) * S;
  ctx.save(); ctx.lineCap = 'round';
  for (const [o, k] of [[-0.55, 0.75], [0, 1], [0.55, 0.75]]) {
    const x0 = X(p.x - ux * 1.25 + nx * o), y0 = Y(p.y - uy * 1.25 + ny * o), x1 = x0 - ux * L * k, y1 = y0 - uy * L * k;
    const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(1.5, S * 0.16); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.restore();
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }

function arrow(x1, y1, x2, y2, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke(); ctx.setLineDash([]);
  const a = Math.atan2(y2 - y1, x2 - x1), s = 9;
  ctx.beginPath(); ctx.moveTo(X(x2), Y(y2));
  ctx.lineTo(X(x2) - s * Math.cos(a - 0.45), Y(y2) - s * Math.sin(a - 0.45));
  ctx.lineTo(X(x2) - s * Math.cos(a + 0.45), Y(y2) - s * Math.sin(a + 0.45)); ctx.fill();
  ctx.restore();
}

// terrain : image pré-rendue (scenery.js : paintField), redessinée seulement quand la taille, le terrain ou les équipes
// changent ; en vue inclinée, dessinée directement (les textes y sont redressés)
let fieldCache = null, fieldKey = '';
function drawField() {
  const cw = canvas.width / dpr, ch = canvas.height / dpr;
  const F = fieldTheme(), fid = styleOf('field');
  ctx.fillStyle = F.bg; ctx.fillRect(-cw, -ch, cw * 3, ch * 3);
  if (FX.shake > 0) ctx.translate((Math.random() - 0.5) * FX.shake, (Math.random() - 0.5) * FX.shake);   // secousse
  // l'équipe qui attaque vers la droite (on change de côté à chaque point ; pendant la célébration, on garde les zones
  // du point qui vient d'être marqué)
  const cele = (G.phase === 'between' || G.phase === 'over') && G.celebrate && (!G.menuShown || G.attract) && G.betweenT > 0 && !G.tuto && !G.practice;
  const tR = (dirOf(0) > 0) !== !!cele ? 0 : 1;
  if (isoView()) { paintField(ctx, F, fid, tR, CAM.S0, cw, ch); return; }
  const key = [canvas.width, canvas.height, CAM.S0, dpr, fid, tR, tcol(0), tcol(1), tdark(0), tdark(1), tn(0), tn(1), fontsReady].join('|');
  if (key !== fieldKey || !fieldCache) {
    fieldKey = key;
    if (!fieldCache) fieldCache = document.createElement('canvas');
    fieldCache.width = canvas.width; fieldCache.height = canvas.height;
    const c = fieldCache.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintField(c, F, fid, tR, CAM.S0, cw, ch);
  }
  ctx.drawImage(fieldCache, CAM.ox, CAM.oy, cw * CAM.z, ch * CAM.z);
}
// police embarquée chargée : on redessine le terrain (ses textes) une fois
let fontsReady = 0;
if (typeof document !== 'undefined' && document.fonts && document.fonts.load) document.fonts.load(`800 20px 'Barlow Condensed'`).then(() => { fontsReady = 1; }).catch(() => { });
function draw() {
  const cw = canvas.width / dpr, ch = canvas.height / dpr, iso = isoView();
  screenT();
  if (iso) {                                                 // vue inclinée : au fond, la tribune d'en face
    const sk = fieldTheme().sky, g = ctx.createLinearGradient(0, 0, 0, ISO_HEAD * S); g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  }
  groundT();
  drawField();
  if (!iso) { const fid = styleOf('field'); drawGrassWind(fid); drawCrowd(fid); drawWindLife(fid); }   // herbe, public, drapeaux et feuilles (scenery.js)
  drawWeatherGround();                                      // le temps (Mon style) : teinte du sol seulement (weather.js)

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

  // coéquipier désigné pour ton prochain appel de cut : anneau doré qui pulse
  const pk = myAttack && myPick();
  if (pk) { ctx.save(); ctx.strokeStyle = 'rgba(250,204,21,.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -G.time * 12;
    circle(X(pk.x), Y(pk.y), (1.6 + Math.sin(G.time * 6) * 0.12) * S); ctx.stroke(); ctx.restore(); }

  // cut que tu as demandé : flèche jaune du coéquipier jusqu'à l'endroit voulu (tant qu'il n'y est pas)
  const called = new Set();
  if (myAttack) for (const p of TEAMS[ME]) {
    if (!p.callTo || !(G.time - p.called < 3.5) || p === disc.holder || dist(p.x, p.y, p.callTo[0], p.callTo[1]) < 1.3) continue;
    called.add(p); arrow(p.x, p.y, p.callTo[0], p.callTo[1], 'rgba(250,204,21,.9)');
  }
  // Courses en cours de tes coéquipiers
  if (myAttack) for (const p of TEAMS[ME]) {
    if (called.has(p)) continue;
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
  if (canThrow() && G.pointer.active) drawAim(disc.holder, G.pointer.x, G.pointer.y, G.curve, G.loft, G.aiming, false);
  else { const A = allyAim(); if (A) drawAim(disc.holder, A.x, A.y, A.curve, A.kind, A.aiming, true); }

  // Trajectoire restante du disque en vol, colorée selon la hauteur
  if (disc.mode === 'air') {
    const u0 = Math.min(1, disc.t / disc.dur);
    // passe : un cône qui se resserre pendant le vol ; le cercle d'arrivée (décalé, il contient l'arrivée réelle) devient
    // peu à peu un point — on devine où le disque tombera. Pull : trajectoire exacte.
    const s = coneLeft(), co = disc.coneOff || [0, 0];
    if (disc.pull || !disc.cone) drawFlightPath(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, discPeak(), u0, 0.7, 2.5, [5, 4], discKind(), disc.curveV);
    else {                                                   // en vol : seulement le cône (sans trajectoire), coloré selon la hauteur
      const ox = co[0] * s, oy = co[1] * s;
      drawCone(v => { const [x, y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, v), w = u0 >= 1 ? 1 : Math.max(0, (v - u0) / (1 - u0)); return [x + ox * w, y + oy * w]; },
        u0, disc.cone * s, 0.9, v => discZ(v));
    }
  }
  if (playing && (disc.mode === 'air' || (canThrow() && G.pointer.active))) { if (iso) inScreen(drawHeightLegend); else drawHeightLegend(); }

  // Joueurs
  const r = 1.05 * S, swT = switchTarget(meH());
  // ombres au soleil : elles s'écartent quand le joueur saute (ou saute de joie) ; le joueur, lui, reste à sa place
  if (!iso) for (const p of players) {
    const jl = Math.max(0, jumpVis(p)) + celebrateHop(p) * 0.7, [lx, ly] = pivLean(p), [sx, sy] = sunOff(jl * 1.3);
    softShadow(ctx, X(p.x + lx + sx * 1.4), Y(p.y + ly + sy * 1.4), r * (1.4 - Math.min(0.3, jl * 0.2)), 0.5 - Math.min(0.2, jl * 0.12));
  } else for (const p of players) {
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
    const lying = p.dive > 0 || p.down > 0, rf = lying ? null : ringFace(p);   // ronde de fin de match : tourné vers le centre
    let face;
    if (rf !== null) { if (p.face === undefined) p.face = rf; const d = Math.atan2(Math.sin(rf - p.face), Math.cos(rf - p.face)); p.face += d * Math.min(1, (FX.dt || 0.016) * 6); face = p.face; }
    else face = lying ? (Math.atan2(p.vy, p.vx) || faceOf(p)) : faceOf(p);
    if (lying) p.face = face;
    const spd = Math.hypot(p.vx, p.vy), hop = celebrateHop(p);
    p.stride = (p.stride || 0) + spd * (FX.dt || 0.016) * 1.6;
    if (!iso) groundFx(p, spd);                              // herbe soulevée par un plongeon, poussière en courant
    if (!iso && p.boostT > 0 && spd > 2) speedLines(p, spd);    // départ parfait : traits de vitesse derrière lui
    // bras tendus seulement dans les derniers instants : le receveur juste avant l'arrivée, un défenseur quand le disque le frôle
    const left = disc.mode === 'air' ? disc.dur - disc.t : 9;
    const near = disc.mode === 'air' && !disc.pull && (disc.z || 0) < 3.6 && ((disc.intended === p && left < 0.38 && dist(p.x, p.y, disc.ex, disc.ey) < 3) || dist(p.x, p.y, disc.x, disc.y) < 1.7);
    if (p.sadDelay > 0) { p.sadDelay -= FX.dt || 0.016; if (p.sadDelay <= 0) p.sadT = 2.4; }   // faux départ : il s'arrête, puis se prend la tête
    if (p.sadT > 0) p.sadT -= FX.dt || 0.016;                  // après une erreur : mains sur la tête (moments.js : sadAt)
    // après un point : main tendue vers le coéquipier le plus proche (on se tape dans la main)
    let five;
    if (FX.celebrate && FX.celebrate.team === p.team && FX.celebrate.t < 3 && !lying) {
      const q = TEAMS[p.team].filter(o => o !== p).reduce((a, b) => (dist(p.x, p.y, b.x, b.y) < dist(p.x, p.y, a.x, a.y) ? b : a));
      if (q && dist(p.x, p.y, q.x, q.y) < 2.8) five = Math.atan2(q.y - p.y, q.x - p.x);
    }
    return { jl, lying, face, scale: (1 + jl * 0.25 + hop * 0.18) * (crouch ? 0.84 : 1), throwing: p.throwT > 0, throwK: 1 - Math.max(0, p.throwT || 0) / 0.32, side: p.throwSide || 1,
      jumping: jl > 0.05, swing: spd > 1 ? Math.sin(p.stride) : 0, stride: p.stride, run: Math.min(1, spd / 4),
      reach: near && !lying ? Math.atan2(disc.y - p.y, disc.x - p.x) : undefined, cele: hop > 0.05 && five === undefined, five,
      sad: p.sadT > 0 && !lying, ring: rf !== null,
      hold: disc.holder === p && (disc.mode === 'held' || disc.mode === 'carry') };
  };
  if (!iso) for (const p of players) {
    ctx.globalAlpha = p.down > 0 ? 0.6 : 1;
    const o = bodyO(p);                                        // (saut, saut de joie : il grossit, son ombre s'écarte)
    const [lx, ly] = pivLean(p);                                // porteur : le corps se penche du côté de son pied de pivot
    drawBody(p, X(p.x + lx), Y(p.y + ly), r, o.face, o);
    ctx.globalAlpha = 1;
    rings(p);
  } else {                                                    // vue inclinée : repères et joueurs au sol, puis les joueurs debout
    const O = new Map(players.map(p => [p, bodyO(p)]));
    for (const p of players) {
      rings(p);
      const o = O.get(p);
      if (o.lying && !(p.dive > 0)) { ctx.globalAlpha = p.down > 0 ? 0.6 : 1; drawBody(p, X(p.x), Y(p.y), r * 1.06, o.face, o); ctx.globalAlpha = 1; }   // au sol
    }
    inScreen(() => {
      for (const p of players.slice().sort((a, b) => a.y - b.y)) {   // du fond vers le devant
        const o = O.get(p);
        if (o.lying) {                                       // en plein plongeon : il part à hauteur de taille et tombe vers le sol
          if (!(p.dive > 0)) continue;
          const z = 0.95 * Math.pow(Math.max(0, p.dive / DIVE_T), 0.7);
          ctx.save(); ctx.translate(X(p.x), IY(p.y, z)); ctx.scale(1, isoK); drawBody(p, 0, 0, r * 1.06, o.face, o); ctx.restore();
          continue;
        }
        const [lx, ly] = pivLean(p), z = o.jl + celebrateHop(p) * 0.6;
        drawChibi(p, X(p.x + lx), IY(p.y + ly, z), r * 0.95, o.face, o);
      }
    });
  }

  // Humains : étiquette (pseudo, ou « J2 ») sous des joueurs contrôlés par d'autres personnes,
  // et numéros 1 à 5 sous tes joueurs (touches du clavier pour en prendre un)
  const underY = p => (iso ? IY(p.y, 0) + r * 0.35 : Y(p.y) + r);   // juste sous les pieds, à l'écran
  inScreen(() => {
    ctx.textAlign = 'center';
    for (const h of G.humans) {
      if (!h.sel || h.id === G.myId) continue;
      const p = h.sel;
      ctx.font = `800 ${Math.max(10, S * 1.25)}px system-ui`;
      const lw = ctx.measureText(humanLabel(h)).width + S * 0.8;
      ctx.fillStyle = 'rgba(15,23,42,.8)'; ctx.fillRect(X(p.x) - lw / 2, underY(p) + 2, lw, S * 1.6);
      ctx.fillStyle = tlabel(p.team); ctx.fillText(humanLabel(h), X(p.x), underY(p) + 2 + S * 1.25);
    }
    if (playing && !isTouchUI() && canSwitchNow(meH())) {
      ctx.font = `700 ${Math.max(9, S * 1.05)}px system-ui`;
      TEAMS[ME].forEach((p, k) => {
        if (takenByOther(p, meH())) return;
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(String(k + 1), X(p.x) + r * 0.95, underY(p) + r * 0.25);
      });
    }
  });
  drawEmotes();

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
    ctx.font = `800 ${Math.max(14, S * 2.4)}px ${UI_FONT}`; ctx.textAlign = 'center';
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
    // hauteur de la passe préparée : visible par tous (disque levé ou baissé, jauge à côté du porteur)
    const lf = playing && disc.mode === 'held' ? holderLoft() : LOFT.N, tell = lf >= LOFT.TELL, shown = Math.abs(lf - LOFT.N) > 0.04;
    if ((disc.mode === 'held' || disc.mode === 'carry') && !tell) {   // dans la main : du côté de son pivot (sinon du côté où il regarde)
      const h = disc.holder, pv = disc.mode === 'held' ? h.pivY || 0 : 0;
      const f = h.face !== undefined ? h.face : (dirOf(h.team) > 0 ? 0 : Math.PI);
      const [rx, ry] = releasePoint(h, h.x, h.y), w = Math.min(1, Math.abs(pv) * 1.5);
      dx += (Math.cos(f + 0.5) * 0.95) * (1 - w) + (rx - h.x) * w; dy += (Math.sin(f + 0.5) * 0.95) * (1 - w) + (ry - h.y) * w;
    }
    if (iso) drawIsoDisc(dx, dy, tell, lf);
    else {
    // en vol : le disque reste à sa vraie place, c'est son ombre qui s'écarte avec la hauteur (la couleur de l'anneau dit
    // si on peut le toucher) ; levé dans la main (passe haute préparée) : il monte au-dessus du porteur
    const lift = tell ? loftZ(lf) * 0.83 * S : 0, z = disc.mode === 'air' ? disc.z || 0 : 0;
    if (tell) {
      ctx.save(); ctx.strokeStyle = 'rgba(196,181,253,.9)'; ctx.lineWidth = 2; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(X(dx), Y(dy)); ctx.lineTo(X(dx), Y(dy) - lift); ctx.stroke();
      ctx.setLineDash([]); ctx.strokeStyle = 'rgba(196,181,253,.95)'; ctx.lineWidth = 2.5;
      circle(X(dx), Y(dy) - lift, 0.95 * S + Math.sin(G.time * 14) * 2); ctx.stroke();
      ctx.restore();
    }
    if (shown) drawLoftGauge(disc.holder, X(disc.holder.x), Y(disc.holder.y), lf);
    if (disc.mode === 'air') {                                // ombre au soleil + anneau coloré = hauteur
      const [sx, sy] = sunOff(z);
      softShadow(ctx, X(dx + sx), Y(dy + sy), (0.6 + z * 0.09) * S, Math.max(0.12, 0.45 - z * 0.055));
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 4.5; circle(X(dx), Y(dy), 1.05 * S); ctx.stroke();   // contour sombre : lisible sur tous les terrains
      ctx.strokeStyle = heightColor(disc.z, 0.95); ctx.lineWidth = 2.5; circle(X(dx), Y(dy), 1.05 * S); ctx.stroke();
    }
    // disque vivant (scenery.js : discLife) : il tourne sur lui-même, tremble s'il est mal lancé, rebondit et roule à
    // l'atterrissage (purement visuel : il finit exactement là où le jeu l'a posé)
    const L = discLife(), hop = L.hop;
    if (disc.mode === 'ground' || disc.mode === 'dead') { dx += L.ox; dy += L.oy; const [sx, sy] = sunOff(hop); softShadow(ctx, X(dx + sx), Y(dy + sy), 0.6 * S, 0.35 - hop * 0.3); }
    const dR = 0.5 * S * (1 + Math.min(0.4, (z + hop) * 0.07)), cx = X(dx), cy = Y(dy) - lift;
    ctx.save();
    const spin = disc.mode === 'air' ? 0 : L.spin;              // en l'air : pas de rotation du logo (seulement au sol, quand il roule)
    if (L.wob) { ctx.translate(cx, cy); ctx.rotate(spin * 0.3); ctx.scale(1 + L.wob, 1 - L.wob); ctx.rotate(-spin * 0.3); ctx.translate(-cx, -cy); }
    discShape(cx, cy, dR, false);                              // penché selon sa courbe : vu d'en haut, il s'amincit
    ctx.save(); ctx.clip();
    ctx.translate(cx, cy); ctx.rotate(spin); ctx.beginPath(); ctx.arc(0, 0, dR * 1.3, 0, 7);
    paintDisc(ctx, 0, 0, dR);
    ctx.strokeStyle = 'rgba(15,23,42,.28)'; ctx.lineWidth = Math.max(1, dR * 0.16); ctx.beginPath(); ctx.arc(0, 0, dR * 0.6, 0.2, 1.4); ctx.stroke();   // le logo qui tourne
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(0, 0, dR * 0.6, 3.3, 4.1); ctx.stroke();
    ctx.restore();
    discShape(cx, cy, dR, false); ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    }
  }

  drawParticles();
  drawWeatherSky();                                         // pluie, flocons, brume : très légers, par-dessus
  drawHalloween();                                          // mode Halloween : le noir, sauf dans son cône de vision
  drawPullUI();
  drawStartUI();                                            // feux du départ au pull, bandeau du check
  screenT();                                                // la suite (messages) se dessine à l'écran, pas au sol
  const hw = typeof hostWaitMsg === 'function' ? hostWaitMsg() : '';
  if (hw) {                                                   // en ligne : l'hôte ne répond plus pour l'instant
    ctx.save(); ctx.font = `700 ${Math.max(13, S * 1.9)}px system-ui`; ctx.textAlign = 'center';
    const w = ctx.measureText(hw).width + S * 3, y = ch * 0.3;
    ctx.fillStyle = 'rgba(15,23,42,.85)'; ctx.fillRect(cw / 2 - w / 2, y - S * 2.2, w, S * 3.4);
    ctx.fillStyle = '#fde68a'; ctx.fillText(hw, cw / 2, y); ctx.restore();
  }
  if (!hw && G.net === 'guest' && G.started && G.rtt > 250) {   // connexion lente : petit rappel discret en haut à droite
    ctx.save(); ctx.font = `600 ${Math.max(11, S * 1.3)}px system-ui`; ctx.textAlign = 'right';
    ctx.fillStyle = G.rtt > 400 ? '#f87171' : '#fbbf24'; ctx.fillText('📶 ' + Math.round(G.rtt) + ' ms', cw - S * 1.2, S * 2.2); ctx.restore();
  }
  if (G.msgT > 0) {                                         // message central, avec un petit effet de « pop »
    const sc = 1 + FX.pop * 0.5 + Math.max(0, G.msgT - 1.5) * 0.6;
    ctx.save(); ctx.translate(cw / 2, G.tuto ? ch * 0.86 : ch / 2); ctx.scale(sc, sc);   // tutoriel : en bas, hors de l'action (au milieu du terrain)
    ctx.globalAlpha = Math.min(1, G.msgT);
    ctx.font = `800 ${Math.max(22, CAM.S0 * 4.2)}px ${UI_FONT}`; ctx.textAlign = 'center';   // (taille fixe, même caméra zoomée)
    const txt = hiddenFromMe(G.msgTeam) ? G.msgAlt : G.msg;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(txt, 2, 2);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0);
    ctx.restore();
  }
}

