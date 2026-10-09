// teams.js — Identité des équipes (nom, couleur) et réglages mémorisés dans le navigateur

// ---------------------------------------------------------------------
//  Noms et couleurs
//  • Solo : ton équipe et l'adversaire se règlent dans le menu (et sont mémorisés).
//  • Tournoi : l'adversaire est celui du tour en cours.
//  • En ligne : chaque capitaine règle son équipe ; une équipe IA garde son nom par défaut.
//    L'hôte calcule tout et l'envoie aux invités.
// ---------------------------------------------------------------------
function teamInfoRaw(t) {
  if (G.tuto) return DEFAULT_TEAMS[t];
  if (G.series && t !== G.me) return { name: SERIES[G.series.cur].name, color: SERIES[G.series.cur].color };
  const c = captain(t);
  if (c) { const cf = cfg(t); return { name: cf.tname || DEFAULT_TEAMS[t].name, color: PALETTE[cf.tcol] ? cf.tcol : DEFAULT_TEAMS[t].color }; }
  if (!G.net && G.attract && t === 0) return { name: G.form.tname || DEFAULT_TEAMS[0].name, color: PALETTE[G.form.tcol] ? G.form.tcol : DEFAULT_TEAMS[0].color };
  if (!G.net) return { name: G.form.oname || DEFAULT_TEAMS[t].name, color: PALETTE[G.form.ocol] ? G.form.ocol : DEFAULT_TEAMS[t].color };
  return DEFAULT_TEAMS[t];
}
function computeTeams() {
  if (G.net === 'guest') { if (G.netTeams) G.teams = G.netTeams; return; }
  const a = teamInfoRaw(0), b = Object.assign({}, teamInfoRaw(1));
  if (a.color === b.color) {                                 // deux équipes de la même couleur : la 2e en change
    b.color = DEFAULT_TEAMS[1].color !== a.color ? DEFAULT_TEAMS[1].color : Object.keys(PALETTE).find(k => k !== a.color);
  }
  G.teams = [{ name: String(a.name).slice(0, 16), color: a.color }, { name: String(b.name).slice(0, 16), color: b.color }];
}
// points pour gagner : réglés par l'hôte (5 en tournoi)
const winPts = () => (G.series ? WIN : G.net === 'guest' && G.netPts ? G.netPts : +G.form.points || WIN);
const tn = t => (G.teams[t] || DEFAULT_TEAMS[t]).name;
const tcol = t => (PALETTE[(G.teams[t] || DEFAULT_TEAMS[t]).color] || PALETTE.bleu)[0];
const tdark = t => (PALETTE[(G.teams[t] || DEFAULT_TEAMS[t]).color] || PALETTE.bleu)[1];
// version transparente d'une couleur (#rrggbb → rgba)
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
// texte lisible sur fond sombre (le noir devient gris clair)
const tlabel = t => (G.teams[t] && G.teams[t].color === 'noir' ? '#cbd5e1' : tcol(t));

// ---------------------------------------------------------------------
//  Réglages mémorisés (localStorage peut être indisponible : tout est protégé)
// ---------------------------------------------------------------------
function storeGet(k, def) {
  try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; }
}
function storeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
const SAVE_KEYS = {
  off: ['vert', 'ho', 'side'], def: ['man', 'zone', 'clam'], force: ['haut', 'bas', 'middle', 'straight'],
  speed: ['lent', 'normal', 'rapide'], level: ['facile', 'normal', 'difficile'], allyLevel: ['facile', 'normal', 'difficile'],
  windMode: ['random', 'fixed'], points: ['3', '5', '7'], cb: ['0', '1']
};
function loadSettings() {
  const o = storeGet('uf-settings', null);
  if (!o || typeof o !== 'object') return;
  for (const k in SAVE_KEYS) if (SAVE_KEYS[k].includes(o[k])) G.form[k] = o[k];
  if (Number.isInteger(o.windDir) && o.windDir >= 0 && o.windDir < 8) G.form.windDir = o.windDir;
  if (typeof o.windKmh === 'number') G.form.windKmh = clamp(Math.round(o.windKmh), 0, 40);
  for (const k of ['tname', 'oname']) if (typeof o[k] === 'string') G.form[k] = o[k].slice(0, 16);
  for (const k of ['tcol', 'ocol']) if (PALETTE[o[k]]) G.form[k] = o[k];
}
function saveSettings() {
  const o = {};
  for (const k of Object.keys(SAVE_KEYS).concat(['windDir', 'windKmh', 'tname', 'oname', 'tcol', 'ocol'])) o[k] = G.form[k];
  storeSet('uf-settings', o);
}
