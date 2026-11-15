// V0.99.14 — Export STL : finesse choisie (Grossier / Normal / Fin) maillée sur une COPIE du solide :
// plus fin = plus de triangles, cercles conformes au nombre de côtés annoncé, maillage affiché et
// triangles du solide intacts, fichier binaire cohérent (84 + 50 × triangles).
'use strict';
const path=require('path'),vm=require('vm');
const {loadApp}=require('./appvm.cjs');
const lireProjet=require('./lire-projet.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=s=>vm.runInContext(s,ctx);
  console.log('=== Export STL : finesse et copie du solide ===');
  sandbox.__json=lireProjet(path.join(__dirname,'..','Exemples','Axe.conceptcad'));
  await R(String.raw`(async()=>{const raw=JSON.parse(__json);if(raw.doc)await bundleRestore(__json,{rebuild:false});else await deserialise(__json,{rebuild:false});markDirty();rebuild();})()`);
  const r=R(String.raw`(()=>{
    const o={};
    const b=bodies.find(x=>x.kind==='body'&&x.shape);o.corps=!!b;if(!b)return o;
    bodies.forEach(x=>{if(x.mesh&&!x.mesh.updateMatrixWorld)x.mesh.updateMatrixWorld=()=>{};});
    const triAvant=T=>{let n=0;const ex=new occt.TopExp_Explorer_2(b.shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
      while(ex.More()){const f=occFaceCur(ex),loc=new occt.TopLoc_Location_1(),h=occt.BRep_Tool.Triangulation(f,loc);
        if(h&&!h.IsNull())n+=h.get().NbTriangles();occFree(h);occFree(f);loc.delete();ex.Next();}ex.delete();return n;};
    const n0=triAvant();
    o.n=['grossier','normal','fin'].map(k=>stlMaillage(stlFinesse(k)).tris);
    o.solide=[n0,triAvant()];
    const M=stlMaillage(stlFinesse('normal'));o.octets=[stlEcrire(M).byteLength,84+50*M.tris];
    o.approx=M.approx.length;
    o.cotes=[stlCotesCercle(5,{lin:0.1,ang:20}),stlCotesCercle(5,{lin:0.01,ang:5})];
    return o;})()`);
  A(r.corps,'pièce chargée avec son solide exact');
  if(r.corps){
    A(r.n[0]>0&&r.n[0]<r.n[1]&&r.n[1]<r.n[2],'grossier < normal < fin : '+r.n.join(' / ')+' triangles');
    A(r.solide[0]===r.solide[1],'triangles laissés sur le solide par l’affichage intacts ('+r.solide[0]+')');
    A(r.octets[0]===r.octets[1],'taille du fichier = 84 + 50 × triangles ('+r.octets[0]+' octets)');
    A(r.approx===0,'aucun corps repris du maillage affiché');
    A(r.cotes[0]===18&&r.cotes[1]===72,'côtés d’un cercle Ø10 annoncés : '+r.cotes.join(' / '));
  }
  console.log(ko?'\n'+ko+' ÉCHEC(S)':'\nTOUT OK');process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
