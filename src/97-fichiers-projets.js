/* ---------- Fichiers : ouvrir / enregistrer / enregistrer sous, récents, dossier de projets (V0.2.3) ----------
   Un navigateur n'écrit pas où il veut sur le disque. Chrome et Edge (Windows, Mac) offrent
   l'API d'accès aux fichiers : vraies fenêtres « Ouvrir » / « Enregistrer sous » du système, et
   l'application GARDE le lien vers le fichier → Ctrl+S réécrit le même fichier, sans question.
   Les liens (fichiers récents, dossier de projets) sont mémorisés dans IndexedDB ; le navigateur
   redemande la permission une fois par session (un clic). Firefox / Safari : repli (sélecteur
   de fichier pour ouvrir, téléchargement pour enregistrer).
   Ouvrir / Nouveau : si la pièce a des modifications non enregistrées → Enregistrer / Ne pas
   enregistrer / Annuler, puis l'espace est VIDÉ (docResetEmpty) avant de charger. */
const MFF_FS=typeof window!=='undefined'&&typeof window.showOpenFilePicker==='function';
const MFF_TYPES=[{description:'Projet ConceptCAD',accept:{'application/json':['.conceptcad','.gz','.miniFusion','.json']}}];
let mffHandle=null,mffName='',mffSavedSig=null,mffFolder=null;
function mffSig(){
  // empreinte du DOCUMENT (sans la vue, la sélection ni les replis) : « modifié depuis l'enregistrement »
  try{const o=JSON.parse(serialise(false));delete o.view;delete o.sel;delete o.fold;delete o.originVis;
    // V0.95.1 : nombres arrondis au millionième — le recalcul de fond réécrit des positions d'arêtes
    // au milliardième près (-20.795 → -20.79499999975) : ce n'est pas une modification
    // V0.99.59 : « stale » (parcours FAO à régénérer) est un état de calcul, que la génération de fond
    // remet à jour toute seule une minute après l'ouverture : ce n'est pas une modification (● sans rien toucher)
    // V1.2.1 : « nom » (nom unique d'une face ou d'une arête, 20-05) est complété par le rejeu à l'ouverture d'un
    // ancien fichier, parfois bien après l'ouverture : ce n'est pas une modification (● sans rien toucher, Perçages)
    const s=JSON.stringify(o,(k,v)=>(k==='stale'&&typeof v==='boolean')||(k==='nom'&&typeof v==='string')?undefined:typeof v==='number'&&isFinite(v)&&v!==Math.round(v)?Math.round(v*1e6)/1e6:v);
    let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36)+'_'+s.length;}catch(e){return '';}
}
function mffModified(){
  try{const empty=!(doc.sketches||[]).length&&!(doc.features||[]).length;
    if(mffSavedSig===null)return !empty;return mffSig()!==mffSavedSig;}catch(e){return false;}
}
function mffMark(){mffSavedSig=mffSig();mffTitle();try{pcEcrireSoon();}catch(e){}} // V0.94.6 : pièce enregistrée ou ouverte → gardée sur ce poste (20-75)
function mffTitle(){
  try{
    const nm=mffName||((doc&&doc.name)||'Sans titre');const mod=mffModified();
    const el=document.getElementById('mffName');
    if(el){el.textContent=(mod?'● ':'')+nm;el.title=(mffHandle?'Fichier : '+mffHandle.name:'Pas encore de fichier sur le disque')+(mod?' — modifications non enregistrées':' — enregistré');el.classList.toggle('mod',mod);}
    document.title=(mod?'● ':'')+nm+' — ConceptCAD';
  }catch(e){}
}
/* ---- boîte de dialogue « Enregistrer les modifications ? » ---- */
function mffAsk(msg,buttons){
  // buttons : [[valeur, libellé, primaire?]] → Promise(valeur) ; Échap = 'cancel'
  return new Promise(res=>{
    const bg=document.createElement('div');bg.className='mffDlgBg';
    const d=document.createElement('div');d.className='mffDlg';
    const p=document.createElement('div');p.className='mffMsg';p.textContent=msg;d.appendChild(p);
    const row=document.createElement('div');row.className='mffBtns';
    const done=v=>{document.removeEventListener('keydown',key,true);bg.remove();res(v);};
    buttons.forEach(([v,l,pr])=>{const b=document.createElement('button');b.textContent=l;if(pr)b.className='primary';b.onclick=()=>done(v);row.appendChild(b);});
    d.appendChild(row);bg.appendChild(d);document.body.appendChild(bg);
    const key=e=>{if(e.key==='Escape'){e.preventDefault();done('cancel');}};
    document.addEventListener('keydown',key,true);
    setTimeout(()=>{try{row.querySelector('.primary').focus();}catch(e){}},0);
  });
}
async function mffConfirmDiscard(){
  // true = on peut remplacer la pièce courante
  if(!mffModified())return true;
  const nm=mffName||doc.name||'Sans titre';
  const r=await mffAsk('Enregistrer les modifications de « '+nm+' » ?',[['save','Enregistrer',true],['drop','Ne pas enregistrer'],['cancel','Annuler']]);
  if(r==='cancel')return false;
  if(r==='save'){
    const ok=await mffSave({quitte:true}); // V1.2.4 : la pièce est quittée : rien à garder dans le navigateur
    // V1.2.1 : pas enregistrée → on le dit, et la pièce reste là (avant : rien ne se passait, sans un mot)
    if(!ok){let t='';try{t=(document.getElementById('mffToast').textContent||'').replace(/^\S+\s/,'');}catch(e){}
      mffToast((t?t+' ':'La pièce n’a pas été enregistrée. ')+'Elle reste ouverte : rien n’est perdu.','err');}
    return ok;
  }
  return true;
}
/* ---- V1.2.1 : enregistrement visible et jamais bloqué (Fred, 28/11 : « je sauvegarde, rien de visible » ; puis
   Nouveau → Enregistrer : « rien, la pièce reste visible ») ----
   Le seul retour était la petite ligne d'état en bas de la vue ; et une étape qui ne répond jamais (autorisation
   d'écrire demandée par le navigateur sans fenêtre visible, fichier verrouillé…) laissait l'enregistrement en
   attente pour toujours, les suivants (Ctrl+S, Nouveau → Enregistrer) attendant derrière lui sans rien dire.
   Chaque étape a désormais une durée limite, et un bandeau en haut de la vue dit où l'on en est. */
let MFF_DELAI={perm:20000,disque:30000,donnees:60000,copie:5000};
function mffDelai(p,ms,quoi){
  // promesse p, ou erreur « quoi » si rien n'est venu après ms
  let t=null;
  return Promise.race([Promise.resolve(p).finally(()=>{if(t)clearTimeout(t);}),
    new Promise((_,rej)=>{t=setTimeout(()=>rej(Object.assign(new Error(quoi+' : aucune réponse après '+Math.round(ms/1000)+' s'),{name:'TimeoutError'})),ms);})]);
}
/* V1.2.2 (Fred, 28/11 : « les enregistrements en local sont longs voire n'aboutissent pas ») : le bandeau dit
   l'étape en cours et compte les secondes ; à la fin, la durée et l'étape la plus longue si c'était long.
   Un lien qui n'est pas un fichier du disque (NumPLans : envoi par Internet ; application : pont) a le temps
   qu'il lui faut pour l'envoi : il montre lui-même sa progression. */
function mffLimite(h,ms){return h&&(h.numplans||h.__pont)?Math.max(ms,600000):ms;}
let mffEt=null; // {t0, nom, t, liste:[[étape, ms]]} : enregistrement en cours
function mffEtape(nom){
  if(!mffEt)return;
  const t=performance.now();
  if(mffEt.nom)mffEt.liste.push([mffEt.nom,t-mffEt.t]);
  mffEt.nom=nom;mffEt.t=t;mffToastMaj();
}
function mffEtBilan(){
  // ' (en 12 s ; le plus long : écriture sur le disque, 11 s)' si l'enregistrement a pris plus de 2 s
  if(!mffEt)return '';
  mffEtape(null);
  const tot=performance.now()-mffEt.t0;if(tot<2000)return '';
  const m=mffEt.liste.slice().sort((a,b)=>b[1]-a[1])[0];
  try{log('Enregistrement : '+Math.round(tot)+' ms — '+mffEt.liste.map(e=>e[0]+' '+Math.round(e[1])+' ms').join(', '));}catch(e){}
  return ' (en '+Math.round(tot/1000)+' s'+(m&&m[1]>1000?' ; le plus long : '+m[0]+', '+Math.round(m[1]/1000)+' s':'')+')';
}
function mffManque(){
  // V1.2.3 : compléments non joints, mémoire du navigateur occupée (90-50, bundleSerialise)
  try{return typeof bundleManque!=='undefined'&&bundleManque.length?' Non joints (mémoire du navigateur occupée, ils se recalculent) : '+bundleManque.join(', ')+'.':'';}catch(e){return '';}
}
let mffToastT=null,mffToastTxt='',mffToastI=null,mffToastG='';
function mffToastMaj(){
  // bandeau « en cours » : texte + étape + secondes écoulées
  try{
    const el=document.getElementById('mffToast');if(!el||mffToastG!=='cours')return;
    let suite='';
    if(mffEt&&mffEt.nom){const n=(performance.now()-mffEt.t)/1000;suite=' — '+mffEt.nom+(n>=2?' ('+Math.floor(n)+' s)':'');}
    el.textContent='⏳ '+mffToastTxt+suite;
  }catch(e){}
}
function mffToast(txt,genre){
  // genre : 'cours' (reste affiché), 'ok' (disparaît après 3,5 s), 'err' (10 s, clic pour fermer)
  try{faceEl.textContent=txt;}catch(e){}
  try{
    let el=document.getElementById('mffToast');
    if(!el){el=document.createElement('div');el.id='mffToast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
      el.onclick=()=>{el.classList.remove('on');};document.body.appendChild(el);}
    mffToastTxt=txt;mffToastG=genre||'cours';
    el.textContent=(genre==='ok'?'✔ ':genre==='err'?'⚠ ':'⏳ ')+txt;
    el.className='on '+(genre||'cours');
    if(mffToastT){clearTimeout(mffToastT);mffToastT=null;}
    if(mffToastI){clearInterval(mffToastI);mffToastI=null;}
    if(genre==='ok'||genre==='err')mffToastT=setTimeout(()=>{el.classList.remove('on');},genre==='ok'?3500:10000);
    else{mffToastMaj();mffToastI=setInterval(mffToastMaj,1000);}
  }catch(e){}
}
/* ---- écriture / lecture ---- */
async function mffData(){mffEtape('préparation du fichier');try{return await mffDelai(bundleSerialise(),MFF_DELAI.donnees,'préparation du fichier');}catch(e){return serialise();}}
/* ---- fichier compressé (V0.46.0) : un .conceptcad est écrit en gzip, sans changer d'extension
   (3 à 5 fois plus petit) ; à la lecture, la signature gzip (1F 8B) est reconnue et un fichier
   en clair (anciennes versions, .miniFusion, .json) s'ouvre comme avant ---- */
async function mffPack(txt){
  // texte du projet → octets gzip à écrire (le texte tel quel si le navigateur ne sait pas compresser)
  if(typeof txt!=='string'||typeof TextEncoder==='undefined')return txt;
  // la compression est relue tout de suite : si elle ne redonne pas exactement le texte, on écrit en clair
  try{
    const z=await asmCacheZip(new TextEncoder().encode(txt),false);if(!z||!z.length)return txt;
    const back=await asmCacheZip(z,true);
    return back&&new TextDecoder().decode(back)===txt?z:txt;
  }catch(e){return txt;}
}
async function mffFileText(f){
  // File / Blob d'un projet → texte (décompressé s'il est en gzip)
  if(typeof f.arrayBuffer!=='function')return await f.text();
  const u8=new Uint8Array(await f.arrayBuffer());
  if(u8.length>2&&u8[0]===0x1f&&u8[1]===0x8b){
    const z=await asmCacheZip(u8,true);
    if(!z)throw new Error('fichier compressé : ce navigateur ne sait pas le décompresser');
    return new TextDecoder().decode(z);
  }
  return new TextDecoder().decode(u8);
}
function mffBlob(data){return new Blob([data],{type:typeof data==='string'?'application/json':'application/gzip'});}
async function mffPerm(h,mode){
  const o={mode:mode||'readwrite'};
  try{if((await mffDelai(h.queryPermission(o),MFF_DELAI.perm,'autorisation'))==='granted')return true;}catch(e){}
  // V1.2.1 : la demande d'autorisation peut rester sans réponse (question du navigateur invisible) : limitée dans le temps
  if(mode!=='read'){mffToast('Autorisation d’écrire dans « '+(h.name||'le fichier')+' » : répondez à la question du navigateur (en haut de la fenêtre)…','cours');mffEtape('autorisation du navigateur');}
  try{return (await mffDelai(h.requestPermission(o),MFF_DELAI.perm,'autorisation'))==='granted';}catch(e){return false;}
}
async function mffWrite(h,opt){
  // composants liés modifiés ici : leurs sources d'abord (47-composants-lies)
  try{if(asm&&asmLinked().length)await asmLinksWrite();}catch(e){}
  const data=await mffData();
  return await mffWriteSafe(h,data,opt&&opt.quitte?{quitte:true}:undefined);
}
/* ---- enregistrement sûr (V0.8.3) ----
   1. le contenu est CONTRÔLÉ avant d'écrire (non vide, lisible, c'est bien un projet) : un
      enregistrement raté ne remplace jamais un bon fichier ;
   2. la version précédente est COPIÉE : « nom.miniFusion.bak » à côté du fichier quand il est
      dans le dossier de projets (le navigateur n'écrit qu'où on lui a donné accès), et toujours
      dans le stockage du navigateur (IndexedDB, une copie par fichier ; retirée en V1.2.5) ;
   3. l'écriture passe par le fichier d'échange du navigateur, qui ne remplace l'original qu'à la
      fermeture ; en cas d'erreur elle est abandonnée (l'original reste intact) ;
   4. relecture : la taille écrite doit être celle du contenu, sinon la copie est remise. */
function mffCheckData(txt){
  // → message d'erreur, ou '' si le contenu est un projet lisible
  if(typeof txt!=='string'||txt.length<20)return 'contenu vide';
  let o;try{o=JSON.parse(txt);}catch(e){return 'contenu illisible ('+(e&&e.message||e)+')';}
  if(!o||typeof o!=='object')return 'contenu illisible';
  const d=o.doc&&typeof o.doc==='object'?o.doc:o; // bundle : {doc, …} ; document : {app, …}
  if(d.app!=='ConceptCAD'&&d.app!=='MiniFusion'&&!Array.isArray(d.features)&&!Array.isArray(d.sketches))return 'ce n’est pas un projet ConceptCAD';
  return '';
}
async function mffDirOf(h){
  // Dossier qui contient h, s'il est dans le dossier de projets (sinon null)
  try{
    if(!mffFolder||typeof mffFolder.resolve!=='function')return null;
    const path=await mffFolder.resolve(h);if(!Array.isArray(path)||!path.length)return null;
    let d=mffFolder;for(const n of path.slice(0,-1))d=await d.getDirectoryHandle(n);
    return d;
  }catch(e){return null;}
}
async function mffBackup(h,old,opt){
  // Copie de la version précédente → {disk: nom du .bak ou ''}
  // V1.2.3 (Fred, 28/11 : bandeau « copie de la version précédente (70 s) », enregistrement jamais fini) : la
  // copie dans le navigateur (IndexedDB) n'avait pas de durée limite ; une écriture IndexedDB attend derrière
  // celles d'une autre fenêtre ou d'un autre onglet ConceptCAD (même mémoire du navigateur). La copie est un
  // filet : au-delà de quelques secondes, l'enregistrement continue sans elle.
  // V1.2.4 (Fred, 28/11 : « Pourquoi c'est si long pour un fichier de 268 Ko ? ») : faite APRÈS l'écriture
  // du fichier et sans l'attendre (la version précédente est en mémoire) ; aucune en quittant la pièce
  // (Nouveau / Ouvrir : « pas la peine de le remettre en mémoire »), la copie .bak du disque reste.
  // V1.2.5 (Fred, 28/11 : « pourquoi avoir une copie en mémoire dans le navigateur ? » — « Yes ») : plus de copie
  // dans le navigateur. Le fichier écrit est relu et comparé (version précédente remise sinon) ; la copie .bak
  // à côté du fichier (dossier de projets) reste ; le brouillon garde la pièce en cours.
  const out={disk:''};
  mffEtape('copie de secours sur le disque');
  try{
    const d=await mffDelai(mffDirOf(h),MFF_DELAI.copie,'dossier de projets');
    if(d){const b=await mffDelai(d.getFileHandle(h.name+'.bak',{create:true}),MFF_DELAI.disque,'copie de secours');
      const w=await mffDelai(b.createWritable(),mffLimite(h,MFF_DELAI.disque),'copie de secours');
      try{await mffDelai(w.write(await mffPack(old)),mffLimite(h,MFF_DELAI.disque),'copie de secours');
        await mffDelai(w.close(),mffLimite(h,MFF_DELAI.disque),'copie de secours');out.disk=b.name;}catch(e){try{await w.abort();}catch(e2){}}}
  }catch(e){}
  return out;
}
/* V1.0.2 : fichier bloqué un instant par un autre logiciel (synchronisation Dropbox, antivirus,
   serveur qui relit le fichier juste après l'enregistrement précédent) : le remplacement de
   l'original échouait (« accès refusé », « utilisé par un autre processus ») et seul « Enregistrer
   sous » passait. L'écriture est retentée après ces pauses (ms) avant d'abandonner ; l'original
   reste intact entre deux essais (fichier d'échange). Permission refusée : pas de nouvel essai. */
let MFF_ESSAIS=[150,400,900];
async function mffEcrire(h,bin){
  for(let i=0;;i++){
    let w=null;
    const ms=mffLimite(h,MFF_DELAI.disque);
    try{w=await mffDelai(h.createWritable(),ms,'ouverture du fichier en écriture');
      await mffDelai(w.write(bin),ms,'écriture du fichier');await mffDelai(w.close(),ms,'fin de l’écriture');return;}
    catch(e){
      if(w)try{await w.abort();}catch(e2){}
      const nom=e&&e.name;
      if(i>=MFF_ESSAIS.length||nom==='NotAllowedError'||nom==='SecurityError'||nom==='AbortError'||nom==='TimeoutError')throw e;
      await new Promise(r=>setTimeout(r,MFF_ESSAIS[i]));
    }
  }
}
async function mffWriteSafe(h,data,opt){
  // → {bak:{disk,idb}} ; lève une erreur si rien n'a été écrit (l'original est alors intact)
  const bad=mffCheckData(data);if(bad)throw new Error('enregistrement annulé : '+bad+' — le fichier sur le disque n’a pas été touché');
  mffEtape('lecture de la version précédente');
  let old=null;try{old=await mffDelai(h.getFile().then(mffFileText),mffLimite(h,MFF_DELAI.disque),'lecture du fichier');}catch(e){old=null;}
  let bak={disk:''};
  mffEtape('compression');
  const bin=await mffPack(data);
  mffEtape(h&&h.numplans?'envoi à NumPLans':'écriture sur le disque');
  await mffEcrire(h,bin);
  mffEtape('relecture');
  // relecture : le fichier écrit doit avoir la bonne taille ET redonner exactement le projet
  // (jamais vide ni abîmé) ; sinon la version précédente est remise
  try{
    const f=await mffDelai(h.getFile(),mffLimite(h,MFF_DELAI.disque),'relecture'),n=typeof Blob!=='undefined'?new Blob([bin]).size:bin.length;
    let why='';
    if(typeof f.size==='number'&&f.size!==n)why=f.size+' octets au lieu de '+n;
    else{let back=null;try{back=await mffFileText(f);}catch(e){back=null;}
      if(back!==null&&back!==data)why=back.length?'contenu relu différent':'fichier vide';}
    if(why){
      if(old)await mffEcrire(h,await mffPack(old));
      throw new Error('relecture : '+why+(old?' — version précédente remise':''));
    }
  }catch(e){if(/relecture/.test(e&&e.message||''))throw e;}
  // V1.2.4 : la copie de la version précédente une fois le fichier écrit et relu
  if(old&&old!==data&&!(opt&&opt.noBak))bak=await mffBackup(h,old,opt);
  mffLastBak=bak;
  return {bak};
}
let mffLastBak=null;
/* V1.2.5 : les copies de secours gardées dans le navigateur par les versions d'avant (mff:bak:*) ne servent plus :
   retirées une fois, en fond, quelques secondes après le démarrage (place rendue à la mémoire du navigateur). */
async function mffBakPurge(){
  try{
    const ks=await idbKeys('mff:bak:');if(!ks.length)return 0;
    const db=await idbOpen();
    await new Promise(res=>{try{const tx=db.transaction('kv','readwrite');const st=tx.objectStore('kv');ks.forEach(k=>st.delete(k));
      tx.oncomplete=tx.onerror=tx.onabort=()=>res();}catch(e){res();}});
    try{db.close();}catch(e){}
    return ks.length;
  }catch(e){return 0;}
}
try{if(typeof window!=='undefined'&&typeof indexedDB!=='undefined')setTimeout(()=>{mffBakPurge();},8000);}catch(e){}
async function mffBakFind(h){
  // Copies de secours du fichier courant : sur le disque (.bak) et dans le navigateur
  const out=[];if(!h)return out;
  try{const d=await mffDirOf(h);if(d){const b=await d.getFileHandle(h.name+'.bak');const f=await b.getFile();
    out.push({where:'disk',label:'📁 '+b.name,at:f.lastModified||0,txt:async()=>await mffFileText(f)});}}catch(e){}
  return out.sort((a,b)=>b.at-a.at);
}
async function mffBakOpen(c){
  // Ouvre une copie de secours À LA PLACE du document, rattachée au même fichier : Ctrl+S la
  // réécrit (et la version actuelle devient à son tour la copie)
  if(!(await mffConfirmDiscard()))return false;
  const txt=await c.txt(),bad=mffCheckData(txt);if(bad){alert('Copie de secours illisible : '+bad);return false;}
  const h=mffHandle;await mffLoadText(txt,h?h.name:'copie',h);
  mffSavedSig=null;setTimeout(()=>{mffSavedSig='__copie__';mffTitle();},1600); // « modifié » : le disque a l'autre version
  try{faceEl.textContent='Copie de secours ouverte ('+new Date(c.at).toLocaleString('fr')+') — Ctrl+S pour la remettre dans '+(h?h.name:'le fichier')+'.';}catch(e){}
  return true;
}
async function mffBakMenu(anchor){
  const L=await mffBakFind(mffHandle);
  const items=L.length?L.map(c=>({html:c.label.replace(/</g,'&lt;')+' <span style="opacity:.6">'+(c.at?new Date(c.at).toLocaleString('fr'):'')+'</span>',fn:()=>mffBakOpen(c)}))
    :[{html:'<span style="opacity:.6">'+(mffHandle?'Aucune copie de secours pour ce fichier':'Pas encore de fichier sur le disque')+'</span>',fn:()=>{}}];
  mfPop(anchor,items);
}
function mffBase(n){return String(n||'').replace(/(\.conceptcad(\.gz)?|\.minifusion(\.json)?|\.json)$/i,'');}
/* ---- un seul enregistrement à la fois (V1.0.2) ----
   Deux enregistrements qui se chevauchaient (Ctrl+S appuyé deux fois pendant qu'une grosse pièce
   s'enregistre, ou bouton + raccourci) : la relecture du premier tombait sur le fichier écrit par
   le second, le croyait abîmé, remettait l'ANCIENNE version et ouvrait « Enregistrer sous » ; le
   second annonçait « Enregistré » sur un disque qui avait la version d'avant. Les enregistrements
   passent désormais l'un après l'autre ; celui qui a attendu ne réécrit pas une pièce que le
   précédent vient d'enregistrer sans changement depuis. */
let mffFile=Promise.resolve(),mffEnCours=0;
function mffSerie(fn){
  const attendu=mffEnCours>0;mffEnCours++;
  if(attendu)mffToast('Un enregistrement est encore en cours : celui-ci suit dès qu’il se termine…','cours');
  const p=mffFile.then(()=>fn(attendu));
  mffFile=p.then(()=>{mffEnCours--;},()=>{mffEnCours--;});
  return p;
}
function mffSave(opt){return mffSerie(a=>mffSaveNow(a,opt));} // true si enregistré ; opt.quitte : avant Nouveau / Ouvrir
function mffSaveAs(){return mffSerie(()=>mffSaveAsNow());}
async function mffSaveNow(attendu,opt){
  if(attendu&&mffHandle&&!mffModified())return true; // le précédent vient de l'enregistrer
  if(mffHandle&&(MFF_FS||typeof mffHandle.createWritable==='function')){ // un lien qui sait écrire suffit
    try{
      mffEt={t0:performance.now(),nom:null,t:0,liste:[]};
      mffToast('Enregistrement de '+mffHandle.name+'…','cours');
      if(!(await mffPerm(mffHandle,'readwrite')))throw Object.assign(new Error('le navigateur n’a pas donné l’autorisation d’écrire dans ce fichier'),{perm:true});
      mffToast('Enregistrement de '+mffHandle.name+'…','cours');
      const r=await mffWrite(mffHandle,opt);fileHandle=mffHandle;mffMark();mffRecentAdd(mffHandle);
      if(opt&&opt.quitte){try{if(pcEcrT){clearTimeout(pcEcrT);pcEcrT=null;}}catch(e){}} // ni image ni brouillon d'une pièce quittée
      else try{autosave();}catch(e){}
      const bk=r&&r.bak&&r.bak.disk?' — version précédente : '+r.bak.disk:'';
      mffToast('Enregistré dans '+mffHandle.name+bk+mffEtBilan()+'.'+mffManque(),'ok');mffEt=null;
      return true;
    }catch(e){
      const etape=mffEt&&mffEt.nom;mffEtBilan();mffEt=null;
      mffToast('Enregistrement dans '+mffHandle.name+' impossible'+(etape&&!(e&&e.perm)?' à l’étape « '+etape+' »':'')+' ('+(e&&e.message||e)+') — choisissez où enregistrer.','err');
      // V1.2.2 : la fenêtre « Enregistrer sous » s'ouvre au même endroit, sous le même nom
      return await mffSaveAsNow({ici:mffHandle,quitte:!!(opt&&opt.quitte)});
    }
  }
  return await mffSaveAsNow();
}
async function mffSaveAsNow(opt){
  const ici=opt&&opt.ici&&!opt.ici.numplans?opt.ici:null; // V1.2.2 : même dossier, même nom
  const fname=ici&&ici.name||(mffName||doc.name||'piece').replace(/[\\/:*?"<>|]/g,'_')+'.conceptcad';
  if(MFF_FS&&window.showSaveFilePicker){
    try{
      const o={suggestedName:fname,types:MFF_TYPES};if(ici)o.startIn=ici;else if(mffFolder)o.startIn=mffFolder;else if(mffHandle)o.startIn=mffHandle;
      mffToast('Choisissez où enregistrer « '+fname+' »…','cours');
      let h;
      try{h=await window.showSaveFilePicker(o);}
      catch(e){
        if(!(e&&(e.name==='SecurityError'||e.name==='NotAllowedError')))throw e;
        // V1.2.2 : plus de geste récent (le clic ou Ctrl+S date de l'autorisation demandée) : le navigateur
        // n'ouvre pas sa fenêtre ; un bouton la redemande
        const c=await mffAsk('Le navigateur n’a pas laissé écrire dans « '+(ici?ici.name:fname)+' ». Choisissez où enregistrer la pièce'+(ici?' (même dossier, même nom : acceptez de remplacer le fichier)':'')+'.',
          [['go','Choisir où enregistrer…',true],['cancel','Annuler']]);
        if(c!=='go'){mffToast('Enregistrement annulé : la pièce n’a pas été enregistrée.','err');return false;}
        h=await window.showSaveFilePicker(o);
      }
      mffEt={t0:performance.now(),nom:null,t:0,liste:[]};
      mffToast('Enregistrement de '+h.name+'…','cours');
      try{await mffWrite(h,opt);}finally{if(mffEt)mffEtape(null);}
      mffHandle=h;fileHandle=h;mffName=mffBase(h.name);docNomFichier(mffName);mffMark();mffRecentAdd(h);
      try{autosave();renderTree();renderProps();}catch(e){}
      mffToast('Enregistré sous '+h.name+mffEtBilan()+'.'+mffManque(),'ok');mffEt=null;
      return true;
    }catch(e){mffEt=null;if(e&&e.name==='AbortError'){mffToast('Enregistrement annulé : la pièce n’a pas été enregistrée.','err');return false;}
      mffToast('Enregistrer sous : '+(e&&e.message||e),'err');return false;}
  }
  // repli : téléchargement
  try{const txt=await mffData();if(mffCheckData(txt)){mffToast('Enregistrement impossible : '+mffCheckData(txt),'err');return false;}const data=await mffPack(txt);const a=document.createElement('a');a.href=URL.createObjectURL(mffBlob(data));a.download=fname;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);mffMark();
    mffToast('« '+fname+' » enregistré dans les téléchargements.','ok');return true;}catch(e){mffToast('Enregistrement impossible : '+(e&&e.message||e),'err');return false;}
}
async function mffLoadText(txt,name,handle){
  // vide l'espace PUIS charge (document + trajectoires), sans demander : l'appelant a déjà confirmé
  // V0.46.2 : contenu contrôlé AVANT de vider l'espace (fichier vide / tronqué : rien n'est perdu)
  const bad=mffCheckData(txt);if(bad)throw new Error(bad+' — le modèle ouvert n’a pas été remplacé');
  try{if(typeof faoVw!=='undefined'&&faoVw&&typeof faoViewerOpen==='function')faoViewerOpen();}catch(e){} // simulation fermée
  try{docResetEmpty();}catch(e){}
  const nm=mffBase(name);
  if(bundleIs(txt))await bundleRestore(txt,{name:nm});
  else{await deserialise(txt);docNomFichier(nm);rebuild();}
  mffHandle=handle||null;fileHandle=mffHandle;mffName=nm;
  try{renderTree();renderProps();}catch(e){}
  try{showAll();}catch(e){}
  mffMark();
  setTimeout(mffMark,1500); // après le rejeu complet (le document se normalise à l'ouverture)
  if(handle)mffRecentAdd(handle);
  try{faceEl.textContent='Ouvert : '+(handle?handle.name:name)+'.';}catch(e){}
}
async function mffOpenHandle(h){
  try{
    if(!(await mffPerm(h,'read')))throw new Error('permission refusée');
    // compressé abîmé (gzip coupé) : traité comme un fichier vide, la copie de secours est proposée
    const f=await h.getFile();let txt='',bad='';try{txt=await mffFileText(f);bad=mffCheckData(txt);}catch(e){bad='compression illisible';}
    if(bad)return await mffOpenDamaged(h,f,bad);
    await mffLoadText(txt,f.name,h);return true;
  }catch(e){alert('Ouverture impossible : '+(e&&e.message||e));return false;}
}
async function mffOpenDamaged(h,f,bad){
  // V0.46.2 : fichier vide ou abîmé sur le disque (vu : Barquette à 0 octet) — le modèle ouvert
  // reste en place ; la copie de secours la plus récente (.bak, navigateur) est proposée
  const L=[];for(const c of await mffBakFind(h)){try{const t=await c.txt();if(!mffCheckData(t))L.push({c,t});}catch(e){}}
  const what='« '+h.name+' » est '+(f.size===0?'vide (0 octet)':'abîmé ('+bad+', '+f.size+' octets)')+'.';
  if(!L.length){alert(what+'\nAucune copie de secours lisible pour ce fichier. Le modèle ouvert n’a pas été remplacé.');return false;}
  const c=L[0].c;
  const r=await mffAsk(what+'\nOuvrir la copie de secours ('+c.label+(c.at?', '+new Date(c.at).toLocaleString('fr'):'')+') ? Ctrl+S la remettra dans le fichier.',
    [['bak','Ouvrir la copie',true],['cancel','Annuler']]);
  if(r!=='bak')return false;
  await mffLoadText(L[0].t,h.name,h);
  mffSavedSig=null;setTimeout(()=>{mffSavedSig='__copie__';mffTitle();},1600); // « modifié » : le disque n'a pas cette version
  try{faceEl.textContent='Copie de secours ouverte — « '+h.name+' » était '+(f.size===0?'vide':'abîmé')+' ; Ctrl+S pour la remettre dans le fichier.';}catch(e){}
  return true;
}
async function mffOpen(){
  if(!(await mffConfirmDiscard()))return;
  if(MFF_FS){
    try{
      const o={types:MFF_TYPES,multiple:false};if(mffFolder)o.startIn=mffFolder;
      const [h]=await window.showOpenFilePicker(o);if(h)await mffOpenHandle(h);
    }catch(e){if(!(e&&e.name==='AbortError'))alert('Ouverture impossible : '+(e&&e.message||e));}
    return;
  }
  mffPendingOpen=true;try{document.getElementById('fileProj').click();}catch(e){}
}
let mffPendingOpen=false;
async function mffNew(){
  if(!(await mffConfirmDiscard()))return;
  try{if(typeof faoVw!=='undefined'&&faoVw&&typeof faoViewerOpen==='function')faoViewerOpen();}catch(e){}
  docResetEmpty();mffHandle=null;mffName='';
  markDirty();rebuild();renderProps();try{renderTree();showAll();}catch(e){}
  mffSavedSig=null;mffTitle();
  try{faceEl.textContent='Nouveau modèle. Créez une esquisse.';}catch(e){}
}
/* ---- fichiers récents (liens mémorisés) ---- */
async function mffRecentList(){try{const l=await idbGet('mff:recent');return Array.isArray(l)?l:[];}catch(e){return [];}}
async function mffRecentAdd(h){
  try{
    const l=await mffRecentList();const out=[{name:h.name,h:h,at:Date.now()}];
    for(const it of l){if(out.length>=8)break;let same=false;try{same=it.h&&(await it.h.isSameEntry(h));}catch(e){}if(!same)out.push(it);}
    await idbSet('mff:recent',out);
  }catch(e){}
}
async function mffRecentMenu(anchor){
  const l=await mffRecentList();
  const items=l.length?l.map(it=>({html:'<span style="opacity:.6">🕘</span> '+it.name.replace(/</g,'&lt;'),fn:async()=>{if(await mffConfirmDiscard())mffOpenHandle(it.h);}})):[{html:'<span style="opacity:.6">Aucun fichier récent</span>',fn:()=>{}}];
  if(l.length)items.push({html:'<span style="opacity:.6">✕ Vider la liste</span>',fn:()=>{idbSet('mff:recent',[]).catch(()=>{});}});
  mfPop(anchor,items);
}
/* ---- dossier de projets ---- */
async function mffFolderLoad(){try{const h=await idbGet('mff:folder');if(h)mffFolder=h;}catch(e){}}
async function mffFolderChoose(){
  try{const h=await window.showDirectoryPicker({id:'minifusion-projets',mode:'readwrite'});mffFolder=h;await idbSet('mff:folder',h);return h;}catch(e){return null;}
}
async function mffFolderPanel(){
  const old=document.getElementById('mffPanel');if(old){old.remove();return;}
  if(!MFF_FS){alert('Le dossier de projets demande Chrome ou Edge (API d’accès aux fichiers).');return;}
  if(!mffFolder)await mffFolderLoad();
  const pn=document.createElement('div');pn.id='mffPanel';pn.className='mffPanel';
  const close=()=>pn.remove();
  const head=document.createElement('div');head.className='mffHead';
  const t=document.createElement('b');t.textContent='Dossier de projets';head.appendChild(t);
  const x=document.createElement('button');x.textContent='✕';x.title='Fermer';x.onclick=close;head.appendChild(x);
  pn.appendChild(head);
  const body=document.createElement('div');body.className='mffBody';pn.appendChild(body);
  document.body.appendChild(pn);
  const draw=async()=>{
    body.innerHTML='';
    const bar=document.createElement('div');bar.className='mffBar';
    const ch=document.createElement('button');ch.textContent=mffFolder?'Changer de dossier…':'Choisir un dossier…';ch.onclick=async()=>{if(await mffFolderChoose())draw();};bar.appendChild(ch);
    if(mffFolder){const sv=document.createElement('button');sv.className='primary';sv.textContent='Enregistrer ici';sv.title='Enregistrer la pièce courante dans ce dossier';
      sv.onclick=async()=>{const nm=prompt('Nom du fichier :',(mffName||doc.name||'piece').replace(/[\\/:*?"<>|]/g,'_'));if(!nm)return;
        await mffSerie(async()=>{try{if(!(await mffPerm(mffFolder,'readwrite')))return;const h=await mffFolder.getFileHandle(mffBase(nm)+'.conceptcad',{create:true});await mffWrite(h);mffHandle=h;fileHandle=h;mffName=mffBase(h.name);docNomFichier(mffName);mffMark();mffRecentAdd(h);try{renderTree();renderProps();}catch(e){}draw();}catch(e){alert('Enregistrement impossible : '+(e&&e.message||e));}});};
      bar.appendChild(sv);}
    body.appendChild(bar);
    if(!mffFolder){const n=document.createElement('div');n.className='mffNote';n.textContent='Choisissez le dossier où vous rangez vos pièces : la liste de ses projets apparaîtra ici (double-clic pour ouvrir).';body.appendChild(n);return;}
    const path=document.createElement('div');path.className='mffNote';path.textContent='📁 '+mffFolder.name;body.appendChild(path);
    if(!(await mffPerm(mffFolder,'read'))){const n=document.createElement('div');n.className='mffNote';n.textContent='Permission nécessaire : cliquez « Changer de dossier… » ou rouvrez ce panneau.';body.appendChild(n);return;}
    const files=[];
    try{for await(const [nm,h] of mffFolder.entries()){if(h.kind==='file'&&/\.(conceptcad|conceptcad\.gz|miniFusion|json)$/i.test(nm)){let t=0;try{t=(await h.getFile()).lastModified;}catch(e){}files.push({nm,h,t});}}}catch(e){}
    files.sort((a,b)=>b.t-a.t);
    const list=document.createElement('div');list.className='mffList';
    if(!files.length){const n=document.createElement('div');n.className='mffNote';n.textContent='Aucun projet (.conceptcad ou .miniFusion) dans ce dossier.';list.appendChild(n);}
    files.forEach(f=>{const r=document.createElement('div');r.className='mffRow';if(mffHandle&&mffHandle.name===f.nm)r.classList.add('on');
      r.innerHTML='<span>'+f.nm.replace(/</g,'&lt;')+'</span><em>'+(f.t?new Date(f.t).toLocaleString('fr'):'')+'</em>';
      r.title='Double-clic : ouvrir';r.ondblclick=async()=>{if(await mffConfirmDiscard()){await mffOpenHandle(f.h);close();}};list.appendChild(r);});
    body.appendChild(list);
  };
  draw();
}
/* ---- branchement : boutons existants, bandeau, raccourcis ---- */
function mffCss(){
  if(document.getElementById('mffCss'))return;
  const st=document.createElement('style');st.id='mffCss';
  st.textContent=[
    '.mffDlgBg{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}',
    '.mffDlg{min-width:380px;max-width:520px;padding:18px 20px;border-radius:14px;background:var(--surface);background-color:var(--bg);border:1px solid var(--border);box-shadow:0 20px 50px rgba(0,0,0,.5);color:var(--text)}',
    '.mffMsg{font-size:.95rem;margin-bottom:16px;line-height:1.4;white-space:pre-line}',
    '.mffBtns{display:flex;gap:8px;justify-content:flex-end}',
    // V1.2.1 : où en est l'enregistrement, en haut au milieu (au-dessus des dispositions des thèmes)
    '#mffToast{position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:9100;display:none;max-width:min(640px,80vw);padding:9px 16px;border-radius:10px;'+
      'background-color:var(--bg);border:1px solid var(--border);box-shadow:0 10px 30px rgba(0,0,0,.45);color:var(--text);font-size:.85rem;line-height:1.35;cursor:pointer}',
    '#mffToast.on{display:block}#mffToast.ok{border-color:#30d158}#mffToast.err{border-color:#ff6b5c}#mffToast.cours{border-color:var(--primary)}',
    '#mffName{font-size:.78rem;padding:3px 10px;border-radius:8px;color:var(--muted);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default}',
    '#mffName.mod{color:var(--text)}',
    '.mffPanel{position:fixed;right:16px;top:72px;z-index:8000;width:380px;max-height:70vh;display:flex;flex-direction:column;border-radius:14px;background-color:var(--bg);border:1px solid var(--border);box-shadow:0 20px 50px rgba(0,0,0,.45);color:var(--text)}',
    '.mffHead{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border)}',
    '.mffHead button{padding:2px 8px}',
    '.mffBody{padding:10px 14px;overflow:auto;display:flex;flex-direction:column;gap:8px}',
    '.mffBar{display:flex;gap:6px;flex-wrap:wrap}',
    '.mffNote{font-size:.75rem;color:var(--muted)}',
    '.mffList{display:flex;flex-direction:column;gap:2px}',
    '.mffRow{display:flex;justify-content:space-between;gap:10px;padding:6px 8px;border-radius:7px;cursor:pointer;font-size:.8rem}',
    '.mffRow:hover{background:rgba(127,127,127,.14)}.mffRow.on{background:var(--primary);color:#fff}',
    '.mffRow em{font-style:normal;font-size:.7rem;opacity:.65;white-space:nowrap}'
  ].join('\n');
  document.head.appendChild(st);
}
(function(){
  try{
    mffCss();
    const $$=id=>document.getElementById(id);
    // boutons historiques (menu Projet de l'interface classique) : même logique partout
    if($$('btnNew'))$$('btnNew').onclick=()=>mffNew();
    if($$('btnLoad'))$$('btnLoad').onclick=()=>mffOpen();
    if($$('btnSave'))$$('btnSave').onclick=()=>mffSave();
    if($$('btnSaveAs'))$$('btnSaveAs').onclick=()=>mffSaveAs();
    // repli sans API : le sélecteur de fichier historique confirme, vide puis charge
    const fp=$$('fileProj');
    if(fp){
      const nf=fp.cloneNode(true);fp.parentNode.replaceChild(nf,fp); // retire l'ancien gestionnaire
      nf.addEventListener('change',async e=>{
        const f=e.target.files[0];e.target.value='';if(!f)return;
        if(!mffPendingOpen&&!(await mffConfirmDiscard()))return;
        mffPendingOpen=false;
        try{await mffLoadText(await mffFileText(f),f.name,null);}catch(err){alert('Projet illisible : '+err.message);}
      });
    }
    // menu Projet (classique) : + Ouvrir récent, Dossier de projets
    const nb=$$('btnNew'),menu=nb&&nb.parentNode;
    if(menu&&menu.classList&&menu.classList.contains('ddMenu')&&!$$('btnRecent')){
      const r=document.createElement('button');r.id='btnRecent';r.innerHTML='<i>🕘</i>Ouvrir récent…';r.title='Fichiers ouverts ou enregistrés récemment';r.onclick=e=>{e.stopPropagation();mffRecentMenu(r);};
      const f=document.createElement('button');f.id='btnFolder';f.innerHTML='<i>📁</i>Dossier de projets…';f.title='Explorer le dossier où vous rangez vos pièces';f.onclick=()=>mffFolderPanel();
      const k=document.createElement('button');k.id='btnBak';k.innerHTML='<i>🛟</i>Copie de secours…';k.title='Version précédente du fichier, gardée à chaque enregistrement (.bak à côté du fichier dans le dossier de projets, et dans le navigateur)';k.onclick=e=>{e.stopPropagation();mffBakMenu(k);};
      menu.appendChild(r);menu.appendChild(f);menu.appendChild(k);
    }
    // nom du fichier + point « modifié » à côté du logo (les deux interfaces)
    const brand=document.querySelector('.topbar .brand');
    if(brand&&!$$('mffName')){const n=document.createElement('span');n.id='mffName';brand.parentNode.insertBefore(n,brand.nextSibling);}
    setInterval(mffTitle,1000);
    // raccourcis : Ctrl+S, Ctrl+Maj+S, Ctrl+O
    document.addEventListener('keydown',e=>{
      if(!(e.ctrlKey||e.metaKey))return;const k=(e.key||'').toLowerCase();
      // V1.0.2 : touche maintenue (répétition du clavier) = un seul enregistrement
      if(k==='s'){e.preventDefault();e.stopPropagation();if(!e.repeat)(e.shiftKey?mffSaveAs:mffSave)();}
      else if(k==='o'){e.preventDefault();e.stopPropagation();mffOpen();}
    },true);
    mffFolderLoad();
    // brouillon restauré au démarrage : il n'est sur AUCUN fichier → compté « non enregistré »
    setTimeout(mffTitle,2500);
  }catch(e){}
})();
