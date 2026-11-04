// Projeter dans une esquisse les points, lignes et courbes d'une AUTRE esquisse (50-esquisse-8) et
// traits d'esquisse épais en 3D (30-traits-esquisse-3d). Couvert :
//  1) plans parallèles (décalés, retournés) : ligne, cercle, arc, spline, point ; construction + fixe ;
//  2) plan incliné : le cercle devient une ellipse (spline), vu par la tranche : non proposé ;
//  3) suivi : la source bouge, la projetée suit, chaîne A→B→C en une passe ;
//  4) source supprimée : figée + avertissement ; plus d'entité : plus d'avertissement ;
//  5) pas de boucle : une esquisse qui dépend de la cible n'est pas proposée ;
//  6) sauvegarde : le lien survit au JSON ; 7) antériorité ; 8) rubans des traits épais.
// Harnais : DOM/THREE stubbés, aucun noyau OCCT requis.
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
const {ctx,loadErr}=loadApp();
if(loadErr)console.log('  (harnais : buildScene interrompu — comportement normal du stub)');
const body=String.raw`
const out={fails:[],ok:0};
const A=(c,m)=>{if(c)out.ok++;else out.fails.push(m);};
const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);
const mk=(id,plane)=>{const s=Object.assign({id,name:'Esquisse '+id,visible:true,seq:1,entities:[],points:{},constraints:[],dims:[]},plane);ensureSketchBasis(s);return s;};
const XY=z=>({plane:'FACE',origin:[0,0,z||0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1]});
const XYr=z=>({plane:'FACE',origin:[0,0,z||0],axU:[1,0,0],axV:[0,-1,0],axN:[0,0,-1]}); // plan retourné
const XZ=()=>({plane:'FACE',origin:[0,0,0],axU:[1,0,0],axV:[0,0,1],axN:[0,-1,0]});
const INCL=()=>{const c=Math.SQRT1_2;return{plane:'FACE',origin:[0,0,0],axU:[c,0,c],axV:[0,1,0],axN:[-c,0,c]};};
const pt=(s,x,y)=>addPoint(s,x,y);
const line=(s,x1,y1,x2,y2)=>{const e={id:skNewEid(s),t:'line',p1:pt(s,x1,y1),p2:pt(s,x2,y2)};s.entities.push(e);return e;};
const circle=(s,x,y,r)=>{const e={id:skNewEid(s),t:'circle',pc:pt(s,x,y),r};s.entities.push(e);return e;};
const arc=(s,x,y,r,a1,a2)=>{const e={id:skNewEid(s),t:'arc',pc:pt(s,x,y),pa:pt(s,x+r*Math.cos(a1),y+r*Math.sin(a1)),pb:pt(s,x+r*Math.cos(a2),y+r*Math.sin(a2)),r};s.entities.push(e);return e;};
const spline=(s,Q)=>{const e={id:skNewEid(s),t:'spline',pts:Q.map(q=>pt(s,q[0],q[1]))};s.entities.push(e);return e;};
const cpoint=(s,x,y)=>{const e={id:skNewEid(s),t:'cpoint',p:pt(s,x,y)};s.entities.push(e);return e;};
const proj=(T,x,y)=>{const pr=skpHit(T,x,y);if(!pr)return null;return entById(T,skpCreer(T,pr));};
window.alert=function(){};window.confirm=function(){return true;};
SK_PT=1;SK_PICK=0.8; // tolérances (mm), normalement dérivées du zoom

// ── 1. plans parallèles ──
{
  const S=mk('S',XY(25)),T=mk('T',XY(0));
  line(S,0,0,40,0);circle(S,100,100,10);arc(S,-50,0,10,0,Math.PI/2);cpoint(S,70,-30);
  spline(S,[[0,50],[20,70],[40,50],[60,70]]);
  doc.sketches=[S,T];doc.features=[];_skpCache=null;
  const L=proj(T,20,0);
  A(L&&L.t==='line'&&L.construction&&L.proj&&L.skSrc.sk==='S','ligne projetée, en construction, liée');
  A(L&&near(T.points[L.p1].x,0)&&near(T.points[L.p2].x,40),'ligne au bon endroit');
  A(L&&skFixed(T).has(L.p1)&&skFixed(T).has(L.p2),'ligne fixe');
  const C=proj(T,110,100);
  A(C&&C.t==='circle'&&near(C.r,10)&&near(T.points[C.pc].x,100),'cercle : reste un cercle, même rayon');
  const Ar=proj(T,-50+10*Math.SQRT1_2,10*Math.SQRT1_2);
  A(Ar&&Ar.t==='arc'&&near(Ar.r,10),'arc : reste un arc');
  const Pt=proj(T,70,-30);
  A(Pt&&Pt.t==='cpoint'&&Pt.proj&&Pt.skSrc.pt&&near(T.points[Pt.p].x,70)&&near(T.points[Pt.p].y,-30),'point projeté');
  const fin=proj(T,40,0);
  A(fin&&fin.t==='cpoint','le bout d’une ligne se désigne comme un point');
  const pc=skpHit(T,100,100);A(pc&&pc.type==='point','le centre du cercle se désigne comme un point');
  const hit=skpHit(T,20,70);
  const Sp=proj(T,20,70);
  A(hit&&hit.type==='point'&&Sp&&Sp.t==='cpoint','point de passage de la spline désignable');
  const sc=S.entities.find(e=>e.t==='spline'),pl=skSplinePoly(S,sc),mi=pl[Math.floor(pl.length*0.42)];
  const Cv=proj(T,mi[0],mi[1]);
  A(Cv&&Cv.t==='spline'&&Cv.proj&&Cv.construction&&Cv.pts.length>=24,'courbe : spline de construction');
  if(Cv){const P2=skSplinePoly(T,Cv);let m=0;pl.forEach(q=>{let d=1e9;P2.forEach(r=>{d=Math.min(d,Math.hypot(q[0]-r[0],q[1]-r[1]));});m=Math.max(m,d);});A(m<0.15,'courbe fidèle à la source (écart '+m.toFixed(3)+' mm)');}
  A(skpExistante(T,skpHit(T,20,0))===L,'une ligne déjà projetée est reconnue');
  A(!skpHit(T,300,300),'rien sous le curseur');
  // retourné : l'arc garde le bon côté
  const R=mk('R',XYr(5));doc.sketches=[S,R];_skpCache=null;
  const Ar2=proj(R,-50+10*Math.SQRT1_2,-10*Math.SQRT1_2);
  A(Ar2&&Ar2.t==='arc','plan retourné : arc conservé');
  if(Ar2){const an=arcAngles(R,Ar2);const md=(an.a1+an.a2)/2,C2=R.points[Ar2.pc];
    A(Math.cos(md)>0&&Math.sin(md)<0&&near(C2.x,-50)&&near(C2.y,0),'plan retourné : l’arc reste du bon côté, pas son complément');}
}
// ── 2. plan incliné / vu par la tranche ──
{
  const S=mk('S',XY(0)),T=mk('T',INCL()),V=mk('V',XZ());
  const cc=circle(S,0,0,20);const lv=line(S,-30,-30,-30,30);cpoint(S,60,60);
  doc.sketches=[S,T,V];doc.features=[];_skpCache=null;
  // dans T : x' = x·cos45, y' = y
  const E=proj(T,20*Math.SQRT1_2,0);
  A(E&&E.t==='spline'&&E.closed,'plan incliné : le cercle devient une ellipse fermée');
  if(E){const xs=E.pts.map(p=>T.points[p].x),ys=E.pts.map(p=>T.points[p].y);
    A(near(Math.max(...xs),20*Math.SQRT1_2,0.05)&&near(Math.max(...ys),20,0.05),'ellipse aux bons demi-axes');}
  _skpCache=null;
  const it=skpItems(V).find(i=>i.S===S);
  A(it&&!it.ents.some(c=>c.e===cc),'vu par la tranche : cercle non proposé');
  A(it&&!it.ents.some(c=>c.e===lv),'vue par la tranche : ligne ⟂ au plan non proposée');
  A(it&&it.pts.length>=3,'…mais ses points le restent');
  A(!skpForme(S,lv,skpPlan(S,V)),'ligne réduite à un point : aucune forme');
}
// ── 3. suivi, chaîne ──
{
  const A0=mk('A',XY(0)),B=mk('B',XY(10)),C=mk('C',XY(20));
  const la=line(A0,0,0,30,0);const pa=cpoint(A0,5,5);const ca=circle(A0,50,0,8);const sa=spline(A0,[[0,20],[10,30],[20,20],[30,30]]);
  // ordre volontairement défavorable : C (dépend de B) est listée avant
  doc.sketches=[C,B,A0];doc.features=[];_skpCache=null;
  const lb=proj(B,15,0),pb=proj(B,5,5),cb=proj(B,58,0);
  const plA=skSplinePoly(A0,sa),m0=plA[Math.floor(plA.length*0.42)];
  const sb=proj(B,m0[0],m0[1]);
  _skpCache=null;
  const lc=proj(C,15,0);
  A(lb&&pb&&cb&&sb&&lc,'chaîne créée');
  A(lc&&lc.skSrc,'C reprend la ligne');
  A0.points[la.p2].x=60;A0.points[pa.p].x=-7;A0.points[ca.pc].y=12;ca.r=9;A0.points[sa.pts[3]].y=44;
  const ch=projPreUpdate();
  A(ch===true,'une source qui bouge est signalée, même sans noyau');
  A(near(B.points[lb.p2].x,60),'la ligne projetée suit');
  A(near(C.points[lc.p2].x,60),'la chaîne A→B→C suit en une passe');
  A(near(B.points[pb.p].x,-7),'le point projeté suit');
  A(near(B.points[cb.pc].y,12)&&near(cb.r,9),'le cercle projeté suit (centre et rayon)');
  const fin=B.points[sb.pts[sb.pts.length-1]];
  A(near(fin.y,44,1e-3),'la courbe projetée suit');
  A(projPreUpdate()===false,'stable : une 2e passe ne change rien');
}
// ── 4. source perdue ──
{
  const S=mk('S',XY(0)),T=mk('T',XY(5));line(S,0,0,10,0);
  doc.sketches=[S,T];doc.features=[];_skpCache=null;
  const e=proj(T,5,0);const x2=T.points[e.p2].x;
  S.entities=[];
  A(projPreUpdate()===false,'élément supprimé : rien ne bouge');
  A([...NOMS_PERTES_ESQ.values()].some(m=>/n’existe plus/.test(m)),'élément supprimé : avertissement');
  doc.sketches=[T];projPreUpdate();
  A(near(T.points[e.p2].x,x2),'esquisse supprimée : la projetée reste à sa place');
  A([...NOMS_PERTES_ESQ.values()].some(m=>/esquisse source/.test(m)),'esquisse supprimée : avertissement');
  T.entities=T.entities.filter(q=>q!==e);projPreUpdate();
  A(![...NOMS_PERTES_ESQ.keys()].some(k=>String(k).startsWith('skp:')),'projetée effacée : plus d’avertissement');
}
// ── 5. pas de boucle ; sources masquées non proposées ──
{
  const X=mk('X',XY(0)),Y=mk('Y',XY(5)),Z=mk('Z',XY(9)),H=mk('H',XY(1));
  line(X,0,0,10,0);line(H,0,20,10,20);H.visible=false;
  doc.sketches=[X,Y,Z,H];doc.features=[];_skpCache=null;
  proj(Y,5,0);_skpCache=null; // Y ← X
  const ly=skpHit(Z,5,0);A(ly&&(ly.skSrc.sk==='X'||ly.skSrc.sk==='Y'),'Z peut reprendre X ou Y');
  proj(Z,5,0);_skpCache=null; // Z ← …
  A(!skpItems(X).some(i=>i.S.id==='Y'||i.S.id==='Z'),'X ne peut pas reprendre ce qui dépend d’elle');
  A(!skpItems(X).some(i=>i.S.id==='H'),'une esquisse masquée n’est pas proposée');
  A(!skpItems(X).some(i=>i.S.id==='X'),'une esquisse ne se projette pas en elle-même');
}
// ── 6. sauvegarde ──
{
  const S=mk('S',XY(0)),T=mk('T',XY(5));const l=line(S,0,0,10,0);
  doc.sketches=[S,T];doc.features=[];_skpCache=null;
  const e=proj(T,5,0);
  const T2=JSON.parse(JSON.stringify(T)),S2=JSON.parse(JSON.stringify(S));
  doc.sketches=[S2,T2];S2.points[l.p2].x=33;projPreUpdate();
  A(near(T2.points[e.p2].x,33),'le lien survit à l’enregistrement');
}
// ── 7. antériorité ──
{
  const S=Object.assign(mk('S',XY(0)),{host:{feat:'f1'}}),T=mk('T',XY(5));line(S,0,0,10,0);
  doc.sketches=[S,T];_skpCache=null;proj(T,5,0);
  const F1={id:'f1',type:'extrude',name:'Base',sketchId:'zz'},F2={id:'f2',type:'extrude',name:'Suite',sketchId:'T'};
  doc.features=[F2,F1];
  A(antViolations(doc.features).some(v=>v.f===F2&&v.dep===F1),'la fonction doit suivre la face de l’esquisse source');
  A(!antViolations([F1,F2]).length,'dans le bon ordre : aucun défaut');
}
// ── 8. rubans ──
{
  const R=sk3dRubans([[{x:0,y:0,z:0},{x:3,y:4,z:0},{x:3,y:4,z:12}],[{x:1,y:1,z:1}]]);
  A(R.sommets===12,'6 sommets par segment');
  A(R.pos.length===36&&R.coin.length===24&&R.dist.length===12,'attributs dimensionnés');
  A(R.dist[0]===0&&R.dist[2]===5&&R.dist[6]===5&&R.dist[8]===17,'distance cumulée le long de la polyligne');
  A(R.pos[6]===3&&R.pos[7]===4&&R.aut[6]===0&&R.aut[7]===0,'chaque sommet connaît l’autre bout');
  const c=[...R.coin].slice(0,12);A(JSON.stringify(c)===JSON.stringify([0,1,0,-1,1,1,0,1,1,1,1,-1]),'les deux triangles couvrent le ruban');
  A(sk3dRubans([]).sommets===0,'rien à tracer');
}
return out;`;
const r=vm.runInContext('(function(){'+body+'})()',ctx);
console.log('=== projection d’une esquisse dans une autre + traits épais ===');
console.log('  '+r.ok+' contrôles réussis');
r.fails.forEach(m=>console.log('  ✗ '+m));
if(r.fails.length){console.log('ÉCHEC : '+r.fails.length);process.exit(1);}
console.log('OK');
