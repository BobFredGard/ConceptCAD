[ConceptCAD](../../README.md) › [Manuel](README.md) › RENDU

# RENDU

Une image soignée de la pièce ou de l'assemblage, en **1920×1080 ou 4K**, enregistrée en PNG. L'atelier a sa propre scène : la vue CAO n'est jamais touchée. Ses réglages servent aussi au **rendu direct** de la vue CAO / FAO.
- **Deux moteurs**, tous deux sur la carte graphique :
  - **Rapide** : l'image s'affine passe après passe, quelques secondes ;
  - **Lancer de rayons** (three-gpu-pathtracer) : lumière renvoyée, reflets entre pièces, vrai verre ; 128, 512 ou 2048 échantillons pour l'image finale, chargé seulement quand on le choisit.
- **Matériaux** de la bibliothèque commune (aciers, aluminiums usinés ou anodisés, laiton, titane, plastiques, élastomères, peintures, bois, verres), choisis **au clic droit sur chaque pièce** :
  - **couches** : paillettes sous vernis, irisation (titane bleui, peinture nacrée) ;
  - **reliefs procéduraux** : brossé, sablé, moleté, bois ;
  - **patine** par corps : taches de teinte, usure des arêtes vives, salissure des creux, de légère à très usée.
- **Ambiances** générées à la volée (studio, studio lumineux, atelier, extérieur, scène noire), ou **image HDRI importée** (`.hdr`, `.exr`) dont le soleil porte l'ombre ; gardée par le navigateur, jamais dans le fichier.
- **Fond** : dégradé, uni, transparent (PNG détouré), **studio courbe** ou l'HDRI elle-même.
- **Sol** : miroir, ombre réglable, et **80 supports** à l'échelle réelle, avec galerie de vignettes.
  - Pierre, bois, carrelage, métal, peintures mates, satinées, brillantes et métallisées, textiles, verres dépolis, LED, atelier.
  - Chacun a son reflet, et les LED éclairent la pièce au lancer de rayons.
  - Les mêmes sols s'affichent dans la vue 3D (⚙ → Support).
- **Appareil photo** : focale en mm, ouverture et **profondeur de champ**, mise au point au clic, exposition, rendu des tons ; **vues enregistrées** avec la pièce.
- **Environnement par pièce** : chaque pièce est enregistrée avec son ambiance, son fond, son sol, ses reflets et son support, et les retrouve à l'ouverture ; en assemblage, chaque composant garde le sien.
- **Finition** : débruitage (lancer de rayons), halo, vignettage, grain, contraste, saturation, température ; préréglages Neutre, Photo, Cinéma.
- **Calques séparés** au choix : une archive `.zip` avec l'image finale, le masque, la profondeur, les normales, une couleur par corps et l'ombre seule, prêts pour la retouche.

---

[← PLAN](plan.md) · [Sommaire du manuel](README.md) · [Souris, clavier et doigts →](raccourcis.md)
