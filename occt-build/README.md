# Recompiler le noyau OCCT de ConceptCAD

Ce dossier fabrique, **à côté** du moteur en service, un noyau OpenCascade (WebAssembly) choisi par
nous. L'application ne change pas de moteur : `occt/` reste intact tant qu'un nouveau noyau n'a pas
passé tous les tests.

## Le moteur actuel (constaté le 02/11/2026)

- `occt/opencascade.wasm.wasm` est **octet pour octet** celui du paquet npm `opencascade.js@1.1.1`
  (septembre 2020) : **OCCT 7.4.0p1**, Emscripten 2.0.4. `occt/opencascade.full.js` est sa colle,
  passée en fins de ligne Windows, plus une ligne finale (`globalThis.opencascadeFactory=…`).
  (`docs/noyau-occt-listing.md` dit « 1.1.4 / OCCT 7.5 » : c'est 1.1.1 / 7.4.)
- `occt/opencascade.full.wasm` (50 Mo) n'est **pas utilisé** : c'est le .wasm d'`opencascade.js@2.0.0-beta.b5ff984`.
- Le projet d'origine (donalffons/opencascade.js) est à l'arrêt depuis 2023. Le fork actif est
  **libcascade** (taucad/opencascade.js, v3.1.0 du 13/10/2026) : OCCT 8.0.1, Emscripten 6.0.5.

## Les deux variantes

| | `v2` — même famille que l'actuel | `v3` — version récente |
|---|---|---|
| Image Docker | `donalffons/opencascade.js:2.0.0-beta.b5ff984` (1,8 Go compressée) | `ghcr.io/taucad/opencascade.js:single-threaded` |
| OCCT | 7.6.x (commit bb368e27, avril 2022) | 8.0.1 |
| Emscripten | 3.1.14 | 6.0.5 |
| Appels JS | identiques à l'actuel (`new oc.gp_Pnt_3(…)`, `IsValid_1`…) | **sans suffixes** (`new oc.gp_Pnt(…)`), sorties numériques en « enveloppe », `Handle&` de sortie retirés |
| Exceptions C++ | rattrapées par la colle JS (`-fexceptions`) | natives WebAssembly (Chrome 95+, Firefox 100+, Node 22+) |
| Compilation | OCCT et liaisons déjà compilés dans l'image : **édition de liens seule** | idem (`link`) |
| Recette | `recettes/conceptcad-v2.yml` | `recettes/conceptcad-v3.yml` |

Ce que nos recettes ajoutent aux noyaux publiés (`extras/conceptcad_extras.cpp`, liaisons écrites à la main) :

- **`CCFaceOffset`** — `BRepOffset_MakeOffset` avec `SetOffsetOnFace` (décalage face par face).
  Absent de **tous** les noyaux publiés (1.1.1, 2.0, 3.1) : la liaison automatique échoue sur
  `GetAnalyse()`, déclarée mais jamais écrite dans OCCT. On n'expose que l'utile.
- **`CCText`** — conversion UTF-8 ⇄ `TCollection_ExtendedString` (noms XCAF accentués).
- **`CCStatic`** — `Interface_Static` par chaînes (`write.step.schema` = `AP242DIS`, unités…).

Les deux variantes gardent **toutes** les classes (comme l'actuel) ; on taillera plus tard pour la taille.

## Fabriquer un moteur

Prérequis : **Docker Desktop** installé et lancé (voir plus bas), ~15 Go libres sur C:.

```
node occt-build/build.cjs v2          # → occt-build/out/v2/conceptcad.js + .wasm + PROVENANCE.txt
node occt-build/build.cjs v3          # → occt-build/out/v3/
node occt-build/build.cjs v2 --dry    # rend seulement la recette (occt-build/work/v2/conceptcad.yml)
```

`work/` et `out/` ne vont pas dans Git (trop gros). `PROVENANCE.txt` note l'empreinte exacte de l'image
utilisée : la reporter ici une fois un moteur validé, pour pouvoir le refaire à l'identique.

## Essayer un moteur sans toucher à `occt/`

```
node tools/ci-moteur.cjs occt-build/out/v2              # npm run ci avec ce moteur
node tools/ci-moteur.cjs occt-build/out/v2 --complet    # suite complète
node tools/ci-moteur.cjs occt-build/out/v2 -- tests/proto_face_offset_barquette.cjs
```

L'aiguillage est `tests/occt-moteur.cjs` (variable `OCCT_DIR`) : les tests lisent toujours
`occt/opencascade.full.js` et `occt/opencascade.wasm.wasm`, il redirige ces deux lectures vers le
dossier donné (et ramène une colle « module ES » au format attendu).

## Écarts relevés à la lecture des définitions (avant essai réel)

- **v2** : 104 classes utilisées par `src/` toutes présentes ; 71 des 72 constructeurs suffixés
  et toutes les méthodes suffixées existent sous le même nom. Seul manque
  `BRepOffsetAPI_MakeThickSolid_2` (Coque, `src/20-…js`) : OCCT 7.6 l'a remplacé par
  `new BRepOffsetAPI_MakeThickSolid()` + `MakeThickSolidByJoin(…)` (branché dans `occCoqueThick`,
  l'ancien appel reste prioritaire). À l'exécution, quelques `_N` ont changé de sens : d'où
  `compat-v1` (voir Résultats).
- **v3** : toutes les classes existent, mais **aucun** des 101 appels suffixés ne garde son nom ;
  `Bnd_Box::Get`, `BRepMesh_IncrementalMesh`, `TopoDS` changent aussi. Passer en v3 demande une
  couche d'adaptation dans l'application (chantier à part).

## Résultats mesurés (03/11/2026)

Images figées par empreinte dans `build.cjs` :
v2 `sha256:3069f4c2…0524d` (construction 17,5 min), v3 `sha256:d7bf97ad…900b` (9,1 min).
Les images occupent ~21 Go sous Docker.

| | actuel (1.1.1) | v2 (OCCT 7.6) | v3 (OCCT 8.0.1) |
|---|---|---|---|
| .wasm | 65,9 Mo (13,9 gzip) | 50,3 Mo (13,8 gzip) | 42,8 Mo (11,9 gzip) |
| CI rapide | 89/89 | 88/89 (avec `compat-v1`) | 88/89 (avec `compat-v3`, voir plus bas) |
| Suite complète | 233/233, 110 s | 230→231/233, 124 s | — |
| `CCFaceOffset` Barquette | absent | **juste** (jointure « intersection ») | juste sur une boîte |

**Couche de compatibilité `compat-v1`** (v2) : OCCT 7.6 ajoute en fin d'appel un `Message_ProgressRange`
ou un booléen à ~250 méthodes, et renumérote quelques surcharges (`BRepPrimAPI_MakeBox_1..4`,
`TColgp_Array1OfPnt_4`, `BRepTools.Write_2`…). `build.cjs` sonde les deux noyaux (appels de `src/`
**et** de `tests/`) et écrit `out/v2/compat-v1.json` ; `tests/occt-moteur.cjs` l'applique au
chargement. Pour adopter v2 dans l'application, il faudra soit embarquer cette couche (navigateur
+ worker de suppression de face), soit corriger les appels une fois pour toutes.

**Écarts restants de la suite complète sur v2 :**
- `test_conge_tangent` : congé R10 sur une rainure de demi-largeur 6 — solide **réellement
  invalide** ; l'actuel le laisse passer (contrôle face par face), OCCT 7.6 le refuse. Avec un
  rayon valide (R3–R5), c'est l'**actuel** qui échoue au rejeu et v2 qui réussit : défaut latent
  du moteur actuel, test laissé tel quel.
- `test_suppression_face_worker` (cas 3) : la face « pathologique » de Cavité Usinage (10 min
  puis plantage avec l'actuel) est **refusée proprement en 0,7 s** par v2 au lieu d'attendre le
  délai. Changement de comportement (meilleur), le test attend l'ancien.
- `test_step_schema` : réglé par la sonde étendue à `tests/` (`TopoDS_Shape.Moved` + booléen).

**Vitesse :** le cumul des tests est ~25 % plus long sur v2 (2 774 s contre 2 211 s, en
parallèle donc bruité). Certains calculs accélèrent nettement (congé « rayon » 0,33 s contre
1,97 s, symétrie de congés, FAO sécurité), d'autres ralentissent (filetages surtout).
Mesuré seul (un test à la fois) : `test_filetage_axe` 26 s → 39 s, `test_symetrie_conges`
40 s → 37 s, `test_fao_faces` 41 s → 43 s. Le ralentissement réel se concentre donc sur les
filetages ; ailleurs les deux moteurs se valent.

### v3 (OCCT 8.0.1) avec le traducteur `compat-v3` (03/11/2026)

`occt-build/compat-v3.cjs` fait parler l'application (appels 1.1.1) au noyau v3 sans toucher à `src/` :
noms suffixés fournis à la demande (prototypes « de repli » : seul un nom absent passe par eux),
arguments complétés ou ôtés d'après les signatures du `.d.ts` v3 (`out/v3/compat-v3.json`, généré par
`build.cjs v3`), poignées transparentes (`Handle_X_2(o)` → o, `get()` → l'objet, nulle → `IsNull()` vrai),
`Handle_Message_ProgressIndicator` → `Message_ProgressRange`, sorties « enveloppe » → `returnValue`,
typedefs renommés (`TopTools_ListOfShape` → `NCollection_List_TopoDS_Shape`…). Une surcharge ancienne
sans équivalent v3 reste absente (l'app la teste : `BRepOffsetAPI_MakeThickSolid_2` → nouvelle Coque).
`tests/occt-moteur.cjs` adapte aussi la colle (module ES d'Emscripten 6 : `import.meta`, `import("node:module")`).

| | actuel | v2 | v3 |
|---|---|---|---|
| CI rapide | 89/89 | 88/89 | **88/89** |
| Suite complète | 233/233 | 231/233 | **231/233** (mêmes deux écarts que v2, expliqués plus haut) |
| Cumul des tests (parallèle, bruité) | 2 211 s | 2 774 s | 1 866 – 2 086 s |
| Barquette (`CCFaceOffset`, intersection) | — | juste, 135 ms | **juste, 51 ms** |
| `test_filetage_axe` seul | 26 s | 39 s | 55 s |

### Essai dans le navigateur : `ConceptCAD.html?noyau=v3`

Interrupteur caché (`OCCT_V3`, `src/96-noyau-occt-tiers-lgpl.js`) : avec `?noyau=v3` dans l'adresse
(http seulement), la page importe `occt-build/out/v3/conceptcad_v3.js`, charge `compat-v3.cjs` + sa
table et enveloppe la fabrique ; le worker de suppression de face fait de même (`import()` de la colle
ES dans le worker). L'état affiche « [ESSAI noyau v3 — OCCT 8.0.1] ». Sans le paramètre : rien ne change.
`occt-build/out/` n'est pas dans Git : l'essai demande un `node occt-build/build.cjs v3` préalable.

- Tests navigateur sur v3 : `MF_NOYAU=v3 npx playwright test -c tests/browser/playwright.config.cjs --project=chromium`
  → **17/17** (03/11/2026).
- Suppression de face au worker (Perçages.step, cylindre) : même solide qu'avec l'actuel (9 faces, 87 452,9 mm³).

Reste pour l'adopter : essai réel par Fred, filetages plus lents (hélices) à regarder, messages
d'erreur du noyau (exceptions WebAssembly natives, Chrome/Edge 95+, Firefox 100+), publication des
fichiers v3 avec l'application, puis réécriture progressive des appels au format v3 et retrait du traducteur.

## Installer Docker Desktop (à faire par l'utilisateur, droits administrateur)

1. Télécharger « Docker Desktop for Windows – AMD64 » sur https://www.docker.com/products/docker-desktop/
2. Lancer l'installateur, garder « Use WSL 2 instead of Hyper-V » coché, accepter le redémarrage.
3. Au premier lancement, accepter les conditions ; passer la connexion à un compte (« Skip »).
4. Attendre l'icône baleine **verte** (« Engine running »), puis dans un terminal : `docker run --rm hello-world`.
