/* ============ FAO : ébauche 3D sur le BRUT RESTANT (V0.99.0) ============
   Demande : « dans Fusion 360, l'ébauche 3D prend en compte soit le brut, soit le brut
   restant, pour ne pas repasser là où l'opération précédente a déjà enlevé la matière »
   (usinage de reprise, « Rest machining »). Puis : « il faudra quand même prendre en compte
   le 3+2 ».

   PRINCIPE — fiche de l'ébauche 3D, Brut = « Brut restant » (op.brut='restant') :
   toutes les opérations ACTIVES placées AVANT elle dans le posage (répétitions développées)
   sont rejouées sur une carte de hauteurs de la matière, vue selon l'axe d'outil de
   l'ébauche (son repère propre en 3+2, sinon celui du posage) :
     · même axe que l'ébauche : faoMatterCarveSeg (fond, arrondi d'arête, pointe de foret),
       exactement comme la simulation ;
     · autre axe (3+2, ou ébauche 3+2 après des opérations verticales) : une carte par
       orientation, dans son propre repère (l'outil y est vertical, même taille exacte),
       puis intersection colonne par colonne — le dessus est le plus haut point encore dans
       la matière de chaque carte (une poche sur la tranche laisse la matière au-dessus
       d'elle, comme dans la réalité). Méthode du rendu de la simulation
       (src/88-fao-77-matiere-cartes.js) ; l'outil incliné colonne par colonne
       (faoMatterCarveTilt) prenait 41 s pour un surfaçage, la carte orientée 0,07 s.
   En 3+2, le brut de départ est la vraie boîte du brut du posage vue le long de l'axe.
   La carte devient la forme du brut de l'ébauche : le même chemin que « brut = corps »
   (o.stockTopAt / o.stockRawAt) — un centre d'outil n'est admis que s'il reste de la
   matière sous son disque au-dessus de la passe.
   « Ignorer moins de » (op.restIgn, 0,25 mm) : la matière plus mince n'est pas reprise —
   la surépaisseur laissée par l'opération précédente le long des parois et des fonds
   (même laisse, à la maille près) ne déclenche pas de passe inutile. Le disque d'outil
   cherche la matière jusqu'à son bord moins cette épaisseur, au-dessus de la passe plus
   cette épaisseur. Jamais moins de 0,6 maille (écart de la carte elle-même).
   Clé du parcours : celles des opérations précédentes (faoRestDep) — modifier une
   opération précédente met la reprise « à régénérer ». */
const FAO_REST_IGN=0.25; // mm — matière plus mince ignorée (défaut)
const FAO_REST_IGN_FIN=0.1; // mm — finition (V0.99.1) : crêtes plus basses ignorées
const FAO_REST_MARGE=1;     // mm — finition : passes prolongées de part et d'autre
function faoRestOn(op){ return !!op&&(op.type==='rough3d'||op.type==='geofinish')&&op.brut==='restant'; }
function faoRestIgnore(op){
  const v=op?+op.restIgn:NaN;
  return (isFinite(v)&&v>=0)?Math.min(v,5):(op&&op.type==='geofinish'?FAO_REST_IGN_FIN:FAO_REST_IGN);
}
function faoRestMarge(op){
  const v=op?+op.restMarge:NaN;
  return (isFinite(v)&&v>=0)?Math.min(v,50):FAO_REST_MARGE;
}
function faoRestBase(job){ return (job&&job.__opJob)?Object.getPrototypeOf(job):job; }
function faoRestPrev(P,op){
  // Entrées de la séquence (faoOpsSeq) placées avant `op` dans la liste du posage
  // (une copie de répétition est à la place de sa répétition).
  const ops=(P&&P.ops)||[];
  let idx=ops.indexOf(op);
  if(idx<0&&op&&op.id)for(let i=0;i<ops.length;i++)if(ops[i]&&ops[i].id===op.id){idx=i;break;}
  if(idx<0)return [];
  const out=[];
  faoOpsSeq(P).forEach(function(E){
    if(!E||!E.op||E.op===op||(op.id&&E.op.id===op.id))return;
    const at=ops.indexOf(E.pat||E.op);
    if(at>=0&&at<idx)out.push(E);
  });
  return out;
}
function faoRestHash(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(36)+'_'+s.length;
}
function faoRestDep(op,job){
  // Dépendances du parcours : clés des opérations précédentes (null = pas de clé possible)
  const P=faoRestBase(job);
  const parts=[faoRestIgnore(op)];
  const L=faoRestPrev(P,op);
  for(let i=0;i<L.length;i++){
    const k=faoOpMovesKey(L[i].op,P);
    if(k===null)return null;
    parts.push(faoRestHash(k)+(L[i].xf?'@'+JSON.stringify(L[i].xf):''));
  }
  return parts;
}
function faoRestMovesOf(q,P){
  // Parcours À JOUR d'une opération précédente (repère du posage). Un parcours périmé
  // (opération modifiée, pas encore régénérée) est recalculé : la reprise doit partir
  // de ce que la machine fera vraiment, et sa clé est celle du parcours à jour.
  try{
    const ck=faoOpMovesKey(q,P),ch=faoOpMovesHit(q);
    if(ck!==null&&ch&&ch.key!==ck&&q.stale===true&&q.type!=='drill')q.stale=false;
  }catch(e){}
  return faoOpMoves(q,P)||[];
}
function faoRestDilate(h,nx,ny,R,p){
  // max sur le disque de rayon R (centres de mailles) : par ligne, fenêtre glissante de
  // demi-largeur w(dj) (file monotone), reportée sur la ligne j-dj et j+dj
  const out=new Float32Array(nx*ny).fill(-1/0);
  const n=Math.max(0,Math.floor(R/p+1e-9));
  const row=new Float32Array(nx),dq=new Int32Array(nx);
  for(let dj=0;dj<=n;dj++){
    const w=Math.floor(Math.sqrt(Math.max(0,R*R-dj*dj*p*p))/p+1e-9);
    for(let j=0;j<ny;j++){
      const o=j*nx;
      // max de h[o+i-w .. o+i+w]
      let hd=0,tl=0,nxt=0;
      for(let i=0;i<nx;i++){
        while(nxt<nx&&nxt<=i+w){const v=h[o+nxt];while(tl>hd&&h[o+dq[tl-1]]<=v)tl--;dq[tl++]=nxt;nxt++;}
        while(hd<tl&&dq[hd]<i-w)hd++;
        row[i]=hd<tl?h[o+dq[hd]]:-1/0;
      }
      const a=j-dj,b=j+dj;
      if(a>=0){const oa=a*nx;for(let i=0;i<nx;i++)if(row[i]>out[oa+i])out[oa+i]=row[i];}
      if(dj>0&&b<ny){const ob=b*nx;for(let i=0;i<nx;i++)if(row[i]>out[ob+i])out[ob+i]=row[i];}
    }
  }
  return out;
}
let faoRestMemo=null; // WeakMap op -> {key, map} (même clé = même carte)
function faoRestMap(op,job,D,radial){
  // Carte du brut restant dans le repère de CALCUL de l'opération (job = posage, ou posage
  // vu par l'opération en 3+2). Renvoie {top(x,y) dilaté, raw(x,y), n, tilt, ms, pas} ou null.
  const t0=Date.now();
  const P=faoRestBase(job);
  const s=job&&job.stock;
  if(!P||!faoStockValid(s))return null;
  let key=null;
  try{ key=JSON.stringify([faoRestDep(op,job),s,D,job.frame||null]); }catch(e){ key=null; }
  if(key!==null){ try{ const m=faoRestMemo&&faoRestMemo.get(op); if(m&&m.key===key)return m.map; }catch(e){} }
  const fr=(job.__opJob===op)?faoOpFrame(P,op):null;
  const toO=fr?function(p){return faoToF(fr,faoToW(fr.P,p));}:function(p){return p;};
  // grille : la boîte du brut (repère de calcul) + une marge d'un Ø d'outil
  const pad=D+2;
  const X0=+s.x0-pad,Y0=+s.y0-pad,W=+s.x1-+s.x0+2*pad,Hh=+s.y1-+s.y0+2*pad;
  // finition (V0.99.1) : maille D/8 (0,25…0,5 mm) — la carte d'une finition précédente au pas de
  // D/16 prenait 30 s sur Cavité Usinage ; la marge couvre l'écart d'une maille
  let p=(op&&op.type==='geofinish')?Math.max(0.25,Math.min(0.5,D/8)):Math.max(0.15,Math.min(0.5,D/16));
  let nx=Math.ceil(W/p),ny=Math.ceil(Hh/p);
  while(nx*ny>3e6){p*=1.15;nx=Math.ceil(W/p);ny=Math.ceil(Hh/p);}
  const nc=nx*ny,z0=+s.z0,z1=+s.z1;
  const h=new Float32Array(nc);
  // dessus de départ : en 3+2, la vraie boîte du brut du posage vue le long de l'axe de
  // l'opération (jo.stock n'en est que la boîte englobante, réduite à la zone de l'opération)
  const SP=fr?P.stock:null;
  const fromO=fr?function(q){return faoToF(fr.P,faoToW(fr,q));}:null;
  const B0=fr?fromO([0,0,0]):null,Bz=fr?fromO([0,0,1]):null,Bx=fr?fromO([1,0,0]):null,By=fr?fromO([0,1,0]):null;
  const boxTop=function(x,y){
    if(!SP)return z1;
    let lo=-1/0,hi=1/0;
    const ax=['x','y','z'];
    for(let k=0;k<3;k++){
      const b=B0[k]+(Bx[k]-B0[k])*x+(By[k]-B0[k])*y,d=Bz[k]-B0[k],m0=+SP[ax[k]+'0'],m1=+SP[ax[k]+'1'];
      if(Math.abs(d)<1e-12){ if(b<m0||b>m1)return z0; continue; }
      let t0=(m0-b)/d,t1=(m1-b)/d;if(t0>t1){const t=t0;t0=t1;t1=t;}
      if(t0>lo)lo=t0;if(t1<hi)hi=t1;
    }
    return hi>=lo?Math.min(z1,hi):z0;
  };
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const x=X0+(i+0.5)*p,y=Y0+(j+0.5)*p;
    h[j*nx+i]=(x>=+s.x0&&x<=+s.x1&&y>=+s.y0&&y<=+s.y1)?boxTop(x,y):z0;
  }
  const g={pas:p,pz:Math.max(1e-3,z1-z0),nx:nx,ny:ny,nz:1,n:nc,ox:X0,oy:Y0,oz:z0,alive:new Uint8Array(nc).fill(1),
    h:h,nrm:null,wn:null,sx1:X0+nx*p,sy1:Y0+ny*p,sz1:z1,full:z1};
  const L=faoRestPrev(P,op);
  let nOps=0,nTilt=0;
  const O0=toO([0,0,0]);
  // 3+2 : une carte par AUTRE orientation d'outil, dans son propre repère (U, V, A) — l'outil
  // y est vertical et taille exactement comme ici (src/88-fao-77-matiere-cartes.js). La
  // matière est l'intersection des cartes (composée colonne par colonne à la fin).
  const tilted={};
  const corners=[];[+s.x0,+s.x1].forEach(function(x){[+s.y0,+s.y1].forEach(function(y){[z0,z1].forEach(function(z){corners.push([x,y,z]);});});});
  const mapFor=function(A){
    const k=A.map(function(v){return Math.round(v*1e4)/1e4;}).join(',');
    if(tilted[k])return tilted[k];
    const F=faoMapFrame(A);
    let u0=1/0,u1=-1/0,v0=1/0,v1=-1/0,w1=-1/0,w0=1/0;
    corners.forEach(function(c){const u=c[0]*F.U[0]+c[1]*F.U[1]+c[2]*F.U[2],v=c[0]*F.V[0]+c[1]*F.V[1]+c[2]*F.V[2],w=c[0]*F.A[0]+c[1]*F.A[1]+c[2]*F.A[2];
      if(u<u0)u0=u;if(u>u1)u1=u;if(v<v0)v0=v;if(v>v1)v1=v;if(w>w1)w1=w;if(w<w0)w0=w;});
    u0-=pad;v0-=pad;u1+=pad;v1+=pad;
    let pq=p,mx=Math.ceil((u1-u0)/pq),my=Math.ceil((v1-v0)/pq);
    while(mx*my>2e6){pq*=1.15;mx=Math.ceil((u1-u0)/pq);my=Math.ceil((v1-v0)/pq);}
    const hm=new Float32Array(mx*my).fill(w1);
    tilted[k]={F:F,g:{pas:pq,pz:Math.max(1e-3,w1-w0),nx:mx,ny:my,nz:1,n:mx*my,ox:u0,oy:v0,oz:w0,alive:new Uint8Array(mx*my).fill(1),
      h:hm,nrm:null,wn:null,sx1:u0+mx*pq,sy1:v0+my*pq,sz1:w1,full:w1}};
    return tilted[k];
  };
  L.forEach(function(E){
    const q=E.op;
    const t=faoToolById(P,q.toolId);if(!t)return;
    const r=faoToolBodyD(t)/2;if(!(r>0))return;
    const cr=faoToolEffCr(t),tp=faoToolTipProfile(t);
    let mv=null;
    try{ mv=faoXfMoves(faoRestMovesOf(q,P),E.xf); }catch(e){ mv=null; }
    if(!mv||!mv.length)return;
    // axe d'outil de l'opération précédente, dans le repère de calcul
    let Ap=[0,0,1];
    try{ const fq=faoOpFrame(P,q); if(fq)Ap=fq.rel.Z.slice(); }catch(e){}
    const Q=toO(Ap);let A=[Q[0]-O0[0],Q[1]-O0[1],Q[2]-O0[2]];
    const la=Math.hypot(A[0],A[1],A[2])||1;A=[A[0]/la,A[1]/la,A[2]/la];
    const same=A[2]>1-1e-6;
    nOps++;if(!same)nTilt++;
    const T=same?null:mapFor(A);
    const cut=function(a,b){
      let pa=toO(a),pb=toO(b);
      if(same){ faoMatterCarveSeg(g,pa[0],pa[1],pa[2],pb[0],pb[1],pb[2],r,null,cr,tp); return; }
      const F=T.F,to=function(c){return [c[0]*F.U[0]+c[1]*F.U[1]+c[2]*F.U[2],c[0]*F.V[0]+c[1]*F.V[1]+c[2]*F.V[2],c[0]*F.A[0]+c[1]*F.A[1]+c[2]*F.A[2]];};
      pa=to(pa);pb=to(pb);
      faoMatterCarveSeg(T.g,pa[0],pa[1],pa[2],pb[0],pb[1],pb[2],r,null,cr,tp);
    };
    let pv=null;
    for(let i=0;i<mv.length;i++){
      const m=mv[i];if(!m||!isFinite(+m.x))continue;
      const b=[+m.x,+m.y,+m.z];
      if(pv&&!m.r){
        let last=pv;
        if(m.arc){ try{ (faoArcSegs({x:pv[0],y:pv[1],z:pv[2]},m)||[]).forEach(function(c){ cut(last,c); last=c; }); }catch(e){} }
        cut(last,b);
      }
      pv=b;
    }
  });
  // intersection avec les cartes 3+2 : dessus = plus haut point de la colonne encore dans
  // la matière de chaque carte (pas d'une maille, puis dichotomie)
  const TL=Object.keys(tilted).map(function(k){return tilted[k];});
  if(TL.length){
    const inside=function(x,y,z){
      for(let n=0;n<TL.length;n++){const F=TL[n].F,G=TL[n].g;
        const u=x*F.U[0]+y*F.U[1]+z*F.U[2],v=x*F.V[0]+y*F.V[1]+z*F.V[2],w=x*F.A[0]+y*F.A[1]+z*F.A[2];
        const i=Math.floor((u-G.ox)/G.pas),j=Math.floor((v-G.oy)/G.pas);
        if(i<0||j<0||i>=G.nx||j>=G.ny)continue;
        if(w>G.h[j*G.nx+i]+1e-6)return false;}
      return true;};
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const c=j*nx+i;let z=h[c];if(!(z>z0+1e-6))continue;
      const x=X0+(i+0.5)*p,y=Y0+(j+0.5)*p;
      if(inside(x,y,z))continue;
      let hi=z;z-=p;
      while(z>z0&&!inside(x,y,z)){hi=z;z-=p;}
      if(!(z>z0)){h[c]=z0;continue;}
      let lo=z;for(let k=0;k<8;k++){const m=(lo+hi)/2;if(inside(x,y,m))lo=m;else hi=m;}
      h[c]=lo;
    }
  }
  // colonne vidée jusqu'au bas du brut = pas de matière
  for(let k=0;k<nc;k++)if(!(h[k]>z0+1e-6))h[k]=-1/0;
  const e=Math.max(faoRestIgnore(op),0.6*p);
  const lo=new Float32Array(nc);for(let k=0;k<nc;k++)lo[k]=h[k]-e;
  const dil=faoRestDilate(lo,nx,ny,Math.max(0,D/2-e),p);
  const look=function(A){return function(x,y){
    const i=Math.floor((x-X0)/p),j=Math.floor((y-Y0)/p);
    if(i<0||j<0||i>=nx||j>=ny)return -1/0;return A[j*nx+i];};};
  const map={top:look(dil),raw:look(h),n:nOps,tilt:nTilt,ms:Date.now()-t0,pas:p,ign:e,
    grid:{h:h,nx:nx,ny:ny,x0:X0,y0:Y0,p:p}};
  if(key!==null){ try{ if(!faoRestMemo)faoRestMemo=new WeakMap(); faoRestMemo.set(op,{key:key,map:map}); }catch(e){} }
  return map;
}
function faoRestTrimAir(mv,topAt,D){
  // Passes de la reprise qui ne rencontrent AUCUNE matière restante sur une longue distance
  // (ex. : contour qui longe une paroi déjà à la cote pour relier deux coins) : le tronçon à
  // vide devient une liaison — rapide (que les liaisons du posage relèvent au-dessus de la
  // matière réelle), puis descente en avance de 1 mm. Chaînes de coupes horizontales à la
  // même cote, sans arc ; on garde 1 mm de coupe à chaque bord du vide.
  if(!Array.isArray(mv)||mv.length<3||typeof topAt!=='function')return mv;
  const Lmin=Math.max(10,2*D),st=0.5,mg=1;
  const out=[];let n=0;
  const flat=function(a,b){return a&&b&&!a.r&&!b.r&&!b.arc&&!b.ent&&isFinite(+a.z)&&Math.abs(+a.z-+b.z)<1e-6;};
  let i=0;
  while(i<mv.length){
    if(i===0||!flat(mv[i-1],mv[i])){out.push(mv[i]);i++;continue;}
    // chaîne mv[i-1] → … → mv[j-1]
    let j=i;while(j<mv.length&&flat(mv[j-1],mv[j])&&Math.abs(+mv[j].z-+mv[i-1].z)<1e-6)j++;
    const z=+mv[i-1].z;
    // échantillons le long de la chaîne
    const S=[];let cum=0;
    for(let k=i;k<j;k++){const a=mv[k-1],b=mv[k],L=Math.hypot(b.x-a.x,b.y-a.y),ns=Math.max(1,Math.ceil(L/st));
      for(let s=(k===i?0:1);s<=ns;s++){const t=s/ns;S.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,d:cum+L*t,k:k,t:t});}
      cum+=L;}
    const air=S.map(function(q){return !(topAt(q.x,q.y)>z+0.01);});
    // vides assez longs
    const runs=[];
    for(let a=0;a<S.length;){if(!air[a]){a++;continue;}let b=a;while(b+1<S.length&&air[b+1])b++;
      if(S[b].d-S[a].d-2*mg>=Lmin)runs.push([S[a].d+mg,S[b].d-mg]);a=b+1;}
    if(!runs.length){for(let k=i;k<j;k++)out.push(mv[k]);i=j;continue;}
    const at=function(d){ // point de la chaîne à la distance d
      let c=0;for(let k=i;k<j;k++){const a=mv[k-1],b=mv[k],L=Math.hypot(b.x-a.x,b.y-a.y);
        if(d<=c+L+1e-9){const t=L>1e-12?(d-c)/L:1;return {k:k,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}c+=L;}
      const b=mv[j-1];return {k:j-1,x:b.x,y:b.y};};
    let k=i,c=0,r=0;
    const len=function(q){return Math.hypot(mv[q].x-mv[q-1].x,mv[q].y-mv[q-1].y);};
    while(k<j){
      const b=mv[k],L=len(k);
      if(r<runs.length&&runs[r][0]<=c+L+1e-9){
        const P1=at(runs[r][0]),P2=at(runs[r][1]);
        const keep={};if(b.ent)keep.ent=b.ent;
        out.push(Object.assign({},keep,{r:0,x:P1.x,y:P1.y,z:z}));
        out.push({r:1,x:P2.x,y:P2.y,z:z+1});
        out.push({r:0,x:P2.x,y:P2.y,z:z});
        n++;r++;
        while(k<P2.k){c+=len(k);k++;} // reprise après P2, dans son segment
        continue;
      }
      out.push(b);c+=L;k++;
    }
    i=j;
  }
  for(const k in mv)if(!/^\d+$/.test(k))out[k]=mv[k];
  out.restTrim=n;
  return out;
}
function faoRoughStock(op,job,D,radial){
  // Forme du brut de l'ébauche 3D : corps-brut (2026-10-21-010) et/ou brut restant.
  // {top : dessus dilaté, raw : dessus réel} — null chacun quand le brut est la boîte.
  let T=null;
  try{ T=faoStockTop(job,1); }catch(e){ T=null; }
  let top=null,raw=null;
  try{ top=T?T.dil(D/2+radial):null; }catch(e){ top=null; }
  try{ raw=T?T.at:null; }catch(e){ raw=null; }
  if(faoRestOn(op)){
    let R=null;
    try{ R=faoRestMap(op,job,D,radial); }catch(e){ R=null; }
    try{ op.restDiag=R?{n:R.n,tilt:R.tilt,ms:R.ms,pas:+R.pas.toFixed(3)}:{err:1}; }catch(e){}
    if(R){
      const t0=top,r0=raw;
      top=t0?function(x,y){return Math.min(t0(x,y),R.top(x,y));}:R.top;
      raw=r0?function(x,y){return Math.min(r0(x,y),R.raw(x,y));}:R.raw;
    }
  }
  return {top:top,raw:raw};
}

/* ----- V0.99.1 : FINITION sur le brut restant (demande de Fred : « cette fonction de brut
   restant dans la Finition », « avec une option de marge pour aller un poil plus loin » ;
   « ne pas mettre de limite intérieure dans certains cas pour utiliser le brut restant »).
   La finition (parallèle ou crêtes constantes) est calculée normalement, puis chaque point de
   passe est testé contre la carte du brut restant (même carte que l'ébauche) : l'outil, posé
   là, enlève-t-il plus de « Ignorer moins de » ? (dessus de la carte − dessous de l'outil,
   maille par maille sous son disque : boule, torique ou plat.) Les tronçons qui enlèvent de la
   matière sont gardés, ainsi que tout point de passe à moins de la marge (en 3D) d'un point
   qui en enlève : le long de la passe ET sur les passes voisines — la boule repasse sur tout
   le bord de la zone restante (Fred : « être sûr que la fraise boule est bien passée partout
   sur la limite du brut restant »). Les trous plus courts que
   max(2 mm, Ø) aussi (moins cher que remonter). Le reste devient des liaisons : montée au
   plan de sécurité, passage, descente en avance au début du tronçon suivant — les liaisons du
   posage (retrait, retrait minimum) les redessinent ensuite comme les autres. Un arc n'est
   jamais coupé : l'intervalle gardé s'étend à l'arc entier. */
function faoRestEnvFn(tool,D){
  // Hauteur du dessous de l'outil au-dessus de sa pointe, à la distance ρ de l'axe.
  const R=D/2,k=tool&&tool.kind;
  if(k==='flat')return function(){return 0;};
  const rc=k==='bull'?Math.max(0,Math.min(R,isFinite(+tool.cornerR)?+tool.cornerR:R)):R;
  const r0=R-rc;
  return function(d){ if(d<=r0)return 0; const u=Math.min(rc,d-r0); return rc-Math.sqrt(Math.max(0,rc*rc-u*u)); };
}
function faoRestFinish(mv,M,tool,D,ign,marge,secu){
  if(!Array.isArray(mv)||mv.length<2||!M||!M.grid)return mv;
  const G=M.grid,h=G.h,nx=G.nx,ny=G.ny,p=G.p,R=D/2,env=faoRestEnvFn(tool,D);
  const n=Math.ceil(R/p)+1;
  // l'outil posé (pointe x,y,z) enlève-t-il plus de ign de matière restante ?
  const eng=function(x,y,z){
    const ci=Math.floor((x-G.x0)/p),cj=Math.floor((y-G.y0)/p);
    for(let dj=-n;dj<=n;dj++){const j=cj+dj;if(j<0||j>=ny)continue;const cy=G.y0+(j+0.5)*p-y;
      for(let di=-n;di<=n;di++){const i=ci+di;if(i<0||i>=nx)continue;const cx=G.x0+(i+0.5)*p-x;
        const d=Math.hypot(cx,cy);if(d>R)continue;
        if(h[j*nx+i]>z+env(d)+ign)return true;}}
    return false;};
  const gapMin=Math.max(2,D);
  const isCut=function(m){return !!m&&!m.r&&!m.ent;};
  const segsOf=function(i,j){ // tronçons de coupe (hors entrées) de la chaîne mv[i..j-1]
    const C=[];let s=0,prv=i>0?mv[i-1]:null;
    for(let k=i;k<j;k++){const b=mv[k];
      if(prv&&isCut(b)){const L=Math.hypot(b.x-prv.x,b.y-prv.y,(+b.z)-(+prv.z));C.push({k:k,a:prv,b:b,s0:s,L:L});s+=L;}
      prv=b;}
    C.s=s;return C;};
  const sampleOf=function(C,f){ // échantillons au pas de la carte : f(x,y,z,abscisse)
    C.forEach(function(c){const ns=Math.max(1,Math.ceil(c.L/p));
      for(let q=0;q<=ns;q++){const t=q/ns;
        f(c.a.x+(c.b.x-c.a.x)*t,c.a.y+(c.b.y-c.a.y)*t,+c.a.z+((+c.b.z)-(+c.a.z))*t,c.s0+c.L*t);}});};
  // 1er passage : points qui enlèvent de la matière, rangés par cases de la taille de la marge
  const cs=Math.max(marge,p),HS=new Map();let nHit=0;
  for(let i=0;i<mv.length;){
    if(mv[i].r){i++;continue;}
    let j=i;while(j<mv.length&&!mv[j].r)j++;
    if(i>0)sampleOf(segsOf(i,j),function(x,y,z){ if(!eng(x,y,z))return;
      const k=Math.floor(x/cs)+','+Math.floor(y/cs);let L=HS.get(k);if(!L){L=[];HS.set(k,L);}L.push(x,y,z);nHit++;});
    i=j;}
  const near=function(x,y,z){
    const ci=Math.floor(x/cs),cj=Math.floor(y/cs),m2=marge*marge+1e-9;
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const L=HS.get((ci+di)+','+(cj+dj));if(!L)continue;
      for(let q=0;q<L.length;q+=3){const ex=L[q]-x,ey=L[q+1]-y,ez=L[q+2]-z;if(ex*ex+ey*ey+ez*ez<=m2)return true;}}
    return false;};
  const out=[];let pos=null,air=false,Ltot=0,Lkeep=0,nCut=0;
  const put=function(m){out.push(m);pos=m;};
  const up=function(){ if(pos&&+pos.z<secu-1e-9)out.push({r:1,x:pos.x,y:pos.y,z:secu}); };
  const goRapid=function(Q){ // vers un point sûr (fin d'un rapide d'origine)
    up(); out.push({r:1,x:Q.x,y:Q.y,z:Math.max(secu,+Q.z)}); put({r:1,x:Q.x,y:Q.y,z:+Q.z});
  };
  const goCut=function(Q){ // vers un point de passe : descente finale en avance
    up(); out.push({r:1,x:Q.x,y:Q.y,z:secu});
    if(+Q.z+1<secu-1e-9)out.push({r:1,x:Q.x,y:Q.y,z:+Q.z+1});
    put({r:0,ent:1,x:Q.x,y:Q.y,z:+Q.z});
  };
  let i=0;
  while(i<mv.length){
    const m=mv[i];
    if(m.r){ if(!air)put(m); i++; continue; }
    let j=i;while(j<mv.length&&!mv[j].r)j++;          // chaîne en avance mv[i..j-1]
    const start=i>0?mv[i-1]:null;
    const C=segsOf(i,j),s=C.s;
    Ltot+=s;
    const whole=function(){ if(air&&start)goRapid(start); air=false; for(let k=i;k<j;k++)put(mv[k]); Lkeep+=s; };
    if(!C.length||!start){ whole(); i=j; continue; }
    // abscisses gardées : à moins de la marge d'un point qui enlève de la matière
    const I=[];
    if(nHit)sampleOf(C,function(x,y,z,d){ if(!near(x,y,z))return;
      const a=Math.max(0,d-p),b=Math.min(s,d+p),L=I[I.length-1];
      if(L&&a<=L[1]+gapMin)L[1]=Math.max(L[1],b);else I.push([a,b]);});
    if(!I.length){ air=true; i=j; continue; }          // chaîne entière sur du déjà fini
    if(I[0][0]<=gapMin)I[0][0]=0;
    if(s-I[I.length-1][1]<=gapMin)I[I.length-1][1]=s;
    if(I.length===1&&I[0][0]===0&&I[0][1]===s){ whole(); nCut++; i=j; continue; }
    const at=function(d,lo){
      let q=0;while(q<C.length-1&&d>C[q].s0+C[q].L+1e-9)q++;
      const c=C[q];let t=c.L>1e-12?Math.max(0,Math.min(1,(d-c.s0)/c.L)):(lo?0:1);
      if(c.b.arc)t=lo?0:1;
      return {q:q,t:t,d:c.s0+c.L*t,x:c.a.x+(c.b.x-c.a.x)*t,y:c.a.y+(c.b.y-c.a.y)*t,z:+c.a.z+((+c.b.z)-(+c.a.z))*t};
    };
    for(let v=0;v<I.length;v++){
      const A=at(I[v][0],true),B=at(I[v][1],false);
      if(B.d<=A.d+1e-9)continue;
      Lkeep+=B.d-A.d;
      if(A.d<=1e-9){ if(air)goRapid(start); air=false; for(let k=i;k<C[0].k;k++)put(mv[k]); }
      else goCut(A);
      for(let q=A.q;q<=B.q;q++){
        const c=C[q],t0=(q===A.q)?A.t:0,t1=(q===B.q)?B.t:1;
        if(q>A.q)for(let k=C[q-1].k+1;k<c.k;k++)put(mv[k]); // avances intercalées
        if(t1<=t0+1e-12)continue;
        if(t1>=1-1e-9)put(c.b);
        else put({r:0,x:c.a.x+(c.b.x-c.a.x)*t1,y:c.a.y+(c.b.y-c.a.y)*t1,z:+c.a.z+((+c.b.z)-(+c.a.z))*t1});
      }
      if(B.d>=s-1e-9){ for(let k=C[C.length-1].k+1;k<j;k++)put(mv[k]); air=false; }
      else air=true;
    }
    nCut++;
    i=j;
  }
  if(air)up();
  for(const k in mv)if(!/^\d+$/.test(k))out[k]=mv[k];
  out.restKeep=Ltot>0?Math.round(100*Lkeep/Ltot):100;
  out.restChains=nCut;
  return out;
}
function faoRestFinishOp(mv,op,job,D,tool,secu){
  // Point d'entrée de la finition (dispatch) : carte, filtre, diagnostic de la fiche.
  let M=null;
  try{ M=faoRestMap(op,job,D,0); }catch(e){ M=null; }
  if(!M){ try{ op.restDiag={err:1}; }catch(e){} return mv; }
  const r=faoRestFinish(mv,M,tool,D,Math.max(faoRestIgnore(op),0.25*M.pas),faoRestMarge(op),secu);
  try{ op.restDiag={n:M.n,tilt:M.tilt,ms:M.ms,pas:+M.pas.toFixed(3),garde:r&&r.restKeep}; }catch(e){}
  return r;
}
