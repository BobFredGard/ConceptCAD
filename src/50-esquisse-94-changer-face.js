// Esquisse : « 🎯 Changer de face » (V0.94.5), comme « Redéfinir le plan d'esquisse » de Fusion.
// Une esquisse dont la face est perdue (ou mal choisie) se repose sur une autre face d'un clic ;
// son dessin garde ses cotes, dans le repère de la nouvelle face. La timeline est arrêtée avant
// la fonction qui consomme l'esquisse le temps du choix : seules les faces d'AVANT elle sont
// cliquables (règle d'antériorité), comme dans Fusion.
let skRedef=null; // {id} : esquisse en attente de sa nouvelle face
function skRedefStart(id){
  const sk=(doc.sketches||[]).find(s=>s.id===id);if(!sk)return;
  if(skEdit){faceEl.textContent='Changer de face : fermez d’abord l’esquisse ouverte.';return;}
  try{if(mvMode)exitMoveFaceMode(true);}catch(e){}
  try{if(coqueMode)exitCoqueMode(true);}catch(e){}
  try{if(draftMode)exitDraftMode(true);}catch(e){}
  skRedef={id};
  let c=null;try{c=tlHostFeatureOfSketch(sk);}catch(e){}
  // l'esquisse posée sur une face, la fonction « hôte » est AVANT elle : seule la consommatrice compte
  const users=(doc.features||[]).filter(f=>f.sketchId===sk.id||f.pathId===sk.id);
  if(users.length)c=users[0];
  if(c&&c.sketchId!==sk.id&&c.pathId!==sk.id)c=null;
  if(c&&tlEditLock(c))rebuild();
  skRedefHelp();
}
function skRedefHelp(){
  const sk=skRedef&&(doc.sketches||[]).find(s=>s.id===skRedef.id);if(!sk)return;
  faceEl.innerHTML='<b>🎯 Changer de face</b> — « '+sk.name+' »<br><span class="note">Cliquez la nouvelle face dans la vue 3D. '+
    'Le dessin garde ses cotes, posé sur cette face. <b>Échap</b> annule.</span>';
}
function skRedefEnd(){
  if(!skRedef)return;
  skRedef=null;
  if(tlEditUnlock())rebuild();
}
function skRedefApply(sk,s){
  // s = {mesh,point,faceIndex} : face cliquée. Rend false (message affiché) si la face ne convient pas.
  const P=skFacePlacement(s);
  if(P.err){faceEl.textContent='Changer de face : '+P.err;return false;}
  const{pt,n,u,v,origin,host}=P;
  sk.plane='FACE';delete sk.cg;
  sk.origin=[+origin.x.toFixed(3),+origin.y.toFixed(3),+origin.z.toFixed(3)];
  sk.axU=[u.x,u.y,u.z];sk.axV=[v.x,v.y,v.z];sk.axN=[n.x,n.y,n.z];
  const nm=(sk.host&&sk.host.name)||(sk.hostFace&&sk.hostFace.name)||null;
  sk.host=host?hostFields(host,nm||entName('face')):null;
  if(host)delete sk.hostFace;
  else sk.hostFace={pos:[+pt.x.toFixed(3),+pt.y.toFixed(3),+pt.z.toFixed(3)],name:nm||entName('face')}; // nommée au rejeu (skFaceNommeeSuit)
  try{nomsPerteOubli(sk.id+'/face');}catch(e){}
  return true;
}
function skRedefPickAt(e){
  const sk=skRedef&&(doc.sketches||[]).find(s=>s.id===skRedef.id);
  if(!sk){skRedefEnd();return;}
  const h=pick(e);
  if(!h||!h.object||h.faceIndex==null){faceEl.textContent='Changer de face : cliquez une face de la pièce (Échap annule).';return;}
  if(!skRedefApply(sk,{mesh:h.object,point:h.point.clone(),faceIndex:h.faceIndex}))return;
  skRedef=null;
  tlEditUnlock();
  markDirty();rebuild();
  try{renderTree();renderProps();}catch(err){}
  faceEl.textContent='« '+sk.name+' » posée sur '+sketchFaceLabel(sk)+' : elle suivra cette face.';
}
window.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!skRedef)return;
  skRedefEnd();
  faceEl.textContent='Changer de face : annulé.';
});
function skFacePerdue(sk){
  // Raison d'une face d'esquisse perdue (panneau, ⚠ de l'arbre), ou null
  if(!sk||sk.fao)return null;
  if(sk.plane==='CG'){const el=sk.cg&&cgGet(sk.cg.id);return el&&sk.axN?null:'son plan de construction n’existe plus';}
  if(sk.plane!=='FACE')return null;
  try{const m=NOMS_PERTES_ESQ.get(sk.id+'/face');if(m)return m.replace(/^[^:]*: /,'');}catch(e){}
  if(sk.host&&sk.host.feat)return (doc.features||[]).some(f=>f.id===sk.host.feat)?null:'sa face porteuse a disparu';
  if(sk.hostFace&&sk.hostFace.nom)return null;
  if(typeof occHas==='function'&&!occHas())return null; // sans noyau : rien à dire
  return 'aucune face porteuse retrouvée : son plan reste figé';
}
