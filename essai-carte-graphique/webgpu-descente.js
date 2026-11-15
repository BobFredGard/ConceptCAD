/* ESSAI WebGPU (non livré) — descente d'outil BOULE sur le maillage, pour toute une grille XY.
   Même calcul que faoScDropper(...).tip(x,y) de src/89-fao-cretes.js (boule exacte : sommets,
   facettes, arêtes ; listes par cellule triées par Z max décroissant, arrêt anticipé), mais un
   point de grille par fil de la carte graphique (compute shader WGSL).
   gpuDropGrid(mesh,D,laisse,x0,y0,g,nx,ny) -> Promise<{z:Float32Array (cote de la POINTE, -Infinity
   si rien), via:'gpu'|'js', t:{prep,envoi,calcul,lecture,total}}>
   Repli JavaScript automatique (faoScDropper) si navigator.gpu est absent ou si la carte refuse. */
(function(){
const WGSL=`
struct U { nx:u32, ny:u32, cnx:u32, cny:u32,
           x0:f32, y0:f32, g:f32, rr:f32,
           ox:f32, oy:f32, cs:f32, rt:f32,
           nV:u32, nE:u32, nC:u32, pad:u32 };
@group(0) @binding(0) var<uniform> u:U;
@group(0) @binding(1) var<storage,read> V:array<f32>;    // x,y,z (sommets utilisés)
@group(0) @binding(2) var<storage,read> F:array<f32>;    // 13 / facette
@group(0) @binding(3) var<storage,read> E:array<f32>;    // 8 / arête
@group(0) @binding(4) var<storage,read> OFF:array<u32>;  // 3 × (nC+1) débuts de listes
@group(0) @binding(5) var<storage,read> IDX:array<u32>;  // indices concaténés
@group(0) @binding(6) var<storage,read_write> OUT:array<f32>;
const NEG:f32 = -1.0e30;
fn inTri(o:u32, px:f32, py:f32) -> bool {
  let ax=F[o]; let ay=F[o+1u]; let bx=F[o+3u]; let by=F[o+4u]; let cx=F[o+6u]; let cy=F[o+7u];
  let d1=(px-bx)*(ay-by)-(ax-bx)*(py-by);
  let d2=(px-cx)*(by-cy)-(bx-cx)*(py-cy);
  let d3=(px-ax)*(cy-ay)-(cx-ax)*(py-ay);
  let neg=(d1<0.0)||(d2<0.0)||(d3<0.0); let pos=(d1>0.0)||(d2>0.0)||(d3>0.0);
  return !(neg&&pos);
}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.nx||gid.y>=u.ny){return;}
  let x=u.x0+f32(gid.x)*u.g; let y=u.y0+f32(gid.y)*u.g;
  let o_out=gid.y*u.nx+gid.x;
  let ci=i32(floor((x-u.ox)/u.cs)); let cj=i32(floor((y-u.oy)/u.cs));
  if(ci<0||cj<0||ci>=i32(u.cnx)||cj>=i32(u.cny)){OUT[o_out]=NEG;return;}
  let k=u32(cj)*u.cnx+u32(ci);
  let rr=u.rr; let r2=rr*rr;
  var h:f32=NEG;
  // sommets
  var a=OFF[k]; var b=OFF[k+1u];
  for(var q=a;q<b;q++){
    let i=IDX[q]*3u; let pz=V[i+2u];
    if(pz+rr<=h){break;}
    let dx=x-V[i]; let dy=y-V[i+1u]; let d2=dx*dx+dy*dy;
    if(d2<=r2){ let z=pz+sqrt(r2-d2); if(z>h){h=z;} }
  }
  // facettes
  a=OFF[u.nC+1u+k]; b=OFF[u.nC+1u+k+1u];
  for(var q=a;q<b;q++){
    let o=IDX[q]*13u;
    if(F[o+12u]+rr<=h){break;}
    let nxx=F[o+9u]; let nyy=F[o+10u]; let nzz=F[o+11u];
    let cx=x-nxx*rr; let cy=y-nyy*rr;
    if(!inTri(o,cx,cy)){continue;}
    let zc=F[o+2u]-(nxx*(cx-F[o])+nyy*(cy-F[o+1u]))/nzz;
    let z=zc+nzz*rr;
    if(z>h){h=z;}
  }
  // arêtes
  a=OFF[2u*(u.nC+1u)+k]; b=OFF[2u*(u.nC+1u)+k+1u];
  for(var q=a;q<b;q++){
    let o=IDX[q]*8u;
    if(E[o+7u]+rr<=h){break;}
    let ux=E[o+3u]; let uy=E[o+4u]; let uz=E[o+5u];
    let bb=uy*uy+ux*ux;
    if(bb<1e-12){continue;}
    let ax=x-E[o]; let ay=y-E[o+1u]; let az=-E[o+2u];
    let Ax=ay*uz-az*uy; let Ay=az*ux-ax*uz; let Az=ax*uy-ay*ux;
    let ab=-Ax*uy+Ay*ux;
    let aa=Ax*Ax+Ay*Ay+Az*Az;
    let disc=ab*ab-bb*(aa-r2);
    if(disc<0.0){continue;}
    let hz=(-ab+sqrt(disc))/bb;
    if(hz<=h){continue;}
    let t=ax*ux+ay*uy+(hz+az)*uz;
    if(t>=0.0&&t<=E[o+6u]){h=hz;}
  }
  OUT[o_out]=select(h-u.rt, NEG, h<=NEG*0.5);
}`;

// Préparation : mêmes primitives et listes que faoScDropper, en coordonnées LOCALES
// (origine au centre de la pièce) pour garder la précision des flottants 32 bits.
function prep(mesh,D,L){
  const Rt=D/2,reach=Rt+L+1e-6,Vm=mesh.v;
  let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0,z0=1/0;
  for(let i=0;i<Vm.length;i++){const p=Vm[i];
    if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1];if(p[2]<z0)z0=p[2];}
  const cx=(x0+x1)/2,cy=(y0+y1)/2,cz=z0; // décalage local
  const cs=Math.max(0.5,Rt/2);
  const nx=Math.max(1,Math.ceil((x1-x0+2*reach)/cs)+1),ny=Math.max(1,Math.ceil((y1-y0+2*reach)/cs)+1);
  const ox=x0-reach,oy=y0-reach;
  const usedV=new Uint8Array(Vm.length),E=[],F=[],eseen=new Set();
  for(let i=0;i<mesh.t.length;i++){
    const t=mesh.t[i],A=Vm[t[0]],B=Vm[t[1]],C=Vm[t[2]];
    const ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2],wx=C[0]-A[0],wy=C[1]-A[1],wz=C[2]-A[2];
    let fx=uy*wz-uz*wy,fy=uz*wx-ux*wz,fz=ux*wy-uy*wx;
    const l=Math.sqrt(fx*fx+fy*fy+fz*fz);if(!(l>1e-12))continue;
    fx/=l;fy/=l;fz/=l;if(fz<0){fx=-fx;fy=-fy;fz=-fz;}
    usedV[t[0]]=1;usedV[t[1]]=1;usedV[t[2]]=1;
    if(fz>1e-9)F.push(A[0],A[1],A[2],B[0],B[1],B[2],C[0],C[1],C[2],fx,fy,fz,Math.max(A[2],B[2],C[2]));
    for(let e=0;e<3;e++){
      const p=t[e],q=t[(e+1)%3],k=p<q?p*4194304+q:q*4194304+p;
      if(eseen.has(k))continue;eseen.add(k);
      const P=Vm[p],Q=Vm[q],ex=Q[0]-P[0],ey=Q[1]-P[1],ez=Q[2]-P[2],el=Math.sqrt(ex*ex+ey*ey+ez*ez);
      if(!(el>1e-12))continue;
      E.push(P[0],P[1],P[2],ex/el,ey/el,ez/el,el,Math.max(P[2],Q[2]));
    }
  }
  const nE=E.length/8,nF=F.length/13,nC=nx*ny;
  const vIds=[];for(let i=0;i<Vm.length;i++)if(usedV[i])vIds.push(i);
  const lists=function(count,bbox,ztOf){
    const ls=new Array(nC);
    for(let id=0;id<count;id++){const bb=bbox(id);
      const i0=Math.max(0,Math.floor((bb[0]-reach-ox)/cs)),i1=Math.min(nx-1,Math.floor((bb[1]+reach-ox)/cs));
      const j0=Math.max(0,Math.floor((bb[2]-reach-oy)/cs)),j1=Math.min(ny-1,Math.floor((bb[3]+reach-oy)/cs));
      for(let jj=j0;jj<=j1;jj++)for(let ii=i0;ii<=i1;ii++){const k=jj*nx+ii;(ls[k]||(ls[k]=[])).push(id);}}
    for(let k=0;k<nC;k++)if(ls[k])ls[k].sort(function(p,q){return ztOf(q)-ztOf(p);});
    return ls;};
  const LV=lists(vIds.length,function(id){const p=Vm[vIds[id]];return [p[0],p[0],p[1],p[1]];},function(id){return Vm[vIds[id]][2];});
  const LF=lists(nF,function(id){const o=id*13;return [Math.min(F[o],F[o+3],F[o+6]),Math.max(F[o],F[o+3],F[o+6]),Math.min(F[o+1],F[o+4],F[o+7]),Math.max(F[o+1],F[o+4],F[o+7])];},function(id){return F[id*13+12];});
  const LE=lists(nE,function(id){const o=id*8,x=E[o],y=E[o+1],x2=x+E[o+3]*E[o+6],y2=y+E[o+4]*E[o+6];
    return [Math.min(x,x2),Math.max(x,x2),Math.min(y,y2),Math.max(y,y2)];},function(id){return E[id*8+7];});
  // tableaux à plat, coordonnées locales
  const VA=new Float32Array(vIds.length*3);
  vIds.forEach(function(i,n){VA[n*3]=Vm[i][0]-cx;VA[n*3+1]=Vm[i][1]-cy;VA[n*3+2]=Vm[i][2]-cz;});
  const FA=new Float32Array(F.length);
  for(let n=0;n<nF;n++){const o=n*13;for(let c=0;c<3;c++){FA[o+c*3]=F[o+c*3]-cx;FA[o+c*3+1]=F[o+c*3+1]-cy;FA[o+c*3+2]=F[o+c*3+2]-cz;}
    FA[o+9]=F[o+9];FA[o+10]=F[o+10];FA[o+11]=F[o+11];FA[o+12]=F[o+12]-cz;}
  const EA=new Float32Array(E.length);
  for(let n=0;n<nE;n++){const o=n*8;EA[o]=E[o]-cx;EA[o+1]=E[o+1]-cy;EA[o+2]=E[o+2]-cz;
    EA[o+3]=E[o+3];EA[o+4]=E[o+4];EA[o+5]=E[o+5];EA[o+6]=E[o+6];EA[o+7]=E[o+7]-cz;}
  const OFF=new Uint32Array(3*(nC+1));let tot=0;
  [LV,LF,LE].forEach(function(ls,s){for(let k=0;k<nC;k++){OFF[s*(nC+1)+k]=tot;tot+=ls[k]?ls[k].length:0;}OFF[s*(nC+1)+nC]=tot;});
  const IDX=new Uint32Array(Math.max(1,tot));let w=0;
  [LV,LF,LE].forEach(function(ls){for(let k=0;k<nC;k++)if(ls[k])for(let q=0;q<ls[k].length;q++)IDX[w++]=ls[k][q];});
  return {VA:VA,FA:FA.length?FA:new Float32Array(13),EA:EA.length?EA:new Float32Array(8),OFF:OFF,IDX:IDX,
    nC:nC,cnx:nx,cny:ny,ox:ox-cx,oy:oy-cy,cs:cs,cx:cx,cy:cy,cz:cz,nV:vIds.length,nE:nE,nF:nF};
}

let dev=null,pipe=null,info=null;
async function device(){
  if(dev)return dev;
  if(typeof navigator==='undefined'||!navigator.gpu)return null;
  const ad=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!ad)return null;
  try{ info=ad.info||(ad.requestAdapterInfo?await ad.requestAdapterInfo():null); }catch(e){ info=null; }
  dev=await ad.requestDevice({requiredLimits:{maxStorageBufferBindingSize:Math.min(ad.limits.maxStorageBufferBindingSize,1<<30),
    maxBufferSize:Math.min(ad.limits.maxBufferSize,1<<30)}});
  dev.lost.then(function(){dev=null;pipe=null;});
  pipe=dev.createComputePipeline({layout:'auto',compute:{module:dev.createShaderModule({code:WGSL}),entryPoint:'main'}});
  return dev;
}
function jsDrop(mesh,D,L,x0,y0,g,nx,ny){
  const d=faoScDropper(mesh,'ball',D,D/2,L);const z=new Float32Array(nx*ny);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)z[j*nx+i]=d.tip(x0+i*g,y0+j*g);
  return z;
}
async function gpuDropGrid(mesh,D,L,x0,y0,g,nx,ny,opts){
  opts=opts||{};
  const T0=performance.now();
  let d=null;
  if(!opts.forceJs){ try{ d=await device(); }catch(e){ d=null; } }
  if(!d){const z=jsDrop(mesh,D,L,x0,y0,g,nx,ny);return {z:z,via:'js',t:{total:performance.now()-T0}};}
  const P=opts.prep||prep(mesh,D,L||0);
  const T1=performance.now();
  const buf=function(arr,usage){const b=d.createBuffer({size:Math.max(16,arr.byteLength+3&~3),usage:usage|GPUBufferUsage.COPY_DST});d.queue.writeBuffer(b,0,arr);return b;};
  const S=GPUBufferUsage.STORAGE;
  const ub=new ArrayBuffer(64),uu=new Uint32Array(ub),uf=new Float32Array(ub);
  uu[0]=nx;uu[1]=ny;uu[2]=P.cnx;uu[3]=P.cny;
  uf[4]=x0-P.cx;uf[5]=y0-P.cy;uf[6]=g;uf[7]=D/2+(L||0);
  uf[8]=P.ox;uf[9]=P.oy;uf[10]=P.cs;uf[11]=D/2;
  uu[12]=P.nV;uu[13]=P.nE;uu[14]=P.nC;uu[15]=0;
  const bU=buf(new Uint8Array(ub),GPUBufferUsage.UNIFORM);
  const bV=buf(P.VA,S),bF=buf(P.FA,S),bE=buf(P.EA,S),bO=buf(P.OFF,S),bI=buf(P.IDX,S);
  const n=nx*ny,bOut=d.createBuffer({size:n*4,usage:S|GPUBufferUsage.COPY_SRC});
  const bRd=d.createBuffer({size:n*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  const bg=d.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:[bU,bV,bF,bE,bO,bI,bOut].map(function(b,i){return {binding:i,resource:{buffer:b}};})});
  await d.queue.onSubmittedWorkDone();
  const T2=performance.now();
  const enc=d.createCommandEncoder(),pass=enc.beginComputePass();
  pass.setPipeline(pipe);pass.setBindGroup(0,bg);pass.dispatchWorkgroups(Math.ceil(nx/8),Math.ceil(ny/8));pass.end();
  d.queue.submit([enc.finish()]);
  await d.queue.onSubmittedWorkDone();
  const T3=performance.now();
  const e2=d.createCommandEncoder();e2.copyBufferToBuffer(bOut,0,bRd,0,n*4);d.queue.submit([e2.finish()]);
  await bRd.mapAsync(GPUMapMode.READ);
  const z=new Float32Array(bRd.getMappedRange().slice(0));bRd.unmap();
  for(let k=0;k<n;k++)z[k]=z[k]<=-1e29?-1/0:z[k]+P.cz;
  const T4=performance.now();
  [bU,bV,bF,bE,bO,bI,bOut,bRd].forEach(function(b){b.destroy();});
  return {z:z,via:'gpu',t:{prep:T1-T0,envoi:T2-T1,calcul:T3-T2,lecture:T4-T3,total:T4-T0},
    carte:info?((info.vendor||'')+' '+(info.architecture||'')+' '+(info.description||'')).trim():'?'};
}
window.gpuDropGrid=gpuDropGrid;window.gpuDropPrep=prep;window.gpuDropJs=jsDrop;
})();
