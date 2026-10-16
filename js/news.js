// news.js — Nouveautés (fil d'annonces dans le menu principal) et déménagement du site vers sa nouvelle adresse.
// Chargé en premier : il reprend le profil apporté par le lien de déménagement avant que les autres fichiers ne le lisent.
//
// ➜ À CHAQUE NOUVELLE VERSION : ajouter une annonce EN HAUT de NEWS (id = le plus grand + 1).
//    Les joueurs voient un badge sur « Nouveautés » tant qu'ils ne l'ont pas ouverte.

const NEW_HOST = 'ultimate-frisbee-simplified.theosyle42.workers.dev';
const NEW_URL = 'https://' + NEW_HOST + '/';

const NEWS = [
  { id: 21, date: '2026-10-16', tag: 'Systèmes', title: 'Formations, plays et défenses perso 🎯',
    body: `<b>Mes systèmes</b> sépare maintenant trois choses :<br>
      • <b>Formation</b> : tu places tes 4 joueurs, puis tu donnes à chaque poste ses <b>consignes</b> : rôle (coupeur, relais,
      profond), zone de coupe, quand couper, ce qu'il fait ensuite. « Au choix de l'IA » la laisse lire l'espace.<br>
      • <b>Play</b> : tu pars d'une formation (du jeu ou une des tiennes) et tu n'ajoutes que les courses.<br>
      • <b>Défense</b> : la mark (force, distance, double team) et 4 défenseurs, chacun en <b>zone</b> ou en <b>individuelle</b>,
      avec son placement, son comportement, s'il peut aider ou échanger son joueur. Tu peux tout mélanger (junk).<br>
      Tes anciennes attaques avec des courses sont devenues une formation + un play.<br>
      Nouveau aussi : les <b>consignes d'équipe</b> du menu d'avant-point (jeu long, passes hautes, prise de risque, aide en
      défense), et des stacks plus loin du disque, qui se remettent en place avant de recouper.` },
  { id: 20, date: '2026-10-15', tag: 'Gameplay', title: 'Nouvelle physique, plus réaliste 🏃',
    body: `Le jeu repose maintenant sur une vraie physique :<br>
      • <b>Les joueurs accélèrent</b> en un peu plus d'une seconde au lieu de démarrer à fond : un bon changement de direction
      fait vraiment gagner un ou deux mètres sur son défenseur.<br>
      • <b>Le disque a un vrai vol</b> : une passe courte reste à hauteur de poitrine, une passe longue monte plus haut, une passe
      courbée monte plus vite. Ce qui protège une passe, c'est le timing : le défenseur doit arriver à temps.<br>
      • <b>Contres</b> : ~90 % en plein dans les bras, ~50 % du bout des doigts. Le lanceur pivote pour lâcher le disque à côté de la mark.<br>
      • <b>Drops</b> plus rares, surtout sur une prise simple ; ils viennent d'un disque rapide, d'une prise en extension ou d'un défenseur au contact.<br>
      • Le jeu tourne à vitesse réelle, et la mark se place à 3 m comme dans les règles.` },
  { id: 19, date: '2026-10-14', tag: 'En ligne', title: 'Mode infini à plusieurs 🤝',
    body: `Nouvelle section <b>🌐 En ligne</b> dans le menu principal, avec un <b>mode infini à plusieurs</b> : jusqu'à 5 joueurs
      dans la même équipe contre une IA de plus en plus forte. Une défaite et la série s'arrête ; l'hôte peut alors enregistrer
      l'équipe dans un <b>classement à part</b>, relancer une série ou revenir à la salle. Créer et rejoindre une partie se font
      aussi depuis cette section.<br>
      <b>Mode infini</b> : par défaut, l'adversaire pulle et tes coéquipiers IA sont au niveau difficile (modifiable ; tes
      réglages du match rapide ne changent pas).<br>
      <b>Duels</b> : plus de hasard, le mieux placé gagne (le plus haut au bon moment, le plus près du disque).
      <b>Contres</b> : moins faciles sur une passe courte ou quand le défenseur est au bout du bras.<br>
      <b>Straight up</b> : les défenseurs ne penchent plus d'un côté, puisque la mark n'en ferme aucun.<br>
      <b>Passes normales</b> : trajectoire revenue presque à celle d'avant (elles partent moins haut).` },
  { id: 18, date: '2026-10-14', tag: 'Jeu', title: 'Défense plus maligne, débutants plus réalistes, souris 🖱️',
    body: `<b>Défense individuelle</b> : chaque défenseur se place entre son joueur et le disque, sur la ligne de passe.
      Mettre tout le monde sur les côtés puis couper au centre ne marche plus à tous les coups.<br>
      <b>Zone</b> : quand le disque approche de l'en-but et que personne n'est au fond, l'arrière se place vers le début de
      l'en-but au lieu de se coller au fond du terrain.<br>
      <b>Mode infini</b> : la difficulté monte un peu moins vite (Titans au 5e match au lieu du 4e).<br>
      <b>Niveaux</b> : toutes les IA réfléchissent de la même façon (placements, coupes, défense collective). Un débutant est
      plus lent, droppe plus souvent et surtout <b>force des passes risquées</b> au lieu de jouer sûr.<br>
      <b>Passes normales</b> : lâchées à hauteur de hanche, elles montent vite puis planent. La mark et les défenseurs proches
      du lanceur ont moins de temps pour les contrer.<br>
      <b>Relais</b> : il garde ses distances avec le porteur et ne vient plus se coller à lui.<br>
      <b>Sur PC</b> : clique sur un coéquipier pour en prendre le contrôle ; <b>clic droit</b> pour sauter (en défense, ou pour
      ton receveur pendant le vol). Avec le disque, le clic droit appelle toujours un cut.` },
  { id: 17, date: '2026-10-13', tag: 'Commandes', title: 'Joystick flottant et layout au bon moment 🎮',
    body: `<b>Joystick sur téléphone</b> (réglage ⚙️ Commandes → Joystick et boutons) : plus de joystick fixe en bas à gauche.
      Pose le doigt <b>n'importe où</b> sur le terrain et glisse : ton joueur court dans cette direction, plus ou moins vite
      selon la distance. Le joystick apparaît sous ton doigt et disparaît quand tu le lèves.<br>
      <b>Layout pour tes receveurs</b> (en attaque, seul dans ton équipe) : le receveur ne plonge plus vers le disque là où il est,
      mais vers l'endroit où il <b>sera</b>. Si tu appuies trop tôt, il attend le bon moment pour plonger.` },
  { id: 16, date: '2026-10-13', tag: 'Tactique', title: 'La galerie des systèmes 🌍',
    body: `Dans <b>📋 Mes systèmes</b>, un nouvel onglet <b>🌍 Galerie</b> : les systèmes publiés par tous les joueurs. Regarde-les
      en aperçu animé, ajoute ceux qui te plaisent à tes systèmes en un clic, et donne un ❤ à tes préférés.
      Pour publier les tiens, touche 🌍 à côté d'un système (il faut un compte). Le tutoriel a aussi une nouvelle étape :
      appeler un play.` },
  { id: 15, date: '2026-10-13', tag: 'Jeu', title: 'Nouvelle IA, formation et plays à la demande 🧠',
    body: `<b>Les joueurs lisent le jeu</b> : les coupeurs attaquent l'espace que la défense laisse libre (au lieu de courses
      au hasard) et s'écartent pour laisser la place aux autres. <b>La défense s'entraide</b> : changements de joueur quand deux
      défenseurs se croisent, aide sur un attaquant libre, et le défenseur de la passe probable se glisse dans la ligne.
      Plus le niveau est élevé, plus la défense est collective.<br>
      <b>Formation + 2 plays</b> : avant le point, choisis ta formation et deux plays ; avec le disque, appelle-les quand tu veux
      (boutons ▶ sur le terrain, touches R / T, croix de la manette). Les joueurs partent tout de suite depuis là où ils sont.
      Tes systèmes perso servent de formation, ou de play quand tu les appelles.<br>
      Et aussi : <b>stall à 1 compte par seconde</b> comme en vrai, et l'IA lit les passes hautes comme toi.` },
  { id: 14, date: '2026-10-12', tag: 'Jeu', title: 'Joueurs plus réactifs pendant les passes',
    body: `Quand une passe va clairement être attrapée, attaquants et défenseurs se replacent dès le lancer autour du point de
      réception, au lieu d'attendre que le receveur ait le disque. Le jeu enchaîne plus vite après chaque passe.
      Et tes systèmes perso sont maintenant utilisables en mode infini.` },
  { id: 13, date: '2026-10-12', tag: 'Tactique', title: 'Crée tes propres systèmes de jeu 📋',
    body: `Nouveau bouton <b>📋 Mes systèmes</b> dans le menu. <b>En attaque</b> : place tes 4 joueurs autour du porteur et dessine
      leurs courses dans l'ordre (aperçu animé pour vérifier). <b>En défense</b> : dessine ta propre zone, ou fais une individuelle
      où chacun a un rôle (serré, profond, double team). Tes systèmes apparaissent avec une ★ dans le menu d'avant-point,
      en solo, en ligne et en mode infini, et sont gardés avec ton compte.` },
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
  const openMove = forced => {
    $$('moveUrl').textContent = NEW_HOST;
    $$('moveGo').href = moveLink();
    $$('moveGo').target = standalone ? '_blank' : '_self';    // depuis l'icône : s'ouvre dans le navigateur, pour installer la nouvelle
    $$('moveHome').classList.toggle('hl', standalone);
    $$('moveStatus').textContent = '';
    openCard('moveCard');
    // à l'ouverture du jeu sur l'ancienne adresse : panneau imposé, « continuer ici » seulement après quelques secondes
    const b = $$('moveBack'); clearInterval(b.tm);
    if (!forced) { b.disabled = false; b.textContent = '← Retour'; return; }
    let n = 5; b.disabled = true;
    const tick = () => { b.textContent = n > 0 ? `Continuer sur l'ancienne adresse (${n})` : 'Continuer sur l’ancienne adresse'; b.disabled = n > 0; if (n-- <= 0) clearInterval(b.tm); };
    tick(); b.tm = setInterval(tick, 1000);
  };
  $$('moveAlert').addEventListener('click', () => openMove(false));
  const oldSite = /github\.io$/.test(location.hostname) || /[?&]oldsite\b/.test(location.search);   // l'ancienne adresse (?oldsite : pour les tests)
  if (oldSite) setTimeout(() => openMove(true), 400);          // ancienne adresse : à chaque ouverture du jeu
  $$('moveCopy').addEventListener('click', () => {
    const ok = () => { $$('moveStatus').textContent = '✅ Adresse copiée.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(NEW_URL).then(ok, () => { $$('moveStatus').textContent = NEW_URL; });
    else $$('moveStatus').textContent = NEW_URL;
  });
  $$('moveBack').addEventListener('click', closeCard);
  if (profileImported) setTimeout(() => toast('✅ Bienvenue sur la nouvelle adresse : ton profil et tes réglages sont repris.'), 800);
});
