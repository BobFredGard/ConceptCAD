// Supprimer UN corps sans perdre les autres (vrai noyau OCCT), sur l'exemple « Griffe » :
// « Griffe Lamée » (b2) est née d'une Symétrie « nouveau corps » de « Griffe Taraudée » (b1),
// et un perçage de b1 est posé sur une face de b2.
//  - supprimer b1 : b2 reste entier (copies de la symétrie DÉTACHÉES, devenues fonctions propres) ;
//  - supprimer b2 : b1 reste entier, la symétrie ne régénère plus cet exemplaire, le perçage
//    posé sur une face de b2 garde sa place.
// Puis le choix du corps dans les fonctions (featBodyField / treeFeatToBody).
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
const json=require('./lire-projet.cjs')(path.join(ROOT,'Exemples','Griffe.conceptcad'));
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=[
    "const P=[];const p=s=>P.push(String(s));",
    "const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);};",
    "confirm=function(){return true;};",
    "const nf=function(sh){let n=0;const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);while(ex.More()){n++;ex.Next();}ex.delete();return n;};",
    "const vol=function(sh){const g=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(sh,g,false,false,false);const v=g.Mass();g.delete();return v;};",
    "const etat=function(){occSkipFeat=null;occCk.length=0;const m=tlIdx();const FR=occFinalShape(m<0?null:m);const o={};FR.perBody.forEach(q=>{o[q.bodyId]={v:vol(q.shape),f:nf(q.shape)};});return o;};",
    "const J="+JSON.stringify(json)+";",
    // --- référence
    "await bundleRestore(J,{rebuild:false});resolveAllSketchHosts();",
    "const R0=etat();",
    "p('départ : '+Object.keys(R0).map(k=>k+' v='+R0[k].v.toFixed(1)+' f='+R0[k].f).join(' | '));",
    "att(R0.b1&&R0.b2,'départ : deux corps');",
    // --- 1) supprimer b1 (source de la symétrie) : b2 reste identique
    "delBody('b1');resolveAllSketchHosts();",
    "const R1=etat();",
    "p('sans b1 : '+Object.keys(R1).map(k=>k+' v='+R1[k].v.toFixed(1)+' f='+R1[k].f).join(' | '));",
    "att(!R1.b1,'b1 supprimé');",
    "att(R1.b2&&Math.abs(R1.b2.v-R0.b2.v)<1e-3*R0.b2.v&&R1.b2.f===R0.b2.f,'b2 intact après suppression de b1');",
    "att(!doc.features.some(f=>f.repeatId),'copies de la symétrie détachées (plus de repeatId)');",
    "att(!doc.features.some(f=>f.type==='repeat'),'symétrie retirée');",
    "att(doc.features.filter(f=>f.body==='b2').length>=2,'b2 garde ses fonctions');",
    "att(doc.bodies.length===1&&doc.bodies[0].id==='b2','seul b2 reste (vu '+doc.bodies.map(b=>b.id)+')');",
    "att(!(doc.sketches||[]).some(s=>skIsRepCopy(s)),'esquisses copiées devenues ordinaires');",
    // --- 2) supprimer b2 (exemplaire de la symétrie) : b1 identique, perçage sur face de b2 en place
    "await bundleRestore(J,{rebuild:false});resolveAllSketchHosts();",
    "const sk5=JSON.stringify(doc.sketches.find(s=>s.id==='sk_23_mvs855ef').origin);",
    "delBody('b2');resolveAllSketchHosts();",
    "const R2=etat();",
    "p('sans b2 : '+Object.keys(R2).map(k=>k+' v='+R2[k].v.toFixed(1)+' f='+R2[k].f).join(' | '));",
    "att(!(doc.bodies||[]).some(b=>b.id==='b2'),'b2 supprimé');",
    "att(!R2.b2,'b2 plus rejoué');",
    "att(R2.b1&&Math.abs(R2.b1.v-R0.b1.v)<1e-3*R0.b1.v&&R2.b1.f===R0.b1.f,'b1 intact après suppression de b2');",
    "att(doc.features.some(f=>f.id==='ho_24_mvs85b82'),'perçage de b1 posé sur b2 conservé');",
    "att(JSON.stringify(doc.sketches.find(s=>s.id==='sk_23_mvs855ef').origin)===sk5,'esquisse du perçage restée en place');",
    "att(!doc.features.some(f=>f.type==='repeat'),'symétrie sans exemplaire retirée');",
    // --- 3) annuler rend b2
    "docUndo();",
    "att((doc.bodies||[]).some(b=>b.id==='b2'),'annuler : b2 revient');",
    // --- 4) corps d'une fonction : le perçage Ø12 passe de b1 à b2 depuis le panneau
    "await bundleRestore(J,{rebuild:false});resolveAllSketchHosts();",
    "const ho=doc.features.find(f=>f.id==='ho_24_mvs85b82');",
    "att(typeof featBodyChoices==='function','featBodyChoices présente');",
    "const ch=featBodyChoices(ho);",
    "att(ch.map(e=>e.id).join()==='b1,b2','perçage Ø12 : deux corps proposés (vu '+ch.map(e=>e.id)+')');",
    "const ex3=doc.features.find(f=>f.id==='ex_3_mvs5wy3e');",
    "att(!featBodyChoices(ex3).length,'source de la symétrie « nouveau corps » : pas de choix');",
    "att(!treeFeatToBody(ex3.id,'b2')&&ex3.body==='b1','source de la symétrie : glisser vers b2 refusé');",
    // corps ordinaire vide créé après coup : proposé même à la 1re fonction
    "newBody();const b3=doc.activeBody;",
    "const ho11=doc.features.find(f=>f.id==='ho_11_mvs6935j');",
    "att(featBodyChoices(ho11).map(e=>e.id).indexOf(b3)>=0,'corps vide ordinaire proposé (vu '+featBodyChoices(ho11).map(e=>e.id)+')');",
    "att(featBodyChoices(ho11).map(e=>e.id).indexOf('b2')<0,'b2 (né de la symétrie, plus tard) non proposé');",
    "att(!featBodyChoices(doc.features.find(f=>f.id==='ex_7_mvs6zjzz')).length,'copie de répétition : pas de choix');",
    "treeFeatToBody(ho.id,'b2');",
    "att(ho.body==='b2','perçage passé dans b2');",
    // --- 5) « Retirer » (timeline, comme Fusion 360) : b1 absent après l'étape, rien d'effacé
    "await bundleRestore(J,{rebuild:false});resolveAllSketchHosts();",
    "const nF0=doc.features.length;",
    "const br=bodyRemoveAdd('b1');",
    "att(br&&br.type==='bremove'&&doc.features[doc.features.length-1]===br,'étape Retirer ajoutée en fin de timeline');",
    "att(doc.features.length===nF0+1&&doc.bodies.length===2,'rien d’effacé (fonctions et corps gardés)');",
    "const R5=etat();",
    "att(!R5.b1&&R5.b2&&Math.abs(R5.b2.v-R0.b2.v)<1e-3*R0.b2.v,'b1 retiré du modèle, b2 intact');",
    "att(!bodyRemoveAdd('b1'),'retirer deux fois refusé');",
    "tlSetPtr(br);",
    "att(!!etat().b1,'marqueur avant l’étape : b1 revient');",
    "tlSetPtr(null);delFeature(br);",
    "att(!!etat().b1,'étape supprimée : b1 revient');",
    "if(ATT.length){p('');p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}",
    "else p('TOUT EST CONFORME');",
    "return P.join(String.fromCharCode(10));"
  ].join('\n');
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'corps_suppression.js'});
  console.log(r);
  process.exit(/ECHECS/.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
