/* ---------- Esquisse : un seul bandeau de choix pour l'oblong, le rectangle, le cercle et l'arc ----------
   2026-11-06 : Fred aime le petit menu en haut à gauche de l'oblong et demande le même pour :
   - Rectangle : 2 coins · Centre et coin · 3 points (en biais)
   - Cercle    : Centre et rayon · 2 points (diamètre) · 3 points · Tangent à 2 ou 3 éléments
   - Arc       : Centre et 2 points · 3 points · Tangent à un trait existant
   Les modes historiques (2 coins, centre et coin, centre et rayon, centre et 2 points) restent dans
   leurs branches de 60-trim-et-souris.js ; les nouveaux modes sont ici.
   Mêmes principes que l'oblong : aucun « Fixe » ; un point cliqué sur une géométrie s'y accroche, un
   point dans le vide reste libre et n'existe que s'il sert au dessin ; une cote n'est posée que si
   la forme n'est pas déjà tenue par ce qu'on a cliqué. */
const SK_TRACE_MODES={
  slot:{titre:'Oblong par',modes:SK_SLOT_MODES},
  rect:{titre:'Rectangle par',modes:[
    ['coins','2 coins','Cliquez 2 coins opposés'],
    ['centre','Centre et coin','Cliquez le centre, puis un coin'],
    ['3pts','3 points','Cliquez les 2 bouts d’un côté, dans n’importe quelle direction, puis la largeur']]},
  circle:{titre:'Cercle par',modes:[
    ['centre','Centre et rayon','Cliquez le centre, puis un point du tour'],
    ['2pts','2 points','Cliquez les 2 bouts d’un diamètre'],
    ['3pts','3 points','Cliquez 3 points du tour'],
    ['tangent','Tangent','Cliquez 2 traits, puis un 3e trait ou le vide pour la taille']]},
  arc:{titre:'Arc par',modes:[
    ['centre','Centre et 2 points','Cliquez le centre, le départ, puis l’arrivée'],
    ['3pts','3 points','Cliquez le départ, l’arrivée, puis un point de passage'],
    ['tangent','Tangent','Cliquez un trait, du côté du bout d’où partir, puis l’arrivée ; ou 2 traits, puis la taille']]}};
const skTraceMode={rect:'coins',circle:'centre',arc:'centre'}; // gardé d'un tracé au suivant (l'oblong garde le sien : skSlot.mode)
const SK_TR_MSG={
  rect:{coins:['Rectangle : cliquez le 1er coin.'],centre:['Rectangle : cliquez le centre.'],
    '3pts':['Rectangle : cliquez le début d’un côté.','Rectangle : cliquez la fin de ce côté.','Rectangle : cliquez pour la largeur.']},
  circle:{centre:['Cercle : cliquez le centre.'],
    '2pts':['Cercle : cliquez le 1er bout du diamètre.','Cercle : cliquez le 2e bout du diamètre.'],
    '3pts':['Cercle : cliquez le 1er point du tour.','Cercle : cliquez le 2e point.','Cercle : cliquez le 3e point.'],
    tangent:['Cercle : cliquez le 1er trait touché.','Cercle : cliquez le 2e trait touché.','Cercle : cliquez un 3e trait, ou dans le vide pour la taille.']},
  arc:{centre:['Arc : cliquez le centre.'],
    '3pts':['Arc : cliquez le départ.','Arc : cliquez l’arrivée.','Arc : cliquez un point de passage.'],
    tangent:['Arc : cliquez un trait, du côté du bout d’où partir (sur un cercle : à l’endroit voulu).','Arc : cliquez l’arrivée, ou un 2e trait à toucher.','Arc : cliquez pour la taille.']}};
function skTraceMsg(tool){
  if(tool==='slot')return SK_SLOT_MSG[skSlot.mode][0];
  return SK_TR_MSG[tool]?SK_TR_MSG[tool][skTraceMode[tool]][0]:'';
}
// le bandeau : un seul, au même endroit, qui ne montre que les choix de l'outil actif
function skModeBarBuild(){
  const host=document.getElementById('skMain');if(!host)return null;
  const b=document.createElement('div');b.id='skModeBar';
  b.style.cssText='position:absolute;left:10px;top:10px;z-index:20;display:flex;gap:6px;align-items:center;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--panel,#1e1e1e);font-size:.8rem';
  host.appendChild(b);
  return b;
}
function skModeSet(tool,k){
  if(tool==='slot'){
    skSlot.mode=k;skModeBarSync();
    if(skEdit&&skDown&&skDown.slot&&skDraft&&skDraft.t==='slot'){skDraft.mode=k;drawSketch2D();}
    else skStatus(SK_SLOT_MSG[k][0]);
    return;
  }
  skTraceMode[tool]=k;
  skDyn=null;skCancelDraft(); // le tracé commencé d'une autre façon est abandonné
  if(skEdit)drawSketch2D();
  skStatus(skTraceMsg(tool));
}
function skModeBarSync(){
  const cfg=skEdit?SK_TRACE_MODES[skTool]:null;
  let b=document.getElementById('skModeBar');
  if(!cfg){if(b)b.style.display='none';return;}
  if(!b)b=skModeBarBuild();
  if(!b)return;
  b.style.display='flex';
  if(b.dataset.tool!==skTool){ // les boutons ne sont refaits qu'au changement d'outil
    b.dataset.tool=skTool;b.textContent='';
    b.appendChild(document.createTextNode(cfg.titre));
    const tool=skTool;
    cfg.modes.forEach(([k,lab,tip])=>{
      const c=document.createElement('button');c.type='button';c.dataset.mode=k;c.textContent=lab;c.title=tip;
      c.addEventListener('click',()=>skModeSet(tool,k));
      b.appendChild(c);
    });
  }
  const cur=skTool==='slot'?skSlot.mode:skTraceMode[skTool];
  b.querySelectorAll('button').forEach(c=>{
    const act=c.dataset.mode===cur;
    c.style.background=act?'var(--accent,#2f7ff0)':'';
    c.style.color=act?'#fff':'';
    c.setAttribute('aria-pressed',act?'true':'false');
  });
}
/* ----- calculs purs ----- */
// cercle par 3 points (null s'ils sont alignés ou confondus)
function skCirc3(a,b,c){
  const ax=b.x-a.x,ay=b.y-a.y,bx=c.x-a.x,by=c.y-a.y;
  const det=2*(ax*by-ay*bx),L=Math.max(ax*ax+ay*ay,bx*bx+by*by);
  if(!(L>1e-12)||Math.abs(det)<1e-6*L)return null;
  const a2=ax*ax+ay*ay,b2=bx*bx+by*by;
  const ux=(by*a2-ay*b2)/det,uy=(ax*b2-bx*a2)/det;
  return{x:a.x+ux,y:a.y+uy,r:Math.hypot(ux,uy)};
}
// un trait vu par la tangence : droite (n·C = d) ou cercle (l'arc compte comme son cercle)
function skTanElem(sk,id){
  const e=entById(sk,id);if(!e)return null;const P=sk.points;
  if(e.t==='line'){
    const A=P[e.p1],B=P[e.p2];if(!A||!B)return null;
    const L=Math.hypot(B.x-A.x,B.y-A.y);if(!(L>1e-9))return null;
    const nx=-(B.y-A.y)/L,ny=(B.x-A.x)/L;
    return{t:'l',id,nx,ny,d:nx*A.x+ny*A.y};
  }
  if(e.t==='circle'||e.t==='arc'){
    const C=P[e.pc];if(!C||!(e.r>0))return null;
    return{t:'c',id,x:C.x,y:C.y,R:e.r};
  }
  return null;
}
/* Tous les cercles tangents à E (3 traits, ou 2 traits et le rayon r0). Inconnues (x,y,r), un signe par
   trait : droite n·C − s·r = d (s : côté) ; cercle |C−O| = |R + s·r| (s=+1 dehors, s=−1 dedans).
   En soustrayant les cercles deux à deux, il reste une droite de l'espace (x,y,r) coupée par une équation
   du 2e degré : méthode unique, droites parallèles comprises. Rend [{x,y,r,s:[…]}]. */
function skTanCandidats(E,r0){
  const out=[],n=E.length;
  for(let m=0;m<(1<<n);m++){
    const s=E.map((_,i)=>(m>>i)&1?-1:1);
    const lin=[];let q=null;
    E.forEach((e,i)=>{
      if(e.t==='l')lin.push([e.nx,e.ny,-s[i],e.d]);
      else if(!q)q={e,s:s[i]};
      else{const O=q.e;
        lin.push([-2*(e.x-O.x),-2*(e.y-O.y),-2*(s[i]*e.R-q.s*O.R),e.R*e.R-O.R*O.R-(e.x*e.x+e.y*e.y)+(O.x*O.x+O.y*O.y)]);}
    });
    if(r0!=null)lin.push([0,0,1,r0]);
    const rows=[];let bad=false;
    lin.forEach(l=>{const k=Math.hypot(l[0],l[1],l[2]);if(k<1e-12)bad=true;else rows.push(l.map(v=>v/k));});
    if(bad||rows.length<2)continue;
    const[n1,n2]=rows;
    const V=[n1[1]*n2[2]-n1[2]*n2[1],n1[2]*n2[0]-n1[0]*n2[2],n1[0]*n2[1]-n1[1]*n2[0]];
    const v2=V[0]*V[0]+V[1]*V[1]+V[2]*V[2];
    if(v2<1e-16)continue;
    const c21=[n2[1]*V[2]-n2[2]*V[1],n2[2]*V[0]-n2[0]*V[2],n2[0]*V[1]-n2[1]*V[0]];
    const c1v=[V[1]*n1[2]-V[2]*n1[1],V[2]*n1[0]-V[0]*n1[2],V[0]*n1[1]-V[1]*n1[0]];
    const P0=[0,1,2].map(i=>(n1[3]*c21[i]+n2[3]*c1v[i])/v2);
    const ts=[];
    if(!q){
      const n3=rows[2];if(!n3)continue;
      const den=n3[0]*V[0]+n3[1]*V[1]+n3[2]*V[2];
      if(Math.abs(den)<1e-12)continue;
      ts.push((n3[3]-n3[0]*P0[0]-n3[1]*P0[1]-n3[2]*P0[2])/den);
    }else{
      const O=q.e,qx=P0[0]-O.x,qy=P0[1]-O.y,g=O.R+q.s*P0[2],gv=q.s*V[2];
      const A=V[0]*V[0]+V[1]*V[1]-gv*gv,B=2*(qx*V[0]+qy*V[1]-g*gv),C=qx*qx+qy*qy-g*g;
      if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)ts.push(-C/B);}
      else{
        let D=B*B-4*A*C;
        if(D<0&&D>-1e-9*Math.max(1,B*B))D=0;
        if(D>=0){const w=Math.sqrt(D);ts.push((-B+w)/(2*A),(-B-w)/(2*A));}
      }
    }
    ts.forEach(t=>{
      const x=P0[0]+t*V[0],y=P0[1]+t*V[1],r=P0[2]+t*V[2];
      if(!(r>1e-6)||!isFinite(x)||!isFinite(y))return;
      const tol=1e-6*(1+r);
      const ok=E.every((e,i)=>e.t==='l'?Math.abs(e.nx*x+e.ny*y-s[i]*r-e.d)<tol:Math.abs(Math.hypot(x-e.x,y-e.y)-Math.abs(e.R+s[i]*r))<tol);
      if(!ok)return;
      if(out.some(o=>Math.hypot(o.x-x,o.y-y)<1e-6&&Math.abs(o.r-r)<1e-6))return;
      out.push({x,y,r,s});
    });
  }
  return out;
}
// point de contact du cercle-solution avec le trait
function skTanPied(e,c){
  if(e.t==='l'){const k=e.nx*c.x+e.ny*c.y-e.d;return{x:c.x-e.nx*k,y:c.y-e.ny*k};}
  const d=Math.hypot(c.x-e.x,c.y-e.y)||1e-9,ux=(c.x-e.x)/d,uy=(c.y-e.y)/d;
  const k=(d<c.r&&c.r>e.R)?-e.R:e.R; // grand cercle-solution qui contient le trait : contact du côté opposé
  return{x:e.x+ux*k,y:e.y+uy*k};
}
function skTanDist(e,x,y){return e.t==='l'?Math.abs(e.nx*x+e.ny*y-e.d):Math.abs(Math.hypot(x-e.x,y-e.y)-e.R);}
/* Cercle tangent à 2 traits : le centre suit le curseur, la taille vient de la distance du curseur aux traits.
   Deux droites parallèles imposent la taille : seul le glissement reste, et pas de cote. */
function skTan2Sol(E,x,y){
  const[a,b]=E;
  if(a.t==='l'&&b.t==='l'&&Math.abs(a.nx*b.ny-a.ny*b.nx)<1e-9){
    const sg=a.nx*b.nx+a.ny*b.ny>0?1:-1,db=sg*b.d;
    const r=Math.abs(a.d-db)/2;if(!(r>1e-6))return null;
    const k=a.nx*x+a.ny*y-(a.d+db)/2;
    const s1=a.d<db?1:-1;
    return{x:x-a.nx*k,y:y-a.ny*k,r,s:[s1,-s1*sg],tenu:true};
  }
  const D=+(skTanDist(a,x,y)+skTanDist(b,x,y)).toFixed(2);
  if(!(D>0))return null;
  // arrondi vers le bas : le cercle juste assez grand pour toucher les 2 traits peut ne plus exister → on remonte d'un cran
  for(let k=0;k<4;k++){
    const c=skTanCandidats(E,(D+k*0.01)/2);
    if(c.length){
      let best=null,bd=Infinity;
      c.forEach(o=>{const q=Math.hypot(o.x-x,o.y-y);if(q<bd){bd=q;best=o;}});
      return best;
    }
  }
  return null;
}
// cercle tangent à 3 traits : parmi les solutions, celle dont les contacts tombent près des clics
function skTan3Sol(E,clics){
  let best=null,bd=Infinity;
  skTanCandidats(E,null).forEach(o=>{
    let q=0;E.forEach((e,i)=>{const f=skTanPied(e,o);q+=Math.hypot(f.x-clics[i].x,f.y-clics[i].y);});
    if(q<bd){bd=q;best=o;}
  });
  return best;
}
// arc qui prolonge un trait : du point P, parti dans la direction T, jusqu'à Q
function skArcTanGeom(b,Q,arrondi){
  const dx=Q.x-b.x,dy=Q.y-b.y,sens=b.cercle&&dx*b.tx+dy*b.ty<0?-1:1; // sur un cercle : on part du côté de l'arrivée
  const nx=-b.ty*sens,ny=b.tx*sens,h=dx*nx+dy*ny,d2=dx*dx+dy*dy;
  if(!(d2>1e-12)||Math.abs(h)<1e-6*Math.sqrt(d2))return null; // dans le prolongement : ce serait une droite
  const sg=h>0?1:-1;
  let r=d2/(2*Math.abs(h)),cx=b.x+sg*nx*r,cy=b.y+sg*ny*r,qx=Q.x,qy=Q.y;
  if(arrondi&&+r.toFixed(2)>0){
    r=+r.toFixed(2);cx=b.x+sg*nx*r;cy=b.y+sg*ny*r;
    const k=Math.hypot(Q.x-cx,Q.y-cy)||1;qx=cx+(Q.x-cx)/k*r;qy=cy+(Q.y-cy)/k*r;
  }
  return{x:cx,y:cy,r,qx,qy,ccw:h>0};
}
/* ----- création (a, b… : clics {x,y,pid?} ; pid = point existant cliqué) ----- */
function skTrAttache(sk,c,pid){ // un point dans le vide ne s'attache qu'à ce qu'on a visé de tout près
  const q=sk.points[pid];if(q&&!c.pid)skAutoAttach(sk,pid,q.x,q.y);
}
function skRect3Create(sk,a,b,w0){
  let ax=a.x,ay=a.y,bx=b.x,by=b.y,L=Math.hypot(bx-ax,by-ay);
  if(!(L>1e-6))return null;
  const ux=(bx-ax)/L,uy=(by-ay)/L;
  if(!a.pid||!b.pid){ // longueur ronde, en déplaçant le bout libre
    const Ln=+L.toFixed(2);
    if(Ln>0){if(!b.pid){bx=ax+ux*Ln;by=ay+uy*Ln;}else{ax=bx-ux*Ln;ay=by-uy*Ln;}L=Ln;}
  }
  const w=+w0.toFixed(2);if(!w)return null;
  const nx=-uy*w,ny=ux*w;
  const pa=a.pid||addPoint(sk,ax,ay),pb=b.pid||addPoint(sk,bx,by);
  const pc=pidAt(sk,bx+nx,by+ny),pd=pidAt(sk,ax+nx,ay+ny);
  const id=()=>skNewEid(sk);
  const l1={id:id(),t:'line',p1:pa,p2:pb},l2={id:id(),t:'line',p1:pb,p2:pc},l3={id:id(),t:'line',p1:pc,p2:pd},l4={id:id(),t:'line',p1:pd,p2:pa};
  sk.entities.push(l1,l2,l3,l4);
  skTrAttache(sk,a,pa);skTrAttache(sk,b,pb);
  [pc,pd].forEach(p=>{const q=sk.points[p];skAutoAttach(sk,p,q.x,q.y,1e-3);});
  if(Math.abs(uy)<1e-9||Math.abs(ux)<1e-9){ // à plat : un rectangle ordinaire
    const dh=Math.abs(uy)<1e-9?'h':'v',dv=dh==='h'?'v':'h';
    [l1,l3].forEach(l=>sk.constraints.push({id:id(),type:dh,line:l.id}));
    [l2,l4].forEach(l=>sk.constraints.push({id:id(),type:dv,line:l.id}));
  }else{
    sk.constraints.push({id:id(),type:'parallel',a:l1.id,b:l3.id},{id:id(),type:'parallel',a:l2.id,b:l4.id},{id:id(),type:'perpendicular',a:l1.id,b:l2.id});
  }
  const dims=[{id:id(),type:'length',line:l1.id,value:+L.toFixed(a.pid&&b.pid?6:2)},{id:id(),type:'length',line:l2.id,value:Math.abs(w)}];
  sk.dims.push(...dims);
  return{lines:[l1,l2,l3,l4],dims};
}
function skTrCercle(sk,x,y,r){
  const e={id:skNewEid(sk),t:'circle',pc:addPoint(sk,x,y),r};
  sk.entities.push(e);
  return e;
}
function skCercle2Pts(sk,a,b){
  const d=Math.hypot(b.x-a.x,b.y-a.y);if(!(d>1e-6))return null;
  const n=(a.pid?1:0)+(b.pid?1:0);
  const O=n?d:+d.toFixed(2);
  const e=skTrCercle(sk,(a.x+b.x)/2,(a.y+b.y)/2,O/2);
  const id=()=>skNewEid(sk);
  if(n===2){ // 2 points existants : un vrai diamètre, qui les suit
    const dia={id:id(),t:'line',p1:a.pid,p2:b.pid,construction:true};
    sk.entities.push(dia);
    sk.constraints.push({id:id(),type:'midpoint',p:e.pc,line:dia.id},{id:id(),type:'oncircle',p:a.pid,ent:e.id});
    return{circle:e,dims:[]};
  }
  if(n===1)sk.constraints.push({id:id(),type:'oncircle',p:a.pid||b.pid,ent:e.id});
  const cote={id:id(),type:'diameter',ent:e.id,value:+O.toFixed(2)};
  sk.dims.push(cote);
  return{circle:e,dims:[cote]};
}
function skCercle3Pts(sk,a,b,c){
  const g=skCirc3(a,b,c);if(!g)return null;
  const tenus=[a,b,c].filter(q=>q.pid).map(q=>q.pid);
  const O=tenus.length===2?2*g.r:+(2*g.r).toFixed(2);
  if(!(O>0))return null;
  const e=skTrCercle(sk,g.x,g.y,tenus.length?g.r:O/2);
  tenus.forEach(p=>sk.constraints.push({id:skNewEid(sk),type:'oncircle',p,ent:e.id}));
  const dims=[];
  if(tenus.length<3){const cote={id:skNewEid(sk),type:'diameter',ent:e.id,value:+O.toFixed(tenus.length===2?6:2)};sk.dims.push(cote);dims.push(cote);}
  return{circle:e,dims};
}
function skTanLien(sk,id,cible,inner){ // tangence du trait « id » avec le cercle ou l'arc « cible »
  const e=entById(sk,id);
  if(e.t==='line')sk.constraints.push({id:skNewEid(sk),type:'tangent',line:id,ent:cible});
  else{const k={id:skNewEid(sk),type:'tangent2',a:id,b:cible};if(inner)k.inner=true;sk.constraints.push(k);}
}
function skCercleTangent(sk,ids,sol){
  const e=skTrCercle(sk,sol.x,sol.y,sol.r);
  ids.forEach((id,i)=>skTanLien(sk,id,e.id,sol.s[i]<0));
  const dims=[];
  if(ids.length===2&&!sol.tenu){const cote={id:skNewEid(sk),type:'diameter',ent:e.id,value:+(2*sol.r).toFixed(2)};sk.dims.push(cote);dims.push(cote);}
  return{circle:e,dims};
}
function skArc3Pts(sk,a,b,m){
  const g=skCirc3(a,m,b);if(!g)return null;
  const a1=Math.atan2(a.y-g.y,a.x-g.x),a2=Math.atan2(b.y-g.y,b.x-g.x),am=Math.atan2(m.y-g.y,m.x-g.x);
  const pA=a.pid||addPoint(sk,a.x,a.y),pB=b.pid||addPoint(sk,b.x,b.y);
  const ccw=angInArc(am,a1,a2); // un arc se décrit dans le sens direct : sinon on échange ses bouts
  const e={id:skNewEid(sk),t:'arc',pc:addPoint(sk,g.x,g.y),pa:ccw?pA:pB,pb:ccw?pB:pA,r:g.r};
  sk.entities.push(e);
  skTrAttache(sk,a,pA);skTrAttache(sk,b,pB);
  if(m.pid)sk.constraints.push({id:skNewEid(sk),type:'oncircle',p:m.pid,ent:e.id});
  const dims=[];
  if(!(a.pid&&b.pid&&m.pid)){
    const corde=Math.hypot(b.x-a.x,b.y-a.y)/2,Rr=+g.r.toFixed(2),R=Rr>corde?Rr:+g.r.toFixed(6);
    const cote={id:skNewEid(sk),type:'radius',ent:e.id,value:R};sk.dims.push(cote);dims.push(cote);
  }
  return{arc:e,dims};
}
// direction dans laquelle un trait se prolonge à son bout pid
function skTrBoutDe(sk,E,pid){
  const P=sk.points[pid];if(!P)return null;
  let tx,ty;
  if(E.t==='line'){
    const O=sk.points[E.p1===pid?E.p2:E.p1];if(!O)return null;
    const L=Math.hypot(P.x-O.x,P.y-O.y);if(!(L>1e-9))return null;
    tx=(P.x-O.x)/L;ty=(P.y-O.y)/L;
  }else{
    const C=sk.points[E.pc];if(!C)return null;
    const L=Math.hypot(P.x-C.x,P.y-C.y);if(!(L>1e-9))return null;
    const sg=E.pb===pid?1:-1; // l'arc tourne dans le sens direct, de pa vers pb
    tx=-sg*(P.y-C.y)/L;ty=sg*(P.x-C.x)/L;
  }
  return{pid,ent:E.id,x:P.x,y:P.y,tx,ty};
}
/* D'où part l'arc tangent : le bout sous le curseur ; sinon, sur le corps d'une ligne ou d'un arc, son bout le
   plus proche ; sur un cercle, qui n'a pas de bout, le point cliqué (la direction suivra l'arrivée). */
function skTrBout(sk,x,y){
  const pid=nearestPoint(sk,x,y,SK_SNAP);
  if(pid){
    let E=null; // le dernier tracé d'abord (chaîne qu'on continue), le trait de construction seulement s'il n'y a que lui
    for(let i=sk.entities.length-1;i>=0;i--){
      const e=sk.entities[i];
      if(!((e.t==='line'&&(e.p1===pid||e.p2===pid))||(e.t==='arc'&&(e.pa===pid||e.pb===pid))))continue;
      if(!E||(E.construction&&!e.construction))E=e;
      if(!E.construction)break;
    }
    if(E)return skTrBoutDe(sk,E,pid);
  }
  const e=skTrEnt(sk,x,y);if(!e)return null;
  if(e.t==='circle'){
    const C=sk.points[e.pc];if(!C)return null;
    const d=Math.hypot(x-C.x,y-C.y);if(!(d>1e-9))return null;
    const ux=(x-C.x)/d,uy=(y-C.y)/d;
    return{pid:null,cercle:true,ent:e.id,x:C.x+ux*e.r,y:C.y+uy*e.r,tx:-uy,ty:ux};
  }
  const[p1,p2]=e.t==='line'?[e.p1,e.p2]:[e.pa,e.pb],A=sk.points[p1],B=sk.points[p2];if(!A||!B)return null;
  return skTrBoutDe(sk,e,Math.hypot(x-A.x,y-A.y)<=Math.hypot(x-B.x,y-B.y)?p1:p2);
}
function skArcTangent(sk,b,q){
  const g=skArcTanGeom(b,q,!q.pid);if(!g)return null;
  const pQ=q.pid||addPoint(sk,g.qx,g.qy),pP=b.pid||addPoint(sk,b.x,b.y);
  const e={id:skNewEid(sk),t:'arc',pc:addPoint(sk,g.x,g.y),pa:g.ccw?pP:pQ,pb:g.ccw?pQ:pP,r:g.r};
  sk.entities.push(e);
  const src=entById(sk,b.ent);
  if(!b.pid)sk.constraints.push({id:skNewEid(sk),type:'oncircle',p:pP,ent:src.id}); // départ posé sur le cercle
  let inner=false;
  if(src.t!=='line'){const C=sk.points[src.pc];inner=(g.x-b.x)*(C.x-b.x)+(g.y-b.y)*(C.y-b.y)>0;}
  skTanLien(sk,b.ent,e.id,inner);
  if(!q.pid)skAutoAttach(sk,pQ,g.qx,g.qy);
  const dims=[];
  if(!q.pid){const cote={id:skNewEid(sk),type:'radius',ent:e.id,value:g.r};sk.dims.push(cote);dims.push(cote);}
  return{arc:e,dims};
}
// arc tangent à 2 traits : le morceau du cercle-solution entre ses 2 contacts, le plus court
function skArcEntre(E,sol){
  const f=E.map(e=>skTanPied(e,sol));
  const a=f.map(q=>Math.atan2(q.y-sol.y,q.x-sol.x));
  let d=(a[1]-a[0])%(2*Math.PI);if(d<0)d+=2*Math.PI;
  if(d<1e-6||2*Math.PI-d<1e-6)return null; // contacts confondus : pas d'arc
  const sw=d>Math.PI+1e-9;
  return{f,a1:sw?a[1]:a[0],a2:sw?a[0]:a[1],sw};
}
function skArcTangent2(sk,ids,sol){
  const E=ids.map(i=>skTanElem(sk,i));if(E.some(e=>!e))return null;
  const g=skArcEntre(E,sol);if(!g)return null;
  const p=g.f.map(q=>addPoint(sk,q.x,q.y));
  const e={id:skNewEid(sk),t:'arc',pc:addPoint(sk,sol.x,sol.y),pa:p[g.sw?1:0],pb:p[g.sw?0:1],r:sol.r};
  sk.entities.push(e);
  ids.forEach((id,i)=>{
    skTanLien(sk,id,e.id,sol.s[i]<0);
    const src=entById(sk,id);
    if(src.t==='line')sk.constraints.push({id:skNewEid(sk),type:'online',p:p[i],line:id});
    else sk.constraints.push({id:skNewEid(sk),type:'oncircle',p:p[i],ent:id});
  });
  const dims=[];
  if(!sol.tenu){const cote={id:skNewEid(sk),type:'radius',ent:e.id,value:+sol.r.toFixed(3)};sk.dims.push(cote);dims.push(cote);}
  return{arc:e,dims};
}
/* ----- souris : pointerdown commence, chaque pointerup compte un clic (comme l'oblong) ----- */
function skTrActif(tool){
  const m=skTraceMode[tool];
  return (tool==='rect'&&m==='3pts')||(tool==='circle'&&m!=='centre')||(tool==='arc'&&m!=='centre');
}
// nombre de clics du tracé
function skTrClics(tool,mode){return (tool==='circle'&&mode==='2pts')||(tool==='arc'&&mode==='tangent')?2:3;}
function skTrEnt(sk,x,y,sauf){ // trait touchable sous le curseur
  const e=nearestEntity(sk,x,y,SK_SNAP);
  if(!e||(sauf||[]).indexOf(e.id)>=0)return null;
  return e.t==='line'||e.t==='circle'||e.t==='arc'?e:null;
}
function skTrAim(sk,tr,wx,wy){
  const aplat=tr&&tr.tool==='rect'&&tr.pts.length===1?tr.pts[0]:null;
  const m=skSlotAim(sk,wx,wy,aplat);
  return{x:m.x,y:m.y,s:m.s,raw:{x:wx,y:wy}};
}
const skTrArcPts=(c,r,a1,a2)=>{
  let d=(a2-a1)%(2*Math.PI);if(d<=0)d+=2*Math.PI;
  const n=Math.max(8,Math.ceil(d/(Math.PI/32))),out=[];
  for(let k=0;k<=n;k++){const t=a1+d*k/n;out.push({x:c.x+r*Math.cos(t),y:c.y+r*Math.sin(t)});}
  return out;
};
const skTrCerclePts=(c,r)=>skTrArcPts(c,r,0,2*Math.PI);
// l'aperçu et sa géométrie, d'après les clics déjà donnés et le curseur
function skTrDraft(sk,tr,m){
  const{tool,mode,pts}=tr,A=pts[0],n=pts.length,min=skMinLen();
  const d={t:'trace',ok:false,marks:pts.filter(p=>p.ent===undefined||p.pid||p.cercle).concat(m&&m.raw&&mode!=='tangent'?[m]:[])};
  if(tool==='rect'){
    if(n===1){d.poly=[A,m];d.label=Math.hypot(m.x-A.x,m.y-A.y).toFixed(2);return d;}
    const B=pts[1],L=Math.hypot(B.x-A.x,B.y-A.y)||1,nx=-(B.y-A.y)/L,ny=(B.x-A.x)/L,w=(m.x-B.x)*nx+(m.y-B.y)*ny;
    d.poly=[A,B,{x:B.x+nx*w,y:B.y+ny*w},{x:A.x+nx*w,y:A.y+ny*w}];d.ferme=true;
    d.label=L.toFixed(2)+' × '+Math.abs(w).toFixed(2);
    d.ok=Math.abs(w)>min;d.geo={w};
    return d;
  }
  if(tool==='circle'&&mode==='2pts'){
    const r=Math.hypot(m.x-A.x,m.y-A.y)/2;
    d.poly=skTrCerclePts({x:(A.x+m.x)/2,y:(A.y+m.y)/2},r);d.ferme=true;d.label='⌀'+(2*r).toFixed(2);d.ok=2*r>min;
    return d;
  }
  if(tool==='circle'&&mode==='3pts'){
    if(n===1){d.poly=[A,m];return d;}
    const g=skCirc3(A,pts[1],m);
    if(!g){d.poly=[A,pts[1],m];return d;}
    d.poly=skTrCerclePts(g,g.r);d.ferme=true;d.label='⌀'+(2*g.r).toFixed(2);d.ok=g.r>min;
    return d;
  }
  if(tool==='circle'){ // tangent
    const ids=pts.map(p=>p.ent);
    if(n===1){const e=skTrEnt(sk,m.raw.x,m.raw.y,ids);d.ents=e?ids.concat(e.id):ids;return d;}
    const E=ids.map(i=>skTanElem(sk,i));d.ents=ids;
    if(E.some(e=>!e))return d;
    let sol=null,all=ids;
    const e3=skTrEnt(sk,m.raw.x,m.raw.y,ids);
    if(e3){
      const T=skTanElem(sk,e3.id);
      if(T){sol=skTan3Sol(E.concat(T),pts.concat(m.raw));if(sol)all=ids.concat(e3.id);}
    }
    if(!sol)sol=skTan2Sol(E,m.raw.x,m.raw.y);
    d.ents=all;
    if(!sol)return d;
    d.poly=skTrCerclePts(sol,sol.r);d.ferme=true;d.label='⌀'+(2*sol.r).toFixed(2);d.ok=sol.r>min;d.geo={sol,ids:all};
    return d;
  }
  if(mode==='3pts'){ // arc
    if(n===1){d.poly=[A,m];d.label=Math.hypot(m.x-A.x,m.y-A.y).toFixed(2);return d;}
    const B=pts[1],g=skCirc3(A,m,B);
    if(!g){d.poly=[A,B];return d;}
    const a1=Math.atan2(A.y-g.y,A.x-g.x),a2=Math.atan2(B.y-g.y,B.x-g.x),am=Math.atan2(m.y-g.y,m.x-g.x);
    d.poly=angInArc(am,a1,a2)?skTrArcPts(g,g.r,a1,a2):skTrArcPts(g,g.r,a2,a1);
    d.label='R'+g.r.toFixed(2);d.ok=g.r>min;
    return d;
  }
  // arc tangent à 2 traits
  if(tr.deux){
    const ids=pts.map(p=>p.ent),E=ids.map(i=>skTanElem(sk,i));
    d.ents=ids;d.marks=[];
    if(E.some(e=>!e))return d;
    const sol=skTan2Sol(E,m.raw.x,m.raw.y),g=sol&&skArcEntre(E,sol);
    if(!g)return d;
    d.poly=skTrArcPts(sol,sol.r,g.a1,g.a2);d.label='R'+sol.r.toFixed(2);d.ok=sol.r>min;d.geo={sol,ids};
    return d;
  }
  // arc tangent : on vise un 2e trait, ou l'arrivée
  d.ents=[A.ent];
  const e2=skTrDeuxieme(sk,m,A);
  if(e2){d.ents=[A.ent,e2.id];return d;}
  const g=skArcTanGeom(A,m,!m.s);
  if(!g){d.poly=[A,m];return d;}
  const a1=Math.atan2(A.y-g.y,A.x-g.x),a2=Math.atan2(g.qy-g.y,g.qx-g.x);
  d.poly=g.ccw?skTrArcPts(g,g.r,a1,a2):skTrArcPts(g,g.r,a2,a1);
  d.label='R'+g.r.toFixed(2);d.ok=g.r>min;
  return d;
}
// le 2e trait visé par l'arc tangent : un point cliqué reste une arrivée, le milieu d'un trait désigne ce trait
function skTrDeuxieme(sk,m,A){
  if(m.s&&m.s.kind!=='mid')return null;
  return skTrEnt(sk,m.raw.x,m.raw.y,[A.ent]);
}
function skTrMarque(m){skSnapMk=m&&m.s?{x:m.s.x,y:m.s.y}:null;}
function skTrMove(sk,wx,wy){
  const tr=skDown&&skDown.tr;
  if(!tr){ // avant le 1er clic : on montre ce que le clic prendrait
    const mode=skTraceMode[skTool];
    skDraft=null;skSnapMk=null;
    if(mode==='tangent'&&skTool==='circle'){const e=skTrEnt(sk,wx,wy);if(e)skDraft={t:'trace',ents:[e.id]};}
    else if(mode==='tangent'){const b=skTrBout(sk,wx,wy);if(b){skDraft={t:'trace',ents:[b.ent]};skSnapMk={x:b.x,y:b.y};}}
    else skTrMarque(skTrAim(sk,null,wx,wy));
    drawSketch2D();
    return;
  }
  const m=skTrAim(sk,tr,wx,wy);
  skTrMarque(tr.mode==='tangent'&&(tr.tool==='circle'||tr.deux)?null:m);
  skDraft=skTrDraft(sk,tr,m);
  drawSketch2D();
}
function skTrDown(sk,wx,wy){
  if(skDown)return;
  const tool=skTool,mode=skTraceMode[tool];
  let c;
  if(mode==='tangent'&&tool==='circle'){
    const e=skTrEnt(sk,wx,wy);
    if(!e){skStatus(SK_TR_MSG.circle.tangent[0]+' (une ligne, un cercle ou un arc)');return;}
    c={ent:e.id,x:wx,y:wy,raw:{x:wx,y:wy}};
  }else if(mode==='tangent'){
    c=skTrBout(sk,wx,wy);
    if(!c){skStatus(SK_TR_MSG.arc.tangent[0]);return;}
    c.raw={x:wx,y:wy};
  }else c=skTrAim(sk,null,wx,wy);
  skDown={pid:null,x:c.x,y:c.y,tr:{tool,mode,pts:[c],up:false}};
  skStatus(SK_TR_MSG[tool][mode][1]);
}
function skTrPid(sk,c){ // le point cliqué sur une géométrie n'existe vraiment qu'à la fin du tracé
  if(!c.s)return c;
  c.pid=snapNewPoint(sk,c.raw.x,c.raw.y);
  const p=sk.points[c.pid];c.x=p.x;c.y=p.y;
  return c;
}
function skTrFin(sk,tr,m){
  const{tool,mode,pts}=tr;
  const d=skTrDraft(sk,tr,m);
  if(!d.ok){
    skStatus(tool==='rect'?'Rectangle : éloignez le curseur du côté pour donner la largeur.'
      :tr.deux?'Arc : aucun arc ne touche ces traits ici — déplacez le curseur.'
      :mode==='tangent'?(tool==='arc'?'Arc : visez hors du prolongement du trait.':'Cercle : aucun cercle ne touche ces traits ici — déplacez le curseur.')
      :(tool==='arc'?'Arc':'Cercle')+' : ces points sont alignés ou confondus — visez ailleurs.');
    return;
  }
  skPushUndo();
  let R=null;
  if(tool==='circle'&&mode==='tangent')R=skCercleTangent(sk,d.geo.ids,d.geo.sol);
  else if(tr.deux)R=skArcTangent2(sk,d.geo.ids,d.geo.sol);
  else if(mode==='tangent')R=skArcTangent(sk,pts[0],skTrPid(sk,m));
  else{
    pts.forEach(p=>skTrPid(sk,p));skTrPid(sk,m);
    if(tool==='rect')R=skRect3Create(sk,pts[0],pts[1],d.geo.w);
    else if(tool==='circle'&&mode==='2pts')R=skCercle2Pts(sk,pts[0],m);
    else if(tool==='circle')R=skCercle3Pts(sk,pts[0],pts[1],m);
    else R=skArc3Pts(sk,pts[0],pts[1],m);
  }
  skDown=null;skDraft=null;skSnapMk=null;afterEdit();
  const nom=tool==='rect'?'Rectangle':tool==='circle'?'Cercle':'Arc';
  skStatus(R?nom+' créé — '+skTraceMsg(tool).replace(/^[^:]*: c/,'c').replace(/ \(.*\)/,'').replace(/\.$/,'')+' pour le suivant (Échap = fin).':nom+' : forme impossible avec ces points.');
}
function skTrUp(sk,wx,wy){
  const tr=skDown.tr,m=skTrAim(sk,tr,wx,wy),A=tr.pts[0];
  const pick=tr.tool==='circle'&&tr.mode==='tangent';
  if(!tr.up){ // 1er relâché : sur place, le 1er point reste armé ; sinon c'est déjà le 2e point
    tr.up=true;
    if(pick||Math.hypot(wx-A.raw.x,wy-A.raw.y)<=skMinLen()){skStatus(SK_TR_MSG[tr.tool][tr.mode][1]);return;}
  }
  if(tr.tool==='arc'&&tr.mode==='tangent'&&!tr.deux){ // sur un autre trait : arc tangent aux 2, la taille reste à donner
    const e2=skTrDeuxieme(sk,m,A);
    if(e2){
      tr.deux=true;tr.pts.push({ent:e2.id,x:wx,y:wy,raw:{x:wx,y:wy}});
      skStatus(SK_TR_MSG.arc.tangent[2]);skTrMove(sk,wx,wy);
      return;
    }
  }
  if(tr.deux||tr.pts.length+1>=skTrClics(tr.tool,tr.mode)){skTrFin(sk,tr,m);return;}
  // clic intermédiaire
  if(pick){
    const e=skTrEnt(sk,wx,wy,tr.pts.map(p=>p.ent));
    if(!e){skStatus(SK_TR_MSG.circle.tangent[1]+' (un autre trait)');return;}
    tr.pts.push({ent:e.id,x:wx,y:wy,raw:{x:wx,y:wy}});
  }else{
    if(Math.hypot(m.x-A.x,m.y-A.y)<=skMinLen())return;
    tr.pts.push(m);
  }
  skStatus(SK_TR_MSG[tr.tool][tr.mode][tr.pts.length]);
  skTrMove(sk,wx,wy);
}
function skTrDrawDraft(d){
  const sk=skEdit;if(!sk)return;
  (d.ents||[]).forEach(id=>{ // les traits choisis, surlignés
    const e=entById(sk,id);if(!e)return;
    let pl=null;
    if(e.t==='line'){const a=sk.points[e.p1],b=sk.points[e.p2];if(a&&b)pl=[a,b];}
    else if(e.t==='circle'){const C=sk.points[e.pc];if(C)pl=skTrCerclePts(C,e.r);}
    else if(e.t==='arc'){const C=sk.points[e.pc],an=arcAngles(sk,e);if(C&&an)pl=skTrArcPts(C,e.r,an.a1,an.a2);}
    if(pl)skEl('path',{d:'M '+pl.map(q=>w2s(q.x,q.y).map(v=>v.toFixed(1)).join(' ')).join(' L '),fill:'none',stroke:'#ffd60a','stroke-width':3,opacity:.75});
  });
  if(d.poly&&d.poly.length>1)
    skEl('path',{d:'M '+d.poly.map(q=>w2s(q.x,q.y).map(v=>v.toFixed(1)).join(' ')).join(' L ')+(d.ferme?' Z':''),fill:d.ferme?'rgba(255,255,255,.06)':'none',stroke:'#fff','stroke-width':2,'stroke-dasharray':'5 3'});
  (d.marks||[]).forEach(q=>{const[a,b]=w2s(q.x,q.y);skEl('circle',{cx:a,cy:b,r:3,fill:'#ffd60a'});});
  if(d.label&&d.poly&&d.poly.length){
    // au-dessus du tracé, centrée
    let g=Infinity,dr=-Infinity,h=Infinity;
    d.poly.forEach(q=>{const[sx,sy]=w2s(q.x,q.y);if(sx<g)g=sx;if(sx>dr)dr=sx;if(sy<h)h=sy;});
    const t=skEl('text',{x:(g+dr)/2,y:h-8,fill:'#ffd60a','font-size':13,'font-weight':'bold','text-anchor':'middle'});
    t.textContent=d.label;
  }
}
