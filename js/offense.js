// offense.js — IA offensive : rôles (handler, dump, cutters), stack, cuts

// =====================================================================
//  Rôles offensifs : porteur, « dump » (relais) et coupeurs ordonnés
// =====================================================================
// relais : derrière le disque, côté fermé, à 6 m environ ; près d'une ligne, il recule au lieu de se coller au porteur
const DUMP_D = 6, HOLDER_ROOM = 4.5;
function dumpSlot(ax, ay, dir, open) {
  const y = clamp(ay - open * 5, 2, H - 2), lat = Math.abs(y - ay);
  const back = Math.sqrt(Math.max(0, DUMP_D * DUMP_D - lat * lat));
  return { x: clamp(ax - dir * Math.max(3.3, back), 1, W - 1), y };
}
// personne ne vient se coller au porteur (sauf en pleine course) : la cible est repoussée à HOLDER_ROOM du disque
function roomAroundHolder(p) {
  const h = disc.holder;
  if (!h || disc.mode !== 'held' || h === p || h.team !== p.team) return;
  if (dist(p.x, p.y, h.x, h.y) < 3.2) p.sp = Math.max(p.sp, SPD.cut * 0.85);   // collé au porteur : il s'écarte vite
  const d = dist(p.tx, p.ty, h.x, h.y);
  if (d >= HOLDER_ROOM) {                                    // le trajet passe tout près du porteur : il le contourne
    const vx = p.tx - p.x, vy = p.ty - p.y, l2 = vx * vx + vy * vy;
    if (l2 < 1) return;
    const u = clamp(((h.x - p.x) * vx + (h.y - p.y) * vy) / l2, 0, 1), cx = p.x + vx * u, cy = p.y + vy * u, dc = dist(cx, cy, h.x, h.y);
    if (u <= 0 || u >= 1 || dc >= HOLDER_ROOM - 0.5) return;
    let ox = cx - h.x, oy = cy - h.y; if (dc < 0.01) { ox = -vy; oy = vx; }
    const lo = Math.hypot(ox, oy) || 1;
    let wx = clamp(h.x + ox / lo * HOLDER_ROOM, 1, W - 1), wy = clamp(h.y + oy / lo * HOLDER_ROOM, 1.5, H - 1.5);
    if (dist(wx, wy, h.x, h.y) < HOLDER_ROOM - 0.5) {        // porteur collé à la ligne : on passe de l'autre côté (dans le terrain)
      wx = clamp(h.x - ox / lo * HOLDER_ROOM, 1, W - 1); wy = clamp(h.y - oy / lo * HOLDER_ROOM, 1.5, H - 1.5);
    }
    p.tx = wx; p.ty = wy;
    return;
  }
  let ux = p.tx - h.x, uy = p.ty - h.y;
  if (d < 0.01) { ux = p.x - h.x || -dirOf(p.team); uy = p.y - h.y; }
  const l = Math.hypot(ux, uy) || 1;
  p.tx = clamp(h.x + ux / l * HOLDER_ROOM, 1, W - 1); p.ty = clamp(h.y + uy / l * HOLDER_ROOM, 1.5, H - 1.5);
}
function stackY(ay) { return clamp(H / 2 + (ay - H / 2) * 0.3, 9, H - 9); }
// ligne du stack : au centre (vertical) ou le long de la ligne côté break (side stack)
const isColumn = form => form === 'vert' || form === 'side';
function lineY(t, ay, form) {
  if (form !== 'side') return stackY(ay);
  const open = -closedOf(1 - t);
  return clamp(H / 2 - open * 11, 5, H - 5);
}

// =====================================================================
//  Rôles selon la position : personne n'a de rôle attitré
// =====================================================================
// Le plus en arrière par rapport au disque devient handler (le relais, « dump ») ; un autre joueur resté derrière
// le disque devient le second handler (swing, côté open). Les autres sont coupeurs, rangés selon leur position
// (profondeur en colonne, largeur en horizontal). Revu 4 fois par seconde : un coupeur qui revient derrière le disque
// devient handler, un handler qui remonte devient coupeur. Un joueur en pleine course la finit avant de changer de rôle.
const ROLE_SWAP = 2;                                         // m : il faut être nettement plus en arrière pour prendre la place
const runBusy = p => p.state === 'jab' || p.state === 'cut' || p.state === 'hold' || p.state === 'reset';
function sortCutters(t, list, ax) {
  const dir = dirOf(t);
  return isColumn(formOf(t)) ? list.sort((a, b) => dir * (a.x - b.x)) : list.sort((a, b) => a.y - b.y);
}
function pickHandlers(t, h, mates) {
  const dir = dirOf(t), depth = p => dir * (p.x - h.x), free = mates.filter(p => !runBusy(p) && !userControls(p));
  const byBack = free.slice().sort((a, b) => depth(a) - depth(b));
  let dump = mates.find(p => p.role === 'dump' && p.hIdx !== 1) || null;
  const back = byBack[0] || null;
  if (!dump || (!runBusy(dump) && back && back !== dump && (depth(back) < depth(dump) - ROLE_SWAP || depth(dump) > 8))) dump = back || dump;
  const swing = byBack.find(p => p !== dump && depth(p) < -1) || null;
  return [dump, swing];
}
function setRole(p, role, hIdx) {
  const was = p.role; p.role = role; p.hIdx = hIdx;
  if (was === role || runBusy(p)) return;
  if (role === 'dump') { p.state = 'set'; p.timer = 1; } else if (p.state !== 'clear') { p.state = 'stack'; p.timer = 0; }
}
function refreshRoles(t, h) {
  if (osysOf(t)) { sysRefresh(t, h); return; }
  const mates = TEAMS[t].filter(p => p !== h), [dump, swing] = pickHandlers(t, h, mates);
  for (const p of mates) {
    if (p === dump) setRole(p, 'dump', 0);
    else if (p === swing) setRole(p, 'dump', 1);
    else if (!(runBusy(p) && p.role === 'dump')) setRole(p, 'cutter', 0);
  }
  G.order[t] = sortCutters(t, mates.filter(p => p.role === 'cutter'), h.x);
}
function assignRoles(t, h) {
  if (osysOf(t)) { sysAssign(t, h); return; }                 // système perso (systems.js)
  const others = TEAMS[t].filter(p => p !== h);
  others.forEach(p => { p.poste = null; p.role = null; p.state = 'stack'; p.timer = 0; });   // formation du jeu : consignes « au choix de l'IA »
  const [dump, swing] = pickHandlers(t, h, others);
  for (const p of others) { p.role = p === dump || p === swing ? 'dump' : 'cutter'; p.hIdx = p === swing ? 1 : 0; if (p.role === 'dump') { p.state = 'set'; p.timer = 1; } }
  G.order[t] = sortCutters(t, others.filter(p => p.role === 'cutter'), h.x);
  h.role = 'holder';
  G.cutT = 0.4;
}

function cutterSlot(p, t, ax, ay, dir, form) {
  const S = osysOf(t); if (S) return sysSpot(S, p, ax, ay, dir, -closedOf(1 - t));
  const ord = G.order[t], n = Math.max(1, ord.length);
  let idx = ord.indexOf(p); if (idx < 0) idx = n - 1;
  const avail = depthLeft(ax, dir);
  if (isColumn(form)) {
    const start = Math.min(13, Math.max(5, avail * 0.35));          // le stack se tient loin du disque : de l'espace pour couper
    const sp = clamp((avail - start) / Math.max(1, n - 0.5), 2.5, 5);
    return { x: clamp(ax + dir * (start + sp * idx), 1.5, W - 1.5), y: lineY(t, ay, form) };
  }
  const lanes = n >= 3 ? [6, H / 2, H - 6] : n === 2 ? [10, H - 10] : [H / 2];
  const depth = Math.min(17, Math.max(6, avail * 0.6));
  return { x: clamp(ax + dir * depth, 1.5, W - 1.5), y: lanes[Math.min(idx, lanes.length - 1)] };
}

// un joueur resté loin derrière le jeu remonte en courant au lieu de trottiner
function hustle(p, base) {
  const far = flowOf(p.team) ? 7 : 3.5;                      // structuré : on se replace vite (dès 3,5 m de sa place)
  return dist(p.x, p.y, p.tx, p.ty) > far ? Math.max(base, SPD.cut * 0.92) : base;
}

// =====================================================================
//  Coupes : on lit l'espace au lieu de suivre un script
// =====================================================================
// Pour chaque coupeur prêt et chaque point d'une grille devant le disque, on estime :
//  • la course : le coupeur arrive-t-il avant le défenseur le plus proche de ce point ? (réaction comprise)
//  • la ligne de passe : le porteur peut-il lancer jusque-là sans qu'un défenseur coupe la trajectoire ?
//  • le terrain gagné (plus encore pour une équipe qui aime le jeu long), l'en-but
//  • l'espace des autres : on ne coupe pas dans la zone d'une coupe déjà en cours
// La meilleure coupe part si elle est assez bonne ; sinon on attend que l'espace s'ouvre (l'exigence baisse avec le temps et le stall).
const CUT_F = [4, 7, 10, 13, 16, 20, 24, 28, 32];
// consignes du poste d'un joueur (formation perso) ; formation du jeu : tout « au choix de l'IA »
const posteOf = p => p.poste || POSTE_DEF;
// la coupe vers (f m devant le disque, s m côté open) respecte-t-elle la zone de son poste ?
function zoneOk(c, f, s, x, y, h) {
  const P = posteOf(c), z = P.zone === 'auto' && P.role === 'deep' ? 'deep' : P.zone;
  if (z === 'open') return s >= 3 && f < 22;
  if (z === 'break') return s <= -3 && f < 22;
  if (z === 'deep') return f >= 18;
  if (z === 'under') return f < 13 && dist(x, y, h.x, h.y) < dist(c.x, c.y, h.x, h.y) - 3;   // il revient vers le disque
  return true;
}
function bestCut(t, h, ax, ay, dir, open, cands, need) {
  const opp = TEAMS[1 - t], huckK = aiStyle(t).huck;
  const busy = TEAMS[t].filter(p => p !== h && (p.state === 'jab' || p.state === 'cut' || p.state === 'park')).map(p => [p.cx, p.cy]);
  let best = null;
  for (const f of CUT_F) {
    const x = ax + dir * f;
    if (x < 1.5 || x > W - 1.5) continue;
    for (let y = 2.5; y <= H - 2.5; y += 3.2) {
      if (busy.some(([cx, cy]) => dist(cx, cy, x, y) < 7)) continue;            // l'espace d'une autre coupe
      const lane = clamp(laneSlack(h, x, y, x, y, 0, opp, 'normal', undefined, aiLvl(t).misread), -1, 0.6);
      if (lane < -0.4 && need > -50) continue;                 // (personne ne bouge : on coupe quand même, pour faire bouger la défense)
      let td = 1e9;
      for (const d of opp) { if (d === G.marker) continue; td = Math.min(td, guardTime(d, x, y)); }
      const gain = f * 0.14 - (f > 18 ? (1.7 - huckK) * 2 : 0) + (inScoreZone(t, x) ? 4 : 0) - (open * (y - ay) < -4 ? 0.8 : 0);   // deep : risqué (sauf équipes de hucks) ; côté break : passe plus dure
      for (const c of cands) {
        const dc = dist(c.x, c.y, x, y);
        if (dc < 3.5 || dc > 27 || !zoneOk(c, f, open * (y - ay), x, y, h)) continue;
        const race = td - (recvTime(c, x, y) + 0.1);                                              // > 0 : le coupeur arrive le premier
        const v = clamp(race, -1.5, 1.5) * 3 + lane * 3 + gain - dc * 0.04;
        if (v > need && (!best || v > best.v)) best = { c, x, y, v, deep: f > 18 };
      }
    }
  }
  return best;
}
const cutReady = (p, t, restless) => p.role === 'cutter' && !userControls(p) && (p.state === 'stack' || (p.state === 'clear' && (p.wDone || restless))) && G.gt - (p.cutEnd || -9) > (restless ? 0.3 : 0.6);
function launchCut(b) {
  startCut(b.c, b.x, b.y, b.deep);
  G.cutIdle = 0; G.lastCutAt = G.gt;
}
// style d'attaque (menu, à côté de la formation) : « structuré » = on se replace avant de recouper, on n'enchaîne que si
// un coupeur est déjà lancé ; « enchaîné » = le jeu continue dès la réception (flow)
const CUT_FROM = 4;
const flowOf = t => (cfg(t) || {}).flow === 'flow';
// Juste après une réception : le coupeur le mieux placé propose aussitôt la passe suivante (continuation)
function continuationCut(t, h) {
  if (G.oplay && G.oplay.team === t) return;
  const dir = dirOf(t), open = -closedOf(1 - t);
  // seulement un coupeur déjà lancé vers l'espace (le jeu continue), ou un poste réglé « juste après une réception » ;
  // sinon tout le monde se replace et la formation réapparaît
  const flow = flowOf(t);
  const cands = G.order[t].filter(p => !userControls(p) && p.state !== 'jab' && p.state !== 'cut'
    && (posteOf(p).when === 'catch' || (['auto', 'turn'].includes(posteOf(p).when) && (flow || (p.state === 'stack' && Math.hypot(p.vx, p.vy) > 4.5)))));
  let b = bestCut(t, h, h.x, h.y, dir, open, cands, flow ? 1.5 : 3.2);   // structuré : vraiment ouvert, sinon on se replace
  if (b && !flow && posteOf(b.c).when !== 'catch') {          // la coupe doit prolonger sa course, pas la retourner
    const c = b.c, ahead = dist(b.x, b.y, c.x + c.vx * 1.3, c.y + c.vy * 1.3);   // là où sa course l'emmène déjà
    if (ahead > 6.5) b = null;
  }
  if (b) { launchCut(b); b.c.state = 'cut'; b.c.timer = Math.max(2.4, dist(b.c.x, b.c.y, b.x, b.y) / SPD.cut + 0.6); }   // déjà lancé : pas de feinte
  G.cutT = 0.4;
}
function clampPt(o) { o.cx = clamp(o.cx, 1.5, W - 1.5); o.cy = clamp(o.cy, 1.5, H - 1.5); }

// Le « chef d'orchestre » des coupes : 4 fois par seconde, une coupe part si l'espace le mérite
function runCutSequencer(t, ax, ay, dir, open, form, dt) {
  if (disc.mode !== 'held' || !disc.holder) return;
  const P = G.oplay && G.oplay.team === t ? G.oplay : null;
  if (P && (P.type === 'sys' || P.type === 'flood')) return;  // ces plays dirigent toutes les courses ; les autres ne gèlent que leurs coupeurs
  G.cutIdle = (G.cutIdle || 0) + dt;
  G.cutT -= dt;
  if (G.cutT > 0) return;
  G.cutT = 0.25;
  refreshRoles(t, disc.holder);                             // rôles selon la position du moment
  const ord = G.order[t];
  const running = ord.filter(p => p.state === 'jab' || p.state === 'cut').length;
  G.noRun = running ? 0 : (G.noRun || 0) + 0.25;            // depuis combien de temps personne ne coupe
  if (running >= (G.stall > 4 || G.holdT > 2.5 ? 2 : 1)) return;
  const restless = G.noRun >= 0.25;                          // personne ne bouge depuis un moment : quelqu'un repart, même vers une option moyenne   // le porteur attend : une deuxième coupe part             // une coupe à la fois ; deux quand le compte presse
  // consignes « quand couper » : jamais, juste après une réception (voir continuationCut), quand le stall monte,
  // à son tour (seul le premier poste « à son tour » prêt, dans l'ordre des postes)
  let turn = false;
  const flow = flowOf(t);
  const ready = ord.filter(p => {
    if (!cutReady(p, t, restless) || (P && P.targets.includes(p))) return false;
    const sl = cutterSlot(p, t, ax, ay, dir, form);
    // structuré : on se replace d'abord ; mais si le porteur attend déjà depuis un moment, on coupe d'où l'on est
    if (!flow && !restless && dist(p.x, p.y, sl.x, sl.y) > CUT_FROM && G.holdT < 1.2 && G.stall < 3) return false;
    const w = posteOf(p).when;
    if (w === 'never' || w === 'catch' || (w === 'stall' && G.stall < 4.5)) return false;
    if (w === 'turn') { if (turn) return false; turn = true; }
    return true;
  });
  if (!ready.length) return;
  const need = restless ? -99 : 3.4 - G.cutIdle * 1.2 - G.stall * 0.25;   // plus on attend, moins on est exigeant
  const b = bestCut(t, disc.holder, ax, ay, dir, open, ready, need);
  if (b) launchCut(b);
}
// un joueur au repos laisse libre la zone d'une coupe en cours et la ligne de passe qui y mène
function leaveSpace(p, t, x, y) {
  const h = disc.holder; if (!h || disc.mode !== 'held') return [x, y];
  for (const c of TEAMS[t]) {
    if (c === p || c === h || !(c.state === 'jab' || c.state === 'cut' || c.state === 'park')) continue;
    // distance au segment porteur → arrivée de la coupe
    const vx = c.cx - h.x, vy = c.cy - h.y, l2 = vx * vx + vy * vy || 1;
    const u = clamp(((x - h.x) * vx + (y - h.y) * vy) / l2, 0, 1), px = h.x + vx * u, py = h.y + vy * u;
    const d = dist(x, y, px, py), lim = u > 0.85 ? 6 : 4;
    if (d < lim) { const k = (lim - d) / Math.max(d, 0.3); x += (x - px) * k; y += (y - py) * k; }
  }
  return [clamp(x, 1, W - 1), clamp(y, 1.5, H - 1.5)];
}

// Un attaquant laissé seul (son défenseur est parti ailleurs) file dans l'espace libre,
// de préférence côté open et vers l'avant : laisser son joueur doit coûter cher.
const FREE_R = 6;
function isAbandoned(p, t) {
  const df = defFormOf(1 - t);
  if ((df !== 'man' && df !== 'mix') || p === disc.holder) return false;
  const dfn = TEAMS[1 - t], g = dfn.find(d => d.match === p);
  if (df === 'mix' && !g) return false;                      // défense perso : il est dans une zone, personne ne l'a lâché
  return (!g || dist(g.x, g.y, p.x, p.y) > FREE_R + 2) && nearestD(dfn, p.x, p.y)[1] > 5;
}
function freeSpace(p, t, ax, ay, dir, open) {
  const dfn = TEAMS[1 - t];
  let best = null, bv = -1e9;
  for (const k of [10, 14, 18, 23, 28]) {
    const x = ax + dir * k;
    if (x < 1 || x > W - 1) continue;
    for (const y of [4, 10, 16, 21, 27, 33]) {
      const room = Math.min(12, nearestD(dfn, x, y)[1]);
      // il se place là où le handler peut lui lancer (ligne de passe dégagée)
      const lane = disc.holder ? clamp(laneSlack(disc.holder, x, y, x, y, 0, dfn), -1, 0.6) : 0;
      const v = room * 1.1 + lane * 6 + k * 0.18 + (open * (y - ay) > 0 ? 1.5 : 0) - dist(p.x, p.y, x, y) * 0.22;
      if (v > bv) { bv = v; best = [x, y]; }
    }
  }
  return best;
}
function attackerAI(p, t, ax, ay, dir, open, form, dt) {
  p.timer -= dt;
  // attaquant lâché par son défenseur : il coupe tout de suite vers un espace libre où le handler peut le servir
  p.freeAcc = isAbandoned(p, t) ? (p.freeAcc || 0) + dt : 0;   // lâché depuis un moment (pas juste un décalage)
  p.free = p.freeAcc > 0.7;
  if (p.free && disc.mode === 'held' && disc.holder && disc.holder.team === t && p.role === 'cutter' && posteOf(p).when !== 'never'
      && p.state !== 'jab' && p.state !== 'cut' && (p.freeT = (p.freeT || 0) - dt) <= 0) {
    const sp = freeSpace(p, t, ax, ay, dir, open);
    if (sp) { startCut(p, sp[0], sp[1], dir * (sp[0] - p.x) > 12); p.state = 'cut'; p.timer = 1.8; }
    p.freeT = 0.8;
  }
  if (p.role === 'holder') {                                // ancien porteur : il suit le jeu derrière
    const s = dumpSlot(ax, ay, dir, open);
    p.tx = s.x - dir * 2; p.ty = clamp(s.y + open * 7, 2, H - 2); p.sp = hustle(p, SPD.jog); roomAroundHolder(p); return;
  }
  if (p.role === 'dump') {
    // relais : du côté où il y a le plus de terrain (le second handler prend l'autre côté) ; formation perso : sa place
    const big = ay < H / 2 ? 1 : -1, S = p.poste && osysOf(t), s = S ? sysSpot(S, p, ax, ay, dir, open) : dumpSlot(ax, ay, dir, p.hIdx === 1 ? big : -big);
    if (p.state === 'set') {
      p.tx = s.x; p.ty = s.y; p.sp = SPD.jog + 1;
      // compte élevé, ou relais couvert dès 2,5 : il vient chercher le disque
      const covered = () => disc.holder && G.stall > 2.5 && laneSlack(disc.holder, p.x, p.y, p.x, p.y, 0, TEAMS[1 - t]) < 0;
      if (disc.mode === 'held' && p.timer <= 0 && p.hIdx !== 1 && posteOf(p).when !== 'never' && (G.stall > 4.5 || covered())) {   // compte élevé : le relais vient chercher le disque
        p.state = 'reset'; p.timer = 1.8;
        // reset côté open un peu derrière, ou devant côté fermé : celui où la passe est la plus sûre
        const A = { cx: ax - dir * 3, cy: ay + open * 5.5 }, B = { cx: ax + dir * 4.5, cy: ay - open * 5 };
        [A, B].forEach(o => { clampPt(o); o.s = disc.holder ? laneSlack(disc.holder, o.cx, o.cy, o.cx, o.cy, 0, TEAMS[1 - t]) : 0; });
        [A, B].forEach(o => { if (dist(p.x, p.y, o.cx, o.cy) < 2.5) o.s -= 9; });   // déjà là : il va chercher l'autre
        const R = A.s >= B.s ? A : B; p.cx = R.cx; p.cy = R.cy;
      }
    } else {
      p.tx = p.cx; p.ty = p.cy; p.sp = SPD.cut;
      if (p.timer <= 0) { p.state = 'set'; p.timer = 2.5; }
    }
    roomAroundHolder(p);
    return;
  }
  const slot = cutterSlot(p, t, ax, ay, dir, form);
  switch (p.state) {
    case 'stack': [p.tx, p.ty] = leaveSpace(p, t, slot.x, slot.y); p.sp = hustle(p, SPD.jog); break;
    case 'park': p.tx = p.cx; p.ty = p.cy; p.sp = p.sprintPark ? SPD.cut : SPD.jog + 1; break;
    // une coupe se termine sur des événements (feinte faite, arrivée, disque parti ailleurs) ; les minuteries ne sont que
    // des plafonds de sécurité
    case 'jab':                                                     // feinte : un pas dans l'autre sens
      p.tx = p.wx; p.ty = p.wy; p.sp = SPD.cut * 0.8;
      if (p.timer <= 0 || dist(p.x, p.y, p.wx, p.wy) < 0.6) { p.state = 'cut'; p.timer = dist(p.x, p.y, p.cx, p.cy) / SPD.cut + 1.2; }
      break;
    case 'cut':
      p.tx = p.cx; p.ty = p.cy; p.sp = p.tag === '★' ? 8.4 : SPD.cut;      // le coupeur du huck a un départ lancé
      if (p.timer <= 0 || dist(p.x, p.y, p.cx, p.cy) < 0.8) { p.state = 'hold'; p.timer = 0.45; p.cutEnd = G.gt; }
      break;
    case 'hold':                                                    // arrivé : il se montre un instant, puis laisse la place
      p.tx = p.cx; p.ty = p.cy; p.sp = 1.5;
      if (disc.mode === 'held' && disc.holder && disc.holder.team === t && G.holdT < 0.3) p.timer = 0;   // le disque a changé de main : il libère l'espace
      if (p.timer <= 0) {
        const after = posteOf(p).after;
        if (p.sysStay || after === 'chain') { p.state = 'park'; p.cx = p.x; p.cy = p.y; p.sysStay = false; p.sysCut = false; break; }   // il enchaîne depuis ici
        p.state = 'clear'; p.timer = 4; p.sysCut = false;
        if (after === 'clear') {                                           // consigne : dégage côté break, puis revient à sa place
          p.wx = clamp(p.x + dir * 2, 1, W - 1); p.wy = clamp(ay - open * 6, 2, H - 2); p.wDone = false;
        } else if (after === 'back') p.wDone = true;
        else if (isColumn(form) && !osysOf(t)) {                           // dégage côté fermé puis retourne au bout de la colonne
          const ord = G.order[t], i = ord.indexOf(p);
          if (i >= 0) { ord.splice(i, 1); ord.push(p); }
          p.wx = p.x + dir * 2; p.wy = clamp(lineY(t, ay, form) - open * (form === 'side' ? 2 : 5), 2, H - 2); p.wDone = false;
        } else p.wDone = true;
      }
      break;
    case 'clear':                                                   // il dégage, puis rejoint sa place (le stack le reprend à l'arrivée)
      p.sp = hustle(p, SPD.jog + 1.5);
      if (!p.wDone) { p.tx = p.wx; p.ty = p.wy; if (dist(p.x, p.y, p.wx, p.wy) < 1.5) p.wDone = true; }
      else { [p.tx, p.ty] = leaveSpace(p, t, slot.x, slot.y); if (dist(p.x, p.y, slot.x, slot.y) < 1.5) p.state = 'stack'; }
      if (p.timer <= 0) p.state = 'stack';                          // plafond
      break;
  }
  if (p.state !== 'cut' && p.state !== 'jab') roomAroundHolder(p);
  p.tx = clamp(p.tx, 1, W - 1); p.ty = clamp(p.ty, 1.5, H - 1.5);
}
