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
- Afficher une esquisse, sans pouvoir la modifier : double-clic ou Entrée dans l'arbre, puis lignes, arcs, cercles, points, zones fermées, contraintes et cotes, orientés comme dans le navigateur. Échap ou « Terminer l'esquisse » pour sortir.

**Si une pièce contient autre chose** (congé, cote par formule, répétition, assemblage…), le programme montre son arbre et la liste de ce qui manque,
mais **ne calcule pas le solide**. Il n'affiche jamais un solide faux.

- Enregistrer (Ctrl+S) et enregistrer sous (Ctrl+Maj+S) sans rien perdre : seul le nombre modifié change dans le fichier, le reste ne bouge pas d'un octet. Copie `.bak` de la version précédente, relecture avant de remplacer le fichier, question avant de fermer une pièce modifiée (● dans le titre), refus si le fichier a changé ailleurs depuis l'ouverture. La date interne du fichier n'est pas mise à jour.

Une profondeur n'est modifiable que si le solide se calcule et si aucune esquisse liée au solide n'est posée de biais par rapport à elle : une telle esquisse suit les arêtes qui bougent, et seul le navigateur sait la recalculer aujourd'hui.

Il ne sait pas : dessiner, changer une cote d'esquisse (il faudrait le solveur).

Différences avec l'esquisse du navigateur : tout est en blanc, car le bleu « encore libre » demande le solveur ; pas de splines (un message le dit) ; pas de vue inclinée ; pas de flèches de degrés de liberté ni de bilan de santé ;
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

## Pas vérifié

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
