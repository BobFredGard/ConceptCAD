# Recompiler le noyau OCCT de ConceptCAD

Ce dossier fabrique, **à côté** du moteur en service, un noyau OpenCascade (WebAssembly) choisi par
nous. L'application ne change pas de moteur : `occt/v3` reste intact tant qu'un nouveau noyau n'a pas
passé tous les tests.

## Le moteur en service

`occt/v3` : **libcascade 3.1** (taucad/opencascade.js), **OCCT 8.0.1**, Emscripten 6.0.5, exceptions
WebAssembly natives (Chrome 95+, Firefox 100+, Node 22+). Image Docker
`ghcr.io/taucad/opencascade.js:single-threaded`, recette `recettes/conceptcad-v3.yml`.
L'empreinte exacte de l'image est dans `occt/v3/PROVENANCE.txt`.

Ce que la recette ajoute au noyau publié (`extras/conceptcad_extras.cpp`, liaisons écrites à la main) :

- **`CCFaceOffset`** — `BRepOffset_MakeOffset` avec `SetOffsetOnFace` (décalage face par face).
  Absent des noyaux publiés : la liaison automatique échoue sur `GetAnalyse()`, déclarée mais jamais
  écrite dans OCCT. On n'expose que l'utile.
- **`CCText`** — conversion UTF-8 ⇄ `TCollection_ExtendedString` (noms XCAF accentués).
- **`CCStatic`** — `Interface_Static` par chaînes (`write.step.schema` = `AP242DIS`, unités…).

Toutes les classes sont gardées ; on taillera plus tard pour la taille.

## Fabriquer un moteur

Prérequis : **Docker Desktop** installé et lancé (voir plus bas), ~15 Go libres sur C:.

```
node occt-build/build.cjs v3          # → occt-build/out/v3/ : colle, .wasm, compat-v3.json, PROVENANCE.txt
```

`work/` et `out/` ne vont pas dans Git (trop gros). `PROVENANCE.txt` note l'empreinte exacte de l'image
utilisée, pour pouvoir refaire le moteur à l'identique.

## Essayer un moteur sans toucher à `occt/`

```
node tools/ci-moteur.cjs occt-build/out/v3              # npm run ci avec ce moteur
node tools/ci-moteur.cjs occt-build/out/v3 --complet    # suite complète
node tools/ci-moteur.cjs occt-build/out/v3 -- tests/test_x.cjs
```

Les tests chargent leur noyau par `tests/noyau.cjs`, qui lit `occt/v3` ou le dossier de la variable
`OCCT_DIR`. Une fois le moteur validé : `node occt-build/installer.cjs` le copie dans `occt/v3`.

## Le traducteur `compat-v3`

`src/` écrit ses appels au noyau dans le langage d'opencascade.js 1.1.1 (`new oc.gp_Pnt_3(…)`,
`IsValid_1`…). `compat-v3.cjs` les fait parler au noyau, sans toucher à `src/` : noms suffixés fournis à
la demande (prototypes « de repli » : seul un nom absent passe par eux), arguments complétés ou ôtés
d'après les signatures du `.d.ts` (`compat-v3.json`), poignées transparentes (`Handle_X_2(o)` → o,
`get()` → l'objet, nulle → `IsNull()` vrai), `Handle_Message_ProgressIndicator` →
`Message_ProgressRange`, sorties « enveloppe » → `returnValue`, typedefs renommés
(`TopTools_ListOfShape` → `NCollection_List_TopoDS_Shape`…). Une surcharge 1.1.1 sans équivalent reste
absente (l'app la teste : `BRepOffsetAPI_MakeThickSolid_2` → nouvelle Coque).
`compat-v3.cjs` est recopié dans `occt/v3` par `installer.cjs` ; `tests/test_moteur_v3.cjs` vérifie
que la copie est à jour.

**`sonde-1.1.1.json`** est la liste, figée, des appels 1.1.1 à traduire, avec leur nombre d'arguments
(257 constructeurs, 146 statiques, 812 méthodes). Relevée le 05/11/2026 sur opencascade.js 1.1.1 juste
avant le retrait de ce noyau, elle sert d'entrée à `build.cjs` pour refaire `compat-v3.json`.
Un appel suffixé apparu dans `src/` depuis cette date et qui n'y figure pas passe par les prototypes de
repli ; s'il faut compléter ses arguments, l'ajouter à la main dans ce fichier.

**Messages d'erreur** : les exceptions WebAssembly natives reçoivent `message` / `toString` =
« OCCT <type> : <texte> » (`compat-v3`, via `getExceptionMessage`), au lieu de « [object WebAssembly.Exception] ».

## Docker Desktop sous Windows

Docker Desktop utilise WSL 2 : `wsl --install` (redémarrage), puis l'installeur de Docker Desktop. Le
lancer avant `build.cjs`. L'image pèse plusieurs Go, téléchargés une seule fois.

## Noyau multicœur (`occt/mt`)

`node occt-build/build.cjs mt` puis `node occt-build/installer.cjs mt`. Même recette que `conceptcad-v3.yml`, sur l'image
`ghcr.io/taucad/opencascade.js:3.1.0-multi-threaded` avec `--config multi-threaded`, plus `-pthread -sSHARED_MEMORY=1`,
une réserve de 8 fils au plus (`-sPTHREAD_POOL_SIZE`, égale à `OCCT_MT_FILS_MAX` de `src/96`) et `-sENVIRONMENT=web,worker,node`.

La page le choisit seule si elle est isolée (`crossOriginIsolated`) et si le PC a au moins 4 cœurs : en-têtes de
`tools/serve.json` avec `Server.bat`, service worker `isolation-sw.js` sur le site, à partir de la deuxième ouverture.
Adresse `?mt=0` : noyau normal ; `?mt=8` : 8 fils. Sur ce noyau, seuls les booléens utilisent les fils ; le maillage
reste comme avant pour ne pas changer la FAO, et les workers gardent le noyau normal.

Suite sur ce noyau : `OCCT_FILS=4 OCCT_DIR=occt/mt node tests/run.cjs`. Échecs attendus, propres à ce montage de test :
`test_fuite_noyau` (retouche de la colle normale), `test_suppression_face_worker` et `test_filet_tache_fond` (leurs workers
de test chargent le noyau testé, jamais l'application), `test_barquette_120` (seuils mémoire du noyau normal).
