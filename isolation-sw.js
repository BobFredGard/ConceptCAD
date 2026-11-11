// Service worker du site ConceptCAD (GitHub Pages). Deux rôles :
//  1. Isolation : ajoute aux réponses du site les en-têtes que Pages n'envoie pas, sans lesquels le navigateur
//     refuse les fils du noyau multicœur. Le serveur local (Server.bat) envoie lui-même ces en-têtes.
//  2. Hors ligne (V0.93.0, application installable) : chaque fichier du site lu avec succès est gardé sur
//     l'ordinateur ; sans réseau, la copie gardée répond. Le réseau passe toujours en premier : en ligne, on a
//     donc toujours la dernière version, comme avant. Un fichier n'est réécrit dans la réserve que s'il a changé
//     (ETag), pour ne pas recopier les 43 Mo du noyau à chaque ouverture. La page demande aussi, une fois
//     démarrée, de remplir la réserve avec tout ce qu'il faut pour démarrer sans réseau (message « precharger »).
// Le nom du fichier ne change jamais : c'est lui que les navigateurs des visiteurs ont déjà enregistré.
const VERSION='__VERSION__'; // remplacé par le tag de version à la publication (pages.yml)
const RESERVE='conceptcad-hors-ligne';
const PORTEE=self.registration.scope;
// De quoi démarrer sans réseau (chemins relatifs à la portée). Le noyau multicœur s'y ajoute quand la page s'en sert.
const ESSENTIELS=['./','manifest.webmanifest','icones/conceptcad.svg','icones/conceptcad-192.png','icones/conceptcad-512.png',
  'threejs/three.min.js','threejs/OrbitControls.js','threejs/CSG.js',
  'occt/v3/conceptcad_v3.js','occt/v3/conceptcad_v3.wasm','occt/v3/compat-v3.cjs','occt/v3/compat-v3.json'];
const MULTICOEUR=['occt/mt/conceptcad_v3.js','occt/mt/conceptcad_v3.wasm'];
const DELAI_PAGE=6000; // réseau trop lent pour la page alors qu'une copie existe : on prend la copie

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==RESERVE).map(n=>caches.delete(n))))));

function isoler(r){
  if(!r||!r.status||r.type==='opaque')return r;
  const h=new Headers(r.headers);
  h.set('Cross-Origin-Opener-Policy','same-origin');
  h.set('Cross-Origin-Embedder-Policy','require-corp');
  h.set('Cross-Origin-Resource-Policy','same-origin');
  return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});
}
// La page elle-même : la racine du site, index.html ou ConceptCAD.html (serveur local), quelle que soit l'adresse.
function estPage(u){
  const rel=u.href.slice(PORTEE.length).replace(/[?#].*$/,'');
  return rel===''||rel==='index.html'||rel==='ConceptCAD.html';
}
const cle=u=>estPage(u)?PORTEE:u.origin+u.pathname;
const signature=r=>r.headers.get('ETag')||((r.headers.get('Last-Modified')||'')+'|'+(r.headers.get('Content-Length')||''));
const gardable=r=>r&&r.ok&&r.status===200&&r.type==='basic'&&!r.headers.get('Content-Range');
// Garde une réponse du réseau si elle a changé ; rend la promesse d'écriture (ou null), sans attendre l'écriture.
// sansCopie : la réponse n'est lue par personne d'autre (préchargement), on l'écrit telle quelle.
async function garder(k,r,sansCopie){
  if(!gardable(r))return null;
  const c=await caches.open(RESERVE);
  const v=await c.match(k);
  const s=signature(r);
  if(v&&s!=='|'&&signature(v)===s){if(sansCopie)r.body&&r.body.cancel().catch(()=>{});return null;}
  return c.put(k,sansCopie?r:r.clone()).catch(()=>{});
}
async function copie(u){
  const c=await caches.open(RESERVE);
  return await c.match(cle(u));
}
async function servir(e,q,u){
  const k=cle(u);
  const reseau=fetch(q).then(async r=>{const w=await garder(k,r);if(w)e.waitUntil(w);return r;});
  if(q.mode==='navigate'&&estPage(u)){
    // la page : réseau d'abord, mais pas plus de quelques secondes si une copie attend
    reseau.catch(()=>{}); // un échec après le délai ne doit pas rester « non traité »
    const lent=new Promise(ok=>setTimeout(()=>ok('lent'),DELAI_PAGE));
    let r;
    try{r=await Promise.race([reseau,lent]);}catch(err){r=null;}
    if(r&&r!=='lent')return isoler(r);
    const c=await copie(u);
    if(c)return isoler(c);
    return isoler(await reseau);
  }
  try{return isoler(await reseau);}
  catch(err){
    const c=await copie(u);
    if(c)return isoler(c);
    throw err;
  }
}
self.addEventListener('fetch',e=>{
  const q=e.request;
  if(q.cache==='only-if-cached'&&q.mode!=='same-origin')return;
  const u=new URL(q.url);
  if(q.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(PORTEE)){
    e.respondWith(fetch(q).then(isoler));
    return;
  }
  e.respondWith(servir(e,q,u));
});

// Remplit la réserve : chaque fichier manquant ou changé est relu (le cache du navigateur sert souvent).
async function precharger(mt){
  const liste=ESSENTIELS.concat(mt?MULTICOEUR:[]);
  let n=0,octets=0,manquants=[];
  for(const p of liste){
    const u=new URL(p,PORTEE);
    try{
      const r=await fetch(u.href,{cache:'no-cache'});
      if(!gardable(r))throw new Error('réponse '+r.status);
      const taille=+(r.headers.get('Content-Length')||0);
      const w=await garder(cle(u),r,true);
      if(w)await w;
      n++;octets+=taille;
    }catch(err){
      if(!(await copie(u)))manquants.push(p);
    }
  }
  return {n,octets,manquants};
}
self.addEventListener('message',e=>{
  const m=e.data||{};
  const repondre=x=>{try{e.source&&e.source.postMessage(Object.assign({source:'conceptcad-sw',version:VERSION},x));}catch(err){}};
  if(m.type==='precharger')e.waitUntil(precharger(!!m.mt).then(r=>repondre(Object.assign({type:'pret'},r)),err=>repondre({type:'pret',n:0,manquants:['?'],erreur:String(err)})));
  else if(m.type==='version')repondre({type:'version'});
});
