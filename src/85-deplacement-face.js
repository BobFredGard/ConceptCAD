/* ---------- déplacement d'une face (push/pull) ----------
   Le calcul est dans 20-noyau (occMoveFaceOnce). Ici : le mode de sélection au clic, la
   création de la fonction et les réglages. Le déplacement se fait le long de la normale
   SORTANTE de la face cliquée : distance positive = la face avance, négative = elle rentre.
   La face est mémorisée par une référence durable (centre + normale + dimensions), pas par
   son numéro : le numéro d'une face change dès qu'une opération en ajoute une autre, alors
   que la face visée, elle, reste la même.

   V0.21.6 : multi-sélection — clic = ajouter / re-clic = retirer (surbrillance orange),
   distance commune, Appliquer (Entrée) / Échap. La fonction mémorise `faces` (toutes) et
   `ref` (la première, pour les chemins qui ne lisent qu'une face). Le même mode ÉDITE une
   fonction existante (« Re-sélectionner »), comme la coque (87).

   V0.45.0 : la face d'un congé ou d'un chanfrein (occBlendOfFace) n'est pas poussée : le
   panneau propose sa TAILLE (rayon / distance), qui modifie la fonction congé elle-même
   (comme Appuyer/Tirer de Fusion 360). « Déplacer la face quand même » garde l'ancien geste.

   V0.45.1 : case « Faces tangentes » (cochée par défaut, retenue d'une fois sur l'autre) —
   chaque face cliquée entraîne celles qui la prolongent sans arête vive (f.tangent, chaîne
   recalculée au rejeu, 20-noyau occApplyMoveFace). Avec le noyau OCCT 8, toute face se
   clique (congés, coins obliques, B-splines) : elles sont alors décalées par le noyau. */
let mvMode=null; // null | {faces:[ref], dist, tangent, editing:id|null, blend:{feat,idx,r,cham,ref}|null}
const mvMemo={tangent:true};
let mvGroup=null; // surbrillance 3D des faces retenues

// Bouton « Déplacer une face » : la coque HTML étant générée et jamais éditée à la main,
// il est créé ICI, dans les sources, comme le bouton Révolution. Idempotent. Il est placé
// juste après l'Extrusion ; le regroupement par type (96-bandeau-groupes.js) le rangera
// ensuite dans le menu « Modifier le solide ».
(function(){
  if(document.getElementById('btnMoveFace'))return;
  const after=document.getElementById('btnExtrude');
  if(!after||!after.parentNode)return;
  const b=document.createElement('button');
  b.id='btnMoveFace';
  b.textContent='\u{1F4D0} Déplacer une face';
  b.title='Déplacer une ou plusieurs faces le long de leur normale sortante : distance positive, la face avance ; négative, elle rentre';
  after.parentNode.insertBefore(b,after.nextSibling);
})();

function mvName(f){
  const d=+f.dist||0,n=mvRefs(f).length;
  return `Déplacement ${n>1?'de '+n+' faces':'de face'} ${d>0?'+':''}${String(d).replace('.',',')} mm`;
}
function mvClearHl(){
  if(!mvGroup)return;
  mvGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
  scene.remove(mvGroup);mvGroup=null;
}
function mvRefCopy(r){
  // Référence persistée : centre, dimensions, normale (plan / cylindre) et type de surface.
  const o={pos:r.pos.slice(),dim:r.dim.slice()};
  if(Array.isArray(r.n))o.n=r.n.slice();
  if(r.st)o.st=r.st;
  return o;
}
function mvChainOf(r){
  // Faces tangentes à une face retenue (surbrillance seule) : rangs sur le solide de son corps.
  if(r._chain)return r._chain;
  r._chain=[];
  const b=r._ord>=0&&bodies.find(x=>x.id===r._bid&&x.shape);
  if(b)try{r._chain=occTangentChainOrds(b.shape,[r._ord]).filter(o=>o!==r._ord);}catch(e){}
  return r._chain;
}
function mvPaint(){
  mvClearHl();
  if(!mvMode)return;
  if(mvMode.blend){mvGroup=facesHlGroup(mvMode.blend.ref?[mvMode.blend.ref]:[],0xff9f0a,'mvFaces');return;}
  const all=mvMode.faces.slice();
  if(mvMode.tangent)mvMode.faces.forEach(r=>mvChainOf(r).forEach(o=>all.push({_ord:o,_bid:r._bid})));
  mvGroup=facesHlGroup(all,0xff9f0a,'mvFaces');
}
function mvHelp(){
  const nf=mvMode?mvMode.faces.length:0;
  faceEl.innerHTML='<b>📐 '+(mvMode&&mvMode.editing?'Édition du déplacement de face':'Déplacement de face')+'</b><br><span class="note">'+
    (nf?nf+' face(s) retenue(s). ':'')+'Cliquez les faces à déplacer (re-clic = retirer), réglez la distance puis '+
    '<b>Appliquer</b> (<b>Entrée</b>). <b>Échap</b> annule.</span>';
}
function enterMoveFaceMode(editF){
  const editing=(editF&&editF.type==='xmove')?editF:null;
  if(mvMode){if(editing&&mvMode.editing===editing.id)return;exitMoveFaceMode(true);}
  if(!occHas()||!occExactForTool()){ // STEP seul compris
    faceEl.textContent='Déplacement de face : solide exact indisponible (OCCT non chargé ou aucun volume).';
    return;
  }
  try{if(draftMode)exitDraftMode(true);}catch(e){}
  try{if(coqueMode)exitCoqueMode(true);}catch(e){}
  mvMode={faces:[],dist:5,tangent:editing?!!editing.tangent:mvMemo.tangent,editing:editing?editing.id:null};
  if(editing){
    // Édition : rejeu SANS la fonction (occSkipFeat) → les faces d'origine redeviennent
    // cliquables et se repeignent. Même stratégie que congé/dépouillage/coque.
    mvMode.faces=mvRefs(editing).filter(r=>r&&Array.isArray(r.pos)&&(Array.isArray(r.n)||r.st)&&Array.isArray(r.dim))
      .map(r=>{const o=mvRefCopy(r);o._ord=-1;if(typeof r._bid==='string')o._bid=r._bid;return o;});
    mvMode.dist=+editing.dist||0;parFxFrom(editing,mvMode,['dist']);
    occSkipFeat=editing.id;
    tlEditLock(editing);
    if(!occExactForTool(true)){occSkipFeat=null;mvMode=null;tlEditUnlock();faceEl.textContent='Déplacement de face : recalcul impossible.';return;}
    coqueOrdIdx=new Map(); // un parcours des faces par solide pour toute la sélection (87)
    try{mvMode.faces.forEach(r=>{try{r._ord=coqueOrdOf(r);}catch(e){r._ord=-1;}});}finally{coqueOrdIdx=null;}
  }
  try{buildEdgeOverlay();}catch(e){}
  try{applyClip();}catch(e){}
  mvPaint();renderMvPanel();mvHelp();
}
function exitMoveFaceMode(silent){
  if(!mvMode)return;
  const wasEditing=!!mvMode.editing;
  mvMode=null;mvClearHl();
  if(wasEditing){occSkipFeat=null;tlEditUnlock();markDirty();try{rebuild();}catch(e){}}
  occStepForceEnd();
  try{clearHover();}catch(e){}
  if(!silent){try{faceEl.textContent='Déplacement de face : annulé.';}catch(e){}try{renderProps();}catch(e){}}
}
// Face exacte sous le curseur (le groupe de triangles donne l'index BRep de la face,
// résolu sur le SOLIDE DU CORPS cliqué — multi-corps, voir occFaceOfHit dans 20-noyau).
function mvFaceUnder(e){
  if(!occHas()||!occLive||!occLive.shape)return null;
  try{
    const h=pick(e);
    if(!h||!h.object||!h.object.geometry)return null;
    const hit=occFaceOfHit(h.object,h.faceIndex);
    if(!hit||!hit.face)return null;
    // Noyau OCCT 8 : toute face (décalage par le noyau) ; sinon plan / cylindre seulement.
    const ref=occHasFaceOffset()?occFaceRefAny(hit.face):occFaceRef(hit.face);
    let blend=null;
    if(mvMode&&!mvMode.editing){try{blend=occBlendOfFace(hit.face,hit.bd&&hit.bd.shape,hit.bd&&hit.bd.id);}catch(e){}}
    try{hit.face.delete();}catch(e){}
    if(blend)blend.ref=ref;
    if(!ref)return blend?{ref:null,ord:hit.ord,blend}:null;
    // `_ord`/`_bid` = session (surbrillance seule), jamais persistés tels quels.
    if(hit.bd)ref._bid=hit.bd.id;
    ref._ord=hit.ord;
    return {ref:ref,ord:hit.ord,blend};
  }catch(e){return null;}
}
function mvFaceHover(e){
  if(!mvMode)return;
  renderer.domElement.style.cursor='pointer';
}
// Clic : ajoute la face à la sélection, ou la retire si elle y est déjà.
function mvFaceCommit(e){
  if(!mvMode)return;
  const hit=mvFaceUnder(e);
  if(!hit){
    faceEl.textContent='Déplacement de face : cliquez une face '+(occHasFaceOffset()?'':'plane ou cylindrique ')+'du solide exact.';
    return;
  }
  // Face déjà retenue, ou entraînée par la chaîne tangente d'une autre : le clic la retire.
  const k=hit.ref?coqueKey(hit.ref):null;
  let i=k?mvMode.faces.findIndex(r=>coqueKey(r)===k):-1;
  if(i<0&&hit.ref&&mvMode.tangent)i=mvMode.faces.findIndex(r=>r._bid===hit.ref._bid&&mvChainOf(r).includes(hit.ord));
  if(i>=0&&!mvMode.blend){mvMode.faces.splice(i,1);mvPaint();renderMvPanel();mvHelp();return;}
  if(hit.blend){
    const f=doc.features.find(x=>x.id===hit.blend.feat);
    if(f){
      mvMode.blend=hit.blend;mvMode.faces=[];
      parFxFrom(f.edges[hit.blend.idx[0]],mvMode.blend,['r']);
      mvPaint();renderMvPanel();
      faceEl.innerHTML='<b>📐 '+(hit.blend.cham?'Chanfrein':'Congé')+'</b><br><span class="note">Face de « '+f.name+' » : réglez sa '+
        (hit.blend.cham?'distance':'taille (rayon)')+' puis <b>Appliquer</b>. Un autre clic choisit une autre face.</span>';
      return;
    }
  }
  if(!hit.ref)return;
  mvMode.blend=null;
  mvMode.faces.push(hit.ref);
  mvPaint();renderMvPanel();mvHelp();
}
/* ---------- panneau ---------- */
function renderMvBlendPanel(p){
  const B=mvMode.blend,f=doc.features.find(x=>x.id===B.feat);
  const lb=B.cham?'Chanfrein':'Congé';
  const h=document.createElement('div');h.className='pnl-h';
  h.textContent='📐 Taille du '+lb.toLowerCase();p.appendChild(h);
  const n=document.createElement('span');n.className='note';
  n.textContent='Face de « '+(f?f.name:lb)+' »'+(B.idx.length>1?' ('+B.idx.length+' arêtes)':'')+' : sa taille change dans la fonction elle-même.';
  p.appendChild(n);
  const row=document.createElement('div');row.className='pnl-row';row.style.marginTop='8px';
  const lab=document.createElement('label');lab.textContent=(B.cham?'Distance':'Rayon')+' (mm)';row.appendChild(lab);
  const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';
  inp.id='mvBlendIn';inp.value=String(+(+B.r).toFixed(4)).replace('.',',');
  parFx(inp,B,'r');
  inp.onchange=()=>{
    const v=parseFloat(String(inp.value).replace(',','.').replace(/\s/g,''));
    if(!isFinite(v)||!(v>0)){inp.value=String(B.r).replace('.',',');faceEl.textContent=(B.cham?'Distance':'Rayon')+' invalide : un nombre positif.';return;}
    B.r=v;
  };
  row.appendChild(inp);p.appendChild(row);
  const btns=document.createElement('div');btns.className='pnl-btns';btns.style.marginTop='8px';
  const ok=document.createElement('button');ok.className='primary';ok.textContent='✔ Appliquer';ok.onclick=mvApply;btns.appendChild(ok);
  const q=document.createElement('button');q.textContent='Quitter';q.onclick=()=>exitMoveFaceMode();btns.appendChild(q);
  p.appendChild(btns);
  if(B.ref){
    const mv=document.createElement('button');mv.textContent='Déplacer la face quand même';mv.style.marginTop='6px';
    mv.title='Pousser cette face le long de sa normale, sans toucher au '+lb.toLowerCase();
    mv.onclick=()=>{const r=B.ref;mvMode.blend=null;mvMode.faces=[r];mvPaint();renderMvPanel();mvHelp();};
    p.appendChild(mv);
  }
}
function renderMvPanel(){
  const p=document.getElementById('props');if(!p)return;
  p.innerHTML='';if(!mvMode)return;
  if(mvMode.blend){renderMvBlendPanel(p);return;}
  const h=document.createElement('div');h.className='pnl-h';
  h.textContent=mvMode.editing?'📐 Édition du déplacement de face':'📐 Déplacement de face';
  p.appendChild(h);
  if(mvMode.faces.length){
    const lst=document.createElement('div');lst.className='lst';
    mvMode.faces.forEach((fr,i)=>{
      const r2=document.createElement('div');r2.className='item';
      const s=document.createElement('span');
      const nt=mvMode.tangent?mvChainOf(fr).length:0;
      s.textContent=(fr._ord>=0?'✅ ':'⚠ ')+'▸ centre ('+fr.pos.map(v=>(+v).toFixed(1)).join(' ; ')+') mm'+(nt?' + '+nt+' tangente'+(nt>1?'s':''):'');
      r2.appendChild(s);
      const x=document.createElement('button');x.textContent='✕';x.title='Retirer cette face';
      x.onclick=()=>{mvMode.faces.splice(i,1);mvPaint();renderMvPanel();mvHelp();};
      r2.appendChild(x);lst.appendChild(r2);
    });
    p.appendChild(lst);
  }else{
    const n=document.createElement('span');n.className='note';
    n.textContent='Cliquez une ou plusieurs faces dans la vue 3D.';
    p.appendChild(n);
  }
  const row=document.createElement('div');row.className='pnl-row';row.style.marginTop='8px';
  const lab=document.createElement('label');lab.textContent='Distance (mm)';row.appendChild(lab);
  const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';
  inp.id='mvDistIn';inp.value=String(mvMode.dist).replace('.',',');
  parFx(inp,mvMode,'dist');
  inp.onchange=()=>{
    const v=parseFloat(String(inp.value).replace(',','.').replace(/\s/g,''));
    if(!isFinite(v)){inp.value=String(mvMode.dist).replace('.',',');faceEl.textContent='Distance invalide (ex. 5 ou -3).';return;}
    mvMode.dist=Math.abs(v)<1e-9?0:v;inp.value=String(mvMode.dist).replace('.',',');
  };
  row.appendChild(inp);p.appendChild(row);
  const rt=document.createElement('label');rt.className='pnl-row';rt.style.marginTop='6px';
  const cb=document.createElement('input');cb.type='checkbox';cb.id='mvTangent';cb.checked=!!mvMode.tangent;
  cb.onchange=()=>{mvMode.tangent=mvMemo.tangent=cb.checked;mvPaint();renderMvPanel();mvHelp();};
  rt.appendChild(cb);rt.appendChild(document.createTextNode(' Faces tangentes'));
  rt.title='Chaque face cliquée entraîne toutes celles qui la prolongent sans arête vive (parois, coins arrondis, congés, fond d’une poche)';
  p.appendChild(rt);
  const btns=document.createElement('div');btns.className='pnl-btns';btns.style.marginTop='8px';
  const ok=document.createElement('button');ok.className='primary';
  ok.textContent=mvMode.editing?'✔ Enregistrer':'✔ Appliquer';ok.onclick=mvApply;btns.appendChild(ok);
  const q=document.createElement('button');q.textContent=mvMode.editing?'✖ Annuler':'Quitter';q.onclick=()=>exitMoveFaceMode();
  btns.appendChild(q);p.appendChild(btns);
  const n2=document.createElement('span');n2.className='note';
  n2.textContent='Chaque face se déplace le long de sa normale sortante : positif, elle avance ; négatif, elle rentre. Ses bords suivent les faces voisines (une dépouille ou un chanfrein se prolonge). Une face cylindrique change de rayon : un arbre qui avance grossit, un trou qui avance rétrécit.'+
    (occHasFaceOffset()?' Faces courbes et chaînes tangentes (intérieur d’une poche, congés compris) sont décalées d’un bloc.':'');
  p.appendChild(n2);
}
function mvBlendApply(){
  const B=mvMode.blend,f=doc.features.find(x=>x.id===B.feat&&x.type==='xfillet');
  exitMoveFaceMode(true);
  if(!f){faceEl.textContent='Congé : fonction introuvable.';return;}
  const was=(+f.edges[B.idx[0]].r||+f.radius||0);
  docPushUndo('taille de « '+f.name+' »');
  B.idx.forEach(i=>{const e=f.edges[i];if(!e)return;e.r=B.r;parFxCopy(B,e,['r']);});
  repSyncForFeature(f); // les instances de la répétition suivent
  sel={kind:'feature',id:f.id};
  markDirty();rebuild();renderTree();renderProps();
  faceEl.textContent=f.name+' : '+(B.cham?'distance':'rayon')+' '+String(+was.toFixed(4)).replace('.',',')+' → '+String(B.r).replace('.',',')+' mm.';
}
function mvApply(){
  if(!mvMode)return;
  if(mvMode.blend){mvBlendApply();return;}
  if(!mvMode.faces.length){faceEl.textContent='Déplacement de face : retenez au moins une face.';return;}
  // On retire `_ord` (index BRep de la session) : surbrillance seule, rien pour le rejeu.
  const faces=mvMode.faces.map(r=>{const o=mvRefCopy(r);if(typeof r._bid==='string')o._bid=r._bid;return o;});
  const dist=+mvMode.dist||0,tangent=!!mvMode.tangent;
  if(mvMode.editing){
    // Édition EN PLACE (une seule fonction, comme congé/dépouillage/coque).
    const f=doc.features.find(x=>x.id===mvMode.editing&&x.type==='xmove');
    if(f){
      docPushUndo('édition de « '+f.name+' »');
      f.faces=faces;f.ref=JSON.parse(JSON.stringify(faces[0]));f.dist=dist;
      if(tangent)f.tangent=true;else delete f.tangent;
      parFxCopy(mvMode,f,['dist']);f.name=mvName(f);
      repSyncForFeature(f); // les instances de la répétition suivent
      sel={kind:'feature',id:f.id};
    }
    exitMoveFaceMode(true);
    // message AVANT le rejeu : celui-ci y ajoute ses alertes (face refusée…), qui restaient cachées
    faceEl.textContent=f?'Déplacement de face mis à jour : '+f.name+'.':'Déplacement de face : fonction introuvable.';
    markDirty();rebuild();renderTree();renderProps();
    return;
  }
  // On attaque le solide SANS cette nouvelle fonction, pour la viser sur la forme courante.
  occSkipFeat=null;
  const f={id:uid('mv'),type:'xmove',name:'',faces,ref:JSON.parse(JSON.stringify(faces[0])),dist};
  if(tangent)f.tangent=true;
  // Faces toutes sur le même corps : la fonction va dans CE corps, pas dans le corps actif
  // (Barquette : fond de « Corps 1 » cliqué, « Corps 1 (2) (2) » actif → rien ne bougeait).
  const bid=faces[0]._bid;
  if(bid&&faces.every(r=>r._bid===bid)&&(doc.bodies||[]).some(b=>b.id===bid))f.body=bid;
  f.name=mvName(f);
  parFxCopy(mvMode,f,['dist']);
  addFeature(f); // instantané d'annulation + insertion au marqueur temps (comme extrusion/révolution/congé)
  exitMoveFaceMode(true);
  sel={kind:'feature',id:f.id};
  faceEl.textContent='Déplacement de face créé : '+f.name+'. Distance modifiable dans ses propriétés.';
  markDirty();rebuild();renderTree();renderProps();
}
