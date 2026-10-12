# Ultimate Frisbee – prototype

Petit jeu d'ultimate en vue du dessus, jouable dans le navigateur (ordinateur et téléphone), en solo contre l'IA (match simple ou mini-tournoi), ou jusqu'à 10 en ligne (plus des spectateurs). Un tutoriel interactif présente les bases, un mode entraînement permet de s'exercer, et un profil garde tes statistiques et tes succès. Le jeu s'installe sur l'écran d'accueil d'un téléphone (application web) et le solo marche hors connexion. Se joue à la souris, au clavier, au doigt ou à la manette. Aucun outil de compilation : ce sont de simples fichiers HTML, CSS et JavaScript.

## Lancer le jeu en local

- **Le plus simple** : ouvre `index.html` dans ton navigateur.
- **Pour tester le jeu en ligne entre deux onglets**, sers le dossier avec un petit serveur, par exemple `python -m http.server 8000`, puis ouvre http://localhost:8000.

## Organisation du code

Les scripts sont chargés dans cet ordre par `index.html` et partagent le même espace global.

| Fichier | Rôle |
|---|---|
| `functions/api/turn.js` | Fonction Cloudflare : identifiants TURN temporaires (la clé secrète reste côté serveur) |
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

## Hébergement et relais TURN

Le jeu en ligne passe par une connexion directe entre les deux navigateurs. En 4G/5G ou sur un réseau strict, il faut un relais TURN : [Metered](https://www.metered.ca/) (gratuit jusqu'à 20 Go par mois).

Le site est hébergé sur **Cloudflare Pages**. La petite fonction `functions/api/turn.js` tourne chez Cloudflare (pas dans le navigateur) :
elle garde la clé secrète Metered et donne au jeu des identifiants **temporaires** (8 h, renouvelés automatiquement).
Rien de secret n'apparaît dans le site ni dans Git.

**Mise en place (une seule fois)**
1. Crée un compte sur [dash.cloudflare.com](https://dash.cloudflare.com) → *Workers & Pages → Create → Pages → Connect to Git*, choisis ce dépôt.
2. Réglages du build : *Framework preset* **None**, *Build command* **vide**, *Build output directory* **/** .
3. *Settings → Variables and Secrets* (environnement Production) :
   - `METERED_APP` (texte) : le nom de l'application Metered, ce qui est avant `.metered.live` ;
   - `METERED_SECRET_KEY` (type **Secret**) : la clé secrète du tableau de bord Metered (*Developers → Secret Key*).
4. Redéploie (*Deployments → Retry deployment*), ouvre le site `…pages.dev`, puis *En ligne → 📶 Tester la connexion* : « relais OK ».

Ensuite chaque push sur `main` met le site à jour automatiquement.

**Ménage après la bascule**
- Dans Metered, supprime l'ancien identifiant fixe (il était visible dans l'ancien site) ;
- désactive GitHub Pages (*Settings → Pages*) et supprime le workflow `.github/workflows/deploy.yml` et les secrets `TURN_*` du dépôt.

**En local** : `functions/` ne tourne pas avec un simple serveur de fichiers ; le jeu retombe alors sur `js/secrets.js`
(copie de `js/secrets.example.js`, ignoré par Git) ou, sans lui, sur des serveurs publics sans relais.
Pour tester la fonction : `npx wrangler pages dev .` avec un fichier `.dev.vars` (ignoré par Git) contenant les deux variables.

## Publier une nouvelle version

```bash
git add -A
git commit -m "Description du changement"
git push
```

Le site est mis à jour une à deux minutes après le push. L'onglet *Deployments* du projet Cloudflare Pages montre l'avancement.

## Application installable

Le site est une application web installable : sur Android (Chrome) un bouton « Installer le jeu » apparaît dans le menu,
sur iPhone il faut passer par Partager → « Sur l'écran d'accueil ». Une fois installé, le jeu s'ouvre en plein écran et en paysage.
Le service worker charge toujours la dernière version quand il y a du réseau, et sert la copie gardée sinon.
**Si tu ajoutes un fichier JS**, ajoute-le aussi à la liste `FILES` de `sw.js` pour qu'il soit disponible hors connexion.
