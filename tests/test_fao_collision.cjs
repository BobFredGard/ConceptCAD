// V0.91.0 : collision du porte-outil (et d'une queue plus grosse que l'outil) dans la simulation.
// Pur logique (aucun OCCT) : poche profonde rejouée sur la carte de hauteurs du brut.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    "const S=faoSetup();const job=faoDefaultJob();",
    "S.stock={x0:0,y0:0,z0:0,x1:100,y1:80,z1:40};S.tools=job.tools;S.holders=[];",
    "const poche=(id,zbot)=>({id:id,type:'pocket',toolId:'T1',x0:10,y0:10,x1:90,y1:70,ztop:40,zbot:zbot,ap:5,ae:5});",
    "S.ops=[poche('oA',10)];faoSanitiseOps(S);",
    "const T1=faoToolById(S,'T1');",
    // ── 1. silhouette au-dessus de la coupe
    "let up=faoToolUpper(T1,null);",
    "A(up.bodyH===25&&up.zHold===35&&up.rMax===11&&up.rCut===5,'1a : fraise Ø10 générique : coupe 25, porte-outil à 35 mm de la pointe, Ø22');",
    "A(faoUpperZAt(up,5)===25&&faoUpperZAt(up,8)===35&&faoUpperZAt(up,11.5)===Infinity,'1b : cote la plus basse de la silhouette selon le rayon');",
    "const H=faoHolderNew(S,null,28);",
    "up=faoToolUpper(T1,H);",
    "A(up.rMax===22&&Math.abs(up.top-(35+58))<1e-9&&Math.abs(faoUpperZAt(up,13.5)-35.5)<1e-9&&Math.abs(faoUpperZAt(up,18)-(35+26+6))<1e-9,'1c : porte-outil réel : chanfrein puis cône suivis au rayon près');",
    "const TQ={id:'q',num:9,name:'D6 queue 12',kind:'flat',d:6,flutes:2,vc:200,fz:0.03,dq:12,lc:10,lDeg:10,lCq:6,lsm:40};",
    "const uq=faoToolUpper(TQ,null);",
    "A(uq.rCut===3&&faoUpperZAt(uq,6)===16&&Math.abs(faoUpperZAt(uq,4.5)-13)<1e-9,'1d : queue Ø12 sur fraise Ø6 : cône de raccord de 6 mm compté');",
    // ── 2. poche de 30 mm, outil assez sorti : rien
    "let r=faoCollisionCheck(S);",
    "A(r.hits.length===0&&r.n===0&&r.pts>100,'2a : sous mandrin 35 mm, poche de 30 mm : aucune collision ('+r.pts+' points, '+r.ms+' ms)');",
    "A(/aucune/.test(faoCollText(r,S)),'2b : message « aucune collision »');",
    // ── 3. outil trop rentré : le porte-outil générique touche le bord de la poche
    "delete T1.holderId;T1.lsm=27;",
    "r=faoCollisionCheck(S);",
    "A(r.hits.length===1&&r.hits[0].op===S.ops[0]&&r.hits[0].idx===0&&r.hits[0].part==='holder','3a : sous mandrin 27 mm : collision du porte-outil sur l’opération 1');",
    "A(Math.abs(r.hits[0].d-3)<0.01,'3b : interférence maxi = 3 mm (40 − (10 + 27)) : '+r.hits[0].d);",
    "A(r.hits[0].z<=13+1e-6&&r.hits[0].t>0&&r.hits[0].t<faoViewerBuild(S).T,'3c : premier contact daté, pendant les passes basses (Z pointe '+r.hits[0].z+')');",
    "A(/porte-outil/.test(faoCollText(r,S))&&/n° 1/.test(faoCollText(r,S)),'3d : message : '+faoCollText(r,S).slice(0,90));",
    // ── 4. la matière déjà enlevée ne compte pas : même outil au centre d'une poche déjà ouverte
    "const g=faoCollGrid(faoStock(),S);const u27=faoToolUpper(T1,null);",
    "A(faoCollAt(g,u27,50,40,10).part==='holder','4a : brut plein : descendre à Z10 met le porte-outil dans la matière');",
    "for(let y=20;y<=60;y+=4)faoMatterCarveSeg(g,20,y,10,80,y,10,5,null,0,null);",
    "A(faoCollAt(g,u27,50,40,10)===null,'4b : poche ouverte autour : plus de collision au centre');",
    "A(faoCollAt(g,u27,22,40,10)!==null&&faoCollAt(g,u27,22,40,13.1)===null,'4c : près du bord : collision à Z10, plus à Z13,1');",
    // ── 5. porte-outil réel plus large : collision plus tôt, et levée en sortant l'outil
    "T1.lsm=35;T1.holderId=H.id;H.segs=[{t:'cyl',d:60,h:40}];",
    "r=faoCollisionCheck(S);A(r.hits.length===0,'5a : porte-outil Ø60 à 35 mm : poche de 30 mm passe encore');",
    "S.ops=[poche('oA',2)];faoSanitiseOps(S);",
    "r=faoCollisionCheck(S);A(r.hits.length===1&&Math.abs(r.hits[0].d-3)<0.01&&r.hits[0].part==='holder','5b : poche de 38 mm : porte-outil dans la matière de 3 mm');",
    "H.segs=[{t:'chf',c:5,a:45},{t:'cyl',d:60,h:40}];",
    "const g5=faoCollGrid(faoStock(),S);faoMatterCarveSeg(g5,50,40,0,50,40,0,27,null,0,null);",
    "const uCyl=faoToolUpper(T1,{segs:[{t:'cyl',d:60,h:40}]}),uChf=faoToolUpper(T1,H);",
    "A(faoCollAt(g5,uCyl,50,40,4)!==null&&faoCollAt(g5,uChf,50,40,4)===null,'5c : alésage Ø54 : le cylindre Ø60 accroche le bord, le même avec un chanfrein d’entrée de 5 mm passe');",
    "T1.lsm=40;A(faoCollisionCheck(S).hits.length===0,'5d : outil sorti à 40 mm : plus de collision');",
    // ── 6. queue plus grosse que l'outil
    "S.tools.push(TQ);S.ops=[Object.assign(poche('oB',20),{toolId:'q',ae:3,ap:4})];faoSanitiseOps(S);",
    "r=faoCollisionCheck(S);",
    "A(r.hits.length===1&&r.hits[0].part==='shank'&&r.hits[0].d>3,'6a : poche de 20 mm, coupe 10 mm, queue Ø12 : la queue touche ('+(r.hits[0]&&r.hits[0].d.toFixed(2))+' mm)');",
    "A(/queue/.test(faoCollText(r,S)),'6b : message « queue »');",
    "TQ.lc=22;TQ.lDeg=22;A(faoCollisionCheck(S).hits.length===0,'6c : coupe de 22 mm : la queue reste au-dessus');",
    // ── 7. deux opérations : seule la fautive est signalée ; contrôle sans effet sur le posage
    "T1.lsm=27;delete T1.holderId;S.ops=[poche('o1',30),poche('o2',10)];faoSanitiseOps(S);",
    "faoViewerBuild(S);const avant=JSON.stringify(S);r=faoCollisionCheck(S);",
    "A(r.hits.length===1&&r.hits[0].idx===1,'7a : poche de 10 mm puis de 30 mm : seule la 2ᵉ opération est signalée');",
    "A(JSON.stringify(S)===avant,'7b : le contrôle ne modifie rien dans le posage');",
    // ── 8. brut cylindrique : hors du disque, pas de matière
    "const gc=faoCollGrid({x0:0,y0:0,z0:0,x1:100,y1:100,z1:40,cyl:{axis:'z',r:50,c:[50,50,0]}},S);",
    "A(gc.h[0]===0&&gc.h[Math.floor(gc.ny/2)*gc.nx+Math.floor(gc.nx/2)]===40,'8 : brut cylindrique : coins vides, centre plein');",
    // ── 9. simulation : bouton, résultat, saut au contact
    "A(faoViewerOpen()===true&&!!faoVw&&faoVw.tl.length===faoVw.pts.length,'9a : simulation ouverte, fiche outil connue en chaque point');",
    "A(faoVw.toolH===25&&typeof faoVw.upSig==='string','9b : outil affiché à sa longueur de coupe réelle (25 mm)');",
    "const c=faoViewerCollRun();",
    "A(c&&c.hits.length===1&&faoVw.coll===c,'9c : bouton Collisions : 1 opération en collision');",
    "A(faoVwCollBtn&&/1 collision/.test(faoVwCollBtn.textContent),'9d : le bouton affiche « '+(faoVwCollBtn&&faoVwCollBtn.textContent)+' »');",
    "faoViewerCollRun();A(Math.abs(faoVw.t-c.hits[0].t)<1e-9&&faoVw.playing===false,'9e : second clic : la simulation saute au contact, en pause');",
    "faoViewerClose();A(faoVw===null,'9f : fermeture propre');",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'fao_collision.js'});
  console.log('=== V0.91.0 : collision du porte-outil dans la simulation ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,900));process.exit(1);});
