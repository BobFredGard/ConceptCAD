/* ---------- LENTILLES : loupes posées sur la vue 3D (V1.0.19) ----------
   Demande de Fred (26/11/2026) : une interface qui ne ressemble à aucune CAO. Au lieu de changer
   d'atelier, on pose une loupe ronde sur la pièce ; sous la loupe, un autre regard. Essayée à part
   (branche essai/lentilles), gardée par Fred le 27/11 avec la pièce qui propose (93).
   Étape 1 : la loupe elle-même et la lentille COUPE.
   • Loupe : cercle posé sur la vue (bouton loupe de la barre de vue). Glisser le cercle ou son
     étiquette = déplacer ; poignée = agrandir / réduire ; × = retirer ; molette sur le cercle =
     plus ou moins profond (Maj : finement) ; double-clic sur l'étiquette = coupe au milieu.
     L'intérieur du cercle laisse passer la souris : on tourne et on sélectionne à travers.
   • Lentille Coupe : plan face à l'écran, à une profondeur comptée depuis l'avant de la pièce
     (en mm) ; la matière devant le plan disparaît sous la loupe, les faces coupées sont remplies
     de la couleur du corps (un peu plus sombre), le reste de la vue ne bouge pas.
   • Dessin (lensRender, appelé par 10 animate juste après l'image normale) : la scène est
     redessinée dans lens.rt (cible avec stencil, limitée au carré de la loupe), coupée par
     renderer.clippingPlanes — aucun matériau du logiciel n'est touché, la coupe X/Y/Z du menu ⚙
     reste indépendante. Faces coupées : pochoirs stencil (faces arrière +1, avant −1) puis peau
     plane, corps par corps, dans une scène à part (lens.capScene), comme 91-coupe-section. Puis un
     carré plein écran recopie la cible dans le cercle (bord adouci, tons et couleurs de l'écran).
   • Sélection : un rayon lancé depuis la caméra à travers une loupe ignore la matière enlevée
     (Raycaster enveloppé dès la première loupe) : on prend ce que l'on voit.
   Étape 2 (Fred : « Tu peux aller à la suite ») : la lentille FAO.
   • Le bouton loupe ouvre un petit menu : Coupe, FAO, retirer les lentilles.
   • Lentille FAO : sous la loupe, ce que montre l'espace FAO (passes de l'aperçu, brut, repère du
     posage) — le groupe faoFrameRoot (89-fao-posage-repere), caché en CAO, est allumé le temps de
     la passe de la loupe, puis remis comme avant. Rien n'est calculé : seules les passes déjà en
     mémoire (faoPrevOps de l'aperçu, 88-fao-60) sont montrées.
   • La fraise de l'opération qui coupe le plus sous la loupe est posée sur sa passe la plus
     proche du centre (forme de faoToolDims : partie coupante, queue ; bout rond pour une
     fraise boule ; axe de l'opération en 3+2).
   • Étiquette : posage · Ø de l'outil · temps de coupe des passes sous la loupe : pour chaque
     segment de coupe, la part qui tombe dans le cercle à l'écran (corde exacte, ramenée en 3D en
     perspective) ÷ son avance (travail, plongée, remontée G1 ou entrée de l'opération) ; rapides et
     opérations masquées non comptés. Recompté au plus toutes les 120 ms quand la loupe ou la vue bouge.
   Étape 3 (Fred : « FAO sur Coupe ») : une loupe FAO posée sur une loupe Coupe.
   • Zone commune aux deux cercles : la pièce coupée (passes cachées pour ne pas les couper deux
     fois), ses faces coupées, puis la racine FAO seule (lensDrawFaoOnly) coupée par le même plan et
     testée en profondeur contre la matière restée, puis la fraise entière. Recopie dans le cercle
     limitée à l'intersection (uC2 / uR2 du carré).
   • La fraise se pose sur la passe la plus proche du milieu de la zone commune, de préférence
     derrière le plan (dans la matière) : lensFaoPick, recherché au plus toutes les 120 ms.
   • Sélection : dans la zone commune, la matière enlevée ne se prend pas, même FAO dessus.
   Étape 4 : la lentille PLAN — sous la loupe, la pièce au trait sur papier (arêtes vives à l'encre,
   tangentes en gris, cachées en pointillés, contour des formes rondes) et ses cotes : Ø des trous,
   longueurs des arêtes entières sous la loupe, rayons ; posées quand la vue est calme. Voir plus bas.
   Étape 5 : la lentille RENDU — sous la loupe, chaque corps dans sa matière de rendu, avec les reflets de
   l'ambiance de la fenêtre RENDU (le métal) ; l'étiquette nomme la matière sous le centre. Voir plus bas.
   Rien n'est enregistré dans le fichier : la loupe est une aide de vue, sans ● ni annulation. */
const LENS_R_MIN=48,LENS_MAX=4,LENS_FAO_MS=120;
const lens={list:[],seq:0,rt:null,quadScene:null,quadCam:null,quadMat:null,capScene:null,caps:[],
  plane:new THREE.Plane(),layer:null,lastRS:null,drag:null,btn:null,toolScene:null,tool:null,menu:null};
const _lensCol=new THREE.Color(),_lensF=new THREE.Vector3(),_lensP=new THREE.Vector3(),_lensC=new THREE.Vector3(),_lensV2=new THREE.Vector2(),
  _lensZ=new THREE.Vector3(0,0,1),_lensQ=new THREE.Quaternion(),_lensBox=new THREE.Box3(),_lensPl=new THREE.Plane(),
  _lensM=new THREE.Matrix4(),_lensM2=new THREE.Matrix4(),_lensA=new THREE.Vector3(),_lensS=new THREE.Vector3(1,1,1);
const LENS_KINDS={
  coupe:{nom:'Coupe',teinte:'#ff9f0a',aide:'voir l’intérieur de la pièce'},
  fao:{nom:'FAO',teinte:'#5ed8ff',aide:'passes, outil et temps de coupe ici'},
  plan:{nom:'Plan',teinte:'#e8edf5',aide:'la pièce au trait, cotée'},
  rendu:{nom:'Rendu',teinte:'#c8a2ff',aide:'la matière réelle : métal, reflets'}};

function lensCanvas(){try{return renderer&&renderer.domElement;}catch(e){return null;}}
function lensSize(){const c=lensCanvas();return {w:(c&&c.clientWidth)||0,h:(c&&c.clientHeight)||0};}
function lensFmt(v){return (Math.round(v*10)/10).toFixed(1).replace('.',',');}
function lensWake(){try{if(typeof viewWake==='function')viewWake();}catch(e){}}

/* Ce qui est coupé : corps montrés de la pièce, ou composants de l'assemblage affiché */
function lensMeshes(RS){
  const out=[],S=RS||lens.lastRS||(typeof scene!=='undefined'?scene:null);
  const shown=o=>{while(o){if(!o.visible)return false;if(o===S)return true;o=o.parent;}return false;};
  const solid=m=>{const mt=Array.isArray(m.material)?m.material[0]:m.material;
    return !!(m.isMesh&&m.geometry&&m.geometry.attributes&&m.geometry.attributes.position&&mt
      &&!(m.userData&&(m.userData.noMirror||m.userData.clipStencil))&&!(mt.transparent&&mt.opacity<0.6)&&!mt.isShaderMaterial);};
  try{
    if(typeof scene!=='undefined'&&S===scene){
      (bodies||[]).forEach(b=>{if(b&&!b.ghost&&b.visible!==false&&b.mesh&&solid(b.mesh)&&shown(b.mesh))out.push(b.mesh);});
    }else if(S){
      const g=S.getObjectByName('asmOcc')||S;
      g.traverse(o=>{if(o.isMesh&&solid(o)&&shown(o))out.push(o);});
    }
  }catch(e){}
  return out;
}
function lensBounds(RS){
  _lensBox.makeEmpty();
  for(const m of lensMeshes(RS))_lensBox.expandByObject(m);
  return _lensBox.isEmpty()?null:_lensBox;
}

/* Plan de coupe d'une loupe : face à l'écran (normale = regard), à l.depth mm de l'avant de la
   pièce (null = au milieu). Côté gardé = plus loin que le plan (distance positive pour three). */
function lensPlaneFor(l,out,RS){
  out=out||lens.plane;
  camera.updateMatrixWorld();
  camera.getWorldDirection(_lensF);
  const box=lensBounds(RS);
  let front,back;
  if(box){
    front=Infinity;back=-Infinity;
    for(let i=0;i<8;i++){
      _lensP.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z);
      const d=_lensF.dot(_lensP);if(d<front)front=d;if(d>back)back=d;
    }
  }else{
    const t=(typeof controls!=='undefined'&&controls&&controls.target)?controls.target:_lensP.set(0,0,0);
    front=back=_lensF.dot(t);
  }
  const extent=Math.max(0,back-front);
  const depth=l.depth==null?extent/2:Math.max(0,Math.min(extent,l.depth));
  _lensP.copy(_lensF).multiplyScalar(front+depth);
  out.setFromNormalAndCoplanarPoint(_lensF,_lensP);
  return {front,back,extent,depth,box:!!box};
}

/* ── loupes : ajout, retrait, bornes ── */
function lensClamp(l){
  const {w,h}=lensSize();
  const rMax=Math.max(LENS_R_MIN,Math.min(w,h)*0.6||LENS_R_MIN);
  l.r=Math.max(LENS_R_MIN,Math.min(rMax,l.r));
  if(w>0)l.x=Math.max(0,Math.min(w,l.x));
  if(h>0)l.y=Math.max(0,Math.min(h,l.y));
  return l;
}
function lensAdd(kind,opts){
  kind=LENS_KINDS[kind]?kind:'coupe';
  if(lens.list.length>=LENS_MAX)return null;
  const {w,h}=lensSize(),o=opts||{};
  const r0=o.r!=null?o.r:Math.max(LENS_R_MIN,Math.min(w,h)*0.22||120);
  // les loupes suivantes se posent à côté (alternativement à droite, à gauche), pas les unes sur les autres
  const k=lens.list.length,dx=k?(k%2?1:-1)*Math.ceil(k/2)*r0*1.15:0;
  const l={id:++lens.seq,kind,x:o.x!=null?o.x:w/2+dx,y:o.y!=null?o.y:h/2,
    r:r0,depth:o.depth!=null?o.depth:null,el:null,ui:null,fao:null,faoSig:'',faoT:0,faoDirty:true,faoOp:null};
  lensClamp(l);
  lens.list.push(l);
  lensUiBuild(l);lensUiPlace(l);
  lensRaycastWrap();lensBtnSync();lensWake();
  return l;
}
function lensRemove(id){
  const i=lens.list.findIndex(l=>l.id===id);if(i<0)return false;
  const l=lens.list[i];lens.list.splice(i,1);
  try{if(l.el&&l.el.parentNode)l.el.parentNode.removeChild(l.el);}catch(e){}
  if(!lens.list.some(q=>q.kind==='coupe'))lensCapsClear();
  if(!lens.list.some(q=>q.kind==='plan'))lensPlanClear();
  if(!lens.list.some(q=>q.kind==='rendu'))lensRenduClear();
  try{lensPillPlace();}catch(e){} // les étiquettes restantes reprennent leur place
  lensBtnSync();lensWake();
  return true;
}
function lensClearAll(){lens.list.slice().forEach(l=>lensRemove(l.id));}
function lensToggle(){if(lens.list.length)lensClearAll();else lensAdd('coupe');}
function lensAt(x,y){
  for(let i=lens.list.length-1;i>=0;i--){const l=lens.list[i];if((x-l.x)*(x-l.x)+(y-l.y)*(y-l.y)<=l.r*l.r)return l;}
  return null;
}
function lensDepthStep(l,dir,fine){
  const info=lensPlaneFor(l,_lensPl);
  const step=Math.max(info.extent/(fine?200:40),0.01);
  const cur=l.depth==null?info.extent/2:Math.max(0,Math.min(info.extent,l.depth));
  l.depth=Math.max(0,Math.min(info.extent,cur+dir*step));
  lensWake();
  return l.depth;
}

/* ── sélection à travers une loupe : la matière enlevée ne se prend pas ── */
function lensRayPt(ray){ // point de l'écran (px CSS) d'où part le rayon de la souris, sinon null
  if(!lens.list.length||typeof camera==='undefined'||!camera)return null;
  camera.updateMatrixWorld();
  if(camera.isOrthographicCamera){ // rayons parallèles au regard, partis du plan proche
    camera.getWorldDirection(_lensC);if(ray.direction.dot(_lensC)<1-1e-6)return null;
  }else{
    const cp=_lensC.setFromMatrixPosition(camera.matrixWorld);
    if(ray.origin.distanceTo(cp)>1e-6*(1+cp.length()))return null; // rayon d'une autre origine (reflet, outil…)
  }
  const {w,h}=lensSize();if(!w||!h)return null;
  _lensP.copy(ray.origin).addScaledVector(ray.direction,Math.max(camera.near*2,1)).project(camera);
  return {x:(_lensP.x+1)/2*w,y:(1-_lensP.y)/2*h};
}
function lensForRay(ray){const p=lensRayPt(ray);return p?lensAt(p.x,p.y):null;}
function lensCutAt(x,y){ // lentille Coupe la plus haute sous ce point (une FAO posée dessus ne la cache pas)
  for(let i=lens.list.length-1;i>=0;i--){const l=lens.list[i];if(l.kind==='coupe'&&(x-l.x)*(x-l.x)+(y-l.y)*(y-l.y)<=l.r*l.r)return l;}
  return null;
}
function lensHitFilter(rc,hits){
  if(!hits||!hits.length||!lens.list.length)return hits;
  const p=lensRayPt(rc.ray);if(!p)return hits;
  const top=lensAt(p.x,p.y);if(!top)return hits;
  // la lentille FAO n'enlève rien, sauf là où elle est posée sur une Coupe (zone commune : pièce coupée)
  const l=top.kind==='coupe'?top:lensCutAt(p.x,p.y);if(!l)return hits;
  lensPlaneFor(l,_lensPl);
  let j=0;
  for(let i=0;i<hits.length;i++){const p=hits[i].point;if(!p||_lensPl.distanceToPoint(p)>=-1e-6)hits[j++]=hits[i];}
  hits.length=j;
  return hits;
}
let lensRcWrapped=false;
function lensRaycastWrap(){
  if(lensRcWrapped)return;lensRcWrapped=true;
  const P=THREE.Raycaster.prototype,io=P.intersectObject,ios=P.intersectObjects;
  P.intersectObject=function(o,r,t){return lensHitFilter(this,io.call(this,o,r,t));};
  P.intersectObjects=function(o,r,t){return lensHitFilter(this,ios.call(this,o,r,t));};
}

/* ── faces coupées : pochoirs + peau par corps, dans lens.capScene ── */
function lensCapsClear(){
  for(const d of lens.caps){try{d.sB.material.dispose();d.sF.material.dispose();d.mat.dispose();d.cap.geometry.dispose();}catch(e){}}
  lens.caps=[];
  if(lens.capScene)while(lens.capScene.children.length)lens.capScene.remove(lens.capScene.children[0]);
}
function lensCapsSync(list,plane,info){
  if(!lens.capScene){lens.capScene=new THREE.Scene();lens.capScene.name='lensCaps';}
  if(list.length!==lens.caps.length||list.some((m,i)=>lens.caps[i].mesh!==m||lens.caps[i].geo!==m.geometry)){
    lensCapsClear();
    list.forEach((me,k)=>{
      const mk=side=>{const m=new THREE.MeshBasicMaterial();
        m.depthWrite=false;m.depthTest=false;m.colorWrite=false;m.side=side;
        m.stencilWrite=true;m.stencilFunc=THREE.AlwaysStencilFunc;
        const op=side===THREE.BackSide?THREE.IncrementWrapStencilOp:THREE.DecrementWrapStencilOp;
        m.stencilFail=op;m.stencilZFail=op;m.stencilZPass=op;return m;};
      const st=(side,ro)=>{const s=new THREE.Mesh(me.geometry,mk(side));s.renderOrder=ro;s.matrixAutoUpdate=false;
        s.frustumCulled=false;s.raycast=()=>{};lens.capScene.add(s);return s;};
      const sB=st(THREE.BackSide,k*3),sF=st(THREE.FrontSide,k*3+1);
      sB.onBeforeRender=r=>{try{r.clearStencil();}catch(e){}}; // compteur à zéro pour CE corps
      const mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,stencilWrite:true,stencilRef:0,
        stencilFunc:THREE.NotEqualStencilFunc,stencilFail:THREE.ReplaceStencilOp,stencilZFail:THREE.ReplaceStencilOp,stencilZPass:THREE.ReplaceStencilOp});
      const cap=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);
      cap.renderOrder=k*3+2;cap.frustumCulled=false;cap.raycast=()=>{};lens.capScene.add(cap);
      lens.caps.push({mesh:me,geo:me.geometry,sB,sF,cap,mat});
    });
  }
  const box=lensBounds();
  const sz=box?Math.max(box.getSize(_lensC).length()*1.5,1):1000;
  if(box)box.getCenter(_lensC);else _lensC.set(0,0,0);
  _lensC.addScaledVector(plane.normal,-plane.distanceToPoint(_lensC)+Math.max(info.extent*1e-4,1e-4)); // un rien du côté gardé : la peau n'est pas coupée par son propre plan
  _lensQ.setFromUnitVectors(_lensZ,plane.normal);
  for(const d of lens.caps){
    d.mesh.updateWorldMatrix(true,false);
    d.sB.matrix.copy(d.mesh.matrixWorld);d.sF.matrix.copy(d.mesh.matrixWorld);
    d.sB.matrixWorldNeedsUpdate=d.sF.matrixWorldNeedsUpdate=true;
    d.cap.position.copy(_lensC);d.cap.quaternion.copy(_lensQ);d.cap.scale.setScalar(sz);
    try{const src=Array.isArray(d.mesh.material)?d.mesh.material[0]:d.mesh.material;
      if(src&&src.color)d.mat.color.copy(src.color).multiplyScalar(0.72);}catch(e){}
  }
}

/* ── lentille FAO : passes, outil, temps de coupe sous la loupe ── */
function lensFaoRoot(){try{return (typeof faoRootG!=='undefined'&&faoRootG&&faoRootG.parent)?faoRootG:null;}catch(e){return null;}}
function lensFaoOps(){try{return (typeof faoPrevOps!=='undefined'&&faoPrevOps&&faoPrevOps.size)?faoPrevOps:null;}catch(e){return null;}}
function lensFaoJob(){try{return typeof faoDoc==='function'?faoDoc():null;}catch(e){return null;}}
function lensSegLen(a,m){try{if(typeof faoSegLen==='function')return faoSegLen(a,m);}catch(e){}return Math.hypot(m.x-a.x,m.y-a.y,m.z-a.z);}
/* Passes en mémoire dont le milieu tombe dans le cercle : temps de coupe (min) par opération,
   opération qui coupe le plus, point de sa passe le plus proche du centre (repère posage). */
function lensFaoScan(l){
  const res={ok:false,t:0,op:null,tool:null,pt:null,job:null};
  const R=lensFaoRoot(),ops=lensFaoOps();
  if(!R||!ops)return res;
  // « aucun parcours » tant qu'aucune opération affichée n'a de passes en mémoire (fichier à régénérer)
  let any=false;ops.forEach((E,op)=>{if(!any&&op&&op.hidden!==true&&E&&E.src)any=E.src.some(s=>s&&s.b&&s.b.moves&&s.b.moves.length>1);});
  if(!any)return res;
  res.ok=true;res.job=lensFaoJob();
  const {w,h}=lensSize();if(!w||!h)return res;
  R.updateWorldMatrix(true,false);camera.updateMatrixWorld();
  const e=_lensM.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(R.matrixWorld).elements;
  const cx=l.x,cy=l.y,R2=l.r*l.r;
  // point projeté, en points écran depuis le centre de la loupe, et sa profondeur homogène W (≤ 0 : derrière)
  const pj=(p,o)=>{const W=e[3]*p.x+e[7]*p.y+e[11]*p.z+e[15];o[2]=W;if(!(W>1e-9))return o;
    o[0]=((e[0]*p.x+e[4]*p.y+e[8]*p.z+e[12])/W+1)/2*w-cx;o[1]=(1-(e[1]*p.x+e[5]*p.y+e[9]*p.z+e[13])/W)/2*h-cy;return o;};
  // paramètre écran s → paramètre 3D t (interpolation en perspective)
  const s2t=(s,Wa,Wb)=>s<=0?0:s>=1?1:s*Wa/((1-s)*Wb+s*Wa);
  let PA=[0,0,0],PB=[0,0,0],bestT=0;
  ops.forEach((E,op)=>{
    if(!op||op.hidden===true||!E||!E.src)return;
    // avances de l'opération : travail, plongée (G1 vertical qui descend), remontée en G1, entrée (rampe, hélice…)
    let f=1000,fp=0,fr=0,fe=0,tool=null;
    try{const sf=faoOpCutting(op,res.job);if(sf){if(+sf.f>0)f=+sf.f;fp=+sf.plunge||0;fr=+sf.retract||0;fe=+sf.entry||0;tool=sf.tool||null;}}catch(err){}
    const fOf=(a,m)=>{
      if(m.ent&&fe>0)return fe;
      if(!m.arc&&Math.abs(m.x-a.x)<1e-9&&Math.abs(m.y-a.y)<1e-9){if(m.z<a.z-1e-9&&fp>0)return fp;if(m.z>a.z+1e-9&&fr>0)return fr;}
      return f;};
    let t=0,pd=Infinity,pp=null;
    for(const s of E.src){
      const mv=s&&s.b&&s.b.moves;if(!mv||mv.length<2)continue;
      pj(mv[0],PA);
      for(let i=1;i<mv.length;i++){
        const a=mv[i-1],m=mv[i];
        pj(m,PB);
        if(!m.r&&PA[2]>1e-9&&PB[2]>1e-9){
          // morceau du segment (corde, pour un arc) dans le cercle : |A + s·(B−A)|² ≤ r²
          const dx=PB[0]-PA[0],dy=PB[1]-PA[1],qa=dx*dx+dy*dy,qb=PA[0]*dx+PA[1]*dy,qc=PA[0]*PA[0]+PA[1]*PA[1]-R2;
          let s0,s1;
          if(qa<1e-12){s0=0;s1=qc<=0?1:0;}
          else{const disc=qb*qb-qa*qc;if(disc<0){s0=s1=0;}else{const sq=Math.sqrt(disc);s0=Math.max(0,(-qb-sq)/qa);s1=Math.min(1,(-qb+sq)/qa);}}
          if(s1>s0){
            const t0=s2t(s0,PA[2],PB[2]),t1=s2t(s1,PA[2],PB[2]);
            t+=lensSegLen(a,m)*(t1-t0)/fOf(a,m);
            // point de passe le plus proche du centre : la fraise s'y pose
            const sc=qa<1e-12?0:Math.max(s0,Math.min(s1,-qb/qa)),ex=PA[0]+sc*dx,ey=PA[1]+sc*dy,d=ex*ex+ey*ey;
            if(d<pd){pd=d;const u=s2t(sc,PA[2],PB[2]);pp=[a.x+(m.x-a.x)*u,a.y+(m.y-a.y)*u,a.z+(m.z-a.z)*u];}
          }
        }
        const k=PA;PA=PB;PB=k;
      }
    }
    if(t>0){res.t+=t;if(t>bestT){bestT=t;res.op=op;res.tool=tool;res.pt=pp;}}
  });
  return res;
}
function lensFaoTick(l,now){
  const ops=lensFaoOps();
  let sig=l.x.toFixed(1)+','+l.y.toFixed(1)+','+l.r.toFixed(1)+'|'+(ops?ops.size:0);
  try{sig+='|'+(typeof faoPrevGroup!=='undefined'&&faoPrevGroup?faoPrevGroup.uuid:'');}catch(e){}
  if(typeof camera!=='undefined'&&camera){camera.updateMatrixWorld();
    const a=camera.matrixWorld.elements,p=camera.projectionMatrix.elements;
    for(let i=0;i<16;i++)sig+=','+a[i].toFixed(4)+','+p[i].toFixed(5);}
  if(sig!==l.faoSig){l.faoSig=sig;l.faoDirty=true;}
  now=now!=null?now:performance.now();
  if(l.faoDirty&&(!l.fao||now-l.faoT>=LENS_FAO_MS)){l.fao=lensFaoScan(l);l.faoT=now;l.faoDirty=false;}
  else if(l.faoDirty)lensWake(); // encore une image : le compte se refait au prochain créneau
  return l.fao;
}
function lensDur(min){
  const s=Math.max(1,Math.round(min*60));
  if(s<60)return s+' s';
  const m=Math.floor(s/60),r=s%60;
  if(m<60)return m+' min'+(r?' '+String(r).padStart(2,'0')+' s':'');
  const hh=Math.floor(m/60),mm=m%60;return hh+' h '+String(mm).padStart(2,'0')+' min';
}
function lensFaoText(F){
  if(!F||!F.ok)return 'aucun parcours';
  if(!(F.t>0))return 'rien ici';
  const d=F.tool&&+F.tool.d>0?'Ø'+String(Math.round(+F.tool.d*100)/100).replace('.',','):'';
  return [(F.job&&F.job.name)||'',d,'≈ '+lensDur(F.t)].filter(Boolean).join(' · ');
}
/* Fraise posée sur la passe : partie coupante + queue (faoToolDims), axe +Z, bout à l'origine */
function lensToolFor(t){
  let g=null;try{g=typeof faoToolDims==='function'?faoToolDims(t):null;}catch(e){}
  const D=Math.max(0.2,(g&&g.D)||(+t.d>0?+t.d:10)),lc=Math.max(0.5,(g&&g.lc&&g.lc.v)||D*2.5);
  const dq=Math.max(0.2,(g&&g.dq&&g.dq.v)||D),ls=Math.max(lc+1,(g&&g.lsm&&g.lsm.v)||lc+D*1.5);
  const ball=t.kind==='ball'||(+t.cornerR>0&&+t.cornerR>=D/2-1e-6);
  const key=[t.id,D,lc,dq,ls,ball?1:0].join('|');
  if(lens.tool&&lens.tool.key===key)return lens.tool;
  lensToolClear();
  if(!lens.toolScene){
    lens.toolScene=new THREE.Scene();lens.toolScene.name='lensTool';
    lens.toolScene.add(new THREE.HemisphereLight(0xffffff,0x3a3f48,2.2));
    const dl=new THREE.DirectionalLight(0xffffff,1.6);dl.position.set(1,-1.5,3);lens.toolScene.add(dl);
  }
  const G=new THREE.Group();G.matrixAutoUpdate=false;
  // peu métallique : sans carte d'environnement dans cette petite scène, un vrai métal paraîtrait noir
  const cut=new THREE.MeshStandardMaterial({color:0xb9c2cf,metalness:0.2,roughness:0.38});
  const sh=new THREE.MeshStandardMaterial({color:0xe3e8ee,metalness:0.15,roughness:0.32});
  const cyl=(r,z0,z1,mat)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,z1-z0,32),mat);
    m.geometry.rotateX(Math.PI/2);m.position.z=(z0+z1)/2;m.updateMatrix();G.add(m);return m;};
  if(ball){cyl(D/2,D/2,lc,cut);const s=new THREE.Mesh(new THREE.SphereGeometry(D/2,32,16),cut);s.position.z=D/2;s.updateMatrix();G.add(s);}
  else cyl(D/2,0,lc,cut);
  cyl(dq/2,lc,ls,sh);
  G.traverse(o=>{o.frustumCulled=false;o.raycast=()=>{};});
  lens.toolScene.add(G);
  lens.tool={key,g:G};
  return lens.tool;
}
function lensToolClear(){
  if(!lens.tool)return;
  try{lens.tool.g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
    if(lens.tool.g.parent)lens.tool.g.parent.remove(lens.tool.g);}catch(e){}
  lens.tool=null;
}
/* Place la fraise de F sur sa passe ; false = rien à montrer */
function lensToolPlace(F){
  const R=lensFaoRoot();
  if(!F||!F.op||!F.pt||!F.tool||!R)return false;
  const T=lensToolFor(F.tool);
  let ax=null;try{const fr=typeof faoOpFrame==='function'?faoOpFrame(F.job,F.op):null;ax=fr&&fr.rel&&fr.rel.Z;}catch(e){}
  _lensA.set(ax?+ax[0]:0,ax?+ax[1]:0,ax?+ax[2]:1);if(!(_lensA.lengthSq()>1e-12))_lensA.set(0,0,1);_lensA.normalize();
  _lensQ.setFromUnitVectors(_lensZ,_lensA);
  _lensP.set(F.pt[0],F.pt[1],F.pt[2]);
  R.updateWorldMatrix(true,false);
  T.g.matrix.multiplyMatrices(R.matrixWorld,_lensM2.compose(_lensP,_lensQ,_lensS));
  T.g.matrixWorldNeedsUpdate=true;
  return true;
}

/* ── FAO posée sur Coupe : la zone commune aux deux loupes montre la pièce coupée ET la FAO ──
   Milieu de la zone commune (sur la ligne des centres) : la fraise s'y pose, sur la passe la plus
   proche, de préférence derrière le plan de coupe (là où la matière est restée : l'outil « dans
   la matière ») ; sinon la plus proche tout court. */
function lensOverlap(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r;}
function lensOverlapMid(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d<1e-9)return {x:a.x,y:a.y};
  const lo=Math.max(d-b.r,-a.r),hi=Math.min(a.r,d+b.r),m=(lo+hi)/2;
  return {x:a.x+dx/d*m,y:a.y+dy/d*m};
}
function lensFaoPick(lf,lc,plane){
  const res={ok:false,op:null,tool:null,pt:null,job:null};
  const R=lensFaoRoot(),ops=lensFaoOps();
  if(!R||!ops||!lensOverlap(lf,lc))return res;
  res.ok=true;res.job=lensFaoJob();
  const {w,h}=lensSize();if(!w||!h)return res;
  const T=lensOverlapMid(lf,lc),fx=lf.x-T.x,fy=lf.y-T.y,cx=lc.x-T.x,cy=lc.y-T.y,rf2=lf.r*lf.r,rc2=lc.r*lc.r;
  R.updateWorldMatrix(true,false);camera.updateMatrixWorld();
  const Mw=R.matrixWorld,e=_lensM.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(Mw).elements;
  const pj=(p,o)=>{const Wh=e[3]*p.x+e[7]*p.y+e[11]*p.z+e[15];o[2]=Wh;if(!(Wh>1e-9))return o;
    o[0]=((e[0]*p.x+e[4]*p.y+e[8]*p.z+e[12])/Wh+1)/2*w-T.x;o[1]=(1-(e[1]*p.x+e[5]*p.y+e[9]*p.z+e[13])/Wh)/2*h-T.y;return o;};
  const s2t=(s,Wa,Wb)=>s<=0?0:s>=1?1:s*Wa/((1-s)*Wb+s*Wa);
  let PA=[0,0,0],PB=[0,0,0],bk=2,bd=Infinity;
  ops.forEach((E,op)=>{
    if(!op||op.hidden===true||!E||!E.src)return;
    let tool=null;try{const sf=faoOpCutting(op,res.job);tool=(sf&&sf.tool)||null;}catch(err){}
    for(const s of E.src){
      const mv=s&&s.b&&s.b.moves;if(!mv||mv.length<2)continue;
      pj(mv[0],PA);
      for(let i=1;i<mv.length;i++){
        const a=mv[i-1],m=mv[i];pj(m,PB);
        if(!m.r&&PA[2]>1e-9&&PB[2]>1e-9){
          const dx=PB[0]-PA[0],dy=PB[1]-PA[1],qa=dx*dx+dy*dy;
          const sc=qa<1e-12?0:Math.max(0,Math.min(1,-(PA[0]*dx+PA[1]*dy)/qa)),ex=PA[0]+sc*dx,ey=PA[1]+sc*dy;
          if((ex-fx)*(ex-fx)+(ey-fy)*(ey-fy)<=rf2&&(ex-cx)*(ex-cx)+(ey-cy)*(ey-cy)<=rc2){
            const d=ex*ex+ey*ey,u=s2t(sc,PA[2],PB[2]);
            _lensP.set(a.x+(m.x-a.x)*u,a.y+(m.y-a.y)*u,a.z+(m.z-a.z)*u);
            const k=plane.distanceToPoint(_lensC.copy(_lensP).applyMatrix4(Mw))>=0?0:1; // 0 : derrière le plan (gardé)
            if(k<bk||(k===bk&&d<bd)){bk=k;bd=d;res.op=op;res.tool=tool;res.pt=[_lensP.x,_lensP.y,_lensP.z];}
          }
        }
        const t=PA;PA=PB;PB=t;
      }
    }
  });
  return res;
}
function lensComboTick(lf,lc,plane,now){
  lf.combo=lf.combo||{};
  const sig=lf.faoSig+'|'+lc.x.toFixed(1)+','+lc.y.toFixed(1)+','+lc.r.toFixed(1)+'|'+plane.normal.x.toFixed(5)+','+plane.normal.y.toFixed(5)+','+plane.normal.z.toFixed(5)+','+plane.constant.toFixed(4);
  let C=lf.combo[lc.id];
  if(!C)C=lf.combo[lc.id]={sig:'',T:0,dirty:true,pick:null};
  if(sig!==C.sig){C.sig=sig;C.dirty=true;}
  if(C.dirty&&(!C.pick||now-C.T>=LENS_FAO_MS)){C.pick=lensFaoPick(lf,lc,plane);C.T=now;C.dirty=false;}
  else if(C.dirty)lensWake();
  return C.pick;
}
/* Dessine S avec seulement la racine FAO (et les lumières) : passes et brut par-dessus ce qui est déjà
   dans la cible, testés en profondeur contre la pièce coupée. Rien n'est laissé caché. */
function lensDrawFaoOnly(gl,S,R){
  const hid=[],bg=S.background,rv=R.visible;
  try{
    S.background=null;
    for(const c of S.children)if(c!==R&&!c.isLight&&c.visible){c.visible=false;hid.push(c);}
    R.visible=true;
    gl.render(S,camera);
  }finally{for(const c of hid)c.visible=true;S.background=bg;R.visible=rv;}
}

/* ── lentille PLAN : sous la loupe, la pièce dessinée au trait sur papier, et ses cotes ──
   Scène à part (lens.plan.scene) qui reprend la géométrie des corps sans toucher leurs matériaux :
   papier (faces), contour des formes (coque arrière gonflée de 1,6 px : silhouettes des cylindres,
   des congés), arêtes vives à l'encre, tangentes en gris, arêtes cachées en pointillés clairs.
   Arêtes : celles de l'affichage (edgeOverlayData : vraies arêtes du noyau), sinon celles du
   maillage. Cotes (calque SVG dans le cercle) : Ø / R des cercles dont le centre est sous la loupe,
   longueurs des arêtes droites entières sous la loupe, vues (pas cachées), sans doublon (même
   valeur, même direction) ; 6 au plus. Recomptées quand la vue est calme depuis 150 ms. */
const LENS_PLAN_MS=150,LENS_DIM_MAX=6;
const LENS_PAPER=0xf4f6f9,LENS_INK=0x1a2230,LENS_TAN=0x8a94a3,LENS_HID=0xa9b2bf;
function lensNum(v){const r=Math.round(v*100)/100;return String(Math.abs(r)<1e-9?0:r).replace('.',',');}
function lensPlanRaw(RS){
  try{
    if(typeof scene!=='undefined'&&RS===scene){
      if(typeof edgeMode!=='undefined'&&edgeMode==='on'&&typeof edgeOverlayData==='function')return edgeOverlayData();
      if(typeof edgeOverlayFromMesh==='function'){const out=[];
        for(const b of bodies||[])if(b&&b.mesh&&!b.ghost&&b.visible!==false&&(typeof bodyShown!=='function'||bodyShown(b)))out.push.apply(out,edgeOverlayFromMesh(b));
        return out;}
    }
  }catch(e){}
  // assemblage ou repli : arêtes du maillage (> 30°)
  const out=[],A=new THREE.Vector3(),B=new THREE.Vector3();
  for(const m of lensMeshes(RS)){
    let eg=null;try{eg=new THREE.EdgesGeometry(m.geometry,30);m.updateWorldMatrix(true,false);
      const p=eg.attributes.position;
      for(let i=0;i+1<p.count;i+=2){A.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);B.fromBufferAttribute(p,i+1).applyMatrix4(m.matrixWorld);
        out.push({pts:[[A.x,A.y,A.z],[B.x,B.y,B.z]],sharp:true});}
    }catch(e){}finally{try{if(eg)eg.dispose();}catch(e){}}
  }
  return out;
}
/* droite, cercle (ou arc), sinon rien — même lecture que les références de construction (cgEdgeGeom) */
function lensEdgeKind(P){
  try{if(typeof cgEdgeGeom==='function')return cgEdgeGeom(P);}catch(e){}
  if(!P||P.length<2)return null;
  const a=P[0],b=P[P.length-1],L=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);if(!(L>1e-9))return null;
  for(const q of P){const ux=q[0]-a[0],uy=q[1]-a[1],uz=q[2]-a[2],dx=(b[0]-a[0])/L,dy=(b[1]-a[1])/L,dz=(b[2]-a[2])/L;
    const cx=uy*dz-uz*dy,cy=uz*dx-ux*dz,cz=ux*dy-uy*dx;if(Math.hypot(cx,cy,cz)>Math.max(1e-4,0.002*L))return null;}
  return {line:{a,b}};
}
function lensPlanEdges(RS,meshes){
  const P=lens.plan;
  let key=(typeof edgeMode!=='undefined'?edgeMode:'')+'|';
  for(const m of meshes){key+=m.geometry.uuid+':';const e=m.matrixWorld.elements;key+=(e[12]+e[13]*3+e[14]*7+e[0]+e[5]*3+e[10]*7).toFixed(4)+',';}
  if(P.edgeKey===key)return false;
  P.edgeKey=key;P.ver=(P.ver||0)+1;
  const raw=lensPlanRaw(RS)||[],E=[],sh=[],tg=[];
  for(const d of raw){
    const M=d&&d.mw&&d.mw.elements;let pts=d&&d.pts;if(!pts||pts.length<2)continue;
    if(M)pts=pts.map(p=>{const x=+p[0],y=+p[1],z=+p[2];return [M[0]*x+M[4]*y+M[8]*z+M[12],M[1]*x+M[5]*y+M[9]*z+M[13],M[2]*x+M[6]*y+M[10]*z+M[14]];});
    const arr=d.sharp?sh:tg;
    for(let i=0;i+1<pts.length;i++)arr.push(pts[i][0],pts[i][1],pts[i][2],pts[i+1][0],pts[i+1][1],pts[i+1][2]);
    if(!d.sharp)continue;
    const G=lensEdgeKind(pts);if(!G)continue;
    const f=pts[0],l=pts[pts.length-1];
    if(G.line)E.push({k:'L',a:G.line.a,b:G.line.b,v:Math.hypot(G.line.b[0]-G.line.a[0],G.line.b[1]-G.line.a[1],G.line.b[2]-G.line.a[2])});
    else if(G.circ){const full=Math.hypot(l[0]-f[0],l[1]-f[1],l[2]-f[2])<Math.max(1e-6,G.circ.r*1e-3);
      E.push({k:full?'D':'R',c:G.circ.c,n:G.circ.n,r:G.circ.r,v:full?2*G.circ.r:G.circ.r,pts});}
  }
  P.edges=E;
  const setG=(o,arr)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
    if(o.geometry)o.geometry.dispose();o.geometry=g;o.visible=arr.length>0;return g;};
  setG(P.vis,sh);setG(P.tan,tg);setG(P.hid,sh);
  if(sh.length)P.hid.computeLineDistances();
  const box=lensBounds(RS),sz=box?box.getSize(_lensC).length():100;
  P.hid.material.dashSize=Math.max(sz/90,0.05);P.hid.material.gapSize=P.hid.material.dashSize*0.7;
  return true;
}
function lensPlanInit(){
  if(lens.plan)return lens.plan;
  const S=new THREE.Scene();S.name='lensPlan';
  const line=(mat,ro)=>{const o=new THREE.LineSegments(new THREE.BufferGeometry(),mat);o.renderOrder=ro;o.frustumCulled=false;o.raycast=()=>{};S.add(o);return o;};
  const P={scene:S,items:[],edgeKey:null,edges:[],
    paper:new THREE.MeshBasicMaterial({color:LENS_PAPER,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}),
    hull:new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:{uPx:{value:1.6},uRes:{value:new THREE.Vector2(1,1)},uInk:{value:new THREE.Color(LENS_INK)}},
      vertexShader:'uniform float uPx; uniform vec2 uRes;\nvoid main(){ vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n'
        +'  vec2 d = (projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0)).xy; float L = length(d);\n'
        +'  if(L > 1e-6) c.xy += d / L * uPx * 2.0 / uRes * c.w; gl_Position = c; }',
      fragmentShader:'uniform vec3 uInk;\nvoid main(){ gl_FragColor = vec4(uInk, 1.0); }'}),
    hid:null,vis:null,tan:null,dims:null,sig:'',T:0,dirty:true,quiet:0};
  P.hid=line(new THREE.LineDashedMaterial({color:LENS_HID,dashSize:1,gapSize:0.7,depthFunc:THREE.GreaterDepth,depthWrite:false}),3);
  P.tan=line(new THREE.LineBasicMaterial({color:LENS_TAN}),4);
  P.vis=line(new THREE.LineBasicMaterial({color:LENS_INK}),5);
  lens.plan=P;
  return P;
}
function lensPlanSync(meshes,W,H){
  const P=lensPlanInit();
  if(meshes.length!==P.items.length||meshes.some((m,i)=>P.items[i].mesh!==m||P.items[i].geo!==m.geometry)){
    for(const it of P.items){S_rm(it.fill);S_rm(it.hull);}
    P.items=meshes.map(m=>{
      const fill=new THREE.Mesh(m.geometry,P.paper);fill.matrixAutoUpdate=false;fill.renderOrder=1;fill.frustumCulled=false;fill.raycast=()=>{};P.scene.add(fill);
      let hull=null;
      if(m.geometry.attributes.normal){hull=new THREE.Mesh(m.geometry,P.hull);hull.matrixAutoUpdate=false;hull.renderOrder=0;hull.frustumCulled=false;hull.raycast=()=>{};P.scene.add(hull);}
      return {mesh:m,geo:m.geometry,fill,hull};
    });
  }
  function S_rm(o){if(o&&o.parent)o.parent.remove(o);}
  for(const it of P.items){
    it.mesh.updateWorldMatrix(true,false);
    it.fill.matrix.copy(it.mesh.matrixWorld);it.fill.matrixWorldNeedsUpdate=true;
    if(it.hull){it.hull.matrix.copy(it.mesh.matrixWorld);it.hull.matrixWorldNeedsUpdate=true;}
  }
  P.hull.uniforms.uRes.value.set(W,H);
  return P;
}
function lensPlanClear(){
  const P=lens.plan;if(!P)return;
  try{for(const o of [P.hid,P.vis,P.tan])if(o.geometry)o.geometry.dispose();
    P.paper.dispose();P.hull.dispose();P.hid.material.dispose();P.vis.material.dispose();P.tan.material.dispose();}catch(e){}
  lens.plan=null;
}
/* Cotes de la zone : liste de {t:'D'|'R'|'L', v, …points écran} ; visibles seulement (lancer de rayon) */
function lensPlanScan(l,RS){
  const P=lens.plan,res=[];if(!P||!P.edges.length)return res;
  const {w,h}=lensSize();if(!w||!h)return res;
  camera.updateMatrixWorld();
  const pj=p=>{_lensP.set(p[0],p[1],p[2]);const W=_lensP.clone().applyMatrix4(camera.matrixWorldInverse).z;
    _lensP.project(camera);return {x:(_lensP.x+1)/2*w,y:(1-_lensP.y)/2*h,ok:W<0};};
  const R=l.r,inC=(q,m)=>q.ok&&Math.hypot(q.x-l.x,q.y-l.y)<=R-m;
  const cand=[];
  for(const e of P.edges){
    if(e.k==='L'){
      const A=pj(e.a),B=pj(e.b);if(!inC(A,8)||!inC(B,8))continue;
      const s=Math.hypot(B.x-A.x,B.y-A.y);if(s<28||e.v<1e-3)continue;
      cand.push({e,t:'L',v:e.v,A,B,s,o:-s,mid:[(e.a[0]+e.b[0])/2,(e.a[1]+e.b[1])/2,(e.a[2]+e.b[2])/2]});
    }else{
      const C=pj(e.c);if(!inC(C,4))continue;
      const pts=[];const B=new THREE.Vector3(),n=new THREE.Vector3(e.n[0],e.n[1],e.n[2]).normalize(),u=new THREE.Vector3(),v=new THREE.Vector3();
      u.set(Math.abs(n.x)<0.9?1:0,Math.abs(n.x)<0.9?0:1,0).cross(n).normalize();v.crossVectors(n,u);
      let sr=0;
      if(e.k==='D'){for(let i=0;i<32;i++){const a=i/32*Math.PI*2;B.set(e.c[0],e.c[1],e.c[2]).addScaledVector(u,Math.cos(a)*e.r).addScaledVector(v,Math.sin(a)*e.r);
          const q=pj([B.x,B.y,B.z]);pts.push(q);sr=Math.max(sr,Math.hypot(q.x-C.x,q.y-C.y));}}
      else for(let i=0;i<e.pts.length;i+=Math.max(1,Math.floor(e.pts.length/24))){const q=pj(e.pts[i]);pts.push(q);sr=Math.max(sr,Math.hypot(q.x-C.x,q.y-C.y));}
      if(sr<5||sr>R*1.6)continue;
      const mp=e.k==='D'?[e.c[0]+u.x*e.r,e.c[1]+u.y*e.r,e.c[2]+u.z*e.r]:e.pts[Math.floor(e.pts.length/2)];
      cand.push({e,t:e.k,v:e.v,C,pts,s:sr,o:Math.hypot(C.x-l.x,C.y-l.y)-1e4,mid:mp});
    }
  }
  // direction de chaque cote : arête (droite) ou axe (cercle)
  for(const c of cand){const d=c.t==='L'?[c.e.b[0]-c.e.a[0],c.e.b[1]-c.e.a[1],c.e.b[2]-c.e.a[2]]:c.e.n,dl=Math.hypot(d[0],d[1],d[2])||1;c.dn=[d[0]/dl,d[1]/dl,d[2]/dl];}
  const par=(a,b)=>Math.abs(Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])-1)<1e-4;
  const sameAxis=(a,b)=>{const q=[b.e.c[0]-a.e.c[0],b.e.c[1]-a.e.c[1],b.e.c[2]-a.e.c[2]],ql=Math.hypot(q[0],q[1],q[2]);
    return ql<1e-6||Math.abs(Math.abs((q[0]*a.dn[0]+q[1]*a.dn[1]+q[2]*a.dn[2])/ql)-1)<1e-3;};
  // trous et rayons égaux sous la loupe : une seule cote, « 4× R10 » (axes distincts comptés une fois)
  for(const c of cand){if(c.t==='L')continue;const axes=[];
    for(const o of cand)if(o.t===c.t&&Math.abs(o.v-c.v)<1e-3&&par(o.dn,c.dn)&&!axes.some(a=>sameAxis(a,o)))axes.push(o);
    c.n=axes.length;}
  // tour à tour : un trou (Ø), une longueur, un rayon… chacun trié (près du centre / plus longue)
  const Q={D:[],L:[],R:[]};for(const c of cand)Q[c.t].push(c);
  for(const k in Q)Q[k].sort((a,b)=>a.o-b.o);
  const meshes=lensMeshes(RS),rc=new THREE.Raycaster(),cp=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const seen=[],boxes=[],mid=lensPartMid();let tests=0;
  const take=c=>{
    // sans doublon : même valeur, même direction (côtés opposés ; trous ou rayons égaux, déjà comptés)
    if(seen.some(s=>s.t===c.t&&Math.abs(s.v-c.v)<1e-3&&par(s.dn,c.dn)))return false;
    // place du texte : dans le cercle, sans toucher les cotes déjà posées
    const lay=lensDimLayout(c,l,boxes,mid);if(!lay)return false;
    // vue : rien de la pièce entre l'œil et l'arête
    tests++;
    _lensA.set(c.mid[0],c.mid[1],c.mid[2]);const dist=_lensA.distanceTo(cp);
    if(meshes.length&&dist>1e-6){
      rc.set(cp,_lensA.clone().sub(cp).normalize());rc.far=dist-Math.max(0.05,dist*2e-3);
      let hid=false;try{hid=rc.intersectObjects(meshes,false).length>0;}catch(err){}
      if(hid)return false;
    }
    seen.push(c);
    c.lay=lay;boxes.push(lay.box);res.push(c);return true;
  };
  const order=['D','L','R'],pos={D:0,L:0,R:0};
  for(let guard=0;res.length<LENS_DIM_MAX&&tests<4*LENS_DIM_MAX&&guard<500;guard++){
    let any=false;
    for(const k of order){
      if(res.length>=LENS_DIM_MAX)break;
      while(pos[k]<Q[k].length){const c=Q[k][pos[k]++];any=true;if(take(c))break;}
    }
    if(!any)break;
  }
  return res;
}
/* milieu de la pièce à l'écran : les cotes des arêtes se posent du côté extérieur */
function lensPartMid(){
  const box=lensBounds(lens.lastRS);if(!box)return null;
  box.getCenter(_lensC).project(camera);const {w,h}=lensSize();
  return {x:(_lensC.x+1)/2*w,y:(1-_lensC.y)/2*h};
}
function lensDimText(c){return c.t==='L'?lensNum(c.v):(c.n>1?c.n+'× ':'')+(c.t==='D'?'Ø':'R')+lensNum(c.v);}
/* Où poser la cote : texte dans le cercle (marge 6 px), sans toucher les textes déjà posés.
   Arête : d'un côté ou de l'autre (extérieur d'abord). Cercle : ligne de rappel vers un des 4 coins. */
function lensDimLayout(c,l,boxes,mid){
  const t=lensDimText(c),tw=7*t.length+6,th=15;
  const okBox=b=>{
    for(const [x,y] of [[b.x0,b.y0],[b.x1,b.y0],[b.x0,b.y1],[b.x1,b.y1]])if(Math.hypot(x-l.x,y-l.y)>l.r-6)return false;
    return !boxes.some(o=>b.x0<o.x1+3&&b.x1>o.x0-3&&b.y0<o.y1+3&&b.y1>o.y0-3);};
  if(c.t==='L'){
    const dx=c.B.x-c.A.x,dy=c.B.y-c.A.y,L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
    const mx=(c.A.x+c.B.x)/2,my=(c.A.y+c.B.y)/2;
    let n0=[-uy,ux];if(mid&&(mx-mid.x)*n0[0]+(my-mid.y)*n0[1]<0)n0=[uy,-ux];
    let ang=Math.atan2(uy,ux)*180/Math.PI;if(ang>90)ang-=180;if(ang<=-90)ang+=180;
    const ca=Math.abs(Math.cos(ang*Math.PI/180)),sa=Math.abs(Math.sin(ang*Math.PI/180)),bw=tw*ca+th*sa,bh=tw*sa+th*ca;
    for(const [nx,ny] of [n0,[-n0[0],-n0[1]]]){
      const o=16,T={x:mx+nx*(o+9),y:my+ny*(o+9)};
      const box={x0:T.x-bw/2,x1:T.x+bw/2,y0:T.y-bh/2,y1:T.y+bh/2};
      if(okBox(box))return {t,nx,ny,o,T,ang,box,ux,uy};
    }
    return null;
  }
  for(const [ex,ey] of [[1,-1],[-1,-1],[1,1],[-1,1]]){
    let P0=c.pts[0];for(const q of c.pts)if(q.x*ex+q.y*ey>P0.x*ex+P0.y*ey)P0=q;
    let dx=P0.x-c.C.x,dy=P0.y-c.C.y;const L=Math.hypot(dx,dy)||1;dx/=L;dy/=L;
    const Q={x:P0.x+dx*20,y:P0.y+dy*20},right=ex>0,R2={x:Q.x+(right?10:-10),y:Q.y};
    const x0=right?R2.x+3:R2.x-3-tw,box={x0,x1:x0+tw,y0:R2.y-th/2,y1:R2.y+th/2};
    if(okBox(box))return {t,P0,Q,R2,right,dx,dy,box};
  }
  return null;
}
function lensPlanTick(l,RS,now){
  const P=lens.plan;if(!P)return null;
  let sig=l.x.toFixed(1)+','+l.y.toFixed(1)+','+l.r.toFixed(1)+'|'+P.ver;
  camera.updateMatrixWorld();{const a=camera.matrixWorld.elements,p=camera.projectionMatrix.elements;for(let i=0;i<16;i++)sig+=','+a[i].toFixed(4)+','+p[i].toFixed(5);}
  if(sig!==l.planSig){l.planSig=sig;l.planDirty=true;l.planQuiet=now;if(l.dims){l.dims=null;lensDimsShow(l,null);}} // la vue bouge : cotes rangées
  if(l.planDirty&&now-l.planQuiet>=LENS_PLAN_MS){l.dims=lensPlanScan(l,RS);l.planDirty=false;lensDimsShow(l,l.dims);}
  else if(l.planDirty)lensWake();
  return l.dims;
}
/* calque SVG des cotes, dans le cercle (coordonnées locales du cadre de la loupe) */
function lensDimsShow(l,D){
  const ui=l.ui;if(!ui||!ui.dims)return;
  const g=ui.dims;
  if(!D||!D.length){g.innerHTML='';return;}
  const ox=l.x-l.r,oy=l.y-l.r,f=v=>v.toFixed(1),esc=t=>String(t).replace(/[<&]/g,ch=>ch==='<'?'&lt;':'&amp;');
  let s='';
  const txt=(x,y,ang,anchor,t)=>'<text x="'+f(x-ox)+'" y="'+f(y-oy)+'" text-anchor="'+anchor+'" dominant-baseline="central"'
    +(ang?' transform="rotate('+ang.toFixed(1)+' '+f(x-ox)+' '+f(y-oy)+')"':'')+'>'+esc(t)+'</text>';
  const ln=(a,b,cls)=>'<line'+(cls?' class="'+cls+'"':'')+' x1="'+f(a.x-ox)+'" y1="'+f(a.y-oy)+'" x2="'+f(b.x-ox)+'" y2="'+f(b.y-oy)+'"/>';
  const arrow=(p,dx,dy)=>{const L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,a=7,b=2.6;
    return '<path d="M'+f(p.x-ox)+' '+f(p.y-oy)+'L'+f(p.x-ox-ux*a-uy*b)+' '+f(p.y-oy-uy*a+ux*b)+'L'+f(p.x-ox-ux*a+uy*b)+' '+f(p.y-oy-uy*a-ux*b)+'Z"/>';};
  for(const c of D){
    const y=c.lay;if(!y)continue;
    if(c.t==='L'){
      const {nx,ny,o,ux,uy}=y,A2={x:c.A.x+nx*o,y:c.A.y+ny*o},B2={x:c.B.x+nx*o,y:c.B.y+ny*o};
      s+=ln({x:c.A.x+nx*3,y:c.A.y+ny*3},{x:c.A.x+nx*(o+4),y:c.A.y+ny*(o+4)},'x')+ln({x:c.B.x+nx*3,y:c.B.y+ny*3},{x:c.B.x+nx*(o+4),y:c.B.y+ny*(o+4)},'x');
      s+=ln(A2,B2)+arrow(A2,-ux,-uy)+arrow(B2,ux,uy);
      s+=txt(y.T.x,y.T.y,y.ang,'middle',y.t);
    }else{
      s+=ln(y.Q,y.P0)+ln(y.Q,y.R2)+arrow(y.P0,-y.dx,-y.dy);
      s+=txt(y.R2.x+(y.right?3:-3),y.R2.y,0,y.right?'start':'end',y.t);
    }
  }
  g.innerHTML=s;
}
function lensPlanText(l){
  const P=lens.plan;
  if(!P||!P.edges.length)return 'aucune arête';
  if(l.planDirty)return '…';
  const n=(l.dims||[]).length;
  return n?n+' cote'+(n>1?'s':''):'rien à coter ici';
}

/* ── lentille RENDU : sous la loupe, la matière réelle ──
   Scène à part (lens.rendu.scene) qui reprend la géométrie des corps : chaque corps y reçoit une matière
   physique tirée de son APPARENCE DE RENDU (vEnvLookOf / renderLookOf, 12-materiaux : matériau, couleur,
   relief), éclairée par l'ambiance de la fenêtre RENDU (rdEnvTex : reflets filtrés, comme le Rendu direct),
   sur le fond de cette ambiance. Les matières de la vue ne sont pas touchées. Recopie : tons ACES et sortie
   sRGB pour la pièce, fond tel quel (alpha 0 dans la cible). Étiquette : la matière sous le centre. */
const LENS_RENDU_MS=150;
function lensLookOf(m){
  try{if(typeof vEnvLookOf==='function')return vEnvLookOf(m);}catch(e){}
  const mt=Array.isArray(m.material)?m.material[0]:m.material;
  return {mat:null,color:mt&&mt.color?mt.color.getHex():0x9a9aa0,rel:null};
}
function lensMatDef(k){try{return typeof matDef==='function'?matDef(k):null;}catch(e){return null;}}
function lensRenduCfg(){ // réglages de la fenêtre RENDU (ambiance, rotation, reflets, fond), comme le Rendu direct
  try{if(typeof vEnvCfg==='function'&&typeof vEnv!=='undefined'){const p=vEnv;vEnv='rendu';try{return vEnvCfg();}finally{vEnv=p;}}}catch(e){}
  return {amb:'studio',rot:0,int:1,fond:['#d3d6db','#9a9fa7'],sig:'studio'};
}
function lensLin(hex){return new THREE.Color(hex).convertSRGBToLinear();} // comme l'atelier (rdLin)
function lensRenduMat(L,C,vc){
  const d=lensMatDef(L.mat);
  const m=new THREE.MeshPhysicalMaterial({color:lensLin(vc&&!L.mat?0xffffff:(L.color!=null?L.color:0x9a9aa0)),
    metalness:d?d.metal:0.15,roughness:d?d.rough:0.42,clearcoat:d&&d.cc?d.cc:(d?0:0.25),clearcoatRoughness:d&&d.ccr!=null?d.ccr:0.25,
    envMapIntensity:C.int!=null?+C.int:1,vertexColors:!!vc});
  if(d&&d.trans){m.transmission=d.trans;m.ior=d.ior||1.5;m.thickness=4;m.attenuationColor=lensLin(L.color);m.attenuationDistance=d.trans<1?8:60;m.color.setRGB(1,1,1);}
  if(d&&d.sheen){m.sheen=d.sheen;m.sheenRoughness=0.8;m.sheenColor=new THREE.Color(0.35,0.35,0.35);}
  // relief du corps, sinon celui du matériau ; couches et patine (98-rendu-reliefs / 98-rendu-surface)
  try{if(typeof relApply==='function'&&typeof relOf==='function'&&typeof surfOpts==='function')return relApply(m,relOf({rel:L.rel},d),surfOpts({rel:L.rel},d));}catch(e){}
  return m;
}
function lensRenduInit(){
  if(lens.rendu)return lens.rendu;
  const S=new THREE.Scene();S.name='lensRendu';
  // fond de l'ambiance : dégradé vertical, écrit avec alpha 0 (la recopie ne lui applique pas les tons)
  const bg=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
    uniforms:{uTop:{value:new THREE.Color()},uBot:{value:new THREE.Color()},uRes:{value:new THREE.Vector2(1,1)}},
    vertexShader:'void main(){ gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader:'uniform vec3 uTop; uniform vec3 uBot; uniform vec2 uRes;\nvoid main(){ gl_FragColor = vec4(mix(uBot, uTop, clamp(gl_FragCoord.y / uRes.y, 0.0, 1.0)), 0.0); }',
    depthTest:false,depthWrite:false}));
  bg.frustumCulled=false;bg.renderOrder=-1e6;bg.raycast=()=>{};S.add(bg);
  // les lampes de la vue (ciel + lampe principale), recopiées à chaque image : mêmes reflets que le Rendu direct
  const hemi=new THREE.HemisphereLight(0xffffff,0x444444,0.75*Math.PI),key=new THREE.DirectionalLight(0xffffff,Math.PI);
  key.position.set(60,-40,120);S.add(hemi);S.add(key);S.add(key.target);
  lens.rendu={scene:S,bg,hemi,key,items:[],envSig:null,env:null,pmrem:null,fondSig:null};
  return lens.rendu;
}
function lensRenduSync(meshes,W,H){
  const Rd=lensRenduInit(),C=lensRenduCfg();
  // ambiance (reflets) : refaite seulement quand elle change
  if(Rd.envSig!==C.sig){
    Rd.envSig=C.sig;
    let env=null;
    try{if(typeof rdEnvTex==='function'){if(!Rd.pmrem)Rd.pmrem=new THREE.PMREMGenerator(renderer);env=rdEnvTex(Rd.pmrem,C.amb,C.rot).rt;}}catch(e){env=null;}
    if(Rd.env)try{Rd.env.dispose();}catch(e){}
    Rd.env=env;Rd.scene.environment=env?env.texture:null;
  }
  try{if(typeof viewLightQ!=='undefined'&&Rd.scene.environmentRotation)Rd.scene.environmentRotation.setFromQuaternion(viewLightQ);}catch(e){}
  try{
    if(typeof viewHemi!=='undefined'&&viewHemi){Rd.hemi.color.copy(viewHemi.color);Rd.hemi.groundColor.copy(viewHemi.groundColor);
      Rd.hemi.intensity=viewHemi.intensity;Rd.hemi.position.copy(viewHemi.position);Rd.hemi.visible=viewHemi.visible!==false;}
    if(typeof viewKey!=='undefined'&&viewKey){Rd.key.color.copy(viewKey.color);Rd.key.intensity=viewKey.intensity;
      Rd.key.position.copy(viewKey.position);if(viewKey.target)Rd.key.target.position.copy(viewKey.target.position);Rd.key.visible=viewKey.visible!==false;}
  }catch(e){}
  const f=C.fond||['#d3d6db','#9a9fa7'],fk=f[0]+f[1];
  if(Rd.fondSig!==fk){Rd.fondSig=fk;Rd.bg.material.uniforms.uTop.value.set(f[0]);Rd.bg.material.uniforms.uBot.value.set(f[1]);}
  Rd.bg.material.uniforms.uRes.value.set(W,H);
  if(meshes.length!==Rd.items.length||meshes.some((m,i)=>Rd.items[i].mesh!==m||Rd.items[i].geo!==m.geometry)){
    lensRenduItemsClear(Rd);
    Rd.items=meshes.map(m=>{const o=new THREE.Mesh(m.geometry);o.matrixAutoUpdate=false;o.frustumCulled=false;o.raycast=()=>{};Rd.scene.add(o);
      return {mesh:m,geo:m.geometry,o,key:null};});
  }
  for(const it of Rd.items){
    const L=lensLookOf(it.mesh),mt=Array.isArray(it.mesh.material)?it.mesh.material[0]:it.mesh.material,vc=!!(mt&&mt.vertexColors);
    const key=[L.mat||'',L.color,L.rel?JSON.stringify(L.rel):'',vc?1:0,C.int].join('|');
    if(it.key!==key){
      const old=it.o.material;it.o.material=lensRenduMat(L,C,vc);it.key=key;it.look=L;
      try{if(old&&old!==it.o.material&&old.dispose)old.dispose();}catch(e){}
    }
    it.mesh.updateWorldMatrix(true,false);it.o.matrix.copy(it.mesh.matrixWorld);it.o.matrixWorldNeedsUpdate=true;
  }
  return Rd;
}
function lensRenduItemsClear(Rd){
  for(const it of Rd.items){try{if(it.o.parent)it.o.parent.remove(it.o);if(it.o.material&&it.o.material.dispose)it.o.material.dispose();}catch(e){}}
  Rd.items=[];
}
function lensRenduClear(){
  const Rd=lens.rendu;if(!Rd)return;
  lensRenduItemsClear(Rd);
  try{if(Rd.env)Rd.env.dispose();if(Rd.pmrem)Rd.pmrem.dispose();Rd.bg.geometry.dispose();Rd.bg.material.dispose();}catch(e){}
  lens.rendu=null;
}
/* nom de la matière sous le centre de la loupe (« Aluminium usiné · brossé ») */
function lensRenduName(l,RS){
  const Rd=lens.rendu;if(!Rd||!Rd.items.length)return '';
  const {w,h}=lensSize();if(!w||!h)return '';
  const rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2(l.x/w*2-1,1-l.y/h*2),camera);
  let hit=null;try{hit=rc.intersectObjects(Rd.items.map(it=>it.mesh),false)[0]||null;}catch(e){}
  if(!hit)return 'rien ici';
  const it=Rd.items.find(x=>x.mesh===hit.object);const L=(it&&it.look)||lensLookOf(hit.object);
  const d=lensMatDef(L.mat);let t=d?d.nom:'sans matériau';
  try{if(L.rel&&L.rel.t&&typeof REL_ID!=='undefined'&&REL_ID[L.rel.t]&&typeof REL_TYPES!=='undefined'){
    const r=REL_TYPES.find(x=>x[0]===L.rel.t);if(r&&!(d&&d.rel&&d.rel.t===L.rel.t))t+=' · '+r[1].toLowerCase();}}catch(e){}
  return t;
}
function lensRenduTick(l,RS,now){
  let sig=l.x.toFixed(1)+','+l.y.toFixed(1)+'|'+(lens.rendu?lens.rendu.items.map(it=>it.key).join(';'):'');
  camera.updateMatrixWorld();{const a=camera.matrixWorld.elements;for(let i=0;i<16;i++)sig+=','+a[i].toFixed(4);}
  if(sig!==l.rdSig){l.rdSig=sig;l.rdDirty=true;l.rdQuiet=now;}
  if(l.rdDirty&&(l.rdName==null||now-l.rdQuiet>=LENS_RENDU_MS)){l.rdName=lensRenduName(l,RS);l.rdDirty=false;}
  else if(l.rdDirty)lensWake();
  return l.rdName;
}

/* ── recopie de la cible dans le cercle ── */
function lensQuadInit(){
  if(lens.quadScene)return;
  lens.quadMat=new THREE.ShaderMaterial({
    uniforms:{tLens:{value:null},uC:{value:new THREE.Vector2()},uR:{value:1},uSize:{value:new THREE.Vector2(1,1)},
      uC2:{value:new THREE.Vector2()},uR2:{value:0}}, // uR2 > 0 : seulement la zone commune avec un 2e cercle
    vertexShader:'varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader:'uniform sampler2D tLens; uniform vec2 uC; uniform float uR; uniform vec2 uSize; uniform vec2 uC2; uniform float uR2; varying vec2 vUv;\n'
      +'void main(){ float d = distance(vUv * uSize, uC); if(d > uR) discard;\n'
      +'  float a = 1.0 - smoothstep(uR - 1.5, uR, d);\n'
      +'  if(uR2 > 0.0){ float d2 = distance(vUv * uSize, uC2); if(d2 > uR2) discard; a = min(a, 1.0 - smoothstep(uR2 - 1.5, uR2, d2)); }\n'
      +'  vec4 c = texture2D(tLens, vUv); gl_FragColor = vec4(c.rgb, a);\n'
      +'  #include <tonemapping_fragment>\n  #include <colorspace_fragment>\n}',
    transparent:true,depthTest:false,depthWrite:false});
  // PLAN : papier et encre tels quels (sans les tons de l'écran 3D)
  lens.quadFlat=lens.quadMat.clone();lens.quadFlat.toneMapped=false;
  // RENDU : tons ACES puis sortie sRGB pour la pièce, comme le Rendu direct (le moteur de la vue garde une
  // sortie linéaire : la conversion est faite ici) ; fond (alpha 0 dans la cible) tel quel
  lens.quadRendu=lens.quadMat.clone();lens.quadRendu.toneMapped=false;
  lens.quadRendu.fragmentShader=lens.quadMat.fragmentShader
    .replace('varying vec2 vUv;\n','varying vec2 vUv;\n'
      +'vec3 lensRrt(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }\n'
      +'vec3 lensAces(vec3 c){ const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));\n'
      +'  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));\n'
      +'  c *= 1.0 / 0.6; c = I * c; c = lensRrt(c); c = O * c; return clamp(c, 0.0, 1.0); }\n'
      +'vec3 lensSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }\n')
    .replace('gl_FragColor = vec4(c.rgb, a);','gl_FragColor = vec4(c.a > 0.5 ? lensSrgb(lensAces(c.rgb)) : c.rgb, a);')
    .replace('#include <tonemapping_fragment>','').replace('#include <colorspace_fragment>','');
  const q=new THREE.Mesh(new THREE.PlaneGeometry(2,2),lens.quadMat);q.frustumCulled=false;
  lens.quadScene=new THREE.Scene();lens.quadScene.add(q);lens.quad=q;
  lens.quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
}
/* recopie la cible dans le cercle de l (et, avec l2, seulement dans la zone commune aux deux) */
function lensQuadDraw(gl,l,l2,pr,ch,W,H,flat){
  const M=flat==='rendu'?lens.quadRendu:flat?lens.quadFlat:lens.quadMat,u=M.uniforms;
  lens.quad.material=M;
  u.tLens.value=lens.rt.texture;u.uSize.value.set(W,H);
  u.uC.value.set(l.x*pr,(ch-l.y)*pr);u.uR.value=l.r*pr;
  if(l2){u.uC2.value.set(l2.x*pr,(ch-l2.y)*pr);u.uR2.value=l2.r*pr;}else u.uR2.value=0;
  try{gl.render(lens.quadScene,lens.quadCam);}finally{u.uR2.value=0;lens.quad.material=lens.quadMat;}
}
function lensWs(){try{return document.body.getAttribute('data-ws')||'cao';}catch(e){return 'cao';}}
function lensRender(RS){
  if(!lens.list.length||!renderer||!camera)return;
  if(lensWs()==='plan')return; // PLAN : pas de vue 3D (le calque est caché par le CSS)
  try{if(typeof rd!=='undefined'&&rd)return;}catch(e){} // atelier RENDU ouvert par-dessus
  lens.lastRS=RS;
  const gl=renderer,c=gl.domElement,cw=c.clientWidth||1,ch=c.clientHeight||1;
  lensLayerSync();
  const sz=gl.getDrawingBufferSize(_lensV2),W=sz.x,H=sz.y,pr=W/cw;
  if(!lens.rt)lens.rt=new THREE.WebGLRenderTarget(W,H,{depthBuffer:true,stencilBuffer:true,type:THREE.HalfFloatType,samples:4});
  else if(lens.rt.width!==W||lens.rt.height!==H)lens.rt.setSize(W,H);
  lensQuadInit();
  const prevRT=gl.getRenderTarget(),prevClip=gl.clippingPlanes,prevAuto=gl.autoClear;
  const meshes=lens.list.some(l=>l.kind!=='fao')?lensMeshes(RS):null;
  const R=lensFaoRoot(),rVis=R?R.visible:false;
  const now=performance.now();
  try{
    for(const l of lens.list){
      lensClamp(l);lensUiPlace(l);
      let info=null,F=null;
      if(l.kind==='coupe'){info=lensPlaneFor(l,lens.plane,RS);lensUiText(l,info.box?lensFmt(info.depth)+' mm':'');}
      else if(l.kind==='plan'){lensPlanSync(meshes,W,H);lensPlanEdges(RS,meshes);lensPlanTick(l,RS,now);lensUiText(l,lensPlanText(l));}
      else if(l.kind==='rendu'){lensRenduSync(meshes,W,H);lensUiText(l,lensRenduTick(l,RS,now)||'');}
      else{F=lensFaoTick(l,now);lensUiText(l,lensFaoText(F));lensUiOp(l,F);}
      const x0=Math.max(0,Math.floor((l.x-l.r)*pr)-2),y0=Math.max(0,Math.floor((ch-l.y-l.r)*pr)-2);
      const x1=Math.min(W,Math.ceil((l.x+l.r)*pr)+2),y1=Math.min(H,Math.ceil((ch-l.y+l.r)*pr)+2);
      if(x1<=x0||y1<=y0)continue;
      lens.rt.scissor.set(x0,y0,x1-x0,y1-y0);lens.rt.scissorTest=true;
      gl.setRenderTarget(lens.rt);
      gl.autoClear=true;gl.clear(true,true,true);
      if(l.kind==='coupe'){
        gl.clippingPlanes=[lens.plane];
        gl.render(RS,camera);
        lensCapsSync(meshes,lens.plane,info);
        gl.autoClear=false;
        if(lens.caps.length)gl.render(lens.capScene,camera);
        gl.clippingPlanes=prevClip;
      }else if(l.kind==='plan'){
        // la pièce au trait sur papier : fond papier, puis la scène à part (coque, papier, arêtes)
        const ca=gl.getClearAlpha();gl.getClearColor(_lensCol);
        try{gl.setClearColor(LENS_PAPER,1);gl.clear(true,true,true);}finally{gl.setClearColor(_lensCol,ca);}
        gl.autoClear=false;
        gl.render(lens.plan.scene,camera);
      }else if(l.kind==='rendu'){
        // la matière réelle : fond de l'ambiance puis les corps dans leur matière de rendu
        gl.autoClear=false;
        gl.render(lens.rendu.scene,camera);
      }else{
        // ce que montre l'espace FAO, ici seulement : la racine FAO allumée le temps de la passe
        if(R)R.visible=true;
        try{gl.render(RS,camera);}finally{if(R)R.visible=rVis;}
        gl.autoClear=false;
        if(lensToolPlace(F))gl.render(lens.toolScene,camera);
      }
      gl.setRenderTarget(prevRT);
      lensQuadDraw(gl,l,null,pr,ch,W,H,l.kind==='plan'?true:l.kind==='rendu'?'rendu':false);
    }
    // FAO posée sur Coupe : dans la zone commune, la pièce coupée, puis les passes (gardées derrière le plan)
    // et la fraise, testées en profondeur contre la matière restée
    for(const lf of lens.list){
      if(lf.kind!=='fao')continue;
      for(const lc of lens.list){
        if(lc.kind!=='coupe'||!lensOverlap(lf,lc))continue;
        const info=lensPlaneFor(lc,lens.plane,RS);
        const P=lensComboTick(lf,lc,lens.plane,now);
        const x0=Math.max(0,Math.floor(Math.max(lf.x-lf.r,lc.x-lc.r)*pr)-2),x1=Math.min(W,Math.ceil(Math.min(lf.x+lf.r,lc.x+lc.r)*pr)+2);
        const y0=Math.max(0,Math.floor((ch-Math.min(lf.y+lf.r,lc.y+lc.r))*pr)-2),y1=Math.min(H,Math.ceil((ch-Math.max(lf.y-lf.r,lc.y-lc.r))*pr)+2);
        if(x1<=x0||y1<=y0)continue;
        lens.rt.scissor.set(x0,y0,x1-x0,y1-y0);lens.rt.scissorTest=true;
        gl.setRenderTarget(lens.rt);
        gl.autoClear=true;gl.clear(true,true,true);
        if(R)R.visible=false;
        gl.clippingPlanes=[lens.plane];
        try{gl.render(RS,camera);}finally{if(R)R.visible=rVis;}
        lensCapsSync(meshes,lens.plane,info);
        gl.autoClear=false;
        if(lens.caps.length)gl.render(lens.capScene,camera);
        if(R&&R.parent===RS)lensDrawFaoOnly(gl,RS,R); // toujours coupé : seules les passes derrière le plan
        gl.clippingPlanes=prevClip;
        if(lensToolPlace(P))gl.render(lens.toolScene,camera); // la fraise entière, dans la matière
        gl.setRenderTarget(prevRT);
        lensQuadDraw(gl,lf,lc,pr,ch,W,H,false);
      }
    }
  }finally{
    gl.clippingPlanes=prevClip;gl.autoClear=prevAuto;
    if(R)R.visible=rVis;
    if(gl.getRenderTarget()!==prevRT)gl.setRenderTarget(prevRT);
  }
}

/* ── cercle, étiquette, poignée (calque HTML posé sur la vue) ── */
function lensCss(){
  if(typeof document==='undefined'||!document.head||document.getElementById('lensCss'))return;
  const s=document.createElement('style');s.id='lensCss';
  s.textContent=[
    '#lensLayer{position:absolute;pointer-events:none;z-index:6;overflow:hidden}',
    '#lensLayer .lens{position:absolute;pointer-events:none}',
    '#lensLayer .lens svg{position:absolute;left:-10px;top:-10px;overflow:visible;pointer-events:none}',
    '#lensLayer .lens .lensHit{fill:none;stroke:transparent;stroke-width:18;pointer-events:stroke;cursor:move}',
    '#lensLayer .lens .lensHalo{fill:none;stroke:rgba(0,0,0,.4);stroke-width:5}',
    '#lensLayer .lens .lensRing{fill:none;stroke:#fff;stroke-width:2.2}',
    '#lensLayer .lens svg.lensDims{left:0;top:0;overflow:hidden}',
    '#lensLayer .lensDims line{stroke:#1a2230;stroke-width:1}',
    '#lensLayer .lensDims line.x{stroke-width:.8;opacity:.75}',
    '#lensLayer .lensDims path{fill:#1a2230}',
    '#lensLayer .lensDims text{fill:#1a2230;font:600 12px/1 system-ui,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums;'
      +'paint-order:stroke;stroke:#f4f6f9;stroke-width:3px;stroke-linejoin:round}',
    '#lensLayer .lensPill{position:absolute;left:50%;top:-8px;transform:translate(-50%,-100%);display:flex;align-items:center;gap:7px;'
      +'height:26px;padding:0 4px 0 11px;border-radius:999px;background:rgba(22,24,30,.9);border:1px solid rgba(255,255,255,.28);'
      +'color:#fff;font:600 12px/1 system-ui,"Segoe UI",sans-serif;white-space:nowrap;pointer-events:auto;cursor:move;user-select:none}',
    '#lensLayer .lensPill i{width:8px;height:8px;border-radius:4px;display:inline-block}',
    '#lensLayer .lensPill b{font-weight:500;font-variant-numeric:tabular-nums;opacity:.85}',
    '#lensLayer .lensPill button{width:20px;height:20px;border-radius:10px;border:0;background:rgba(255,255,255,.14);color:#fff;'
      +'font:600 13px/20px system-ui,sans-serif;padding:0;cursor:pointer}',
    '#lensLayer .lensPill button:hover{background:#ff453a}',
    '#lensLayer .lensHandle{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:7px;background:#fff;'
      +'border:2px solid rgba(0,0,0,.55);box-sizing:border-box;pointer-events:auto;cursor:nwse-resize;padding:0}',
    '#lensLayer button:focus-visible{outline:2px solid #ff9f0a;outline-offset:2px}',
    'body[data-ws="plan"] #lensLayer{display:none!important}',
    '#viewbar #btnLens.on{background:#ff9f0a!important;border-color:#ff9f0a!important;color:#1c1c1e!important}',
    '#lensMenu{position:fixed;z-index:2000;min-width:236px;padding:6px;border-radius:12px;background:rgba(22,24,30,.97);'
      +'border:1px solid rgba(255,255,255,.18);box-shadow:0 12px 32px rgba(0,0,0,.5);color:#fff;font:13px/1.3 system-ui,"Segoe UI",sans-serif}',
    '#lensMenu button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:none;'
      +'color:inherit;font:inherit;text-align:left;cursor:pointer}',
    '#lensMenu button:hover,#lensMenu button:focus-visible{background:rgba(255,255,255,.09);outline:none}',
    '#lensMenu i{flex:none;width:10px;height:10px;border-radius:5px}',
    '#lensMenu b{font-weight:600}',
    '#lensMenu small{display:block;color:rgba(255,255,255,.62);font-size:11.5px;margin-top:1px}',
    '#lensMenu hr{border:0;border-top:1px solid rgba(255,255,255,.12);margin:5px 4px}',
    '#lensMenu .lensMenuOff{color:#ff8a80}'
  ].join('\n');
  document.head.appendChild(s);
}
function lensLayerSync(){
  const c=lensCanvas();if(!c||!c.parentNode||typeof document==='undefined'||!document.createElement)return null;
  let L=lens.layer;
  if(!L||!L.isConnected){L=document.getElementById('lensLayer');
    if(!L){L=document.createElement('div');L.id='lensLayer';c.parentNode.insertBefore(L,c.nextSibling);}
    lens.layer=L;}
  const k=c.offsetLeft+','+c.offsetTop+','+c.clientWidth+','+c.clientHeight;
  if(L.dataset.k!==k){L.dataset.k=k;Object.assign(L.style,{left:c.offsetLeft+'px',top:c.offsetTop+'px',width:c.clientWidth+'px',height:c.clientHeight+'px'});}
  return L;
}
function lensUiBuild(l){
  if(typeof document==='undefined'||!document.createElementNS)return;
  lensCss();
  const L=lensLayerSync();if(!L)return;
  const K=LENS_KINDS[l.kind],NS='http://www.w3.org/2000/svg';
  const el=document.createElement('div');el.className='lens';el.dataset.id=l.id;
  const svg=document.createElementNS(NS,'svg');
  ['lensHalo','lensRing','lensHit'].forEach(cl=>{const ci=document.createElementNS(NS,'circle');ci.setAttribute('class',cl);svg.appendChild(ci);});
  const pill=document.createElement('div');pill.className='lensPill';
  pill.title=l.kind==='coupe'
    ?'Lentille Coupe — glisser : déplacer · molette sur le cercle : plus ou moins profond (Maj : finement) · double-clic : coupe au milieu'
    :l.kind==='rendu'
    ?'Lentille Rendu — chaque corps dans sa matière de rendu (clic droit sur un corps : apparence de rendu), avec les reflets de l’ambiance de la fenêtre RENDU ; l’étiquette nomme la matière sous le centre — glisser : déplacer'
    :l.kind==='plan'
    ?'Lentille Plan — la pièce au trait (arêtes cachées en pointillés) et les cotes de la zone : Ø et R des cercles, longueurs des arêtes droites entières sous la loupe — glisser : déplacer'
    :'Lentille FAO — passes déjà calculées, fraise de l’opération qui coupe le plus ici, temps de coupe des passes sous la loupe (avances des opérations, rapides non comptés) — glisser : déplacer';
  pill.innerHTML='<i></i><span></span><b></b><button type="button" aria-label="Retirer la lentille" title="Retirer la lentille">×</button>';
  pill.querySelector('i').style.background=K.teinte;
  pill.querySelector('span').textContent=K.nom;
  const hd=document.createElement('button');hd.type='button';hd.className='lensHandle';
  hd.setAttribute('aria-label','Agrandir ou réduire la lentille');hd.title='Agrandir / réduire';
  let dims=null;
  if(l.kind==='plan'){ // calque des cotes, sous le cercle, rogné par lui
    const ds=document.createElementNS(NS,'svg');ds.setAttribute('class','lensDims');
    const cp=document.createElementNS(NS,'clipPath');cp.id='lensClip'+l.id;const cc=document.createElementNS(NS,'circle');cp.appendChild(cc);
    const df=document.createElementNS(NS,'defs');df.appendChild(cp);ds.appendChild(df);
    dims=document.createElementNS(NS,'g');dims.setAttribute('clip-path','url(#lensClip'+l.id+')');ds.appendChild(dims);
    el.appendChild(ds);
  }
  el.appendChild(svg);el.appendChild(pill);el.appendChild(hd);L.appendChild(el);
  l.el=el;l.ui={svg,pill,hd,depth:pill.querySelector('b'),k:'',dims};
  const x=pill.querySelector('button');
  x.addEventListener('click',ev=>{ev.stopPropagation();lensRemove(l.id);});
  x.addEventListener('pointerdown',ev=>ev.stopPropagation());
  const start=(mode,ev)=>{
    if(ev.button!==0)return;
    ev.preventDefault();ev.stopPropagation();
    const t=ev.currentTarget;try{t.setPointerCapture(ev.pointerId);}catch(e){}
    const r=L.getBoundingClientRect();
    lens.drag={l,mode,dx:l.x-(ev.clientX-r.left),dy:l.y-(ev.clientY-r.top)};
    const mv=e=>{const d=lens.drag;if(!d)return;const rr=L.getBoundingClientRect(),px=e.clientX-rr.left,py=e.clientY-rr.top;
      if(d.mode==='move'){d.l.x=px+d.dx;d.l.y=py+d.dy;}else d.l.r=Math.hypot(px-d.l.x,py-d.l.y);
      lensClamp(d.l);lensUiPlace(d.l);lensWake();};
    const up=()=>{lens.drag=null;t.removeEventListener('pointermove',mv);t.removeEventListener('pointerup',up);t.removeEventListener('pointercancel',up);};
    t.addEventListener('pointermove',mv);t.addEventListener('pointerup',up);t.addEventListener('pointercancel',up);
  };
  const hit=svg.querySelector('.lensHit');
  hit.addEventListener('pointerdown',ev=>start('move',ev));
  pill.addEventListener('pointerdown',ev=>start('move',ev));
  hd.addEventListener('pointerdown',ev=>start('size',ev));
  const wh=ev=>{ev.preventDefault();ev.stopPropagation();if(l.kind==='coupe')lensDepthStep(l,ev.deltaY<0?1:-1,ev.shiftKey);};
  [hit,pill,hd].forEach(n=>n.addEventListener('wheel',wh,{passive:false}));
  pill.addEventListener('dblclick',ev=>{ev.preventDefault();ev.stopPropagation();if(l.kind==='coupe'){l.depth=null;lensWake();}});
}
function lensUiPlace(l){
  if(!l.el||!l.ui)return;
  const k=l.x.toFixed(1)+','+l.y.toFixed(1)+','+l.r.toFixed(1);if(l.ui.k===k)return;l.ui.k=k;
  const d=2*l.r;
  Object.assign(l.el.style,{left:(l.x-l.r)+'px',top:(l.y-l.r)+'px',width:d+'px',height:d+'px'});
  const S=d+20;l.ui.svg.setAttribute('width',S);l.ui.svg.setAttribute('height',S);
  l.ui.svg.querySelectorAll('circle').forEach(ci=>{ci.setAttribute('cx',l.r+10);ci.setAttribute('cy',l.r+10);ci.setAttribute('r',l.r);});
  if(l.ui.dims){const ds=l.ui.dims.ownerSVGElement||l.ui.dims.parentNode;ds.setAttribute('width',d);ds.setAttribute('height',d);
    const cc=ds.querySelector('clipPath circle');cc.setAttribute('cx',l.r);cc.setAttribute('cy',l.r);cc.setAttribute('r',l.r-1);}
  const a=Math.PI/4;l.ui.hd.style.left=(l.r+l.r*Math.cos(a))+'px';l.ui.hd.style.top=(l.r+l.r*Math.sin(a))+'px';
  lensPillPlace();
}
function lensPillPlace(){
  // l'étiquette reste dans la vue : au-dessus du cercle, ou dedans quand le cercle sort par le haut ;
  // deux loupes proches : l'étiquette de la plus récente se pousse pour ne pas cacher l'autre (ni son ×)
  const {w,h}=lensSize(),done=[];
  for(const l of lens.list){
    if(!l.ui)continue;
    const p=l.ui.pill,hw=(p.offsetWidth||160)/2,ph=(p.offsetHeight||26)+4;
    const cx=w>0?Math.max(hw+6,Math.min(w-hw-6,l.x)):l.x;
    let y=(l.y-l.r)+Math.max(-8,34-(l.y-l.r)); // bas de l'étiquette, dans la vue
    for(let k=0;k<2*LENS_MAX;k++){
      const o=done.find(d=>Math.abs(d.x-cx)<d.hw+hw+4&&Math.abs(d.y-y)<ph);
      if(!o)break;
      y=(o.y-ph-ph>=0)?o.y-ph:o.y+ph; // au-dessus de l'autre, sinon en dessous
      if(h>0)y=Math.min(y,h-4);
    }
    done.push({x:cx,y,hw});
    p.style.top=(y-(l.y-l.r))+'px';p.style.left=(cx-(l.x-l.r))+'px';
  }
}
function lensUiText(l,t){
  if(!l.ui)return;
  if(l.ui.depth.textContent!==t){l.ui.depth.textContent=t;lensPillPlace();} // largeur changée
}
function lensUiOp(l,F){
  // l'étiquette FAO rappelle au survol l'opération qui coupe le plus sous la loupe
  const op=F&&F.op;if(!l.ui||op===l.faoOp)return;l.faoOp=op;
  let s='';try{if(op&&typeof faoOpLabel==='function')s=faoOpLabel(op,F.job);}catch(e){}
  l.ui.pill.title=(s?'Ici surtout : '+s+'\n':'')+'Lentille FAO — passes déjà calculées, fraise de l’opération qui coupe le plus ici, temps de coupe des passes sous la loupe (avances des opérations, rapides non comptés) — glisser : déplacer';
}
function lensBtnSync(){
  const b=lens.btn||(typeof document!=='undefined'&&document.getElementById&&document.getElementById('btnLens'));
  if(b&&b.classList)b.classList.toggle('on',lens.list.length>0);
}
/* ── menu du bouton loupe : Coupe, FAO, tout retirer ── */
function lensMenuClose(){
  const m=lens.menu;lens.menu=null;
  if(!m)return;
  try{document.removeEventListener('pointerdown',m.out,true);document.removeEventListener('keydown',m.key,true);}catch(e){}
  try{if(m.el.parentNode)m.el.parentNode.removeChild(m.el);}catch(e){}
}
function lensMenuOpen(b){
  if(lens.menu){lensMenuClose();return;}
  lensCss();
  const el=document.createElement('div');el.id='lensMenu';el.setAttribute('role','menu');
  const item=(html,fn,cls)=>{const x=document.createElement('button');x.type='button';x.setAttribute('role','menuitem');
    if(cls)x.className=cls;x.innerHTML=html;x.addEventListener('click',ev=>{ev.stopPropagation();lensMenuClose();fn();});el.appendChild(x);return x;};
  const full=lens.list.length>=LENS_MAX;
  Object.keys(LENS_KINDS).forEach(k=>{const K=LENS_KINDS[k];
    const x=item('<i style="background:'+K.teinte+'"></i><span><b>'+K.nom+'</b><small>'+(full?'4 lentilles au plus':K.aide)+'</small></span>',()=>lensAdd(k));
    if(full)x.disabled=true;});
  if(lens.list.length){el.appendChild(document.createElement('hr'));
    item('<span>Retirer '+(lens.list.length>1?'les '+lens.list.length+' lentilles':'la lentille')+'</span>',lensClearAll,'lensMenuOff');}
  document.body.appendChild(el);
  const r=b.getBoundingClientRect(),mw=el.offsetWidth||236;
  el.style.left=Math.max(8,Math.min(innerWidth-mw-8,r.right-mw))+'px';el.style.top=(r.bottom+6)+'px';
  const out=ev=>{if(!el.contains(ev.target)&&ev.target!==b&&!b.contains(ev.target))lensMenuClose();};
  const key=ev=>{if(ev.key==='Escape'){ev.stopPropagation();ev.preventDefault();lensMenuClose();try{b.focus();}catch(e){}}};
  document.addEventListener('pointerdown',out,true);document.addEventListener('keydown',key,true);
  lens.menu={el,out,key};
  try{const f=el.querySelector('button:not([disabled])');if(f)f.focus();}catch(e){}
}
function lensInit(){
  try{
    if(typeof document==='undefined'||!document.getElementById)return;
    lensCss();
    const vb=document.getElementById('viewbar'),st=document.getElementById('btnSettings');
    if(vb&&!document.getElementById('btnLens')){
      const b=document.createElement('button');b.id='btnLens';
      b.title='Lentilles : une loupe posée sur la pièce, un autre regard dessous — Coupe (l’intérieur), FAO (passes, outil, temps de coupe ici), Plan (la pièce au trait, cotée) ou Rendu (la matière réelle) ; le reste de la vue ne bouge pas';
      b.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" style="vertical-align:-3px"><circle cx="10" cy="10" r="6.5"/><path d="M6.5 10h7" stroke-dasharray="2 1.6"/><path d="M15 15l6 6"/></svg>';
      b.setAttribute('aria-label','Lentilles');b.setAttribute('aria-haspopup','menu');
      b.onclick=ev=>{if(ev)ev.stopPropagation();lensMenuOpen(b);};
      vb.insertBefore(b,st||null);lens.btn=b;
    }
    if(typeof window!=='undefined'&&window.addEventListener)
      window.addEventListener('resize',()=>{lens.list.forEach(l=>{lensClamp(l);lensUiPlace(l);});});
  }catch(e){}
}
lensInit();
