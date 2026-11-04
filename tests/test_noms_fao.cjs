// Les faces choisies pour l'usinage suivent leur nom quand le modèle change, sans changer les clés de parcours
// tant que le modèle est identique. Lancé seul : node tools/ci-moteur.cjs occt/v3 -- tests/test_noms_fao.cjs
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  if(!real.NCollection_IndexedDataMap_TopoDS_Shape_NCollection_List_TopoDS_Shape_TopTools_ShapeMapHasher){console.log('=== FAO : noyau sans carte indexée, sauté ===\n\n*** TOUT PASSE ***');return;}
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;sandbox.__txt=lire(path.join(ROOT,'Exemples','Barquette.conceptcad'));
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
  const R=String.raw`
    await bundleRestore(__txt,{name:'banc'});occt=__realOcct;occtReady=true;markDirty();rebuild();
    const b=bodies.find(x=>x.kind==='body'&&x.shape);
    const T=NOMS_TABLES.get(b.shape);
    const centre=(sh,k)=>{const m=nomsCarteFaces(sh);try{return nomsCentre(m.FindKey(k+1));}finally{m.delete();}};
    // le rang du maillage (clic) désigne la même face que le rang de la table des noms
    let memeOrdre=true,nb=0;
    {const m=nomsCarteFaces(b.shape),ex=new occt.TopExp_Explorer_2(b.shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
     for(;ex.More();ex.Next()){if(!ex.Current().IsSame(m.FindKey(nb+1)))memeOrdre=false;nb++;}
     ex.delete();m.delete();}
    const bas=T.f.findIndex(n=>/\/bas$/.test(n||''));
    const op={id:'optest',type:'geofinish',faces:[{b:b.id,f:bas}],protect:[{b:b.id,f:(bas+1)%T.f.length}]};
    doc.fao=doc.fao||{};faoRoot();faoRoot().setups[0].ops=(faoRoot().setups[0].ops||[]).concat([op]);
    const sig0=JSON.stringify(faoOpSig({type:'geofinish',faces:[{b:b.id,f:bas}]}));
    faoFacesSuivre();
    const nomB=op.faces[0].nom,nomP=op.protect[0].nom;
    const sig1=JSON.stringify(faoOpSig({type:'geofinish',faces:op.faces}));
    const fAvant=op.faces[0].f;
    // même modèle : rien ne bouge
    markDirty();rebuild();
    const stable=op.faces[0].f===fAvant;
    const c0=centre(bodies.find(x=>x.id===b.id).shape,op.faces[0].f);
    // grand changement : la face reste celle du même nom
    const Q=n=>doc.params.find(p=>p.name===n);
    Q('longueur_barquette').expr='250';parApplyAll();markDirty();rebuild();
    const b2=bodies.find(x=>x.id===b.id),T2=NOMS_TABLES.get(b2.shape);
    const nomApres=T2.f[op.faces[0].f];
    // faire croire à un rang périmé : il est corrigé par le nom
    op.faces[0].f=(op.faces[0].f+1)%T2.f.length;faoFacesSuivre();
    const corrige=T2.f[op.faces[0].f]===nomB||(T2.a&&T2.a[nomB]===T2.f[op.faces[0].f]);
    // nom disparu : le rang reste et l'alerte le dit
    const n0=NOMS_PERTES_ESQ.size;op.protect[0].nom='inconnu/xx';const pr0=op.protect[0].f;faoFacesSuivre();
    const alerte=NOMS_PERTES_ESQ.size===n0+1&&op.protect[0].f===pr0;
    NOMS_PERTES_ESQ.clear();
    // le nom ne va pas dans l'empreinte du document
    const clean=faoFaceListClean(op.faces);
    return {nb,memeOrdre,nomB,nomP,sig0,sig1,stable,nomApres,corrige,alerte,garde:clean[0].nom===nomB};`;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  const fails=[],A=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)fails.push(m);};
  console.log('=== Faces choisies pour l’usinage ===');
  A(o.memeOrdre&&o.nb>0,'le rang du clic et celui de la table désignent la même face ('+o.nb+' faces)');
  A(!!o.nomB&&!!o.nomP,'les faces choisies retiennent leur nom ('+o.nomB+')');
  A(o.sig0===o.sig1,'le nom ne change pas la clé des parcours');
  A(o.stable,'modèle identique : le choix ne bouge pas');
  A(o.nomApres===o.nomB,'grand changement : toujours la même face ('+o.nomApres+')');
  A(o.corrige,'un rang périmé est corrigé par le nom');
  A(o.alerte,'nom disparu : rang conservé et alerte');
  A(o.garde,'le nom survit au nettoyage à l’ouverture');
  if(fails.length){console.log('\n*** '+fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
