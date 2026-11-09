/* ---------- symétrie d'un corps entier ----------
   Fonction de la timeline {type:'bmirror', body, plane:'YZ'|'XZ'|'XY'}, comme « Symétrie » de
   Fusion 360 appliquée à un corps : le corps tel qu'il est à cet endroit, toute son histoire
   comprise (combinaisons, congés…), est copié en miroir et réuni à lui-même. La Répétition
   « Symétrie » rejoue des fonctions une à une et refuse les opérations de corps entier :
   celle-ci les prend toutes. Plans de l'origine ; un corps qui ne touche pas le plan donne
   deux solides dans le même corps. */
const BMIR_N={YZ:[1,0,0],XZ:[0,1,0],XY:[0,0,1]};
function bmirPlane(f){return BMIR_N[f&&f.plane]?f.plane:'YZ';}
function bmirName(f){return 'Symétrie '+bmirPlane(f)+' « '+bmBodyName(f.body)+' »';}
function occApplyBodyMirror(result,f){
  // Rejeu (20) : {shape, warnings} ; le solide d'entrée est libéré si la symétrie réussit
  const n=BMIR_N[bmirPlane(f)];
  let P=null,D=null,A=null,t=null,b=null,fu=null;
  try{
    P=new occt.gp_Pnt_3(0,0,0);D=new occt.gp_Dir_4(n[0],n[1],n[2]);A=new occt.gp_Ax2_3(P,D);
    t=new occt.gp_Trsf_1();t.SetMirror_3(A);
    b=new occt.BRepBuilderAPI_Transform_2(result,t,true);
    const m=b.Shape();if(!m||m.IsNull())throw new Error('copie en miroir vide');
    fu=occFuse(result,m);
    const s=occUnify(fu);if(!s||s.IsNull())throw new Error('réunion vide');
    try{result.delete();}catch(e){}
    return {shape:s,warnings:[]};
  }catch(e){
    return {shape:result,warnings:['symétrie impossible ('+((e&&e.message)||e)+')'],fatal:true};
  }finally{[fu,b,t,A,D,P].forEach(o=>{try{if(o)o.delete();}catch(e){}});}
}
function openBodyMirror(bid){
  try{ensureBodies();}catch(e){}
  const has=id=>id&&(doc.bodies||[]).some(b=>b.id===id);
  const id=has(bid)?bid:(has(doc.activeBody)?doc.activeBody:((doc.bodies||[])[0]||{}).id);
  if(!id){try{faceEl.textContent='Symétrie : aucun corps.';}catch(e){}return null;}
  if(!(doc.features||[]).some(f=>f.body===id&&f.visible!==false)){try{faceEl.textContent='Symétrie : « '+bmBodyName(id)+' » est vide.';}catch(e){}return null;}
  const f={id:uid('bm'),type:'bmirror',name:'',body:id,plane:'YZ',visible:true};
  f.name=bmirName(f);
  addFeature(f);
  sel={kind:'feature',id:f.id};treeSel=[f.id];
  markDirty();rebuild();renderTree();renderProps();
  try{faceEl.textContent='Symétrie « '+bmBodyName(id)+' » : choisissez le plan dans le panneau.';}catch(e){}
  return f;
}
function bmirrorProps(p,f){
  const mk=(tag,cls,txt)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(txt!=null)d.textContent=txt;return d;};
  const Row=(lab,ctl)=>{const r=mk('div','pnl-row');r.appendChild(mk('label',null,lab));r.appendChild(ctl);p.appendChild(r);};
  const set=(label,fn)=>{docPushUndo(label+' (« '+f.name+' »)');fn();f.name=bmirName(f);markDirty();rebuild();renderTree();renderProps();};
  p.appendChild(mk('div','pnl-h','◫ Symétrie du corps'));
  const sb=document.createElement('select');
  (doc.bodies||[]).forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=b.name;if(b.id===f.body)o.selected=true;sb.appendChild(o);});
  sb.onchange=()=>set('corps de la symétrie',()=>{f.body=sb.value;});
  Row('Corps',sb);
  const ps=document.createElement('select');
  [['YZ','Plan YZ (X → −X)'],['XZ','Plan XZ (Y → −Y)'],['XY','Plan XY (Z → −Z)']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(bmirPlane(f)===v)o.selected=true;ps.appendChild(o);});
  ps.onchange=()=>set('plan de la symétrie',()=>{f.plane=ps.value;});
  Row('Plan',ps);
  p.appendChild(mk('div','pnl-note','Le corps et sa copie en miroir sont réunis. Tout ce qui précède dans le corps est pris, combinaisons et congés compris.'));
}
/* ── menus contextuels (arbre et vue) : « ◫ Symétrie… » sur un corps, après « Échelle… » ── */
const bmirCtxBtns={};
function bmirCtxSync(menuId,t){
  const m=document.getElementById(menuId);if(!m)return;
  let b=bmirCtxBtns[menuId];
  if(!b){
    b=document.createElement('button');b.textContent='◫ Symétrie…';
    b.title='Copie le corps en miroir et le réunit à lui-même (fonction de la timeline)';
    const av=bsCtxBtns[menuId];
    let step=null;try{step=menuId==='ctxMenu3D'?ctxStepBtn3d:ctxStepBtn;}catch(e){}
    if(av&&av.parentNode===m)m.insertBefore(b,av.nextSibling);else m.insertBefore(b,step&&step.parentNode===m?step:null);
    b.onclick=()=>{const T=b._t;try{hideCtx();hideCtx3D();}catch(e){}if(T)openBodyMirror(ctxBodyId(T)||T.id);};
    bmirCtxBtns[menuId]=b;
  }
  b._t=t;
  b.style.display=(t&&t.kind==='body'&&t.id&&asmMode!=='asm')?'':'none';
}
// bouton (rangé dans « Ensembles » par 96-bandeau-groupes ; ruban moderne : 97)
(function(){
  try{
    if(document.getElementById('btnBodyMirror'))return;
    const ref=document.getElementById('btnBodyScale')||document.getElementById('btnExtrude');
    if(!ref||!ref.parentNode)return;
    const b=document.createElement('button');b.id='btnBodyMirror';b.textContent='◫ Symétrie';
    b.title='Symétrie du corps actif : copie en miroir réunie au corps, toute son histoire comprise';
    b.onclick=()=>{const t=(typeof sel!=='undefined'&&sel&&sel.kind==='body')?sel.id:null;openBodyMirror(t);};
    ref.parentNode.insertBefore(b,ref.nextSibling);
  }catch(e){}
})();
