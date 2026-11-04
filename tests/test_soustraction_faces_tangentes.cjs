// V0.47.2 : « Impossible de voir la dernière soustraction » (Barquette). Le décalage « Faces
// tangentes » du corps Intérieur rendait une COQUE : soustraction sans effet et sans message.
// Fichier de l'utilisateur figé dans tests/fixtures. Le décalage demande le noyau OCCT 8.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  sandbox.__doc=require('./lire-projet.cjs')(path.join(ROOT,'tests','fixtures','barquette-soustraction.conceptcad'));
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
  const R=`
    const out={fails:[],log:[],saut:null};
    const A=(c,m)=>{(c?out.log:out.fails).push(m);};
    await bundleRestore(__doc,{rebuild:false});resolveAllSketchHosts();
    if(!occHasFaceOffset()){out.saut='noyau sans décalage de faces (OCCT 8 requis)';return out;}
    const cb=doc.features.find(f=>f.type==='combine');
    occSkipFeat=null;occCk.length=0;
    const bin=[],outil=occCombineTool(cb,'b4',bin);
    const nb=(s,k)=>{const L=occSubShapes(s,k),n=L.length;occDispose(L);return n;};
    A(outil&&nb(outil,'TopAbs_SOLID')===1,'1 : le corps outil est un solide');
    const vOutil=occShapeVolume(outil);
    A(vOutil>800000&&vOutil<900000,'2 : volume de l’outil gardé ('+vOutil.toFixed(0)+' mm³)');
    const FR=occFinalShape(null),b=FR.perBody.find(p=>p.bodyId==='b1');
    const v=occShapeVolume(b.shape);
    A(v>1000&&v<300000,'3 : la soustraction retire la matière ('+v.toFixed(0)+' mm³, 924 553 sans la coupe)');
    A(occCoqueValide(b.shape)&&nb(b.shape,'TopAbs_SOLID')>=1,'4 : le résultat est un solide valide');
    A(!(FR.msgs||[]).length,'5 : sans alerte ('+((FR.msgs||[]).join(' | ')||'aucune')+')');
    // ── corps outil barré dans l'arbre à partir de la combinaison ──
    const iC=doc.features.indexOf(cb);
    A(bodyConsumedBy('b4',-1)===cb,'6 : Intérieur consommé en fin de timeline');
    A(!bodyConsumedBy('b4',iC),'7 : marqueur avant la soustraction : Intérieur est encore là');
    A(!bodyConsumedBy('b1',-1),'8 : le corps cible n’est pas barré');
    A(!!bodyConsumedBy('b2',-1),'9 : un corps retiré est barré aussi');
    cb.keep=true;A(!bodyConsumedBy('b4',-1),'10 : avec « garder », l’outil reste');cb.keep=false;
    return out;
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  if(r.saut){console.log('  (sauté : '+r.saut+')');console.log('OK : sauté');return;}
  r.log.forEach(m=>console.log('  ✓ '+m));
  r.fails.forEach(m=>console.log('  ✗ '+m));
  if(r.fails.length){console.log('ÉCHEC : '+r.fails.length);process.exit(1);}
  console.log('OK : soustraction après décalage de faces tangentes');
})().catch(e=>{console.error(e);process.exit(1);});
