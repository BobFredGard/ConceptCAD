[ConceptCAD](../../README.md) › [Manuel](README.md) › Téléphone et tablette

# Téléphone et tablette

Sur un appareil tactile à petit écran, ConceptCAD passe tout seul en **interface téléphone**. Même application, mêmes fichiers `.conceptcad` que sur PC.

- **Vue 3D plein écran**, en portrait ou en paysage.
- **Barre du haut** : menu ☰, nom du fichier (• = modifié), Annuler, Rétablir.
- **Barre d'outils** : **Créer**, **Arbre**, **Paramètres**, **Cadrer**, **Vues** (en bas en portrait, à gauche en paysage).
- **Menu ☰** : Nouveau, Ouvrir, Enregistrer, **Partager / envoyer** (quand le téléphone le permet), export STL et STEP, thème, retour à l'interface bureau. Le brouillon est gardé dans le navigateur à chaque modification.
- **Panneau translucide** pour l'arbre, les paramètres et l'esquisse :
  - trois hauteurs (poignée à glisser ou à toucher) ; en paysage, il occupe le côté droit ;
  - l'**œil**, maintenu appuyé, montre la pièce à travers le panneau ;
  - après chaque valeur modifiée, le panneau s'efface un instant pour montrer le résultat.
- **Créer** : grille des commandes CAO.
  - Esquisse, Extrusion, Révolution, Balayage, Perçage, Plan, Axe, Point, Repère, Congé, Chanfrein, Face, Dépouille, Coque, Scinder, Répétition, Combiner, Déplacer, Échelle, Symétrie, Paramètres.
  - La fiche s'ouvre dans le panneau : **réduit** quand la commande attend des taps dans la vue (arêtes d'un congé, faces…), à moitié sinon.
  - Les arêtes se touchent avec une tolérance élargie.
- **Esquisse** : bandeau d'outils défilant à la place de la barre d'outils, **Abandonner** et **✔ Terminer** en haut.
  - Onglet « Esquisse » du panneau pour la santé, les contraintes et les cotes.
  - Un outil de tracé **vise en glissant** (aperçu et accrochages suivent le doigt) et pose le point **au lever** ; un tap pose sur place.
- **Activation** : automatique. `?mobile=1` force l'interface téléphone, `?mobile=0` l'interface bureau, `?mobile=auto` revient à la détection ; le choix est mémorisé. Sur un téléphone en interface bureau, un bouton « Interface téléphone » permet d'y revenir.
- Le premier lancement télécharge le noyau OCCT (≈ 43 Mo, puis en cache) : à faire de préférence en Wi-Fi.

Les gestes sont détaillés dans [Souris, clavier et doigts](raccourcis.md).

---

[← Interface](interface.md) · [Sommaire du manuel](README.md) · [Esquisse →](esquisse.md)
