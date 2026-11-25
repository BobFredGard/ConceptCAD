/* ----- V0.99.86 (demande de Fred) : SURVOL d'une opération dans l'arbre FAO -----
   « Au survol, tu montres l'opération survolée, qu'elle soit masquée ou non. Cela
   veut dire qu'il faut des couleurs adéquates pour la visu des parcours et des
   différentes entrées / sorties / rapides. » Choix de Fred sur maquettes : variante
   A, « Projecteur ».
   - L'opération survolée garde les couleurs habituelles (coupe bleue, entrée verte,
     rapides jaunes, remontées magenta) en traits épais ; la SORTIE a sa couleur
     (orange) au lieu du vert des entrées ; rapides et remontées en pointillés ;
     liaisons au contact en bleu clair. Montrée même masquée, rapides compris même si
     le bouton « Rapides » les estompe ou les cache.
   - Les autres opérations affichées passent en gris pâle le temps du survol ; les
     opérations masquées restent cachées.
   - Légende en bas de la vue, à droite de l'arbre.
   Rien n'est recalculé : le survol relit les mouvements gardés par l'aperçu
   (faoPrevOps → e.src, src/88-fao-60). Un seul tracé de survol est gardé à la fois.
   Pendant un dessin progressif (Régénérer) ou la simulation, le survol ne fait rien. */
const FAO_SURVOL={cut:0x2f80ff,ent:0x30d158,sor:0xff9f0a,lia:0x64d2ff,gris:0x8a96a6,grisA:0.22};
const FAO_SURVOL_DELAI=120; // ms : une ligne simplement traversée par la souris n'allume rien
let faoSurvolEtat=null;     // {op, e, row, sauve:[fonctions de remise], leg}
let faoSurvolMinute=null;   // délai avant l'allumage
let faoSurvolCache=null;    // {e, g} : dernier tracé de survol construit

function faoSurvolDecoupe(moves,clip,out){
  // Segments par catégorie (même lecture que faoSegSplit : chaque segment prend la
  // commande de SA destination ; la zone ne borne que ce qui n'est pas un rapide).
  //  - rapide / remontée (G0 vertical qui monte) : comme l'aperçu ;
  //  - liaison au contact (m.tr) ;
  //  - entrée / sortie : suite de mouvements étiquetés ent (rampe, hélice, arc,
  //    descente) et de plongées verticales en avance. SORTIE si elle vient après la
  //    coupe et quitte la matière (suivie d'un rapide, d'une liaison ou de la fin ;
  //    une remontée verticale en avance juste après ne compte pas) ; sinon ENTRÉE —
  //    l'hélice d'une ébauche entre deux niveaux, suivie de coupe, est une entrée ;
  //  - coupe : tout le reste (remontée verticale en avance comprise, comme l'aperçu).
  // -> {cut, ent, sor, lia, rap, ret} : [ax,ay,az,bx,by,bz,...]
  const o=out||{cut:[],ent:[],sor:[],lia:[],rap:[],ret:[]};
  if(!moves||!moves.length)return o;
  const n=moves.length, cat=new Array(n), monte=new Array(n);
  for(let i=1;i<n;i++){
    const m=moves[i],p=moves[i-1];
    const vert=Math.abs(m.x-p.x)<1e-9&&Math.abs(m.y-p.y)<1e-9;
    monte[i]=!m.r&&!m.ent&&!m.tr&&!m.arc&&vert&&m.z>p.z+1e-9;
    if(m.r)cat[i]=(vert&&m.z>p.z+1e-9)?'ret':'rap';
    else if(m.tr)cat[i]='lia';
    else if(m.ent||(vert&&m.z<p.z-1e-9&&!m.arc))cat[i]='es';
    else cat[i]='cut';
  }
  for(let i=1;i<n;){
    if(cat[i]!=='es'){ i++; continue; }
    let j=i; while(j<n&&cat[j]==='es')j++;
    let k=j; while(k<n&&monte[k])k++;
    const k2=(i>1&&cat[i-1]==='cut'&&(k>=n||cat[k]!=='cut'))?'sor':'ent';
    for(let q=i;q<j;q++)cat[q]=k2;
    i=j;
  }
  const seg=function(arr,ax,ay,az,bx,by,bz,coupe){
    if(!clip||!coupe){ arr.push(ax,ay,az,bx,by,bz); return; }
    clip(ax,ay,az,bx,by,bz,function(x1,y1,z1,x2,y2,z2){ arr.push(x1,y1,z1,x2,y2,z2); });
  };
  for(let i=1;i<n;i++){
    const m=moves[i],prev=moves[i-1],arr=o[cat[i]],coupe=!m.r;
    if(m.arc&&!prev.r){
      let pp={x:prev.x,y:prev.y,z:prev.z};
      faoArcSegs(prev,m).forEach(function(q){
        seg(arr,pp.x,pp.y,pp.z,q[0],q[1],q[2],coupe); pp={x:q[0],y:q[1],z:q[2]};
      });
    }else seg(arr,prev.x,prev.y,prev.z,m.x,m.y,m.z,coupe);
  }
  return o;
}
function faoSurvolPas(acc){
  // Pointillés à l'échelle de l'opération : ~1,2 % de la diagonale de son encombrement.
  let x0=1/0,y0=1/0,z0=1/0,x1=-1/0,y1=-1/0,z1=-1/0;
  ['cut','ent','sor','lia','rap','ret'].forEach(function(k){
    const a=acc[k]; if(!a)return;
    for(let i=0;i<a.length;i+=3){
      const x=a[i],y=a[i+1],z=a[i+2];
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; if(z<z0)z0=z; if(z>z1)z1=z;
    }
  });
  const d=isFinite(x0)?Math.hypot(x1-x0,y1-y0,z1-z0):100;
  const on=Math.max(0.4,Math.min(25,d*0.012));
  return [on,on*0.7];
}
function faoSurvolTirets(arr,pas){
  const on=pas[0],per=pas[0]+pas[1],d=[];
  for(let i=0;i+5<arr.length;i+=6){
    const ax=arr[i],ay=arr[i+1],az=arr[i+2],bx=arr[i+3],by=arr[i+4],bz=arr[i+5];
    const L=Math.hypot(bx-ax,by-ay,bz-az);
    if(!(L>1e-9))continue;
    for(let t=0;t<L;t+=per){
      const u=t/L,v=Math.min(L,t+on)/L;
      d.push(ax+(bx-ax)*u,ay+(by-ay)*u,az+(bz-az)*u,ax+(bx-ax)*v,ay+(by-ay)*v,az+(bz-az)*v);
    }
  }
  return d;
}
function faoSurvolGroupe(e){
  // Tracé de survol d'une opération (toutes ses copies de répétition comprises).
  const acc={cut:[],ent:[],sor:[],lia:[],rap:[],ret:[]};
  (e.src||[]).forEach(function(s){
    const b=s&&s.b; if(!b||!b.moves||!b.moves.length)return;
    faoSurvolDecoupe(b.tail?b.moves.concat(b.tail):b.moves,s.clip,acc);
  });
  const cats={};
  Object.keys(acc).forEach(function(k){ cats[k]=acc[k].length>=6; });
  if(!Object.keys(cats).some(function(k){ return cats[k]; }))return null;
  const g=new THREE.Group(); g.name='faoSurvol'; g.visible=false;
  const pas=faoSurvolPas(acc);
  const add=function(arr,col,px,tirets){
    if(arr.length<6)return;
    const a=tirets?faoSurvolTirets(arr,pas):arr;
    if(a.length<6)return;
    let m=null;
    if(a.length/6>150000){
      // très grosse coupe (ébauche 3D) : trait fin, comme l'aperçu (les traits épais coûtent 4 sommets par segment)
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(a),3));
      m=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:col}));
    }else m=faoThickSegs(a,col,undefined,px);
    m.renderOrder=5; g.add(m);
  };
  add(acc.cut,FAO_SURVOL.cut,2);
  add(acc.lia,FAO_SURVOL.lia,2.5);
  add(acc.ent,FAO_SURVOL.ent,3);
  add(acc.sor,FAO_SURVOL.sor,3);
  add(acc.rap,FAO_COL_RAPIDE,2,true);
  add(acc.ret,FAO_COL_REMONTEE,2,true);
  g.userData.cats=cats;
  return g;
}
function faoSurvolLibere(g){
  try{ if(g&&g.parent)g.parent.remove(g); }catch(e){}
  try{ if(g)g.traverse(function(o){
    if(o.geometry&&o.geometry.dispose)o.geometry.dispose();
    if(o.material&&o.material.dispose)o.material.dispose();
  }); }catch(e){}
}
function faoSurvolGrise(mat){
  // Passe un matériau de l'aperçu en gris pâle ; renvoie la fonction qui le remet.
  const u=mat&&mat.uniforms;
  if(u&&u.col&&u.op&&u.col.value&&u.col.value.clone){
    const c=u.col.value.clone(),o=u.op.value,w=u.w?u.w.value:null,tr=mat.transparent,dw=mat.depthWrite;
    u.col.value.setHex(FAO_SURVOL.gris); u.op.value=Math.min(o,FAO_SURVOL.grisA);
    if(u.w)u.w.value=1;
    mat.transparent=true; mat.depthWrite=false;
    return function(){ u.col.value.copy(c); u.op.value=o; if(u.w)u.w.value=w; mat.transparent=tr; mat.depthWrite=dw; };
  }
  if(mat&&mat.color&&mat.color.clone){
    const c=mat.color.clone(),o=mat.opacity,tr=mat.transparent,dw=mat.depthWrite;
    mat.color.setHex(FAO_SURVOL.gris); mat.opacity=Math.min(isFinite(o)?o:1,FAO_SURVOL.grisA);
    mat.transparent=true; mat.depthWrite=false;
    return function(){ mat.color.copy(c); mat.opacity=o; mat.transparent=tr; mat.depthWrite=dw; };
  }
  return function(){};
}
function faoSurvolReveil(){ try{ if(typeof viewWake==='function')viewWake(); }catch(e){} }
function faoSurvolPrevoir(op,row){
  // Souris sur une ligne d'opération : survol après un court délai.
  if(faoSurvolMinute){ clearTimeout(faoSurvolMinute); faoSurvolMinute=null; }
  if(faoSurvolEtat&&faoSurvolEtat.op===op)return;
  faoSurvolMinute=setTimeout(function(){ faoSurvolMinute=null; faoSurvolDebut(op,row); },FAO_SURVOL_DELAI);
}
function faoSurvolDebut(op,row){
  // Montre l'opération `op` seule en couleurs, les autres en gris. -> true si montrée.
  faoSurvolFin();
  try{
    if(!op||!faoPrevOn||!faoPrevGroup||!faoPrevOps)return false;
    if(typeof faoVw!=='undefined'&&faoVw)return false;                      // simulation ouverte
    if(faoPrevStreamG&&faoPrevStreamG===faoPrevGroup)return false;          // dessin en cours
    const e=faoPrevOps.get(op);
    if(!e||!e.src||!e.src.length)return false;                             // pas de parcours en mémoire
    if(!faoSurvolCache||faoSurvolCache.e!==e){
      if(faoSurvolCache)faoSurvolLibere(faoSurvolCache.g);
      faoSurvolCache=null;
      const g=faoSurvolGroupe(e);
      if(!g)return false;
      faoSurvolCache={e:e,g:g};
    }
    const g=faoSurvolCache.g;
    if(g.parent!==faoPrevGroup)faoPrevGroup.add(g);
    const sauve=[];
    faoPrevOps.forEach(function(x,o){
      if(!x||!x.g)return;
      if(o===op){ x.g.visible=false; return; }
      if(!x.g.visible)return;
      x.g.traverse(function(m){ if(m&&m.material)sauve.push(faoSurvolGrise(m.material)); });
    });
    g.visible=true;
    try{ if(row&&row.classList)row.classList.add('survol'); }catch(err){}
    faoSurvolEtat={op:op,e:e,row:row||null,sauve:sauve,leg:faoSurvolLegende(op,g.userData.cats||{})};
    faoSurvolReveil();
    return true;
  }catch(err){ faoSurvolFin(); return false; }
}
function faoSurvolFin(){
  // Fin du survol : couleurs et affichage de chaque opération remis.
  if(faoSurvolMinute){ clearTimeout(faoSurvolMinute); faoSurvolMinute=null; }
  const S=faoSurvolEtat; faoSurvolEtat=null;
  if(!S)return;
  for(let i=0;i<S.sauve.length;i++){ try{ S.sauve[i](); }catch(e){} }
  try{ if(faoSurvolCache&&faoSurvolCache.g)faoSurvolCache.g.visible=false; }catch(e){}
  try{ if(faoPrevOps)faoPrevOps.forEach(function(x,o){ if(x&&x.g)x.g.visible=!(o&&o.hidden===true); }); }catch(e){}
  try{ if(S.row&&S.row.classList)S.row.classList.remove('survol'); }catch(e){}
  try{ if(S.leg&&S.leg.parentNode)S.leg.parentNode.removeChild(S.leg); }catch(e){}
  faoSurvolReveil();
}
function faoSurvolOublie(){
  // L'aperçu est jeté (faoClearPreview) : ses objets partent avec lui, rien à remettre.
  if(faoSurvolMinute){ clearTimeout(faoSurvolMinute); faoSurvolMinute=null; }
  const S=faoSurvolEtat; faoSurvolEtat=null; faoSurvolCache=null;
  if(!S)return;
  try{ if(S.row&&S.row.classList)S.row.classList.remove('survol'); }catch(e){}
  try{ if(S.leg&&S.leg.parentNode)S.leg.parentNode.removeChild(S.leg); }catch(e){}
}
function faoSurvolLegende(op,cats){
  // Légende en bas de la vue, à droite de l'arbre FAO.
  try{
    if(typeof document==='undefined'||!document.body)return null;
    const cv=document.getElementById('viewport');
    if(!cv||!cv.getBoundingClientRect)return null;
    const r=cv.getBoundingClientRect();
    if(!(r.width>0&&r.height>0))return null;
    let left=r.left+14;
    try{
      if(typeof faoTreeWrapEl!=='undefined'&&faoTreeWrapEl&&faoTreeWrapEl.getBoundingClientRect){
        const t=faoTreeWrapEl.getBoundingClientRect();
        if(t.width>0&&t.right<r.left+r.width*0.6)left=Math.max(left,t.right+12);
      }
    }catch(e){}
    const hx=function(n){ return '#'+('000000'+(n>>>0).toString(16)).slice(-6); };
    const ligne=function(nom,col,tirets){
      return '<div class="fao-survol-it"><svg width="30" height="8"><line x1="1" y1="4" x2="29" y2="4" stroke="'+hx(col)
        +'" stroke-width="3"'+(tirets?' stroke-dasharray="6 4"':'')+'/></svg><span>'+nom+'</span></div>';
    };
    let n=0, s0=null;
    try{ s0=faoSetupOfOp(op); n=s0?s0.ops.indexOf(op)+1:0; }catch(e){}
    let autres=false;
    try{ faoPrevOps.forEach(function(x,o){ if(o!==op&&x&&x.g&&!(o&&o.hidden===true))autres=true; }); }catch(e){}
    const d=document.createElement('div');
    d.className='fao-survol-leg';
    d.style.left=Math.round(left)+'px';
    d.style.bottom=Math.round(Math.max(8,((typeof window!=='undefined'&&window.innerHeight)||r.bottom)-r.bottom+14))+'px';
    const ti=document.createElement('div');
    ti.className='fao-survol-ti';
    ti.textContent=(n>0?n+'. ':'')+faoOpShortLabel(op)+(op.hidden===true?' — masquée':'');
    const co=document.createElement('div');
    co.innerHTML=(cats.cut?ligne('Coupe',FAO_SURVOL.cut):'')
      +(cats.ent?ligne('Entrée (rampe, hélice, plongée)',FAO_SURVOL.ent):'')
      +(cats.sor?ligne('Sortie',FAO_SURVOL.sor):'')
      +(cats.lia?ligne('Liaison au contact',FAO_SURVOL.lia):'')
      +(cats.rap?ligne('Rapide',FAO_COL_RAPIDE,true):'')
      +(cats.ret?ligne('Remontée',FAO_COL_REMONTEE,true):'')
      +(autres?'<div class="fao-survol-it fao-survol-gris"><svg width="30" height="8"><line x1="1" y1="4" x2="29" y2="4" stroke="'
        +hx(FAO_SURVOL.gris)+'" stroke-width="2"/></svg><span>Autres opérations</span></div>':'');
    d.appendChild(ti); d.appendChild(co);
    document.body.appendChild(d);
    return d;
  }catch(e){ return null; }
}
