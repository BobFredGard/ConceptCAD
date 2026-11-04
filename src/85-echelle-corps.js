/* ---------- échelle / homothétie d'un corps (V0.36.0) ----------
   Fonction de la timeline {type:'bscale', body, o:[x,y,z], oname, s, uni, sx, sy, sz, copy, newBody?},
   comme « Échelle » de Fusion 360 : homothétie de centre o et de rapport s (uniforme), ou
   facteurs différents suivant X, Y, Z (repère de la pièce). Utile pour un STEP importé dans
   la mauvaise unité (× 25,4 pouce → mm), un retrait de moulage, une maquette à l'échelle.
   Centre : origine (défaut), centre du corps, point / repère de construction, ou point
   d'accroche cliqué sur une face (saisie partagée avec Déplacer : 85-deplacer-corps, bmPick).
   Le point choisi est FIGÉ en coordonnées, comme Déplacer.
   Résultat : le corps est MODIFIÉ (défaut) ou, « Nouveau corps », une COPIE mise à l'échelle
   naît dans un corps neuf et le corps source reste intact (même mécanique que la scission de
   corps : occSplitNewBody, 20). Rejeu (20) : uniforme → BRepBuilderAPI_Transform (gp_Trsf.
   SetScale : cylindres, plans, cercles restent exacts) ; X/Y/Z différents → BRepBuilderAPI_
   GTransform (les surfaces deviennent des B-splines — un cercle devient une ellipse). */
const BS_UNITS=[['× 2',2],['× ½',0.5],['pouce → mm (× 25,4)',25.4],['mm → pouce (÷ 25,4)',1/25.4]];
function bsFactors(f){
  // valeur absente → 1 ; un 0 saisi reste 0 (refusé au rejeu, avec avertissement)
  const n=v=>v==null||v===''||!isFinite(+v)?1:+v,s=n(f.s);
  return f.uni===false?[n(f.sx),n(f.sy),n(f.sz)]:[s,s,s];
}
function bsIsIdentity(f){return bsFactors(f).every(k=>Math.abs(k-1)<1e-12);}
function bsName(f){
  const k=bsFactors(f),t=f.uni===false?k.map(v=>bmFmt(v,4)).join(' × '):bmFmt(k[0],4);
  return 'Échelle '+t+' « '+bmBodyName(f.body)+' »'+(f.copy?' (copie)':'');
}
function occApplyBodyScale(result,f){
  // Rejeu (20) : {shape, warnings} ; le solide d'entrée est libéré si la transformation réussit
  const k=bsFactors(f),o=(f.o||[0,0,0]).map(v=>+v||0);
  if(k.some(v=>!(v>0)||!isFinite(v)))return {shape:result,warnings:['facteur nul ou négatif — le corps reste tel quel'],fatal:true};
  if(bsIsIdentity(f))return {shape:result,warnings:[]};
  let t=null,b=null,P=null;
  try{
    if(k[0]===k[1]&&k[1]===k[2]){
      t=new occt.gp_Trsf_1();P=new occt.gp_Pnt_3(o[0],o[1],o[2]);t.SetScale(P,k[0]);
      b=new occt.BRepBuilderAPI_Transform_2(result,t,true);
    }else{
      // p' = o + K·(p − o) : diagonale K, translation o − K·o
      t=new occt.gp_GTrsf_1();
      for(let i=0;i<3;i++){t.SetValue(i+1,i+1,k[i]);t.SetValue(i+1,4,o[i]*(1-k[i]));}
      b=new occt.BRepBuilderAPI_GTransform_2(result,t,true);
      if(!b.IsDone())throw new Error('transformation refusée');
    }
    const s=b.Shape();if(!s||s.IsNull())throw new Error('transformation vide');
    nomsMemeRangs(result,s);
    try{result.delete();}catch(e){}
    return {shape:s,warnings:[]};
  }catch(e){
    return {shape:result,warnings:['mise à l’échelle impossible ('+((e&&e.message)||e)+')'],fatal:true};
  }finally{try{if(b)b.delete();}catch(e){}try{if(t)t.delete();}catch(e){}try{if(P)P.delete();}catch(e){}}
}
/* ── commande ── */
function openBodyScale(bid){
  try{ensureBodies();}catch(e){}
  const id=bid&&(doc.bodies||[]).some(b=>b.id===bid)?bid:(doc.activeBody&&(doc.bodies||[]).some(b=>b.id===doc.activeBody)?doc.activeBody:((doc.bodies||[])[0]||{}).id);
  if(!id){try{faceEl.textContent='Échelle : aucun corps.';}catch(e){}return null;}
  if(!(doc.features||[]).some(f=>f.body===id&&f.visible!==false)){try{faceEl.textContent='Échelle : « '+bmBodyName(id)+' » est vide.';}catch(e){}return null;}
  bmPickExit(true);
  const f={id:uid('bs'),type:'bscale',name:'',body:id,o:[0,0,0],oname:'Origine',s:2,uni:true,sx:1,sy:1,sz:1,copy:false,visible:true};
  f.name=bsName(f);
  addFeature(f);
  sel={kind:'feature',id:f.id};treeSel=[f.id];
  markDirty();rebuild();renderTree();renderProps();
  try{faceEl.textContent='Échelle « '+bmBodyName(id)+' » : réglez le facteur et le centre (origine, point, centre du corps) dans le panneau.';}catch(e){}
  return f;
}
function bsChange(f,label,fn){
  // Une modification = une étape d'annulation + rejeu
  docPushUndo(label+' (« '+f.name+' »)');
  fn();f.name=bsName(f);
  markDirty();rebuild();renderTree();renderProps();
}
function bsSetCentre(f,it){
  if(occSkipFeat===f.id)occSkipFeat=null; // fin de la saisie : l'échelle revient dans le rejeu
  bsChange(f,'centre de l’échelle',()=>{f.o=it.p.slice();f.oname=it.name;});
  try{faceEl.textContent='Échelle : centre = '+it.name+' '+bmP(it.p)+'.';}catch(e){}
}
function bsWithout(f,fn){
  // Rejeu SANS l'échelle (occSkipFeat, comme l'édition d'un congé) : le centre du corps et les
  // points d'accroche se lisent sur le corps d'ORIGINE, pas sur le corps déjà mis à l'échelle.
  occSkipFeat=f.id;markDirty();rebuild();
  return fn();
}
function bsPickCentre(f){bsWithout(f,()=>bmPickStart(f,'center'));}
function bsBodyCentre(f){
  let c=null;
  try{c=bsWithout(f,()=>bmBodyCentre(f.body));}finally{occSkipFeat=null;}
  if(c)bsSetCentre(f,{name:'Centre de « '+bmBodyName(f.body)+' »',p:c});
  else{markDirty();rebuild();}
}
function bsSetCopy(f,on){
  // « Nouveau corps » : corps neuf créé à la première activation, retiré s'il ne porte plus rien
  bsChange(f,on?'échelle en nouveau corps':'échelle sur le corps',()=>{
    if(on){f.copy=true;if(!f.newBody||!(doc.bodies||[]).some(b=>b.id===f.newBody))f.newBody=splitNewBodyFor(f.body);}
    else{f.copy=false;if(f.newBody){const nb=f.newBody;delete f.newBody;splitOnDelete({type:'bscale',newBody:nb});}}
  });
}
/* ── panneau ── */
function bscaleProps(p,f){
  const mk=(tag,cls,txt)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(txt!=null)d.textContent=txt;return d;};
  const Row=(lab,ctl)=>{const r=mk('div','pnl-row');r.appendChild(mk('label',null,lab));if(ctl)r.appendChild(ctl);p.appendChild(r);return r;};
  const num=(v,fn,w)=>{const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.style.width=(w||70)+'px';i.value=bmFmt(v,6);
    const go=()=>{const x=parseFloat(String(i.value).replace(',','.'));if(!(x>0)||!isFinite(x)){i.value=bmFmt(v,6);try{faceEl.textContent='Échelle : le facteur doit être strictement positif.';}catch(e){}return;}if(x!==+v)fn(x);};
    i.addEventListener('change',go);i.addEventListener('keydown',e=>{if(e.key==='Enter')go();});return i;};
  const btn=(txt,title,fn,cls)=>{const b=mk('button',cls||'mini',txt);if(title)b.title=title;b.onclick=fn;return b;};
  const set=(label,fn)=>bsChange(f,label,fn);
  p.appendChild(mk('div','pnl-h','⤡ Échelle / homothétie'));
  const sb=document.createElement('select');
  (doc.bodies||[]).filter(b=>b.id!==f.newBody).forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=b.name;if(b.id===f.body)o.selected=true;sb.appendChild(o);});
  sb.onchange=()=>set('corps mis à l’échelle',()=>{f.body=sb.value;});
  Row('Corps',sb);
  // résultat : modifier le corps ou créer un corps neuf
  const rs=document.createElement('select');
  [['mod','Modifier le corps'],['new','Nouveau corps (copie)']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if((f.copy?'new':'mod')===v)o.selected=true;rs.appendChild(o);});
  rs.onchange=()=>bsSetCopy(f,rs.value==='new');
  Row('Résultat',rs);
  if(f.copy&&f.newBody)p.appendChild(mk('div','pnl-note','La copie est dans « '+bmBodyName(f.newBody)+' » ; « '+bmBodyName(f.body)+' » reste intact.'));
  // type et facteur(s)
  const ts=document.createElement('select');
  [['u','Uniforme (homothétie)'],['n','Non uniforme (X, Y, Z)']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if((f.uni===false?'n':'u')===v)o.selected=true;ts.appendChild(o);});
  ts.onchange=()=>set('type d’échelle',()=>{
    if(ts.value==='n'){f.uni=false;const s=+f.s||1;f.sx=f.sy=f.sz=s;}
    else{f.uni=true;f.s=+f.sx||1;}
  });
  Row('Type',ts);
  if(f.uni!==false){
    Row('Facteur',num(f.s,x=>set('facteur d’échelle',()=>{f.s=x;})));
    const b=mk('div','pnl-btns');
    BS_UNITS.forEach(([t,k])=>b.appendChild(btn(t,null,()=>set('facteur d’échelle',()=>{f.s=+(k===2||k===0.5?(+f.s||1)*k:k).toPrecision(12);}))));
    p.appendChild(b);
  }else{
    [['X','sx'],['Y','sy'],['Z','sz']].forEach(([lab,key])=>Row('Facteur '+lab,num(f[key],x=>set('facteur '+lab,()=>{f[key]=x;}))));
    p.appendChild(mk('div','pnl-note','Non uniforme : les cylindres deviennent elliptiques (surfaces B-spline).'));
  }
  // centre
  const P=bmPick&&bmPick.fid===f.id?bmPick:null;
  p.appendChild(mk('div','pnl-h','Centre'));
  p.appendChild(mk('div','pnl-note',(f.oname||'Point')+' '+bmP(f.o||[0,0,0])+' mm'));
  if(!P){
    const b=mk('div','pnl-btns');
    b.appendChild(btn('Origine','Centre = origine du repère',()=>bsSetCentre(f,{name:'Origine',p:[0,0,0]})));
    b.appendChild(btn('Centre du corps','Centre de gravité du corps',()=>bsBodyCentre(f)));
    b.appendChild(btn('⊙ Choisir un point…','Point de construction, repère, ou point d’accroche d’une face (coin, centre de cercle…)',()=>bsPickCentre(f)));
    p.appendChild(b);
    // coordonnées du centre, réglables à la main
    ['X','Y','Z'].forEach((k,j)=>{
      const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.style.width='70px';const o=f.o||[0,0,0];i.value=bmFmt(o[j]);
      const go=()=>{const x=parseFloat(String(i.value).replace(',','.'));if(isFinite(x)&&x!==+o[j])set('centre de l’échelle',()=>{f.o=(f.o||[0,0,0]).slice();f.o[j]=x;f.oname='Point';});};
      i.addEventListener('change',go);i.addEventListener('keydown',e=>{if(e.key==='Enter')go();});
      Row(k+' (mm)',i);
    });
    return;
  }
  // saisie du centre en cours (vue ou liste)
  const list=(items,name)=>{const b=mk('div','pnl-btns');items.forEach(it=>b.appendChild(btn(name(it),null,()=>bmChoosePt(it))));p.appendChild(b);};
  if(P.face){p.appendChild(mk('div','pnl-note',P.face.name+' :'));list(P.face.pts,it=>it.name.replace(/^.*? · /,''));}
  p.appendChild(mk('div','pnl-note','Points de référence :'));
  list(bmStaticPts(),it=>it.name);
  p.appendChild(mk('div','pnl-note','Ou cliquez une face dans la vue.'));
  const c=mk('div','pnl-btns');c.appendChild(btn('Annuler',null,()=>bmPickExit(false)));p.appendChild(c);
}
/* ── menus contextuels (arbre et vue) : « ⤡ Échelle… » sur un corps, juste après « Déplacer… » ── */
const bsCtxBtns={};
function bsCtxSync(menuId,t){
  const m=document.getElementById(menuId);if(!m)return;
  let b=bsCtxBtns[menuId];
  if(!b){
    b=document.createElement('button');b.textContent='⤡ Échelle…';
    b.title='Échelle / homothétie du corps, centre au choix (fonction de la timeline)';
    const mv=bmCtxBtns[menuId];
    let step=null;try{step=menuId==='ctxMenu3D'?ctxStepBtn3d:ctxStepBtn;}catch(e){}
    if(mv&&mv.parentNode===m)m.insertBefore(b,mv.nextSibling);else m.insertBefore(b,step&&step.parentNode===m?step:null);
    b.onclick=()=>{const T=b._t;try{hideCtx();hideCtx3D();}catch(e){}if(T)openBodyScale(ctxBodyId(T)||T.id);};
    bsCtxBtns[menuId]=b;
  }
  b._t=t;
  b.style.display=(t&&t.kind==='body'&&t.id&&asmMode!=='asm')?'':'none';
}
// bouton (rangé dans « Ensembles » par 96-bandeau-groupes ; ruban moderne : 97)
(function(){
  try{
    if(document.getElementById('btnBodyScale'))return;
    const ref=document.getElementById('btnBodyMove')||document.getElementById('btnExtrude');
    if(!ref||!ref.parentNode)return;
    const b=document.createElement('button');b.id='btnBodyScale';b.textContent='⤡ Échelle';
    b.title='Échelle / homothétie du corps actif : facteur uniforme ou X, Y, Z ; centre = origine, point ou centre du corps';
    b.onclick=()=>{const t=(typeof sel!=='undefined'&&sel&&sel.kind==='body')?sel.id:null;openBodyScale(t);};
    ref.parentNode.insertBefore(b,ref.nextSibling);
  }catch(e){}
})();
