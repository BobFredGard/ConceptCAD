/* ---------- init ---------- */
window.addEventListener('error',e=>{try{statsEl.textContent+='\n[ERREUR] '+(e.message||e.error);}catch(_){}});
try{$('appVerLive').textContent=APP_VER;}catch(e){}
buildScene();renderTree();renderProps();refreshParts();
// V0.29.0 : brouillon trop gros pour le stockage local → IndexedDB (autosaveWrite, 90), relu avant le cache d'affichage
let draftP=null;
// V0.31.2 : DÉMARRAGE PROTÉGÉ. Un brouillon (ou son cache d'affichage) qui fait planter ou figer
// l'onglet bloquait l'appli à CHAQUE ouverture (« plante dans Chrome, pas en privé ni dans Brave »).
// Témoin posé ici, retiré une fois le rejeu exact passé (bootSafeDone) ou à une fermeture normale :
// s'il est encore là, le démarrage précédent n'a pas abouti → brouillon NON rouvert, proposé.
const BOOT_KEY='minifusion_boot';
let bootPrev=null;try{bootPrev=localStorage.getItem(BOOT_KEY);localStorage.setItem(BOOT_KEY,String(Date.now()));}catch(e){}
let bootSafeT=null;
// brouillon mis de côté (mémoire + IndexedDB « bootHeld ») AVANT toute sauvegarde automatique :
// le document vide ne doit pas l'écraser. bootHold bloque autosaveWrite (90) jusqu'au choix de l'utilisateur.
bootHold=!!bootPrev;let bootHeldTxt=null;
const bootHeldP=bootPrev?draftRestore().then(async t=>{
  if(t){bootHeldTxt=t;try{await idbSet('bootHeld',{txt:t,at:Date.now()});}catch(e){}}
  else{try{const h=await idbGet('bootHeld');if(h&&typeof h.txt==='string')bootHeldTxt=h.txt;}catch(e){}}
}).catch(()=>{}):null; // bootHold levé par le choix fait dans le bandeau
async function bootHeldText(){try{await bootHeldP;}catch(e){}return bootHeldTxt;}
function bootSafeDone(ms){
  if(bootSafeT)clearTimeout(bootSafeT);
  bootSafeT=setTimeout(()=>{bootSafeT=null;try{localStorage.removeItem(BOOT_KEY);}catch(e){}},ms==null?5000:ms);
}
addEventListener('beforeunload',()=>{try{localStorage.removeItem(BOOT_KEY);}catch(e){}});
setTimeout(()=>bootSafeDone(0),120000); // noyau lent mais onglet vivant : le démarrage a abouti
function bootSafeBanner(){
  const b=document.createElement('div');b.id='bootSafe';
  b.style.cssText='position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:9500;max-width:min(560px,92vw);background:#2a1d0c;color:#ffe2b0;border:1px solid #ff9f0a;border-radius:10px;padding:10px 14px;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.5)';
  b.innerHTML='<b>⚠ Le démarrage précédent n’a pas abouti</b><div style="margin:4px 0 8px;opacity:.9">Le brouillon local n’a pas été rouvert (il bloquait peut-être l’application). Vous pouvez l’enregistrer dans un fichier, le rouvrir quand même, ou repartir d’un document vide. Sauvegarde automatique suspendue jusqu’à votre choix.</div>';
  const bar=document.createElement('div');bar.style.cssText='display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end';
  const mk=(t,fn)=>{const x=document.createElement('button');x.textContent=t;x.onclick=fn;bar.appendChild(x);return x;};
  mk('💾 Enregistrer le brouillon…',async()=>{
    try{const t=await bootHeldText();if(!t){faceEl.textContent='Aucun brouillon local.';return;}
      const a=document.createElement('a');a.href=URL.createObjectURL(mffBlob(await mffPack(t)));
      a.download='Brouillon '+new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')+'.conceptcad';
      document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);}catch(e){faceEl.textContent='Brouillon illisible : '+e.message;}});
  mk('↻ Rouvrir quand même',async()=>{
    b.remove();bootHold=false;try{const t=await bootHeldText();if(!t)return;
      await Promise.resolve(deserialise(t,{rebuild:false}));renderTree();renderProps();
      builtVersion=-1;builtHash=null;builtEngine=null;rebuild();if(occtReady)showAll();faceEl.textContent='Brouillon local rouvert.';}catch(e){faceEl.textContent='Brouillon : '+e.message;}});
  mk('✕ Document vide',()=>{b.remove();bootHold=false;try{autosave();}catch(e){}});
  b.appendChild(bar);document.body.appendChild(b);
}
if(bootPrev){
  try{faceEl.textContent='⚠ Démarrage précédent interrompu : brouillon non rouvert.';}catch(e){}
  try{bootSafeBanner();}catch(e){}
}
else{
  // V0.31.2 : brouillon rouvert APRÈS la fenêtre de l'écran de démarrage (window.__mfGate, 2 s ou
  // clic) : le bouton « Vider le cache » peut l'écarter avant qu'il ne bloque l'application.
  const draftLoad=()=>{try{const auto=localStorage.getItem('minifusion_auto');if(auto){deserialise(auto,{rebuild:false});renderProps();faceEl.textContent='Brouillon local restauré.';return null;}
    return draftRestore().then(t=>{if(t)return Promise.resolve(deserialise(t,{rebuild:false})).then(()=>{renderProps();faceEl.textContent='Brouillon local restauré (grand fichier).';});}).catch(()=>{});}catch(e){return null;}};
  if(window.__mfGate)draftP=Promise.resolve(window.__mfGate).catch(()=>{}).then(()=>window.__mfResetting?null:draftLoad());
  else draftP=draftLoad();
}
// Le cache d'affichage n'est qu'un DÉCOR : il redonne une image, pas un modèle. Sans rejeu,
// il n'y a pas de solide exact (occLive) — donc ni congé, ni esquisse sur face, ni sélection
// de face : « impossible de rejouer le solide ». Symptôme mesuré : le PREMIER F5 rejouait
// (cache périmé par la version), le SECOND ne rejouait plus (cache valide) et la pièce
// devenait inerte. On force donc le rejeu dans les DEUX cas. Le cadrage a lieu une fois
// le noyau exact prêt (occtFinishBoot) : cadrer ici, pendant le repli maillage, prendrait
// la boîte du « solide combiné » parfois dégénérée (40×40×10000) — caméra hors champ,
// vue noire. Tant qu'OCCT n'est pas prêt, la caméra par défaut (90,-90,90) montre l'origine.
try{
  (draftP||Promise.resolve()).then(()=>bootPrev?false:restoreViewCache()).then(async ok=>{
    if(ok)log('Affichage restauré depuis le cache — rejeu exact en cours…');
    // builtVersion=-1 : la garde « rien n'a changé » court-circuterait sinon le rejeu,
    // puisque restoreViewCache vient de poser builtHash.
    builtVersion=-1;builtHash=null;builtEngine=null;
    // V0.42.0 : noyau déjà prêt → barre de progression (31) ; sinon repli maillage, immédiat
    if(regenWarmUseful()){try{await regenWarm('Ouverture du brouillon');}catch(e){}builtVersion=-1;}
    try{rebuild();}catch(e){}finally{regenUiHide();}
    try{if(occtReady)showAll();}catch(e){}
    try{faoMovesPreloadSoon(true);}catch(e){} // solide rejoue : on (re)charge les parcours persistes
    if(occtReady)bootSafeDone(); // sinon : à la fin du rejeu exact (occtFinishBoot)
  });
}catch(e){try{builtVersion=-1;builtHash=null;builtEngine=null;rebuild();if(occtReady)showAll();faoMovesPreloadSoon(true);}catch(e2){}}
log('Prêt. Esquisse → Extrusion → Export. Même navigation que le viewer.');
