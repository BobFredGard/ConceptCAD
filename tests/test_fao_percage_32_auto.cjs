// V0.99.10 : FAO Perçage — trous de plusieurs axes (3+2) : une opération par orientation du plateau,
// gamme triée étape par étape (chaque outil d'un seul tenant, orientations voisines à la suite), X du côté
// où penche l'outil (poche / matière), perçage normal d'un congé pris d'un bloc, trous gardés par repère ;
// post Siemens : dégagement SUPA Z puis X avant chaque pivotement, approche en deux temps (G0 X Y, puis G0 Z).
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    // ── pièce : bloc 120×60×40, Ø5 sur le dessus, M6 sur la face X+, Ø7 débouchant suivant Y
    "const box={id:'skA',name:'Bloc',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:0,y:0},b:{x:120,y:0},c:{x:120,y:60},d:{x:0,y:60}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:20,visible:false};",
    "doc.sketches=[box,{id:'sP',name:'sP',plane:'XY',origin:[0,0,40],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{h0:{x:100,y:30}},entities:[{id:'e0',t:'cpoint',p:'h0',hole:true}],constraints:[],dims:[],seq:30,visible:false},",
    "  {id:'sX',name:'sX',plane:'XY',origin:[120,30,20],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0],points:{h0:{x:0,y:0}},entities:[{id:'e0',t:'cpoint',p:'h0',hole:true}],constraints:[],dims:[],seq:40,visible:false},",
    "  {id:'sY',name:'sY',plane:'XY',origin:[60,0,20],axU:[1,0,0],axV:[0,0,1],axN:[0,-1,0],points:{h0:{x:0,y:0}},entities:[{id:'e0',t:'cpoint',p:'h0',hole:true}],constraints:[],dims:[],seq:41,visible:false}];",
    "doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skA',distance:40,op:'add',visible:true}];",
    "doc.bodies=[];delete doc.activeBody;markDirty();rebuild();",
    "askHole('sP');const fP=doc.features[doc.features.length-1];fP.d=5;fP.depth=30;",
    "askHole('sX');const fX=doc.features[doc.features.length-1];fX.d=5;fX.depth=15;fX.thread={size:'M6',p:1,len:10};",
    "askHole('sY');const fY=doc.features[doc.features.length-1];fY.d=7;fY.end='through';",
    "markDirty();rebuild();faoHoleCache={shape:null,list:null};",
    "A(builtEngine==='exact'&&!doc.features.some(f=>f._err),'0 : pièce exacte (trous sur 3 faces)');",
    "const S=faoSetup();S.ops=[];S.name='P32';S.stock={x0:0,y0:0,z0:0,x1:120,y1:60,z1:40};",
    "const C=(x,y,z,ax,c)=>({point:{x:x,y:y,z:z},geom:{kind:'cyl',axis:{x:ax[0],y:ax[1],z:ax[2]},center:{x:c[0],y:c[1],z:c[2]}}});",
    "const T=o=>faoToolById(S,o.toolId);",
    "const ph=o=>o.gRole==='pointage'?0:o.cycle==='tap'?5:1;",
    // ── 1. trois trous, trois axes : une seule fenêtre, puis une opération par orientation
    "selFaces=[C(102.5,30,30,[0,0,1],[100,30,40]),C(110,32.5,20,[1,0,0],[120,30,20]),C(63.5,30,20,[0,1,0],[60,0,20])];sel={kind:null,id:null};",
    "let fl=null;const dA=faoDrillGammeDlg;faoDrillGammeDlg=function(st,op,list,f,done){fl=f;done();};",
    "let nDet=0;const d0=faoHolesDetect0;faoHolesDetect0=function(s){nDet++;return d0(s);};",
    "let op=faoOpDefaults('drill');S.ops.push(op);",
    "try{faoDrillFromSel(S,op);}finally{faoDrillGammeDlg=dA;faoHolesDetect0=d0;}",
    "out.log.push('gamme : '+S.ops.map(o=>(o.gRole||o.cycle)+'['+(o.frame?(typeof o.frame.z==='string'?o.frame.z:'∠'):'Z')+'] T'+T(o).num).join(' → '));",
    "A(fl&&fl.nFr===3&&fl.n===3,'1a : une seule fenêtre « Gamme de perçage » pour les 3 orientations ('+(fl&&fl.nFr)+')');",
    "const fz=o=>o.frame?String(o.frame.z):'Z';",
    "A(['Z','+X','-Y'].every(k=>S.ops.some(o=>fz(o)===k&&o.gRole==='pointage')),'1b : un pointage par orientation : dessus (posage), +X (entrée face X+), −Y (entrée face avant)');",
    "A(S.ops.filter(o=>o.cycle==='tap').length===1&&fz(S.ops.find(o=>o.cycle==='tap'))==='+X','1c : taraudage M6 dans le repère +X');",
    "A(S.ops.every((o,i)=>!i||ph(S.ops[i-1])<=ph(o)),'1d : ordre d’atelier sur toutes les orientations : pointages, perçages, taraudage');",
    "{const seen=[];let ok=true;S.ops.forEach((o,i)=>{const t=o.toolId;if(i&&S.ops[i-1].toolId!==t&&seen.indexOf(t)>=0)ok=false;if(seen.indexOf(t)<0)seen.push(t);});",
    " A(ok,'1e : chaque outil d’un seul tenant (pas de retour à un outil déjà rangé)');}",
    "A(S.ops[0].gRole==='pointage'&&fz(S.ops[0])==='Z','1f : on commence par l’orientation la plus proche du Z du posage');",
    "A(new Set(S.ops.filter(o=>o.gRole==='pointage').map(o=>o.toolId)).size===1,'1g : même foret à pointer pour les 3 orientations');",
    "A(nDet<=8,'1h : trous lus une fois par repère ('+nDet+' lectures de la pièce pour 3 orientations)');",
    // ── 2. post Siemens : dégagement avant chaque pivotement, approche en deux temps
    "{const g=faoPost(S,'siemens630').code,L=g.split('\\n');const iC=[];L.forEach((l,i)=>{if(/^CYCLE800/.test(l)&&!/,0\\.000,0\\.000,0\\.000,/.test(l))iC.push(i);});",
    " A(iC.length>=4,'2a : '+iC.length+' pivotements du plateau (plans inclinés)');",
    " A(iC.every(i=>L[i-3]==='G0 SUPA Z600 D0'&&L[i-2]==='G0 SUPA X-200'&&L[i-1]==='D1'),'2b : avant chaque pivotement : G0 SUPA Z600 D0, G0 SUPA X-200, D1');",
    " A(iC.every(i=>/^G0 X-?[0-9.]+ Y-?[0-9.]+( F[0-9.]+)?$/.test(L[i+1])&&/^G0 Z-?[0-9.]+$/.test(L[i+2])),'2c : après chaque pivotement : G0 X Y au-dessus, puis G0 Z ('+iC.filter(i=>!(/^G0 X-?[0-9.]+ Y-?[0-9.]+( F[0-9.]+)?$/.test(L[i+1])&&/^G0 Z-?[0-9.]+$/.test(L[i+2]))).map(i=>L.slice(i-1,i+4).join(' | ')).join(' // ')+')');",
    " const nT=L.filter(l=>/^T[0-9]+/.test(l)||/^T=/.test(l)).length,nTools=new Set(S.ops.map(o=>o.toolId)).size;",
    " A(nT===nTools,'2d : un changement par outil ('+nT+' pour '+nTools+' outils)');",
    " A(!/Perçage 0 trou/.test(g),'2e : commentaire des opérations : nombre de trous réel');}",
    // ── 3. perçage normal dans un congé : la fonction choisie → tous ses trous, X côté poche
    "const prof={id:'skN',name:'Profil',plane:'YZ',origin:[0,0,0],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0],",
    "  points:{a:{x:0,y:0},b:{x:60,y:0},c:{x:60,y:40},d:{x:40,y:40},e:{x:40,y:28},f:{x:32,y:20},g:{x:0,y:20},o:{x:32,y:28}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'e'},",
    "    {id:'k',t:'arc',pc:'o',pa:'f',pb:'e',r:8},{id:'l5',t:'line',p1:'f',p2:'g'},{id:'l6',t:'line',p1:'g',p2:'a'}],constraints:[],dims:[],seq:20,visible:false};",
    "const pts={id:'s8',name:'s8',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{h0:{x:15,y:36},h1:{x:35,y:36},h2:{x:55,y:36}},",
    "  entities:[{id:'e0',t:'cpoint',p:'h0',hole:true},{id:'e1',t:'cpoint',p:'h1',hole:true},{id:'e2',t:'cpoint',p:'h2',hole:true}],constraints:[],dims:[],seq:30,visible:false};",
    "doc.sketches=[prof,pts];",
    "doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'skN',distance:100,op:'add',visible:true},",
    "  {id:'H8',type:'hole',name:'H8',sketchId:'s8',kind:'simple',d:8,end:'blind',depth:14,tip:118,flip:true,op:'cut',visible:true}];",
    "doc.bodies=[];doc.cgeo=[];delete doc.activeBody;markDirty();rebuild();",
    "const fil=occSubShapes(occLive.shape,'TopAbs_FACE').find(f=>occSurfKind(f)==='Cylinder'&&Math.abs(occFaceBox(f).dim[0]-100)<0.5);",
    "const hn=hnCreate([occFaceRefAny(fil)],null);faoHoleCache={shape:null,list:null};",
    "const its=hn?hnRun.get(hn.id).all.filter(t=>t.on):[];",
    "A(hn&&its.length===3,'3a : perçage normal Ø1,5 : 3 trous dans le congé ('+(hn?its.length:('pas de fonction : '+builtEngine+' fil='+!!fil+' cyl='+occSubShapes(occLive.shape,'TopAbs_FACE').filter(f=>occSurfKind(f)==='Cylinder').map(f=>occFaceBox(f).dim.map(q=>+q.toFixed(1)).join('x')).join(';')+' box='+occFaceBox(occLive.shape).dim.map(q=>+q.toFixed(1)).join('x')+' '+faceEl.textContent))+')');",
    "S.ops=[];S.stock={x0:0,y0:0,z0:0,x1:100,y1:60,z1:40};selFaces=[];sel={kind:'feature',id:hn&&hn.id};faoDrillGammeAsk.off=true;",
    "op=faoOpDefaults('drill');S.ops.push(op);let made=null;try{made=faoDrillFromSel(S,op);}finally{faoDrillGammeAsk.off=false;}",
    "out.log.push('congé : '+S.ops.map(o=>(o.gRole||o.cycle)+'('+(o.holes||[]).length+') z='+JSON.stringify(o.frame&&o.frame.z)+' x='+JSON.stringify(o.frame&&o.frame.x)).join(' → '));",
    "if(!its.length)return out;const u=(()=>{const t=its[0],d=[t.C[0]-t.P[0],t.C[1]-t.P[1],t.C[2]-t.P[2]],L=Math.hypot(...d);return d.map(q=>q/L);})();",
    "const Zv=o=>faoV(o.frame&&o.frame.z)||[0,0,1],Xv=o=>faoV(o.frame&&o.frame.x)||[1,0,0];",
    "A(made&&S.ops.length===2&&S.ops.every(o=>o.frame&&Math.abs(Zv(o)[0]+u[0])+Math.abs(Zv(o)[1]+u[1])+Math.abs(Zv(o)[2]+u[2])<1e-6),'3b : fonction choisie dans l’arbre → pointage + perçage, Z = axe du trou sortant par le congé');",
    "A(S.ops.every(o=>(o.holes||[]).length===3),'3c : les 3 trous dans chaque opération');",
    "A(faoStepUnknown(S,S.ops[0]).length===0,'3c2 : trous du perçage normal = trous de la pièce : la fenêtre ne demande pas leur nature (comme un STEP)');",
    "{const z=Zv(S.ops[0]),x=Xv(S.ops[0]),L=Math.hypot(z[0],z[1]);",
    " A(Math.abs(x[2])<1e-9&&Math.abs(x[0]-z[0]/L)+Math.abs(x[1]-z[1]/L)<1e-6,'3d : X du côté où penche l’outil (vers la poche) : '+x.map(q=>+q.toFixed(3)).join(','));}",
    // un seul trou cliqué dans la vue → toute la fonction
    "S.ops=[];sel={kind:null,id:null};{const t=its[1],m=[(t.P[0]+t.C[0])/2,(t.P[1]+t.C[1])/2,(t.P[2]+t.C[2])/2];selFaces=[C(m[0],m[1]+0.75,m[2],[-u[0],-u[1],-u[2]],t.P)];}",
    "faoDrillGammeAsk.off=true;op=faoOpDefaults('drill');S.ops.push(op);try{made=faoDrillFromSel(S,op);}finally{faoDrillGammeAsk.off=false;}",
    "A(made&&S.ops.length===2&&S.ops.every(o=>(o.holes||[]).length===3),'3e : un trou du perçage normal cliqué → ses 3 trous');",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== V0.99.10 : perçage 3+2 automatique (une orientation par axe) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
