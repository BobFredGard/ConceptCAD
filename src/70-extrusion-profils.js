/* ---------- zones fermées d'une esquisse : profils à choisir (comme Fusion 360) ----------
   Une ZONE est une face du découpage du plan par les traits de l'esquisse : un anneau (face du
   traçage skLoopTrace, ou cercle complet) moins ce qui est posé directement dedans (trous).
   · En esquisse : chaque zone fermée est teintée en bleu pâle — un contour qui ne se referme
     pas ne se teinte pas, on le voit d'un coup d'œil.
   · Dans la fenêtre de l'extrusion : les zones sont affichées sur le plan de l'esquisse, un clic
     en ajoute ou en retire une ; plusieurs zones = une seule extrusion.
   Le choix est mémorisé sur la fonction (f.profiles) par un POINT INTÉRIEUR de chaque zone, en
   coordonnées d'esquisse : il suit les cotes tant que le point reste dans la même zone.
   Sans choix (f.profiles absent), l'extrusion prend toute la matière comme avant (pair/impair). */
function skRegCircleRing(sk,c,n){
  const C=sk.points&&sk.points[c.pc];if(!C||!(c.r>0))return null;
  const N=n||64,R=[];
  for(let i=0;i<N;i++){const a=i/N*Math.PI*2;R.push([C.x+c.r*Math.cos(a),C.y+c.r*Math.sin(a)]);}
  return R;
}
function skRingDist(pt,rg){
  let m=1e18;
  for(let i=0;i<rg.length;i++){
    const a=rg[i],b=rg[(i+1)%rg.length],dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1e-18;
    let t=((pt[0]-a[0])*dx+(pt[1]-a[1])*dy)/L2;t=Math.max(0,Math.min(1,t));
    const d=Math.hypot(pt[0]-(a[0]+t*dx),pt[1]-(a[1]+t*dy));if(d<m)m=d;
  }
  return m;
}
function skRegBoundIn(b,pt){ // pt strictement dans l'anneau (frontière exclue)
  if(b.k==='circle')return Math.hypot(pt[0]-b.C.x,pt[1]-b.C.y)<b.r-1e-6;
  return pip(pt,b.ring)&&skRingDist(pt,b.ring)>1e-6;
}
function skRegHas(R,pt){return skRegBoundIn(R.K,pt)&&!R.hb.some(b=>skRegBoundIn(b,pt));}
function skRegions(sk,tr){
  // Toutes les zones fermées : [{K (anneau extérieur), hb (anneaux des trous), ring, area}]
  tr=tr||skLoopTrace(sk);
  const F=tr.faces||[];
  const conts=[],bounds=[];
  F.forEach((f,i)=>{
    if(f.area>0)conts.push({k:'face',i,ring:f.ring,area:f.area});
    else bounds.push({k:'face',i,ring:f.ring,area:-f.area}); // bord extérieur d'un groupe de traits
  });
  (tr.circles||[]).forEach(c=>{
    const ring=skRegCircleRing(sk,c);if(!ring)return;
    const b={k:'circle',c,C:sk.points[c.pc],r:c.r,ring,area:Math.PI*c.r*c.r};
    conts.push(b);bounds.push(b);
  });
  const regs=conts.map(K=>({K,hb:[],ring:K.ring,area:K.area}));
  bounds.forEach(b=>{
    // conteneur = la plus petite zone qui l'entoure strictement (jamais lui-même ni son jumeau)
    let best=null;
    regs.forEach(R=>{
      const K=R.K;
      if(K===b||!(K.area>b.area*(1+1e-9)+1e-12))return;
      if(best&&K.area>=best.K.area)return;
      if(b.ring.every(p=>skRegBoundIn(K,p)))best=R;
    });
    if(best){best.hb.push(b);best.area-=b.area;}
  });
  return regs.filter(R=>R.area>1e-6);
}
function skRegInner(R){
  // Point intérieur bien au large des bords (grille puis affinage) : ancre du choix
  let x0=1e18,y0=1e18,x1=-1e18,y1=-1e18;
  R.ring.forEach(p=>{x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);});
  if(!(x1>x0&&y1>y0))return null;
  const clear=pt=>{if(!skRegHas(R,pt))return -1;let d=R.K.k==='circle'?R.K.r-Math.hypot(pt[0]-R.K.C.x,pt[1]-R.K.C.y):skRingDist(pt,R.K.ring);
    R.hb.forEach(b=>{d=Math.min(d,b.k==='circle'?Math.hypot(pt[0]-b.C.x,pt[1]-b.C.y)-b.r:skRingDist(pt,b.ring));});return d;};
  let best=null,bd=0,N=32,sx=(x1-x0)/N,sy=(y1-y0)/N;
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){const pt=[x0+(i+0.5)*sx,y0+(j+0.5)*sy],d=clear(pt);if(d>bd){bd=d;best=pt;}}
  if(!best){ // zone très fine : centre d'un triangle de l'anneau
    const r=R.ring;for(let i=1;i+1<r.length;i++){const pt=[(r[0][0]+r[i][0]+r[i+1][0])/3,(r[0][1]+r[i][1]+r[i+1][1])/3];if(clear(pt)>0)return pt;}
    return null;
  }
  for(let k=0;k<3;k++){sx/=2;sy/=2;const c=best;
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){const pt=[c[0]+i*sx,c[1]+j*sy],d=clear(pt);if(d>bd){bd=d;best=pt;}}}
  return best;
}
function skRegionAt(regs,pt){
  let best=null;
  regs.forEach(R=>{if(skRegHas(R,pt)&&(!best||R.area<best.area))best=R;});
  return best;
}
function skTraceMatter(tr,sk,pt){
  // pt dans la matière de l'extrusion « toutes zones » (règle pair/impair de skLoopTrace)
  const F=tr.faces||[],P=sk.points||{};
  const inC=(c)=>{const C=P[c.pc];return !!C&&Math.hypot(pt[0]-C.x,pt[1]-C.y)<c.r;};
  if((tr.circlesOut||[]).some(inC))return true;
  return tr.solids.some((sol,si)=>{
    const f=F[sol.faces&&sol.faces[0]];if(!f||!pip(pt,f.ring))return false;
    if(sol.faces.slice(1).some(k=>F[k]&&pip(pt,F[k].ring)))return false;
    return !tr.circleHoles.some(ch=>ch.solid===si&&inC(ch.circle));
  });
}
function skTracePick(data,picks){
  // Traçage restreint aux zones choisies, au format de skLoopTrace (solids / circlesOut /
  // circleHoles). Une zone circulaire à trous est un solide {circle} (sans chaîne).
  const tr=skLoopTrace(data);
  if(!Array.isArray(picks)||!picks.length)return tr;
  const F=tr.faces||[],regs=skRegions(data,tr),chosen=[];
  picks.forEach(p=>{const R=Array.isArray(p)?skRegionAt(regs,p):null;if(R&&!chosen.includes(R))chosen.push(R);});
  const solids=[],circlesOut=[],circleHoles=[];
  chosen.forEach(R=>{
    if(R.K.k==='circle'&&!R.hb.length){circlesOut.push(R.K.c);return;}
    const si=solids.length;
    const holes=R.hb.filter(b=>b.k==='face').map(b=>F[b.i].chain);
    solids.push(R.K.k==='face'?{chain:F[R.K.i].chain,holes,area:R.K.area}:{circle:R.K.c,chain:null,holes,area:R.K.area});
    R.hb.filter(b=>b.k==='circle').forEach(b=>circleHoles.push({circle:b.c,solid:si}));
  });
  return Object.assign({},tr,{solids,circlesOut,circleHoles,picked:chosen.length,lost:picks.length-chosen.length});
}
/* ── zones d'une esquisse, avec cache (dessin à chaque image) ── */
const skRegCache=new Map();
function skRegionsCached(sk){
  const sig=JSON.stringify(sk.points||{})+'|'+JSON.stringify(sk.entities||[]);
  const c=skRegCache.get(sk.id);
  if(c&&c.sig===sig)return c;
  const tr=skLoopTrace(sk),regs=skRegions(sk,tr);
  regs.forEach(R=>{R.pt=skRegInner(R);R.inDef=!!R.pt&&skTraceMatter(tr,sk,R.pt);});
  const out={sig,tr,regs};
  if(skRegCache.size>40)skRegCache.clear();
  skRegCache.set(sk.id,out);return out;
}
function skRegChosen(f,regs){
  // zones prises par l'extrusion : choix explicite, sinon la matière par défaut
  if(Array.isArray(f.profiles)&&f.profiles.length){
    const s=new Set();f.profiles.forEach(p=>{const R=skRegionAt(regs,p);if(R)s.add(R);});return s;
  }
  return new Set(regs.filter(R=>R.inDef));
}
/* ── esquisse ouverte : zones fermées teintées (SVG) ── */
function skDrawRegions(sk){
  if(!sk||(sk.entities||[]).length>600)return;
  let C;try{C=skRegionsCached(sk);}catch(e){return;}
  const path=rg=>rg.map((p,i)=>{const q=w2s(p[0],p[1]);return(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1);}).join(' ')+' Z';
  C.regs.forEach(R=>{
    const d=[R.ring,...R.hb.map(b=>b.ring)].map(path).join(' ');
    skEl('path',{d,fill:'#64d2ff','fill-opacity':0.10,'fill-rule':'evenodd',stroke:'none','pointer-events':'none'});
  });
}
/* ── fenêtre de l'extrusion : zones sur le plan, survol, clic ── */
let extProf=null; // {key, group, regs, sk, fid, hover}
function extProfClear(){
  if(!extProf)return;
  try{scene.remove(extProf.group);extProf.group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});}catch(e){}
  extProf=null;
}
function extProfTick(f){
  // appelé à chaque image par extDynTick : zones affichées tant que la fenêtre est ouverte
  const busy=(typeof skEdit!=='undefined'&&skEdit)||(typeof asmMode!=='undefined'&&asmMode==='asm')||(typeof filMode!=='undefined'&&filMode)||(typeof filModeX!=='undefined'&&filModeX);
  if(!f||!extDyn||busy||f.visible===false){extProfClear();return;}
  const sk=doc.sketches.find(s=>s.id===f.sketchId);if(!sk){extProfClear();return;}
  let C;try{C=skRegionsCached(sk);}catch(e){extProfClear();return;}
  const hover=extProf&&extProf.fid===f.id?extProf.hover:-1;
  const B=sketchBasis(sk);
  const key=f.id+'|'+C.sig+'|'+JSON.stringify(f.profiles||null)+'|'+hover+'|'+B.o.toArray()+B.n.toArray()+B.u.toArray();
  if(extProf&&extProf.key===key)return;
  extProfClear();
  const chosen=skRegChosen(f,C.regs);
  const g=new THREE.Group();g.name='extProfiles';g.userData.noMirror=true;
  const m=new THREE.Matrix4().makeBasis(B.u,B.v,B.n);m.setPosition(B.o);
  g.matrixAutoUpdate=false;g.matrix.copy(m);
  C.regs.forEach((R,i)=>{
    const sel=chosen.has(R),hov=i===hover;
    const sh=new THREE.Shape(R.ring.map(p=>new THREE.Vector2(p[0],p[1])));
    R.hb.forEach(b=>sh.holes.push(new THREE.Path(b.ring.map(p=>new THREE.Vector2(p[0],p[1])))));
    const mat=new THREE.MeshBasicMaterial({color:sel?0x0a84ff:0x64d2ff,transparent:true,opacity:sel?(hov?0.6:0.42):(hov?0.32:0.08),
      depthTest:false,depthWrite:false,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(sh),mat);
    mesh.renderOrder=990;mesh.raycast=()=>{};mesh.userData.noMirror=true;g.add(mesh);
    [R.ring,...R.hb.map(b=>b.ring)].forEach(rg=>{
      const lg=new THREE.BufferGeometry().setFromPoints(rg.map(p=>new THREE.Vector3(p[0],p[1],0)));
      const ln=new THREE.LineLoop(lg,new THREE.LineBasicMaterial({color:sel?0x64d2ff:0x8e8e93,transparent:true,opacity:sel?0.95:0.6,depthTest:false}));
      ln.renderOrder=991;ln.raycast=()=>{};ln.userData.noMirror=true;g.add(ln);
    });
  });
  scene.add(g);
  extProf={key,group:g,regs:C.regs,sk,fid:f.id,hover};
}
function extProfAt(e){
  // zone sous la souris (rayon ∩ plan de l'esquisse) : {i, R, dist} ou null
  if(!extProf||!extProf.regs.length)return null;
  const r=renderer.domElement.getBoundingClientRect();
  rayc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
  const B=sketchBasis(extProf.sk),ro=rayc.ray.origin,d=rayc.ray.direction;
  const den=B.n.dot(d);if(Math.abs(den)<1e-6)return null; // plan vu par la tranche
  const t=B.n.dot(B.o.clone().sub(ro))/den;if(!(t>0))return null;
  const P=ro.clone().addScaledVector(d,t).sub(B.o),pt=[P.dot(B.u),P.dot(B.v)];
  let best=-1;
  extProf.regs.forEach((R,i)=>{if(skRegHas(R,pt)&&(best<0||R.area<extProf.regs[best].area))best=i;});
  return best<0?null:{i:best,R:extProf.regs[best],dist:t};
}
function extProfUsable(e,hit){
  // « jusqu'à la face » : un clic sur une face devant le plan reste un choix de face
  if(!hit)return false;
  if(!(typeof extUptoAuto==='function'&&extUptoAuto())&&!extPickFace)return true;
  const ms=bodies.filter(b=>b.visible&&b.mesh&&!b.ghost&&b.mesh.visible!==false).map(b=>b.mesh);
  const h=rayc.intersectObjects(ms,false)[0];
  return !h||hit.dist<=h.distance+1e-3;
}
function extProfHover(e){
  if(!extProf)return false;
  const f=extDynFeature();if(!f||f.id!==extProf.fid)return false;
  let hit=null;try{hit=extProfAt(e);}catch(err){}
  if(!extProfUsable(e,hit))hit=null;
  const i=hit?hit.i:-1;
  if(i!==extProf.hover){extProf.hover=i;extProf.key='';if(i<0)renderer.domElement.style.cursor='';} // redessin à l'image suivante
  if(hit)renderer.domElement.style.cursor='pointer';
  return !!hit;
}
function extProfClick(e){
  // un clic court sur une zone : ajoutée ou retirée de l'extrusion
  if(!extProf)return false;
  const f=extDynFeature();if(!f||f.id!==extProf.fid)return false;
  let hit=null;try{hit=extProfAt(e);}catch(err){}
  if(!extProfUsable(e,hit))return false;
  const regs=extProf.regs,R=hit.R;
  if(!R.pt){try{faceEl.textContent='Zone trop fine pour être choisie.';}catch(err){}return true;}
  const chosen=skRegChosen(f,regs);
  if(chosen.has(R)){
    if(chosen.size<=1){try{faceEl.textContent='Extrusion : il faut au moins une zone — choisissez-en une autre avant de retirer celle-ci.';}catch(err){}return true;}
    chosen.delete(R);
  }else chosen.add(R);
  const pts=regs.filter(x=>chosen.has(x)&&x.pt).map(x=>[+x.pt[0].toFixed(4),+x.pt[1].toFixed(4)]);
  extDynSet('zones de « '+f.name+' »',g=>{g.profiles=pts;});
  try{faceEl.textContent='Extrusion : '+pts.length+' zone'+(pts.length>1?'s':'')+' sur '+regs.length+'. Cliquez une zone pour l’ajouter ou la retirer.';}catch(err){}
  return true;
}
function extProfPanel(f){
  // ligne du panneau « Profil » : zones prises / disponibles, retour au choix automatique
  const w=document.createElement('div');w.className='pnl-btns';w.style.cssText='align-items:center;gap:6px;width:100%';
  const sk=doc.sketches.find(s=>s.id===f.sketchId);
  let C=null;try{C=sk?skRegionsCached(sk):null;}catch(e){}
  const n=C?C.regs.length:0;
  const s=document.createElement('span');s.className='pnl-note';
  if(!n)s.textContent='⚠ aucune zone fermée dans l’esquisse';
  else{
    const k=skRegChosen(f,C.regs).size,lost=Array.isArray(f.profiles)?f.profiles.filter(p=>!skRegionAt(C.regs,p)).length:0;
    s.textContent='▦ '+k+' zone'+(k>1?'s':'')+' sur '+n+(Array.isArray(f.profiles)&&f.profiles.length?'':' (auto)')+(lost?' — ⚠ '+lost+' zone'+(lost>1?'s':'')+' perdue'+(lost>1?'s':''):'');
    s.title='Cliquez une zone bleue dans la vue pour l’ajouter ou la retirer de cette extrusion.';
  }
  w.appendChild(s);
  if(Array.isArray(f.profiles)&&f.profiles.length){
    const b=document.createElement('button');b.className='mini';b.textContent='↺ Auto';
    b.title='Revenir au choix automatique : toute la matière de l’esquisse (trous compris)';
    b.onclick=()=>extDynSet('zones de « '+f.name+' »',g=>{delete g.profiles;});
    w.appendChild(b);
  }
  return w;
}
