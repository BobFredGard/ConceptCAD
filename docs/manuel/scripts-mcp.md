[ConceptCAD](../../README.md) › [Manuel](README.md) › Scripts et pilotage par Claude (MCP)

# Scripts et pilotage par Claude (MCP)

- **Script JSON** (menu Projet → 📜) : `new`, `param`, `sketch`, `extrude`, `revolve`, `config`, `info`, `undo`. Le script est **atomique** et compte pour **une** étape d'annulation.

```json
[{"op":"param","name":"L","expr":"60"},
 {"op":"sketch","id":"s1","plane":"XY","shapes":[{"rect":[0,0,60,40]},{"circle":[30,20,6]}]},
 {"op":"extrude","sketch":"s1","distance":10},
 {"op":"info"}]
```

- **Serveur MCP** `tools/mcp-minifusion.cjs` (Node, sans dépendance) : Claude, ou tout client MCP, envoie des scripts à la page et lit l'état du modèle (`minifusion_run_script`, `minifusion_info`, `minifusion_commands`). Installation : `claude mcp add minifusion -- node <chemin>/tools/mcp-minifusion.cjs`, puis menu Projet → **🔌 Pilotage (MCP)…** dans ConceptCAD (WebSocket local 127.0.0.1:47811).

---

[← Souris, clavier et doigts](raccourcis.md) · [Sommaire du manuel](README.md) · [Développement →](developpement.md)
