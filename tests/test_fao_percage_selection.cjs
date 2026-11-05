// V0.33.2 : FAO — Perçage créé sur des trous sélectionnés : la gamme est retrouvée et posée seule.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    "occt=__realOcct;occtReady=true;",
    "const box={id:'skA',name:'Bloc',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:0,y:0},b:{x:120,y:0},c:{x:120,y:60},d:{x:0,y:60}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:20,visible:false};",
    "const mk=(id,pts)=>{const P={},E=[];pts.forEach((q,i)=>{P['h'+i]={x:q[0],y:q[1]};E.push({id:'e'+i,t:'cpoint',p:'h'+i,hole:true});});",
    "  return {id:id,name:id,plane:'XY',origin:[0,0,40],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:P,entities:E,constraints:[],dims:[],seq:30,visible:false};};",
    "doc.sketches=[box,mk('sM',[[15,15],[15,45]]),mk('sT',[[40,15],[40,45]]),mk('sC',[[70,15],[70,45]]),mk('sP',[[100,30]]),{id:'sX',name:'sX',plane:'XY',origin:[120,30,20],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0],points:{h0:{x:0,y:0}},entities:[{id:'e0',t:'cpoint',p:'h0',hole:true}],constraints:[],dims:[],seq:40,visible:false},{id:'sY',name:'sY',plane:'XY',origin:[60,0,20],axU:[1,0,0],axV:[0,0,1],axN:[0,-1,0],points:{h0:{x:0,y:0}},entities:[{id:'e0',t:'cpoint',p:'h0',hole:true}],constraints:[],dims:[],seq:41,visible:false}];",
    "doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skA',distance:40,op:'add',visible:true}];",
    "doc.bodies=[];delete doc.activeBody;markDirty();rebuild();",
    "askHole('sM');const fM=doc.features[doc.features.length-1];fM.thread={size:'M8',p:1.25,len:12};fM.d=6.75;fM.depth=16;",
    "askHole('sT');const fT=doc.features[doc.features.length-1];fT.d=8;fT.end='through';",
    "askHole('sC');const fC=doc.features[doc.features.length-1];fC.kind='cbore';fC.d=6.6;fC.cbD=11;fC.cbH=6.4;fC.end='through';",
    "askHole('sP');const fP=doc.features[doc.features.length-1];fP.d=5;fP.depth=30;",
    "askHole('sX');const fX=doc.features[doc.features.length-1];fX.d=5;fX.depth=15;fX.thread={size:'M6',p:1,len:10};",
    "askHole('sY');const fY=doc.features[doc.features.length-1];fY.d=7;fY.end='through';",
    "markDirty();rebuild();faoHoleCache={shape:null,list:null};",
    "A(builtEngine==='exact'&&!doc.features.some(f=>f._err),'0 : pièce exacte (M8, Ø8, lamage CHC, Ø5 profond)');",
    "const S=faoSetup();S.ops=[];S.name='TAR';S.stock={x0:0,y0:0,z0:0,x1:120,y1:60,z1:40};",
    "const P=(x,y,z)=>({point:{x:x,y:y,z:z}});",
    "const desc=()=>S.ops.map(o=>o.cycle+'('+(o.holes||[]).length+') '+faoToolById(S,o.toolId).name).join(' → ');",
    // ── 1. clic sur la paroi du M8 + Ctrl+clic sur le lamage
    "selFaces=[P(15+3.375,15,35),P(70+5.5,15,37)];sel={kind:null,id:null};",
    "let op=faoOpDefaults('drill');S.ops.push(op);let made=faoDrillFromSel(S,op);",
    "out.log.push('gamme 1 : '+desc());",
    "const cy=S.ops.map(o=>o.cycle);",
    "A(made&&S.ops.indexOf(op)<0,'1a : l’opération vide est remplacée par la gamme');",
    "A(cy[0]==='spot'&&cy[cy.length-1]==='tap','1b : pointage en tête, taraudage en dernier');",
    "A(S.ops.some(o=>o.cycle==='helix'&&o.holes.every(h=>Math.abs(h.d-11)<0.02)),'1c : clic sur le lamage → lamage Ø11 fraisé');",
    "A(S.ops.some(o=>(o.cycle==='drill'||o.cycle==='peck')&&o.holes.length===2&&o.holes.every(h=>Math.abs(h.d-6.6)<0.02)),'1d : … et son perçage Ø6,6 (même fonction Perçage) retrouvé seul');",
    "A(S.ops.some(o=>(o.cycle==='drill'||o.cycle==='peck')&&o.holes.length===2&&o.holes.every(h=>Math.abs(h.d-6.75)<0.02)),'1e : le M8 : avant-trou Ø6,75 sur les 2 trous de la fonction');",
    "A(!S.ops.some(o=>(o.holes||[]).some(h=>Math.abs(h.d-8)<0.02||Math.abs(h.d-5)<0.02)),'1f : trous non sélectionnés (Ø8, Ø5) laissés de côté');",
    "A(selFaces.length===0,'1g : sélection de faces vidée après la gamme');",
    // ── 2. fonction Perçage sélectionnée (arbre / timeline), aucune face
    "S.ops=[];selFaces=[];sel={kind:'feature',id:fP.id};",
    "op=faoOpDefaults('drill');S.ops.push(op);made=faoDrillFromSel(S,op);",
    "out.log.push('gamme 2 : '+desc());",
    "A(S.ops.length===2&&S.ops[0].cycle==='spot'&&S.ops[1].cycle==='peck'&&S.ops[1].holes.length===1,'2a : fonction Ø5 × 30 sélectionnée → pointage + débourrage');",
    // ── 3. rien de sélectionné : opération vide, comme avant
    "S.ops=[];selFaces=[P(60,30,40)];sel={kind:null,id:null};",
    "op=faoOpDefaults('drill');S.ops.push(op);made=faoDrillFromSel(S,op);",
    "A(made===null&&S.ops.length===1&&S.ops[0]===op&&!op.holeSel.length,'3a : face qui n’est pas un trou → opération vide, à remplir');",
    // ── 4. 3+2 : trou sur le flanc → Z de l'opération = axe du trou, sortant par l'entrée
    "const C=(x,y,z,ax,c)=>({point:{x:x,y:y,z:z},geom:{kind:'cyl',axis:{x:ax[0],y:ax[1],z:ax[2]},center:{x:c[0],y:c[1],z:c[2]}}});",
    "S.ops=[];selFaces=[C(110,33,20,[-1,0,0],[120,30,20])];sel={kind:null,id:null};",
    "op=faoOpDefaults('drill');S.ops.push(op);made=faoDrillFromSel(S,op);",
    "out.log.push('gamme 4 : '+desc()+' · Z '+JSON.stringify(S.ops[0]&&S.ops[0].frame));",
    "A(made&&S.ops.length===3&&S.ops.every(o=>o.frame&&o.frame.z==='+X'),'4a : trou borgne du flanc X120 → repère 3+2 Z = +X sur toute la gamme');",
    "A(S.ops[1].cycle==='drill'&&S.ops[1].holes.length===1&&Math.abs(S.ops[1].holes[0].d-5)<0.02&&!S.ops[1].holes[0].through,'4b : Ø5 borgne retrouvé dans ce repère');",
    "A(S.ops[2].cycle==='tap'&&S.ops[2].holes.length===1&&S.ops[2].holes[0].thread&&S.ops[2].holes[0].thread.size==='M6'&&faoToolById(S,S.ops[2].toolId).name==='Taraud M6','4b2 : en 3+2 le trou garde sa fonction Perçage : taraudage M6 du flanc');",
    "const mv=faoOpMoves(S.ops[1],S).filter(m=>!m.r),xs=mv.map(m=>m.x);",
    "A(mv.length&&Math.min.apply(null,xs)<106&&Math.min.apply(null,xs)>103,'4c : la pointe descend le long de −X jusqu’à X≈'+Math.min.apply(null,xs).toFixed(2)+' (fond X105 − pointe)');",
    "A(/réglez X/.test(faceEl.textContent),'4d : message : régler X ensuite');",
    // sens retrouvé sans la fonction Perçage (géométrie seule : borgne d'un côté)
    "S.ops=[];selFaces=[C(110,33,20,[1,0,0],[120,30,20])];const hA=holeAxis;holeAxis=function(){throw 0;};",
    "op=faoOpDefaults('drill');S.ops.push(op);try{made=faoDrillFromSel(S,op);}finally{holeAxis=hA;}",
    "A(made&&S.ops[0].frame&&S.ops[0].frame.z==='+X','4e : géométrie seule (axe cliqué en −X… +X) : sens pris côté entrée du trou borgne');",
    // débouchant : sens de la fonction Perçage
    "S.ops=[];selFaces=[C(63.5,30,20,[0,1,0],[60,0,20])];",
    "op=faoOpDefaults('drill');S.ops.push(op);made=faoDrillFromSel(S,op);",
    "A(made&&S.ops.every(o=>o.frame&&o.frame.z==='-Y')&&S.ops[1].holes.length===1&&S.ops[1].holes[0].through,'4f : débouchant suivant Y : Z = −Y (entrée de la fonction, face avant)');",
    // trou vertical : pas de repère propre
    "S.ops=[];selFaces=[C(15+3.375,15,35,[0,0,-1],[15,15,40])];",
    "op=faoOpDefaults('drill');S.ops.push(op);made=faoDrillFromSel(S,op);",
    "A(made&&S.ops.every(o=>!o.frame),'4g : trou vertical (axe donné en −Z) : repère du posage gardé');",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== V0.33.2 : Perçage sur sélection → gamme automatique ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
