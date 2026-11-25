// FAO — V0.99.97, Renfort.conceptcad (Fred : « Pourquoi l'entrée descend puis remonte pour aller
// chercher une autre entrée? », « Idem pour le contour N°2.... ») :
// 1. contour sur profil à plusieurs niveaux : MÊME entrée à chaque niveau, la fraise reste en bas
//    entre deux niveaux (fin de la sortie -> début de l'entrée à la même cote, plongée sur place) ;
// 2. « Rapide dans le vide » : ces passages ne sont jamais sautés, une plongée sur place dans le
//    vide devient un rapide jusqu'à 1 mm au-dessus ; vide au début : l'approche va droit
//    au-dessus de la vraie entrée (avant : descente à l'entrée prévue, remontée, rapide ailleurs) ;
// 3. purge des rapides hors brut / hors zone : la descente au-dessus d'une plongée est gardée
//    (avant : plongée en avance depuis le plan de sécurité, 30 mm dans le vide).
// Pur logique (aucun OCCT).
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);else p('  ok '+msg);};",
    "const r3=v=>Math.round(v*1000)/1000;",
    // profil de Renfort : 251 × 17, congés R5
    "const LOOP=[];[[120.5,-3.5,-90],[120.5,3.5,0],[-120.5,3.5,90],[-120.5,-3.5,180]].forEach(function(c){for(let k=0;k<=9;k++){const t=(c[2]+k*10)*Math.PI/180;LOOP.push([r3(c[0]+5*Math.cos(t)),r3(c[1]+5*Math.sin(t))]);}});LOOP.push(LOOP[0].slice());",
    "const O={toolD:10,ztop:0.5,zbot:-19.5,ap:10,nR:1,fin:0,ae:2,side:'ext',sens:'climb',overlap:1,secu:11};",
    "const mv=faoGenContourProfil(null,LOOP,O);",
    // niveaux : −9,5 et −19,5
    "const lv=[...new Set(mv.filter(m=>!m.r&&!m.ent).map(m=>m.z))].sort((a,b)=>b-a);",
    "att(lv.length===2&&Math.abs(lv[0]+9.5)<1e-6&&Math.abs(lv[1]+19.5)<1e-6,'deux niveaux −9,5 et −19,5 (vu '+lv.join(' ')+')');",
    // 1. même départ : premier point de coupe (hors entrée) de chaque niveau
    "const dep=lv.map(z=>{const i=mv.findIndex(m=>!m.r&&!m.ent&&Math.abs(m.z-z)<1e-6);return mv[i-1];});",
    "att(dep[0]&&dep[1]&&Math.hypot(dep[0].x-dep[1].x,dep[0].y-dep[1].y)<1e-6,'même entrée aux deux niveaux ('+dep.map(q=>q&&q.x.toFixed(3)+','+q.y.toFixed(3)).join(' / ')+')');",
    // reste en bas : aucun rapide entre le dernier point du niveau 1 et le premier du niveau 2
    "const iA=mv.map((m,i)=>(!m.r&&Math.abs(m.z+9.5)<1e-6)?i:-1).filter(i=>i>=0).pop();",
    "const iB=mv.findIndex(m=>!m.r&&Math.abs(m.z+19.5)<1e-6);",
    "const between=mv.slice(iA+1,iB+1);",
    "att(iA>0&&iB>iA&&between.every(m=>!m.r)&&between.some(m=>m.stay),'entre les niveaux : aucun rapide, la fraise reste en bas ('+between.length+' mouvement(s), stay)');",
    "const st=mv.filter(m=>m.stay);",
    "att(st.length===2&&Math.abs(st[0].z+9.5)<1e-6&&Math.abs(st[1].z+19.5)<1e-6&&Math.hypot(st[0].x-st[1].x,st[0].y-st[1].y)<1e-9,'passage : à plat à −9,5 jusqu’au début de l’entrée, puis plongée sur place à −19,5');",
    "att(faoDistToPoly(st[0].x,st[0].y,LOOP)>=5-0.01&&mv.diag.resteEnBas===1,'passage dans le libre (à '+faoDistToPoly(st[0].x,st[0].y,LOOP).toFixed(2)+' mm du profil), compté dans la fiche');",
    "const rp=mv.filter(m=>m.r).length;",
    "att(rp===3,'rapides : approche (2) et retrait final (1) seulement (vu '+rp+')');",
    // descente en pente : inchangée (une seule hélice)
    "const mvP=faoGenContourProfil(null,LOOP,Object.assign({},O,{descente:'pente',penteTour:2}));",
    "att(!mvP.some(m=>m.stay),'descente en pente : pas de passage entre niveaux (hélice continue)');",
    // trop loin (grand recouvrement) : la sortie finit loin de l'entrée -> remontée comme avant
    "const mvO=faoGenContourProfil(null,LOOP,Object.assign({},O,{overlap:40}));",
    "att(!mvO.some(m=>m.stay)&&mvO.filter(m=>m.r).length>3,'sortie loin de l’entrée (recouvrement 40) : remontée comme avant');",
    // 2. Rapide dans le vide : matière seulement à moins de 6 mm du profil, sous Z 0
    "const sd=(x,y)=>faoDistToPoly(x,y,LOOP);",
    "const mat=(x,y,z)=>z<0&&sd(x,y)<6.2;",
    "const tv=faoContourTrimAir(mv,mat,10);",
    "att(tv.filter(m=>m.stay).length===2,'vide : les passages entre niveaux ne sont jamais sautés');",
    "const k1=tv.findIndex(m=>m.stay&&Math.abs(m.z+19.5)<1e-6);",
    "att(k1>0&&tv[k1-1].r===1&&Math.abs(tv[k1-1].z+18.5)<1e-6&&Math.hypot(tv[k1-1].x-tv[k1].x,tv[k1-1].y-tv[k1].y)<1e-9&&tv.vide.plongees===1,'plongée sur place dans le vide : rapide jusqu’à 1 mm au-dessus, puis 1 mm en avance');",
    "const e0=tv.findIndex(m=>!m.r);",
    "const app=tv.slice(0,e0);",
    "att(app.length>=2&&app.every(m=>Math.hypot(m.x-tv[e0].x,m.y-tv[e0].y)<1e-9),'vide au début : toute l’approche au-dessus de la vraie entrée ('+tv[e0].x.toFixed(2)+','+tv[e0].y.toFixed(2)+'), jamais à l’entrée prévue');",
    "att(Math.hypot(app[0].x-mv[0].x,app[0].y-mv[0].y)>0.1,'l’entrée prévue (début de l’arc) était dans le vide : déplacée');",
    // V1.0.0 (suite complète) : tout dans le vide -> rien, passages entre niveaux compris
    "const tA=faoContourTrimAir(mv,function(){return false;},10);",
    "att(tA.filter(m=>!m.r).length===0&&tA.vide.passes===1,'tout vide : aucune coupe, passage entre niveaux compris');",
    // niveau du dessus vide (matière seulement sous −12) : approche directe, rapide jusqu'à 1 mm au-dessus du niveau 2
    "const matB=(x,y,z)=>z<-12&&sd(x,y)<6.2;",
    "const tB=faoContourTrimAir(mv,matB,10);",
    "const cB=tB.filter(m=>!m.r);",
    "att(cB.length>0&&cB.every(m=>m.z<-18.5+1e-6),'niveau du dessus vide : plus aucune coupe à −9,5 (vu z '+[...new Set(cB.map(m=>m.z))].join(' ')+')');",
    "const jB=tB.findIndex(m=>!m.r);",
    // matière à moins de 6,2 mm du profil : l'entrée se fait sur l'arc d'entrée du niveau 2, 1 mm avant la matière
    "att(jB>0&&tB[jB-1].r===1&&Math.abs(tB[jB-1].z+18.5)<1e-6&&Math.abs(tB[jB].z+19.5)<1e-6&&tB[jB].ent&&tB.slice(0,jB).every(m=>m.r&&Math.hypot(m.x-tB[jB].x,m.y-tB[jB].y)<1e-9)&&!tB.some(m=>m.stay),'niveau du dessus vide : approche droit au-dessus de l’entrée en matière du niveau 2, rapide jusqu’à −18,5, 1 mm en avance, plus de passage par −9,5');",
    // matière partout sous −12 : elle commence au bas de la plongée sur place
    "const tC=faoContourTrimAir(mv,(x,y,z)=>z<-12,10);",
    "const jC=tC.findIndex(m=>!m.r);",
    "att(jC>0&&tC[jC].stay&&Math.abs(tC[jC].z+19.5)<1e-6&&tC[jC-1].r===1&&Math.abs(tC[jC-1].z+18.5)<1e-6&&tC.slice(0,jC).every(m=>m.r&&Math.hypot(m.x-st[1].x,m.y-st[1].y)<1e-6)&&tC.filter(m=>!m.r).every(m=>m.z<-18.5),'matière dès le bas de la plongée sur place : approche au-dessus de l’entrée, rapide jusqu’à −18,5, 1 mm en avance');",
    // 3. purge hors brut : descente gardée au-dessus de la plongée
    "const job={stock:{x0:-130.5,y0:-13.5,z0:-33.5,x1:130.5,y1:13.5,z1:1}};",
    "const seq=[{r:1,x:0,y:0,z:11},{r:0,x:0,y:0,z:-5},{r:0,x:-140,y:-20,z:-5},{r:1,x:-140,y:-20,z:11},{r:1,x:-150,y:-25,z:11},{r:1,x:-150,y:-25,z:-18.5},{r:0,x:-150,y:-25,z:-19.5},{r:0,x:0,y:0,z:-19.5},{r:1,x:0,y:0,z:11}];",
    "const g=faoZoneStrip(seq,null,11,job);",
    "const ig=g.findIndex(m=>!m.r&&Math.abs(m.z+19.5)<1e-6);",
    "att(ig>0&&g[ig-1].r===1&&Math.abs(g[ig-1].z+18.5)<1e-6,'hors brut : la descente rapide à −18,5 est gardée avant la plongée (avant : plongée en avance depuis 11)');",
    "att(g.some(m=>m.r&&Math.abs(m.z-11)<1e-6&&m.x===-140)&&g.some(m=>m.r&&Math.abs(m.z-11)<1e-6&&m.x===-150),'hors brut : retrait et translation au plan comme avant');",
    "const nUp=g.filter(m=>m.r&&Math.abs(m.z-11)<1e-6).length;",
    "att(nUp===4,'hors brut : remontée seulement là où la série a été retirée, pas entre toutes les coupes (vu '+nUp+' rapides au plan, attendu 4)');",
    "const seq2=[{r:1,x:0,y:0,z:11},{r:0,x:0,y:0,z:-5},{r:0,x:-150,y:-25,z:-9.5},{r:1,x:-150,y:-25,z:-18.5},{r:0,x:-150,y:-25,z:-19.5},{r:0,x:0,y:0,z:-19.5},{r:1,x:0,y:0,z:11}];",
    "const g2=faoZoneStrip(seq2,null,11,job);",
    "att(g2.length===seq2.length&&!g2.some(m=>m.r&&Math.abs(m.z-11)<1e-6&&m.x===-150),'hors brut : descente sur place après une coupe, sans remonter');",
    // zone : même règle
    "const zc={at:(x,y)=>x>-130,cross:()=>false};",
    "const z2=faoZoneStrip(seq2,zc,11,job);",
    "const iz=z2.findIndex(m=>!m.r&&Math.abs(m.z+19.5)<1e-6);",
    "att(iz>0&&z2[iz-1].r===1&&Math.abs(z2[iz-1].z+18.5)<1e-6&&!z2.some(m=>m.r&&Math.abs(m.z-11)<1e-6&&m.x===-150),'zone : descente sur place gardée, sans remontée au plan de sécurité');",
    "const seq3=[{r:1,x:0,y:0,z:11},{r:0,x:0,y:0,z:-5},{r:0,x:-140,y:-20,z:-5},{r:1,x:-140,y:-20,z:11},{r:1,x:-150,y:-25,z:11},{r:1,x:-150,y:-25,z:-18.5},{r:0,x:-150,y:-25,z:-19.5},{r:0,x:0,y:0,z:-19.5},{r:1,x:0,y:0,z:11}];",
    "const z3=faoZoneStrip(seq3,zc,11,job);",
    "const i3=z3.findIndex(m=>!m.r&&Math.abs(m.z+19.5)<1e-6);",
    "att(i3>1&&Math.abs(z3[i3-1].z+18.5)<1e-6&&Math.abs(z3[i3-2].z-11)<1e-6,'zone : ailleurs, retrait au plan puis descente rapide jusqu’à 1 mm au-dessus');",
    // clé de parcours marquée
    "const J=faoDefaultJob();J.ops=[{id:'c',type:'contour',strat:'profil',toolId:(J.tools[0]||{}).id,limit:{mode:'chain',loop:LOOP,closed:true,nEdges:8},ztop:0.5,zbot:-19.5,ap:10}];",
    "let k='';try{k=String(faoOpMovesKey(J.ops[0],J)||'');}catch(e){}",
    "att(!k||k.indexOf('entree-niveaux')>=0,'clé des contours marquée entree-niveaux (recalcul automatique)');",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}",
    "else p('TOUT EST CONFORME');",
    "return P.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fao_contour_niveaux.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
