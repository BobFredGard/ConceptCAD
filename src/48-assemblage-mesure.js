/* ---------- mesures entre pièces d'un assemblage (V0.29.0) ----------
   Mode Placer, « 📏 Mesurer » : deux clics sur des faces de n'importe quelles pièces affichées
   (composant actif, enfants, fantômes) → les mêmes mesures que dans la pièce (measurePair, 90) :
   distance exacte entre faces parallèles, entraxe de deux cylindres, axe ↔ face, angle entre
   faces ; sinon distance entre les points cliqués. Un clic seul sur un cylindre donne son Ø.
   Géométrie EXACTE sans rejeu ni noyau : chaque instantané de composant porte, pour chaque face
   de ses maillages, son plan ou son cylindre (it.fg, capturé en fin de rejeu par asmFaceTable,
   gardé en cache avec l'image) ; la mesure le place par la matrice de l'instance cliquée.
   Faces d'autres types (tores, splines) ou image sans table : distance entre points cliqués. */
let asmMeas=null; // {picks:[{mesh, faceIndex, point, geom, name}], txt}
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
            f=occt.TopoDS.Face_1(ex.Current());ad=new occt.BRepAdaptor_Surface_2(f,true);
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
/* ── commande ── */
function asmMeasStart(){
  if(asmMode!=='asm')return;
  try{if(asmPatEd)asmPatOk();}catch(e){}
  asmMeasGfxClear();
  asmMeas={picks:[],txt:''};
  try{renderProps();}catch(e){}
  try{faceEl.textContent='Mesurer : cliquez une face, puis une 2ᵉ (même pièce ou une autre) · Échap pour finir.';}catch(e){}
}
function asmRibbonMeasure(){
  // Bouton du bandeau : passe en mode Placer au besoin ; un second clic termine la mesure
  if(typeof skEdit!=='undefined'&&skEdit){try{faceEl.textContent='Fermez d’abord l’esquisse.';}catch(e){}return;}
  if(asmMeas&&asmMode==='asm'){asmMeasStop();return;}
  if(asmMode!=='asm'&&asmEnter()===false)return;
  asmMeasStart();
}
function asmMeasStop(quiet){
  if(!asmMeas)return;
  asmMeas=null;asmMeasGfxClear();
  if(!quiet){try{renderProps();}catch(e){}try{faceEl.textContent='Mesure terminée.';}catch(e){}}
}
function asmMeasGfxClear(){
  // Les tracés de mesure (90 : measureGroup, selGroup) sont rangés dans la scène d'assemblage
  try{[measureGroup,selGroup].forEach(g=>{if(g&&g.parent&&g.parent!==scene)g.parent.remove(g);});}catch(e){}
  try{clearMeasure();}catch(e){}
}
function asmMeasGfxAdopt(){
  const S=asmSceneGet();
  try{if(measureGroup)S.add(measureGroup);if(selGroup)S.add(selGroup);}catch(e){}
}
function asmMeasHit(e){
  // Face sous le curseur, toutes pièces affichées (les fantômes en dernier recours)
  const G=asmSceneGet().getObjectByName('asmOcc');if(!G)return null;
  const r=renderer.domElement.getBoundingClientRect();
  rayc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
  G.updateMatrixWorld(true);
  const hits=[];
  // raycast d'origine : les pièces non sélectionnables l'ont neutralisé (asmFill, 47)
  G.traverse(m=>{if(m.isMesh&&m.userData&&m.userData.rd){try{THREE.Mesh.prototype.raycast.call(m,rayc,hits);}catch(err){}}});
  hits.sort((a,b)=>a.distance-b.distance);
  return hits.find(h=>!h.object.userData.rd.ghost)||hits[0]||null;
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
function asmMeasClick(e){
  if(!asmMeas)return false;
  const h=asmMeasHit(e);
  if(!h){asmMeasGfxClear();asmMeas.picks=[];asmMeas.txt='';
    try{faceEl.textContent='Aucune face ici — cliquez une face d’une pièce.';}catch(err){}try{renderProps();}catch(err){}return true;}
  const P={mesh:h.object,faceIndex:h.faceIndex,point:h.point.clone(),geom:asmMeasGeom(h.object,h.faceIndex),name:asmMeasName(h.object)};
  const kind=G=>G?(G.kind==='cyl'?' · CYLINDRE Ø'+(G.r*2).toFixed(2):' · PLAN'):'';
  let txt='';
  if(asmMeas.picks.length!==1){
    // première face (ou nouvelle mesure après deux faces)
    asmMeasGfxClear();asmMeas.picks=[P];
    try{highlightTris(P.mesh,faceTrisFor(P.mesh,P.faceIndex),0xff9f0a,0.55);}catch(err){}
    if(P.geom&&P.geom.kind==='cyl'){
      try{drawAxis(P.geom.center,P.geom.axis,axisLen());tagAt('Ø '+(P.geom.r*2).toFixed(2),P.point.clone());}catch(err){}
    }
    txt='Face 1 : '+P.name+kind(P.geom)+'\nCliquez une 2ᵉ face (même pièce ou une autre).';
  }else{
    const A=asmMeas.picks[0];asmMeas.picks.push(P);
    try{highlightTris(P.mesh,faceTrisFor(P.mesh,P.faceIndex),0xff9f0a,0.55);}catch(err){}
    let done=false;try{done=measurePair(A,P);}catch(err){done=false;}
    let res;
    if(done)res=faceEl.textContent;
    else{const d=A.point.distanceTo(P.point);dimPair(A.point,P.point,d.toFixed(2)+' mm');
      res='Distance entre les points cliqués ≈ '+d.toFixed(2)+' mm'+(A.geom&&P.geom?'':'\n(face non plane ni cylindrique, ou image sans géométrie exacte : distance des points)');}
    txt='Face 1 : '+A.name+kind(A.geom)+'\nFace 2 : '+P.name+kind(P.geom)+'\n'+res;
  }
  asmMeasGfxAdopt();
  asmMeas.txt=txt;
  try{faceEl.textContent=txt;}catch(err){}
  try{renderProps();}catch(err){}
  return true;
}
function asmMeasProps(p){
  const mk=(tag,cls,txt)=>{const d=document.createElement(tag);if(cls)d.className=cls;if(txt!=null)d.textContent=txt;return d;};
  p.appendChild(mk('div','pnl-h','📏 Mesurer'));
  p.appendChild(mk('div','pnl-note','Clic sur une face, puis sur une 2ᵉ : faces parallèles, entraxe, axe ↔ face, angle — sinon distance des points. Toutes les pièces affichées, à toute profondeur.'));
  if(asmMeas&&asmMeas.txt){const r=mk('div','pnl-note',asmMeas.txt);r.style.whiteSpace='pre-line';r.style.fontWeight='600';p.appendChild(r);}
  const b=mk('div','pnl-btns');
  const nw=mk('button',null,'↺ Nouvelle mesure');nw.onclick=()=>{asmMeasGfxClear();asmMeas.picks=[];asmMeas.txt='';renderProps();};b.appendChild(nw);
  const cl=mk('button','primary','Terminer');cl.title='Échap';cl.onclick=()=>asmMeasStop();b.appendChild(cl);
  p.appendChild(b);
}
