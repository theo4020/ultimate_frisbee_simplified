// systems.js — Systèmes de jeu personnalisés (créés dans l'éditeur, editor.js) et leur exécution par l'IA.
//
// Repère d'un système : tout est relatif au porteur du disque.
//   f = mètres vers l'avant (vers l'en-but attaqué), s = mètres vers le côté OPEN (négatif = côté break).
// Le système suit donc le disque partout sur le terrain et se retourne tout seul selon le côté forcé.
//
// Attaque : { kind:'off', name, pos:[[f,s]×4] (joueurs ① à ④), steps:[{ p:0..3, to:[f,s], wait:s }] }
//   Les 4 joueurs sans le disque prennent les places ① à ④ (le plus proche de chaque place). Les courses partent
//   dans l'ordre, chacune « wait » secondes après la précédente ; puis tout le monde revient en place et ça recommence.
//   À chaque nouvelle réception, la séquence repart de la course 1 autour du nouveau porteur.
// Défense : { kind:'def', name, mode:'zone', zone:[[f,s]×4] } — la mark reste sur le porteur, 4 défenseurs aux places dessinées
//           { kind:'def', name, mode:'man', roles:[×5] } — individuelle, un rôle par défenseur (numéros 1 à 5) :
//             'normal' · 'serre' (colle à son joueur) · 'profond' (reste entre son joueur et l'en-but) · 'double' (double team dès 5 de stall)

const SYS_MAX = 12, SYS_STEPS = 12;
const SYS_ROLES = { normal: 'Normal', serre: 'Serré', profond: 'Profond', double: 'Double team' };
const SYS_F = [-12, 40], SYS_S = [-18, 18];                    // limites des positions dans l'éditeur
const sysNum = (v, a, b) => (typeof v === 'number' && isFinite(v) ? Math.round(clamp(v, a, b) * 10) / 10 : (a + b) / 2);
const sysPt = p => (Array.isArray(p) ? [sysNum(p[0], SYS_F[0], SYS_F[1]), sysNum(p[1], SYS_S[0], SYS_S[1])] : [10, 0]);
const sysId = () => Math.random().toString(36).slice(2, 8);

// nettoie un système (venant du navigateur, du compte ou d'un autre joueur en ligne) ; null s'il est invalide
function cleanSystem(o) {
  if (!o || typeof o !== 'object' || (o.kind !== 'off' && o.kind !== 'def')) return null;
  const name = String(o.name || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24) || (o.kind === 'off' ? 'Mon attaque' : 'Ma défense');
  const id = typeof o.id === 'string' && /^[a-z0-9]{3,12}$/.test(o.id) ? o.id : sysId();
  if (o.kind === 'off') {
    const pos = Array.from({ length: 4 }, (_, i) => sysPt(o.pos && o.pos[i]));
    const steps = (Array.isArray(o.steps) ? o.steps : []).slice(0, SYS_STEPS)
      .filter(st => st && Number.isInteger(st.p) && st.p >= 0 && st.p < 4)
      .map(st => ({ p: st.p, to: sysPt(st.to), wait: sysNum(st.wait, 0, 3) }));
    return { id, kind: 'off', name, pos, steps };
  }
  const mode = o.mode === 'man' ? 'man' : 'zone';
  return { id, kind: 'def', name, mode, zone: Array.from({ length: 4 }, (_, i) => sysPt(o.zone && o.zone[i])),
    roles: Array.from({ length: 5 }, (_, i) => (o.roles && SYS_ROLES[o.roles[i]] ? o.roles[i] : 'normal')) };
}
// systèmes de départ proposés dans l'éditeur
const SYS_NEW = {
  off: () => ({ kind: 'off', name: 'Mon attaque', pos: [[8, 2], [14, 1], [20, 0], [-3, -5]],
    steps: [] }),
  def: () => ({ kind: 'def', name: 'Ma défense', mode: 'zone', zone: [[5, 6], [5, -5], [13, 0], [25, 0]], roles: ['normal', 'normal', 'normal', 'normal', 'normal'] })
};

// ---------- stockage (gardé avec le compte, voir account.js) ----------
const SYS = { list: null };
function sysList() {
  if (!SYS.list) { const a = storeGet('uf-systems', []); SYS.list = (Array.isArray(a) ? a : []).map(cleanSystem).filter(Boolean).slice(0, SYS_MAX); }
  return SYS.list;
}
function sysSave(list) { SYS.list = list.map(cleanSystem).filter(Boolean).slice(0, SYS_MAX); storeSet('uf-systems', SYS.list); }
const sysById = id => sysList().find(s => s.id === id) || null;

// système joué par l'équipe t (kind = 'osys' attaque, 'dsys' défense) ; aucun en mode infini, tutoriel et entraînement
function sysOf(t, kind) {
  if ((G.series && G.series.endless) || G.tuto || G.practice || G.attract) return null;
  const c = cfg(t), v = c && c[kind];
  if (!v) return null;
  if (typeof v === 'object') return v;                          // en ligne : système envoyé par le capitaine
  return c === G.form ? sysById(v) : null;
}
const osysOf = t => { const s = sysOf(t, 'osys'); return s && s.kind === 'off' ? s : null; };
const dsysOf = t => { const s = sysOf(t, 'dsys'); return s && s.kind === 'def' ? s : null; };

// places (f,s) → terrain, autour du point (ax, ay). Le groupe glisse en bloc s'il déborde sur une ligne de côté.
function sysWorld(pts, ax, ay, dir, open) {
  const w = pts.map(([f, s]) => [clamp(ax + dir * f, 1.5, W - 1.5), ay + open * s]);
  const lo = Math.min(...w.map(p => p[1])), hi = Math.max(...w.map(p => p[1]));
  const shift = lo < 1.5 ? Math.min(1.5 - lo, Math.max(0, H - 1.5 - hi)) : hi > H - 1.5 ? -Math.min(hi - (H - 1.5), Math.max(0, lo - 1.5)) : 0;
  return w.map(([x, y]) => [x, clamp(y + shift, 1.5, H - 1.5)]);
}

// ---------- attaque ----------
function sysAssign(t, h) {                                     // remplace assignRoles quand l'équipe joue son système
  const S = osysOf(t), dir = dirOf(t), open = -closedOf(1 - t);
  const spots = sysWorld(S.pos, h.x, h.y, dir, open), pool = TEAMS[t].filter(p => p !== h);
  const order = [];
  for (let k = 0; k < 4; k++) {                                // chaque place prend le joueur libre le plus proche
    const p = nearest(pool, spots[k][0], spots[k][1]); if (!p) break;
    pool.splice(pool.indexOf(p), 1);
    p.sysIdx = k; p.role = 'cutter'; p.state = 'stack'; p.timer = 0; p.sysCut = false;
    order.push(p);
  }
  G.order[t] = order;
  h.role = 'holder'; h.sysIdx = -1;
  G.sysQ = { t, i: 0, timer: S.steps.length ? Math.max(0.3, S.steps[0].wait) : 0 };
  G.cutT = 9;
}
function sysSpot(S, p, ax, ay, dir, open) {
  const k = p.sysIdx >= 0 && p.sysIdx < 4 ? p.sysIdx : 3;
  const [x, y] = sysWorld(S.pos, ax, ay, dir, open)[k];
  return { x, y };
}
const SYS_BUSY = ['jab', 'cut', 'hold'];
function sysSequencer(t, ax, ay, dir, open, dt) {
  const S = osysOf(t), Q = G.sysQ;
  if (!Q || Q.t !== t || !S.steps.length) return;
  Q.timer -= dt;
  if (Q.timer > 0) return;
  if (Q.i >= S.steps.length) {                                  // séquence finie : quand tout le monde est revenu, on recommence
    for (const p of G.order[t]) if (p.state === 'park' && p.sysStay !== undefined) { p.state = 'clear'; p.wDone = true; p.timer = 4; p.sysStay = undefined; }
    if (G.order[t].some(p => SYS_BUSY.includes(p.state) || (p.state === 'clear' && dist(p.x, p.y, p.tx, p.ty) > 3))) return;
    Q.i = 0; Q.timer = 0.6; return;
  }
  const st = S.steps[Q.i], p = G.order[t].find(q => q.sysIdx === st.p);
  if (p && SYS_BUSY.includes(p.state) && p.sysCut && !userControls(p)) return;     // il finit d'abord sa course précédente, puis enchaîne de là
  Q.i++; Q.timer = Q.i < S.steps.length ? S.steps[Q.i].wait : 1;
  if (!p || p === disc.holder || userControls(p)) return;
  const [[x, y]] = sysWorld([st.to], ax, ay, dir, open);
  startCut(p, x, y, st.to[0] > 18);
  p.sysCut = true;
  p.sysStay = S.steps.slice(Q.i).some(s => s.p === st.p);       // encore une course après : il l'attendra au bout de celle-ci
}

// ---------- défense ----------
function sysZoneSlots(D, defT, ax, ay, dir, closed) {
  const open = -closed, [mx, my] = markSpot(defT, ax, ay), atk = TEAMS[1 - defT].filter(a => a !== disc.holder);
  const w = sysWorld(D.zone, ax, ay, dir, open);
  const s = [{ x: mx, y: my }];
  // ordre des places attendu par assignZone : 0 mark, 1 et 4 au fond, 2 et 3 devant → on range par profondeur
  const byDepth = w.map((p, i) => [p, D.zone[i][0]]).sort((a, b) => b[1] - a[1]).map(a => a[0]);
  const put = (k, [x, y]) => {                                 // chaque place se décale un peu vers l'attaquant le plus proche
    const [a, d] = nearestD(atk, x, y);
    s[k] = a && d < 7 ? { x: x + (a.x - x) * 0.3, y: y + (a.y - y) * 0.3 } : { x, y };
  };
  put(1, byDepth[0]); put(4, byDepth[1]); put(2, byDepth[2]); put(3, byDepth[3]);
  return keepOutOfCircle(s, ax, ay);
}
// individuelle : où se place un défenseur selon son rôle (null = comportement normal)
function sysManSpot(D, d, a, ax, ay, dir, open) {
  const role = D.roles[TEAMS[d.team].indexOf(d)] || 'normal';
  const ant = aiLvl(d.team).anticip;
  if (role === 'double' && disc.mode === 'held' && disc.holder && disc.holder !== a && G.stall > 5) {
    const k = (STALL_R + 0.7) / Math.hypot(0.6, 1);                // juste hors du cercle, côté open : il presse le porteur
    d.react = 0.1;
    return [disc.x + dir * 0.6 * k, disc.y + open * k];
  }
  if (role === 'serre') { const px = a.x + a.vx * ant * 1.5, py = a.y + a.vy * ant * 1.5; d.react = Math.min(d.react, 0.08); return [px + dir * 0.2, py + open * 0.5]; }
  if (role === 'profond') { const px = a.x + a.vx * ant, py = a.y + a.vy * ant; return [px + dir * 5, py * 0.65 + (H / 2) * 0.35]; }
  return null;
}
