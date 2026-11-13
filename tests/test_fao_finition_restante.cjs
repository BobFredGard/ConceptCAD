// V0.99.1 : FINITION SUR LE BRUT RESTANT.
// Demande : « cette fonction de brut restant dans la Finition », « avec une option de marge
// pour aller un poil plus loin » ; « ne pas mettre de limite intérieure dans certains cas pour
// utiliser le brut restant » ; « être sûr que la fraise boule est bien passée partout sur la
// limite du brut restant ».
// Filtre faoRestFinish sur des passes connues : fond plat à z 5, passes parallèles à Y tous les
// 1 mm (x = 0…30), boule D4. Carte du brut restant : une bande de 0,5 mm au-dessus du fond pour
// x dans [10, 12] et y dans [30, 50] (ce qu'une boule plus grosse aurait laissé dans un congé).
//  1. seules les passes dont la boule enlève plus de « Ignorer moins de » sont gardées, et
//     seulement sur la longueur de la bande (+ marge) ;
//  2. marge : toute passe à moins de la marge (en 3D) d'un point qui enlève de la matière est
//     gardée — le long de la passe ET sur les passes voisines (la boule repasse sur tout le
//     bord de la bande) ; plus de marge = plus de passes ;
//  3. liaisons : montée au plan de sécurité, descente en avance au début du tronçon gardé —
//     aucun mouvement en avance hors des tronçons gardés ;
//  4. une passe entièrement sur la bande est gardée telle quelle (mêmes objets) ;
//  5. réglages et clé : finition « brut restant » reconnue, défauts 0,1 mm et 1 mm, clé qui
//     dépend des opérations précédentes.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx}=loadApp();
  const r=vm.runInContext(`(function(){
    const P=[]; const A=(ok,m)=>P.push((ok?'OK   ':'ECHEC')+' : '+m);
    const p=0.25,X0=-5,Y0=-5,nx=Math.ceil(110/p),ny=Math.ceil(90/p);
    const h=new Float32Array(nx*ny).fill(-1/0);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=X0+(i+0.5)*p,y=Y0+(j+0.5)*p;
      if(x>=10&&x<=12&&y>=30&&y<=50)h[j*nx+i]=5.5;}
    const M={grid:{h:h,nx:nx,ny:ny,x0:X0,y0:Y0,p:p}};
    const secu=30;
    const passes=function(){const mv=[{r:1,x:0,y:0,z:secu},{r:1,x:0,y:0,z:6},{r:0,ent:1,x:0,y:0,z:5}];
      for(let k=0;k<=30;k++){const x=k,y0=(k%2)?80:0,y1=(k%2)?0:80;
        if(k>0)mv.push({r:0,tr:1,x:x,y:y0,z:5});
        for(let q=1;q<=8;q++)mv.push({r:0,x:x,y:y0+(y1-y0)*q/8,z:5});}
      mv.push({r:1,x:30,y:80,z:secu});return mv;};
    const tool={kind:'ball',d:4,cornerR:2};
    const run=function(marge){return faoRestFinish(passes(),M,tool,4,0.1,marge,secu);};
    // tronçons coupés : [ymin, ymax] par passe x
    const kept=function(mv){const K={};
      for(let i=1;i<mv.length;i++){const a=mv[i-1],b=mv[i];if(a.r||b.r||b.ent||b.tr)continue;
        if(Math.abs(a.x-b.x)>1e-9)continue;const x=Math.round(a.x);
        const L=K[x]||(K[x]=[1/0,-1/0]);L[0]=Math.min(L[0],a.y,b.y);L[1]=Math.max(L[1],a.y,b.y);}
      return K;};
    const show=function(K){return Object.keys(K).sort(function(a,b){return a-b;}).map(function(x){return x+':['+K[x][0].toFixed(1)+','+K[x][1].toFixed(1)+']';}).join(' ');};
    const m0=run(0),m1=run(1),m4=run(4);
    const K0=kept(m0),K1=kept(m1),K4=kept(m4);
    P.push('  · marge 0 : '+show(K0));
    P.push('  · marge 1 : '+show(K1)+' (gardé '+m1.restKeep+' %)');
    P.push('  · marge 4 : '+show(K4));
    const xs=function(K){return Object.keys(K).map(Number).sort(function(a,b){return a-b;});};
    // 1. marge 0 : passes x = 9…13 (la boule D4 enlève plus de 0,1 mm à moins de ~1,2 mm de la bande)
    A(xs(K0).join(',')==='9,10,11,12,13','marge 0 : seules les passes qui enlèvent de la matière (x = '+xs(K0).join(',')+')');
    A(xs(K0).every(function(x){return K0[x][0]>=27&&K0[x][1]<=53;}),'marge 0 : coupe seulement le long de la bande (y ≈ 30…50)');
    // 2. marge : passes voisines et prolongement
    A(xs(K1).join(',')==='8,9,10,11,12,13,14','marge 1 : la passe voisine de chaque côté est reprise (x = '+xs(K1).join(',')+')');
    A(K1[11]&&K0[11]&&K1[11][0]<K0[11][0]-0.9&&K1[11][1]>K0[11][1]+0.9,'marge 1 : la passe est prolongée de part et d’autre');
    A(xs(K4).length>xs(K1).length&&xs(K4)[0]<=5&&xs(K4)[xs(K4).length-1]>=17,'marge 4 : encore plus loin (x = '+xs(K4)[0]+'…'+xs(K4)[xs(K4).length-1]+')');
    // 3. liaisons : aucune coupe hors des tronçons gardés, montée au plan de sécurité entre tronçons
    let bad=0,lifts=0;
    for(let i=1;i<m1.length;i++){const a=m1[i-1],b=m1[i];
      if(b.r&&Math.abs(b.z-secu)<1e-9&&a.z<secu-1)lifts++;
      if(a.r||b.r)continue;const x=Math.round((a.x+b.x)/2),y=(a.y+b.y)/2;
      if(Math.abs(a.x-b.x)<1e-9&&!(K1[x]&&y>=K1[x][0]-1e-6&&y<=K1[x][1]+1e-6))bad++;}
    A(bad===0,'aucun mouvement en avance hors des tronçons gardés ('+bad+')');
    A(lifts>=6,'remontées entre les tronçons ('+lifts+')');
    let plunge=0;for(let i=1;i<m1.length;i++)if(m1[i].ent&&m1[i-1].r&&Math.abs(m1[i-1].z-m1[i].z-1)<1e-9)plunge++;
    A(plunge>=6,'descente en avance de 1 mm au début de chaque tronçon ('+plunge+')');
    // 4. bande sur toute la longueur : passe gardée telle quelle
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=X0+(i+0.5)*p;if(x>=10&&x<=12)h[j*nx+i]=5.5;}
    const src=passes(),mF=faoRestFinish(src,M,tool,4,0.1,0,secu);
    let same=0;for(let i=0;i<mF.length;i++)if(src.indexOf(mF[i])>=0&&!mF[i].r&&Math.round(mF[i].x)===11)same++;
    A(same>=8,'passe entièrement sur la bande : gardée telle quelle ('+same+' mouvements)');
    // 5. réglages et clé
    const op={id:'f',type:'geofinish',brut:'restant'};
    A(faoRestOn(op)&&faoRestIgnore(op)===0.1&&faoRestMarge(op)===1,'finition « brut restant » : défauts 0,1 mm et marge 1 mm');
    A(!faoRestOn({type:'geofinish'})&&faoRestIgnore({type:'rough3d'})===0.25,'finition sur le brut du posage, ébauche : inchangées');
    const og={id:'g',type:'geodesic',brut:'restant'};
    A(faoRestOn(og)&&faoRestIgnore(og)===0.1&&faoRestMarge(og)===1&&!faoRestOn({type:'geodesic'}),'géodésique « brut restant » (V0.99.2) : mêmes défauts ; sans le réglage, inchangée');
    bodies.length=0;
    const s=faoDefaultSetup(); s.stock={x0:0,y0:0,z0:0,x1:100,y1:80,z1:20};
    s.tools=[{id:'T1',num:1,name:'D10',kind:'flat',d:10,cornerR:0,flutes:2,vc:200,fz:0.05},
             {id:'T2',num:2,name:'Boule D4',kind:'ball',d:4,cornerR:2,flutes:2,vc:200,fz:0.03}];
    s.ops=[{id:'p1',on:true,toolId:'T1',type:'facing',z:15,ae:6},
           {id:'f4',on:true,toolId:'T2',type:'geofinish',step:1,laisse:0,ztop:20,zbot:0,traj:'parallel',brut:'restant'}];
    doc.fao={setups:[s],activeSetupId:s.id};
    faoSanitiseOps(s);
    const kR=faoRestDep(s.ops[1],s);
    s.ops[0].z=14; const kR2=faoRestDep(s.ops[1],s); s.ops[0].z=15; const kR3=faoRestDep(s.ops[1],s);
    A(kR&&kR2&&JSON.stringify(kR)!==JSON.stringify(kR2)&&JSON.stringify(kR)===JSON.stringify(kR3),'clé de la finition « brut restant » : suit les opérations précédentes (et revient)');
    return P;
  })()`,ctx);
  r.forEach(function(l){console.log(l);});
  const ko=r.filter(function(l){return l.indexOf('ECHEC')===0;}).length;
  console.log(ko?('test_fao_finition_restante : '+ko+' ÉCHEC(S)'):'test_fao_finition_restante : OK');
  process.exit(ko?1:0);
})().catch(function(e){console.error(e);process.exit(1);});
