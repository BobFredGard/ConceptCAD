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
   alors le handle d'abord (47-composants-lies). */
function packSrcKey(l){return l?(l.rel?'r:'+l.rel:(l.key?'k:'+l.key:'')):'';}
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
async function packPlan(){
  // → {host:{path}, groups:[{key, Ls, L, path, depth}]} : chemins dans le dossier choisi
  const links=asmLinked();
  const groups=new Map();
  links.forEach(L=>{
    const k=packSrcKey(L.link)||('c:'+L.id);
    let g=groups.get(k);if(!g){g={key:k,Ls:[],L,depth:0};groups.set(k,g);}
    g.Ls.push(L);g.depth=Math.max(g.depth,packDepth(L));
  });
  let hostRel=null;
  try{if(mffFolder&&mffHandle){const p=await mffFolder.resolve(mffHandle);if(p&&p.length)hostRel=p.join('/');}}catch(e){}
  const hostName=(mffHandle&&mffHandle.name)||(packSafe((asm&&asmRoot().name)||mffName||doc.name||'assemblage')+'.conceptcad');
  // dossier commun à l'hôte et aux pièces (dans le dossier de projets)
  const dirs=[];if(hostRel)dirs.push(hostRel.split('/').slice(0,-1));
  groups.forEach(g=>{if(g.L.link&&g.L.link.rel)dirs.push(String(g.L.link.rel).split('/').filter(Boolean).slice(0,-1));});
  let base=dirs.length?dirs[0].slice():[];
  dirs.forEach(d=>{let i=0;while(i<base.length&&i<d.length&&base[i]===d[i])i++;base=base.slice(0,i);});
  const strip=rel=>String(rel).split('/').filter(Boolean).slice(base.length).map(packSafe).join('/');
  const used=new Set();
  const host={path:packUnique(hostRel?strip(hostRel):packSafe(hostName),used)};
  const list=[...groups.values()];
  list.forEach(g=>{
    const l=g.L.link||{};
    g.path=packUnique(l.rel?strip(l.rel):packSafe(l.name||(g.L.name+'.conceptcad')),used);
  });
  return {host,groups:list};
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
function packRelink(obj,refs){
  // Liens d'un projet sérialisé (bloc asm, à tout niveau) → vers les copies
  const walk=o=>{
    if(!o||typeof o!=='object')return;
    if(o.asm&&Array.isArray(o.asm.comps))o.asm.comps.forEach(c=>{
      const r=c&&c.link&&refs.get(packSrcKey(c.link));
      if(r){c.link=Object.assign({},c.link,{rel:r.rel,key:r.key,name:r.name,sig:r.sig});delete c.link.pend;}
    });
    if(o.doc&&typeof o.doc==='object')walk(o.doc); // enveloppe bundle
  };
  walk(obj);
  return obj;
}
async function packRef(destPre,path,h){
  // Comment la copie retrouve ce fichier (voir l'en-tête)
  if(destPre)return {rel:destPre.concat(path.split('/')).join('/'),key:null};
  const key='mfl:'+uid('k');try{await idbSet(key,h);}catch(e){}
  return {rel:path,key};
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
  const bilan={host:'',parts:[],cn:[],todo:[],failed:[],dest:dest.name||'',outside:false};
  const say=t=>{try{faceEl.textContent='Assemblage → dossier : '+t;}catch(e){}};
  // V0.99.70 (constat de Fred, SIRAP-14-000 : « rien n'a été copié ») : les programmes CN
  // rejouent chaque pièce usinée (plus d'une minute la première fois) — écran figé sans rien
  // dire. Fichiers d'abord (rapides), progression affichée, programmes CN ensuite.
  const step=async t=>{say(t);try{if(opt.progress)opt.progress(t);}catch(e){}await new Promise(r=>setTimeout(r,30));}; // laisse l'écran se redessiner
  let wasMod=true;try{wasMod=mffModified();}catch(e){}
  await step('préparation…');
  const plan=await packPlan();
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
  // pièces liées : les plus profondes d'abord (leur empreinte va dans le fichier qui les lie)
  const refs=new Map();
  const groups=plan.groups.slice().sort((a,b)=>b.depth-a.depth);
  for(const g of groups){
    await step('copie de « '+g.L.name+' »…');
    try{
      let cur=null;
      try{const r=await asmLinkHandle(g.L,true,'read');if(r.h)cur=await mffFileText(await r.h.getFile());}catch(e){cur=null;}
      const obj=packRelink(JSON.parse(asmLinkText(g.L,cur)),refs);
      const bundle=obj&&obj.bundle===1;
      const txt=bundle?JSON.stringify(obj):JSON.stringify(obj,null,2);
      const h=await packWrite(dest,g.path,await mffPack(txt));
      const ref=await packRef(destPre,g.path,h);
      refs.set(g.key,Object.assign(ref,{name:g.path.split('/').pop(),sig:asmHash(txt)}));
      bilan.parts.push(g.path);
    }catch(e){bilan.failed.push(g.L.name+' ('+(e&&e.message||e)+')');}
  }
  // l'assemblage
  await step('copie de l’assemblage…');
  try{
    const obj=packRelink(JSON.parse(await mffData()),refs);
    const txt=obj&&obj.bundle===1?JSON.stringify(obj):JSON.stringify(obj,null,2);
    await packWrite(dest,plan.host.path,await mffPack(txt));
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
  return (b.failed.length?'⚠ ':'')+'copié dans « '+b.dest+' » : '+(b.host?'l’assemblage':'pas l’assemblage')+', '
    +b.parts.length+' pièce(s) liée(s), '+b.cn.length+' programme(s) CN'+(b.failed.length?' — '+b.failed.length+' échec(s)':'')+'.';
}
function packBilanLong(b){
  const L=['Copié dans « '+b.dest+' » :'];
  if(b.host)L.push('• assemblage : '+b.host);
  b.parts.forEach(p=>L.push('• pièce : '+p));
  b.cn.forEach(p=>L.push('• programme : '+p));
  if(b.todo.length)L.push('','Programmes non calculés (ouvrir la pièce, « Tout régénérer », puis recommencer) :','• '+b.todo.join('\n• '));
  if(b.failed.length)L.push('','Non copié :','• '+b.failed.join('\n• '));
  if(b.outside&&b.parts.length)L.push('','Le dossier choisi est hors du dossier de projets : sur cet ordinateur, la copie de l’assemblage ouvre les copies des pièces. Sur un autre poste, choisir ce dossier comme dossier de projets.');
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
    b.title='Copier l’assemblage, toutes ses pièces liées et leurs programmes CN dans un dossier';
    b.textContent='📦 Assemblage → dossier';
    ref.parentNode.insertBefore(b,ref.nextSibling);
    b.onclick=()=>packExport();
  }catch(e){}
})();
