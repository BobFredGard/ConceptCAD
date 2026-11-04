// Les noms survivent à l'enregistrement, ne rendent pas le document « modifié », et une référence perdue se voit.
// Lancé seul : node tools/ci-moteur.cjs occt/v3 -- tests/test_noms_reouverture.cjs
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  if(!real.NCollection_IndexedDataMap_TopoDS_Shape_NCollection_List_TopoDS_Shape_TopTools_ShapeMapHasher){console.log('=== Réouverture : noyau sans carte indexée, sauté ===\n\n*** TOUT PASSE ***');return;}
  const nouv=()=>{const {ctx,sandbox}=loadApp();sandbox.__realOcct=real;vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);return {ctx,sandbox};};
  const lit=String.raw`
    const nb=v=>+(+v).toFixed(3);
    const lit=()=>{const FR=occFinalShape(null),m={v:nb(occShapeVolume(FR.shape)),box:occShapeBox(FR.shape,0).map(c=>c.map(nb)),msgs:(FR.msgs||[]).slice()};try{occCleanup(FR,null);}catch(e){}return m;};
    const noms=()=>{let n=0;(doc.features||[]).forEach(f=>{if(f.type==='xfillet')(f.edges||[]).forEach(e=>{if(e.nom)n++;});});return n;};`;
  const A1=nouv();A1.sandbox.__txt=lire(path.join(ROOT,'Exemples','Barquette.conceptcad'));
  const R1=lit+String.raw`
    await bundleRestore(__txt,{name:'banc'});occt=__realOcct;occtReady=true;
    const h0=docHash();
    markDirty();rebuild();
    const h1=docHash();
    const P=doc.params.find(p=>p.name==='longueur_barquette');
    const nomsAvant=noms();
    return {h0,h1,nomsAvant,txt:serialise(false),att:(P.expr='250',parApplyAll(),markDirty(),rebuild(),lit())};`;
  const a=await vm.runInContext('(async()=>{'+R1+'})()',A1.ctx);
  const A2=nouv();A2.sandbox.__txt=a.txt;
  const R2=lit+String.raw`
    deserialise(__txt);occt=__realOcct;occtReady=true;
    const n=noms();
    markDirty();rebuild();
    const P=doc.params.find(p=>p.name==='longueur_barquette');
    P.expr='250';parApplyAll();markDirty();rebuild();
    const apres=lit();
    // référence perdue : visible ; nom retrouvé : l'alerte disparaît
    const x=(doc.features||[]).find(f=>f.type==='xfillet'&&(f.edges||[]).length);
    const e=x.edges[0],garde=e.nom;
    e.nom='inconnu/a|inconnu/b';P.expr='251';parApplyAll();markDirty();rebuild();
    const perdu=lit().msgs.filter(t=>/n’existe plus|introuvable|perdu/i.test(t));
    e.nom=garde;P.expr='252';parApplyAll();markDirty();rebuild();
    const rendu=lit().msgs.filter(t=>/n’existe plus|introuvable|perdu/i.test(t));
    return {n,apres,perdu,rendu};`;
  const b=await vm.runInContext('(async()=>{'+R2+'})()',A2.ctx);
  const fails=[],A=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)fails.push(m);};
  console.log('=== Noms et enregistrement ===');
  A(a.h0===a.h1,'les noms posés à l’ouverture ne rendent pas le document « modifié »');
  A(a.nomsAvant>0&&b.n===a.nomsAvant,'les noms sont enregistrés et relus ('+b.n+' congés nommés)');
  A(b.apres.v===a.att.v&&JSON.stringify(b.apres.box)===JSON.stringify(a.att.box),'après réouverture, le grand changement donne le même solide ('+b.apres.v+' / '+a.att.v+')');
  A(b.perdu.length>0,'une référence perdue s’affiche ('+(b.perdu[0]||'rien')+')');
  A(!b.rendu.length,'l’alerte disparaît quand la référence revient');
  if(fails.length){console.log('\n*** '+fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
