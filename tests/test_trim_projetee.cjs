// V0.36.4 : projetées (gauche + bas) + cercle tangent aux deux, ajusté en arc, puis projetées
// ajustées pour fermer le contour. Avant : les bouts de l'arc COUPAIENT les projetées ; au rejeu,
// chaque projetée se raccrochait à son arête entière et ramenait le bout de l'arc au coin
// (l'arc partait de travers, l'extrusion aussi).
const vm=require('vm');const {loadApp}=require('./appvm.cjs');
let ko=0;const A=(c,m)=>{if(!c){ko++;console.log('  x '+m);}else console.log('  ✓ '+m);};
const {ctx}=loadApp();
const r=vm.runInContext(`(function(){const o={};
  const sk={id:'s',name:'s',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
    points:{O:{x:0,y:0},a:{x:-50,y:40},b:{x:-50,y:-40},d:{x:50,y:-40},c:{x:-30,y:-20}},
    entities:[{id:'L',t:'line',p1:'a',p2:'b',proj:true,construction:true},{id:'B',t:'line',p1:'b',p2:'d',proj:true,construction:true},{id:'k',t:'circle',pc:'c',r:20}],
    constraints:[{id:'f1',type:'fix',p:'a'},{id:'f2',type:'fix',p:'b'},{id:'f3',type:'fix',p:'d'},{id:'t1',type:'tangent',line:'L',ent:'k'},{id:'t2',type:'tangent',line:'B',ent:'k'}],dims:[],seq:50};
  doc.sketches=[sk];skEdit=sk;
  // 1) cercle ajusté contre les projetées restées EN CONSTRUCTION (elles servent de limite)
  o.m1=trimEntity(sk,entById(sk,'k'),-45,-35);solveSketch(sk);
  const k=entById(sk,'k'),P=sk.points;
  o.arc=k.t==='arc';o.L=[sk.entities.find(e=>e.id==='L').p1,sk.entities.find(e=>e.id==='L').p2];o.B=[entById(sk,'B').p1,entById(sk,'B').p2];
  o.on=sk.constraints.filter(c=>c.type==='online').map(c=>c.p+'@'+c.line).sort();
  o.ends=[k.pa,k.pb];
  // 2) projetées (toujours en construction) ajustées : on retire le côté opposé au coin
  o.m2=trimEntity(sk,entById(sk,'B'),10,-40);
  o.m3=trimEntity(sk,entById(sk,'L'),-50,10);
  solveSketch(sk);
  o.projs=sk.entities.filter(e=>e.proj).map(e=>e.id+(e.construction?'C':'')+':'+e.p1+'-'+e.p2);
  o.lines=sk.entities.filter(e=>e.t==='line'&&!e.construction).map(e=>[P[e.p1],P[e.p2]]);
  const L=skLoopTrace(sk);o.loops=(L.loops||[]).length;o.solids=(L.solids||[]).length;
  o.pts=JSON.stringify([P[k.pa],P[k.pb]]);
  // 3) rejeu : les projetées sont remises sur leurs arêtes (ici inchangées) — l'arc ne bouge pas
  const before=o.pts;solveSketch(sk);o.stable=JSON.stringify([P[k.pa],P[k.pb]])===before;
  return o;})()`,ctx);
console.log('   '+r.m1+' | '+r.m2+' | '+r.m3);
A(r.arc&&r.L.join()==='a,b'&&r.B.join()==='b,d','projetées intactes après l’ajustement du cercle ('+r.L+' / '+r.B+')');
A(r.on.length===2,'bouts de l’arc posés SUR les projetées (online) : '+r.on.join(' '));
A(r.projs.length===2&&r.projs.every(s=>/^[LB]C:/.test(s))&&r.projs.join()==='LC:a-b,BC:b-d','projetées entières, en construction, après leur ajustement : '+r.projs.join(' '));
A(r.lines.length===2,'deux tronçons ordinaires gardés ('+r.lines.length+')');
A(r.loops===1&&r.solids===1,'un contour fermé arc + tronçons ('+r.loops+'/'+r.solids+')');
A(r.stable,'arc stable à la résolution suivante '+r.pts);
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');process.exit(ko?1:0);
