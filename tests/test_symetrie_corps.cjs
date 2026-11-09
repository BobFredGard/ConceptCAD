// Symétrie d'un corps entier (fonction 'bmirror', src/85-symetrie-corps) : volume doublé, un seul
// solide si le corps touche le plan, prise en compte d'une combinaison, cache. Noyau OCCT réel.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);",
    "occt=__realOcct;occtReady=true;",
    "const rect=(id,x0,y0,x1,y1)=>({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:x0,y:y0},b:{x:x1,y:y0},c:{x:x1,y:y1},d:{x:x0,y:y1}},entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[]});",
    "doc.sketches=[rect('s1',0,0,40,20),rect('s2',10,5,20,15)];doc.features=[];doc.bodies=[];delete doc.activeBody;ensureBodies();",
    "const B1=doc.bodies[0].id;",
    "doc.features.push({id:'F1',type:'extrude',name:'Bloc',sketchId:'s1',distance:10,op:'add',visible:true,body:B1});",
    "newBody();const B2=doc.activeBody;",
    "doc.features.push({id:'F2',type:'extrude',name:'Outil',sketchId:'s2',distance:10,op:'add',visible:true,body:B2});",
    "doc.features.push({id:'C1',type:'combine',name:'Trou',body:B1,tools:[B2],mode:'cut',keep:false,visible:true});",
    "doc.activeBody=B1;markDirty();rebuild();",
    "const shot=()=>{const R=occFinalShape(null);const v=asmVolCom(R.shape).v;let n=0;const T=occt.TopAbs_ShapeEnum;const e=new occt.TopExp_Explorer_2(R.shape,T.TopAbs_SOLID,T.TopAbs_SHAPE);for(;e.More();e.Next())n++;e.delete();const ed=occListEdges(R.shape);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;ed.forEach(k=>k.pts.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}));const msgs=(R.msgs||[]).slice();occCleanup(R,null);return {v,n,x0,x1,y0,y1,msgs};};",
    "let b=shot();A(near(b.v,7000,.01),'0 : bloc combiné de référence ('+b.v.toFixed(1)+' mm³)');",
    "const f=openBodyMirror(B1);",
    "A(f&&f.type==='bmirror'&&f.body===B1&&f.plane==='YZ'&&/Symétrie YZ/.test(f.name),'1 : la commande crée « '+(f&&f.name)+' »');",
    "b=shot();A(near(b.v,14000,.01)&&b.n===1&&near(b.x0,-40)&&near(b.x1,40),'2 : plan YZ : volume doublé, un seul solide, de -40 à 40 ('+b.v.toFixed(1)+', '+b.n+')');",
    "f.plane='XZ';f.name=bmirName(f);markDirty();rebuild();b=shot();A(near(b.v,14000,.01)&&b.n===1&&near(b.y0,-20)&&near(b.y1,20),'3 : plan XZ : de -20 à 20');",
    "const s=featSig(f);f.plane='XY';A(featSig(f)!==s,'4 : la signature (cache) dépend du plan');f.plane='XZ';",
    "const f2={id:'M2',type:'bmirror',name:'',body:B1,plane:'YZ',visible:true};f2.name=bmirName(f2);doc.features.push(f2);markDirty();rebuild();b=shot();A(near(b.v,28000,.01)&&b.n===1,'5 : deux symétries = pièce entière depuis le quart');",
    "A(featIconOf(f)==='◫','6 : icône de l’arbre');",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Symétrie d’un corps (bmirror) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
