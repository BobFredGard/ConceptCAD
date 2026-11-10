// PROJETÉES SUR UN IMPORT, À LA RÉOUVERTURE (V0.79.1, retour du 10/11/2026) sur le VRAI noyau OCCT.
// Une esquisse projette des arêtes d'un corps importé (STEP, ou corps dérivé d'un autre fichier).
// À l'ouverture, le premier rejeu tourne AVANT la restauration du STEP : le solide affiché n'a pas
// l'import. Les projetées se raccrochaient alors à l'arête la plus proche du RESTE de la pièce, et
// leur source était perdue : les arêtes choisies avaient changé après réouverture.
// Attendu : réouverture complète (comme l'appli) → mêmes arêtes, même nom de source.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
const app=real=>{
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;sandbox.atob=globalThis.atob;sandbox.btoa=globalThis.btoa;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};showAll=()=>{};viewFadeIn=()=>{};',ctx);
  return {ctx,sandbox};
};
const LIGNE=String.raw`(()=>{const sk=doc.sketches.find(s=>s.id==='skP');const e=sk.entities.find(x=>x.proj);
  const A=sk.points[e.p1],B=sk.points[e.p2];return JSON.stringify({a:[A.x,A.y],b:[B.x,B.y],mid:e.srcMid,nom:e.srcNom||null});})()`;
(async()=>{
  const real=await require('./noyau.cjs').charger();
  // ── 1. le document : bloc STEP 60 × 40 × 20 + bloc dessiné à côté, dans le même corps (comme une soustraction de corps dérivé) ──
  const P=app(real);
  P.sandbox.__step=vm.runInContext(`(function(){
    const mk=new occt.BRepPrimAPI_MakeBox_2(new occt.gp_Pnt_3(0,0,0),60,40,20);
    const sh=mk.Shape();const b=occWriteStep([sh],'/__p.stp');
    try{sh.delete();}catch(e){}try{mk.delete();}catch(e){}
    return b?Uint8Array.from(b).buffer:null;})()`,P.ctx);
  if(!P.sandbox.__step){console.log('  ✗ STEP de test impossible à produire');process.exit(1);}
  const txt=await vm.runInContext(String.raw`(async()=>{
    docResetEmpty();
    await importSTEP({name:'bloc.stp',arrayBuffer:async()=>__step});
    const fi=doc.features.find(x=>x.type==='import');
    const rect=(id,x0,y0,w,h)=>{const sk={id,name:id,plane:'XY',origin:[0,0,0],points:{},entities:[],constraints:[],dims:[],seq:1,visible:true};
      [['p0',x0,y0],['p1',x0+w,y0],['p2',x0+w,y0+h],['p3',x0,y0+h]].forEach(q=>{sk.points[q[0]]={x:q[1],y:q[2]};});
      sk.entities.push({id:'e0',t:'line',p1:'p0',p2:'p1'},{id:'e1',t:'line',p1:'p1',p2:'p2'},{id:'e2',t:'line',p1:'p2',p2:'p3'},{id:'e3',t:'line',p1:'p3',p2:'p0'});return sk;};
    // bloc dessiné : son arête du haut (y 45, z 20) est la plus proche de l'arête visée hors import
    doc.sketches.push(rect('skB',0,45,60,30));
    doc.features.push({id:'exB',type:'extrude',name:'Bloc',sketchId:'skB',op:'add',distance:20,body:fi.body});
    // esquisse (non consommée) sur XY : projette l'arête du haut du STEP, y 40, z 20
    const sk={id:'skP',name:'Esquisse P',plane:'XY',origin:[0,0,0],points:{},entities:[],constraints:[],dims:[],seq:1,visible:true};
    doc.sketches.push(sk);
    markDirty();rebuild();
    // projetée puis enregistrée AUSSITÔT : pas encore de passe de suivi, donc pas encore de nom
    // de source (srcNom) — seulement le milieu de l'arête (cas du fichier de l'utilisateur)
    skProjectCreate(sk,{type:'line',x1:0,y1:40,x2:60,y2:40,srcMid:[30,40,20]});
    return await bundleSerialise();})()`,P.ctx);
  const avant=JSON.parse(vm.runInContext(LIGNE,P.ctx));
  console.log('=== Projetée sur un import, réouverture ===');
  A(!avant.nom&&avant.mid&&avant.mid[1]===40,'projetée enregistrée avec le seul milieu de son arête (pas encore de nom)');
  // ── 2. réouverture complète, comme l'appli (rejeu, puis restauration du STEP) ──
  const Q=app(real);Q.sandbox.__txt=txt;
  await vm.runInContext('(async()=>{docResetEmpty();await bundleRestore(__txt,{name:"essai"});})()',Q.ctx);
  const apres=JSON.parse(vm.runInContext(LIGNE,Q.ctx));
  const eq=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6;
  A(eq(apres.a,avant.a)&&eq(apres.b,avant.b),'après réouverture, la projetée est toujours sur l’arête du STEP : ('+apres.a.map(v=>+v.toFixed(3))+') → ('+apres.b.map(v=>+v.toFixed(3))+')');
  A(apres.nom&&/^im_/.test(apres.nom),'arête source nommée sur l’import ('+apres.nom+')');
  A(Math.abs(apres.mid[1]-40)<1e-6&&Math.abs(apres.mid[2]-20)<1e-6,'milieu mémorisé inchangé (y '+apres.mid[1]+', z '+apres.mid[2]+')');
  // ── 3. une modification ensuite : la projetée suit toujours l'import ──
  await vm.runInContext('(async()=>{markDirty();rebuild();updateAllProjections();})()',Q.ctx);
  const ensuite=JSON.parse(vm.runInContext(LIGNE,Q.ctx));
  A(eq(ensuite.a,avant.a)&&ensuite.nom===apres.nom,'rejeu suivant : rien ne bouge');
  console.log(ko?'ÉCHEC : '+ko:'*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
