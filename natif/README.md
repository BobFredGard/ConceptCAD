# ConceptCAD natif : premier morceau Windows

Essai d'un vrai `.exe` Windows, sans navigateur, qui ouvre un `.conceptcad`, rejoue les fonctions simples, affiche le solide
en 3D et recalcule quand on change une cote. Ce n'est pas un produit : environ 2 % du travail total ([INVENTAIRE.md](INVENTAIRE.md)).

Rien ici ne touche à `src/`, à `ConceptCAD.html` ni à la version du logiciel.

## Ce que sait faire le programme

- Ouvrir un `.conceptcad` (normal ou compressé) par la vraie fenêtre Windows, ou par son chemin en argument.
- Rejouer : esquisses en lignes, arcs et cercles ; extrusion ; découpe ; « à travers tout » ; esquisse sur une face ; plusieurs corps.
- Afficher le solide : clic gauche ou milieu pour tourner, clic droit pour déplacer, molette pour zoomer, comme le navigateur.
- Montrer l'arbre de la pièce (esquisses, corps, fonctions) et un panneau de propriétés, dans l'environnement recopié du navigateur (barre du haut, ateliers, ruban, arbre, paramètres, fil des fonctions).
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

Il ne sait pas encore : polygone, oblong, congé d'esquisse, l'outil Coïncident à deux clics, fenêtre de sélection, retirer une contrainte, déplacer l'étiquette d'une cote, s'accrocher aux arêtes du solide, supprimer une esquisse enregistrée, esquisse sur un plan de construction, nouvelle pièce. Une cote de référence nommée ou par formule reste figée.

Coter : outil **Cote**. Un clic sur une ligne donne sa longueur, sur un cercle son diamètre, sur un arc son rayon, sur deux points leur distance. Pendant que la cote suit la souris, un clic sur un second élément la transforme (entraxe de deux cercles, distance d'un centre à une ligne, angle ou écart de deux lignes). Un clic dans le vide la pose et ouvre sa valeur ; taper un chiffre ou Entrée la pose aussi là où elle est. Ctrl+clic sur deux lignes choisit l'angle ou l'entraxe. Échap retire la cote commencée, et une cote qui existe déjà est sélectionnée plutôt que doublée.

Longueur tapée : pendant le tracé d'une ligne, taper le nombre, puis Entrée ou clic. Tab passe de la longueur à l'angle. La ligne reçoit sa cote de longueur, comme dans le navigateur.

Ajuster : outil **Ajuster** ou touche T. Le morceau sous la souris s'affiche en rouge : c'est lui qui partira. Un clic le retire ; en gardant le bouton enfoncé et en glissant, tout ce que la souris traverse part, et un seul Ctrl+Z rend le tout. La ligne croisée est partagée en deux au point de coupe, comme dans le navigateur. Un cercle coupé au moins deux fois devient un arc.

Décaler : choisir les éléments avec **Sélection** (Ctrl+clic pour les suivants), outil **Décaler** ou touche O, un premier clic pour commencer, puis un clic du côté voulu : la distance est celle du curseur, affichée dans la barre du bas. On peut aussi taper la distance : la souris donne le côté, Entrée ou un clic valide. Échap abandonne. Les éléments reliés sont décalés ensemble et gardent leurs coins ; chaque chaîne reçoit une seule cote, à double-cliquer pour changer la distance.

Poser une contrainte : choisir les éléments (Ctrl+clic pour les suivants), puis menu **Contraintes** ou mêmes touches que le navigateur : F1 coïncident ou fusion de deux points, F2 horizontal ou vertical selon la ligne, F3 tangent, F4 égal, F5 parallèle, F6 perpendiculaire, F7 milieu, F8 concentrique, F9 colinéaire, F10 symétrique, F12 fixe, X construction. Une contrainte qui rendrait l'esquisse impossible est refusée, avec la raison : tout revient exactement à l'état d'avant.

Créer une esquisse : menu **Esquisse**, sur le plan XY, XZ ou YZ, ou sur la face plane cliquée (elle suit alors sa face porteuse, comme dans le navigateur). Refermée sans rien dessiner, elle disparaît, comme dans le navigateur. Ctrl+Z annule la création tant qu'elle n'est pas enregistrée. Une esquisse sur plan se dessine aussi sur une pièce dont le natif ne calcule pas encore le solide : sans fonction ni lien, elle n'en dépend pas ; il n'y a donc pas d'esquisse sur face sur ces pièces.

L'annulation du natif revient exactement à l'état d'avant, alors que celle du navigateur résout à nouveau : le résultat peut y différer de très peu.

Différences avec l'esquisse du navigateur : tout est en blanc, car le bleu « encore libre » demande un calcul de plus, non traduit ; pas de vue inclinée ; pas de flèches de degrés de liberté ni de bilan de santé ;
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
- Les splines sont venues ensuite : voir « Splines » plus bas.
- `BancDessinCommunes` sur l'ancienne référence (mêmes résultats), `BancSolveurCommunes` (0 décision différente), `verifier-dessin.ps1`, `verifier-extrusion.ps1` et `verifier-nouvelle-esquisse.ps1` repassent.

Correction du test `verifier-dessin.ps1` : ses numéros de menus étaient décalés de 1 (`wxID_HIGHEST` vaut 6000), Ctrl+Y n'y était donc pas essayé. Corrigé ; il passe. Le rétablissement de Ctrl+Y est de plus éprouvé par l'essai de création ci-dessus.

Outil Cote et longueur tapée (`dessin-reference.cjs --contraintes --cotes`, `verifier-cotes.ps1`), tirés au hasard au milieu des autres gestes, sur les 125 esquisses et une esquisse vide. L'essai a créé avec l'outil Cote les 7 types de cotes (113 angles, 113 distances, 112 distances à une ligne, 96 longueurs, 53 rayons, 36 écarts, 17 diamètres), et 343 lignes à longueur tapée :

| Comparaison au navigateur | Sessions identiques | États | Enregistrements identiques |
|---|---:|---:|---:|
| Mêmes sin, cos et atan2 des deux côtés | **383 sur 383** | 4 642, tous à moins de 10⁻⁹ mm | 375 sur 375 |
| Maths de chaque programme | 350 sur 383 | 4 515 | 345 sur 345 |

En maths normales, 8 sessions s'arrêtent sur une différence de structure et 25 au-delà de 0,001 mm : l'arrondi de sin, cos et atan2 s'accumule et finit par changer une décision. Disparaissant toutes à maths communes, elles ne viennent pas de la traduction. Le navigateur a un défaut, reproduit à l'identique ici : Ctrl+clic sur deux cercles crée une cote d'angle de valeur 0.

La fenêtre, sur une copie du Drapeau : longueur tapée 40 mm, angle tapé 30°, diamètre posé puis tapé 30 mm, abandon par Échap, enregistrement relu (`length=40 | length=26 | diameter=30`). La comparaison a trouvé puis fait corriger un vrai défaut : le clic de pose perdait la cote.

Ajuster et Décaler (`dessin-reference.cjs --contraintes --cotes --modifier`, `verifier-ajuster.ps1`), tirés au hasard au milieu des autres gestes, sur les 125 esquisses et une esquisse vide. L'essai a décalé 708 lignes, 80 arcs et 17 cercles, changé 21 cercles en arcs et scindé 11 arcs :

| Comparaison au navigateur | Sessions identiques | États | Enregistrements identiques |
|---|---:|---:|---:|
| Mêmes sin, cos et atan2 des deux côtés | **383 sur 383** | 4 642, tous à moins de 10⁻⁹ mm | 375 sur 375 |
| Maths de chaque programme | 348 sur 383 | 4 495 | 341 sur 341 |

En maths normales, 5 sessions s'arrêtent sur une différence de structure et 30 au-delà de 0,001 mm, parfois de beaucoup sur ces gestes tirés au hasard : l'arrondi de sin, cos et atan2 s'accumule et finit par changer une décision. Disparaissant toutes à maths communes, elles ne viennent pas de la traduction. Sur un dessin qui s'emballe ainsi, les deux programmes peuvent donc arriver à des formes différentes.

La comparaison a fait trouver et corriger trois vrais défauts : l'arrondi au croisement de deux droites décalées, le contrôle des cotes en trop sur un arc dont le centre et un bout sont fixes, et une cote d'écart devenue angle qui perdait ses marques à l'enregistrement.

La fenêtre, sur une copie du Drapeau : ligne ajustée, Ctrl+Z et Ctrl+Y qui gardent l'outil, cercle enregistré puis changé en arc puis réenregistré, touches T et O, rectangle décalé de 9,16 mm (4 copies, une cote), abandon par Échap sans rien créer. Les essais en fenêtre précédents repassent.

Trois ajouts venus de SolidCraft, sans effet sur le fichier : l'aperçu rouge, le glisser et la distance tapée. Ils sont propres à ce programme, le navigateur ne les a pas. Comment ils sont vérifiés :
- Distance tapée (`--tape`) : la référence appelle directement le calcul de décalage du navigateur avec la même distance. 528 états, dont 286 qui ajoutent des éléments ; **383 sessions sur 383** identiques à maths communes, 375 enregistrements identiques.
- Glisser : dans `verifier-ajuster.ps1`, le glisser à travers trois barreaux donne exactement l'esquisse des trois clics, et un seul Ctrl+Z rend le peigne de départ.
- Aperçu : le banc compare la longueur annoncée à celle que la coupe retire, avant que le solveur ne déplace le dessin. Sur 1 573 clics : 1 506 exacts, 41 à moins de 1 mm (accrochage à un point voisin), 24 sur une ligne projetée où le total ne dit rien, 2 écarts plus grands (1,4 et 3,2 mm).

Défaut du navigateur, reproduit à l'identique : couper une ligne de construction au passage crée une moitié qui n'est plus en construction.

Pas traduit à ce stade (les splines sont venues ensuite, voir « Splines » plus bas) : le menu contextuel « Décaler (auto) » du navigateur.

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

## L'environnement du navigateur

Depuis le 06/11/2026, la fenêtre reprend celle du navigateur : barre du haut, ateliers CAO, FAO, PLAN et RENDU, ruban, onglets, arbre flottant, carte Paramètres, boutons et cube de vue, fil des fonctions, écran d'esquisse. Les noms, infobulles, icônes et l'ordre des boutons sont recopiés du navigateur par `mesures/extraire-environnement.cjs`, rien n'est retapé.

Ce qui marche : Esquisse, Extrusion, Annuler, Rétablir, Ouvrir, Enregistrer, Enregistrer sous, Régénérer, l'arbre (double-clic sur un plan ou une esquisse), le fil des fonctions, le cube de vue, la vue initiale, le repli de l'arbre, les onglets.
Tout le reste est visible et grisé, et dit « pas encore dans le logiciel Windows » quand on clique. Les ateliers FAO, PLAN et RENDU n'ont que leur ruban grisé et une page qui le dit : aucune donnée n'y est inventée.

Écarts voulus avec le navigateur : **Abandonner** oublie vraiment ce qui a été fait depuis l'ouverture de l'esquisse, alors que le navigateur le garde. La lumière et le bleu de la pièce sont approchés, pas identiques. Les raccourcis des anciens menus restent, sans barre de menus visible. Accrocher à la grille : clic droit sur le bouton Grille.

Preuves, sur des copies : `mesures/verifier-environnement.ps1` (15 étapes dans la vraie fenêtre), `verifier-dessin`, `verifier-nouvelle-esquisse`, `verifier-extrusion`, `verifier-contraintes`, `verifier-cotes`, `verifier-ajuster` réussis ; `tester-enregistrement.cjs` : 176/176. Comparaison au navigateur à maths communes : 383/383 sessions sans les gestes du panneau, 380/383 avec (`dessin-reference.cjs --panneau`). Les 3 écarts sont une cote d'écart que le navigateur change en angle sur des lignes dont une, sur les 2 cas vérifiés, a une longueur nulle : son sens n'y est que du bruit de calcul ; le 3e cas a la même forme, sa ligne n'a pas été vérifiée. Panneau : 123 esquisses sur 125 affichent le même état que le navigateur ; les 2 autres (la même esquisse dans « test angle » et « test esquisse ») annoncent un résidu de 7,89 mm dans le navigateur et 1 liberté ici, cause non établie.

Non vérifié : `verifier-esquisse`, `verifier-cote`, `verifier-fenetre`, qui envoient de vraies touches et s'arrêtent seuls si une autre fenêtre est devant, n'ont pas pu aller au bout pendant que le PC servait. Le double-clic à la vraie souris dans l'arbre n'a donc pas été rejoué par une machine. Mise en page testée à 1500 × 900 seulement, à 100 % d'échelle d'écran.

## Correction d'Ajuster reprise du navigateur V0.67.3

Une ligne de construction ou une référence 3D coupée en deux garde sa nature sur les deux moitiés, et une référence coupée au milieu la garde sur ses deux tronçons. Le fichier écrit garde aussi la marque `ref` sur la ligne neuve, et les bancs comparent désormais cette marque.

Preuve, contre le navigateur V0.67.3 : `BancDessinCommunes` 383 sessions identiques sur 383, 375 écrites comme le navigateur, 0 écart ; avec les gestes du panneau, les mêmes 3 écarts qu'avant (380/383, voir plus haut). Sans la correction, le banc s'arrête sur Ajuster dans 12 sessions : il voit donc bien ce cas. `tester-enregistrement.cjs` : 176/176.

Maths normales (`BancDessin`, à 0,001 mm) contre cette référence : 330 sessions identiques sur 383. Ce chiffre n'a pas été mesuré juste avant la correction : on ne peut donc pas dire qu'elle ne l'a pas changé, seulement que les maths communes ne montrent aucun écart.

Non résolu : `verifier-ajuster.ps1` réussit ses étapes 1 à 6 (Ajuster, annuler, rétablir, enregistrer) mais s'arrête à l'étape 10 (Décaler un rectangle choisi au Ctrl+clic : 1 copie au lieu de 4), avec ou sans cette correction. La distance obtenue est stable tant que la vraie souris ne bouge pas et change quand elle a bougé. La piste est donc la vraie souris posée sur la fenêtre pendant l'essai, sans preuve à ce stade.

## Congés et chanfreins 3D

Boutons **Congé** et **Chanfrein** du ruban. Les arêtes vives sont en noir, les raccords lisses en gris. Un clic sur une arête l'ajoute ou la retire, un clic sur une face prend toute sa boucle. Le panneau donne le rayon par défaut, la case « Arêtes tangentes » et le rayon de chaque arête. L'aperçu montre la pièce telle qu'elle sera, nouvelles faces en orange ; s'il est impossible, le panneau dit pourquoi et le rayon maximal vérifié. **Appliquer** crée la fonction, **Quitter** ou Échap n'en crée pas, Ctrl+Z la retire. Rayon et case sont retenus pendant la session. Les congés et chanfreins des fichiers sont rejoués, ce qui ouvre une pièce de plus sur les exemples (Poche et Contour) ; les autres attendent surtout perçages, dépouilles et répétitions.

Écart voulu avec le navigateur, sans effet sur le fichier : changer le rayon par défaut change aussi les arêtes restées à ce rayon. Dans le navigateur, seules les arêtes choisies ensuite le prennent.

Pas encore repris : modifier un congé existant, chanfrein à deux distances ou à angle, cotes par formule (ces fichiers restent refusés), noms uniques d'arêtes (la recherche passe par l'ancre d'esquisse et la position ; un nom est écrit, et le navigateur s'en sert à sa relecture), texte « paroi mince » du message d'erreur, mémoire des reprises NURBS.

Preuves, contre le navigateur :
- `tester-conges.cjs` (rejeu, 15 tirages par pièce : arêtes, rayons, congé ou chanfrein, tangentes) : 153 cas sur 153 identiques en volume, aire, faces, arêtes, solides et validité ; parmi les tirés au hasard, 135 changent la pièce et 15 échouent des deux côtés.
- `tester-conges-gestes.cjs` (mêmes gestes des deux côtés, 8 tirages par pièce) : liste des arêtes vives et tangentes identique sur 11 pièces sur 11, ancres identiques sur 338 arêtes sur 338, 87 cas sur 88 identiques (champs écrits, aperçu, pièce, fichier du natif relu par le navigateur).
- `--essai-conge` : de vrais clics dans la vue. Sur Poche et Contour, 5 clics sur 5 prennent la bonne arête, un clic sur une face prend 8 arêtes et un second les retire. Annuler rend le volume d'avant, Rétablir celui d'après.
- `BancDessinCommunes` 383/383, `tester-enregistrement.cjs` 176/176 : rien de cassé.

**Non résolu**, le 88e cas : Crochet, R0,3 sur 3 arêtes, tangentes décochées. Arête par arête, les deux sont identiques. Ensemble, le noyau rend un solide déchiré des deux côtés, puis chacun passe par la reprise NURBS : le navigateur y trouve un aperçu, pas le natif, et les pièces diffèrent (7943,6 contre 7918,1 mm³, la pièce d'avant faisant 7938,0). La cause n'est pas établie : défaut de traduction de `repriseNurbs` ou calcul différent du noyau. Le fichier écrit reste le même dans ses champs, et chaque programme recalcule sa pièce à l'ouverture.

Pièges : la macro Windows `far` interdit ce nom de champ ; `TKFillet.dll` doit être dans `sortie/` (sinon arrêt sans message au lancement, code -1073741515) ; `wxStaticText::Wrap` à la même largeur ne recoupe pas un nouveau texte, passer d'abord par `Wrap(-1)` ; pour des clics sur l'aperçu, la pièce d'origine reste affichée en transparence totale. Une pièce coupée pour un banc peut faire bouger, côté navigateur, une esquisse non consommée qui suit des arêtes : à retirer du banc.

## Esquisse : formes, menu du clic droit, Congé et Chanfrein, sélection (06/11/2026)

Repris du navigateur V0.67.3 : Oblong, Polygone (bandeau côtés et Ø), Point, Centre de perçage, Congé et Chanfrein, le menu du clic droit avec ses icônes, la fenêtre de sélection (gauche → droite : ce qui est dedans ; droite → gauche : ce qu'elle touche), le déplacement d'une cote par sa valeur ou sa ligne, Coïncident à deux clics, les touches F1 à F12, H, L, C, G, R, B, D, F, T, O.

Comparaison au navigateur V0.67.3 (`dessin-reference.cjs --contraintes --cotes --modifier --tape --panneau --formes --menu --coins`), maths communes :

| Essai | Sessions identiques | États | Écrites comme le navigateur |
| --- | --- | --- | --- |
| Tous les gestes tirés au hasard | 381 sur 383 | 4 652, aucun écart de position | 373 sur 373 |
| Sélection, cotes déplacées, Coïncident (`--selection --seulement=glisseCote,boite,coincident2`) | 258 sur 258 | 2 668 | 250 sur 250 |
| Non-régression sur la référence précédente | 383 sur 383 | 4 632 | 375 sur 375 |

`tester-enregistrement.cjs` : 176 sur 176.

**Deux écarts restent ouverts** : Barquette, graine 1603, « Fixe » sur une sélection de plusieurs sortes (le natif pose plus de contraintes) ; Cache Piles, graine 3201, une cote R de congé que le natif passe en référence et pas le navigateur.

Défauts du navigateur non recopiés, à décider plus tard pour le navigateur : le menu « Distance centres » plante sur un cercle + un arc (le natif pose la cote) ; une fenêtre de sélection avec Ctrl n'ajoute qu'un élément de chaque sorte (le natif ajoute tout, ce geste est donc hors du banc).

Essai sans prendre la main sur l'écran : `ConceptCADNatif --essai-esquisse <fichier> <rang, -1 : nouvelle sur XY> <sortie> <etapes.json> <dossier>`. De vrais événements de souris et de clavier passent par la vue et les boutons ; un bilan et des captures sont écrits dans le dossier.

## Splines (06/11/2026)

Spline par points de passage et spline de contrôle : tracé (S, Maj+S), fermeture, poignées de tangence, tangence et courbure aux raccords, point sur la courbe, peigne de courbure, menu du clic droit, Ajuster, Décaler, annulation, écriture dans le fichier, et volume : une spline est une vraie courbe exacte dans la pièce (`spline.cpp`, `contours.cpp`, `rejeu.cpp`).

Vérifié contre le navigateur V0.67.3 :
- Gestes (`dessin-reference.cjs --splines`, Poche et Contour, 8 sessions de chaque sorte) : 24 sessions, 0 écart de structure, 20 identiques jusqu'au bout, 20 écrites comme le navigateur sur 20.
- Écart accepté : 4 sessions à moins de 0,01 mm. C'est le bruit du point de départ de la recherche du pied sur la courbe : en le retirant des deux côtés, 2 écarts sur 3 examinés disparaissent ; le 3e est un point libre d'une esquisse en conflit.
- Volume (`tester-splines.cjs`) : 40 pièces sur 40 identiques (volume, aire, faces, arêtes, solides, validité), 10 formes : fermée, de contrôle, ligne de fermeture, deux splines, jonction en T, poignée, trou, îlot, arc et spline, avec parfois une poche.
- Sessions sans spline : 383/383 et 381/383 selon le jeu de gestes (les 2 écarts sont connus et antérieurs : Barquette, Cache Piles), enregistrement 176/176.
- Vraie fenêtre (`--essai-esquisse`) : tracé en cours, spline finie, spline de contrôle, panneau santé.

Pas vérifié : les splines à la souris par une personne, les splines dans un fichier réel (aucun exemple n'en contient), un congé 3D posé sur une arête issue d'une spline, le rejeu de Balayage et Révolution (ces fonctions ne sont pas encore dans le natif).

## Rectangles, cercles, arcs et oblongs de V0.69.0 (06/11/2026)

Report des V0.68.0 et V0.69.0 du navigateur (`src/traces.cpp`) :

- **Bandeau de choix** en haut à gauche, gardé d'un tracé au suivant : Oblong (2 centres, 2 extrémités, Centre), Rectangle (2 coins, Centre et coin, 3 points), Cercle (Centre et rayon, 2 points, 3 points, Tangent), Arc (Centre et 2 points, 3 points, Tangent). Touche A pour l'arc.
- **Oblong en 3 clics**, dans toutes les directions ; cotes posées au 3e clic ; aucun « Fixe ». L'outil reste actif, le rectangle aussi. Cotes Ø et R posées à la création du cercle et de l'arc.
- **Tangence intérieure** (`inner`) : lue, écrite, résolue, comptée dans le rang. Le contour d'un arc parcouru à rebours ne prend plus le reste du cercle.

Comparaison au navigateur V0.69.0 (`dessin-reference.cjs --traces --contraintes --cotes --modifier --tape --panneau --formes --menu --coins --selection --sessions=3`, maths communes) : 343 sessions identiques sur 344, 4 176 états à moins de 10⁻⁹ mm ; les 1 316 états oblong, rectangle, cercle et arc des nouveaux modes sans aucun arrêt, 331 sessions écrites comme le navigateur.

Écarts restants, hors du code de ce report : le menu « Fixe » sur une esquisse de Crochet (numérotation différente, 1 session) ; `sl` ou `w` de la première cote après glissement de son étiquette (4 sessions).

`--gestes=fichier` rejoue une suite de pas écrite à la main. La référence doit maintenant être faite avec une page V0.69.0 ou plus récente (les modes n'existent pas avant).

## Projeter, Intersection et ce qui suit (06/11/2026)

- **Projeter** (touche P) : arêtes du solide et éléments ou points d'une autre esquisse, noms « Projetée n » et « Arête n » gardés dans le fichier. 258 sessions sur 258 identiques au navigateur V0.67.3 (`dessin-reference.cjs --projeter`).
- **Intersection** (touche I) : courbes du plan d'esquisse avec le solide. Clic sur une face, Maj+clic pour le corps entier, Ctrl+clic pour plusieurs faces puis Entrée, menu du clic droit. `mesures/tester-intersection.cjs` joue les gestes dans la vraie fenêtre et compare au navigateur : **52 gestes sur 52 identiques**, sur 3 pièces (Drapeau, Poche et Contour, un oblong percé fabriqué par le banc) et 5 plans, avec droites, cercles, arcs et courbes libres.
- **Suivi** : quand une cote change plus haut dans la pièce, les intersections et les projections d'une autre esquisse se recalent. `mesures/tester-suivi.cjs` fabrique une pièce par de vrais gestes (corps entier, deux faces, un point et un côté projetés) puis change chaque cote des deux côtés : **48 cas sur 48 identiques**, fichier écrit compris.

Écarts connus, sans effet mesuré :

- La boîte d'une face courbe dépend de son maillage (45,108 mm contre 45) : le navigateur retrouve la face la plus proche, le banc accepte 0,5 mm sur ces dimensions.
- Les références de face écrites par le programme n'ont pas de nom de face (`nom`) : le navigateur les retrouve par position et les nomme ensuite.

Pas encore repris : le suivi d'une arête par son nom (`srcNom`), d'une arête d'un autre composant et d'un point de traversée. La cote en amont reste alors refusée, avec un message. Une source perdue laisse l'élément à sa place, sans l'avertissement du navigateur.

## Rendu de la vue 3D repris du navigateur

La vue reprend les réglages de la scène Three.js (`src/10-scene-3d.js`) : matière métal 0,35 et rugosité 0,4, studio de reflets fabriqué sans fichier, perspective à 50°, bords lissés, couleur de chaque corps, arêtes vives noires et raccords tangents gris, reflet au sol. Le cube de vue est dessiné sans perspective pour rester un cube.

- Les unités de lumière d'OCCT ne sont pas celles de Three.js : les intensités sont réglées sur les couleurs mesurées du Drapeau (dessus `#20b0fc` ici, `#10b0fc` dans le navigateur).
- `--image3d <fichier> <image.png>` enregistre la vue sans prendre la main, et écrit à côté le temps d'affichage et le temps par image.
- Mesuré : environ 60 images par seconde sur une plaque de 900 trous ; 11 à 12 Mo de plus en usage réel, environ 45 Mo de plus en mémoire réservée.
- Le reflet s'estompe avec le calcul du navigateur : point du sol percé par le rayon de l'œil, fondu selon sa distance au centre de la pièce.
- Écarts connus : les côtés sont un peu moins lumineux ; le cube a des faces très sombres vu par-dessous.

## Ce qui s'est ajouté jusqu'au 07/11/2026

- **FAO** : le calcul reste le JavaScript validé de V0.69.0, lancé par `natif/fao/moteur.cjs` dans Node. Rien n'est traduit tant qu'il n'y a pas de preuve d'identité avec `tests/parcours/reference.json`.
- **Rendu** : rendu par lancer de rayons, matériau et couleur par occurrence d'assemblage, archive des calques (beauté, masque, profondeur, normales, identifiants, ombre).
- **Dériver** : paramètres et corps d'un autre fichier, suivi de la source, source déplacée, rupture du lien.
- **Chanfrein** à deux distances et à distance + angle ; modifier un congé ou un chanfrein déjà fait.
- **Recherches** : dans l'arbre et Ctrl+K pour les commandes, y compris « Thème : … ».
- **Esquisses liées** : jusqu'à la face suivie par son nom, projetées nommées (`nommerProjections`, une fois par document, avant tout changement).
- **Répétition suivant une courbe** (`profil_guide.*`, mode `path` de `repetitions.cpp`).
- **Vue cavalière** avec son image dans la mise en plan.
- **Film de construction** en MP4 (`cadre_film.cpp`, `video_mp4.*`), **dossier de projets** (`cadre_dossier.cpp`).
- **Thèmes** (`theme.*`, `cadre_theme.cpp`) : `th(couleur Nuit)` traduit vers le thème courant. En Nuit c'est l'identité : les bancs ne voient aucun changement. Couleurs par famille, nom des groupes sous le ruban, mode d'orbite.
- **Ordre des fonctions et antériorité** (`anteriorite.*`, copie de `43-anteriorite.js` et de `featMove`) : monter et descendre dans le menu, glisser dans le fil ou dans l'arbre, glisser sur l'en-tête d'un autre corps, ⚠ dans l'arbre, refus expliqué dans la barre d'état.
- **Déplacer un corps, centre d'Échelle** (`cadre_deplacer.cpp`), **ƒx sur toutes les valeurs** (arêtes de congé, construction), **œil de l'arbre**, **corps visés**, **esquisses 3D**, **zones de l'extrusion**, **import STL** jusqu'à 2 millions de triangles, **ancienne cote d'entraxe** changée en cote d'angle à l'ouverture de l'esquisse.
- **Configurations** (`configurations.*`) : table des variantes dans la fenêtre ƒx, sélecteur en tête de l'arbre.
- **Aide** (`aide.*`, F1, « ? », bouton), **journal d'erreurs local** (`journal.*`, rien n'est envoyé), raccourcis 3D E H R F C M, F5, Ctrl+Maj+R, Ctrl+clic droit recentre, Alt+double-clic isole.
- **Fenêtre dynamique** (`cadre_dynamique.cpp`) : extrusion, révolution, perçage, congé et chanfrein ont une poignée dans la vue (flèche ou anneau), un champ flottant qui accepte les formules, OK, Annuler, Échap. Annuler remet le document exactement comme à l'ouverture de la fenêtre. Extrusion : boutons Opération (Plot, Poche, Nouveau corps), Direction et Étendue, Dépouille dans le panneau ; révolution : Plot, Poche et angles 90° à 360° en un clic. Un geste de la souris compte pour une seule annulation.
- **Script JSON** (`cadre_scripts.cpp`, Ctrl+K puis « script ») : mêmes commandes et mêmes messages d'erreur que le navigateur, comparés sur 12 scripts (`{"script":[…]}` à l'essai).
- **Références entre composants** (`assemblage_refs.*`) : méthode « Depuis un autre composant » (avec Figer), face ou arête d'un autre composant visée d'un clic, arête d'un autre composant projetée dans une esquisse. Tout suit quand le composant visé bouge ou change ; cinq scénarios comparés au navigateur, et ses fichiers relus par lui.
- **Copie de secours** (`cadre_secours.cpp`) : tant qu'une pièce a des modifications non enregistrées, son texte est gardé toutes les 4 secondes dans `%APPDATA%ConceptCADNatifsecours`, jamais à la place du fichier. Après un arrêt brutal, le démarrage suivant propose de rouvrir le brouillon, de l'enregistrer ailleurs ou de le supprimer ; il n'est jamais rouvert tout seul. Plusieurs fenêtres ouvertes en même temps ne se gênent pas.

- **Arbre** : plusieurs lignes à la fois (Ctrl : ajouter ou retirer, Maj : une plage), Suppr avec ce qui en dépend (congés, répétitions, fonctions de l'esquisse) et le même message que le navigateur, Échap pour vider le choix ; double-clic dans le fil comme dans l'arbre (esquisse, construction, congé, dépouille, coque).
- **Barre de progression** du recalcul passé 0,3 s, dessinée à la main car le calcul ne rend pas la main.
- **Fiches de filet modélisé** : dimensions selon la norme (ISO 261 / 965-1, ISO 68-1, ASME B1.1) et nombre de spires.
- **Changer une cote** ne fait plus suivre les copies « (rép N) » d'une répétition, comme le navigateur (elles sont refaites depuis leur source) : Cache Piles retombe juste.
- Bancs : chaque cas laisse un profil Chrome de 25 Mo dans le dossier temporaire ; les lancer avec `TEMP` et `TMP` sur `natif/.tiers/tmp-bancs`, à vider ensuite.

Rendu, en plus : relief et patine de chaque pièce (clic droit sur la pièce : relief, direction, échelle, patine), usure sur les arêtes, paillettes, bois veiné, verre transparent dans les deux moteurs. Mise en plan : la case Miroir d'une vue en image donne son reflet estompé. Fermer le programme depuis l'atelier Rendu ne plante plus.

Différences assumées avec le navigateur : Studio à sol fondu, reliefs par tuile unique de 24 mm environ et usure par niveaux de teinte, sans irisation, cartes de rugosité réservées aux métaux, `.exr` sans compression ou ZIP, Rendu direct sans tons ACES, moteur FAO « distance » absent, film en MP4 plutôt qu'en WebM, point de départ de la courbe choisi dans une liste, icônes dessinées au lieu d'emoji dans l'arbre ; fenêtre dynamique : symboles simples sur les boutons du panneau, anneau au lieu de la boule et de l'arc pour la révolution, boîte de `info` exacte dans les scripts (le navigateur lit les facettes), pont de pilotage MCP non repris.
