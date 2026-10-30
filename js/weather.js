// weather.js — « Mon style » : le temps qu'il fait, comme une variante de chaque terrain (on choisit le terrain, puis
// son temps, comme on ouvre un dossier). Purement visuel. Lisibilité d'abord : seul le sol est teinté (nuit, coucher
// de soleil, pluie, brume) ; les joueurs et le disque gardent leurs couleurs, et la pluie, la neige et la brume qui
// passent par-dessus restent très légères.

// ach : succès qui le débloque (sans : disponible tout de suite)
const WEATHERS = [
  { id: 'jour', name: 'Temps normal', icon: '✨' },
  { id: 'coucher', name: 'Coucher de soleil', icon: '🌇', ach: 'win' },
  { id: 'pluie', name: 'Pluie', icon: '🌧️', ach: 'block10' },
  { id: 'brume', name: 'Brume du matin', icon: '🌫️', ach: 'huck40' },
  { id: 'nuit', name: 'Nuit étoilée', icon: '🌙', ach: 'wins10' },
  { id: 'flocons', name: 'Chute de neige', icon: '🌨️', ach: 'shutout' }
];
// temps possibles pour chaque terrain (salle et espace : pas de météo)
const FIELD_WX = {
  gazon: ['jour', 'coucher', 'pluie', 'brume', 'nuit'],
  herbes: ['jour', 'coucher', 'pluie', 'brume', 'nuit'],
  prairie: ['jour', 'coucher', 'pluie', 'brume', 'nuit'],
  terre: ['jour', 'coucher', 'pluie', 'brume'],
  plage: ['jour', 'coucher', 'brume', 'nuit'],
  stade: ['jour', 'pluie', 'brume', 'flocons'],
  neige: ['jour', 'flocons', 'brume', 'coucher'],
  salle: ['jour'], espace: ['jour']
};
const wxItem = id => WEATHERS.find(w => w.id === id) || WEATHERS[0];
const fieldWx = fid => (FIELD_WX[fid] || ['jour']).map(wxItem);
// le temps en vigueur pour un terrain (un choix plus disponible revient au temps normal)
function weatherOf(fid) {
  fid = fid || styleOf('field');
  const id = ((styleGet().wx || {})[fid]) || 'jour', it = wxItem(id);
  return (FIELD_WX[fid] || ['jour']).includes(it.id) && styleUnlocked(it) ? it.id : 'jour';
}

// ---------- dessin ----------
const WX = { drops: null, flakes: null, fog: null, splash: [], t: 0 };
function wxScreen(fn) { ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); try { fn(canvas.width / dpr, canvas.height / dpr); } finally { ctx.restore(); } }
// soleil : bas sur l'horizon au coucher (ombres longues), haut le reste du temps
function wxSun(w) {
  if (w === 'coucher') { SUN.x = 1.25; SUN.y = 0.42; }
  else if (w === 'nuit' || w === 'brume' || w === 'pluie') { SUN.x = 0.3; SUN.y = 0.45; }   // lumière diffuse : ombres courtes
  else { SUN.x = 0.55; SUN.y = 0.8; }
}
// sous les joueurs : la teinte du sol (et du public) selon le temps
function drawWeatherGround(fid) {
  const w = weatherOf(fid); wxSun(w);
  if (w === 'jour' || w === 'flocons') return;
  wxScreen((cw, ch) => {
    if (w === 'nuit') {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#5d6ea6'; ctx.fillRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) * 0.6);   // les projecteurs éclairent le milieu
      g.addColorStop(0, 'rgba(255,244,214,.10)'); g.addColorStop(1, 'rgba(255,244,214,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    } else if (w === 'coucher') {
      const g = ctx.createLinearGradient(0, 0, cw, ch * 0.6);
      g.addColorStop(0, 'rgba(255,170,60,.34)'); g.addColorStop(1, 'rgba(236,72,93,.2)');
      ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(255,140,50,.10)'; ctx.fillRect(0, 0, cw, ch);
    } else if (w === 'pluie') {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#a9b6c6'; ctx.fillRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = 'source-over';
    } else if (w === 'brume') {
      ctx.fillStyle = 'rgba(214,224,232,.14)'; ctx.fillRect(0, 0, cw, ch);
    }
  });
}
// par-dessus tout (mais avant les messages) : pluie, flocons, brume qui passe — très légers
function drawWeatherSky(fid) {
  const w = weatherOf(fid);
  if (w !== 'pluie' && w !== 'flocons' && w !== 'brume') return;
  const dt = Math.min(0.05, FX.dt || 0.016), eco = typeof ecoOn === 'function' && ecoOn(); WX.t += dt;   // mode économie : moitié moins de gouttes et de flocons, pas de nappes de brume
  wxScreen((cw, ch) => {
    if (w === 'pluie') {
      if (!WX.drops) WX.drops = Array.from({ length: 150 }, () => [Math.random(), Math.random(), 0.6 + Math.random() * 0.6]);
      ctx.strokeStyle = 'rgba(210,226,255,.32)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const d of eco ? WX.drops.slice(0, 70) : WX.drops) {
        d[1] += dt * 1.6 * d[2]; d[0] += dt * 0.25 * d[2];
        if (d[1] > 1) { if (Math.random() < 0.5 && WX.splash.length < 40) WX.splash.push([d[0] * cw, (0.1 + Math.random() * 0.85) * ch, 0]); d[1] -= 1; d[0] = Math.random(); }
        if (d[0] > 1) d[0] -= 1;
        const x = d[0] * cw, y = d[1] * ch, L = 9 * d[2];
        ctx.moveTo(x, y); ctx.lineTo(x - L * 0.16, y - L);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220,234,255,.35)';                 // petites éclaboussures au sol
      WX.splash = WX.splash.filter(s => (s[2] += dt) < 0.35);
      for (const s of WX.splash) { const r = 1 + s[2] * 12; ctx.globalAlpha = 1 - s[2] / 0.35; ctx.beginPath(); ctx.ellipse(s[0], s[1], r, r * 0.45, 0, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
    } else if (w === 'flocons') {
      if (!WX.flakes) WX.flakes = Array.from({ length: 110 }, () => [Math.random(), Math.random(), 0.5 + Math.random(), Math.random() * 6]);
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      for (const f of eco ? WX.flakes.slice(0, 55) : WX.flakes) {
        f[1] += dt * 0.07 * f[2]; f[0] += dt * 0.012 * Math.sin(WX.t * 1.3 + f[3]);
        if (f[1] > 1) { f[1] -= 1; f[0] = Math.random(); }
        ctx.beginPath(); ctx.arc(((f[0] % 1) + 1) % 1 * cw, f[1] * ch, 0.8 + f[2] * 1.1, 0, 7); ctx.fill();
      }
    } else {                                                     // brume : quelques nappes qui dérivent, plus denses sur les bords
      if (!WX.fog) WX.fog = Array.from({ length: 6 }, (_, k) => [Math.random(), 0.15 + k / 6 * 0.8, 0.25 + Math.random() * 0.2, 0.01 + Math.random() * 0.015]);
      for (const f of eco ? [] : WX.fog) {
        f[0] += dt * f[3]; if (f[0] > 1.3) f[0] -= 1.6;
        const x = f[0] * cw, y = f[1] * ch, r = f[2] * Math.max(cw, ch), g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(235,240,245,.10)'); g.addColorStop(1, 'rgba(235,240,245,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const v = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
      v.addColorStop(0, 'rgba(225,232,240,0)'); v.addColorStop(1, 'rgba(225,232,240,.22)'); ctx.fillStyle = v; ctx.fillRect(0, 0, cw, ch);
    }
  });
}
