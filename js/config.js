// config.js — Constantes, textes des stratégies et des plays

// =====================================================================
//  Constantes (unités : mètres, secondes)
// =====================================================================
const W = 100, H = 37, EZ = 18, M = 2, N = 5, WIN = 5;
const SPD = { jog: 4.6, cut: 7.6, def: 7.4, user: 7.5, sprint: 7.8, dive: 11 };
const ACC = { atk: 24, def: 21 };
// Réglages de la défense IA (plus les temps de réaction sont courts et l'anticipation forte, plus elle est dure)
// Niveaux de l'IA (« IA adverse » pour les équipes sans humain, « Coéquipiers IA » pour les autres, voir humans.js)
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
// saut : préparation (le joueur s'accroupit et ralentit), temps en l'air, gain de hauteur au sommet,
// récupération à la réception (ralenti) et délai avant de pouvoir ressauter
const JUMP_PREP = 0.25, JUMP_T = 0.5, JUMP_H = 1.0, JUMP_REC = 0.35, JUMP_CD = 0.7;
const HIGH_WINDUP = 0.55;                                   // l'IA lève le disque au-dessus de sa tête avant une passe haute
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
  flood: 'Tout le monde clear côté break et laisse l’open side à un seul cutter (1), qui fait un under cut puis repart en deep.',
  swing: 'Le dump (1) se place derrière toi côté break. Passe-lui le disque : dès qu’il l’a, un cutter (2) attaque l’espace de l’autre côté pour recevoir le swing. Idéal pour changer de côté face à une mark agressive.'
};
const DPLAYS = {
  none: 'Pas de play : ta défense de base dès le début.',
  safety: 'Un défenseur (S) lâche le dump pour protéger le deep en début de point. Anti-huck, mais les passes courtes sont faciles.',
  double: 'Un deuxième défenseur (2) lâche le dump et se poste juste hors du cercle de stall, côté open, pour couper les passes courtes du premier lancer (un 2e défenseur dans le cercle serait un double team).',
  junk: 'Commence dans l’autre système (zone ↔ man) pour surprendre, puis bascule sur ta défense de base après 2 passes.'
};
const PLAY_NAMES = { none: 'aucun', huck: 'Huck', split: 'Double cut', give: 'Give and go', flood: 'Iso', swing: 'Dump-swing',
  safety: 'Deep safety', double: 'Poach', junk: 'Junk' };

const NAMES = { vert: 'Vertical stack', ho: 'Horizontal stack', side: 'Side stack', man: 'Man', zone: 'Zone', clam: 'Clam',
  haut: 'force haut', bas: 'force bas', middle: 'force middle', straight: 'straight up' };
const DESCS = {
  vert: 'Les cutters s’alignent au centre. Un seul cut à la fois (under ou deep), puis le cutter clear et retourne au bout du stack.',
  ho: 'Trois cutters en largeur, chacun dans son couloir. Les cuts alternent entre under et deep.',
  man: 'Chaque défenseur suit son attaquant et se place côté open pour couper les passes. La mark impose la force choisie.',
  side: 'Les cutters s’alignent le long de la ligne côté break : tout l’open side reste libre pour les cuts. Très lisible, mais la défense sait de quel côté ça arrive.',
  zone: 'Un cup de 3 joueurs autour du disque, un middle au centre et un deep en profondeur. En zone, la mark force toujours middle.',
  clam: 'Hybride : la mark, deux défenseurs qui gênent les under cuts devant le disque, et deux deep qui se partagent la profondeur. Les hucks deviennent très durs ; l’attaque doit avancer à petites passes, patiemment.',
  haut: 'La mark bloque le bas : le handler est obligé de lancer vers le haut du terrain, où tes défenseurs l’attendent.',
  bas: 'La mark bloque le haut : le handler est obligé de lancer vers le bas du terrain, où tes défenseurs l’attendent.',
  middle: 'La mark se place côté ligne : le handler est obligé de jouer vers le centre du terrain.',
  straight: 'La mark se place pile devant le handler : elle coupe les lancers vers l’avant (et les hucks), mais laisse les deux côtés ouverts.'
};

// Types de lancer : dur = temps de vol, peak = hauteur, drift = sensibilité au vent, drop = chance de drop en plus
// (+ dropWind par km/h de vent). L'imprécision est calculée par throwErr (throwing.js).
//  • normal : passe classique
//  • high : passe haute (hammer, blade…) — par-dessus la défense, mais lente, imprécise avec la distance et le vent,
//    et plus dure à attraper
const THROWS = {
  normal: { name: 'Normal', dur: 1, peak: 1, drift: 1, min: 2, max: 50, drop: 0, dropWind: 0 },
  high: { name: 'Passe haute', dur: 1.4, peak: 2.4, drift: 1.3, min: 6, max: 30, drop: 0.04, dropWind: 0.002 }
};
const THROW_ORDER = ['normal', 'high'];

// Couleurs d'équipe : remplissage, contour, teinte de l'en-but
const PALETTE = {
  bleu: ['#3b82f6', '#1e3a8a'], rouge: ['#ef4444', '#7f1d1d'], jaune: ['#facc15', '#854d0e'], violet: ['#a855f7', '#581c87'],
  orange: ['#f97316', '#7c2d12'], rose: ['#ec4899', '#831843'], turquoise: ['#14b8a6', '#134e4a'], blanc: ['#f1f5f9', '#475569'], noir: ['#1f2937', '#000000']
};
const DEFAULT_TEAMS = [{ name: 'Bleus', color: 'bleu' }, { name: 'Rouges', color: 'rouge' }];

// Mini-tournoi : trois adversaires de plus en plus forts
const SERIES = [
  { name: 'Écureuils', color: 'orange', level: 'facile', blurb: 'Une équipe sympa qui débute. Idéal pour se chauffer.' },
  { name: 'Faucons', color: 'violet', level: 'normal', blurb: 'Solides et organisés : il faudra construire tes attaques.' },
  { name: 'Titans', color: 'noir', level: 'difficile', blurb: 'Les champions en titre. Rapides, précis, ils ne pardonnent rien.' }
];

// Joueurs : prénoms affichés dans les statistiques
const PLAYER_NAMES = [['Léo', 'Inès', 'Hugo', 'Maya', 'Noah'], ['Sam', 'Lina', 'Tom', 'Zoé', 'Max']];
const EMOTES = ['👍', '👏', '🔥', '😅', 'Cut !', 'GG'];

