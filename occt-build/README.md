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

## Écarts déjà connus (lecture des définitions, avant essai réel)

- **v2** : 104 classes utilisées par `src/` toutes présentes ; 71 des 72 constructeurs suffixés
  et toutes les méthodes suffixées existent sous le même nom. Seul manque
  `BRepOffsetAPI_MakeThickSolid_2` (Coque, `src/20-…js`) : OCCT 7.6 l'a remplacé par
  `new BRepOffsetAPI_MakeThickSolid()` + `MakeThickSolidByJoin(…)`. Reste à vérifier à l'exécution
  que chaque `_N` désigne toujours la même surcharge.
- **v3** : toutes les classes existent, mais **aucun** des 101 appels suffixés ne garde son nom ;
  `Bnd_Box::Get`, `BRepMesh_IncrementalMesh`, `TopoDS` changent aussi. Passer en v3 demande une
  couche d'adaptation dans l'application (chantier à part).

## Installer Docker Desktop (à faire par l'utilisateur, droits administrateur)

1. Télécharger « Docker Desktop for Windows – AMD64 » sur https://www.docker.com/products/docker-desktop/
2. Lancer l'installateur, garder « Use WSL 2 instead of Hyper-V » coché, accepter le redémarrage.
3. Au premier lancement, accepter les conditions ; passer la connexion à un compte (« Skip »).
4. Attendre l'icône baleine **verte** (« Engine running »), puis dans un terminal : `docker run --rm hello-world`.
