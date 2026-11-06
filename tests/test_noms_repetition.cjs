// Une copie de répétition garde le nom de ses références quand le modèle change. Cavité Test : les congés
// copiés de la Symétrie double suivent la largeur et la longueur, à l'aller comme au retour.
// Lancé seul : node tests/test_noms_repetition.cjs
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;sandbox.__txt=lire(path.join(ROOT,'Exemples','Cavité Test.conceptcad'));
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
  const R=String.raw`
    await bundleRestore(__txt,{name:'banc'});occt=__realOcct;occtReady=true;markDirty();rebuild();
    const sk=doc.sketches[0],out=[];
    const noms=()=>doc.features.filter(f=>f.type==='xfillet').map(f=>(f.edges||[]).map(e=>e.nom));
    const lit=()=>{const FR=occFinalShape(null),m={v:+occShapeVolume(FR.shape).toFixed(1),ar:occListEdges(FR.shape).length,al:(FR.msgs||[]).slice(0,3),noms:noms()};try{occCleanup(FR,null);}catch(e){}return m;};
    const pose=(id,v)=>{sk.dims.find(x=>x.id===id).value=v;solveSketch(sk);parApplyAll();markDirty();rebuild();};
    out.push(['départ',lit()]);
    for(const v of [120,125,130]){pose('e24',v);out.push(['largeur '+v,lit()]);pose('e24',104);out.push(['retour de '+v,lit()]);}
    pose('e24',130);out.push(['largeur 130 (2e fois)',lit()]);pose('e24',104);
    pose('e23',200);out.push(['longueur 200',lit()]);pose('e23',150);out.push(['retour de 200',lit()]);
    return out;`;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  const fails=[],A=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)fails.push(m);};
  console.log('=== Cavité Test : congés copiés par la symétrie ===');
  const dep=o[0][1];
  o.forEach(([t,m])=>{
    A(!m.al.length,t+' : aucune alerte'+(m.al.length?' — '+m.al[0]:''));
    A(JSON.stringify(m.noms)===JSON.stringify(dep.noms),t+' : chaque congé garde son arête');
    A(m.ar===dep.ar,t+' : même nombre d’arêtes ('+m.ar+'/'+dep.ar+')');
    if(/^retour/.test(t))A(m.v===dep.v,t+' : solide revenu à l’identique ('+m.v+')');
  });
  if(fails.length){console.log('\n*** '+fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
