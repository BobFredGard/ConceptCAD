/* ---------- relations entre faces (V0.99.34) : « Créer les relations » façon Fusion ----------
   Une occurrence (enfant direct du composant actif) est posée par des RELATIONS entre ses
   faces et celles du reste : chaque relation relie une géométrie de l'occurrence (a) à une
   géométrie cible (b) — face plane, face cylindrique, ou plan système d'un repère (XY, XZ, YZ
   de l'origine ou d'un repère de construction).
     · Coïncidente : plan contre plan (en vis-à-vis ; Inverser = affleurant), décalage ;
                     cylindre dans cylindre (axes confondus) ; axe d'un cylindre dans un plan ;
     · Angle       : angle entre les normales (ou les axes) ;
     · Parallèle   : normales (axes) parallèles ; plan et cylindre : axe parallèle au plan ;
     · Tangente    : cylindre contre plan (Inverser = de l'autre côté), cylindre contre
                     cylindre (extérieur ; Inverser = intérieur), décalage.
   Rien n'est figé au-delà : les degrés de liberté restants se pilotent au manipulateur. Le
   placement est recalculé à chaque résolution (46 : asmResolveIn) par moindres carrés
   (Levenberg-Marquardt) en partant de la position actuelle — la pièce bouge le moins possible.
   Référence durable : o.cons = [{id, t, a, b, v, inv, sg}] ; a.path relatif au composant de
   l'occurrence, b.path relatif au porteur ; face = signature (asmSnapSig : type, centre,
   normale ou axe, rayon) retrouvée après un rejeu comme les points d'accroche ; plan de
   repère = {cg (null = origine), p: 'XY'|'XZ'|'YZ'}. */
const ASM_CONS={coinc:{lab:'Coïncidente',ic:'⫠'},angle:{lab:'Angle',ic:'∠'},par:{lab:'Parallèle',ic:'∥'},tan:{lab:'Tangente',ic:'◠'}};
const ASM_CONS_LW=20; // poids des écarts d'orientation (mm par radian) face aux écarts de position
function asmConsOn(o){return !!(o&&!o.align&&!o.fixed&&!o.pat&&Array.isArray(o.cons)&&o.cons.length);}
/* ── modèle ── */
function asmConsRefNorm(r){
  if(!r||typeof r!=='object'||!Array.isArray(r.path))return null;
  const okV=v=>Array.isArray(v)&&v.length===3&&v.every(x=>isFinite(+x));
  const o={path:r.path.filter(x=>typeof x==='string')};
  if(r.pl&&typeof r.pl==='object'&&['XY','XZ','YZ'].includes(r.pl.p))o.pl={cg:typeof r.pl.cg==='string'?r.pl.cg:null,p:r.pl.p};
  else if(r.f&&(r.f.k==='plane'||r.f.k==='cyl')&&okV(r.f.c)&&okV(r.f.n)){
    o.f={k:r.f.k,c:r.f.c.map(Number),n:r.f.n.map(Number)};if(r.f.k==='cyl')o.f.r=+r.f.r||0;
    // V0.99.36 : plan milieu entre deux faces planes parallèles (f, f2)
    if(r.f.k==='plane'&&r.f2&&r.f2.k==='plane'&&okV(r.f2.c)&&okV(r.f2.n))o.f2={k:'plane',c:r.f2.c.map(Number),n:r.f2.n.map(Number)};}
  else return null;
  return o;
}
function asmConsNorm(L){
  // Liste de relations relue d'un fichier (ou copiée) ; undefined si vide
  if(!Array.isArray(L))return undefined;
  const out=[];
  L.forEach(k=>{if(!k||!ASM_CONS[k.t])return;const a=asmConsRefNorm(k.a),b=asmConsRefNorm(k.b);if(!a||!b)return;
    const q={id:typeof k.id==='string'?k.id:uid('rl'),t:k.t,a,b,v:isFinite(+k.v)?+k.v:0,inv:!!k.inv};
    if(k.sg===-1||k.sg===1)q.sg=k.sg;if(typeof k.name==='string')q.name=k.name;out.push(q);});
  return out.length?out:undefined;
}
function asmConsRemap(L,M){
  // Identifiants d'occurrences renouvelés (insertion, composants liés) : chemins suivis
  const n=asmConsNorm(L);if(!n)return undefined;
  n.forEach(k=>{k.a.path=k.a.path.map(M);k.b.path=k.b.path.map(M);});
  return n;
}
function asmConsName(L,k){return k.name||('Relation '+(L.indexOf(k)+1));}
function asmConsFind(G,f){
  // Face de même type et même orientation, centre le plus proche (même Ø d'abord), comme les
  // points d'accroche (48-assemblage-accroches : asmSnapFind)
  let best=null;
  (G&&G.faces||[]).forEach(F=>{
    if(F.k!==f.k)return;
    const d=asmV.dot(F.n,f.n);
    if(F.k==='plane'?d<0.999:Math.abs(d)<0.999)return;
    let s=asmV.len(asmV.sub(F.c,f.c));
    const sr=F.k==='cyl'&&Math.abs(F.r-(f.r||0))<1e-4?0:1;
    if(F.k==='cyl')s+=10*Math.abs(F.r-(f.r||0));
    if(!best||sr<best.sr||(sr===best.sr&&s<best.s))best={F,s,sr};
  });
  return best?best.F:null;
}
function asmConsLocal(cid,ref){
  // Géométrie {k, c, n, r?} d'une référence dans le repère du composant visé (bout du chemin)
  if(ref.pl){
    const F=asmCompFrame(cid,ref.pl.cg);if(!F)return null;
    return {k:'plane',c:F.o,n:ref.pl.p==='XY'?F.z:ref.pl.p==='XZ'?F.y:F.x};
  }
  const c=asmComp(cid);
  if(typeof asmSnapFresh==='function'&&asmSnapFresh(c)&&c._snapG.g){
    const F=asmConsFind(c._snapG.g,ref.f);
    if(!F)return null;
    ref.f=asmSnapSig(F); // la référence suit la face (rejeu du composant)
    if(ref.f2){const F2=asmConsFind(c._snapG.g,ref.f2);if(!F2)return null;ref.f2=asmSnapSig(F2);}
  }
  const f=ref.f;if(!f)return null;
  if(ref.f2)return asmConsMid(f,ref.f2);
  return {k:f.k,c:f.c.slice(),n:f.n.slice(),r:f.r};
}
function asmConsMid(f,f2){
  // Plan milieu de deux faces planes parallèles : normale de la première, à mi-distance
  const n=asmV.unit(f.n)||f.n,h=asmV.dot(asmV.sub(f2.c,f.c),n)/2;
  return {k:'plane',c:asmV.add(f.c,asmV.mul(n,h)),n:n.slice()};
}
function asmConsGeo(cid,ref){
  // Géométrie de la référence dans le repère du composant cid (chemin relatif à cid)
  const r=asmPathFrame(cid,ref&&ref.path);if(!r)return null;
  const g=asmConsLocal(r.comp,ref);if(!g)return null;
  return {k:g.k,c:asmApply(r.F,g.c),n:asmV.unit(asmRot(r.F,g.n))||g.n,r:g.r};
}
function asmConsXf(M,g){return {k:g.k,c:asmApply(M,g.c),n:asmRot(M,g.n),r:g.r};}
function asmConsRes(k,A,B,out){
  // Écarts d'une relation (0 = satisfaite) ; A : géométrie de l'occurrence, B : cible
  const V=asmV,L=ASM_CONS_LW,v=+k.v||0,s=k.inv?-1:1,sg=k.sg||1;
  const perp=(q,n)=>V.sub(q,V.mul(n,V.dot(q,n)));
  const pp=A.k==='plane'&&B.k==='plane',cc=A.k==='cyl'&&B.k==='cyl';
  const P=A.k==='plane'?A:B,C=A.k==='cyl'?A:B;
  if(k.t==='angle'){out.push(L*(V.dot(A.n,B.n)*s-Math.cos(v*Math.PI/180)));return;}
  if(k.t==='par'){
    if(pp||cc){const d=V.sub(A.n,V.mul(B.n,s*sg));out.push(L*d[0],L*d[1],L*d[2]);}
    else out.push(L*V.dot(C.n,P.n));
    return;
  }
  if(pp){ // coïncidente ou tangente : en vis-à-vis (Inverser = affleurant), écart v le long de la normale cible
    const d=V.add(A.n,V.mul(B.n,s));out.push(L*d[0],L*d[1],L*d[2],V.dot(V.sub(A.c,B.c),B.n)-v);return;
  }
  if(cc){
    const q=perp(V.sub(A.c,B.c),B.n);
    if(k.t==='tan'){
      const x=V.cross(A.n,B.n);out.push(L*x[0],L*x[1],L*x[2]);
      out.push(V.len(q)-(k.inv?Math.abs((A.r||0)-(B.r||0)):(A.r||0)+(B.r||0)+v));
    }else{const d=V.sub(A.n,V.mul(B.n,s*sg));out.push(L*d[0],L*d[1],L*d[2],q[0],q[1],q[2]);}
    return;
  }
  // un plan et un cylindre : axe parallèle au plan, à la distance voulue
  out.push(L*V.dot(C.n,P.n));
  const h=V.dot(V.sub(C.c,P.c),P.n);
  out.push(k.t==='tan'?h-s*((C.r||0)+v):h-v);
}
function asmConsRodr(w){
  // Matrice de rotation (colonnes) du vecteur rotation w
  const t=Math.hypot(w[0],w[1],w[2]);
  if(t<1e-15)return {o:[0,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
  const a=[w[0]/t,w[1]/t,w[2]/t],R=v=>cgRotDir(v,a,t);
  return {o:[0,0,0],x:R([1,0,0]),y:R([0,1,0]),z:R([0,0,1])};
}
function asmConsMove(M,P,x){
  // Déplacement rigide de M : rotation x[0..2] autour du point P, puis translation x[3..5]
  const R=asmConsRodr(x),rp=v=>asmRot(R,v),d=asmV.sub(M.o,P);
  return {o:asmV.add(asmV.add(P,rp(d)),[x[3],x[4],x[5]]),x:rp(M.x),y:rp(M.y),z:rp(M.z)};
}
function asmConsSolve6(A,g){
  // Résout A·x = g (6×6), pivot partiel → x | null
  const n=6,m=A.map((r,i)=>r.concat([g[i]]));
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(m[r][c])>Math.abs(m[p][c]))p=r;
    if(Math.abs(m[p][c])<1e-300)return null;
    [m[c],m[p]]=[m[p],m[c]];
    for(let r=c+1;r<n;r++){const f=m[r][c]/m[c][c];if(f)for(let k=c;k<=n;k++)m[r][k]-=f*m[c][k];}
  }
  const x=new Array(n).fill(0);
  for(let r=n-1;r>=0;r--){let s=m[r][n];for(let k=r+1;k<n;k++)s-=m[r][k]*x[k];x[r]=s/m[r][r];}
  return x.every(isFinite)?x:null;
}
function asmConsRank(J){
  // Rang numérique de J (m×6) : élimination avec pivot total, seuil relatif
  const m=J.map(r=>r.slice());let rank=0;
  const big=Math.max(1e-12,...m.map(r=>Math.max(...r.map(Math.abs))));
  const used=new Array(6).fill(false),rows=new Array(m.length).fill(false);
  for(let it=0;it<6;it++){
    let bi=-1,bj=-1,bv=1e-7*big;
    for(let i=0;i<m.length;i++)if(!rows[i])for(let j=0;j<6;j++)if(!used[j]&&Math.abs(m[i][j])>bv){bv=Math.abs(m[i][j]);bi=i;bj=j;}
    if(bi<0)break;
    rows[bi]=used[bj]=true;rank++;
    for(let i=0;i<m.length;i++)if(i!==bi){const f=m[i][bj]/m[bi][bj];if(f)for(let j=0;j<6;j++)m[i][j]-=f*m[bi][j];}
  }
  return rank;
}
function asmConsPrep(o,owner){
  // Relations de o avec leurs géométries : [{k, a (repère du composant de o), b (porteur)}] ;
  // {miss} si une géométrie est introuvable
  const out=[];
  for(const k of o.cons){
    const a=asmConsGeo(o.comp,k.a),b=asmConsGeo(owner.id,k.b);
    if(!a||!b)return {miss:k,side:!a?'a':'b'};
    out.push({k,a,b});
  }
  return {list:out};
}
function asmConsSolveFr(M0,list){
  // Position M de l'occurrence satisfaisant au mieux les relations, partant de M0
  // → {M, err (plus grand écart), dof (degrés de liberté restants)}
  const res=M=>{const r=[];list.forEach(q=>asmConsRes(q.k,asmConsXf(M,q.a),q.b,r));return r;};
  const cost=r=>r.reduce((s,x)=>s+x*x,0);
  let M=asmRound(M0);
  // retournement préalable : une orientation visée à l'opposé exact n'a pas de pente (le
  // calcul resterait bloqué) → demi-tour autour d'un axe perpendiculaire ; angle visé depuis
  // des normales alignées : inclinaison initiale de l'angle voulu
  for(let pass=0;pass<list.length;pass++){
    let done=true;
    for(const q of list){
      const A=asmConsXf(M,q.a),B=q.b,k=q.k,s=k.inv?-1:1,sg=k.sg||1;
      let want=null;
      if(k.t!=='angle'&&A.k==='plane'&&B.k==='plane')want=asmV.mul(B.n,k.t==='par'?s*sg:-s);
      else if(k.t!=='angle'&&k.t!=='tan'&&A.k==='cyl'&&B.k==='cyl')want=asmV.mul(B.n,s*sg);
      const d=want?asmV.dot(A.n,want):0;
      let ax=null,ang=0;
      if(want&&d<-0.999){ang=Math.PI;}
      else if(k.t==='angle'&&Math.abs(asmV.dot(A.n,B.n))>0.9999){const tv=Math.acos(Math.max(-1,Math.min(1,Math.cos((+k.v||0)*Math.PI/180)*s)));
        const cur=Math.acos(Math.max(-1,Math.min(1,asmV.dot(A.n,B.n))));ang=tv-cur;if(Math.abs(ang)<1e-9)ang=0;}
      if(!ang)continue;
      const t=Math.abs(A.n[0])<0.9?[1,0,0]:[0,1,0];ax=asmV.unit(asmV.cross(A.n,t));
      M=asmConsMove(M,A.c,[ax[0]*ang,ax[1]*ang,ax[2]*ang,0,0,0]);done=false;break;
    }
    if(done)break;
  }
  let r=res(M),c=cost(r);
  const P=()=>{const ps=list.map(q=>asmApply(M,q.a.c));return asmV.mul(ps.reduce((s,p)=>asmV.add(s,p),[0,0,0]),1/Math.max(1,ps.length));};
  let J=null,lam=1e-3;
  for(let it=0;it<200&&c>1e-18;it++){
    const Pc=P(),h=1e-7;
    J=r.map(()=>new Array(6).fill(0));
    for(let j=0;j<6;j++){const x=[0,0,0,0,0,0];x[j]=h;const rj=res(asmConsMove(M,Pc,x));rj.forEach((v,i)=>{J[i][j]=(v-r[i])/h;});}
    const A=[0,1,2,3,4,5].map(i=>[0,1,2,3,4,5].map(j=>J.reduce((s,row)=>s+row[i]*row[j],0)));
    const g=[0,1,2,3,4,5].map(i=>-J.reduce((s,row,k)=>s+row[i]*r[k],0));
    const dmax=Math.max(1e-12,...A.map((row,i)=>row[i]));
    let ok=false;
    for(let tries=0;tries<30;tries++){
      const Ad=A.map((row,i)=>row.map((v,j)=>i===j?v+lam*dmax:v));
      const x=asmConsSolve6(Ad,g);if(!x){lam*=10;continue;}
      const Mn=asmConsMove(M,Pc,x),rn=res(Mn),cn=cost(rn);
      if(cn<c){M=Mn;r=rn;c=cn;lam=Math.max(lam/5,1e-15);ok=true;break;}
      lam*=6;if(lam>1e12)break;
    }
    if(!ok)break;
  }
  // degrés de liberté restants : rang des écarts autour de la solution
  let dof=6;
  try{const Pc=P(),h=1e-6;const r0=res(M);const Jr=r0.map(()=>new Array(6).fill(0));
    for(let j=0;j<6;j++){const x=[0,0,0,0,0,0];x[j]=h;const rj=res(asmConsMove(M,Pc,x));rj.forEach((v,i)=>{Jr[i][j]=(v-r0[i])/h;});}
    dof=6-asmConsRank(Jr);}catch(e){}
  // orthonormalisation (le cumul des rotations dérive de 1e-16 par pas)
  const Z=asmV.unit(M.z),X=asmV.unit(asmV.sub(M.x,asmV.mul(Z,asmV.dot(M.x,Z))));
  M={o:M.o,x:X,y:asmV.cross(Z,X),z:Z};
  return {M:asmRound(M),err:Math.max(0,...res(M).map(Math.abs)),dof};
}
function asmConsDeps(o){return (o.cons||[]).map(k=>k.b&&k.b.path&&k.b.path[0]).filter(Boolean);}
function asmConsApply(o,owner){
  // Résout les relations d'une occurrence (46 : asmResolveIn) → true si elle a bougé
  if(asmConsDeps(o).includes(o.id)){o.st='warn';o.msg='une relation vise l’occurrence elle-même';return false;}
  const pr=asmConsPrep(o,owner);
  if(pr.miss){o.st='warn';o.msg=(pr.side==='a'?'face de la pièce':'face cible')+' introuvable dans « '+asmConsName(o.cons,pr.miss)+' » (la face a disparu ?) — position mémorisée';return false;}
  const S=asmConsSolveFr(o.fr,pr.list);
  o._dof=S.dof;
  const ch=['o','x','y','z'].some(k=>S.M[k].some((v,j)=>Math.abs(v-o.fr[k][j])>1e-9));
  if(ch)o.fr=S.M;
  if(S.err>1e-4){o.st='warn';o.msg='relations incompatibles (écart restant '+String(+S.err.toFixed(3)).replace('.',',')+') — vérifiez les décalages ou supprimez une relation';}
  else{o.st='ok';o.msg='';}
  return ch;
}
function asmConsOnDelete(id){
  // Une occurrence supprimée : les relations qui passaient par elle tombent
  if(!asm)return;
  asm.comps.forEach(c=>c.occ.forEach(q=>{if(!Array.isArray(q.cons))return;
    q.cons=q.cons.filter(k=>!(k.a.path.includes(id)||k.b.path.includes(id)));if(!q.cons.length)delete q.cons;}));
}
/* ── commande « Relations » ──
   asmRel = {occ, list (relations validées), cur {t, a, b, aG, bG, v, inv, sg}, edit (indice
   en cours de modification ou -1), saved {fr, cons} (état d'avant la commande), planes} */
let asmRel=null;
function asmRelStart(occId){
  if(typeof skEdit!=='undefined'&&skEdit){try{faceEl.textContent='Fermez d’abord l’esquisse.';}catch(e){}return;}
  if(!asm||!asmOn()){asmRelSay('Relations : insérez d’abord au moins deux composants (📥 Insérer, ➕ Nouveau composant).');return;}
  if(asmMode!=='asm')asmEnter();
  try{if(asmAlign)asmAlignCancel();}catch(e){}
  asmRel={occ:null,list:[],cur:asmRelNew(),edit:-1,saved:null,planes:true};
  const o=occId&&asmOcc(occId);
  if(o&&asmActiveComp().occ.includes(o)&&!asmRelRefuse(o))asmRelTake(o);
  asmRelRefresh();
  asmRelSay('Relations : cliquez une face (ou un plan de repère) de la pièce à déplacer, puis la face où la poser.');
}
function asmRelNew(t){return {t:t||null,a:null,b:null,aG:null,bG:null,v:0,inv:false,sg:1};}
function asmRelRefuse(o){
  // Pourquoi l'occurrence ne peut pas être déplacée par des relations (null = elle peut)
  if(!o)return 'aucune pièce';
  if(o.fixed)return '« '+o.name+' » est fixée';
  if(o.pat)return '« '+o.name+' » est une instance de répétition (elle suit sa source)';
  if(o.align)return '« '+o.name+' » est tenue par une liaison (supprimez-la d’abord)';
  return null;
}
function asmRelTake(o){
  const R=asmRel;R.occ=o.id;R.saved=JSON.parse(JSON.stringify({fr:o.fr,cons:o.cons||null}));R.orig=JSON.parse(JSON.stringify(R.saved));
  R.list=(asmConsNorm(o.cons)||[]);
}
function asmRelCurDone(){const c=asmRel&&asmRel.cur;return !!(c&&c.a&&c.b&&c.t);}
function asmRelPreview(){
  const R=asmRel,o=R&&asmOcc(R.occ);if(!o)return;
  const L=R.list.map(k=>Object.assign({},k));
  if(asmRelCurDone()){const c=R.cur,k={id:c.id||uid('rl'),t:c.t,a:c.a,b:c.b,v:c.v,inv:c.inv,sg:c.sg};c.id=k.id;
    if(R.edit>=0)L[R.edit]=k;else L.push(k);}
  o.fr=JSON.parse(JSON.stringify(R.saved.fr));
  if(L.length)o.cons=L;else delete o.cons;
  // la pièce part de sa position d'avant la commande : chaque réglage repart du même point
  asmResolve();
}
function asmRelRefresh(){
  try{asmRelPreview();}catch(e){}
  try{asmDraw();asmRelMarks();asmGizmoDraw();renderTree();renderProps();}catch(e){}
}
function asmRelSign(){
  // Sens des axes au moment du choix : la pièce garde le sien (sg), Inverser le retourne
  const R=asmRel,c=R.cur,o=asmOcc(R.occ),owner=asmActiveComp();if(!o||!c.a||!c.b)return;
  const A=asmConsGeo(o.comp,c.a),B=asmConsGeo(owner.id,c.b);if(!A||!B)return;
  const d=asmV.dot(asmRot(R.saved.fr,A.n),B.n);c.sg=d<0?-1:1;
}
function asmRelSet(side,ref,G,abs){
  const R=asmRel,c=R.cur;
  c[side]=ref;c[side+'G']={G,abs};
  if(side==='a'&&!c.b){asmRelSay('Relations : cliquez maintenant la face (ou le plan) où poser la pièce.');}
  if(c.a&&c.b){asmRelSign();if(!c.t)c.t=c.aG.G.k===c.bG.G.k?'coinc':'tan';
    asmRelSay('Relations : '+ASM_CONS[c.t].lab+' — réglez le décalage, Inverser, ou ＋ pour une autre relation, puis OK.');}
  asmRelRefresh();
}
function asmRelSay(t){
  // V0.99.36 : consigne ou refus de la commande — aussi en tête de son panneau (la barre d'état
  // est réécrite aussitôt par le mode Placer : MERLIN-39-000, « rien ne se passe »)
  try{faceEl.textContent=t;}catch(e){}
  if(asmRel){asmRel.msg=t;try{renderProps();}catch(e){}}
}
function asmRelPickAt(e){
  // Clic dans la vue pendant la commande → true si consommé
  const R=asmRel;if(!R)return false;
  const S=asmSceneGet(),P=asm.path,n=P.length;
  rayc.ray.copy(asmRay(e));
  // 1. plans des repères (dessinés par-dessus tout)
  const MG=S.getObjectByName('asmRelMarks');
  if(MG){MG.updateMatrixWorld(true);const ms=[];MG.traverse(m=>{if(m.isMesh&&m.userData.rp)ms.push(m);});
    const h=rayc.intersectObjects(ms,false)[0];
    if(h){const q=h.object.userData.rp;R.midP=null;asmRelPickRef(q.rel.path,{path:q.rel.path.slice(),pl:{cg:q.rel.cg,p:q.p}},{k:'plane',pl:true,F:q.F,p:q.p});return true;}}
  // 2. faces des pièces
  const G=S.getObjectByName('asmOcc');if(!G)return true;
  const ms=[];G.traverse(m=>{if(m.isMesh&&m.parent&&Array.isArray(m.parent.userData.path))ms.push(m);});
  const hits=[];ms.forEach(m=>{try{THREE.Mesh.prototype.raycast.call(m,rayc,hits);}catch(err){}});
  hits.sort((a,b)=>a.distance-b.distance);
  for(const h of hits){
    const path=h.object.parent.userData.path;
    if(path.length<n||!P.every((q,i)=>path[i]===q))continue; // hors du composant actif
    const cid=asmPathComp(path),c=asmComp(cid);if(!c)continue;
    const Gs=typeof asmSnapGeomOf==='function'?asmSnapGeomOf(c):null;
    if(!Gs){asmRelSay('Relations : noyau exact indisponible (faces non lues).');return true;}
    const inv=new THREE.Matrix4().copy(h.object.matrixWorld).invert();
    const pl=h.point.clone().applyMatrix4(inv),nl=h.face?h.face.normal.clone():null;
    const F=asmSnapHitFace(Gs,[pl.x,pl.y,pl.z],nl?[nl.x,nl.y,nl.z]:null);
    if(!F){asmRelSay('Relations : cette face n’est ni plane ni cylindrique — choisissez une autre face ou un plan de repère.');return true;}
    // V0.99.36 : plan milieu (bouton du côté visé) — 1re face retenue, la 2e parallèle complète
    const rp=path.slice(n),side=R.occ?(rp[0]===R.occ?'a':'b'):'a';
    if(R.mid&&R.mid[side]){
      if(F.k!=='plane'){asmRelSay('Relations : plan milieu — cliquez deux faces PLANES parallèles.');return true;}
      const M=R.midP;
      if(!M||M.side!==side||M.abs.join('/')!==path.join('/')){
        R.midP={side,abs:path.slice(),F};asmRelSay('Relations : plan milieu — cliquez maintenant la 2e face, parallèle à la première (même pièce).');asmRelRefresh();return true;}
      if(Math.abs(asmV.dot(M.F.n,F.n))<0.999){asmRelSay('Relations : plan milieu — la 2e face doit être parallèle à la première.');return true;}
      if(asmV.len(asmV.sub(M.F.c,F.c))<1e-6){asmRelSay('Relations : plan milieu — choisissez une AUTRE face, parallèle à la première.');return true;}
      R.midP=null;
      asmRelPickRef(rp,{path:rp,f:asmSnapSig(M.F),f2:asmSnapSig(F)},{k:'plane',F:M.F,F2:F,mid:true},path.slice());
      return true;
    }
    asmRelPickRef(path.slice(n),{path:path.slice(n),f:asmSnapSig(F)},{k:F.k,F},path.slice());
    return true;
  }
  asmRelSay('Relations : cliquez une face plane ou cylindrique, ou un plan de repère.');
  return true;
}
function asmRelPickRef(relPath,ref,G,abs){
  // relPath : chemin relatif au composant actif ; [] = le composant actif lui-même
  const R=asmRel,c=R.cur,owner=asmActiveComp();
  abs=abs||asm.path.concat(relPath);
  const head=relPath[0]||null;
  R.unlock=null;
  const sideA=()=>{ // la référence devient a : relative au composant de l'occurrence
    const r=Object.assign({},ref,{path:relPath.slice(1)});asmRelSet('a',r,G,abs);};
  const sideB=()=>asmRelSet('b',Object.assign({},ref,{path:relPath.slice()}),G,abs);
  if(!R.occ){
    const o=head&&owner.occ.find(q=>q.id===head);
    if(!o){asmRelSay('Relations : choisissez d’abord une face de la pièce à DÉPLACER (le composant actif lui-même ne bouge pas).');return;}
    const why=asmRelRefuse(o);
    if(why){
      // V0.99.36 : liaison ou fixation → proposée à retirer ici (MERLIN-39-000 : pièce importée tenue
      // par une liaison Rigide, aucune face ne se laissait prendre). Annuler les remet.
      R.unlock=(o.align||o.fixed)&&!o.pat?{lab:o.align?'Supprimer la liaison et poser cette face':'Libérer la pièce et poser cette face',go:()=>{
        const prev={align:o.align||null,fixed:!!o.fixed};try{asmAnimStop();}catch(e){}o.align=null;o.fixed=false;
        asmRelTake(o);R.orig.align=prev.align;R.orig.fixed=prev.fixed;R.saved.align=prev.align;R.saved.fixed=prev.fixed;
        R.unlock=null;R.msg='';sideA();try{asmResolve();asmDraw();renderTree();renderProps();}catch(e){}}}:null;
      asmRelSay('Relations : '+why+' — choisissez d’abord une face de l’autre pièce.');return;}
    asmRelTake(o);sideA();return;
  }
  if(head===R.occ){
    if(c.a&&c.b){asmRelSay('Relations : les deux faces sont choisies — × pour en changer une, ou ＋ pour une nouvelle relation.');return;}
    if(!c.a){sideA();return;}
    asmRelSay('Relations : cette face est sur la pièce déplacée — choisissez la face où la poser (autre pièce ou repère).');return;
  }
  if(!c.a){
    // aucune face de la pièce encore : une face d'une autre pièce libre la remplace si rien n'est validé
    const o=head&&owner.occ.find(q=>q.id===head);
    if(o&&!R.list.length&&!asmRelRefuse(o)&&!c.b){asmRelRestore();asmRelTake(o);sideA();return;}
    if(!c.b){sideB();asmRelSay('Relations : cible choisie — cliquez maintenant la face de « '+(asmOcc(R.occ)||{}).name+' ».');return;}
    asmRelSay('Relations : cliquez une face de « '+(asmOcc(R.occ)||{}).name+' ».');return;
  }
  if(!c.b){sideB();return;}
  asmRelSay('Relations : les deux faces sont choisies — × pour en changer une, ou ＋ pour une nouvelle relation.');
}
function asmRelRestore(){
  const R=asmRel,o=R&&asmOcc(R.occ);if(!o||!R.saved)return;
  const S=R.orig||R.saved;o.fr=JSON.parse(JSON.stringify(S.fr));if(S.cons)o.cons=JSON.parse(JSON.stringify(S.cons));else delete o.cons;
  if('align' in S)o.align=S.align?JSON.parse(JSON.stringify(S.align)):null; // liaison retirée par « Libérer » (V0.99.36)
  if('fixed' in S)o.fixed=S.fixed;
}
function asmRelAdd(){
  // Valide la relation en cours (＋) et en commence une autre sur la même pièce
  const R=asmRel;if(!R)return;
  if(!asmRelCurDone()){asmRelSay('Relations : choisissez les deux faces avant d’ajouter une relation.');return;}
  const c=R.cur,k={id:c.id||uid('rl'),t:c.t,a:c.a,b:c.b,v:c.v,inv:c.inv,sg:c.sg};
  if(R.edit>=0)R.list[R.edit]=k;else R.list.push(k);
  R.edit=-1;R.cur=asmRelNew();
  // la position d'ARRIVÉE devient le départ des suivantes (la pièce ne revient pas en arrière)
  try{asmRelPreview();const o=asmOcc(R.occ);if(o)R.saved.fr=JSON.parse(JSON.stringify(o.fr));}catch(e){}
  asmRelRefresh();
  asmRelSay('Relations : '+R.list.length+' relation(s). Cliquez deux faces pour une autre, ou OK.');
}
function asmRelEdit(i){
  const R=asmRel;if(!R||!R.list[i])return;
  if(asmRelCurDone())asmRelAdd();
  const k=R.list[i];R.edit=i;
  R.cur={id:k.id,t:k.t,a:k.a,b:k.b,aG:asmRelGOf('a',k.a),bG:asmRelGOf('b',k.b),v:+k.v||0,inv:!!k.inv,sg:k.sg||1};
  asmRelRefresh();
}
function asmRelGOf(side,ref){
  // Surbrillance d'une référence enregistrée : géométrie complète de la face (si lue) ou plan
  const R=asmRel,o=asmOcc(R.occ);
  const rel=side==='a'?[R.occ].concat(ref.path):ref.path.slice(),abs=asm.path.concat(rel);
  const cid=asmPathComp(abs);if(!cid)return null;
  if(ref.pl){const F=asmCompFrame(cid,ref.pl.cg);return F?{G:{k:'plane',pl:true,F,p:ref.pl.p},abs}:null;}
  const c=asmComp(cid),Gs=typeof asmSnapGeomOf==='function'?asmSnapGeomOf(c):null,F=Gs&&asmConsFind(Gs,ref.f);
  return F?{G:{k:F.k,F},abs}:(o?{G:{k:ref.f.k,F:null},abs}:null);
}
function asmRelDel(i){
  const R=asmRel;if(!R)return;
  if(i==null){R.cur=asmRelNew();R.edit=-1;}
  else{R.list.splice(i,1);if(R.edit===i){R.edit=-1;R.cur=asmRelNew();}else if(R.edit>i)R.edit--;}
  asmRelRefresh();
}
function asmRelClear(side){const c=asmRel&&asmRel.cur;if(!c)return;c[side]=null;c[side+'G']=null;asmRelRefresh();}
function asmRelCommit(){
  const R=asmRel,o=R&&asmOcc(R.occ);
  if(!o){asmRelCancel();return;}
  if(asmRelCurDone())asmRelAdd();
  const now={fr:o.fr,cons:o.cons,align:o.align,fixed:o.fixed};
  asmRelRestore();
  asmPush('relations de « '+o.name+' »');
  o.fr=now.fr;o.align=now.align;o.fixed=now.fixed;if(R.list.length)o.cons=R.list.map(k=>Object.assign({},k));else delete o.cons;
  asmRel=null;asmRelMarks();asmResolve();asmSelId=o.id;asmNotify();asmGizmoDraw();
  try{faceEl.textContent='« '+o.name+' » : '+(o.cons?o.cons.length+' relation(s)'+(o._dof!=null?', '+o._dof+' degré(s) de liberté restant(s)':''):'aucune relation')+(o.st==='warn'?' — ⚠ '+o.msg:'')+'. Elle suivra les faces si les pièces changent.';}catch(e){}
}
function asmRelCancel(){
  const R=asmRel;asmRel=null;
  if(R&&R.saved){const cur=asmRel;asmRel=R;asmRelRestore();asmRel=cur;}
  asmRelMarks();try{asmResolve();asmDraw();asmGizmoDraw();renderTree();renderProps();}catch(e){}
}
/* ── dessin : faces choisies (bleu) et plans des repères ── */
function asmRelMarks(){
  const S=asmSceneGet();let G=S.getObjectByName('asmRelMarks');
  if(G){S.remove(G);G.traverse(m=>{const i=TRIADS.indexOf(m);if(i>=0)TRIADS.splice(i,1);try{if(m.geometry)m.geometry.dispose();if(m.material)m.material.dispose();}catch(e){}});}
  const R=asmRel;if(!R)return;
  G=new THREE.Group();G.name='asmRelMarks';S.add(G);
  const V=asmInverse(asmWorld(asm.path)||asmFr0());
  const W=abs=>asmCompose(V,asmWorld(abs)||asmFr0());
  let size=20;try{const b=new THREE.Box3();S.getObjectByName('asmOcc').traverse(m=>{if(m.isMesh)b.expandByObject(m);});if(!b.isEmpty())size=Math.max(5,0.18*b.getSize(new THREE.Vector3()).length());}catch(e){}
  // plans des repères : petits carrés cliquables (origine du composant actif, de chaque pièce,
  // et repères de construction), comme le repère de la pièce
  if(R.planes){
    asmFramesUnder(asm.active,null).forEach(f=>{
      const Fw=f.F,t=triadMake({name:'rp_'+asmRelFrKey(f.rel),px:62,renderOrder:993}),pg=t.userData.planeGroup;
      const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...Fw.x),new THREE.Vector3(...Fw.y),new THREE.Vector3(...Fw.z)));
      [t,pg].forEach(x=>{if(!x)return;x.position.set(Fw.o[0],Fw.o[1],Fw.o[2]);x.quaternion.copy(q);G.add(x);});
      const Fc=f.rel.cg?asmCompFrame(asmPathComp(asm.path.concat(f.rel.path)),f.rel.cg):asmFr0();
      Object.keys(t.userData.planes||{}).forEach(p=>{t.userData.planes[p].userData.rp={rel:f.rel,p,F:Fc,name:f.name};});
    });
  }
  const blue=(on)=>new THREE.MeshBasicMaterial({color:on?0x0a84ff:0x5ac8fa,transparent:true,opacity:on?0.5:0.38,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
  const one=(gg,on)=>{
    if(!gg||!gg.G)return;const g=gg.G,M=asmMat4(W(gg.abs));let mesh=null;
    if(g.pl){
      const F=g.F,ax=g.p==='XY'?[F.x,F.y,F.z]:g.p==='XZ'?[F.x,F.z,F.y]:[F.y,F.z,F.x],h=size/2;
      const pts=[[-h,-h],[h,-h],[h,h],[-h,h]].map(([u,v])=>asmV.add(F.o,asmV.add(asmV.mul(ax[0],u),asmV.mul(ax[1],v))));
      const ge=new THREE.BufferGeometry();const vv=[];[[0,1,2],[0,2,3]].forEach(tr=>tr.forEach(i=>vv.push(...pts[i])));
      ge.setAttribute('position',new THREE.Float32BufferAttribute(vv,3));mesh=new THREE.Mesh(ge,blue(on));
    }else if(g.F&&g.k==='plane'){
      const F=g.F,[u0,u1,v0,v1]=F.rect,off=asmV.mul(F.n,0.02);
      const pts=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>asmV.add(asmV.add(F.c,off),asmV.add(asmV.mul(F.x,u),asmV.mul(F.y,v))));
      const ge=new THREE.BufferGeometry();const vv=[];[[0,1,2],[0,2,3]].forEach(tr=>tr.forEach(i=>vv.push(...pts[i])));
      ge.setAttribute('position',new THREE.Float32BufferAttribute(vv,3));mesh=new THREE.Mesh(ge,blue(on));
    }else if(g.F&&g.k==='cyl'){
      const F=g.F,len=Math.max(0.1,F.t[1]-F.t[0]);
      mesh=new THREE.Mesh(new THREE.CylinderGeometry(F.r*1.01,F.r*1.01,len,48,1,true),blue(on));
      const d=new THREE.Vector3(...F.n).normalize();mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);
      const c=asmV.add(F.l,asmV.mul(F.n,(F.t[0]+F.t[1])/2));mesh.position.set(c[0],c[1],c[2]);
    }
    if(!mesh)return;
    mesh.renderOrder=996;mesh.raycast=()=>{};
    const w=new THREE.Group();w.matrixAutoUpdate=false;w.matrix.copy(M);w.add(mesh);G.add(w);
    if(g.mid&&g.F2){ // plan milieu : la 2e face, puis le plan à mi-chemin (contour de la 1re)
      one({G:{k:'plane',F:g.F2},abs:gg.abs},on);
      const h=asmV.dot(asmV.sub(g.F2.c,g.F.c),g.F.n)/2;
      one({G:{k:'plane',F:Object.assign({},g.F,{c:asmV.add(g.F.c,asmV.mul(g.F.n,h))})},abs:gg.abs},!on);
    }
  };
  one(R.cur.aG,true);one(R.cur.bG,false);
  if(R.midP)one({G:{k:'plane',F:R.midP.F},abs:R.midP.abs},R.midP.side==='a');
  G.updateMatrixWorld(true);
}
function asmRelFrKey(r){return (r.path||[]).join('/')+'|'+(r.cg||'');}
function asmRelRefName(side,ref){
  // « Base:1 · Face plane », « Origine · plan XY »…
  if(!ref)return '—';
  const R=asmRel,owner=asmActiveComp();
  const rel=side==='a'?[R.occ].concat(ref.path):ref.path;
  let c=owner;const parts=[];
  for(const id of rel){const o=c&&c.occ.find(q=>q.id===id);if(!o)return '?';parts.push(o.name);c=asmComp(o.comp);}
  if(!parts.length)parts.push(owner.name);
  if(ref.pl){const nm=ref.pl.cg?(((c&&c.doc.cgeo)||[]).find(k=>k.id===ref.pl.cg)||{}).name||'Repère':'Origine';return parts.join(' › ')+' · '+nm+' plan '+ref.pl.p;}
  if(ref.f2)return parts.join(' › ')+' · Plan milieu (2 faces)';
  return parts.join(' › ')+' · '+(ref.f.k==='plane'?'Face plane':'Cylindre Ø'+(+(2*(ref.f.r||0)).toFixed(3)));
}
function asmRelGeomLab(k){const g=r=>r.pl?'Plan':r.f.k==='cyl'?'Cyl.':'Face';return g(k.a)+'-'+g(k.b);}
/* ── panneau ── */
function asmRelProps(p){
  const R=asmRel,o=asmOcc(R.occ),c=R.cur;
  const mk=(tag,cls,txt)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(txt!=null)d.textContent=txt;return d;};
  const Row=(lab,ctl)=>{const r=mk('div','pnl-row');r.appendChild(mk('label',null,lab));if(ctl)r.appendChild(ctl);p.appendChild(r);return r;};
  const num=(v,fn)=>{const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.style.width='70px';i.value=String(+(+v).toFixed(4)).replace('.',',');
    const go=()=>{const x=parseFloat(String(i.value).replace(',','.'));if(isFinite(x))fn(x);};i.addEventListener('change',go);i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}});return i;};
  p.appendChild(mk('div','pnl-h','🧲 Créer les relations'+(o?' — « '+o.name+' »':'')));
  if(R.msg)p.appendChild(mk('div','pnl-note',R.msg.replace(/^Relations : /,'')));
  if(R.unlock){const ub=mk('div','pnl-btns'),u=mk('button','primary',R.unlock.lab);u.onclick=R.unlock.go;ub.appendChild(u);p.appendChild(ub);}
  // type de relation
  const tb=mk('div','pnl-btns');
  Object.keys(ASM_CONS).forEach(t=>{const b=mk('button','mini',ASM_CONS[t].ic+' '+ASM_CONS[t].lab);
    if(c.t===t)b.style.outline='2px solid var(--accent, #0a84ff)';
    b.title={coinc:'Face contre face (Inverser = affleurant), cylindre dans cylindre, axe dans un plan',angle:'Angle entre les deux faces (normales) ou les deux axes',
      par:'Faces ou axes parallèles, sans imposer la distance',tan:'Cylindre tangent à une face plane ou à un autre cylindre (Inverser = de l’autre côté / intérieur)'}[t];
    b.onclick=()=>{c.t=t;if(t==='angle'&&R.cur.v===0)R.cur.v=90;asmRelRefresh();};tb.appendChild(b);});
  Row('Type',null);p.appendChild(tb);
  // géométries
  const geo=(side,lab)=>{const r=Row(lab,null);const s=mk('span',null,c[side]?asmRelRefName(side,c[side]):(side==='a'?'cliquez une face de la pièce à déplacer':'cliquez la face où la poser'));
    s.style.cssText='flex:1;font-size:11px;'+(c[side]?'':'color:var(--muted);font-style:italic');r.appendChild(s);
    if(c[side]){const x=mk('button','mini','×');x.title='Choisir une autre face';x.onclick=()=>asmRelClear(side);r.appendChild(x);}
    else{const m=mk('button','mini','▤ Plan milieu');m.title='Plan à mi-chemin entre deux faces planes parallèles : cliquez les deux faces';
      R.mid=R.mid||{};if(R.mid[side])m.style.outline='2px solid var(--accent, #0a84ff)';
      m.onclick=()=>{R.mid[side]=!R.mid[side];if(R.midP&&R.midP.side===side)R.midP=null;
        asmRelSay(R.mid[side]?'Relations : plan milieu — cliquez deux faces planes parallèles de '+(side==='a'?'la pièce à déplacer':'la cible')+'.':'Relations : plan milieu retiré — un clic = une face.');asmRelRefresh();};
      r.appendChild(m);}};
  geo('a','Pièce déplacée');geo('b','Cible');
  if(asmRelCurDone()){
    if(c.t!=='par')Row(c.t==='angle'?'Angle (°)':'Décalage (mm)',num(c.v,x=>{c.v=x;asmRelRefresh();}));
    const iv=mk('button','mini','⇅ Inverser');iv.title='Retourner la pièce : en vis-à-vis ↔ affleurant, de l’autre côté, sens de l’axe';
    if(c.inv)iv.style.outline='2px solid var(--accent, #0a84ff)';iv.onclick=()=>{c.inv=!c.inv;asmRelRefresh();};
    const ad=mk('button','mini','＋ Ajouter une relation');ad.title='Garder cette relation et en créer une autre sur la même pièce';ad.onclick=asmRelAdd;
    const b=mk('div','pnl-btns');b.appendChild(iv);b.appendChild(ad);p.appendChild(b);
  }
  // relations de la pièce
  const all=R.list.map((k,i)=>({k,i}));
  if(all.length||asmRelCurDone()){
    p.appendChild(mk('div','pnl-note','Relations de la pièce :'));
    const tbl=mk('div',null);tbl.style.cssText='display:flex;flex-direction:column;gap:2px;margin:2px 0 6px';
    const line=(k,i,cur)=>{const r=mk('div',null);r.style.cssText='display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 4px;border-radius:4px;cursor:pointer;'+(cur?'background:rgba(10,132,255,.22)':'');
      r.appendChild(mk('span',null,ASM_CONS[k.t].ic));const nm=mk('span',null,(k.name||('Relation '+(i+1)))+' · '+ASM_CONS[k.t].lab+' · '+asmRelGeomLab(k));nm.style.flex='1';r.appendChild(nm);
      if(k.t!=='par')r.appendChild(mk('span',null,String(+(+k.v||0).toFixed(3)).replace('.',',')+(k.t==='angle'?'°':' mm')+(k.inv?' ⇅':'')));
      if(!cur){r.onclick=()=>asmRelEdit(i);r.title='Clic = modifier cette relation';}
      const x=mk('button','mini','×');x.title='Supprimer cette relation';x.onclick=ev=>{ev.stopPropagation();asmRelDel(cur&&R.edit<0?null:i);};r.appendChild(x);
      tbl.appendChild(r);};
    all.forEach(({k,i})=>line(R.edit===i&&asmRelCurDone()?c:k,i,R.edit===i));
    if(asmRelCurDone()&&R.edit<0)line(c,R.list.length,true);
    p.appendChild(tbl);
  }
  if(o){
    if(o.st==='warn')p.appendChild(mk('div','pnl-note','⚠ '+o.msg));
    else if(o.cons&&o._dof!=null)p.appendChild(mk('div','pnl-note',o._dof?('Degrés de liberté restants : '+o._dof+' — après OK, le manipulateur déplace la pièce le long de ce qui reste libre.'):'Pièce entièrement positionnée (aucun degré de liberté restant).'));
  }
  if(o){
    // V0.99.36 : déplacer / tourner la pièce pendant la commande (demande de Fred) — depuis sa
    // position au début de la commande ; ce que les relations tiennent revient, le reste suit
    R.mv=R.mv&&R.mv.occ===o.id?R.mv:{occ:o.id,v:[0,0,0,0,0,0]};
    const mvBy=(k,d)=>{if(!d||!R.saved)return;const F=R.saved.fr;
      R.saved.fr=k<3?asmRound(Object.assign({},F,{o:F.o.map((q,j)=>q+ASM_AX[k][j]*d)})):asmRotFr(F,F.o,ASM_AX[k-3],d*Math.PI/180);
      R.mv.v[k]=+(R.mv.v[k]+d).toFixed(9);asmRelRefresh();};
    p.appendChild(mk('div','pnl-note','Déplacer la pièce (depuis le début de la commande ; les directions tenues par les relations ne bougent pas) :'));
    ['X','Y','Z'].forEach((k,i)=>Row('Distance '+k+' (mm)',num(R.mv.v[i],v=>mvBy(i,v-R.mv.v[i]))));
    ['X','Y','Z'].forEach((k,i)=>Row('Angle '+k+' (°)',num(R.mv.v[3+i],v=>mvBy(3+i,v-R.mv.v[3+i]))));
  }
  const pl=document.createElement('input');pl.type='checkbox';pl.checked=R.planes;pl.onchange=()=>{R.planes=pl.checked;asmRelMarks();};
  Row('Plans des repères',pl).title='Montrer les plans XY, XZ, YZ de l’origine et des repères (cliquables comme des faces)';
  const b=mk('div','pnl-btns');
  const ok=mk('button','primary','OK');ok.onclick=asmRelCommit;b.appendChild(ok);
  const no=mk('button',null,'Annuler');no.onclick=asmRelCancel;b.appendChild(no);p.appendChild(b);
}
function asmRelOccProps(p,o){
  // Section « Relations » du panneau d'une occurrence (48-assemblage-placement)
  const mk=(tag,cls,txt)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(txt!=null)d.textContent=txt;return d;};
  if(!Array.isArray(o.cons)||!o.cons.length)return;
  p.appendChild(mk('div','pnl-note','🧲 '+o.cons.length+' relation(s) : '+o.cons.map(k=>ASM_CONS[k.t].lab).join(', ')+
    (o._dof!=null?' · '+(o._dof?o._dof+' degré(s) de liberté restant(s) (manipulateur)':'entièrement positionnée'):'')));
  const b=mk('div','pnl-btns');
  const ed=mk('button',null,'🧲 Modifier les relations…');ed.onclick=()=>asmRelStart(o.id);b.appendChild(ed);
  const rm=mk('button',null,'Supprimer les relations');rm.title='La pièce garde sa position actuelle et redevient libre';
  rm.onclick=()=>{asmPush('supprimer les relations');delete o.cons;delete o._dof;asmNotify();};b.appendChild(rm);
  p.appendChild(b);
}
