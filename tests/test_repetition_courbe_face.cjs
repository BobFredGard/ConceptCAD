// « Test Répétition Courbe » (Exemples, retour utilisateur V0.30.2) : plaque 208 × 112, rainure
// de 4 mm découpée à −5 mm, perçage Ø2 posé AU FOND de la rainure, répété suivant un profil.
// L'esquisse du perçage avait perdu sa face (origine au centre, sur l'îlot plus haut que le fond
// → aucun hôte) et l'épaisseur de la pièce changée (20 → 10 → 39) a semé la pagaille : esquisse
// restée à z = 15, arêtes projetées sautées sur le contour extérieur de la pièce (V0.30.3).
//   1. l'esquisse retrouve le fond de la rainure (découpe, côté BAS) par ses propres points ;
//   2. elle suit l'épaisseur : z = épaisseur − 5 ;
//   3. ses arêtes projetées restent sur la rainure quand la pièce s'épaissit beaucoup ;
//   4. les esquisses copiées par la répétition gardent la même face.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};confirm=function(){return true;};var __F='+JSON.stringify(require('./lire-projet.cjs')(path.join(__dirname,'fixtures','repetition-courbe-sans-face.json'))),ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);
    doc=docFromSerial(JSON.parse(__F).doc);ensureBodies();
    const S3=()=>doc.sketches.find(s=>s.id==='sk_7_mvxtupzs'),EX=()=>doc.features.find(f=>f.id==='ex_2_mvxtpp5d');
    A(!S3().host,'fichier : l’esquisse du perçage n’a plus de face (état livré par l’utilisateur)');
    markDirty();rebuild();
    const h=S3().host;
    A(h&&h.feat==='ex_6_mvxtug4z'&&h.tag==='BOTTOM'&&near(S3().origin[2],15),'1 : face retrouvée = fond de la rainure (découpe, côté bas), z = 15 — '+JSON.stringify(h)+' o='+JSON.stringify(S3().origin));
    const pt=id=>{const q=S3().points[id];return [+q.x.toFixed(2),+q.y.toFixed(2)].join(';');};
    for(const e of [10,39,20]){
      EX().distance=e;markDirty();rebuild();
      A(near(S3().origin[2],e-5),'2 : épaisseur '+e+' → esquisse du perçage à z = '+(e-5)+' — '+S3().origin[2]);
      A(pt('p1')==='-71;44'&&pt('p81')==='-88;0','3 : épaisseur '+e+' : projetées sur la rainure, perçage en place — p1 '+pt('p1')+' · p81 '+pt('p81'));
    }
    const K=doc.features.filter(f=>f.repeatId).map(k=>doc.sketches.find(s=>s.id===k.sketchId));
    A(K.length===29&&K.every(s=>s.host&&s.host.feat==='ex_6_mvxtug4z'&&s.host.tag==='BOTTOM'&&near(s.origin[2],15)),'4 : 29 esquisses copiées sur le fond de la rainure — '+K.filter(s=>!(s.host&&s.host.feat==='ex_6_mvxtug4z')).length+' ailleurs');
    return out;
  `;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Répétition courbe : face de l’esquisse du perçage ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1500));process.exit(1);});
