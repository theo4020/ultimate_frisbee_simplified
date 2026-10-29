// predict.js — Lecture du jeu : qui arrive où, et à temps. Une seule source pour toutes les IA (lanceur, receveur,
// coupeurs, défenseurs), avec les mêmes règles que la simulation (sim.js) :
//  • course réaliste (reachTime : accélération, freinage, virage) ; un défenseur sprinte vers un disque en vol ;
//  • portée des bras (ARM_R), plus haut en sautant, plongeon (layout) pour un disque assez bas ;
//  • temps de réaction : voir le lancer et partir (SEE_T × réaction du niveau).

const SEE_T = 0.25;                                          // temps pour voir un lancer et réagir (s, × réaction du niveau)
const JUMP_RISK = 0.45, DIVE_RISK = 0.12;                    // un contre en sautant ou en plongeon est moins sûr (s de marge)
// plongeon : il s'ajoute à l'élan — vitesse dans sa direction = élan dans cette direction + boost (au moins DIVE.min),
// l'élan sur le côté est gardé
function diveVel(p, x, y) {
  let dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy);
  if (l < 0.3) { dx = p.vx || 0; dy = p.vy || 0; l = Math.hypot(dx, dy); }
  if (l < 0.01) { dx = dirOf(p.team); dy = 0; l = 1; }
  const ux = dx / l, uy = dy / l, along = (p.vx || 0) * ux + (p.vy || 0) * uy, sp = Math.max(DIVE.min, along + DIVE.boost);
  return [(p.vx || 0) - along * ux + ux * sp, (p.vy || 0) - along * uy + uy * sp];
}
const diveReach = v => Math.max(DIVE.min, (v || 0) + DIVE.boost) * DIVE_T + DIVE_R;   // distance couverte par un plongeon lancé à v m/s, bras compris
const seeT = p => SEE_T * aiLvl(p.team).react;

// ---------- où va le disque ? (cône d'incertitude) ----------
// rayon du cercle d'arrivée au lâcher (m) : imprécision du lancer et rafales, avec un minimum qui grandit avec la distance
const coneR = (d, curve, kind, wx, wy) => Math.max(CONE.MIN + CONE.PER * d, throwErr(d, curve, kind) + Math.hypot(wx || 0, wy || 0) * 0.08);
// part du cône qui reste (1 au lâcher → 0 à l'arrivée)
const coneLeft = () => (disc.mode === 'air' ? Math.max(0, 1 - disc.t / disc.dur) ** CONE.K : 0);
// erreur de lecture d'un joueur IA (× rayon du cône) : un joueur qui lit bien le jeu devine mieux l'arrivée
function readErr(p) { const L = aiLvl(p.team), r = L && L.k ? L.k.read : 0.5; return clamp(0.3 + 0.7 * (1 - r), CONE.READ_MIN, CONE.READ_MAX); }
// au lâcher : chaque joueur se fait une idée de l'arrivée (p.guess, décalage en m), qui s'affine à mesure que le disque approche
function makeGuesses(thrower) {
  for (const p of players) {
    p.guess = null;
    if (p === thrower || G.tuto || !disc.cone) continue;
    const a = rand(0, Math.PI * 2), m = disc.cone * readErr(p) * Math.sqrt(Math.random());
    p.guess = [Math.cos(a) * m, Math.sin(a) * m];
  }
}
// point de la trajectoire restante (v ≥ maintenant) tel que le joueur p le croit : la vraie trajectoire, qui glisse vers
// son arrivée supposée (son erreur fond avec le cône)
function seenAt(p, v) {
  const [x, y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, v), g = p && p.guess;
  if (!g || disc.pull || disc.mode !== 'air') return [x, y];
  const u = disc.t / disc.dur, s = coneLeft(), w = u >= 1 ? 1 : clamp((v - u) / (1 - u), 0, 1);
  return [x + g[0] * s * w, y + g[1] * s * w];
}
const seenEnd = p => seenAt(p, 1);

// attaquant : temps pour être en position de recevoir en (x, y)
function recvTime(p, x, y) { return reachTime(p, x, y, SPD.cut * aiLvl(p.team).speed, 0.9); }
// défenseur qui suit le jeu (avant le lancer) : temps pour arriver en (x, y), réaction comprise
function guardTime(d, x, y) { return reachTime(d, x, y, SPD.def * aiLvl(d.team).speed, ARM_R) + seeT(d); }
// défenseur qui chasse un disque passant en (x, y) à la hauteur z : temps pour le toucher (react = délai avant de partir).
// Infinity : trop haut, même en sautant. Négatif : il l'a déjà dans les bras.
function touchTime(d, x, y, z, react) {
  const L = aiLvl(d.team), v = SPD.sprint * L.speed;
  if (z > REACH_STAND + (L.jump || JUMP_H)) return Infinity;
  if (dist(d.x, d.y, x, y) < ARM_R) return -0.6;
  let t = reachTime(d, x, y, v, ARM_R) + react;
  if (z > REACH_STAND) t += JUMP_RISK;                       // seulement en sautant
  else if (z < REACH_DIVE) t = Math.min(t, reachTime(d, x, y, v, diveReach(v)) + DIVE_T + react + DIVE_RISK);   // layout
  return t;
}
// marge d'une trajectoire : pour chaque point du vol, le défenseur le plus rapide comparé au disque (s ; > 0 : passe sûre).
// path = { sx, sy, cx, cy, ex, ey, dur, z(u) } ; mark = { p, x, y } : la mark, à sa place au lâcher, se fend vers le disque ;
// misread (s) : erreur de lecture de celui qui juge (il croit les défenseurs plus lents qu'ils ne sont)
function pathSlack(path, opp, mark, misread) {
  let min = 9;
  // par défenseur, une fois : réaction, vitesse, portée en sautant et en plongeon (pour écarter vite ceux qui sont trop loin)
  const D = opp.map(o => { const L = aiLvl(o.team), v = SPD.sprint * L.speed; return { o, react: seeT(o) + (misread || 0), v, jmax: REACH_STAND + (L.jump || JUMP_H), far: Math.max(ARM_R, diveReach(v)) }; });
  for (let u = 0.04; u <= 1.001; u += 0.06) {
    const z = path.z(u), [x, y] = bez(path.sx, path.sy, path.cx, path.cy, path.ex, path.ey, u), tA = u * path.dur;
    for (const q of D) {
      const o = q.o; let s;
      if (z > q.jmax) continue;
      if (mark && (o.src || o) === mark.p) {
        s = dist(mark.x, mark.y, x, y) < ARM_R + (tA < MARK_LUNGE_T ? MARK_LUNGE : 0) ? -0.6 : 9;
        if (s < 0 && z > REACH_STAND) s += JUMP_RISK;
      } else {
        const d = dist(o.x, o.y, x, y);
        if (d > q.far && (d - q.far) / q.v + q.react - tA >= min) continue;   // même au mieux, il ne ferait pas moins bien que la marge déjà trouvée
        s = touchTime(o, x, y, z, q.react) - tA;
      }
      if (s < min) min = s;
    }
  }
  return min;
}
// disque en vol : premier point de la trajectoire restante où ce défenseur peut le toucher avant lui (il court déjà)
function firstTouch(d) {
  const u0 = disc.t / disc.dur;
  for (let u = u0 + 0.03; u <= 1.001; u += 0.04) {
    const z = discZ(u);
    if (z > REACH_STAND - 0.1) continue;                     // les sauts sont gérés à part (aiJumps)
    const [x, y] = seenAt(d, u), tA = (u - u0) * disc.dur;
    if (touchTime(d, x, y, z, 0) + 0.05 <= tA) return { x, y, tA, r: dist(d.x, d.y, x, y) };
  }
  return null;
}
// disque en vol : premier point de la trajectoire où ce receveur arrive à temps (dans le terrain), debout ou en sautant
// (en sautant : il lui faut en plus le temps de s'accroupir et de monter ; il saute tout seul, voir aiJumps)
function catchPoint(p) {
  // (pull : on ne saute pas pour le rattraper, voir aiJumps ; il vise un point où le disque est à portée debout)
  const u0 = disc.t / disc.dur, jmax = disc.pull ? REACH_STAND - 0.1 : REACH_STAND + 0.85 * jumpH(p), len = discLen();
  for (let u = u0 + 0.02; u <= 1.001; u += 0.025) {
    const z = discZ(u); if (z > jmax) continue;
    const [x, y] = seenAt(p, u);
    if (!inField(x, y) || (u < 0.45 && u * len < 3)) continue;   // pas hors du terrain, ni collé au lanceur
    const extra = z > REACH_STAND ? JUMP_PREP + JUMP_T * 0.4 : 0;
    if (recvTime(p, x, y) <= Math.max(0, (u - u0) * disc.dur - 0.06 - extra)) return lateCatch(p, u, x, y) || [x, y, true];
  }
  return null;
}
// seul (ou il le croit : défenseurs vus, vision.js) : au lieu d'attraper le disque au plus tôt, il le laisse venir pour
// gagner du terrain — le plus loin possible sur la trajectoire tant qu'aucun défenseur ne peut le disputer (marge LATE.M s)
const LATE = { M: 0.55, GAIN: 1.5 };
function lateCatch(p, ue, ex, ey) {
  if (disc.pull || G.tuto || G.practice) return null;
  const u0 = disc.t / disc.dur, dir = dirOf(p.team), opp = TEAMS[1 - p.team].map(d => seen(p, d));
  let best = null;
  for (let u = ue; u <= 0.97; u += 0.025) {
    const z = discZ(u), [x, y] = seenAt(p, u), tA = (u - u0) * disc.dur;
    if (!inField(x, y)) break;
    if (opp.some(d => touchTime(d, x, y, z, 0.15) < tA + LATE.M)) break;   // un défenseur pourrait arriver : on ne va pas plus loin
    if (z <= REACH_STAND && recvTime(p, x, y) <= tA - 0.06) best = [x, y];
  }
  return best && dir * (best[0] - ex) >= LATE.GAIN ? [best[0], best[1], true] : null;
}
