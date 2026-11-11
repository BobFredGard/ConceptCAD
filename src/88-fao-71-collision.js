/* ============ FAO : collision du porte-outil dans la simulation (V0.91.0) ============
   Demande : « ajouter une fonction collision avec le porte-outil dans la simulation ».

   PRINCIPE — le parcours du posage est rejoué sur une carte de hauteurs de la matière
   (la même taille que la simulation : faoMatterCarveSeg, même arrondi, même pointe).
   À chaque pas (≈ 1 mm de trajet) tout ce qui, au-dessus de la partie coupante, est plus
   GROS que l'outil est comparé à la matière qui reste à cet instant :
     · la queue quand elle est plus grosse que l'outil (avec son cône de raccord) ;
     · le porte-outil de la fiche (chanfrein / cônes / cylindres), sinon le porte-outil
       générique (cylindre au Ø mandrin) ; au-dessus de son sommet, la broche est comptée
       au moins aussi large.
   La partie coupante elle-même n'est pas contrôlée ici (ce n'est pas la demande).
   Rapides compris : un porte-outil qui traverse la matière en rapide est une collision.
   OPÉRATIONS INCLINÉES (3+2) — elles ne taillent pas cette carte (elle ne décrit que le
   dessus, vu selon le Z du posage) : leur contrôle se fait par points sur le contour du
   porte-outil et reste indicatif (« à confirmer »).
   Lecture seule : aucun parcours, aucune clé de cache, aucun G-code n'est touché. */
const FAO_COLL_TOL=0.05; // mm — interférence en dessous de laquelle on ne signale rien
function faoToolUpper(t,holder){
  // Silhouette [rayon, z depuis la pointe] de tout ce qui surmonte la partie coupante :
  // col dégagé, cône de raccord, queue, puis porte-outil (réel ou générique).
  const g=faoToolDims(t);
  const lc=Math.min(g.lc.v,g.lsm.v), lDeg=Math.min(Math.max(g.lDeg.v,lc),g.lsm.v), lsm=g.lsm.v;
  const pts=[];
  const push=function(r,z){ const l=pts[pts.length-1]; if(!l||Math.abs(l[0]-r)>1e-9||Math.abs(l[1]-z)>1e-9)pts.push([r,z]); };
  push(g.dDeg.v/2,lc); push(g.dDeg.v/2,lDeg);
  push(g.dq.v/2,Math.min(lsm,lDeg+g.lCq)); push(g.dq.v/2,lsm);
  const hp=holder?faoHolderProfile(holder):null;
  let top=lsm;
  if(hp){ hp.pts.forEach(function(p){ push(p[0],lsm+p[1]); }); top=lsm+hp.h; }
  else{ const r=g.dPo.v/2, h=Math.max(g.dPo.v*0.9,18); push(r,lsm); push(r,lsm+h); top=lsm+h; }
  return {pts:pts,bodyH:lc,zHold:lsm,top:top,rCut:g.D/2,
    rMax:pts.reduce(function(m,p){return Math.max(m,p[0]);},0),
    sig:JSON.stringify(pts)};
}
function faoUpperZAt(up,rho){
  // Cote (depuis la pointe) la plus basse où la silhouette atteint le rayon rho ; Infinity si jamais.
  const P=up.pts;
  for(let i=0;i<P.length;i++){
    if(P[i][0]>=rho)return P[i][1];
    if(i+1<P.length&&P[i+1][0]>=rho){ const a=P[i],b=P[i+1]; return a[1]+(rho-a[0])/(b[0]-a[0])*(b[1]-a[1]); }
  }
  return Infinity;
}
function faoCollGrid(s,setup){
  // Carte de hauteurs du brut pour le contrôle (une seule couche, ~60 000 colonnes) —
  // compatible faoMatterCarveSeg. Brut cylindrique et brut = corps : même départ que la simulation.
  if(!faoStockValid(s))return null;
  const X=s.x1-s.x0,Y=s.y1-s.y0,H=s.z1-s.z0;
  const p=Math.max(0.5,Math.sqrt(X*Y/60000));
  const nx=Math.max(1,Math.ceil(X/p)),ny=Math.max(1,Math.ceil(Y/p)),nc=nx*ny;
  const h=new Float32Array(nc);for(let i=0;i<nc;i++)h[i]=+s.z1;
  const each=function(fn){ for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
    const top=fn(+s.x0+(ix+0.5)*p,+s.y0+(iy+0.5)*p); if(top<+s.z1)h[iy*nx+ix]=top; } };
  try{
    const C=s.cyl;
    if(C&&C.r>0&&Array.isArray(C.c))each(function(x,y){
      if(C.axis==='z')return Math.hypot(x-C.c[0],y-C.c[1])>C.r?+s.z0:+s.z1;
      const d=C.axis==='x'?(y-C.c[1]):(x-C.c[0]);
      return Math.abs(d)>C.r?+s.z0:C.c[2]+Math.sqrt(C.r*C.r-d*d); });
  }catch(e){}
  try{
    const T=(s.solid!=null&&typeof faoStockTop==='function')?faoStockTop(setup,Math.max(0.5,p*0.5)):null;
    if(T)each(function(x,y){ const top=T.at(x,y); return top>-1/0?Math.min(top,+s.z1):+s.z0; });
  }catch(e){}
  return {pas:p,pz:H,nx:nx,ny:ny,nz:1,n:nc,ox:+s.x0,oy:+s.y0,oz:+s.z0,alive:new Uint8Array(nc),h:h,nrm:null,wn:null,
          sx1:+s.x1,sy1:+s.y1,sz1:+s.z1,full:+s.z1};
}
function faoCollAt(g,up,x,y,z){
  // Outil VERTICAL, pointe en (x,y,z) : interférence maximale (mm) entre la silhouette et la matière.
  // Renvoie null (rien) ou {d, part:'holder'|'shank'}.
  if(z+up.pts[0][1]>=g.full)return null; // tout est au-dessus du brut
  const R=up.rMax,p=g.pas;
  const i0=Math.max(0,Math.floor((x-R-g.ox)/p)),i1=Math.min(g.nx-1,Math.floor((x+R-g.ox)/p));
  const j0=Math.max(0,Math.floor((y-R-g.oy)/p)),j1=Math.min(g.ny-1,Math.floor((y+R-g.oy)/p));
  const rIn=up.rCut+1e-6; // sous la fraise : c'est la coupe, pas une collision
  let best=null;
  for(let j=j0;j<=j1;j++){
    const dy=g.oy+(j+0.5)*p-y;
    for(let i=i0;i<=i1;i++){
      const dx=g.ox+(i+0.5)*p-x, rho=Math.sqrt(dx*dx+dy*dy);
      if(rho>R||rho<=rIn)continue;
      const top=g.h[j*g.nx+i];
      if(top<=g.oz)continue; // colonne vide
      const zr=faoUpperZAt(up,rho); // cote de la silhouette au droit du centre de la maille
      const d=top-(z+zr);
      if(d>FAO_COLL_TOL&&(!best||d>best.d))best={d:d,part:zr>=up.zHold-1e-6?'holder':'shank'};
    }
  }
  return best;
}
function faoCollAtAx(g,up,P,A){
  // Outil INCLINÉ (axe A, repère posage) : points sur le contour de la silhouette, tous les ~2 mm
  // de hauteur et 30° ; en collision si un point est sous la carte de hauteurs. Indicatif.
  const F=faoMapFrame(A);
  let best=null;
  const P0=up.pts;
  for(let k=0;k+1<P0.length;k++){
    const a=P0[k],b=P0[k+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
    for(let s=0;s<=n;s++){
      const r=a[0]+(b[0]-a[0])*s/n, zr=a[1]+(b[1]-a[1])*s/n;
      if(r<=up.rCut+g.pas*0.75)continue;
      for(let q=0;q<12;q++){
        const c=Math.cos(q*Math.PI/6),sn=Math.sin(q*Math.PI/6);
        const x=P.x+F.A[0]*zr+r*(F.U[0]*c+F.V[0]*sn),y=P.y+F.A[1]*zr+r*(F.U[1]*c+F.V[1]*sn),z=P.z+F.A[2]*zr+r*(F.U[2]*c+F.V[2]*sn);
        const i=Math.floor((x-g.ox)/g.pas),j=Math.floor((y-g.oy)/g.pas);
        if(i<0||j<0||i>=g.nx||j>=g.ny||z<g.oz)continue;
        const d=g.h[j*g.nx+i]-z;
        if(d>Math.max(FAO_COLL_TOL,g.pas)&&(!best||d>best.d))best={d:d,part:zr>=up.zHold-1e-6?'holder':'shank'};
      }
    }
  }
  return best;
}
function faoCollisionCheck(setup,seq){
  // Rejoue tout le posage ; renvoie {hits:[…par opération…], n, ms, approx}.
  // hits[k] = {op, idx (rang dans le posage), part, d (interférence maxi, mm), n (pas en collision),
  //            x,y,z,t (premier contact : pointe outil et instant de la simulation), rapid, approx}
  const t0=Date.now();
  const b=seq||faoViewerBuild(setup);
  const res={hits:[],n:0,ms:0,approx:false,pts:b.pts.length};
  const g=faoCollGrid(faoStock(),setup);
  if(!g||b.pts.length<2)return res;
  const ups=new Map();
  const upOf=function(T){ if(!T)return null; let u=ups.get(T); if(!u){ u=faoToolUpper(T,faoHolderById(setup,T.holderId)); ups.set(T,u); } return u; };
  const ops=(setup.ops||[]);
  const byOp=new Map();
  const note=function(i,f,P,hit,approx){
    const op=b.po[i+1];
    let h=byOp.get(op);
    if(!h){ h={op:op,idx:ops.indexOf(op),part:hit.part,d:0,n:0,x:P.x,y:P.y,z:P.z,
      t:b.times[i]+(b.times[i+1]-b.times[i])*f,rapid:!!b.pts[i+1].r,approx:!!approx,tool:b.tl[i+1]}; byOp.set(op,h); res.hits.push(h); }
    h.n++; res.n++;
    if(hit.d>h.d){ h.d=hit.d; h.part=hit.part; }
    if(approx)res.approx=true;
  };
  const step=Math.max(1,g.pas);
  for(let i=0;i+1<b.pts.length;i++){
    const a=b.pts[i],c=b.pts[i+1];
    const up=upOf(b.tl[i+1]);
    const ax=c.ax||null;
    const L=Math.hypot(c.x-a.x,c.y-a.y,c.z-a.z);
    const n=Math.max(1,Math.ceil(L/step));
    const r=((isFinite(b.dd[i+1])&&b.dd[i+1]>0)?b.dd[i+1]:10)/2;
    // tout le segment au-dessus du brut : rien à contrôler (la taille se fait d'un seul coup)
    const far=!up||(!ax&&Math.min(a.z,c.z)+up.pts[0][1]>=g.full);
    if(far||ax){
      if(!c.r&&!ax)faoMatterCarveSeg(g,a.x,a.y,a.z,c.x,c.y,c.z,r,null,b.cr[i+1]||0,b.tp[i+1]);
      if(!ax||!up)continue;
    }
    for(let s=0;s<n;s++){
      const f0=s/n,f1=(s+1)/n;
      const P={x:a.x+(c.x-a.x)*f0,y:a.y+(c.y-a.y)*f0,z:a.z+(c.z-a.z)*f0};
      const Q={x:a.x+(c.x-a.x)*f1,y:a.y+(c.y-a.y)*f1,z:a.z+(c.z-a.z)*f1};
      if(ax){ const hx=faoCollAtAx(g,up,Q,ax); if(hx)note(i,f1,Q,hx,true); continue; }
      // le porte-outil arrive AVANT la fraise sur la matière qui est devant : contrôle, puis taille
      const h0=(s===0)?faoCollAt(g,up,P.x,P.y,P.z):null; if(h0)note(i,f0,P,h0,false);
      if(!c.r)faoMatterCarveSeg(g,P.x,P.y,P.z,Q.x,Q.y,Q.z,r,null,b.cr[i+1]||0,b.tp[i+1]);
      const h1=faoCollAt(g,up,Q.x,Q.y,Q.z); if(h1)note(i,f1,Q,h1,false);
    }
  }
  res.ms=Date.now()-t0;
  return res;
}
function faoCollText(res,setup){
  // Résumé en une phrase pour la barre d'état.
  if(!res.hits.length)return 'Collisions : aucune — le porte-outil et la queue ne touchent jamais la matière.';
  const fr=function(v){ return String(Math.round(v*10)/10).replace('.',','); };
  const L=res.hits.map(function(h){
    return 'n° '+(h.idx+1)+' « '+faoOpShortLabel(h.op)+' » T'+((h.tool&&h.tool.num)||'?')+' : '
      +(h.part==='holder'?'porte-outil':'queue')+' dans la matière de '+fr(h.d)+' mm'+(h.rapid?' (en rapide)':'')+(h.approx?' (inclinée, à confirmer)':''); });
  return '⚠ Collision sur '+res.hits.length+' opération(s) — '+L.join(' ; ');
}
/* ----- simulation : outil aux vraies longueurs, porte-outil réel, bouton « Collisions » ----- */
let faoVwCollBtn=null;
function faoViewerUpperSync(vw,i2){
  // L'outil affiché prend la longueur de coupe réelle et, au-dessus, la silhouette de la fiche
  // (queue + porte-outil) à la place du cylindre gris de taille fixe. Renvoie la silhouette.
  const T=vw.tl&&vw.tl[i2]; if(!T)return null;
  let up=null;try{ up=faoToolUpper(T,faoHolderById(faoSetup(),T.holderId)); }catch(e){ return null; }
  vw.toolH=up.bodyH;
  if(up.sig===vw.upSig)return up;
  vw.upSig=up.sig;
  try{
    const pts=[new THREE.Vector2(0,up.pts[0][1])].concat(up.pts.map(function(p){return new THREE.Vector2(p[0],p[1]);}),[new THREE.Vector2(0,up.top)]);
    const m=new THREE.Mesh(new THREE.LatheGeometry(pts,32),new THREE.MeshPhongMaterial({color:0x676c75,flatShading:true}));
    m.raycast=function(){}; m.rotation.x=Math.PI/2;
    m.userData.reel=true;
    if(vw.toolHold){ try{ vw.tool.remove(vw.toolHold); }catch(e){} faoViewerToolDispose(vw.toolHold); }
    vw.tool.add(m); vw.toolHold=m; m.visible=!faoVwHideHold;
  }catch(e){}
  return up;
}
function faoViewerCollClear(vw){
  try{ if(vw&&vw.collMarks){ faoDel3D(vw.collMarks); faoViewerToolDispose(vw.collMarks); } }catch(e){}
  if(vw){ vw.collMarks=null; vw.coll=null; vw.collNext=0; }
}
function faoViewerCollGo(vw,k){
  // Amène la simulation à l'instant du contact n° k (pause) — la matière est rejouée jusque-là.
  const h=vw.coll.hits[k]; if(!h)return;
  faoViewerPause();
  if(h.t<vw.t)faoViewerStop();
  vw.t=Math.min(vw.T,h.t);
  faoViewerApply(); faoViewerBarUpdate();
}
function faoViewerCollRun(){
  // Bouton « Collisions » : 1er clic = contrôle complet + repères rouges ; clics suivants = contact suivant.
  const vw=faoVw; if(!vw)return null;
  try{
    if(!vw.coll){
      faoViewerMsg('Collisions : contrôle du porte-outil en cours…');
      const setup=faoSetup();
      vw.coll=faoCollisionCheck(setup);
      vw.collNext=0;
      try{
        const G=new THREE.Group(); G.name='faoCollMarks';
        vw.coll.hits.forEach(function(h){
          const m=new THREE.Mesh(new THREE.SphereGeometry(Math.max(1.5,((h.tool&&+h.tool.d)||6)*0.3),16,12),
            new THREE.MeshBasicMaterial({color:0xff3b30,transparent:true,opacity:.85,depthTest:false}));
          m.raycast=function(){}; m.renderOrder=999; m.position.set(h.x,h.y,h.z); G.add(m); });
        vw.collMarks=G; faoAdd3D(G);
      }catch(e){}
      faoViewerMsg(faoCollText(vw.coll,setup)+(vw.coll.hits.length?' — recliquez pour aller au contact.':''));
    }else if(vw.coll.hits.length){
      const k=vw.collNext%vw.coll.hits.length; vw.collNext=k+1;
      faoViewerCollGo(vw,k);
      const h=vw.coll.hits[k];
      faoViewerMsg('Collision '+(k+1)+'/'+vw.coll.hits.length+' — opération n° '+(h.idx+1)+' « '+faoOpShortLabel(h.op)+' » : '
        +(h.part==='holder'?'le porte-outil':'la queue')+' entre dans la matière ('+String(Math.round(h.d*10)/10).replace('.',',')+' mm au pire).');
    }else faoViewerMsg(faoCollText(vw.coll,faoSetup()));
    faoViewerCollBtnUpdate();
    return vw.coll;
  }catch(e){ faoViewerMsg('Collisions : contrôle impossible ('+((e&&e.message)||e)+')'); return null; }
}
function faoViewerCollBtnUpdate(){
  try{
    const b=faoVwCollBtn; if(!b)return;
    const c=faoVw&&faoVw.coll;
    b.textContent=!c?'⚠ Collisions':(c.hits.length?('⚠ '+c.hits.length+' collision'+(c.hits.length>1?'s':'')):'✓ 0 collision');
    b.style.color=!c?'':(c.hits.length?'#ff453a':'#30d158');
  }catch(e){}
}
