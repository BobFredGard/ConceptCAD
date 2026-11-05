// Passage CAO → Plan et Ctrl+Z dans le plan : les vues ne sont recalculées que si la géométrie change.
// Avant : Ctrl+Z d'un simple déplacement de vue rejouait la pièce et reprojetait les 9 vues (2,4 s sur
// « Cavité Usinage »), et tout markDirty sans effet sur la pièce refaisait toutes les projections.
// Vue DXF : sa construction ne demande pas le noyau, un nouvel objet géométrie = un recalcul.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
const {ctx}=loadApp();
vm.runInContext('window.confirm=function(){return true;};window.alert=function(){};var __reb=0;rebuild=function(){__reb++;};showAll=function(){};applyView=function(){};',ctx);
const out=vm.runInContext(`(function(){
  const r={fails:[],log:[]};const A=(c,m)=>{if(!c)r.fails.push(m);else r.log.push(m);};
  doc.features=[{id:'F1',type:'extrude',name:'Bloc',sketchId:'s',distance:10,op:'add',visible:true}];
  const mesh=(a)=>({visible:true,geometry:{attributes:{position:{array:new Float32Array(a),version:0}}},matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}});
  bodies.length=0;bodies.push({id:'b1',mesh:mesh([0,0,0,1,0,0,0,1,0])});
  mepSetActive(true);
  const T=window.__mepTest,sh=T.sheet();
  sh.views.length=0;sh.dims.length=0;
  const v={id:'vD',kind:'dxf',x:50,y:50,scale:1,mode:'hide',axes:[],dxf:{rev:1,els:[{t:'L',x1:0,y1:0,x2:10,y2:0,k:'sharp'}]}};
  sh.views.push(v);
  const geo=()=>T.geo(sh.views.find(o=>o.id==='vD'));
  const g0=geo();
  A(geo()===g0,'vue en cache tant que rien ne change');
  // 1. modification sans effet sur la pièce
  const ver0=_docVersion;markDirty();
  A(_docVersion!==ver0&&geo()===g0,'markDirty sans changement de géométrie : pas de reprojection');
  // 2. Ctrl+Z / Ctrl+Y d'un geste de plan
  docCheckpoint();
  const nb0=docUndoStack.length;
  docPushUndo('Plan : déplacer');v.x=73;
  __reb=0;const ver1=_docVersion;
  A(docUndo()===true,'Ctrl+Z accepté');
  const v2=()=>doc.mep.sheets[doc.mep.cur].views.find(o=>o.id==='vD');
  A(v2().x===50,'Ctrl+Z : la vue revient en place ('+v2().x+')');
  A(__reb===0,'Ctrl+Z de plan : aucun rejeu ('+__reb+')');
  A(_docVersion===ver1,'Ctrl+Z de plan : pièce non modifiée');
  A(docUndoStack.length===nb0,'Ctrl+Z : pile dépilée');
  A(T.geo(v2())===g0,'Ctrl+Z de plan : pas de reprojection');
  A(docRedo()===true&&v2().x===73,'Ctrl+Y : la vue repart');
  A(__reb===0&&T.geo(v2())===g0,'Ctrl+Y de plan : ni rejeu ni reprojection');
  docUndo();
  // 3. un geste qui touche la pièce garde le rejeu, et les vues suivent
  docPushUndo('longueur');doc.features[0].distance=25;markDirty();
  const g1=T.geo(v2());
  A(g1!==g0,'pièce modifiée : la vue est recalculée');
  __reb=0;docUndo();
  A(__reb>=1,'Ctrl+Z de pièce : rejeu conservé ('+__reb+')');
  A(doc.features[0].distance===10,'Ctrl+Z de pièce : valeur rendue');
  A(T.geo(v2())!==g1,'Ctrl+Z de pièce : la vue est recalculée');
  // 4. géométrie changée sans toucher le paramétrique (corps importé, composant lié, rejeu différé)
  let g=T.geo(v2());
  bodies[0].mesh=mesh([0,0,0,2,0,0,0,1,0]);
  A(T.geo(v2())!==g,'sommets différents : vue recalculée');
  g=T.geo(v2());
  bodies[0].mesh=mesh([0,0,0,2,0,0,0,1,0]);
  A(T.geo(v2())===g,'maillage refait à l’identique : vue gardée');
  bodies[0].mesh.matrixWorld.elements[12]=5;
  A(T.geo(v2())!==g,'corps déplacé : vue recalculée');
  g=T.geo(v2());
  bodies[0].mesh.visible=false;
  A(T.geo(v2())!==g,'corps masqué : vue recalculée');
  // 5. la copie d'un solide libère son constructeur (il garde la copie : ~17 Mo par rejeu sur Cavité Usinage)
  const o0=occt;let nbDel=0,nbNew=0;
  occt={BRepBuilderAPI_Copy_2:function(){nbNew++;this.Shape=()=>({});this.delete=()=>{nbDel++;};}};
  try{occShapeCopy({});occShapeCopy({});}finally{occt=o0;}
  A(nbNew===2&&nbDel===2,'occShapeCopy libère ses constructeurs ('+nbDel+'/'+nbNew+')');
  return r;
})()`,ctx);
console.log('=== PLAN : recalcul des vues seulement si la géométrie change ===');
out.log.forEach(m=>console.log('  ✓ '+m));
out.fails.forEach(m=>console.log('  ✗ '+m));
console.log(out.fails.length?'\n*** '+out.fails.length+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
process.exit(out.fails.length?1:0);
