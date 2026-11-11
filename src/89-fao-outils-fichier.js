/* ============ FAO : export / import des outils (V0.90.0) ============
   Demande : « pouvoir exporter / importer un outil, ou tous les outils d'un coup ;
   à l'import de plusieurs outils, les choisir tous ou seulement ceux souhaités ».

   FICHIER — JSON {format:'conceptcad-outils', v:1, app, tools:[…], holders:[…]} en
   « .ccoutils » : les fiches telles quelles, avec les porte-outils qu'elles portent.
   IMPORT — un fichier d'UN outil s'ajoute directement ; à partir de deux, une fenêtre
   liste les outils avec une case chacun (« Tout cocher » / « Tout décocher ») ; ceux
   déjà présents à l'identique dans la bibliothèque sont décochés d'office.
   Un outil importé garde son numéro T s'il est libre, sinon prend le suivant ; il
   reçoit toujours un nouvel identifiant (aucune opération existante n'est touchée,
   aucun parcours périmé). Un porte-outil identique à un porte-outil du posage est
   réutilisé au lieu d'être ajouté en double. */
const FAO_TOOLS_FMT='conceptcad-outils';
const FAO_TOOL_KINDS=['flat','bull','ball','chamfer','drill','spot','center','tap'];
function faoToolClean(t){
  // Fiche assainie : champs simples uniquement (nombre, texte, oui/non), Ø valide.
  if(!t||typeof t!=='object'||Array.isArray(t))return null;
  const o={};
  Object.keys(t).forEach(function(k){
    const v=t[k],ty=typeof v;
    if(ty==='string')o[k]=v.slice(0,64);
    else if(ty==='boolean')o[k]=v;
    else if(ty==='number'&&isFinite(v))o[k]=v;
  });
  if(!(+o.d>0))return null;
  o.d=+o.d;
  if(FAO_TOOL_KINDS.indexOf(o.kind)<0)o.kind='flat';
  o.name=String(o.name||'Outil').slice(0,32);
  o.num=(isFinite(+o.num)&&+o.num>0)?Math.round(+o.num):1;
  o.id=String(o.id||('T'+o.num));
  return o;
}
function faoToolsPack(setup,tools){
  // Contenu du fichier : les fiches + les porte-outils qu'elles portent.
  const ts=(tools||[]).map(faoToolClean).filter(function(t){return !!t;});
  const hs=[];
  ts.forEach(function(t){
    const h=faoHolderById(setup,t.holderId);
    const c=h?faoHolderClean(h):null;
    if(!c){ delete t.holderId; return; }
    if(!hs.some(function(x){return x.id===c.id;}))hs.push(c);
  });
  return {format:FAO_TOOLS_FMT,v:1,app:(typeof APP_VER!=='undefined'?APP_VER:''),tools:ts,holders:hs};
}
function faoToolsParse(text){
  // {tools,holders} ou {err}. Accepte aussi une simple liste de fiches, ou une fiche seule.
  let o=null;
  try{ o=JSON.parse(String(text||'')); }catch(e){ return {err:'fichier illisible (ce n’est pas un fichier d’outils ConceptCAD).'}; }
  let list=null,hold=[];
  if(o&&o.format===FAO_TOOLS_FMT&&Array.isArray(o.tools)){ list=o.tools; hold=Array.isArray(o.holders)?o.holders:[]; }
  else if(Array.isArray(o))list=o;
  else if(o&&typeof o==='object'&&+o.d>0&&!o.format)list=[o];
  if(!list)return {err:'ce fichier ne contient pas d’outils ConceptCAD.'};
  const tools=list.map(faoToolClean).filter(function(t){return !!t;});
  if(!tools.length)return {err:'aucun outil utilisable dans ce fichier.'};
  return {tools:tools,holders:hold.map(faoHolderClean).filter(function(h){return !!h;})};
}
function faoToolSameKey(t){
  // Tout ce qui définit la fiche, sauf son identifiant, son numéro T et son porte-outil.
  const o={};
  Object.keys(t||{}).sort().forEach(function(k){ if(k!=='id'&&k!=='num'&&k!=='holderId')o[k]=t[k]; });
  return JSON.stringify(o);
}
function faoToolsHas(setup,t,pack){
  // L'outil du fichier existe-t-il déjà à l'identique (fiche + porte-outil) dans le posage ?
  const k=faoToolSameKey(t);
  const hp=((pack&&pack.holders)||[]).filter(function(h){return h.id===t.holderId;})[0]||null;
  return ((setup&&setup.tools)||[]).some(function(x){
    if(faoToolSameKey(x)!==k)return false;
    const hx=faoHolderById(setup,x.holderId);
    return (!hp&&!hx)||(!!hp&&!!hx&&faoHolderSame(hp,hx));
  });
}
function faoToolsImport(setup,pack,picked){
  // Ajoute au posage les outils choisis (tous si `picked` est absent) ; renvoie les ajoutés.
  const tools=setup.tools||(setup.tools=[]);
  const src=(picked||pack.tools||[]).map(faoToolClean).filter(function(t){return !!t;});
  const map={},out=[];
  const stamp=Date.now().toString(36);
  src.forEach(function(t,k){
    const hp=(pack.holders||[]).filter(function(h){return h.id===t.holderId;})[0]||null;
    delete t.holderId;
    if(hp){
      if(!map[hp.id]){
        const twin=faoHolders(setup).filter(function(h){return faoHolderSame(h,hp);})[0];
        if(twin)map[hp.id]=twin.id;
        else{ const n=faoHolderNew(setup,hp); n.name=hp.name; map[hp.id]=n.id; }
      }
      t.holderId=map[hp.id];
    }
    // numéro T : gardé s'il est libre ; sinon le premier au-delà de tous les numéros
    // du posage ET du fichier (un outil suivant du fichier garde ainsi le sien)
    const nums=tools.map(function(a){return +a.num||0;});
    if(nums.indexOf(t.num)>=0)t.num=Math.max.apply(null,[0].concat(nums,src.slice(k+1).map(function(a){return a.num;})))+1;
    let id='T'+t.num+'_'+stamp+'i'+k,q=0;
    while(tools.some(function(a){return a.id===id;}))id='T'+t.num+'_'+stamp+'i'+k+'_'+(++q);
    t.id=id;
    tools.push(t);out.push(t);
  });
  return out;
}
function faoToolsFileName(s){ return String(s||'outils').replace(/[\\/:*?"<>|]+/g,'-').trim()||'outils'; }
function faoToolsExportFile(setup,tool){
  // tool = l'outil seul ; absent = toute la bibliothèque du posage.
  try{
    const list=tool?[tool]:(setup.tools||[]);
    if(!list.length){ faoClipMsg('aucun outil à exporter.'); return null; }
    const pack=faoToolsPack(setup,list);
    const name=faoToolsFileName(tool?('T'+tool.num+' '+(tool.name||'outil')):('Outils '+(setup.name||'posage')))+'.ccoutils';
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([JSON.stringify(pack,null,1)],{type:'application/json'}));
    a.download=name;
    document.body.appendChild(a);a.click();
    setTimeout(function(){ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(e){} },2000);
    faoClipMsg(pack.tools.length+' outil(s) exporté(s) : '+name+(pack.holders.length?(' (avec '+pack.holders.length+' porte-outil(s))'):''));
    return name;
  }catch(e){ faoClipMsg('export des outils impossible : '+((e&&e.message)||e)); return null; }
}
function faoToolsImportApply(setup,pack,picked){
  if(!picked.length){ faoClipMsg('aucun outil importé.'); return []; }
  faoSnapshot('importer '+picked.length+' outil(s)');
  const added=faoToolsImport(setup,pack,picked);
  if(added.length)faoToolSelId=added[0].id;
  faoChanged();
  try{ faoToolsWindowRefresh(); }catch(e){}
  faoClipMsg(added.length+' outil(s) importé(s) : '+added.map(function(t){return 'T'+t.num+' '+t.name;}).join(', ').slice(0,160));
  return added;
}
function faoToolsImportText(setup,text,fname){
  // Cœur de l'import (sans le choix du fichier) : 1 outil = direct, plusieurs = fenêtre de choix.
  const pack=faoToolsParse(text);
  if(pack.err){ faoClipMsg('import des outils — '+pack.err); return null; }
  if(pack.tools.length===1){ faoToolsImportApply(setup,pack,pack.tools); return null; }
  return faoToolsImportDialog(setup,pack,fname);
}
function faoToolsImportFile(setup){
  try{
    const inp=document.createElement('input');inp.type='file';inp.accept='.ccoutils,.json,application/json';
    inp.onchange=function(){
      const f=inp.files&&inp.files[0];if(!f)return;
      const rd=new FileReader();
      rd.onload=function(){ faoToolsImportText(setup,rd.result,f.name); };
      rd.onerror=function(){ faoClipMsg('import des outils — fichier illisible.'); };
      rd.readAsText(f);
    };
    inp.click();
  }catch(e){ faoClipMsg('import des outils impossible : '+((e&&e.message)||e)); }
}
/* ----- fenêtre de choix : quels outils du fichier importer ----- */
function faoToolsImportDialog(setup,pack,fname){
  const mk=function(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
  const bg=mk('div','mffDlgBg'),d=mk('div','mffDlg fao-imp');
  d.appendChild(mk('div','fao-imp-t','Importer des outils'));
  d.appendChild(mk('div','fao-imp-s',(fname?(fname+' — '):'')+pack.tools.length+' outils dans le fichier. Cochez ceux à ajouter à « '+(setup.name||'posage')+' ».'));
  const list=mk('div','fao-imp-list');d.appendChild(list);
  const boxes=[];
  const bOk=mk('button','primary');
  const count=function(){
    const n=boxes.filter(function(b){return b.checked;}).length;
    bOk.textContent=n===boxes.length?('Importer les '+n):('Importer ('+n+')');
    bOk.disabled=!n;
  };
  pack.tools.forEach(function(t){
    const has=faoToolsHas(setup,t,pack);
    const it=mk('label','fao-imp-it');
    const cb=mk('input');cb.type='checkbox';cb.checked=!has;cb.onchange=count;
    it.appendChild(cb);
    const tx=mk('div','fao-imp-x');
    tx.appendChild(mk('div','fao-imp-n','T'+t.num+'  '+t.name));
    const hp=pack.holders.filter(function(h){return h.id===t.holderId;})[0];
    tx.appendChild(mk('div','fao-imp-d',faoKindLabel(t.kind)+' Ø'+t.d+(t.kind==='bull'?(' R'+(t.cornerR||0)):'')
      +(t.kind==='tap'?'':(' · '+(t.flutes||2)+' dents'))+(hp?(' · '+hp.name):'')));
    it.appendChild(tx);
    if(has)it.appendChild(mk('span','fao-imp-has','déjà présent'));
    list.appendChild(it);boxes.push(cb);
  });
  const row=mk('div','mffBtns');
  const all=function(v){ return function(){ boxes.forEach(function(b){b.checked=v;}); count(); }; };
  const bA=mk('button','','Tout cocher');bA.onclick=all(true);
  const bN=mk('button','','Tout décocher');bN.onclick=all(false);
  const sp=mk('span','fao-imp-sp');
  const bC=mk('button','','Annuler');
  const close=function(){ try{document.removeEventListener('keydown',key,true);}catch(e){} try{bg.remove();}catch(e){} };
  const key=function(e){ if(e.key==='Escape'){ e.preventDefault();e.stopPropagation();close(); } };
  bC.onclick=close;
  bOk.onclick=function(){
    const picked=pack.tools.filter(function(t,i){return boxes[i].checked;});
    if(!picked.length)return;
    close();faoToolsImportApply(setup,pack,picked);
  };
  [bA,bN,sp,bC,bOk].forEach(function(b){row.appendChild(b);});
  d.appendChild(row);bg.appendChild(d);
  count();
  document.body.appendChild(bg);
  try{document.addEventListener('keydown',key,true);}catch(e){}
  return bg;
}
