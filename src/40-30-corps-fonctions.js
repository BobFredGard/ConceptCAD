function docSanitise(){
  // Répare un document rechargé : instance en double, instance sans répétition, esquisse
  // d'instance abandonnée et nombre de copies aberrant. Les esquisses LIBRES (non
  // consommées par une extrusion) sont conservées : elles sont légitimes.
  // Les corps conteneurs sont normalisés aussi (anciens documents : tout vers « Corps 1 »).
  try{ensureBodies();}catch(e){}
  let dup=0,orph=0,sk=0,cap=0;
  const seen=new Set();
  doc.features=(doc.features||[]).filter(f=>{
    if(!f||!f.id)return false;
    if(seen.has(f.id)){dup++;return false;}
    seen.add(f.id);return true;
  });
  const repIds=new Set(doc.features.filter(f=>f.type==='repeat').map(f=>f.id));
  doc.features=doc.features.filter(f=>{if(f.repeatId&&!repIds.has(f.repeatId)){orph++;return false;}return true;});
  doc.features.forEach(f=>{if(f.type==='repeat'){const c=repMaxCopies(f.copies);if(c!==Math.floor(+f.copies||1))cap++;f.copies=c;}});
  // 2026-10-23 : répétition circulaire sur un tour complet — l'ancien pas (360°/copies) posait la
  // dernière copie SUR l'original (perçage doublé, paroi scindée). Le nouveau pas partage le tour
  // entre original + copies : on retire cette copie superflue, la pièce garde ses positions.
  doc.features.forEach(f=>{
    if(f.type!=='repeat'||f.q)return;f.q=1;
    if(f.mode==='circ'&&Math.abs(+f.angle||360)>=360-1e-9&&f.copies>=2){f.copies--;cap++;try{repGenChildren(f);}catch(e){}}
  });
  const used=new Set(doc.features.map(f=>f.sketchId).concat(doc.features.map(f=>f.pathId)).filter(Boolean));
  doc.sketches=(doc.sketches||[]).filter(x=>{
    if(used.has(x.id))return true;
    if(repCloneSkName(x)){sk++;return false;}
    return true;
  });
  // Nom des congés/chanfreins exacts : une ancienne version pouvait perdre des arêtes
  // (fusion de jumeaux sur des arcs sans ancre) et laisser « Congé exact (16 arête(s)) »
  // alors qu'il n'en restait que 12 — un nom menteur dans l'arbre. On le réaligne sur la
  // géométrie réelle au chargement. Les noms de fonctions ne sont pas éditables à la main.
  let ren=0;
  doc.features.forEach(f=>{if(f.type==='xfillet'){const n=xFeatName(f);if(f.name!==n){f.name=n;ren++;}}});
  // Même raison pour le dépouillage : un nom qui annonce « 3 face(s) » quand il en reste 1
  // (faces disparues après une modification en amont) doit être remis d'aplomb au chargement.
  doc.features.forEach(f=>{if(f.type==='xdraft'){const n=draftName(f);if(f.name!==n){f.name=n;ren++;}}});
  // Même raison pour la coque : « 2 face(s) retirée(s) » doit suivre la sélection réelle.
  doc.features.forEach(f=>{if(f.type==='xshell'){const n=shellName(f);if(f.name!==n){f.name=n;ren++;}}});
  return {dup,orph,sk,cap,ren};
}
function delFeature(f){
  if(!f)return;
  if(f.type==='repeat'){repRemoveRepeat(f);return;}
  doc.features=doc.features.filter(x=>x.id!==f.id);
  doc.features.forEach(rp=>{if(rp.type==='repeat')rp.base=rp.base.filter(id=>id!==f.id);});
  if(tlMark===f.id)tlMark=null;
  if(f.type==='xsplit'||f.type==='bscale')splitOnDelete(f); // corps neuf vide d'une scission (85-scinder) ou d'une échelle en copie
}
// Le bouton vit ici (sources, jamais la coque HTML — même règle que Révolution) :
// après Révolution si présente, sinon après Extrusion. Le regroupement du bandeau
// (96) ne déplace que ses ids connus : ➕ Corps reste en direct, action primaire.
(function(){
  if(typeof document==='undefined'||document.getElementById('btnBody'))return;
  const after=document.getElementById('btnRevolve')||document.getElementById('btnExtrude');
  if(!after||!after.parentNode)return;
  const b=document.createElement('button');
  b.id='btnBody';b.textContent='◧ Corps';
  b.title='Nouveau corps : les fonctions suivantes naîtront dedans (il devient actif ●)';
  b.onclick=()=>newBody();
  after.parentNode.insertBefore(b,after.nextSibling);
})();
// V0.15.12 : CORPS VISÉS par une découpe (poche, perçage, révolution en retrait). Dès que
// plusieurs corps sont visibles à cet instant de la timeline, on propose : son corps seul,
// TOUS les corps visibles (f.cutBodies, rejouée dans chacun — cf. occCutExtraBodies) ou UN
// corps en particulier (la fonction change de corps, comme un glisser-déposer dans l'arbre).
function cutBodyCandidates(f){
  const i=doc.features.indexOf(f);
  const consumed=new Set();
  doc.features.slice(0,i<0?undefined:i).forEach(x=>{if(x&&x.type==='combine'&&!x.keep&&x.visible!==false)(x.tools||[]).forEach(t=>consumed.add(t));});
  return (doc.bodies||[]).filter(e=>{
    if(!e||consumed.has(e.id))return false;
    if(doc.bodyVis&&doc.bodyVis[e.id]===false)return false;
    if(bodyRemovedAt(e.id,i))return false;
    try{if(!bodyEnabledOf(e.id))return false;}catch(err){}
    try{return bodyBornAt(e.id,i);}catch(err){return true;}
  });
}
function cutBodiesField(f){
  // Rend la ligne « Corps visés », ou null s'il n'y a qu'un corps visible
  if(!occIsCutFeat(f)||f.repeatId)return null;
  const own=occBodyOfFeat(f);
  const cand=cutBodyCandidates(f).filter(e=>e.id!==own);
  const extra=occCutExtraBodies(f);
  if(!cand.length&&!extra.length)return null;
  const nm=id=>{const e=(doc.bodies||[]).find(x=>x.id===id);return e?e.name:id;};
  const all=cand.length>0&&cand.every(e=>extra.indexOf(e.id)>=0);
  const cur=!extra.length?'own':(all?'all':'custom');
  const r=document.createElement('div');r.className='pnl-row';
  const L=document.createElement('label');L.textContent='Corps visés';r.appendChild(L);
  const s=document.createElement('select');s.className='cutBodiesSel';
  const opt=(v,t,tip)=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(tip)o.title=tip;s.appendChild(o);};
  opt('own','Son corps seul — « '+nm(own)+' »','La découpe ne retire de la matière qu’à son corps');
  opt('all','Tous les corps visibles ('+(cand.length+1)+')','La découpe traverse chaque corps visible à cet instant de la timeline');
  if(cur==='custom')opt('custom','Sélection : '+[own].concat(extra).map(nm).join(', '));
  cand.forEach(e=>opt('b:'+e.id,'Seulement « '+e.name+' »','La fonction passe dans « '+e.name+' » (et ne touche plus « '+nm(own)+' »)'));
  s.value=cur;
  s.title='Plusieurs corps sont visibles : choisir sur lesquels la découpe s’applique';
  s.onchange=()=>{
    const v=s.value;
    if(v==='custom')return;
    if(v.startsWith('b:')){
      const bid=v.slice(2);
      docPushUndo('corps visés par « '+f.name+' »');
      delete f.cutBodies;f.body=bid;
      try{repSyncForFeature(f);}catch(e){}
      markDirty();rebuild();renderTree();renderProps();refreshParts();
      try{faceEl.textContent='« '+f.name+' » découpe maintenant « '+nm(bid)+' » seulement.';}catch(e){}
      return;
    }
    docPushUndo('corps visés par « '+f.name+' »');
    if(v==='all')f.cutBodies=cand.map(e=>e.id);else delete f.cutBodies;
    try{repSyncForFeature(f);}catch(e){}
    markDirty();rebuild();renderTree();renderProps();refreshParts();
    try{faceEl.textContent=v==='all'?'« '+f.name+' » découpe les '+(cand.length+1)+' corps visibles.':'« '+f.name+' » ne découpe plus que « '+nm(own)+' ».';}catch(e){}
  };
  r.appendChild(s);
  return r;
}
// Corps d'une fonction, au choix dans son panneau (même effet qu'un glisser-déposer dans
// l'arbre) : extrusion, révolution, balayage, perçage — pas les copies de répétition ni la
// fonction qui crée son propre corps. Candidats : les corps déjà nés à cet instant de la timeline.
function featBodyLock(f){
  // Raison qui interdit de changer f de corps, ou '' : source d'une répétition « nouveau
  // corps » (ses exemplaires — corps nommés, fonctions ajoutées — seraient recréés sous
  // d'autres ids).
  if(!f)return '';
  if(doc.features.some(rp=>rp.type==='repeat'&&repIsNewBody(rp)&&(rp.base||[]).indexOf(f.id)>=0))
    return '« '+f.name+' » est la source d’une répétition « nouveau corps » : la changer de corps recréerait ses exemplaires.';
  return '';
}
function featBodyChoices(f){
  if(!f||f.repeatId||f.newBody||TREE_TO_BODY.indexOf(f.type)<0||featBodyLock(f))return [];
  const i=doc.features.indexOf(f),own=occBodyOfFeat(f);
  // corps ordinaire (◧ Corps, migration) : il existe dès le départ ; un corps né d'une
  // fonction (répétition, extrusion « nouveau corps », scission) seulement après elle
  const plain=bid=>!repBodyOwner(bid)&&!doc.features.some(x=>(x.newBody===true&&x.body===bid)||x.newBody===bid);
  const L=(doc.bodies||[]).filter(e=>{
    if(e.id===own)return true;
    if(bodyRemovedAt(e.id,i))return false;
    try{return plain(e.id)||bodyBornAt(e.id,i);}catch(err){return true;}
  });
  return L.length>1?L:[];
}
function featBodyField(f){
  const L=featBodyChoices(f);
  if(!L.length)return null;
  const r=document.createElement('div');r.className='pnl-row';
  const lab=document.createElement('label');lab.textContent='Corps';r.appendChild(lab);
  const s=document.createElement('select');s.className='featBodySel';
  L.forEach(e=>{const o=document.createElement('option');o.value=e.id;o.textContent=e.name;s.appendChild(o);});
  s.value=occBodyOfFeat(f);
  s.title='Corps modifié par cette fonction';
  s.onchange=()=>{if(!treeFeatToBody(f.id,s.value))s.value=occBodyOfFeat(f);};
  r.appendChild(s);
  return r;
}
function newBody(){
  // Crée un corps VIDE et l'ACTIVE : esquissez puis extrudez, la fonction naîtra
  // dedans (addFeature taggue au corps actif). Annulable comme toute modification.
  try{ensureBodies();}catch(e){}
  docPushUndo('création d\'un corps');
  const n=doc.bodySeq++;
  const e={id:'b'+n,name:'Corps '+n,c:null};
  doc.bodies.push(e);doc.activeBody=e.id;
  treeSel=[];sel={kind:'body',id:e.id};
  try{dirty=true;}catch(e2){}
  renderTree();renderProps();refreshParts();
  try{faceEl.textContent='« '+e.name+' » créé et ACTIF (●) : esquissez puis extrudez — la fonction naîtra dedans.';}catch(e2){}
}
function bodyTextColor(be){
  // Couleur du NOM du corps dans l'arbre : celle du mesh affiché si présent
  // (toujours définie : palette auto au pire), sinon celle de la fiche, sinon
  // couleur du texte par défaut (''). Même source que la pièce 3D : on lit le corps.
  try{
    const live=bodies.find(b=>b.kind==='body'&&b.id===be.id);
    const c=(live&&isFinite(+live.color)&&+live.color>0)?+live.color:((be&&isFinite(+be.color)&&+be.color>0)?+be.color:0);
    return c?cssHex(c):'';
  }catch(e){return '';}
}
function bodyToggleVis(id){
  // Œil du corps = VUE SEULE : le mesh disparaît de la 3D, rien d'autre ne bouge.
  // Le corps reste dans le rejeu (f.visible inchangé), reste le corps actif, et
  // reste exportable — cacher ne désactive plus. Séparation stricte des 3 rôles :
  //   👁 = vue (doc.bodyVis, ce fichier) · ⏻ = rejeu (bodyToggleEnabled) · ● = actif.
  try{
    const caché=!!(doc.bodyVis&&doc.bodyVis[id]===false);
    if(caché){
      delete doc.bodyVis[id];
      // Un corps masqué comme BRUT FAO (doc.bodyVis=false posé par faoStockBodyHide_)
      // revient par l'œil : on ne défait QUE ce qu'on a fait.
      const s=(typeof faoSetup==='function')?faoSetup():null;
      if(s&&s.stockSrc==='body'&&s.stockBody===id)s.stockBodyHid=false;
      const bd=(typeof bodies!=='undefined'&&bodies?bodies:[]).filter(function(b){return b&&b.id===id;})[0];
      if(bd){bd.visible=true;if(bd.mesh)bd.mesh.visible=true;}
      markDirty();refreshParts();renderTree();
      return;
    }
    doc.bodyVis=doc.bodyVis||{};doc.bodyVis[id]=false;
    const bd=(typeof bodies!=='undefined'&&bodies?bodies:[]).filter(function(b){return b&&b.id===id;})[0];
    if(bd){bd.visible=false;if(bd.mesh)bd.mesh.visible=false;}
    markDirty();refreshParts();renderTree();
  }catch(e){}
}
function bodyEnabledOf(id){
  // true = toutes les fonctions du corps sont dans le rejeu (⏻ allumé).
  try{
    const kids=doc.features.filter(f=>!f.repeatId&&f.body===id);
    if(!kids.length)return true;
    const specs=kids.concat(doc.features.filter(k=>k.repeatId&&k.body===id));
    return specs.some(f=>f.visible!==false);
  }catch(e){return true;}
}
function bodyToggleEnabled(id){
  // ⏻ du corps = REJEU : bascule f.visible sur TOUTES ses fonctions (et leurs
  // instances de répétition) — exactement ce que faisait l'œil avant. Une seule
  // source de vérité, annulable (Ctrl+Z), persistée dans le document.
  // N' touche à AUCUNE visibilité de mesh : le corps reste affiché (grisé hors rejeu).
  const kids=doc.features.filter(f=>!f.repeatId&&f.body===id);
  const vis=!bodyEnabledOf(id); // tout est dedans → on coupe, sinon on rallume
  kids.forEach(f=>{f.visible=vis;});
  doc.features.forEach(k=>{if(k.repeatId&&k.body===id)k.visible=vis;});
  markDirty();rebuild();renderTree();
}
function featBlockOf(f,F){
  // Bloc déplaçable d'un cran : fonction simple ([i,i]) ou répétition + ses
  // instances ([i,j], contiguës par construction de repGenChildren). Une instance
  // seule n'est jamais déplaçable (dérivée) : null. F = liste de travail (doc.features par défaut).
  F=F||doc.features;
  const i=F.indexOf(f);
  if(!f||i<0||f.repeatId)return null;
  if(f.type!=='repeat')return [i,i];
  const kids=F.filter(k=>k.repeatId===f.id);
  const j=i+kids.length;
  for(let k=i+1;k<=j;k++){const o=F[k];if(!o||o.repeatId!==f.id)return null;}
  return [i,j];
}
let featMoveWhy=null; // raison du dernier refus de featMoveRaw (antériorité), null = aucun
function featMoveRaw(F,id,dir){
  // Cœur de featMove sur une liste de travail F (modifiée en place) : décale le bloc d'un
  // cran DANS SON CORPS, sans annulation ni rejeu. Partagé avec le glisser-déposer du
  // bandeau de timeline (41), qui enchaîne les crans sur une copie. Retourne true si fait.
  // Un cran qui ferait passer une fonction avant ce dont elle dépend (43, antériorité) est
  // refusé : F reste intact et featMoveWhy dit pourquoi.
  featMoveWhy=null;
  const G=F.slice();
  if(!featMoveStep(G,id,dir))return false;
  const v=antNewViolation(F,G);
  if(v){featMoveWhy=antMsg(v);return false;}
  F.splice(0,F.length,...G);
  return true;
}
function featMoveFail(){
  // Message d'un ▲▼ qui n'a rien fait : refus d'antériorité, sinon bout du corps
  try{faceEl.textContent=featMoveWhy?'⛔ Déplacement refusé : '+featMoveWhy:'Déjà en tête / en fin de corps — rien à décaler.';}catch(e){}
}
function featMoveStep(F,id,dir){
  // Un cran, sans contrôle d'antériorité (voir featMoveRaw)
  const f=F.find(x=>x.id===id);
  if(!f||(dir!==1&&dir!==-1))return false;
  const bl=featBlockOf(f,F);
  if(!bl)return false;
  const mine=f.body, L=bl[1]-bl[0]+1;
  const topAt=k=>{ // début du bloc contenant l'index k (conteneur ou fonction simple)
    const o=F[k];if(!o)return -1;
    if(o.repeatId){const c=F.findIndex(x=>x.id===o.repeatId&&x.type==='repeat');return c;}
    return k;
  };
  const blkLen=k=>{const o=F[k];return (o&&o.type==='repeat'&&!o.repeatId)?F.filter(x=>x.repeatId===o.id).length:0;};
  let at=-1,after=0;
  if(dir<0){
    let k=bl[0]-1;
    while(k>=0){
      const s=topAt(k);
      if(s<0||s>=bl[0]){k--;continue;}
      if(F[s].body===mine){at=s;after=0;break;}
      k=s-1; // saute le bloc entier d'un autre corps
    }
    if(at<0)return false;
    const seg=F.splice(bl[0],L);
    F.splice(at,0,...seg);
  }else{
    let k=bl[1]+1;
    while(k<F.length){
      const o=F[k];
      if(o.repeatId){k++;continue;} // anomalie (instance sans conteneur avant) : on avance
      const e=k+blkLen(k);
      if(o.body===mine){at=k;after=e-k+1;break;}
      k=e+1; // saute le bloc entier d'un autre corps
    }
    if(at<0)return false;
    const seg=F.splice(bl[0],L);
    F.splice(at-L+after,0,...seg);
  }
  return true;
}
function featMoveApply(A,label){
  // Pose un nouvel ordre de doc.features (même tableau, même contenu) : une étape d'annulation + rejeu
  docPushUndo(label);
  doc.features.splice(0,doc.features.length,...A);
  markDirty();rebuild();renderTree();renderProps();
}
function featMove(id,dir){
  // Décale un bloc d'un cran DANS SON CORPS (ordre de rejeu du corps), en sautant
  // les fonctions des autres corps et les blocs voisins entiers. L'ordre global
  // n'a de sens que par corps depuis les corps conteneurs : A2 peut passer devant
  // A1 même si B1 est entre les deux. Annulable (une étape). Retourne true si fait.
  const A=doc.features.slice();
  if(!featMoveRaw(A,id,dir))return false;
  const f=doc.features.find(x=>x.id===id);
  featMoveApply(A,'déplacement de « '+f.name+' »');
  return true;
}
function delBody(id){
  // Supprime le corps et SES fonctions, SANS emporter les autres corps :
  //  - corps exemplaire d'une répétition « nouveau corps » : l'exemplaire est retiré de la
  //    répétition (rp.dropKeys), les autres exemplaires restent ; plus aucun → répétition retirée ;
  //  - répétition dont toutes les sources sont dans ce corps : ses copies rangées dans
  //    D'AUTRES corps sont DÉTACHÉES (fonctions ordinaires, géométrie inchangée) avant
  //    qu'elle parte ; à cheval sur plusieurs corps, elle perd seulement ces sources ;
  //  - combinaisons et découpes multi-corps des autres corps oublient ce corps ;
  //  - les esquisses posées sur ses faces restent où elles sont (hôte périmé : 20/resolve).
  const e=(doc.bodies||[]).find(x=>x.id===id);
  if(!e)return;
  const kids=doc.features.filter(f=>f.body===id&&!f.repeatId);
  const nF=kids.filter(f=>f.type!=='repeat'&&!(f.cutBodies||[]).some(b=>b!==id)).length; // découpes multi-corps : gardées
  if(!confirm('Supprimer « '+e.name+' »'+(nF?(' et ses '+nF+' fonction(s)'):'')+' ? Les autres corps sont conservés.'))return;
  docPushUndo('suppression de « '+e.name+' »');
  // 1) exemplaire d'une répétition « nouveau corps »
  doc.features.filter(rp=>rp.type==='repeat'&&rp.bodyMap).forEach(rp=>{
    const keys=Object.keys(rp.bodyMap).filter(k=>rp.bodyMap[k]===id);
    if(!keys.length)return;
    rp.dropKeys=(rp.dropKeys||[]).concat(keys.filter(k=>(rp.dropKeys||[]).indexOf(k)<0));
    if(!repGenChildren(rp))repRemoveRepeat(rp);
  });
  // 2) répétitions qui consomment des fonctions de ce corps
  const srcIds=new Set(doc.features.filter(f=>f.body===id&&!f.repeatId).map(f=>f.id));
  doc.features.filter(rp=>rp.type==='repeat'&&(rp.base||[]).some(b=>srcIds.has(b))).forEach(rp=>{
    const keep=(rp.base||[]).filter(b=>!srcIds.has(b));
    if(keep.length){
      rp.base=keep;
      if(rp.body===id){const k0=doc.features.find(x=>x.id===keep[0]);if(k0)rp.body=k0.body;}
      repGenChildren(rp);return;
    }
    repDetachCopies(rp,id);
    delFeature(rp);
  });
  // 3) ses fonctions — une découpe qui traverse aussi d'autres corps y reste
  doc.features.filter(f=>f.body===id).forEach(f=>{
    const o=Array.isArray(f.cutBodies)?f.cutBodies.filter(b=>b!==id&&doc.bodies.some(x=>x.id===b)):[];
    if(o.length&&!f.repeatId){f.body=o[0];if(o.length>1)f.cutBodies=o.slice(1);else delete f.cutBodies;return;}
    delFeature(f);
  });
  // 4) références des autres corps à celui-ci
  doc.features.slice().forEach(f=>{
    if(Array.isArray(f.cutBodies)){f.cutBodies=f.cutBodies.filter(b=>b!==id);if(!f.cutBodies.length)delete f.cutBodies;}
    if(f.type==='combine'&&Array.isArray(f.tools)&&f.tools.indexOf(id)>=0){
      f.tools=f.tools.filter(b=>b!==id);
      if(!f.tools.length)delFeature(f);
    }
  });
  doc.bodies=doc.bodies.filter(x=>x.id!==id);
  if(!doc.bodies.length){const n=doc.bodySeq++;const nid='b'+n;doc.bodies.push({id:nid,name:'Corps '+n,c:null});}
  if(!doc.bodies.some(x=>x.id===doc.activeBody))doc.activeBody=doc.bodies[0].id;
  treeSel=[];sel={kind:'body',id:doc.activeBody};
  markDirty();rebuild();renderTree();renderProps();
}

// « Retirer » un corps (comme Fusion 360) : une ÉTAPE de la timeline {type:'bremove', body}
// au marqueur — le corps disparaît à partir de là, ses fonctions et les autres corps restent.
// Supprimer l'étape (ou reculer le marqueur avant elle) le fait revenir.
function bodyRemoveAdd(id){
  const e=(doc.bodies||[]).find(x=>x.id===id);
  if(!e)return null;
  const i=tlIdx(),L=i<0?doc.features:doc.features.slice(0,i);
  if(L.some(f=>f.type==='bremove'&&f.body===id)){try{faceEl.textContent='« '+e.name+' » est déjà retiré à cet instant de la timeline.';}catch(err){}return null;}
  const f={id:uid('br'),type:'bremove',name:'Retirer « '+e.name+' »',body:id,visible:true};
  addFeature(f);
  if(doc.activeBody===id){const o=doc.bodies.find(x=>x.id!==id);if(o)doc.activeBody=o.id;}
  sel={kind:'feature',id:f.id};treeSel=[];
  markDirty();rebuild();renderTree();renderProps();
  try{faceEl.textContent='« '+e.name+' » retiré à partir de cette étape (timeline) : supprimez l’étape pour le faire revenir.';}catch(err){}
  return f;
}
function bodyConsumedBy(bid,idx){
  // V0.47.2 : étape qui fait disparaître ce corps avant idx (null = fin de la timeline) : outil d'une
  // combinaison sans « garder », ou « Retirer ». Marqueur reculé avant elle : le corps est de nouveau là.
  const L=doc.features||[],n=idx==null||idx<0?L.length:idx;
  for(let k=0;k<n;k++){const f=L[k];if(!f||f.visible===false)continue;
    if(f.type==='bremove'&&f.body===bid)return f;
    if(f.type==='combine'&&!f.keep&&(f.tools||[]).indexOf(bid)>=0)return f;}
  return null;
}
function bodyRemovedAt(bid,idx){
  // true si une étape « Retirer » de ce corps précède idx (null = fin de la timeline)
  const L=doc.features||[],n=idx==null||idx<0?L.length:idx;
  for(let k=0;k<n;k++){const f=L[k];if(f&&f.type==='bremove'&&f.body===bid&&f.visible!==false)return true;}
  return false;
}
const bremCtxBtns={};
function bremCtxSync(t,menuId){
  // entrée du clic droit d'un corps : arbre (juste après « Supprimer ») et vue 3D (avant « Déplacer »).
  // V0.47.1 : vue 3D — l'id cliqué peut être celui du corps affiché, d'où ctxBodyId ; pas en mode Assembler.
  menuId=menuId||'ctxMenu';
  const m=document.getElementById(menuId);if(!m)return;
  let b=bremCtxBtns[menuId];
  if(!b){
    b=document.createElement('button');b.textContent='⊘ Retirer (timeline)';
    b.title='Comme Fusion 360 : ajoute une étape « Retirer » dans la timeline — le corps disparaît à partir de là, sans rien effacer';
    const del=m.querySelector('button[data-act="del"]'),mv=bmCtxBtns[menuId];
    if(del)m.insertBefore(b,del.nextSibling);
    else if(mv&&mv.parentNode===m)m.insertBefore(b,mv);
    else m.insertBefore(b,m.firstChild);
    b.onclick=()=>{const T=b._t;try{hideCtx();hideCtx3D();}catch(e){}if(T)bodyRemoveAdd(ctxBodyId(T)||T.id);};
    bremCtxBtns[menuId]=b;
  }
  b._t=t;
  let bid=null;try{bid=t&&t.kind==='body'&&t.id?ctxBodyId(t):null;}catch(e){}
  b.style.display=(bid&&(doc.bodies||[]).some(x=>x.id===bid)&&(menuId==='ctxMenu'||asmMode!=='asm'))?'':'none';
}

// ── sélection multiple + suppression ─────────────────────────────────────────
// Le lot mêle esquisses, fonctions et éléments de construction (ids uniques, uid) :
// le genre se retrouve par l'id. V0.19.8 : Shift+clic = plage, dans le genre cliqué.
let treeAnchor=null; // dernier clic simple ou Ctrl : origine de la plage Shift
const TREE_LOT_KINDS=['feature','sketch','cg'];
function treeKindOf(id){
  if(doc.features.some(f=>f.id===id))return 'feature';
  if((doc.sketches||[]).some(s=>s.id===id))return 'sketch';
  if((doc.cgeo||[]).some(c=>c.id===id))return 'cg';
  return null;
}
// Ordre d'affichage de l'arbre pour un genre (42 : esquisses, construction, corps → fonctions)
function treeOrderOf(kind){
  if(kind==='sketch')return (doc.sketches||[]).filter(s=>!skIsRepCopy(s)).map(s=>s.id);
  if(kind==='cg')return (doc.cgeo||[]).filter(cgValid).filter(c=>!cgLocked(c)).map(c=>c.id);
  const B=((doc.bodies||[]).length?doc.bodies:[{id:'b1'}]).map(e=>e.id);
  const bodyOf=f=>B.indexOf(f.body)>=0?f.body:B[0];
  const out=[];
  B.forEach(b=>doc.features.forEach(f=>{if(!f.repeatId&&!tlLocked(f)&&bodyOf(f)===b)out.push(f.id);}));
  return out;
}
function treeLotMsg(){
  const n=treeSel.length;
  faceEl.textContent=n?(n+' élément(s) sélectionné(s) — Suppr pour supprimer, Échap pour désélectionner.')
                    :'Sélection vidée.';
}
// Clic d'une ligne du lot : Ctrl = ajouter / retirer, Shift = plage depuis le dernier clic.
// → true si traité ; sinon clic simple, l'appelant sélectionne et appelle treeSelSet.
function treeSelClick(kind,id,ev){
  if(!ev||TREE_LOT_KINDS.indexOf(kind)<0)return false;
  if(ev.shiftKey){treeSelRange(kind,id,!!(ev.ctrlKey||ev.metaKey));return true;}
  if(ev.ctrlKey||ev.metaKey){treeSelToggle(id,kind);return true;}
  treeAnchor=id;
  return false;
}
function treeSelToggle(id,kind){
  kind=kind||treeKindOf(id)||'feature';
  // le clic simple d'avant n'est pas encore dans le lot : il en fait partie
  if(!treeSel.length&&sel&&TREE_LOT_KINDS.indexOf(sel.kind)>=0&&sel.id&&sel.id!==id)treeSel=[sel.id];
  const i=treeSel.indexOf(id);
  if(i>=0){if(treeSel.length===1)treeSel=[];else treeSel.splice(i,1);}
  else treeSel.push(id);
  treeAnchor=id;
  // `sel` suit le dernier clic : le panneau de propriétés reste cohérent
  sel={kind,id};
  renderTree();renderProps();refreshParts();
  try{if(kind==='cg')cgDraw();}catch(e){}
  treeLotMsg();
}
function treeSelRange(kind,id,ajout){
  const ord=treeOrderOf(kind);
  let a=treeAnchor&&ord.indexOf(treeAnchor)>=0?ord.indexOf(treeAnchor):-1;
  if(a<0&&sel&&sel.kind===kind)a=ord.indexOf(sel.id);
  const b=ord.indexOf(id);
  if(b<0)return;
  if(a<0)a=b;
  const plage=ord.slice(Math.min(a,b),Math.max(a,b)+1);
  // Shift seul remplace le lot ; Ctrl+Shift ajoute la plage. L'ancre ne bouge pas.
  treeSel=ajout?treeSel.concat(plage.filter(x=>treeSel.indexOf(x)<0)):plage;
  sel={kind,id};
  renderTree();renderProps();refreshParts();
  try{if(kind==='cg')cgDraw();}catch(e){}
  treeLotMsg();
}
function treeSelIds(){
  if(treeSel&&treeSel.length)return treeSel.slice();
  if(sel&&TREE_LOT_KINDS.indexOf(sel.kind)>=0&&sel.id)return [sel.id];
  return [];
}
// Ce qui DÉPEND des fonctions visées et qu'il faut donc emporter avec elles :
// congé/chanfrein exact (target), répétition (base), et — en cascade de suppression
//elles-mêmes — les dépendances de dépendances (boucle bornée à quelques tours).
function treeSelDeps(ids){
  const set=new Set(ids),out=[];
  const ajouter=id=>{if(id&&!set.has(id)){set.add(id);out.push(id);}};
  for(let tour=0;tour<4;tour++){
    let trouve=false;
    doc.features.forEach(f=>{
      if(set.has(f.id))return;
      if((f.type==='xfillet'||f.type==='fillet')&&set.has(f.target)){ajouter(f.id);trouve=true;}
      if(f.type==='repeat'&&(f.base||[]).some(b=>set.has(b))){ajouter(f.id);trouve=true;}
    });
    if(!trouve)break;
  }
  return out;
}
function treeDeleteSel(){
  const lot=treeSelIds();
  const skIds=lot.filter(id=>(doc.sketches||[]).some(s=>s.id===id));
  const cgIds=lot.filter(id=>(doc.cgeo||[]).some(c=>c.id===id));
  // une esquisse emporte les fonctions tracées dessus (comme le menu clic droit)
  const ids=lot.filter(id=>doc.features.some(f=>f.id===id));
  doc.features.forEach(f=>{if(f.sketchId&&skIds.indexOf(f.sketchId)>=0&&ids.indexOf(f.id)<0)ids.push(f.id);});
  if(!ids.length&&!skIds.length&&!cgIds.length)return;
  const noms=id=>{const f=doc.features.find(x=>x.id===id)||(doc.sketches||[]).find(x=>x.id===id)||(doc.cgeo||[]).find(x=>x.id===id);return f?f.name:id;};
  const deps=treeSelDeps(ids);
  const feats=ids.concat(deps);
  const tous=skIds.concat(cgIds,feats);
  let msg;
  if(tous.length===1)msg='Supprimer « '+noms(tous[0])+' » ?';
  else msg='Supprimer '+[skIds.length?skIds.length+' esquisse(s)':'',cgIds.length?cgIds.length+' élément(s) de construction':'',
    feats.length?feats.length+' fonction(s)':''].filter(Boolean).join(', ')+' ?\n\n· '+tous.map(noms).join('\n· ');
  if(deps.length)msg+='\n\n'+deps.length+' fonction(s) en dépendent : elles seront supprimées aussi.';
  // les esquisses posées sur une face de la fonction supprimée ne sont PAS
  // détruites (trop destructif) : on prévient qu'elles perdent leur hôte.
  const skDep=(doc.sketches||[]).filter(s=>s.host&&ids.indexOf(s.host.feat)>=0&&skIds.indexOf(s.id)<0);
  if(skDep.length)msg+='\n'+skDep.length+' esquisse(s) sont posées sur ses faces : elles resteront, sans hôte.';
  if(!confirm(msg))return;
  const nomsTous=tous.map(noms);
  docPushUndo('suppression de '+tous.length+' élément(s)');
  feats.slice().forEach(id=>{
    const f=doc.features.find(x=>x.id===id);
    if(f)delFeature(f);
  });
  if(skIds.length)doc.sketches=doc.sketches.filter(s=>skIds.indexOf(s.id)<0);
  // construction : comme cgDelete (78), sous la même annulation
  cgIds.forEach(id=>{
    doc.cgeo=doc.cgeo.filter(c=>c.id!==id);
    (doc.sketches||[]).forEach(sk=>{if(sk.plane==='CG'&&sk.cg&&sk.cg.id===id)cgDetachSketch(sk);});
  });
  treeSel=[];treeAnchor=null;sel={kind:null,id:null};
  if(cgIds.length)try{cgRefresh();}catch(e){}
  markDirty();rebuild();
  renderTree();renderProps();refreshParts();
  try{buildEdgeOverlay();}catch(e){}
  try{refreshMirror();}catch(e){}
  faceEl.textContent='🗑 Supprimé : '+nomsTous.join(', ')+'  —  Ctrl+Z pour annuler.';
}
