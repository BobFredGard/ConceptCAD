/* ---------- engrenages : calcul de la denture (plan docs/plan-engrenages-niveau-1.md) ----------
   Calcul pur, sans noyau ni interface : cotes (ISO 21771) et contour d'une roue extérieure droite
   telle que la taille un outil crémaillère ISO 53 (saillie de dent 1 m, creux 1,25 m, rayon de
   tête d'outil 0,38 m), vu de dessus, dents dans le sens direct.

   Hélicoïdal : m, α et x restent normaux, comme sur la fraise-mère. Tout le contour se calcule dans
   la section droite de la roue (coupe perpendiculaire à l'axe), où l'outil paraît étiré de 1/cos β
   dans le sens tangentiel : module mt = m/cos β, angle αt (tan αt = tan α/cos β), et son arrondi
   devient une ellipse. Cette section tourne ensuite le long de l'axe (76-engrenage).

   Flanc = vraie développante du cercle de base. Point de roulement φ :
     P(φ) = rb·(cos φ + φ·sin φ, sin φ − φ·cos φ)     P'(φ) = rb·φ·(cos φ, sin φ)
   Pied = enveloppe de l'arrondi de tête de l'outil (loi d'engrènement : au contact, la normale de
   l'outil passe par le point de roulement). Un point de l'arrondi, de paramètre γ (l'angle de la
   normale dans le plan normal de l'outil), en coordonnées outil (h radial depuis le primitif,
   Y tangentiel dans la section droite) :
     Y0 = Y + h·cos β·cot γ      θ = −Y0/rp      P = R(−θ)·(rp + h, Y − Y0)
   Si l'outil entame le flanc (φF < 0 : sous-coupe), le pied coupe la développante : le contour
   passe de l'un à l'autre à leur intersection. Sinon ils se raccordent, tangents, en φF.

   Denture intérieure (couronne) : le CREUX d'une dent est la dent d'une roue extérieure de même Z, de
   déport opposé (x > 0 épaissit la dent de la couronne, DIN 3960). Mêmes développantes (gearFlankAt),
   une tête vers l'axe, un pied vers l'extérieur raccordé par un simple arc : la vraie forme dépend de
   l'outil-pignon, et ce pied ne travaille pas. Sous le cercle de base il n'y a plus de développante :
   la tête s'y arrête (dent raccourcie, signalée). Un creux est centré sur +X.

   Chaque courbe va au noyau en B-spline cubique C1 construite sur les valeurs ET les tangentes
   (Hermite à pas constant, nœuds doubles) : une seule arête par courbe, écart bien sous le micron
   (tests/test_engrenages.cjs, qui compare le contour à une simulation indépendante du taillage). */
// Modules proposés dans la fenêtre (ISO 54 à partir de 1) ; tout autre module reste permis.
const GEAR_MODULES=[0.5,0.6,0.8,1,1.25,1.5,2,2.5,3,4,5,6,8,10,12,16,20,25];
const GEAR_FLANK_SEG=6;   // morceaux de B-spline par flanc
const GEAR_ROOT_SEG=32;   // morceaux de B-spline par pied : sa courbure varie beaucoup (écart < 0,0001 m ; 8 morceaux : 0,003 m)
const GEAR_DENSE=40;      // points exacts par courbe : aperçu, aire de référence
const GEAR_PHI_MIN=0.01;  // la développante part du cercle de base avec une tangente nulle : on la prend juste au-dessus
function gearInv(a){return Math.tan(a)-a;}
function gearRackGeom(o){
  // Crémaillère : dents vers +Y, le long de X, centrée sur l'origine, largeur le long de Z, ligne de référence en y = 0.
  // Dans le plan normal, c'est le profil ISO 53 (saillie 1 m, creux 1,25 m, arrondi 0,38 m), à flancs droits.
  // Inclinée (β) : ce profil étiré de 1/cos β selon X, poussé selon X en montant. Main droite : x recule en montant
  // (vue dents vers soi, les dents montent vers la droite, comme sur une roue main droite).
  const m=+o.m,z=Math.round(+o.z),aDeg=+o.alpha,b=+o.b,betaDeg=+o.beta||0,hand=o.hand==='L'?'L':'R',js=+o.j||0;
  if(!(m>0))throw new Error('module invalide');
  if(!(z>=1))throw new Error('il faut au moins une dent');
  if(!(aDeg>0&&aDeg<38))throw new Error('angle de pression invalide');
  if(!(b>0))throw new Error('largeur invalide');
  if(!(betaDeg>=0&&betaDeg<=45))throw new Error('angle d’hélice invalide');
  const a=aDeg*Math.PI/180,ca=Math.cos(a),ta=Math.tan(a),beta=betaDeg*Math.PI/180,cb=Math.cos(beta),tb=Math.tan(beta);
  const rho=m*Math.min(0.38,(Math.PI/4-1.25*ta)/(1/ca-ta)),dC=1.25*m-rho,H=+o.H>0?+o.H:3*m,uTip=Math.PI*m/4-m*ta-js/2;
  if(!(uTip>0))throw new Error('jeu trop grand : la dent n’a plus de sommet');
  return {rack:true,m,z,aDeg,a,b,x:0,betaDeg,beta,hand,cb,at:betaDeg?Math.atan(ta/cb):a,mt:m/cb,H,ya:m,yf:-1.25*m,yb:-1.25*m-H,
    pitch:Math.PI*m,pt:Math.PI*m/cb,L:z*Math.PI*m/cb,rho,dC,uC:Math.PI*m/4-js/2+dC*ta+rho/ca,uTip,j:js,thick:Math.PI*m/2-js,undercut:false,twist:0,
    shift:(hand==='L'?1:-1)*b*tb,overlap:b*Math.sin(beta)/(Math.PI*m)};
}
function gearRackOutline(g,extra){
  // Contour fermé de la section en z = 0, sens direct : {k:'ln',a,b} et {k:'bs',…}. Coupé à mi-creux aux deux bouts :
  // la longueur vaut exactement z pas. extra : dents de plus de chaque côté (balayage oblique, recoupé ensuite).
  const k=extra||0,pm=g.pitch,m=g.m,ta=Math.tan(g.a),sa=Math.sin(g.a),ca=Math.cos(g.a),X=u=>u/g.cb,out=[];
  const uEnd=(g.z/2+k)*pm,xr=X(uEnd),xl=-xr,uTip=g.uTip,uT=g.uC-g.rho*ca,yT=-(g.dC+g.rho*sa);
  let cur=[xl,g.yb];
  const to=q=>{if(Math.hypot(q[0]-cur[0],q[1]-cur[1])>1e-9)out.push({k:'ln',a:cur,b:q});cur=q;};
  const t0=-Math.PI/2,t1=g.a-Math.PI,dt=t1-t0;
  const F=gearHermite(s=>{const t=t0+dt*s;return {p:[X(g.uC+g.rho*Math.cos(t)),-g.dC+g.rho*Math.sin(t)],d:[-X(g.rho*Math.sin(t))*dt,g.rho*Math.cos(t)*dt]};},0,1,4,GEAR_DENSE);
  const right=c=>({k:'bs',poles:F.poles.map(q=>[q[0]+c,q[1]]),knots:F.knots,mults:F.mults,pts:F.pts.map(q=>[q[0]+c,q[1]])});
  const left=c=>({k:'bs',poles:F.poles.slice().reverse().map(q=>[c-q[0],q[1]]),knots:F.knots,mults:F.mults,pts:F.pts.slice().reverse().map(q=>[c-q[0],q[1]])});
  to([xr,g.yb]);to([xr,g.yf]);
  for(let i=g.z-1+k;i>=-k;i--){
    const u=(i-g.z/2+0.5)*pm,c=X(u);
    to([X(u+g.uC),g.yf]);out.push(right(c));cur=[X(u+uT),yT];
    to([X(u+uTip),g.ya]);to([X(u-uTip),g.ya]);to([X(u-uT),yT]);
    out.push(left(c));cur=[X(u-g.uC),g.yf];
  }
  to([xl,g.yf]);to([xl,g.yb]);
  return out;
}
function gearGeom(o){
  if(o.kind==='rack')return gearRackGeom(o);
  // o = {m, z, alpha (degrés), b (largeur), x (déport, en modules), beta (degrés, 0 = droite), hand ('R' main droite, 'L'),
  //      kind ('int' : couronne, sinon extérieure), D (Ø extérieur de couronne, 0 = automatique),
  //      j (amincissement de la dent sur le primitif, plan normal), ks (raccourcissement de tête, en modules) : réglés par la paire} → cotes de la roue
  const m=+o.m,z=Math.round(+o.z),aDeg=+o.alpha,b=+o.b,x=+o.x||0,betaDeg=+o.beta||0,hand=o.hand==='L'?'L':'R',js=+o.j||0,ks=+o.ks||0;
  if(!(m>0))throw new Error('module invalide');
  if(!(z>=6))throw new Error('il faut au moins 6 dents');
  if(!(aDeg>0&&aDeg<45))throw new Error('angle de pression invalide');
  if(!(b>0))throw new Error('largeur invalide');
  if(!(betaDeg>=0&&betaDeg<=45))throw new Error('angle d’hélice invalide');
  const a=aDeg*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),ta=Math.tan(a);
  const beta=betaDeg*Math.PI/180,cb=Math.cos(beta),tb=Math.tan(beta);
  const at=betaDeg?Math.atan(ta/cb):a,mt=m/cb; // section droite : angle et module apparents
  const twist=(hand==='L'?-1:1)*b*tb/(mt*z/2); // rotation de la section sur toute la largeur (main droite : sens direct en montant)
  const overlap=b*Math.sin(beta)/(Math.PI*m);  // recouvrement ε_β
  if(o.kind==='int'){
    const rp=mt*z/2,rb=rp*Math.cos(at),rf=rp+m*(1.25-x),rTip=rp-m*(1+x-ks),rMin=rb*Math.hypot(1,GEAR_PHI_MIN),ra=Math.max(rTip,rMin);
    if(!(rf>ra))throw new Error('déport trop grand : il ne reste plus de flanc');
    const psiB=Math.PI/(2*z)+gearInv(at)-2*x*ta/z+js/(2*cb*rp); // demi-largeur angulaire du CREUX, au cercle de base
    if(!(psiB-gearInv(Math.acos(rb/rf))>0))throw new Error('creux en pointe : le fond de dent n’a plus de largeur, augmentez le déport');
    const psiTip=Math.PI/z-(psiB-gearInv(Math.acos(rb/ra))); // demi-épaisseur angulaire de la dent à sa tête
    if(!(psiTip>0))throw new Error('dent en pointe : son sommet n’a plus de largeur, augmentez le déport');
    const D=+o.D>0?+o.D:Math.ceil(2*(rf+3*m));
    if(!(D>2*rf))throw new Error('Ø extérieur trop petit : il atteint le pied de dent (Ø '+String(+(2*rf).toFixed(2)).replace('.',',')+')');
    return {internal:true,j:js,ks,m,z,aDeg,a,b,x,betaDeg,beta,hand,cb,at,mt,rp,rb,ra,rf,D,psiB,psiTip,tipCut:rTip<rMin,xMaxFull:(rp-rb)/m-1,
      pitch:Math.PI*m,pitchB:Math.PI*mt*Math.cos(at),thick:m*(Math.PI/2+2*x*ta)-js,space:m*(Math.PI/2-2*x*ta)+js,
      rho:0.38*m,undercut:false,tipThick:2*psiTip*ra*Math.cos(Math.atan(ra/rp*tb)),twist,overlap};
  }
  const rp=mt*z/2,rb=rp*Math.cos(at),ra=rp+m*(1+x-ks),rf=rp-m*(1.25-x);
  if(!(rf>0))throw new Error('déport trop négatif : le cercle de pied disparaît');
  // demi-épaisseur angulaire de la dent, au cercle de base
  const psiB=Math.PI/(2*z)+gearInv(at)+2*x*ta/z-js/(2*cb*rp);
  const aTip=Math.acos(Math.min(1,rb/ra)),psiTip=psiB-gearInv(aTip);
  if(!(psiTip>0))throw new Error('dent en pointe : son sommet n’a plus de largeur, réduisez le déport');
  // outil : à fort angle de pression, l'arrondi 0,38 m ne tient plus sur la tête d'outil (tête toute ronde)
  const rho=m*Math.min(0.38,(Math.PI/4-1.25*ta)/(1/ca-ta));
  const dC=1.25*m-rho,yC=(-Math.PI*m/4+js/2-dC*ta-rho/ca)/cb,dT=dC+rho*sa,st=Math.sin(at);
  const phiF=Math.tan(at)-(dT-x*m)/(rb*st); // roulement où le flanc droit de l'outil cesse : < 0 = sous-coupe
  return {j:js,ks,m,z,aDeg,a,b,x,betaDeg,beta,hand,cb,at,mt,rp,rb,ra,rf,psiB,psiTip,pitch:Math.PI*m,pitchB:Math.PI*mt*Math.cos(at),
    thick:m*(Math.PI/2+2*x*ta)-js,rho,dC,yC,phiF,undercut:phiF<0,
    xMin:dT/m-z*st*st/(2*cb),
    tipThick:2*psiTip*ra*Math.cos(Math.atan(ra/rp*tb)), // mesurée perpendiculairement à la dent, à son hélice de tête
    twist,overlap};
}
function gearHermite(fn,t0,t1,n,dense){
  // fn(t) → {p, d (dérivée)} : B-spline cubique C1 de t0 à t1 → {poles, knots, mults, pts}
  const h=(t1-t0)/n,poles=[],knots=[],mults=[],pts=[];
  for(let i=0;i<=n;i++){
    const t=t0+i*h,P=fn(t);
    knots.push(t);mults.push(i===0||i===n?4:2);
    if(i===0)poles.push(P.p);
    if(i>0)poles.push([P.p[0]-P.d[0]*h/3,P.p[1]-P.d[1]*h/3]);
    if(i<n)poles.push([P.p[0]+P.d[0]*h/3,P.p[1]+P.d[1]*h/3]);
    if(i===n)poles.push(P.p);
  }
  for(let i=0;i<=dense;i++)pts.push(fn(t0+(t1-t0)*i/dense).p);
  return {poles,knots,mults,pts};
}
function gearFlankAt(g,phi){
  // point et tangente du flanc BAS de la dent d'axe +X (roulement φ)
  const c=Math.cos(phi),s=Math.sin(phi),C=Math.cos(-g.psiB),S=Math.sin(-g.psiB);
  const rot=q=>[q[0]*C-q[1]*S,q[0]*S+q[1]*C];
  return {p:rot([g.rb*(c+phi*s),g.rb*(s-phi*c)]),d:rot([g.rb*phi*c,g.rb*phi*s])};
}
function gearRootAt(g,gam){
  // point du pied BAS : arrondi de l'outil, paramètre γ (π/2 : fond de dent ; α : fin d'arrondi)
  const qh=g.x*g.m-g.dC-g.rho*Math.sin(gam),qy=g.yC+g.rho*Math.cos(gam)/g.cb;
  const y0=qy+qh*g.cb/Math.tan(gam),th=-y0/g.rp,X=g.rp+qh,Y=qy-y0,c=Math.cos(th),s=Math.sin(th);
  return [X*c+Y*s,-X*s+Y*c];
}
function gearCrossing(g){
  // Sous-coupe : angle γ où le pied coupe la développante, en montant depuis le fond de dent
  const flankAng=r=>-g.psiB+gearInv(Math.acos(g.rb/r));
  const rMin=g.rb*Math.hypot(1,GEAR_PHI_MIN);
  const D=gam=>{const q=gearRootAt(g,gam),r=Math.hypot(q[0],q[1]);return r<rMin?null:Math.atan2(q[1],q[0])-flankAng(r);};
  const N=600,g0=Math.PI/2,g1=g.a;
  let prev=g0;
  for(let i=1;i<=N;i++){
    const gam=g0+(g1-g0)*i/N,d=D(gam);
    if(d!==null&&d<=0){
      let lo=prev,hi=gam; // lo peut être sous le cercle de base (D nul) : il reste du côté « avant le croisement »
      for(let k=0;k<60;k++){const mid=(lo+hi)/2,v=D(mid);if(v!==null&&v<=0)hi=mid;else lo=mid;}
      return hi;
    }
    prev=gam;
  }
  // φF tout juste nul : le pied s'arrête sur le cercle de base, là où la développante commence (effleurement)
  const qE=gearRootAt(g,g1),S=gearFlankAt(g,GEAR_PHI_MIN).p;
  return Math.hypot(qE[0]-S[0],qE[1]-S[1])<1e-3*g.m?g1:null;
}
function gearProfileInt(g){
  // Couronne : flanc et arc de pied du côté BAS du creux d'axe +X, jointifs, de la tête vers le fond.
  // Cercle de rayon ρ dans le creux, tangent au flanc et au cercle de pied. Trop large pour le creux : on le réduit.
  const phi0=Math.sqrt((g.ra/g.rb)*(g.ra/g.rb)-1),phiMax=Math.sqrt((g.rf/g.rb)*(g.rf/g.rb)-1);
  const centre=(phi,rho)=>{ // centre du cercle : à ρ du flanc, côté creux (normale à gauche en montant)
    const F=gearFlankAt(g,phi),L=Math.hypot(F.d[0],F.d[1]);
    return [F.p[0]-rho*F.d[1]/L,F.p[1]+rho*F.d[0]/L];
  };
  let rho=g.rho,phiT=null,C=null;
  for(let k=0;k<40;k++,rho*=0.85){
    let lo=phi0,hi=phiMax;
    const ecart=phi=>{const c=centre(phi,rho);return Math.hypot(c[0],c[1])-(g.rf-rho);};
    if(ecart(lo)<0&&ecart(hi)>0){
      for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(ecart(mid)<0)lo=mid;else hi=mid;}
      const c=centre(hi,rho);
      if(c[1]<-1e-4*g.m){phiT=hi;C=c;break;} // le centre reste du côté bas : il reste un fond de dent entre les deux arcs
    }
  }
  if(C===null)throw new Error('creux trop étroit : le pied de dent ne se raccorde pas');
  const flank=gearHermite(phi=>gearFlankAt(g,phi),phi0,phiT,GEAR_FLANK_SEG,GEAR_DENSE);
  const T=flank.poles[flank.poles.length-1],k=g.rf/Math.hypot(C[0],C[1]),R=[C[0]*k,C[1]*k];
  const a0=Math.atan2(T[1]-C[1],T[0]-C[0]);let a1=Math.atan2(R[1]-C[1],R[0]-C[0]);
  while(a1<=a0)a1+=2*Math.PI; // on tourne à gauche, du flanc vers le fond
  const fillet=gearHermite(t=>({p:[C[0]+rho*Math.cos(t),C[1]+rho*Math.sin(t)],d:[-rho*Math.sin(t),rho*Math.cos(t)]}),a0,a1,4,GEAR_DENSE);
  fillet.poles[0]=T;fillet.pts[0]=T;fillet.poles[fillet.poles.length-1]=R;fillet.pts[fillet.pts.length-1]=R;
  return {flank,fillet,rho};
}
function gearProfile(g){
  // Pied et flanc du côté BAS de la dent d'axe +X, jointifs, du fond de dent vers la tête
  if(g.internal)return gearProfileInt(g);
  const phi1=Math.sqrt((g.ra/g.rb)*(g.ra/g.rb)-1);
  let gamE=g.a,phi0=g.phiF;
  if(g.phiF<GEAR_PHI_MIN){
    gamE=gearCrossing(g);
    if(gamE===null)throw new Error('sous-coupe : le pied de dent ne rejoint pas le flanc');
    const q=gearRootAt(g,gamE);
    phi0=Math.max(GEAR_PHI_MIN,Math.sqrt(Math.max(0,(q[0]*q[0]+q[1]*q[1])/(g.rb*g.rb)-1)));
  }
  if(!(phi0<phi1-1e-6))throw new Error('il ne reste plus de flanc : sous-coupe totale ou déport excessif');
  const flank=gearHermite(phi=>gearFlankAt(g,phi),phi0,phi1,GEAR_FLANK_SEG,GEAR_DENSE);
  const G=t=>Math.PI/2+(gamE-Math.PI/2)*t,e=1e-5;
  const root=gearHermite(t=>{
    const a=gearRootAt(g,G(t-e)),b=gearRootAt(g,G(t+e));
    return {p:gearRootAt(g,G(t)),d:[(b[0]-a[0])/(2*e),(b[1]-a[1])/(2*e)]};
  },0,1,GEAR_ROOT_SEG,GEAR_DENSE);
  // bouts confondus avec leurs voisins exacts : flanc (ici) et cercle de pied (angle yC/rp)
  const S=flank.poles[0],E=root.poles.length-1;
  root.poles[E]=S;root.pts[root.pts.length-1]=S;
  return {flank,root};
}
function gearOutline(g){
  // Contour fermé de la roue, sens direct, sous forme de segments jointifs :
  //   {k:'arc',r,a0,a1 (a1>a0)}  {k:'bs',poles,knots,mults,pts}
  if(g.rack)return gearRackOutline(g);
  const P=gearProfile(g),rot=(q,c)=>{const C=Math.cos(c),S=Math.sin(c);return [q[0]*C-q[1]*S,q[0]*S+q[1]*C];};
  const up=q=>[q[0],-q[1]]; // miroir : côté haut de la dent, parcouru à l'envers
  const fwd=(C,c)=>({k:'bs',poles:C.poles.map(q=>rot(q,c)),knots:C.knots,mults:C.mults,pts:C.pts.map(q=>rot(q,c))});
  const rev=(C,c)=>({k:'bs',poles:C.poles.slice().reverse().map(q=>rot(up(q),c)),
    knots:C.knots.map((v,i)=>C.knots[0]+C.knots[C.knots.length-1]-C.knots[C.knots.length-1-i]),mults:C.mults,
    pts:C.pts.slice().reverse().map(q=>rot(up(q),c))});
  if(g.internal){
    // bord intérieur de la couronne, parcouru dans le sens direct : flanc, arc, fond, arc, flanc, tête
    const S=P.flank.poles[0],R=P.fillet.poles[P.fillet.poles.length-1],aS=Math.atan2(S[1],S[0]),aR=Math.atan2(R[1],R[0]),step=2*Math.PI/g.z,out=[];
    for(let i=0;i<g.z;i++){
      const c=i*step;
      out.push(fwd(P.flank,c),fwd(P.fillet,c));
      out.push({k:'arc',r:g.rf,a0:c+aR,a1:c-aR});
      out.push(rev(P.fillet,c),rev(P.flank,c));
      out.push({k:'arc',r:g.ra,a0:c-aS,a1:c+step+aS});
    }
    return out;
  }
  const Se=P.flank.pts[P.flank.pts.length-1],angE=Math.atan2(Se[1],Se[0]);
  const R0=P.root.poles[0],ang0=Math.atan2(R0[1],R0[0]),step=2*Math.PI/g.z,out=[];
  for(let i=0;i<g.z;i++){
    const c=i*step;
    out.push(fwd(P.root,c),fwd(P.flank,c));
    out.push({k:'arc',r:g.ra,a0:c+angE,a1:c-angE});
    out.push(rev(P.flank,c),rev(P.root,c));
    // fond de dent : absent quand l'outil a une tête toute ronde (les deux pieds se touchent)
    if(step+2*ang0>1e-7)out.push({k:'arc',r:g.rf,a0:c-ang0,a1:c+step+ang0});
  }
  return out;
}
function gearPolyline(g,arcStep,every){
  // Contour en polyligne : aperçu de la fenêtre (every : un point de courbe sur n), aire de référence des tests
  const out=[],da=arcStep||0.02,k=every||1;
  gearOutline(g).forEach(s=>{
    if(s.k==='bs'){for(let i=0;i<s.pts.length-1;i+=k)out.push(s.pts[i]);}
    else if(s.k==='ln')out.push(s.a);
    else{const n=Math.max(1,Math.ceil((s.a1-s.a0)/da));for(let i=0;i<n;i++){const t=s.a0+(s.a1-s.a0)*i/n;out.push([s.r*Math.cos(t),s.r*Math.sin(t)]);}}
  });
  return out;
}
function gearBoreLoop(o){
  // Alésage Ø o.d et rainure de moyeu (largeur o.b, fond à d/2 + o.t2 de l'axe, ISO 773) du côté +X, sous une
  // dent, là où la paroi est la plus épaisse. Sommets de stdLoop : grand arc de bord à bord, puis les 3 côtés.
  const r=o.d/2,h=o.b/2,xe=Math.sqrt(r*r-h*h),xf=r+o.t2;
  return [[xe,h],[xe,-h,{c:[0,0],ccw:true}],[xf,-h],[xf,h]];
}
function gearBoreChecks(g,o){
  // Refuse un alésage qui atteint le pied de dent ; sinon {lvl, txt} comme gearChecks. Repère d'atelier : 2 modules de paroi.
  const f=v=>String(+v.toFixed(2)).replace('.',','),wall=g.rf-(o.d/2+(o.t2||0)),out=[];
  if(o.b&&!(o.d>o.b))throw new Error('alésage plus petit que sa rainure');
  if(!(wall>0))throw new Error('alésage trop grand : '+(o.b?'sa rainure atteint':'il atteint')+' le pied de dent');
  const lab=o.b?'Paroi sous la rainure':'Paroi sous les dents';
  if(wall<2*g.m)out.push({lvl:'warn',txt:lab+' mince : '+f(wall)+' mm (repère usuel : au moins 2 modules, soit '+f(2*g.m)+' mm).'});
  else out.push({lvl:'ok',txt:lab+' : '+f(wall)+' mm.'});
  if(o.b&&g.b<o.b)out.push({lvl:'warn',txt:'Roue plus étroite ('+f(g.b)+' mm) que la rainure ('+f(o.b)+' mm) : la pose automatique de la clavette se trompera de sens.'});
  return out;
}
function gearChecks(g){
  // Contrôles d'une roue seule, pour la fenêtre et le panneau : {lvl:'ok'|'warn', txt}
  const f=v=>String(+v.toFixed(2)).replace('.',','),out=[];
  if(g.rack){
    if(g.H<2*g.m)out.push({lvl:'warn',txt:'Corps mince : '+f(g.H)+' mm sous les dents (repère usuel : au moins 2 modules, soit '+f(2*g.m)+' mm).'});
    else out.push({lvl:'ok',txt:'Corps sous les dents : '+f(g.H)+' mm.'});
    if(g.betaDeg)out.push({lvl:'ok',txt:'Recouvrement ε_β : '+f(g.overlap)+' (dents en prise sur la largeur, en plus du rapport de conduite).'});
    return out;
  }
  if(g.internal){
    if(g.tipCut)out.push({lvl:'warn',txt:'Dents raccourcies : la tête descendrait sous le cercle de base, où la développante n’existe pas. Tête ramenée à Ø '+f(2*g.ra)+'. Il faudrait plus de dents ou un déport x ≤ '+f(Math.floor(g.xMaxFull*100)/100)+'.'});
    if(g.tipThick<0.25*g.m)out.push({lvl:'warn',txt:'Tête de dent très fine ('+f(g.tipThick)+' mm) : fragile à cet endroit. Augmentez le déport ou ajoutez des dents.'});
    else out.push({lvl:'ok',txt:'Épaisseur en tête de dent : '+f(g.tipThick)+' mm.'});
    const rim=g.D/2-g.rf;
    if(rim<2*g.m)out.push({lvl:'warn',txt:'Couronne mince : '+f(rim)+' mm sous les dents (repère usuel : au moins 2 modules, soit '+f(2*g.m)+' mm).'});
    else out.push({lvl:'ok',txt:'Couronne sous les dents : '+f(rim)+' mm.'});
    out.push({lvl:'ok',txt:'Pied de dent en arc simple : la forme réelle dépend de l’outil-pignon.'});
    if(g.betaDeg)out.push({lvl:'ok',txt:'Recouvrement ε_β : '+f(g.overlap)+' (dents en prise sur la largeur, en plus du rapport de conduite).'});
    return out;
  }
  if(g.undercut)out.push({lvl:'warn',txt:'Sous-coupe : le pied de dent est creusé par l’outil, la dent est affaiblie. Déport conseillé : x ≥ '+f(Math.ceil(g.xMin*100)/100)+'.'});
  else out.push({lvl:'ok',txt:'Pas de sous-coupe.'});
  if(g.tipThick<0.25*g.m)out.push({lvl:'warn',txt:'Tête de dent très fine ('+f(g.tipThick)+' mm) : fragile à cet endroit. Réduisez le déport ou ajoutez des dents.'});
  else out.push({lvl:'ok',txt:'Épaisseur en tête de dent : '+f(g.tipThick)+' mm.'});
  if(g.betaDeg)out.push({lvl:'ok',txt:'Recouvrement ε_β : '+f(g.overlap)+' (dents en prise sur la largeur, en plus du rapport de conduite).'});
  return out;
}
/* ── paire : entraxe, jeu, calage, rapport de conduite, contrôles (ISO 21771, DIN 3960) ──
   Pignon extérieur + roue extérieure, couronne ou crémaillère, même module, angle et hélice.
   Le jeu jn (mesuré perpendiculairement aux flancs) s'obtient en amincissant également les deux dentures :
   l'entraxe ne bouge pas. Calage : la dent du pignon entre dans un creux de l'autre pièce, sur la ligne des centres. */
function gearInvRev(v){
  // angle dont la développante vaut v (Newton sur tan a − a)
  let a=Math.cbrt(3*v);
  for(let i=0;i<30;i++){const t=Math.tan(a),d=(t-a-v)/(t*t);a-=d;if(Math.abs(d)<1e-15)break;}
  return a;
}
function gearPair(p){
  // p = {kind ('ext','int','rack'), m, alpha, beta, hand (du pignon), z1, z2, x1, x2, b, jn} →
  //     {o1, o2 (réglages des deux pièces), fr1, fr2 (repères), g1, g2, a, aw, epsA, epsB, ratio, checks, roll(φ)}
  const kind=p.kind==='int'||p.kind==='rack'?p.kind:'ext',z1=Math.round(+p.z1),z2=Math.round(+p.z2),m=+p.m,x1=+p.x1||0,x2=kind==='rack'?0:+p.x2||0;
  const jn=Math.max(0,+p.jn||0),base={m,alpha:+p.alpha,beta:+p.beta||0,b:+p.b};
  const hand1=p.hand==='L'?'L':'R',hand2=kind==='int'?hand1:(hand1==='L'?'R':'L');
  const a0n=base.alpha*Math.PI/180,js=jn/(2*Math.cos(a0n)); // amincissement de chaque dent, sur le primitif, plan normal
  const opt1={k:'gear',...base,z:z1,x:x1,hand:hand1,j:js},opt2={k:'gear',...base,z:z2,x:x2,hand:hand2,j:js};
  if(kind==='int'){opt2.kind='int';if(+p.D>0)opt2.D=+p.D;}
  if(kind==='rack'){opt2.kind='rack';if(+p.H>0)opt2.H=+p.H;}
  if(kind==='int'&&!(z2>z1))throw new Error('la couronne doit avoir plus de dents que le pignon');
  let g1=gearGeom(opt1),g2=gearGeom(opt2);
  const at=g1.at,ta=Math.tan(g1.a),rp1=g1.rp,rb1=g1.rb,pb=g1.pitchB;
  let a,aw;
  if(kind==='rack'){a=rp1+x1*m;aw=at;}
  else{
    const zs=kind==='int'?z2-z1:z1+z2,xs=kind==='int'?-(x1+x2):x1+x2,inv=gearInv(at)+2*xs*ta/zs;
    if(!(inv>0))throw new Error('déports trop négatifs : les roues ne peuvent plus se rapprocher autant');
    aw=gearInvRev(inv);
    a=(kind==='int'?g2.rp-rp1:rp1+g2.rp)*Math.cos(at)/Math.cos(aw);
  }
  // têtes raccourcies pour garder 0,25 m au fond de dent quand le déport écarte les roues moins que prévu
  const c0=0.25*m;
  if(kind==='ext'){opt1.k2=Math.max(0,(g1.ra-(a-g2.rf-c0))/m);opt2.k2=Math.max(0,(g2.ra-(a-g1.rf-c0))/m);}
  if(kind==='int'){
    // couronne : sa tête doit aussi s'arrêter avant le pied du pignon, là où sa développante commence
    const raNeed=Math.hypot(g2.rb,a*Math.sin(aw)+gearProfile(g1).flank.knots[0]*g1.rb+1e-3*m);
    opt1.k2=Math.max(0,(g1.ra-(g2.rf-c0-a))/m);
    opt2.k2=Math.max(0,(a+g1.rf+c0-g2.ra)/m,(raNeed-g2.ra)/m);
  }
  [opt1,opt2].forEach(o=>{const v=o.k2;delete o.k2;if(v>1e-9)o.ks=v;});
  g1=gearGeom(opt1);g2=gearGeom(opt2);
  // repères : pignon dent vers l'autre pièce ; l'autre pièce présente un creux
  let fr1,fr2,th1,th2,c1,c2,reach,sens;
  if(kind==='ext'){c1=[0,0];c2=[a,0];th1=0;th2=Math.PI-Math.PI/z2;reach=g1.ra;sens=-z1/z2;}
  else if(kind==='int'){c2=[0,0];c1=[a,0];th1=0;th2=0;reach=g2.D/2;sens=z1/z2;}
  else{c2=[0,0];c1=[z2%2?g2.pt/2:0,a];th1=-Math.PI/2;th2=0;reach=g2.L/2;sens=rp1;} // crémaillère : glisse de rp·φ
  const frm=(c,t)=>({o:[c[0],c[1],0],x:[Math.cos(t),Math.sin(t),0],y:[-Math.sin(t),Math.cos(t),0],z:[0,0,1]});
  fr1=frm(c1,th1);fr2=frm(c2,th2);
  const roll=phi=>kind==='rack'?{fr1:frm(c1,th1+phi),fr2:frm([sens*phi,0],0)}:{fr1:frm(c1,th1+phi),fr2:frm(c2,th2+sens*phi)};
  // rapport de conduite, le long de la ligne d'action
  const rho=g=>Math.sqrt(g.ra*g.ra-g.rb*g.rb),L=a*Math.sin(aw);
  let epsA;
  if(kind==='ext')epsA=(rho(g1)+rho(g2)-L)/pb;
  else if(kind==='int')epsA=(rho(g1)-rho(g2)+L)/pb;
  else epsA=(rho(g1)-rp1*Math.sin(at)+(g2.ya-x1*m)/Math.sin(at))/pb;
  const epsB=g1.overlap;
  // contrôles
  const f=v=>String(+v.toFixed(2)).replace('.',','),checks=[],lab2=kind==='int'?'Couronne':kind==='rack'?'Crémaillère':'Roue';
  const P1=gearProfile(g1),flank1=P1.flank.knots[0]*g1.rb; // où commence la vraie développante du pignon, le long de la ligne d'action
  if(epsA<1)checks.push({lvl:'warn',txt:'Rapport de conduite '+f(epsA)+', sous 1 : les dents se lâchent avant que la suivante prenne le relais.'});
  else if(epsA<1.2)checks.push({lvl:'warn',txt:'Rapport de conduite faible : '+f(epsA)+' (repère usuel : au moins 1,2).'});
  else checks.push({lvl:'ok',txt:'Rapport de conduite : '+f(epsA)+(g1.betaDeg?' (total avec le recouvrement : '+f(epsA+epsB)+')':'')+'.'});
  const bad=(q,who)=>checks.push({lvl:'warn',txt:'Interférence : '+who+'. Il faut un déport, plus de dents ou un plus grand angle de pression.'});
  const tolI=1e-3*m; // sous cette valeur, l'écart vient de l'arrondi de l'outil simulé, pas d'un vrai contact
  let ok=true;
  if(kind==='ext'){
    const P2=gearProfile(g2),flank2=P2.flank.knots[0]*g2.rb;
    if(L-rho(g2)<flank1-tolI){bad(0,'la tête de la roue attaque le pied du pignon');ok=false;}
    if(L-rho(g1)<flank2-tolI){bad(0,'la tête du pignon attaque le pied de la roue');ok=false;}
  }else if(kind==='int'){
    const P2=gearProfile(g2),lim2=P2.flank.knots[P2.flank.knots.length-1]*g2.rb;
    if(rho(g2)-L<flank1-tolI){bad(0,'la tête de la couronne attaque le pied du pignon');ok=false;}
    if(rho(g1)+L>lim2+tolI){bad(0,'la tête du pignon dépasse le flanc de la couronne');ok=false;}
    if(z2-z1<10){checks.push({lvl:'warn',txt:'Couronne et pignon trop proches : '+(z2-z1)+' dents d’écart (repère usuel : au moins 10), les têtes risquent de se toucher hors de la ligne d’action.'});ok=false;}
  }else{
    if(rp1*Math.sin(at)-(g2.ya-x1*m)/Math.sin(at)<flank1-tolI){bad(0,'la tête de la crémaillère attaque le pied du pignon');ok=false;}
  }
  if(ok)checks.push({lvl:'ok',txt:'Pas d’interférence sur la ligne d’action.'});
  if(g1.ks||g2.ks)checks.push({lvl:'ok',txt:'Têtes raccourcies pour garder le jeu au fond de dent'+(g1.ks?' (pignon : '+f(g1.ks*m)+' mm)':'')+(g2.ks?' ('+lab2.toLowerCase()+' : '+f(g2.ks*m)+' mm)':'')+'.'});
  if(jn===0)checks.push({lvl:'warn',txt:'Jeu nul : les flancs se touchent des deux côtés. Prévoyez un jeu pour une pièce réelle.'});
  gearChecks(g1).filter(c=>c.lvl==='warn').forEach(c=>checks.push({lvl:'warn',txt:'Pignon : '+c.txt}));
  gearChecks(g2).filter(c=>c.lvl==='warn').forEach(c=>checks.push({lvl:'warn',txt:lab2+' : '+c.txt}));
  checks.push({lvl:'ok',txt:'Contrôle géométrique seulement : la résistance des dents n’est pas calculée.'});
  return {kind,o1:opt1,o2:opt2,g1,g2,fr1,fr2,a,aw,awDeg:aw*180/Math.PI,epsA,epsB,ratio:kind==='rack'?null:z2/z1,reach,roll,checks,jn,js,hand1,hand2};
}
function gearHandsOk(kind,h1,h2){
  // Sens d'hélice compatibles : extérieure et crémaillère en sens opposés, couronne dans le même sens
  return kind==='int'?h1===h2:h1!==h2;
}
