[ConceptCAD](../../README.md) › [Manuel](README.md) › Fichiers

# Fichiers

- **Import** : STEP et STL.
- **Export** : STL, OBJ, STEP (détail plus bas) et **FreeCAD natif (`.FCStd`)** exact : corps à leur couleur, aimants avec leurs caractéristiques et leurs **lignes de champ** rangées par intensité.
- **Projet `.conceptcad`** compressé, 3 à 5 fois plus petit : pièce, FAO, planches, rendu. Les fichiers en clair, les `.conceptcad.gz` et les anciens `.miniFusion` s'ouvrent toujours.
- **Réouverture rapide** : une pièce ouverte ou enregistrée est gardée finie sur ce poste. Rouverte sans changement, elle s'affiche **sans être recalculée** (pièce d’une centaine de fonctions : quelques secondes au lieu d’une vingtaine), puis se prépare en fond pour que la première modification reste rapide. Cette préparation se met en pause dès que la souris, la molette ou le clavier bougent : la vue reste fluide si on tourne la pièce juste après l'ouverture. Le moindre changement (fichier, pièce importée ou dérivée) la fait recalculer.
  - Elle reste valable **d'une version du logiciel à l'autre** tant que le calcul des formes ne change pas ; relue, elle est contrôlée en fond contre un recalcul, et refaite au moindre écart.
  - Elle vit dans le navigateur ou l'appli **du poste où ConceptCAD tourne** (6 pièces au plus) : elle ne suit pas le fichier sur un autre ordinateur.
- **Récents**, **dossier de projets** et sauvegarde locale automatique. Un fichier vide ou abîmé ne remplace jamais le modèle ouvert, et sa copie de secours est proposée.
- **Export STEP** : **AP214** (par défaut) ou **AP203**, option « **sans courbes 2D** » pour les vieux logiciels.
  - Aussi pour un corps seul, ou pour **une seule pièce / un sous-ensemble d'un STEP multi-corps** (clic droit sur sa ligne de l'arborescence ou sur la pièce dans la vue 3D, placement d'assemblage gardé).
  - Un STEP ouvert tel quel se réexporte, sans ses pièces masquées.
  - **À la racine d'un assemblage, tout ce qui est visible part dans le même fichier, chaque pièce à sa place.**
- **Export STL** : une fenêtre fait choisir la finesse — **Grossier** (0,1 mm · 20°), **Normal** (0,03 mm · 10°), **Fin** (0,01 mm · 5°) ou **Personnalisé** (écart et angle au choix).
  - Elle annonce le **nombre de triangles**, le **poids du fichier** et le **nombre de côtés d'un cercle** (Ø5, Ø10, Ø50).
  - L'**aperçu 3D** montre exactement les triangles qui seront écrits : on tourne et on zoome sur un trou ou un congé avant d'exporter.
  - Le maillage est calculé sur la forme exacte, indépendamment de la finesse d'affichage ; le dernier choix est retenu.
- **STEP multi-corps** : arborescence des sous-ensembles et pièces avec leurs noms, pièces **masquables** (👁), **une couleur par pièce ou par occurrence** ; les gros fichiers (44 Mo, 73 000 faces) s'ouvrent et se manipulent sans à-coups.
- **Enregistrement sûr** : contenu vérifié avant écriture et relu après (jamais vide), version précédente gardée (`nom.conceptcad.bak` et copie dans le navigateur), menu **Copie de secours**.

---

[← Fonctions 3D](fonctions-3d.md) · [Sommaire du manuel](README.md) · [Assemblage →](assemblage.md)
