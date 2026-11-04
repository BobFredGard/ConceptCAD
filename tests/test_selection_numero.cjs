// Le clic sur une face ou une arête affiche son vrai numéro et la fonction qui l'a créée, pas « Face 1 ».
// Lancé seul : node tools/ci-moteur.cjs occt/v3 -- tests/test_selection_numero.cjs
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs'),lire=require('./lire-projet.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  if(!real.NCollection_IndexedDataMap_TopoDS_Shape_NCollection_List_TopoDS_Shape_TopTools_ShapeMapHasher){console.log('=== Numéros : noyau sans carte indexée, sauté ===\n\n*** TOUT PASSE ***');return;}
  const {ctx,sandbox}=loadApp();
  Object.assign(sandbox,{__realOcct:real,__txt:lire(path.join(ROOT,'Exemples','Cache Piles.conceptcad'))});
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
  const R=String.raw`
    await bundleRestore(__txt,{name:'banc'});occt=__realOcct;occtReady=true;markDirty();rebuild();
    const bd=bodies.find(b=>b.kind==='body'&&b.shape);
    const o={corps:!!bd};if(!bd)return JSON.stringify(o);
    // faces : chaque groupe du maillage a son numéro, chacune son origine
    // (le bac à sable n'a pas de maillage : un groupe par face, comme celui de la vue)
    const groups=[];for(let k=0;;k++){const f=occFaceAt(bd.shape,k);if(!f)break;try{f.delete();}catch(e){}groups.push({f:k,start:k,count:1});}
    const mesh=bd.mesh&&bd.mesh.geometry?bd.mesh:(bd.mesh={geometry:{userData:{}}});
    mesh.geometry.userData=mesh.geometry.userData||{};mesh.geometry.userData.occGroups=groups;
    const nums=groups.map(g=>selFaceInfo(mesh,g.start));
    o.nFaces=groups.length;o.facesNum=new Set(nums.map(x=>x.n)).size;o.facesZero=nums.filter(x=>!x.n).length;
    o.facesOrigine=nums.filter(x=>x.origine).length;o.exFace=nums[0];
    // arêtes : une polyligne de la vue donne son numéro, le même numéro pour la même arête
    const segs=occListEdges(bd.shape).map(e=>e.pts);const A=segs.map(P=>selAreteInfo(P));
    o.nSegs=segs.length;o.aretesNum=new Set(A.map(x=>x.n)).size;o.aretesZero=A.filter(x=>!x.n).length;
    o.aretesOrigine=A.filter(x=>x.origine).length;o.exArete=A[0];
    o.stable=JSON.stringify(selAreteInfo(segs[0]))===JSON.stringify(A[0]);
    // origine lisible
    const f=doc.features[0];
    o.lisible=selOrigine(f.id+'/haut')===f.name&&selOrigine(f.id+'/haut|'+f.id+'/bas')===f.name;
    o.vide=selOrigine('')==='';
    return JSON.stringify(o);`;
  const o=JSON.parse(await vm.runInContext('(async()=>{'+R+'})()',ctx));
  let ko=0;const A=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m);if(!c)ko++;};
  console.log('=== Vrai numéro des faces et arêtes (noyau réel) ===');
  A(o.corps,'un corps exact');
  A(o.nFaces>1&&o.facesNum===o.nFaces&&!o.facesZero,'chaque face a son propre numéro ('+o.facesNum+'/'+o.nFaces+', ex. Face '+(o.exFace&&o.exFace.n)+' — '+(o.exFace&&o.exFace.origine)+')');
  A(o.facesOrigine===o.nFaces,'chaque face connaît la fonction qui l’a créée ('+o.facesOrigine+'/'+o.nFaces+')');
  A(o.nSegs>1&&!o.aretesZero,'chaque arête de la vue a un numéro (sans numéro : '+o.aretesZero+'/'+o.nSegs+')');
  A(o.aretesNum===o.nSegs,'les arêtes ont des numéros différents ('+o.aretesNum+' pour '+o.nSegs+', ex. Arête '+(o.exArete&&o.exArete.n)+' — '+(o.exArete&&o.exArete.origine)+')');
  A(o.aretesOrigine===o.nSegs,'chaque arête connaît ses fonctions ('+o.aretesOrigine+'/'+o.nSegs+')');
  A(o.stable,'recliquer la même arête redonne le même numéro');
  A(o.lisible&&o.vide,'le nom technique devient le nom de la fonction');
  console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
  process.exit(ko?1:0);
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
