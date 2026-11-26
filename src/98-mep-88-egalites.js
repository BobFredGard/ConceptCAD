// Espace PLAN — suite de la fonction englobante ouverte dans 98-mep-00-modele.js (état privé partagé, fermée dans 98-mep-95-export-init.js) : cotes d'égalité « = ».
  /* ═══════════════ U4. cotes d'égalité « = » ═══════════════ */
  /* 2026-11-26 : « Quand on a des cotes avec un axe de symétrie évident, généralement on rajoute 2 cotes
     alignées avec des points à la place des flèches et un "=" à la place du chiffre. Peux-tu me proposer
     un outil automatique ? » — bouton « Égalités » (groupe Cotes) : chaque cote linéaire coupée en son
     milieu par un trait d'axe parallèle à ses rappels reçoit 2 cotes en chaîne (bord → axe → bord),
     terminées par des points, valeur « = ». Cote sélectionnée seulement, sinon vue sélectionnée, sinon
     toute la planche ; une cote qui a déjà ses égalités est laissée telle quelle. Aussi au clic droit
     d'une cote. Les 2 moitiés (d.eq commun, d.eqOf = cote d'origine, d.term='dot', d.txt='=') se
     déplacent et partent ensemble ; le point du milieu suit l'axe (repère axp), les bords suivent la pièce.
     Placement : entre la pièce et la cote s'il y a la place, sinon au-delà, sur une ligne libre. */
  const MEP_EQ_STEP=7; // mm papier entre deux lignes de cote parallèles
  // origine d'un rappel (mm papier) : le point coté, ou le coin d'arête d'où part le rappel
  function mepEqBase(s,e,gap){
    const dx=e.x-s.x,dy=e.y-s.y,L=Math.hypot(dx,dy);
    return L>1e-9?{x:s.x-dx/L*gap,y:s.y-dy/L*gap}:{x:s.x,y:s.y};
  }
  // trait d'axe qui coupe la cote d en son milieu, parallèle à ses rappels — null sinon
  function mepEqFind(sh,d){
    if(!sh||!d||(d.kind!=='len'&&d.kind!=='dist')||!d.b||d.eq||(d.vid2&&d.vid2!==d.vid))return null;
    const v=mepView(sh,d.vid);if(!v)return null;
    const w=mepDimWorld(sh,d),g=w&&mepDimLine(sh,d,w);if(!g)return null;
    const A=mepEqBase(g.sa,g.ea,g.gap),B=mepEqBase(g.sb,g.eb,g.gap);
    const ux=g.ux,uy=g.uy,tA=A.x*ux+A.y*uy,tB=B.x*ux+B.y*uy,L=Math.abs(tB-tA);
    if(L<1e-6)return null;
    const tm=(tA+tB)/2,tol=Math.max(0.01*v.scale,L*1e-4); // 0,01 mm sur la pièce
    let best=null,bk=Infinity;
    let axes=[];try{axes=mepAxisLines(sh,v);}catch(e){}
    axes.forEach(p=>{
      if(!p||p.t!=='L')return;
      const x1=v.x+p.x1*v.scale,y1=v.y+p.y1*v.scale,ex=(p.x2-p.x1)*v.scale,ey=(p.y2-p.y1)*v.scale,le=Math.hypot(ex,ey);
      if(le<1e-9||Math.abs((ex*ux+ey*uy)/le)>2e-3)return; // parallèle aux rappels (≈ 0,1°)
      const k=Math.abs(x1*ux+y1*uy-tm);if(k>tol)return;
      const sc=k-le*1e-6; // le plus juste, puis le plus long
      if(sc<bk){bk=sc;best={p,x1,y1,ex,ey,le};}
    });
    if(!best)return null;
    // point du milieu : croisement de l'axe et de la droite des 2 origines
    const dx=B.x-A.x,dy=B.y-A.y,nx=-best.ey/best.le,ny=best.ex/best.le,den=dx*nx+dy*ny;
    if(Math.abs(den)<1e-12)return null;
    const t=((best.x1-A.x)*nx+(best.y1-A.y)*ny)/den;
    return{v,g,A,B,M:{x:A.x+dx*t,y:A.y+dy*t},ax:best.p};
  }
  // point d'une moitié (mm papier → modèle), avec le repère du point d'origine q : il suit la pièce
  function mepEqPt(sh,v,P,q){
    const m=mepFromSheet(v,P.x,P.y),o={x:m.x,y:m.y};
    const h=q&&q.hint?JSON.parse(JSON.stringify(q.hint)):null;
    if(!h)return o;
    const fOn=(x1,y1,x2,y2)=>{const lx=x2-x1,ly=y2-y1,L2=lx*lx+ly*ly;return L2>1e-12?((o.x-x1)*lx+(o.y-y1)*ly)/L2:0;};
    if(h.t==='eln'&&h.l)h.f=fOn(h.l.x1,h.l.y1,h.l.x2,h.l.y2); // le point a glissé jusqu'au coin : sa place sur l'arête
    if(h.t==='axp'){const e=mepAxisLineByKey(sh,v,h.ak);if(e)h.f=fOn(e.bx1!=null?e.bx1:e.x1,e.by1!=null?e.by1:e.y1,e.bx2!=null?e.bx2:e.x2,e.by2!=null?e.by2:e.y2);}
    o.hint=h;
    return o;
  }
  // ligne de cote libre pour la chaîne : point (mm papier) par où elle passe
  function mepEqLinePt(sh,d,F,extra){
    const g=F.g,vx=g.vx,vy=g.vy,ux=g.ux,uy=g.uy;
    const hv=P=>P.x*vx+P.y*vy,hu=P=>P.x*ux+P.y*uy;
    const cL=hv(g.a1),sg=(cL-(hv(F.A)+hv(F.B))/2)<0?-1:1;
    const part=sg>0?Math.max(hv(F.A),hv(F.B)):Math.min(hv(F.A),hv(F.B)); // bord de la pièce côté cote
    const D0=(cL-part)*sg;
    const u0=Math.min(hu(F.A),hu(F.B))-1,u1=Math.max(hu(F.A),hu(F.B))+1;
    const busy=c=>sh.dims.concat(extra||[]).some(e=>{
      if(e===d||(e.kind!=='len'&&e.kind!=='dist'))return false;
      let ge=null;try{ge=mepDimLine(sh,e);}catch(err){}
      if(!ge||Math.abs(ge.ux*ux+ge.uy*uy)<0.999)return false;
      if(Math.abs(hv(ge.a1)-c)>=MEP_EQ_STEP*0.85)return false; // « = » écrit au-dessus de la ligne : jamais sur une cote voisine
      const e0=Math.min(hu(ge.a1),hu(ge.b1)),e1=Math.max(hu(ge.a1),hu(ge.b1));
      return e1>u0&&e0<u1;
    });
    const cand=[];
    if(D0-MEP_EQ_STEP>=MEP_EQ_STEP*0.7)cand.push(cL-sg*MEP_EQ_STEP); // entre la pièce et la cote
    for(let k=1;k<=8;k++)cand.push(cL+sg*MEP_EQ_STEP*k); // au-delà de la cote
    const c=cand.find(x=>!busy(x));
    const cc=c==null?cL+sg*MEP_EQ_STEP*9:c,s=cc-hv(F.A);
    return{x:F.A.x+vx*s,y:F.A.y+vy*s};
  }
  // les 2 moitiés « = » de la cote d (non ajoutées à la planche)
  function mepEqMake(sh,d,F,extra){
    const v=F.v,o=d.orient||'a',grp=mepUid('eq');
    // longueur d'une arête : le 2ᵉ bout n'a pas de repère, il prend celui de l'arête
    const qb=d.kind==='len'&&d.b&&!d.b.hint&&d.a&&d.a.hint&&d.a.hint.t==='seg'?d.a:d.b;
    const ak=F.ax.ak;
    const mid=()=>{
      const m=mepFromSheet(v,F.M.x,F.M.y),q={x:m.x,y:m.y};
      if(ak!=null)q.hint={t:'axp',ak,f:0};
      return ak!=null?mepEqPt(sh,v,F.M,q):q;
    };
    const Lp=mepEqLinePt(sh,d,F,extra);
    const half=(a,b)=>{
      const h={id:mepUid('d'),kind:'dist',vid:d.vid,vid2:null,a,b,orient:o,off:0,tol:null,ref:false,txt:'=',term:'dot',eq:grp,eqOf:d.id};
      const w=mepDimWorld(sh,h);if(!w)return null;
      h.off=mepDimOffsetFromPts(w.a.x,w.a.y,w.b.x,w.b.y,o,Lp);
      return h;
    };
    const h1=half(mepEqPt(sh,v,F.A,d.a),mid()),h2=half(mid(),mepEqPt(sh,v,F.B,qb));
    return h1&&h2?[h1,h2]:null;
  }
  /* commande : cote donnée (clic droit), sinon cote sélectionnée, sinon vue sélectionnée, sinon toute la planche */
  function mepEqAuto(only){
    const sh=mepSheet();if(!sh)return 0;
    let list,one=!!only;
    if(only)list=[only];
    else if(mepSt.selDim){const d=sh.dims.find(x=>x.id===mepSt.selDim);list=d?[d]:[];one=true;}
    else if(mepSt.sel)list=sh.dims.filter(d=>d.vid===mepSt.sel);
    else list=sh.dims.slice();
    const has=new Set(sh.dims.filter(d=>d.eqOf).map(d=>d.eqOf));
    const add=[];let n=0,dup=0;
    list.forEach(d=>{
      if(!d||d.eq)return;
      let F=null;try{F=mepEqFind(sh,d);}catch(e){}
      if(!F)return;
      if(has.has(d.id)){dup++;return;}
      const hs=mepEqMake(sh,d,F,add);
      if(hs){add.push(...hs);n++;}
    });
    if(!n){
      mepStatus(dup?'Égalités : déjà posées.'
        :one?'Égalités : cette cote n’est pas coupée en son milieu par un trait d’axe parallèle à ses rappels — tracez d’abord l’axe de symétrie (Axes → Symétrie).'
        :'Égalités : aucune cote symétrique par rapport à un trait d’axe'+(mepSt.sel?' dans cette vue':'')+' — tracez d’abord l’axe de symétrie (Axes → Symétrie).');
      return 0;
    }
    mepEdit('cotes d’égalité',()=>{add.forEach(h=>sh.dims.push(h));});
    try{mepSideShow();}catch(e){}
    mepStatus(n>1?n+' cotes symétriques : '+(2*n)+' cotes « = » posées — glissez-en une, sa voisine suit.'
      :'2 cotes « = » posées de part et d’autre de l’axe — glissez-en une, sa voisine suit.');
    return n;
  }
  // une moitié déplacée : sa voisine se remet sur la même ligne de cote
  function mepEqSync(sh,d){
    if(!sh||!d||!d.eq)return;
    const g=mepDimLine(sh,d);if(!g)return;
    sh.dims.forEach(p=>{
      if(p===d||p.eq!==d.eq)return;
      const w=mepDimWorld(sh,p);if(!w)return;
      p.off=mepDimOffsetFromPts(w.a.x,w.a.y,w.b.x,w.b.y,p.orient||'a',g.a1);
    });
  }
  function mepEqRemove(sh,d){
    if(!sh||!d||!d.eq)return false;
    mepEdit('retrait des cotes d’égalité',()=>{sh.dims=sh.dims.filter(x=>x.eq!==d.eq);mepSt.selDim=null;});
    try{mepSideShow();}catch(e){}
    mepStatus('Cotes « = » retirées.');
    return true;
  }
  // rayon du point qui remplace la flèche (mm papier) : ≈ 2/3 de la demi-largeur d’une flèche
  function mepEqDotR(){
    let lw=0.55;try{lw=+mepLwGet().dim||lw;}catch(e){}
    return Math.max(0.35,0.65*mepArrowGeom().h*lw);
  }
