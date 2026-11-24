// V0.95.3 — FAO : RÉPÉTITION d'opérations (comme le « Motif » de Fusion 360).
// Une opération { type:'pattern' } du posage reprend des opérations SOURCES
// (op.srcs = ids) et rejoue leurs parcours :
//   · kind 'rect'   : nx × ny copies décalées de dx / dy (mm) ;
//   · kind 'circ'   : n copies tournées autour de (cx,cy), angle total ang (°) ;
//   · kind 'mirror' : original + copie miroir par rapport à X=at ou Y=at ;
//   · kind 'wcs'    : mêmes parcours rejoués dans d'autres origines (G55, G56…).
// Ordre d'usinage PAR OPÉRATION : chaque source est faite sur toutes ses copies
// (original compris) avant la suivante — moins de changements d'outil.
// Les sources ne sont plus usinées à leur place : la répétition les émet à SA
// place dans la liste. Répétition désactivée (○) = sources usinées une fois.
// Les parcours des copies ne sont JAMAIS recalculés : transformation des moves
// de la source (cache inchangé, CACHE_VER inchangé). Source unique : faoOpsSeq,
// lue par faoJobMoves et faoSeqSafe (aperçu, simulation, collisions, G-code).
// V0.99.73 (Fred : « Il faut pouvoir répéter une répétition ») : une répétition
// peut être la source d'une autre. Ses copies sont refaites sur chaque copie de
// la répétition qui la contient (copies composées, faoXfCompose), toujours par
// opération, émises à la place de la répétition la plus haute. Une répétition
// imbriquée désactivée (○) est transparente : ses sources ne sont copiées que par
// celle qui la contient. Jamais de boucle (A dans B dans A, faoPatternSanitise).
const FAO_PAT_KINDS=[['rect','Rectangulaire'],['circ','Circulaire'],['mirror','Symétrie'],['wcs','Autres origines']];
const FAO_WCS_ALL=['G54','G55','G56','G57','G58','G59'];
const FAO_PAT_MAX=10000; // copies d'UNE opération, répétitions imbriquées comprises (100 × 100 d'avant)
function faoIsPattern(op){ return !!(op&&op.type==='pattern'); }
function faoPatternDefaults(setup){
  const s=(setup&&setup.stock)||faoStock();
  const cx=(+s.x0+ +s.x1)/2, cy=(+s.y0+ +s.y1)/2;
  const tool=(setup&&setup.tools&&setup.tools[0])||{id:'T1'};
  return {id:faoNewId('op'),on:true,type:'pattern',toolId:tool.id,kind:'rect',srcs:[],
    nx:2,dx:+(Math.abs(+s.x1- +s.x0)||100).toFixed(2),ny:1,dy:+(Math.abs(+s.y1- +s.y0)||80).toFixed(2),
    n:4,ang:360,cx:+cx.toFixed(3),cy:+cy.toFixed(3),axis:'x',at:+cx.toFixed(3),
    wcs:[(setup&&setup.wcs)==='G55'?'G56':'G55']};
}
function faoPatternGeo(op){ return !!op&&op.kind!=='wcs'; }
function faoPatternSanitise(s){
  // Relu à chaque faoRoot : sources = opérations (ou répétitions, V0.99.73) du
  // MÊME posage, une opération n'appartient qu'à UNE répétition (la première),
  // jamais de boucle, nombres bornés.
  if(!s||!Array.isArray(s.ops))return;
  const ids={}, taken={};
  s.ops.forEach(function(o){ if(o&&o.id)ids[o.id]=o; });
  s.ops.forEach(function(op){
    if(!faoIsPattern(op))return;
    if(['rect','circ','mirror','wcs'].indexOf(op.kind)<0)op.kind='rect';
    const src=Array.isArray(op.srcs)?op.srcs:[];
    op.srcs=src.filter(function(id,i){ return typeof id==='string'&&ids[id]&&id!==op.id&&src.indexOf(id)===i&&!taken[id]; });
    op.srcs.forEach(function(id){ taken[id]=op; });
    const int=function(v,a,b,d){ v=Math.round(+v); return isFinite(v)?Math.max(a,Math.min(b,v)):d; };
    const num=function(v,d){ v=+v; return isFinite(v)?v:d; };
    op.nx=int(op.nx,1,100,2); op.ny=int(op.ny,1,100,1); op.n=int(op.n,1,360,4);
    op.dx=num(op.dx,100); op.dy=num(op.dy,80); op.ang=num(op.ang,360);
    op.cx=num(op.cx,0); op.cy=num(op.cy,0); op.at=num(op.at,0);
    if(op.axis!=='y')op.axis='x';
    const w=Array.isArray(op.wcs)?op.wcs:[];
    op.wcs=w.filter(function(c,i){ return FAO_WCS_ALL.indexOf(c)>=0&&c!==(s.wcs||'G54')&&w.indexOf(c)===i; });
    // champs d'opération d'usinage sans objet ici
    ['radial','axial','limit','limit2','zlim','planes','entry','sens'].forEach(function(k){ delete op[k]; });
  });
  // V0.99.73 : boucle (A dans B dans A) — la répétition qui ferme la boucle quitte la sienne
  s.ops.forEach(function(P){
    if(!faoIsPattern(P)||!taken[P.id])return;
    let q=taken[P.id], n=0;
    while(q&&q!==P&&n++<s.ops.length)q=taken[q.id];
    if(q!==P)return;
    const par=taken[P.id];
    par.srcs=par.srcs.filter(function(id){ return id!==P.id; });
    delete taken[P.id];
  });
}
function faoPatternXfs(job,op){
  // Transformations de la répétition, ORIGINAL en tête (null = identité).
  // Affine plane : x' = a·x + b·y + tx ; y' = c·x + d·y + ty (mir : miroir).
  const out=[null];
  if(!op)return out;
  if(op.kind==='rect'){
    // lignes en zigzag : la copie suivante est toujours la plus proche
    for(let j=0;j<op.ny;j++)for(let k=0;k<op.nx;k++){
      const i=(j%2)?(op.nx-1-k):k;
      if(i===0&&j===0)continue;
      out.push({a:1,b:0,c:0,d:1,tx:i*op.dx,ty:j*op.dy,mir:false,lab:'X'+(i+1)+' Y'+(j+1)});
    }
  }else if(op.kind==='circ'){
    const full=Math.abs(Math.abs(op.ang)-360)<1e-9;
    const st=op.n>1?(full?op.ang/op.n:op.ang/(op.n-1)):0;
    for(let i=1;i<op.n;i++){
      const t=st*i*Math.PI/180, co=Math.cos(t), si=Math.sin(t);
      out.push({a:co,b:-si,c:si,d:co,tx:op.cx-co*op.cx+si*op.cy,ty:op.cy-si*op.cx-co*op.cy,mir:false,
        lab:(Math.round(st*i*1000)/1000)+'°'});
    }
  }else if(op.kind==='mirror'){
    if(op.axis==='y')out.push({a:1,b:0,c:0,d:-1,tx:0,ty:2*op.at,mir:true,lab:'miroir Y='+op.at});
    else out.push({a:-1,b:0,c:0,d:1,tx:2*op.at,ty:0,mir:true,lab:'miroir X='+op.at});
  }else if(op.kind==='wcs'){
    (op.wcs||[]).forEach(function(c){ out.push({wcs:c,lab:c}); });
  }
  return out;
}
function faoXfPt(xf,x,y){ return [xf.a*x+xf.b*y+xf.tx, xf.c*x+xf.d*y+xf.ty]; }
function faoXfGeo(xf){
  // Copie déplacée (décalage, rotation, miroir) ? Une copie « autre origine » seule n'a
  // pas de partie géométrique ; une copie composée (V0.99.73) peut avoir les deux.
  return !!xf&&isFinite(xf.a);
}
function faoXfCompose(o,i){
  // V0.99.73 : copie `i` d'une répétition intérieure, replacée par la copie `o` de
  // la répétition qui la contient (o après i). null = original. Une copie n'a
  // qu'une origine : deux origines ne se composent pas (appelant : écartée).
  if(!o)return i;
  if(!i)return o;
  const r={};
  const go=faoXfGeo(o), gi=faoXfGeo(i);
  if(go&&gi){
    r.a=o.a*i.a+o.b*i.c; r.b=o.a*i.b+o.b*i.d;
    r.c=o.c*i.a+o.d*i.c; r.d=o.c*i.b+o.d*i.d;
    r.tx=o.a*i.tx+o.b*i.ty+o.tx; r.ty=o.c*i.tx+o.d*i.ty+o.ty;
    r.mir=!!o.mir!==!!i.mir; // deux miroirs = rotation : sens de coupe d'origine
  }else if(go||gi){
    const g=go?o:i;
    r.a=g.a; r.b=g.b; r.c=g.c; r.d=g.d; r.tx=g.tx; r.ty=g.ty; r.mir=!!g.mir;
  }
  const w=o.wcs||i.wcs;
  if(w)r.wcs=w;
  r.lab=o.lab+' / '+i.lab;
  return r;
}
function faoXfMoves(mv,xf){
  // Moves de la source → moves de la copie (arcs : centre relatif tourné, sens
  // inversé par un miroir). Origine (wcs) seule : moves inchangés.
  if(!faoXfGeo(xf)||!Array.isArray(mv))return mv;
  return mv.map(function(m){
    const q=Object.assign({},m);
    if(isFinite(+m.x)&&isFinite(+m.y)){ const p=faoXfPt(xf,+m.x,+m.y); q.x=p[0]; q.y=p[1]; }
    if(m.arc){
      const i=+m.arc.i||0, j=+m.arc.j||0;
      q.arc=Object.assign({},m.arc,{i:xf.a*i+xf.b*j, j:xf.c*i+xf.d*j});
      if(xf.mir)q.arc.cw=!m.arc.cw;
    }
    return q;
  });
}
function faoPatternParent(job,op){
  // Répétition (active ou non) dont `op` est une source directe (ou null).
  const ops=(job&&job.ops)||[], id=op&&op.id;
  if(!id)return null;
  for(let i=0;i<ops.length;i++){ const p=ops[i];
    if(faoIsPattern(p)&&p!==op&&(p.srcs||[]).indexOf(id)>=0)return p; }
  return null;
}
function faoPatternAncestors(job,op){
  // Répétitions qui contiennent `op`, de la plus proche à la plus haute (V0.99.73).
  const out=[];
  let p=faoPatternParent(job,op);
  while(p&&out.indexOf(p)<0&&out.length<64){ out.push(p); p=faoPatternParent(job,p); }
  return out;
}
function faoPatternOwner(job,op){
  // Répétition ACTIVE qui copie `op` (ou null) : la plus proche en remontant, une
  // répétition désactivée laissant ses sources à celle qui la contient (V0.99.73).
  const A=faoPatternAncestors(job,op);
  for(let i=0;i<A.length;i++)if(A[i].on!==false)return A[i];
  return null;
}
function faoPatternXfsIn(job,P,xs){
  // Copies de la répétition P placées dans chacune des copies `xs` de celles qui la
  // contiennent (null = original), copie englobante par copie englobante.
  if(P.on===false)return xs; // désactivée : transparente
  const own=faoPatternXfs(job,P), L=[];
  for(let j=0;j<xs.length;j++)for(let k=0;k<own.length;k++){
    if(L.length>=FAO_PAT_MAX)return L;
    const o=xs[j], i=own[k];
    if(o&&i&&o.wcs&&i.wcs)continue; // une seule origine par copie
    L.push(faoXfCompose(o,i));
  }
  return L;
}
// V0.99.76 (Fred : « Au moment de visualiser l'usinage et de générer le G-Code, il faudrait
// pouvoir choisir de faire les outils dans l'ordre, en respectant les répétitions ») :
// ordre d'usinage du posage, setup.toolOrder — absent = ordre de la liste (documents
// inchangés) ; 'tool' = par outil, chaque outil fait tout son travail là où il sert pour
// la première fois ; 'num' = par numéro d'outil (T1, T2…). Tri STABLE de la séquence
// développée : chaque opération garde toutes ses copies à la suite (répétitions
// respectées) ; à outil égal, l'ordre de la liste. faoOpsSeq le rend : aperçu, ▶ Usinage,
// collisions, temps, G-code et brut restant (faoRestPrev) suivent le même ordre.
const FAO_ORDRES=[
  ['list','Ordre de la liste','Les opérations sont usinées dans l’ordre de l’arbre (répétitions à leur place).'],
  ['tool','Par outil','Ordre d’apparition : chaque outil fait toutes ses opérations là où il sert pour la première fois — le moins de changements d’outil.'],
  ['num','Par numéro d’outil','T1, T2, T3… : les outils passent par numéro croissant, quel que soit l’ordre de l’arbre.']];
function faoToolOrder(job){ const v=job&&job.toolOrder; return (v==='tool'||v==='num')?v:'list'; }
function faoSeqToolKey(job,op){
  // Même outil = même clé que le changement d'outil de faoJobMoves / faoSeqSafe.
  const t=faoToolById(job,op&&op.toolId);
  return t?t.id+'|'+t.d:'';
}
function faoSeqOrder(job,seq){
  const mode=faoToolOrder(job);
  if(mode==='list'||seq.length<2)return seq;
  const rang={}; let n=0;
  const L=seq.map(function(E,i){
    const k=faoSeqToolKey(job,E.op);
    if(!(k in rang))rang[k]=n++;
    const t=faoToolById(job,E.op&&E.op.toolId), num=t?+t.num:NaN;
    return {E:E,i:i,r:rang[k],num:isFinite(num)?num:1e9};
  });
  L.sort(function(a,b){
    if(mode==='num'&&a.num!==b.num)return a.num-b.num;
    return (a.r-b.r)||(a.i-b.i);
  });
  return L.map(function(x){ return x.E; });
}
function faoToolChanges(seq,job){
  // Nombre de groupes d'outil successifs d'une séquence (changements d'outil + 1).
  let g=0, prev=null;
  (seq||[]).forEach(function(E){ const k=faoSeqToolKey(job,E.op); if(k!==prev){ g++; prev=k; } });
  return g;
}
function faoOrderSummary(job){
  // Fiche du posage : ordre réel des outils, ex. « T1 (1, 3, 5 ×4) → T2 (2) ».
  const ops=(job&&job.ops)||[];
  const seq=faoOpsSeq(job), parts=[];
  let cur=null;
  seq.forEach(function(E){
    const k=faoSeqToolKey(job,E.op);
    if(!cur||cur.k!==k){
      const t=faoToolById(job,E.op&&E.op.toolId)||{};
      cur={k:k,lab:'T'+(t.num||1),ops:[],nb:{}};
      parts.push(cur);
    }
    const id=E.op&&E.op.id;
    if(!(id in cur.nb)){ cur.nb[id]=0; cur.ops.push(E.op); }
    cur.nb[id]++;
  });
  return parts.map(function(p){
    return p.lab+' ('+p.ops.map(function(o){ const c=p.nb[o.id]; return (ops.indexOf(o)+1)+(c>1?' ×'+c:''); }).join(', ')+')';
  }).join(' → ');
}
function faoOrderRows(p,setup){
  // Fiche du posage (onglet Général) : choix de l'ordre + ordre réel des outils.
  const r=faoRow();
  r.appendChild(faoLab('Ordre d’usinage'));
  r.appendChild(faoSel(FAO_ORDRES,faoToolOrder(setup),function(v){
    if(v==='tool'||v==='num')setup.toolOrder=v; else delete setup.toolOrder;
  },'Ordre des opérations dans l’aperçu, ▶ Usinage, le temps estimé et le G-code. Par outil : toutes les opérations d’un même outil à la suite ; chaque opération répétée garde toutes ses copies à la suite.'));
  p.appendChild(r);
  try{
    const seq=faoOpsSeq(setup);
    if(!seq.length)return;
    const nG=faoToolChanges(seq,setup);
    const plur=function(n){ return n+' changement'+(n>1?'s':'')+' d’outil'; };
    let t='Ordre réel : '+faoOrderSummary(setup)+' — '+plur(Math.max(0,nG-1));
    if(faoToolOrder(setup)!=='list'){
      const ls=faoOpsSeq(Object.assign({},setup,{toolOrder:undefined}));
      const nL=faoToolChanges(ls,setup);
      if(nL!==nG)t+=' au lieu de '+Math.max(0,nL-1)+' dans l’ordre de la liste';
      t+='.';
      p.appendChild(faoHelp(t));
      const bouge=ls.some(function(E,i){ return E.op!==seq[i].op; });
      if(bouge)p.appendChild(faoHelp('Des opérations changent de place : vérifiez que l’ordre reste possible (ébauche avant finition, pointage avant perçage, perçage avant taraudage). Le brut restant suit cet ordre.'));
      return;
    }
    p.appendChild(faoHelp(t+'.'));
  }catch(e){}
}
function faoOpsSeq(job){
  // Séquence d'usinage du posage : [{op, xf, pat, k, n}] — opérations actives,
  // répétitions développées (par opération), sources retirées de leur place.
  // V0.99.73 : répétitions imbriquées développées récursivement ; pat = la
  // répétition la plus haute, à la place de laquelle la copie est usinée.
  // V0.99.76 : puis rangée selon l'ordre d'usinage du posage (faoSeqOrder).
  const ops=((job&&job.ops)||[]);
  const out=[];
  const dev=function(top,P,xs,vus){
    const L=faoPatternXfsIn(job,P,xs);
    ops.forEach(function(src){
      if(!src||src===P||(P.srcs||[]).indexOf(src.id)<0)return;
      if(faoIsPattern(src)){
        if(vus.indexOf(src)<0&&vus.length<64)dev(top,src,L,vus.concat([src]));
        return;
      }
      if(src.on===false)return;
      // repère propre (3+2) : copies géométriques impossibles → copies sans déplacement seules
      const M=src.frame?L.filter(function(x){ return !faoXfGeo(x); }):L;
      M.forEach(function(xf,k){ out.push({op:src,xf:xf,pat:top,k:k,n:M.length}); });
    });
  };
  ops.forEach(function(op){
    if(!op||op.on===false)return;
    if(faoPatternOwner(job,op))return;
    if(faoIsPattern(op)){ dev(op,op,[null],[op]); return; }
    out.push({op:op,xf:null});
  });
  return faoSeqOrder(job,out);
}
function faoPatternCount(job,op){
  // nombre de copies (original compris)
  return faoPatternXfs(job,op).length;
}
function faoPatternTotal(job,op){
  // V0.99.73 : copies de chaque opération de cette répétition, répétitions qui la
  // contiennent comprises (2 × 4 → 8).
  const A=faoPatternAncestors(job,op).reverse();
  let xs=[null];
  A.forEach(function(p){ xs=faoPatternXfsIn(job,p,xs); });
  return faoPatternXfsIn(job,Object.assign({},op,{on:true}),xs).length;
}
function faoPatternLabel(job,op){
  const k=FAO_PAT_KINDS.filter(function(x){return x[0]===op.kind;})[0];
  return 'Répétition '+(k?k[1].toLowerCase():'')+' ×'+faoPatternCount(job,op);
}
function faoPatternNew(){
  // Bouton « Répétition » : reprend les opérations sélectionnées (Ctrl+clic) du posage,
  // répétitions comprises (V0.99.73 : répétition d'une répétition).
  try{
    const s=faoSetup();
    const op=faoPatternDefaults(s);
    let at=s.ops.length;
    try{
      const so=faoSelectedOps();
      if(so&&so.setup===s){
        op.srcs=so.ops.filter(function(o){ return !!o&&!!o.id; }).map(function(o){ return o.id; });
        at=Math.max.apply(null,so.ops.map(function(o){ return s.ops.indexOf(o)+1; })); // juste après la dernière source
      }
    }catch(e){}
    faoSnapshot('nouvelle répétition');
    s.ops.splice(Math.min(at,s.ops.length),0,op);
    faoChanged();
    faoSelectOp(s.id,op.id);
    return op;
  }catch(e){ return null; }
}
function faoPatternFiche(p,setup,op,idx){
  // Fiche de la répétition dans le panneau droit.
  p.appendChild(faoH('Répétition · '+setup.name));
  const d=faoCard();
  if(op.on===false)d.style.opacity='0.55';
  const r=faoRow();
  const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=op.on!==false;
  cb.title=faoPatternParent(setup,op)
    ?'Décocher = répétition ignorée : ses opérations ne sont plus copiées que par la répétition qui la contient'
    :'Décocher = répétition ignorée : les opérations sources sont usinées une seule fois, à leur place';
  cb.onchange=function(){ faoSnapshot('activer/désactiver la répétition'); op.on=cb.checked; faoChanged(); };
  r.appendChild(cb);
  const tt=document.createElement('span'); tt.className='fao-opnum';
  tt.textContent=(idx+1)+'. '+faoPatternLabel(setup,op); r.appendChild(tt);
  r.appendChild(faoMini('↑',function(){ const i=setup.ops.indexOf(op); if(i>0){ setup.ops.splice(i,1); setup.ops.splice(i-1,0,op); } },'Remonter la répétition (usinée plus tôt)'));
  r.appendChild(faoMini('↓',function(){ const i=setup.ops.indexOf(op); if(i>=0&&i<setup.ops.length-1){ setup.ops.splice(i,1); setup.ops.splice(i+1,0,op); } },'Descendre la répétition (usinée plus tard)'));
  r.appendChild(faoMini('✕',function(){ const i=setup.ops.indexOf(op); if(i>=0)setup.ops.splice(i,1); },'Supprimer la répétition (les sources sont de nouveau usinées une fois, à leur place)'));
  d.appendChild(r);
  const rk=faoRow(); rk.appendChild(faoLab('Type'));
  rk.appendChild(faoSel(FAO_PAT_KINDS,op.kind,function(v){ op.kind=v; },'Rectangulaire : copies en lignes et colonnes · Circulaire : autour d’un centre · Symétrie : copie miroir · Autres origines : mêmes parcours dans G55, G56…'));
  d.appendChild(rk);
  const rp=faoRow();
  if(op.kind==='rect'){
    rp.appendChild(faoLab('X'));  rp.appendChild(faoNum(op.nx,function(v){ op.nx=v; },40,1,'Nombre de copies en X (original compris)'));
    rp.appendChild(faoLab('pas')); rp.appendChild(faoNum(op.dx,function(v){ op.dx=v; },56,1,'Pas en X (mm, négatif = vers −X)'));
    d.appendChild(rp);
    const r2=faoRow();
    r2.appendChild(faoLab('Y'));  r2.appendChild(faoNum(op.ny,function(v){ op.ny=v; },40,1,'Nombre de copies en Y (original compris)'));
    r2.appendChild(faoLab('pas')); r2.appendChild(faoNum(op.dy,function(v){ op.dy=v; },56,1,'Pas en Y (mm, négatif = vers −Y)'));
    d.appendChild(r2);
  }else if(op.kind==='circ'){
    rp.appendChild(faoLab('Nombre')); rp.appendChild(faoNum(op.n,function(v){ op.n=v; },40,1,'Nombre de copies (original compris)'));
    rp.appendChild(faoLab('Angle')); rp.appendChild(faoNum(op.ang,function(v){ op.ang=v; },56,1,'Angle total (°) : 360 = tour complet réparti, sinon de la 1re à la dernière copie'));
    d.appendChild(rp);
    const r2=faoRow();
    r2.appendChild(faoLab('Centre X')); r2.appendChild(faoNum(op.cx,function(v){ op.cx=v; },56,1,'Centre de rotation X (repère du posage)'));
    r2.appendChild(faoLab('Y')); r2.appendChild(faoNum(op.cy,function(v){ op.cy=v; },56,1,'Centre de rotation Y (repère du posage)'));
    d.appendChild(r2);
  }else if(op.kind==='mirror'){
    rp.appendChild(faoLab('Plan'));
    rp.appendChild(faoSel([['x','X = constante'],['y','Y = constante']],op.axis,function(v){ op.axis=v; },'Plan de symétrie, perpendiculaire à X ou à Y'));
    rp.appendChild(faoLab('à')); rp.appendChild(faoNum(op.at,function(v){ op.at=v; },56,1,'Position du plan de symétrie (mm, repère du posage)'));
    d.appendChild(rp);
    d.appendChild(faoHelp('La copie miroir inverse le sens de coupe (avalant ↔ opposition), comme dans Fusion 360.'));
  }else{
    rp.appendChild(faoLab('Origines'));
    d.appendChild(rp);
    // V0.99.78 : origines en petites cases côte à côte (passent à la ligne au besoin, jamais hors du panneau)
    const ro=document.createElement('div'); ro.className='mf-pick-chips';
    FAO_WCS_ALL.forEach(function(c){
      if(c===(setup.wcs||'G54'))return;
      const k=document.createElement('input'); k.type='checkbox'; k.checked=(op.wcs||[]).indexOf(c)>=0;
      k.onchange=function(){ faoSnapshot('origines de la répétition');
        const w=(op.wcs||[]).filter(function(x){return x!==c;}); if(k.checked)w.push(c);
        op.wcs=FAO_WCS_ALL.filter(function(x){return w.indexOf(x)>=0;}); faoChanged(); };
      ro.appendChild(mfPickRow(k,c,'',{title:'Refaire les parcours dans l’origine '+c}));
    });
    d.appendChild(ro);
    d.appendChild(faoHelp('Le programme usine d’abord dans '+(setup.wcs||'G54')+' (origine du posage), puis refait les mêmes parcours dans chaque origine cochée — à régler sur la CN.'));
  }
  // sources : opérations et autres répétitions (V0.99.73), sauf celles qui contiennent
  // déjà cette répétition (boucle impossible)
  d.appendChild(faoH('Opérations répétées'));
  const anc=faoPatternAncestors(setup,op);
  const ops=(setup.ops||[]).filter(function(o){ return o&&o!==op&&anc.indexOf(o)<0; });
  if(!ops.length)d.appendChild(faoHelp('Aucune opération dans ce posage.'));
  ops.forEach(function(o){
    const owner=(setup.ops||[]).filter(function(q){ return faoIsPattern(q)&&q!==op&&(q.srcs||[]).indexOf(o.id)>=0; })[0];
    const k=document.createElement('input'); k.type='checkbox'; k.checked=(op.srcs||[]).indexOf(o.id)>=0;
    const pat=faoIsPattern(o);
    const fr=!pat&&!!o.frame&&faoPatternGeo(op);
    const nOwn=owner?((setup.ops||[]).indexOf(owner)+1):0;
    k.disabled=!!owner;
    k.onchange=function(){ faoSnapshot('opérations de la répétition');
      const s2=(op.srcs||[]).filter(function(x){return x!==o.id;}); if(k.checked)s2.push(o.id);
      op.srcs=(setup.ops||[]).filter(function(q){return s2.indexOf(q.id)>=0;}).map(function(q){return q.id;}); faoChanged(); };
    // V0.99.78 : une ligne courte, comme l'arbre (« 3. Répétition rect. ×3 ↻7 ») ; le détail est dans l'infobulle
    const lab=faoOpShortLabel(o);
    const info=[((setup.ops||[]).indexOf(o)+1)+'. '+lab];
    if(o.on===false)info.push('Désactivée (○ dans l’arbre)');
    info.push(owner?('Déjà dans la répétition n° '+nOwn)
      :(pat?'Répéter cette répétition : toutes ses copies sont refaites sur chaque copie de celle-ci'
        :(fr?'Repère propre (3+2) : seul l’original est usiné, pas de copie déplacée':'Répéter cette opération')));
    d.appendChild(mfPickRow(k,((setup.ops||[]).indexOf(o)+1)+'. '+lab.replace(/^Répétition /,'Rép. ').replace(/rectangulaire/,'rect.').replace(/circulaire/,'circ.'),
      (owner?'↻'+nOwn:'')+(fr?(owner?' ':'')+'3+2':''),
      {off:o.on===false||!!owner,title:info.join(' — ')}));
  });
  const nS=(op.srcs||[]).length, nC=faoPatternCount(setup,op);
  d.appendChild(faoHelp(nS
    ?(nS+' opération(s) × '+nC+' copies (original compris) — usinées opération par opération : chacune sur toutes les copies avant la suivante.')
    :'Cochez les opérations à répéter (ou sélectionnez-les par Ctrl+clic dans l’arbre avant de créer la répétition).'));
  // V0.99.73 : répétitions imbriquées — nombre réel de copies
  const nT=faoPatternTotal(setup,op);
  const inner=(setup.ops||[]).filter(function(o){ return faoIsPattern(o)&&(op.srcs||[]).indexOf(o.id)>=0; });
  const haut=anc.filter(function(q){ return q.on!==false; }).pop();
  if(haut&&op.on!==false)d.appendChild(faoHelp('Dans la répétition n° '+((setup.ops||[]).indexOf(anc[0])+1)
    +' : ses opérations sont faites '+nT+' fois en tout, à la place de la répétition n° '+((setup.ops||[]).indexOf(haut)+1)+' dans la liste.'));
  inner.forEach(function(q){
    if(q.on===false){ d.appendChild(faoHelp('Répétition n° '+((setup.ops||[]).indexOf(q)+1)+' désactivée : ses opérations ne sont copiées que par celle-ci.')); return; }
    d.appendChild(faoHelp('Répétition n° '+((setup.ops||[]).indexOf(q)+1)+' ('+faoPatternLabel(setup,q).replace(/^Répétition /,'')+') refaite sur chaque copie : '
      +faoPatternTotal(setup,q)+' copies de chacune de ses opérations.'));
  });
  if(nT>=FAO_PAT_MAX)d.appendChild(faoHelp('⚠ Limité à '+FAO_PAT_MAX+' copies par opération.'));
  p.appendChild(d);
  const back=faoRow();
  const bb=document.createElement('button'); bb.textContent='← Posage '+setup.name; bb.style.fontSize='.72rem';
  bb.onclick=function(){ faoSelectSetup(setup.id); };
  back.appendChild(bb); p.appendChild(back);
}
function faoPatternRemap(ops,map){
  // Copier / coller : les sources d'une répétition suivent les ids neufs.
  (ops||[]).forEach(function(o){ if(faoIsPattern(o))o.srcs=(o.srcs||[]).map(function(id){ return map[id]||id; }); });
}
