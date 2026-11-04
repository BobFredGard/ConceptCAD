// Socle des noms uniques (src/20-05-noms.js) : sur le document réel de la Barquette, chaque face
// issue d'une extrusion, d'une fusion, d'une découpe, d'une dépouille ou d'un congé porte un nom ;
// aucun doublon ; le nom survit à un changement de longueur, d'un coup comme par petits pas, et le
// bord de la lèvre garde le sien à la bonne position. Lancé seul : node tools/ci-moteur.cjs occt/v3 -- tests/test_noms_socle.cjs
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  if(!real.NCollection_IndexedDataMap_TopoDS_Shape_NCollection_List_TopoDS_Shape_TopTools_ShapeMapHasher){console.log('=== Noms uniques : noyau sans carte indexée, sauté ===\n\n*** TOUT PASSE ***');return;}
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;sandbox.__txt=lire(path.join(ROOT,'Exemples','Barquette.conceptcad'));
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};
    const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    await bundleRestore(__txt,{name:'banc'});occt=__realOcct;occtReady=true;markDirty();rebuild();
    const P=n=>doc.params.find(p=>p.name===n);
    // Corps b1 arrêté juste avant la scission : extrusions, dépouille, découpe, deux congés
    const liste=()=>{const k=doc.features.findIndex(f=>f.id==='bs_10_mvzpxjw0');return doc.features.slice(0,k);};
    const lire_=()=>{
      const r=occReplayBodyIn('b1',liste());
      const T=nomsDe(r.shape);
      const m=nomsCarteFaces(r.shape),F={};let sans=0;const tous=[];
      for(let i=1;i<=m.Size();i++){const n=T?T.f[i-1]:null;if(!n){sans++;continue;}tous.push(n);const b=occFaceBox(m.FindKey(i));F[n]=b&&b.pos?b.pos.map(v=>+v.toFixed(2)):null;}
      const Ar=nomsAretes(r.shape);const noms=Ar?Ar.noms.slice():[];try{if(Ar)Ar.carte.delete();}catch(e){}
      const res={table:!!T,n:m.Size(),sans,tous,F,aretes:noms};
      try{m.delete();}catch(e){}
      try{occCleanup(r,null);}catch(e){}
      return res;
    };
    const poser=v=>{P('longueur_barquette').expr=String(v);parApplyAll();markDirty();rebuild();};
    const base=lire_();
    A(base.table,'le corps porte une table de noms');
    A(base.sans===0,'toutes les faces sont nommées ('+(base.n-base.sans)+'/'+base.n+')');
    A(new Set(base.tous).size===base.tous.length,'aucun nom de face en double');
    A(new Set(base.aretes).size===base.aretes.length,'aucun nom d’arête en double ('+new Set(base.aretes).size+'/'+base.aretes.length+')');
    A(base.tous.some(n=>n.startsWith('congé[')),'un congé porte le nom de son arête');
    out.exemples=base.tous.slice(0,10);
    const copie=lire_();
    A(JSON.stringify(copie.tous.slice().sort())===JSON.stringify(base.tous.slice().sort()),'les points de contrôle redonnent les mêmes noms');
    poser(235);const petit=lire_();poser(240);poser(245);poser(250);const pas=lire_();
    poser(230);poser(250);const saut=lire_();
    const nb=x=>x.tous.filter(n=>base.tous.indexOf(n)>=0).length;
    A(nb(petit)===base.tous.length,'235 : tous les noms de départ sont retrouvés ('+nb(petit)+'/'+base.tous.length+')');
    A(nb(pas)===base.tous.length,'250 par petits pas : tous les noms retrouvés ('+nb(pas)+'/'+base.tous.length+')');
    A(nb(saut)===base.tous.length,'250 d’un coup : tous les noms retrouvés ('+nb(saut)+'/'+base.tous.length+')');
    A(JSON.stringify(saut.tous.slice().sort())===JSON.stringify(pas.tous.slice().sort()),'saut et petits pas donnent les mêmes noms');
    const eL=Object.keys(base.F).filter(n=>Math.abs(base.F[n][0]-115)<0.01&&Math.abs(base.F[n][1])<0.01);
    A(eL.length>0,'une face du bord de la lèvre est repérée à x = 115 ('+eL.join(', ')+')');
    eL.forEach(n=>A(saut.F[n]&&Math.abs(saut.F[n][0]-125)<0.01,'à 250 d’un coup, « '+n+' » est à x = 125 ('+(saut.F[n]||[]).join(',')+')'));
    return out;`;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Noms uniques : socle (Barquette, noyau réel) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(process.env.NOMS_VERBEUX)console.log(o.exemples);
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
