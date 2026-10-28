// net-link.js — Jeu en ligne : garder la liaison (suite de net.js)
//  • connexion perdue : l'invité retrouve l'hôte et reprend sa place ; si l'hôte est vraiment parti, l'héritier reprend la
//    partie et les autres se reconnectent à lui ;
//  • battement de cœur, temps d'aller-retour (ping / pong), départ annoncé (« bye ») ;
//  • journal de connexion et diagnostic joints aux rapports de bug (menu.js : buildReport).

// journal de connexion (rapports de bug) : événements récents, reconnexions, trous dans la réception, type de liaison
const NETLOG = { ev: [], reconn: 0, reconnOk: 0, reconnMs: [], gaps: [], bursts: 0, ice: '', iceAt: -99 };
function netLog(txt) { NETLOG.ev.push([Math.round(performance.now() / 100) / 10, String(txt).slice(0, 120)]); if (NETLOG.ev.length > 15) NETLOG.ev.shift(); }

// ---------- connexion perdue, changement d'hôte ----------
// plus de nouvelles de l'hôte : d'abord on essaie de le retrouver (coupure de wifi, passage en 4G, appli en arrière-plan…)
// en reprenant sa place. Seulement si le service dit que l'hôte n'existe plus (« peer-unavailable »), l'héritier reprend la
// partie : un invité dont le réseau est coupé ne crée jamais une deuxième partie de son côté.
function hostLost(msg) {
  if (G.net !== 'guest' || G.reconn) return;
  const old = hostConn, hostPeer = old && (old.peer || old.other);
  try { if (old) old.close(); } catch (e) { }
  hostConn = null;
  if (!G.started || !peer || peer.destroyed || !hostPeer || G.hostBye) { if (G.started && G.heir && peer && !peer.destroyed) heirTakeover(msg); else connectionLost(msg); return; }
  G.reconn = { until: Date.now() + 30e3, peerId: hostPeer, msg, since: Date.now() }; NETLOG.reconn++; netLog('perte de l’hôte : ' + msg);
  flash('Connexion perdue : reconnexion…', true);
  reconnTry();
}
function reconnTry() {
  const R = G.reconn; if (!R || G.net !== 'guest' || hostConn) return;
  if (Date.now() > R.until) { G.reconn = null; netLog('reconnexion abandonnée'); connectionLost(R.msg + ' La reconnexion n’a pas marché.'); return; }
  if (!peer || peer.destroyed) { G.reconn = null; connectionLost(R.msg); return; }
  if (peer.disconnected) { try { peer.reconnect(); } catch (e) { } setTimeout(reconnTry, 1500); return; }   // d'abord le service
  const c = peer.connect(R.peerId, { reliable: true, serialization: 'json' });
  let ok = false;
  c.on('open', () => {
    if (G.reconn !== R || hostConn) { try { c.close(); } catch (e) { } return; }
    ok = true; G.reconn = null; attachHost(c); lastMid = -1; NETLOG.reconnOk++; NETLOG.reconnMs.push(Date.now() - R.since); if (NETLOG.reconnMs.length > 10) NETLOG.reconnMs.shift(); netLog('reconnecté en ' + (Date.now() - R.since) + ' ms');
    netSend({ t: 'hello', name: myName(), rejoin: G.myId, key: G.seatKey }); flash('Reconnecté ✓', true);
  });
  setTimeout(() => { if (!ok && G.reconn === R) { try { c.close(); } catch (e) { } reconnTry(); } }, 3000);
}
// l'hôte est parti pour de bon : l'héritier reprend la partie ; les autres se reconnectent à lui (pendant 25 s au plus)
function heirTakeover(msg) {
  const H = G.heir; netLog('l’hôte est parti (héritier : ' + (H ? H[0] : '-') + ')');
  if (!G.started || !H || !peer || peer.destroyed || G.net !== 'guest') { connectionLost(msg); return; }
  if (H[0] === G.myId) { becomeHost(); return; }
  if (!H[1]) { connectionLost(msg); return; }
  const until = G.time + 25;
  G.heirTry = true;
  flash('L’hôte est parti : connexion au nouvel hôte…', true);
  const tryOnce = () => {
    if (G.net !== 'guest' || hostConn) { G.heirTry = false; return; }
    if (G.time > until) { G.heirTry = false; connectionLost('L’hôte est parti et personne n’a pu reprendre la partie.'); return; }
    const c = peer.connect(H[1], { reliable: true, serialization: 'json' });
    let ok = false;
    c.on('open', () => { ok = true; G.heirTry = false; attachHost(c); lastMid = -1; netSend({ t: 'hello', name: myName(), rejoin: G.myId, key: G.seatKey }); flash('Partie reprise ✓', true); });
    setTimeout(() => { if (!ok) { try { c.close(); } catch (e) { } tryOnce(); } }, 2500);
  };
  setTimeout(tryOnce, 600);                                      // le temps que l'héritier se mette en place
}
// on devient l'hôte : on reprend la partie depuis le dernier état reçu (positions, disque, score, stratégies…)
function becomeHost() {
  const oldHost = humanById(G.hostId);
  G.net = 'host'; hostConn = null; conns.clear(); lastSeen.clear();
  G.humans = G.humans.filter(h => h.id !== G.hostId);
  G.hostId = G.myId;
  nextId = Math.max(0, ...G.humans.map(h => h.id)) + 1;
  for (const t of [0, 1]) { const c = captain(t); if (c && c.id !== G.myId && G.netCfg && G.netCfg[t]) c.cfg = Object.assign({}, DEFAULT_CFG, G.netCfg[t]); }
  if (G.netTeams) G.teams = G.netTeams;
  if (G.coopRoom && G.series) {                                  // mode infini à plusieurs : on reprend la série (adversaire, niveau, victoires)
    G.series = Object.assign(newCoopSeries(), G.series, { opp: endlessOpp(G.series.cur || 0) });
    endlessCfgIn();
  }
  syncMe();
  players.forEach(p => { if (p.nx !== undefined) { p.x = p.nx; p.y = p.ny; } p.nx = p.ny = undefined; p.tx = p.x; p.ty = p.y; p.windup = null; p.guess = null; });
  G.oplay = null; G.dplay = null; G.pz = null;
  visReset();
  if (G.phase === 'play') {
    if ((disc.mode === 'held' || disc.mode === 'carry') && disc.holder) {
      const st = G.stall, carry = disc.mode === 'carry' && G.carryTo;
      if (carry) startCarry(disc.holder, G.carryTo.x, G.carryTo.y, ''); else { holdDisc(disc.holder); G.stall = st; }
    } else if (disc.mode === 'air') {
      disc.t = disc.netT || disc.t; disc.rolled = new Set(); disc.pull = false;
      disc.thrower = nearest(TEAMS[disc.team], disc.sx, disc.sy);
      assignRoles(disc.team, disc.intended || disc.thrower); setupDefense(1 - disc.team, disc.intended || disc.thrower);
    } else if (disc.mode === 'ground') {
      disc.x = disc.nx !== undefined ? disc.nx : disc.x; disc.y = disc.ny !== undefined ? disc.ny : disc.y;
      G.pickup = pickupFor(G.off, disc.x, disc.y); assignRoles(G.off, G.pickup); setupDefense(1 - G.off, G.pickup);
    }
  } else if (G.phase === 'pull') startPull();
  else if (G.menuShown && $('stratCard').style.display !== 'none') showMenu(G.phase === 'over' ? 'over' : 'between');   // entre deux points : le menu, côté hôte
  G.readyIds = new Set();
  claimCode(G.time + 60);
  broadcastRoom();
  flash((oldHost ? humanLabel(oldHost) + ' (hôte) est parti' : 'L’hôte est parti') + ' : tu reprends la partie', true);
}
// le nouvel hôte reprend aussi le code de la partie (dès que l'ancien l'a libéré) : on peut encore la rejoindre avec le code
function claimCode(until) {
  if (G.net !== 'host' || !G.roomCode || codePeer || G.time > until) return;
  makePeer(PEER_PREFIX + G.roomCode).then(p => {
    if (G.net !== 'host') { try { p.destroy(); } catch (e) { } return; }
    p.on('open', () => { codePeer = p; });
    p.on('connection', hostAccept);
    p.on('error', err => { if (err && err.type === 'unavailable-id') { try { p.destroy(); } catch (e) { } setTimeout(() => claimCode(until), 3000); } });
  }).catch(() => {});
}

// ta place dans la partie (numéro, clé secrète) : gardée par onglet (sessionStorage), pour la reprendre si la page est
// rechargée — un autre onglet du même navigateur ne peut pas la prendre
function seatGet() { try { return JSON.parse(sessionStorage.getItem('uf-seat') || 'null'); } catch (e) { return null; } }
function seatSet(v) { try { sessionStorage.setItem('uf-seat', JSON.stringify(v)); } catch (e) { } }
// temps d'aller-retour (ms), lissé ; qualité affichée dans le menu ☰ (et sur le terrain si elle est mauvaise)
function rttMix(old, ts) { const r = performance.now() - (+ts || 0); if (!(r >= 0 && r < 30000)) return old; return old ? old * 0.7 + r * 0.3 : r; }
const rttLabel = r => !r ? '…' : Math.round(r) + ' ms (' + (r < 120 ? 'bonne' : r < 250 ? 'moyenne' : 'faible') + ')';
function netQualityText() {
  if (G.net === 'guest') return 'Connexion à l’hôte : ' + rttLabel(G.rtt);
  if (G.net === 'host') { const l = G.humans.filter(h => h.id !== G.myId).map(h => humanLabel(h) + ' ' + rttLabel(h.rtt)); return l.length ? 'Connexion des joueurs : ' + l.join(' · ') : ''; }
  return '';
}
// type de liaison avec l'hôte (ou le premier invité) : directe (host / srflx) ou par le relais (relay = TURN)
function iceProbe() {
  const c = G.net === 'guest' ? hostConn : conns.values().next().value, pc = c && c.peerConnection;
  if (!pc || !pc.getStats) return;
  pc.getStats().then(st => {
    let pair = null; const cand = {};
    st.forEach(r => { if (r.type === 'candidate-pair' && (r.selected || r.nominated) && r.state === 'succeeded') pair = r; if (r.type === 'local-candidate' || r.type === 'remote-candidate') cand[r.id] = r; });
    if (pair) NETLOG.ice = (cand[pair.localCandidateId] || {}).candidateType + ' → ' + (cand[pair.remoteCandidateId] || {}).candidateType + (pair.currentRoundTripTime ? ' · ' + Math.round(pair.currentRoundTripTime * 1000) + ' ms' : '');
  }).catch(() => { });
}
// résumé pour les rapports de bug (menu.js : buildReport)
function netDiag() {
  if (!G.net) return null;
  const g = NETLOG.gaps.slice(-200), sorted = g.slice().sort((a, b) => a - b), pct = q => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : null;
  return {
    role: G.net, code: G.roomCode || null, rtt: G.rtt ? Math.round(G.rtt) : null,
    players: G.net === 'host' ? G.humans.filter(h => h.id !== G.myId).map(h => ({ id: h.id, team: h.team, rtt: h.rtt ? Math.round(h.rtt) : null, open: !!(conns.get(h.id) && conns.get(h.id).open) })) : undefined,
    reconn: NETLOG.reconn, reconnOk: NETLOG.reconnOk, reconnMs: NETLOG.reconnMs, reconnecting: !!G.reconn,
    snapGapMs: g.length ? { med: pct(0.5), p95: pct(0.95), max: sorted[sorted.length - 1] } : null, bursts: NETLOG.bursts,
    predErr: typeof PRED !== 'undefined' ? +PRED.err.toFixed(2) : null, predOn: typeof PRED !== 'undefined' && PRED.on,
    ice: NETLOG.ice || null, relay: typeof hasRelay === 'function' ? hasRelay() : null, events: NETLOG.ev
  };
}
// battement de cœur : un joueur muet pendant 30 s est considéré comme parti
// invité : plus rien ne vient de l'hôte depuis 2 s (onglet ou appli quittée, réseau coupé) → on le dit au lieu de figer en silence
function hostWaitMsg() {
  if (G.net === 'guest' && G.reconn) return '🔄 Reconnexion… (' + Math.floor((Date.now() - G.reconn.since) / 1000) + ' s)';
  if (G.net !== 'guest' || !hostConn || !G.started) return '';
  const s = G.time - lastRecv;
  return s > 2 ? '⏳ En attente de l’hôte… (' + Math.floor(s) + ' s)' : '';
}
function netHeartbeat(dt) {
  if (!G.net) return;
  pingT += dt;
  if (pingT > 1) { pingT = 0; netSend({ t: 'ping', ts: Math.round(performance.now()) }); }
  if (G.time - NETLOG.iceAt > 15) { NETLOG.iceAt = G.time; iceProbe(); }   // l'autre répond « pong » : temps d'aller-retour
  if (G.net === 'guest' && hostConn && G.time - lastRecv > (G.started ? 8 : 30)) hostLost('L’hôte ne répond plus.');   // partie lancée : au bout de 8 s, on se reconnecte
  if (G.net === 'guest' && G.roomCode && G.myId > 0 && G.time - roomSeenT > 2) {              // pour reprendre sa place si la page est rechargée
    roomSeenT = G.time; seatSet({ code: G.roomCode, id: G.myId, key: G.seatKey, seen: Date.now() });
  }
  if (G.net === 'host') for (const [id, t] of lastSeen) if (G.time - t > 30) dropGuest(id, 'ne répond plus');
}
// invité dont l'onglet est caché (plus d'images) : il continue à donner signe de vie, l'hôte garde sa place
setInterval(() => { if (typeof document !== 'undefined' && document.hidden && G.net === 'guest' && hostConn) safeSend(hostConn, { t: 'ping' }); }, 1000);
// page fermée : on prévient avant de couper (« bye » : départ voulu, les autres ne cherchent pas à se reconnecter)
function netLeave() {
  for (const c of conns.values()) { safeSend(c, { t: 'bye' }); try { c.close(); } catch (e) { } }
  if (hostConn) { safeSend(hostConn, { t: 'bye' }); try { hostConn.close(); } catch (e) { } }
}
window.addEventListener('beforeunload', netLeave);
