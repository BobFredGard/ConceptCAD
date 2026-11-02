// Échelle / homothétie d'un corps (fonction 'bscale', src/85-echelle-corps) : uniforme autour
// de l'origine ou d'un point, non uniforme X/Y/Z, « Nouveau corps » (copie, source intact),
// géométrie exacte conservée en uniforme, enregistrement, cache. Noyau OCCT réel.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);",
    "occt=__realOcct;occtReady=true;",
    "const bbox=sh=>{const E=occListEdges(sh);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;E.forEach(e=>e.pts.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);z0=Math.min(z0,p[2]);z1=Math.max(z1,p[2]);}));return{x0,x1,y0,y1,z0,z1,n:E.length};};",
    // bloc 40 × 20 × 10, coin à l'origine, percé d'un trou Ø10 traversant en (20 ; 10)
    "const box={id:'skA',name:'Bloc',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:0,y:0},b:{x:40,y:0},c:{x:40,y:20},d:{x:0,y:20},k:{x:20,y:10}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'},{id:'cc',t:'circle',pc:'k',r:5}],constraints:[],dims:[],seq:20,visible:false};",
    "doc.sketches=[box];doc.features=[];doc.bodies=[];delete doc.activeBody;ensureBodies();",
    "doc.features.push({id:'F1',type:'extrude',name:'Bloc',sketchId:'skA',distance:10,op:'add',visible:true,body:doc.bodies[0].id});",
    "markDirty();rebuild();",
    "const B1=doc.bodies[0].id;",
    "const vol0=(()=>{const R=occFinalShape(null);const v=asmVolCom(R.shape).v;occCleanup(R,null);return v;})();",
    "A(near(vol0,8000-Math.PI*25*10,0.5),'0 : bloc percé de référence ('+vol0.toFixed(1)+' mm³)');",
    "const f=openBodyScale(B1);",
    "A(f&&f.type==='bscale'&&f.body===B1&&doc.features[doc.features.length-1]===f&&/Échelle 2 « /.test(f.name),'1 : la commande crée « '+(f&&f.name)+' » (×2, centre origine) en fin de timeline');",
    "const shot=()=>{markDirty();rebuild();const R=occFinalShape(null);const b=bbox(R.shape);b.v=asmVolCom(R.shape).v;b.nb=(R.perBody||[]).filter(x=>x.shape).length;b.per=(R.perBody||[]).map(x=>({id:x.bodyId,b:x.shape?bbox(x.shape):null}));occCleanup(R,null);return b;};",
    "let b=shot();A(near(b.x0,0)&&near(b.x1,80)&&near(b.y1,40)&&near(b.z1,20)&&near(b.v,8*vol0,1)&&!f._err,'2 : ×2 autour de l’origine → 80 × 40 × 20, volume × 8');",
    "f.o=[20,10,5];f.oname='Centre';b=shot();A(near(b.x0,-20)&&near(b.x1,60)&&near(b.y0,-10)&&near(b.z0,-5)&&near(b.z1,15),'3 : ×2 autour du centre (20 ; 10 ; 5) → X −20 → 60, Z −5 → 15');",
    "f.s=0.5;b=shot();A(near(b.x0,10)&&near(b.x1,30)&&near(b.z0,2.5)&&near(b.z1,7.5)&&near(b.v,vol0/8,0.1),'4 : ×½ autour du centre — et le cache suit le facteur');",
    "f.s=25.4;f.o=[0,0,0];b=shot();A(near(b.x1,1016,1e-2)&&near(b.z1,254,1e-2),'5 : pouce → mm (× 25,4) : 40 → 1016');",
    // non uniforme
    "f.uni=false;f.sx=2;f.sy=1;f.sz=3;f.o=[0,0,0];b=shot();A(near(b.x1,80)&&near(b.y1,20)&&near(b.z1,30)&&near(b.v,6*vol0,6*vol0*2e-3),'6 : non uniforme X×2 Y×1 Z×3 → 80 × 20 × 30, volume × 6 ('+[b.x1,b.y1,b.z1,(b.v/vol0).toFixed(4)].join(' ')+')');",
    "f.o=[40,20,10];b=shot();A(near(b.x0,-40)&&near(b.x1,40)&&near(b.z0,-20)&&near(b.z1,10),'7 : non uniforme autour d’un coin (40 ; 20 ; 10)');",
    // uniforme : le trou reste un vrai cylindre
    "f.uni=true;f.s=2;f.o=[0,0,0];markDirty();rebuild();",
    "{const R=occFinalShape(null);let cyl=0,rr=0;const ex=new occt.TopExp_Explorer_2(R.shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);for(;ex.More();ex.Next()){const fc=occt.TopoDS.Face_1(ex.Current());const s=new occt.BRepAdaptor_Surface_2(fc,true);if(s.GetType()===occt.GeomAbs_SurfaceType.GeomAbs_Cylinder){cyl++;rr=s.Cylinder().Radius();}s.delete();}ex.delete();occCleanup(R,null);",
    " A(cyl>=1&&near(rr,10),'8 : en uniforme le trou reste un cylindre exact (R '+rr+' = 2 × 5)');}",
    // nouveau corps
    "bsSetCopy(f,true);const NB=f.newBody;A(NB&&NB!==B1&&doc.bodies.some(x=>x.id===NB)&&/\(copie\)/.test(f.name),'9 : « Nouveau corps » crée le corps « '+bmBodyName(NB)+' »');",
    "b=shot();{const s=b.per.find(x=>x.id===B1),c=b.per.find(x=>x.id===NB);A(b.nb===2&&s&&s.b&&near(s.b.x1,40)&&near(s.b.z1,10)&&c&&c.b&&near(c.b.x1,80)&&near(c.b.z1,20),'10 : source intact (40 × 20 × 10) + copie ×2 dans le corps neuf');}",
    // une fonction ajoutée au corps source APRÈS l'échelle ne touche pas la copie
    "const pas={id:'skB',name:'Pastille',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{q:{x:5,y:5}},entities:[{id:'c2',t:'circle',pc:'q',r:2}],constraints:[],dims:[],seq:20,visible:false};",
    "doc.sketches.push(pas);doc.features.push({id:'F2',type:'extrude',name:'Pastille',sketchId:'skB',distance:30,op:'add',visible:true,body:B1});",
    "b=shot();{const s=b.per.find(x=>x.id===B1),c=b.per.find(x=>x.id===NB);A(s&&near(s.b.z1,30)&&c&&near(c.b.z1,20),'11 : la pastille ajoutée ensuite au source n’entre pas dans la copie');}",
    "doc.features=doc.features.filter(x=>x.id!=='F2');",
    "const js=JSON.parse(serialise(false));const g=js.features.find(x=>x.id===f.id);A(g&&g.type==='bscale'&&g.s===2&&g.copy===true&&g.newBody===NB,'12 : fonction enregistrée dans le fichier');",
    "bsSetCopy(f,false);A(!f.newBody&&!doc.bodies.some(x=>x.id===NB),'13 : revenir à « Modifier le corps » retire le corps neuf vide');",
    "b=shot();A(b.nb===1&&near(b.x1,80),'14 : de nouveau un seul corps, mis à l’échelle');",
    "const s1=featSig(f);f.o=[1,0,0];A(featSig(f)!==s1,'15 : la signature (cache) dépend du centre');",
    "A(featIconOf(f)==='⤡'&&typeof occApplyBodyScale==='function','16 : icône de l’arbre');",
    "f.s=0;f.o=[0,0,0];b=shot();{markDirty();rebuild();const R=occFinalShape(null);const w=(R.msgs||[]).some(m=>/facteur nul/.test(m));occCleanup(R,null);A(near(b.x1,40)&&w,'17 : facteur nul refusé (avertissement) — le corps reste tel quel');}",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Échelle d’un corps (bscale) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
