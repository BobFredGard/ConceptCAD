/* ---------- Index spatial des triangles pour la souris (V0.96.1) ----------
   Survol, sélection, mesure, centre de rotation : tout passe par Raycaster → Mesh.raycast, qui
   essayait CHAQUE triangle du maillage à chaque mouvement de souris (coût proportionnel à la
   taille de la pièce). Ici, un arbre de boîtes englobantes par géométrie (construit une fois, au
   premier rayon, gardé tant que la géométrie ne change pas) désigne les seuls triangles que le
   rayon peut toucher ; ce sont ENSUITE les fonctions d'origine de three qui les testent, plage
   par plage (drawRange restreint le temps de l'appel) : mêmes impacts, mêmes distances, mêmes
   faceIndex, même ordre qu'avant, au bit près.
   Un seul point d'accroche (Mesh.prototype._computeIntersections) : aucun appelant n'est modifié.
   Repli sur l'ancien parcours complet dès qu'un cas sort du cadre (petit maillage, morphing,
   attribut entrelacé, groupes de matières désordonnés, drawRange non multiple de 3).
   ?sansindex dans l'adresse : ancien parcours partout (pour comparer). */
const RAY_IDX_MIN=1500;   // en dessous, le parcours complet coûte moins que l'arbre
const RAY_IDX_FEUILLE=8;  // triangles par feuille au plus
let rayIdxOff=(()=>{try{return /[?&]sansindex\b/.test(location.search);}catch(e){return false;}})();
const rayIdxMemo=new WeakMap(); // géométrie → index (libéré avec elle)
const rayIdxStat={construits:0,msConstruction:0,rayons:0,replis:0};
let rayIdxCand=new Uint32Array(1024);
const rayIdxPile=new Int32Array(128);

// Empreinte bon marché du contenu : un tableau de positions réécrit sur place sans needsUpdate
// (version inchangée) ne doit pas laisser un arbre périmé.
function rayIdxEmpreinte(a){
  const n=a.length,pas=Math.max(1,(n/61)|0);let s=0;
  for(let i=0;i<n;i+=pas)s=s*1.0000001+a[i];
  return s+a[n-1];
}
function rayIdxConstruire(pa,ia,nt){
  // boîte de chaque triangle
  const tb=new Float32Array(6*nt);
  for(let t=0;t<nt;t++){
    const a=3*(ia?ia[3*t]:3*t),b=3*(ia?ia[3*t+1]:3*t+1),c=3*(ia?ia[3*t+2]:3*t+2),o=6*t;
    for(let k=0;k<3;k++){
      const x=pa[a+k],y=pa[b+k],z=pa[c+k];
      tb[o+k]=x<y?(x<z?x:z):(y<z?y:z);
      tb[o+3+k]=x>y?(x>z?x:z):(y>z?y:z);
    }
  }
  const ordre=new Uint32Array(nt);for(let t=0;t<nt;t++)ordre[t]=t;
  const maxN=nt+8;
  const bo=new Float32Array(6*maxN),lien=new Uint32Array(maxN),nb=new Uint16Array(maxN);
  let n=0;
  const choisir=(lo,hi,k,ax)=>{ // k-ième par centre de boîte sur l'axe ax (tri partiel)
    let l=lo,r=hi-1;
    while(l<r){
      const m=ordre[(l+r)>>1],p=tb[6*m+ax]+tb[6*m+3+ax];
      let i=l,j=r;
      while(i<=j){
        while(tb[6*ordre[i]+ax]+tb[6*ordre[i]+3+ax]<p)i++;
        while(tb[6*ordre[j]+ax]+tb[6*ordre[j]+3+ax]>p)j--;
        if(i<=j){const q=ordre[i];ordre[i]=ordre[j];ordre[j]=q;i++;j--;}
      }
      if(k<=j)r=j;else if(k>=i)l=i;else return;
    }
  };
  const noeud=(lo,hi)=>{
    const i=n++,o=6*i;
    let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
    let cx0=Infinity,cy0=Infinity,cz0=Infinity,cx1=-Infinity,cy1=-Infinity,cz1=-Infinity;
    for(let q=lo;q<hi;q++){
      const t=6*ordre[q],a=tb[t],b=tb[t+1],c=tb[t+2],d=tb[t+3],e=tb[t+4],f=tb[t+5];
      if(a<x0)x0=a;if(b<y0)y0=b;if(c<z0)z0=c;if(d>x1)x1=d;if(e>y1)y1=e;if(f>z1)z1=f;
      const cx=a+d,cy=b+e,cz=c+f;
      if(cx<cx0)cx0=cx;if(cx>cx1)cx1=cx;if(cy<cy0)cy0=cy;if(cy>cy1)cy1=cy;if(cz<cz0)cz0=cz;if(cz>cz1)cz1=cz;
    }
    bo[o]=x0;bo[o+1]=y0;bo[o+2]=z0;bo[o+3]=x1;bo[o+4]=y1;bo[o+5]=z1;
    if(hi-lo<=RAY_IDX_FEUILLE){nb[i]=hi-lo;lien[i]=lo;return;}
    const dx=cx1-cx0,dy=cy1-cy0,dz=cz1-cz0,ax=dx>=dy?(dx>=dz?0:2):(dy>=dz?1:2),mid=(lo+hi)>>1;
    if(dx>0||dy>0||dz>0)choisir(lo,hi,mid,ax); // centres tous confondus : coupe au milieu telle quelle
    noeud(lo,mid);lien[i]=n;noeud(mid,hi);
  };
  noeud(0,nt);
  let d2=0;for(let k=0;k<3;k++){const d=bo[3+k]-bo[k];d2+=d*d;}
  // marge des boîtes : les arrondis du test de boîte ne doivent jamais écarter un triangle que le
  // test exact de three aurait retenu (un candidat en trop ne change rien au résultat).
  return {bo:bo.slice(0,6*n),lien:lien.slice(0,n),nb:nb.slice(0,n),ordre,marge:1e-4*Math.sqrt(d2)+1e-7};
}
function rayIdxDe(geo,pos,idx,nt){
  const pa=pos.array,ia=idx?idx.array:null;
  const emp=rayIdxEmpreinte(pa);
  let x=rayIdxMemo.get(geo);
  if(x&&x.pa===pa&&x.pv===pos.version&&x.ia===ia&&x.iv===(idx?idx.version:-1)&&x.nt===nt&&x.emp===emp)return x.arbre;
  const t0=(typeof performance!=='undefined'?performance.now():0);
  const arbre=rayIdxConstruire(pa,ia,nt);
  rayIdxStat.construits++;rayIdxStat.msConstruction+=(typeof performance!=='undefined'?performance.now():0)-t0;
  rayIdxMemo.set(geo,{pa,pv:pos.version,ia,iv:idx?idx.version:-1,nt,emp,arbre});
  return arbre;
}
// Triangles des feuilles traversées par la demi-droite (repère local) → rayIdxCand[0..n), triés.
function rayIdxCandidats(A,ray){
  const bo=A.bo,lien=A.lien,nb=A.nb,ordre=A.ordre,m=A.marge;
  const ox=ray.origin.x,oy=ray.origin.y,oz=ray.origin.z,dx=ray.direction.x,dy=ray.direction.y,dz=ray.direction.z;
  const ix=1/dx,iy=1/dy,iz=1/dz;
  let n=0,sp=0;rayIdxPile[sp++]=0;
  while(sp>0){
    const i=rayIdxPile[--sp],o=6*i;
    let t0=-Infinity,t1=Infinity,a,b;
    if(dx===0){if(ox<bo[o]-m||ox>bo[o+3]+m)continue;}
    else{a=(bo[o]-m-ox)*ix;b=(bo[o+3]+m-ox)*ix;if(a>b){const q=a;a=b;b=q;}if(a>t0)t0=a;if(b<t1)t1=b;}
    if(dy===0){if(oy<bo[o+1]-m||oy>bo[o+4]+m)continue;}
    else{a=(bo[o+1]-m-oy)*iy;b=(bo[o+4]+m-oy)*iy;if(a>b){const q=a;a=b;b=q;}if(a>t0)t0=a;if(b<t1)t1=b;}
    if(dz===0){if(oz<bo[o+2]-m||oz>bo[o+5]+m)continue;}
    else{a=(bo[o+2]-m-oz)*iz;b=(bo[o+5]+m-oz)*iz;if(a>b){const q=a;a=b;b=q;}if(a>t0)t0=a;if(b<t1)t1=b;}
    if(!(t0<=t1)||t1<-m)continue; // manquée, ou toute entière derrière l'origine
    const c=nb[i];
    if(c){
      if(n+c>rayIdxCand.length){const g=new Uint32Array(2*(n+c));g.set(rayIdxCand.subarray(0,n));rayIdxCand=g;}
      for(let q=lien[i],e=q+c;q<e;q++)rayIdxCand[n++]=ordre[q];
    }else{
      if(sp+2>rayIdxPile.length)return -1; // jamais atteint (arbre équilibré) : repli par sûreté
      rayIdxPile[sp++]=lien[i];rayIdxPile[sp++]=i+1;
    }
  }
  if(n>1)rayIdxCand.subarray(0,n).sort();
  return n;
}
function rayIdxInstaller(T){
  if(!T||!T.Mesh||!T.Mesh.prototype||typeof T.Mesh.prototype._computeIntersections!=='function')return false;
  if(T.Mesh.prototype._computeIntersections.rayIdxOrigine)return true;
  const origine=T.Mesh.prototype._computeIntersections;
  const accelere=function(raycaster,intersects,rayLocal){
    if(rayIdxOff)return origine.call(this,raycaster,intersects,rayLocal);
    const geo=this.geometry,pos=geo&&geo.attributes&&geo.attributes.position,idx=geo&&geo.index;
    const dr=geo&&geo.drawRange;
    if(!pos||!pos.isBufferAttribute||pos.isInterleavedBufferAttribute||pos.itemSize!==3||pos.normalized||!(pos.array instanceof Float32Array)
      ||(idx&&(!idx.isBufferAttribute||idx.isInterleavedBufferAttribute||idx.itemSize!==1))
      ||(geo.morphAttributes&&geo.morphAttributes.position)||this.isSkinnedMesh
      ||!dr||dr.start%3!==0||dr.start<0)return origine.call(this,raycaster,intersects,rayLocal);
    const total=idx?idx.count:pos.count,nt=Math.floor(total/3);
    if(nt<RAY_IDX_MIN)return origine.call(this,raycaster,intersects,rayLocal);
    if(Array.isArray(this.material)){ // groupes croissants et disjoints : sinon l'ordre des impacts différerait
      const gs=geo.groups||[];let fin=0;
      for(let g=0;g<gs.length;g++){if(gs[g].start<fin||gs[g].start%3!==0){rayIdxStat.replis++;return origine.call(this,raycaster,intersects,rayLocal);}fin=gs[g].start+gs[g].count;}
    }
    let A=null,n=-1;
    try{A=rayIdxDe(geo,pos,idx,nt);n=rayIdxCandidats(A,rayLocal);}catch(e){n=-1;}
    if(n<0||n>(nt>>2)){rayIdxStat.replis++;return origine.call(this,raycaster,intersects,rayLocal);}
    rayIdxStat.rayons++;
    if(!n)return;
    // plage d'origine, en triangles : [d0, d1)
    const s0=dr.start,c0=dr.count,finO=Math.min(total,s0+c0);
    const d0=s0/3,d1=Math.ceil(finO/3);
    const C=rayIdxCand.slice(0,n); // copie : three peut relancer un rayon pendant l'appel (objets imbriqués)
    try{
      let q=0;
      while(q<n){
        let a=C[q],b=a+1;q++;
        while(q<n&&C[q]<=b){if(C[q]===b)b++;q++;} // plage de triangles consécutifs
        if(a<d0)a=d0;if(b>d1)b=d1;
        if(a>=b)continue;
        dr.start=3*a;dr.count=Math.min(3*(b-a),finO-3*a);
        origine.call(this,raycaster,intersects,rayLocal);
      }
    }finally{dr.start=s0;dr.count=c0;}
  };
  accelere.rayIdxOrigine=origine;
  T.Mesh.prototype._computeIntersections=accelere;
  return true;
}
try{if(typeof THREE!=='undefined')rayIdxInstaller(THREE);}catch(e){}
