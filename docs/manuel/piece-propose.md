[ConceptCAD](../../README.md) › [Manuel](README.md) › La pièce qui propose

# La pièce qui propose

Comme le clavier du téléphone qui devine le mot suivant : **après chaque fonction**, ConceptCAD propose ce que l'on ferait probablement ensuite **sur ce que l'on vient de faire**, dans une bande discrète en bas de la vue. Une touche suffit pour le faire. On peut aussi écrire ce que l'on veut (« 4 trous M6 à 10 du bord »), ou essayer une variante et comparer les deux avant de choisir.

## Le bouton étincelle

En haut à droite de la vue 3D. Il ouvre un petit menu :

| Choix | Effet |
|---|---|
| **Proposer la suite** | coché : après chaque fonction, la bande « Ensuite ? » propose la suite. Décoché : plus rien ne s'affiche tout seul. Le choix est retenu sur le poste |
| **Écrire une demande…** (`/`) | ouvre la barre de demande en bas de la vue |
| **Essayer une variante** | met la pièce de côté (A) pour la comparer à ce que l'on va changer (B) |

Le bouton est orange tant que la suite est proposée. Il ne sert qu'en CAO, ni dans l'espace FAO ni en mise en plan. Rien n'est ajouté au document tant que l'on n'accepte pas une proposition.

## La suite après chaque fonction

**À l'ouverture d'une pièce, rien n'est proposé**, ni tant que l'on ne fait rien. Juste après avoir allumé, une ligne rappelle : « Fais une fonction : je te proposerai la suite ici. »

Quand on vient de faire une fonction (ou d'en modifier une), ConceptCAD regarde ce qu'elle a créé et propose au plus **3 suites** dans la bande « Ensuite ? » :

| Ce que l'on vient de faire | Ce qui est proposé |
|---|---|
| **Un congé ou un chanfrein** sur une arête | **le même** sur les arêtes pareilles de la même fonction (« Même congé R4 sur les 3 autres coins »), puis sur les mêmes arêtes ailleurs sur la pièce (« … sur les 4 coins de Découpe Esquisse 3 ») |
| **Une poche, une découpe, une extrusion…** qui laisse des coins vifs creux | **les arrondir** au rayon de la plus petite fraise de la FAO (aucune fraise ne fait de coin vif) : « Arrondir les 4 coins de Découpe Esquisse 2 · R3 » |
| La même chose, **une deuxième fois** | ce que l'on a fait la première fois : les coins au même rayon, le même chanfrein sur le bord (« Chanfrein 0,5 sur les 4 arêtes du bord de Découpe Esquisse 3 — comme tu l'as fait sur Découpe Esquisse 2 ») |
| **Un plot** (une extrusion qui ajoute de la matière), quand rien de ce qui précède ne s'applique | **arrondir ses arêtes verticales** (« Arrondir les 4 arêtes verticales de Extrusion Esquisse 1 · R6 » : rayon de ton dernier congé, sinon environ le dixième de la largeur), **casser les arêtes du dessus** (« Chanfrein 1 sur les 4 arêtes du dessus… » : 0,5 sur une pièce de moins de 80 mm, 1 au-delà) et, pour un plot posé sur la pièce, **un congé au pied** |
| **Un perçage** | un chanfrein **à l'entrée des trous** |

- **Les arêtes pareilles** : même genre (coin, arête du bord, arête du fond, trou), même hauteur, même longueur pour une arête courbe. Le tour d'un bloc n'est pas pris pour le bord d'une poche.
- **Les coins** ne sont proposés que là où une fraise peut descendre, dans l'axe de chaque posage et de chaque opération en 3+2 : le fond d'une poche ouverte sur le côté, sous un plafond, n'est pas proposé à une fraise verticale. Sans FAO : l'axe Z et la liste d'outils de départ.
- Le pli qu'un chanfrein laisse n'est pas une arête vive : un chanfrein qui a déjà fait le tour d'un bord ne propose rien de plus.
- Les habitudes ne durent que le temps de la séance.

### Survoler, faire, refuser

La bande montre les propositions numérotées. **Survoler** une proposition la dessine en fantôme orange sur la pièce (arêtes cachées en pointillés) et dit pourquoi en une phrase. Rien n'est dessiné tant que l'on ne survole pas.

| Touche | Effet |
|---|---|
| `1` `2` `3` | fait la proposition (ou un clic dessus) |
| `Tab` / `Maj+Tab` | met en avant la suivante / la précédente (elle est dessinée) |
| `Entrée` | fait celle mise en avant |
| `Échap` | retire la mise en avant ; sinon, comme **Non merci** |

**Non merci** (ou `Échap`) : ces propositions ne reviennent plus pour cette fonction.

Accepter pose une fonction ordinaire (**Congé**, **Chanfrein**, **Perçage**) : elle apparaît dans l'historique, se modifie comme les autres, et **une seule** `Ctrl+Z` l'annule. La bande le dit (« Fait : … · Ctrl+Z pour revenir »). Si le noyau refuse (« Refusé : … »), la pièce n'a pas bougé et les propositions restent.

## La demande écrite

`/` (ou **Écrire une demande…** dans le menu) ouvre une barre en bas de la vue. On écrit en français, puis `Entrée` :

| Exemple | Ce que ConceptCAD comprend |
|---|---|
| « 4 trous M6 à 10 du bord » | 4 taraudages M6 borgnes (profondeur 2,5 × Ø), à 10 mm du bord |
| « 2 trous Ø8 traversants » | 2 perçages Ø8 débouchants |
| « 6 trous Ø5 en cercle au centre » | 6 perçages sur un cercle centré |
| « deux taraudages M8 profondeur 12 » | nombre en lettres, profondeur donnée |
| « congés R2 sur les arêtes extérieures » | congés R2 sur le contour |
| « chanfrein 0,5 sur le dessus » | chanfrein 0,5 sur les arêtes vives du dessus |
| « congés dans les coins intérieurs » | rayon de la plus petite fraise |

- **Les trous** vont sur la plus grande face plane du dessus. ConceptCAD essaie chaque placement possible (aux coins, au milieu des côtés, en diagonale, en ligne, en cercle, 3 × 2…), vérifie qu'il y a de la matière sous chaque trou et tout autour, et dessine en fantôme au plus 3 placements qui tiennent. `1`, `2`, `3` ou un clic choisit.
- **Sans distance au bord**, ConceptCAD prend la distance habituelle (environ 2 × Ø) ou la plus proche qui tient : sur un dessus en cadre autour d'une poche, les trous se recentrent sur le cadre.
- **Sans profondeur**, un trou Ø est traversant et un taraudage fait 2,5 × Ø. Une profondeur plus grande que la pièce est refusée (écrire « traversant »).
- **Congés et chanfreins** : « intérieurs », « extérieurs », « dessus », « partout ». Sans précision, les propositions vont des coins intérieurs à toutes les arêtes vives.
- Une demande non comprise affiche ce que ConceptCAD sait faire, avec des exemples à cliquer. Les filetages inconnus et plus de 24 trous à la fois sont refusés avec la raison.
- **Échap** (champ vide) ou ✕ ferme la demande. Si la pièce change pendant que la demande est ouverte, les placements sont recalculés. La demande marche aussi quand « Proposer la suite » est décoché.
- Tout se lit sur place : rien n'est envoyé sur Internet.

## Les futurs parallèles

**Essayer une variante** (menu du bouton étincelle) met la pièce telle qu'elle est de côté : c'est la variante **A**. On continue à modifier la pièce : c'est la variante **B**. Une carte apparaît en haut à droite de la vue.

- La carte montre les deux variantes l'une sous l'autre : ce qui les distingue en mots courts (« Découpe Esquisse 2 : 6 mm » / « : 3 mm », « + Congé » / « sans Congé ») et la **masse** (matière du corps, aluminium sinon).
- **Voir** montre l'autre variante. Chacune garde son propre historique d'annulation : `Ctrl+Z` dans B ne revient pas dans A.
- **Garder A** ou **Garder B** : celle-là reste, l'autre est oubliée.
- **Les deux** : la variante affichée reste dans ce document, l'autre est enregistrée dans son propre fichier (« Pièce — variante A.conceptcad »). Si l'enregistrement est annulé, les deux variantes restent.
- La variante de côté ne vit qu'en mémoire : ouvrir une autre pièce l'oublie.
