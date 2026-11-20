/* ---------- vues de la mise en plan sur plusieurs cœurs (V0.99.50) ----------
   Demande de Fred : « faire pareil [que la FAO] pour la mise à jour des vues de la mise en plan ».
   Mesuré sur la barquette SIRAP-14-001 : 3 vues, 21 s d'écran figé, dont 98 % dans le seul calcul
   des arêtes vues et cachées du noyau (HLRAppli_ReflectLines.Perform : 0,8 s, 4,6 s, 15,4 s).
   Chaque vue part dans son worker (noyau normal, comme la suppression de face) : les vues se
   calculent en même temps et l'écran reste libre. Le worker rend les arêtes en points 3D, échantillonnées
   par le MÊME code que la page (occHlrEdgePts) sur le solide relu en BRep binaire exact ; la page
   projette, reconnaît les cercles et classe les tangentes comme avant (98-mep-10, mepHlrEmit).
   Autant de workers que de vues à calculer, dans la limite des cœurs moins un (l'écran), plafond
   HLR_WK_MAX pour la mémoire (un noyau par worker). Le noyau multicœur de la page (4 fils par
   défaut) n'y change rien : le calcul des arêtes cachées n'est pas parallèle dans le noyau.
   Les workers restent prêts HLR_WK_REPOS après le dernier calcul, puis sont arrêtés.
   Pas de worker, échec, délai : null — la page calcule la vue comme avant. */
const HLR_WK_MAX=16;
const HLR_WK_DELAI=600000; // ms : au-delà, le worker est arrêté et la vue calculée par la page
const HLR_WK_REPOS=60000;  // ms sans travail avant d'arrêter les workers (mémoire rendue)
let hlrWkOff=false;        // ?mono, ou démarrage impossible
try{ hlrWkOff=/[?&]mono\b/.test(String(location.search||'')); }catch(e){}
let hlrWks=[];             // {w, ready, job, timer, boot}
const hlrWkQ=[];           // {key, brep, axes, cats, res}
let hlrWkN=0,hlrWkReposT=null;

// Arêtes d'un composé rendu par le HLR → listes de points 3D (page ET worker : même échantillonnage)
function occHlrEdgePts(shape){
  const out=[];
  if(!shape)return out;
  const bin=[];
  try{
    const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
    const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_EDGE,SH);bin.push(ex);
    while(ex.More()){
      const e=occEdgeCur(ex);bin.push(e);
      try{
        const ad=new occt.BRepAdaptor_Curve_2(e);bin.push(ad);
        const u0=ad.FirstParameter(),u1=ad.LastParameter();
        if(u1>u0){
          const pts=occCurvePts(ad,u0,u1,0.02,400);
          if(pts&&pts.length>1)out.push(pts);
        }
      }catch(err){}
      ex.Next();
    }
  }catch(err){}
  occDispose(bin);
  try{shape.delete();}catch(e){}
  return out;
}
// listes de points → deux tableaux transférables (sans copie entre le worker et la page)
function occHlrPaquet(L){
  let n=0;L.forEach(p=>{n+=p.length;});
  const pts=new Float64Array(3*n),off=new Int32Array(L.length+1);
  let k=0;
  L.forEach((p,i)=>{off[i]=k;p.forEach(q=>{pts[3*k]=q[0];pts[3*k+1]=q[1];pts[3*k+2]=q[2];k++;});});
  off[L.length]=k;
  return {pts,off};
}
function occHlrDepaquet(P){
  const L=[];
  for(let i=0;i+1<P.off.length;i++){
    const a=[];
    for(let k=P.off[i];k<P.off[i+1];k++)a.push([P.pts[3*k],P.pts[3*k+1],P.pts[3*k+2]]);
    L.push(a);
  }
  return L;
}
function hlrWkUsable(){
  try{return !hlrWkOff&&delWkUsable()&&!!(occt.BinTools&&occt.BinTools.Write&&occt.HLRAppli_ReflectLines);}catch(e){return false;}
}
function hlrWkNb(){
  let n=4;
  try{const h=+navigator.hardwareConcurrency;if(h>0)n=h;}catch(e){}
  return Math.max(1,Math.min(HLR_WK_MAX,n-1));
}
function hlrWkBoot(){
  const url=URL.createObjectURL(new Blob([delWkSource()],{type:'text/javascript'}));
  const me={w:new Worker(url),ready:false,job:null,timer:null,boot:null};
  hlrWks.push(me);
  me.w.onmessage=ev=>hlrWkMsg(me,ev.data||{});
  me.w.onerror=ev=>{try{ev.preventDefault();}catch(e){}hlrWkCrash(me,(ev&&ev.message)||'erreur du worker');};
  me.boot=setTimeout(()=>hlrWkCrash(me,'démarrage du noyau de calcul trop long'),180000);
  const msg={t:'boot',emb:window.__EMB?window.__EMB.blobs:null,js:occtFileUrl(OCCT_FILES.js),wasm:occtFileUrl(OCCT_FILES.wasm),mod:delWkMod,
    compat:occtFileUrl(OCCT_FILES.compat),table:occtFileUrl(OCCT_FILES.table)};
  try{me.w.postMessage(msg);}catch(e){msg.mod=null;me.w.postMessage(msg);}
  return me;
}
function hlrWkStop(me){
  try{clearTimeout(me.timer);clearTimeout(me.boot);}catch(e){}
  try{me.w.terminate();}catch(e){}
  hlrWks=hlrWks.filter(x=>x!==me);
}
function hlrWkRendre(j,r){try{j.res(r);}catch(e){}}
function hlrWkCrash(me,why){
  if(!hlrWks.includes(me))return;
  const j=me.job;
  hlrWkStop(me);
  if(!me.ready&&!hlrWks.some(x=>x.ready)){
    // aucun worker n'a pu démarrer : la page calcule ses vues comme avant
    hlrWkOff=String(why||'?');
    try{console.warn('[Mise en plan] workers indisponibles ('+hlrWkOff+') — vues calculées sur le fil principal');}catch(e){}
    if(j)hlrWkRendre(j,null);
    hlrWkQ.splice(0).forEach(q=>hlrWkRendre(q,null));
    hlrWks.slice().forEach(hlrWkStop);
    return;
  }
  if(j)hlrWkRendre(j,null);
  hlrWkPump();
}
function hlrWkMsg(me,m){
  if(!hlrWks.includes(me))return;
  if(m.t==='pret'){me.ready=true;clearTimeout(me.boot);if(m.mod&&!delWkMod)delWkMod=m.mod;hlrWkPump();return;}
  if(m.t==='ko'){hlrWkCrash(me,m.err);return;}
  if(m.t==='debut')return;
  if(m.t==='fin'&&me.job&&me.job.key===m.id){
    clearTimeout(me.timer);
    const j=me.job;me.job=null;
    let r=null;
    try{r=m.err?null:(j.lire?j.lire(m):(m.hlr?{lots:m.hlr,ms:m.ms}:null));}catch(e){r=null;}
    hlrWkRendre(j,r);
    hlrWkPump();
  }
}
function hlrWkPump(){
  clearTimeout(hlrWkReposT);
  hlrWks.forEach(me=>{
    if(!me.ready||me.job||!hlrWkQ.length)return;
    const j=hlrWkQ.shift();
    me.job=j;
    me.timer=setTimeout(()=>{if(me.job===j){hlrWkStop(me);hlrWkRendre(j,null);hlrWkPump();}},HLR_WK_DELAI);
    // copié : le même solide sert à plusieurs vues (ou à plusieurs paquets de points)
    me.w.postMessage(j.msg?Object.assign({t:'job',id:j.key},j.msg):{t:'job',kind:'hlr',id:j.key,brep:j.brep,axes:j.axes,cats:j.cats});
  });
  // workers à démarrer : un par travail en attente non couvert par un worker qui démarre
  const libres=hlrWks.filter(me=>!me.job).length;
  for(let k=hlrWkQ.length-libres;k>0&&hlrWks.length<hlrWkNb();k--){
    try{hlrWkBoot();}catch(e){hlrWkOff=(e&&e.message)||String(e);hlrWkQ.splice(0).forEach(q=>hlrWkRendre(q,null));return;}
  }
  if(!hlrWkQ.length&&!hlrWks.some(me=>me.job))hlrWkReposT=setTimeout(()=>{if(!hlrWkQ.length&&!hlrWks.some(me=>me.job))hlrWks.slice().forEach(hlrWkStop);},HLR_WK_REPOS);
}
function occHlrWk(brep,axes,cats){
  // brep : solide (ou composé) en BRep binaire ; axes : [regard, axe u] ; cats : [[type, visible]…]
  // → Promise de {lots:[{pts,off}…] dans l'ordre de cats, ms} ou null
  return new Promise(res=>{
    if(!hlrWkUsable()){res(null);return;}
    hlrWkQ.push({key:'hlr:'+(++hlrWkN),brep,axes,cats,res});
    hlrWkPump();
  });
}
// V0.99.51 : la même réserve sert à d'autres calculs du noyau (trous débouchants de la FAO, 89-fao-percage).
// msg : {kind, …} lu par delWkMain ; lire(m) : réponse du worker → résultat. → Promise du résultat ou null.
function occCalcWkUsable(){
  try{return !hlrWkOff&&delWkUsable()&&!!(occt.BinTools&&occt.BinTools.Write);}catch(e){return false;}
}
function occCalcWk(msg,lire){
  return new Promise(res=>{
    if(!occCalcWkUsable()){res(null);return;}
    hlrWkQ.push({key:(msg.kind||'calc')+':'+(++hlrWkN),msg,lire,res});
    hlrWkPump();
  });
}
