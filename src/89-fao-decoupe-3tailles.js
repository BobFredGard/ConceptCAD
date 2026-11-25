/* ================================================================
   DÉCOUPE À LA FRAISE 3 TAILLES (V0.99.86)
   ----------------------------------------------------------------
   Demandes de Fred : « pouvoir définir une droite comme contour et définir les zones
   d'entrée et de sortie au choix, au moins le rayon de fraise + 10 par défaut. L'idée
   est d'entrer à un endroit, tirer tout droit et sortir tout droit. Entrée et sortie
   droite, pas de cercle d'entrée », « ou un sens X par exemple et prendre en compte la
   pièce à couper. On définit le plan de coupe + une valeur de décalage et l'outil y
   vient tout seul », « peut-être une opération découpe 3 tailles ».
   Opération 'slotcut' (fraise 3 tailles seulement) :
   - trajet SELON X ou SELON Y : la pièce est coupée à la hauteur de la rainure (Bas =
     plan de coupe, référence + décalage dans l'onglet Hauteurs) ; la face la plus
     avancée du côté choisi (Y− / Y+ / les deux, ou X− / X+) est trouvée toute seule,
     le disque y entre de la « profondeur » (décalage) et parcourt toute la longueur de
     la pièce ;
   - trajet LE LONG D'UNE ARÊTE : une arête droite (ou une suite d'arêtes ouverte)
     cliquée sur le modèle ; côté de la matière trouvé par une coupe de la pièce ;
   - entrée et sortie DROITES dans le prolongement de la passe : le centre du disque
     part à « entrée » mm avant le bout (défaut : rayon + 10, soit 10 mm de jour) et
     finit à « sortie » mm après ; descente et remontée dehors seulement ;
   - passes en hauteur (au plus l'épaisseur du disque), passes latérales, finition,
     sens avalant / opposition, matière à laisser : comme le contour 3 tailles ;
   - alertes : pas de pièce à cette hauteur, disque pas dégagé à l'entrée ou à la sortie
     (zone trop courte, brut pas encore enlevé), col qui frotte, disque plus épais que
     la rainure.
   ================================================================ */
function faoSlotCut(op){ return !!(op&&op.type==='slotcut'); }
function faoSlotCutDir(op){ return op&&(op.cutDir==='Y'||op.cutDir==='edge')?op.cutDir:'X'; }
function faoSlotCutSide(op){ return op&&(op.cutSide==='+'||op.cutSide==='both')?op.cutSide:'-'; }
function faoSlotCutGeom(op,tool){
  // Réglages vus par la fiche et le calcul (mêmes défauts des deux côtés).
  const g=faoToolDims(tool),ep=g.lc.v,R=g.D/2,dir=faoSlotCutDir(op);
  const pmax=Math.max(0,(g.D-g.dDeg.v)/2);
  const h=(isFinite(+op.slotH)&&+op.slotH>0)?+op.slotH:ep;
  // profondeur depuis la face : défaut 5 mm (au plus ce que le col permet) ; le long
  // d'une arête : 0 = le disque vient jusqu'à l'arête (comme le contour)
  const dr=isFinite(+op.slotDr)?+op.slotDr:(dir==='edge'?0:faoR1(Math.min(5,pmax)));
  const zd=faoR1(R+10);
  const lin=isFinite(+op.slotLin)&&+op.slotLin>=0?+op.slotLin:zd;
  const lout=isFinite(+op.slotLout)&&+op.slotLout>=0?+op.slotLout:zd;
  // V0.99.93 : « à travers » (tronçonner) — le plan de coupe est le DESSUS du disque, la découpe
  // descend de sa hauteur sous ce plan et traverse toute la matière (pièce et brut)
  const thru=op.slotThru===true&&dir!=='edge';
  const z0=thru?+op.zbot-h:+op.zbot;
  return {D:g.D,R:R,ep:ep,col:g.dDeg.v,h:h,dr:dr,z0:z0,z1:z0+h,pmax:pmax,lin:lin,lout:lout,zDef:zd,
    dir:dir,side:faoSlotCutSide(op),thru:thru};
}
function faoSlotCutWalls(mesh,o){
  // Faces de la pièce que le disque vient tailler. Selon X / Y : section de la pièce dans
  // la tranche de la rainure (plusieurs hauteurs) → étendue et face la plus avancée du
  // côté choisi ; sans maillage, la boîte du brut. Paroi = {W:[A,B], s} : s = +1 si le
  // côté libre est à GAUCHE de A→B.
  const z0=+o.z0,z1=+o.z1,out={walls:[],box:null};
  if(!isFinite(z0)||!isFinite(z1))return out;
  let x0=1/0,x1=-1/0,y0=1/0,y1=-1/0;
  const add=function(x,y){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; };
  if(mesh&&mesh.t&&mesh.t.length){
    const H=z1-z0,n=H>0.1?Math.max(2,Math.min(12,Math.ceil(H)+1)):1;
    for(let i=0;i<n;i++){
      const z=n===1?(z0+z1)/2:z0+0.02+(H-0.04)*i/(n-1);
      const segs=faoSliceZCached(mesh,Math.round(z*1000)/1000)||[];
      for(let k=0;k<segs.length;k++){ add(segs[k][0],segs[k][1]); add(segs[k][2],segs[k][3]); }
    }
  }
  const s=o.stock;
  if(!(x1>=x0)&&!mesh&&s&&faoStockValid(s)&&z1>+s.z0&&z0<+s.z1){ x0=+s.x0; x1=+s.x1; y0=+s.y0; y1=+s.y1; }
  // V0.99.93 : à travers, la matière à couper est aussi le brut (sous la pièce, il est seul)
  if(o.thru&&s&&faoStockValid(s)&&z1>+s.z0&&z0<+s.z1){ add(+s.x0,+s.y0); add(+s.x1,+s.y1); }
  if(!(x1>=x0&&y1>=y0))return out;
  const r3=function(v){return Math.round(v*1000)/1000;};
  out.box={x0:r3(x0),x1:r3(x1),y0:r3(y0),y1:r3(y1)};
  (o.side==='both'?['-','+']:[o.side==='+'?'+':'-']).forEach(function(sd){
    if(o.dir==='Y'){
      const xw=sd==='-'?x0:x1;
      // A→B selon +Y : gauche = −X
      out.walls.push({W:[[xw,y0],[xw,y1]],s:sd==='-'?1:-1,side:sd==='-'?'X−':'X+',at:r3(xw),from:r3(y0),to:r3(y1),wid:x1-x0});
    }else{
      const yw=sd==='-'?y0:y1;
      // A→B selon +X : gauche = +Y
      out.walls.push({W:[[x0,yw],[x1,yw]],s:sd==='-'?-1:1,side:sd==='-'?'Y−':'Y+',at:r3(yw),from:r3(x0),to:r3(x1),wid:y1-y0});
    }
  });
  return out;
}
function faoSlotCutEdgeWall(mesh,L,z0,z1){
  // Le long d'arêtes cliquées : polyligne OUVERTE (la chaîne refermée d'office perd son
  // dernier point) ; côté libre = celui où la coupe de la pièce trouve le moins de matière.
  if(!L||!Array.isArray(L.loop)||L.loop.length<2)return null;
  let W=L.loop.map(function(p){return [+p[0],+p[1]];});
  if(!L.closed&&W.length>=3){const a=W[0],b=W[W.length-1];if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6)W.pop();}
  W=W.filter(function(p,i){return !i||Math.hypot(p[0]-W[i-1][0],p[1]-W[i-1][1])>1e-6;});
  if(W.length<2)return null;
  let s=1;
  if(mesh&&mesh.t&&mesh.t.length){
    const zm=(z0+z1)/2,segs=faoSliceZCached(mesh,Math.round(zm*1000)/1000)||[];
    let left=0,right=0;
    for(let i=0;i+1<W.length;i++){
      const A=W[i],B=W[i+1],dx=B[0]-A[0],dy=B[1]-A[1],l=Math.hypot(dx,dy);
      if(!(l>1e-6))continue;
      const nx=-dy/l,ny=dx/l;
      for(let k=1;k<=3;k++){const u=k/4,mx=A[0]+dx*u,my=A[1]+dy*u,e=0.3;
        if(faoSliceHit(segs,mx+nx*e,my+ny*e,0))left++;
        if(faoSliceHit(segs,mx-nx*e,my-ny*e,0))right++;}
    }
    s=left>right?-1:1; // matière à gauche → libre à droite
  }
  const r3=function(v){return Math.round(v*1000)/1000;};
  return {W:W,s:s,side:'arête',at:null,from:null,to:null,len:r3(W.reduce(function(a,p,i){return i?a+Math.hypot(p[0]-W[i-1][0],p[1]-W[i-1][1]):0;},0))};
}
function faoSlotCutOffset(W,d,s){
  // Polyligne ouverte décalée de d du côté s (+1 = gauche), angles en onglet bornés.
  const n=W.length,N=[];
  for(let i=0;i+1<n;i++){const dx=W[i+1][0]-W[i][0],dy=W[i+1][1]-W[i][1],l=Math.hypot(dx,dy)||1;N.push([-dy/l*s,dx/l*s]);}
  const out=[];
  for(let i=0;i<n;i++){
    let m;
    if(i===0)m=N[0]; else if(i===n-1)m=N[n-2];
    else{const a=N[i-1],b=N[i],sx=a[0]+b[0],sy=a[1]+b[1],sl=Math.hypot(sx,sy);
      if(sl<1e-9)m=a; else{const ux=sx/sl,uy=sy/sl,c=Math.max(0.25,ux*a[0]+uy*a[1]);m=[ux/c,uy/c];}}
    out.push([W[i][0]+m[0]*d,W[i][1]+m[1]*d]);
  }
  return out;
}
function faoSlotNeckCheck(moves,neckTop,ep,diag){
  // Col : rien ne doit dépasser au-dessus du disque sous le col pendant la coupe.
  let worst=0,n=0;
  for(let i=1;i<moves.length;i++){
    const a=moves[i-1],b=moves[i];if(b.r||Math.abs(a.z-b.z)>1e-9)continue;
    const L=Math.hypot(b.x-a.x,b.y-a.y),ns=Math.max(1,Math.ceil(L/1));
    for(let k=1;k<=ns;k++){const t=k/ns,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
      const over=neckTop(x,y)-(b.z+ep);
      if(over>0.05){n++;if(over>worst)worst=over;}}
  }
  diag.neck=Math.round(worst*1000)/1000;diag.neckN=n;
}
function faoGenSlotCut(mesh,o){
  // o : toolD, ep, rn, secu, zbot, slotH, dr (profondeur), lin, lout, dir ('X'|'Y'|'edge'),
  //     side ('-'|'+'|'both'), limit (arête), ap, nR, ae, fin, radial, axial, sens, stock,
  //     clear(x,y,z), neckTop(x,y)
  o=o||{};
  const moves=[];
  const diag={slot:1,cut:1,dir:o.dir||'X',walls:[],levels:0,passes:0,noEntry:0,neck:0,neckN:0,thick:0,over:0,noPart:0,trav:0,zb:null,zt:null};
  const thru=!!o.thru&&o.dir!=='edge'; // V0.99.93 : à travers (plan de coupe = dessus du disque)
  if(thru){diag.thru=1;diag.thruW=0;}
  try{moves.diag=diag;}catch(e){}
  const D=isFinite(+o.toolD)&&+o.toolD>0?+o.toolD:10,r=D/2;
  const ep=isFinite(+o.ep)&&+o.ep>0?+o.ep:Math.max(1,D*0.12);
  const rn=isFinite(+o.rn)&&+o.rn>0?Math.min(+o.rn,r):0;
  const RA=faoRA(o);
  const secu=isFinite(+o.secu)?+o.secu:5;
  const zbot=+o.zbot;
  if(!isFinite(zbot))return moves;
  const r3=function(v){return Math.round(v*1000)/1000;};
  const hS=isFinite(+o.slotH)&&+o.slotH>0?+o.slotH:ep;
  const zb0=thru?zbot-hS:zbot; // dessous de la découpe
  const zb=zb0+RA.axial,zt=zb0+hS-RA.axial;
  diag.zb=r3(zb0);diag.zt=r3(zb0+hS);
  if(zt-zb<ep-1e-6)diag.thick=r3(ep-Math.max(0,zt-zb));
  // --- parois à tailler
  let walls=[];
  if(o.dir==='edge'){const w=faoSlotCutEdgeWall(mesh,o.limit,zb0,zb0+hS);if(w)walls=[w];}
  else walls=faoSlotCutWalls(mesh,{z0:zb0,z1:zb0+hS,dir:o.dir==='Y'?'Y':'X',side:o.side,stock:o.stock,thru:thru}).walls;
  diag.walls=walls.map(function(w){return {side:w.side,at:w.at,from:w.from,to:w.to};});
  if(!walls.length){diag.noPart=1;return moves;}
  // --- passes : distance du centre du disque à la face (rayon + surépaisseur − profondeur)
  const dr=isFinite(+o.dr)?+o.dr:0;
  const fin=isFinite(+o.fin)&&+o.fin>0?+o.fin:0;
  const nR=Math.max(1,Math.min(20,Math.round(isFinite(+o.nR)?+o.nR:1)));
  const aeR=isFinite(+o.ae)&&+o.ae>0?+o.ae:Math.max(0.2,D*0.1);
  const offsFor=function(w){
    // à travers : toute la largeur de matière + 1 mm de sortie (des deux côtés : la moitié + 1,
    // soit 2 mm de recouvrement au milieu), sans surépaisseur de paroi
    let drW=dr,rad=RA.radial;
    if(thru){const W=isFinite(w.wid)?w.wid:0;if(W>diag.thruW)diag.thruW=r3(W);drW=(o.side==='both'?W/2:W)+1;rad=0;}
    let dFin=r+rad-drW;
    if(dFin<0.05){diag.over=1;dFin=0.05;}
    const offs=[];for(let k=nR-1;k>=0;k--)offs.push(dFin+fin+k*aeR);
    if(fin>0)offs.push(dFin);
    return offs;
  };
  const climb=o.sens!=='opp';
  const zd=r+10;
  const lin=isFinite(+o.lin)&&+o.lin>=0?+o.lin:zd,lout=isFinite(+o.lout)&&+o.lout>=0?+o.lout:zd;
  // --- niveaux du disque (dessous), de haut en bas, au plus l'épaisseur
  const step=Math.max(0.05,Math.min(ep,isFinite(+o.ap)&&+o.ap>0?+o.ap:ep));
  const levels=[];
  {const zTop=zt-ep;
    if(zTop<=zb+1e-6)levels.push(zb);
    else{let z=zTop;while(z>zb+1e-6){levels.push(Math.round(z*10000)/10000);z-=step;}
      if(levels.length&&levels[levels.length-1]-zb<0.01)levels.pop();
      levels.push(zb);}}
  diag.levels=levels.length;
  const clear=typeof o.clear==='function'?o.clear:null;
  // V0.99.91 : le brut est de la matière à couper (« le brut en compte aussi ! ») — le disque le
  // traverse tout droit ; les zones d'entrée / sortie se comptent depuis le bord de la matière
  // traversée d'un seul tenant (pièce, brut, brut restant), src/89-fao-contour-3tailles.js
  const gdC=Math.max(0.5,r*0.05),stS=Math.max(0.25,Math.min(2,r/8));
  let LmaxS=Math.max(6*D,150);
  {const s=o.stock;if(s&&[s.x0,s.x1,s.y0,s.y1].every(function(v){return isFinite(+v);}))LmaxS=Math.max(LmaxS,Math.hypot(+s.x1-+s.x0,+s.y1-+s.y0)+2*r);}
  const farPt=function(P,u,L0,z){
    const e=faoSlotMatEdge(clear,P,u,z,r+gdC,stS,LmaxS,o.part)||0;
    if(e>0.05&&e>diag.trav)diag.trav=Math.round(e*10)/10;
    return [P[0]+u[0]*(L0+e),P[1]+u[1]*(L0+e)];
  };
  const rnd=function(v){return Math.round(v*10000)/10000;};
  let cur=null;
  const push=function(m){m.x=rnd(m.x);m.y=rnd(m.y);m.z=rnd(m.z);
    if(cur&&cur.r===m.r&&!!cur.ent===!!m.ent&&cur.x===m.x&&cur.y===m.y&&cur.z===m.z)return;
    moves.push(m);cur=m;};
  const unit=function(a,b){const l=Math.hypot(b[0]-a[0],b[1]-a[1]);return l>1e-12?[(b[0]-a[0])/l,(b[1]-a[1])/l]:[1,0];};
  walls.forEach(function(w){
    // sens de marche : avalant = matière à droite de l'avance, donc côté libre à gauche
    const fwd=(w.s>0)===climb,offs=offsFor(w);
    // niveau par niveau (de haut en bas), de la passe la moins profonde à la plus profonde
    levels.forEach(function(z){
      offs.forEach(function(d){
        let P=faoSlotCutOffset(w.W,d,w.s);
        if(!fwd)P=P.slice().reverse();
        const t0=unit(P[0],P[1]),tn=unit(P[P.length-2],P[P.length-1]);
        const A=farPt(P[0],[-t0[0],-t0[1]],lin,z),B=farPt(P[P.length-1],tn,lout,z);
        if(clear&&(!clear(A[0],A[1],z)||!clear(B[0],B[1],z)))diag.noEntry++;
        // descente dehors : au-dessus de A, puis en avance le dernier millimètre
        if(!cur)push({r:1,x:A[0],y:A[1],z:secu});
        else if(Math.hypot(cur.x-A[0],cur.y-A[1])>1e-6){
          if(cur.z<secu-1e-9)push({r:1,x:cur.x,y:cur.y,z:secu});
          push({r:1,x:A[0],y:A[1],z:secu});
        }
        if(cur.z>z+1+1e-9)push({r:1,x:A[0],y:A[1],z:z+1});
        push({r:0,ent:1,x:A[0],y:A[1],z:z});
        // entrée droite, passe, sortie droite
        push({r:0,ent:1,x:P[0][0],y:P[0][1],z:z});
        for(let k=1;k<P.length;k++)push({r:0,ent:0,x:P[k][0],y:P[k][1],z:z});
        push({r:0,ent:1,x:B[0],y:B[1],z:z});
        diag.passes++;
      });
    });
  });
  if(cur)push({r:1,x:cur.x,y:cur.y,z:secu});
  if(typeof o.neckTop==='function'&&rn>0)faoSlotNeckCheck(moves,o.neckTop,ep,diag);
  return moves;
}
function faoSlotCutMoves(op,job,base){
  // Aiguillage (src/88-fao-50-caches-dispatch.js) : maillage, obstacles, réglages.
  const tool=faoToolById(job,op.toolId);
  if(!faoToolIsSlot(tool)){ op.geoDiag={slot:1,cut:1,notSlot:1}; return []; }
  let am=null;try{ am=faoActiveMesh(job,'mid'); }catch(e){ am=null; }
  const ms=am&&am.mesh,G=faoSlotCutGeom(op,tool);
  let ob=null;try{ ob=faoSlotObstacles(op,job,ms,G.R,G.col/2); }catch(e){ ob=null; }
  const RA=faoRA(op);
  const mv=faoGenSlotCut(ms,Object.assign({},base,{
    toolD:G.D,ep:G.ep,rn:G.col/2,zbot:+op.zbot,slotH:op.slotH,dr:G.dr,lin:G.lin,lout:G.lout,
    dir:G.dir,side:G.side,limit:op.limit,ap:op.ap,nR:op.nR,ae:op.ae,fin:op.fin,
    radial:RA.radial,axial:RA.axial,sens:op.sens==='opp'?'opp':'climb',stock:job&&job.stock,thru:G.thru,
    clear:ob?ob.clear:null,neckTop:ob?ob.neckTop:null,part:ob?ob.part:null}));
  try{ if(mv&&mv.diag)op.geoDiag=mv.diag; }catch(e){}
  return mv;
}
function faoSlotCutLabel(op,job){
  const t=faoToolById(job,op.toolId),G=faoSlotCutGeom(op,t),f=function(z){return +(+z).toFixed(3);};
  const tr=G.dir==='edge'?((op.limit&&op.limit.nEdges)?'le long de '+op.limit.nEdges+' arête(s)':'(arête à sélectionner)')
    :'selon '+G.dir+' '+(G.side==='both'?'des deux côtés':'côté '+(G.dir==='Y'?'X':'Y')+(G.side==='+'?'+':'−'));
  return 'Découpe 3 tailles '+tr+' Z '+f(G.z0)+' -> '+f(G.z1)+(G.thru?' à travers':' prof. '+f(G.dr));
}
// Fiche de l'opération (src/88-fao-80-interface.js)
function faoSlotCutRows(d,setup,op){
  const t=faoToolById(setup,op.toolId),isSlot=faoToolIsSlot(t);
  d.appendChild(faoH('Zone de découpe'));
  if(!isSlot){
    const a=document.createElement('div');a.className='fao-alert';
    a.textContent='⚠ Choisissez une fraise 3 tailles dans l’onglet Outil (Outils → type « Fraise 3 tailles ») : cette opération ne sert qu’avec elle.';
    d.appendChild(a);
  }
  const G=isSlot?faoSlotCutGeom(op,t):null;
  const dir=faoSlotCutDir(op);
  const r1=faoRow();
  r1.appendChild(faoLab('Trajet'));
  r1.appendChild(faoSel([
    ['X','Selon X','Le disque avance selon X et vient tout seul sur la face de la pièce du côté choisi.'],
    ['Y','Selon Y','Le disque avance selon Y et vient tout seul sur la face de la pièce du côté choisi.'],
    ['edge','Le long d’une arête','Une arête droite (ou une suite d’arêtes) cliquée sur le modèle : le disque la suit, la matière est du côté où la pièce se trouve.']],
    dir,function(v){ if(v==='Y'||v==='edge')op.cutDir=v; else delete op.cutDir;
      if(v!=='edge'){ delete op.limit; } else if(!op.limit||op.limit.mode!=='chain')op.limit={mode:'chain',loop:[],closed:false,nEdges:0,tangent:false,side:'center',extra:0}; },
    'Direction de la découpe.'));
  if(dir!=='edge'){
    const o=dir==='Y'?'X':'Y';
    r1.appendChild(faoLab('Côté'));
    r1.appendChild(faoSel([
      ['-',o+'−','Face de la pièce du côté '+o+' négatif.'],
      ['+',o+'+','Face de la pièce du côté '+o+' positif.'],
      ['both','Les deux','Une découpe de chaque côté : la première finie, puis la seconde.']],
      faoSlotCutSide(op),function(v){ if(v==='+'||v==='both')op.cutSide=v; else delete op.cutSide; },
      'Face de la pièce attaquée par le disque.'));
  }
  d.appendChild(r1);
  if(dir==='edge'){
    const L=op.limit&&op.limit.mode==='chain'?op.limit:null;
    const rc=faoRow();
    const info=document.createElement('span');info.className='fao-meta';
    const has=L&&(L.loop||[]).length>=2;
    info.textContent=has?(L.nEdges||'?')+' arête(s)':'aucune arête — cliquez l’arête à suivre';
    rc.appendChild(info);
    const bs=document.createElement('button');bs.textContent=has?'Re-sélectionner':'Sélectionner';bs.style.fontSize='.72rem';
    bs.onclick=function(){
      if(!op.limit||op.limit.mode!=='chain')op.limit={mode:'chain',loop:[],closed:false,nEdges:0,tangent:false,side:'center',extra:0};
      faoChainStart(setup.id,op.id);
    };
    rc.appendChild(bs);
    d.appendChild(rc);
    if(L&&L.stale){const ws=document.createElement('div');ws.className='fao-alert';
      ws.textContent='⚠ Modèle modifié : arête non retrouvée — trajet inchangé (obsolète), re-sélectionnez l’arête.';d.appendChild(ws);}
  }
  if(G){
    const r2=faoRow();
    r2.appendChild(faoLab(dir==='edge'?'décalage dans la paroi':'profondeur'));
    if(dir!=='edge')r2.appendChild(faoSel([ // V0.99.93 : tronçonner
      ['val','valeur','Le disque entre dans la face de la pièce de la profondeur donnée ; le plan de coupe est le dessous du disque.'],
      ['thru','à travers','Tronçonner : le disque traverse toute la matière (pièce et brut) et ressort de l’autre côté ; le plan de coupe est le dessus du disque (la face qui reste sous la pièce).']],
      G.thru?'thru':'val',function(v){ if(v==='thru')op.slotThru=true; else delete op.slotThru; },
      'Profondeur donnée, ou à travers (tronçonner).'));
    if(!G.thru)r2.appendChild(faoNumFx(op,'slotDr',G.dr,function(v){op.slotDr=v;},48,0.5,
      dir==='edge'?'Décale la fraise par rapport à l’arête : + = elle entre plus loin dans la matière, − = elle reste en retrait (0 = jusqu’à l’arête).'
        :'Profondeur de la découpe depuis la face la plus avancée de la pièce (mm) : le disque vient tout seul sur la face, puis entre de cette valeur. Au plus '+(+G.pmax.toFixed(2))+' mm avant que le col frotte.'));
    r2.appendChild(faoLab('hauteur'));
    r2.appendChild(faoNumFx(op,'slotH',G.h,function(v){op.slotH=Math.max(0.05,v);},48,0.1,
      (G.thru?'Hauteur de la découpe sous le plan de coupe':'Hauteur de la découpe au-dessus du plan de coupe')+' (défaut : l’épaisseur du disque, '+G.ep+' mm = une seule passe).'));
    d.appendChild(r2);
    const inf=document.createElement('div');inf.className='fao-meta';
    const gd=op.geoDiag||{};
    const nZ=G.h>G.ep+1e-6?Math.ceil((G.h-G.ep)/Math.max(0.05,Math.min(G.ep,+op.ap>0?+op.ap:G.ep))-1e-6)+1:1;
    let s=(isFinite(G.z0)?'Découpe de Z '+(+G.z0.toFixed(3))+' à Z '+(+G.z1.toFixed(3))+(G.thru?' (plan de coupe = dessus du disque, onglet Hauteurs) · ':' (plan de coupe : Bas, onglet Hauteurs) · '):'')+
      nZ+' passe(s) en hauteur · disque Ø'+G.D+' × '+G.ep+' · col Ø'+G.col+' : '+(+G.pmax.toFixed(2))+' mm de profondeur au plus';
    if(gd.cut&&(gd.walls||[]).length&&!op.stale)s+=' · '+gd.walls.map(function(w){
      return w.at!==null&&w.at!==undefined?('face '+w.side+' à '+(dir==='Y'?'X ':'Y ')+w.at+', de '+(dir==='Y'?'Y ':'X ')+w.from+' à '+w.to):'arête';}).join(' ; ');
    if(gd.cut&&gd.trav>0&&!op.stale)s+=' · traverse jusqu’à '+gd.trav+' mm de brut avant la pièce'; // V0.99.91
    if(G.thru&&gd.cut&&gd.thruW>0&&!op.stale)s+=' · à travers : '+gd.thruW+' mm de matière (+ 1 mm de sortie)'; // V0.99.93
    inf.textContent=s;
    d.appendChild(inf);
    const warn=function(x){const a=document.createElement('div');a.className='fao-alert';a.textContent='⚠ '+x;d.appendChild(a);};
    if(gd.cut&&!op.stale){
      if(gd.noPart)warn(dir==='edge'?'Aucune arête : cliquez l’arête à suivre.':G.thru?'Ni pièce ni brut sous le plan de coupe : vérifiez le plan de coupe dans l’onglet Hauteurs.'
        :'Aucune pièce à la hauteur de la découpe : vérifiez le plan de coupe (Bas) dans l’onglet Hauteurs. Pour couper sous la pièce (tronçonner) : profondeur « à travers ».');
      if(gd.noEntry)warn(gd.noEntry+' passe(s) où le disque descend ou remonte dans la matière : quelque chose gêne là où il descend (autre partie de la pièce, bridage…) : changez la longueur de la zone d’entrée ou de sortie (onglet Entrées).');
      if(gd.neck>0)warn('Le col (Ø'+G.col+') frotte la matière au-dessus de la découpe (jusqu’à '+gd.neck+' mm) : profondeur trop grande pour cette fraise (maxi '+(+G.pmax.toFixed(2))+' mm), ou trop de brut à traverser devant la pièce.');
      if(gd.thick>0)warn('Disque plus épais que la découpe : il taille '+gd.thick+' mm plus haut que demandé.');
      if(gd.over)warn(G.thru?'Matière trop large pour la traverser d’un seul côté avec ce disque (au plus son rayon, '+G.R+' mm) : coupez des deux côtés (Côté : Les deux) ou prenez un plus grand disque.'
        :'Profondeur plus grande que le rayon du disque : la fraise est ramenée sur la face.');
    }
    if(!(G.dr>0)&&dir!=='edge'&&!G.thru)warn('Profondeur 0 : le disque touche la pièce sans la tailler.');
  }
  d.appendChild(faoH('Passes (mm)'));
  const rP=faoRow();
  const ep=G?G.ep:3;
  rP.appendChild(faoLab('pas Z')); rP.appendChild(faoNumFx(op,'ap',Math.min(+op.ap>0?+op.ap:ep,ep),function(v){op.ap=Math.max(0.05,v);},48,0.1,
    'Pas entre deux passes en hauteur, au plus l’épaisseur du disque ('+ep+' mm) : les passes vont du haut de la découpe vers le plan de coupe.'));
  rP.appendChild(faoLab('passes')); rP.appendChild(faoNumFx(op,'nR',isFinite(+op.nR)?+op.nR:1,function(v){op.nR=Math.max(1,Math.min(20,Math.round(v)));},36,1,
    'Passes latérales : de la moins profonde à la plus profonde, écartées de ae.'));
  rP.appendChild(faoLab('ae')); rP.appendChild(faoNumFx(op,'ae',isFinite(+op.ae)?+op.ae:+(Math.max(0.2,(G?G.D:10)*0.1)).toFixed(2),function(v){op.ae=Math.max(0.05,v);},48,0.1,'Écart entre deux passes latérales.'));
  rP.appendChild(faoLab('finition')); rP.appendChild(faoNumFx(op,'fin',isFinite(+op.fin)?+op.fin:0,function(v){op.fin=Math.max(0,v);},44,0.05,
    'Épaisseur laissée par les passes puis enlevée par une passe de finition à la profondeur finale (0 = pas de passe séparée).'));
  d.appendChild(rP);
  d.appendChild(faoH('Côté et sens'));
  const rS=faoRow();
  rS.appendChild(faoLab('Sens'));
  rS.appendChild(faoSel([
    ['avalant','Avalant','Matière à droite de l’avance (broche M3) : meilleur état de surface.'],
    ['opp','Opposition','Matière à gauche de l’avance.']],
    op.sens==='opp'?'opp':'avalant',function(v){op.sens=(v==='opp')?'opp':'avalant';},'Sens de coupe : il fixe le bout par lequel le disque entre.'));
  d.appendChild(rS);
  d.appendChild(faoH('Entrée / sortie'));
  const rE=faoRow();
  const zd=G?G.zDef:15;
  rE.appendChild(faoLab('zone d’entrée')); rE.appendChild(faoNumFx(op,'slotLin',G?G.lin:zd,function(v){op.slotLin=Math.max(0,v);},48,1,
    'Distance entre le bord de la matière (la pièce, ou le brut qui dépasse) et le centre du disque à son départ (mm) : il descend là, puis entre tout droit en coupant le brut. Défaut : rayon + 10 = '+zd+' mm (10 mm de jour).'));
  rE.appendChild(faoLab('zone de sortie')); rE.appendChild(faoNumFx(op,'slotLout',G?G.lout:zd,function(v){op.slotLout=Math.max(0,v);},48,1,
    'Distance entre le bord de la matière (la pièce, ou le brut qui dépasse) et le centre du disque à l’arrivée (mm) : il sort tout droit jusque-là, puis remonte. Défaut : rayon + 10 = '+zd+' mm.'));
  d.appendChild(rE);
  d.appendChild(faoHelp('Entrée et sortie droites, dans le prolongement de la passe : pas d’arc. Le disque descend et remonte seulement dehors, hors du brut : il traverse le brut qui dépasse de la pièce (matière à couper).'));
  d.appendChild(faoH('Matière à laisser (mm)'));
  const rR=faoRow();
  rR.appendChild(faoLab('Parois')); rR.appendChild(faoNumFx(op,'radial',faoRA(op).radial,function(v){op.radial=Math.max(0,v);},44,0.1,'Surépaisseur laissée au fond de la découpe (0 = à la cote).'));
  rR.appendChild(faoLab('Fond')); rR.appendChild(faoNumFx(op,'axial',faoRA(op).axial,function(v){op.axial=Math.max(0,v);},44,0.1,'Surépaisseur laissée sur le dessus et le dessous de la découpe.'));
  d.appendChild(rR);
}
