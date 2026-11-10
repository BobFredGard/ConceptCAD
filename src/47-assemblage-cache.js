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
     · version du moteur de géométrie (CACHE_VER, comme l'image de la pièce active et les
       trajectoires FAO — V0.28.1 : plus APP_VER, sinon une image enregistrée dans un fichier ne
       servait plus dès la livraison suivante). Une correction du rejeu d'une fonction DOIT donc
       changer CACHE_VER, sinon l'ancienne image reste affichée jusqu'au prochain rejeu ;
     · deux empreintes indépendantes + la longueur du texte (pas de collision réaliste).
   Jamais mis en cache : un import sans empreinte de sa source (V0.87.0 : avec, elle entre dans la
   clé — corps dérivés compris), une forme importée pas encore chargée, une capture en
   repli maillage, ou prise avec le marqueur temps reculé, une fonction suspendue, une esquisse
   ouverte (l'image ne correspond pas au document complet).
   Clés asnap:<…> du magasin « kv » ; index asnap:index {clé → dernier usage} : au-delà de
   ASM_CACHE_MAX entrées, les plus anciennes partent. Le cache est une simple accélération :
   toute erreur de lecture ou d'écriture (quota, navigation privée) le contourne en silence.
   IMAGES DANS LE FICHIER (option de l'assemblage asm.img, V0.28.1) : à l'enregistrement, les
   entrées des composants du fichier partent dans le paquet .miniFusion (b.asnap : tableaux
   typés réunis en un bloc binaire compressé gzip, base64) ; à l'ouverture, bundleStoreCaches
   les remet dans le cache AVANT la lecture du document : le fichier s'ouvre vite sur un autre
   poste. Elles passent par les mêmes clés : une image qui ne correspond plus est ignorée. */
const ASM_CACHE_V=3;        // format des entrées (2 : V0.29.0, faces exactes it.grp / it.fg pour les mesures ; 3 : V0.35.0, spirales des filets thr)
const ASM_CACHE_MAX=300;    // entrées gardées
const ASM_CACHE_VERTS=1500000; // composant plus gros : pas de cache (comme saveViewCache)
const asmCachePend=new Map(); // composant → {snap, key} à écrire
let asmCacheT=null;
function asmCacheIdbOK(){return typeof indexedDB!=='undefined'&&!!indexedDB&&typeof idbOpen==='function';}
function asmCacheImports(d){return (d.features||[]).filter(f=>f&&f.type==='import');}
function asmCacheable(d){
  // V0.87.0 : un import ne bloque plus le cache s'il cite sa source par l'EMPREINTE de son contenu
  // (f.src.key, 90-30) : la clé change avec le fichier importé. Corps dérivés compris (52) : une
  // pièce qui enlève une forme dérivée était rejouée à chaque ouverture (≈ 1 min sur une vraie pièce).
  return !!d&&Array.isArray(d.sketches)&&asmCacheImports(d).every(f=>f.src&&typeof f.src.key==='string'&&f.src.key);
}
function asmCacheImpReady(d){
  // Image capturée seulement quand chaque import visible a sa forme exacte chargée (sinon corps absent)
  return asmCacheImports(d).every(f=>f.visible===false||(()=>{const e=importGeom.get(f.id);return !!(e&&e.brep);})());
}
function asmCacheKey(d){
  // Clé du composant (document d) ; null : pas de cache
  if(!asmCacheable(d))return null;
  let s;
  try{
    // imports : hors de docHashSrc (sauf dérivés) → fonctions entières, avec l'empreinte de leur source
    const im=asmCacheImports(d).map(({_mesh,_m,...r})=>r);
    s=docHashSrc(d)+'|'+JSON.stringify({b:d.bodies||[],v:d.bodyVis||{},t:d.tint||0,r:d.rendu||null})+(im.length?'|'+JSON.stringify(im):'')+'|'+CACHE_VER+'|'+ASM_CACHE_V;}
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
      color:it.color,bid:it.bid,op:it.op,gl:it.gl,rl:it.rl||null,cm:it.cm||null,grp:it.grp||null,fg:it.fg||null});
  }
  const e=s.edges&&s.edges.attributes;
  return {items,edges:e&&e.position?{pos:asmCacheArr(e.position),col:asmCacheArr(e.color)}:null,
    pedges:s.pedges||null,pfaces:s.pfaces||null,thr:s.thr||null,hash:s.hash||''};
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
    // faces exactes (V0.29.0, mesures) : vérifiées, une table douteuse est simplement absente
    const grp=asmGrpNorm(it.grp),fg=grp?asmFgNorm(it.fg,grp.length):null;
    if(grp)g.userData.occGroups=grp;
    return {geo:g,color:it.color,bid:it.bid||null,op:it.op,gl:it.gl,rl:it.rl||null,cm:it.cm||null,grp:grp||null,fg:fg||null};
  });
  let edges=null;
  if(v.edges&&v.edges.pos&&v.edges.pos.length){
    edges=new THREE.BufferGeometry();
    edges.setAttribute('position',new THREE.Float32BufferAttribute(v.edges.pos,3));
    if(v.edges.col)edges.setAttribute('color',new THREE.Float32BufferAttribute(v.edges.col,3));
  }
  return {items,edges,pedges:v.pedges||null,pfaces:v.pfaces||null,thr:Array.isArray(v.thr)?v.thr:null,exact:true,hash,cached:true};
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
  try{if(!asmCacheImpReady(c.doc))return;}catch(e){return;}
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
/* ── images dans le fichier (option asm.img) ── */
const ASM_CACHE_TA={f32:Float32Array,u32:Uint32Array,u16:Uint16Array,u8:Uint8Array};
function asmCacheTaKind(a){return a instanceof Float32Array?'f32':a instanceof Uint32Array?'u32':a instanceof Uint16Array?'u16':a instanceof Uint8Array?'u8':null;}
async function asmCacheZip(u8,inflate){
  // gzip natif (Chrome, Edge, Firefox récents) ; null : indisponible
  if(typeof CompressionStream==='undefined'||typeof DecompressionStream==='undefined'||typeof Response==='undefined'||typeof Blob==='undefined')return null;
  const s=new Blob([u8]).stream().pipeThrough(inflate?new DecompressionStream('gzip'):new CompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function asmCacheExport(){
  // Entrées du cache des composants de ce fichier (renvois compris) → {v, meta, z, bin} ou null.
  // meta : les entrées, chaque tableau typé remplacé par {$t, o, n} dans le bloc binaire bin.
  if(!asm||!asmCacheIdbOK())return null;
  if(asmCacheT){clearTimeout(asmCacheT);asmCacheT=null;try{await asmCacheFlush();}catch(e){}} // captures récentes d'abord
  const keys=[...new Set(asm.comps.map(c=>c.doc?asmCacheKey(c.doc):null).filter(Boolean))];
  if(!keys.length)return null;
  let got;try{got=await asmCacheRead(keys);}catch(e){return null;}
  const al=[...new Set(keys.map(k=>got[k]&&got[k].alias).filter(k=>k&&!got[k]))];
  if(al.length){try{Object.assign(got,await asmCacheRead(al));}catch(e){}}
  const parts=[];let off=0;
  const walk=v=>{
    if(ArrayBuffer.isView(v)){
      const t=asmCacheTaKind(v);if(!t)return null;
      const pad=(4-off%4)%4;if(pad){parts.push(new Uint8Array(pad));off+=pad;}
      parts.push(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));
      const r={$t:t,o:off,n:v.length};off+=v.byteLength;return r;
    }
    if(Array.isArray(v))return v.map(walk);
    if(v&&typeof v==='object'){const o={};Object.keys(v).forEach(k=>{o[k]=walk(v[k]);});return o;}
    return v;
  };
  const meta={};
  Object.keys(got).forEach(k=>{const v=got[k];if(k!=='asnap:index'&&v&&v.v===ASM_CACHE_V)meta[k]=walk(v);});
  if(!Object.keys(meta).length)return null;
  const bin=new Uint8Array(off);let p=0;parts.forEach(u=>{bin.set(u,p);p+=u.length;});
  // gzip : le bloc binaire ET meta (arêtes et faces exactes : tableaux de nombres en texte)
  try{
    const g=await asmCacheZip(bin,false),m=g&&await asmCacheZip(new TextEncoder().encode(JSON.stringify(meta)),false);
    if(g&&m)return {v:ASM_CACHE_V,z:'gzip',meta:importU8ToB64(m),bin:importU8ToB64(g)};
  }catch(e){}
  return {v:ASM_CACHE_V,z:'',meta,bin:importU8ToB64(bin)};
}
async function asmCacheImport(x){
  // Images d'un fichier ouvert (b.asnap) → cache du navigateur, avant la lecture des composants.
  // Contenu venu d'ailleurs : tout est vérifié, une entrée douteuse est ignorée. → entrées gardées
  if(!x||typeof x!=='object'||x.v!==ASM_CACHE_V||!x.meta||typeof x.bin!=='string'||!asmCacheIdbOK())return 0;
  let bin,meta=x.meta;try{bin=importB64ToU8(x.bin);}catch(e){return 0;}
  if(x.z==='gzip'){
    try{
      bin=await asmCacheZip(bin,true);
      const m=typeof meta==='string'?await asmCacheZip(importB64ToU8(meta),true):null;
      meta=m?JSON.parse(new TextDecoder().decode(m)):null;
    }catch(e){return 0;}
    if(!bin)return 0;
  }else if(x.z)return 0;
  if(!meta||typeof meta!=='object'||Array.isArray(meta))return 0;
  const un=v=>{
    if(v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.$t==='string'){
      const T=ASM_CACHE_TA[v.$t],o=+v.o,n=+v.n;
      if(!T||!Number.isInteger(o)||!Number.isInteger(n)||o<0||n<0||o%T.BYTES_PER_ELEMENT||o+n*T.BYTES_PER_ELEMENT>bin.length)throw new Error('image abîmée');
      return new T(bin.buffer.slice(bin.byteOffset+o,bin.byteOffset+o+n*T.BYTES_PER_ELEMENT));
    }
    if(Array.isArray(v))return v.map(un);
    if(v&&typeof v==='object'){const r={};Object.keys(v).forEach(k=>{r[k]=un(v[k]);});return r;}
    return v;
  };
  const puts={};
  Object.keys(meta).forEach(k=>{
    if(!/^asnap:[0-9a-z_]+$/.test(k)||k==='asnap:index')return;
    try{const v=un(meta[k]);
      if(v&&v.v===ASM_CACHE_V&&(typeof v.alias==='string'?/^asnap:[0-9a-z_]+$/.test(v.alias):Array.isArray(v.items)&&v.items.every(it=>it&&it.pos instanceof Float32Array)))puts[k]=v;
    }catch(e){}
  });
  const ks=Object.keys(puts);if(!ks.length)return 0;
  let idx={};try{idx=((await asmCacheRead(['asnap:index']))['asnap:index'])||{};}catch(e){}
  ks.forEach(k=>{idx[k]=Date.now();});
  const dels=Object.keys(idx).sort((a,b)=>idx[b]-idx[a]).slice(ASM_CACHE_MAX).filter(k=>!puts[k]);
  dels.forEach(k=>{delete idx[k];});
  puts['asnap:index']=idx;
  try{await asmCacheWrite(puts,dels);}catch(e){return 0;}
  return ks.length;
}
