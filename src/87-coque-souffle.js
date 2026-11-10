/* ---------- coque soufflée (enveloppe extérieure lisse) — V0.79.0 ----------
   Demande de Fred (10/11, barquette SIRAP-14-001) : une coque qui n'est PAS une parallèle exacte,
   mais « comme si on soufflait de l'air sur une face » : une peau lisse qui épouse l'extérieur de la
   pièce à une DISTANCE donnée (4 à 5 mm), enjambe les creux étroits au lieu d'y plonger, et reste
   ouverte du côté de la face choisie.

   Précision de Fred le même jour : « garder la partie extérieure telle quelle et pousser la face
   sélectionnée vers l'intérieur … jusqu'à 5 mm de la face extérieure ». C'est le mode par défaut
   (f.vers 'int') : la face s'enfonce dans la pièce, la pièce est creusée avec une paroi de f.dist
   qui suit l'extérieur ; le premier essai, une peau AUTOUR de la pièce, reste en f.vers 'ext'.
   Creuser = ouverture morphologique de la zone à ≥ dist de l'extérieur (soufCreux), refermée par
   couture : la face poussée percée du creux + les autres faces de la pièce + le fond du creux.

   Réglages (fonction xshell, f.kind === 'souffle') :
     f.faces[0]  la face « poussée » (plan d'ouverture) ; le SENS de poussée part de cette face vers
                 la matière, f.flip l'inverse ;
     f.dist      distance peau ↔ pièce (mm) ;
     f.pont      la « force » du souffle, en mm : largeur des creux enjambés. Une bille de diamètre
                 f.pont roule sur la pièce épaissie : les creux plus étroits sont enjambés, les plus
                 larges suivis et arrondis. Petit = souffle fort (peau plaquée), grand = souffle doux
                 (peau tendue). 0 = parallèle pure, aucun pont ;
     f.pas       pas de la grille (1 mm par défaut ; l'aperçu calcule à 2 mm) ;
     f.plein     true : le bloc entier (pièce + peau) ; sinon la coque seule (enveloppe − pièce).

   Calcul (morphologie sur une carte de profondeur, comme le passage d'une fraise boule en FAO) :
     1. carte H(u,v) = profondeur la plus basse de la matière, vue depuis la face, sur une grille h ;
     2. dilatation par une boule de rayon ρ = dist + r (r = pont / 2) → hauteur des centres C ;
     3. érosion par une boule de rayon r → peau E (fermeture morphologique de la pièce
        épaissie de dist) ; hors de l'empreinte, E = −∞ (pas de peau) ;
     4. surface B-spline bicubique dont les PÔLES sont les valeurs de la grille (pas d'interpolation :
        pas d'ondulation, la surface reste dans l'enveloppe convexe des points), détourée par son
        propre bord dans le plan de la face (tracé dans ses paramètres), fermée par la face plane
        et cousue — avec les faces de la pièce pour la coque, sans aucun booléen.
   Barquette SIRAP-14-001 (410 faces), 5 mm, creux de 20 mm : environ 4 s ; soustraire la pièce
   d'une enveloppe par le noyau prenait 4 min 37 s, et couper la grande surface au plan de la face
   échouait au pas de 1 mm (d'où le bord tracé ici).
   La surface est une « carte de hauteur » : la peau ne passe jamais sous une contre-dépouille
   (vue depuis la face), elle descend droit et l'enjambe — comme une feuille thermoformée. */
const SOUF_PAS_MAX_CELLULES=420000; // grille plafonnée : au-delà, le pas grandit
const SOUF_DEF={dist:5,pont:20,lis:3};
function soufLis(f){return f&&f.lis!=null&&isFinite(+f.lis)?Math.max(0,+f.lis):SOUF_DEF.lis;}
function soufPas(f){return +f.pas>0?+f.pas:1;}
function soufRayon(f){return Math.max(0,+f.pont||0)/2;}
function soufPrecision(val,fn){
  // liste « Précision » : pas de la grille de calcul
  const s=document.createElement('select');
  [[1,'Normale (1 mm)'],[0.5,'Fine (0,5 mm, plus lent)']].forEach(([v,t])=>{const o=document.createElement('option');o.value=String(v);o.textContent=t;if(Math.abs(v-val)<1e-9)o.selected=true;s.appendChild(o);});
  s.onchange=()=>fn(+s.value);
  return s;
}
function soufFr(x){return String(Math.round((+x||0)*100)/100).replace('.',',');}
function soufName(f){
  if(soufVers(f)==='int')return `Coque soufflée · paroi ${soufFr(f.dist)} mm · creux de ${soufFr(f.pont)} mm enjambés`;
  return `Peau soufflée ${soufFr(f.dist)} mm · creux de ${soufFr(f.pont)} mm enjambés`+(f.plein?' · bloc plein':'');
}
function soufSig(f){return [soufVers(f),+f.dist||0,+f.pont||0,f.flip?1:0,f.plein?1:0,soufPas(f),soufLis(f)].join(',');}
function soufRepere(face,result,flip){
  // Repère de la face poussée : origine O sur le plan, d = sens de poussée (vers la matière),
  // e1/e2 dans le plan. → {o,d,e1,e2} ou null (face non plane).
  let ad=null;
  try{
    ad=new occt.BRepAdaptor_Surface_2(face,true);
    if(ad.GetType()!==occt.GeomAbs_SurfaceType.GeomAbs_Plane)return null;
  }catch(e){return null;}
  finally{try{if(ad)ad.delete();}catch(e){}}
  const r=occFaceRef(face);if(!r||!r.n||!r.pos)return null;
  const n=r.n.slice(),l=Math.hypot(n[0],n[1],n[2])||1;n[0]/=l;n[1]/=l;n[2]/=l;
  const o=r.pos.slice();
  // sens vers la matière : le centre de la boîte de la pièce est du côté de d
  const b=occBoxMinMax(result),c=[0,1,2].map(i=>(b.lo[i]+b.hi[i])/2);
  let s=(c[0]-o[0])*n[0]+(c[1]-o[1])*n[1]+(c[2]-o[2])*n[2];
  let d=s>=0?n:n.map(x=>-x);
  if(flip)d=d.map(x=>-x);
  return soufAxes(o,d);
}
function soufAxes(o,d){
  // e1 = X du monde projeté dans le plan (Y s'il est presque normal), e2 = d × e1
  let a=Math.abs(d[0])<0.9?[1,0,0]:[0,1,0];
  const k=a[0]*d[0]+a[1]*d[1]+a[2]*d[2];
  let e1=[a[0]-k*d[0],a[1]-k*d[1],a[2]-k*d[2]];const l=Math.hypot(...e1);e1=e1.map(x=>x/l);
  const e2=[d[1]*e1[2]-d[2]*e1[1],d[2]*e1[0]-d[0]*e1[2],d[0]*e1[1]-d[1]*e1[0]];
  return {o,d,e1,e2};
}
function soufCarte(pos,R,h,marge,premier){
  // 1. Carte de profondeur sur la grille : H = profondeur la plus basse de la matière
  // (NaN = pas de matière). Triangles projetés + arêtes échantillonnées (parois verticales).
  // premier (creuser) : H = première sortie de la matière en descendant depuis la face poussée
  // (la plus petite profondeur > 0 : la face elle-même, à 0, ne compte pas).
  const n=pos.length/3,U=new Float64Array(n),V=new Float64Array(n),W=new Float64Array(n);
  let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
  for(let i=0;i<n;i++){
    const x=pos[3*i]-R.o[0],y=pos[3*i+1]-R.o[1],z=pos[3*i+2]-R.o[2];
    U[i]=x*R.e1[0]+y*R.e1[1]+z*R.e1[2];V[i]=x*R.e2[0]+y*R.e2[1]+z*R.e2[2];W[i]=x*R.d[0]+y*R.d[1]+z*R.d[2];
    if(U[i]<u0)u0=U[i];if(U[i]>u1)u1=U[i];if(V[i]<v0)v0=V[i];if(V[i]>v1)v1=V[i];
  }
  // pas : grandi si la grille dépasse le plafond
  while(((u1-u0+2*marge)/h+1)*((v1-v0+2*marge)/h+1)>SOUF_PAS_MAX_CELLULES)h*=1.25;
  u0-=marge;v0-=marge;
  const nu=Math.ceil((u1+marge-u0)/h)+1,nv=Math.ceil((v1+marge-v0)/h)+1;
  const H=new Float32Array(nu*nv).fill(NaN);
  const put=premier
    ?(i,j,w)=>{if(w<=1e-4||i<0||j<0||i>=nu||j>=nv)return;const k=j*nu+i;const c=H[k];if(!(c<=w))H[k]=w;}
    :(i,j,w)=>{if(i<0||j<0||i>=nu||j>=nv)return;const k=j*nu+i;const c=H[k];if(!(c>=w))H[k]=w;};
  for(let t=0;t<n;t+=3){
    const ua=U[t],va=V[t],wa=W[t],ub=U[t+1],vb=V[t+1],wb=W[t+1],uc=U[t+2],vc=V[t+2],wc=W[t+2];
    // arêtes et sommets : au plus proche nœud (parois parallèles au sens, triangles minces)
    for(const [pu,pv,pw,qu,qv,qw] of [[ua,va,wa,ub,vb,wb],[ub,vb,wb,uc,vc,wc],[uc,vc,wc,ua,va,wa]]){
      const L=Math.hypot(qu-pu,qv-pv),m=Math.max(1,Math.ceil(L/(h*0.5)));
      for(let s=0;s<=m;s++){const a=s/m;put(Math.round((pu+a*(qu-pu)-u0)/h),Math.round((pv+a*(qv-pv)-v0)/h),pw+a*(qw-pw));}
    }
    const det=(vb-vc)*(ua-uc)+(uc-ub)*(va-vc);
    if(Math.abs(det)<1e-12)continue;
    const i0=Math.max(0,Math.ceil((Math.min(ua,ub,uc)-u0)/h)),i1=Math.min(nu-1,Math.floor((Math.max(ua,ub,uc)-u0)/h));
    const j0=Math.max(0,Math.ceil((Math.min(va,vb,vc)-v0)/h)),j1=Math.min(nv-1,Math.floor((Math.max(va,vb,vc)-v0)/h));
    for(let j=j0;j<=j1;j++){
      const pv=v0+j*h;
      for(let i=i0;i<=i1;i++){
        const pu=u0+i*h;
        const l1=((vb-vc)*(pu-uc)+(uc-ub)*(pv-vc))/det,l2=((vc-va)*(pu-uc)+(ua-uc)*(pv-vc))/det,l3=1-l1-l2;
        if(l1<-1e-9||l2<-1e-9||l3<-1e-9)continue;
        put(i,j,l1*wa+l2*wb+l3*wc);
      }
    }
  }
  // la matière au-dessus du plan compte comme une colonne qui part du plan (prisme vers −d)
  if(!premier)for(let k=0;k<H.length;k++)if(H[k]<0)H[k]=0;
  return {H,nu,nv,u0,v0,h};
}
function soufNoyau(rayon,h){
  // disque de rayon `rayon` par rangées : pour chaque dj, demi-largeur a et hauteurs de la
  // calotte s[di + a] = sqrt(r² − d²)
  const n=Math.floor(rayon/h),L=[];
  for(let j=-n;j<=n;j++){
    const r2=rayon*rayon-j*j*h*h;if(r2<0)continue;
    const a=Math.floor(Math.sqrt(r2)/h+1e-9),s=new Float32Array(2*a+1);
    for(let i=-a;i<=a;i++)s[i+a]=Math.sqrt(Math.max(0,r2-i*i*h*h));
    L.push({dj:j,a,s});
  }
  return L;
}
function soufPeau(G,dist,rayon){
  // 2-3. Fermeture morphologique de la pièce épaissie de `dist` par une bille de rayon `rayon`.
  // Rend E (Float32Array, −Infinity = pas de peau). Parcours par rangées contiguës (pas de test
  // de bord dans la boucle intérieure) ; NaN (pas de matière) ne gagne jamais un maximum.
  const {H,nu,nv,h}=G,N=nu*nv;
  const K=soufNoyau(dist+Math.max(0,rayon),h);
  const C=new Float32Array(N);
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
    let m=-Infinity;
    for(const r of K){
      const jj=j+r.dj;if(jj<0||jj>=nv)continue;
      const a=r.a,s=r.s,lo=Math.max(-a,-i),hi=Math.min(a,nu-1-i),base=jj*nu+i;
      for(let d=lo;d<=hi;d++){const x=H[base+d]+s[d+a];if(x>m)m=x;}
    }
    C[j*nu+i]=m;
  }
  if(!(rayon>h*0.5))return C;
  const B=soufNoyau(rayon,h);
  const E=new Float32Array(N).fill(-Infinity);
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
    if(C[j*nu+i]===-Infinity)continue;
    let m=Infinity;
    for(const r of B){
      const jj=j+r.dj,a=r.a;
      if(jj<0||jj>=nv||i-a<0||i+a>=nu){m=-Infinity;break;} // hors grille : la bille y est libre
      const s=r.s,base=jj*nu+i;
      for(let d=-a;d<=a;d++){const x=C[base+d]-s[d+a];if(x<m)m=x;}
      if(m===-Infinity)break;
    }
    E[j*nu+i]=m;
  }
  return E;
}
function soufCreux(G,dist,rayon){
  // Creuser : la face poussée descend dans la pièce jusqu'à `dist` de l'extérieur. Ouverture
  // morphologique de la zone permise (points à ≥ dist de l'extérieur) par une bille de rayon
  // `rayon` poussée depuis la face : elle n'entre pas dans les poches plus étroites que 2 × rayon.
  // 1) centres de bille permis : C = min (H − calotte ρ), ρ = dist + rayon ; une colonne sans
  //    matière (NaN) ou hors grille dans le disque interdit le centre (−∞) ;
  // 2) fond du creux F = max (C + calotte rayon). −∞ = pas de creux.
  const {H,nu,nv,h}=G,N=nu*nv;
  const K=soufNoyau(dist+Math.max(0,rayon),h);
  const C=new Float32Array(N);
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
    let m=Infinity;
    for(const r of K){
      const jj=j+r.dj,a=r.a;
      if(jj<0||jj>=nv||i-a<0||i+a>=nu){m=-Infinity;break;}
      const s=r.s,base=jj*nu+i;
      for(let d=-a;d<=a;d++){const w=H[base+d];if(!(w===w)){m=-Infinity;break;}const x=w-s[d+a];if(x<m)m=x;}
      if(m===-Infinity)break;
    }
    C[j*nu+i]=m;
  }
  if(!(rayon>h*0.5))return C;
  const B=soufNoyau(rayon,h);
  const F=new Float32Array(N);
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
    let m=-Infinity;
    for(const r of B){
      const jj=j+r.dj;if(jj<0||jj>=nv)continue;
      const a=r.a,s=r.s,lo=Math.max(-a,-i),hi=Math.min(a,nu-1-i),base=jj*nu+i;
      for(let d=lo;d<=hi;d++){const x=C[base+d]+s[d+a];if(x>m)m=x;}
    }
    F[j*nu+i]=m;
  }
  return F;
}
function soufLisse(E,G,lis,creux){
  // Lissage (V0.79) : arrondit les plis de la surface calculée E sans jamais rapprocher la paroi
  // de l'extérieur. Moyenne glissante (rayon lis) répétée, bornée par la surface d'origine du côté
  // sûr : creuser → jamais plus profond (min), peau → jamais plus près (max). Les plis rentrants
  // (bas des bosses, raccords) s'arrondissent, la paroi n'y gagne que quelques dixièmes.
  const {nu,nv,h}=G,N=nu*nv,k=Math.round(lis/h);
  if(!(k>=1))return E;
  const S=Float32Array.from(E),T=new Float32Array(N),U=new Float32Array(N);
  const ok=x=>x>-Infinity&&x<Infinity;
  const passe=(src,dst,du,dv)=>{
    for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
      const c=j*nu+i;if(!ok(src[c])){dst[c]=src[c];continue;}
      let sm=0,w=0;
      for(let d=-k;d<=k;d++){
        const ii=i+d*du,jj=j+d*dv;if(ii<0||jj<0||ii>=nu||jj>=nv)continue;
        const x=src[jj*nu+ii];if(ok(x)){sm+=x;w++;}
      }
      dst[c]=sm/w;
    }
  };
  for(let it=0;it<3;it++){
    passe(S,T,1,0);passe(T,U,0,1);
    for(let c=0;c<N;c++){const e=E[c];if(!ok(e)){S[c]=e;continue;}const u=U[c];S[c]=creux?(u<e?u:e):(u>e?u:e);}
  }
  return S;
}
function soufNoeuds(n){
  // nœuds complets (n+4) d'une B-spline cubique bornée, uniforme, à n pôles
  const M=n-2,T=new Float64Array(n+4);
  for(let i=0;i<n+4;i++){const k=i-3;T[i]=k<=0?0:k>=M-1?1:k/(M-1);}
  return T;
}
function soufBase(T,n,s,N){
  // fonctions de base non nulles en s (Piegl & Tiller A2.2) → indice du 1ᵉʳ pôle concerné
  const i=3+Math.max(0,Math.min(n-4,Math.floor(s*(n-3))));
  const L=[0,0,0,0],Rr=[0,0,0,0];N[0]=1;
  for(let j=1;j<=3;j++){
    L[j]=s-T[i+1-j];Rr[j]=T[i+j]-s;let sv=0;
    for(let r=0;r<j;r++){const tp=N[r]/(Rr[r+1]+L[j-r]);N[r]=sv+Rr[r+1]*tp;sv=L[j-r]*tp;}
    N[j]=sv;
  }
  return i-3;
}
function soufBord(Wp,nu,nv){
  // Bord de la peau dans l'espace des paramètres (s,t) ∈ [0,1]² : courbes où la surface
  // traverse le plan de la face (w = 0), par carrés marchants sur un échantillonnage de la
  // surface EXACTE (mêmes nœuds, mêmes pôles), points affinés par dichotomie. → [[s,t]…] fermées.
  const TU=soufNoeuds(nu),TV=soufNoeuds(nv);
  const Nu=[0,0,0,0],Nv=[0,0,0,0];
  const w=(s,t)=>{
    const iu=soufBase(TU,nu,s,Nu),iv=soufBase(TV,nv,t,Nv);let x=0;
    for(let b=0;b<4;b++){const r=(iv+b)*nu+iu;x+=Nv[b]*(Nu[0]*Wp[r]+Nu[1]*Wp[r+1]+Nu[2]*Wp[r+2]+Nu[3]*Wp[r+3]);}
    return x;
  };
  const ns=2*(nu-3)+1,nt=2*(nv-3)+1,S=k=>k/(ns-1),T=k=>k/(nt-1);
  const F=new Float64Array(ns*nt);
  for(let b=0;b<nt;b++)for(let a=0;a<ns;a++){let x=w(S(a),T(b));if(x===0)x=1e-12;F[b*ns+a]=x;}
  const pts=new Map(); // arête d'échantillonnage → point (s,t) affiné
  const pt=(a,b,hor)=>{
    const key=(hor?'h':'v')+a+','+b;if(pts.has(key))return key;
    let s0=S(a),t0=T(b),s1=hor?S(a+1):s0,t1=hor?t0:T(b+1);
    const f0=F[b*ns+a];
    for(let it=0;it<40;it++){
      const sm=(s0+s1)/2,tm=(t0+t1)/2,fm=w(sm,tm);
      if((fm>0)===(f0>0)){s0=sm;t0=tm;}else{s1=sm;t1=tm;}
    }
    pts.set(key,[(s0+s1)/2,(t0+t1)/2]);return key;
  };
  const voisins=new Map();
  const lie=(k1,k2)=>{[[k1,k2],[k2,k1]].forEach(([x,y])=>{let l=voisins.get(x);if(!l)voisins.set(x,l=[]);l.push(y);});};
  for(let b=0;b<nt-1;b++)for(let a=0;a<ns-1;a++){
    const f00=F[b*ns+a],f10=F[b*ns+a+1],f01=F[(b+1)*ns+a],f11=F[(b+1)*ns+a+1];
    const c=(f00>0?1:0)|(f10>0?2:0)|(f11>0?4:0)|(f01>0?8:0);
    if(c===0||c===15)continue;
    const Bs=()=>pt(a,b,true),Rt=()=>pt(a+1,b,false),Tp=()=>pt(a,b+1,true),Lf=()=>pt(a,b,false);
    switch(c){
      case 1:case 14:lie(Lf(),Bs());break;
      case 2:case 13:lie(Bs(),Rt());break;
      case 4:case 11:lie(Rt(),Tp());break;
      case 8:case 7:lie(Tp(),Lf());break;
      case 3:case 12:lie(Lf(),Rt());break;
      case 6:case 9:lie(Bs(),Tp());break;
      case 5:case 10:{
        const mid=w((S(a)+S(a+1))/2,(T(b)+T(b+1))/2)>0;
        if((c===5)===mid){lie(Lf(),Tp());lie(Bs(),Rt());}else{lie(Lf(),Bs());lie(Rt(),Tp());}
        break;
      }
    }
  }
  const vus=new Set(),boucles=[];
  for(const k0 of voisins.keys()){
    if(vus.has(k0))continue;
    const L=[];let prev=null,cur=k0;
    while(cur&&!vus.has(cur)){vus.add(cur);L.push(pts.get(cur));const nx=(voisins.get(cur)||[]).find(y=>y!==prev&&!vus.has(y));prev=cur;cur=nx;}
    if(L.length>=8)boucles.push(L);
  }
  return boucles;
}
function soufAire2(L){let a=0;for(let i=0;i<L.length;i++){const p=L[i],q=L[(i+1)%L.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;}
function soufDedans(p,L){
  let c=false;
  for(let i=0,j=L.length-1;i<L.length;j=i++){const a=L[i],b=L[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}
  return c;
}
function soufSolide(G,E,R,trou){
  // 4. Solide : surface B-spline bicubique (pôles = grille), détourée par son propre bord dans le
  // plan de la face (courbe tracée dans ses paramètres), refermée par la face plane du dessus et
  // cousue. trou (facultatif) = {fil, faces} : contour extérieur de la face poussée et autres faces
  // de la pièce — la face du dessus devient un anneau et la coque se ferme sur la pièce, sans
  // opération booléenne (une soustraction de la pièce prenait 4 min 37 s sur la barquette).
  const {nu,nv,u0,v0,h}=G;
  const cap=2*h; // hors peau : la surface passe au-dessus du plan
  const Wp=new Float64Array(nu*nv);
  for(let k=0;k<Wp.length;k++){const w=E[k];Wp[k]=w>-cap?w:-cap;}
  const bin=[];
  const W=(u,v,w)=>[R.o[0]+u*R.e1[0]+v*R.e2[0]+w*R.d[0],R.o[1]+u*R.e1[1]+v*R.e2[1]+w*R.d[1],R.o[2]+u*R.e1[2]+v*R.e2[2]+w*R.d[2]];
  try{
    const A=occBinPush(bin,new occt.NCollection_Array2_gp_Pnt_2(1,nu,1,nv));
    const pt=occBinPush(bin,new occt.gp_Pnt_1());
    for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
      const p=W(u0+i*h,v0+j*h,Wp[j*nu+i]);pt.SetCoord_2(p[0],p[1],p[2]);A.SetValue(i+1,j+1,pt);
    }
    const kn=n=>{ // nœuds uniformes, bornés (multiplicité 4 aux extrémités) — comme soufNoeuds
      const m=n-2,K=occBinPush(bin,new occt.TColStd_Array1OfReal_2(1,m)),M=occBinPush(bin,new occt.TColStd_Array1OfInteger_2(1,m));
      for(let i=1;i<=m;i++){K.SetValue(i,(i-1)/(m-1));M.SetValue(i,(i===1||i===m)?4:1);}
      return [K,M];
    };
    const [KU,MU]=kn(nu),[KV,MV]=kn(nv);
    const S=occBinPush(bin,new occt.Geom_BSplineSurface_1(A,KU,KV,MU,MV,3,3,false,false));
    // bords (s,t) : extérieurs (profondeur paire) avec leurs trous (profondeur impaire)
    const B=soufBord(Wp,nu,nv);
    if(!B.length)throw new Error('aucune peau (distance trop faible ?)');
    const aire=B.map(L=>Math.abs(soufAire2(L)));
    const prof=B.map((L,i)=>B.reduce((n,M,j)=>n+(j!==i&&aire[j]>aire[i]&&soufDedans(L[0],M)?1:0),0));
    const arete=(L,ccw)=>{
      // pcourbe périodique interpolée, sens imposé (matière à gauche)
      const P=L.slice();if((soufAire2(P)>0)!==ccw)P.reverse();
      const Q=[];P.forEach(p=>{const q=Q[Q.length-1];if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>1e-9)Q.push(p);});
      if(Q.length>1&&Math.hypot(Q[0][0]-Q[Q.length-1][0],Q[0][1]-Q[Q.length-1][1])<1e-9)Q.pop();
      const A1=occBinPush(bin,new occt.NCollection_Array1_gp_Pnt2d(1,Q.length));
      Q.forEach((p,i)=>{const g=new occt.gp_Pnt2d_3(p[0],p[1]);A1.SetValue(i+1,g);g.delete();});
      const H=occBinPush(bin,new occt.NCollection_HArray1_gp_Pnt2d(A1)); // ChangeArray1() rend une copie
      const it=occBinPush(bin,new occt.Geom2dAPI_Interpolate(H,true,1e-12));
      it.Perform();if(!it.IsDone())throw new Error('bord de la peau impossible');
      const c2=occBinPush(bin,it.Curve());
      const me=occBinPush(bin,new occt.BRepBuilderAPI_MakeEdge(c2,S));
      if(!me.IsDone())throw new Error('arête du bord impossible');
      const e=occBinPush(bin,me.Edge());
      occt.BRepLib.BuildCurves3d(e);
      const mw=occBinPush(bin,new occt.BRepBuilderAPI_MakeWire(e));
      return occBinPush(bin,mw.Wire());
    };
    const faces=[],ouvertures=[];
    const pln=occBinPush(bin,new occt.gp_Pln(occBinPush(bin,new occt.gp_Pnt_3(R.o[0],R.o[1],R.o[2])),occBinPush(bin,new occt.gp_Dir_4(R.d[0],R.d[1],R.d[2]))));
    B.forEach((L,i)=>{
      if(prof[i]%2)return;
      const trous=B.filter((M,j)=>prof[j]===prof[i]+1&&soufDedans(M[0],L));
      const ext=arete(L,true);
      const mf=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace(S,ext,true));
      trous.forEach(M=>mf.Add(arete(M,false)));
      if(!mf.IsDone())throw new Error('face de la peau impossible');
      faces.push(occBinPush(bin,mf.Face()));
      if(trou&&trou.creux){
        // creuser : le bord du creux est un trou de la face poussée ; un îlot (le fond remonte
        // jusqu'au plan) devient une petite face plane à la place de la face d'origine
        ouvertures.push(L);
        trous.forEach(M=>{
          const fi=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace(pln,arete(M,true),true));
          if(!fi.IsDone())throw new Error('îlot du creux impossible');
          faces.push(occBinPush(bin,fi.Face()));
        });
        return;
      }
      // dessus : même contour, dans le plan de la face poussée
      const fp=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace(pln,ext,true));
      trous.forEach(M=>fp.Add(arete(M,false)));
      if(trou&&trou.fil)fp.Add(trou.fil);
      if(!fp.IsDone())throw new Error('face du dessus impossible');
      const sf=occBinPush(bin,new occt.ShapeFix_Face(occBinPush(bin,fp.Face())));sf.Perform();
      faces.push(occBinPush(bin,sf.Face()));
    });
    if(trou&&trou.creux){
      // la face poussée, percée du creux
      if(!ouvertures.length)throw new Error('aucun creux (pièce trop mince pour cette paroi ?)');
      const fp=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace(pln,trou.fil,true));
      ouvertures.forEach(L=>fp.Add(arete(L,false)));
      if(!fp.IsDone())throw new Error('face poussée impossible à percer');
      const sf=occBinPush(bin,new occt.ShapeFix_Face(occBinPush(bin,fp.Face())));sf.Perform();
      faces.push(occBinPush(bin,sf.Face()));
    }
    if(trou&&trou.faces)trou.faces.forEach(x=>faces.push(x));
    for(const tol of [1e-4,1e-3,1e-2]){
      const sew=occBinPush(bin,new occt.BRepBuilderAPI_Sewing(tol,true,true,true,false));
      faces.forEach(x=>sew.Add(x));
      sew.Perform(occBinPush(bin,new occt.Message_ProgressRange_1()));
      if(soufSolide.debug)soufSolide.debug['libres '+tol]=sew.NbFreeEdges();
      if(sew.NbFreeEdges())continue;
      let s=occShapeCopy(occBinPush(bin,sew.SewedShape()));
      if(!s||s.IsNull())continue;
      s=occShellToSolid(s);
      const sol=occSubShapes(s,'TopAbs_SOLID'),nSol=sol.length;occDispose(sol);
      if(nSol!==1||!occCoqueValide(s)){if(soufSolide.debug)soufSolide.debug['refus '+tol]=nSol;occFree(s);continue;}
      return s;
    }
    throw new Error('peau non refermée');
  }finally{occDispose(bin);}
}
function soufVers(f){return f&&f.vers==='ext'?'ext':'int';}
function occSoufEnveloppe(result,face,f,info){
  // Coque soufflée de `result` depuis `face` → solide (à libérer) ; info reçoit les mesures.
  // 'int' (défaut, demande de Fred) : la face poussée descend DANS la pièce jusqu'à f.dist de
  //   l'extérieur, l'extérieur reste tel quel — la pièce est creusée, paroi ≈ f.dist ;
  // 'ext' : peau autour de la pièce à f.dist (coque ou bloc plein, f.plein).
  const t0=Date.now();
  const vers=soufVers(f);
  const R=soufRepere(face,result,!!f.flip);
  if(!R)throw new Error('la face poussée doit être plane');
  const dist=+f.dist||0,force=soufRayon(f);
  if(!(dist>0))throw new Error('distance nulle');
  const T=occTriPos(result,0.02,0.2,false);
  const pas=soufPas(f);
  // marge : en peau extérieure, la bille de la fermeture doit pouvoir rouler hors de la pièce
  const G=soufCarte(T.pos,R,pas,vers==='int'?4*pas:dist+force+4*pas,vers==='int');
  const t1=Date.now();
  const E0=vers==='int'?soufCreux(G,dist,force):soufPeau(G,dist,force);
  const E=soufLisse(E0,G,soufLis(f),vers==='int');
  const t2=Date.now();
  // les faces de la pièce (sauf la face poussée) sont cousues avec la surface calculée :
  //  creuser → la face poussée est percée du creux ; peau-coque → le dessus devient un anneau
  let trou=null;const lib=[];
  if(vers==='int'||!f.plein){
    const all=occSubShapes(result,'TopAbs_FACE');
    trou={fil:null,faces:[],creux:vers==='int'};
    all.forEach(x=>{if(x.IsSame(face))lib.push(x);else trou.faces.push(x);});
    trou.fil=occt.BRepTools.OuterWire(face);lib.push(trou.fil);
    trou.faces.forEach(x=>lib.push(x));
    if(vers==='int'){
      const w=occSubShapes(face,'TopAbs_WIRE');const nw=w.length;occDispose(w);
      if(nw>1){occDispose(lib);throw new Error('la face poussée est percée : choisissez une face pleine');}
    }
  }
  let s;
  try{s=soufSolide(G,E,R,trou);}finally{occDispose(lib);}
  if(info){info.grille=G.nu+'×'+G.nv;info.pas=G.h;info.ms={carte:t1-t0,peau:t2-t1,solide:Date.now()-t2};info.R=R;}
  return s;
}
function occApplySouffle(result,f){
  // Rejeu (occApplyCoque, 20) : {shape,warnings[,fatal]} ; le solide d'entrée est libéré si réussite.
  const fr=(f.faces||[])[0];
  if(!fr)return{shape:result,warnings:['aucune face poussée — choisissez la face d’où part le souffle'],fatal:true};
  let h=null;
  try{h=occFindFace(result,fr);}catch(e){h=null;}
  if(!h){f._m={m:0,t:1};return{shape:result,warnings:['la face poussée n’est plus retrouvée — la pièce a changé, re-choisissez-la']};}
  f._m={m:1,t:1};delete f._err;
  try{
    const s=occSoufEnveloppe(result,h,f,null);
    try{result.delete();}catch(e){}
    return{shape:s,warnings:[]};
  }catch(e){
    const m=(e&&e.message)||String(e);f._err=m;
    const plus=f.plein?'':' (coque : la pièce doit rester sous le plan de la face poussée, sans trou dans cette face — essayez « Bloc plein »)';
    return{shape:result,warnings:['coque soufflée impossible — '+m+(/refermée/.test(m)?plus:'')],fatal:true};
  }finally{try{h.delete();}catch(e){}}
}
/* ---------- panneau du mode Coque, type « Soufflée » (appelé par renderCoquePanel, 87-coque) ---------- */
function renderCoqueSoufPanel(p,ed){
  const M=coqueMode;
  const note=t=>{const n=document.createElement('span');n.className='note';n.textContent=t;p.appendChild(n);return n;};
  const fr=M.faces[0];
  note(fr?(fr._ord>=0?'✅ ':'⚠ ')+'Face poussée : centre ('+fr.pos.map(v=>(+v).toFixed(1)).join(' ; ')+') mm — re-cliquez pour en changer.'
    :'Cliquez la face plane d’où part le souffle (par ex. le dessus de la barquette).');
  const champ=(lab,k,ok,msg)=>{
    const row=document.createElement('div');row.className='pnl-row';row.style.marginTop='8px';
    const l=document.createElement('label');l.textContent=lab;row.appendChild(l);
    const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';
    inp.value=soufFr(M[k]);parFx(inp,M,k);
    inp.onchange=()=>{
      const v=parseFloat(String(inp.value).replace(',','.').replace(/\s/g,''));
      if(!isFinite(v)||!ok(v)){inp.value=soufFr(M[k]);faceEl.textContent=msg;return;}
      M[k]=v;inp.value=soufFr(v);coquePreviewUpdate();
    };
    row.appendChild(inp);p.appendChild(row);
  };
  const rv=document.createElement('div');rv.className='pnl-btns';rv.style.marginTop='8px';
  [['int','⬇ Vers l’intérieur (creuser)'],['ext','⬆ Vers l’extérieur (peau autour)']].forEach(([v,t])=>{
    const b=document.createElement('button');b.textContent=t;if(soufVers(M)===v)b.className='primary';
    b.title=v==='int'?'La face s’enfonce dans la pièce jusqu’à la distance de l’extérieur, qui reste tel quel.':'Une peau lisse se forme autour de la pièce, à la distance donnée.';
    b.onclick=()=>{if(soufVers(M)===v)return;M.vers=v;coquePreviewUpdate();renderCoquePanel();};
    rv.appendChild(b);
  });
  p.appendChild(rv);
  const int=soufVers(M)==='int';
  champ(int?'Paroi (mm)':'Distance (mm)','dist',v=>v>0,'Valeur invalide : strictement positive (ex. 5).');
  champ('Creux enjambés (mm)','pont',v=>v>=0,'Largeur invalide : 0 ou plus (ex. 20).');
  note(int?'La face poussée descend dans la pièce et s’arrête partout à cette distance de l’extérieur. Creux enjambés = force du souffle : la face ne descend pas dans les poches plus étroites que cette largeur (petit = elle suit tout, grand = elle reste tendue).'
    :'Creux enjambés = force du souffle : les creux plus étroits que cette largeur sont enjambés, les plus larges suivis et arrondis. Petit = peau plaquée, grand = peau tendue, 0 = parallèle exacte.');
  champ('Lissage (mm)','lis',v=>v>=0&&v<=20,'Lissage invalide : de 0 à 20 mm (ex. 3).');
  note('Lissage = arrondit les plis pour une surface plus douce ; la paroi ne descend jamais sous la valeur demandée (elle peut gagner quelques dixièmes). 0 = sans lissage.');
  const rp=document.createElement('div');rp.className='pnl-row';rp.style.marginTop='8px';
  const lp=document.createElement('label');lp.textContent='Précision';rp.appendChild(lp);
  rp.appendChild(soufPrecision(soufPas(M),v=>{M.pas=v;}));
  p.appendChild(rp);
  if(!int){
    const r3=document.createElement('div');r3.className='pnl-btns';r3.style.marginTop='8px';
    [[false,'Coque (pièce creusée)'],[true,'Bloc plein']].forEach(([v,t])=>{
      const b=document.createElement('button');b.textContent=t;if(!!M.plein===v)b.className='primary';
      b.onclick=()=>{if(!!M.plein===v)return;M.plein=v;coquePreviewUpdate();renderCoquePanel();};
      r3.appendChild(b);
    });
    p.appendChild(r3);
  }
  const btns=document.createElement('div');btns.className='pnl-btns';btns.style.marginTop='8px';
  const ok=document.createElement('button');ok.className='primary';
  ok.textContent=ed?'✔ Enregistrer':'✔ Appliquer';ok.onclick=coqueApply;btns.appendChild(ok);
  const q=document.createElement('button');q.textContent=ed?'✖ Annuler':'Quitter';q.onclick=()=>exitCoqueMode();
  btns.appendChild(q);p.appendChild(btns);
  note('Le calcul se fait vu depuis la face poussée (pas sous les contre-dépouilles). Aperçu au pas de 2 mm. Précision normale : distance tenue à quelques dixièmes sur les parois en pente, ±1,2 mm le long d’une paroi verticale ; fine : moitié moins, calcul environ 4 fois plus long.');
}
function coqueSoufApply(){
  // Appliquer / Enregistrer (coqueApply, 87-coque) pour le type « Soufflée »
  const M=coqueMode;
  if(!M.faces.length){faceEl.textContent='Coque soufflée : cliquez d’abord la face d’où part le souffle.';return;}
  if(!(+M.dist>0)){faceEl.textContent='Coque soufflée : distance hors bornes (> 0).';return;}
  const r=M.faces[0],face={pos:r.pos.slice(),dim:r.dim.slice(),n:r.n.slice()};
  if(typeof r._bid==='string')face._bid=r._bid;
  const set=f=>{
    f.kind='souffle';f.vers=soufVers(M);f.faces=[face];f.dist=+M.dist;f.pont=Math.max(0,+M.pont||0);f.flip=!!M.flip;f.plein=!!M.plein;f.thick=+M.dist;f.lis=soufLis(M);
    if(+M.pas>0)f.pas=+M.pas;
    parFxCopy(M,f,['dist','pont','lis']);f.name=soufName(f);
  };
  if(M.editing){
    const f=doc.features.find(x=>x.id===M.editing&&x.type==='xshell');
    if(f){docPushUndo('édition de « '+f.name+' »');set(f);repSyncForFeature(f);sel={kind:'feature',id:f.id};}
    exitCoqueMode(true);
    markDirty();rebuild();renderTree();renderProps();
    faceEl.textContent=f?(f._err?'Coque soufflée : voir ⚠ dans l’arbre.':'Coque soufflée mise à jour : '+f.name+'.'):'Coque soufflée : fonction introuvable.';
    return;
  }
  const nf={id:uid('sh'),type:'xshell',visible:true};set(nf);
  if(face._bid&&doc.bodies.some(b=>b.id===face._bid))nf.body=face._bid; // le corps de la face poussée, pas seulement le corps actif
  addFeature(nf);
  sel={kind:'feature',id:nf.id};
  exitCoqueMode(true);
  markDirty();rebuild();renderTree();renderProps();
  faceEl.textContent=nf._err?'Coque soufflée : voir ⚠ dans l’arbre.':'Coque soufflée créée : '+nf.name+'. Réglages modifiables dans ses propriétés.';
}
function soufProps(p,f){
  // Propriétés d'une coque soufflée (40-50) : réglages modifiables sans repasser par le mode
  const mk=(tag,cls,txt)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(txt!=null)d.textContent=txt;return d;};
  const Row=(lab,ctl)=>{const r=mk('div','pnl-row');r.appendChild(mk('label',null,lab));r.appendChild(ctl);p.appendChild(r);return r;};
  const set=(label,fn)=>{
    docPushUndo(label+' (« '+f.name+' »)');
    fn();f.name=soufName(f);repSyncForFeature(f);
    markDirty();rebuild();renderTree();renderProps();
  };
  p.appendChild(mk('div','pnl-h','🎈 Coque soufflée'));
  if(f._err)p.appendChild(mk('div','pnl-note','⚠ '+f._err));
  else if(f._m&&f._m.m<f._m.t)p.appendChild(mk('div','pnl-note','⚠ la face poussée n’est plus retrouvée : re-choisissez-la.'));
  const fr=(f.faces||[])[0];
  if(fr)p.appendChild(mk('div','pnl-note','Face poussée : centre ('+fr.pos.map(v=>(+v).toFixed(1)).join(' ; ')+') mm.'));
  const num=(lab,k,ok,msg)=>{
    const d=document.createElement('input');d.type='text';d.inputMode='decimal';
    d.value=soufFr(f[k]);parFx(d,f,k);
    d.addEventListener('change',()=>{
      const v=parseFloat(String(d.value).replace(',','.').replace(/\s/g,''));
      if(!isFinite(v)||!ok(v)){d.value=soufFr(f[k]);faceEl.textContent=msg;return;}
      if(v===+f[k])return;
      set(lab.toLowerCase(),()=>{f[k]=v;if(k==='dist')f.thick=v;});
    });
    Row(lab,d);
  };
  const sv=document.createElement('select');
  [['int','Vers l’intérieur (creuser)'],['ext','Vers l’extérieur (peau autour)']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(soufVers(f)===v)o.selected=true;sv.appendChild(o);});
  sv.onchange=()=>set('sens de la poussée',()=>{f.vers=sv.value;});
  Row('Pousser la face',sv);
  num(soufVers(f)==='int'?'Paroi (mm)':'Distance (mm)','dist',v=>v>0,'Valeur invalide : strictement positive (ex. 5).');
  num('Creux enjambés (mm)','pont',v=>v>=0,'Largeur invalide : 0 ou plus (ex. 20).');
  num('Lissage (mm)','lis',v=>v>=0&&v<=20,'Lissage invalide : de 0 à 20 mm (ex. 3).');
  Row('Précision',soufPrecision(soufPas(f),v=>set('précision',()=>{f.pas=v;})));
  const sp=document.createElement('input');sp.type='checkbox';sp.checked=!!f.plein;
  sp.onchange=()=>set(sp.checked?'bloc plein':'coque creuse',()=>{f.plein=sp.checked;});
  if(soufVers(f)==='ext')Row('Bloc plein',sp).title='Coché : pièce et peau ne font qu’un bloc. Décoché : la coque seule, la pièce creusée dedans.';
  p.appendChild(mk('div','pnl-note',soufVers(f)==='int'?'La face poussée descend dans la pièce jusqu’à la paroi demandée de l’extérieur, qui reste tel quel. Creux enjambés = force du souffle : petit, elle suit tout ; grand, elle reste tendue.':'Creux enjambés = force du souffle : petit, la peau est plaquée et descend dans les creux ; grand, elle reste tendue et passe par-dessus.'));
  const b=mk('div','pnl-btns');
  const r=mk('button',null,'🎈 Changer la face poussée');
  r.onclick=()=>{exitCoqueMode(true);try{if(filMode||filModeX)exitFilletMode(true);}catch(e){}enterCoqueMode(f);};
  b.appendChild(r);p.appendChild(b);
}
