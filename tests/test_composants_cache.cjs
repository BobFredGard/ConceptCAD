// V0.28.0 : instantanés des composants en cache persistant (47-assemblage-cache.js).
// Modèle seul, IndexedDB SIMULÉE en mémoire (asmCacheRead / asmCacheWrite) et instantanés
// factices (asmCachePack / asmCacheUnpack : la géométrie THREE est un leurre en VM — l'aller-
// retour réel est vérifié dans le navigateur) : clé (ce qui la change, ce qui ne la change pas),
// écriture différée, relecture à l'ouverture, composant modifié → rejoué, import et image
// partielle jamais gardés, renvoi « document tel que lu », purge des plus anciennes entrées.
// V0.28.1 : images dans le fichier (option asm.img) : export gzip, import vérifié, aller-retour.
const {loadApp}=require('./appvm.cjs');
const vm=require('vm');
(async()=>{
  const {ctx,sandbox}=loadApp();
  // ce que le navigateur fournit et que le bac à sable n'a pas : base64, gzip natif, clonage
  Object.assign(sandbox,{btoa,atob,Blob,Response,CompressionStream,DecompressionStream,TextEncoder,TextDecoder,structuredClone});
  const R=`
    const P=[];const p=s=>P.push(String(s));
    const ATT=[];const att=(ok,msg)=>{if(!ok)ATT.push(msg);else p('ok : '+msg);};
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    // ── IndexedDB simulée ──
    att(asmCacheIdbOK()===false,'0 : sans IndexedDB, cache désactivé (rien ne change)');
    const KV={};let reads=0,writes=0;
    indexedDB={};idbOpen=function(){return Promise.reject(new Error('stub'));};
    asmCacheRead=async keys=>{reads++;const o={};keys.forEach(k=>{if(k in KV)o[k]=structuredClone(KV[k]);});return o;};
    asmCacheWrite=async (puts,dels)=>{writes++;Object.keys(puts||{}).forEach(k=>{KV[k]=structuredClone(puts[k]);});(dels||[]).forEach(k=>{delete KV[k];});return true;};
    asmCachePack=s=>s&&s.exact?{items:s.items.map(it=>({tag:it.tag})),edges:null,pedges:s.pedges||null,pfaces:null,hash:s.hash}:null;
    asmCacheUnpack=(v,h)=>({items:v.items.map(it=>({tag:it.tag,geo:{dispose(){}}})),edges:null,pedges:v.pedges,pfaces:null,exact:true,hash:v.hash||h,cached:true});
    att(asmCacheIdbOK()===true,'1 : IndexedDB présente : cache actif');
    // ── clé ──
    const sk=id=>({id,name:id,plane:'XY',origin:[0,0,0],axU:[1,0,0],axV:[0,1,0],axN:[0,0,1],points:{},entities:[],constraints:[],dims:[],seq:1});
    const D=(name,dist)=>Object.assign(asmEmptyDoc(name),{sketches:[sk('s1')],features:[{id:'f1',name:'Ext',type:'extrude',body:'b1',sketchId:'s1',distance:dist,op:'add',visible:true}],
      bodies:[{id:'b1',name:'Corps 1',color:0x336699}],bodySeq:2,activeBody:'b1'});
    const k0=asmCacheKey(D('A',10));
    att(/^asnap:/.test(k0)&&k0===asmCacheKey(D('A',10)),'2 : même document → même clé');
    att(asmCacheKey(D('Autre nom',10))===k0,'3 : le nom du composant ne compte pas (même pièce dans deux assemblages)');
    att(asmCacheKey(D('A',11))!==k0,'4 : une cote change → autre clé');
    let d=D('A',10);d.bodies[0].color=0xff0000;att(asmCacheKey(d)!==k0,'5 : couleur d un corps → autre clé');
    d=D('A',10);d.bodyVis={b1:false};att(asmCacheKey(d)!==k0,'6 : corps masqué → autre clé');
    d=D('A',10);d.tint=3;att(asmCacheKey(d)!==k0,'7 : teinte → autre clé');
    d=D('A',10);d.fao={setups:[]};att(asmCacheKey(d)===k0,'8 : FAO seule : même clé (ne change pas l image)');
    d=D('A',10);d.features.push({id:'i1',type:'import',name:'STEP'});att(asmCacheKey(d)===null,'9 : import (contenu hors empreinte) : jamais en cache');
    // V0.87.0 : import qui cite sa source par l'empreinte de son contenu (corps dérivé) : en cache, la clé suit la source
    {const I=k=>{const x=D('A',10);x.features.push({id:'i2',type:'import',name:'STEP',src:{fmt:'step',key:k}});return x;};
     const kI=asmCacheKey(I('impsrc:aa_10'));
     att(kI&&kI!==k0,'9b : import avec empreinte de source : en cache, clé à part');
     att(asmCacheKey(I('impsrc:aa_10'))===kI&&asmCacheKey(I('impsrc:bb_10'))!==kI,'9c : autre source → autre clé');
     const x=I('impsrc:aa_10');x.features[x.features.length-1].visible=false;att(asmCacheKey(x)!==kI,'9d : import masqué → autre clé');}
    // ── un assemblage : racine + 3 composants ──
    asmEnsure();
    const a=asmNewComp('A').comp,b=asmNewComp('B').comp,c=asmNewComp('C').comp;
    a.doc=D('A',10);b.doc=D('B',20);c.doc=D('C',30);c.doc.features.push({id:'i1',type:'import',name:'STEP'});
    const snapOf=(x,tag)=>({items:[{tag,geo:{dispose(){}}}],edges:null,pedges:[{pts:[[0,0,0],[1,0,0]]}],pfaces:null,exact:true,hash:docHashOf(x.doc)});
    a._snap=snapOf(a,'A');b._snap=snapOf(b,'B');c._snap=snapOf(c,'C');
    [a,b,c].forEach(x=>asmCacheSoon(x));
    att(Object.keys(KV).length===0,'10 : écriture différée (rafale de rejeux : une seule écriture)');
    await wait(1400);
    att(KV[asmCacheKey(a.doc)]&&KV[asmCacheKey(b.doc)]&&!Object.keys(KV).some(k=>KV[k].items&&KV[k].items[0].tag==='C'),'11 : A et B écrits, C (import) non');
    att(KV['asnap:index']&&Object.keys(KV['asnap:index']).length===2,'12 : index des entrées à jour');
    // image partielle : marqueur temps reculé, fonction suspendue, repli maillage
    const n0=Object.keys(KV).length;
    const e=asmNewComp('E').comp;e.doc=D('E',40);
    tlMark='f1';e._snap=snapOf(e,'E');asmCacheSoon(e);tlMark=null;
    occSkipFeat='f1';asmCacheSoon(e);occSkipFeat=null;
    e._snap=Object.assign(snapOf(e,'E'),{exact:false});asmCacheSoon(e);
    await wait(1400);
    att(Object.keys(KV).length===n0,'13 : marqueur temps, fonction suspendue, repli maillage : rien n est gardé');
    // ── réouverture : A et B relus, C et E rejoués ──
    [a,b,c,e].forEach(x=>{delete x._snap;});
    const nb=await asmCacheFill();
    att(nb===2&&a._snap&&a._snap.cached&&a._snap.items[0].tag==='A'&&b._snap.items[0].tag==='B'&&!c._snap&&!e._snap,'14 : ouverture : 2 composants relus, les autres restent à rejouer ('+nb+')');
    att(a._snap.hash===docHashOf(a.doc)&&a._snap.pedges&&a._snap.pedges.length===1,'15 : empreinte et arêtes exactes relues (références des autres composants)');
    // le composant actif n'est jamais relu (il est reconstruit par l'ouverture)
    delete a._snap;const dsave=doc;doc=a.doc;
    att(await asmCacheFill()===0&&!a._snap,'16 : composant actif : pas relu du cache');
    doc=dsave;
    // composant modifié depuis : rejoué
    delete a._snap;delete b._snap;b.doc.features[0].distance=21;
    att(await asmCacheFill()===1&&a._snap&&!b._snap,'17 : B modifié (cote) : rejoué, A relu');
    // instantané marqué périmé (source d un lien relue) : relu si la clé correspond
    a._stale=true;const s0=a._snap;
    att(await asmCacheFill([a])===1&&a._snap!==s0&&!a._stale,'18 : composant périmé dont le contenu est connu : relu sans rejeu');
    // ── renvoi : document tel que lu (avant réparation) → instantané du rejeu ──
    const f=asmNewComp('F').comp;f.doc=D('F',50);
    const raw=asmCacheKey(f.doc);
    f._rawKey=raw;f.doc.features[0].distance=50.5; // la réparation + le rejeu ont changé le document
    f._snap=snapOf(f,'F');asmCacheSoon(f);delete f._rawKey;
    await wait(1400);
    att(KV[raw]&&KV[raw].alias===asmCacheKey(f.doc),'19 : renvoi écrit sous la clé du document tel que lu');
    delete f._snap;f.doc.features[0].distance=50; // réouverture du fichier
    att(await asmCacheFill([f])===1&&f._snap.items[0].tag==='F','20 : relu par le renvoi');
    // capture APRÈS l activation (modification de l utilisateur) : pas de renvoi
    const g=asmNewComp('G').comp;g.doc=D('G',60);g._snap=snapOf(g,'G');asmCacheSoon(g);
    await wait(1400);
    att(!Object.keys(KV).some(k=>KV[k].alias===asmCacheKey(g.doc)),'21 : sans activation en cours, aucun renvoi');
    // ── purge : au-delà de ASM_CACHE_MAX entrées, les plus anciennes partent ──
    const idx=KV['asnap:index'];for(let i=0;i<ASM_CACHE_MAX+5;i++){const k='asnap:vieux'+i;KV[k]={v:ASM_CACHE_V,items:[]};idx[k]=1000+i;}
    const h=asmNewComp('H').comp;h.doc=D('H',70);h._snap=snapOf(h,'H');asmCacheSoon(h);
    await wait(1400);
    const ix=KV['asnap:index'];
    att(Object.keys(ix).length===ASM_CACHE_MAX&&!('asnap:vieux0' in KV)&&('asnap:vieux'+(ASM_CACHE_MAX+4) in KV)&&KV[asmCacheKey(h.doc)],'22 : purge des plus anciennes, la nouvelle entrée reste');
    // ── images dans le fichier (V0.28.1, option asm.img) ──
    asm.img=true;
    att(asmSerial().img===true,'24 : option enregistrée avec l assemblage');
    {const s=asmSerial();const keep=asm;asmFromSerial(s);att(asm.img===true,'25 : option relue à l ouverture');asm=keep;}
    // une entrée réelle (tableaux typés) pour A, un renvoi pour F déjà présent
    const kA=asmCacheKey(a.doc);
    KV[kA]={v:ASM_CACHE_V,at:1,hash:'hA',items:[{pos:new Float32Array([1,2,3,4,5,6,7,8,9]),nor:null,idx:new Uint16Array([0,1,2]),color:0x336699,bid:'b1'}],
      edges:{pos:new Float32Array([0,0,0,1,1,1]),col:new Float32Array([0,0,0,0,0,0])},pedges:[{pts:[[0,0,0],[1,0,0]]}],pfaces:null};
    const kF=asmCacheKey(f.doc),kFt=KV[raw]&&KV[raw].alias; // F rouvert tel que lu : clé = renvoi
    KV[kFt]={v:ASM_CACHE_V,at:1,hash:'hF',items:[{pos:new Float32Array([0,0,0,1,0,0,0,1,0]),nor:null,idx:null,color:1,bid:'b1'}],edges:null,pedges:null,pfaces:null};
    const X=await asmCacheExport();
    att(X&&X.v===ASM_CACHE_V&&X.z==='gzip'&&typeof X.bin==='string'&&typeof X.meta==='string','26 : export compressé (gzip, base64)');
    // autre poste : cache vide
    Object.keys(KV).forEach(k=>{delete KV[k];});
    const nI=await asmCacheImport(JSON.parse(JSON.stringify(X)));
    const eA=KV[kA];
    att(nI>=2&&eA&&eA.items[0].pos instanceof Float32Array&&Array.from(eA.items[0].pos).join()==='1,2,3,4,5,6,7,8,9'&&eA.items[0].idx instanceof Uint16Array&&Array.from(eA.items[0].idx).join()==='0,1,2'
      &&eA.edges.pos.length===6&&eA.pedges[0].pts[1][0]===1&&eA.hash==='hA','27 : import : tableaux typés et données relus à l identique ('+nI+')');
    att(kF===raw&&KV[raw]&&KV[raw].alias===kFt&&KV[kFt]&&KV[kFt].hash==='hF','28 : renvoi et sa cible voyagent ensemble');
    att(KV['asnap:index']&&kA in KV['asnap:index'],'29 : entrées importées indexées (purge)');
    delete a._snap;att(await asmCacheFill([a])===1&&a._snap.cached,'30 : composant relu depuis l image du fichier');
    // fichier abîmé ou d un autre format : ignoré
    Object.keys(KV).forEach(k=>{delete KV[k];});
    att(await asmCacheImport(Object.assign({},X,{v:99}))===0&&!Object.keys(KV).length,'31 : autre format : ignoré');
    att(await asmCacheImport(Object.assign({},X,{bin:'@@@'}))===0,'32 : binaire illisible : ignoré');
    const Y=Object.assign({},X,{z:'',meta:{[kA]:{v:ASM_CACHE_V,items:[{pos:{$t:'f32',o:0,n:999999}}]},'pas:une-cle':{v:ASM_CACHE_V,items:[]}},bin:'AAAA'});
    att(await asmCacheImport(Y)===0&&!Object.keys(KV).length,'33 : tableau hors du bloc binaire, clé étrangère : ignorés');
    asm.img=false;delete asm.img;
    // ── erreurs d IndexedDB : sans cache, sans casser ──
    asmCacheRead=async()=>{throw new Error('quota');};
    delete h._snap;
    att(await asmCacheFill([h])===0,'23 : lecture impossible : rejeu normal');
    if(ATT.length){p('ECHECS ('+ATT.length+') :');ATT.forEach(m=>p('  x '+m));}
    else p('TOUT EST CONFORME');
    return P.join(String.fromCharCode(10));
  `;
  const r=await vm.runInContext('(async()=>{'+R+'})()',ctx,{filename:'cache.js'});
  console.log(r);
  process.exit(/ECHECS|  x /.test(r)?1:0);
})().catch(e=>{console.error('ECHEC',String((e&&e.stack)||e).slice(0,800));process.exit(1);});
