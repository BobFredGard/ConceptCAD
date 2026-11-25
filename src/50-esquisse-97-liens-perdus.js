/* ---------- ⚠ Liens perdus d'une esquisse (V0.99.82), comme Fusion ----------
   Demande de Fred : « quand une ou des arêtes ou faces manquent pour une esquisse, l'outil nous propose
   une fenêtre qui les recense et nous propose de les réattribuer », « ou de supprimer tout lien ou
   supprimer l'arête aussi », et « à chaque Réattribuer, il faut cacher la fenêtre pour accéder à la vue 3D ».
   Une fenêtre liste, pour UNE esquisse, ce qui ne retrouve plus sa source :
     · sa face porteuse ou son plan de construction (skFacePerdue, 50-esquisse-94) ;
     · une arête de la pièce projetée dont le nom n'existe plus (projPreferMid, 50-esquisse-1) : elle est
       raccrochée à l'arête la plus proche, peut-être la mauvaise → « à vérifier » ;
     · une arête d'une autre pièce dont l'instance n'est plus dans l'assemblage (lpNoteExt) ;
     · un trait d'une autre esquisse supprimé ou changé de forme (skpTrack, 50-esquisse-8) ;
     · une intersection qui ne coupe plus le plan (62), le centre d'un repère supprimé (50-esquisse-7).
   Une ligne par élément, et pour chacun :
     Réattribuer — la fenêtre se cache ; une face se clique dans la vue 3D (« Changer de face »), une arête
                   dans l'esquisse ouverte, comme l'outil Projeter (appui long = liste). L'élément garde son
                   identité : ses cotes et ses contraintes restent. La fenêtre revient ensuite (Échap aussi).
     Garder      — l'arête raccrochée par position est la bonne : elle est reprise telle quelle.
     Couper      — l'élément reste où il est, fixé (📌), et ne suit plus rien (e.sansLien, sk.planFige).
     Supprimer   — l'élément part, avec les cotes et contraintes qui ne tiennent qu'à lui.
   La fenêtre s'ouvre seule à l'ouverture d'une esquisse qui a des liens perdus, et par double-clic sur le
   ⚠ de l'arbre ou de la timeline ; le panneau des propriétés de l'esquisse a aussi son bouton. */
let lpEtat=null;   // {sk, el, cache} : fenêtre ouverte pour l'esquisse sk (cache : masquée le temps de Réattribuer)
let skLienRe=null; // {sk, eid} : élément qui attend sa nouvelle arête (outil Projeter détourné, 60)
let lpSurvol=null; // {sk, eid} : ligne survolée → élément allumé en orange dans l'esquisse
let lpSilence=0;   // esquisse ouverte PAR la fenêtre : pas de réouverture automatique
const LP_CLES_LIEN=['proj','isProj','srcMid','srcNom','srcName','projName','ext','skSrc','isect','pierce','orig'];

/* ----- recensement ----- */
function lpSketch(id){return(doc.sketches||[]).find(s=>s&&s.id===id)||null;}
function lpCles(sk,e){return[sk.id+'/'+e.id,'skp:'+sk.id+'/'+e.id];}
function lpOublier(sk,e){lpCles(sk,e).forEach(k=>{try{nomsPerteOubli(k);}catch(x){}});}
function lpIco(e){return e.t==='circle'?'◯':e.t==='arc'?'◠':e.t==='spline'?'∿':e.t==='cpoint'?'✕':'╱';}
function lpGenre(e){return e.t==='circle'?'un cercle':e.t==='arc'?'un arc':e.t==='cpoint'?'un point':e.t==='spline'?'une courbe':'une arête droite';}
function lpInstNom(path){
  // nom de l'instance au bout du chemin (« Socle:1 »), '' si le chemin est rompu
  try{let c=asmRoot(),o=null;for(const id of (path||[])){o=c&&c.occ.find(q=>q.id===id);if(!o)return '';c=asmComp(o.comp);}return o&&o.name||'';}
  catch(e){return '';}
}
function lpNom(e){
  const n=e.projName||({line:'Ligne',circle:'Cercle',arc:'Arc',spline:'Courbe',cpoint:'Point'}[e.t]||'Élément');
  let s=e.srcName;
  if(e.ext&&Array.isArray(e.ext.path)){const i=lpInstNom(e.ext.path);if(i)s=(s?s+' de ':'')+'« '+i+' »';}
  return n+(s?' · '+s:'');
}
function lpRaison(e,m){
  // message de NOMS_PERTES_ESQ → {raison courte, verif : raccrochée par position}
  let r=String(m||'');
  const i=r.indexOf(' : ');if(i>=0)r=r.slice(i+3);
  if(e.projName&&r.indexOf(e.projName+' — ')===0)r=r.slice(e.projName.length+3);
  if(/recherche par position/.test(r))return{raison:'son arête n’existe plus — raccrochée à la plus proche',verif:true,long:r};
  return{raison:r.replace(/ ; (elle|il) reste fig[ée]e?.*$/,' — figée'),verif:false,long:r};
}
function lpEstLie(sk,e){
  if(!e||e.sansLien)return false;
  if(e.proj||e.isProj||e.skSrc||e.isect||e.pierce||e.orig||e.ext)return true;
  try{return projEstProjetee(sk,e);}catch(x){return false;}
}
function lpListe(sk){
  // éléments perdus de l'esquisse, la face d'abord (le plan compte pour tout le reste)
  if(!sk||sk.fao)return[];
  const out=[];
  let fp=null;try{fp=skFacePerdue(sk);}catch(e){fp=null;}
  if(fp)out.push({k:'face',sk:sk.id,ico:'▢',nom:sk.plane==='CG'?'Plan de construction':'Face porteuse',raison:fp,long:fp,
    reat:true,couper:!!(sk.axN&&sk.axU&&sk.axV&&sk.origin),suppr:false,garder:false});
  let notes=null;try{notes=NOMS_PERTES_ESQ;}catch(e){notes=null;}
  if(!notes||!notes.size)return out;
  (sk.entities||[]).forEach(e=>{
    if(!e||!e.id)return;
    const m=notes.get(sk.id+'/'+e.id)||notes.get('skp:'+sk.id+'/'+e.id);
    if(!m||!lpEstLie(sk,e))return;
    const R=lpRaison(e,m);
    // réattribuable : ligne, cercle, arc projetés (pièce ou autre pièce) ; élément d'une autre esquisse
    const reat=!e.isect&&!e.pierce&&!e.orig&&(e.skSrc?['line','circle','arc','cpoint'].indexOf(e.t)>=0:['line','circle','arc'].indexOf(e.t)>=0);
    out.push({k:'ent',sk:sk.id,eid:e.id,ico:lpIco(e),nom:lpNom(e),raison:R.raison,long:R.long,verif:R.verif,
      reat,garder:R.verif,couper:true,suppr:true});
  });
  return out;
}
function lpResume(sk){
  // texte court du ⚠ (arbre, timeline, propriétés), ou null
  const L=lpListe(sk);if(!L.length)return null;
  const f=L.find(it=>it.k==='face'),n=L.length-(f?1:0);
  const autres=n?n+' élément'+(n>1?'s':'')+' sans source':'';
  if(f)return f.raison+(autres?' · '+autres:'');
  const v=L.filter(it=>it.verif).length;
  return n===v?n+' arête'+(n>1?'s':'')+' à vérifier':autres;
}

/* ----- notes posées au rejeu (appelées par 50-esquisse-1, 50-esquisse-7, 62) ----- */
function lpNoteExt(sk,e,trouve){
  // arête d'une autre pièce : instance absente de l'assemblage → figée, avec un avertissement
  const cle=sk.id+'/'+e.id;
  if(trouve){const m=NOMS_PERTES_ESQ.get(cle);if(m&&m.indexOf('n’est plus dans l’assemblage')>=0)nomsPerteOubli(cle);return;}
  try{if(!asm||!e.ext||!Array.isArray(e.ext.path)||asmPathComp(e.ext.path))return;}catch(x){return;} // assemblage pas encore là : rien à dire
  nomsPerteNote(cle,(sk.name||'Esquisse')+' : '+(e.projName||'projection')+' — sa pièce n’est plus dans l’assemblage ; elle reste figée');
}
function lpNoteSuivi(sk,e,raison){
  // raison : texte de la perte (intersection, repère) ; null = source retrouvée
  const cle=sk.id+'/'+e.id;
  if(!raison){try{nomsPerteOubli(cle);}catch(x){}return;}
  try{nomsPerteNote(cle,(sk.name||'Esquisse')+' : '+(e.projName||'projection')+' — '+raison+' ; elle reste figée');}catch(x){}
}

/* ----- modifier une esquisse, ouverte ou non (une étape d'annulation) ----- */
function lpModifier(sk,lbl,fn,geom){
  const ouverte=skEdit&&skEdit.id===sk.id;
  if(ouverte){skPushUndo();fn();afterEdit();return;}
  try{undoActLabel=lbl;undoActT=Date.now();}catch(e){}
  fn();
  try{solveSketch(sk);cleanupSk(sk);}catch(e){}
  markDirty();
  try{docCheckpoint();}catch(e){}
  if(geom){try{rebuildEdit(()=>{try{renderTree();renderProps();}catch(e){}});}catch(e){}}
  try{renderTree();renderProps();}catch(e){}
}
function lpCouperEnt(sk,e){
  // le lien part, l'élément reste à sa place : ses « fixe » sont rétablis avant (sinon il flotterait)
  try{skProjFixRepair(sk);}catch(x){}
  const has=f=>(sk.constraints||[]).some(f);
  if(e.t==='spline'&&!has(c=>c.type==='fix'&&c.ent===e.id))sk.constraints.push({id:skNewEid(sk),type:'fix',ent:e.id});
  lpOublier(sk,e);
  LP_CLES_LIEN.forEach(k=>{delete e[k];});
  e.sansLien=1;
}
function lpCouperFace(sk){
  // le plan reste où il est et ne suit plus aucune face (sk.planFige, lu par 10 et 50-esquisse-1/94)
  if(!(sk.axN&&sk.axU&&sk.axV&&sk.origin))return false;
  sk.plane='FACE';delete sk.cg;sk.host=null;delete sk.hostFace;sk.planFige=1;
  try{nomsPerteOubli(sk.id+'/face');}catch(x){}
  return true;
}
function lpPerdus(sk,e){
  // ce qui part avec l'élément : {cotes, contraintes} (essai sur une copie, mêmes règles que cleanupSk)
  try{
    const C=JSON.parse(JSON.stringify({points:sk.points,entities:sk.entities,constraints:sk.constraints,dims:sk.dims}));
    const T=Object.assign({},sk,C,{id:sk.id});
    const pids=new Set(skProjPids(T,entById(T,e.id)||e));
    T.entities=T.entities.filter(x=>x.id!==e.id);
    skProjFixOublier(T,pids);
    cleanupSk(T);
    const nf=L=>L.filter(c=>c.type!=='fix').length;
    return{cotes:(sk.dims||[]).length-T.dims.length,contraintes:Math.max(0,nf(sk.constraints||[])-nf(T.constraints))};
  }catch(x){return{cotes:0,contraintes:0};}
}
function lpPerdusTexte(p){
  const L=[];
  if(p.cotes)L.push(p.cotes+' cote'+(p.cotes>1?'s':''));
  if(p.contraintes)L.push(p.contraintes+' contrainte'+(p.contraintes>1?'s':''));
  return L.join(' et ');
}
function lpSupprimerEnt(sk,e){
  const pids=new Set(skProjPids(sk,e));
  lpOublier(sk,e);
  sk.entities=sk.entities.filter(x=>x!==e);
  try{skProjFixOublier(sk,pids);}catch(x){}
  cleanupSk(sk);
}

/* ----- actions d'une ligne ----- */
function lpItem(it){const sk=lpSketch(it.sk);return{sk,e:sk&&it.eid?entById(sk,it.eid):null};}
function lpGarder(it){
  const{sk,e}=lpItem(it);if(!sk||!e)return;
  // le nom perdu est oublié : au prochain rejeu, l'arête retrouvée à la même place donne le sien (projPreferMid)
  lpModifier(sk,'arête gardée',()=>{delete e.srcNom;lpOublier(sk,e);},false);
  lpMsg('« '+lpNom(e)+' » gardée sur l’arête où elle se trouve.');
  lpRafraichir();
}
function lpCouper(it){
  const{sk,e}=lpItem(it);if(!sk)return;
  if(it.k==='face'){
    if(skEdit&&skEdit.id!==sk.id)return;
    lpModifier(sk,'plan figé',()=>lpCouperFace(sk),false);
    lpMsg('« '+sk.name+' » : plan figé à sa place, il ne suit plus aucune face.');
  }else{
    if(!e)return;const nm=lpNom(e);
    lpModifier(sk,'lien coupé',()=>lpCouperEnt(sk,e),false);
    lpMsg('« '+nm+' » : lien coupé — elle reste à sa place, fixée (📌), et ne suit plus rien.');
  }
  lpRafraichir();
}
function lpSupprimer(it){
  const{sk,e}=lpItem(it);if(!sk||!e)return;
  const nm=lpNom(e),p=lpPerdusTexte(lpPerdus(sk,e));
  if(p&&!confirm('Supprimer « '+nm+' » ?\n'+p+' accrochée(s) à elle partiront aussi.'))return;
  lpModifier(sk,'élément supprimé',()=>lpSupprimerEnt(sk,e),true);
  lpMsg('« '+nm+' » supprimée'+(p?' avec '+p:'')+' — Ctrl+Z pour revenir.');
  lpRafraichir();
}
function lpToutCouper(){
  const sk=lpEtat&&lpSketch(lpEtat.sk);if(!sk)return;
  const L=lpListe(sk).filter(it=>it.couper&&(it.k!=='face'||!skEdit||skEdit.id===sk.id));if(!L.length)return;
  if(!confirm('Couper les '+L.length+' lien(s) perdu(s) de « '+sk.name+' » ?\nLes éléments restent à leur place, fixés, et ne suivent plus la pièce.'))return;
  lpModifier(sk,'liens coupés',()=>L.forEach(it=>{
    if(it.k==='face')lpCouperFace(sk);else{const e=entById(sk,it.eid);if(e)lpCouperEnt(sk,e);}
  }),false);
  lpMsg(L.length+' lien(s) coupé(s) dans « '+sk.name+' ».');
  lpRafraichir();
}
function lpToutSupprimer(){
  const sk=lpEtat&&lpSketch(lpEtat.sk);if(!sk)return;
  const L=lpListe(sk).filter(it=>it.suppr);if(!L.length)return;
  const tot={cotes:0,contraintes:0};
  L.forEach(it=>{const e=entById(sk,it.eid);if(e){const p=lpPerdus(sk,e);tot.cotes+=p.cotes;tot.contraintes+=p.contraintes;}});
  const p=lpPerdusTexte(tot);
  if(!confirm('Supprimer les '+L.length+' élément(s) perdu(s) de « '+sk.name+' » ?'+(p?'\n'+p+' partiront aussi.':'')))return;
  lpModifier(sk,'éléments supprimés',()=>L.forEach(it=>{const e=entById(sk,it.eid);if(e)lpSupprimerEnt(sk,e);}),true);
  lpMsg(L.length+' élément(s) supprimé(s) dans « '+sk.name+' »'+(p?' avec '+p:'')+' — Ctrl+Z pour revenir.');
  lpRafraichir();
}
function lpMsg(t){try{if(skEdit)skStatus(t);else faceEl.textContent=t;}catch(e){}}

/* ----- Réattribuer : la fenêtre se cache, on clique, elle revient ----- */
function lpReattribuer(it){
  const sk=lpSketch(it.sk);if(!sk)return;
  lpCacher();
  if(it.k==='face'){
    // « Changer de face » (50-esquisse-94) : esquisse fermée, la face se clique dans la vue 3D
    if(skEdit)closeSketch(true);
    skRedefStart(sk.id);
    if(!skRedef){lpRetour();return;}
    faceEl.innerHTML='<b>🎯 Réattribuer la face</b> — « '+sk.name+' »<br><span class="note">Cliquez la nouvelle face dans la vue 3D. '+
      'Le dessin garde ses cotes. <b>Échap</b> revient à la liste des liens perdus.</span>';
    return;
  }
  if(!skEdit||skEdit.id!==sk.id){
    if(skEdit)closeSketch(true);
    lpSilence++;try{openSketch(sk.id);}finally{lpSilence--;}
    if(!skEdit||skEdit.id!==sk.id){lpRetour();return;}
  }
  const e=entById(skEdit,it.eid);if(!e){lpRetour();return;}
  try{skCancelDraft();}catch(x){}
  skTool='project';
  try{document.querySelectorAll('#skToolbar .tool').forEach(x=>x.classList.toggle('on',x.dataset.tool==='project'));}catch(x){}
  skLienRe={sk:sk.id,eid:e.id};
  skProjectHover=null;skSel=null;skSelX=[];
  skStatus(lpReAide(null));
  try{drawSketch2D();renderSkPanel();}catch(x){}
}
function lpReElement(){
  const sk=skLienRe&&skEdit&&skEdit.id===skLienRe.sk?skEdit:null;
  return sk?{sk,e:entById(sk,skLienRe.eid)}:null;
}
function lpReAide(pr){
  const R=lpReElement(),e=R&&R.e;if(!e)return '';
  const tete='🎯 Réattribuer « '+lpNom(e)+' » : ';
  if(!pr)return tete+'cliquez '+lpGenre(e)+' de la pièce ou d’une autre esquisse (appui long = liste) — Échap revient à la liste.';
  const ok=pr.type===({line:'line',circle:'circle',arc:'arc',cpoint:'point'}[e.t]);
  if(!ok)return tete+'il faut '+lpGenre(e)+', pas '+({line:'une arête droite',circle:'un cercle',arc:'un arc',point:'un point',curve:'une courbe'}[pr.type]||'cet élément')+'.';
  return tete+'clic pour la poser sur '+(pr.skSrc?'cet élément de « '+(pr.srcName||'esquisse')+' »':pr.ext?'cette arête de « '+(pr.extName||'composant')+' »':'cette arête')+'.';
}
function lpReSurvol(sk,wx,wy){
  // pointermove de l'outil Projeter détourné (60) : l'arête candidate en orange, l'aide dans la barre
  let pr=null;try{pr=skpHit(sk,wx,wy)||projectEdgeAt(sk,wx,wy);}catch(e){pr=null;}
  const k=pr?JSON.stringify(pr):'null',ko=skProjectHover?JSON.stringify(skProjectHover):'null';
  if(k!==ko){skProjectHover=pr;drawSketch2D();}
  skStatus(lpReAide(pr));
}
function lpReClic(sk,wx,wy){
  // clic de l'outil Projeter détourné (60 skProjeterClic) : true = clic pris
  if(!skLienRe)return false;
  let pr=null;try{pr=skpHit(sk,wx,wy)||projectEdgeAt(sk,wx,wy);}catch(e){pr=null;}
  lpReChoix(sk,pr);
  return true;
}
function lpReChoix(sk,pr){
  // pr : élément cliqué, ou choisi dans la liste de l'appui long (90-15 → skProjeterPr)
  const R=lpReElement();
  if(!R||!R.e){skLienRe=null;lpRetour();return;}
  if(!lpReAppliquer(R.sk,R.e,pr)){skStatus(pr?lpReAide(pr):lpReAide(null).replace(/ : cliquez/,' : rien sous le clic — cliquez'));return;}
  const nm=lpNom(R.e);
  skLienRe=null;skProjectHover=null;skTool='select';
  try{document.querySelectorAll('#skToolbar .tool').forEach(x=>x.classList.toggle('on',x.dataset.tool==='select'));}catch(e){}
  try{drawSketch2D();renderSkPanel();}catch(e){}
  skStatus('« '+nm+' » réattribuée : elle suit maintenant sa nouvelle source.');
  lpRetour();
}
function lpReAppliquer(sk,e,pr){
  // la nouvelle source remplace l'ancienne SANS changer l'identité de l'élément (cotes et contraintes restent)
  const voulu={line:'line',circle:'circle',arc:'arc',cpoint:'point'}[e.t];
  if(!pr||pr.type!==voulu)return false;
  if(!pr.skSrc&&!(pr.srcMid&&pr.srcMid.length===3))return false; // repli sans noyau : rien à suivre
  const P=sk.points;
  skPushUndo();
  if(e.t==='line'){
    const A=P[e.p1],B=P[e.p2];if(!A||!B){skUndoStack.pop();return false;}
    const d1=Math.hypot(A.x-pr.x1,A.y-pr.y1)+Math.hypot(B.x-pr.x2,B.y-pr.y2),d2=Math.hypot(A.x-pr.x2,A.y-pr.y2)+Math.hypot(B.x-pr.x1,B.y-pr.y1);
    if(d2<d1){A.x=pr.x2;A.y=pr.y2;B.x=pr.x1;B.y=pr.y1;}else{A.x=pr.x1;A.y=pr.y1;B.x=pr.x2;B.y=pr.y2;}
  }else if(e.t==='circle'){const C=P[e.pc];if(!C){skUndoStack.pop();return false;}C.x=pr.cx;C.y=pr.cy;e.r=pr.r;}
  else if(e.t==='arc'){const C=P[e.pc],A=P[e.pa],B=P[e.pb];if(!C||!A||!B){skUndoStack.pop();return false;}
    C.x=pr.cx;C.y=pr.cy;A.x=pr.x1;A.y=pr.y1;B.x=pr.x2;B.y=pr.y2;e.r=pr.r;}
  else{const Q=P[e.p];if(!Q){skUndoStack.pop();return false;}Q.x=pr.x;Q.y=pr.y;}
  lpOublier(sk,e);
  delete e.srcNom;delete e.ext;delete e.skSrc;delete e.srcMid;delete e.sansLien;
  e.proj=true;if(!e.projName)e.projName=entName('proj');
  if(pr.skSrc){e.skSrc=Object.assign({},pr.skSrc);e.srcName='« '+(pr.srcName||'Esquisse')+' »';}
  else{
    e.srcMid=pr.srcMid.slice();e.srcName=entName('edge'); // le nom de l'arête est repris au prochain rejeu (projPreferMid)
    if(pr.ext){e.ext={ctx:pr.ext.ctx.slice(),path:pr.ext.path.slice()};try{e.ext.sig=asmSkExtSig(e.ext);}catch(x){}}
  }
  try{skProjFixRepair(sk);}catch(x){}
  afterEdit();
  return true;
}
function lpReAnnuler(){
  // Échap, autre outil, clic droit, esquisse fermée : la fenêtre revient
  if(!skLienRe)return;
  skLienRe=null;
  try{skProjectHover=null;if(skEdit){skStatus('Réattribuer : annulé.');drawSketch2D();}}catch(e){}
  lpRetour();
}

/* ----- la fenêtre ----- */
(function lpCss(){
  try{
    const st=document.createElement('style');
    st.textContent='#mfLiensPerdus{position:fixed;z-index:5100;top:72px;right:14px;width:min(540px,calc(100vw - 28px));max-height:calc(100vh - 100px);'+
      'display:flex;flex-direction:column;background:var(--surface,#1c1c20);color:var(--text,#f5f5f7);border:1px solid var(--border,#3a3a3f);'+
      'border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.5);font-size:.74rem;user-select:none}'+
      '#mfLiensPerdus.cache{display:none}'+
      '#mfLiensPerdus .lpH{display:flex;align-items:center;gap:8px;padding:8px 10px 6px}'+
      '#mfLiensPerdus .lpT{flex:1;min-width:0;font-weight:600;font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
      '#mfLiensPerdus .lpS{padding:0 10px 6px;opacity:.7;font-size:.7rem}'+
      '#mfLiensPerdus .lpL{overflow-y:auto;border-top:1px solid var(--border,#3a3a3f)}'+
      '#mfLiensPerdus .lpR{display:flex;align-items:center;gap:6px;padding:4px 10px;min-height:24px;border-bottom:1px solid rgba(128,128,128,.15)}'+
      '#mfLiensPerdus .lpR:hover{background:rgba(255,159,10,.14)}'+
      '#mfLiensPerdus .lpI{width:14px;text-align:center;flex:none;color:#ff9f0a}'+
      '#mfLiensPerdus .lpN{flex:none;max-width:42%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
      '#mfLiensPerdus .lpW{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.62;font-size:.68rem}'+
      '#mfLiensPerdus .lpV{flex:none;font-size:.62rem;padding:0 5px;border-radius:4px;background:rgba(255,159,10,.22);color:#ffb340}'+
      '#mfLiensPerdus button.lpB{flex:none;font:inherit;font-size:.66rem;line-height:1.2;padding:2px 6px;margin:0;border-radius:5px;cursor:pointer;'+
      'background:transparent;color:inherit;border:1px solid var(--border,#3a3a3f);width:auto;min-width:0;box-shadow:none}'+
      '#mfLiensPerdus button.lpB:hover{background:var(--primary,#0a84ff);border-color:var(--primary,#0a84ff);color:#fff}'+
      '#mfLiensPerdus button.lpB.dg:hover{background:#ff453a;border-color:#ff453a}'+
      '#mfLiensPerdus .lpF{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;padding:7px 10px}'+
      '#mfLiensPerdus .lpX{cursor:pointer;opacity:.7;padding:0 4px;font-size:.9rem}#mfLiensPerdus .lpX:hover{opacity:1}';
    (document.head||document.documentElement).appendChild(st);
  }catch(e){}
})();
function lpOuvrir(id){
  const sk=lpSketch(id);if(!sk)return false;
  if(!lpListe(sk).length){lpFermer();lpMsg('« '+sk.name+' » : aucun lien perdu.');return false;}
  if(!lpEtat||!lpEtat.el||!lpEtat.el.isConnected){
    lpFermer();
    const el=document.createElement('div');el.id='mfLiensPerdus';
    el.addEventListener('pointerdown',ev=>ev.stopPropagation());
    el.addEventListener('contextmenu',ev=>{ev.preventDefault();ev.stopPropagation();});
    document.body.appendChild(el);
    lpEtat={sk:id,el,cache:false};
  }
  lpEtat.sk=id;lpEtat.cache=false;lpEtat.el.classList.remove('cache');
  lpDessiner();
  return true;
}
function lpFermer(){
  if(skLienRe){skLienRe=null;try{skProjectHover=null;if(skEdit)drawSketch2D();}catch(e){}}
  const E=lpEtat;lpEtat=null;
  if(lpSurvol){lpSurvol=null;try{if(skEdit)drawSketch2D();}catch(e){}}
  if(E&&E.el){try{E.el.remove();}catch(e){}}
}
function lpCacher(){if(lpEtat&&lpEtat.el){lpEtat.cache=true;lpEtat.el.classList.add('cache');}lpSurvol=null;}
function lpRetour(){
  // fin d'un Réattribuer (fait ou annulé) : la fenêtre revient, liste à jour ; rien de perdu → elle se ferme
  if(!lpEtat)return;
  const sk=lpSketch(lpEtat.sk);
  if(!sk||!lpListe(sk).length){
    const nm=sk&&sk.name;lpFermer();
    if(nm)setTimeout(()=>lpMsg('« '+nm+' » : tous les liens perdus sont réglés.'),0);
    return;
  }
  lpEtat.cache=false;lpEtat.el.classList.remove('cache');
  lpDessiner();
}
function lpRafraichir(){
  // après une action, un rejeu ou un renderTree : la liste suit ; vide → fermée
  if(!lpEtat||lpEtat.cache||skLienRe||(typeof skRedef!=='undefined'&&skRedef))return;
  const sk=lpSketch(lpEtat.sk);
  if(!sk||!lpListe(sk).length){lpFermer();return;}
  lpDessiner();
}
function lpPlacer(){
  // dans la vue 3D (ou celle de l'esquisse ouverte), à droite, sous les boutons de vue et le cube :
  // jamais sur le ruban ni sur la barre d'esquisse
  const E=lpEtat;if(!E||!E.el||!E.el.style)return;
  try{
    let R=null;
    const ov=document.getElementById('sketchOverlay');
    if(ov&&ov.getBoundingClientRect){const b=ov.getBoundingClientRect();if(b.width>200&&b.height>150)R=b;}
    if(!R&&typeof renderer!=='undefined'&&renderer&&renderer.domElement){const b=renderer.domElement.getBoundingClientRect();if(b.width>200&&b.height>150)R=b;}
    if(!R)return;
    const W=window.innerWidth||1024,top=Math.round(R.top+96),right=Math.max(8,Math.round(W-R.right+12));
    E.el.style.top=top+'px';E.el.style.right=right+'px';
    E.el.style.maxHeight=Math.max(160,Math.round(R.bottom-top-12))+'px';
  }catch(e){}
}
try{window.addEventListener('resize',()=>{if(lpEtat&&!lpEtat.cache)lpPlacer();});}catch(e){}
function lpBouton(txt,titre,fn,cls){
  const b=document.createElement('button');b.className='lpB'+(cls?' '+cls:'');b.type='button';b.textContent=txt;b.title=titre;
  b.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();fn();});
  return b;
}
function lpDessiner(){
  const E=lpEtat;if(!E||!E.el)return;
  const sk=lpSketch(E.sk);if(!sk)return;
  const L=lpListe(sk),el=E.el;
  el.textContent='';
  lpPlacer();
  const h=document.createElement('div');h.className='lpH';
  const t=document.createElement('div');t.className='lpT';t.textContent='⚠ Liens perdus — « '+sk.name+' »';h.appendChild(t);
  const x=document.createElement('span');x.className='lpX';x.textContent='✕';x.title='Fermer (le ⚠ de l’arbre la rouvre)';
  x.addEventListener('click',ev=>{ev.stopPropagation();lpFermer();});h.appendChild(x);
  el.appendChild(h);
  const s=document.createElement('div');s.className='lpS';
  const n=L.length;
  s.textContent=n+' élément'+(n>1?'s':'')+' ne retrouve'+(n>1?'nt':'')+' plus '+(n>1?'leur':'sa')+' face ou '+(n>1?'leur':'son')+' arête. Survolez une ligne pour la voir.';
  el.appendChild(s);
  const box=document.createElement('div');box.className='lpL';
  const ouverte=skEdit&&skEdit.id===sk.id,autre=skEdit&&skEdit.id!==sk.id;
  L.forEach(it=>{
    const r=document.createElement('div');r.className='lpR';r.title=it.nom+' — '+it.long;
    const ic=document.createElement('span');ic.className='lpI';ic.textContent=it.ico;r.appendChild(ic);
    const nm=document.createElement('span');nm.className='lpN';nm.textContent=it.nom;r.appendChild(nm);
    if(it.verif){const v=document.createElement('span');v.className='lpV';v.textContent='à vérifier';r.appendChild(v);}
    const w=document.createElement('span');w.className='lpW';w.textContent=it.raison;r.appendChild(w);
    if(it.reat)r.appendChild(lpBouton('Réattribuer',it.k==='face'?'Cliquer la nouvelle face dans la vue 3D (la fenêtre se cache le temps du choix)':
      'Cliquer la nouvelle arête dans l’esquisse — appui long = liste (la fenêtre se cache le temps du choix). Cotes et contraintes restent.',()=>lpReattribuer(it)));
    if(it.garder)r.appendChild(lpBouton('Garder','L’arête où elle s’est raccrochée est la bonne : la garder',()=>lpGarder(it)));
    if(it.couper&&!(it.k==='face'&&autre))r.appendChild(lpBouton('Couper',it.k==='face'?'Le plan reste où il est et ne suit plus aucune face':
      'L’élément reste à sa place, fixé (📌), et ne suit plus rien',()=>lpCouper(it)));
    if(it.suppr){
      let p='';try{const e=entById(sk,it.eid);if(e)p=lpPerdusTexte(lpPerdus(sk,e));}catch(e2){}
      r.appendChild(lpBouton('Supprimer','Supprimer l’élément'+(p?' ('+p+' partiront avec lui)':''),()=>lpSupprimer(it),'dg'));
    }
    r.addEventListener('pointerenter',()=>{lpSurvol=it.eid?{sk:sk.id,eid:it.eid}:null;if(ouverte)try{drawSketch2D();}catch(e){}});
    r.addEventListener('pointerleave',()=>{lpSurvol=null;if(ouverte)try{drawSketch2D();}catch(e){}});
    box.appendChild(r);
  });
  el.appendChild(box);
  const f=document.createElement('div');f.className='lpF';
  if(L.some(it=>it.couper))f.appendChild(lpBouton('Couper tous les liens','Tous les éléments restent à leur place et ne suivent plus la pièce',lpToutCouper));
  if(L.some(it=>it.suppr))f.appendChild(lpBouton('Supprimer les éléments perdus','Supprimer tous les éléments de la liste (pas la face)',lpToutSupprimer,'dg'));
  f.appendChild(lpBouton('Plus tard','Fermer — le ⚠ de l’arbre et de la timeline la rouvre',lpFermer));
  el.appendChild(f);
}
function lpAuto(sk){
  // à l'ouverture d'une esquisse (openSketch) : la fenêtre s'ouvre si elle a des liens perdus
  if(lpSilence||!sk)return;
  if(lpListe(sk).length)lpOuvrir(sk.id);
  else if(lpEtat&&lpEtat.sk!==sk.id&&!lpEtat.cache)lpFermer();
}

/* ----- dessin dans l'esquisse (appelé par drawSketch2D, 50-esquisse-4) ----- */
function lpDessinSk(sk){
  const ids=[];
  if(lpSurvol&&lpSurvol.sk===sk.id)ids.push([lpSurvol.eid,'']);
  if(skLienRe&&skLienRe.sk===sk.id)ids.push([skLienRe.eid,'6 4']);
  ids.forEach(([id,tir])=>{
    const e=entById(sk,id),P=sk.points||{};if(!e)return;
    const st={fill:'none',stroke:'#ff9f0a','stroke-width':4,opacity:0.9};if(tir)st['stroke-dasharray']=tir;
    if(e.t==='line'){const A=P[e.p1],B=P[e.p2];if(!A||!B)return;const[a,b]=w2s(A.x,A.y),[c,d]=w2s(B.x,B.y);skEl('line',Object.assign({x1:a,y1:b,x2:c,y2:d},st));}
    else if(e.t==='circle'){const C=P[e.pc];if(!C)return;const[a,b]=w2s(C.x,C.y);skEl('circle',Object.assign({cx:a,cy:b,r:e.r*skView.s},st));}
    else if(e.t==='arc'){const C=P[e.pc],A=P[e.pa],B=P[e.pb];if(!C||!A||!B)return;
      let dd=Math.atan2(B.y-C.y,B.x-C.x)-Math.atan2(A.y-C.y,A.x-C.x);while(dd<=0)dd+=Math.PI*2;
      const[a,b]=w2s(A.x,A.y),[c,d]=w2s(B.x,B.y),R=e.r*skView.s;
      skEl('path',Object.assign({d:`M ${a} ${b} A ${R} ${R} 0 ${dd>Math.PI?1:0} 0 ${c} ${d}`},st));}
    else if(e.t==='cpoint'){const Q=P[e.p];if(!Q)return;const[a,b]=w2s(Q.x,Q.y);skEl('rect',Object.assign({x:a-6,y:b-6,width:12,height:12},st,{'stroke-width':2.5}));}
    else if(e.t==='spline'){let pl=null;try{pl=skSplinePoly(sk,e);}catch(x){pl=null;}
      if(pl&&pl.length>1)skEl('path',Object.assign({d:'M '+pl.map(q=>{const s=w2s(q[0],q[1]);return s[0].toFixed(1)+' '+s[1].toFixed(1);}).join(' L ')},st));}
  });
}
