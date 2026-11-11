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
| `src/*.js` | **Les sources** : 182 fichiers concaténés dans l'ordre alphabétique (noyau, esquisse, fonctions 3D, assemblage, FAO découpée par domaine, mise en plan, rendu, interface téléphone `99-mobile*.js`). C'est ici qu'on travaille. |
| `ConceptCAD.html` | **Livrable généré** par `node build.js`. On n'édite jamais son script à la main. |
| `PostPro/` | Une fiche par machine (`siemens-630.js`, `siemens-1520.js`, `fagor-8065.js`). Nouvelle machine = copier une fiche, la modifier, `npm run build`. |
| `tests/` | 319 suites Node lancées en parallèle (`npm run ci:full`), 150 rapides (`npm run ci`), non-régression des parcours FAO (`npm run parcours`), tests de référence (`tests/oracle/`, [docs/oracle.md](../oracle.md)). |
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

**Un seul numéro de version** : `APP_VER` = `package.json` = tag Git. `node build.js` recopie la version et les chiffres dans `package.json`, le README, cette page et l'en-tête du CHANGELOG ; `npm run ci` refuse la livraison s'ils sont en retard.

Les captures du README et du manuel sont refaites par `npm run captures` (Chromium sur la carte graphique, exemples Perçages, Crochet et Support Pédale ; les fichiers ne sont jamais réécrits). `npm run captures -- <dossier> rendu` n'en refait qu'une.

---

[← Scripts et pilotage par Claude (MCP)](scripts-mcp.md) · [Sommaire du manuel](README.md)
