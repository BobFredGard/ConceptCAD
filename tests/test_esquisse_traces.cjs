// 2026-11-06 : ESQUISSE — les modes du bandeau : rectangle en biais, cercle par 2 ou 3 points, cercle tangent
// à 2 ou 3 traits, arc par 3 points, arc tangent. Aucun « Fixe », cote seulement si la forme n'est pas déjà tenue.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
const {ctx}=loadApp();
const r=vm.runInContext(`(function(){
  const fails=[],log=[];const A=(c,m)=>{if(!c)fails.push(m);else log.push(m);};
  const near=(a,b,t)=>Math.abs(a-b)<(t||1e-3);
  const neuve=()=>{const sk={id:'s',name:'E',plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],seq:1,visible:true,points:{},entities:[],constraints:[],dims:[]};doc.sketches=[sk];doc.features=[];return sk;};
  const fixes=sk=>sk.constraints.filter(c=>c.type==='fix').length;
  const V=(x,y)=>({x,y});
  const pt=(sk,x,y)=>({x,y,pid:addPoint(sk,x,y)});
  // une droite tenue en place : ses bouts sont fixés, comme une géométrie de référence
  const droite=(sk,x1,y1,x2,y2)=>{const a=addPoint(sk,x1,y1),b=addPoint(sk,x2,y2),e={id:skNewEid(sk),t:'line',p1:a,p2:b};
    sk.entities.push(e);sk.constraints.push({id:skNewEid(sk),type:'fix',p:a},{id:skNewEid(sk),type:'fix',p:b});return e;};
  const cercle=(sk,x,y,R)=>{const c=addPoint(sk,x,y),e={id:skNewEid(sk),t:'circle',pc:c,r:R};sk.entities.push(e);
    sk.constraints.push({id:skNewEid(sk),type:'fix',p:c});sk.dims.push({id:skNewEid(sk),type:'radius',ent:e.id,value:R});return e;};
  const distL=(sk,l,C)=>{const a=sk.points[l.p1],b=sk.points[l.p2],L=Math.hypot(b.x-a.x,b.y-a.y);return Math.abs((C.x-a.x)*(a.y-b.y)+(C.y-a.y)*(b.x-a.x))/L;};
  const surArc=(sk,e)=>[e.pa,e.pb].every(p=>near(Math.hypot(sk.points[p].x-sk.points[e.pc].x,sk.points[p].y-sk.points[e.pc].y),e.r));
  // ---------- rectangle en biais
  let sk=neuve();
  let R=skRect3Create(sk,V(10,10),V(40,50),20);
  A(R&&R.lines.length===4&&fixes(sk)===0,'biais : 4 côtés, aucun fixe');
  solveSketch(sk,200);
  const seg=l=>[sk.points[l.p2].x-sk.points[l.p1].x,sk.points[l.p2].y-sk.points[l.p1].y];
  let[u,v]=[seg(R.lines[0]),seg(R.lines[1])];
  A(near(u[0]*v[0]+u[1]*v[1],0,1e-2)&&near(Math.hypot(...u),50)&&near(Math.hypot(...v),20),'biais : angle droit, 50 × 20');
  A(R.dims.length===2&&R.dims.some(d=>near(d.value,50))&&R.dims.some(d=>near(d.value,20)),'biais : 2 cotes posées');
  A(!sk.constraints.some(c=>c.type==='h'||c.type==='v'),'biais : ni H ni V');
  let D=skDofInfo(sk);A(D.dof===3,'biais : position + rotation (3 DDL) — dof='+D.dof);
  R.dims.find(d=>near(d.value,20)).value=35;solveSketch(sk,200);
  [u,v]=[seg(R.lines[0]),seg(R.lines[1])];
  A(near(Math.hypot(...v),35)&&near(u[0]*v[0]+u[1]*v[1],0,1e-2),'biais : la largeur pilote, la forme reste droite');
  sk=neuve();R=skRect3Create(sk,V(5,5),V(45,5),-12);
  A(sk.constraints.filter(c=>c.type==='h').length===2&&sk.constraints.filter(c=>c.type==='v').length===2,'3 points à plat : H et V');
  D=skDofInfo(sk);A(D.dof===2,'à plat : reste la position (2 DDL) — dof='+D.dof);
  // ---------- cercle par 2 points
  sk=neuve();R=skCercle2Pts(sk,V(10,10),V(30.004,10));
  A(near(R.circle.r,10)&&near(sk.points[R.circle.pc].x,20,0.01)&&R.dims.length===1&&near(R.dims[0].value,20),'2 points vides : Ø20 coté, centre au milieu');
  A(Object.keys(sk.points).filter(p=>p!==SK_ORIGIN).length===1,'2 points vides : aucun point oublié dans le vide');
  D=skDofInfo(sk);A(D.dof===2&&fixes(sk)===0,'2 points vides : position libre, aucun fixe — dof='+D.dof);
  sk=neuve();let a=pt(sk,10,10),b=pt(sk,50,40);sk.constraints.push({id:skNewEid(sk),type:'fix',p:a.pid},{id:skNewEid(sk),type:'fix',p:b.pid});
  R=skCercle2Pts(sk,a,b);solveSketch(sk,200);
  A(R.dims.length===0&&near(R.circle.r,25)&&near(sk.points[R.circle.pc].x,30)&&near(sk.points[R.circle.pc].y,25),'2 points existants : vrai diamètre, pas de cote');
  D=skDofInfo(sk);A(D.dof===0,'2 points existants : forme tenue (0 DDL) — dof='+D.dof);
  sk.points[b.pid].x=70;sk.points[b.pid].y=10;solveSketch(sk,300);
  A(near(R.circle.r,30)&&near(sk.points[R.circle.pc].x,40),'le point bouge : le cercle suit');
  // ---------- cercle par 3 points
  sk=neuve();R=skCercle3Pts(sk,V(0.5,0),V(20.5,0),V(10.5,10));
  A(R&&near(R.circle.r,10)&&near(sk.points[R.circle.pc].x,10.5)&&near(sk.points[R.circle.pc].y,0)&&R.dims.length===1,'3 points vides : R10, Ø coté');
  sk=neuve();A(skCercle3Pts(sk,V(0,0),V(10,0),V(20,0))===null&&sk.entities.length===0,'3 points alignés : refusé, rien créé');
  sk=neuve();a=pt(sk,3,0);b=pt(sk,23,0);let c=pt(sk,13,10);[a,b,c].forEach(q=>sk.constraints.push({id:skNewEid(sk),type:'fix',p:q.pid}));
  R=skCercle3Pts(sk,a,b,c);solveSketch(sk,200);
  A(R.dims.length===0&&sk.constraints.filter(k=>k.type==='oncircle').length===3&&near(R.circle.r,10),'3 points existants : posés sur le cercle, pas de cote');
  D=skDofInfo(sk);A(D.dof===0,'3 points existants : tenu (0 DDL) — dof='+D.dof);
  // ---------- calcul des tangences
  sk=neuve();
  let l1=droite(sk,0,0,100,0),l2=droite(sk,0,0,0,100),l3=droite(sk,100,0,0,100);
  let E=[l1,l2,l3].map(e=>skTanElem(sk,e.id));
  let cs=skTanCandidats(E,null);
  A(cs.length===4,'3 droites en triangle : 4 cercles (intérieur + 3 extérieurs), trouvés '+cs.length);
  let S=skTan3Sol(E,[V(30,0),V(0,30),V(50,50)]);
  const rIn=100*100/(100+100+Math.hypot(100,100));
  A(S&&near(S.r,rIn)&&near(S.x,rIn)&&near(S.y,rIn),'clics sur les côtés : le cercle intérieur R'+(S&&S.r.toFixed(2)));
  S=skTan2Sol([E[0],E[1]],15,15);
  A(S&&near(S.r,15,0.02)&&near(S.x,15,0.02)&&near(S.y,15,0.02),'2 droites : le centre suit le curseur');
  S=skTan2Sol([E[0],E[1]],-15,15);
  A(S&&S.x<0&&S.y>0,'2 droites : le cercle suit le curseur de l’autre côté');
  // Apollonius avec 3 cercles : solution connue (3 cercles R1 aux sommets d'un triangle équilatéral)
  let T=[{t:'c',x:0,y:0,R:1},{t:'c',x:4,y:0,R:1},{t:'c',x:2,y:2*Math.sqrt(3),R:1}];
  cs=skTanCandidats(T,null);
  const circ=4/Math.sqrt(3);
  A(cs.some(o=>near(o.r,circ-1)&&near(o.x,2))&&cs.some(o=>near(o.r,circ+1)&&near(o.x,2)),'3 cercles : petit dehors et grand qui les contient');
  // ---------- cercle tangent, et le solveur tient
  sk=neuve();l1=droite(sk,0,0,100,0);l2=droite(sk,0,0,0,100);
  S=skTan2Sol([l1,l2].map(e=>skTanElem(sk,e.id)),20,20);
  R=skCercleTangent(sk,[l1.id,l2.id],S);
  A(sk.constraints.filter(k=>k.type==='tangent').length===2&&R.dims.length===1&&near(R.dims[0].value,40,0.03),'tangent à 2 droites : 2 tangences + Ø coté');
  D=skDofInfo(sk);A(D.dof===0,'droites tenues + Ø : tenu (0 DDL) — dof='+D.dof);
  R.dims[0].value=60;solveSketch(sk,300);
  let C=sk.points[R.circle.pc];
  A(near(R.circle.r,30)&&near(C.x,30,1e-2)&&near(C.y,30,1e-2),'Ø 60 : reste tangent aux 2 droites, dans le coin');
  sk=neuve();l1=droite(sk,0,0,100,0);l2=droite(sk,0,0,0,100);l3=droite(sk,100,0,0,100);
  E=[l1,l2,l3].map(e=>skTanElem(sk,e.id));
  S=skTan3Sol(E,[V(30,0),V(0,30),V(50,50)]);
  R=skCercleTangent(sk,[l1.id,l2.id,l3.id],S);solveSketch(sk,300);C=sk.points[R.circle.pc];
  A(R.dims.length===0&&near(R.circle.r,rIn,1e-2)&&near(C.x,rIn,1e-2),'tangent à 3 droites : pas de cote, cercle intérieur stable');
  D=skDofInfo(sk);A(D.dof===0,'3 tangences : tenu (0 DDL) — dof='+D.dof);
  // parallèles : la taille est imposée, pas de cote
  sk=neuve();l1=droite(sk,0,0,100,0);l2=droite(sk,0,20,100,20);
  S=skTan2Sol([l1,l2].map(e=>skTanElem(sk,e.id)),40,5);
  A(S&&near(S.r,10)&&near(S.y,10)&&near(S.x,40)&&S.tenu,'2 parallèles : R10 imposé, le cercle glisse');
  R=skCercleTangent(sk,[l1.id,l2.id],S);solveSketch(sk,300);C=sk.points[R.circle.pc];
  A(R.dims.length===0&&near(R.circle.r,10,1e-2)&&near(C.y,10,1e-2),'2 parallèles : pas de cote, reste entre les 2');
  D=skDofInfo(sk);A(D.dof===1,'2 parallèles : reste le glissement (1 DDL) — dof='+D.dof);
  // sens opposés des 2 droites : même résultat
  sk=neuve();l1=droite(sk,0,0,100,0);l2=droite(sk,100,20,0,20);
  S=skTan2Sol([l1,l2].map(e=>skTanElem(sk,e.id)),40,5);
  A(S&&near(S.r,10)&&near(S.y,10)&&S.tenu,'2 parallèles tracées en sens opposés : pareil');
  // droite + cercle : dehors
  sk=neuve();l1=droite(sk,0,0,100,0);let k1=cercle(sk,50,30,10);
  E=[l1,k1].map(e=>skTanElem(sk,e.id));
  S=skTan2Sol(E,20,10);
  R=skCercleTangent(sk,[l1.id,k1.id],S);solveSketch(sk,300);C=sk.points[R.circle.pc];
  A(near(distL(sk,l1,C),R.circle.r,1e-2)&&near(Math.hypot(C.x-50,C.y-30),10+R.circle.r,1e-2),'droite + cercle : dehors, tangent aux 2 après résolution');
  A(!sk.constraints.some(k=>k.type==='tangent2'&&k.inner),'dehors : tangence extérieure');
  // cercle dans un cercle : tangence intérieure
  sk=neuve();let g=cercle(sk,50,50,40),l=droite(sk,0,50,100,50);
  E=[g,l].map(e=>skTanElem(sk,e.id));
  S=skTan2Sol(E,70,65);
  R=skCercleTangent(sk,[g.id,l.id],S);solveSketch(sk,300);C=sk.points[R.circle.pc];
  const k2=sk.constraints.find(k=>k.type==='tangent2');
  A(k2&&k2.inner===true,'cercle dedans : tangence intérieure mémorisée');
  A(near(Math.hypot(C.x-50,C.y-50),40-R.circle.r,1e-2)&&near(distL(sk,l,C),R.circle.r,1e-2),'cercle dedans : tangent, et le reste après résolution');
  let dd=skDofInfo(sk);A(dd.dof===0,'cercle dedans : tenu (0 DDL) — dof='+dd.dof);
  R.dims[0].value=+(2*R.circle.r+6).toFixed(2);solveSketch(sk,300);C=sk.points[R.circle.pc];
  A(near(Math.hypot(C.x-50,C.y-50),40-R.circle.r,1e-2),'cercle dedans : la cote change, il reste dedans et tangent');
  // ---------- arc par 3 points
  sk=neuve();R=skArc3Pts(sk,V(5,0),V(25,0),V(15,10));
  A(R&&near(R.arc.r,10)&&surArc(sk,R.arc),'arc 3 points : R10');
  let an=arcAngles(sk,R.arc);let P=sk.points[R.arc.pc];
  A(angInArc(Math.atan2(10-P.y,15-P.x),an.a1,an.a2),'arc 3 points : passe par le point cliqué (au-dessus)');
  sk=neuve();R=skArc3Pts(sk,V(5,0),V(25,0),V(15,-10));an=arcAngles(sk,R.arc);P=sk.points[R.arc.pc];
  A(angInArc(Math.atan2(-10-P.y,15-P.x),an.a1,an.a2),'arc 3 points : passe par le point cliqué (au-dessous)');
  D=skDofInfo(sk);A(D.dof===4&&fixes(sk)===0,'arc 3 points : R coté, le reste libre, aucun fixe — dof='+D.dof);
  sk=neuve();A(skArc3Pts(sk,V(0,0),V(20,0),V(10,0))===null&&sk.entities.length===0,'arc : points alignés refusés, rien créé');
  sk=neuve();a=pt(sk,5,0);b=pt(sk,25,0);R=skArc3Pts(sk,a,b,V(15,10));
  A(R.arc.pa===a.pid||R.arc.pb===a.pid,'arc : réutilise les points cliqués');
  // ---------- arc tangent
  const ligneTan=(sk,x1,y1,x2,y2)=>{const q=droite(sk,x1,y1,x2,y2);return q;};
  sk=neuve();l=ligneTan(sk,0,0,40,0);
  let bt=skTrBout(sk,40.2,0.1);
  A(bt&&bt.ent===l.id&&near(bt.tx,1)&&near(bt.ty,0),'bout de ligne : part dans son prolongement');
  A(skArcTanGeom(bt,V(80,0))===null,'dans le prolongement : refusé');
  R=skArcTangent(sk,bt,V(40,20));solveSketch(sk,300);
  P=sk.points[R.arc.pc];
  A(near(R.arc.r,10,1e-2)&&near(P.x,40,1e-2)&&near(P.y,10,1e-2),'arc tangent : R10, centre à l’aplomb du bout');
  A(sk.constraints.some(k=>k.type==='tangent'&&k.line===l.id&&k.ent===R.arc.id),'arc tangent : tangence posée');
  A(surArc(sk,R.arc)&&R.arc.pa===bt.pid,'arc tangent : part bien du bout de la ligne');
  D=skDofInfo(sk);A(D.dof===1,'R coté : reste l’angle balayé (1 DDL) — dof='+D.dof);
  R.dims[0].value=15;solveSketch(sk,300);P=sk.points[R.arc.pc];
  A(near(P.x,40,1e-2)&&near(P.y,15,1e-2),'arc tangent : R15, toujours tangent');
  // vers le bas : sens horaire
  sk=neuve();l=ligneTan(sk,0,0,40,0);bt=skTrBout(sk,40,0);
  R=skArcTangent(sk,bt,V(40,-20));solveSketch(sk,300);P=sk.points[R.arc.pc];
  A(near(P.y,-10,1e-2)&&R.arc.pb===bt.pid,'arc tangent vers le bas : centre dessous, bouts dans le bon ordre');
  // arc qui prolonge un arc (même sens de courbure = intérieur ; courbure opposée = extérieur)
  sk=neuve();const c0=addPoint(sk,0,0),p0=addPoint(sk,10,0),p1=addPoint(sk,0,10);
  const arc0={id:skNewEid(sk),t:'arc',pc:c0,pa:p0,pb:p1,r:10};sk.entities.push(arc0);
  [c0,p0,p1].forEach(p=>sk.constraints.push({id:skNewEid(sk),type:'fix',p}));
  bt=skTrBout(sk,0,10);
  A(bt&&near(bt.tx,-1)&&near(bt.ty,0),'bout d’arc : part dans le sens de l’arc');
  R=skArcTangent(sk,bt,V(-10,30));solveSketch(sk,300);P=sk.points[R.arc.pc];
  let kk=sk.constraints.find(k=>k.type==='tangent2');
  A(kk&&!kk.inner&&near(Math.hypot(P.x,P.y),10+R.arc.r,1e-2),'courbure opposée : tangence extérieure');
  sk=neuve();const c3=addPoint(sk,0,0),p3=addPoint(sk,10,0),p4=addPoint(sk,0,10);
  const arc1={id:skNewEid(sk),t:'arc',pc:c3,pa:p3,pb:p4,r:10};sk.entities.push(arc1);
  [c3,p3,p4].forEach(p=>sk.constraints.push({id:skNewEid(sk),type:'fix',p}));
  bt=skTrBout(sk,0,10);
  R=skArcTangent(sk,bt,V(-20,-5));solveSketch(sk,300);P=sk.points[R.arc.pc];
  kk=sk.constraints.find(k=>k.type==='tangent2');
  A(kk&&kk.inner===true&&near(Math.hypot(P.x,P.y),Math.abs(R.arc.r-10),1e-2),'même courbure : tangence intérieure');
  D=skDofInfo(sk);A(D.dof===1,'bout d’arc + R coté : 1 DDL, comme avec une ligne — dof='+D.dof);
  // arc tangent à 2 traits : le coin arrondi, sans toucher aux traits
  sk=neuve();l1=droite(sk,0,0,100,0);l2=droite(sk,0,0,0,100);
  S=skTan2Sol([l1,l2].map(e=>skTanElem(sk,e.id)),15,15);
  R=skArcTangent2(sk,[l1.id,l2.id],S);solveSketch(sk,300);P=sk.points[R.arc.pc];
  A(near(R.arc.r,15,0.02)&&near(P.x,15,0.02)&&near(P.y,15,0.02)&&surArc(sk,R.arc),'2 droites : arc R15 dans le coin');
  let qa=sk.points[R.arc.pa],qb=sk.points[R.arc.pb];
  A((near(qa.y,0,1e-2)&&near(qb.x,0,1e-2))||(near(qa.x,0,1e-2)&&near(qb.y,0,1e-2)),'2 droites : un bout sur chaque droite');
  let am=arcAngles(sk,R.arc);let dl=(am.a2-am.a1+2*Math.PI)%(2*Math.PI);
  A(near(dl,Math.PI/2,1e-2),'2 droites : le morceau du coin, pas le grand tour');
  A(R.dims.length===1&&sk.constraints.filter(k=>k.type==='online').length===2,'2 droites : R coté, bouts posés sur les droites');
  D=skDofInfo(sk);A(D.dof===0,'droites tenues + R : tenu (0 DDL) — dof='+D.dof);
  R.dims[0].value=25;solveSketch(sk,300);P=sk.points[R.arc.pc];
  A(near(P.x,25,1e-2)&&near(P.y,25,1e-2)&&surArc(sk,R.arc),'R25 : reste tangent aux 2 droites');
  // droite et cercle
  sk=neuve();l1=droite(sk,0,0,100,0);k1=cercle(sk,50,30,10);
  S=skTan2Sol([l1,k1].map(e=>skTanElem(sk,e.id)),20,10);
  R=skArcTangent2(sk,[l1.id,k1.id],S);solveSketch(sk,300);P=sk.points[R.arc.pc];
  A(R&&near(distL(sk,l1,P),R.arc.r,1e-2)&&near(Math.hypot(P.x-50,P.y-30),10+R.arc.r,1e-2)&&surArc(sk,R.arc),'droite + cercle : arc tangent aux 2');
  D=skDofInfo(sk);A(D.dof===0,'droite + cercle + R : tenu (0 DDL) — dof='+D.dof);
  // zone d'un contour avec un arc creux : l'arc parcouru à rebours ne doit pas ajouter le reste de son cercle
  sk=neuve();{
    const p=[[0,0],[40,0],[40,20],[0,20]].map(q=>addPoint(sk,q[0],q[1]));
    [[0,1],[1,2],[3,0]].forEach(([i,j])=>sk.entities.push({id:skNewEid(sk),t:'line',p1:p[i],p2:p[j]}));
    const pc=addPoint(sk,20,30),rr=Math.hypot(20,10);
    sk.entities.push({id:skNewEid(sk),t:'arc',pc,pa:p[3],pb:p[2],r:rr}); // de (0,20) à (40,20), en passant par le bas : le creux
    const rg=skRegions(sk);
    const th=2*Math.atan2(20,10),seg=rr*rr/2*(th-Math.sin(th)),aire=800-seg;
    A(rg.length===1,'arc creux : une seule zone ('+rg.length+')');
    A(rg.length&&Math.abs(rg[0].area-aire)<aire*0.03,'arc creux : la bonne aire, '+aire.toFixed(1)+' ('+(rg[0]&&rg[0].area.toFixed(1))+')');
    A(rg.length&&rg[0].ring.every(q=>q[1]<20.01&&q[1]>-0.01),'arc creux : la zone reste dans le contour, pas de disque');
    const tr=skLoopTrace(sk);
    A(tr.solids.length===1,'arc creux : un seul solide à extruder');
  }
  // clic sur le corps du trait : son bout le plus proche
  sk=neuve();l=ligneTan(sk,0,0,40,0);
  bt=skTrBout(sk,30,0.2);A(bt&&bt.pid===l.p2&&near(bt.tx,1),'corps de ligne, côté droit : bout droit');
  bt=skTrBout(sk,10,0.2);A(bt&&bt.pid===l.p1&&near(bt.tx,-1),'corps de ligne, côté gauche : bout gauche');
  A(skTrBout(sk,20,30)===null,'dans le vide : rien');
  // départ sur un cercle : pas de bout, le point cliqué ; la direction suit l'arrivée
  sk=neuve();let kc=cercle(sk,50,50,20);
  bt=skTrBout(sk,70.3,50);
  A(bt&&bt.cercle&&near(bt.x,70)&&near(bt.y,50),'cercle : part du point cliqué, posé sur le tour');
  R=skArcTangent(sk,bt,V(90,70));solveSketch(sk,300);P=sk.points[R.arc.pc];
  kk=sk.constraints.find(k=>k.type==='tangent2');
  A(kk&&sk.constraints.some(k=>k.type==='oncircle'&&k.ent===kc.id)&&near(Math.hypot(P.x-50,P.y-50),20+R.arc.r,1e-2),'cercle : arc dehors, tangent, bout sur le cercle');
  D=skDofInfo(sk);A(D.dof===2,'cercle + R coté : glissement et balayage (2 DDL) — dof='+D.dof);
  sk=neuve();kc=cercle(sk,50,50,20);bt=skTrBout(sk,70.3,50);
  R=skArcTangent(sk,bt,V(90,30));solveSketch(sk,300);P=sk.points[R.arc.pc];
  A(near(P.x,90,1e-2)&&near(P.y,50,1e-2)&&near(R.arc.r,20,1e-2)&&surArc(sk,R.arc)&&sk.points[R.arc.pb].y<50,'cercle : vers le bas aussi');
  return{fails,log};
})()`,ctx);
console.log('=== Modes du bandeau : rectangle, cercle, arc ===');
r.log.forEach(m=>console.log('  ✓ '+m));r.fails.forEach(m=>console.log('  ✗ '+m));
console.log(r.fails.length?'\n*** '+r.fails.length+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');
process.exit(r.fails.length?1:0);
