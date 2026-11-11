/* ---------- Application installable (PWA, V0.93.0) ----------
   Le site s'installe comme un logiciel (manifest.webmanifest, icônes de icones/) : sa fenêtre, son icône,
   et il démarre sans Internet grâce à la réserve du service worker isolation-sw.js.
   - menu Projet → « Installer ConceptCAD » quand le navigateur le permet (Chrome, Edge) ;
   - une fois le noyau prêt, la page demande au service worker de garder tout ce qu'il faut pour démarrer
     sans réseau (noyau multicœur compris s'il sert ici) ;
   - application installée : un double-clic sur un .conceptcad dans l'Explorateur l'ouvre ici, et
     Ctrl+S réécrit ce même fichier (file_handlers du manifeste, launchQueue).
   Rien de tout cela dans le fichier autonome (window.__EMB) ni en double-clic (file://). */
let pwaInvite=null;      // évènement beforeinstallprompt gardé pour le bouton
let pwaHorsLigne=null;   // réponse du service worker : {n, octets, manquants, version}
function pwaInstallee(){
  try{return !!(matchMedia('(display-mode: standalone)').matches||navigator.standalone);}catch(e){return false;}
}
function pwaUI(){
  try{
    const b=document.getElementById('btnInstaller');if(!b)return;
    const pret=pwaHorsLigne&&!pwaHorsLigne.manquants.length;
    b.style.display=(pwaInvite&&!pwaInstallee())?'':'none';
    b.innerHTML='<i>⬇</i>Installer ConceptCAD';
    b.title='Installer ConceptCAD comme un logiciel : sa fenêtre, son icône, et il marche sans Internet'+(pret?' (copie hors ligne prête)':'');
  }catch(e){}
}
async function pwaInstaller(){
  if(!pwaInvite)return false;
  const ev=pwaInvite;pwaInvite=null;
  try{ev.prompt();const r=await ev.userChoice;pwaUI();return !!(r&&r.outcome==='accepted');}
  catch(e){pwaUI();return false;}
}
function pwaMenu(){
  // entrée du menu Projet (construit après ce fichier : appel différé, comme 53-scripts)
  try{
    const nb=document.getElementById('btnNew'),menu=nb&&nb.parentNode;
    if(menu&&menu.classList&&menu.classList.contains('ddMenu')&&!document.getElementById('btnInstaller')){
      const b=document.createElement('button');b.id='btnInstaller';b.onclick=()=>pwaInstaller();
      menu.appendChild(b);pwaUI();
    }
  }catch(e){}
}
// Demande au service worker de remplir la réserve hors ligne, une fois le noyau démarré
async function pwaPrecharger(){
  try{
    if(!('serviceWorker' in navigator))return;
    const reg=await navigator.serviceWorker.getRegistration();
    const sw=reg&&(reg.active||reg.waiting||reg.installing);
    if(!sw)return;
    sw.postMessage({type:'precharger',mt:typeof occtMtFils!=='undefined'&&occtMtFils>0});
  }catch(e){}
}
function pwaEcoute(){
  try{
    navigator.serviceWorker.addEventListener('message',e=>{
      const m=e.data||{};
      if(m.source!=='conceptcad-sw'||m.type!=='pret')return;
      pwaHorsLigne={n:m.n|0,octets:+m.octets||0,manquants:m.manquants||[],version:m.version};
      try{console.log('[hors ligne] '+(pwaHorsLigne.manquants.length?'incomplet, manque : '+pwaHorsLigne.manquants.join(', '):'prêt ('+pwaHorsLigne.n+' fichiers)'));}catch(e2){}
      pwaUI();
    });
  }catch(e){}
}
function pwaAttendreNoyau(){
  // le noyau est prêt (ou a échoué) : ses fichiers sont lus, on complète la réserve sans gêner le démarrage
  let n=0;
  const t=setInterval(()=>{
    n++;
    const fini=(typeof occtReady!=='undefined'&&occtReady===true)||(typeof occBaseMsg==='string'&&/échec|indisponible/.test(occBaseMsg));
    if(fini||n>600){clearInterval(t);if(fini)setTimeout(pwaPrecharger,2000);}
  },1000);
}
// Application installée : fichiers ouverts depuis l'Explorateur (double-clic sur un .conceptcad)
async function pwaOuvrirFichiers(p){
  try{
    const h=p&&p.files&&p.files[0];if(!h||typeof h.getFile!=='function')return;
    // attendre le noyau : la pièce se reconstruit avec lui, comme une ouverture par le menu
    for(let i=0;i<240&&!((typeof occtReady!=='undefined'&&occtReady===true)||(typeof occBaseMsg==='string'&&/échec|indisponible/.test(occBaseMsg)));i++)
      await new Promise(r=>setTimeout(r,500));
    if(typeof mffConfirmDiscard==='function'&&!(await mffConfirmDiscard()))return;
    const f=await h.getFile();
    await mffLoadText(await mffFileText(f),f.name,h);
  }catch(err){try{alert('Projet illisible : '+((err&&err.message)||err));}catch(e){}}
}
(function(){
  try{
    if(window.__EMB||location.protocol==='file:'||location.protocol==='about:')return;
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();pwaInvite=e;pwaUI();});
    window.addEventListener('appinstalled',()=>{pwaInvite=null;pwaUI();
      try{faceEl.textContent='ConceptCAD est installé : il s’ouvre depuis son icône, même sans Internet.';}catch(e){}});
    if('serviceWorker' in navigator){pwaEcoute();pwaAttendreNoyau();}
    if('launchQueue' in window&&window.launchQueue&&typeof window.launchQueue.setConsumer==='function')
      window.launchQueue.setConsumer(p=>{setTimeout(()=>pwaOuvrirFichiers(p),0);});
    if(navigator.onLine===false)setTimeout(()=>{try{faceEl.textContent='Sans Internet : ConceptCAD tourne sur la copie gardée sur cet ordinateur.';}catch(e){}},3000);
    setTimeout(pwaMenu,0);setTimeout(pwaMenu,1500);
  }catch(e){}
})();
