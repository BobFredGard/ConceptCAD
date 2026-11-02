// V0.36.4 : tirer le bout d'un arc d'esquisse — l'arc suit (centre / rayon recalculés), le bout
// reste sous le curseur au lieu de quitter l'arc puis d'y être ramené à la résolution suivante.
const vm=require('vm');const {loadApp}=require('./appvm.cjs');
let ko=0;const A=(c,m)=>{if(!c){ko++;console.log('  x '+m);}else console.log('  ✓ '+m);};
const {ctx}=loadApp();
const r=vm.runInContext(`(function(){const o={};
  const mk=()=>({id:'s',name:'s',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],
    points:{O:{x:0,y:0},c:{x:0,y:-30},a:{x:-15,y:-30},b:{x:15,y:-30}},
    entities:[{id:'k',t:'arc',pc:'c',pa:'a',pb:'b',r:15}],constraints:[],dims:[],seq:50});
  const on=(sk,p)=>Math.abs(Math.hypot(sk.points[p].x-sk.points.c.x,sk.points[p].y-sk.points.c.y)-sk.entities[0].r);
  // bout pb tiré (ancré pendant le glisser) en (20,-20)
  let sk=mk();doc.sketches=[sk];sk.points.b={x:20,y:-20};solveSketch(sk,40,['b']);
  o.b1={b:sk.points.b,ea:on(sk,'a'),eb:on(sk,'b')};
  solveSketch(sk);o.b2={b:sk.points.b,ea:on(sk,'a'),eb:on(sk,'b')}; // résolution suivante (lâcher, autre édition)
  // bout pa (celui qui pilote le rayon) tiré en (-25,-20)
  sk=mk();doc.sketches=[sk];sk.points.a={x:-25,y:-20};solveSketch(sk,40,['a']);solveSketch(sk);
  o.a={a:sk.points.a,ea:on(sk,'a'),eb:on(sk,'b')};
  // arc au centre fixé et rayon coté : le bout ne peut que glisser sur le cercle (inchangé)
  sk=mk();sk.constraints.push({id:'f',type:'fix',p:'c'});sk.dims.push({id:'d',type:'radius',ent:'k',value:15});doc.sketches=[sk];
  sk.points.b={x:20,y:-20};solveSketch(sk);o.lock={eb:on(sk,'b'),r:sk.entities[0].r};
  return o;})()`,ctx);
const near=(p,x,y)=>Math.hypot(p.x-x,p.y-y)<1e-3;
A(near(r.b1.b,20,-20)&&r.b1.ea<1e-4&&r.b1.eb<1e-4,'bout pb tiré : reste sous le curseur, l’arc passe par ses deux bouts '+JSON.stringify(r.b1));
A(near(r.b2.b,20,-20)&&r.b2.eb<1e-4,'résolution suivante : le bout n’est pas ramené sur l’ancien cercle '+JSON.stringify(r.b2.b));
A(near(r.a.a,-25,-20)&&r.a.ea<1e-4&&r.a.eb<1e-4,'bout pa tiré : idem '+JSON.stringify(r.a));
A(r.lock.eb<1e-4&&Math.abs(r.lock.r-15)<1e-9,'centre fixé + rayon coté : le bout revient sur le cercle R15');
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');process.exit(ko?1:0);
