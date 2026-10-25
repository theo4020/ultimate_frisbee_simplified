// render-iso.js — Vue inclinée (côté tribune) : transformations du sol, personnages chibi debout, disque en 3D.
// La vue de dessus et tout ce qui est commun aux deux vues sont dans render.js.

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

// inclinaison du disque en vol (rad) : donnée au lâcher par la courbe, la même du début à la fin du vol
const discBank = () => (disc.mode === 'air' && !disc.pull ? clamp(disc.curveV || 0, -1, 1) * 0.6 : 0);
// le disque (rayon R, centré en sx, sy) vu de la caméra : un cercle penché autour de sa direction de vol, du côté
// intérieur de la courbe (celui vers lequel il tourne), du même angle tout le vol. Vu de la tribune, une courbe qui
// s'éloigne puis revient montre le dessus du disque (il paraît plus à plat) ; dans l'autre sens, sa tranche (plus penché).
function discShape(sx, sy, R, iso) {
  let tx = disc.ex - disc.sx, ty = disc.ey - disc.sy; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  let qx = disc.cx - (disc.sx + disc.ex) / 2, qy = disc.cy - (disc.sy + disc.ey) / 2; const ql = Math.hypot(qx, qy);
  const b = disc.mode === 'air' ? discBank() : 0, ix = ql > 0.01 ? -qx / ql : 0, iy = ql > 0.01 ? -qy / ql : 0;   // vers l'intérieur de la courbe
  const sb = Math.abs(Math.sin(b)), cb = Math.cos(b);
  const n = [ix * sb, iy * sb, cb], a = [tx, ty, 0];            // normale du disque, et sa direction de vol (dans son plan)
  const c = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];   // 2e axe du plan du disque
  const P = v => (iso ? [v[0], v[1] * isoK - v[2] * ISO_Z] : [v[0], v[1]]);
  ctx.beginPath();
  for (let k = 0; k <= 24; k++) {
    const th = k / 24 * Math.PI * 2, v = [0, 1, 2].map(i => (Math.cos(th) * a[i] + Math.sin(th) * c[i]) * R), [px, py] = P(v);
    if (k) ctx.lineTo(sx + px, sy + py); else ctx.moveTo(sx + px, sy + py);
  }
  ctx.closePath();
}
// vue inclinée : le disque à sa hauteur (en main, en l'air, levé pour une passe haute), son ombre au sol
function drawIsoDisc(dx, dy, tell, lf) {
  const l = lf === undefined ? LOFT.N : lf, held = disc.mode === 'held' || disc.mode === 'carry';
  const z = disc.mode === 'air' ? disc.z : tell ? 0.3 + loftZ(l) : held ? 0.7 + (loftZ(l) - 1) * 0.6 : 0.05;   // en main : à hauteur des mains du personnage
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
    if (tell) { ctx.strokeStyle = 'rgba(196,181,253,.95)'; ctx.lineWidth = 2.5; circle(sx, sy, 0.95 * S + Math.sin(G.time * 14) * 2); ctx.stroke(); }
    if (held && disc.holder && Math.abs(l - LOFT.N) > 0.04) drawLoftGauge(disc.holder, X(disc.holder.x), IY(disc.holder.y, 0), l);
    const rd = 0.6 * S * (1 + Math.min(z, 6) * 0.05);
    discShape(sx, sy, rd * 1.3, true);                       // vu de biais, penché selon sa courbe
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.stroke();
  });
}
