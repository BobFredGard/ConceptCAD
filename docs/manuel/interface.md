[ConceptCAD](../../README.md) › [Manuel](README.md) › Interface

# Interface

Quatre espaces dans le bandeau supérieur : **CAO**, **FAO**, **PLAN** et **RENDU**.
- **Bandeau** : barre rapide (annuler, rétablir, fichiers), **recherche de commandes** (`Ctrl+K`), état du noyau, **Régénérer**, nom du document (● = non enregistré) et version.
- **Ruban à icônes** propre à chaque espace ; en esquisse, il laisse la place au bandeau d'esquisse.
  - Comme dans Fusion 360, le **nom de chaque groupe** (Créer ▾, Modifier ▾…) ouvre la liste de toutes ses fonctions, avec leur **raccourci clavier**.
  - L'**épingle 📌** choisit celles qui restent aussi dans le ruban ; les moins courantes n'y sont plus par défaut, pour gagner de la place.
  - Un ruban qui passerait à la ligne resserre ses boutons pour tenir sur une seule.
  - En PLAN, le bouton de l'outil en cours reste allumé tant que l'outil est actif.
- **Écran de démarrage** animé de 6 s, logo bleu et orange ; un clic ou `Échap` le passe.
- **Navigateur Modèle / Usinage / Plan** à gauche, avec des **onglets de posages** ; **propriétés** à droite ; **timeline** en bas de la vue 3D.
- **Sélection synchronisée** : cliquer une face l'allume et **surligne** la fonction qui l'a créée dans l'arbre et la timeline, sans l'ouvrir (ni panneau, ni flèche) ; un clic sur cette ligne l'ouvre avec sa flèche. `Ctrl+clic` ne fait que mesurer, sans rien sélectionner.
- **Fenêtres de fonctions** à boutons-icônes, aperçu immédiat, poignées dans la vue, **Annuler / OK**.
- **Barre de progression** à l'ouverture d'un document, au chargement du noyau et sur **⟳ Régénérer** : bandeau semi-transparent en bas de la vue 3D, au-dessus de la timeline.
  - Elle donne l'avancement (n / total), le nom de la fonction et celui de l'esquisse en cours.
  - Elle prend la couleur de la fonction calculée (celle de la timeline).
  - Sur ⟳ Régénérer, elle s'affiche dès le clic ; ailleurs, seulement si la régénération dure.
- **Bandeau « calcul en cours »** pendant le recalcul d'une pièce lourde après la modification d'un paramètre, et **nom du noyau** en clair en bas de la vue 3D.
- **Annuler / Rétablir partout** (`Ctrl+Z` / `Ctrl+Y`) : CAO, esquisse, assemblage, FAO, PLAN et RENDU.
- **Apparence** (menu 🎨) :
  - **cinq thèmes** : Nuit, Graphite, Atelier, Clair, Contraste élevé ;
  - **fiches illustrées au survol**, façon dessin animé (actives par défaut, ⚙ → Affichage pour les couper) : une image avant → après qui s'anime, une phrase simple, les étapes et le raccourci de chaque icône ;
  - **quatre styles d'icônes** : au trait, couleurs par famille (une teinte par groupe du ruban), dessinées en volume, délire.
- **Vue 3D** : cube de vue, orbite contrainte ou libre, centre de rotation sur le point visé, zoom vers le curseur, sol miroir, transparence « verre », **effet de perspective** réglable (de presque orthographique à fuyantes marquées, la pièce garde sa taille).
- **Vue en veille** : à l'arrêt, la vue 3D ne se redessine plus en continu (la carte graphique d'un portable souffle, même avec une pièce lourde) ; elle repart à pleine vitesse au moindre geste. `?sansveille` dans l'adresse garde l'ancien affichage continu.
- **Modification d'une grosse pièce** : seules les faces neuves ou modifiées sont remaillées et leurs arêtes reclassées, le reste est repris tel quel (mêmes triangles, mêmes arêtes). `?sansfacettes` dans l'adresse redonne le calcul complet, `?sansindex` l'ancienne recherche de la face sous la souris.
- **Coupe X / Y / Z** (⚙ › Coupe) : plan de coupe glissé ou saisi au mm, côté inversable, faces coupées remplies.
- **Rendu direct** (bouton de la barre de vue) : la vue CAO ou FAO prend les matériaux, reliefs et patine de l'atelier RENDU, son ambiance et son fond, en temps réel.
- **Journal d’erreurs** : les plantages sont notés sur l’ordinateur, sans aucun envoi ni contenu de la pièce. Dans l’**Aide** (F1 hors esquisse) : enregistrer, copier ou vider le journal, pour faire analyser les pannes.

---

[← Démarrage](demarrage.md) · [Sommaire du manuel](README.md) · [Téléphone et tablette →](telephone.md)
