// pwa.js — Jeu installable (écran d'accueil, plein écran, solo hors connexion)
// Le service worker (sw.js) garde une copie des fichiers : réseau d'abord, copie si pas de connexion.

(function () {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return;
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => {        // Android / ordinateur : bouton « Installer »
    e.preventDefault(); deferred = e;
    const b = document.getElementById('installB'); if (b) b.style.display = '';
  });
  window.addEventListener('appinstalled', () => { const b = document.getElementById('installB'); if (b) b.style.display = 'none'; deferred = null; });
  const b = document.getElementById('installB');
  if (b) b.addEventListener('click', () => {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(() => { deferred = null; b.style.display = 'none'; });
  });
  // iPhone / iPad : pas de bouton possible, on explique comment faire
  const standalone = window.matchMedia && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const hint = document.getElementById('iosHint');
  if (hint && ios && !standalone) hint.style.display = '';
  if (standalone) document.body.classList.add('installed');   // déjà en plein écran : le bouton ⛶ ne sert plus
})();
