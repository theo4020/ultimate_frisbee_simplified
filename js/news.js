// news.js — Nouveautés (fil d'annonces dans le menu principal) et déménagement du site vers sa nouvelle adresse.
// Chargé en premier : il reprend le profil apporté par le lien de déménagement avant que les autres fichiers ne le lisent.
//
// ➜ À CHAQUE NOUVELLE VERSION : ajouter une annonce EN HAUT de NEWS (id = le plus grand + 1).
//    Les joueurs voient un badge sur « Nouveautés » tant qu'ils ne l'ont pas ouverte.

const NEW_HOST = 'ultimate-frisbee-simplified.theosyle42.workers.dev';
const NEW_URL = 'https://' + NEW_HOST + '/';

const NEWS = [
  { id: 12, date: '2026-10-12', tag: 'Compte', title: 'Les comptes joueurs arrivent 👤',
    body: `Touche <b>👤 Créer un compte</b> à côté de ton pseudo. Ton pseudo t'est réservé (personne d'autre ne peut l'utiliser,
      au classement non plus), et ton profil, tes succès, tes records et tes réglages sont sauvegardés en ligne :
      connecte-toi sur un autre appareil pour tout retrouver. Ton mot de passe reste visible dans le panneau Compte.` },
  { id: 11, date: '2026-10-12', tag: 'Solo', title: 'Mode infini et classement mondial ♾️',
    body: `Nouveau dans <b>🤖 Solo</b> : le <b>mode infini</b>. Des matchs en 2 points contre des équipes de plus en plus fortes
      (elles progressent même pendant le match), jusqu'à ta première défaite. À la fin de ta série, entre ton pseudo pour l'inscrire au
      <b>classement mondial</b> (laisse vide pour ne pas l'enregistrer) : un pseudo n'a qu'une ligne, seul son meilleur score compte. Match rapide, mini-tournoi et entraînement sont maintenant rangés dans la section Solo.` },
  { id: 10, date: '2026-10-12', tag: 'En ligne', title: 'Nouveau relais pour jouer en ligne',
    body: `Le jeu en ligne passe maintenant par le relais de Cloudflare : la connexion doit marcher en 4G/5G et sur les wifi stricts
      (école, entreprise). Si ça coince, <b>📶 Tester la connexion</b> dans la salle d'attente dit exactement pourquoi.` },
  { id: 9, date: '2026-10-12', tag: 'Info', pin: true, title: 'Le jeu déménage 🚚',
    body: `Le jeu a une nouvelle adresse : <b>${NEW_HOST}</b>. L'ancienne marche encore quelque temps, puis elle s'arrêtera.
      Si tu es encore sur l'ancienne, touche le bandeau jaune du menu : il t'emmène sur la nouvelle en gardant ton profil, tes succès et tes réglages.` },
  { id: 8, date: '2026-10-12', tag: 'Menu', title: 'Une page « Nouveautés »',
    body: `Tu es dessus ! Chaque nouvelle version sera annoncée ici. Dans « Signaler un problème », on peut maintenant taper des espaces
      (oui…) et le rapport se copie pour l'envoyer au développeur.` },
  { id: 7, date: '2026-10-12', tag: 'Jeu', title: 'Tutoriel et receveurs corrigés',
    body: `Dans le tutoriel, une passe ratée ou un turnover relance l'étape au lieu de tout figer.
      Un receveur poussé hors du terrain attend maintenant le disque au bord, au point d'entrée le plus proche, au lieu de sortir.` },
  { id: 6, date: '2026-10-11', tag: 'Commandes', title: 'Nouvelles commandes sur téléphone',
    body: `<b>Avec le disque</b> : pose le doigt n'importe où et tire en arrière comme un lance-pierre, relâche pour lancer.
      Un 2<sup>e</sup> doigt qui glisse sur le côté courbe la passe ; taper ton porteur arme la passe haute.<br>
      <b>Sans le disque</b> : tape un endroit pour y aller, ton joueur pour sauter, un coéquipier pour le prendre ; glisse vite pour plonger.<br>
      Tout se règle dans ⚙️ Commandes : joystick, suivre le doigt, boutons sur le bord, touches du clavier…` },
  { id: 5, date: '2026-10-11', tag: 'Menu', title: 'Menu en jeu ☰',
    body: `Le bouton ☰ Menu ouvre un petit menu sans quitter la partie : <b>pause pour tout le monde</b> en ligne
      (ton pseudo s'affiche, toi ou l'hôte relancez), réglage des commandes et <b>signaler un problème</b>.` },
  { id: 4, date: '2026-10-11', tag: 'Règles', title: 'Règles plus proches du vrai ultimate',
    body: `Un arrêt sur trois est une interception, et dans l'en-but adverse c'est toujours une <b>Callahan</b>.
      Le pull peut être droppé. Après un turnover, choisis la reprise <b>posée</b> (tout le monde se replace) ou <b>rapide</b>.
      Pas de réception hors du terrain, et les attaquants s'écartent mieux les uns des autres.` },
  { id: 3, date: '2026-10-11', tag: 'En ligne', title: 'Connexion en ligne plus stable',
    body: `Moins de données envoyées, donc moins de lag et de déconnexions. Le bouton <b>📶 Tester la connexion</b>
      dans la salle d'attente dit si le relais fonctionne sur ton réseau (4G/5G, Wi-Fi d'école…).` },
  { id: 2, date: '2026-10-10', tag: 'En ligne', title: 'Spectateurs et changement d’équipe',
    body: `En rejoignant une partie, tu arrives en spectateur puis tu choisis ton équipe. Le bouton 👥 Équipes permet d'en changer
      en cours de partie.` },
  { id: 1, date: '2026-10-09', tag: 'Jeu', title: 'Plein de nouveautés',
    body: `Pseudos en ligne, durée de match, mode daltonien, jeu installable sur l'écran d'accueil, entraînement sur cibles,
      mini-tournoi, profil avec statistiques et succès, passe haute, saut et duels en l'air, manette.` }
];

// ---------- déménagement : le profil voyage dans le lien (#import=…) ----------
const onNewSite = () => location.hostname === NEW_HOST;
function exportProfile() {
  const o = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('uf-')) o[k] = localStorage.getItem(k); } } catch (e) { }
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); } catch (e) { return ''; }
}
let profileImported = false;
(function importProfile() {
  const m = /^#import=([\w-]+)$/.exec(location.hash); if (!m) return;
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
    for (const k in o) if (k.startsWith('uf-') && typeof o[k] === 'string' && localStorage.getItem(k) === null) localStorage.setItem(k, o[k]);
    profileImported = true;
  } catch (e) { }
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
})();
const moveLink = () => { const p = exportProfile(); return NEW_URL + (p ? '#import=' + p : ''); };

// ---------- affichage ----------
const newsSeen = () => { try { return +localStorage.getItem('uf-news-seen') || 0; } catch (e) { return 0; } };
const newsDate = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
function newsBadge() {
  const n = NEWS.filter(a => a.id > newsSeen()).length, b = document.getElementById('newsBadge');
  b.textContent = n; b.style.display = n ? '' : 'none';
}
function renderNews() {
  const seen = newsSeen(), list = NEWS.slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.id - a.id);
  document.getElementById('newsList').innerHTML = list.map(a => `
    <article class="post${a.id > seen ? ' unread' : ''}">
      <header><span class="avatar">🥏</span><span class="who"><b>Le développeur</b><small>${newsDate(a.date)}</small></span>
        ${a.pin ? '<span class="chip pin">📌 Épinglé</span>' : ''}<span class="chip">${a.tag}</span>${a.id > seen ? '<span class="chip new">Nouveau</span>' : ''}</header>
      <h3>${a.title}</h3><p>${a.body}</p>
    </article>`).join('');
  try { localStorage.setItem('uf-news-seen', String(Math.max(...NEWS.map(a => a.id)))); } catch (e) { }
  newsBadge();
}

document.addEventListener('DOMContentLoaded', () => {
  const $$ = id => document.getElementById(id);
  newsBadge();
  $$('newsB').addEventListener('click', () => { openCard('newsCard'); renderNews(); $$('newsList').scrollTop = 0; });
  $$('newsBack').addEventListener('click', closeCard);
  // bandeau de déménagement : partout sauf sur la nouvelle adresse
  if (!onNewSite()) $$('moveAlert').style.display = '';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  $$('moveAlert').addEventListener('click', () => {
    $$('moveUrl').textContent = NEW_HOST;
    $$('moveGo').href = moveLink();
    $$('moveGo').target = standalone ? '_blank' : '_self';    // depuis l'icône : s'ouvre dans le navigateur, pour installer la nouvelle
    $$('moveHome').classList.toggle('hl', standalone);
    $$('moveStatus').textContent = '';
    openCard('moveCard');
  });
  $$('moveCopy').addEventListener('click', () => {
    const ok = () => { $$('moveStatus').textContent = '✅ Adresse copiée.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(NEW_URL).then(ok, () => { $$('moveStatus').textContent = NEW_URL; });
    else $$('moveStatus').textContent = NEW_URL;
  });
  $$('moveBack').addEventListener('click', closeCard);
  if (profileImported) setTimeout(() => toast('✅ Bienvenue sur la nouvelle adresse : ton profil et tes réglages sont repris.'), 800);
});
