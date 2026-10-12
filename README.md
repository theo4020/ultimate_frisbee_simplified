# Ultimate Frisbee – prototype

Petit jeu d'ultimate en vue du dessus, jouable dans le navigateur (ordinateur et téléphone), en solo contre l'IA (match simple ou mini-tournoi), ou jusqu'à 10 en ligne (plus des spectateurs). Un tutoriel interactif présente les bases, un mode entraînement permet de s'exercer, et un profil garde tes statistiques et tes succès. Le jeu s'installe sur l'écran d'accueil d'un téléphone (application web) et le solo marche hors connexion. Se joue à la souris, au clavier, au doigt ou à la manette. Aucun outil de compilation : ce sont de simples fichiers HTML, CSS et JavaScript.

## Lancer le jeu en local

- **Le plus simple** : ouvre `index.html` dans ton navigateur.
- **Pour tester le jeu en ligne entre deux onglets**, sers le dossier avec un petit serveur, par exemple `python -m http.server 8000`, puis ouvre http://localhost:8000.

## Organisation du code

Les scripts sont chargés dans cet ordre par `index.html` et partagent le même espace global.

| Fichier | Rôle |
|---|---|
| `worker/index.js` | Côté serveur (Cloudflare) : sert le site, identifiants TURN temporaires (`/api/turn`), classement du mode infini (`/api/scores`), comptes (`/api/account/*`) |
| `js/news.js` | Page « Nouveautés » (annonces) et bandeau de changement d'adresse ; chargé en premier |
| `js/secrets.js` | Secours en local uniquement. **Ignoré par Git.** |
| `js/config.js` | Constantes (terrain, vitesses, règles), textes des stratégies et des plays |
| `js/util.js` | Canvas, conversion mètres → pixels, outils mathématiques |
| `js/state.js` | État du jeu : joueurs, disque, configuration de chaque équipe |
| `js/humans.js` | Qui contrôle quoi (humains, IA, spectateurs), niveaux de l'IA |
| `js/teams.js` | Noms et couleurs des équipes, réglages mémorisés dans le navigateur |
| `js/wind.js` | Vent, rafales, dérive du disque, force (break side) |
| `js/offense.js` | IA offensive : handler, dump, stack, cuts |
| `js/defense.js` | IA défensive : man, zone, interceptions, layout, double team |
| `js/throwing.js` | Lancers (normal, passe haute) : trajectoire, erreur, choix de passe de l'IA |
| `js/stats.js` | Statistiques du match et résumé de fin de partie (MVP) |
| `js/events.js` | Réception, interception, turnover, point, sélection du défenseur |
| `js/sim.js` | Boucle de simulation : déplacements, stall count, vol du disque |
| `js/point.js` | Lancement d'un point |
| `js/plays.js` | Plays de départ (attaque et défense) |
| `js/fx.js` | Sons synthétisés, particules, secousses, vibrations |
| `js/pull.js` | Le pull : visée, courbe, jauge de puissance, réception et brick |
| `js/replay.js` | Ralenti du dernier point, célébration après un point |
| `js/render.js` | Dessin du terrain, des joueurs et des repères |
| `js/ui.js` | HUD et menus |
| `js/account.js` | Compte joueur : création, connexion, sauvegarde automatique du profil en ligne |
| `js/systems.js` | Systèmes de jeu perso : format, validation, et leur exécution par l'IA (attaque et défense) |
| `js/editor.js` | Éditeur « Mes systèmes » : terrain où l'on place les joueurs et dessine les courses |
| `js/endless.js` | Mode infini : matchs en 2 points de plus en plus durs, record et classement mondial |
| `js/series.js` | Mini-tournoi (3 adversaires avec chacun leur style, progression mémorisée) |
| `js/practice.js` | Mode entraînement (cibles, vent, défenseur) |
| `js/achievements.js` | Profil : statistiques de carrière et succès |
| `js/tuto.js` | Tutoriel interactif en 7 étapes |
| `js/controls.js` | Souris, clavier, tactile, joystick virtuel |
| `js/gamepad.js` | Manette (API Gamepad) |
| `js/net.js` | Multijoueur en ligne (PeerJS) : salle d'attente, spectateurs, reconnexion, émojis |
| `js/main.js` | Boucle principale et démarrage |
| `js/pwa.js` | Installation sur l'écran d'accueil (bouton « Installer ») |
| `sw.js` | Service worker : garde une copie des fichiers pour jouer hors connexion |
| `manifest.webmanifest`, `icons/` | Nom, icônes et affichage de l'application installée |
| `tools/simulate.js` | Matchs IA contre IA sans navigateur : `node tools/simulate.js 20` |
| `tools/test/` | Suite de tests (voir « Tests ») |

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

**Ménage après la bascule**
- Dans Metered, supprime l'ancien identifiant fixe (il était visible dans l'ancien site), voire le compte ;
- désactive GitHub Pages (*Settings → Pages*), supprime `.github/workflows/deploy.yml` et les secrets `TURN_*` du dépôt.

**En local** : `npx wrangler dev` lance le site et `/api/turn`, avec un fichier `.dev.vars` (ignoré par Git) contenant les deux variables.
Avec un simple serveur de fichiers, le jeu retombe sur `js/secrets.js` (copie de `js/secrets.example.js`, ignoré par Git) ou sur des serveurs sans relais.

## Tests

`tools/test/run.mjs` vérifie le jeu de bout en bout. Les fichiers `*.test.mjs` de `tools/test/` :

| Fichier | Ce qui est vérifié |
|---|---|
| `rules.test.mjs` | Matchs IA contre IA sans blocage, chiffres réalistes, interceptions (1 sur 3), Callahan, mode infini, tournoi |
| `account.test.mjs` | Comptes côté serveur : création, empreinte du mot de passe, connexion, sauvegarde, essais limités, pseudo réservé au classement |
| `ui-account.test.mjs` | Comptes dans le navigateur : création sur un appareil, connexion sur un autre, profil retrouvé, déconnexion |
| `systems.test.mjs` | Systèmes perso : validation, placement autour du disque, matchs IA qui les jouent, exclus du mode infini |
| `ui-systems.test.mjs` | Éditeur dans le navigateur (ordinateur et téléphone) : placer, dessiner une course, enregistrer, choisir avant un point |
| `code.test.mjs` | Aucun nom de fonction ou de constante déclaré dans deux fichiers |
| `worker.test.mjs` | Serveur : relais TURN (sécurité, erreurs), classement (tri, scores impossibles refusés, pseudos nettoyés) |
| `ui.test.mjs` | Dans Chromium : menus, section Solo, mode infini jusqu'au classement, menu en jeu, signalement, tutoriel, entraînement, lance-pierre sur téléphone |
| `online.test.mjs` | Deux onglets : salle d'attente, équipes, pull, passes de l'invité, pause pour tous, départ d'un joueur |

```bash
node tools/test/run.mjs --quick                 # sans navigateur (quelques secondes)
cd tools/test && npm install && npx playwright install chromium && cd ../..
node tools/test/run.mjs                         # tout (environ 1 minute)
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
