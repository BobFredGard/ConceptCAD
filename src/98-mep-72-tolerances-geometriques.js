// Espace PLAN — suite de la fonction englobante ouverte dans 98-mep-00-modele.js (état privé partagé, fermée dans 98-mep-95-export-init.js) : tolérances géométriques ISO 1101 et références ISO 5459.
  /* ═══════════════ O4. tolérances géométriques (ISO 1101) et références (ISO 5459) ═══════════════ */
  /* 2026-11-09 : « Mise en plan : ajouter un outil de tolérances géométriques ISO ». Fred a choisi : l'outil
     qui crée les références A, B, C…, le cadre de tolérance, le symbole de référence, la flèche sur une
     arête et l'accrochage à une cote. Deux nouvelles sortes de cote (même sélection, glisser, Suppr,
     annulation et export que les autres) :
     - d.kind 'gdt'   : cadre de tolérance. d.g = {sym, dia, val, mod, refs:[{l,m}]} ; soit d.a (pointe de
       la flèche, accrochée à la pièce comme une note) et d.b (point d'attache du cadre, mm locaux de la
       vue), soit d.on = id d'une cote : le cadre se place sous sa valeur et la suit.
     - d.kind 'datum' : symbole de référence (lettre encadrée, triangle noirci). d.l = lettre ; soit d.a
       (pied du triangle sur l'arête) et d.b (centre du carré), soit d.on = id d'une cote de longueur ou
       de distance et d.end (0 | 1) : le triangle prolonge la ligne de cote (référence = axe ou plan médian).
     Les symboles sont dessinés en traits (pas de police spéciale) : l'export SVG, DXF et PDF les garde. */
  const MEP_GDT_SYMS=[
    ['straight','Rectitude','Forme'],['flat','Planéité','Forme'],['circ','Circularité','Forme'],['cyl','Cylindricité','Forme'],
    ['pline','Forme d’une ligne','Profil'],['psurf','Forme d’une surface','Profil'],
    ['par','Parallélisme','Orientation'],['perp','Perpendicularité','Orientation'],['ang','Inclinaison','Orientation'],
    ['pos','Localisation','Position'],['conc','Coaxialité, concentricité','Position'],['sym','Symétrie','Position'],
    ['runc','Battement circulaire','Battement'],['runt','Battement total','Battement']];
  const MEP_GDT_FORME=new Set(['straight','flat','circ','cyl']); // jamais de référence
  const MEP_GDT_REF=new Set(['par','perp','ang','conc','sym','runc','runt']); // référence obligatoire
  const MEP_GDT_MODS=[['','aucun'],['M','Ⓜ maximum de matière'],['L','Ⓛ minimum de matière'],['E','Ⓔ exigence de l’enveloppe'],
    ['P','Ⓟ zone de tolérance projetée'],['F','Ⓕ état libre'],['CZ','CZ zone commune']];
  const MEP_GDT_LETTERS='ABCDEFGHJKLMNPRSTUVWXYZ'; // ISO 5459 : ni I, ni O, ni Q
  let mepGdtLast=null; // dernier cadre réglé : le suivant reprend son symbole et sa valeur
  function mepGdtName(k){const s=MEP_GDT_SYMS.find(x=>x[0]===k);return s?s[1]:k;}
  // lettres de référence déjà posées sur tout le plan
  function mepGdtLetters(){
    const out=new Set();
    try{(doc.mep.sheets||[]).forEach(s=>(s.dims||[]).forEach(d=>{if(d&&d.kind==='datum'&&d.l)out.add(String(d.l).toUpperCase());}));}catch(e){}
    return out;
  }
  function mepGdtNextLetter(){
    const used=mepGdtLetters();
    for(const c of MEP_GDT_LETTERS)if(!used.has(c))return c;
    for(const c of MEP_GDT_LETTERS)if(!used.has('A'+c))return 'A'+c;
    return '?';
  }
  function mepGdtTh(){return MEP_DIM_STYLE.textHeight||7;}
  function mepGdtH(){return mepGdtTh()*1.25;} // hauteur d'une case du cadre (≈ 2 × hauteur des majuscules)
  // la cote qui porte un cadre ou une référence (pas une autre tolérance)
  function mepGdtHost(sh,d){
    if(!d.on)return null;
    const t=sh.dims.find(x=>x.id===d.on);
    return t&&t!==d&&!mepIsTol(t.kind)?t:null;
  }
  /* 2026-11-26 : « Pouvoir empiler/ajouter une autre tolérance géométrique en dessous une existante. Le menu
     permet la création d'un 2nd et une 3ème » — cadres empilés (ISO 1101) : d.under = id du cadre du dessus.
     Pas de flèche à lui : collé sous le cadre du dessus (bords alignés du côté de la ligne de repère), il le
     suit ; 3 cadres au plus par pile. Glisser un cadre de la pile déplace toute la pile ; Suppr du 1er
     retire la pile, d'un cadre du milieu : celui d'en dessous remonte. Clic droit sur un cadre ou bouton
     du panneau « + Cadre en dessous ». */
  const MEP_GDT_STACK_MAX=3;
  function mepGdtAbove(sh,d){return d&&d.under?sh.dims.find(x=>x.id===d.under&&x.kind==='gdt')||null:null;}
  // cadres de la pile de d, de haut en bas
  function mepGdtStack(sh,d){
    let r=d,k=0;
    while(r&&r.under&&k++<8){const a=mepGdtAbove(sh,r);if(!a)break;r=a;}
    const out=[r];let c=r;k=0;
    while(k++<8){const n=sh.dims.find(x=>x.kind==='gdt'&&x.under===c.id&&out.indexOf(x)<0);if(!n)break;out.push(n);c=n;}
    return out;
  }
  // cadre dessiné (mm papier) {x0,x1,y0,y1,right : ligne de repère à droite} — sans dessiner
  function mepGdtBoxCalc(sh,d,k){
    if(!d||d.kind!=='gdt'||(k|0)>8)return null;
    const H=mepGdtH(),s=mepGdtFrame(null,d,0,0,null,null,null,true),W=s.x1-s.x0;
    if(d.under){
      const P=mepGdtBoxCalc(sh,mepGdtAbove(sh,d),(k|0)+1);if(!P)return null;
      const x0=P.right?P.x1-W:P.x0;
      return{x0,x1:x0+W,y0:P.y1,y1:P.y1+H,right:P.right};
    }
    const w=mepGdtWorld(sh,d);if(!w)return null;
    if(d.on){const o=mepGdtOnX0(sh,w,W);return{x0:o.x0,x1:o.x0+W,y0:w.b.y,y1:w.b.y+H,right:o.right};}
    const left=w.a.x<=w.b.x,x0=left?w.b.x:w.b.x-W;
    return{x0,x1:x0+W,y0:w.b.y-H/2,y1:w.b.y+H/2,right:!left};
  }
  /* 2026-11-27 (essai cotes 3D, Fred : « aligner les tolérances géométriques à gauche ou à droite en fonction de la
     position de la cote ») : sous une étiquette à ligne de repère (Ø, R, perçage, note), le cadre part du bout où
     arrive le trait — calé à droite quand le texte est à gauche du trait (ancre 'end'), à gauche sinon ; la pile
     suit (right). Sous une cote droite, texte centré sur son trait : cadre centré sous la valeur. */
  function mepDimCalloutEnd(sh,t){
    if(!t||!(t.kind==='dia'||t.kind==='rad'||t.kind==='hole'||t.kind==='note'))return null;
    const w=mepDimWorld(sh,t);if(!w||!w.b)return null;
    let cx=w.a.x;
    try{const e=t.a&&t.a.hint?mepEntByHint(w.v1,t.a.hint):null;if(e&&(e.t==='C'||e.t==='A'))cx=mepToSheet(w.v1,e.cx,e.cy).x;}catch(e){}
    return w.b.x-cx<0; // même règle que le dessin du texte (ux < 0 → 'end')
  }
  function mepGdtOnX0(sh,w,W){
    const end=w&&w.host?mepDimCalloutEnd(sh,w.host):null;
    if(end===true)return{x0:w.b.x-W,right:true};
    if(end===false)return{x0:w.b.x,right:false};
    return{x0:w.b.x-W/2,right:false};
  }
  function mepGdtStackAdd(sh,d){
    if(!sh||!d||d.kind!=='gdt')return null;
    const st=mepGdtStack(sh,d);
    if(st.length>=MEP_GDT_STACK_MAX){mepStatus('Tolérance : '+MEP_GDT_STACK_MAX+' cadres empilés au plus.');return null;}
    const last=st[st.length-1];
    const n={id:mepUid('d'),kind:'gdt',vid:last.vid,vid2:null,under:last.id,g:mepGdtNew()};
    mepEdit('cadre de tolérance empilé',()=>{sh.dims.push(n);});
    mepDimClearSelection();mepSt.selDim=n.id;mepSt.sel=null;
    mepSideShow();mepRender();
    mepStatus((st.length+1)+'ᵉ cadre ajouté sous le précédent — réglez-le dans le panneau.');
    return n;
  }
  function mepGdtCtx(sh,d,ev){
    mepSt.selDim=d.id;mepSt.sel=null;mepSt.entSel=[];
    mepSideShow();mepRender();
    const st=mepGdtStack(sh,d),n=st.length,i=st.indexOf(d);
    const it=[];
    if(n<MEP_GDT_STACK_MAX)it.push(['   Ajouter un cadre en dessous ('+(n+1)+'ᵉ)',()=>mepGdtStackAdd(sh,d)]);
    it.push(['   Supprimer ce cadre'+(i===0&&n>1?' (et ceux du dessous)':''),()=>{
      mepEdit('suppression tolérance',()=>{sh.dims=mepDimsWithout(sh,d.id);mepSt.selDim=null;});mepSideShow();}]);
    mepCtxMenu(ev.clientX,ev.clientY,'Tolérance géométrique'+(n>1?' — cadre '+(i+1)+' / '+n:''),it);
  }
  /* cotes restantes après suppression de la cote id : avec ce qui en dépend (tolérances accrochées, cadres
     empilés dessous) ; un cadre empilé retiré du milieu : celui d'en dessous remonte sous celui du dessus */
  function mepDimsWithout(sh,id){
    const d=sh.dims.find(x=>x.id===id);
    const up=d&&d.kind==='gdt'&&d.under?d.under:null;
    const gone=new Set([id]);
    let grow=true;
    while(grow){
      grow=false;
      sh.dims.forEach(x=>{
        if(gone.has(x.id))return;
        if((x.on&&gone.has(x.on))||(x.under&&gone.has(x.under)&&!(up&&x.under===id))){gone.add(x.id);grow=true;}
      });
    }
    return sh.dims.filter(x=>!gone.has(x.id)).map(x=>{if(up&&x.under===id)x.under=up;return x;});
  }
  // hauteur (mm papier) du trait souligné d'une étiquette à ligne de repère dont le texte est posé en y
  function mepGdtUnderY(t,y){
    const hh=MEP_TEXT_STYLE.dimH,fs=MEP_DIM_STYLE.textHeight||7;
    let n=1;
    if(t.kind==='hole'||t.kind==='note')n=String(t.txt||(t.kind==='hole'?(t.holeN>1?t.holeN+'× ':'')+(t.holeText||''):'')).split('\n').length;
    return y+hh*0.4+(n-1)*fs*1.2/2+mepDimUnderOff(hh);
  }
  /* ancrages en mm papier : {a (pointe / pied), b (cadre / carré), v1, u (direction imposée)} */
  function mepGdtWorld(sh,d){
    const v1=mepView(sh,d.vid);if(!v1)return null;
    if(d.under){ // cadre empilé : coin haut gauche de son cadre
      const B=mepGdtBoxCalc(sh,d);if(!B)return null;
      const p={x:B.x0,y:B.y0};
      return{a:p,b:p,v1,box:B};
    }
    if(d.on){
      const t=mepGdtHost(sh,d);if(!t)return null;
      if(d.kind==='gdt'){
        const tp=mepDimTextPos(sh,t);if(!tp)return null;
        let p={x:tp.x,y:tp.y+mepGdtTh()*0.55};
        // cote verticale : son texte est couché le long du trait → le cadre passe sous le bout du texte
        // (2026-11-27, essai cotes 3D : le cadre recouvrait la moitié du texte)
        if(t.kind==='dist'||t.kind==='len'){try{const g=mepDimLine(sh,t);if(g&&Math.abs(g.uy)>0.9){
          const s=String(mepDimText(t,mepDimMeasure(sh,t))||''),th=MEP_DIM_STYLE.textHeight||3.5;
          p={x:tp.x,y:tp.y+s.length*th*0.31+th*0.6};}}catch(e){}}
        // étiquette à ligne de repère : le cadre SOUS le trait souligné, pas dessus (Fred, 27/11 : « La tolérance
        // géométrique devrait être en-dessous le trait de cote ») — même calcul que le dessin (98-mep-70
        // mepHoleCallout) : lignes centrées sur le point du texte, trait sous la dernière
        if(t.kind==='dia'||t.kind==='rad'||t.kind==='hole'||t.kind==='note')p={x:tp.x,y:mepGdtUnderY(t,tp.y)+mepGdtTh()*0.3};
        return{a:p,b:p,v1,host:t};
      }
      const g=mepDimLine(sh,t);if(!g)return null;
      const E=d.end?g.b1:g.a1,O=d.end?g.a1:g.b1;
      let ux=E.x-O.x,uy=E.y-O.y;const L=Math.hypot(ux,uy)||1;ux/=L;uy/=L;
      const H=mepGdtH(),k=H*0.75+H*0.9+H/2; // triangle, attache, demi-carré
      return{a:{x:E.x,y:E.y},b:{x:E.x+ux*k,y:E.y+uy*k},v1,u:{x:ux,y:uy},host:t};
    }
    if(!d.a||!d.b)return null;
    try{mepDimPtsRefresh(sh,d);}catch(e){}
    return{a:mepToSheet(v1,d.a.x,d.a.y),b:mepToSheet(v1,d.b.x,d.b.y),v1};
  }
  // direction de l'arête sous le pied d'une référence (mm papier), null sur un cercle ou dans le vide
  function mepGdtEdgeDir(v,q){
    const g=mepGeoOf(v);if(!g||!g.els)return null;
    let best=null,bd=0.05/Math.max(v.scale,1e-9)+0.05;
    g.els.forEach(e=>{if(e.t!=='L')return;const dd=mepSegDist(q,e);if(dd<bd){bd=dd;best=e;}});
    if(!best)return null;
    const dx=best.x2-best.x1,dy=best.y2-best.y1,L=Math.hypot(dx,dy);
    return L>1e-9?{x:dx/L,y:dy/L}:null;
  }
  /* 2026-11-26 : « Les tolérances géométriques devraient avoir leur flèche perpendiculaire à l'arête
     choisie » — normale unitaire (repère de la vue, même sens que le papier) à l'élément sous la
     pointe : la droite de l'accrochage d'abord (un sommet touche 2 arêtes), sinon la droite, le cercle
     ou l'arc le plus proche (normale = rayon) ; null dans le vide. Sert au cadre et à la référence. */
  function mepGdtNormal(v,q){
    if(!v||!q)return null;
    const g=mepGeoOf(v),els=(g&&g.els)||[],h=q.hint,tol=0.05/Math.max(v.scale,1e-9)+0.05;
    const nL=e=>{const dx=e.x2-e.x1,dy=e.y2-e.y1,L=Math.hypot(dx,dy);return L>1e-9?{x:-dy/L,y:dx/L}:null;};
    const nC=e=>{const dx=q.x-e.cx,dy=q.y-e.cy,L=Math.hypot(dx,dy);return L>1e-9?{x:dx/L,y:dy/L}:null;};
    if(h&&h.t==='eln'&&h.l)return nL(h.l);
    if(h&&h.t==='seg'&&typeof h.i==='number'){const e=els[h.i];if(e&&e.t==='L'&&mepSegDist(q,e)<tol)return nL(e);}
    let best=null,bd=tol;
    els.forEach(e=>{
      let dd=Infinity;
      if(e.t==='L')dd=mepSegDist(q,e);
      else if(e.t==='C'||(e.t==='A'&&mepArcIn(e,Math.atan2(q.y-e.cy,q.x-e.cx))))dd=Math.abs(Math.hypot(q.x-e.cx,q.y-e.cy)-e.r);
      if(dd<bd){bd=dd;best=e;}
    });
    return best?(best.t==='L'?nL(best):nC(best)):null;
  }
  /* ----- symboles dessinés en traits ----- */
  function mepGdtSymbol(draw,k,cx,cy,H,L,F){
    const u=H*0.3,ln=(x1,y1,x2,y2)=>draw('line',Object.assign({x1:cx+x1*u,y1:cy+y1*u,x2:cx+x2*u,y2:cy+y2*u},L));
    const ci=(r,x,y)=>draw('circle',Object.assign({cx:cx+(x||0)*u,cy:cy+(y||0)*u,r:r*u},L));
    const pa=(dd,o)=>draw('path',Object.assign({d:dd},o||L));
    const P=(x,y)=>(cx+x*u).toFixed(3)+' '+(cy+y*u).toFixed(3);
    const fleche=(x1,y1,x2,y2)=>{ // trait + pointe noircie
      ln(x1,y1,x2,y2);
      const dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy)||1,ex=dx/l,ey=dy/l,h=0.6;
      pa('M '+P(x2,y2)+' L '+P(x2-ex*h-ey*h*0.35,y2-ey*h+ex*h*0.35)+' L '+P(x2-ex*h+ey*h*0.35,y2-ey*h-ex*h*0.35)+' Z',F);
    };
    switch(k){
      case 'straight':ln(-1,0,1,0);break;
      case 'flat':pa('M '+P(-1,0.45)+' L '+P(0.55,0.45)+' L '+P(1,-0.45)+' L '+P(-0.55,-0.45)+' Z');break;
      case 'circ':ci(0.8);break;
      case 'cyl':{ci(0.55);const s=Math.sin(Math.PI/3),c=Math.cos(Math.PI/3);
        [1,-1].forEach(g=>ln(g*0.55*s-c*1.05,g*0.55*c+s*1.05,g*0.55*s+c*1.05,g*0.55*c-s*1.05));break;}
      case 'pline':pa('M '+P(-1,0.45)+' A '+u+' '+u+' 0 0 1 '+P(1,0.45));break;
      case 'psurf':pa('M '+P(-1,0.45)+' A '+u+' '+u+' 0 0 1 '+P(1,0.45)+' Z');break;
      case 'par':ln(-0.95,0.8,-0.15,-0.8);ln(0.15,0.8,0.95,-0.8);break;
      case 'perp':ln(-1,0.8,1,0.8);ln(0,0.8,0,-0.9);break;
      case 'ang':ln(-1,0.8,1,0.8);ln(-1,0.8,0.75,-0.8);break;
      case 'pos':ci(0.55);ln(-1,0,1,0);ln(0,-1,0,1);break;
      case 'conc':ci(0.4);ci(0.85);break;
      case 'sym':ln(-0.6,-0.5,0.6,-0.5);ln(-1,0,1,0);ln(-0.6,0.5,0.6,0.5);break;
      case 'runc':fleche(-0.7,0.85,0.6,-0.85);break;
      case 'runt':ln(-0.9,0.85,0.2,0.85);fleche(-0.9,0.85,-0.15,-0.85);fleche(0.2,0.85,0.95,-0.85);break;
    }
  }
  // lettre entourée (Ⓜ Ⓛ…) : texte + cercle → largeur
  function mepGdtCircled(draw,T,L,x,cy,ch){
    const th=mepGdtTh(),r=th*0.42;
    const t=draw('text',Object.assign({x:x+r,y:cy+th*0.3,'text-anchor':'middle',style:'font-size:'+(th*0.62).toFixed(3)+'px'},T));t.textContent=ch;
    draw('circle',Object.assign({cx:x+r,cy,r},L));
    return 2*r;
  }
  function mepGdtValText(v){
    const s=String(v==null?'':v).trim();
    if(/^-?\d+(\.\d+)?$/.test(s)){const n=(s.split('.')[1]||'').length;try{return mepFmtNum(+s,n);}catch(e){}}
    return s;
  }
  /* cadre de tolérance : x0 = bord gauche, cy = milieu → {x0,x1,y0,y1} */
  function mepGdtFrame(draw,d,x0,cy,T,L,F,dryRun){
    const g=d.g||{},H=mepGdtH(),th=mepGdtTh(),pad=th*0.35,gap=th*0.15,y0=cy-H/2,y1=cy+H/2;
    const tw=s=>String(s||'').length*th*0.6; // largeur avant mesure (le texte se recale ensuite)
    const cells=[];
    cells.push({w:H,draw:x=>mepGdtSymbol(draw,g.sym,x+H/2,cy,H,L,F)});
    const main=(g.dia?'Ø':'')+mepGdtValText(g.val||'0');
    const modW=g.mod?(g.mod==='CZ'?tw(' CZ'):th*0.84+gap):0;
    cells.push({w:pad*2+tw(main)+modW,draw:x=>{
      const t=draw('text',Object.assign({x:x+pad,y:cy+th*0.35,'text-anchor':'start'},T));t.textContent=main;
      let xx=x+pad+mepTxtW(t,main,th);
      if(g.mod==='CZ'){const c=draw('text',Object.assign({x:xx+gap,y:cy+th*0.35,'text-anchor':'start'},T));c.textContent='CZ';}
      else if(g.mod)mepGdtCircled(draw,T,L,xx+gap,cy,g.mod);
    }});
    (g.refs||[]).filter(r=>r&&r.l).forEach(r=>{
      const w=Math.max(H,pad*2+tw(r.l)+(r.m?th*0.84+gap:0));
      cells.push({w,draw:x=>{
        const t=draw('text',Object.assign({x:x+pad,y:cy+th*0.35,'text-anchor':'start'},T));t.textContent=r.l;
        const lw=mepTxtW(t,r.l,th),tot=lw+(r.m?gap+th*0.84:0),xs=x+(w-tot)/2;
        t.setAttribute('x',String(xs));
        if(r.m)mepGdtCircled(draw,T,L,xs+lw+gap,cy,r.m);
      }});
    });
    const W=cells.reduce((s,c)=>s+c.w,0);
    if(dryRun)return{x0,x1:x0+W,y0,y1};
    draw('line',Object.assign({x1:x0,y1:y0,x2:x0+W,y2:y0},L));
    draw('line',Object.assign({x1:x0,y1:y1,x2:x0+W,y2:y1},L));
    let x=x0;
    cells.forEach(c=>{draw('line',Object.assign({x1:x,y1:y0,x2:x,y2:y1},L));c.draw(x);x+=c.w;});
    draw('line',Object.assign({x1:x,y1:y0,x2:x,y2:y1},L));
    return{x0,x1:x0+W,y0,y1};
  }
  /* ligne de repère d'un cadre : A = pointe (sur l'arête), S = bout de l'attache du cadre, n = normale.
     Le dernier tronçon (flèche) suit la normale, tournée vers le cadre ; son coude K est le pied de S
     sur cette normale : arête horizontale → descente verticale sous un trait horizontal, arête
     verticale → flèche horizontale. Longueur mini de la flèche : 0,75 case. → {k (coude) | null} */
  function mepGdtLeader(A,S,n,H){
    if(!n)return{k:null}; // dans le vide : droit vers la pointe, comme avant
    let nx=n.x,ny=n.y,t=(S.x-A.x)*nx+(S.y-A.y)*ny;
    if(t<0){nx=-nx;ny=-ny;t=-t;} // côté du cadre (hors matière)
    t=Math.max(t,H*0.75);
    const k={x:A.x+nx*t,y:A.y+ny*t};
    return{k:Math.hypot(k.x-S.x,k.y-S.y)>1e-6?k:null,n:{x:nx,y:ny}};
  }
  const mepGdtBoxes=new WeakMap(); // cote → cadre dessiné (mm papier) : clic dedans = la saisir
  function mepDrawGdt(draw,d,sh,L,T,AR){
    if(d.kind==='rough'){mepDrawRough(draw,d,sh,L,T,AR);return;} // 98-mep-73
    const w=mepGdtWorld(sh,d);if(!w)return;
    const H=mepGdtH(),F=Object.assign({},L,{class:L.class+' mepGdtFill'});
    if(d.kind==='gdt'){
      if(d.under){ // cadre empilé : collé sous celui du dessus, sans flèche
        const B=w.box;mepGdtBoxes.set(d,mepGdtFrame(draw,d,B.x0,(B.y0+B.y1)/2,T,L,F));
        return;
      }
      if(d.on){ // sous la valeur de la cote : centré, ou calé du côté où arrive la ligne de repère
        const s=mepGdtFrame(draw,d,0,0,T,L,F,true),W=s.x1-s.x0;
        mepGdtBoxes.set(d,mepGdtFrame(draw,d,mepGdtOnX0(sh,w,W).x0,w.b.y+H/2,T,L,F));
        return;
      }
      const s=mepGdtFrame(draw,d,0,0,T,L,F,true),W=s.x1-s.x0;
      const left=w.a.x<=w.b.x; // la flèche part du côté du cadre tourné vers la pièce
      const x0=left?w.b.x:w.b.x-W;
      const box=mepGdtFrame(draw,d,x0,w.b.y,T,L,F);mepGdtBoxes.set(d,box);
      const ax=left?box.x0:box.x1;
      // attache : petit trait horizontal hors du cadre, puis la ligne de repère vers la pointe
      const kx=ax+(left?-H*0.5:H*0.5),S={x:kx,y:w.b.y};
      draw('line',Object.assign({x1:ax,y1:w.b.y,x2:kx,y2:w.b.y},L));
      const G=mepGdtLeader(w.a,S,mepGdtNormal(w.v1,d.a),H);
      if(G.k)draw('line',Object.assign({x1:S.x,y1:S.y,x2:G.k.x,y2:G.k.y},L));
      const K=G.k||S;
      draw('line',Object.assign({x1:K.x,y1:K.y,x2:w.a.x,y2:w.a.y,'marker-end':AR},L));
      return;
    }
    // référence : triangle noirci, attache, lettre encadrée
    const hb=H/2,side=H*0.75,ht=side*0.87;
    let n=w.u||null;
    if(!n){
      const e=d.a?mepGdtNormal(w.v1,d.a):null; // droite, ou cercle / arc (rayon) depuis V1.0.13
      let bx=w.b.x-w.a.x,by=w.b.y-w.a.y;const bl=Math.hypot(bx,by)||1;bx/=bl;by/=bl;
      if(e){let nx=e.x,ny=e.y;if(nx*bx+ny*by<0){nx=-nx;ny=-ny;}n={x:nx,y:ny};} // perpendiculaire à l'arête, côté carré
      else n={x:bx,y:by};
    }
    const tx=-n.y,ty=n.x,A={x:w.a.x+n.x*ht,y:w.a.y+n.y*ht};
    draw('path',Object.assign({d:'M '+(w.a.x+tx*side/2).toFixed(3)+' '+(w.a.y+ty*side/2).toFixed(3)+' L '+(w.a.x-tx*side/2).toFixed(3)+' '+(w.a.y-ty*side/2).toFixed(3)
      +' L '+A.x.toFixed(3)+' '+A.y.toFixed(3)+' Z'},F));
    // attache vers le carré (s'arrête sur son bord)
    let dx=w.b.x-A.x,dy=w.b.y-A.y;const dl=Math.hypot(dx,dy);
    if(dl>1e-6){dx/=dl;dy/=dl;const k=hb/Math.max(Math.abs(dx),Math.abs(dy));
      if(dl>k+1e-3)draw('line',Object.assign({x1:A.x,y1:A.y,x2:w.b.x-dx*k,y2:w.b.y-dy*k},L));}
    const x0=w.b.x-hb,y0=w.b.y-hb;
    [[x0,y0,x0+H,y0],[x0+H,y0,x0+H,y0+H],[x0+H,y0+H,x0,y0+H],[x0,y0+H,x0,y0]].forEach(s=>draw('line',Object.assign({x1:s[0],y1:s[1],x2:s[2],y2:s[3]},L)));
    const t=draw('text',Object.assign({x:w.b.x,y:w.b.y+mepGdtTh()*0.35,'text-anchor':'middle'},T));t.textContent=d.l||'?';
    mepGdtBoxes.set(d,{x0,x1:x0+H,y0,y1:y0+H});
  }
  /* ----- outils Tolérance et Référence ----- */
  // une cote sous le clic (pas une tolérance), pour s'y accrocher
  function mepGdtDimAt(sh,P,kinds){
    const d=mepDimAt(sh,P.x,P.y);
    return d&&!mepIsTol(d.kind)&&(!kinds||kinds.indexOf(d.kind)>=0)?d:null;
  }
  function mepGdtNew(){
    const l=mepGdtLast;
    return{sym:l?l.sym:'flat',dia:l?!!l.dia:false,val:l?l.val:'0.05',mod:'',refs:[]};
  }
  function mepGdtClick(sh,P,tool){
    const D=mepSt.dim;
    if(D&&D.kind===tool&&D.__ghost){ // 2ᵉ clic : le cadre (ou la lettre) se pose ici
      mepDimMoveTo(sh,D,P);
      const d=Object.assign({},D,{id:mepUid('d')});delete d.__ghost;
      mepDimClearSelection();mepSt.selDim=d.id;mepSt.sel=null;
      mepEdit(tool==='gdt'?'tolérance géométrique':tool==='rough'?'rugosité':'référence '+d.l,()=>{sh.dims.push(d);});
      mepSideShow();
      if(tool==='rough'){mepStatus('Rugosité posée — paramètre, valeur et symbole dans le panneau. Cliquez une autre arête pour la suivante.');return;}
      mepStatus(tool==='gdt'?'Cadre posé — réglez le symbole, la valeur et les références dans le panneau.':'Référence '+d.l+' posée — la suivante sera '+mepGdtNextLetter()+'.');
      return;
    }
    // accroché à une cote : posé tout de suite
    const host=tool==='rough'?null:tool==='gdt'?mepGdtDimAt(sh,P,['len','dist','dia','rad','hole','ang']):mepGdtDimAt(sh,P,['len','dist']);
    if(host){
      if(sh.dims.some(x=>x.kind===tool&&x.on===host.id)){mepStatus(tool==='gdt'?'Cette cote a déjà un cadre de tolérance.':'Cette cote porte déjà une référence.');return;}
      const d={id:mepUid('d'),kind:tool,vid:host.vid,vid2:null,on:host.id};
      if(tool==='gdt')d.g=mepGdtNew();
      else{
        d.l=mepGdtNextLetter();
        const g=mepDimLine(sh,host);
        d.end=g&&Math.hypot(P.x-g.b1.x,P.y-g.b1.y)<Math.hypot(P.x-g.a1.x,P.y-g.a1.y)?1:0;
      }
      mepSt.selDim=d.id;mepSt.sel=null;
      mepEdit(tool==='gdt'?'tolérance sur une cote':'référence '+d.l+' sur une cote',()=>{sh.dims.push(d);});
      mepSideShow();
      mepStatus(tool==='gdt'?'Cadre placé sous la cote (il la suit) — réglez-le dans le panneau.':'Référence '+d.l+' sur la cote : l’axe ou le plan médian de l’élément coté.');
      return;
    }
    const S=mepSnapLocal(sh,P);
    if(!S&&tool==='rough'){mepStatus('Rugosité : cliquez l’arête de la surface, puis le côté où poser le symbole (hors matière).');return;}
    if(!S){mepStatus(tool==='gdt'?'Tolérance : cliquez une arête (pointe de la flèche) ou une cote.':'Référence : cliquez une arête ou une cote.');return;}
    const off=12/S.v.scale;
    mepSt.selDim=null;
    if(tool==='rough'){
      mepSt.dim={kind:'rough',vid:S.v.id,vid2:null,a:S.q,b:{x:S.q.x,y:S.q.y-2/S.v.scale},r:mepRghNew(),__ghost:true};
      mepStatus('Rugosité : déplacez la souris du côté hors matière de l’arête et cliquez (loin de l’arête : ligne de repère) — Échap annule.');
      mepRender();return;
    }
    mepSt.dim=tool==='gdt'
      ?{kind:'gdt',vid:S.v.id,vid2:null,a:S.q,b:{x:S.q.x+off,y:S.q.y-off},g:mepGdtNew(),__ghost:true}
      :{kind:'datum',vid:S.v.id,vid2:null,a:S.q,b:{x:S.q.x,y:S.q.y-off},l:mepGdtNextLetter(),__ghost:true};
    mepStatus(tool==='gdt'?'Tolérance : cliquez pour placer le cadre (Échap annule).':'Référence '+mepSt.dim.l+' : cliquez pour placer la lettre (Échap annule).');
    mepRender();
  }
  /* ----- panneau ----- */
  function mepSideGdt(root,d,sh){
    if(d.kind==='rough'){mepSideRough(root,d,sh);return;} // 98-mep-73
    const h=document.createElement('h4');
    h.textContent=d.kind==='gdt'?'Tolérance géométrique (ISO 1101)':'Référence (ISO 5459)';
    root.appendChild(h);
    const row=(lab,el)=>{const r=document.createElement('div');r.className='row';const L=document.createElement('label');L.textContent=lab;r.appendChild(L);if(el)r.appendChild(el);root.appendChild(r);return r;};
    const note=t=>{const n=document.createElement('div');n.className='note';n.style.whiteSpace='pre-line';n.textContent=t;root.appendChild(n);return n;};
    const redo=()=>{mepSideShow();mepRender();};
    if(d.on){const t=mepGdtHost(sh,d);note(t?'Accroché à une cote : '+(d.kind==='gdt'?'le cadre reste sous sa valeur.':'le triangle prolonge sa ligne de cote.'):'La cote porteuse a été supprimée.');}
    const pile=d.kind==='gdt'?mepGdtStack(sh,d):[d];
    if(pile.length>1)note('Cadre '+(pile.indexOf(d)+1)+' / '+pile.length+' de la pile — glisser un cadre déplace toute la pile.');
    if(d.kind==='datum'){
      const i=document.createElement('input');i.type='text';i.value=d.l||'';i.maxLength=3;i.style.width='4em';i.style.textTransform='uppercase';
      i.onchange=()=>{
        const v=i.value.trim().toUpperCase().replace(/[^A-Z]/g,'');if(!v){i.value=d.l;return;}
        mepEdit('lettre de référence',()=>{d.l=v;});redo();
      };
      row('Lettre',i);
      const dup=(sh.dims||[]).filter(x=>x.kind==='datum'&&x!==d&&String(x.l).toUpperCase()===String(d.l).toUpperCase()).length
        +[...(doc.mep.sheets||[])].filter(s=>s!==sh).reduce((n,s)=>n+(s.dims||[]).filter(x=>x.kind==='datum'&&String(x.l).toUpperCase()===String(d.l).toUpperCase()).length,0);
      if(dup)note('⚠ La lettre '+d.l+' sert déjà à une autre référence.');
      if(/[IOQ]/.test(d.l||''))note('⚠ ISO 5459 déconseille I, O et Q (confondus avec 1 et 0).');
    }else{
      const g=d.g||(d.g=mepGdtNew());
      const set=(lab,fn)=>{mepEdit(lab,()=>{fn(g);});mepGdtLast={sym:g.sym,dia:g.dia,val:g.val};redo();};
      const sel=document.createElement('select');
      let grp=null,fam='';
      MEP_GDT_SYMS.forEach(([k,lab,f])=>{
        if(f!==fam){grp=document.createElement('optgroup');grp.label=f;sel.appendChild(grp);fam=f;}
        const o=document.createElement('option');o.value=k;o.textContent=lab;if(k===g.sym)o.selected=true;grp.appendChild(o);
      });
      sel.onchange=()=>set('symbole de tolérance',x=>{x.sym=sel.value;if(MEP_GDT_FORME.has(x.sym))x.refs=[];});
      row('Caractéristique',sel);
      const di=document.createElement('input');di.type='checkbox';di.checked=!!g.dia;
      di.onchange=()=>set('zone cylindrique Ø',x=>{x.dia=di.checked;});
      row('Zone Ø',di);
      const va=document.createElement('input');va.type='text';va.value=g.val||'';va.placeholder='0.05';va.style.width='6em';
      va.onchange=()=>set('valeur de tolérance',x=>{x.val=va.value.trim().replace(',','.');});
      row('Tolérance (mm)',va);
      const mo=document.createElement('select');
      MEP_GDT_MODS.forEach(([k,lab])=>{const o=document.createElement('option');o.value=k;o.textContent=lab;if(k===(g.mod||''))o.selected=true;mo.appendChild(o);});
      mo.onchange=()=>set('modificateur',x=>{x.mod=mo.value;});
      row('Modificateur',mo);
      if(!MEP_GDT_FORME.has(g.sym)){
        const known=[...mepGdtLetters()].sort();
        const dl=document.createElement('datalist');dl.id='mepGdtLetters';
        known.forEach(c=>{const o=document.createElement('option');o.value=c;dl.appendChild(o);});root.appendChild(dl);
        for(let k=0;k<3;k++){
          const r0=(g.refs||[])[k]||{l:'',m:''};
          const li=document.createElement('input');li.type='text';li.value=r0.l||'';li.setAttribute('list','mepGdtLetters');li.style.width='4em';li.style.textTransform='uppercase';
          li.placeholder=k===0?(known[0]||'A'):'';
          const lm=document.createElement('select');
          [['',''],['M','Ⓜ'],['L','Ⓛ']].forEach(([v,lab])=>{const o=document.createElement('option');o.value=v;o.textContent=lab||'—';if(v===(r0.m||''))o.selected=true;lm.appendChild(o);});
          const put=()=>set('référence du cadre',x=>{
            const refs=(x.refs||[]).slice();while(refs.length<3)refs.push({l:'',m:''});
            refs[k]={l:li.value.trim().toUpperCase().replace(/[^A-Z-]/g,''),m:lm.value};
            x.refs=refs.filter(r=>r.l);
          });
          li.onchange=put;lm.onchange=put;
          const rr=row(['1re','2e','3e'][k]+' référence',li);rr.appendChild(lm);
        }
        const nr=(g.refs||[]).filter(r=>r.l);
        if(MEP_GDT_REF.has(g.sym)&&!nr.length)note('⚠ '+mepGdtName(g.sym)+' : une référence est obligatoire (ISO 1101).');
        const miss=nr.filter(r=>r.l.split('-').some(c=>!mepGdtLetters().has(c)));
        if(miss.length)note('Référence '+miss.map(r=>r.l).join(', ')+' absente du plan : posez-la avec l’outil Référence.');
      }else note('Tolérance de forme : pas de référence.');
    }
    const act=document.createElement('div');act.className='row';
    if(d.kind==='gdt'&&pile.length<MEP_GDT_STACK_MAX){
      const bAdd=document.createElement('button');bAdd.textContent='+ Cadre en dessous ('+(pile.length+1)+'ᵉ)';
      bAdd.title='Empiler un autre cadre de tolérance sous celui-ci (3 au plus)';
      bAdd.onclick=()=>mepGdtStackAdd(sh,d);
      act.appendChild(bAdd);
    }
    const bDel=document.createElement('button');bDel.textContent='Supprimer';bDel.className='danger';
    bDel.onclick=()=>{mepEdit('suppression tolérance',()=>{sh.dims=mepDimsWithout(sh,d.id);mepSt.selDim=null;});mepSideShow();};
    act.appendChild(bDel);root.appendChild(act);
  }
