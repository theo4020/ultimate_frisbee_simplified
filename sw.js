// sw.js — Service worker : le jeu reste jouable en solo sans connexion.
// Stratégie « réseau d'abord » : en ligne on charge toujours la dernière version, hors ligne on sert la copie.
const CACHE = 'ultimate-frisbee-v61';
const FILES = [
  './',
  'index.html',
  'css/style.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'js/news.js',
  'js/secrets.js',
  'js/config.js',
  'js/util.js',
  'js/state.js',
  'js/humans.js',
  'js/teams.js',
  'js/wind.js',
  'js/predict.js',
  'js/vision.js',
  'js/offense.js',
  'js/defense.js',
  'js/systems.js',
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
  'js/render-iso.js',
  'js/ui.js',
  'js/series.js',
  'js/endless.js', 'js/coop.js',
  'js/practice.js',
  'js/achievements.js',
  'js/style.js',
  'js/audio.js',
  'sounds/cheer.mp3',
  'sounds/cheer-short.mp3',
  'sounds/ooh.mp3',
  'sounds/sigh.mp3',
  'sounds/murmur.mp3',
  'sounds/whistle.mp3',
  'sounds/catch.mp3',
  'sounds/throw.mp3',
  'js/tuto.js',
  'js/ctrl.js',
  'js/controls.js',
  'js/gestures.js',
  'js/menu.js',
  'js/account.js',
  'js/editor.js',
  'js/gallery.js',
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
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;   // PeerJS, relais, /api : réseau seulement
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
