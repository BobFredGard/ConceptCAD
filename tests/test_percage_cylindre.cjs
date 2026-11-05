// Perçage sur un cylindre : direction, cote depuis une face / une arête / un sommet, suivi de la pièce,
// reconnaissance FAO, une seule étape d'annulation, sauvegarde. Noyau OCCT réel.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(m){window.__al=m;};',ctx);
  const R=`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    const near=(a,b,t)=>a&&a.every((x,i)=>Math.abs(x-b[i])<(t||1e-3));
    const txt=a=>'['+(a||[]).map(x=>+(+x).toFixed(3)).join(', ')+']';
    // Cylindre Ø20 d'axe X, de X=0 à X=60
    const skC={id:'skC',name:'Rond',plane:'YZ',origin:[0,0,0],axU:[0,1,0],axV:[0,0,1],axN:[1,0,0],points:{c:{x:0,y:0}},
      entities:[{id:'e1',t:'circle',pc:'c',r:10}],constraints:[],dims:[],seq:10,visible:false};
    doc.sketches=[skC];
    doc.features=[{id:'F1',type:'extrude',name:'Rond',sketchId:'skC',distance:60,op:'add',visible:true}];
    doc.bodies=[];doc.cgeo=[];delete doc.activeBody;markDirty();rebuild();
    const shape=()=>occLive.shape;
    const faceOf=kind=>{const L=occSubShapes(shape(),'TopAbs_FACE');const f=L.find(x=>occSurfKind(x)===kind);return f;};
    const planeFaceAt=x=>{const L=occSubShapes(shape(),'TopAbs_FACE');return L.find(f=>{if(occSurfKind(f)!=='Plane')return false;const b=occFaceBox(f);return Math.abs(b.pos[0]-x)<1e-3;});};
    const faceRef=f=>({k:'face',ref:occFaceRefAny(f),name:'face'});
    const inside=(x,y,z)=>{const cl=occClassifier(shape());const p=new occt.gp_Pnt_3(x,y,z);cl.Perform(p,1e-6);const r=cl.State()===occt.TopAbs_State.TopAbs_IN;p.delete();cl.delete();return r;};
    const Cinfo=(pt)=>{const ref=occFaceRefAny(faceOf('Cylinder')),g=cgEvalRef({k:'face',ref},null),a=g.axis,d=cgCylDir(a.d),w=cgSub(pt,a.o),t=cgDot(w,d);
      return {ref,A:{o:a.o,d,r:a.r},rad:cgUnit(cgSub(w,cgMul(d,t))),t,body:null};};

    // ── 1. Clic au-dessus du cylindre, près du milieu : direction +Z « attrapée », au milieu ──
    const undo0=docUndoStack.length;
    const el=holeOnCylinder(Cinfo([30.4,1,9.95]));
    const hf=doc.features.find(f=>f.type==='hole');
    A(el&&el.how==='tangent'&&el.visible===false,'1a : plan tangent créé, masqué');
    A(near(el.fr.o,[30,0,10])&&near(el.fr.z,[0,0,1]),'1b : point de tangence au milieu, normale +Z (vu '+txt(el.fr.o)+' / '+txt(el.fr.z)+')');
    A(el.refs[1]&&el.refs[1].id==='Z'&&el.p.a===0,'1c : direction accrochée à +Z à moins de 10°');
    A(hf&&!hf.flip&&hf.d===6.6&&hf.depth===10,'1d : perçage vers la matière, Ø6,6 jusqu’à l’axe');
    A(docUndoStack.length===undo0+1,'1e : une seule étape d’annulation ('+(docUndoStack.length-undo0)+')');
    A(near(holeAxis(hf,doc.sketches.find(s=>s.id===hf.sketchId)).pts.map(p=>[p.x,p.y,p.z])[0],[30,0,10]),'1f : le centre du trou est sur le plan tangent');
    markDirty();rebuild();
    A(builtEngine==='exact'&&!hf._err,'1g : rejeu exact sans erreur '+(hf._err||''));
    A(!inside(30,0,5)&&inside(30,0,-5)&&inside(30,5,5),'1h : trou borgne dans la matière, du dessus vers l’axe');

    // ── 2. Débouchant : la FAO le reconnaît, vertical ──
    hf.end='through';hf.name=holeName(hf);markDirty();rebuild();faoHoleCache={shape:null,list:null};
    const H=faoHolesDetect();
    out.log.push('FAO : '+H.map(h=>'Ø'+h.d+'@('+h.x+','+h.y+') Z'+h.ztop+'→'+h.zbot+(h.through?' déb':'')).join(' | '));
    const hh=H.find(h=>Math.abs(h.d-6.6)<0.01);
    A(hh&&Math.abs(hh.x-30)<0.01&&Math.abs(hh.y)<0.01&&hh.through&&hh.feat,'2a : FAO : Ø6,6 débouchant reconnu comme fonction Perçage');
    A(!inside(30,0,-9.5)&&!inside(30,0,9.5),'2b : le trou traverse le cylindre de part en part');

    // ── 3. Cote depuis une face : le trou ne bouge pas au choix, puis obéit à la valeur ──
    hf.end='blind';hf.depth=10;markDirty();rebuild();
    const r0=faceRef(planeFaceAt(0));
    const P0=holeCylPlacement(el,r0);
    A(Math.abs(P0.d-30)<1e-3&&P0.side===1,'3a : cote proposée depuis la face X0 = 30 (vu '+P0.d+')');
    el.refs[2]=r0;el.p.d=P0.d;el.p.side=P0.side;markDirty();rebuild();
    A(near(el.fr.o,[30,0,10]),'3b : le trou reste où il est quand on choisit la référence');
    el.p.d=15;markDirty();rebuild();
    A(near(el.fr.o,[15,0,10])&&!inside(15,0,5)&&inside(30,0,5),'3c : cote 15 → trou à X15 (vu '+txt(el.fr.o)+')');
    // face du bout : côté négatif, et le trou SUIT le bout quand le cylindre s'allonge
    const r60=faceRef(planeFaceAt(60)),P60=holeCylPlacement(el,r60);
    A(Math.abs(P60.d-45)<1e-3&&P60.side===-1,'3d : depuis la face X60 : 45, de l’autre côté');
    el.refs[2]=r60;el.p.d=10;el.p.side=-1;markDirty();rebuild();
    A(near(el.fr.o,[50,0,10]),'3e : 10 mm depuis le bout → X50');
    doc.features[0].distance=80;markDirty();rebuild();
    A(near(el.fr.o,[70,0,10])&&el.st==='ok'&&!inside(70,0,5),'3f : cylindre allongé à 80 → le trou suit le bout, X70 (vu '+txt(el.fr.o)+', '+el.msg+')');
    doc.features[0].distance=60;markDirty();rebuild();
    // ⇄ : la cote passe de l'autre côté de la référence
    el.refs[2]=r0;el.p.d=20;el.p.side=1;markDirty();rebuild();
    A(near(el.fr.o,[20,0,10]),'3g : retour à la face X0, 20 mm');

    // ── 4. Cote depuis une arête ou un sommet ──
    const E=occListEdges(shape()).find(e=>Math.abs(e.mid[0])<1e-3&&cgEdgeGeom(e.pts)&&cgEdgeGeom(e.pts).circ);
    A(!!E,'4a : arête circulaire du bout X0 trouvée');
    const rE={k:'edge',pos:E.mid.map(v=>+v.toFixed(4)),len:+E.len.toFixed(4),name:'Centre'};
    const PE=holeCylPlacement(el,rE);
    A(Math.abs(PE.d-20)<1e-3,'4b : cote depuis l’arête du bout = 20 (vu '+PE.d+')');
    el.refs[2]=rE;el.p.d=25;markDirty();rebuild();
    A(near(el.fr.o,[25,0,10])&&el.st==='ok','4c : 25 mm depuis l’arête → X25 (vu '+txt(el.fr.o)+')');
    const rV={k:'vtx',pos:rE.pos,len:rE.len,vpos:E.pts[0].map(v=>+v.toFixed(4)),name:'Sommet'};
    const PV=holeCylPlacement(el,rV);
    A(Math.abs(PV.d-25)<1e-3,'4d : cote depuis un sommet du bout = 25');
    // plan parallèle à l'axe : refusé, sans rien casser
    let msg='';try{holeCylPlacement(el,{k:'o',id:'XY'});}catch(e){msg=e.message;}
    A(/parallèle/.test(msg),'4e : face parallèle à l’axe refusée : « '+msg+' »');
    // le bord du trou lui-même : il n'existe pas sur la pièce d'avant le trou (vu dans l'application)
    const EH=occListEdges(shape()).find(e=>e.len<40&&Math.abs(e.mid[0]-25)<6&&e.mid[2]>5);
    A(!!EH,'4f : arête du trou trouvée');
    let msgH='';const rH={k:'edge',pos:EH.mid.map(v=>+v.toFixed(4)),len:+EH.len.toFixed(4),name:'Bord'};
    try{holeCylPlacement(el,rH);}catch(e){msgH=e.message;}
    A(/appartient au trou/.test(msgH),'4g : le bord du trou est refusé comme référence : « '+msgH+' »');

    // ── 5. Direction : −Y, angle, face plane, décalage latéral ──
    el.refs[1]={k:'o',id:'Y'};el.p.a=180;markDirty();rebuild();
    A(near(el.fr.o,[25,-10,0])&&near(el.fr.z,[0,-1,0]),'5a : suivant −Y (vu '+txt(el.fr.o)+')');
    A(!inside(25,-5,0)&&inside(25,5,0),'5b : le trou part du côté −Y');
    el.refs[1]={k:'o',id:'Z'};el.p.a=90;markDirty();rebuild();
    const S=10*Math.SQRT1_2;
    el.p.a=45;markDirty();rebuild();
    A(Math.abs(Math.hypot(el.fr.o[1],el.fr.o[2])-10)<1e-3&&Math.abs(Math.abs(el.fr.o[1])-S)<1e-3,'5c : angle 45° : le plan reste tangent (vu '+txt(el.fr.o)+')');
    el.refs[1]={k:'o',id:'XY'};el.p.a=0;markDirty();rebuild();
    A(near(el.fr.z,[0,0,1]),'5d : normale d’un plan comme direction');
    el.refs[1]={k:'o',id:'X'};markDirty();rebuild();
    A(el.st==='warn'&&/parallèle/.test(el.msg)&&near(el.fr.z,[0,0,1]),'5e : direction le long de l’axe : ⚠, dernière position gardée');
    el.refs[1]={k:'o',id:'Z'};el.p.e=3;markDirty();rebuild();
    A(near(el.fr.o,[25,3,10])&&el.st==='ok','5f : décalage latéral 3 → Y3 (vu '+txt(el.fr.o)+')');
    el.p.e=12;markDirty();rebuild();
    A(el.st==='warn'&&/rayon/.test(el.msg),'5g : décalage plus grand que le rayon signalé');
    el.p.e=0;markDirty();rebuild();

    // ── 6. Panneau ──
    const flat=n=>{const o=[];(function w(x){o.push(x);(x.children||[]).forEach(w);})(n);return o;};
    const pnl=document.createElement('div');sel={kind:'feature',id:hf.id};renderHoleProps(pnl,hf);
    const all=flat(pnl),sels=all.filter(n=>n.tagName==='SELECT');
    A(all.some(n=>/Position sur le cylindre/.test(n.textContent||'')),'6a : le panneau montre la position sur le cylindre');
    const sDir=sels.find(s=>(s.children||[]).some(o=>o.value==='free'));
    A(sDir&&sDir.value==='+Z','6b : la direction affichée est +Z');
    A(sDir&&!(sDir.children||[]).some(o=>/X$/.test(o.value)),'6c : pas de direction le long de l’axe dans la liste');
    const pl2=document.createElement('div');
    const fO={id:'zz',type:'hole',sketchId:'skC',kind:'simple',d:5,depth:5,tip:118,end:'blind'};renderHoleProps(pl2,fO);
    A(!flat(pl2).some(n=>/Position sur le cylindre/.test(n.textContent||'')),'6d : rien de plus sur un perçage ordinaire');

    // ── 7. Sauvegarde : le placement survit, le trou reste au même endroit ──
    const J=serialise();
    await deserialise(J,{rebuild:false});markDirty();rebuild();
    const el2=doc.cgeo.find(c=>c.how==='tangent');
    A(el2&&near(el2.fr.o,[25,0,10])&&el2.refs[2]&&el2.p.d===25&&el2.visible===false,'7a : plan, référence et cote relus (vu '+txt(el2&&el2.fr.o)+')');
    A(!inside(25,0,5)&&inside(40,0,5),'7b : le trou est toujours à X25');

    // ── 8. Annulation : le plan, l'esquisse et le trou disparaissent ensemble ──
    doc.features=doc.features.filter(f=>f.type!=='hole');doc.cgeo=[];doc.sketches=doc.sketches.filter(s=>s.id==='skC');markDirty();rebuild();
    const nS=doc.sketches.length,L0=docUndoStack.length;
    holeOnCylinder(Cinfo([10,0,10]));
    A(doc.sketches.length===nS+1&&doc.cgeo.length===1&&doc.features.some(f=>f.type==='hole'),'8a : créé');
    fdynCancel();markDirty();rebuild();
    A(doc.sketches.length===nS&&!(doc.cgeo||[]).length&&!doc.features.some(f=>f.type==='hole')&&docUndoStack.length===L0,'8b : Échap retire tout, sans rien laisser dans l’annulation');
    holeOnCylinder(Cinfo([10,0,10]));fdynClose();
    docUndo();
    A(doc.sketches.length===nS&&!(doc.cgeo||[]).length&&!doc.features.some(f=>f.type==='hole'),'8c : Ctrl+Z retire tout d’un coup');

    // ── 9. Bouton Perçage ──
    sel={kind:null,id:null};selFaces=[];
    holeStart();
    A(holeFacePick&&holeFacePick.which==='cyl','9a : sans centre libre : attend un clic sur un cylindre');
    holeFacePickCancel();
    const skF={id:'skF',name:'Centres',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{h:{x:10,y:0}},entities:[{id:'h1',t:'cpoint',p:'h',hole:true}],constraints:[],dims:[],seq:5,visible:true};
    doc.sketches.push(skF);
    holeStart();fdynClose();
    A(!holeFacePick&&doc.features.some(f=>f.type==='hole'&&f.sketchId==='skF'),'9b : des centres pas encore percés : ils passent d’abord');
    holeStart();
    A(holeFacePick&&holeFacePick.which==='cyl','9c : centres déjà percés : un nouveau clic vise le cylindre, sans doubler le trou');
    holeFacePickCancel();
    return out;`;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Perçage sur un cylindre ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
