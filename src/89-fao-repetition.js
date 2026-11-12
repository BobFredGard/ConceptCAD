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
const FAO_PAT_KINDS=[['rect','Rectangulaire'],['circ','Circulaire'],['mirror','Symétrie'],['wcs','Autres origines']];
const FAO_WCS_ALL=['G54','G55','G56','G57','G58','G59'];
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
  // Relu à chaque faoRoot : sources = opérations ordinaires du MÊME posage, une
  // opération n'appartient qu'à UNE répétition (la première), nombres bornés.
  if(!s||!Array.isArray(s.ops))return;
  const ids={}, taken={};
  s.ops.forEach(function(o){ if(o&&o.id&&!faoIsPattern(o))ids[o.id]=o; });
  s.ops.forEach(function(op){
    if(!faoIsPattern(op))return;
    if(['rect','circ','mirror','wcs'].indexOf(op.kind)<0)op.kind='rect';
    const src=Array.isArray(op.srcs)?op.srcs:[];
    op.srcs=src.filter(function(id,i){ return typeof id==='string'&&ids[id]&&src.indexOf(id)===i&&!taken[id]; });
    op.srcs.forEach(function(id){ taken[id]=1; });
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
function faoXfMoves(mv,xf){
  // Moves de la source → moves de la copie (arcs : centre relatif tourné, sens
  // inversé par un miroir). Origine (wcs) : moves inchangés.
  if(!xf||xf.wcs||!Array.isArray(mv))return mv;
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
function faoPatternOwner(job,op){
  // Répétition ACTIVE qui contient `op` (ou null).
  const ops=(job&&job.ops)||[];
  for(let i=0;i<ops.length;i++){ const p=ops[i];
    if(faoIsPattern(p)&&p.on!==false&&(p.srcs||[]).indexOf(op&&op.id)>=0)return p; }
  return null;
}
function faoOpsSeq(job){
  // Séquence d'usinage du posage : [{op, xf, pat, k, n}] — opérations actives,
  // répétitions développées (par opération), sources retirées de leur place.
  const ops=((job&&job.ops)||[]);
  const out=[];
  ops.forEach(function(op){
    if(!op||op.on===false)return;
    if(faoIsPattern(op)){
      const xfs=faoPatternXfs(job,op);
      ops.forEach(function(src){
        if(!src||src.on===false||faoIsPattern(src)||(op.srcs||[]).indexOf(src.id)<0)return;
        // repère propre (3+2) : copies géométriques impossibles → original seul
        const own=!!src.frame&&faoPatternGeo(op);
        const L=own?[null]:xfs;
        L.forEach(function(xf,k){ out.push({op:src,xf:xf,pat:op,k:k,n:L.length}); });
      });
      return;
    }
    if(faoPatternOwner(job,op))return;
    out.push({op:op,xf:null});
  });
  return out;
}
function faoPatternCount(job,op){
  // nombre de copies (original compris)
  return faoPatternXfs(job,op).length;
}
function faoPatternLabel(job,op){
  const k=FAO_PAT_KINDS.filter(function(x){return x[0]===op.kind;})[0];
  return 'Répétition '+(k?k[1].toLowerCase():'')+' ×'+faoPatternCount(job,op);
}
function faoPatternNew(){
  // Bouton « Répétition » : reprend les opérations sélectionnées (Ctrl+clic) du posage.
  try{
    const s=faoSetup();
    const op=faoPatternDefaults(s);
    let at=s.ops.length;
    try{
      const so=faoSelectedOps();
      if(so&&so.setup===s){
        op.srcs=so.ops.filter(function(o){ return !faoIsPattern(o); }).map(function(o){ return o.id; });
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
  cb.title='Décocher = répétition ignorée : les opérations sources sont usinées une seule fois, à leur place';
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
    FAO_WCS_ALL.forEach(function(c){
      if(c===(setup.wcs||'G54'))return;
      const lab=document.createElement('label'); lab.style.marginRight='6px';
      const k=document.createElement('input'); k.type='checkbox'; k.checked=(op.wcs||[]).indexOf(c)>=0;
      k.onchange=function(){ faoSnapshot('origines de la répétition');
        const w=(op.wcs||[]).filter(function(x){return x!==c;}); if(k.checked)w.push(c);
        op.wcs=FAO_WCS_ALL.filter(function(x){return w.indexOf(x)>=0;}); faoChanged(); };
      lab.appendChild(k); lab.appendChild(document.createTextNode(' '+c)); rp.appendChild(lab);
    });
    d.appendChild(rp);
    d.appendChild(faoHelp('Le programme usine d’abord dans '+(setup.wcs||'G54')+' (origine du posage), puis refait les mêmes parcours dans chaque origine cochée — à régler sur la CN.'));
  }
  // sources
  d.appendChild(faoH('Opérations répétées'));
  const ops=(setup.ops||[]).filter(function(o){ return o&&!faoIsPattern(o); });
  if(!ops.length)d.appendChild(faoHelp('Aucune opération dans ce posage.'));
  ops.forEach(function(o){
    const owner=(setup.ops||[]).filter(function(q){ return faoIsPattern(q)&&q!==op&&(q.srcs||[]).indexOf(o.id)>=0; })[0];
    const rr=faoRow();
    const k=document.createElement('input'); k.type='checkbox'; k.checked=(op.srcs||[]).indexOf(o.id)>=0;
    const fr=!!o.frame&&faoPatternGeo(op);
    k.disabled=!!owner;
    k.title=owner?'Déjà dans une autre répétition':(fr?'Repère propre (3+2) : seul l’original est usiné, pas de copie déplacée':'Répéter cette opération');
    k.onchange=function(){ faoSnapshot('opérations de la répétition');
      const s2=(op.srcs||[]).filter(function(x){return x!==o.id;}); if(k.checked)s2.push(o.id);
      op.srcs=(setup.ops||[]).filter(function(q){return s2.indexOf(q.id)>=0;}).map(function(q){return q.id;}); faoChanged(); };
    rr.appendChild(k);
    const lb=document.createElement('span');
    lb.textContent=((setup.ops||[]).indexOf(o)+1)+'. '+faoOpShortLabel(o)+(o.on===false?' (désactivée)':'')+(owner?' — dans une autre répétition':'')+(fr?' — repère propre : original seul':'');
    rr.appendChild(lb);
    d.appendChild(rr);
  });
  const nS=(op.srcs||[]).length, nC=faoPatternCount(setup,op);
  d.appendChild(faoHelp(nS
    ?(nS+' opération(s) × '+nC+' copies (original compris) — usinées opération par opération : chacune sur toutes les copies avant la suivante.')
    :'Cochez les opérations à répéter (ou sélectionnez-les par Ctrl+clic dans l’arbre avant de créer la répétition).'));
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
