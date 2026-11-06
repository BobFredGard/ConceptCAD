# ConceptCAD sur Mac : quoi faire

Les réglages Mac sont sur la branche `claude/vigorous-swanson-45df96`. Ils ne sont pas encore essayés sur un vrai Mac.

## Obtenir le DMG

**Le plus simple pour commencer :** fabriquer le DMG sur votre Mac, car il s'ouvre alors sans le blocage d'Apple.

```bash
git clone --branch claude/vigorous-swanson-45df96 https://github.com/BobFredGard/ConceptCAD.git
```

```bash
cd ConceptCAD && bash tauri/mac/construire.sh
```

Le script dit ce qui manque, puis où se trouve le DMG. La première fois, comptez une dizaine de minutes.

**Sans rien installer :** téléchargez `ConceptCAD-Mac-dmg` en bas du dernier passage réussi, sur [la page de fabrication GitHub](https://github.com/BobFredGard/ConceptCAD/actions/workflows/application-mac.yml). Il faut être connecté à GitHub.

Ce DMG-là venant d'Internet, le Mac bloque le premier lancement. Une fois l'application glissée dans Applications, essayez de l'ouvrir, puis allez dans Réglages Système > Confidentialité et sécurité > « Ouvrir quand même ». Si le Mac dit que l'application est endommagée :

```bash
xattr -cr /Applications/ConceptCAD.app
```

## Les essais

Travaillez sur une **copie** de pièce, pas sur un original.

1. **Démarrage :** l'application s'ouvre, le logo est dans le Dock, le noyau finit de charger sans message d'erreur.
2. **3D :** une pièce s'affiche, elle tourne et se déplace normalement à la souris.
3. **Ouvrir :** Fichier > Ouvrir montre la vraie fenêtre du Mac et ouvre la pièce.
4. **Modifier :** changez une cote, la pièce se recalcule.
5. **Enregistrer :** Cmd+S enregistre sans question. Fermez, rouvrez : la modification est là.
6. **Enregistrer sous :** un nouveau nom crée bien un nouveau fichier, dans le dossier choisi.
7. **Double-clic :** application fermée, double-cliquez sur un `.conceptcad` : il s'ouvre. Recommencez sur un autre, application ouverte : il s'ouvre dans la même fenêtre.
8. **Quitter :** modifiez sans enregistrer, puis Cmd+Q : la question d'enregistrement arrive. Refaites avec le bouton rouge de la fenêtre.
9. **Raccourcis :** Cmd+Z annule dans le logiciel. Cmd+C et Cmd+V marchent dans un champ de texte.
10. **FAO et exports :** calculez un parcours, exportez un STEP et un G-code : la fenêtre « Enregistrer sous » s'ouvre et le fichier est correct.
11. **Vitesse et mémoire :** ouvrez Barquette, regardez si le calcul tient la comparaison avec Windows et combien l'application prend dans Moniteur d'activité.

Pour chaque essai qui échoue, notez son numéro et ce que vous voyez. Une photo de l'écran suffit.

## Points à surveiller

- **Noyau multicœur :** rien ne garantit qu'il démarre sur Mac. S'il ne démarre pas, le logiciel prend le noyau normal : tout marche, parfois moins vite.
- **macOS :** réglé pour macOS 12 ou plus récent. Le noyau a besoin d'un Safari à jour (16.4 ou plus).
- **Pour diffuser à d'autres :** il faudra un compte développeur Apple (environ 99 $ par an) pour supprimer le blocage au premier lancement.

## Pour une session Claude sur le Mac

Tout ce qui est propre au Mac est dans `tauri/src-tauri/src/main.rs` (blocs `target_os = "macos"`), `tauri/src-tauri/tauri.mac.json` et le séparateur de chemins en tête de `tauri/pont.js`. Les essais automatiques de `tauri/mesures/` pilotent WebView2 et ne marchent pas sur Mac : faites les essais ci-dessus à la main avec Fred.
