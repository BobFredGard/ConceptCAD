/* ---------- Régénération avec barre de progression (V0.41.0) ----------
   Le rejeu exact est SYNCHRONE : tant qu'il calcule, le navigateur ne repeint rien — sur un gros
   document (noyau chargé, fichier ouvert) l'écran restait figé plusieurs secondes sans rien dire.
   Plutôt que de rendre rebuild() asynchrone (une centaine d'appelants comptent sur un solide à
   jour au retour), on PRÉCHAUFFE : le même rejeu (occFinalShapeGen, src/20) est vidé fonction par
   fonction, en rendant la main au navigateur entre deux tranches pour peindre la barre (n / total
   + nom de la fonction et de son esquisse). Il remplit les points de contrôle (occCk) aux MÊMES
   clés que le rejeu final ; rebuild() ne fait ensuite que relire ces copies et mailler l'affichage.
   Même code, même ordre : le solide est identique (le filet featSig le garantit déjà pour le
   rejeu rapide). La préchauffe ne touche ni à bodies, ni à occLive, ni au document : abandonnée si
   le document change pendant une pause, le rejeu final refait simplement ce qui manque.
   La barre n'apparaît qu'après REGEN_SHOW_MS (pas de clignotement sur les petites pièces) ; tant
   qu'elle est là, clics et touches sont retenus (pas d'édition ni d'annulation au milieu). */
const REGEN_SHOW_MS=300;
let regenRun=null,regenUi=null;
function regenWarmUseful(){
  try{
    if(typeof document==='undefined'||!document.body||!document.createElement)return false;
    if(typeof window!=='undefined'&&window.__regenSync)return false; // banc de test (tests/appvm)
    return !!(occHas()&&!freshHard&&!occPrefixTap&&doc&&doc.features&&doc.features.length);
  }catch(e){return false;}
}
function regenFrame(){
  // Une peinture : rAF puis tâche suivante. Filet setTimeout : panneau masqué = rAF suspendu.
  return new Promise(r=>{let ok=false;const k=()=>{if(!ok){ok=true;r();}};
    try{requestAnimationFrame(()=>setTimeout(k,0));}catch(e){}setTimeout(k,60);});
}
function regenSketchIds(f){const o=[];if(f.sketchId)o.push(f.sketchId);if(f.pathId&&f.pathId!==f.sketchId)o.push(f.pathId);return o;}
function regenWarm(why){
  // Promesse → true si la préchauffe est allée au bout. La barre reste affichée (« Affichage du
  // modèle… ») pour le rejeu final : l'appelant appelle regenUiHide() après son rebuild().
  if(regenRun)return regenRun;
  if(!regenWarmUseful())return Promise.resolve(false);
  regenRun=regenWarmRun(why).catch(()=>false).finally(()=>{regenRun=null;});
  return regenRun;
}
async function regenWarmRun(why){
  const t0=performance.now();
  // Normalisations légères du début de rebuildInner (signatures identiques au rejeu final)
  try{importHydrate();}catch(e){}
  try{ensureBodies();}catch(e){}
  try{(doc.sketches||[]).forEach(migrateSketch);}catch(e){}
  const d0=doc,v0=_docVersion,m0=tlMark,s0=occSkipFeat,f0=occStepForce,a0=asmCkPrefix();
  const stale=()=>doc!==d0||_docVersion!==v0||tlMark!==m0||occSkipFeat!==s0||occStepForce!==f0||asmCkPrefix()!==a0||!occHas();
  const upto=tlReplayCount();
  const feats=doc.features.filter(f=>f.visible!==false);
  const list=(upto==null?feats:feats.slice(0,upto)).filter(f=>!(occSkipFeat&&f.id===occSkipFeat));
  const skName={};(doc.sketches||[]).forEach(s=>{skName[s.id]=s.name||'Esquisse';});
  const skAll=new Set();list.forEach(f=>regenSketchIds(f).forEach(id=>{if(skName[id]!=null)skAll.add(id);}));
  const total=list.length+skAll.size,seenF=new Set(),seenS=new Set();
  let g=null,FR=null,shown=false,lastPaint=t0,lastStep=t0;
  try{
    g=occFinalShapeGen(upto,true);
    for(;;){
      let r;const skip0=occThreadSkip;
      // occThreadSkip est global : un rejeu synchrone glissé dans une pause l'a pu reposer
      try{occThreadSkip=true;r=g.next();}finally{occThreadSkip=skip0;}
      if(r.done){FR=r.value;break;}
      const fs=(r.value&&r.value.fs)||[];
      const nouv=[];
      fs.forEach(f=>{seenF.add(f.id);regenSketchIds(f).forEach(id=>{if(skAll.has(id)&&!seenS.has(id)){seenS.add(id);nouv.push(skName[id]);}});});
      const now=performance.now(),pas=now-lastStep;lastStep=now;
      if(!shown&&now-t0>=REGEN_SHOW_MS){regenUiShow(why);shown=true;}
      if(!shown)continue; // rien à peindre : pas de pause (aucune entrée possible non plus)
      const f=fs[0];
      const nom=f?(f.name||f.type)+(fs.length>1?' (+'+(fs.length-1)+' copie'+(fs.length>2?'s':'')+')':''):'';
      regenUiSet(Math.min(seenF.size+seenS.size,total),total,nom,nouv.join(', '));
      // Pause seulement si la fonction précédente a pesé (le nom de la suivante doit être LU
      // pendant qu'elle calcule) ou si l'écran n'a pas bougé depuis 100 ms.
      if(pas>8||now-lastPaint>=100){
        await regenFrame();lastPaint=lastStep=performance.now();
        if(stale()){try{g.return();}catch(e){}g=null;return false;}
      }
    }
  }catch(e){
    if(g){try{g.return();}catch(_){}}
    return false;
  }finally{
    if(FR){try{occCleanup(FR,null);}catch(e){}} // copies jetables : le rejeu final relit les points de contrôle
  }
  if(shown){regenUiSet(total,total,'Affichage du modèle…','');await regenFrame();}
  return true;
}
/* ---------- interface ---------- */
function regenKeyBlock(e){
  // Barre affichée : le rejeu est entre deux tranches, le document ne doit pas bouger.
  if(e.key==='F5'||e.key==='F12')return;
  try{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}catch(_){}
}
function regenUiShow(why){
  if(regenUi)return;
  const o=document.createElement('div');o.id='mfRegen';
  o.style.cssText='position:fixed;inset:0;z-index:9800;cursor:progress;background:transparent';
  o.innerHTML='<div role="progressbar" aria-valuemin="0" style="position:absolute;left:50%;bottom:56px;transform:translateX(-50%);width:min(440px,calc(100vw - 32px));box-sizing:border-box;'+
    'background:var(--surface,#2c2c2e);color:var(--text,#f2f2f7);border:1px solid var(--border,rgba(255,255,255,.12));border-radius:12px;padding:12px 16px 14px;'+
    'box-shadow:0 12px 32px rgba(0,0,0,.45);font-size:13px;backdrop-filter:blur(8px)">'+
    '<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:8px">'+
      '<b class="t" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></b><span class="n" style="color:var(--muted,#98989d);font-variant-numeric:tabular-nums;white-space:nowrap"></span></div>'+
    '<div style="height:6px;border-radius:3px;background:var(--border,rgba(255,255,255,.12));overflow:hidden">'+
      '<div class="b" style="height:100%;width:0;border-radius:3px;background:var(--primary,#0a84ff);transition:width .12s linear"></div></div>'+
    '<div class="f" style="margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>'+
    '<div class="s" style="margin-top:2px;color:var(--muted,#98989d);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div></div>';
  try{o.querySelector('.t').textContent='⟳ '+(why||'Régénération');}catch(e){}
  try{document.body.appendChild(o);}catch(e){}
  try{window.addEventListener('keydown',regenKeyBlock,true);}catch(e){}
  regenUi=o;
}
function regenUiSet(n,total,nom,esq){
  const o=regenUi;if(!o)return;
  try{
    const p=total>0?Math.round(100*n/total):100;
    o.querySelector('.b').style.width=p+'%';
    o.querySelector('.n').textContent=n+' / '+total;
    o.querySelector('.f').textContent=nom||'';
    o.querySelector('.s').textContent=esq?'Esquisse : '+esq:'';
    const pb=o.firstChild;pb.setAttribute('aria-valuemax',String(total));pb.setAttribute('aria-valuenow',String(n));pb.setAttribute('aria-valuetext',nom||'');
  }catch(e){}
}
function regenUiHide(){
  if(!regenUi)return;
  try{window.removeEventListener('keydown',regenKeyBlock,true);}catch(e){}
  try{regenUi.remove();}catch(e){}
  regenUi=null;
}
