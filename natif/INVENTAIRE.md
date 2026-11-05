# Ce qui reste à réécrire

Base : `src/` en V0.64.3, 82 602 lignes (`node natif/mesures/inventaire.cjs`). Les durées sont une **estimation de jugement**,
pas une mesure : temps plein d'une personne aidée par l'IA, validation par Fred comprise. Le seul point de repère réel est
ce premier morceau : une session pour environ 1 100 lignes de géométrie traduites, sur le chemin le plus simple.

| Domaine | Lignes de `src/` | Fait dans `natif/` | Estimation | Risque principal |
|---|---:|---|---:|---|
| Esquisseur et contraintes | 9 000 | Lecture et tracé des contours (lignes, arcs, cercles). Pas de dessin, pas de solveur, pas de spline | 2 à 4 mois | Le solveur doit retomber sur les mêmes points, sinon les pièces existantes bougent |
| Fonctions 3D et rejeu | 18 153 | Extrusion, découpe, à travers tout, esquisse sur face, plusieurs corps | 4 à 6 mois | Noms persistants, recettes de congés et coques, réglées pièce par pièce depuis des mois |
| Assemblage et composants | 6 168 | Rien | 1,5 à 3 mois | Dépend des noms persistants |
| FAO et posts | 22 648 | Rien | 3 à 5 mois en gardant le calcul JavaScript ; 8 à 14 mois en le traduisant | Voir plus bas |
| Mise en plan | 11 775 | Rien | 3 à 5 mois | Cotes et souris à refaire entièrement, sortie PDF/DXF |
| Rendu réaliste | 3 149 | Rien | 1 à 3 mois | Le moteur à rayons actuel vit dans le navigateur : à remplacer, rendu différent |
| Import, export, fichiers | 1 840 | Lecture seule du `.conceptcad` | 2 à 4 semaines | Écrire le fichier sans perdre ce que le natif ne connaît pas encore |
| Interface et vue 3D | 9 869 | Une fenêtre, un bouton, une liste de cotes | 3 à 5 mois | Panneaux, arbre, annulation, sélection : tout est à refaire |
| **Total** | **82 602** | environ 2 % | **1,5 à 3 ans** | |

Plusieurs sessions en parallèle peuvent raccourcir l'écriture. La validation par Fred ne se parallélise pas, et c'est elle
qui fixera le rythme réel.

## Ce qui ne peut pas être repris tel quel

- **Interface** : tout le HTML, le CSS et les panneaux (`document.`, `innerHTML`). À refaire avec une bibliothèque de fenêtres.
- **Vue et simulation** : Three.js et les shaders WebGL. La simulation GPU (environ 3 000 lignes) devra passer à OpenGL : la logique se garde, pas le code.
- **Rendu à rayons** : `three-gpu-pathtracer` est lié au navigateur.
- **Ce qu'on perd avec un `.exe`** : la version téléphone (`99-mobile`), l'ouverture sans installation, la page GitHub, Mac et Linux. Tant que les deux versions vivent, chaque correction est à faire deux fois.
- **278 suites de tests** écrites en JavaScript contre le code de `src/`. Elles restent une référence, mais il faut comparer les résultats des deux côtés, comme `natif/mesures/banc.cjs` le fait déjà pour le volume et les faces.

## Parcours FAO validés par Fred : ne pas les traduire

Traduire les parcours en C++ est le plus gros risque de toute la réécriture. Sur le même calcul, le navigateur et Windows
n'utilisent pas exactement les mêmes fonctions de mathématiques (sinus, arc tangente, puissance) : l'écart est minuscule, mais
un parcours enchaîne des décisions (ce point est-il dedans ? ce passage est-il libre ?). Un écart au dernier chiffre peut faire
basculer une décision, et donc changer une trajectoire déjà validée, sans erreur visible. Cela reste à mesurer si le choix se pose ;
le fichier `tests/parcours/reference.json` servirait d'étalon.

**Le JavaScript peut être gardé pour le calcul FAO.** Le comptage dans `src/` le montre :

| Partie de la FAO | Lignes | Dépend du navigateur ? |
|---|---:|---|
| Calcul des parcours (`88-fao-10, 30, 55, 90, 92`, `89-fao-cretes, torique`) | 8 011 | Non : ni Three.js, ni noyau, ni page |
| Presque pur, quelques lignes à isoler (`88-fao-00, 50, 81`, `89-fao-chanfrein, contour, geodesique`) | 2 910 | 1 à 4 lignes par fichier |
| Posts (`PostPro/*.js`, `88-fao-60`) | 719 + posts | Déjà des scripts ; 16 lignes de Three.js à isoler |
| Simulation et matière | environ 3 000 | Oui, GPU |
| Interface, sélection, posage, perçage, murs, faces | environ 8 000 | Oui, à refaire |

Preuve déjà en place : `tests/parcours/calcul.cjs` recalcule de vraies opérations **hors navigateur**, dans Node, avec les
stubs existants. La bonne architecture serait donc un logiciel natif qui lance un petit moteur JavaScript (Node ou V8, licences
MIT et BSD) **seulement pendant un calcul FAO**, avec le code des parcours inchangé, et compare à `reference.json`.
Pas encore essayé depuis le `.exe` : il faudra lui fournir le maillage (aujourd'hui donné par le noyau WebAssembly) et vérifier
que les parcours sortent identiques.

Le même principe peut servir pour les scripts (`53-scripts`). Il ne convient pas à l'esquisseur ni au rejeu, qui doivent parler
au noyau à chaque instant.
