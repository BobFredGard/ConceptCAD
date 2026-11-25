// FAO — DÉCOUPE À LA FRAISE 3 TAILLES (V0.99.86, src/89-fao-decoupe-3tailles.js).
// Bloc 60×40×20 (x 20..80, y 10..50), fraise Ø20 × 3, col Ø8 (6 mm de profondeur au plus).
// 1. selon X, côté Y− : face trouvée toute seule (y 10), centre à 10 − 5 = 5 pour 5 mm de
//    profondeur, une passe à z 8, entrée et sortie DROITES à rayon + 10 = 20 mm des bouts,
//    avalant = vers −X (matière à droite), descente et remontée dehors ;
// 2. opposition, côté Y+, les deux côtés, selon Y, zones d'entrée / sortie réglées ;
// 3. hauteur 7 : passes 12, 9, 8 ; passes latérales et finition ;
// 4. alertes : col qui frotte (profondeur 7 > 6), descente dans la matière (zone trop
//    courte), disque plus épais que la découpe, pas de pièce à cette hauteur ;
// 5. le long d'une arête droite (chaîne ouverte d'une seule arête) ;
// 6. défauts, sanitise, bouton, aiguillage (brut ajusté / brut plus grand), libellé, fiche ;
// 7. V0.99.91 : le brut est de la matière à couper — brut plus long que la pièce : le disque le
//    traverse, zones comptées depuis le bord du brut, descente hors du brut ; brut aussi devant la
//    face : traversé aussi, et le col frotte s'il y en a trop.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
    "const mkBox=function(x0,x1,y0,y1,z0,z1){return {v:[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],t:[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[2,3,7],[2,7,6],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]};};",
    "const dRect=function(x,y,x0,x1,y0,y1){const dx=Math.max(x0-x,0,x-x1),dy=Math.max(y0-y,0,y-y1);if(dx>0||dy>0)return Math.hypot(dx,dy);return -Math.min(x-x0,x1-x,y-y0,y1-y);};",
    "const verts=function(mv){const o=[];for(let i=1;i<mv.length;i++){const a=mv[i-1],b=mv[i];if(Math.hypot(b.x-a.x,b.y-a.y)<1e-6&&Math.abs(b.z-a.z)>1e-6)o.push(b);}return o;};",
    "const cuts=function(mv){return mv.filter(m=>!m.r);};",
    "const BLK=mkBox(20,80,10,50,0,20);",
    "const o={toolD:20,ep:3,rn:4,secu:30,zbot:8,dr:5,dir:'X',side:'-',nR:1,fin:0,sens:'climb'};",
    // --- 1. selon X, côté Y−
    "const mv=faoGenSlotCut(BLK,o);const dg=mv.diag||{};",
    "p('selon X : '+mv.length+' moves, diag '+JSON.stringify(dg));",
    "att(dg.walls.length===1&&dg.walls[0].side==='Y−'&&dg.walls[0].at===10&&dg.walls[0].from===20&&dg.walls[0].to===80,'selon X : face Y− trouvée à y 10, de x 20 à 80');",
    "const c1=cuts(mv);",
    "att(c1.length>=4&&c1.every(m=>Math.abs(m.y-5)<1e-6&&Math.abs(m.z-8)<1e-6),'selon X : passe à y 5 (10 − (10 − 5)), z 8');",
    "const xs=c1.map(m=>m.x);",
    "att(Math.max.apply(null,xs)===100&&Math.min.apply(null,xs)===0,'selon X : entrée et sortie à rayon + 10 = 20 mm des bouts (x 0 à 100), vu '+Math.min.apply(null,xs)+' à '+Math.max.apply(null,xs));",
    "att(c1[0].x===100&&c1[c1.length-1].x===0,'avalant : la passe va vers −X (matière à droite)');",
    "att(c1.every(function(m,i){return !i||m.x<=c1[i-1].x+1e-9;}),'tout droit : x ne revient jamais en arrière');",
    "const v1=verts(mv);",
    "att(v1.length>=2&&v1.every(m=>dRect(m.x,m.y,20,80,10,50)>=10),'descente et remontée dehors seulement (vu '+v1.map(m=>m.x+','+m.y).join(' ')+')');",
    "att(mv.every(function(m,i){return !i||Math.abs(m.x-mv[i-1].x)<1e-9||Math.abs(m.y-mv[i-1].y)<1e-9;}),'entrée et sortie droites : aucun arc, aucun biais');",
    "att(dg.levels===1&&dg.passes===1&&!dg.noEntry&&!dg.thick&&!dg.over&&!dg.noPart,'selon X : une passe, aucune alerte');",
    "att(mv[mv.length-1].r===1&&mv[mv.length-1].z===30,'retrait final à secu');",
    // --- 2. variantes
    "const c2=cuts(faoGenSlotCut(BLK,Object.assign({},o,{sens:'opp'})));",
    "att(c2[0].x===0&&c2[c2.length-1].x===100,'opposition : vers +X');",
    "const c3=cuts(faoGenSlotCut(BLK,Object.assign({},o,{side:'+'})));",
    "att(c3.every(m=>Math.abs(m.y-55)<1e-6)&&c3[0].x===0&&c3[c3.length-1].x===100,'côté Y+ : y 55, avalant vers +X');",
    "const mv4=faoGenSlotCut(BLK,Object.assign({},o,{side:'both'}));const c4=cuts(mv4);",
    "att(mv4.diag.walls.length===2&&c4.some(m=>Math.abs(m.y-5)<1e-6)&&c4.some(m=>Math.abs(m.y-55)<1e-6)&&mv4.diag.passes===2,'les deux côtés : y 5 puis y 55');",
    "const iY=c4.findIndex(m=>Math.abs(m.y-55)<1e-6);",
    "att(c4.slice(0,iY).every(m=>Math.abs(m.y-5)<1e-6),'les deux côtés : le premier côté fini avant le second');",
    "const c5=cuts(faoGenSlotCut(BLK,Object.assign({},o,{dir:'Y'})));",
    "att(c5.every(m=>Math.abs(m.x-15)<1e-6)&&c5[0].y===-10&&c5[c5.length-1].y===70,'selon Y, côté X− : x 15, de y −10 à 70, avalant vers +Y');",
    "const c6=cuts(faoGenSlotCut(BLK,Object.assign({},o,{lin:30,lout:12})));",
    "att(c6[0].x===110&&c6[c6.length-1].x===8,'zones d’entrée 30 et de sortie 12 (vu '+c6[0].x+' / '+c6[c6.length-1].x+')');",
    // --- 3. hauteur, passes
    "const mv7=faoGenSlotCut(BLK,Object.assign({},o,{slotH:7}));",
    "const zs=[];cuts(mv7).forEach(m=>{const z=+m.z.toFixed(3);if(zs[zs.length-1]!==z)zs.push(z);});",
    "att(zs.join(',')==='12,9,8','hauteur 7 : passes 12, 9, 8 (vu '+zs.join(',')+')');",
    "const mv8=faoGenSlotCut(BLK,Object.assign({},o,{nR:2,ae:2,fin:0.5}));",
    "const ys=[];cuts(mv8).forEach(m=>{const y=+m.y.toFixed(3);if(ys[ys.length-1]!==y)ys.push(y);});",
    "att(ys.join(',')==='2.5,4.5,5','2 passes écartées de 2 + finition 0,5 : y 2,5, 4,5 puis 5 (vu '+ys.join(',')+')');",
    // --- 4. alertes
    "const nk=function(x,y){return dRect(x,y,20,80,10,50)<4?20:-1/0;};",
    "const mvN=faoGenSlotCut(BLK,Object.assign({},o,{dr:7,neckTop:nk}));",
    "att(mvN.diag.neck>0&&faoGenSlotCut(BLK,Object.assign({},o,{neckTop:nk})).diag.neck===0,'col : profondeur 7 > 6 signalée, 5 non (vu '+mvN.diag.neck+')');",
    "const cl=function(x,y){return dRect(x,y,20,80,10,50)>=10.5;};",
    "att(faoGenSlotCut(BLK,Object.assign({},o,{clear:cl})).diag.noEntry===0,'zones de 20 : le disque descend et remonte dégagé');",
    "att(faoGenSlotCut(BLK,Object.assign({},o,{clear:cl,lin:5})).diag.noEntry===1,'zone d’entrée de 5 : descente dans la matière signalée');",
    "att(faoGenSlotCut(BLK,Object.assign({},o,{slotH:2})).diag.thick===1,'disque plus épais que la découpe');",
    "const mvP=faoGenSlotCut(BLK,Object.assign({},o,{zbot:25}));",
    "att(mvP.length===0&&mvP.diag.noPart===1,'au-dessus de la pièce : aucune pièce, aucun parcours');",
    // --- 5. le long d'une arête droite
    "const E=[{pts:[[20,10,20],[80,10,20]],mid:[50,10,20],len:60}];",
    "const res=faoLoopFromChains(E,[[0]],false);",
    "att(res.loop.length===3&&res.closed===false,'une arête seule : chaîne ouverte (aller-retour)');",
    "att(faoLoopLineOK({type:'slotcut'},res)&&!faoLoopLineOK({type:'contour',strat:'profil'},res),'droite acceptée en découpe seulement');",
    "att(faoLoopFromChains(E,[[0]],true).loop.length===0,'zone (plusieurs contours) : une arête seule reste refusée');",
    "const c9=cuts(faoGenSlotCut(BLK,Object.assign({},o,{dir:'edge',limit:{mode:'chain',loop:res.loop,closed:false}})));",
    "att(c9.length>=4&&c9.every(m=>Math.abs(m.y-5)<1e-6)&&c9[0].x===100&&c9[c9.length-1].x===0,'le long de l’arête : matière trouvée côté +Y, passe à y 5 vers −X (vu y '+(c9[0]&&c9[0].y)+')');",
    // --- 6. outil, défauts, sanitise, bouton
    "const T3={id:'TS',num:12,name:'3 tailles D20',kind:'slot',d:20,flutes:8,vc:120,fz:0.03,lc:3,dDeg:8};",
    "const G=faoSlotCutGeom({zbot:8},T3);",
    "att(G.lin===20&&G.lout===20&&G.dr===5&&G.h===3&&G.pmax===6,'défauts : zones rayon + 10 = 20, profondeur 5, hauteur = épaisseur');",
    "att(faoSlotCutGeom({zbot:8,cutDir:'edge'},T3).dr===0,'le long d’une arête : décalage 0 par défaut');",
    "att(faoAddOpsSpec()[3][0]==='slotcut'&&/Découpe 3 tailles/.test(faoAddOpsSpec()[3][1]),'bouton « + Découpe 3 tailles » après Contour');",
    "const od=faoOpDefaults('slotcut');",
    "att(od&&od.type==='slotcut'&&od.sens==='avalant'&&isFinite(od.zbot),'opération par défaut');",
    "att(faoMeshOp(od)&&faoHtsOps(od)&&faoZoneDone(od),'calculée sur le maillage, plan de coupe en référence + décalage, sans zone');",
    "const sA={id:'a',type:'slotcut',cutDir:'Y',cutSide:'both',slotH:4,slotDr:2.5,slotLin:30,slotLout:0,limit:{mode:'chain',loop:[]}};",
    "const sB={id:'b',type:'slotcut',cutDir:'Z',cutSide:'x',slotH:-1,slotDr:'x',slotLin:-3,cside:'ext',slotDz:2};",
    "const sC={id:'c',type:'contour',strat:'profil',cutDir:'Y',slotLin:3};",
    "faoSanitiseOps({ops:[sA,sB,sC]});",
    "att(sA.cutDir==='Y'&&sA.cutSide==='both'&&sA.slotH===4&&sA.slotDr===2.5&&sA.slotLin===30&&sA.slotLout===0&&!sA.limit,'sanitise : réglages gardés, limite retirée hors arête');",
    "att(!('cutDir' in sB)&&!('cutSide' in sB)&&!('slotH' in sB)&&!('slotDr' in sB)&&!('slotLin' in sB)&&!('cside' in sB)&&!('slotDz' in sB),'sanitise : valeurs invalides purgées');",
    "att(!('cutDir' in sC)&&!('slotLin' in sC),'sanitise : réglages de découpe retirés du contour');",
    // aiguillage : brut ajusté à la pièce
    "const job=faoDefaultJob();job.stock={x0:20,y0:10,z0:0,x1:80,y1:50,z1:20};job.tools=[T3];",
    "const op=faoOpDefaults('slotcut');op.id='d1';op.toolId='TS';op.zbot=8;op.slotDr=5;job.ops=[op];",
    "const keepAM=faoActiveMesh;faoActiveMesh=function(){return {mesh:BLK,box:{x0:20,y0:10,x1:80,y1:50}};};",
    "let mvD=[];try{mvD=faoOpMoves(op,job);}catch(e){att(false,'aiguillage : exception '+e.message);}",
    "p('aiguillage : '+mvD.length+' moves, diag '+JSON.stringify(op.geoDiag));",
    "att(cuts(mvD).length>=4&&cuts(mvD).every(m=>Math.abs(m.y-5)<1e-6&&Math.abs(m.z-8)<1e-6),'aiguillage : passe à y 5, z 8');",
    "att(op.geoDiag&&op.geoDiag.cut===1&&!op.geoDiag.noEntry&&op.geoDiag.neck===0,'aiguillage : brut ajusté, aucune alerte');",
    "att(/^Découpe 3 tailles selon X côté Y− Z 8 -> 11 prof\\. 5 \\[T12 D20\\]/.test(faoOpLabel(op,job)),'libellé : '+faoOpLabel(op,job));",
    // V0.99.91 : brut plus long que la pièce (X 0..110, face Y− à la pièce) : traversé, descente hors du brut
    "const job3=faoDefaultJob();job3.stock={x0:0,y0:10,z0:0,x1:110,y1:50,z1:20};job3.tools=[T3];",
    "const op3=faoOpDefaults('slotcut');op3.id='d3';op3.toolId='TS';op3.zbot=8;op3.slotDr=5;job3.ops=[op3];",
    "let mv3=[];try{mv3=faoOpMoves(op3,job3);}catch(e){att(false,'brut long : exception '+e.message);}",
    "p('brut long : diag '+JSON.stringify(op3.geoDiag));",
    "const g3=op3.geoDiag||{},k3=cuts(mv3),xs3=k3.map(m=>m.x);",
    "att(!g3.noEntry&&g3.neck===0&&Math.abs(g3.trav-30)<=1,'brut long : traversé sans alerte, 30 mm de brut au plus (vu '+g3.trav+')');",
    "att(Math.abs(Math.max.apply(null,xs3)-130)<=1&&Math.abs(Math.min.apply(null,xs3)+20)<=1,'brut long : descente à X 130 (110 + 20), remontée à X −20 (0 − 20), vu '+Math.max.apply(null,xs3)+' / '+Math.min.apply(null,xs3));",
    "att(k3.every(m=>Math.abs(m.y-5)<1e-6),'brut long : tout droit à y 5');",
    "att(/traverse jusqu’à [0-9.]+ mm de brut/.test((function(){const k=faoSetup;faoSetup=function(){return job3;};let c=null;try{c=faoOpCardElement(job3,op3,0);}catch(e){}faoSetup=k;const all=function(root){const out=[];(function w(n){out.push(n);(n.children||[]).forEach(w);})(root);return out;};return c?all(c).map(n=>String(n.textContent||'')).join('|'):'';})()),'fiche : brut traversé annoncé');",
    // brut plus grand aussi devant la face (Y 0) : 10 mm de brut + 5 de profondeur > 6 → le col frotte
    "const job2=faoDefaultJob();job2.stock={x0:0,y0:0,z0:0,x1:110,y1:60,z1:20};job2.tools=[T3];",
    "const op2=faoOpDefaults('slotcut');op2.id='d2';op2.toolId='TS';op2.zbot=8;op2.slotDr=5;job2.ops=[op2];",
    "try{faoOpMoves(op2,job2);}catch(e){att(false,'brut large : exception '+e.message);}",
    "p('brut large : diag '+JSON.stringify(op2.geoDiag));",
    "att(op2.geoDiag&&!op2.geoDiag.noEntry&&op2.geoDiag.neck>0,'brut devant la face : traversé, le col frotte (vu '+JSON.stringify(op2.geoDiag&&{n:op2.geoDiag.noEntry,c:op2.geoDiag.neck})+')');",
    "faoActiveMesh=keepAM;",
    "const opF=faoOpDefaults('slotcut');opF.id='f1';opF.toolId='T1';const jobF=faoDefaultJob();jobF.ops=[opF];",
    "att(faoOpMoves(opF,jobF).length===0,'découpe avec une fraise ordinaire : aucun parcours');",
    // signature : la profondeur change le parcours
    "const kA=JSON.stringify(faoOpSig(op));op.slotLin=40;const kB=JSON.stringify(faoOpSig(op));delete op.slotLin;",
    "att(kA!==kB&&/slotDr/.test(kA),'clé : zone d’entrée et profondeur dans la signature');",
    // fiche
    "const all=function(root){const out=[];(function w(n){out.push(n);(n.children||[]).forEach(w);})(root);return out;};",
    "const keepS=faoSetup;faoSetup=function(){return job;};",
    "let card=null;try{card=faoOpCardElement(job,op,0);}catch(e){att(false,'fiche : exception '+e.message);}",
    "faoSetup=keepS;",
    "const txt=card?all(card).map(n=>String(n.textContent||'')).join('|'):'';",
    "att(card&&/Zone de découpe/.test(txt)&&/Trajet/.test(txt)&&/profondeur/.test(txt)&&/zone d’entrée/.test(txt)&&/zone de sortie/.test(txt)&&/Plan de coupe/.test(txt),'fiche : trajet, profondeur, zones d’entrée et de sortie, plan de coupe');",
    "att(card&&!/Attaches/.test(txt)&&!/Îlot/.test(txt),'fiche : ni attaches ni îlot');",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(function(m){p('  x '+m);});}",
    "else p('TOUT EST CONFORME');",
    "return {txt:P.join(String.fromCharCode(10)),ko:ATT.length};"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fao_decoupe_3tailles.js'});
  console.log(r.txt);
  process.exit(r.ko?1:0);
})().catch(e=>{console.log('FATAL',e&&e.stack||e);process.exit(1);});
