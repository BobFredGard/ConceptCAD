// PROTOTYPE (hors suites) — déplacement de face par le noyau : BRepOffset_MakeOffset avec un
// décalage nul partout sauf sur la face poussée (SetOffsetOnFace), via la liaison maison
// CCFaceOffset (occt-build/extras/conceptcad_extras.cpp). Cas Barquette : dessus d'un corps à
// dépouille 15° aux coins arrondis tangents (tests/fixtures/barquette_face_depouille.json),
// à comparer à la correction JavaScript occMoveFaceRuledTool (V0.39.1, autre branche) :
// dessus +5 mm, parois prolongées dans leur pente (+5·tan15° ≈ 1,34 mm par côté), solide valide.
// Ne tourne qu'avec un moteur recompilé :
//   node tools/ci-moteur.cjs occt-build/out/v2 -- tests/proto_face_offset_barquette.cjs
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  if(!real.CCFaceOffset){console.log('moteur sans CCFaceOffset (noyau d’origine ?) — prototype sauté');process.exit(2);}
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  sandbox.__doc=fs.readFileSync(path.join(ROOT,'tests','fixtures','barquette_face_depouille.json'),'utf8');
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};showAll=function(){};applyView=function(){};',ctx);
  const R=[
    'const out={fails:[],log:[]};',
    'const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};',
    'await deserialise(__doc);occt=__realOcct;occtReady=true;',
    // corps b4 AVANT la Face : on masque la Face (et la soustraction finale)
    'doc.features.find(f=>f.type==="combine").visible=false;',
    'doc.features.find(f=>f.type==="xmove").visible=false;markDirty();rebuild();',
    'A(builtEngine==="exact","rejeu exact ("+builtEngine+")");',
    'const b4=(occFinalShape(null).perBody||[]).find(p=>p.bodyId==="b4");',
    'A(!!(b4&&b4.shape),"corps de départ reconstruit");',
    'const sh=b4.shape,b0=occBoxMinMax(sh),faces=occSubShapes(sh,"TopAbs_FACE");',
    'out.log.push("départ : "+faces.length+" faces, dessus z "+b0.hi[2].toFixed(3)+", "+b0.hi[0].toFixed(2)+" × "+b0.hi[1].toFixed(2));',
    // le dessus : face plane à z = hi, la plus étendue
    'let top=null,best=-1;faces.forEach(f=>{const b=occBoxMinMax(f);if(Math.abs(b.lo[2]-b0.hi[2])<1e-4&&Math.abs(b.hi[2]-b0.hi[2])<1e-4){const s=(b.hi[0]-b.lo[0])*(b.hi[1]-b.lo[1]);if(s>best){best=s;top=f;}}});',
    'A(!!top,"dessus trouvé");',
    'const t=5*Math.tan(15*Math.PI/180);',
    'for(const [nom,join,inter] of [["arc",0,false],["intersection",2,true],["intersection sans Inter3d",2,false]]){',
    '  const o=new occt.CCFaceOffset();const t0=Date.now();',
    '  o.Init(sh,0,1e-6,inter,false,join,false);o.SetFace(top,5);',
    '  const ok=o.MakeOffset(),ms=Date.now()-t0;',
    '  if(!ok){out.log.push(nom+" : ÉCHEC (erreur "+o.Error()+(o.Message()?", "+o.Message():"")+", "+ms+" ms)");out["r_"+nom]={ok:false,err:o.Error(),msg:o.Message(),ms};o.delete();continue;}',
    '  const r=o.Shape(),b=occBoxMinMax(r),nf=occSubShapes(r,"TopAbs_FACE").length,val=occCoqueValide(r);',
    '  const z=Math.abs(b.hi[2]-(b0.hi[2]+5))<0.01,xy=Math.abs(b.hi[0]-(b0.hi[0]+t))<0.02&&Math.abs(b.hi[1]-(b0.hi[1]+t))<0.02;',
    '  out["r_"+nom]={ok:true,ms,nf,val,z:+b.hi[2].toFixed(3),x:+b.hi[0].toFixed(3),y:+b.hi[1].toFixed(3)};',
    '  A(z&&xy&&val,nom+" : dessus z "+b.hi[2].toFixed(3)+" (attendu "+(b0.hi[2]+5).toFixed(3)+"), "+b.hi[0].toFixed(2)+" × "+b.hi[1].toFixed(2)+" (attendu "+(b0.hi[0]+t).toFixed(2)+" × "+(b0.hi[1]+t).toFixed(2)+"), "+nf+" faces, "+(val?"valide":"INVALIDE")+", "+ms+" ms");',
    '  o.delete();',
    '}',
    'return out;'
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Prototype : Face +5 mm par BRepOffset_MakeOffset (Barquette) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  (o.fails||[]).forEach(m=>console.log('  ✗ '+m));
  const res={};Object.keys(o).filter(k=>k.startsWith('r_')).forEach(k=>res[k.slice(2)]=o[k]);
  console.log(JSON.stringify(res));
  // Réussi si AU MOINS un réglage donne le bon solide.
  const bon=(o.log||[]).some(m=>/ : dessus z /.test(m));
  process.exit(o.fails.filter(m=>!/ : /.test(m)).length||!bon?1:0);
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
