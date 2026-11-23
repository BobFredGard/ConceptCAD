[ConceptCAD](../../README.md) › [Manuel](README.md) › Fonctions 3D

# Fonctions 3D

## Géométrie de construction

Plans (décalé, à un angle, 3 points, médian, normal à un axe, **perpendiculaire à une courbe** à une position donnée de sa longueur), axes, points et **repères**, désignés dans la vue ou dans l'arbre. Ils sont **associatifs** : un plan posé sur une face suit la pièce quand une cote change.
- **Repère sur une face** : cliquer une face plane affiche ses **9 points cardinaux** (centre, milieux des côtés, coins du rectangle qui l'entoure) ; un clic sur l'un d'eux y pose l'origine. Z sort de la face, perpendiculaire ; X se règle (facultatif) en cliquant une arête ou un axe, qu'il suit, ou bien une face plane, un plan ou le plan d'un autre repère, auxquels il est perpendiculaire ; le rectangle des points s'aligne dessus. Deux cases retournent le sens de Z et celui de X sans déplacer l'origine. Le repère est affiché en vrai pendant la création et la modification. Le repère suit la pièce quand elle change.

## Fonctions

Historique rejouable, timeline à icônes (vert = ajout, rouge = enlèvement), marqueur de temps glissable, réordonnancement par glisser-déposer : une fonction se glisse avec son esquisse (attraper l'une ou l'autre), congés et répétitions compris, jusqu'à la dernière place que permettent ses liens. Une fonction ne s'appuie que sur ce qui la précède (**règle d'antériorité**).
- Marqueur posé juste après l'import d'un STEP ou d'un corps dérivé (suivi d'une échelle, d'autres fonctions…) : les outils de face (déplacer une face, congé, chanfrein, dépouille, coque) s'ouvrent sur ce corps comme sur une pièce native.
- **Extrusion** et **révolution** dynamiques : distance, jusqu'à une face, à travers tout, symétrique, dépouille, nouveau corps ; flèche à glisser dans la vue, de taille fixe à l'écran (environ 40 pixels, quel que soit le zoom ou l'angle de vue), comme celles des perçages, congés et révolutions.
- **Zones fermées** (comme Fusion 360) : en esquisse, chaque zone fermée est teintée (un contour ouvert ne l'est pas) ; dans l'extrusion, un clic sur une zone l'ajoute ou la retire — plusieurs zones pour une même extrusion, ↺ Auto pour toute la matière.
- **Balayage** d'un profil le long d'une ligne, d'un arc ou d'une **spline**.
- **Perçage** simple, lamé, fraisé, **alésé** (fond plat avec ou sans perçage, ou débouchant ; classe ISO 286 : H7… ; jeu de l'avant-trou en jeu ou en Ø) ou **taraudé**, débouchant ou borgne.
  - Taraudages des corps de douilles Ensat 302 aussi proposés : M4,5×0,5, M5×0,5, M6,5×0,75, M9×1, M26×1,5.
  - Filetages : **métrique ISO**, **ANSI UNC / UNF**, **gaz G, Rc et NPT**.
  - Lamages et fraisures d'après la vis : **CHC** et **FHC** ISO, ou ASME en pouces (FHC à 82°).
  - Le filet ISO ou UN est **réellement creusé dans le corps**, après l'avant-trou, en tâche de fond ; le gaz reste en filet cosmétique.
- **Perçage normal à une face** (bouton **Normal**) : un clic sur une face (un congé…), et chaque trou borgne dont le fond est dessous reçoit un trou perpendiculaire à la face, qui vise le centre du cercle de son fond (avant le cône).
  - Tous les trous identiques sont trouvés d'un coup.
  - Plusieurs faces peuvent être choisies : chaque trou va à la face au-dessus de lui.
  - Les trous déjà percés au fond sont ignorés.
  - Une case sous chaque trou, dans la vue 3D, permet de l'enlever.
  - Une seule fonction, qui suit la pièce : si le trou visé change (profondeur, Ø, déplacement), elle suit les trous les plus proches au lieu de tomber à 0 trou.
- **Perçage sur un cylindre** : un clic sur la face extérieure pose le trou ; direction, angle, cote depuis une face, une arête ou un sommet et décalage latéral se règlent dans le panneau, et le trou suit la pièce.
- **Rainure de clavette automatique** : un clic sur un arbre ou un alésage, et le diamètre donne les cotes ISO 773. La clavette naît comme un corps séparé, posée au fond. Quatre formes, position réglable, et chaque cote modifiable une par une pour les cas non standard ; les cotes non saisies suivent le diamètre si la pièce change.
- **Gorge de joint torique automatique** (Créer → Joint) : un clic sur un arbre, un alésage ou une face plane ronde (bride, couvercle). Le diamètre donne la section, la gorge ISO 3601-2 et le joint ISO 3601-1 (AS568) qui convient : étiré sur le fond pour un arbre, serré par son Ø extérieur dans un alésage, centré dans une gorge de face (même jeu des deux côtés), ou à la demande contre la paroi du côté de la pression. Sur une face plane, le Ø du joint peut être saisi, ou pris en cliquant une arête circulaire (⌖) : la gorge se centre sur ce cercle et le joint normalisé le plus proche est choisi ; contre une paroi, cette paroi se pose au Ø donné et le joint s'y appuie de 1 à 3 %. Sans Ø d'appui, la gorge se met au milieu d'une face ronde, ou autour du trou d'une plaque de toute forme. **Type de joint** : torique ou **quadrilobe** (X-ring, Quad-Ring) — mêmes tailles AS568, gorge des fabricants (Minnesota Rubber : plus profonde, à peine plus large que la section) et profil à quatre lobes — ou, dans un alésage, **racleur de tige** (ISO 6195 type A) : logement creusé à l'entrée de l'alésage (lèvre de retenue Ø D2 sur 2 mm puis gorge Ø D1 × L1, cotes de la norme), tige normalisée prise d'après le Ø de l'alésage, entrée au début ou à la fin de l'alésage, racleur posé dont la lèvre dépasse de la face et serre la tige (forme indicative). Le joint naît comme un corps séparé en caoutchouc. Section, joint, usage statique ou dynamique, largeur, profondeur et position se règlent ; l'étirement ou le serrage hors usage est signalé, et tout suit le diamètre si la pièce change.
- **Congés et chanfreins exacts**, sur la chaîne tangente ou l'arête seule ; un clic ajoute ou retire une arête.
  - **Case « tangentes » décochée**, le congé ignore la tangence : il file tout droit le long de l'arête et continue tout droit à ses bouts, jusqu'aux faces voisines dans un coin intérieur, dans la matière sur une arête en bosse.
  - **Coin qui débouche dans le vide** (une patte qui s'arrête alors que la face d'en face continue, comme le pied d'une patte posée sur un tube) : le congé est posé tout droit et coupé au ras des faces de bout de la patte, au lieu d'être refusé à tous les rayons. Quand l'une des faces est un tube (ou un alésage) le long de l'arête, le congé reste tangent au tube : pas de trait noir au pied.
  - Sur une **pièce tournée** (révolution), un congé ou chanfrein du bord d'un cercle (bout d'un tube…) retrouve son arête à chaque recalcul ; avant, il pouvait l'annoncer « perdue » alors qu'elle n'avait pas bougé.
  - **Plusieurs arêtes** tangentes entre elles passent en une fois et se raccordent, comme dans Fusion. Le congé ne s'étend jamais à des arêtes non choisies : celle que le noyau ne sait pas arrondir sans déborder reste vive et est signalée (⚠), avec l'épaisseur de paroi quand c'est elle qui bloque.
  - **Rayon impossible** : il est ramené au plus grand qui passe (⚠ dans l'arbre), le rayon demandé restant enregistré. Reprise NURBS quand le noyau refuse la chaîne.
  - **Arêtes refusées** ou ignorées par le noyau sans le dire : elles sont comptées, **⚠ « non fait sur n/t arête(s) »** dans l'arbre et le panneau, avec l'endroit.
  - **Chanfrein** à **distance égale, deux distances ou distance + angle**, première face inversable.
  - L'arête choisie suit les paramètres amont, y compris sur une extrusion à **dépouille** (hauteur et angle modifiés).
  - Avec plusieurs corps, l'aperçu ne remplace que le corps modifié : un corps caché le reste.
- **Répétition** linéaire, en grille, circulaire, symétrie ou suivant un profil, avec aperçu rouge des copies.
  - Les **fonctions à répéter se choisissent dans la timeline** : un clic ajoute, un nouveau clic retire (cliquer une esquisse choisit sa fonction). Elles y sont **entourées de vert** dès que la répétition est sélectionnée. Pour modifier une répétition existante : **🎯 Choisir dans la timeline** dans son panneau ; ✕ retire une fonction de la liste.
  - **Symétrie + Linéaire + Symétrie** : dans une symétrie, cochez **+ Linéaire** (direction, quantité, distance) pour répéter la pièce et son image en ligne, puis **+ Symétrie (2ᵉ plan)** pour reprendre le tout en miroir — une seule fonction dans l’arbre.
  - Une **case à cocher par copie** enlève celle qui tombe mal : dans le panneau, et sous chaque copie dans la vue avec l'option « Cases dans la vue 3D ». Au survol, la copie passe en bleu.
  - Balayages compris, sans esquisses copiées visibles dans l'arbre.
  - Les copies **s'unissent** à leur corps ou deviennent chacune un **nouveau corps**.
  - Une répétition se répète.
- **Modifier** :
  - **déplacer une face** façon Appuyer/Tirer : ses bords suivent les parois voisines, dépouilles et coins arrondis compris ;
    - cliquer la face d'un **congé ou d'un chanfrein** règle directement sa taille ;
    - la case **Faces tangentes** retient d'un clic toutes les faces qui se prolongent sans arête vive (l'intérieur d'une poche, congés compris), décalées d'un bloc quel que soit leur type ;
      si le noyau refuse de les décaler, la face cliquée (plane ou cylindrique) bouge quand même et un message dit que les faces tangentes n'ont pas suivi ;
    - une face trop courbe pour la distance demandée, qui se replierait (« vrille »), est remplacée par une surface lisse tangente à ses voisines, et un message le dit (la coque aussi) ;
  - **supprimer des faces**, plusieurs à la fois, avec calcul en tâche de fond ;
    - un **trou à cheval sur plusieurs faces** (un plat et un arrondi) se rebouche aussi : le trou est comblé par un bouchon coupé par les faces voisines prolongées, pli compris ; dans les plis faits de petites surfaces libres (tôle importée), le refus reste possible ;
  - **dépouille** : angle signé, sens inversable ;
  - **coque** : évidage à épaisseur constante, peau autour de la pièce, ou **soufflée** (la face choisie s'enfonce dans la pièce jusqu'à une paroi donnée de l'extérieur, en enjambant les creux plus étroits qu'une largeur choisie ; surface lisse, lissage réglable) ;
  - **scinder** par un plan ;
  - **déplacer un corps** (translation, rotation, point à point) ;
  - **échelle / homothétie** d’un corps : facteur uniforme ou X, Y, Z ; centre = origine, point ou centre du corps ; corps modifié ou nouveau corps ;
  - **combiner** : union, soustraction, intersection.

  Ces outils marchent aussi sur un **STEP importé** seul.
- **Références qui tiennent** : chaque face et chaque arête porte un nom unique, transmis d'une fonction à l'autre.
  - Congés, plans, perçages, esquisses sur face, projections, liaisons d'assemblage et faces choisies pour l'usinage retrouvent leur élément par ce nom, y compris dans les copies d'une répétition.
  - Une esquisse posée sur une face qui ne vient pas d'une extrusion (STEP importé, corps dérivé soustrait, combinaison) retient aussi sa face et suit son plan ; le nom de la face s'affiche dans l'esquisse.
  - **Face ou arête perdue : resélection, comme Fusion.** Un ⚠ la signale dans l'arbre et la timeline ; un double-clic ouvre la resélection.
    - Esquisse : bouton **« 🎯 Changer de face »** dans ses propriétés. La timeline s'arrête avant la fonction qui l'utilise, un clic sur la nouvelle face y repose l'esquisse (son dessin garde ses cotes), Échap annule. Sur une face parallèle à l'ancien plan (réparer une face perdue), le dessin reste à sa place : il se recale seulement sur la face (V0.94.7).
    - Déplacer une face, coque, suppression de face : à l'ouverture de l'édition, la première face perdue attend sa remplaçante ; le clic suivant la remplace à sa place dans la liste. Bouton **« 🎯 Remplacer »** sur chaque face perdue, ✕ pour la retirer.
    - Congés et chanfreins : une arête perdue reste dans la liste (avant, elle disparaissait au premier clic) ; l'arête cliquée la remplace et reprend sa taille.
  - Un grand changement de cote se calcule par petits pas en interne ; si un élément a vraiment disparu, une alerte le dit.
  - Après une valeur impossible, ou un grand changement de longueur ou de largeur, revenir à la valeur d'origine redonne exactement la pièce d'origine, même avec des congés recopiés par une répétition (Barquette et ses renforts) ; les plans suivent aussitôt.
  - Un clic sur une face ou une arête affiche son numéro et la fonction qui l'a créée.
- **Fil de construction** : une esquisse apparaît là où elle a été créée, une esquisse refermée vide disparaît, une répétition reste dans le corps de ses sources, et le **corps actif** se choisit dans le bandeau de timeline.

## Corps et mesures

- **Corps** :
  - bouton **Corps** pour un corps vide ;
  - **⧉ Copier** (ou clic droit sur le corps) : une **copie qui est une étape de la timeline**. Elle reprend le corps tel qu'il est à cet instant ; ce qui lui est ajouté plus loin n'y entre pas ;
  - la copie se fait **en place**, ou **en symétrie par 1 ou 2 plans** (plans de l'origine ou de construction) : chaque copie dans un corps neuf, ou, case **Unir au corps**, réunie à la pièce en un seul corps, faces planes recollées sans trait de symétrie ;
  - **Symétrie** d'un corps entier (plan YZ, XZ ou XY de l'origine) : toute son histoire jusque-là, combinaisons et congés compris, copiée en miroir et réunie à lui-même ;
  - matériau (bibliothèque commune avec le RENDU, masse estimée), couleur, transparence, isoler ; une découpe peut traverser plusieurs corps ;
  - le corps actif (●) reçoit les nouvelles fonctions ; une extrusion, une révolution, un balayage ou un perçage choisit aussi son corps dans son panneau ;
  - **Supprimer** un corps ne touche pas les autres (même ceux nés de lui par une répétition) ;
  - **⊘ Retirer** (clic droit sur le corps, dans l'arbre ou dans la vue 3D) l'enlève à partir d'une étape de la timeline, sans rien effacer, comme dans Fusion 360. Un corps retiré, ou consommé par **Combiner**, est barré dans l'arbre à partir de cette étape.
- **Mesures** : `Ctrl` enfoncé, on est en mesure, sans bouton et sans rien activer (`Ctrl+clic` : face à face, Ø, entraxe, entre deux arêtes, et depuis un **plan du repère** — `Ctrl+clic` sur le petit plan XY, XZ ou YZ puis sur n'importe quelle face ou arête, ou l'inverse : distance au plan, axe d'un cylindre, angle), en CAO et en FAO ; dès la **3e face**, plus de mesure : les faces restent seulement sélectionnées, `Suppr` les supprime (`Ctrl+clic` sur une face prise la retire) ; le même outil en **Modéliser** et en **Assembler** mesure aussi entre les pièces d'un assemblage.

---

[← Esquisse](esquisse.md) · [Sommaire du manuel](README.md) · [Fichiers →](fichiers.md)
