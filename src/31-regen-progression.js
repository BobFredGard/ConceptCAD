/* ---------- Régénération avec barre de progression (V0.42.0) ----------
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
   qu'elle est là, clics et touches sont retenus (pas d'édition ni d'annulation au milieu).
   V0.44.4 (demande de Fred) : sur ⟳ Régénérer, geste explicite, la barre paraît dès le clic et
   reste au moins REGEN_MIN_MS — le rejeu d'une pièce courante (~0,3 s) passait sous le seuil. */
const REGEN_SHOW_MS=300,REGEN_MIN_MS=500;
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
function regenCol(kind,o){
  // Couleur de l'étape dans la timeline (41, TLB_COL) : vert ajout, rouge enlèvement, orange
  // esquisse, bleu clair modification, violet répétition, jaune construction.
  try{const k=tlbSvgKey({kind,o});if(k&&TLB_COL[k[1]])return TLB_COL[k[1]];}catch(e){}
  return kind==='sketch'?'#ff9f0a':'#64d2ff';
}
function regenSketchIds(f){const o=[];if(f.sketchId)o.push(f.sketchId);if(f.pathId&&f.pathId!==f.sketchId)o.push(f.pathId);return o;}
function regenWarm(why,tout){
  // Promesse → true si la préchauffe est allée au bout. La barre reste affichée (« Affichage du
  // modèle… ») pour le rejeu final : l'appelant appelle regenUiHide() après son rebuild().
  // tout : barre affichée d'emblée (⟳ Régénérer), sans attendre REGEN_SHOW_MS.
  if(regenRun)return regenRun;
  if(!regenWarmUseful())return Promise.resolve(false);
  regenRun=regenWarmRun(why,tout).catch(()=>false).finally(()=>{regenRun=null;});
  return regenRun;
}
async function regenWarmRun(why,tout){
  const t0=performance.now(),seuil=tout?0:REGEN_SHOW_MS;
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
  const cols=[]; // couleurs des étapes traitées, dans l'ordre : la dernière colore la barre
  let g=null,FR=null,shown=false,lastPaint=t0,lastStep=t0;
  if(tout){
    // peinte avant la première fonction : elle peut à elle seule durer
    regenUiShow(why);shown=true;regenUiSet(0,total,'','',[]);
    await regenFrame();lastPaint=lastStep=performance.now();
    if(stale())return false;
  }
  try{
    g=occFinalShapeGen(upto,true);
    for(;;){
      let r;const skip0=occThreadSkip;
      // occThreadSkip est global : un rejeu synchrone glissé dans une pause l'a pu reposer
      try{occThreadSkip=true;r=g.next();}finally{occThreadSkip=skip0;}
      if(r.done){FR=r.value;break;}
      const fs=(r.value&&r.value.fs)||[];
      const nouv=[];
      fs.forEach(f=>{
        regenSketchIds(f).forEach(id=>{if(skAll.has(id)&&!seenS.has(id)){seenS.add(id);nouv.push(skName[id]);cols.push(regenCol('sketch',null));}});
        if(!seenF.has(f.id)){seenF.add(f.id);cols.push(regenCol('feature',f));}
      });
      const now=performance.now(),pas=now-lastStep;lastStep=now;
      if(!shown&&now-t0>=seuil){regenUiShow(why);shown=true;}
      if(!shown)continue; // rien à peindre : pas de pause (aucune entrée possible non plus)
      const f=fs[0];
      const nom=f?(f.name||f.type)+(fs.length>1?' (+'+(fs.length-1)+' copie'+(fs.length>2?'s':'')+')':''):'';
      regenUiSet(Math.min(seenF.size+seenS.size,total),total,nom,nouv.join(', '),cols);
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
  if(shown){regenUiSet(total,total,'Affichage du modèle…','',['var(--primary,#0a84ff)']);await regenFrame();}
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
  // V0.43.1 (demande de Fred) : BANDEAU tout en bas de la vue 3D, juste au-dessus de la timeline,
  // barre en couleur avec le texte dedans, un peu transparente (la pièce se devine dessous). Dans #vpwrap : l'écran de démarrage (#mfSplash) reste
  // devant. Un voile transparent sur toute la fenêtre retient les clics (pas d'édition au milieu).
  const blk=document.createElement('div');blk.id='mfRegenBlk';
  blk.style.cssText='position:fixed;inset:0;z-index:9800;cursor:progress;background:transparent';
  const wrap=document.getElementById('vpwrap');
  const b=document.createElement('div');b.id='mfRegen';b.setAttribute('role','progressbar');b.setAttribute('aria-valuemin','0');
  let bas=8;
  try{
    // posé au-dessus de la timeline si elle est affichée (CAO), sinon en pied de vue
    const tl=document.getElementById('mfTl'),tb=tl&&tl.getBoundingClientRect(),wb=wrap&&wrap.getBoundingClientRect();
    if(tb&&wb&&tb.height>0&&tl.offsetParent)bas=Math.max(8,Math.round(wb.bottom-tb.top)+6);
  }catch(e){}
  b.style.cssText=(wrap?'position:absolute;':'position:fixed;z-index:9801;')+'left:12px;right:12px;bottom:'+bas+'px;z-index:26;height:24px;border-radius:7px;overflow:hidden;'+
    'background:color-mix(in srgb,var(--surface,#2c2c2e) 55%,transparent);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid var(--border,rgba(255,255,255,.14));box-shadow:0 4px 16px rgba(0,0,0,.25);font-size:12px;line-height:24px;pointer-events:none';
  // Texte en double : couleur du thème sur le fond, blanc sur la partie remplie (découpée à la largeur)
  const ligne=c=>'<div class="'+c+'" style="position:absolute;inset:0;display:flex;gap:10px;padding:0 10px;white-space:nowrap'+
    (c==='l2'?';color:#fff;text-shadow:0 0 3px rgba(0,0,0,.75),0 1px 2px rgba(0,0,0,.5);clip-path:inset(0 100% 0 0)':';color:var(--text,#f2f2f7)')+'">'+
    '<span class="tx" style="flex:1;overflow:hidden;text-overflow:ellipsis"></span><span class="n" style="font-variant-numeric:tabular-nums"></span></div>';
  // Remplissage : couleur de la timeline de la fonction EN COURS (change à chaque étape), découpé à l'avancement
  b.innerHTML='<div class="b" style="position:absolute;inset:0;opacity:.78;background-color:var(--primary,#0a84ff);clip-path:inset(0 100% 0 0);transition:clip-path .12s linear,background-color .25s ease"></div>'+ligne('l1')+ligne('l2');
  b._why=why||'Régénération';
  try{(wrap||document.body).appendChild(b);document.body.appendChild(blk);}catch(e){}
  try{window.addEventListener('keydown',regenKeyBlock,true);}catch(e){}
  regenUi={b,blk,t:performance.now()};
  regenUiSet(0,0,'','');
}
function regenUiHold(ms){
  // Laisse la barre à l'écran au moins ms depuis son apparition (le temps de la lire)
  const u=regenUi;if(!u)return Promise.resolve();
  const r=ms-(performance.now()-u.t);
  return r>0?new Promise(k=>setTimeout(k,r)):Promise.resolve();
}
function regenUiSet(n,total,nom,esq,cols){
  const u=regenUi;if(!u)return;
  try{
    const b=u.b,p=total>0?Math.round(100*n/total):0;
    const tx='⟳ '+b._why+(nom?' — '+nom:'')+(esq?'  ·  esquisse : '+esq:'');
    const fill=b.querySelector('.b');
    if(cols&&cols.length)fill.style.backgroundColor=cols[cols.length-1]; // fonction traitée à l'instant
    fill.style.clipPath='inset(0 '+(100-p)+'% 0 0)';
    b.querySelector('.l2').style.clipPath='inset(0 '+(100-p)+'% 0 0)';
    b.querySelectorAll('.tx').forEach(e=>{e.textContent=tx;});
    b.querySelectorAll('.n').forEach(e=>{e.textContent=total?n+' / '+total:'';});
    b.setAttribute('aria-valuemax',String(total));b.setAttribute('aria-valuenow',String(n));b.setAttribute('aria-valuetext',tx);
  }catch(e){}
}
function regenUiHide(){
  if(!regenUi)return;
  try{window.removeEventListener('keydown',regenKeyBlock,true);}catch(e){}
  try{regenUi.b.remove();}catch(e){}
  try{regenUi.blk.remove();}catch(e){}
  regenUi=null;
}
