// V0.36.3 : fusionner un coin de rectangle avec un bout de PROJECTION (outil ⌖, F1) —
// le point fixe est conservé quel que soit l'ordre des clics : c'est le rectangle qui
// rejoint la projetée, jamais la projetée qui part vers le rectangle.
const vm=require('vm');const {loadApp}=require('./appvm.cjs');
let ko=0;const A=(c,m)=>{if(!c){ko++;console.log('  x '+m);}else console.log('  ✓ '+m);};
const {ctx}=loadApp();
const r=vm.runInContext(`(function(){const o={};
  const mk=()=>({id:'s',name:'s',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
    points:{a:{x:-40,y:40},b:{x:-40,y:-40},c:{x:-20,y:-20},d:{x:10,y:-20}},
    entities:[{id:'pj',t:'line',p1:'a',p2:'b',proj:true},{id:'l',t:'line',p1:'c',p2:'d'}],
    constraints:[{id:'f1',type:'fix',p:'a'},{id:'f2',type:'fix',p:'b'}],dims:[],seq:50});
  // 1er clic sur le coin du rectangle (c), 2e sur le bout de projetée (b)
  let sk=mk();doc.sketches=[sk];skEdit=sk;mergePoints(sk,'b','c');solveSketch(sk);
  const pj=sk.entities.find(e=>e.id==='pj'),l=sk.entities.find(e=>e.id==='l');
  const B=sk.points[pj.p2];o.k1={proj:[B.x,B.y],same:l.p1===pj.p2,fix:skFixed(sk).has(pj.p2)};
  // ordre inverse
  sk=mk();doc.sketches=[sk];skEdit=sk;mergePoints(sk,'c','b');solveSketch(sk);
  const pj2=sk.entities.find(e=>e.id==='pj');const B2=sk.points[pj2.p2];o.k2=[B2.x,B2.y];
  return o;})()`,ctx);
A(Math.abs(r.k1.proj[0]+40)<1e-9&&Math.abs(r.k1.proj[1]+40)<1e-9&&r.k1.same,'coin du rectangle cliqué en 1er : la projetée reste en place '+JSON.stringify(r.k1.proj)+', le rectangle la rejoint');
A(r.k1.fix,'le point fusionné reste fixe');
A(Math.abs(r.k2[0]+40)<1e-9&&Math.abs(r.k2[1]+40)<1e-9,'ordre inverse : projetée en place '+JSON.stringify(r.k2));
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');process.exit(ko?1:0);
