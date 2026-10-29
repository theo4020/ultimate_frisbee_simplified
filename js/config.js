// config.js — Constantes, textes des stratégies et des plays

// =====================================================================
//  Constantes (unités : mètres, secondes)
// =====================================================================
const W = 100, H = 37, EZ = 18, M = 2, N = 5, WIN = 5;   // WIN : points pour gagner par défaut (réglable, voir winPts)
const SPD = { jog: 4.6, cut: 7.6, def: 7.4, user: 7.5, sprint: 7.8 };
// plongeon : il s'ajoute à l'élan (+boost dans sa direction, au moins min) ; l'élan sur le côté est gardé
const DIVE = { boost: 2.5, min: 6.5 };
// course (voir la fiche « Fondations physiques ») : accélération réaliste (~1,3 s jusqu'à la pointe), freinage et virages
// plus vifs mais pas instantanés — un changement de direction coûte vraiment du temps, c'est ce qui crée les démarquages
const RUN = { acc: 6, dec: 12, lat: 9, defK: 0.95 };
// Réglages de la défense IA (plus les temps de réaction sont courts et l'anticipation forte, plus elle est dure)
// Niveaux de l'IA (« IA adverse » pour les équipes sans humain, « Coéquipiers IA » pour les autres, voir humans.js).
// Tous les niveaux jouent avec la même intelligence (rôles selon la position, coupes, défense collective) ; un niveau se
// règle avec 4 qualités de joueur :
//   react : temps de réaction (× ; 1 = normal, plus petit = plus vif)
//   speed : vitesse de course (×), et donc détente
//   prec  : précision (0 à 1) : lancers, vitesse du disque, mains, contres
//   read  : lecture du jeu (0 à 1) : un joueur qui lit mal croit des passes ouvertes qui ne le sont pas, anticipe moins,
//           feinte rarement — il ne joue pas au hasard, il se trompe
// skill() en déduit les réglages utilisés par le jeu (mêmes noms partout) :
//   anticip (s), block, jump (m), tspd (durée de vol, < 1 = disque plus rapide), err, hands, safe, greed,
//   fake (chance de feinter la mark), misread (s : défenseurs vus plus lents qu'ils ne sont), look / lift / fov / ext (vision.js)
function skill(k) {
  // prec et read vont de 0 à 1 ; en dessous de 0 (jusqu'à -1) : vrai débutant (lancers ratés, mains de beurre, passes forcées)
  const prec = Math.max(-1, Math.min(1, k.prec)), read = Math.max(-1, Math.min(1, k.read));   // (clamp n'existe pas encore : util.js vient après)
  const spow = (x, e) => Math.sign(x) * Math.abs(x) ** e, low = Math.max(0, -prec);
  return { k: { react: k.react, speed: k.speed, prec, read }, react: k.react, speed: k.speed,
    jump: Math.min(1.1, 0.4 + (k.speed - 0.9) * 1.6),
    block: Math.min(0.99, 0.8 + 0.2 * prec), err: 0.35 + 1.55 * (1 - prec) ** 1.3, tspd: 1.12 - 0.27 * prec, hands: 0.004 * (1 - prec) ** 2 + 0.06 * low,
    anticip: Math.max(0.05, 0.22 + 0.2 * read), safe: -0.05 + 0.16 * spow(read, 1.3), greed: Math.min(1, 0.6 * (1 - read) ** 2.5),
    fake: Math.max(0.02, 0.12 + 0.4 * read), misread: 0.25 * (1 - read),
    // vision (vision.js) : coup d'œil toutes les look s, lever la tête après une réception (lift s), demi-angle de vision (fov rad),
    // prolongement des courses vues (ext : 0 = il croit les joueurs immobiles, 1 = il anticipe parfaitement)
    look: Math.min(0.6, 0.04 + 0.4 * (1 - read) ** 1.6), lift: Math.min(0.6, 0.04 + 0.4 * (1 - read) ** 1.6),
    fov: Math.max(0.7, Math.min(1.4, 0.75 + 0.6 * read)), ext: Math.max(0, Math.min(1, 0.1 + 1.1 * read)) };
}
const AI_LEVELS = {
  facile:    skill({ react: 1.4, speed: 0.87, prec: -0.5, read: -0.5 }),    // débutant
  normal:    skill({ react: 1,   speed: 1,    prec: 0.5,  read: 0.5 }),
  difficile: skill({ react: 0.8, speed: 1.09, prec: 0.75, read: 0.8 })
};
const DEF_TUNE = {
  reactMan: [0.2, 0.3],     // temps de réaction en individuelle (s)
  reactZone: [0.15, 0.22],  // temps de réaction en zone (s)
  anticip: 0.3,             // anticipation de la course de l'attaquant (s)
  block: 0.6                // chance de contrer quand le disque passe à portée (debout)
};
const DIVE_T = 0.28, DOWN_T = 1.2;                         // plongeon : ~1,8 m arrêté, ~2,8 m lancé, puis 1,2 s au sol
// saut : préparation (le joueur s'accroupit et ralentit), temps en l'air, gain de hauteur au sommet,
// récupération à la réception (ralenti) et délai avant de pouvoir ressauter
const JUMP_PREP = 0.05, JUMP_T = 0.5, JUMP_H = 0.6, JUMP_REC = 0.15, JUMP_CD = 0.35;
const HIGH_WINDUP = [0.3, 1.2];                            // l'IA arme sa passe haute plus ou moins longtemps avant de lancer
const SPEEDS = { lent: 0.72, normal: 0.88, rapide: 1.05 };   // vitesse du jeu (× le temps réel)
const DRIFT = 0.5;                                          // dérive du disque : vent (m/s) × temps de vol × DRIFT
const STALL_R = 4;                                          // distance max de la mark pour le stall count (4 m)
const STALL_RATE = 1;                                       // stall count : 1 compte par seconde
const REACH_STAND = 2.2, REACH_DIVE = 1.9;                  // hauteur max du disque atteignable debout (bras levé) / en plongeon
const ARM_R = 1.0, DIVE_R = 1.1;
// duel porteur / mark : le porteur pivote (lâcher jusqu'à PIVOT_R m sur le côté, PIVOT_T s pour passer du centre au côté),
// la mark suit son pivot avec un temps de réaction, et se fend vers le disque au lâcher (MARK_LUNGE m pendant MARK_LUNGE_T s)
const PIVOT_R = 1.1, PIVOT_T = 0.25, MARK_LUNGE = 0.4, MARK_LUNGE_T = 0.35;                            // portée des bras autour du corps : debout / en plongeon (en plus du vol)
const CANCEL_R = 2.5;                                       // relâcher à moins de 2,5 m du handler annule le lancer
const PEER_PREFIX = 'ultimate-frisbee-proto-v1-';
// ---------------------------------------------------------------------
//  RELAIS (TURN) — en ligne, le relais Cloudflare passe par /api/turn (worker/index.js, voir README).
//  Secours seulement (en local ou ancien hébergement) : identifiants fixes de js/secrets.js (ignoré par Git).
// ---------------------------------------------------------------------
const SECRETS = (typeof window !== 'undefined' && window.ULTIMATE_SECRETS) || {};
const TURN_USER = SECRETS.TURN_USER || '';
const TURN_PASS = SECRETS.TURN_PASS || '';
const BASE_ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }
];
const PEERJS_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js',
  'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js'];

const PLAYS = {
  none: 'Pas de play.',
  huck: 'Le cutter le plus en avant et le plus libre (★) part tout de suite en deep. Lance long, devant lui.',
  split: 'Deux cutters (1) partent en même temps vers le disque, un côté open et un côté break. Prends celui qui est libre (côté break, il faut de la courbe).',
  give: 'Le joueur le plus en arrière vient à côté de toi (1) : passe-lui le disque et file aussitôt vers l’avant (2) pour recevoir le retour.',
  flood: 'Iso : tout le monde dégage côté break, un seul cutter (1) attaque l’open side, d’abord vers toi puis en deep.',
  swing: 'Le joueur le plus en arrière se place derrière toi côté break (1). Dès qu’il a le disque, un cutter (2) attaque l’autre côté.'
};
const DPLAYS = {
  none: 'Pas de play : ta défense de base dès le début.',
  safety: 'Un défenseur (S) lâche le dump pour protéger le deep en début de point. Anti-huck, mais les passes courtes sont faciles.',
  double: 'Un deuxième défenseur (2) lâche le dump et se poste juste hors du cercle de stall, côté open, pour couper les passes courtes du premier lancer (un 2e défenseur dans le cercle serait un double team).',
  junk: 'Commence dans l’autre système (zone ↔ man) pour surprendre, puis bascule sur ta défense de base après 2 passes.'
};
const PLAY_NAMES = { none: 'aucun', huck: 'Huck', split: 'Double cut', give: 'Give and go', flood: 'Iso', swing: 'Dump-swing',
  safety: 'Deep safety', double: 'Poach', junk: 'Junk' };

const NAMES = { vert: 'Vertical stack', ho: 'Horizontal stack', side: 'Side stack', man: 'Man', zone: 'Zone', clam: 'Clam', mix: 'Défense perso',
  haut: 'force haut', bas: 'force bas', middle: 'force middle', straight: 'straight up' };
const DESCS = {
  vert: 'Les cutters s’alignent au centre et attaquent l’espace libre (under ou deep), un à la fois, puis retournent au bout du stack.',
  ho: 'Trois cutters en largeur, chacun dans son couloir. Ils attaquent l’espace que la défense laisse libre.',
  man: 'Chaque défenseur suit son attaquant et se place côté open pour couper les passes. La mark impose la force choisie.',
  side: 'Les cutters s’alignent le long de la ligne côté break : tout l’open side reste libre pour les cuts. Très lisible, mais la défense sait de quel côté ça arrive.',
  zone: 'Un cup de 3 joueurs autour du disque, un middle au centre et un deep au fond. En zone, la mark force toujours middle.',
  clam: 'Hybride : la mark, deux défenseurs qui gênent les under cuts devant le disque, et deux deep qui se partagent le fond. Les hucks deviennent très durs ; l’attaque doit avancer à petites passes, patiemment.',
  haut: 'La mark bloque le bas : le handler est obligé de lancer vers le haut du terrain, où tes défenseurs l’attendent.',
  bas: 'La mark bloque le haut : le handler est obligé de lancer vers le bas du terrain, où tes défenseurs l’attendent.',
  middle: 'La mark se place côté ligne : le handler est obligé de jouer vers le centre du terrain.',
  restart_pose: 'Après une perte, le disque reste au sol : un handler vient le chercher en marchant et arrive quand tout le monde est en place. La défense ne marque qu’une fois qu’il a le disque.',
  restart_rapide: 'Après une perte, le joueur le plus proche ramasse le disque tout de suite : on surprend la défense avant qu’elle soit en place.',
  straight: 'La mark se place pile devant le handler : elle coupe les lancers vers l’avant (et les hucks), mais laisse les deux côtés ouverts.'
};

// Hauteur de passe (loft), de 0 à 1 : tout change en continu avec elle
//  • 0 : passe rasante — tendue, plus rapide, plus précise, moins sensible au vent, mais facile à couper près du lanceur ;
//  • 0,3 : passe normale ;
//  • 1 : passe haute (hammer, blade…) — par-dessus la défense, mais lente, imprécise avec la distance et le vent,
//    plus dure à attraper ; au-dessus de TELL, le disque levé se voit et la mark peut tenter de deviner le lâcher.
// dur = temps de vol (×), drift = sensibilité au vent, min/max = distance possible, drop (+ dropWind par km/h) = drops en plus.
// L'imprécision et la forme du vol sont calculées par throwErr (throwing.js) et heightAt (util.js).
const LOFT = { MIN: 0, N: 0.3, MAX: 1, STEP: 0.1, HIGH: 0.7, TELL: 0.55 };
const THROW_LOW = { dur: 0.88, drift: 0.85, min: 2, max: 50, drop: 0, dropWind: 0 };
const THROW_N = { dur: 1, drift: 1, min: 2, max: 50, drop: 0, dropWind: 0 };
const THROW_HIGH = { dur: 1.4, drift: 1.3, min: 6, max: 30, drop: 0.006, dropWind: 0.00025 };
// une hauteur (nombre) ou un ancien type ('normal', 'high')
function loftOf(k) { return typeof k === 'number' && isFinite(k) ? Math.max(LOFT.MIN, Math.min(LOFT.MAX, k)) : k === 'high' ? LOFT.MAX : LOFT.N; }
const loftW = l => Math.max(0, (l - LOFT.N) / (LOFT.MAX - LOFT.N));   // part « passe haute » (0 → 1)
const loftLow = l => Math.max(0, (LOFT.N - l) / (LOFT.N - LOFT.MIN)); // part « rasante » (0 → 1)
function throwK(k) {
  const l = loftOf(k), w = loftW(l), A = w > 0 ? THROW_HIGH : THROW_LOW, f = w > 0 ? w : loftLow(l), o = {};
  for (const key in THROW_N) o[key] = THROW_N[key] + (A[key] - THROW_N[key]) * f;
  return o;
}
const loftLabel = l => (l >= LOFT.HIGH ? 'high' : 'normal');   // catégorie (stats, succès, tutoriel)
const loftName = l => (l < 0.15 ? 'rasante' : l < 0.45 ? 'normale' : l < LOFT.HIGH ? 'lobée' : 'haute');
// Cône d'incertitude d'une passe en vol : le cercle d'arrivée (rayon coneR, voir predict.js) se resserre jusqu'à un point
// à l'arrivée (× (1 - u)^K) ; son centre affiché est décalé (au plus SHOW × rayon) : l'arrivée réelle est dedans, pas au centre.
// Les joueurs IA lisent l'arrivée avec une erreur qui dépend de leur lecture du jeu (READ_MIN à READ_MAX × rayon).
const CONE = { MIN: 0.5, PER: 0.06, K: 1, SHOW: 0.8, READ_MIN: 0.25, READ_MAX: 1.3 };
const KIND_DELAY = 0.4;   // disque levé (au-dessus de LOFT.TELL) : on ne peut pas lancer tout de suite (s)

// Couleurs d'équipe : remplissage, contour, teinte de l'en-but
const PALETTE = {
  bleu: ['#3b82f6', '#1e3a8a'], rouge: ['#ef4444', '#7f1d1d'], jaune: ['#facc15', '#854d0e'], violet: ['#a855f7', '#581c87'],
  orange: ['#f97316', '#7c2d12'], rose: ['#ec4899', '#831843'], turquoise: ['#14b8a6', '#134e4a'], blanc: ['#f1f5f9', '#475569'], noir: ['#1f2937', '#000000']
};
const DEFAULT_TEAMS = [{ name: 'Bleus', color: 'bleu' }, { name: 'Rouges', color: 'rouge' }];

// Mini-tournoi : trois adversaires de plus en plus forts
// style : stratégies qu'ils choisissent, goût pour les hucks et les passes hautes, bluff (armer une passe haute pour feinter)
const SERIES = [
  { name: 'Écureuils', color: 'orange', level: 'facile', blurb: 'Une équipe sympa qui débute : petites passes, défense man. Idéal pour se chauffer.',
    style: { off: ['vert'], def: ['man'], force: ['haut', 'bas'], play: ['none', 'none', 'give'], dplay: ['none'], huck: 0.5, high: 0.4, bluff: 0 } },
  { name: 'Faucons', color: 'violet', level: 'normal', blurb: 'Des spécialistes du huck : ils lancent long dès qu’un cutter s’échappe. Protège le deep !',
    style: { off: ['vert', 'side'], def: ['man', 'zone'], force: ['haut', 'bas', 'middle'], play: ['huck', 'huck', 'split', 'flood'], dplay: ['none', 'safety'], huck: 1.9, high: 0.8, bluff: 0.05 } },
  { name: 'Titans', color: 'noir', level: 'difficile', blurb: 'Les champions en titre : zone étouffante, mark agressive, et des passes hautes avec du bluff.',
    style: { off: ['ho', 'vert'], def: ['zone', 'clam', 'man'], force: ['straight', 'haut', 'bas'], play: ['swing', 'split', 'huck', 'none'], dplay: ['double', 'junk', 'none'], huck: 1.1, high: 2.2, bluff: 0.35 } }
];
const DEFAULT_STYLE = { huck: 1, high: 1, bluff: 0.1 };
// consignes d'équipe, choisies avant le point (menu de stratégie) : jeu long, passes hautes, prise de risque, aide en défense
const ORDERS = {
  huck: { moins: 0.55, normal: 1, plus: 1.7 },                 // goût pour les passes longues (style.huck)
  high: { moins: 0.4, normal: 1, plus: 1.9 },                  // goût pour les passes hautes (style.high)
  risk: { prudent: [0.1, -0.08], normal: [0, 0], ose: [-0.1, 0.2] },   // [prudence en plus, goût du risque en plus]
  help: { jamais: 0, parfois: 1, toujours: 2 }                 // un défenseur ferme la ligne vers un attaquant libre
};

// Joueurs : prénoms affichés dans les statistiques
const PLAYER_NAMES = [['Léo', 'Inès', 'Hugo', 'Maya', 'Noah'], ['Sam', 'Lina', 'Tom', 'Zoé', 'Max']];
const EMOTES = ['👍', '👏', '🔥', '😅', 'Cut !', 'GG'];

