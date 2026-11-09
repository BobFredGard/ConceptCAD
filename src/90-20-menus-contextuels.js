/* ---------- menus contextuels ---------- */
let ctxTarget=null;
/* ---- clic droit → export STEP du SEUL corps (arbre + vue 3D) ----
   Le bouton est créé en JS (la coque HTML n'est jamais éditée à la main) et
   n'apparaît que pour un corps (visible via showCtx / showCtx3D). */
let ctxStepBtn=null, ctxStepBtn3d=null;
/* ---- menus : jamais coupés par le bord de l'écran --------------------------
   #ctxMenu / #ctxMenu3D sont position:fixed dans un body overflow:hidden : un
   menu ouvert en bas d'écran était ROGNÉ hors viewport et sa DERNIÈRE entrée
   (l'export STEP du corps, ajoutée après le bloc couleur/transparence de -003)
   devenait invisible — « le menu est ouvert mais je ne trouve plus l'entrée ».
   Le placement passe par ctxPlace : clamp testable en pur (ctxClampPos) +
   garde-fous CSS (max-height + scroll) injecté depuis JS (règle du dépôt :
   la coque ne s'édite jamais à la main). */
function ctxClampPos(x,y,w,h,vw,vh){
  const mx=Math.max(4,vw-w-4), my=Math.max(4,vh-h-4);
  return {left:Math.max(4,Math.min(+x||0,mx)), top:Math.max(4,Math.min(+y||0,my))};
}
function ctxPlace(el,x,y){
  try{
    el.style.left=x+'px';el.style.top=y+'px';
    const w=el.offsetWidth||0, h=el.offsetHeight||0;
    const vw=(typeof window!=='undefined'&&window.innerWidth)||0;
    const vh=(typeof window!=='undefined'&&window.innerHeight)||0;
    if(!(w>0&&h>0&&vw>0&&vh>0))return; // pas de mesure (harnais) : on garde x,y
    const p=ctxClampPos(x,y,w,h,vw,vh);
    el.style.left=p.left+'px';el.style.top=p.top+'px';
  }catch(e){}
}
(function ctxMenuMaxCss(){
  try{
    const st=document.createElement('style');
    st.textContent='#ctxMenu,#ctxMenu3D{max-height:calc(100vh - 8px);overflow-y:auto}';
    (document.head||document.documentElement).appendChild(st);
  }catch(e){}
})();
function showCtx(x,y,t){ctxTarget=t;$('ctxMenu').style.display='block';ctxPlace($('ctxMenu'),x,y);
  try{ if(ctxStepBtn)ctxStepBtn.style.display=(t&&t.kind==='body')?'':'none'; }catch(e){}
  // style du corps : le menu du CORPS porte la couleur et la transparence (même
  // source que le panneau et que la vue 3D) — masqué ailleurs, comme l'export STEP.
  try{ ctxStyleShow('ctxMenu',!!(t&&t.kind==='body')); ctxStyleSync(); }catch(e){}
  try{ asmCtxSync(t,x,y); }catch(e){} // composant depuis ce corps, déplacer vers un composant (48)
  try{ bmCtxSync('ctxMenu',t); }catch(e){}try{ bsCtxSync('ctxMenu',t); }catch(e){}try{ bcCtxSync('ctxMenu',t); }catch(e){} // déplacer le corps (85)
  try{ bremCtxSync(t); }catch(e){}} // retirer le corps dans la timeline (40)
function hideCtx(){$('ctxMenu').style.display='none';}
function ctxBodyId(t){
  // Cible du clic-droit → CORPS conteneur. L'id affiché n'est PAS toujours celui
  // du corps (en mode maillage, le mesh porte l'id de sa fonction) : c'est CET id
  // qui sert à lire et à écrire la couleur et la transparence, partout.
  if(!t)return null;
  if(t.kind==='body'&&t.id){
    try{ if((doc.bodies||[]).some(e=>e&&e.id===t.id))return t.id; }catch(e){}
    let f=null;
    try{ f=(doc.features||[]).find(x=>x&&x.id===t.id); }catch(e){}
    if(f)return f.body||null;
    let rb=null;
    try{ rb=bodies.find(b=>b&&b.id===t.id); }catch(e){}
    if(rb)return bodyIdOfRuntime(rb);
    return null;
  }
  if(t.kind==='feature'){
    let f=null;
    try{ f=(doc.features||[]).find(x=>x&&x.id===t.id); }catch(e){}
    return f?(f.body||null):null;
  }
  return null;
}
let ctxPieceNext=null; // pièce de STEP sous le clic droit 3D (importPieceAt), lue par showCtx3D
function showCtx3D(x,y,bid){ctxTarget={kind:'body',id:bid};const _bd=bodies.find(b=>b.id===bid)||{name:'Pièce'};$('ctx3DTitle').textContent=_bd.name||'Pièce';
  try{ if(ctxStepBtn3d)ctxStepBtn3d.style.display=bid?'':'none'; }catch(e){}
  ctxPieceBtnSync(ctxPieceNext);ctxPieceNext=null;
  try{
    // ON LIT LA SOURCE, pas le matériau affiché : un fondu d'esquisse ou le cache
    // local changerait artificiellement l'affichage, pas la pièce.
    const _bid=ctxBodyId(ctxTarget);
    const _op=Math.round(bodyOpOf(_bid)*100);
    $('ctxColor').value=cssHex(bodyColorOf(_bid));
    $('ctxOp').value=_op;$('ctxOpV').textContent=_op+'%';
    ctxStyleShow('ctxMenu3D',!!(bid&&!_bd.ghost));
    ctxStyleSync();
  }catch(e){}
  try{ bmCtxSync('ctxMenu3D',bid?ctxTarget:null); }catch(e){}try{ bsCtxSync('ctxMenu3D',bid?ctxTarget:null); }catch(e){}try{ bcCtxSync('ctxMenu3D',bid?ctxTarget:null); }catch(e){} // déplacer le corps (85)
  try{ bremCtxSync(bid&&!_bd.ghost?ctxTarget:null,'ctxMenu3D'); }catch(e){} // retirer le corps dans la timeline (40)
  try{ rdLookCtxSync(bid&&!_bd.ghost?bid:null); }catch(e){} // matériau de rendu (98-rendu-apparence)
  $('ctxMenu3D').style.display='block';ctxPlace($('ctxMenu3D'),x,y);}
function hideCtx3D(){$('ctxMenu3D').style.display='none';}
document.querySelectorAll('#ctxMenu button').forEach(b=>b.onclick=()=>{
  const t=ctxTarget;hideCtx();if(!t)return;
  if(t.kind==='cg'){cgCtxAct(b.dataset.act,t);return;} // construction (79)
  if(b.dataset.act==='rename'){
    const n=prompt('Nouveau nom :',curName(t));if(!n)return;
    if(t.kind==='sketch')doc.sketches.find(s=>s.id===t.id).name=n;
    if(t.kind==='feature')doc.features.find(f=>f.id===t.id).name=n;
    if(t.kind==='body'){try{bodyEntry(t.id).name=n;dirty=true;}catch(e){}}
    markDirty();rebuild();renderProps();
  }
  if(b.dataset.act==='toggle'){
    if(t.kind==='plane'){setOriginVis(t.id,!originVis[t.id]);return;}
    if(t.kind==='sketch'){const s=doc.sketches.find(x=>x.id===t.id);s.visible=!(s.visible!==false);}
    if(t.kind==='feature'){const f=doc.features.find(x=>x.id===t.id);f.visible=!(f.visible!==false);}
    if(t.kind==='body'){try{bodyToggleVis(t.id);}catch(e){}return;}
    markDirty();rebuild();
  }
  if(b.dataset.act==='tl'){
    if(t.kind==='feature'){const f=doc.features.find(x=>x.id===t.id);if(f){tlSetPtr(f);markDirty();rebuild();renderTree();renderProps();}}
    return;
  }
  if(b.dataset.act==='tlclear'){
    if(tlMark!=null){tlSetPtr(null);markDirty();rebuild();renderTree();renderProps();}
    return;
  }
  if(b.dataset.act==='edit'){
    if(t.kind==='sketch')openSketch(t.id);
    if(t.kind==='feature'){const f=doc.features.find(x=>x.id===t.id);if(f&&tlLocked(f)){tlSetPtr(null);markDirty();rebuild();}if(f&&f.sketchId)openSketch(f.sketchId);}
  }
  if(b.dataset.act==='del'){
    if(t.kind==='body'){delBody(t.id);return;} // confirme + cascade + rebuild lui-même
    if(!confirm('Supprimer ?'))return;
    if(t.kind==='sketch'){doc.sketches=doc.sketches.filter(s=>s.id!==t.id);doc.features=doc.features.filter(f=>f.sketchId!==t.id);}
    if(t.kind==='feature'){delFeature(doc.features.find(x=>x.id===t.id));}
    sel={kind:null,id:null};markDirty();rebuild();renderProps();
  }
});
document.querySelectorAll('#ctxMenu3D button').forEach(b=>b.onclick=()=>{
  const t=ctxTarget;hideCtx3D();if(!t)return;const bd=bodies.find(x=>x.id===t.id);if(!bd)return;
  if(b.dataset.act==='hide'){bd.visible=false;bd.mesh.visible=false;refreshParts();buildEdgeOverlay();}
  // 👻 = preset de la SLIDER (25 %) : il écrit la même fiche que le curseur et le
  // panneau du corps, il n'y a donc plus d'opacité « à part » qui se désynchronise.
  if(b.dataset.act==='ghost')ctxSetBodyOp(25,true);
  if(b.dataset.act==='isolate')isolate(bd.id);
  if(b.dataset.act==='showall')showAll2();
});
/* ---- STEP SEUL dans son corps : hors chaîne exacte (occReplayBody : importSeul), il
   n'est jamais dans perBody — un STEP ouvert puis réexporté donnait « rien à exporter ».
   On exporte alors son solide exact (importGeom.brep), sans les pièces masquées (👁 de
   l'arborescence : f.hidOcc). Rend [{bodyId,shape}] : handles NEUFS, à supprimer. ---- */
function importVisibleShape(f,brep){
  const g=f&&f._mesh&&f._mesh.geometry,O=g&&g.userData&&g.userData.impOcc;
  const H=new Set(O&&Array.isArray(f.hidOcc)?f.hidOcc:[]);
  if(!H.size)return occShapeCopy(brep);
  return importOccShape(brep,o=>!H.has(o));
}
function importOccShape(brep,keepOcc){
  // Occurrences retenues (keepOcc(n°)) d'un STEP multi-corps, dans leur placement
  // d'assemblage. Même parcours (et donc mêmes n° d'occurrence) qu'importStepOcc.
  const E=occt.TopAbs_ShapeEnum,keep=[];let n=0;
  const typ=s=>{const t=s.ShapeType();return t===E.TopAbs_SOLID?'so':t===E.TopAbs_SHELL?'sh':t===E.TopAbs_FACE?'f':t===E.TopAbs_COMPOUND||t===E.TopAbs_COMPSOLID?'c':'';};
  const visit=(s,own)=>{
    const t=typ(s);
    if(t==='so'||((t==='sh'||t==='f')&&!own)){
      if(keepOcc(n))keep.push(t==='so'?occt.TopoDS.Solid_1(s):t==='sh'?occt.TopoDS.Shell_1(s):occt.TopoDS.Face_1(s));
      n++;own=true;
    }
    if(t==='f'||!t)return;
    const it=new occt.TopoDS_Iterator_2(s,true,true);
    try{while(it.More()){visit(it.Value(),own);it.Next();}}finally{try{it.delete();}catch(e){}}
  };
  visit(brep,false);
  const c=occCompoundOf(keep);
  if(keep.length>1)keep.forEach(s=>{try{s.delete();}catch(e){}});
  return c;
}
function importLoneShapes(FR,bid){
  const out=[];
  try{
    if(typeof importGeom==='undefined'||!doc.bodies||!doc.bodies.length)return out;
    const b0=doc.bodies[0].id,by={},done=new Set((FR&&FR.perBody||[]).map(p=>p.bodyId));
    const feats=(doc.features||[]).filter(f=>f&&f.visible!==false);
    const consumed=new Set();feats.forEach(f=>{if(f.type==='combine'&&!f.keep)(f.tools||[]).forEach(t=>consumed.add(t));});
    feats.forEach(f=>{const b=(f.body&&doc.bodies.some(e=>e.id===f.body))?f.body:b0;(by[b]=by[b]||[]).push(f);});
    Object.keys(by).forEach(b=>{
      if((bid&&b!==bid)||done.has(b)||consumed.has(b)||!by[b].every(f=>f.type==='import'))return;
      by[b].forEach(f=>{
        const e=importGeom.get(f.id);if(!e||!e.brep)return;
        let sh=null;try{sh=importVisibleShape(f,e.brep);}catch(err){sh=null;}
        if(sh)out.push({bodyId:b,shape:sh});
      });
    });
  }catch(e){}
  return out;
}
function stepSaveShapes(shapes,nm,sch){
  // Écrit les formes en STEP et télécharge « nm.step » (export du corps, d'une pièce).
  const path='/b.stp'; // chemin court fixe (cf. /o.stp de l'export global)
  try{occt.FS.unlink(path);}catch(e){}
  const bytes=occWriteStep(shapes,path,sch);
  const blob=new Blob([bytes],{type:'application/step'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=String(nm).replace(/[\\/:*?"<>|]+/g,'-')+'.step';
  a.click();
  setTimeout(()=>{try{URL.revokeObjectURL(a.href);}catch(e){}},2000);
  try{occt.FS.unlink(path);}catch(e){}
  faceEl.textContent='STEP '+stepLabel(sch)+' « '+nm+' » exporté ('+(bytes.length/1024).toFixed(1)+' Ko).';
}
/* ---- Une PIÈCE (ou un sous-ensemble) d'un STEP multi-corps, seule : clic droit sur sa
   ligne de l'arborescence, ou sur elle dans la vue 3D. Placement d'assemblage gardé. ---- */
async function importPieceExport(fid,occ,nm){
  nm=String(nm||'pièce').replace(/:\d+$/,'');
  let sh=null;
  try{
    if(!occHas())throw new Error('OCCT indisponible (chargement en cours ou échec — servez la page en http://)');
    const e=typeof importGeom!=='undefined'?importGeom.get(fid):null;
    if(!e||!e.brep)throw new Error('solide exact du STEP indisponible (réimportez le fichier)');
    const sch=await stepAskSchema('Export STEP « '+nm+' »');
    if(!sch)return;
    faceEl.textContent='Export STEP « '+nm+' » : pré-test…';
    const pok=(await occExportPreflight());
    if(!pok[0])throw new Error(pok[1]||'pré-test impossible');
    const S=new Set(occ||[]);
    sh=importOccShape(e.brep,o=>S.has(o));
    if(!sh)throw new Error('pièce introuvable dans le solide du STEP');
    stepSaveShapes([sh],nm,sch);
  }catch(e){
    const msg=String((e&&e.message)||e||'erreur');
    faceEl.textContent='Export STEP « '+nm+' » : '+msg;
    try{alert('Export STEP de « '+nm+' » impossible : '+msg);}catch(_){}
  }finally{
    try{ if(sh)sh.delete(); }catch(e){}
  }
}
function importPieceAt(mesh,fi){
  // Pièce d'un import sous le triangle fi : {fid, occ:[n°], name} — nom de sa feuille
  // dans l'arborescence du STEP. null hors STEP multi-corps.
  try{
    const b=bodies.find(x=>x&&x.mesh===mesh&&x.kind==='import');
    const g=mesh&&mesh.geometry,O=g&&g.userData&&g.userData.impOcc;
    if(!b||!O||fi==null)return null;
    const gr=(g.userData.occGroups||[]).find(r=>fi>=r.start&&fi<r.start+r.count);
    const o=gr?O.faceOcc[gr.f]:undefined;
    if(o===undefined||o<0)return null;
    const fid=b.ref||b.id,f=(doc.features||[]).find(x=>x&&x.id===fid);
    let name=null;
    const walk=n=>{(n.k||[]).forEach(c=>{if(name)return;if(!c.k.length&&c.o.length===1&&c.o[0]===o)name=c.n;else walk(c);});};
    if(O.tree)walk(O.tree);
    return {fid,occ:[o],name:name||((f&&f.name)||'STEP')+' — pièce '+(o+1)};
  }catch(e){return null;}
}
let ctxPieceBtn3d=null,ctxPiece3d=null;
function ctxPieceBtnSync(p){
  // Bouton « Exporter cette pièce » du menu 3D : visible sur une pièce de STEP multi-corps.
  ctxPiece3d=p||null;
  try{
    if(!ctxPieceBtn3d){
      const b=document.createElement('button');b.dataset.act='steppiece';
      b.title='Géométrie exacte de SEULEMENT cette pièce du STEP (placement d’assemblage gardé).';
      b.onclick=function(){const q=ctxPiece3d;try{hideCtx3D();}catch(e){}if(q)importPieceExport(q.fid,q.occ,q.name);};
      // juste AVANT l'export du corps, qui reste la dernière entrée (test_ctx_menu_viewport)
      const M=$('ctxMenu3D');if(ctxStepBtn3d&&ctxStepBtn3d.parentNode===M)M.insertBefore(b,ctxStepBtn3d);else M.appendChild(b);
      ctxPieceBtn3d=b;
    }
    ctxPieceBtn3d.style.display=p?'':'none';
    if(p)ctxPieceBtn3d.textContent='⬇ Exporter la pièce « '+String(p.name).replace(/:\d+$/,'')+' » en STEP';
  }catch(e){}
}
function importPieceMenu(x,y,fid,occ,name){
  // Clic droit sur une ligne de l'arborescence d'un STEP : petit menu de la pièce.
  let m=$('ctxPiece');
  if(!m){
    m=document.createElement('div');m.id='ctxPiece';
    const st=document.createElement('style');
    st.textContent='#ctxPiece{display:none;position:fixed;z-index:5000;min-width:200px;background:rgba(28,28,32,.96);border:1px solid var(--border);border-radius:9px;padding:5px;box-shadow:0 12px 32px rgba(0,0,0,.6)}'+
      '#ctxPiece button{display:block;width:100%;text-align:left;background:none;border:none;padding:7px 10px;font-size:.82rem;border-radius:6px}'+
      '#ctxPiece .ttl{font-size:.72rem;color:var(--muted);padding:5px 10px}';
    (document.head||document.documentElement).appendChild(st);
    document.body.appendChild(m);
    document.addEventListener('mousedown',e=>{if(m.style.display!=='none'&&!m.contains(e.target))m.style.display='none';},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')m.style.display='none';});
  }
  m.innerHTML='';
  const t=document.createElement('div');t.className='ttl';t.textContent=name;m.appendChild(t);
  const b=document.createElement('button');b.dataset.act='steppiece';
  b.textContent='⬇ Exporter '+(occ.length>1?'ce sous-ensemble':'cette pièce')+' en STEP';
  b.title='Géométrie exacte de SEULEMENT '+(occ.length>1?'ces '+occ.length+' pièces':'cette pièce')+' (placement d’assemblage gardé).';
  b.onclick=()=>{m.style.display='none';importPieceExport(fid,occ,name);};
  m.appendChild(b);
  try{hideCtx();hideCtx3D();}catch(e){}
  m.style.display='block';ctxPlace(m,x,y);
}
/* ---- export STEP du corps : la shape vient de perBody (occFinalShape), donc
   SEULEMENT ce corps — jamais le composé de tous les corps. ---- */
async function ctxExportStep(bid){
  let nm='corps';
  try{ nm=(bodyEntryOf(bid)||{}).name||bid||'corps'; }catch(e){}
  let FR=null,lone=[];
  try{
    if(!occHas())throw new Error('OCCT indisponible (chargement en cours ou échec — servez la page en http://)');
    const sch=await stepAskSchema('Export STEP « '+nm+' »');
    if(!sch)return;
    faceEl.textContent='Export STEP « '+nm+' » : pré-test…';
    const pok=(await occExportPreflight());
    if(!pok[0])throw new Error(pok[1]||'pré-test impossible');
    FR=occFinalShape();
    let pb=(FR.perBody||[]).filter(p=>p.bodyId===bid);
    if(!pb.length)pb=lone=importLoneShapes(FR,bid); // STEP seul dans ce corps
    if(!pb.length)throw new Error('rien à exporter : aucune fonction visible de ce corps dans le rejeu (⏻ éteint ?)');
    stepSaveShapes(pb.map(p=>p.shape),nm,sch);
  }catch(e){
    const msg=String((e&&e.message)||e||'erreur');
    faceEl.textContent='Export STEP « '+nm+' » : '+msg;
    try{alert('Export STEP de « '+nm+' » impossible : '+msg);}catch(_){}
  }finally{
    try{ if(FR)occCleanup(FR,null); }catch(e){}
    lone.forEach(p=>{try{p.shape.delete();}catch(e){}});
  }
}
function ctxStepBtnMake(menuId){
  try{
    const b=document.createElement('button');
    b.dataset.act='step';
    b.textContent='⬇ Exporter ce corps en STEP';
    b.title='Géométrie exacte (OCCT) de SEULEMENT ce corps : téléchargement du fichier .step.';
    b.onclick=function(){
      const t=ctxTarget;
      try{ if(menuId==='ctxMenu')hideCtx(); else hideCtx3D(); }catch(e){}
      if(!t||t.kind!=='body'||!t.id)return;
      // En mode maillage l'id cliqué est celui de la FONCTION : le corps conteneur
      // est celui que perBody connaît (bodyId) — sans quoi aucun solide n'est trouvé.
      let cid=null;try{cid=ctxBodyId(t);}catch(e){}
      ctxExportStep(cid||t.id);
    };
    $(menuId).appendChild(b);
    return b;
  }catch(e){ return null; }
}
/* ── Style du corps dans les DEUX menus : deux miroirs d'une seule source ─────
   La coque de la vue 3D porte déjà la rangée « couleur » et la rangée
   « transparence » ; on lui ajoute le nuancier. Le menu de l'arbre est monté EN
   JS (règle du dépôt : on ne touche jamais la coque à la main). Une seule paire
   de fonctions écrit dans doc.bodies[] — donc panneau, arbre et vue 3D ne peuvent
   plus diverger, et il n'y a plus de bouton « Auto ». */
function ctxSetBodyColor(c,commit){
  try{
    const bid=ctxBodyId(ctxTarget);
    if(!bid||!(c>0))return;
    setBodyColor(bid,c);           // source unique
    applyBodyStyleLive(bid);       // écran immédiat, aucun rejeu
    try{renderTree();}catch(e){}
    ctxStyleSync();                // l' AUTRE miroir suit
    if(commit){markDirty();try{renderProps();}catch(e){}}
  }catch(e){}
}
function ctxSetBodyOp(pct,commit){
  try{
    const bid=ctxBodyId(ctxTarget);
    if(!bid)return;
    const v=Math.max(15,Math.min(100,Math.round(+pct||100)));
    setBodyOp(bid,v/100);          // source unique
    applyBodyStyleLive(bid);
    ctxStyleSync();
    if(commit){markDirty();try{renderProps();}catch(e){}}
  }catch(e){}
}
function ctxSetBodyGlass(pct,commit){
  // 2026-10-16-011 : transparence VRAIE depuis le clic droit (même source que le panneau)
  try{
    const bid=ctxBodyId(ctxTarget);if(!bid)return;
    const v=Math.max(0,Math.min(90,Math.round(+pct||0)));
    setBodyGlass(bid,1-v/100);applyBodyStyleLive(bid);try{buildEdgeOverlay();}catch(e){}
    ctxStyleSync();
    if(commit){markDirty();try{renderProps();}catch(e){}}
  }catch(e){}
}
function ctxGlassRow(menu){
  const ro=document.createElement('div');ro.className='ctxRow';
  const io=document.createElement('span');io.title='Transparence (on voit l’intérieur, identique au panneau)';io.textContent='🫧';ro.appendChild(io);
  const gi=document.createElement('input');gi.type='range';gi.min='0';gi.max='90';gi.value='0';gi.title='Transparence du corps';
  const gv=document.createElement('span');gv.className='ctxOpV';gv.textContent='0%';
  ro.appendChild(gi);ro.appendChild(gv);
  gi.addEventListener('input',()=>ctxSetBodyGlass(gi.value,false));
  gi.addEventListener('change',()=>ctxSetBodyGlass(gi.value,true));
  ctxStyleReg.push({menu,wrap:ro,g:gi,gv});
  return ro;
}
(function ctxStyleInit(){
  try{
    const wire=(c,o)=>{
      const hex=()=>{const m=/^#?([0-9a-fA-F]{6})$/.exec(String(c.value||'').trim());return m?parseInt(m[1],16):null;};
      c.addEventListener('input',()=>{const v=hex();if(v!=null)ctxSetBodyColor(v,false);});
      c.addEventListener('change',()=>{const v=hex();if(v!=null)ctxSetBodyColor(v,true);});
      o.addEventListener('input',()=>ctxSetBodyOp(o.value,false));
      o.addEventListener('change',()=>ctxSetBodyOp(o.value,true));
    };
    // 1) vue 3D — rangées existantes dans la coque + nuancier inséré entre elles
    const c3=$('ctxColor'),o3=$('ctxOp'),v3=$('ctxOpV');
    if(c3&&o3&&c3.parentElement&&o3.parentElement){
      const host=c3.parentElement.parentElement;
      const sw=swatchRow(hx=>ctxSetBodyColor(hx,true),'ctxRow');
      if(host&&host.insertBefore)host.insertBefore(sw,o3.parentElement);
      ctxStyleReg.push({menu:'ctxMenu3D',wrap:c3.parentElement,c:c3,o:o3,v:v3});
      ctxStyleReg.push({menu:'ctxMenu3D',wrap:sw,s:sw});
      wire(c3,o3);
      o3.title='Intensité du corps';try{o3.previousElementSibling.title='Intensité (estompe la pièce sur le fond)';}catch(e){}
      const g3=ctxGlassRow('ctxMenu3D');if(host&&host.insertBefore)host.insertBefore(g3,o3.parentElement.nextSibling);
    }
    // 2) arbre — rangées fabriquées en JS, en bas du menu
    const menu=$('ctxMenu');
    if(menu){
      const wrap=document.createElement('div');wrap.className='ctxWrap';
      const rc=document.createElement('div');rc.className='ctxRow';
      const ic=document.createElement('span');ic.title='Couleur du corps (la même partout)';ic.textContent='🎨';rc.appendChild(ic);
      const ci=document.createElement('input');ci.type='color';ci.value='#0a84ff';ci.title='Couleur du corps';
      rc.appendChild(ci);
      const sw=swatchRow(hx=>ctxSetBodyColor(hx,true),'ctxRow');
      const ro=document.createElement('div');ro.className='ctxRow';
      const io=document.createElement('span');io.title='Intensité du corps (estompe la pièce sur le fond)';io.textContent='🔆';ro.appendChild(io);
      const oi=document.createElement('input');oi.type='range';oi.min='15';oi.max='100';oi.value='100';
      const ov=document.createElement('span');ov.className='ctxOpV';ov.textContent='100%';
      ro.appendChild(oi);ro.appendChild(ov);
      wrap.appendChild(rc);wrap.appendChild(sw);wrap.appendChild(ro);wrap.appendChild(ctxGlassRow('ctxMenu'));
      menu.appendChild(wrap);
      ctxStyleReg.push({menu:'ctxMenu',wrap:wrap,c:ci,o:oi,v:ov});
      ctxStyleReg.push({menu:'ctxMenu',wrap:wrap,s:sw});
      wire(ci,oi);
    }
  }catch(e){}
})();
// Créés APRÈS les deux boucles ci-dessus : la boucle du runtime ne les voit donc
// pas (aucun écrasement de onclick) et le stub de test ne la passe pas non plus.
ctxStepBtn=ctxStepBtnMake('ctxMenu');
ctxStepBtn3d=ctxStepBtnMake('ctxMenu3D');
const curName=t=>{if(t.kind==='plane')return 'Plan '+t.id;if(t.kind==='cg')return (cgGet(t.id)||{}).name;if(t.kind==='sketch')return(doc.sketches.find(s=>s.id===t.id)||{}).name;if(t.kind==='feature')return(doc.features.find(f=>f.id===t.id)||{}).name;if(t.kind==='body')return String((bodies.find(b=>b.id===t.id)||{}).name||'').replace(/ · .*$/,'');return'';};

/* ---------- coupe : voir 91-coupe-section.js (axe X / Y / Z, remplissage des faces coupées) ---------- */
