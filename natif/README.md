# ConceptCAD natif : premier morceau Windows

Essai d'un vrai `.exe` Windows, sans navigateur, qui ouvre un `.conceptcad`, rejoue les fonctions simples, affiche le solide
en 3D et recalcule quand on change une cote. Ce n'est pas un produit : environ 2 % du travail total ([INVENTAIRE.md](INVENTAIRE.md)).

Rien ici ne touche à `src/`, à `ConceptCAD.html` ni à la version du logiciel.

## Ce que sait faire le programme

- Ouvrir un `.conceptcad` (normal ou compressé) par la vraie fenêtre Windows, ou par son chemin en argument.
- Rejouer : esquisses en lignes, arcs et cercles ; extrusion ; découpe ; « à travers tout » ; esquisse sur une face ; plusieurs corps.
- Afficher le solide : clic gauche ou milieu pour tourner, clic droit pour déplacer, molette pour zoomer, comme le navigateur.
- Montrer l'arbre de la pièce (esquisses, corps, fonctions) et un panneau de propriétés, dans une interface sombre aux panneaux déplaçables.
- Survoler et choisir une face ou une arête : surbrillance, forme, aire ou longueur.
- Modifier la profondeur d'une extrusion ou d'une découpe dans le panneau, annuler (Ctrl+Z) et rétablir (Ctrl+Y).
- Afficher une esquisse : double-clic ou Entrée dans l'arbre, puis lignes, arcs, cercles, points, zones fermées, contraintes et cotes, orientés comme dans le navigateur. Échap ou « Terminer l'esquisse » pour sortir.
- Changer une cote d'esquisse : double-clic sur la cote, nouvelle valeur, Entrée. L'esquisse se résout, le solide suit (39 ms sur le Drapeau), et les esquisses posées dessus suivent les arêtes qui bougent. Une valeur impossible est refusée et l'esquisse reste telle quelle. Ctrl+Z, Ctrl+Y et Ctrl+S fonctionnent.

**Si une pièce contient autre chose** (congé, cote par formule, répétition, assemblage…), le programme montre son arbre et la liste de ce qui manque,
mais **ne calcule pas le solide**. Il n'affiche jamais un solide faux.

- Enregistrer (Ctrl+S) et enregistrer sous (Ctrl+Maj+S) sans rien perdre : seul le nombre modifié change dans le fichier, le reste ne bouge pas d'un octet. Copie `.bak` de la version précédente, relecture avant de remplacer le fichier, question avant de fermer une pièce modifiée (● dans le titre), refus si le fichier a changé ailleurs depuis l'ouverture. La date interne du fichier n'est pas mise à jour.

Une profondeur n'est modifiable que si le solide se calcule et si aucune esquisse liée au solide n'est posée de biais par rapport à elle : une telle esquisse suit les arêtes qui bougent, et seul le navigateur sait la recalculer aujourd'hui.

Une cote d'esquisse n'est modifiable que si le solide de la pièce se calcule : **aujourd'hui, seul le Drapeau parmi les 20 pièces d'exemple**. Sur les autres, l'esquisse reste en lecture seule. Le sont aussi les cotes par formule, les cotes nommées et les cotes de référence. Une esquisse qui dépend d'une arête nommée, d'une intersection, d'une autre esquisse, d'un perçage ou d'un axe externe empêche aussi la modification, car le natif ne saurait pas la faire suivre.

Dessiner dans une esquisse modifiable : outils Sélection, Ligne, Rectangle, Cercle et Arc en haut de la vue, case « Grille 1 mm ». Accroches sur les points et les lignes, contraintes posées toutes seules avec guide (horizontal, vertical, perpendiculaire, parallèle, tangent). Glisser un point ou un élément, Suppr pour effacer, double-clic sur un élément pour le coter, clic droit pour finir un tracé, Échap pour revenir à Sélection puis sortir. Ctrl+Z, Ctrl+Y et Ctrl+S suivent. À l'enregistrement, ce qui n'a pas changé garde son texte d'origine.

Il ne sait pas encore : polygone, oblong, ajuster, décaler, congé d'esquisse, outil Cote entre deux éléments, l'outil Coïncident à deux clics, longueur tapée pendant le tracé, fenêtre de sélection, retirer une contrainte, déplacer l'étiquette d'une cote, s'accrocher aux arêtes du solide, supprimer une esquisse enregistrée, esquisse sur un plan de construction, nouvelle pièce. Une cote de référence nommée ou par formule reste figée.

Poser une contrainte : choisir les éléments (Ctrl+clic pour les suivants), puis menu **Contraintes** ou mêmes touches que le navigateur : F1 coïncident ou fusion de deux points, F2 horizontal ou vertical selon la ligne, F3 tangent, F4 égal, F5 parallèle, F6 perpendiculaire, F7 milieu, F8 concentrique, F9 colinéaire, F10 symétrique, F12 fixe, X construction. Une contrainte qui rendrait l'esquisse impossible est refusée, avec la raison : tout revient exactement à l'état d'avant.

Créer une esquisse : menu **Esquisse**, sur le plan XY, XZ ou YZ, ou sur la face plane cliquée (elle suit alors sa face porteuse, comme dans le navigateur). Refermée sans rien dessiner, elle disparaît, comme dans le navigateur. Ctrl+Z annule la création tant qu'elle n'est pas enregistrée. Une esquisse sur plan se dessine aussi sur une pièce dont le natif ne calcule pas encore le solide : sans fonction ni lien, elle n'en dépend pas ; il n'y a donc pas d'esquisse sur face sur ces pièces.

L'annulation du natif revient exactement à l'état d'avant, alors que celle du navigateur résout à nouveau : le résultat peut y différer de très peu.

Différences avec l'esquisse du navigateur : tout est en blanc, car le bleu « encore libre » demande un calcul de plus, non traduit ; pas de splines (un message le dit) ; pas de vue inclinée ; pas de flèches de degrés de liberté ni de bilan de santé ;
pas de bouton pour la grille, masquée comme par défaut dans le navigateur. La pièce derrière l'esquisse n'est qu'un tracé de ses arêtes, et n'apparaît que si le solide est calculé.
Les pointes des cotes d'angle suivent l'arc, alors que celles du navigateur en dévient légèrement.

## Lancer et reconstruire

```bash
natif/sortie/ConceptCADNatif.exe
```

Reconstruire depuis la racine du dépôt (Visual Studio 2022 et CMake nécessaires) :

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File natif\construire.ps1
```

`.tiers/`, `sortie/` et `mesures/brut/` restent hors de Git. Le dossier `sortie/` pèse 73 Mo avec les bibliothèques ; `.tiers/` 1,5 Go.

## Choix des outils

| Besoin | Choix | Pourquoi | Licence |
|---|---|---|---|
| Noyau de CAO | OCCT 8.0.1, binaires officiels du dépôt Open-Cascade-SAS | Même noyau et même version que le navigateur : c'est ce qui rend les résultats comparables | LGPL 2.1 avec exception Open CASCADE |
| Vue 3D | Module de visualisation d'OCCT (OpenGL) | Déjà fourni, rien à ajouter | Idem |
| Fenêtres | wxWidgets 3.3.4, binaires officiels (voir [le plan](PLAN-INTERFACE-ESQUISSE.md)) | Pas de source à joindre, rien à installer, très léger : 4 à 5 Mo de plus que des fenêtres Windows pures. Série 3.3 dite « de développement » par ses auteurs mais jugée bonne pour la production ; choisie pour le thème sombre | wxWindows 3.1 : binaires diffusables à ses propres conditions |
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
| **Drapeau**, fenêtre minimale, 3 tours | Natif multicœur | 40 à 41 Mo | 55 Mo |
| | Natif 1 cœur | 28 Mo | 34 Mo |
| | Chrome (8 processus) | 458 à 464 Mo | 432 à 449 Mo |
| **Drapeau, avec l'interface wxWidgets**, 2 tours | Natif multicœur | 44 Mo | 60 Mo |
| | Natif 1 cœur | 32 Mo | 38 à 39 Mo |
| | Chrome | 459 à 461 Mo | 437 à 439 Mo |
| **Plaque d'essai** (398 faces), fenêtre minimale, 2 tours | Natif multicœur | 165 Mo | 212 à 245 Mo |
| | Natif 1 cœur | 140 Mo | 150 Mo |
| | Chrome | 574 à 581 Mo | 1 102 à 1 144 Mo |

Soit **7 à 11 fois moins** sur la vraie pièce, **3,5 à 5 fois moins** sur la pièce lourde.

Autres façons de compter, sur le Drapeau au repos puis après 120 : mémoire visible partagée comprise, natif 80 → 95 Mo, Chrome 833 → 815 Mo ;
mémoire engagée, natif 327 → 385 Mo (1 cœur 151 → 156 Mo), Chrome 893 → 860 Mo. Selon le compteur, l'écart va donc de **2,2 à 11 fois**.

Jusqu'à 600 modifications sur le Drapeau, le natif se stabilise à 60 Mo ; Chrome monte jusqu'à 706 Mo puis redescend à 450 Mo au repos.

### Vitesse d'un recalcul (médiane de 30, tours courts alternés, 3 tours)

| Pièce | Placement | Natif multicœur | Natif 1 cœur | Chrome |
|---|---|---:|---:|---:|
| Drapeau | Laissé à Windows | 16 ms | 20 à 21 ms | 54 à 57 ms |
| Drapeau | Cœurs rapides pour tous | 15 à 16 ms | 19 à 21 ms | 54 à 55 ms |
| Plaque moyenne (64 poches) | Laissé à Windows | 404 à 458 ms | 447 à 494 ms | 803 à 880 ms |
| Plaque moyenne (64 poches) | Cœurs rapides pour tous | 423 à 443 ms | 488 à 494 ms | 808 à 841 ms |

Environ **3,5 fois plus rapide** sur la petite pièce et **2 fois** sur la plaque moyenne. Sur les très longues séries de la plaque d'essai (398 faces), les temps variaient trop pour en tirer un chiffre, et elles n'ont pas été refaites.

**Correction** : une première mesure donnait seulement 12 % d'écart sur la plaque moyenne (natif 650 ms, Chrome 725 ms). Elle était faussée. Ce processeur a 8 cœurs rapides et 16 économes, et le même calcul
y prend 345 ms contre 585 ms. Windows plaçait le natif sur les cœurs économes. Le programme demande maintenant à Windows de ne pas le traiter comme une tâche de fond, et le banc peut tout placer sur les cœurs rapides (`--rapides`).
Le lien de cause entre cette demande et le gain n'est pas isolé : sans elle, le natif restait parfois sur les cœurs rapides. Les mesures de 345 et 585 ms, elles, sont directes.

### Multicœur

Le gain est modeste : 0 à 15 % sur le calcul de solide, environ 30 % sur le maillage (80 ms au lieu de 122). Il coûte de la mémoire (245 Mo contre 150 sur la plaque d'essai).

### Ce qui avantage le natif dans ces chiffres

- Le natif n'a encore ni esquisseur, ni cache de reconstruction, ni la plupart des panneaux. Le produit complet pèsera plus : 100 à 200 Mo sur une petite pièce à
  vue de nez, **non mesuré**. Le côté navigateur, lui, contient déjà tout le logiciel.
- Une seule vraie pièce de Fred est mesurée ; les plaques sont des pièces d'essai générées (`mesures/piece-lourde.cjs`).

## Vérifié

Avec `mesures/verifier-fenetre.ps1`, vrai clavier et vraie souris sur le `.exe` final : Ctrl+O, vraie fenêtre « Ouvrir une pièce ConceptCAD », pièce
ouverte (53 007,291 mm³, 15 faces), survol en surbrillance, clic sur une face (plane, 3 402 mm²) et une arête (droite, 94,5 mm), fonction choisie dans l'arbre, profondeur à 25 mm dans le panneau
(175 239,634 mm³), Ctrl+Z et Ctrl+Y, rotation, déplacement, zoom, fermeture propre. Le script s'arrête sans rien envoyer si une autre fenêtre passe devant.

Après le passage à wxWidgets, le banc redonne des résultats identiques au navigateur sur les 4 valeurs (écart de 4,2 × 10⁻¹⁰ mm³ au maximum).

Esquisses, sur le `.exe` final :
- `--captures` ouvre les 125 esquisses des 20 pièces et enregistre une image de chacune, sans plantage ni blocage.
- `mesures/captures-navigateur.cjs` produit les mêmes images côté navigateur. Comparaison à l'œil sur 7 esquisses de 6 pièces (Cache Piles, Griffe, Crochet, Drapeau, Support Pédale, Barquette) : géométrie, cotes, contraintes, orientation identiques, à part les différences listées plus haut.
- `mesures/verifier-esquisse.ps1`, vrai clavier et vraie souris sur le Drapeau : double-clic, molette, glissé, Ctrl+F, Échap, Entrée, bouton Terminer, fermeture propre.
- Mémoire propre sur le Drapeau, avec cette dernière version : 42 à 49 Mo pièce ouverte, 46 à 48 Mo dans une esquisse. C'est une lecture rapide au repos, pas le protocole complet du banc.

Enregistrement, sur des copies :
- `mesures/tester-enregistrement.cjs`, 176 contrôles sur les 20 pièces : mêmes octets sans modification ; une profondeur changée sur 12 pièces, seul ce nombre diffère ; retour à la valeur d'origine, même texte ; `.bak` exact ; refus si le fichier a changé ailleurs.
- `mesures/tester-enregistrement-navigateur.cjs` compare le fichier rouvert par le navigateur à la même modification faite dans le navigateur. Les 2 profondeurs du Drapeau, seules modifiables dans le logiciel : aucun champ différent, même volume dans les 3 cas.
- Sur les 11 autres pièces, modifiées seulement par ce test : 3 écarts (Barquette, Cache Piles, Support Pédale), tous sur des profondeurs que la règle refuse. La règle est prudente : elle en refuse aussi 6 qui auraient été justes.
- `mesures/verifier-fenetre.ps1`, vrai clavier et vraie souris : cote changée, Ctrl+S, `.bak`, Ctrl+Z, question à la fermeture, Annuler, Ne pas enregistrer, fichier relu à 175 239,634 mm³. Cet essai a tourné juste avant l'ajout de la règle de modification ; sur la version finale, il s'est arrêté deux fois parce que le PC était utilisé, et n'est pas allé au bout.

Solveur d'esquisse (`BancSolveur`), comparé au navigateur sur les 125 esquisses des 20 pièces : ouverture, cotes une à une, projections déplacées, puis saisies enchaînées avec valeurs impossibles et annulations (582 scénarios, environ 3 135 états, 20 à 33 s contre 350 à 380 s en Node). Références : `mesures/solveur-reference.cjs`.
- **Avec les mêmes sin, cos et atan2 des deux côtés** (`BancSolveurCommunes`, `solveur-reference.cjs --communes`) : 3 133 états sur 3 133 à moins de 10⁻⁹ mm, 0 décision différente sur 1 136. La traduction est donc exacte sur ces essais.
- **Avec les bibliothèques normales** (`BancSolveur`) : seuil fixé à 0,001 mm, 3 115 états sur 3 135 en dessous. 2 décisions différentes sur 1 136.
- **Les 20 états au-delà sont expliqués** : ces 3 fonctions n'arrondissent pas exactement pareil dans Windows et dans Chrome, et puisque tout rentre dans l'ordre quand elles sont communes, il ne reste que cela. Ils touchent 4 pièces (test angle, test esquisse, Griffe, Drapeau), toujours dans des saisies enchaînées de valeurs extrêmes (×0,3 puis ×4). Sur ces esquisses à la limite du possible, une différence au 16ᵉ chiffre fait passer le solveur sur une autre solution, puis tout le reste de la chaîne diverge.
- **Le navigateur fait pareil contre lui-même** (`mesures/solveur-bruit.cjs`) : un dernier chiffre décalé sur ces 3 fonctions donne 1 décision différente et 14 états au-delà de 0,001 mm.

Changer une cote, le solide suivant, sur le Drapeau (`mesures/tester-cotes-navigateur.cjs`) : chaque cote à 4 valeurs, soit 36 modifications comparées entre le navigateur, le navigateur rouvrant le fichier écrit par le natif, et le natif. Aucun refus, aucune décision différente. 33 identiques, 3 écarts :
- e30 à 163,2 : navigateur 82 640 mm³, natif 54 159. De 160 à 176 mm le volume monte de 360 mm³ par mm, ce qui donne 54 159. Le navigateur perd sa découpe, le natif reste logique. La cause exacte n'est pas établie.
- e40 à 15,3 et 18,75 : même volume ; un segment libre de l'Esquisse 2, peu contraint, est décalé de 0,005 et 0,07 mm. Toutes les variantes de e40 donnent environ 81 500 mm³ des deux côtés : la découpe se perd pareillement.

`mesures/verifier-cote.ps1`, vrai clavier et vraie souris sur une copie du Drapeau : Échap dans la saisie, « abc » refusé, cote à 100 (62 663,291 mm³), ● au titre, Ctrl+Z (retour à 53 007,291, sans ●), Ctrl+Y, Ctrl+S avec `.bak`, fermeture sans question. Mémoire 41 Mo au repos, 51 Mo après. `tester-enregistrement.cjs` (176/176) et sa comparaison au navigateur (0 écart sur ce que le logiciel laisse modifier) repassent.

Dessin (`BancDessin`, références `mesures/dessin-reference.cjs`) : 383 sessions de gestes au hasard sur les 125 esquisses, les mêmes gestes rejoués sans fenêtre des deux côtés.
- **Mêmes sin, cos et atan2 des deux côtés** (`BancDessinCommunes`) : 382 sessions identiques jusqu'au bout, 4 577 états sur 4 578 à moins de 10⁻⁹ mm, 0 écart de structure. Reste Griffe, sk_10, graine 6203, pas 71 : 0,006 mm après 70 gestes, sur une esquisse aux points distants de 0,006 mm. Cause non établie.
- **Maths normales** (`BancDessin`) : 330 sessions identiques sur 383. 53 s'arrêtent sur un écart (7 de structure, 46 au-delà de 0,001 mm, jusqu'à 2 550 mm une fois l'esquisse partie sur une autre solution). Ces écarts disparaissent tous sauf un avec les maths communes ; ils viennent donc de l'arrondi, mais ce résultat ne dit pas lequel des deux côtés a « raison », et le navigateur n'a pas été comparé à lui-même sur le dessin.
- **Écriture** : 374 sessions en maths communes et 325 en maths normales écrites comme le navigateur, tout le reste du fichier intact, aucun refus. Corrigés grâce à ce banc : une pièce sans fonction ne s'enregistrait pas ; une cote d'écart devenue angle était refusée.
- **Rouvert dans le navigateur** (`mesures/tester-dessin-navigateur.cjs`), 12 sessions au hasard sur le Drapeau : 9 identiques, 3 écarts, tous sur des dessins très abîmés. Graine 3 : base effacée, l'Esquisse 2 (sur face) suit autrement, la découpe du navigateur passe, celle du natif non (164 897 contre 412 241 mm³). Graine 5 : traits croisés, la fusion du natif s'effondre, il annonce désormais un solide vide là où le navigateur donne 120 469 mm³. Graine 106 : même esquisse, traits croisés, 68 309 contre 68 364 mm³ (0,08 %). Non résolus.
- `mesures/verifier-dessin.ps1`, messages de souris et de clavier envoyés à la fenêtre sur une copie du Drapeau, sans prendre la main : rectangle, lignes, clic droit, Échap, cercle, arc, glisser, Suppr, Ctrl+Z, Ctrl+Y, double-clic pour coter, Ctrl+S avec `.bak`, fermeture sans question. Sur cet essai, navigateur et natif rouvrent le même volume : 66 325,875 mm³.
- `verifier-cote.ps1`, `verifier-esquisse.ps1` (vraie souris), `tester-cotes-navigateur.cjs` (36 cas : mêmes 33 identiques et 3 écarts qu'avant), `tester-enregistrement.cjs` (176/176) et `BancSolveur` repassent.

Créer une esquisse (`mesures/tester-nouvelle-esquisse.cjs`, `verifier-nouvelle-esquisse.ps1`), sur le Drapeau :
- Les 11 faces planes comparées au navigateur (origine, axes, nom, fonction et arête porteuses) : aucun écart. Un cas limite est tranché à la main : quand l'origine tombe pile sur le bord d'une autre face, le navigateur, qui vise un maillage, passe d'un côté ou de l'autre ; le natif ne garde ce point que s'il touche la face choisie. C'est ce qui donne le même résultat sur ces 11 faces, sans preuve que ce soit toujours le cas.
- 6 fichiers écrits par le natif (3 plans, 3 faces, un rectangle dessiné) puis rouverts par le navigateur : même esquisse, reste du fichier intact, même volume, l'esquisse s'ouvre.
- 53 suites de gestes au hasard sur 5 fichiers contenant une esquisse neuve (`BancDessinCommunes`) : toutes identiques, 736 états à moins de 10⁻⁹ mm, 45 écrites comme le navigateur.
- Dans la fenêtre, par messages : création sur plan, retrait quand elle reste vide, rectangle, Ctrl+Z et Ctrl+Y sur le tracé et la création, enregistrement, refus de retirer une esquisse enregistrée, message sans face choisie, clic sur une face, esquisse sur cette face, cercle, enregistrement, fermeture sans question. Sur la Griffe, non calculée : esquisse YZ avec rectangle écrite, reste du fichier identique.

Extruder une esquisse (menu Fonctions, Ctrl+E ; `mesures/tester-extrusion.cjs`, `verifier-extrusion.ps1`). La fonction naît à 20 mm comme dans le navigateur ; Propriétés règle Plot ou Poche, Distance ou À travers tout, la profondeur, Symétrique, Inverser. Modifier aussi une extrusion déjà dans le fichier met son nom à jour, comme le navigateur.
- 6 réglages sur les 2 esquisses du Drapeau, puis 5 esquisses d'une pièce enrichie par le natif (esquisses neuves, esquisse sur la face d'une extrusion neuve), soit 42 cas : même texte de fonction que le panneau du navigateur (sauf l'identifiant), esquisse masquée, reste du fichier intact, même volume dans le natif, dans le navigateur et dans le fichier rouvert.
- 123 esquisses des 20 pièces, chacune seule dans une pièce vide et extrudée de 20 mm : 70 donnent un volume, le même des deux côtés ; 53 n'en donnent aucun, des deux côtés ; 2 ignorées. C'est le test des contours trouvés.
- Dans la fenêtre, par messages : Ctrl+E puis Ctrl+Z, refus d'une esquisse vide et d'un trait ouvert, rectangle extrudé, profondeur tapée, Inverser, Poche, Ctrl+Z et Ctrl+Y, enregistrement, refus de retirer une extrusion enregistrée, découpe qui retire tout le solide (volume 0, pas de plantage).
- Écart voulu : le navigateur crée aussi la fonction sur un profil ouvert, et l'exclut au calcul. Le natif refuse et dit pourquoi.
- Pas encore repris : Nouveau corps, Jusqu'à la face, dépouille, choix des zones d'un profil, flèche à tirer dans la vue, retrait d'une fonction enregistrée.
- `tester-enregistrement.cjs` (176/176), `BancSolveurCommunes` (0 décision différente), `BancDessinCommunes` (mêmes résultats, 374 enregistrements, 0 écart), `verifier-dessin.ps1` et `verifier-nouvelle-esquisse.ps1` repassent.

Poser une contrainte (`dessin-reference.cjs --contraintes`, `verifier-contraintes.ps1`). 27 façons de poser, tirées au hasard au milieu des autres gestes, sur les 125 esquisses et une esquisse vide :
- **Maths communes** (`BancDessinCommunes`) : 383 sessions identiques sur 383, 4 623 états à moins de 10⁻⁹ mm, dont 1 956 après une contrainte, 375 écrites comme le navigateur, 0 écart. La référence contient environ 700 poses réussies, 350 refus et 740 demandes sans effet (déjà posée, mauvais choix d'éléments).
- **Maths normales** (`BancDessin`) : 342 sessions identiques sur 383. 41 s'arrêtent sur un écart (6 de structure, 35 au-delà de 0,001 mm), dont 8 sur une contrainte, et 336 écrites comme le navigateur sans écart. Même nature que pour le dessin ci-dessus : en maths communes, tout disparaît.
- Dans la fenêtre, par messages : F2, F5, refus d'une perpendiculaire sur deux parallèles, Ctrl+Z et Ctrl+Y après ce refus (il ne laisse aucun pas à annuler), F10 qui n'ouvre pas le menu de Windows, X dans les deux sens, F1 sur deux points, enregistrement, fermeture.
- Écart voulu : F1 sans sélection qui convienne affiche un message, alors que le navigateur arme son outil Coïncident à deux clics, pas encore repris.
- Pas repris : tout ce qui concerne les splines, encore refusées à l'ouverture dans le natif.
- `BancDessinCommunes` sur l'ancienne référence (mêmes résultats), `BancSolveurCommunes` (0 décision différente), `verifier-dessin.ps1`, `verifier-extrusion.ps1` et `verifier-nouvelle-esquisse.ps1` repassent.

Correction du test `verifier-dessin.ps1` : ses numéros de menus étaient décalés de 1 (`wxID_HIGHEST` vaut 6000), Ctrl+Y n'y était donc pas essayé. Corrigé ; il passe. Le rétablissement de Ctrl+Y est de plus éprouvé par l'essai de création ci-dessus.

## Pas vérifié

- L'extrusion sur une autre pièce complète que le Drapeau, seule calculable : les autres ne sont essayées qu'esquisse par esquisse, dans une pièce vide. Et le fichier avec plusieurs corps : une nouvelle fonction va dans le corps actif, comme le navigateur, sans essai dédié.
- L'esquisse sur face sur une autre pièce que le Drapeau, seule calculable : faces inclinées, faces sans porteuse et faces dans une découpe de forme compliquée n'y sont pas ou peu représentées.
- Le dessin à la vraie main, par une personne : les essais passent par des messages envoyés à la fenêtre. Le dessin n'est possible que sur les pièces calculables, donc le Drapeau parmi les exemples ; les autres sont comparées sans fenêtre.
- Le solveur est comparé sur les 125 esquisses, mais la modification avec solide qui suit seulement sur les 2 esquisses du Drapeau : les autres pièces ne se calculent pas encore.
- Les 3 pièces où changer une profondeur demande de recalculer une esquisse posée de biais (Barquette, Cache Piles, Support Pédale) : le refus reste en place, car leur solide ne se calcule pas.
- Une esquisse qui suit une arête nommée, et pas seulement sa position : refusée, non traduite.
- La règle de modification n'est éprouvée dans le logiciel que sur le Drapeau, seule pièce calculable des exemples.
- Enregistrer sur Dropbox ou un disque réseau, et « Enregistrer sous » au vrai clavier.
- Les 118 autres esquisses n'ont pas été comparées au navigateur, seulement ouvertes.
- Le double-clic réel n'a été essayé que sur le Drapeau.
- Un autre PC sans Visual Studio, une carte graphique faible, un écran à forte mise à l'échelle (le code le prévoit, mais ce PC est à 100 %).
- L'aire et la longueur affichées à la sélection n'ont pas été comparées au navigateur.
- La grosse plaque d'essai n'a pas été remesurée avec l'interface wxWidgets.
- Le volume à 25 mm n'a pas été comparé au navigateur (les 4 autres valeurs l'ont été).
- Une reconstruction complète depuis un dossier vide avec téléchargement : le `.exe` final est construit sur les binaires déjà téléchargés.
- La RAM d'un calcul FAO lancé depuis le `.exe` : ce chemin n'existe pas encore.
- Les vraies pièces plus riches : aucune autre pièce de `Exemples/` n'est prise en charge (congés, répétitions, formules, assemblages).
