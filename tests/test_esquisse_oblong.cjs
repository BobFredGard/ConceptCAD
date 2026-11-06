// 2026-11-06 : ESQUISSE — oblong en 3 clics, comme Fusion 360 : par les 2 centres, les 2 points extrêmes
// ou le milieu + un centre, puis le rayon ; cotes posées à la création ; points dans le vide NON fixés.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
const {ctx}=loadApp();
const r=vm.runInContext(`(function(){
  const fails=[],log=[];const A=(c,m)=>{if(!c)fails.push(m);else log.push(m);};
  const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);
  const neuve=()=>{const sk={id:'s',name:'E',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],seq:1,visible:true,points:{},entities:[],constraints:[],dims:[]};doc.sketches=[sk];doc.features=[];return sk;};
  const P=(sk,x,y)=>addPoint(sk,x,y);
  const fixes=sk=>sk.constraints.filter(c=>c.type==='fix').length;
  const forme=(sk,R)=>{ // les 2 arcs réels : centres, rayon, extrémités bien sur le cercle
    solveSketch(sk,200);
    const arcs=sk.entities.filter(e=>e.t==='arc'),li=sk.entities.filter(e=>e.t==='line'&&!e.construction);
    const ok=arcs.length===2&&li.length===2&&arcs.every(e=>{const C=sk.points[e.pc];
      return near(e.r,R)&&near(Math.hypot(sk.points[e.pa].x-C.x,sk.points[e.pa].y-C.y),R)&&near(Math.hypot(sk.points[e.pb].x-C.x,sk.points[e.pb].y-C.y),R);});
    return{ok,c1:sk.points[arcs[0].pc],c2:sk.points[arcs[1].pc],arcs,li};
  };
  // 1. par les 2 centres, à plat
  let sk=neuve();let a=P(sk,10,20),b=P(sk,50,20);
  let R=skSlotCreate(sk,'centres',a,b,6,false,false);
  let F=forme(sk,6);
  A(R&&F.ok,'2 centres : 2 côtés et 2 arcs R6');
  A(F.arcs[0].pc===a&&F.arcs[1].pc===b,'les points cliqués SONT les centres');
  A(near(sk.points[a].x,10)&&near(sk.points[b].x,50)&&near(sk.points[a].y,20),'centres à leur place');
  A(sk.dims.length===2&&sk.dims.some(d=>d.type==='length'&&near(d.value,40))&&sk.dims.some(d=>d.type==='radius'&&near(d.value,6)),'cotes posées : entraxe 40 et R6');
  A(fixes(sk)===0,'aucun point fixé');
  let D=skDofInfo(sk);
  A(D.dof===2,'à plat, cotes posées : reste la position (2 DDL) — dof='+D.dof);
  // déplacer un point dans le vide : la forme suit, rien de fixé
  sk.points[a].x=15;sk.points[a].y=25;F=forme(sk,6);
  A(F.ok&&near(Math.hypot(F.c2.x-F.c1.x,F.c2.y-F.c1.y),40),'libre : déplacé, l’oblong reste entier');
  // cotes modifiées : entraxe et rayon pilotent
  sk.dims.find(d=>d.type==='length').value=70;sk.dims.find(d=>d.type==='radius').value=9;
  F=forme(sk,9);
  A(F.ok&&near(Math.hypot(F.c2.x-F.c1.x,F.c2.y-F.c1.y),70),'cotes pilotes : entraxe 70, R9');
  // 2. vertical
  sk=neuve();a=P(sk,0,0);b=P(sk,0,30);R=skSlotCreate(sk,'centres',a,b,5,false,false);F=forme(sk,5);
  A(F.ok&&sk.constraints.filter(c=>c.type==='v').length===3,'vertical : contraintes V');
  // 3. oblique : rotation libre en plus
  sk=neuve();a=P(sk,5,5);b=P(sk,35,45);R=skSlotCreate(sk,'centres',a,b,5,false,false);F=forme(sk,5);
  A(F.ok&&near(Math.hypot(F.c2.x-F.c1.x,F.c2.y-F.c1.y),50)&&!sk.constraints.some(c=>c.type==='h'||c.type==='v'),'oblique : entraxe 50, ni H ni V');
  D=skDofInfo(sk);A(D.dof===3,'oblique : position + rotation (3 DDL) — dof='+D.dof);
  const c0=sk.points[F.li[0].p1],c1=sk.points[F.li[0].p2];
  A(near((c1.y-c0.y)/(c1.x-c0.x),4/3),'oblique : côtés dans le sens de l’axe');
  // 4. par les 2 points extrêmes : les bouts restent sur les arcs, hors-tout coté
  sk=neuve();a=P(sk,5,3);b=P(sk,65,3);R=skSlotCreate(sk,'bouts',a,b,8,false,false);F=forme(sk,8);
  const cs=[F.c1.x,F.c2.x].sort((p,q)=>p-q);
  A(F.ok&&near(cs[0],13)&&near(cs[1],57),'2 extrémités : centres à 13 et 57');
  A(sk.dims.some(d=>d.type==='length'&&near(d.value,60))&&sk.dims.some(d=>d.type==='radius'&&near(d.value,8)),'cotes : hors-tout 60 et R8');
  A(near(sk.points[a].x,5)&&near(sk.points[b].x,65),'bouts cliqués à leur place');
  A(fixes(sk)===0,'bouts : aucun point fixé');
  D=skDofInfo(sk);A(D.dof===2,'bouts à plat : reste la position (2 DDL) — dof='+D.dof);
  sk.dims.find(d=>d.type==='length').value=80;F=forme(sk,8);
  A(F.ok&&near(Math.abs(sk.points[b].x-sk.points[a].x),80)&&near(Math.abs(F.c2.x-F.c1.x),64),'hors-tout 80 : entraxe 64 ('+Math.abs(F.c2.x-F.c1.x).toFixed(3)+')');
  sk=neuve();a=P(sk,0,0);b=P(sk,10,0);
  A(skSlotCreate(sk,'bouts',a,b,5,false,false)===null&&sk.entities.length===0,'hors-tout = 2 R : refusé, rien créé');
  // 5. milieu + un centre : le milieu reste au milieu quand l'écartement change
  sk=neuve();a=P(sk,40,10);b=P(sk,60,10);R=skSlotCreate(sk,'milieu',a,b,4,false,false);F=forme(sk,4);
  A(F.ok&&near(F.c1.x,20)&&near(F.c2.x,60),'milieu : centres à 20 et 60');
  A(sk.dims.some(d=>d.type==='length'&&near(d.value,40)),'écartement coté 40');
  A(sk.constraints.some(c=>c.type==='midpoint'&&c.p===a),'le point cliqué est tenu au milieu');
  A(fixes(sk)===0,'milieu : pas fixé');
  D=skDofInfo(sk);A(D.dof===2,'milieu à plat : reste la position (2 DDL) — dof='+D.dof);
  sk.dims.find(d=>d.type==='length').value=60;F=forme(sk,4);
  A(F.ok&&near((F.c1.x+F.c2.x)/2,sk.points[a].x)&&near(Math.abs(F.c2.x-F.c1.x),60),'écartement 60 : symétrique autour du milieu');
  // 6. point accroché à une géométrie : il garde le lien, sans « Fixe » ; un point dans le vide reste libre
  sk=neuve();const o=P(sk,0,0),q=P(sk,100,0);
  sk.entities.push({id:'dr',t:'line',p1:o,p2:q});
  a=P(sk,50,0);b=P(sk,50,30);
  R=skSlotCreate(sk,'centres',a,b,5,true,false);
  A(sk.constraints.some(c=>c.type==='online'&&c.p===a&&c.line==='dr'),'centre cliqué sur une droite : posé dessus');
  A(!sk.constraints.some(c=>c.type==='online'&&c.p===b),'centre dans le vide : aucune attache');
  A(fixes(sk)===0,'accroché : toujours aucun « Fixe »');
  // les points du contour ne s'attachent pas à ce qui passe à côté
  sk=neuve();const o2=P(sk,0,0),q2=P(sk,100,0);
  sk.entities.push({id:'dr',t:'line',p1:o2,p2:q2});
  a=P(sk,20,5.3);b=P(sk,60,5.3);
  R=skSlotCreate(sk,'centres',a,b,5,false,false);
  A(!sk.constraints.some(c=>c.type==='online'),'contour voisin d’une droite : aucune attache involontaire');
  // 7. arrondi : un point libre va sur la cote ronde, 2 points accrochés gardent l'écart exact
  sk=neuve();a=P(sk,0,0);b=P(sk,33.337,0);R=skSlotCreate(sk,'centres',a,b,4.126,false,false);
  A(near(sk.points[b].x,33.34,1e-9)&&near(R.dims[0].value,33.34,1e-9)&&near(R.dims[1].value,4.13,1e-9),'libre : cotes rondes 33,34 et R4,13');
  sk=neuve();a=P(sk,0,0);b=P(sk,33.337,0);R=skSlotCreate(sk,'centres',a,b,4,true,true);
  A(near(sk.points[b].x,33.337,1e-9)&&near(R.dims[0].value,33.337,1e-9),'accrochés : l’écart exact est gardé');
  return{fails,log};
})()`,ctx);
console.log('=== Oblong en 3 clics ===');
r.log.forEach(m=>console.log('  ✓ '+m));r.fails.forEach(m=>console.log('  ✗ '+m));
console.log(r.fails.length?'\n*** '+r.fails.length+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
process.exit(r.fails.length?1:0);
