// predict.js — Lecture du jeu : qui arrive où, et à temps. Une seule source pour toutes les IA (lanceur, receveur,
// coupeurs, défenseurs), avec les mêmes règles que la simulation (sim.js) :
//  • course réaliste (reachTime : accélération, freinage, virage) ; un défenseur sprinte vers un disque en vol ;
//  • portée des bras (ARM_R), plus haut en sautant, plongeon (layout) pour un disque assez bas ;
//  • temps de réaction : voir le lancer et partir (SEE_T × réaction du niveau).

const SEE_T = 0.25;                                          // temps pour voir un lancer et réagir (s, × réaction du niveau)
const JUMP_RISK = 0.45, DIVE_RISK = 0.12;                    // un contre en sautant ou en plongeon est moins sûr (s de marge)
const diveReach = () => SPD.dive * DIVE_T + DIVE_R;          // distance couverte par un plongeon, bras compris
const seeT = p => SEE_T * aiLvl(p.team).react;

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
  else if (z < REACH_DIVE) t = Math.min(t, reachTime(d, x, y, v, diveReach()) + DIVE_T + react + DIVE_RISK);   // layout
  return t;
}
// marge d'une trajectoire : pour chaque point du vol, le défenseur le plus rapide comparé au disque (s ; > 0 : passe sûre).
// path = { sx, sy, cx, cy, ex, ey, dur, z(u) } ; mark = { p, x, y } : la mark, à sa place au lâcher, se fend vers le disque
function pathSlack(path, opp, mark, react) {
  let min = 9;
  for (let u = 0.04; u <= 1.001; u += 0.06) {
    const z = path.z(u), [x, y] = bez(path.sx, path.sy, path.cx, path.cy, path.ex, path.ey, u), tA = u * path.dur;
    for (const o of opp) {
      let s;
      if (mark && o === mark.p) {
        if (z > REACH_STAND + (aiLvl(o.team).jump || JUMP_H)) continue;
        s = dist(mark.x, mark.y, x, y) < ARM_R + (tA < MARK_LUNGE_T ? MARK_LUNGE : 0) ? -0.6 : 9;
        if (s < 0 && z > REACH_STAND) s += JUMP_RISK;
      } else s = touchTime(o, x, y, z, react === undefined ? seeT(o) : react) - tA;
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
    const [x, y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u), tA = (u - u0) * disc.dur;
    if (touchTime(d, x, y, z, 0) + 0.05 <= tA) return { x, y, tA, r: dist(d.x, d.y, x, y) };
  }
  return null;
}
// disque en vol : premier point de la trajectoire où ce receveur arrive à temps (dans le terrain, à hauteur d'attrape)
function catchPoint(p) {
  const u0 = disc.t / disc.dur;
  for (let u = Math.max(u0 + 0.02, 0.5); u <= 1.001; u += 0.025) {
    if (discZ(u) > REACH_STAND) continue;
    const [x, y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u);
    if (!inField(x, y)) continue;                            // il ne va pas chercher le disque hors du terrain
    if (recvTime(p, x, y) <= Math.max(0, (u - u0) * disc.dur - 0.06)) return [x, y, true];
  }
  return null;
}
