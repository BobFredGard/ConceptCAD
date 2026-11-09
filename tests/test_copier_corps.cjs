// Copier un corps (fonction 'bcopy', src/85-copier-corps) : la copie naît dans un corps neuf,
// telle que le source est À CET INSTANT de la timeline ; ce qui vient après n'y entre pas,
// ce qui change avant s'y retrouve. Marqueur, déplacement de la copie, suppression, fichier.
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
    "const bbox=sh=>{const E=occListEdges(sh);let x0=1e9,x1=-1e9,z1=-1e9;E.forEach(e=>e.pts.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z1=Math.max(z1,p[2]);}));return{x0,x1,z1};};",
    "const box={id:'skA',name:'Bloc',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:0,y:0},b:{x:40,y:0},c:{x:40,y:20},d:{x:0,y:20}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:20,visible:false};",
    "const pas={id:'skB',name:'Pastille',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{q:{x:5,y:5}},entities:[{id:'c2',t:'circle',pc:'q',r:2}],constraints:[],dims:[],seq:20,visible:false};",
    "doc.sketches=[box,pas];doc.features=[];doc.bodies=[];delete doc.activeBody;ensureBodies();tlMark=null;",
    "const B1=doc.bodies[0].id;",
    "doc.features.push({id:'F1',type:'extrude',name:'Bloc',sketchId:'skA',distance:10,op:'add',visible:true,body:B1});",
    "doc.features.push({id:'F2',type:'extrude',name:'Pastille',sketchId:'skB',distance:30,op:'add',visible:true,body:B1});",
    "markDirty();rebuild();",
    "const shot=()=>{markDirty();rebuild();const R=occFinalShape(null);const per=(R.perBody||[]).filter(x=>x.shape).map(x=>({id:x.bodyId,b:bbox(x.shape)}));occCleanup(R,null);return per;};",
    // marqueur entre le bloc et la pastille : la copie prend le bloc seul
    "tlMark='F2';",
    "const f=openBodyCopy(B1);const NB=f&&f.newBody;",
    "A(f&&f.type==='bcopy'&&doc.features.indexOf(f)===1&&NB&&NB!==B1&&/\(copie\)/.test(bmBodyName(NB)),'1 : étape « '+(f&&f.name)+' » posée au marqueur, corps neuf « '+bmBodyName(NB)+' »');",
    "tlMark=null;let p=shot();{const s=p.find(x=>x.id===B1),c=p.find(x=>x.id===NB);A(p.length===2&&s&&near(s.b.z1,30)&&c&&near(c.b.z1,10),'2 : source avec pastille (Z 30), copie SANS la pastille ajoutée après (Z 10)');}",
    "doc.features[0].distance=15;p=shot();{const c=p.find(x=>x.id===NB);A(c&&near(c.b.z1,15),'3 : une cote changée AVANT la copie s’y retrouve (Z 15)');}",
    "doc.features[0].distance=10;",
    "A(featIconOf(f)==='⧉'&&tlbSvgKey({kind:'feature',o:f})[0]==='copy','4 : icône dans l’arbre et la timeline');",
    "A(bodyBornAt(NB,0)===false&&bodyBornAt(NB,2)===true,'5 : le corps copié n’existe pas avant l’étape');",
    "tlMark='F1';A(openBodyCopy(B1)===null,'6 : copie refusée avant que le corps ait de la matière');tlMark=null;",
    // déplacer la copie
    "const m=openBodyMove(NB);A(m&&m.body===NB,'7 : la copie peut être déplacée');",
    "m.steps=[{k:'t',v:[100,0,0]}];p=shot();{const c=p.find(x=>x.id===NB),s=p.find(x=>x.id===B1);A(c&&near(c.b.x0,100)&&s&&near(s.b.x0,0),'8 : copie déplacée de 100 en X, source en place ('+(c&&c.b.x0)+')');}",
    "delFeature(m);",
    "const js=JSON.parse(serialise(false));const g=js.features.find(x=>x.id===f.id);A(g&&g.type==='bcopy'&&g.body===B1&&g.newBody===NB,'9 : étape enregistrée dans le fichier');",
    "const s1=featSig(f);doc.features[0].distance=12;A(featSig(f)!==s1,'10 : la signature (cache) suit l’historique du source');doc.features[0].distance=10;",
    "delFeature(f);A(!doc.bodies.some(x=>x.id===NB),'11 : supprimer l’étape retire le corps copié');",
    "p=shot();A(p.length===1,'12 : de nouveau un seul corps');",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Copier un corps (bcopy) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
