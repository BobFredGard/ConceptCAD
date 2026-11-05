/* ---------- mesures entre pièces d'un assemblage (V0.29.0) ----------
   Le geste et les calculs sont ceux de la pièce (Ctrl+clic, faceSelect et measurePair, 90), en
   Modéliser comme en Assembler ; ce fichier leur donne les pièces affichées (composant actif,
   enfants, fantômes) : distance exacte entre faces parallèles, entraxe de deux cylindres, axe ↔ face, angle entre
   faces ; sinon distance entre les points cliqués. Un clic seul sur un cylindre donne son Ø.
   Géométrie EXACTE sans rejeu ni noyau : chaque instantané de composant porte, pour chaque face
   de ses maillages, son plan ou son cylindre (it.fg, capturé en fin de rejeu par asmFaceTable,
   gardé en cache avec l'image) ; la mesure le place par la matrice de l'instance cliquée.
   Faces d'autres types (tores, splines) ou image sans table : distance entre points cliqués. */
function asmFaceTable(b){
  // Plan / cylindre exact de chaque groupe de faces du maillage du corps b (ordre de
  // geometry.userData.occGroups), dans le repère du maillage affiché → [{k,…}|null] ou null
  try{
    if(!(typeof occHas==='function'&&occHas())||!b||!b.mesh||!b.mesh.geometry)return null;
    const groups=(b.mesh.geometry.userData||{}).occGroups||[];if(!groups.length)return null;
    let shape=null;
    if(b.kind==='body'&&b.shape&&occLive&&occLive.shape)shape=b.shape;
    else if(b.kind==='import'){const e=importGeom.get(b.ref||b.id);if(e&&e.brep)shape=e.brep;}
    if(!shape)return null;
    b.mesh.updateMatrixWorld(true);
    const M=b.mesh.matrixWorld,N=new THREE.Matrix3().getNormalMatrix(M);
    const want=new Map();groups.forEach((g,i)=>{if(!want.has(g.f))want.set(g.f,[]);want.get(g.f).push(i);});
    const out=new Array(groups.length).fill(null),T=occt.GeomAbs_SurfaceType;
    const r6=v=>[+v.x.toFixed(6),+v.y.toFixed(6),+v.z.toFixed(6)];
    const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
    let k=0;
    try{
      while(ex.More()){
        if(want.has(k)){
          let f=null,ad=null;
          try{
            f=occFaceCur(ex);ad=new occt.BRepAdaptor_Surface_2(f,true);
            const gt=ad.GetType();let G=null;
            if(gt===T.GeomAbs_Cylinder){
              const c=ad.Cylinder(),a=c.Axis();
              const C=new THREE.Vector3(a.Location().X(),a.Location().Y(),a.Location().Z()).applyMatrix4(M);
              const A=new THREE.Vector3(a.Direction().X(),a.Direction().Y(),a.Direction().Z()).applyMatrix3(N).normalize();
              G={k:'cyl',c:r6(C),a:r6(A),r:+c.Radius().toFixed(6)};
            }else if(gt===T.GeomAbs_Plane){
              const a=ad.Plane().Axis();
              const P=new THREE.Vector3(a.Location().X(),a.Location().Y(),a.Location().Z()).applyMatrix4(M);
              const n=new THREE.Vector3(a.Direction().X(),a.Direction().Y(),a.Direction().Z()).applyMatrix3(N).normalize();
              G={k:'plan',p:r6(P),n:r6(n)};
            }
            if(G)want.get(k).forEach(i=>{out[i]=G;});
          }catch(e){}
          finally{try{if(ad)ad.delete();}catch(e){}try{if(f)f.delete();}catch(e){}}
        }
        k++;ex.Next();
      }
    }finally{try{ex.delete();}catch(e){}}
    return out;
  }catch(e){return null;}
}
function asmFgNorm(fg,n){
  // Table relue (cache, fichier) : même longueur que les groupes, entrées vérifiées
  if(!Array.isArray(fg)||fg.length!==n)return null;
  const v3=a=>Array.isArray(a)&&a.length===3&&a.every(x=>typeof x==='number'&&isFinite(x));
  return fg.map(G=>{
    if(G&&G.k==='cyl'&&v3(G.c)&&v3(G.a)&&isFinite(+G.r)&&+G.r>0)return {k:'cyl',c:G.c,a:G.a,r:+G.r};
    if(G&&G.k==='plan'&&v3(G.p)&&v3(G.n))return {k:'plan',p:G.p,n:G.n};
    return null;
  });
}
function asmGrpNorm(g){
  // Groupes de faces relus : {start, count, f} entiers positifs
  if(!Array.isArray(g))return null;
  const ok=g.every(x=>x&&Number.isInteger(x.start)&&Number.isInteger(x.count)&&Number.isInteger(x.f)&&x.start>=0&&x.count>=0&&x.f>=0);
  return ok?g.map(x=>({start:x.start,count:x.count,f:x.f})):null;
}
/* ── ce que la mesure voit des composants dessinés dans la vue ── */
function asmMeasStop(quiet){
  if(!mesEnCours())return;
  clearMeasure();
  if(!quiet){try{faceEl.textContent='Mesure effacée.';}catch(e){}}
}
function asmMeasVue(){
  // Assembler : tout ce qui est placé ; Modéliser : ce qui est autour de la pièce
  const G=asmMode==='asm'?asmSceneGet().getObjectByName('asmOcc'):scene.getObjectByName('asmCtx');
  return G&&G.visible!==false?G:null;
}
function asmMeasHits(hits){
  // Rayon rayc déjà placé. Raycast d'origine : les pièces non sélectionnables l'ont neutralisé (asmFill, 47)
  const G=asmMeasVue();if(!G)return;
  G.updateMatrixWorld(true);
  G.traverseVisible(m=>{if(m.isMesh&&m.userData&&m.userData.rd){try{THREE.Mesh.prototype.raycast.call(m,rayc,hits);}catch(err){}}});
}
function asmMeasEdgeSegs(){
  // Arêtes exactes des composants affichés (_snap.pedges), placées une fois par dessin
  const G=asmMeasVue();if(!G)return [];
  let out=[];
  G.children.forEach(g=>{
    const u=g.userData;if(!u||!u.path||u.kind==='ghost')return;
    if(!u.mesSegs){
      const c=asmComp(asmPathComp(u.path)),E=(c&&c._snap&&c._snap.pedges)||[],v=new THREE.Vector3();
      g.updateMatrixWorld(true);
      u.mesSegs=E.map(x=>x.pts.map(p=>{v.set(p[0],p[1],p[2]).applyMatrix4(g.matrixWorld);return [v.x,v.y,v.z];}));
    }
    out=out.concat(u.mesSegs);
  });
  return out;
}
function asmMeasGeom(m,fi){
  // Plan / cylindre exact de la face cliquée, dans la scène d'assemblage (format occFaceGeom, 90)
  const fg=m&&m.userData.fg,grp=m&&m.geometry&&(m.geometry.userData||{}).occGroups;
  if(!fg||!grp||fi==null)return null;
  const gi=grp.findIndex(g=>fi>=g.start&&fi<g.start+g.count);if(gi<0)return null;
  const G=fg[gi];if(!G)return null;
  m.updateMatrixWorld(true);
  const M=m.matrixWorld,N=new THREE.Matrix3().getNormalMatrix(M);
  if(G.k==='cyl')return {kind:'cyl',center:new THREE.Vector3(...G.c).applyMatrix4(M),axis:new THREE.Vector3(...G.a).applyMatrix3(N).normalize(),r:G.r};
  return {kind:'plan',p:new THREE.Vector3(...G.p).applyMatrix4(M),n:new THREE.Vector3(...G.n).applyMatrix3(N).normalize()};
}
function asmMeasName(m){
  // « Châssis:1 › Roue:2 » (chemin de l'instance) ; le composant actif lui-même : son nom
  const path=m&&m.userData.ipath;if(!asm||!Array.isArray(path))return 'pièce';
  if(!path.length)return (asmRoot()||{}).name||'pièce';
  const n=[];let c=asmRoot();
  for(const id of path){const o=c&&c.occ.find(q=>q.id===id);if(!o)break;n.push(o.name);c=asmComp(o.comp);}
  return n.join(' › ')||'pièce';
}
