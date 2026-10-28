// Faux PeerJS pour tests locaux : BroadcastChannel entre onglets.
// Réseau difficile, réglable par onglet avec window.FAKENET :
//   lag / jitter (ms) : retard de ce que cet onglet envoie (l'ordre est gardé, comme une liaison fiable de PeerJS) ;
//   down : wifi coupé — rien ne part ni n'arrive (tout attend et repart d'un coup au retour, comme les tampons de
//          WebRTC) et la liaison avec le service de mise en relation tombe (peer.disconnected, puis 'disconnected') ;
//   FAKENET.fail() : la liaison directe échoue (ICE « failed ») : PeerJS ferme les connexions des deux côtés.
(() => {
  const bc = new BroadcastChannel('fakepeer');
  const peers = {};
  const NET = window.FAKENET = { lag: 0, jitter: 0, down: false, sent: 0 };
  let lastAt = 0; const outQ = [], inQ = [];
  const now = () => performance.now();
  function post(msg, raw) {                                   // raw : messages du « service » (pas du réseau direct)
    if (raw) { bc.postMessage(msg); return; }
    if (NET.down) { outQ.push(msg); return; }
    NET.sent++;
    const at = Math.max(lastAt, now() + NET.lag + Math.random() * NET.jitter); lastAt = at;
    const d = at - now(); if (d <= 1) bc.postMessage(msg); else setTimeout(() => bc.postMessage(msg), d);
  }
  let wasDown = false;
  setInterval(() => {                                         // passage coupé ↔ rétabli
    if (NET.down && !wasDown) { wasDown = true; for (const p of Object.values(peers)) if (!p.disconnected) { p.disconnected = true; p.open = false; p.emit('disconnected', p.id); } }
    if (!NET.down && wasDown) { wasDown = false; outQ.splice(0).forEach(m => post(m)); inQ.splice(0).forEach(m => handle(m)); }
  }, 20);
  class Emitter { constructor(){ this.h = {}; } on(e, f){ (this.h[e] = this.h[e] || []).push(f); } emit(e, ...a){ (this.h[e] || []).forEach(f => f(...a)); } }
  class Conn extends Emitter {
    constructor(self, other, cid){ super(); this.self = self; this.other = other; this.peer = other; this.cid = cid; this.open = false; }
    send(d){ post({ type: 'data', to: this.other, from: this.self, cid: this.cid, data: JSON.parse(JSON.stringify(d)) }); }
    close(){ if (!this.open) return; this.open = false; post({ type: 'close', to: this.other, cid: this.cid }, true); this.emit('close'); }
  }
  class Peer extends Emitter {
    constructor(id){ super(); if (id && typeof id === "object") id = null; this.id = id || ('p' + Math.random().toString(36).slice(2)); this.conns = {}; peers[this.id] = this;
      this.disconnected = false; this.destroyed = false; this.open = false;
      setTimeout(() => { this.open = true; this.emit('open', this.id); }, 50); }
    connect(to){ const cid = Math.random().toString(36).slice(2); const c = new Conn(this.id, to, cid); this.conns[cid] = c;
      if (this.disconnected) { setTimeout(() => this.emit('error', { type: 'disconnected' }), 10); return c; }
      post({ type: 'connect', to, from: this.id, cid }, true);
      // pas de réponse : le service dit si ce pair existe encore (« peer-unavailable »), même s'il est momentanément coupé
      setTimeout(() => { if (c.open) return; const k = Math.random().toString(36).slice(2); this._probe = k; post({ type: 'probe', to, from: this.id, k }, true);
        setTimeout(() => { if (!c.open && this._probe === k) this.emit('error', { type: 'peer-unavailable' }); }, 300); }, 2000);
      return c; }
    reconnect(){ if (this.destroyed || !this.disconnected) return; setTimeout(() => { if (NET.down || this.destroyed) { this.emit('error', { type: 'network' }); this.emit('disconnected', this.id); return; } this.disconnected = false; this.open = true; this.emit('open', this.id); }, 60); }
    destroy(){ this.destroyed = true; delete peers[this.id]; }
  }
  NET.fail = () => { for (const p of Object.values(peers)) for (const c of Object.values(p.conns)) if (c.open) { c.open = false; post({ type: 'close', to: c.other, cid: c.cid }, true); c.emit('error', { type: 'negotiation-failed' }); c.emit('close'); } };
  function handle(m) {
    const p = peers[m.to]; if (!p) return;
    if (m.type === 'connect') { const c = new Conn(p.id, m.from, m.cid); p.conns[m.cid] = c; p.emit('connection', c);
      setTimeout(() => { c.open = true; c.emit('open'); post({ type: 'ack', to: m.from, cid: m.cid }, true); }, 30); }
    else if (m.type === 'ack') { const c = p.conns[m.cid]; if (c) { c.open = true; c.emit('open'); } }
    else if (m.type === 'data') { const c = p.conns[m.cid]; if (c && c.open) c.emit('data', m.data); }
    else if (m.type === 'close') { const c = p.conns[m.cid]; if (c && c.open) { c.open = false; c.emit('close'); } }
  }
  bc.onmessage = ev => {
    const m = ev.data;
    if (m.type === 'probe') { if (peers[m.to]) bc.postMessage({ type: 'here', to: m.from, k: m.k }); return; }
    if (m.type === 'here') { const p = peers[m.to]; if (p && p._probe === m.k) p._probe = null; return; }
    if (!peers[m.to]) return;
    if (NET.down && m.type !== 'close') { inQ.push(m); return; }   // coupé : ça attend (une fermeture, elle, finit par se voir)
    handle(m);
  };
  window.Peer = Peer;
})();

// garde-fou des tests : une position ou une vitesse invalide (NaN) chez un joueur ou le disque devient une erreur de la
// page, avec ce qu'il faut pour en trouver la cause (une seule fois par page)
window.addEventListener('load', () => {
  if (typeof update !== 'function') return;
  const bad = v => typeof v === 'number' && !Number.isFinite(v);
  let done = false;
  const check = where => {
    if (done || typeof players === 'undefined') return;
    const p = players.find(q => [q.x, q.y, q.vx, q.vy].some(v => !Number.isFinite(v)) || [q.tx, q.ty].some(bad));
    const d = [disc.x, disc.y].some(v => !Number.isFinite(v)) || [disc.ex, disc.ey].some(bad);
    if (!p && !d) return;
    done = true;
    const info = { where, net: G.net, phase: G.phase, mode: disc.mode, holder: disc.holder && players.indexOf(disc.holder), p: p && { i: players.indexOf(p), team: p.team, x: p.x, y: p.y, vx: p.vx, vy: p.vy, tx: p.tx, ty: p.ty, sp: p.sp, state: p.state, role: p.role, ctl: !!(typeof controllerOf === 'function' && controllerOf(p)) },
      disc: { x: disc.x, y: disc.y, ex: disc.ex, ey: disc.ey, t: disc.t, dur: disc.dur } };
    setTimeout(() => { throw new Error('position invalide : ' + JSON.stringify(info)); }, 0);
  };
  const u = update; update = function (dt) { u(dt); check('update'); };
  if (typeof guestFrame === 'function') { const g = guestFrame; guestFrame = function (dt) { g(dt); check('guestFrame'); }; }
});
