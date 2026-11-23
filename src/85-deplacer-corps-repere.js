/* ---------- Déplacer un corps : repère manipulable (V0.99.61) ----------
   Demande de Fred : « un repère que l'on puisse positionner où l'on veut sur les points
   cardinaux du corps sélectionné, puis le déplacer suivant X Y Z (clic sur les flèches, en
   tirant dessus ou en y mettant une valeur), en tournant autour des axes X Y Z avec un outil
   circulaire, et en déplaçant un point vers un autre ».
   Le Déplacer sélectionné (hors saisie) montre un manipulateur au PIVOT :
     · 3 flèches X / Y / Z (axes de la pièce) : tirer = translation (pas 1 mm, Maj = libre),
       simple clic = case de saisie de la distance ;
     · 3 anneaux : tirer = rotation autour de l'axe passant par le pivot (pas 5°, Maj = libre),
       simple clic = case de saisie de l'angle ;
     · boule blanche au centre : clic = choisir où poser le repère — les 27 points cardinaux de
       la boîte du corps (centre, milieux des faces et des arêtes, coins), son centre de gravité,
       ou les points d'accroche d'une face cliquée.
   Pendant le geste, seul le maillage affiché bouge (aperçu immédiat) ; au relâcher, UNE étape
   est ajoutée (ou fusionnée avec la dernière si elle est de même nature : translation libre,
   ou rotation sur le même axe) puis le corps exact est rejoué.
   Le pivot est rangé dans f.piv en coordonnées du corps AVANT déplacement : il suit le corps.
   Sans f.piv, le pivot est le centre de gravité du corps déplacé. */
let bmGz=null;      // groupe du manipulateur (scène principale, rangé dans TRIADS)
let bmDrag=null;    // geste en cours {kind, ax, fid, O, a, t0|p0, x0, y0, moved, v, mesh}
let bmGzHover=null; // poignée survolée
const BM_COL=[0xff453a,0x30d158,0x0a84ff];
function bmGzFeat(){
  // Déplacer sélectionné, hors saisie et hors assemblage
  if(typeof sel==='undefined'||!sel||sel.kind!=='feature')return null;
  if(bmPick||(typeof asmMode!=='undefined'&&asmMode==='asm'))return null;
  const f=bmFeat(sel.id);
  return f&&f.type==='bmove'&&(doc.bodies||[]).some(b=>b.id===f.body)?f:null;
}
function bmInv(F,p){const d=asmV.sub(p,F.o);return [asmV.dot(F.x,d),asmV.dot(F.y,d),asmV.dot(F.z,d)];}
function bmBodyMesh(bid){
  const L=typeof bodies!=='undefined'?bodies:[];
  const b=L.find(x=>x&&x.kind==='body'&&x.bodyId===bid&&x.mesh)||L.find(x=>x&&x.bodyId===bid&&x.mesh);
  return b?b.mesh:null;
}
function bmCentreMemo(f){
  // centre de gravité du corps affiché, gardé tant que son maillage ne change pas
  const m=bmBodyMesh(f.body);
  if(f._pc&&f._pc.m===m&&f._pc.b===f.body)return f._pc.c;
  const c=bmBodyCentre(f.body);
  try{Object.defineProperty(f,'_pc',{value:{m,b:f.body,c},writable:true,configurable:true,enumerable:false});}catch(e){}
  return c;
}
function bmPivot(f){
  const F=bmFrame(f);
  if(Array.isArray(f.piv)&&f.piv.length===3&&f.piv.every(isFinite))return bmPt(F,f.piv);
  return bmCentreMemo(f)||F.o.slice();
}
function bmBodyBox(bid){
  // Boîte du corps affiché : maillage, à défaut solide exact → [min, max] ou null
  const m=bmBodyMesh(bid);
  try{if(m){const B=new THREE.Box3().setFromObject(m);if(!B.isEmpty()&&isFinite(B.min.x))return [[B.min.x,B.min.y,B.min.z],[B.max.x,B.max.y,B.max.z]];}}catch(e){}
  const L=typeof bodies!=='undefined'?bodies:[],bd=L.find(x=>x&&x.bodyId===bid&&x.shape);if(!bd)return null;
  let box=null;
  try{box=new occt.Bnd_Box_1();occt.BRepBndLib.Add(bd.shape,box,true);if(box.IsVoid())return null;return [occXyz(box.CornerMin()),occXyz(box.CornerMax())];}
  catch(e){return null;}finally{try{if(box)box.delete();}catch(e){}}
}
function bmCardinals(bid){
  // Points cardinaux de la boîte du corps affiché : centre, milieux des 6 faces, des 12 arêtes, 8 coins
  const X=bmBodyBox(bid);if(!X)return [];
  const lo=X[0],hi=X[1],out=[[],[],[],[]];
  [-1,0,1].forEach(i=>[-1,0,1].forEach(j=>[-1,0,1].forEach(k=>{
    const s=[i,j,k],p=s.map((v,n)=>v<0?lo[n]:v>0?hi[n]:(lo[n]+hi[n])/2);
    const lab=s.map((v,n)=>v?'XYZ'[n]+(v>0?'+':'−'):'').filter(Boolean).join(' ');
    const n=s.filter(v=>v).length;
    out[n].push({name:['Centre de la boîte','Milieu de la face ','Milieu de l’arête ','Coin '][n]+lab,p,card:n});
  })));
  const g=bmBodyCentre(bid);
  return out[0].concat(g?[{name:'Centre de gravité',p:g,card:0}]:[],out[1],out[2],out[3]);
}
/* ── dessin ── */
function bmGzDispose(){
  if(!bmGz)return;
  try{if(bmGz.parent)bmGz.parent.remove(bmGz);}catch(e){}
  const i=TRIADS.indexOf(bmGz);if(i>=0)TRIADS.splice(i,1);
  bmGz.traverse(m=>{try{if(m.geometry)m.geometry.dispose();if(m.material)m.material.dispose();}catch(e){}});
  bmGz=null;bmGzHover=null;
}
function bmGzDraw(){
  bmGzDispose();
  const f=bmGzFeat();if(!f||typeof scene==='undefined'||!scene)return;
  const O=bmPivot(f);if(!O)return;
  const g=new THREE.Group();g.name='bmGizmo';g.userData.px=110;g.userData.fid=f.id;
  const mat=c=>new THREE.MeshBasicMaterial({color:c,depthTest:false,transparent:true,opacity:0.95});
  const ghost=()=>new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
  const vis=m=>{m.renderOrder=999;m.raycast=()=>{};return m;};
  [0,1,2].forEach(i=>{
    const d=new THREE.Vector3(...BM_AX['XYZ'[i]]);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d);
    const sh=vis(new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.8,8),mat(BM_COL[i])));sh.quaternion.copy(q);sh.position.copy(d.clone().multiplyScalar(0.4));
    const tp=vis(new THREE.Mesh(new THREE.ConeGeometry(0.07,0.2,14),mat(BM_COL[i])));tp.quaternion.copy(q);tp.position.copy(d.clone().multiplyScalar(0.9));
    const hh=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.95,8),ghost());
    hh.quaternion.copy(q);hh.position.copy(d.clone().multiplyScalar(0.6));hh.userData.gz={kind:'move',ax:i,vis:[sh,tp],col:BM_COL[i]};
    const rq=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),d);
    const ring=vis(new THREE.Mesh(new THREE.TorusGeometry(0.62,0.014,8,64),mat(BM_COL[i])));ring.quaternion.copy(rq);
    const rh=new THREE.Mesh(new THREE.TorusGeometry(0.62,0.06,6,48),ghost());rh.quaternion.copy(rq);rh.userData.gz={kind:'rot',ax:i,vis:[ring],col:BM_COL[i]};
    g.add(sh,tp,hh,ring,rh);
  });
  const ball=vis(new THREE.Mesh(new THREE.SphereGeometry(0.075,16,12),mat(0xffffff)));
  const bh=new THREE.Mesh(new THREE.SphereGeometry(0.13,10,8),ghost());bh.userData.gz={kind:'piv',vis:[ball],col:0xffffff};
  g.add(ball,bh);
  g.position.set(O[0],O[1],O[2]);
  try{const s=g.userData.px*triadWpp(g.position);if(isFinite(s)&&s>0)g.scale.setScalar(s);}catch(e){}
  scene.add(g);TRIADS.push(g);bmGz=g;
  try{viewWake();}catch(e){}
}
function bmGzHit(e){
  if(!bmGz||!renderer||e.target!==renderer.domElement)return null;
  const ray=asmRay(e);rayc.ray.copy(ray);
  bmGz.updateMatrixWorld(true);
  const hs=[];bmGz.traverse(m=>{if(m.isMesh&&m.userData.gz)hs.push(m);});
  const h=rayc.intersectObjects(hs,false);
  if(!h.length)return null;
  // la boule centrale passe devant les flèches et les anneaux qui la traversent
  const pv=h.find(x=>x.object.userData.gz.kind==='piv');
  // là où deux poignées se croisent : celle déjà en surbrillance (ce que l'utilisateur voit)
  const hv=bmGzHover&&h.find(x=>x.object.userData.gz===bmGzHover);
  return (pv||hv||h[0]).object.userData.gz;
}
function bmGzLight(gz){
  if(gz===bmGzHover)return;
  const paint=(z,on)=>{if(z)(z.vis||[]).forEach(m=>{try{m.material.color.setHex(on?0xffd60a:z.col);}catch(e){}});};
  paint(bmGzHover,false);bmGzHover=gz;paint(gz,true);
  try{viewWake();}catch(e){}
}
/* ── geste ── */
function bmPreview(D){
  // Aperçu : seul le maillage du corps bouge (le corps exact est rejoué au relâcher)
  const m=D.mesh;if(!m)return;
  const M=new THREE.Matrix4();
  if(D.kind==='move')M.makeTranslation(D.a.x*D.v,D.a.y*D.v,D.a.z*D.v);
  else{
    const R=new THREE.Matrix4().makeRotationAxis(D.a,D.v*Math.PI/180);
    M.makeTranslation(D.O.x,D.O.y,D.O.z).multiply(R).multiply(new THREE.Matrix4().makeTranslation(-D.O.x,-D.O.y,-D.O.z));
  }
  m.matrixAutoUpdate=false;m.matrix.copy(M);m.matrixWorldNeedsUpdate=true;
  if(bmGz&&D.kind==='move')bmGz.position.set(D.O.x+D.a.x*D.v,D.O.y+D.a.y*D.v,D.O.z+D.a.z*D.v);
  try{viewWake();}catch(e){}
}
function bmPreviewReset(D){
  const m=D&&D.mesh;
  if(m){m.matrix.identity();m.position.set(0,0,0);m.quaternion.identity();m.scale.set(1,1,1);m.matrixAutoUpdate=true;m.updateMatrix();m.matrixWorldNeedsUpdate=true;}
  if(D&&D.eo){D.eo.visible=D.eoVis;}
}
function bmGzDown(e){
  // Capture (document) : avant OrbitControls — un clic sur le manipulateur ne fait pas tourner la vue
  if(!bmGz||bmDrag||e.button!==0||e.ctrlKey||e.metaKey)return;
  const f=bmGzFeat();if(!f||bmGz.userData.fid!==f.id)return;
  const gz=bmGzHit(e);if(!gz)return;
  e.preventDefault();e.stopPropagation();
  bmValClose();
  const P=bmPivot(f),O=new THREE.Vector3(P[0],P[1],P[2]);
  const D={kind:gz.kind,ax:gz.ax,fid:f.id,O,x0:e.clientX,y0:e.clientY,moved:false,v:0,mesh:null};
  if(gz.kind!=='piv'){
    D.a=new THREE.Vector3(...BM_AX['XYZ'[gz.ax]]);
    const ray=asmRay(e);
    if(gz.kind==='move')D.t0=asmAxisParam(ray,O,D.a);
    else{const p=asmPlaneHit(ray,O,D.a);D.p0=p?p.sub(O):null;}
    D.mesh=bmBodyMesh(f.body);
  }
  bmDrag=D;
  try{controls.enabled=false;}catch(err){}
  window.addEventListener('pointermove',bmGzMove,true);
  window.addEventListener('pointerup',bmGzUp,true);
  window.addEventListener('keydown',bmGzKey,true);
}
function bmGzMove(e){
  const D=bmDrag;if(!D)return;
  e.stopPropagation();
  if(D.kind==='piv')return;
  if(!D.moved&&Math.hypot(e.clientX-D.x0,e.clientY-D.y0)<4)return;
  const ray=asmRay(e),free=e.shiftKey;
  let v=0;
  if(D.kind==='move'){
    const t=asmAxisParam(ray,D.O,D.a);if(t==null||D.t0==null)return;
    v=t-D.t0;v=free?+v.toFixed(2):Math.round(v);
  }else{
    const p=asmPlaneHit(ray,D.O,D.a);if(!p||!D.p0)return;
    const w=p.sub(D.O);
    const deg=Math.atan2(D.a.dot(new THREE.Vector3().crossVectors(D.p0,w)),D.p0.dot(w))*180/Math.PI;
    v=free?+deg.toFixed(1):Math.round(deg/5)*5;
  }
  if(!D.moved){
    D.moved=true;
    // arêtes affichées : elles resteraient en place pendant l'aperçu — masquées le temps du geste
    try{const eo=scene.getObjectByName('edgeOverlay');if(eo){D.eo=eo;D.eoVis=eo.visible;eo.visible=false;}}catch(err){}
  }
  D.v=v;bmPreview(D);
  const ax='XYZ'[D.ax];
  try{faceEl.textContent=(D.kind==='move'?'Déplacer suivant '+ax+' : '+(v>=0?'+':'')+bmFmt(v,2)+' mm':'Tourner autour de '+ax+' : '+(v>=0?'+':'')+bmFmt(v,1)+'°')+' (Maj = libre, Échap = annuler)';}catch(err){}
}
function bmGzEnd(){
  window.removeEventListener('pointermove',bmGzMove,true);
  window.removeEventListener('pointerup',bmGzUp,true);
  window.removeEventListener('keydown',bmGzKey,true);
  try{controls.enabled=true;}catch(e){}
  const D=bmDrag;bmDrag=null;
  bmPreviewReset(D);
  return D;
}
function bmGzKey(e){
  if(e.key!=='Escape'||!bmDrag)return;
  e.preventDefault();e.stopPropagation();
  bmGzEnd();bmGzDraw();
  try{faceEl.textContent='Déplacer : geste annulé.';}catch(err){}
}
function bmGzUp(e){
  if(!bmDrag)return;
  e.stopPropagation(); // le relâcher ne sélectionne rien sous le manipulateur (90-10)
  const D=bmGzEnd(),f=bmFeat(D.fid);if(!f)return;
  if(D.kind==='piv'){if(Math.hypot(e.clientX-D.x0,e.clientY-D.y0)<6)bmPickStart(f,'pivot');return;}
  if(!D.moved){bmGzDraw();bmValOpen(f,D.kind,D.ax,e.clientX,e.clientY);return;}
  if(!D.v){bmGzDraw();return;}
  bmApply(f,D.kind,D.ax,D.v);
}
function bmGzHoverAt(e){
  if(!bmGz||bmDrag||bmPick||typeof renderer==='undefined'||!renderer)return;
  if(e.target!==renderer.domElement){bmGzLight(null);return;}
  const gz=bmGzHit(e);bmGzLight(gz);
  if(gz)setTimeout(()=>{try{renderer.domElement.style.cursor=bmGzHover?(bmGzHover.kind==='rot'?'grab':'pointer'):'';}catch(err){}},0);
}
/* ── étapes ── */
function bmNear(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.every((x,i)=>Math.abs(x-b[i])<1e-6);}
function bmTurn(d){let v=((d%360)+540)%360-180;if(v===-180)v=180;return +v.toFixed(6);}
function bmApply(f,kind,ax,v){
  // Une valeur du repère → une étape (fusionnée avec la dernière si elle est de même nature)
  v=+v;if(!isFinite(v)||!v){bmGzDraw();return;}
  const k='XYZ'[ax],S=f.steps||[],last=S[S.length-1];
  if(kind==='move'){
    bmChange(f,'déplacement suivant '+k,()=>{
      if(last&&last.k==='t'){const w=(last.v||[0,0,0]).map(x=>+x||0);w[ax]=+(w[ax]+v).toFixed(9);last.v=w;}
      else f.steps=S.concat([{k:'t',v:[0,1,2].map(j=>j===ax?v:0)}]);
    });
    try{faceEl.textContent='Déplacé de '+(v>=0?'+':'')+bmFmt(v,2)+' mm suivant '+k+'.';}catch(e){}
  }else{
    const O=bmPivot(f),d=BM_AX[k];
    bmChange(f,'rotation autour de '+k,()=>{
      if(last&&last.k==='r'&&bmNear(last.o,O)&&bmNear(last.d,d))last.deg=bmTurn((+last.deg||0)+v);
      else f.steps=S.concat([{k:'r',o:O.slice(),d:d.slice(),deg:bmTurn(v),name:k+' (repère)'}]);
    });
    try{faceEl.textContent='Tourné de '+(v>=0?'+':'')+bmFmt(v,1)+'° autour de '+k+'.';}catch(e){}
  }
}
function bmSetPivot(f,it){
  // Repère posé sur un point : rangé en coordonnées du corps avant déplacement (il suit le corps)
  const F=bmFrame(f),p=bmInv(F,it.p).map(x=>+x.toFixed(9));
  docPushUndo('position du repère (« '+f.name+' »)');
  f.piv=p;f.pivName=it.name||'';
  markDirty();renderTree();renderProps();
  try{faceEl.textContent='Repère posé sur « '+(it.name||'point')+' » — tirez une flèche ou un anneau, ou cliquez-les pour une valeur.';}catch(e){}
}
/* ── case de saisie (simple clic sur une flèche ou un anneau) ── */
let bmVal=null;
function bmValClose(){if(bmVal){try{bmVal.remove();}catch(e){}bmVal=null;}}
function bmValOpen(f,kind,ax,x,y){
  bmValClose();
  const k='XYZ'[ax],d=document.createElement('div');
  d.className='bmValBox';
  d.style.cssText='position:fixed;z-index:9999;left:'+(x+14)+'px;top:'+(y+10)+'px;display:flex;gap:6px;align-items:center;padding:6px 8px;border-radius:8px;'+
    'background:var(--panel,#1c1c1e);color:var(--text,#f2f2f7);border:1px solid '+('#'+BM_COL[ax].toString(16).padStart(6,'0'))+';box-shadow:0 4px 16px rgba(0,0,0,.35);font-size:12px';
  const l=document.createElement('span');l.textContent=kind==='move'?'Déplacer suivant '+k+' (mm)':'Tourner autour de '+k+' (°)';
  const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.value='0';i.style.cssText='width:64px;font-size:12px;padding:1px 4px';
  const ok=document.createElement('button');ok.className='mini';ok.textContent='OK';
  const go=()=>{const v=parseFloat(String(i.value).replace(',','.'));bmValClose();if(isFinite(v)&&v)bmApply(f,kind,ax,v);};
  i.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();go();}else if(e.key==='Escape'){e.preventDefault();bmValClose();}});
  ok.onclick=go;
  d.append(l,i,ok);document.body.appendChild(d);
  // reste à l'écran
  try{const r=d.getBoundingClientRect();if(r.right>innerWidth-4)d.style.left=Math.max(4,x-r.width-14)+'px';if(r.bottom>innerHeight-4)d.style.top=Math.max(4,y-r.height-10)+'px';}catch(e){}
  bmVal=d;
  setTimeout(()=>{try{i.focus();i.select();}catch(e){}},0);
  try{faceEl.textContent=(kind==='move'?'Distance suivant ':'Angle autour de ')+k+' : tapez la valeur puis Entrée (Échap = fermer).';}catch(e){}
}
// un clic ailleurs ferme la case
try{document.addEventListener('pointerdown',e=>{if(bmVal&&!bmVal.contains(e.target))bmValClose();},true);}catch(e){}
/* ── panneau : section « Repère » ── */
function bmRepereProps(p,f,mk,btn){
  p.appendChild(mk('div','pnl-h','✛ Repère'));
  const P=bmPivot(f);
  p.appendChild(mk('div','pnl-note','Posé sur '+(f.piv&&f.pivName?'« '+f.pivName+' »':'le centre de gravité')+' '+(P?bmP(P):'')));
  const b=mk('div','pnl-btns');
  b.appendChild(btn('📍 Placer le repère…','Sur un point cardinal du corps (centre, faces, arêtes, coins) ou un point d’une face — aussi : clic sur la boule blanche du repère',()=>bmPickStart(f,'pivot')));
  if(f.piv)b.appendChild(btn('↺ Centre de gravité','Remettre le repère au centre de gravité du corps',()=>{docPushUndo('position du repère (« '+f.name+' »)');delete f.piv;delete f.pivName;markDirty();renderTree();renderProps();}));
  p.appendChild(b);
  const tbl=mk('div');tbl.style.cssText='display:grid;grid-template-columns:auto 1fr 1fr;gap:4px 6px;align-items:center;margin:4px 0';
  tbl.appendChild(mk('span'));tbl.appendChild(mk('span','pnl-note','Déplacer (mm)'));tbl.appendChild(mk('span','pnl-note','Tourner (°)'));
  const cell=(kind,ax)=>{
    const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.placeholder='0';i.style.width='100%';i.style.boxSizing='border-box';
    i.className='bmRepIn';i.dataset.kind=kind;i.dataset.ax=ax;
    i.title=(kind==='move'?'Distance suivant ':'Angle autour de ')+'XYZ'[ax]+' — Entrée = appliquer';
    i.addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();const v=parseFloat(String(i.value).replace(',','.'));if(isFinite(v)&&v)bmApply(f,kind,ax,v);});
    return i;
  };
  [0,1,2].forEach(ax=>{
    const l=mk('span',null,'XYZ'[ax]);l.style.cssText='font-weight:700;color:#'+BM_COL[ax].toString(16).padStart(6,'0');
    tbl.appendChild(l);tbl.appendChild(cell('move',ax));tbl.appendChild(cell('rot',ax));
  });
  p.appendChild(tbl);
  p.appendChild(mk('div','pnl-note','Dans la vue : tirez une flèche (pas 1 mm) ou un anneau (pas 5°), Maj = libre ; un simple clic dessus = taper une valeur.'));
}
try{document.addEventListener('pointerdown',bmGzDown,true);}catch(e){} // tests VM : document simplifié
try{window.addEventListener('pointermove',bmGzHoverAt,true);}catch(e){}
