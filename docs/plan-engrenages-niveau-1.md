# Plan : module Engrenages, niveau 1

Statut : plan à valider, rien n'est implémenté.
Ampleur : grande (8 tranches, complexité globale **élevée**), plusieurs sous-systèmes touchés (calcul, noyau, arbre, fenêtre, assemblage).

## Objectif

Créer en quelques réglages un engrenage ou une paire d'engrenages justes, utilisables pour l'assemblage, l'export STEP, l'impression 3D et l'usinage. Dents à vraie développante, pas d'arc approché.

Dans le niveau 1 :
- denture droite et hélicoïdale, extérieure et intérieure, crémaillère ;
- module, nombre de dents, angle de pression, déport, largeur ;
- alésage et rainure de clavette ;
- paire posée au bon entraxe, dents en prise ;
- contrôle géométrique de l'engrènement.

Hors niveau 1 : conique, vis sans fin, chevrons, cannelures, résistance ISO 6336, usinage de denture, liaison cinématique animée, entraxe imposé (calcul inverse du déport), représentation conventionnelle en mise en plan.

## Ce qu'a montré l'étude du code

- **Point d'entrée** : `src/48-composants-normalises.js`. `STD_CATS` décrit un onglet (champs + générateur), `stdDoc` fabrique le composant, `stdAddOcc` réutilise une pièce de même clé, `stdReplace` sert à « Modifier… ». Un nouvel onglet s'y loge naturellement.
- **Limite de la fenêtre** : `stdDlg` n'a que des listes déroulantes. Il faut ajouter des champs numériques libres.
- **Clavettes** : `STD_ISO773` donne déjà b, h et t2 (profondeur dans le moyeu).
- **Fonction 3D** : le filetage (`xthread`) montre le câblage d'un nouveau type : `20-70-cache-et-rejeu`, `40-10-arbre`, `40-50-panneau-proprietes`, `41-bandeau-timeline`, `98-film-construction`.
- **Assemblage du source** : `build.js` concatène `src/NN-*.js` en un seul script, donc les fonctions déclarées dans un nouveau fichier sont visibles depuis `STD_CATS`.
- **Aucun existant** : aucune trace d'engrenage dans `src/` ni dans l'historique Git.

## Essai mené sur le noyau (scénario jetable, hors dépôt)

Profil en développante en B-splines, largeur 20 mm, β = 15°, balayage `MakePipeShell` le long de l'axe avec une hélice en fil auxiliaire, sur OCCT 8 (noyau par défaut de l'application) :

| Cas | Construction | Maillage | Solide valide | Faces |
|---|---|---|---|---|
| Droit m2 Z20 | 79 ms | 39 ms | oui | 122 |
| Hélicoïdal m2 Z20 | 115 ms | 46 ms | oui | 122 |
| Droit m2 Z60 | 85 ms | 62 ms | oui | 242 |
| Hélicoïdal m2 Z60 | 154 ms | 100 ms | oui | 242 |

- La section haute coïncide avec la section basse tournée de l'angle attendu (écart de position des sommets : 0,0000 mm).
- Ce fil auxiliaire marche aussi sur l'ancien noyau de secours (solide valide, Z60 en 950 ms).
- **Point resté ouvert** : à Z60, le volume hélicoïdal s'écarte de 0,064 % du droit (0,003 % à Z20), alors qu'il devrait être identique. Cause inconnue : mesure ou forme. À trancher en tranche 4.
- **Limites de l'essai** : profil simplifié (pied en segments, pôles non interpolés), pas de déport, pas de denture intérieure. Il valide la méthode, pas la précision finale.

## Décisions

1. **Une vraie fonction `gear`, pas une esquisse extrudée.** L'hélicoïdal l'exige et une esquisse de 60 dents alourdirait le solveur pour rien. Conséquence : la dent se modifie par « Modifier… », pas à la souris.
2. **Calcul pur séparé du noyau** (`48-engrenages-calcul.js`) : testable seul, et réutilisable par le niveau 3 (résistance).
3. **Pied de dent extérieur par génération** (trochoïde d'un outil crémaillère ISO 53) et non par arc : seul moyen de représenter le déport et la sous-coupe des petits pignons. Denture intérieure : pied en arc simple, signalé dans la fiche, car la vraie forme dépend de l'outil-pignon.
4. **Alertes non bloquantes**, sauf géométrie impossible (dent en pointe de largeur nulle, alésage plus grand que le pied).
5. **Normes** : profil ISO 53, modules ISO 54 proposés mais module libre autorisé, géométrie ISO 21771.
6. **Module toujours normal** en hélicoïdal (mₙ), comme sur les fraises-mères. Cotes apparentes calculées et affichées.
7. **Ajout à valider** : un champ « jeu de fonctionnement » (0 par défaut). Sans lui, deux roues théoriques se touchent sur les deux flancs et le contrôle d'interpénétration ne dit rien d'utile.
8. **`CACHE_VER` inchangé** : les parcours existants ne changent pas. Aucune modification de la FAO.

## Tranches et dépendances

```
T1 Roue droite extérieure — aucune dépendance
T2 Déport et sous-coupe + contrôle d'une roue — T1
T3 Alésage et rainure — T1 (parallèle à T2)
T4 Hélicoïdal — T1
T5 Denture intérieure — T2
T6 Crémaillère — T2 (parallèle à T5)
T7 Paire et contrôle d'engrènement — T2, T4, T5, T6
T8 Finitions et livraison — toutes
```

### T1 : Roue droite extérieure (complexité : élevée)
**Critère** : l'onglet « Engrenages » insère une roue m2 Z20 valide, modifiable par « Modifier… », et relue à l'identique après enregistrement du fichier.
- [x] 1.1 `src/48-engrenages-calcul.js` : cotes de base et profil en développante.
- [x] 1.2 `src/76-engrenage.js` : fonction `gear` droite, reconstruite par le noyau.
- [x] 1.3 Câblage du type dans le rejeu, l'arbre, les propriétés, la timeline et le film (5 fichiers cités plus haut).
- [x] 1.4 Champs numériques dans `stdDlg`, y compris la validation, sans changer les autres onglets.
- [x] 1.5 Onglet dans `STD_CATS`, générateur, clé unique, aperçu `stdSvg`.
- [x] 1.6 `tests/test_engrenages.cjs` : épaisseur au primitif, pas de base, volume, solide valide.

Trouvé en route et corrigé : Ctrl+Z sur « Modifier… » laissait l'ancienne forme à l'écran, pour toutes les pièces normalisées (`asmRestore`).

### T2 : Déport, sous-coupe, contrôle d'une roue (complexité : élevée)
**Critère** : Z12 sans déport montre la sous-coupe avec alerte ; Z12 avec x = 0,3 passe sans alerte ; l'épaisseur mesurée suit `s = m(π/2 + 2x·tan α)`. (Le critère initial visait Z8 x = 0,5, impossible : à Z8, le déport qui supprime la sous-coupe, 0,54, rend la tête presque pointue. Il faudrait raccourcir la dent, hors de cette étape.)
- [x] 2.1 Pied par génération (enveloppe de l'outil ISO 53), raccord à la développante.
- [x] 2.2 Contrôles : sous-coupe, tête en pointe.
- [x] 2.3 Affichage des contrôles dans la fenêtre (vert / orange / rouge).
- [x] 2.4 Cas limites testés contre une simulation indépendante du taillage : Z bas, déports, effleurement, angle 14,5° et 25°.

### T3 : Alésage et rainure (complexité : faible)
**Critère** : une roue Ø20 reçoit une rainure conforme à `STD_ISO773`, et la clavette existante s'y pose avec « Dans une rainure ».
- [x] 3.1 Opérations `stdDoc` (perçage et rainure), proposition de clavette selon le Ø.
- [x] 3.2 Refus si l'alésage ou la rainure entame le pied de dent.
- [x] 3.3 Trouvé en route : la pose ignorait toute pièce normalisée, roues comprises (`stdHolePickAt`). Exception ajoutée pour les roues.

### T4 : Hélicoïdal (complexité : moyenne)
**Critère** : β = 15° main droite donne le bon angle mesuré au primitif, la main gauche donne son miroir, et l'écart de volume de 0,064 % est expliqué ou corrigé.
- [x] 4.1 Balayage à fil auxiliaire dans `gear`, passage en cotes apparentes dans le calcul. L'arrondi de l'outil devient une ellipse dans la section droite ; la simulation du taillage le confirme.
- [x] 4.2 Enquête sur l'écart de volume : il ne se reproduit pas avec le vrai profil (0,0001 % à Z60, 0,002 % au pire). Le flanc étant mesuré juste, aucune déformation n'est en cause et il n'a pas fallu de sections multiples. L'origine exacte dans le profil simplifié de l'essai n'a pas été recherchée.
- [x] 4.3 Rapport de recouvrement ε_β dans la fiche.
- [x] 4.4 Écart de flanc mesuré au classifieur sur le solide, à plusieurs hauteurs et rayons : 0,56 µm au pire (m2 Z20 β30° b40), souvent quelques nanomètres.

### T5 : Denture intérieure (complexité : moyenne)
**Critère** : couronne valide dont le creux de dent correspond à l'épaisseur d'un pignon, et diamètre extérieur réglable.
- [x] 5.1 Profil inversé, pied en arc, couronne extérieure. Le creux est la dent de la roue extérieure de même Z, de déport opposé. Tête ramenée au cercle de base quand elle passerait dessous (alerte).
- [x] 5.2 Aussi en hélicoïdal, avec le test correspondant.
- [x] 5.3 Trouvé en route : la découpe prenait 5 à 53 s et aurait figé l'application. Construction directe, sans découpe : 60 ms à Z60 droite, 0,6 s en hélicoïdal, 2,3 s à Z200 hélicoïdale.

### T6 : Crémaillère (complexité : faible)
**Critère** : la crémaillère module m a un pas de π·m et des flancs droits à l'angle α, en droit et incliné.
- [x] 6.1 Profil, hauteur de corps, nombre de dents (6 au minimum, comme les roues). Coupée à mi-creux aux deux bouts, centrée sur l'origine.
- [x] 6.2 Inclinaison β : extrusion oblique, puis coupe aux extrémités. Main droite : x recule en montant, pour engrener avec un pignon main gauche.

### T7 : Paire et contrôle d'engrènement (complexité : très élevée)
**Critère** : pour chaque combinaison, la paire posée ne s'interpénètre sur aucune position d'un pas complet (volume commun nul, avec jeu > 0), et l'entraxe est juste à déport non nul.
- [x] 7.1 Calcul : angle de fonctionnement, entraxe (`inv α_w`), raccourcissement de tête, ε_α. Ajouté : jeu entre flancs (amincissement égal des deux dentures, 0,1 mm par défaut, entraxe inchangé).
- [x] 7.2 Contrôles : interférence, rapport de conduite trop faible, couronne/pignon trop proches. Mains : déduites automatiquement, donc jamais incompatibles dans la paire. La couronne raccourcit sa tête d'elle-même quand elle attaquerait le pied du pignon (Z60/Z20 : 0,26 mm en m2).
- [x] 7.3 Mode « Paire » : deux composants posés, second calé pour que les dents se logent. Pièces libres, un seul Ctrl+Z pour les deux.
- [x] 7.4 Test d'interpénétration par intersection réelle, sur 12 positions d'un pas, pour droite, hélicoïdale, intérieure, crémaillère (6 cas à petit nombre de dents et déport). Complété par un contrôle en coupe sur 13 paires (2 hauteurs), plus rapide, qui mesure aussi le jeu.

### T8 : Finitions et livraison (complexité : faible)
**Critère** : `npm run ci` passe, et un fichier d'exemple avec une paire se recharge, s'exporte en STEP et se réimporte en solide valide.
- [x] 8.1 Fiche au survol, aide, icône.
- [x] 8.2 Fichier d'exemple dans `Exemples/` (`Engrenages.conceptcad`, 3 paires).
- [x] 8.3 Ajout de `test_engrenages` à la suite rapide, passage sur les deux noyaux. Solides réels et exemple dans `test_engrenages_paire` (suite complète) : plusieurs minutes, trop long pour la suite rapide.
- [x] 8.4 `README.md`, `CHANGELOG.md`, lien de test à Fred avant tout « cpt ».

## Points de contrôle

- **Porte 0 (franchie)** : points d'intégration connus, méthode hélicoïdale validée par essai.
- **Porte 1** : T1 complète de bout en bout. Si ça coince (rejeu, cache, ré-ouverture), on revoit l'architecture avant d'aller plus loin.
- **Porte 2** : T1 à T4 validées. Fred teste une première roue réelle, si possible en l'imprimant.
- **Porte 3** : T7 passe le test d'interpénétration sur tous les cas.
- **Porte finale** : suite complète sans régression, attente du « cpt ».

## Risques

| Risque | Impact | Probabilité | Parade |
|---|---|---|---|
| Le pied en trochoïde crée une petite auto-intersection ou une arête minuscule à faible Z | Solide invalide, noyau en échec | Moyenne | Découpe propre du profil en T2, tests Z bas et déports extrêmes |
| Les booléens (rainure, opérations suivantes, congés) deviennent lents ou échouent sur les surfaces hélicoïdales | Alésage ou modifications impossibles | Moyenne | Tester en T3 et T4 ; alésage percé sur la forme, pas en post-traitement si nécessaire |
| Roues à grand Z lourdes en assemblage ou en mise en plan (HLR) | Lenteur à l'ouverture | Moyenne | Mesure à Z200 et avec plusieurs occurrences ; niveau de maillage adapté, une seule copie par réutilisation de clé |
| Champs libres : `stdStateOf` parcourt toutes les combinaisons des listes pour retrouver d'anciennes pièces | Blocage ou recherche sans fin | Moyenne | Toujours enregistrer `st` pour les engrenages, exclure l'onglet de cette recherche, avec test |
| Écart de volume de 0,064 % révélant une vraie déformation de flanc | Dents hélicoïdales inexactes | Faible à moyenne | Mesure en T4 ; bascule possible vers les sections multiples ou des surfaces construites directement |
| Comportement différent entre OCCT 8 et noyau de secours | Échec avec `?noyau=actuel` | Faible | Tests sur les deux noyaux (T8) ; la fonction `SetMode` a déjà une différence d'appel, gérée par le traducteur à vérifier |
| Reconstruction sans noyau exact (repli maillage) | Fonction sans résultat | Faible | Message clair plutôt qu'une forme fausse |
| Faux sentiment de sécurité sur les contrôles | Pièce jugée bonne mais fragile | Moyenne | Mention explicite : contrôle géométrique seulement, pas de résistance |

## Contrôle anti-raccourcis

- Pas de « fondations d'abord » : T1 livre déjà une roue complète, de la fenêtre au solide.
- Pas de « cas limites plus tard » : chaque tranche teste les siens.
- Tests présents dans chaque tranche, pas à la fin.
- **À surveiller** : T1 et T7 dépassent 3 fichiers. Elles sont découpées en tâches, et T7 reste la tranche à risque. T7 peut se scinder si la porte 2 montre qu'elle est trop large.
