[ConceptCAD](../../README.md) › [Manuel](README.md) › Développement

# Développement

## Lancer depuis les sources

Il faut Node.js et Git LFS : le dépôt stocke les gros binaires (`occt/v3/*.wasm`, `occt/mt/*.wasm`, `Exemples/*.conceptcad`, `Exemples/*.miniFusion`, `Exemples/*.step`, `Exemples/*.stp`) via **Git LFS**. Après un clone : `git lfs install` puis `git lfs pull`.

```bat
Server.bat
```

`Server.bat` sert le dossier sur `http://localhost:3000` (et sur le réseau local, pour essayer depuis un téléphone : `http://<adresse du PC>:3000/ConceptCAD.html`). Il envoie les en-têtes qui permettent le noyau multicœur. N'importe quel serveur statique convient aussi, avec un seul cœur sans ces en-têtes :

```bash
npx serve . -l 3000
```

## Organisation du dépôt

| Chemin | Rôle |
|---|---|
| `src/*.js` | **Les sources** : 200 fichiers concaténés dans l'ordre alphabétique (noyau, esquisse, fonctions 3D, assemblage, FAO découpée par domaine, mise en plan, rendu, interface téléphone `99-mobile*.js`). C'est ici qu'on travaille. |
| `ConceptCAD.html` | **Livrable généré** par `node build.js`. On n'édite jamais son script à la main. |
| `PostPro/` | Une fiche par machine (`siemens-630.js`, `siemens-1520.js`, `fagor-8065.js`). Nouvelle machine = copier une fiche, la modifier, `npm run build`. |
| `tests/` | 353 suites Node lancées en parallèle (`npm run ci:full`), 175 rapides (`npm run ci`), non-régression des parcours FAO (`npm run parcours`), tests de référence (`tests/oracle/`, [docs/oracle.md](../oracle.md)). |
| `tests/browser/` | Playwright dans un vrai Chromium : parcours critiques et Rendu (`npm run test:browser`, seul projet lancé par la CI GitHub, déclenchée à la main) et carte graphique réelle (`npm run test:gpu`, en local). |
| `tools/` | Lint du script concaténé (`npm run lint`), serveur MCP, **captures du README** (`npm run captures`), **fichier autonome** (`npm run autonome`). |
| `occt/`, `threejs/` | Noyau OpenCascade WebAssembly (`occt/v3` : OCCT 8), rendu three.js. |
| `occt-build/` | Fabrication du noyau (Docker) et traducteur des appels : voir `occt-build/README.md`. |
| `docs/` | **Manuel** (`docs/manuel/`), captures du README et du manuel (`docs/captures/`), analyses, tableaux de référence. |

## Livrer une version

1. modifier `src/` ;
2. `node build.js` ;
3. `npm run ci` (build à jour, syntaxe, tests rapides, lint) pendant le travail, `npm run ci:full` (suite complète) avant de livrer ; tous deux doivent être verts ;
4. incrémenter `APP_VER` (`src/00-entete-et-outils.js`), ajouter une entrée au CHANGELOG, mettre à jour la page du manuel concernée (`docs/manuel/`), puis `node build.js` ;
5. commit, push et tag annoté `V0.x.y`, qui republie le site en ligne.
6. `npm run autonome` refait `ConceptCAD-autonome.html` (trop gros pour Git), à copier ensuite à la place de l'ancien sur le partage Dropbox, pour que le lien du README reste le même.

**Tests ciblés** : `npm run ci` ne lance que les tests rapides **touchés par la modification** (`tests/run-cible.cjs`). Chaque passage d'une suite note les fonctions de `src/` qu'elle exécute réellement (carte rangée dans `.git/conceptcad-carte-tests.json`, partagée par tous les worktrees) ; au tri suivant, une suite est relancée si une ligne modifiée tombe dans ce qu'elle exécute, si son fichier ou un fichier qu'elle cite a changé, si elle était rouge, ou si elle n'a jamais été relevée. Tout est relancé quand la modification touche tout le monde (code exécuté au chargement, fichier source ajouté ou retiré, noyau `occt/`, `tests/appvm.cjs`…). Un commentaire seul, une fonction ou une constante toute neuve ne relancent rien par eux-mêmes ; le numéro de version (`APP_VER`, `CACHE_VER`, `FORMES_VER`) ne relance que les suites qui le vérifient ; une suite qui lit elle-même un fichier de `src/` n'est relancée que si ce fichier change. Le tri signale le code modifié qu'aucune suite n'exécute (aucun test ne le vérifie). `node tests/run-cible.cjs --liste` montre le tri et ses raisons sans rien lancer ; `npm run test:cible` trie parmi toute la suite ; `npm run ci:rapide` relance toute la suite rapide comme avant.

**Un seul numéro de version** : `APP_VER` = `package.json` = tag Git. `node build.js` recopie la version et les chiffres dans `package.json`, le README, cette page et l'en-tête du CHANGELOG ; `npm run ci` refuse la livraison s'ils sont en retard.

Les captures du README et du manuel sont refaites par `npm run captures` (Chromium sur la carte graphique, exemples Perçages, Crochet et Support Pédale ; les fichiers ne sont jamais réécrits). `npm run captures -- <dossier> rendu` n'en refait qu'une.

---

[← Scripts et pilotage par Claude (MCP)](scripts-mcp.md) · [Sommaire du manuel](README.md)
