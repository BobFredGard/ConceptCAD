/* ---------- PARAMÈTRE MESURÉ ENTRE DEUX FACES (V0.87.0) ----------
   Demande : « Paramètres → pouvoir créer des paramètres sur une mesure entre 2 faces ». Choix de Fred :
   le paramètre est LU sur la pièce et la suit (il ne se règle pas à la main) ; il se crée depuis la
   fenêtre ƒx Paramètres (« + Mesure », puis 2 clics) ou depuis l'outil Mesure (Ctrl+clic sur 2 faces,
   bouton « Créer un paramètre »).
   • p = {name, expr:'', value, mes:{a:réf. face, b:réf. face, k:'plans'|'entraxe'|'axe'|'mini'}} dans
     doc.params ; réf. = occFaceRefAny + nom unique de la face (20-05) + corps. Le nom suit la face
     quand la pièce change ; la position n'est que le repli.
   • Valeur : comme l'outil Mesure — faces planes parallèles : écart exact des plans ; 2 cylindres :
     entraxe ; cylindre + plan : axe ↔ face ; sinon distance mini entre les faces.
   • Recalculée à chaque fin de rejeu (buildDone). Si une autre valeur l'utilise et qu'elle a changé,
     la pièce est rejouée encore ; une mesure qui change ce qu'elle mesure s'arrête après 3 rejeux.
   • Face disparue : la dernière valeur reste, ⚠ et p.mesErr (p.err est celui des expressions). */
let parMesPick=null; // saisie en cours : {a:null|{ref,lib}, mesh, fi}
const PAR_MES_K={plans:'plans parallèles',entraxe:'entraxe',axe:'axe ↔ face',mini:'distance mini'};
function parMesLibelle(p){
  const m=p&&p.mes;if(!m)return'';
  return (m.a&&m.a.lib||'face')+' ↔ '+(m.b&&m.b.lib||'face')+' · '+(PAR_MES_K[m.k]||'distance');
}
function parMesShapes(){return (bodies||[]).filter(b=>b&&b.kind==='body'&&b.shape);}
function parMesFace(ref){
  // Face désignée par ref sur les corps reconstruits → {face (handle à libérer), bd} | null
  if(!ref)return null;
  const L=parMesShapes();if(!L.length)return null;
  const prem=L.filter(b=>b.id===ref.body),autres=L.filter(b=>b.id!==ref.body);
  // le nom d'abord, sur tous les corps (une face peut changer de corps : Combiner, Scinder)
  if(ref.nom)for(const bd of prem.concat(autres)){const f=nomsRefFace(bd.shape,ref);if(f)return{face:f,bd};}
  for(const bd of (prem.length?prem:autres)){
    let f=null;try{f=occFindFaceAny(bd.shape,Object.assign({},ref));}catch(e){f=null;}
    if(f)return{face:f,bd};
  }
  return null;
}
function parMesV(a){return new THREE.Vector3(a[0],a[1],a[2]);}
function parMesCalc(fA,fB){
  // → {v, k, p1, p2 (THREE.Vector3, pour le tracé)} | {err}
  const A=occSurfDesc(fA),B=occSurfDesc(fB);
  const dot=(u,w)=>u[0]*w[0]+u[1]*w[1]+u[2]*w[2];
  if(A.k==='pl'&&B.k==='pl'&&Math.abs(dot(A.n,B.n))>Math.cos(0.5*Math.PI/180)){
    const n=parMesV(A.n).normalize(),pa=parMesV(A.p),s=parMesV(B.p).sub(pa).dot(n);
    let c=pa.clone();try{const b=occFaceBox(fA);if(b&&b.pos)c=parMesV(b.pos);}catch(e){}
    const p1=c.clone().addScaledVector(n,-c.clone().sub(pa).dot(n));
    return{v:Math.abs(s),k:'plans',p1,p2:p1.clone().addScaledVector(n,s)};
  }
  if(A.k==='cy'&&B.k==='cy'){
    const en=entraxePts(parMesV(A.p),parMesV(A.a).normalize(),parMesV(B.p),parMesV(B.a).normalize());
    return{v:en.d,k:'entraxe',p1:en.q1,p2:en.q2};
  }
  const C=A.k==='cy'?A:(B.k==='cy'?B:null),P=A.k==='pl'?A:(B.k==='pl'?B:null);
  if(C&&P&&Math.abs(dot(C.a,P.n))<Math.sin(0.5*Math.PI/180)){ // axe parallèle à la face : la distance a un sens
    const n=parMesV(P.n).normalize(),c=parMesV(C.p),d=c.clone().sub(parMesV(P.p)).dot(n);
    return{v:Math.abs(d),k:'axe',p1:c,p2:c.clone().addScaledVector(n,-d)};
  }
  let x=null;
  try{
    x=new occt.BRepExtrema_DistShapeShape_2(fA,fB,occt.Extrema_ExtFlag.Extrema_ExtFlag_MIN,occt.Extrema_ExtAlgo.Extrema_ExtAlgo_Grad);
    if(!x.IsDone()||!(x.NbSolution()>0))return{err:'distance impossible à calculer'};
    return{v:x.Value(),k:'mini',p1:parMesV(occXyz(x.PointOnShape1(1))),p2:parMesV(occXyz(x.PointOnShape2(1)))};
  }catch(e){return{err:'distance impossible à calculer'};}
  finally{try{if(x)x.delete();}catch(e){}}
}
function parMesEval(m){
  // → {v, k, p1, p2, A:{face,bd}, B} (faces à libérer par l'appelant : parMesFree) | {err}
  if(!occHas())return{err:'noyau exact indisponible'};
  const A=parMesFace(m.a);if(!A)return{err:'la 1re face ('+(m.a&&m.a.lib||'?')+') n’existe plus'};
  const B=parMesFace(m.b);if(!B){occFree(A.face);return{err:'la 2e face ('+(m.b&&m.b.lib||'?')+') n’existe plus'};}
  let r;try{r=parMesCalc(A.face,B.face);}catch(e){r={err:e.message||'mesure impossible'};}
  r.A=A;r.B=B;return r;
}
function parMesFree(r){if(r){if(r.A)occFree(r.A.face);if(r.B)occFree(r.B.face);}}
function parMesRefOfHit(mesh,fi){
  // Face cliquée → {ref, face (handle à libérer), bd} | null
  const hit=occFaceOfHit(mesh,fi);
  if(!hit||!hit.face||!hit.bd||hit.bd.kind!=='body'||!hit.bd.shape){if(hit&&hit.face)occFree(hit.face);return null;}
  const ref=occFaceRefAny(hit.face);if(!ref){occFree(hit.face);return null;}
  try{const n=nomsFaceDe(hit.bd.shape,hit.face);if(n)ref.nom=n;}catch(e){}
  ref.body=hit.bd.id;
  try{const I=selFaceInfo(mesh,fi);ref.lib='Face '+(I.n||'?');}catch(e){ref.lib='Face';}
  return{ref,face:hit.face,bd:hit.bd};
}
function parMesNomLibre(k){
  const base=k==='entraxe'?'Entraxe':'Ecart';let i=1;
  while(parAll().has(base+i))i++;
  return base+i;
}
function parMesCreate(refA,refB,r){
  // Ajoute le paramètre (une étape d'annulation) ; rend le paramètre créé
  if(!Array.isArray(doc.params))doc.params=[];
  try{docPushUndo('paramètre mesuré');}catch(e){}
  const p={name:parMesNomLibre(r.k),expr:'',value:+r.v,mes:{a:refA,b:refB,k:r.k}};
  doc.params.push(p);
  try{parApplyAll();}catch(e){}
  try{markDirty();}catch(e){}
  try{parMiniSoon();}catch(e){}
  return p;
}
function parMesFmt(v){return String(+(+v).toFixed(4)).replace('.',',');}
/* ----- saisie depuis la fenêtre ƒx Paramètres ----- */
function parMesPickStart(){
  if(!occHas()){alert('Mesure entre 2 faces : le noyau exact (OCCT) est requis.');return;}
  try{const ov=document.getElementById('parDlg');if(ov)ov.remove();}catch(e){}
  try{clearMeasure();}catch(e){}
  parMesPick={a:null};
  try{renderer.domElement.style.cursor='crosshair';}catch(e){}
  try{faceEl.textContent='Paramètre mesuré : cliquez la 1re face (Échap pour annuler).';}catch(e){}
}
function parMesPickCancel(rouvrir){
  parMesPick=null;
  try{renderer.domElement.style.cursor='default';}catch(e){}
  try{clearMeasure();}catch(e){}
  if(rouvrir)try{openParamsDlg();}catch(e){}
}
function parMesPickAt(e){
  if(!parMesPick)return false;
  const h=pick(e);
  if(!h){try{faceEl.textContent='Paramètre mesuré : aucune face sous le curseur — cliquez une face de la pièce (Échap pour annuler).';}catch(e2){}return true;}
  const R=parMesRefOfHit(h.object,h.faceIndex);
  if(!R){try{faceEl.textContent='Paramètre mesuré : face illisible (seules les faces des corps de la pièce se mesurent).';}catch(e2){}return true;}
  if(!parMesPick.a){
    occFree(R.face);
    parMesPick.a=R.ref;
    try{highlightTris(h.object,faceTrisFor(h.object,h.faceIndex),0xff9f0a,0.55);}catch(e2){}
    try{faceEl.textContent='Paramètre mesuré : '+R.ref.lib+' choisie — cliquez la 2e face (Échap pour annuler).';}catch(e2){}
    return true;
  }
  // 2e face : mesurée sur les handles cliqués (même valeur que l'outil Mesure)
  const A=parMesFace(parMesPick.a);
  let r=null;
  try{
    if(!A){r={err:'1re face introuvable'};}
    else if(A.face.IsSame(R.face)){r={err:'c’est la même face — cliquez-en une autre'};}
    else r=parMesCalc(A.face,R.face);
  }catch(err){r={err:err.message||'mesure impossible'};}
  finally{if(A)occFree(A.face);occFree(R.face);}
  if(r.err){try{faceEl.textContent='Paramètre mesuré : '+r.err+'.';}catch(e2){}return true;}
  const p=parMesCreate(parMesPick.a,R.ref,r);
  parMesPickCancel(false);
  try{dimPair(r.p1,r.p2,p.name+' = '+parMesFmt(r.v));}catch(e2){}
  try{faceEl.textContent='Paramètre « '+p.name+' » = '+parMesFmt(r.v)+' mm ('+PAR_MES_K[r.k]+'). Il suit la pièce ; utilisez son nom dans une autre valeur (« '+p.name+'/2 »).';}catch(e2){}
  try{openParamsDlg();}catch(e2){}
  return true;
}
/* ----- bouton après une mesure Ctrl+clic sur 2 faces (90-10, faceSelect) ----- */
function parMesOffer(A,B){
  if(!occHas()||!A||!B||!faceEl)return;
  const RA=parMesRefOfHit(A.mesh,A.faceIndex);if(!RA)return;
  const RB=parMesRefOfHit(B.mesh,B.faceIndex);if(!RB){occFree(RA.face);return;}
  let r=null;
  try{r=RA.face.IsSame(RB.face)?{err:'même face'}:parMesCalc(RA.face,RB.face);}catch(e){r={err:'?'};}
  finally{occFree(RA.face);occFree(RB.face);}
  if(!r||r.err)return;
  const b=document.createElement('button');
  b.className='parMesBtn';b.textContent='ƒx Créer un paramètre ('+parMesFmt(r.v)+')';
  b.title='Paramètre qui VAUT cette mesure ('+PAR_MES_K[r.k]+') et suit la pièce quand elle change';
  b.style.cssText='display:block;margin-top:6px;padding:3px 8px;cursor:pointer;pointer-events:auto';
  b.addEventListener('pointerdown',e=>e.stopPropagation());
  b.addEventListener('click',e=>{
    e.stopPropagation();
    const p=parMesCreate(RA.ref,RB.ref,r);
    try{faceEl.textContent='Paramètre « '+p.name+' » = '+parMesFmt(r.v)+' mm ('+PAR_MES_K[r.k]+') — il suit la pièce (fenêtre ƒx Paramètres pour le renommer).';}catch(e2){}
  });
  faceEl.appendChild(b);
  try{faceEl.scrollTop=faceEl.scrollHeight;}catch(e){} // la zone Mesure est basse : le bouton reste en vue
}
/* ----- montrer la mesure d'un paramètre ----- */
function parMesShow(p){
  if(!p||!p.mes)return;
  const r=parMesEval(p.mes);
  try{
    try{clearMeasure();}catch(e){}
    if(r.err){try{faceEl.textContent='« '+p.name+' » : '+r.err+'.';}catch(e){}return;}
    [r.A,r.B].forEach(X=>{
      const mesh=X.bd.mesh;if(!mesh)return;
      const ord=parMesOrd(X.bd.shape,X.face);
      const g=(mesh.geometry.userData.occGroups||[]).find(g=>g.f===ord);
      if(!g)return;const t=[];for(let i=g.start;i<g.start+g.count;i++)t.push(i);
      highlightTris(mesh,t,0xff9f0a,0.55);
    });
    dimPair(r.p1,r.p2,p.name+' = '+parMesFmt(r.v));
    try{faceEl.textContent='« '+p.name+' » = '+parMesFmt(r.v)+' mm — '+parMesLibelle(p)+'.';}catch(e){}
  }finally{parMesFree(r);}
}
function parMesOrd(shape,face){
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try{for(let k=0;ex.More();k++,ex.Next()){if(occAvec(ex.Current(),c=>c.IsSame(face)))return k;}}
  finally{try{ex.delete();}catch(e){}}
  return -1;
}
/* ----- mise à jour après chaque rejeu ----- */
let parMesLoop=0;
function parMesUpdate(){
  const L=(doc.params||[]).filter(p=>p&&p.mes);
  if(!L.length||!occHas()||!parMesShapes().length){parMesLoop=0;return;}
  let chg=false;
  L.forEach(p=>{
    const r=parMesEval(p.mes);
    try{
      if(r.err){if(p.mesErr!==r.err){p.mesErr=r.err;chg=true;}return;}
      if(p.mesErr){delete p.mesErr;chg=true;}
      if(r.k&&p.mes.k!==r.k)p.mes.k=r.k;
      if(!(Math.abs((+p.value)-r.v)<1e-9)){p.value=r.v;chg=true;}
    }finally{parMesFree(r);}
  });
  if(!chg){parMesLoop=0;return;}
  try{parMiniSoon();}catch(e){}
  try{const ov=document.getElementById('parDlg');if(ov&&ov._render)ov._render();}catch(e){}
  // Les valeurs qui l'utilisent suivent : nouvelle passe si l'une d'elles a changé
  let R=null;try{R=parApplyAll();}catch(e){R=null;}
  if(!R||!(R.featChanged||R.changed.length)){parMesLoop=0;return;}
  if(++parMesLoop>3){
    parMesLoop=0;
    try{faceEl.textContent+=(faceEl.textContent?'\n':'')+'⚠ Paramètre mesuré : la pièce change ce qu’il mesure (la valeur ne se stabilise pas) — arrêt après 3 rejeux.';}catch(e){}
    return;
  }
  setTimeout(()=>{try{markDirty();rebuild();}catch(e){}},0);
}
