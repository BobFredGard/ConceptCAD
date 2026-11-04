let edgeMode='off'; // 'off' | 'on' : surlignage vives noires / tangentes grises
try{const em=localStorage.getItem('minifusion_edges');if(em==='on'||em==='off')edgeMode=em;}catch(e){}
// V0.11.7 : UN SEUL test « ce corps est-il montré ? » — peau, arêtes, survol et choix d'arêtes,
// congés : tout lit ici. Cacher un corps (œil, clic droit, brut FAO) cache donc tout ce qui en dépend.
function bodyShown(b){return !!(b&&b.visible!==false&&!b.ghost&&b.mesh&&b.mesh.visible!==false);}
// Arêtes classées des corps exacts MONTRÉS. Tous montrés → le composé occLive (inchangé) ;
// sinon, corps par corps (sous-solide b.shape), mémorisé tant que ce sous-solide est le même :
// cacher / montrer ne relance pas la classification.
const bodyEdgeMemo=new Map(); // id du corps → {shape, edges}
function occVisibleSharpEdges(){
  if(!(occLive&&occLive.shape))return [];
  const ex=bodies.filter(b=>b&&b.kind==='body'&&!b.ghost);
  if(ex.every(bodyShown)||ex.some(b=>!b.shape))return occSharpEdges(occLive.shape);
  const out=[];
  ex.forEach(b=>{
    if(!bodyShown(b))return;
    let m=bodyEdgeMemo.get(b.id);
    if(!m||m.shape!==b.shape){m={shape:b.shape,edges:occSharpEdges(b.shape)||[]};bodyEdgeMemo.set(b.id,m);}
    out.push.apply(out,m.edges);
  });
  for(const [id,m] of bodyEdgeMemo)if(!ex.some(b=>b.id===id&&b.shape===m.shape))bodyEdgeMemo.delete(id); // sous-solides libérés
  return out;
}
// Signature de visibilité au moment du dernier overlay : refreshParts() le reconstruit dès
// qu'elle change, quel que soit le chemin qui a caché / montré le corps.
let edgeOverlayVisSig=null;
// V0.23.8 : + pièces masquées d'un STEP multi-corps (arborescence, importHideApply).
function bodyVisSig(){return bodies.filter(b=>b&&!b.ghost).map(b=>b.id+(bodyShown(b)?'+':'-')+(b.kind==='import'?importHidSig(b):'')).join(',');}
function importHidSig(b){const u=b&&b.mesh&&b.mesh.geometry&&b.mesh.geometry.userData;return u&&u.impHidKey?'['+u.impHidKey+']':'';}
function importEdgeShown(b){
  // Arête d'un STEP multi-corps : montrée tant qu'UNE de ses faces voisines est sur une
  // pièce affichée (arête commune à deux pièces en contact : gardée si l'une reste).
  const u=b&&b.mesh&&b.mesh.geometry&&b.mesh.geometry.userData,O=u&&u.impOcc;
  if(!O||!u.impHidKey)return null;
  const hid=new Uint8Array(O.nOcc);u.impHidKey.split(',').forEach(i=>{if(+i>=0&&+i<O.nOcc)hid[+i]=1;});
  return e=>!e.fs||e.fs.some(fi=>{const o=O.faceOcc[fi];return o===undefined||!hid[o];});
}
function edgeOverlayData(){
  // POLYLIGNES de l'overlay « Arêtes » : {pts:[[x,y,z]…], sharp, mw?}.
  // • corps exacts → classification C0/G1 RÉELLE sur le composé occLive (inchangé) ;
  // • IMPORTS → arêtes classées À L'IMPORT, tant que le shape BRep vivait (après
  //   shape.delete() la continuité des faces n'est plus consultable : c'est ce qui
  //   faisait qu'un STEP n'avait AUCUNE arête à côté d'une pièce native) ;
  // • repli maillage (arêtes > 30°, tout noir) : STL, imports sans classification,
  //   ou document sans corps exact — comportement d'origine, inchangé.
  const out=[];
  if(edgeMode!=='on')return out;
  const vis=bodyShown;
  const exact=!!(occLive&&occLive.shape&&bodies.some(b=>b.kind==='body'&&vis(b)));
  if(exact){
    try{occVisibleSharpEdges().forEach(e=>{if(e&&e.pts&&e.pts.length>1)out.push({pts:e.pts,sharp:!!e.sharp});});}catch(e){}
  }
  bodies.forEach(b=>{
    if(!vis(b))return;
    if(b.kind==='import'){
      let ent=null;
      try{ent=importGeom.get(b.ref||b.id);}catch(e){ent=null;}
      if(ent&&ent.edges&&ent.edges.length){
        const keep=importEdgeShown(b); // V0.23.8 : pièces masquées dans l'arborescence → leurs arêtes aussi
        ent.edges.forEach(e=>{if(e&&e.pts&&e.pts.length>1&&(!keep||keep(e)))out.push({pts:e.pts,sharp:!!e.sharp,mw:(b.mesh&&b.mesh.matrixWorld)||null});});
        return;
      } // STL / import sans classification → repli maillage ci-dessous
    }else if(exact)return; // corps exacts déjà couverts par le composé occLive
    try{out.push.apply(out,edgeOverlayFromMesh(b));}catch(e){}
  });
  return out;
}
function edgeOverlayFromMesh(b){
  // Repli maillage (ancien comportement, bit à bit) : arêtes vives > 30°, noires.
  const res=[];
  b.mesh.updateMatrixWorld(true);
  const eg=new THREE.EdgesGeometry(b.mesh.geometry,30);
  const p=eg&&eg.attributes&&eg.attributes.position;
  if(!p){try{if(eg&&eg.dispose)eg.dispose();}catch(e){}return res;}
  const A=new THREE.Vector3(),B=new THREE.Vector3(),mw=b.mesh.matrixWorld||null;
  for(let i=0;i<p.count;i+=2){
    A.fromBufferAttribute(p,i).applyMatrix4(mw);
    B.fromBufferAttribute(p,i+1).applyMatrix4(mw);
    res.push({pts:[[A.x,A.y,A.z],[B.x,B.y,B.z]],sharp:true});
  }
  try{eg.dispose();}catch(e){}
  return res;
}
// 2026-10-16-010 : corps en TRANSPARENCE vraie — passe « profondeur seule » dessinée APRÈS sa
// couleur : les arêtes cachées derrière la face avant ne sont plus tracées net (seul le voile,
// peint avant les solides, les laisse deviner à travers la matière), les parois intérieures
// restent visibles (la couleur a été dessinée avant le masque).
// 2026-10-16-012 : rendu TRANSPARENT en 3 passes (un seul maillage = ordre des triangles
// quelconque : une paroi de perçage dessinée APRÈS la face avant se mélangeait par-dessus →
// formes intérieures visibles trop tôt) :
//   1) profondeur seule (surface la plus proche) · 2) INTÉRIEUR seul (derrière cette surface),
//   intensité qui monte lentement avec la transparence · 3) surface avant (le maillage lui-même,
//   depthFunc ≤ → jamais recouverte par l'intérieur). Les arêtes cachées échouent sur la passe 1.
function glassDepthMask(b){
  if(!b||!b.mesh)return;
  const me=b.mesh,mat=me.material,ge=(mat&&mat.userData&&mat.userData.glass)||1;
  me.userData=me.userData||{};
  const drop=k=>{const o=me.userData[k];if(o){me.remove(o);try{o.material.dispose();}catch(e){}me.userData[k]=null;}};
  // pas transparent du tout → aucune passe ; « Intensité » seule → passe de profondeur (la pièce
  // s'estompe sur le FOND sans montrer l'intérieur) ; « Transparence » → + passe intérieure.
  if(!(mat&&mat.transparent)||b.ghost){drop('glassMask');drop('glassIn');me.renderOrder=0;if(mat)mat.depthFunc=THREE.LessEqualDepth;return;}
  const po={polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1};
  let pre=me.userData.glassMask,inn=me.userData.glassIn;
  if(!pre||pre.geometry!==me.geometry){drop('glassMask');
    pre=new THREE.Mesh(me.geometry,new THREE.MeshBasicMaterial(Object.assign({colorWrite:false,depthWrite:true,depthTest:true,transparent:true},po)));
    pre.renderOrder=1;pre.raycast=()=>{};pre.name='glassPre';me.add(pre);me.userData.glassMask=pre;}
  // V0.7.6 : la passe de profondeur MARQUE (stencil = 1) les pixels où cette pièce est devant
  // tout ce qui est déjà dessiné ; la passe intérieure (profondeur « plus loin ») ne dessine que
  // là. Sans cela, une pièce transparente placée DANS une pièce opaque (assemblage, ou deux corps)
  // se voyait à travers elle : « plus loin que la profondeur » valait aussi derrière l'autre pièce.
  try{const pm=pre.material;pm.stencilWrite=true;pm.stencilRef=1;pm.stencilFunc=THREE.AlwaysStencilFunc;
    pm.stencilZPass=THREE.ReplaceStencilOp;pm.stencilFail=THREE.KeepStencilOp;pm.stencilZFail=THREE.KeepStencilOp;}catch(e){}
  if(!(ge<0.999)){drop('glassIn');try{pre.material.clippingPlanes=mat.clippingPlanes||null;}catch(e){}mat.depthFunc=THREE.LessEqualDepth;me.renderOrder=3;return;}
  if(!inn||inn.geometry!==me.geometry){drop('glassIn');
    inn=new THREE.Mesh(me.geometry,new THREE.MeshStandardMaterial(Object.assign({transparent:true,depthWrite:false,depthTest:true,depthFunc:THREE.GreaterDepth},po)));
    inn.renderOrder=2;inn.raycast=()=>{};inn.name='glassIn';me.add(inn);me.userData.glassIn=inn;}
  // 2026-10-16-013 : TOUT devient transparent en même temps, petit à petit — l'intérieur prend
  // la même opacité que la surface (poids visible = ge·(1−ge) : 30 % → 0,13 · 90 % → 0,19)
  const aIn=ge;
  const im=inn.material;
  try{im.stencilWrite=true;im.stencilRef=1;im.stencilFunc=THREE.EqualStencilFunc; // seulement là où la pièce est devant
    im.stencilZPass=THREE.KeepStencilOp;im.stencilFail=THREE.KeepStencilOp;im.stencilZFail=THREE.KeepStencilOp;}catch(e){}
  try{im.color.copy(mat.color);im.emissive.copy(mat.emissive);im.roughness=mat.roughness;im.metalness=mat.metalness;}catch(e){}
  try{const cp=mat.clippingPlanes||null;im.clippingPlanes=cp;pre.material.clippingPlanes=cp;}catch(e){} // plan de coupe respecté
  im.opacity=aIn;inn.visible=aIn>0.004;im.needsUpdate=true;
  mat.depthFunc=THREE.LessEqualDepth;me.renderOrder=3; // surface avant, après l'intérieur
}
let edgeOverlayErr=null; // dernière erreur (diagnostic)
function buildEdgeOverlay(){
  const old=scene.getObjectByName('edgeOverlay');
  if(old){
    scene.remove(old);
    try{old.traverse(o=>{if(o&&o.geometry&&o.geometry.dispose)o.geometry.dispose();});}catch(e){}
  }
  try{(typeof bodies!=='undefined'?bodies:[]).forEach(b=>glassDepthMask(b));}catch(e){} // passes de transparence (arêtes affichées ou non)
  try{edgeOverlayVisSig=bodyVisSig();}catch(e){}
  if(edgeMode!=='on')return;
  // 2026-10-16-001 : arêtes RENTRANTES (épaulement, fond de poche) invisibles — dans le creux,
  // les 2 faces voisines sont à la même profondeur que le trait et le masquent. On recule
  // légèrement les FACES des corps (polygonOffset : ne touche que les polygones, pas les traits).
  try{(typeof bodies!=='undefined'?bodies:[]).forEach(b=>{const m=b&&b.mesh&&b.mesh.material;
    (Array.isArray(m)?m:[m]).forEach(x=>{if(x&&!x.polygonOffset){x.polygonOffset=true;x.polygonOffsetFactor=1;x.polygonOffsetUnits=1;x.needsUpdate=true;}});
    });}catch(e){}
  const data=edgeOverlayData();
  if(!data.length)return;
  // UN SEUL set de sommets, DEUX passes (les arêtes derrière le solide s'atténuent) :
  //   • VOILE (renderOrder -10, depthTest off) : peint AVANT les solides. Un corps
  //     translucide se dessine dessus en le laissant paraître à (1 - opacité) → les
  //     arêtes du fond apparaissent VERSETÉS, jamais crues ; un corps opaque le
  //     recouvre entièrement → comportement d'origine, strictement identique.
  //   • NET (depthTest on, après les corps) : là où le depth buffer le permet,
  //     c'est-à-dire devant le solide — vives noires, tangentes grises, pleines.
  // Un seul draw call partagé : l'overlay ne coûte pas plus cher qu'avant.
  const pos=[],col=[];
  for(const d of data){
    const pts=d&&d.pts;if(!pts||pts.length<2)continue;
    // vive → noire ; tangente → grise douce (plus lisible sur fond sombre)
    const c=d.sharp?[0.02,0.02,0.025]:[0x9a/255,0x9f/255,0xa6/255];
    const M=(d.mw&&d.mw.elements)||null;
    const put=p=>{
      let x=+p[0],y=+p[1],z=+p[2];
      if(M){const X=x,Y=y,Z=z;x=M[0]*X+M[4]*Y+M[8]*Z+M[12];y=M[1]*X+M[5]*Y+M[9]*Z+M[13];z=M[2]*X+M[6]*Y+M[10]*Z+M[14];}
      pos.push(x,y,z);col.push(c[0],c[1],c[2]);
    };
    for(let i=0;i+1<pts.length;i++){put(pts[i]);put(pts[i+1]);}
  }
  if(!pos.length)return;
  try{
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    const grp=new THREE.Group();grp.name='edgeOverlay'; // un seul nom : clearBodies() retire les DEUX passes
    // 2026-10-16-011 : arêtes ARRIÈRE en GRIS doux (plus en noir plein) — vues à travers un corps
    // transparent, elles restent estompées ; sous un corps opaque, toujours invisibles.
    // 2026-10-16-013 : le voile passe APRÈS les objets opaques (sol, pièces opaques) et AVANT la
    // pièce transparente (passes 1-3) : peint en premier, il était effacé par le SOL (filigrane
    // visible seulement par-dessous) ; avec le test de profondeur, une pièce opaque le masque.
    const veil=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x7d828a,transparent:true,opacity:0.9,depthTest:true,depthWrite:false}));
    veil.raycast=()=>{};veil.renderOrder=0.5;
    // 2026-10-16-013 : arêtes ARRIÈRE uniquement s'il y a un corps en TRANSPARENCE (filigrane) —
    // en opaque comme avec la seule « Intensité », plus aucune arête arrière.
    veil.visible=(typeof bodies!=='undefined'?bodies:[]).some(b=>bodyShown(b)&&b.mesh.material&&b.mesh.material.userData&&typeof b.mesh.material.userData.glass==='number'&&b.mesh.material.userData.glass<0.999);
    const net=new THREE.LineSegments(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false}));
    net.raycast=()=>{};net.renderOrder=990;
    grp.add(veil);grp.add(net);
    scene.add(grp); // jamais pris par le picking (raycast neutre sur les deux passes)
    try{if(typeof skEdit!=='undefined'&&skEdit&&skEdit._fade)grp.visible=false;}catch(e){} // esquisse ouverte : arêtes propres (skEdgesSync)
  }catch(e){ edgeOverlayErr=e; /* aucun overlay vaut mieux qu'un rendu cassé */ }
}
