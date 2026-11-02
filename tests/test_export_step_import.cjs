// Export STEP d'un STEP ouvert tel quel (retour utilisateur 2026-11-02) : un import SEUL
// dans son corps reste hors de la chaîne exacte (occReplayBody : importSeul) — clic droit
// → « Exporter ce corps en STEP » répondait « rien à exporter », et l'export global
// « Solide vide ». Contrôles (noyau réel, MERLIN-37-000.step) :
//   A. clic droit sur le corps → fichier écrit, autant de solides qu'à l'import ;
//   B. pièces masquées (👁 de l'arborescence) → absentes du fichier ;
//   C. export global → le STEP seul y est aussi.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  console.log('=== Export STEP d’un STEP seul dans son corps ===');
  const F=path.join(ROOT,'Exemples','MERLIN-37-000.step');
  const buf=fs.existsSync(F)?fs.readFileSync(F):null;
  if(!buf||buf.slice(0,40).toString().indexOf('git-lfs')>=0){console.log('  (MERLIN-37-000.step absent ou pointeur LFS : test sauté — `git lfs checkout`)');process.exit(0);}
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  // géométrie minimale (comme test_fao_brut_corps) : userData.impOcc doit survivre à l'import
  const T0=sandbox.THREE;
  class BG{constructor(){this.attributes={};this.userData={};this.index=null;}
    setAttribute(n,a){this.attributes[n]=a;return this;} getAttribute(n){return this.attributes[n];}
    setIndex(i){this.index=i;return this;} computeVertexNormals(){} computeBoundingBox(){} computeBoundingSphere(){} dispose(){}
    clone(){const g=new BG();g.attributes=this.attributes;return g;}}
  class F32{constructor(a,n){this.array=Float32Array.from(a);this.itemSize=n;this.count=this.array.length/n;}}
  sandbox.THREE=new Proxy({},{get(t,k){if(k==='BufferGeometry')return BG;if(k==='Float32BufferAttribute')return F32;
    if(k==='Mesh')return function(g,m){const o=new T0.Mesh();o.geometry=g;if(m)o.material=m;return o;};return T0[k];}});
  sandbox.__realOcct=real;sandbox.__buf=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
  const r=await vm.runInContext(`(async()=>{
    occt=__realOcct;occtReady=true;window.confirm=function(){return true;};showAll=function(){};
    const AL=[];window.alert=function(m){AL.push(String(m));};
    await importSTEP({name:'MERLIN-37-000.step',arrayBuffer:async()=>__buf});
    occt=__realOcct;occtReady=true;
    const f=doc.features.find(x=>x.type==='import');
    const O=f._mesh.geometry.userData.impOcc;
    const bid=(f.body&&doc.bodies.some(e=>e.id===f.body))?f.body:doc.bodies[0].id;
    stepAskSchema=async function(){return 'AP214';};
    occExportPreflight=async function(){return [true,'ok'];};
    let wrote=[];const _w=occWriteStep;
    occWriteStep=function(shapes,p,s){const b=_w(shapes,p,s);wrote.push(b);return b;};
    Blob=class{constructor(parts){this.parts=parts;}};
    URL={createObjectURL:function(){return 'blob:t';},revokeObjectURL:function(){}};
    const _ce=document.createElement.bind(document);
    document.createElement=function(t){const n=_ce(t);if(String(t).toLowerCase()==='a')n.click=function(){};return n;};
    const solids=b=>{occt.FS.writeFile('/rl.stp',b);const rd=new occt.STEPControl_Reader_1();rd.ReadFile('/rl.stp');rd.TransferRoots();
      const sh=rd.OneShape();const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_SOLID,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
      let n=0;while(ex.More()){n++;ex.Next();}try{ex.delete();rd.delete();sh.delete();}catch(e){}return n;};
    const nSol=solids(new Uint8Array(__buf));
    const out={nOcc:O.nOcc,nSol};
    await ctxExportStep(bid);
    out.al1=AL.slice();out.n1=wrote.length?solids(wrote[0]):-1;
    // B. trois pièces masquées : solides 0..2 (occurrences = solides dans MERLIN, sauf coques libres)
    AL.length=0;wrote=[];f.hidOcc=[0,1,2];
    await ctxExportStep(bid);
    out.al2=AL.slice();out.n2=wrote.length?solids(wrote[0]):-1;
    delete f.hidOcc;
    // C. export global
    AL.length=0;wrote=[];
    await $('btnExportStep').onclick();
    out.al3=AL.slice();out.n3=wrote.length?solids(wrote[0]):-1;
    return out;
  })()`,ctx);
  console.log('  import : '+r.nOcc+' occurrences, '+r.nSol+' solides dans le fichier source');
  A(!r.al1.length,'clic droit : aucune alerte ('+r.al1.join(' | ')+')');
  A(r.n1===r.nSol,'clic droit : '+r.n1+' solides réécrits (attendu '+r.nSol+')');
  A(!r.al2.length,'pièces masquées : aucune alerte ('+r.al2.join(' | ')+')');
  A(r.n2===r.nSol-3,'pièces masquées : '+r.n2+' solides (attendu '+(r.nSol-3)+')');
  A(!r.al3.length,'export global : aucune alerte ('+r.al3.join(' | ')+')');
  A(r.n3===r.nSol,'export global : '+r.n3+' solides (attendu '+r.nSol+')');
  console.log(ko?'ECHECS : '+ko:'TOUT EST CONFORME');
  process.exit(ko?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
