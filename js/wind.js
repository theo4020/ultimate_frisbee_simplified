// wind.js — Vent : tirage, rafales, dérive du disque, traits blancs, force (break side)

// =====================================================================
//  Vent
// =====================================================================
function newWind() {
  if (G.form.windMode === 'fixed') {
    const ang = G.form.windDir * Math.PI / 4, ms = G.form.windKmh / 3.6;
    G.wind = { x: Math.cos(ang) * ms, y: Math.sin(ang) * ms, kmh: G.form.windKmh };
    return;
  }
  const r = Math.random();
  const kmh = r < 0.2 ? rand(0, 5) : r < 0.65 ? rand(8, 20) : rand(20, 30);
  const ang = (Math.random() < 0.5 ? 0 : Math.PI) + rand(-0.7, 0.7);  // surtout dans l'axe du terrain
  const ms = kmh / 3.6;
  G.wind = { x: Math.cos(ang) * ms, y: Math.sin(ang) * ms, kmh };
}
function windNow() {                                          // rafales légères
  const g = 1 + 0.2 * Math.sin(G.gt * 0.8) + 0.1 * Math.sin(G.gt * 2.3);
  return [G.wind.x * g, G.wind.y * g];
}
// Traits de vent : leur nombre et leur vitesse suivent la force du vent
const streaks = [];
function updateStreaks(dt) {
  const [wx, wy] = windNow(), ms = Math.hypot(wx, wy);
  const target = Math.round(G.wind.kmh * 0.9);
  if (ms < 0.5) { streaks.length = 0; return; }
  while (streaks.length < target && Math.random() < 0.5) {
    const life = rand(1.2, 2.4);
    streaks.push({ x: rand(-M, W + M), y: rand(-M, H + M), len: rand(2.5, 6) * (0.6 + ms / 8), t: 0, life });
  }
  const vis = 2.2 * ms + 3;                                 // vitesse d'affichage (m/s)
  for (let i = streaks.length - 1; i >= 0; i--) {
    const k = streaks[i];
    k.t += dt; k.x += wx / ms * vis * dt; k.y += wy / ms * vis * dt;
    if (k.t > k.life) streaks.splice(i, 1);
  }
  if (streaks.length > target) streaks.length = target;
}
function drawStreaks() {
  const [wx, wy] = windNow(), ms = Math.hypot(wx, wy);
  if (ms < 0.5) return;
  const ux = wx / ms, uy = wy / ms;
  ctx.save(); ctx.lineCap = 'round';
  for (const k of streaks) {
    const a = Math.sin(Math.PI * k.t / k.life) * 0.45;
    const g = ctx.createLinearGradient(X(k.x - ux * k.len), Y(k.y - uy * k.len), X(k.x), Y(k.y));
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,255,255,${a.toFixed(3)})`);
    ctx.strokeStyle = g; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(X(k.x - ux * k.len), Y(k.y - uy * k.len)); ctx.lineTo(X(k.x), Y(k.y)); ctx.stroke();
  }
  ctx.restore();
}
// Vent de côté et inclinaison du disque : une passe courbée est lâchée penchée, le bord intérieur de la courbe plus bas.
// Un vent qui souffle vers l'intérieur de la courbe arrive par en dessous : il porte le disque (il descend plus lentement,
// plane un peu plus longtemps et se laisse emporter davantage). Un vent qui souffle vers l'extérieur tape le dessus :
// il le plaque (il descend plus vite, dérive moins). Disque à plat (sans courbe) : le vent le pousse seulement de côté.
//   cross : vent vers l'intérieur de la courbe (m/s) · k : dérive (×) · kd : temps de vol (×)
//   (la portance, elle, change au fil du vol à mesure que le disque tourne : BANK.LIFT, voir flyDone dans util.js)
const BANK = { LIFT: 0.8, DRIFT: 0.07, DUR: 0.008 };
const NO_BANK = { cross: 0, k: 1, kd: 1 };
function bankWind(sx, sy, ax, ay, curve, kind) {
  const c = Math.min(1, Math.abs(curve || 0)) * (1 - 0.6 * loftW(loftOf(kind === undefined ? LOFT.N : kind)));   // passe haute : lâchée plus à plat
  if (!c || (typeof G !== 'undefined' && G.tuto) || !G.wind) return NO_BANK;
  const dx = ax - sx, dy = ay - sy, d = Math.hypot(dx, dy) || 1, s = Math.sign(curve);
  // intérieur de la courbe : à l'opposé du renflement de la trajectoire (ctrlFor), là où le disque tourne
  const cross = G.wind.x * (dy / d * s) + G.wind.y * (-dx / d * s);
  return { cross, k: clamp(1 + BANK.DRIFT * cross * c, 0.55, 1.6), kd: clamp(1 + BANK.DUR * cross * c, 0.9, 1.12) };
}
// Temps de vol : un disque lancé contre le vent flotte plus longtemps, avec le vent il file (porté de côté : un peu plus long)
function throwDur(sx, sy, ax, ay, kind, curve) {
  const d = dist(sx, sy, ax, ay) || 0.01, [wx, wy] = windNow();
  const along = (wx * (ax - sx) + wy * (ay - sy)) / d;       // > 0 : vent dans le dos du lanceur
  return flightTime(d) * clamp(1 - 0.01 * along, 0.85, 1.15) * throwK(kind).dur * (curve ? bankWind(sx, sy, ax, ay, curve, kind).kd : 1);
}
// rafales imprévisibles pendant le vol : écart possible de la dérive [en force (×), en direction (rad)]. Une passe courbée
// les subit plus (disque penché) ; plus la passe vole haut, plus le vent la tient, une rasante y échappe en partie
function gustVar(curve, kind) {
  const l = loftOf(kind), hw = loftW(l), cw = 1 + 1.4 * Math.min(1, Math.abs(curve || 0)) * (1 - hw), hf = 1 + 0.3 * hw - 0.3 * loftLow(l);
  return [0.16 * cw * hf, 0.11 * cw * hf];
}
// dérive du vent pendant le vol (bw : effet de l'inclinaison, voir bankWind) : là où le vent emmène l'arrivée ; la forme du vol
// (force du vent, plus forte en hauteur) : flyTableFor (util.js)
function drift(dur, kind, bw) { const [wx, wy] = windNow(), k = dur * DRIFT * throwK(kind).drift * (bw ? bw.k : 1); return [wx * k, wy * k]; }
function windLabel() {
  const { x, y, kmh } = G.wind;
  if (kmh < 4) return 'presque nul';
  const k = Math.round(kmh) + ' km/h';
  if (Math.abs(x) >= Math.abs(y)) return k + (x * dirOf(G.me) > 0 ? ', dans ton dos quand tu attaques' : ', de face quand tu attaques');
  return k + (y < 0 ? ', de côté (vers le haut)' : ', de côté (vers le bas)');
}
// Où viser pour que le disque arrive en (tx, ty) malgré le vent
function aimFor(h, tx, ty, kind, curve) {
  let ax = tx, ay = ty;
  for (let i = 0; i < 3; i++) { const bw = bankWind(h.x, h.y, ax, ay, curve, kind), [dx, dy] = drift(throwDur(h.x, h.y, ax, ay, kind, curve), kind, bw); ax = tx - dx; ay = ty - dy; }
  return [ax, ay];
}
// côté « break » (bloqué par la mark) : -1 = haut du terrain (y petit), +1 = bas
function forceOf(defT) {
  const f = defFormOf(defT);
  if (f === 'zone') return 'middle';
  const D = f === 'mix' && dsysOf(defT);                   // défense perso : sa propre force, ou celle du menu
  return D && D.mark.force !== 'menu' ? D.mark.force : (cfg(defT).force || 'haut');
}
function closedOf(defT) {
  const f = forceOf(defT);
  if (f === 'haut') return 1;                               // force haut : on bloque le bas
  if (f === 'bas') return -1;
  // force middle (et straight up) : le côté de la ligne la plus proche
  const y = disc.mode === 'air' ? anchorFor(defT)[1] : disc.y;   // pendant une passe : là où la défense croit qu'elle arrive
  return y < H / 2 ? -1 : 1;
}
// où se place la mark : côté fermé, ou pile devant en straight up
const MARK_K = { serree: 0.75, normale: 1, lache: 1.7 };
// place de la mark : devant le porteur, côté fermé ; elle se décale avec le pivot du porteur (G.mkShade suit h.pivY avec
// un temps de réaction, voir sim.js) — pivot côté fermé : elle ferme encore plus ; pivot côté open : elle couvre l'intérieur
function markSpot(defT, ax, ay) {
  const h = disc.holder && (disc.mode === 'held' || disc.mode === 'carry') && disc.holder.team !== defT ? disc.holder : null;
  return markSpotFor(defT, ax, ay, h ? G.mkShade || 0 : 0);
}
function markSpotFor(defT, ax, ay, shade) {
  const dir = dirOf(1 - defT), D = defFormOf(defT) === 'mix' && dsysOf(defT), k = D ? MARK_K[D.mark.dist] || 1 : 1;   // défense perso : distance de la mark
  const c = closedOf(defT), sc = shade;                          // > 0 : pivot côté fermé (break) ; < 0 : côté open (concédé)
  if (forceOf(defT) === 'straight') return [ax + dir * 1.2 * k, ay + 0.9 * shade * c * k];
  return [ax + dir * 1.0 * k, ay + c * (1.0 + 0.6 * Math.max(0, sc) + 0.25 * Math.min(0, sc)) * k];
}
// là où le jeu va reprendre (c'est autour de ce point que les équipes se placent)
function anchor() {
  if (disc.mode === 'air') {                                   // (la vraie arrivée : pour les règles et l'affichage, pas pour les IA)
    if (!disc.pull) return [disc.ex, disc.ey];
    const out = disc.ex < 0 || disc.ex > W || disc.ey < 0 || disc.ey > H;   // pull : sorti → brick ou point de sortie (le meilleur) ; dans l'en-but → ramené à la ligne
    if (pullerOffside()) { const b = offsideSpot(); return [b.x, b.y]; }
    if (out) { const [cx, cy] = crossPoint(), c = pullOutChoice(cx, cy).spot; return [c.x, c.y]; }
    const L = lineSpot(disc.ex, disc.ey); return L ? [L.x, L.y] : [disc.ex, disc.ey];
  }
  if ((disc.mode === 'carry' || disc.mode === 'ground') && G.carryTo) return [G.carryTo.x, G.carryTo.y];   // ramené à la ligne / au brick : le jeu reprendra là
  return [disc.x, disc.y];
}
// là où l'équipe t croit que le jeu va reprendre : pendant une passe, la moyenne des arrivées que ses joueurs devinent
// dans le cône (predict.js) ; personne ne connaît la vraie arrivée avant que le disque ne s'en approche
function anchorFor(t) {
  if (disc.mode !== 'air' || disc.pull || !players.some(p => p.guess)) return anchor();
  let x = 0, y = 0, n = 0;
  for (const p of TEAMS[t]) { const [gx, gy] = seenEnd(p); x += gx; y += gy; n++; }
  return n ? [clamp(x / n, 0, W), clamp(y / n, 0, H)] : anchor();   // (une passe qui sort : le jeu reprendra sur la ligne de touche)
}
// team / alt : message réservé à une équipe ; en ligne, ses adversaires voient « alt » à la place (ex. « Play appelé ! »)
function flash(m, localOnly, team, alt) { if (G.attract) return; G.msg = m; G.msgTeam = team === undefined ? null : team; G.msgAlt = alt || ''; G.msgT = 1.8; if (!localOnly) G.msgId++; }
// en ligne, ce qui appartient à l'équipe t est caché à ses adversaires (pas aux spectateurs)
const hiddenFromMe = t => !!G.net && !G.spectator && t !== null && t !== undefined && t !== G.me;

