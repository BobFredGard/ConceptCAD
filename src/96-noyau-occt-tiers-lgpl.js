/* ---------- Noyau OCCT 8.0.1 exact (occt/v3, libcascade 3.1, fabriqué par occt-build/) ---------- */
function occtFileUrl(p){ // chemin relatif : marche en http(s) comme en file://
  try{const b=document.currentScript&&document.currentScript.src?document.currentScript.src:location.href;
    return new URL(p,b).href;}catch(e){return p;}
}
// Le traducteur occt/v3/compat-v3.cjs garde les appels d'opencascade.js 1.1.1 écrits dans src/.
const OCCT_FILES={js:'occt/v3/conceptcad_v3.js',wasm:'occt/v3/conceptcad_v3.wasm',
  compat:'occt/v3/compat-v3.cjs',table:'occt/v3/compat-v3.json'};
// Noyau multicœur (occt/mt) : choisi tout seul quand la page est isolée (en-têtes de Server.bat, ou
// service worker isolation-sw.js sur le site) et le PC assez fourni ; sinon, ou s'il ne charge pas, noyau normal.
// Le fichier autonome n'en a pas : file:// ne permet pas les fils. Adresse ?mt=0 : noyau normal ; ?mt=8 : 8 fils.
// Seuls les booléens utilisent les fils : le maillage, dont dépend la FAO, reste comme avant.
// Les workers (suppression de face, FAO) gardent le noyau normal : ils lisent OCCT_FILES.
const OCCT_MT={js:'occt/mt/conceptcad_v3.js',wasm:'occt/mt/conceptcad_v3.wasm'};
const OCCT_MT_FILS_DEFAUT=4; // mémoire du noyau : 165 Mo de plus à 4 fils, 305 Mo à 8
const OCCT_MT_FILS_MAX=8;    // réserve de fils du noyau (occt-build/build.cjs) : au-delà, un calcul resterait bloqué
let occtMtFils=0,occtMtAvis='';
function occtMtDemande(){
  // Nombre de fils à utiliser ici, 0 pour le noyau normal
  if(window.__EMB)return 0;
  const m=/[?&]mt=(\d+)(?:&|$)/.exec(String(location.search||''));
  const coeurs=navigator.hardwareConcurrency||1;
  if(m&&+m[1]===0){occtMtAvis='Un seul cœur (demandé par l’adresse)';return 0;}
  if(!self.crossOriginIsolated){
    occtMtAvis=location.protocol==='https:'?'Un seul cœur : multicœur à la prochaine ouverture':'Un seul cœur : ce serveur ne permet pas le multicœur';
    return 0;
  }
  if(coeurs<OCCT_MT_FILS_DEFAUT||(navigator.deviceMemory&&navigator.deviceMemory<8)){occtMtAvis='Un seul cœur : PC trop juste pour le multicœur';return 0;}
  return Math.max(2,Math.min(m?+m[1]:OCCT_MT_FILS_DEFAUT,OCCT_MT_FILS_MAX,coeurs));
}
function occtIsolerPage(){
  // Le site (GitHub Pages) n'envoie pas les en-têtes d'isolation : le service worker les ajoute, à partir de
  // la prochaine ouverture. Pas de rechargement à la volée, qui couperait le démarrage de l'application.
  try{
    if(window.__EMB||self.crossOriginIsolated||!('serviceWorker' in navigator))return;
    if(location.protocol==='https:'||/[?&]sw(?:&|$)/.test(String(location.search||'')))navigator.serviceWorker.register('isolation-sw.js').catch(()=>{});
  }catch(e){}
}
function occtMtActive(fils){
  const pool=occt.OSD_ThreadPool.DefaultPool(fils);
  pool.SetNbDefaultThreadsToLaunch(fils);
  occt.BOPAlgo_Options.SetParallelMode(true);
  occtMtFils=fils;
}
// Traducteur v3 (page et worker de suppression de face) : charge compat-v3.cjs + sa table, rend
// une fabrique qui enveloppe celle du noyau. Le module CommonJS est évalué avec un `require` vide
// (il ne lit des fichiers que pour sa génération, hors navigateur).
async function occtV3Compat(compatUrl,tableUrl){
  const [src,tab]=await Promise.all([fetch(compatUrl).then(r=>{if(!r.ok)throw new Error('traducteur v3 introuvable');return r.text();}),
    fetch(tableUrl).then(r=>{if(!r.ok)throw new Error('table v3 introuvable');return r.json();})]);
  const module={exports:{}};
  new Function('module','exports','require',src)(module,module.exports,()=>({}));
  return f=>async o=>module.exports.appliquer(await f(o),tab);
}
// Ouverture par double-clic (file://) : le navigateur interdit à la page de lire le noyau. Rien ne
// fonctionnerait correctement sans lui : on le dit et on renvoie vers ce qui marche, sans repli.
function occtEcranDoubleClic(){
  try{
    const d=document.createElement('div');d.id='occtDoubleClic';
    d.style.cssText='position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:#1c1c1e;color:#f2f2f7;font:15px/1.5 system-ui,sans-serif;overflow:auto';
    const lien='color:#64d2ff';
    d.innerHTML='<div style="max-width:560px"><h1 style="font-size:22px;margin:0 0 12px">ConceptCAD ne peut pas démarrer par double-clic</h1>'+
      '<p style="margin:0 0 16px">Le navigateur interdit à ce fichier de charger le noyau de calcul 3D. Vos pièces ne risquent rien. Trois façons d’ouvrir ConceptCAD :</p>'+
      '<ul style="margin:0;padding-left:20px">'+
      '<li style="margin-bottom:10px"><b>Sans Internet</b> : ouvrez <b>ConceptCAD-autonome.html</b> par double-clic. <a style="'+lien+'" target="_blank" rel="noopener" href="https://www.dropbox.com/scl/fi/sne7f5a9y8dr659b2xrow/ConceptCAD-autonome.html?rlkey=fgd0w1r5816ake50vxtd4fnuj&amp;dl=0">Le télécharger</a>.</li>'+
      '<li style="margin-bottom:10px"><b>Depuis ce dossier</b> : lancez <b>Server.bat</b>, puis ouvrez <a style="'+lien+'" href="http://localhost:3000">http://localhost:3000</a>.</li>'+
      '<li><b>En ligne</b> : <a style="'+lien+'" target="_blank" rel="noopener" href="https://bobfredgard.github.io/ConceptCAD/">bobfredgard.github.io/ConceptCAD</a>.</li></ul></div>';
    document.body.appendChild(d);
  }catch(e){}
}
(async()=>{
  if(window.__occBootDone)return; // garde anti-double-démarrage
  window.__occBootDone=true;
  // Cache d'un .wasm désigné à la main (versions avant V0.65.0) : 65 Mo devenus inutiles
  try{if(typeof indexedDB!=='undefined'&&indexedDB.deleteDatabase)indexedDB.deleteDatabase('minifusion_occ');}catch(e){}
  if(!window.__EMB&&(location.protocol==='file:'||location.protocol==='about:')){
    occtReady=false;
    occBaseMsg='OCCT : noyau indisponible en double-clic. Ouvrez ConceptCAD-autonome.html, ou lancez Server.bat puis http://localhost:3000.';
    occStatus();occtEcranDoubleClic();
    return;
  }
  occtIsolerPage();
  if(window.__EMB)await window.__EMB.pret(OCCT_FILES); // fichier autonome : adresses blob à la place des fichiers
  // V0.31.2 : fenêtre de l'écran de démarrage (2 s, ou clic / Échap) — le fil reste libre pour
  // le bouton de dépannage « Vider le cache » ; la compilation gèle sinon toute l'animation.
  try{if(window.__mfGate)await window.__mfGate;}catch(e){}
  const t0=performance.now();
  const stage=s=>{occBaseMsg='OCCT : '+s;occStatus();try{console.log('[OCCT] '+s);}catch(e){}};
  const withTimeout=(p,ms,what)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('délai dépassé '+what)),ms))]);
  // Laisse le navigateur peindre l'étape AVANT la compilation : sans cela le message
  // s'affiche après coup, quand la tabulation est déjà gelée.
  const yieldUI=()=>new Promise(r=>{try{requestAnimationFrame(()=>setTimeout(r,0));}catch(e){setTimeout(r,0);}});
  const demarrer=async(js,wasm)=>{
    stage('chargement JS noyau (0,1 Mo)…');
    const mod=await withTimeout(import(occtFileUrl(js)),30000,'chargement JS');
    if(typeof mod.default!=='function')throw new Error('factory absente (import vide ?)');
    stage('chargement du traducteur…');
    const factory=(await occtV3Compat(occtFileUrl(OCCT_FILES.compat),occtFileUrl(OCCT_FILES.table)))(mod.default);
    stage('JS noyau OK, compilation wasm (~43 Mo, ~10-60 s) — interface momentanément figée…');
    await yieldUI();
    return withTimeout(factory({locateFile:p=>String(p).endsWith('.wasm')?wasm:p}),180000,'compilation wasm');
  };
  try{
    const fils=occtMtDemande();
    if(fils){
      try{occt=await demarrer(OCCT_MT.js,OCCT_MT.wasm);occtMtActive(fils);}
      catch(e){occt=null;occtMtFils=0;occtMtAvis='Un seul cœur : noyau multicœur non chargé';try{console.warn('[OCCT] '+occtMtAvis+' : '+((e&&e.message)||e));}catch(e2){}}
    }
    if(!occt)occt=await demarrer(OCCT_FILES.js,OCCT_FILES.wasm);
    occBaseMsg=`OCCT : prêt en ${((performance.now()-t0)/1000).toFixed(0)} s — vérification…`;occStatus();
    await occtFinishBoot();
  }catch(e){
    occtReady=false;
    const m=String((e&&(e.message||e))||e||'?').slice(0,160);
    occBaseMsg=`OCCT : échec démarrage (${m}) — repli maillage. Vérifiez ${occtFileUrl(OCCT_FILES.wasm)} (43 Mo attendus).`;
    occStatus();
  }
})();

