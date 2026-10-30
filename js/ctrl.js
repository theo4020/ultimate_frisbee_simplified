// ctrl.js — Réglages des commandes (gardés dans le navigateur)
//  • téléphone, réglé séparément avec et sans le disque :
//     - lancer : lance-pierre (tirer en arrière) ou glisser vers la cible ;
//     - courbe et hauteur : gestes (2e doigt : sur le côté = courbe, le long de la passe = hauteur) ou curseurs sur le bord droit ;
//     - sans le disque : taper / glisser, suivre le doigt, ou joystick et boutons ;
//  • clavier : touches réglables pour chaque action ;
//  • manette : schéma fixe (voir gamepad.js).

const KEY_ACTIONS = [
  ['pivot', 'Changer de pied de pivot'], ['loftUp', 'Passe plus haute'], ['loftDown', 'Passe plus basse'], ['curveL', 'Courbe ↶'], ['curveR', 'Courbe ↷'],
  ['jump', 'Sauter'], ['dive', 'Layout'], ['switch', 'Changer de joueur'], ['play1', 'Appeler le play 1'], ['play2', 'Appeler le play 2']
];
const DEFAULT_KEYS = { pivot: [' ', 'x'], loftUp: ['z', 'w', 'arrowup'], loftDown: ['s', 'arrowdown'], curveL: ['a', 'q', 'arrowleft'], curveR: ['e', 'd', 'arrowright'], jump: ['s'], dive: ['f', 'shift'], switch: [' '], play1: ['r'], play2: ['t'] };
const CTRL = Object.assign({ sling: false, throwUI: 'gestes', move: 'joystick', keys: {}, v: 3 }, (() => {
  try { const o = JSON.parse(localStorage.getItem('uf-ctrl') || 'null'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
})());
// nouvelles commandes par défaut pour tout le monde (réglages téléphone d'avant remis à zéro une fois ; les touches sont gardées)
if (!(CTRL.v >= 2)) { Object.assign(CTRL, { sling: false, throwUI: 'gestes', move: 'joystick', v: 3 }); delete CTRL.mobile; delete CTRL.follow; saveCtrl(); }
if (!CTRL.keys || typeof CTRL.keys !== 'object') CTRL.keys = {};
if (CTRL.keys.high) { CTRL.keys.pivot = CTRL.keys.high.filter(k => k !== 'z' && k !== 'w'); delete CTRL.keys.high; saveCtrl(); }   // ancienne touche « pivot / passe haute »
// v3 : sur téléphone, joystick + boutons et lancer vers la cible par défaut (sauf si on avait déjà changé ces réglages)
if (CTRL.v < 3) { if (CTRL.move === 'tap' && CTRL.sling === true) Object.assign(CTRL, { move: 'joystick', sling: false }); CTRL.v = 3; saveCtrl(); }
if (!['gestes', 'boutons'].includes(CTRL.throwUI)) CTRL.throwUI = 'gestes';
if (!['tap', 'follow', 'joystick'].includes(CTRL.move)) CTRL.move = 'tap';
if (!['top', 'iso'].includes(CTRL.view)) CTRL.view = 'top';
if (!['fixe', 'suivi'].includes(CTRL.cam)) CTRL.cam = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'suivi' : 'fixe';   // caméra (scenery.js) : suit le jeu sur téléphone, fixe sur ordinateur
CTRL.perf = !!CTRL.perf;
if (!['auto', 'on', 'off'].includes(CTRL.eco)) CTRL.eco = 'auto';                    // mode économie (main.js) : automatique si l'image saccade
if (CTRL.markAssist === undefined) CTRL.markAssist = true;
if (!CTRL.music) CTRL.music = 'menus';                                 // musique (audio.js) : dans les menus par défaut
// volumes (0 à 100) : effets du jeu, musique, public (l'ancien réglage « Public : non » devient un volume à 0)
if (!CTRL.vol || typeof CTRL.vol !== 'object') CTRL.vol = { fx: 100, music: 100, crowd: CTRL.crowd === false ? 0 : 100 };
for (const k of ['fx', 'music', 'crowd']) CTRL.vol[k] = Math.max(0, Math.min(100, Number.isFinite(+CTRL.vol[k]) ? +CTRL.vol[k] : 100));
delete CTRL.crowd;
const volOf = k => (CTRL.vol[k] == null ? 100 : CTRL.vol[k]) / 100;                        // ambiance du public en match          // mark aimantée (sim.js : markAssist), activée par défaut                                        // affichage des performances (admin)
function saveCtrl() { try { localStorage.setItem('uf-ctrl', JSON.stringify(CTRL)); } catch (e) { } }
const keysOf = a => (Array.isArray(CTRL.keys[a]) && CTRL.keys[a].length ? CTRL.keys[a] : DEFAULT_KEYS[a]);
const keyIs = (a, k) => keysOf(a).includes(k);
const keyName = k => ({ ' ': 'Espace', shift: 'Maj', arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', enter: 'Entrée' })[k] || k.toUpperCase();
// téléphone : le tactile passe par gestures.js ; les boutons affichés dépendent des réglages
const gestures = () => typeof document !== 'undefined' && document.body.classList.contains('touch');
function applyCtrlClass() {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('thrbtn', CTRL.throwUI === 'boutons');   // curseur de courbe + bouton passe haute
  document.body.classList.toggle('mvjoy', CTRL.move === 'joystick');      // joystick + boutons Layout / Saut / Switch
}
applyCtrlClass();

// ---------- panneau « Commandes » ----------
let keyWait = null;                                            // action en attente d'une touche
function renderCtrl() {
  const b = (g, v, label) => `<button class="copt${CTRL[g] === v ? ' on' : ''}" data-g="${g}" data-v="${v}">${label}</button>`;
  const MOVE = { tap: 'Taper un endroit pour y aller, ton joueur pour sauter, un coéquipier pour le prendre ; glisser vite n’importe où pour plonger.',
    follow: 'Garde le doigt posé : ton joueur le suit. Taper ton joueur le fait sauter, un coéquipier pour le prendre ; glisser vite pour plonger.',
    joystick: 'Pose le doigt n’importe où et glisse pour courir dans cette direction (comme un joystick), boutons Layout / Saut / Switch en bas à droite. Taper un coéquipier le prend aussi.' };
  $('ctrlBody').innerHTML = `
    <h2>Affichage</h2>
    <div class="row"><span>Vue</span>${b('view', 'top', 'De dessus')}${b('view', 'iso', 'Inclinée (tribune)')}</div>
    <div class="row"><span>Caméra</span>${b('cam', 'fixe', 'Fixe (tout le terrain)')}${b('cam', 'suivi', 'Suit le jeu')}</div>
    <div class="desc">${CTRL.cam === 'suivi' ? 'Vue de dessus : la caméra zoome un peu et suit le disque (joueurs plus gros, surtout sur téléphone).' : 'Tout le terrain est toujours visible.'}</div>
    <div class="row"><span>Mode économie</span>${b('eco', 'auto', 'Automatique')}${b('eco', 'on', 'Toujours')}${b('eco', 'off', 'Jamais')}</div>
    <div class="desc">${ecoOn() ? 'En ce moment : <b>activé</b>. ' : ''}Image un peu moins fine, sans l’herbe qui ondule ni les drapeaux, et une météo plus légère : le jeu reste fluide sur les petits téléphones. En automatique, il s’allume tout seul si l’image saccade pendant un match.</div>
    <div class="desc">${CTRL.view === 'iso' ? 'Le terrain vu depuis la tribune : on voit les joueurs debout, et le disque monter et descendre (son ombre montre où il passe au sol).' : 'Le terrain vu d’en haut, comme un tableau tactique.'}</div>
    <h2>Téléphone : avec le disque</h2>
    <div class="row"><span>Lancer</span>${b('sling', true, 'Lance-pierre (tirer en arrière)')}${b('sling', false, 'Glisser vers la cible')}</div>
    <div class="row"><span>Courbe et hauteur</span>${b('throwUI', 'gestes', 'Gestes')}${b('throwUI', 'boutons', 'Curseurs sur le bord')}</div>
    <div class="desc">${CTRL.throwUI === 'gestes' ? 'Pendant la visée, un 2<sup>e</sup> doigt glisse : sur le côté = courbe ; vers ton joueur = passe plus haute, vers la cible = plus basse. Taper ton joueur : changer de pied.'
      : 'Courbe et hauteur : curseurs sur le bord droit. Pied de pivot : bouton sous les curseurs.'} Taper ailleurs appelle un cut ; taper un coéquipier le désigne : c’est lui qui partira au prochain appel.</div>
    <h2>Téléphone : sans le disque (défense, attaque à plusieurs)</h2>
    <div class="row"><span>Déplacement</span>${b('move', 'tap', 'Taper / glisser')}${b('move', 'follow', 'Suivre le doigt')}${b('move', 'joystick', 'Joystick et boutons')}</div>
    <div class="desc">${MOVE[CTRL.move]}</div>
    <h2>Son</h2>
    <div class="row"><span>Musique</span>${b('music', 'off', 'Coupée')}${b('music', 'menus', 'Menus')}${b('music', 'tout', 'Menus et matchs')}</div>
    ${[['fx', '🔉 Effets'], ['music', '🔉 Musique'], ['crowd', '🔉 Public']].map(([k, l]) => `<div class="row"><span>${l}</span><input type="range" class="vol" data-k="${k}" min="0" max="100" step="5" value="${CTRL.vol[k]}" aria-label="${l}"><b class="volv" id="volv-${k}">${CTRL.vol[k] ? CTRL.vol[k] + ' %' : 'Coupé'}</b></div>`).join('')}
    <div class="desc">Effets : lancers, réceptions, sifflet… Une petite musique dans les menus (et en fond pendant les matchs si tu veux). Le public applaudit les points et les beaux gestes, réagit aux blocks et aux drops (à 0 : plus de public). Le bouton 🔊 en haut coupe tout.</div>
    <h2>Défense</h2>
    <div class="row"><span>Mark aimantée</span>${b('markAssist', true, 'Oui')}${b('markAssist', false, 'Non')}</div>
    <div class="desc">${CTRL.markAssist ? 'Dans le cercle du thrower, ton joueur se cale tout seul face à lui : déplace-toi à gauche ou à droite pour fermer un côté. Vise plus loin (ou change de joueur) pour quitter la mark, comme en match.' : 'Ton joueur suit toujours ta souris ou ton doigt, même en mark.'}</div>
    <h2>Clavier</h2>
    ${KEY_ACTIONS.map(([a, l]) => `<div class="row"><span>${l}</span><button class="kbtn${keyWait === a ? ' on' : ''}" data-a="${a}">${keyWait === a ? 'Appuie sur une touche…' : keysOf(a).map(keyName).join(' / ')}</button></div>`).join('')}
    <div class="desc">La souris vise et lance (clic maintenu). Clic sur un coéquipier : tu le prends. Molette : hauteur de la passe (pendant le pull : courbe). Clic droit : avec le disque, appel d’un cut (sur un coéquipier : il est désigné, c’est lui qui partira au prochain appel) ; sinon saut (en défense, ou pour ton receveur pendant le vol) ; 1 à 5 prennent aussi un joueur.</div>
    <button id="keysReset" class="ghost">Touches par défaut</button>
    ${typeof accGet === 'function' && accGet() && accGet().admin ? `<h2>Admin</h2>
    <div class="row"><span>Performances</span>${b('perf', false, 'Masquées')}${b('perf', true, 'Afficher')}</div>
    <div class="desc">Images par seconde, temps de calcul du jeu et du dessin (ms par image), en haut à gauche du terrain.</div>` : ''}
    <h2>Manette</h2>
    <div class="desc">Stick gauche : curseur de visée (avec le disque) ou déplacement · A / RT : lancer (sans le disque : saut) · B : layout · X : appel de cut au curseur ou changer de joueur · Y : pied de pivot · croix ↑ / ↓ : hauteur de la passe · LB / RB : courbe · croix ← / → : Play 1 / Play 2 · Start : valider.</div>`;
  $('ctrlBody').querySelectorAll('.copt').forEach(el => el.addEventListener('click', () => {
    const v = el.dataset.v === 'true' ? true : el.dataset.v === 'false' ? false : el.dataset.v;
    CTRL[el.dataset.g] = v; saveCtrl(); applyCtrlClass(); hudKey = ''; renderCtrl();
    if (el.dataset.g === 'eco') { ecoReset(); resize(); }
    if (el.dataset.g === 'view') resize();
  }));
  $('ctrlBody').querySelectorAll('.vol').forEach(el => {
    el.addEventListener('input', () => { const k = el.dataset.k; CTRL.vol[k] = +el.value; $('volv-' + k).textContent = CTRL.vol[k] ? CTRL.vol[k] + ' %' : 'Coupé'; saveCtrl(); });
    el.addEventListener('change', () => { if (typeof volPreview === 'function') volPreview(el.dataset.k); });   // on entend le nouveau volume
  });
  $('ctrlBody').querySelectorAll('.kbtn').forEach(el => el.addEventListener('click', () => { keyWait = keyWait === el.dataset.a ? null : el.dataset.a; renderCtrl(); }));
  $('keysReset').addEventListener('click', () => { CTRL.keys = {}; keyWait = null; saveCtrl(); renderCtrl(); });
}
// une touche choisie pour une action la retire des autres actions
function captureKey(k) {
  if (!keyWait || k === 'escape') { keyWait = null; renderCtrl(); return true; }
  for (const [a] of KEY_ACTIONS) if (a !== keyWait && keysOf(a).includes(k)) CTRL.keys[a] = keysOf(a).filter(x => x !== k);
  CTRL.keys[keyWait] = [k]; keyWait = null; saveCtrl(); hudKey = ''; renderCtrl();
  return true;
}
