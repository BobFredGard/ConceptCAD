// Fonction répétable : extrusion ou congé/chanfrein exact. NI une répétition, NI une
// instance de répétition (une instance est déjà générée : la répéter empilerait des
// clones sans sens, et la liste à cocher la proposait).
function skIsRepCopy(sk){
  // Esquisse utilisée UNIQUEMENT par des instances de répétition (copie générée) → true
  const F=doc.features||[];
  return !!sk&&F.some(f=>f.repeatId&&skUsedBy(f,sk.id))&&!F.some(f=>!f.repeatId&&skUsedBy(f,sk.id));
}
// Une fonction peut porter DEUX esquisses : le balayage a son profil (sketchId) et son chemin (pathId).
function skUsedBy(f,id){return f.sketchId===id||f.pathId===id;}
function repCanFeature(id){
  const f=doc.features.find(x=>x.id===id);
  if(!f)return false;
  if(f.repeatId)return false;
  if(f.type==='repeat')return true; // V0.11.30 : une répétition se répète (voir repExpandSources)
  // 2026-10-16-005 : perçages répétables ; 2026-10-27 : dépouilles, révolutions, déplacement et
  // suppression de face ; puis balayages. Restent exclues les opérations de CORPS ENTIER (coque, scission,
  // combinaison, déplacement de corps, import) : les répéter n'a pas de sens géométrique.
  return ['extrude','revolve','sweep','hole','xfillet','xdraft','xmove','xdelface'].includes(f.type);
}
// Antériorité (43) : une répétition ne répète que ce qui la PRÉCÈDE — fonctions placées avant
// elle, ou, à la création (rp absent), avant son point d'insertion (marqueur de temps).
function repAmont(id,rp){
  const F=doc.features,i=F.findIndex(x=>x.id===id);
  if(i<0)return false;
  const m=tlIdx(),lim=rp?F.indexOf(rp):(m<0?F.length:m);
  return lim<0||i<lim;
}
// Ce qu'une fonction apporte comme source de répétition — sert d'infobulle dans la
// liste à cocher, pour qu'on sache ce qu'on coche.
function repCanFeatureHint(f){
  if(!f)return'';
  if(f.type==='extrude')return((f.op||'add')==='cut'?'Découpe':'Plot')+' · '+(+f.distance||0).toFixed(2)+' mm';
  if(f.type==='revolve')return revolveName(f);
  if(f.type==='sweep')return sweepName(f);
  if(f.type==='hole'&&f.kind==='ream')return 'Perçage alésé · Ø'+holeNorm(f).reamD+' '+(f.reamTol||'H7');
  if(f.type==='hole'&&f.kind==='step')return 'Double perçage · Ø'+holeNorm(f).stD+' ↧'+holeNorm(f).stH+' + Ø'+(+f.d||0);
  if(f.type==='hole')return 'Perçage · Ø'+(+f.d||0)+(f.thread&&f.thread.size?' · taraudé '+f.thread.size+(f.thread.lh?'-LH':''):'')+(f.kind&&f.kind!=='simple'?' · '+f.kind:'');
  if(f.type==='xfillet')return xLabel(xKindOf(f))+' · '+(f.edges||[]).length+' arête(s)'+xChamLabel(f);
  if(f.type==='xmove')return 'Déplacement de face · '+(+f.dist||0)+' mm';
  if(f.type==='bmove')return 'Déplacer un corps · '+(f.steps||[]).length+' étape(s)';
  if(f.type==='bremove')return 'Corps retiré à partir de cette étape';
  if(f.type==='bscale')return bsName(f);
  if(f.type==='xdelface')return 'Suppression · '+(f.faces||[]).length+' face(s)';
  if(f.type==='xdraft')return 'Dépouillage · '+draftAngleEff(f).toFixed(1).replace('.',',').replace('-','−')+'° · '+(f.faces||[]).length+' face(s)';
  if(f.type==='xshell')return 'Coque · '+String(Math.round((+f.thick||0)*100)/100).replace('.',',')+' mm · '+(f.faces||[]).length+' face(s) retirée(s)';
  if(f.type==='xsplit')return splitName(f);
  if(f.type==='repeat')return repTypeName(f.mode,f)+' · '+doc.features.filter(k=>k.repeatId===f.id).length+' instance(s) — le motif entier (sources + instances) est recopié';
  return '';
}
// V0.11.30 : RÉPÉTER UNE RÉPÉTITION. Une répétition prise comme source vaut ses propres
// sources (développées, une répétition de répétition aussi) suivies de ses instances : la
// copie reproduit le motif ENTIER. Une fonction cochée seule ET présente dans le motif n'est
// recopiée qu'une fois. Ordre de la timeline conservé (les ancres et « jusqu'à » des copies
// se remappent sur des fonctions déjà clonées dans la même passe).
function repExpandSources(list,seen){
  seen=seen||new Set();const out=[];
  const ord=(a,b)=>doc.features.indexOf(a)-doc.features.indexOf(b);
  (list||[]).slice().sort(ord).forEach(f=>{
    if(!f||seen.has(f.id))return;seen.add(f.id);
    if(f.type!=='repeat'){out.push(f);return;}
    out.push(...repExpandSources((f.base||[]).map(id=>doc.features.find(x=>x.id===id)).filter(Boolean),seen));
    doc.features.forEach(k=>{if(k.repeatId===f.id&&!seen.has(k.id)){seen.add(k.id);out.push(k);}});
  });
  return out;
}
// Liste des fonctions répétables, en CASES À COCHER.
// PARTAGÉE par la création (repMode) et l'édition d'une répétition déjà construite :
// les deux offrent exactement les mêmes choix, la ticked = sources actuelles. Extraite
// en une seule fonction pour que les deux panneaux ne puissent pas diverger.
//
// RÈGLE ABSOLUE : cette liste ne se reconstruit JAMAIS depuis le `onchange` d'une de ses
// cases. Reconstruire le panneau (p.innerHTML='') pendant le clic DÉTRUIT le nœud que
// l'utilisateur vient de cocher : le navigateur achève alors l'activation sur un nœud
// détaché et l'état visuel retombe — d'où le symptôme « je peux décocher mais pas
// cocher » (décocher « marche » seulement parce que l'image est déjà celle attendue).
// On met donc à jour le compteur SUR PLACE, et on ne rafraîchit que le modèle et la 3D.
function repSourceList(base,onChange,onTick,rp){
  // rp = la répétition modifiée (absente à la création) : seules les fonctions en amont sont
  // proposées ; une source déjà cochée en aval (ancien fichier) reste visible, marquée ⚠.
  const box=document.createElement('div');box.className='col';box.style.marginTop='6px';
  const cand=doc.features.filter(f=>repCanFeature(f.id)&&(repAmont(f.id,rp)||(base||[]).indexOf(f.id)>=0));
  const t=document.createElement('div');t.className='note';t.style.marginBottom='2px';
  const estDedans=id=>cand.some(f=>f.id===id);
  const majCompteur=()=>{
    t.textContent='Fonctions à répéter — '+(base||[]).filter(estDedans).length+' cochée(s) sur '+cand.length;
  };
  majCompteur();
  box.appendChild(t);
  if(!cand.length){
    const w=document.createElement('span');w.className='note';
    w.textContent='Aucune fonction répétable en amont (extrusion, révolution, balayage, perçage, congé, chanfrein, dépouille, déplacement ou suppression de face, répétition placés avant la répétition).';
    box.appendChild(w);
    return box;
  }
  cand.forEach(f=>{
    const l=document.createElement('label');
    l.style.display='flex';l.style.alignItems='center';l.style.gap='6px';l.style.cursor='pointer';
    const c=document.createElement('input');c.type='checkbox';c.checked=(base||[]).indexOf(f.id)>=0;
    c.className='repsrcchk'; // identifie les cases de sources (la case « Visible » du panneau en est une autre)
    c.onchange=()=>{
      const b=(base||[]).slice();
      const i=b.indexOf(f.id);
      if(c.checked){if(i<0)b.push(f.id);}else if(i>=0)b.splice(i,1);
      // la case garde son propre état : on ne la remplace pas, on met à jour autour
      let ko=null;
      try{onChange(b,f);}catch(err){ko=err;}
      base=b; // l'état fait foi, même si la reconstruction a échoué : l'interface reste cohérente
      majCompteur();
      if(ko){
        try{faceEl.textContent='Répétition : mise à jour impossible ('+(ko.message||ko)+').';}catch(e){}
      }else if(onTick){
        try{onTick();}catch(e){}
      }
    };
    const s=document.createElement('span');
    const aval=!repAmont(f.id,rp);
    s.textContent=(aval?'⚠ ':'')+featIconOf(f)+' '+f.name;
    s.title=aval?'Placée APRÈS la répétition : une répétition ne doit répéter que des fonctions antérieures — décochez-la.':repCanFeatureHint(f);
    if(aval)s.style.color='var(--warn)';
    l.appendChild(c);l.appendChild(s);
    box.appendChild(l);
  });
  return box;
}
function enterRepMode(){
  if(skEdit)return;
  if(filMode||filModeX)exitFilletMode(true);
  repMode={type:'lin',copies:2,dist:20,angle:360,axis:'X',plane:'YZ',feats:[]};
  if(sel.kind==='feature'&&repCanFeature(sel.id)&&repAmont(sel.id,null))repMode.feats.push(sel.id);
  renderTree();renderRepPanel();
  faceEl.textContent='Répétition : cochez les fonctions à répéter dans la liste ci-dessus, puis Appliquer. Astuce : la repetition est depliee dans l arbre et ses sources sont marquees ◀.';
}
function exitRepMode(){try{pgPickStop();}catch(e){}repPreviewRemove();repPreviewSrcFree();repMode=null;renderTree();renderProps();}
/* V0.11.20 : APERÇU ROUGE des copies dès le choix du plan / de l'axe (retour : « j'aimerais
   voir les répétitions en rouge sur cette 1ère étape pour voir si je ne me trompe pas de
   plan »). La PIÈCE ENTIÈRE (chaque corps montré) est recopiée avec la matrice de chaque
   instance — la même transformation que subiront les fonctions cochées — sans aucun calcul
   noyau : le maillage affiché est partagé, seule une matrice change par copie. */
const REP_PREVIEW_MAX=60; // copies affichées au plus (une grille 20 × 20 n'a pas besoin de 400 fantômes)
let repPrevGroup=null;
function repPreviewXforms(cfg){
  // Matrices 4×4 (ordre colonne, THREE.Matrix4.fromArray) des instances, même machinerie que
  // repTransformPoint / repGenChildren : linéaire (grille comprise), circulaire, symétrie
  // (double : image 1, image 2, image de l'image 1 ; plans identiques : image 1 seule).
  // Fonction pure, testable sans THREE (test_repeat_apercu).
  const c=cfg||repMode;if(!c)return [];
  const t=c.mode||c.type,out=[];
  const trans=o=>[1,0,0,0, 0,1,0,0, 0,0,1,0, o[0],o[1],o[2],1];
  const lin3=(e0,e1,e2)=>[e0[0],e0[1],e0[2],0, e1[0],e1[1],e1[2],0, e2[0],e2[1],e2[2],0, 0,0,0,1];
  const mirM=n=>{const u=repNorm(n);const col=k=>{const e=[0,0,0];e[k]=1;return repAdd(e,repScale(u,-2*u[k]));};return lin3(col(0),col(1),col(2));};
  const mul=(A,B)=>{const R=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=A[i+4*k]*B[k+4*j];R[i+4*j]=s;}return R;}; // A·B
  if(t==='lin'){repLinCells(c).forEach(cell=>{if(out.length<REP_PREVIEW_MAX)out.push(trans(cell.off));});return out;}
  if(t==='circ'){
    const n=repMaxCopies(c.copies),ax=repAxisVec(c),st=repCircStep(c);
    for(let i=1;i<=n&&out.length<REP_PREVIEW_MAX;i++){const e=[[1,0,0],[0,1,0],[0,0,1]].map(v=>repRot(v,ax,st*i));out.push(lin3(e[0],e[1],e[2]));}
    return out;
  }
  if(t==='path'){
    repPathCells(Object.assign({},c,{id:c.id||'_rpEdit',copies:c.copies})).forEach(q=>{
      if(out.length>=REP_PREVIEW_MAX)return;
      const e=[[1,0,0],[0,1,0],[0,0,1]].map(v=>repRot(v,q.N,q.ang)),r0=repRot(q.P0,q.N,q.ang);
      const M=lin3(e[0],e[1],e[2]);M[12]=q.Pi[0]-r0[0];M[13]=q.Pi[1]-r0[1];M[14]=q.Pi[2]-r0[2];out.push(M);
    });
    return out;
  }
  const n1=repPlaneN(c),M1=mirM(n1);out.push(M1);
  if(c.plane2){
    const n2=c.planeN2?repNorm(c.planeN2):repPlaneN({plane:c.plane2});
    if(Math.abs(repDot(n1,n2))<0.999){const M2=mirM(n2);out.push(M2);out.push(mul(M2,M1));}
  }
  return out;
}
function repPreviewRemove(){
  if(!repPrevGroup)return;
  try{
    const mats=new Set();repPrevGroup.traverse(o=>{if(o.isMesh&&o.material)mats.add(o.material);});
    mats.forEach(m=>{try{m.dispose();}catch(e){}});
    scene.remove(repPrevGroup);
  }catch(e){}
  repPrevGroup=null; // la géométrie est celle des corps (partagée) : rien à libérer
}
/* V0.11.30 : l'aperçu montre les FONCTIONS COCHÉES, plus la pièce entière (retour : « ce qu'il
   faut montrer en rouge, ce sont les features sélectionnées et non le corps en cours »).
   - extrusion / découpe / révolution / balayage / perçage : le SOLIDE-OUTIL seul (prisme, volume tourné,
     volume percé) — ce qui sera ajouté ou enlevé à chaque copie ;
   - congé / chanfrein / dépouille / déplacement de face : les FACES du corps qui les portent ;
   - suppression de face (faces disparues) ou face introuvable : la boîte de la face mémorisée ;
   - répétition cochée : son motif entier (repExpandSources).
   La géométrie des sources est calculée UNE FOIS par jeu de sources (clé = signatures) ; changer
   le pas, l'axe ou la quantité ne fait que recalculer les matrices. */
let repPrevSrc=null; // {key, items:[{geo, mw}]} — géométries possédées par l'aperçu
function repPreviewSrcFree(){
  if(!repPrevSrc)return;
  repPrevSrc.items.forEach(it=>{try{it.geo.dispose();}catch(e){}});
  repPrevSrc=null;
}
function repBoxDist(bx,p){
  let s=0;for(let k=0;k<3;k++){const d=Math.max(0,Math.abs(p[k]-bx.pos[k])-bx.dim[k]/2);s+=d*d;}
  return Math.sqrt(s);
}
function repFaceOrd(shape,face){
  const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);
  let i=0,r=-1;
  while(ex.More()){let s=false;try{s=ex.Current().IsSame(face);}catch(e){}if(s){r=i;break;}i++;ex.Next();}
  try{ex.delete();}catch(e){}
  return r;
}
function repFeatPreviewGeos(f){
  const out=[];
  if(f.type==='extrude'||f.type==='revolve'||f.type==='sweep'||f.type==='hole'){
    let ok=false;
    if(typeof occHas==='function'&&occHas()){
      let r=null;
      // V0.30.4 : « débouchant tout » mesuré sur la pièce affichée — hors rejeu occThroughBase est
      // un reste du dernier rejeu (illisible) et l'outil d'aperçu partait sur 2 m (forêt de tiges
      // rouges sous la pièce).
      const thr0=occThroughBase;
      if(typeof occLive!=='undefined'&&occLive&&occLive.shape)occThroughBase=occLive.shape;
      try{
        r=f.type==='revolve'?occShapeOfRevolve(f):(f.type==='sweep'?occShapeOfSweep(f):(f.type==='hole'?occShapeOfHole(f):occShapeOfExtrude(f)));
        out.push({geo:occTessellate(r.shape,0.3,0.4),mw:null});ok=true;
      }catch(e){}
      finally{occThroughBase=thr0;}
      if(r){occDispose(r.bins);try{r.shape.delete();}catch(e){}}
    }
    if(!ok){
      try{
        const gl=f.type==='revolve'?legacyRevolveGeos(f,[]):(f.type==='sweep'?legacySweepGeos(f,[]):(f.type==='hole'?legacyHoleGeos(f,[]):legacyPrismGeos(f,[])));
        (gl||[]).forEach(g=>{if(g&&g.isBufferGeometry)out.push({geo:g,mw:null});});
      }catch(e){}
    }
    return out;
  }
  const refs=[],eds=[],boxes=[];
  if(f.type==='xfillet')(f.edges||[]).forEach(e=>{if(e&&Array.isArray(e.pos))eds.push({pos:e.pos,r:+e.r||+f.radius||1,len:+e.len||0,cham:!!f.chamfer});});
  if(f.type==='xdraft')(f.faces||[]).forEach(r=>{if(r&&Array.isArray(r.pos))refs.push(r);});
  if(f.type==='xmove')mvRefs(f).forEach(r=>{
    if(!r||!Array.isArray(r.pos))return;
    // la face a avancé de dist le long de sa normale
    const n=Array.isArray(r.n)?repNorm(r.n):[0,0,0],d=+f.dist||0;
    refs.push(Object.assign({},r,{pos:repAdd(r.pos,repScale(n,d)),anchor:undefined}));
  });
  if(f.type==='xdelface')(f.faces||[]).forEach(r=>{if(r&&Array.isArray(r.pos))boxes.push(r);});
  const bs=(typeof occHas==='function'&&occHas())?(bodies||[]).filter(b=>b&&b.kind==='body'&&b.shape&&b.mesh&&b.mesh.geometry&&bodyShown(b)):[];
  const ords=new Map(); // corps → ordinaux de faces
  const addOrd=(b,o)=>{if(!ords.has(b))ords.set(b,new Set());ords.get(b).add(o);};
  refs.forEach(r=>{
    let hit=false;
    for(const b of bs){
      let h=null;try{h=occFindFaceAny(b.shape,Object.assign({},r));}catch(e){h=null;}
      if(!h)continue;
      const o=repFaceOrd(b.shape,h);try{h.delete();}catch(e){}
      if(o>=0){addOrd(b,o);hit=true;break;}
    }
    if(!hit)boxes.push(r);
  });
  if(eds.length)bs.forEach(b=>{
    // faces de congé : touchent le milieu de l'arête, pas plus longues que l'arête + 2 r, courbes
    // (un chanfrein est plan : le critère de taille suffit)
    const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
    const ex=new occt.TopExp_Explorer_2(b.shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);
    let o=0;
    while(ex.More()){
      const fc=occt.TopoDS.Face_1(ex.Current());
      try{
        const bx=occFaceBox(fc);
        if(bx){
          const big=Math.max(bx.dim[0],bx.dim[1],bx.dim[2]);
          let kind=null;
          if(eds.some(e=>repBoxDist(bx,e.pos)<=0.05+0.05*e.r&&big<=e.len+2*e.r+0.5&&(e.cham||(kind=kind||occSurfKind(fc))!=='Plane')))addOrd(b,o);
        }
      }catch(e){}
      try{fc.delete();}catch(e){}
      o++;ex.Next();
    }
    try{ex.delete();}catch(e){}
  });
  ords.forEach((set,b)=>{
    try{
      const G=b.mesh.geometry,P=G.getAttribute('position'),I=G.index,gr=G.userData.occGroups||[],arr=[];
      gr.forEach(g=>{
        if(!set.has(g.f))return;
        for(let t=g.start;t<g.start+g.count;t++)for(let k=0;k<3;k++){
          const v=I?I.array[3*t+k]:3*t+k;arr.push(P.getX(v),P.getY(v),P.getZ(v));
        }
      });
      if(!arr.length)return;
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));geo.computeVertexNormals();
      b.mesh.updateMatrixWorld(true);
      out.push({geo,mw:b.mesh.matrixWorld.clone()});
    }catch(e){}
  });
  boxes.forEach(r=>{
    try{
      const d=Array.isArray(r.dim)?r.dim:[1,1,1];
      const geo=new THREE.BoxGeometry(Math.max(+d[0]||0,0.4),Math.max(+d[1]||0,0.4),Math.max(+d[2]||0,0.4));
      geo.translate(+r.pos[0]||0,+r.pos[1]||0,+r.pos[2]||0);
      out.push({geo,mw:null});
    }catch(e){}
  });
  return out;
}
function repPreviewSources(){
  const ids=((repMode&&repMode.feats)||[]).filter(id=>repCanFeature(id)&&repAmont(id,null));
  const list=repExpandSources(ids.map(id=>doc.features.find(f=>f.id===id)).filter(Boolean)).filter(f=>f.visible!==false);
  let key='';
  try{key=list.map(f=>f.id+':'+featSig(f)).join('|')+'@'+bodyVisSig();}catch(e){key=list.map(f=>f.id).join('|');}
  if(repPrevSrc&&repPrevSrc.key===key)return repPrevSrc.items;
  repPreviewSrcFree();
  const items=[];
  list.forEach(f=>{try{items.push(...repFeatPreviewGeos(f));}catch(e){}});
  repPrevSrc={key,items};
  return items;
}
function repPreviewUpdate(){
  repPreviewRemove();
  if(!repMode){repPreviewSrcFree();return;}
  if(typeof scene==='undefined'||!scene)return;
  let ms=[];
  try{ms=repPreviewXforms(repMode);}catch(e){ms=[];}
  if(!ms.length)return;
  let srcs=[];
  try{srcs=repPreviewSources();}catch(e){srcs=[];}
  if(!srcs.length)return;
  try{
    const g=new THREE.Group();g.name='repPreview';
    const mat=new THREE.MeshStandardMaterial({color:0xff5a4e,transparent:true,opacity:0.55,depthWrite:false,side:THREE.DoubleSide,roughness:0.5,metalness:0.05});
    srcs.forEach(it=>{
      ms.forEach(a=>{
        const m=new THREE.Mesh(it.geo,mat);
        m.matrixAutoUpdate=false;
        m.matrix.fromArray(a);if(it.mw)m.matrix.multiply(it.mw);
        m.raycast=()=>{};m.renderOrder=999;m.userData.bid='rep_preview';
        g.add(m);
      });
    });
    scene.add(g);repPrevGroup=g;
  }catch(e){repPrevGroup=null;}
}
function repTypeName(m,f){if(m==='mir'&&f&&f.plane2)return 'Symétrie double';if(m==='lin'&&f&&f.lin2)return 'Linéaire 2 directions';return m==='mir'?'Symétrie':m==='circ'?'Circulaire':m==='path'?'Suivant un profil':'Linéaire';}
function repAxisVec(cfg){const c=cfg||repMode;const a=c&&c.axis;if(c&&c.dir)return repNorm(c.dir);if(a==='Y')return[0,1,0];if(a==='Z')return[0,0,1];return[1,0,0];}
function repPlaneN(cfg){const c=cfg||repMode;if(c&&c.planeN)return repNorm(c.planeN);const p=c&&c.plane;if(p==='XY')return[0,0,1];if(p==='XZ')return[0,1,0];return[1,0,0];}
function repNorm(a){const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l];}
function repDot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function repCross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function repAdd(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function repScale(a,s){return[a[0]*s,a[1]*s,a[2]*s];}
function repRot(v,axis,deg){
  const u=repNorm(axis),t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t),uxv=repCross(u,v),ud=repDot(u,v);
  return repAdd(repAdd(repScale(v,c),repScale(uxv,s)),repScale(u,ud*(1-c)));
}
// pas angulaire d'une répétition circulaire (2026-10-23) : sur un tour complet, l'angle se
// partage entre original + copies (6 trous à 60°) — la dernière copie ne retombe plus sur
// l'original ; sur un secteur, original et dernière copie sont aux deux bornes.
function repCircStep(c){const a=+c.angle||360,n=+c.copies||1;return Math.abs(a)>=360-1e-9?a/(n+1):a/n;}
function repTransformPoint(p,i,cfg){const c=cfg||repMode,t=c.mode||c.type;
  const v=[+(p&&p[0]||0),+(p&&p[1]||0),+(p&&p[2]||0)];
  if(t==='lin')return repAdd(v,c._off?c._off:repScale(repAxisVec(c),(+c.dist||0)*i)); // _off : décalage d'une case de grille
  if(t==='circ')return repRot(v,repAxisVec(c),repCircStep(c)*i);
  if(t==='path'){const q=c._pc;if(!q)return v;return repAdd(repRot(repAdd(v,repScale(q.P0,-1)),q.N,q.ang),q.Pi);} // _pc : case du profil (repPathCells)
  const n=repPlaneN(c);return repAdd(v,repScale(n,-2*repDot(v,n)));
}
// Répétition SUIVANT UN PROFIL (V0.30.0, calcul : 39-profil-guide) : rp.path = {sk, pt | mid}
// (esquisse guide, point de départ), rp.pspace 'fit' (réparti) | 'pitch' (pas rp.dist),
// rp.orient 'fixed' | 'tangent', rp.rev (sens inversé). Une case par copie : {P0, Pi, N, ang}.
const repPathInfo=new Map(); // id de répétition → {L, closed, step, warn, err} (affichage, jamais enregistré)
function repPathCells(rp){
  const sk=rp&&rp.path&&doc.sketches.find(s=>s.id===rp.path.sk);
  if(sk)try{ensureSketchBasis(sk);}catch(e){}
  const R=sk?pgPlan(sk,rp,repMaxCopies(rp.copies)+1):{err:'esquisse guide introuvable — choisissez-en une',cells:[]};
  if(rp&&rp.id)repPathInfo.set(rp.id,{L:R.L,closed:R.closed,step:R.step,warn:R.warn||'',err:R.err||''});
  return R.cells.slice(0,REPEAT_MAX);
}
function repPathNote(rp){
  const I=repPathInfo.get(rp.id);if(!I)return '';
  if(I.err)return '⚠ '+I.err;
  const f=v=>String(+(+v).toFixed(3)).replace('.',',');
  return 'Longueur de la courbe : '+f(I.L)+' mm · '+(I.closed?'fermée':'ouverte')+' · pas '+f(I.step)+' mm'+(I.warn?' — ⚠ '+I.warn:'');
}
// Répétition linéaire à DEUX directions (grille) : 2ᵉ axe (rp.axis2 X/Y/Z/Face + rp.dir2), quantité
// rp.copies2 (stockée − 1, comme copies), pas rp.dist2. Une instance par case (i, j) hors (0, 0).
function repAxis2Vec(c){return repAxisVec({axis:c&&c.axis2,dir:c&&c.dir2});}
function repLinCells(rp){
  // Cases de la grille, original exclu : [{i, j, off}] — 200 instances au plus (REPEAT_MAX)
  const n1=repMaxCopies(rp.copies),out=[];
  const d1=repScale(repAxisVec(rp),+rp.dist||0);
  if(!rp.lin2){for(let i=1;i<=n1;i++)out.push({i,j:0,off:repScale(d1,i)});return out;}
  const n2=repMaxCopies(rp.copies2),d2=repScale(repAxis2Vec(rp),+rp.dist2||0);
  for(let j=0;j<=n2;j++)for(let i=0;i<=n1;i++){if(!i&&!j)continue;if(out.length>=REPEAT_MAX)return out;out.push({i,j,off:repAdd(repScale(d1,i),repScale(d2,j))});}
  return out;
}
function repTransformVec(v,i,cfg){const c=cfg||repMode,t=c.mode||c.type;
  const a=[+(v&&v[0]||0),+(v&&v[1]||0),+(v&&v[2]||0)];
  if(t==='lin')return a;
  if(t==='circ')return repRot(a,repAxisVec(c),repCircStep(c)*i);
  if(t==='path')return c._pc?repRot(a,c._pc.N,c._pc.ang):a;
  const n=repPlaneN(c);return repAdd(a,repScale(n,-2*repDot(a,n)));
}
// Encombrement (boîte alignée X/Y/Z) d'une face après transformation : |M|·dim, M = matrice
// de la rotation / du miroir. Exact pour une face alignée sur les axes ; une rotation
// quelconque en donne la boîte englobante — l'ordre de grandeur que compare occFindFace.
function repTransformDim(d,i,cfg){
  const e=[[1,0,0],[0,1,0],[0,0,1]].map(v=>repTransformVec(v,i,cfg));
  const a=[+(d&&d[0])||0,+(d&&d[1])||0,+(d&&d[2])||0];
  return [0,1,2].map(r=>Math.abs(e[0][r])*a[0]+Math.abs(e[1][r])*a[1]+Math.abs(e[2][r])*a[2]);
}
// Référence durable de face (pos/n/dim + ancre, cf. occFaceRef) transportée dans une copie :
// l'ancre suit l'esquisse CLONÉE de la même passe (comme les congés), sinon elle est jetée et
// occFindFace la recalera sur la position transformée.
// NOM D'UNE RÉFÉRENCE DANS UNE COPIE : à chaque régénération la copie repart de la position miroir de
// la source. Sans son nom elle recherchait son arête par position : Cavité Test, largeur 120, les congés
// copiés de la Symétrie double sautaient de l'arête de 4,8 mm à sa voisine de 18,13 mm (congé impossible).
// La copie garde donc le nom qu'elle a déjà, tant que la source désigne toujours le même élément.
function repNomCle(n){return n?String(n).replace(/<.*$/,'').replace(/#d+$/,''):'';}
function repNomGarde(o,src,old,cle){
  const de=cle+'De',c=repNomCle(src&&src[cle]);
  delete o[cle];
  if(c)o[de]=c;else delete o[de];
  // « même élément » : mêmes faces. Le numéro de morceau change avec la pièce (flanc#1 ↔ flanc)
  if(old&&old[cle]&&c&&(old[de]===undefined||repNomPropre(old[de])===repNomPropre(c)))o[cle]=old[cle];
}
// UN NOM DE COPIE DOIT DÉSIGNER LA COPIE. Si la référence source touche une fonction copiée dans la même
// passe (sw_30 → sw_50), le nom de la copie doit porter l'équivalent. Barquette, congé R3,3 sur le bord
// d'un renfort balayé : la copie gardait « e28/flanc|e5/flanc », une arête d'angle sans rapport avec son
// renfort. Un tel nom est oublié : la copie se recale sur l'image de la position de sa source.
function repNomPropre(n){return String(n).replace(/#[0-9]+/g,'').replace(/@[A-Za-z0-9_]+/g,'');}
function repNomVise(nomSrc,featMap){
  // Faces que le nom de la copie doit contenir : celles de la source qui nomment une fonction copiée
  const ids=Object.keys(featMap||{});
  return nomsDecoupe(repNomCle(nomSrc)).map(repNomPropre).map(x=>{
    let y=x;ids.forEach(id=>{y=y.split(id).join(featMap[id]);});
    return y===x?null:y;
  }).filter(Boolean);
}
function repNomCopieOk(nomCopie,nomSrc,featMap){
  if(!nomCopie||!nomSrc)return true;
  const a=new Set(nomsDecoupe(repNomCle(nomCopie)).map(repNomPropre));
  return repNomVise(nomSrc,featMap).every(x=>a.has(x));
}
function repNomsListe(src,nouv,old,cle,featMap){
  if(!Array.isArray(src)||!Array.isArray(nouv))return;
  nouv.forEach((o,k)=>{
    if(!o||typeof o!=='object')return;
    const ov=Array.isArray(old)?old[k]:null;
    repNomGarde(o,src[k],ov,cle);
    if(o[cle]&&src[k]&&!repNomCopieOk(o[cle],src[k][cle],featMap))delete o[cle];
  });
}
function repCloneFaceRef(r,i,skMap,cfg){
  if(!r||!Array.isArray(r.pos))return r;
  const o=Object.assign({},r);delete o._ord;delete o.nom; // la copie a ses propres faces : renommée au 1er rejeu
  o.pos=repTransformPoint(r.pos,i,cfg).map(v=>+v.toFixed(3));
  if(Array.isArray(r.n))o.n=repNorm(repTransformVec(r.n,i,cfg)).map(v=>+v.toFixed(4));
  if(Array.isArray(r.dim))o.dim=repTransformDim(r.dim,i,cfg).map(v=>+v.toFixed(3));
  if(r.anchor&&r.anchor.sk&&skMap[r.anchor.sk])o.anchor=Object.assign({},r.anchor,{sk:skMap[r.anchor.sk]});else delete o.anchor;
  return o;
}
let repReparation=false; // régénération de réparation à l'ouverture : la source est au repos
let repGenBusy=false; // garde-fou : une régénération ne s'emboîte jamais (rejeu non borné)
function repCloneSketch(sk,i,skMap,featMap,cfg,reuse){
  // reuse = esquisse d'une instance déjà créée : MISE À JOUR EN PLACE (id conservé). Les
  // identifiants d'esquisses d'instances sont donc STABLES d'une régénération à l'autre :
  // cotes, hôtes, projections, sélection et marqueur temps gardent leurs cibles.
  if(!reuse&&skMap[sk.id])return skMap[sk.id];
  const ns=JSON.parse(JSON.stringify(sk));
  // arêtes de la copie : nommées au 1er rejeu, puis gardées d'une régénération à l'autre
  (ns.entities||[]).forEach(e=>{const src={srcNom:e.srcNom},old=reuse&&(reuse.entities||[]).find(x=>x.id===e.id);repNomGarde(e,src,old,'srcNom');});
  ensureSketchBasis(ns);
  ns.name=(sk.name||'Esquisse')+' (rép '+i+')';
  ns.origin=repTransformPoint(ns.origin||[0,0,0],i,cfg).map(v=>+v.toFixed(6));
  ns.axU=repTransformVec(ns.axU,i,cfg).map(v=>+v.toFixed(9));
  ns.axV=repTransformVec(ns.axV,i,cfg).map(v=>+v.toFixed(9));
  ns.axN=repTransformVec(ns.axN,i,cfg).map(v=>+v.toFixed(9));
  // 2026-10-26 : esquisse posée sur un PLAN DE CONSTRUCTION (plane 'CG') — la copie ne doit
  // pas garder le lien : cgResolveAll recopiait à chaque rejeu la base du plan porteur dans
  // l'esquisse clonée, effaçant la transformée (la nervure « symétrique » retombait SUR
  // l'originale, ses congés copiés cherchaient des arêtes absentes). La copie devient une
  // esquisse libre au repère déjà transformé ; si le plan bouge, la source suit (cgSyncSketch),
  // sa signature change et repSyncStale régénère la copie.
  if(ns.plane==='CG'){ns.plane='FACE';delete ns.cg;}
  // V0.30.1 : une esquisse copiée ne sert qu'à sa fonction — jamais dessinée dans la vue (on
  // voyait l'esquisse entière N fois). Répétition suivant un profil dont la courbe guide est
  // dans l'esquisse de la fonction (le cas courant : point d'accroche du perçage sur la
  // courbe) : la courbe guide n'est pas recopiée, seule la géométrie de la fonction suit.
  ns.visible=false;
  if((cfg.mode||cfg.type)==='path'&&cfg.path&&cfg.path.sk===sk.id){
    const R=pgResolve(sk,cfg.path);
    if(R.ch){
      const gone=new Set(R.ch.ids);
      ns.entities=(ns.entities||[]).filter(e=>!gone.has(e.id));
      const uses=o=>Object.keys(o).some(k=>typeof o[k]==='string'&&gone.has(o[k]));
      ns.constraints=(ns.constraints||[]).filter(c=>!uses(c));
      ns.dims=(ns.dims||[]).filter(d=>!uses(d));
    }
  }
  // V0.30.3 : hôte HORS de la répétition (le cas courant : perçages répétés sur la face du
  // dessus) — la copie restait sans hôte, puis la migration la posait sur la face trouvée sous
  // son origine déplacée : une autre fonction (fond d'une découpe) ou aucune (origine hors de
  // la pièce : 21 copies sur 49 dans « Test Répétition Courbe ») → copies qui ne suivaient plus
  // l'épaisseur. Copie restée dans le plan de la face : même face, (x, y) décalés d'autant.
  const hostKeep=()=>{
    const h=ns.host,hf=doc.features.find(f=>f.id===h.feat),hs=hf&&doc.sketches.find(s=>s.id===hf.sketchId);
    if(!hs||h.tag==='SIDE'||!sk.origin)return false;
    const B=sketchBasis(hs),o0=sk.origin,o1=ns.origin,N1=ns.axN||[0,0,1];
    const d=[o1[0]-o0[0],o1[1]-o0[1],o1[2]-o0[2]],dot=(a,b)=>a[0]*b.x+a[1]*b.y+a[2]*b.z;
    if(Math.abs(Math.abs(dot(N1,B.n))-1)>1e-6||Math.abs(dot(d,B.n))>1e-4)return false;
    h.x=+((h.x||0)+dot(d,B.u)).toFixed(3);h.y=+((h.y||0)+dot(d,B.v)).toFixed(3);
    return true;
  };
  if(ns.host&&ns.host.feat&&featMap[ns.host.feat])ns.host.feat=featMap[ns.host.feat];
  else if(!(ns.host&&ns.host.feat&&hostKeep()))delete ns.host;
  if(reuse){
    const keep=reuse.id;
    for(const k of Object.keys(reuse))if(!(k in ns))delete reuse[k];
    Object.assign(reuse,ns);reuse.id=keep;
    if(!reuse.host)delete reuse.host;
    skMap[sk.id]=keep; // les congés de la passe y retrouvent l'esquisse de leur ancre
    return keep;
  }
  ns.id=uid('sk');
  doc.sketches.push(ns);skMap[sk.id]=ns.id;return ns.id;
}
function repCloneFeature(f,i,skMap,featMap,cfg,reuse){
  // reuse = instance déjà créée : on rafraîchit l'objet EXISTANT (id conservé) au lieu d'en
  // créer un nouveau — les fonctions qui pointent vers cette instance restent valides.
  const nf=JSON.parse(JSON.stringify(f));delete nf._m;delete nf._mesh;
  nf.visible=true;nf._src=f.id;
  const target=reuse?reuse.id:uid({xfillet:'xf',hole:'ho',xdraft:'dr',revolve:'rv',sweep:'sw',xmove:'mv',xdelface:'df'}[f.type]||'ex');
  if(f.type==='extrude'||f.type==='hole'||f.type==='revolve'||f.type==='sweep'){ // perçage : son esquisse de centres est clonée / transformée comme un profil
    const sk=doc.sketches.find(s=>s.id===f.sketchId);if(!sk)return null;
    featMap[f.id]=target; // AVANT l'esquisse : l'hôte (feat) de l'esquisse se remappe sur l'instance
    const reuseSk=reuse?doc.sketches.find(s=>s.id===reuse.sketchId):null;
    nf.sketchId=repCloneSketch(sk,i,skMap,featMap,cfg,reuseSk);
    if(f.type==='sweep'){
      // Le CHEMIN du balayage est lui aussi transformé : sans lui, le profil copié partirait sur
      // le chemin d'origine. S'il sert aussi de courbe guide (répétition suivant un profil), il
      // reste entier dans la copie : repCloneSketch ne doit pas y retirer la guide (path:null).
      const pk=doc.sketches.find(s=>s.id===f.pathId);if(!pk)return null;
      const reusePk=reuse?doc.sketches.find(s=>s.id===reuse.pathId):null;
      nf.pathId=repCloneSketch(pk,i,skMap,featMap,Object.assign({},cfg,{path:null}),reusePk);
    }
    if(nf.upto&&nf.upto.ex){if(featMap[nf.upto.ex])nf.upto.ex=featMap[nf.upto.ex];else nf.upto=null;}
    if(f.type==='revolve'){
      // 2026-10-27 : révolution répétée. Un axe SYSTÈME (X/Y/Z monde) ne suit pas la copie : il
      // est remplacé par une ligne de construction de l'esquisse copiée, aux mêmes coordonnées
      // 2D (le repère de l'esquisse est déjà transformé). Un miroir inverse le sens de rotation :
      // la ligne est alors retournée pour qu'une révolution partielle reste l'image miroir.
      const ax=revolveAxis2D(sk,f),ns=doc.sketches.find(s=>s.id===nf.sketchId);
      if(ax&&!ax.err&&ns){
        const inv=(cfg.mode||cfg.type)==='mir'?-1:1,P=ns.points=ns.points||{};
        P._rvA={x:ax.p2.x,y:ax.p2.y};P._rvB={x:ax.p2.x+10*inv*ax.d2.x,y:ax.p2.y+10*inv*ax.d2.y};
        ns.entities=(ns.entities||[]).filter(e=>e.id!=='_rvax').concat([{id:'_rvax',t:'line',p1:'_rvA',p2:'_rvB',construction:true}]);
        nf.axis={k:'line',id:'_rvax'};
      }
    }
  }else{
    featMap[f.id]=target;
    if(f.type==='xfillet')nf.edges=(nf.edges||[]).map(s=>{
      // Le clone d'un congé doit être le MIROIR de la sélection — donc `pos` ET `pos0`
      // (la position au moment du clic, qui sert de référence à l'appariement) sont
      // transformés. Ne transformer que `pos` laissait `pos0` sur la source : le
      // congruence cherchait alors l'arête du mauvais côté de la pièce, s'accrochait à
      // celle d'origine (d'où « ancre divergente ignorée (pointait 37,9 mm du clic) »)
      // et finissait en `_err` — le triangle ⚠ de l'arbre.
      // 2026-10-26 : l'ANCRE suit aussi — elle est en repère d'esquisse (point/entité, z,
      // côté), donc valable telle quelle sur l'esquisse CLONÉE (mêmes ids, repère miroir).
      // La remettre à null laissait xAnchorFor ré-ancrer la copie sur la meilleure esquisse
      // venue : souvent l'esquisse SOURCE ou la plaque (far:1) ; le congé copié partait sur
      // l'arête d'origine ou une arête de 0,6 mm (« le dernier congé fait des misères »).
      // Ancre sur une esquisse hors répétition : sans équivalent dans la copie → null.
      const a=s.anchor&&s.anchor.sk&&skMap[s.anchor.sk]?Object.assign({},s.anchor,{sk:skMap[s.anchor.sk]}):null;
      const o=Object.assign({},s,{anchor:a});
      o.pos=repTransformPoint(s.pos,i,cfg).map(v=>+v.toFixed(6));
      // V0.58.2 : source emportée loin de son clic (pos0 figé) par son esquisse : une copie NEUVE, ou réparée
      // à l'ouverture, part de l'endroit où la source EST. Barquette : renfort déplacé de 14,5 à 58 mm, l'image
      // du clic tombait 45 mm à côté et le congé R3,3 copié prenait une autre arête, la même pour toutes les
      // copies. Jamais après une édition : pos date alors de la valeur précédente (Cache Piles, retour de
      // valeur : mauvaises arêtes), et l'image de pos0 reste la bonne référence.
      const p0=s.pos0||s.pos,repos=!reuse||reuse._src!==f.id||repReparation;
      const loin=repos&&Math.hypot(s.pos[0]-p0[0],s.pos[1]-p0[1],s.pos[2]-p0[2])>2;
      o.pos0=loin?o.pos.slice():repTransformPoint(p0,i,cfg).map(v=>+v.toFixed(6));
      // V0.11.19 : normale de la première face d'un chanfrein asymétrique, transformée comme
      // les normales de faces (repCloneFaceRef) — la copie garde D1 sur l'image de la même face.
      if(Array.isArray(s.fn)&&s.fn.length===3)o.fn=repNorm(repTransformVec(s.fn,i,cfg)).map(v=>+v.toFixed(4));
      delete o._div; // divergence herdée de la source : sans rapport avec le clone
      return o;
    });
    if(f.type==='xdraft'){
      // 2026-10-27 : dépouille répétée — les faces visées suivent la transformation. Le plan
      // NEUTRE (référence) n'est déplacé que si la transformation le change : une translation
      // ou une rotation dans son propre plan le laisse identique, on garde alors la face
      // d'origine (souvent le dessus de la plaque, que la copie ne recrée pas).
      nf.faces=(f.faces||[]).map(r=>repCloneFaceRef(r,i,skMap,cfg));
      const r0=f.ref,r1=repCloneFaceRef(r0,i,skMap,cfg);
      const meme=r0&&Array.isArray(r0.n)&&r1&&Array.isArray(r1.n)
        &&repDot(repNorm(r0.n),r1.n)>0.9999
        &&Math.abs(repDot(repNorm(r0.n),[r1.pos[0]-r0.pos[0],r1.pos[1]-r0.pos[1],r1.pos[2]-r0.pos[2]]))<1e-3;
      nf.ref=meme?JSON.parse(JSON.stringify(r0)):r1;
      delete nf._m;
    }
    // déplacement / suppression de face : les faces visées suivent la transformation
    if(f.type==='xmove'){nf.ref=repCloneFaceRef(f.ref,i,skMap,cfg);if(Array.isArray(f.faces))nf.faces=f.faces.map(r=>repCloneFaceRef(r,i,skMap,cfg));}
    if(f.type==='xdelface'){nf.faces=(f.faces||[]).map(r=>repCloneFaceRef(r,i,skMap,cfg));delete nf._m;delete nf._err;}
  }
  // Noms des références : ceux de la copie, pas ceux de la source
  if(f.type==='xfillet')repNomsListe(f.edges,nf.edges,reuse&&reuse.edges,'nom',featMap);
  // Nom valable : l'arête se retrouve par lui et le pos0 déjà connu reste (il entre dans la signature :
  // le changer à chaque régénération empêcherait de retrouver les points de contrôle au retour d'une valeur).
  if(f.type==='xfillet'&&reuse&&Array.isArray(reuse.edges))nf.edges.forEach((o,k)=>{const v=reuse.edges[k];if(o&&o.nom&&v&&Array.isArray(v.pos0))o.pos0=v.pos0.slice();});
  if(f.type==='xdraft'||f.type==='xmove'||f.type==='xdelface')repNomsListe(f.faces,nf.faces,reuse&&reuse.faces,'nom',featMap);
  if((f.type==='xmove'||f.type==='xdraft')&&nf.ref&&f.ref&&!nf.ref.nom)repNomGarde(nf.ref,f.ref,reuse&&reuse.ref,'nom');
  // Le NOM de la FONCTION COPIÉE est conservé tel quel dans la sous-arborescence (c'est la
  // répétition elle-même qui porte le nom du TYPE : Linéaire / Circulaire / Symétrie).
  nf.name=f.name||'Fonction';
  if(reuse){
    const keep=reuse.id;
    for(const k of Object.keys(reuse))if(!(k in nf))delete reuse[k];
    Object.assign(reuse,nf);reuse.id=keep;
    return reuse;
  }
  nf.id=target;return nf; // l'insertion dans doc.features est faite par repGenChildren (kids)
}
// V0.15.10 : OPÉRATION de la répétition (comme Fusion : Joindre / Nouveau corps).
//   rp.op absent ou 'join' : les copies restent dans le corps de leur source et s'y UNISSENT ;
//   rp.op === 'new'        : chaque exemplaire devient un CORPS NEUF (un par exemplaire et par
//                            corps source — répéter deux corps donne deux corps par exemplaire).
// Les corps créés sont mémorisés dans rp.bodyMap (clé « corps source@exemplaire », pour la
// symétrie double « corps@1@2 » = image de l'image) : ids STABLES d'une régénération à l'autre,
// le nom, la couleur ou une fonction ajoutée par l'utilisateur dans le corps survivent.
function repIsNewBody(rp){return !!rp&&rp.op==='new';}
function repBodyOwner(bid){
  // Répétition « nouveau corps » qui a créé ce corps (ou null)
  return (doc.features||[]).find(r=>r&&r.type==='repeat'&&r.bodyMap&&Object.keys(r.bodyMap).some(k=>r.bodyMap[k]===bid))||null;
}
function repDropBody(bid){
  // Retire un corps créé par une répétition, s'il ne porte plus rien (fonction, outil de
  // combinaison, corps neuf d'une autre fonction) — sinon il reste, comme tout corps.
  if(!bid||(doc.features||[]).some(x=>x.body===bid||x.newBody===bid||(x.type==='combine'&&(x.tools||[]).indexOf(bid)>=0)))return false;
  const n0=(doc.bodies||[]).length;
  doc.bodies=(doc.bodies||[]).filter(b=>b.id!==bid);
  if(doc.bodies.length&&doc.activeBody===bid)doc.activeBody=doc.bodies[0].id;
  return doc.bodies.length<n0;
}
function repDetachCopies(rp,bid){
  // Les copies de rp rangées HORS du corps `bid` deviennent des fonctions ordinaires de leur
  // corps (même géométrie, plus régénérées) : la répétition peut partir sans les emporter.
  doc.features.forEach(f=>{
    if(f.repeatId!==rp.id||f.body===bid)return;
    delete f.repeatId;delete f.repIndex;delete f.repBodyKey;delete f._src;
  });
}
function repBodyFor(rp,key,src){
  // Corps de l'exemplaire `key` (créé au besoin, couleur / transparence du corps source)
  rp.bodyMap=rp.bodyMap||{};
  const bid=rp.bodyMap[key];
  if(bid&&(doc.bodies||[]).some(b=>b.id===bid))return bid;
  try{ensureBodies();}catch(e){}
  const se=(doc.bodies||[]).find(b=>b.id===src)||{};
  const n=doc.bodySeq++;
  const e={id:'b'+n,name:(se.name||'Corps')+' (rép '+key.split('@').slice(1).join('·')+')',c:se.c==null?null:se.c};
  if(se.color>0)e.color=se.color;
  if(se.op>0)e.op=se.op;
  doc.bodies.push(e);rp.bodyMap[key]=e.id;
  return e.id;
}
function repGenChildren(rp){
  // Reconstruit les INSTANCES d'une répétition depuis rp.base et ses paramètres, PAR
  // RECONSTRUCTION À PARTIR DE LA MODIFICATION : les instances existantes sont rafraîchies
  // en place (même id, même id d'esquisse), seules les instances surnuméraires ou sans
  // source sont retirées, et le tout est replacé juste après la répétition dans la timeline.
  if(!rp||rp.type!=='repeat'||repGenBusy)return 0;
  repGenBusy=true;
  try{
  const olds=doc.features.filter(f=>f.repeatId===rp.id);
  const dropSketch=cid=>{
    const f=doc.features.find(x=>x.id===cid);if(!f)return;
    [f.sketchId,f.pathId].filter(Boolean).forEach(id=>{
      if(!doc.features.some(x=>x.id!==f.id&&skUsedBy(x,id)))doc.sketches=doc.sketches.filter(s=>s.id!==id);
    });
  };
  // V0.11.30 : une répétition source (pas soi-même, pas une instance) est développée en son motif
  rp.base=rp.base.filter(id=>{const b=doc.features.find(x=>x.id===id);return b&&b.id!==rp.id&&!b.repeatId;});
  // Une répétition vit dans le corps de ses sources, pas dans le corps actif à sa création :
  // sinon l'arbre et le fil refusent de la placer parmi ses voisines (Barquette, Linéaire).
  // Régénérée à chaque ouverture : les fichiers existants se réparent d'eux-mêmes.
  {const s0=doc.features.find(x=>x.id===rp.base[0]);if(s0&&s0.body)rp.body=s0.body;}
  const n=rp.mode==='mir'?1:repMaxCopies(rp.copies);
  const base=repExpandSources(rp.base.map(id=>doc.features.find(f=>f.id===id)).filter(Boolean),new Set([rp.id]));
  // Symétrie DOUBLE : un 2ᵉ plan (rp.plane2) ajoute une 2ᵉ passe qui miroite la BASE et
  // les instances de la 1ʳᵉ passe — « la 1ère symétrie est comprise dans la seconde,
  // ainsi que l'opération initiale ». Chaque passe applique UN SEUL miroir via la
  // machinerie existante (pas de transformée composée, pas d'imbrication — celle-ci
  // reste exclue par le filtre ci-dessus et la garde repGenBusy).
  const mir2=rp.mode==='mir'&&!!rp.plane2;
  const cfg2=mir2?Object.assign({},rp,{plane:rp.plane2,planeN:rp.planeN2}):null;
  if(mir2){
    // Deux plans identiques (n et −n = même plan) : la 2ᵉ passe remettrait tout en place.
    try{
      const n1=repPlaneN(rp);
      const n2=rp.planeN2?repNorm(rp.planeN2):repPlaneN({plane:rp.plane2});
      const d=Math.abs(n1[0]*n2[0]+n1[1]*n2[1]+n1[2]*n2[2]);
      rp._samePlane=!(d<0.999);
    }catch(e){rp._samePlane=false;}
  }else delete rp._samePlane;
  // Recyclage : pour (index, type), on reprend les instances existantes dans l'ordre de la
  // timeline (priorité à celle dont la source _src correspond).
  const g=new Map();
  olds.forEach(c=>{const k=(c.repIndex||1)+'|'+c.type;if(!g.has(k))g.set(k,[]);g.get(k).push(c);});
  const take=(i,t,src)=>{
    const arr=g.get(i+'|'+t)||[];
    let c=arr.find(x=>x._src===src);
    if(!c)c=arr[0]||null;
    if(c)arr.splice(arr.indexOf(c),1);
    return c;
  };
  // 1) Recyclage : voir buildPass ci-dessous — chaque passe recycle ses propres
  // instances via take() (clé 'index|type', préférence _src), ids stables d'un rejeu
  // à l'autre. Pour la 2ᵉ passe, la source est l'instance de 1ʳᵉ passe (id stable).
  const reuse=new Map(); // 'index|srcId' -> instance existante (toutes passes)
  // Opération : nouveau corps → chaque clone va dans le corps de son exemplaire ; unir → il
  // garde le corps de sa source (copié avec elle). Une instance de 1ʳᵉ passe prise comme source
  // (symétrie double) transmet sa clé : son image va dans un corps à part (image de l'image).
  const usedBodies=new Set();
  // Retourne false quand l'exemplaire a été SUPPRIMÉ par l'utilisateur (rp.dropKeys,
  // cf. delBody) : ni corps recréé, ni clone gardé.
  const setBody=(nf,src,idx)=>{
    if(!repIsNewBody(rp)){delete nf.repBodyKey;return true;}
    delete nf.cutBodies; // chaque exemplaire est un corps à part : sa découpe ne vise que lui
    const sb=occBodyOfFeat(src);
    const key=(src.repeatId===rp.id&&src.repBodyKey?src.repBodyKey:sb)+'@'+idx;
    if((rp.dropKeys||[]).indexOf(key)>=0)return false;
    nf.repBodyKey=key;nf.body=repBodyFor(rp,key,(src.repeatId===rp.id&&src.repBodyKey)?src.repBodyKey.split('@')[0]:sb);
    usedBodies.add(nf.body);
    return true;
  };
  // 2) Purge : instances hors bornes ou dont la source a disparu (+ esquisses orphelines).
  // Pour le miroir double, les instances de 2ᵉ passe sont recyclées à partir des instances
  // de 1ʳᵉ passe (ids stables) : la passe 1 est donc reconstruite D'ABORD, puis la passe 2
  // recycle et reconstruit à partir des instances de passe 1 déjà à jour.
  const buildPass=(sources,cfg,idx)=>{
    const skMap={},featMap={};
    const kids=[];
    sources.forEach(f=>{
      const c=take(idx,f.type,f.id);
      const nf=repCloneFeature(f,idx,skMap,featMap,cfg,c||null);
      if(nf){nf.repeatId=rp.id;nf.repIndex=idx;if(!setBody(nf,f,idx))return;if(c)reuse.set(idx+'|'+f.id,c);kids.push(nf);}
    });
    return kids;
  };
  const kids1=(rp.mode==='mir')?buildPass(base,rp,1):[];
  let kids2=[];
  if(mir2&&!rp._samePlane){
    const sources2=[];
    base.forEach(f=>{sources2.push(f);const k1=kids1.find(k=>k._src===f.id);if(k1)sources2.push(k1);});
    kids2=buildPass(sources2,cfg2,2);
  }
  rp.children=[];
  const kids=(rp.mode==='mir')?kids1.concat(kids2):[];
  if(rp.mode!=='mir'){
    // linéaire : une instance par case de grille (une seule direction = une ligne), décalage explicite
    const cells=rp.mode==='lin'?repLinCells(rp):null;
    const pcs=rp.mode==='path'?repPathCells(rp):null;
    const N=cells?cells.length:pcs?pcs.length:n;
    for(let i=1;i<=N;i++){
      const skMap={},featMap={};
      const cfg=cells?Object.assign({},rp,{_off:cells[i-1].off}):pcs?Object.assign({},rp,{_pc:pcs[i-1]}):rp;
      base.forEach(f=>{
        const c=take(i,f.type,f.id);
        const nf=repCloneFeature(f,i,skMap,featMap,cfg,c||null);
        if(nf){nf.repeatId=rp.id;nf.repIndex=i;if(!setBody(nf,f,i))return;if(c)reuse.set(i+'|'+f.id,c);rp.children.push(nf.id);kids.push(nf);}
      });
    }
  }else{
    kids.forEach(nf=>rp.children.push(nf.id));
  }
  // Purge APRÈS toutes les passes (V0.16.0) : faite avant la boucle linéaire / circulaire,
  // elle voyait `reuse` encore vide et supprimait les esquisses des instances recyclées — ids
  // d'esquisses neufs à chaque régénération (cotes, hôtes, projections et cache de rejeu perdus).
  const kept=new Set([...reuse.values()]);
  olds.forEach(c=>{if(!kept.has(c))dropSketch(c.id);});
  doc.features=doc.features.filter(f=>f.repeatId!==rp.id);
  const at=doc.features.indexOf(rp);
  if(at<0)doc.features=doc.features.concat(kids);else doc.features.splice(at+1,0,...kids);
  // Corps d'exemplaires devenus inutiles (quantité réduite, retour à « Unir », source retirée)
  if(rp.bodyMap){
    Object.keys(rp.bodyMap).forEach(k=>{const b=rp.bodyMap[k];if(usedBodies.has(b))return;delete rp.bodyMap[k];repDropBody(b);});
    if(!Object.keys(rp.bodyMap).length)delete rp.bodyMap;
  }
  return kids.length;
  }finally{repGenBusy=false;}
}
function repRemoveRepeat(rp){
  if(!rp||rp.type!=='repeat')return;
  const kids=doc.features.filter(f=>f.repeatId===rp.id);
  doc.features=doc.features.filter(f=>f.id!==rp.id&&f.repeatId!==rp.id);
  kids.forEach(f=>[f.sketchId,f.pathId].filter(Boolean).forEach(id=>{
    if(!doc.features.some(x=>skUsedBy(x,id)))doc.sketches=doc.sketches.filter(s=>s.id!==id);
  }));
  if(rp.bodyMap)Object.keys(rp.bodyMap).forEach(k=>repDropBody(rp.bodyMap[k])); // corps neufs des exemplaires
}
function repSyncForSketch(skId){
  // Régénère les instances des répétitions dont une fonction SOURCE utilise cette esquisse :
  // après une édition d'esquisse, les clones (esquisses copiées/miroir) suivent la géométrie.
  if(!skId)return;
  const fids=new Set();
  doc.features.forEach(f=>{if(skUsedBy(f,skId)&&f.type!=='repeat'&&!f.repeatId)fids.add(f.id);});
  // esquisse GUIDE d'une répétition suivant un profil : les copies suivent la courbe
  for(const rp of [...doc.features]){if(rp.type==='repeat'&&rp.mode==='path'&&rp.path&&rp.path.sk===skId){repGenChildren(rp);repSyncForFeature(rp);}}
  if(!fids.size)return;
  for(const rp of [...doc.features]){if(rp.type==='repeat'&&rp.base.some(id=>fids.has(id))){repGenChildren(rp);repSyncForFeature(rp);}}
}
function repSyncForFeature(f,seen){
  // Régénère les instances des répétitions dont f est une fonction SOURCE (profondeur,
  // opération, sens, étendue, congé édités) : les clones suivent les nouveaux paramètres.
  // V0.11.30 : en cascade — une répétition régénérée régénère celles qui la répètent.
  if(!f)return;seen=seen||new Set();
  for(const rp of [...doc.features]){
    if(rp.type!=='repeat'||seen.has(rp.id)||!rp.base.includes(f.id))continue;
    seen.add(rp.id);repGenChildren(rp);repSyncForFeature(rp,seen);
  }
}
const repGenSigs=new Map(); // id de répétition -> signature des sources au dernier régénéré
function repSourceSig(rp){
  let s=JSON.stringify([rp.op||'join',rp.mode,rp.copies,rp.dist,rp.angle,rp.axis,rp.plane,rp.planeN,rp.plane2,rp.planeN2,rp.base,rp.dir,rp.lin2,rp.axis2,rp.dir2,rp.copies2,rp.dist2,rp.path,rp.pspace,rp.orient,rp.rev]);
  if(rp.mode==='path')s+='#g'+pgSketchSig(rp.path&&doc.sketches.find(x=>x.id===rp.path.sk)); // géométrie de la courbe guide
  // motif développé : une répétition source change dès que ses instances changent
  const B=(rp.base||[]).map(id=>doc.features.find(x=>x.id===id));
  if(B.some(f=>!f))s+='#?';
  repExpandSources(B.filter(Boolean),new Set([rp.id])).forEach(f=>{
    s+='#'+featSig(f);
    // les traits projetés de construction n'entrent pas dans featSig, mais la copie doit les suivre
    (doc.sketches||[]).forEach(k=>{if(skUsedBy(f,k.id))(k.entities||[]).forEach(e=>{if(e&&e.proj&&Array.isArray(e.srcMid))s+='~'+e.srcMid.map(v=>(+v).toFixed(3)).join(',');});});
  });
  return s;
}
function repSyncStale(){
  // Rejeu : régénère les répétitions dont une source (fonction OU esquisse) a changé
  // depuis la dernière génération. Renvoie true si au moins une instance a été refaite.
  let any=false;
  for(const rp of [...(doc.features||[])]){
    if(rp.type!=='repeat'||rp.visible===false)continue;
    let sg='';try{sg=repSourceSig(rp);}catch(e){continue;}
    if(repGenSigs.get(rp.id)===sg)continue;
    const first=!repGenSigs.has(rp.id);
    repGenSigs.set(rp.id,sg);
    if(first)continue; // 1er passage : on mémorise seulement (instances déjà générées à l'ouverture / à la création)
    try{repGenChildren(rp);any=true;}catch(e){}
  }
  return any;
}
function repGenAll(){
  // Balayage de réparation : CHAQUE répétition régénérée depuis ses sources. Appelé par
  // les boutons Recalcul et Rafraîchissement dur — le filet qui réaligne les instances
  // même si un chemin d'édition n'a pas synchronisé pendant la session.
  for(const rp of [...doc.features]){if(rp.type==='repeat')repGenChildren(rp);}
}
const REPEAT_MAX=200; // garde-fou : une saisie de copies aberrante ne doit pas figer le rejeu
// Champ QUANTITÉ (original compris) : texte pour accepter ƒx ; ↑ / ↓ ajoutent / retirent 1.
function repQtyInput(v,tip){const i=document.createElement('input');i.type='text';i.inputMode='numeric';i.style.width='64px';i.value=String(v);i.title=tip;parNumKeys(i);return i;}
function repQtyRead(i){const n=Math.round(parseFloat(String(i.value).replace(',','.')));return n>=2?n:2;}
function repMaxCopies(v){const n=Math.floor(+v||1);return isFinite(n)?Math.min(REPEAT_MAX,Math.max(1,n)):1;}
function repCloneSkName(sk){return /\(rép\s*\d+\)\s*$/.test((sk&&sk.name)||'');}
