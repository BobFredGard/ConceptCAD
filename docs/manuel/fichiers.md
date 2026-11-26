[ConceptCAD](../../README.md) › [Manuel](README.md) › Fichiers

# Fichiers

- **Import** : STEP, **IGES** (`.igs`, `.iges`) et STL.
  - À chaque import, ConceptCAD demande : **nouveau corps dans la pièce**, ou **pièce à assembler** (un composant neuf, posé à côté de ce qui existe, prêt à placer ou aligner ; Ctrl+Z l’annule). En mode Placer, « pièce à assembler » est proposé d’abord.
  - Un IGES arrive souvent en surfaces séparées : elles sont **cousues en solide** quand elles se referment ; sinon elles restent des surfaces (affichées et usinables, mais ni unies ni soustraites).
  - **Arêtes, sommets et faces d’un import** se choisissent comme ceux d’une pièce dessinée, même quand l’import est seul dans son corps : projection et intersection dans une esquisse posée dessus, plans, axes et points de construction, relations d’assemblage, et esquisses des autres pièces d’un assemblage (arêtes et faces de la pièce importée).
  - Les surfaces que certains logiciels (SolidWorks…) écrivent sans plan ni cylindre sont **remises en vrais plans et cylindres** à l’import : faces, trous et congés se suppriment alors comme sur un STEP.
  - **Parasolid (`.x_t`)** : format fermé, illisible — réexportez la pièce en STEP ou en IGES depuis le logiciel d’origine.
- **Export** : STL, OBJ, STEP (détail plus bas) et **FreeCAD natif (`.FCStd`)** exact : corps à leur couleur, aimants avec leurs caractéristiques et leurs **lignes de champ** rangées par intensité.
- **Où enregistrer l’export** : pour chaque export (STEP, STL, OBJ, FreeCAD, et STEP d’un corps ou d’une pièce par clic droit), une fenêtre « Enregistrer sous » permet de choisir le dossier et le nom du fichier. Le dernier dossier choisi est proposé la fois suivante. « Annuler » n’écrit rien. Dans l’appli Mac et sous Firefox ou Safari, le fichier part dans les Téléchargements comme avant.
- **Projet `.conceptcad`** compressé, 3 à 5 fois plus petit : pièce, FAO, planches, rendu. Les fichiers en clair, les `.conceptcad.gz` et les anciens `.miniFusion` s'ouvrent toujours.
- **Réouverture rapide** : une pièce ouverte ou enregistrée est gardée finie sur ce poste. Rouverte sans changement, elle s'affiche **sans être recalculée** (pièce d’une centaine de fonctions : quelques secondes au lieu d’une vingtaine), puis se prépare en fond pour que la première modification reste rapide. Cette préparation se met en pause dès que la souris, la molette ou le clavier bougent : la vue reste fluide si on tourne la pièce juste après l'ouverture. Le moindre changement (fichier, pièce importée ou dérivée) la fait recalculer.
- **Image de la pièce dans le fichier** : à l'enregistrement, la pièce finie (solide exact, affichage, noms des faces) est rangée dans le fichier `.conceptcad` lui-même, compressée. Un autre poste qui ouvre ce fichier l'affiche aussitôt, sans recalcul et sans en garder de copie sur son disque ; un contrôle en fond vérifie qu'elle correspond bien au calcul. Le fichier est plus lourd (de quelques centaines de Ko à quelques Mo). Si le document a changé depuis, l'image est ignorée et la pièce recalculée. Enregistrer juste après l’ouverture ou juste après une modification garde l’image : ConceptCAD reprend celle du fichier, ou attend la fin du calcul (une minute au plus).
  - Elle reste valable **d'une version du logiciel à l'autre** tant que le calcul des formes ne change pas ; relue, elle est contrôlée en fond contre un recalcul, et refaite au moindre écart.
  - Elle vit dans le navigateur ou l'appli **du poste où ConceptCAD tourne** (6 pièces au plus) : elle ne suit pas le fichier sur un autre ordinateur.
- **Récents**, **dossier de projets** et sauvegarde locale automatique. Un fichier vide ou abîmé ne remplace jamais le modèle ouvert, et sa copie de secours est proposée.
- **Export STEP** : **AP214** (par défaut) ou **AP203**, option « **sans courbes 2D** » pour les vieux logiciels.
  - Aussi pour un corps seul, ou pour **une seule pièce / un sous-ensemble d'un STEP multi-corps** (clic droit sur sa ligne de l'arborescence ou sur la pièce dans la vue 3D, placement d'assemblage gardé).
  - Un STEP ouvert tel quel se réexporte, sans ses pièces masquées.
  - **À la racine d'un assemblage, tout ce qui est visible part dans le même fichier, chaque pièce à sa place.**
- **Assemblage complet → dossier** (Fichier → Exporter → **📦 Dossier**) : l'assemblage, toutes ses pièces liées et leurs programmes CN déjà calculés sont copiés d'un coup dans le dossier choisi, sous-dossiers gardés. Les copies s'ouvrent entre elles : les originaux ne sont pas touchés. Un posage dont les parcours ne sont pas à jour est signalé, à recalculer.
  - Les **pièces sources des dérivées** (Dériver) partent aussi, avec leurs propres sources : chaque copie dérive de la copie de sa source, et la copie rouverte ne demande aucune mise à jour. Une source introuvable est signalée dans le bilan, son lien est laissé tel quel (V0.99.79).
- **Export STL** : une fenêtre fait choisir la finesse — **Grossier** (0,1 mm · 20°), **Normal** (0,03 mm · 10°), **Fin** (0,01 mm · 5°) ou **Personnalisé** (écart et angle au choix).
  - Elle annonce le **nombre de triangles**, le **poids du fichier** et le **nombre de côtés d'un cercle** (Ø5, Ø10, Ø50).
  - L'**aperçu 3D** montre exactement les triangles qui seront écrits : on tourne et on zoome sur un trou ou un congé avant d'exporter.
  - Le maillage est calculé sur la forme exacte, indépendamment de la finesse d'affichage ; le dernier choix est retenu.
- **STEP multi-corps** : arborescence des sous-ensembles et pièces avec leurs noms, pièces **masquables** (👁), **une couleur par pièce ou par occurrence** ; les gros fichiers (44 Mo, 73 000 faces) s'ouvrent et se manipulent sans à-coups.
- **Parcours FAO dans le fichier** : les parcours calculés sont rangés dans le `.conceptcad`, la pièce se rouvre sans recalcul. Depuis la V0.99.43 ils sont écrits en colonnes exactes, sans rien arrondir : fichier plus léger (une pièce de 15,8 Mo passe à 13,3 Mo), mêmes points au bit près, même code machine. Une version plus ancienne de ConceptCAD ne lit pas ces parcours et les recalcule.
- **Enregistrement sûr** : contenu vérifié avant écriture et relu après (jamais vide), version précédente gardée (`nom.conceptcad.bak` et copie dans le navigateur), menu **Copie de secours**.
  - Un seul enregistrement à la fois : Ctrl+S appuyé deux fois ou maintenu pendant qu'une grosse pièce s'enregistre ne fait plus échouer l'enregistrement ni ouvrir « Enregistrer sous » (V1.0.2). « Enregistrement de … » s'affiche dès le début.
  - Fichier bloqué un instant par un autre logiciel (synchronisation Dropbox, antivirus, serveur) : ConceptCAD réessaie tout seul pendant une seconde et demie avant de proposer « Enregistrer sous ».

---

[← Fonctions 3D](fonctions-3d.md) · [Sommaire du manuel](README.md) · [Assemblage →](assemblage.md)
