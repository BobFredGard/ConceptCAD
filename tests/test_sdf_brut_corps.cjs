// V0.99.74 : moteur « lisse », brut = CORPS — vraie distance à la surface du corps (constat de Fred,
// STEP.conceptcad : « Brut depuis un solide », les grands congés non usinés sortaient en escalier).
// Avant, le champ du brut était l'écart VERTICAL au dessus du corps (z − dessus), lu au plus proche
// sur une grille de 0,5 mm : faux sur toute paroi raide. Corps d'essai : cylindre vertical R20 × 30
// (720 facettes) posé dans sa boîte, puis dôme (paroi qui passe du plat au vertical).
//  1. distance de chaque échantillon de la bande = distance exacte au cylindre (< 0,01 mm) ;
//  2. aucun triangle oublié : bande comparée à la force brute (tous les triangles) ;
//  3. surface extraite (surface nets) : sommets de la paroi au rayon 20 (< 0,03 mm), normales
//     horizontales et radiales — plus de marches ni de lumière rayée ;
//  4. volume = π·R²·H (< 0,5 %) ; taille d'une rainure inchangée (max(d, −d_outil)) ;
//  5. dôme : surface à la bonne distance du centre partout, du sommet au pied ;
//  6. ancien champ (écart vertical) sur le même cylindre : sommets à plus de 0,1 mm (l'escalier).
const vm=require('vm');
const {loadApp}=require('./appvm.cjs');
let ko=0;
const A=(c,m)=>{if(!c){ko++;console.log('  ✗ '+m);}else console.log('  ✓ '+m);};
(async()=>{
  const {ctx}=loadApp();
  const r=vm.runInContext(`(()=>{
    const out={};
    // cylindre vertical : dessus, dessous, paroi (NS segments)
    const cyl=(R,H,NS)=>{const v=[],t=[];v.push([0,0,0],[0,0,H]);
      for(let i=0;i<NS;i++){const a=2*Math.PI*i/NS;v.push([R*Math.cos(a),R*Math.sin(a),0],[R*Math.cos(a),R*Math.sin(a),H]);}
      for(let i=0;i<NS;i++){const j=(i+1)%NS,b0=2+2*i,t0=3+2*i,b1=2+2*j,t1=3+2*j;
        t.push([0,b1,b0],[1,t0,t1],[b0,b1,t1],[b0,t1,t0]);}
      return {v,t};};
    const R=20,H=30,m=cyl(R,H,360);
    const s={x0:-R,y0:-R,z0:0,x1:R,y1:R,z1:H,solid:'essai',_mesh:m};
    const p=0.5;
    const t0=Date.now();const S=faoSdfCreate(s,p);out.ms=Date.now()-t0;
    const n=S.n,F=S.F,BW=FAO_SDF_BW*p;
    const exact=(x,y,z)=>{const dr=Math.hypot(x,y)-R,dz=Math.abs(z-H/2)-H/2;return Math.min(Math.max(dr,dz),0)+Math.hypot(Math.max(dr,0),Math.max(dz,0));};
    // 1. bande
    let e1=0,nb=0;const band=[];
    for(let k=0;k<n[2];k++)for(let j=0;j<n[1];j++)for(let i=0;i<n[0];i++){const o=(k*n[1]+j)*n[0]+i,d=F[o];
      if(Math.abs(d)>=BW-1e-6)continue;const x=S.lo[0]+i*p,y=S.lo[1]+j*p,z=S.lo[2]+k*p;
      e1=Math.max(e1,Math.abs(d-exact(x,y,z)));nb++;if(nb%97===0)band.push([x,y,z,d]);}
    out.e1=e1;out.nb=nb;
    // 2. force brute sur un échantillon de la bande
    const segD2=(P,A,B,C)=>{ // distance² point-triangle par échantillonnage fin des arêtes et projection
      const ab=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],ac=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
      const nn=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],L=Math.hypot(...nn);
      const ap=[P[0]-A[0],P[1]-A[1],P[2]-A[2]],h=(ap[0]*nn[0]+ap[1]*nn[1]+ap[2]*nn[2])/L;
      const Q=[P[0]-nn[0]/L*h,P[1]-nn[1]/L*h,P[2]-nn[2]/L*h];
      const bc=(X,Y,Z)=>{const c=[(Y[1]-X[1])*(Q[2]-X[2])-(Y[2]-X[2])*(Q[1]-X[1]),(Y[2]-X[2])*(Q[0]-X[0])-(Y[0]-X[0])*(Q[2]-X[2]),(Y[0]-X[0])*(Q[1]-X[1])-(Y[1]-X[1])*(Q[0]-X[0])];return c[0]*nn[0]+c[1]*nn[1]+c[2]*nn[2];};
      if(bc(A,B)>=0&&bc(B,C)>=0&&bc(C,A)>=0)return h*h;
      const sd=(X,Y)=>{const d=[Y[0]-X[0],Y[1]-X[1],Y[2]-X[2]],l2=d[0]*d[0]+d[1]*d[1]+d[2]*d[2];let f=((P[0]-X[0])*d[0]+(P[1]-X[1])*d[1]+(P[2]-X[2])*d[2])/l2;f=f<0?0:f>1?1:f;
        const q=[X[0]+d[0]*f-P[0],X[1]+d[1]*f-P[1],X[2]+d[2]*f-P[2]];return q[0]*q[0]+q[1]*q[1]+q[2]*q[2];};
      return Math.min(sd(A,B),sd(B,C),sd(C,A));};
    let e2=0;band.forEach(b=>{let q=1/0;m.t.forEach(t=>{q=Math.min(q,segD2(b,m.v[t[0]],m.v[t[1]],m.v[t[2]]));});
      e2=Math.max(e2,Math.abs(Math.abs(b[3])-Math.min(Math.sqrt(q),S.TR)));});
    out.e2=e2;out.nbf=band.length;
    // 2b. toit penché (z = 8 + 0,4·x + 0,25·y) en éventails de triangles longs et fins, parois verticales :
    // les côtés partagés dans un même plan ne sont pas élargis — aucun échantillon de la bande ne doit y perdre
    {const LX=24,LY=18,K=16,zt=(x,y)=>8+0.4*x+0.25*y,B=[];
      for(let i=0;i<K;i++)B.push([LX*i/K,0]);for(let i=0;i<K;i++)B.push([LX,LY*i/K]);for(let i=0;i<K;i++)B.push([LX-LX*i/K,LY]);for(let i=0;i<K;i++)B.push([0,LY-LY*i/K]);
      const nb=B.length,v=[],t=[];B.forEach(q=>v.push([q[0],q[1],0]));B.forEach(q=>v.push([q[0],q[1],zt(q[0],q[1])]));
      for(let i=1;i<nb-1;i++){t.push([0,i+1,i]);t.push([nb,nb+i,nb+i+1]);} // dessous et toit : éventails depuis le coin 0
      for(let i=0;i<nb;i++){const j=(i+1)%nb;t.push([i,j,nb+j],[i,nb+j,nb+i]);}
      const M={v,t},pp=0.6,D=faoSdfCreate({x0:0,y0:0,z0:0,x1:LX,y1:LY,z1:zt(LX,LY),solid:'toit',_mesh:M},pp),BW2=FAO_SDF_BW*pp;
      let e=0,cnt=0,c3=0;
      for(let k=0;k<D.n[2];k++)for(let j=0;j<D.n[1];j++)for(let i=0;i<D.n[0];i++){const d=D.F[(k*D.n[1]+j)*D.n[0]+i];if(Math.abs(d)>=BW2-1e-6)continue;
        if((c3++)%3)continue;const P=[D.lo[0]+i*pp,D.lo[1]+j*pp,D.lo[2]+k*pp];let q=1/0;t.forEach(tt=>{q=Math.min(q,segD2(P,v[tt[0]],v[tt[1]],v[tt[2]]));});
        const ins=P[0]>0&&P[0]<LX&&P[1]>0&&P[1]<LY&&P[2]>0&&P[2]<zt(P[0],P[1]);
        e=Math.max(e,Math.abs(d-(ins?-1:1)*Math.min(Math.sqrt(q),D.TR)));cnt++;}
      out.toit={e,cnt,tri:t.length};}
    // 3. surface extraite
    const surf=D=>{let er=0,en=0,nz=0,nv=0;
      for(let c=0;c<D.nch[2];c++)for(let b=0;b<D.nch[1];b++)for(let a=0;a<D.nch[0];a++){const M=faoSdfChunk(D,a,b,c);
        for(let i=0;i<M.pos.length;i+=3){const x=M.pos[i],y=M.pos[i+1],z=M.pos[i+2];if(z<2||z>H-2)continue;
          const rr=Math.hypot(x,y);if(rr<R-3)continue;nv++;er=Math.max(er,Math.abs(rr-R));
          const nx=M.nrm[i],ny=M.nrm[i+1],nzz=M.nrm[i+2];nz=Math.max(nz,Math.abs(nzz));en=Math.max(en,1-(nx*x+ny*y)/rr);}}
      return {er,nz,en,nv};};
    out.s3=surf(S);
    // 4. volume, rainure
    out.vol=faoSdfVolume(S);out.vth=Math.PI*R*R*H;
    const S2=faoSdfCreate(s,p);const v0=faoSdfVolume(S2);
    faoEngCarve(S2,{x:-30,y:0,z:25},{x:30,y:0,z:25},3,0,null,null);out.dv=v0-faoSdfVolume(S2);
    // rainure Ø6 × 5 à travers le cylindre : corde 2·R au centre → ≈ 40 × 6 × 5 (bouts arrondis par le cylindre)
    out.dvth=(()=>{let v=0;const st=0.05;for(let x=-R;x<=R;x+=st){for(let y=-3;y<=3;y+=st)if(Math.hypot(x,y)<=R)v+=st*st;}return v*5;})();
    // 5. dôme : demi-sphère R20 posée sur un socle de 10 (paroi du plat au vertical)
    {const v=[],t=[],NU=96,NV=48,RS=20,HS=10;v.push([0,0,0]);
      for(let i=0;i<NU;i++){const a=2*Math.PI*i/NU;v.push([RS*Math.cos(a),RS*Math.sin(a),0]);}
      for(let j=0;j<=NV;j++){const b=Math.PI/2*j/NV;for(let i=0;i<NU;i++){const a=2*Math.PI*i/NU;v.push([RS*Math.cos(b)*Math.cos(a),RS*Math.cos(b)*Math.sin(a),HS+RS*Math.sin(b)]);}}
      const ring=j=>1+NU+j*NU;
      for(let i=0;i<NU;i++){const k=(i+1)%NU;t.push([0,1+k,1+i]);t.push([1+i,1+k,ring(0)+k],[1+i,ring(0)+k,ring(0)+i]);}
      for(let j=0;j<NV;j++)for(let i=0;i<NU;i++){const k=(i+1)%NU;t.push([ring(j)+i,ring(j)+k,ring(j+1)+k],[ring(j)+i,ring(j+1)+k,ring(j+1)+i]);}
      const sd={x0:-RS,y0:-RS,z0:0,x1:RS,y1:RS,z1:HS+RS,solid:'dome',_mesh:{v,t}};
      const D=faoSdfCreate(sd,0.4);let er=0,nv=0;
      for(let c=0;c<D.nch[2];c++)for(let b=0;b<D.nch[1];b++)for(let a=0;a<D.nch[0];a++){const M=faoSdfChunk(D,a,b,c);
        for(let i=0;i<M.pos.length;i+=3){const x=M.pos[i],y=M.pos[i+1],z=M.pos[i+2];if(z<HS+0.5)continue;
          const d=Math.hypot(x,y,z-HS);if(d<RS-3)continue;nv++;er=Math.max(er,Math.abs(d-RS));}}
      out.dome={er,nv};}
    // 6. ancien champ : écart vertical au dessus lu au plus proche sur une grille de 0,5 mm
    {const S0=faoSdfCreate({x0:-R,y0:-R,z0:0,x1:R,y1:R,z1:H},p);const g=0.5,TR=S0.TR;
      for(let k=0;k<S0.n[2];k++)for(let j=0;j<S0.n[1];j++)for(let i=0;i<S0.n[0];i++){const x=S0.lo[0]+i*p,y=S0.lo[1]+j*p,z=S0.lo[2]+k*p;
        const X=Math.round(x/g)*g,Y=Math.round(y/g)*g,top=Math.hypot(X,Y)<=R?H:0;const o=(k*S0.n[1]+j)*S0.n[0]+i;
        const d=Math.max(S0.F[o],z-top);S0.F[o]=d>TR?TR:(d<-TR?-TR:d);}
      out.s6=surf(S0);}
    return out;})()`,ctx);
  console.log(JSON.stringify(r));
  A(r.e1<0.01&&r.nb>50000,`1 : bande de ${r.nb} échantillons à la distance exacte du cylindre (écart ${r.e1.toFixed(4)} mm, calcul ${r.ms} ms)`);
  A(r.e2<1e-3,`2 : aucun triangle oublié (${r.nbf} échantillons comparés à la force brute, écart ${r.e2.toExponential(1)} mm)`);
  A(r.toit.cnt>5000&&r.toit.e<1e-3,`2 : toit penché en éventails (${r.toit.tri} triangles) : ${r.toit.cnt} échantillons = force brute (écart ${r.toit.e.toExponential(1)} mm)`);
  A(r.s3.nv>1000&&r.s3.er<0.03,`3 : paroi extraite au rayon 20 (${r.s3.nv} sommets, écart ${r.s3.er.toFixed(4)} mm)`);
  A(r.s3.nz<0.05&&r.s3.en<0.01,`3 : normales de la paroi horizontales et radiales (|nz| ≤ ${r.s3.nz.toFixed(3)}, écart ${r.s3.en.toFixed(4)})`);
  A(Math.abs(r.vol-r.vth)/r.vth<0.005,`4 : volume ${r.vol.toFixed(0)} mm³ (attendu ${r.vth.toFixed(0)})`);
  A(Math.abs(r.dv-r.dvth)/r.dvth<0.03,`4 : rainure Ø6 × 5 dans le cylindre : ${r.dv.toFixed(0)} mm³ enlevés (attendu ≈ ${r.dvth.toFixed(0)})`);
  A(r.dome.nv>1000&&r.dome.er<0.05,`5 : dôme : surface à R20 du sommet au pied (${r.dome.nv} sommets, écart ${r.dome.er.toFixed(4)} mm)`);
  A(r.s6.er>0.1,`6 : l'ancien champ (écart vertical) faisait l'escalier : écart ${r.s6.er.toFixed(3)} mm, |nz| jusqu'à ${r.s6.nz.toFixed(2)}`);
  console.log(ko?`\n${ko} échec(s)`:'\nOK');
  process.exit(ko?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
