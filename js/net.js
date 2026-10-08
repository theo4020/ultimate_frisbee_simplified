// net.js — Multijoueur en ligne (PeerJS : connexions directes entre navigateurs)
// L'hôte fait tourner la partie et envoie l'état ~20 fois par seconde à chaque invité.
// Les invités envoient seulement leurs actions (pointeur, lancer, layout, switch, appel, pull).
// Jusqu'à 5 humains par équipe ; une équipe sans humain est jouée par l'IA.

let peer = null, hostConn = null, netT = 0, inT = 0, lastMid = 0, snapAt = 0, lastRecv = 0, pingT = 0;
const conns = new Map();                                     // côté hôte : id d'invité → connexion
const lastSeen = new Map();
let nextId = 1;
const MAX_PER_TEAM = 5;
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
function sendInput(force) {
  if (G.net !== 'guest') return;
  if (!force && G.time - inT < 0.033) return;
  inT = G.time;
  netSend({ t: 'in', x: +G.pointer.x.toFixed(2), y: +G.pointer.y.toFixed(2), down: G.pointer.down });
}
function netError(msg) {
  for (const c of conns.values()) { try { c.close(); } catch (e) { } }
  conns.clear(); lastSeen.clear();
  try { if (hostConn) hostConn.close(); } catch (e) { }
  try { if (peer) peer.destroy(); } catch (e) { }
  peer = hostConn = null;
  backToSolo();
  showLobby(msg);
}
function backToSolo() {
  G.net = null; G.myId = 0; G.humans = [{ id: 0, team: 0, sel: null }]; G.started = false; G.netCfg = null;
  syncMe(); G.phase = 'menu'; G.score = [0, 0]; G.receiving = 0; hudKey = '';
  placeForPoint();
}

// Serveurs ICE : STUN publics + relais TURN (le tien si configuré)
let iceCache = null;
function iceServers() {
  if (iceCache) return Promise.resolve(iceCache);
  if (TURN_USER && TURN_PASS) {
    const cred = { username: TURN_USER, credential: TURN_PASS };
    return Promise.resolve(iceCache = BASE_ICE.concat([
      { urls: 'stun:stun.relay.metered.ca:80' },
      Object.assign({ urls: 'turn:global.relay.metered.ca:80' }, cred),
      Object.assign({ urls: 'turn:global.relay.metered.ca:80?transport=tcp' }, cred),
      Object.assign({ urls: 'turn:global.relay.metered.ca:443' }, cred),
      Object.assign({ urls: 'turns:global.relay.metered.ca:443?transport=tcp' }, cred)
    ]));
  }
  if (!TURN_APP || !TURN_KEY) return Promise.resolve(iceCache = BASE_ICE);
  return fetch(`https://${TURN_APP}.metered.live/api/v1/turn/credentials?apiKey=${TURN_KEY}`)
    .then(r => r.json())
    .then(list => (iceCache = Array.isArray(list) && list.length ? BASE_ICE.concat(list) : BASE_ICE))
    .catch(() => (iceCache = BASE_ICE));
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
const ICE_FAIL_MSG = 'La partie a bien été trouvée, mais vos deux réseaux bloquent la connexion directe (fréquent en 4G/5G ou sur un wifi d’entreprise). Essayez sur le même wifi, ou configurez un relais TURN (voir README : secrets TURN_USER / TURN_PASS).';

// =====================================================================
//  Hôte
// =====================================================================
function hostGame() {
  showRoom(); $('lobbyErr').textContent = '';
  $('hostStatus').textContent = 'Connexion au service…'; $('hostCode').textContent = '····';
  const code = newCode();
  makePeer(PEER_PREFIX + code).then(p => {
    peer = p;
    p.on('open', () => {
      $('hostCode').textContent = code;
      G.net = 'host'; G.myId = 0; G.humans = [{ id: 0, team: 0, sel: null }]; G.started = false; nextId = 1;
      syncMe(); renderRoom();
      G.inviteUrl = location.href.split('#')[0] + '#join=' + code;
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
function addGuest(c) {
  const counts = [teamHumans(0).length, teamHumans(1).length];
  if (counts[0] >= MAX_PER_TEAM && counts[1] >= MAX_PER_TEAM) { safeSend(c, { t: 'full' }); setTimeout(() => c.close(), 300); return; }
  const id = nextId++;
  const team = counts[1] <= counts[0] && counts[1] < MAX_PER_TEAM ? 1 : 0;   // on remplit l'équipe la moins nombreuse
  conns.set(id, c); lastSeen.set(id, G.time);
  G.humans.push({ id, team, sel: null });
  c.on('data', m => { lastSeen.set(id, G.time); if (m && typeof m === 'object') hostOnData(id, m); });
  c.on('close', () => dropGuest(id, 'a quitté la partie'));
  c.on('error', () => dropGuest(id, 'a perdu la connexion'));
  sendTo(id, { t: 'welcome', id });
  if (G.started && G.phase !== 'menu') updateSelected();
  broadcastRoom();
}
function dropGuest(id, why) {
  if (!conns.has(id)) return;
  try { conns.get(id).close(); } catch (e) { }
  conns.delete(id); lastSeen.delete(id);
  const h = humanById(id);
  G.humans = G.humans.filter(o => o.id !== id);
  if (G.readyIds) G.readyIds.delete(id);
  if (h) flash(humanLabel(h) + ' ' + why);
  if (G.started) { updateSelected(); tryStartOnline(); }
  broadcastRoom();
}
const roomState = () => ({ t: 'room', started: !!G.started, hum: G.humans.map(h => [h.id, h.team]) });
function broadcastRoom() { netSend(roomState()); renderRoom(); refreshCaptainUI(); }
function setTeam(id, team) {
  const h = humanById(id);
  if (!h || h.team === team || teamHumans(team).length >= MAX_PER_TEAM) return;
  if (G.started && G.phase === 'play') return;              // pas pendant un point
  h.team = team; h.sel = null;
  if (G.readyIds) G.readyIds.delete(id);
  broadcastRoom();
}
function startOnline() {
  if (G.net !== 'host') return;
  G.started = true; G.score = [0, 0]; G.receiving = 0; G.phase = 'menu';
  broadcastRoom();
  placeForPoint();
  showMenu('first');
}

// messages des invités
function hostOnData(id, m) {
  const h = humanById(id);
  if (!h) return;
  switch (m.t) {
    case 'hello': sendTo(id, { t: 'welcome', id }); sendTo(id, roomState()); if (G.started && G.menuShown) sendTo(id, { t: 'menu', kind: G.lastMenu || 'first', score: G.score, rec: G.receiving, wind: G.wind }); break;
    case 'team': setTeam(id, m.team === 1 ? 1 : 0); break;
    case 'in': Object.assign(inputOf(h), { x: +m.x || 0, y: +m.y || 0, down: !!m.down, last: G.time }); break;
    case 'throw': if (G.phase === 'play' && throwerHuman() === h) throwDisc(disc.holder, +m.x, +m.y, clamp(+m.curve || 0, -1, 1), 1); break;
    case 'dive': diveFor(h, +m.x, +m.y); break;
    case 'switch': { const n = switchTarget(h); if (n) selectFor(h, n); break; }
    case 'select': selectFor(h, players[m.i | 0]); break;
    case 'call': callFor(h, +m.x, +m.y); break;
    case 'pull': if (G.phase === 'pull' && G.pull && captain(G.pull.team) === h) launchPull(+m.x, +m.y, m.curve, m.q); break;
    case 'ready':
      if (captain(h.team) === h) { h.cfg = Object.assign({}, DEFAULT_CFG, m.cfg); (G.readyIds = G.readyIds || new Set()).add(id); }
      refreshCaptainUI(); tryStartOnline(); break;
  }
}
const idx = p => (p ? players.indexOf(p) : -1);
const r2 = v => Math.round(v * 100) / 100;
function snapshot() {
  return {
    t: 's', fx: FX.out.splice(0),
    p: players.map(p => [r2(p.x), r2(p.y), r2(p.vx), r2(p.vy), p.dive > 0 ? 1 : 0, p.down > 0 ? 1 : 0, p.tag, p.state, p.role, r2(p.cx), r2(p.cy), idx(p.match)]),
    d: [disc.mode, idx(disc.holder), r2(disc.x), r2(disc.y), r2(disc.sx), r2(disc.sy), r2(disc.cx), r2(disc.cy), r2(disc.ex), r2(disc.ey), r2(disc.t), r2(disc.dur), idx(disc.intended)],
    g: { score: G.score, off: G.off, phase: G.phase, stall: r2(G.stall), mk: idx(G.marker), msg: G.msg, mid: G.msgId,
      dbl: idx(G.dbl), wind: G.wind, gt: r2(G.gt), rec: G.receiving, speed: G.form.speed,
      hum: G.humans.map(h => [h.id, h.team, idx(h.sel)]),
      op: G.oplay && { type: G.oplay.type, team: G.oplay.team }, dp: G.dplay && { type: G.dplay.type, team: G.dplay.team },
      order: [G.order[0].map(idx), G.order[1].map(idx)], cfg: [cfg(0), cfg(1)], carry: G.carryTo,
      pull: G.phase === 'pull' && G.pull ? G.pull.team : -1 }
  };
}

// =====================================================================
//  Invité
// =====================================================================
function joinGame(code) {
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
      const to = setTimeout(() => fail(ICE_FAIL_MSG), 20000);
      setTimeout(() => {
        if (!opened) $('joinStatus').textContent = 'Partie trouvée, établissement de la connexion…';
        watchIce(c, () => { clearTimeout(to); fail(ICE_FAIL_MSG); });
      }, 1500);
      c.on('open', () => {
        opened = true; clearTimeout(to);
        hostConn = c; lastRecv = G.time;
        c.on('data', m => { lastRecv = G.time; if (m && typeof m === 'object') guestOnData(m); });
        c.on('close', () => { if (hostConn === c) netError('La connexion avec l’hôte a été perdue.'); });
        c.on('error', () => { if (hostConn === c) netError('Erreur de connexion avec l’hôte.'); });
        G.net = 'guest'; G.score = [0, 0]; G.receiving = 0; G.phase = 'menu';
        $('joinStatus').textContent = 'Connecté !';
        lastMid = -1;
        netSend({ t: 'hello' });
      });
    });
    p.on('error', err => {
      const t = err && err.type;
      if (hostConn) return;
      if (t === 'peer-unavailable') netError('Aucune partie trouvée avec ce code. Vérifie le code, et que la page de l’hôte est toujours ouverte au premier plan.');
      else if (t === 'network' || t === 'socket-error' || t === 'server-error') netError('Le service de mise en relation ne répond pas. Réessaie dans un instant.');
      else netError('Connexion impossible (' + (t || 'réseau') + ').');
    });
  }).catch(() => netError('Impossible de charger le module réseau. Vérifie ta connexion.'));
}
function applyHumans(list) {
  const old = new Map(G.humans.map(h => [h.id, h]));
  G.humans = list.map(([id, team, si]) => Object.assign(old.get(id) || { id }, { team, sel: si >= 0 ? players[si] : null }));
  syncMe();
}
function guestOnData(m) {
  switch (m.t) {
    case 's': applySnapshot(m); break;
    case 'welcome': G.myId = m.id; showRoom(); break;
    case 'full': netError('La partie est complète (5 joueurs par équipe).'); break;
    case 'room':
      applyHumans(m.hum.map(([id, team]) => [id, team, -1]));
      G.started = m.started; hudKey = '';
      if (!G.started) { showRoom(); renderRoom(); }
      refreshCaptainUI();
      break;
    case 'wind': G.wind = m.wind; hudKey = ''; refreshOptions(); break;
    case 'menu':
      G.score = m.score; G.receiving = m.rec; G.wind = m.wind;
      if (m.kind === 'over') G.phase = 'over';
      showMenu(m.kind);
      break;
    case 'start':
      G.phase = 'pull'; G.menuShown = false; G.receiving = m.r;
      G.pull = { team: 1 - m.r, t: 0 }; G.pullUI = { stage: 'aim', t0: 0, x: 0, y: 0, q: 0 };
      G.curve = 0; $('curveRange').value = 0;
      $('overlay').classList.add('hidden');
      pullFlash();
      break;
  }
}
// battement de cœur : un joueur muet pendant 8 s est considéré comme parti
function netHeartbeat(dt) {
  if (!G.net) return;
  pingT += dt;
  if (pingT > 1) { pingT = 0; netSend({ t: 'ping' }); }
  if (G.net === 'guest' && hostConn && G.time - lastRecv > 8) netError('L’hôte ne répond plus : la partie est terminée.');
  if (G.net === 'host') for (const [id, t] of lastSeen) if (G.time - t > 8) dropGuest(id, 'ne répond plus');
}
window.addEventListener('beforeunload', () => {
  for (const c of conns.values()) { try { c.close(); } catch (e) { } }
  try { if (hostConn) hostConn.close(); } catch (e) { }
});

function applySnapshot(m) {
  if (m.fx) for (const e of m.fx) fxPlay(e[0], e[1], e[2], e[3]);
  snapAt = G.time;
  m.p.forEach((a, i) => {
    const p = players[i];
    if (p.nx === undefined) { p.x = a[0]; p.y = a[1]; }
    p.nx = a[0]; p.ny = a[1]; p.vx = a[2]; p.vy = a[3]; p.dive = a[4] ? 1 : 0; p.down = a[5] ? 1 : 0;
    p.tag = a[6]; p.state = a[7]; p.role = a[8]; p.cx = a[9]; p.cy = a[10]; p.match = a[11] >= 0 ? players[a[11]] : null;
  });
  const d = m.d;
  disc.mode = d[0]; disc.holder = d[1] >= 0 ? players[d[1]] : null;
  disc.nx = d[2]; disc.ny = d[3];
  [disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey] = d.slice(4, 10);
  disc.netT = d[10]; disc.dur = d[11]; disc.intended = d[12] >= 0 ? players[d[12]] : null;
  const g = m.g;
  G.score = g.score; G.off = g.off; G.stall = g.stall; G.marker = g.mk >= 0 ? players[g.mk] : null;
  G.dbl = g.dbl >= 0 ? players[g.dbl] : null; G.carryTo = g.carry || null;
  G.wind = g.wind; G.gt = g.gt; G.receiving = g.rec; G.form.speed = g.speed;
  applyHumans(g.hum);
  G.oplay = g.op; G.dplay = g.dp; G.netCfg = g.cfg;
  G.order = g.order.map(o => o.map(i => players[i]));
  if (g.phase === 'pull' && (G.phase !== 'pull' || !G.pull)) { G.pull = { team: g.pull, t: 0 }; G.pullUI = { stage: 'aim', t0: 0, x: 0, y: 0, q: 0 }; }
  if (g.phase !== G.phase) { G.phase = g.phase; if (g.phase !== 'play') G.aiming = false; }
  if (lastMid === -1) lastMid = g.mid;
  else if (g.mid !== lastMid) { lastMid = g.mid; if (g.msg) flash(g.msg, true); }
}
// l'invité ne simule rien : il lisse les positions reçues
function guestFrame(dt) {
  const since = Math.min(0.15, G.time - snapAt), k = Math.min(1, dt * 14), sp = SPEEDS[G.form.speed];
  for (const p of players) {
    if (p.nx === undefined) continue;
    const tx = p.nx + p.vx * since * sp, ty = p.ny + p.vy * since * sp;
    p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
  }
  if (disc.mode === 'air') {
    const u = Math.min(1, (disc.netT + since * sp) / disc.dur);
    [disc.x, disc.y] = bez(disc.sx, disc.sy, disc.cx, disc.cy, disc.ex, disc.ey, u);
    disc.z = Math.sin(Math.PI * u) * peakOf(disc.dur);
  } else if ((disc.mode === 'held' || disc.mode === 'carry') && disc.holder) { disc.x = disc.holder.x; disc.y = disc.holder.y; disc.z = 0; }
  else if (disc.nx !== undefined) { disc.x = disc.nx; disc.y = disc.ny; disc.z = 0; }
}

// =====================================================================
//  Lobby (salle d'attente : choix des équipes)
// =====================================================================
function showRoom() {
  G.menuShown = true;
  $('lobbyCard').style.display = ''; $('stratCard').style.display = 'none';
  for (const id of ['lobbyHome', 'lobbyJoin']) $(id).style.display = 'none';
  $('lobbyRoom').style.display = '';
  const host = G.net === 'host' || !G.net;
  $('roomCodeBox').style.display = host ? '' : 'none';
  $('startOnline').style.display = host ? '' : 'none';
  $('overlay').classList.remove('hidden');
  renderRoom();
}
function renderRoom(note) {
  if (!$('rosterB')) return;
  for (const t of [0, 1]) {
    const ul = $(t === 0 ? 'rosterB' : 'rosterR');
    const hs = teamHumans(t);
    ul.innerHTML = hs.length ? hs.map(h => `<li>${humanLabel(h)}${h.id === 0 ? ' (hôte)' : ''}${h.id === G.myId ? ' — <b>toi</b>' : ''}${captain(t) === h ? ' · capitaine' : ''}</li>`).join('')
      : '<li class="ai">IA</li>';
    const me = meH();
    $('teamB' + t).disabled = !me || me.team === t || hs.length >= MAX_PER_TEAM;
  }
  const n = G.humans.length;
  $('hostStatus').textContent = note || (G.net === 'host'
    ? (n > 1 ? `${n} joueurs connectés. Lance la partie quand tout le monde est là.` : 'En attente de joueurs… (tu peux aussi lancer seul contre l’IA)')
    : 'En attente que l’hôte lance la partie…');
}
function chooseTeam(t) {
  if (G.net === 'guest') netSend({ t: 'team', team: t });
  else if (G.net === 'host') setTeam(0, t);
}

$('soloB').addEventListener('click', () => { backToSolo(); showMenu('first'); });
$('hostB').addEventListener('click', hostGame);
$('joinB').addEventListener('click', () => {
  $('lobbyHome').style.display = 'none'; $('lobbyJoin').style.display = ''; $('lobbyErr').textContent = '';
  $('joinStatus').textContent = ''; $('joinCode').focus();
});
$('joinGo').addEventListener('click', () => joinGame($('joinCode').value));
$('teamB0').addEventListener('click', () => chooseTeam(0));
$('teamB1').addEventListener('click', () => chooseTeam(1));
$('startOnline').addEventListener('click', startOnline);
$('copyLink').addEventListener('click', () => {
  if (!G.inviteUrl) return;
  const done = () => { $('copyLink').textContent = 'Lien copié ✓'; setTimeout(() => $('copyLink').textContent = 'Copier le lien d’invitation', 1500); };
  if (navigator.share && document.body.classList.contains('touch')) navigator.share({ title: 'Ultimate Frisbee', text: 'Rejoins ma partie !', url: G.inviteUrl }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(G.inviteUrl).then(done, () => prompt('Copie ce lien :', G.inviteUrl));
  else prompt('Copie ce lien :', G.inviteUrl);
});
for (const id of ['backB1', 'backB2']) $(id).addEventListener('click', () => { netError(''); });
