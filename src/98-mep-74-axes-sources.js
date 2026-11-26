// Espace PLAN — suite de la fonction englobante ouverte dans 98-mep-00-modele.js (état privé partagé, fermée dans 98-mep-95-export-init.js) : traits d'origine d'un trait d'axe, surlignés légèrement.
  /* ═══════════════ O4. traits d'origine d'un trait d'axe ═══════════════ */
  /* 2026-11-26 : « Mise en plan, traits d'axes → mettre en surbrillance légère les traits qui servent
     à leur réalisation ». Trait d'axe sélectionné (ou en cours de création : 1re droite d'un axe de
     symétrie, trous choisis pour un alignement ou un cercle de perçage) : les traits de la vue dont il
     est tiré sont soulignés d'un halo jaune orangé, sous le trait (classe mepAxisSrc, jamais exportée).
     Sources (tableau de descripteurs) :
     - {hole:{fid,pid,x,y,r,facing,dir2}} fonction Perçage — reconnue comme la cotation de perçage
       (mepHoleAt pour les cercles, mepHoleAtLine pour la paroi, le fond, le cône vus de côté) ;
     - {rev:{o,d,t0,t1,r,rs}} révolution du solide exact (cylindre d'un STEP, cercle extrudé…) —
       de bout : cercles et arcs concentriques à l'un de ses rayons ; de côté : génératrices et
       arêtes vues par la tranche, dans sa longueur ;
     - {c:{cx,cy,r}} cercle de la vue (maillage, DXF) ; {pair:[l1,l2]} les 2 droites d'un axe de
       symétrie, suivies comme l'axe lui-même ; {el} un trait de la vue ;
     - {slot} / {aslot} oblong droit / en arc : bouts, côtés (contours emboîtés compris).
     Axe automatique : p.src posé à sa création (mepAxisAutoGeom, mepAxisCylPrims) ; axe posé à la
     main : tiré de son annotation, seulement quand il est sélectionné. Axe libre : aucune source. */
  function mepAxisSrcTag(ps,src){(ps||[]).forEach(p=>{if(p)p.src=src;});return ps;}
  function mepAxisRevSrc(g){return{rev:{o:g.o,d:g.d,t0:g.t0,t1:g.t1,r:g.r,rs:g.rs}};}
  function mepAxisHoleSrc(h){
    if(!h)return null;
    if(h.fid)return{hole:{fid:h.fid,pid:h.pid,x:h.x,y:h.y,r:h.r,facing:h.facing,dir2:h.dir2}};
    if(h.rev)return{rev:h.rev};
    return{c:{cx:h.x,cy:h.y,r:h.r}};
  }
  // sources d'un axe posé à la main
  function mepAxisAnnSrc(sh,v,ann){
    if(!ann)return[];
    if(ann.kind==='sym')return ann.l1&&ann.l2?[{pair:[ann.l1,ann.l2]}]:[];
    if(ann.kind==='slot')return ann.s?[{slot:ann.s}]:[];
    if(ann.kind==='aslot')return ann.s?[{aslot:ann.s}]:[];
    if(ann.kind!=='hole'&&ann.kind!=='align'&&ann.kind!=='pitch')return[]; // axe libre
    const refs=ann.kind==='hole'?[ann.ref]:(ann.refs||[]);
    return refs.map(r=>{try{return mepAxisHoleSrc(mepAxisRefGeom(sh,v,r));}catch(e){return null;}}).filter(Boolean);
  }
  /* 2026-11-26 (suite, Fred : « il faudrait qu'il s'illumine au moment de la création », « Mais aussi
     après », « Comme maintenant ») : avec l'outil Axes, les traits qui serviront s'allument AU SURVOL,
     avant le clic (mepSt.axisHov), et ceux de l'axe qui vient d'être créé restent allumés tant que
     l'outil reste ouvert (mepSt.axisNew, posé par mepAxisNewId à chaque création). Après, sélectionner
     l'axe les rallume, comme avant. Couleur jaune orangé (« une autre couleur plus visible »). */
  function mepAxisNewId(v){const id=mepUid('ax');mepSt.axisNew={vid:v.id,id};return id;}
  // ce qu'un clic de l'outil Axes prendrait au point P de la planche : {vid, srcs} ou null (même ordre que mepAxisClick)
  function mepAxisHovCand(sh,P){
    const mode=mepSt.axisMode||'hole';
    if(mode==='free')return null;
    if(mode==='sym'){
      const hit=mepHitViewEnt(sh,P.x,P.y);
      return hit&&hit.e&&hit.e.t==='L'?{vid:hit.vid,srcs:[{el:hit.e}]}:null;
    }
    if(mode==='hole'){ // oblong droit, puis oblong en arc, d'un seul clic
      const hit=mepHitViewEnt(sh,P.x,P.y);
      const v=hit&&typeof hit.i==='number'&&hit.e?mepView(sh,hit.vid):null;
      if(v&&!mepHoleAt(sh,hit.vid,hit.e,hit.i)){
        const s=mepSlotOfEnt(v,hit.i);if(s)return{vid:v.id,srcs:[{slot:mepSlotMemo(s)}]};
        const q=mepASlotOfEnt(v,hit.i);if(q)return{vid:v.id,srcs:[{aslot:mepASlotMemo(q)}]};
      }
    }
    const ref=mepAxisHoleAt(sh,P.x,P.y);if(!ref)return null;
    const v=mepView(sh,ref.vid);if(!v)return null;
    const s=mepAxisHoleSrc(mepAxisRefGeom(sh,v,ref));
    return s?{vid:v.id,srcs:[s]}:null;
  }
  // survol de l'outil Axes : true si ce qui est allumé change (redessin à faire)
  function mepAxisHovUpdate(sh,P){
    let c=null;try{c=mepAxisHovCand(sh,P);}catch(e){c=null;}
    let key='';try{key=c?c.vid+'|'+JSON.stringify(c.srcs):'';}catch(e){}
    const o=mepSt.axisHov;
    if((o?o.key:'')===key)return false;
    mepSt.axisHov=c?{vid:c.vid,srcs:c.srcs,key}:null;
    return true;
  }
  // ce qui est à souligner dans la vue v : axe sélectionné, puis la création en cours (outil Axes)
  function mepAxisSrcWanted(sh,v){
    const out=[],sa=mepSt.selAxis;
    if(sa&&sa.vid===v.id){
      const an=sa.id?(v.axes||[]).find(a=>a&&a.id===sa.id):null;
      if(an)out.push(...mepAxisAnnSrc(sh,v,an));
      else if(sa.ak){const p=mepAxisLineByKey(sh,v,sa.ak);if(p&&!p.ann&&p.src)out.push(...p.src);}
    }
    if(mepSt.tool==='axis'){
      const nw=mepSt.axisNew; // axe qui vient d'être créé
      if(nw&&nw.vid===v.id){const an=(v.axes||[]).find(a=>a&&a.id===nw.id);if(an)out.push(...mepAxisAnnSrc(sh,v,an));}
      const hv=mepSt.axisHov; // ce que prendrait le clic
      if(hv&&hv.vid===v.id&&Array.isArray(hv.srcs))out.push(...hv.srcs);
      const f=mepSt.axisSym;if(f&&f.vid===v.id&&f.e)out.push({el:f.e});
      (mepSt.axisPick||[]).forEach(r=>{
        if(!r||r.vid!==v.id)return;
        try{const s=mepAxisHoleSrc(mepAxisRefGeom(sh,v,r));if(s)out.push(s);}catch(e){}
      });
    }
    return out.filter(Boolean);
  }
  /* 2026-11-26 (Fred : « L'illumination des arêtes ne fonctionne pas avec la fonction Symétrie des Axes ») :
     une arête vue est souvent faite de plusieurs traits alignés — un long et des morceaux posés dessus
     (Support Pédale : x = −15, de 5,55 à 49, plus 28 → 37 et 5,55 → 8). Le survol tombait sur un morceau
     de 9 mm : seul lui s'allumait. Une droite choisie allume toute l'arête : les traits alignés qui
     touchent ou chevauchent, de proche en proche (pas ceux séparés par un vide). */
  function mepAxisSrcEdge(els,idx){
    const out=new Set(idx);
    idx.forEach(i=>{
      const e=els[i];if(!e||e.t!=='L')return;
      const dx=e.x2-e.x1,dy=e.y2-e.y1,L=Math.hypot(dx,dy);if(L<1e-9)return;
      const ux=dx/L,uy=dy/L,tol=Math.max(1e-3,L*1e-5);
      const off=(x,y)=>Math.abs((x-e.x1)*uy-(y-e.y1)*ux),t=(x,y)=>(x-e.x1)*ux+(y-e.y1)*uy;
      const cand=[];els.forEach((f,j)=>{if(f&&f.t==='L'&&!out.has(j)&&off(f.x1,f.y1)<tol&&off(f.x2,f.y2)<tol)cand.push(j);});
      let lo=0,hi=L,grow=true;
      while(grow){
        grow=false;
        cand.forEach(j=>{
          if(out.has(j))return;
          const f=els[j],a=t(f.x1,f.y1),b=t(f.x2,f.y2),m=Math.min(a,b),M=Math.max(a,b);
          if(M>=lo-tol&&m<=hi+tol){out.add(j);lo=Math.min(lo,m);hi=Math.max(hi,M);grow=true;}
        });
      }
    });
    return [...out];
  }
  // n° des traits de la vue qui correspondent à une source
  function mepAxisSrcMatch(sh,v,els,s){
    const out=[];
    if(s.el){
      const i=els.indexOf(s.el);if(i>=0)return mepAxisSrcEdge(els,[i]);
      const q=s.el,n=(a,b)=>Math.abs(a-b)<=1e-6;
      els.forEach((e,j)=>{if(e.t==='L'&&q.t==='L'&&((n(e.x1,q.x1)&&n(e.y1,q.y1)&&n(e.x2,q.x2)&&n(e.y2,q.y2))||(n(e.x1,q.x2)&&n(e.y1,q.y2)&&n(e.x2,q.x1)&&n(e.y2,q.y1))))out.push(j);});
      return mepAxisSrcEdge(els,out);
    }
    if(s.pair){ // même appariement que l'axe : sans paire retrouvée, l'axe garde sa dernière position, rien à souligner
      const pr=mepAxisTrackPair(mepGeoOf(v),s.pair[0],s.pair[1]);
      return pr?mepAxisSrcEdge(els,pr.map(e=>els.indexOf(e)).filter(i=>i>=0)):[];
    }
    if(s.slot){
      mepSlotsOf(v).forEach(q=>{if(mepSlotSameCenters(q,s.slot,0.01))out.push(...q.ia,...q.ib,...q.il);});
      return out;
    }
    if(s.aslot){
      mepASlotsOf(v).forEach(q=>{if(mepASlotSame(q,s.aslot,0.01))out.push(...q.ia,...q.ib,...q.io,...q.ii);});
      return out;
    }
    if(s.c){
      const c=s.c,tol=Math.max(0.05,c.r*0.01);
      els.forEach((e,i)=>{if((e.t==='C'||e.t==='A')&&Math.hypot(e.cx-c.cx,e.cy-c.cy)<=tol&&Math.abs(e.r-c.r)<=tol)out.push(i);});
      return out;
    }
    if(s.hole){
      const H=s.hole,d2=H.dir2||[0,0],dl=Math.hypot(d2[0],d2[1]),okDir=dl>1e-9; // NaN : direction inconnue, pas de tri préalable
      const ux=okDir?d2[0]/dl:0,uy=okDir?d2[1]/dl:0,wMax=(+H.r||0)*1.3+0.5; // filetage : rayon nominal au-delà du perçage
      const mine=m=>!!m&&m.f&&m.f.id===H.fid&&m.P&&m.P.id===H.pid;
      els.forEach((e,i)=>{
        if(e.t==='C'||e.t==='A'){
          if(Math.hypot(e.cx-H.x,e.cy-H.y)<=0.5&&mine(mepHoleAt(sh,v.id,e,i)))out.push(i);
        }else if(e.t==='L'){
          if(okDir){ // tri préalable : de bout, pas de paroi ; de côté, à moins d'un rayon de l'axe
            if(Math.abs(H.facing)>=0.999)return;
            const w=(x,y)=>Math.abs((x-H.x)*uy-(y-H.y)*ux);
            if(w(e.x1,e.y1)>wMax||w(e.x2,e.y2)>wMax)return;
          }
          if(mine(mepHoleAtLine(sh,v.id,e,i)))out.push(i);
        }
      });
      return out;
    }
    if(s.rev){
      const R=s.rev,b=mepBasisOf(v),f=mepDot(R.d,b.dir);
      const rs=(Array.isArray(R.rs)&&R.rs.length?R.rs:[R.r]).filter(r=>r>1e-6);if(!rs.length)return out;
      const rMax=Math.max(...rs),tolR=r=>Math.max(0.05,r*0.01),onR=w=>rs.some(r=>Math.abs(w-r)<=tolR(r));
      const P=t=>{const p=[R.o[0]+R.d[0]*t,R.o[1]+R.d[1]*t,R.o[2]+R.d[2]*t];return{x:mepDot(p,b.u),y:mepDot(p,b.v)};};
      const t0=Number.isFinite(R.t0)?R.t0:0,t1=Number.isFinite(R.t1)?R.t1:t0;
      // points d'un trait droit ou d'une polyligne (bord dessiné en petits segments)
      const pts=e=>e.t==='L'?[[e.x1,e.y1],[e.x2,e.y2]]:(e.t==='P'&&Array.isArray(e.pts)&&e.pts.length>1?e.pts:null);
      if(Math.abs(f)>0.999){ // de bout : cercles et arcs concentriques ; bord en segments posé sur un de ses cercles
        const c=P(t0);
        els.forEach((e,i)=>{
          if(e.t==='C'||e.t==='A'){if(Math.hypot(e.cx-c.x,e.cy-c.y)<=0.05&&onR(e.r))out.push(i);return;}
          const q=pts(e);if(!q)return;
          const d0=Math.hypot(q[0][0]-c.x,q[0][1]-c.y),r0=rs.find(r=>Math.abs(d0-r)<=tolR(r));
          if(r0!=null&&q.every(p=>Math.abs(Math.hypot(p[0]-c.x,p[1]-c.y)-r0)<=tolR(r0)))out.push(i);
        });
      }else if(Math.abs(f)<0.02){ // de côté : génératrices, arêtes circulaires vues par la tranche, courbes de sortie
        const A=P(t0),B=P(t1),L=Math.hypot(B.x-A.x,B.y-A.y);if(!(L>1e-6))return out;
        const ux=(B.x-A.x)/L,uy=(B.y-A.y)/L,tl=0.05,zone=Math.min(2*rMax,L/3)+tl; // révolution courte : jamais tout le milieu
        const at=(x,y)=>({t:(x-A.x)*ux+(y-A.y)*uy,w:(x-A.x)*uy-(y-A.y)*ux});
        // trait entièrement dans la bande du rayon, près d'un bout : courbe où la révolution sort de la pièce
        // (trou qui débouche dans une face inclinée ou courbe) — pas au milieu, où passerait un trou en travers
        const auBout=q=>{const T=q.map(p=>p.t);if(!q.every(p=>Math.abs(p.w)<=rMax+tl))return false;
          const lo=Math.min(...T),hi=Math.max(...T);return (lo>=-tl&&hi<=zone)||(lo>=L-zone&&hi<=L+tl);};
        els.forEach((e,i)=>{
          const raw=pts(e);if(!raw)return;
          const ps=raw.map(p=>at(p[0],p[1]));
          if(e.t==='L'){
            const p=ps[0],q=ps[1],aw=Math.abs(p.w),bw=Math.abs(q.w);
            if(Math.abs(p.w-q.w)<=0.02){ // parallèle à l'axe, à un de ses rayons, dans sa longueur
              if(onR(aw)&&Math.max(p.t,q.t)>=-tl&&Math.min(p.t,q.t)<=L+tl&&Math.abs(p.t-q.t)>1e-6){out.push(i);return;}
            }else if(Math.abs(p.t-q.t)<=0.02&&p.t>=-tl&&p.t<=L+tl&&aw<=rMax+tl&&bw<=rMax+tl
              &&(onR(aw)||onR(bw)||aw<=tl||bw<=tl)){out.push(i);return;} // perpendiculaire : un cercle de la révolution vu par la tranche
          }
          if(auBout(ps))out.push(i);
        });
      }
      return out;
    }
    return out;
  }
  // n° des traits d'origine (sans doublon), gardés par géométrie de vue tant que les sources ne changent pas
  const mepAxisSrcMemo=new WeakMap();
  function mepAxisSrcIdx(sh,v,srcs){
    const g=mepGeoOf(v),els=(g&&g.els)||[];
    if(!srcs||!srcs.length||!els.length)return[];
    let key='';try{key=JSON.stringify(srcs);}catch(e){}
    const c=mepAxisSrcMemo.get(g);
    if(key&&c&&c.key===key&&c.els===els&&c.n===els.length)return c.idx;
    const set=new Set();
    srcs.forEach(s=>{try{mepAxisSrcMatch(sh,v,els,s).forEach(i=>{if(i>=0&&i<els.length)set.add(i);});}catch(e){}});
    const idx=[...set].sort((a,b)=>a-b);
    if(key)mepAxisSrcMemo.set(g,{key,els,n:els.length,idx});
    return idx;
  }
  // halo sous les traits d'origine (dessiné avant les traits de la vue)
  function mepDrawAxisSrc(mk,v,sh){
    let srcs=[];try{srcs=mepAxisSrcWanted(sh,v);}catch(e){return;}
    if(!srcs.length)return;
    const els=(mepGeoOf(v)||{}).els||[],idx=mepAxisSrcIdx(sh,v,srcs);
    if(!idx.length)return;
    const X=lx=>v.x+lx*v.scale,Y=ly=>v.y+ly*v.scale;
    mepEntSc=v.scale; // rayons des cercles (mepEntEl)
    idx.forEach(i=>mepEntEl(mk,els[i],X,Y,'mepAxisSrc'));
  }
