// V0.67.0 : le noyau multicœur (occt/mt, 4 fils) rend les mêmes pièces que le noyau normal (occt/v3).
// Chaque noyau tourne dans son propre processus (tests/noyau.cjs lit OCCT_DIR au chargement), sur
// Barquette, seule pièce où les fils gagnent nettement, et Axe. Le navigateur : noyau-multicoeur.spec.
const vm=require('vm'),path=require('path'),{spawnSync}=require('child_process');
const EXEMPLES=['Barquette','Axe'];
if(process.argv[2]==='--un'){
  (async()=>{
    const {loadApp}=require('./appvm.cjs'),lireProjet=require('./lire-projet.cjs');
    const real=await require('./noyau.cjs').charger();
    const {ctx,sandbox}=loadApp();
    sandbox.__realOcct=real;
    vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
    require('./noyau.cjs').brancherFichiers(sandbox,ctx);
    const res={};
    for(const nom of EXEMPLES){
      sandbox.__json=lireProjet(path.join(__dirname,'..','Exemples',nom+'.conceptcad'));
      res[nom]=await vm.runInContext(String.raw`(async()=>{const raw=JSON.parse(__json);
        if(raw.doc)await bundleRestore(__json,{rebuild:false});else await deserialise(__json,{rebuild:false});
        occCkClear();markDirty();rebuild();
        const E=occt.TopAbs_ShapeEnum,nb=(s,t)=>{let n=0;const x=new occt.TopExp_Explorer_2(s,t,E.TopAbs_SHAPE);for(;x.More();x.Next())n++;x.delete();return n;};
        return bodies.filter(b=>b.shape).map(b=>[b.name,nb(b.shape,E.TopAbs_FACE),nb(b.shape,E.TopAbs_EDGE),+occShapeVolume(b.shape).toFixed(3)]);})()`,ctx);
    }
    console.log('@@'+JSON.stringify(res));
    process.exit(0);
  })().catch(e=>{console.error(e);process.exit(1);});
}else{
  let ko=0;
  const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
  const lancer=env=>{
    const r=spawnSync(process.execPath,[__filename,'--un'],{env:{...process.env,...env},encoding:'utf8',maxBuffer:1<<26,timeout:300000});
    const l=String(r.stdout||'').split('\n').find(x=>x.startsWith('@@'));
    if(!l)console.log(String(r.stdout||'').slice(-500)+String(r.stderr||'').slice(-1000));
    return l?JSON.parse(l.slice(2)):null;
  };
  console.log('=== Noyau multicœur : mêmes pièces que le noyau normal ===');
  const {OCCT_FILS:_f,OCCT_DIR:_d}=process.env;
  const normal=lancer({OCCT_DIR:path.join(__dirname,'..','occt','v3'),OCCT_FILS:''});
  const multi=lancer({OCCT_DIR:path.join(__dirname,'..','occt','mt'),OCCT_FILS:'4'});
  A(normal&&multi,'les deux noyaux calculent');
  if(normal&&multi)for(const nom of EXEMPLES){
    A(normal[nom].length>0,nom+' : '+normal[nom].length+' corps, '+JSON.stringify(normal[nom][0]));
    A(JSON.stringify(normal[nom])===JSON.stringify(multi[nom]),nom+' : mêmes corps, faces, arêtes et volumes avec 4 fils'+(JSON.stringify(normal[nom])===JSON.stringify(multi[nom])?'':' → '+JSON.stringify(multi[nom])));
  }
  console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
  process.exit(ko?1:0);
}
