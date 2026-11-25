/* ================================================================
   CONTOUR 2.5D sur ARÊTES DU MODÈLE (2026-10-14-004)
   ----------------------------------------------------------------
   Profil = boucle XY d'une chaîne d'arêtes (op.limit, sélection
   faoChainStart) ; le contour n'est PAS une zone : la passe suit le
   profil, décalée du rayon outil du côté LIBRE.
   - côté auto : la matière est cherchée dans la section du solide à
     mi-hauteur (parité) — dedans = bossage (outil dehors), dehors =
     poche (outil dedans) ; forçable (op.cside 'ext' / 'int') ;
   - passes radiales (n, écart ae) puis finition à pleine hauteur
     (surépaisseur op.fin) ; descente en Z : « Paliers » (niveaux ap,
     défaut) ou « Pente » (V0.23.18, op.descente 'pente') — l'outil attaque
     le contour en haut et descend en hélice le long de la boucle
     jusqu'au plan final, puis un tour à plat ;
     V0.99.88 : plus d'angle (op.pente, °) — op.penteTour = descente par tour (mm),
     proposée à 10 % du Ø (0,5 mm au moins), « Rampe » dans la fiche ;
   - sens avalant (matière à droite de l'avance, broche M3) ou opposé ;
   - entrée / sortie en quart de cercle tangent côté libre,
     recouvrement en fin de boucle ;
   - attaches (tabs) : n ponts de largeur W et hauteur H au-dessus du
     bas, l'outil passe par-dessus (montée/descente verticales).
   ================================================================ */
function faoContourProfil(op){ return !!(op&&op.type==='contour'&&op.strat==='profil'); }

// Abscisse curviligne du projeté de (x,y) sur la boucle fermée (cum = longueurs cumulées).
function faoLoopParam(loop,cum,x,y){
  let bd=1/0,bs=0;
  for(let i=0;i+1<loop.length;i++){
    const A=loop[i],B=loop[i+1],dx=B[0]-A[0],dy=B[1]-A[1],l2=dx*dx+dy*dy;
    let t=l2>0?((x-A[0])*dx+(y-A[1])*dy)/l2:0;if(t<0)t=0;else if(t>1)t=1;
    const qx=A[0]+dx*t-x,qy=A[1]+dy*t-y,d=qx*qx+qy*qy;
    if(d<bd){bd=d;bs=cum[i]+Math.sqrt(l2)*t;}
  }
  return bs;
}

function faoGenContourProfil(mesh,loop0,o){
  o=o||{};
  const moves=[];
  const diag={side:null,levels:0,passes:0,tabs:0};
  try{moves.diag=diag;}catch(e){}
  if(!loop0||loop0.length<4)return moves;
  const D=isFinite(+o.toolD)&&+o.toolD>0?+o.toolD:10, r=D/2;
  const RA=faoRA(o);
  const secu=isFinite(+o.secu)?+o.secu:5;
  const ztop=+o.ztop, zbot=+o.zbot;
  if(!(isFinite(ztop)&&isFinite(zbot))||!(ztop>zbot+1e-9))return moves;
  // boucle fermée, sens trigo (CCW)
  let loop=loop0.map(function(p){return [+p[0],+p[1]];});
  {const a=loop[0],b=loop[loop.length-1];
    if(Math.hypot(a[0]-b[0],a[1]-b[1])>1e-6)loop.push([a[0],a[1]]);}
  let ar=0;for(let i=0;i+1<loop.length;i++)ar+=loop[i][0]*loop[i+1][1]-loop[i+1][0]*loop[i][1];
  if(ar<0)loop=loop.slice().reverse();
  // V0.99.96 : congés et arcs de la chaîne retrouvés et re-découpés sur le VRAI cercle avant le
  // décalage ; leurs centres (et ceux des coins vifs) servent ensuite aux blocs G2 / G3
  // (faoFitArcsMoves, src/89-fao-arcs.js) — o.arcs === false : boucle telle quelle
  let arcC=null;
  if(o.arcs!==false){
    try{ const DA=faoLoopArcDense(loop); if(DA&&DA.loop&&DA.loop.length>=4){ loop=DA.loop; arcC=DA.centers; diag.arcsBoucle=DA.arcs; } }catch(e){ arcC=null; }
  }
  const arcCk=new Set();
  const arcCAdd=function(c){ if(!arcC||!c)return; const k=c[0].toFixed(4)+','+c[1].toFixed(4); if(arcCk.has(k))return; arcCk.add(k); arcC.push({x:c[0],y:c[1],ex:1}); };
  try{ moves.arcC=arcC; }catch(e){}
  // --- côté matière : section à mi-hauteur, parité de part et d'autre
  let side=o.side==='ext'||o.side==='int'?o.side:null;
  if(!side&&mesh){
    // o.zSide : cote de section imposée (chanfrein 3D : sous l'arête la plus basse)
    const zm=isFinite(+o.zSide)?+o.zSide:Math.max(zbot+0.05,Math.min(ztop-0.05,(ztop+zbot)/2));
    const segs=faoSliceZCached(mesh,Math.round(zm*1000)/1000);
    let vin=0,vout=0;
    const n=loop.length-1,stp=Math.max(1,Math.floor(n/24));
    for(let i=0;i<n;i+=stp){
      const A=loop[i],B=loop[i+1],dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy);
      if(!(L>1e-6))continue;
      const mx=(A[0]+B[0])/2,my=(A[1]+B[1])/2,nx=-dy/L,ny=dx/L; // gauche = dedans (CCW)
      const e=Math.min(0.2,r*0.2);
      if(faoSliceHit(segs,mx+nx*e,my+ny*e,0))vin++;
      if(faoSliceHit(segs,mx-nx*e,my-ny*e,0))vout++;
    }
    side=vin>vout?'ext':(vout>vin?'int':'ext');
  }
  if(!side)side='ext';
  diag.side=side;
  // offset côté libre : ext = à droite d'une boucle CCW (faoOffsetChain side +1)
  const oside=side==='ext'?1:-1;
  const dFin=r+RA.radial;
  const fin=isFinite(+o.fin)&&+o.fin>0?+o.fin:0;
  const nR=Math.max(1,Math.min(20,Math.round(isFinite(+o.nR)?+o.nR:1)));
  const aeR=isFinite(+o.ae)&&+o.ae>0?+o.ae:D*0.4;
  const offs=[];for(let k=nR-1;k>=0;k--)offs.push(dFin+fin+k*aeR);
  // sens : avalant = matière à DROITE de l'avance (broche M3, G41)
  const climb=o.sens!=='opp';
  const ccw=(side==='int')===climb; // int + avalant -> CCW ; ext + avalant -> CW
  // longueurs cumulées de la boucle (attaches)
  const cum=[0];for(let i=1;i<loop.length;i++)cum.push(cum[i-1]+Math.hypot(loop[i][0]-loop[i-1][0],loop[i][1]-loop[i-1][1]));
  const Ltot=cum[cum.length-1];
  const tabN=Math.max(0,Math.min(50,Math.round(+o.tabN||0)));
  const tabW=isFinite(+o.tabW)&&+o.tabW>0?+o.tabW:5;
  const tabZ=zbot+(isFinite(+o.tabH)&&+o.tabH>0?+o.tabH:2);
  const tabC=[];for(let i=0;i<tabN;i++)tabC.push((i+0.5)*Ltot/tabN);
  diag.tabs=tabN;
  const inTab=function(x,y){
    if(!tabN)return false;
    const s=faoLoopParam(loop,cum,x,y),half=tabW/2+r;
    for(let i=0;i<tabC.length;i++){let d=Math.abs(s-tabC[i]);d=Math.min(d,Ltot-d);if(d<=half)return true;}
    return false;
  };
  // passe décalée à d : morceaux valides (à >= d−0,01 du profil), sens voulu
  const passAt=function(d){
    const P=faoOffsetChain(loop,d,oside);
    if(!P)return [];
    const runs=faoSplitValid(P,function(p){return faoDistToPoly(p[0],p[1],loop)>=d-0.01;});
    const out=[];
    runs.forEach(function(run){
      let R=run.slice();
      // polygone entier valide : refermé
      if(run===P||run.length===P.length)R.push([R[0][0],R[0][1]]);
      let a2=0;for(let i=0;i+1<R.length;i++)a2+=R[i][0]*R[i+1][1]-R[i+1][0]*R[i][1];
      const closed=Math.hypot(R[0][0]-R[R.length-1][0],R[0][1]-R[R.length-1][1])<1e-6;
      if(closed&&((a2>0)!==ccw))R.reverse();
      if(!closed&&!ccw)R.reverse();
      // droites échantillonnées à 0,25 mm par l'offset : simplifiées (écart 2 µm)
      R=faoSimplifyPts(R,0.002);
      if(R.length>=2)out.push({pts:R,closed:closed});
    });
    return out;
  };
  const leadR=Math.max(0.5,isFinite(+o.leadR)&&+o.leadR>0?+o.leadR:Math.min(5,Math.max(1,D*0.6)));
  const overlap=isFinite(+o.overlap)&&+o.overlap>=0?+o.overlap:1;
  const zClear=Math.min(secu,Math.max(ztop,zbot)+2);
  const rnd=function(v){return Math.round(v*10000)/10000;};
  let cur=null;
  const push=function(m){m.x=rnd(m.x);m.y=rnd(m.y);m.z=rnd(m.z);moves.push(m);cur=m;};
  // côté libre d'un point de passe (normale vers l'extérieur de la matière)
  // t = tangente unitaire de l'avance ; avalant : matière à droite, libre à gauche
  const freeN=function(t){ return climb?[-t[1],t[0]]:[t[1],-t[0]]; };
  // arc tangent (polyligne) : entrée de A vers P0 / sortie de P1 vers B
  const arcPts=function(P,t,nf,R,isIn){
    const C=[P[0]+nf[0]*R,P[1]+nf[1]*R],pts=[];
    const N=8;
    for(let k=0;k<=N;k++){const th=k/N*Math.PI/2;
      if(isIn)pts.push([C[0]-R*(t[0]*Math.cos(th)+nf[0]*Math.sin(th)),C[1]-R*(t[1]*Math.cos(th)+nf[1]*Math.sin(th))]);
      else pts.push([C[0]+R*(-nf[0]*Math.cos(th)+t[0]*Math.sin(th)),C[1]+R*(-nf[1]*Math.cos(th)+t[1]*Math.sin(th))]);}
    pts.c=C; // V0.99.96 : centre de l'entrée / sortie (bloc G2 / G3)
    return pts;
  };
  const arcOK=function(pts,d){
    for(let k=0;k<pts.length;k++)if(faoDistToPoly(pts[k][0],pts[k][1],loop)<Math.min(d,r)-0.01)return false;
    return true;
  };
  // une passe (morceau) à la cote z : entrée, boucle (+recouvrement), sortie
  // ramp (Pente) : {z0 : cote d'attaque, k : tan(angle)} — z = plan final
  const emitRun=function(run,z,d,ramp){
    let pts=run.pts;
    // départ : point le plus proche de la position courante (boucle fermée)
    if(run.closed&&cur){
      let bi=0,bd=1/0;
      for(let i=0;i+1<pts.length;i++){const q=(pts[i][0]-cur.x)*(pts[i][0]-cur.x)+(pts[i][1]-cur.y)*(pts[i][1]-cur.y);if(q<bd){bd=q;bi=i;}}
      const body=pts.slice(bi,pts.length-1).concat(pts.slice(0,bi));
      pts=body.concat([[body[0][0],body[0][1]]]);
    }
    // Pente : hélice le long de la boucle de z0 à z (longueur (z0−z)/k), puis
    // un tour complet à plat + recouvrement ; pts portent leur z ([x,y,z])
    if(ramp&&run.closed&&ramp.z0>z+1e-9){
      const B=pts;let Lb=0;for(let i=1;i<B.length;i++)Lb+=Math.hypot(B[i][0]-B[i-1][0],B[i][1]-B[i-1][1]);
      if(Lb>1e-6){
        // V0.99.88 (« enlever la pente partout… et remplacer toutes ces pentes par des mm/tour ») :
        // descente de ramp.tour mm à chaque tour de CETTE boucle (périmètre Lb), plus d'angle
        const k=ramp.tour/Lb;
        const Lr=(ramp.z0-z)/k,total=Lr+Lb+overlap;
        const zAt=function(t){return Math.max(z,ramp.z0-k*t);};
        // tours de la passe (la dernière émise = la plus proche de la paroi) pour la fiche
        diag.rampe={tour:ramp.tour,tours:+(Lr/Lb).toFixed(1)};
        const P3=[[B[0][0],B[0][1],ramp.z0]];let t=0;
        while(t<total-1e-9){
          for(let i=1;i<B.length&&t<total-1e-9;i++){
            const a=B[i-1],b=B[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
            if(!(l>0))continue;
            // fin de la rampe au milieu d'un segment : point exact au plan final
            if(t<Lr-1e-9&&t+l>Lr+1e-9&&t+l<total){const u=(Lr-t)/l;P3.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,z]);}
            if(t+l>=total){const u=(total-t)/l;P3.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,z]);t=total;break;}
            t+=l;P3.push([b[0],b[1],zAt(t)]);
          }
        }
        pts=P3;
      }else ramp=null;
    }else ramp=null;
    // recouvrement
    if(!ramp&&run.closed&&overlap>0){
      let acc=0;
      for(let i=1;i<pts.length&&acc<overlap;i++){
        const a=pts[i-1],b=pts[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
        if(acc+l>=overlap){const u=(overlap-acc)/l;pts=pts.concat([[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]]);acc=overlap;break;}
        pts=pts.concat([[b[0],b[1]]]);acc+=l;
      }
    }
    const tan=function(a,b){const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [(b[0]-a[0])/l,(b[1]-a[1])/l];};
    const t0=tan(pts[0],pts[1]),t1=tan(pts[pts.length-2],pts[pts.length-1]);
    const nf0=freeN(t0),nf1=freeN(t1);
    let lin=null,lout=null;
    for(let R=leadR;R>=0.5&&!lin;R*=0.6){const a=arcPts(pts[0],t0,nf0,R,true);if(arcOK(a,d))lin=a;}
    for(let R=leadR;R>=0.5&&!lout;R*=0.6){const a=arcPts(pts[pts.length-1],t1,nf1,R,false);if(arcOK(a,d))lout=a;}
    if(lin)arcCAdd(lin.c);
    if(lout)arcCAdd(lout.c);
    const S=lin?lin[0]:pts[0];
    // approche : dégagement, rapide au-dessus du départ, plongée en avance
    if(!cur){push({r:1,x:S[0],y:S[1],z:secu});if(zClear<secu-1e-9)push({r:1,x:S[0],y:S[1],z:zClear});}
    else{
      if(cur.z<zClear-1e-9)push({r:1,x:cur.x,y:cur.y,z:zClear});
      push({r:1,x:S[0],y:S[1],z:zClear});
    }
    const zS=ramp?ramp.z0:z;
    const zIn=(lin&&inTab(S[0],S[1])&&zS<tabZ)?tabZ:zS;
    push({r:0,ent:1,x:S[0],y:S[1],z:zIn});
    // Pente : z varie à chaque point — bascule d'attache suivie par drapeau
    let clipOn=zIn>zS+1e-9,rawZ=zS;
    const cutRamp=function(x,y,ent,zp){
      const tb=zp<tabZ&&inTab(x,y),zz=tb?tabZ:zp;
      if(cur&&!cur.r&&tb!==clipOn&&inTab(x,y)!==inTab(cur.x,cur.y)){
        let A=[cur.x,cur.y],B=[x,y];
        for(let it=0;it<20;it++){const m=[(A[0]+B[0])/2,(A[1]+B[1])/2];if(inTab(m[0],m[1])===clipOn)A=m;else B=m;}
        const q=clipOn?B:A,L=Math.hypot(x-cur.x,y-cur.y);
        const zq=L>1e-9?rawZ+(zp-rawZ)*Math.hypot(q[0]-cur.x,q[1]-cur.y)/L:zp;
        if(clipOn){push({r:0,ent:ent,x:q[0],y:q[1],z:tabZ});if(zq<tabZ)push({r:0,ent:ent,x:q[0],y:q[1],z:zq});}
        else{push({r:0,ent:ent,x:q[0],y:q[1],z:zq});if(zq<tabZ)push({r:0,ent:ent,x:q[0],y:q[1],z:tabZ});}
      }
      push({r:0,ent:ent,x:x,y:y,z:zz});clipOn=tb;rawZ=zp;
    };
    const cutPt=function(x,y,ent,zp){
      if(ramp){cutRamp(x,y,ent,zp);return;}
      const zz=(z<tabZ&&inTab(x,y))?tabZ:z;
      if(cur&&!cur.r&&Math.abs(cur.z-zz)>1e-9){
        // bord d'attache : marche verticale au point de bascule (dichotomie)
        let A=[cur.x,cur.y],B=[x,y];const sA=cur.z>z+1e-9;
        for(let it=0;it<20;it++){const m=[(A[0]+B[0])/2,(A[1]+B[1])/2];if(inTab(m[0],m[1])===sA)A=m;else B=m;}
        const q=sA?B:A;
        push({r:0,ent:ent,x:q[0],y:q[1],z:cur.z});
        push({r:0,ent:ent,x:q[0],y:q[1],z:zz});
      }
      push({r:0,ent:ent,x:x,y:y,z:zz});
    };
    if(lin)for(let k=1;k<lin.length;k++)cutPt(lin[k][0],lin[k][1],1,zS);
    for(let k=1;k<pts.length;k++)cutPt(pts[k][0],pts[k][1],0,ramp?pts[k][2]:z);
    if(lout)for(let k=1;k<lout.length;k++)cutPt(lout[k][0],lout[k][1],1,z);
    diag.passes++;
  };
  const levels=faoLevels(ztop,zbot+RA.axial,isFinite(+o.ap)&&+o.ap>0?+o.ap:5);
  diag.levels=levels.length;
  const passes=offs.map(passAt);
  if(o.descente==='pente'){
    // Pente : chaque passe latérale descend d'un trait jusqu'au plan final ;
    // un morceau OUVERT (profil coupé) ne peut pas tourner : repli en paliers
    // V0.99.88 : o.penteTour = descente par tour (mm) ; absent = valeur proposée (faoPasTourAuto)
    const tour=isFinite(+o.penteTour)&&+o.penteTour>0?Math.max(0.01,Math.min(100,+o.penteTour)):faoPasTourAuto(D);
    const ramp={z0:ztop,tour:tour},zf=zbot+RA.axial;
    diag.penteTour=tour;
    passes.forEach(function(runs,k){runs.forEach(function(run){
      if(run.closed)emitRun(run,zf,offs[k],ramp);
      else levels.forEach(function(z){emitRun(run,z,offs[k]);});
    });});
  }else levels.forEach(function(z){
    passes.forEach(function(runs,k){runs.forEach(function(run){emitRun(run,z,offs[k]);});});
  });
  // finition à pleine hauteur (surépaisseur fin enlevée d'un coup au fond)
  if(fin>0){
    const zf=zbot+RA.axial;
    passAt(dFin).forEach(function(run){emitRun(run,zf,dFin);});
  }
  if(cur)push({r:1,x:cur.x,y:cur.y,z:secu});
  return moves;
}

/* ----- V0.99.18 : RAPIDE DANS LE VIDE (demande de Fred : « si la fraise se trouve dans le
   vide, aller au prochain point d'entrée en matière en rapide »). Le vide = hors du brut
   (boîte ou corps-brut) ET là où les opérations précédentes du posage ont déjà enlevé la
   matière (même carte que le brut restant de l'ébauche 3D, faoRestMap). Case de la fiche
   « Rapide dans le vide » (op.sautVide, absent = coché, false = décoché). */
function faoContourVideOn(op){ return faoContourProfil(op)&&op.sautVide!==false; }
function faoContourMatFn(op,job,D,radial,fin){
  // Prédicat mat(x,y,z) : de la matière au-dessus de z sous le disque d'outil élargi d'une
  // garde (r + garde). La garde couvre la laisse de la passe et l'écart de la carte : la
  // passe la plus proche de la paroi touche toujours la pièce, elle n'est jamais sautée.
  const r=D/2;
  let R=null;
  try{ R=faoRestMap(op,job,D,radial); }catch(e){ R=null; }
  let T=null;
  try{ T=faoStockTop(job,1); }catch(e){ T=null; }
  if(!(R&&R.grid)&&!T)return null;
  const gp=R&&R.grid?R.grid.p:(T?T.g:0.5);
  const s=Math.max(0.5,2*gp)+Math.max(0,+radial||0)+Math.max(0,+fin||0);
  let fR=null,fT=null;
  if(R&&R.grid){
    const G=R.grid,dil=faoRestDilate(G.h,G.nx,G.ny,r+s,G.p);
    fR=function(x,y){const i=Math.floor((x-G.x0)/G.p),j=Math.floor((y-G.y0)/G.p);
      if(i<0||j<0||i>=G.nx||j>=G.ny)return -1/0;return dil[j*G.nx+i];};
  }
  if(T){ try{ fT=T.dil(r+s); }catch(e){ fT=null; } }
  const tol=0.02;
  return function(x,y,z){
    if(fR&&!(fR(x,y)>z+tol))return false;
    if(fT&&!(fT(x,y)>z+tol))return false;
    return true;
  };
}
function faoContourTrimAir(mv,mat,D){
  // Chaque suite de coupes (entre deux rapides) est échantillonnée à 0,5 mm : un tronçon où
  // l'outil ne touche aucune matière devient une liaison — rapide jusqu'au-dessus du
  // prochain point d'entrée en matière, puis descente en avance d'1 mm (les liaisons du
  // posage relèvent ensuite ce rapide au plan de retrait ou au retrait minimum). On garde
  // 1 mm de coupe avant la matière et après elle. Vide au début : la plongée se fait
  // directement avant la matière ; vide à la fin : la passe s'arrête après la matière ;
  // passe entièrement dans le vide : supprimée.
  if(!Array.isArray(mv)||mv.length<3||typeof mat!=='function')return mv;
  const st=0.5,mg=1,Lmid=Math.max(10,2*D),Lend=1;
  const out=[];let nSaut=0,nVide=0;
  let i=0;
  while(i<mv.length){
    if(mv[i].r||i===0){out.push(mv[i]);i++;continue;}
    let j=i;while(j<mv.length&&!mv[j].r)j++;
    // chaîne : départ mv[i-1], coupes mv[i..j-1] ; échantillons {x,y,z,d,k,end}
    const S=[];let cum=0;
    const p0=mv[i-1];S.push({x:+p0.x,y:+p0.y,z:+p0.z,d:0,k:i-1,end:true});
    for(let k=i;k<j;k++){
      const a=mv[k-1],b=mv[k],L=Math.hypot(b.x-a.x,b.y-a.y),ns=L>1e-9?Math.max(1,Math.ceil(L/st)):1;
      for(let q=1;q<=ns;q++){const t=q/ns;
        S.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,d:cum+L*t,k:k,end:q===ns});}
      cum+=L;
    }
    const air=S.map(function(q){return !mat(q.x,q.y,q.z);});
    // intervalles sautés [s1, s2] en indices d'échantillons : coupe jusqu'à s1, rapide à s2
    const skips=[];const last=S.length-1;
    for(let a=0;a<=last;){
      if(!air[a]){a++;continue;}
      let b=a;while(b<last&&air[b+1])b++;
      const lead=a===0,trail=b===last;
      if(lead&&trail){skips.push([0,last,'tout']);}
      else{
        const d1=lead?0:S[a].d+mg,d2=trail?S[last].d:S[b].d-mg;
        if(d2-d1>=(lead||trail?Lend:Lmid)){
          let s1=a,s2=b;
          if(!lead){while(s1<b&&S[s1].d<d1)s1++;}else s1=0;
          if(!trail){while(s2>s1&&S[s2].d>d2)s2--;}else s2=last;
          if(s2>s1)skips.push([s1,s2,lead?'debut':(trail?'fin':'milieu')]);
        }
      }
      a=b+1;
    }
    if(!skips.length){for(let k=i;k<j;k++)out.push(mv[k]);i=j;continue;}
    if(skips[0][2]==='tout'){nVide++;i=j;continue;}
    let si=0;
    for(let s=1;s<=last;s++){
      const sk=skips[si];
      if(sk&&s>sk[0]&&s<=sk[1]){
        if(s===sk[1]){
          // fin du vide : rapide au-dessus, descente en avance (sauf fin de passe)
          if(sk[2]!=='fin'){const q=S[s];
            out.push({r:1,x:q.x,y:q.y,z:q.z+1});
            out.push({r:0,ent:1,x:q.x,y:q.y,z:q.z});}
          nSaut++;si++;
        }
        continue;
      }
      const q=S[s],m=mv[q.k];
      if(q.end)out.push(m);
      else if(sk&&s===sk[0]){const o2={r:0,x:q.x,y:q.y,z:q.z};if(m.ent)o2.ent=m.ent;out.push(o2);}
    }
    i=j;
  }
  for(const k in mv)if(!/^\d+$/.test(k))out[k]=mv[k];
  out.vide={sauts:nSaut,passes:nVide};
  return out;
}

// Fiche du contour sur profil : sections Profil, Hauteurs, Passes, Côté et
// sens, Entrée/sortie, Attaches, Matière à laisser.
function faoContourRows(d,setup,op){
  const toolD=(function(){const t=faoToolById(setup,op.toolId);return t&&+t.d>0?+t.d:10;})();
  const slot=faoToolIsSlot(faoToolById(setup,op.toolId)); // V0.99.85 : fraise 3 tailles → rainure
  d.appendChild(faoH('Profil'));
  const L=(op.limit&&op.limit.mode==='chain')?op.limit:null;
  const has=!!(L&&(L.loop||[]).length>=3);
  const rc=faoRow();
  const info=document.createElement('span'); info.className='fao-meta';
  const gd=op.geoDiag||{};
  info.textContent=has
    ?(L.nEdges||'?')+' arête(s), boucle '+(L.closed?'fermée':'refermée')+
      (gd.side?' · outil '+(gd.side==='ext'?'à l’EXTÉRIEUR (bossage)':'à l’INTÉRIEUR (poche)'):'')
    :(slot?'aucun contour — cliquez les arêtes du contour à rainurer (Bas = la plus basse)':'aucun profil — cliquez les arêtes du BAS de la paroi');
  rc.appendChild(info);
  const bs=document.createElement('button'); bs.textContent=has?'Re-sélectionner':'Sélectionner le profil';
  bs.style.fontSize='.72rem';
  bs.title='Cliquez les arêtes du bas de la paroi à contourner : Bas = cette arête, Haut = dessus du brut. Le côté de l’outil est déduit de la matière.';
  bs.onclick=function(){
    if(!op.limit||op.limit.mode!=='chain')op.limit={mode:'chain',loop:[],closed:false,nEdges:0,tangent:true,side:'center',extra:0};
    faoChainStart(setup.id,op.id);
  };
  rc.appendChild(bs);
  d.appendChild(rc);
  if(L&&L.stale){
    const ws=document.createElement('div'); ws.className='fao-alert';
    ws.textContent='⚠ Modèle modifié : arêtes du profil non retrouvées — boucle inchangée (obsolète), re-sélectionnez le profil.';
    d.appendChild(ws);
  }
  // Haut / Bas : onglet Hauteurs (faoPlanesCard)
  if(slot)faoSlotRows(d,setup,op); // src/89-fao-contour-3tailles.js
  d.appendChild(faoH('Passes (mm)'));
  const pente=!slot&&op.descente==='pente';
  const rD=faoRow();
  rD.appendChild(faoLab('Descente'));
  rD.appendChild(faoSel([
    ['paliers','Paliers','Niveaux successifs espacés de ap : un tour à plat par niveau.'],
    ['pente','Rampe','Attaque en haut du contour puis descente en hélice le long du profil, d’un nombre de mm à chaque tour, jusqu’au plan final (Bas) parcouru à plat.']],
    pente?'pente':'paliers',function(v){ if(v==='pente')op.descente='pente'; else{delete op.descente;delete op.penteTour;} },
    'Descente en Z : par paliers ou en rampe continue le long du profil.'));
  if(!slot)d.appendChild(rD);
  // V0.99.88 : plus d'angle — descente par tour (mm), valeur proposée affichée (10 % du Ø)
  if(pente){
    const rT2=faoRow();
    rT2.appendChild(faoLab('descente / tour'));
    rT2.appendChild(faoNumFx(op,'penteTour',isFinite(+op.penteTour)&&+op.penteTour>0?+op.penteTour:+faoPasTourAuto(toolD).toFixed(2),
      function(v){ if(isFinite(v)&&v>0)op.penteTour=Math.max(0.01,Math.min(100,v)); else delete op.penteTour; },44,0.1,
      'Descente à chaque tour du contour (mm). Valeur proposée : 10 % du Ø de l’outil, 0,5 mm au moins ; changez-la à volonté (vide ou 0 = revenir à la valeur proposée).'));
    d.appendChild(rT2);
    const gr=(op.geoDiag||{}).rampe;
    if(gr&&isFinite(+gr.tours)&&!op.stale){ // à régénérer : chiffres de l'ancien calcul, cachés
      const ir=faoHelp(String(+(+gr.tours).toFixed(1)).replace('.',',')+' tour'+(+gr.tours>1?'s':'')+' jusqu’au Bas.');
      ir.title='Passe la plus proche de la paroi, au dernier calcul.';
      d.appendChild(ir);
    }
  }
  const rP=faoRow();
  if(slot){const ep=faoToolDims(faoToolById(setup,op.toolId)).lc.v;
    rP.appendChild(faoLab('pas Z')); rP.appendChild(faoNumFx(op,'ap',Math.min(+op.ap>0?+op.ap:ep,ep),function(v){op.ap=Math.max(0.05,v);},48,0.1,
      'Pas entre deux passes en hauteur, au plus l’épaisseur du disque ('+ep+' mm) : les passes vont du haut de la rainure vers le Bas.'));}
  else if(!pente){rP.appendChild(faoLab('ap')); rP.appendChild(faoNumFx(op,'ap',op.ap,function(v){op.ap=Math.max(0.2,v);},48,0.5,'Descente par passe en Z.'));}
  rP.appendChild(faoLab('passes')); rP.appendChild(faoNumFx(op,'nR',isFinite(+op.nR)?+op.nR:1,function(v){op.nR=Math.max(1,Math.min(20,Math.round(v)));},36,1,
    'Passes latérales (ébauche) : de la plus éloignée vers la paroi, écartées de ae.'));
  rP.appendChild(faoLab('ae')); rP.appendChild(faoNumFx(op,'ae',isFinite(+op.ae)?+op.ae:+(toolD*0.4).toFixed(2),function(v){op.ae=Math.max(0.05,v);},48,0.1,'Écart entre deux passes latérales.'));
  rP.appendChild(faoLab('finition')); rP.appendChild(faoNumFx(op,'fin',isFinite(+op.fin)?+op.fin:0,function(v){op.fin=Math.max(0,v);},44,0.05,
    'Surépaisseur laissée par les passes en Z puis enlevée par UNE passe de finition à pleine hauteur (0 = pas de passe de finition séparée).'));
  d.appendChild(rP);
  d.appendChild(faoH('Côté et sens'));
  const rS=faoRow();
  rS.appendChild(faoLab('Côté'));
  rS.appendChild(faoSel([
    ['auto','Auto · selon la matière','Bossage : outil à l’extérieur ; poche : outil à l’intérieur (section du solide à mi-hauteur).'],
    ['ext','Extérieur','Outil à l’extérieur du profil.'],
    ['int','Intérieur','Outil à l’intérieur du profil.']],
    (op.cside==='ext'||op.cside==='int')?op.cside:'auto',
    function(v){ if(v==='ext'||v==='int')op.cside=v; else delete op.cside; },'Côté de l’outil par rapport au profil.'));
  rS.appendChild(faoLab('Sens'));
  rS.appendChild(faoSel([
    ['avalant','Avalant','Matière à droite de l’avance (broche M3) : meilleur état de surface.'],
    ['opp','Opposition','Matière à gauche de l’avance.']],
    op.sens==='opp'?'opp':'avalant',function(v){op.sens=(v==='opp')?'opp':'avalant';},'Sens de coupe.'));
  d.appendChild(rS);
  d.appendChild(faoH('Entrée / sortie'));
  const rE=faoRow();
  // V0.99.89 : fraise 3 tailles — entrée en arc (défaut) ou droite (demande de Fred :
  // « Entrée et sortie droite, pas de cercle d'entrée »), src/89-fao-contour-3tailles.js
  const droite=slot&&op.slotLead==='droite';
  if(slot){
    rE.appendChild(faoLab('entrée'));
    rE.appendChild(faoSel([
      ['arc','Arc','Approche droite puis quart de cercle tangent au contour, et de même à la sortie.'],
      ['droite','Droite','Tout droit, sans arc : dans le prolongement de la passe (zones d’entrée et de sortie) là où la place le permet, sinon perpendiculaire au contour.']],
      droite?'droite':'arc',function(v){ if(v==='droite')op.slotLead='droite'; else delete op.slotLead; },'Forme de l’entrée et de la sortie du disque.'));
  }
  if(!droite){
    rE.appendChild(faoLab('rayon')); rE.appendChild(faoNumFx(op,'leadR',isFinite(+op.leadR)?+op.leadR:+Math.min(5,Math.max(1,toolD*0.6)).toFixed(2),function(v){op.leadR=Math.max(0.5,v);},44,0.5,
      'Rayon des quarts de cercle tangents d’entrée et de sortie, côté libre.'));
  }
  rE.appendChild(faoLab('recouvrement')); rE.appendChild(faoNumFx(op,'overlap',isFinite(+op.overlap)?+op.overlap:1,function(v){op.overlap=Math.max(0,v);},44,0.5,
    droite?'Entrée perpendiculaire seulement : longueur parcourue au-delà du point de départ avant la sortie. Dans le prolongement, le tour revient exactement au départ.'
      :'Longueur parcourue au-delà du point de départ avant la sortie (pas de marque).'));
  d.appendChild(rE);
  if(droite){
    const zd=Math.round((toolD/2+10)*10)/10;
    const rZ=faoRow();
    rZ.appendChild(faoLab('zone d’entrée')); rZ.appendChild(faoNumFx(op,'slotLin',isFinite(+op.slotLin)?+op.slotLin:zd,function(v){op.slotLin=Math.max(0,v);},48,1,
      'Distance entre le bord de la matière (la pièce, ou le brut qui dépasse : le disque le traverse) et le centre du disque quand il descend, dans le prolongement (défaut : rayon + 10 = '+zd+' mm).'));
    rZ.appendChild(faoLab('zone de sortie')); rZ.appendChild(faoNumFx(op,'slotLout',isFinite(+op.slotLout)?+op.slotLout:zd,function(v){op.slotLout=Math.max(0,v);},48,1,
      'Distance entre le bord de la matière (la pièce, ou le brut qui dépasse : le disque le traverse) et le centre du disque quand il remonte, dans le prolongement (défaut : rayon + 10 = '+zd+' mm).'));
    d.appendChild(rZ);
    const gdl=op.geoDiag||{};
    if(gdl.slot&&!op.stale&&(gdl.lineN||gdl.perpN)){
      const iz=document.createElement('div');iz.className='fao-meta';
      iz.textContent=(gdl.lineN?gdl.lineN+' passe(s) entrée et sortie dans le prolongement':'')+(gdl.lineN&&gdl.perpN?' · ':'')+
        (gdl.perpN?gdl.perpN+' passe(s) perpendiculaire(s) : pas de place dans le prolongement (allongez ou raccourcissez les zones, ou départ à un coin saillant)':'')+
        (gdl.trav>0?' · traverse jusqu’à '+gdl.trav+' mm de brut avant la pièce':''); // V0.99.91
      d.appendChild(iz);
    }
  }
  // V0.99.18 : rapide dans le vide
  const rV=faoRow();
  const cbV=document.createElement('input'); cbV.type='checkbox'; cbV.checked=op.sautVide!==false;
  cbV.title='Là où la fraise ne touche aucune matière (hors du brut, ou matière déjà enlevée par les opérations précédentes du posage), '+
    'elle remonte et va en rapide jusqu’au prochain point d’entrée en matière, au lieu de parcourir le vide en avance.';
  cbV.onchange=function(){ faoSnapshot('rapide dans le vide');
    if(cbV.checked)delete op.sautVide; else op.sautVide=false;
    faoChanged(); };
  rV.appendChild(cbV);
  rV.appendChild(faoLab('Rapide dans le vide'));
  const gdv=(op.geoDiag||{}).vide;
  if(cbV.checked&&gdv&&(gdv.sauts||gdv.passes)){const iv=document.createElement('span');iv.className='fao-meta';
    iv.textContent=' '+gdv.sauts+' saut(s)'+(gdv.passes?', '+gdv.passes+' passe(s) dans le vide retirée(s)':'');rV.appendChild(iv);}
  if(!slot)d.appendChild(rV);
  if(!slot){
  d.appendChild(faoH('Attaches'));
  const rT=faoRow();
  rT.appendChild(faoLab('nombre')); rT.appendChild(faoNumFx(op,'tabN',isFinite(+op.tabN)?+op.tabN:0,function(v){op.tabN=Math.max(0,Math.min(50,Math.round(v)));},36,1,
    'Ponts de matière laissés pour tenir la pièce en détourage traversant (0 = aucun), répartis sur le profil.'));
  rT.appendChild(faoLab('largeur')); rT.appendChild(faoNumFx(op,'tabW',isFinite(+op.tabW)?+op.tabW:5,function(v){op.tabW=Math.max(0.5,v);},44,0.5,'Largeur d’une attache le long du profil.'));
  rT.appendChild(faoLab('hauteur')); rT.appendChild(faoNumFx(op,'tabH',isFinite(+op.tabH)?+op.tabH:2,function(v){op.tabH=Math.max(0.1,v);},44,0.5,'Hauteur de l’attache au-dessus du Bas.'));
  d.appendChild(rT);
  }
  d.appendChild(faoH('Matière à laisser (mm)'));
  const rR=faoRow();
  rR.appendChild(faoLab('Parois')); rR.appendChild(faoNumFx(op,'radial',faoRA(op).radial,function(v){op.radial=Math.max(0,v);},44,0.1,'Surépaisseur laissée sur la paroi (0 = à la cote).'));
  rR.appendChild(faoLab('Fond')); rR.appendChild(faoNumFx(op,'axial',faoRA(op).axial,function(v){op.axial=Math.max(0,v);},44,0.1,'Surépaisseur au-dessus du Bas.'));
  d.appendChild(rR);
}
