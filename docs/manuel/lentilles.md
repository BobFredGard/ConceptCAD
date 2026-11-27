[ConceptCAD](../../README.md) › [Manuel](README.md) › Lentilles

# Lentilles

Une lentille est une loupe ronde posée sur la vue 3D. Sous la loupe, la pièce est montrée autrement ; autour, rien ne change. On n'ouvre pas un autre atelier : on pose un autre regard à l'endroit qui intéresse.

## La loupe

- **Poser** : bouton loupe de la barre de vue (en haut à droite de la vue 3D, à gauche de ⚙). Un petit menu propose **Coupe**, **FAO**, **Plan** ou **Rendu** ; la loupe apparaît au milieu de la vue, les suivantes à côté. Le bouton devient orange tant qu'une loupe est posée. **Retirer les lentilles**, en bas du même menu, les enlève toutes ; `Échap` ferme le menu.
- **Déplacer** : glisser le cercle blanc ou l'étiquette au-dessus.
- **Agrandir ou réduire** : glisser la poignée ronde, en bas à droite du cercle.
- **Retirer** : le × de l'étiquette.
- **À travers la loupe**, la souris marche comme d'habitude : on tourne, on zoome, on sélectionne. La matière enlevée par la loupe ne se sélectionne pas : on prend ce que l'on voit.
- Jusqu'à 4 loupes à la fois.
- Rien n'est enregistré dans le fichier : la loupe est une aide de vue, sans annulation et sans ●.

## Lentille Coupe

Sous la loupe, la pièce est coupée par un plan face à l'écran. La matière devant le plan disparaît ; les faces coupées sont remplies de la couleur du corps, un peu plus sombre.

- **Profondeur** : l'étiquette indique, en mm, la distance entre l'avant de la pièce et le plan de coupe. Au départ, la coupe passe au milieu de la pièce.
- **Plus ou moins profond** : molette sur le cercle ou sur l'étiquette (un cran = 1/40 de l'épaisseur ; avec `Maj`, 1/200).
- **Revenir au milieu** : double-clic sur l'étiquette.
- La coupe suit la vue : en tournant la pièce, le plan reste face à l'écran.
- Elle est indépendante de la **Coupe X / Y / Z** du menu ⚙ : les deux peuvent servir ensemble.

## Lentille FAO

Sous la loupe, la pièce est montrée comme dans l'espace FAO, sans quitter la CAO : passes d'usinage (mêmes couleurs que l'aperçu FAO), brut et repère du posage. Autour, la CAO ne change pas.

- **La fraise** de l'opération qui coupe le plus sous la loupe est posée sur sa passe, au point le plus proche du centre du cercle (partie coupante et queue à leurs dimensions ; bout rond pour une fraise boule).
- **L'étiquette** donne le posage, le Ø de cette fraise et le **temps de coupe des passes sous la loupe**. Seule la partie des passes qui tombe dans le cercle compte, chacune à son avance : travail, plongée, remontée ou entrée de son opération. Les rapides et les opérations masquées ne comptent pas. Agrandir la loupe sur toute la pièce donne le temps de coupe du posage ; la poser sur une poche, le temps de cette poche.
- **Au survol de l'étiquette**, le nom de l'opération qui coupe le plus ici.
- Rien n'est calculé : seules les passes déjà en mémoire sont montrées. Sans parcours en mémoire, l'étiquette dit « aucun parcours » : les calculer une fois dans l'espace FAO (« Tout régénérer ») ; loupe posée à côté des passes : « rien ici ».
- Dans l'espace FAO, la loupe garde la fraise et le temps de la zone.

## FAO posée sur Coupe

Poser une loupe FAO à cheval sur une loupe Coupe : là où les deux cercles se recouvrent, on voit **l'outil dans la matière**.

- Dans la zone commune, la pièce est coupée comme sous la loupe Coupe, et la FAO s'y ajoute : seules les passes restées derrière le plan de coupe sont montrées, cachées par la matière quand elles passent derrière.
- La fraise est posée sur la passe la plus proche du milieu de la zone commune, de préférence derrière le plan (là où la matière est restée). Elle reste entière : on la voit plonger dans la poche coupée.
- La molette sur la loupe Coupe fait avancer ou reculer le plan : la fraise suit, d'une passe à l'autre.
- Hors de la zone commune, chaque loupe garde son propre regard.
- À travers la zone commune, la matière enlevée ne se sélectionne pas, même avec la loupe FAO posée dessus.
- Quand deux loupes sont proches, l'étiquette de la plus récente se pousse pour ne pas cacher l'autre.

## Lentille Plan

Sous la loupe, la pièce devient un dessin coté, sur fond papier, sans quitter la vue 3D.

- **Le trait** : arêtes vives à l'encre, arêtes tangentes (bords de congés) en gris, arêtes cachées en pointillés clairs. Les formes rondes (cylindres, congés) ont leur contour, comme sur un plan.
- **Les cotes** de la zone, 6 au plus, tour à tour : Ø des trous dont le centre est sous la loupe, longueur des arêtes droites entières sous la loupe, rayon des arcs. Un trou traversant n'est coté qu'une fois ; deux côtés opposés égaux, une seule fois ; des trous ou des rayons égaux, une seule cote avec leur nombre (« 2× Ø8 », « 4× R10 »). Une arête cachée par la pièce n'est pas cotée.
- Les textes restent dans le cercle et ne se chevauchent pas ; la cote d'une arête se pose du côté extérieur de la pièce.
- Quand la vue ou la loupe bouge, les cotes s'effacent (l'étiquette montre « … ») et reviennent dès que la vue est calme.
- L'étiquette donne le nombre de cotes posées ; « rien à coter ici » à côté de la pièce.
- Agrandir la loupe sur toute la pièce donne les cotes principales de la pièce entière.
- La lentille Plan n'enlève rien à la sélection.

## Lentille Rendu

Sous la loupe, la pièce prend sa matière réelle, comme dans le Rendu direct : métal, reflets de l'ambiance, fond dégradé. Autour, la CAO garde ses couleurs de travail.

- **La matière** est celle de l'apparence de rendu de chaque corps (clic droit sur le corps → apparence de rendu) : inox, aluminium, laiton, plastique… avec son état de surface (brossé, sablé…). Un corps sans apparence de rendu garde sa couleur, dans une matière neutre légèrement brillante.
- **L'étiquette** donne la matière sous le centre de la loupe, avec son état de surface (« Inox brossé ») ; « sans matériau » pour un corps qui n'en a pas ; « rien ici » à côté de la pièce.
- Changer l'apparence d'un corps met la loupe à jour aussitôt.
- Les reflets suivent l'ambiance et l'orientation de la lumière choisies pour le Rendu direct.
- Agrandir la loupe sur toute la pièce donne l'aperçu du rendu sans quitter la CAO.
- La lentille Rendu n'enlève rien à la sélection.
