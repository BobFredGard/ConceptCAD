// V0.99.13 — FAO : reconnaissance des trous par le côté de la matière lu sur la face (vote), au lieu de
// 16 points classés sur le solide entier pour chaque trou (SIRAP-14-002 : 1,9 s à CHAQUE reconstruction,
// ajout d'un perçage 1,85 → 0,94 s ; plaque SIRAP-14-003 : 11,6 s → 0,04 s sur 6 repères).
// Ici : mêmes trous qu'avec l'ancien tri (faoHoleVoteOff) sur des pièces d'exemple, dans 6 repères ;
// Griffe (deux corps) : l'ancien tri ne voyait que le 1er corps, le vote trouve aussi les lamages du 2e.
const vm=require('vm'),path=require('path');
const {loadApp}=require('./appvm.cjs');
const lireProjet=require('./lire-projet.cjs');
let ko=0;const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
const FRAMES='[null,{X:[0,1,0],Y:[0,0,1],Z:[1,0,0]},{X:[0,0,1],Y:[1,0,0],Z:[0,1,0]},{X:[1,0,0],Y:[0,-1,0],Z:[0,0,-1]},{X:[0,-1,0],Y:[0,0,1],Z:[-1,0,0]},{X:[0,0,1],Y:[-1,0,0],Z:[0,-1,0]}]';
async function piece(nom){
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  sandbox.__json=lireProjet(path.join(__dirname,'..','Exemples',nom));
  return vm.runInContext(String.raw`(async()=>{const raw=JSON.parse(__json);
    if(raw.doc)await bundleRestore(__json,{rebuild:false});else await deserialise(__json,{rebuild:false});
    markDirty();rebuild();
    const ws=faoHoleShapesW(),res=[];let cl=0;
    const oI=globalThis.faoHoleIsHole;globalThis.faoHoleIsHole=function(){cl++;return oI.apply(this,arguments);};
    ${FRAMES}.forEach(function(F){
      const sh=F?ws.map(function(s){return faoShapeToF(s,F);}):ws;
      const lis=function(off){faoHoleVoteOff=off;faoHoleCache={shape:null,list:null};
        return faoHolesDetect0(sh).map(function(h){return [h.x,h.y,h.d,h.ztop,h.zbot,h.through].join('|');}).sort();};
      const a=lis(true);cl=0;const b=lis(false);
      res.push({ancien:a,vote:b,cl:cl});
    });
    faoHoleVoteOff=false;globalThis.faoHoleIsHole=oI;
    return JSON.stringify(res);})()`,ctx).then(JSON.parse);
}
(async()=>{
  console.log('=== FAO : trous reconnus par le côté de la matière (V0.99.13) ===');
  for(const nom of ['Perçages.conceptcad','Axe.conceptcad','Test Répétition Courbe.conceptcad','Support Pédale Déportée R1200RT 2011.conceptcad']){
    const r=await piece(nom);
    const n=r.reduce((s,x)=>s+x.vote.length,0),same=r.every(x=>JSON.stringify(x.ancien)===JSON.stringify(x.vote));
    A(same&&n>0,nom+' : mêmes trous qu’avant dans les 6 repères ('+n+' trous)');
    A(r.every(x=>x.cl===0),nom+' : aucune classification de la matière ('+r.map(x=>x.cl).join(',')+')');
  }
  const g=await piece('Griffe.conceptcad');
  const plus=g.some(x=>x.vote.length>x.ancien.length),inclus=g.every(x=>x.ancien.every(h=>x.vote.indexOf(h)>=0));
  A(plus&&inclus,'Griffe (deux corps) : tous les trous d’avant, plus les lamages du 2e corps ('+g.map(x=>x.ancien.length+'→'+x.vote.length).join(' ')+')');
  console.log(ko?'ÉCHEC : '+ko:'*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
