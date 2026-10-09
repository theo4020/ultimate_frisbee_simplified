// main.js — Boucle principale et démarrage

// =====================================================================
//  Lancement
// =====================================================================
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  G.time += dt;
  computeTeams();
  gamepadFrame();
  const gdt = dt * SPEEDS[G.form.speed];
  if (G.net === 'guest') { guestFrame(dt); G.gt += gdt; }
  else {
    if (G.phase === 'play') { G.gt += gdt; update(gdt); }
    else if (G.phase === 'pull') pullTick(dt);
    else if (G.phase === 'between' || G.phase === 'over') {
      celebrateTick(gdt);
      if (!G.menuShown) { G.betweenT -= dt; if (G.betweenT <= 0) showMenu(G.phase); }
    }
    if (G.net === 'host') { netT += dt; if (netT >= 0.05) { netT = 0; netSend(snapshot()); } }
  }
  if (G.tuto) tutoFrame(dt);
  replayRecord(dt);
  replayTick(dt);
  joyFrame();
  netHeartbeat(dt);
  if (G.msgT > 0) G.msgT -= dt;
  if (G.phase !== 'play') G.gt += dt * 0.5;            // les rafales continuent dans le menu
  updateStreaks(dt);
  fxUpdate(dt);
  if (G.replay) drawReplay(); else draw();
  updateHud();
  requestAnimationFrame(loop);
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
