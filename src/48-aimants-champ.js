/* ---------- aimants permanents : champ magnétique calculé et lignes de champ (V0.57.0) ----------
   Modèle : aimant SEUL, dans l'air, à aimantation uniforme selon +Z (pôle nord en haut). Le champ
   se calcule directement à partir de la forme et de la rémanence Br, sans maillage :
     · cylindre : Derby & Olbert, Am. J. Phys. 78 (2010), intégrale elliptique complète généralisée
       de Bulirsch (cel) — justes partout, sur l'axe et hors de l'axe ;
     · anneau : cylindre extérieur moins cylindre intérieur ;
     · pavé : deux feuilles de charge magnétique, formes fermées (arctangentes et logarithmes).
   Limites assumées : ni l'acier voisin, ni les autres aimants, ni la température, ni les
   dispersions de fabrication n'entrent dans le calcul.
   Unités : mm et tesla. Géométrie m={s:'cyl'|'ring'|'box', Br, h, d, di, a, b}, origine au centre
   de sa face sud (z de 0 à h), comme la pièce posée par la fenêtre des aimants. */
function magCel(kc,p0,c0,s0){
  // Bulirsch : cel(kc,p,c,s) ; p>0 partout ici (p=1 ou γ², γ≠0 sauf exactement sur la paroi, traité par magCyl)
  let k=Math.abs(kc),e=k,m=1,p=Math.sqrt(p0),c=c0,s=s0/p,f=c,g;
  c=c+s/p;g=e/p;s=2*(s+f*g);p=g+p;g=m;m=k+m;
  for(let i=0;i<64&&Math.abs(g-k)>g*1e-10;i++){k=2*Math.sqrt(e);e=k*m;f=c;c=c+s/p;g=e/p;s=2*(s+f*g);p=g+p;g=m;m=k+m;}
  return (Math.PI/2)*(s+c*m)/(m*(m+p));
}
function magCyl(rho,z,a,b,Br){
  // Cylindre de rayon a, de z=-b à z=+b : [Bρ, Bz] au point (ρ, z)
  let r=Math.max(rho,1e-9*a);
  if(Math.abs(r-a)<1e-9*a)r=a*(1+1e-9); // γ=0 exactement sur la paroi : p=0 sans intérêt physique
  const zp=z+b,zm=z-b,hp=Math.hypot(zp,r+a),hm=Math.hypot(zm,r+a),g=(a-r)/(a+r);
  const kp=Math.max(1e-12,Math.hypot(zp,a-r)/hp),km=Math.max(1e-12,Math.hypot(zm,a-r)/hm);
  const K=Br/Math.PI;
  return [
    K*(a/hp*magCel(kp,1,1,-1)-a/hm*magCel(km,1,1,-1)),
    K*(a/(a+r))*(zp/hp*magCel(kp,g*g,1,g)-zm/hm*magCel(km,g*g,1,g))
  ];
}
function magBox(x,y,z,a,b,c,Br){
  // Pavé |x|≤a, |y|≤b, |z|≤c, aimanté +Z
  let bx=0,by=0,bz=0;
  for(const [sw,z0] of [[1,c],[-1,-c]])for(const su of [1,-1])for(const sv of [1,-1]){
    const u=x+su*a,v=y+sv*b,w=z-z0,R=Math.sqrt(u*u+v*v+w*w)||1e-12,s=sw*su*sv;
    bz+=s*Math.atan2(u*v,w*R);
    bx-=s*Math.log(Math.max(v+R,1e-12));
    by-=s*Math.log(Math.max(u+R,1e-12));
  }
  const K=Br/(4*Math.PI);
  return [K*bx,K*by,K*bz]; // atan2 traverse les faces sans saut : c'est bien B, y compris dans la matière
}
function magField(m,x,y,z){
  // Champ B (tesla) au point (x,y,z) du repère de la pièce
  const zc=z-m.h/2;
  if(m.s==='box')return magBox(x,y,zc,m.a/2,m.b/2,m.h/2,m.Br);
  const r=Math.hypot(x,y),q=Math.max(r,1e-12);
  let [Bp,Bz]=magCyl(r,zc,m.d/2,m.h/2,m.Br);
  if(m.s==='ring'){const I=magCyl(r,zc,m.di/2,m.h/2,m.Br);Bp-=I[0];Bz-=I[1];}
  return [Bp*x/q,Bp*y/q,Bz];
}
function magInside(m,x,y,z){
  if(z<0||z>m.h)return false;
  if(m.s==='box')return Math.abs(x)<=m.a/2&&Math.abs(y)<=m.b/2;
  const r=Math.hypot(x,y);
  return r<=m.d/2&&(m.s!=='ring'||r>=m.di/2);
}
function magSize(m){return m.s==='box'?Math.max(m.a,m.b,m.h):Math.max(m.d,m.h);}
function magPoleField(m){
  // Induction sur la face nord (tesla) : en son centre ; sur un anneau, à mi-largeur de la matière
  return magField(m,m.s==='ring'?(m.d+m.di)/4:0,0,m.h+1e-6*magSize(m))[2];
}
function magSeeds(m){
  // Points de départ sur la face nord, juste au-dessus d'elle
  const z=m.h+magSize(m)*1e-3,out=[];
  if(m.s==='box'){
    const nx=Math.max(2,Math.round(Math.sqrt(36*m.a/m.b))),ny=Math.max(2,Math.round(36/nx));
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)out.push([m.a*((i+.5)/nx-.5),m.b*((j+.5)/ny-.5),z]);
    return out;
  }
  const r0=m.s==='ring'?m.di/2:0,r1=m.d/2,nr=4;
  for(let i=0;i<nr;i++){
    const r=r0+(r1-r0)*(i+.5)/nr,na=12;
    for(let j=0;j<na;j++){const t=2*Math.PI*(j+(i%2)*.5)/na;out.push([r*Math.cos(t),r*Math.sin(t),z]);}
  }
  return out;
}
function magTrace(m,seed){
  // Suit le champ depuis la face nord (Runge-Kutta 4, pas proportionnel à la pièce) ; fin : retour
  // dans l'aimant (closed) ou sortie de la sphère de 4 fois sa taille → {pts, closed}
  const S=magSize(m),h=S/48,R=4*S,zc=m.h/2,pts=[seed.slice()];
  const dir=(x,y,z)=>{const B=magField(m,x,y,z),n=Math.hypot(B[0],B[1],B[2])||1e-30;return [B[0]/n,B[1]/n,B[2]/n];};
  let p=seed.slice();
  for(let i=0;i<1200;i++){
    const k1=dir(p[0],p[1],p[2]),
      k2=dir(p[0]+h/2*k1[0],p[1]+h/2*k1[1],p[2]+h/2*k1[2]),
      k3=dir(p[0]+h/2*k2[0],p[1]+h/2*k2[1],p[2]+h/2*k2[2]),
      k4=dir(p[0]+h*k3[0],p[1]+h*k3[1],p[2]+h*k3[2]);
    p=[0,1,2].map(j=>p[j]+h/6*(k1[j]+2*k2[j]+2*k3[j]+k4[j]));
    if(!p.every(isFinite))break;
    pts.push(p);
    if(i>1&&magInside(m,p[0],p[1],p[2]))return {pts,closed:true};
    if(Math.hypot(p[0],p[1],p[2]-zc)>R)return {pts,closed:false};
  }
  return {pts,closed:false};
}
function magLines(m){
  // Toutes les lignes de l'aimant. Une ligne qui sort de la sphère est complétée par sa symétrique
  // (plan médian de la pièce) : le côté sud a alors autant de lignes que le côté nord.
  const out=[];
  magSeeds(m).forEach(s=>{
    const T=magTrace(m,s);out.push(T);
    if(!T.closed)out.push({pts:T.pts.map(p=>[p[0],p[1],m.h-p[2]]).reverse(),closed:false,mirror:true});
  });
  return out;
}
function magColor(t){
  // t=0 champ faible (violet) → t=1 champ fort (orange)
  const c=new THREE.Color();c.setHSL((270-255*t)/360,0.85,0.58);return c;
}
function magLineGeo(m){
  // Géométrie des lignes : couleur selon l'intensité (échelle log de 1 mT à Br), flèche au milieu
  const P=[],C=[],lo=Math.log(1e-3),hi=Math.log(Math.max(m.Br,2e-3));
  const col=p=>{const B=magField(m,p[0],p[1],p[2]),n=Math.max(Math.hypot(B[0],B[1],B[2]),1e-6);return magColor(Math.max(0,Math.min(1,(Math.log(n)-lo)/(hi-lo))));};
  const seg=(a,b,c)=>{P.push(a[0],a[1],a[2],b[0],b[1],b[2]);C.push(c.r,c.g,c.b,c.r,c.g,c.b);};
  const S=magSize(m),w=S*0.05;
  magLines(m).forEach(L=>{
    const Q=L.pts,st=Math.max(1,Math.round(Q.length/90));
    let prev=Q[0],c=col(prev),n=0;
    for(let i=st;i<Q.length||prev!==Q[Q.length-1];i+=st){
      const q=Q[Math.min(i,Q.length-1)];c=col(q);seg(prev,q,c);prev=q;
      if(++n>4000)break;
    }
    if(Q.length<4)return;
    // flèche (nord → sud) : le plan de ses deux barbes contient toujours le segment
    const i=Math.floor(Q.length/2),a=Q[i],b=Q[Math.min(i+1,Q.length-1)];
    let d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(d[0],d[1],d[2])||1;d=d.map(v=>v/l);
    let u=[-d[2],0,d[0]]; // perpendiculaire au segment
    if(Math.hypot(u[0],u[1],u[2])<1e-3)u=[1,0,0];
    const lu=Math.hypot(u[0],u[1],u[2]);u=u.map(v=>v/lu);
    const k=col(a),t1=[0,1,2].map(j=>a[j]-w*d[j]+w*.5*u[j]),t2=[0,1,2].map(j=>a[j]-w*d[j]-w*.5*u[j]);
    seg(a,t1,k);seg(a,t2,k);
  });
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
  return g;
}
/* ── V0.70.1 : plusieurs aimants à la fois — champ additionné ──
   Les champs s'ajoutent (superposition) : chaque aimant reste à aimantation uniforme, sans effet
   des autres sur son aimantation (vrai pour le NdFeB et la ferrite loin de leur coercivité).
   M = [{m, F:{o,x,y,z} (repère de l'aimant dans la scène, orthonormé), on}] ; les lignes partent
   de la face nord des aimants « on », et de leur face sud en remontant le champ pour celles
   qui viennent de l'infini (sinon elles seraient comptées deux fois). */
function magToLoc(F,p){const d=[p[0]-F.o[0],p[1]-F.o[1],p[2]-F.o[2]];return [d[0]*F.x[0]+d[1]*F.x[1]+d[2]*F.x[2],d[0]*F.y[0]+d[1]*F.y[1]+d[2]*F.y[2],d[0]*F.z[0]+d[1]*F.z[1]+d[2]*F.z[2]];}
function magToWorld(F,l){return [0,1,2].map(j=>F.o[j]+l[0]*F.x[j]+l[1]*F.y[j]+l[2]*F.z[j]);}
function magFieldMulti(M,p){
  const B=[0,0,0];
  for(const A of M){const l=magToLoc(A.F,p),b=magField(A.m,l[0],l[1],l[2]);for(let j=0;j<3;j++)B[j]+=b[0]*A.F.x[j]+b[1]*A.F.y[j]+b[2]*A.F.z[j];}
  return B;
}
function magInsideMulti(M,p){for(let i=0;i<M.length;i++){const l=magToLoc(M[i].F,p);if(magInside(M[i].m,l[0],l[1],l[2]))return i;}return -1;}
function magSceneBounds(M){
  // centre et rayon de l'ensemble des aimants
  const P=[];M.forEach(A=>{const s=magSize(A.m);[[0,0,0],[0,0,A.m.h]].forEach(l=>P.push({p:magToWorld(A.F,l),s}));});
  const c=[0,1,2].map(j=>P.reduce((t,q)=>t+q.p[j],0)/P.length);
  return {c,r:Math.max(...P.map(q=>Math.hypot(q.p[0]-c[0],q.p[1]-c[1],q.p[2]-c[2])+q.s))};
}
function magTraceMulti(M,seed,step,sign,bd,maxN){
  // → {pts, end : indice de l'aimant atteint, -1 = parti au loin}
  const dir=p=>{const B=magFieldMulti(M,p),n=Math.hypot(B[0],B[1],B[2])||1e-30;return [sign*B[0]/n,sign*B[1]/n,sign*B[2]/n];};
  let p=seed.slice();const pts=[p],R=bd.r*4;
  // pas variable : fin près des aimants, jusqu’à 16 fois plus long loin d'eux (le champ y varie lentement)
  const C=M.map(A=>({c:magToWorld(A.F,[0,0,A.m.h/2]),s:magSize(A.m)}));
  for(let i=0;i<maxN;i++){
    let g=16;for(const q of C){const d=Math.hypot(p[0]-q.c[0],p[1]-q.c[1],p[2]-q.c[2])/q.s;if(d<g)g=d;}
    const h=step*Math.max(1,Math.min(16,g));
    const k1=dir(p),k2=dir(p.map((v,j)=>v+h/2*k1[j])),k3=dir(p.map((v,j)=>v+h/2*k2[j])),k4=dir(p.map((v,j)=>v+h*k3[j]));
    p=p.map((v,j)=>v+h/6*(k1[j]+2*k2[j]+2*k3[j]+k4[j]));
    if(!p.every(isFinite))break;
    pts.push(p);
    if(i>1){const k=magInsideMulti(M,p);if(k>=0)return {pts,end:k};}
    if(Math.hypot(p[0]-bd.c[0],p[1]-bd.c[1],p[2]-bd.c[2])>R)return {pts,end:-1};
  }
  return {pts,end:-2};
}
function magLinesMulti(M,opt){
  // opt.fast : environ 40 lignes en tout, pas double (pendant un déplacement à la souris)
  const fast=opt&&opt.fast,bd=magSceneBounds(M),out=[];
  M.forEach((A,ia)=>{
    if(!A.on)return;
    const S=magSize(A.m),step=S/(fast?12:24),maxN=1500;
    let seeds=magSeeds(A.m);
    if(fast){const n=M.filter(B=>B.on).length,k=Math.max(2,Math.ceil(n*seeds.length/40));seeds=seeds.filter((s,i)=>i%k===0);} // ~40 lignes en tout pendant le déplacement
    seeds.forEach(s=>{
      const T=magTraceMulti(M,magToWorld(A.F,s),step,1,bd,maxN);out.push({pts:T.pts,closed:T.end>=0,from:ia,to:T.end});
      // face sud, en remontant : seulement les lignes venues de loin ou d'un aimant dont on ne trace pas les lignes
      const u=magToWorld(A.F,[s[0],s[1],-magSize(A.m)*1e-3]),Q=magTraceMulti(M,u,step,-1,bd,maxN);
      if(Q.end<0||!M[Q.end].on)out.push({pts:Q.pts.reverse(),closed:false,from:ia,to:-1,back:true});
    });
  });
  return out;
}
function magLineGeoMulti(M,opt){
  // Lignes de l'ensemble, dans le repère de la scène ; couleur = intensité du champ additionné
  const P=[],C=[],brMax=Math.max(...M.map(A=>A.m.Br),2e-3),lo=Math.log(1e-3),hi=Math.log(brMax);
  const col=p=>{const B=magFieldMulti(M,p),n=Math.max(Math.hypot(B[0],B[1],B[2]),1e-6);return magColor(Math.max(0,Math.min(1,(Math.log(n)-lo)/(hi-lo))));};
  const seg=(a,b,c)=>{P.push(a[0],a[1],a[2],b[0],b[1],b[2]);C.push(c.r,c.g,c.b,c.r,c.g,c.b);};
  magLinesMulti(M,opt).forEach(L=>{
    const Q=L.pts,st=Math.max(1,Math.round(Q.length/120)),w=magSize(M[L.from].m)*0.05;
    let prev=Q[0];
    for(let i=st;i<Q.length||prev!==Q[Q.length-1];i+=st){const q=Q[Math.min(i,Q.length-1)];seg(prev,q,col(q));prev=q;}
    if(Q.length<4)return;
    const i=Math.floor(Q.length/2),a=Q[i],b=Q[Math.min(i+1,Q.length-1)];
    let d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(d[0],d[1],d[2])||1;d=d.map(v=>v/l);
    let u=[-d[2],0,d[0]];if(Math.hypot(u[0],u[1],u[2])<1e-3)u=[1,0,0];
    const lu=Math.hypot(u[0],u[1],u[2]);u=u.map(v=>v/lu);
    const k=col(a);seg(a,[0,1,2].map(j=>a[j]-w*d[j]+w*.5*u[j]),k);seg(a,[0,1,2].map(j=>a[j]-w*d[j]-w*.5*u[j]),k);
  });
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
  return g;
}
