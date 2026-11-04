/* ---------- import / export ---------- */
// ── Géométrie vivante des imports (STEP / STL) ───────────────────────────────
// Un import n'a AUCUNE forme paramétrique : sa géométrie EST le mesh `f._mesh`,
// réutilisé tel quel à chaque rejeu. Trois pièges, tous corrigés ici :
//   1) `commitPrev()` / `clearBodies()` retiraient ce mesh de la scène à chaque rejeu
//      → le STEP disparaissait dès la création d'une esquisse (bodies le contient
//      toujours, l'objet n'est plus dans la scène). → importMeshesOfDoc().
//   2) `docSnap()` strippe `_mesh` (JSON) → annuler/rétablir rendait le corps fantôme
//      (entrée présente, rien d'affiché). → importHydrate() le re-broche.
//   3) le shape OCCT était détruit en fin d'import → classification des arêtes
//      tangentes impossible ensuite. → calculée tant qu'il vit, stockée ICI.
//   4) il n'était plus conservé DU TOUT → la voie exacte n'avait rien à unir ni à
//      soustraire (« découpe dans le vide » sur un STEP). → `entry.brep`, libéré
//      par la purge de la table comme le mesh.
// Table délibérément hors `doc` : jamais sérialisée, jamais dans `docHash`,
// jamais par instantané d'annulation — elle survit à tout rechargement d'état.
// Propriété : le mesh est LA TABLE qui en décide — il est libéré exactement quand
// son entrée est retirée (id absent de doc.features ET de toutes les piles
// d'annulation), donc jamais pendant un aller-retour annuler/rétablir.
const importGeom=new Map(); // id fonction -> {mesh, edges, faoGeo, brep}
function importMeshesOfDoc(){
  // Meshes des imports ENCORE DANS LE DOCUMENT : à afficher, donc à préserver.
  const s=new Set();
  try{
    (doc.features||[]).forEach(f=>{
      if(!f||f.type!=='import')return;
      if(f._mesh)s.add(f._mesh);
      const e=importGeom.get(f.id);if(e&&e.mesh)s.add(e.mesh);
    });
  }catch(e){}
  return s;
}
function importOwnedMeshes(){
  // Tous les meshes entretenus par la table (dont ceux d'une fonction momentanément
  // annulée : ni affichés, mais RÉUTILISABLES au retour → jamais libérés ici).
  const s=new Set();
  try{for(const e of importGeom.values())if(e&&e.mesh)s.add(e.mesh);}catch(e){}
  return s;
}
function importIdStillReachable(id){
  // Annuler retire la fonction du document mais son instantané (JSON) la remettra
  // peut-être : tant que l'id existe dans une pile, la géométrie doit rester.
  try{
    const piles=[docUndoStack,docRedoStack];
    for(const p of piles){
      if(!p)continue;
      for(let i=0;i<p.length;i++){const e=p[i];if(e&&typeof e.snap==='string'&&e.snap.indexOf(id)>=0)return true;}
    }
  }catch(e){}
  return false;
}
function importHydrate(){
  // Re-broche `_mesh` (un instantané d'annulation l'a stripé) et libère les entrées
  // dont la fonction n'existe plus nulle part.
  const vivant=new Set();
  try{
    (doc.features||[]).forEach(f=>{
      if(!f||f.type!=='import')return;
      vivant.add(f.id);
      if(f._mesh){if(!importGeom.has(f.id))importGeom.set(f.id,{mesh:f._mesh});}
      else{const e=importGeom.get(f.id);if(e&&e.mesh)f._mesh=e.mesh;}
    });
  }catch(e){}
  // Les imports des AUTRES composants de l'assemblage vivent aussi (la table est commune à tous)
  try{if(asm)asm.comps.forEach(c=>((c.doc&&c.doc.features)||[]).forEach(f=>{if(f&&f.type==='import')vivant.add(f.id);}));}catch(e){}
  for(const id of Array.from(importGeom.keys())){
    if(vivant.has(id)||importIdStillReachable(id))continue;
    const e=importGeom.get(id);importGeom.delete(id);
    try{if(e&&e.mesh&&e.mesh.geometry)e.mesh.geometry.dispose();}catch(_){}
    try{if(e&&e.faoGeo&&e.faoGeo.dispose)e.faoGeo.dispose();}catch(_){}
    try{if(e&&e._faoGeoFine&&e._faoGeoFine.dispose)e._faoGeoFine.dispose();}catch(_){}
    try{if(e&&e.brep)e.brep.delete();}catch(_){} // solide exact : même vie que le mesh
  }
}
$('btnImport').onclick=()=>$('fileImport').click();
$('fileImport').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  if(/\.stou?l$/i.test(f.name)){await importSTL(f);}
  else{await importSTEP(f);}
  e.target.value='';
});
/* ---------- 2026-10-15-004 : la SOURCE d'un import est persistée ----------
   Retour : « quand on sauvegarde la pièce avec le STEP et des usinages, le fichier
   n'est pas rechargé car manquant. Pourtant le .miniFusion fait 30 Mo ! » — les
   30 Mo étaient les trajectoires ; la géométrie importée n'était JAMAIS écrite
   (deserialise la jetait, avec l'alerte « réimportez le STEP/STL »).
   Désormais : les octets du fichier d'origine sont gardés (mémoire + IndexedDB,
   clé = empreinte du contenu) ; la fonction import ne porte que la référence
   f.src={fmt,key,size,file} — le JSON du document, l'autosave et les instantanés
   d'annulation restent légers. Le .miniFusion EMBARQUE ces octets (base64) : à
   l'ouverture, le STEP est rejoué avec le MÊME id de fonction, donc le corps, les
   enlèvements et les opérations FAO qui le visent retrouvent leur cible.
   Anciens fichiers (sans source) : la fonction est conservée « à réimporter » ;
   importer un fichier du même nom la rebranche (même id, usinages conservés). */
const importSrc=new Map(); // 'impsrc:<empreinte>' -> Uint8Array (fichier d'origine)
function importSrcKey(u8){
  let h=2166136261;for(let i=0;i<u8.length;i++){h^=u8[i];h=Math.imul(h,16777619);}
  return 'impsrc:'+(h>>>0).toString(36)+'_'+u8.length;
}
function importU8ToB64(u8){
  let out='';const CH=0x8000;
  for(let i=0;i<u8.length;i+=CH)out+=String.fromCharCode.apply(null,u8.subarray(i,i+CH));
  return btoa(out);
}
function importB64ToU8(b64){
  const t=atob(b64);const u=new Uint8Array(t.length);
  for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);
  return u;
}
async function importSrcPut(key,u8){
  importSrc.set(key,u8);
  try{await idbSet(key,u8);}catch(e){} // F5 / autosave : relu depuis l'IndexedDB
}
async function importSrcGet(key){
  if(importSrc.has(key))return importSrc.get(key);
  try{
    const v=await idbGet(key);
    if(v){const u=(v instanceof Uint8Array)?v:new Uint8Array(v.buffer||v);importSrc.set(key,u);return u;}
  }catch(e){}
  return null;
}
function importPlaceholder(name){
  // Fonction import d'un ancien fichier, restée sans géométrie : même nom → on s'y
  // rebranche ; sinon, s'il n'en reste qu'UNE, on propose (le nom du fichier sur le
  // disque diffère souvent : « Cavité(Symétrie miroir) » ↔ « Cavité.step »).
  const att=(doc.features||[]).filter(f=>f&&f.type==='import'&&!f._mesh&&!importGeom.has(f.id));
  const m=att.find(f=>f.name===name);
  if(m)return m;
  if(att.length===1&&confirm('Rebrancher « '+name+' » sur l\'import manquant « '+att[0].name+' » ?\n(usinages et opérations qui le visent conservés)\n\nAnnuler = l\'ajouter comme nouvel import.'))return att[0];
  return null;
}
function importAttach(name,fmt,u8,entry,fileName){
  // Fonction import : nouvelle, ou rebranchement d'une fonction « à réimporter ».
  const key=importSrcKey(u8);
  importSrcPut(key,u8); // mémoire immédiate ; écriture IndexedDB en tâche de fond (l'import n'attend pas)
  const src={fmt,key,size:u8.length,file:fileName};
  const ph=importPlaceholder(name);
  if(ph){
    docPushUndo('réimport '+name);
    ph.src=src;ph._mesh=entry.mesh;importGeom.set(ph.id,entry);
    sel={kind:'feature',id:ph.id};
    markDirty();builtVersion=-1;builtHash=null;rebuild();showAll();
    return ph.id;
  }
  const id=uid('im');
  importGeom.set(id,entry);
  const nf={id,type:'import',name,visible:true,_mesh:entry.mesh,src};
  const ud=entry.mesh.geometry&&entry.mesh.geometry.userData; // absent hors THREE réel (tests)
  if(ud&&ud.impOcc)nf.colMode='piece'; // STEP à plusieurs solides : une couleur par pièce d'emblée
  addFeature(nf);
  return id;
}
function importStlBuild(u8){
  const geo=parseSTL(u8.buffer.slice(u8.byteOffset,u8.byteOffset+u8.byteLength));
  if(!geo)throw new Error('STL illisible');
  // centre la pièce
  geo.computeBoundingBox();const c=geo.boundingBox.getCenter(new THREE.Vector3());geo.translate(-c.x,-c.y,-c.z);
  return {mesh:new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x0a84ff}))};
}
async function importSTL(file){
  const u8=new Uint8Array(await file.arrayBuffer());
  let entry;try{entry=importStlBuild(u8);}catch(e){alert('STL illisible.');return;}
  const id=importAttach(file.name.replace(/\.[^.]+$/,''),'stl',u8,entry,file.name);
  sel={kind:'feature',id};markDirty();rebuild();showAll();
}
let _importRestoring=null; // restauration en cours (promesse), sinon null
async function importRestorePending(){
  // Rejoue les imports du document à partir de leur source persistée. Appelée à
  // l'ouverture (deserialise, qui l'ATTEND) et quand le noyau OCCT devient prêt (F5).
  // Restauration déjà en cours (noyau prêt pendant une ouverture) : on l'attend puis on
  // relance — elle visait peut-être l'ANCIEN document, dont elle saute les fonctions
  // (« document remplacé ») ; avant, l'appel rendait 0 et le nouveau document restait sans STEP.
  while(_importRestoring){try{await _importRestoring;}catch(e){}}
  const todo=(doc.features||[]).filter(f=>f&&f.type==='import'&&!f._mesh&&!importGeom.has(f.id)&&f.src&&f.src.key);
  if(!todo.length)return 0;
  if(todo.some(f=>f.src.fmt!=='stl')&&!occHas())return 0; // occtFinishBoot relancera
  let fin;_importRestoring=new Promise(r=>{fin=r;});let n=0;const miss=[];
  try{
    for(const f of todo){
      const u8=await importSrcGet(f.src.key);
      if(!u8){miss.push(f.name);continue;}
      if(!(doc.features||[]).includes(f))continue; // document remplacé entre-temps
      try{
        const e=(f.src.fmt==='stl')?importStlBuild(u8):importStepBuild(u8);
        importGeom.set(f.id,e);f._mesh=e.mesh;n++;
      }catch(err){miss.push(f.name);}
    }
  }finally{_importRestoring=null;fin();}
  if(n){
    builtVersion=-1;builtHash=null;builtEngine=null;rebuild();if(!viewUserMoved)showAll();
    try{const t=faceEl.textContent.replace(/\n?[^\n]*STEP en cours de restauration/g,'');faceEl.textContent=(t?t+'\n':'')+n+' import(s) restauré(s).';}catch(e){}
  }
  if(miss.length)try{faceEl.textContent='Import(s) sans source : '+miss.join(', ')+' — réimportez le fichier (même nom : il se rebranche sur la fonction existante).';}catch(e){}
  return n;
}
function parseSTL(buf){
  try{
    const dv=new DataView(buf);let off=0;
    const txt=new TextDecoder().decode(buf.slice(0,80));
    if(txt.trim().startsWith('solid')){
      const s=new TextDecoder().decode(buf);const vs=[];
      const re=/vertex\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)/gi;let m;
      while((m=re.exec(s))){vs.push(parseFloat(m[1]),parseFloat(m[2]),parseFloat(m[3]));}
      if(vs.length>=9){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.computeVertexNormals();return g;}
    }
    const n=dv.getUint32(80,true);const pos=new Float32Array(n*9);
    for(let i=0;i<n;i++){const b=84+i*50;
      pos[i*9]=dv.getFloat32(b,true);pos[i*9+1]=dv.getFloat32(b+4,true);pos[i*9+2]=dv.getFloat32(b+8,true);
      pos[i*9+3]=dv.getFloat32(b+12,true);pos[i*9+4]=dv.getFloat32(b+16,true);pos[i*9+5]=dv.getFloat32(b+20,true);
      pos[i*9+6]=dv.getFloat32(b+24,true);pos[i*9+7]=dv.getFloat32(b+28,true);pos[i*9+8]=dv.getFloat32(b+32,true);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.computeVertexNormals();return g;
  }catch(e){return null;}
}
async function importSTEP(file){
  if(!occHas()){alert('Moteur STEP (OCCT) pas encore chargé — réessayez dans quelques secondes (page servie en http:// de préférence).\nEn attendant : import STL OK, extrusions OK.');return;}
  try{
    const u8=new Uint8Array(await file.arrayBuffer());
    const entry=importStepBuild(u8);
    importAttach(file.name.replace(/\.[^.]+$/,''),'step',u8,entry,file.name);
    markDirty();rebuild();showAll();
    faceEl.textContent='STEP importé : '+file.name;
  }catch(e){alert('Import STEP impossible : '+((e&&e.message)||'erreur interne du noyau OCCT (mémoire insuffisante ?) — rechargez la page (F5) puis réessayez'));} // exception C++ : pas de message
}
function importStepBuild(u8){
  // Octets STEP -> {mesh, faoGeo, edges, brep}. Synchrone, déterministe : le
  // rejeu d'un document redonne EXACTEMENT les mêmes triangles qu'à l'import.
  {
    const path='/i.stp'; // chemin court fixe (cf. export)
    try{occt.FS.unlink(path);}catch(e){}
    occt.FS.writeFile(path,u8);
    const reader=new occt.STEPControl_Reader_1();
    reader.ReadFile(path); // statut passé en revue via NbRootsForTransfer
    if(reader.NbRootsForTransfer()<1)throw new Error('aucun solide transférable');
    reader.TransferRoots();const shape=reader.OneShape();
    // FAO : la définition HISTORIQUE de l'import (0,5 mm / 0,5 rad), posée AVANT la
    // finesse d'affichage. Le noyau ne retesselle JAMAIS vers plus grossier : si l'on
    // commençait par le maillage fin, la demande grossière réutiliserait le fin et
    // l'outillage verrait d'autres triangles qu'aujourd'hui.
    let faoGeo=null;
    try{faoGeo=occTessellate(shape,0.5,0.5);}catch(e){faoGeo=null;}
    // MÊME déflection d'affichage que le natif (occDisplayDefl) : finesse commune,
    // ombrage identique, budget de triangles borné. Avant : 0,5 mm fixe + 0,5 rad,
    // donc un STEP toujours plus grossier qu'une pièce native.
    // Gros STEP (V0.22.4) : le maillage FAO dépasse DÉJÀ le budget d'affichage → l'affichage
    // en prend une copie. Remailler plus fin le multipliait (planches 1 à 32 : 2,2 → 5,7 M
    // triangles, ~65 s) et le budget ne peut pas le réduire : le noyau ne regrossit jamais.
    let nFao=0;try{nFao=faoGeo?Number(faoGeo.attributes.position.count)/3:0;}catch(e){} // harnais Node : compteur non numérique
    let g=null;
    if(nFao>OCC_DISPLAY_TRIS){g=faoGeo.clone();g.userData={occGroups:faoGeo.userData.occGroups};}
    else{
      const D=occDisplayDefl(shape);
      g=occTessellateBudget(shape,D,OCC_DISPLAY_TRIS)||occTessellate(shape,D.lin,D.ang);
    }
    if(!g||!g.attributes.position.count)throw new Error('tessellation vide');
    const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x0a84ff}));
    mesh.raycast=importRaycast; // V0.23.0 : clic et zoom rapides sur les gros imports
    const entry={mesh};
    if(faoGeo)entry.faoGeo=faoGeo; // géométrie réservée à l'outillage (voir la fin du fichier)
    // Arêtes tangentes : besoin des FACES et de leur continuité (C0/G1). Le shape est
    // détruit juste en dessous (shape.delete()) — on les classe DONC ICI, une fois pour
    // toutes, et on les range dans la table. Sans ça, l'overlay « Arêtes » ne couvrait
    // jamais un STEP : le repli ne dessinait que des vives > 30°, tout en noir.
    // V0.22.4 : classées au PREMIER BESOIN (overlay « Arêtes », sélection FAO…) — le solide
    // exact reste dans la table (entry.brep). Planches 1 à 32 : ~30 s épargnées à l'import
    // quand les arêtes sont masquées (réglage par défaut).
    let edges;
    Object.defineProperty(entry,'edges',{enumerable:true,configurable:true,
      get(){
        if(edges===undefined){edges=null;try{const E=entry.brep&&occSharpEdges(entry.brep);if(E&&E.length)edges=E;}catch(e){}}
        return edges||undefined;
      },
      set(v){edges=v;}});
    try{const O=importStepOcc(shape);if(O){O.tree=importStepTree(u8,O.oc,O.nOcc);delete O.oc;g.userData.impOcc=O;}}catch(e){} // couleurs par pièce / occurrence, arborescence

    // SOLIDE EXACT CONSERVÉ : sans lui, la voie exacte n'avait RIEN à unir ni à
    // soustraire (le mesh n'est pas un solide) — « Uni » restait deux pièces et
    // « Soustraction » tombait dans le vide. Le BRep reste la PROPRIÉTÉ de la table :
    // occReplayBody en prend une COPIE, jamais l'original (libéré ici, à la purge).
    entry.brep=shape;
    try{reader.delete();}catch(e){}
    try{occt.FS.unlink(path);}catch(e){}
    return entry; // {mesh, edges, faoGeo, brep}
  }
}
/* ---- STEP à corps multiples : une couleur par PIÈCE ou par OCCURRENCE ----
   Chaque solide du STEP est une occurrence ; deux occurrences de la même pièce
   partagent leur géométrie (même TShape, placement différent : IsPartner).
   Le maillage d'affichage porte alors une couleur par sommet, choisie dans la
   palette auto ; f.colMode : 'piece' | 'occ' | absent (= couleur du corps).
   Seul l'affichage change : FAO (faoGeo) et solide exact (brep) intacts. */
function importStepOcc(shape){
  // {faceOcc, occPart, nOcc, nPart} : ordinal de face (même ordre que occTriPos) →
  // occurrence → pièce. Occurrence = un solide, ou une coque / face LIBRE (hors solide :
  // MERLIN-37-000 en a 4 pour 25 solides — l'ancien test « tout est dans un solide »
  // renonçait alors et l'import restait d'une seule couleur). null si moins de 2.
  // Parcours récursif par TopoDS_Iterator : même ordre en profondeur que
  // l'explorateur de faces d'occTriPos, donc mêmes ordinaux.
  // V0.22.5 : + oc = arbre des composés du noyau ({k:[…]} composé, {o:i} occurrence),
  // calé ensuite sur l'arbre d'assemblage du texte STEP (importStepTree).
  const E=occt.TopAbs_ShapeEnum;
  const owners=[],faceOcc=[];let oc=null;
  const typ=s=>{const t=s.ShapeType();return t===E.TopAbs_SOLID?'so':t===E.TopAbs_SHELL?'sh':t===E.TopAbs_FACE?'f':t===E.TopAbs_COMPOUND||t===E.TopAbs_COMPSOLID?'c':'';};
  const visit=(s,own,par)=>{
    const t=typ(s);
    if(t==='so'||((t==='sh'||t==='f')&&own<0)){
      own=owners.length;
      // poignée neuve (Value() est une référence interne de l'itérateur)
      owners.push(t==='so'?occt.TopoDS.Solid_1(s):t==='sh'?occt.TopoDS.Shell_1(s):occt.TopoDS.Face_1(s));
      if(par)par.k.push({o:own});
      par=null;
    }else if(t==='c'&&own<0){const n={k:[]};if(par)par.k.push(n);else if(!oc)oc=n;par=n;}
    if(t==='f'){faceOcc.push(own);return;}
    if(!t)return;
    const it=new occt.TopoDS_Iterator_2(s,true,true);
    try{while(it.More()){visit(it.Value(),own,par);it.Next();}}finally{try{it.delete();}catch(e){}}
  };
  try{
    visit(shape,-1,null);
    if(owners.length<2)return null;
    const occPart=new Int32Array(owners.length),rep=[];
    owners.forEach((s,i)=>{
      let p=rep.findIndex(j=>{try{return s.IsPartner(owners[j]);}catch(e){return false;}});
      if(p<0){p=rep.length;rep.push(i);}
      occPart[i]=p;
    });
    return {faceOcc:Int32Array.from(faceOcc),occPart,nOcc:owners.length,nPart:rep.length,oc};
  }finally{owners.forEach(s=>{try{s.delete();}catch(e){}});}
}
/* ---- V0.22.5 : arborescence d'un STEP multi-corps ----
   Les noms ne sont pas lisibles par le noyau (chaînes XCAF non liées dans opencascade.js) :
   on lit l'arbre d'assemblage dans le TEXTE du fichier — PRODUCT ← PRODUCT_DEFINITION_FORMATION
   ← PRODUCT_DEFINITION, et NEXT_ASSEMBLY_USAGE_OCCURRENCE (instance nommée parent → enfant).
   Le noyau range une définition en composé : ses instances dans l'ordre des NAUO du fichier,
   puis ses propres solides (vérifié sur « planches 1 à 32 » : vis, vis, puis la plaquette).
   On cale les deux arbres nœud par nœud ; au moindre écart de structure, noms génériques.
   Nœud : {n:nom, k:[enfants], o:[occurrences du sous-arbre]}. */
function importStepStr(s){
  // Chaîne STEP (Part 21) → texte : '' → ', \X\hh (Latin-1), \S\c (moitié haute), \X2\…\X0\ (UTF-16).
  if(!s||s[0]!=="'")return '';
  s=s.slice(1,-1).replace(/''/g,"'");
  s=s.replace(/\\X2\\([0-9A-Fa-f]+)\\X0\\/g,(_,h)=>{let o='';for(let i=0;i+3<h.length;i+=4)o+=String.fromCharCode(parseInt(h.substr(i,4),16));return o;});
  s=s.replace(/\\X\\([0-9A-Fa-f]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
  s=s.replace(/\\S\\(.)/g,(_,c)=>String.fromCharCode(c.charCodeAt(0)+128));
  s=s.replace(/\\\\/g,'\\');
  if(/[Â-ô][\u0080-¿]/.test(s)){try{s=decodeURIComponent(escape(s));}catch(e){}} // UTF-8 brut écrit tel quel
  return s.trim();
}
function importStepTree(u8,oc,nOcc){
  if(!oc||!u8)return null;
  let txt='';
  try{txt=new TextDecoder('latin1').decode(u8);}
  catch(e){const C=0x8000,A=[];for(let i=0;i<u8.length;i+=C)A.push(String.fromCharCode.apply(null,u8.subarray(i,i+C)));txt=A.join('');} // harnais Node
  const WANT={PRODUCT:1,PRODUCT_DEFINITION_FORMATION:1,PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE:1,PRODUCT_DEFINITION:1,NEXT_ASSEMBLY_USAGE_OCCURRENCE:1};
  const args=i=>{ // arguments de premier niveau à partir de i (juste après « ( »)
    const out=[];let d=0,cur='',inS=false;
    for(;i<txt.length;i++){const c=txt[i];
      if(c==='\r'||c==='\n')continue; // fins de ligne ignorées partout (Part 21)
      if(inS){cur+=c;if(c==="'"){if(txt[i+1]==="'"){cur+="'";i++;}else inS=false;}continue;}
      if(c==="'"){inS=true;cur+=c;continue;}
      if(c==='('){d++;cur+=c;continue;}
      if(c===')'){if(!d){out.push(cur.trim());return out;}d--;cur+=c;continue;}
      if(c===','&&!d){out.push(cur.trim());cur='';continue;}
      cur+=c;}
    return out;
  };
  const ent=new Map(),re=/#(\d+)\s*=\s*([A-Z_0-9]+)\s*\(/g;let m;
  while((m=re.exec(txt)))if(WANT[m[2]])ent.set(+m[1],{t:m[2],a:args(re.lastIndex)});
  const ref=s=>+String(s||'').replace('#','');
  const pdName=pd=>{const P=ent.get(pd),F=P&&ent.get(ref(P.a[2])),R=F&&ent.get(ref(F.a[2]));return R?importStepStr(R.a[1])||importStepStr(R.a[0]):'';};
  const kids=new Map(),isKid=new Set();
  [...ent.keys()].sort((a,b)=>a-b).forEach(n=>{const e=ent.get(n);if(e.t!=='NEXT_ASSEMBLY_USAGE_OCCURRENCE')return;
    const p=ref(e.a[3]),c=ref(e.a[4]);if(!kids.has(p))kids.set(p,[]);
    kids.get(p).push({name:importStepStr(e.a[1])||importStepStr(e.a[0])||pdName(c),pd:c});isKid.add(c);});
  const roots=[...ent.keys()].filter(n=>ent.get(n).t==='PRODUCT_DEFINITION'&&!isKid.has(n)).sort((a,b)=>a-b);
  let nSub=0;
  const gen=(c,name)=>{ // sans définition : noms génériques
    if(c.o!==undefined)return {n:name||('Solide '+(c.o+1)),k:[],o:[c.o]};
    const nd={n:name||('Sous-ensemble '+(++nSub)),k:[],o:[]};
    c.k.forEach(x=>{const ch=gen(x,null);nd.k.push(ch);nd.o.push(...ch.o);});
    return nd;
  };
  const build=(c,name,pd)=>{
    const nau=kids.get(pd)||[];
    if(c.o!==undefined){if(nau.length)throw 0;return {n:name,k:[],o:[c.o]};}
    if(c.k.length<nau.length)throw 0;
    const nd={n:name,k:[],o:[]},own=c.k.length-nau.length,pn=pdName(pd)||name;
    c.k.forEach((x,i)=>{
      const ch=i<nau.length?build(x,nau[i].name,nau[i].pd):gen(x,own>1?pn+' ('+(i-nau.length+1)+')':pn);
      nd.k.push(ch);nd.o.push(...ch.o);
    });
    return nd;
  };
  let T=null;
  try{
    if(roots.length===1)T=build(oc,pdName(roots[0]),roots[0]);
    else if(roots.length>1&&oc.k.length===roots.length){
      T={n:'',k:[],o:[]};oc.k.forEach((x,i)=>{const ch=build(x,pdName(roots[i]),roots[i]);T.k.push(ch);T.o.push(...ch.o);});
    }
  }catch(e){T=null;}
  if(!T){nSub=0;T=gen(oc,'');}
  if(T.o.length!==nOcc)return null; // garde-fou : chaque occurrence exactement une fois
  return T;
}
function importRaycast(raycaster,intersects){
  // V0.23.0 : lancer de rayon d'un gros import — boîte de chaque face BRep (occGroups) testée
  // d'abord, triangles seulement dans les faces traversées (drawRange : même code three.js,
  // mêmes résultats, faceIndex global). Moule 73-40 : 2,1 M triangles, 73 000 faces.
  const g=this.geometry,G=g&&g.userData&&g.userData.occGroups,M=THREE.Mesh.prototype.raycast;
  if(!G||G.length<64||g.index||!g.attributes.position)return M.call(this,raycaster,intersects);
  let B=g.userData.grpBox;
  if(!B){
    const P=g.attributes.position.array;B=new Float32Array(G.length*6);
    G.forEach((gr,i)=>{
      let a=Infinity,b=Infinity,c=Infinity,d=-Infinity,e=-Infinity,f=-Infinity;
      for(let k=gr.start*9,z=(gr.start+gr.count)*9;k<z;k+=3){const x=P[k],y=P[k+1],w=P[k+2];
        if(x<a)a=x;if(x>d)d=x;if(y<b)b=y;if(y>e)e=y;if(w<c)c=w;if(w>f)f=w;}
      B.set([a,b,c,d,e,f],i*6);
    });
    g.userData.grpBox=B; // positions d'origine ; masquer ne fait que rétrécir les faces : boîtes toujours englobantes
  }
  if(g.boundingSphere===null)g.computeBoundingSphere();
  const S=new THREE.Sphere().copy(g.boundingSphere).applyMatrix4(this.matrixWorld);
  if(!raycaster.ray.intersectsSphere(S))return;
  const ray=raycaster.ray.clone().applyMatrix4(new THREE.Matrix4().copy(this.matrixWorld).invert());
  const box=new THREE.Box3(),s0=g.drawRange.start,c0=g.drawRange.count;
  try{
    for(let i=0;i<G.length;i++){
      const o=i*6;box.min.set(B[o],B[o+1],B[o+2]);box.max.set(B[o+3],B[o+4],B[o+5]);
      if(!ray.intersectsBox(box))continue;
      g.drawRange.start=G[i].start*3;g.drawRange.count=G[i].count*3;
      M.call(this,raycaster,intersects);
    }
  }finally{g.drawRange.start=s0;g.drawRange.count=c0;}
}
let impTreeOpen=new Set(); // nœuds dépliés (« idFonction » ou « idFonction/chemin ») : état de vue
function importTreeOf(f){
  const g=f&&f._mesh&&f._mesh.geometry,O=g&&g.userData&&g.userData.impOcc;
  return O&&O.tree&&O.tree.k&&O.tree.k.length?O.tree:null;
}
function importHideSet(f,occ,hide){
  // 👁 d'un nœud : masque / affiche toutes ses occurrences (vue seule, annulable, enregistré).
  docPushUndo((hide?'masquer':'afficher')+' des pièces de « '+f.name+' »');
  const H=new Set(f.hidOcc||[]);occ.forEach(o=>{if(hide)H.add(o);else H.delete(o);});
  if(H.size)f.hidOcc=[...H].sort((a,b)=>a-b);else delete f.hidOcc;
  try{importHideApply(f);}catch(e){}
  try{if(bodyVisSig()!==edgeOverlayVisSig)buildEdgeOverlay();}catch(e){} // V0.23.8 : leurs arêtes suivent
  markDirty();renderTree();
}
function importTreeRows(L,f,T,lvl){
  // Lignes de l'arborescence d'un STEP sous sa fonction (42, featNode).
  const H=new Set(f.hidOcc||[]),q=typeof treeQuery!=='undefined'&&!!treeQuery;
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const rows=(n,path,lv)=>n.k.forEach((c,i)=>{
    const key=f.id+'/'+path+i,open=!!c.k.length&&(impTreeOpen.has(key)||q);
    const nh=c.o.reduce((s,o)=>s+(H.has(o)?1:0),0),all=nh===c.o.length,some=nh>0&&!all;
    L.push({lvl:lv,cls:'tnode'+(all?' hidden':''),
      title:(c.k.length?'Sous-ensemble · '+c.o.length+' pièce(s)':'Pièce')+' du STEP « '+f.name+' » · 👁 = afficher / masquer dans la vue (la FAO et le solide exact ne changent pas)',
      html:'<span class="tri">'+(c.k.length?(open?'▼':'▶'):'')+'</span><span>'+(c.k.length?'📦':'🧊')+'</span><span class="nm">'+esc(c.n)+
        (c.k.length?' <span style="color:var(--muted)">· '+c.o.length+(nh?' · '+nh+' masquée(s)':'')+'</span>':'')+'</span>'+
        '<span class="eye" title="Afficher / masquer"'+(some?' style="opacity:.45"':'')+'>'+(all?EYE_OFF:'👁')+'</span>',
      on:{
        tri:()=>{if(!c.k.length)return;if(impTreeOpen.has(key))impTreeOpen.delete(key);else impTreeOpen.add(key);renderTree();},
        eye:()=>importHideSet(f,c.o,!all),
        ctx:e=>importPieceMenu(e.clientX,e.clientY,f.id,c.o,c.n),
        click:()=>{if(c.k.length){if(impTreeOpen.has(key))impTreeOpen.delete(key);else impTreeOpen.add(key);}
          treeSel=[f.id];sel={kind:'feature',id:f.id};renderTree();renderProps();}}});
    if(open)rows(c,path+i+'/',lv+1);
  });
  rows(T,'',lvl);
}
function importHideApply(f){
  // Pièces masquées d'un import (f.hidOcc : n° d'occurrence) : leurs triangles sont aplatis
  // en un point dans le maillage d'AFFICHAGE (ni dessinés ni cliquables ; numéros de
  // triangle et de face intacts). La FAO (faoGeo) et le solide exact (brep) n'y voient rien.
  const g=f&&f._mesh&&f._mesh.geometry,O=g&&g.userData&&g.userData.impOcc;
  if(!g||!O||!g.attributes||!g.attributes.position)return;
  const H=Array.isArray(f.hidOcc)?f.hidOcc.filter(i=>i>=0&&i<O.nOcc):[];
  const key=H.slice().sort((a,b)=>a-b).join(',');
  if((g.userData.impHidKey||'')===key)return;
  const pa=g.attributes.position,P=pa.array;
  if(!g.userData.impPos0)g.userData.impPos0=P.slice();
  P.set(g.userData.impPos0);
  if(H.length){
    const hid=new Uint8Array(O.nOcc);H.forEach(i=>{hid[i]=1;});
    (g.userData.occGroups||[]).forEach(gr=>{
      const o=O.faceOcc[gr.f];if(o===undefined||!hid[o])return;
      for(let t=gr.start,z=gr.start+gr.count;t<z;t++){const b=t*9;P[b+3]=P[b+6]=P[b];P[b+4]=P[b+7]=P[b+1];P[b+5]=P[b+8]=P[b+2];}
    });
  }
  pa.needsUpdate=true;g.userData.impHidKey=key;delete g.userData.impGrid;
}
function importCol(c,i){
  // Couleur n° i : la palette vive, puis des teintes à l'angle d'or (22 pièces dans
  // MERLIN-37-000 : les 8 couleurs de la palette se répétaient d'une pièce voisine à l'autre).
  // V0.22.2 : le bleu VIVID[0] (couleur des corps par défaut) est sauté — la plus grosse
  // pièce de MERLIN le prenait et l'import semblait rester d'une seule couleur.
  if(i<VIVID.length-1)c.setHex(VIVID[i+1]);
  else{i-=VIVID.length-1;c.setHSL((i*0.381966+0.07)%1,0.62+0.2*(i%2),0.42+0.16*((i>>1)%2));}
  return c;
}
function importColorMat(f,mat){
  // Pose (ou retire) les couleurs par sommet d'un import selon f.colMode ; rend mat.
  // applyBodyStyle laisse alors la matière BLANCHE (sinon la couleur du corps teinterait tout).
  const g=f&&f._mesh&&f._mesh.geometry,O=g&&g.userData&&g.userData.impOcc;
  const mode=(O&&(f.colMode==='piece'||f.colMode==='occ'))?f.colMode:null;
  if(!g||!mat)return mat;
  try{importHideApply(f);}catch(e){} // pièces masquées dans l'arborescence
  if(!mode){
    if(g.userData&&g.userData.impColKey){g.deleteAttribute('color');g.userData.impColKey=null;} // seulement si posées ici
    mat.vertexColors=false;
    return mat;
  }
  const key=mode+'2';
  if(g.userData.impColKey!==key||!g.getAttribute('color')){
    const n=g.attributes.position.count,col=new Float32Array(n*3),c=new THREE.Color();
    (g.userData.occGroups||[]).forEach(gr=>{
      const o=O.faceOcc[gr.f];if(o===undefined)return;
      importCol(c,mode==='occ'?o:O.occPart[o]);
      for(let t=gr.start*3,z=(gr.start+gr.count)*3;t<z&&t<n;t++){col[t*3]=c.r;col[t*3+1]=c.g;col[t*3+2]=c.b;}
    });
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    g.userData.impColKey=key;
  }
  mat.vertexColors=true;mat.needsUpdate=true;
  return mat;
}
/* V0.22.2 : STEP DANS LA CHAÎNE EXACTE (corps avec d'autres fonctions, outil de face) —
   le corps est retessellé depuis le solide calculé : l'import n'est plus affiché et ses
   couleurs étaient perdues. Chaque face du corps reprend la couleur de la pièce du STEP
   sur laquelle elle est posée (triangles du maillage d'import à moins de tol) ; une face
   nouvelle (paroi d'un perçage, matière extrudée) garde la couleur du corps. */
function importTriGrid(g){
  // Grille des triangles du maillage d'import (rang de face par triangle), mémorisée sur g.
  if(g.userData.impGrid)return g.userData.impGrid;
  const P=g.attributes.position.array,nt=(P.length/9)|0,tf=new Int32Array(nt).fill(-1);
  (g.userData.occGroups||[]).forEach(gr=>{for(let t=gr.start,z=Math.min(nt,gr.start+gr.count);t<z;t++)tf[t]=gr.f;});
  g.computeBoundingBox();const bb=g.boundingBox,sz=bb.getSize(new THREE.Vector3());
  const h=Math.max(sz.x,sz.y,sz.z,1e-6)/Math.min(256,Math.max(48,Math.round(4*Math.cbrt(nt)))),cells=new Map(); // ~1 case par triangle sur la plus grande dimension
  const ix=v=>Math.floor((v-bb.min.x)/h),iy=v=>Math.floor((v-bb.min.y)/h),iz=v=>Math.floor((v-bb.min.z)/h);
  for(let t=0;t<nt;t++){
    if(tf[t]<0)continue;const o=t*9;
    const x0=ix(Math.min(P[o],P[o+3],P[o+6])),x1=ix(Math.max(P[o],P[o+3],P[o+6]));
    const y0=iy(Math.min(P[o+1],P[o+4],P[o+7])),y1=iy(Math.max(P[o+1],P[o+4],P[o+7]));
    const z0=iz(Math.min(P[o+2],P[o+5],P[o+8])),z1=iz(Math.max(P[o+2],P[o+5],P[o+8]));
    for(let a=x0;a<=x1;a++)for(let b=y0;b<=y1;b++)for(let c=z0;c<=z1;c++){
      const k=(a*1024+b)*1024+c;let L=cells.get(k);if(!L){L=[];cells.set(k,L);}L.push(t);}
  }
  return(g.userData.impGrid={P,tf,cells,h,min:bb.min.clone(),ix,iy,iz});
}
function importTriNear(G,p,tol){
  // Rang de face d'import du triangle le plus proche de p (à moins de tol), sinon -1.
  const tri=new THREE.Triangle(),q=new THREE.Vector3(),P=G.P;
  let best=-1,bd=tol;const seen=new Set();
  for(let a=G.ix(p.x-tol);a<=G.ix(p.x+tol);a++)for(let b=G.iy(p.y-tol);b<=G.iy(p.y+tol);b++)for(let c=G.iz(p.z-tol);c<=G.iz(p.z+tol);c++){
    const L=G.cells.get((a*1024+b)*1024+c);if(!L)continue;
    for(const t of L){
      if(seen.has(t))continue;seen.add(t);const o=t*9;
      tri.a.set(P[o],P[o+1],P[o+2]);tri.b.set(P[o+3],P[o+4],P[o+5]);tri.c.set(P[o+6],P[o+7],P[o+8]);
      const d=tri.closestPointToPoint(p,q).distanceTo(p);if(d<=bd){bd=d;best=G.tf[t];}
    }
  }
  return best;
}
function importBodyColors(g,bodyId,lin){
  // Couleurs par sommet du maillage d'un corps exact qui contient un import multicolore
  // (f.colMode). Rend true si posées (la matière doit alors passer en vertexColors).
  if(!g||!g.userData||!g.userData.occGroups||typeof doc==='undefined')return false;
  const b0=(doc.bodies&&doc.bodies[0]&&doc.bodies[0].id)||'';
  const ims=(doc.features||[]).filter(f=>f&&f.type==='import'&&f.visible!==false&&(f.body||b0)===bodyId&&
    (f.colMode==='piece'||f.colMode==='occ')&&f._mesh&&f._mesh.geometry&&f._mesh.geometry.userData&&f._mesh.geometry.userData.impOcc);
  if(!ims.length)return false;
  const tol=Math.max(0.05,2.5*(+lin||0.1)); // deux maillages de la même surface, chacun à lin près
  const P=g.attributes.position.array,n=(P.length/3)|0,col=new Float32Array(n*3);
  const base=new THREE.Color(bodyColorOf(bodyId)),c=new THREE.Color(),p=new THREE.Vector3();
  const G=ims.map(f=>importTriGrid(f._mesh.geometry));
  let hit=0;
  g.userData.occGroups.forEach(gr=>{
    // jusqu'à 5 triangles de la face (centroïdes) : le premier posé sur une pièce l'emporte
    let cc=null;const st=Math.max(1,Math.floor(gr.count/5));
    for(let k=0;k<gr.count&&!cc;k+=st){
      const o=(gr.start+k)*9;
      p.set((P[o]+P[o+3]+P[o+6])/3,(P[o+1]+P[o+4]+P[o+7])/3,(P[o+2]+P[o+5]+P[o+8])/3);
      for(let i=0;i<ims.length&&!cc;i++){
        const fo=importTriNear(G[i],p,tol);if(fo<0)continue;
        const O=ims[i]._mesh.geometry.userData.impOcc,oc=O.faceOcc[fo];if(oc===undefined)continue;
        cc=importCol(c,ims[i].colMode==='occ'?oc:O.occPart[oc]);
      }
    }
    if(cc)hit++;const C=cc||base;
    for(let t=gr.start*3,z=(gr.start+gr.count)*3;t<z&&t<n;t++){col[t*3]=C.r;col[t*3+1]=C.g;col[t*3+2]=C.b;}
  });
  if(!hit)return false;
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  return true;
}
function importColorsPanel(p,f,pRow,pSel,pNote){
  // Panneau d'un import STEP à plusieurs solides : choix du coloriage.
  const g=f&&f._mesh&&f._mesh.geometry,O=g&&g.userData&&g.userData.impOcc;
  if(!O)return;
  const s=pSel([
    ['','Couleur du corps','Une seule couleur : celle du corps qui contient l’import'],
    ['piece','Une couleur par pièce ('+O.nPart+')','Les occurrences d’une même pièce partagent leur couleur'],
    ['occ','Une couleur par occurrence ('+O.nOcc+')','Chaque solide du fichier a sa propre couleur']],
    f.colMode||'',v=>{docPushUndo('couleurs de « '+f.name+' »');
      if(v)f.colMode=v;else delete f.colMode;
      markDirty();rebuild();renderProps();});
  pRow('Couleurs',s);
  pNote(O.nOcc+' occurrences · '+O.nPart+' pièce(s) distincte(s).'+(O.nPart<O.nOcc?' Une pièce répétée = plusieurs occurrences.':''));
}
/* ============ FAO : « corps blindés » (phase 4) ==============================
   L'affichage est désormais plus fin (occDisplayDefl + budget de triangles, phase 3)
   et 88-fao fabrique son maillage plan de posage en lisant les positions du mesh
   AFFICHÉ : sans intervention, un corps exact ou un import STEP donnerait d'autres
   triangles → autre G-code, et au-delà de 120 000 triangles le corps serait
   silencieusement EXCLU du posage (faoMeshFromBody renvoie null).
   On intercèpe donc faoMeshFromBody (déclaré en 88, appelé par faoActiveMesh) :
   la FAO reçoit la géométrie aux paramètres D'AUJOURD'HUI — occXDefl() pour un
   corps exact (le paramètre d'outillage n'a pas bougé), 0,5 mm/0,5 rad pour un
   import STEP (entry.faoGeo). Les autres corps (repli maillage, aperçus, fantômes)
   passent par l'ancienne fonction, strictement inchangée.
   Libération : b._faoGeo par clearBodies()/commitPrev(), entry.faoGeo par
   importHydrate() (entrées purgées). */
const _faoMeshFromBodyOrig=(typeof faoMeshFromBody==='function')?faoMeshFromBody:null;
function faoLegacyGeo(b){
  // Geometry d'OUTILLAGE d'un corps exact, en cache sur le corps.
  if(!b||b.kind!=='body'||!b.shape)return null;
  if(b._faoGeo)return b._faoGeo;
  let g=null;
  try{
    // Le shape est déjà maillé en AFFICHAGE (plus fin) : BRepMesh réutilise un
    // maillage existant s'il est au moins aussi fin → on l'efface, sinon la FAO
    // récupérerait la finesse d'affichage au lieu de sa définition historique.
    // V0.21.19 : corps SANS filets modélisés s'il y en a (le taraud fait le filet) —
    // mailler les centaines de faces du filet coûtait 1,5 s à chaque rejeu sur « Perçages »
    const S=b.shapeFao||b.shape;
    try{occt.BRepTools.Clean(S);}catch(e){}
    const D=occXDefl();
    g=occTessellate(S,D.lin,D.ang);
  }catch(e){g=null;}
  if(!g)return null;
  b._faoGeo=g;
  return g;
}
faoMeshFromBody=function(b){
  // Seule la lecture du mesh change : on redonne l'ANCIENNE géométrie à la
  // fonction d'origine via un corps factice {mesh:{geometry,matrixWorld}}.
  try{
    if(b&&b.kind==='import'&&_faoMeshFromBodyOrig){
      const e=importGeom.get(b.id);
      if(e&&e.faoGeo)return _faoMeshFromBodyOrig({mesh:{geometry:e.faoGeo,matrixWorld:b.mesh&&b.mesh.matrixWorld}});
    }else if(b&&b.kind==='body'&&b.shape&&_faoMeshFromBodyOrig){
      const g=faoLegacyGeo(b);
      if(g)return _faoMeshFromBodyOrig({mesh:{geometry:g,matrixWorld:b.mesh&&b.mesh.matrixWorld}});
    }
  }catch(e){}
  return _faoMeshFromBodyOrig?_faoMeshFromBodyOrig(b):null;
};
