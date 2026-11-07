// Pont de l'application : rend aux fonctions de fichiers du logiciel (showOpenFilePicker, etc.) le
// service qu'elles attendent, mais avec les vraies fenêtres du système et sans demande de permission.
// Le code de ConceptCAD n'est pas touché : tout passe par ce fichier, chargé avant lui.
(function(){
  'use strict';
  const invoke=window.__TAURI__.core.invoke;
  const annule=()=>new DOMException('Annulé','AbortError');
  const introuvable=n=>new DOMException('Introuvable : '+n,'NotFoundError');
  const BS=/^Mac/.test(navigator.platform)?'/':String.fromCharCode(92); // séparateur des chemins : / sur Mac, \ sur Windows
  const sansFin=p=>p.endsWith(BS)?p.slice(0,-1):p;
  const dossierDe=p=>p.slice(0,Math.max(p.lastIndexOf(BS),0));
  const nomDe=p=>p.slice(p.lastIndexOf(BS)+1);
  const joindre=(d,n)=>sansFin(d)+BS+n;
  const ecrire=(chemin,octets)=>invoke('ecrire',octets,{headers:{'x-chemin':encodeURIComponent(chemin)}});

  // Journal provisoire de l'essai Mac (blocage à l'ouverture d'une pièce) : chaque étape, l'heure, et un
  // signe de vie régulier. S'il s'arrête, la page est bloquée ; la dernière étape dit où. À retirer ensuite.
  const JOURNAL=/^Mac/.test(navigator.platform)||window.__ccJournal===true;
  const trace=m=>{if(JOURNAL)invoke('journal',{texte:new Date().toISOString().slice(11,23)+' '+m}).catch(()=>{});};
  if(JOURNAL){
    trace('=== démarrage '+navigator.userAgent+' ; isolé='+window.crossOriginIsolated+' ; cœurs='+navigator.hardwareConcurrency+' ; adresse='+location.search);
    addEventListener('error',e=>trace('ERREUR '+e.message+' '+e.filename+':'+e.lineno));
    addEventListener('unhandledrejection',e=>trace('REJET '+(e.reason&&e.reason.message||e.reason)));
    addEventListener('webglcontextlost',e=>trace('CONTEXTE 3D PERDU'),true);
    addEventListener('webglcontextrestored',e=>trace('contexte 3D rétabli'),true);
    const erreurConsole=console.error;
    console.error=function(...a){trace('console.error '+a.map(String).join(' ').slice(0,300));return erreurConsole.apply(this,a);};
    const alerte=window.alert;
    window.alert=function(m){trace('message '+String(m).slice(0,300));return alerte.call(this,m);};
    let images=0;
    const image=()=>{images++;requestAnimationFrame(image);};
    requestAnimationFrame(image);
    addEventListener('load',()=>{
      try{
        const g=document.createElement('canvas').getContext('webgl2'),x=g&&g.getExtension('WEBGL_debug_renderer_info');
        trace('carte 3D : '+(x?g.getParameter(x.UNMASKED_RENDERER_WEBGL):'inconnue'));
      }catch(e){trace('carte 3D : '+e);}
      for(const n of ['mffOpen','mffOpenHandle','mffFileText','mffCheckData','mffLoadText','mffConfirmDiscard','docResetEmpty','bundleRestore','deserialise','rebuild','showAll','renderTree','renderProps','mffMark','mffRecentAdd']){
        const f=window[n];
        if(typeof f!=='function'){trace('fonction absente : '+n);continue;}
        window[n]=function(...a){
          trace('> '+n);
          try{
            const r=f.apply(this,a);
            if(r&&typeof r.then==='function')return r.then(v=>{trace('< '+n);return v;},e=>{trace('! '+n+' '+(e&&e.message||e));throw e;});
            trace('< '+n);
            return r;
          }catch(e){trace('! '+n+' '+(e&&e.message||e));throw e;}
        };
      }
      setInterval(()=>{
        let etat='';
        try{etat='noyau='+occtReady+' fils='+occtMtFils+' calcul='+rebuildDepth+'/'+regenRun+'/'+regenUi+' fonctions='+(doc.features||[]).length;}catch(e){}
        trace('vivant images='+images+' '+etat);
      },2000);
    });
  }

  // Sur Mac, le noyau multicœur fige l'application dès qu'il reconstruit une vraie pièce (Mac à 4 cœurs ou
  // plus, moteur Safari ; il marche dans Brave). L'adresse ?mt=0, prévue par le logiciel, choisit le noyau normal.
  if((/^Mac/.test(navigator.platform)||window.__ccSansMulticoeur===true)&&!/[?&]mt=0(?:&|$)/.test(location.search)){
    history.replaceState(null,'',location.pathname+(location.search?location.search+'&':'?')+'mt=0'+location.hash);
  }

  // Pas de méthode propre à l'objet : un lien doit pouvoir se ranger dans IndexedDB (fichiers récents).
  class Lien{
    constructor(kind,chemin){this.__pont=1;this.kind=kind;this.chemin=chemin;this.name=nomDe(chemin);}
    async queryPermission(){return 'granted';}
    async requestPermission(){return 'granted';}
    async isSameEntry(o){return !!o&&o.kind===this.kind&&String(o.chemin).toLowerCase()===this.chemin.toLowerCase();}
  }
  class LienFichier extends Lien{
    constructor(chemin){super('file',chemin);}
    async getFile(){
      const i=await invoke('infos',{chemin:this.chemin});
      if(!i||i.dossier)throw introuvable(this.name);
      trace('lecture '+this.chemin+' ('+i.taille+' octets)');
      const b=await invoke('lire',{chemin:this.chemin});
      trace('lu '+(b&&b.byteLength)+' octets');
      return new File([b],this.name,{lastModified:i.modif});
    }
    async createWritable(){
      const morceaux=[],chemin=this.chemin;
      return {
        async write(d){morceaux.push(d&&d.type==='write'?d.data:d);},
        async close(){await ecrire(chemin,new Uint8Array(await new Blob(morceaux).arrayBuffer()));},
        async abort(){morceaux.length=0;}
      };
    }
  }
  class LienDossier extends Lien{
    constructor(chemin){super('directory',chemin);}
    async getFileHandle(n,o){
      const c=joindre(this.chemin,n);
      if(!(await invoke('infos',{chemin:c}))){
        if(!(o&&o.create))throw introuvable(n);
        await ecrire(c,new Uint8Array(0));
      }
      return new LienFichier(c);
    }
    async getDirectoryHandle(n,o){
      const c=joindre(this.chemin,n);
      if(!(await invoke('infos',{chemin:c}))){
        if(!(o&&o.create))throw introuvable(n);
        await invoke('creer_dossier',{chemin:c});
      }
      return new LienDossier(c);
    }
    async resolve(h){
      const a=sansFin(this.chemin).toLowerCase(),c=String(h&&h.chemin);
      if(c.toLowerCase()===a)return [];
      return c.toLowerCase().startsWith(a+BS)?c.slice(a.length+1).split(BS):null;
    }
    async *entries(){
      for(const e of await invoke('lister',{chemin:this.chemin})){
        const c=joindre(this.chemin,e.nom);
        yield [e.nom,e.dossier?new LienDossier(c):new LienFichier(c)];
      }
    }
    async *keys(){for await(const [k] of this.entries())yield k;}
    async *values(){for await(const [,v] of this.entries())yield v;}
    [Symbol.asyncIterator](){return this.entries();}
  }

  // Un lien relu dans IndexedDB a perdu ses fonctions : on les lui rend à la lecture.
  function ranimer(v){
    if(!v||typeof v!=='object')return v;
    if(v.__pont===1&&!(v instanceof Lien))return v.kind==='directory'?new LienDossier(v.chemin):new LienFichier(v.chemin);
    if(Array.isArray(v))for(const x of v)if(x&&typeof x==='object'&&x.h&&x.h.__pont===1)x.h=ranimer(x.h);
    return v;
  }
  const lecture=Object.getOwnPropertyDescriptor(IDBRequest.prototype,'result');
  Object.defineProperty(IDBRequest.prototype,'result',{configurable:true,enumerable:true,get(){return ranimer(lecture.get.call(this));}});

  const filtres=o=>((o&&o.types)||[]).map(t=>({
    description:t.description||'Fichiers',
    extensions:Object.values(t.accept||{}).flat().map(e=>String(e).replace(/^\./,''))
  }));
  const depart=o=>{
    const s=o&&o.startIn;
    if(!s||!s.chemin)return null;
    return s.kind==='directory'?s.chemin:dossierDe(s.chemin);
  };

  window.showOpenFilePicker=async o=>{
    const c=await invoke('dialogue_ouvrir',{filtres:filtres(o),depart:depart(o)});
    if(!c)throw annule();
    return [new LienFichier(c)];
  };
  window.showSaveFilePicker=async o=>{
    const nom=(o&&o.suggestedName)||null;
    let c=await invoke('dialogue_enregistrer',{filtres:filtres(o),depart:depart(o),nom});
    if(!c)throw annule();
    // nom tapé sans extension : celle du nom proposé
    const ext=nom&&/\.[^.]+$/.exec(nom);
    if(ext&&!nomDe(c).includes('.'))c+=ext[0];
    return new LienFichier(c);
  };
  window.showDirectoryPicker=async o=>{
    const c=await invoke('dialogue_dossier',{depart:depart(o)});
    if(!c)throw annule();
    return new LienDossier(c);
  };

  // Exports (STEP, G-code, images…) : la vraie fenêtre « Enregistrer sous » au lieu d'un téléchargement.
  const clicNatif=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    if(!this.download||!/^(blob|data):/.test(this.href))return clicNatif.call(this);
    const nom=this.download,ext=/\.([^.]+)$/.exec(nom),adresse=this.href;
    (async()=>{
      const b=await (await fetch(adresse)).blob(); // tout de suite : l'adresse est libérée peu après
      const types=ext?[{description:ext[1].toUpperCase(),accept:{'x/x':['.'+ext[1]]}}]:[];
      let h;
      try{h=await window.showSaveFilePicker({suggestedName:nom,types});}catch(e){return;}
      const w=await h.createWritable();await w.write(b);await w.close();
    })().catch(e=>alert('Export impossible : '+(e&&e.message||e)));
  };

  // Titre de la fenêtre = titre de la page (nom du fichier, point « modifié »)
  addEventListener('DOMContentLoaded',()=>{
    const t=document.querySelector('title');
    const suivre=()=>invoke('titre',{texte:document.title}).catch(()=>{});
    if(t){new MutationObserver(suivre).observe(t,{childList:true});suivre();}
  });

  // Raccourcis du navigateur sans objet dans un logiciel (recharger, imprimer la page, chercher…).
  // Le code du logiciel reçoit toujours ces touches : seule l'action du navigateur est retirée.
  addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(/^f(3|5|7|12)$/.test(k)||((e.ctrlKey||e.metaKey)&&k.length===1&&'rpfghju'.includes(k))||(e.altKey&&/^arrow(left|right)$/.test(k)))e.preventDefault();
  },true);
  // Menu du clic droit du navigateur : gardé seulement dans les champs de texte (copier, coller).
  addEventListener('contextmenu',e=>{
    const c=e.target;
    if(!(c&&c.closest&&c.closest('input,textarea,[contenteditable="true"]')))e.preventDefault();
  },true);

  const DERNIER='conceptcad-dernier-fichier';
  const pret=async()=>{
    const ok=()=>{try{return (occtReady===true||/échec|indisponible/.test(occBaseMsg))&&rebuildDepth===0&&!skEdit;}catch(e){return false;}};
    while(!ok())await new Promise(k=>setTimeout(k,100));
  };

  // Seul un arrêt brutal laisse désormais un brouillon : relevé avant le démarrage du logiciel.
  let brouillon=false;
  try{brouillon=!!(localStorage.getItem('minifusion_auto')||localStorage.getItem('minifusion_auto_idb'));}catch(e){}

  // Fichier reçu (double-clic, y compris application déjà ouverte) : l'un après l'autre, sans rien perdre.
  let file=Promise.resolve();
  const recevoir=()=>{
    file=file.then(async()=>{
      const c=await invoke('fichier_demarrage');
      if(!c)return false;
      await pret();
      if(await mffConfirmDiscard())await mffOpenHandle(new LienFichier(c));
      return true;
    }).catch(e=>{alert('Ouverture impossible : '+(e&&e.message||e));return true;});
    return file;
  };
  window.__TAURI__.event.listen('fichier-recu',recevoir);
  addEventListener('load',async()=>{
    if(await recevoir()||brouillon)return;
    // Démarrage normal : la pièce de la dernière fois, depuis son fichier, donc sans « modifié ».
    let c=null;try{c=localStorage.getItem(DERNIER);}catch(e){}
    if(!c||!(await invoke('infos',{chemin:c})))return;
    await pret();
    await mffOpenHandle(new LienFichier(c));
  });

  // Croix de la fenêtre : question si la pièce est modifiée, puis fermeture sans brouillon.
  let fermeture=false;
  const oublierBrouillon=()=>{
    window.__mfResetting=true; // le logiciel n'écrit plus de brouillon
    try{
      localStorage.removeItem('minifusion_auto');
      localStorage.removeItem('minifusion_auto_idb');
      if(mffHandle&&mffHandle.chemin)localStorage.setItem(DERNIER,mffHandle.chemin);else localStorage.removeItem(DERNIER);
    }catch(e){}
  };
  window.__TAURI__.event.listen('demande-fermeture',async()=>{
    invoke('fermeture_recue').catch(()=>{});
    if(fermeture)return;
    fermeture=true;
    try{
      if(typeof mffModified==='function'&&mffModified()&&!(await mffConfirmDiscard()))return;
      if(typeof mffModified==='function')oublierBrouillon();
      await invoke('fermer');
    }catch(e){
      alert('Fermeture impossible : '+(e&&e.message||e));
    }finally{fermeture=false;}
  });

  // Mise à jour par Internet : la question vient une fois le logiciel prêt, jamais d'installation sans accord.
  // Sans Internet, rien ne s'affiche. Pendant le téléchargement, la pièce ne peut plus changer.
  const bloquer=e=>{e.stopImmediatePropagation();e.preventDefault();};
  const majVoile=()=>{
    const v=document.createElement('div');
    v.id='majVoile';
    v.style.cssText='position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#fff;font:600 18px system-ui,sans-serif';
    v.textContent='Téléchargement de la mise à jour…';
    document.body.appendChild(v);
    addEventListener('keydown',bloquer,true);
    return v;
  };
  const majInstaller=async()=>{
    const version=await invoke('maj_chercher');
    if(!version)return;
    await pret();
    const r=await mffAsk('ConceptCAD '+version+' est disponible (vous avez la '+String(APP_VER).replace(/^V/,'')+'). ConceptCAD se fermera puis se rouvrira tout seul.',[['oui','Installer maintenant',true],['non','Plus tard']]);
    if(r!=='oui'||(typeof mffModified==='function'&&mffModified()&&!(await mffConfirmDiscard())))return;
    const voile=majVoile();
    const finProgres=await window.__TAURI__.event.listen('maj-progres',e=>{voile.textContent='Téléchargement de la mise à jour : '+e.payload+' %';});
    try{
      await invoke('maj_telecharger');
      oublierBrouillon();
      voile.textContent='Installation de la mise à jour…';
      await invoke('maj_installer');
    }catch(e){
      voile.remove();
      removeEventListener('keydown',bloquer,true);
      alert('Mise à jour impossible : '+(e&&e.message||e)+'\n\nVotre travail n’est pas touché, vous pouvez continuer.');
    }finally{finProgres();}
  };
  addEventListener('load',()=>setTimeout(()=>majInstaller().catch(()=>{}),5000));
})();
