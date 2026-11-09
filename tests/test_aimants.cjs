// V0.57.0 : aimants permanents (48-aimants-*). Le champ calculé retrouve les valeurs publiées par un
// fabricant et une intégration numérique indépendante ; le catalogue est sain ; un aimant s'insère
// comme une pièce normalisée, sa géométrie exacte a le bon volume, ses lignes de champ s'affichent
// par occurrence, s'enregistrent et s'annulent.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await require('./noyau.cjs').charger();
  const {ctx,sandbox}=loadApp();
  sandbox.__realOcct=real;
  vm.runInContext('occt=__realOcct;occtReady=true;window.alert=function(){};confirm=function(){return true;};',ctx);
  const R=String.raw`
    const out={fails:[],log:[]};const A=(c,m)=>{if(!c)out.fails.push(m);else out.log.push(m);};
    // ── 1. valeurs publiées : K&J Magnetics D82, Ø12,7 × 3,175, Br 1,32 T, surface 2952 G et 2643 G à 0,889 mm ──
    const D82={s:'cyl',d:12.7,h:3.175,Br:1.32};
    const G=z=>magField(D82,0,0,D82.h+z)[2]*1e4;
    A(Math.abs(magPoleField(D82)*1e4-2952)<1,'1 : D82 en surface : '+(magPoleField(D82)*1e4).toFixed(1)+' G (publié 2952)');
    A(Math.abs(G(0.889)-2643)<1,'2 : D82 à 0,889 mm : '+G(0.889).toFixed(1)+' G (publié 2643)');
    // ── 2. hors de l'axe : intégration numérique des charges de surface (autre méthode, lente) ──
    const refFaces=(faces,p,N=400)=>{const B=[0,0,0],K=1/(4*Math.PI);
      faces.forEach(f=>{for(let i=0;i<N;i++)for(let j=0;j<N;j++){
        const q=f.at((i+.5)/N,(j+.5)/N),dA=q[3],dx=p[0]-q[0],dy=p[1]-q[1],dz=p[2]-q[2],d=Math.hypot(dx,dy,dz),k=f.s*K*q[4]*dA/(d*d*d);
        B[0]+=k*dx;B[1]+=k*dy;B[2]+=k*dz;}});return B;};
    const annulus=(r0,r1,z,s,Br,N=400)=>({s,at:(u,v)=>{const r=r0+(r1-r0)*u,t=2*Math.PI*v;return [r*Math.cos(t),r*Math.sin(t),z,r*(r1-r0)/N*2*Math.PI/N,Br];}});
    const rect=(a,b,z,s,Br,N=400)=>({s,at:(u,v)=>[a*(u-.5),b*(v-.5),z,a*b/(N*N),Br]});
    const err=(F,E)=>Math.hypot(F[0]-E[0],F[1]-E[1],F[2]-E[2])/Math.hypot(E[0],E[1],E[2])*100;
    const disc={s:'cyl',d:20,h:10,Br:1.4},ring={s:'ring',d:30,di:10,h:5,Br:1.3},box={s:'box',a:20,b:10,h:5,Br:1.4};
    const pts=[[12,3,14],[3,4,-5],[25,-9,2.5],[1,1,12]]; // hors de la matière : la méthode de référence donne H, égal à B dans l'air
    let worst=0;
    pts.forEach(p=>{
      worst=Math.max(worst,err(magField(disc,...p),refFaces([annulus(0,10,10,1,1.4),annulus(0,10,0,-1,1.4)],p)));
      worst=Math.max(worst,err(magField(ring,...p),refFaces([annulus(5,15,5,1,1.3),annulus(5,15,0,-1,1.3)],p)));
      worst=Math.max(worst,err(magField(box,...p),refFaces([rect(20,10,5,1,1.4),rect(20,10,0,-1,1.4)],p)));
    });
    A(worst<0.05,'3 : disque, anneau, pavé hors axe : écart maxi '+worst.toFixed(4)+' %');
    // B normal continu à la traversée de la face nord
    [disc,box].forEach(m=>{const a=magField(m,1,1,m.h-1e-4)[2],b=magField(m,1,1,m.h+1e-4)[2];A(Math.abs(a-b)<2e-3,'3b : '+m.s+' : Bz continu à la face nord ('+a.toFixed(4)+' / '+b.toFixed(4)+' T)');});
    // démagnétisation : longue tige B ≈ Br en son centre ; grande plaque mince B ≈ 0
    const tige={s:'box',a:1,b:1,h:1000,Br:1.4},plaque={s:'box',a:1000,b:1000,h:1,Br:1.4},tz=magField(tige,0,0,500)[2],pz=magField(plaque,0,0,0.5)[2];
    A(Math.abs(tz-1.4)<0.01&&Math.abs(pz)<0.01,'3c : longue tige '+tz.toFixed(4)+' T, plaque mince '+pz.toFixed(4)+' T');
    const cyT={s:'cyl',d:1,h:1000,Br:1.4},cz=magField(cyT,0,0,500)[2];
    A(Math.abs(cz-1.4)<0.01,'3d : longue tige ronde '+cz.toFixed(4)+' T');
    // ── 2b. V0.71.0 : cône tronqué (courants équivalents) et disque diamétral (charges de paroi) ──
    const cone={s:'cone',d:20,dt:10,h:8,Br:1.25},Lc=Math.hypot(8,5),nzc=5/Lc;
    const paroiC={s:1,at:(u,v)=>{const z=8*u,r=10-5*u,t=2*Math.PI*v;return [r*Math.cos(t),r*Math.sin(t),z,r*Lc/400*2*Math.PI/400,1.25*nzc];}};
    let wc=0;[[0,0,12],[14,3,4],[3,-4,-5],[9,0,6],[0,0,8.5]].forEach(p=>{wc=Math.max(wc,err(magField(cone,...p),refFaces([annulus(0,5,8,1,1.25),annulus(0,10,0,-1,1.25),paroiC],p)));});
    A(wc<0.05,'3e : cône hors de la matière : écart maxi '+wc.toFixed(4)+' % (charges de surface)');
    const cc={s:'cone',d:20,dt:20,h:10,Br:1.4};
    A([[3,2,12],[12,1,5],[1,1,5]].every(p=>err(magField(cc,...p),magField(disc,...p))<1e-4),'3f : cône aux deux bases égales = cylindre, matière comprise');
    A(Math.abs(magField(cone,1,1,8-1e-4)[2]-magField(cone,1,1,8+1e-4)[2])<2e-3,'3g : cône : Bz continu à la face nord');
    const dia={s:'cyl',dia:true,d:10,h:5,Br:1.345};
    const paroiD={s:1,at:(u,v)=>{const z=5*u,t=2*Math.PI*v;return [5*Math.cos(t),5*Math.sin(t),z,5*2*Math.PI/400*5/400,1.345*Math.sin(t)];}};
    let wd=0;[[0,8,2.5],[6,6,1],[2,-3,9],[0,5.2,2.5],[10,0,2.5]].forEach(p=>{wd=Math.max(wd,err(magField(dia,...p),refFaces([paroiD],p)));});
    A(wd<0.05,'3h : disque diamétral hors de la matière : écart maxi '+wd.toFixed(4)+' %');
    const tD=magField({s:'cyl',dia:true,d:1,h:2000,Br:1.4},0,0,1000)[1],pD=magField({s:'cyl',dia:true,d:1,h:0.001,Br:1.4},0,0,0.0005)[1];
    A(Math.abs(tD-0.7)<0.005&&Math.abs(pD-1.4)<0.005,'3i : diamétral : longue tige B = Br/2 ('+tD.toFixed(4)+' T), disque très fin B = Br ('+pD.toFixed(4)+' T)');
    const muD=1.345*Math.PI*25*5/(4*Math.PI),fy=magField(dia,0,500,2.5)[1],dD=2*muD/(500*500*500);
    A(Math.abs(fy-dD)/dD<0.01,'3j : diamétral à grande distance : dipôle couché selon Y ('+(Math.abs(fy-dD)/dD*100).toFixed(3)+' %)');
    // ── 2c. V0.71.0 : aimants à visser (trou fraisé : plein − trou) ──
    const csk=(rA,rB,zA,zB,sg,cx)=>{const L=Math.hypot(zB-zA,rB-rA),nz=Math.abs(rB-rA)/L;return {s:sg,at:(u,v)=>{const z=zA+(zB-zA)*u,r=rA+(rB-rA)*u,t=2*Math.PI*v;return [cx+r*Math.cos(t),r*Math.sin(t),z,r*L/400*2*Math.PI/400,1.19*nz];}};};
    const ann2=(r0,r1,z,s,cx)=>({s,at:(u,v)=>{const r=r0+(r1-r0)*u,t=2*Math.PI*v;return [cx+r*Math.cos(t),r*Math.sin(t),z,r*(r1-r0)/400*2*Math.PI/400,1.19];}});
    const HT={x:0,y:0,d1:4.5,d2:9.46,t:2.48};
    const vH={s:'cyl',d:15,h:4,Br:1.19,holes:[Object.assign({top:true},HT)]},vB={s:'cyl',d:15,h:4,Br:1.19,holes:[Object.assign({top:false},HT)]};
    const vQ={s:'box',a:40,b:20,h:4,Br:1.19,holes:[-10,10].map(x=>Object.assign({},HT,{x,top:true}))};
    let wv=0;
    [[0,0,6],[3,1,5],[10,2,2],[0,0,-3]].forEach(p=>{
      wv=Math.max(wv,err(magField(vH,...p),refFaces([annulus(4.73,7.5,4,1,1.19),annulus(2.25,7.5,0,-1,1.19),csk(2.25,4.73,1.52,4,1,0)],p)));
      wv=Math.max(wv,err(magField(vB,...p),refFaces([annulus(2.25,7.5,4,1,1.19),annulus(4.73,7.5,0,-1,1.19),csk(4.73,2.25,0,2.48,-1,0)],p)));
    });
    [[0,0,6],[10,0,7],[25,5,2],[-10,3,-2]].forEach(p=>{
      wv=Math.max(wv,err(magField(vQ,...p),refFaces([rect(40,20,4,1,1.19),rect(40,20,0,-1,1.19)].concat(...[-10,10].map(cx=>[ann2(0,4.73,4,-1,cx),ann2(0,2.25,0,1,cx),csk(2.25,4.73,1.52,4,1,cx)])),p)));
    });
    A(wv<0.05,'3k : disques à visser (fraisage en haut et en bas) et pavé à deux trous : écart maxi '+wv.toFixed(4)+' %');
    A(!magInside(vH,0,0,3.9)&&!magInside(vH,4.5,0,3.9)&&magInside(vH,5,0,3.9)&&!magInside(vB,4.5,0,0.1)&&magInside(vB,4.5,0,3.9),'3l : le trou et le fraisage sont vides');
    // ── 3. physique : symétrie du plan médian, dipôle à grande distance ──
    const sym=magField(disc,6,4,5+3),sy2=magField(disc,6,4,5-3);
    A(Math.abs(sym[0]-sy2[0]*-1)<1e-9&&Math.abs(sym[2]-sy2[2])<1e-9,'4 : plan médian : Bz pair, Bxy impair');
    const V=Math.PI*100*10,mu=1.4*V/(4*Math.PI),far=500;
    const dip=2*mu/(far*far*far),fz=magField(disc,0,0,5+far)[2];
    A(Math.abs(fz-dip)/dip<0.01,'5 : à grande distance : champ du dipôle ('+(Math.abs(fz-dip)/dip*100).toFixed(3)+' %)');
    // ── 4. catalogue ──
    const codes=new Set(MAG_CAT.map(r=>r.code));
    A(MAG_CAT.length>=200&&codes.size===MAG_CAT.length,'6 : '+MAG_CAT.length+' articles, références uniques');
    const bad=MAG_CAT.filter(r=>{
      const d=r.s==='cyl'?[r.d,r.h]:r.s==='ring'?[r.d,r.di,r.h]:r.s==='cone'?[r.d,r.dt,r.h]:r.s==='cs'?[r.d,r.h]:[r.a,r.b,r.h];
      if(!d.every(v=>v>0&&isFinite(v)))return true;
      if(r.s==='cone'&&r.dt>=r.d)return true;
      if(r.dia&&r.s!=='cyl')return true;
      if((r.s==='cs'||r.s==='csq')!==!!r.cs)return true;
      if(r.cs&&!(r.cs.d2>r.cs.d1&&r.cs.t<r.h&&r.cs.d2<(r.s==='cs'?r.d:Math.min(r.a,r.b))))return true;
      if(r.s==='ring'&&r.di>=r.d)return true;
      if(r.s==='cube'&&!(r.a===r.b&&r.b===r.h))return true;
      if(!(r.br&&r.br[0]>0.1&&r.br[1]<1.6&&r.br[0]<=r.br[1]))return true;
      return !r.grade||!r.src;
    });
    A(!bad.length,'7 : dimensions et rémanences plausibles'+(bad.length?' — '+bad.slice(0,5).map(r=>r.code).join(' '):''));
    MAG_SHAPES.forEach(([k])=>A(MAG_CAT.some(r=>r.s===k),'8 : forme '+k+' présente'));
    const st0=stdNormState('magnet',{});
    A(st0.shape==='cyl'&&st0.grade==='*'&&!!magRow(st0.art),'9 : état par défaut : un disque du catalogue');
    const st1=stdNormState('magnet',{shape:'ring',grade:'N42',art:'INCONNU'});
    A(st1.shape==='ring'&&(st1.grade==='N42'?magRow(st1.art).grade==='N42':true),'10 : l’article reste cohérent avec la forme et la nuance');
    // ── 5. lignes ──
    [disc,ring,box].forEach(m=>{
      const L=magLines(m);
      const finite=L.every(T=>T.pts.every(p=>p.every(isFinite)));
      const closed=L.filter(T=>T.closed);
      const ends=closed.every(T=>{const e=T.pts[T.pts.length-1];return magInside(m,e[0],e[1],e[2]);});
      const south=closed.every(T=>T.pts[T.pts.length-1][2]<m.h/2); // reviennent par le sud
      A(L.length>=30&&finite&&closed.length>0&&ends&&south,'11 : '+m.s+' : '+L.length+' lignes, '+closed.length+' reviennent par la face sud');
    });
    [cone,dia,vH,vQ].forEach(m=>{
      const L=magLines(m),closed=L.filter(T=>T.closed);
      const ends=closed.every(T=>{const e=T.pts[T.pts.length-1];return magInside(m,e[0],e[1],e[2]);});
      const south=closed.every(T=>{const e=T.pts[T.pts.length-1];return m.dia?e[1]<0:e[2]<m.h/2;});
      A(L.length>=30&&L.every(T=>T.pts.every(p=>p.every(isFinite)))&&closed.length>0&&ends&&south,'11b : '+(m.dia?'diamétral':m.holes?(m.s==='box'?'pavé à visser':'disque à visser'):'cône')+' : '+L.length+' lignes, '+closed.length+' reviennent par le pôle sud');
    });
    A(MAG_CAT.filter(r=>r.dia).map(r=>r.code).join(' ')==='S-10-05-DN S-12-06-DN'&&MAG_CAT.filter(r=>r.s==='cone').length===4&&MAG_CAT.filter(r=>r.s==='cs').length===16&&MAG_CAT.filter(r=>r.s==='csq').length===9,'11c : catalogue : 2 disques diamétraux, 4 cônes, 16 disques et 9 pavés à visser');
    const hole=magLines(ring).some(T=>T.closed&&T.pts.some(p=>Math.abs(p[2]-2.5)<0.5&&Math.hypot(p[0],p[1])<5));
    A(hole,'12 : anneau : des lignes passent par le trou');
    const t0=Date.now();magLines(disc);magLines(ring);magLines(box);
    A(Date.now()-t0<2000,'13 : lignes des trois aimants : '+(Date.now()-t0)+' ms');
    // ── 5b. V0.70.1 : plusieurs aimants, champ additionné ──
    const Id={o:[0,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]};
    const P1=[3,-4,12],one=magFieldMulti([{m:disc,F:Id}],P1),ref1=magField(disc,...P1);
    A(Math.hypot(one[0]-ref1[0],one[1]-ref1[1],one[2]-ref1[2])<1e-12,'13b : un aimant seul : même champ qu’avant');
    // aimant retourné et déplacé : son champ en un point = celui de l'aimant de base au point ramené dans son repère
    const Fr={o:[10,5,30],x:[1,0,0],y:[0,-1,0],z:[0,0,-1]},P2=[14,3,12],l=magToLoc(Fr,P2),bl=magField(disc,...l);
    const bw=magFieldMulti([{m:disc,F:Fr}],P2),ex2=[bl[0],-bl[1],-bl[2]];
    A(Math.hypot(bw[0]-ex2[0],bw[1]-ex2[1],bw[2]-ex2[2])<1e-12,'13c : aimant retourné et déplacé : champ tourné avec lui');
    const two=[{m:disc,F:Id},{m:box,F:Fr}],s2=magFieldMulti(two,P1),a2=magFieldMulti([two[0]],P1),b2=magFieldMulti([two[1]],P1);
    A([0,1,2].every(j=>Math.abs(s2[j]-a2[j]-b2[j])<1e-12),'13d : deux aimants : les champs s’additionnent');
    // nord face au sud (attraction) : les lignes du premier entrent dans le second ; nord face au nord : non
    const pile=(gap,flip)=>[{m:disc,F:Id,on:true},{m:disc,on:false,F:flip?{o:[0,0,disc.h*2+gap],x:[1,0,0],y:[0,-1,0],z:[0,0,-1]}:{o:[0,0,disc.h+gap],x:[1,0,0],y:[0,1,0],z:[0,0,1]}}];
    const into=M=>{const L=magLinesMulti(M,{}).filter(T=>!T.back);return L.filter(T=>T.to===1).length/L.length;};
    const att=into(pile(4,false)),rep=into(pile(4,true));
    A(att>0.5&&rep<0.05,'13e : attraction : '+Math.round(att*100)+' % des lignes passent dans l’autre aimant ; répulsion : '+Math.round(rep*100)+' %');
    const t1=Date.now();magLinesMulti(pile(4,true),{});
    A(Date.now()-t1<1500,'13f : deux aimants : '+(Date.now()-t1)+' ms');
    // ── 6. pièce ──
    docResetEmpty();doc.name='Banc';
    const cyl=MAG_CAT.find(r=>r.s==='cyl'&&r.mat==='NdFeB');
    const sp=stdSpec('magnet',{shape:'cyl',grade:'*',art:cyl.code});
    const o1=(stdAddOcc(sp)||{}).occ,c1=o1&&asmComp(o1.comp);
    A(c1&&c1.doc.std.mag&&c1.doc.std.mag.Br===magBr(cyl)&&c1.doc.mat.rho===7.5,'14 : composant avec fiche aimant et masse volumique NdFeB');
    const o2=(stdAddOcc(sp)||{}).occ;
    A(o2&&o2.comp===o1.comp&&asm.comps.length===2,'15 : même article : nouvelle occurrence');
    A(!o1.mag&&magLinesFor(c1,[o1.id])===null,'16 : lignes masquées par défaut');
    A(magToggle(o1.id)===true&&o1.mag===true&&!o2.mag,'17 : le clic droit n’allume que cette occurrence');
    const txt=serialise(),b=JSON.parse(txt),t=asmTreeOfFile(b.doc||b),rt=t.comps.find(c=>c.occ.some(q=>q.id===o1.id));
    const ro=rt&&rt.occ.find(q=>q.id===o1.id),rc=t.comps.find(c=>c.id===o1.comp);
    A(ro&&ro.mag===true&&rc&&rc.doc.std.mag.code===cyl.code,'18 : relu du fichier : lignes affichées et fiche aimant');
    A(rc&&rc.doc.mat&&rc.doc.mat.rho===7.5,'18b : masse volumique relue du fichier');
    A(asmUndo()&&!asmOcc(o1.id).mag,'19 : Ctrl+Z masque à nouveau');
    A(magToggle(o1.id)===true&&magToggle(o1.id)===false&&!asmOcc(o1.id).mag,'20 : second clic : masqué');
    // ── 7. noyau exact ──
    const vols=()=>{const FR=occFinalShape(null);const v=FR.perBody.map(x=>occCoqueVolume(x.shape));occCleanup(FR,null);return v;};
    const root=asm.root;
    // + un pavé FIN (h/2 = 0,5 < 2×0,6) : la jonction des pôles ne doit pas être prise pour un bord extérieur
    const recs=MAG_SHAPES.map(([k])=>MAG_CAT.find(x=>x.s===k&&x.mat==='NdFeB'&&!x.dia)).concat(MAG_CAT.filter(x=>['Q-05-04-01-N','S-10-05-DN','CS-S-12-04-NR','CS-Q-40-20-04-N'].includes(x.code)));
    A(recs.length===MAG_SHAPES.length+4,'21a : pavé fin Q-05-04-01-N et disque diamétral S-10-05-DN présents au catalogue');
    // volume d'un profil de révolution (arcs {c} subdivisés), tour complet, par la formule des troncs de cône
    const profVol=P=>{const Q=[];P.forEach((q,i)=>{if(q[2]&&q[2].c&&i>0){const c=q[2].c,p0=P[i-1];let a0=Math.atan2(p0[1]-c[1],p0[0]-c[0]),a1=Math.atan2(q[1]-c[1],q[0]-c[0]);let da=a1-a0;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;const R=Math.hypot(q[0]-c[0],q[1]-c[1]);for(let j=1;j<=400;j++){const a=a0+da*j/400;Q.push([c[0]+R*Math.cos(a),c[1]+R*Math.sin(a)]);}}else Q.push([q[0],q[1]]);});
      let v=0;for(let i=0;i<Q.length;i++){const a=Q[i],b=Q[(i+1)%Q.length];v+=(a[0]*a[0]+a[0]*b[0]+b[0]*b[0])*(b[1]-a[1]);}return Math.abs(v)*Math.PI/3;};
    recs.forEach(r=>{
      const k=r.s;
      const S=stdSpec('magnet',{shape:k,grade:'*',art:r.code});
      const o=(stdAddOcc(S,root)||{}).occ;if(!o){A(false,S.name+' : insertion refusée');return;}
      asmActivate(o.comp);
      let v=[];try{v=vols();}catch(e){v=[];}
      if(r.cs){
        // V0.71.0 : aimant à visser = aimant plein arrondi (moitiés égales) moins le trou fraisé de chaque moitié
        const c=asmComp(o.comp),bs=c.doc.bodies,m=c.doc.std.mag,K=magRound(m);
        const Ac=K*K*(1-Math.PI/4),gc=(10-3*Math.PI)/(3*(4-Math.PI))*K;
        const plein=m.s==='cyl'?Math.PI*m.d*m.d/4*m.h-2*2*Math.PI*(m.d/2-gc)*Ac
          :(()=>{const a=m.a-2*K,b=m.b-2*K,cc=m.h-2*K;return a*b*cc+2*K*(a*b+b*cc+a*cc)+Math.PI*K*K*(a+b+cc)+4/3*Math.PI*K*K*K;})();
        const trou=(z0,z1)=>{let v=0;const n=4000;for(const H of m.holes)for(let i=0;i<n;i++){const z=z0+(z1-z0)*(i+.5)/n,ri=magHoleR(H,m.h,z);v+=Math.PI*ri*ri*(z1-z0)/n;}return v;};
        const exp=[plein/2-trou(0,m.h/2),plein/2-trou(m.h/2,m.h)];
        A(v.length===2&&v.every((x,i)=>Math.abs(x-exp[i])<=0.005*exp[i]),'21f : '+S.name+' ('+m.holes.length+' trou'+(m.holes.length>1?'s':'')+', fraisé côté '+(m.holes[0].top?'nord':'sud')+') : 2 moitiés '+v.map(x=>x.toFixed(3)).join(' + ')+' mm³, attendu '+exp.map(x=>x.toFixed(3)).join(' + '));
        A(bs.length===2&&bs[0].color===MAG_POLE_S&&bs[1].color===MAG_POLE_N,'21g : '+r.code+' : pôle sud vert, pôle nord rouge');
        asmActivate(root);return;
      }
      if(k==='cone'||r.dia){
        // V0.71.0 : cône (moitiés de hauteurs égales, volumes différents) ; diamétral (deux demi-disques)
        const c=asmComp(o.comp),bs=c.doc.bodies,m=c.doc.std.mag,K=magRound(m);
        const exp=r.dia?[1,1].map(()=>profVol([[0,0],[m.d/2-K,0],[m.d/2,K,{c:[m.d/2-K,K]}],[m.d/2,m.h-K],[m.d/2-K,m.h,{c:[m.d/2-K,m.h-K]}],[0,m.h]])/2)
          :[profVol(magHalfProf(m,0,m.h/2,K,true)),profVol(magHalfProf(m,m.h/2,m.h,K,false))];
        const brut=r.dia?Math.PI*r.d*r.d/4*r.h:Math.PI*r.h/12*(r.d*r.d+r.d*r.dt+r.dt*r.dt);
        A(v.length===2&&v.every((x,i)=>Math.abs(x-exp[i])<=0.005*exp[i])&&Math.abs(v[0]+v[1]-brut)<0.03*brut,'21c : '+S.name+' : 2 moitiés '+v.map(x=>x.toFixed(3)).join(' + ')+' mm³, attendu '+exp.map(x=>x.toFixed(3)).join(' + ')+' (sans arrondis '+brut.toFixed(3)+')');
        A(bs.length===2&&bs[0].color===MAG_POLE_S&&bs[1].color===MAG_POLE_N,'21d : '+r.code+' : pôle sud vert, pôle nord rouge');
        if(r.dia){
          // pôle nord du côté +Y : boîte englobante du corps « Pôle nord »
          const FR=occFinalShape(null),bb=FR.perBody.map(x=>{const b=new occt.Bnd_Box_1();occt.BRepBndLib.Add(x.shape,b,false);const lo=b.CornerMin(),hi=b.CornerMax(),out=[lo.Y(),hi.Y()];try{lo.delete();hi.delete();b.delete();}catch(e){}return {id:x.bodyId||x.body||x.id,y:out};});occCleanup(FR,null);
          A(bb.length===2&&bb.some(b=>b.y[0]>-1e-3)&&bb.some(b=>b.y[1]<1e-3),'21e : diamétral : un demi-disque côté +Y, l’autre côté −Y ('+JSON.stringify(bb.map(b=>b.y.map(v=>+v.toFixed(3))))+')');
        }
        asmActivate(root);return;
      }
      const ex=k==='cyl'?Math.PI*r.d*r.d/4*r.h:k==='ring'?Math.PI*(r.d*r.d-r.di*r.di)/4*r.h:r.a*r.b*r.h;
      // V0.70.0 : deux moitiés (sud vert, nord rouge), arêtes EXTÉRIEURES arrondies, jonction vive :
      // chaque moitié = la moitié de l'aimant entier arrondi partout
      const c=asmComp(o.comp),bs=c.doc.bodies,K=magRound(c.doc.std.mag);
      // volume exact de l'aimant arrondi : Pappus (coin ôté k²(1-π/4), centre à 0,2234 k du coin) ; pavé = boîte réduite ⊕ boule
      const Ac=K*K*(1-Math.PI/4),gc=(10-3*Math.PI)/(3*(4-Math.PI))*K;
      let full;
      if(k==='cyl'||k==='ring'){
        const R=r.d/2,r0=k==='ring'?r.di/2:0;
        full=Math.PI*(R*R-r0*r0)*r.h-2*2*Math.PI*(R-gc)*Ac-(k==='ring'?2*2*Math.PI*(r0+gc)*Ac:0);
      }else{
        const a=r.a-2*K,b=r.b-2*K,cc=r.h-2*K;
        full=a*b*cc+2*K*(a*b+b*cc+a*cc)+Math.PI*K*K*(a+b+cc)+4/3*Math.PI*K*K*K;
      }
      const half=full/2;
      A(v.length===2&&v.every(x=>Math.abs(x-half)<=0.005*half),'21 : '+S.name+' ('+k+') : 2 moitiés '+v.map(x=>x.toFixed(3)).join(' + ')+' mm³, attendu '+half.toFixed(3)+' chacune (R'+K+')');
      A(bs.length===2&&bs[0].color===MAG_POLE_S&&bs[1].color===MAG_POLE_N,'21b : '+k+' : pôle sud vert, pôle nord rouge');
      asmActivate(root);
    });
    return out;
  `;
  const o=await vm.runInContext('(async()=>{'+R+'})()',ctx);
  console.log('=== V0.57.0 : aimants permanents ===');
  (o.log||[]).forEach(m=>console.log('  ✓ '+m));
  if(o.fails&&o.fails.length){o.fails.forEach(m=>console.log('  ✗ '+m));console.log('\n*** '+o.fails.length+' PROBLEME(S) ***');process.exit(1);}
  console.log('\n*** TOUT PASSE ***');
})().catch(e=>{console.log('FATAL',String((e&&e.stack)||e).slice(0,1200));process.exit(1);});
