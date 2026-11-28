/* ═══ Tournage (V1.2.7, demande de Fred le 28/11 : « Oui, étape 1 ») ═══
   Posage « Tour » : la pièce tourne sur un axe, l'outil travaille dans le plan
   (Z le long de l'axe, X = rayon ; le programme écrit X en diamètre).
   Ce fichier : posage, outils, machines et PROFIL de la pièce (demi-coupe).

   Repère du tour (coordonnées « z, r ») : origine sur l'axe, à la face AVANT
   de la pièce finie (côté opposé au mandrin) ; z négatif vers le mandrin.

   Le profil vient de la coupe EXACTE du solide par un plan passant par l'axe
   (lignes et arcs vrais : G2/G3 en finition), vérifiée sur le maillage : là où
   la pièce dépasse de cette coupe (forme non de révolution), le maillage
   l'emporte, l'outil ne la coupe jamais. */

function tourIs(s){ return !!(s&&s.proc==='tour'); }
function tourOpIs(op){ return !!(op&&typeof op.type==='string'&&op.type.indexOf('tour_')===0); }
const TOUR_OP_TYPES=['tour_face','tour_rough','tour_finish','tour_drill','tour_part','tour_groove','tour_thread','tour_cdrill'];
const TOUR_OP_NAMES={tour_face:'Dressage',tour_rough:'Chariotage',tour_finish:'Finition',tour_drill:'Perçage en bout',tour_part:'Tronçonnage',
  tour_groove:'Gorge',tour_thread:'Filetage',tour_cdrill:'Perçage axe C'};
const TOUR_OP_NAMES_INT={tour_rough:'Chariotage intérieur',tour_finish:'Alésage (finition)',tour_groove:'Gorge intérieure',tour_thread:'Filetage intérieur'};
function tourOpLabel(op){ return (op&&op.cote==='int'&&TOUR_OP_NAMES_INT[op.type])||TOUR_OP_NAMES[op&&op.type]||'Tournage'; }
const TOUR_TOOL_KINDS=['turn','bore','tdrill','part','groove','thread','ldrill'];

/* ----- machines (fiches PostPro/*-tour.js) ----- */
function tourPosts(){ return tourPosts._m||(tourPosts._m={}); }
function tourMachine(def){
  // Appelée par les fiches PostPro/*-tour.js (insérées avant ce fichier : rien de
  // déclaré en « const » ici ne doit être lu par elle).
  if(!def||!def.id)return;
  const m=Object.assign({kind:'fagor',ext:'nc',numbers:{start:10,step:5},
    coolant:{flood:'M08',off:'M09'},toolChange:['T{T} D{T}'],end:['M30']},def);
  m.kind=m.kind==='siemens'?'siemens':'fagor';
  tourPosts()[m.id]=m;
}
function tourPostOf(s){
  const P=tourPosts(), id=s&&s.machine;
  return P[id]||P.fagor8065t||P[Object.keys(P)[0]]||{id:'fagor8065t',label:'Fagor 8065 T',kind:'fagor',ext:'nc',
    numbers:{start:10,step:5},coolant:{flood:'M08',off:'M09'},toolChange:['T{T} D{T}'],end:['M30']};
}

/* ----- outils de tour ----- */
// kind : 'turn' plaquette d'extérieur (rε, angle de plaquette ε, angle d'attaque κ,
// longueur d'arête l), 'tdrill' foret au centre, 'part' lame de tronçonnage
// (largeur w, profondeur utile h). vc en m/min ; f en mm/tour.
function tourDefaultTools(){
  return [
    {id:'T1',num:1,name:'Ébauche CNMG 120408',kind:'turn',re:0.8,eps:80,kap:95,l:12,vc:200,f:0.25},
    {id:'T2',num:2,name:'Finition DNMG 110404',kind:'turn',re:0.4,eps:55,kap:93,l:11,vc:250,f:0.1},
    {id:'T3',num:3,name:'Foret Ø10',kind:'tdrill',d:10,ang:118,vc:80,f:0.12},
    {id:'T4',num:4,name:'Tronçonnage 3 mm',kind:'part',w:3,h:20,vc:100,f:0.05}
  ];
}
const TOUR_KIND_LABEL={turn:'Plaquette',bore:'Barre d’alésage',tdrill:'Foret',part:'Tronçonnage',groove:'Gorge',thread:'Filetage',ldrill:'Foret motorisé'};
// Étape 2 : barre d'alésage (plaquette tournée vers l'extérieur, Ø mini de passage dmin),
// outil à gorge (largeur w, profondeur utile h, rayons de coin rc ; int : intérieur),
// outil à fileter (angle du filet ang, int : intérieur).
function tourToolNew(kind,setup){
  const T=(setup&&setup.tools)||[];
  let n=1; while(T.some(function(t){return +t.num===n;}))n++;
  const id='T'+n+'_'+Date.now().toString(36);
  if(kind==='tdrill')return {id:id,num:n,name:'Foret Ø8',kind:'tdrill',d:8,ang:118,vc:80,f:0.1};
  if(kind==='part')return {id:id,num:n,name:'Tronçonnage 2 mm',kind:'part',w:2,h:15,vc:100,f:0.04};
  if(kind==='bore')return {id:id,num:n,name:'Barre d’alésage DCMT 070204',kind:'bore',re:0.4,eps:55,kap:93,l:7,dmin:8,vc:180,f:0.08};
  if(kind==='groove')return {id:id,num:n,name:'Gorge 2 mm',kind:'groove',w:2,h:4,rc:0.1,vc:120,f:0.05};
  if(kind==='groovei')return {id:id,num:n,name:'Gorge intérieure 2 mm',kind:'groove',int:true,w:2,h:3,rc:0.1,dmin:10,vc:100,f:0.04};
  // étape 3 : foret motorisé (outil tournant), radial (vers l'axe) ou axial (parallèle à l'axe)
  if(kind==='ldrillr')return {id:id,num:n,name:'Foret motorisé radial Ø6',kind:'ldrill',ax:'rad',d:6,ang:118,vc:60,f:0.08};
  if(kind==='ldrilla')return {id:id,num:n,name:'Foret motorisé axial Ø6',kind:'ldrill',ax:'ax',d:6,ang:118,vc:60,f:0.08};
  if(kind==='thread')return {id:id,num:n,name:'Filetage extérieur 60°',kind:'thread',ang:60,vc:100};
  if(kind==='threadi')return {id:id,num:n,name:'Filetage intérieur 60°',kind:'thread',int:true,ang:60,dmin:10,vc:80};
  return {id:id,num:n,name:'Plaquette VNMG 160404',kind:'turn',re:0.4,eps:35,kap:93,l:16,vc:250,f:0.1};
}
function tourToolById(s,id){
  const T=(s&&s.tools)||[];
  for(let i=0;i<T.length;i++)if(T[i].id===id)return T[i];
  return T[0]||null;
}

/* ----- posage ----- */
function tourDefaultSetup(){
  return {
    id:faoNewId('setup'), name:'TOUR1', proc:'tour', machine:'fagor8065t', wcs:'G54',
    bodies:'all',
    tour:{axis:'auto',flip:false,d:0,face:1,sortie:0,smax:3000,dir:'M3',arcInv:false,
      clrX:2,clrZ:2,tcX:200,tcZ:100},
    coolant:'flood', rapide:10000, toolChg:5,
    tools:tourDefaultTools(), ops:[]
  };
}
function tourCfg(s){
  const t=(s&&s.tour)||{};
  const num=function(v,d){ return isFinite(+v)?+v:d; };
  return {axis:['x','y','z'].indexOf(t.axis)>=0?t.axis:'auto', flip:!!t.flip,
    d:Math.max(0,num(t.d,0)), face:Math.max(0,num(t.face,1)), sortie:Math.max(0,num(t.sortie,0)),
    smax:Math.max(1,num(t.smax,3000)), dir:t.dir==='M4'?'M4':'M3', arcInv:!!t.arcInv,
    clrX:Math.max(0.5,num(t.clrX,2)), clrZ:Math.max(0.5,num(t.clrZ,2)),
    tcX:num(t.tcX,200), tcZ:num(t.tcZ,100),
    cax:!!t.cax, cInv:!!t.cInv, liveN:Math.max(1,Math.round(num(t.liveN,2))), smaxL:Math.max(1,num(t.smaxL,4000)),
    rep:(t.reprise&&t.reprise.from)?{from:String(t.reprise.from),sur:Math.max(0,num(t.reprise.sur,1)),pince:Math.max(1,num(t.reprise.pince,10))}:null};
}
function tourSanitise(s){
  // Posage tour : seules les opérations de tournage y vivent (un collage venu d'un
  // posage de fraisage est retiré), outils de tour seulement.
  if(!s.tour||typeof s.tour!=='object')s.tour=tourDefaultSetup().tour;
  if(!Array.isArray(s.tools))s.tools=tourDefaultTools();
  for(let i=s.tools.length-1;i>=0;i--){ const t=s.tools[i]; if(!t||TOUR_TOOL_KINDS.indexOf(t.kind)<0)s.tools.splice(i,1); }
  if(!s.tools.length)tourDefaultTools().forEach(function(t){ s.tools.push(t); });
  if(!Array.isArray(s.ops))s.ops=[];
  for(let i=s.ops.length-1;i>=0;i--){ const o=s.ops[i]; if(!o||TOUR_OP_TYPES.indexOf(o.type)<0)s.ops.splice(i,1); }
  s.ops.forEach(function(op){
    if(!op.id)op.id=faoNewId('op');
    if(op.on===undefined)op.on=true;
    op.stale=false;
    if(op.cote!=='int')delete op.cote;
    if(op.type==='tour_cdrill'&&op.dir!=='ax')op.dir='rad';
    if(!op.toolId||!s.tools.some(function(t){return t.id===op.toolId;}))op.toolId=tourToolEnsure(s,op.type,tourOpCote(op)).id;
  });
  if(typeof faoStruckSanitise==='function')faoStruckSanitise(s);
}
function tourOpCote(op){ return op&&op.type==='tour_cdrill'?(op.dir==='ax'?'ax':'rad'):op&&op.cote; }
function tourToolKind(type,cote){
  const int=cote==='int';
  if(type==='tour_cdrill')return cote==='ax'?'ldrilla':'ldrillr';
  if(type==='tour_drill')return 'tdrill';
  if(type==='tour_part')return 'part';
  if(type==='tour_groove')return int?'groovei':'groove';
  if(type==='tour_thread')return int?'threadi':'thread';
  return int&&type!=='tour_face'?'bore':'turn';
}
function tourToolMatch(t,k){
  if(k==='ldrilla')return t.kind==='ldrill'&&t.ax==='ax';
  if(k==='ldrillr')return t.kind==='ldrill'&&t.ax!=='ax';
  if(k==='groovei'||k==='threadi')return t.kind===k.slice(0,-1)&&!!t.int;
  if(k==='groove'||k==='thread')return t.kind===k&&!t.int;
  return t.kind===k;
}
function tourToolEnsure(s,type,cote){
  // outil du bon genre : celui de la liste, sinon ajouté (barre, gorge, filetage : à la demande)
  const k=tourToolKind(type,cote), T=s.tools||(s.tools=[]);
  if(T.some(function(t){ return tourToolMatch(t,k); }))return tourToolFor(s,type,cote);
  const t=tourToolNew(k,s); T.push(t); return t;
}
function tourToolFor(s,type,cote){
  const T=s.tools||[];
  const k=tourToolKind(type,cote);
  const L=T.filter(function(t){return tourToolMatch(t,k);});
  if((type==='tour_finish'||type==='tour_thread')&&L.length>1&&k!=='thread'&&k!=='threadi')return L.slice().sort(function(a,b){return (+a.re||0)-(+b.re||0);})[0];
  if((type==='tour_rough'||type==='tour_face')&&L.length>1)return L.slice().sort(function(a,b){return (+b.re||0)-(+a.re||0);})[0];
  return L[0]||T[0];
}
function tourDrillFor(s){
  // foret au Ø de l'alésage du modèle : celui de la liste, sinon un foret inutilisé
  // mis à ce Ø, sinon un foret ajouté
  try{
    const M=s?tourModel(s):null; if(!M||!M.ok||!M.bore)return null;
    // alésage étagé : le foret au PLUS PETIT Ø de la paroi (le reste s'ouvre à la barre d'alésage)
    const rb=(M.inner&&M.inner.rmin<1/0&&M.inner.through===M.bore.through)?Math.min(M.bore.r,M.inner.rmin):M.bore.r;
    const d=Math.floor(2*rb*10+1e-6)/10; if(!(d>=0.5))return null;
    const T=s.tools||(s.tools=[]);
    const ok=T.filter(function(t){ return t.kind==='tdrill'&&Math.abs(+t.d-d)<0.05; })[0];
    if(ok)return ok;
    const used=function(t){ return (s.ops||[]).some(function(o){ return o&&o.toolId===t.id; }); };
    let t=T.filter(function(t){ return t.kind==='tdrill'&&!used(t); })[0];
    if(!t){ t=tourToolNew('tdrill',s); T.push(t); }
    t.d=d; t.name='Foret Ø'+(+d.toFixed(1));
    return t;
  }catch(e){ return null; }
}
function tourOpDefaults(type,s,cote){
  if(TOUR_OP_TYPES.indexOf(type)<0)return null;
  const int=cote==='int'&&['tour_rough','tour_finish','tour_groove','tour_thread'].indexOf(type)>=0;
  const op={id:faoNewId('op'),type:type,on:true,toolId:tourToolEnsure(s,type,type==='tour_cdrill'?(cote==='ax'?'ax':'rad'):(int?'int':'ext')).id};
  if(int)op.cote='int';
  if(type==='tour_face'){ op.ap=1; op.laisse=0; }
  if(type==='tour_rough'){ op.ap=2; op.sx=0.3; op.sz=0.1; op.profil=true; }
  if(type==='tour_finish'){ op.laisse=0; }
  if(type==='tour_drill'){ op.q=0; op.plein=true; const t=tourDrillFor(s); if(t)op.toolId=t.id; }
  if(type==='tour_part'){ op.q=0; op.dEnd=0; }
  if(int&&type==='tour_rough'){ op.ap=1; op.sx=0.2; op.sz=0.1; }
  if(type==='tour_groove'){ op.laisse=0; op.fin=0.1; op.q=0; }
  if(type==='tour_thread'){ op.src='auto'; op.n=0; op.A=30; op.ressort=1; }
  if(type==='tour_cdrill'){
    op.dir=cote==='ax'?'ax':'rad'; op.q=0; op.dsel=0;
    op.toolId=tourToolEnsure(s,type,op.dir).id;
    // foret au Ø du premier trou de ce genre
    try{ const H=tourCHolesOf(s).filter(function(h){ return h.ax===op.dir&&h.ok; }); if(H.length){ const t=tourLiveDrillFor(s,op.dir,H[0].d); if(t){ op.toolId=t.id; op.dsel=H[0].d; } } }catch(e){}
  }
  return op;
}

/* ----- géométrie 2D (z, r) ----- */
const TOUR_EPS=1e-9;
function tourArcEval(p,z){ // sous-arc monotone en z : r(z)
  const dz=z-p.cz, q=p.R*p.R-dz*dz;
  return p.cr+(p.up?1:-1)*Math.sqrt(q>0?q:0);
}
function tourPieceEval(p,z){
  if(p.t==='L')return p.r1+(p.r2-p.r1)*(z-p.z1)/(p.z2-p.z1);
  return tourArcEval(p,z);
}
function tourAngIn(a,a0,a1){ // a dans l'arc CCW a0 → a1
  const T=2*Math.PI; let d=((a-a0)%T+T)%T, e=((a1-a0)%T+T)%T; if(e<1e-12)e=T;
  return d<=e+1e-9;
}
// Primitives de la section → morceaux « fonctions de z » (r ≥ 0), côté négatif replié.
function tourPrimsNorm(prims){
  // Courbes de la coupe (B-splines, ellipses…) : un cercle qui passe à 0,001 mm de tous
  // les points devient un ARC (un congé torique coupé par son axe en donne un), sinon
  // des droites. Les arcs gardent leur sens trigonométrique de 1 vers 2.
  const out=[];
  (prims||[]).forEach(function(p){
    if(!p)return;
    if(p.type!=='curve'){ out.push(p); return; }
    const D=Array.isArray(p.dense)?p.dense:[];
    if(D.length<2)return;
    const c=D.length>=3?tourCircle3(D[0],D[Math.floor(D.length/2)],D[D.length-1]):null;
    let ok=!!c&&c.R<1e4;
    if(ok)for(let i=0;i<D.length&&ok;i++)if(Math.abs(Math.hypot(D[i][0]-c.x,D[i][1]-c.y)-c.R)>1e-3)ok=false;
    if(ok){
      // sens : le point du milieu à gauche de la corde = sens horaire vu (z, r)
      const a=D[0], m=D[Math.floor(D.length/2)], b=D[D.length-1];
      const cr=(m[0]-a[0])*(b[1]-m[1])-(m[1]-a[1])*(b[0]-m[0]);
      if(cr>0)out.push({type:'arc',cx:c.x,cy:c.y,r:c.R,x1:a[0],y1:a[1],x2:b[0],y2:b[1]});
      else out.push({type:'arc',cx:c.x,cy:c.y,r:c.R,x1:b[0],y1:b[1],x2:a[0],y2:a[1]});
      return;
    }
    for(let i=0;i+1<D.length;i++)out.push({type:'line',x1:D[i][0],y1:D[i][1],x2:D[i+1][0],y2:D[i+1][1]});
  });
  return out;
}
function tourCircle3(a,b,c){
  const d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]));
  if(Math.abs(d)<1e-12)return null;
  const A=a[0]*a[0]+a[1]*a[1], B=b[0]*b[0]+b[1]*b[1], C=c[0]*c[0]+c[1]*c[1];
  const x=(A*(b[1]-c[1])+B*(c[1]-a[1])+C*(a[1]-b[1]))/d, y=(A*(c[0]-b[0])+B*(a[0]-c[0])+C*(b[0]-a[0]))/d;
  return {x:x,y:y,R:Math.hypot(a[0]-x,a[1]-y)};
}
function tourPiecesFromPrims(prims){
  const out=[];
  const addLine=function(z1,r1,z2,r2,m){
    if(Math.abs(z2-z1)<1e-7)return; // verticale : un saut de l'enveloppe, pas une fonction
    if(z1>z2){ const a=z1,b=r1; z1=z2; r1=r2; z2=a; r2=b; }
    out.push({t:'L',z1:z1,r1:r1,z2:z2,r2:r2,lo:z1,hi:z2,m:!!m});
  };
  const line=function(z1,r1,z2,r2){
    // coupée en r = 0, chaque moitié rabattue du côté positif
    if((r1<0&&r2>0)||(r1>0&&r2<0)){
      const t=r1/(r1-r2), zm=z1+(z2-z1)*t;
      line(z1,r1,zm,0); line(zm,0,z2,r2); return;
    }
    addLine(z1,Math.abs(r1),z2,Math.abs(r2),r1+r2<0); // m : moitié repliée (côté négatif de la coupe)
  };
  const arc=function(cz,cr,R,a0,a1){
    // arc CCW a0 → a1 : coupé en 0, π (monotone en z) et là où r = 0
    const T=2*Math.PI;
    let e=((a1-a0)%T+T)%T; if(e<1e-12)e=T;
    const cuts=[0,Math.PI];
    const k=-cr/R;
    if(k>-1&&k<1){ const s=Math.asin(k); cuts.push(s,Math.PI-s); }
    const L=[0,e];
    cuts.forEach(function(c){ const d=((c-a0)%T+T)%T; if(d>1e-9&&d<e-1e-9)L.push(d); });
    L.sort(function(a,b){return a-b;});
    for(let i=0;i+1<L.length;i++){
      const b0=a0+L[i], b1=a0+L[i+1];
      if(b1-b0<1e-10)continue;
      const am=(b0+b1)/2, rm=cr+R*Math.sin(am);
      let ccz=cz, ccr=cr, s0=b0, s1=b1;
      if(rm<0){ ccr=-cr; s0=-b1; s1=-b0; } // miroir (z, r) → (z, −r) : l'arc reste CCW
      const up=Math.sin((s0+s1)/2)>0;
      const za=ccz+R*Math.cos(s0), zb=ccz+R*Math.cos(s1);
      const lo=Math.min(za,zb), hi=Math.max(za,zb);
      if(hi-lo<1e-7)continue;
      out.push({t:'A',cz:ccz,cr:ccr,R:R,up:up,lo:lo,hi:hi,m:rm<0});
    }
  };
  (prims||[]).forEach(function(p){
    if(!p)return;
    if(p.type==='line')line(p.x1,p.y1,p.x2,p.y2);
    else if(p.type==='arc'){
      arc(p.cx,p.cy,p.r,Math.atan2(p.y1-p.cy,p.x1-p.cx),Math.atan2(p.y2-p.cy,p.x2-p.cx));
    }else if(p.type==='circle')arc(p.cx,p.cy,p.r,0,2*Math.PI);
    else if(p.type==='curve'&&Array.isArray(p.dense)){
      for(let i=0;i+1<p.dense.length;i++)line(p.dense[i][0],p.dense[i][1],p.dense[i+1][0],p.dense[i+1][1]);
    }
  });
  return out;
}
function tourIsectZ(a,b){
  // z des intersections de deux morceaux (dans leurs deux intervalles)
  const lo=Math.max(a.lo,b.lo), hi=Math.min(a.hi,b.hi), Z=[];
  if(hi-lo<1e-9)return Z;
  const geo=function(p){ // droite : r = m z + q ; cercle : centre, R
    if(p.t==='L'){ const m=(p.r2-p.r1)/(p.z2-p.z1); return {L:1,m:m,q:p.r1-m*p.z1}; }
    return {L:0,cz:p.cz,cr:p.cr,R:p.R};
  };
  const A=geo(a), B=geo(b);
  const lc=function(l,c){ // m z + q sur le cercle
    const qq=l.q-c.cr, aa=1+l.m*l.m, bb=2*(l.m*qq-c.cz), cc=c.cz*c.cz+qq*qq-c.R*c.R, D=bb*bb-4*aa*cc;
    if(D<0)return [];
    const s=Math.sqrt(D); return [(-bb-s)/(2*aa),(-bb+s)/(2*aa)];
  };
  if(A.L&&B.L){ if(Math.abs(A.m-B.m)>1e-12)Z.push((B.q-A.q)/(A.m-B.m)); }
  else if(A.L)lc(A,B).forEach(function(z){Z.push(z);});
  else if(B.L)lc(B,A).forEach(function(z){Z.push(z);});
  else{
    const dx=B.cz-A.cz, dy=B.cr-A.cr, d=Math.hypot(dx,dy);
    if(d>1e-12&&d<=A.R+B.R+1e-9&&d>=Math.abs(A.R-B.R)-1e-9){
      const l=(A.R*A.R-B.R*B.R+d*d)/(2*d), h2=A.R*A.R-l*l, h=Math.sqrt(h2>0?h2:0);
      const mx=A.cz+dx*l/d;
      Z.push(mx+(-dy)*h/d, mx-(-dy)*h/d);
    }
  }
  return Z.filter(function(z){ return z>lo+1e-9&&z<hi-1e-9&&Math.abs(tourPieceEval(a,z)-tourPieceEval(b,z))<1e-5; });
}
// Enveloppe SUPÉRIEURE des morceaux → chaîne d'éléments de l'avant (zMax) vers l'arrière.
// Éléments : {t:'L',z1,r1,z2,r2} ou {t:'A',z1,r1,z2,r2,cz,cr,R,ccw}.
function tourEnvelope(P){
  if(!P.length)return [];
  const BZ=[];
  P.forEach(function(p){ BZ.push(p.lo,p.hi); });
  for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++)tourIsectZ(P[i],P[j]).forEach(function(z){BZ.push(z);});
  BZ.sort(function(a,b){return b-a;});
  const Z=[]; BZ.forEach(function(z){ if(!Z.length||Z[Z.length-1]-z>1e-7)Z.push(z); });
  const iv=[];
  for(let i=0;i+1<Z.length;i++){
    const hi=Z[i], lo=Z[i+1], zm=(hi+lo)/2;
    let best=null, bv=-1/0;
    P.forEach(function(p){ if(p.lo<=zm&&p.hi>=zm){ const v=tourPieceEval(p,zm); if(v>bv+1e-9){bv=v;best=p;} } });
    if(best&&iv.length&&iv[iv.length-1].p===best&&Math.abs(iv[iv.length-1].lo-hi)<1e-7)iv[iv.length-1].lo=lo;
    else iv.push({p:best,hi:hi,lo:lo});
  }
  const E=[];
  let cz=Z[0], cr=0;
  const push=function(e){ if(Math.hypot(e.z2-e.z1,e.r2-e.r1)>1e-7)E.push(e); };
  iv.forEach(function(I){
    const r1=I.p?tourPieceEval(I.p,I.hi):0, r2=I.p?tourPieceEval(I.p,I.lo):0;
    if(Math.abs(r1-cr)>1e-6||Math.abs(I.hi-cz)>1e-7)push({t:'L',z1:cz,r1:cr,z2:I.hi,r2:r1});
    if(!I.p||I.p.t==='L')push({t:'L',z1:I.hi,r1:r1,z2:I.lo,r2:r2});
    else push({t:'A',z1:I.hi,r1:r1,z2:I.lo,r2:r2,cz:I.p.cz,cr:I.p.cr,R:I.p.R,ccw:I.p.up});
    cz=I.lo; cr=r2;
  });
  if(cr>1e-6)push({t:'L',z1:cz,r1:cr,z2:cz,r2:0});
  // segments alignés bout à bout (même droite) : un seul
  const M=[];
  E.forEach(function(e){
    const p=M[M.length-1];
    if(p&&p.t==='L'&&e.t==='L'){
      const ax=p.z2-p.z1, ay=p.r2-p.r1, bx=e.z2-e.z1, by=e.r2-e.r1;
      const cross=ax*by-ay*bx, la=Math.hypot(ax,ay), lb=Math.hypot(bx,by);
      if(Math.abs(cross)<1e-9*la*lb+1e-12&&ax*bx+ay*by>0){ p.z2=e.z2; p.r2=e.r2; return; }
    }
    M.push(e);
  });
  return M;
}
function tourElemsEvalTop(E,z){ // r de l'enveloppe à z (le plus haut des éléments qui couvrent z)
  let best=-1/0;
  E.forEach(function(e){
    const lo=Math.min(e.z1,e.z2), hi=Math.max(e.z1,e.z2);
    if(z<lo-1e-9||z>hi+1e-9)return;
    let v;
    if(hi-lo<1e-9)v=Math.max(e.r1,e.r2);
    else if(e.t==='L')v=e.r1+(e.r2-e.r1)*(z-e.z1)/(e.z2-e.z1);
    else{ const dz=z-e.cz, q=e.R*e.R-dz*dz; v=e.cr+(e.ccw?1:-1)*Math.sqrt(q>0?q:0); }
    if(v>best)best=v;
  });
  return best;
}

/* ----- repère du tour, maillage, coupe exacte ----- */
function tourBodies(setup){
  if(typeof bodies==='undefined'||!bodies)return [];
  const only=(setup&&Array.isArray(setup.bodies))?setup.bodies:null;
  return bodies.filter(function(b){ return b&&!b.ghost&&b.visible!==false&&(!only||only.indexOf(b.id)>=0); });
}
function tourShapeOf(b){
  try{
    if(b.kind==='import'&&typeof importGeom!=='undefined'){ const e=importGeom.get(b.id); return (e&&e.brep)||null; }
    if(b.kind==='body'&&b.shape)return b.shape;
  }catch(e){}
  return null;
}
let tourModelCache=null;
function tourModelSig(setup){
  const C=tourCfg(setup);
  const ids=tourBodies(setup).map(function(b){ return b.id+(tourShapeOf(b)?'s':'m'); }).join(',');
  return [(typeof _docVersion!=='undefined'?_docVersion:0),ids,C.axis,C.flip?1:0,
    (typeof occtReady!=='undefined'&&occtReady)?1:0].join('|');
}
function tourModel(setup){
  // {ok, W,U,V,Pf (repère monde), L, Rmax, elems (profil exact), pts (nuage de contrôle),
  //  bore, src:'exact'|'maillage', warns}
  const sig=tourModelSig(setup);
  if(tourModelCache&&tourModelCache.setup===setup&&tourModelCache.sig===sig)return tourModelCache.m;
  let m=null;
  try{ m=tourModelBuild(setup); }catch(e){ m={ok:false,warns:['profil : '+((e&&e.message)||e)]}; }
  tourModelCache={setup:setup,sig:sig,m:m};
  return m;
}
function tourModelBuild(setup){
  const BL=tourBodies(setup), warns=[];
  if(!BL.length)return {ok:false,warns:['aucun corps à tourner']};
  const meshes=[];
  BL.forEach(function(b){ let mm=null; try{ mm=faoMeshFromBodyCached(b); }catch(e){} if(mm&&mm.v&&mm.v.length)meshes.push(mm); });
  if(!meshes.length)return {ok:false,warns:['corps sans maillage']};
  let x0=1/0,y0=1/0,z0=1/0,x1=-1/0,y1=-1/0,z1=-1/0;
  meshes.forEach(function(mm){ mm.v.forEach(function(p){
    if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0]; if(p[1]<y0)y0=p[1]; if(p[1]>y1)y1=p[1]; if(p[2]<z0)z0=p[2]; if(p[2]>z1)z1=p[2]; }); });
  const ext=[x1-x0,y1-y0,z1-z0], C=tourCfg(setup);
  let ai=2;
  if(C.axis!=='auto')ai={x:0,y:1,z:2}[C.axis];
  else{
    // axe auto : celui dont la section (deux autres côtés) est la plus « ronde » ; à égalité, le plus long
    let best=1/0;
    [2,0,1].forEach(function(a){
      const e1=ext[(a+1)%3], e2=ext[(a+2)%3], s=Math.abs(e1-e2)/Math.max(e1,e2,1e-9);
      if(s<best-0.02||(Math.abs(s-best)<=0.02&&ext[a]>ext[ai])){ best=Math.min(best,s); ai=a; }
    });
  }
  const W=[0,0,0]; W[ai]=C.flip?-1:1;
  const U=[0,0,0]; U[ai===2?0:2]=1; // plan du profil : vertical (Z en haut) dès que l'axe n'est pas Z, comme une vue de face
  const V=[W[1]*U[2]-W[2]*U[1],W[2]*U[0]-W[0]*U[2],W[0]*U[1]-W[1]*U[0]];
  const ctr=[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2];
  let phi=0;
  // centre en travers de l'axe : moyenne des sommets (chaque cercle du maillage est réparti
  // tout autour de l'axe) ; le milieu de la boîte décale l'axe quand le nombre de côtés est impair
  { let n=0; const sm=[0,0,0];
    meshes.forEach(function(mm){ mm.v.forEach(function(p){ sm[0]+=p[0]; sm[1]+=p[1]; sm[2]+=p[2]; n++; }); });
    if(n)for(let k=0;k<3;k++)if(k!==ai)ctr[k]=sm[k]/n; }
  // trous hors axe : leurs sommets décalent la moyenne ; cercle ajusté sur les sommets du plus
  // grand Ø (les bords des trous sont sur ce même cylindre), gardé s'il colle au maillage
  { const i1=(ai+1)%3, i2=(ai+2)%3; let c1=(x0+x1)/2*(i1===0)+(y0+y1)/2*(i1===1)+(z0+z1)/2*(i1===2), c2=(x0+x1)/2*(i2===0)+(y0+y1)/2*(i2===1)+(z0+z1)/2*(i2===2);
    let fit=null;
    for(let it=0;it<3;it++){
      let Rm=0; meshes.forEach(function(mm){ mm.v.forEach(function(p){ const r=Math.hypot(p[i1]-c1,p[i2]-c2); if(r>Rm)Rm=r; }); });
      const lim=Rm*(it?0.995:0.97);
      let Sx=0,Sy=0,Sxx=0,Syy=0,Sxy=0,Sxz=0,Syz=0,Sz=0,N=0;
      meshes.forEach(function(mm){ mm.v.forEach(function(p){ const u=p[i1]-c1, v=p[i2]-c2; if(Math.hypot(u,v)<lim)return; const w=u*u+v*v;
        Sx+=u; Sy+=v; Sxx+=u*u; Syy+=v*v; Sxy+=u*v; Sxz+=u*w; Syz+=v*w; Sz+=w; N++; }); });
      if(N<6)break;
      // Kåsa : u² + v² + D u + E v + F = 0
      const A=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,N]], B=[-Sxz,-Syz,-Sz];
      const det=function(m){ return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]); };
      const d0=det(A); if(!(Math.abs(d0)>1e-12))break;
      const col=function(j){ return A.map(function(r,i){ return r.map(function(x,k){ return k===j?B[i]:x; }); }); };
      const D=det(col(0))/d0, E=det(col(1))/d0;
      c1+=-D/2; c2+=-E/2; fit=true;
    }
    if(fit){
      // contrôle : écart des sommets du grand Ø au cercle ajusté
      let Rm=0; meshes.forEach(function(mm){ mm.v.forEach(function(p){ const r=Math.hypot(p[i1]-c1,p[i2]-c2); if(r>Rm)Rm=r; }); });
      let e=0, N=0; meshes.forEach(function(mm){ mm.v.forEach(function(p){ const r=Math.hypot(p[i1]-c1,p[i2]-c2); if(r>Rm*0.97){ e=Math.max(e,Rm-r); N++; } }); });
      const dm=Math.hypot(c1-ctr[i1],c2-ctr[i2]);
      if(N>=6&&e<Math.max(0.02,Rm*0.03)&&dm>1e-6){ ctr[i1]=c1; ctr[i2]=c2; }
    } }
  const dot=function(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];};
  let zmax=-1/0, zmin=1/0;
  meshes.forEach(function(mm){ mm.v.forEach(function(p){ const t=dot([p[0]-ctr[0],p[1]-ctr[1],p[2]-ctr[2]],W); if(t>zmax)zmax=t; if(t<zmin)zmin=t; }); });
  const Pf=[ctr[0]+W[0]*zmax,ctr[1]+W[1]*zmax,ctr[2]+W[2]*zmax];
  const L=zmax-zmin;
  const loc=function(p){ const d=[p[0]-Pf[0],p[1]-Pf[1],p[2]-Pf[2]], z=dot(d,W);
    return [z,Math.hypot(d[0]-z*W[0],d[1]-z*W[1],d[2]-z*W[2])]; };
  // enveloppe du MAILLAGE : r maxi par tranche de 0,05 mm (sommets + coupes des arêtes)
  const H=0.05, NB=Math.max(1,Math.ceil(L/H)+1), rM=new Float64Array(NB).fill(-1), rV=new Float64Array(NB).fill(-1);
  // rV : sommets seuls (sur les surfaces) ; rM : + coupes des arêtes — une corde passe au-dessus d'un creux
  const bin=function(z){ return Math.max(0,Math.min(NB-1,Math.round(-z/H))); };
  meshes.forEach(function(mm){
    const Q=mm.v.map(loc);
    Q.forEach(function(q){ const k=bin(q[0]); if(q[1]>rM[k])rM[k]=q[1]; if(q[1]>rV[k])rV[k]=q[1]; });
    mm.t.forEach(function(t){
      for(let e=0;e<3;e++){
        const a=mm.v[t[e]], b=mm.v[t[(e+1)%3]], qa=Q[t[e]], qb=Q[t[(e+1)%3]];
        const za=qa[0], zb=qb[0];
        const k0=Math.ceil(Math.min(-za,-zb)/H), k1=Math.floor(Math.max(-za,-zb)/H);
        for(let k=k0;k<=k1&&k-k0<4000;k++){
          const zz=-k*H, s=(zz-za)/((zb-za)||1e-30);
          if(s<0||s>1)continue;
          const r=loc([a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s,a[2]+(b[2]-a[2])*s])[1];
          if(k>=0&&k<NB&&r>rM[k])rM[k]=r;
        }
      }
    });
  });
  let Rmax=0; for(let k=0;k<NB;k++)if(rM[k]>Rmax)Rmax=rM[k];
  // coupe EXACTE par le plan (axe, U)
  let elems=null, src='maillage', prims=[], primsPos=[];
  // plan de coupe : tourné autour de l'axe pour passer loin des trous hors axe (perçages à l'axe C),
  // sinon un trou radial ou axial creuserait le profil tourné ; C = 0 reste sur U
  try{ phi=tourSectionAngle(tourCHolesRaw(W,U,V,Pf,null)); }catch(e){ phi=0; }
  const cp=Math.cos(phi*Math.PI/180), sp=Math.sin(phi*Math.PI/180);
  const U2=[cp*U[0]+sp*V[0],cp*U[1]+sp*V[1],cp*U[2]+sp*V[2]], V2=[cp*V[0]-sp*U[0],cp*V[1]-sp*U[1],cp*V[2]-sp*U[2]];
  if(typeof occtReady!=='undefined'&&occtReady&&typeof occIsectSection==='function'){
    const B={o:{x:Pf[0],y:Pf[1],z:Pf[2]},n:{x:V2[0],y:V2[1],z:V2[2]},u:{x:W[0],y:W[1],z:W[2]},v:{x:U2[0],y:U2[1],z:U2[2]}};
    let nOk=0;
    BL.forEach(function(b){ const sh=tourShapeOf(b); if(!sh)return;
      try{ const L2=occIsectSection(sh,B,false); if(L2&&L2.length){ nOk++; tourPrimsNorm(L2).forEach(function(p){prims.push(p);}); } }catch(e){} });
    if(nOk){
      const P=tourPiecesFromPrims(prims);
      const E=tourEnvelope(P);
      // contrôle : la coupe doit recouvrir le maillage (repère et corps cohérents)
      let bad=0, far=0, n=0;
      for(let k=0;k<NB;k++){ if(rV[k]<0)continue; n++;
        const re=Math.max(tourElemsEvalTop(E,-k*H),k?tourElemsEvalTop(E,-k*H+H/2):-1/0,k<NB-1?tourElemsEvalTop(E,-k*H-H/2):-1/0);
        if(!(re>-1/0)||rV[k]>re+0.03)bad++;
        if(!(re>-1/0)||Math.abs(rM[k]-re)>1)far++; }
      if(E.length&&far<=n*0.2){ elems=E; src='exact'; if(bad)warns.push('pièce pas entièrement de révolution : '+Math.round(bad*H*10)/10+' mm de longueur où elle dépasse de la coupe — le tournage s’arrête à sa forme réelle'); }
      else if(E.length)warns.push('coupe exacte incohérente avec le maillage : profil pris sur le maillage');
      primsPos=prims;
    }
  }
  if(!elems){
    // repli : polyligne du maillage simplifiée (sans arcs)
    const pts=[[0,0]];
    for(let k=0;k<NB;k++)if(rM[k]>=0)pts.push([-k*H,rM[k]]);
    pts.push([-(NB-1)*H,0]);
    const S=tourSimplify(pts,0.01);
    elems=[];
    for(let i=0;i+1<S.length;i++)elems.push({t:'L',z1:S[i][0],r1:S[i][1],z2:S[i+1][0],r2:S[i+1][1]});
  }
  // nuage de contrôle : points du profil exact + sommets du maillage qui dépassent
  const pts=tourElemsSample(elems,0.01);
  const rC=src==='exact'?rV:rM;
  for(let k=0;k<NB;k++){ if(rC[k]<0)continue; const z=-k*H, re=Math.max(tourElemsEvalTop(elems,z),tourElemsEvalTop(elems,z+H/2),tourElemsEvalTop(elems,z-H/2)); if(rC[k]>re+0.005)pts.push([z,rC[k]]); }
  if(src==='exact'){ Rmax=0; tourElemsSample(elems,0.02).forEach(function(p){ if(p[1]>Rmax)Rmax=p[1]; }); } // Ø exact (les arêtes du maillage débordent d'un creux)
  const bore=tourBoreFrom(primsPos,L);
  let inner=null;
  if(src==='exact'&&bore){ try{ inner=tourInnerFrom(primsPos,L); }catch(e){ inner=null; } }
  return {ok:true,W:W,U:U,V:V,Pf:Pf,L:L,Rmax:Rmax,elems:elems,pts:pts,bore:bore,inner:inner,src:src,warns:warns,phi:phi};
}
function tourSimplify(P,tol){ // Douglas-Peucker
  if(P.length<3)return P.slice();
  const keep=new Uint8Array(P.length); keep[0]=keep[P.length-1]=1;
  const st=[[0,P.length-1]];
  while(st.length){
    const s=st.pop(), a=P[s[0]], b=P[s[1]], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1e-30;
    let im=-1, dm=tol;
    for(let i=s[0]+1;i<s[1];i++){ const d=Math.abs((P[i][0]-a[0])*dy-(P[i][1]-a[1])*dx)/l; if(d>dm){dm=d;im=i;} }
    if(im>=0){ keep[im]=1; st.push([s[0],im],[im,s[1]]); }
  }
  return P.filter(function(p,i){return keep[i];});
}
function tourElemsSample(E,step){
  const out=[];
  E.forEach(function(e){
    out.push([e.z1,e.r1]);
    if(e.t==='L'){
      const l=Math.hypot(e.z2-e.z1,e.r2-e.r1), n=Math.max(1,Math.ceil(l/step));
      for(let i=1;i<n;i++)out.push([e.z1+(e.z2-e.z1)*i/n,e.r1+(e.r2-e.r1)*i/n]);
    }else{
      const a0=Math.atan2(e.r1-e.cr,e.z1-e.cz), a1=Math.atan2(e.r2-e.cr,e.z2-e.cz);
      let d=a1-a0; const T=2*Math.PI;
      if(e.ccw){ while(d<=0)d+=T; } else { while(d>=0)d-=T; }
      const n=Math.max(1,Math.ceil(Math.abs(d)*e.R/step));
      for(let i=1;i<n;i++){ const a=a0+d*i/n; out.push([e.cz+e.R*Math.cos(a),e.cr+e.R*Math.sin(a)]); }
    }
    out.push([e.z2,e.r2]);
  });
  return out;
}
function tourBoreFrom(prims,L){
  // Alésage dans l'axe, ouvert à l'avant : rayon, longueur au Ø plein, débouchant ?
  // Le long d'une droite radiale à z, les bords coupés (côté r ≥ 0 de la coupe) :
  // en nombre PAIR, l'axe est hors matière (trou).
  if(!prims||!prims.length)return null;
  const P=[];
  prims.forEach(function(p){
    if(p.type==='line'){ if(Math.abs(p.x2-p.x1)>1e-7)P.push({t:'L',z1:p.x1,r1:p.y1,z2:p.x2,r2:p.y2,lo:Math.min(p.x1,p.x2),hi:Math.max(p.x1,p.x2)}); }
  });
  tourPiecesFromPrims(prims.filter(function(p){return p.type==='arc'||p.type==='circle';})).forEach(function(q){ if(!q.m)P.push(q); });
  const cuts=function(z){
    const R=[];
    P.forEach(function(p){ if(p.lo<z&&p.hi>z){ let v; if(p.t==='L'){ v=p.r1+(p.r2-p.r1)*(z-p.z1)/(p.z2-p.z1); } else v=tourArcEval(p,z); if(v>1e-6)R.push(v); } });
    return R.sort(function(a,b){return a-b;});
  };
  const c0=cuts(-0.02);
  if(c0.length<2||c0.length%2)return null;
  const rb=c0[0];
  let full=0, end=0, through=true;
  for(let z=-0.02;z>-L+0.01;z-=0.02){
    const c=cuts(z);
    if(!c.length||c.length%2){ through=false; end=-z; break; }
    if(!full&&c[0]<rb-0.01)full=-z;
  }
  if(through){ end=L; if(!full)full=L; }
  if(!full)full=end;
  return {r:rb,full:full,end:end,through:through};
}
// Profil INTÉRIEUR (étape 2) : la paroi de l'alésage, de la face avant vers le fond.
// Le long d'une droite radiale à z, les bords coupés du côté r ≥ 0 de la coupe : en nombre
// pair, l'axe est hors matière et le plus bas est la paroi. Chaîne d'éléments comme
// tourEnvelope (z décroissant), sauts radiaux en droites verticales ; un fond (alésage
// borgne) finit par une verticale jusqu'à l'axe.
function tourInnerFrom(prims,L){
  const P=tourPiecesFromPrims(prims).filter(function(p){ return !p.m; });
  if(!P.length)return null;
  const BZ=[0];
  P.forEach(function(p){ if(p.lo<0.5&&p.hi>-L-0.5)BZ.push(Math.min(0,p.lo),Math.min(0,p.hi)); });
  for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++)tourIsectZ(P[i],P[j]).forEach(function(z){ if(z<0)BZ.push(z); });
  BZ.push(-L);
  BZ.sort(function(a,b){return b-a;});
  const Z=[]; BZ.forEach(function(z){ if(z<=1e-9&&z>=-L-1e-9&&(!Z.length||Z[Z.length-1]-z>1e-7))Z.push(z); });
  const iv=[];
  let through=true, zb=-L;
  for(let i=0;i+1<Z.length;i++){
    const hi=Z[i], lo=Z[i+1], zm=(hi+lo)/2;
    const V=[];
    P.forEach(function(p){ if(p.lo<=zm&&p.hi>=zm){ const v=tourPieceEval(p,zm); if(v>1e-6)V.push({v:v,p:p}); } });
    if(V.length<2||V.length%2){ through=false; zb=hi; break; }
    V.sort(function(a,b){return a.v-b.v;});
    const best=V[0].p;
    if(iv.length&&iv[iv.length-1].p===best&&Math.abs(iv[iv.length-1].lo-hi)<1e-7)iv[iv.length-1].lo=lo;
    else iv.push({p:best,hi:hi,lo:lo});
  }
  if(!iv.length||iv[0].hi<-1e-6)return null;
  const E=[];
  let cz=0, cr=null;
  const push=function(e){ if(Math.hypot(e.z2-e.z1,e.r2-e.r1)>1e-7)E.push(e); };
  iv.forEach(function(I){
    const r1=tourPieceEval(I.p,I.hi), r2=tourPieceEval(I.p,I.lo);
    if(cr!==null&&(Math.abs(r1-cr)>1e-6||Math.abs(I.hi-cz)>1e-7))push({t:'L',z1:cz,r1:cr,z2:I.hi,r2:r1});
    if(I.p.t==='L')push({t:'L',z1:I.hi,r1:r1,z2:I.lo,r2:r2});
    else push({t:'A',z1:I.hi,r1:r1,z2:I.lo,r2:r2,cz:I.p.cz,cr:I.p.cr,R:I.p.R,ccw:I.p.up});
    cz=I.lo; cr=r2;
  });
  if(!through&&cr>1e-6)push({t:'L',z1:cz,r1:cr,z2:cz,r2:0});
  let rmin=1/0, rmax=0;
  tourElemsSample(E,0.05).forEach(function(q){ if(q[1]>1e-6&&q[1]<rmin)rmin=q[1]; if(q[1]>rmax)rmax=q[1]; });
  return {elems:E,through:through,zb:through?-L:zb,r0:E.length?E[0].r1:0,rmin:rmin,rmax:rmax};
}
/* ----- brut et limites ----- */
function tourStock(setup){
  const C=tourCfg(setup), M=tourModel(setup);
  const SP=C.rep?tourStockProfile(setup):null;
  if(SP){
    // reprise : la pièce sortie du premier posage, retournée, tenue sur pince mm côté arrière
    const L=(M&&M.ok)?M.L:SP.L, chuck=-L+C.rep.pince;
    return {R:SP.R, d:2*SP.R, face:SP.zf, sortie:SP.zf-chuck, chuck:chuck, L:L, rep:SP};
  }
  const L=(M&&M.ok)?M.L:50, Rp=(M&&M.ok)?M.Rmax:20;
  const d=C.d>0?C.d:(Math.ceil(2*Rp-0.005)+2); // 36,00001 → 36
  const face=C.face;
  const sortie=C.sortie>0?C.sortie:(Math.ceil(L+face)+15);
  return {R:d/2, d:d, face:face, sortie:sortie, chuck:face-sortie, L:L};
}
/* ----- reprise de la 2e face (étape 2) -----
   Posage tour dont tour.reprise = {from: posage d'origine, sur: matière laissée sur la
   face à reprendre, pince: longueur tenue dans le mandrin}. Son brut est le résultat de
   la simulation du posage d'origine (le morceau tronçonné), retourné : z2 = −L − z1. */
function tourSetupById(id){
  try{ const r=faoRoot(); return (r.setups||[]).filter(function(x){ return x&&x.id===id; })[0]||null; }catch(e){ return null; }
}
function tourRepriseOf(setup){
  // posage qui reprend celui-ci (pour placer le tronçonnage avec la surépaisseur)
  try{ const r=faoRoot(); return (r.setups||[]).filter(function(x){ return tourIs(x)&&x!==setup&&x.tour&&x.tour.reprise&&x.tour.reprise.from===setup.id; })[0]||null; }catch(e){ return null; }
}
let tourSPCache=new WeakMap(), tourSPBusy=0;
function tourStockSig(setup){
  const C=tourCfg(setup); if(!C.rep)return '';
  const src=tourSetupById(C.rep.from); if(!src||src===setup)return 'x';
  return JSON.stringify([C.rep,src.ops,src.tools,src.tour,src.bodies])+'|'+tourModelSig(src);
}
function tourStockProfile(setup){
  const C=tourCfg(setup); if(!C.rep)return null;
  const src=tourSetupById(C.rep.from); if(!src||src===setup||!tourIs(src)||tourSPBusy>3)return null;
  const sig=tourStockSig(setup), e=tourSPCache.get(setup);
  if(e&&e.sig===sig)return e.v;
  let v=null;
  tourSPBusy++;
  try{ v=tourStockProfileBuild(setup,src,C); }catch(err){ v=null; }
  finally{ tourSPBusy--; }
  tourSPCache.set(setup,{sig:sig,v:v});
  return v;
}
function tourStockProfileBuild(setup,src,C){
  const M1=tourModel(src); if(!M1||!M1.ok)return null;
  const sm=tourSimBuild(src); if(!sm)return null;
  tourSimAdvance(sm,sm.T+1);
  const L=M1.L, g=sm.g, z0=sm.z0, n=sm.n, RO=sm.rout, RI=sm.rin;
  const has=function(k){ return k>=0&&k<n&&RO[k]-RI[k]>1e-3; };
  let k=Math.floor((-L/2-z0)/g); if(!has(k))return null;
  let ka=k, kb=k; while(has(ka-1))ka--; while(has(kb+1))kb++;
  const z1a=z0+ka*g, z1b=z0+(kb+1)*g;
  // sans tronçonnage, la pièce tient encore à la barre : coupée à sur mm derrière la face
  const zc=-L-C.rep.sur; let a=ka; if(z1a<zc-1e-9)a=Math.max(ka,Math.ceil((zc-z0)/g));
  const zf=-L-(z0+a*g), zb=-L-z1b;
  const col=function(z2){ return Math.floor((-L-z2-z0)/g); };
  let R=0; for(let j=a;j<=kb;j++)if(RO[j]>R)R=RO[j];
  const Rat=function(z2){ const j=col(z2); return (j>=a&&j<=kb)?RO[j]:-1/0; };
  const RIat=function(z2){ const j=col(z2); return (j>=a&&j<=kb)?RI[j]:0; };
  // trou à l'avant de la reprise (côté tronçonné) et sa profondeur
  // (la face avant de la reprise est la colonne a, côté tronçonné)
  let rin0=RI[a], dep=0;
  for(let j=a;j<=kb&&RI[j]>1e-3;j++){ dep=(j+1-a)*g; if(RI[j]<rin0)rin0=RI[j]; }
  return {zf:+zf.toFixed(4),zb:zb,R:R,L:L,Rat:Rat,RIat:RIat,rin0:rin0>1e-3?rin0:0,rinDepth:dep-Math.max(0,zf),g:g};
}
function tourStockTopFn(setup){ const S=tourStock(setup); return S.rep?S.rep.Rat:null; }
function tourZEnd(setup,op){
  // limite arrière (pointe de l'outil) : 1 mm derrière la face arrière, jamais à
  // moins de 3 mm du mandrin
  const S=tourStock(setup);
  let z=(op&&isFinite(+op.zEnd)&&op.zEnd!==null&&op.zEnd!=='')?+op.zEnd:-(S.L+1);
  if(z<S.chuck+3)z=S.chuck+3;
  return z;
}

/* ----- étape 3 : trous hors axe (outils tournants, axe C) ----- */
// Trous de la fonction Perçage du modèle qui ne sont pas dans l'axe du tour :
//  radiaux (axe du trou qui coupe l'axe du tour, à angle droit) ou axiaux (parallèles à l'axe, décalés).
// Repère : z le long de l'axe (0 = face avant), C en degrés de U vers V (0 à 360).
function tourCHolesRaw(W,U,V,Pf,M){
  const out=[];
  if(typeof doc==='undefined'||!doc||!Array.isArray(doc.features)||typeof holeNorm!=='function'||typeof holeAxis!=='function')return out;
  const dot=function(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; };
  const ang=function(a){ let c=a*180/Math.PI; c=((c%360)+360)%360; return Math.round(c*1000)/1000%360; };
  doc.features.forEach(function(f){
    if(!f||f.type!=='hole'||f.visible===false||f.suppressed)return;
    try{
      const sk=(doc.sketches||[]).find(function(q){ return q.id===f.sketchId; }); if(!sk)return;
      const N=holeNorm(f), A=holeAxis(f,sk), d=[A.dir.x,A.dir.y,A.dir.z];
      const dz=dot(d,W), du=dot(d,U), dv=dot(d,V);
      const tip=N.tip>0?N.r/Math.tan(N.tip*Math.PI/360):0;
      const thr=f.thread&&f.thread.size?(typeof holeThreadLabel==='function'?holeThreadLabel(f.thread):f.thread.size):'';
      A.pts.forEach(function(p,i){
        const v=[p.x-Pf[0],p.y-Pf[1],p.z-Pf[2]], z=dot(v,W), ru=dot(v,U), rv=dot(v,V), r=Math.hypot(ru,rv);
        const h={fid:f.id,key:f.id+':'+(p.id||i),d:+(2*N.r).toFixed(3),r:N.r,depth:N.depth,through:!!N.through,tip:tip,kind:N.kind,thr:thr,
          end:N.end,ok:true,why:''};
        if(Math.abs(Math.abs(dz)-1)<1e-3){
          if(r<0.05)return; // dans l'axe : perçage en bout du tour
          h.ax='ax'; h.z=z; h.rr=r; h.c=ang(Math.atan2(rv,ru)); h.fromBack=dz>0;
          if(h.fromBack){ h.ok=false; h.why='percé depuis l’arrière : à faire en reprise'; }
        }else if(Math.abs(dz)<1e-3){
          // radial : la droite du trou passe par l'axe ; C = côté d'où entre le foret (−d)
          const ou=-du/Math.hypot(du,dv), ov=-dv/Math.hypot(du,dv);
          const re=ru*ou+rv*ov, off=Math.abs(ru*ov-rv*ou);
          h.ax='rad'; h.z=z; h.c=ang(Math.atan2(ov,ou)); h.rr=re;
          if(off>0.05){ h.ok=false; h.why='trou décalé de '+(+off.toFixed(2))+' mm de l’axe : demande un axe Y'; }
          if(re<0){ h.ok=false; h.why='perçage vers l’extérieur'; }
        }else{ h.ax='inc'; h.z=z; h.c=0; h.rr=r; h.ok=false; h.why='trou incliné : demande un axe B'; }
        if(h.ok&&N.kind!=='simple')h.note=N.kind==='cbore'?'lamage non fait':N.kind==='csink'?'fraisure non faite':'étage non fait';
        if(h.ok&&(N.end==='next'||N.end==='upto'))h.note=(h.note?h.note+', ':'')+'profondeur prise sur la fiche du trou';
        out.push(h);
      });
    }catch(e){}
  });
  return out;
}
function tourCHolesOf(setup){
  const M=tourModel(setup); if(!M||!M.ok)return [];
  return tourCHolesRaw(M.W,M.U,M.V,M.Pf,M);
}
function tourSectionAngle(H){
  // angle du plan de coupe le plus loin de tous les trous (le plan contient C et C + 180°)
  if(!H||!H.length)return 0;
  const A=H.filter(function(h){ return h.ax==='ax'||h.ax==='rad'; }).map(function(h){ return h.c%180; });
  if(!A.length)return 0;
  const dist=function(p){ let m=1/0; A.forEach(function(a){ let e=Math.abs(p-a)%180; e=Math.min(e,180-e); if(e<m)m=e; }); return m; };
  if(dist(0)>=20)return 0;
  let best=0, bd=-1;
  for(let p=0;p<180;p++){ const e=dist(p); if(e>bd+1e-9){ bd=e; best=p; } }
  return best;
}
function tourLiveDrillFor(s,dir,d){
  // foret motorisé de ce sens au Ø du trou : celui de la liste, sinon un inutilisé mis à ce Ø, sinon un ajouté
  const T=s.tools||(s.tools=[]), k=dir==='ax'?'ldrilla':'ldrillr';
  const ok=T.filter(function(t){ return tourToolMatch(t,k)&&Math.abs(+t.d-d)<0.01; })[0];
  if(ok)return ok;
  const used=function(t){ return (s.ops||[]).some(function(o){ return o&&o.toolId===t.id; }); };
  let t=T.filter(function(t){ return tourToolMatch(t,k)&&!used(t); })[0];
  if(!t){ t=tourToolNew(k,s); T.push(t); }
  t.d=+(+d).toFixed(3); t.name='Foret motorisé '+(dir==='ax'?'axial':'radial')+' Ø'+(+t.d.toFixed(2));
  return t;
}
