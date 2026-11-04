// V0.57.0 : aimants permanents (48-aimants-*). Le champ calculé retrouve les valeurs publiées par un
// fabricant et une intégration numérique indépendante ; le catalogue est sain ; un aimant s'insère
// comme une pièce normalisée, sa géométrie exacte a le bon volume, ses lignes de champ s'affichent
// par occurrence, s'enregistrent et s'annulent.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
globalThis.__dirname=path.join(ROOT,'occt');
vm.runInThisContext(fs.readFileSync(path.join(ROOT,'occt','opencascade.full.js'),'utf8'),{filename:'occt.js'});
const {loadApp}=require('./appvm.cjs');
(async()=>{
  const real=await globalThis.opencascadeFactory({wasmBinary:fs.readFileSync(path.join(ROOT,'occt','opencascade.wasm.wasm'))});
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
      const d=r.s==='cyl'?[r.d,r.h]:r.s==='ring'?[r.d,r.di,r.h]:[r.a,r.b,r.h];
      if(!d.every(v=>v>0&&isFinite(v)))return true;
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
    const hole=magLines(ring).some(T=>T.closed&&T.pts.some(p=>Math.abs(p[2]-2.5)<0.5&&Math.hypot(p[0],p[1])<5));
    A(hole,'12 : anneau : des lignes passent par le trou');
    const t0=Date.now();magLines(disc);magLines(ring);magLines(box);
    A(Date.now()-t0<2000,'13 : lignes des trois aimants : '+(Date.now()-t0)+' ms');
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
    MAG_SHAPES.forEach(([k])=>{
      const r=MAG_CAT.find(x=>x.s===k&&x.mat==='NdFeB');
      const S=stdSpec('magnet',{shape:k,grade:'*',art:r.code});
      const o=(stdAddOcc(S,root)||{}).occ;if(!o){A(false,S.name+' : insertion refusée');return;}
      asmActivate(o.comp);
      let v=[];try{v=vols();}catch(e){v=[];}
      const ex=k==='cyl'?Math.PI*r.d*r.d/4*r.h:k==='ring'?Math.PI*(r.d*r.d-r.di*r.di)/4*r.h:r.a*r.b*r.h;
      A(v.length===1&&Math.abs(v[0]-ex)<=Math.max(0.01*ex,0.05),'21 : '+S.name+' ('+k+') : '+(v[0]||0).toFixed(2)+' mm³, attendu '+ex.toFixed(2));
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
