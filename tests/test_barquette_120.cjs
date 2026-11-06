// RETOUR DE MESURE (06/11/2026) : Barquette perdait son solide à la 107e modification de suite de
// largeur_barquette, quelle que soit la valeur, et ne le rendait qu'au rechargement (voir test_pile_noyau).
// Ici la série complète, sur la vraie pièce : 120 valeurs différentes, jamais de perte, pile immobile, et le
// même volume au retour à la valeur de départ. Long (6 s par modification) : suite complète seulement.
const vm=require('vm'),path=require('path');
const {loadApp}=require('./appvm.cjs');
const lireProjet=require('./lire-projet.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  sandbox.__json=lireProjet(path.join(__dirname,'..','Exemples','Barquette.conceptcad'));
  await vm.runInContext(String.raw`(async()=>{const raw=JSON.parse(__json);
    if(raw.doc)await bundleRestore(__json,{rebuild:false});else await deserialise(__json,{rebuild:false});
    markDirty();rebuild();})()`,ctx);
  const corps=()=>vm.runInContext("bodies.filter(b=>b.kind==='body'&&b.shape).length",ctx);
  const volume=()=>vm.runInContext("occShapeVolume(occLive.shape)",ctx);
  const poser=async v=>{sandbox.__val=String(v);
    await vm.runInContext("(async()=>{parSetParam(doc.params.find(x=>x.name==='largeur_barquette'),__val);await parAfterChange(true);})()",ctx);};
  const NB=120;
  console.log('=== Barquette : '+NB+' modifications de suite ===');
  const v0=+vm.runInContext("doc.params.find(x=>x.name==='largeur_barquette').expr",ctx);
  const vol0=volume(),pile0=real.stackSave();
  A(corps()===1,'solide à l’ouverture ('+vol0.toFixed(1)+' mm³)');
  let perteA=-1;
  for(let i=1;i<=NB&&perteA<0;i++){
    await poser(+(v0+(i%2?-1:1)*0.01*((i+1)>>1)).toFixed(4));
    if(corps()!==1)perteA=i;
  }
  A(perteA<0,perteA<0?NB+' modifications : le solide est toujours là':'solide perdu à la modification '+perteA);
  A(pile0-real.stackSave()<1024,'pile du noyau immobile ('+(pile0-real.stackSave())+' octets perdus ; plus de 8 Mo sur cette série avant)');
  await poser(v0);
  const vol1=corps()===1?volume():NaN;
  A(Math.abs(vol1-vol0)<=1e-6*vol0,'retour à '+v0+' : même volume ('+vol1.toFixed(1)+' mm³)');
  console.log(ko?'ÉCHEC : '+ko:'*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
