// net.js — Multijoueur en ligne (PeerJS)

// =====================================================================
//  Multijoueur en ligne (PeerJS : connexion directe entre les deux navigateurs)
//  L'hôte fait tourner la partie et envoie l'état ~20 fois par seconde.
//  L'invité envoie seulement ses actions (pointeur, lancer, layout, switch).
// =====================================================================
let peer = null, conn = null, netT = 0, inT = 0, lastMid = 0, snapAt = 0, lastRecv = 0, pingT = 0;
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
function netSend(msg) { if (conn && conn.open) { try { conn.send(msg); } catch (e) { } } }
function sendInput(force) {
  if (G.net !== 'guest') return;
  if (!force && G.time - inT < 0.033) return;
  inT = G.time;
  netSend({ t: 'in', x: +G.pointer.x.toFixed(2), y: +G.pointer.y.toFixed(2), down: G.pointer.down });
}
function netError(msg) {
  try { if (conn) conn.close(); } catch (e) { }
  try { if (peer) peer.destroy(); } catch (e) { }
  peer = conn = null;
  backToSolo();
  showLobby(msg);
}
function backToSolo() {
  G.net = null; G.me = 0; G.ctrl = ['local', 'ai']; G.phase = 'menu';
  G.score = [0, 0]; G.receiving = 0; hudKey = '';
  placeForPoint();
}
function wireConn(c) {
  conn = c; lastRecv = G.time;
  c.on('data', onNetData);
  c.on('close', () => { if (conn === c) netError('La connexion avec l’adversaire a été perdue.'); });
  c.on('error', () => { if (conn === c) netError('Erreur de connexion avec l’adversaire.'); });
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
  const check = () => { if (pc.iceConnectionState === 'failed') onFail(); };
  pc.addEventListener('iceconnectionstatechange', check);
}
const ICE_FAIL_MSG = 'La partie a bien été trouvée, mais vos deux réseaux bloquent la connexion directe (fréquent en 4G/5G ou sur un wifi d’entreprise). Essayez tous les deux sur le même wifi, ou configurez un relais TURN (voir README : secrets TURN_USER / TURN_PASS).';

function hostGame() {
  $('lobbyHome').style.display = 'none'; $('lobbyHost').style.display = ''; $('lobbyErr').textContent = '';
  $('hostStatus').textContent = 'Connexion au service…'; $('hostCode').textContent = '····';
  const code = newCode();
  makePeer(PEER_PREFIX + code).then(p => {
    peer = p;
    p.on('open', () => {
      $('hostCode').textContent = code;
      $('hostStatus').textContent = 'En attente de ton adversaire… Garde cette page ouverte.';
      G.inviteUrl = location.href.split('#')[0] + '#join=' + code;
    });
    p.on('connection', c => {
      if (conn && conn.open) { c.on('open', () => c.close()); return; }   // une seule partie à la fois
      $('hostStatus').textContent = 'Un adversaire se connecte…';
      let opened = false;
      const to = setTimeout(() => { if (!opened) $('hostStatus').textContent = 'L’adversaire n’arrive pas à se connecter (réseau). En attente…'; }, 15000);
      setTimeout(() => watchIce(c, () => { if (!opened) $('hostStatus').textContent = 'La connexion directe a échoué (réseau). En attente d’un nouvel essai…'; }), 0);
      c.on('open', () => {
        opened = true; clearTimeout(to);
        wireConn(c);
        G.net = 'host'; G.me = 0; G.ctrl = ['local', 'remote'];
        G.score = [0, 0]; G.receiving = 0; G.phase = 'menu';
        placeForPoint();
        showMenu('first');
      });
    });
    p.on('error', err => {
      const t = err && err.type;
      if (t === 'unavailable-id') { p.destroy(); hostGame(); return; }
      if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') {
        if (!conn) $('hostStatus').textContent = 'Liaison avec le service perdue, reconnexion…';
        return;                                             // 'disconnected' relance la connexion
      }
      if (conn) return;                                     // la partie est déjà en cours
      netError('Impossible de créer la partie (' + (t || 'réseau') + ').');
    });
  }).catch(() => netError('Impossible de charger le module réseau. Vérifie ta connexion.'));
}
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
      const fail = msg => { if (!opened && !conn) netError(msg); };
      const to = setTimeout(() => fail(ICE_FAIL_MSG), 20000);
      setTimeout(() => {
        if (!opened) $('joinStatus').textContent = 'Partie trouvée, établissement de la connexion…';
        watchIce(c, () => { clearTimeout(to); fail(ICE_FAIL_MSG); });
      }, 1500);
      c.on('open', () => {
        opened = true; clearTimeout(to);
        wireConn(c);
        G.net = 'guest'; G.me = 1; G.ctrl = ['remote', 'local'];
        G.score = [0, 0]; G.receiving = 0; G.phase = 'menu';
        $('joinStatus').textContent = 'Connecté !';
        lastMid = -1;
        netSend({ t: 'hello' });                             // l'hôte répond avec le menu du premier point
      });
    });
    p.on('error', err => {
      const t = err && err.type;
      if (conn) return;
      if (t === 'peer-unavailable') netError('Aucune partie trouvée avec ce code. Vérifie le code, et que la page de l’hôte est toujours ouverte au premier plan.');
      else if (t === 'network' || t === 'socket-error' || t === 'server-error') netError('Le service de mise en relation ne répond pas. Réessaie dans un instant.');
      else netError('Connexion impossible (' + (t || 'réseau') + ').');
    });
  }).catch(() => netError('Impossible de charger le module réseau. Vérifie ta connexion.'));
}

// ---------- côté hôte : messages de l'invité ----------
function hostOnData(m) {
  if (m.t === 'hello') { netSend({ t: 'menu', kind: 'first', score: G.score, rec: G.receiving, wind: G.wind }); if (G.ready[0]) $('oppReady').textContent = ''; }
  else if (m.t === 'in') { G.rin.x = m.x; G.rin.y = m.y; G.rin.down = !!m.down; G.rin.last = G.time; }
  else if (m.t === 'throw') { if (G.phase === 'play' && G.off === 1 && disc.mode === 'held') throwDisc(disc.holder, m.x, m.y, clamp(+m.curve || 0, -1, 1), 1); }
  else if (m.t === 'dive') doDive(1, m.x, m.y);
  else if (m.t === 'switch') doSwitch(1);
  else if (m.t === 'select') doSelect(1, players[m.i | 0]);
  else if (m.t === 'pull') { if (G.phase === 'pull' && G.pull && G.pull.team === 1) launchPull(m.x, m.y, m.curve, m.q); }
  else if (m.t === 'ready') {
    G.remoteCfg = Object.assign({}, G.remoteCfg, m.cfg); G.ready[1] = true;
    $('oppReady').textContent = 'L’adversaire est prêt ✓';
    tryStartOnline();
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
      dbl: idx(G.dbl), wind: G.wind, gt: r2(G.gt), sel: [idx(G.sel[0]), idx(G.sel[1])], rec: G.receiving, speed: G.form.speed,
      op: G.oplay && { type: G.oplay.type, team: G.oplay.team }, dp: G.dplay && { type: G.dplay.type, team: G.dplay.team },
      order: [G.order[0].map(idx), G.order[1].map(idx)], cfg: myCfg(), pull: G.phase === 'pull' && G.pull ? G.pull.team : -1 }
  };
}

// ---------- côté invité : messages de l'hôte ----------
function guestOnData(m) {
  if (m.t === 's') applySnapshot(m);
  else if (m.t === 'wind') { G.wind = m.wind; hudKey = ''; refreshOptions(); }
  else if (m.t === 'menu') {
    G.score = m.score; G.receiving = m.rec; G.wind = m.wind;
    if (m.kind === 'over') G.phase = 'over';
    showMenu(m.kind);
  }
  else if (m.t === 'start') {
    G.phase = 'pull'; G.menuShown = false; G.receiving = m.r;
    G.pull = { team: 1 - m.r, t: 0 }; G.pullUI = { stage: 'aim', t0: 0, x: 0, y: 0, q: 0 };
    G.curve = 0; $('curveRange').value = 0;
    $('overlay').classList.add('hidden');
    pullFlash();
  }
}
function onNetData(m) { if (!m || typeof m !== 'object') return; lastRecv = G.time; if (G.net === 'host') hostOnData(m); else guestOnData(m); }
// battement de cœur : si l'autre ne donne plus signe de vie pendant 8 s, on considère la partie terminée
function netHeartbeat(dt) {
  if (!G.net || !conn) return;
  pingT += dt;
  if (pingT > 1) { pingT = 0; netSend({ t: 'ping' }); }
  if (G.time - lastRecv > 8) netError('L’adversaire ne répond plus : la partie est terminée.');
}
window.addEventListener('beforeunload', () => { try { if (conn) conn.close(); } catch (e) { } });

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
  G.dbl = g.dbl >= 0 ? players[g.dbl] : null;
  G.wind = g.wind; G.gt = g.gt; G.receiving = g.rec; G.form.speed = g.speed;
  G.sel = g.sel.map(i => (i >= 0 ? players[i] : null));
  G.oplay = g.op; G.dplay = g.dp; G.remoteCfg = g.cfg;
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
  } else if (disc.mode === 'held' && disc.holder) { disc.x = disc.holder.x; disc.y = disc.holder.y; disc.z = 0; }
  else if (disc.nx !== undefined) { disc.x = disc.nx; disc.y = disc.ny; disc.z = 0; }
}

// ---------- lobby ----------
$('soloB').addEventListener('click', () => { backToSolo(); showMenu('first'); });
$('hostB').addEventListener('click', hostGame);
$('joinB').addEventListener('click', () => {
  $('lobbyHome').style.display = 'none'; $('lobbyJoin').style.display = ''; $('lobbyErr').textContent = '';
  $('joinStatus').textContent = ''; $('joinCode').focus();
});
$('joinGo').addEventListener('click', () => joinGame($('joinCode').value));
$('copyLink').addEventListener('click', () => {
  if (!G.inviteUrl) return;
  const done = () => { $('copyLink').textContent = 'Lien copié ✓'; setTimeout(() => $('copyLink').textContent = 'Copier le lien d’invitation', 1500); };
  if (navigator.share && document.body.classList.contains('touch')) navigator.share({ title: 'Ultimate Frisbee', text: 'Rejoins ma partie !', url: G.inviteUrl }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(G.inviteUrl).then(done, () => prompt('Copie ce lien :', G.inviteUrl));
  else prompt('Copie ce lien :', G.inviteUrl);
});
for (const id of ['backB1', 'backB2']) $(id).addEventListener('click', () => { netError(''); });

