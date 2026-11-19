/* ---------- historique de l'assemblage (V0.99.38) : timeline façon Fusion ----------
   Demande de Fred : « une time line dédiée à l'assemblage pour voir les relations que l'on
   rajoute une à une et autres fonctions d'assemblage » — une icône par étape, dans l'ordre de
   création (pas de réordonnancement), marqueur ⏱ pour revoir l'assemblage étape par étape.
   Modèle : c.hist = [{id, key, k, occ?, rel?, pat?, fr0, fr1?}] par composant (porteur) :
     · ins  : insertion d'une occurrence (fr0 = sa position à l'insertion) ;
     · join : liaison ou alignement (o.align) ;
     · rel  : une relation entre faces (o.cons[i], 48-assemblage-relations) ;
     · pat  : répétition de composants (c.pats) ;
     · move : déplacement à la main d'une pièce libre (fr0 → fr1 ; gestes successifs fusionnés).
   fr0 = position de l'occurrence JUSTE AVANT l'étape : revenir avant une étape, c'est reprendre
   cette position. L'historique se tient à jour tout seul (asmHistSyncAll, appelé par
   asmNotify, 46) en comparant l'état à l'historique : une étape apparaît à la création de ce
   qu'elle décrit, disparaît avec lui — aucune commande n'a à le prévenir.
   Marqueur (asmHistView) : VUE seulement — l'état réel est mis de côté sur chaque occurrence
   (o._histReal, relu par asmOccSerial) ; toute modification (asmSnap ← asmPush, annuler)
   remet d'abord l'état réel. Non enregistré : un fichier s'ouvre toujours en fin d'historique. */
let asmHistSeen=new Map(); // composant → {occ: position vue au dernier passage}
let asmHistView=null;      // {comp, ptr} : marqueur avant la fin
const ASM_HIST_K={ins:{ic:'📦',lab:'Insertion'},join:{ic:'🔗',lab:'Liaison'},rel:{ic:'🧲',lab:'Relation'},pat:{ic:'▦',lab:'Répétition'},move:{ic:'✥',lab:'Déplacement'}};
function asmHistFr(f){return f?{o:f.o.slice(),x:f.x.slice(),y:f.y.slice(),z:f.z.slice()}:null;}
function asmHistFrEq(a,b){return !!a&&!!b&&['o','x','y','z'].every(q=>a[q].every((v,j)=>Math.abs(v-b[q][j])<1e-7));}
function asmHistPresent(c){
  // Étapes que l'état actuel du composant justifie, dans l'ordre d'une migration (fichier ancien)
  const out=[];
  (c.occ||[]).forEach(o=>{
    if(o.pat)return; // instance de répétition : portée par sa répétition
    out.push({key:'ins:'+o.id,k:'ins',occ:o.id});
    if(o.align)out.push({key:'join:'+o.id,k:'join',occ:o.id});
    (Array.isArray(o.cons)?o.cons:[]).forEach(r=>out.push({key:'rel:'+o.id+':'+r.id,k:'rel',occ:o.id,rel:r.id}));
  });
  (c.pats||[]).forEach(p=>out.push({key:'pat:'+p.id,k:'pat',pat:p.id}));
  return out;
}
function asmHistOf(c){
  if(!Array.isArray(c.hist)){
    const by=new Map((c.occ||[]).map(o=>[o.id,o]));
    c.hist=asmHistPresent(c).map(s=>Object.assign({id:uid('hs')},s,{fr0:s.occ&&by.get(s.occ)?asmHistFr(by.get(s.occ).fr):null}));
  }
  return c.hist;
}
function asmHistNorm(L){
  // Historique relu d'un fichier (étapes vérifiées) ; undefined = à reconstruire
  if(!Array.isArray(L))return undefined;
  const okFr=f=>f&&['o','x','y','z'].every(k=>Array.isArray(f[k])&&f[k].length===3&&f[k].every(v=>isFinite(+v)));
  const fr=f=>okFr(f)?{o:f.o.map(Number),x:f.x.map(Number),y:f.y.map(Number),z:f.z.map(Number)}:null;
  return L.filter(s=>s&&ASM_HIST_K[s.k]&&typeof s.key==='string').map(s=>{
    const o={id:typeof s.id==='string'?s.id:uid('hs'),key:s.key,k:s.k};
    if(typeof s.occ==='string')o.occ=s.occ;if(typeof s.rel==='string')o.rel=s.rel;if(typeof s.pat==='string')o.pat=s.pat;
    const a=fr(s.fr0);if(a)o.fr0=a;const b=fr(s.fr1);if(b)o.fr1=b;
    return o;
  });
}
function asmHistSerial(c){
  if(!Array.isArray(c.hist)||!c.hist.length)return undefined;
  return c.hist.map(s=>{const o={id:s.id,key:s.key,k:s.k};['occ','rel','pat'].forEach(q=>{if(s[q])o[q]=s[q];});
    if(s.fr0)o.fr0=asmRound(s.fr0);if(s.fr1)o.fr1=asmRound(s.fr1);return o;});
}
function asmHistSeenOf(c){const m={};(c.occ||[]).forEach(o=>{m[o.id]=asmHistFr(o.fr);});return m;}
function asmHistReset(){
  // Après une ouverture, un Ctrl+Z… : l'état présent devient la référence, sans étape nouvelle
  asmHistSeen=new Map();if(!asm)return;
  asm.comps.forEach(c=>{asmHistOf(c);asmHistSeen.set(c.id,asmHistSeenOf(c));});
}
function asmHistSync(c){
  const migrated=!Array.isArray(c.hist);
  const H=asmHistOf(c),seen=asmHistSeen.get(c.id);
  if(migrated||!seen){asmHistSeen.set(c.id,asmHistSeenOf(c));return;}
  const by=new Map(c.occ.map(o=>[o.id,o])),P=asmHistPresent(c),keys=new Set(P.map(s=>s.key));
  // 1. étapes dont l'objet a disparu (occurrence supprimée, relation retirée, liaison supprimée…)
  const kept=H.filter(s=>s.k==='move'?(by.has(s.occ)&&!by.get(s.occ).pat):keys.has(s.key));
  const have=new Set(kept.map(s=>s.key)),touched=new Set();
  // 2. étapes nouvelles, à la fin, dans l'ordre de l'état
  P.forEach(s=>{if(have.has(s.key))return;
    const o=s.occ&&by.get(s.occ),f0=o?(seen[o.id]||o.fr):null;
    kept.push(Object.assign({id:uid('hs')},s,{fr0:asmHistFr(f0)}));if(s.occ)touched.add(s.occ);});
  // 3. déplacement à la main d'une pièce libre (ni liaison, ni relation, ni fixée)
  c.occ.forEach(o=>{
    if(o.pat||o.align||o.fixed||(Array.isArray(o.cons)&&o.cons.length)||touched.has(o.id))return;
    const f0=seen[o.id];if(!f0||asmHistFrEq(f0,o.fr))return;
    const last=kept[kept.length-1];
    if(last&&last.k==='move'&&last.occ===o.id)last.fr1=asmHistFr(o.fr); // gestes à la suite : une seule étape
    else kept.push({id:uid('hs'),key:'move:'+uid('mv'),k:'move',occ:o.id,fr0:asmHistFr(f0),fr1:asmHistFr(o.fr)});
  });
  c.hist=kept;
  asmHistSeen.set(c.id,asmHistSeenOf(c));
}
function asmHistSyncAll(){
  if(!asm||asmHistView)return;
  asm.comps.forEach(c=>{try{asmHistSync(c);}catch(e){}});
}
/* ── marqueur : revoir l'assemblage tel qu'il était ── */
function asmHistApply(c,ptr){
  const H=asmHistOf(c),after=H.slice(ptr),by=new Map(c.occ.map(o=>[o.id,o]));
  c.occ.forEach(o=>{o._histReal={fr:o.fr,visible:o.visible,align:o.align,cons:o.cons};});
  const first=new Map();
  after.forEach(s=>{
    if(s.occ&&!first.has(s.occ))first.set(s.occ,s);
    const o=s.occ&&by.get(s.occ);
    if(s.k==='ins'&&o)o.visible=false;
    else if(s.k==='join'&&o)o.align=null;
    else if(s.k==='rel'&&o&&Array.isArray(o.cons)){const L=o.cons.filter(r=>r.id!==s.rel);o.cons=L.length?L:undefined;}
    else if(s.k==='pat')c.occ.forEach(q=>{if(q.pat&&q.pat.id===s.pat)q.visible=false;});
  });
  first.forEach((s,id)=>{const o=by.get(id);if(o&&s.fr0)o.fr=asmHistFr(s.fr0);});
}
function asmHistUnapply(c){
  (c&&c.occ||[]).forEach(o=>{const R=o._histReal;if(!R)return;
    o.fr=R.fr;o.visible=R.visible;o.align=R.align;if(R.cons)o.cons=R.cons;else delete o.cons;delete o._histReal;});
}
function asmHistExit(){
  // Marqueur remis en fin d'historique : l'état réel revient tel quel
  if(!asmHistView)return false;
  const c=asm&&asmComp(asmHistView.comp);asmHistView=null;
  if(c){asmHistUnapply(c);try{asmResolve();}catch(e){}}
  asmHistReset();
  return true;
}
function asmHistSetPtr(ptr){
  // ptr = nombre d'étapes appliquées ; null ou ≥ longueur = fin (état réel)
  if(!asm)return;
  const c=asmActiveComp();if(!c)return;
  if(!asmHistView)asmHistSyncAll();
  const H=asmHistOf(c);
  if(ptr==null||ptr>=H.length){if(asmHistExit())asmNotify(true);return;}
  ptr=Math.max(0,ptr|0);
  if(asmHistView&&asmHistView.comp!==c.id)asmHistExit();
  if(asmHistView)asmHistUnapply(c);
  asmHistApply(c,ptr);asmHistView={comp:c.id,ptr};
  try{asmResolve();}catch(e){}
  asmNotify(true);
  try{faceEl.textContent='⏱ Assemblage revu à l’étape '+ptr+' / '+H.length+' — vue seulement : toute modification revient en fin d’historique.';}catch(e){}
}
function asmHistPtr(){const c=asm&&asmActiveComp();if(!c)return 0;const n=asmHistOf(c).length;return asmHistView&&asmHistView.comp===c.id?asmHistView.ptr:n;}
function asmHistStep(dir){
  const c=asm&&asmActiveComp();if(!c)return;
  const n=asmHistOf(c).length,p=asmHistPtr();
  asmHistSetPtr(dir===-2?0:dir===2?n:Math.max(0,Math.min(n,p+dir)));
}
/* ── nom, icône, clic des étapes ── */
function asmHistOcc(c,s){const o=s.occ&&c.occ.find(q=>q.id===s.occ);return o||null;}
function asmHistName(c,s){
  const o=asmHistOcc(c,s),nm=o?'« '+o.name+' »':'';
  if(s.k==='ins')return 'Insertion '+nm;
  if(s.k==='join'){const a=o&&((o._histReal&&o._histReal.align)||o.align);
    const t=a&&a.type&&ASM_JOINTS[a.type]?ASM_JOINTS[a.type].lab:'Rigide';return 'Liaison '+t+' — '+nm;}
  if(s.k==='rel'){const L=o?((o._histReal?o._histReal.cons:o.cons)||[]):[],k=L.find(r=>r.id===s.rel);
    return 'Relation '+(k&&ASM_CONS[k.t]?ASM_CONS[k.t].lab:'')+' — '+nm;}
  if(s.k==='pat'){const p=(c.pats||[]).find(q=>q.id===s.pat);return 'Répétition '+(p?'« '+(typeof asmPatName==='function'?asmPatName(p):p.name||'')+' »':'');}
  return 'Déplacement '+nm;
}
function asmHistIcon(c,s){
  if(s.k==='rel'){const o=asmHistOcc(c,s),L=o?((o._histReal?o._histReal.cons:o.cons)||[]):[],k=L.find(r=>r.id===s.rel);
    return '🧲<small>'+(k&&ASM_CONS[k.t]?ASM_CONS[k.t].ic:'')+'</small>';}
  return ASM_HIST_K[s.k].ic;
}
function asmHistClick(c,s){
  if(s.occ&&asmHistOcc(c,s)){asmSelId=s.occ;try{asmDraw();asmGizmoDraw();renderTree();renderProps();}catch(e){}}
}
function asmHistDbl(c,s){
  // double-clic = modifier : revient d'abord en fin d'historique
  if(asmHistExit())asmNotify(true);
  const o=asmHistOcc(c,s);
  if(s.k==='rel'&&o){asmRelStart(o.id);const i=(asmRel&&asmRel.list||[]).findIndex(r=>r.id===s.rel);if(i>=0)asmRelEdit(i);return;}
  asmHistClick(c,s);
}
/* ── bandeau en bas de la vue, en mode Assembler (même dessin que celui des pièces, 41) ── */
let asmTlEl=null,asmTlDrag=null;
function asmTlHost(){
  if(asmTlEl)return asmTlEl;
  const vp=document.getElementById('vpwrap');if(!vp)return null;
  try{ // style du bandeau des pièces (41), recopié pour celui-ci, visible en mode Assembler seulement
    const src=document.getElementById('tlbCss'),st=document.createElement('style');st.id='asmTlCss';
    st.textContent=(src?src.textContent.replace(/#mfTl/g,'#asmTl'):'')+
      'body:not([data-asm="1"]) #asmTl{display:none!important}'+
      'body.ui-modern[data-ws="cao"][data-asm="1"]:not(.mf-sk) #asmTl{display:flex}'+
      'body.ui-modern[data-ws="cao"][data-asm="1"] #treeOverlay{max-height:calc(100% - 108px)}'+
      '#asmTl .tlbS small{font-size:.62rem;margin-left:1px;opacity:.8}'+
      '#asmTl .tlbS.k-rel{background:rgba(10,132,255,.13)}#asmTl .tlbS.k-move{border-style:dashed}#asmTl .tlbS.k-pat{background:rgba(48,209,88,.12)}';
    document.head.appendChild(st);
  }catch(e){}
  const d=document.createElement('div');d.id='asmTl';
  const C=document.createElement('div');C.className='tlbC';
  [['⏮',-2,'Marqueur au début de l’assemblage'],['◀',-1,'Marqueur une étape plus tôt'],['▶',1,'Marqueur une étape plus tard'],['⏭',2,'Marqueur en fin d’historique (assemblage réel)']].forEach(([t,k,h])=>{
    const b=document.createElement('button');b.textContent=t;b.title=h;b.onclick=()=>asmHistStep(k);C.appendChild(b);});
  const T=document.createElement('span');T.className='tlbK';T.textContent='🧩 Assemblage';
  const R=document.createElement('div');R.className='tlbR';
  const N=document.createElement('span');N.className='tlbN';
  d.appendChild(C);d.appendChild(T);d.appendChild(R);d.appendChild(N);
  d._row=R;d._cnt=N;d._steps=[];d._title=T;
  ['pointerdown','mousedown','dblclick','contextmenu'].forEach(t=>d.addEventListener(t,e=>{try{e.stopPropagation();}catch(_){}}));
  d.addEventListener('wheel',e=>{try{e.stopPropagation();if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){R.scrollLeft+=e.deltaY;e.preventDefault();}}catch(_){}},{passive:false});
  window.addEventListener('pointermove',e=>{const D=asmTlDrag;if(!D||!asmTlEl)return;
    if(!D.on){if(Math.abs(e.clientX-D.x0)<5)return;D.on=true;D.node.className='tlbM on';}
    D.gap=asmTlGapAt(e.clientX);const L=asmTlEl._steps;try{R.insertBefore(D.node,D.gap<L.length?L[D.gap]:null);}catch(_){}});
  window.addEventListener('pointerup',()=>{const D=asmTlDrag;asmTlDrag=null;if(!D||!D.on)return;asmHistSetPtr(D.gap);asmTlRender();});
  vp.appendChild(d);asmTlEl=d;
  return d;
}
function asmTlGapAt(x){
  const L=asmTlEl?asmTlEl._steps:[];let g=0;
  for(const el of L){const r=el.getBoundingClientRect();if(x>r.left+r.width/2)g++;else break;}
  return g;
}
function asmTlRender(){
  if(typeof asm==='undefined'||!asm||asmMode!=='asm'){if(asmHistView)asmHistExit();return;}
  const h=asmTlHost();if(!h||asmTlDrag)return;
  const c=asmActiveComp();if(!c)return;
  if(asmHistView&&asmHistView.comp!==c.id)asmHistExit();
  if(!asmHistView)asmHistSyncAll();
  const H=asmHistOf(c),ptr=asmHistPtr(),R=h._row;
  R.innerHTML='';h._steps=[];
  h._title.textContent='🧩 '+c.name;
  const mk=()=>{const M=document.createElement('div');M.className='tlbM';
    M.title=ptr<H.length?'⏱ Marqueur — glisser pour revoir l’assemblage à une autre étape (au-delà : grisé) · double-clic = fin':'⏱ Marqueur (fin) — glisser vers la gauche pour revoir l’assemblage étape par étape';
    M.onpointerdown=e=>{if(e.button)return;asmTlDrag={x0:e.clientX,on:false,gap:ptr,node:M};try{e.preventDefault();}catch(_){}};
    M.ondblclick=()=>asmHistSetPtr(null);return M;};
  H.forEach((s,i)=>{
    if(i===ptr)R.appendChild(mk());
    const d=document.createElement('div'),o=asmHistOcc(c,s);
    d.className='tlbS k-'+s.k+(s.occ&&asmSelId===s.occ?' sel':'')+(i>=ptr?' off':'')+(o&&o.st==='warn'&&s.k!=='ins'&&s.k!=='move'?' warn':'');
    d.innerHTML='<span>'+asmHistIcon(c,s)+'</span>';
    d.title=(i+1)+'. '+asmHistName(c,s)+(i>=ptr?' — au-delà du marqueur':'')+'\nClic = sélectionner la pièce'+(s.k==='rel'?' · double-clic = modifier la relation':'');
    d.onclick=()=>asmHistClick(c,s);
    d.ondblclick=()=>asmHistDbl(c,s);
    R.appendChild(d);h._steps.push(d);
  });
  if(ptr>=H.length&&H.length)R.appendChild(mk());
  if(!H.length){const e=document.createElement('span');e.className='tlbE';e.textContent='Aucune étape — insérez un composant, puis posez-le (Relations, Aligner…).';R.appendChild(e);}
  h._cnt.textContent=H.length?(ptr<H.length?ptr+' / '+H.length:H.length)+' étape(s)':'';
}
