/* ============ FAO : calculs sur la CARTE GRAPHIQUE (WebGPU, V0.100.0) ============
   Demande de Fred (14/11) : « fais en sorte que tout ce qui peut être traité par la carte
   graphique le soit ». Essai préalable (SIRAP-14-002, finition boule D6, RTX 5070 Ti) :
   descente d'outil sur une grille de 156 000 points 4,4 s → 0,1 s.

   CE QUI PART SUR LA CARTE — les calculs faits en grand nombre et indépendants :
     · 'drop'  : descente d'outil sur une grille XY (faoScDropper : boule, plate, torique
                 = disque + anneau de 24 boules) — grille de la finition à crêtes constantes,
                 grille plate de la passe torique de l'ébauche 3D ;
     · 'torus' : descente torique exacte sur une grille (faoTorusDropper) — passe torique ;
     · 'rest'  : filtre du brut restant (l'outil posé là enlève-t-il de la matière ?), un
                 test par point de passe (faoRestFinish).
   Les calculs faits un par un, chacun dépendant du précédent (suivi des passes), restent
   sur le processeur.

   MÊME RÉSULTAT QUE LE JAVASCRIPT — la carte calcule en flottants 32 bits (7 chiffres) :
     · descente : chaque élément de la pièce (sommet, facette, arête, point) « imprime » sa
       cote sur les nœuds de grille à sa portée (maximum atomique) ; un 2e passage relève
       tous les éléments à moins de FAO_GPU_EPS du maximum (tests élargis de FAO_GPU_DL), et
       le processeur recalcule ces seuls candidats en double précision AVEC LES FORMULES DU
       JAVASCRIPT : la cote rendue est celle que le JavaScript aurait trouvée ;
     · brut restant : la carte rend l'écart à la matière ; les points à moins de 0,01 mm
       du seuil sont refaits par le test JavaScript.
   REPLI AUTOMATIQUE : pas de navigator.gpu (Node, vieux navigateur, Mac avant macOS 26),
   pas de carte, erreur de la carte, adresse avec ?nogpu → calcul JavaScript habituel.

   BRANCHEMENT — les calculs FAO sont des générateurs synchrones ; la carte répond de façon
   asynchrone. Un calcul « demande » la carte par `yield* faoGpuAsk(requête)` : le pilote
   asynchrone (faoOpMovesStream, worker multicœur) attend la carte et renvoie le résultat
   par it.next(résultat) ; un pilote synchrone (faoOpMoves, tests Node) renvoie undefined
   → le calcul prend son chemin JavaScript. */
const FAO_GPU_EPS=0.02;   // mm — candidats retenus sous le maximum de la carte
const FAO_GPU_STEEP=0.05; // élément presque vertical (nz, ou part horizontale d'une arête) : toujours candidat
const FAO_GPU_DL=0.002;   // mm — élargissement des tests (bords de triangle, portée)
const FAO_GPU_BAND=0.01;  // mm — brut restant : bande refaite en JavaScript
let faoGpuOff=false;      // ?nogpu : jamais la carte (comparaison, secours)
try{ faoGpuOff=/[?&]nogpu\b/.test(String(location.search||'')); }catch(e){}
let faoGpuDevP=null,faoGpuBroken=false;
const faoGpuStat={n:0,ms:0,cand:0,carte:'',err:''}; // dernier bilan (diagnostic)
function faoGpuMaybe(){
  if(faoGpuOff||faoGpuBroken)return false;
  try{ return typeof navigator!=='undefined'&&!!navigator&&!!navigator.gpu; }catch(e){ return false; }
}
function* faoGpuAsk(req){
  // Dans un générateur FAO : résultat de la carte, ou null (→ chemin JavaScript)
  if(!faoGpuMaybe())return null;
  const r=yield {faoGpu:req};
  return (r&&r.faoGpuRes)?r.value:null;
}
function faoGpuIsAsk(v){ return !!v&&typeof v==='object'&&!Array.isArray(v)&&!!v.faoGpu; }
async function faoGpuServe(req){
  // Pilote asynchrone : {faoGpuRes:1, value} ou null (la carte n'a pas pu)
  try{
    const t0=performance.now();
    const d=await faoGpuDevice();
    if(!d)return null;
    let v=null;
    if(req.kind==='drop'||req.kind==='torus')v=await faoGpuDropRun(d,req);
    else if(req.kind==='rest')v=await faoGpuRestRun(d,req);
    if(!v)return null;
    faoGpuStat.n++;faoGpuStat.ms+=performance.now()-t0;
    return {faoGpuRes:1,value:v};
  }catch(e){
    faoGpuStat.err=String((e&&e.message)||e);
    try{ console.warn('[carte graphique] repli JavaScript : '+faoGpuStat.err); }catch(x){}
    return null;
  }
}
function faoGpuDevice(){
  if(faoGpuDevP)return faoGpuDevP;
  faoGpuDevP=(async function(){
    if(!faoGpuMaybe())return null;
    const ad=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
    if(!ad){ faoGpuBroken=true; return null; }
    try{ const i=ad.info||null; faoGpuStat.carte=i?((i.vendor||'')+' '+(i.architecture||'')+' '+(i.description||'')).trim():''; }catch(e){}
    const lim=ad.limits||{};
    const d=await ad.requestDevice({requiredLimits:{
      maxStorageBufferBindingSize:Math.min(+lim.maxStorageBufferBindingSize||134217728,1<<30),
      maxBufferSize:Math.min(+lim.maxBufferSize||268435456,1<<30)}});
    d.lost.then(function(){ faoGpuDevP=null; });
    d.__pDrop=d.createComputePipeline({layout:'auto',compute:{module:d.createShaderModule({code:FAO_GPU_WGSL_DROP}),entryPoint:'main'}});
    d.__pRest=d.createComputePipeline({layout:'auto',compute:{module:d.createShaderModule({code:FAO_GPU_WGSL_REST}),entryPoint:'main'}});
    return d;
  })().catch(function(e){ faoGpuBroken=true; faoGpuStat.err=String((e&&e.message)||e); return null; });
  return faoGpuDevP;
}

/* ----- descente d'outil : programme de la carte -----
   Un fil par élément ; il parcourt les nœuds de grille à sa portée. ptype :
   0 sommet-boule, 1 facette-boule, 2 arête-boule, 3 sommet-disque, 4 facette-disque,
   5 arête-disque, 6 point-tore, 7 facette-tore. Phase 0 : maximum atomique de la cote
   (flottant codé en entier ordonné) ; phase 1 : candidats (nœud, élément) à moins de eps. */
const FAO_GPU_WGSL_DROP=`
struct U { nx:u32, ny:u32, cnt:u32, ptype:u32,
           x0:f32, y0:f32, g:f32, rr:f32,
           ox:f32, oy:f32, sub:f32, eps:f32,
           phase:u32, code:u32, cap:u32, wx:u32,
           R0:f32, rL:f32, rc:f32, L:f32,
           dl:f32, steep:f32, pts:u32, q3:f32 };
@group(0) @binding(0) var<uniform> u:U;
@group(0) @binding(1) var<storage,read> P:array<f32>;
@group(0) @binding(2) var<storage,read_write> OUT:array<atomic<u32>>;
@group(0) @binding(3) var<storage,read_write> CNT:array<atomic<u32>>;
@group(0) @binding(4) var<storage,read_write> CAND:array<u32>;
@group(0) @binding(5) var<storage,read_write> CLM:array<atomic<u32>>;
// mode « points quelconques » (u.pts = 1) : points rangés par case (BS = début de chaque
// case, Q = x, y des points dans cet ordre) ; nx, ny, x0, y0, g décrivent alors les cases
@group(0) @binding(6) var<storage,read> BS:array<u32>;
@group(0) @binding(7) var<storage,read> Q:array<f32>;
// tolérance des tests : resserrée en phase 0 (le maximum ne prend que des éléments
// sûrement en contact), élargie en phase 1 (aucun élément en contact n'est oublié)
var<private> tv:f32;
fn enc(f:f32)->u32 { let b=bitcast<u32>(f); return select(b|0x80000000u, ~b, (b&0x80000000u)!=0u); }
fn dec(b:u32)->f32 { return bitcast<f32>(select(~b, b&0x7fffffffu, (b&0x80000000u)!=0u)); }
fn cand(k:u32,id:u32){
  let c=atomicAdd(&CNT[0],1u);
  if(c<u.cap){ CAND[3u*c]=k; CAND[3u*c+1u]=u.code; CAND[3u*c+2u]=id; }
}
fn put(k:u32,z:f32,id:u32){
  if(u.phase==0u){ atomicMax(&OUT[k],enc(z)); return; }
  let m=atomicLoad(&OUT[k]);
  if(m==0u||z>=dec(m)-u.eps){ cand(k,id); }
}
// cote exacte d'un fond plat (sommet sous le disque, point du tore dans sa partie plate,
// facette horizontale) : les égalités parfaites au maximum ne donnent qu'UN candidat par
// nœud (des milliers de points d'un même fond sinon)
fn putFlat(k:u32,z:f32,id:u32){
  if(u.phase==0u){ atomicMax(&OUT[k],enc(z)); return; }
  let m=atomicLoad(&OUT[k]);
  if(m!=0u&&enc(z)==m){ if(atomicExchange(&CLM[k],1u)==0u){ cand(k,id); } return; }
  if(m==0u||z>=dec(m)-u.eps){ cand(k,id); }
}
// élément mal conditionné (paroi presque verticale) : jamais dans le maximum, toujours
// candidat : sa cote exacte est faite en double précision
fn always(k:u32,id:u32){
  if(u.phase==1u){ cand(k,id); }
}
fn rngI(lo:f32,hi:f32)->vec2<i32>{
  if(u.pts==1u){ return vec2<i32>(max(0,i32(floor((lo-u.x0)/u.g))),min(i32(u.nx)-1,i32(floor((hi-u.x0)/u.g)))); }
  return vec2<i32>(max(0,i32(ceil((lo-u.x0)/u.g))),min(i32(u.nx)-1,i32(floor((hi-u.x0)/u.g))));
}
fn rngJ(lo:f32,hi:f32)->vec2<i32>{
  if(u.pts==1u){ return vec2<i32>(max(0,i32(floor((lo-u.y0)/u.g))),min(i32(u.ny)-1,i32(floor((hi-u.y0)/u.g)))); }
  return vec2<i32>(max(0,i32(ceil((lo-u.y0)/u.g))),min(i32(u.ny)-1,i32(floor((hi-u.y0)/u.g))));
}
// point (px,py) dans le triangle de la facette o (élargi de dl)
fn inTri(o:u32, px:f32, py:f32) -> bool {
  let ax=P[o]; let ay=P[o+1u]; let bx=P[o+3u]; let by=P[o+4u]; let cx=P[o+6u]; let cy=P[o+7u];
  let d1=(px-bx)*(ay-by)-(ax-bx)*(py-by);
  let d2=(px-cx)*(by-cy)-(bx-cx)*(py-cy);
  let d3=(px-ax)*(cy-ay)-(cx-ax)*(py-ay);
  if(px<min(ax,min(bx,cx))-tv||px>max(ax,max(bx,cx))+tv||py<min(ay,min(by,cy))-tv||py>max(ay,max(by,cy))+tv){return false;}
  let s=d1+d2+d3;
  if(s==0.0){return tv>0.0;}
  let sg=sign(s);
  return d1*sg>=-tv*P[o+12u] && d2*sg>=-tv*P[o+13u] && d3*sg>=-tv*P[o+14u];
}
fn distTri(o:u32, px:f32, py:f32) -> f32 {
  if(inTri(o,px,py)){return 0.0;}
  var m:f32=1.0e30;
  for(var e=0u;e<3u;e++){
    let e2=(e+1u)%3u;
    let ax=P[o+e*3u]; let ay=P[o+e*3u+1u]; let bx=P[o+e2*3u]; let by=P[o+e2*3u+1u];
    let dx=bx-ax; let dy=by-ay; let l2=dx*dx+dy*dy;
    var t:f32=0.0; if(l2>0.0){t=clamp(((px-ax)*dx+(py-ay)*dy)/l2,0.0,1.0);}
    let qx=ax+dx*t-px; let qy=ay+dy*t-py; m=min(m,qx*qx+qy*qy);
  }
  return sqrt(m);
}
// portée de l'élément (x mini, x maxi, y mini, y maxi des points de requête), marge mg
fn box(t:u32,id:u32,mg:f32)->vec4<f32>{
  let rr=u.rr;
  if(t==0u||t==3u||t==6u){
    let vx=P[id*3u]; let vy=P[id*3u+1u]; let m=rr+mg;
    return vec4<f32>(vx-u.ox-m,vx-u.ox+m,vy-u.oy-m,vy-u.oy+m);
  }
  if(t==1u||t==4u||t==7u){
    let o=id*16u;
    let fx=P[o+9u]; let fy=P[o+10u];
    let bx0=min(P[o],min(P[o+3u],P[o+6u])); let bx1=max(P[o],max(P[o+3u],P[o+6u]));
    let by0=min(P[o+1u],min(P[o+4u],P[o+7u])); let by1=max(P[o+1u],max(P[o+4u],P[o+7u]));
    if(t==1u){ let sx=fx*rr-u.ox; let sy=fy*rr-u.oy; return vec4<f32>(bx0+sx-mg,bx1+sx+mg,by0+sy-mg,by1+sy+mg); }
    if(t==4u){
      let gl=sqrt(fx*fx+fy*fy);
      var sx:f32=0.0; var sy:f32=0.0;
      if(P[o+15u]>0.5){ sx=fx/gl*rr; sy=fy/gl*rr; }
      return vec4<f32>(min(bx0,bx0+sx)-mg,max(bx1,bx1+sx)+mg,min(by0,by0+sy)-mg,max(by1,by1+sy)+mg);
    }
    if(P[o+15u]>0.5){ return vec4<f32>(bx0-u.R0-mg,bx1+u.R0+mg,by0-u.R0-mg,by1+u.R0+mg); }
    let nh=sqrt(fx*fx+fy*fy); let k=u.R0/nh+u.rL;
    let sx=k*fx; let sy=k*fy;
    return vec4<f32>(bx0+sx-mg,bx1+sx+mg,by0+sy-mg,by1+sy+mg);
  }
  let o=id*8u;
  let el=P[o+6u]; let x1=P[o]; let y1=P[o+1u]; let x2=x1+P[o+3u]*el; let y2=y1+P[o+4u]*el;
  let m=rr+mg;
  return vec4<f32>(min(x1,x2)-u.ox-m,max(x1,x2)-u.ox+m,min(y1,y2)-u.oy-m,max(y1,y2)-u.oy+m);
}
// élément id (type t) contre l'outil posé au point de requête k = (x, y)
fn node(t:u32,id:u32,k:u32,x:f32,y:f32){
  let rr=u.rr; let r2=rr*rr; let dl=u.dl; let st=u.steep;
  if(t==0u||t==3u||t==6u){ // sommets / points
    let vx=P[id*3u]; let vy=P[id*3u+1u]; let vz=P[id*3u+2u];
    let dx=x+u.ox-vx; let dy=y+u.oy-vy; let d2=dx*dx+dy*dy;
    if(d2>r2+2.0*rr*tv){return;}
    if(t==0u){ put(k,vz+sqrt(max(0.0,r2-d2))-u.sub,id); }
    else if(t==3u){ putFlat(k,vz,id); }
    else { let d=sqrt(d2);
      if(d<=u.R0-dl){ putFlat(k,vz+u.L,id); }
      else if(d<=u.R0){ put(k,vz+u.L,id); }
      else { let w=d-u.R0; put(k,vz+sqrt(max(0.0,u.rL*u.rL-w*w))-u.rc,id); } }
    return;
  }
  if(t==1u||t==4u||t==7u){ // facettes (16 flottants)
    let o=id*16u;
    let fx=P[o+9u]; let fy=P[o+10u]; let fz=P[o+11u];
    let raide=fz<st;
    if(t==1u){
      let cx=x+u.ox-fx*rr; let cy=y+u.oy-fy*rr;
      if(!inTri(o,cx,cy)){return;}
      if(raide){ always(k,id); return; }
      let zc=P[o+2u]-(fx*(cx-P[o])+fy*(cy-P[o+1u]))/fz;
      put(k,zc+fz*rr-u.sub,id);
      return;
    }
    if(t==4u){
      let gl=sqrt(fx*fx+fy*fy);
      var sx:f32=0.0; var sy:f32=0.0;
      if(P[o+15u]>0.5){ sx=fx/gl*rr; sy=fy/gl*rr; }
      for(var w=0u;w<2u;w++){
        let qx=select(x,x-sx,w==1u); let qy=select(y,y-sy,w==1u);
        if(inTri(o,qx,qy)){
          if(raide){ always(k,id); return; }
          if(P[o+15u]<0.5){ putFlat(k,P[o+2u],id); return; }
          put(k,P[o+2u]-(fx*(qx-P[o])+fy*(qy-P[o+1u]))/fz,id);
        }
      }
      return;
    }
    if(P[o+15u]>0.5){ // horizontale : sous le disque plat de rayon R0
      if(distTri(o,x,y)<=u.R0+tv){ putFlat(k,P[o+2u]+u.L,id); }
      return;
    }
    let nh=sqrt(fx*fx+fy*fy); let kk=u.R0/nh+u.rL;
    let px=x-kk*fx; let py=y-kk*fy;
    if(!inTri(o,px,py)){return;}
    if(raide){ always(k,id); return; }
    let pz=P[o+2u]-(fx*(px-P[o])+fy*(py-P[o+1u]))/fz;
    put(k,pz-u.rc+u.rL*fz,id);
    return;
  }
  // arêtes (8 flottants : x y z ux uy uz long drapeaux)
  let o=id*8u;
  let ux=P[o+3u]; let uy=P[o+4u]; let uz=P[o+5u]; let el=P[o+6u]; let fl=u32(P[o+7u]);
  let x1=P[o]; let y1=P[o+1u];
  let hl=sqrt(ux*ux+uy*uy); // part horizontale de la direction
  if(t==2u){
    if((fl&1u)==0u){return;}
    let wx=ux/hl; let wy=uy/hl;
    let ax=x+u.ox-x1; let ay=y+u.oy-y1;
    // plan vertical de l arête : écart au plan, abscisse, cercle de la boule dans le plan
    let dp=ax*wy-ay*wx; let s2=r2-dp*dp;
    if(s2<-2.0*rr*max(tv,0.0)&&s2<0.0){return;}
    if(tv<0.0&&s2<2.0*rr*dl){return;}
    let s=sqrt(max(s2,0.0)); let pc=ax*wx+ay*wy;
    if(hl<st){ // presque verticale
      if(pc>=-s-dl&&pc<=hl*el+s+dl){ always(k,id); }
      return;
    }
    let t3=(pc+s*uz)/hl;
    if(t3<-tv||t3>el+tv){return;}
    put(k,P[o+2u]+uz*t3+s*hl-u.sub,id);
    return;
  }
  if((fl&2u)==0u){return;}
  let ex=ux*el; let ey=uy*el; let ez=uz*el; let a=ex*ex+ey*ey;
  let tl=tv/el;
  let fx=x1-x; let fy=y1-y;
  let b=2.0*(fx*ex+fy*ey); let c=fx*fx+fy*fy-r2;
  let disc=b*b-4.0*a*c;
  if(disc<-8.0*a*rr*tv){return;}
  let sq=sqrt(max(disc,0.0));
  let t1=(-b-sq)/(2.0*a); let t2=(-b+sq)/(2.0*a);
  let ok1=t1>=-tl&&t1<=1.0+tl; let ok2=t2>=-tl&&t2<=1.0+tl;
  if(hl<st){ // presque verticale : candidate si le cercle du disque peut croiser l'arête vue de dessus
    let l2=ex*ex+ey*ey; var tq:f32=0.0; if(l2>0.0){tq=clamp(-(fx*ex+fy*ey)/l2,0.0,1.0);}
    let qx=fx+ex*tq; let qy=fy+ey*tq;
    if(qx*qx+qy*qy<=(rr+dl)*(rr+dl)){ always(k,id); }
    return; }
  if(ok1){ put(k,P[o+2u]+ez*clamp(t1,0.0,1.0),id); }
  if(ok2){ put(k,P[o+2u]+ez*clamp(t2,0.0,1.0),id); }
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let id=gid.x+gid.y*u.wx*64u;
  if(id>=u.cnt){return;}
  tv=select(u.dl,-u.dl,u.phase==0u);
  let t=u.ptype;
  if(t==2u&&(u32(P[id*8u+7u])&1u)==0u){return;}
  if(t==5u&&(u32(P[id*8u+7u])&2u)==0u){return;}
  let g=u.g;
  if(u.pts==0u){
    let b=box(t,id,u.dl+g);
    let I=rngI(b.x,b.y); let J=rngJ(b.z,b.w);
    for(var j=J.x;j<=J.y;j++){ for(var i=I.x;i<=I.y;i++){
      node(t,id,u32(j)*u.nx+u32(i),u.x0+f32(i)*g,u.y0+f32(j)*g);
    } }
    return;
  }
  let b=box(t,id,4.0*u.dl+0.001);
  let I=rngI(b.x,b.y); let J=rngJ(b.z,b.w);
  for(var j=J.x;j<=J.y;j++){ for(var i=I.x;i<=I.y;i++){
    let c=u32(j)*u.nx+u32(i);
    for(var q=BS[c];q<BS[c+1u];q++){ node(t,id,q,Q[2u*q],Q[2u*q+1u]); }
  } }
}`;

/* ----- préparation : éléments de la pièce, en double (recalcul) et en simple (carte) -----
   Même choix d'éléments que faoScDropper / faoTorusDropper (mêmes filtres, mêmes calculs),
   pour que le recalcul en double précision donne les mêmes bits que le JavaScript. */
let faoGpuPrepMemo=null; // WeakMap maillage -> {ball, torus}
function faoGpuPrepBall(mesh){
  if(!faoGpuPrepMemo)faoGpuPrepMemo=new WeakMap();
  let M=faoGpuPrepMemo.get(mesh);if(!M){M={};faoGpuPrepMemo.set(mesh,M);}
  if(M.ball)return M.ball;
  const Vm=mesh.v;
  const usedV=new Uint8Array(Vm.length),E=[],F=[],eseen=new Set();
  for(let i=0;i<mesh.t.length;i++){
    const t=mesh.t[i],A=Vm[t[0]],B=Vm[t[1]],C=Vm[t[2]];
    const ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2],wx=C[0]-A[0],wy=C[1]-A[1],wz=C[2]-A[2];
    let fx=uy*wz-uz*wy,fy=uz*wx-ux*wz,fz=ux*wy-uy*wx;
    const l=Math.sqrt(fx*fx+fy*fy+fz*fz);
    if(!(l>1e-12))continue;
    fx/=l;fy/=l;fz/=l;
    if(fz<0){fx=-fx;fy=-fy;fz=-fz;}
    usedV[t[0]]=1;usedV[t[1]]=1;usedV[t[2]]=1;
    if(fz>1e-9)F.push(A[0],A[1],A[2],B[0],B[1],B[2],C[0],C[1],C[2],fx,fy,fz,Math.max(A[2],B[2],C[2]));
    for(let e=0;e<3;e++){
      const p=t[e],q=t[(e+1)%3],k=p<q?p*4194304+q:q*4194304+p;
      if(eseen.has(k))continue;eseen.add(k);
      const P=Vm[p],Q=Vm[q];
      const ex=Q[0]-P[0],ey=Q[1]-P[1],ez=Q[2]-P[2],el=Math.sqrt(ex*ex+ey*ey+ez*ez);
      if(!(el>1e-12))continue;
      E.push(P[0],P[1],P[2],ex/el,ey/el,ez/el,el,Math.max(P[2],Q[2]));
    }
  }
  const vIds=[];for(let i=0;i<Vm.length;i++)if(usedV[i])vIds.push(i);
  const VX=new Float64Array(vIds.length*3);
  vIds.forEach(function(i,n){VX[n*3]=Vm[i][0];VX[n*3+1]=Vm[i][1];VX[n*3+2]=Vm[i][2];});
  M.ball={V:VX,F:Float64Array.from(F),E:Float64Array.from(E),nV:vIds.length,nF:F.length/13,nE:E.length/8,mesh:mesh};
  faoGpuLocal(M.ball);
  return M.ball;
}
function faoGpuPrepTorus(mesh){
  if(!faoGpuPrepMemo)faoGpuPrepMemo=new WeakMap();
  let M=faoGpuPrepMemo.get(mesh);if(!M){M={};faoGpuPrepMemo.set(mesh,M);}
  if(M.torus)return M.torus;
  // copie fidèle de la préparation de faoTorusDropper (points : sommets + arêtes / 0,2 mm)
  const V=mesh.v,T=mesh.t;
  const PX=[],PY=[],PZ=[];
  const seen=new Set();
  for(let i=0;i<V.length;i++){PX.push(V[i][0]);PY.push(V[i][1]);PZ.push(V[i][2]);}
  const FA=[];
  for(let i=0;i<T.length;i++){
    const t=T[i],A=V[t[0]],B=V[t[1]],C=V[t[2]];
    for(let e=0;e<3;e++){const p=t[e],q=t[(e+1)%3],k=p<q?p*4194304+q:q*4194304+p;
      if(seen.has(k))continue;seen.add(k);
      const P=V[p],Q=V[q],l=Math.hypot(Q[0]-P[0],Q[1]-P[1],Q[2]-P[2]),n=Math.ceil(l/0.2);
      for(let s=1;s<n;s++){const u=s/n;PX.push(P[0]+(Q[0]-P[0])*u);PY.push(P[1]+(Q[1]-P[1])*u);PZ.push(P[2]+(Q[2]-P[2])*u);}}
    const ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2],wx=C[0]-A[0],wy=C[1]-A[1],wz=C[2]-A[2];
    let fx=uy*wz-uz*wy,fy=uz*wx-ux*wz,fz=ux*wy-uy*wx;const fl=Math.hypot(fx,fy,fz);
    if(!(fl>1e-12))continue;fx/=fl;fy/=fl;fz/=fl;if(fz<0){fx=-fx;fy=-fy;fz=-fz;}
    if(fz<1e-6)continue;
    FA.push(A[0],A[1],A[2],B[0],B[1],B[2],C[0],C[1],C[2],fx,fy,fz,Math.max(A[2],B[2],C[2]));
  }
  const n=PX.length,PT=new Float64Array(n*3);
  for(let i=0;i<n;i++){PT[i*3]=PX[i];PT[i*3+1]=PY[i];PT[i*3+2]=PZ[i];}
  M.torus={V:PT,F:Float64Array.from(FA),E:new Float64Array(0),nV:n,nF:FA.length/13,nE:0,mesh:mesh,torus:true};
  faoGpuLocal(M.torus);
  return M.torus;
}
function faoGpuLocal(S){
  // Copies en simple précision, coordonnées LOCALES (origine au centre de la pièce) :
  // sommets 3, facettes 16 (+ longueurs des côtés, drapeau), arêtes 8 (+ drapeaux)
  let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0,z0=1/0;
  for(let i=0;i<S.nV;i++){const x=S.V[i*3],y=S.V[i*3+1],z=S.V[i*3+2];
    if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(z<z0)z0=z;}
  if(!(x0<=x1)){x0=x1=y0=y1=z0=0;}
  const cx=(x0+x1)/2,cy=(y0+y1)/2,cz=z0;
  S.cx=cx;S.cy=cy;S.cz=cz;
  const V=new Float32Array(Math.max(3,S.nV*3));
  for(let i=0;i<S.nV;i++){V[i*3]=S.V[i*3]-cx;V[i*3+1]=S.V[i*3+1]-cy;V[i*3+2]=S.V[i*3+2]-cz;}
  const F=new Float32Array(Math.max(16,S.nF*16));
  for(let n=0;n<S.nF;n++){const o=n*13,q=n*16,A=S.F;
    for(let c=0;c<3;c++){F[q+c*3]=A[o+c*3]-cx;F[q+c*3+1]=A[o+c*3+1]-cy;F[q+c*3+2]=A[o+c*3+2]-cz;}
    F[q+9]=A[o+9];F[q+10]=A[o+10];F[q+11]=A[o+11];
    F[q+12]=Math.hypot(A[o+3]-A[o],A[o+4]-A[o+1]);F[q+13]=Math.hypot(A[o+6]-A[o+3],A[o+7]-A[o+4]);F[q+14]=Math.hypot(A[o]-A[o+6],A[o+1]-A[o+7]);
    // drapeau : disque (gl > 1e-12) ou tore (horizontale : nh < 1e-6)
    const gl=Math.sqrt(A[o+9]*A[o+9]+A[o+10]*A[o+10]),nh=Math.hypot(A[o+9],A[o+10]);
    F[q+15]=S.torus?(nh<1e-6?1:0):(gl>1e-12?1:0);}
  const E=new Float32Array(Math.max(8,S.nE*8));
  for(let n=0;n<S.nE;n++){const o=n*8,A=S.E;
    E[o]=A[o]-cx;E[o+1]=A[o+1]-cy;E[o+2]=A[o+2]-cz;E[o+3]=A[o+3];E[o+4]=A[o+4];E[o+5]=A[o+5];E[o+6]=A[o+6];
    const bb=A[o+4]*A[o+4]+A[o+3]*A[o+3],ex=A[o+3]*A[o+6],ey=A[o+4]*A[o+6];
    E[o+7]=(bb<1e-12?0:1)+((ex*ex+ey*ey)<1e-12?0:2);}
  S.V32=V;S.F32=F;S.E32=E;
}

/* ----- recalcul exact d'un candidat (formules de faoScDropper / faoTorusDropper) ----- */
function faoGpuBallC(S,ty,id,x,y,rr){
  // cote du CENTRE de la boule de rayon rr en (x,y) contre l'élément (−∞ si pas de contact)
  const r2=rr*rr;
  if(ty===0){const i=id*3,VX=S.V;
    const dx=x-VX[i],dy=y-VX[i+1],d2=dx*dx+dy*dy;
    return d2<=r2?VX[i+2]+Math.sqrt(r2-d2):-1/0;}
  if(ty===1){const o=id*13,FA=S.F;
    const nxx=FA[o+9],nyy=FA[o+10],nzz=FA[o+11];
    const cx=x-nxx*rr,cy=y-nyy*rr;
    if(!faoGpuInTri(FA,o,cx,cy))return -1/0;
    const zc=FA[o+2]-(nxx*(cx-FA[o])+nyy*(cy-FA[o+1]))/nzz;
    return zc+nzz*rr;}
  const o=id*8,EA=S.E;
  const ux=EA[o+3],uy=EA[o+4],uz=EA[o+5];
  const bb=uy*uy+ux*ux;
  if(bb<1e-12)return -1/0;
  const ax=x-EA[o],ay=y-EA[o+1],az=-EA[o+2];
  const Ax=ay*uz-az*uy,Ay=az*ux-ax*uz,Az=ax*uy-ay*ux;
  const ab=-Ax*uy+Ay*ux;
  const aa=Ax*Ax+Ay*Ay+Az*Az;
  const disc=ab*ab-bb*(aa-r2);
  if(disc<0)return -1/0;
  const hz=(-ab+Math.sqrt(disc))/bb;
  const t=ax*ux+ay*uy+(hz+az)*uz;
  return (t>=0&&t<=EA[o+6])?hz:-1/0;
}
function faoGpuDiscZ(S,ty,id,x,y,rd){
  // cote max de l'élément sous le disque plat de rayon rd posé en (x,y)
  const r2=rd*rd;
  if(ty===3){const i=id*3,VX=S.V;const dx=x-VX[i],dy=y-VX[i+1];return dx*dx+dy*dy<=r2?VX[i+2]:-1/0;}
  if(ty===5){const o=id*8,EA=S.E;let h=-1/0;
    const px=EA[o],py=EA[o+1],pz=EA[o+2],el=EA[o+6];
    const ex=EA[o+3]*el,ey=EA[o+4]*el,ez=EA[o+5]*el;
    const a=ex*ex+ey*ey;if(a<1e-12)return h;
    const fx=px-x,fy=py-y;
    const b=2*(fx*ex+fy*ey),c=fx*fx+fy*fy-r2;
    const disc=b*b-4*a*c;if(disc<0)return h;
    const sq=Math.sqrt(disc);
    const t1=(-b-sq)/(2*a),t2=(-b+sq)/(2*a);
    if(t1>=0&&t1<=1){const z=pz+ez*t1;if(z>h)h=z;}
    if(t2>=0&&t2<=1){const z=pz+ez*t2;if(z>h)h=z;}
    return h;}
  const o=id*13,FA=S.F;let h=-1/0;
  const nxx=FA[o+9],nyy=FA[o+10],nzz=FA[o+11];
  const gl=Math.sqrt(nxx*nxx+nyy*nyy);
  const px=gl>1e-12?x-nxx/gl*rd:x,py=gl>1e-12?y-nyy/gl*rd:y;
  for(let w=0;w<2;w++){
    const qx=w?px:x,qy=w?py:y;
    if(faoGpuInTri(FA,o,qx,qy)){const z=FA[o+2]-(nxx*(qx-FA[o])+nyy*(qy-FA[o+1]))/nzz;if(z>h)h=z;}
  }
  return h;
}
function faoGpuTorusZ(S,ty,id,x,y,P){
  // pointe du tore (faoTorusDropper.tip) contre un point (6) ou une facette (7)
  const R0=P.R0,rL=P.rL,rc=P.rc,L=P.L,reach=R0+rL+1e-6,r2=reach*reach;
  if(ty===6){const i=id*3,PT=S.V,pz=PT[i+2];
    const dx=PT[i]-x,dy=PT[i+1]-y,d2=dx*dx+dy*dy;if(d2>r2)return -1/0;
    const d=Math.sqrt(d2);
    if(d<=R0)return pz+L;
    const u=d-R0;return pz+Math.sqrt(Math.max(0,rL*rL-u*u))-rc;}
  const o=id*13,FA=S.F;
  const fx=FA[o+9],fy=FA[o+10],fz=FA[o+11],nh=Math.hypot(fx,fy);
  if(nh<1e-6)return faoGpuDistTri(FA,o,x,y)<=R0+1e-9?FA[o+2]+L:-1/0;
  const k=R0/nh+rL,px=x-k*fx,py=y-k*fy;
  if(!faoGpuInTri(FA,o,px,py))return -1/0;
  const pz=FA[o+2]-(fx*(px-FA[o])+fy*(py-FA[o+1]))/fz;
  return pz-rc+rL*fz;
}
function faoGpuInTri(FA,o,px,py){
  const ax=FA[o],ay=FA[o+1],bx=FA[o+3],by=FA[o+4],cx=FA[o+6],cy=FA[o+7];
  const d1=(px-bx)*(ay-by)-(ax-bx)*(py-by);
  const d2=(px-cx)*(by-cy)-(bx-cx)*(py-cy);
  const d3=(px-ax)*(cy-ay)-(cx-ax)*(py-ay);
  const neg=(d1<0)||(d2<0)||(d3<0),pos=(d1>0)||(d2>0)||(d3>0);
  return !(neg&&pos);
}
function faoGpuDistTri(FA,o,px,py){
  if(faoGpuInTri(FA,o,px,py))return 0;
  let m=1/0;for(let e=0;e<3;e++){const ax=FA[o+e*3],ay=FA[o+e*3+1],bx=FA[o+((e+1)%3)*3],by=FA[o+((e+1)%3)*3+1];
    const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;let t=l2>0?((px-ax)*dx+(py-ay)*dy)/l2:0;t=t<0?0:t>1?1:t;
    const qx=ax+dx*t-px,qy=ay+dy*t-py,d=qx*qx+qy*qy;if(d<m)m=d;}
  return Math.sqrt(m);
}

/* ----- requêtes de descente -----
   req = {kind:'drop', mesh, tool:'ball'|'flat'|'bull', D, r (rayon de coin), L (laisse),
          x0, y0, g, nx, ny}   → Float64Array nx·ny : cote de la POINTE = faoScDropper(...).tip
   req = {kind:'torus', mesh, D, rc, L, x0, y0, g, nx, ny} → idem faoTorusDropper(...).tip
   Nœud (i,j) en x0 + i·g, y0 + j·g (exactement l'expression des appelants). */
function faoGpuDropPasses(req){
  // Liste des passages : {ty, rr, ox, oy, sub, s} ; et la fonction de recalcul exact
  const Rt=req.D/2,L=isFinite(+req.L)&&+req.L>0?+req.L:0;
  const T=[];
  if(req.kind==='torus'){
    const rc=+req.rc,R0=Math.max(0,Rt-rc),rL=rc+L;
    const P={R0:R0,rL:rL,rc:rc,L:L};
    T.push({ty:6,rr:R0+rL+1e-6,ox:0,oy:0,sub:0,s:0,tor:P},{ty:7,rr:0,ox:0,oy:0,sub:0,s:0,tor:P});
    return {T:T,exact:function(S,ty,s,id,x,y){return faoGpuTorusZ(S,ty,id,x,y,P);}};
  }
  const kind=req.tool;
  const r=kind==='flat'?0:(kind==='bull'?Math.min(Rt,isFinite(+req.r)?+req.r:Rt):Rt);
  if(kind==='flat'){
    [3,4,5].forEach(function(ty){T.push({ty:ty,rr:Rt+L,ox:0,oy:0,sub:0,s:0});});
    return {T:T,exact:function(S,ty,s,id,x,y){return faoGpuDiscZ(S,ty,id,x,y,Rt+L);}};
  }
  if(kind==='bull'&&r<Rt-1e-9){
    const NS=(req.ns>24)?Math.round(req.ns):24,rc=Rt-r;
    [3,4,5].forEach(function(ty){T.push({ty:ty,rr:Rt-r,ox:0,oy:0,sub:0,s:0});});
    for(let s=0;s<NS;s++){
      const an=2*Math.PI*s/NS;
      [0,1,2].forEach(function(ty){T.push({ty:ty,rr:r+L,ox:rc*Math.cos(an),oy:rc*Math.sin(an),sub:r,s:s+1});});
    }
    return {T:T,exact:function(S,ty,s,id,x,y){
      if(ty>=3)return faoGpuDiscZ(S,ty,id,x,y,Rt-r);
      const an=2*Math.PI*(s-1)/NS,px=x+rc*Math.cos(an),py=y+rc*Math.sin(an);
      const c=faoGpuBallC(S,ty,id,px,py,r+L);return c-r;}};
  }
  [0,1,2].forEach(function(ty){T.push({ty:ty,rr:Rt+L,ox:0,oy:0,sub:Rt,s:0});});
  return {T:T,exact:function(S,ty,s,id,x,y){const c=faoGpuBallC(S,ty,id,x,y,Rt+L);return c===-1/0?-1/0:c-Rt;}};
}
async function faoGpuDropRun(d,req){
  // req.pts (x, y, x, y… en double) : points quelconques au lieu d'une grille
  const pm=!!req.pts;
  const n=pm?(req.pts.length>>1):req.nx*req.ny;
  if(pm&&!n)return new Float64Array(0);
  if(!(n>0)||!req.mesh||!req.mesh.v||!req.mesh.v.length)return null;
  const S=req.kind==='torus'?faoGpuPrepTorus(req.mesh):faoGpuPrepBall(req.mesh);
  const PS=faoGpuDropPasses(req);
  if(n>=(1<<30))return null;
  // points : rangés par cases carrées (tri par comptage) ; ord[case-ordre] = rang d'origine
  let ord=null,bBS=null,bQ=null,bnx=1,bny=1,bx0=0,by0=0,bg=1;
  if(pm){
    const X=req.pts;let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;
    for(let k=0;k<n;k++){const x=X[2*k],y=X[2*k+1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    if(!(x0<=x1&&y0<=y1))return null;
    bg=Math.max(0.5,Math.sqrt((x1-x0+1)*(y1-y0+1)/(1<<21)));
    bx0=x0-S.cx-bg;by0=y0-S.cy-bg;
    bnx=Math.ceil((x1-x0)/bg)+3;bny=Math.ceil((y1-y0)/bg)+3;
    const nb=bnx*bny,cnt=new Uint32Array(nb+1),cell=new Uint32Array(n);
    for(let k=0;k<n;k++){const i=Math.floor((X[2*k]-S.cx-bx0)/bg),j=Math.floor((X[2*k+1]-S.cy-by0)/bg);
      const c=Math.min(bny-1,Math.max(0,j))*bnx+Math.min(bnx-1,Math.max(0,i));cell[k]=c;cnt[c+1]++;}
    for(let c=0;c<nb;c++)cnt[c+1]+=cnt[c];
    const BS=Uint32Array.from(cnt),pos=cnt.slice(0,nb);
    ord=new Uint32Array(n);const QL=new Float32Array(2*n);
    for(let k=0;k<n;k++){const q=pos[cell[k]]++;ord[q]=k;QL[2*q]=X[2*k]-S.cx;QL[2*q+1]=X[2*k+1]-S.cy;}
    bBS=BS;bQ=QL;
  }
  const U=GPUBufferUsage;
  const mk=function(arr){const b=d.createBuffer({size:Math.max(16,(arr.byteLength+3)&~3),usage:U.STORAGE|U.COPY_DST});d.queue.writeBuffer(b,0,arr);return b;};
  const bufs=[];
  // éléments de la pièce : envoyés une fois par maillage (gardés sur la carte)
  if(!S.gb||S.gb.d!==d)S.gb={d:d,V:mk(S.V32),F:mk(S.F32),E:mk(S.E32)};
  const bV=S.gb.V,bF=S.gb.F,bE=S.gb.E;
  const bBin=mk(pm?bBS:new Uint32Array(4)),bPts=mk(pm?bQ:new Float32Array(4));bufs.push(bBin,bPts);
  const bOut=d.createBuffer({size:n*4,usage:U.STORAGE|U.COPY_SRC});bufs.push(bOut);
  const bCnt=d.createBuffer({size:16,usage:U.STORAGE|U.COPY_DST|U.COPY_SRC});bufs.push(bCnt);
  let bClm=d.createBuffer({size:n*4,usage:U.STORAGE});
  let cap=Math.max(1<<16,Math.min(6*n,(1<<24)));
  let bCand=d.createBuffer({size:cap*12,usage:U.STORAGE|U.COPY_SRC});
  const x0=pm?bx0:req.x0-S.cx,y0=pm?by0:req.y0-S.cy;
  const GX=pm?bnx:req.nx,GY=pm?bny:req.ny,GG=pm?bg:req.g;
  const dispatch=function(phase){
    const enc=d.createCommandEncoder();
    PS.T.forEach(function(p){
      const cnt=(p.ty===0||p.ty===3||p.ty===6)?S.nV:((p.ty===1||p.ty===4||p.ty===7)?S.nF:S.nE);
      if(!cnt)return;
      const wg=Math.ceil(cnt/64),wx=Math.min(wg,65535),wy=Math.ceil(wg/wx);
      const ub=new ArrayBuffer(96),uu=new Uint32Array(ub),uf=new Float32Array(ub);
      uu[0]=GX;uu[1]=GY;uu[2]=cnt;uu[3]=p.ty;
      uf[4]=x0;uf[5]=y0;uf[6]=GG;uf[7]=p.rr;
      uf[8]=p.ox;uf[9]=p.oy;uf[10]=p.sub;uf[11]=FAO_GPU_EPS;
      uu[12]=phase;uu[13]=p.ty*32+p.s;uu[14]=cap;uu[15]=wx;
      const tp=p.tor||{R0:0,rL:0,rc:0,L:0};
      uf[16]=tp.R0;uf[17]=tp.rL;uf[18]=tp.rc;uf[19]=tp.L;uf[20]=FAO_GPU_DL;uf[21]=FAO_GPU_STEEP;uu[22]=pm?1:0;
      const bU=d.createBuffer({size:96,usage:U.UNIFORM|U.COPY_DST});d.queue.writeBuffer(bU,0,ub);bufs.push(bU);
      const P=(p.ty===0||p.ty===3||p.ty===6)?bV:((p.ty===1||p.ty===4||p.ty===7)?bF:bE);
      const bg=d.createBindGroup({layout:d.__pDrop.getBindGroupLayout(0),entries:[
        {binding:0,resource:{buffer:bU}},{binding:1,resource:{buffer:P}},{binding:2,resource:{buffer:bOut}},
        {binding:3,resource:{buffer:bCnt}},{binding:4,resource:{buffer:bCand}},{binding:5,resource:{buffer:bClm}},
        {binding:6,resource:{buffer:bBin}},{binding:7,resource:{buffer:bPts}}]});
      const ps=enc.beginComputePass();ps.setPipeline(d.__pDrop);ps.setBindGroup(0,bg);ps.dispatchWorkgroups(wx,wy);ps.end();
    });
    return enc;
  };
  const readU32=async function(src,bytes){
    const rb=d.createBuffer({size:bytes,usage:U.MAP_READ|U.COPY_DST});
    const e=d.createCommandEncoder();e.copyBufferToBuffer(src,0,rb,0,bytes);d.queue.submit([e.finish()]);
    await rb.mapAsync(GPUMapMode.READ);const a=new Uint32Array(rb.getMappedRange().slice(0));rb.unmap();rb.destroy();return a;
  };
  try{
    d.queue.writeBuffer(bCnt,0,new Uint32Array(4));
    d.queue.submit([dispatch(0).finish()]);   // phase 0 : maximum (bOut est à zéro à la création)
    d.queue.submit([dispatch(1).finish()]);   // phase 1 : candidats
    let nc=(await readU32(bCnt,16))[0];
    if(nc>cap){ // trop de candidats : place agrandie, phase 1 refaite
      if(nc>(1<<26))return null;
      bCand.destroy();cap=nc;bCand=d.createBuffer({size:cap*12,usage:U.STORAGE|U.COPY_SRC});
      d.queue.writeBuffer(bCnt,0,new Uint32Array(4));
      bClm.destroy();bClm=d.createBuffer({size:n*4,usage:U.STORAGE});
      d.queue.submit([dispatch(1).finish()]);
      nc=(await readU32(bCnt,16))[0];
      if(nc>cap)return null;
    }
    const C=nc?await readU32(bCand,nc*12):new Uint32Array(0);
    const tPol=performance.now();
    // recalcul exact des candidats, maximum par nœud
    const out=new Float64Array(n).fill(-1/0);
    if(pm){
      const X=req.pts;
      for(let q=0;q<nc;q++){
        const k=ord[C[3*q]],code=C[3*q+1],ty=code>>5,s=code&31,id=C[3*q+2];
        const z=PS.exact(S,ty,s,id,X[2*k],X[2*k+1]);
        if(z>out[k])out[k]=z;
      }
    }else{
    const nx=req.nx,X0=req.x0,Y0=req.y0,g=req.g;
    for(let q=0;q<nc;q++){
      const k=C[3*q],code=C[3*q+1],ty=code>>5,s=code&31,id=C[3*q+2];
      const i=k%nx,j=(k-i)/nx;
      const z=PS.exact(S,ty,s,id,X0+i*g,Y0+j*g);
      if(z>out[k])out[k]=z;
    }
    }
    faoGpuStat.cand=nc;faoGpuStat.candT=(faoGpuStat.candT||0)+nc;faoGpuStat.polMs=(faoGpuStat.polMs||0)+performance.now()-tPol;
    if(req.dbg){ // mise au point : maximum de la carte et candidats de quelques nœuds
      const O=await readU32(bOut,n*4),u1=new Uint32Array(1),f1=new Float32Array(u1.buffer);
      out.dbg={};req.dbg.forEach(function(k){const b=O[k];u1[0]=(b&0x80000000)?(b&0x7fffffff):~b;
        const L=[];for(let q=0;q<nc;q++)if(C[3*q]===k)L.push([C[3*q+1]>>5,C[3*q+1]&31,C[3*q+2]]);
        out.dbg[k]={m:b?f1[0]+S.cz:null,c:L};});
    }
    return out;
  }finally{
    bufs.forEach(function(b){try{b.destroy();}catch(e){}});
    try{bCand.destroy();}catch(e){}
    try{bClm.destroy();}catch(e){}
  }
}

/* ----- brut restant : l'outil posé en (x,y,z) enlève-t-il plus de ign ? -----
   req = {kind:'rest', grid:{h,nx,ny,x0,y0,p}, pts:Float64Array (x,y,z…), R, tool:{kind,cornerR}, ign}
   La carte rend, par point, le plus grand dépassement h − (z + env(d) + ign) sous le disque ;
   Uint8Array rendue : 1 / 0 nets, 2 = trop près du seuil (refait en JavaScript). */
const FAO_GPU_WGSL_REST=`
struct U { nx:u32, ny:u32, n:u32, wx:u32,
           x0:f32, y0:f32, p:f32, R:f32,
           ign:f32, r0:f32, rc:f32, flat:f32 };
@group(0) @binding(0) var<uniform> u:U;
@group(0) @binding(1) var<storage,read> H:array<f32>;
@group(0) @binding(2) var<storage,read> S:array<f32>;
@group(0) @binding(3) var<storage,read_write> O:array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let id=gid.x+gid.y*u.wx*64u;
  if(id>=u.n){return;}
  let x=S[id*3u]; let y=S[id*3u+1u]; let z=S[id*3u+2u];
  let R=u.R; let p=u.p;
  let i0=max(0,i32(floor((x-R-u.x0)/p))-1); let i1=min(i32(u.nx)-1,i32(floor((x+R-u.x0)/p))+1);
  let j0=max(0,i32(floor((y-R-u.y0)/p))-1); let j1=min(i32(u.ny)-1,i32(floor((y+R-u.y0)/p))+1);
  var best:f32=-1.0e30; var unsure=false;
  for(var j=j0;j<=j1;j++){ let cy=u.y0+(f32(j)+0.5)*p-y;
    for(var i=i0;i<=i1;i++){ let cx=u.x0+(f32(i)+0.5)*p-x;
      let d=sqrt(cx*cx+cy*cy);
      if(d>R+0.002){continue;}
      let h=H[u32(j)*u.nx+u32(i)];
      if(h<-1.0e29){continue;}
      var env:f32=0.0;
      if(u.flat<0.5&&d>u.r0){ let w=min(u.rc,d-u.r0); env=u.rc-sqrt(max(0.0,u.rc*u.rc-w*w)); }
      let e=h-(z+env+u.ign);
      // maille au bord du disque : dedans ou dehors selon l'arrondi → décision au JavaScript
      if(d>R-0.002){ if(e>-0.02){unsure=true;} continue; }
      best=max(best,e);
    } }
  if(unsure&&best<=0.02){ best=0.0; }
  O[id]=best;
}`;
async function faoGpuRestRun(d,req){
  const G=req.grid,n=(req.pts.length/3)|0;
  if(!n)return new Uint8Array(0);
  const U=GPUBufferUsage;
  // carte et points en coordonnées locales (origine au coin de la carte)
  const H=new Float32Array(G.nx*G.ny);
  for(let k=0;k<H.length;k++){const v=G.h[k];H[k]=(v>-1/0)?v:-1e30;}
  const P=new Float32Array(n*3);
  for(let k=0;k<n;k++){P[k*3]=req.pts[k*3]-G.x0;P[k*3+1]=req.pts[k*3+1]-G.y0;P[k*3+2]=req.pts[k*3+2];}
  const tool=req.tool||{},R=req.R;
  const flat=tool.kind==='flat';
  const rc=tool.kind==='bull'?Math.max(0,Math.min(R,isFinite(+tool.cornerR)?+tool.cornerR:R)):R;
  const bufs=[];
  const mk=function(arr,us){const b=d.createBuffer({size:Math.max(16,(arr.byteLength+3)&~3),usage:us|U.COPY_DST});d.queue.writeBuffer(b,0,arr);bufs.push(b);return b;};
  try{
    const wg=Math.ceil(n/64),wx=Math.min(wg,65535),wy=Math.ceil(wg/wx);
    const ub=new ArrayBuffer(48),uu=new Uint32Array(ub),uf=new Float32Array(ub);
    uu[0]=G.nx;uu[1]=G.ny;uu[2]=n;uu[3]=wx;uf[4]=0;uf[5]=0;uf[6]=G.p;uf[7]=R;
    uf[8]=req.ign;uf[9]=R-rc;uf[10]=rc;uf[11]=flat?1:0;
    const bU=mk(new Uint8Array(ub),U.UNIFORM),bH=mk(H,U.STORAGE),bS=mk(P,U.STORAGE);
    const bO=d.createBuffer({size:n*4,usage:U.STORAGE|U.COPY_SRC});bufs.push(bO);
    const rb=d.createBuffer({size:n*4,usage:U.MAP_READ|U.COPY_DST});bufs.push(rb);
    const bg=d.createBindGroup({layout:d.__pRest.getBindGroupLayout(0),entries:[bU,bH,bS,bO].map(function(b,i){return {binding:i,resource:{buffer:b}};})});
    const e=d.createCommandEncoder(),ps=e.beginComputePass();
    ps.setPipeline(d.__pRest);ps.setBindGroup(0,bg);ps.dispatchWorkgroups(wx,wy);ps.end();
    e.copyBufferToBuffer(bO,0,rb,0,n*4);d.queue.submit([e.finish()]);
    await rb.mapAsync(GPUMapMode.READ);
    const O=new Float32Array(rb.getMappedRange().slice(0));rb.unmap();
    const out=new Uint8Array(n);
    for(let k=0;k<n;k++){const v=O[k];out[k]=v>FAO_GPU_BAND?1:(v<-FAO_GPU_BAND?0:2);}
    return out;
  }finally{ bufs.forEach(function(b){try{b.destroy();}catch(x){}}); }
}
