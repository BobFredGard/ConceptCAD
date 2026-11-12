/* ---------- sauvegarde locale + fichier dédié ---------- */
function serialise(pretty){
  // pretty=1 (défaut) pour l'export fichier lisible ; compact pour l'autosave local
  // (~40 % de volume en moins à sérialiser et à écrire à chaque sauvegarde).
  // V0.6.0 / V0.6.1 : le composant actif reste au premier niveau (un fichier sans composant
  // enfant est inchangé, une version antérieure ouvre le composant actif) ; les autres
  // composants et les occurrences sont dans le bloc asm (46-assemblage-modele.js).
  const o=serialiseObj(doc,true);
  const a=asmSerial();if(a)o.asm=a;
  return JSON.stringify(o,null,pretty===false?null:2);
}
function serialiseObj(d,ui){
  // Objet d'une pièce. ui : état d'interface (repère, vue, sélection) — pièce active seulement
  // (undefined → clé absente du JSON : l'ordre et le contenu restent ceux d'avant).
  return {app:'ConceptCAD',v:1,name:d.name,tint:d.tint||0,entNames:d.entNames||null,originVis:ui?originVis:undefined,view:ui?collectView():undefined,bodyVis:d.bodyVis||{},bodies:(d.bodies||[]).map(e=>({id:e.id,name:e.name,c:e.c,color:e.color,mat:e.mat||undefined,op:e.op,gl:e.gl,open:e.open!==false})),bodySeq:d.bodySeq||0,activeBody:d.activeBody||null,fold:{sk:!!(d.fold&&d.fold.sk),origin:!!(d.fold&&d.fold.origin)},fao:d.fao||null,mep:d.mep||null,rendu:(typeof renduNorm==='function'?renduNorm(d.rendu):null)||undefined,params:(d.params||[]).map(p=>({name:p.name,expr:p.expr,value:p.value,mes:p.mes||undefined})),derive:derClean(d.derive),configs:(typeof cfgNorm==='function'?cfgNorm(d.configs):null)||undefined,sel:ui?{kind:sel.kind,id:sel.id}:undefined,sketches:(d.sketches||[]).map(s=>{const c=Object.assign({},s);delete c._refs;return c;}),features:(d.features||[]).map(({_mesh,_m,_perdues,...r})=>r),cgeo:(d.cgeo||[]).map(cgClean),std:d.std||undefined,mat:d.mat||undefined,env:serialEnv(d)}; // std : pièce normalisée (48-composants-normalises) ; env : environnement de la pièce (98-rendu-vue)
}
function serialEnv(d){ // pièce active : ce qui est à l'écran ; les autres : ce qu'elles ont gardé
  try{return d===doc?vEnvCollect():(d._env||undefined);}catch(e){return d._env||undefined;}
}
function docFromSerial(o){
  // Document de pièce à partir de son objet sérialisé (ouverture, pièces d'un assemblage)
  const d={name:o.name||'Sans titre',tint:o.tint||0,entNames:o.entNames||null,sketches:o.sketches||[],features:o.features||[],cgeo:Array.isArray(o.cgeo)?o.cgeo.filter(cgValid):[],bodyVis:o.bodyVis||{},bodies:Array.isArray(o.bodies)?o.bodies.filter(e=>e&&typeof e.id==='string').map(e=>({id:e.id,name:String(e.name||e.id),c:Array.isArray(e.c)&&e.c.length===3?e.c.slice():null,color:isFinite(+e.color)?+e.color:undefined,mat:(typeof matDef==='function'&&matDef(e.mat))?e.mat:undefined,op:(e.op>0&&e.op<1)?+e.op:undefined,gl:(e.gl>0&&e.gl<1)?+e.gl:undefined,open:e.open!==false})):[],
    bodySeq:o.bodySeq>0?Math.floor(o.bodySeq):1,activeBody:(typeof o.activeBody==='string')?o.activeBody:null,fold:(o.fold&&typeof o.fold==='object')?{sk:!!o.fold.sk,origin:!!o.fold.origin}:{},fao:o.fao||null,mep:o.mep||null,rendu:(typeof renduNorm==='function'?renduNorm(o.rendu):null),_env:vEnvNorm(o.env),params:Array.isArray(o.params)?o.params.filter(p=>p&&typeof p.name==='string'):[],derive:Array.isArray(o.derive)?o.derive.filter(L=>L&&typeof L.id==='string'):undefined,configs:(typeof cfgNorm==='function'?cfgNorm(o.configs):null),
    std:(o.std&&typeof o.std==='object'&&typeof o.std.key==='string')?Object.assign({key:o.std.key,norm:String(o.std.norm||''),desig:String(o.std.desig||'')},
      typeof o.std.cat==='string'&&o.std.st&&typeof o.std.st==='object'?{cat:o.std.cat,st:Object.fromEntries(Object.entries(o.std.st).filter(e=>typeof e[1]==='string'))}:{},magNorm(o.std.mag)?{mag:magNorm(o.std.mag)}:{}):undefined,
    mat:(o.mat&&typeof o.mat==='object'&&typeof o.mat.name==='string'&&o.mat.rho>0&&isFinite(+o.mat.rho))?{name:o.mat.name,rho:+o.mat.rho}:undefined};
  let mx=0;
  (d.bodies||[]).forEach(e=>{const m=/^b(\d+)$/.exec(e.id||'');if(m)mx=Math.max(mx,+m[1]);});
  if(!(d.bodySeq>mx))d.bodySeq=mx+1;
  if(d.activeBody&&!d.bodies.some(e=>e.id===d.activeBody))d.activeBody=null;
  return d;
}
function docHash(){
  // Empreinte du paramétrique rejouable (imports éphémères exclus : non persistés).
  // Normalisée comme serialise : AUCUN champ transitoire (_m, _refs, _health, _audit),
  // sinon le cache raterait à chaque F5 (c'était le bug de l'éventail).
  if(_hashMemo&&_hashVer===_docVersion)return _hashMemo; // même version → empreinte déjà calculée
  const h=docHashOf(doc);
  if(h!=='x'){_hashMemo=h;_hashVer=_docVersion;}
  return h;
}
function docHashSrc(d){
  // Texte normalisé dont docHash prend l'empreinte — pour n'importe quel document (composants
  // d'un assemblage : cache des instantanés, 47-assemblage-cache)
  const stripSketch=sk=>{const c=Object.assign({},sk);delete c._refs;delete c._health;delete c._audit;return c;};
  const stripFeat=({_mesh,_m,_perdues,...r})=>r;
  const stripCg=c=>{const o=cgClean(c);delete o.st;delete o.msg;delete o.ai;return o;};
  return JSON.stringify({s:d.sketches.map(stripSketch),f:(d.features||[]).filter(f=>f.type!=='import'||f.derive).map(stripFeat),t:d.tint||0,...((d.cgeo&&d.cgeo.length)?{c:d.cgeo.map(stripCg)}:{})},nomsSansCles); // construction : seulement si présente (empreinte des anciens documents inchangée)
}
function docHashOf(d){
  try{
    const s=docHashSrc(d);
    let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return (h>>>0).toString(36)+'_'+s.length;
  }catch(e){return 'x';}
}
function idbOpen(){
  return new Promise((res,rej)=>{
    try{
      const rq=indexedDB.open('minifusion',1);
      rq.onupgradeneeded=()=>{rq.result.createObjectStore('kv');};
      rq.onsuccess=()=>res(rq.result);
      rq.onerror=()=>rej(rq.error);
    }catch(e){rej(e);}
  });
}
async function idbSet(k,v){
  const db=await idbOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);
    tx.oncomplete=()=>{try{db.close();}catch(e){}res();};
    tx.onerror=()=>{try{db.close();}catch(e){}rej(tx.error);};
  });
}
async function idbGet(k){
  const db=await idbOpen();
  return new Promise((res,rej)=>{
    const rq=db.transaction('kv').objectStore('kv').get(k);
    rq.onsuccess=()=>{try{db.close();}catch(e){}res(rq.result);};
    rq.onerror=()=>{try{db.close();}catch(e){}rej(rq.error);};
  });
}
async function idbKeys(prefix){
  // Tous les identifiants du magasin « kv », filtres par prefixe — necessaire
  // pour embarquer le cache de trajectoires dans un fichier .miniFusion.
  const db=await idbOpen();
  return new Promise((res,rej)=>{
    try{
      const rq=db.transaction('kv','readonly').objectStore('kv').getAllKeys();
      rq.onsuccess=()=>{try{db.close();}catch(e){}
        res((rq.result||[]).filter(function(k){
          return typeof k==='string'&&(!prefix||k.indexOf(prefix)===0); }));
      };
      rq.onerror=()=>{try{db.close();}catch(e){}rej(rq.error);};
    }catch(e){try{db.close();}catch(e2){}rej(e);}
  });
}
function saveViewCache(){
  // Mémorise le dernier affichage valide (hors ligne = retour instantané au rechargement).
  try{
    const items=[];let verts=0;
    for(const b of bodies){
      if(b.ghost||b.cached||!b.mesh||!b.mesh.visible)continue;
      if(b.kind==='import')continue; // éphémères : non persistés, non cachés
      const g=b.mesh.geometry;if(!g||!g.attributes.position||!g.attributes.position.count)continue;
      const p=g.attributes.position.array,n=g.attributes.normal?g.attributes.normal.array:null;
      verts+=g.attributes.position.count;if(verts>1500000)return; // trop gros : pas de cache
      // On persiste la SOURCE (fiche du corps), pas la matière affichée : un fondu
      // d'esquisse ou un cache local ne doit jamais figurer dans le document.
      const bid=b.bodyId||bodyIdOfRuntime(b)||b.id;
      items.push({id:b.id,bodyId:bid,name:b.name,color:bodyColorOf(bid),kind:b.kind||'mesh',ref:b.ref||null,
        op:bodyOpOf(bid),
        pos:ArrayBuffer.isView(p)?p.slice():p.slice(),nor:n?(ArrayBuffer.isView(n)?n.slice():n.slice()):null});
    }
    if(!items.length)return;
    idbSet('lastGood',{v:1,ver:CACHE_VER,at:Date.now(),hash:docHash(),engine:occEngineMsg,exact:builtEngine==='exact',items}).catch(()=>{});
  }catch(e){}
}
async function restoreViewCache(){
  // Affiche le cache pendant que le noyau exact recalcul en fond. Retourne true si appliqué.
  try{
    if(typeof indexedDB==='undefined')return false;
    const c=await idbGet('lastGood');
    if(!c||c.v!==1||!c.items||!c.items.length)return false;
    // La VALIDITÉ du cache dépend du hash du document ET de la VERSION DU MOTEUR (CACHE_VER,
    // pas APP_VER : une évolution d'interface ne produit pas une autre image). Sans ce
    // second critère, un rendu produit par une version buguée est restauré indéfiniment :
    // le document n'a pas bougé, donc le hash colle, et l'affichage reste celui de l'ancien
    // code — même après le correctif. Symptôme exact : « F5 n'affiche rien, il faut cliquer
    // sur Recalculer ». Toute évolution du moteur de géométrie invalide donc le cache.
    if(!cacheVerOK(c.ver))return false;
    if(c.hash!==docHash())return false; // doc différent : recalcul direct
    clearBodies();
    c.items.forEach(it=>{
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(it.pos,3));
      if(it.nor&&it.nor.length===it.pos.length)g.setAttribute('normal',new THREE.Float32BufferAttribute(it.nor,3));
      else g.computeVertexNormals();
      const bid=it.bodyId||it.id;
      const mat=new THREE.MeshStandardMaterial({color:it.color,metalness:.35,roughness:.4});
      try{applyBodyStyle(mat,bid);}catch(e){}
      const mesh=new THREE.Mesh(g,mat);mesh.userData.bid=it.id;scene.add(mesh);
      bodies.push({id:it.id,name:it.name,mesh,color:it.color,visible:true,kind:it.kind,ref:it.ref,cached:true,bodyId:bid});
    });
    if(!bodies.length)return false;
    builtHash=c.hash;builtEngine=c.exact?'exact':'mesh'; // l'affichage correspond au doc : aucun recalcul auto
    occEngineMsg='cache — image affichée, rejeu exact en cours ('+(c.engine||'?')+')';occStatus();
    refreshParts();renderTree();showAll();applyClip();buildEdgeOverlay();refreshMirror();
    faceEl.textContent='Pièce affichée depuis le cache local — le solide exact est rejoué juste après (nécessaire pour les congés, les esquisses sur face et la sélection de faces).';
    return true;
  }catch(e){return false;}
}
function markDirty(){dirty=true;_docVersion++;refreshParts();try{docUndoNudge();}catch(e){}try{parMiniSoon();}catch(e){}} // filet d'annulation (45) ; mini-liste des paramètres (52)
function autosave(){
  // Différé : une rafale de reconstructions n'écrit plus le document local à chaque fois
  // (sérialisation + écriture synchrone qui bloquaient le fil principal). Le contenu
  // reste identique ; l'indicateur « non sauvegardé » reste honnête jusqu'à l'écriture.
  refreshParts();
  if(_autoT)clearTimeout(_autoT);
  _autoT=setTimeout(()=>{_autoT=null;try{autosaveWrite();dirty=false;}catch(e){}refreshParts();},600);
}
function autosaveFlush(){ // fermeture d'onglet : plus aucune perte possible
  if(!dirty)return;
  try{autosaveWrite();dirty=false;}catch(e){}
}
/* V0.29.0 : brouillon trop gros pour le stockage local (≈ 5 Mo : grand assemblage, imports) —
   l'écriture échouait sans bruit et l'ANCIEN brouillon restait, restauré au rechargement. Il
   part alors dans IndexedDB ('draft' = {at, txt}) ; le stockage local n'en garde que la date
   (minifusion_auto_idb), et plus aucun brouillon périmé. Relu par draftRestore (99-init). */
let bootHold=false; // V0.31.2 : brouillon mis de côté après un démarrage interrompu (99-init) — pas de sauvegarde auto
function autosaveWrite(){
  if(bootHold||window.__mfResetting)return 'hold'; // … ou nettoyage « Vider le cache » en cours (écran de démarrage)
  const txt=serialise(false);
  try{localStorage.setItem('minifusion_auto',txt);try{localStorage.removeItem('minifusion_auto_idb');}catch(e){}return 'ls';}catch(e){}
  const at=Date.now();
  try{localStorage.removeItem('minifusion_auto');}catch(e){}
  try{localStorage.setItem('minifusion_auto_idb',String(at));}catch(e){}
  try{idbSet('draft',{at,txt}).catch(()=>{});}catch(e){}
  return 'idb';
}
async function draftRestore(){
  // → texte du brouillon à restaurer (stockage local, sinon IndexedDB s'il est le plus récent) ou null
  let auto=null;try{auto=localStorage.getItem('minifusion_auto');}catch(e){}
  if(auto)return auto;
  let at=0;try{at=+localStorage.getItem('minifusion_auto_idb')||0;}catch(e){}
  if(!at||typeof indexedDB==='undefined')return null;
  try{const d=await idbGet('draft');return d&&typeof d.txt==='string'&&+d.at>=at?d.txt:null;}catch(e){return null;}
}
addEventListener('beforeunload',()=>{autosaveFlush();});
addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')autosaveFlush();});
async function deserialise(json,opts){
  try{if(typeof viewFadeOut==='function')viewFadeOut();}catch(e){} // 2026-10-16-015 : fondu à l'ouverture
  const o=JSON.parse(json);doc=docFromSerial(o);
  // Autre document : l'historique d'annulation de l'ancien ne s'y applique pas
  try{docUndoStack=[];docRedoStack=[];docBase=null;docUndoUI();}catch(e){}
  // Document REMPLACÉ : nouvelle version (sans markDirty, ce n'est pas une modification). Sans
  // elle, ouvrir un fichier juste après un rejeu (brouillon restauré, autre fichier ouvert)
  // laissait buildKeyUpToDate() vrai : le rejeu était sauté et la pièce PRÉCÉDENTE restait
  // affichée (mesuré : Axe ouvert, solide de Crochet 7 609,69 mm³) ; docHash() resservait aussi
  // l'empreinte mémorisée de l'ancien document.
  _docVersion++;
  // Le solide affiché est celui de l'ancien document : une esquisse non consommée y aurait cherché
  // ses arêtes projetées et aurait sauté sur une arête étrangère avant le premier rejeu.
  try{occDropLive();}catch(e){}
  // V0.6.0 : assemblage (autres pièces + occurrences) — absent d'un fichier d'une seule pièce
  try{asmFromSerial(o.asm);}catch(e){asm=null;}
  // Les numéros de corps ne sont jamais réemployés : le compteur repart au-delà
  // du plus grand Corps N déjà connu (anciens fichiers sans bodySeq : on le déduit).
  try{
    let mx=0;
    (doc.bodies||[]).forEach(e=>{const m=/^b(\d+)$/.exec(e.id||'');if(m)mx=Math.max(mx,+m[1]);});
    if(!(doc.bodySeq>mx))doc.bodySeq=mx+1;
    if(doc.activeBody&&!doc.bodies.some(e=>e.id===doc.activeBody))doc.activeBody=null;
  }catch(e){}
  // Corps conteneurs + MIGRATION de style : f.color/f.opacity et la teinte pièce
  // sont reportés sur la fiche du corps puis supprimés, même quand on ne rejoue
  // pas ({rebuild:false} : restauration d'un brouillon) — sinon la prochaine
  // sauvegarde réécrirait l'ancien modèle et la source serait réouverte.
  try{ensureBodies();}catch(e){}
  try{
    (doc.sketches||[]).forEach(migrateSketch);
    (doc.sketches||[]).forEach(sk=>{try{skFixSurProjRepair(sk);}catch(e){}});
    try{resolveAllSketchHosts();}catch(e){}
  }catch(e){}
  try{applyView(o.view);}catch(e){}
  try{vEnvDocApply(doc._env);}catch(e){} // après la vue : l'environnement de la pièce décide du miroir
  if(o.originVis)originVis={XY:o.originVis.XY!==false,XZ:o.originVis.XZ!==false,YZ:o.originVis.YZ!==false};
  sel={kind:null,id:null}; // restaure la sélection si elle désigne encore quelque chose
  if(o.sel&&o.sel.id){
    if(o.sel.kind==='plane'&&PLANES[o.sel.id])sel={kind:'plane',id:o.sel.id};
    else if(o.sel.kind==='sketch'&&doc.sketches.some(s=>s.id===o.sel.id))sel={kind:'sketch',id:o.sel.id};
    else if(o.sel.kind==='feature'&&doc.features.some(f=>f.id===o.sel.id))sel={kind:'feature',id:o.sel.id};
    else if(o.sel.kind==='cg'&&cgGet(o.sel.id))sel={kind:'cg',id:o.sel.id};
    else if(o.sel.kind==='body'&&(doc.bodies||[]).some(e=>e.id===o.sel.id))sel={kind:'body',id:o.sel.id};
  }
  // Imports STEP/STL : la fonction RESTE (même id → corps, enlèvements et FAO
  // gardent leur cible) ; sa géométrie est rejouée depuis la source persistée
  // (importRestorePending, ATTENDUE en fin de fonction : `await deserialise` rend la main
  // imports rejoués, quel que soit l'ordre des micro-tâches). Ancien fichier sans source :
  // la fonction attend une réimportation du même nom.
  const sansSrc=doc.features.filter(f=>f.type==='import'&&!(f.src&&f.src.key)).map(f=>f.name);
  occCkClear(); // document remplacé : les points de contrôle ne valent plus rien
  const rep=docSanitise();
  if(rep.dup||rep.orph||rep.sk||rep.cap){try{log('Document réparé : '+rep.dup+' instance(s) en double, '+rep.orph+' instance(s) orpheline(s), '+rep.sk+' esquisse(s) d’instance abandonnée(s), '+rep.cap+' répétition(s) plafonnée(s) à '+REPEAT_MAX+' copies.');}catch(e){}}
  if(rep.vides){try{log('Document réparé : '+rep.vides+' esquisse(s) vide(s) retirée(s) du fil.');}catch(e){}}
  if(rep.ren){try{log('Nom de congé/chanfrein réaligné sur la géométrie réelle : '+rep.ren+' fonction(s) (des arêtes avaient été perdues).');}catch(e){}}
  if(rep.dup||rep.orph){try{doc.features.filter(f=>f.type==='repeat').forEach(f=>repGenChildren(f));}catch(e){}}
  // Antériorité (43) : signalée, jamais corrigée d'office (⚠ dans l'arbre)
  try{const av=antViolations();if(av.length)log('⚠ Antériorité : '+av.length+' lien(s) vers une fonction placée plus loin — '+av.map(antMsg).join(' '));}catch(e){}
  // Les instances d'une répétition sont DÉRIVÉES : on les régénère à l'ouverture, toujours.
  // Sans cela, un fichier enregistré par une version qui miroirait mal les congés
  // conservait des clones à 80-100 mm du mauvais côté, et le triangle ⚠ revenait à
  // chaque chargement alors même que le code était corrigé. Coût : une régénération
  // déterministe, sans effet sur les sources.
  try{
    repReparation=true; // fichier juste ouvert : les sources sont au repos (V0.58.2)
    doc.features.filter(f=>f.type==='repeat').forEach(f=>{try{repGenChildren(f);}catch(e){}});
    repReparation=false;
  }catch(e){}
  sel={kind:null,id:null};uidN=doc.sketches.length+doc.features.length+1;
  if(!opts||opts.rebuild!==false){
    // V0.94.6 : formes importées (corps dérivés compris) posées AVANT le premier calcul. Elles
    // arrivaient après : la pièce était calculée une première fois sans elles, pour rien (vraie pièce :
    // 7 s perdus, et deux suppressions de face envoyées au calcul de fond sur la mauvaise pièce).
    if(occHas()){try{await importRestorePending({sansRejeu:true});}catch(e){}}
    // Pièce finie gardée sur ce poste (20-75) : relue au lieu d'être recalculée si rien n'a changé
    const pcOk=typeof pcPreparer==='function'&&await pcPreparer();
    // V0.42.0 : gros document → barre de progression (31) ; sans noyau exact, rien ne change
    if(!pcOk&&regenWarmUseful()){await regenWarm('Ouverture — '+(doc.name||'document'));builtVersion=-1;}
    try{rebuild();}finally{regenUiHide();}
    if(pcOk)try{pcApresServi();}catch(e){}
    renderProps();showAll();}
  else renderProps();
  if(sansSrc.length)alert(sansSrc.length+' import(s) enregistré(s) sans leur fichier (ancien format) : '+sansSrc.join(', ')+'.\nRéimportez le STEP/STL (même nom, ou confirmez le rebranchement) : il reprend la fonction existante, usinages conservés. Puis ré-enregistrez.');
  const pImp=importRestorePending(); // lancée ICI (même ordre qu'avant), attendue à la fin
  // Parcours d'outils : on lit d'abord le cache persisté (IndexedDB), on ne
  // recalcule que ce qui manque — l'ouverture ne reprend plus les ~90 s du calcul.
  try{ if(typeof faoMovesReset==='function')faoMovesReset(); }catch(e){}
  try{ if(typeof faoMovesPreloadSoon==='function')faoMovesPreloadSoon(); }catch(e){}
  // ARBRE FAO : doc.fao a CHANGE (ouverture de fichier, restauration du brouillon au
  // F5) — sans ce rendu, l'arbre FAO gardait celui du document precedent (posage sans
  // aucune operation, alors que sa fleche reste ▼ : « le posage est la, pas ses ops »).
  try{ if(typeof faoRefreshFaoUI==='function')faoRefreshFaoUI(); }catch(e){}
  // V0.24.0 : une pièce ouverte s'affiche en CAO (pas dans l'espace FAO / PLAN laissé ouvert)
  try{if(typeof mfWsCur!=='undefined'&&mfWsCur&&mfWsCur!=='cao'&&typeof mfWs==='function')mfWs('cao');}catch(e){}
  try{if(typeof viewFadeIn==='function')viewFadeIn();}catch(e){}
  try{asmAfterLoad();}catch(e){} // assemblage : instantanés, vue rétablie (47)
  try{await pImp;}catch(e){}
  try{parMiniSoon();derCheck(false);}catch(e){} // V0.47.0 : dérivées vérifiées sans rien demander (52)
  try{pcEcrireSoon();}catch(e){} // V0.94.6 : pièce ouverte, une fois stable, gardée sur ce poste (20-75)
}
/* ---------- conteneur .miniFusion : document + cache de trajectoires ----------
   Demandé : « un fichier dédié qui encapsule le json ET son cache ». Le document
   tient dans le JSON, mais les parcours de l'ébauche 3D (7,9 Mo, ~90 s de calcul)
   vivent dans l'IndexedDB de CE navigateur : rouvrir ailleurs, ou après une
   purge, remet le triangle ⚠. Le bundle embarque ces entrées (faoMoves:*) —
   rouvrir donne l'état sauvegardé, sans recalcul. Le cache d'IMAGE (lastGood,
   plusieurs Mo de sommets) reste local : il ne fait que gagner du temps. */
function bundleIs(txt){
  // true = fichier .miniFusion ; false = ancien .minifusion.json (lu tel quel).
  try{ const b=JSON.parse(txt); return !!(b&&b.bundle===1&&b.doc); }
  catch(e){ return false; }
}
async function bundleMoves(){
  // 2026-10-15-004 : SEULEMENT les trajectoires des opérations DE CE DOCUMENT.
  // Avant, toutes les entrées faoMoves:* de l'IndexedDB partaient dans le fichier —
  // celles de tous les documents jamais ouverts dans ce navigateur : « Vide.miniFusion
  // pèse 70 Mo ». Clé = 'faoMoves:<posage>:<opération>' (cf. bundleRestore).
  const out={};
  if(!faoMovesReady())return out;
  const miens=new Set();
  try{
    // V0.6.0 : toutes les pièces de l'assemblage (la pièce active passe par faoRoot)
    const roots=[faoRoot()].concat(asmAllDocs().filter(d=>d!==doc).map(d=>d.fao).filter(Boolean));
    roots.forEach(function(r){(((r&&r.setups)||[])).forEach(function(st){
      ((st&&st.ops)||[]).forEach(function(op){ miens.add('faoMoves:'+((st&&st.id)||'_')+':'+((op&&op.id)||'_')); });
    });});
  }catch(e){}
  if(!miens.size)return out;
  try{
    const ks=(await idbKeys('faoMoves:')).filter(function(k){return miens.has(k);});
    for(let i=0;i<ks.length;i++){
      try{ const v=await idbGet(ks[i]); if(v&&v.v===1&&Array.isArray(v.mv))out[ks[i]]=v; }
      catch(e){}
    }
  }catch(e){}
  return out;
}
async function bundleImports(){
  // Fichiers d'origine des imports (base64) : sans eux, le STEP manquait à l'ouverture.
  const out={};
  for(const f of [].concat(...asmAllDocs().map(d=>d.features||[]))){ // toutes les pièces (V0.6.0)
    if(!f||f.type!=='import'||!f.src||!f.src.key||out[f.src.key])continue;
    try{const u8=await importSrcGet(f.src.key);if(u8)out[f.src.key]=importU8ToB64(u8);}catch(e){}
  }
  return out;
}
async function bundleSerialise(){
  const moves=await bundleMoves();
  const imports=await bundleImports();
  // V0.28.1 : images des pièces d'un assemblage, sur option (47-assemblage-cache)
  let asnap=null;try{if(asm&&asm.img)asnap=await asmCacheExport();}catch(e){asnap=null;}
  return JSON.stringify({app:'ConceptCAD',bundle:1,v:APP_VER,cacheVer:CACHE_VER,
    at:Date.now(),name:doc.name||'',doc:JSON.parse(serialise()),
    nMoves:Object.keys(moves).length,moves:moves,imports:imports,asnap:asnap||undefined});
}
let faoBundleMovesN=0;   // trajectoires embarquees dans le fichier ouvert
function bundleReport(){
  // A l'ouverture d'un .miniFusion : dire ce que le fichier contient RÉELLEMENT.
  // « 1 opération sans parcours » sans dire laquelle ni pourquoi, c'est ce qui a
  // fait perdre une heure — le bundle ne transporte que ce que la machine
  // d'origine avait (tampon de version, clé du solide, entrée jamais produite).
  try{
    const job=faoDoc(), has=faoBundleMovesN;
    const miss=faoActiveOps(job).filter(function(op){
      const ck=faoOpMovesKey(op,job), ch=faoOpMovesHit(op);
      return ck!==null&&!(ch&&ch.key===ck);
    });
    if(!miss.length)return;
    if(typeof faceEl==='undefined'||!faceEl)return;
    const why=faoMovesWhyShort(job,miss[0]);
    faceEl.textContent='FAO : fichier ouvert — '+miss.length+' opération(s) sans parcours'
      +(has?(' valide dans les '+has+' trajectoires embarquées')
            :' (0 trajectoire embarquée : ancien format)')
      +(why?' — '+why:'')
      +' — « Tout régénérer » une fois, puis re-enregistrer le fichier.';
  }catch(e){}
}
async function bundleStoreCaches(b){
  // Caches d'un bundle : trajectoires FAO (IndexedDB) et sources des imports. Partagée par
  // l'ouverture (bundleRestore) et l'insertion dans un assemblage (47). → nombre de
  // trajectoires gardées.
  const moves=b.moves||{};
  // Seulement les trajectoires des opérations du document (un ancien fichier
  // embarquait celles de TOUS les documents du navigateur d'origine : ~70 Mo).
  const miens=new Set();
  try{
    // composant actif + autres composants (V0.6.1 : comps ; V0.6.0 : parts)
    const A=b.doc&&b.doc.asm;
    const frs=[b.doc&&b.doc.fao].concat(((A&&(A.comps||A.parts))||[]).map(p=>p&&p.doc&&p.doc.fao));
    frs.forEach(function(fr){(((fr&&fr.setups)||[])).forEach(function(st){
      ((st&&st.ops)||[]).forEach(function(op){ miens.add('faoMoves:'+((st&&st.id)||'_')+':'+((op&&op.id)||'_')); });
    });});
  }catch(e){}
  const ancienFao=!!(b.doc.fao&&typeof b.doc.fao==='object'&&!Array.isArray(b.doc.fao.setups)); // pré-posages : ids inconnus ici
  const ks=Object.keys(moves).filter(function(k){return ancienFao||miens.has(k);});
  if(ks.length&&faoMovesReady()){
    for(let i=0;i<ks.length;i++){ try{ await idbSet(ks[i],moves[ks[i]]); }catch(e){} }
  }
  // Images des pièces d'un assemblage (option, V0.28.1) : dans le cache AVANT le document,
  // lu à l'ouverture à la place des rejeux (47-assemblage-cache)
  if(b.asnap){try{await asmCacheImport(b.asnap);}catch(e){}}
  // Sources des imports AVANT le document : deserialise les rejoue aussitôt.
  const im=(b.imports&&typeof b.imports==='object')?b.imports:{};
  for(const k of Object.keys(im)){
    try{if(typeof im[k]==='string')await importSrcPut(k,importB64ToU8(im[k]));}catch(e){}
  }
  return ks.length;
}
async function bundleRestore(txt,opts){
  // Trajectoires d'abord (IndexedDB), document ensuite (deserialise relance la
  // lecture), puis mémoire amorcée : fonctionne aussi SANS IndexedDB.
  const b=JSON.parse(txt);
  if(!b||b.bundle!==1||!b.doc)return false;
  const moves=b.moves||{};
  if(opts&&opts.name&&b.doc&&typeof b.doc==='object')b.doc.name=opts.name;
  faoBundleMovesN=await bundleStoreCaches(b); // trajectoires puis sources des imports, AVANT le document
  faoBundleWantReport=true;   // consomme par faoMovesDone() (fin de lecture)
  try{ setTimeout(function(){
        try{ if(faoBundleWantReport&&!faoMovesPending()){ faoBundleWantReport=false; bundleReport(); } }
        catch(e){} },1500); }catch(e){}
  await deserialise(JSON.stringify(b.doc),opts);
  // MÉMOIRE : indispensable SANS IndexedDB (le prechargeur n'y lit rien) et
  // immédiat AVEC — le premier dessin n'attend aucune relecture asynchrone.
  let seeded=0;
  try{
    const r=faoRoot();
    (((r&&r.setups)||[])).forEach(function(s){
      ((s&&s.ops)||[]).forEach(function(op){
        const e=moves['faoMoves:'+((s&&s.id)||'_')+':'+((op&&op.id)||'_')];
        if(e&&e.v===1&&e.k&&cacheVerOK(e.ver)&&Array.isArray(e.mv)&&e.k===faoOpMovesKey(op,s)){
          faoOpMovesStore(op,e.k,e.mv); seeded++;
        }
      });
    });
  }catch(e){}
  if(seeded)try{ faoMovesDone(); }catch(e){}   // scan + dessin : AUCUN calcul
  try{ if(faoBundleWantReport&&!faoMovesReady()){ faoBundleWantReport=false; bundleReport(); } }catch(e){}
  return true;
}

$('btnSave').onclick=async()=>{
  // Fichier dédié = bundle (.miniFusion : document + trajectoires) ; le repli
  // navigateur garde le JSON compact, seul format qui tient dans localStorage.
  try{
    if(window.showSaveFilePicker&&fileHandle){
      const data=await bundleSerialise();
      await mffWriteSafe(fileHandle,data);
      autosave();alert('Sauvé dans '+fileHandle.name+' (document + trajectoires).');return;
    }
  }catch(e){}
  try{const d=serialise();localStorage.setItem('minifusion_auto',d);localStorage.setItem('minifusion_named_'+doc.name,d);dirty=false;refreshParts();alert('Sauvé en local (navigateur) sous « '+doc.name+' ». Utilisez « Sous… » pour un fichier dédié.');}catch(e){alert('Sauvegarde impossible : '+e.message);}
};
$('btnSaveAs').onclick=async()=>{
  const fname=(doc.name||'piece').replace(/[\\/:*?"<>|]/g,'_')+'.conceptcad';
  let data;try{ data=await bundleSerialise(); }catch(err){ data=serialise(); }
  try{
    if(window.showSaveFilePicker){
      fileHandle=await window.showSaveFilePicker({suggestedName:fname,types:[{description:'ConceptCAD (document + trajectoires)',accept:{'application/json':['.conceptcad']}}]});
      await mffWriteSafe(fileHandle,data);autosave();alert('Sauvé sous '+fileHandle.name+' (document + trajectoires).');return;
    }
    throw new Error('no picker');
  }catch(e){
    const a=document.createElement('a');a.href=URL.createObjectURL(mffBlob(await mffPack(data)));a.download=fname;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  }
};
$('btnLoad').onclick=()=>$('fileProj').click();
$('fileProj').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const txt=await mffFileText(f);const nm=f.name.replace(/(\.conceptcad(\.gz)?|\.minifusion(\.json)?|\.json)$/i,'');
    if(bundleIs(txt))await bundleRestore(txt,{name:nm});          // .conceptcad / .miniFusion : doc + trajectoires
    else{await deserialise(txt);doc.name=nm;rebuild();renderProps();} // ancien .minifusion.json
  }catch(err){alert('Projet illisible : '+err.message);}
  e.target.value='';
});
try{$('fileProj').accept='.conceptcad,.gz,.miniFusion,.json,.minifusion.json';}catch(e){}
try{$('btnSaveAs').title='Sauver sous… (.conceptcad : document + trajectoires)';}catch(e){}
try{$('btnLoad').title='Ouvrir un projet (.conceptcad, ou ancien .miniFusion / .minifusion.json)';}catch(e){}


/* 2026-10-14-009 : MAILLAGE FIN DE FINITION — retour « dans les congés,
   l'affichage montre 2 ou 3 droites qui se suivent, il faut les lisser ».
   La FAO maille le solide exact à 0,5 mm / 0,5 rad (import STEP) ou
   occXDefl() (natif : 0,5 rad sans congé 3D) : un congé à 90° = 3 à 4
   facettes, que la Finition suit fidèlement. La Finition seule reçoit un
   maillage FIN (corde 0,01 mm, 0,1 rad ≈ 16 facettes sur 90°), en cache
   sur le corps ; l'Ébauche et les autres opérations gardent le leur
   (parcours inchangés). Repli : maillage d'outillage habituel. */
