// Espace PLAN — suite de la fonction englobante ouverte dans 98-mep-00-modele.js (état privé partagé, fermée dans 98-mep-95-export-init.js) : oblongs repérés par leurs 2 centres.
  /* ═══════════════ O2. oblongs : positionnement par les 2 centres ═══════════════ */
  /* 2026-11-06 : « Oblong → positionnement par les 2 centres de cercles ». Une vue ne contient que des
     traits : un oblong est reconnu à sa forme — 2 demi-cercles de même rayon, tournés vers l'extérieur,
     reliés par 2 droites tangentes. Mémo durable s={x1,y1,x2,y2,r} (les 2 centres, le rayon), repris
     par l'axe {kind:'slot',s} et par les points de cote {hint:{t:'slot',n:0|1,s}}. Il est retrouvé dans
     la géométrie exacte par la FORME de l'oblong : un allongement déplace ses centres bien plus loin
     que ne le tolère le suivi d'un cercle seul (mepIdxFollow, mepCircTrack). */
  const mepSlotCache=new WeakMap(); // géométrie d'une vue → ses oblongs
  const MEP_SLOT_BINS=72; // couverture angulaire d'un arc, par pas de 5° (les doublons vu/caché ne comptent qu'une fois)
  function mepSlotArcGroups(els){
    const groups=new Map(),n=MEP_SLOT_BINS,st=2*Math.PI/n;
    els.forEach((e,i)=>{
      if(e.t!=='A'||e.k==='thread'||e.k==='threadH'||!(e.r>1e-6))return;
      const key=[e.cx,e.cy,e.r].map(x=>(+x).toFixed(3)).join(',');
      let g=groups.get(key);
      if(!g){g={cx:e.cx,cy:e.cy,r:e.r,idx:[],bins:new Set()};groups.set(key,g);}
      g.idx.push(i);
      const lo=Math.min(e.a0,e.a1),hi=Math.max(e.a0,e.a1);
      for(let a=lo+st/2;a<hi;a+=st)g.bins.add(((Math.floor(a/st)%n)+n)%n);
    });
    // un demi-tour, à un pas près : ni un congé (moins), ni un arc de contour plus ouvert
    return [...groups.values()].filter(g=>g.bins.size>=n/2-3&&g.bins.size<=n/2+1);
  }
  // l'arc g est-il entièrement du côté opposé à la direction (ux,uy) ?
  function mepSlotArcOutward(g,ux,uy){
    const st=2*Math.PI/MEP_SLOT_BINS;
    for(const b of g.bins){const a=(b+0.5)*st;if(Math.cos(a)*ux+Math.sin(a)*uy>0.15)return false;}
    return true;
  }
  // part du segment [0,d] couverte par les droites à la distance signée off de l'axe des centres
  function mepSlotSideLines(els,A,ux,uy,d,off,tol){
    const iv=[],idx=[],nx=-uy,ny=ux;
    els.forEach((e,i)=>{
      if(e.t!=='L'||e.k==='thread'||e.k==='threadH')return;
      const o1=(e.x1-A.cx)*nx+(e.y1-A.cy)*ny,o2=(e.x2-A.cx)*nx+(e.y2-A.cy)*ny;
      if(Math.abs(o1-off)>tol||Math.abs(o2-off)>tol)return;
      const t1=(e.x1-A.cx)*ux+(e.y1-A.cy)*uy,t2=(e.x2-A.cx)*ux+(e.y2-A.cy)*uy;
      if(Math.min(t1,t2)<-tol||Math.max(t1,t2)>d+tol)return; // déborde : ce n'est pas le côté de cet oblong
      iv.push([Math.min(t1,t2),Math.max(t1,t2)]);idx.push(i);
    });
    iv.sort((p,q)=>p[0]-q[0]);
    let cov=0,end=-Infinity;
    iv.forEach(([a,b])=>{if(b>end){cov+=b-Math.max(a,end);end=b;}});
    return{cov,idx};
  }
  function mepSlotFind(els){
    const arcs=mepSlotArcGroups(els),cand=[];
    for(let i=0;i<arcs.length;i++)for(let j=i+1;j<arcs.length;j++){
      const A=arcs[i],B=arcs[j],tol=Math.max(0.01,A.r*0.002);
      if(Math.abs(A.r-B.r)>tol)continue;
      const dx=B.cx-A.cx,dy=B.cy-A.cy,d=Math.hypot(dx,dy);if(!(d>tol))continue;
      const ux=dx/d,uy=dy/d;
      if(!mepSlotArcOutward(A,ux,uy)||!mepSlotArcOutward(B,-ux,-uy))continue;
      const s1=mepSlotSideLines(els,A,ux,uy,d,A.r,tol),s2=mepSlotSideLines(els,A,ux,uy,d,-A.r,tol);
      if(s1.cov<0.9*d||s2.cov<0.9*d)continue;
      cand.push({x1:A.cx,y1:A.cy,x2:B.cx,y2:B.cy,r:A.r,d,ia:A.idx,ib:B.idx,il:s1.idx.concat(s2.idx)});
    }
    cand.sort((a,b)=>a.d-b.d); // un arc n'appartient qu'à un oblong : le plus court
    const used=new Set();
    return cand.filter(c=>{
      if(c.ia.concat(c.ib).some(i=>used.has(i)))return false;
      c.ia.concat(c.ib).forEach(i=>used.add(i));
      return true;
    });
  }
  function mepSlotsOf(v){
    if(!v||mepOblOf(v)||mepPerspOf(v))return[];
    const g=mepGeoOf(v);if(!g||!g.els)return[];
    let L=mepSlotCache.get(g);
    if(!L){L=mepSlotFind(g.els);mepSlotCache.set(g,L);}
    return L;
  }
  function mepSlotMemo(s){return{x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,r:s.r};}
  // l'oblong dont l'entité i (arc ou côté droit) fait partie
  function mepSlotOfEnt(v,i){
    if(typeof i!=='number')return null;
    return mepSlotsOf(v).find(s=>s.ia.indexOf(i)>=0||s.ib.indexOf(i)>=0||s.il.indexOf(i)>=0)||null;
  }
  /* référence du centre de l'arc i : celle de l'oblong s'il en fait partie, sinon celle du cercle */
  function mepSlotCtrHint(v,i){
    const s=mepSlotOfEnt(v,i);
    if(!s)return{t:'ctr',i};
    const n=s.ib.indexOf(i)>=0?1:s.ia.indexOf(i)>=0?0:-1;
    return n<0?{t:'ctr',i}:{t:'slot',n,s:mepSlotMemo(s)};
  }
  function mepSlotSameCenters(a,b,tol){
    const t=tol||1e-3,n=(x,y)=>Math.abs(x-y)<=t;
    return (n(a.x1,b.x1)&&n(a.y1,b.y1)&&n(a.x2,b.x2)&&n(a.y2,b.y2))
      ||(n(a.x1,b.x2)&&n(a.y1,b.y2)&&n(a.x2,b.x1)&&n(a.y2,b.y1));
  }
  /* l'oblong de la vue qui correspond au mémo m, ses centres dans le même ordre (null : disparu) */
  function mepSlotTrack(v,m){
    const L0=Math.hypot(m.x2-m.x1,m.y2-m.y1),u0x=L0>1e-9?(m.x2-m.x1)/L0:1,u0y=L0>1e-9?(m.y2-m.y1)/L0:0;
    let best=null,bc=Infinity;
    mepSlotsOf(v).forEach(s=>{
      const sx=(s.x2-s.x1)/s.d,sy=(s.y2-s.y1)/s.d;
      const k=Math.hypot((s.x1+s.x2-m.x1-m.x2)/2,(s.y1+s.y2-m.y1-m.y2)/2)+0.5*Math.abs(s.d-L0)
        +Math.abs(s.r-m.r)+0.5*L0*Math.abs(u0x*sy-u0y*sx);
      if(k<bc){bc=k;best=s;}
    });
    if(!best||bc>Math.max(3,2*m.r,L0))return null;
    const sw=(best.x2-best.x1)*u0x+(best.y2-best.y1)*u0y<0; // le noyau peut avoir rendu les arcs dans l'autre ordre
    return sw?{x1:best.x2,y1:best.y2,x2:best.x1,y2:best.y1,r:best.r}:mepSlotMemo(best);
  }
  // met le mémo à jour sur la géométrie exacte (dérivé de la géométrie : pas d'étape d'annulation)
  function mepSlotFollow(v,m){
    if(!m||!mepGeoExact(mepGeoOf(v)))return m;
    const e=mepSlotTrack(v,m);
    if(!e||(mepSlotSameCenters(e,m,1e-9)&&Math.abs(e.x1-m.x1)<=1e-9&&Math.abs(e.y1-m.y1)<=1e-9&&Math.abs(e.r-m.r)<=1e-9))return m;
    Object.assign(m,e);
    return m;
  }
  /* point de cote accroché à un centre d'oblong */
  function mepSlotPtRefresh(v,q){
    const m=mepSlotFollow(v,q.hint.s);
    q.x=q.hint.n?m.x2:m.x1;q.y=q.hint.n?m.y2:m.y1;
    return q;
  }
  /* trait d'axe sur les 2 centres, prolongé au-delà du contour, et trait perpendiculaire sur chacun :
     orientés selon l'oblong (une croix droite serait fausse sur un oblong oblique). Le milieu de
     chaque trait perpendiculaire est un centre : l'accrochage automatique le propose. */
  function mepSlotPrims(m,v){
    const dx=m.x2-m.x1,dy=m.y2-m.y1,L=Math.hypot(dx,dy);if(!(L>1e-9))return[];
    const ux=dx/L,uy=dy/L,E=m.r+MEP_AXIS.overrun/mepAxisScale(v);
    const cross=(x,y)=>({t:'L',x1:x+uy*E,y1:y-ux*E,x2:x-uy*E,y2:y+ux*E,cls:'mepAxisCross'});
    return[{t:'L',x1:m.x1-ux*E,y1:m.y1-uy*E,x2:m.x2+ux*E,y2:m.y2+uy*E,cls:'mepAxis'},
      cross(m.x1,m.y1),cross(m.x2,m.y2)];
  }
  /* oblongs tracés en automatique : un seul pour des contours emboîtés (chanfrein : mêmes centres,
     le plus grand rayon), et pas celui qui a déjà son axe manuel */
  function mepSlotsAuto(v){
    const out=[];
    mepSlotsOf(v).slice().sort((a,b)=>b.r-a.r).forEach(s=>{
      if(!out.some(o=>mepSlotSameCenters(o,s,0.01)))out.push(s);
    });
    return out.filter(s=>!(v.axes||[]).some(a=>a&&a.kind==='slot'&&a.s&&mepSlotSameCenters(a.s,s,0.01)));
  }
  /* outil Axes : un clic sur un oblong (arc ou côté droit) pose ses 2 centres et son axe.
     false : pas d'oblong ici (ou un vrai perçage), le clic reste celui d'un cercle. */
  function mepSlotAxisClick(sh,P){
    const hit=mepHitViewEnt(sh,P.x,P.y);
    if(!hit||typeof hit.i!=='number'||!hit.e)return false;
    const v=mepView(sh,hit.vid);if(!v)return false;
    if(mepHoleAt(sh,hit.vid,hit.e,hit.i))return false;
    const s=mepSlotOfEnt(v,hit.i);if(!s)return false;
    if(!Array.isArray(v.axes))v.axes=[];
    if(v.axes.some(a=>a&&a.kind==='slot'&&a.s&&mepSlotSameCenters(a.s,s,0.01))){
      mepStatus('Cet oblong a déjà ses 2 centres et son axe.');
      return true;
    }
    mepEdit('axe d’oblong',()=>{v.axes.push({id:mepUid('ax'),kind:'slot',s:mepSlotMemo(s)});});
    mepStatus('Oblong : 2 centres et axe créés (ils suivent le modèle) — cotez depuis ces centres.');
    return true;
  }
