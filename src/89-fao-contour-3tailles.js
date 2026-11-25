/* ================================================================
   CONTOUR À LA FRAISE 3 TAILLES (V0.99.84)
   ----------------------------------------------------------------
   Demande de Fred : « fraise 3 tailles -> ajouter cette possibilité et l'usinage qui va
   avec, pourquoi pas dans Contour », puis « il faut un contour et pouvoir décaler la
   fraise si l'on veut ».
   Une opération Contour (profil d'arêtes) dont l'outil est une fraise 3 tailles
   (src/88-fao-20-outils-brut.js, kind 'slot') taille une RAINURE dans la paroi, comme le
   Contour 2D de Fusion 360 avec une fraise à rainurer :
   - contour = arêtes cliquées ; Bas = arête la plus basse (onglet Hauteurs) ;
   - rainure de « hauteur » op.slotH (défaut : l'épaisseur du disque) au-dessus du Bas,
     décalée en hauteur de op.slotDz (± mm) ; le disque passe à son rayon du contour,
     décalé dans la paroi de op.slotDr (+ : il entre plus loin que le contour) ;
   - passes en hauteur de haut en bas, au plus l'épaisseur du disque (ap), passes
     latérales (nR, ae), finition, côté et sens, matière à laisser : comme le contour ;
   - le disque ne plonge jamais dans la matière : il descend À CÔTÉ de la pièce, là où
     rien ne dépasse au-dessus de la passe sous tout son disque (brut restant après les
     opérations précédentes, corps-brut, modèle), entre par le côté (droite puis quart
     de cercle tangent), fait le tour, ressort par le côté et ne remonte qu'une fois
     dehors. Le départ est pris là où la sortie à l'air est la plus courte ;
   - alertes : aucune entrée par le côté, col qui frotte au-dessus de la rainure
     (profondeur > (Ø − Ø col) / 2), disque plus épais que la rainure.
   ================================================================ */
function faoContourSlotOp(op,job){
  return faoContourProfil(op)&&faoToolIsSlot(faoToolById(job,op&&op.toolId));
}
function faoSlotGeom(op,tool){
  // Rainure vue par la fiche : hauteurs (repère de l'opération), épaisseur, col.
  const g=faoToolDims(tool),ep=g.lc.v;
  const h=(isFinite(+op.slotH)&&+op.slotH>0)?+op.slotH:ep;
  const dz=isFinite(+op.slotDz)?+op.slotDz:0;
  const z0=+op.zbot+dz;
  return {D:g.D,ep:ep,col:g.dDeg.v,h:h,dz:dz,dr:isFinite(+op.slotDr)?+op.slotDr:0,
    z0:z0,z1:z0+h,pmax:Math.max(0,(g.D-g.dDeg.v)/2)};
}
function faoSlotObstacles(op,job,mesh,R,rn){
  // clear(x,y,z) : le disque (rayon R + garde) peut être en (x,y) à la cote z, et y
  // descendre d'en haut, sans rien toucher ; neckTop(x,y) : dessus de la matière sous le col.
  // Matière = brut restant après les opérations précédentes (carte du brut restant), dessus
  // d'un corps-brut, modèle ; sans rien de tout cela : la boîte du brut.
  const gd=Math.max(0.5,R*0.05),tol=0.02;
  const tops=[],necks=[];
  let G=null;
  try{ const M=faoRestMap(op,job,2*R,0); G=M&&M.grid; }catch(e){ G=null; }
  if(G){
    const look=function(rad){
      const A=faoRestDilate(G.h,G.nx,G.ny,rad,G.p);
      return function(x,y){const i=Math.floor((x-G.x0)/G.p),j=Math.floor((y-G.y0)/G.p);
        if(i<0||j<0||i>=G.nx||j>=G.ny)return -1/0;return A[j*G.nx+i];};
    };
    tops.push(look(R+gd+G.p));
    if(rn>0)necks.push(look(Math.max(0,rn-G.p))); // une maille d'indulgence : la carte est au pas près
  }
  try{ const T=faoStockTop(job,1); if(T){ tops.push(T.dil(R+gd)); if(rn>0)necks.push(T.dil(rn)); } }catch(e){}
  if(mesh&&mesh.v&&mesh.v.length){
    try{ const dp=faoScDropper(mesh,'flat',2*(R+gd),0,0); tops.push(function(x,y){return dp.tip(x,y);}); }catch(e){}
    if(rn>0){ try{ const dn=faoScDropper(mesh,'flat',2*rn,0,0); necks.push(function(x,y){return dn.tip(x,y);}); }catch(e){} }
  }
  if(!G){
    const s=job&&job.stock;
    if(s&&faoStockValid(s)){
      const box=function(rad){return function(x,y){
        const dx=Math.max(+s.x0-x,0,x-+s.x1),dy=Math.max(+s.y0-y,0,y-+s.y1);
        return Math.hypot(dx,dy)<rad?+s.z1:-1/0;};};
      tops.push(box(R+gd)); if(rn>0)necks.push(box(rn));
    }
  }
  if(!tops.length)return null;
  const mx=function(L,x,y){let m=-1/0;for(let i=0;i<L.length;i++){const v=L[i](x,y);if(v>m)m=v;}return m;};
  return {
    clear:function(x,y,z){ return !(mx(tops,x,y)>z-tol); },
    neckTop:necks.length?function(x,y){ return mx(necks,x,y); }:null
  };
}
function faoGenContourSlot(mesh,loop0,o){
  o=o||{};
  const moves=[];
  const diag={side:null,levels:0,passes:0,slot:1,noEntry:0,neck:0,neckN:0,thick:0,over:0,zb:null,zt:null};
  try{moves.diag=diag;}catch(e){}
  if(!loop0||loop0.length<4)return moves;
  const D=isFinite(+o.toolD)&&+o.toolD>0?+o.toolD:10, r=D/2;
  const ep=isFinite(+o.ep)&&+o.ep>0?+o.ep:Math.max(1,D*0.12);
  const rn=isFinite(+o.rn)&&+o.rn>0?Math.min(+o.rn,r):0;
  const RA=faoRA(o);
  const secu=isFinite(+o.secu)?+o.secu:5;
  const zbot=+o.zbot;
  if(!isFinite(zbot))return moves;
  const r3=function(v){return Math.round(v*1000)/1000;};
  const dz=isFinite(+o.dz)?+o.dz:0, dr=isFinite(+o.dr)?+o.dr:0;
  const hS=isFinite(+o.slotH)&&+o.slotH>0?+o.slotH:ep;
  const zb=zbot+dz+RA.axial, zt=zbot+dz+hS-RA.axial;
  diag.zb=r3(zbot+dz); diag.zt=r3(zbot+dz+hS);
  if(zt-zb<ep-1e-6)diag.thick=r3(ep-Math.max(0,zt-zb)); // le disque taille plus haut que la rainure
  // boucle fermée, sens trigo (CCW)
  let loop=loop0.map(function(p){return [+p[0],+p[1]];});
  {const a=loop[0],b=loop[loop.length-1];
    if(Math.hypot(a[0]-b[0],a[1]-b[1])>1e-6)loop.push([a[0],a[1]]);}
  let ar=0;for(let i=0;i+1<loop.length;i++)ar+=loop[i][0]*loop[i+1][1]-loop[i+1][0]*loop[i][1];
  if(ar<0)loop=loop.slice().reverse();
  // --- côté matière : section au milieu de la tranche du disque (dans la rainure)
  let side=o.side==='ext'||o.side==='int'?o.side:null;
  if(!side&&mesh){
    const zm=isFinite(+o.zSide)?+o.zSide:zbot+dz+Math.min(ep,hS)/2;
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
  const oside=side==='ext'?1:-1;
  // distance du centre au contour : rayon + surépaisseur − décalage dans la paroi
  let dFin=r+RA.radial-dr;
  if(dFin<0.05){diag.over=1;dFin=0.05;}
  const fin=isFinite(+o.fin)&&+o.fin>0?+o.fin:0;
  const nR=Math.max(1,Math.min(20,Math.round(isFinite(+o.nR)?+o.nR:1)));
  const aeR=isFinite(+o.ae)&&+o.ae>0?+o.ae:Math.max(0.2,D*0.1);
  const offs=[];for(let k=nR-1;k>=0;k--)offs.push(dFin+fin+k*aeR);
  const climb=o.sens!=='opp';
  const ccw=(side==='int')===climb;
  // --- niveaux du disque (dessous du disque), de haut en bas, au plus l'épaisseur
  const step=Math.max(0.05,Math.min(ep,isFinite(+o.ap)&&+o.ap>0?+o.ap:ep));
  const levels=[];
  {const zTop=zt-ep;
    if(zTop<=zb+1e-6)levels.push(zb);
    else{let z=zTop;while(z>zb+1e-6){levels.push(Math.round(z*10000)/10000);z-=step;}
      if(levels.length&&levels[levels.length-1]-zb<0.01)levels.pop();
      levels.push(zb);}}
  diag.levels=levels.length;
  // --- obstacles : descente à côté de la pièce, col au-dessus de la rainure
  const gd=Math.max(0.5,r*0.05);
  let clear=typeof o.clear==='function'?o.clear:null;
  if(!clear&&mesh){
    try{const dp=faoScDropper(mesh,'flat',2*(r+gd),0,0);clear=function(x,y,z){return !(dp.tip(x,y)>z-0.02);};}catch(e){clear=null;}
  }
  if(!clear)clear=function(x,y){return faoDistToPoly(x,y,loop)>=r+gd;};
  let neckTop=typeof o.neckTop==='function'?o.neckTop:null;
  if(!neckTop&&mesh&&rn>0){
    try{const dn=faoScDropper(mesh,'flat',2*rn,0,0);neckTop=function(x,y){return dn.tip(x,y);};}catch(e){neckTop=null;}
  }
  // --- passes décalées (comme le contour sur profil)
  const passAt=function(d){
    const P=faoOffsetChain(loop,d,oside);
    if(!P)return [];
    const runs=faoSplitValid(P,function(p){return faoDistToPoly(p[0],p[1],loop)>=d-0.01;});
    const out=[];
    runs.forEach(function(run){
      let R=run.slice();
      if(run===P||run.length===P.length)R.push([R[0][0],R[0][1]]);
      let a2=0;for(let i=0;i+1<R.length;i++)a2+=R[i][0]*R[i+1][1]-R[i+1][0]*R[i][1];
      const closed=Math.hypot(R[0][0]-R[R.length-1][0],R[0][1]-R[R.length-1][1])<1e-6;
      if(closed&&((a2>0)!==ccw))R.reverse();
      if(!closed&&!ccw)R.reverse();
      R=faoSimplifyPts(R,0.002);
      if(R.length>=2)out.push({pts:R,closed:closed});
    });
    return out;
  };
  const leadR=Math.max(0.5,isFinite(+o.leadR)&&+o.leadR>0?+o.leadR:Math.min(5,Math.max(1,D*0.6)));
  const overlap=isFinite(+o.overlap)&&+o.overlap>=0?+o.overlap:1;
  const rnd=function(v){return Math.round(v*10000)/10000;};
  let cur=null;
  const push=function(m){m.x=rnd(m.x);m.y=rnd(m.y);m.z=rnd(m.z);
    if(cur&&cur.r===m.r&&!!cur.ent===!!m.ent&&cur.x===m.x&&cur.y===m.y&&cur.z===m.z)return;
    moves.push(m);cur=m;};
  const freeN=function(t){return climb?[-t[1],t[0]]:[t[1],-t[0]];};
  const arcPts=function(P,t,nf,R,isIn){
    const C=[P[0]+nf[0]*R,P[1]+nf[1]*R],pts=[];
    const N=8;
    for(let k=0;k<=N;k++){const th=k/N*Math.PI/2;
      if(isIn)pts.push([C[0]-R*(t[0]*Math.cos(th)+nf[0]*Math.sin(th)),C[1]-R*(t[1]*Math.cos(th)+nf[1]*Math.sin(th))]);
      else pts.push([C[0]+R*(-nf[0]*Math.cos(th)+t[0]*Math.sin(th)),C[1]+R*(-nf[1]*Math.cos(th)+t[1]*Math.sin(th))]);}
    return pts;
  };
  const arcOK=function(pts,d){
    for(let k=0;k<pts.length;k++)if(faoDistToPoly(pts[k][0],pts[k][1],loop)<Math.min(d,r)-0.01)return false;
    return true;
  };
  const leadArc=function(P,t,nf,d,isIn){
    for(let R=leadR;R>=0.5;R*=0.6){const a=arcPts(P,t,nf,R,isIn);if(arcOK(a,d))return a;}
    return null;
  };
  // sortie à l'air : de P, le long de la normale côté libre, jusqu'au premier point où le
  // disque est dégagé de toute matière au-dessus de z ; la ligne ne doit pas entamer le contour
  const stA=Math.max(0.25,Math.min(2,r/8)),Lmax=Math.max(6*D,150);
  const toAir=function(P,nf,d,z){
    for(let L=0;L<=Lmax+1e-9;L+=stA){
      const x=P[0]+nf[0]*L,y=P[1]+nf[1]*L;
      if(L>0&&faoDistToPoly(x,y,loop)<Math.min(d,r)-0.01)return null;
      if(clear(x,y,z))return [x,y,L];
    }
    return null;
  };
  const tan=function(a,b){const l=Math.hypot(b[0]-a[0],b[1]-a[1]);return l>1e-12?[(b[0]-a[0])/l,(b[1]-a[1])/l]:null;};
  // entrée d'une passe : arc (Q → S) puis approche (A → Q)
  const entryAt=function(S,t,d,z){
    const nf=freeN(t),lin=leadArc(S,t,nf,d,true),Q=lin?lin[0]:S;
    const A=toAir(Q,nf,d,z);
    return A?{S:S,t:t,lin:lin,Q:Q,A:A}:null;
  };
  // départ d'une passe fermée : le point de la boucle dont la sortie à l'air est la plus courte
  const bestStart=function(P,d,z){
    let Lp=0;const cum=[0];for(let i=1;i<P.length;i++){Lp+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);cum.push(Lp);}
    if(!(Lp>1e-6))return null;
    const N=Math.max(8,Math.min(96,Math.ceil(Lp/2)));
    let best=null,bs=1/0;
    for(let k=0;k<N;k++){
      const s=Lp*k/N;let i=0;while(i+2<P.length&&cum[i+1]<s)i++;
      const l=cum[i+1]-cum[i];if(!(l>1e-9))continue;
      const u=Math.max(0,Math.min(1,(s-cum[i])/l)),t=tan(P[i],P[i+1]);if(!t)continue;
      const S=[P[i][0]+(P[i+1][0]-P[i][0])*u,P[i][1]+(P[i+1][1]-P[i][1])*u];
      const e=entryAt(S,t,d,z);if(!e)continue;
      const sc=e.A[2]+(cur?0.25*Math.hypot(S[0]-cur.x,S[1]-cur.y):0);
      if(sc<bs-1e-9){bs=sc;best=e;best.i=i;}
    }
    return best;
  };
  // va au-dessus de A (dehors), descend à la cote z dans le vide
  const goDown=function(A,z){
    if(!cur)push({r:1,x:A[0],y:A[1],z:secu});
    else if(Math.hypot(cur.x-A[0],cur.y-A[1])>1e-6){
      if(cur.z<secu-1e-9)push({r:1,x:cur.x,y:cur.y,z:secu});
      push({r:1,x:A[0],y:A[1],z:secu});
    }
    if(cur.z>z+1+1e-9)push({r:1,x:A[0],y:A[1],z:z+1});
    push({r:0,ent:1,x:A[0],y:A[1],z:z});
  };
  const cut=function(p,z,ent){push({r:0,ent:ent?1:0,x:p[0],y:p[1],z:z});};
  // une passe à la cote z, distance d : entrée par le côté, tour, sortie par le côté
  const emitRun=function(run,z,d){
    let pts=run.pts,e=null;
    if(run.closed){
      e=bestStart(pts,d,z);
      if(!e){diag.noEntry++;return;}
      const i=e.i,S=e.S;
      const body=[S].concat(pts.slice(i+1,pts.length-1),pts.slice(0,i+1));
      pts=body.concat([[S[0],S[1]]]);
      if(overlap>0){
        let acc=0;
        for(let k=1;k<pts.length&&acc<overlap;k++){
          const a=pts[k-1],b=pts[k],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
          if(acc+l>=overlap){const u=(overlap-acc)/l;pts=pts.concat([[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]]);acc=overlap;break;}
          pts=pts.concat([[b[0],b[1]]]);acc+=l;
        }
      }
    }else{
      const t=tan(pts[0],pts[1]);
      e=t?entryAt(pts[0],t,d,z):null;
      if(!e){diag.noEntry++;return;}
    }
    // sortie
    let k1=pts.length-1;while(k1>0&&Math.hypot(pts[k1][0]-pts[k1-1][0],pts[k1][1]-pts[k1-1][1])<1e-9)k1--;
    const t1=k1>0?tan(pts[k1-1],pts[k1]):null,E=pts[pts.length-1];
    let lout=null,Aout=null;
    if(t1){const nf1=freeN(t1);lout=leadArc(E,t1,nf1,d,false);Aout=toAir(lout?lout[lout.length-1]:E,nf1,d,z);}
    goDown(e.A,z);
    cut(e.Q,z,1);
    if(e.lin)for(let k=1;k<e.lin.length;k++)cut(e.lin[k],z,1);
    for(let k=1;k<pts.length;k++)cut(pts[k],z,0);
    if(Aout){
      if(lout)for(let k=1;k<lout.length;k++)cut(lout[k],z,1);
      cut(Aout,z,1);
    }else{
      // pas de sortie à l'air au bout : retour par le chemin déjà taillé jusqu'à l'entrée
      for(let k=pts.length-2;k>=0;k--)cut(pts[k],z,0);
      if(e.lin)for(let k=e.lin.length-2;k>=0;k--)cut(e.lin[k],z,1);
      cut(e.A,z,1);
    }
    diag.passes++;
  };
  const passes=offs.map(passAt);
  const finRuns=fin>0?passAt(dFin):null;
  levels.forEach(function(z){
    passes.forEach(function(runs,k){runs.forEach(function(run){emitRun(run,z,offs[k]);});});
    if(finRuns)finRuns.forEach(function(run){emitRun(run,z,dFin);});
  });
  if(cur)push({r:1,x:cur.x,y:cur.y,z:secu});
  // --- col : rien ne doit dépasser au-dessus du disque sous le col pendant la coupe
  if(neckTop&&rn>0){
    let worst=0,n=0;
    for(let i=1;i<moves.length;i++){
      const a=moves[i-1],b=moves[i];if(b.r||Math.abs(a.z-b.z)>1e-9)continue;
      const L=Math.hypot(b.x-a.x,b.y-a.y),ns=Math.max(1,Math.ceil(L/1));
      for(let s=1;s<=ns;s++){const t=s/ns,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
        const over=neckTop(x,y)-(b.z+ep);
        if(over>0.05){n++;if(over>worst)worst=over;}}
    }
    diag.neck=r3(worst);diag.neckN=n;
  }
  return moves;
}
// Simulation : les cartes de hauteurs ne savent pas creuser SOUS la matière —
// la rainure ne se voit qu'avec le moteur lisse ; message ajouté à la barre d'état.
function faoSlotSimNote(vw){
  if(typeof faoSimEngine!=='undefined'&&faoSimEngine==='sdf')return '';
  const tp=vw&&vw.tp;
  if(!tp||!tp.some(function(t){ return !!(t&&t.slot); }))return '';
  return ' · Fraise 3 tailles : la rainure ne se voit qu’avec « moteur : lisse ».';
}
// Fiche : section « Rainure » du contour à la fraise 3 tailles (src/89-fao-contour.js).
function faoSlotRows(d,setup,op){
  const t=faoToolById(setup,op.toolId),G=faoSlotGeom(op,t);
  d.appendChild(faoH('Rainure (fraise 3 tailles)'));
  const r1=faoRow();
  r1.appendChild(faoLab('hauteur')); r1.appendChild(faoNumFx(op,'slotH',G.h,function(v){op.slotH=Math.max(0.05,v);},48,0.1,
    'Hauteur de la rainure au-dessus du Bas (défaut : l’épaisseur du disque, '+G.ep+' mm = une seule passe).'));
  r1.appendChild(faoLab('décalage en hauteur')); r1.appendChild(faoNumFx(op,'slotDz',G.dz,function(v){op.slotDz=v;},48,0.5,
    'Monte (+) ou descend (−) la rainure par rapport au Bas (l’arête la plus basse du contour).'));
  d.appendChild(r1);
  const r2=faoRow();
  r2.appendChild(faoLab('décalage dans la paroi')); r2.appendChild(faoNumFx(op,'slotDr',G.dr,function(v){op.slotDr=v;},48,0.1,
    'Décale la fraise par rapport au contour : + = elle entre plus loin dans la matière (rainure creusée dans une paroi droite), − = elle reste en retrait.'));
  d.appendChild(r2);
  const inf=document.createElement('div'); inf.className='fao-meta';
  const nZ=G.h>G.ep+1e-6?Math.ceil((G.h-G.ep)/Math.max(0.05,Math.min(G.ep,+op.ap>0?+op.ap:G.ep))-1e-6)+1:1;
  inf.textContent=(isFinite(G.z0)?'Rainure de Z '+(+G.z0.toFixed(3))+' à Z '+(+G.z1.toFixed(3))+' · ':'')+nZ+' passe(s) en hauteur · disque Ø'+G.D+' × '+G.ep+
    ' · profondeur sans que le col frotte : '+(+G.pmax.toFixed(2))+' mm'+(G.dr?(' · décalée de '+G.dr+' mm dans la paroi'):'');
  d.appendChild(inf);
  const gd=op.geoDiag||{};
  const warn=function(s){const a=document.createElement('div');a.className='fao-alert';a.textContent='⚠ '+s;d.appendChild(a);};
  if(gd.slot){
    if(gd.noEntry)warn(gd.noEntry+' passe(s) sans entrée par le côté : rien ne laisse descendre le disque à côté de la pièce (usinez d’abord l’extérieur, ou prenez un disque plus petit).');
    if(gd.neck>0)warn('Le col (Ø'+G.col+') frotte la matière au-dessus de la rainure (jusqu’à '+gd.neck+' mm) : rainure trop profonde pour cette fraise (maxi '+(+G.pmax.toFixed(2))+' mm), ou brut pas encore enlevé autour de la pièce.');
    if(gd.thick>0)warn('Disque plus épais que la rainure : il taille '+gd.thick+' mm plus haut que demandé.');
    if(gd.over)warn('Décalage dans la paroi plus grand que le rayon du disque : la fraise est ramenée sur le contour.');
  }
}
