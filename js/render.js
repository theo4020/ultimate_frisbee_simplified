// render.js — Rendu du terrain, des joueurs, du disque et des repères

// =====================================================================
//  Rendu
// =====================================================================
function canThrow() { const h = throwerHuman(); return G.phase === 'play' && !!h && h.id === G.myId; }
function defending() { return G.phase === 'play' && G.off !== G.me; }
// couleur selon la hauteur : rouge = contrable (même en plongeon), orange = contrable debout,
// violet = seulement en sautant, bleu = trop haut
function heightColor(z, a) {
  return z < REACH_DIVE ? `rgba(248,113,113,${a})` : z < REACH_STAND ? `rgba(251,146,60,${a})`
    : z < REACH_STAND + JUMP_H ? `rgba(196,181,253,${a})` : `rgba(125,211,252,${a})`;
}
function drawFlightPath(sx, sy, cx, cy, ex, ey, peak, u0, alpha, width, dash, kind) {
  const step = 0.025;
  ctx.save(); ctx.lineWidth = width; ctx.lineCap = 'round'; if (dash) ctx.setLineDash(dash);
  let [px, py] = bez(sx, sy, cx, cy, ex, ey, u0);
  for (let u = u0 + step; u <= 1.0001; u += step) {
    const [x, y] = bez(sx, sy, cx, cy, ex, ey, Math.min(1, u));
    const um = u - step / 2;
    ctx.strokeStyle = heightColor(heightAt(um, peak, kind), alpha);
    ctx.beginPath(); ctx.moveTo(X(px), Y(py)); ctx.lineTo(X(x), Y(y)); ctx.stroke();
    px = x; py = y;
  }
  ctx.restore();
}
function drawHeightLegend() {
  const fs = Math.max(9, S * 1.15), x0 = X(0.8), y0 = Y(0.8) + fs;
  ctx.save(); ctx.font = `600 ${fs}px system-ui`; ctx.textAlign = 'left';
  const items = [['contrable', REACH_DIVE - 0.1], ['debout seulement', REACH_STAND - 0.1], ['en sautant', REACH_STAND + 0.5], ['trop haut', REACH_STAND + JUMP_H + 0.5]];
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
}
function draw() {
  const cw = canvas.width / dpr, ch = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawField();

  drawStreaks();
  const playing = G.phase === 'play';
  const myAttack = playing && G.off === G.me, ME = G.me, mySel = (meH() || {}).sel || null;

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
  if (playing && disc.mode === 'held') {
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
  if (defending() && mySel && defFormOf(ME) === 'man' && mySel.match) {
    const a = mySel, b = a.match;
    ctx.save(); ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(250,204,21,.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke(); ctx.restore();
  }

  // Aperçu du lancer
  if (canThrow() && G.pointer.active) {
    const h = disc.holder, kind = G.throwKind, K = THROWS[kind];
    let tx = G.pointer.x, ty = G.pointer.y, dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 0.01;
    if (d > K.max) { tx = h.x + dx / d * K.max; ty = h.y + dy / d * K.max; d = K.max; }
    if (d < K.min && d >= CANCEL_R) { tx = h.x + dx / d * K.min; ty = h.y + dy / d * K.min; d = K.min; }
    const [cx, cy] = ctrlFor(h.x, h.y, tx, ty, G.curve);
    const dur = throwDur(h.x, h.y, tx, ty, kind);
    const [wx, wy] = drift(dur, kind), ex = tx + wx, ey = ty + wy;
    ctx.save();
    const cancel = G.aiming && dist(G.pointer.x, G.pointer.y, h.x, h.y) < CANCEL_R;
    ctx.globalAlpha = cancel ? 0.3 : 1;
    drawFlightPath(h.x, h.y, cx, cy, ex, ey, peakOf(dur, kind), 0, G.aiming ? 0.95 : 0.7, G.aiming ? 3 : 2, kind === 'high' ? [2, 5] : [6, 5], kind);
    ctx.strokeStyle = G.aiming ? 'rgba(250,204,21,.95)' : 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
    const er = throwErr(d, G.curve, kind) + Math.hypot(wx, wy) * 0.3;
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

  // Trajectoire restante du disque en vol, colorée selon la hauteur
  if (disc.mode === 'air') {
    const u0 = Math.min(1, disc.t / disc.dur);
    drawFlightPath(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, discPeak(), u0, 0.7, 2.5, [5, 4], disc.kind);
  }
  if (playing && (disc.mode === 'air' || (canThrow() && G.pointer.active))) drawHeightLegend();

  // Joueurs
  const r = 0.95 * S, swT = switchTarget(meH());
  for (const p of players) {
    const jl = Math.max(0, jumpVis(p));
    ctx.fillStyle = `rgba(0,0,0,${0.25 - jl * 0.08})`; circle(X(p.x) + 2 + jl * 3, Y(p.y) + 3 + jl * 3, r * (1 - jl * 0.15)); ctx.fill();
  }
  for (const p of players) {
    ctx.fillStyle = tcol(p.team);
    ctx.strokeStyle = tdark(p.team); ctx.lineWidth = 2;
    ctx.globalAlpha = p.down > 0 ? 0.55 : 1;
    const jv = jumpVis(p), jl = Math.max(0, jv), crouch = jv < 0;   // saut : accroupi, puis il grossit et s'élève
    const hop = celebrateHop(p) * S + jl * S * 0.9;              // (et saut de joie après un point)
    ctx.beginPath();
    if (p.dive > 0 || p.down > 0) ctx.ellipse(X(p.x), Y(p.y), r * 1.5, r * 0.7, Math.atan2(p.vy, p.vx) || 0, 0, Math.PI * 2);
    else ctx.arc(X(p.x), Y(p.y) - hop, r * (1 + jl * 0.22) * (crouch ? 0.84 : 1), 0, Math.PI * 2);
    ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
    if (p === disc.holder && (disc.mode === 'held' || disc.mode === 'carry')) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; circle(X(p.x), Y(p.y), r + 4); ctx.stroke(); }
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
  }

  // Humains : étiquette « J2 » au-dessus des joueurs contrôlés par d'autres personnes,
  // et numéros 1 à 5 sous tes joueurs (touches du clavier pour en prendre un)
  ctx.textAlign = 'center';
  for (const h of G.humans) {
    if (!h.sel || h.id === G.myId) continue;
    const p = h.sel;
    ctx.font = `800 ${Math.max(10, S * 1.25)}px system-ui`;
    ctx.fillStyle = 'rgba(15,23,42,.8)'; ctx.fillRect(X(p.x) - S * 1.6, Y(p.y) + r + 2, S * 3.2, S * 1.6);
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
  for (const p of players) {
    if (!p.tag) continue;
    const label = p.tag === '2d' ? '2' : p.tag;
    ctx.fillStyle = 'rgba(15,23,42,.75)'; circle(X(p.x), Y(p.y) - r - 9, Math.max(8, S * 1.1)); ctx.fill();
    ctx.fillStyle = '#facc15'; ctx.fillText(label, X(p.x), Y(p.y) - r - 9 + Math.max(4, S * 0.55));
  }

  // Compte du marqueur
  if (disc.mode === 'held' && G.stall > 0) {
    const n = Math.min(10, Math.floor(G.stall) + 1);
    ctx.fillStyle = n >= 8 ? '#f87171' : '#facc15';
    ctx.font = `700 ${Math.max(12, S * 2)}px system-ui`; ctx.textAlign = 'center';
    ctx.fillText(n, X(disc.x), Y(disc.y) - r - 8);
  }

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
    if ((disc.mode === 'held' || disc.mode === 'carry') && !tell) dx += 0.8 * dirOf(disc.holder.team);
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

  drawParticles();
  drawPullUI();
  if (G.msgT > 0) {                                         // message central, avec un petit effet de « pop »
    const sc = 1 + FX.pop * 0.5 + Math.max(0, G.msgT - 1.5) * 0.6;
    ctx.save(); ctx.translate(cw / 2, ch / 2); ctx.scale(sc, sc);
    ctx.globalAlpha = Math.min(1, G.msgT);
    ctx.font = `800 ${Math.max(18, S * 3.4)}px system-ui`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(G.msg, 2, 2);
    ctx.fillStyle = '#fff'; ctx.fillText(G.msg, 0, 0);
    ctx.restore();
  }
}

