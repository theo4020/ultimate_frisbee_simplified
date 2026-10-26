// vision.js — Ce que chaque joueur IA sait du terrain : vision limitée, coups d'œil et mémoire.
// Un humain voit tout le terrain d'en haut ; un joueur IA, lui, ne connaît que ce qu'il a vu :
//  • il regarde dans une direction (le porteur balaie le terrain, les autres suivent le disque) et voit dans un cône
//    (VIS.FOV × son niveau), plus tout ce qui est tout près de lui (VIS.NEAR) ;
//  • il ne prend l'information que par coups d'œil (toutes les L.look s) : entre deux, il se fie à sa mémoire ;
//  • de mémoire, un bon joueur prolonge les courses qu'il a vues (L.ext), un débutant croit les joueurs restés sur place ;
//  • après une réception, il lui faut le temps de lever la tête (L.lift) avant son premier coup d'œil.
// Coût : un coup d'œil = 9 tests d'angle, quelques fois par seconde et par joueur ; les décisions lisent des « fantômes »
// (positions de mémoire), sans calcul en plus.

const VIS = { NEAR: 3.5, OLD: 1.5 };                        // toujours vu à moins de NEAR m ; une course n'est prolongée que OLD s
const visOn = () => !G.tuto && !G.practice;
const pIdx = p => p.team * N + p.i;

// tout le monde connaît la situation de départ (début de point, reprise après une pause…)
function visReset() {
  for (const p of players) {
    p.mem = players.map(q => ({ x: q.x, y: q.y, vx: q.vx, vy: q.vy, t: G.gt }));
    p.lookT = rand(0, 0.2); p.scanI = 0;
  }
}
// après une réception : le porteur doit lever la tête avant de lire le jeu (il commence par regarder devant lui)
function visCatch(p) { const L = aiLvl(p.team); p.lookT = L.lift || 0.2; p.scanI = 0; }

// direction où il regarde : le porteur balaie (devant, côté open, côté break, puis derrière vers le relais quand le compte
// monte) ; les autres regardent le disque
function lookDir(p) {
  if ((disc.mode === 'held' || disc.mode === 'carry') && disc.holder === p) {
    const base = dirOf(p.team) > 0 ? 0 : Math.PI, open = -closedOf(1 - p.team) * dirOf(p.team);
    const seq = G.stall > 3.5 ? [0, 1.1, -1.1, Math.PI] : [0, 1.1, -1.1];
    return base + seq[p.scanI % seq.length] * (open || 1);
  }
  const dx = disc.x - p.x, dy = disc.y - p.y;
  return Math.hypot(dx, dy) > 0.5 ? Math.atan2(dy, dx) : (dirOf(p.team) > 0 ? 0 : Math.PI);
}
function glance(p) {
  const L = aiLvl(p.team), a = lookDir(p), fov = L.fov || 1, ca = Math.cos(a), sa = Math.sin(a), cf = Math.cos(fov);
  for (const q of players) {
    const m = p.mem[pIdx(q)], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
    if (q === p || d < VIS.NEAR || (dx * ca + dy * sa) / (d || 1) >= cf) { m.x = q.x; m.y = q.y; m.vx = q.vx; m.vy = q.vy; m.t = G.gt; }
  }
  if (disc.holder === p) p.scanI++;
}
function visTick(dt) {
  if (!visOn()) return;
  if (!players[0].mem) visReset();
  for (const p of players) {
    if (controllerOf(p) && userControls(p)) continue;       // joueur dirigé par un humain : il n'a pas besoin de mémoire
    p.lookT -= dt;
    if (p.lookT > 0) continue;
    glance(p);
    const L = aiLvl(p.team); p.lookT = (L.look || 0.25) * rand(0.8, 1.2);
  }
}
// ce que p croit savoir de q : sa dernière position vue, prolongée selon sa lecture du jeu. Le fantôme garde tout le reste
// de q (équipe, rôle…) ; src = le vrai joueur
function seen(p, q) {
  if (!visOn() || !p.mem || p === q) return q;
  const m = p.mem[pIdx(q)], age = G.gt - m.t;
  if (age < 0.02) return q;
  // un coéquipier qui coupe annonce sa course (on la prolonge mieux) ; un adversaire, seulement selon sa lecture du jeu
  const ext = q.team === p.team ? Math.max(0.7, aiLvl(p.team).ext || 0) : aiLvl(p.team).ext || 0;
  const k = ext * Math.min(1, VIS.OLD / Math.max(age, 0.01)), ta = Math.min(age, VIS.OLD);
  const g = Object.create(q);
  g.x = m.x + m.vx * ta * k; g.y = m.y + m.vy * ta * k; g.vx = m.vx * k; g.vy = m.vy * k; g.src = q;
  return g;
}
const seenAll = (p, list) => list.map(q => seen(p, q));
// ce que l'équipe t sait de q : ses joueurs se parlent, on garde le souvenir le plus récent (défense de zone, lecture collective)
function teamSeen(t, q) {
  if (!visOn()) return q;
  let best = null, bt = -1e9;
  for (const p of TEAMS[t]) {
    if (!p.mem || (controllerOf(p) && userControls(p))) continue;
    const m = p.mem[pIdx(q)]; if (m.t > bt) { bt = m.t; best = p; }
  }
  return best ? seen(best, q) : q;
}
