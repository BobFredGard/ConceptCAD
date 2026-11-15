// V0.99.14 — Export STL : fenêtre de finesse (Grossier / Normal / Fin / Personnalisé) avec le
// nombre de triangles, le poids du fichier, le nombre de côtés d'un cercle et un APERÇU 3D du
// maillage exact qui sera écrit (triangles visibles). Avant : le STL reprenait le maillage
// d'affichage, dont la finesse suit la taille de la pièce (cercles en polygones visibles).
// Le maillage est fait sur une COPIE du solide : les triangles laissés sur le solide par
// l'affichage (facettes gardées face par face, boîte du solide) ne sont jamais touchés.
const STL_PRESETS=[
  ['grossier','Grossier','Fichier léger, facettes visibles',{lin:0.1,ang:20}],
  ['normal','Normal','Bon compromis pour l’impression 3D',{lin:0.03,ang:10}],
  ['fin','Fin','Cercles et congés très lisses, fichier lourd',{lin:0.01,ang:5}],
  ['perso','Personnalisé','Tolérance et angle au choix',null]
];
let stlChoix='normal',stlPerso={lin:0.02,ang:8};
try{const s=JSON.parse(localStorage.getItem('minifusion_stlFinesse')||'null');
  if(s&&STL_PRESETS.some(p=>p[0]===s.c))stlChoix=s.c;
  if(s&&s.p&&s.p.lin>0&&s.p.ang>0)stlPerso={lin:+s.p.lin,ang:+s.p.ang};}catch(e){}
function stlFinesse(c){const p=STL_PRESETS.find(x=>x[0]===c);return p&&p[3]?p[3]:stlPerso;}
function stlFmt(v,d){return Number(v).toLocaleString('fr',{maximumFractionDigits:d==null?3:d});}
function stlCotesCercle(r,D){
  // côtés d'un cercle de rayon r : le pas respecte l'écart (corde) ET l'angle, comme le mailleur
  const a=D.ang*Math.PI/180;let b=a;
  if(D.lin<r)b=Math.min(a,2*Math.acos(1-D.lin/r));
  return Math.max(3,Math.ceil(2*Math.PI/b));
}
function stlShapeOf(b){
  if(b.kind==='import'){try{const e=importGeom.get(b.id);if(e&&e.brep)return e.brep;}catch(e){}return null;}
  return b.shape||null;
}
function stlMaillage(D){
  // → {parts:[{name,pos:Float32Array (repère monde)}], tris, approx:[noms des corps sans solide exact]}
  const vis=bodies.filter(b=>b.visible&&!b.ghost&&b.mesh);
  const parts=[],approx=[];let tris=0;
  const v=new THREE.Vector3();
  for(const b of vis){
    let raw=null;
    const sh=occHas()?stlShapeOf(b):null;
    if(sh){
      let cp=null,cb=null;
      try{
        cb=new occt.BRepBuilderAPI_Copy_2(sh,true,false);cp=cb.Shape();
        try{occt.BRepTools.Clean(cp,true);}catch(e){try{occt.BRepTools.Clean(cp);}catch(e2){}}
        raw=occTriPos(cp,D.lin,D.ang*Math.PI/180,false).pos;
      }catch(e){raw=null;}
      finally{try{cp&&cp.delete();}catch(e){}try{cb&&cb.delete();}catch(e){}}
    }
    b.mesh.updateMatrixWorld(true);
    const mw=b.mesh.matrixWorld;
    let pos;
    if(raw&&raw.length){
      pos=new Float32Array(raw.length);
      for(let i=0;i<raw.length;i+=3){v.set(raw[i],raw[i+1],raw[i+2]).applyMatrix4(mw);pos[i]=v.x;pos[i+1]=v.y;pos[i+2]=v.z;}
    }else{
      // pas de solide exact (maillage importé, pièce d'un autre composant) : maillage affiché
      approx.push(String(b.name||'corps').replace(/ · .*$/,''));
      const g=b.mesh.geometry,p=g.attributes.position,idx=g.index,n=idx?idx.count:p.count;
      pos=new Float32Array(n*3);
      for(let i=0;i<n;i++){v.fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(mw);pos[i*3]=v.x;pos[i*3+1]=v.y;pos[i*3+2]=v.z;}
    }
    tris+=pos.length/9;
    parts.push({name:b.name,pos});
  }
  return {parts,tris,approx};
}
function stlEcrire(M){
  const buf=new ArrayBuffer(84+M.tris*50),dv=new DataView(buf);
  const hd='ConceptCAD STL';for(let i=0;i<hd.length;i++)dv.setUint8(i,hd.charCodeAt(i));
  dv.setUint32(80,M.tris,true);let off=84;
  for(const P of M.parts){const p=P.pos;
    for(let i=0;i<p.length;i+=9){
      const e1x=p[i+3]-p[i],e1y=p[i+4]-p[i+1],e1z=p[i+5]-p[i+2],e2x=p[i+6]-p[i],e2y=p[i+7]-p[i+1],e2z=p[i+8]-p[i+2];
      let nx=e1y*e2z-e1z*e2y,ny=e1z*e2x-e1x*e2z,nz=e1x*e2y-e1y*e2x;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
      dv.setFloat32(off,nx,true);dv.setFloat32(off+4,ny,true);dv.setFloat32(off+8,nz,true);
      for(let k=0;k<9;k++)dv.setFloat32(off+12+k*4,p[i+k],true);
      dv.setUint16(off+48,0,true);off+=50;
    }}
  return buf;
}
function stlPoids(tris){const o=84+tris*50;return o<1048576?stlFmt(o/1024,0)+' Ko':stlFmt(o/1048576,1)+' Mo';}
const STL_FIL_MAX=1500000; // au-delà, l'aperçu ne trace plus les arêtes des triangles (trop lourd)
function stlExportOpen(){
  const vis=bodies.filter(b=>b.visible&&!b.ghost);
  if(!vis.length){alert('Rien à exporter (que des outils de découpe ?).');return;}
  let ov=document.getElementById('stlDlg');if(ov)ov.remove();
  ov=document.createElement('div');ov.id='stlDlg';
  ov.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center';
  const box=document.createElement('div');
  box.style.cssText='background:#1c1c20;color:#e8e8ea;border:1px solid #3a3a40;border-radius:10px;padding:14px 16px;width:880px;max-width:96vw;max-height:94vh;overflow:auto;font-size:13px;box-shadow:0 14px 40px rgba(0,0,0,.6);display:flex;flex-wrap:wrap;gap:14px';
  ov.appendChild(box);
  const gauche=document.createElement('div');gauche.style.cssText='flex:1 1 440px;min-width:280px;display:flex;flex-direction:column;gap:6px';
  const droite=document.createElement('div');droite.style.cssText='flex:0 1 330px;min-width:260px;display:flex;flex-direction:column;gap:8px';
  box.appendChild(gauche);box.appendChild(droite);
  gauche.innerHTML='<b style="font-size:15px">Export STL — aperçu du fichier</b>';
  const vue=document.createElement('div');vue.style.cssText='position:relative;width:100%;height:420px;max-height:60vh;background:#101012;border:1px solid #3a3a40;border-radius:8px;overflow:hidden';
  const canvas=document.createElement('canvas');canvas.style.cssText='width:100%;height:100%;display:block';vue.appendChild(canvas);
  const attente=document.createElement('div');attente.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(16,16,18,.6);font-size:14px';attente.textContent='Calcul des triangles…';vue.appendChild(attente);
  gauche.appendChild(vue);
  const aide=document.createElement('div');aide.style.cssText='opacity:.6;font-size:12px';
  aide.textContent='Glisser : tourner · molette : zoomer sur un trou ou un congé · clic droit : déplacer. Ce qui est affiché est exactement ce qui sera écrit.';
  gauche.appendChild(aide);
  // --- choix de la finesse
  const tt=document.createElement('div');tt.style.cssText='opacity:.7';tt.textContent='Finesse du maillage :';droite.appendChild(tt);
  const btns={};
  STL_PRESETS.forEach(([k,lab,sub,D])=>{
    const b=document.createElement('button');b.dataset.k=k;
    b.style.cssText='display:block;width:100%;text-align:left;padding:7px 10px;border-radius:7px;cursor:pointer;color:#e8e8ea;background:#101012;border:1px solid #3a3a40';
    b.innerHTML='<b>'+lab+'</b>'+(D?' <span style="opacity:.6;font-size:12px">'+stlFmt(D.lin)+' mm · '+D.ang+'°</span>':'')+'<div style="opacity:.7;font-size:12px;margin-top:2px">'+sub+'</div>';
    b.onclick=()=>{stlChoix=k;maj();};
    btns[k]=b;droite.appendChild(b);
  });
  const perso=document.createElement('div');perso.style.cssText='display:grid;grid-template-columns:auto 90px;gap:6px 8px;align-items:center;padding:4px 2px';
  perso.innerHTML='<label title="Distance maximale entre un triangle et la vraie surface">Écart max (mm)</label><input type="number" min="0.001" step="0.005">'
    +'<label title="Angle maximal entre deux facettes voisines d’une surface courbe">Angle max (°)</label><input type="number" min="0.5" max="45" step="0.5">';
  const [inLin,inAng]=perso.querySelectorAll('input');
  [inLin,inAng].forEach(i=>{i.style.cssText='width:100%;background:#101012;color:#e8e8ea;border:1px solid #3a3a40;border-radius:5px;padding:3px 5px';
    i.onchange=()=>{const l=+inLin.value,a=+inAng.value;
      if(l>0)stlPerso.lin=Math.max(0.001,l);if(a>0)stlPerso.ang=Math.min(45,Math.max(0.5,a));stlChoix='perso';maj();};});
  droite.appendChild(perso);
  const info=document.createElement('div');info.style.cssText='background:#101012;border:1px solid #3a3a40;border-radius:7px;padding:8px 10px;line-height:1.55';
  droite.appendChild(info);
  const fil=document.createElement('label');fil.style.cssText='display:flex;gap:8px;align-items:center;cursor:pointer';
  fil.innerHTML='<input type="checkbox" checked><span>Afficher les triangles</span>';
  const filIn=fil.querySelector('input');droite.appendChild(fil);
  const bas=document.createElement('div');bas.style.cssText='display:flex;gap:8px;justify-content:flex-end;margin-top:auto;padding-top:6px';
  const an=document.createElement('button');an.textContent='Annuler';an.style.cssText='padding:5px 14px;border-radius:6px;cursor:pointer';
  const ok=document.createElement('button');ok.textContent='Exporter le STL';ok.style.cssText='padding:5px 14px;border-radius:6px;cursor:pointer;background:#2f6fe0;color:#fff;border:1px solid #4a8cff;font-weight:600';
  bas.appendChild(an);bas.appendChild(ok);droite.appendChild(bas);
  document.body.appendChild(ov);
  // --- vue 3D de l'aperçu
  let r=null;
  try{r=new THREE.WebGLRenderer({canvas,antialias:true});r.setPixelRatio(Math.min(2,window.devicePixelRatio||1));}catch(e){r=null;}
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x101012);
  scene.add(new THREE.HemisphereLight(0xffffff,0x60646c,2.2));
  const dl=new THREE.DirectionalLight(0xffffff,2.2);scene.add(dl);
  const cam=new THREE.PerspectiveCamera(35,1,0.1,100000);cam.up.set(0,0,1);
  let ctl=null;
  if(r){ctl=new THREE.OrbitControls(cam,canvas);ctl.enableDamping=false;ctl.zoomSpeed=zoomInv?-1:1;ctl.zoomToCursor=true;
    if(ctl.mouseButtons&&THREE.MOUSE){ctl.mouseButtons.LEFT=THREE.MOUSE.ROTATE;ctl.mouseButtons.MIDDLE=THREE.MOUSE.ROTATE;ctl.mouseButtons.RIGHT=THREE.MOUSE.PAN;}
    ctl.addEventListener('change',()=>dessine());}
  else{canvas.remove();attente.textContent='Aperçu indisponible (WebGL refusé) — les chiffres restent justes.';}
  const grp=new THREE.Group();scene.add(grp);
  const matS=new THREE.MeshStandardMaterial({color:0xc4ccd8,metalness:0,roughness:.7,flatShading:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const matL=new THREE.LineBasicMaterial({color:0x1f3f7a,transparent:true,opacity:.8});
  let cadre=false;
  function taille(){if(!r)return;const w=vue.clientWidth||400,h=vue.clientHeight||300;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
  function dessine(){if(!r)return;dl.position.copy(cam.position).add(new THREE.Vector3(0,0,cam.position.distanceTo(ctl.target)*0.5));r.render(scene,cam);}
  function vider(){grp.children.slice().forEach(o=>{grp.remove(o);try{o.geometry.dispose();}catch(e){}});}
  function cadrer(){
    const bx=new THREE.Box3().setFromObject(grp);if(bx.isEmpty())return;
    const c=bx.getCenter(new THREE.Vector3()),R=Math.max(1e-3,bx.getSize(new THREE.Vector3()).length()/2);
    // même direction que la vue principale
    let dir=new THREE.Vector3(1,-1,0.8);
    try{dir=camera.position.clone().sub(controls.target);if(dir.lengthSq()<1e-12)dir.set(1,-1,0.8);}catch(e){}
    dir.normalize();const d=R/Math.sin(cam.fov*Math.PI/360)*1.05;
    cam.position.copy(c).addScaledVector(dir,d);cam.near=Math.max(0.01,d/1000);cam.far=d*20;cam.updateProjectionMatrix();
    ctl.target.copy(c);ctl.update();
  }
  const memo=new Map();let M=null,jeton=0;
  function montre(){
    vider();if(!M||!r)return;
    for(const P of M.parts){
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P.pos,3));g.computeVertexNormals();
      grp.add(new THREE.Mesh(g,matS));
      if(filIn.checked&&M.tris<=STL_FIL_MAX)grp.add(new THREE.LineSegments(new THREE.WireframeGeometry(g),matL));
    }
    if(!cadre){cadrer();cadre=true;}
    dessine();
  }
  function maj(){
    try{localStorage.setItem('minifusion_stlFinesse',JSON.stringify({c:stlChoix,p:stlPerso}));}catch(e){}
    Object.entries(btns).forEach(([k,b])=>{const on=k===stlChoix;b.style.background=on?'#24324a':'#101012';b.style.borderColor=on?'#4a8cff':'#3a3a40';});
    const D=stlFinesse(stlChoix);
    inLin.value=String(D.lin);inAng.value=String(D.ang);
    perso.style.opacity=stlChoix==='perso'?'1':'.55';
    const cle=D.lin+'|'+D.ang,mon=++jeton;
    ok.disabled=true;attente.style.display='flex';
    info.innerHTML='<span style="opacity:.7">Calcul…</span>';
    setTimeout(()=>{
      if(mon!==jeton||!ov.isConnected)return;
      let R=memo.get(cle);
      if(!R){try{R=stlMaillage(D);}catch(e){info.textContent='Maillage impossible : '+(e.message||e);attente.style.display='none';return;}memo.set(cle,R);}
      M=R;
      const cer=[5,10,50].map(d=>'Ø'+d+' → <b>'+stlCotesCercle(d/2,D)+'</b>').join(' · ');
      info.innerHTML='<div><b style="font-size:16px">'+stlFmt(M.tris,0)+'</b> triangles · <b>'+stlPoids(M.tris)+'</b></div>'
        +'<div style="opacity:.8">Écart max à la vraie forme : '+stlFmt(D.lin)+' mm</div>'
        +'<div style="opacity:.8">Côtés d’un cercle : '+cer+'</div>'
        +(M.approx.length?'<div style="color:#ff9f0a;margin-top:4px">Sans forme exacte, maillage affiché repris : '+M.approx.join(', ')+'</div>':'')
        +(filIn.checked&&M.tris>STL_FIL_MAX?'<div style="opacity:.6;margin-top:4px">Trop de triangles pour tracer leurs arêtes dans l’aperçu.</div>':'');
      montre();attente.style.display='none';ok.disabled=false;
    },30);
  }
  filIn.onchange=()=>montre();
  const fin=()=>{
    document.removeEventListener('keydown',kd,true);window.removeEventListener('resize',rs);
    vider();try{matS.dispose();matL.dispose();}catch(e){}
    try{ctl&&ctl.dispose();}catch(e){}try{if(r){r.dispose();r.forceContextLoss();}}catch(e){}
    ov.remove();
  };
  const kd=(e)=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();fin();}
    else if(e.key==='Enter'&&!ok.disabled&&e.target.tagName!=='INPUT'){e.stopPropagation();e.preventDefault();ok.click();}};
  const rs=()=>{taille();dessine();};
  an.onclick=fin;
  ov.onclick=(e)=>{if(e.target===ov)fin();};
  ok.onclick=()=>{
    if(!M)return;
    const blob=new Blob([stlEcrire(M)],{type:'model/stl'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(doc.name||'piece')+'.stl';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);
    try{faceEl.textContent='STL exporté : '+stlFmt(M.tris,0)+' triangles ('+stlPoids(M.tris)+', écart '+stlFmt(stlFinesse(stlChoix).lin)+' mm).';}catch(e){}
    fin();
  };
  document.addEventListener('keydown',kd,true);window.addEventListener('resize',rs);
  requestAnimationFrame(()=>{taille();maj();});
}
