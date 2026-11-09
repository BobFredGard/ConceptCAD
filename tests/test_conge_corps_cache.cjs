// CONGÉ SUR UN CORPS, UN AUTRE CORPS CACHÉ : retour de Fred du 09/11/2026. Avec plusieurs corps, l'un
// caché, « à la 1ère arête sélectionnée, le corps caché apparaît sans arêtes et masque le corps à
// modifier ». Cause : l'aperçu du congé recalculait le COMPOSÉ de tous les corps et l'affichait à la
// place de tous, sans regarder l'œil des corps. Attendu (V0.77.2) : l'aperçu ne porte que sur le corps
// des arêtes choisies ; un corps caché le reste, un corps visible garde son propre affichage.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    "const rect=(id,x0,x1)=>({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:x0,y:0},b:{x:x1,y:0},c:{x:x1,y:20},d:{x:x0,y:20}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:20,visible:false});",
    // deux corps qui se chevauchent : le second, caché, entoure le premier (comme une copie décalée)
    "doc.sketches=[rect('skA',0,40),rect('skB',-5,45)];doc.features=[];doc.bodies=[];delete doc.activeBody;ensureBodies();tlMark=null;",
    "const B1=doc.bodies[0].id;",
    "doc.features.push({id:'F1',type:'extrude',name:'A',sketchId:'skA',distance:10,op:'add',visible:true,body:B1});",
    "markDirty();rebuild();",
    "newBody();const B2=doc.activeBody!==B1?doc.activeBody:null;",
    "if(!B2){out.fails.push('corps neuf impossible');return out;}",
    "doc.features.push({id:'F2',type:'extrude',name:'B',sketchId:'skB',distance:12,op:'add',visible:true,body:B2});",
    "doc.activeBody=B1;markDirty();rebuild();",
    "const corps=id=>bodies.find(b=>b.id===id&&b.kind==='body');",
    "A(corps(B1)&&corps(B2),'deux corps construits');",
    "doc.bodyVis=doc.bodyVis||{};doc.bodyVis[B2]=false;corps(B2).visible=false;corps(B2).mesh.visible=false;",
    "const choisir=()=>{const b=corps(B1);const e=occListEdges(b.shape).filter(e=>Math.abs(e.mid[2]-10)<1e-3).sort((a,b)=>b.len-a.len)[0];filModeX.sel=[{pos:e.mid.slice(),r:2}];xPreviewUpdate();};",
    "let nfBase=-1;const xps=xPreviewShape;xPreviewShape=function(base){const l=occSubShapes(base,'TopAbs_FACE');nfBase=l.length;occDispose(l);return xps.apply(this,arguments);};",
    "enterExactFilletMode();choisir();",
    "const pv=xPrevBody&&xPrevBody.mesh;",
    "A(!!pv,'aperçu du congé affiché au 1er clic');",
    "A(corps(B2).mesh.visible===false,'le corps caché reste caché pendant l’aperçu');",
    "A(corps(B1).mesh.visible===false,'le corps modifié est remplacé par son aperçu');",
    "A(nfBase===6,'l’aperçu ne calcule que le corps modifié : '+nfBase+' faces de départ (bloc 6 ; 12 avec le corps caché)');",
    "exitFilletMode(true);",
    "A(corps(B2).mesh.visible===false&&corps(B1).mesh.visible===true,'en quittant : le caché reste caché, le corps modifié revient');",
    // corps visible : il garde son affichage pendant l'aperçu
    "delete doc.bodyVis[B2];corps(B2).visible=true;corps(B2).mesh.visible=true;",
    "enterExactFilletMode();choisir();",
    "A(corps(B2).mesh.visible===true,'un corps visible reste affiché tel quel pendant l’aperçu');",
    "exitFilletMode(true);",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Congé : un autre corps caché ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
