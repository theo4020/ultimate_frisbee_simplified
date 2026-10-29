// news.js — Nouveautés (fil d'annonces dans le menu principal) et déménagement du site vers sa nouvelle adresse.
// Chargé en premier : il reprend le profil apporté par le lien de déménagement avant que les autres fichiers ne le lisent.
//
// ➜ À CHAQUE NOUVELLE VERSION : ajouter une annonce EN HAUT de NEWS (id = le plus grand + 1).
//    Les joueurs voient un badge sur « Nouveautés » tant qu'ils ne l'ont pas ouverte.

const NEW_HOST = 'ultimate-frisbee-simplified.theosyle42.workers.dev';
const NEW_URL = 'https://' + NEW_HOST + '/';

const NEWS = [
  { id: 35, date: '2026-10-29', tag: 'Visuel', title: 'Un terrain plus vivant 🌿',
    body: `Le jeu fait peau neuve, toujours vu de dessus :<br>
      • des ombres au soleil, des lignes à la craie ;<br>
      • au bord du terrain, le <b>banc des remplaçants</b>, les sacs, les gourdes, et des <b>spectateurs</b> qui applaudissent et
      explosent de joie sur un point ;<br>
      • des <b>joueurs</b> plus vivants : foulée, geste du lancer, bras tendus au dernier moment, herbe qui gicle au plongeon ;<br>
      • en vol, le disque reste à sa vraie place : c'est son <b>ombre</b> qui montre sa hauteur ;<br>
      • un <b>panneau de score</b> lumineux, et sur téléphone une <b>caméra qui suit le jeu</b> (réglable dans Commandes) ;<br>
      • deux nouveaux terrains dans Mon style, avec de l'<b>herbe qui ondule au vent</b> : <b>Gazon et herbes folles</b>, et
      <b>Prairie</b> (de l'herbe haute à perte de vue).` },
  { id: 34, date: '2026-10-28', tag: 'Communauté', title: 'Donne ton avis 💬',
    body: `Nouveau bouton <b>💬 Donner mon avis</b>, dans le menu principal et dans le menu ☰ en partie : quelques
      mots, et ton avis part directement au développeur. Ce que tu aimes, ce qui te manque, ce qui te gêne :
      avec si peu de joueurs, chaque retour compte vraiment !<br>
      Et pour bien démarrer, les tout premiers matchs sont plus simples : réglages repliés, IA facile, et Coach Disco
      explique comment lancer et défendre si tu n'as pas fait le tutoriel.` },
  { id: 33, date: '2026-10-28', tag: 'Son et en ligne', title: 'Le stade prend vie, et le jeu en ligne devient plus réactif 🔊',
    body: `<b>Du son</b> : une petite musique dans les menus, et en match un vrai <b>public</b> qui applaudit les points, crie « ooh » sur un block et soupire sur un drop. Sifflet,
      lancers et réceptions ont aussi leur bruit. Règle chaque volume (effets, musique, public) dans <b>Commandes</b>.<br>
      <b>En ligne</b> :<br>
      • ton joueur <b>répond tout de suite</b>, même si tu n'es pas l'hôte (course, mark, plongeons, sauts) ;<br>
      • <b>reconnexion automatique</b> : wifi coupé, passage en 4G, page rechargée… tu reviens dans la partie, dans ton équipe ;<br>
      • la qualité de ta connexion s'affiche dans le menu ☰.<br>
      Et un <b>Callahan</b> se fête désormais comme il se doit 🦅` },
  { id: 32, date: '2026-10-27', tag: 'Style', title: 'Mon style : choisis ton disque, ton terrain, ta tenue 🎨',
    body: `Nouveau bouton <b>🎨 Mon style</b> dans le menu principal. Choisis :<br>
      • ton <b>disque</b> : fluo, arc-en-ciel, galaxie, flamme, néon, or, cible, pastèque, damier (avec sa traînée assortie) ;<br>
      • ton <b>terrain</b> : gazon, stade de nuit, plage, salle, neige, terre battue, espace ;<br>
      • le <b>maillot</b> de ton équipe (rayures, bande, damier, pois, éclair), ses <b>cheveux</b> (rose, bleu, vert, platine, arc-en-ciel)
      et un <b>accessoire</b> : bandeau, casquette, lunettes de soleil, couronne ;<br>
      • ta <b>célébration</b> quand ton équipe marque : confettis, feu d'artifice, pluie d'étoiles, cœurs, bulles.<br>
      La plupart se débloquent avec les <b>succès</b> du Profil, dont six nouveaux (« Départ canon », « Increvable », « Marathonien », « Passeur », « Mur », « Habitué des victoires »).
      C'est purement visuel, et chacun voit ses propres choix.` },
  { id: 31, date: '2026-10-27', tag: 'Jeu', title: 'Départ au pull et mark aimantée 🚦',
    body: `<b>Départ au pull</b> : quand l'IA pulle, trois feux s'allument. Appuie (clic, Espace, tape ou A) pile au
      <b>vert</b> : ton équipe part en trombe. Trop tôt, c'est <b>hors-jeu</b>, comme en vrai : si ton équipe pulle,
      l'adversaire repart du brick ; si elle reçoit, la reprise est arrêtée le temps que la défense se place. L'IA aussi
      part parfois trop tôt… Et si tu ne fais rien, tout se passe comme avant.<br>
      <b>Mark aimantée</b> : en défense, entre dans le cercle du porteur et ton joueur se cale face à lui ; à gauche ou à
      droite, tu fermes un côté. Vise plus loin pour quitter la mark quand tu veux (réglable dans Commandes).` },
  { id: 30, date: '2026-10-26', tag: 'En ligne', title: 'La partie continue même si l’hôte part 🔁',
    body: `En ligne, si l'hôte quitte la partie (onglet fermé, réseau coupé…), un autre joueur la <b>reprend
      automatiquement</b> là où elle en était : même score, mêmes équipes, chacun garde sa place. Plus besoin de tout
      recommencer.<br>
      Et aussi :<br>
      • une fois lancé, le disque n'affiche plus que son <b>cône</b>, coloré selon la hauteur (contrable, debout, en
      sautant, trop haut) ; la trajectoire et le cercle d'atterrissage restent pendant la visée ;<br>
      • toutes les défenses IA (zone, clam, défense perso) ne voient plus que ce qu'elles regardent : elles se parlent,
      mais une coupe dans leur dos peut leur échapper ;<br>
      • les niveaux du mode infini sont mieux étagés : chaque palier bat nettement le précédent.` },
  { id: 29, date: '2026-10-26', tag: 'Tutoriel', title: 'Coach Disco t’apprend à jouer 🧢',
    body: `Le tutoriel fait peau neuve : <b>Coach Disco</b>, 30 ans de terrain et zéro genou intact, te guide en petits
      <b>défis</b> et commente tes exploits (et tes ratés) avec son humour bien à lui.<br>
      • chaque défi rapporte des <b>étoiles</b> : ★ réussi, ★★ du premier coup, ★★★ du premier coup et vite ; ton meilleur
      score s'affiche dans le menu du tutoriel ;<br>
      • nouveau défi <b>« Lire le cône »</b> : cours sous une passe en devinant où elle tombe dans le cercle d'arrivée ;<br>
      • les étapes suivent les dernières nouveautés (hauteur de passe, commandes à jour) ;<br>
      • à la fin, un bilan de tes étoiles… et un match contre <b>l'équipe du coach</b>.` },
  { id: 28, date: '2026-10-26', tag: 'Événement', title: 'Mode Halloween 🎃',
    body: `Touche la <b>petite citrouille</b> en haut du menu principal pour passer en mode Halloween : en match, le terrain
      est plongé dans le noir et tu ne vois que dans un <b>cône</b>, dans la direction de ta souris (ou de ton joystick
      au téléphone), plus un petit halo autour de ton joueur. Tourne la souris pour regarder partout et comprendre ce qui
      se passe… comme les joueurs IA, qui ne voient eux aussi que ce qu'ils regardent. Touche à nouveau la citrouille pour
      revenir à la normale. Pendant le vol, tu vois par les yeux de ton receveur, qui regarde là où il court.` },
  { id: 27, date: '2026-10-26', tag: 'IA', title: 'Des IA qui ne voient pas tout 👀',
    body: `Toi, tu vois tout le terrain d'en haut. Les joueurs IA, eux, ne connaissent plus que <b>ce qu'ils ont vu</b> :<br>
      • ils regardent dans une direction (le porteur balaie le terrain, les autres suivent le disque) et ne voient que ce qui
      est dans leur champ de vision, plus ce qui est tout près d'eux ;<br>
      • ils prennent l'information par <b>coups d'œil</b> : entre deux, ils se fient à leur <b>mémoire</b> — un défenseur revenu
      dans la ligne de passe, un coupeur qui vient de se démarquer dans leur dos peuvent leur échapper ;<br>
      • après une réception, il leur faut le temps de <b>lever la tête</b> : fini les enchaînements instantanés.<br>
      Tout ça s'améliore avec le niveau : une IA facile regarde rarement et croit les joueurs restés sur place, une IA
      difficile balaie vite le terrain et anticipe les courses. Un défenseur qui fixe le disque peut aussi perdre son joueur
      de vue : à toi d'en profiter en coupant dans son dos ! Les coupeurs IA, eux aussi, choisissent leur course d'après ce
      qu'ils ont vu des défenseurs : un débutant coupe parfois droit dans un défenseur, un bon joueur trouve les vrais trous.` },
  { id: 26, date: '2026-10-26', tag: 'Gameplay', title: 'Où va tomber le disque ? 🎯',
    body: `La trajectoire d'une passe n'est plus un simple trait : c'est un <b>cône</b> qui montre où le disque peut aller,
      avec un <b>cercle d'arrivée</b>. Pendant le vol, le cône se resserre et le cercle se réduit peu à peu jusqu'à un point :
      le disque tombe quelque part dedans, pas forcément au centre. À toi de lire le vol et d'anticiper !<br>
      Les IA aussi doivent deviner : une IA facile lit mal l'arrivée et se place de travers, une IA difficile la lit bien.<br>
      Et aussi :<br>
      • comme sur un vrai terrain, l'équipe qui marque <b>reste de son côté</b> et pulle de là, l'autre change de côté ;<br>
      • le jeu est un peu <b>moins rapide</b> par défaut (réglable avant le point) ;<br>
      • le <b>saut</b> part plus vite ;<br>
      • sur téléphone, nouveaux réglages par défaut : <b>joystick et boutons</b> pour se déplacer, et lancer en glissant
      <b>vers la cible</b> (le lance-pierre reste dans Commandes).` },
  { id: 25, date: '2026-10-25', tag: 'Gameplay', title: 'Choisis la hauteur de chaque passe 🌈',
    body: `Fini le simple « normal ou passe haute » : la <b>hauteur</b> de la passe se règle en continu, de la
      <b>rasante</b> (tendue, rapide, précise, mais facile à couper près de toi) à la <b>passe haute</b> (par-dessus la défense,
      mais elle vole plus longtemps et part plus de travers). Entre les deux, tout change petit à petit.<br>
      • <b>PC</b> : <b>Z</b> / <b>S</b>, <b>↑</b> / <b>↓</b> ou la <b>molette</b> ; <b>←</b> / <b>→</b> pour la courbe ;
      le pied de pivot passe sur <b>X</b> ;<br>
      • <b>téléphone</b> : pendant la visée, un 2<sup>e</sup> doigt glisse <b>le long de la passe</b> (vers ton porteur =
      plus haute) ; sur le côté, il règle toujours la courbe ;<br>
      • <b>manette</b> : croix ↑ / ↓.<br>
      Une <b>jauge à côté du porteur</b> montre à tout le monde, adversaires compris, la hauteur qu'il prépare : en défense,
      tu vois venir le lob.<br>
      Aussi : un bouton <b>⛶ plein écran</b> en haut, maintenant aussi sur PC, et un niveau <b>Facile</b> vraiment plus
      facile (plus de drops et de passes ratées).` },
  { id: 24, date: '2026-10-20', tag: 'Affichage', title: 'Nouvelle vue inclinée 🏟️',
    body: `Dans <b>Commandes → Affichage</b>, choisis la vue <b>Inclinée (tribune)</b> : le terrain vu depuis le bord, avec
      des joueurs debout qui sautent et plongent vraiment, et le disque qui monte et redescend (son ombre et un trait montrent
      où il passe au sol, une croix où il arrive). La vue de dessus reste celle par défaut.<br>
      Le vol du disque est aussi plus juste, dans les deux vues : une vraie courbe sans palier, une passe haute en cloche,
      et un disque penché selon la courbe donnée au lancer. Sauter dans la zone violette attrape enfin le disque,
      même tôt dans sa course.<br>
      Après une perte en reprise posée, ce n'est plus le joueur collé au disque qui le ramasse mais un handler qui arrive
      de derrière : chacun a le temps de se placer.` },
  { id: 23, date: '2026-10-20', tag: 'IA', title: 'Des IA repensées 🧠',
    body: `Les joueurs IA ont été revus de fond en comble :<br>
      • <b>plus de rôle attitré</b> : le joueur le plus en arrière devient naturellement handler, les autres coupent ; un
      coupeur qui revient derrière le disque devient handler, et ainsi de suite, comme sur un vrai terrain ;<br>
      • tous lisent le jeu de la même façon (qui arrive où, à temps, en courant, en sautant ou en plongeant) ;<br>
      • <b>plus de hasard ni de temps mort</b> : l'IA lance dès qu'elle a lu le jeu, plonge et saute quand il le faut,
      appelle un play quand rien n'est ouvert ;<br>
      • les <b>niveaux</b> se règlent avec la réaction, la vitesse, la précision et la lecture du jeu : un joueur facile
      se trompe (il croit des passes ouvertes qui ne le sont pas), il ne joue plus au hasard.` },
  { id: 22, date: '2026-10-19', tag: 'Gameplay', title: 'Le pied de pivot : duel avec la mark 🦶',
    body: `Le porteur lâche maintenant le disque <b>du côté de son pied de pivot</b> : le joueur se penche et le disque est
      dessiné dans sa main, de ce côté. La mark suit ton pivot et <b>se fend vers le disque</b> au lâcher (sa zone rouge
      montre jusqu'où elle peut contrer) : lancer dans la mark, c'est souvent contré.<br>
      Le bouton de passe haute devient le bouton <b>Pivot</b> (même touche, Y à la manette, ou ton doigt sur ton porteur) :<br>
      • <b>un appui</b> : tu changes de pied, pour passer de l'autre côté de la mark (tu repars côté open à chaque réception) ;<br>
      • <b>maintenu</b> : tu armes la passe haute, sans la ralentir.<br>
      Feinte d'un côté, la mark suit… puis pivote et lance de l'autre pour la prendre à contre-pied.<br>
      <b>Tutoriel en deux parcours</b> : <b>débutant</b> (se déplacer, lancer, courbe, appeler un cut, changer de joueur,
      plonger en défense) puis <b>avancé</b> (pied de pivot, passe haute, plays, duel en l'air, contre au lâcher, pull),
      avec un nouveau succès pour l'avancé.<br>
      Et l'<b>IA attaque mieux</b> : elle ne lance plus là où son receveur ne peut pas arriver, et elle tient compte des
      plongeons de la défense avant de lancer.` },
  { id: 21, date: '2026-10-16', tag: 'Systèmes', title: 'Formations, plays et défenses perso 🎯',
    body: `<b>Mes systèmes</b> sépare maintenant trois choses :<br>
      • <b>Formation</b> : tu places tes 4 joueurs, puis tu donnes à chaque poste ses <b>consignes</b> : rôle (coupeur, relais,
      profond), zone de coupe, quand couper, ce qu'il fait ensuite. « Au choix de l'IA » la laisse lire l'espace.<br>
      • <b>Play</b> : tu pars d'une formation (du jeu ou une des tiennes) et tu n'ajoutes que les courses.<br>
      • <b>Défense</b> : la mark (force, distance, double team) et 4 défenseurs, chacun en <b>zone</b> ou en <b>individuelle</b>,
      avec son placement, son comportement, s'il peut aider ou échanger son joueur. Tu peux tout mélanger (junk).<br>
      Tes anciennes attaques avec des courses sont devenues une formation + un play.<br>
      Nouveau aussi : les <b>consignes d'équipe</b> du menu d'avant-point (jeu long, passes hautes, prise de risque, aide en
      défense), et un jeu plus structuré : stacks plus loin du disque, un receveur rattrapé en pleine course freine avant
      de lancer, et un <b>style d'attaque</b> à choisir à côté de la formation : structuré (on se replace) ou enchaîné (flow).` },
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
  { id: 9, date: '2026-10-12', tag: 'Info', title: 'Le jeu déménage 🚚',
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
