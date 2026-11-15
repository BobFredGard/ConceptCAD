/* ESSAI WebGPU n°2 (non livré) — même descente boule que faoScDropper().tip, mais SANS listes
   par cellule : un fil par primitive (sommet, facette, arête) qui « imprime » sa cote de centre
   de boule sur les nœuds de grille à sa portée (maximum atomique). Préparation = tableaux à plat
   seulement (pas de tri) ; le maximum ne dépend pas de l'ordre : même résultat que le JS. */
(function(){
const WGSL=`
struct U { nx:u32, ny:u32, nV:u32, nF:u32,
           x0:f32, y0:f32, g:f32, rr:f32,
           nE:u32, phase:u32, p2:u32, p3:u32 };
@group(0) @binding(0) var<uniform> u:U;
@group(0) @binding(1) var<storage,read> V:array<f32>;
@group(0) @binding(2) var<storage,read> F:array<f32>;
@group(0) @binding(3) var<storage,read> E:array<f32>;
@group(0) @binding(4) var<storage,read_write> OUT:array<atomic<u32>>;
fn enc(f:f32)->u32 { let b=bitcast<u32>(f); return select(b|0x80000000u, ~b, (b&0x80000000u)!=0u); }
fn put(i:i32,j:i32,z:f32){ atomicMax(&OUT[u32(j)*u.nx+u32(i)], enc(z)); }
fn rng(lo:f32,hi:f32,n:u32)->vec2<i32>{
  let a=max(0,i32(ceil(lo/u.g))); let b=min(i32(n)-1,i32(floor(hi/u.g)));
  return vec2<i32>(a,b);
}
fn inTri(o:u32, px:f32, py:f32) -> bool {
  let ax=F[o]; let ay=F[o+1u]; let bx=F[o+3u]; let by=F[o+4u]; let cx=F[o+6u]; let cy=F[o+7u];
  let d1=(px-bx)*(ay-by)-(ax-bx)*(py-by);
  let d2=(px-cx)*(by-cy)-(bx-cx)*(py-cy);
  let d3=(px-ax)*(cy-ay)-(cx-ax)*(py-ay);
  let neg=(d1<0.0)||(d2<0.0)||(d3<0.0); let pos=(d1>0.0)||(d2>0.0)||(d3>0.0);
  return !(neg&&pos);
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>, @builtin(num_workgroups) nw:vec3<u32>) {
  let id=gid.x+gid.y*nw.x*64u;
  let rr=u.rr; let r2=rr*rr;
  if(u.phase==0u){ // sommets
    if(id>=u.nV){return;}
    let px=V[id*3u]-u.x0; let py=V[id*3u+1u]-u.y0; let pz=V[id*3u+2u];
    let I=rng(px-rr,px+rr,u.nx); let J=rng(py-rr,py+rr,u.ny);
    for(var j=J.x;j<=J.y;j++){ for(var i=I.x;i<=I.y;i++){
      let x=u.x0+f32(i)*u.g; let y=u.y0+f32(j)*u.g;
      let dx=x-V[id*3u]; let dy=y-V[id*3u+1u]; let d2=dx*dx+dy*dy;
      if(d2<=r2){ put(i,j,pz+sqrt(r2-d2)); } } }
  } else if(u.phase==1u){ // facettes
    if(id>=u.nF){return;}
    let o=id*13u;
    let nxx=F[o+9u]; let nyy=F[o+10u]; let nzz=F[o+11u];
    let sx=nxx*rr-u.x0; let sy=nyy*rr-u.y0;
    let I=rng(min(F[o],min(F[o+3u],F[o+6u]))+sx-u.g,max(F[o],max(F[o+3u],F[o+6u]))+sx+u.g,u.nx);
    let J=rng(min(F[o+1u],min(F[o+4u],F[o+7u]))+sy-u.g,max(F[o+1u],max(F[o+4u],F[o+7u]))+sy+u.g,u.ny);
    for(var j=J.x;j<=J.y;j++){ for(var i=I.x;i<=I.y;i++){
      let x=u.x0+f32(i)*u.g; let y=u.y0+f32(j)*u.g;
      let cx=x-nxx*rr; let cy=y-nyy*rr;
      if(!inTri(o,cx,cy)){continue;}
      let zc=F[o+2u]-(nxx*(cx-F[o])+nyy*(cy-F[o+1u]))/nzz;
      put(i,j,zc+nzz*rr); } }
  } else { // arêtes
    if(id>=u.nE){return;}
    let o=id*8u;
    let ux=E[o+3u]; let uy=E[o+4u]; let uz=E[o+5u]; let el=E[o+6u];
    let bb=uy*uy+ux*ux;
    if(bb<1e-12){return;}
    let x1=E[o]; let y1=E[o+1u]; let x2=x1+ux*el; let y2=y1+uy*el;
    let I=rng(min(x1,x2)-rr-u.x0-u.g,max(x1,x2)+rr-u.x0+u.g,u.nx); let J=rng(min(y1,y2)-rr-u.y0-u.g,max(y1,y2)+rr-u.y0+u.g,u.ny);
    for(var j=J.x;j<=J.y;j++){ for(var i=I.x;i<=I.y;i++){
      let x=u.x0+f32(i)*u.g; let y=u.y0+f32(j)*u.g;
      let ax=x-E[o]; let ay=y-E[o+1u]; let az=-E[o+2u];
      let Ax=ay*uz-az*uy; let Ay=az*ux-ax*uz; let Az=ax*uy-ay*ux;
      let ab=-Ax*uy+Ay*ux; let aa=Ax*Ax+Ay*Ay+Az*Az;
      let disc=ab*ab-bb*(aa-r2);
      if(disc<0.0){continue;}
      let hz=(-ab+sqrt(disc))/bb;
      let t=ax*ux+ay*uy+(hz+az)*uz;
      if(t>=0.0&&t<=el){ put(i,j,hz); } } }
  }
}`;
function flat(mesh){
  const Vm=mesh.v;let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0,z0=1/0;
  for(let i=0;i<Vm.length;i++){const p=Vm[i];if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1];if(p[2]<z0)z0=p[2];}
  const cx=(x0+x1)/2,cy=(y0+y1)/2,cz=z0;
  const used=new Uint8Array(Vm.length),F=new Float32Array(mesh.t.length*13),E=new Float32Array(mesh.t.length*3*8),eseen=new Set();
  let nF=0,nE=0;
  for(let i=0;i<mesh.t.length;i++){
    const t=mesh.t[i],A=Vm[t[0]],B=Vm[t[1]],C=Vm[t[2]];
    const ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2],wx=C[0]-A[0],wy=C[1]-A[1],wz=C[2]-A[2];
    let fx=uy*wz-uz*wy,fy=uz*wx-ux*wz,fz=ux*wy-uy*wx;const l=Math.sqrt(fx*fx+fy*fy+fz*fz);if(!(l>1e-12))continue;
    fx/=l;fy/=l;fz/=l;if(fz<0){fx=-fx;fy=-fy;fz=-fz;}
    used[t[0]]=1;used[t[1]]=1;used[t[2]]=1;
    if(fz>1e-9){const o=nF*13;F[o]=A[0]-cx;F[o+1]=A[1]-cy;F[o+2]=A[2]-cz;F[o+3]=B[0]-cx;F[o+4]=B[1]-cy;F[o+5]=B[2]-cz;
      F[o+6]=C[0]-cx;F[o+7]=C[1]-cy;F[o+8]=C[2]-cz;F[o+9]=fx;F[o+10]=fy;F[o+11]=fz;nF++;}
    for(let e=0;e<3;e++){const p=t[e],q=t[(e+1)%3],k=p<q?p*4194304+q:q*4194304+p;if(eseen.has(k))continue;eseen.add(k);
      const P=Vm[p],Q=Vm[q],ex=Q[0]-P[0],ey=Q[1]-P[1],ez=Q[2]-P[2],el=Math.sqrt(ex*ex+ey*ey+ez*ez);if(!(el>1e-12))continue;
      const o=nE*8;E[o]=P[0]-cx;E[o+1]=P[1]-cy;E[o+2]=P[2]-cz;E[o+3]=ex/el;E[o+4]=ey/el;E[o+5]=ez/el;E[o+6]=el;nE++;}
  }
  let nV=0;for(let i=0;i<Vm.length;i++)if(used[i])nV++;
  const V=new Float32Array(nV*3);let w=0;
  for(let i=0;i<Vm.length;i++)if(used[i]){V[w++]=Vm[i][0]-cx;V[w++]=Vm[i][1]-cy;V[w++]=Vm[i][2]-cz;}
  return {V:V,F:F.slice(0,Math.max(13,nF*13)),E:E.slice(0,Math.max(8,nE*8)),nV:nV,nF:nF,nE:nE,cx:cx,cy:cy,cz:cz};
}
let dev=null,pipe=null,info=null;
async function device(){
  if(dev)return dev;
  if(typeof navigator==='undefined'||!navigator.gpu)return null;
  const ad=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!ad)return null;
  info=ad.info||null;
  dev=await ad.requestDevice({requiredLimits:{maxStorageBufferBindingSize:Math.min(ad.limits.maxStorageBufferBindingSize,1<<30),maxBufferSize:Math.min(ad.limits.maxBufferSize,1<<30)}});
  dev.lost.then(function(){dev=null;pipe=null;});
  pipe=dev.createComputePipeline({layout:'auto',compute:{module:dev.createShaderModule({code:WGSL}),entryPoint:'main'}});
  return dev;
}
async function gpuDropGrid2(mesh,D,L,x0,y0,g,nx,ny,opts){
  opts=opts||{};const T0=performance.now();
  let d=null;if(!opts.forceJs){try{d=await device();}catch(e){d=null;}}
  if(!d){const z=gpuDropJs(mesh,D,L,x0,y0,g,nx,ny);return {z:z,via:'js',t:{total:performance.now()-T0}};}
  const P=flat(mesh);const T1=performance.now();
  const S=GPUBufferUsage.STORAGE;
  const buf=function(arr,usage){const b=d.createBuffer({size:Math.max(16,(arr.byteLength+3)&~3),usage:usage|GPUBufferUsage.COPY_DST});d.queue.writeBuffer(b,0,arr);return b;};
  const n=nx*ny;
  const bV=buf(P.V,S),bF=buf(P.F,S),bE=buf(P.E,S);
  const bOut=d.createBuffer({size:n*4,usage:S|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}); // zéros = rien
  const bRd=d.createBuffer({size:n*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  const unis=[0,1,2].map(function(pass){const ub=new ArrayBuffer(48),uu=new Uint32Array(ub),uf=new Float32Array(ub);
    uu[0]=nx;uu[1]=ny;uu[2]=P.nV;uu[3]=P.nF;uf[4]=x0-P.cx;uf[5]=y0-P.cy;uf[6]=g;uf[7]=D/2+(L||0);uu[8]=P.nE;uu[9]=pass;
    return buf(new Uint8Array(ub),GPUBufferUsage.UNIFORM);});
  await d.queue.onSubmittedWorkDone();const T2=performance.now();
  const enc=d.createCommandEncoder();
  [P.nV,P.nF,P.nE].forEach(function(cnt,pass){
    const bg=d.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:[unis[pass],bV,bF,bE,bOut].map(function(b,i){return {binding:i,resource:{buffer:b}};})});
    const wg=Math.max(1,Math.ceil(cnt/64)),wx=Math.min(wg,65535),wy=Math.ceil(wg/wx);
    const ps=enc.beginComputePass();ps.setPipeline(pipe);ps.setBindGroup(0,bg);ps.dispatchWorkgroups(wx,wy);ps.end();});
  d.queue.submit([enc.finish()]);await d.queue.onSubmittedWorkDone();const T3=performance.now();
  const e2=d.createCommandEncoder();e2.copyBufferToBuffer(bOut,0,bRd,0,n*4);d.queue.submit([e2.finish()]);
  await bRd.mapAsync(GPUMapMode.READ);const U32=new Uint32Array(bRd.getMappedRange().slice(0));bRd.unmap();
  const z=new Float32Array(n),u1=new Uint32Array(1),f1=new Float32Array(u1.buffer),rt=D/2;
  for(let k=0;k<n;k++){const b=U32[k];if(b===0){z[k]=-1/0;continue;}u1[0]=(b&0x80000000)?(b&0x7fffffff):~b;z[k]=f1[0]+P.cz-rt;}
  const T4=performance.now();
  [bV,bF,bE,bOut,bRd].concat(unis).forEach(function(b){b.destroy();});
  return {z:z,via:'gpu',t:{prep:T1-T0,envoi:T2-T1,calcul:T3-T2,lecture:T4-T3,total:T4-T0},carte:info?((info.vendor||'')+' '+(info.architecture||'')).trim():'?'};
}
window.gpuDropGrid2=gpuDropGrid2;
})();

