/* ---------- copier un corps (V0.76.1) ----------
   Fonction de la timeline {type:'bcopy', body, newBody}, comme « Copier / Coller » d'un corps
   dans Fusion 360 mais PARAMÉTRIQUE : la copie est le corps source TEL QU'IL EST à cet instant
   de la timeline. Ce qui est ajouté au source APRÈS l'étape n'entre pas dans la copie ; ce qui
   change AVANT (une cote, un congé) s'y retrouve. La copie naît dans un corps neuf, où l'on
   peut ensuite la déplacer, l'usiner, la combiner… comme n'importe quel corps.
   Même mécanique que l'Échelle « Nouveau corps » (85-echelle-corps) : occSplitNewBody (20),
   rejeu de l'historique du source jusqu'à l'étape (occCombineTool), facteur 1 (identité). */
function bcName(f){return 'Copie de « '+bmBodyName(f.body)+' »';}
function bodyHasMatter(id){
  // un corps porte de la matière s'il a une fonction à lui ou s'il est né d'une copie / scission
  return (doc.features||[]).some(f=>f&&f.visible!==false&&(f.body===id||occSplitNewBody(f)===id));
}
function bcNewBodyFor(src){
  try{ensureBodies();}catch(e){}
  const n=doc.bodySeq++;
  const e={id:'b'+n,name:bmBodyName(src)+' (copie)',c:null};
  doc.bodies.push(e);return e.id;
}
function bcSourceChoices(f){
  // corps copiables à l'instant de la timeline où se trouve f (ou au marqueur, f absent)
  const i=f?doc.features.indexOf(f):tlIdx();
  const L=(doc.bodies||[]).filter(e=>{
    if(f&&e.id===f.newBody)return false;
    try{if(!bodyBornAt(e.id,i))return false;}catch(err){}
    try{if(bodyConsumedBy(e.id,i))return false;}catch(err){}
    const pre=i<0?doc.features:doc.features.slice(0,i);
    return pre.some(x=>x&&x.visible!==false&&(x.body===e.id||occSplitNewBody(x)===e.id));
  });
  if(f&&!L.some(e=>e.id===f.body)){const e=(doc.bodies||[]).find(x=>x.id===f.body);if(e)L.unshift(e);}
  return L;
}
/* ── commande ── */
function openBodyCopy(bid){
  try{ensureBodies();}catch(e){}
  const id=bid&&(doc.bodies||[]).some(b=>b.id===bid)?bid:(doc.activeBody&&(doc.bodies||[]).some(b=>b.id===doc.activeBody)?doc.activeBody:((doc.bodies||[])[0]||{}).id);
  if(!id){try{faceEl.textContent='Copier : aucun corps.';}catch(e){}return null;}
  if(!bcSourceChoices(null).some(e=>e.id===id)){
    try{faceEl.textContent='Copier : « '+bmBodyName(id)+' » est vide (ou pas encore créé, ou retiré) à cet instant de la timeline.';}catch(e){}
    return null;
  }
  try{bmPickExit(true);}catch(e){}
  const f={id:uid('bc'),type:'bcopy',name:'',body:id,visible:true};
  f.name=bcName(f);
  addFeature(f); // au marqueur de la timeline : c'est l'instant copié (annulation incluse)
  f.newBody=bcNewBodyFor(id);
  sel={kind:'feature',id:f.id};treeSel=[f.id];
  markDirty();rebuild();renderTree();renderProps();refreshParts();
  try{faceEl.textContent='« '+bmBodyName(f.newBody)+' » : copie de « '+bmBodyName(id)+' » telle qu’elle est à cette étape de la timeline.';}catch(e){}
  return f;
}
/* ── panneau ── */
function bcopyProps(p,f){
  const mk=(tag,cls,txt)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(txt!=null)d.textContent=txt;return d;};
  p.appendChild(mk('div','pnl-h','⧉ Copier un corps'));
  const r=mk('div','pnl-row');r.appendChild(mk('label',null,'Corps copié'));
  const sb=document.createElement('select');
  bcSourceChoices(f).forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=b.name;if(b.id===f.body)o.selected=true;sb.appendChild(o);});
  sb.onchange=()=>{
    docPushUndo('corps copié (« '+f.name+' »)');
    f.body=sb.value;f.name=bcName(f);
    markDirty();rebuild();renderTree();renderProps();refreshParts();
  };
  r.appendChild(sb);p.appendChild(r);
  if(f.newBody)p.appendChild(mk('div','pnl-note','La copie est dans « '+bmBodyName(f.newBody)+' ». Elle reprend « '+bmBodyName(f.body)+' » tel qu’il est à CETTE étape : ce qui lui est ajouté plus loin dans la timeline n’entre pas dans la copie.'));
  if(f._err)p.appendChild(mk('div','pnl-note','⚠ '+f._err));
  const b=mk('div','pnl-btns');
  const bt=mk('button','mini','✥ Déplacer la copie…');bt.title='Ajoute une étape « Déplacer » sur le corps copié';
  bt.onclick=()=>{
    if(!f.newBody)return;
    // le déplacement doit venir APRÈS la copie : marqueur avancé juste derrière elle si besoin
    const i=doc.features.indexOf(f),m=tlIdx();
    if(m>=0&&m<=i){const nx=doc.features[i+1];tlMark=nx?nx.id:null;}
    openBodyMove(f.newBody);
  };
  b.appendChild(bt);p.appendChild(b);
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
