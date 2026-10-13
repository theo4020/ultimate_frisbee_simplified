// sim.js — Boucle de simulation : déplacements, stall count, vol du disque

// =====================================================================
//  Boucle de simulation
// =====================================================================
function steer(p, dt) {
  if (p.jumpCd > 0) p.jumpCd -= dt;
  if (p.jprep > 0) {                                        // préparation du saut : il s'accroupit et freine
    const k = Math.max(0, 1 - 9 * dt); p.vx *= k; p.vy *= k;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.jprep -= dt; if (p.jprep <= 0) { p.jprep = 0; p.jump = JUMP_T; }
    return;
  }
  if (p.jump > 0) {                                         // en l'air : on garde son élan, sans changer de direction
    p.x += p.vx * dt; p.y += p.vy * dt;
    const k = Math.max(0, 1 - 1.5 * dt); p.vx *= k; p.vy *= k;
    p.jump -= dt; if (p.jump <= 0) { p.jump = 0; p.jrec = JUMP_REC; p.jumpCd = JUMP_CD; }
    return;
  }
  if (p.dive > 0) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.dive -= dt;
    if (p.dive <= 0) p.down = DOWN_T;
    return;
  }
  if (p.down > 0) {
    p.down -= dt; const k = Math.max(0, 1 - 7 * dt); p.vx *= k; p.vy *= k;
    p.x += p.vx * dt; p.y += p.vy * dt; return;
  }
  const dx = p.tx - p.x, dy = p.ty - p.y, l = Math.hypot(dx, dy);
  let want = Math.min(p.sp * (controllerOf(p) ? 1 : aiLvl(p.team).speed), l * 2.5);
  if (p.jrec > 0) { p.jrec -= dt; want *= 0.5; }            // réception d'un saut : il repart lentement
  let ux = l > 0.01 ? dx / l : 0, uy = l > 0.01 ? dy / l : 0;
  if (p.avoid && l > 0.8) [ux, uy] = avoidDir(p, ux, uy, l);  // pas d'écran : il contourne les autres joueurs
  const dvx = ux * want - p.vx, dvy = uy * want - p.vy;
  const dl = Math.hypot(dvx, dvy), maxd = (p.team === G.off ? ACC.atk : ACC.def) * dt;
  const k = dl > maxd ? maxd / dl : 1;
  p.vx += dvx * k; p.vy += dvy * k;
  p.x += p.vx * dt; p.y += p.vy * dt;
}

// les attaquants IA ne passent pas à ras des autres : 2,5 m des joueurs, 4 m du porteur (les écrans sont interdits)
function avoidDir(p, ux, uy, l) {
  let ax = 0, ay = 0;
  for (const q of players) {
    if (q === p) continue;
    const R = q === disc.holder && disc.mode === 'held' ? 4 : 2.5, rx = q.x - p.x, ry = q.y - p.y, d = Math.hypot(rx, ry);
    if (d > R || d < 0.01 || d > l + 1) continue;             // trop loin, ou au-delà de sa destination
    if (rx * ux + ry * uy <= 0) continue;                      // seulement ceux qui sont devant lui
    const w = (R - d) / R * 1.6, left = ux * ry - uy * rx > 0;
    ax += (left ? uy : -uy) * w; ay += (left ? -ux : ux) * w;  // il s'écarte du côté opposé
  }
  if (!ax && !ay) return [ux, uy];
  const nx = ux + ax, ny = uy + ay, n = Math.hypot(nx, ny) || 1;
  return [nx / n, ny / n];
}

function update(dt) {
  if (G.ms) G.ms.ptT += dt;
  const off = G.off, def = 1 - off, dir = dirOf(off);
  const atk = TEAMS[off], dfn = TEAMS[def];
  const [ax, ay] = anchor();
  const oform = formOf(off), dform = defFormOf(def), closed = closedOf(def), open = -closed;

  updatePlays(dt, ax, ay, dir, open);
  runCutSequencer(off, ax, ay, dir, open, oform, dt);
  for (const p of atk) {
    p.avoid = false;
    if (disc.mode === 'held' && disc.holder === p) { p.tx = p.x; p.ty = p.y; p.sp = 0; p.vx = p.vy = 0; continue; }
    if (disc.mode === 'ground' && G.pickup === p) { p.tx = disc.x; p.ty = disc.y; p.sp = pickupSpeed(p); continue; }
    if (disc.mode === 'carry' && disc.holder === p) { p.tx = G.carryTo.x; p.ty = G.carryTo.y; p.sp = 5.5; continue; }
    if (userControls(p)) { const inp = inputOf(controllerOf(p)); p.tx = inp.x; p.ty = inp.y; p.sp = SPD.user; continue; }   // humain (à plusieurs par équipe)
    if (G.tuto && TUTO_STEPS[G.tuto.step] && TUTO_STEPS[G.tuto.step].still && tutoPin(p)) continue;   // tutoriel : receveur immobile
    if (disc.mode === 'air' && disc.intended === p) {
      const [rx, ry, ok] = runPoint(p);                    // il attaque le disque sur sa trajectoire (passe haute comprise, comme un humain)
      p.tx = rx; p.ty = ry; p.sp = SPD.cut;
      if (!ok && !disc.pull && !p.diveTried && !controllerOf(p) && (1 - disc.t / disc.dur) * disc.dur < DIVE_T + 0.15) {
        const [cx, cy, can] = catchPoint(p);               // il n'arrivera pas à temps en courant : layout
        if (can && dist(p.x, p.y, cx, cy) > 1.2) { p.diveTried = true; if (Math.random() < 0.6) diveTo(p, cx, cy); }
      }
      continue;
    }
    if (G.tuto && tutoPin(p)) continue;                     // tutoriel : joueur placé par l'étape
    if (G.practice && practicePin(p)) continue;             // entraînement
    p.avoid = true;
    attackerAI(p, off, ax, ay, dir, open, oform, dt);
  }
  defenseBrain(def, dt);
  const slots = zoneSlots(def, ax, ay, dir, closed);
  for (const d of dfn) {
    d.avoid = false;
    if (G.tuto && tutoPin(d)) continue;
    if (G.practice && practicePin(d)) continue;
    if (userControls(d)) { const inp = inputOf(controllerOf(d)); d.tx = inp.x; d.ty = inp.y; d.sp = SPD.user; continue; }
    d.react -= dt;
    if (d.react > 0) continue;                             // temps de réaction : c'est ce qui crée des démarquages
    d.react = (dform !== 'man' ? rand(...DEF_TUNE.reactZone) : rand(...DEF_TUNE.reactMan)) * aiLvl(def).react;
    defenderAI(d, ax, ay, dir, closed, defFormOf(def), slots);
  }
  holdOffMark(dfn);

  for (const p of players) if (p !== disc.holder || disc.mode !== 'held') steer(p, dt);
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      const minD = (a === disc.holder || b === disc.holder) && a.team !== b.team ? 1.5 : 1.2;   // pas de contact avec le handler
      if (d > 0.001 && d < minD) {
        const push = (minD - d) * 0.5, nx = dx / d, ny = dy / d;
        if (a !== disc.holder && a !== G.pickup) { a.x -= nx * push; a.y -= ny * push; }
        if (b !== disc.holder && b !== G.pickup) { b.x += nx * push; b.y += ny * push; }
      }
    }
  for (const p of players) { p.x = clamp(p.x, -2, W + 2); p.y = clamp(p.y, -2, H + 2); }

  if (disc.mode === 'held') {
    const h = disc.holder;
    disc.x = h.x; disc.y = h.y;
    G.holdT += dt;
    // règle WFDF : si la mark sort des 3 m (ici STALL_R) ou si un autre défenseur devient la mark, le compte repart à 1
    if (!(G.marker && G.marker.team !== h.team && dist(G.marker.x, G.marker.y, h.x, h.y) < STALL_R)) {
      const form = defFormOf(def);
      const desig = dfn.find(d => (form === 'man' ? d.match === h : d.zslot === 0) && dist(d.x, d.y, h.x, h.y) < STALL_R);
      const [mk, md] = nearestD(dfn, h.x, h.y);
      G.marker = desig || (md < STALL_R ? mk : null);
      G.stall = 0;
    }
    // double team : un autre défenseur dans le cercle sans garder personne → compte gelé, et -1 (règle WFDF)
    // (un défenseur qui traverse le cercle a 1,5 s pour en sortir)
    for (const d of dfn) {
      const inside = d !== G.marker && dist(d.x, d.y, h.x, h.y) < STALL_R && !guardingOther(d, d.x, d.y);
      d.inT = inside ? (d.inT || 0) + dt : 0;
    }
    const dbl = dfn.find(d => d.inT > 1.5) || null;
    if (dbl && !G.dbl && G.marker) { G.stall = Math.max(0, Math.floor(G.stall) - 1); flash('Double team !'); fxEvent('double', h.x, h.y, def); }
    G.dbl = G.marker ? dbl : null;
    if (G.marker && !G.dbl) G.stall += dt * STALL_RATE;
    if (G.stall >= 10) { G.stats.stalls++; msTurnover(h, 'stall'); turnover(h.x, h.y, 'Stall 10 ! Turnover', 'stall'); return; }
    if (!throwerHuman()) {                                  // porteur sans humain : l'IA lance
      if (G.tuto && tutoHold(h, dt)) { /* tutoriel : lanceur scénarisé */ }
      else if (h.windup) {                                       // passe haute armée : il choisit son moment
        const w = h.windup, mk = G.marker, L = aiLvl(h.team);
        w.t -= dt;
        if (mk && (mk.jprep > 0 || mk.jump > 0) && L.safe >= 0) w.t = Math.max(w.t, 0.08);   // la mark a sauté : il attend qu'elle retombe…
        else if (mk && mk.jumpCd > 0 && w.t > 0.1 && L.safe >= 0) w.t = 0.06;                 // …et lance pendant qu'elle récupère
        if (w.t <= 0 || G.stall > 8) { h.windup = null; aiThrow(h, true); if (disc.mode !== 'held') return; }
      } else { h.think -= dt; if (h.think <= 0) aiThrow(h); }
    }
    markReads(dt);
  } else if (disc.mode === 'air') {
    disc.t += dt;
    const u = Math.min(1, disc.t / disc.dur);
    [disc.x, disc.y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u);
    disc.z = discZ(u);
    if (!disc.pull) aiJumps(u);
    // qui peut toucher le disque à cet instant ?
    const blockers = []; let catcher = null, cd = 1e9;
    for (const p of players) {
      if (p === disc.thrower) continue;
      const d = dist(p.x, p.y, disc.x, disc.y), lift = jumpLift(p);
      if (p.team !== disc.team) {
        if (disc.pull) continue;                           // on ne contre pas un pull
        const diving = p.dive > 0;
        const reach = diving ? 2.0 : 1.05, high = diving ? REACH_DIVE : REACH_STAND + lift;
        if (u > 0.03 && d < reach && disc.z < high && !disc.rolled.has(p)) blockers.push(p);
      } else if (inField(disc.x, disc.y) && (p.dive > 0 ? (u > 0.3 && d < 2.0 && disc.z < REACH_DIVE + 0.3) : (u > 0.45 && d < 1.3 && disc.z < 2.3 + lift))) {   // pas de réception tant que le disque est dehors
        if (d < cd) { cd = d; catcher = p; }
      }
    }
    // duel en l'air : dès qu'un joueur peut toucher le disque, un adversaire tout proche qui a sauté peut le lui disputer
    const contest = (team, maxD, baseH) => {
      let best = null, bd = maxD;
      for (const p of TEAMS[team]) {
        if (p === disc.thrower || !(p.jump > 0) || disc.rolled.has(p)) continue;
        const d = dist(p.x, p.y, disc.x, disc.y);
        if (d < bd && disc.z < baseH + jumpLift(p) + 0.4) { bd = d; best = p; }
      }
      return best;
    };
    const okD = !disc.pull;
    const A = catcher || (blockers.length && u > 0.45 ? contest(disc.team, 2.0, 2.3) : null);
    const B = blockers.length ? blockers.reduce((a, c) => (jumpLift(c) > jumpLift(a) ? c : a)) : catcher && okD ? contest(1 - disc.team, 1.8, REACH_STAND) : null;
    if (A && B && (A.jump > 0 || B.jump > 0)) {
      const catcher = A, b = B;
      blockers.forEach(o => disc.rolled.add(o)); disc.rolled.add(b);
      const near = q => dist(q.x, q.y, disc.x, disc.y) * 0.25;   // le mieux placé sous le disque a l'avantage
      const atk = jumpLift(catcher) + Math.random() * 0.8 - near(catcher), dfn = jumpLift(b) + Math.random() * 0.8 - near(b) + (aiLvl(b.team).block - 0.6) * 0.5;
      if (atk >= dfn) { achEvent('duel', catcher.team); flash('Duel gagné !'); fxEvent('duel', disc.x, disc.y, catcher.team); catchDisc(catcher); return; }
      fxEvent('duel', disc.x, disc.y, b.team);
      defStop(b, 'Duel perdu ! Block'); return;
    }
    for (const p of blockers) {
      disc.rolled.add(p);
      const r = Math.random(), diving = p.dive > 0, L = aiLvl(p.team);
      if (!diving && p.jump > 0 && disc.z > REACH_STAND) {      // saut au bon endroit, au bon moment : contre assuré
        achEvent('skyblock', p.team);
        if (G.tuto) G.tuto.blocked = true;
        defStop(p, 'Block en l’air !'); return;
      }
      if (r < (diving ? 0.85 : G.tuto && G.tuto.wall ? 1 : L.block)) {
        if (diving) { achEvent('layoutblock', p.team); if (G.tuto) G.tuto.lblock = true; } defStop(p, diving ? 'Layout block !' : p.jump > 0 ? 'Block en l’air !' : 'Block !'); return; }
    }
    if (catcher) {
      if (catcher.dive > 0) flash('Layout !');              // réception en plongeon
      else if (catcher.jump > 0 && disc.z > 2.3) flash('Belle prise en l’air !');
      catchDisc(catcher); return;
    }
    if (u >= 1) {
      if (G.practice) { practiceLanded(disc.ex, disc.ey); return; }
      if (disc.pull) {
        const [c, cd] = nearestD(TEAMS[disc.team], disc.ex, disc.ey);
        if (c && cd < 1.9 && inField(disc.ex, disc.ey)) catchDisc(c); else pullLanded(disc.ex, disc.ey);
        return;
      }
      const out = disc.ex < 0 || disc.ex > W || disc.ey < 0 || disc.ey > H;
      const [c, cd] = nearestD(TEAMS[disc.team], disc.ex, disc.ey, disc.thrower);
      if (!out && c && cd < (c.dive > 0 ? 2.6 : 1.9)) { if (c.dive > 0 || c.down > 0) flash('Layout !'); catchDisc(c); return; }
      if (out) G.stats.out++; else G.stats.ground++;
      msTurnover(disc.thrower, 'throw');
      const [tx, ty] = out ? crossPoint() : [disc.ex, disc.ey];   // sorti : repris là où il a franchi la ligne
      turnover(tx, ty, out ? 'Out ! Turnover' : 'Turnover');
    }
  } else if (disc.mode === 'ground') {
    const p = G.pickup;
    if (p && dist(p.x, p.y, disc.x, disc.y) < 1.2) {
      p.x = disc.x; p.y = disc.y; p.vx = p.vy = 0;
      if (G.carryTo) startCarry(p, G.carryTo.x, G.carryTo.y, ''); else holdDisc(p);
    }
  } else if (disc.mode === 'carry') {                           // remontée du disque à pied
    const h = disc.holder; disc.x = h.x; disc.y = h.y;
    if (dist(h.x, h.y, G.carryTo.x, G.carryTo.y) < 0.4) { h.x = G.carryTo.x; h.y = G.carryTo.y; holdDisc(h); }
  }
}


// dernier point de la trajectoire encore dans le terrain (là où le disque est sorti)
function crossPoint() {
  let last = [disc.sx, disc.sy];
  for (let u = 0; u <= 1.0001; u += 0.01) {
    const q = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u);
    if (!inField(q[0], q[1])) break;
    last = q;
  }
  return last;
}
// reprise du disque au sol (choisie par l'équipe qui attaque, menu d'avant-point) :
//  • posée : le ramasseur marche et règle son allure pour arriver quand tout le monde est en place (au moins 1,5 s, au plus ~6 s) ;
//  • rapide : il fonce et ramasse tout de suite.
const restartMode = () => (G.pickup ? cfg(G.pickup.team).restart : 'rapide');
function pickupSpeed(p) {
  if (restartMode() !== 'pose') return SPD.cut;
  const t = G.gt - (G.groundAt || 0), left = Math.max(0, dist(p.x, p.y, disc.x, disc.y) - 1);
  if (t > 6) return SPD.cut;
  let need = Math.max(0, 1.5 - t);                             // temps qu'il faut encore aux autres pour se placer
  for (const q of players) if (q !== p) need = Math.max(need, Math.max(0, dist(q.x, q.y, q.tx, q.ty) - 1.5) / (SPD.cut * 0.9));
  return clamp(left / Math.max(need, 0.05), 2.5, SPD.cut);
}
// reprise posée (et disque ramené à pied) : la défense ne marque pas avant que le lanceur ait le disque
function holdOffMark(dfn) {
  if (G.tuto || G.practice || !((disc.mode === 'ground' && restartMode() === 'pose') || disc.mode === 'carry')) return;
  const R = STALL_R + 1.5;
  for (const d of dfn) {
    if (userControls(d)) continue;
    let dx = d.tx - disc.x, dy = d.ty - disc.y, l = Math.hypot(dx, dy);
    if (l >= R) continue;
    if (l < 0.1) { dx = d.x - disc.x; dy = d.y - disc.y; l = Math.hypot(dx, dy) || 1; }
    d.tx = disc.x + dx / l * R; d.ty = disc.y + dy / l * R;
  }
}

// ---------- saut ----------
function jumpTo(p) {
  if (!p || p.jump > 0 || p.jprep > 0 || p.dive > 0 || p.down > 0 || p.jumpCd > 0) return false;
  if (disc.holder === p && (disc.mode === 'held' || disc.mode === 'carry')) return false;
  p.jprep = JUMP_PREP; p.jumpAt = 0;
  fxEvent('jump', p.x, p.y, p.team);
  return true;
}
// les joueurs IA sautent quand le disque va passer juste au-dessus d'eux (une seule tentative par lancer)
function aiJumps(u) {
  if (G.tuto) return;                                        // tutoriel : seuls les sauts du joueur comptent
  // arrivée disputée : attaquant et défenseur au point de chute, l'IA saute pour gagner le duel
  const left = disc.dur - disc.t;
  if (left < JUMP_PREP + JUMP_T * 0.55 && left > JUMP_PREP + JUMP_T * 0.3) {
    for (const p of players) {
      if (p === disc.thrower || p.jumpTried || controllerOf(p) && userControls(p)) continue;
      if (dist(p.x, p.y, disc.ex, disc.ey) > 1.8) continue;
      if (nearestD(TEAMS[1 - p.team], disc.ex, disc.ey)[1] > 2.2) continue;
      p.jumpTried = true;
      if (Math.random() < (p.team === disc.team ? 0.6 : aiLvl(p.team).block)) jumpTo(p);
    }
  }
  const t2 = disc.t + JUMP_PREP + JUMP_T * 0.5, u2 = t2 / disc.dur;
  if (u2 > 1) return;
  const z2 = discZ(u2);
  if (z2 < REACH_STAND - 0.1 || z2 > 2.3 + JUMP_H * 0.95) return;
  const [x2, y2] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u2);
  for (const p of players) {
    if (p === disc.thrower || p.jumpTried || controllerOf(p) && userControls(p)) continue;
    if (disc.t < 0.4 && dist(p.x, p.y, disc.sx, disc.sy) < 3) continue;   // la mark : voir plus haut
    const mine = p.team === disc.team;
    if (dist(p.x, p.y, x2, y2) > (mine ? 1.3 : 1.05) + 0.4) continue;
    p.jumpTried = true;
    const L = aiLvl(p.team);
    if (Math.random() < (mine ? 0.75 : L.block + 0.15)) jumpTo(p);
  }
}

// ---------- passe haute : le lanceur lève le disque (signal visible), la mark peut tenter de la lire ----------
// vrai quand le porteur a armé une passe haute (IA pendant sa préparation, humain tant qu'il l'a armée)
function highTell() {
  if (disc.mode !== 'held' || !disc.holder) return false;
  if (G.net === 'guest') return !!G.netTell;
  if (disc.holder.windup) return true;
  const th = throwerHuman();
  if (!th) return false;
  return th.id === G.myId ? G.throwKind === 'high' : !!inputOf(th).high;
}
// la mark IA voit le disque levé et programme son saut (plus ou moins bien synchronisé selon le niveau)
// la mark IA ne peut pas réagir au lâcher (trop tard) : elle devine le moment, de temps en temps
function markReads(dt) {
  if (G.tuto) { for (const p of players) if (p.jumpAt && G.time >= p.jumpAt) { p.jumpAt = 0; jumpTo(p); } return; }
  const tell = highTell(), mk = G.marker;
  if (!tell) G.nextGuess = 0;
  else if (mk && !(controllerOf(mk) && userControls(mk)) && !mk.jumpAt && !(mk.jprep > 0) && !(mk.jump > 0) && !(mk.jumpCd > 0)) {
    if (!G.nextGuess) G.nextGuess = G.time + rand(0.1, 0.5);
    if (G.time >= G.nextGuess) {
      G.nextGuess = G.time + rand(0.7, 1.6);
      if (Math.random() < aiLvl(mk.team).block * 0.8) mk.jumpAt = G.time + rand(0, 0.5);
    }
  }
  G.tellSeen = tell;
  for (const p of players) if (p.jumpAt && G.time >= p.jumpAt) { p.jumpAt = 0; jumpTo(p); }
}
