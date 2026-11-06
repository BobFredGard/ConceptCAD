# Plan : interface et esquisse du natif

La version navigateur reste l'outil de travail pendant tout ce chantier. Rien ici ne touche à `src/`.
Les durées sont des estimations de jugement, validation de Fred comprise. Le total reste celui d'[INVENTAIRE.md](INVENTAIRE.md) : 5 à 9 mois pour l'ensemble des deux domaines.

## Le choix de la bibliothèque de fenêtres

Lu le 06/11/2026 sur les pages officielles. Ce n'est pas un avis juridique.

| | Qt 6 (Widgets, LGPLv3) | wxWidgets 3.3.4 |
|---|---|---|
| Diffusion du `.exe` sur GitHub | Permise, avec conditions | Permise « selon vos propres conditions » pour les binaires |
| Fournir la source de la bibliothèque | **Oui**, livrée avec le programme ou par offre écrite, même sans modification. Selon la FAQ de Qt, un lien vers leur source ne suffit pas | Non |
| Texte de licence et mention visible | Oui | Mention de courtoisie à vérifier |
| Remplacement de la bibliothèque par l'utilisateur | Doit rester possible | Pas exigé pour les binaires |
| Modules interdits en LGPL | Quick 3D, Graphs, Qml Compiler, Virtual Keyboard, entre autres, seulement en GPL ou commercial. Il faudrait les éviter | Aucun |
| Installation | Installateur officiel. Compte probablement requis, **non confirmé** | Binaires officiels pour Visual Studio sur GitHub, dans `natif/.tiers`, sans installation système ni compte |
| Apparence | Très libre : thème sombre et style sur mesure | Contrôles Windows standard, moins de liberté de style. À juger sur pièce |
| Panneaux ancrables, listes, arbre | Très complet | Présents (AUI, arbre, grille), moins riches |
| Mémoire | Inconnue, à mesurer | Inconnue, à mesurer. Probablement plus légère, car elle s'appuie sur Windows |

Le code de ConceptCAD est déclaré sous licence ISC et public : la LGPL de Qt n'a donc rien d'impossible. La contrainte est pratique : joindre la source de Qt
(ou tenir une offre écrite) à chaque diffusion.

**Choix de Fred : wxWidgets**, qui respecte le mieux les deux raisons du natif (mémoire, simplicité de diffusion) et s'essaie sans rien installer.
L'étape 1 sert de test : si l'apparence ne plaît pas à Fred ou si un panneau résiste, on passe à Qt avant d'avoir beaucoup écrit.

La série 3.3 est dite « de développement » par ses auteurs : ils la jugent bonne pour la production, mais une future version peut demander de petites retouches (la 3.2 est la série stable). Choisie pour le thème sombre.

## Ce que le code actuel apprend

| Partie de l'esquisseur | Lignes | Page web ou noyau ? | Conséquence |
|---|---:|---|---|
| Modèle et solveur (`50-esquisse-2`) | 1 337 | Pratiquement aucun lien | Se traduit presque ligne à ligne |
| Édition de la géométrie (`50-esquisse-3`) | 715 | Pratiquement aucun lien | Idem |
| Splines (`50-esquisse-6`) | 672 | Aucun | Se traduit. **Aucune spline dans `Exemples/`** : il faudra d'autres pièces de test |
| Plan et cibles, projection (`50-esquisse-7`, `8-projection`) | 547 | Très peu | Se traduit |
| Ouverture et références (`50-esquisse-1`), intersection (`62`) | 1 427 | Noyau, beaucoup | À réécrire sur OCCT natif |
| Dessin et cotes, panneau, souris (`50-esquisse-4`, `5`, `60`) | 3 347 | Page web | À réécrire, la logique sert de modèle |

**Deux pièges repérés dans le solveur actuel :**
- **Budget de temps** : sur les esquisses difficiles, il prolonge le calcul pendant 400 ms au plus (`50-esquisse-2:1242`). Le résultat dépend donc en partie de la vitesse de la machine, et un natif plus rapide peut aller plus loin. Il faudra un budget compté en nombre de pas pour que les comparaisons aient un sens.
- **Mémoire du passé** : le résultat dépend de la position de départ et des valeurs précédentes des cotes (`SK_VALS`, reprises). Le test doit donc rejouer les mêmes enchaînements des deux côtés, pas seulement l'état final.

**Étalon gratuit** : `Exemples/` contient 20 pièces lisibles, 125 esquisses, 2 005 contraintes et 292 cotes, résultats déjà enregistrés. Sont présents 14 types de contraintes
et 7 types de cotes. Le solveur actuel tourne aussi en Node : on peut lui faire produire les points de référence, modification de cote par modification de cote, puis comparer au C++.

## Les étapes

Chaque étape se termine par une chose à essayer et une mesure de mémoire avec le banc (`mesures/banc.cjs`).
**Garde-fou proposé** : si le natif dépasse 150 Mo au repos sur le Drapeau, on s'arrête pour en parler avant de continuer.

### 0. Séparer calcul et affichage : abandonné, inutile
Le ralentissement attribué à la vue 3D venait du placement sur les cœurs économes du processeur (345 contre 585 ms). Le programme demande maintenant à Windows de ne pas le traiter comme une tâche de fond,
et le natif est 2 fois plus rapide que Chrome sur la plaque moyenne sans second processus (voir [README.md](README.md)). À revoir seulement si un recalcul long gêne l'interface : il se ferait alors dans un autre fil.

### 1. Socle de l'interface (3 à 5 semaines)
Fenêtre avec wxWidgets, arbre de la pièce, panneau de propriétés, vue OCCT intégrée, sélection des faces et arêtes au survol et au clic, mise à l'échelle des écrans.
**Fred essaie** : ouvrir une pièce, cliquer dans l'arbre et sur les faces, juger l'apparence. C'est ici qu'on tranche entre wxWidgets et Qt.
**Fait quand** : les parcours sont vérifiés au vrai clavier et à la vraie souris, sur le `.exe` lancé, et sur un second PC ou un écran à forte mise à l'échelle si Fred en a un.

**État** : première version faite et vérifiée sur ce PC (arbre, propriétés, panneaux, sélection, annulation des cotes) : 44 Mo au repos, 60 Mo après 120 modifications. Reste à faire : l'avis de Fred sur l'apparence, le second PC ou écran, mémoriser la disposition des panneaux, les barres d'outils et les icônes.

### 2. Afficher les esquisses (1 à 2 semaines)
Entrer dans une esquisse depuis l'arbre, vue de face, lignes, arcs, cercles, points, contraintes et cotes dessinés, lecture seule.
**Fred essaie** : ses pièces, côte à côte avec le navigateur.
**Première version faite le 06/11/2026** : double-clic ou Entrée dans l'arbre, Échap ou bouton pour sortir, déplacement et zoom. Les 125 esquisses s'ouvrent sans plantage. Comparaison à l'œil avec le navigateur sur 7 esquisses de 6 pièces ; les autres sont seulement ouvertes.
Reste volontairement pour plus tard : tout est en blanc, sans le bleu « encore libre », car il faut le solveur (étape 4) ; pas de splines (étape 6, aucune dans les exemples) ; pas de vue inclinée ; pièce derrière en simples contours, et seulement si le solide est calculé ; pas de bouton pour la grille.

### 3. Enregistrer sans rien perdre (1 à 2 semaines)
Le programme garde tout le fichier d'origine et ne change que ce qu'il connaît. Faces nommées, parcours FAO, congés et réglages inconnus restent intacts.
**Fait quand** : sur les 20 pièces, ouvrir puis enregistrer redonne le même contenu, et le navigateur rouvre le résultat à l'identique. Cette étape vient avant toute modification, pour ne jamais abîmer une vraie pièce.
**Faite le 06/11/2026** (preuves dans [README.md](README.md)). Enseignement pour la suite : le fichier stocke aussi le résultat du solveur. Changer une profondeur peut déplacer les points d'une esquisse posée de biais, et le natif refuse ce cas tant qu'il ne sait pas les recalculer. L'étape 4 devra lever ce refus et les 3 écarts mesurés servent de test (Barquette, Cache Piles, Support Pédale).

### 4. Solveur (4 à 8 semaines)
Traduction du solveur et des contraintes. Le test est automatique : sur les 125 esquisses, rejeu sans modification, puis cotes changées en série, puis comparaison à la référence Node.
**Fait quand** : les écarts sont sous un seuil à fixer, et toute esquisse qui s'écarte est expliquée. Le risque principal de tout le plan est ici : les esquisses mal conditionnées, comme Cavité Usinage.
**Fred essaie** : changer des cotes d'esquisse et voir le solide suivre.
**Critère atteint le 06/11/2026, reste l'essai de Fred** (preuves dans [README.md](README.md)). Seuil fixé à 0,001 mm : 3 115 états sur 3 135 en dessous. Les 20 autres viennent uniquement de l'arrondi de sin, cos et atan2 sur des valeurs extrêmes enchaînées : avec les mêmes fonctions des deux côtés, les 3 133 états sont à moins de 10⁻⁹ mm et aucune décision ne diffère.
Correction de l'étape 3 : le refus de profondeur sur les esquisses posées de biais n'est **pas** levé. Le solveur saurait le faire, mais les 3 pièces de test ne se calculent pas encore dans le natif (elles attendent les congés et autres fonctions). À reprendre avec elles.
Non fait : le bleu « encore libre » (calcul de rang non traduit), les esquisses qui suivent une arête nommée, une intersection ou une autre esquisse (étape 6 : refus, lecture seule), l'essai avec solide sur d'autres pièces que le Drapeau.

### 5. Dessiner et éditer (6 à 10 semaines)
Lignes, arcs, cercles, rectangles, polygones, glisser à la souris, accroches, ajustement, cotes posées à la main, annulation.
**Fred essaie** : refaire une vraie esquisse, et dire ce qui gêne par rapport à ce qu'il a l'habitude de faire.
**Première tranche le 06/11/2026, à essayer** (preuves dans [README.md](README.md)) : lignes, rectangles, cercles, arcs, glisser, accroches, contraintes automatiques, effacer, cote par double-clic, annulation, enregistrement sans rien perdre. Reste : polygone, oblong, ajuster, décaler, congé d'esquisse, outil Cote, outil Coïncident à deux clics, longueur tapée, fenêtre de sélection, retrait d'une contrainte, déplacement des étiquettes, accroche sur les arêtes du solide, nouvelle pièce. **Créer une esquisse (plans XY, XZ, YZ et face plane) et l'extruder (plot, poche, à travers tout, symétrique, inversé) sont faits le 06/11/2026** : une pièce peut naître et grandir dans le natif. **Poser les contraintes à la main (menu Contraintes, F1 à F12, X) est fait le 06/11/2026.** Il reste à reprendre, pour l'extrusion : Nouveau corps, Jusqu'à la face, dépouille, choix des zones, flèche dans la vue, retrait. À traiter : le bleu « encore libre », et les 3 écarts de solide sur dessins abîmés (suivi de l'Esquisse 2 quand sa base disparaît, traits croisés).

### 6. Le reste de l'esquisse (4 à 8 semaines)
Splines, projections et intersections sur le noyau natif, esquisses sur plan de construction, panneau de contrôle.
**Fait quand** : les esquisses des 20 pièces s'ouvrent et se modifient sans refus.

## Hors de ce plan

Fonctions 3D (congés, répétitions), FAO, mise en plan, rendu. Tant que les fonctions 3D manquent, la plupart des pièces montreront leurs esquisses mais pas tout leur solide :
le programme le dira plutôt que d'afficher un solide faux.

## Sources

- [Obligations LGPL, Qt](https://www.qt.io/development/open-source-lgpl-obligations)
- [FAQ licences, Qt](https://www.qt.io/faq/qt-open-source-licensing)
- [Licences des modules, Qt 6](https://doc.qt.io/qt-6/licensing.html)
- [Licence wxWidgets](https://wxwidgets.org/about/licence/)
- [Texte de la licence wxWindows](https://docs.wxwidgets.org/3.3/page_copyright_wxlicense.html)
- [Versions de wxWidgets](https://github.com/wxWidgets/wxWidgets/releases)
