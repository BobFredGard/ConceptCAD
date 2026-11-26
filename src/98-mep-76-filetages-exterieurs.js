// Espace PLAN — suite de la fonction englobante ouverte dans 98-mep-00-modele.js (état privé partagé, fermée dans 98-mep-95-export-init.js) : filetages extérieurs (fonction Filetage) dans les vues et leurs cotes.
  /* 2026-11-26 : FILETAGES EXTÉRIEURS (ISO 6410-1) — Fred : « Normalement ce Ø4 est un M4. La vue ne
     montre pas le filet du cylindre qui existe dans le 3D et ne cote pas comme un filetage. A corriger »
     La fonction Filetage (src/76-filetage.js, filet cosmétique) n'était lue que par la 3D ; la mise en
     plan ne connaissait que les taraudages des perçages (mepThreadEls).
       • vue de côté : fond de filet (Ø d1 = d − 1,0825·P) en trait fin sur la longueur filetée, depuis le
         bout libre (à travers le chanfrein, jusqu'à sa rencontre) ; le Ø nominal reste le contour (trait
         fort) ; trait fort de fin de filetage quand le filet s'arrête avant le bout de la face ;
       • vue en bout, bout libre vu : 3/4 de cercle fin au fond de filet (ouvert comme les taraudages) ;
       • coupe passant par l'axe : les mêmes traits (hachures jusqu'à la crête, comme la coupe les fait) ;
         coupe perpendiculaire à l'axe dans la partie filetée : le 3/4 de cercle ; autre coupe : rien ;
       • une cote Ø du cylindre fileté (entre génératrices, ou cercle vu en bout) s'écrit « M4 »
         (threadLabel : M8×1, -LH ; classe de la cote → « M4-6g »).
     Géométrie : threadGeo, résolue au rejeu (axe, bout de départ, longueur, bouts libres) ; tant qu'elle
     manque, rien n'est tracé — son arrivée change la clé des vues (mepXThreadSig dans mepGeomKey). */
  function mepXThreads(view){
    const out=[];
    if(!view||typeof threadGeo==='undefined'||typeof isoThread!=='function')return out;
    (doc.features||[]).forEach(f=>{
      if(!f||f.type!=='xthread'||f.visible===false||!f.size)return;
      if(f.model&&typeof threadModelable==='function'&&threadModelable(f)&&!f._err)return; // filet modélisé : dans le solide
      if(typeof tlLocked==='function'&&tlLocked(f))return; // après le marqueur de l'historique
      const g=threadGeo.get(f.id);if(!g||!Array.isArray(g.o)||!Array.isArray(g.d))return;
      const fb=(typeof occBodyOfFeat==='function'?occBodyOfFeat(f):f.body)||g.bid||null;
      if(view.bodyId&&fb&&fb!==view.bodyId)return;
      if(typeof holeThreadBodyShown==='function'&&!holeThreadBodyShown(fb))return;
      const span=g.span>0?g.span:g.len,full=f.lenMode!=='len'||g.len>=span-1e-6;
      out.push({f,O:g.o,D:mepNorm(g.d),R:g.R,rR:g.rR,len:g.len,span,full,
        f0:g.free&&g.f0>0?g.f0:0,f1:g.f1>0?g.f1:null,lbl:typeof threadLabel==='function'?threadLabel(f):f.size});
    });
    return out;
  }
  function mepXThreadSig(){
    if(typeof threadGeo==='undefined')return '';
    let s='';
    (doc.features||[]).forEach(f=>{
      if(!f||f.type!=='xthread')return;
      const g=threadGeo.get(f.id);
      s+=f.id+(g&&Array.isArray(g.o)?':'+g.o.map(x=>(+x).toFixed(4)).join(',')+'/'+(+g.len).toFixed(4)+'/'+(+g.f0||0).toFixed(3):'-')+';';
    });
    return s;
  }
  // fin d'un fond de filet à un bout libre : sa première rencontre avec le contour de la vue en partant
  // du bout (chanfrein, bout plat), entre lo et hi le long de l'axe — la plus proche du bout (side −1 :
  // la plus petite, +1 : la plus grande) ; un chanfrein fait APRÈS le filetage dans l'historique n'est
  // pas vu par le rejeu du filet (départ au bout plat), d'où la recherche sur tout un rayon
  function mepXThreadClip(els,o,u,n,off,lo,hi,side){
    let best=null;
    (els||[]).forEach(e=>{
      if(!e||e.t!=='L'||e.xt||e.k==='thread'||e.k==='threadH'||e.k==='hidden')return;
      const p1=[e.x1-o[0],e.y1-o[1]],p2=[e.x2-o[0],e.y2-o[1]];
      const t1=p1[0]*u[0]+p1[1]*u[1],t2=p2[0]*u[0]+p2[1]*u[1],s1=p1[0]*n[0]+p1[1]*n[1]-off,s2=p2[0]*n[0]+p2[1]*n[1]-off;
      if(s1*s2>0||Math.abs(s1-s2)<1e-9)return; // ne coupe pas le fond de filet (ou lui est parallèle)
      const t=t1+(t2-t1)*(s1/(s1-s2));
      if(t<lo||t>hi)return;
      if(best===null||(side<0?t<best:t>best))best=t;
    });
    return best;
  }
  function mepXThreadEls(view,els){
    const out=[];
    if(!view||mepOblOf(view)||mepPerspOf(view))return out;
    const L=mepXThreads(view);if(!L.length)return out;
    const b=mepBasisOf(view),dot=mepDot;
    const planes=view.section?((view._step&&view._step.planes)||[view.section.p]):null;
    const nS=view.section?mepNorm(view.section.n):null;
    L.forEach(T=>{
      const w=T.O,D=T.D;
      const P3=t=>[w[0]+D[0]*t,w[1]+D[1]*t,w[2]+D[2]*t];
      const at=t=>{const q=P3(t);return[dot(q,b.u),dot(q,b.v)];};
      const tA=-T.f0,tB=T.full?T.span+(T.f1!=null?T.f1:0):T.len; // étendue du fond de filet le long de D
      const facing=dot(D,b.dir);
      if(Math.abs(facing)>0.999){
        if(planes){
          const s=(p0,t)=>{const q=P3(t);return dot(nS,[q[0]-p0[0],q[1]-p0[1],q[2]-p0[2]]);};
          if(!planes.some(p0=>s(p0,tA)*s(p0,tB)<=0))return; // la coupe ne traverse pas la partie filetée
        }else if(!(facing<0||(T.full&&T.f1!=null)))return; // bout libre tourné vers l'observateur
        const c=at(facing<0?0:T.span);
        out.push({t:'A',cx:c[0],cy:c[1],r:T.rR,a0:0,a1:1.5*Math.PI,k:'thread',xt:1});
        return;
      }
      if(Math.abs(facing)>0.02)return; // axe oblique à la vue : pas de convention simple
      if(planes){
        const inCut=Math.abs(dot(nS,D))<0.02&&planes.some(p0=>Math.abs(dot(nS,[w[0]-p0[0],w[1]-p0[1],w[2]-p0[2]]))<T.rR);
        if(!inCut)return; // coupe à côté de l'axe : rien
      }
      const o=at(0),q=at(1),ul=Math.hypot(q[0]-o[0],q[1]-o[1])||1,u=[(q[0]-o[0])/ul,(q[1]-o[1])/ul],n=[-u[1],u[0]];
      const P2=(t,s)=>[o[0]+u[0]*t+n[0]*s,o[1]+u[1]*t+n[1]*s];
      [-1,1].forEach(sg=>{
        const off=sg*T.rR;
        let a=tA,e=tB;
        if(T.f0>0){const c=mepXThreadClip(els,o,u,n,off,tA-0.1,Math.min(tA+T.R,T.len),-1);a=c!=null?c:Math.min(0,tA+0.02);}
        if(T.full&&T.f1!=null){const c=mepXThreadClip(els,o,u,n,off,Math.max(tB-T.R,a),tB+0.1,1);e=c!=null?c:Math.max(T.span,tB-0.02);}
        const p=P2(a,off),r=P2(e,off);
        out.push({t:'L',x1:p[0],y1:p[1],x2:r[0],y2:r[1],k:'thread',xt:1});
      });
      if(!T.full){ // fin de filetage avant le bout de la face : trait fort jusqu'au Ø nominal
        const p=P2(T.len,-T.R),r=P2(T.len,T.R);
        out.push({t:'L',x1:p[0],y1:p[1],x2:r[0],y2:r[1],k:'sharp',xt:1});
      }
    });
    return out;
  }
  /* cote Ø du cylindre fileté → désignation du filetage. Cote linéaire « Ø » (entre génératrices,
     perpendiculaire à l'axe, centrée dessus, dans la partie filetée, longueur 2R) ou cote de diamètre
     sur le cercle vu en bout. */
  function mepDimThreadOf(sh,d){
    if(!d||d.txt||!(d.dsym==='Ø'||d.kind==='dia'))return null;
    if(d.kind!=='dia'&&d.kind!=='len'&&d.kind!=='dist')return null;
    if(d.vid2&&d.vid2!==d.vid)return null;
    const v=mepView(sh,d.vid);if(!v||mepOblOf(v)||mepPerspOf(v))return null;
    const L=mepXThreads(v);if(!L.length)return null;
    const b=mepBasisOf(v),tol=0.01;
    if(d.kind==='dia'){
      const e=d.a&&d.a.hint?mepEntByHint(v,d.a.hint):null;
      if(!e||(e.t!=='C'&&e.t!=='A')||e.xt)return null;
      return L.find(T=>Math.abs(mepDot(T.D,b.dir))>0.999&&Math.abs(e.r-T.R)<tol&&Math.hypot(e.cx-mepDot(T.O,b.u),e.cy-mepDot(T.O,b.v))<tol)||null;
    }
    let A=d.a,B=d.b;
    if(d.kind==='len'&&d.a&&d.a.hint){const e=mepEntByHint(v,d.a.hint);if(e&&e.t==='L'){A={x:e.x1,y:e.y1};B={x:e.x2,y:e.y2};}}
    if(!A||!B)return null;
    const o=d.orient||'a';
    if(o==='h')B={x:B.x,y:A.y};else if(o==='v')B={x:A.x,y:B.y};
    const len=Math.hypot(B.x-A.x,B.y-A.y);if(len<1e-6)return null;
    const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
    return L.find(T=>{
      if(Math.abs(mepDot(T.D,b.dir))>0.02)return false;
      let dx=mepDot(T.D,b.u),dy=mepDot(T.D,b.v);const l=Math.hypot(dx,dy);if(l<1e-9)return false;
      dx/=l;dy/=l;
      if(Math.abs(((B.x-A.x)*dx+(B.y-A.y)*dy)/len)>1e-3)return false; // ⟂ à l'axe
      const ox=mepDot(T.O,b.u),oy=mepDot(T.O,b.v);
      if(Math.abs((mx-ox)*-dy+(my-oy)*dx)>tol)return false; // milieu sur l'axe
      const t=((mx-ox)*dx+(my-oy)*dy)/l;
      if(t<-T.f0-tol||t>(T.full?T.span+(T.f1||0):T.len)+tol)return false; // dans la partie filetée
      return Math.abs(len-2*T.R)<tol;
    })||null;
  }
  const mepDimThrLbl=new WeakMap(); // cote → désignation du filetage mesuré (relue à chaque dessin)
  function mepDimThreadSync(sh,d){
    let T=null;try{T=mepDimThreadOf(sh,d);}catch(e){T=null;}
    if(T)mepDimThrLbl.set(d,T.lbl);else mepDimThrLbl.delete(d);
    return T;
  }
  function mepDimThreadText(d){
    if(!d||d.txt||!(d.dsym==='Ø'||d.kind==='dia'))return null;
    const lbl=mepDimThrLbl.get(d);if(!lbl)return null;
    const pre=d.pre?String(d.pre).trim():'',post=d.post?String(d.post).trim():'';
    const t=d.tol||{},s=lbl+(t.m==='cls'&&t.cls&&String(t.cls).indexOf('/')<0?'-'+String(t.cls).trim():'');
    return [pre,s,post].filter(x=>x).join(' ');
  }
