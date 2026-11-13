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
function pcPossible(){
  try{
    if(!occHas()||freshHard||!doc||!(doc.features||[]).length)return false;
    if(typeof asm!=='undefined'&&asm&&asm.comps&&asm.comps.length>1)return false;
    if(tlReplayCount()!=null||occSkipFeat||occStepForce||occPrefixTap||derCkPre)return false;
    return asmCacheable(doc)&&asmCacheImpReady(doc);
  }catch(e){return false;}
}
function pcCle(){
  // null : pas de cache possible pour l'état courant
  if(!pcPossible())return null;
  const k=asmCacheKey(doc);if(!k)return null;
  return 'pfin:'+FORMES_VER+':'+PC_V+':'+k.slice(6);
}
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
    delWkRes.forEach((v,k)=>{
      if(!v||v.st!=='fin'||!v.brep)return;
      if(!sigs.some(s=>s.startsWith(k)||k===s+';'))return;
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
    const e=await pcLire(cle);
    if(!e||e.v!==PC_V||!Array.isArray(e.corps)||!e.corps.length)return false;
    if(doc!==d0||_docVersion!==v0)return false; // document changé pendant la lecture
    // V0.96.3 : pendant la lecture, le calcul de l'ouverture a pu faire ses retouches (origine d'esquisse
    // arrondie, face d'appui nommée) : la clé n'est plus celle du fichier mais celle du document retouché,
    // qui est exactement la clé propre de l'entrée quand on l'a trouvée par son alias. Refusée alors à tort :
    // la plaque SIRAP-14-003 était recalculée à chaque ouverture (11 s), pièce gardée rangée et lisible.
    {const k2=pcCle();if(k2!==cle&&k2!==e.cle)return false;}
    e._doc=d0;e._ver=v0;
    pcServi=e;pcEcrit.add(cle);pcEcrit.add(e.cle);
    return true;
  }catch(err){pcServi=null;return false;}
}
function pcValide(){
  // rebuildInner : rien n'a bougé depuis pcPreparer (même document, aucune modification, même
  // marqueur…) ? La clé y a été vérifiée ; les hôtes résolus entre-temps ne sont que des retouches.
  if(!pcServi)return false;
  let ok=false;try{ok=pcServi._doc===doc&&pcServi._ver===_docVersion&&pcPossible();}catch(e){}
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
    try{(e.delwk||[]).forEach(([k,v])=>{if(!delWkRes.has(k))delWkRes.set(k,Object.assign({},v,{st:'fin',warnings:(v.warnings||[]).slice()}));});}catch(x){}
    const ghostShapes=(e.ghosts||[]).map(g=>({geo:pcGeoDe(g.geo),orphan:!!g.orphan,fid:g.fid||null,inexact:g.inexact||null})).filter(g=>g.geo);
    pcFait=true;
    return{shape,shapeFao,preThr,perBody,ghostShapes,msgs:(e.msgs||[]).slice(),bin:[],itemShapes:[],items:[],imports:(e.imports||[]).slice(),D:e.D||null,servi:true};
  }catch(err){
    occDispose(faits);
    try{log('Pièce gardée illisible ('+((err&&err.message)||err)+') — recalcul complet.');}catch(x){}
    return null;
  }
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
  try{
    g=occFinalShapeGen(tlReplayCount(),true);
    for(;;){
      if(stale()){try{g.return();}catch(e){}return false;}
      if(rebuildDepth||(typeof regenRun!=='undefined'&&regenRun)){await new Promise(r=>setTimeout(r,200));continue;}
      let r;const skip0=occThreadSkip;
      try{occThreadSkip=true;r=g.next();}finally{occThreadSkip=skip0;}
      if(r.done){FR=r.value;break;}
      await new Promise(r=>setTimeout(r,0));
    }
    // V0.96.3 : la pièce relue est-elle bien celle que le rejeu d'aujourd'hui donne ?
    // Seulement si rien n'a bougé depuis le départ : même document, mêmes fonctions (un fichier en cours
    // d'ouverture vide puis remplit le MÊME document sans changer sa version), affichage à jour.
    let memes=false;try{memes=!stale()&&!rebuildDepth&&doc.features.length>0&&pcFonctions()===f1&&buildKeyUpToDate();}catch(e){memes=false;}
    const v=memes?pcVerifie(FR):null;
    if(v===true)pcVerif.ok++;
    else if(v===false){pcVerif.ecart++;try{occCleanup(FR,null);}catch(e){}FR=null;pcPerimee();}
    else pcVerif.sans++;
    return true;
  }finally{if(FR){try{occCleanup(FR,null);}catch(e){}}}
}
