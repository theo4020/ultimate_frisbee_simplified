// ctrl.js — Réglages des commandes (gardés dans le navigateur)
//  • téléphone, réglé séparément avec et sans le disque :
//     - lancer : lance-pierre (tirer en arrière) ou glisser vers la cible ;
//     - courbe et passe haute : gestes (2e doigt, tap sur le porteur) ou boutons sur le bord droit ;
//     - sans le disque : taper / glisser, suivre le doigt, ou joystick et boutons ;
//  • clavier : touches réglables pour chaque action ;
//  • manette : schéma fixe (voir gamepad.js).

const KEY_ACTIONS = [
  ['high', 'Armer / désarmer la passe haute'], ['curveL', 'Courbe ↶'], ['curveR', 'Courbe ↷'],
  ['jump', 'Sauter'], ['dive', 'Layout'], ['switch', 'Changer de joueur']
];
const DEFAULT_KEYS = { high: ['z', 'w'], curveL: ['a', 'q', 'arrowleft'], curveR: ['e', 'd', 'arrowright'], jump: ['s'], dive: ['f', 'shift'], switch: [' '] };
const CTRL = Object.assign({ sling: true, throwUI: 'gestes', move: 'tap', keys: {} }, (() => {
  try { const o = JSON.parse(localStorage.getItem('uf-ctrl') || 'null'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
})());
if (CTRL.mobile === 'joystick') { CTRL.throwUI = 'boutons'; CTRL.move = 'joystick'; CTRL.sling = false; }   // anciens réglages
if (CTRL.follow === true && CTRL.move === 'tap') CTRL.move = 'follow';
delete CTRL.mobile; delete CTRL.follow;
if (!['gestes', 'boutons'].includes(CTRL.throwUI)) CTRL.throwUI = 'gestes';
if (!['tap', 'follow', 'joystick'].includes(CTRL.move)) CTRL.move = 'tap';
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
    joystick: 'Joystick en bas à gauche pour courir, boutons Layout / Saut / Switch en bas à droite. Taper un coéquipier le prend aussi.' };
  $('ctrlBody').innerHTML = `
    <h2>Téléphone : avec le disque</h2>
    <div class="row"><span>Lancer</span>${b('sling', true, 'Lance-pierre (tirer en arrière)')}${b('sling', false, 'Glisser vers la cible')}</div>
    <div class="row"><span>Courbe et passe haute</span>${b('throwUI', 'gestes', 'Gestes')}${b('throwUI', 'boutons', 'Boutons sur le bord')}</div>
    <div class="desc">${CTRL.throwUI === 'gestes' ? 'Courbe : un 2<sup>e</sup> doigt glisse sur le côté pendant la visée. Passe haute : taper ton porteur.'
      : 'Courbe : curseur sur le bord droit. Passe haute : bouton sous le curseur.'} Taper ailleurs appelle un cut.</div>
    <h2>Téléphone : sans le disque (défense, attaque à plusieurs)</h2>
    <div class="row"><span>Déplacement</span>${b('move', 'tap', 'Taper / glisser')}${b('move', 'follow', 'Suivre le doigt')}${b('move', 'joystick', 'Joystick et boutons')}</div>
    <div class="desc">${MOVE[CTRL.move]}</div>
    <h2>Clavier</h2>
    ${KEY_ACTIONS.map(([a, l]) => `<div class="row"><span>${l}</span><button class="kbtn${keyWait === a ? ' on' : ''}" data-a="${a}">${keyWait === a ? 'Appuie sur une touche…' : keysOf(a).map(keyName).join(' / ')}</button></div>`).join('')}
    <div class="desc">La souris vise et lance (clic maintenu), clic droit appelle un cut ; 1 à 5 prennent un joueur.</div>
    <button id="keysReset" class="ghost">Touches par défaut</button>
    <h2>Manette</h2>
    <div class="desc">Stick gauche : curseur de visée (avec le disque) ou déplacement · A / RT : lancer (sans le disque : saut) · B : layout · X : appel de cut au curseur ou changer de joueur · Y : passe haute · LB / RB : courbe · Start : valider.</div>`;
  $('ctrlBody').querySelectorAll('.copt').forEach(el => el.addEventListener('click', () => {
    const v = el.dataset.v === 'true' ? true : el.dataset.v === 'false' ? false : el.dataset.v;
    CTRL[el.dataset.g] = v; saveCtrl(); applyCtrlClass(); hudKey = ''; renderCtrl();
  }));
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
