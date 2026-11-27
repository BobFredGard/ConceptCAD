[ConceptCAD](../../README.md) › [Manuel](README.md) › Interface

# Interface

![Le ruban de l’espace CAO, avec la liste « Créer » ouverte : chaque fonction, son raccourci et son épingle](../captures/cao-menus.png)

Quatre espaces dans le bandeau supérieur : **CAO**, **FAO**, **PLAN** et **RENDU**.
- **Bandeau** : barre rapide (annuler, rétablir, fichiers), **recherche de commandes** (`Ctrl+K`), état du noyau, **Régénérer**, nom du document (● = modifications non enregistrées ; les calculs faits en fond, comme la remise à jour des parcours FAO, ne l’allument pas) et version.
- **Ruban à icônes** propre à chaque espace ; en esquisse, il laisse la place au bandeau d'esquisse.
  - Comme dans Fusion 360, le **nom de chaque groupe** (Créer ▾, Modifier ▾…) ouvre la liste de toutes ses fonctions, avec leur **raccourci clavier**.
  - L'**épingle 📌** choisit celles qui restent aussi dans le ruban ; les moins courantes n'y sont plus par défaut, pour gagner de la place.
  - Un ruban qui passerait à la ligne resserre ses boutons pour tenir sur une seule.
  - En PLAN, le bouton de l'outil en cours reste allumé tant que l'outil est actif.
- **Écran de démarrage** animé de 6 s, logo bleu et orange ; un clic ou `Échap` le passe.
- **Navigateur Modèle / Usinage / Plan** à gauche, avec des **onglets de posages** ; **propriétés** à droite ; **timeline** en bas de la vue 3D.
  - La **vue 3D va jusqu'au bord droit** : le panneau Paramètres flotte par-dessus, comme l'arborescence (même fond transparent, contour, flou de la pièce dessous, barre de défilement discrète), tout en haut à droite.
  - Son **onglet de repli** est collé au bord droit ; le **cube et ses icônes** se rangent à sa gauche et suivent son ouverture.
  - **Ouverture automatique** : en CAO, le panneau s'ouvre sur une fonction, une esquisse ou un corps, et se replie quand on clique ailleurs — sauf si la fonction n'est pas encore validée (OK, Valider, Appliquer). En FAO, il s'ouvre au choix d'un posage ou d'une opération et ne se referme pas seul.
  - **Fonction non validée** : un clic sur une autre fonction est refusé ; une boîte le rappelle avec **Valider et continuer**, **Annuler les modifications** ou **Rester**.
  - La pièce est **centrée sur toute la vue 3D** : ouvrir ou replier un panneau ne la déplace plus.
  - Le **nom du document** se modifie en tête de l'arborescence, au-dessus d'Origine.
  - **Listes compactes** : les listes d'un panneau (opérations répétées, trous d'un perçage, corps à usiner, fonctions répétées, arêtes d'un congé, faces d'une coque, d'une dépouille, d'un déplacement ou d'une scission, relations d'assemblage, corps et paramètres à dériver) tiennent sur **une ligne par élément**, en petit, avec le strict minimum (« 1. Ébauche 3D ↻3 », « Ø5.5 × 4 · déb. », « Face 2 »). Le détail (position, profondeur, raison d'une case grisée…) s'affiche en **survolant la ligne** ; un clic sur le texte coche la case.
- **Sélection synchronisée** : cliquer une face l'allume et **surligne** la fonction qui l'a créée dans l'arbre et la timeline, sans l'ouvrir (ni panneau, ni flèche) ; un clic sur cette ligne l'ouvre avec sa flèche. `Ctrl+clic` ne fait que mesurer, sans rien sélectionner.
- **Clic long = choisir sous le clic** : un appui d'une demi-seconde sans bouger liste toutes les faces traversées (de l'avant vers l'arrière, même cachées) et les arêtes proches ; l'élément survolé s'allume à travers la matière, un clic sur sa ligne ou `Entrée` le prend, y compris dans une fonction qui attend une face ou une arête (congé, perçage, coque…).
- **Fenêtres de fonctions** à boutons-icônes, aperçu immédiat, poignées dans la vue, **Annuler / OK**.
- **Barre de progression** à l'ouverture d'un document, au chargement du noyau et sur **⟳ Régénérer** : bandeau semi-transparent en bas de la vue 3D, au-dessus de la timeline.
  - Elle donne l'avancement (n / total), le nom de la fonction et celui de l'esquisse en cours.
  - Elle prend la couleur de la fonction calculée (celle de la timeline).
  - Sur ⟳ Régénérer, elle s'affiche dès le clic ; ailleurs, seulement si la régénération dure.
- **Recalcul en arrière-plan** après une modification (fiche d'une fonction, fenêtre de fonction, paramètre, œil, marqueur de la timeline, annulation, sortie d'esquisse) : si le calcul dure, la main revient tout de suite. L'ancienne pièce reste affichée, la vue tourne, et un bandeau sans voile montre l'avancement. La nouvelle pièce s'affiche d'un coup quand elle est prête. Une autre modification pendant ce temps relance le calcul sur le nouvel état. La FAO attend la nouvelle pièce. Les esquisses projetées sont réglées dans le même calcul. `?sansfond` dans l'adresse : calcul d'un seul tenant, comme avant. Revenir à la valeur précédente (ou annuler) est presque immédiat : les deux dernières versions de la timeline restent gardées. La nouvelle pièce est aussi découpée en triangles pendant ce calcul, pour l'affichage et pour la FAO, avec tous les cœurs du noyau : elle s'affiche sans à-coup.
- **Bandeau « calcul en cours »** pendant le recalcul d'une pièce lourde après la modification d'un paramètre, et **nom du noyau** en clair en bas de la vue 3D.
- **Annuler / Rétablir partout** (`Ctrl+Z` / `Ctrl+Y`) : CAO, esquisse, assemblage, FAO, PLAN et RENDU.
- **Apparence** (menu 🎨) :
  - **cinq thèmes** : Nuit, Graphite, Atelier, Clair, Contraste élevé ;
  - **fiches illustrées au survol**, façon dessin animé (actives par défaut, ⚙ → Affichage pour les couper) : une image avant → après qui s'anime, une phrase simple, les étapes et le raccourci de chaque icône ;
  - **quatre styles d'icônes** : au trait, couleurs par famille (une teinte par groupe du ruban), dessinées en volume, délire.
- **Vue 3D** : cube de vue (axes X rouge, Y vert, Z bleu épais, fléchés et lettrés, qui dépassent du cube), orbite contrainte ou libre, centre de rotation sur le point visé, zoom vers le curseur, sol miroir, transparence « verre », **effet de perspective** réglable (de presque orthographique à fuyantes marquées, la pièce garde sa taille).
- **Vue en veille** : à l'arrêt, la vue 3D ne se redessine plus en continu (la carte graphique d'un portable souffle, même avec une pièce lourde) ; elle repart à pleine vitesse au moindre geste. `?sansveille` dans l'adresse garde l'ancien affichage continu.
- **Modification d'une grosse pièce** : seules les faces neuves ou modifiées sont remaillées et leurs arêtes reclassées, le reste est repris tel quel (mêmes triangles, mêmes arêtes). `?sansfacettes` dans l'adresse redonne le calcul complet, `?sansindex` l'ancienne recherche de la face sous la souris.
- **Coupe X / Y / Z** (⚙ › Coupe) : plan de coupe glissé ou saisi au mm, côté inversable, faces coupées remplies.
- **Lentilles** (bouton loupe de la barre de vue) : une loupe ronde posée sur la pièce montre, dessous, l'intérieur (Coupe), les passes, la fraise et le temps de coupe de la zone (FAO), la pièce au trait cotée (Plan) ou sa vraie matière (Rendu) ; le reste de la vue ne bouge pas. Voir [Lentilles](lentilles.md).
- **La pièce qui propose** (bouton étincelle de la barre de vue) : après chaque fonction, la suite probable dans une bande discrète en bas de la vue. Voir [La pièce qui propose](piece-propose.md).
- **Rendu direct** (bouton de la barre de vue) : la vue CAO ou FAO prend les matériaux, reliefs et patine de l'atelier RENDU, son ambiance et son fond, en temps réel.
- **Journal d’erreurs** : les plantages sont notés sur l’ordinateur, sans aucun envoi ni contenu de la pièce. Dans l’**Aide** (F1 hors esquisse) : enregistrer, copier ou vider le journal, pour faire analyser les pannes.

---

[← Démarrage](demarrage.md) · [Sommaire du manuel](README.md) · [Téléphone et tablette →](telephone.md)
