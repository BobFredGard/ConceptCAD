// FUITE DU NOYAU : les objets rendus par OCCT sont des COPIES à libérer une par une, et rien ne le fait
// à notre place. Retour utilisateur : RAM à 95 %, de plus en plus chargée à force de travailler sur un
// solide. Mesuré sur Cache Piles avant correction : 2 011 objets perdus par rejeu au repos et 18 600 par
// cote modifiée, dont des copies de formes qui gardent en vie géométrie et maillage des solides supprimés.
// Ici chaque objet du noyau est suivi de sa création à sa libération, sur une pièce réelle.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const vivants=new Map();let actif=false;
class Suivi{
  register(obj,info,jeton){
    if(!actif)return;
    const L=Error.stackTraceLimit;Error.stackTraceLimit=12;const st=new Error().stack;Error.stackTraceLimit=L;
    vivants.set(jeton,st);
  }
  unregister(jeton){vivants.delete(jeton);}
}
globalThis.FinalizationGroup=Suivi;globalThis.FinalizationRegistry=Suivi; // les deux noyaux
globalThis.__dirname=path.join(ROOT,'occt');
// La colle d'OCCT 8 n'inscrit que les poignées intelligentes : ici, tous les objets.
const colle=fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8').replace(/[\w$]+\.Eb&&([\w$]+)\.register\(/,'$1.register(');
vm.runInThisContext(colle,{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
const lireProjet=require('./lire-projet.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
// Ce que les caches gardent exprès (points de contrôle, outils) passe par occShapeCopy ; les poignées
// nées dans le noyau lui-même n'ont pas de ligne de l'application : le ramasse-miettes s'en charge.
const garde=st=>/occShapeCopy/.test(st)||!/ConceptCAD\.html/.test(st);
const lieux=()=>{const t={};for(const st of vivants.values()){if(garde(st))continue;
  const m=/at (?:new )?(\S*) ?\(?[^\n]*ConceptCAD\.html:(\d+)/.exec(st);const k=m?(m[1]||'?')+':'+m[2]:'?';t[k]=(t[k]||0)+1;}
  return Object.entries(t).sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x[1]+' × '+x[0]).join(', ');};
const oublis=()=>{let n=0;for(const st of vivants.values())if(!garde(st))n++;return n;};
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;',ctx);
  // Le mouchard doit voir un objet ordinaire : si la colle change, le test ne passe plus à vide.
  actif=true;const t=new real.gp_Pnt_1();const vu=vivants.size===1;t.delete();const libere=vivants.size===0;actif=false;
  console.log('=== Fuite du noyau (objets créés et jamais libérés) ===');
  // L'ancien noyau de secours ne distingue pas une copie d'un pointeur qu'il garde (h.get() d'une
  // triangulation) : le décompte y serait faux. Les suites tournent sur OCCT 8 (tests/moteur-defaut.cjs).
  if(!process.env.OCCT_DIR){console.log('  (ancien noyau : non applicable, lancer avec node tools/ci-moteur.cjs occt/v3 -- tests/test_fuite_noyau.cjs)');console.log('*** TOUT PASSE ***');process.exit(0);}
  A(vu&&libere,'le mouchard suit les objets du noyau ('+(vu?'création vue':'création INVISIBLE')+', '+(libere?'libération vue':'libération INVISIBLE')+')');
  sandbox.__json=lireProjet(path.join(ROOT,'Exemples','Cache Piles.conceptcad'));
  await vm.runInContext(String.raw`(async()=>{
    const raw=JSON.parse(__json);
    if(raw.doc)await bundleRestore(__json,{rebuild:false});else await deserialise(__json,{rebuild:false});
    markDirty();rebuild();markDirty();rebuild();
  })()`,ctx);
  const tours=async code=>{vivants.clear();actif=true;await vm.runInContext('(async()=>{'+code+'})()',ctx);actif=false;};
  await tours('for(let i=0;i<3;i++){markDirty();rebuild();}');
  const repos=oublis();
  A(repos<=3,'rejeu sans changement : '+repos+' objet(s) oublié(s) en 3 tours (2 011 par tour avant)'+(repos>3?' — '+lieux():''));
  await tours(`const f=doc.features.filter(f=>f.type==='extrude'&&+f.distance&&!f.repeatId)[0];const d=+f.distance;
    for(let i=1;i<=3;i++){f.distance=d+Math.sign(d)*0.01*i;markDirty();rebuild();}f.distance=d;`);
  const modif=oublis();
  A(modif<=9,'cote modifiée : '+modif+' objet(s) oublié(s) en 3 tours (18 600 par tour avant)'+(modif>9?' — '+lieux():''));
  // Le tas du noyau se stabilise : cache plein, plus de montée (128 → 221 Mo avant, en 60 modifications)
  await vm.runInContext(`(async()=>{const f=doc.features.filter(f=>f.type==='extrude'&&+f.distance&&!f.repeatId)[0];const d=+f.distance;
    for(let i=1;i<=8;i++){f.distance=d+Math.sign(d)*0.1*i;markDirty();rebuild();}f.distance=d;globalThis.__h0=occt.HEAP8.length;
    for(let i=1;i<=24;i++){f.distance=d+Math.sign(d)*0.2*i;markDirty();rebuild();}f.distance=d;globalThis.__h1=occt.HEAP8.length;})()`,ctx);
  const h0=vm.runInContext('__h0',ctx)/1048576,h1=vm.runInContext('__h1',ctx)/1048576;
  A(h1<=h0,'tas du noyau stable sur 24 modifications de plus : '+h0.toFixed(0)+' → '+h1.toFixed(0)+' Mo');
  console.log(ko?'ÉCHEC : '+ko:'*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
