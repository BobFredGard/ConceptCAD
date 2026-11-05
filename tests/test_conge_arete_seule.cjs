// 2026-10-16-015 : congé / chanfrein sur UNE arête, case « tangentes » décochée — le noyau OCCT
// suit toujours la chaîne tangente ; ici l'arête seule est arrondie (outil extrudé qui déborde
// devant et derrière). Noyau réel. Pièce : plaque dont un coin est un arc tangent.
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
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};",
    "occt=__realOcct;occtReady=true;",
    "const sk={id:'s',name:'s',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:0,y:0},b:{x:40,y:0},c:{x:40,y:20},cc:{x:30,y:20},d:{x:30,y:30},e:{x:0,y:30}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'ar',t:'arc',pc:'cc',pa:'c',pb:'d',r:10},{id:'l3',t:'line',p1:'d',p2:'e'},{id:'l4',t:'line',p1:'e',p2:'a'}],constraints:[],dims:[],seq:9,visible:false};",
    "doc.sketches=[sk];doc.features=[{id:'F',type:'extrude',name:'P',sketchId:'s',distance:10,op:'add',visible:true}];doc.bodies=[];markDirty();rebuild();",
    "const NF=sh=>{let k=0;const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);while(ex.More()){k++;ex.Next();}return k;};",
    "const ok=sh=>{try{const c=new occt.BRepCheck_Analyzer(sh,true,false);return c.IsValid();}catch(e){return null;}};",
    "const base=occLive.shape,E=occListEdges(base),f0=NF(base);",
    "const e2=E.find(e=>Math.abs(e.mid[2]-10)<1e-6&&Math.abs(e.mid[0]-40)<1e-6);", // arête du haut x=40, tangente à l'arc
    "const keys=sh=>occFaceKeys(sh);",
    "let w=[];const tan=occFilletRun(base,[{src:e2.src,r:2,mid:e2.mid}],w,false);",
    "w=[];const one=occFilletRun(base,[{src:e2.src,r:2,mid:e2.mid}],w,false,{single:true});",
    "out.log.push('faces : base '+f0+' · tangentes suivies '+(tan?NF(tan):'?')+' · arête seule '+(one?NF(one):'?'));",
    "const torus=sh=>keys(sh).filter(k=>/^S/.test(k)).length;", // surfaces non plan/cylindre (tore du coin)
    "A(tan&&NF(tan)-f0===3,'1 : OCCT (case cochée) : le congé suit la chaîne tangente (arête + arc + arête = 3 faces)');",
    "A(one&&ok(one)!==false,'2 : arête seule : solide valide');",
    "const vive=sh=>occListEdges(sh).some(e=>Math.abs(e.mid[2]-10)<1e-6&&Math.abs(e.mid[1]-30)<1e-6&&Math.abs(e.mid[0]-15)<1e-3);", // arête du haut y=30 (après l'arc)
    "A(!vive(tan)&&vive(one),'3 : arête seule : l\\u2019arête après l\\u2019arc reste VIVE (case cochée : elle est arrondie)');",
    "const cylR2=keys(one).filter(k=>/^C/.test(k)&&/\\|2$/.test(k)).length;",
    "A(cylR2>=1,'4 : face de congé cylindrique R2 présente, le congé déborde dans l\\u2019arc ('+cylR2+' morceau(x))');",
    "w=[];const ch=occFilletRun(base,[{src:e2.src,r:1,mid:e2.mid}],w,true,{single:true});",
    "A(ch&&ok(ch)!==false&&xNewFaces(base,ch).filter(Boolean).length>=1,'5 : chanfrein sur l\\u2019arête seule : solide valide, face de chanfrein créée');",
    "const ex1=E.find(e=>Math.abs(e.mid[2]-10)<1e-6&&Math.abs(e.mid[1])<1e-6);", // arête du haut y=0 (sans tangence)
    "w=[];const a1=occFilletRun(base,[{src:ex1.src,r:2,mid:ex1.mid}],w,false,{single:true});w=[];const b1=occFilletRun(base,[{src:ex1.src,r:2,mid:ex1.mid}],w,false);",
    "A(a1&&b1&&NF(b1)===f0+1&&ok(a1)!==false,'6 : arête sans tangence : arrondie seule dans les 2 modes');",
    // Arête bornée par des murs (rainure traversant un flanc) : l'outil ne doit pas entailler les murs.
    // Bloc x −3..6, y ±2,5, z 0..4,5 ; rainure y ±0,6 jusqu'à z=2 ; arête du fond sur le flanc x=6.
    "const vol=sh=>{const G=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(sh,G,false,false,false);const v=G.Mass();G.delete();return v;};",
    "const rect=(id,o,x0,x1,y0,y1)=>({id,name:id,plane:'XY',origin:[0,0,o],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:x0,y:y0},b:{x:x1,y:y0},c:{x:x1,y:y1},d:{x:x0,y:y1}},entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:9,visible:false});",
    "const rainure=(ymax)=>{doc.sketches=[rect('s1',0,-3,6,-2.5,2.5),rect('s2',4.5,-1,7,-0.6,ymax)];doc.bodies=[];doc.features=[{id:'F1',type:'extrude',name:'bloc',sketchId:'s1',distance:4.5,op:'add',visible:true},{id:'F2',type:'extrude',name:'rainure',sketchId:'s2',distance:-2.5,op:'cut',visible:true}];freshHard=true;occCkClear();markDirty();rebuild();return occLive.shape;};",
    "const bR=rainure(0.6),eR=occListEdges(bR).find(e=>Math.hypot(e.mid[0]-6,e.mid[1],e.mid[2]-2)<1e-6);",
    "A(!!eR,'7 : arête du fond de rainure trouvée');",
    "const vR=vol(bR);",
    "w=[];const cR=occFilletRun(bR,[{src:eR.src,r:1,mid:eR.mid}],w,true,{single:true});",
    "A(cR&&ok(cR)!==false&&Math.abs(vR-vol(cR)-0.6)<1e-3,'7 : chanfrein D1, arête seule entre deux murs : 0,6 mm³ enlevés, pas plus ('+(cR?(vR-vol(cR)).toFixed(4):'échec')+')');",
    "w=[];const kR=occFilletRun(bR,[{src:eR.src,r:1,mid:eR.mid}],w,true);",
    "A(kR&&Math.abs(vol(kR)-vol(cR))<1e-3,'7 : même matière enlevée que le noyau (case cochée)');",
    "w=[];const fR=occFilletRun(bR,[{src:eR.src,r:0.5,mid:eR.mid}],w,false,{single:true});",
    "const attendu=(0.25-Math.PI*0.25/4)*1.2;",
    "A(fR&&ok(fR)!==false&&Math.abs(vR-vol(fR)-attendu)<1e-3,'7 : congé R0,5 entre deux murs : matière du coin seulement ('+(fR?(vR-vol(fR)).toFixed(4):'échec')+' / '+attendu.toFixed(4)+')');",
    // Mur à un seul bout : arête d'un flanc libre d'un côté, murée de l'autre.
    "const b1m=rainure(2.5),e1m=occListEdges(b1m).find(e=>Math.abs(e.mid[0]-6)<1e-6&&Math.abs(e.mid[2]-2)<1e-6&&Math.abs(e.mid[1]-0.95)<1e-6);",
    "const v1m=vol(b1m);",
    "w=[];const c1m=e1m?occFilletRun(b1m,[{src:e1m.src,r:1,mid:e1m.mid}],w,true,{single:true}):null;",
    "A(c1m&&ok(c1m)!==false&&Math.abs(v1m-vol(c1m)-1.55)<1e-3,'8 : mur d\\u2019un seul côté, l\\u2019autre bout débouche : 0,5 × 3,1 = 1,55 mm³ ('+(c1m?(v1m-vol(c1m)).toFixed(4):'échec')+')');",
    // Murs penchés de 20° : le chanfrein suit les murs, ni entaille ni reste.
    "const k20=Math.tan(20*Math.PI/180),pl=rect('s2',4.5,0,1,0,1);pl.points={a:{x:-1,y:-0.6-7*k20},b:{x:7,y:-0.6+k20},c:{x:7,y:0.6+k20},d:{x:-1,y:0.6-7*k20}};",
    "doc.sketches=[rect('s1',0,-3,6,-2.5,2.5),pl];freshHard=true;occCkClear();markDirty();rebuild();",
    "const bB=occLive.shape,eB=occListEdges(bB).find(e=>Math.abs(e.mid[0]-6)<1e-6&&Math.abs(e.mid[2]-2)<1e-6),vB=vol(bB);",
    "w=[];const cB=occFilletRun(bB,[{src:eB.src,r:1,mid:eB.mid}],w,true,{single:true});",
    "A(cB&&ok(cB)!==false&&Math.abs(vB-vol(cB)-0.6)<1e-3,'9 : murs penchés de 20° : le chanfrein les suit, 0,6 mm³ ('+(cB?(vB-vol(cB)).toFixed(4):'échec')+')');",
    // Mur d'un côté, chaîne tangente de l'autre : le noyau suivrait l'arc ; la case décochée garde l'arête seule.
    "const skT={id:'s1',name:'s1',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:0,y:0},b:{x:40,y:0},c:{x:40,y:20},cc:{x:30,y:20},d:{x:30,y:30},e:{x:0,y:30}},entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'ar',t:'arc',pc:'cc',pa:'c',pb:'d',r:10},{id:'l3',t:'line',p1:'d',p2:'e'},{id:'l4',t:'line',p1:'e',p2:'a'}],constraints:[],dims:[],seq:9,visible:false};",
    "doc.sketches=[skT,rect('s2',10,35,45,-1,5)];doc.features=[{id:'F1',type:'extrude',name:'p',sketchId:'s1',distance:10,op:'add',visible:true},{id:'F2',type:'extrude',name:'r',sketchId:'s2',distance:-4,op:'cut',visible:true}];freshHard=true;occCkClear();markDirty();rebuild();",
    "const bT=occLive.shape,eT=occListEdges(bT).find(e=>Math.abs(e.mid[0]-40)<1e-6&&Math.abs(e.mid[2]-10)<1e-6),vT=vol(bT);",
    "w=[];const cT=occFilletRun(bT,[{src:eT.src,r:1,mid:eT.mid}],w,true,{single:true});",
    "const ar=sh=>occListEdges(sh).filter(e=>Math.abs(e.mid[2]-10)<1e-6&&Math.abs(e.mid[1]-30)<1e-6).length;",
    "A(cT&&ok(cT)!==false&&ar(cT)>=1,'10 : mur d\\u2019un côté, arc tangent de l\\u2019autre : l\\u2019arête après l\\u2019arc reste vive ('+(cT?(vT-vol(cT)).toFixed(3):'échec')+' mm³)');",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== 2026-10-16-015 : congé / chanfrein sur une arête seule ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
