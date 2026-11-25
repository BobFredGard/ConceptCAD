/* ---------- Assemblage complet vers un dossier (V0.99.70) ----------
   Demande de Fred : « exporter un fichier d'assemblage et tous ses fichiers en une seule fois
   vers le répertoire de mon choix ». Choix de Fred :
     · les copies pointent vers les COPIES : le dossier choisi est autonome, les originaux ne
       sont ni lus après coup ni modifiés ;
     · les sous-dossiers sont gardés (ex. Visserie/Vis M6.conceptcad), à partir du dossier
       commun à l'assemblage et à ses pièces ;
     · les programmes CN déjà calculés sont ajoutés dans « Programmes CN/<pièce>/ ».
   Contenu écrit = l'état en mémoire (modifications pas encore enregistrées comprises) ; pour une
   pièce liée, l'enveloppe de sa source (trajectoires, imports) est gardée si elle se lit.
   Liens des copies : chemin dans le dossier de projets quand le dossier choisi en fait partie ;
   sinon handle mémorisé (cet ordinateur) + chemin relatif au dossier choisi (un autre poste
   qui prend ce dossier comme dossier de projets retrouve les pièces) — asmLinkHandle essaie
   alors le handle d'abord (47-composants-lies).
   V0.99.79 (demande de Fred : « Export Assemblage -> ajouter les pièces dérivées ») : les
   fichiers SOURCES des Dérivées (52-derivee : doc.derive de l'hôte, de ses composants, de ses
   pièces liées) sont copiés aussi, tels qu'ils sont sur le disque (ils ne sont que lus), et
   les liens des copies vont vers eux. De proche en proche : les liens d'une source copiée
   (ses propres Dérivées, ses pièces liées) sont suivis de la même façon. Un lien qui revient
   vers un fichier déjà copié (pièce qui dérive des paramètres de l'assemblage) va vers sa copie.
   Empreinte (sig) d'un lien recopié : celle de la copie si le lien était à jour avec l'original,
   sinon l'ancienne — la copie rouverte se met alors à jour comme l'aurait fait l'original. */
function packSrcKey(l){return l?(l.rel?'r:'+l.rel:(l.key?'k:'+l.key:'')):'';}
function packLinks(obj){
  // Liens d'un projet sérialisé, à tout niveau : [{kind:'asm'|'der', l}] (l = objet du lien,
  // modifiable sur place) — composants liés du bloc asm, Dérivées de chaque document
  const out=[],seen=new Set();
  const walk=o=>{
    if(!o||typeof o!=='object'||seen.has(o))return;
    seen.add(o);
    if(Array.isArray(o.derive))o.derive.forEach(L=>{if(L&&typeof L==='object'&&(L.rel||L.key))out.push({kind:'der',l:L});});
    if(o.asm&&Array.isArray(o.asm.comps))o.asm.comps.forEach(c=>{
      if(!c)return;
      if(c.link&&typeof c.link==='object'&&(c.link.rel||c.link.key))out.push({kind:'asm',l:c.link});
      if(c.doc&&typeof c.doc==='object')walk(c.doc);
    });
    if(o.doc&&typeof o.doc==='object')walk(o.doc); // enveloppe bundle
  };
  walk(obj);
  return out;
}
function packDepth(L){
  // Profondeur d'un composant lié : 0 = lié directement dans l'hôte, 1 = lien d'un lien…
  let d=0,c=L,seen=new Set();
  while(c&&c.of&&!seen.has(c.id)){seen.add(c.id);const P=asmLinkOwner(asmComp(c.of));if(!P)break;d++;c=P;}
  return d;
}
function packSafe(n){return String(n||'').replace(/[\\/:*?"<>|]/g,'_').trim()||'piece';}
function packUnique(path,used){
  // chemin libre dans le paquet (comparaison sans la casse : Windows)
  let p=path,k=2;
  const m=/^(.*?)((\.conceptcad|\.minifusion)(\.gz|\.json)?|\.[^./]+)?$/i.exec(path);
  while(used.has(p.toLowerCase()))p=m[1]+' ('+(k++)+')'+(m[2]||'');
  used.add(p.toLowerCase());
  return p;
}
async function packPlan(step){
  // → {host:{path, obj, mem:true}, groups:[...], failed:[]} : chemins dans le dossier choisi
  // groupe = un fichier à copier : {key, keys, kind ('asm' : pièce liée, écrite depuis la mémoire ;
  // 'file' : copiée du disque, ex. source d'une Dérivée), via ('asm'|'der'), l (lien), Ls, L,
  // depth, h, txt, orig (empreinte du fichier d'origine), obj (projet à réécrire), path, deps}
  const links=asmLinked();
  const groups=new Map(); // clé de lien → groupe (une même source peut avoir plusieurs clés)
  links.forEach(L=>{
    const k=packSrcKey(L.link)||('c:'+L.id);
    let g=groups.get(k);if(!g){g={key:k,keys:[k],kind:'asm',via:'asm',mem:true,l:L.link||{},Ls:[],L,depth:0};groups.set(k,g);}
    g.Ls.push(L);g.depth=Math.max(g.depth,packDepth(L));
  });
  let hostRel=null;
  try{if(mffFolder&&mffHandle){const p=await mffFolder.resolve(mffHandle);if(p&&p.length)hostRel=p.join('/');}}catch(e){}
  const hostName=(mffHandle&&mffHandle.name)||(packSafe((asm&&asmRoot().name)||mffName||doc.name||'assemblage')+'.conceptcad');
  const failed=[];
  // l'hôte (état en mémoire) et les pièces liées : lus d'abord, leurs liens disent quoi copier d'autre
  const host={mem:true,keys:hostRel?['r:'+hostRel]:[],obj:JSON.parse(await mffData())};
  for(const g of new Set(groups.values())){
    try{
      let cur=null;
      try{const r=await asmLinkHandle(g.L,true,'read');if(r.h){g.h=r.h;cur=await mffFileText(await r.h.getFile());}}catch(e){cur=null;}
      g.orig=cur!=null?asmHash(cur):null;
      g.obj=JSON.parse(asmLinkText(g.L,cur));
    }catch(e){g.err=String(e&&e.message||e);}
  }
  // V0.99.79 : sources des Dérivées (et liens de ces sources), de proche en proche
  const queue=[host.obj].concat([...new Set(groups.values())].filter(g=>g.obj).map(g=>g.obj));
  const hostKeys=new Set(host.keys);
  const bad=new Set();
  for(let qi=0;qi<queue.length&&qi<500;qi++){
    for(const {kind,l} of packLinks(queue[qi])){
      const k=packSrcKey(l);
      if(!k||groups.has(k)||hostKeys.has(k)||bad.has(k))continue;
      const nm=String(l.name||k.slice(2).split('/').pop()||'source');
      if(step)await step('lecture de « '+nm+' »…');
      let r;try{r=await asmLinkHandle({link:Object.assign({},l)},true,'read');}catch(e){r={why:String(e&&e.message||e)};}
      if(!r||!r.h){bad.add(k);failed.push((kind==='der'?'source de dérivée':'pièce liée')+' « '+nm+' » ('+((r&&r.why)||'introuvable')+')');continue;}
      // même fichier sous un autre chemin ou handle : l'hôte, ou un fichier déjà prévu
      let same=null;
      try{if(mffHandle&&await r.h.isSameEntry(mffHandle))same=host;}catch(e){}
      if(!same)for(const g of new Set(groups.values())){try{if(g.h&&await r.h.isSameEntry(g.h)){same=g;break;}}catch(e){}}
      if(same===host){hostKeys.add(k);host.keys.push(k);continue;}
      if(same){groups.set(k,same);same.keys.push(k);continue;}
      let txt;
      try{txt=await mffFileText(await r.h.getFile());}catch(e){bad.add(k);failed.push((kind==='der'?'source de dérivée':'pièce liée')+' « '+nm+' » (lecture impossible)');continue;}
      const g={key:k,keys:[k],kind:'file',via:kind,mem:false,l:Object.assign({},l),Ls:[],L:null,depth:0,h:r.h,txt,orig:asmHash(txt),obj:null};
      try{g.obj=JSON.parse(txt);}catch(e){g.obj=null;} // illisible : copié tel quel
      groups.set(k,g);
      if(g.obj)queue.push(g.obj);
    }
  }
  // dossier commun à l'hôte et aux fichiers copiés (dans le dossier de projets)
  const list=[...new Set(groups.values())];
  const dirs=[];if(hostRel)dirs.push(hostRel.split('/').slice(0,-1));
  list.forEach(g=>{if(g.l&&g.l.rel)dirs.push(String(g.l.rel).split('/').filter(Boolean).slice(0,-1));});
  let base=dirs.length?dirs[0].slice():[];
  dirs.forEach(d=>{let i=0;while(i<base.length&&i<d.length&&base[i]===d[i])i++;base=base.slice(0,i);});
  const strip=rel=>String(rel).split('/').filter(Boolean).slice(base.length).map(packSafe).join('/');
  const used=new Set();
  host.path=packUnique(hostRel?strip(hostRel):packSafe(hostName),used);
  list.forEach(g=>{
    const l=g.l||{};
    g.path=packUnique(l.rel?strip(l.rel):packSafe(l.name||((g.L?g.L.name:'piece')+'.conceptcad')),used);
  });
  // fichiers dont chacun dépend (pour écrire d'abord ceux qu'il cite)
  list.forEach(g=>{
    g.deps=new Set();
    if(g.obj)packLinks(g.obj).forEach(({l})=>{const t=groups.get(packSrcKey(l));if(t&&t!==g)g.deps.add(t);});
  });
  return {host,groups:list,byKey:groups,failed};
}
async function packDir(root,segs,create){
  let d=root;for(const s of segs)d=await d.getDirectoryHandle(s,create?{create:true}:undefined);return d;
}
async function packExists(root,path){
  const seg=path.split('/');
  try{const d=await packDir(root,seg.slice(0,-1),false);await d.getFileHandle(seg[seg.length-1]);return true;}catch(e){return false;}
}
async function packWrite(root,path,data){
  const seg=path.split('/');
  const d=await packDir(root,seg.slice(0,-1),true);
  const h=await d.getFileHandle(seg[seg.length-1],{create:true});
  const w=await h.createWritable();await w.write(data);await w.close();
  return h;
}
function packRelink(obj,refs,mem){
  // Liens d'un projet sérialisé (composants liés, Dérivées, à tout niveau) → vers les copies.
  // refs : clé de lien → {rel, key, name, orig, copy, mem, done, ko} ; mem : ce fichier est écrit
  // depuis la mémoire (hôte, pièce liée). → nombre de liens changés
  let n=0;
  packLinks(obj).forEach(({kind,l})=>{
    const r=refs.get(packSrcKey(l));
    if(!r||r.ko)return;
    let sig=l.sig;
    if(r.done){
      // pièce liée écrite depuis la mémoire de l'hôte : copie et lien vont ensemble (V0.99.70)
      if(kind==='asm'&&mem&&r.mem)sig=r.copy;
      // sinon : à jour avec l'original → à jour avec la copie ; en retard → reste en retard
      else if(l.sig&&r.orig&&l.sig===r.orig)sig=r.copy;
    }
    Object.assign(l,{rel:r.rel,key:r.key,name:r.name,sig});
    if(kind==='asm'&&mem&&r.mem)delete l.pend;
    n++;
  });
  return n;
}
function packRef(destPre,path){
  // Comment la copie retrouve ce fichier (voir l'en-tête) ; le handle est mémorisé à l'écriture
  // (clé prise d'avance : un fichier peut citer une copie pas encore écrite)
  if(destPre)return {rel:destPre.concat(path.split('/')).join('/'),key:null};
  return {rel:path,key:'mfl:'+uid('k')};
}
function packCnList(){
  // Composants qui ont au moins un posage avec une opération active (sans les activer)
  return (asm?asm.comps:[]).filter(c=>{
    const f=c&&c.doc&&c.doc.fao;
    return !!(f&&Array.isArray(f.setups)&&f.setups.some(s=>s&&s.struck!==true&&(s.ops||[]).some(o=>o&&o.on!==false)));
  });
}
function packCnReady(s){
  return faoSetupActiveOps(s).every(op=>{const ck=faoOpMovesKey(op,s);if(ck===null)return true;const ch=faoOpMovesHit(op);return !!(ch&&ch.key===ck);});
}
async function packCnWarm(){
  // Parcours rangés sur le poste (IndexedDB, ceux du fichier compris) → mémoire, pour la pièce
  // active ; attend la fin de son rejeu (10 s au plus). Jamais de calcul de parcours ici.
  if(typeof faoMovesPreload!=='function')return;
  for(let i=0;i<40&&typeof faoSolidSettled==='function'&&!faoSolidSettled();i++)await new Promise(r=>setTimeout(r,250));
  try{await faoMovesPreload();}catch(e){}
}
async function packCnBuild(step){
  // Programmes déjà calculés : {files:[{comp, name, code}], todo:['pièce › posage']}
  // step : fonction async (texte) de progression, facultative
  const out={files:[],todo:[]};
  const list=packCnList();if(!list.length)return out;
  const back=asm.active,backPath=asm.path.slice();let moved=false;
  try{
    for(let i=0;i<list.length;i++){
      const c=list[i];
      if(step)await step('programmes CN : « '+c.name+' » ('+(i+1)+'/'+list.length+')…');
      if(c.id!==asm.active){asmActivate(c.id);moved=true;}
      if(!faoRoot().setups.every(s=>!faoSetupActiveOps(s).length||packCnReady(s)))await packCnWarm();
      const r=faoRoot(),keep=r.activeSetupId,names=[];
      try{
        r.setups.forEach(s=>{
          const ops=faoSetupActiveOps(s);if(!ops.length)return;
          r.activeSetupId=s.id;
          if(!packCnReady(s)){out.todo.push(c.name+' › '+s.name);return;}
          const p=faoPost(s);
          let nm=faoProgName(s.name)+'.'+p.ext,k=2;
          while(names.indexOf(nm)>=0)nm=faoProgName(s.name)+'_'+(k++)+'.'+p.ext;
          names.push(nm);out.files.push({comp:c.name,name:nm,code:p.code});
        });
      }finally{r.activeSetupId=keep;}
    }
  }finally{if(moved){try{asmActivate(back,backPath);}catch(e){}}}
  return out;
}
async function packRun(dest,opt){
  // Écrit l'assemblage, ses pièces liées et leurs programmes CN dans dest.
  // opt : {cn (défaut true), ask (fonction async (msg) → bool, défaut mffAsk)} → bilan
  opt=opt||{};
  asmEnsure();
  const bilan={host:'',parts:[],derived:[],cn:[],todo:[],failed:[],dest:dest.name||'',outside:false};
  const say=t=>{try{faceEl.textContent='Assemblage → dossier : '+t;}catch(e){}};
  // V0.99.70 (constat de Fred, SIRAP-14-000 : « rien n'a été copié ») : les programmes CN
  // rejouent chaque pièce usinée (plus d'une minute la première fois) — écran figé sans rien
  // dire. Fichiers d'abord (rapides), progression affichée, programmes CN ensuite.
  const step=async t=>{say(t);try{if(opt.progress)opt.progress(t);}catch(e){}await new Promise(r=>setTimeout(r,30));}; // laisse l'écran se redessiner
  let wasMod=true;try{wasMod=mffModified();}catch(e){}
  await step('préparation…');
  const plan=await packPlan(step);
  let destPre=null;
  try{if(mffFolder){const p=await mffFolder.resolve(dest);if(p)destPre=p;}}catch(e){}
  bilan.outside=!destPre;
  const withCn=opt.cn!==false&&packCnList().length>0;
  // fichiers déjà présents : une seule question (le dossier des programmes compte pour ses fichiers)
  const all=[plan.host.path].concat(plan.groups.map(g=>g.path));
  const there=[];for(const p of all)if(await packExists(dest,p))there.push(p);
  if(withCn){try{await dest.getDirectoryHandle('Programmes CN');there.push('Programmes CN/');}catch(e){}}
  if(there.length){
    const ask=opt.ask||(async m=>(await mffAsk(m,[['over','Remplacer',true],['no','Annuler']]))==='over');
    if(!(await ask('Le dossier « '+bilan.dest+' » contient déjà '+there.length+' de ces fichiers :\n• '+there.slice(0,8).join('\n• ')+(there.length>8?'\n…':'')+'\nLes remplacer ?'))){say('annulé.');return null;}
  }
  bilan.failed.push(...plan.failed);
  // références des copies, prises d'avance (un fichier peut citer l'hôte, écrit en dernier)
  const refs=new Map();
  const mkRef=(x,orig)=>{
    const r=Object.assign(packRef(destPre,x.path),{name:x.path.split('/').pop(),orig:orig||null,mem:!!x.mem,done:false,ko:false,copy:null});
    x.keys.forEach(k=>refs.set(k,r));
    return r;
  };
  plan.groups.forEach(g=>{g.ref=mkRef(g,g.orig);});
  plan.host.ref=mkRef(plan.host,null);
  // ordre d'écriture : chaque fichier après ceux qu'il cite (leur empreinte va dans ses liens) ;
  // pièces liées les plus profondes d'abord ; un cycle se coupe (le lien garde son empreinte)
  const todo=plan.groups.slice().sort((a,b)=>b.depth-a.depth),order=[],done=new Set();
  while(todo.length){
    let i=todo.findIndex(g=>[...g.deps].every(d=>done.has(d)));
    if(i<0)i=0;
    const g=todo.splice(i,1)[0];order.push(g);done.add(g);
  }
  const ecrire=async(x,txt)=>{
    const h=await packWrite(dest,x.path,await mffPack(txt));
    if(x.ref.key){try{await idbSet(x.ref.key,h);}catch(e){}}
    x.ref.done=true;x.ref.copy=asmHash(txt);
  };
  const texte=obj=>obj&&obj.bundle===1?JSON.stringify(obj):JSON.stringify(obj,null,2);
  for(const g of order){
    const nm=g.kind==='asm'?g.L.name:g.path.split('/').pop();
    await step('copie de « '+nm+' »…');
    try{
      if(g.err)throw new Error(g.err);
      let txt;
      if(g.kind==='file'){
        // source copiée du disque : texte d'origine gardé à l'octet près si aucun lien ne change
        txt=(g.obj&&packRelink(g.obj,refs,false))?texte(g.obj):g.txt;
      }else{packRelink(g.obj,refs,true);txt=texte(g.obj);}
      await ecrire(g,txt);
      (g.via==='der'?bilan.derived:bilan.parts).push(g.path);
    }catch(e){g.ref.ko=true;bilan.failed.push(nm+' ('+(e&&e.message||e)+')');}
  }
  // l'assemblage
  await step('copie de l’assemblage…');
  try{
    packRelink(plan.host.obj,refs,true);
    await ecrire(plan.host,texte(plan.host.obj));
    bilan.host=plan.host.path;
  }catch(e){bilan.failed.push('assemblage ('+(e&&e.message||e)+')');}
  // programmes CN, après les fichiers (l'activation des pièces ne change rien de ce qui est écrit)
  let cn={files:[],todo:[]};
  if(withCn){
    await step('programmes CN : lecture des pièces usinées (peut prendre une minute)…');
    try{cn=await packCnBuild(step);}catch(e){bilan.failed.push('programmes CN ('+(e&&e.message||e)+')');}
  }
  const cnPaths=[];{const used=new Set([plan.host.path.toLowerCase()].concat(plan.groups.map(g=>g.path.toLowerCase())));
    cn.files.forEach(f=>cnPaths.push(packUnique('Programmes CN/'+packSafe(f.comp)+'/'+packSafe(f.name),used)));}
  if(cn.files.length)await step('écriture des programmes CN…');
  for(let i=0;i<cn.files.length;i++){
    try{await packWrite(dest,cnPaths[i],cn.files[i].code);bilan.cn.push(cnPaths[i]);}
    catch(e){bilan.failed.push(cnPaths[i]+' ('+(e&&e.message||e)+')');}
  }
  bilan.todo=cn.todo;
  // le passage par les pièces usinées ne modifie pas le document : pas de « ● » ajouté
  if(!wasMod){try{mffMark();}catch(e){}}
  say(packBilanCourt(bilan));
  return bilan;
}
function packBilanCourt(b){
  const der=(b.derived||[]).length;
  return (b.failed.length?'⚠ ':'')+'copié dans « '+b.dest+' » : '+(b.host?'l’assemblage':'pas l’assemblage')+', '
    +b.parts.length+' pièce(s) liée(s), '+(der?der+' pièce(s) source(s) de dérivée, ':'')+b.cn.length+' programme(s) CN'+(b.failed.length?' — '+b.failed.length+' échec(s)':'')+'.';
}
function packBilanLong(b){
  const L=['Copié dans « '+b.dest+' » :'];
  if(b.host)L.push('• assemblage : '+b.host);
  b.parts.forEach(p=>L.push('• pièce : '+p));
  (b.derived||[]).forEach(p=>L.push('• pièce source de dérivée : '+p));
  b.cn.forEach(p=>L.push('• programme : '+p));
  if(b.todo.length)L.push('','Programmes non calculés (ouvrir la pièce, « Tout régénérer », puis recommencer) :','• '+b.todo.join('\n• '));
  if(b.failed.length)L.push('','Non copié :','• '+b.failed.join('\n• '));
  if(b.outside&&(b.parts.length||(b.derived||[]).length))L.push('','Le dossier choisi est hors du dossier de projets : sur cet ordinateur, la copie de l’assemblage ouvre les copies des pièces. Sur un autre poste, choisir ce dossier comme dossier de projets.');
  return L.join('\n');
}
async function packExport(){
  // Fichier → Exporter → Assemblage complet (dossier)
  if(typeof window==='undefined'||typeof window.showDirectoryPicker!=='function'){alert('Copier vers un dossier demande Chrome ou Edge (accès aux fichiers).');return null;}
  let dest=null;
  try{const o={id:'ccpaquet',mode:'readwrite'};if(mffFolder)o.startIn=mffFolder;dest=await window.showDirectoryPicker(o);}
  catch(e){if(!(e&&e.name==='AbortError'))alert('Dossier impossible : '+(e&&e.message||e));return null;}
  // fenêtre de progression (V0.99.70) : on voit que la copie travaille, et où elle en est
  let bg=null,txt=null;
  try{
    bg=document.createElement('div');bg.className='mffDlgBg';
    const d=document.createElement('div');d.className='mffDlg';
    const t=document.createElement('div');t.className='mffMsg';t.textContent='⏳ Copie vers « '+dest.name+' »';d.appendChild(t);
    txt=document.createElement('div');txt.className='mffMsg';txt.style.opacity='.8';d.appendChild(txt);
    bg.appendChild(d);document.body.appendChild(bg);
  }catch(e){}
  let b=null;
  try{b=await packRun(dest,{progress:t=>{if(txt)txt.textContent=t.charAt(0).toUpperCase()+t.slice(1);}});}
  catch(e){try{bg&&bg.remove();}catch(e2){}alert('Copie impossible : '+(e&&e.message||e));return null;}
  try{bg&&bg.remove();}catch(e){}
  if(b){try{await mffAsk(packBilanLong(b),[['ok','OK',true]]);}catch(e){try{alert(packBilanLong(b));}catch(e2){}}}
  return b;
}
// bouton créé ici (la coque HTML ne s'édite pas à la main) ; les menus le reprennent (96, 97)
(function packBouton(){
  try{
    if(typeof document==='undefined'||!document.getElementById)return;
    const ref=document.getElementById('btnExportFcstd');if(!ref||document.getElementById('btnExportPack'))return;
    const b=document.createElement('button');b.id='btnExportPack';
    b.title='Copier l’assemblage, toutes ses pièces liées, les pièces sources de ses dérivées et leurs programmes CN dans un dossier';
    b.textContent='📦 Assemblage → dossier';
    ref.parentNode.insertBefore(b,ref.nextSibling);
    b.onclick=()=>packExport();
  }catch(e){}
})();
