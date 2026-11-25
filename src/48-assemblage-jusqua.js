/* ---------- « Jusqu'à » une face, une arête ou un sommet d'une AUTRE pièce (V0.99.94) ----------
   Demande de Fred : « Assemblage : Conception, permettre de sélectionner les faces et arêtes des
   autres modèles pour aller jusqu'à la face ou arête d'un autre modèle », « avec la possibilité de
   mettre une valeur en moins ou en plus, par exemple +1mm ou -1mm », « Fonction extrusion en
   particulier mais pas que ».
   En mode Modéliser d'un assemblage, l'étendue « Jusqu'à » de l'extrusion (70) et la fin « Jusqu'à la
   face » du perçage et de sa longueur filetée (76) acceptent aussi, sur les pièces dessinées autour :
     · une face PLANE (capture _snap.pfaces, référence 'xf' comme la construction, V0.9.7) ;
     · une arête (capture _snap.pedges, référence 'xe', V0.9.8) : parallèle au plan de départ, on
       s'arrête à sa hauteur ; sinon on prend son sommet le plus proche du clic ;
     · un sommet (à 12 px au plus d'un bout d'arête).
   La cible devient un PLAN : face → son plan ; arête / sommet → plan perpendiculaire à la direction
   de la fonction qui passe par elle. Les références suivent l'autre pièce déplacée ou modifiée
   (asmExtStale, 46) et gardent la dernière distance (⚠ dans la fenêtre) si la cible disparaît.
   Décalage (off, mm), pour toutes les cibles « jusqu'à » : + = plus loin que la cible, − = avant. */
const ASM_UPTO_PLAT=0.01; // arête « parallèle » au plan de départ : écart de hauteur toléré (mm)
let asmUptoHl=null;       // surbrillance de la cible survolée
function asmUptoDispo(){
  // Une autre pièce affichée offre-t-elle des arêtes ou des faces ? (mode Modéliser d'un assemblage)
  try{
    if(typeof asm==='undefined'||!asm||!asmOn()||asmMode==='asm')return false;
    return asmSkExtLists().length>0;
  }catch(e){return false;}
}
function asmUptoRefs(f){
  // Références vers une autre pièce portées par une fonction (extrusion, perçage, longueur filetée)
  if(!f)return [];
  return [f.upto&&f.upto.x,f.uptoPlane&&f.uptoPlane.x,f.thread&&f.thread.uptoPlane&&f.thread.uptoPlane.x]
    .filter(r=>r&&(r.k==='xf'||r.k==='xe'));
}
function asmUptoOccName(path){
  // « Socle:1 » : nom de l'occurrence visée
  try{return (asmOcc(path[path.length-1])||{}).name||'';}catch(e){return '';}
}
function asmUptoEdgePts(ref,cid){
  // Arête 'xe' retrouvée dans la capture de son composant : ses points et son milieu, dans le repère
  // du composant cid (actif par défaut) ; la référence suit (pos, len, sig), comme asmXeEval (46)
  if(!asm||!ref||!Array.isArray(ref.path)||!ref.pos)return null;
  cid=cid||asm.active;
  const T=asmPathComp(ref.path),c=asmComp(T);
  if(!c||T===cid||!c._snap||!c._snap.pedges)return null;
  const hit=asmXeFind(c._snap.pedges,ref);if(!hit)return null;
  const ctx=asmSkExtCtx(ref,cid),F=ctx&&asmSkXf(ctx,ref.path);if(!F)return null;
  const r4=v=>v.map(a=>+(+a).toFixed(4));
  ref.pos=r4(hit.m);ref.len=+hit.L.toFixed(4);ref.sig=asmXfSig(ref,cid);
  return {pts:hit.e.pts.map(p=>asmApply(F,p)),mid:asmApply(F,hit.m)};
}
function asmUptoPlane(ref,dir,cid){
  // Plan {p, n} de la cible dans le repère du composant cid (actif par défaut). dir : direction de la
  // fonction (une arête ou un sommet donne le plan perpendiculaire à dir). null : cible introuvable.
  if(!asm||!ref)return null;
  let d=null;try{d=cgUnit(dir);}catch(e){return null;}
  if(ref.k==='xf'){
    const g=asmXfEval(ref,cid);if(!g||!g.plane)return null;
    let n=null;try{n=cgUnit(g.plane.n);}catch(e){return null;}
    return {p:g.plane.o.slice(),n};
  }
  if(ref.k!=='xe')return null;
  if(ref.sub==='vtx'){const g=asmXeEval(ref,cid);return g&&g.point?{p:g.point.o.slice(),n:d}:null;}
  const E=asmUptoEdgePts(ref,cid);if(!E||!E.pts.length)return null;
  // arête parallèle au plan de départ : sa hauteur ; sinon (l'autre pièce a tourné) son milieu
  let lo=Infinity,hi=-Infinity;E.pts.forEach(p=>{const h=cgDot(p,d);if(h<lo)lo=h;if(h>hi)hi=h;});
  return {p:(hi-lo<=ASM_UPTO_PLAT?E.pts[0]:E.mid).slice(),n:d};
}
function asmUptoDist(pl,O,dir){
  // Distance signée le long de dir, depuis O, jusqu'au plan pl ; null si dir est parallèle au plan
  if(!pl)return null;
  const dn=cgDot(pl.n,dir);if(Math.abs(dn)<1e-9)return null;
  return cgDot(pl.n,cgSub(pl.p,O))/dn;
}
function asmUptoOff(v){
  // Décalage saisi (« +1 », « -1,5 », « 2 mm ») → nombre, ou NaN
  const s=String(v==null?'':v).replace(',','.').replace(/mm/i,'').replace(/\s/g,'');
  return s===''?0:parseFloat(s);
}
function asmUptoOffTxt(off){
  // « +1 » / « −1,5 » (vide pour 0) : libellés et noms de fonction
  off=+off||0;if(!off)return '';
  return (off>0?'+':'−')+String(+Math.abs(off).toFixed(3)).replace('.',',');
}
/* ── ce qui est sous le curseur, sur les autres pièces ── */
function asmOtherFaceHit(e){
  // Triangle d'une autre pièce sous le curseur. Ces maillages ne sont pas cliquables en temps normal
  // (asmFill, 47) : on les vise ici, pendant une saisie seulement. → intersection THREE ou null
  if(typeof scene==='undefined'||!scene)return null;
  const G=scene.getObjectByName('asmCtx');if(!G||G.visible===false)return null;
  const r=renderer.domElement.getBoundingClientRect();
  rayc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
  G.updateMatrixWorld(true);
  const hits=[];G.traverse(m=>{if(m.isMesh&&m.visible!==false)THREE.Mesh.prototype.raycast.call(m,rayc,hits);});
  hits.sort((a,b)=>a.distance-b.distance);
  return hits[0]||null;
}
function asmOtherFaceRef(h,wP,wA){
  // Face exacte (_snap.pfaces) touchée en h sur une autre pièce : face plane (wP) ou cylindrique /
  // conique (wA) → référence 'xf' ; {err} si la pièce n'a pas de faces exactes ; null sinon
  if(!h||!h.face)return null;
  let g=h.object;while(g&&!(g.userData&&g.userData.path))g=g.parent;if(!g)return null;
  const path=g.userData.path.slice(),T=asmPathComp(path),c=asmComp(T);
  if(!c||T===asm.active)return null;
  const Fs=c._snap&&c._snap.pfaces;
  if(!Fs||!Fs.length)return {err:'« '+c.name+' » : faces exactes indisponibles (noyau exact requis, rejouez ce composant).'};
  const ctx=asm.path.slice(),Fi=asmInverse(asmSkXf(ctx,path));
  const p=asmApply(Fi,[h.point.x,h.point.y,h.point.z]);
  const nw=h.face.normal.clone().transformDirection(h.object.matrixWorld);
  const q=asmApply(Fi,[nw.x,nw.y,nw.z]),n=cgUnit([q[0]-Fi.o[0],q[1]-Fi.o[1],q[2]-Fi.o[2]]);
  let best=null,bd=Infinity;
  Fs.forEach(f=>{
    if(wP&&f.plane&&Math.abs(cgDot(n,f.plane.n))>0.995){
      const d=Math.abs(cgDot(cgSub(p,f.plane.o),f.plane.n));if(d<bd){bd=d;best=f;}
    }
    if(wA&&f.axis&&Math.abs(cgDot(n,f.axis.d))<0.2){
      const w=cgSub(p,f.axis.o),t=cgDot(w,f.axis.d),dd=cgLen(cgSub(w,cgMul(f.axis.d,t)));
      const d=f.axis.rad!=null?Math.abs(dd-f.axis.rad):dd;if(d<bd){bd=d;best=f;}
    }
  });
  if(!best||bd>0.5)return null;
  const nm=asmUptoOccName(path)||c.name;
  const loc=best.plane?{plane:best.plane}:{axis:best.axis};
  return {k:'xf',ctx,path,ref:best.ref,loc,name:(best.plane?'Face':'Axe de face')+' · '+nm,sig:null};
}
function asmOtherEdgeAt(e,surfDist){
  // Arête des autres instances (asmSkExtLists : arêtes exactes vues depuis l'instance active) à ≤ 7 px
  // du curseur, non masquée par une surface plus proche que surfDist → {Lx, E, ei, raw, toS, mx, my}
  const lists=asmSkExtLists();if(!lists.length)return null;
  const r=renderer.domElement.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  const v=new THREE.Vector3(),toS=p=>{v.set(p[0],p[1],p[2]).project(camera);return [(v.x+1)/2*r.width,(1-v.y)/2*r.height,v.z];};
  let best=null,bd=7;
  lists.forEach(Lx=>Lx.edges.forEach((E,ei)=>{
    let a=toS(E.pts[0]);
    for(let k=1;k<E.pts.length;k++){
      const b=toS(E.pts[k]);
      if(Math.abs(a[2])<1&&Math.abs(b[2])<1){
        const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1e-9;
        const t=Math.max(0,Math.min(1,((mx-a[0])*dx+(my-a[1])*dy)/L2));
        const d=Math.hypot(mx-(a[0]+t*dx),my-(a[1]+t*dy));
        if(d<bd){
          const P0=E.pts[k-1],P1=E.pts[k],w=new THREE.Vector3(P0[0]+(P1[0]-P0[0])*t,P0[1]+(P1[1]-P0[1])*t,P0[2]+(P1[2]-P0[2])*t);
          if(camera.position.distanceTo(w)<=surfDist*1.004+0.3){bd=d;best={Lx,E,ei};}
        }
      }
      a=b;
    }
  }));
  if(!best)return null;
  best.raw=asmComp(asmPathComp(best.Lx.ext.path))._snap.pedges[best.ei];
  best.toS=toS;best.mx=mx;best.my=my;
  return best;
}
function asmUptoEdgeRef(A,dir){
  // Arête trouvée par asmOtherEdgeAt → référence 'xe' pour un « jusqu'à » : sommet près d'un bout
  // (≤ 12 px) ou arête non parallèle au plan de départ (son sommet le plus proche) ; sinon l'arête
  const {Lx,E,raw,toS,mx,my}=A,x=Lx.ext;
  let L=0;for(let i=1;i<raw.pts.length;i++)L+=Math.hypot(raw.pts[i][0]-raw.pts[i-1][0],raw.pts[i][1]-raw.pts[i-1][1],raw.pts[i][2]-raw.pts[i-1][2]);
  const mid=raw.mid||raw.pts[Math.floor(raw.pts.length/2)];
  const nm=asmUptoOccName(x.path)||Lx.name;
  const base={k:'xe',ctx:x.ctx.slice(),path:x.path.slice(),pos:mid.map(a=>+a.toFixed(4)),len:+L.toFixed(4),sig:null};
  const last=E.pts.length-1;
  const ends=[0,last].map(i=>{const s=toS(E.pts[i]);return {i,d:Math.hypot(s[0]-mx,s[1]-my)};}).sort((p,q)=>p.d-q.d);
  let flat=true;
  try{const d=cgUnit(dir);let lo=Infinity,hi=-Infinity;E.pts.forEach(p=>{const h=cgDot(p,d);if(h<lo)lo=h;if(h>hi)hi=h;});flat=hi-lo<=ASM_UPTO_PLAT;}catch(err){}
  const closed=Math.hypot(E.pts[0][0]-E.pts[last][0],E.pts[0][1]-E.pts[last][1],E.pts[0][2]-E.pts[last][2])<1e-6;
  if((ends[0].d<=12&&!closed)||!flat){
    const end=ends[0].i?raw.pts[raw.pts.length-1]:raw.pts[0];
    return Object.assign(base,{sub:'vtx',vpos:end.map(a=>+a.toFixed(4)),name:'Sommet · '+nm});
  }
  let Gm=null;try{Gm=cgEdgeGeom(E.pts);}catch(err){}
  return Object.assign(base,{sub:'edge',name:(Gm&&Gm.circ?'Cercle':'Arête')+' · '+nm});
}
function asmUptoPickAt(e,dir,bodyDist){
  // Cible « jusqu'à » sur une autre pièce sous le curseur : arête ou sommet (≤ 7 px, non masqué),
  // sinon face plane. bodyDist : distance de la pièce active touchée (devant = elle gagne).
  // → {ref, hit, A} | {err} (autre pièce touchée mais inutilisable) | null (rien d'une autre pièce)
  if(!asmUptoDispo())return null;
  const h=asmOtherFaceHit(e);
  const bd=bodyDist==null?Infinity:bodyDist;
  const A=asmOtherEdgeAt(e,Math.min(h?h.distance:Infinity,bd));
  if(A)return {ref:asmUptoEdgeRef(A,dir),A};
  if(!h||bd<h.distance-1e-6)return null; // rien, ou la pièce active est devant
  const xf=asmOtherFaceRef(h,true,false);
  if(xf&&!xf.err)return {ref:xf,hit:h};
  return {err:xf&&xf.err?xf.err:'face non plane d’une autre pièce : choisissez une face plane, une arête ou un sommet.',hit:h};
}
/* ── survol : la cible qu'un clic retiendrait, en orange ── */
function asmUptoHlClear(){
  if(!asmUptoHl)return;
  try{scene.remove(asmUptoHl);asmUptoHl.traverse(o=>{try{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();}catch(e){}});}catch(e){}
  asmUptoHl=null;
}
function asmUptoHlFace(h){
  // Triangles de la face exacte touchée (groupes occGroups du maillage capturé, 47) — sinon le seul triangle
  const m=h.object,g=m.geometry,pos=g.getAttribute('position'),idx=g.index;
  const grp=(g.userData||{}).occGroups;
  let a=h.faceIndex,b=h.faceIndex+1;
  if(Array.isArray(grp)){const G=grp.find(x=>h.faceIndex>=x.start&&h.faceIndex<x.start+x.count);if(G){a=G.start;b=G.start+G.count;}}
  const out=[];
  for(let t=a;t<b;t++)for(let k=0;k<3;k++){const i=idx?idx.getX(t*3+k):t*3+k;out.push(pos.getX(i),pos.getY(i),pos.getZ(i));}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(out,3));
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xff8c00,transparent:true,opacity:0.45,side:THREE.DoubleSide,
    depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  m.updateMatrixWorld(true);mesh.matrixAutoUpdate=false;mesh.matrix.copy(m.matrixWorld);
  mesh.renderOrder=998;return mesh;
}
let asmUptoHovEv=null,asmUptoHovMsg=false;
function asmUptoDirNow(){
  // Direction de la saisie « jusqu'à » en cours (perçage : axe du trou ; extrusion : normale de l'esquisse)
  try{const H=typeof holeUptoPick==='function'?holeUptoPick():null;if(H){const U=holeUptoDir(H.f);return U?U.D:null;}}catch(e){}
  try{
    const f=(typeof extPickFace!=='undefined'&&extPickFace&&extPickFace.f)||(typeof extUptoAuto==='function'?extUptoAuto():null);
    const sk=f&&doc.sketches.find(s=>s.id===f.sketchId);
    if(sk){const B=sketchBasis(sk);return [B.n.x,B.n.y,B.n.z];}
  }catch(e){}
  return null;
}
function asmUptoHoverAt(e){
  // Déplacement de la souris pendant une saisie « jusqu'à » (90-10) : une recherche par image au plus
  if(!asmUptoDispo()){asmUptoHlClear();return;}
  const first=!asmUptoHovEv;asmUptoHovEv={clientX:e.clientX,clientY:e.clientY};
  if(!first)return;
  const run=()=>{
    const ev=asmUptoHovEv;asmUptoHovEv=null;if(!ev)return;
    const dir=asmUptoDirNow();if(!dir){asmUptoHlClear();return;}
    // pièce active devant : comme au clic (extrusion : corps réels seulement, l'outil de découpe est transparent)
    let d=null;
    try{
      const H=typeof holeUptoPick==='function'?holeUptoPick():null;
      if(H){const h=pick(ev);d=h?h.distance:null;}else{const h=extPickHit(ev);d=h?h.dist:null;}
    }catch(err){}
    asmUptoHover(ev,dir,d);
  };
  try{requestAnimationFrame(run);}catch(err){run();}
}
function asmUptoHover(e,dir,bodyDist){
  // Survol pendant une saisie « jusqu'à » : surbrillance de la cible d'une autre pièce, son nom en bas.
  // → true si une autre pièce est sous le curseur (le survol de la pièce active ne compte pas)
  asmUptoHlClear();
  let R=null;try{R=asmUptoPickAt(e,dir,bodyDist);}catch(err){R=null;}
  if(!R){
    if(asmUptoHovMsg){asmUptoHovMsg=false;try{faceEl.textContent='Jusqu’à : cliquez une face, ou une face plane, une arête, un sommet d’une autre pièce.';}catch(err){}}
    return false;
  }
  asmUptoHovMsg=true;
  const G=new THREE.Group();G.name='asmUptoHl';G.userData.noMirror=true;
  try{
    if(R.ref&&R.A){
      const P=R.A.E.pts;
      if(R.ref.sub==='vtx'){
        const q=R.ref.vpos,F=asmSkXf(R.ref.ctx,R.ref.path),w=F?asmApply(F,q):P[0];
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(w,3));
        const pt=new THREE.Points(geo,new THREE.PointsMaterial({color:0xff8c00,size:11,sizeAttenuation:false,depthTest:false}));
        pt.renderOrder=999;G.add(pt);
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([].concat(...P),3));
      const ln=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xff8c00,depthTest:false,linewidth:2}));
      ln.renderOrder=999;G.add(ln);
    }else if(R.hit&&R.ref)G.add(asmUptoHlFace(R.hit));
  }catch(err){}
  if(G.children.length){scene.add(G);asmUptoHl=G;}
  try{faceEl.textContent=R.ref?'Jusqu’à : '+R.ref.name+' — cliquez pour la choisir.':'Jusqu’à : '+R.err;}catch(err){}
  return true;
}
/* ── perçage : plans des cibles prises sur une autre pièce, recalculés avant le rejeu ── */
function asmUptoHoleSync(f){
  // f.uptoPlane / f.thread.uptoPlane {p, n, x} : p, n relus depuis la référence x (plan
  // perpendiculaire à l'axe du trou pour une arête ou un sommet). Cible perdue : plan gardé, perdu=1.
  if(!f||f.type!=='hole')return;
  const L=[f.uptoPlane,f.thread&&f.thread.uptoPlane].filter(pl=>pl&&pl.x);if(!L.length)return;
  const sk=(doc.sketches||[]).find(s=>s.id===f.sketchId);if(!sk)return;
  let D=null;try{const A=holeAxis(f,sk);D=[A.dir.x,A.dir.y,A.dir.z];}catch(e){return;}
  const r6=v=>v.map(a=>+(+a).toFixed(6));
  L.forEach(pl=>{
    let q=null;try{q=asmUptoPlane(pl.x,D);}catch(e){q=null;}
    if(!q){pl.perdu=1;return;}
    delete pl.perdu;pl.p=r6(q.p);pl.n=r6(q.n);
  });
}
function asmUptoSyncAll(){
  // Avant le rejeu (rebuildHotes, 30) : cibles des perçages prises sur une autre pièce
  if(typeof asm==='undefined'||!asm)return;
  (doc.features||[]).forEach(f=>{if(f&&f.type==='hole'){try{asmUptoHoleSync(f);}catch(e){}}});
}
