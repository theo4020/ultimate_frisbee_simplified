// net.js — Multijoueur en ligne (PeerJS : connexions directes entre navigateurs)
// L'hôte fait tourner la partie et envoie l'état ~20 fois par seconde à chaque invité (sans jamais saturer sa connexion).
// Les invités envoient seulement leurs actions (pointeur, lancer, layout, switch, appel, pull).
// Tout invité arrive en spectateur ; il rejoint une équipe quand il veut (bouton 👥 Équipes), partie lancée ou non,
// s'il y reste une place (5 humains max par équipe). Une équipe sans humain est jouée par l'IA. L'hôte joue toujours.

let peer = null, hostConn = null, netT = 0, inT = 0, lastMid = 0, snapAt = 0, lastRecv = 0, pingT = 0;
const conns = new Map();                                     // côté hôte : id d'invité → connexion
const lastSeen = new Map();
let nextId = 1;
const MAX_PER_TEAM = 5, MAX_SPEC = 10;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  const tryUrl = i => new Promise((res, rej) => {
    if (i >= PEERJS_URLS.length) { rej(new Error('PeerJS indisponible')); return; }
    const sc = document.createElement('script');
    sc.src = PEERJS_URLS[i]; sc.onload = res; sc.onerror = () => tryUrl(i + 1).then(res, rej);
    document.head.appendChild(sc);
  });
  return tryUrl(0);
}
const safeSend = (c, msg) => { if (c && c.open) { try { c.send(msg); } catch (e) { } } };
// hôte : à tout le monde ; invité : à l'hôte
function netSend(msg) {
  if (G.net === 'host') for (const c of conns.values()) safeSend(c, msg);
  else safeSend(hostConn, msg);
}
const sendTo = (id, msg) => safeSend(conns.get(id), msg);
// visée du porteur humain (hôte ou invité), envoyée avec l'état du jeu : ses coéquipiers voient l'aperçu de sa passe
// (l'aperçu n'est affiché qu'à son équipe, voir allyAim dans render.js)
function netAimOut() {
  const th = throwerHuman();
  if (G.phase !== 'play' || !th) return null;
  if (th.id === G.myId) return canThrow() && G.pointer.active ? [+G.pointer.x.toFixed(1), +G.pointer.y.toFixed(1), +(+G.curve || 0).toFixed(2), G.throwKind, G.aiming ? 1 : 0] : null;
  const i = inputOf(th);
  return i.aim ? [+(+i.x).toFixed(1), +(+i.y).toFixed(1), +(i.curve || 0).toFixed(2), i.high ? 'high' : 'normal', i.aiming ? 1 : 0] : null;
}
function sendInput(force) {
  if (G.net !== 'guest') return;
  if (!force && G.time - inT < 0.033) return;
  inT = G.time;
  const aim = canThrow() && G.pointer.active;                  // il vise : ses coéquipiers voient l'aperçu de sa passe
  netSend({ t: 'in', x: +G.pointer.x.toFixed(2), y: +G.pointer.y.toFixed(2), down: G.pointer.down, high: G.throwKind === 'high' && canThrow(), aim, aiming: aim && !!G.aiming, curve: aim ? +(+G.curve || 0).toFixed(2) : 0 });
}
function netError(msg) {
  for (const c of conns.values()) { try { c.close(); } catch (e) { } }
  conns.clear(); lastSeen.clear();
  try { if (hostConn) hostConn.close(); } catch (e) { }
  try { if (peer) peer.destroy(); } catch (e) { }
  peer = hostConn = null;
  backToSolo();
  showLobby(msg, 'online');                                    // on revient à la section En ligne
}
const connectionLost = msg => netError(msg);
function backToSolo() {
  if (typeof endlessCfgOut === 'function') endlessCfgOut();   // on sort du mode infini : réglages du match rapide
  G.attract = false; G.coopRoom = false; G.roomCode = null;
  if (G.practice) { G.practice = null; $('pracBox').style.display = 'none'; }
  G.net = null; G.myId = 0; G.humans = [{ id: 0, team: 0, sel: null, name: myName() }]; G.started = false; G.netCfg = null; G.netTeams = null; G.spectator = false;
  G.netSummary = null; G.emotes = []; G.pz = null;
  syncMe(); G.phase = 'menu'; G.score = [0, 0]; G.receiving = 0; hudKey = '';
  placeForPoint();
}

// Serveurs ICE : le relais TURN vient du serveur du site (/api/turn, Cloudflare : identifiants temporaires, clé secrète
// jamais dans la page, worker/index.js). Ancien hébergement sans ce serveur : identifiants fixes de js/secrets.js, sinon STUN seuls.
// Seuls les identifiants du serveur sont gardés (1 h) ; un échec est retenté au prochain appel, sa raison va dans iceErr.
let iceCache = null, iceAt = 0, iceErr = '', lastIce = [];
function iceServers() {
  if (iceCache && performance.now() - iceAt < 3600e3) return Promise.resolve(iceCache);
  return fetch('api/turn', { cache: 'no-store' })
    .then(r => r.json().catch(() => ({})).then(j => {
      if (r.ok && Array.isArray(j.iceServers) && j.iceServers.length) { iceErr = ''; iceAt = performance.now(); return (iceCache = j.iceServers); }
      iceErr = r.status === 404 ? 'pas de serveur de relais à cette adresse' : (j.error || 'erreur') + ' (' + r.status + ')';
      return (iceCache = null, staticIce());
    }))
    .catch(e => { iceErr = 'serveur de relais injoignable'; return staticIce(); })
    .then(ice => (lastIce = ice));
}
function staticIce() {                                        // à retirer une fois le site sur Cloudflare
  if (!TURN_USER || !TURN_PASS) return BASE_ICE;
  const cred = { username: TURN_USER, credential: TURN_PASS };
  return [{ urls: 'stun:stun.l.google.com:19302' }].concat(['turn:global.relay.metered.ca:80', 'turn:global.relay.metered.ca:80?transport=tcp',
    'turn:global.relay.metered.ca:443', 'turns:global.relay.metered.ca:443?transport=tcp'].map(urls => Object.assign({ urls }, cred)));
}
function makePeer(id) {
  return Promise.all([loadPeerJS(), iceServers()]).then(([, ice]) => {
    const p = id ? new Peer(id, { config: { iceServers: ice }, debug: 1 }) : new Peer({ config: { iceServers: ice }, debug: 1 });
    // sur téléphone, changer d'appli coupe la liaison avec le service : on la rétablit
    p.on('disconnected', () => { if (peer === p && !p.destroyed) setTimeout(() => { try { p.reconnect(); } catch (e) { } }, 500); });
    return p;
  });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && peer && peer.disconnected && !peer.destroyed) { try { peer.reconnect(); } catch (e) { } }
});
// Surveille la négociation WebRTC pour donner un message clair si elle échoue
function watchIce(c, onFail) {
  const pc = c.peerConnection;
  if (!pc) return;
  pc.addEventListener('iceconnectionstatechange', () => { if (pc.iceConnectionState === 'failed') onFail(); });
}
const isRelay = s => [].concat(s.urls).some(u => /^turns?:/.test(u)) && s.username !== 'peerjs';
const hasRelay = () => lastIce.some(isRelay);
const iceFailMsg = () => hasRelay()
  ? 'La partie a été trouvée, mais la connexion n’a pas pu s’établir, même par le relais. Réessaie ; si ça se répète, appuie sur « Tester la connexion » sur chaque appareil.'
  : 'La partie a été trouvée, mais vos réseaux bloquent la connexion directe (fréquent en 4G/5G ou sur un wifi d’entreprise), et ce site n’a pas de relais configuré. Essayez sur le même wifi.';

// test du relais : on demande au navigateur un chemin passant UNIQUEMENT par le relais TURN
function testRelay(out) {
  out.textContent = 'Test en cours…';
  iceServers().then(ice => {
    const turn = ice.filter(isRelay);
    if (!turn.length) { out.textContent = '⚠️ Pas de relais' + (iceErr ? ' : ' + iceErr : '') + '. La connexion ne marchera qu’entre réseaux ouverts.'; return; }
    let pc, done = false;
    const end = ok => {
      if (done) return; done = true;
      try { pc.close(); } catch (e) { }
      out.textContent = ok ? '✅ Le relais répond : la connexion devrait marcher, même en 4G.'
        : '❌ Le relais ne répond pas (identifiants refusés, quota épuisé, ou réseau qui bloque). Préviens l’hôte du site.';
    };
    try {
      pc = new RTCPeerConnection({ iceServers: turn, iceTransportPolicy: 'relay' });
      pc.createDataChannel('test');
      pc.onicecandidate = e => { if (e.candidate && / typ relay /.test(e.candidate.candidate)) end(true); else if (!e.candidate) end(false); };
      pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => end(false));
      setTimeout(() => end(false), 8000);
    } catch (e) { end(false); }
  });
}

// =====================================================================
//  Hôte
// =====================================================================
function hostGame() {
  stopAttract();
  showRoom(); $('lobbyErr').textContent = '';
  $('hostStatus').textContent = 'Connexion au service…'; $('hostCode').textContent = '····';
  const code = newCode();
  makePeer(PEER_PREFIX + code).then(p => {
    peer = p;
    p.on('open', () => {
      $('hostCode').textContent = code;
      G.net = 'host'; G.myId = 0; G.humans = [{ id: 0, team: 0, sel: null, name: myName() }]; G.started = false; nextId = 1;
      syncMe(); renderRoom();
      G.roomCode = code; G.inviteUrl = location.href.split('#')[0] + '#join=' + code;
    });
    p.on('connection', c => {
      let opened = false;
      $('hostStatus').textContent = 'Un joueur se connecte…';
      const to = setTimeout(() => { if (!opened) renderRoom('Un joueur n’arrive pas à se connecter (réseau).'); }, 15000);
      setTimeout(() => watchIce(c, () => { if (!opened) renderRoom('La connexion directe d’un joueur a échoué (réseau).'); }), 0);
      c.on('open', () => { opened = true; clearTimeout(to); addGuest(c); });
    });
    p.on('error', err => {
      const t = err && err.type;
      if (t === 'unavailable-id') { p.destroy(); hostGame(); return; }
      if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') {
        $('hostStatus').textContent = 'Liaison avec le service perdue, reconnexion…';
        return;                                             // 'disconnected' relance la connexion
      }
      if (conns.size) return;                               // la partie continue avec les joueurs connectés
      netError('Impossible de créer la partie (' + (t || 'réseau') + ').');
    });
  }).catch(() => netError('Impossible de charger le module réseau. Vérifie ta connexion.'));
}
// l'invité se présente (« hello ») : il arrive en spectateur
function addGuest(c) {
  let id = null;
  c.on('data', m => {
    if (!m || typeof m !== 'object') return;
    if (id === null) { if (m.t === 'hello') id = admitGuest(c, m); return; }
    lastSeen.set(id, G.time); hostOnData(id, m);
  });
  c.on('close', () => { if (id !== null) dropGuest(id, 'a quitté la partie'); });
  c.on('error', () => { if (id !== null) dropGuest(id, 'a perdu la connexion'); });
  setTimeout(() => { if (id === null) { try { c.close(); } catch (e) { } } }, 15000);
}
function admitGuest(c, m) {
  if (G.humans.filter(h => h.team < 0).length >= MAX_SPEC) { safeSend(c, { t: 'full' }); setTimeout(() => c.close(), 300); return null; }
  const id = nextId++;
  conns.set(id, c); lastSeen.set(id, G.time);
  const h = { id, team: -1, sel: null, name: cleanName(m.name) };
  G.humans.push(h);
  sendTo(id, { t: 'welcome', id });
  sendTo(id, roomState());
  if (G.started && G.menuShown) sendTo(id, { t: 'menu', kind: G.lastMenu || 'first', score: G.score, rec: G.receiving, wind: G.wind, teams: G.teams, pts: winPts(), sum: G.lastMenu === 'over' ? G.lastSummary : null, ser: coopSer() });
  broadcastRoom();
  if (G.started) flash(humanLabel(h) + ' regarde la partie');
  return id;
}
function dropGuest(id, why) {
  if (!conns.has(id)) return;
  try { conns.get(id).close(); } catch (e) { }
  conns.delete(id); lastSeen.delete(id);
  const h = humanById(id);
  G.humans = G.humans.filter(o => o.id !== id);
  if (G.readyIds) G.readyIds.delete(id);
  if (G.pz && G.pz.by === id) G.pz = null;                     // celui qui avait mis en pause est parti
  if (h) flash(humanLabel(h) + ' ' + why);
  if (G.started) { if (G.phase === 'play') updateSelected(); tryStartOnline(); }
  broadcastRoom();
}
const roomState = () => ({ t: 'room', started: !!G.started, coop: !!G.coopRoom, hum: G.humans.map(h => [h.id, h.team, h.name || '']) });
function broadcastRoom() { syncMe(); netSend(roomState()); renderRoom(); refreshCaptainUI(); }
function setTeam(id, team) {
  const h = humanById(id);
  if (!h || h.team === team) return;
  if (team >= 0 && teamHumans(team).length >= MAX_PER_TEAM) return;
  if (G.coopRoom && team === 1) return;                      // mode infini à plusieurs : les Rouges sont l'IA
  if (id === 0 && team < 0) return;                          // l'hôte joue toujours
  h.team = team; h.sel = null;                               // partie en cours : il prend tout de suite un joueur de l'équipe
  if (G.readyIds) G.readyIds.delete(id);
  if (G.started && G.phase === 'play') updateSelected();
  broadcastRoom();
  if (G.started) flash(humanLabel(h) + (team < 0 ? ' regarde la partie' : ' rejoint les ' + tn(team)));
}
function startOnline() {
  if (G.net !== 'host') return;
  if (G.coopRoom) { coopStart(); return; }                   // mode infini à plusieurs (coop.js)
  G.started = true; newMatch(); G.phase = 'menu';
  broadcastRoom();
  placeForPoint();
  showMenu('first');
}

// messages des invités
function hostOnData(id, m) {
  const h = humanById(id);
  if (!h) return;
  switch (m.t) {
    case 'team': setTeam(id, m.team === 1 ? 1 : m.team === -1 ? -1 : 0); break;
    case 'emo': hostEmote(id, m.e | 0); break;
    case 'name': h.name = cleanName(m.name); broadcastRoom(); break;
    case 'in': Object.assign(inputOf(h), { x: +m.x || 0, y: +m.y || 0, down: !!m.down, high: !!m.high, aim: !!m.aim, aiming: !!m.aiming, curve: clamp(+m.curve || 0, -1, 1), last: G.time }); break;
    case 'callplay': if (G.phase === 'play' && throwerHuman() === h) callPlay(h.team, m.n === 2 ? 2 : 1); break;
    case 'throw': if (G.phase === 'play' && throwerHuman() === h) throwDisc(disc.holder, +m.x, +m.y, clamp(+m.curve || 0, -1, 1), 1, THROWS[m.kind] ? m.kind : 'normal'); break;
    case 'dive': diveFor(h, +m.x, +m.y); break;
    case 'jump': jumpFor(h); break;
    case 'switch': { const n = switchTarget(h); if (n) selectFor(h, n); break; }
    case 'select': selectFor(h, players[m.i | 0]); break;
    case 'call': callFor(h, +m.x, +m.y); break;
    case 'pause': setPause(id, !!m.on); break;
    case 'pull': if (G.phase === 'pull' && G.pull && G.pull.by === h.id) launchPull(+m.x, +m.y, m.curve, m.q); break;
    case 'cfg': if (captain(h.team) === h) takeCfg(h, m.cfg); break;   // le capitaine change sa stratégie : ses coéquipiers la voient
    case 'ready':
      if (captain(h.team) === h) { takeCfg(h, m.cfg); (G.readyIds = G.readyIds || new Set()).add(id); }
      refreshCaptainUI(); tryStartOnline(); break;
  }
}
function takeCfg(h, c) {
  h.cfg = Object.assign({}, DEFAULT_CFG, c, { osys: cleanSystem(c && c.osys), dsys: cleanSystem(c && c.dsys),
    p1sys: cleanSystem(c && c.p1sys), p2sys: cleanSystem(c && c.p2sys) });
}
function hostEmote(id, k) {
  const h = humanById(id);
  if (!h || !EMOTES[k] || G.time - (h.emoT || -9) < 1.2) return;
  h.emoT = G.time;
  G.emotes.push({ id, e: EMOTES[k], t: G.time });
  netSend({ t: 'emo', id, e: k });
}
const idx = p => (p ? players.indexOf(p) : -1);
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
// état envoyé ~20 fois par seconde : le minimum qui bouge (positions arrondies au décimètre) ;
// le reste (stratégies, équipes, humains, vent…) seulement quand il change, et au moins une fois par seconde
let metaJson = '', metaAt = -9;
function snapshot() {
  const meta = { wind: G.wind, rec: G.receiving, speed: G.form.speed, hum: G.humans.map(h => [h.id, h.team, idx(h.sel)]),
    op: G.oplay && { type: G.oplay.type, team: G.oplay.team }, dp: G.dplay && { type: G.dplay.type, team: G.dplay.team },
    order: [G.order[0].map(idx), G.order[1].map(idx)], cfg: [0, 1].map(t => (captain(t) && captain(t).id === G.myId ? myCfg() : cfg(t))), teams: G.teams };
  const mj = JSON.stringify(meta), sendMeta = mj !== metaJson || G.time - metaAt > 1;
  if (sendMeta) { metaJson = mj; metaAt = G.time; }
  return {
    t: 's', m: sendMeta ? meta : undefined,
    p: players.map(p => [r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), p.dive > 0 ? 1 : 0, p.down > 0 ? 1 : 0, p.tag, p.state, p.role, r1(p.cx), r1(p.cy), idx(p.match), p.jprep > 0 ? -1 : r1(jumpLift(p))]),
    d: [disc.mode, idx(disc.holder), r1(disc.x), r1(disc.y), r1(disc.sx), r1(disc.sy), r1(disc.cx), r1(disc.cy), r1(disc.ex), r1(disc.ey), r2(disc.t), r2(disc.dur), idx(disc.intended), disc.kind, r2(disc.curveV || 0)],
    g: { score: G.score, off: G.off, phase: G.phase, stall: r1(G.stall), mk: idx(G.marker), msg: G.msg, mid: G.msgId, mt: G.msgTeam, ma: G.msgAlt,
      dbl: idx(G.dbl), gt: r1(G.gt), carry: G.carryTo,
      pull: G.phase === 'pull' && G.pull ? G.pull.team : -1, pullBy: G.pull ? G.pull.by : null, pready: G.phase === 'pull' && pullReady(), pleft: pullLeft(), tell: highTell(), pz: G.pz || null, aim: netAimOut(), piv: disc.holder ? r2(disc.holder.pivY || 0) : 0 }
  };
}
// envoi aux invités : on n'empile jamais les états chez un invité dont la connexion sature
// (sinon le retard grandit jusqu'à la coupure) ; ses effets sonores en attente partent avec l'état suivant
function sendSnapshot() {
  const snap = snapshot(), fx = FX.out.splice(0), aim = snap.g.aim, aimTeam = disc.holder ? disc.holder.team : -1;
  for (const [id, c] of conns) {
    const hc = humanById(id); snap.g.aim = aim && hc && hc.team === aimTeam ? aim : null;   // visée : seulement à son équipe
    c.fxq = (c.fxq || []).concat(fx);
    const busy = (c.dataChannel && c.dataChannel.bufferedAmount > 48000) || c.bufferSize > 0;
    if (busy || !c.open) { if (snap.m) metaAt = -9; continue; }   // métadonnées renvoyées au prochain état
    snap.fx = c.fxq; safeSend(c, snap); c.fxq = [];
  }
}

// =====================================================================
//  Invité
// =====================================================================
function joinGame(code) {
  stopAttract();
  code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4) { $('lobbyErr').textContent = 'Le code fait 4 caractères.'; return; }
  $('lobbyErr').textContent = ''; $('joinStatus').textContent = 'Connexion au service…';
  makePeer(null).then(p => {
    peer = p;
    p.on('open', () => {
      $('joinStatus').textContent = 'Recherche de la partie…';
      const c = p.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
      let opened = false;
      const fail = msg => { if (!opened && !hostConn) netError(msg); };
      const to = setTimeout(() => fail(iceFailMsg()), 20000);
      setTimeout(() => {
        if (!opened) $('joinStatus').textContent = 'Partie trouvée, établissement de la connexion…';
        watchIce(c, () => { clearTimeout(to); fail(iceFailMsg()); });
      }, 1500);
      c.on('open', () => {
        opened = true; clearTimeout(to);
        hostConn = c; lastRecv = G.time;
        c.on('data', m => { lastRecv = G.time; if (m && typeof m === 'object') guestOnData(m); });
        c.on('close', () => { if (hostConn === c) connectionLost('La connexion avec l’hôte a été perdue.'); });
        c.on('error', () => { if (hostConn === c) connectionLost('Erreur de connexion avec l’hôte.'); });
        G.score = [0, 0]; G.receiving = 0; G.phase = 'menu';
        G.net = 'guest';
        G.roomCode = code; G.inviteUrl = location.href.split('#')[0] + '#join=' + code;   // pour inviter d'autres joueurs (menu ☰)
        storeSet('uf-last-room', { code, at: Date.now() });     // pour revenir dans la partie si on la quitte
        $('joinStatus').textContent = 'Connecté !';
        lastMid = -1;
        netSend({ t: 'hello', name: myName() });
      });
    });
    p.on('error', err => {
      const t = err && err.type;
      if (hostConn) return;
      if (t === 'peer-unavailable') storeSet('uf-last-room', null);
      if (t === 'peer-unavailable') netError('Aucune partie trouvée avec ce code. Vérifie le code, et que la page de l’hôte est toujours ouverte au premier plan.');
      else if (t === 'network' || t === 'socket-error' || t === 'server-error') netError('Le service de mise en relation ne répond pas. Réessaie dans un instant.');
      else netError('Connexion impossible (' + (t || 'réseau') + ').');
    });
  }).catch(() => netError('Impossible de charger le module réseau. Vérifie ta connexion.'));
}
function applyHumans(list) {
  const old = new Map(G.humans.map(h => [h.id, h]));
  G.humans = list.map(([id, team, si, name]) => {
    const h = Object.assign(old.get(id) || { id }, { team, sel: si >= 0 ? players[si] : null });
    if (name !== undefined) h.name = cleanName(name);
    return h;
  });
  syncMe();
}
function guestOnData(m) {
  switch (m.t) {
    case 's': applySnapshot(m); break;
    case 'welcome':
      G.myId = m.id;
      if (!G.started) showRoom();
      break;
    case 'emo': if (EMOTES[m.e]) G.emotes.push({ id: m.id, e: EMOTES[m.e], t: G.time }); break;
    case 'full': netError('La partie est complète.'); break;
    case 'room':
      applyHumans(m.hum.map(([id, team, name]) => [id, team, -1, name]));
      G.started = m.started; G.coopRoom = !!m.coop; hudKey = '';
      if (!G.started && G.series) G.series = null;
      if (!G.started || G.teamsOpen) { showRoom(); renderRoom(); }
      else if ((G.phase === 'play' || G.phase === 'pull') && !cardStack.length) { $('overlay').classList.add('hidden'); G.menuShown = false; }
      refreshCaptainUI();
      break;
    case 'wind': G.wind = m.wind; hudKey = ''; refreshOptions(); break;
    case 'rec': G.receiving = m.rec; placeForPoint(); refreshOptions(); updateFirstText(); break;
    case 'menu':
      G.score = m.score; G.receiving = m.rec; G.wind = m.wind;
      if (m.teams) G.netTeams = m.teams;
      if (m.pts) G.netPts = m.pts;
      G.netSummary = m.sum || null;
      G.series = m.ser ? Object.assign({ endless: true, coop: true, pts: ENDLESS_PTS }, m.ser) : null;   // série à plusieurs : où on en est
      if (m.kind === 'over') { if (G.phase !== 'over') achGuestOver(m.score); G.phase = 'over'; }
      showMenu(m.kind);
      shareCfg();
      break;
    case 'coopEnd': coopGuestEnd(m); break;
    case 'start':
      replayReset(); FX.celebrate = null; G.teamsOpen = null; resetCards();
      G.phase = 'pull'; G.menuShown = false; G.receiving = m.r;
      G.pull = { team: 1 - m.r, t: 0, by: m.by == null ? null : m.by }; G.pullUI = { stage: 'aim', t0: 0, x: 0, y: 0, q: 0 };
      G.curve = 0; $('curveRange').value = 0;
      $('overlay').classList.add('hidden');
      pullFlash();
      break;
  }
}
// battement de cœur : un joueur muet pendant 30 s est considéré comme parti
function netHeartbeat(dt) {
  if (!G.net) return;
  pingT += dt;
  if (pingT > 1) { pingT = 0; netSend({ t: 'ping' }); }
  if (G.net === 'guest' && hostConn && G.time - lastRecv > 30) connectionLost('L’hôte ne répond plus.');
  if (G.net === 'host') for (const [id, t] of lastSeen) if (G.time - t > 30) dropGuest(id, 'ne répond plus');
}
window.addEventListener('beforeunload', () => {
  for (const c of conns.values()) { try { c.close(); } catch (e) { } }
  try { if (hostConn) hostConn.close(); } catch (e) { }
});

function applySnapshot(m) {
  snapAt = G.time;
  m.p.forEach((a, i) => {
    const p = players[i];
    if (p.nx === undefined) { p.x = a[0]; p.y = a[1]; }
    p.nx = a[0]; p.ny = a[1]; p.vx = a[2]; p.vy = a[3]; p.dive = a[4] ? 1 : 0; p.down = a[5] ? 1 : 0;
    p.tag = a[6]; p.state = a[7]; p.role = a[8]; p.cx = a[9]; p.cy = a[10]; p.match = a[11] >= 0 ? players[a[11]] : null; p.lift = a[12] || 0;
  });
  const d = m.d;
  disc.mode = d[0]; disc.holder = d[1] >= 0 ? players[d[1]] : null;
  disc.nx = d[2]; disc.ny = d[3];
  [disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey] = d.slice(4, 10);
  disc.netT = d[10]; disc.dur = d[11]; disc.intended = d[12] >= 0 ? players[d[12]] : null; disc.kind = THROWS[d[13]] ? d[13] : 'normal'; disc.curveV = +d[14] || 0;
  const g = m.g;
  G.score = g.score; G.off = g.off; G.stall = g.stall; G.marker = g.mk >= 0 ? players[g.mk] : null;
  G.dbl = g.dbl >= 0 ? players[g.dbl] : null; G.carryTo = g.carry || null; G.gt = g.gt;
  const mt = m.m;
  if (mt) {
    G.wind = mt.wind; G.receiving = mt.rec; G.form.speed = mt.speed;
    applyHumans(mt.hum);
    const cj = JSON.stringify(mt.cfg), cfgChanged = cj !== G.netCfgJson;
    G.oplay = mt.op; G.dplay = mt.dp; G.netCfg = mt.cfg; G.netCfgJson = cj;
    if (cfgChanged && G.menuShown) refreshCaptainUI();          // la stratégie du capitaine s'affiche chez ses coéquipiers
    if (mt.teams) G.netTeams = mt.teams;
    G.order = mt.order.map(o => o.map(i => players[i]));
  }
  G.netTell = !!g.tell; G.pz = g.pz || null;
  if (disc.holder) disc.holder.pivY = +g.piv || 0;
  G.netAim = Array.isArray(g.aim) ? { x: +g.aim[0], y: +g.aim[1], curve: +g.aim[2] || 0, kind: g.aim[3] === 'high' ? 'high' : 'normal', aiming: !!g.aim[4] } : null;
  if ((g.phase === 'play' || g.phase === 'pull') && G.started && !G.teamsOpen && !cardStack.length && !$('overlay').classList.contains('hidden') && $('stratCard').style.display === 'none') {
    $('overlay').classList.add('hidden'); G.menuShown = false;          // arrivée en cours de point : on montre le terrain
  }
  if (g.phase === 'pull' && (G.phase !== 'pull' || !G.pull)) { G.pull = { team: g.pull, t: 0, by: g.pullBy }; G.pullUI = { stage: 'aim', t0: 0, x: 0, y: 0, q: 0 }; }
  if (g.phase === 'pull' && G.pull) G.pull.by = g.pullBy;
  G.netPullReady = !!g.pready; G.netPullLeft = g.pleft == null ? null : g.pleft;
  if (g.phase !== G.phase) { G.phase = g.phase; if (g.phase !== 'play') G.aiming = false; }
  if (m.fx) for (const e of m.fx) fxPlay(e[0], e[1], e[2], e[3]);   // effets après l'état (direction des lancers)
  if (lastMid === -1) lastMid = g.mid;
  else if (g.mid !== lastMid) { lastMid = g.mid; if (g.msg) flash(g.msg, true, g.mt === undefined ? null : g.mt, g.ma); }
}
// l'invité ne simule rien : il lisse les positions reçues
function guestFrame(dt) {
  const since = G.pz ? 0 : Math.min(0.15, G.time - snapAt), k = Math.min(1, dt * 14), sp = SPEEDS[G.form.speed];
  for (const p of players) {
    if (p.nx === undefined) continue;
    const tx = p.nx + p.vx * since * sp, ty = p.ny + p.vy * since * sp;
    p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
  }
  if (disc.mode === 'air') {
    disc.t = Math.min(disc.dur, disc.netT + since * sp);       // temps de vol chez l'invité (trajectoire restante, anneau de hauteur…)
    const u = Math.min(1, disc.t / disc.dur);
    [disc.x, disc.y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u);
    disc.z = discZ(u);
  } else if ((disc.mode === 'held' || disc.mode === 'carry') && disc.holder) { disc.x = disc.holder.x; disc.y = disc.holder.y; disc.z = 0; }
  else if (disc.nx !== undefined) { disc.x = disc.nx; disc.y = disc.ny; disc.z = 0; }
}

// =====================================================================
//  Lobby (salle d'attente : choix des équipes)
// =====================================================================
// avant le match : salle d'attente ; partie lancée : le même écran s'ouvre par-dessus le jeu (bouton 👥 Équipes)
function showRoom() {
  if (G.started && !G.teamsOpen) G.teamsOpen = { menu: G.menuShown };
  G.menuShown = true;
  for (const id of ['stratCard', 'seriesCard', 'profileCard', 'endlessCard']) $(id).style.display = 'none';
  $('lobbyCard').style.display = '';
  for (const id of ['lobbyHome', 'lobbyJoin', 'lobbySolo', 'lobbyOnline']) $(id).style.display = 'none';
  $('lobbyRoom').style.display = '';
  const host = G.net === 'host' || !G.net;
  $('roomCodeBox').style.display = host || G.roomCode ? '' : 'none';   // l'invité voit aussi le code, pour inviter d'autres joueurs
  if (G.roomCode) $('hostCode').textContent = G.roomCode;
  $('startOnline').style.display = host && !G.started ? '' : 'none';
  $('roomBack').style.display = G.started ? '' : 'none';
  $('backB1').style.display = G.started ? 'none' : '';
  $('overlay').classList.remove('hidden');
  renderRoom();
}
function closeTeams() {
  const T = G.teamsOpen; if (!T) return;
  G.teamsOpen = null;
  $('lobbyCard').style.display = 'none';
  if (T.menu && (G.phase === 'menu' || G.phase === 'between' || G.phase === 'over')) { $('stratCard').style.display = ''; G.menuShown = true; refreshCaptainUI(); }
  else { G.menuShown = false; $('overlay').classList.add('hidden'); }
}
function renderRoom(note) {
  if (!$('rosterB')) return;
  for (const t of [0, 1]) {
    const ul = $(t === 0 ? 'rosterB' : 'rosterR');
    const hs = teamHumans(t);
    ul.innerHTML = hs.length ? hs.map(h => `<li>${esc(humanLabel(h))}${h.id === 0 ? ' (hôte)' : ''}${h.id === G.myId ? ' — <b>toi</b>' : ''}${captain(t) === h ? ' · capitaine' : ''}</li>`).join('')
      : '<li class="ai">IA</li>';
    const me = meH();
    $('teamB' + t).disabled = !me || me.team === t || hs.length >= MAX_PER_TEAM;
    $('teamB' + t).textContent = 'Rejoindre les ' + DEFAULT_TEAMS[t].name;
  }
  $('teamB1').style.display = G.coopRoom ? 'none' : '';      // mode infini à plusieurs : tout le monde chez les Bleus
  $('coopNote').style.display = G.coopRoom ? '' : 'none';
  if (G.coopRoom) $('rosterR').innerHTML = '<li class="ai">IA (de plus en plus forte)</li>';
  const sp = G.humans.filter(h => h.team < 0), me = meH();
  $('rosterS').innerHTML = sp.length ? sp.map(h => esc(humanLabel(h)) + (h.id === G.myId ? ' (toi)' : '')).join(', ') : 'aucun';
  $('teamBS').disabled = !me || me.team < 0 || me.id === 0 || sp.length >= MAX_SPEC;
  const n = G.humans.filter(h => h.team >= 0).length;
  $('hostStatus').textContent = note || (G.net === 'host'
    ? (n > 1 ? `${n} joueurs connectés. Lance la partie quand tout le monde est là.` : 'En attente de joueurs… (tu peux aussi lancer seul contre l’IA)')
    : G.started ? 'Partie en cours : choisis une équipe s’il reste une place.' : 'En attente que l’hôte lance la partie…');
}
function chooseTeam(t) {
  if (t < 0 && G.net !== 'guest') return;
  if (G.net === 'guest') netSend({ t: 'team', team: t });
  else if (G.net === 'host') setTeam(0, t);
  if (G.started) closeTeams();
}

$('soloB').addEventListener('click', () => { backToSolo(); G.series = null; newMatch(); showMenu('first'); });
$('hostB').addEventListener('click', () => { G.coopRoom = false; hostGame(); });
$('joinB').addEventListener('click', () => {
  $('lobbyHome').style.display = 'none'; $('lobbyOnline').style.display = 'none'; $('lobbyJoin').style.display = ''; $('lobbyErr').textContent = '';
  $('joinStatus').textContent = ''; $('joinCode').focus();
});
$('joinGo').addEventListener('click', () => joinGame($('joinCode').value));
$('teamB0').addEventListener('click', () => chooseTeam(0));
$('teamB1').addEventListener('click', () => chooseTeam(1));
$('teamBS').addEventListener('click', () => chooseTeam(-1));
$('roomBack').addEventListener('click', closeTeams);
document.querySelectorAll('.testNet').forEach(b => b.addEventListener('click', () => testRelay(b.nextElementSibling)));
$('teamsB').addEventListener('click', () => { if (G.net && G.started) showRoom(); });
$('startOnline').addEventListener('click', startOnline);
$('copyLink').addEventListener('click', () => copyInvite($('copyLink')));
function copyInvite(btn) {
  if (!G.inviteUrl) return;
  const done = () => { btn.textContent = 'Lien copié ✓'; setTimeout(() => btn.textContent = 'Copier le lien d’invitation', 1500); };
  if (navigator.share && document.body.classList.contains('touch')) navigator.share({ title: 'Ultimate Frisbee', text: 'Rejoins ma partie !', url: G.inviteUrl }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(G.inviteUrl).then(done, () => prompt('Copie ce lien :', G.inviteUrl));
  else prompt('Copie ce lien :', G.inviteUrl);
}
for (const id of ['backB1', 'backB2']) $(id).addEventListener('click', () => netError(''));

// pseudo : mémorisé dans le navigateur, envoyé à l'hôte (et modifiable dans la salle d'attente)
$('pname').value = myName();
$('pname').addEventListener('input', e => {
  storeSet('uf-name', cleanName(e.target.value));
  const h = meH();
  if (G.net === 'guest') netSend({ t: 'name', name: myName() });
  else if (G.net === 'host' && h) { h.name = myName(); broadcastRoom(); }
  else if (h) h.name = myName();
});
