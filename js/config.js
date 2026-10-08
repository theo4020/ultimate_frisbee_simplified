// config.js — Constantes, textes des stratégies et des plays

// =====================================================================
//  Constantes (unités : mètres, secondes)
// =====================================================================
const W = 100, H = 37, EZ = 18, M = 2, N = 5, WIN = 5;
const SPD = { jog: 4.6, cut: 7.6, def: 7.4, user: 7.5, sprint: 7.8, dive: 11 };
const ACC = { atk: 24, def: 21 };
// Réglages de la défense IA (plus les temps de réaction sont courts et l'anticipation forte, plus elle est dure)
// Niveau de l'IA adverse (équipes sans aucun humain). Les coéquipiers IA restent toujours au niveau normal.
//   react : multiplie les temps de réaction · anticip : anticipation des courses (s) · block / int : chances de contre
//   speed : vitesse des joueurs · err : imprécision des lancers · safe : prudence dans le choix des passes
const AI_LEVELS = {
  facile:    { react: 1.6,  anticip: 0.1,  block: 0.42, int: 0.12, speed: 0.93, err: 1.6, safe: -0.05 },
  normal:    { react: 1,    anticip: 0.3,  block: 0.6,  int: 0.2,  speed: 1,    err: 1,   safe: 0 },
  difficile: { react: 0.72, anticip: 0.4,  block: 0.68, int: 0.25, speed: 1.04, err: 0.65, safe: 0.08 }
};
const DEF_TUNE = {
  reactMan: [0.14, 0.24],   // temps de réaction en individuelle (s)
  reactZone: [0.1, 0.16],   // temps de réaction en zone (s)
  anticip: 0.3,             // anticipation de la course de l'attaquant (s)
  block: 0.6,               // chance de contrer quand le disque passe à portée (debout)
  int: 0.2                  // dont chance d'intercepter
};
const DIVE_T = 0.33, DOWN_T = 0.8;
const SPEEDS = { lent: 0.6, normal: 0.78, rapide: 1 };
const DRIFT = 0.5;                                          // dérive du disque : vent (m/s) × temps de vol × DRIFT
const STALL_R = 4.5;                                        // rayon du stall count (agrandi par rapport aux 3 m réels)
const STALL_RATE = 1.5;                                     // vitesse du stall count : 1,5 compte par seconde de jeu (10 comptes ≈ 6,7 s)
const REACH_STAND = 2.0, REACH_DIVE = 1.5;                  // hauteur max du disque contrable debout / en plongeon
const CANCEL_R = 2.5;                                       // relâcher à moins de 2,5 m du handler annule le lancer
const PEER_PREFIX = 'ultimate-frisbee-proto-v1-';
// ---------------------------------------------------------------------
//  RELAIS (TURN) — les identifiants viennent de js/secrets.js (ignoré par Git).
//  En ligne, ce fichier est généré au déploiement à partir des « secrets » du dépôt
//  GitHub (voir README.md et .github/workflows/deploy.yml).
// ---------------------------------------------------------------------
const SECRETS = (typeof window !== 'undefined' && window.ULTIMATE_SECRETS) || {};
const TURN_USER = SECRETS.TURN_USER || '';
const TURN_PASS = SECRETS.TURN_PASS || '';
const TURN_APP = SECRETS.TURN_APP || '';
const TURN_KEY = SECRETS.TURN_KEY || '';
const BASE_ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }
];
const PEERJS_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js',
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js'];

const PLAYS = {
  none: 'Pas de play : la structure normale démarre tout de suite.',
  huck: 'Le cutter ★ fait une feinte puis part en deep dès le début. Lance long, devant lui. Risqué, mais ça peut marquer en une passe.',
  split: 'Deux cutters (1) partent en même temps, un open side et un break side. Prends celui qui est libre : côté break, il faut de la courbe.',
  give: 'Passe courte au dump (1) placé à côté de toi : dès que le disque part, tu fais un cut vers l’avant (2) pour recevoir le retour.',
  flood: 'Tout le monde clear côté break et laisse l’open side à un seul cutter (1), qui fait un under cut puis repart en deep.'
};
const DPLAYS = {
  none: 'Pas de play : ta défense de base dès le début.',
  safety: 'Un défenseur (S) lâche le dump pour protéger le deep en début de point. Anti-huck, mais les passes courtes sont faciles.',
  double: 'Un deuxième défenseur (2) lâche le dump et se poste juste hors du cercle de stall, côté open, pour couper les passes courtes du premier lancer (un 2e défenseur dans le cercle serait un double team).',
  junk: 'Commence dans l’autre système (zone ↔ man) pour surprendre, puis bascule sur ta défense de base après 2 passes.'
};
const PLAY_NAMES = { none: 'aucun', huck: 'Huck', split: 'Double cut', give: 'Give and go', flood: 'Iso',
  safety: 'Deep safety', double: 'Poach', junk: 'Junk' };

const NAMES = { vert: 'Vertical stack', ho: 'Horizontal stack', man: 'Man', zone: 'Zone', haut: 'force haut', bas: 'force bas', middle: 'force middle' };
const DESCS = {
  vert: 'Les cutters s’alignent au centre. Un seul cut à la fois (under ou deep), puis le cutter clear et retourne au bout du stack.',
  ho: 'Trois cutters en largeur, chacun dans son couloir. Les cuts alternent entre under et deep.',
  man: 'Chaque défenseur suit son attaquant et se place côté open pour couper les passes. La mark impose la force choisie.',
  zone: 'Un cup de 3 joueurs autour du disque, un middle au centre et un deep en profondeur. En zone, la mark force toujours middle.',
  haut: 'La mark bloque le bas : le handler est obligé de lancer vers le haut du terrain, où tes défenseurs l’attendent.',
  bas: 'La mark bloque le haut : le handler est obligé de lancer vers le bas du terrain, où tes défenseurs l’attendent.',
  middle: 'La mark se place côté ligne : le handler est obligé de jouer vers le centre du terrain.'
};

