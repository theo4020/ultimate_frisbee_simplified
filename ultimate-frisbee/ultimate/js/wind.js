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
// Temps de vol : un disque lancé contre le vent flotte plus longtemps, avec le vent il file
function throwDur(sx, sy, ax, ay) {
  const d = dist(sx, sy, ax, ay) || 0.01, [wx, wy] = windNow();
  const along = (wx * (ax - sx) + wy * (ay - sy)) / d;       // > 0 : vent dans le dos du lanceur
  return flightTime(d) * clamp(1 - 0.01 * along, 0.85, 1.15);
}
function drift(dur) { const [wx, wy] = windNow(); return [wx * dur * DRIFT, wy * dur * DRIFT]; }
function windLabel() {
  const { x, y, kmh } = G.wind;
  if (kmh < 4) return 'presque nul';
  const k = Math.round(kmh) + ' km/h';
  if (Math.abs(x) >= Math.abs(y)) return k + (x * dirOf(G.me) > 0 ? ', dans ton dos quand tu attaques' : ', de face quand tu attaques');
  return k + (y < 0 ? ', de côté (vers le haut)' : ', de côté (vers le bas)');
}
// Où viser pour que le disque arrive en (tx, ty) malgré le vent
function aimFor(h, tx, ty) {
  let ax = tx, ay = ty;
  for (let i = 0; i < 3; i++) { const [dx, dy] = drift(throwDur(h.x, h.y, ax, ay)); ax = tx - dx; ay = ty - dy; }
  return [ax, ay];
}
// côté « break » (bloqué par la mark) : -1 = haut du terrain (y petit), +1 = bas
function forceOf(defT) { return defFormOf(defT) === 'zone' ? 'middle' : cfg(defT).force; }
function closedOf(defT) {
  const f = forceOf(defT);
  if (f === 'haut') return 1;                               // force haut : on bloque le bas
  if (f === 'bas') return -1;
  const y = disc.mode === 'air' ? disc.ey : disc.y;          // force middle : on bloque le côté de la ligne la plus proche
  return y < H / 2 ? -1 : 1;
}
function anchor() { return disc.mode === 'air' ? [disc.ex, disc.ey] : [disc.x, disc.y]; }
function flash(m, localOnly) { G.msg = m; G.msgT = 1.8; if (!localOnly) G.msgId++; }

