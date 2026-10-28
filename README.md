# Ultimate Frisbee – prototype

Petit jeu d'ultimate en vue du dessus (ou inclinée), jouable dans le navigateur (ordinateur et téléphone), en solo contre l'IA (match simple, mode infini, mini-tournoi), ou jusqu'à 10 en ligne (plus des spectateurs). Un tutoriel interactif (avec Coach Disco) présente les bases, un mode entraînement permet de s'exercer, et un profil garde tes statistiques et tes succès. Le jeu s'installe sur l'écran d'accueil d'un téléphone (application web) et le solo marche hors connexion. Se joue à la souris, au clavier, au doigt ou à la manette. Aucun outil de compilation : ce sont de simples fichiers HTML, CSS et JavaScript.

## Lancer le jeu en local

- **Le plus simple** : ouvre `index.html` dans ton navigateur.
- **Pour tester le jeu en ligne entre deux onglets**, sers le dossier avec un petit serveur, par exemple `python -m http.server 8000`, puis ouvre http://localhost:8000.

## Organisation du code

Les scripts sont chargés dans cet ordre par `index.html` et partagent le même espace global.

| Fichier | Rôle |
|---|---|
| `worker/index.js` | Côté serveur (Cloudflare) : sert le site, identifiants TURN temporaires (`/api/turn`), classement du mode infini (`/api/scores`), comptes (`/api/account/*`), galerie (`/api/gallery`) |
| `js/news.js` | Page « Nouveautés » (annonces) et bandeau de changement d'adresse ; chargé en premier |
| `js/secrets.js` | Secours en local uniquement. **Ignoré par Git.** |
| `js/config.js` | Constantes (terrain, vitesses, règles), textes des stratégies et des plays |
| `js/util.js` | Canvas, conversion mètres → pixels, outils mathématiques |
| `js/state.js` | État du jeu : joueurs, disque, configuration de chaque équipe |
| `js/humans.js` | Qui contrôle quoi (humains, IA, spectateurs), niveaux de l'IA |
| `js/teams.js` | Noms et couleurs des équipes, réglages mémorisés dans le navigateur |
| `js/wind.js` | Vent, rafales, dérive du disque, force (break side) |
| `js/predict.js` | Lecture du jeu commune à toutes les IA : qui arrive où et à temps, marge d'une passe, cône d'incertitude du disque en vol |
| `js/vision.js` | Ce que chaque joueur IA sait du terrain : champ de vision, coups d'œil, mémoire, lecture collective de la défense |
| `js/offense.js` | IA offensive : rôles, places de la formation, coupes vers l'espace libre (course contre le défenseur, ligne de passe, terrain gagné), laisser l'espace aux autres |
| `js/defense.js` | IA défensive : man, zone, clam, lecture collective (changements, aide, passe probable selon le niveau), interceptions, layout |
| `js/throwing.js` | Lancers (hauteur de passe continue) : trajectoire, erreur, choix de passe de l'IA |
| `js/stats.js` | Statistiques du match et résumé de fin de partie (MVP) |
| `js/events.js` | Réception, interception, turnover, point, sélection du défenseur |
| `js/sim.js` | Boucle de simulation : déplacements, stall count, vol du disque |
| `js/point.js` | Lancement d'un point |
| `js/plays.js` | Plays d'attaque appelés en jeu (Play 1 / Play 2, depuis la position des joueurs), plays de défense |
| `js/fx.js` | Sons synthétisés, particules, secousses, vibrations |
| `js/pull.js` | Le pull : visée, courbe, jauge de puissance, réception et brick |
| `js/replay.js` | Ralenti du dernier point, célébration après un point |
| `js/render.js` | Dessin du terrain, des joueurs, du disque (trajectoire à la visée, cône en vol) et des repères |
| `js/render-iso.js` | Vue inclinée (tribune) et mode Halloween |
| `js/ui.js` | HUD et menus |
| `js/account.js` | Compte joueur : création, connexion, sauvegarde automatique du profil en ligne |
| `js/systems.js` | Systèmes de jeu perso : format, validation, et leur exécution par l'IA (attaque et défense) |
| `js/editor.js` | Éditeur « Mes systèmes » : terrain où l'on place les joueurs et dessine les courses |
| `js/gallery.js` | Galerie des systèmes publiés : parcourir, aperçu, ajouter, ❤, publier / retirer |
| `js/endless.js` | Mode infini : matchs en 2 points de plus en plus durs, record et classement mondial |
| `js/coop.js` | Mode infini à plusieurs (en ligne, tous dans la même équipe) |
| `js/series.js` | Mini-tournoi (3 adversaires avec chacun leur style, progression mémorisée) |
| `js/practice.js` | Mode entraînement (cibles, vent, défenseur) |
| `js/achievements.js` | Profil : statistiques de carrière et succès |
| `js/audio.js` | Musique des menus (synthétisée) ; public et bruits du jeu enregistrés (`sounds/`, sons Pixabay de storegraphic, dragon-studio, Universfield, freesound_community, scratchonix) : murmure en boucle, clameurs, « ooh », déception, sifflet, réception, lancer — sons fabriqués en secours ; volumes effets / musique / public |
| `js/style.js` | « Mon style » : disques, terrains, tenues et célébrations, débloqués par les succès (visuel seulement) |
| `js/tuto.js` | Tutoriel avec Coach Disco : deux parcours de défis (débutant, avancé), étoiles |
| `js/ctrl.js` | Réglages des commandes (touches, gestes, vue), options admin |
| `js/controls.js` | Souris, clavier, tactile, joystick virtuel, plein écran |
| `js/gestures.js` | Gestes sur téléphone (visée, 2e doigt pour la courbe et la hauteur, taps) |
| `js/gamepad.js` | Manette (API Gamepad) |
| `js/net.js` | Multijoueur en ligne (PeerJS) : salle d'attente, spectateurs, émojis, reprise de la partie si l'hôte part |
| `js/main.js` | Boucle principale et démarrage |
| `js/pwa.js` | Installation sur l'écran d'accueil (bouton « Installer ») |
| `sw.js` | Service worker : garde une copie des fichiers pour jouer hors connexion |
| `manifest.webmanifest`, `icons/` | Nom, icônes et affichage de l'application installée |
| `tools/simulate.js` | Matchs IA contre IA sans navigateur : `node tools/simulate.js 20` |
| `tools/review-play.mjs` | Relecture en jouant : des joueurs robots jouent de vrais matchs dans Chromium (souris, clavier, pull), en solo ou à plusieurs, avec captures et journal : `node tools/review-play.mjs dossier difficile 6 coop` |
| `tools/bench.mjs` | Banc de réalisme : chiffres par niveau, chaque niveau contre une équipe Normal, échelle du mode infini : `node tools/bench.mjs 60` |
| `tools/test/` | Suite de tests (voir « Tests ») |

## Comment marche le jeu (les grands systèmes)

- **Le disque** (`throwing.js`, `util.js`, `config.js` → `LOFT`) : chaque passe a une hauteur de 0 (rasante) à 1 (passe haute) ;
  durée de vol, forme du vol, dérive au vent, imprécision et drops se mélangent en continu. Le lanceur voit sa trajectoire et
  un cercle d'atterrissage ; une fois lancé, tout le monde ne voit plus qu'un **cône** qui se resserre jusqu'à l'arrivée
  (`CONE`, `render.js` → `drawCone`), coloré selon la hauteur. L'arrivée réelle est quelque part dans le cercle.
- **Les IA** : toutes lisent le jeu de la même façon (`predict.js`) et ne connaissent que ce qu'elles ont vu (`vision.js`) :
  coups d'œil réguliers, champ de vision, mémoire prolongée selon la lecture du jeu ; la défense met en commun ce que ses
  joueurs ont vu. Elles devinent aussi l'arrivée du disque dans le cône (`seenAt`).
- **Les niveaux** (`config.js` → `skill`) : quatre qualités (réaction, vitesse, précision, lecture du jeu) dont tout le reste
  est déduit, vision comprise. Facile < Normal < Difficile < Légende < Surhumain (`endless.js`) : `tools/bench.mjs` vérifie que
  chaque palier bat le précédent.
- **En ligne** (`net.js`) : l'hôte simule, les invités envoient leurs actions et reçoivent l'état ~20 fois par seconde.
  L'hôte annonce un héritier (le plus ancien invité) : si l'hôte part, l'héritier reprend la partie depuis le dernier état
  reçu, les autres se reconnectent à lui et il reprend le code de la partie.
  Connexion perdue (wifi coupé, passage en 4G, appli en arrière-plan) : l'invité essaie d'abord de retrouver l'hôte pendant
  30 s et reprend sa place ; l'héritier ne reprend la partie que si le service confirme que l'hôte n'existe plus (jamais
  deux parties parallèles). L'hôte garde 10 min la place d'un joueur parti en cours de partie (page rechargée comprise).
  Après un trou de réseau, l'invité saute au dernier état reçu et ne rejoue que les effets des 0,6 dernière seconde.
  Prédiction : l'invité déplace lui-même le joueur qu'il contrôle (mêmes règles de course, mark aimantée, plongeons et
  sauts compris) ; chaque état de l'hôte dit quel ordre il a appliqué (`ak`), l'invité compare avec sa prédiction au même
  moment et corrige l'écart en douceur. Lancer : geste et bruit tout de suite chez l'invité. Temps d'aller-retour
  (ping / pong) affiché dans le menu ☰, et sur le terrain de l'invité au-delà de 250 ms.

## Hébergement et relais TURN

Le jeu en ligne passe par une connexion directe entre les deux navigateurs. En 4G/5G ou sur un réseau strict, il faut un relais TURN.

Tout est chez **Cloudflare Workers** : le site (fichiers statiques) et le relais TURN de Cloudflare (1 000 Go par mois gratuits).
Le petit programme `worker/index.js` tourne chez Cloudflare (pas dans le navigateur) : il garde le jeton TURN et donne au jeu
des identifiants **temporaires** (4 h) sur `/api/turn`, utilisables seulement depuis le site. Rien de secret n'est dans le site ni dans Git.
`wrangler.jsonc` décrit le projet, `.assetsignore` liste les fichiers du dépôt à ne pas publier.

**Mise en place (une seule fois)**
1. Sur [dash.cloudflare.com](https://dash.cloudflare.com) : *Realtime → TURN → Create*. Note le **Turn Token ID** et l'**API Token** (affiché une seule fois).
2. *Workers & Pages → Create → Import a repository*, choisis ce dépôt. *Build command* vide, *Deploy command* `npx wrangler deploy` (proposé par défaut).
3. Une fois le premier déploiement fait : *Settings → Variables and Secrets* du worker `ultimate-frisbee-simplified` (pas *Build → Variables and secrets*, qui ne sert qu'à la construction), ajoute en type **Secret** :
   - `TURN_KEY_ID` : le Turn Token ID ;
   - `TURN_KEY_API_TOKEN` : l'API Token.
4. Ouvre le site, puis *En ligne → 📶 Tester la connexion* : « relais OK ».

Ensuite chaque push sur `main` met le site à jour automatiquement.

**Adresse du site** : mieux vaut un nom de domaine à toi (environ 10 € par an, par exemple chez Cloudflare Registrar), branché dans
*Settings → Domains & Routes*. L'adresse ne dépend alors plus de l'hébergeur : on pourra en changer sans que les joueurs changent de lien.

**Voir et modifier les données** : *Workers & Pages → Durable Objects* → `Accounts`, `Board` ou `Gallery` → **Data Studio**,
identifiant `main`. Tables : `accounts` (comptes : pseudo, empreinte du mot de passe, profil en JSON), `scores` (classement),
`items` et `likes` (galerie), `meta` (interne). Les données d'avant ont été recopiées automatiquement au premier lancement.
Le classement du mode infini à plusieurs est un second objet `Board`, d'identifiant `coop` (même table `scores`).

**Modérer la galerie** : dans *Settings → Variables and Secrets* du worker, ajoute une variable `GALLERY_ADMINS` (texte)
avec ton pseudo de compte (plusieurs pseudos séparés par des virgules). Ces comptes voient ✕ sur toutes les publications.

**Mot de passe oublié** : les mêmes comptes admins (variable `GALLERY_ADMINS`, ou `ADMINS` si tu veux une liste à part)
voient dans *Compte* une section « 🔑 Admin : mot de passe oublié ». Écris le pseudo du joueur, touche « Nouveau mot de
passe » : un mot de passe temporaire s'affiche, à lui donner. Il garde son profil, son pseudo, sa place au classement et
ses publications ; ses appareils sont déconnectés. Après un changement de la variable, reconnecte-toi (ou attends la
prochaine sauvegarde) pour voir la section.

**Recevoir les rapports de bug** (bouton 🐞 du jeu) : ils sont toujours gardés dans l'objet `Reports` (table `reports`,
les 300 derniers, visibles dans Data Studio). Pour les recevoir aussi sur ton téléphone, crée un webhook Discord
(salon → Modifier → Intégrations → Webhooks → Nouveau webhook → Copier l'URL), puis ajoute dans *Settings → Variables
and Secrets* du worker un **secret** `REPORT_WEBHOOK` contenant cette URL. Chaque rapport arrive alors dans ce salon :
un résumé lisible et le rapport complet en pièce jointe.
Chaque rapport indique **qui l'a envoyé** (le compte, vérifié par son jeton — jamais gardé —, sinon le pseudo suivi de
« sans compte »). **Dans le jeu**, un compte admin voit au menu principal un bouton « 🐞 Signalements » avec le nombre de
nouveaux rapports (et un 🐞 sur le bouton ☰ Menu en partie) : il ouvre la liste (qui, quand, mode, appareil, description)
et peut copier un rapport complet. Ouvrir la liste marque tout comme vu.

**Ménage après la bascule**
- Dans Metered, supprime l'ancien identifiant fixe (il était visible dans l'ancien site), voire le compte ;
- désactive GitHub Pages (*Settings → Pages*), supprime `.github/workflows/deploy.yml` et les secrets `TURN_*` du dépôt.

**En local** : `npx wrangler dev` lance le site et `/api/turn`, avec un fichier `.dev.vars` (ignoré par Git) contenant les deux variables.
Avec un simple serveur de fichiers, le jeu retombe sur `js/secrets.js` (copie de `js/secrets.example.js`, ignoré par Git) ou sur des serveurs sans relais.

## Tests

`tools/test/run.mjs` vérifie le jeu de bout en bout. Les fichiers `*.test.mjs` de `tools/test/` :

| Fichier | Ce qui est vérifié |
|---|---|
| `rules.test.mjs` | Matchs IA contre IA sans blocage, chiffres réalistes, interceptions (1 sur 3), Callahan, côtés, cône, vision des IA, tutoriel, mode infini, tournoi |
| `account.test.mjs` | Comptes côté serveur : création, empreinte du mot de passe, connexion, sauvegarde, essais limités, pseudo réservé au classement |
| `ui-account.test.mjs` | Comptes dans le navigateur : création sur un appareil, connexion sur un autre, profil retrouvé, déconnexion |
| `systems.test.mjs` | Systèmes perso : validation, placement autour du disque, matchs IA qui les jouent, utilisés aussi en mode infini |
| `ui-systems.test.mjs` | Éditeur dans le navigateur (ordinateur et téléphone) : placer, dessiner une course, enregistrer, choisir avant un point |
| `code.test.mjs` | Aucun nom de fonction ou de constante déclaré dans deux fichiers |
| `gallery.test.mjs` | Galerie côté serveur : publier (compte obligatoire), mettre à jour, lister, filtrer, ❤ (un par compte), retirer, modérateurs |
| `ui-gallery.test.mjs` | Galerie dans le navigateur : publier sur un appareil, voir / aimer / ajouter sur un autre, retirer |
| `worker.test.mjs` | Serveur : relais TURN (sécurité, erreurs), classement (tri, scores impossibles refusés, pseudos nettoyés) |
| `ui.test.mjs` | Dans Chromium : menus, section Solo, mode infini jusqu'au classement, menu en jeu, signalement, tutoriel, entraînement, lance-pierre sur téléphone |
| `online.test.mjs` | Onglets : salle d'attente, équipes, pull, passes de l'invité, pause pour tous, départ d'un joueur, mode infini à plusieurs, reprise par un invité si l'hôte part ; réseau difficile simulé par `fakepeer.js` (retard, wifi coupé, liaison perdue, page rechargée), prédiction de l'invité (réactivité, accord avec l'hôte, plongeon) |

```bash
node tools/test/run.mjs --quick                 # sans navigateur (quelques secondes)
cd tools/test && npm install && npx playwright install chromium && cd ../..
node tools/test/run.mjs                         # tout (environ 2 minutes ; JOBS=1 : un fichier à la fois)
node tools/test/run.mjs ui                      # un seul fichier
```

**Automatiquement**
- GitHub lance toute la suite à chaque push (`.github/workflows/tests.yml`, onglet *Actions*).
- Cloudflare lance la partie rapide avant chaque mise en ligne : dans le worker, *Settings → Build → Build command* : `node tools/test/run.mjs --quick`.
  Si un test échoue, la nouvelle version n'est pas publiée et l'ancienne reste en ligne.

## Publier une nouvelle version

Lance les tests, puis ajoute une annonce en haut de `NEWS` dans `js/news.js` (page « Nouveautés » du menu, les joueurs voient un badge).

```bash
git add -A
git commit -m "Description du changement"
git push
```

Le site est mis à jour une à deux minutes après le push. L'onglet *Deployments* du worker sur Cloudflare montre l'avancement.

## Application installable

Le site est une application web installable : sur Android (Chrome) un bouton « Installer le jeu » apparaît dans le menu,
sur iPhone il faut passer par Partager → « Sur l'écran d'accueil ». Une fois installé, le jeu s'ouvre en plein écran et en paysage.
Le service worker charge toujours la dernière version quand il y a du réseau, et sert la copie gardée sinon.
**Si tu ajoutes un fichier JS**, ajoute-le aussi à la liste `FILES` de `sw.js` pour qu'il soit disponible hors connexion.

## À faire plus tard

- **Relecture en jouant** : faite les 26 et 27/10/2026 avec `tools/review-play.mjs` (solo à chaque niveau, vue inclinée, tutoriel,
  entraînement, mode infini, à plusieurs). À relancer après les gros changements.
- **Face-à-face avec la mark** : la mark humaine voit le pied de pivot, lit les feintes et peut contrer le lob en sautant.
