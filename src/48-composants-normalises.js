/* ---------- composants normalisés : vis, bouchons, goupilles, clavettes (V0.21.0) ----------
   Fenêtre « Normalisés » du groupe Composants : on choisit une norme, une taille, un pas, une
   longueur, et la pièce arrive comme un COMPOSANT du composant actif (comme « Insérer »),
   modélisée par de vraies fonctions, rejouées par le noyau comme celles d'une pièce dessinée :
     · révolution d'un profil (r, z) du plan XZ autour de Z — arcs permis (bouts bombés) ;
     · six pans creux : découpe d'un hexagone (plan XY) depuis le dessus ;
     · fente d'une goupille élastique, contour d'une clavette : esquisse XY + extrusion.
   V0.35.0 : la tige des vis (ISO, ANSI) et des bouchons G porte une fonction FILETAGE
   (76-filetage) sur la longueur filetée de la norme : spirale cosmétique (comme un taraudage,
   cachée avec la pièce) ou, au choix pour les vis, filet ISO modélisé. La désignation le
   porte aussi (M8×1, 1/4-28 UNF, G 1/2…) et doc.std la garde (nomenclature, réemploi).
   Repères : vis CHC et bouchon à collerette — origine sous la tête (face d'appui), tige vers
   −Z ; vis FHC et bouchon conique — origine sur le dessus (affleurant), pièce vers −Z ;
   goupille — de z = 0 à z = L ; clavette — posée sur XY, centrée, hauteur vers +Z.
   « Aligner » sur une face de la pièce receveuse pose donc directement la vis.
   Une pièce déjà présente (même désignation) reçoit une nouvelle OCCURRENCE plutôt qu'un
   second composant identique.
   « Sur des trous » (comme l'insertion de visserie de Fusion 360) : on clique UN trou d'une pièce,
   tous les trous IDENTIQUES de cette pièce (même empilement de cylindres : simple, lamé, fraisé,
   même profondeur, même sens) reçoivent chacun une occurrence, tenue par une LIAISON RIGIDE
   (alignement sur le centre du cercle de la face d'assise : associatif, la vis suit le trou).
   Assise (sp.seat) : 'under' sous tête (CHC, collerette) — fond du lamage, sinon l'entrée ;
   'flush' affleurant (bouchon conique) — l'entrée ; FHC — l'entrée, 0,2 mm dessous (sp.sink,
   FHC_RETRAIT du perçage) ; 'mid' (goupille, origine en son milieu) — sur l'axe du cylindre du trou :
   milieu, arête haute ou arête basse, au choix ou « au plus court » du point cliqué (V0.21.7). Cotes en mm ; les normes en pouces sont converties (STD_IN). */
const STD_IN=25.4;
// ISO 261 : pas gros (la désignation « M » seule) puis pas fins
const STD_ISO_PAS={'M1.6':[0.35,0.2],'M2':[0.4,0.25],'M2.5':[0.45,0.35],'M3':[0.5,0.35],'M4':[0.7,0.5],'M5':[0.8,0.5],
  'M6':[1,0.75],'M8':[1.25,1,0.75],'M10':[1.5,1.25,1,0.75],'M12':[1.75,1.5,1.25,1],'M14':[2,1.5,1.25,1],'M16':[2,1.5,1],
  'M20':[2.5,2,1.5,1],'M24':[3,2,1.5,1],'M30':[3.5,3,2,1.5,1],'M36':[4,3,2,1.5]};
// ISO 4762 (CHC) : [taille, d, dk, k, s (clé), t (prise de clé), Lmin, Lmax]
const STD_ISO4762=[['M1.6',1.6,3,1.6,1.5,0.7,2.5,16],['M2',2,3.8,2,1.5,1,3,20],['M2.5',2.5,4.5,2.5,2,1.1,4,25],
  ['M3',3,5.5,3,2.5,1.3,5,30],['M4',4,7,4,3,2,6,40],['M5',5,8.5,5,4,2.5,8,50],['M6',6,10,6,5,3,10,60],
  ['M8',8,13,8,6,4,12,80],['M10',10,16,10,8,5,16,100],['M12',12,18,12,10,6,20,120],['M14',14,21,14,12,7,25,140],
  ['M16',16,24,16,14,8,25,160],['M20',20,30,20,17,10,30,200],['M24',24,36,24,19,12,40,200],
  ['M30',30,45,30,22,15.5,45,200],['M36',36,54,36,27,19,55,200]];
// ISO 10642 (FHC, fraisure 90°) : [taille, d, dk théorique, k, s, t, Lmin, Lmax]
const STD_ISO10642=[['M3',3,6.72,1.86,2,1.1,8,30],['M4',4,8.96,2.48,2.5,1.5,8,40],['M5',5,11.2,3.1,3,1.9,8,50],
  ['M6',6,13.44,3.72,4,2.2,8,60],['M8',8,17.92,4.96,5,3,10,80],['M10',10,22.4,6.2,6,3.6,12,100],
  ['M12',12,26.88,7.44,8,4.3,20,100],['M16',16,33.6,8.8,10,4.8,30,100],['M20',20,40.32,10.16,12,5.6,35,100]];
const STD_ISO_LV=[2.5,3,4,5,6,8,10,12,16,20,25,30,35,40,45,50,55,60,65,70,80,90,100,110,120,130,140,150,160,180,200];
// ASME B18.3 CHC (pouces) : [taille, D, A (Ø tête), H, J (clé), T, filets/pouce UNC (0 : aucun), UNF, Lmin, Lmax]
const STD_ANSI_SHCS=[['#0',.06,.096,.06,.05,.025,0,80,'1/8','1/2'],['#1',.073,.118,.073,1/16,.031,64,72,'1/8','5/8'],
  ['#2',.086,.14,.086,5/64,.038,56,64,'1/8','3/4'],['#3',.099,.161,.099,5/64,.044,48,56,'1/8','1'],
  ['#4',.112,.183,.112,3/32,.051,40,48,'1/8','1'],['#5',.125,.205,.125,3/32,.057,40,44,'1/8','1'],
  ['#6',.138,.226,.138,7/64,.064,32,40,'1/8','1-1/2'],['#8',.164,.27,.164,9/64,.077,32,36,'1/4','2'],
  ['#10',.19,.312,.19,5/32,.09,24,32,'1/4','2-1/2'],['1/4',.25,.375,.25,3/16,.12,20,28,'1/4','4'],
  ['5/16',.3125,.469,.3125,1/4,.151,18,24,'3/8','4'],['3/8',.375,.562,.375,5/16,.182,16,24,'3/8','5'],
  ['7/16',.4375,.656,.4375,3/8,.213,14,20,'1/2','5'],['1/2',.5,.75,.5,3/8,.245,13,20,'1/2','6'],
  ['5/8',.625,.938,.625,1/2,.307,11,18,'3/4','6'],['3/4',.75,1.125,.75,5/8,.37,10,16,'1','6'],
  ['7/8',.875,1.312,.875,3/4,.432,9,14,'1-1/4','6'],['1',1,1.5,1,3/4,.495,8,12,'1-1/2','6']];
// ASME B18.3 FHC (fraisure 82°) : [taille, D, A théorique, J, T, Lmin, Lmax] — filets : table CHC
const STD_ANSI_FHCS=[['#2',.086,.197,.05,.038,'1/8','3/4'],['#3',.099,.226,1/16,.044,'1/8','1'],
  ['#4',.112,.255,1/16,.055,'1/8','1'],['#5',.125,.281,5/64,.061,'1/8','1'],['#6',.138,.307,5/64,.066,'1/8','1-1/2'],
  ['#8',.164,.359,3/32,.076,'1/4','2'],['#10',.19,.411,1/8,.087,'1/4','2'],['1/4',.25,.531,5/32,.111,'3/8','3'],
  ['5/16',.3125,.656,3/16,.135,'1/2','3'],['3/8',.375,.781,7/32,.159,'1/2','3'],['7/16',.4375,.844,1/4,.159,'5/8','3'],
  ['1/2',.5,.938,5/16,.172,'5/8','4'],['5/8',.625,1.188,3/8,.22,'1','4'],['3/4',.75,1.438,1/2,.265,'1','4']];
const STD_INCH_LV=['1/8','3/16','1/4','5/16','3/8','7/16','1/2','5/8','3/4','7/8','1','1-1/4','1-1/2','1-3/4','2',
  '2-1/4','2-1/2','2-3/4','3','3-1/4','3-1/2','3-3/4','4','4-1/2','5','5-1/2','6'];
// Bouchons six pans creux. DIN 906 (conique R, 1:16) : [taille, Ø de jauge, filets/pouce, L, s, t]
const STD_DIN906=[['R 1/8',9.728,28,8,5,4],['R 1/4',13.157,19,10,7,5],['R 3/8',16.662,19,10,8,5],['R 1/2',20.955,14,10,10,5],
  ['R 3/4',26.441,14,12,12,6],['R 1',33.249,11,12,17,6],['R 1-1/4',41.91,11,18,22,11.5],['R 1-1/2',47.803,11,20,24,11.5]];
// DIN 908 (cylindrique G, à collerette) : [taille, d, filets/pouce, dk, k, i (filetée), s, t]
const STD_DIN908=[['G 1/8',9.728,28,14,3,8,5,5],['G 1/4',13.157,19,18,3,12,6,7],['G 3/8',16.662,19,22,3,12,8,7.5],
  ['G 1/2',20.955,14,26,4,14,10,7.5],['G 3/4',26.441,14,32,4,16,12,9],['G 1',33.249,11,39,5,16,17,9],
  ['G 1-1/4',41.91,11,49,5,16,22,10.5],['G 1-1/2',47.803,11,52,5,16,24,10.5],['G 2',59.614,11,68,5,20,32,14]];
// NPTF (Dryseal, conicité 3/4" au pied) : [taille, Ø extérieur, filets/pouce, clé, L] en pouces — catalogue
const STD_NPTF=[['1/16',.3125,27,5/32,.31],['1/8',.405,27,3/16,.31],['1/4',.54,18,1/4,.44],['3/8',.675,18,5/16,.44],
  ['1/2',.84,14,3/8,.56],['3/4',1.05,14,9/16,.56],['1',1.315,11.5,5/8,.69],['1-1/4',1.66,11.5,3/4,.69],
  ['1-1/2',1.9,11.5,3/4,.69],['2',2.375,11.5,1,.69]];
// Goupilles ISO : [d, Lmin, Lmax] ; chanfrein c par Ø
const STD_PIN_C={1:.2,1.5:.3,2:.35,2.5:.4,3:.5,4:.63,5:.8,6:1.2,8:1.6,10:2,12:2.5,13:2.5,14:2.5,16:3,18:3,20:3.5};
const STD_ISO2338=[[1,4,10],[1.5,4,16],[2,6,20],[2.5,6,24],[3,8,30],[4,8,40],[5,10,50],[6,12,60],[8,14,80],[10,18,95],[12,22,140],[16,26,180],[20,35,200]];
const STD_ISO8734=[[1,3,10],[1.5,4,16],[2,5,20],[2.5,6,24],[3,8,30],[4,10,40],[5,12,50],[6,14,60],[8,18,80],[10,22,100],[12,26,100],[16,40,100],[20,50,100]];
const STD_ISO2339=[[1,6,10],[1.5,8,24],[2,10,35],[2.5,10,35],[3,12,45],[4,14,55],[5,18,60],[6,22,90],[8,22,120],[10,26,160],[12,32,180],[16,40,200],[20,45,200]];
// ISO 8752 (élastique, série épaisse) : [d, épaisseur s, Lmin, Lmax]
const STD_ISO8752=[[1,.2,4,20],[1.5,.3,4,20],[2,.4,4,30],[2.5,.5,4,30],[3,.6,4,40],[4,.8,4,50],[5,1,5,80],[6,1.2,10,100],
  [8,1.5,10,120],[10,2,10,160],[12,2.5,10,180],[13,2.5,10,180],[14,3,10,200],[16,3,10,200],[18,3.5,10,200],[20,4,10,200]];
const STD_PIN_LV=[3,4,5,6,8,10,12,14,16,18,20,22,24,26,28,30,32,35,40,45,50,55,60,65,70,75,80,85,90,95,100,120,140,160,180,200];
// ASME B18.8.2 : goupilles rectifiées trempées [Ø, Lmin, Lmax] ; élastiques fendues [Ø, épaisseur (po), Lmin, Lmax]
const STD_ANSI_DOWEL=[['1/16','3/16','1'],['3/32','3/16','1-1/4'],['1/8','1/4','2'],['5/32','3/8','2'],['3/16','3/8','2-1/2'],
  ['1/4','1/2','3'],['5/16','1/2','3'],['3/8','1/2','4'],['7/16','3/4','4'],['1/2','3/4','5'],['5/8','1','6'],['3/4','1','6'],
  ['7/8','1-1/2','6'],['1','1-1/2','6']];
const STD_ANSI_SPRING=[['1/16',.012,'1/8','1'],['5/64',.018,'1/8','1'],['3/32',.022,'3/16','1-1/2'],['1/8',.028,'1/4','2'],
  ['5/32',.032,'1/4','2-1/2'],['3/16',.04,'5/16','3'],['7/32',.048,'3/8','3'],['1/4',.062,'3/8','4'],['5/16',.062,'1/2','4'],
  ['3/8',.077,'1/2','4'],['7/16',.077,'3/4','4'],['1/2',.094,'3/4','4']];
// ISO 773 (clavettes parallèles, ≈ DIN 6885 A) : [arbre de, à, b, h, t1 (arbre), t2 (moyeu), Lmin, Lmax]
const STD_ISO773=[[6,8,2,2,1.2,1,6,20],[8,10,3,3,1.8,1.4,6,36],[10,12,4,4,2.5,1.8,8,45],[12,17,5,5,3,2.3,10,56],
  [17,22,6,6,3.5,2.8,14,70],[22,30,8,7,4,3.3,18,90],[30,38,10,8,5,3.3,22,110],[38,44,12,8,5,3.3,28,140],
  [44,50,14,9,5.5,3.8,36,160],[50,58,16,10,6,4.3,45,180],[58,65,18,11,7,4.4,50,200],[65,75,20,12,7.5,4.9,56,220],
  [75,85,22,14,9,5.4,63,250],[85,95,25,14,9,5.4,70,280],[95,110,28,16,10,6.4,80,320],[110,130,32,18,11,7.4,90,360]];
const STD_KEY_LV=[6,8,10,12,14,16,18,20,22,25,28,32,36,40,45,50,56,63,70,80,90,100,110,125,140,160,180,200,220,250,280,320,360];
// Rondelles plates ISO (V0.75.0) : [taille, d1 (Ø intérieur), d2 (Ø extérieur), h (épaisseur)]
const STD_ISO7089=[['M1.6',1.7,4,0.3],['M2',2.2,5,0.3],['M2.5',2.7,6,0.5],['M3',3.2,7,0.5],['M4',4.3,9,0.8],['M5',5.3,10,1],
  ['M6',6.4,12,1.6],['M8',8.4,16,1.6],['M10',10.5,20,2],['M12',13,24,2.5],['M14',15,28,2.5],['M16',17,30,3],['M20',21,37,3],
  ['M24',25,44,4],['M30',31,56,4],['M36',37,66,5]];
const STD_ISO7092=[['M1.6',1.7,3.5,0.3],['M2',2.2,4.5,0.3],['M2.5',2.7,5,0.5],['M3',3.2,6,0.5],['M4',4.3,8,0.5],['M5',5.3,9,1],
  ['M6',6.4,11,1.6],['M8',8.4,15,1.6],['M10',10.5,18,1.6],['M12',13,20,2],['M14',15,24,2.5],['M16',17,28,2.5],['M20',21,34,3],
  ['M24',25,39,4],['M30',31,50,4],['M36',37,60,5]];
const STD_ISO7093=[['M3',3.2,9,0.8],['M4',4.3,12,1],['M5',5.3,15,1.2],['M6',6.4,18,1.6],['M8',8.4,24,2],['M10',10.5,30,2.5],
  ['M12',13,37,3],['M14',15,44,3],['M16',17,50,3],['M20',22,60,4],['M24',26,72,5],['M30',33,92,6],['M36',39,110,8]];
// Rondelle élastique Grower DIN 127 B : [taille, d1, s (épaisseur), b (largeur de section)]
const STD_DIN127=[['M2',2.1,0.5,0.9],['M2.5',2.6,0.6,1],['M3',3.1,0.8,1.3],['M4',4.1,0.9,1.5],['M5',5.1,1.2,1.8],['M6',6.1,1.6,2.5],
  ['M8',8.2,2,3],['M10',10.2,2.2,3.5],['M12',12.2,2.5,4],['M14',14.2,3,4.5],['M16',16.2,3.5,5],['M20',20.2,4,6],['M24',24.5,5,7],
  ['M30',30.5,6,8],['M36',36.5,6,10]];
// ASME B18.22.1 Type A (pouces) : [taille, Ø vis, série N (étroite) : ID, OD, ép. ; série W (large) : ID, OD, ép.]
const STD_ANSI_FLAT=[['#6',.138,.156,.375,.049,.188,.438,.049],['#8',.164,.188,.438,.049,.219,.5,.049],['#10',.19,.219,.5,.049,.25,.562,.049],
  ['#12',.216,.25,.562,.065,.281,.625,.065],['1/4',.25,.281,.625,.065,.312,.734,.065],['5/16',.3125,.344,.688,.065,.375,.875,.083],
  ['3/8',.375,.406,.812,.065,.438,1,.083],['7/16',.4375,.469,.922,.065,.5,1.25,.083],['1/2',.5,.531,1.062,.095,.562,1.375,.109],
  ['9/16',.5625,.594,1.156,.095,.625,1.469,.109],['5/8',.625,.656,1.312,.095,.688,1.75,.134],['3/4',.75,.812,1.469,.134,.812,2,.148],
  ['7/8',.875,.938,1.75,.134,.938,2.25,.165],['1',1,1.062,2,.134,1.062,2.5,.165]];
// ASME B18.21.1 rondelle élastique hélicoïdale, série normale : [taille, ID, largeur W, épaisseur T] (pouces)
const STD_ANSI_LOCK=[['#4',.115,.04,.025],['#6',.141,.04,.031],['#8',.168,.047,.04],['#10',.194,.047,.047],['1/4',.255,.109,.062],
  ['5/16',.319,.125,.078],['3/8',.382,.141,.094],['7/16',.446,.156,.109],['1/2',.509,.171,.125],['5/8',.636,.203,.156],
  ['3/4',.763,.234,.188],['7/8',.89,.266,.219],['1',1.017,.297,.25]];
const STD_WASHER_TYPES=[['iso7089','ISO 7089 — plate, série normale'],['iso7090','ISO 7090 — plate chanfreinée, série normale'],
  ['iso7092','ISO 7092 — plate, série étroite'],['iso7093','ISO 7093-1 — plate, série large'],['din127','DIN 127 B — Grower (élastique fendue)'],
  ['ansiN','ANSI B18.22.1 Type A — série N (étroite)'],['ansiW','ANSI B18.22.1 Type A — série W (large)'],['ansiLock','ANSI B18.21.1 — Lock washer (élastique fendue)']];
/* Douilles autotaraudeuses (V0.95.8) : aucune norme ISO ni ANSI n'en fixe les cotes ; tout le
   marché reprend la norme d'usine Ensat 302 (Kerb-Konus), douille à FENTE de coupe au bas du
   corps. Taraudage intérieur ISO 6H (pas gros) ou UNC / UNF ; corps fileté en mm, mêmes cotes en
   métrique et en pouces. Repère : origine sur le dessus (affleurant), corps vers −Z ; posée
   « Sur des trous », 0,1 mm sous l'entrée (pose conseillée : 0,1 à 0,2 mm sous la surface).
   Métrique : [taille, filet intérieur, Ø ext. E, pas ext. P, L, perçage mini, maxi, trou borgne mini] */
const STD_ENSAT302=[['M2','M2',4.5,0.5,6,4.2,4.3,8],['M2.5','M2.5',4.5,0.5,6,4.2,4.3,8],['M3','M3',5,0.5,6,4.7,4.8,8],
  ['M4','M4',6.5,0.75,8,6.1,6.2,10],['M5','M5',8,1,10,7.5,7.6,13],['M6c','M6',9,1,12,8.5,8.6,15],['M6','M6',10,1.5,14,9.2,9.4,17],
  ['M8','M8',12,1.5,15,11.2,11.4,18],['M10','M10',14,1.5,18,13.2,13.4,22],['M12','M12',16,1.5,22,15.2,15.4,26],
  ['M14','M14',18,1.5,24,17.2,17.4,28],['M16','M16',20,1.5,22,19.2,19.4,26],['M18','M18',22,1.5,24,21.2,21.4,29],
  ['M20','M20',26,1.5,27,25.2,25.4,32]];
// Pouces : [taille, filets/pouce UNC, UNF, E, P, L, trou borgne mini] — perçage : ligne métrique de même Ø E
const STD_ENSAT302_IN=[['#4',40,48,5,0.5,6,8],['#6',32,40,6,0.75,8,10],['#8',32,36,6.5,0.75,8,10],['#10',24,32,8,1,10,13],
  ['1/4',20,28,10,1.5,14,17],['5/16',18,24,12,1.5,15,18],['3/8',16,24,14,1.5,18,22],['7/16',14,20,16,1.5,22,26],
  ['1/2',13,20,18,1.5,22,28],['5/8',11,18,20,1.5,22,27]];
const STD_ENSAT_HOLE={5:[4.7,4.8],6:[5.6,5.7],6.5:[6.1,6.2],8:[7.5,7.6],10:[9.2,9.4],12:[11.2,11.4],14:[13.2,13.4],
  16:[15.2,15.4],18:[17.2,17.4],20:[19.2,19.4]};
function stdInsert302(st){
  const ins=st.type==='ansi';
  let thr,E,P,L,h0,h1,T,lab;
  if(ins){
    const r=STD_ENSAT302_IN.find(x=>x[0]===st.size)||STD_ENSAT302_IN[0],unf=st.thr==='UNF';
    thr=r[0]+'-'+(unf?r[2]:r[1])+' '+(unf?'UNF':'UNC');[,,,E,P,L,T]=r;[h0,h1]=STD_ENSAT_HOLE[E];lab=thr;
  }else{
    const r=STD_ENSAT302.find(x=>x[0]===st.size)||STD_ENSAT302[0];
    thr=r[1];[,,E,P,L,h0,h1,T]=r;lab=r[1]+(r[0]==='M6c'?' court':'');
  }
  const t=isoThread(thr),pi=t[2],di=t[1],dr=tapDrill(thr,pi),ri=dr/2,R=E/2;
  const cb=Math.min(P,L*0.15),c1=Math.min(0.3,(R-ri)*0.3),csD=+Math.min(di+0.4,2*R-2*c1-0.4).toFixed(2);
  const w=+Math.max(0.5,E*0.1).toFixed(2),hs=+(L*0.4).toFixed(2);
  const body='M'+stdF(E).replace(',','.'),ext='Ø'+stdF(E)+' × '+stdF(P);
  const norm='Ensat 302',name='Douille Ensat 302 '+lab;
  return {seat:'flush',sink:0.1,key:'ENSAT 302|'+(ins?thr:st.size),norm,desig:lab+' ('+ext+' × '+stdF(L)+')',name,bore:ri,
    info:'Douille autotaraudeuse à fente de coupe (norme d’usine Ensat 302 : pas de norme ISO ni ANSI) · taraudage '+thr+(ins?'':' (6H)')+
      ' · corps fileté '+ext+' · L '+stdF(L)+' · perçage conseillé Ø'+stdF(h0)+' à '+stdF(h1)+' · trou borgne ≥ '+stdF(T),
    prof:[[0,-L],[R-cb,-L],[R,-L+cb],[R,-c1],[R-c1,0],[0,0]],
    thr:stdThr(body,P,E,L,L,0,false),
    ops:[{k:'hole',size:thr,p:pi,d:dr,csD,len:L},{k:'slot',open:true,x0:ri-0.3,x1:R+1,w,z0:-L,L:hs}]};
}
function stdWasherRows(t){
  return t==='iso7090'?STD_ISO7089.filter(r=>stdFrac(r[0].slice(1))>=5):t==='iso7092'?STD_ISO7092:t==='iso7093'?STD_ISO7093:
    t==='din127'?STD_DIN127:t==='ansiN'||t==='ansiW'?STD_ANSI_FLAT:t==='ansiLock'?STD_ANSI_LOCK:STD_ISO7089;
}
/* ── outils ── */
function stdFrac(s){
  // '1-1/4' → 1.25 ; '3/8' → 0.375 ; '2' → 2
  const m=/^(?:(\d+)-)?(\d+)\/(\d+)$/.exec(String(s));
  if(m)return (m[1]?+m[1]:0)+(+m[2])/(+m[3]);
  return +s;
}
function stdF(v){return String(+(+v).toFixed(3)).replace('.',',');}
function stdHex(s){
  // hexagone de côtés s (sur plats), sommets sur X
  const R=s/Math.sqrt(3),o=[];
  for(let i=0;i<6;i++){const a=i*Math.PI/3;o.push([R*Math.cos(a),R*Math.sin(a)]);}
  return o;
}
function stdLens(lv,a,b,num){
  // longueurs de la série comprises entre a et b (numériques ou fractions)
  const v=num?x=>x:stdFrac,A=v(a),B=v(b);
  return lv.filter(x=>v(x)>=A-1e-9&&v(x)<=B+1e-9);
}
function stdCrown(r,R,z0,up){
  // bout bombé (sphère de rayon R sur l'axe) : du bord (r, z0∓h) au sommet (0, z0)
  const h=R-Math.sqrt(Math.max(0,R*R-r*r)),zc=up?z0-R:z0+R;
  return {edge:[r,up?z0-h:z0+h],top:[0,z0,{c:[0,zc]}],h};
}
/* ── pièces : chaque générateur rend une description {key, name, norm, desig, info, prof?, ops} ──
   prof : profil de révolution [[r,z(,{c})]…] ; ops : [{k:'hex', z, s, t} | {k:'slot', …} | {k:'key', …}] */
function stdScrewCHC(o){
  // o = {d, dk, k, s, t, L, P} en mm
  const c=Math.min(o.P,o.d*0.15),ch=Math.max(0.1,o.dk*0.04);
  return {prof:[[0,-o.L],[o.d/2-c,-o.L],[o.d/2,-o.L+c],[o.d/2,0],[o.dk/2,0],[o.dk/2,o.k-ch],[o.dk/2-ch,o.k],[0,o.k]],
    ops:[{k:'hex',z:o.k,s:o.s,t:o.t}]};
}
function stdScrewFHC(o){
  // o = {d, dk (théorique), k, a (angle de fraisure), s, t, L, P} — tête affleurante en z = 0
  const c=Math.min(o.P,o.d*0.15),dr=o.dk*0.97,tg=Math.tan(o.a/2*Math.PI/180);
  const zb=-o.k,ze=zb+(dr-o.d)/2/tg; // le cône atteint dr un peu sous le dessus : petit méplat cylindrique
  return {prof:[[0,-o.L],[o.d/2-c,-o.L],[o.d/2,-o.L+c],[o.d/2,zb],[dr/2,Math.min(ze,-0.05)],[dr/2,0],[0,0]],
    ops:[{k:'hex',z:0,s:o.s,t:o.t}]};
}
function stdThr(size,P,d,L,b,k,mod){
  // Filetage de la tige (axe Z, tige vers −Z depuis z = −k) : taille connue du filetage seulement
  if(typeof isoThread!=='function'||!isoThread(size))return null;
  const full=L-k<=b+1e-6;
  return {size,p:+(+P).toFixed(4),r:d/2,z:-(k+(L-k)/2),lenMode:full?'full':'len',len:+(+b).toFixed(3),model:!!mod};
}
function stdIsoScrew(st){
  const fhc=st.type==='fhc',T=fhc?STD_ISO10642:STD_ISO4762,r=T.find(x=>x[0]===st.size)||T[0];
  const pas=STD_ISO_PAS[r[0]],P=+st.pitch||pas[0],L=+st.len,fin=Math.abs(P-pas[0])>1e-9;
  const g=fhc?stdScrewFHC({d:r[1],dk:r[2],k:r[3],a:90,s:r[4],t:r[5],L,P}):stdScrewCHC({d:r[1],dk:r[2],k:r[3],s:r[4],t:r[5],L,P});
  const th=r[0]+(fin?'×'+stdF(P):''),norm=fhc?'ISO 10642':'ISO 4762',mod=st.fil==='mod';
  g.thr=stdThr(r[0],P,r[1],L,2*r[1]+12,fhc?r[3]:0,mod); // b = 2d + 12 (ISO 4762 / 10642, L ≤ 125)
  return Object.assign(g,{seat:fhc?'flush':'under',sink:fhc?FHC_RETRAIT:0,key:norm+'|'+th+'|'+L+(mod?'|filet':''),norm,desig:th+'×'+stdF(L),name:(fhc?'FHC ':'CHC ')+th+'×'+stdF(L),
    info:(fhc?'Vis à tête fraisée six pans creux, fraisure 90°':'Vis à tête cylindrique six pans creux')+' · pas '+stdF(P)+(fin?' (fin)':' (gros)')+
      ' · '+(fhc?'Ø tête ':'dk ')+stdF(r[2])+' · k '+stdF(r[3])+' · clé '+stdF(r[4])+' · L '+stdF(L)+(fhc?' (tête comprise)':' (sous tête)')});
}
function stdAnsiScrew(st){
  const fhc=st.type==='fhc',T=fhc?STD_ANSI_FHCS:STD_ANSI_SHCS,r=T.find(x=>x[0]===st.size)||T[0];
  const s3=STD_ANSI_SHCS.find(x=>x[0]===r[0]),serie=st.thr==='UNF'||!s3[6]?'UNF':'UNC',tpi=serie==='UNF'?s3[7]:s3[6];
  const L=stdFrac(st.len),I=STD_IN,P=I/tpi;
  const g=fhc?stdScrewFHC({d:r[1]*I,dk:r[2]*I,k:(r[2]-r[1])/2/Math.tan(41*Math.PI/180)*I,a:82,s:r[3]*I,t:r[4]*I,L:L*I,P})
    :stdScrewCHC({d:r[1]*I,dk:r[2]*I,k:r[3]*I,s:r[4]*I,t:r[5]*I,L:L*I,P});
  const th=r[0]+'-'+tpi+' '+serie,norm=fhc?'ASME B18.3 FHCS':'ASME B18.3 SHCS',mod=st.fil==='mod';
  g.thr=stdThr(th,P,r[1]*I,L*I,(2*r[1]+0.5)*I,fhc?(r[2]-r[1])/2/Math.tan(41*Math.PI/180)*I:0,mod); // LT = 2D + 1/2" (B18.3)
  return Object.assign(g,{seat:fhc?'flush':'under',sink:fhc?FHC_RETRAIT:0,key:norm+'|'+th+'|'+st.len+(mod?'|filet':''),norm,desig:th+' × '+st.len+'"',name:(fhc?'FHCS ':'SHCS ')+th+' × '+st.len+'"',
    info:(fhc?'Flat head socket cap screw, fraisure 82°':'Socket head cap screw')+' · '+tpi+' filets/pouce · Ø '+stdF(r[1]*I)+' mm · L '+stdF(L*I)+' mm'+(fhc?' (tête comprise)':' (sous tête)')});
}
function stdPlug(st){
  if(st.type==='din908'){
    const r=STD_DIN908.find(x=>x[0]===st.size)||STD_DIN908[0],[,d,tpi,dk,k,i,s,t]=r,c=Math.min(STD_IN/tpi,1.5),ch=0.4;
    return {thr:stdThr(r[0].replace(' ',''),STD_IN/tpi,d,i,i,0,false),seat:'under',key:'DIN 908|'+r[0],norm:'DIN 908',desig:r[0]+' A',name:'Bouchon DIN 908 '+r[0],
      info:'Bouchon à collerette, six pans creux, filet cylindrique '+r[0]+' (ISO 228) · Ø collerette '+stdF(dk)+' · k '+stdF(k)+' · filetée '+stdF(i)+' · clé '+stdF(s),
      prof:[[0,-i],[d/2-c,-i],[d/2,-i+c],[d/2,0],[dk/2,0],[dk/2,k-ch],[dk/2-ch,k],[0,k]],ops:[{k:'hex',z:k,s,t}]};
  }
  const npt=st.type==='nptf',r=npt?(STD_NPTF.find(x=>x[0]===st.size)||STD_NPTF[0]):(STD_DIN906.find(x=>x[0]===st.size)||STD_DIN906[0]);
  const I=STD_IN,D=npt?r[1]*I:r[1],tpi=r[2],s=npt?r[3]*I:r[4],L=npt?r[4]*I:r[3],t=npt?L*0.6:r[5];
  const rt=D/2,rb=rt-L/32,c=Math.min(I/tpi*0.6,L*0.12); // conicité 1:16 sur le Ø
  const nm=npt?r[0]+'-'+tpi+' NPTF':r[0];
  return {seat:'flush',key:(npt?'NPTF':'DIN 906')+'|'+r[0],norm:npt?'ASME B1.20.3 NPTF':'DIN 906',desig:nm,name:'Bouchon '+(npt?nm:'DIN 906 '+nm),
    info:'Bouchon conique six pans creux, sans collerette'+(npt?' (Dryseal, conicité 1:16, dimensions de catalogue)':' (ISO 7-1, conicité 1:16)')+' · Ø '+stdF(D)+' · L '+stdF(L)+' · clé '+stdF(s),
    prof:[[0,-L],[rb-c,-L],[rb,-L+c],[rt,0],[0,0]],ops:[{k:'hex',z:0,s,t}]};
}
function stdPin(st){
  // Goupille centrée : origine au MILIEU de sa longueur (V0.21.1) — posée sur un trou, elle
  // s'aligne sur le milieu de l'axe du cylindre (seat 'mid')
  const sp=stdPinBody(st),zs=stdPolyPts(sp.prof).map(p=>p[1]),dz=-(Math.min(...zs)+Math.max(...zs))/2;
  sp.prof=sp.prof.map(q=>{const o=[q[0],q[1]+dz];if(q[2])o.push(Object.assign({},q[2],{c:[q[2].c[0],q[2].c[1]+dz]}));return o;});
  (sp.ops||[]).forEach(o=>{if(o.k==='slot')o.z0=dz;});
  sp.seat='mid';
  return sp;
}
function stdPinBody(st){
  // profil de z = 0 à z = L
  const ty=st.type,ansi=ty==='dowel'||ty==='spring';
  const d=ansi?stdFrac(st.size)*STD_IN:+st.size,L=ansi?stdFrac(st.len)*STD_IN:+st.len,r=d/2;
  const c=ansi?Math.max(0.15,d*0.08):(STD_PIN_C[+st.size]||d*0.15);
  const lab=ansi?st.size+'" × '+st.len+'"':stdF(d)+'×'+stdF(L);
  if(ty==='iso8752'||ty==='spring'){
    const w=ty==='spring'?(STD_ANSI_SPRING.find(x=>x[0]===st.size)||STD_ANSI_SPRING[0])[1]*STD_IN:(STD_ISO8752.find(x=>x[0]===+st.size)||STD_ISO8752[0])[1];
    const ri=r-w,cc=Math.min(w*0.8,c),g=Math.max(0.15,d*0.1);
    const norm=ty==='spring'?'ASME B18.8.2 spring':'ISO 8752';
    return {key:norm+'|'+lab,norm,desig:lab,name:(ty==='spring'?'Spring pin ':'Goupille élastique ISO 8752 ')+lab,
      info:'Goupille élastique fendue · épaisseur '+stdF(w)+' · fente '+stdF(g)+' · Ø '+stdF(d)+' · L '+stdF(L),
      prof:[[ri,0],[r-cc,0],[r,cc],[r,L-cc],[r-cc,L],[ri,L]],ops:[{k:'slot',x0:ri-0.3,x1:r+1,w:g,L}]};
  }
  if(ty==='iso2339'){
    // conique 1:50 : d au petit bout, bouts bombés (R ≈ d)
    const R2=r+L/100,a=stdCrown(r,d,0,false),b=stdCrown(R2,2*R2,L,true);
    return {key:'ISO 2339|'+lab,norm:'ISO 2339',desig:'A '+lab,name:'Goupille conique ISO 2339 '+lab,
      info:'Goupille conique 1:50 · Ø petit bout '+stdF(d)+' · Ø gros bout '+stdF(2*R2)+' · L '+stdF(L),
      prof:[[0,0],a.edge.concat([{c:[0,d]}]),b.edge,b.top],ops:[]};
  }
  if(ty==='iso8734'||ty==='dowel'){
    // trempée : un bout chanfreiné, l'autre bombé
    const b=stdCrown(r,d,L,true);
    const norm=ty==='dowel'?'ASME B18.8.2 dowel':'ISO 8734';
    return {key:norm+'|'+lab,norm,desig:lab,name:(ty==='dowel'?'Dowel pin ':'Goupille ISO 8734 ')+lab,
      info:'Goupille cylindrique trempée, rectifiée (m6) · un bout chanfreiné, un bout bombé · Ø '+stdF(d)+' · L '+stdF(L),
      prof:[[0,0],[r-c,0],[r,c],b.edge,b.top],ops:[]};
  }
  return {key:'ISO 2338|'+lab,norm:'ISO 2338',desig:'m6 '+lab,name:'Goupille ISO 2338 '+lab,
    info:'Goupille cylindrique non trempée (m6) · chanfreins '+stdF(c)+' · Ø '+stdF(d)+' · L '+stdF(L),
    prof:[[0,0],[r-c,0],[r,c],[r,L-c],[r-c,L],[0,L]],ops:[]};
}
function stdKey(st){
  const r=STD_ISO773.find(x=>x[2]+'x'+x[3]===st.size)||STD_ISO773[0],b=r[2],h=r[3],L=+st.len,f=st.type||'A';
  const lab=b+'×'+h+'×'+stdF(L);
  return {key:'ISO 773|'+f+'|'+lab,norm:'ISO 773',desig:f+' '+lab,name:'Clavette '+f+' '+lab,
    info:'Clavette parallèle forme '+f+(f==='A'?' (bouts ronds)':f==='B'?' (bouts droits)':' (un bout rond)')+' · arbre Ø '+r[0]+' à '+r[1]+
      ' · rainure arbre t1 '+stdF(r[4])+' · moyeu t2 '+stdF(r[5]),
    ops:[{k:'key',form:f,b,h,L}]};
}
function stdWasher(st){
  // Rondelle : origine au centre de sa face d'appui (dessous), épaisseur vers +Z — posée « Sur des
  // trous », elle s'assoit sur l'entrée (ou le fond du lamage) ; sur un oblong, voir stdSlots
  const ty=st.type,T=stdWasherRows(ty),r=T.find(x=>x[0]===st.size)||T[0],I=STD_IN;
  const ansi=/^ansi/.test(ty),lock=ty==='din127'||ty==='ansiLock';
  let d1,d2,h,norm,lab;
  if(ty==='din127'){d1=r[1];h=r[2];d2=d1+2*r[3];norm='DIN 127 B';}
  else if(ty==='ansiLock'){d1=r[1]*I;h=r[3]*I;d2=(r[1]+2*r[2])*I;norm='ASME B18.21.1';}
  else if(ansi){const w=ty==='ansiW';d1=r[w?5:2]*I;d2=r[w?6:3]*I;h=r[w?7:4]*I;norm='ASME B18.22.1 Type A '+(w?'W':'N');}
  else{d1=r[1];d2=r[2];h=r[3];norm={iso7090:'ISO 7090',iso7092:'ISO 7092',iso7093:'ISO 7093-1'}[ty]||'ISO 7089';}
  lab=ansi?r[0]+(r[0][0]==='#'?'':'"'):r[0];
  const r1=d1/2,r2=d2/2,dims=' · Ø int. '+stdF(d1)+' · Ø ext. '+stdF(d2)+' · épaisseur '+stdF(h)+(ansi?' mm':'');
  const sp={seat:'under',sink:0,washer:true,key:'WASHER|'+norm+'|'+r[0],norm,desig:lab};
  if(lock){
    const g=Math.max(0.2,h*0.5);
    return Object.assign(sp,{name:(ansi?'Lock washer ':'Rondelle Grower ')+lab,
      info:'Rondelle élastique fendue, section rectangulaire (modélisée à plat, coupe '+stdF(g)+')'+dims,
      prof:[[r1,0],[r2,0],[r2,h],[r1,h]],ops:[{k:'slot',x0:r1-0.3,x1:r2+1,w:g,L:h}]});
  }
  const c=ty==='iso7090'?h*0.25:0;
  return Object.assign(sp,{name:(ansi?'Flat washer ':'Rondelle ')+norm.replace(/^ASME B18\.22\.1 /,'')+' '+lab,
    info:(c?'Rondelle plate chanfreinée':'Rondelle plate')+dims,
    prof:c?[[r1,0],[r2,0],[r2,h-c],[r2-c,h],[r1,h]]:[[r1,0],[r2,0],[r2,h],[r1,h]],ops:[]});
}
function stdKeyOutline(o){
  // contour vu de dessus, centré : forme A (deux bouts ronds), B (droits), C (rond à gauche)
  const hl=o.L/2,r=o.b/2,x0=-hl+r,x1=hl-r;
  if(o.form==='B')return [[-hl,-r],[hl,-r],[hl,r],[-hl,r]];
  if(o.form==='C')return [[x0,-r,{c:[x0,0],ccw:true}],[hl,-r],[hl,r],[x0,r]];
  return [[x0,-r,{c:[x0,0],ccw:true}],[x1,-r],[x1,r,{c:[x1,0],ccw:true}],[x0,r]];
}
function stdIso773For(d){
  // Ligne d'ISO 773 d'un Ø d'arbre (« de plus de … à … » ; la première ligne inclut son début), ou undefined
  return STD_ISO773.find((r,i)=>(i===0?d>=r[0]:d>r[0])&&d<=r[1]);
}
function stdGearBoreOpts(st){
  // Cas de contrôle du champ alésage : plein, et un Ø tenant dans cette roue
  let rf=0;try{rf=gearGeom({m:st.m,z:st.z,alpha:st.alpha,b:st.b||1,x:st.x,beta:st.beta}).rf;}catch(e){rf=0;}
  const v=+(0.8*rf).toFixed(1);
  return v>0?[['0','0'],[String(v),stdF(v)]]:[['0','0']];
}
function stdGear(st){
  // Roue extérieure ou couronne, droite ou hélicoïdale (48-engrenages-calcul) ; le contour sert aussi à l'aperçu
  const o={k:'gear',m:+st.m,z:Math.round(+st.z),alpha:+st.alpha,b:+st.b,x:+st.x||0,beta:+st.beta||0,hand:st.hand==='L'?'L':'R'};
  if(+st.j>0)o.j=+st.j;
  if(+st.ks>0)o.ks=+st.ks;
  const pairKey=(o.j||o.ks)?'|j'+(o.j||0)+'|k'+(o.ks||0):'',pairInfo=o.j?' · dent amincie de '+stdF(o.j)+' mm (jeu de paire)':'';
  if(st.kind==='rack'){o.kind='rack';o.H=+st.H||0;o.x=0;}
  if(st.kind==='int'){o.kind='int';o.D=+st.D||0;}
  const g=gearGeom(o);
  if(g.rack){
    o.H=g.H; // hauteur automatique : la pièce garde sa valeur
    const labR='m'+stdF(g.m)+' Z'+g.z+(g.aDeg===20?'':' α'+stdF(g.aDeg)+'°')+(g.betaDeg?' β'+stdF(g.betaDeg)+'° '+(g.hand==='L'?'G':'D'):'')+' × '+stdF(g.b)+' H'+stdF(g.ya-g.yb);
    return {key:'GEAR|'+[g.m,g.z,g.aDeg,g.b,0,0,0,g.betaDeg,g.betaDeg?g.hand:'R','rack',g.H].join('|')+pairKey,norm:'ISO 53',desig:labR,name:'Crémaillère '+labR,
      info:'Pas '+stdF(g.pt)+' · longueur '+stdF(g.L)+' · hauteur totale '+stdF(g.ya-g.yb)+' · ligne de référence à '+stdF(g.ya)+' mm du sommet des dents'+(g.betaDeg?' · module apparent '+stdF(g.mt):'')+pairInfo,
      checks:gearChecks(g),ops:[o],reach:g.L/2};
  }
  gearProfile(g); // géométrie impossible (plus de flanc…) : refusée dès la fenêtre, avec son motif
  if(g.internal)o.D=g.D; // Ø automatique : la pièce garde sa valeur
  const helixLab=g.betaDeg?' β'+stdF(g.betaDeg)+'° '+(g.hand==='L'?'G':'D'):'';
  if(g.internal){
    const labI='m'+stdF(g.m)+' Z'+g.z+(g.aDeg===20?'':' α'+stdF(g.aDeg)+'°')+helixLab+(g.x?' x'+(g.x>0?'+':'')+stdF(g.x):'')+' × '+stdF(g.b)+' Ø'+stdF(g.D);
    return {key:'GEAR|'+[g.m,g.z,g.aDeg,g.b,g.x,0,0,g.betaDeg,g.betaDeg?g.hand:'R','int',g.D].join('|')+pairKey,norm:'ISO 53 / ISO 21771',desig:labI,name:'Couronne '+labI,
      info:(g.betaDeg?'Module apparent '+stdF(g.mt)+' · main '+(g.hand==='L'?'gauche':'droite')+' · ':'')+'Ø primitif '+stdF(2*g.rp)+' · Ø de tête '+stdF(2*g.ra)+' · Ø de pied '+stdF(2*g.rf)+' · Ø de base '+stdF(2*g.rb)+' · pas '+stdF(g.pitch)+' mm'+pairInfo,
      checks:gearChecks(g),ops:[o],reach:g.D/2};
  }
  // alésage (0 = roue pleine) et rainure de moyeu ISO 773 d'après son Ø
  const d=+st.d||0,row=d>0&&st.kw==='iso'?stdIso773For(d):null,ops=[o],checks=gearChecks(g);
  let bore='',hint='';
  if(d>0){
    const B={k:'bore',d,b:row?row[2]:0,t2:row?row[5]:0,w:g.b};
    checks.push(...gearBoreChecks(g,B));ops.push(B);
    bore=' Ø'+stdF(d)+(row?' rainure '+stdF(row[2])+'×'+stdF(row[5]):'');
    if(row)hint=' · clavette '+stdF(row[2])+'×'+stdF(row[3]);
  }
  const lab='m'+stdF(g.m)+' Z'+g.z+(g.aDeg===20?'':' α'+stdF(g.aDeg)+'°')+helixLab+(g.x?' x'+(g.x>0?'+':'')+stdF(g.x):'')+' × '+stdF(g.b)+bore;
  return {key:'GEAR|'+[g.m,g.z,g.aDeg,g.b,g.x,d,row?row[2]:0,g.betaDeg,g.betaDeg?g.hand:'R'].join('|')+pairKey,norm:'ISO 53 / ISO 21771'+(row?' / ISO 773':''),desig:lab,name:'Engrenage '+lab,
    info:(g.betaDeg?'Module apparent '+stdF(g.mt)+' · main '+(g.hand==='L'?'gauche':'droite')+' · ':'')+'Ø primitif '+stdF(2*g.rp)+' · Ø de tête '+stdF(2*g.ra)+' · Ø de pied '+stdF(2*g.rf)+' · Ø de base '+stdF(2*g.rb)+' · pas '+stdF(g.pitch)+' mm'+hint+pairInfo,
    checks,ops,reach:g.ra};
}
function stdGearPair(st){
  // Paire : deux pièces d'engrenage ordinaires (onglet Engrenages), posées au bon entraxe, dents logées
  const P=gearPair({kind:st.kind,m:st.m,alpha:st.alpha,beta:st.beta,hand:st.hand,z1:st.z1,z2:st.z2,x1:st.x1,x2:st.x2,b:st.b,jn:st.jn});
  const part=(O,kind,d)=>{
    const s={kind,m:String(O.m),z:String(O.z),alpha:String(O.alpha),b:String(O.b),x:String(O.x||0),beta:String(O.beta||0),hand:O.hand};
    if(O.j)s.j=String(O.j);
    if(O.ks)s.ks=String(O.ks);
    if(d>0)s.d=String(d);
    return stdSpec('gear',s);
  };
  const sp1=part(P.o1,'ext',+st.d1||0),sp2=part(P.o2,P.kind,P.kind==='ext'?(+st.d2||0):0);
  (sp1.checks||[]).concat(sp2.checks||[]).forEach(c=>{if(/Paroi|Roue plus étroite/.test(c.txt)&&c.lvl==='warn')P.checks.push(c);});
  const lab='m'+stdF(P.g1.m)+' Z'+P.g1.z+'/'+P.g2.z+(P.g1.aDeg===20?'':' α'+stdF(P.g1.aDeg)+'°')+(P.g1.betaDeg?' β'+stdF(P.g1.betaDeg)+'°':'')+' × '+stdF(P.g1.b);
  const nm={ext:'Paire ',int:'Pignon et couronne ',rack:'Pignon et crémaillère '}[P.kind]+lab;
  const dist=P.kind==='rack'?'Hauteur de l’axe du pignon '+stdF(P.a)+' mm au-dessus de la ligne de référence':'Entraxe '+stdF(+P.a.toFixed(3))+' mm';
  return {key:'GEARPAIR|'+[sp1.key,sp2.key].join('|'),norm:'ISO 53 / ISO 21771',desig:lab,name:nm,
    info:dist+(P.ratio?' · rapport '+stdF(+P.ratio.toFixed(3)):'')+' · angle de fonctionnement '+stdF(+P.awDeg.toFixed(2))+'°'+(P.g1.betaDeg?' · pignon main '+(P.hand1==='L'?'gauche':'droite')+', '+(P.kind==='int'?'couronne':P.kind==='rack'?'crémaillère':'roue')+' main '+(P.hand2==='L'?'gauche':'droite'):''),
    checks:P.checks,ops:[],pair:[{sp:sp1,fr:P.fr1,o:P.o1},{sp:sp2,fr:P.fr2,o:P.o2}],reach:P.reach,calc:P};
}
/* ── catégories de la fenêtre : champs (options selon l'état) et générateur ── */
const STD_CATS=[
  {k:'iso',lab:'Vis ISO',fields:[
    {k:'type',lab:'Type',opts:()=>[['chc','CHC — ISO 4762 (tête cylindrique)'],['fhc','FHC — ISO 10642 (tête fraisée 90°)']]},
    {k:'size',lab:'Taille',opts:st=>(st.type==='fhc'?STD_ISO10642:STD_ISO4762).map(r=>[r[0],r[0]]),def:()=>'M6'},
    {k:'pitch',lab:'Pas',opts:st=>(STD_ISO_PAS[st.size]||[1]).map((p,i)=>[String(p),stdF(p)+(i?' — fin':' — gros (M)')])},
    {k:'len',lab:'Longueur (mm)',opts:st=>{const r=(st.type==='fhc'?STD_ISO10642:STD_ISO4762).find(x=>x[0]===st.size);
      return r?stdLens(STD_ISO_LV,r[6],r[7],true).map(v=>[String(v),stdF(v)]):[];},def:st=>{const r=(st.type==='fhc'?STD_ISO10642:STD_ISO4762).find(x=>x[0]===st.size);return r?String(stdLens(STD_ISO_LV,Math.max(r[6],3*r[1]),r[7],true)[0]||r[6]):'';}},
    {k:'fil',lab:'Filet',opts:()=>[['cos','Cosmétique (spirale dessinée)'],['mod','Modélisé (profil ISO, impression 3D)']]}],
    gen:stdIsoScrew},
  {k:'ansi',lab:'Vis ANSI',fields:[
    {k:'type',lab:'Type',opts:()=>[['chc','SHCS — tête cylindrique (B18.3)'],['fhc','FHCS — tête fraisée 82° (B18.3)']]},
    {k:'size',lab:'Taille',opts:st=>(st.type==='fhc'?STD_ANSI_FHCS:STD_ANSI_SHCS).map(r=>[r[0],r[0]]),def:()=>'1/4'},
    {k:'thr',lab:'Filetage',opts:st=>{const r=STD_ANSI_SHCS.find(x=>x[0]===st.size)||STD_ANSI_SHCS[0];
      return (r[6]?[['UNC','UNC — '+r[6]+' filets/pouce']]:[]).concat([['UNF','UNF — '+r[7]+' filets/pouce']]);}},
    {k:'len',lab:'Longueur (po)',opts:st=>{const r=(st.type==='fhc'?STD_ANSI_FHCS:STD_ANSI_SHCS).find(x=>x[0]===st.size);
      if(!r)return [];const n=r.length;return stdLens(STD_INCH_LV,r[n-2],r[n-1]).map(v=>[v,v+'"']);},
      def:st=>{const r=(st.type==='fhc'?STD_ANSI_FHCS:STD_ANSI_SHCS).find(x=>x[0]===st.size);if(!r)return '';
        const n=r.length,l=stdLens(STD_INCH_LV,r[n-2],r[n-1]);return l.find(v=>stdFrac(v)>=3*r[1])||l[0];}},
    {k:'fil',lab:'Filet',opts:()=>[['cos','Cosmétique (spirale dessinée)'],['mod','Modélisé (profil ISO, impression 3D)']]}],
    gen:stdAnsiScrew},
  {k:'plug',lab:'Bouchons gaz',fields:[
    {k:'type',lab:'Type',opts:()=>[['din906','DIN 906 — conique R (sans collerette)'],['din908','DIN 908 — cylindrique G, à collerette'],['nptf','NPTF — conique (ANSI)']]},
    {k:'size',lab:'Taille',opts:st=>(st.type==='din908'?STD_DIN908:st.type==='nptf'?STD_NPTF:STD_DIN906).map(r=>[r[0],st.type==='nptf'?r[0]+'" — '+r[2]+' filets/pouce':r[0]+' — '+r[2]+' filets/pouce'])}],
    gen:stdPlug},
  {k:'pin',lab:'Goupilles',fields:[
    {k:'type',lab:'Norme',opts:()=>[['iso2338','ISO 2338 — cylindrique m6'],['iso8734','ISO 8734 — cylindrique trempée'],
      ['iso2339','ISO 2339 — conique 1:50'],['iso8752','ISO 8752 — élastique fendue'],['dowel','ANSI B18.8.2 — dowel pin trempée'],['spring','ANSI B18.8.2 — spring pin fendue']]},
    {k:'size',lab:'Diamètre',opts:st=>stdPinRows(st.type).map(r=>[String(r[0]),typeof r[0]==='string'?r[0]+'"':stdF(r[0])+' mm']),
      def:st=>{const t=stdPinRows(st.type);return String((t.find(r=>(typeof r[0]==='string'?stdFrac(r[0])*STD_IN:r[0])>=5.5)||t[0])[0]);}},
    {k:'len',lab:'Longueur',opts:st=>{const t=stdPinRows(st.type),r=t.find(x=>String(x[0])===st.size);if(!r)return [];
      const n=r.length;return typeof r[0]==='string'?stdLens(STD_INCH_LV,r[n-2],r[n-1]).map(v=>[v,v+'"']):stdLens(STD_PIN_LV,r[n-2],r[n-1],true).map(v=>[String(v),stdF(v)+' mm']);},
      def:st=>{const t=stdPinRows(st.type),r=t.find(x=>String(x[0])===st.size);if(!r)return '';const n=r.length,ins=typeof r[0]==='string',d=ins?stdFrac(r[0]):r[0];
        const l=ins?stdLens(STD_INCH_LV,r[n-2],r[n-1]):stdLens(STD_PIN_LV,r[n-2],r[n-1],true).map(String);return l.find(v=>stdFrac(v)>=4*d)||l[l.length-1];}}],
    gen:stdPin},
  {k:'key',lab:'Clavettes',fields:[
    {k:'type',lab:'Forme',opts:()=>[['A','A — bouts ronds'],['B','B — bouts droits'],['C','C — un bout rond']]},
    {k:'size',lab:'b × h (arbre)',opts:()=>STD_ISO773.map(r=>[r[2]+'x'+r[3],r[2]+' × '+r[3]+'  (arbre Ø '+r[0]+' à '+r[1]+')']),def:()=>'8x7'},
    {k:'len',lab:'Longueur (mm)',opts:st=>{const r=STD_ISO773.find(x=>x[2]+'x'+x[3]===st.size);
      return r?stdLens(STD_KEY_LV,r[6],r[7],true).map(v=>[String(v),stdF(v)]):[];},
      def:st=>{const r=STD_ISO773.find(x=>x[2]+'x'+x[3]===st.size);return r?String(stdLens(STD_KEY_LV,Math.max(r[6],4*r[2]),r[7],true)[0]||r[6]):'';}}],
    gen:stdKey},
  {k:'washer',lab:'Rondelles',fields:[
    {k:'type',lab:'Norme',opts:()=>STD_WASHER_TYPES},
    {k:'size',lab:'Taille (vis)',opts:st=>stdWasherRows(st.type).map(r=>[r[0],/^ansi/.test(st.type)?r[0]+(r[0][0]==='#'?'':'"'):r[0]]),
      def:st=>/^ansi/.test(st.type)?'1/4':'M8'}],
    gen:stdWasher},
  {k:'insert',lab:'Douilles autotaraudeuses',fields:[
    {k:'type',lab:'Série',opts:()=>[['iso','Ensat 302 — métrique (taraudage M, 6H)'],['ansi','Ensat 302 — pouces (taraudage UNC / UNF)']]},
    {k:'size',lab:'Taraudage',opts:st=>st.type==='ansi'?STD_ENSAT302_IN.map(r=>[r[0],r[0]+(r[0][0]==='#'?'':'"')+' — corps Ø'+stdF(r[3])+' × '+stdF(r[4])]):
      STD_ENSAT302.map(r=>[r[0],r[1]+(r[0]==='M6c'?' court':'')+' — corps Ø'+stdF(r[2])+' × '+stdF(r[3])+', L '+stdF(r[4])]),def:st=>st.type==='ansi'?'1/4':'M6'},
    {k:'thr',lab:'Filetage intérieur',show:st=>st.type==='ansi',opts:st=>{const r=STD_ENSAT302_IN.find(x=>x[0]===st.size);
      return r?[['UNC','UNC — '+r[1]+' filets/pouce'],['UNF','UNF — '+r[2]+' filets/pouce']]:[['UNC','UNC']];}}],
    gen:stdInsert302},
  // num : valeur libre tapée dans la fenêtre (bornée) ; opts = quelques cas de contrôle (tests), sug = valeurs proposées
  // show : champ masqué sans objet pour ces réglages (il reprend alors sa valeur par défaut)
  {k:'gear',lab:'Engrenages',fields:[
    {k:'kind',lab:'Denture',opts:()=>[['ext','Extérieure (roue)'],['int','Intérieure (couronne)'],['rack','Crémaillère']]},
    {k:'m',lab:'Module (mm)',num:{min:0.1,max:50,step:0.05},sug:()=>GEAR_MODULES,opts:()=>[['0.5','0,5'],['2','2'],['10','10']],def:()=>'2'},
    {k:'z',lab:'Nombre de dents',num:{min:6,max:500,step:1,int:true},opts:st=>(st.kind==='int'?['24','60','200']:st.kind==='rack'?['6','30']:['6','20','60','200']).map(v=>[v,v]),def:()=>'20'},
    {k:'alpha',lab:'Angle de pression',opts:()=>[['20','20° (usuel)'],['14.5','14,5°'],['25','25°']]},
    {k:'beta',lab:'Angle d’hélice β (0 = denture droite)',num:{min:0,max:45,step:1},opts:()=>[['0','0'],['15','15']],def:()=>'0'},
    {k:'hand',lab:'Sens de l’hélice',opts:st=>+st.beta>0?[['R','Main droite'],['L','Main gauche']]:[['R','— (pas d’hélice)']]},
    {k:'x',lab:'Déport x (en modules, 0 = aucun)',num:{min:-1,max:2,step:0.05},opts:()=>[['-0.3','−0,3'],['0','0'],['0.2','0,2']],def:()=>'0',show:st=>st.kind!=='rack'},
    {k:'b',lab:'Largeur (mm)',num:{min:0.1,max:2000,step:0.5},opts:()=>[['5','5'],['20','20'],['100','100']],def:()=>'20'},
    {k:'H',lab:'Hauteur du corps sous les dents (mm, 0 = automatique)',num:{min:0,max:2000,step:0.5},opts:()=>[['0','0']],def:()=>'0',show:st=>st.kind==='rack'},
    {k:'D',lab:'Ø extérieur de la couronne (mm, 0 = automatique)',num:{min:0,max:10000,step:0.5},opts:()=>[['0','0']],def:()=>'0',show:st=>st.kind==='int'},
    {k:'d',lab:'Alésage Ø (mm, 0 = roue pleine)',num:{min:0,max:5000,step:0.5},opts:stdGearBoreOpts,def:()=>'0',show:st=>st.kind==='ext'},
    {k:'kw',lab:'Rainure de clavette',show:st=>st.kind==='ext',opts:st=>{
      const d=+st.d||0,r=stdIso773For(d),none=d>0?'Sans rainure':'— (pas d’alésage)';
      return (r?[['iso','ISO 773 : largeur '+stdF(r[2])+', profondeur '+stdF(r[5])+' (clavette '+stdF(r[2])+'×'+stdF(r[3])+')']]:[]).concat([['none',none]]);
    }}],
    gen:stdGear},
  {k:'gearPair',lab:'Paire d’engrenages',fields:[
    {k:'kind',lab:'Le pignon engrène avec',opts:()=>[['ext','Une roue extérieure'],['int','Une couronne intérieure'],['rack','Une crémaillère']]},
    {k:'m',lab:'Module (mm)',num:{min:0.1,max:50,step:0.05},sug:()=>GEAR_MODULES,opts:()=>[['2','2']],def:()=>'2'},
    {k:'z1',lab:'Dents du pignon',num:{min:6,max:500,step:1,int:true},opts:()=>[['20','20']],def:()=>'20'},
    {k:'z2',lab:'Dents de l’autre pièce',num:{min:6,max:500,step:1,int:true},opts:st=>st.kind==='int'?[['60','60']]:st.kind==='rack'?[['30','30']]:[['40','40']],def:()=>'40'},
    {k:'alpha',lab:'Angle de pression',opts:()=>[['20','20° (usuel)'],['14.5','14,5°'],['25','25°']]},
    {k:'beta',lab:'Angle d’hélice β (0 = denture droite)',num:{min:0,max:45,step:1},opts:()=>[['0','0'],['15','15']],def:()=>'0'},
    {k:'hand',lab:'Sens d’hélice du pignon (l’autre pièce s’en déduit)',opts:st=>+st.beta>0?[['R','Main droite'],['L','Main gauche']]:[['R','— (pas d’hélice)']]},
    {k:'x1',lab:'Déport du pignon (en modules)',num:{min:-1,max:2,step:0.05},opts:()=>[['0','0'],['0.3','0,3']],def:()=>'0'},
    {k:'x2',lab:'Déport de l’autre pièce (en modules)',num:{min:-1,max:2,step:0.05},opts:()=>[['0','0']],def:()=>'0',show:st=>st.kind!=='rack'},
    {k:'b',lab:'Largeur (mm)',num:{min:0.1,max:2000,step:0.5},opts:()=>[['20','20']],def:()=>'20'},
    {k:'jn',lab:'Jeu entre flancs (mm, 0 = aucun)',num:{min:0,max:50,step:0.01},opts:()=>[['0','0'],['0.1','0,1']],def:()=>'0.1'},
    {k:'d1',lab:'Alésage du pignon Ø (mm, 0 = plein)',num:{min:0,max:5000,step:0.5},opts:()=>[['0','0']],def:()=>'0'},
    {k:'d2',lab:'Alésage de la roue Ø (mm, 0 = pleine)',num:{min:0,max:5000,step:0.5},opts:()=>[['0','0']],def:()=>'0',show:st=>st.kind==='ext'}],
    gen:stdGearPair},
  // V0.57.0 : aimants permanents, articles réels du catalogue (48-aimants-catalogue, 48-aimants-interface)
  {k:'magnet',lab:'Aimants',fields:[
    {k:'shape',lab:'Forme',opts:()=>MAG_SHAPES},
    {k:'grade',lab:'Nuance',opts:magGradeOpts,def:()=>'*'},
    {k:'art',lab:'Article',opts:magArtOpts,def:magArtDef}],
    gen:magSpec}
];
function stdPinRows(t){
  return t==='iso8734'?STD_ISO8734:t==='iso2339'?STD_ISO2339:t==='iso8752'?STD_ISO8752:t==='dowel'?STD_ANSI_DOWEL:t==='spring'?STD_ANSI_SPRING:STD_ISO2338;
}
function stdCat(k){return STD_CATS.find(c=>c.k===k)||STD_CATS[0];}
function stdNormState(cat,st){
  // Chaque champ garde sa valeur si elle reste proposée, sinon reprend sa valeur par défaut
  const C=stdCat(cat),o=Object.assign({},st||{});
  C.fields.forEach(f=>{
    if(f.show&&!f.show(o))delete o[f.k]; // sans objet : valeur par défaut
    if(f.num){
      // valeur libre : bornée ; illisible ou absente, elle reprend sa valeur par défaut
      let v=parseFloat(String(o[f.k]).replace(',','.'));
      if(!isFinite(v))v=+f.def(o);
      if(f.num.int)v=Math.round(v);
      o[f.k]=String(Math.min(f.num.max,Math.max(f.num.min,v)));
      return;
    }
    const op=f.opts(o);
    if(!op.some(x=>x[0]===o[f.k])){const d=f.def?f.def(o):null;o[f.k]=op.some(x=>x[0]===d)?d:(op[0]?op[0][0]:'');}
  });
  return o;
}
function stdSpec(cat,st){
  // Pièce d'après les réglages de la fenêtre ; cat / st la suivent (doc.std : « Modifier… » la rouvre)
  const C=stdCat(cat),s=stdNormState(C.k,st),sp=C.gen(s);
  sp.cat=C.k;sp.st=s;return sp;
}
function stdStateOf(std){
  // Réglages {cat, st} d'une pièce : enregistrés (V0.21.1), sinon retrouvés par sa clé (pièces V0.21.0)
  if(!std||typeof std.key!=='string')return null;
  if(std.st&&typeof std.st==='object'&&STD_CATS.some(c=>c.k===std.cat))return {cat:std.cat,st:stdNormState(std.cat,std.st)};
  let hit=null;
  STD_CATS.some(C=>{
    const walk=(i,st)=>{
      if(hit)return;
      if(i===C.fields.length){try{if(C.gen(st).key===std.key)hit={cat:C.k,st};}catch(e){}return;}
      const f=C.fields[i];
      f.opts(st).forEach(o=>{if(!hit)walk(i+1,Object.assign({},st,{[f.k]:o[0]}));});
    };
    walk(0,{});return !!hit;
  });
  return hit;
}
/* ── document du composant : esquisses + fonctions ── */
function stdSketch(d,name,plane,off){
  const s={id:uid('sk'),name,plane,entities:[],points:{},constraints:[],dims:[],seq:1,visible:false,origin:[0,0,0]};
  ensureSketchBasis(s);s.origin=s.axN.map(v=>v*(off||0));
  d.sketches.push(s);return s;
}
function stdLoop(s,pts){
  // Contour fermé : sommets [x,y] ; [x,y,{c:[cx,cy], ccw?}] = arc de centre c du sommet précédent
  // jusqu'à celui-ci (sens donné, sinon le petit arc). Les arcs d'esquisse vont de pa à pb en sens direct.
  const ids=pts.map(p=>addPoint(s,p[0],p[1]));
  pts.forEach((q,j)=>{
    const i=(j+pts.length-1)%pts.length,p=pts[i],a=ids[i],b=ids[j];
    if(q[2]&&q[2].c){
      const c=q[2].c,pc=addPoint(s,c[0],c[1]),r=Math.hypot(q[0]-c[0],q[1]-c[1]);
      const ccw=q[2].ccw!=null?q[2].ccw:((p[0]-c[0])*(q[1]-c[1])-(p[1]-c[1])*(q[0]-c[0]))>0;
      s.entities.push({id:skNewEid(s),t:'arc',pc,pa:ccw?a:b,pb:ccw?b:a,r});
    }else s.entities.push({id:skNewEid(s),t:'line',p1:a,p2:b});
  });
}
function stdDoc(sp){
  // Pièce complète : un corps (matière : l'acier par défaut, 48-composants-inspection), fiche normalisée (doc.std)
  const d=asmEmptyDoc(sp.name);
  d.bodies=[{id:'b1',name:sp.name,c:null}];d.bodySeq=2;d.activeBody='b1';
  d.std={key:sp.key,norm:sp.norm,desig:sp.desig};
  if(sp.cat&&sp.st){d.std.cat=sp.cat;d.std.st=Object.assign({},sp.st);}
  if(sp.mag)d.std.mag=sp.mag; // aimant : géométrie et caractéristiques (48-aimants-interface)
  if(sp.mat)d.mat=sp.mat;
  if(sp.color!=null)d.bodies[0].color=sp.color;
  const F=(f)=>{f.id=uid(f.type==='revolve'?'rv':f.type==='xthread'?'th':f.type==='gear'?'gr':f.type==='hole'?'ho':'ex');f.visible=true;f.body='b1';d.features.push(f);return f;};
  if(sp.mag&&sp.mag.s){magFillDoc(d,sp.mag);return d;} // aimant : deux moitiés, pôle sud vert, pôle nord rouge (48-aimants-interface)
  if(sp.prof){
    const s=stdSketch(d,'Profil','XZ',0);stdLoop(s,sp.prof);
    F({type:'revolve',name:'Révolution',sketchId:s.id,axis:{k:'sys',d:'Z'},angle:360,op:'add'});
  }
  if(sp.prof&&sp.thr){
    // V0.35.0 : filetage de la tige (76-filetage), départ au bout libre (pointe)
    const t=sp.thr,f={type:'xthread',name:'',cyl:{c:[0,0,0],u:[0,0,1],r:+t.r.toFixed(6),p:[+t.r.toFixed(6),0,+t.z.toFixed(6)]},
      size:t.size,p:t.p,lh:false,model:!!t.model,clear:0,lenMode:t.lenMode,len:t.len,flip:false,visible:true};
    try{f.name=threadName(f);}catch(e){f.name='Filetage '+t.size;}
    F(f);
  }
  (sp.ops||[]).forEach(o=>{
    if(o.k==='hex'){
      // au-dessus du dessus (0,5 mm) : la découpe ne part pas d'une face confondue
      const s=stdSketch(d,'Six pans creux','XY',o.z+0.5);stdLoop(s,stdHex(o.s));
      F({type:'extrude',name:'Six pans creux '+stdF(o.s),sketchId:s.id,distance:-(o.t+0.5),op:'cut',mid:false,upto:null});
    }else if(o.k==='slot'){
      // open : fente ouverte au bas (z0) seulement, arrêtée net à z0 + L (douille Ensat)
      const s=stdSketch(d,'Fente','XY',(o.z0||0)-1),g=o.w/2;stdLoop(s,[[o.x0,-g],[o.x1,-g],[o.x1,g],[o.x0,g]]);
      F({type:'extrude',name:o.open?'Fente de coupe':'Fente',sketchId:s.id,distance:o.L+(o.open?1:2),op:'cut',mid:false,upto:null});
    }else if(o.k==='hole'){
      // taraudage débouchant depuis le dessus (z = 0), fraisure d'entrée, filet cosmétique (76-percage)
      const s=stdSketch(d,'Taraudage','XY',0),pid=addPoint(s,0,0);s.entities.push({id:skNewEid(s),t:'cpoint',p:pid,hole:true});
      F({type:'hole',name:'',sketchId:s.id,kind:o.csD?'csink':'simple',d:o.d,thread:{size:o.size,p:o.p,len:o.len,model:false,clear:0,lh:false},
        cbD:o.d+2,cbH:1,csD:o.csD||o.d+1,csA:90,end:'through',depth:o.len,tip:0,flip:false,op:'cut'});
      d.features[d.features.length-1].name='Taraudage '+o.size+' débouchant, fraisé Ø'+stdF(o.csD||o.d+1);
    }else if(o.k==='key'){
      const s=stdSketch(d,'Contour','XY',0);stdLoop(s,stdKeyOutline(o));
      F({type:'extrude',name:'Clavette',sketchId:s.id,distance:o.h,op:'add',mid:false,upto:null});
    }else if(o.k==='gear'){
      const fg=F({type:'gear',name:'Denture',m:o.m,z:o.z,alpha:o.alpha,b:o.b,x:o.x,beta:o.beta,hand:o.hand,op:'add'});
      if(o.kind==='int'){fg.kind='int';fg.D=o.D;}
      if(o.kind==='rack'){fg.kind='rack';fg.H=o.H;}
      if(o.j)fg.j=o.j;
      if(o.ks)fg.ks=o.ks;
    }else if(o.k==='mbox'){
      const s=stdSketch(d,'Contour','XY',0),a=o.a/2,b=o.b/2;stdLoop(s,[[-a,-b],[a,-b],[a,b],[-a,b]]);
      F({type:'extrude',name:'Aimant',sketchId:s.id,distance:o.h,op:'add',mid:false,upto:null});
    }else if(o.k==='bore'){
      // sous la roue, et débouchant au-dessus : la découpe ne part pas d'une face confondue
      const s=stdSketch(d,'Alésage','XY',-1);
      if(o.b)stdLoop(s,gearBoreLoop(o));
      else s.entities.push({id:skNewEid(s),t:'circle',pc:addPoint(s,0,0),r:o.d/2});
      F({type:'extrude',name:o.b?'Alésage et rainure':'Alésage',sketchId:s.id,distance:o.w+2,op:'cut',mid:false,upto:null});
    }
  });
  return d;
}
/* ── insertion dans l'assemblage ── */
function stdAddOcc(sp,ownerId,fr){
  // Modèle seul : occurrence de la pièce dans le porteur (composant neuf, ou nouvelle
  // occurrence d'une pièce identique déjà là) → {occ, fresh} ou null
  asmEnsure();
  const owner=asmComp(ownerId||asm.active);if(!owner)return null;
  const same=asm.comps.find(c=>c.doc&&c.doc.std&&c.doc.std.key===sp.key&&asmCanPlace(c.id,owner.id));
  if(same){const o=asmAddOcc(same.id,fr,owner.id);return o?{occ:o,fresh:false}:null;}
  asmPush('normalisé « '+sp.name+' »');
  const c={id:uid('cp'),kind:'comp',name:sp.name,doc:stdDoc(sp),occ:[],link:null};
  const L=asmLinkOwner(owner);if(L)c.of=L.id; // dans un composant lié : il en fait partie
  asm.comps.push(c);
  const o=asmNewOccObj(c.id,sp.name+':1',fr?asmRound(fr):asmFr0());
  owner.occ.push(o);
  asmResolve();
  return {occ:o,fresh:true};
}
function stdInsert(sp){
  // Commande : mode Placer, pièce posée à droite de ce qui est affiché, sélectionnée
  if(typeof skEdit!=='undefined'&&skEdit){try{faceEl.textContent='Fermez d’abord l’esquisse.';}catch(e){}return null;}
  asmEnsure();
  if(asmMode!=='asm')asmEnter();
  const owner=asmActiveComp();if(!owner)return null;
  if(sp.pair)return stdInsertPair(sp,owner);
  let dx=0;try{const box=new THREE.Box3();asmSceneGet().getObjectByName('asmOcc').traverse(m=>{if(m.isMesh)box.expandByObject(m);});if(!box.isEmpty())dx=box.max.x+20+(sp.reach||0);}catch(e){} // reach : rayon d'une grande pièce centrée sur son origine
  const r=stdAddOcc(sp,owner.id,{o:[dx,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]});if(!r)return null;
  if(r.fresh){try{asmBuildSnapshots();}catch(e){}}
  asmSelId=r.occ.id;
  asmNotify();
  try{faceEl.textContent=(r.fresh?'Inséré « ':'Nouvelle occurrence « ')+r.occ.name+' » dans « '+owner.name+' ». Placez-la, ou alignez un point d’accroche.';}catch(e){}
  return r.occ;
}
function stdInsertPair(sp,owner){
  // Les deux pièces au bon entraxe, à droite de ce qui est affiché ; un seul Ctrl+Z retire le tout
  let dx=0;try{const box=new THREE.Box3();asmSceneGet().getObjectByName('asmOcc').traverse(m=>{if(m.isMesh)box.expandByObject(m);});if(!box.isEmpty())dx=box.max.x+20+(sp.reach||0);}catch(e){}
  const n0=asmUndoStack.length,occs=[];
  sp.pair.forEach(P=>{
    const fr=Object.assign({},P.fr,{o:[P.fr.o[0]+dx,P.fr.o[1],P.fr.o[2]]}),r=stdAddOcc(P.sp,owner.id,fr);
    if(r)occs.push(r.occ);
  });
  while(asmUndoStack.length>n0+1)asmUndoStack.pop();
  try{asmBuildSnapshots();}catch(e){}
  if(occs[0])asmSelId=occs[0].id;
  asmNotify();
  try{faceEl.textContent='« '+sp.name+' » insérée : dents logées, au bon entraxe. Les deux pièces restent libres : déplacez-les ensemble.';}catch(e){}
  return occs[0]||null;
}
/* ── trous d'une pièce (faces exactes, 48-assemblage-accroches : asmSnapExtract) ──
   Entrée d'un trou = cercle d'une face plane qui est un bord INTÉRIEUR (la face déborde du
   cercle de tous côtés — le dessus d'un tenon, lui, s'arrête au cercle) et qu'aucun cercle
   coaxial du même côté ne domine (le fond d'un lamage n'est pas une entrée). Le trou est décrit
   par ses cylindres coaxiaux contigus depuis l'entrée : [r, profondeur début, fin]. */
function stdHoles(G){
  const V=asmV,out=[],circ=[],cyl=[];
  const key=v=>v.map(x=>x.toFixed(3)).join(',');
  (G&&G.faces||[]).forEach(F=>{
    if(F.k==='cyl'){
      const k=key(F.l)+'|'+key(F.n)+'|'+F.r.toFixed(3)+'|'+F.t[0].toFixed(3)+'|'+F.t[1].toFixed(3);
      if(!cyl.some(q=>q.k===k))cyl.push({k,F});
      return;
    }
    const [u0,u1,v0,v1]=F.rect;
    F.edges.forEach(e=>{
      if(e.k!=='circ'||Math.abs(V.dot(e.n,F.n))<0.999)return;
      const q=V.sub(e.c,F.c),u=V.dot(q,F.x),v=V.dot(q,F.y);
      if(Math.min(u1-u,u-u0,v1-v,v-v0)<e.r+0.01)return; // pas un bord intérieur
      const twin=circ.find(c=>c.F===F&&V.len(V.sub(c.c,e.c))<1e-3&&Math.abs(c.r-e.r)<1e-3);
      if(twin){twin.full=true;return;} // demi-cercles : un cercle entier
      circ.push({F,e,c:e.c,r:e.r,n:F.n,full:!!e.full}); // full : cercle entier (pas le bout d'un oblong)
    });
  });
  // profondeur (le long de −n) sous le plan d'entrée, et distance à l'axe
  const depth=(E,p)=>-V.dot(V.sub(p,E.c),E.n);
  const off=(E,p)=>{const w=V.sub(p,E.c);return V.len(V.sub(w,V.mul(E.n,V.dot(w,E.n))));};
  circ.forEach(E=>{
    const co=circ.filter(o=>o!==E&&V.dot(o.n,E.n)>0.999&&off(E,o.c)<0.01);
    if(co.some(o=>depth(E,o.c)<-0.01))return; // dominé : fond de lamage
    const cs=cyl.map(q=>q.F).filter(F=>Math.abs(V.dot(F.n,E.n))>0.999&&off(E,F.l)<0.01).map(F=>{
      const a=depth(E,V.add(F.l,V.mul(F.n,F.t[0]))),b=depth(E,V.add(F.l,V.mul(F.n,F.t[1])));
      return {r:F.r,d0:Math.min(a,b),d1:Math.max(a,b),F};
    }).filter(c=>c.d1>0.01).sort((a,b)=>a.d0-b.d0);
    // cylindres contigus depuis l'entrée (un fraisage laisse un cône, hors liste, au début)
    const seg=[];
    for(const c of cs){
      const prev=seg.length?seg[seg.length-1].d1:(c.r<E.r-0.01?c.d0:0);
      if(Math.abs(c.d0-prev)>0.02||c.r>E.r+0.01)break;
      seg.push(c);
    }
    if(!seg.length)return;
    const kind=seg[0].r<E.r-0.01?'csink':(seg.length>1&&seg[1].r<seg[0].r-0.01)?'cbore':'simple';
    let seat=E;
    if(kind==='cbore'){
      const s1=co.find(o=>Math.abs(depth(E,o.c)-seg[0].d1)<0.02&&Math.abs(o.r-seg[1].r)<0.01);
      if(s1)seat=s1;
    }
    const f=v=>(+v).toFixed(2);
    const main=seg[kind==='cbore'?1:0]; // cylindre du trou proprement dit (sous le lamage)
    out.push({E,seat,kind,n:E.n,r:main.r,cyl:main.F,d0:main.d0,d1:main.d1,
      sig:kind+'|'+f(E.r)+'|'+seg.map(c=>f(c.r)+':'+f(c.d0)+':'+f(c.d1)).join(';')});
  });
  return out;
}
function stdHoleAt(H,p,look){
  // Trou sous un point (coordonnées du composant) : le plus proche de son axe ; un débouchant a
  // deux entrées sur le même axe — look (direction du regard) retient celle tournée vers l'œil
  let best=null;
  H.forEach(h=>{
    const w=asmV.sub(p,h.E.c),d=-asmV.dot(w,h.n),lat=asmV.len(asmV.add(w,asmV.mul(h.n,d)));
    if(d<-0.6||lat>h.E.r+0.6)return;
    const sc=lat+(look&&asmV.dot(h.n,look)>0?1e3:0);
    if(!best||sc<best.sc)best={h,sc};
  });
  return best&&best.h;
}
function stdSameHoles(H,h){return H.filter(q=>q.sig===h.sig&&asmV.dot(q.n,h.n)>0.999);}
/* ── oblongs (V0.75.0) : une rondelle se pose au CENTRE d'un trou oblong, ou sur sa face d'entrée
   EN FACE du trou rond qui le suit (pièce dessous, vis de réglage) — sinon au centre.
   Entrée d'oblong = bord intérieur d'une face plane : deux demi-cercles de même rayon, reliés par
   une droite parallèle à leur entraxe. Centre : point d'accroche « centre de l'arc » du premier
   bout + décalage le long de l'oblong (liaison rigide). En face d'un trou : point d'accroche de
   l'entrée de ce trou (la rondelle suit la vis) + hauteur jusqu'à la face de l'oblong. */
const STD_WASHER_AT=[['hole','En face du trou suivant (sinon au centre)'],['center','Au centre de l’oblong']];
function stdSlots(G){
  // → [{F, a:[arc, arc], c (centre), ax (axe unitaire), r, len (longueur hors tout), n, sig}]
  const V=asmV,out=[];
  (G&&G.faces||[]).forEach(F=>{
    if(F.k!=='plane'||!F.rect)return;
    const [u0,u1,v0,v1]=F.rect,arcs=[];
    F.edges.forEach(e=>{
      if(e.k!=='circ'||e.full||Math.abs(V.dot(e.n,F.n))<0.999)return;
      const q=V.sub(e.c,F.c),u=V.dot(q,F.x),v=V.dot(q,F.y);
      if(Math.min(u1-u,u-u0,v1-v,v-v0)<e.r+0.01)return; // pas un bord intérieur
      if(!arcs.some(a=>V.len(V.sub(a.c,e.c))<1e-3&&Math.abs(a.r-e.r)<1e-3))arcs.push(e);
    });
    const lines=F.edges.filter(e=>e.k==='line'&&e.p0&&e.p1),used=new Set();
    arcs.forEach((a,i)=>{
      if(used.has(i))return;
      for(let j=i+1;j<arcs.length;j++){
        const b=arcs[j];if(used.has(j)||Math.abs(a.r-b.r)>1e-3)continue;
        const w=V.sub(b.c,a.c),dd=V.len(w);if(dd<1e-3)continue;
        const ax=V.mul(w,1/dd),m=V.mul(V.add(a.c,b.c),0.5);
        const side=lines.some(l=>{const d=V.sub(l.p1,l.p0),L=V.len(d);
          if(Math.abs(L-dd)>0.01||Math.abs(V.dot(d,ax))<L*0.999)return false;
          return Math.abs(V.len(V.sub(V.mul(V.add(l.p0,l.p1),0.5),m))-a.r)<0.01;});
        if(!side)continue;
        used.add(i);used.add(j);
        out.push({F,a:[a,b],c:m,ax,r:a.r,len:dd+2*a.r,n:F.n,sig:(2*a.r).toFixed(2)+'|'+(dd+2*a.r).toFixed(2)});
        break;
      }
    });
  });
  return out;
}
function stdSlotLat(s,p){
  // Distance, dans le plan de l'oblong, du point p à son axe (segment entre les centres des bouts)
  const V=asmV,w=V.sub(p,s.c),pl=V.sub(w,V.mul(s.n,V.dot(w,s.n))),hl=(s.len-2*s.r)/2;
  const t=Math.max(-hl,Math.min(hl,V.dot(pl,s.ax)));
  return V.len(V.sub(pl,V.mul(s.ax,t)));
}
function stdSameSlots(S,s){return S.filter(q=>q.sig===s.sig&&asmV.dot(q.n,s.n)>0.999);}
function stdFrPt(F,p){return asmV.add(F.o,asmV.add(asmV.mul(F.x,p[0]),asmV.add(asmV.mul(F.y,p[1]),asmV.mul(F.z,p[2]))));}
function stdFrVec(F,v){return asmV.add(asmV.mul(F.x,v[0]),asmV.add(asmV.mul(F.y,v[1]),asmV.mul(F.z,v[2])));}
function stdSlotCenter(s,rel){
  // Liaison au centre de l'oblong : centre de l'arc du premier bout, décalé le long de l'oblong
  const V=asmV,a=s.a[0],it=asmSnapItems(s.F).find(q=>q.w==='ec'&&V.len(V.sub(q.fr.o,a.c))<1e-3&&V.dot(q.fr.z,s.n)>0.999);
  if(!it)return null;
  const v=V.sub(s.c,a.c);
  return {rel:(rel||[]).slice(),sn:asmSnapRef(s.F,it),off:[+V.dot(v,it.fr.x).toFixed(9),+V.dot(v,it.fr.y).toFixed(9),0],at:'center'};
}
function stdSlotFacing(s,relS,parts){
  // Trou rond (cercle entier) dont l'axe traverse l'oblong, du côté de la matière (sous sa face
  // d'entrée), même sens : le plus proche → {pt, h, t (hauteur de la face de l'oblong au-dessus de
  // l'entrée du trou)} | null. parts : [{rel, G}] du composant actif (pièce de l'oblong comprise).
  const V=asmV,FS=asmPathFrame(asm.active,relS);if(!FS)return null;
  const sc=stdFrPt(FS.F,s.c),sn=stdFrVec(FS.F,s.n),sax=stdFrVec(FS.F,s.ax),hl=(s.len-2*s.r)/2;
  let best=null;
  parts.forEach(pt=>{
    const R=asmPathFrame(asm.active,pt.rel);if(!R||!pt.G)return;
    stdHoles(pt.G).forEach(h=>{
      if(!h.E.full)return;
      const hn=stdFrVec(R.F,h.n);if(V.dot(hn,sn)<0.999)return;
      const q=V.sub(stdFrPt(R.F,h.E.c),sc),t=-V.dot(q,sn);if(t<-0.01)return;
      const pl=V.sub(q,V.mul(sn,V.dot(q,sn))),u=Math.max(-hl,Math.min(hl,V.dot(pl,sax)));
      const lat=V.len(V.sub(pl,V.mul(sax,u)));if(lat>s.r+0.01)return;
      const sc2=t+lat*1e-3;
      if(!best||sc2<best.sc)best={pt,h,t:Math.max(0,t),sc:sc2};
    });
  });
  return best;
}
function stdSlotItem(s,relS,parts,mode){
  // Liaison d'une rondelle sur un oblong : en face du trou suivant (mode 'hole', s'il existe), sinon au centre
  if(mode==='hole'){
    const f=stdSlotFacing(s,relS,parts),sn=f&&stdHoleSn(f.h,'flush');
    if(sn)return {rel:f.pt.rel.slice(),sn,off:[0,0,+f.t.toFixed(9)],at:'hole'};
  }
  return stdSlotCenter(s,relS);
}
function stdAddOnSlots(sp,ownerId,items){
  // items : [{rel, sn, off}] — une occurrence par oblong, liaison rigide ; une seule étape d'annulation
  asmEnsure();
  const owner=asmComp(ownerId||asm.active);items=(items||[]).filter(Boolean);
  if(!owner||!items.length)return [];
  asmPush('normalisé « '+sp.name+' » sur '+items.length+' oblong(s)');
  const c=stdCompFor(sp,owner);
  const occs=items.map(x=>{
    const o=asmNewOccObj(c.id,asmOccName(c.id),asmFr0());
    o.align={src:{path:[],cg:null},dst:{path:x.rel.slice(),cg:null,sn:x.sn},flip:false,rz:0,off:x.off.slice()};
    owner.occ.push(o);return o;
  });
  asmResolve();
  return occs;
}
function stdPartsIn(ms,P){
  // Pièces du composant actif vues dans la scène (hors pièces normalisées), une par chemin :
  // [{path, rel, c, m (un maillage : son repère monde), G (faces exactes)}]
  const n=P.length,seen=new Map();
  ms.forEach(m=>{
    const path=m.parent.userData.path,k=path.join('/');
    if(seen.has(k)||path.length<n||!P.every((q,i)=>path[i]===q))return;
    const c=asmComp(asmPathComp(path));if(!c||(c.doc&&c.doc.std))return;
    seen.set(k,{path,rel:path.slice(n),c,m});
  });
  const out=[...seen.values()];
  out.forEach(pt=>{pt.G=asmSnapGeomOf(pt.c);});
  return out;
}
function stdSlotPickRay(parts,ray,maxD){
  // Oblong dont l'entrée (tournée vers l'œil) est traversée par le rayon avant tout autre obstacle :
  // un clic dans l'ouverture, sur sa paroi ou juste au bord → {s, S, pt} | null
  let best=null;
  parts.forEach(pt=>{
    const S=pt.G?stdSlots(pt.G):[];if(!S.length)return;
    const M=pt.m.matrixWorld,inv=new THREE.Matrix4().copy(M).invert();
    const o=ray.origin.clone().applyMatrix4(inv),d=ray.direction.clone().transformDirection(inv);
    const O=[o.x,o.y,o.z],D=[d.x,d.y,d.z];
    S.forEach(s=>{
      const dn=asmV.dot(D,s.n);if(dn>-1e-6)return;
      const t=asmV.dot(asmV.sub(s.c,O),s.n)/dn;if(t<0)return;
      const q=asmV.add(O,asmV.mul(D,t));if(stdSlotLat(s,q)>s.r+0.3)return;
      const tw=new THREE.Vector3(q[0],q[1],q[2]).applyMatrix4(M).distanceTo(ray.origin);
      if(tw>maxD+0.6)return;
      if(!best||tw<best.tw)best={tw,s,S,pt};
    });
  });
  return best;
}
const STD_PIN_AT=[['auto','Au plus court (selon le clic)'],['mid','Milieu du cylindre'],['top','Arête haute (entrée)'],['bot','Arête basse (fond)']];
function stdPinAt(h,p){
  // « Au plus court » : du point cliqué sur la paroi (coordonnées du composant), le plus proche
  // des trois points de l'axe du cylindre — arête haute, milieu, arête basse
  const d=-asmV.dot(asmV.sub(p,h.E.c),h.n),c=[['top',h.d0],['mid',(h.d0+h.d1)/2],['bot',h.d1]];
  return c.reduce((b,x)=>Math.abs(x[1]-d)<Math.abs(b[1]-d)?x:b)[0];
}
function stdHoleSn(h,mode,pos){
  // Référence durable (point d'accroche) du centre du cercle d'assise ; 'mid' (goupille, par son
  // centre) : un point de l'axe du cylindre du trou — pos : 'mid' milieu, 'top' arête haute (côté
  // entrée), 'bot' arête basse. Les bouts de l'axe (a0 / a1) suivent son sens : on les range par profondeur.
  if(mode==='mid'){
    const its=h.cyl?asmSnapItems(h.cyl):[];let it=null;
    if(pos==='top'||pos==='bot'){
      const ends=its.filter(q=>q.w==='a0'||q.w==='a1').map(q=>({q,d:-asmV.dot(asmV.sub(q.fr.o,h.E.c),h.n)})).sort((a,b)=>a.d-b.d);
      if(ends.length)it=(pos==='top'?ends[0]:ends[ends.length-1]).q;
    }else it=its.find(q=>q.w==='am');
    return it?asmSnapRef(h.cyl,it):null;
  }
  const S=mode==='under'?h.seat:h.E;
  // Fond de lamage : face annulaire dont le centre EST celui du trou — les points d'accroche n'y
  // gardent que le « centre » de la face (même point, même axe) : il convient aussi
  const at=q=>asmV.len(asmV.sub(q.fr.o,S.c))<1e-3&&asmV.dot(q.fr.z,S.n)>0.999,its=asmSnapItems(S.F);
  const it=its.find(q=>q.w==='ec'&&q.e&&at(q))||its.find(q=>q.w==='c'&&at(q));
  return it?asmSnapRef(S.F,it):null;
}
function stdCompFor(sp,owner){
  // Composant de la pièce : celui de même désignation s'il peut aller dans le porteur, sinon un neuf
  let c=asm.comps.find(q=>q.doc&&q.doc.std&&q.doc.std.key===sp.key&&asmCanPlace(q.id,owner.id));
  if(!c){
    c={id:uid('cp'),kind:'comp',name:sp.name,doc:stdDoc(sp),occ:[],link:null};
    const L=asmLinkOwner(owner);if(L)c.of=L.id;
    asm.comps.push(c);
  }
  return c;
}
function stdAddOnHoles(sp,ownerId,relPath,holes,at){
  // at (goupilles) : 'mid' | 'top' | 'bot' — où va le centre de la goupille sur l'axe du trou
  // Une occurrence par trou, liaison rigide sur son cercle d'assise — une seule étape d'annulation
  asmEnsure();
  const owner=asmComp(ownerId||asm.active);if(!owner||!holes.length)return [];
  const sns=[];
  holes.forEach(h=>{const sn=stdHoleSn(h,sp.seat||'under',at||'mid');if(sn)sns.push({sn,h});});
  if(!sns.length)return [];
  asmPush('normalisé « '+sp.name+' » sur '+sns.length+' trou(s)');
  const c=stdCompFor(sp,owner);
  const occs=sns.map(({sn,h})=>{
    const o=asmNewOccObj(c.id,asmOccName(c.id),asmFr0());
    // goupille : +Z de la pièce vers l'entrée (l'axe d'un cylindre a un sens arbitraire) ;
    // FHC : tête 0,2 mm sous la face d'entrée (sp.sink, retrait des fraisures du perçage)
    const flip=sp.seat==='mid'&&asmV.dot(sn.fr.z,h.n)<0;
    o.align={src:{path:[],cg:null},dst:{path:(relPath||[]).slice(),cg:null,sn},flip,rz:0,off:[0,0,-(sp.sink||0)]};
    owner.occ.push(o);return o;
  });
  asmResolve();
  return occs;
}
/* ── modifier une pièce posée (V0.21.1) ──
   all : toutes les occurrences du composant — il est reconstruit sur place (même objet document,
   autre contenu), renommé ; si la nouvelle pièce existe déjà, ses occurrences y passent plutôt.
   Sinon : cette occurrence seulement — elle passe sur la nouvelle pièce (créée ou réemployée).
   Positions, liaisons et apparence restent : l'origine d'une pièce (face d'appui, dessus, bout)
   ne dépend ni de la longueur ni du pas. Une seule étape d'annulation. */
function stdReplace(occId,sp,all){
  // → {comp, n (occurrences changées), how:'rebuilt'|'moved'|'same'} ou null
  if(!asm)return null;
  const o=asmOcc(occId),owner=asmOccOwner(occId);if(!o||!owner)return null;
  const c=asmComp(o.comp);if(!c||!c.doc||!c.doc.std||c.doc===doc)return null;
  if(c.doc.std.key===sp.key)return {comp:c,n:0,how:'same'};
  const list=all?asmCompOccs(c.id):[o];
  // même assise (sous tête, affleurant, milieu) : le retrait suit la nouvelle pièce (FHC ↔ bouchon…)
  const oS=stdStateOf(c.doc.std),was=oS?stdSpec(oS.cat,oS.st):null;
  const sink=()=>{if(was&&was.seat===sp.seat)list.forEach(q=>{if(q.align&&q.align.dst&&q.align.dst.sn)q.align.off=[0,0,-(sp.sink||0)];});};
  const ownerOf=q=>asmOccOwner(q.id);
  const same=asm.comps.find(q=>q!==c&&q.doc&&q.doc.std&&q.doc.std.key===sp.key&&list.every(x=>asmCanPlace(q.id,ownerOf(x).id)));
  const lab='« '+c.name+' » → « '+sp.name+' »'+(all?'':' (une occurrence)');
  const move=t=>list.forEach(q=>{q.name=asmOccName(t.id);q.comp=t.id;});
  if(same){asmPush(lab);move(same);sink();asmPurge();asmResolve();return {comp:same,n:list.length,how:'moved'};}
  if(all||asmCompOccs(c.id).length===1){
    // le composant entier change : reconstruit sur place
    asmPush(lab,[c.id]);
    const old=c.name,nd=stdDoc(sp);
    Object.keys(c.doc).forEach(k=>{delete c.doc[k];});Object.assign(c.doc,nd);
    c.name=sp.name;
    const re=new RegExp('^'+old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    asmCompOccs(c.id).forEach(q=>{q.name=q.name.replace(re,sp.name);});
    c._stale=true;
    sink();
    asmResolve();
    return {comp:c,n:asmCompOccs(c.id).length,how:'rebuilt'};
  }
  asmPush(lab);
  const t={id:uid('cp'),kind:'comp',name:sp.name,doc:stdDoc(sp),occ:[],link:null};
  const L=asmLinkOwner(owner);if(L)t.of=L.id;
  asm.comps.push(t);move(t);sink();asmResolve();
  return {comp:t,n:1,how:'moved'};
}
/* ── clavettes : pose dans une rainure (V0.21.9) ──
   Fond de rainure = face plane cliquée, lue sur la forme exacte : ses arcs (bouts ronds, rayon
   commun) donnent l'axe et le centre — deux arcs : rainure fermée (forme A) ; un arc : rainure
   débouchante ; aucun : rainure droite (contour de lignes, axe = la plus longue). La clavette
   (origine au centre de son dessous, longueur selon X) est tenue par une liaison rigide sur un
   point d'accroche du fond : son CENTRE de face (mode 'face'), ou le centre d'un bout rond (mode
   'arc' : le bout le plus proche du clic ; une rainure débouchante n'a que celui-là). La rotation
   (rz) amène X de la clavette sur l'axe de la rainure ; en mode 'arc', le décalage (off) pose le
   bout de la clavette contre le bout de la rainure. Rainures fermées ou débouchantes identiques
   de la pièce (même forme, largeur, longueur) : équipées d'un coup. */
const STD_KEY_AT=[['face','Centre de face (milieu de la rainure)'],['arc','Centre du cercle (bout le plus proche du clic)']];
function stdKeyway(F){
  // → {F, form:'A'|'open'|'rect', c, ax, w, len, arcs:[{c, r}], sig} | null
  if(!F||F.k!=='plane')return null;
  const V=asmV,arcs=[];
  F.edges.forEach(e=>{
    if(e.k!=='circ'||e.full||Math.abs(V.dot(e.n,F.n))<0.999)return;
    if(!arcs.some(a=>V.len(V.sub(a.c,e.c))<1e-3))arcs.push({c:e.c,r:e.r});
  });
  const lines=F.edges.filter(e=>e.k==='line'&&e.p0&&e.p1);
  const inPl=v=>{const u=V.sub(v,V.mul(F.n,V.dot(v,F.n)));return V.unit(u);};
  const ext=(c,ax)=>{let a=1e18,b=-1e18;lines.forEach(l=>[l.p0,l.p1].forEach(p=>{const t=V.dot(V.sub(p,c),ax);a=Math.min(a,t);b=Math.max(b,t);}));return [a,b];};
  let K=null;
  if(arcs.length===2&&Math.abs(arcs[0].r-arcs[1].r)<1e-3){
    const ax=inPl(V.sub(arcs[1].c,arcs[0].c));if(!ax)return null;
    const r=arcs[0].r,dd=V.len(V.sub(arcs[1].c,arcs[0].c));
    K={form:'A',c:V.mul(V.add(arcs[0].c,arcs[1].c),0.5),ax,w:2*r,len:dd+2*r};
  }else if(arcs.length===1){
    const ax=inPl(V.sub(F.c,arcs[0].c));if(!ax)return null;
    const [,b]=ext(arcs[0].c,ax);
    K={form:'open',c:F.c,ax,w:2*arcs[0].r,len:b+arcs[0].r};
  }else if(!arcs.length&&lines.length>=4){
    const lg=lines.reduce((a,l)=>V.len(V.sub(l.p1,l.p0))>V.len(V.sub(a.p1,a.p0))?l:a);
    const ax=inPl(V.sub(lg.p1,lg.p0));if(!ax)return null;
    const [a,b]=ext(F.c,ax),[c0,c1]=ext(F.c,V.cross(F.n,ax));
    K={form:'rect',c:F.c,ax,w:c1-c0,len:b-a};
  }else return null;
  K.F=F;K.arcs=arcs;K.sig=K.form+'|'+K.w.toFixed(2)+'|'+K.len.toFixed(2);
  return K;
}
function stdKeyAlign(K,mode,end,key){
  // Liaison d'une clavette key = {L, b, form} dans la rainure K → {sn, rz, off} | null
  const V=asmV,its=asmSnapItems(K.F);
  let it=null,u=K.ax,d=0;
  if(K.form==='open'||(mode==='arc'&&end&&K.form!=='rect')){
    const E=end||K.arcs[0];
    it=its.find(q=>q.w==='ec'&&V.len(V.sub(q.fr.o,E.c))<1e-3);
    u=K.form==='open'?K.ax:V.unit(V.sub(K.c,E.c));
    d=key.L/2-E.r; // bout de la clavette contre le bout de la rainure
  }else it=its.find(q=>q.w==='c');
  if(!it||!u)return null;
  const ux=V.dot(u,it.fr.x),uy=V.dot(u,it.fr.y);
  return {sn:asmSnapRef(K.F,it),rz:+(Math.atan2(uy,ux)*180/Math.PI).toFixed(9),off:[ux*d,uy*d,0]};
}
function stdKeyEndFor(K,dir){
  // Bout d'une rainure du même côté (direction depuis son centre) que celui choisi sur la rainure cliquée
  if(!K.arcs.length)return null;
  return K.arcs.reduce((a,b)=>asmV.dot(asmV.sub(b.c,K.c),dir)>asmV.dot(asmV.sub(a.c,K.c),dir)?b:a);
}
function stdAddInKeyways(sp,ownerId,relPath,items,mode){
  // items : [{K, end}] — une occurrence par rainure, liaison rigide ; une seule étape d'annulation
  asmEnsure();
  const owner=asmComp(ownerId||asm.active),key=(sp.ops||[]).find(o=>o.k==='key');
  if(!owner||!key||!items.length)return [];
  const al=[];items.forEach(x=>{const a=stdKeyAlign(x.K,mode,x.end,key);if(a)al.push(a);});
  if(!al.length)return [];
  asmPush('normalisé « '+sp.name+' » dans '+al.length+' rainure(s)');
  const c=stdCompFor(sp,owner);
  const occs=al.map(a=>{
    const o=asmNewOccObj(c.id,asmOccName(c.id),asmFr0());
    o.align={src:{path:[],cg:null},dst:{path:(relPath||[]).slice(),cg:null,sn:a.sn},flip:false,rz:a.rz,off:a.off};
    owner.occ.push(o);return o;
  });
  asmResolve();
  return occs;
}
function stdKeyPick(sp,Gs,p,n){
  // Clic (point p, normale n du maillage, coordonnées du composant) → {K, items, mode} | null
  const F=asmSnapHitFace(Gs,p,n);if(!F||F.k!=='plane')return null;
  const K=stdKeyway(F);if(!K)return null;
  let mode=stdUi.keyAt==='arc'?'arc':'face',end=null;
  if(K.form==='open'){mode='arc';end=K.arcs[0];}
  else if(mode==='arc'&&K.arcs.length)end=K.arcs.reduce((a,b)=>asmV.len(asmV.sub(b.c,p))<asmV.len(asmV.sub(a.c,p))?b:a);
  if(K.form==='rect')mode='face';
  const items=[{K,end}];
  if(K.form!=='rect'){
    const dir=end?asmV.sub(end.c,K.c):null;
    Gs.faces.forEach(G=>{if(G===F||G.k!=='plane')return;const Q=stdKeyway(G);
      if(Q&&Q.sig===K.sig)items.push({K:Q,end:mode==='arc'?(Q.form==='open'?Q.arcs[0]:stdKeyEndFor(Q,dir)):null});});
  }
  return {K,items,mode};
}
/* ── commande « Sur des trous » (« Dans une rainure » pour une clavette) : clic en mode Placer ── */
let stdHolePick=null; // {sp}
function stdIsKey(sp){return !!(sp&&(sp.ops||[]).some(o=>o.k==='key'));}
function stdHoleStart(sp){
  if(!sp||(!sp.seat&&!stdIsKey(sp))){try{faceEl.textContent='Cette pièce ne se pose pas dans un trou.';}catch(e){}return;}
  if(!(typeof occHas==='function'&&occHas())){alert('La pose sur des trous lit la forme exacte : noyau OCCT pas encore prêt.');return;}
  if(asmMode!=='asm')asmEnter();
  stdHolePick={sp};
  try{renderer.domElement.style.cursor='crosshair';}catch(e){}
  try{faceEl.textContent=stdIsKey(sp)?'« '+sp.name+' » : cliquez le FOND d’une rainure — les rainures identiques de la pièce la recevront aussi. Échap = annuler.'
    :sp.washer?'« '+sp.name+' » : cliquez un trou (sa paroi) ou un oblong — tous les trous ou oblongs identiques de la pièce la recevront. Échap = annuler.'
    :'« '+sp.name+' » : cliquez un trou (sa paroi) — tous les trous identiques de la pièce le recevront. Échap = annuler.';}catch(e){}
}
function stdHoleCancel(){
  stdHolePick=null;try{renderer.domElement.style.cursor='';}catch(e){}
  try{faceEl.textContent='Pose sur des trous annulée.';}catch(e){}
}
function stdWasherSlotPick(sp,ms,hits,P){
  // Rondelle : clic sur un oblong (ouverture, paroi, bord) → posée sur tous les oblongs identiques
  // de la pièce, chacun en face de son trou suivant ou au centre (stdUi.washerAt) ; true si posé
  const n=P.length,parts=stdPartsIn(ms,P);
  const first=hits.find(h=>{const p=h.object.parent.userData.path;if(p.length<n||!P.every((q,i)=>p[i]===q))return false;
    const c=asmComp(asmPathComp(p));return c&&!(c.doc&&c.doc.std);});
  const B=stdSlotPickRay(parts,rayc.ray,first?first.distance:Infinity);if(!B)return false;
  const mode=stdUi.washerAt==='center'?'center':'hole';
  const items=stdSameSlots(B.S,B.s).map(s=>stdSlotItem(s,B.pt.rel,parts,mode)).filter(Boolean);
  const occs=stdAddOnSlots(sp,asm.active,items),nH=items.filter(x=>x.at==='hole').length;
  stdHolePick=null;try{renderer.domElement.style.cursor='';}catch(err){}
  try{asmBuildSnapshots();}catch(err){}
  if(occs.length)asmSelId=occs[0].id;
  asmNotify();
  const where=mode==='center'?'au centre':nH===items.length?'en face du trou suivant':nH?nH+' en face du trou suivant, '+(items.length-nH)+' au centre (pas de trou dessous)':'au centre (pas de trou dessous)';
  try{faceEl.textContent=occs.length?'« '+sp.name+' » posée sur '+occs.length+' oblong(s) '+stdF(2*B.s.r)+' × '+stdF(B.s.len)+' de « '+B.pt.c.name+' », '+where+', liaison rigide.':'Pose impossible sur cet oblong.';}catch(err){}
  const m=document.querySelector('#stdDlg .stdFoot span');if(m)m.textContent=occs.length?'✓ '+occs.length+' × '+sp.name:'';
  return true;
}
function stdHolePickAt(e){
  // asmClick (47) : true si le clic est consommé
  if(!stdHolePick)return false;
  const sp=stdHolePick.sp,S=asmSceneGet(),G=S.getObjectByName('asmOcc');if(!G)return true;
  const P=asm.path,n=P.length;
  const ms=[];G.traverse(m=>{if(m.isMesh&&m.parent&&Array.isArray(m.parent.userData.path))ms.push(m);});
  rayc.ray.copy(asmRay(e));
  const hits=[];ms.forEach(m=>{try{THREE.Mesh.prototype.raycast.call(m,rayc,hits);}catch(err){}});
  hits.sort((a,b)=>a.distance-b.distance);
  if(sp.washer&&stdWasherSlotPick(sp,ms,hits,P))return true; // rondelle : un oblong passe avant les trous
  for(const hit of hits){
    const path=hit.object.parent.userData.path;
    if(path.length<n||!P.every((q,i)=>path[i]===q))continue; // hors du composant actif
    const c=asmComp(asmPathComp(path));
    // une vis déjà posée : on regarde derrière. Exception : la rainure d'une roue dentée reçoit sa clavette
    if(!c||(c.doc&&c.doc.std&&!(stdIsKey(sp)&&c.doc.std.cat==='gear')))continue;
    const Gs=asmSnapGeomOf(c);if(!Gs)continue;
    const inv=new THREE.Matrix4().copy(hit.object.matrixWorld).invert();
    const pl=hit.point.clone().applyMatrix4(inv),ld=rayc.ray.direction.clone().transformDirection(inv);
    if(stdIsKey(sp)){
      const nl=hit.face?hit.face.normal.clone():null; // normale locale du maillage : la face visée, pas celle de derrière
      const R=stdKeyPick(sp,Gs,[pl.x,pl.y,pl.z],nl?[nl.x,nl.y,nl.z]:null);if(!R)continue;
      const occs=stdAddInKeyways(sp,asm.active,path.slice(n),R.items,R.mode);
      stdHolePick=null;try{renderer.domElement.style.cursor='';}catch(err){}
      try{asmBuildSnapshots();}catch(err){}
      if(occs.length)asmSelId=occs[0].id;
      asmNotify();
      const key=sp.ops.find(o=>o.k==='key'),warn=Math.abs(R.K.w-key.b)>0.05?' ⚠ largeur de rainure '+stdF(R.K.w)+' ≠ b '+stdF(key.b):'',lg=key.L>R.K.len+0.01?' ⚠ clavette plus longue que la rainure ('+stdF(R.K.len)+')':'';
      const how=R.mode==='arc'?'contre le bout rond':'au centre';
      try{faceEl.textContent=occs.length?'« '+sp.name+' » posée dans '+occs.length+' rainure(s) '+stdF(R.K.w)+' × '+stdF(R.K.len)+' de « '+c.name+' », '+how+', liaison rigide.'+warn+lg:'Pose impossible dans cette rainure.';}catch(err){}
      const m=document.querySelector('#stdDlg .stdFoot span');if(m)m.textContent=occs.length?'✓ '+occs.length+' × '+sp.name:'';
      return true;
    }
    // rondelle : cercles entiers seulement (les bouts d'un oblong raté de peu ne sont pas des trous)
    const H=stdHoles(Gs).filter(q=>!sp.washer||q.E.full),h=stdHoleAt(H,[pl.x,pl.y,pl.z],[ld.x,ld.y,ld.z]);
    if(!h)continue;
    let at=null;
    if(sp.seat==='mid'){at=stdUi.pinAt||'auto';if(at==='auto')at=stdPinAt(h,[pl.x,pl.y,pl.z]);}
    const occs=stdAddOnHoles(sp,asm.active,path.slice(n),stdSameHoles(H,h),at);
    stdHolePick=null;try{renderer.domElement.style.cursor='';}catch(err){}
    try{asmBuildSnapshots();}catch(err){}
    if(occs.length)asmSelId=occs[0].id;
    asmNotify();
    const lab={simple:'simples',cbore:'lamés',csink:'fraisés'}[h.kind];
    const where=at?{mid:', centre au milieu du cylindre',top:', centre sur l’arête haute',bot:', centre sur l’arête basse'}[at]:'';
    try{faceEl.textContent=occs.length?'« '+sp.name+' » posé sur '+occs.length+' trou(s) '+lab+' Ø'+stdF(2*h.r)+' de « '+c.name+' »'+where+', liaison rigide (suit la pièce).':'Pose impossible sur ce trou.';}catch(err){}
    const m=document.querySelector('#stdDlg .stdFoot span');if(m)m.textContent=occs.length?'✓ '+occs.length+' × '+sp.name:'';
    return true;
  }
  try{faceEl.textContent=stdIsKey(sp)?'Pas de rainure ici : cliquez le fond plat d’une rainure (bouts ronds ou droits). Échap = annuler.':'Pas de trou ici : cliquez la paroi d’un trou (simple, lamé ou fraisé)'+(sp.washer?' ou un oblong':'')+'. Échap = annuler.';}catch(err){}
  return true;
}
/* ── aperçu : silhouette de côté (révolution) ou vue de dessus + côté (clavette) ── */
function stdPolyPts(pts){
  // sommets → polyligne (arcs échantillonnés)
  const out=[];
  pts.forEach((q,j)=>{
    const p=pts[(j+pts.length-1)%pts.length];
    if(q[2]&&q[2].c){
      const c=q[2].c,r=Math.hypot(q[0]-c[0],q[1]-c[1]);
      let a0=Math.atan2(p[1]-c[1],p[0]-c[0]),a1=Math.atan2(q[1]-c[1],q[0]-c[0]);
      const ccw=q[2].ccw!=null?q[2].ccw:((p[0]-c[0])*(q[1]-c[1])-(p[1]-c[1])*(q[0]-c[0]))>0;
      if(ccw){while(a1<=a0)a1+=2*Math.PI;}else{while(a1>=a0)a1-=2*Math.PI;}
      for(let k=1;k<=16;k++){const a=a0+(a1-a0)*k/16;out.push([c[0]+r*Math.cos(a),c[1]+r*Math.sin(a)]);}
    }else out.push([q[0],q[1]]);
  });
  return out;
}
function stdSvg(sp){
  const W=240,H=220,shapes=[],hid=[],holes=[];
  (sp.pair||[]).forEach(P=>{
    const g=gearGeom(P.o),F=P.fr,mv=q=>[F.o[0]+q[0]*F.x[0]+q[1]*F.y[0],F.o[1]+q[0]*F.x[1]+q[1]*F.y[1]];
    if(g.internal){
      const C=[];for(let i=0;i<96;i++){const a=i/96*2*Math.PI;C.push(mv([g.D/2*Math.cos(a),g.D/2*Math.sin(a)]));}
      shapes.push(C);holes.push(gearPolyline(g,0.05,6).map(mv));
    }else shapes.unshift(gearPolyline(g,0.05,6).map(mv));
  });
  if(sp.prof){
    const P=stdPolyPts(sp.prof);
    shapes.push(P.map(p=>[p[0],p[1]]),P.map(p=>[-p[0],p[1]]));
    (sp.ops||[]).forEach(o=>{
      if(o.k==='hex'){const e=o.s/Math.sqrt(3);hid.push([[-e,o.z],[-e,o.z-o.t],[e,o.z-o.t],[e,o.z]]);}
      if(o.k==='slot'&&o.open){hid.push([[o.x0,o.z0+o.L],[o.x1-1,o.z0+o.L]]);}
      else if(o.k==='slot'){const z0=o.z0||0;hid.push([[-o.w/2,z0],[-o.w/2,z0+o.L]],[[o.w/2,z0],[o.w/2,z0+o.L]]);}
      if(o.k==='hole'){const r=o.d/2;hid.push([[-r,0],[-r,-o.len]],[[r,0],[r,-o.len]]);}
    });
  }
  (sp.ops||[]).forEach(o=>{ // vue de dessus
    if(o.k==='gear'){
      const g=gearGeom(o);
      if(g.internal){
        const P=[];for(let i=0;i<96;i++){const a=i/96*2*Math.PI;P.push([g.D/2*Math.cos(a),g.D/2*Math.sin(a)]);}
        shapes.push(P);holes.push(gearPolyline(g,0.05,6));
      }else shapes.push(gearPolyline(g,0.05,6));
    }
    if(o.k==='bore'){
      if(o.b)holes.push(stdPolyPts(gearBoreLoop(o)));
      else{const P=[];for(let i=0;i<48;i++){const a=i/48*2*Math.PI;P.push([o.d/2*Math.cos(a),o.d/2*Math.sin(a)]);}holes.push(P);}
    }
  });
  (sp.ops||[]).forEach(o=>{ // aimant pavé : de face, pôle nord en haut
    if(o.k==='mbox')shapes.push([[-o.a/2,0],[o.a/2,0],[o.a/2,o.h],[-o.a/2,o.h]]);
  });
  (sp.ops||[]).forEach(o=>{
    if(o.k!=='key')return;
    const P=stdPolyPts(stdKeyOutline(o)),gap=o.b*0.8;
    shapes.push(P.map(p=>[p[0],p[1]+o.b/2+gap/2]));
    shapes.push([[-o.L/2,-gap/2],[o.L/2,-gap/2],[o.L/2,-gap/2-o.h],[-o.L/2,-gap/2-o.h]]);
  });
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  shapes.forEach(S=>S.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}));
  const k=Math.min((W-24)/Math.max(1e-6,x1-x0),(H-24)/Math.max(1e-6,y1-y0));
  const X=x=>(W/2+(x-(x0+x1)/2)*k).toFixed(1),Y=y=>(H/2-(y-(y0+y1)/2)*k).toFixed(1);
  const path=S=>S.map((p,i)=>(i?'L':'M')+X(p[0])+' '+Y(p[1])).join(' ');
  let s='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" xmlns="http://www.w3.org/2000/svg">';
  shapes.forEach(S=>{s+='<path d="'+path(S)+' Z" fill="var(--stdFill)" stroke="var(--text)" stroke-width="1.2" stroke-linejoin="round"/>';});
  holes.forEach(S=>{s+='<path d="'+path(S)+' Z" fill="var(--bg)" stroke="var(--text)" stroke-width="1.2" stroke-linejoin="round"/>';});
  if(sp.prof)s+='<path d="M'+X(0)+' 4 V'+(H-4)+'" stroke="var(--muted)" stroke-width="0.8" stroke-dasharray="10 3 2 3"/>';
  hid.forEach(S=>{s+='<path d="'+path(S)+'" fill="none" stroke="var(--text)" stroke-width="0.9" stroke-dasharray="4 3" opacity=".75"/>';});
  return s+'</svg>';
}
/* ── fenêtre ── */
let stdUi={cat:'iso',st:{}}; // dernière sélection (reprise à la réouverture)
function stdCss(){
  if(document.getElementById('stdCss'))return;
  const st=document.createElement('style');st.id='stdCss';
  st.textContent=[
    '#stdDlg{position:fixed;left:calc(50% - 310px);top:72px;z-index:8000;width:620px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;border-radius:14px;background-color:var(--bg);border:1px solid var(--border);box-shadow:0 20px 50px rgba(0,0,0,.45);color:var(--text);--stdFill:rgba(127,127,127,.22)}',
    '#stdDlg .stdHead{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border);cursor:move;user-select:none}',
    '#stdDlg .stdHead b{font-size:.95rem}#stdDlg .stdHead button{padding:2px 8px}',
    '#stdDlg .stdTabs{display:flex;gap:4px;padding:8px 14px 0;flex-wrap:wrap}',
    '#stdDlg .stdTabs button{padding:4px 10px;border-radius:8px 8px 0 0;font-size:.8rem}',
    '#stdDlg .stdTabs button.on{background:var(--primary);color:#fff}',
    '#stdDlg .stdBody{display:flex;gap:14px;padding:12px 14px;border-top:1px solid var(--border);flex-wrap:wrap}',
    '#stdDlg .stdForm{flex:1 1 260px;display:flex;flex-direction:column;gap:8px;min-width:0}',
    '#stdDlg .stdForm label{display:flex;flex-direction:column;align-items:stretch;text-align:left;gap:3px;margin:0;font-size:.75rem;color:var(--muted)}',
    '#stdDlg .stdForm select,#stdDlg .stdForm input{width:100%;max-width:none;margin:0;font-size:.85rem;color:var(--text);box-sizing:border-box}',
    '#stdDlg .stdPrev{flex:0 0 240px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:10px;min-height:220px}',
    '#stdDlg .stdName{font-weight:600;font-size:.9rem;color:var(--text);text-align:left}',
    '#stdDlg .stdInfo{font-size:.75rem;color:var(--muted);line-height:1.4;text-align:left}',
    '#stdDlg .stdChk{font-size:.75rem;line-height:1.35;text-align:left;color:#30d158}',
    '#stdDlg .stdChk.warn{color:#ff9f0a}#stdDlg .stdChk.err{color:#ff453a}',
    '#stdDlg .stdFoot{display:flex;gap:8px;justify-content:flex-end;align-items:center;padding:10px 14px;border-top:1px solid var(--border)}',
    '#stdDlg .stdFoot span{margin-right:auto;font-size:.75rem;color:var(--muted)}'
  ].join('\n');
  document.head.appendChild(st);
}
function stdDlg(edit,cat){
  // Ouvre (ou ferme) la fenêtre des composants normalisés. edit = {occ} : « Modifier… » une pièce
  // posée — la fenêtre reprend ses réglages et applique à toutes ses occurrences ou à celle-ci.
  let w=document.getElementById('stdDlg');if(w){w.remove();if(!edit)return;}
  stdCss();
  try{const v=JSON.parse(localStorage.getItem('minifusion_std')||'null');if(v&&typeof v.cat==='string'&&v.st&&typeof v.st==='object')stdUi=v;}catch(e){}
  if(edit){
    const o=asmOcc(edit.occ),c=o&&asmComp(o.comp),S=c&&c.doc&&stdStateOf(c.doc.std);
    if(!S){try{faceEl.textContent='Ce composant n’est pas une pièce normalisée (ou ses réglages sont illisibles).';}catch(e){}return;}
    stdUi.cat=S.cat;stdUi.st=stdUi.st||{};stdUi.st[S.cat]=S.st;
  }
  else if(stdUi.st&&stdUi.st.gear){delete stdUi.st.gear.j;delete stdUi.st.gear.ks;}
  if(cat&&!edit)stdUi.cat=cat; // commande « Aimants » du ruban : ouvre directement son onglet
  w=document.createElement('div');w.id='stdDlg';
  w.innerHTML='<div class="stdHead"><b>🔩 Composants normalisés</b><button title="Fermer (Échap)">✕</button></div>'+
    '<div class="stdTabs"></div><div class="stdBody"><div class="stdForm"></div><div class="stdPrev"></div></div>'+
    (edit?'<div class="stdFoot"><span></span><button class="primary">✔ Toutes les occurrences</button><button>Celle-ci seulement</button><button>Fermer</button></div>'
      :'<div class="stdFoot"><span></span><button title="Cliquez un trou dans la vue : tous les trous identiques (simple, lamé, fraisé) reçoivent la pièce, en liaison rigide">🎯 Sur des trous…</button><button class="primary">➕ Insérer</button><button>Fermer</button></div>');
  const tabs=w.querySelector('.stdTabs'),form=w.querySelector('.stdForm'),prev=w.querySelector('.stdPrev'),msg=w.querySelector('.stdFoot span');
  const close=()=>w.remove();
  w.querySelector('.stdHead button').onclick=close;
  const [bHole,bIns,bClose]=w.querySelectorAll('.stdFoot button');bClose.onclick=close;
  const save=()=>{try{localStorage.setItem('minifusion_std',JSON.stringify(stdUi));}catch(e){}};
  const apply=(sp,all)=>{
    const r=sp&&stdReplace(edit.occ,sp,all);
    if(!r){msg.textContent='Modification impossible.';return;}
    if(r.how==='same'){msg.textContent='Déjà cette pièce.';return;}
    try{asmBuildSnapshots();}catch(e){}
    asmNotify();
    msg.textContent='✓ '+r.n+' occurrence(s) → '+sp.name;
    try{faceEl.textContent='Pièce normalisée modifiée : '+r.n+' occurrence(s) → « '+sp.name+' » (liaisons gardées). Ctrl+Z pour annuler.';}catch(e){}
    draw();
  };
  const draw=()=>{
    if(edit){
      const o=asmOcc(edit.occ),c=o&&asmComp(o.comp);if(!o||!c){close();return;}
      const n=asmCompOccs(c.id).length;
      w.querySelector('.stdHead b').textContent='🔩 Modifier « '+o.name+' »';
      bHole.textContent='✔ Toutes les occurrences ('+n+')';bIns.style.display=n>1?'':'none';
    }
    const C=stdCat(stdUi.cat);
    stdUi.st[C.k]=stdNormState(C.k,stdUi.st[C.k]);const st=stdUi.st[C.k];
    // le formulaire est refait à chaque changement : le champ où l'on tabule garde le curseur
    const focusK=form.contains(document.activeElement)?document.activeElement.dataset.k:null;
    tabs.innerHTML='';
    STD_CATS.forEach(c=>{const b=document.createElement('button');b.textContent=c.lab;if(c.k===C.k)b.className='on';
      b.onclick=()=>{stdUi.cat=c.k;save();draw();};tabs.appendChild(b);});
    form.innerHTML='';
    C.fields.forEach(f=>{
      if(f.show&&!f.show(st))return;
      const l=document.createElement('label');l.textContent=f.lab;
      if(f.num){
        const i=document.createElement('input');i.type='number';i.dataset.k=f.k;
        i.min=f.num.min;i.max=f.num.max;i.step=f.num.step;i.value=st[f.k];
        if(f.sug){
          const dl=document.createElement('datalist');dl.id='stdSug_'+f.k;
          f.sug().forEach(v=>{const o=document.createElement('option');o.value=v;dl.appendChild(o);});
          i.setAttribute('list',dl.id);l.appendChild(dl);
        }
        i.onchange=()=>{st[f.k]=i.value;save();draw();};
        l.appendChild(i);form.appendChild(l);
        return;
      }
      const s=document.createElement('select');s.dataset.k=f.k;
      f.opts(st).forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(v===st[f.k])o.selected=true;s.appendChild(o);});
      s.onchange=()=>{st[f.k]=s.value;save();draw();};
      l.appendChild(s);form.appendChild(l);
    });
    if(focusK){const q=form.querySelector('[data-k="'+focusK+'"]');if(q)q.focus();}
    let sp=null,spErr='';try{sp=stdSpec(C.k,st);}catch(e){sp=null;spErr=String(e.message||e);}
    const nm=document.createElement('div');nm.className='stdName';nm.textContent=sp?sp.name:'—';form.appendChild(nm);
    if(sp&&stdIsKey(sp)&&!edit){
      // clavette : par quel point elle se pose « Dans une rainure »
      const l=document.createElement('label');l.textContent='Attacher par (Dans une rainure)';
      const s=document.createElement('select');s.dataset.k='keyAt';
      STD_KEY_AT.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(v===(stdUi.keyAt||'face'))o.selected=true;s.appendChild(o);});
      s.onchange=()=>{stdUi.keyAt=s.value;save();};
      l.appendChild(s);form.appendChild(l);
    }
    if(sp&&sp.seat==='mid'&&!edit){
      // goupille : où va son centre quand on la pose « Sur des trous »
      const l=document.createElement('label');l.textContent='Position dans le trou (Sur des trous)';
      const s=document.createElement('select');s.dataset.k='pinAt';
      STD_PIN_AT.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(v===(stdUi.pinAt||'auto'))o.selected=true;s.appendChild(o);});
      s.onchange=()=>{stdUi.pinAt=s.value;save();};
      l.appendChild(s);form.appendChild(l);
    }
    if(sp&&sp.washer&&!edit){
      // rondelle : où elle va sur un trou oblong
      const l=document.createElement('label');l.textContent='Sur un oblong (Sur des trous / oblongs)';
      const s=document.createElement('select');s.dataset.k='washerAt';
      STD_WASHER_AT.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(v===(stdUi.washerAt||'hole'))o.selected=true;s.appendChild(o);});
      s.onchange=()=>{stdUi.washerAt=s.value;save();};
      l.appendChild(s);form.appendChild(l);
    }
    const inf=document.createElement('div');inf.className='stdInfo';inf.textContent=sp?(sp.norm+' · '+sp.info):'';form.appendChild(inf);
    // engrenages : contrôles de la pièce (alertes sans blocage), ou motif du refus
    const chk=(cls,txt)=>{const d=document.createElement('div');d.className='stdChk'+(cls?' '+cls:'');d.textContent=txt;form.appendChild(d);};
    if(sp&&sp.checks){
      sp.checks.forEach(c=>chk(c.lvl==='ok'?'':'warn',(c.lvl==='ok'?'✓ ':'⚠ ')+c.txt));
      const n=document.createElement('div');n.className='stdInfo';n.textContent='Contrôle de la géométrie seulement, pas de la résistance.';form.appendChild(n);
    }else if(!sp&&spErr)chk('err','⛔ '+spErr);
    prev.innerHTML=sp?stdSvg(sp):'';
    if(edit){bHole.disabled=bIns.disabled=!sp;bHole.onclick=()=>apply(sp,true);bIns.onclick=()=>apply(sp,false);return;}
    bIns.disabled=!sp;bHole.disabled=!sp||(!sp.seat&&!stdIsKey(sp));
    bHole.textContent=stdIsKey(sp)?'🎯 Dans une rainure…':sp&&sp.washer?'🎯 Sur des trous / oblongs…':'🎯 Sur des trous…';
    bHole.title=stdIsKey(sp)?'Cliquez le fond d’une rainure : la clavette s’y pose (centre de face ou centre du cercle), les rainures identiques aussi, en liaison rigide':'Cliquez un trou dans la vue : tous les trous identiques (simple, lamé, fraisé) reçoivent la pièce, en liaison rigide';
    bHole.onclick=()=>{if(sp){msg.textContent=stdIsKey(sp)?'Cliquez le fond d’une rainure…':sp.washer?'Cliquez un trou ou un oblong dans la vue…':'Cliquez un trou dans la vue…';stdHoleStart(sp);}};
    bIns.onclick=()=>{
      if(!sp)return;
      const o=stdInsert(sp);
      msg.textContent=!o?'Insertion impossible ici.':sp.pair?'✓ '+sp.name+' : les deux pièces sont posées':'✓ '+o.name+' inséré';
    };
  };
  // déplaçable par l'en-tête
  const hd=w.querySelector('.stdHead');
  hd.onmousedown=e=>{
    if(e.target.tagName==='BUTTON')return;
    const r=w.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;
    const mv=ev=>{w.style.left=Math.max(0,ev.clientX-dx)+'px';w.style.top=Math.max(0,ev.clientY-dy)+'px';};
    const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);e.preventDefault();
  };
  w.addEventListener('keydown',e=>{if(e.key==='Escape')close();e.stopPropagation();});
  document.body.appendChild(w);
  draw();
}
