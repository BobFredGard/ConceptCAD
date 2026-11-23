// Déplacer un corps (fonction 'bmove', src/85) : translation, suivant une direction, rotation
// autour d'un axe, point à point, cache des points de contrôle, enregistrement. Noyau OCCT réel.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};',ctx);
  const R=[
    "const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);",
    "occt=__realOcct;occtReady=true;",
    "const bbox=sh=>{const E=occListEdges(sh);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;E.forEach(e=>e.pts.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);z0=Math.min(z0,p[2]);z1=Math.max(z1,p[2]);}));return{x0,x1,y0,y1,z0,z1,n:E.length};};",
    // bloc 40 × 20 × 10, coin à l'origine
    "const box={id:'skA',name:'Bloc',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{a:{x:0,y:0},b:{x:40,y:0},c:{x:40,y:20},d:{x:0,y:20}},",
    "  entities:[{id:'l1',t:'line',p1:'a',p2:'b'},{id:'l2',t:'line',p1:'b',p2:'c'},{id:'l3',t:'line',p1:'c',p2:'d'},{id:'l4',t:'line',p1:'d',p2:'a'}],constraints:[],dims:[],seq:20,visible:false};",
    "doc.sketches=[box];doc.features=[];doc.bodies=[];delete doc.activeBody;ensureBodies();",
    "doc.features.push({id:'F1',type:'extrude',name:'Bloc',sketchId:'skA',distance:10,op:'add',visible:true,body:doc.bodies[0].id});",
    "markDirty();rebuild();",
    "const B1=doc.bodies[0].id;",
    "const f=openBodyMove(B1);",
    "A(f&&f.type==='bmove'&&f.body===B1&&doc.features[doc.features.length-1]===f&&/Déplacer « /.test(f.name),'1 : la commande crée la fonction « '+(f&&f.name)+' » en fin de timeline');",
    "const shot=()=>{markDirty();rebuild();const R=occFinalShape(null);const b=bbox(R.shape);occCleanup(R,null);return b;};",
    "let b=shot();A(near(b.x0,0)&&near(b.x1,40)&&near(b.z1,10)&&!f._err,'2 : sans étape, le corps reste en place');",
    "f.steps=[{k:'t',v:[10,0,5]}];b=shot();A(near(b.x0,10)&&near(b.x1,50)&&near(b.z0,5)&&near(b.z1,15),'3 : translation X 10, Z 5 → X 10 → 50, Z 5 → 15');",
    "f.steps=[{k:'d',o:[0,0,0],d:[0,1,0],dist:-7,name:'Y'}];b=shot();A(near(b.y0,-7)&&near(b.y1,13),'4 : suivant une direction (Y, −7) — et le cache suit le changement d’étape');",
    "f.steps=[{k:'r',o:[0,0,0],d:[0,0,1],deg:90,name:'Z'}];b=shot();A(near(b.x0,-20)&&near(b.x1,0)&&near(b.y0,0)&&near(b.y1,40),'5 : rotation 90° autour de Z (origine) : X −20 → 0, Y 0 → 40');",
    "f.steps=[{k:'r',o:[20,10,0],d:[1,0,0],deg:180,name:'X'}];b=shot();A(near(b.z0,-10)&&near(b.z1,0)&&near(b.y0,0)&&near(b.y1,20)&&near(b.x1,40),'6 : retournement 180° autour d’un axe X par le centre (Z −10 → 0)');",
    // point à point : centre de gravité → origine
    "f.steps=[];markDirty();rebuild();const c=bmBodyCentre(B1);A(c&&near(c[0],20)&&near(c[1],10)&&near(c[2],5),'7 : centre du corps (gravité) = (20 ; 10 ; 5)');",
    "f.steps=[{k:'p',a:c,b:[0,0,0],na:'Centre',nb:'Origine'}];b=shot();A(near(b.x0,-20)&&near(b.x1,20)&&near(b.y0,-10)&&near(b.z0,-5)&&near(b.z1,5),'8 : point à point : centre du corps → origine');",
    // enchaînement : rotation puis translation (ordre respecté)
    "f.steps=[{k:'r',o:[0,0,0],d:[0,0,1],deg:90},{k:'t',v:[100,0,0]}];b=shot();A(near(b.x0,80)&&near(b.x1,100)&&near(b.y1,40),'9 : étapes enchaînées dans l’ordre (rotation puis translation)');",
    "const F=bmFrame(f);A(near(F.o[0],100)&&near(F.x[1],1)&&near(F.y[0],-1),'10 : repère composé (bmFrame)');",
    // une fonction APRÈS le déplacement s'ajoute à la pièce déplacée, en coordonnées absolues
    "const pas={id:'skB',name:'Pastille',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{k:{x:90,y:20}},entities:[{id:'cc',t:'circle',pc:'k',r:5}],constraints:[],dims:[],seq:20,visible:false};",
    "doc.sketches.push(pas);doc.features.push({id:'F2',type:'extrude',name:'Pastille',sketchId:'skB',distance:30,op:'add',visible:true,body:B1});",
    "b=shot();A(near(b.z1,30)&&near(b.x0,80),'11 : une extrusion ajoutée après le déplacement s’unit au corps déplacé');",
    "doc.features=doc.features.filter(x=>x.id!=='F2');",
    // enregistrement
    "const js=JSON.parse(serialise(false));const g=js.features.find(x=>x.id===f.id);A(g&&g.type==='bmove'&&g.steps.length===2&&g.steps[1].v[0]===100,'12 : étapes enregistrées dans le fichier');",
    "A(featIconOf(f)==='✥'&&typeof occApplyBodyMove==='function','13 : icône de l’arbre');",
    // signature : l'ordre des étapes compte
    "const s1=featSig(f);f.steps=f.steps.slice().reverse();A(featSig(f)!==s1,'14 : la signature (cache) dépend des étapes et de leur ordre');",
    // V0.99.61 : repère manipulable — flèches, anneaux, points cardinaux, pivot qui suit le corps
    "f.steps=[];delete f.piv;markDirty();rebuild();sel={kind:'feature',id:f.id};",
    "const C=bmCardinals(B1);A(C.length===28&&C[0].name==='Centre de la boîte'&&near(C[0].p[0],20)&&C.some(q=>q.name==='Coin X+ Y+ Z+'&&near(q.p[0],40)&&near(q.p[1],20)&&near(q.p[2],10)),'15 : 27 points cardinaux de la boîte + centre de gravité');",
    "let pv=bmPivot(f);A(near(pv[0],20)&&near(pv[1],10)&&near(pv[2],5),'16 : sans choix, le repère est au centre de gravité');",
    "bmApply(f,'move',0,12);bmApply(f,'move',2,-3);A(f.steps.length===1&&f.steps[0].k==='t'&&near(f.steps[0].v[0],12)&&near(f.steps[0].v[2],-3),'17 : deux flèches à la suite = une seule translation fusionnée');",
    "b=shot();A(near(b.x0,12)&&near(b.z0,-3),'18 : translation du repère rejouée sur le corps exact');",
    "bmSetPivot(f,bmCardinals(B1).find(q=>q.name==='Coin X− Y− Z−'));pv=bmPivot(f);A(near(pv[0],12)&&near(pv[1],0)&&near(pv[2],-3)&&f.piv&&near(f.piv[0],0)&&near(f.piv[2],0),'19 : repère posé sur un coin (rangé en coordonnées du corps)');",
    "bmApply(f,'rot',2,45);bmApply(f,'rot',2,45);A(f.steps.length===2&&f.steps[1].k==='r'&&near(f.steps[1].deg,90),'20 : deux rotations autour du même axe = une seule étape de 90°');",
    "b=shot();A(near(b.x0,-8)&&near(b.x1,12)&&near(b.y0,0)&&near(b.y1,40),'21 : rotation de 90° autour de Z par le coin choisi');",
    "pv=bmPivot(f);A(near(pv[0],12)&&near(pv[1],0)&&near(pv[2],-3),'22 : le repère reste sur son coin après la rotation');",
    "bmApply(f,'move',1,5);pv=bmPivot(f);A(f.steps.length===3&&near(pv[1],5),'23 : le repère suit le corps quand il se déplace');",
    "const js2=JSON.parse(serialise(false)).features.find(x=>x.id===f.id);A(js2&&Array.isArray(js2.piv)&&!('_pc' in js2),'24 : position du repère enregistrée (sans mémo interne)');",
    "f.steps=[];delete f.piv;delete f.pivName;sel=null;",
    "return out;"
  ].join('\n');
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== Déplacer un corps (bmove) ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
