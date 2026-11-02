// Projections qui ont PERDU leurs contraintes « fix » (MERLIN-23-001, copie figée) :
// dans « Esquisse 2 (face) », la projetée de l'arête y=35 n'était plus fixée — le solveur la
// déplaçait avec les deux rectangles accrochés à ses bouts, le solide changeait, et toutes
// les projetées aval se raccrochaient en cascade à de mauvaises arêtes (dont des arêtes ⟂ au
// plan ou des perçages vus par la tranche → lignes de longueur nulle).
// Attendu : une projection reste fixe par nature, et le rejeu ne vise jamais une arête qui se
// projette en un point.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
const json=fs.readFileSync(path.join(ROOT,'tests','fixtures','merlin_proj_fix_perdus.conceptcad'),'utf8');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;sandbox.__json=json;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};window.confirm=function(){return true;};',ctx);
  const r=await vm.runInContext(`(async()=>{
    const F=[],P=[];const A=(c,m)=>{if(!c)F.push(m);else P.push(m);};
    await bundleRestore(__json,{rebuild:false});
    // projetées DÉJÀ réduites à un point dans le fichier : elles le restent (points de référence voulus ailleurs)
    const DEG0=new Set();doc.sketches.forEach(sk=>sk.entities.forEach(e=>{if(e.proj&&e.t==='line'){const a=sk.points[e.p1],b=sk.points[e.p2];if(Math.hypot(b.x-a.x,b.y-a.y)<1e-4)DEG0.add(sk.id+e.id);}}));
    const sk2=doc.sketches.find(s=>s.name==='Esquisse 2 (face)');
    const e3=sk2.entities.find(e=>e.id==='e3');
    A(skFixed(sk2).has(e3.p1)&&skFixed(sk2).has(e3.p2),'projetée sans contrainte fix : ses bouts restent fixes pour le solveur');
    await rebuild();
    const near=(p,x,y)=>p&&Math.hypot(p.x-x,p.y-y)<1e-3;
    const Q=sk2.points;
    A((near(Q[e3.p1],22.5,35)&&near(Q[e3.p2],-22.5,35))||(near(Q[e3.p1],-22.5,35)&&near(Q[e3.p2],22.5,35)),'Projetée 1 sur son arête y=35 : '+JSON.stringify([Q[e3.p1],Q[e3.p2]]));
    A(near(Q.p20,2.5,35)&&near(Q.p22,22.5,5),'le rectangle 20×30 accroché suit la projetée');
    let degen=[];
    doc.sketches.forEach(sk=>sk.entities.forEach(e=>{if(e.proj&&e.t==='line'&&!DEG0.has(sk.id+e.id)){const a=sk.points[e.p1],b=sk.points[e.p2];if(Math.hypot(b.x-a.x,b.y-a.y)<1e-4)degen.push(sk.name+' '+e.projName);}}));
    A(!degen.length,'aucune projetée de vraie longueur réduite à un point'+(degen.length?' : '+degen.join(', '):''));
    // ouverture : les fix manquants sont rétablis
    migrateSketch(sk2);
    A(sk2.constraints.some(c=>c.type==='fix'&&c.p===e3.p1)&&sk2.constraints.some(c=>c.type==='fix'&&c.p===e3.p2),'fix de la projetée rétablis à l’ouverture');
    A(skIsProjFix(sk2,sk2.constraints.find(c=>c.type==='fix'&&c.p===e3.p1)),'fix de projetée reconnu (non supprimable seul)');
    return P.map(m=>'  ✓ '+m).concat(F.map(m=>'  ✗ '+m)).join(String.fromCharCode(10))+(F.length?String.fromCharCode(10)+'ECHECS':'');
  })()`,ctx);
  console.log('=== projections : fix perdus (MERLIN-23-001) ===');console.log(r);
  process.exit(/ECHECS/.test(r)?1:0);
})().catch(e=>{console.error('FATAL',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
