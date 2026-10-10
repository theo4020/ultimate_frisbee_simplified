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
  if (G.series && !human(t)) return AI_LEVELS[SERIES[G.series.cur].level];       // tournoi : niveau de l'adversaire du jour
  const lv = human(t) ? cfg(t).allyLevel : G.form.level;
  return AI_LEVELS[lv] || AI_LEVELS.normal;
}
// style de jeu de l'IA de l'équipe t (personnalité des équipes du tournoi)
const aiStyle = t => (G.series && !human(t) ? SERIES[G.series.cur].style : DEFAULT_STYLE);
const DEFAULT_CFG = { off: 'vert', def: 'man', force: 'haut', play: 'none', dplay: 'none', allyLevel: 'normal', tname: '', tcol: '', puller: 'cap' };
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
const myName = () => cleanName(storeGet('uf-name', ''));
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
  return inp.down || G.time - inp.last < 2.5;                   // sans action pendant 2,5 s, l'IA reprend la main
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
// seul en attaque, c'est le receveur du disque en vol qui plonge. Le receveur visé plonge vers le point où sera le disque.
function diveFor(h, x, y) {
  if (!h || h.team < 0 || G.phase !== 'play') return;
  const air = disc.mode === 'air' && disc.team === h.team && !disc.pull;
  let p;
  if (G.off === h.team && soloStyle(h.team)) { if (!air) return; p = disc.intended || nearest(TEAMS[h.team], disc.ex, disc.ey, disc.thrower); }
  else p = h.sel;
  if (!p || (disc.holder === p && (disc.mode === 'held' || disc.mode === 'carry')) || (air && p === disc.thrower)) return;
  if (air && G.off === h.team && p === disc.intended) [x, y] = catchPoint(p);
  diveTo(p, x, y);
  if (h.sel === p) inputOf(h).last = G.time;
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
// meilleur point pour plonger : là où sera le disque quand le plongeon y arrive (premier point attrapable de la trajectoire
// restante qu'il atteint à temps) ; sinon le point de la trajectoire le plus proche de lui
function catchPoint(p) {
  const u0 = disc.t / disc.dur, peak = discPeak();
  let best = null, bd = 1e9;
  for (let u = Math.min(1, u0 + 0.01); u <= 1.001; u += 0.02) {
    const [x, y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u);
    const tA = (u - u0) * disc.dur, r = dist(p.x, p.y, x, y);
    if (u > 0.3 && heightAt(u, peak, disc.kind) <= REACH_DIVE + 0.25 && tA <= DIVE_T + 0.35 && r <= SPD.dive * Math.min(tA, DIVE_T) + 1.7) return [x, y, true];
    if (r < bd) { bd = r; best = [x, y, false]; }
  }
  return best || [disc.ex, disc.ey, false];
}
// receveur IA : il attaque le disque — il court vers le premier point de la trajectoire qu'il peut atteindre avant le disque
// (au lieu d'attendre au point d'arrivée, où le défenseur a le temps de revenir)
function runPoint(p) {
  const u0 = disc.t / disc.dur, peak = discPeak(), sp = SPD.cut * aiLvl(p.team).speed;
  for (let u = Math.max(u0 + 0.02, 0.5); u <= 1.001; u += 0.025) {
    if (heightAt(u, peak, disc.kind) > 2.1) continue;
    const [x, y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u);
    const d = dist(p.x, p.y, x, y), need = d > 0.9 ? (d - 0.9) / sp + 0.12 : 0, tA = (u - u0) * disc.dur;
    if (need <= Math.max(0, tA - 0.06)) return [x, y, true];
  }
  return [disc.ex, disc.ey, false];
}
// « attaque cet espace » : le coéquipier IA le plus proche coupe vers le point demandé
function callFor(h, x, y) {
  if (!h || G.phase !== 'play' || G.off !== h.team || disc.mode === 'dead') return;
  if (G.tuto) G.tuto.called = true;
  x = clamp(x, 1, W - 1); y = clamp(y, 1.5, H - 1.5);
  const pool = TEAMS[h.team].filter(p => p !== disc.holder && p !== disc.intended && p !== G.pickup && !controllerOf(p));
  const c = nearest(pool, x, y);
  if (!c) return;
  startCut(c, x, y, dirOf(h.team) * (x - c.x) > 12);
  c.callT = 3; c.called = G.time;
  G.cutT = Math.max(G.cutT, 1);
  fxEvent('call', x, y, h.team);
}
