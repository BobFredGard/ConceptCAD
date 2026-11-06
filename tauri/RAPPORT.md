# ConceptCAD en application Windows : rapport

## Noyau multicœur dans l'application (6 novembre, V0.67.1)

L'application suit V0.67.1 et utilise le noyau multicœur à 4 fils. Programme : 23,4 Mo. Installateur : 21,6 Mo.

**Ce noyau double presque la mémoire.** Vous avez choisi de le garder en connaissant ces chiffres. Une seule série de mesures sur V0.67.0, sans pilote branché, en Mo (non refaite en V0.67.1) :

| Pièce | Moment | Application multicœur | Chrome multicœur | Chrome normal |
|---|---|---:|---:|---:|
| Cache Piles | ouverte | 906 | 943 | 408 |
| Cache Piles | après 120 modifications | 987 | 1 042 | 518 |
| Barquette | ouverte | 1 094 | 1 108 | 501 |
| Barquette | après 120 modifications | 1 032 | 1 154 | 615 |

Temps médian d'une modification :

| Pièce | Application multicœur | Chrome multicœur | Chrome normal |
|---|---:|---:|---:|
| Cache Piles | 0,59 s | 1,01 s | 0,53 s |
| Barquette | 3,35 s | 2,73 s | 3,89 s |

Le chiffre de 165 Mo annoncé pour ce noyau ne compte que sa mémoire propre : au total, c'est 500 à 600 Mo de plus à l'ouverture. Le gain ne porte que sur Barquette. L'application en noyau normal n'a pas été mesurée en V0.67.0.

**« Tout régénérer » sur Cavité Test (3 essais) :** application 6,5 s, Chrome multicœur 7,0 à 9,2 s, Chrome normal 7,0 à 9,0 s. Ce calcul FAO n'utilise pas le noyau multicœur.

**Essais :** 24 vérifications générales, 24 gestes, vrai double-clic et installateur : tout passe. Ils n'ont pas touché aux vraies données de l'application : c'est contrôlé avant et après.

---

## Où on en est (6 novembre, V0.66.0)

Vous avez décidé de continuer. L'application n'est plus une maquette : elle s'appelle ConceptCAD et suit la version du logiciel. **Toujours rien sur `main`, rien envoyé sur Internet, version web inchangée.**

**Ajouté et vérifié :**

- **Une seule fenêtre :** un double-clic sur un `.conceptcad` alors que l'application est ouverte l'ouvre dans la même fenêtre, ramenée devant. Si la pièce en cours est modifiée, la question habituelle protège votre travail.
- **Fermeture :** la croix demande Enregistrer / Ne pas enregistrer / Annuler si la pièce est modifiée, sinon elle ferme sans rien demander.
- **Au redémarrage :** la dernière pièce revient depuis son fichier, donc Ctrl+S réécrit le bon fichier. Une modification refusée ne revient pas.
- **Logiciel occupé par un long calcul :** au bout de 5 secondes, Windows propose de fermer quand même. On n'est jamais bloqué.
- **Comportements de navigateur retirés :** F5, Ctrl+P, Ctrl+F et le menu du clic droit, sauf dans les champs de texte pour copier et coller.
- **Désinstallation propre :** plus aucune trace de `.conceptcad` dans le registre.

**Essais :** 22 vérifications d'avant, 24 nouvelles, le vrai double-clic et l'installateur : tout passe.

- **Vrai calcul FAO :** Poche et Contour donne des parcours identiques à Chrome.
- **Plusieurs cœurs (V0.66.0) :** Cavité Test donne aussi des parcours identiques à Chrome, en 5,5 s contre 5,7 s.

**Une limite à connaître :** après un arrêt brutal (coupure de courant, programme tué), les dernières modifications peuvent manquer, car le brouillon n'arrive sur le disque qu'avec jusqu'à une minute de retard. Après 70 secondes d'attente, l'essai le retrouve bien ; après 12 secondes, il revient à la version précédente, avec le bandeau de secours. Le stockage est le même que dans Chrome.

**Les chiffres de RAM ci-dessous datent de V0.64.3.** Ils n'ont pas été remesurés.

**Reste à faire :** essai à la main par vous, essai sur l'autre PC (hors ligne, autre carte graphique), Windows 10, mises à jour automatiques, signature, compilation à chaque `cpt`.

---

# Rapport de la maquette (5 et 6 novembre, V0.64.3)

Essai du 5 au 6 novembre 2026, sur ConceptCAD V0.64.3. Rien n'est livré : tout est sur la branche `claude/vigorous-swanson-45df96`, dans le seul dossier `tauri/`.

## La réponse

**Continuer avec l'application, mais pour les fichiers et le travail sans Internet. Pas pour la RAM : elle ne gagne que 6 à 13 %.**

- **RAM :** 30 à 75 Mo de moins que Chrome, sur 400 à 600 Mo. C'est réel, mais cela ne réglera pas un PC à 95 %.
- **Fichiers :** tout marche. Vraies fenêtres Windows, Ctrl+S sans question, double-clic sur un `.conceptcad`.
- **Vitesse :** identique à Chrome. Le démarrage est même 0,3 s plus lent.
- **Multicœur :** l'application l'autorise, le fichier autonome non. Le noyau actuel reste sur un seul cœur tant qu'il n'est pas recompilé.
- **Priorité découverte en route :** Barquette perd son solide vers la 107ᵉ modification. C'est plus grave que le choix de l'application (voir plus bas).

## Les mesures

PC : 24 cœurs logiques, 64 Go, carte NVIDIA RTX 5070 Ti. Même code, même noyau OCCT 8, profil neuf sans extension de chaque côté. Chaque mesure est faite deux fois, d'où les fourchettes.

**Edge n'a pas été mesuré :** il n'est pas installé sur ce PC, seul son moteur WebView2 y est. C'est justement ce moteur qu'utilise l'application.

### Mémoire propre, tous processus réunis

C'est ce que compte le Gestionnaire des tâches dans sa colonne Mémoire.

| Pièce | Moment | Application | Chrome | Gain |
|---|---|---:|---:|---:|
| Sans pièce | Logiciel vide | 315 à 320 Mo | 365 à 372 Mo | environ 50 Mo |
| Cache Piles | Après ouverture | 379 à 383 Mo | 405 à 412 Mo | environ 28 Mo (7 %) |
| Cache Piles | Après 120 modifications | 464 à 465 Mo | 523 à 543 Mo | environ 70 Mo (13 %) |
| Barquette | Après ouverture | 467 à 474 Mo | 498 à 503 Mo | environ 30 Mo (6 %) |
| Barquette | Après 120 modifications ¹ | 595 à 606 Mo | 671 Mo, une fois 931 Mo ² | environ 70 Mo (10 %) |

¹ Sur Barquette, le solide disparaît vers la 107ᵉ modification, des deux côtés. Les 13 dernières modifications se font donc sans solide.
² Le 931 Mo est un relevé isolé, sans doute de la mémoire que Chrome n'avait pas encore libérée. Je ne l'ai pas compté dans le gain. L'application aussi peut garder ainsi de la mémoire un moment : mesures à refaire si ce point devient décisif.

Autre façon de compter, la mémoire engagée, sur Cache Piles ouvert : 789 Mo pour l'application, 874 Mo pour Chrome. Sur Barquette ouverte : 808 Mo contre 899 Mo.

### Temps et taille

| | Application | Chrome |
|---|---:|---:|
| Démarrage, jusqu'au noyau prêt (médiane de 5) | 3,2 s | 2,9 s |
| Ouverture et rejeu de Barquette | 8,9 à 9,2 s | 8,8 à 9,0 s |
| Ouverture et rejeu de Cache Piles | 0,7 à 0,8 s | 0,8 s |
| Une modification sur Cache Piles (médiane) | 530 à 560 ms | 530 à 570 ms |
| Une modification sur Barquette (médiane) | 850 à 1 160 ms | 840 à 880 ms |
| Taille du programme | 14,1 Mo, noyau compris | 471 Mo, plus les 48 Mo du logiciel |
| Taille de l'installateur | 12,2 Mo | sans objet |
| Moteur nécessaire sur le PC | WebView2 : 687 Mo, déjà présent ici | inclus dans les 471 Mo |

D'autres sessions tournaient par moments sur le PC : les temps sont moins sûrs que la mémoire. Un écart de quelques dizaines de millisecondes ne veut rien dire ; l'écart de démarrage de 0,3 s, lui, se répète à chaque essai.

### Ce que ces chiffres ne disent pas

- **Votre vrai Chrome n'est pas mesuré.** Ici, Chrome est vide, sans onglets ni extensions. Le vôtre pèse sûrement plus, mais je n'ai aucun chiffre.
- **L'autre PC, celui à 95 %, n'est pas mesuré.** Le gain y sera peut-être différent.
- **Pourquoi le gain est si faible :** la mémoire va surtout à la page qui calcule (210 Mo à vide, jusqu'à 500 Mo ensuite). Dans l'application, c'est le même moteur qui fait ce travail.
- **Pour gagner beaucoup plus,** il faudrait un logiciel sans navigateur. L'essai natif d'une autre session mesure 8 à 11 fois moins sur une vraie pièce simple, mais il ne représente qu'environ 2 % du logiciel et sa mémoire montera avec le reste.

## Ce qui marche : 23 vérifications sur 23

- Le noyau OCCT 8 se compile dans WebView2, en 128 Mo comme dans Chrome.
- Le calcul de fond de `src/21-suppression-face-calcul.js` tourne bien dans son worker.
- Aucune demande vers Internet au démarrage : 17 demandes, toutes internes au programme.
- **Ouvrir, Enregistrer sous, Dossier de projets, Export :** vraies fenêtres Windows, y compris avec accents et espaces dans le nom.
- **Enregistrer :** réécrit le même fichier sans question, compressé puis relu. Si l'écriture échoue, l'ancien fichier reste intact.
- **Fichiers récents, dossier de projets, IndexedDB, réglages :** retrouvés après redémarrage. Plus de permission à redonner à chaque session.
- Une modification non enregistrée revient au redémarrage après une fermeture normale.
- Le vrai double-clic sur un `.conceptcad` fonctionne, avec l'association posée à la main puis avec l'installateur.
- La 3D utilise bien la carte NVIDIA.

**Aucune ligne du logiciel n'a été modifiée.** Un seul petit fichier, `tauri/pont.js`, branche ses fonctions de fichiers sur Windows. La version web reste identique.

## Ce qui casse ou reste à faire

| Sujet | État | Ce qu'il faudrait |
|---|---|---|
| **Mises à jour** | Aucune. Il faut relancer un nouvel installateur | Mise à jour automatique Tauri sur les PC connectés, avec une clé de signature et une adresse de téléchargement. Sur le PC sans Internet : installateur sur clé USB |
| **Chaque version** | Pas branché | Ajouter une compilation à `cpt` : 1 à 3 minutes |
| **Windows 10 sans WebView2** | **Pas testé**, aucun PC de ce type ici | Selon Microsoft, WebView2 est présent sur Windows 11 et a été poussé vers les Windows 10 éligibles, sans garantie. L'installateur actuel le télécharge s'il manque |
| **PC sans Internet** | Fonctionnement sans demande extérieure vérifié ici, **mais pas sur un PC vraiment débranché** | Essai réel à faire sur votre PC hors ligne. S'il n'a pas WebView2 : installateur « hors ligne », environ 127 Mo de plus selon Tauri, ou moteur embarqué, environ 180 Mo de plus |
| **Signature du programme** | Non signé | Windows peut avertir sur un programme téléchargé (non testé ici). Il faut un certificat payant pour une diffusion large ; pour vos propres PC, ce n'est pas bloquant |
| **IndexedDB et parcours FAO** | Stockage testé (30 Mo, place disponible 10 Go) ; **vrai calcul FAO réussi**, sur un et plusieurs cœurs, identique à Chrome | L'application a son propre stockage, séparé de Chrome : récents, brouillons et cache des parcours ne suivent pas. Les parcours enregistrés dans un `.conceptcad` restent, eux, dans le fichier |
| **Carte graphique** | NVIDIA seule testée | Essai sur l'autre PC, surtout s'il a une carte faible ou deux cartes |
| **Double-clic quand l'application est déjà ouverte** | **Réglé** : même fenêtre | Rien |
| **Fermeture avec modifications non enregistrées** | **Réglé** : la question est posée | Rien |
| **Désinstallation** | **Réglé** : registre propre | Rien |
| **Essai à la main** | Toutes les vérifications sont automatiques. Raccourcis et messages de saisie vérifiés par pilotage, pas au vrai clavier. Le glisser-déposer d'un fichier n'existe pas non plus dans la version web | Une demi-heure d'usage réel par vous |
| **Version emballée** | V0.67.1, la version suit `package.json` | Refaire à chaque version : `node tauri/preparer.cjs`, puis compiler |

## Le multicœur

Ce test vérifie la **condition**, pas le noyau, qui reste sur un cœur pour l'instant.

| Où | Multicœur permis ? | Calcul d'essai sur 12 fils |
|---|---|---:|
| Application (avec `tauri.multicoeur.json`) | **Oui** | 10,2 fois plus rapide |
| Chrome sur `localhost` aujourd'hui | Non | sans objet |
| Chrome sur `localhost` avec les mêmes réglages | Oui | 10,4 fois plus rapide |
| Fichier ouvert par double-clic (comme `ConceptCAD-autonome.html`) | **Non** | sans objet |

Dans cette variante, le logiciel fonctionne toujours : noyau, calcul de fond et rendu vérifiés sur Cache Piles.

**Attention :** ce gain de 10 fois vient d'un calcul d'essai fait pour se répartir. Sur le vrai noyau, l'essai natif ne mesure que **10 à 15 %** sur les solides. Il faudra aussi recompiler le noyau, et le multicœur consomme plus de mémoire.

## Deux défauts trouvés dans le logiciel (pas liés à l'application)

**1. Barquette perd son solide après environ 107 modifications.** Le solide disparaît et ne revient plus, même en relançant le calcul, tant que la pièce n'est pas rechargée.
- Le nombre de modifications compte, pas la valeur de la cote : la perte arrive à la 107ᵉ-109ᵉ modification, avec des valeurs très différentes (164,45 ou 165,03).
- Même chose dans Chrome et dans l'application.
- V0.64.2 fait pareil, donc la correction de fuite n'en est pas la cause. V0.64.2 enregistre même une erreur « accès mémoire hors limites » dans le noyau.
- La cause n'est pas trouvée.

**2. Sur Barquette, la mémoire du noyau monte encore malgré V0.64.3 :** 128 Mo à l'ouverture, puis 184 à 319 Mo avant la perte du solide, selon l'écart entre les valeurs. Cache Piles reste bien stable à 128 Mo. Je ne sais pas s'il s'agit d'une fuite ou d'un cache qui finirait par plafonner : la perte du solide arrive avant.

C'est peut-être un seul et même problème. Il touche directement votre plainte de départ, plus que le choix de l'application.

## Un incident à connaître

**Mon test a modifié un de vos vrais fichiers, puis je l'ai remis.** Le 5 novembre vers 21 h 57, mon script n'a pas réussi à remplir une fenêtre « Ouvrir », restée visible à l'écran. `S:\Dropbox\ConceptCAD Samples\Axe.conceptcad` y a été choisi, sans doute à la main, et mon script a continué sans vérifier : il a changé une cote de 14 à 14,25 et enregistré.

- **Réparation :** remis à 21 h 58 depuis la copie de secours. Contenu relu identique à la version d'avant, cote à 14. Sa date de modification a changé, et Dropbox a sans doute gardé ces deux écritures dans son historique.
- **Prévention :** les essais s'arrêtent maintenant avant d'écrire si le fichier n'est pas dans leur dossier, et une fenêtre non remplie se referme.
- **Autres fichiers :** `Barquette.conceptcad`, dans le même dossier, a changé à 22 h 24 et 22 h 33. Rien dans mes essais ne pointe vers lui : c'était sans doute vous.

## Ce qui a été laissé sur le PC

- L'association `.conceptcad` a été retirée : vos fichiers s'ouvrent comme avant. Il reste une ligne sans effet dans l'historique « Ouvrir avec » de Windows.
- L'application a été désinstallée après chaque essai et ses données d'essai effacées. Le dossier `%LOCALAPPDATA%r.conceptcad.maquette` de l'ancien nom reste, sans effet, et peut être supprimé. Le dossier `fr.conceptcad.logiciel` reste vide.
- L'outil NSIS (8 Mo) reste dans `%LOCALAPPDATA%\tauri`, téléchargé avec votre accord.
- Pour l'essayer : `tauri/src-tauri/target/release/ConceptCAD.exe`, ou l'installateur `tauri/src-tauri/target/release/bundle/nsis/ConceptCAD_0.67.1_x64-setup.exe`. **Installer pose l'association :** le double-clic ouvre alors vos pièces dans l'application. La désinstallation remet tout comme avant.

## Pour refaire

```bash
node tauri/preparer.cjs
cargo tauri build --no-bundle
node tauri/mesures/verifier.cjs "<dossier d'essai vide>"
node tauri/mesures/application.cjs "<dossier d'essai vide>"
node tauri/mesures/mesurer.cjs repos ConceptCAD.html app,chrome 2
```

**Icône :** `node tauri/icone.cjs` la refait à partir du logo de la barre du logiciel, relu dans `ConceptCAD.html`. Elle reste donc identique à ce logo : si le logo change, relancer cette commande, puis compiler.

**Mac :** préparé mais pas encore essayé sur un vrai Mac, voir `tauri/mac/A-ESSAYER.md`.

`cargo tauri build` se lance depuis `tauri/src-tauri`. Résultats bruts : `tauri/mesures/resultats/`. Les séries de référence sont `repos-V0.64.3.jsonl` et `repos-V0.67.0-*.jsonl` : **la mémoire y est lue sans pilote branché**, car le pilote alourdit Chrome d'environ 150 Mo à vide. Les autres séries (`ram-serie1.jsonl`, `ram.jsonl`) ne servent que pour les temps.

Sources : [Tauri, installateur Windows](https://v2.tauri.app/distribute/windows-installer/), [Microsoft, distribuer WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution).
