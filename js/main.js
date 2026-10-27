// main.js — Boucle principale et démarrage

// =====================================================================
//  Lancement
// =====================================================================
let last = performance.now();
// Onglet caché : le navigateur arrête requestAnimationFrame. L'hôte d'une partie en ligne continue alors à faire tourner
// le jeu (sans dessiner) au rythme d'un petit Worker, que le navigateur ne ralentit pas : les invités ne sont plus figés.
let bgWorker = null;
const bgActive = () => !!bgWorker;
function bgSync() {
  const want = G.net === 'host' && typeof document !== 'undefined' && document.hidden;
  if (want && !bgWorker) {
    try {
      const src = 'let t=setInterval(()=>postMessage(0),33);onmessage=()=>{clearInterval(t);close();};';
      bgWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      bgWorker.onmessage = () => { if (document.hidden && G.net === 'host') frame(performance.now(), false); else bgSync(); };
    } catch (e) { bgWorker = null; }
  } else if (!want && bgWorker) { try { bgWorker.postMessage(0); bgWorker.terminate(); } catch (e) { } bgWorker = null; last = performance.now(); }
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', bgSync);
function loop(now) {
  if (!(bgActive() && document.hidden)) frame(now, true);    // caché : c'est le Worker qui fait avancer le jeu
  else bgSync();
  requestAnimationFrame(loop);
}
// mesure des performances (option admin dans Commandes) : images par seconde, calcul du jeu et dessin (ms)
const PERF = { n: 0, t: 0, sim: 0, draw: 0, txt: '', at: 0 };
function frame(now, visible) {
  // jamais négatif : l'heure d'une image (requestAnimationFrame) peut être un peu antérieure au dernier tic du Worker
  // (hôte qui revient sur l'onglet) ; un pas de temps négatif rendait des positions invalides (NaN) pour tout le monde
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now);
  const t0 = CTRL.perf ? performance.now() : 0;
  G.time += dt;
  computeTeams();
  gamepadFrame();
  pendingThrowTick();
  const gdt = dt * SPEEDS[G.form.speed];
  if (G.net === 'guest') {
    guestFrame(dt); G.gt += gdt;
    const hk = canThrow() ? G.loft : -1;                     // hauteur de passe changée : l'hôte doit le savoir tout de suite
    if (hk !== G.lastHk) { G.lastHk = hk; sendInput(true); }
  }
  else {
    if ((G.paused && !G.net) || G.pz) { /* pause (solo : menu ou confirmation ouverts ; en ligne : pause pour tous) */ }
    else if (G.phase === 'play') { G.gt += gdt; update(gdt); }
    else if (G.phase === 'pull') pullTick(dt, gdt);
    else if (G.phase === 'between' || G.phase === 'over') {
      if (G.menuShown && G.phase === 'between' && !G.attract) regroupTick(gdt); else celebrateTick(gdt);
      if (G.attract) attractTick(dt);
      else if (!G.menuShown) { G.betweenT -= dt; if (G.betweenT <= 0) showMenu(G.phase); }
    }
    if (G.net === 'host') { netT += dt; if (netT >= 0.05) { netT = 0; sendSnapshot(); } }
  }
  const ctNow = canThrow();                                   // on perd le disque : on revient à la passe normale
  if (G.lastCt && !ctNow) setLoft(LOFT.N, true);
  G.lastCt = ctNow;
  if (G.tuto) tutoFrame(dt);
  if (G.practice) practiceFrame(dt);
  replayRecord(dt);
  dbgRecord(dt);
  pauseFrame();
  playBtnsFrame();
  pivotBtnFrame();
  replayTick(dt);
  joyFrame();
  netHeartbeat(dt);
  if (G.msgT > 0) G.msgT -= dt;
  tipsFrame(dt);                                             // conseils de Coach Disco (première fois)
  if (G.phase !== 'play') G.gt += dt * 0.5;            // les rafales continuent dans le menu
  updateStreaks(dt);
  fxUpdate(dt);
  $('overlay').classList.toggle('attract', !!G.attract && $('lobbyCard').style.display !== 'none');
  $('teamsB').style.display = G.net && G.started ? '' : 'none';
  $('menuB').style.visibility = G.attract || ($('lobbyCard').style.display !== 'none' && !$('overlay').classList.contains('hidden') && !G.net) ? 'hidden' : 'visible';
  if (!visible) return;
  const t1 = CTRL.perf ? performance.now() : 0;
  if (G.replay) drawReplay(); else draw();
  updateHud();
  perfFrame(now, t0, t1);
}
function perfFrame(now, t0, t1) {
  const on = !!CTRL.perf && !!(typeof accGet === 'function' && accGet() && accGet().admin), box = $('perfBox');
  if (!on) { if (box.style.display !== 'none') box.style.display = 'none'; return; }
  const t2 = performance.now();
  PERF.n++; PERF.sim += t1 - t0; PERF.draw += t2 - t1;
  if (now - PERF.at >= 500) {                                 // moyenne toutes les 0,5 s
    const k = PERF.n || 1, fps = PERF.at ? PERF.n * 1000 / (now - PERF.at) : 0;
    box.textContent = `${fps.toFixed(0)} img/s · jeu ${(PERF.sim / k).toFixed(2)} ms · dessin ${(PERF.draw / k).toFixed(2)} ms`;
    PERF.n = 0; PERF.sim = 0; PERF.draw = 0; PERF.at = now;
  }
  box.style.display = '';
}
loadSettings();
newWind();
placeForPoint();
refreshOptions();
resize();
const joinHash = (location.hash.match(/join=([A-Za-z0-9]{4})/) || [])[1];
if (joinHash) { showLobby(); $('joinB').click(); $('joinCode').value = joinHash.toUpperCase(); joinGame(joinHash); }
else showLobby();
requestAnimationFrame(loop);
