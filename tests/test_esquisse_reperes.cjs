// ESQUISSE ET REPÈRES (V0.78.1, retour du 10/11/2026) sur le VRAI noyau OCCT :
//  1. Une ligne de construction tracée entre les CENTRES de deux cercles projetés (pour centrer
//     des perçages) a ses deux bouts fixes — ce sont les fixations des projetées. Elle était prise
//     pour une ancienne projetée : au rejeu elle sautait sur une arête de la pièce et traînait les
//     centres avec elle (références projetées « perdues »). Elle doit suivre les centres, sans plus.
//  2. Le centre d'un repère (origine de la pièce, point / repère de construction) se projette
//     dans l'esquisse : point fixe qui suit le repère au rejeu.
//  3. Une esquisse sur une face qui ne contient pas l'origine de la pièce prend quand même
//     l'origine de la pièce projetée (axes de l'esquisse = axes de la pièce), et suit sa face.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=`
    const ATT=[],P=[];const att=(ok,msg)=>{(ok?P:ATT).push(msg);};
    const pt=(q,x,y,t)=>q&&Math.abs(q.x-x)<(t||1e-3)&&Math.abs(q.y-y)<(t||1e-3);
    const fmt=q=>q?'('+(+q.x).toFixed(3)+', '+(+q.y).toFixed(3)+')':'—';
    const mkRect=(id,x0,y0,w,h)=>{const sk={id,name:id,plane:'XY',origin:[0,0,0],points:{},entities:[],constraints:[],dims:[],seq:1,visible:true};
      [['p0',x0,y0],['p1',x0+w,y0],['p2',x0+w,y0+h],['p3',x0,y0+h]].forEach(q=>{sk.points[q[0]]={x:q[1],y:q[2]};});
      sk.entities.push({id:id+'e0',t:'line',p1:'p0',p2:'p1'},{id:id+'e1',t:'line',p1:'p1',p2:'p2'},{id:id+'e2',t:'line',p1:'p2',p2:'p3'},{id:id+'e3',t:'line',p1:'p3',p2:'p0'});return sk;};
    const replay=()=>{cgResolveAll();try{resolveAllSketchHosts();}catch(e){}occCk.length=0;const FR=occFinalShape(null);occLive={shape:FR.shape};return FR;};
    docResetEmpty();
    // bloc 100 × 60 × 20 de x 20 à 120, y −30 à 30 : l'origine de la pièce n'est PAS sur le dessus
    // + deux plots ronds R5 de 10 mm, centres (40, 10) et (100, −10) — en diagonale
    const rond=(id,x,y)=>({id,name:id,plane:'XY',origin:[0,0,0],points:{c:{x,y}},entities:[{id:id+'c',t:'circle',pc:'c',r:5}],constraints:[],dims:[],seq:1,visible:true});
    doc.sketches=[mkRect('skA',20,-30,100,60),rond('skR1',40,10),rond('skR2',100,-10)];
    doc.bodies=[{id:'b1',name:'Corps 1',c:null}];doc.bodySeq=2;doc.activeBody='b1';
    doc.features=[{id:'exA',type:'extrude',name:'Bloc',sketchId:'skA',op:'add',distance:20,body:'b1'},
      {id:'exR1',type:'extrude',name:'Plot 1',sketchId:'skR1',op:'add',distance:30,body:'b1'},
      {id:'exR2',type:'extrude',name:'Plot 2',sketchId:'skR2',op:'add',distance:30,body:'b1'}];
    replay();
    // ── 3. esquisse sur le dessus du bloc, clic en (80, 0, 20) ──
    selFaces=[{mesh:{},point:new THREE.Vector3(80,0,20),faceIndex:0}];
    faceNormalWorld=()=>new THREE.Vector3(0,0,1);
    faceSketchOrigin=()=>new THREE.Vector3(70,0,20); // ancienne règle : centre de la face
    try{openSketch=()=>{};}catch(e){}
    const n0=doc.sketches.length;
    try{newSketchOnFace();}catch(e){att(false,'newSketchOnFace : '+e.message);}
    const sk=doc.sketches[n0];
    att(!!sk,'esquisse sur face créée');
    att(sk&&sk.origin.join()==='0,0,20','origine = origine de la pièce projetée sur la face (vu '+(sk&&sk.origin)+', avant : centre de la face 70,0,20)');
    att(sk&&sk.host&&sk.host.feat==='exA'&&sk.host.tag==='TOP','face porteuse : dessus du bloc (vu '+JSON.stringify(sk&&sk.host)+')');
    // ── 1. cercles projetés + ligne de construction entre leurs centres ──
    const P0=Object.assign({},sk.points);
    const e1=skProjectCreate(sk,{type:'circle',cx:40,cy:10,r:5,srcMid:[45,10,50]});
    const e2=skProjectCreate(sk,{type:'circle',cx:100,cy:-10,r:5,srcMid:[105,-10,50]});
    const c1=entById(sk,e1).pc,c2=entById(sk,e2).pc;
    const L={id:skNewEid(sk),t:'line',p1:c1,p2:c2,construction:true};sk.entities.push(L);
    att(skLigneSurProjetees(sk,L),'la ligne entre les centres est reconnue comme TRACÉE (pas une projetée)');
    // ── 2. origine de la pièce + point de construction projetés ──
    const Q=cgNew('point','xyz',[],{dx:30,dy:5,dz:0});
    replay();
    const cib=skOrigCibles(sk);
    att(cib.some(c=>c.orig.o&&Math.abs(c.x)<1e-9&&Math.abs(c.y)<1e-9),'origine de la pièce proposée en (0, 0)');
    att(cib.some(c=>c.orig.cg===Q.id&&Math.abs(c.x-30)<1e-9&&Math.abs(c.y-5)<1e-9),'point de construction proposé en (30, 5)');
    const h=skPlHit(sk,0.01,0.01);
    att(h&&h.kind==='pt'&&h.p.kind==='origin','survol de (0, 0) : le centre du repère s’allume (vu '+(h&&h.p&&h.p.kind)+')');
    const po=skPlMaterialize(sk,h);
    const pq=skOrigMaterialize(sk,cib.find(c=>c.orig.cg===Q.id));
    att(skOrigMaterialize(sk,cib.find(c=>c.orig.o))===po,'projeter deux fois l’origine redonne le même point');
    att(sk.constraints.some(c=>c.type==='fix'&&c.p===po),'centre projeté : point fixe');
    // ── rejeu : le plot 2 se déplace, le point de construction aussi, le bloc s'épaissit ──
    doc.sketches.find(s=>s.id==='skR2').points.c={x:90,y:-12};
    Q.p.dx=35;doc.features[0].distance=25;
    replay();updateAllProjections();
    att(sk.origin[2]===25,'l’esquisse suit le dessus du bloc (z '+sk.origin[2]+')');
    att(pt(sk.points[c2],90,-12),'le centre projeté du plot 2 suit le plot : '+fmt(sk.points[c2]));
    att(pt(sk.points[c1],40,10),'le centre projeté du plot 1 ne bouge pas : '+fmt(sk.points[c1]));
    att(pt(sk.points[L.p1],40,10)&&pt(sk.points[L.p2],90,-12),'la ligne tracée reste entre les deux centres (sans sauter sur une arête)');
    att(!L.srcMid&&!L.srcNom,'la ligne tracée n’a pas adopté d’arête source');
    att(pt(sk.points[po],0,0),'l’origine projetée reste en (0, 0) : '+fmt(sk.points[po]));
    att(pt(sk.points[pq],35,5),'le point de construction projeté suit son repère : '+fmt(sk.points[pq]));
    JSON.stringify({ATT,P});
  `;
  let r;try{r=JSON.parse(vm.runInContext(R,ctx));}catch(e){console.error(e);process.exit(1);}
  console.log('=== Esquisse et repères ===');
  r.P.forEach(m=>console.log('  ✓ '+m));r.ATT.forEach(m=>console.log('  ✗ '+m));
  console.log(r.ATT.length?'ÉCHEC : '+r.ATT.length:'*** TOUT PASSE ***');
  process.exit(r.ATT.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
