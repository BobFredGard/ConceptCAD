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
/* V0.70.0 : l'aimant en DEUX MOITIÉS, coupées à mi-hauteur (h est toujours la cote le long du sens
   d'aimantation, même pour les pavés aimantés dans la longueur) : pôle sud vert (z de 0 à h/2),
   pôle nord rouge (z de h/2 à h). Arêtes EXTÉRIEURES arrondies R0,3 (réduit sur les tout petits
   aimants), aucune à la jonction des pôles (demande de Fred) : l'aimant entier arrondi, coupé en deux. */
const MAG_POLE_N=0xe0483c,MAG_POLE_S=0x2f9e4f,MAG_RND=0.3;
function magRound(m){
  const half=m.h/2,lat=m.s==='box'?Math.min(m.a,m.b)/2:m.s==='ring'?(m.d-m.di)/4:m.d/2;
  return +Math.min(MAG_RND,half*0.4,lat*0.4).toFixed(4);
}
function magHalfProf(m,z0,z1,k,sud){
  // profil de révolution d'une moitié (XZ) : seuls les coins de la face EXTÉRIEURE (bas du sud,
  // haut du nord) sont arrondis, au bord du disque et, pour l'anneau, au bord du trou ; jonction vive
  const R=m.d/2;
  if(m.s==='ring'){
    const r0=m.di/2;
    return sud?[[r0+k,z0,{c:[r0+k,z0+k]}],[R-k,z0],[R,z0+k,{c:[R-k,z0+k]}],[R,z1],[r0,z1],[r0,z0+k]]
      :[[r0,z0],[R,z0],[R,z1-k],[R-k,z1,{c:[R-k,z1-k]}],[r0+k,z1],[r0,z1-k,{c:[r0+k,z1-k]}]];
  }
  return sud?[[0,z0],[R-k,z0],[R,z0+k,{c:[R-k,z0+k]}],[R,z1],[0,z1]]
    :[[0,z0],[R,z0],[R,z1-k],[R-k,z1,{c:[R-k,z1-k]}],[0,z1]];
}
function magFillDoc(d,m){
  const k=magRound(m),h2=m.h/2;
  d.bodies=[{id:'b1',name:'Pôle sud',c:null,color:MAG_POLE_S},{id:'b2',name:'Pôle nord',c:null,color:MAG_POLE_N}];
  d.bodySeq=3;d.activeBody='b2';
  const F=(f,b)=>{f.id=uid(f.type==='revolve'?'rv':f.type==='fillet'?'fi':'ex');f.visible=true;f.body=b;d.features.push(f);return f;};
  [['b1','sud',0],['b2','nord',h2]].forEach(([b,nom,z0])=>{
    if(m.s==='box'){
      const s=stdSketch(d,'Contour pôle '+nom,'XY',z0),a=m.a/2,c=m.b/2;
      stdLoop(s,[[-a+k,-c],[a-k,-c],[a,-c+k,{c:[a-k,-c+k]}],[a,c-k],[a-k,c,{c:[a-k,c-k]}],[-a+k,c],[-a,c-k,{c:[-a+k,c-k]}],[-a,-c+k],[-a+k,-c,{c:[-a+k,-c+k]}]]);
      const e=F({type:'extrude',name:'Pôle '+nom,sketchId:s.id,distance:h2,op:'add',mid:false,upto:null},b);
      F({type:'fillet',name:'Congé R'+k+' (pôle '+nom+')',target:e.id,radius:k,corners:[],rims:{top:nom==='nord',bottom:nom==='sud'},rimTop:nom==='nord',rimBot:nom==='sud',radii:[]},b); // face extérieure seule
    }else{
      const s=stdSketch(d,'Profil pôle '+nom,'XZ',0);stdLoop(s,magHalfProf(m,z0,z0+h2,k,nom==='sud'));
      F({type:'revolve',name:'Pôle '+nom,sketchId:s.id,axis:{k:'sys',d:'Z'},angle:360,op:'add'},b);
    }
  });
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
/* V0.70.1 : plusieurs aimants à l'écran — dès que deux aimants au moins sont posés et qu'un a ses
   lignes affichées, les lignes sont celles du champ ADDITIONNÉ de tous les aimants visibles (y
   compris ceux dont les lignes sont masquées : leur champ compte). Repère de la scène ; recalcul
   quand un aimant bouge, allégé pendant le déplacement à la souris. */
function magNote(L,c,inst,ml){
  const m=magOfComp(c);if(!m)return;
  const id=inst.path.length?inst.path[inst.path.length-1]:null,o=id?asmOcc(id):null;
  L.push({m,F:inst.F,on:!!(o&&o.mag),key:c.doc.std.key,ml});
}
const magMultiCache=new Map();
function magMultiKey(M,fast){return (fast?'f':'n')+JSON.stringify(M.map(A=>[A.key,A.on?1:0,A.F.o,A.F.x,A.F.y,A.F.z]));}
function magMultiGeo(M,fast){
  const k=magMultiKey(M,fast);let g=magMultiCache.get(k);
  if(!g){
    g=magLineGeoMulti(M,{fast});magMultiCache.set(k,g);
    while(magMultiCache.size>6){const k0=magMultiCache.keys().next().value;magMultiCache.delete(k0);} // pas de dispose : une géométrie peut encore être affichée
  }
  return g;
}
function magMultiDraw(G,L,V){
  if(L.length<2||!L.some(A=>A.on))return;
  L.forEach(A=>{if(A.ml&&A.ml.parent)A.ml.parent.remove(A.ml);}); // les lignes de l'aimant seul ne valent plus
  const fast=typeof asmDrag!=='undefined'&&!!asmDrag;
  const M=L.map(A=>({m:A.m,F:A.F,on:A.on,key:A.key}));
  const grp=new THREE.Group();grp.name='magLinesMulti';grp.matrixAutoUpdate=false;grp.matrix.copy(asmMat4(V));
  const Ln=new THREE.LineSegments(magMultiGeo(M,fast),new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.9}));
  Ln.raycast=()=>{};Ln.renderOrder=6;grp.add(Ln);G.add(grp);
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
