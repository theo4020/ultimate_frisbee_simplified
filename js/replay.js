// replay.js — Ralenti du dernier point marqué, et petite célébration des buteurs.
// Chaque écran enregistre lui-même les positions pendant le jeu (aussi les invités en ligne),
// le ralenti est donc local : il ne gêne personne.

const REPLAY = { frames: [], acc: 0, last: null, STEP: 0.05, KEEP: 7 };   // une image toutes les 50 ms, on garde les 7 dernières secondes

function replayReset() { REPLAY.frames = []; REPLAY.acc = 0; }
function replayRecord(dt) {
  if (G.phase !== 'play' || G.tuto || G.attract || G.practice) return;
  REPLAY.acc += dt;
  if (REPLAY.acc < REPLAY.STEP) return;
  REPLAY.acc = 0;
  REPLAY.frames.push({
    p: players.map(p => [p.x, p.y, p.dive > 0 ? 1 : p.down > 0 ? 2 : 0, p.vx, p.vy]),
    d: [disc.mode, disc.x, disc.y, disc.z || 0, disc.holder ? players.indexOf(disc.holder) : -1]
  });
  const max = Math.round(REPLAY.KEEP * 1.5 / REPLAY.STEP);
  if (REPLAY.frames.length > max) REPLAY.frames.splice(0, REPLAY.frames.length - max);
}
// au moment du point (appelé par l'effet « score », donc aussi chez les invités)
function replaySave(team) {
  if (G.tuto || G.attract) return;
  const n = Math.round(REPLAY.KEEP / REPLAY.STEP);
  const fr = REPLAY.frames.slice(-n);
  if (fr.length < 10) return;
  // on ajoute quelques images figées sur le point
  for (let i = 0; i < 12; i++) fr.push(fr[fr.length - 1]);
  REPLAY.last = { frames: fr, team, score: G.score.slice() };
}
function startReplay() {
  if (!REPLAY.last) return;
  G.replay = { t: 0, frames: REPLAY.last.frames, team: REPLAY.last.team };
  $('overlay').classList.add('hidden');
}
function stopReplay() {
  if (!G.replay) return;
  G.replay = null;
  $('overlay').classList.remove('hidden');
}
function replayTick(dt) {
  if (!G.replay) return;
  G.replay.t += dt * 0.55;                                   // ralenti
  if (G.replay.t / REPLAY.STEP >= G.replay.frames.length - 1) stopReplay();
}
function drawReplay() {
  const R = G.replay, k = R.t / REPLAY.STEP, i = Math.min(R.frames.length - 2, Math.floor(k)), u = k - i;
  const A = R.frames[i], B = R.frames[i + 1];
  const cw = canvas.width / dpr, ch = canvas.height / dpr, r = 0.95 * S;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawField();
  const lerp = (a, b) => a + (b - a) * u;
  players.forEach((p, j) => {
    const a = A.p[j], b = B.p[j], x = lerp(a[0], b[0]), y = lerp(a[1], b[1]);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; circle(X(x) + 2, Y(y) + 3, r); ctx.fill();
    ctx.globalAlpha = a[2] === 2 ? 0.6 : 1;
    const sp = Math.hypot(a[3], a[4]), face = sp > 0.8 ? Math.atan2(a[4], a[3]) : (p.rface !== undefined ? p.rface : 0);
    p.rface = face;
    drawBody(p, X(x), Y(y), r * 1.06, face, { lying: !!a[2], swing: sp > 1 ? Math.sin(G.time * 9 + j) : 0 });
    ctx.globalAlpha = 1;
  });
  const d = A.d, e = B.d;
  if (d[0] !== 'dead') {
    let x = lerp(d[1], e[1]), y = lerp(d[2], e[2]);
    const z = d[0] === 'air' ? lerp(d[3], e[3]) : 0;
    if ((d[0] === 'held' || d[0] === 'carry') && d[4] >= 0) x += 0.8 * dirOf(players[d[4]].team);
    if (z > 0) { ctx.fillStyle = 'rgba(0,0,0,.3)'; circle(X(x), Y(y), 0.45 * S); ctx.fill(); }
    circle(X(x), Y(y) - z * S * 1.2, 0.5 * S * (1 + z * 0.12));
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // bandeau « ralenti »
  const fs = Math.max(13, S * 2);
  ctx.save();
  ctx.fillStyle = 'rgba(15,23,42,.75)'; ctx.fillRect(10, 10, fs * 7.2, fs * 1.9);
  ctx.fillStyle = Math.floor(G.time * 2) % 2 ? '#f87171' : '#fecaca'; circle(10 + fs * 0.75, 10 + fs * 0.95, fs * 0.32); ctx.fill();
  ctx.font = `800 ${fs}px system-ui`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  ctx.fillText('RALENTI', 10 + fs * 1.35, 10 + fs * 1.3);
  ctx.font = `600 ${Math.max(10, fs * 0.6)}px system-ui`; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.fillText(isTouchUI() ? 'Tape pour passer' : 'Clic ou Échap pour passer', cw - 12, ch - 12);
  ctx.restore();
}

// ---------- célébration après un point ----------
// les coéquipiers du buteur courent vers lui (côté hôte : les invités le voient via l'état envoyé),
// et sautent de joie à l'écran (effet local déclenché par l'effet « score »)
function celebrateTick(dt) {
  const C = G.celebrate;
  if (!C) return;
  TEAMS[C.team].forEach((p, k) => {
    if (p === G.scorer) { p.tx = p.x; p.ty = p.y; p.sp = 0; }
    else { const a = k * 1.3; p.tx = clamp(C.x + Math.cos(a) * 2.2, 0.5, W - 0.5); p.ty = clamp(C.y + Math.sin(a) * 2.2, 0.5, H - 0.5); p.sp = SPD.cut; }
    steer(p, dt);
  });
  for (const p of TEAMS[1 - C.team]) { p.tx = p.x; p.ty = p.y; p.sp = 0; p.dive = 0; steer(p, dt); }
}
// saut des joueurs de l'équipe qui vient de marquer (en mètres, vers le haut de l'écran)
function celebrateHop(p) {
  const c = FX.celebrate;
  if (!c || p.team !== c.team || c.t > 2.4) return 0;
  return Math.abs(Math.sin(c.t * 9 + p.i * 1.7)) * 0.7 * (1 - c.t / 2.4);
}
