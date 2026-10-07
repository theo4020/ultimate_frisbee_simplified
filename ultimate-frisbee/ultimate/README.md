# Ultimate Frisbee – prototype

Petit jeu d'ultimate en vue du dessus, jouable dans le navigateur (ordinateur et téléphone), en solo contre l'IA ou à deux en ligne. Aucun outil de compilation : ce sont de simples fichiers HTML, CSS et JavaScript.

## Lancer le jeu en local

- **Le plus simple** : ouvre `index.html` dans ton navigateur.
- **Pour tester le jeu en ligne entre deux onglets**, sers le dossier avec un petit serveur, par exemple `python -m http.server 8000`, puis ouvre http://localhost:8000.

## Organisation du code

Les scripts sont chargés dans cet ordre par `index.html` et partagent le même espace global.

| Fichier | Rôle |
|---|---|
| `js/secrets.js` | Identifiants du relais TURN. **Ignoré par Git.** Copie `js/secrets.example.js` pour le créer. |
| `js/config.js` | Constantes (terrain, vitesses, règles), textes des stratégies et des plays |
| `js/util.js` | Canvas, conversion mètres → pixels, outils mathématiques |
| `js/state.js` | État du jeu : joueurs, disque, configuration de chaque équipe |
| `js/wind.js` | Vent, rafales, dérive du disque, force (break side) |
| `js/offense.js` | IA offensive : handler, dump, stack, cuts |
| `js/defense.js` | IA défensive : man, zone, interceptions, layout, double team |
| `js/throwing.js` | Lancers : trajectoire, erreur, choix de passe de l'IA |
| `js/events.js` | Réception, interception, turnover, point, sélection du défenseur |
| `js/sim.js` | Boucle de simulation : déplacements, stall count, vol du disque |
| `js/point.js` | Lancement d'un point |
| `js/plays.js` | Plays de départ (attaque et défense) |
| `js/fx.js` | Sons synthétisés, particules, secousses, vibrations |
| `js/pull.js` | Le pull : visée, courbe, jauge de puissance, réception et brick |
| `js/render.js` | Dessin du terrain, des joueurs et des repères |
| `js/ui.js` | HUD et menus |
| `js/controls.js` | Souris, clavier, tactile, joystick virtuel |
| `js/net.js` | Multijoueur en ligne (PeerJS) |
| `js/main.js` | Boucle principale et démarrage |
| `tools/simulate.js` | Matchs IA contre IA sans navigateur : `node tools/simulate.js 20` |

## Secrets (relais TURN)

Le jeu en ligne passe par une connexion directe entre les deux navigateurs. En 4G/5G ou sur un réseau strict, il faut un relais TURN, par exemple [Metered](https://www.metered.ca/tools/openrelay/) (gratuit jusqu'à 20 Go par mois).

**En local**
1. Copie `js/secrets.example.js` en `js/secrets.js`.
2. Remplis `TURN_USER` et `TURN_PASS`.

Le fichier `js/secrets.js` est dans `.gitignore`, il ne sera jamais commité.

**En ligne (GitHub Pages)**
1. Dans le dépôt, va dans *Settings → Secrets and variables → Actions → New repository secret* et ajoute `TURN_USER` et `TURN_PASS`.
2. Dans *Settings → Pages*, choisis **Source : GitHub Actions**.
3. À chaque push sur `main`, le workflow `.github/workflows/deploy.yml` génère `js/secrets.js` à partir de ces secrets, puis publie le site.

> ⚠️ Ces identifiants restent visibles par les joueurs dans le code de la page publiée : c'est inévitable pour un jeu qui tourne entièrement dans le navigateur. Les garder hors de Git évite seulement qu'ils traînent dans l'historique public du dépôt. Au pire, quelqu'un pourrait consommer ton quota Metered gratuit.

## Publier une nouvelle version

```bash
git add -A
git commit -m "Description du changement"
git push
```

Le site est mis à jour une à deux minutes après le push. L'onglet *Actions* du dépôt montre l'avancement.
