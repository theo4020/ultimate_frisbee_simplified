// style.js — « Mon style » : disque, terrain, tenue de ton équipe et célébration, débloqués par les succès.
// Purement visuel (aucun effet sur le jeu). Chacun voit ses propres choix ; gardé dans le navigateur (uf-style) et avec
// le compte. Règle de lisibilité : le disque et les deux équipes restent toujours bien visibles (ex. sur la neige, un
// disque blanc devient orange).

// ach : succès qui le débloque (sans : disponible tout de suite)
const STYLES = {
  disc: [
    { id: 'blanc', name: 'Classique', icon: '⚪' },
    { id: 'orange', name: 'Fluo', icon: '🟠' },
    { id: 'arcenciel', name: 'Arc-en-ciel', ach: 'high' },
    { id: 'galaxie', name: 'Galaxie', ach: 'huck40' },
    { id: 'flamme', name: 'Flamme', ach: 'duel' },
    { id: 'neon', name: 'Néon', ach: 'start' },
    { id: 'or', name: 'Or', ach: 'champion' }
  ],
  field: [
    { id: 'gazon', name: 'Gazon' },
    { id: 'stade', name: 'Stade de nuit', ach: 'win' },
    { id: 'plage', name: 'Plage', ach: 'pull' },
    { id: 'salle', name: 'Salle', ach: 'layout' },
    { id: 'neige', name: 'Neige', ach: 'endless5' }
  ],
  acc: [
    { id: 'aucun', name: 'Rien', icon: '🙂' },
    { id: 'bandeau', name: 'Bandeau', icon: '🎽' },
    { id: 'casquette', name: 'Casquette', icon: '🧢', ach: 'goal' },
    { id: 'lunettes', name: 'Lunettes de soleil', icon: '🕶️', ach: 'shutout' },
    { id: 'couronne', name: 'Couronne', icon: '👑', ach: 'callahan' }
  ],
  cele: [
    { id: 'confettis', name: 'Confettis', icon: '🎉' },
    { id: 'feu', name: 'Feu d’artifice', icon: '🎆', ach: 'skyblock' },
    { id: 'etoiles', name: 'Pluie d’étoiles', icon: '⭐', ach: 'practice10' }
  ]
};
const STYLE_CAT = { disc: 'Disque', field: 'Terrain', acc: 'Tenue de ton équipe', cele: 'Célébration après un point' };
// couleurs des terrains : fond, bandes, lignes, ciel (vue inclinée), opacité des en-buts
const FIELDS = {
  gazon: { bg: '#1a6b35', s: ['#1f7a3d', '#22843f'], line: 'rgba(255,255,255,.85)', sky: ['#0b1220', '#14301f'], ez: 0.22, txt: 'rgba(255,255,255,.35)', vg: 0.22 },
  stade: { bg: '#0b2a17', s: ['#14532d', '#166534'], line: 'rgba(255,255,255,.95)', sky: ['#020617', '#0b1a12'], ez: 0.25, txt: 'rgba(255,255,255,.4)', vg: 0.5, lights: true },
  plage: { bg: '#0ea5e9', s: ['#d6b77c', '#cfae70'], line: 'rgba(30,58,138,.75)', sky: ['#7dd3fc', '#bae6fd'], ez: 0.28, txt: 'rgba(30,41,59,.45)', vg: 0.12 },
  salle: { bg: '#334155', s: ['#b9783f', '#c4844a'], line: 'rgba(255,255,255,.9)', sky: ['#1e293b', '#334155'], ez: 0.3, txt: 'rgba(255,255,255,.45)', vg: 0.18, planks: true },
  neige: { bg: '#cbd5e1', s: ['#e2e8f0', '#f1f5f9'], line: 'rgba(30,58,138,.8)', sky: ['#94a3b8', '#cbd5e1'], ez: 0.3, txt: 'rgba(30,41,59,.45)', vg: 0.1 }
};

const STYLE0 = { disc: 'blanc', field: 'gazon', acc: 'aucun', cele: 'confettis' };
function styleGet() { const s = storeGet('uf-style', null); return Object.assign({}, STYLE0, s && typeof s === 'object' ? s : {}); }
function styleSet(s) { storeSet('uf-style', s); }
const styleItem = (cat, id) => STYLES[cat].find(x => x.id === id) || STYLES[cat][0];
const styleUnlocked = it => !it.ach || !!achGet()[it.ach];
// le choix en vigueur (un choix plus disponible, ex. profil effacé, revient au style de base)
function styleOf(cat) { const it = styleItem(cat, styleGet()[cat]); return styleUnlocked(it) ? it.id : STYLES[cat][0].id; }
const fieldTheme = () => FIELDS[styleOf('field')] || FIELDS.gazon;
// disque : sur la neige, le blanc devient orange (sinon on ne le voit plus)
const discSkin = () => { const d = styleOf('disc'); return d === 'blanc' && styleOf('field') === 'neige' ? 'orange' : d; };

// ---------- dessin du disque (le chemin du disque est déjà tracé : on le remplit) ----------
// c : contexte de dessin, (x, y, R) : centre et rayon à l'écran
function paintDisc(c, x, y, R, skin) {
  c.save();
  switch (skin || discSkin()) {
    case 'orange': c.fillStyle = '#fb923c'; c.fill(); break;
    case 'arcenciel': {
      const g = c.createLinearGradient(x - R, y - R, x + R, y + R);
      ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'].forEach((col, i) => g.addColorStop(i / 5, col));
      c.fillStyle = g; c.fill(); break;
    }
    case 'galaxie': {
      const g = c.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R * 1.2);
      g.addColorStop(0, '#a78bfa'); g.addColorStop(0.5, '#4c1d95'); g.addColorStop(1, '#0f172a');
      c.fillStyle = g; c.fill(); c.clip();
      c.fillStyle = '#fff';
      for (const [a, b, s] of [[-0.4, -0.2, 0.09], [0.35, 0.1, 0.07], [0.05, 0.45, 0.06], [-0.15, 0.2, 0.05], [0.45, -0.35, 0.05]]) { c.beginPath(); c.arc(x + a * R, y + b * R, Math.max(0.8, s * R), 0, Math.PI * 2); c.fill(); }
      break;
    }
    case 'flamme': {
      const g = c.createRadialGradient(x, y, R * 0.1, x, y, R * 1.1);
      g.addColorStop(0, '#fef08a'); g.addColorStop(0.45, '#f97316'); g.addColorStop(1, '#b91c1c');
      c.fillStyle = g; c.fill(); break;
    }
    case 'neon': c.shadowColor = '#22d3ee'; c.shadowBlur = Math.max(6, R * 1.4); c.fillStyle = '#a5f3fc'; c.fill(); c.shadowBlur = 0; c.fill(); break;
    case 'or': {
      const g = c.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R * 1.1);
      g.addColorStop(0, '#fef9c3'); g.addColorStop(0.5, '#facc15'); g.addColorStop(1, '#a16207');
      c.fillStyle = g; c.fill(); break;
    }
    default: c.fillStyle = '#fff'; c.fill();
  }
  c.restore();
}
// couleur de la traînée du disque en vol
function trailColor(a) {
  switch (discSkin()) {
    case 'orange': return `rgba(251,146,60,${a})`;
    case 'arcenciel': return `hsla(${Math.round(G.time * 240) % 360},90%,60%,${a})`;
    case 'galaxie': return `rgba(167,139,250,${a})`;
    case 'flamme': return `rgba(249,115,22,${a})`;
    case 'neon': return `rgba(34,211,238,${a})`;
    case 'or': return `rgba(250,204,21,${a})`;
    default: return `rgba(255,255,255,${a})`;
  }
}

// ---------- tenue : un accessoire sur les joueurs de ton équipe ----------
const accOn = p => !G.attract && !G.spectator && p.team === G.me && !!meH() && styleOf('acc') !== 'aucun';
// vu de dessus : (hx, hy) centre de la tête, hr son rayon, dans le repère du joueur tourné vers +x (il regarde vers la droite)
function accTop(c, hx, hy, hr) {
  const a = styleOf('acc');
  c.save();
  if (a === 'bandeau') { c.strokeStyle = '#ef4444'; c.lineWidth = Math.max(1.5, hr * 0.32); c.beginPath(); c.arc(hx, hy, hr * 0.92, 0, Math.PI * 2); c.stroke(); }
  else if (a === 'casquette') {
    c.fillStyle = '#1e293b'; c.beginPath(); c.arc(hx, hy, hr * 0.95, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ef4444'; c.beginPath(); c.ellipse(hx + hr * 0.95, hy, hr * 0.55, hr * 0.8, 0, -Math.PI / 2, Math.PI / 2); c.fill();   // visière vers l'avant
  } else if (a === 'lunettes') { c.fillStyle = '#0f172a'; c.fillRect(hx + hr * 0.55, hy - hr * 0.7, hr * 0.3, hr * 1.4); }
  else if (a === 'couronne') {
    c.fillStyle = '#facc15'; c.strokeStyle = '#a16207'; c.lineWidth = 1;
    c.beginPath();
    for (let k = 0; k < 10; k++) { const ang = k / 10 * Math.PI * 2, rr = k % 2 ? hr * 0.55 : hr * 1.05; c.lineTo(hx + Math.cos(ang) * rr, hy + Math.sin(ang) * rr); }
    c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}
// vue inclinée : (sx, hy) centre de la tête, hr son rayon, back : vu de dos, fx : sens du regard (-1 à 1)
function accChibi(c, sx, hy, hr, back, fx) {
  const a = styleOf('acc');
  c.save();
  if (a === 'bandeau') { c.fillStyle = '#ef4444'; c.fillRect(sx - hr * 1.0, hy - hr * 0.45, hr * 2.0, hr * 0.3); }
  else if (a === 'casquette') {
    c.fillStyle = '#1e293b'; c.beginPath(); c.arc(sx, hy - hr * 0.1, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); c.fill();
    if (!back) { c.fillStyle = '#ef4444'; c.beginPath(); c.ellipse(sx + fx * hr * 0.6, hy - hr * 0.2, hr * 0.75, hr * 0.18, 0, 0, Math.PI * 2); c.fill(); }
  } else if (a === 'lunettes' && !back) {
    const ex = sx + fx * hr * 0.32, ey = hy + hr * 0.1;
    c.fillStyle = '#0f172a'; c.fillRect(ex - hr * 0.55, ey - hr * 0.15, hr * 0.45, hr * 0.28); c.fillRect(ex + hr * 0.1, ey - hr * 0.15, hr * 0.45, hr * 0.28);
    c.fillRect(ex - hr * 0.12, ey - hr * 0.08, hr * 0.24, hr * 0.08);
  } else if (a === 'couronne') {
    c.fillStyle = '#facc15'; c.strokeStyle = '#a16207'; c.lineWidth = 1;
    const y0 = hy - hr * 0.85, w = hr * 0.8;
    c.beginPath(); c.moveTo(sx - w, y0); c.lineTo(sx - w, y0 - hr * 0.45); c.lineTo(sx - w * 0.5, y0 - hr * 0.2); c.lineTo(sx, y0 - hr * 0.6);
    c.lineTo(sx + w * 0.5, y0 - hr * 0.2); c.lineTo(sx + w, y0 - hr * 0.45); c.lineTo(sx + w, y0); c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}

// ---------- célébration (quand ton équipe marque) ----------
// renvoie true si elle a remplacé les confettis
function celebrate(team, ex) {
  if (G.attract || G.spectator || team !== G.me || !meH()) return false;
  const k = styleOf('cele'), c = teamColor(team);
  if (k === 'feu') {
    for (let b = 0; b < 5; b++) {
      const x = ex + (Math.random() - 0.5) * EZ * 0.8, y = 4 + Math.random() * (H - 8), col = [c, '#facc15', '#f472b6', '#38bdf8', '#fff'][b];
      for (let i = 0; i < 22; i++) {
        const a = i / 22 * Math.PI * 2, sp = 6 + Math.random() * 4;
        FX.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: -b * 0.18, life: 0.9 + b * 0.18, color: col, size: 0.32, drag: 2.2, grav: 2 });
      }
    }
    return true;
  }
  if (k === 'etoiles') {
    for (let i = 0; i < 45; i++) {
      FX.parts.push({ x: ex + (Math.random() - 0.5) * EZ, y: Math.random() * H, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 3, t: 0, life: 1.4 + Math.random() * 0.8,
        color: ['#facc15', '#fff', '#fde68a'][i % 3], size: 0.9, kind: 'star', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, drag: 0.4, grav: 0 });
    }
    return true;
  }
  return false;
}
function drawStar(c, x, y, r) {
  c.beginPath();
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
}

// ---------- carte « Mon style » ----------
function showStyle() {
  G.menuShown = true;
  for (const id of ['lobbyCard', 'stratCard', 'seriesCard', 'profileCard']) $(id).style.display = 'none';
  $('styleCard').style.display = ''; $('overlay').classList.remove('hidden');
  renderStyle();
}
function renderStyle() {
  const S0 = styleGet(), a = achGet();
  $('styleBody').innerHTML = Object.keys(STYLES).map(cat => `<h2>${STYLE_CAT[cat]}</h2><div class="sgrid">` + STYLES[cat].map(it => {
    const ok = styleUnlocked(it), on = styleOf(cat) === it.id, A = it.ach && ACH.find(x => x.id === it.ach);
    const prev = cat === 'disc' ? `<canvas class="sprev" width="44" height="44" data-skin="${it.id}"></canvas>`
      : cat === 'field' ? `<span class="sfield" style="background:repeating-linear-gradient(90deg,${FIELDS[it.id].s[0]} 0 8px,${FIELDS[it.id].s[1]} 8px 16px)"></span>`
      : `<span class="sicon">${it.icon}</span>`;
    return `<button class="stile${on ? ' on' : ''}${ok ? '' : ' locked'}" data-cat="${cat}" data-id="${it.id}">${prev}<b>${esc(it.name)}</b>`
      + (ok ? (on ? '<small>✓ choisi</small>' : '') : `<small>🔒 ${A ? esc(A.icon + ' ' + A.name) : ''}<br>${A ? esc(A.desc) : ''}</small>`) + '</button>';
  }).join('') + '</div>').join('');
  for (const cv of document.querySelectorAll('#styleBody canvas.sprev')) {
    const c = cv.getContext('2d'); c.beginPath(); c.ellipse(22, 22, 16, 13, -0.2, 0, Math.PI * 2);
    paintDisc(c, 22, 22, 16, cv.dataset.skin); c.strokeStyle = '#0f172a'; c.lineWidth = 2; c.stroke();
  }
  const n = Object.values(STYLES).flat().filter(styleUnlocked).length, tot = Object.values(STYLES).flat().length;
  $('styleCount').textContent = `${n} / ${tot} débloqués · les succès du Profil en débloquent d’autres`;
}
if (typeof document !== 'undefined' && document.getElementById('styleCard')) {
  $('styleB').addEventListener('click', showStyle);
  $('styleBack').addEventListener('click', () => { $('styleCard').style.display = 'none'; showLobby(); });
  $('styleBody').addEventListener('click', e => {
    const b = e.target.closest('.stile'); if (!b) return;
    const it = styleItem(b.dataset.cat, b.dataset.id);
    if (!styleUnlocked(it)) { const A = ACH.find(x => x.id === it.ach); if (A) toast(`🔒 Pour débloquer : <b>${A.name}</b> — ${A.desc}`); return; }
    const s = styleGet(); s[b.dataset.cat] = it.id; styleSet(s); renderStyle();
  });
}
