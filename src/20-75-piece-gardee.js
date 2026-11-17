/* ---------- Pièce finie gardée sur ce poste (V0.94.6, demande de Fred) ----------
   Ouvrir une pièce la recalculait entièrement, même quand rien n'avait changé depuis la dernière
   fois (une vraie pièce d’une centaine de fonctions : 16 s). Fusion 360 garde la pièce finie ; ici aussi :
     · après une ouverture ou un enregistrement, une fois la pièce stable (aucun calcul de fond en
       cours), le résultat est rangé dans IndexedDB : solide exact de chaque corps (BRep natif, mêmes
       faces dans le même ordre) avec les noms de ses faces, maillage d'affichage, outils de
       découpe montrés à la sélection, messages, états de calcul des fonctions (⚠, arêtes non
       faites…), résultats du calcul de fond (suppressions de face, filets modélisés) ;
     · à l'ouverture, si la CLÉ du document est exactement la même, la pièce est reconstruite à
       partir de ce résultat : ni rejeu, ni projections, ni maillage. Puis, en fond et par petites
       tranches, le rejeu remplit les points de contrôle (20-70) : la première modification ne
       repart pas de zéro.
   RÈGLE (comme les instantanés d'assemblage, 47) : au moindre doute, on recalcule. La clé reprend
   asmCacheKey (empreinte du paramétrique, fiches des corps, imports par l'empreinte de leur
   source) avec FORMES_VER (00) : le tampon de ce que la pièce gardée contient, changé quand le rejeu
   ou le maillage d'affichage change (jusqu'en V0.96.2 : APP_VER, chaque version recalculait chaque
   fichier une fois). Filet : le rejeu de fond qui suit une pièce relue la contrôle (pcVerifie). Jamais gardé : un assemblage, le marqueur de timeline reculé, une
   fonction suspendue, un calcul de fond en cours, une forme importée absente, une pièce trop
   grosse. Toute erreur de lecture ou d'écriture (quota, navigation privée) le contourne en silence.
   Le calcul de l'ouverture retouche parfois le document sans rien changer à la forme (arrondi d'une
   origine d'esquisse, face d'appui nommée par une version plus récente) : la clé d'après n'est plus
   celle du fichier. Tant que l'utilisateur n'a rien modifié (rien à annuler), l'entrée est donc
   aussi rangée sous la clé du document TEL QU'OUVERT (alias) : le même fichier rouvert la retrouve.
   Le document servi reste celui du fichier ; la première modification refait ces retouches.
   Clés pfin:<…> du magasin « kv » ; pfin:index {clé → dernier usage} : PC_MAX entrées au plus. */
const PC_V=1,PC_MAX=6,PC_VERTS=3000000;
let pcServi=null;      // entrée lue, consommée par le prochain rebuild (rebuildInner / occRebuild)
let pcDernier=null;    // ce que le dernier rejeu d'affichage a produit hors des corps (occRebuild)
let pcEcrit=new Set(); // clés déjà rangées pendant cette session
let pcEcrT=null,pcChauffe=null;
let pcOuvert=null;   // {doc, cle} : clé du document tel qu'ouvert (fichier, brouillon), avant tout calcul
const pcVerif={ok:0,ecart:0,sans:0,dernier:''}; // contrôles de la pièce relue par le rejeu de fond (pcVerifie)
let pcFait=false;     // le rejeu d'affichage en cours a été servi par l'entrée (rebuildInner : pas de projections après)
function pcIdbOK(){try{return typeof indexedDB!=='undefined'&&!!indexedDB&&typeof idbOpen==='function';}catch(e){return false;}}
function pcPossible(composant){
  // composant (V0.99.16) : composant d'un assemblage servi par son image (pcServirComposant)
  try{
    if(!occHas()||freshHard||!doc||!(doc.features||[]).length)return false;
    if(!composant&&typeof asm!=='undefined'&&asm&&asm.comps&&asm.comps.length>1)return false;
    if(tlReplayCount()!=null||occSkipFeat||occStepForce||occPrefixTap||derCkPre)return false;
    return asmCacheable(doc)&&asmCacheImpReady(doc);
  }catch(e){return false;}
}
function pcCle(){
  // null : pas de cache possible pour l'état courant
  if(!pcPossible())return null;
  return pcCleDe(doc);
}
function pcCleDe(d){const k=d?asmCacheKey(d):null;return k?'pfin:'+FORMES_VER+':'+PC_V+':'+k.slice(6):null;}
/* ── copie des tableaux d'un maillage (BufferGeometry ⇄ objet rangeable) ── */
function pcGeoVers(g){
  if(!g||!g.attributes||!g.attributes.position)return null;
  const at={};
  for(const n in g.attributes){const a=g.attributes[n];if(!a||!a.array)continue;at[n]={a:a.array.slice(),n:a.itemSize};}
  let ud=null;try{ud=JSON.parse(JSON.stringify(g.userData||{}));}catch(e){}
  return{at,ud};
}
function pcGeoDe(o){
  if(!o||!o.at||!o.at.position)return null;
  const g=new THREE.BufferGeometry();
  for(const n in o.at)g.setAttribute(n,new THREE.BufferAttribute(o.at[n].a,o.at[n].n));
  if(o.ud)Object.assign(g.userData,o.ud);
  return g;
}
/* ── états de calcul posés sur les fonctions et les esquisses (_m, _miss, _rate, _err…) ── */
function pcChampsDe(o){
  const r={};let n=0;
  for(const k in o){
    if(k[0]!=='_'||k==='_mesh')continue;
    try{const s=JSON.stringify(o[k]);if(s!==undefined&&s.length<200000){r[k]=JSON.parse(s);n++;}}catch(e){}
  }
  return n?r:null;
}
function pcChampsPose(o,r){
  for(const k of Object.keys(o))if(k[0]==='_'&&k!=='_mesh')delete o[k];
  if(r)for(const k in r)o[k]=JSON.parse(JSON.stringify(r[k]));
}
/* ── écriture : capture de l'état affiché ── */
function pcCapture(cle){
  // → entrée, ou null si l'état affiché ne peut pas être gardé
  if(!occLive||!occLive.shape||!occLive.sig||builtEngine!=='exact'||!pcDernier||pcDernier.ver!==_docVersion)return null;
  if(occThrPending||(typeof delWkPending==='function'&&delWkPending()))return null;
  if(occLive.incomplet)return null;
  const corps=bodies.filter(b=>b&&b.kind==='body');
  if(!corps.length||corps.some(b=>!b.shape||!b.sig))return null;
  let verts=0;const B=[];
  for(const b of corps){
    const m=occMeshMemo.get(b.bodyId);
    if(!m||m.sig!==b.sig)return null; // maillage d'affichage introuvable : on ne garde rien
    const geo=pcGeoVers(m.geo);if(!geo)return null;
    verts+=geo.at.position.a.length/3;if(verts>PC_VERTS)return null;
    const ent={bodyId:b.bodyId,sig:b.sig,brep:occBrepWrite(b.shape),noms:nomsDe(b.shape),
      mesh:{lin:m.lin,ang:m.ang,lin1:m.lin1,ang1:m.ang1,maxT:m.maxT,tris:m.tris,geo}};
    if(b.shapeFao)ent.pre={brep:occBrepWrite(b.shapeFao),noms:nomsDe(b.shapeFao)};
    B.push(ent);
  }
  const ghosts=[];
  for(const gh of pcDernier.ghosts){const g=pcGeoVers(gh.geo);if(g)ghosts.push({geo:g,orphan:gh.orphan,fid:gh.fid,inexact:gh.inexact});}
  const champs={f:{},s:{}};
  (doc.features||[]).forEach(f=>{const r=pcChampsDe(f);if(r&&f.id)champs.f[f.id]=r;});
  (doc.sketches||[]).forEach(s=>{const r=pcChampsDe(s);if(r&&s.id)champs.s[s.id]=r;});
  // calculs de fond (21) dont la clé appartient au rejeu de ces corps
  const delwk=[];
  try{
    const sigs=B.map(b=>b.sig);
    const pris=new Set();
    delWkRes.forEach((v,k)=>{
      if(!v||v.st!=='fin'||!v.brep)return;
      if(!sigs.some(s=>s.startsWith(k)||k===s+';'))return;
      pris.add(v);
    });
    // V0.99.16 : un même calcul est rangé sous plusieurs clés (renvois : le premier rejeu de la session
    // ne voyait pas encore certains champs de calcul des fonctions) — toutes gardées, sinon le rejeu de
    // contrôle relançait le calcul et la pièce était recalculée (plaque à suppression de face : 35 s)
    delWkRes.forEach((v,k)=>{
      if(!pris.has(v))return;
      delwk.push([k,{sig:v.sig||null,brep:v.brep,kept:v.kept|0,err:v.err||null,warnings:(v.warnings||[]).slice(),ms:v.ms||0,thr:!!v.thr}]);
    });
  }catch(e){}
  return{v:PC_V,cle,at:Date.now(),ver:APP_VER,D:pcDernier.D,corps:B,ghosts,msgs:pcDernier.msgs.slice(),
    imports:pcDernier.imports.slice(),pertes:[...NOMS_PERTES_ESQ.entries()],champs,delwk};
}
async function pcEcrire(e,alias){
  const db=await idbOpen();
  try{
    const idx=await new Promise(res=>{
      try{const rq=db.transaction('kv','readonly').objectStore('kv').get('pfin:index');rq.onsuccess=()=>res(rq.result||{});rq.onerror=()=>res({});}
      catch(x){res({});}
    });
    idx[e.cle]=Date.now();if(alias)idx[alias]=Date.now();
    const vieux=Object.keys(idx).sort((a,b)=>idx[b]-idx[a]).slice(PC_MAX);
    vieux.forEach(k=>delete idx[k]);
    await new Promise((res,rej)=>{
      const tx=db.transaction('kv','readwrite'),st=tx.objectStore('kv');
      st.put(e,e.cle);if(alias)st.put({v:PC_V,alias:e.cle},alias);vieux.forEach(k=>st.delete(k));st.put(idx,'pfin:index');
      tx.oncomplete=()=>res(true);tx.onerror=tx.onabort=()=>rej(tx.error);
    });
  }finally{try{db.close();}catch(x){}}
}
function pcEcrireSoon(){
  // Appelée après une ouverture et après un enregistrement : attend que la pièce soit stable
  // (calcul de fond fini, affichage à jour), puis la range si elle ne l'est pas déjà.
  if(!pcIdbOK())return;
  if(pcEcrT)clearTimeout(pcEcrT);
  const t0=Date.now();
  const tente=()=>{
    pcEcrT=null;
    const occupe=rebuildDepth||(typeof regenRun!=='undefined'&&regenRun)||pcChauffe||occThrPending
      ||(typeof delWkPending==='function'&&delWkPending())||!buildKeyUpToDate();
    if(occupe){if(Date.now()-t0<120000)pcEcrT=setTimeout(tente,1500);return;}
    const cle=pcCle();if(!cle||pcEcrit.has(cle))return;
    // V0.99.16 : le fichier porte déjà cette image — pas de copie sur ce poste
    if(pcFichier.has(cle)||(pcFichierDoc===doc&&!docUndoStack.length))return;
    let e=null;try{e=pcCapture(cle);}catch(x){e=null;}
    if(!e)return;
    // document tel qu'ouvert, retouché seulement par le calcul de l'ouverture (rien à annuler)
    let alias=null;
    try{if(pcOuvert&&pcOuvert.doc===doc&&pcOuvert.cle&&pcOuvert.cle!==cle&&!docUndoStack.length)alias=pcOuvert.cle;}catch(x){}
    pcEcrit.add(cle);if(alias)pcEcrit.add(alias);
    pcEcrire(e,alias).catch(()=>{pcEcrit.delete(cle);if(alias)pcEcrit.delete(alias);});
  };
  pcEcrT=setTimeout(tente,1200);
}
/* ── lecture à l'ouverture ── */
async function pcLire(cle){
  // → entrée (un alias est suivi une fois) ou null
  {const f=pcFichier.get(cle);if(f)return f;} // V0.99.16 : image venue d'un fichier ouvert
  const db=await idbOpen();
  const get=k=>new Promise(res=>{
    try{const rq=db.transaction('kv','readonly').objectStore('kv').get(k);rq.onsuccess=()=>res(rq.result||null);rq.onerror=()=>res(null);}
    catch(x){res(null);}
  });
  try{
    let e=await get(cle);
    if(e&&e.v===PC_V&&typeof e.alias==='string'&&/^pfin:/.test(e.alias))e=await get(e.alias);
    return e&&!e.alias?e:null;
  }finally{try{db.close();}catch(x){}}
}
async function pcPreparer(){
  // Ouverture : true si la pièce finie de CE document est gardée (le rebuild suivant la sert)
  pcServi=null;pcOuvert=null;
  try{
    if(!pcIdbOK()||!pcPossible())return false;
    // mêmes normalisations que le début de rebuildInner, comme la préchauffe (31)
    try{if(typeof parApplyAll==='function')parApplyAll();}catch(e){}
    try{importHydrate();}catch(e){}
    try{ensureBodies();}catch(e){}
    try{(doc.sketches||[]).forEach(migrateSketch);}catch(e){}
    const cle=pcCle();if(!cle)return false;
    pcOuvert={doc,cle};
    const v0=_docVersion,d0=doc;
    // V0.99.16 : image du fichier qu'on ouvre (vérifiée avec son document par pcDuPaquet)
    const fa=pcFichierAttendu&&(!pcFichierAttendu.doc||pcFichierAttendu.doc===doc)?pcFichierAttendu.e:null;
    if(fa)pcFichierAttendu=null;
    let e=await pcLire(cle),duFichier=false;
    if(!e&&fa){e=fa;duFichier=true;}
    if(!e||e.v!==PC_V||!Array.isArray(e.corps)||!e.corps.length)return false;
    if(doc!==d0||_docVersion!==v0)return false; // document changé pendant la lecture
    // V0.96.3 : pendant la lecture, le calcul de l'ouverture a pu faire ses retouches (origine d'esquisse
    // arrondie, face d'appui nommée) : la clé n'est plus celle du fichier mais celle du document retouché,
    // qui est exactement la clé propre de l'entrée quand on l'a trouvée par son alias. Refusée alors à tort :
    // la plaque SIRAP-14-003 était recalculée à chaque ouverture (11 s), pièce gardée rangée et lisible.
    if(!duFichier){const k2=pcCle();if(k2!==cle&&k2!==e.cle)return false;}
    if(duFichier||pcFichier.get(cle)===e)pcFichierDoc=d0;
    e._doc=d0;e._ver=v0;
    pcServi=e;pcEcrit.add(cle);pcEcrit.add(e.cle);
    return true;
  }catch(err){pcServi=null;return false;}
}
function pcValide(){
  // rebuildInner : rien n'a bougé depuis pcPreparer (même document, aucune modification, même
  // marqueur…) ? La clé y a été vérifiée ; les hôtes résolus entre-temps ne sont que des retouches.
  if(!pcServi)return false;
  let ok=false;try{ok=pcServi._doc===doc&&pcServi._ver===_docVersion&&pcPossible(!!pcServi._asm);}catch(e){}
  if(!ok)pcServi=null;
  return ok;
}
function pcFR(){
  // occRebuild : FR reconstruit à partir de l'entrée servie (même forme que occFinalShape) ;
  // null → rejeu normal. L'entrée n'est servie qu'une fois.
  const e=pcServi;pcServi=null;
  if(!e)return null;
  const faits=[];
  try{
    const perBody=[],preThr=[];
    for(const c of e.corps){
      const sh=occBrepRead(c.brep);faits.push(sh);
      if(c.noms)NOMS_TABLES.set(sh,JSON.parse(JSON.stringify(c.noms)));
      perBody.push({bodyId:c.bodyId,shape:sh,sig:c.sig});
      if(c.pre){const p=occBrepRead(c.pre.brep);faits.push(p);if(c.pre.noms)NOMS_TABLES.set(p,JSON.parse(JSON.stringify(c.pre.noms)));preThr.push({bodyId:c.bodyId,shape:p});}
    }
    const ids=perBody.map(p=>p.bodyId);
    const shape=nomsCompose(perBody.map(p=>p.shape),occCompoundOf(perBody.map(p=>p.shape)),ids);
    const shapeFao=preThr.length?occCompoundOf(perBody.map(p=>{const q=preThr.find(x=>x.bodyId===p.bodyId);return q?q.shape:p.shape;})):null;
    // maillages d'affichage : repris par occMeshMemoGet comme après un rejeu sans changement
    occMeshMemoClear();
    e.corps.forEach(c=>{const g=pcGeoDe(c.mesh.geo);if(g)occMeshMemo.set(c.bodyId,{sig:c.sig,lin:c.mesh.lin,ang:c.mesh.ang,lin1:c.mesh.lin1,ang1:c.mesh.ang1,maxT:c.mesh.maxT,tris:c.mesh.tris,geo:g});});
    // états de calcul des fonctions et des esquisses, pertes de noms des projections
    (doc.features||[]).forEach(f=>{if(f.id)pcChampsPose(f,e.champs&&e.champs.f[f.id]);});
    (doc.sketches||[]).forEach(s=>{if(s.id)pcChampsPose(s,e.champs&&e.champs.s[s.id]);});
    try{NOMS_PERTES_ESQ.clear();(e.pertes||[]).forEach(([k,v])=>NOMS_PERTES_ESQ.set(k,v));}catch(x){}
    // calculs de fond : la préchauffe (et le prochain rejeu) les relisent sans relancer le worker
    try{const memes=new Map();(e.delwk||[]).forEach(([k,v])=>{if(delWkRes.has(k))return;
      let o=memes.get(v.brep);if(!o){o=Object.assign({},v,{st:'fin',warnings:(v.warnings||[]).slice()});memes.set(v.brep,o);}
      delWkRes.set(k,o);});}catch(x){}
    const ghostShapes=(e.ghosts||[]).map(g=>({geo:pcGeoDe(g.geo),orphan:!!g.orphan,fid:g.fid||null,inexact:g.inexact||null})).filter(g=>g.geo);
    pcFait=true;
    return{shape,shapeFao,preThr,perBody,ghostShapes,msgs:(e.msgs||[]).slice(),bin:[],itemShapes:[],items:[],imports:(e.imports||[]).slice(),D:e.D||null,servi:true};
  }catch(err){
    occDispose(faits);
    try{log('Pièce gardée illisible ('+((err&&err.message)||err)+') — recalcul complet.');}catch(x){}
    return null;
  }
}
/* ── V0.99.16 : IMAGE COMPLÈTE DANS LE FICHIER (demande de Fred : « je préfère que le fichier soit plus gros »)
   À l'enregistrement d'une pièce, son image (même entrée que la pièce gardée : solide exact, maillage
   d'affichage, noms des faces, états de calcul) part dans le fichier (b.pfin : tableaux réunis en un bloc
   binaire gzip, base64). À l'ouverture du fichier — ou à la lecture d'une source liée par un assemblage
   (47-composants-lies) — elle est gardée EN MÉMOIRE (pcFichier), jamais copiée sur le poste. Elle est
   servie quand elle va avec le document : sa clé est celle du document, OU elle a été écrite avec le texte
   même du document du fichier (empreinte sig du document enregistré, mêmes FORMES_VER et CACHE_VER) —
   l'ouverture retouche le document (projections, noms) et sa clé change, alors que l'image et le
   document sortent du même enregistrement. Même contrôle par le rejeu de fond qu'une pièce gardée.
   Mesuré : cavité +0,36 Mo (ouverture 1,4 s → immédiate), plaque d'une centaine de fonctions +2,4 à 4,9 Mo
   (11 à 22 s → immédiate). Contenu venu d'ailleurs : vérifié, une image douteuse est ignorée (recalcul). */
const PC_ATTENTE_ENR=60000; // enregistrement : attente maximale de la fin du calcul pour joindre l'image (V0.99.26)
const PC_FICHIER_MAX=6; // images en mémoire (jusqu’à ~20 Mo chacune pour une grosse pièce)
const pcFichier=new Map();  // clé → entrée (images des fichiers ouverts pendant cette session)
const pcCompMem=new Map();  // clé → entrée : images des composants préchargées avant leurs rejeux (assemblage)
let pcFichierAttendu=null; // image du fichier en cours d'ouverture, vérifiée avec son document (bundleRestore → pcPreparer)
let pcFichierDoc=null;     // document servi par l'image de son fichier : rien à copier sur ce poste tant qu'il n'est pas modifié
function pcSigDoc(txt){
  // empreinte du texte du document enregistré (deux empreintes + longueur, comme asmCacheKey)
  txt=String(txt||'');let a=2166136261,b=5381;
  for(let i=0;i<txt.length;i++){const c=txt.charCodeAt(i);a^=c;a=Math.imul(a,16777619);b=(Math.imul(b,33)^c)|0;}
  return (a>>>0).toString(36)+'_'+(b>>>0).toString(36)+'_'+txt.length;
}
async function pcDuPaquet(b){
  // Fichier lu (bundle) : son image, si elle va avec SON document → entrée ou null (et gardée dans pcFichier)
  try{
    const x=b&&b.pfin;if(!x||!b.doc)return null;
    if(x.formes!==FORMES_VER||x.cache!==CACHE_VER||typeof x.sig!=='string')return null; // calcul changé depuis
    if(x.sig!==(b._sigLu||pcSigDoc(JSON.stringify(b.doc))))return null; // document retouché hors de ConceptCAD : image ignorée
    const e=await pcDepaquet(x);if(!e)return null;
    pcFichier.delete(e.cle);pcFichier.set(e.cle,e);
    while(pcFichier.size>PC_FICHIER_MAX)pcFichier.delete(pcFichier.keys().next().value);
    return e;
  }catch(err){return null;}
}
const PC_TA={f32:Float32Array,f64:Float64Array,u32:Uint32Array,i32:Int32Array,u16:Uint16Array,i16:Int16Array,u8:Uint8Array,i8:Int8Array};
function pcTaKind(a){for(const k in PC_TA)if(a instanceof PC_TA[k])return k;return null;}
async function pcPaquet(e){
  // entrée → {v, z, cle, meta, bin} (gzip + base64) ou null
  const parts=[];let off=0;const deja=new Map(); // même tableau (renvois des calculs de fond) : écrit une fois
  // seuls les champs de l'ENTRÉE en « _ » restent sur le poste (_doc…) ; plus bas, « _ » est le nom des
  // champs de calcul des fonctions (champs.f[id]._m, _perdues… : les ⚠), à garder
  const walk=(v,haut)=>{
    if(ArrayBuffer.isView(v)){
      if(deja.has(v))return deja.get(v);
      const t=pcTaKind(v);if(!t)throw new Error('tableau inconnu');
      const pad=(8-off%8)%8;if(pad){parts.push(new Uint8Array(pad));off+=pad;}
      parts.push(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));
      const r={$t:t,o:off,n:v.length};off+=v.byteLength;deja.set(v,r);return r;
    }
    if(Array.isArray(v))return v.map(x=>walk(x,false));
    if(v instanceof Map||v instanceof Set)throw new Error('Map/Set : pas de place dans le fichier');
    if(v&&typeof v==='object'){const o={};Object.keys(v).forEach(k=>{if(!haut||k[0]!=='_')o[k]=walk(v[k],false);});return o;}
    return v;
  };
  const meta=walk(e,true);
  const bin=new Uint8Array(off);let p=0;parts.forEach(u=>{bin.set(u,p);p+=u.length;});
  const g=await asmCacheZip(bin,false),m=g&&await asmCacheZip(new TextEncoder().encode(JSON.stringify(meta)),false);
  if(!g||!m)return null;
  return {v:PC_V,z:'gzip',cle:e.cle,meta:importU8ToB64(m),bin:importU8ToB64(g)};
}
function pcEntreeOK(e){
  // image venue d'un fichier : la forme de ce que pcFR lit
  try{
    if(!e||e.v!==PC_V||typeof e.cle!=='string'||!/^pfin:/.test(e.cle)||!Array.isArray(e.corps)||!e.corps.length)return false;
    return e.corps.every(c=>c&&typeof c.bodyId==='string'&&typeof c.sig==='string'&&(typeof c.brep==='string'||c.brep instanceof Uint8Array)&&
      c.mesh&&c.mesh.geo&&c.mesh.geo.at&&c.mesh.geo.at.position&&c.mesh.geo.at.position.a instanceof Float32Array&&c.mesh.geo.at.position.a.length%3===0);
  }catch(err){return false;}
}
async function pcDepaquet(x){
  // {v, z, meta, bin} → entrée vérifiée, ou null
  if(!x||typeof x!=='object'||x.v!==PC_V||x.z!=='gzip'||typeof x.meta!=='string'||typeof x.bin!=='string')return null;
  let bin,meta;
  try{
    bin=await asmCacheZip(importB64ToU8(x.bin),true);
    const m=await asmCacheZip(importB64ToU8(x.meta),true);
    meta=m?JSON.parse(new TextDecoder().decode(m)):null;
  }catch(err){return null;}
  if(!bin||!meta)return null;
  const un=v=>{
    if(v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.$t==='string'){
      const T=PC_TA[v.$t],o=+v.o,n=+v.n;
      if(!T||!Number.isInteger(o)||!Number.isInteger(n)||o<0||n<0||o%T.BYTES_PER_ELEMENT||o+n*T.BYTES_PER_ELEMENT>bin.length)throw new Error('image abîmée');
      const id=v.$t+':'+o+':'+n;if(vus.has(id))return vus.get(id); // même tableau cité plusieurs fois : un seul objet
      const a=new T(bin.buffer.slice(bin.byteOffset+o,bin.byteOffset+o+n*T.BYTES_PER_ELEMENT));vus.set(id,a);return a;
    }
    if(Array.isArray(v))return v.map(un);
    if(v&&typeof v==='object'){const r={};Object.keys(v).forEach(k=>{r[k]=un(v[k]);});return r;}
    return v;
  };
  const vus=new Map();
  let e;try{e=un(meta);}catch(err){return null;}
  return pcEntreeOK(e)?e:null;
}
async function pcVersFichier(docTxt){
  // Enregistrement d'une pièce : son image, si la pièce est à jour → paquet ou null.
  // docTxt : texte du document tel qu'il part dans le fichier (empreinte sig)
  try{
    if(!occHas()||!pcPossible())return null;
    let cle=pcCle();if(!cle)return null;
    // V0.99.26 : enregistré juste après l'ouverture (contrôle de fond en cours, clé changée par les
    // retouches de l'ouverture) ou juste après une modification (calcul en cours) : l'image partait pas
    // (plaque 10,5 → 15 → 10,5 Mo). Document encore tel que servi par l'image de son fichier : la même
    // image repart ; sinon on attend la fin du calcul (PC_ATTENTE_ENR au plus) pour la prendre.
    let e=null;
    if(pcFichierDoc===doc&&!docUndoStack.length){for(const x of pcFichier.values())if(x&&x._doc===doc){e=x;break;}}
    if(!e){
      const occupe=()=>rebuildDepth||(typeof regenRun!=='undefined'&&regenRun)||pcChauffe||occThrPending
        ||(typeof delWkPending==='function'&&delWkPending())||!buildKeyUpToDate();
      if(occupe()){
        try{log('Enregistrement : fin du calcul attendue pour joindre l’image de la pièce…');}catch(x){}
        const t0=Date.now();
        while(occupe()&&Date.now()-t0<PC_ATTENTE_ENR)await new Promise(r=>setTimeout(r,250));
        // document changé pendant l'attente : son image n'irait pas avec le texte enregistré
        try{if(pcSigDoc(JSON.stringify(JSON.parse(serialise())))!==pcSigDoc(docTxt))return null;}catch(x){return null;}
        cle=pcCle();if(!cle)return null;
      }
      if(!occupe()){try{e=pcCapture(cle);}catch(x){e=null;}}
    }
    if(!e)e=await pcLire(cle);
    if(!e||!Array.isArray(e.corps)||!e.corps.length)return null;
    if(e.cle!==cle)e=Object.assign({},e,{cle});
    const x=await pcPaquet(e);if(!x)return null;
    x.formes=FORMES_VER;x.cache=CACHE_VER;x.sig=pcSigDoc(docTxt);
    return x;
  }catch(err){return null;}
}
/* ── composants d'un assemblage servis par leur image (V0.99.16) ──
   Un composant à rejouer (jamais vu sur ce poste, ou modifié puis enregistré avec son image) dont
   l'image correspond EXACTEMENT à son document est servi comme une pièce gardée : ni rejeu ni maillage
   (plaque d'une centaine de fonctions : 10 s → moins d'une seconde). Les images sont lues avant la
   série de rejeux (asmBuildSnapshots est synchrone) : fichiers ouverts (pcFichier), puis ce poste. */
function pcCompBesoin(c,exact){return !!(c&&c.doc&&(!c._snap||c._stale||(exact&&!c._snap.exact)));}
async function pcComposantsPrecharger(list){
  pcCompMem.clear();
  if(typeof asm==='undefined'||!asm||!occHas())return 0;
  let n=0;
  for(const c of (list||asm.comps)){
    if(!pcCompBesoin(c,true)||c.doc===doc)continue;
    const cle=pcCleDe(c.doc);if(!cle)continue;
    let e=null;try{e=pcFichier.get(cle)||(pcIdbOK()?await pcLire(cle):null);}catch(x){e=null;}
    if(e&&Array.isArray(e.corps)&&e.corps.length){pcCompMem.set(cle,e);if(e.cle)pcCompMem.set(e.cle,e);n++;}
  }
  return n;
}
function pcServirComposant(c){
  // asmActivate, juste avant le rejeu du composant : image servie si sa clé est celle du document
  if(!c||!c.doc||c.doc!==doc||!occHas())return false;
  if(!pcCompMem.size&&!pcFichier.size&&!c._pfin)return false;
  try{if(typeof parApplyAll==='function')parApplyAll();}catch(e){}
  try{importHydrate();}catch(e){}
  try{ensureBodies();}catch(e){}
  try{(doc.sketches||[]).forEach(migrateSketch);}catch(e){}
  if(!pcPossible(true))return false;
  const cle=pcCleDe(doc);if(!cle)return false;
  const raw=c._rawKey?'pfin:'+FORMES_VER+':'+PC_V+':'+String(c._rawKey).slice(6):null;
  // c._pfin : image du fichier source lu par le lien (47-composants-lies), vérifiée avec son document
  const e=pcCompMem.get(cle)||pcFichier.get(cle)||(raw&&(pcCompMem.get(raw)||pcFichier.get(raw)))||c._pfin||null;
  delete c._pfin;
  if(!e)return false;
  pcServi=Object.assign({},e,{_doc:doc,_ver:_docVersion+1,_asm:true});
  return true;
}
/* ── contrôle de la pièce relue (V0.96.3) ──
   Le rejeu de fond (pcChauffer) vient de recalculer le solide de chaque corps, sans filets modélisés.
   Comparé au solide affiché (celui sans filets quand il existe) : mêmes corps, même nombre de faces et
   d'arêtes, même volume à 1e-7 près (la pièce gardée a fait un aller-retour par un fichier BRep).
   false = la pièce gardée ne correspond plus à ce que le logiciel calcule aujourd'hui. Une lecture
   impossible ne déclenche rien : au doute sur le CONTRÔLE, on garde l'affichage. */
function pcFonctions(){try{return (doc.features||[]).map(f=>f.id+(f.visible===false?'-':'')).join(',');}catch(e){return '';}}
function pcVerifie(FR){
  // true : conforme ; false : écart ; null : contrôle impossible (on ne conclut rien)
  try{
    if(!FR||!Array.isArray(FR.perBody))return null;
    const E=occt.TopAbs_ShapeEnum;
    const compte=(sh,t)=>{const x=new occt.TopExp_Explorer_2(sh,t,E.TopAbs_SHAPE);let n=0;try{while(x.More()){n++;x.Next();}}finally{try{x.delete();}catch(e){}}return n;};
    const vol=sh=>{const G=new occt.GProp_GProps_1();try{occt.BRepGProp.VolumeProperties_1(sh,G,false,false,false);return G.Mass();}finally{try{G.delete();}catch(e){}}};
    const vus=bodies.filter(b=>b&&b.kind==='body'&&b.shape);
    const neufs=FR.perBody.filter(p=>p&&p.shape);
    if(!vus.length||!neufs.length)return null; // rien d'affiché, ou rejeu sans corps : pas un écart de calcul
    if(vus.length!==neufs.length){pcVerif.dernier='corps '+vus.length+' / '+neufs.length+' '+JSON.stringify(FR.perBody.map(p=>[p&&p.bodyId,!!(p&&p.shape)]))+' '+JSON.stringify((FR.msgs||[]).slice(0,3))+' fonctions '+doc.features.length+' marqueur '+tlReplayCount();return false;}
    for(const p of neufs){
      const b=vus.find(x=>x.bodyId===p.bodyId);if(!b){pcVerif.dernier='corps '+p.bodyId+' absent';return false;}
      const ref=b.shapeFao||b.shape;
      const nf=[compte(ref,E.TopAbs_FACE),compte(p.shape,E.TopAbs_FACE),compte(ref,E.TopAbs_EDGE),compte(p.shape,E.TopAbs_EDGE)];
      if(nf[0]!==nf[1]||nf[2]!==nf[3]){pcVerif.dernier=p.bodyId+' : faces '+nf[0]+' / '+nf[1]+', arêtes '+nf[2]+' / '+nf[3];return false;}
      const a=vol(ref),c=vol(p.shape);
      if(!(Math.abs(a-c)<=1e-7*Math.max(1,Math.abs(a),Math.abs(c)))){pcVerif.dernier=p.bodyId+' : volume '+a+' / '+c;return false;}
    }
    return true;
  }catch(e){return null;}
}
function pcPerimee(){
  // La pièce gardée ne vaut plus : recalcul normal (les points de contrôle viennent d'être remplis),
  // puis rangement de la bonne à sa place.
  try{log('Pièce gardée périmée (elle ne correspond plus au calcul de cette version) — recalculée.');}catch(e){}
  try{faceEl.textContent=(faceEl.textContent?faceEl.textContent+'\n':'')+'Pièce gardée périmée : recalculée.';}catch(e){}
  pcEcrit=new Set();
  try{builtVersion=-1;rebuild();}catch(e){}
  try{pcEcrireSoon();}catch(e){}
}
/* ── V0.99.5 : le rejeu de fond attend que la vue soit au repos ──
   Une étape du rejeu (une fonction) bloque la page de 50 à 600 ms : la vue saccadait pendant les
   ~7 s qui suivent l'ouverture d'une pièce gardée (plaque SIRAP-14-003 : 55 blocages). Le rejeu
   n'avance donc que si la souris (survol compris), la molette et le clavier sont immobiles depuis PC_CALME ms (bouton de souris
   enfoncé = jamais au repos). Au pire, une étape commencée juste avant le geste le retarde. */
const PC_CALME=900;
let pcMainT=-1e9,pcMainBas=0;
function pcMain(){pcMainT=performance.now();}
try{
  if(typeof window!=='undefined'&&window.addEventListener){
    window.addEventListener('pointerdown',()=>{pcMainBas++;pcMain();},true);
    const leve=()=>{pcMainBas=0;pcMain();};
    window.addEventListener('pointerup',leve,true);window.addEventListener('pointercancel',leve,true);window.addEventListener('blur',leve);
    window.addEventListener('pointermove',pcMain,{capture:true,passive:true}); // survol compris : la surbrillance saccadait aussi
    window.addEventListener('wheel',pcMain,{capture:true,passive:true});
    window.addEventListener('keydown',pcMain,true);
  }
}catch(e){}
function pcCalme(){return !pcMainBas&&performance.now()-pcMainT>PC_CALME;}
/* ── après une pièce servie : points de contrôle remplis en fond ── */
function pcApresServi(){
  if(pcChauffe)return;
  try{faceEl.textContent=(faceEl.textContent?faceEl.textContent+'\n':'')+'Pièce relue telle qu’elle était (rien n’a changé depuis la dernière fois).';}catch(e){}
  pcChauffe=pcChauffer().catch(()=>false).finally(()=>{pcChauffe=null;});
}
async function pcChauffer(){
  // Le rejeu (même code, mêmes clés que le rejeu d'affichage) vidé fonction par fonction, la main
  // rendue au navigateur entre deux : il ne touche ni à l'affichage, ni à bodies, ni au document.
  // Abandonné si le document change ; ce qui manque sera calculé par la modification elle-même.
  await new Promise(r=>setTimeout(r,1500));
  if(!occHas())return false;
  const d0=doc,v0=_docVersion,m0=tlMark,s0=occSkipFeat,f0=occStepForce,f1=pcFonctions();
  const stale=()=>doc!==d0||_docVersion!==v0||tlMark!==m0||occSkipFeat!==s0||occStepForce!==f0||!occHas();
  let g=null,FR=null;
  const att0=typeof delWkAttenteN!=='undefined'?delWkAttenteN:0;
  try{
    g=occFinalShapeGen(tlReplayCount(),true);
    for(;;){
      if(stale()){try{g.return();}catch(e){}return false;}
      if(rebuildDepth||(typeof regenRun!=='undefined'&&regenRun)){await new Promise(r=>setTimeout(r,200));continue;}
      if(!pcCalme()){await new Promise(r=>setTimeout(r,150));continue;} // V0.99.5 : vue en mouvement
      let r;const skip0=occThreadSkip;
      try{occThreadSkip=true;delWkFond=true;r=g.next();}finally{occThreadSkip=skip0;delWkFond=false;}
      if(r.done){FR=r.value;break;}
      await new Promise(r=>setTimeout(r,0));
    }
    // V0.96.3 : la pièce relue est-elle bien celle que le rejeu d'aujourd'hui donne ?
    // Seulement si rien n'a bougé depuis le départ : même document, mêmes fonctions (un fichier en cours
    // d'ouverture vide puis remplit le MÊME document sans changer sa version), affichage à jour.
    while(!pcCalme()&&!stale())await new Promise(r=>setTimeout(r,150)); // contrôle (~0,5 s) : vue au repos aussi
    let memes=false;try{memes=!stale()&&!rebuildDepth&&doc.features.length>0&&pcFonctions()===f1&&buildKeyUpToDate();}catch(e){memes=false;}
    // V0.99.16 : rejeu qui a reçu « calcul en cours » (suppression de face ou filets relancés en fond) :
    // son solide est provisoire, sans ce calcul — rien à conclure. Plaque à suppression de face : 898 faces
    // au lieu de 896, « pièce gardée périmée » et 38 s d'à-coups pour la recalculer à l'identique.
    const provisoire=typeof delWkAttenteN!=='undefined'&&delWkAttenteN!==att0;
    const v=memes&&!provisoire?pcVerifie(FR):null;
    if(v===true)pcVerif.ok++;
    else if(v===false){pcVerif.ecart++;pcFichierDoc=null; // image du fichier fausse : ne plus la réenregistrer
try{occCleanup(FR,null);}catch(e){}FR=null;pcPerimee();}
    else pcVerif.sans++;
    return true;
  }finally{if(FR){try{occCleanup(FR,null);}catch(e){}}}
}
