/* ================================================================
   FAO : ARCS G2 / G3 SUR LES PROFILS (V0.99.96)
   ----------------------------------------------------------------
   Demande de Fred sur Renfort.conceptcad (opération 3, Contour) : « les congés ne sont
   pas passés en interpolation circulaire mais linéaire, ce qui a fait qu'ils sont
   facétisés … il faut l'utiliser le plus souvent possible cette interpolation circulaire ».
   La chaîne d'arêtes arrive en POINTS (un congé R5 = 9 cordes de 10°, flèche 0,019 mm) ;
   le contour décalait ces cordes et sortait une suite de G1 : facettes sur la pièce.
   1. faoLoopArcs     : arcs de la boucle — au moins 3 cordes dont les sommets sont sur un
                        même cercle (1,5 µm : coordonnées gardées au µm), cordes de 20° au
                        plus (au-delà : un polygone), toujours dans le même sens ; centre et
                        rayon ajustés sur tous les sommets (moindres carrés) ;
   2. faoLoopArcDense : ces arcs re-découpés sur le VRAI cercle (flèche ≤ 0,2 µm) avant le
                        décalage — la passe décalée est alors un cercle exact (R ± rayon) ;
   3. faoArcCenters   : centres connus — arcs de la boucle et coins vifs (le décalage les
                        arrondit au rayon de l'outil) ; entrées / sorties ajoutent le leur ;
   4. faoFitArcsMoves : une suite de coupes (2 segments au moins) dont les points sont à la
                        même distance d'un centre connu (2 µm), qui tourne toujours dans le
                        même sens, en cordes de flèche ≤ 2 µm, devient UN bloc G2 / G3
                        (180° au plus) ; Z constant ou linéaire (hélice de la descente en
                        pente) ; centre recalé sur la médiatrice départ / arrivée (rayons
                        égaux au départ et à l'arrivée, comme l'exigent les CN).
   ================================================================ */
const FAO_ARC_TOL=0.002;        // mm — écart des points au cercle, flèche des cordes remplacées
const FAO_ARC_LOOP_TOL=0.0015;  // mm — sommets de la boucle (arrondis au µm)
const FAO_ARC_MAXSTEP=20*Math.PI/180; // une corde de boucle couvre au plus 20°
const FAO_ARC_DENSE_SAG=0.0002; // mm — flèche des cordes de la boucle re-découpée
function faoCircle3(a,b,c){
  // cercle par 3 points (repère local en a : précision au-delà de 100 mm) ; null si alignés
  const bx=b[0]-a[0],by=b[1]-a[1],cx=c[0]-a[0],cy=c[1]-a[1];
  const d=2*(bx*cy-by*cx);
  if(!(Math.abs(d)>1e-12))return null;
  const b2=bx*bx+by*by,c2=cx*cx+cy*cy;
  const ux=(cy*b2-by*c2)/d,uy=(bx*c2-cx*b2)/d;
  return {x:a[0]+ux,y:a[1]+uy,r:Math.hypot(ux,uy)};
}
function faoCircleFit(P){
  // cercle des moindres carrés algébriques (Kasa), centré sur la moyenne ; null si dégénéré
  const n=P.length;if(n<3)return null;
  let mx=0,my=0;for(let i=0;i<n;i++){mx+=P[i][0];my+=P[i][1];}mx/=n;my/=n;
  let suu=0,svv=0,suv=0,suuu=0,svvv=0,suvv=0,svuu=0;
  for(let i=0;i<n;i++){const u=P[i][0]-mx,v=P[i][1]-my;
    suu+=u*u;svv+=v*v;suv+=u*v;suuu+=u*u*u;svvv+=v*v*v;suvv+=u*v*v;svuu+=v*u*u;}
  const det=suu*svv-suv*suv;
  if(!(Math.abs(det)>1e-18))return null;
  const b1=(suuu+suvv)/2,b2=(svvv+svuu)/2;
  const uc=(b1*svv-b2*suv)/det,vc=(suu*b2-suv*b1)/det;
  const r=Math.sqrt(uc*uc+vc*vc+(suu+svv)/n);
  return isFinite(r)?{x:uc+mx,y:vc+my,r:r}:null;
}
function faoLoopArcs(loop){
  // -> {P (sommets, sans le point de fermeture), n, arcs:[{a,b,x,y,r,ccw}]} — a..b : indices de
  //    sommets (b > a, peut dépasser n : boucle cyclique) ; null si la boucle est trop courte
  if(!Array.isArray(loop)||loop.length<5)return null;
  const P=[];
  for(let i=0;i<loop.length;i++){const x=+loop[i][0],y=+loop[i][1];if(!isFinite(x)||!isFinite(y))return null;P.push([x,y]);}
  if(Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1])<1e-6)P.pop();
  const n=P.length;
  if(n<4)return null;
  const at=function(k){return P[((k%n)+n)%n];};
  const fit=function(i,j){
    // sommets i..j (j−i cordes) sur un même cercle ? -> {x,y,r,ccw} ou null
    // 3 points les plus écartés : bouts et milieu ; tour complet (bouts confondus) : au tiers
    let C=j-i>=n?faoCircle3(at(i),at(i+Math.floor(n/3)),at(i+Math.floor(2*n/3))):faoCircle3(at(i),at((i+j)>>1),at(j));
    if(!C||!(C.r>=0.05&&C.r<=1e4))return null;
    if(j-i>=3){const Q=[];for(let k=i;k<=j;k++)Q.push(at(k));const L=faoCircleFit(Q);if(L&&L.r>=0.05&&L.r<=1e4)C=L;}
    const chMax=2*C.r*Math.sin(FAO_ARC_MAXSTEP/2)+1e-9;
    let sg=0,sw=0;
    for(let k=i;k<=j;k++){const q=at(k);if(Math.abs(Math.hypot(q[0]-C.x,q[1]-C.y)-C.r)>FAO_ARC_LOOP_TOL)return null;}
    for(let k=i;k<j;k++){
      const q=at(k),w=at(k+1);
      const ax=q[0]-C.x,ay=q[1]-C.y,bx=w[0]-C.x,by=w[1]-C.y;
      const cr=ax*by-ay*bx,s=cr>1e-15?1:(cr<-1e-15?-1:0);
      if(!s)return null;
      if(!sg)sg=s;else if(s!==sg)return null;
      if(Math.hypot(w[0]-q[0],w[1]-q[1])>chMax)return null;
      sw+=Math.abs(Math.atan2(cr,ax*bx+ay*by));
    }
    if(sw>2*Math.PI+1e-6)return null;
    return {x:C.x,y:C.y,r:C.r,ccw:sg>0};
  };
  const arcs=[];
  let i=0;
  while(i+3<=n){
    let j=i+3,f=fit(i,j);
    if(!f){i++;continue;}
    while(j+1<=n){const g=fit(i,j+1);if(!g)break;f=g;j++;}
    arcs.push({a:i,b:j,x:f.x,y:f.y,r:f.r,ccw:f.ccw});
    i=j;
  }
  // arc à cheval sur le départ de la boucle : les deux morceaux n'en font qu'un
  if(arcs.length>=2){
    const A=arcs[0],Z=arcs[arcs.length-1];
    if(A.a===0&&Z.b===n&&A.ccw===Z.ccw&&Math.hypot(A.x-Z.x,A.y-Z.y)<4*FAO_ARC_LOOP_TOL&&Math.abs(A.r-Z.r)<4*FAO_ARC_LOOP_TOL){
      const g=fit(Z.a,n+A.b);
      if(g){arcs.pop();arcs[0]={a:Z.a,b:n+A.b,x:g.x,y:g.y,r:g.r,ccw:g.ccw};}
    }
  }
  return {P:P,n:n,arcs:arcs};
}
function faoLoopArcDense(loop){
  // -> {loop (re-découpée, refermée), centers:[{x,y,r}]} ; boucle inchangée si aucun arc
  const LA=faoLoopArcs(loop);
  if(!LA)return {loop:loop,centers:[],arcs:0};
  const P=LA.P,n=LA.n,arcs=LA.arcs;
  const at=function(k){return P[((k%n)+n)%n];};
  const centers=arcs.map(function(A){return {x:A.x,y:A.y,r:A.r};});
  // coins vifs (hors arcs) : le décalage les arrondit autour du sommet
  const inArc=new Uint8Array(n);
  arcs.forEach(function(A){for(let k=A.a+1;k<A.b;k++)inArc[((k%n)+n)%n]=1;});
  for(let k=0;k<n;k++){
    if(inArc[k])continue;
    const p=at(k-1),q=at(k),w=at(k+1);
    const ux=q[0]-p[0],uy=q[1]-p[1],vx=w[0]-q[0],vy=w[1]-q[1];
    const t=Math.abs(Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy));
    if(t>2*Math.PI/180)centers.push({x:q[0],y:q[1],r:0});
  }
  if(!arcs.length)return {loop:loop,centers:centers,arcs:0};
  // départ : un sommet hors de tout arc (sinon le début du premier arc — cercle complet)
  let s=-1;
  for(let k=0;k<n&&s<0;k++)if(!inArc[k]&&!arcs.some(function(A){return ((A.a%n)+n)%n===k;}))s=k;
  if(s<0)s=((arcs[0].a%n)+n)%n;
  const byStart=new Map();arcs.forEach(function(A){byStart.set(((A.a%n)+n)%n,A);});
  const out=[];
  let k=s;
  while(k<s+n){
    const A=byStart.get(((k%n)+n)%n);
    out.push(at(k).slice());
    if(A){
      const q0=at(A.a),q1=at(A.b);
      const a0=Math.atan2(q0[1]-A.y,q0[0]-A.x);
      let sw=Math.atan2(q1[1]-A.y,q1[0]-A.x)-a0;
      if(A.ccw){while(sw<=1e-12)sw+=2*Math.PI;}else{while(sw>=-1e-12)sw-=2*Math.PI;}
      if(A.b-A.a>=n)sw=A.ccw?2*Math.PI:-2*Math.PI; // cercle complet
      const c=1-FAO_ARC_DENSE_SAG/A.r;
      let st=2*Math.acos(c>1?1:(c<-1?-1:c));
      if(!(st>0))st=Math.PI/180;
      st=Math.max(0.25*Math.PI/180,Math.min(st,Math.PI/180*2));
      const m=Math.min(2880,Math.max(2,Math.ceil(Math.abs(sw)/st)));
      for(let q=1;q<m;q++){const a=a0+sw*q/m;out.push([A.x+A.r*Math.cos(a),A.y+A.r*Math.sin(a)]);}
      k+=Math.max(1,A.b-A.a);
    }else k++;
  }
  out.push(out[0].slice());
  return {loop:out,centers:centers,arcs:arcs.length};
}
function faoFitArcsMoves(mv,centers,opt){
  // Coupes consécutives sur un cercle de centre connu -> blocs G2 / G3 (voir l'en-tête).
  if(!Array.isArray(mv)||mv.length<3||!Array.isArray(centers)||!centers.length)return mv;
  const tol=(opt&&+opt.tol>0)?+opt.tol:FAO_ARC_TOL;
  const minSeg=(opt&&+opt.minSeg>=2)?Math.round(+opt.minSeg):2;
  const rnd=function(v){return Math.round(v*10000)/10000;};
  const C=centers.filter(function(c){return c&&isFinite(+c.x)&&isFinite(+c.y);});
  const plain=function(m){return m&&!m.r&&!m.arc&&isFinite(+m.x)&&isFinite(+m.y)&&isFinite(+m.z);};
  const out=[];let nArc=0;
  let prev=null,i=0;
  while(i<mv.length){
    const m=mv[i];
    if(!prev||!plain(m)||!isFinite(+prev.x)){out.push(m);prev=m;i++;continue;}
    const ent=m.ent?1:0;
    let best=null;
    for(let c=0;c<C.length;c++){
      const cx=+C[c].x,cy=+C[c].y;
      const r0=Math.hypot(prev.x-cx,prev.y-cy);
      if(!(r0>0.01))continue;
      if(Math.abs(Math.hypot(m.x-cx,m.y-cy)-r0)>tol)continue;
      // flèche des cordes remplacées : 2,5 × tol (la simplification laisse déjà 2 µm) ; points
      // tirés du cercle lui-même (entrées / sorties, C.ex) : cordes de 45° au plus
      const sagMax=C[c].ex?1/0:2.5*tol;
      // extension : même rayon, même sens, cordes courtes, 180° au plus
      let k=i,sw=0,dir=0,qx=+prev.x,qy=+prev.y;
      const sws=[0];
      while(k<mv.length){
        const p=mv[k];
        if(!plain(p)||(p.ent?1:0)!==ent)break;
        if(Math.abs(Math.hypot(p.x-cx,p.y-cy)-r0)>tol)break;
        const ax=qx-cx,ay=qy-cy,bx=p.x-cx,by=p.y-cy;
        const phi=Math.atan2(ax*by-ay*bx,ax*bx+ay*by);
        if(!(Math.abs(phi)>1e-7))break;
        const s=phi>0?1:-1;
        if(dir&&s!==dir)break;
        if(r0*(1-Math.cos(phi/2))>sagMax||Math.abs(phi)>Math.PI/4)break;
        if(sw+Math.abs(phi)>Math.PI-1e-6)break;
        dir=s;sw+=Math.abs(phi);sws.push(sw);qx=+p.x;qy=+p.y;k++;
      }
      // Z linéaire le long de l'arc (plan ou hélice) : on raccourcit jusqu'à ce qu'il le soit
      let e=k-1;
      while(e-i+1>=minSeg){
        const z0=+prev.z,z1=+mv[e].z,tot=sws[e-i+1];
        let ok=true;
        for(let q=i;q<e&&ok;q++)if(Math.abs(+mv[q].z-(z0+(z1-z0)*sws[q-i+1]/tot))>tol)ok=false;
        if(ok)break;
        e--;
      }
      const nSeg=e-i+1;
      if(nSeg>=minSeg&&(!best||nSeg>best.n))best={n:nSeg,e:e,cx:cx,cy:cy,cw:dir<0};
    }
    if(!best){out.push(m);prev=m;i++;continue;}
    // centre recalé sur la médiatrice départ / arrivée : même rayon aux deux bouts
    const E=mv[best.e],sx=+prev.x,sy=+prev.y,ex=+E.x,ey=+E.y;
    const mx=(sx+ex)/2,my=(sy+ey)/2,L=Math.hypot(ex-sx,ey-sy);
    let cx=best.cx,cy=best.cy;
    if(L>1e-9){const ux=-(ey-sy)/L,uy=(ex-sx)/L,t=(cx-mx)*ux+(cy-my)*uy;cx=mx+ux*t;cy=my+uy*t;}
    const q=Object.assign({},E,{x:rnd(ex),y:rnd(ey),z:rnd(+E.z),arc:{i:rnd(cx-sx),j:rnd(cy-sy),cw:best.cw}});
    if(ent)q.ent=1;
    out.push(q);prev=q;nArc++;i=best.e+1;
  }
  try{ if(mv.diag)out.diag=mv.diag; if(mv.vide)out.vide=mv.vide; }catch(e){}
  try{ if(out.diag)out.diag.arcs=nArc; }catch(e){}
  return out;
}
