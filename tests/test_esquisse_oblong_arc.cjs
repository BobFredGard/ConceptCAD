// 2026-11-09 : ESQUISSE — oblong en arc (bouts ronds) et secteur de couronne (bouts droits vers le centre),
// créés en 4 clics comme Fusion 360 ; cotes posées à la création ; points dans le vide NON fixés.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
const {ctx}=loadApp();
const r=vm.runInContext(`(function(){
  const fails=[],log=[];const A=(c,m)=>{if(!c)fails.push(m);else log.push(m);};
  const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);
  let nSk=0;const neuve=()=>{const sk={id:'s'+(++nSk),name:'E',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],seq:1,visible:true,points:{},entities:[],constraints:[],dims:[]};doc.sketches=[sk];doc.features=[];return sk;};
  const D2R=Math.PI/180;
  const fixes=sk=>sk.constraints.filter(c=>c.type==='fix').length;
  const dist=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
  // contrôle de l'oblong en arc : axe R, bouts de rayon w tangents aux arcs extérieur et intérieur
  const formeArc=(sk,R,w,sw)=>{
    solveSketch(sk,300);
    const P=sk.points,arcs=sk.entities.filter(e=>e.t==='arc'&&!e.construction);
    const axe=sk.entities.find(e=>e.t==='arc'&&e.construction);
    const C=P[axe.pc];
    const ext=arcs.find(e=>e.pc===axe.pc&&e.r>R),int=arcs.find(e=>e.pc===axe.pc&&e.r<R);
    const bouts=arcs.filter(e=>e.pc!==axe.pc);
    const surCercle=e=>near(dist(P[e.pa],P[e.pc]),e.r)&&near(dist(P[e.pb],P[e.pc]),e.r);
    let ok=arcs.length===4&&ext&&int&&bouts.length===2&&arcs.every(surCercle)&&surCercle(axe);
    ok=ok&&near(axe.r,R)&&near(ext.r,R+w)&&near(int.r,R-w)&&bouts.every(b=>near(b.r,w));
    // tangence : centre du bout, centre de l'arc et contact alignés
    ok=ok&&bouts.every(b=>near(dist(P[b.pc],C),R));
    const an=arcAngles(sk,axe);
    if(sw!=null)ok=ok&&near(an.a2-an.a1,sw,1e-3);
    return{ok,C,axe,ext,int,bouts};
  };
  const formeSect=(sk,r1,r2,sw)=>{
    solveSketch(sk,300);
    const P=sk.points,arcs=sk.entities.filter(e=>e.t==='arc'),li=sk.entities.filter(e=>e.t==='line');
    const C=P[arcs[0].pc];
    const surCercle=e=>near(dist(P[e.pa],P[e.pc]),e.r)&&near(dist(P[e.pb],P[e.pc]),e.r);
    let ok=arcs.length===2&&li.length===2&&arcs.every(surCercle)&&arcs[0].pc===arcs[1].pc;
    const rs=arcs.map(e=>e.r).sort((a,b)=>a-b);
    ok=ok&&near(rs[0],r1)&&near(rs[1],r2);
    // les côtés droits pointent vers le centre
    ok=ok&&li.every(l=>{const a=P[l.p1],b=P[l.p2];return near(Math.abs((b.x-a.x)*(C.y-a.y)-(b.y-a.y)*(C.x-a.x))/dist(a,b),0);});
    const an=arcAngles(sk,arcs[0]);
    if(sw!=null)ok=ok&&near(an.a2-an.a1,sw,1e-3);
    return{ok,C};
  };
  // 1. oblong en arc par le centre : R40, demi-largeur 5, 90°
  let sk=neuve();
  let c=addPoint(sk,10,20),s=addPoint(sk,50,20);
  let R=skASlotCreate(sk,'arc',{cx:10,cy:20,R:40,w:5,a1:0,sw:Math.PI/2},{c,S:s});
  let F=formeArc(sk,40,5,Math.PI/2);
  A(R&&F.ok,'arc par centre : 2 arcs, 2 bouts ronds tangents, axe R40, 90°');
  A(sk.entities.filter(e=>!e.construction).length===4,'4 traits réels (2 arcs, 2 bouts)');
  A(F.axe.pc===c&&F.axe.pa===s,'le centre et le départ cliqués sont gardés');
  A(sk.dims.length===3&&sk.dims.some(d=>d.type==='radius'&&near(d.value,40))&&sk.dims.some(d=>d.type==='radius'&&near(d.value,5))
    &&sk.dims.some(d=>d.type==='angle'&&near(d.value,Math.PI/2)),'cotes posées : R40, R5 du bout, 90°');
  A(fixes(sk)===0,'aucun point fixé');
  let D=skDofInfo(sk);
  A(D.dof===3,'cotes posées : reste la position et la rotation (3 DDL) — dof='+D.dof);
  // les cotes pilotent
  sk.dims.find(d=>d.type==='radius'&&near(d.value,40)).value=60;
  sk.dims.find(d=>d.type==='radius'&&near(d.value,5)).value=8;
  sk.dims.find(d=>d.type==='angle').value=60*D2R;
  F=formeArc(sk,60,8,60*D2R);
  A(F.ok,'cotes pilotes : R60, bout R8, 60° — la forme reste tangente');
  // déplacer le centre : tout suit
  for(let k=0;k<20;k++){sk.points[c].x-=2;sk.points[c].y-=0.65;solveSketch(sk,60);} // glissé pas à pas, comme à la souris
  F=formeArc(sk,60,8,60*D2R);
  A(F.ok,'libre : glissé, l’oblong en arc reste entier');
  // 2. secteur : R20 à R35, 120°
  sk=neuve();c=addPoint(sk,5,5);s=addPoint(sk,25,5); // hors de l'origine (sinon le centre s'y fixe)
  R=skASlotCreate(sk,'secteur',{cx:5,cy:5,r1:20,r2:35,a1:0,sw:120*D2R},{c,i1:s});
  F=formeSect(sk,20,35,120*D2R);
  A(R&&F.ok,'secteur : 2 arcs concentriques et 2 côtés tournés vers le centre');
  A(sk.dims.length===3&&sk.dims.some(d=>d.type==='radius'&&near(d.value,20))&&sk.dims.some(d=>d.type==='radius'&&near(d.value,35))
    &&sk.dims.some(d=>d.type==='angle'&&near(d.value,120*D2R)),'cotes posées : R20, R35, 120°');
  A(fixes(sk)===0,'secteur : aucun point fixé');
  D=skDofInfo(sk);A(D.dof===3,'secteur : position + rotation (3 DDL) — dof='+D.dof);
  sk.dims.find(d=>d.type==='radius'&&near(d.value,35)).value=50;
  sk.dims.find(d=>d.type==='angle').value=45*D2R;
  F=formeSect(sk,20,50,45*D2R);
  A(F.ok,'secteur : R50 et 45° pilotent');
  // 3. ouverture de plus d'un demi-tour : pas de cote d'angle, forme correcte
  sk=neuve();R=skASlotCreate(sk,'arc',{cx:0,cy:0,R:30,w:4,a1:0,sw:250*D2R},{});
  F=formeArc(sk,30,4,250*D2R);
  A(R&&F.ok&&!sk.dims.some(d=>d.type==='angle'),'250° : forme juste, pas de cote d’angle');
  A(skASlotCreate(neuve(),'arc',{cx:0,cy:0,R:5,w:5,a1:0,sw:1},{})===null,'largeur ≥ rayon : refusé');
  // 4. saisie à la souris : arc par centre, tourné dans le sens horaire puis largeur
  const souris=(mode,clics,moves)=>{
    sk=neuve();skEdit=sk;skSlot.mode=mode;skDown=null;skDraft=null;
    skASlotStart(sk,clics[0][0],clics[0][1]);
    for(let k=1;k<clics.length;k++){
      (moves[k]||[]).forEach(m=>skASlotMove(sk,m[0],m[1]));
      skASlotMove(sk,clics[k][0],clics[k][1]);skASlotUp(sk,clics[k][0],clics[k][1]);
    }
    return sk;
  };
  const el=$('skSnap');if(el)el.checked=false;
  sk=souris('arcC',[[0,0],[30,0],[0,-30],[0,-34]],{3:[[25,-15],[15,-25]]});
  F=formeArc(sk,30,4,Math.PI/2);
  A(F.ok,'souris, arc par centre tourné en sens horaire : arc de −90° à 0°, largeur 8');
  A(skDown===null&&skDraft===null,'saisie terminée');
  sk=souris('arc3',[[-20,0],[20,0],[0,20],[0,23]],{});
  F=formeArc(sk,20,3,Math.PI);
  A(F.ok,'souris, arc 3 points : demi-cercle R20, largeur 6');
  sk=souris('secteur',[[0,0],[10.004,0],[0,10],[0,25]],{3:[[8,6],[5,8]]});
  F=formeSect(sk,10,25,Math.PI/2);
  A(F.ok,'souris, secteur : R10 à R25, 90° (rayon arrondi au centième)');
  skEdit=null;
  return{fails,log};
})()`,ctx);
console.log('=== Oblong en arc et secteur ===');
r.log.forEach(m=>console.log('  ✓ '+m));r.fails.forEach(m=>console.log('  ✗ '+m));
console.log(r.fails.length?'\n*** '+r.fails.length+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
process.exit(r.fails.length?1:0);
