// Faux PeerJS pour tests locaux : BroadcastChannel entre onglets
(() => {
  const bc = new BroadcastChannel('fakepeer');
  const peers = {};
  class Emitter { constructor(){ this.h = {}; } on(e, f){ (this.h[e] = this.h[e] || []).push(f); } emit(e, ...a){ (this.h[e] || []).forEach(f => f(...a)); } }
  class Conn extends Emitter {
    constructor(self, other, cid){ super(); this.self = self; this.other = other; this.peer = other; this.cid = cid; this.open = false; }
    send(d){ bc.postMessage({ type: 'data', to: this.other, from: this.self, cid: this.cid, data: JSON.parse(JSON.stringify(d)) }); }
    close(){ if (!this.open) return; this.open = false; bc.postMessage({ type: 'close', to: this.other, cid: this.cid }); this.emit('close'); }
  }
  class Peer extends Emitter {
    constructor(id){ super(); if (id && typeof id === "object") id = null; this.id = id || ('p' + Math.random().toString(36).slice(2)); this.conns = {}; peers[this.id] = this;
      setTimeout(() => this.emit('open', this.id), 50); }
    connect(to){ const cid = Math.random().toString(36).slice(2); const c = new Conn(this.id, to, cid); this.conns[cid] = c;
      bc.postMessage({ type: 'connect', to, from: this.id, cid });
      this._t = setTimeout(() => { if (!c.open) this.emit('error', { type: 'peer-unavailable' }); }, 2000);
      return c; }
    destroy(){ delete peers[this.id]; }
  }
  bc.onmessage = ev => {
    const m = ev.data, p = peers[m.to]; if (!p) return;
    if (m.type === 'connect') { const c = new Conn(p.id, m.from, m.cid); p.conns[m.cid] = c; p.emit('connection', c);
      setTimeout(() => { c.open = true; c.emit('open'); bc.postMessage({ type: 'ack', to: m.from, cid: m.cid }); }, 30); }
    else if (m.type === 'ack') { const c = p.conns[m.cid]; if (c) { clearTimeout(p._t); c.open = true; c.emit('open'); } }
    else if (m.type === 'data') { const c = p.conns[m.cid]; if (c && c.open) c.emit('data', m.data); }
    else if (m.type === 'close') { const c = p.conns[m.cid]; if (c && c.open) { c.open = false; c.emit('close'); } }
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
