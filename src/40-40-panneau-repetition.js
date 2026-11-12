function repPickedDir(faceOnly){
  // Direction choisie dans la vue : ARÊTE sélectionnée (droite : sa direction ; cercle / arc : son
  // axe), sinon normale de la FACE sélectionnée. faceOnly : symétrie (un plan = une normale de face).
  // → {a:[x,y,z], what} | null
  try{
    if(!faceOnly&&typeof selEdges!=='undefined'&&selEdges&&selEdges.length){
      const G=selEdges[selEdges.length-1].G;
      const v=G&&(G.kind==='line'?G.u:(G.kind==='circle'?G.axis:null));
      if(v)return {a:[v.x,v.y,v.z],what:G.kind==='line'?'arête':(G.closed?'axe du cercle':'axe de l’arc')};
    }
    if(selFaces&&selFaces.length){const s=selFaces[0],n=faceNormalWorld(s.mesh,s.faceIndex);if(n)return {a:[n.x,n.y,n.z],what:'face'};}
  }catch(e){}
  try{faceEl.textContent=faceOnly?'Sélectionnez d’abord une face (clic dans la vue).':'Sélectionnez d’abord une face ou une arête (clic dans la vue).';}catch(e){}
  return null;
}
function repFlipDir(rp,which){
  // Inverse une direction (le sens d'une arête choisie est arbitraire) : la direction devient
  // explicite (« Face / arête ») et opposée — X/Y/Z compris ; circulaire : sens de rotation inversé
  docPushUndo('inverser la direction de « '+rp.name+' »');
  if(which===2){rp.dir2=repScale(repAxis2Vec(rp),-1);rp.axis2='Face';}
  else{rp.dir=repScale(repAxisVec(rp),-1);rp.axis='Face';}
  repGenChildren(rp);markDirty();rebuild();renderTree();renderProps();refreshParts();
}
function repUseFaceFor(rp,which){
  // which 3 : direction de l'étape Linéaire d'une symétrie (arête ou face, comme une linéaire)
  const P=repPickedDir(rp.mode==='mir'&&which!==3);if(!P)return;
  const a=P.a;
  docPushUndo('direction de « '+rp.name+' »');
  try{faceEl.textContent=(which===2?'2ᵉ direction':(rp.mode==='mir'&&which!==3?'Plan':'Direction'))+' : '+P.what+' sélectionnée.';}catch(e){}
  if(which===3){rp.axis='Face';rp.dir=a;}
  else if(rp.mode==='mir'){
    if(which===2){rp.plane2='Face';rp.planeN2=a;}
    else{rp.plane='Face';rp.planeN=a;}
  }else if(which===2){rp.axis2='Face';rp.dir2=a;}else{rp.axis='Face';rp.dir=a;}
  repGenChildren(rp);markDirty();rebuild();renderTree();renderProps();refreshParts();
}
function applyRepPattern(){
  if(!repMode)return;
  const ids=(repMode.feats||[]).filter(id=>repCanFeature(id)&&repAmont(id,null));
  if(!ids.length){faceEl.textContent='Répétition : cochez au moins une fonction à répéter dans la liste ci-dessus.';return;}
  const base=ids.map(id=>doc.features.find(f=>f.id===id)).filter(Boolean).sort((a,b)=>doc.features.indexOf(a)-doc.features.indexOf(b));
  // La répétition devient une FONCTION réelle (type 'repeat') : elle garde ses paramètres,
  // ses fonctions sources (base) et ses instances (children, créées par repGenChildren).
  const rp={id:uid('rp'),type:'repeat',name:repTypeName(repMode.type,repMode),mode:repMode.type,
    copies:repMaxCopies(repMode.copies),q:1,dist:repMode.dist,angle:repMode.angle,
    axis:repMode.axis,plane:repMode.plane,dir:repMode.dir,planeN:repMode.planeN,
    plane2:repMode.plane2||undefined,planeN2:repMode.planeN2||undefined,
    mlin:repMode.type==='mir'&&repMode.mlin?true:undefined,
    lin2:repMode.type==='lin'&&repMode.lin2?true:undefined,axis2:repMode.type==='lin'&&repMode.lin2?repMode.axis2:undefined,
    dir2:repMode.type==='lin'&&repMode.lin2?repMode.dir2:undefined,copies2:repMode.type==='lin'&&repMode.lin2?repMaxCopies(repMode.copies2):undefined,
    dist2:repMode.type==='lin'&&repMode.lin2?(+repMode.dist2||0):undefined,
    op:repMode.op==='new'?'new':undefined,
    skip:repMode.type!=='mir'&&Array.isArray(repMode.skip)&&repMode.skip.length?repMode.skip.slice():undefined,
    base:base.map(f=>f.id),children:[],visible:true};
  if(repMode.type==='path'){
    if(!repMode.path||!repMode.path.sk){faceEl.textContent='Répétition suivant un profil : choisissez l’esquisse guide.';return;}
    rp.path=Object.assign({},repMode.path);rp.pspace=repMode.pspace==='pitch'?'pitch':'fit';rp.orient=repMode.orient==='tangent'?'tangent':'fixed';
    if(repMode.rev)rp.rev=true;delete rp.axis;delete rp.angle;
  }
  parFxCopy(repMode,rp,(repMode.type==='mir'?(repMode.mlin?['qty','dist']:[]):['qty']).concat(repMode.type==='circ'?['angle']:(repMode.type==='lin'?(repMode.lin2?['dist','dist2','qty2']:['dist']):(repMode.type==='path'&&repMode.pspace==='pitch'?['dist']:[]))));
  addFeature(rp);
  const nb=repGenChildren(rp);
  exitRepMode();
  sel={kind:'feature',id:rp.id};
  markDirty();rebuild();renderTree();renderProps();refreshParts();
  faceEl.textContent='Répétition : '+nb+' fonction(s) copiée(s) — « '+rp.name+' » — les sources se cochent dans le panneau, à la création comme à l\'édition.';
}
function repUseSelectedFace(){
  if(!repMode)return;
  const P=repPickedDir(repMode.type==='mir');if(!P)return;
  const a=P.a;
  if(repMode.type==='mir'){repMode.plane='Face';repMode.planeN=a;}else{repMode.axis='Face';repMode.dir=a;}
  renderRepPanel();
}
function repUseSelectedLin(){
  // étape Linéaire d'une symétrie : direction de l'arête (ou normale de la face) sélectionnée
  if(!repMode)return;const P=repPickedDir(false);if(!P)return;
  repMode.axis='Face';repMode.dir=P.a;renderRepPanel();
}
function repUseSelectedFace2(){
  if(!repMode||(repMode.type!=='mir'&&repMode.type!=='lin'))return;
  const P=repPickedDir(repMode.type==='mir');if(!P)return;
  if(repMode.type==='lin'){repMode.axis2='Face';repMode.dir2=P.a;}
  else{repMode.plane2='Face';repMode.planeN2=P.a;}
  renderRepPanel();
}
const REP_OPS=[['join','➕ Unir','Les copies s’unissent au corps de leur source (un seul solide)'],
  ['new','◧ Nouveau corps','Chaque exemplaire devient un corps séparé (un par exemplaire et par corps source)']];
// Exemplaires « nouveau corps » sans matière : les découpes, congés, dépouilles copiés seuls
// tombent dans un corps vide — on le signale au lieu de laisser des corps fantômes muets.
function repNewBodyEmpty(rp){
  if(!repIsNewBody(rp))return false;
  const B=repExpandSources((rp.base||[]).map(id=>doc.features.find(x=>x.id===id)).filter(Boolean),new Set([rp.id]));
  return B.length>0&&!B.some(f=>(f.type==='extrude'||f.type==='revolve'||f.type==='sweep')&&(f.op||'add')!=='cut');
}
function repPathPickBtn(D,changed,cur){
  // 🎯 : départ choisi à la souris sur la courbe guide, dans la vue 3D (41-profil-choix-point)
  const b=document.createElement('button');b.className='mini repPathPick';b.textContent=pgPick?'✕ Annuler le choix':'🎯 Choisir dans la vue';b.style.cssText='padding:2px 8px;flex:none;white-space:nowrap';
  b.title='Choisir le départ à la souris : cliquez un point orange de la courbe guide dans la vue (Échap pour annuler)';
  b.onclick=()=>{
    if(pgPick){pgPickStop();b.textContent='🎯 Choisir dans la vue';try{faceEl.textContent='Choix du départ annulé.';}catch(e){}return;}
    if(pgPickStart(D,path=>changed(q=>{q.path=path;}),cur,()=>{b.textContent='🎯 Choisir dans la vue';}))b.textContent='✕ Annuler le choix';
  };
  return b;
}
function repPathUI(c,infoId,row,note,changed){
  // Réglages d'une répétition SUIVANT UN PROFIL, communs à la création et à l'édition :
  // esquisse guide, point de départ, espacement (réparti / pas imposé), orientation, sens.
  // changed(fn) : applique fn(c) puis rafraîchit le panneau (et les copies).
  const mkSel=(opts,v,fn)=>{const s=document.createElement('select');opts.forEach(([k,t])=>{const o=document.createElement('option');o.value=k;o.textContent=t;s.appendChild(o);});s.value=v;s.onchange=()=>fn(s.value);return s;};
  const G=pgGuideSketches(doc);
  if(!G.length){note('Aucune esquisse ne contient de ligne, d’arc ou de spline : dessinez la courbe guide (ou projetez des arêtes du 3D) dans une esquisse, avec un point sur la courbe pour le départ.');return;}
  const skId=c.path&&c.path.sk,sk=skId?doc.sketches.find(x=>x.id===skId):null;
  const ss=mkSel([['','— choisir —']].concat(G.map(x=>[x.id,x.name||x.id])),sk?sk.id:'',v=>changed(q=>{const k=doc.sketches.find(x=>x.id===v);q.path=k?pgDefaultPath(k):null;}));
  ss.className='repPathSk';ss.title='Esquisse qui porte la courbe guide (lignes, arcs, splines, arêtes projetées)';row('Courbe guide',ss);
  if(sk){
    const ch=pgStartChoices(sk),cur=ch.findIndex(o=>pgSameStart(o.v,c.path));
    const sd=mkSel(ch.map((o,i)=>[String(i),o.label]).concat(cur<0?[['-1','(départ actuel)']]:[]),String(cur),v=>changed(q=>{const o=ch[+v];if(o)q.path=Object.assign({sk:sk.id},o.v);}));
    sd.className='repPathStart';sd.title='Point d’accroche de l’original : point d’esquisse sur la courbe, extrémité (courbe ouverte), sommet ou milieu d’une ligne';
    row('Départ',sd);row('',repPathPickBtn(doc,changed,sk.id));
  }else row('Départ',repPathPickBtn(doc,changed,null)); // un clic sur un point choisit l'esquisse ET le départ
  const sp=mkSel([['fit','Réparti sur la longueur'],['pitch','Pas imposé']],c.pspace==='pitch'?'pitch':'fit',v=>changed(q=>{
    q.pspace=v;
    if(v==='pitch'&&!(+q.dist>0)){const I=repPathInfo.get(infoId);q.dist=I&&I.step>0?+I.step.toFixed(3):10;}
  }));
  sp.className='repPathSpace';row('Espacement',sp);
  if(c.pspace==='pitch'){
    const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';inp.value=c.dist;parFx(inp,c,'dist',{keep:1});
    inp.addEventListener('change',()=>{const v=parseFloat(String(inp.value).replace(',','.'));if(isFinite(v)&&v>0)changed(q=>{q.dist=v;});});
    row('Pas le long de la courbe (mm)',inp);
  }
  const so=mkSel([['fixed','Fixe (translation)'],['tangent','Suit la tangente']],c.orient==='tangent'?'tangent':'fixed',v=>changed(q=>{q.orient=v;}));
  so.className='repPathOrient';so.title='Fixe : les copies restent parallèles à l’original · Suit la tangente : elles tournent avec la courbe';row('Orientation',so);
  const bi=document.createElement('button');bi.textContent='⇄ Inverser le sens';bi.className='repPathRev';
  bi.title='Parcourir la courbe dans l’autre sens (utile avec un pas imposé, ou si le départ n’est pas une extrémité)';
  bi.onclick=()=>changed(q=>{if(q.rev)delete q.rev;else q.rev=true;});row('Sens',bi);
  try{repPathCells(Object.assign({},c,{id:infoId}));}catch(e){}
  const t=repPathNote({id:infoId});if(t)note(t);
  note('Courbe fermée : le départ est aussi l’arrivée — la dernière copie s’arrête un pas avant. Courbe ouverte : de l’extrémité de départ à l’autre. Quantité = original compris.');
}
// ✂ EXEMPLAIRES À ENLEVER (V0.81.0) : une case par copie (l'original, n° 1, n'en a pas) ; cochée =
// copie enlevée (cfg.skip, voir repCellKeys). Survol = l'exemplaire en bleu dans la vue.
// Partagé par la création (repMode) et l'édition. RÈGLE de repSourceList : le clic d'une case ne
// reconstruit jamais la liste qui la porte (compteur mis à jour sur place).
function repSkipFill(box,cfg,onToggle,ids){
  repHoverRemove();
  box.innerHTML='';box.className='repSkipBox';
  const L=(cfg.mode||cfg.type)==='mir'?[]:repCellKeys(cfg);
  box._sig=(cfg.mode||cfg.type)+'#'+L.map(x=>x.k).join('|');
  if(!L.length){box.style.display='none';return box;}
  box.style.display='';box.style.marginTop='6px';
  const sk=repSkipSet(cfg);
  const h=document.createElement('div');h.className='row';
  const t=document.createElement('span');t.innerHTML='<b>✂ Exemplaires à enlever</b>';h.appendChild(t);
  const cpt=document.createElement('span');cpt.className='note repSkipCpt';cpt.style.marginLeft='6px';h.appendChild(cpt);
  // option : les mêmes cases sous chaque copie, dans la vue 3D (40-45) — cachées par défaut
  const o3=document.createElement('label');o3.className='repSkip3dOpt';o3.style.cssText='margin-left:auto;display:inline-flex;align-items:center;gap:3px;cursor:pointer;font-size:.78rem';
  o3.title='Afficher une case à cocher sous chaque copie, dans la vue 3D (réglage retenu)';
  const c3=document.createElement('input');c3.type='checkbox';c3.checked=typeof rs3On!=='undefined'&&rs3On;c3.onchange=()=>rs3Set(c3.checked);
  o3.appendChild(c3);o3.appendChild(document.createTextNode('Cases dans la vue 3D'));h.appendChild(o3);
  box.appendChild(h);
  const maj=()=>{const n=repSkipSet(cfg).size;cpt.textContent=n?n+' enlevé(s) sur '+L.length:'aucun';};maj();
  const lst=document.createElement('div');lst.className='repSkipList';
  lst.style.cssText='display:flex;flex-wrap:wrap;gap:2px 8px;max-height:130px;overflow:auto;margin-top:2px';
  L.forEach(x=>{
    const l=document.createElement('label');l.title=x.tip+' — cochez pour l’enlever ; survolez pour le voir en bleu dans la vue';
    l.style.cssText='display:inline-flex;align-items:center;gap:2px;cursor:pointer;white-space:nowrap';
    const c=document.createElement('input');c.type='checkbox';c.checked=sk.has(x.k);c.dataset.k=x.k;
    c.onchange=()=>{
      const S=repSkipSet(cfg);if(c.checked)S.add(x.k);else S.delete(x.k);
      onToggle(S.size?[...S]:null);maj();
    };
    const n=document.createElement('span');n.textContent=x.label;
    l.appendChild(c);l.appendChild(n);
    l.onmouseenter=()=>repHoverShow(cfg,x.k,ids());l.onmouseleave=()=>repHoverRemove();
    lst.appendChild(l);
  });
  box.appendChild(lst);
  const no=document.createElement('span');no.className='note';
  no.textContent=((cfg.mode||cfg.type)==='lin'&&cfg.lin2?'Colonne·rangée ; ':'')+'n° 1 = l’original (toujours gardé). Les autres exemplaires ne bougent pas.';
  box.appendChild(no);
  return box;
}
// Création : la liste suit la quantité, le pas, la courbe… (appelé par repPreviewUpdate) — refaite
// seulement si la liste des exemplaires a changé, jamais pour un simple clic de case.
function repSkipBoxSync(){
  const b=document.querySelector('#props .repSkipBox');
  if(!b||!repMode)return;
  const L=repMode.type==='mir'?[]:repCellKeys(repMode);
  if(b._sig===repMode.type+'#'+L.map(x=>x.k).join('|'))return;
  repSkipFill(b,repMode,b._onT,b._ids);
}
function renderRepPanel(){
  const p=$('props');p.innerHTML='';if(!repMode)return;
  const h=document.createElement('div');h.innerHTML='<b>🔁 Répétition</b><br><span class="note">Choisissez les fonctions à répéter ci-dessous (cases à cocher). Dans l\'arbre, un <b>Ctrl+clic</b> sert désormais à la multi-suppression.<br>🔴 <b>Aperçu rouge</b> : les fonctions cochées, recopiées comme elles le seront (volume ajouté ou enlevé, faces des congés et dépouilles) — pour contrôler le plan, l\'axe ou le pas avant de valider. Une répétition cochée recopie son motif entier.</span>';p.appendChild(h);
  const row=document.createElement('div');row.className='row';
  const typ=document.createElement('select');[['lin','Linéaire'],['circ','Circulaire'],['mir','Symétrie'],['path','Suivant un profil']].forEach(o=>{const op=document.createElement('option');op.value=o[0];op.textContent=o[1];typ.appendChild(op);});typ.value=repMode.type;
  typ.onchange=()=>{repMode.type=typ.value;if(typ.value==='path'&&!repMode.path){const G=pgGuideSketches(doc);if(G.length)repMode.path=pgDefaultPath(G[G.length-1]);}renderRepPanel();};row.appendChild(typ);
  // 2026-10-23 : QUANTITÉ, original compris (6 = l'original + 5 copies) ; stocké : copies = quantité − 1
  // V0.31.1 : champ texte branché sur ƒx (« N », « N*2 », « N = 6 ») — la quantité est un nombre sans unité
  const cnt=repQtyInput((+repMode.copies||1)+1,'Quantité, original compris (6 = l’original + 5 copies)');
  if(repMode.type==='mir'){cnt.disabled=true;cnt.value=2;}
  else{parFx(cnt,repMode,'qty',{keep:1});cnt.onchange=()=>{repMode.copies=repMaxCopies(repQtyRead(cnt)-1);repPreviewUpdate();};}
  row.appendChild(cnt);p.appendChild(row);
  if(repMode.type==='path')repPathUI(repMode,'_rpEdit',
    (lab,ctl)=>{const r=document.createElement('div');r.className='row';const l=document.createElement('label');l.textContent=lab;r.appendChild(l);if(ctl)r.appendChild(ctl);p.appendChild(r);},
    t=>{const n=document.createElement('span');n.className='note';n.textContent=t;p.appendChild(n);},
    fn=>{fn(repMode);renderRepPanel();});
  else{
  const ax=document.createElement('select');['X','Y','Z','Face'].forEach(v=>{const op=document.createElement('option');op.value=v;op.textContent=(repMode.type==='mir'?(v==='X'?'YZ':v==='Y'?'XZ':v==='Z'?'XY':v):(v==='Face'?'Face / arête':v));ax.appendChild(op);});
  ax.value=repMode.type==='mir'?(repMode.plane==='XY'?'Z':repMode.plane==='XZ'?'Y':repMode.plane==='Face'?'Face':'X'):(repMode.axis||'X');
  ax.onchange=()=>{if(repMode.type==='mir'){repMode.plane=ax.value==='X'?'YZ':ax.value==='Y'?'XZ':ax.value==='Z'?'XY':'Face';delete repMode.planeN;}else{repMode.axis=ax.value;delete repMode.dir;}renderRepPanel();};p.appendChild(ax);
  const bf=document.createElement('button');bf.textContent=repMode.type==='mir'?'🎯 Face sélectionnée → plan':'🎯 Face / arête sélectionnée → direction';
  bf.title=repMode.type==='mir'?'Plan de symétrie : normale de la face sélectionnée':'Direction de l’arête sélectionnée (axe d’un cercle ou d’un arc), sinon normale de la face sélectionnée';
  bf.onclick=repUseSelectedFace;p.appendChild(bf);
  }
  if(repMode.type==='mir'){
    // + LINÉAIRE (V0.95.5) : la pièce et son image sont répétées en ligne, avant la 2ᵉ symétrie.
    const rl=document.createElement('div');rl.className='row';
    const tl=document.createElement('input');tl.type='checkbox';tl.checked=!!repMode.mlin;tl.className='repMlinChk';
    tl.title='Ajouter une étape Linéaire : l’opération et son image sont répétées en ligne (puis reprises par la 2ᵉ symétrie si elle est cochée)';
    const ll=document.createElement('span');ll.textContent=' + Linéaire';rl.appendChild(tl);rl.appendChild(ll);p.appendChild(rl);
    tl.onchange=()=>{repMode.mlin=tl.checked||undefined;
      if(tl.checked){if(!repMode.axis||repMode.axis==='Face'&&!repMode.dir)repMode.axis='X';if(!(+repMode.copies>=1))repMode.copies=1;if(!(+repMode.dist))repMode.dist=20;}
      renderRepPanel();};
    if(repMode.mlin){
      const axl=document.createElement('select');['X','Y','Z','Face'].forEach(v=>{const op=document.createElement('option');op.value=v;op.textContent=v==='Face'?'Face / arête':v;axl.appendChild(op);});
      axl.value=repMode.axis||'X';axl.title='Direction de l’étape Linéaire';axl.className='repMlinAxe';
      axl.onchange=()=>{repMode.axis=axl.value;delete repMode.dir;renderRepPanel();};p.appendChild(axl);
      const bl=document.createElement('button');bl.textContent='🎯 Arête / face → direction';bl.title='Direction de l’arête sélectionnée, sinon normale de la face sélectionnée';
      bl.onclick=repUseSelectedLin;p.appendChild(bl);
      const rq=document.createElement('div');rq.className='row';const lq=document.createElement('label');lq.textContent='Quantité';rq.appendChild(lq);
      const cl=repQtyInput((+repMode.copies||1)+1,'Quantité en ligne, original compris (3 = l’original + 2 copies)');cl.className='repMlinQte';
      parFx(cl,repMode,'qty',{keep:1});cl.onchange=()=>{repMode.copies=repMaxCopies(repQtyRead(cl)-1);repPreviewUpdate();};
      rq.appendChild(cl);p.appendChild(rq);
      const ld=document.createElement('label');ld.textContent=' Distance (mm)';const dl=document.createElement('input');dl.type='text';dl.inputMode='decimal';dl.value=repMode.dist;dl.className='repMlinDist';
      parFx(dl,repMode,'dist',{keep:1});dl.onchange=()=>{repMode.dist=parseFloat(String(dl.value).replace(',','.'))||0;repPreviewUpdate();};ld.appendChild(dl);p.appendChild(ld);
    }
    // Symétrie DOUBLE : un 2ᵉ plan dont la passe englobe la base ET la 1ʳᵉ symétrie.
    // Absent par défaut (compatibilité : une symétrie existante reste simple).
    const r2=document.createElement('div');r2.className='row';
    const t2=document.createElement('input');t2.type='checkbox';t2.checked=!!repMode.plane2;
    t2.title='Ajouter un 2ᵉ plan : la 1ʳᵉ symétrie est comprise dans la 2ᵉ, ainsi que l\u2019opération initiale';
    const l2=document.createElement('span');l2.textContent=repMode.mlin?' + Symétrie (2ᵉ plan)':' 2ᵉ plan (symétrie double)';
    r2.appendChild(t2);r2.appendChild(l2);p.appendChild(r2);
    t2.onchange=()=>{
      if(t2.checked){if(!repMode.plane2)repMode.plane2=(repMode.plane||'YZ')==='XZ'?'YZ':'XZ';}
      else{delete repMode.plane2;delete repMode.planeN2;}
      renderRepPanel();
    };
    if(repMode.plane2){
      const ax2=document.createElement('select');
      ['X','Y','Z','Face'].forEach(v=>{const op=document.createElement('option');op.value=v;op.textContent=(v==='X'?'YZ':v==='Y'?'XZ':v==='Z'?'XY':v);ax2.appendChild(op);});
      ax2.value=repMode.plane2==='XY'?'Z':repMode.plane2==='XZ'?'Y':repMode.plane2==='Face'?'Face':'X';
      ax2.title='2ᵉ plan de symétrie';
      ax2.onchange=()=>{repMode.plane2=ax2.value==='X'?'YZ':ax2.value==='Y'?'XZ':ax2.value==='Z'?'XY':'Face';delete repMode.planeN2;renderRepPanel();};
      p.appendChild(ax2);
      const bf2=document.createElement('button');bf2.textContent='🎯 Face → 2ᵉ plan';bf2.title='Prend la normale de la face sélectionnée comme 2ᵉ plan';
      bf2.onclick=()=>{repUseSelectedFace2();};p.appendChild(bf2);
    }
  }
  if(repMode.type==='lin'){const l=document.createElement('label');l.textContent=' Distance (mm)';const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';inp.value=repMode.dist;parFx(inp,repMode,'dist',{keep:1});inp.onchange=()=>{repMode.dist=parseFloat(String(inp.value).replace(',','.'))||0;repPreviewUpdate();};l.appendChild(inp);p.appendChild(l);
    // 2ᵉ DIRECTION (grille) : axe, quantité (original compris), pas
    const r2=document.createElement('div');r2.className='row';
    const t2=document.createElement('input');t2.type='checkbox';t2.checked=!!repMode.lin2;t2.className='rep2Chk';
    t2.title='Ajouter une 2ᵉ direction : la ligne de la 1ʳᵉ direction est répétée le long de la 2ᵉ (grille)';
    const l2=document.createElement('span');l2.textContent=' 2ᵉ direction (grille)';r2.appendChild(t2);r2.appendChild(l2);p.appendChild(r2);
    t2.onchange=()=>{repMode.lin2=t2.checked;
      if(t2.checked){if(!repMode.axis2)repMode.axis2=(repMode.axis||'X')==='X'?'Y':'X';if(!repMode.copies2)repMode.copies2=1;if(repMode.dist2==null)repMode.dist2=repMode.dist||10;}
      renderRepPanel();};
    if(repMode.lin2){
      const ax2=document.createElement('select');['X','Y','Z','Face'].forEach(v=>{const op=document.createElement('option');op.value=v;op.textContent=v==='Face'?'Face / arête':v;ax2.appendChild(op);});
      ax2.value=repMode.axis2||'Y';ax2.title='Axe de la 2ᵉ direction';ax2.onchange=()=>{repMode.axis2=ax2.value;delete repMode.dir2;renderRepPanel();};p.appendChild(ax2);
      const c2=repQtyInput((+repMode.copies2||1)+1,'Quantité dans la 2ᵉ direction, original compris');parFx(c2,repMode,'qty2',{keep:1});
      c2.onchange=()=>{repMode.copies2=repMaxCopies(repQtyRead(c2)-1);repPreviewUpdate();};p.appendChild(c2);
      const ld=document.createElement('label');ld.textContent=' Distance 2 (mm)';const i2=document.createElement('input');i2.type='text';i2.inputMode='decimal';i2.value=repMode.dist2;parFx(i2,repMode,'dist2',{keep:1});
      i2.onchange=()=>{repMode.dist2=parseFloat(String(i2.value).replace(',','.'))||0;repPreviewUpdate();};ld.appendChild(i2);p.appendChild(ld);
      const bf2=document.createElement('button');bf2.textContent='🎯 Face / arête → 2ᵉ direction';bf2.title='Prend la direction de l’arête sélectionnée (axe d’un cercle) ou la normale de la face sélectionnée';bf2.onclick=()=>repUseSelectedFace2();p.appendChild(bf2);
    }
  }
  // V0.15.10 : OPÉRATION — unir les copies au corps de leur source, ou un corps neuf par exemplaire
  {const ro=document.createElement('div');ro.className='row';ro.style.marginTop='4px';
    const lo=document.createElement('span');lo.className='note';lo.textContent='Opération ';ro.appendChild(lo);
    const so=document.createElement('select');so.className='repOpSel';
    REP_OPS.forEach(o=>{const op=document.createElement('option');op.value=o[0];op.textContent=o[1];op.title=o[2];so.appendChild(op);});
    so.value=repMode.op==='new'?'new':'join';so.title=REP_OPS.find(o=>o[0]===so.value)[2];
    so.onchange=()=>{repMode.op=so.value;so.title=REP_OPS.find(o=>o[0]===so.value)[2];};
    ro.appendChild(so);p.appendChild(ro);}
  if(repMode.type==='circ'){const l=document.createElement('label');l.textContent=' Angle total (°)';const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';inp.value=repMode.angle;parFx(inp,repMode,'angle',{keep:1});inp.onchange=()=>{repMode.angle=parseFloat(String(inp.value).replace(',','.'))||360;repPreviewUpdate();};l.appendChild(inp);p.appendChild(l);}
  // ── FONCTIONS RÉPÉTABLES : la MÊME liste à cocher qu'à l'édition (voir
  // repSourceList). Aucun re-rendu ici : la case garde son état, seul l'arbre se
  // rafraîchit (le compteur se met à jour sur place, dans la liste).
  p.appendChild(repSourceList(repMode.feats,function(b){repMode.feats=b;},function(){renderTree();repPreviewUpdate();}));
  {const sb=document.createElement('div');sb._onT=v=>{if(v)repMode.skip=v;else delete repMode.skip;repPreviewUpdate();};
    sb._ids=()=>((repMode&&repMode.feats)||[]).filter(id=>repCanFeature(id)&&repAmont(id,null));
    p.appendChild(repSkipFill(sb,repMode,sb._onT,sb._ids));}
  const r=document.createElement('div');r.className='row';r.style.marginTop='8px';const ok=document.createElement('button');ok.className='primary';ok.textContent='✔ Appliquer';ok.onclick=applyRepPattern;r.appendChild(ok);const q=document.createElement('button');q.textContent='Quitter';q.onclick=exitRepMode;r.appendChild(q);p.appendChild(r);
  repPreviewUpdate(); // V0.11.20 : les copies en rouge dès l'entrée et à chaque changement de type / plan / axe
}
