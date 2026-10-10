// state.js — État du jeu : joueurs, disque, configuration de chaque équipe

// =====================================================================
//  État du jeu
// =====================================================================
const players = [];
const TEAMS = [[], []];
for (let t = 0; t < 2; t++)
  for (let i = 0; i < N; i++) {
    const p = { team: t, i, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, sp: 0,
      role: 'cutter', state: 'stack', timer: 0, cx: 0, cy: 0, wx: 0, wy: 0, wDone: true,
      think: 1, match: null, zslot: 0, react: 0, dive: 0, down: 0, diveTried: false, tag: '', jump: 0, jprep: 0, jrec: 0, jumpCd: 0, jumpAt: 0, jumpTried: false, windup: null };
    players.push(p); TEAMS[t].push(p);
  }

const G = {
  score: [0, 0], off: 0, phase: 'menu', stall: 0, receiving: 0, time: 0,
  form: { off: 'vert', def: 'man', force: 'haut', play: 'none', dplay: 'none', speed: 'normal', level: 'normal', allyLevel: 'normal',
    windMode: 'random', windDir: 0, windKmh: 20,
    tname: '', tcol: '', oname: '', ocol: '', points: '5', cb: '0', puller: 'cap', first: 'r' },   // first : équipe qui commence en attaque ('0', '1' ou 'r' = au hasard)   // puller : 'cap' (capitaine), 'rot' (chacun son tour), 'ai' ou l'id d'un joueur   // points pour gagner, couleurs adaptées au daltonisme              // noms et couleurs (vide = par défaut)
  ai: { off: 'vert', def: 'man', force: 'bas', play: 'none', dplay: 'none' },
  oplay: null, dplay: null, wind: { x: 0, y: 0, kmh: 0 }, gt: 0,
  order: [[], []], cutT: 0,
  curve: 0, aiming: false,
  me: 0,                                     // équipe de la personne devant cet écran (0 = Bleus, 1 = Rouges)
  net: null, msgId: 0,                       // humains et contrôles : voir humans.js
  pointer: { x: 60, y: H / 2, active: false, down: false, last: -1e9, downT: 0, downX: 0, downY: 0, type: 'mouse' },
  msg: '', msgT: 0, pickup: null, betweenT: 0, menuShown: true,
  stats: { throws: 0, comps: 0, blocks: 0, ints: 0, stalls: 0, ground: 0, out: 0, dives: 0 },
  teams: DEFAULT_TEAMS.map(o => Object.assign({}, o)),   // nom et couleur affichés de chaque équipe (voir teams.js)
  ms: null,                                  // statistiques du match en cours (voir stats.js)
  throwKind: 'normal',                       // type du prochain lancer : normal ou high (passe haute)
  series: null, tuto: null, replay: null, emotes: [], spectator: false,
  attract: false, practice: null                             // match IA contre IA derrière le menu principal
};
const disc = { mode: 'held', holder: null, x: 0, y: 0, z: 0, sx: 0, sy: 0, cx: 0, cy: 0, ex: 0, ey: 0,
  t: 0, dur: 1, thrower: null, team: 0, intended: null, rolled: new Set(), kind: 'normal', curveV: 0 };

const formOf = t => cfg(t).off;
function defFormOf(t) {
  const base = cfg(t).def;
  if (G.dplay && G.dplay.team === t && G.dplay.type === 'junk') return base === 'man' ? 'zone' : 'man';
  return base;
}

