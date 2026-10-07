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
      think: 1, match: null, zslot: 0, react: 0, dive: 0, down: 0, diveTried: false, tag: '' };
    players.push(p); TEAMS[t].push(p);
  }

const G = {
  score: [0, 0], off: 0, phase: 'menu', stall: 0, receiving: 0, time: 0,
  form: { off: 'vert', def: 'man', force: 'haut', play: 'none', dplay: 'none', speed: 'normal',
    windMode: 'random', windDir: 0, windKmh: 20 },
  ai: { off: 'vert', def: 'man', force: 'bas', play: 'none', dplay: 'none' },
  oplay: null, dplay: null, wind: { x: 0, y: 0, kmh: 0 }, gt: 0,
  order: [[], []], cutT: 0,
  curve: 0, aiming: false,
  me: 0,                                     // équipe contrôlée sur cet écran (0 = Bleus, 1 = Rouges)
  ctrl: ['local', 'ai'],                     // qui contrôle chaque équipe : local, remote (réseau) ou ai
  remoteCfg: { off: 'vert', def: 'man', force: 'haut', play: 'none', dplay: 'none' },
  sel: [null, null],                         // défenseur contrôlé par l'humain de chaque équipe
  rin: { x: 60, y: H / 2, down: false, last: -1e9 },   // entrées reçues de l'adversaire en ligne
  net: null, ready: [false, false], msgId: 0,
  pointer: { x: 60, y: H / 2, active: false, down: false, last: -1e9, downT: 0, downX: 0, downY: 0, type: 'mouse' },
  msg: '', msgT: 0, pickup: null, betweenT: 0, menuShown: true,
  stats: { throws: 0, comps: 0, blocks: 0, ints: 0, stalls: 0, ground: 0, out: 0, dives: 0 }
};
const disc = { mode: 'held', holder: null, x: 0, y: 0, z: 0, sx: 0, sy: 0, cx: 0, cy: 0, ex: 0, ey: 0,
  t: 0, dur: 1, thrower: null, team: 0, intended: null, rolled: new Set() };

function cfg(t) { const c = G.ctrl[t]; return c === 'local' ? G.form : c === 'remote' ? G.remoteCfg : G.ai; }
const human = t => G.ctrl[t] !== 'ai';
const inputOf = t => (G.ctrl[t] === 'local' ? G.pointer : G.rin);
const formOf = t => cfg(t).off;
function defFormOf(t) {
  const base = cfg(t).def;
  if (G.dplay && G.dplay.team === t && G.dplay.type === 'junk') return base === 'man' ? 'zone' : 'man';
  return base;
}

