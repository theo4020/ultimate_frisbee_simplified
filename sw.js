// sw.js — Service worker : le jeu reste jouable en solo sans connexion.
// Stratégie « réseau d'abord » : en ligne on charge toujours la dernière version, hors ligne on sert la copie.
const CACHE = 'ultimate-frisbee-v1';
const FILES = [
  './',
  'index.html',
  'css/style.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'js/secrets.js',
  'js/config.js',
  'js/util.js',
  'js/state.js',
  'js/humans.js',
  'js/teams.js',
  'js/wind.js',
  'js/offense.js',
  'js/defense.js',
  'js/throwing.js',
  'js/stats.js',
  'js/events.js',
  'js/sim.js',
  'js/point.js',
  'js/plays.js',
  'js/fx.js',
  'js/pull.js',
  'js/replay.js',
  'js/render.js',
  'js/ui.js',
  'js/series.js',
  'js/practice.js',
  'js/achievements.js',
  'js/tuto.js',
  'js/controls.js',
  'js/gamepad.js',
  'js/net.js',
  'js/main.js',
  'js/pwa.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;   // PeerJS, relais… : réseau seulement
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
