// humans.js — Qui contrôle quoi.
// Chaque humain (toi en solo, ou chaque joueur en ligne) a un id, une équipe et un joueur contrôlé (sel).
//  • Seul humain de son équipe : il lance pour toute l'équipe en attaque et choisit son défenseur en défense
//    (comme avant).
//  • Plusieurs humains dans la même équipe : chacun a son joueur fixe, en attaque comme en défense ; il lance
//    quand ce joueur a le disque. On peut changer de joueur, mais seulement pour un joueur géré par l'IA.
//  • Une équipe sans humain est jouée par l'IA.

// Niveau des joueurs IA de l'équipe t :
//  • équipe avec au moins un humain : « Coéquipiers IA », choisi par son capitaine (comme la stratégie) ;
//  • équipe sans humain : « IA adverse », choisi par l'hôte (ou par toi en solo).
function aiLvl(t) {
  if (G.tuto && G.tuto.level && !human(t)) return AI_LEVELS[G.tuto.level];      // tutoriel : adversaire réglé par l'étape
  if (G.series && !human(t)) return oppLevel();                                   // tournoi / infini : niveau de l'adversaire du jour
  const lv = human(t) ? cfg(t).allyLevel : G.form.level;
  return AI_LEVELS[lv] || AI_LEVELS.normal;
}
// style de jeu de l'IA de l'équipe t (personnalité des équipes du tournoi)
const aiStyle = t => {
  if (G.series && !human(t)) return serOpp().style;
  const c = cfg(t) || {};                                       // consignes d'équipe choisies avant le point
  return { huck: ORDERS.huck[c.huck] || 1, high: ORDERS.high[c.high] || 1, bluff: DEFAULT_STYLE.bluff };
};
const riskOf = t => ORDERS.risk[(cfg(t) || {}).risk] || ORDERS.risk.normal;
const DEFAULT_CFG = { off: 'vert', def: 'man', force: 'haut', play: 'none', play1: 'huck', play2: 'give', dplay: 'none', allyLevel: 'normal', tname: '', tcol: '', puller: 'cap', restart: 'pose', huck: 'normal', high: 'normal', risk: 'normal', help: 'parfois', flow: 'struct' };
G.humans = [{ id: 0, team: 0, sel: null }];
G.myId = 0;

const teamHumans = t => G.humans.filter(h => h.team === t).sort((a, b) => a.id - b.id);
const human = t => G.humans.some(h => h.team === t);
const captain = t => teamHumans(t)[0] || null;                // choisit la stratégie et pulle
const meH = () => G.humans.find(h => h.id === G.myId) || null;
const humanById = id => G.humans.find(h => h.id === id) || null;
const soloStyle = t => teamHumans(t).length === 1;
// nom affiché d'un humain : son pseudo, sinon J1, J2…
const humanLabel = h => (h && h.name) || 'J' + (h.id + 1);
const cleanName = n => String(n || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
// pseudo : celui du compte si on est connecté (account.js), sinon celui tapé dans le menu
const myName = () => { const a = storeGet('uf-acc', null); return a && a.name ? a.name : cleanName(storeGet('uf-name', '')); };
// un spectateur (équipe -1) regarde la partie sans jouer ; l'écran le place côté Bleus
function syncMe() { const m = meH(); G.spectator = !!m && m.team < 0; G.me = m && m.team >= 0 ? m.team : 0; }

// stratégie d'une équipe : celle de son capitaine, sinon celle de l'IA
function cfg(t) {
  const c = captain(t);
  if (!c) return G.ai;
  if (c.id === G.myId) return G.form;
  if (G.net === 'guest' && G.netCfg) return G.netCfg[t] || DEFAULT_CFG;
  return c.cfg || DEFAULT_CFG;
}
function inputOf(h) {
  if (h.id === G.myId) return G.pointer;
  return h.inp || (h.inp = { x: 60, y: H / 2, down: false, last: -1e9 });
}

// humain qui déplace ce joueur (null = l'IA le déplace)
function controllerOf(p) {
  const hs = teamHumans(p.team);
  if (!hs.length) return null;
  if (hs.length === 1 && G.off === p.team) return null;        // seul en attaque : on lance, l'IA fait les cuts
  return hs.find(h => h.sel === p) || null;
}
// humain qui lance quand ce porteur a le disque (null = l'IA lance)
function throwerHuman() {
  if (disc.mode !== 'held' || !disc.holder) return null;
  const hs = teamHumans(disc.holder.team);
  if (!hs.length) return null;
  if (hs.length === 1) return hs[0];
  return hs.find(h => h.sel === disc.holder) || null;
}
function userControls(p) {
  if ((disc.mode === 'held' || disc.mode === 'carry') && disc.holder === p) return false;
  const h = controllerOf(p);
  if (!h) return false;
  const inp = inputOf(h);
  if (!G.net) return inp.down || inp.last > -1e8;              // solo : dès ta première action, l'IA ne reprend plus la main
  return inp.down || G.time - inp.last < 10;                    // en ligne : sans action pendant 10 s, l'IA reprend la main
}
const takenByOther = (p, h) => G.humans.some(o => o !== h && o.sel === p);

// à chaque changement de possession
function updateSelected() {
  for (const t of [0, 1]) {
    const hs = teamHumans(t);
    if (hs.length === 1) {
      const h = hs[0];
      h.sel = G.off !== t ? nearest(TEAMS[t], disc.x, disc.y) : null;
      inputOf(h).last = -1e9;
    } else if (hs.length > 1) assignFixed(t);
  }
}
// plusieurs humains dans une équipe : chacun son joueur, sans doublon
function assignFixed(t) {
  const hs = teamHumans(t), used = new Set();
  for (const h of hs) {
    if (h.sel && h.sel.team === t && !used.has(h.sel)) used.add(h.sel);
    else h.sel = null;
  }
  for (const h of hs) if (!h.sel) { h.sel = TEAMS[t].find(p => !used.has(p)) || null; if (h.sel) used.add(h.sel); }
}
const canSwitchNow = h => !!h && h.team >= 0 && G.phase === 'play' && (G.off !== h.team || !soloStyle(h.team));
// joueur que la touche Espace prendrait (entouré en gris)
function switchTarget(h) {
  if (!canSwitchNow(h)) return null;
  const [rx, ry] = disc.mode === 'air' ? [disc.ex, disc.ey] : [disc.x, disc.y];
  return nearest(TEAMS[h.team].filter(p => p !== h.sel && !takenByOther(p, h)), rx, ry);
}
function selectFor(h, p) {
  if (!canSwitchNow(h) || !p || p.team !== h.team || takenByOther(p, h)) return false;
  h.sel = p; inputOf(h).last = -1e9;
  if (G.tuto) tutoEvent('switch');
  return true;
}
// layout : en défense, ou à plusieurs dans l'équipe, ton joueur plonge vers (x, y) quand tu veux (sauf s'il a le disque) ;
// seul en attaque, c'est le receveur du disque en vol qui plonge, vers l'endroit où le disque SERA (pas là où il est) :
// si le plongeon peut l'attraper maintenant, il part tout de suite ; sinon le layout est « armé » et il plonge au bon moment (armedDive)
function diveFor(h, x, y) {
  if (!h || h.team < 0 || G.phase !== 'play') return;
  const air = disc.mode === 'air' && disc.team === h.team && !disc.pull;
  let p;
  if (G.off === h.team && soloStyle(h.team)) { if (!air) return; p = disc.intended || nearest(TEAMS[h.team], disc.ex, disc.ey, disc.thrower); }
  else p = h.sel;
  if (!p || (disc.holder === p && (disc.mode === 'held' || disc.mode === 'carry')) || (air && p === disc.thrower)) return;
  if (air && G.off === h.team && soloStyle(h.team)) { p.diveArmed = true; armedDive(p); return; }
  diveTo(p, x, y);
  if (h.sel === p) inputOf(h).last = G.time;
}
// layout armé : il plonge dès qu'un plongeon attrape le disque ; au plus tard quand le disque arrive (meilleur essai possible)
function armedDive(p) {
  if (disc.mode !== 'air' || disc.pull || disc.team !== p.team || disc.thrower === p) { p.diveArmed = false; return; }
  if (p.dive > 0 || p.down > 0 || p.jump > 0 || p.jprep > 0) return;
  const b = bestDive(p);
  if (b.miss < 0 || disc.dur - disc.t <= DIVE_T) { p.diveArmed = false; p.diveTried = true; diveTo(p, b.x, b.y); }
}
// plongeon simulé vers (x, y) en partant maintenant : plus petit écart au disque attrapable pendant le plongeon
// (négatif = il l'attrape ; mêmes règles que sim.js : 2 m en plongeon, disque assez bas, dans le terrain)
function diveMiss(p, x, y) {
  const [vx, vy] = diveVel(p, x, y), step = 1 / 60; let miss = 99;
  for (let t = step; t <= DIVE_T + 1e-6; t += step) {
    const u = (disc.t + t) / disc.dur, px = p.x + vx * t, py = p.y + vy * t;
    if (u >= 1) { const [ex, ey] = seenEnd(p); if (inField(ex, ey)) miss = Math.min(miss, dist(px, py, ex, ey) - 2.4); break; }   // il touche le sol en plongeant
    if (u <= 0.3 || discZ(u) >= REACH_DIVE + 0.3) continue;
    const [bx, by] = seenAt(p, u);
    if (inField(bx, by)) miss = Math.min(miss, dist(px, py, bx, by) - DIVE_R);
  }
  return miss;
}
// meilleure direction de plongeon : vers chaque point de la trajectoire restante et tout autour de lui ; la plus sûre
function bestDive(p) {
  const u0 = disc.t / disc.dur, cand = [];
  for (let u = Math.min(1, u0 + 0.02); u <= 1.001; u += 0.02) cand.push(seenAt(p, Math.min(1, u)));
  for (let a = 0; a < 16; a++) cand.push([p.x + Math.cos(a * Math.PI / 8) * 3, p.y + Math.sin(a * Math.PI / 8) * 3]);
  const [gx, gy] = seenEnd(p); let best = { x: gx, y: gy, miss: 99 };
  for (const [x, y] of cand) { const m = diveMiss(p, x, y); if (m < best.miss) best = { x, y, miss: m }; }
  return best;
}
// saut : en défense ou à plusieurs, ton joueur ; seul en attaque, le receveur du disque en vol
function jumpTarget(h) {
  if (!h || h.team < 0 || G.phase !== 'play') return null;
  if (G.off === h.team && soloStyle(h.team)) return disc.mode === 'air' && disc.team === h.team && !disc.pull ? disc.intended : null;
  return h.sel;
}
function jumpFor(h) {
  const p = jumpTarget(h);
  if (G.tuto && p) G.tuto.jumped = true;
  if (p && jumpTo(p) && h.sel === p) inputOf(h).last = G.time;
}
// point du terrain le plus proche (un disque qui sort se rattrape au bord, quand il revient)
const inSpot = (x, y) => [clamp(x, 0.3, W - 0.3), clamp(y, 0.3, H - 0.3)];
// receveur IA : il attaque le disque — il court vers le premier point de la trajectoire qu'il peut atteindre avant le disque
// (au lieu d'attendre au point d'arrivée, où le défenseur a le temps de revenir)
function runPoint(p) {
  return catchPoint(p) || [...inSpot(...seenEnd(p)), false];   // sinon il attend au bord du terrain, au plus près du disque
}
// « attaque cet espace » : le coéquipier IA le plus proche coupe vers le point demandé
//  • appel SUR un coéquipier (à moins de PICK_R m) : il est désigné (ou ne l'est plus) — c'est lui qui fera le prochain cut
const PICK_R = 1.8;
// coéquipier désigné par cet appel (null : appel dans l'espace)
function pickAt(team, x, y) {
  const [q, dq] = nearestD(TEAMS[team].filter(p => p !== disc.holder && !controllerOf(p)), x, y);
  return q && dq < PICK_R ? q : null;
}
function callFor(h, x, y) {
  if (!h || G.phase !== 'play' || G.off !== h.team || disc.mode === 'dead') return;
  const q = pickAt(h.team, x, y);
  if (q) { h.callPick = h.callPick === q ? null : q; return; }
  if (G.tuto) G.tuto.called = true;
  x = clamp(x, 1, W - 1); y = clamp(y, 1.5, H - 1.5);
  const pool = TEAMS[h.team].filter(p => p !== disc.holder && p !== disc.intended && p !== G.pickup && !controllerOf(p));
  const c = h.callPick && pool.includes(h.callPick) ? h.callPick : nearest(pool, x, y);   // le coéquipier désigné, sinon le plus proche
  h.callPick = null;
  if (!c) return;
  startCut(c, x, y, dirOf(h.team) * (x - c.x) > 12);
  c.callT = 3; c.called = G.time;
  G.cutT = Math.max(G.cutT, 1);
  fxEvent('call', x, y, h.team);
}
