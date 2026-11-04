/* ---------- aimants permanents : bibliothèque et lignes de champ à l'écran (V0.57.0) ----------
   Onglet « Aimants » de la fenêtre des normalisés (48-composants-normalises) : l'aimant arrive
   comme une pièce normalisée (composant, occurrences, « Modifier… », sauvegarde). doc.std.mag
   garde sa géométrie et ses caractéristiques : le fichier reste juste si le catalogue change.
   Clic droit sur un aimant posé (90-10) : afficher / masquer ses lignes de champ, lire ses
   caractéristiques. L'affichage est propre à l'occurrence (occ.mag, enregistré). */
const MAG_SHAPES=[['cyl','Disque / cylindre'],['cube','Cube'],['box','Pavé'],['ring','Anneau']];
const MAG_MATS={NdFeB:{nom:'NdFeB (néodyme)',rho:7.5},Ferrite:{nom:'Ferrite',rho:4.9}};
function magRow(code){return MAG_CAT.find(r=>r.code===code)||null;}
function magRows(st){return MAG_CAT.filter(r=>r.s===st.shape&&(!st.grade||st.grade==='*'||r.grade===st.grade));}
function magGradeOpts(st){
  const g=[...new Set(MAG_CAT.filter(r=>r.s===st.shape).map(r=>r.grade))].sort();
  return [['*','Toutes']].concat(g.map(x=>[x,x]));
}
function magDims(r){
  return r.s==='cyl'?'Ø'+stdF(r.d)+' × '+stdF(r.h):
    r.s==='ring'?'Ø'+stdF(r.d)+'/'+stdF(r.di)+' × '+stdF(r.h):
    stdF(r.a)+' × '+stdF(r.b)+' × '+stdF(r.h);
}
function magArtDef(st){
  // article proposé : le premier d'au moins 10 mm, plus parlant qu'un aimant de 1 mm
  const R=magRows(st),big=R.find(r=>(r.d||r.a)>=10);
  return big?big.code:(R[0]?R[0].code:'');
}
function magArtOpts(st){return magRows(st).map(r=>[r.code,magDims(r)+' mm · '+r.grade+' — '+r.code]);}
function magBr(r){return (r.br[0]+r.br[1])/2;}
function magGeom(r){
  const m={s:r.s==='cube'?'box':r.s,Br:magBr(r),h:r.h};
  if(m.s==='box'){m.a=r.a;m.b=r.b;}else{m.d=r.d;if(m.s==='ring')m.di=r.di;}
  return m;
}
function magSpec(st){
  const r=magRow(st.art);
  if(!r)throw new Error('Article introuvable dans le catalogue.');
  const g=magGeom(r),M=MAG_MATS[r.mat]||MAG_MATS.NdFeB;
  const sp={key:'MAG:'+r.code,name:'Aimant '+r.code,norm:r.src,desig:r.code,reach:0,
    info:magInfo(r,g),mag:Object.assign({},g,{code:r.code,src:r.src,grade:r.grade,mat:r.mat,br:r.br,hcb:r.hcb,hcj:r.hcj,bh:r.bh,tmax:r.tmax,force:r.force,dirTxt:r.dirTxt}),
    mat:{name:M.nom,rho:M.rho},color:r.mat==='Ferrite'?0x3c3d40:0xc3c6ca};
  if(g.s==='box')sp.ops=[{k:'mbox',a:g.a,b:g.b,h:g.h}];
  else{const r0=g.s==='ring'?g.di/2:0,r1=g.d/2;sp.prof=[[r0,0],[r1,0],[r1,g.h],[r0,g.h]];}
  return sp;
}
function magInfo(r,g){
  const F=(v,n)=>stdF(+(+v).toFixed(n));
  return r.mat+' '+r.grade+' · Br '+F(r.br[0],3)+' à '+F(r.br[1],3)+' T · '+r.dirTxt+
    ' · force '+(r.force||'non indiquée')+' · '+(r.tmax!=null?r.tmax+' °C maxi':'température non indiquée')+
    ' · champ calculé '+(g.s==='ring'?'sur la face nord, à mi-largeur : ':'au centre de la face nord : ')+Math.round(Math.abs(magPoleField(g))*1000)+' mT';
}
function magNorm(v){
  // Relecture du fichier : fiche d'aimant complète et saine, sinon rien (le fichier peut être ancien ou altéré)
  if(!v||typeof v!=='object'||!['cyl','ring','box'].includes(v.s))return null;
  const pos=x=>typeof x==='number'&&isFinite(x)&&x>0;
  if(!pos(v.Br)||!pos(v.h))return null;
  if(v.s==='box'?!(pos(v.a)&&pos(v.b)):!pos(v.d))return null;
  if(v.s==='ring'&&!(pos(v.di)&&v.di<v.d))return null;
  const pair=x=>Array.isArray(x)&&x.length===2&&x.every(pos)?[x[0],x[1]]:null,txt=x=>typeof x==='string'?x:'';
  const m={s:v.s,Br:v.Br,h:v.h,code:txt(v.code),src:txt(v.src),grade:txt(v.grade),mat:txt(v.mat),br:pair(v.br),hcb:pair(v.hcb),hcj:pos(v.hcj)?v.hcj:null,bh:pair(v.bh),tmax:typeof v.tmax==='number'&&isFinite(v.tmax)?v.tmax:null,force:typeof v.force==='string'?v.force:null,dirTxt:txt(v.dirTxt)};
  if(v.s==='box'){m.a=v.a;m.b=v.b;}else{m.d=v.d;if(v.s==='ring')m.di=v.di;}
  return m;
}
function magDlg(){stdDlg(null,'magnet');}
/* ── lignes de champ à l'écran ── */
const magGeoCache=new Map(); // lignes par article : partagées par les occurrences, jamais refaites
function magOfComp(c){const s=c&&c.doc&&c.doc.std;return s&&s.mag&&s.mag.s?s.mag:null;}
function magGeoFor(m,key){
  let g=magGeoCache.get(key);
  if(!g){g=magLineGeo(m);magGeoCache.set(key,g);}
  return g;
}
function magLinesFor(c,path){
  // Groupe à ajouter à l'occurrence (repère de la pièce), ou null si ses lignes sont masquées
  const m=magOfComp(c),id=path&&path.length?path[path.length-1]:null,o=id?asmOcc(id):null;
  if(!m||!o||!o.mag)return null;
  const G=new THREE.Group();G.name='magLines';
  const L=new THREE.LineSegments(magGeoFor(m,c.doc.std.key),new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.9}));
  L.raycast=()=>{};L.renderOrder=6;G.add(L);
  return G;
}
function magToggle(id){
  const o=asmOcc(id);if(!o)return false;
  asmPush((o.mag?'masquer':'afficher')+' les lignes de champ de « '+o.name+' »');
  if(o.mag)delete o.mag;else o.mag=true;
  dirty=true;
  try{autosave();}catch(e){}
  if(asmMode==='asm'){try{asmDraw();}catch(e){}}else{try{asmCtxDraw();}catch(e){}}
  asmNotify();
  return !!o.mag;
}
function magCtxClose(){const p=document.getElementById('magCtx');if(p)p.remove();document.removeEventListener('pointerdown',magCtxOut,true);document.removeEventListener('keydown',magCtxKey,true);}
function magCtxOut(e){const p=document.getElementById('magCtx');if(p&&!p.contains(e.target))magCtxClose();}
function magCtxKey(e){if(e.key==='Escape'){e.stopPropagation();magCtxClose();}}
function magCtxRows(m){
  const F=(v,n)=>stdF(+(+v).toFixed(n)),pair=(a,u,n)=>a?F(a[0],n)+' à '+F(a[1],n)+' '+u:'non indiqué';
  return [
    ['Article',m.code+' ('+m.src+')'],
    ['Matière',m.mat+' '+m.grade],
    ['Rémanence Br',pair(m.br,'T',3)],
    ['Coercivité HcB',pair(m.hcb,'kA/m',0)],
    ['Coercivité HcJ',m.hcj?'≥ '+F(m.hcj,0)+' kA/m':'non indiquée'],
    ['Énergie (BH)max',pair(m.bh,'kJ/m³',0)],
    ['Force d’adhérence',m.force||'non indiquée'],
    ['Température maxi',m.tmax!=null?m.tmax+' °C':'non indiquée'],
    ['Aimantation',m.dirTxt||'axiale'],
    ['Champ face nord',Math.round(Math.abs(magPoleField(m))*1000)+' mT (calculé)']
  ];
}
function magCtx(x,y,t,c){
  // t={occ,bid,comp} (rdLookAsmHit)
  magCtxClose();
  const m=magOfComp(c),o=t.occ?asmOcc(t.occ):null;if(!m||!o)return;
  const p=document.createElement('div');p.id='magCtx';
  p.style.cssText='position:fixed;z-index:5000;min-width:230px;max-width:340px;background:rgba(28,28,32,.96);color:#eee;border:1px solid var(--border);border-radius:9px;padding:5px;box-shadow:0 12px 32px rgba(0,0,0,.6);font-size:.82rem';
  p.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();});
  const head=document.createElement('div');head.textContent=o.name;head.style.cssText='padding:5px 10px;font-weight:600;opacity:.8';p.appendChild(head);
  const btn=(txt,fn,id)=>{const b=document.createElement('button');b.textContent=txt;if(id)b.id=id;b.style.cssText='display:block;width:100%;text-align:left;background:none;border:none;padding:7px 10px;font-size:.82rem;border-radius:6px;color:inherit;cursor:pointer';b.onclick=fn;p.appendChild(b);return b;};
  btn(o.mag?'🧲 Masquer les lignes de champ':'🧲 Afficher les lignes de champ',()=>{magCtxClose();magToggle(o.id);},'magCtxLines');
  const info=document.createElement('div');
  btn('ℹ️ Caractéristiques',()=>{
    if(info.childElementCount){info.innerHTML='';return;}
    magCtxRows(m).forEach(([k,v])=>{const d=document.createElement('div');d.style.cssText='display:flex;justify-content:space-between;gap:12px;padding:2px 10px';const a=document.createElement('span');a.textContent=k;a.style.opacity='.65';const b=document.createElement('span');b.textContent=v;b.style.textAlign='right';d.append(a,b);info.appendChild(d);});
    const n=document.createElement('div');n.textContent='Champ calculé pour l’aimant seul dans l’air, à Br moyen. L’acier voisin et la température n’y entrent pas.';n.style.cssText='padding:6px 10px;opacity:.65;line-height:1.35';info.appendChild(n);
    try{ctxPlace(p,x,y);}catch(e){}
  },'magCtxInfo');
  p.appendChild(info);
  btn('🎨 Apparence…',()=>{magCtxClose();try{rdLookPop(x,y,t);}catch(e){}});
  document.body.appendChild(p);
  try{ctxPlace(p,x,y);}catch(e){p.style.left=x+'px';p.style.top=y+'px';}
  setTimeout(()=>{document.addEventListener('pointerdown',magCtxOut,true);document.addEventListener('keydown',magCtxKey,true);},0);
}
