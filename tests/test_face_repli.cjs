// Déplacement de face, case « Faces tangentes » cochée (réglage par défaut) : quand le décalage
// du noyau échoue (il porte sur TOUT le solide : un endroit délicat ailleurs suffit), la face
// cliquée, plane ou cylindrique, doit quand même bouger par le calcul historique (V0.94.3).
// Avant : la fonction restait dans la timeline sans rien changer (retour de Fred, 11/11).
// Faces de « Cache Piles » et « Support Pédale » où le noyau rendait « résultat vide ».
const vm=require('vm'),path=require('path');
const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
const CAS=[
  {fichier:'Cache Piles.conceptcad',faces:[[-25.795,8.4,2.4],[-21.045,9.9,2.4]]},
  {fichier:'Support Pédale Déportée R1200RT 2011.conceptcad',faces:[[20.904,-0.568,6.681],[0,-14.068,0],[11,-23.6,-3.5]]},
];
const DANS=String.raw`
if(bundleIs(__txt))await bundleRestore(__txt,{name:'test'});else{await deserialise(__txt);}
occt=__realOcct;occtReady=true;markDirty();
const vol=sh=>{const g=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(sh,g,false,false,false);const m=g.Mass();g.delete();return m;};
const FR=occFinalShape(null);
const out=[];
for(const pos of __faces){
  // la face la plus proche de ce centre, référencée comme au clic
  let best=null,bd=1e9,bid=null,V0=0;
  FR.perBody.forEach(pb=>{if(!pb.shape)return;occSubShapes(pb.shape,'TopAbs_FACE').forEach(f=>{
    const b=occFaceBox(f),d=b?Math.hypot(b.pos[0]-pos[0],b.pos[1]-pos[1],b.pos[2]-pos[2]):1e9;
    if(d<bd){bd=d;best=occFaceRefAny(f);bid=pb.bodyId;V0=vol(pb.shape);}
    try{f.delete();}catch(e){}});});
  for(const d of [1,-1]){
    const f={id:'mv_test',type:'xmove',name:'MV',faces:[best],ref:JSON.parse(JSON.stringify(best)),dist:d,tangent:true,body:bid};
    doc.features.push(f);
    const R=occFinalShape(null);
    const pb=R.perBody.find(x=>x.bodyId===bid);
    out.push({pos,d,st:best.st,dv:pb&&pb.shape?vol(pb.shape)-V0:0,msgs:(R.msgs||[]).filter(m=>m.startsWith('MV'))});
    doc.features.pop();
  }
}
return JSON.stringify(out);`;
(async()=>{
  const real=await require('./noyau.cjs').charger();
  let ko=0;
  for(const c of CAS){
    const {ctx,sandbox}=loadApp();
    Object.assign(sandbox,{__realOcct:real,__txt:lire(path.join(__dirname,'..','Exemples',c.fichier)),__faces:c.faces});
    vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};showAll=function(){};applyView=function(){};',ctx);
    const L=JSON.parse(await vm.runInContext('(async()=>{'+DANS+'})()',ctx));
    console.log('=== '+c.fichier+' ===');
    L.forEach(x=>{
      // rayon impossible (arrondi de 0,5 mm réduit de 1 mm) : refus attendu, et dit
      const ok=(Math.abs(x.dv)>1e-3&&Math.sign(x.dv)===Math.sign(x.d))||(x.dv===0&&x.msgs.some(m=>/rayon deviendrait/.test(m)));
      if(!ok)ko++;
      console.log('  '+(ok?'✓':'✗')+' face '+x.st+' ('+x.pos.join(' ; ')+') '+(x.d>0?'+':'')+x.d+' mm : volume '+(x.dv>=0?'+':'')+x.dv.toFixed(1)+' mm³'+(x.msgs.length?' — '+x.msgs.join(" | "):''));
    });
  }
  console.log(ko?'\n*** '+ko+' ÉCHEC(S) ***':'\n*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.log('ERREUR',e);process.exit(1);});
