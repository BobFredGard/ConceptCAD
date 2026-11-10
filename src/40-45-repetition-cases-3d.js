/* ✂ CASES DANS LA VUE 3D (V0.81.0) : sous chaque copie d'une répétition, une case à cocher pour
   l'enlever — la même chose que la liste « Exemplaires à enlever » du panneau (repSkipFill), mais
   posée sur la pièce : on voit tout de suite quelle copie tombe mal. Montrées quand une répétition
   est sélectionnée (édition) ou en cours de création (repMode) ; cochée = copie enlevée (rp.skip),
   elle reste à sa place pour pouvoir la remettre. Survol = la copie en bleu (repHoverShow).
   Positions : boîte des sources (géométries de l'aperçu, repPreviewSources) transformée par la
   matrice de chaque exemplaire (repXformsK, enlevés compris), projetée à l'écran à chaque image ;
   la case se pose sous le point le plus bas de la boîte à l'écran. */
let rs3={el:null,sig:'',boxes:null,t:0,items:new Map()};
// V0.85.1 : cases montrées SEULEMENT si on les demande (option « Cases dans la vue 3D » du panneau,
// retenue d'une séance à l'autre) — Fred : « pas la peine de faire voir les cases à cocher à chaque fois ».
let rs3On=false;
try{rs3On=localStorage.getItem('minifusion_repCases3d')==='on';}catch(e){}
function rs3Set(on){rs3On=!!on;try{localStorage.setItem('minifusion_repCases3d',rs3On?'on':'off');}catch(e){}if(!rs3On){rs3Hide();repHoverRemove();}}
function rs3Ctx(){
  // → {cfg, ids, edit} | null
  if(!rs3On)return null;
  const busy=(typeof skEdit!=='undefined'&&skEdit)||(typeof asmMode!=='undefined'&&asmMode==='asm');
  if(busy)return null;
  if(typeof repMode!=='undefined'&&repMode){
    if(repMode.type==='mir')return null;
    return {cfg:repMode,ids:()=>((repMode.feats)||[]).filter(id=>repCanFeature(id)&&repAmont(id,null)),edit:false};
  }
  if(typeof sel==='undefined'||!sel||sel.kind!=='feature')return null;
  const f=(doc.features||[]).find(x=>x&&x.id===sel.id);
  if(!f||f.type!=='repeat'||f.mode==='mir'||f.visible===false)return null;
  return {cfg:f,ids:()=>(f.base||[]).slice(),edit:true};
}
function rs3Hide(){if(rs3.el)rs3.el.style.display='none';}
function rs3Box(){
  if(rs3.el)return rs3.el;
  const d=document.createElement('div');d.className='repSkip3d';
  d.style.cssText='position:fixed;left:0;top:0;width:0;height:0;z-index:35;display:none';
  document.body.appendChild(d);rs3.el=d;return d;
}
function rs3Toggle(ctx,k,on){
  const S=repSkipSet(ctx.cfg);if(on)S.add(k);else S.delete(k);
  const v=S.size?[...S]:null;
  repHoverRemove();
  if(ctx.edit){
    const f=ctx.cfg;docPushUndo('exemplaires enlevés de « '+f.name+' »');
    if(v)f.skip=v;else delete f.skip;
    repGenChildren(f);markDirty();rebuild();renderTree();renderProps();refreshParts();
  }else{
    if(v)repMode.skip=v;else delete repMode.skip;
    // la liste du panneau suit (sans être refaite : ses cases changent sur place)
    try{document.querySelectorAll('#props .repSkipList input').forEach(c=>{c.checked=!!v&&v.indexOf(c.dataset.k)>=0;});
      const cp=document.querySelector('#props .repSkipCpt'),n=v?v.length:0,L=repCellKeys(repMode).length;
      if(cp)cp.textContent=n?n+' enlevé(s) sur '+L:'aucun';}catch(e){}
    repPreviewUpdate();
  }
  try{faceEl.textContent=on?'✂ Exemplaire enlevé — décochez sa case pour le remettre.':'Exemplaire remis.';}catch(e){}
}
function rs3Boxes(ctx){
  // Boîtes monde de chaque exemplaire : [{k, label, tip, pts:[8 coins]}] (sources sans géométrie → [])
  let srcs=[];try{srcs=repPreviewSources(ctx.ids());}catch(e){srcs=[];}
  if(!srcs.length)return [];
  const bb=new THREE.Box3(),tmp=new THREE.Box3();
  srcs.forEach(it=>{try{if(!it.geo.boundingBox)it.geo.computeBoundingBox();tmp.copy(it.geo.boundingBox);if(it.mw)tmp.applyMatrix4(it.mw);bb.union(tmp);}catch(e){}});
  if(bb.isEmpty())return [];
  const C=[];for(let i=0;i<8;i++)C.push(new THREE.Vector3(i&1?bb.max.x:bb.min.x,i&2?bb.max.y:bb.min.y,i&4?bb.max.z:bb.min.z));
  const lab=new Map(repCellKeys(ctx.cfg).map(x=>[x.k,x]));
  const M=new THREE.Matrix4();
  return repXformsK(ctx.cfg,REPEAT_MAX,true).map(X=>{M.fromArray(X.M);const L=lab.get(X.k)||{label:X.k,tip:''};
    return {k:X.k,label:L.label,tip:L.tip,pts:C.map(p=>p.clone().applyMatrix4(M))};});
}
function rs3Tick(){
  const ctx=rs3Ctx();
  if(!ctx||typeof camera==='undefined'||!camera||typeof renderer==='undefined'){rs3Hide();return;}
  // positions recalculées quand les réglages changent (et au plus toutes les 0,5 s : pièce rejouée)
  const c=ctx.cfg,now=performance.now();
  const sig=[ctx.edit?c.id:'new',c.mode||c.type,c.copies,c.dist,c.angle,c.axis,JSON.stringify(c.dir||0),c.lin2,c.axis2,JSON.stringify(c.dir2||0),c.copies2,c.dist2,JSON.stringify(c.path||0),c.pspace,c.orient,c.rev,ctx.ids().join(',')].join('|');
  if(sig!==rs3.sig||now-rs3.t>500||!rs3.boxes){
    const keysChanged=sig!==rs3.sig;
    rs3.sig=sig;rs3.t=now;
    try{rs3.boxes=rs3Boxes(ctx);}catch(e){rs3.boxes=[];}
    if(keysChanged){rs3Box().innerHTML='';rs3.items.clear();}
  }
  const B=rs3.boxes;if(!B||!B.length){rs3Hide();return;}
  const box=rs3Box();box.style.display='';
  const r=renderer.domElement.getBoundingClientRect(),sk=repSkipSet(c),v=new THREE.Vector3(),seen=new Set();
  B.forEach(b=>{
    let it=rs3.items.get(b.k);
    if(!it){
      const w=document.createElement('label');w.className='repSkip3dCase';w.title=(b.tip||'')+' — cochez pour l’enlever, décochez pour le remettre';
      w.style.cssText='position:fixed;transform:translate(-50%,0);display:flex;align-items:center;gap:3px;padding:1px 5px 1px 3px;border-radius:6px;font-size:11px;cursor:pointer;white-space:nowrap;background:var(--panel, #1e1e22);border:1px solid var(--line, #3a3a40);box-shadow:0 1px 6px rgba(0,0,0,.35);color:var(--fg, #ddd);user-select:none';
      const i=document.createElement('input');i.type='checkbox';i.dataset.k=b.k;i.style.margin='0';
      const n=document.createElement('span');n.textContent=b.label;
      w.appendChild(i);w.appendChild(n);
      i.onchange=()=>{const x=rs3Ctx();if(x)rs3Toggle(x,b.k,i.checked);};
      ['pointerdown','mousedown','click','dblclick','wheel'].forEach(t=>w.addEventListener(t,e=>e.stopPropagation()));
      w.onmouseenter=()=>{const x=rs3Ctx();if(x)try{repHoverShow(x.cfg,b.k,x.ids());}catch(e){}};
      w.onmouseleave=()=>repHoverRemove();
      box.appendChild(w);it={w,i,n};rs3.items.set(b.k,it);
    }
    seen.add(b.k);
    // point le plus bas de la boîte à l'écran, centré en largeur
    let xmin=1e9,xmax=-1e9,ymax=-1e9,ok=true;
    b.pts.forEach(p=>{v.copy(p).project(camera);if(v.z>1||v.z<-1)ok=false;const x=(v.x+1)/2*r.width,y=(1-v.y)/2*r.height;if(x<xmin)xmin=x;if(x>xmax)xmax=x;if(y>ymax)ymax=y;});
    const X=r.left+(xmin+xmax)/2,Y=r.top+ymax+4;
    if(!ok||X<r.left||X>r.right||Y<r.top||Y>r.bottom-14){it.w.style.display='none';return;}
    it.w.style.display='flex';it.w.style.left=Math.round(X)+'px';it.w.style.top=Math.round(Y)+'px';
    const on=sk.has(b.k);if(it.i.checked!==on)it.i.checked=on;
    it.w.style.borderColor=on?'#ff5a4e':'';it.n.style.textDecoration=on?'line-through':'';
  });
  rs3.items.forEach((it,k)=>{if(!seen.has(k)){it.w.remove();rs3.items.delete(k);}});
}
