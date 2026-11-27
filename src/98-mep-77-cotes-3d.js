// Espace PLAN — suite de la fonction englobante ouverte dans 98-mep-00-modele.js (état privé partagé, fermée dans 98-mep-95-export-init.js) : cotes 3D reprises dans les vues.
  /* 2026-11-27 (V1.0.20) — Fred : reprise des cotes 3D pilotantes
     (92-cotes-3d.js) dans la mise en plan. Une cote 3D passe dans la PREMIÈRE vue de la planche où elle
     se lit en vraie grandeur :
       · distance (faces parallèles, entraxe, axe ↔ face) : direction mesurée dans le plan de la vue ;
       · Ø / R : cercle vu de bout (accroché au cercle dessiné) ; Ø d'un cylindre vu de côté : cote
         entre ses deux bords, marquée Ø.
     Ses points suivent la pièce (indice {t:'c3', c: id de la cote 3D, w: 'A' | 'B' | 'D1' | 'D2'},
     recalculé par mepPtRefresh) ; tolérance, textes et précision sont copiés ; une cote 3D de
     référence reste entre parenthèses. Déjà reprise sur la planche : laissée telle quelle.
     Fred, 27/11 : « une volonté propre du dessinateur » ; « Il ne faudra pas valider cote par cote, on les
     affichera toutes ou aucune et on choisit après celles que l'on garde » → rien d'automatique : le
     bouton les pose toutes, ou les retire toutes s'il y en a déjà ; on supprime ensuite celles qu'on ne
     garde pas (clic + Suppr), et « Toutes » les remet.
     Une famille d'ordonnées 3D (og) devient UNE cote d'ordonnées de la planche (kind 'ord') : son zéro et
     ses valeurs rattachés aux cotes 3D, c3m = les cotes 3D reprises.
     Fred, 27/11 : « quand je choisis une autre vue, elles disparaissent dans la 1ère vue… Ce n'est pas ce
     que je souhaite. Peut-être mettre l'option par vue dans le clic droit ? » → PAR VUE : le bouton agit
     sur la vue sélectionnée seulement (sans vue choisie : toute la planche) ; clic droit sur une vue :
     « Cotes 3D dans cette vue » / « Retirer les cotes 3D de cette vue ».
     Fred, 27/11 : « Si une cote a déjà été projetée dans une vue, ne pas la projeter dans une autre » → une
     cote 3D va dans UNE seule vue de toute la mise en plan (toutes les planches) ; pour la changer de vue,
     la supprimer de la première puis la reprendre dans l'autre. */
  function mepC3View(sh,vid){
    // vue visée : celle donnée, sinon la vue sélectionnée ; null = toute la planche
    const id=vid||mepSt.sel||null,v=id?mepView(sh,id):null;
    return v&&v.kind!=='dxf'&&!v.camera?v:null;
  }
  function mepC3Fits(v,g){
    const dir=mepBasisOf(v).dir,D=new THREE.Vector3(dir[0],dir[1],dir[2]);
    if(g.k==='note')return g.n&&g.P&&Math.abs(g.n.dot(D))<0.02?'note':null; // face vue de champ
    if(g.k==='pcd')return g.e&&g.H&&g.H.length&&Math.abs(g.e.dot(D))>0.999?'pcd':null; // Ø de perçage : axe de la répétition vu de bout
    if(g.k==='angle'&&g.polar)return g.e&&g.qa&&g.qb&&Math.abs(g.e.dot(D))>0.999?'polar':null; // pas angulaire : axe de la répétition vu de bout
    if(g.k==='angle')return g.e&&Math.abs(g.e.dot(D))>0.999?'ang':null; // arête vue de bout
    if(g.k==='dia'){
      if(g.cham)return g.a&&g.fp&&Math.abs(g.a.dot(D))>0.999?'cham':null; // arête du chanfrein vue de bout
      if(!g.a)return null;
      const ad=Math.abs(g.a.dot(D));
      if(ad>0.999)return g.rad?'rad':'dia';
      if(!g.rad&&ad<0.02)return 'side';
      return null;
    }
    if(g.p1&&g.p2&&g.n&&Math.abs(g.n.dot(D))<0.02)return 'dist';
    return null;
  }
  function mepC3Common(d,nd){
    nd.c3=d.id;nd.ref=!d.drive;nd.tol=d.tol?JSON.parse(JSON.stringify(d.tol)):null;
    if(d.pre)nd.pre=String(d.pre);if(d.post)nd.post=String(d.post);if(d.prec!=null)nd.prec=d.prec;
    // « 4× » devant le Ø de trous pareils (même règle qu'en 3D)
    if(d.k==='dia'){let ap='';try{ap=typeof c3AutoPre==='function'?String(c3AutoPre(d)||'').trim():'';}catch(e){ap='';}if(ap)nd.pre=ap+(nd.pre?' '+nd.pre:'');
      // « 6× Ø6 EQS » : trous également répartis sur un tour complet (ISO 129-1)
      try{if(typeof c3Eqs==='function'&&c3Eqs(d))nd.post=(nd.post?nd.post+' ':'')+'EQS';}catch(e){}}
    // présentation : cote encadrée (sans tolérance), d'inspection (ovale), nom
    if(d.fmt==='box'){nd.box=true;nd.tol=null;nd.ref=false;} // théoriquement exacte : encadrée, jamais entre parenthèses
    else if(d.fmt==='insp'){const I=d.insp||{};nd.insp={lab:String(I.lab||''),rate:String(I.rate||'')};}
    let nm='';try{nm=typeof c3Name==='function'?c3Name(d):'';}catch(e){nm='';}
    // le nom suit la cote 3D (renommée en 3D → renommée sur le plan) : c3nm = façon de l'afficher,
    // c3nmv = texte posé (changé à la main sur le plan : il ne suit plus)
    if(nm&&d.show==='nom'){nd.txt=nm;nd.tol=null;nd.c3nm='nom';nd.c3nmv=nd.txt;}
    else if(nm&&d.show==='both'){nd.c3pre=nd.pre||'';nd.pre=nm+' ='+(nd.pre?' '+nd.pre:'');nd.c3nm='both';nd.c3nmv=nd.pre;}
    return nd;
  }
  function mepC3SegNear(v,P,dir,tol){
    // trait de la vue sur la droite qui part de P selon dir (du côté de dir) → {i, e} le plus proche de P
    const loc=p=>mepLocal(v,[p.x,p.y,p.z]),p=loc(P),q=loc(P.clone().add(dir));
    let dx=q[0]-p[0],dy=q[1]-p[1];const l=Math.hypot(dx,dy);if(!(l>1e-6))return null;dx/=l;dy/=l;
    const tl=tol||0.02;let best=null,bs=1e9;
    ((mepGeoOf(v)||{}).els||[]).forEach((e,i)=>{if(!e||e.t!=='L')return;const ex=e.x2-e.x1,ey=e.y2-e.y1,el=Math.hypot(ex,ey);if(!(el>1e-6))return;
      if(Math.abs(ex*dy-ey*dx)/el>2e-3)return;
      if(Math.abs((e.x1-p[0])*dy-(e.y1-p[1])*dx)>tl)return;
      const m=((e.x1+e.x2)/2-p[0])*dx+((e.y1+e.y2)/2-p[1])*dy;if(m<=1e-6)return;
      const s=Math.min(Math.abs((e.x1-p[0])*dx+(e.y1-p[1])*dy),Math.abs((e.x2-p[0])*dx+(e.y2-p[1])*dy));
      if(s<bs){bs=s;best={i,e};}});
    return best;
  }
  function mepC3OnSeg(v,P,nrm){
    // la face vue de champ est-elle dessinée ? un trait ⊥ à sa normale passe par P
    const loc=p=>mepLocal(v,[p.x,p.y,p.z]),p=loc(P),q=loc(P.clone().add(nrm));
    let nx=q[0]-p[0],ny=q[1]-p[1];const l=Math.hypot(nx,ny);if(!(l>1e-6))return false;nx/=l;ny/=l;
    return ((mepGeoOf(v)||{}).els||[]).some(e=>{if(!e||e.t!=='L')return false;const ex=e.x2-e.x1,ey=e.y2-e.y1,el=Math.hypot(ex,ey);if(!(el>1e-6))return false;
      if(Math.abs(ex*nx+ey*ny)/el>2e-3)return false;
      const t=((p[0]-e.x1)*ex+(p[1]-e.y1)*ey)/(el*el);if(t<-1e-3||t>1+1e-3)return false;
      return Math.abs((p[0]-e.x1)*nx+(p[1]-e.y1)*ny)<0.02;});
  }
  function mepC3SheetBox(v){
    // boîte de la pièce sur la planche (pour poser les cotes hors de la pièce)
    let B=null;try{B=typeof c3PartBox==='function'?c3PartBox():null;}catch(e){B=null;}
    if(!B||B.isEmpty())return null;
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(let i=0;i<8;i++){const p=[i&1?B.max.x:B.min.x,i&2?B.max.y:B.min.y,i&4?B.max.z:B.min.z],l=mepLocal(v,p),s=mepToSheet(v,l[0],l[1]);
      x0=Math.min(x0,s.x);y0=Math.min(y0,s.y);x1=Math.max(x1,s.x);y1=Math.max(y1,s.y);}
    return {x0,y0,x1,y1};
  }
  function mepC3Dim(sh,v,d,g,how,rang){
    const loc=p=>mepLocal(v,[p.x,p.y,p.z]),k=9/Math.max(1e-9,v.scale||1);
    const nloc=(P,n)=>{const a=loc(P),b=loc(P.clone().add(n));let x=b[0]-a[0],y=b[1]-a[1];const l=Math.hypot(x,y)||1;return [x/l,y/l];};
    if(how==='note'){
      // référence / rugosité : sur le trait de la face, la lettre ou le symbole du côté hors matière
      let circ=null;
      if(!mepC3OnSeg(v,g.P,g.n)){
        // cylindre vu de bout (alésage de référence B…) : le triangle sur son cercle, la lettre vers l'extérieur
        const dir=mepBasisOf(v).dir;if(!g.cy||Math.abs(g.cy.a.x*dir[0]+g.cy.a.y*dir[1]+g.cy.a.z*dir[2])<0.999)return null;
        const c=loc(g.cy.o);let ok=false;try{ok=((mepGeoOf(v)||{}).els||[]).some(e=>e&&(e.t==='C'||e.t==='A')&&Math.hypot(e.cx-c[0],e.cy-c[1])<1e-3&&Math.abs(e.r-g.cy.r)<1e-3);}catch(e){ok=false;}
        if(!ok)return null;circ=nloc(g.cy.o,g.cy.u);
      }
      const p=loc(g.P),nn=circ||nloc(g.P,g.n),off=(d.k==='datum'?12:2)/Math.max(1e-9,v.scale||1);
      const a={x:p[0],y:p[1],hint:{t:'c3',c:d.id,w:'P'}},b={x:p[0]+nn[0]*off,y:p[1]+nn[1]*off,hint:{t:'c3',c:d.id,w:'P',rel:1,lx:p[0],ly:p[1]}}; // la lettre suit la face
      if(d.k==='datum')return {id:mepUid('d'),kind:'datum',vid:v.id,vid2:null,a,b,l:String(d.l||'A').toUpperCase(),c3:d.id};
      if(d.k==='rough')return {id:mepUid('d'),kind:'rough',vid:v.id,vid2:null,a,b,r:JSON.parse(JSON.stringify(d.r||{par:'Ra',val:'3.2',proc:'remove',txt:''})),c3:d.id};
      return null;
    }
    if(how==='ang'){
      // angle entre deux faces : les deux traits de la vue qui partent de l'arête
      const A=mepC3SegNear(v,g.p,g.tA),B=mepC3SegNear(v,g.p,g.tB);if(!A||!B||A.i===B.i)return null;
      const nd={id:mepUid('d'),kind:'ang',off:14,vid:v.id,vid2:v.id,a:{x:A.e.x1,y:A.e.y1,hint:{t:'seg',i:A.i}},b:{x:B.e.x1,y:B.e.y1,hint:{t:'seg',i:B.i}}};
      if(d.sup)nd.q=2; // angle supplémentaire : l'autre côté de la 2e face
      if(g.big)nd.big=true; // révolution au-delà de 180°
      return mepC3Common(d,nd);
    }
    if(how==='polar'){
      // pas angulaire d'une répétition circulaire : angle par trois points (centre de la répétition, centres
      // des deux trous), qui suivent la pièce ; l'arc passe un peu au-delà des trous
      const O=loc(g.p),A=loc(g.qa),B=loc(g.qb),rr=Math.hypot(A[0]-O[0],A[1]-O[1]);if(!(rr>1e-6))return null;
      const nd={id:mepUid('d'),kind:'ang',vid:v.id,vid2:v.id,off:Math.min(80,rr*(v.scale||1)+8),
        o3:{x:O[0],y:O[1],hint:{t:'c3',c:d.id,w:'O'}},a:{x:A[0],y:A[1],hint:{t:'c3',c:d.id,w:'QA'}},b:{x:B[0],y:B[1],hint:{t:'c3',c:d.id,w:'QB'}}};
      return mepC3Common(d,nd);
    }
    if(how==='pcd'){
      // Ø de perçage (Fred, 27/11 : « la vraie norme ISO… tous les axes ») : cercle d'axe des trous en trait mixte,
      // traits d'axe du centre à travers chaque trou et croix du centre — annotation « pitch » de la vue, ses trous et
      // son centre suivent la cote 3D (refs {c3, i}) — puis le Ø posé sur ce cercle (accroché à son trait d'axe)
      const O=loc(g.p),id=mepUid('ax'),ann={id,kind:'pitch',c3:d.id,refs:g.H.map((h,i)=>({c3:d.id,i}))};
      const ang=-Math.PI/4,rr=g.r+k;
      const nd=mepC3Common(d,{id:mepUid('d'),kind:'dia',vid:v.id,vid2:null,a:{x:O[0],y:O[1],hint:{t:'ctr',i:'ax:m'+id+'.0'}},b:{x:O[0]+rr*Math.cos(ang),y:O[1]+rr*Math.sin(ang)}});
      nd._ax=ann;nd._c3r=g.r; // posés avec la cote (mepFrom3D) ; rayon pour le rangement
      return nd;
    }
    if(how==='cham'){
      // chanfrein vu de bout : note « 3 × 45° » qui pointe sa face (texte relu sur la pièce)
      const p=loc(g.fp),nn=g.rd?nloc(g.fp,g.rd):[0.7,-0.7],o=12/Math.max(1e-9,v.scale||1);
      const nd={id:mepUid('d'),kind:'note',vid:v.id,vid2:null,a:{x:p[0],y:p[1],hint:{t:'c3',c:d.id,w:'F'}},b:{x:p[0]+nn[0]*o+o*0.6,y:p[1]+nn[1]*o,hint:{t:'c3',c:d.id,w:'F',rel:1,lx:p[0],ly:p[1]}},off:0,
        txt:typeof c3MepText==='function'?(c3MepText(d.id)||'Chanfrein'):'Chanfrein',c3t:1};
      nd.c3=d.id;nd.ref=!d.drive;
      return nd;
    }
    if(how==='dia'||how==='rad'){
      const c=loc(g.c);let gi=-1;
      try{(mepGeoOf(v).els||[]).forEach((e,i)=>{if(gi>=0||e.cx==null)return;if((e.t==='C'||(how==='rad'&&e.t==='A'))&&Math.hypot(e.cx-c[0],e.cy-c[1])<1e-3&&Math.abs(e.r-g.r)<1e-3)gi=i;});}catch(e){}
      if(gi<0)return null; // cercle non dessiné dans cette vue (caché, coupé…)
      const ang=-Math.PI/4,r=g.r+k;
      // trou d'une fonction Perçage (Fred, 27/11 : « toute la cote en rouge à la place de la cote du trou en bleu en
      // gardant EQS ») : la cotation de perçage du plan (Ø, profondeur, lamage / fraisure, filetage, « 6× » compté
      // dans la vue), « EQS » au bout de la 1re ligne ; elle suit la fonction comme celle posée à la main
      let HO=null;try{HO=how==='dia'&&typeof c3HoleOf==='function'?c3HoleOf(d):null;}catch(e){HO=null;}
      if(HO&&HO.f&&HO.f.type==='hole'&&typeof mepHoleFeatureText==='function'){
        const nd={id:mepUid('d'),kind:'hole',vid:v.id,vid2:null,a:{x:c[0],y:c[1],hint:{t:'ctr',i:gi}},b:{x:c[0]+r*Math.cos(ang),y:c[1]+r*Math.sin(ang)},off:0,
          holeFid:HO.f.id,holeText:mepHoleFeatureText(HO.f),tol:d.tol?JSON.parse(JSON.stringify(d.tol)):null,c3:d.id,ref:false};
        if(HO.n>1)nd.holeN=HO.n;
        if(HO.eqs)nd.eqs=true;
        return nd;}
      return mepC3Common(d,{id:mepUid('d'),kind:how,vid:v.id,vid2:null,a:{x:c[0],y:c[1],hint:{t:'ctr',i:gi}},b:{x:c[0]+r*Math.cos(ang),y:c[1]+r*Math.sin(ang)}});
    }
    const dir=mepBasisOf(v).dir,D=new THREE.Vector3(dir[0],dir[1],dir[2]);
    let A,B,P=null,w=['A','B'],dsym=null;
    if(how==='side'){const u=new THREE.Vector3().crossVectors(D,g.a).normalize();A=g.c.clone().addScaledVector(u,g.r);B=g.c.clone().addScaledVector(u,-g.r);w=['D1','D2'];dsym='Ø';}
    else{A=g.p1;B=g.p2;try{const G=c3Geo(d,g);if(G&&G.u&&G.A2&&Math.abs(G.u.dot(D))<0.9)P=G.A2.clone().add(G.B2).multiplyScalar(.5);}catch(e){}}
    const a=loc(A),b=loc(B),L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!(L>1e-6))return null;
    const orient=Math.abs(b[1]-a[1])/L<1e-3?'h':Math.abs(b[0]-a[0])/L<1e-3?'v':'a';
    const SA=mepToSheet(v,a[0],a[1]),SB=mepToSheet(v,b[0],b[1]);
    // place : celle de la cote 3D si elle se voit dans cette vue, sinon hors de la pièce (8 mm, puis 7 mm par cote)
    let Ps=null;if(P){const p=loc(P);Ps=mepToSheet(v,p[0],p[1]);}
    const bx=mepC3SheetBox(v),gap=8+7*(rang||0),mx=(SA.x+SB.x)/2,my=(SA.y+SB.y)/2;
    const inside=q=>bx&&q.x>bx.x0-1&&q.x<bx.x1+1&&q.y>bx.y0-1&&q.y<bx.y1+1;
    if(!Ps||inside(Ps)){
      if(orient==='h'&&bx)Ps={x:mx,y:my<(bx.y0+bx.y1)/2?bx.y0-gap:bx.y1+gap};
      else if(orient==='v'&&bx)Ps={x:mx<(bx.x0+bx.x1)/2?bx.x0-gap:bx.x1+gap,y:my};
      else{const nx=-(SB.y-SA.y)/L,ny=(SB.x-SA.x)/L,cx=bx?(bx.x0+bx.x1)/2:mx,cy=bx?(bx.y0+bx.y1)/2:my,s=((mx-cx)*nx+(my-cy)*ny)<0?-1:1;Ps={x:mx+s*nx*gap,y:my+s*ny*gap};}
    }
    const nd={id:mepUid('d'),kind:'dist',vid:v.id,vid2:null,a:{x:a[0],y:a[1],hint:{t:'c3',c:d.id,w:w[0]}},b:{x:b[0],y:b[1],hint:{t:'c3',c:d.id,w:w[1]}},
      orient,off:mepDimOffsetFromPts(SA.x,SA.y,SB.x,SB.y,orient,Ps)};
    if(dsym)nd.dsym=dsym;
    return mepC3Common(d,nd);
  }
  function mepC3OrdDim(sh,v,M){
    // famille d'ordonnées 3D (92-cotes-3d) → cote d'ordonnées de la vue : le zéro et chaque valeur
    // rattachés à leur cote 3D ({t:'c3'}), ils suivent la pièce
    const head=M[0];let g=C3G.get(head);if(!g)g=c3Refresh(head);if(!g||g.err||!g.n||!g.p1)return null;
    const z=mepLocal(v,[0,0,0]),e=mepLocal(v,[g.n.x,g.n.y,g.n.z]),ex=e[0]-z[0],ey=e[1]-z[1];
    const axis=Math.abs(ey)<1e-3&&Math.abs(Math.abs(ex)-1)<1e-3?'x':Math.abs(ex)<1e-3&&Math.abs(Math.abs(ey)-1)<1e-3?'y':null;
    if(!axis)return null;
    // le zéro est g.p1, ou g.p2 si oz vaut 2 (cote face ↔ axe : l'axe vient d'abord)
    const loc=p=>mepLocal(v,[p.x,p.y,p.z]),o0=loc(head.oz===2?g.p2:g.p1),o={x:o0[0],y:o0[1],hint:{t:'c3',c:head.id,w:head.oz===2?'B':'A'}};
    const pts=[];
    M.forEach(d=>{let gd=C3G.get(d);if(!gd)gd=c3Refresh(d);if(!gd||gd.err||!gd.p2)return;const q=loc(d.oz===2?gd.p1:gd.p2),p={x:q[0],y:q[1],hint:{t:'c3',c:d.id,w:d.oz===2?'A':'B'}};if(!d.drive)p.ref=true;pts.push(p);});
    if(!pts.length)return null;
    return {id:mepUid('d'),kind:'ord',axis,vid:v.id,vid2:null,o,a:o,b:o,pts,off:mepOrdDefaultOff(v,axis,o),ref:false,tol:null,c3:head.id,c3m:M.map(d=>d.id)};
  }
  /* Fred, 27/11 : « fais attention à bien aligner les cotes pour ne pas qu'elles se chevauchent et que les
     cotes des rayons soient bien dégagées » ; « Peut-être une valeur modifiable de l'écartement entre cotes »
     → rangement par vue : distances horizontales / verticales hors de la pièce, du côté le plus proche, en
     étages alignés (1er étage à écart + 2 mm de la pièce, puis un étage tous les « écart » mm) ; les plus
     courtes contre la pièce, plusieurs sur un même étage si elles ne se recouvrent pas (texte compris).
     Ø / R ensuite : la direction et la longueur du trait de rappel qui laissent le texte loin des autres
     textes, des traits de cote et des cercles de la vue, de préférence hors de la pièce, vers le haut à droite.
     L'écart est propre à la planche (sh.c3Gap, 8 mm par défaut) ; le changer range de nouveau les cotes 3D. */
  function mepC3Gap(sh){const g=sh&&+sh.c3Gap;return g>0?g:8;}
  function mepC3TxtW(sh,nd){
    // largeur approchée du texte d'une cote (mm papier)
    const hh=(typeof MEP_TEXT_STYLE!=='undefined'&&MEP_TEXT_STYLE.dimH)||3.5;
    let s='';try{s=String(mepDimText(nd,mepDimMeasure(sh,nd))||'');}catch(e){s='';}
    if(!s)s='000.0';
    let w=s.length*hh*0.62+hh*0.6;
    if(nd.dsym)w+=hh*0.8;
    if(nd.tol)w+=hh*2.4;
    if(nd.box||nd.insp)w+=hh*(nd.insp?3:1.2);
    return w;
  }
  function mepC3Layout(sh,L){
    const hh=(typeof MEP_TEXT_STYLE!=='undefined'&&MEP_TEXT_STYLE.dimH)||3.5,ST=mepC3Gap(sh),G0=ST+2,M=hh*0.8;
    const byV=new Map();(L||[]).forEach(nd=>{if(!nd||!nd.vid)return;if(!byV.has(nd.vid))byV.set(nd.vid,[]);byV.get(nd.vid).push(nd);});
    const hit=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0;
    const segIn=(s,b)=>{
      // segment [x1,y1,x2,y2] qui traverse la boîte (Liang-Barsky)
      let t0=0,t1=1;const dx=s[2]-s[0],dy=s[3]-s[1];
      const cl=(p,q)=>{if(Math.abs(p)<1e-12)return q>=0;const r=q/p;if(p<0){if(r>t1)return false;if(r>t0)t0=r;}else{if(r<t0)return false;if(r<t1)t1=r;}return true;};
      return cl(-dx,s[0]-b.x0)&&cl(dx,b.x1-s[0])&&cl(-dy,s[1]-b.y0)&&cl(dy,b.y1-s[1])&&t1-t0>1e-9;};
    const cross=(a,b)=>{
      // deux segments qui se coupent (hors bouts communs)
      const d=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
      const A=[a[0],a[1]],B=[a[2],a[3]],C=[b[0],b[1]],D=[b[2],b[3]];
      const d1=d(C,D,A),d2=d(C,D,B),d3=d(A,B,C),d4=d(A,B,D);
      return ((d1>1e-9&&d2<-1e-9)||(d1<-1e-9&&d2>1e-9))&&((d3>1e-9&&d4<-1e-9)||(d3<-1e-9&&d4>1e-9));};
    byV.forEach((LV,vid)=>{
      const v=mepView(sh,vid);if(!v)return;const bx=mepC3SheetBox(v);if(!bx)return;
      const S=p=>mepToSheet(v,p.x,p.y),obs=[],segs=[],soft=[];
      let fr=null;try{const pd=mepPageDim(sh),tw=mepTbW(sh,pd);fr={x0:pd.ix+4,y0:pd.iy+4,x1:pd.ix+pd.iw-4,y1:pd.iy+pd.ih+pd.th-4}; // en dedans du trait intérieur (3 mm)
        if(pd.th>0)obs.push({x0:pd.ix+pd.iw-tw,y0:pd.iy+pd.ih,x1:pd.ix+pd.iw,y1:pd.iy+pd.ih+pd.th});}catch(e){fr=null;}
      const outF=b=>!!fr&&(b.x0<fr.x0||b.y0<fr.y0||b.x1>fr.x1||b.y1>fr.y1);
      // à éviter : les textes des autres cotes de la vue, les notes posées avec celles-ci, les cercles dessinés
      sh.dims.forEach(x=>{if(!x||x.vid!==vid||LV.includes(x))return;let p=null;try{p=mepDimTextPos(sh,x);}catch(e){p=null;}if(p)obs.push({x0:p.x-hh*2,y0:p.y-hh,x1:p.x+hh*2,y1:p.y+hh});});
      LV.forEach(x=>{if(x.kind==='dist'||x.kind==='dia'||x.kind==='rad'||x.kind==='hole'||!x.b)return;const p=S(x.b);obs.push({x0:p.x-hh*2,y0:p.y-hh,x1:p.x+hh*2,y1:p.y+hh});});
      try{((mepGeoOf(v)||{}).els||[]).forEach(e=>{if(e&&e.t==='C'&&e.r>0){const c=mepToSheet(v,e.cx,e.cy),r=e.r*v.scale;soft.push({x0:c.x-r,y0:c.y-r,x1:c.x+r,y1:c.y+r});}});}catch(e){}
      // les autres vues de la planche : rien ne s'y pose
      const vb=[];(sh.views||[]).forEach(w=>{if(!w||w.id===vid)return;let b=null;try{b=mepViewSheetBBox(w);}catch(e){b=null;}if(b&&b.w>0){const r={x0:b.x,y0:b.y,x1:b.x+b.w,y1:b.y+b.h};obs.push(r);vb.push(r);}});
      const pb={x0:bx.x0,y0:bx.y0,x1:bx.x1,y1:bx.y1};
      // cadres de tolérance portés par une cote : leur place est gardée sous son texte, hors de la pièce
      const ALL=(L||[]).concat(sh.dims||[]),GH=typeof mepGdtH==='function'?mepGdtH():hh*1.6;
      const frames=nd=>{const out=[],seen=new Set();let up=ALL.find(x=>x&&x.kind==='gdt'&&x.on===nd.id);
        while(up&&!seen.has(up.id)&&out.length<4){seen.add(up.id);out.push(up);const id=up.id;up=ALL.find(x=>x&&x.kind==='gdt'&&x.under===id);}
        return out;};
      // 1) distances horizontales et verticales, en étages
      const D=LV.filter(nd=>nd.kind==='dist'&&(nd.orient==='h'||nd.orient==='v')).map(nd=>{
        const A=S(nd.a),B=S(nd.b),h=nd.orient==='h',lo=h?Math.min(A.x,B.x):Math.min(A.y,B.y),hi=h?Math.max(A.x,B.x):Math.max(A.y,B.y),m=(lo+hi)/2,tw=mepC3TxtW(sh,nd);
        const q=h?(A.y+B.y)/2:(A.x+B.x)/2,side=h?(q<(bx.y0+bx.y1)/2?-1:1):(q<(bx.x0+bx.x1)/2?-1:1);
        const FR=frames(nd);let FW=0;FR.forEach(f=>{let w=hh*8;try{const s=mepGdtFrame(null,f,0,0,null,null,null,true);if(s&&isFinite(s.x1-s.x0))w=s.x1-s.x0;}catch(e){}FW=Math.max(FW,w);});
        return {nd,A,B,h,lo:Math.min(lo,m-tw/2),hi:Math.max(hi,m+tw/2),a0:lo,a1:hi,span:hi-lo,m,tw,side,FW,FH:FR.length*GH};});
      D.sort((p,q)=>p.span-q.span||p.m-q.m);
      const lv=new Map();
      D.forEach(o=>{
        // le côté le plus proche d'abord ; l'autre côté passe avant un étage trop éloigné (il « coûte » 2,5 étages) ;
        // en dernier recours, le 1er étage libre sans regarder le reste
        const tries=[];[o.side,-o.side].forEach(sd=>{for(let n=0;n<16;n++)tries.push({sd,n,strict:true,k:n+(sd===o.side?0:2.5)});});
        tries.sort((p,q)=>p.k-q.k);for(let n=0;n<16;n++)tries.push({sd:o.side,n,strict:false});
        for(const T of tries){
          const n=T.n,sd=T.sd;
          const c=o.h?(sd<0?bx.y0-G0-ST*n:bx.y1+G0+ST*n):(sd<0?bx.x0-G0-ST*n:bx.x1+G0+ST*n);
          const key=(o.h?'h':'v')+'|'+sd+'|'+n,I=lv.get(key)||[];
          if(I.some(r=>o.lo<r[1]+M&&o.hi>r[0]-M))continue;
          const tb=o.h?{x0:o.m-o.tw/2,y0:c-hh*1.5,x1:o.m+o.tw/2,y1:c+0.4}:{x0:c-hh*1.5,y0:o.m-o.tw/2,x1:c+0.4,y1:o.m+o.tw/2};
          // cadres sous le texte (centrés sur lui, 98-mep-72) : ni sur la pièce, ni sur un autre texte
          const fb=o.FH>0?(o.h?{x0:o.m-o.FW/2,y0:c+0.2,x1:o.m+o.FW/2,y1:c+0.2+o.FH}:{x0:c-hh*0.75-o.FW/2,y0:o.m+o.tw/2-hh*0.2,x1:c-hh*0.75+o.FW/2,y1:o.m+o.tw/2-hh*0.2+o.FH}):null; // verticale : sous le bout du texte couché
          // lignes d'attache : elles ne traversent pas une autre vue
          const ex=o.h?[[o.A.x,o.A.y,o.A.x,c],[o.B.x,o.B.y,o.B.x,c]]:[[o.A.x,o.A.y,c,o.A.y],[o.B.x,o.B.y,c,o.B.y]];
          if(T.strict&&(outF(tb)||obs.some(b=>hit(tb,b))||ex.some(s=>vb.some(b=>segIn(s,b)))||(fb&&(outF(fb)||hit(fb,pb)||obs.some(b=>hit(fb,b))))))continue;
          I.push([o.lo,o.hi]);lv.set(key,I);
          o.nd.off=mepDimOffsetFromPts(o.A.x,o.A.y,o.B.x,o.B.y,o.nd.orient,o.h?{x:o.m,y:c}:{x:c,y:o.m});
          obs.push(tb);if(fb)obs.push(fb);
          if(o.h){segs.push([o.a0,c,o.a1,c],[o.A.x,o.A.y,o.A.x,c],[o.B.x,o.B.y,o.B.x,c]);}
          else{segs.push([c,o.a0,c,o.a1],[o.A.x,o.A.y,c,o.A.y],[o.B.x,o.B.y,c,o.B.y]);}
          break;
        }
      });
      // 2) Ø et R : là où leur texte ne gêne rien
      LV.filter(nd=>nd.kind==='dia'||nd.kind==='rad'||nd.kind==='hole').forEach(nd=>{
        // rayon du cercle coté : celui de la vue, un trait d'axe (cercle de perçage) ou, pas encore posé, celui de la cote 3D
        const c=S(nd.a);let rr=0;try{if(nd._c3r!=null)rr=nd._c3r*v.scale;else{const e=mepEntByHint(v,nd.a.hint);rr=(e&&e.r||0)*v.scale;}}catch(e){rr=0;}
        // cotation de perçage : plusieurs lignes (Ø et profondeur, lamage / fraisure…), centrées sur le point du texte
        const HL=nd.kind==='hole'?String((nd.holeN>1?nd.holeN+'× ':'')+(nd.holeText||'')).split('\n').map((s,i)=>i===0&&nd.eqs?s+' EQS':s):null;
        const tw=HL?Math.max(...HL.map(s=>s.length))*hh*0.62+hh*0.6:mepC3TxtW(sh,nd),dy=HL?(HL.length-1)*((typeof MEP_DIM_STYLE!=='undefined'&&MEP_DIM_STYLE.textHeight)||hh)*1.2/2:0;
        const me={x0:c.x-rr-0.1,y0:c.y-rr-0.1,x1:c.x+rr+0.1,y1:c.y+rr+0.1};let best=null,bs=1e18;
        // cadres de tolérance du Ø / R : sous son texte, calés sur le bout où arrive le trait de rappel (98-mep-72)
        const FR=frames(nd);let FW=0;FR.forEach(f=>{let w=hh*8;try{const s=mepGdtFrame(null,f,0,0,null,null,null,true);if(s&&isFinite(s.x1-s.x0))w=s.x1-s.x0;}catch(e){}FW=Math.max(FW,w);});
        // cadres sous le trait souligné (98-mep-72 mepGdtUnderY)
        const FH=FR.length*GH,th0=hh*0.4+dy+(typeof mepDimUnderOff==='function'?mepDimUnderOff(hh):0.3*hh+0.9)+(typeof mepGdtTh==='function'?mepGdtTh():hh)*0.3;
        // cadre ou cotation de perçage : texte et cadre hors de la pièce si possible — en plus des écarts habituels, la
        // place juste hors de la vue dans chaque direction (au-dessus : le cadre sous le texte compris)
        const big=FH>0||!!HL;
        const LKS=(cs,sn)=>{const K=[6,10,15,22,30,40];if(!big)return K;
          const tx=cs>1e-6?(pb.x1-c.x)/cs:cs<-1e-6?(pb.x0-c.x)/cs:1e9,ty=sn>1e-6?(pb.y1-c.y)/sn:sn<-1e-6?(pb.y0-c.y)/sn:1e9;
          let t=Math.min(tx,ty);if(!(t>0&&t<1e8))return K;
          t+=ty<=tx?(sn<0?(th0+FH+1.5)/-sn:(hh*1.1+dy+1.5)/sn):2/Math.abs(cs);
          const k=t-rr;if(k>6&&k<150)K.push(k);return K;};
        for(let ai=0;ai<24;ai++){const th=ai*Math.PI/12,cs=Math.cos(th),sn=Math.sin(th);
          for(const lk of LKS(cs,sn)){
            const b={x:c.x+(rr+lk)*cs,y:c.y+(rr+lk)*sn};
            const tb=cs>=0?{x0:b.x-0.5,y0:b.y-hh*1.1-dy,x1:b.x+tw,y1:b.y+hh*0.9+dy}:{x0:b.x-tw,y0:b.y-hh*1.1-dy,x1:b.x+0.5,y1:b.y+hh*0.9+dy};
            // trait de rappel tel que dessiné : du bout du trait souligné (sous le texte) vers le cercle
            const yU=b.y+th0-(typeof mepGdtTh==='function'?mepGdtTh():hh)*0.3;let qx=b.x-c.x,qy=yU-c.y;const ql=Math.hypot(qx,qy)||1;qx/=ql;qy/=ql;
            const ld=[c.x+rr*qx,c.y+rr*qy,b.x,yU];
            let s=lk*1.2+6*(1-Math.cos(th+Math.PI/4)); // vers le haut à droite, trait court
            obs.forEach(o=>{if(hit(tb,o))s+=1000;if(segIn(ld,o))s+=400;});
            segs.forEach(g=>{if(segIn(g,tb))s+=300;if(cross(g,ld))s+=120;});
            soft.forEach(o=>{if(o.x0===me.x0&&o.y0===me.y0)return;if(hit(tb,o))s+=150;if(segIn(ld,o))s+=40;});
            if(hit(tb,pb))s+=big?250:80;
            if(outF(tb))s+=2000;
            let fb=null;
            if(FH>0){const fx=cs>=0?b.x:b.x-FW;fb={x0:fx,y0:b.y+th0,x1:fx+FW,y1:b.y+th0+FH}; // calé du côté du trait (98-mep-72 mepGdtOnX0)
              obs.forEach(o=>{if(hit(fb,o))s+=1000;});segs.forEach(g=>{if(segIn(g,fb))s+=300;});
              soft.forEach(o=>{if(hit(fb,o))s+=150;});if(segIn(ld,{x0:fb.x0-1.5,y0:fb.y0,x1:fb.x1+1.5,y1:fb.y1}))s+=600;/* le trait ne longe pas le cadre posé sous le texte */if(hit(fb,pb))s+=700;/* cadre jamais sur la pièce */if(outF(fb))s+=2000;}
            if(s<bs){bs=s;best={b,tb,ld,fb};}
          }}
        if(!best)return;
        const l=mepFromSheet(v,best.b.x,best.b.y);nd.b={x:l.x,y:l.y};
        obs.push(best.tb);segs.push(best.ld);if(best.fb)obs.push(best.fb);
      });
    });
  }
  function mepC3Relayout(sh){
    // l'écart a changé : toutes les cotes 3D de la planche rangées de nouveau
    sh=sh||mepSheet();if(!sh)return 0;
    const L=sh.dims.filter(x=>x&&x.c3&&(x.kind==='dist'||x.kind==='dia'||x.kind==='rad'||x.kind==='hole'));
    if(!L.length){mepStatus('Écart entre cotes : '+mepFmtNum(mepC3Gap(sh),1)+' mm (aucune cote 3D sur la planche).');return 0;}
    mepEdit('cotes 3D rangées',()=>mepC3Layout(sh,L));
    mepStatus(L.length+' cote(s) 3D rangée(s), écart '+mepFmtNum(mepC3Gap(sh),1)+' mm.');
    return L.length;
  }
  function mepFrom3D(vid){
    // → nombre de cotes reprises (vue donnée ou sélectionnée, sinon toute la planche)
    const sh=mepSheet();if(!sh)return 0;
    const L=(typeof c3List==='function'?c3List():[]).filter(d=>d);
    if(!L.length){mepStatus('Cotes 3D : la pièce n’en a aucune (onglet CAO, outil Cote 3D).');return 0;}
    const tv=mepC3View(sh,vid),views=(tv?[tv]:sh.views).filter(v=>v&&v.kind!=='dxf'&&!v.camera);
    const has=new Set(),rang=new Map();
    // déjà posée dans une vue, n'importe où dans la mise en plan (toutes les planches) : jamais dans une autre
    const ici=new Set();
    ((doc.mep&&doc.mep.sheets)||[sh]).forEach(s=>(s&&s.dims||[]).forEach(x=>{if(!x||!x.c3)return;const ids=[x.c3].concat(x.c3m||[]);
      ids.forEach(i=>{has.add(i);if(s===sh&&(!tv||x.vid===tv.id))ici.add(i);});}));
    const ailleurs=!tv?0:L.filter(d=>has.has(d.id)&&!ici.has(d.id)).length;
    const add=[];let skip=0,dup=0;
    // lectures d'abord ; Ø et cotes d'axes (trous) avant les autres : ils choisissent la vue où le trou se
    // voit de bout, les autres cotes rejoignent ensuite la vue qui en porte déjà le plus
    const GL=new Map();L.forEach(d=>{if(has.has(d.id))return;let g=null;try{g=c3Refresh(d);}catch(e){g=null;}GL.set(d,g);});
    const fort=d=>{const g=GL.get(d);return g&&!g.err&&(g.k==='dia'||g.k==='pcd'||!!g.ax)?0:1;};
    const LS=L.filter(d=>GL.has(d)).map((d,i)=>({d,i})).sort((p,q)=>fort(p.d)-fort(q.d)||p.i-q.i).map(x=>x.d);
    const vScore=(v,g,how)=>{
      let s=how==='dia'||how==='rad'||how==='cham'||how==='ang'||how==='polar'||how==='pcd'||how==='note'?3:how==='side'?0:1;
      if(how==='dist'&&g.ax){const dir=mepBasisOf(v).dir;if(Math.abs(g.ax.x*dir[0]+g.ax.y*dir[1]+g.ax.z*dir[2])>0.999)s=3;}
      return s+0.001*add.filter(x=>x.vid===v.id).length;
    };
    // « 4× Ø10 » : une seule fois par vue
    const repKey=d=>{if(d.k!=='dia')return null;let t='';try{t=c3Text(d,d.v);}catch(e){t='';}return /^\(?\d+× /.test(t)?t:null;};
    const reps=new Set();sh.dims.forEach(x=>{if(!x||!x.c3)return;const d=L.find(y=>y.id===x.c3),k=d&&repKey(d);if(k)reps.add(x.vid+'|'+k);});
    LS.forEach(d=>{
      if(has.has(d.id))return;
      const g=GL.get(d);
      if(d.ord&&d.og){
        // famille d'ordonnées : une seule cote d'ordonnées de la planche, zéro + toutes ses valeurs
        const M=L.filter(x=>x.ord&&x.og===d.og&&!has.has(x.id));M.forEach(x=>has.add(x.id));
        // la vue où elle se lit le mieux : ses valeurs en vraie grandeur, ses trous vus de bout, son esquisse vue de face
        if(g&&!g.err){
          let SN=null;try{const sk=(doc.sketches||[]).find(s=>s&&String(d.og).indexOf(s.id+':')===0);if(sk)SN=sketchBasis(sk).n;}catch(e){SN=null;}
          const par=(v,a)=>{const r=mepBasisOf(v).dir;return a&&Math.abs(a.x*r[0]+a.y*r[1]+a.z*r[2])>0.999;};
          const C=views.map((v,i)=>({v,i})).filter(x=>mepC3Fits(x.v,g)==='dist').map(x=>{let s=0;
            if(!tv){M.forEach(y=>{const gy=GL.get(y);if(!gy||gy.err)return;if(mepC3Fits(x.v,gy)==='dist')s+=1;if(par(x.v,gy.ax))s+=2;});if(par(x.v,SN))s+=3;}
            return Object.assign(x,{s});}).sort((p,q)=>q.s-p.s||p.i-q.i);
          for(const {v} of C){let nd=null;try{nd=mepC3OrdDim(sh,v,M);}catch(e){nd=null;}if(nd){add.push(nd);return;}}
        }
        skip+=M.length;return;
      }
      if(!g||g.err){skip++;return;}
      const VS=views.map((v,i)=>({v,i,how:mepC3Fits(v,g)})).filter(x=>x.how).map(x=>Object.assign(x,{s:tv?0:vScore(x.v,g,x.how)})).sort((p,q)=>q.s-p.s||p.i-q.i);
      const rk=repKey(d);
      if(rk&&VS.length&&reps.has(VS[0].v.id+'|'+rk)){dup++;return;}
      for(const {v,how} of VS){
        const kk=v.id+'|'+how,n=rang.get(kk)||0;
        let nd=null;try{nd=mepC3Dim(sh,v,d,g,how,n);}catch(e){nd=null;}
        if(!nd)continue;
        rang.set(kk,n+1);add.push(nd);has.add(d.id);if(rk)reps.add(v.id+'|'+rk);
        // cadres de tolérance géométrique de la cote 3D : le 1er posé sous la cote (il la suit), les suivants
        // empilés dessous (under), 3 au plus comme dans la mise en plan
        if(Array.isArray(d.gdt)&&(nd.kind==='dist'||nd.kind==='dia'||nd.kind==='rad'||nd.kind==='hole'||nd.kind==='ang')){
          let up=null;
          d.gdt.filter(f=>f).slice(0,3).forEach(f=>{
            const fr={id:mepUid('d'),kind:'gdt',vid:nd.vid,vid2:null,c3:d.id,
              g:{sym:f.sym||'flat',dia:!!f.dia,val:String(f.val!=null?f.val:'0.05'),mod:f.mod||'',refs:(f.refs||[]).filter(r=>r&&r.l).map(r=>({l:String(r.l),m:r.m||''}))}};
            if(up)fr.under=up;else fr.on=nd.id;
            add.push(fr);up=fr.id;});
        }
        return;
      }
      skip++;
    });
    const ou=tv?' dans la vue '+mepViewName(tv):'';
    const dja=ailleurs?' — '+ailleurs+' déjà dans une autre vue (une cote ne va que dans une vue)':'';
    if(!add.length){mepStatus('Cotes 3D'+ou+' : aucune à reprendre'+(skip?' — '+skip+' ne se lisent pas en vraie grandeur '+(tv?'dans cette vue':'dans les vues de la planche'):dja?'':' (déjà reprises)')+dja+'.');return 0;}
    try{mepC3Layout(sh,add);}catch(e){try{console.warn('mep c3 rangement',e);}catch(e2){}}
    mepEdit('cotes 3D reprises',()=>{add.forEach(x=>{
      // Ø de perçage : son cercle d'axe et ses traits d'axe entrent dans la vue avec lui
      if(x._ax){const vv=mepView(sh,x.vid);if(vv){if(!Array.isArray(vv.axes))vv.axes=[];vv.axes.push(x._ax);}}
      delete x._ax;delete x._c3r;sh.dims.push(x);});});
    mepStatus(add.length+' cote(s) 3D reprise(s)'+ou+(skip?' — '+skip+' ne s’y lisent pas en vraie grandeur':'')+dja+(dup?' — '+dup+' Ø répété(s) déjà indiqué(s) (« n× »)':'')+'. Supprimez celles que vous ne gardez pas (clic + Suppr) ; « Cotes 3D » de nouveau les retire'+(tv?' de cette vue (les autres vues ne bougent pas)':' toutes')+'.');
    return add.length;
  }
  function mepNo3D(vid){
    // retire les cotes reprises de la 3D : de la vue donnée ou sélectionnée, sinon de toute la planche
    const sh=mepSheet();if(!sh)return 0;
    const tv=mepC3View(sh,vid),hit=x=>x&&x.c3&&(!tv||x.vid===tv.id);
    const n=sh.dims.filter(hit).length;
    if(!n){mepStatus('Cotes 3D : aucune '+(tv?'dans la vue '+mepViewName(tv):'sur la planche')+'.');return 0;}
    mepEdit('cotes 3D retirées',()=>{const gone=new Set(sh.dims.filter(hit).map(x=>x.id));sh.dims=sh.dims.filter(x=>!(hit(x)||(x&&x.kind==='gdt'&&gone.has(x.on))));
      (tv?[tv]:sh.views).forEach(v=>{if(v&&Array.isArray(v.axes))v.axes=v.axes.filter(a=>!(a&&a.c3));});}); // cercles de perçage repris
    mepStatus(n+' cote(s) 3D retirée(s)'+(tv?' de la vue '+mepViewName(tv)+' (les autres vues gardent les leurs)':'')+'. « Cotes 3D » les remet.');
    return n;
  }
  function mepToggle3D(vid){
    // bouton du ruban : PAR VUE — la vue sélectionnée en reçoit, ou les perd si elle en a déjà ;
    // sans vue choisie, toute la planche
    const sh=mepSheet();if(!sh)return 0;
    const tv=mepC3View(sh,vid);
    return sh.dims.some(x=>x&&x.c3&&(!tv||x.vid===tv.id))?-mepNo3D(vid):mepFrom3D(vid);
  }
  function mepC3Ctx(sh,v,ev){
    // clic droit sur une vue : ses cotes 3D (mettre / retirer), sans toucher aux autres vues
    if(!v||v.kind==='dxf'||v.camera||typeof c3List!=='function'||!c3List().length)return false;
    const n=sh.dims.filter(x=>x&&x.c3&&x.vid===v.id&&x.kind!=='gdt').length,it=[];
    it.push([n?'Cotes 3D manquantes dans cette vue':'Cotes 3D dans cette vue',()=>{mepFrom3D(v.id);mepSideShow();}]);
    if(n)it.push(['Retirer les cotes 3D de cette vue ('+n+')',()=>{mepNo3D(v.id);mepSideShow();}]);
    mepCtxMenu(ev.clientX,ev.clientY,mepViewName(v),it);
    return true;
  }
