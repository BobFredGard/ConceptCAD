// V0.36.4 : même scénario que test_trim_projetee avec le noyau RÉEL — boîte 100×80×20, esquisse sur
// le dessus, projetées gauche + bas (⧉), cercle tangent ajusté en arc, projetées ajustées : au rejeu
// des projections (updateAssociativeProjections) l'arc ne bouge pas ; boîte allongée : tout suit.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};',ctx);
  const o=await vm.runInContext(`(async()=>{
    const OK=[],KO=[];const A=(c,m)=>{(c?OK:KO).push(m);};
    const near=(p,x,y)=>p&&Math.hypot(p.x-x,p.y-y)<1e-4;
    const box=lx=>new occt.BRepPrimAPI_MakeBox_2(new occt.gp_Pnt_3(-50,-40,0),lx,80,20).Shape();
    occLive={shape:box(100)};
    const sk={id:'t1',name:'T',plane:'FACE',origin:[0,0,20],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],entities:[],points:{},constraints:[],dims:[],seq:1,visible:true};
    ensureSketchBasis(sk);doc.sketches=[sk];doc.features=[];
    openSketch('t1');skView.s=4;skUpdateTols();
    const pj=(x,y)=>{const pr=projectEdgeAt(sk,x,y);return pr?skProjectCreate(sk,pr):null;};
    const eL=pj(-50,0),eB=pj(0,-40);
    A(eL&&eB,'2 projetées créées');
    const c=addPoint(sk,-30,-20);const k={id:skNewEid(sk),t:'circle',pc:c,r:20};sk.entities.push(k);
    sk.constraints.push({id:skNewEid(sk),type:'tangent',line:eL,ent:k.id},{id:skNewEid(sk),type:'tangent',line:eB,ent:k.id});
    solveSketch(sk);
    trimEntity(sk,k,-45,-35);solveSketch(sk);
    trimEntity(sk,entById(sk,eB),10,-40);trimEntity(sk,entById(sk,eL),-50,10);solveSketch(sk);
    const P=sk.points,K=entById(sk,k.id);
    A(K.t==='arc'&&near(P[K.pa],-30,-40)&&near(P[K.pb],-50,-20)||near(P[K.pb],-30,-40)&&near(P[K.pa],-50,-20),'arc entre (-30,-40) et (-50,-20)');
    _skPlCache=null;updateAssociativeProjections(sk);solveSketch(sk);
    const ok1=(near(P[K.pa],-30,-40)&&near(P[K.pb],-50,-20))||(near(P[K.pb],-30,-40)&&near(P[K.pa],-50,-20));
    A(ok1,'rejeu des projections : l’arc reste en place '+JSON.stringify([P[K.pa],P[K.pb],P[K.pc]]));
    const L=skLoopTrace(sk);A((L.loops||[]).length===1,'un contour fermé ('+(L.loops||[]).length+')');
    // la boîte s'élargit vers la gauche de 10 : la projetée gauche suit, l'arc aussi
    occLive={shape:new occt.BRepPrimAPI_MakeBox_2(new occt.gp_Pnt_3(-60,-40,0),110,80,20).Shape()};_projEdgeCache&&_projEdgeCache.clear&&_projEdgeCache.clear();_skPlCache=null;
    updateAssociativeProjections(sk);solveSketch(sk);
    A(Math.abs(Math.hypot(P[K.pa].x-P[K.pc].x,P[K.pa].y-P[K.pc].y)-K.r)<1e-4&&[K.pa,K.pb].some(p=>Math.abs(P[p].x+60)<1e-3),'boîte élargie : l’arc suit la projetée gauche '+JSON.stringify([P[K.pa],P[K.pb]]));
    closeSketch(false);
    return {OK,KO};
  })()`,ctx);
  console.log('=== ajustement de projetées (noyau réel) ===');
  o.OK.forEach(m=>console.log('  ✓ '+m));o.KO.forEach(m=>console.log('  ✗ '+m));
  console.log(o.KO.length?'\n*** '+o.KO.length+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
  process.exit(o.KO.length?1:0);
})().catch(e=>{console.log('  ✗ '+(e&&e.stack||e));process.exit(1);});
