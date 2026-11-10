// V0.89.2 : un congé groupé ne déborde plus des arêtes choisies.
// Crochet : 7 arêtes dans un congé, dont l'arête du dessus (28 mm). De R4,2 à R4,4 sur cette arête, le
// calcul en une passe est refusé par le noyau et les arêtes sont faites une à une. Le bout restant d'une
// arête courte, devenu tangent au congé voisin, entraînait alors le noyau tout autour de la pièce :
// 9 faces et 356 mm³ de plus, sans un mot. Désormais : arête laissée vive et signalée.
// À R6 (paroi de 6 mm) : l'arête refusée dit pourquoi, comme quand elle est seule.
const vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
let ko=0;const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  sandbox.__json=require('./lire-projet.cjs')(path.join(ROOT,'tests','fixtures','crochet-conge-groupe.conceptcad'));
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};confirm=function(){return true;};showAll=function(){};applyView=function(){};',ctx);
  const o=await vm.runInContext(`(async()=>{const out={};
    await bundleRestore(__json,{name:'banc'});markDirty();rebuild();
    const f=doc.features.find(x=>x.type==='xfillet'&&x.edges.length===7);
    const i0=f.edges.findIndex(e=>Math.abs(e.len-28)<0.01);
    const vu=r=>{f.edges[i0].r=r;markDirty();rebuild();
      const F=occFinalShape(doc.features.indexOf(f)+1);const sh=F.perBody[0].shape;
      const an=new occt.BRepCheck_Analyzer(sh,true);const ok=an.IsValid_2();an.delete();
      const x={r,valide:ok,faces:occSubShapes(sh,'TopAbs_FACE').length,vol:occCoqueVolume(sh),rate:f._rate?f._rate.n:0,msgs:[...new Set(F.msgs||[])].join(' | ')};
      occCleanup(F,null);return x;};
    out.i0=i0;out.a=vu(4.2);out.b=vu(4.4);out.c=vu(5);out.d=vu(6);
    return out;})()`,ctx);
  console.log('=== Congé groupé : pas de débordement hors des arêtes choisies ===');
  A(o.i0>=0,'arête du dessus (28 mm) trouvée dans le congé de 7');
  A(o.a.valide&&o.a.rate===0&&o.a.faces===20,'R4,2 : les 7 arêtes faites en une passe — '+o.a.faces+' faces, '+o.a.vol.toFixed(1)+' mm³');
  A(o.b.valide&&o.b.faces<=20,'R4,4 : pas de faces en plus ('+o.b.faces+' ; 29 avant la correction)');
  A(Math.abs(o.b.vol-o.a.vol)<40,'R4,4 : volume dans la continuité de R4,2 ('+o.b.vol.toFixed(1)+' ; 7 515 avant, soit 333 mm³ partis d’un coup)');
  A(o.b.rate===1&&/non choisies/.test(o.b.msgs),'R4,4 : l’arête que le noyau prolongeait est signalée non faite, avec la raison');
  A(o.c.valide&&o.c.faces<=20&&o.c.vol<o.b.vol&&o.b.vol-o.c.vol<80,'R5 : même tenue ('+o.c.faces+' faces, '+o.c.vol.toFixed(1)+' mm³)');
  A(o.d.rate===1&&/paroi de 6 mm/.test(o.d.msgs),'R6 sur une paroi de 6 mm : arête refusée, et la raison est dite');
  console.log(ko?'ÉCHEC : '+ko:'*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
