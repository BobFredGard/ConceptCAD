# Essai WebGPU dans ConceptCAD — 14/11/2026 (essai seulement, rien de livré)

## Ce qui a été essayé
La « descente d'outil boule » : poser la fraise boule au‑dessus de chaque point d'une grille et trouver la hauteur où elle touche la pièce sans la creuser. C'est le calcul de base de la Finition (crêtes constantes et parallèle), de la Géodésique, du torique et des contrôles de collision.

- Version carte graphique écrite en WGSL (le langage de calcul de WebGPU), avec repli automatique sur le JavaScript actuel si `navigator.gpu` manque ou si la carte refuse (repli vérifié).
- Version 1 : copie fidèle du JavaScript (une grille de « listes par case » préparée sur le processeur). Calcul GPU de 6 à 30 ms, mais la préparation sur le processeur prend ~4 s → peu de gain.
- Version 2 : chaque triangle, arête et sommet de la pièce « imprime » lui‑même sa hauteur sur la grille (maximum atomique). Plus de préparation lourde.

## Mesures — SIRAP-14-002 (copie D:\Copies-PLM), posage USINAGE_3D, Finition T3 boule D6
Pièce : 335 818 triangles, zone 329 × 231 mm. PC : NVIDIA GeForce RTX 5070 Ti, Chrome 157, WebGPU (Direct3D 12).

| Pas de grille | Points | JavaScript | Carte graphique (v2) | Gain |
|---|---|---|---|---|
| 0,7 mm (celui de la Finition) | 156 000 | 4,4 s | 0,10 s | ×44 |
| 0,25 mm | 1,2 million | 6,2 s | 0,18 s | ×35 |
| 0,1 mm | 7,6 millions | 15,9 s | 0,28 s | ×58 |

Détail v2 à 0,1 mm : préparation 72 ms, envoi à la carte 20 ms, calcul 142 ms, relecture 42 ms.
Les transferts mémoire (envoi + relecture) restent petits devant le gain.

Résultat identique au JavaScript : écart nul sur 99,96 % des points ; à 0,7 mm, 4 points sur 156 000 diffèrent de plus de 0,001 mm (au plus 0,0013 mm). Les écarts plus gros à 0,1 mm (2 789 points sur 7,6 millions) sont presque tous au ras d'une paroi verticale : le JavaScript lui‑même change de hauteur si on déplace le point de 0,00002 mm. Pire écart « réel » restant : 0,02 mm, sur des arêtes, dû aux nombres à 7 chiffres de la carte graphique (float32).

## Mais pour l'opération entière
La Finition entière prend ~8,3 s (dont 8,2 s pour les crêtes constantes) :
- ~4 s : préparation des listes de la descente (sur le processeur, refaite à chaque opération) ;
- ~2,5 s : 835 000 descentes, dont seulement ~156 000 sur la grille. Les autres se font une par une le long des passes, chacune dépendant de la précédente : elles ne se regroupent pas telles quelles pour la carte.
→ En branchant seulement la grille sur la carte graphique, on gagne environ 0,5 s sur 8 s. Pour gagner beaucoup, il faut regrouper les descentes une par une en paquets (ou partir d'une grille fine faite par la carte), et donc retoucher l'algorithme des crêtes.
Bonus sans carte graphique : les ~4 s de préparation pourraient être gardées d'une opération à l'autre quand la pièce ne change pas.

## Limites
- Transferts mémoire : petits ici (20 à 40 ms), mais à prévoir si on fait beaucoup de petits appels → regrouper les calculs.
- Précision float32 : environ 0,001 mm près de l'origine locale (coordonnées recentrées sur la pièce) ; pire 0,02 mm sur des arêtes presque verticales. À corriger avant livraison (repasser ces rares points au JavaScript, ou découper le calcul).
- Navigateur : Chrome et Edge sur Windows, NVIDIA et AMD (Direct3D 12). Le Chromium « headless shell » de Playwright n'a pas d'adaptateur ; il faut `channel:'chrome'` pour les tests.
- WebView2 (appli Windows) : même moteur que Chrome 157 (runtime 157.0.4341.46 installé), WebGPU actif par défaut depuis la version 113 → devrait marcher ; non vérifié dans l'appli elle‑même.
- Mac (appli Tauri = WebKit/Safari) : WebGPU seulement à partir de macOS 26 (Safari 26) ; avant → repli JavaScript automatique. Non vérifié.
- Mise en veille de la carte : un calcul trop long (> 2 s) peut être coupé par Windows ; découper les très grosses grilles.

## Autres fonctions qui pourraient en profiter
1. Toutes les descentes d'outil sur grille : torique (`89-fao-torique.js`), faces/intouchables (`89-fao-faces.js`), murs FAO (`89-fao-murs.js`), simulation de collision.
2. Le filtre du brut restant (`eng` dans `faoRestFinish`, un test par point de passe, indépendants) — même méthode, gain probable.
3. La taille de la carte du brut restant (`faoRestMap`, passes des opérations précédentes) — la simulation fait déjà ça en WebGL (`88-fao-79-cartes-gpu.js`).
4. Les crêtes constantes elles‑mêmes, si on regroupe les descentes une par une.

## Fichiers (hors dépôt, rien n'a été commité)
- webgpu-descente.js (v1, listes), webgpu-descente2.js (v2, par primitive) ; mesure3.cjs (`node mesure3.cjs <worktree> <port> chrome`) ; resultat3-chrome.json ; log5.txt (profil de l'opération).
