[ConceptCAD](../../README.md) › [Manuel](README.md) › Scripts et pilotage par Claude (MCP)

# Scripts et pilotage par Claude (MCP)

Une IA comme Claude peut dessiner dans ConceptCAD : vous lui décrivez la pièce, elle la construit avec les mêmes fonctions que vous, modifiables ensuite à la souris.

## Brancher Claude sur ConceptCAD

1. Une fois pour toutes, dans un terminal, avec le chemin du dossier ConceptCAD :

   ```bash
   claude mcp add conceptcad -- node D:/ConceptCAD/tools/mcp-conceptcad.cjs
   ```

2. Ouvrir ConceptCAD : site, application installée, application Windows ou Mac, ou serveur local.
3. Cliquer l'icône **prise** de la barre du haut, à droite du dossier : elle passe au vert, ConceptCAD est relié. Un nouveau clic coupe le lien. (Interface classique : menu Projet → **🔌 Pilotage (MCP)…**.)
4. Demander à Claude, par exemple : « fais une bride 80 × 50 × 12, congés R6 aux coins, quatre trous lamés pour vis M6 et un taraudage M10 au centre ».

Seules les pages de ce PC, le site officiel et les applications ConceptCAD peuvent se relier. Le serveur n'écoute que sur l'ordinateur (127.0.0.1:47811).

## Ce que l'IA sait faire

- **Esquisses** : rectangles, cercles, polygones, lignes, centres de perçage. **Volumes** : extrusions, révolutions, enlèvements de matière.
- **Finitions** : congés, chanfreins, coque, perçages (lisses, débouchants, taraudés, lamés, fraisés).
- **Ensembles** : répétitions linéaires et circulaires, symétries de fonctions ou d'un corps entier.
- **Modifier l'existant** : la distance d'une extrusion, le rayon d'un congé, la profondeur d'un perçage, le nombre d'une répétition, une cote d'esquisse, un paramètre ƒx, une configuration.
- **Voir la pièce** : liste numérotée des arêtes et des faces, volume, centre de gravité, boîte englobante. L'IA choisit ainsi « les arêtes verticales » ou « le contour du dessus » sans cliquer.

Chaque demande est **tout ou rien** : si une étape échoue (rayon trop grand, arête introuvable…), la pièce revient telle qu'avant et l'IA reçoit l'explication. Un seul **Ctrl+Z** annule toute la demande.

## Script JSON à la main

Menu Projet → 📜 **Script JSON…**. Le même langage que celui de l'IA, pour rejouer une suite de commandes :

```json
[{"op":"new","name":"Bride"},
 {"op":"sketch","id":"s","plane":"XY","shapes":[{"rect":[0,0,80,50]}]},
 {"op":"extrude","sketch":"s","distance":12},
 {"op":"fillet","edges":{"dir":"Z"},"radius":6},
 {"op":"chamfer","edges":{"face":"top"},"distance":1},
 {"op":"sketch","id":"h","plane":"XY","offset":12,"shapes":[{"hole":[10,10]},{"hole":[70,10]},{"hole":[10,40]},{"hole":[70,40]}]},
 {"op":"hole","sketch":"h","d":6.6,"through":true,"cbore":{"d":11,"depth":6.4}},
 {"op":"info"}]
```

- **Commandes** : `new`, `param`, `sketch`, `extrude`, `revolve`, `edges`, `faces`, `fillet`, `chamfer`, `shell`, `hole`, `pattern`, `mirror`, `set`, `config`, `info`, `undo`. La syntaxe complète est rendue par l'outil MCP `conceptcad_commands`.
- **Choisir des arêtes ou des faces** : des numéros, `"all"`, `"top"`, `"bottom"`, `"left"`, `"right"`, `"front"`, `"back"`, ou des filtres comme `{"dir":"Z"}`, `{"face":"top"}`, `{"normal":"+X","at":"max"}`, `{"kind":"cylinder","radius":3}`, `{"near":[x,y,z]}`.
- **Outils MCP** : `conceptcad_run_script`, `conceptcad_info`, `conceptcad_geometry`, `conceptcad_commands`. Les anciens noms `minifusion_*` et le chemin `tools/mcp-minifusion.cjs` marchent toujours.

---

[← Souris, clavier et doigts](raccourcis.md) · [Sommaire du manuel](README.md) · [Développement →](developpement.md)
