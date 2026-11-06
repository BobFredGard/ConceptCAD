// Site ConceptCAD (GitHub Pages) : ajoute aux réponses du site les en-têtes d'isolation que Pages n'envoie pas,
// sans lesquels le navigateur refuse les fils du noyau multicœur. Rien n'est mis en cache : chaque demande
// va au réseau comme d'habitude. Le serveur local (Server.bat) envoie lui-même ces en-têtes.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('fetch',e=>{
  const q=e.request;
  if(q.cache==='only-if-cached'&&q.mode!=='same-origin')return;
  e.respondWith(fetch(q).then(r=>{
    if(!r.status||r.type==='opaque')return r;
    const h=new Headers(r.headers);
    h.set('Cross-Origin-Opener-Policy','same-origin');
    h.set('Cross-Origin-Embedder-Policy','require-corp');
    h.set('Cross-Origin-Resource-Policy','same-origin');
    return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});
  }));
});
