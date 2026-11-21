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
  let g=null,FR=null,shown=false,lastPaint=t0,lastStep=t0,reprises=0;
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
      // V0.94.6 : une suppression de face vient de partir au calcul de fond (21). La suite serait
      // calculée sur la pièce SANS elle, puis refaite en entier à sa réponse (vraie pièce : deux fois
      // 5 s). On attend sa réponse, puis on reprend : tout ce qui la précède est déjà gardé.
      if(typeof delWkPending==='function'&&delWkPending()&&reprises<3){
        try{g.return();}catch(e){}g=null;reprises++;
        if(!shown){regenUiShow(why);shown=true;}
        regenUiSet(Math.min(seenF.size+seenS.size,total),total,'Suppression de face (calcul de fond)…','',cols);
        const fin=performance.now()+(typeof DEL_WK_DELAI==='number'?DEL_WK_DELAI:20000)+5000;
        while(delWkPending()&&performance.now()<fin){await new Promise(k=>setTimeout(k,150));if(stale())return false;}
        if(stale())return false;
        g=occFinalShapeGen(upto,true);lastPaint=lastStep=performance.now();
        continue;
      }
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
/* ---------- recalcul de fond après une modification (V0.99.52) ----------
   Demande de Fred : « maximiser les CPU », pour la timeline : modifier une fonction au début d'une grosse
   pièce figeait l'écran (SIRAP-14-003, perçage n°2 : 7,4 s ; SIRAP-14-002 : 9,3 s). Mesuré : presque tout est
   le vrai recalcul des fonctions qui suivent, une après l'autre (le rejeu d'une timeline est séquentiel).
   Les gestes de modification (fiche, fenêtres de fonction, paramètres, œil, marqueur, annulation, sortie
   d'esquisse) appellent rebuildEdit() au lieu de rebuild() : la même préchauffe que l'ouverture (occFinalShapeGen,
   mêmes clés de points de contrôle) part aussitôt. Finie dans FOND_BUDGET_MS : rebuild() tout de suite, comme
   avant. Sinon elle continue par tranches, la main rendue au navigateur entre deux fonctions : l'ancienne
   pièce reste affichée, la vue tourne, un bandeau dit où en est le calcul (sans voile : rien n'est retenu).
   À la fin, rebuild() ne fait que relire les points de contrôle. Le document change pendant ce temps
   (nouvelle modification) : la préchauffe repart sur le nouvel état. La FAO attend (faoSolidSettled).
   Un rebuild() appelé ailleurs entre deux tranches reste synchrone et juste (mêmes points de contrôle).
   ?mono, ?sansfond, banc de test (__regenSync) : rebuild() comme avant. */
const FOND_BUDGET_MS=150;  // calcul plus court : pas de fond, aucun changement visible
const FOND_TRANCHE_MS=50;  // calcul enchaîné entre deux peintures, au moins (plus si la peinture est lente)
let fondOff=false;
try{fondOff=/[?&](mono|sansfond)\b/.test(String(location.search||''));}catch(e){}
let fondN=0,fondActif=0,fondApres=[],fondDernier=null,fondT0=0;
function fondPossible(){
  try{
    if(fondOff||rebuildDepth||regenRun||!regenWarmUseful())return false;
    if(typeof buildKeyUpToDate==='function'&&buildKeyUpToDate())return false;
    return true;
  }catch(e){return false;}
}
function fondEnCours(){return fondActif>0;}
// Copie de travail du document pour le fond : projections et hôtes y sont réglés sans toucher à la pièce
// affichée (mêmes contenus = mêmes clés de points de contrôle que le rejeu final sur le vrai document).
function fondClone(){
  const c=JSON.parse(JSON.stringify(docSnapObj()));
  (doc.features||[]).forEach((f,i)=>{const g=c.features[i];if(g&&g.id===f.id){if(f._mesh)g._mesh=f._mesh;if(f._m)g._m=f._m;}});
  return c;
}
function fondAvec(clone,fn){
  // fn avec la copie pour document : rien de ce qu'elle fait ne compte comme une modification
  const d0=doc,v0=_docVersion,dt=dirty,md=markDirty,sp=_projEdgeCache;
  doc=clone;markDirty=function(){};_projEdgeCache=null;
  try{return fn();}finally{doc=d0;_docVersion=v0;dirty=dt;markDirty=md;_projEdgeCache=sp;}
}
const FOND_SONDE_MS=40;    // un rejeu partiel plus long, pendant la sonde : calculé ensuite par tranches
const FOND_TOURS_MAX=80;   // préfixes calculés pour les projections, au plus (le rejeu final fait le reste)
function fondSonde(clone,cleOff){
  // Le début de rebuildInner (hôtes, projections) joué sur la copie. → préfixe à calculer d'abord, ou null.
  // cleOff : seulement la limite de temps (une étape qui ne pose jamais de point de contrôle arrêterait chaque sonde)
  const S={limite:FOND_SONDE_MS,manque:null,cleOff:!!cleOff};
  fondAvec(clone,()=>{
    occRefSonde=S;
    try{
      try{rebuildHotes();}catch(e){}
      try{if(typeof projPreUpdate==='function'&&projPreUpdate()&&typeof cgResolveAll==='function'&&cgResolveAll())resolveAllSketchHosts();}catch(e){}
    }finally{occRefSonde=null;}
  });
  return S.manque;
}
function* fondDerouler(mk,clone,force,fant,fin){
  // un rejeu de préchauffe, une fonction par pas, sur la copie ; {attente} : suppression de face au calcul (21)
  // fant (V0.99.54) : maillages des outils de découpe faits ici (occFantomeMemo, mêmes clés) — le rejeu final
  // les reprend au lieu de les calculer d'un bloc (SIRAP-14-003, perçage n°2 : 215 ms d'écran figé en moins)
  let g=null,reprises=0;
  try{
    for(;;){
      if(!g)g=mk();
      let r;
      const skip0=occThreadSkip,sf=occStepForce,fv=occFantomesVoulus;
      try{r=fondAvec(clone,()=>{occThreadSkip=true;if(force)occStepForce=true;if(fant)occFantomesVoulus=true;return g.next();});}
      finally{occThreadSkip=skip0;occStepForce=sf;occFantomesVoulus=fv;}
      if(r.done){g=null;if(r.value){if(fin){try{fin(r.value);}catch(e){}}try{occCleanup(r.value,null);}catch(e){}}return;}
      // V0.94.6 (comme regenWarmRun) : la suite serait calculée sans la face supprimée, puis refaite
      if(typeof delWkPending==='function'&&delWkPending()&&reprises<3){
        try{g.return();}catch(e){}g=null;reprises++;
        const fin=performance.now()+(typeof DEL_WK_DELAI==='number'?DEL_WK_DELAI:20000)+5000;
        while(delWkPending()&&performance.now()<fin)yield {attente:true};
        continue;
      }
      yield r.value||{};
    }
  }finally{if(g){try{g.return();}catch(e){}}}
}
function* fondTache(upto){
  // 1. projections : sonde, préfixe manquant calculé, nouvelle sonde… ; 2. la timeline sur la copie réglée
  let clone=null,m0=null,deja=0;
  for(let tour=0;;tour++){
    if(tour>0)yield {proj:true}; // V0.99.54 : peinture entre le préfixe calculé et la sonde suivante
    clone=fondClone();
    const m=fondSonde(clone,deja>0);
    if(m==null||tour>=FOND_TOURS_MAX)break;
    deja=m===m0?deja+1:0;m0=m;
    if(deja>1)break; // le même préfixe manque encore : le rejeu final s'en charge
    yield {proj:true};
    yield* fondDerouler(()=>occFinalShapeGen(m,true),clone,true);
  }
  yield {proj:true};
  // V0.99.54 (31-fond-maillage) : faces neuves de la pièce finie maillées ici, par paquets — seulement si le fond
  // dure déjà (une petite modification finie dans le budget s'affiche tout de suite, comme avant)
  let job=null;
  yield* fondDerouler(()=>occFinalShapeGen(upto,true),clone,false,true,
    FR=>{if(performance.now()-fondT0>=FOND_BUDGET_MS)job=fondMaillagePrend(FR);});
  if(job){yield {maillage:true};yield* fondMaillageFait(job);}
}
function rebuildEdit(apres){
  // rebuild() d'une modification faite par l'utilisateur ; apres() quand la pièce affichée est à jour
  if(typeof apres==='function')fondApres.push(apres);
  try{if(typeof parApplyAll==='function')parApplyAll();}catch(e){} // comme rebuild() : cotes ƒx avant les clés
  if(!fondPossible()){fondFinir(true);return;}
  const n=++fondN;
  const etat={d:doc,v:_docVersion,m:tlMark,s:occSkipFeat,f:occStepForce,a:asmCkPrefix()};
  const stale=()=>n!==fondN||doc!==etat.d||_docVersion!==etat.v||tlMark!==etat.m||occSkipFeat!==etat.s||occStepForce!==etat.f||asmCkPrefix()!==etat.a||!occHas();
  try{importHydrate();}catch(e){}
  try{ensureBodies();}catch(e){}
  try{(doc.sketches||[]).forEach(migrateSketch);}catch(e){}
  const upto=tlReplayCount();
  const t0=performance.now();fondT0=t0;
  const budget=typeof window!=='undefined'&&window.__fondBudget!=null?+window.__fondBudget:FOND_BUDGET_MS;
  let T=fondTache(upto),fini=false;
  try{
    for(;;){
      const r=T.next();
      if(r.done){fini=true;break;}
      if(r.value&&r.value.attente)break;
      if(performance.now()-t0>=budget)break;
    }
  }catch(e){fini=true;}
  if(fini){fondFinir(true);return;} // fini dans le budget (ou erreur) : rebuild() tout de suite
  // la suite en tranches
  fondActif++;
  const tot=(doc.features||[]).filter(f=>f.visible!==false).length;
  let vus=0,proj=0,ok=false;
  const suite=async()=>{
    try{
      regenUiShow('Recalcul en arrière-plan',true);
      for(;;){
        const tf=performance.now();
        await regenFrame();
        if(stale())return;
        const t=performance.now();
        // tranche au moins aussi longue que la peinture : grosse pièce dans un navigateur sans carte graphique,
        // le fond passait plus de temps à peindre qu'à calculer (SIRAP-14-003 : 44 s pour 7 s de calcul)
        const tranche=Math.max(FOND_TRANCHE_MS,Math.min(400,t-tf));
        let att=false;
        while(performance.now()-t<tranche){
          const r=T.next();
          if(r.done){ok=true;break;}
          const v=r.value||{};
          if(v.attente){att=true;break;}
          // V0.99.54 : la sonde des projections (jusqu'à 0,5 s sur SIRAP-14-003) part sur une tranche neuve
          if(v.proj){proj++;vus=0;regenUiSet(0,tot,'esquisses projetées','');break;}
          if(v.maillage){regenUiSet(tot,tot,'Affichage du modèle…','');break;}
          const fs=v.fs||[];if(fs.length)vus++;
          const f=fs[0];
          regenUiSet(Math.min(vus,tot),tot,f?(f.name||f.type):'','');
        }
        if(ok)break;
        if(att){await new Promise(k=>setTimeout(k,150));}
      }
    }catch(e){ok=true;} // erreur : le rejeu final fait le reste, comme avant
    finally{
      try{T.return();}catch(e){}
      fondActif--;
      if((n===fondN||!fondActif)&&regenUi&&regenUi.libre)regenUiHide();
      fondDernier={ms:Math.round(performance.now()-t0),fini:ok,fonctions:vus,tours:proj};
    }
    if(n!==fondN)return; // une modification plus récente a pris le relais
    // V0.99.54 : une peinture entre la dernière fonction et l'affichage de la pièce (ils s'enchaînaient : 0,9 s
    // d'écran figé d'un bloc sur SIRAP-14-003)
    if(ok&&!stale()){try{await regenFrame();}catch(e){}if(n!==fondN)return;}
    if(ok&&!stale())fondFinir(false);
    else setTimeout(()=>{if(n===fondN)rebuildEdit();},0); // document changé autrement : on repart
  };
  suite();
}
function fondFinir(sync){
  // pièce affichée mise à jour (les points de contrôle sont prêts), puis ce qui attendait
  try{if(regenUi&&regenUi.libre)regenUiHide();}catch(e){}
  try{rebuild();}catch(e){}
  const L=fondApres.splice(0);
  L.forEach(fn=>{try{fn();}catch(e){}});
  if(!sync){
    try{renderTree();}catch(e){}
    try{ // la fiche, sauf si on y tape
      const a=document.activeElement,pp=document.getElementById('props');
      if(!(a&&pp&&pp.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)))renderProps();
    }catch(e){}
    try{refreshParts();}catch(e){}
    try{if(typeof faoRegenFlush==='function')faoRegenFlush();}catch(e){}
  }
}
try{if(typeof window!=='undefined')window.fondInfo=()=>({enCours:fondActif>0,dernier:fondDernier,off:fondOff,maillage:typeof fondMaillageDernier!=='undefined'?fondMaillageDernier:null});}catch(e){}
/* ---------- interface ---------- */
function regenKeyBlock(e){
  // Barre affichée : le rejeu est entre deux tranches, le document ne doit pas bouger.
  if(e.key==='F5'||e.key==='F12')return;
  try{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}catch(_){}
}
function regenUiShow(why,libre){
  // libre (V0.99.52, recalcul de fond) : bandeau seul, sans voile ni touches retenues
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
  try{(wrap||document.body).appendChild(b);if(!libre)document.body.appendChild(blk);}catch(e){}
  try{if(!libre)window.addEventListener('keydown',regenKeyBlock,true);}catch(e){}
  regenUi={b,blk,t:performance.now(),libre:!!libre};
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
