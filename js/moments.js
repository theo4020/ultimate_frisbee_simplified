// moments.js — Les petits moments de l'ultimate, en vue de dessus
//  • après un point : les coéquipiers rejoignent le marqueur et se tapent dans la main ;
//  • après un drop, une passe dehors ou un stall : le fautif met les mains sur la tête, un instant ;
//  • à la fin du match : les deux équipes forment une ronde immobile au centre du terrain (le cercle de l'esprit du jeu),
//    bras sur les épaules. Les boutons principaux (rejouer / match suivant…, menu principal) restent autour de la ronde,
//    le résumé du match s'ouvre sur demande.

// le fautif d'une perte de balle (fx.js : événements 'turn' et 'stall') : mains sur la tête pendant 1,6 s
function sadAt(x, y, team) {
  if (team !== 0 && team !== 1) return;
  const p = nearest(TEAMS[team], x, y); if (p && dist(p.x, p.y, x, y) < 4) p.sadT = 1.6;
}

// ---------- la ronde de fin de match ----------
const RING_R = 4.2;
const ringOn = () => G.phase === 'over' && !!G.ringOn && G.menuShown && !G.tuto && !G.practice && !G.attract;
// place de chacun : équipes alternées autour du centre, tournés vers l'intérieur
function ringSpot(p) {
  const k = p.i * 2 + p.team, a = k / (2 * N) * Math.PI * 2 - Math.PI / 2;
  return [W / 2 + Math.cos(a) * RING_R, H / 2 + Math.sin(a) * RING_R, a + Math.PI];
}
// hôte / solo : ils marchent vers leur place (l'invité reçoit les positions)
function ringTick(dt) {
  if (disc.mode !== 'dead') disc.mode = 'dead';
  for (const p of players) {
    const [x, y] = ringSpot(p);
    p.tx = x; p.ty = y; p.sp = 5; p.dive = 0; p.down = 0; p.avoid = false;
    steer(p, dt);
  }
}
// en place dans la ronde : il regarde le centre (render.js : faceOf)
function ringFace(p) {
  if (!ringOn()) return null;
  const [x, y, a] = ringSpot(p);
  return dist(p.x, p.y, x, y) < 1.2 ? a : null;
}
// boutons autour de la ronde (positions à l'écran recalculées à chaque image)
function ringUIFrame() {
  const box = $('ringUI'); if (!box) return;
  const show = ringOn() && $('overlay').classList.contains('hidden');
  if (box.style.display !== (show ? '' : 'none')) box.style.display = show ? '' : 'none';
  if (!show) return;
  const r = canvas.getBoundingClientRect(), sx = r.width / (canvas.width / dpr), sy = r.height / (canvas.height / dpr);
  const at = (id, x, y) => { const b = $(id); b.style.left = (X(x) * sx) + 'px'; b.style.top = (Y(y) * sy) + 'px'; };
  at('ringMenu', W / 2 - RING_R - 10, H / 2); at('ringGo', W / 2 + RING_R + 10, H / 2); at('ringOpen', W / 2, H / 2 + RING_R + 4.5);
  const gl = $('go').textContent; if ($('ringGo').textContent !== gl) $('ringGo').textContent = gl;
  $('ringGo').disabled = $('go').disabled || $('go').style.display === 'none';
  $('ringTitle').textContent = $('ovTitle').textContent; at('ringTitle', W / 2, H / 2 - RING_R - 4);
}
if (typeof document !== 'undefined' && document.getElementById('ringUI')) {
  const el = id => document.getElementById(id);                  // (chargé avant ui.js : pas encore de $)
  el('ringGo').addEventListener('click', () => el('go').click());
  el('ringMenu').addEventListener('click', () => el('menuBack').click());
  el('ringOpen').addEventListener('click', () => { el('overlay').classList.remove('hidden'); });
  el('ovRing').addEventListener('click', () => { el('overlay').classList.add('hidden'); });
}
