/* ---------- clic long : choisir parmi ce qui est sous le clic (comme Fusion) ----------
   Quand plusieurs éléments se chevauchent (droite sur un cercle, point au bout d'une ligne, face
   cachée derrière une autre), un APPUI LONG (0,5 s sans bouger) ouvre une petite liste de tout ce
   qui se trouve sous le curseur. Survoler une ligne de la liste (ou les flèches ↑ ↓) allume
   l'élément ; un clic sur la ligne ou Entrée le sélectionne ; Échap ou un clic ailleurs ferme.
   - Esquisse (outil Sélection) : points, traits (lignes, cercles, arcs, splines, points de
     construction, textes) et cotes.
   - 3D : faces (même cachées, de l'avant vers l'arrière) et arêtes. Le choix est REJOUÉ comme un
     clic ordinaire (wirePick._up) avec l'élément imposé (mfPickForce, 90-10) : il marche donc aussi
     dans les fonctions qui attendent une face ou une arête (congé, perçage, coque, dépouille…).
   - Esquisse, outil Projeter (V0.99.81) : arêtes de la pièce, arêtes des AUTRES PIÈCES de
     l'assemblage et traits des autres esquisses (projectEdgesAt, 50-esquisse-1) ; le choix est
     projeté comme au clic (skProjeterPr, 60). Le clic ordinaire projette au relâcher.
   Souris et stylet seulement : au doigt, l'appui long reste le menu contextuel (99-mobile). */
const CHOIX_DELAI=500, CHOIX_BOUGE=5;

/* ----- la liste ----- */
let choixMenu=null; // {el, items, i, cb}
function choixMenuOuvert(){return !!choixMenu;}
(function choixCss(){
  try{
    const st=document.createElement('style');
    st.textContent='#mfChoixSous{position:fixed;z-index:5200;min-width:220px;max-width:420px;max-height:calc(100vh - 12px);overflow-y:auto;'+
      'background:rgba(28,28,32,.97);border:1px solid var(--border);border-radius:9px;padding:5px;box-shadow:0 12px 32px rgba(0,0,0,.6);font-size:.82rem;user-select:none}'+
      '#mfChoixSous .mfcT{padding:4px 10px 6px;font-size:.72rem;opacity:.7;border-bottom:1px solid var(--border);margin-bottom:3px}'+
      '#mfChoixSous .mfcL{display:flex;gap:8px;align-items:center;padding:6px 10px;border-radius:6px;cursor:pointer;white-space:nowrap}'+
      '#mfChoixSous .mfcL.on{background:var(--primary)}'+
      '#mfChoixSous .mfcI{width:16px;text-align:center;flex:none}'+
      '#mfChoixSous .mfcC{opacity:.6;font-size:.74rem}';
    (document.head||document.documentElement).appendChild(st);
  }catch(e){}
})();
/* items : [{ico, txt, note}] ; cb : {hover(i), choose(i), cancel()} */
function choixMenuOuvrir(x,y,titre,items,cb){
  choixMenuFermer(true);
  const el=document.createElement('div');el.id='mfChoixSous';
  const t=document.createElement('div');t.className='mfcT';t.textContent=titre;el.appendChild(t);
  const rows=items.map((it,i)=>{
    const r=document.createElement('div');r.className='mfcL';
    const ic=document.createElement('span');ic.className='mfcI';ic.textContent=it.ico||'•';r.appendChild(ic);
    const tx=document.createElement('span');tx.textContent=it.txt;r.appendChild(tx);
    if(it.note){const c=document.createElement('span');c.className='mfcC';c.textContent=it.note;r.appendChild(c);}
    r.addEventListener('pointerenter',()=>choixMenuActive(i));
    r.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();});
    r.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();choixMenuValider(i);});
    el.appendChild(r);return r;
  });
  el.addEventListener('contextmenu',ev=>{ev.preventDefault();choixMenuFermer();});
  document.body.appendChild(el);
  choixMenu={el,rows,items,i:-1,cb};
  try{ctxPlace(el,x+8,y+8);}catch(e){el.style.left=(x+8)+'px';el.style.top=(y+8)+'px';}
  choixMenuActive(0);
}
function choixMenuActive(i){
  const M=choixMenu;if(!M||i<0||i>=M.items.length||i===M.i)return;
  M.i=i;M.rows.forEach((r,k)=>r.classList.toggle('on',k===i));
  try{M.rows[i].scrollIntoView({block:'nearest'});}catch(e){}
  try{M.cb.hover&&M.cb.hover(i);}catch(e){}
}
function choixMenuValider(i){
  const M=choixMenu;if(!M)return;
  choixMenu=null;try{M.el.remove();}catch(e){}
  try{M.cb.choose&&M.cb.choose(i==null?M.i:i);}catch(e){try{console.warn('choix sous le clic',e);}catch(e2){}}
}
function choixMenuFermer(silencieux){
  const M=choixMenu;if(!M)return;
  choixMenu=null;try{M.el.remove();}catch(e){}
  if(!silencieux){try{M.cb.cancel&&M.cb.cancel();}catch(e){}}
}
window.addEventListener('keydown',e=>{
  if(!choixMenu)return;
  const k=e.key;
  if(k==='ArrowDown'||k==='ArrowUp'){const n=choixMenu.items.length;choixMenuActive((choixMenu.i+(k==='ArrowDown'?1:n-1))%n);}
  else if(k==='Enter')choixMenuValider();
  else if(k==='Escape')choixMenuFermer();
  else return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
},true);
window.addEventListener('pointerdown',e=>{if(choixMenu&&!choixMenu.el.contains(e.target))choixMenuFermer();},true);
window.addEventListener('wheel',e=>{if(choixMenu&&!choixMenu.el.contains(e.target))choixMenuFermer();},true);

/* ----- appui long : minuterie commune ----- */
function choixAppui(e,quand){
  // → objet {annuler()} ; quand() est appelé après CHOIX_DELAI si la souris n'a pas bougé
  const x0=e.clientX,y0=e.clientY;let tm=null;
  const fin=()=>{clearTimeout(tm);tm=null;window.removeEventListener('pointermove',mv,true);window.removeEventListener('pointerup',fin,true);window.removeEventListener('pointercancel',fin,true);};
  const mv=ev=>{if(Math.hypot(ev.clientX-x0,ev.clientY-y0)>CHOIX_BOUGE)fin();};
  window.addEventListener('pointermove',mv,true);window.addEventListener('pointerup',fin,true);window.addEventListener('pointercancel',fin,true);
  tm=setTimeout(()=>{fin();quand();},CHOIX_DELAI);
  return {annuler:fin};
}
const choixSouris=e=>e&&e.button===0&&e.pointerType!=='touch';

/* ===================== ESQUISSE ===================== */
let skChoixAvant=null,skChoixMinut=null;
function skChoixListe(sk,wx,wy,px,py){
  const out=[],P=sk.points||{},ents=sk.entities||[];
  const tolP=SK_PT,tolE=SK_PICK*1.25;
  // cote (étiquette sous le clic)
  try{const dl=hitDimLabel(sk,px,py);if(dl){const d=dimById(sk,dl);
    out.push({d:-1,sel:{kind:'dim',id:dl},ico:'↔',txt:'Cote',note:d&&d.value!=null?String(+(+d.value).toFixed(3)):''});}}catch(e){}
  // points
  Object.keys(skPts(sk)).forEach(pid=>{
    const p=P[pid];if(!p||p.txt)return;const d=Math.hypot(p.x-wx,p.y-wy);if(d>tolP)return;
    let txt='Point';
    if(pid===SK_ORIGIN)txt='Origine';
    else{const own=ents.filter(e=>!e.txt&&skEntPids(e).indexOf(pid)>=0);
      if(own.some(e=>e.pc===pid))txt='Centre';
      else if(own.some(e=>e.t==='cpoint'))txt=null; // le point de construction est listé comme trait
      else if(own.length)txt='Extrémité';}
    if(txt)out.push({d,sel:{kind:'point',pid},ico:'•',txt,note:'('+(+p.x.toFixed(2))+' ; '+(+p.y.toFixed(2))+')'});
  });
  // traits
  const txtVus=new Set();
  ents.forEach(e=>{
    let d=1e9;
    if(e.t==='line'){const A=P[e.p1],B=P[e.p2];if(A&&B)d=distSeg(wx,wy,A,B);}
    else if(e.t==='circle'){const C=P[e.pc];if(C)d=Math.abs(Math.hypot(wx-C.x,wy-C.y)-e.r);}
    else if(e.t==='arc'){const C=P[e.pc];if(C){const an=arcAngles(sk,e);const dR=Math.abs(Math.hypot(wx-C.x,wy-C.y)-e.r);d=(an&&angInArc(Math.atan2(wy-C.y,wx-C.x),an.a1,an.a2))?dR:1e9;}}
    else if(e.t==='cpoint'){const Q=P[e.p];if(Q)d=Math.hypot(wx-Q.x,wy-Q.y);}
    else if(e.t==='spline'){try{const pl=skSplinePoly(sk,e);if(pl)d=skPolyDist(wx,wy,pl);}catch(err){}}
    if(!(d<=tolE))return;
    if(e.txt){if(txtVus.has(e.txt))return;txtVus.add(e.txt);out.push({d,sel:{kind:'ent',id:e.id},ico:'T',txt:'Texte'});return;}
    let ico='╱',txt='Ligne',note='';
    if(e.t==='line'){note='L '+(+lineLen(sk,e).toFixed(2));}
    else if(e.t==='circle'){ico='◯';txt='Cercle';note='Ø '+(+(2*e.r).toFixed(2));}
    else if(e.t==='arc'){ico='◠';txt='Arc';note='R '+(+(+e.r).toFixed(2));}
    else if(e.t==='spline'){ico='∿';txt='Spline';}
    else if(e.t==='cpoint'){ico='✕';txt=e.hole?'Centre de perçage':'Point de construction';}
    if(e.ref)note=(note?note+' · ':'')+'projetée';
    else if(e.construction&&e.t!=='cpoint')note=(note?note+' · ':'')+'construction';
    out.push({d:d+tolP,sel:{kind:'ent',id:e.id},ico,txt,note}); // à égalité, le point passe avant le trait qui le porte
  });
  out.sort((a,b)=>a.d-b.d);
  return out;
}
function skChoixAppliquer(sel,ajout){
  if(ajout&&skChoixAvant){skSel=skChoixAvant.sel;skSelX=skChoixAvant.selX.slice();
    const deja=s=>[skSel].concat(skSelX).some(q=>q&&q.kind===s.kind&&q.id===s.id&&q.pid===s.pid);
    if(!deja(sel)){if(skSel)skSelX.push(sel);else skSel=sel;}}
  else{skSel=sel;skSelX=[];}
}
// Capture : la sélection d'avant le clic (rendue telle quelle si la liste est fermée sans choix)
svg.addEventListener('pointerdown',e=>{
  if(choixMenu)choixMenuFermer();
  skChoixAvant={sel:skSel,selX:(skSelX||[]).slice()};
},true);
// Après le gestionnaire de l'esquisse (60) : il a déjà sélectionné / armé un glisser
svg.addEventListener('pointerdown',e=>{
  if(skChoixMinut){skChoixMinut.annuler();skChoixMinut=null;}
  if(!skEdit||skTool!=='select'||!choixSouris(e)||skDimEditInp)return;
  const sk=skEdit,ev=skEv(e),cx=e.clientX,cy=e.clientY,ajout=skMulti(e);
  const r0=svg.getBoundingClientRect(),[wx,wy]=evXY(ev),px=ev.clientX-r0.left,py=ev.clientY-r0.top;
  skChoixMinut=choixAppui(e,()=>{
    skChoixMinut=null;
    if(skEdit!==sk||skTool!=='select')return;
    if((skDrag&&skDragMoved)||(skDragEnt&&skDragEnt.pushed)||(skDimDrag&&skDimDrag.pushed))return; // déjà en train de glisser
    const L=skChoixListe(sk,wx,wy,px,py);
    if(L.length<2)return; // un seul élément : le clic ordinaire suffit
    // l'appui devient un choix : plus de glisser ni de boîte au relâcher
    skDrag=null;skDragFrom=null;skDragSnap=null;skDragEnt=null;skDragWalk=null;skDimDrag=null;skBox=null;skSnapMk=null;
    const avant=skChoixAvant;
    choixMenuOuvrir(cx,cy,'Sous le clic — '+L.length+' éléments',L,{
      hover:i=>{skChoixAppliquer(L[i].sel,ajout);drawSketch2D();},
      choose:i=>{skChoixAppliquer(L[i].sel,ajout);renderSkPanel();drawSketch2D();
        skStatus('Sélection : '+L[i].txt+(L[i].note?' '+L[i].note:'')+'.');},
      cancel:()=>{if(skEdit===sk&&avant){skSel=avant.sel;skSelX=avant.selX.slice();renderSkPanel();drawSketch2D();}}
    });
  });
});

/* ===================== ESQUISSE : outil Projeter ===================== */
let skProjChoixMinut=null;
function skProjChoixListe(sk,wx,wy){
  // lignes de la liste : forme, cote, d'où elle vient (pièce, autre pièce, esquisse), écart au plan
  const f=v=>String(+(+v).toFixed(2)).replace('.',',');
  return projectEdgesAt(sk,wx,wy).map(c=>{
    const pr=c.pr;let ico='╱',txt='Arête';
    if(pr.type==='point'){ico='•';txt='Point';}
    else if(pr.type==='circle'){ico='◯';txt='Cercle Ø'+f(2*pr.r);}
    else if(pr.type==='arc'){ico='◠';txt='Arc R'+f(pr.r);}
    else if(pr.type==='curve'){ico='∿';txt='Courbe';}
    else if(pr.type==='line')txt=(c.src==='esq'?'Ligne':'Arête')+' L'+f(Math.hypot(pr.x2-pr.x1,pr.y2-pr.y1));
    let note=c.src==='piece'?'cette pièce'+(c.nom?' « '+c.nom+' »':''):c.src==='ext'?'pièce « '+c.nom+' »':c.src==='esq'?'esquisse « '+c.nom+' »':'référence';
    if(c.src==='piece'||c.src==='ext')note+=c.dz>0.01?' · à '+f(c.dz)+' mm du plan':' · dans le plan';
    return {ico,txt,note,pr,src:c.src};
  });
}
// Après le gestionnaire de l'esquisse (60) : il a mis le clic en attente du relâcher (skProjAppui)
svg.addEventListener('pointerdown',e=>{
  if(skProjChoixMinut){skProjChoixMinut.annuler();skProjChoixMinut=null;}
  if(!skEdit||skTool!=='project'||!choixSouris(e)||!skProjAppui)return;
  const sk=skEdit,A=skProjAppui,cx=e.clientX,cy=e.clientY;
  skProjChoixMinut=choixAppui(e,()=>{
    skProjChoixMinut=null;
    if(skEdit!==sk||skTool!=='project'||skProjAppui!==A)return;
    const L=skProjChoixListe(sk,A.wx,A.wy);
    if(L.length<2)return; // un seul élément : le relâcher le projette
    skProjAppui=null; // la liste décide : le relâcher ne projette plus
    const nExt=L.filter(it=>it.src==='ext').length;
    choixMenuOuvrir(cx,cy,'Projeter — '+L.length+' éléments sous le clic'+(nExt?' (dont '+nExt+' d’autres pièces)':''),L,{
      hover:i=>{skProjectHover=L[i].pr;drawSketch2D();},
      choose:i=>{skProjectHover=null;if(skEdit===sk)skProjeterPr(sk,L[i].pr);drawSketch2D();},
      cancel:()=>{skProjectHover=null;drawSketch2D();skStatus('Projeter : rien de projeté.');}
    });
  });
});

/* ===================== 3D ===================== */
let choix3dMinut=null,choix3dOuvert=false;
function choix3dPris(e){if(choix3dOuvert&&e&&e.button===0){choix3dOuvert=false;return true;}return false;}
// Arête imposée retrouvée dans la liste d'arêtes de l'outil en cours (même tableau, ou mêmes points)
function choix3dAreteForcee(segs){
  const F=mfPickForce;if(!F||!F.P||!segs)return null;
  let i=segs.indexOf(F.P);
  if(i<0){const P=F.P,a=P[0],b=P[P.length-1],eq=(p,q)=>p&&q&&Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])+Math.abs(p[2]-q[2])<1e-5;
    i=segs.findIndex(S=>S&&S.length===P.length&&((eq(S[0],a)&&eq(S[S.length-1],b))||(eq(S[0],b)&&eq(S[S.length-1],a))));}
  return i>=0?{pi:i,dc:0,d:0}:null;
}
function choix3dListe(e){
  const r=renderer.domElement.getBoundingClientRect();
  rayc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
  // Les faces vues de dos (le fond d'un bloc, vu à travers) ne répondent pas au rayon : leurs
  // matières passent en double face le temps de la recherche.
  const ms=bodies.filter(b=>b.visible).map(b=>b.mesh),mats=[];
  ms.forEach(m=>(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>{if(x&&x.side!==THREE.DoubleSide){mats.push([x,x.side]);x.side=THREE.DoubleSide;}}));
  let hits=[];
  try{hits=rayc.intersectObjects(ms,false).sort((a,b)=>a.distance-b.distance);}finally{mats.forEach(([x,s])=>{x.side=s;});}
  const front=hits[0]||null,out=[],vus=new Set();
  hits.forEach(h=>{
    if(h.faceIndex==null)return;
    const g=(h.object.geometry.userData.occGroups||[]).find(g=>h.faceIndex>=g.start&&h.faceIndex<g.start+g.count);
    const key=h.object.uuid+':'+(g?'g'+g.f:'t'+h.faceIndex);if(vus.has(key))return;vus.add(key);
    let txt='Face',note='';
    try{txt=selLibelle('Face',selFaceInfo(h.object,h.faceIndex));}catch(err){}
    try{const G=mesGeomOf(h.object,h.faceIndex);if(G)note=G.kind==='cyl'?'cylindre Ø'+(+(2*G.r).toFixed(2)):'plane';}catch(err){}
    try{note=(note?note+' · ':'')+String(mesNom(h.object)).replace(/\s*\S?\s*\d+\s*tris?\s*$/,'');}catch(err){} // sans « · 12 tris »
    if(out.some(o=>o.face))note+=' · derrière';
    out.push({dist:h.distance,face:h,ico:'▢',txt,note});
  });
  // arêtes à moins de 7 px, cachées comprises
  try{
    const segs=edgeHoverSegs();
    if(segs&&segs.length){
      const scr=edgeScrPts(segs,r),S=scr.S,off=scr.off,mx=e.clientX-r.left,my=e.clientY-r.top,wv=new THREE.Vector3(),ortho=camera.isOrthographicCamera;
      let slack=0.3;
      if(front){const wpp=ortho?(camera.top-camera.bottom)/(camera.zoom||1)/r.height:2*front.distance*Math.tan(camera.fov*Math.PI/360)/r.height;slack=Math.min(0.3,2*wpp);}
      segs.forEach((P,pi)=>{
        if(!P||P.length<2)return;let best=null;
        for(let k=1,a=4*off[pi],b=a+4;k<P.length;k++,a=b,b+=4){
          if(!(S[a+2]<1&&S[b+2]<1&&S[a+2]>-1&&S[b+2]>-1))continue;
          const ax=S[a],ay=S[a+1],dx=S[b]-ax,dy=S[b+1]-ay,L2=dx*dx+dy*dy||1e-9;
          let t=((mx-ax)*dx+(my-ay)*dy)/L2;t=Math.max(0,Math.min(1,t));
          const d=Math.hypot(mx-(ax+t*dx),my-(ay+t*dy));if(d>7||(best&&d>=best.d))continue;
          if(!ortho){const za=S[a+3],zb=S[b+3];const den=(1-t)*zb+t*za;if(Math.abs(den)>1e-12)t=t*za/den;}
          const dc=camera.position.distanceTo(wv.set(P[k-1][0]+(P[k][0]-P[k-1][0])*t,P[k-1][1]+(P[k][1]-P[k-1][1])*t,P[k-1][2]+(P[k][2]-P[k-1][2])*t));
          best={d,dc};
        }
        if(!best)return;
        let txt='Arête',note='',ico='╱';
        try{txt=selLibelle('Arête',selAreteInfo(P));}catch(err){}
        try{const G=edgeGeomOf(P);
          if(G.kind==='line')note='droite '+(+G.a.distanceTo(G.b).toFixed(2));
          else if(G.kind==='circle'){ico='◯';note=(G.closed?'cercle':'arc')+' Ø'+(+(2*G.r).toFixed(2));}
          else{ico='∿';note='courbe';}}catch(err){}
        if(front&&best.dc>front.distance*1.004+slack)note+=' · cachée';
        out.push({dist:best.dc-1e-3,P,ico,txt,note}); // à égalité, l'arête passe avant la face qu'elle borde
      });
    }
  }catch(err){}
  out.sort((a,b)=>a.dist-b.dist);
  return out;
}
function choix3dSurligner(it){
  clearHover();if(!it)return;
  hoverGroup=new THREE.Group();mesScene().add(hoverGroup);hoverKey='choix';
  try{
    if(it.face)highlightTris(it.face.object,faceTrisFor(it.face.object,it.face.faceIndex),0x0a84ff,0.45,hoverGroup);
    else if(it.P)edgeHoverDraw(it.P,hoverGroup,0xff5a1f);
    // visible même derrière la matière : c'est tout l'intérêt de la liste
    hoverGroup.traverse(o=>{if(o.material){o.material.depthTest=false;o.renderOrder=999;}});
  }catch(err){}
}
function choix3dArm(e){
  if(choix3dMinut){choix3dMinut.annuler();choix3dMinut=null;}
  choix3dOuvert=false;
  if(!choixSouris(e)||skEdit||(typeof asmMode!=='undefined'&&asmMode==='asm'))return;
  const mods={ctrlKey:!!e.ctrlKey,metaKey:!!e.metaKey,shiftKey:!!e.shiftKey,altKey:!!e.altKey},cx=e.clientX,cy=e.clientY;
  choix3dMinut=choixAppui(e,()=>{
    choix3dMinut=null;
    const pos={clientX:cx,clientY:cy};
    const L=choix3dListe(pos);
    if(L.length<2)return;
    choix3dOuvert=true; // le relâcher qui suit ne sélectionne rien
    choixMenuOuvrir(cx,cy,'Sous le clic — '+L.length+' éléments',L,{
      hover:i=>choix3dSurligner(L[i]),
      choose:i=>{
        clearHover();choix3dOuvert=false;
        const it=L[i],el=renderer.domElement;
        const fake=Object.assign({clientX:cx,clientY:cy,button:0,buttons:0,pointerType:'mouse',target:el,currentTarget:el,detail:1,
          preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}},mods);
        mfPickForce=it.face?{face:it.face}:{P:it.P};
        try{wirePick._up&&wirePick._up(fake);}finally{mfPickForce=null;}
      },
      cancel:()=>{clearHover();choix3dOuvert=false;}
    });
  });
}
