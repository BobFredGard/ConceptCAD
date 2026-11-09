/* ---------- Dérivée : paramètres et corps venus d'un autre fichier (V0.47.0) ----------
   Comme la fonction « Dérivée » de Fusion 360 : un fichier SOURCE donne ses paramètres et ses
   corps à d'autres fichiers. Le lien va dans UN SEUL SENS : rien de ce qui se fait dans le
   fichier récepteur ne revient vers la source.
     · doc.derive = [{id, rel, key, name, sig, auto, params:[{src, name, value, miss}]}]
       rel / key : comment retrouver la source (comme les composants liés, 47) ; sig : empreinte
       de son texte à la dernière lecture ; auto : les paramètres ajoutés à la source arrivent
       d'eux-mêmes ; params : copie des valeurs, le fichier s'ouvre donc sans la source.
     · Paramètre dérivé : kind 'dparam' de parAll (51), utilisable partout, modifiable seulement
       dans la source. Un nom déjà pris ici reçoit un suffixe (L → L_2) ; le lien suit le nom
       d'origine (src). Disparu de la source : dernière valeur gardée, ⚠.
     · Corps dérivé : une fonction 'import' (STEP écrit depuis le solide de la source) dans un
       corps neuf, avec f.derive = {lk, key, name}. Tout ce qui marche sur un import marche donc
       ici : congés, perçages, déplacement, Combiner… ; ces fonctions sont placées APRÈS lui et
       sont rejouées sur la nouvelle forme quand la source change : les modifications faites
       dans le fichier récepteur sont gardées. La source n'est jamais réécrite.
     · L.cw : ce qui manque dans la source lue (corps, paramètre disparu) ; L.st / L.msg : état
       affiché, qui y ajoute les problèmes d'accès au fichier.
     · Vérification : ouverture, retour sur l'onglet ou la fenêtre, bouton 🔄. */
let derRun=null,derCkPre=null; // derRun : vérification en cours ; derCkPre : préfixe des points de contrôle pendant le rejeu d'une source
function derClean(list){
  // Pour le fichier : sans l'état d'exécution (st, msg, _lm…), recalculé à chaque vérification
  if(!Array.isArray(list)||!list.length)return undefined;
  return list.map(L=>({id:L.id,rel:L.rel||null,key:L.key||null,name:L.name,sig:L.sig||'',auto:!!L.auto,cw:L.cw||undefined,
    params:(L.params||[]).map(p=>{const q={src:p.src,name:p.name,value:p.value};if(p.miss)q.miss=true;return q;})}));
}
function derOk(L){L.st=L.cw?'warn':'ok';L.msg=L.cw||'';}
function derLinkOf(f,d){return f&&f.derive?((d||doc).derive||[]).find(L=>L.id===f.derive.lk)||null:null;}
function derParse(txt){
  let b;try{b=JSON.parse(txt);}catch(e){throw new Error('fichier illisible');}
  const top=(b&&b.bundle===1&&b.doc)?b.doc:b;
  if(!top||!Array.isArray(top.features))throw new Error('ce n’est pas un projet ConceptCAD');
  return {b,top};
}
function derWithDoc(d,fn){
  // Exécute fn avec d comme document courant, sans rien afficher (solide de la source, valeurs).
  // occStepForce : un corps fait d'un seul import donne aussi son solide exact.
  const bd=doc,bs=occSkipFeat,bf=occStepForce;
  doc=d;occSkipFeat=null;occStepForce=true;
  try{return fn();}finally{doc=bd;occSkipFeat=bs;occStepForce=bf;}
}
function derTree(top){
  // Arbre de composants de la source, réparé comme à l'ouverture d'un fichier
  const t=asmTreeOfFile(top);
  t.comps.forEach(c=>derWithDoc(c.doc,()=>{
    try{ensureBodies();}catch(e){}
    try{(doc.sketches||[]).forEach(migrateSketch);resolveAllSketchHosts();}catch(e){}
    try{docSanitise();}catch(e){}
    try{doc.features.filter(f=>f.type==='repeat').forEach(f=>repGenChildren(f));}catch(e){}
  }));
  return t;
}
function derInstances(t){
  // Chaque instance de composant de la source, avec son repère dans la racine
  const by=new Map(t.comps.map(c=>[c.id,c])),out=[];
  const walk=(c,F,path,names,n)=>{
    if(!c||n>32)return;
    out.push({comp:c,F,path,names});
    (c.occ||[]).forEach(o=>{if(o.visible===false)return;
      walk(by.get(o.comp),o.fr?asmCompose(F,o.fr):F,path.concat(o.id),names.concat(o.name||''),n+1);});
  };
  walk(by.get(t.root),asmFr0(),[],[],0);
  return out;
}
function derBodies(t){
  // Corps que la source peut donner : ceux qui ont des fonctions et existent à la fin de la
  // timeline (un corps outil consommé par Combiner n'en fait plus partie). Corps masqués compris.
  const out=[];
  derInstances(t).forEach(inst=>{
    const d=inst.comp.doc,F=(d.features||[]).filter(f=>f&&f.visible!==false),b0=d.bodies&&d.bodies[0]&&d.bodies[0].id;
    const gone=new Set(),has=new Set();
    F.forEach(f=>{
      if(f.type==='combine'&&!f.keep)(f.tools||[]).forEach(x=>gone.add(x));
      if(f.type==='bremove'&&f.body)gone.add(f.body);
      has.add(f.body||b0);if(f.newBody)has.add(f.newBody);if(Array.isArray(f.newBodies))f.newBodies.forEach(x=>has.add(x));
    });
    (d.bodies||[]).forEach(e=>{
      if(!has.has(e.id)||gone.has(e.id))return;
      out.push({key:inst.path.join('/')+'#'+e.id,name:inst.names.concat([e.name]).join(' › '),bid:e.id,inst,color:e.color});
    });
  });
  return out;
}
function derReadParams(d){
  // Valeurs nommées d'un document : paramètres libres, cotes et valeurs de fonctions nommées
  return derWithDoc(d,()=>{const o=[];
    parAll().forEach((e,nm)=>{let v=NaN;try{v=parValueNow(nm);}catch(x){}
      if(isFinite(v))o.push({name:nm,value:v,free:e.kind==='param'||e.kind==='dparam'});});
    return o;});
}
function derStepSig(u8){
  // Empreinte d'un STEP SANS son en-tête (date d'écriture) ni le compteur d'écritures du noyau
  // (« Open CASCADE STEP translator 7.4 12 ») : même solide, même empreinte
  let i=0;const n=u8.length;
  for(;i<n-5;i++)if(u8[i]===68&&u8[i+1]===65&&u8[i+2]===84&&u8[i+3]===65&&u8[i+4]===59)break; // « DATA; »
  let t='';for(let k=i;k<n;k+=0x8000)t+=String.fromCharCode.apply(null,u8.subarray(k,Math.min(n,k+0x8000)));
  return asmHash(t.replace(/STEP translator [\d.]+ \d+/g,''));
}
async function derReplay(t,keys){
  // Rejoue les composants utiles de la source sans l'afficher → Map(clé du corps → octets STEP)
  const out=new Map(),all=derBodies(t).filter(x=>keys.includes(x.key)),comps=[...new Set(all.map(x=>x.inst.comp))];
  for(const c of comps){
    const d=c.doc,imps=(d.features||[]).filter(f=>f&&f.type==='import'&&f.src&&f.src.key);
    const u8s=new Map();for(const f of imps){const u=await importSrcGet(f.src.key);if(u)u8s.set(f.id,u);}
    // imports de la source : posés le temps du rejeu (un identifiant peut exister aussi ici)
    const kept=new Map();
    imps.forEach(f=>{if(!u8s.has(f.id))return;kept.set(f.id,importGeom.get(f.id));
      try{importGeom.set(f.id,importStepBuild(u8s.get(f.id)));}catch(e){}});
    let FR=null;derCkPre='der§'+c.id+'§';
    try{
      FR=derWithDoc(d,()=>occFinalShape(null));
      all.filter(x=>x.inst.comp===c).forEach(x=>{
        const p=(FR.perBody||[]).find(q=>q.bodyId===x.bid);if(!p||!p.shape)return;
        const placed=asmIsIdentity(x.inst.F)?null:asmPlaced(p.shape,x.inst.F);
        try{const b=occWriteStep([placed||p.shape],'/d.stp','AP214',false);if(b)out.set(x.key,Uint8Array.from(b));}
        finally{if(placed){try{placed.delete();}catch(e){}}}
      });
    }finally{
      derCkPre=null;
      try{if(FR)occCleanup(FR,null);}catch(e){}
      kept.forEach((old,id)=>{const e=importGeom.get(id);
        if(e!==old)derEntryFree(e);
        if(old)importGeom.set(id,old);else importGeom.delete(id);});
    }
  }
  return out;
}
function derFreeName(d,nm){
  const pris=derWithDoc(d,()=>parAll());
  if(!pris.has(nm))return nm;
  let k=2;while(pris.has(nm+'_'+k))k++;return nm+'_'+k;
}
function derSyncParams(d,L,list){
  // Reporte les valeurs de la source → true si quelque chose a changé pour ce document
  let ch=false;
  L.params=L.params||[];
  L.params.forEach(p=>{
    const s=list.find(x=>x.name===p.src);
    if(!s){if(!p.miss){p.miss=true;ch=true;}return;}
    if(p.miss){delete p.miss;ch=true;}
    if(Math.abs((+p.value||0)-s.value)>1e-12){p.value=s.value;ch=true;}
  });
  if(L.auto)list.forEach(s=>{if(!L.params.some(p=>p.src===s.name)){L.params.push({src:s.name,name:derFreeName(d,s.name),value:s.value});ch=true;}});
  return ch;
}
function derEntryFree(e){
  try{if(e&&e.mesh&&e.mesh.geometry)e.mesh.geometry.dispose();}catch(x){}
  try{if(e&&e.faoGeo&&e.faoGeo.dispose)e.faoGeo.dispose();}catch(x){}
  try{if(e&&e.brep)e.brep.delete();}catch(x){}
}
async function derApplySource(d,L,txt){
  // La source a changé (ou un corps n'a plus de géométrie) : paramètres et corps mis à jour.
  // → {changed, olds (géométries à libérer après le rejeu)}
  const {b,top}=derParse(txt);
  if(b&&b.bundle===1){try{await bundleStoreCaches(b);}catch(e){}}
  const t=derTree(top),root=t.comps.find(c=>c.id===t.root);
  let changed=derSyncParams(d,L,derReadParams(root.doc));
  const olds=[];let lost=[];
  const fs=(d.features||[]).filter(f=>f&&f.type==='import'&&f.derive&&f.derive.lk===L.id);
  if(fs.length){
    const bytes=await derReplay(t,fs.map(f=>f.derive.key));
    for(const f of fs){
      const u=bytes.get(f.derive.key);
      if(!u){lost.push(f.derive.name||f.name);continue;}
      const sig=derStepSig(u);
      if(f.src&&f.src.sig===sig&&importGeom.has(f.id))continue; // autre chose a changé dans la source
      const key=importSrcKey(u);await importSrcPut(key,u);
      const e=importStepBuild(u),old=importGeom.get(f.id);
      importGeom.set(f.id,e);f._mesh=e.mesh;
      f.src={fmt:'step',key,size:u.length,file:L.name,sig};
      if(old)olds.push(old);
      changed=true;
    }
  }
  L.sig=asmHash(txt);
  const miss=(L.params||[]).filter(p=>p.miss).map(p=>p.src);
  L.cw=(lost.length?'corps disparu(s) de la source : '+lost.join(', ')+' (dernière forme gardée)':'')
    +(lost.length&&miss.length?' ; ':'')+(miss.length?'paramètre(s) disparu(s) de la source : '+miss.join(', ')+' (dernière valeur gardée)':'');
  derOk(L);
  return {changed,olds};
}
function derDocs(){
  // Documents qui dérivent d'un fichier. Un composant lié (47) a son propre fichier : c'est à
  // l'ouverture de celui-ci que ses dérivées se mettent à jour.
  if(asm)return asm.comps.filter(c=>!c.link&&!c.of&&c.doc&&c.doc.derive&&c.doc.derive.length).map(c=>({c,d:c.doc}));
  return doc.derive&&doc.derive.length?[{c:null,d:doc}]:[];
}
function derPrune(d){
  // Plus aucun paramètre ni corps venu de ce fichier : le lien n'a plus de raison d'être
  d.derive=(d.derive||[]).filter(L=>(L.params||[]).length||(d.features||[]).some(f=>f&&f.derive&&f.derive.lk===L.id));
}
function derAfterUpdate(d,c){
  if(d===doc){
    builtVersion=-1;builtHash=null;
    parAfterChange();
    // géométrie remplacée depuis le disque : les annulations qui la citaient ne valent plus
    docUndoStack.length=0;docRedoStack.length=0;
    try{docBaseSync();docUndoUI();}catch(e){}
    try{renderTree();renderProps();}catch(e){}
    try{buildEdgeOverlay();}catch(e){}
  }else{
    derWithDoc(d,()=>{try{parApplyAll();}catch(e){}});
    if(c){c._stale=true;if(c._rt){c._rt.undo=[];c._rt.redo=[];}} // (sans composant : un autre fichier a été ouvert entre-temps)
    dirty=true;
  }
}
async function derCheck(ask){
  // ask : clic de l'utilisateur (une autorisation peut être demandée). Les vérifications passent
  // l'une après l'autre : un clic pendant celle de l'ouverture n'est pas perdu.
  while(derRun){try{await derRun;}catch(e){}}
  derRun=derCheckRun(ask);
  try{return await derRun;}finally{derRun=null;}
}
async function derCheckRun(ask){
  const out={updated:[],warn:[]};
  const D=derDocs();if(!D.length)return out;
  let others=false;const olds=[];
  {
    try{await importRestorePending();}catch(e){}
    for(const {c,d} of D){
      derPrune(d);
      let ch=false;
      for(const L of d.derive||[]){
        const fs=(d.features||[]).filter(f=>f&&f.derive&&f.derive.lk===L.id);
        if(fs.length&&!occHas()){L.st='warn';L.msg='noyau de calcul pas encore prêt';out.warn.push(L.name);continue;}
        const r=await asmLinkHandle({link:L},ask,'read'); // la source n'est que lue
        if(!r.h){L.st='warn';L.msg=r.why;out.warn.push(L.name);continue;}
        let f,txt;
        try{f=await r.h.getFile();}catch(e){L.st='warn';L.msg='lecture impossible';out.warn.push(L.name);continue;}
        const entier=fs.every(x=>importGeom.has(x.id));
        if(entier&&asmLinkStampSame({link:L},f)){derOk(L);continue;}
        try{txt=await mffFileText(f);}catch(e){L.st='warn';L.msg='lecture impossible';out.warn.push(L.name);continue;}
        if(entier&&asmHash(txt)===L.sig){asmLinkStamp({link:L},f);derOk(L);continue;}
        try{
          const R=await derApplySource(d,L,txt);
          asmLinkStamp({link:L},f);olds.push(...R.olds);
          if(R.changed){ch=true;out.updated.push(L.name);}
          if(L.st==='warn')out.warn.push(L.name);
        }catch(e){L.st='warn';L.msg=String(e&&e.message||e);out.warn.push(L.name);}
      }
      if(ch){derAfterUpdate(d,c);if(d!==doc)others=true;}
    }
    if(others){try{asmBuildSnapshots();asmNotify();}catch(e){}}
    olds.forEach(derEntryFree);
  }
  try{renderTree();renderProps();}catch(e){}
  parMiniSoon();
  if(out.updated.length){try{faceEl.textContent='Dérivée mise à jour depuis : '+[...new Set(out.updated)].join(', ')+'.';}catch(e){}}
  if(ask&&out.warn.length&&!out.updated.length)await derWarnAsk();
  return out;
}
async function derWarnAsk(){
  // Clic sur 🔄 sans mise à jour possible : la raison, et de quoi la lever
  const W=[];derDocs().forEach(({d})=>(d.derive||[]).forEach(L=>{if(L.st==='warn')W.push(L);}));
  if(!W.length)return;
  const NL=String.fromCharCode(10),noDir=MFF_FS&&W.some(L=>L.rel&&!mffFolder);
  const B=[];
  if(noDir)B.push(['folder','Choisir le dossier de projets…',true]);
  else if(W.some(L=>/autoriser/.test(L.msg||'')))B.push(['retry','Autoriser l’accès',true]);
  if(MFF_FS)B.push(['relink','Désigner les fichiers sources…',!B.length]);
  B.push(['cancel','Fermer']);
  const c=await mffAsk('Dérivées à vérifier :'+NL+W.map(L=>'• '+L.name+' : '+(L.msg||'non vérifiée')).join(NL),B);
  if(c==='folder'){if(await mffFolderChoose())await derCheck(true);return;}
  if(c==='retry'){await derCheck(true);return;}
  if(c==='relink')for(const L of W)await derRelink(L);
}
async function derRelink(L){
  // Source déplacée ou renommée : désigner le nouveau fichier
  const p=await asmPickSource();if(!p)return false;
  const ref=await asmLinkRef(p.h);
  L.rel=ref.rel;L.key=ref.key;L.name=p.name;asmLinkStamp({link:L},null);L.sig='';
  markDirty();
  await derCheck(false);
  return true;
}
function derBreak(L){
  // Rompre : les valeurs deviennent des paramètres d'ici, les corps gardent leur forme actuelle
  docPushUndo('rompre la dérivée « '+L.name+' »');
  if(!Array.isArray(doc.params))doc.params=[];
  (L.params||[]).forEach(p=>doc.params.push({name:p.name,expr:String(p.value),value:p.value}));
  (doc.features||[]).forEach(f=>{if(f&&f.derive&&f.derive.lk===L.id)delete f.derive;});
  doc.derive=(doc.derive||[]).filter(q=>q!==L);
  parAfterChange();
  try{renderTree();renderProps();}catch(e){}
  parMiniSoon();
}
async function derSameLink(h){
  for(const L of doc.derive||[]){
    try{const r=await asmLinkHandle({link:L},false,'read');if(r.h&&await r.h.isSameEntry(h))return L;}catch(e){}
  }
  return null;
}
async function derInsert(h,txt,name,choice){
  // Dérive dans le document courant. choice = {params:[noms], bodies:[clés], auto}
  const {b,top}=derParse(txt);
  if(b&&b.bundle===1){try{await bundleStoreCaches(b);}catch(e){}}
  const t=derTree(top),root=t.comps.find(c=>c.id===t.root);
  const wanted=derBodies(t).filter(x=>(choice.bodies||[]).includes(x.key));
  if(wanted.length&&!occHas())throw new Error('le noyau de calcul n’est pas encore prêt');
  const bytes=wanted.length?await derReplay(t,wanted.map(x=>x.key)):new Map();
  const vide=wanted.filter(x=>!bytes.has(x.key)).map(x=>x.name);
  const built=[];
  for(const x of wanted){
    if(!bytes.has(x.key))continue;
    const u=bytes.get(x.key),key=importSrcKey(u);await importSrcPut(key,u);
    built.push({x,u,key,e:importStepBuild(u)});
  }
  docPushUndo('dériver depuis « '+name+' »');
  if(!Array.isArray(doc.derive))doc.derive=[];
  let L=await derSameLink(h);
  if(!L){
    const ref=await asmLinkRef(h);
    L={id:uid('dv'),rel:ref.rel,key:ref.key,name,sig:'',auto:!!choice.auto,params:[]};
    doc.derive.push(L);
  }else if(choice.auto)L.auto=true;
  const list=derReadParams(root.doc);
  (choice.params||[]).forEach(nm=>{
    const s=list.find(q=>q.name===nm);
    if(s&&!L.params.some(p=>p.src===nm))L.params.push({src:nm,name:derFreeName(doc,nm),value:s.value});
  });
  derSyncParams(doc,L,list);
  L.sig=asmHash(txt);derOk(L);
  try{ensureBodies();}catch(e){}
  const ids=[];
  built.forEach(({x,u,key,e})=>{
    const seq=+doc.bodySeq||1;doc.bodySeq=seq+1;
    const bid='b'+seq,base=x.name.split(' › ').pop();
    const fiche={id:bid,name:base,c:null,open:true};if(x.color>0)fiche.color=x.color;
    doc.bodies.push(fiche);
    const id=uid('im');importGeom.set(id,e);
    const nf={id,type:'import',name:base+' (dérivé)',visible:true,body:bid,_mesh:e.mesh,
      src:{fmt:'step',key,size:u.length,file:name,sig:derStepSig(u)},derive:{lk:L.id,key:x.key,name:x.name}};
    const i=tlIdx();if(i<0)doc.features.push(nf);else doc.features.splice(i,0,nf);
    ids.push(id);
  });
  builtVersion=-1;builtHash=null;
  parAfterChange();
  try{renderTree();renderProps();}catch(e){}
  parMiniSoon();
  const nP=(L.params||[]).length;
  try{faceEl.textContent='Dérivé de '+name+' : '+nP+' paramètre(s), '+ids.length+' corps.'+(ids.length?' Pour soustraire : Combiner → Soustraction, avec ce corps comme outil.':'')+(vide.length?' ⚠ Sans solide : '+vide.join(', ')+'.':'');}catch(e){}
  return {link:L,features:ids,empty:vide};
}
function derPickDlg(name,params,bodies){
  // Choix de ce qui est dérivé → {params, bodies, auto} ou null
  return new Promise(res=>{
    let ov=document.getElementById('derDlg');if(ov)ov.remove();
    ov=document.createElement('div');ov.id='derDlg';
    ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center';
    const box=document.createElement('div');
    box.style.cssText='background:#1c1c20;color:#e8e8ea;border:1px solid #3a3a40;border-radius:10px;padding:14px 16px;min-width:380px;max-width:92vw;max-height:80vh;overflow:auto;font-size:13px;box-shadow:0 14px 40px rgba(0,0,0,.6)';
    const fin=v=>{ov.remove();res(v);};
    const t=document.createElement('div');t.innerHTML='<b style="font-size:15px">🔗 Dériver</b>';
    const s=document.createElement('div');s.style.cssText='opacity:.75;margin:4px 0 10px';s.textContent='Depuis '+name+'. Le lien va dans un seul sens : ce que vous ferez ici ne change pas la source.';
    box.appendChild(t);box.appendChild(s);
    const liste=(titre,items,label,val)=>{
      const out=[];if(!items.length)return out;
      const h=document.createElement('div');h.style.cssText='font-weight:600;margin:8px 0 4px';h.textContent=titre;box.appendChild(h);
      items.forEach(o=>{const l=document.createElement('label');l.style.cssText='display:flex;gap:7px;align-items:center;padding:2px 0;cursor:pointer';
        const c=document.createElement('input');c.type='checkbox';c.checked=val(o);l.appendChild(c);
        const n=document.createElement('span');n.textContent=label(o);l.appendChild(n);box.appendChild(l);out.push({o,c});});
      return out;
    };
    const fmt=v=>String(+(+v).toFixed(4)).replace('.',',');
    const P=liste('Paramètres',params,o=>o.name+' = '+fmt(o.value),()=>true);
    const B=liste('Corps',bodies,o=>o.name,()=>false);
    if(!params.length&&!bodies.length){const n=document.createElement('div');n.textContent='Ce fichier n’a ni paramètre nommé ni corps à dériver.';box.appendChild(n);}
    const bar=document.createElement('div');bar.style.cssText='display:flex;gap:8px;justify-content:flex-end;margin-top:12px';
    const no=document.createElement('button');no.textContent='Annuler';no.onclick=()=>fin(null);
    const ok=document.createElement('button');ok.id='derOk';ok.className='primary';ok.textContent='Dériver';
    ok.onclick=()=>{
      const ps=P.filter(x=>x.c.checked).map(x=>x.o.name),bs=B.filter(x=>x.c.checked).map(x=>x.o.key);
      if(!ps.length&&!bs.length)return;
      fin({params:ps,bodies:bs,auto:ps.length===params.length});
    };
    bar.appendChild(no);bar.appendChild(ok);box.appendChild(bar);
    ov.appendChild(box);
    ov.addEventListener('mousedown',e=>{if(e.target===ov)fin(null);});
    ov.addEventListener('keydown',e=>{if(e.key==='Escape')fin(null);e.stopPropagation();});
    document.body.appendChild(ov);
  });
}
async function derCmdInsert(){
  if(typeof skEdit!=='undefined'&&skEdit){try{faceEl.textContent='Fermez d’abord l’esquisse.';}catch(e){}return null;}
  const p=await asmPickSource();if(!p)return null;
  try{if(mffHandle&&await mffHandle.isSameEntry(p.h)){alert('Un fichier ne peut pas dériver de lui-même.');return null;}}catch(e){}
  try{
    const {b,top}=derParse(p.txt);
    if(b&&b.bundle===1){try{await bundleStoreCaches(b);}catch(e){}}
    const t=derTree(top),root=t.comps.find(c=>c.id===t.root);
    const choice=await derPickDlg(p.name,derReadParams(root.doc),derBodies(t));
    if(!choice)return null;
    return await derInsert(p.h,p.txt,p.name,choice);
  }catch(e){alert('Dérivée impossible : '+(e&&e.message||e));return null;}
}
function derProps(p,f){
  // Fiche d'un corps dérivé (panneau de droite)
  if(!f||!f.derive)return;
  const L=derLinkOf(f);
  const n=document.createElement('div');n.className='note';n.style.margin='6px 0';
  n.textContent='🔗 Dérivé de '+(L?L.name:'?')+' — '+(f.derive.name||'')+'. Suit la source ; les fonctions ajoutées ici à ce corps sont gardées.';
  p.appendChild(n);
  if(L&&L.st==='warn'){const w=document.createElement('div');w.className='note';w.style.color='var(--warn,#ff9f0a)';w.textContent='⚠ '+(L.msg||'non vérifiée');p.appendChild(w);}
  if(!L)return;
  const r=document.createElement('div');r.className='row';r.style.marginTop='6px';
  const a=document.createElement('button');a.textContent='🔄 Mettre à jour';a.onclick=()=>derCheck(true);r.appendChild(a);
  const c=document.createElement('button');c.textContent='✂ Rompre le lien';c.title='Ce corps garde sa forme actuelle et ne suit plus la source';c.onclick=()=>derBreak(L);r.appendChild(c);
  p.appendChild(r);
}
function derDlgSection(box,redo){
  // Liste complète des paramètres : les fichiers dont celui-ci dérive
  const h=document.createElement('div');h.style.cssText='margin-top:12px;font-weight:600';h.textContent='🔗 Dérivées';box.appendChild(h);
  (doc.derive||[]).forEach(L=>{
    const r=document.createElement('div');r.style.cssText='display:flex;gap:8px;align-items:center;margin-top:4px';
    const t=document.createElement('span');t.style.flex='1';t.textContent=(L.st==='warn'?'⚠ ':'')+(L.rel||L.name)+(L.st==='warn'&&L.msg?' — '+L.msg:'');r.appendChild(t);
    const b1=document.createElement('button');b1.textContent='🔄';b1.title='Vérifier maintenant';b1.onclick=async()=>{await derCheck(true);redo();};r.appendChild(b1);
    const b2=document.createElement('button');b2.textContent='✂ Rompre';b2.title='Les valeurs deviennent des paramètres d’ici, les corps gardent leur forme';b2.onclick=()=>{derBreak(L);redo();};r.appendChild(b2);
    box.appendChild(r);
  });
  const add=document.createElement('button');add.style.marginTop='6px';add.textContent='+ Dériver depuis un fichier…';
  add.onclick=async()=>{await derCmdInsert();redo();};box.appendChild(add);
}
/* ── mini-liste des paramètres, dans le bandeau de droite ──
   Clic gauche sur ƒx : l'affiche ou la masque. Clic droit : la liste complète (51). Le bandeau
   étant masqué sur écran étroit, le clic gauche y ouvre directement la liste complète.
   V0.47.1 : les valeurs se modifient sur place. Au clic, le champ montre l'expression (valeur,
   formule) ; Entrée ou la sortie du champ valident, Échap annule. Un paramètre dérivé et une cote
   de référence restent en lecture seule. */
let parMiniT=null;
function parMiniEl(){return document.getElementById('parMini');}
function parMiniOpen(){const e=parMiniEl();return !!e&&e.style.display!=='none';}
function parMiniSoon(){
  // Différé : une rafale de modifications ne recalcule la liste qu'une fois
  if(!parMiniOpen()||parMiniT)return;
  parMiniT=setTimeout(()=>{parMiniT=null;try{parMiniRender();}catch(e){}},80);
}
function parMiniRows(){
  const fmt=v=>isFinite(v)?String(+(+v).toFixed(4)).replace('.',','):'';
  const brut=v=>String(+(+v).toFixed(12)).replace('.',','); // texte à éditer : toute la précision
  const rows=[];
  (doc.derive||[]).forEach(L=>(L.params||[]).forEach(p=>rows.push({name:p.name,val:fmt(p.value),title:'Dérivé de '+L.name+(p.miss?' — disparu de la source':' — à modifier dans ce fichier'),link:true,warn:!!p.miss})));
  (doc.params||[]).forEach(p=>{if(p&&p.name)rows.push({name:p.name,val:p.err?'':fmt(p.value),title:p.err||String(p.expr==null?'':p.expr),warn:!!p.err,
    edit:String(p.expr==null?'':p.expr),set:ex=>parSetParam(p,ex)});});
  (doc.sketches||[]).forEach(sk=>(sk.dims||[]).forEach(d=>{if(!d||!d.name)return;
    rows.push({name:d.name,val:fmt(parDimUser(d))+(d.type==='angle'?'°':''),title:(sk.name||sk.id)+' · cote'+(d.ref?' de référence (mesurée, non modifiable)':'')+(d.expr?' : '+d.expr:''),warn:!!d.exprErr,
      edit:d.expr?String(d.expr):brut(parDimUser(d)),set:d.ref?null:ex=>parSetDim(sk,d,ex)});}));
  parHolders().forEach(({h,f})=>{if(!h.pname)return;Object.keys(h.pname).forEach(k=>{const nm=h.pname[k];if(!nm)return;
    let v=NaN;try{v=parHolderVal(h,k);}catch(e){}
    rows.push({name:nm,val:fmt(v)+(/angle|draft/.test(k)?'°':''),title:(f.name||f.id)+(h.expr&&h.expr[k]?' : '+h.expr[k]:''),warn:!!(h.exprErr&&h.exprErr[k]),
      edit:h.expr&&h.expr[k]?String(h.expr[k]):brut(v),set:ex=>parSetFeat(h,k,f,ex)});});});
  return rows;
}
let parMiniBusy=false; // liste en reconstruction : la perte de focus qui en résulte ne valide rien
function parMiniShow(inp){
  const r=inp._row;
  inp.value=r.val||r.edit||'';
  inp.style.color=r.warn?'var(--warn,#ff9f0a)':'';
}
function parMiniErr(m){
  const e=(parMiniEl()||document).querySelector('.parMiniE');if(!e)return;
  e.textContent=m?'⚠ '+m:'';e.style.display=m?'':'none';
}
function parMiniCommit(inp){
  if(parMiniBusy||inp._start==null)return;
  const s=String(inp.value).trim(),start=inp._start;inp._start=null;
  if(!s||s===start){parMiniShow(inp);return;}
  const nm=inp._row.name,r=inp._row.set(s);
  if(r!==true){parMiniErr(nm+' : '+r);parMiniShow(inp);return;}
  parMiniErr('');
  parAfterChange(true);
  parMiniRender();
}
function parMiniField(){
  const inp=document.createElement('input');inp.type='text';inp.className='parMiniI';inp.spellcheck=false;
  inp.dataset.fxac=''; // liste des noms pendant la frappe (51)
  inp.addEventListener('focus',()=>{parMiniErr('');inp._start=inp._row.edit;inp.value=inp._start;inp.style.color='';inp.select();});
  inp.addEventListener('blur',()=>parMiniCommit(inp));
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();parMiniCommit(inp);inp.blur();}
    else if(e.key==='Escape'){inp._start=null;parMiniShow(inp);inp.blur();}
    e.stopPropagation(); // les lettres tapées ne déclenchent aucun raccourci
  });
  return inp;
}
function parMiniRender(){
  const el=parMiniEl();if(!el)return;
  const body=el.querySelector('.parMiniB');if(!body)return;
  const rows=parMiniRows();
  const sig=rows.map(r=>r.name+(r.set?'':'#')).join('\n');
  if(body._sig!==sig){
    // Lignes changées : reconstruction, sans perdre une saisie en cours
    const act=document.activeElement,keep=act&&act.classList&&act.classList.contains('parMiniI')&&body.contains(act)?{name:act._row.name,txt:act.value,start:act._start}:null;
    parMiniBusy=true;
    body.innerHTML='';
    parMiniBusy=false;
    body._sig=sig;
    if(!rows.length){const n=document.createElement('span');n.className='note';n.textContent='Aucun paramètre. Clic droit sur ƒx : liste complète.';body.appendChild(n);}
    rows.forEach(r=>{
      const d=document.createElement('div');d.className='parMiniR';
      const a=document.createElement('span');a.className='parMiniN';d.appendChild(a);
      if(r.set){const i=parMiniField();i._row=r;d.appendChild(i);}
      else{const b=document.createElement('span');b.className='parMiniV';d.appendChild(b);}
      body.appendChild(d);
    });
    if(keep){const i=[...body.querySelectorAll('.parMiniI')].find(x=>x._row.name===keep.name);
      if(i){i.focus();i.value=keep.txt;i._start=keep.start;}}
  }
  rows.forEach((r,n)=>{
    const d=body.children[n];d.title=r.title||'';
    d.querySelector('.parMiniN').textContent=(r.link?'🔗 ':'')+r.name;
    const i=d.querySelector('.parMiniI');
    if(i){i._row=r;if(document.activeElement!==i)parMiniShow(i);return;}
    const b=d.querySelector('.parMiniV');b.textContent=(r.warn?'⚠ ':'')+r.val;b.style.color=r.warn?'var(--warn,#ff9f0a)':'';
  });
  const up=el.querySelector('.parMiniUp');
  if(up){const liens=derDocs().length>0&&(doc.derive||[]).length>0;up.style.display=liens?'':'none';
    up.textContent=(doc.derive||[]).some(L=>L.st==='warn')?'⚠':'🔄';}
}
function parMiniBuild(){
  let el=parMiniEl();if(el)return el;
  const side=document.querySelector('aside.right');if(!side)return null;
  el=document.createElement('div');el.id='parMini';el.className='panel';el.style.display='none';
  const css=document.createElement('style');
  css.textContent='#parMini .parMiniH{display:flex;align-items:center;gap:4px;margin-bottom:4px}#parMini .parMiniH .panel-title{flex:1;margin:0}'
    +'#parMini .parMiniH button{padding:0 5px;min-width:0;line-height:1.5}'
    +'#parMini .parMiniB{max-height:38vh;overflow-y:auto}'
    +'#parMini .parMiniR{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:1px 2px;font-size:.8rem}'
    +'#parMini .parMiniI{flex:0 1 96px;min-width:48px;width:96px;box-sizing:border-box;margin:0;padding:0 3px;height:20px;font:inherit;font-variant-numeric:tabular-nums;text-align:right;background:transparent;color:inherit;border:1px solid transparent;border-radius:4px}'
    +'#parMini .parMiniI:hover{border-color:var(--border,#555)}'
    +'#parMini .parMiniI:focus{outline:none;border-color:#0a84ff;background:rgba(10,132,255,.12);text-align:left}'
    +'#parMini .parMiniE{margin-top:4px;font-size:.75rem;color:var(--warn,#ff9f0a)}'
    +'#parMini .parMiniN{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    +'#parMini .parMiniV{font-variant-numeric:tabular-nums;white-space:nowrap;opacity:.85}';
  el.appendChild(css);
  const h=document.createElement('div');h.className='parMiniH';
  const t=document.createElement('p');t.className='panel-title';t.textContent='ƒx Paramètres';h.appendChild(t);
  const up=document.createElement('button');up.className='parMiniUp';up.textContent='🔄';up.title='Vérifier les fichiers sources (Dérivée)';up.style.display='none';up.onclick=()=>derCheck(true);h.appendChild(up);
  const full=document.createElement('button');full.textContent='⤢';full.title='Liste complète (clic droit sur ƒx)';full.onclick=()=>openParamsDlg();h.appendChild(full);
  const x=document.createElement('button');x.textContent='✕';x.title='Masquer';x.onclick=()=>parMiniToggle(false);h.appendChild(x);
  el.appendChild(h);
  const b=document.createElement('div');b.className='parMiniB';el.appendChild(b);
  const er=document.createElement('div');er.className='parMiniE';er.style.display='none';el.appendChild(er);
  side.insertBefore(el,side.firstChild);
  return el;
}
function parMiniToggle(on){
  const el=parMiniBuild();
  if(!el){openParamsDlg();return;}
  let hidden=false;
  try{hidden=getComputedStyle(el.parentNode).display==='none';}catch(e){}
  if(hidden&&on!==false){openParamsDlg();return;} // écran étroit, mobile : pas de bandeau de droite
  const show=on==null?!parMiniOpen():!!on;
  el.style.display=show?'':'none';
  try{localStorage.setItem('minifusion_parmini',show?'1':'0');}catch(e){}
  if(show){try{parResolve();}catch(e){}parMiniRender();}
}
/* ── bouton 🔗 Dériver (bandeau, menu Fichier) et vérifications automatiques ── */
(function(){
  try{
    if(!document.getElementById('btnDerive')){
      const ref=document.getElementById('btnImport');
      if(ref&&ref.parentNode){const n=document.createElement('button');n.id='btnDerive';n.textContent='🔗 Dériver';
        n.title='Dériver : paramètres et corps d’un autre fichier, qui suivent ce fichier quand il change';
        ref.parentNode.insertBefore(n,ref.nextSibling);n.onclick=()=>derCmdInsert();}
    }
    let vu=false;try{vu=localStorage.getItem('minifusion_parmini')==='1';}catch(e){}
    if(vu)setTimeout(()=>{try{parMiniToggle(true);}catch(e){}},0);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')derCheck(false);});
    window.addEventListener('focus',()=>derCheck(false));
  }catch(e){}
})();
