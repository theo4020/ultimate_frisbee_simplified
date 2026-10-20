// systems.js — Systèmes de jeu personnalisés (créés dans l'éditeur, editor.js) et leur exécution par l'IA.
//
// Repère d'un système : tout est relatif au porteur du disque.
//   f = mètres vers l'avant (vers l'en-but attaqué), s = mètres vers le côté OPEN (négatif = côté break).
// Le système suit donc le disque partout sur le terrain et se retourne tout seul selon le côté forcé.
//
// Trois sortes de systèmes :
//  • FORMATION { kind:'off', name, pos:[[f,s]×4] (joueurs ① à ④), postes:[{ role, zone, when, after, fake }×4] }
//    Après chaque passe, le joueur le plus proche de chaque place prend ce poste et suit ses consignes (POSTE_OPTS) ;
//    « au choix de l'IA » = elle lit l'espace comme dans les formations du jeu (offense.js).
//  • PLAY { kind:'play', name, base:'vert'|'ho'|'side'|'sys:<id>', steps:[{ p:0..3, to:[f,s], wait:s }], setup, pos? }
//    Part d'une formation (du jeu ou perso) et n'ajoute que des courses : quand on l'appelle, chaque rôle ①–④ va au joueur
//    le plus proche de sa place et les courses partent dans l'ordre (plays.js). pos = places de la formation au moment de
//    l'enregistrement (sert si la formation n'existe pas chez celui qui le joue : galerie, en ligne).
//  • DÉFENSE { kind:'def', name, mark:{ force, dist, double }, postes:[{ mission, pos, side, gap, behave, help, swap }×4] }
//    La mark + 4 défenseurs, chacun en individuelle (il garde l'attaquant le plus proche de sa place) ou en zone (il garde
//    sa place) : on peut tout mélanger (junk). Voir DEF_OPTS et defense.js.
// Ancien format (avant les plays séparés) : une attaque avec des courses devient une formation + un play (sysList).

const SYS_MAX = 12, SYS_STEPS = 12;
// consignes d'un poste d'attaque (formation perso) ; la première valeur est celle par défaut
const POSTE_OPTS = {
  role: { cutter: 'Coupeur', dump: 'Relais', deep: 'Profond' },
  zone: { auto: 'Au choix de l’IA', open: 'Côté open', break: 'Côté break', deep: 'En profondeur', under: 'Vers le disque' },
  when: { auto: 'Dès que l’espace s’ouvre', turn: 'À son tour', catch: 'Juste après une réception', stall: 'Quand le stall monte', never: 'Jamais (reste placé)' },
  after: { auto: 'Au choix de l’IA', back: 'Revient à sa place', clear: 'Dégage côté break', chain: 'Reste où il est' },
  fake: { yes: 'Avec feinte', no: 'Sans feinte' }
};
const POSTE_LBL = { role: 'Rôle', zone: 'Zone de coupe', when: 'Quand couper', after: 'Après la coupe', fake: 'Feinte' };
const POSTE_DEF = { role: 'cutter', zone: 'auto', when: 'auto', after: 'auto', fake: 'yes' };
const cleanPoste = o => { const r = {}; for (const k in POSTE_OPTS) r[k] = o && POSTE_OPTS[k][o[k]] ? o[k] : POSTE_DEF[k]; return r; };
const SYS_ROLES = { normal: 'Normal', serre: 'Serré', profond: 'Profond', double: 'Double team' };
const SYS_F = [-12, 40], SYS_S = [-18, 18];                    // limites des positions dans l'éditeur
const sysNum = (v, a, b) => (typeof v === 'number' && isFinite(v) ? Math.round(clamp(v, a, b) * 10) / 10 : (a + b) / 2);
const sysPt = p => (Array.isArray(p) ? [sysNum(p[0], SYS_F[0], SYS_F[1]), sysNum(p[1], SYS_S[0], SYS_S[1])] : [10, 0]);
const sysId = () => Math.random().toString(36).slice(2, 8);

// lien avec la galerie : pub = id de sa publication (si tu l'as publié), by = auteur (si tu l'as ajouté depuis la galerie)
function sysMeta(o) {
  const m = {};
  if (typeof o.pub === 'string' && /^[a-z0-9-]{4,12}$/.test(o.pub)) m.pub = o.pub;
  if (typeof o.by === 'string' && o.by) m.by = o.by.replace(/[<>&"'`]/g, '').slice(0, 12);
  return m;
}
// consignes d'une défense perso : la mark, puis chaque défenseur
const MARK_OPTS = {
  force: { menu: 'Celle du menu', haut: 'Force haut', bas: 'Force bas', middle: 'Force middle', straight: 'Straight up' },
  dist: { normale: 'Normale', serree: 'Serrée', lache: 'Lâche' },
  double: { '0': 'Jamais', '4': 'Dès 4 de stall', '6': 'Dès 6 de stall', '8': 'Dès 8 de stall' }
};
const MARK_LBL = { force: 'Force', dist: 'Distance de la mark', double: 'Double team' };
const DEF_OPTS = {
  mission: { zone: 'Zone', man: 'Individuelle' },
  side: { auto: 'Entre lui et le disque', deep: 'Côté profondeur', open: 'Côté open', break: 'Côté break' },
  gap: { normal: 'Normal', serre: 'Serré', lache: 'Lâche' },
  behave: { shift: 'Suit l’attaquant proche', place: 'Garde sa place', deep: 'Suit le plus profond', press: 'Presse le porteur' },
  help: { oui: 'Peut aider', non: 'N’aide jamais' },
  swap: { oui: 'Peut échanger', non: 'Garde son joueur' }
};
const DEF_LBL = { mission: 'Mission', side: 'Placement', gap: 'Distance', behave: 'Comportement', help: 'Aide', swap: 'Changements' };
const DEF_SHOW = { man: ['mission', 'side', 'gap', 'help', 'swap'], zone: ['mission', 'behave', 'help'] };
const pick = (opts, v) => (Object.prototype.hasOwnProperty.call(opts, v) ? v : Object.keys(opts)[0]);
const cleanMark = o => ({ force: pick(MARK_OPTS.force, o && o.force), dist: pick(MARK_OPTS.dist, o && o.dist), double: pick(MARK_OPTS.double, o && String(o.double)) });
const cleanDefPoste = (o, i) => ({ mission: pick(DEF_OPTS.mission, o && o.mission), pos: sysPt(o && o.pos || SYS_DEF_POS[i]),
  side: pick(DEF_OPTS.side, o && o.side), gap: pick(DEF_OPTS.gap, o && o.gap), behave: pick(DEF_OPTS.behave, o && o.behave),
  help: pick(DEF_OPTS.help, o && o.help), swap: pick(DEF_OPTS.swap, o && o.swap) });
const SYS_DEF_POS = [[5, 6], [5, -5], [13, 0], [25, 0]];
// places de départ des formations du jeu (pour l'éditeur de plays) : ① relais, ②–④ coupeurs
const FORM_TEMPLATES = {
  vert: [[-3.5, -5], [10, 0], [14, 0], [18, 0]],
  ho: [[-3.5, -5], [13, 11], [13, 0], [13, -11]],
  side: [[-3.5, -5], [10, -11], [14, -11], [18, -11]]
};
const FORM_NAMES = { vert: 'Vertical stack', ho: 'Horizontal stack', side: 'Side stack' };
const validBase = b => (typeof b === 'string' && (FORM_TEMPLATES[b] || /^sys:[a-z0-9]{3,12}$/.test(b)) ? b : 'vert');
const cleanSteps = st => (Array.isArray(st) ? st : []).slice(0, SYS_STEPS)
  .filter(x => x && Number.isInteger(x.p) && x.p >= 0 && x.p < 4).map(x => ({ p: x.p, to: sysPt(x.to), wait: sysNum(x.wait, 0, 3) }));
// ancienne défense (mode zone : 4 places ; mode man : un rôle par défenseur) → missions
function oldDefense(o) {
  const roles = Array.isArray(o.roles) ? o.roles : [];
  if (o.mode !== 'man') return { mark: cleanMark(null), postes: Array.from({ length: 4 }, (_, i) => cleanDefPoste({ mission: 'zone', pos: o.zone && o.zone[i] }, i)) };
  return { mark: cleanMark({ double: roles.includes('double') ? '6' : '0' }),
    postes: Array.from({ length: 4 }, (_, i) => { const r = roles[i + 1];
      return cleanDefPoste({ mission: 'man', pos: o.zone && o.zone[i], gap: r === 'serre' ? 'serre' : 'normal', side: r === 'profond' ? 'deep' : 'auto' }, i); }) };
}
// nettoie un système (venant du navigateur, du compte ou d'un autre joueur en ligne) ; null s'il est invalide
function cleanSystem(o) {
  if (!o || typeof o !== 'object' || !['off', 'play', 'def'].includes(o.kind)) return null;
  const name = String(o.name || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24) || SYS_KIND_NAME[o.kind];
  const id = typeof o.id === 'string' && /^[a-z0-9]{3,12}$/.test(o.id) ? o.id : sysId();
  if (o.kind === 'off') {
    const pos = Array.from({ length: 4 }, (_, i) => sysPt(o.pos && o.pos[i]));
    const postes = Array.from({ length: 4 }, (_, i) => cleanPoste(o.postes && o.postes[i]));
    const r = Object.assign({ id, kind: 'off', name, pos, postes }, sysMeta(o));
    if (Array.isArray(o.steps) && o.steps.length) { r.steps = cleanSteps(o.steps); r.setup = !!o.setup; }   // ancien format (voir sysList)
    return r;
  }
  if (o.kind === 'play') {
    const r = Object.assign({ id, kind: 'play', name, base: validBase(o.base), steps: cleanSteps(o.steps), setup: !!o.setup }, sysMeta(o));
    if (Array.isArray(o.pos)) r.pos = Array.from({ length: 4 }, (_, i) => sysPt(o.pos[i]));
    return r;
  }
  const d = o.postes ? { mark: cleanMark(o.mark), postes: Array.from({ length: 4 }, (_, i) => cleanDefPoste(o.postes[i], i)) } : oldDefense(o);
  return Object.assign({ id, kind: 'def', name }, d, sysMeta(o));
}
const SYS_KIND_NAME = { off: 'Ma formation', play: 'Mon play', def: 'Ma défense' };
// systèmes de départ proposés dans l'éditeur
const SYS_NEW = {
  // départ : un vertical stack (deux coupeurs à tour de rôle côté open, un profond, un relais derrière côté break)
  off: () => ({ kind: 'off', name: 'Ma formation', pos: [[10, 1], [14, 1], [20, 0], [-3.5, -5]],
    postes: [{ role: 'cutter', zone: 'open', when: 'turn', after: 'clear' }, { role: 'cutter', zone: 'auto', when: 'turn', after: 'clear' },
      { role: 'deep', zone: 'deep', when: 'auto', after: 'back' }, { role: 'dump', zone: 'under', when: 'stall', after: 'back' }].map(cleanPoste) }),
  play: () => ({ kind: 'play', name: 'Mon play', base: 'vert', steps: [], setup: false }),
  // départ : une zone (cup à deux, un milieu, un deep qui suit le plus profond)
  def: () => ({ kind: 'def', name: 'Ma défense', mark: cleanMark(null),
    postes: [{ mission: 'zone', pos: [5, 6] }, { mission: 'zone', pos: [5, -5] }, { mission: 'zone', pos: [13, 0] }, { mission: 'zone', pos: [25, 0], behave: 'deep' }].map(cleanDefPoste) })
};
// places ①–④ d'un play : celles de sa formation de départ (perso si elle existe ici, sinon celles enregistrées avec le play)
function playPos(S) {
  if (S.kind === 'off') return S.pos;                            // ancien format
  if (FORM_TEMPLATES[S.base]) return FORM_TEMPLATES[S.base];
  const F = sysById(S.base.slice(4));
  return F && F.kind === 'off' ? F.pos : S.pos || FORM_TEMPLATES.vert;
}
const baseName = b => (FORM_TEMPLATES[b] ? FORM_NAMES[b] : (sysById(String(b).slice(4)) || {}).name || 'Formation supprimée');
// un play envoyé ailleurs (en ligne, galerie) emporte les places de sa formation
const playOut = S => (S && S.kind === 'play' ? Object.assign({}, S, { pos: playPos(S) }) : S);

// ---------- stockage (gardé avec le compte, voir account.js) ----------
const SYS = { list: null };
function sysList() {
  if (!SYS.list) {
    const a = storeGet('uf-systems', []), L = (Array.isArray(a) ? a : []).map(cleanSystem).filter(Boolean);
    const out = migrateSystems(L);
    SYS.list = out.slice(0, SYS_MAX + 6);                         // la séparation des plays peut dépasser un peu la limite
    if (out.length !== L.length) storeSet('uf-systems', SYS.list);
  }
  return SYS.list;
}
// ancien format : une attaque avec des courses → la formation (mêmes places) + un play qui part de cette formation
function migrateSystems(L) {
  const out = [];
  for (const s of L) {
    if (s.kind !== 'off' || !s.steps) { out.push(s); continue; }
    const steps = s.steps, setup = s.setup; delete s.steps; delete s.setup;
    out.push(s);
    if (!steps.length) continue;
    const pl = cleanSystem({ kind: 'play', name: s.name, base: 'sys:' + s.id, steps, setup, pos: s.pos });
    out.push(pl);
    for (const n of [1, 2]) if (G.form['p' + n + 'sys'] === s.id) G.form['p' + n + 'sys'] = pl.id;   // ses plays choisis suivent
  }
  return out;
}
function sysSave(list) { SYS.list = migrateSystems(list.map(cleanSystem).filter(Boolean)).slice(0, SYS_MAX + 6); storeSet('uf-systems', SYS.list); }
const sysById = id => sysList().find(s => s.id === id) || null;

// système joué par l'équipe t (kind = 'osys' attaque, 'dsys' défense) ; aucun dans le tutoriel et l'entraînement
function sysOf(t, kind) {
  if (G.tuto || G.practice || G.attract) return null;
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
    p.sysIdx = k; p.poste = S.postes ? S.postes[k] : POSTE_DEF; p.sysCut = false;
    if (p.poste.role === 'dump') { p.role = 'dump'; p.state = 'set'; p.timer = rand(1, 2); }   // relais : il se propose derrière le porteur
    else { p.role = 'cutter'; p.state = 'stack'; p.timer = 0; order.push(p); }
  }
  G.order[t] = order;
  h.role = 'holder'; h.sysIdx = -1;
  G.cutT = 0.4;
}
// rôles selon la position, formation perso : deux joueurs échangent leurs places (et leurs consignes, qui restent
// attachées à la place) si c'est nettement plus court pour eux ; un joueur en pleine course garde la sienne
function sysRefresh(t, h) {
  const S = osysOf(t), dir = dirOf(t), open = -closedOf(1 - t), spots = sysWorld(S.pos, h.x, h.y, dir, open);
  const L = TEAMS[t].filter(p => p !== h && p.sysIdx >= 0 && p.sysIdx < 4 && !runBusy(p) && !userControls(p));
  const d = (p, k) => dist(p.x, p.y, spots[k][0], spots[k][1]);
  for (const a of L) for (const b of L) {
    if (a === b) continue;
    if (d(a, b.sysIdx) + d(b, a.sysIdx) < d(a, a.sysIdx) + d(b, b.sysIdx) - 3) {
      const k = a.sysIdx; a.sysIdx = b.sysIdx; b.sysIdx = k;
      for (const p of [a, b]) { p.poste = S.postes ? S.postes[p.sysIdx] : POSTE_DEF; setRole(p, p.poste.role === 'dump' ? 'dump' : 'cutter', 0); }
    }
  }
  G.order[t] = TEAMS[t].filter(p => p !== h && p.role === 'cutter').sort((a, b) => a.sysIdx - b.sysIdx);
}
function sysSpot(S, p, ax, ay, dir, open) {
  const k = p.sysIdx >= 0 && p.sysIdx < 4 ? p.sysIdx : 3;
  const [x, y] = sysWorld(S.pos, ax, ay, dir, open)[k];
  return { x, y };
}
const SYS_BUSY = ['jab', 'cut', 'hold'];
