/* ---------- copier un corps (V0.76.1) ----------
   Fonction de la timeline {type:'bcopy', body, newBody}, comme « Copier / Coller » d'un corps
   dans Fusion 360 mais PARAMÉTRIQUE : la copie est le corps source TEL QU'IL EST à cet instant
   de la timeline. Ce qui est ajouté au source APRÈS l'étape n'entre pas dans la copie ; ce qui
   change AVANT (une cote, un congé) s'y retrouve. La copie naît dans un corps neuf, où l'on
   peut ensuite la déplacer, l'usiner, la combiner… comme n'importe quel corps.
   Même mécanique que l'Échelle « Nouveau corps » (85-echelle-corps) : occSplitNewBody (20),
   rejeu de l'historique du source jusqu'à l'étape (occCombineTool), facteur 1 (identité).
   V0.78.0 — OPTIONS : f.mode 'place' (copie en place, défaut des anciens fichiers) | 'mirror1'
   (symétrie par f.plane) | 'mirror2' (symétrie par f.plane ET f.plane2 : 3 copies, la 3e par les
   deux plans). Plans : 'YZ' | 'XZ' | 'XY' (origine) ou 'cg:<id>' (plan de construction).
   f.union (symétrie seulement) : les copies sont réunies au corps source lui-même — AUCUN corps
   neuf, un seul corps issu de la symétrie. Sans union : un corps neuf par copie (f.newBody, puis
   f.newBodies pour les copies 2 et 3 en symétrie double ; occNewBodies, 20). */
const BC_PLN={YZ:[1,0,0],XZ:[0,1,0],XY:[0,0,1]};
function bcMode(f){return f&&(f.mode==='mirror1'||f.mode==='mirror2')?f.mode:'place';}
function bcUnion(f){return bcMode(f)!=='place'&&!!f.union;}
function bcPlaneVal(v){return (BC_PLN[v]||/^cg:/.test(v||''))?v:'YZ';}
function bcPlanes(f){
  // plans de la symétrie (valeurs) : 0, 1 ou 2
  const m=bcMode(f);if(m==='place')return [];
  const a=bcPlaneVal(f.plane);if(m==='mirror1')return [a];
  let b=bcPlaneVal(f.plane2);if(b===a)b=a==='XZ'?'YZ':'XZ';
  return [a,b];
}
function bcPlaneOf(v){
  // {o,n} monde, ou null (plan de construction supprimé)
  if(BC_PLN[v])return {o:[0,0,0],n:BC_PLN[v].slice()};
  if(/^cg:/.test(v||'')){
    const c=(doc.cgeo||[]).find(x=>x&&x.id===v.slice(3));
    if(c&&c.fr&&c.fr.o&&c.fr.z){const n=c.fr.z,l=Math.hypot(n[0],n[1],n[2])||1;return {o:c.fr.o.slice(),n:n.map(x=>x/l)};}
  }
  return null;
}
function bcPlaneLabel(v){
  if(BC_PLN[v])return v;
  const c=/^cg:/.test(v||'')&&(doc.cgeo||[]).find(x=>x&&x.id===v.slice(3));
  return c?c.name:'plan supprimé';
}
function bcPlaneOptions(){
  const o=[['YZ','Plan YZ (X → −X)'],['XZ','Plan XZ (Y → −Y)'],['XY','Plan XY (Z → −Z)']];
  (doc.cgeo||[]).forEach(c=>{if(c&&c.kind==='plane'&&c.fr)o.push(['cg:'+c.id,'▱ '+c.name]);});
  return o;
}
function bcSig(f){
  // partie de la signature (cache, 20) propre aux options ; vide en copie simple (cache des anciens fichiers gardé)
  if(bcMode(f)==='place')return '';
  const r=v=>Math.round(v*1e6)/1e6;
  return '|'+bcMode(f)+'|u'+(bcUnion(f)?1:0)+'|'+bcPlanes(f).map(v=>{const P=bcPlaneOf(v);return v+':'+(P?P.o.concat(P.n).map(r).join(','):'?');}).join('/');
}
function bcName(f){
  const src='« '+bmBodyName(f.body)+' »',m=bcMode(f);
  if(m==='place')return 'Copie de '+src;
  const pl=bcPlanes(f).map(bcPlaneLabel).join(' + ');
  return bcUnion(f)?'Symétrie '+pl+' de '+src+' (unie)':'Copie en symétrie '+pl+' de '+src;
}
function bcCopyCount(f){return bcUnion(f)?0:(bcMode(f)==='mirror2'?3:1);}
function bcBodyLabel(f,k){
  // nom d'un corps neuf : « Pièce (copie) », « Pièce (symétrie YZ) », « Pièce (symétrie YZ + XZ) »
  const P=bcPlanes(f).map(bcPlaneLabel),m=bcMode(f);
  const t=m==='place'?'copie':'symétrie '+(m==='mirror1'?P[0]:(k===2?P[0]+' + '+P[1]:P[k]));
  return bmBodyName(f.body)+' ('+t+')';
}
function bcMirror(shape,P){
  // copie en miroir (le solide d'entrée est gardé)
  let p=null,d=null,a=null,t=null,b=null;
  try{
    p=new occt.gp_Pnt_3(P.o[0],P.o[1],P.o[2]);d=new occt.gp_Dir_4(P.n[0],P.n[1],P.n[2]);a=new occt.gp_Ax2_3(p,d);
    t=new occt.gp_Trsf_1();t.SetMirror_3(a);
    b=new occt.BRepBuilderAPI_Transform_2(shape,t,true);
    const m=b.Shape();if(!m||m.IsNull())throw new Error('copie en miroir vide');
    try{nomsMemeRangs(shape,m);}catch(e){}
    return m;
  }finally{[b,t,a,d,p].forEach(o=>{try{if(o)o.delete();}catch(e){}});}
}
function occApplyBodyCopy(src,f,k){
  // Rejeu (20) : {shape, warnings}. k = rang du corps neuf rejoué (0, 1, 2), -1 = union dans le
  // corps source. Le solide d'entrée est libéré si l'opération réussit.
  const m=bcMode(f);
  if(m==='place')return {shape:src,warnings:[]};
  const P=bcPlanes(f).map(bcPlaneOf);
  if(P.some(x=>!x))return {shape:src,warnings:['plan de symétrie introuvable (plan de construction supprimé ?) — rien n’est fait'],fatal:true};
  const tmp=[];
  try{
    if(k>=0&&!bcUnion(f)){
      let s;
      if(m==='mirror1'||k===0)s=bcMirror(src,P[0]);
      else if(k===1)s=bcMirror(src,P[1]);
      else{const h=bcMirror(src,P[1]);tmp.push(h);s=bcMirror(h,P[0]);}
      try{src.delete();}catch(e){}
      return {shape:s,warnings:[]};
    }
    // union : le corps et ses copies en miroir, réunis en un seul corps
    const L=[bcMirror(src,P[0])];
    if(m==='mirror2'){L.push(bcMirror(src,P[1]));L.push(bcMirror(L[1],P[0]));}
    tmp.push(...L);
    let cur=src;
    for(const x of L){const nx=occFuse(cur,x);if(cur!==src)tmp.push(cur);cur=nx;}
    const u=occUnify(cur);if(!u||u.IsNull())throw new Error('réunion vide');
    try{src.delete();}catch(e){}
    return {shape:u,warnings:[]};
  }catch(e){
    return {shape:src,warnings:['symétrie impossible ('+((e&&e.message)||e)+')'],fatal:true};
  }finally{tmp.forEach(o=>{try{o.delete();}catch(e){}});}
}
function bodyHasMatter(id){
  // un corps porte de la matière s'il a une fonction à lui ou s'il est né d'une copie / scission
  return (doc.features||[]).some(f=>f&&f.visible!==false&&(f.body===id||occNewBodies(f).indexOf(id)>=0));
}
function bcNewBodyFor(src,label){
  try{ensureBodies();}catch(e){}
  const n=doc.bodySeq++;
  const e={id:'b'+n,name:label||(bmBodyName(src)+' (copie)'),c:null};
  doc.bodies.push(e);return e.id;
}
function bcBodyFree(f,nb){
  // un corps neuf qui ne sert plus à f est retiré s'il ne porte rien d'autre
  if(!nb||doc.features.some(x=>x!==f&&(x.body===nb||(x.type==='combine'&&(x.tools||[]).indexOf(nb)>=0)||x.newBody===nb||(Array.isArray(x.newBodies)&&x.newBodies.indexOf(nb)>=0))))return;
  doc.bodies=(doc.bodies||[]).filter(b=>b.id!==nb);
  if(doc.activeBody===nb&&doc.bodies.length)doc.activeBody=doc.bodies[0].id;
}
const BC_AUTO_RE=/ \((copie|symétrie [^)]*)\)$/;
function bcSyncBodies(f){
  // autant de corps neufs que de copies (0 en union) ; noms automatiques tenus à jour
  const want=bcCopyCount(f);
  const cur=[f.newBody].concat(Array.isArray(f.newBodies)?f.newBodies:[]).filter(b=>b&&(doc.bodies||[]).some(e=>e.id===b));
  while(cur.length>want)bcBodyFree(f,cur.pop());
  while(cur.length<want)cur.push(bcNewBodyFor(f.body,bcBodyLabel(f,cur.length)));
  cur.forEach((b,k)=>{
    const e=doc.bodies.find(x=>x.id===b);
    if(e&&BC_AUTO_RE.test(e.name))e.name=bcBodyLabel(f,k); // nom donné par l'utilisateur : gardé
  });
  if(cur.length)f.newBody=cur[0];else delete f.newBody;
  if(cur.length>1)f.newBodies=cur.slice(1);else delete f.newBodies;
}
function bcSourceChoices(f){
  // corps copiables à l'instant de la timeline où se trouve f (ou au marqueur, f absent)
  const i=f?doc.features.indexOf(f):tlIdx();
  const mine=f?occNewBodies(f):[];
  const L=(doc.bodies||[]).filter(e=>{
    if(mine.indexOf(e.id)>=0)return false;
    try{if(!bodyBornAt(e.id,i))return false;}catch(err){}
    try{if(bodyConsumedBy(e.id,i))return false;}catch(err){}
    const pre=i<0?doc.features:doc.features.slice(0,i);
    return pre.some(x=>x&&x.visible!==false&&(x.body===e.id||occNewBodies(x).indexOf(e.id)>=0));
  });
  if(f&&!L.some(e=>e.id===f.body)){const e=(doc.bodies||[]).find(x=>x.id===f.body);if(e)L.unshift(e);}
  return L;
}
/* ── commande ── */
function openBodyCopy(bid,opt){
  // opt (facultatif) : {mode, plane, plane2, union} — sinon copie en place, réglable au panneau
  try{ensureBodies();}catch(e){}
  const id=bid&&(doc.bodies||[]).some(b=>b.id===bid)?bid:(doc.activeBody&&(doc.bodies||[]).some(b=>b.id===doc.activeBody)?doc.activeBody:((doc.bodies||[])[0]||{}).id);
  if(!id){try{faceEl.textContent='Copier : aucun corps.';}catch(e){}return null;}
  if(!bcSourceChoices(null).some(e=>e.id===id)){
    try{faceEl.textContent='Copier : « '+bmBodyName(id)+' » est vide (ou pas encore créé, ou retiré) à cet instant de la timeline.';}catch(e){}
    return null;
  }
  try{bmPickExit(true);}catch(e){}
  const o=opt||{};
  const f={id:uid('bc'),type:'bcopy',name:'',body:id,mode:o.mode||'place',plane:o.plane||'YZ',plane2:o.plane2||'XZ',union:!!o.union,visible:true};
  f.name=bcName(f);
  addFeature(f); // au marqueur de la timeline : c'est l'instant copié (annulation incluse)
  bcSyncBodies(f);
  sel={kind:'feature',id:f.id};treeSel=[f.id];
  markDirty();rebuild();renderTree();renderProps();refreshParts();
  try{faceEl.textContent=f.newBody?'« '+bmBodyName(f.newBody)+' » : copie de « '+bmBodyName(id)+' » telle qu’elle est à cette étape de la timeline. Symétrie et union : dans le panneau.':f.name+'.';}catch(e){}
  return f;
}
/* ── panneau ── */
function bcopyProps(p,f){
  const mk=(tag,cls,txt)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(txt!=null)d.textContent=txt;return d;};
  const Row=(lab,ctl)=>{const r=mk('div','pnl-row');r.appendChild(mk('label',null,lab));r.appendChild(ctl);p.appendChild(r);return r;};
  const Sel=(opts,val,fn)=>{const s=document.createElement('select');opts.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(v===val)o.selected=true;s.appendChild(o);});s.onchange=()=>fn(s.value);return s;};
  const set=(label,fn)=>{
    docPushUndo(label+' (« '+f.name+' »)');
    fn();bcSyncBodies(f);f.name=bcName(f);
    markDirty();rebuild();renderTree();renderProps();refreshParts();
  };
  const m=bcMode(f);
  p.appendChild(mk('div','pnl-h','⧉ Copier un corps'));
  Row('Corps copié',Sel(bcSourceChoices(f).map(b=>[b.id,b.name]),f.body,v=>set('corps copié',()=>{f.body=v;})));
  Row('Copie',Sel([['place','En place (corps neuf)'],['mirror1','Symétrie par 1 plan'],['mirror2','Symétrie par 2 plans']],m,
    v=>set('type de copie',()=>{f.mode=v;if(v==='mirror2'&&bcPlaneVal(f.plane2)===bcPlaneVal(f.plane))f.plane2=bcPlaneVal(f.plane)==='XZ'?'YZ':'XZ';})));
  if(m!=='place'){
    const pv=bcPlanes(f),opts=bcPlaneOptions();
    Row(m==='mirror2'?'Plan 1':'Plan',Sel(opts,pv[0],v=>set('plan de la symétrie',()=>{f.plane=v;if(m==='mirror2'&&bcPlaneVal(f.plane2)===v)f.plane2=pv[0];})));
    if(m==='mirror2')Row('Plan 2',Sel(opts.filter(o=>o[0]!==pv[0]),pv[1],v=>set('2e plan de la symétrie',()=>{f.plane2=v;})));
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=bcUnion(f);
    cb.onchange=()=>set(cb.checked?'union de la symétrie':'symétrie en corps séparés',()=>{f.union=cb.checked;});
    const r=Row('Unir au corps',cb);r.title='Coché : les copies en miroir sont réunies au corps copié — aucun corps neuf, un seul corps. Décoché : chaque copie est un corps neuf.';
  }
  const nbs=occNewBodies(f);
  let note='';
  if(bcUnion(f))note='« '+bmBodyName(f.body)+' » et '+(m==='mirror2'?'ses 3 copies en miroir':'sa copie en miroir')+' sont réunis en un seul corps : aucun corps neuf. Tout ce qui précède dans le corps est pris, combinaisons et congés compris.';
  else if(nbs.length)note=(nbs.length>1?'Les copies sont dans ':'La copie est dans ')+nbs.map(b=>'« '+bmBodyName(b)+' »').join(', ')+'. '+(nbs.length>1?'Elles reprennent':'Elle reprend')+' « '+bmBodyName(f.body)+' » tel qu’il est à CETTE étape : ce qui lui est ajouté plus loin dans la timeline n’y entre pas.';
  if(note)p.appendChild(mk('div','pnl-note',note));
  if(f._err)p.appendChild(mk('div','pnl-note','⚠ '+f._err));
  if(!nbs.length)return;
  const b=mk('div','pnl-btns');
  nbs.forEach((nb,k)=>{
    const bt=mk('button','mini',nbs.length>1?'✥ Déplacer '+(k+1):'✥ Déplacer la copie…');
    bt.title='Ajoute une étape « Déplacer » sur « '+bmBodyName(nb)+' »';
    bt.onclick=()=>{
      // le déplacement doit venir APRÈS la copie : marqueur avancé juste derrière elle si besoin
      const i=doc.features.indexOf(f),m0=tlIdx();
      if(m0>=0&&m0<=i){const nx=doc.features[i+1];tlMark=nx?nx.id:null;}
      openBodyMove(nb);
    };
    b.appendChild(bt);
  });
  p.appendChild(b);
}
/* ── menus contextuels (arbre et vue) : « ⧉ Copier (timeline) » sur un corps ── */
const bcCtxBtns={};
function bcCtxSync(menuId,t){
  const m=document.getElementById(menuId);if(!m)return;
  let b=bcCtxBtns[menuId];
  if(!b){
    b=document.createElement('button');b.textContent='⧉ Copier (timeline)';
    b.title='Ajoute une étape « Copie » dans la timeline : un corps neuf, copie du corps tel qu’il est à cet instant';
    const mv=bmCtxBtns[menuId];
    // jamais en dernier : l'export STEP reste la dernière entrée (test_ctx_menu_viewport)
    let step=null;try{step=menuId==='ctxMenu3D'?ctxStepBtn3d:ctxStepBtn;}catch(e){}
    if(mv&&mv.parentNode===m)m.insertBefore(b,mv);else m.insertBefore(b,step&&step.parentNode===m?step:null);
    b.onclick=()=>{const T=b._t;try{hideCtx();hideCtx3D();}catch(e){}if(T)openBodyCopy(ctxBodyId(T)||T.id);};
    bcCtxBtns[menuId]=b;
  }
  b._t=t;
  b.style.display=(t&&t.kind==='body'&&t.id&&(menuId==='ctxMenu'||asmMode!=='asm'))?'':'none';
}
// bouton (rangé dans « Ensembles » par 96-bandeau-groupes ; ruban moderne : 97)
(function(){
  try{
    if(document.getElementById('btnBodyCopy'))return;
    const ref=document.getElementById('btnBody')||document.getElementById('btnExtrude');
    if(!ref||!ref.parentNode)return;
    const b=document.createElement('button');b.id='btnBodyCopy';b.textContent='⧉ Copier un corps';
    b.title='Copie du corps actif à l’instant du marqueur de la timeline (étape « Copie », corps neuf)';
    b.onclick=()=>{const t=(typeof sel!=='undefined'&&sel&&sel.kind==='body')?sel.id:null;openBodyCopy(t);};
    ref.parentNode.insertBefore(b,ref.nextSibling);
  }catch(e){}
})();
