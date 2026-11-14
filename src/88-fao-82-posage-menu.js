// V0.95.3 — FAO : menu contextuel du POSAGE (clic droit sur sa ligne de l'arbre).
//  · « G-code de ce posage » : programme du seul posage cliqué ;
//  · « Geler le posage » : le posage et TOUTES ses opérations sont désactivés
//    (aperçu, temps, G-code) ; l'état de chaque opération (●/○) est mémorisé
//    dans s.struckOn et rendu tel quel au « Dégeler » ;
//  · Copier / Dupliquer le posage entier avec ses opérations.
// Le bouton « Exporter G-code » prend en charge TOUS les posages non gelés
// (un fichier par posage) — faoExport, src/88-fao-80-interface.js.
let faoCtxEl=null, faoCtxSetupId=null;
// V0.99.3 (Fred) : le style « barré » d'un posage gelé était posé avec le menu, donc
// seulement après le premier clic droit — un fichier ouvert montrait ses posages gelés
// comme actifs. Posé dès le chargement.
(function faoStruckStyle(){
  try{
    if(typeof document==='undefined'||!document.createElement)return;
    const st=document.createElement('style');
    st.textContent='.fao-setup.struck>span:not(.fao-tri){text-decoration:line-through;opacity:.55}'
      +'.fao-op.struck .lb{text-decoration:line-through}';
    (document.head||document.documentElement).appendChild(st);
  }catch(e){}
})();
function faoSetupStruck(s){ return !!(s&&s.struck===true); }
function faoSetupStrike(id,on){
  // Geler (on=true) / dégeler (on=false) un posage. Renvoie true si l'état change.
  try{
    const s=faoSetup(id);
    if(!s||s.id!==id||faoSetupStruck(s)===!!on)return false;
    faoSnapshot((on?'geler':'dégeler')+' le posage « '+s.name+' »');
    if(on){
      const mem={};
      (s.ops||[]).forEach(function(op){ if(op&&op.id){ mem[op.id]=op.on!==false; op.on=false; } });
      s.struck=true; s.struckOn=mem;
    }else{
      const mem=s.struckOn||{};
      (s.ops||[]).forEach(function(op){ if(op&&op.id)op.on=(op.id in mem)?mem[op.id]!==false:true; });
      delete s.struck; delete s.struckOn;
    }
    faoChanged();
    faoClipMsg(on
      ?('posage « '+s.name+' » gelé : ses '+(s.ops||[]).length+' opération(s) sont désactivées (état de chacune mémorisé).')
      :('posage « '+s.name+' » dégelé : chaque opération retrouve son état d’avant.'));
    return true;
  }catch(e){ return false; }
}
function faoStruckSanitise(s){
  // Invariant (relu à chaque faoRoot) : posage gelé = toutes ses opérations OFF ;
  // une opération ajoutée ou collée pendant qu'il est gelé est mémorisée ACTIVE.
  if(!s)return;
  if(s.struck!==true){ delete s.struck; delete s.struckOn; return; }
  if(!s.struckOn||typeof s.struckOn!=='object')s.struckOn={};
  const mem=s.struckOn, ids={};
  (s.ops||[]).forEach(function(op){
    if(!op||!op.id)return;
    ids[op.id]=1;
    if(!(op.id in mem))mem[op.id]=op.on!==false;
    else mem[op.id]=mem[op.id]!==false;
    op.on=false;
  });
  Object.keys(mem).forEach(function(k){ if(!ids[k])delete mem[k]; });
}
function faoSetupActiveOps(s){
  if(!s||faoSetupStruck(s))return [];
  return (s.ops||[]).filter(function(o){ return o&&o.on!==false; });
}
function faoExportSetups(list){
  // Un fichier par posage (posage de travail = posage exporté pendant le calcul :
  // brut, repère et plans lus comme à l'écran). Renvoie le nombre de fichiers.
  const r=faoRoot(), keep=r.activeSetupId, names=[], warns=[];
  const files=[];
  try{
    list.forEach(function(s){
      r.activeSetupId=s.id;
      const p=faoPost(s);
      let nm=faoProgName(s.name)+'.'+p.ext, k=2;
      while(names.indexOf(nm)>=0)nm=faoProgName(s.name)+'_'+(k++)+'.'+p.ext;
      names.push(nm);
      files.push({name:nm,code:p.code});
      if(p.warns&&p.warns.length)warns.push(s.name+' : '+p.warns.join(' ; '));
    });
  }finally{ r.activeSetupId=keep; }
  files.forEach(function(f,i){
    // le 1er tout de suite, les suivants décalés : un navigateur refuse plusieurs
    // téléchargements dans le même instant
    const go=function(){
      try{
        const a=document.createElement('a');
        a.href=URL.createObjectURL(new Blob([f.code],{type:'text/plain'})); a.download=f.name;
        document.body.appendChild(a); a.click();
        setTimeout(function(){ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(e){} },500);
      }catch(e){}
    };
    if(i===0)go(); else setTimeout(go,i*350);
  });
  try{
    faceEl.textContent='FAO : '+(files.length>1?(files.length+' programmes exportés : '):'')
      +files.map(function(f){ return f.name+(files.length>1?'':(' exporté ('+f.code.split('\n').length+' blocs)')); }).join(', ')
      +(warns.length?(' ⚠ '+warns.join(' — ')):'');
  }catch(e){}
  try{ if(typeof window!=='undefined')window.faoLastExport=files; }catch(e){}
  return files.length;
}
function faoExportSetup(id){
  try{
    if(faoPrevStale){ faoExport(); return 0; } // même blocage (message) que le bouton
    const s=faoSetup(id);
    if(!s||s.id!==id)return 0;
    if(faoSetupStruck(s)){ faoClipMsg('posage « '+s.name+' » gelé — dégelez-le pour exporter son G-code.'); return 0; }
    if(!faoSetupActiveOps(s).length){ faoClipMsg('posage « '+s.name+' » : aucune opération active à exporter.'); return 0; }
    return faoExportSetups([s]);
  }catch(e){ return 0; }
}
function faoCtxHide(){ try{ if(faoCtxEl)faoCtxEl.style.display='none'; }catch(e){} faoCtxSetupId=null; }
function faoCtxBuild(){
  if(faoCtxEl)return faoCtxEl;
  const m=document.createElement('div'); m.id='faoCtxMenu';
  const st=document.createElement('style');
  st.textContent='#faoCtxMenu{display:none;position:fixed;z-index:5000;min-width:220px;background:rgba(28,28,32,.96);'
    +'border:1px solid var(--border);border-radius:9px;padding:5px;box-shadow:0 12px 32px rgba(0,0,0,.6)}'
    +'#faoCtxMenu .t{font-size:.72rem;color:var(--muted);padding:5px 10px}'
    +'#faoCtxMenu button{display:block;width:100%;text-align:left;background:none;border:none;padding:7px 10px;font-size:.82rem;border-radius:6px;color:inherit;cursor:pointer}'
    +'#faoCtxMenu button:hover:not(:disabled){background:var(--primary)}'
    +'#faoCtxMenu button:disabled{opacity:.4;cursor:default}'
    +'#faoCtxMenu hr{border:none;border-top:1px solid var(--border);margin:4px 0}';
  (document.head||document.documentElement).appendChild(st);
  document.body.appendChild(m);
  m.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  document.addEventListener('pointerdown',function(e){ if(faoCtxEl&&faoCtxEl.style.display!=='none'&&!faoCtxEl.contains(e.target))faoCtxHide(); },true);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&faoCtxEl&&faoCtxEl.style.display!=='none')faoCtxHide(); },true);
  faoCtxEl=m;
  return m;
}
function faoSetupCtx(x,y,id){
  // Ouvre le menu du posage `id` au point (x,y) — clic droit sur sa ligne.
  try{
    if(typeof mfCloseMenus==='function')mfCloseMenus();
    const s=faoSetup(id); if(!s||s.id!==id)return;
    const m=faoCtxBuild(); m.innerHTML=''; faoCtxSetupId=id;
    const title=document.createElement('div'); title.className='t'; title.textContent='▤ '+s.name; m.appendChild(title);
    const item=function(act,label,tip,dis,fn){
      const b=document.createElement('button'); b.dataset.act=act; b.textContent=label; b.title=tip; b.disabled=!!dis;
      b.onclick=function(){ faoCtxHide(); if(!b.disabled)fn(); };
      m.appendChild(b); return b;
    };
    const struck=faoSetupStruck(s), nOn=faoSetupActiveOps(s).length;
    item('gcode','💾 G-code de ce posage',
      struck?'Posage gelé : dégelez-le d’abord.':(faoPrevStale?'Aperçu périmé : « Tout régénérer » d’abord.':'Exporte le programme de CE posage seulement.'),
      struck||!nOn,function(){ faoExportSetup(id); });
    m.appendChild(document.createElement('hr'));
    item('strike',struck?'↺ Dégeler le posage':'❄ Geler le posage',
      struck?'Réactive le posage : chaque opération retrouve son état d’avant (● ou ○).'
        :'Désactive le posage et toutes ses opérations (aperçu, temps, G-code) ; l’état de chacune est retenu pour le dégel.',
      false,function(){ faoSetupStrike(id,!struck); });
    m.appendChild(document.createElement('hr'));
    item('copy','📋 Copier le posage','Copie le posage entier avec ses opérations et ses outils — Ctrl+V pour le coller.',false,
      function(){ faoSelectSetup(id); faoCopy(); });
    item('dup','⧉ Dupliquer le posage','Copie et colle tout de suite le posage entier, juste après lui.',false,
      function(){ faoSelectSetup(id); if(faoCopy())faoPaste(); });
    m.style.display='block';
    if(typeof ctxPlace==='function')ctxPlace(m,x,y); else { m.style.left=x+'px'; m.style.top=y+'px'; }
  }catch(e){}
}
