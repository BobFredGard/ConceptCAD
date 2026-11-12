[ConceptCAD](../../README.md) › [Manuel](README.md) › Assemblage

# Assemblage

Comme dans Fusion 360, **tout est composant** : le fichier est le composant racine, ses enfants sont des pièces complètes, à n'importe quelle profondeur.
- **Arbre unifié** : pièce et composants dans une seule arborescence, avec recherche et glisser-déposer ; sélection multiple dans l'arbre (`Ctrl+clic`, `Shift+clic` = plage) aussi en mode Assembler.
- **Modéliser** le composant actif (le reste de l'assemblage affiché autour) ou **Assembler** ses enfants (manipulateur, pas de 1 mm et 5°). Dans les deux modes, la vue tourne autour du composant visé.
- **FAO** permise seulement quand une **pièce** est active (pas en mode Assembler).
- **Composant**, **Occurrence**, **Insérer** un autre fichier, **Depuis corps** pour convertir une pièce multicorps sans rien remodéliser.
- **Normalisés** : vraies fonctions (révolution, six pans creux), avec aperçu coté.
  - **Vis** ISO 4762 / ISO 10642 (pas gros par défaut, pas fins au choix), ANSI SHCS / FHCS 82° (UNC ou UNF).
  - **Bouchons** six pans creux DIN 906, DIN 908 et NPTF.
  - **Goupilles** ISO 2338, 8734, 2339, 8752 et ANSI (dowel, spring).
  - **Clavettes** ISO 773 formes A, B, C.
  - **Rondelles** plates ISO 7089, 7090 (chanfreinée), 7092 (étroite), 7093-1 (large), Grower DIN 127 B, ANSI B18.22.1 Type A (séries N et W) et lock washers B18.21.1.
  - **Engrenages** à vraie développante (ISO 53, ISO 21771) : roue, couronne ou crémaillère, denture droite ou hélicoïdale, déport, alésage et rainure de clavette. Sous-coupe, dent en pointe et autres défauts sont signalés.
  - **Paire d'engrenages** : pignon avec roue, couronne ou crémaillère, posés dents logées au bon entraxe, avec le jeu choisi. Entraxe, rapport de conduite et interférences affichés. Les pièces restent libres (pas de lien de mouvement) ; la résistance des dents n'est pas calculée. L'export STEP se fait pièce par pièce. Exemple : `Exemples/Engrenages.conceptcad`.
  - **Sur des trous** : un clic sur un trou pose la pièce dans tous les trous identiques (simples, lamés, fraisés), en liaison rigide qui suit les trous (vis FHC 0,2 mm sous la surface, goupilles par leur centre : milieu du trou, arête haute ou basse, au plus court du clic).
  - **Sur des oblongs** (rondelles) : un clic dans un trou oblong pose une rondelle sur sa face, sur tous les oblongs identiques : dans l'axe du trou rond de la pièce du dessous (elle suit ce trou), ou au centre de l'oblong s'il n'y en a pas ou si on le choisit.
  - **Dans une rainure** : une clavette se pose au fond d'une rainure (fermée ou débouchante), par le centre de face ou contre un bout rond, et toutes les rainures identiques sont équipées.
  - **Modifier…** (propriétés ou clic droit) rouvre la fenêtre sur la pièce : toutes ses occurrences, ou celle-ci seulement.
- **Aimants** : bibliothèque d'aimants réels, avec leurs caractéristiques, montrés en deux moitiés (pôle nord rouge, pôle sud vert).
  - Formes : disques, cylindres, cubes, pavés, anneaux, cônes tronqués, disques aimantés en travers, disques et pavés à visser à trous fraisés.
  - Clic droit sur un aimant posé : afficher ou masquer ses lignes de champ 3D, calculées dans l'air. Avec plusieurs aimants posés, les lignes suivent leur champ additionné (attraction, répulsion).
- **Composants liés** à un fichier du dossier de projets : édition sur place, mise à jour, conflits gérés.
- **Dérivée** (bouton **🔗 Dériver**) : paramètres et corps d'un autre fichier du dossier de projets, qui suivent leur source quand elle change (lien à sens unique : la source n'est jamais réécrite). Un paramètre dérivé se modifie dans sa source ; un corps dérivé reste modifiable dans le fichier qui le reçoit, ses fonctions ajoutées survivent aux mises à jour, et il peut servir d'outil à soustraire avec **Combiner**.
- **Répétition** de composants : linéaire (1 ou 2 directions), circulaire, symétrie, suivant un profil. Une même répétition peut porter **plusieurs composants** : panneau ouvert, un clic sur un composant (vue ou arbre) l'ajoute ou le retire, ✕ dans la liste du panneau pour le retirer.
- **Paramètres dans les champs de l'assemblage** : Aligner, Placement et Répétition acceptent un paramètre ou une expression (`pas_SM`, `-L/2`) et **gardent le lien** : le paramètre change, la pièce se replace et la répétition se refait. Le lien est gardé dans le fichier.
- **Ouverture rapide** : l'image mesurable de chaque pièce est gardée d'une ouverture à l'autre, aussi pour une pièce qui contient une forme importée ou dérivée ; une soustraction de corps dérivé est là dès le premier affichage.
- **Aligner** un repère ou un **point d'accroche** (centre et points cardinaux d'une face, axe d'un cylindre, centre d'un cercle) sur un autre composant, de façon associative.
- **Liaisons** : rigide, pivot, glissière, pivot glissant, plan, rotule, avec limites, curseurs et animation.
- **Références entre composants** : faces, arêtes, sommets, plans et axes d'un autre composant servent de références, et suivent ses changements.
- **Inspecter** : propriétés physiques (volume, masse, centre de gravité) et interférences.
- **Apparence de rendu** par pièce au clic droit, appliquée d'un coup à toutes les occurrences d'un composant (visserie).

---

[← Fichiers](fichiers.md) · [Sommaire du manuel](README.md) · [FAO →](fao.md)
