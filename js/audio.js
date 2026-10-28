// audio.js — Musique et ambiance, entièrement synthétisées (aucun fichier) : une petite boucle entraînante dans les menus
// (et en match si on le veut), et un public qui murmure, s'emballe sur un long huck et réagit aux beaux gestes.
// Tout passe par trois volumes (effets, musique, public) branchés sur le même contexte audio que fx.js ; le bouton 🔊
// coupe tout. Réglages dans Commandes (CTRL.music : 'off' | 'menus' | 'tout', CTRL.crowd : true / false).

const AU = { bus: null, music: null, crowd: null, crowdF: null, crowdSrc: null, next: 0, step: 0, bar: 0, playing: false, swell: 0, timer: null, mLevel: 0 };
const MUSIC_VOL = 0.45, CROWD_VOL = 0.05;

// sorties : les effets (fx.js) passent par AU.bus.sfx ; la musique et le public ont leur propre volume
function auBuses(a) {
  if (AU.bus && AU.bus.ctx === a) return AU.bus;
  const sfx = a.createGain(), music = a.createGain(), crowd = a.createGain();
  sfx.connect(a.destination); music.connect(a.destination); crowd.connect(a.destination);
  music.gain.value = 0; crowd.gain.value = 0;
  AU.bus = { ctx: a, sfx, music, crowd };
  return AU.bus;
}
const sfxOut = a => auBuses(a).sfx;

// ---------- la musique : une boucle pop-funk légère, 100 battements par minute ----------
// 4 accords (Do, Sol, La mineur, Fa), 16 doubles-croches par mesure ; batterie, basse, arpège et une petite mélodie
const BPM = 100, STEP = 60 / BPM / 4;
const CHORDS = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]];          // notes MIDI (basse)
const PENTA = [72, 74, 76, 79, 81, 84];                                            // gamme pentatonique (mélodie)
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
let melody = [];
function newMelody() {                                       // une phrase de 2 mesures, renouvelée toutes les 8 mesures
  melody = [];
  let i = 2;
  for (let s = 0; s < 32; s++) {
    if (s % 2 === 0 && Math.random() < 0.55) { i = Math.max(0, Math.min(PENTA.length - 1, i + Math.round((Math.random() - 0.5) * 3))); melody[s] = PENTA[i]; }
  }
}
function mNote(a, out, t, freq, dur, type, vol, cutoff) {
  const o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
  o.type = type; o.frequency.value = freq;
  f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff || 3000, t); f.frequency.exponentialRampToValueAtTime(Math.max(200, (cutoff || 3000) * 0.3), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
function mDrum(a, out, t, kind) {
  if (kind === 'kick') {
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.2); return;
  }
  if (!noiseBuf) noise(0.001, { vol: 0.0001 });             // (crée le tampon de bruit de fx.js)
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf;
  const clap = kind === 'clap', d = clap ? 0.14 : 0.04;
  f.type = clap ? 'bandpass' : 'highpass'; f.frequency.value = clap ? 1600 : 7000; f.Q.value = clap ? 0.8 : 0.5;
  g.gain.setValueAtTime(clap ? 0.28 : 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(f).connect(g).connect(out); src.start(t, Math.random() * 0.5); src.stop(t + d + 0.02);
}
function scheduleStep(a, out, s, t) {
  const bar = AU.bar, ch = CHORDS[bar % 4], ss = s % 16;
  if (ss === 0 && bar % 8 === 0) newMelody();
  if (ss === 0 || ss === 8 || (ss === 10 && bar % 2)) mDrum(a, out, t, 'kick');
  if (ss === 4 || ss === 12) mDrum(a, out, t, 'clap');
  if (ss % 2 === 0) mDrum(a, out, t, 'hat');
  if (ss === 0 || ss === 3 || ss === 8 || ss === 11 || ss === 14) mNote(a, out, t, midi(ch[0] - 12), STEP * 1.6, 'triangle', 0.22, 900);   // basse
  if (ss % 2 === 0) mNote(a, out, t, midi(ch[(ss / 2) % 3] + 12 + (ss >= 8 ? 12 : 0)), STEP * 1.4, 'square', 0.035, 2400);   // arpège
  if (bar % 4 >= 2) { const m = melody[(bar % 2) * 16 + ss]; if (m) mNote(a, out, t, midi(m), STEP * 2.5, 'triangle', 0.09, 5000); }   // mélodie
}
function musicTick() {
  const a = FX.ctx; if (!a || !AU.playing) return;
  const out = auBuses(a).music;
  if (AU.next < a.currentTime) AU.next = a.currentTime + 0.05;
  while (AU.next < a.currentTime + 0.15) {                   // on programme un peu d'avance (pas de trou si une image tarde)
    scheduleStep(a, out, AU.step, AU.next);
    AU.next += STEP; AU.step++;
    if (AU.step % 16 === 0) AU.bar++;
  }
}
function musicStart() { if (AU.playing) return; AU.playing = true; AU.step = 0; AU.bar = 0; AU.next = 0; AU.timer = setInterval(musicTick, 40); }
function musicStop() { AU.playing = false; if (AU.timer) clearInterval(AU.timer); AU.timer = null; }

// ---------- le public : un murmure continu qui s'emballe ----------
function crowdStart(a) {
  if (AU.crowdSrc) return;
  if (!noiseBuf) noise(0.001, { vol: 0.0001 });
  const src = a.createBufferSource(), f = a.createBiquadFilter(), f2 = a.createBiquadFilter();
  src.buffer = noiseBuf; src.loop = true;
  f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.7;   // voix lointaines
  f2.type = 'lowpass'; f2.frequency.value = 2200;
  src.connect(f).connect(f2).connect(auBuses(a).crowd); src.start();
  AU.crowdSrc = src; AU.crowdF = f;
}
function crowdStop() { if (AU.crowdSrc) { try { AU.crowdSrc.stop(); } catch (e) { } AU.crowdSrc = null; } }
// le public réagit : k de 0 à 1 (un huck qui part : 0,6 ; un point : 1)
function crowdSwell(k) { AU.swell = Math.max(AU.swell, k); }
function crowdClap(n, spread) {                             // applaudissements : des petits claquements au hasard
  for (let i = 0; i < n; i++) noise(0.04, { filter: 'highpass', freq: 1800 + Math.random() * 1500, vol: 0.035 + Math.random() * 0.03, delay: Math.random() * spread });
}

// ---------- à chaque image : qui joue, et à quel volume ----------
const inMatch = () => !G.attract && (G.phase === 'play' || G.phase === 'pull' || G.phase === 'between' || G.phase === 'over') && $('overlay').classList.contains('hidden');
function audioFrame(dt) {
  const a = FX.ctx;
  if (!a || FX.muted || (typeof document !== 'undefined' && document.hidden)) { musicStop(); crowdStop(); if (AU.bus) { AU.bus.music.gain.value = 0; AU.bus.crowd.gain.value = 0; } return; }
  const B = auBuses(a), match = inMatch(), mode = CTRL.music || 'menus';
  const wantMusic = mode === 'tout' || (mode === 'menus' && !match);
  const target = wantMusic ? MUSIC_VOL * (match ? 0.45 : 1) : 0;   // en match, la musique se fait discrète
  AU.mLevel += (target - AU.mLevel) * Math.min(1, dt * 2);    // fondu (environ 1 s)
  B.music.gain.value = AU.mLevel;
  if (target > 0) musicStart(); else if (AU.mLevel < 0.02) { musicStop(); AU.mLevel = 0; }
  // public
  const wantCrowd = CTRL.crowd !== false && match;
  if (wantCrowd) crowdStart(a);
  AU.swell = Math.max(0, AU.swell - dt * 0.35);
  const air = disc.mode === 'air' && !disc.pull ? Math.min(1, discLen() / 40) * (1 - Math.abs(disc.t / disc.dur - 0.6)) : 0;   // il retient son souffle sur un long vol
  const lvl = wantCrowd ? CROWD_VOL * (1 + 2.5 * Math.max(AU.swell, air * 0.8)) : 0;
  B.crowd.gain.value += (lvl - B.crowd.gain.value) * Math.min(1, dt * 4);
  if (AU.crowdF) AU.crowdF.frequency.value = 600 + 500 * Math.max(AU.swell, air);
  if (!wantCrowd && B.crowd.gain.value < 0.002) crowdStop();
}
