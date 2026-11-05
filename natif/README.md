# ConceptCAD natif : premier morceau Windows

Essai d'un vrai `.exe` Windows, sans navigateur, qui ouvre un `.conceptcad`, rejoue les fonctions simples, affiche le solide
en 3D et recalcule quand on change une cote. Ce n'est pas un produit : environ 2 % du travail total ([INVENTAIRE.md](INVENTAIRE.md)).

Rien ici ne touche à `src/`, à `ConceptCAD.html` ni à la version du logiciel.

## Ce que sait faire le programme

- Ouvrir un `.conceptcad` (normal ou compressé) par la vraie fenêtre Windows, ou par son chemin en argument.
- Rejouer : esquisses en lignes, arcs et cercles ; extrusion ; découpe ; « à travers tout » ; esquisse sur une face ; plusieurs corps.
- Afficher le solide : clic gauche ou milieu pour tourner, clic droit pour déplacer, molette pour zoomer.
- Modifier la profondeur d'une extrusion ou d'une découpe, puis recalculer.

**Si une pièce contient autre chose** (congé, cote par formule, répétition, assemblage…), le programme **refuse** et donne la liste.
Il n'affiche jamais un solide faux.

Il ne sait pas : enregistrer, dessiner, sélectionner, annuler, changer une cote d'esquisse (il faudrait le solveur).

## Lancer et reconstruire

```bash
natif/sortie/ConceptCADNatif.exe
```

Reconstruire depuis la racine du dépôt (Visual Studio 2022 et CMake nécessaires) :

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File natif\construire.ps1
```

`.tiers/`, `sortie/` et `mesures/brut/` restent hors de Git. Le dossier `sortie/` pèse 59 Mo avec les bibliothèques ; `.tiers/` 1,5 Go.

## Choix des outils

| Besoin | Choix | Pourquoi | Licence |
|---|---|---|---|
| Noyau de CAO | OCCT 8.0.1, binaires officiels du dépôt Open-Cascade-SAS | Même noyau et même version que le navigateur : c'est ce qui rend les résultats comparables | LGPL 2.1 avec exception Open CASCADE |
| Vue 3D | Module de visualisation d'OCCT (OpenGL) | Déjà fourni, rien à ajouter | Idem |
| Fenêtres | Windows pur (Win32), vraie fenêtre de choix de fichier | Rien à installer, le plus petit possible | Fait partie de Windows |
| Lecture du fichier | nlohmann/json, zlib | Garde l'ordre des clés, dont dépend le tracé des esquisses | MIT, zlib |
| Calcul multicœur | Mode parallèle d'OCCT (booléens et maillage) | Déjà dans OCCT. Désactivable avec `--sequentiel` | Apache 2 (TBB) |

### Licences : ce qui compte pour une diffusion sur GitHub

- **OCCT** : autorisé en liaison dynamique (DLL à côté du `.exe`), y compris dans un logiciel sous une autre licence. Il faut
  citer la licence dans la documentation et laisser la possibilité de remplacer les DLL. **À faire avant toute diffusion du `.exe`** : ajouter ces notices.
- **Binaires officiels d'OCCT** : ils embarquent aussi FreeImage, FreeType, OpenVR et une ancienne version de FFmpeg (3.3.4), chargés mais inutiles ici.
  Ils ont chacun leur licence (FreeImage : FIPL ou GPL au choix ; FFmpeg : compilation LGPL 2.1+). Pour un vrai produit, il vaudra
  mieux compiler OCCT sans eux : moins de fichiers, moins de notices, et plus de vieux FFmpeg. Pas fait : la configuration de la compilation depuis les
  sources a été bloquée par le contrôle de sécurité automatique de la session, d'où les binaires officiels.
- **Qt**, pour la future interface complète : pas installé, pas utilisé. D'après la documentation officielle, Qt 6 existe en
  licence commerciale, en LGPLv3 et en GPLv3 ; certains modules ne sont qu'en GPLv3 ou commercial (dont Qt Quick 3D et Qt Graphs).
  Qt Widgets en liaison dynamique serait acceptable pour GitHub. **Non confirmé** : les conditions commerciales récentes et l'obligation de compte pour
  l'installateur, les pages de qt.io n'ayant pas répondu. À relire avant de choisir. wxWidgets (licence très souple) est l'autre candidat.
  Win32 pur ne convient pas pour le grand nombre de panneaux à refaire.

## Protocole de mesure

`node natif/mesures/banc.cjs "<fichier>" <n° de fonction> [tours] [--parite|--plateau|--vitesse]`

Même pièce, même cote et même enchaînement des deux côtés : ouverture, 10 s de repos, mesure, 120 modifications (valeur + 0,05 × i, 20 ms
d'écart), 10 s de repos, mesure. Le navigateur est un vrai Chrome visible, profil neuf, 1400 × 900, sans extension, sur un port libre ; le banc contrôle
que le code servi est bien celui du dépôt. La mémoire est celle de **tous les processus** de chaque côté, relevée comme le fait le Gestionnaire des tâches.

Machine : i9-14900KF, 24 cœurs logiques, 64 Go. Navigateur : V0.64.3, OCCT 8.0.1.

## Résultats

### Même pièce, même résultat

`Exemples/003-50-200-O-Drapeau Outillage Complet` est le seul exemple du dépôt rejoué en entier avec un solide.

| Profondeur | Volume natif (mm³) | Écart avec le navigateur | Faces natif / navigateur | Arêtes natif / navigateur |
|---|---:|---:|---:|---:|
| 4 valeurs (5, 10, 12,5, 30) | 53 007,291 à 10 mm | 4,2 × 10⁻¹⁰ mm³ au maximum | 15 / 15 (7 / 7 à 5 mm) | 76 / 76 (30 / 30 à 5 mm) |

Sur la plaque d'essai (398 faces) : 398 faces, 1 200 arêtes, écart de volume de 2,9 × 10⁻¹⁰ mm³ au maximum.

### Mémoire (tous processus, mémoire propre du programme)

| Pièce | | Repos | Après 120 modifications |
|---|---|---:|---:|
| **Drapeau**, 3 tours | Natif multicœur | 40 à 41 Mo | 55 Mo |
| | Natif 1 cœur | 28 Mo | 34 Mo |
| | Chrome (8 processus) | 458 à 464 Mo | 432 à 449 Mo |
| **Plaque d'essai** (398 faces), 2 tours | Natif multicœur | 165 Mo | 212 à 245 Mo |
| | Natif 1 cœur | 140 Mo | 150 Mo |
| | Chrome | 574 à 581 Mo | 1 102 à 1 144 Mo |

Soit **8 à 11 fois moins** sur la vraie pièce, **3,5 à 5 fois moins** sur la pièce lourde.

Autres façons de compter, sur le Drapeau au repos puis après 120 : mémoire visible partagée comprise, natif 80 → 95 Mo, Chrome 833 → 815 Mo ;
mémoire engagée, natif 327 → 385 Mo (1 cœur 151 → 156 Mo), Chrome 893 → 860 Mo. Selon le compteur, l'écart va donc de **2,2 à 11 fois**.

Jusqu'à 600 modifications sur le Drapeau, le natif se stabilise à 60 Mo ; Chrome monte jusqu'à 706 Mo puis redescend à 450 Mo au repos.

### Vitesse d'un recalcul (médiane de 30, tours courts alternés)

| Pièce | Natif multicœur | Natif 1 cœur | Chrome |
|---|---:|---:|---:|
| Drapeau | 15 ms | 17 ms | 48 à 50 ms |
| Plaque moyenne (64 poches) | 640 à 658 ms | 760 à 770 ms | 718 à 731 ms |

Environ 3 fois plus rapide sur la petite pièce, mais **seulement 12 % sur la lourde**, et sur un seul cœur le natif y est **plus lent** que Chrome.
Sur les très longues séries de la plaque d'essai, les temps varient trop (natif 3,5 à 5,3 s, Chrome 5,2 à 10,5 s) pour en tirer un chiffre.

### Multicœur

Le gain est modeste : 10 à 15 % sur les calculs de solide, davantage sur le maillage (100 ms au lieu de 164). Il coûte de la mémoire (245 Mo contre 150 sur la plaque d'essai).

### Piste de gain non résolue

Dès que la vue 3D est créée, le même calcul du solide devient nettement plus lent, **avant même d'afficher la pièce** :

| Plaque moyenne, calcul seul | Avant la vue 3D | Après la vue 3D |
|---|---:|---:|
| Multicœur | 300 ms | 530 ms |
| 1 cœur | 300 à 310 ms | 575 ms |

Écartés par l'essai : les réglages du processeur pour les calculs (un fil neuf est aussi lent), et le multicœur (même effet sur 1 cœur).
La cause reste inconnue ; le chargement du pilote graphique est le principal suspect. Le rejeu de Chrome étant à environ 560 ms, séparer le calcul de l'affichage
(par exemple dans un second processus) pourrait donner **près de 2 fois plus vite** sur les pièces lourdes. Non essayé.

### Ce qui avantage le natif dans ces chiffres

- Le natif n'a ni sélection, ni tracé des arêtes, ni arbre, ni annulation, ni cache, ni panneaux. Le produit complet pèsera plus : 100 à 200 Mo sur une petite pièce à
  vue de nez, **non mesuré**. Le côté navigateur, lui, contient déjà tout le logiciel.
- Une seule vraie pièce de Fred est mesurée ; les plaques sont des pièces d'essai générées (`mesures/piece-lourde.cjs`).

## Vérifié

Avec `mesures/verifier-fenetre.ps1`, vrai clavier et vraie souris sur le `.exe` final : Ctrl+O, vraie fenêtre « Ouvrir une pièce ConceptCAD », pièce
ouverte (53 007,291 mm³, 15 faces), rotation à la souris, cote à 25 mm et Recalculer (175 239,634 mm³, 15 faces), fermeture propre.

## Pas vérifié

- Un autre PC sans Visual Studio, une carte graphique faible, un écran à forte mise à l'échelle.
- Le volume à 25 mm n'a pas été comparé au navigateur (les 4 autres valeurs l'ont été).
- Une reconstruction complète depuis un dossier vide avec téléchargement : le `.exe` final est construit sur les binaires déjà téléchargés.
- La RAM d'un calcul FAO lancé depuis le `.exe` : ce chemin n'existe pas encore.
- Les vraies pièces plus riches : aucune autre pièce de `Exemples/` n'est prise en charge (congés, répétitions, formules, assemblages).
