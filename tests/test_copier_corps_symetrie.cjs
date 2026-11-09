// Copier un corps — options (V0.78.0, src/85-copier-corps) : copie en place, symétrie par 1 plan,
// par 2 plans, avec ou sans union. Union : aucun corps neuf, un seul solide, et les faces planes
// recollées (pas de trait de symétrie au milieu d'une face). Noyau OCCT réel.
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
    "const rect=(id,x0,y0,x1,y1)=>({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:x0,y:y0},b:{x:x1,y:y0},c:{x:x1,y:y1},d:{x:x0,y:y1}},entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:20,visible:false});",
    "doc.sketches=[rect('s1',0,0,40,20)];doc.features=[];doc.bodies=[];delete doc.activeBody;ensureBodies();tlMark=null;",
    "const B1=doc.bodies[0].id;",
    "doc.features.push({id:'F1',type:'extrude',name:'Bloc',sketchId:'s1',distance:10,op:'add',visible:true,body:B1});",
    "markDirty();rebuild();",
    "const T=occt.TopAbs_ShapeEnum;const cnt=(sh,k)=>{let n=0;const e=new occt.TopExp_Explorer_2(sh,T[k],T.TopAbs_SHAPE);for(;e.More();e.Next())n++;e.delete();return n;};",
    "const box=sh=>{let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;occListEdges(sh).forEach(k=>k.pts.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}));return{x0,x1,y0,y1};};",
    "const shot=()=>{markDirty();rebuild();const R=occFinalShape(null);const per=(R.perBody||[]).filter(x=>x.shape).map(x=>({id:x.bodyId,v:asmVolCom(x.shape).v,so:cnt(x.shape,'TopAbs_SOLID'),fa:cnt(x.shape,'TopAbs_FACE'),b:box(x.shape)}));occCleanup(R,null);return per;};",
    // 1 — copie en place (comportement d'avant)
    "let f=openBodyCopy(B1);let p=shot();",
    "A(f&&f.mode==='place'&&doc.bodies.length===2&&p.length===2&&near(p[1].v,8000,.01)&&near(p[1].b.x0,0),'1 : copie en place dans un corps neuf');",
    // 2 — symétrie 1 plan, sans union : un corps neuf, en miroir
    "const set=(fn)=>{fn();bcSyncBodies(f);f.name=bcName(f);};",
    "set(()=>{f.mode='mirror1';f.plane='YZ';});p=shot();{const c=p.find(x=>x.id===f.newBody);A(doc.bodies.length===2&&c&&near(c.b.x0,-40)&&near(c.b.x1,0)&&/symétrie YZ/.test(bmBodyName(f.newBody)),'2 : symétrie YZ : corps neuf « '+bmBodyName(f.newBody)+' » de -40 à 0');}",
    // 3 — symétrie 2 plans, sans union : 3 corps neufs
    "set(()=>{f.mode='mirror2';f.plane='YZ';f.plane2='XZ';});p=shot();",
    "{const nb=occNewBodies(f);const bx=nb.map(b=>(p.find(x=>x.id===b)||{}).b);A(nb.length===3&&doc.bodies.length===4&&p.length===4&&bx.every(Boolean)&&near(bx[0].x0,-40)&&near(bx[0].y0,0)&&near(bx[1].x0,0)&&near(bx[1].y0,-20)&&near(bx[2].x0,-40)&&near(bx[2].y0,-20),'3 : symétrie YZ + XZ : 3 corps neufs aux 3 autres quarts');}",
    "const nb3=occNewBodies(f).slice();",
    // 4 — union 2 plans : plus de corps neuf, un seul solide, faces planes recollées
    "set(()=>{f.union=true;});p=shot();",
    "{const s=p.find(x=>x.id===B1);A(doc.bodies.length===1&&!f.newBody&&!f.newBodies&&p.length===1&&s&&near(s.v,32000,.01)&&s.so===1,'4 : union 2 plans : un seul corps, un seul solide de 32000 mm³ ('+(s&&s.v.toFixed(1))+')');",
    " A(s&&s.fa===6,'5 : faces planes d’un seul tenant, sans trait de symétrie ('+(s&&s.fa)+' faces, 6 attendues)');}",
    // 6 — union 1 plan
    "set(()=>{f.mode='mirror1';});p=shot();{const s=p[0];A(p.length===1&&near(s.v,16000,.01)&&s.so===1&&s.fa===6,'6 : union 1 plan : un solide, 6 faces ('+s.fa+')');}",
    // 7 — union décochée : le corps neuf revient
    "set(()=>{f.union=false;});p=shot();A(doc.bodies.length===2&&p.length===2,'7 : union décochée : corps neuf recréé');",
    // 8 — plan de construction décalé
    "doc.cgeo=(doc.cgeo||[]).concat([{id:'cgP',kind:'plane',name:'Plan X=50',fr:{o:[50,0,0],x:[0,1,0],y:[0,0,1],z:[1,0,0]}}]);",
    "set(()=>{f.plane='cg:cgP';});p=shot();{const c=p.find(x=>x.id===f.newBody);A(c&&near(c.b.x0,60)&&near(c.b.x1,100),'8 : plan de construction X=50 : copie de 60 à 100');}",
    "const s0=featSig(f);doc.cgeo[doc.cgeo.length-1].fr.o=[60,0,0];A(featSig(f)!==s0,'9 : la signature (cache) suit le plan de construction');",
    // 10 — fichier et suppression
    "const js=JSON.parse(serialise(false));const g=js.features.find(x=>x.id===f.id);A(g&&g.mode==='mirror1'&&g.plane==='cg:cgP'&&g.union===false,'10 : options enregistrées dans le fichier');",
    "delFeature(f);A(doc.bodies.length===1,'11 : supprimer l’étape retire les corps neufs');",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Copier un corps : symétrie et union ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
