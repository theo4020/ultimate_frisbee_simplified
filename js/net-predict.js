// net-predict.js — Jeu en ligne : prédiction de l'invité (suite de net.js)
// =====================================================================
//  Prédiction de l'invité : ton joueur répond tout de suite
// =====================================================================
// Sans prédiction, ton ordre fait l'aller-retour chez l'hôte avant que ton joueur bouge (un à deux dixièmes de seconde).
// Ici, l'invité déplace lui-même le joueur qu'il contrôle, avec les mêmes règles de course que l'hôte (steer, mark aimantée).
// L'hôte reste le seul à décider : chaque état dit quel ordre il a appliqué (ak : numéro, ms depuis sa réception). On compare
// sa position avec celle que l'invité avait prédite au même moment, et on corrige l'écart en douceur (en un coup s'il est
// grand : plongeon, nouveau point…). Les autres joueurs restent lissés comme avant.
const PRED = { on: false, p: null, q: 0, sent: new Map(), hist: [], cx: 0, cy: 0, echo: {}, err: 0 };
function predReset() { PRED.on = false; PRED.p = null; PRED.hist = []; PRED.cx = PRED.cy = 0; }
// le joueur que tu déplaces toi-même en ce moment (null : pas de prédiction)
function predWho() {
  if (G.net !== 'guest' || G.spectator || G.phase !== 'play' || G.pz || CTRL.netPredict === false) return null;
  const me = meH(), p = me && me.sel;
  if (!p || p.nx === undefined || controllerOf(p) !== me || !userControls(p)) return null;
  if ((disc.mode === 'held' || disc.mode === 'carry') && disc.holder === p) return null;
  if (p !== PRED.p && (p.dive > 0 || p.down > 0 || p.lift > 0 || p.lift < 0)) return null;   // plongeon ou saut déjà en cours chez l'hôte : on le suit
  return p;                                                      // (tes plongeons et sauts, eux, partent aussi chez toi : predAction)
}
// tu plonges ou tu sautes : ton joueur le fait tout de suite chez toi (l'hôte fait pareil à la réception, mêmes règles)
function predAction(kind, x, y) {
  const p = PRED.on && PRED.p; if (!p || p.dive > 0 || p.down > 0 || p.jump > 0 || p.jprep > 0) return;
  if (kind === 'dive') { [p.vx, p.vy] = diveVel(p, x, y); p.dive = DIVE_T; PRED.echo.layout = performance.now(); fxPlay('layout', p.x, p.y, p.team); }
  else if (kind === 'jump' && jumpTarget(meH()) === p && !(p.jumpCd > 0)) { p.jprep = JUMP_PREP; p.jumpAt = 0; PRED.echo.jump = performance.now(); fxPlay('jump', p.x, p.y, p.team); }
}
function predFrame(gdt) {
  const p = predWho();
  if (p !== PRED.p || !p) { PRED.p = p; PRED.on = !!p; PRED.hist = []; PRED.cx = PRED.cy = 0; if (!p) return null; }
  const inp = G.pointer;                                         // même cible que chez l'hôte (sim.js : update)
  [p.tx, p.ty] = braking(inp) ? brakeTarget(p) : [inp.x, inp.y];
  if (p.team !== G.off) { const mk = markAssistTarget(p, inp); if (mk) [p.tx, p.ty] = mk.pt; p.markOn = !!mk; }
  p.sp = SPD.user;
  steer(p, gdt);
  const k = Math.min(1, gdt * 10), cx = PRED.cx * k, cy = PRED.cy * k;   // correction étalée (~0,1 s)
  p.x += cx; p.y += cy; PRED.cx -= cx; PRED.cy -= cy;
  p.x = clamp(p.x, -2, W + 2); p.y = clamp(p.y, -2, H + 2);
  const now = performance.now();
  PRED.hist.push({ t: now, x: p.x + PRED.cx, y: p.y + PRED.cy, vx: p.vx, vy: p.vy });   // position « corrigée » (correction en cours comprise)
  while (PRED.hist.length > 2 && now - PRED.hist[0].t > 2500) PRED.hist.shift();
  return p;
}
// état de l'hôte pour ton joueur : a = [x, y, vx, vy, …], ak = [ordre appliqué, ms depuis sa réception]
function predFix(p, a, ak) {
  const H0 = PRED.hist;
  if (!ak || !H0.length) return;
  const ts = PRED.sent.get(ak[0]); if (ts == null) return;
  const t = ts + ak[1];                                          // moment où ta prédiction en était au même point que l'hôte
  if (t < H0[0].t || t > H0[H0.length - 1].t + 40) return;
  let i = 1; while (i < H0.length && H0[i].t < t) i++;
  const A = H0[i - 1], B = H0[Math.min(i, H0.length - 1)], u = B.t > A.t ? clamp((t - A.t) / (B.t - A.t), 0, 1) : 0;
  const hx = A.x + (B.x - A.x) * u, hy = A.y + (B.y - A.y) * u;
  const ex = a[0] - hx, ey = a[1] - hy, e = Math.hypot(ex, ey);
  PRED.err = PRED.err * 0.9 + e * 0.1;                            // écart moyen (tests, mesures)
  if (e > 4) { p.x = a[0]; p.y = a[1]; p.vx = a[2]; p.vy = a[3]; PRED.hist = []; PRED.cx = PRED.cy = 0; return; }   // trop loin : on se recale
  if (e < 0.06) return;                                          // arrondis de l'envoi (0,1 m)
  PRED.cx += ex; PRED.cy += ey;
  // (la vitesse n'est pas corrigée : les deux suivent la même cible avec les mêmes règles, elle se rejoint d'elle-même ;
  // la corriger à chaque état, sans pouvoir la décaler dans l'historique, l'emballait)
  for (const h of H0) if (h.t >= t) { h.x += ex; h.y += ey; }     // les prédictions suivantes en tenaient compte : on les décale aussi
}
