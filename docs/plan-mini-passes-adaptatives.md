# Plan : mini-passes adaptatives de l'Ébauche 3D

*Rédigé le 2026-11-02 (V0.37.1). Statut : tranche 1 faite (non livrée), tranches 2 à 4 à faire.*

**Bilan tranche 1 (2026-11-02)** : `test_fao_minipasses_pentes` vert, `ci:full` 233/233, `npm run parcours`
inchangé (seul écart, Perçage n° 11 de Perçages, déjà présent en V0.37.1). Exemple Perçages, fraise D6,
3 mini-passes : mini-passes 553 → 72 mm et 662 → 78 mm. Cavité Test (fraise D10 forcée) : parois à ~25°
sur tout le tour, donc aucune différence (marche réelle partout, comportement attendu).
Les trois ébauches réelles (Cavité Test, Cavité Usinage, Malaxeur Retard) sont en **fraise torique** :
la tranche 2 est celle qui les concerne.

**Bilan tranche 2 (2026-11-02)** : filtre au contact du tore (`faoBullRingRuns`, paramètre `rb` : outil
écarté de 0,05 mm côté libre, peut-il descendre au niveau du dessous ?), points confondus de l'iso-ligne
retirés avant le calcul des normales. `ci:full` 233/233, `npm run parcours` inchangé. Pièces réelles
(mêmes mini-passes, mode partout → pentes) : Malaxeur Retard coupe des mini-passes 10 836 → 7 908 mm
(−27 %), rapides 47,3 → 39,6 m, remontées 596 → 587 ; Cavité Test et Cavité Usinage identiques
(parois en dépouille sur tout le tour).

## Objectif

Aujourd'hui, l'Ébauche 3D fait, après chaque niveau, un nombre fixe de mini-passes
(`op.minipasses`, 0 à 50) qui contournent **toutes** les parois de la tranche
(`faoRoughAdaptiveLevel(..., {ringOnly:true})`, `src/88-fao-90-ebauche3d.js` l. 2130-2154 ;
outil torique : `faoBullRingLevel`, `src/89-fao-torique.js`). Sur une paroi verticale,
elles coupent dans le vide ; sur un chanfrein ou une dépouille, leur nombre ne dépend pas
de la marche réellement laissée.

Demande (2026-11-02) : « quand il n'y a pas de pentes tout le long, mais juste à des endroits
particuliers, comme des chanfreins, ça vaut le coup de reprendre en mini-passes que cette
partie-là ». Équivalent visé : le « Fine stepdown » de l'ébauche adaptative de Fusion 360.

## Principe retenu

Un point d'une mini-passe à la cote `zm` ne coupe de la matière **que si l'outil passé au
niveau du dessous `L.z` ne l'a pas déjà enlevée**. Test local, sans simulation :

> le disque de rayon `r − seuil` (r = D/2 + laisse Parois) centré sur le point de la mini-passe,
> posé sur la coupe du modèle à `L.z`, est-il **libre** ?
> — libre → paroi verticale à cet endroit : rien à enlever, morceau **sauté** ;
> — pas libre → la paroi rentre plus bas (pente, chanfrein) : marche réelle, morceau **gardé**.

Il réutilise `faoDiscClear` et les coupes en cache `faoSliceZCached`, déjà employés par
`faoRoughAdaptiveLevel`. Seuil par défaut 0,05 mm (bruit des facettes du maillage).

Le brouillon `stash/rattrapage-faoRestPlan` (2026-10-08) repérait la même matière, mais
ajoutait des **niveaux complets** à toute la pièce. Ici, seuls les **morceaux de paroi en
pente** sont repris. Le brouillon reste une référence pour la mesure de la marche (bisection
par écart entre plans).

## Décisions

| Décision | Raison |
|---|---|
| Option **éteinte par défaut** (`op.minipassesMode`, absent = `'partout'`) | Parcours de V0.11.28 validés par l'utilisateur : aucun document existant ne bouge. |
| **Pas de bump de `CACHE_VER`** | Le défaut ne change pas ; seule la clé de parcours de l'op doit voir le nouveau champ. |
| Liaisons au contact bornées au pas (≤ 1,5 × ae), sinon remontée + rapide | Règle utilisateur des liaisons ; des morceaux courts multiplient les remontées. |
| Morceaux plus courts que `minRun` (≈ D/2) abandonnés | Éviter les « traits qui descendent pour rien » (retour du 2026-10-21). |
| Nombre de mini-passes : d'abord le réglage actuel, ensuite une « marche maxi » en mm | Livrer d'abord le tri, qui se vérifie seul ; la marche maxi en découle. |

## Tranches (dépendances)

```
Tranche 1 : tri des mini-passes, fraise droite, avec l'option dans la fiche — aucune dépendance
Tranche 2 : même tri pour l'outil torique / boule          — dépend de 1
Tranche 3 : « marche maxi » (nombre de mini-passes au besoin) — dépend de 1
Tranche 4 : validation sur les exemples réels               — dépend de 1, 2, 3
```

Les tranches 2 et 3 sont indépendantes l'une de l'autre.

## Tâches

### Tranche 1 : « Seulement sur les pentes », fraise droite
**Critère d'acceptation :** sur une plaque avec une poche à parois verticales et un chanfrein
de 45°, le mode `'pentes'` ne garde des mini-passes que le long du chanfrein, et le mode
`'partout'` produit un parcours identique octet pour octet à V0.37.1.

- [ ] 1.1 Filtre dans le contour d'anneau
  Fichier : `src/88-fao-92-contour.js` (`faoRoughAdaptiveLevel`, branche `isRing`).
  Changement : nouvelle option `opt.restBelow = {z: L.z, r, seuil, minRun}` ; chaque anneau est
  découpé en morceaux où le disque n'est pas libre sur la coupe à `L.z` ; morceaux < `minRun`
  jetés ; entrée/sortie de chaque morceau par les mécanismes existants (hélice, rampe, remontée).
- [ ] 1.2 Branchement dans l'ébauche
  Fichier : `src/88-fao-90-ebauche3d.js` (boucle des mini-passes l. 2140-2153).
  Changement : `o.minipassesMode==='pentes'` → passe `restBelow` avec `L.z` du niveau.
- [ ] 1.3 Champ de l'opération, nettoyage, clé de cache
  Fichiers : `src/88-fao-10-etat.js` (sanitise : `'partout'|'pentes'`), `src/88-fao-50-caches-dispatch.js`
  (transmission à `faoGenRough3DIt` et clé de parcours de l'op), `src/88-fao-80-interface.js`
  (liste « Mini-passes : Partout / Seulement sur les pentes » à côté du nombre, l. 1336).
- [ ] 1.4 Test
  Fichier : `tests/test_fao_minipasses_pentes.cjs` (nouveau, ajouté à `tests/run.cjs` et `run-fast.cjs`).
  Contrôles : morceaux gardés seulement au droit du chanfrein ; aucun point sur les parois
  verticales ; mode partout identique ; longueur de mini-passes réduite ; aucun gouge
  (`faoDiscClear` à r − 1e-3 sur toute la passe).

### Tranche 2 : outil torique / boule
**Critère d'acceptation :** même plaque, outil torique D25 R2 : mêmes zones gardées, aucun
morceau sur parois verticales, mode partout inchangé.

- [ ] 2.1 Filtre au contact réel
  Fichier : `src/89-fao-torique.js` (`faoBullRingRuns` / `faoBullRingLevel`).
  Changement : morceaux gardés seulement où le contact torique à `L.z` laisse une marche > seuil ;
  `minRun` et `dzStay` existants réutilisés.
- [ ] 2.2 Branchement + test
  Fichiers : `src/88-fao-90-ebauche3d.js` (appel l. 2149), `tests/test_fao_minipasses_pentes.cjs` (cas torique).

### Tranche 3 : marche maxi
**Critère d'acceptation :** avec « marche maxi » = 0,5 mm, la hauteur de marche restante mesurée
sur le chanfrein est ≤ 0,5 mm ; une bande sans pente n'a aucune mini-passe.

- [ ] 3.1 Nombre de cotes par bande calculé
  Fichier : `src/88-fao-90-ebauche3d.js` (calcul de `nbL`, l. 2138-2139).
  Changement : en mode `'pentes'` avec `op.marcheMaxi > 0`, `nbL = ⌈h / marcheMaxi⌉ − 1`,
  plafonné à 50 ; le filtre de la tranche 1 évite tout passage inutile.
- [ ] 3.2 Champ, interface, test
  Fichiers : `src/88-fao-10-etat.js`, `src/88-fao-80-interface.js` (champ « Marche maxi » visible
  en mode pentes), `tests/test_fao_minipasses_pentes.cjs` (mesure de la marche par la carte des hauteurs).

### Tranche 4 : validation sur pièces réelles
**Critère d'acceptation :** sur `Exemples/Cavité Usinage.conceptcad` et `Exemples/Malaxeur Retard.conceptcad`,
le mode pentes réduit le temps des mini-passes, la simulation ne montre pas plus de matière
restante qu'en mode partout, et `npm run parcours` reste identique.

- [ ] 4.1 Mesure hors application (`tests/parcours/calcul.cjs`) : temps, longueur, nombre de remontées, partout vs pentes.
- [ ] 4.2 Vérification dans le navigateur : fiche, aperçu, simulation ; captures pour l'utilisateur.
- [ ] 4.3 CHANGELOG, README (section FAO), version.

## Garde-fous (contrôle anti-raccourcis)

- Pas de « cas limites plus tard » : zone d'opération (`zoneAt`), faces rouges, brut-corps et
  mode Escargot sont testés dès la tranche 1, là où vit le filtre.
- Le test de la tranche 1 compare le mode partout **octet pour octet** avant d'aller plus loin.
- La tranche 1 touche 4 fichiers source : découpée en 1.1 à 1.4, chacune vérifiable.

## Risques

| Risque | Impact | Probabilité | Parade |
|---|---|---|---|
| Morceaux hachés sur une pente douce facettée (le disque est libre un point sur deux) | Beaucoup de remontées, temps pire qu'avant | moyenne | Seuil 0,05 mm, fusion des morceaux séparés de moins de `linkMax`, `minRun` |
| Le niveau du dessous n'est pas un simple contour (pelage adaptatif, trochoïdes) | Matière crue enlevée alors qu'il en reste | faible | Le test se fait sur le **modèle** à `L.z` + laisse, pas sur le parcours : c'est la position minimale possible de l'outil |
| Mode partout modifié par mégarde | Parcours validés qui bougent, tout à régénérer | faible | Test octet pour octet + `npm run parcours` inchangé ; pas de bump `CACHE_VER` |
| Clé de parcours qui n'inclut pas le nouveau champ | Bascule partout ↔ pentes sans régénération | moyenne | Tâche 1.3 + contrôle dans le test |
| Entrées dans un morceau court au milieu de la matière | Plongée en pleine matière | moyenne | Entrées existantes (hélice / rampe / depuis le plan du dessus) obligatoires ; morceau sans entrée sûre jeté |

## Portes

- **Porte 0** : lecture faite (ce document).
- **Porte 1** : tranche 1 validée par l'utilisateur sur une pièce à chanfrein dans le navigateur.
- **Porte 2** : tranches 2 et 3 passent leurs critères.
- **Porte finale** : tranche 4, `npm run ci:full` 100 %, `npm run parcours` inchangé, puis « cpt ».

## Complexité

Moyenne à élevée : 4 tranches, une dizaine de tâches, 6 fichiers source + 1 test.
