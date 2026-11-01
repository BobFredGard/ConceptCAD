/* ---------- instantanés des composants en cache persistant (V0.28.0) ----------
   Ouvrir un assemblage rejouait chaque composant dans le noyau (0,6 à 1,4 s par pièce réelle,
   34 s pour 40 pièces, interface figée), même si rien n'avait changé depuis la dernière fois.
   L'instantané d'affichage d'un composant (47 : maillages, arêtes, arêtes et faces exactes
   visées par les autres) est donc gardé en IndexedDB, et relu à l'ouverture à la place du rejeu.
   RÈGLE : au moindre doute, on rejoue (comme avant). Une entrée n'est servie que si sa CLÉ est
   exactement celle du composant :
     · empreinte du paramétrique (docHashSrc, comme docHash) ;
     · ce qui colore et montre les corps sans être dans cette empreinte (fiches des corps,
       visibilité, teinte, apparence de rendu) ;
     · version de l'application ET du moteur (APP_VER, CACHE_VER) : toute livraison rejoue une
       fois ;
     · deux empreintes indépendantes + la longueur du texte (pas de collision réaliste).
   Jamais mis en cache : un composant avec un import (contenu hors empreinte), une capture en
   repli maillage, ou prise avec le marqueur temps reculé, une fonction suspendue, une esquisse
   ouverte (l'image ne correspond pas au document complet).
   Clés asnap:<…> du magasin « kv » ; index asnap:index {clé → dernier usage} : au-delà de
   ASM_CACHE_MAX entrées, les plus anciennes partent. Le cache est une simple accélération :
   toute erreur de lecture ou d'écriture (quota, navigation privée) le contourne en silence. */
const ASM_CACHE_V=1;        // format des entrées
const ASM_CACHE_MAX=300;    // entrées gardées
const ASM_CACHE_VERTS=1500000; // composant plus gros : pas de cache (comme saveViewCache)
const asmCachePend=new Map(); // composant → {snap, key} à écrire
let asmCacheT=null;
function asmCacheIdbOK(){return typeof indexedDB!=='undefined'&&!!indexedDB&&typeof idbOpen==='function';}
function asmCacheable(d){return !!d&&Array.isArray(d.sketches)&&!(d.features||[]).some(f=>f&&f.type==='import');}
function asmCacheKey(d){
  // Clé du composant (document d) ; null : pas de cache
  if(!asmCacheable(d))return null;
  let s;
  try{s=docHashSrc(d)+'|'+JSON.stringify({b:d.bodies||[],v:d.bodyVis||{},t:d.tint||0,r:d.rendu||null})+'|'+APP_VER+'|'+CACHE_VER+'|'+ASM_CACHE_V;}
  catch(e){return null;}
  let a=2166136261,b=5381;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a^=c;a=Math.imul(a,16777619);b=(Math.imul(b,33)^c)|0;}
  return 'asnap:'+(a>>>0).toString(36)+'_'+(b>>>0).toString(36)+'_'+s.length;
}
/* ── accès IndexedDB groupés (une transaction pour tout le lot) ── */
async function asmCacheRead(keys){
  const out={};if(!keys.length)return out;
  const db=await idbOpen();
  return new Promise(res=>{
    let tx;try{tx=db.transaction('kv','readonly');}catch(e){try{db.close();}catch(_){}res(out);return;}
    const st=tx.objectStore('kv');
    keys.forEach(k=>{try{const rq=st.get(k);rq.onsuccess=()=>{if(rq.result)out[k]=rq.result;};}catch(e){}});
    const end=()=>{try{db.close();}catch(e){}res(out);};
    tx.oncomplete=end;tx.onerror=end;tx.onabort=end;
  });
}
async function asmCacheWrite(puts,dels){
  const db=await idbOpen();
  return new Promise((res,rej)=>{
    let tx;try{tx=db.transaction('kv','readwrite');}catch(e){try{db.close();}catch(_){}rej(e);return;}
    const st=tx.objectStore('kv');
    Object.keys(puts||{}).forEach(k=>st.put(puts[k],k));
    (dels||[]).forEach(k=>st.delete(k));
    tx.oncomplete=()=>{try{db.close();}catch(e){}res(true);};
    tx.onerror=tx.onabort=()=>{try{db.close();}catch(e){}rej(tx.error);};
  });
}
/* ── instantané ↔ données pures (tableaux typés : clonage structuré d'IndexedDB) ── */
function asmCacheArr(a){return a&&a.array?a.array.slice():null;}
function asmCachePack(s){
  if(!s||!s.exact)return null;
  let verts=0;
  const items=[];
  for(const it of s.items||[]){
    const g=it.geo,p=g&&g.attributes&&g.attributes.position;
    if(!p||!p.array)return null;
    verts+=p.count||0;if(verts>ASM_CACHE_VERTS)return null;
    items.push({pos:p.array.slice(),nor:asmCacheArr(g.attributes.normal),idx:g.index?asmCacheArr(g.index):null,
      color:it.color,bid:it.bid,op:it.op,gl:it.gl,rl:it.rl||null,cm:it.cm||null});
  }
  const e=s.edges&&s.edges.attributes;
  return {items,edges:e&&e.position?{pos:asmCacheArr(e.position),col:asmCacheArr(e.color)}:null,
    pedges:s.pedges||null,pfaces:s.pfaces||null,hash:s.hash||''};
}
function asmCacheUnpack(v,hash){
  // hash : empreinte du document REJOUÉ (celle de la capture), que citent les références des
  // autres composants (asmSkExtSig) — pas celle du document tel que lu, avant réparation
  hash=v.hash||hash;
  const items=(v.items||[]).map(it=>{
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(it.pos,3));
    if(it.nor&&it.nor.length===it.pos.length)g.setAttribute('normal',new THREE.Float32BufferAttribute(it.nor,3));
    if(it.idx)g.setIndex(new THREE.BufferAttribute(it.idx,1));
    if(!g.attributes.normal)g.computeVertexNormals();
    return {geo:g,color:it.color,bid:it.bid||null,op:it.op,gl:it.gl,rl:it.rl||null,cm:it.cm||null};
  });
  let edges=null;
  if(v.edges&&v.edges.pos&&v.edges.pos.length){
    edges=new THREE.BufferGeometry();
    edges.setAttribute('position',new THREE.Float32BufferAttribute(v.edges.pos,3));
    if(v.edges.col)edges.setAttribute('color',new THREE.Float32BufferAttribute(v.edges.col,3));
  }
  return {items,edges,pedges:v.pedges||null,pfaces:v.pfaces||null,exact:true,hash,cached:true};
}
/* ── écriture : fin de rejeu du composant actif (asmCaptureActive), différée et groupée ── */
function asmCacheSoon(c){
  if(!c||!c._snap||!asmCacheIdbOK())return;
  // image partielle ou provisoire : elle ne correspond pas au document complet
  try{if(typeof tlMark!=='undefined'&&tlMark)return;}catch(e){}
  try{if(typeof occSkipFeat!=='undefined'&&occSkipFeat)return;}catch(e){}
  try{if(typeof skEdit!=='undefined'&&skEdit)return;}catch(e){}
  if(!c._snap.exact||c._snap.cached)return;
  const key=asmCacheKey(c.doc);if(!key)return;
  // capture du rejeu de première activation (asmActivate : document réparé, puis rejoué, sans
  // rien entre les deux) : la clé du document tel qu'il est dans le fichier mène aussi à cet
  // instantané (simple renvoi vers la clé finale)
  const raw=c._rawKey&&c._rawKey!==key?c._rawKey:null;
  asmCachePend.set(c,{snap:c._snap,key,raw});
  if(asmCacheT)clearTimeout(asmCacheT);
  asmCacheT=setTimeout(()=>{asmCacheT=null;asmCacheFlush().catch(()=>{});},1200);
}
async function asmCacheFlush(){
  const puts={},keys=[];
  asmCachePend.forEach((p,c)=>{
    if(c._snap!==p.snap)return; // remplacé depuis : la capture suivante est en attente
    let v=null;try{v=asmCachePack(p.snap);}catch(e){v=null;}
    if(!v)return;
    v.v=ASM_CACHE_V;v.at=Date.now();puts[p.key]=v;keys.push(p.key);
    if(p.raw){puts[p.raw]={v:ASM_CACHE_V,alias:p.key};keys.push(p.raw);}
  });
  asmCachePend.clear();
  if(!keys.length)return 0;
  const idx=((await asmCacheRead(['asnap:index']))['asnap:index'])||{};
  keys.forEach(k=>{idx[k]=Date.now();});
  const all=Object.keys(idx).sort((a,b)=>idx[b]-idx[a]),dels=all.slice(ASM_CACHE_MAX);
  dels.forEach(k=>{delete idx[k];delete puts[k];});
  puts['asnap:index']=idx;
  try{await asmCacheWrite(puts,dels);}catch(e){return 0;} // quota, navigation privée : sans cache
  return keys.length;
}
/* ── lecture : à l'ouverture, avant les rejeux (asmAfterLoad), et aux mises à jour de liens ── */
async function asmCacheFill(list){
  // Instantanés relus du cache pour les composants qui en manquent (hors composant actif,
  // reconstruit par l'ouverture) → nombre de composants servis
  if(!asm||!asmCacheIdbOK())return 0;
  const A=asm;
  const exact=typeof occHas==='function'&&occHas();
  const todo=[];
  (list||A.comps).forEach(c=>{
    if(!c||!c.doc||c.doc===doc)return;
    if(c._snap&&!c._stale&&(c._snap.exact||!exact))return;
    const key=asmCacheKey(c.doc);if(key)todo.push({c,key});
  });
  if(!todo.length)return 0;
  let got;try{got=await asmCacheRead(todo.map(t=>t.key).concat('asnap:index'));}catch(e){return 0;}
  // renvois (document tel que lu → document réparé) : seconde lecture groupée
  const al=[...new Set(todo.map(t=>got[t.key]&&got[t.key].v===ASM_CACHE_V&&got[t.key].alias).filter(k=>k&&!got[k]))];
  if(al.length){try{Object.assign(got,await asmCacheRead(al));}catch(e){}}
  if(asm!==A)return 0; // autre fichier ouvert entre-temps
  let n=0;
  const idx=got['asnap:index']||{};
  todo.forEach(({c,key})=>{
    let v=got[key];
    if(v&&v.v===ASM_CACHE_V&&v.alias){idx[v.alias]=Date.now();v=got[v.alias];}
    if(!v||v.v!==ASM_CACHE_V||!Array.isArray(v.items))return;
    if(c.doc===doc||!A.comps.includes(c))return; // activé ou retiré pendant la lecture
    let s;try{s=asmCacheUnpack(v,docHashOf(c.doc));}catch(e){return;}
    if(c._snap)asmSnapFree(c._snap);
    c._snap=s;delete c._stale;
    idx[key]=Date.now();n++;
  });
  if(n){try{await asmCacheWrite({'asnap:index':idx},[]);}catch(e){}}
  return n;
}
