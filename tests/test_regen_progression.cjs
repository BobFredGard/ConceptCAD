// V0.42.0 : régénération avec barre de progression (src/31). La préchauffe vide le MÊME rejeu
// (occFinalShapeGen) par tranches, en rendant la main au navigateur entre deux fonctions ; le
// rebuild() qui suit relit ses points de contrôle. Contrôles au noyau OCCT RÉEL, sur des exemples :
//  1) la préchauffe rend la main (au moins une tranche par fonction) et va au bout ;
//  2) le solide final est STRICTEMENT identique au rejeu synchrone habituel (topologie + boîte par
//     corps) ; même topologie que le rejeu à froid (sa boîte diffère de quelques centièmes sur
//     « Perçages » — marge de tolérance d'une copie de point de contrôle, déjà vrai avant V0.42.0) ;
//  2b) ⟳ Régénérer (regenTout → runValidateProgress, V0.43.1) donne le même solide ;
//  3) le rejeu final après préchauffe ne recalcule plus rien de lourd (bien plus rapide).
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
let ko=0;const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
const EX=['Cache Piles.conceptcad','Support Pédale Déportée R1200RT 2011.conceptcad','Perçages.conceptcad'];
(async()=>{
  const real=await require('./noyau.cjs').charger();
  for(const nom of EX){
    const {ctx,sandbox}=loadApp();
    sandbox.__realOcct=real;
    vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
    const json=require('./lire-projet.cjs')(path.join(ROOT,'Exemples',nom));
    const o=await vm.runInContext(`(async()=>{
      const raw=JSON.parse(${JSON.stringify(json)});
      if(raw.doc)await bundleRestore(${JSON.stringify(json)},{rebuild:false});else await deserialise(${JSON.stringify(json)},{rebuild:false});
      const ex=(sh,t)=>{const x=new occt.TopExp_Explorer_2(sh,t,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);let n=0;while(x.More()){n++;x.Next();}x.delete();return n;};
      const T=occt.TopAbs_ShapeEnum;
      const bb=sh=>{const b=new occt.Bnd_Box_1();occt.BRepBndLib.Add(sh,b,true);const a=b.CornerMin(),z=b.CornerMax();b.delete();return [a.X(),a.Y(),a.Z(),z.X(),z.Y(),z.Z()].map(x=>(+x).toFixed(4)).join(',');};
      const topo=()=>bodies.filter(b=>b.kind==='body'&&b.shape).map(b=>b.id+':'+ex(b.shape,T.TopAbs_FACE)+'f/'+ex(b.shape,T.TopAbs_EDGE)+'e/'+ex(b.shape,T.TopAbs_VERTEX)+'v@'+bb(b.shape)).join(' | ');
      const out={nf:doc.features.length};
      // référence : rejeu synchrone à froid
      occCkClear();builtVersion=-1;builtHash=null;
      let t=performance.now();rebuild();out.msFroid=performance.now()-t;out.froid=topo();
      builtVersion=-1;t=performance.now();rebuild();out.msRef=performance.now()-t;out.ref=topo(); // rejeu synchrone habituel (points de contrôle)
      // préchauffe par tranches puis rejeu final
      occCkClear();builtVersion=-1;builtHash=null;
      window.__regenSync=false;
      out.utile=regenWarmUseful();
      const G=occFinalShapeGen;let tranches=0;
      occFinalShapeGen=function*(u,w){const g=G(u,w);for(;;){const r=g.next();if(r.done)return r.value;if(w)tranches++;yield r.value;}};
      t=performance.now();out.ok=await regenWarm('test');out.msChauffe=performance.now()-t;
      occFinalShapeGen=G;
      out.tranches=tranches;
      t=performance.now();builtVersion=-1;rebuild();regenUiHide();out.msFinal=performance.now()-t;
      out.got=topo();
      // ⟳ Régénérer (V0.43.1) : phases de validation + caches jetés + rejeu préchauffé
      const rp=await regenTout();out.val=typeof rp==='string'&&/VALIDATION/.test(rp);out.gotVal=topo();
      return out;})()`,ctx);
    console.log('· '+nom+' : '+o.nf+' fonctions, '+o.tranches+' tranches ; froid '+Math.round(o.msFroid)+' ms, préchauffe '+Math.round(o.msChauffe)+' ms, rejeu final '+Math.round(o.msFinal)+' ms');
    A(o.utile&&o.ok===true,nom+' : préchauffe utile et menée au bout');
    A(o.tranches>0,nom+' : le rejeu a rendu la main entre les fonctions');
    const sansBoite=x=>String(x).replace(/@[^ |]*/g,'');
    A(o.ref&&o.got===o.ref,nom+' : solide identique au rejeu synchrone ('+(o.ref||'vide').slice(0,90)+'…)');
    A(o.froid&&sansBoite(o.got)===sansBoite(o.froid),nom+' : même topologie que le rejeu à froid');
    if(o.got!==o.ref)console.log('    réf : '+o.ref+'\n    obt : '+o.got);
    A(o.val&&o.gotVal===o.ref,nom+' : ⟳ Régénérer avec barre — rapport rendu, solide identique');
    // le rejeu final coûte un rejeu ordinaire sur points de contrôle (filets modélisés compris), pas un rejeu à froid
    A(o.msFinal<=o.msRef*2+250||o.msFinal<o.msFroid*0.6,nom+' : le rejeu final relit la préchauffe (final '+Math.round(o.msFinal)+' ms, rejeu ordinaire '+Math.round(o.msRef)+' ms)');
  }
  console.log(ko?'ÉCART':'*** TOUT PASSE ***');process.exit(ko?1:0);
})().catch(e=>{console.log('ERREUR',e&&e.stack||e);process.exit(1);});
