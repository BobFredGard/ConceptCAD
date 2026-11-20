// V0.99.53 — Points de contrôle pour deux versions de la timeline (demande « maximiser les CPU », piste 2).
// À 3 × la timeline plafonné à 120, la plaque SIRAP-14-003 (109 fonctions) ne gardait qu'une version :
// revenir à la valeur précédente d'une fonction du début recalculait tout (6,2 s). Désormais 3 × la timeline
// jusqu'à occCkPiece (360), retour à 120 si le tas du noyau dépasse OCC_CK_HEAP. Sur Cavité Usinage :
//   1. la borne suit la règle ;
//   2. modifier une fonction du début puis revenir : aucun point de contrôle nouveau, aucun calcul de
//      fonction au retour, et la pièce est celle d'un calcul sans points de contrôle.
//   --chemin D:/x.conceptcad : une autre pièce.
'use strict';
const path=require('path'),vm=require('vm');
const {loadApp}=require('./appvm.cjs');
const lireProjet=require('./lire-projet.cjs');
const arg=process.argv.indexOf('--chemin');
const FICHIER=arg>0?process.argv[arg+1]:path.join(__dirname,'..','Exemples','Cavité Usinage.conceptcad');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  const R=s=>vm.runInContext(s,ctx);
  console.log('=== Points de contrôle : deux versions de la timeline ('+path.basename(FICHIER)+') ===');
  sandbox.__json=lireProjet(FICHIER);
  await R(String.raw`(async()=>{const raw=JSON.parse(__json);if(raw.doc)await bundleRestore(__json,{rebuild:false});else await deserialise(__json,{rebuild:false});markDirty();rebuild();})()`);
  const r=R(String.raw`(()=>{
    const o={};
    const n=doc.features.length+2;
    o.max=occCkMax();o.attendu=Math.max(8,Math.min(3*n,occCkPiece));o.piece=occCkPiece;
    const emp=()=>{const sh=occLive&&occLive.shape;if(!sh)return null;const a=occSubShapes(sh,'TopAbs_FACE'),b=occSubShapes(sh,'TopAbs_EDGE');
      const e={faces:a.length,aretes:b.length};occDispose(a);occDispose(b);try{e.vol=+occShapeVolume(sh).toFixed(4);}catch(x){}return e;};
    // fonction du début qui porte une valeur
    const KEYS=['depth','distance','angle','radius','thick'];
    const i=doc.features.findIndex((f,j)=>j>0&&f.visible!==false&&KEYS.some(k=>typeof f[k]==='number'&&f[k]>0.5));
    const f=doc.features[i],k=KEYS.find(k=>typeof f[k]==='number'&&f[k]>0.5),v0=f[k];
    o.fonction=f.type+' n°'+(i+1)+' ('+k+')';
    // calcul des fonctions : chaque point de contrôle neuf en est un
    let neufs=0;const put0=occCkPut;
    occCkPut=function(key,mk){if(!occCk.some(c=>c.key===key))neufs++;return put0.apply(this,arguments);};
    try{
      builtVersion=-1;rebuild();
      const avant=new Set(occCk.map(c=>c.key));o.avant=emp();
      f[k]=v0*1.02;markDirty();neufs=0;rebuild();o.neufsModif=neufs;
      o.versionA=[...avant].filter(x=>!occCk.some(c=>c.key===x)).length; // clés de la 1re version perdues
      f[k]=v0;markDirty();neufs=0;rebuild();o.neufsRetour=neufs;o.retour=emp();
      // référence : sans points de contrôle
      occCkClear();builtVersion=-1;rebuild();o.ref=emp();
      // borne d'avant : la 1re version est évincée si la timeline dépasse 40 fonctions
      occCkPiece=120;o.max120=occCkMax();
    }finally{occCkPut=put0;occCkPiece=360;}
    o.n=doc.features.length;
    return o;
  })()`);
  console.log('  '+r.fonction+' ; '+r.n+' fonctions ; borne '+r.max+' ; modification : '+r.neufsModif+' points neufs ; retour : '+r.neufsRetour);
  A(r.piece===360,'occCkPiece vaut 360');
  A(r.max===r.attendu,'occCkMax = 3 × la timeline, plafonné à occCkPiece ('+r.max+')');
  A(r.max120===Math.max(8,Math.min(3*(r.n+2),120)),'occCkPiece = 120 : borne d’avant ('+r.max120+')');
  A(r.neufsModif>0,'la modification calcule les fonctions qui suivent');
  A(r.versionA===0,'la version d’avant la modification reste entière');
  A(r.neufsRetour===0,'revenir à la valeur précédente ne calcule rien');
  A(JSON.stringify(r.retour)===JSON.stringify(r.avant)&&JSON.stringify(r.retour)===JSON.stringify(r.ref),'pièce identique à un calcul sans points de contrôle ('+JSON.stringify(r.retour)+')');
  console.log(ko?'ÉCHEC : '+ko+' point(s)':'OK');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
