/* ---------- Interface téléphone (V0.27.0, phase 1) ----------
   Même application, même document : on n'ajoute qu'une couche sous body.mf-mobile.
   • Vue 3D plein écran (portrait ou paysage), barre du haut (menu, nom du fichier, annuler /
     rétablir) et barre d'outils (Arbre, Paramètres, Cadrer, Vues ; à gauche en paysage).
   • Panneau TRANSLUCIDE : l'arbre (#tree) et les paramètres (#props) y sont DÉPLACÉS (mêmes
     nœuds, même code). Trois hauteurs (poignée), bouton œil maintenu = pièce visible à travers,
     et après chaque modification le panneau s'efface un instant pour montrer le résultat.
   • Gestes : 1 doigt = orbite (pivot sur la pièce, comme la souris), 2 doigts = pincer pour
     zoomer + glisser pour déplacer, tap = sélection (mêmes gestionnaires que le clic),
     double tap = cadrer, appui long = menu contextuel. OrbitControls ne voit plus le tactile.
   • Fichiers : Ouvrir / Enregistrer passent par mffOpen / mffSave (sélecteur et téléchargement
     sur mobile), Partager (Web Share) quand le téléphone le permet ; le brouillon local
     (autosave, minifusion_auto) reste le filet.
   Phases 2 et 3 (Créer, esquisse au doigt) : 99-mobile-creer-esquisse.js (mfmPhase23).
   Activation : téléphone détecté (pointeur tactile, petit écran), ou ?mobile=1 / ?mobile=0
   (?mobile=auto : retour à la détection), choix mémorisé dans localStorage minifusion_mobile (on / off). */
function mfmWanted(){
  let q=null;try{q=new URLSearchParams(location.search).get('mobile');}catch(e){}
  if(q==='1'||q==='0'){mfLS('minifusion_mobile',q==='1'?'on':'off');return q==='1';}
  if(q==='auto')try{localStorage.removeItem('minifusion_mobile');}catch(e){}
  const m=mfLS('minifusion_mobile');
  if(m==='on')return true;if(m==='off')return false;
  try{return matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<=820;}catch(e){return false;}
}
function mfmCss(){
  if(document.getElementById('mfmCss'))return;
  const st=document.createElement('style');st.id='mfmCss';
  st.textContent=[
  /* tout l'habillage bureau disparaît ; la vue occupe l'écran */
  'body.mf-mobile{margin:0;padding:0!important;overflow:hidden;height:100dvh;overscroll-behavior:none;-webkit-user-select:none;user-select:none}',
  'body.mf-mobile .topbar,body.mf-mobile #mfRibbon,body.mf-mobile aside.right,body.mf-mobile #treeWrap,body.mf-mobile #viewbar,body.mf-mobile #mfBrTabs,body.mf-mobile #mfTl,body.mf-mobile #mfSkBar,body.mf-mobile #faoWrap,body.mf-mobile #faoTreeWrap,body.mf-mobile #faoAddBar{display:none!important}',
  'body.mf-mobile .layout{position:fixed;inset:0;gap:0}',
  'body.mf-mobile #vpwrap{border:none;border-radius:0;box-shadow:none;min-height:0}',
  'body.mf-mobile #viewport{touch-action:none}',
  'body.mf-mobile #mfCube{top:calc(env(safe-area-inset-top) + 52px)!important;right:6px!important;transform:scale(.8);transform-origin:top right}',
  'body.mf-mobile #mfVpInfo{top:calc(env(safe-area-inset-top) + 50px);bottom:auto!important;left:10px;right:90px;max-width:none;white-space:normal;font-size:.7rem}',
  'body.mf-mobile #mfVpInfo #mfStEng{display:none}',
  /* barres */
  '.mfmBar{position:fixed;z-index:60;display:flex;align-items:center;background:rgba(20,22,27,.86);color:#eceef2;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}',
  'body[data-theme="clair"] .mfmBar{background:rgba(255,255,255,.9);color:#1c1c1e}',
  '.mfmBar button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:44px;min-height:44px;padding:4px 6px;border:none;background:none;color:inherit;font-size:.62rem;font-weight:500;border-radius:10px;box-shadow:none}',
  '.mfmBar button:hover{box-shadow:none}',
  '.mfmBar button.on{color:var(--primary)}',
  '.mfmBar button svg{width:22px;height:22px}',
  '#mfmTop{top:0;left:0;right:0;height:calc(44px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 4px 0;gap:2px}',
  '#mfmTop button{flex-direction:row;font-size:.9rem}',
  '#mfmName{flex:1;min-width:0;text-align:center;font-size:.85rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#mfmName.mod::after{content:" •";color:var(--warn)}',
  '#mfmNav{bottom:0;left:0;right:0;height:calc(56px + env(safe-area-inset-bottom));padding:0 6px env(safe-area-inset-bottom);justify-content:space-around}',
  /* panneau translucide */
  '#mfmSheet{position:fixed;z-index:55;left:0;right:0;bottom:calc(56px + env(safe-area-inset-bottom));height:42vh;display:none;flex-direction:column;background:rgba(18,20,25,.74);color:#eceef2;border-top:1px solid rgba(255,255,255,.14);border-radius:16px 16px 0 0;transition:opacity .25s,height .2s}',
  'body[data-theme="clair"] #mfmSheet{background:rgba(255,255,255,.8);color:#1c1c1e;border-color:rgba(0,0,0,.12)}',
  '#mfmSheet.open{display:flex}',
  '#mfmSheet[data-h="peek"]{height:24vh}#mfmSheet[data-h="full"]{height:calc(100dvh - 56px - 44px - env(safe-area-inset-top) - env(safe-area-inset-bottom))}',
  '#mfmSheet.ghost{opacity:.12;pointer-events:none}',
  '#mfmSheet.dragging{transition:none}',
  '#mfmGrip{flex:none;height:22px;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:ns-resize}',
  '#mfmGrip i{width:42px;height:5px;border-radius:3px;background:rgba(127,127,127,.6)}',
  '#mfmHead{flex:none;display:flex;align-items:center;gap:4px;padding:0 8px 6px}',
  '#mfmHead .tab{padding:6px 14px;border-radius:9px;border:none;background:none;color:inherit;font-size:.82rem;box-shadow:none}',
  '#mfmHead .tab.on{background:var(--primary);color:#fff}',
  '#mfmHead .sp{flex:1}',
  '#mfmHead .ico{min-width:40px;min-height:36px;padding:4px;border:none;background:none;color:inherit;box-shadow:none;font-size:1rem}',
  '#mfmBody{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:0 12px 14px;-webkit-user-select:text;user-select:text}',
  '#mfmBody>div{display:none}#mfmBody>div.on{display:block}',
  /* arbre et paramètres : cibles assez grandes pour un doigt */
  '#mfmBody .tree{font-size:.92rem}#mfmBody .tnode{padding:9px 8px;border-radius:9px}',
  '#mfmBody #props input,#mfmBody #props select,#mfmBody #props button{font-size:16px;min-height:40px}', /* 16 px : pas de zoom automatique iOS */
  '#mfmBody #props .pnl-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0}',
  '#mfmBody #props .pnl-row>label{flex:1;min-width:0}',
  '#mfmBody #props .pnl-row>input[type=text],#mfmBody #props .pnl-row>input[type=number],#mfmBody #props .pnl-row>input[data-fxnum],#mfmBody #props .pnl-row>select{max-width:55%}',
  /* paysage : barre d'outils à gauche, panneau à droite sur toute la hauteur */
  '@media (orientation:landscape){',
  ' body.mf-mobile #mfmNav{top:0;bottom:0;right:auto;width:calc(60px + env(safe-area-inset-left));height:auto;flex-direction:column;padding:48px 0 env(safe-area-inset-bottom) env(safe-area-inset-left)}',
  ' body.mf-mobile #mfmTop{left:calc(60px + env(safe-area-inset-left))}',
  ' body.mf-mobile #mfmSheet{left:auto;top:calc(44px + env(safe-area-inset-top));bottom:0;width:min(46vw,420px);height:auto!important;border-radius:16px 0 0 0;border-top:none;border-left:1px solid rgba(255,255,255,.14)}',
  ' body.mf-mobile #mfmGrip{display:none}',
  ' body.mf-mobile #mfmHead{padding-top:8px}',
  ' body.mf-mobile .layout{left:calc(60px + env(safe-area-inset-left))}',
  '}',
  /* menus (mfPop) : lignes plus hautes */
  'body.mf-mobile .mfPop button{padding:11px 12px;font-size:.92rem}',
  'body.mf-mobile .mfPop{max-height:80dvh;overflow:auto}',
  /* bureau sur un téléphone : petit bouton pour revenir à l'interface téléphone */
  '#mfmBack{position:fixed;z-index:9000;left:8px;bottom:8px;padding:8px 12px;border-radius:20px;font-size:.8rem}'
  ].join('\n');
  document.head.appendChild(st);
}
const MFM_IC={
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  tree:'<path d="M5 4v16M5 8h6M5 16h6"/><rect x="11" y="5" width="8" height="6" rx="1.5"/><rect x="11" y="13" width="8" height="6" rx="1.5"/>',
  props:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  views:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m12 12 8-4.5M12 12v9M12 12 4 7.5"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  plus:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'
};
function mfmI(k){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(MFM_IC[k]||'')+'</svg>';}
let mfmOn=false,mfmTab='tree',mfmGhostT=null;
function mfmBtn(parent,ic,label,fn,id){
  const b=document.createElement('button');if(id)b.id=id;
  b.innerHTML=mfmI(ic)+(label?'<span>'+label+'</span>':'');b.title=label||'';
  b.addEventListener('click',e=>{e.stopPropagation();fn(b,e);});
  parent.appendChild(b);return b;
}
/* ---- panneau ---- */
function mfmSheetOpen(tab){
  const S=document.getElementById('mfmSheet');if(!S)return;
  if(tab)mfmTab=tab;
  S.classList.add('open');
  S.querySelectorAll('#mfmHead .tab').forEach(b=>b.classList.toggle('on',b.dataset.t===mfmTab));
  S.querySelectorAll('#mfmBody>div').forEach(d=>d.classList.toggle('on',d.dataset.t===mfmTab));
  mfmNavSync();
}
function mfmSheetClose(){const S=document.getElementById('mfmSheet');if(S)S.classList.remove('open');mfmNavSync();}
function mfmSheetToggle(tab){
  const S=document.getElementById('mfmSheet');
  if(S&&S.classList.contains('open')&&mfmTab===tab)mfmSheetClose();else mfmSheetOpen(tab);
}
function mfmNavSync(){
  const S=document.getElementById('mfmSheet'),open=!!(S&&S.classList.contains('open'));
  const t=document.getElementById('mfmNavTree'),p=document.getElementById('mfmNavProps');
  if(t)t.classList.toggle('on',open&&mfmTab==='tree');
  if(p)p.classList.toggle('on',open&&mfmTab==='props');
}
// la pièce à travers le panneau : maintenu (œil) ou un instant après une modification
function mfmGhost(on){const S=document.getElementById('mfmSheet');if(S)S.classList.toggle('ghost',!!on);}
function mfmGhostFlash(){
  if(mfmGhostT)clearTimeout(mfmGhostT);
  mfmGhostT=setTimeout(()=>{mfmGhost(true);mfmGhostT=setTimeout(()=>{mfmGhost(false);mfmGhostT=null;},1300);},350);
}
function mfmSheetBuild(){
  const S=document.createElement('div');S.id='mfmSheet';S.dataset.h='half';
  const grip=document.createElement('div');grip.id='mfmGrip';grip.innerHTML='<i></i>';S.appendChild(grip);
  const head=document.createElement('div');head.id='mfmHead';
  [['tree','Arbre'],['props','Paramètres']].forEach(([t,l])=>{
    const b=document.createElement('button');b.className='tab';b.dataset.t=t;b.textContent=l;b.onclick=()=>mfmSheetOpen(t);head.appendChild(b);});
  const sp=document.createElement('span');sp.className='sp';head.appendChild(sp);
  const eye=document.createElement('button');eye.className='ico';eye.innerHTML=mfmI('eye');eye.title='Maintenir pour voir la pièce';
  eye.addEventListener('pointerdown',e=>{e.preventDefault();mfmGhost(true);});
  ['pointerup','pointercancel','pointerleave'].forEach(k=>eye.addEventListener(k,()=>mfmGhost(false)));
  eye.addEventListener('contextmenu',e=>e.preventDefault());
  head.appendChild(eye);
  const x=document.createElement('button');x.className='ico';x.innerHTML=mfmI('close');x.title='Fermer';x.onclick=mfmSheetClose;head.appendChild(x);
  S.appendChild(head);
  const body=document.createElement('div');body.id='mfmBody';
  const pt=document.createElement('div');pt.dataset.t='tree';
  const pp=document.createElement('div');pp.dataset.t='props';
  body.appendChild(pt);body.appendChild(pp);S.appendChild(body);
  // mêmes nœuds que le bureau : tout le code d'arbre et de paramètres continue de les remplir
  const tree=document.getElementById('tree'),props=document.getElementById('props');
  if(tree)pt.appendChild(tree);if(props)pp.appendChild(props);
  // une valeur changée : la pièce se montre un instant à travers le panneau
  pp.addEventListener('change',()=>mfmGhostFlash());
  // poignée : glisser pour choisir la hauteur (réduit / moitié / plein écran), tap = suivante
  let g=null;
  grip.addEventListener('pointerdown',e=>{g={y:e.clientY,h:S.getBoundingClientRect().height,moved:false};S.classList.add('dragging');grip.setPointerCapture(e.pointerId);});
  grip.addEventListener('pointermove',e=>{if(!g)return;const d=g.y-e.clientY;if(Math.abs(d)>4)g.moved=true;S.style.height=Math.max(80,g.h+d)+'px';});
  const end=e=>{
    if(!g)return;S.classList.remove('dragging');
    const H=window.innerHeight,h=S.getBoundingClientRect().height;S.style.height='';
    if(!g.moved){S.dataset.h={peek:'half',half:'full',full:'peek'}[S.dataset.h]||'half';}
    else if(h<H*0.14)mfmSheetClose();
    else S.dataset.h=h<H*0.33?'peek':(h<H*0.62?'half':'full');
    g=null;try{grip.releasePointerCapture(e.pointerId);}catch(err){}
  };
  grip.addEventListener('pointerup',end);grip.addEventListener('pointercancel',end);
  document.body.appendChild(S);
}
/* ---- cadrer : toute la pièce, direction de vue GARDÉE. showAll et viewFit retiennent le champ
   le MOINS serré des deux (max) : sur un écran en portrait, la pièce débordait des côtés. Ici le
   plus serré (min), avec les barres du haut et du bas déduites de la hauteur utile. ---- */
function mfmFit(){
  try{
    const box=new THREE.Box3();
    bodies.forEach(b=>{if(b.visible&&b.mesh)box.expandByObject(b.mesh);});
    doc.sketches.forEach(sk=>{const m=scene.getObjectByName('sk_'+sk.id);if(m&&sk.visible!==false)box.expandByObject(m);});
    if(box.isEmpty())return;
    const c=box.getCenter(new THREE.Vector3()),r=(box.getSize(new THREE.Vector3()).length()*0.5)||50;
    const dir=camera.position.clone().sub(controls.target);
    if(dir.lengthSq()<1e-12)dir.set(0.6,-0.6,0.6);
    dir.normalize();
    const H=renderer.domElement.clientHeight||1,W=renderer.domElement.clientWidth||1;
    const fv=(camera.fov||50)*Math.PI/180,tv=Math.tan(fv/2)*Math.max(0.4,(H-110)/H); // barres : ~110 px
    const s=Math.min(Math.sin(Math.atan(tv)),Math.sin(Math.atan(Math.tan(fv/2)*W/H)));
    const d=r/Math.max(s,0.05)*1.1;
    controls.target.copy(c);camera.position.copy(c).addScaledVector(dir,d);
    controls.update();viewUserMoved=true;
  }catch(e){try{(mfmShowAll0||showAll)();}catch(err){}}
}
let mfmShowAll0=null;
/* ---- menus ---- */
function mfmViewsMenu(anchor){
  const v=(k,l)=>({html:l,fn:()=>{try{setView(k);}catch(e){}}});
  mfPop(anchor,[{title:'Vue'},v('iso','Isométrique'),v('top','Dessus'),v('front','Face'),v('right','Droite'),
    {html:'Tout afficher',fn:mfmFit},
    {html:(typeof orbitFree!=='undefined'&&orbitFree?'✓ ':'')+'Orbite libre',fn:()=>{try{const o=document.getElementById('optOrbit');o.value=orbitFree?'contrainte':'libre';o.dispatchEvent(new Event('change'));}catch(e){}}}]);
}
async function mfmShare(){
  try{
    const data=await mffData();
    const nm=(mffName||doc.name||'piece').replace(/[\\/:*?"<>|]/g,'_')+'.conceptcad';
    const f=new File([data],nm,{type:'application/json'});
    if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:nm});mffMark();return;}
  }catch(e){if(e&&e.name==='AbortError')return;}
  mffSaveAs();
}
function mfmMenu(anchor){
  const it=(h,fn)=>({html:h,fn});
  const L=[{title:'Fichier'},
    it('Nouveau',()=>mffNew()),
    it('Ouvrir…',()=>mffOpen()),
    it('Enregistrer',()=>mffSave())];
  if(navigator.share)L.push(it('Partager / envoyer…',()=>mfmShare()));
  L.push({title:'Exporter'},it('STL',()=>mfClick('btnExportStl')),it('STEP',()=>mfClick('btnExportStep')));
  L.push({title:'Affichage'});
  MF_THEMES.forEach(([k,l])=>L.push({html:l,cls:'mfThemeOpt'+((document.body.getAttribute('data-theme')||'nuit')===k?' on':''),fn:()=>mfTheme(k)}));
  L.push({title:'Interface'},it('Interface bureau',()=>{mfLS('minifusion_mobile','off');location.reload();}));
  L.push({title:APP_VER});
  mfPop(anchor,L);
}
/* ---- gestes tactiles sur la vue 3D ---- */
const mfmT={pts:new Map(),pinch:null,tap:null,lastTap:null,lp:null,eatCtx:0};
function mfmCanvasPt(e){const c=renderer&&renderer.domElement;return !!c&&(e.target===c);}
function mfmSynth(type,x,y,btn){
  // clic souris rejoué à l'endroit du doigt : wirePick (sélection, modes de pointage) le traite
  // comme un clic court, sans rien changer à son code. Identifiant de pointeur fictif :
  // OrbitControls ne peut pas le capturer et ignore donc ce clic.
  const c=renderer.domElement;
  const o={bubbles:true,cancelable:true,clientX:x,clientY:y,button:btn,buttons:type==='pointerdown'?(btn===2?2:1):0,pointerId:9001,pointerType:'mouse',isPrimary:true};
  c.dispatchEvent(type==='contextmenu'?new MouseEvent('contextmenu',o):new PointerEvent(type,o));
}
function mfmPan(dx,dy){
  // déplacement écran : caméra ET cible glissent ensemble, 1 px = 1 px au plan de la cible
  if(!camera||!controls)return;
  const c=renderer.domElement,H=c.clientHeight||600;
  let s;
  if(camera.isOrthographicCamera)s=(camera.top-camera.bottom)/(camera.zoom||1)/H;
  else s=2*camera.position.distanceTo(controls.target)*Math.tan((camera.fov||50)*Math.PI/360)/H;
  camera.updateMatrixWorld();
  const R=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),U=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  const d=R.multiplyScalar(-dx*s).add(U.multiplyScalar(dy*s));
  camera.position.add(d);controls.target.add(d);
  viewUserMoved=true;
}
function mfmTouchWire(){
  const c=renderer.domElement;
  const cancelLp=()=>{if(mfmT.lp){clearTimeout(mfmT.lp);mfmT.lp=null;}};
  // ÉCOUTEUR EN CAPTURE SUR window : il passe avant OrbitControls, l'orbite et la sélection ;
  // les pointeurs tactiles de la vue s'arrêtent ici et sont rejoués à la main
  window.addEventListener('pointerdown',e=>{
    if(!mfmOn||e.pointerType!=='touch'||!mfmCanvasPt(e))return;
    e.stopPropagation();e.preventDefault();
    try{c.setPointerCapture(e.pointerId);}catch(err){}
    mfmT.pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const esq=typeof skEdit!=='undefined'&&skEdit;
    if(mfmT.pts.size===1){
      mfmT.tap={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),moved:false};
      if(!esq&&controls&&controls.enabled!==false&&controls.enableRotate)
        _fo={id:e.pointerId,x:e.clientX,y:e.clientY,P:orbitPivotAt(e.clientX,e.clientY),x0:e.clientX,y0:e.clientY,vx:0,vy:0,down:true,moved:false};
      cancelLp();
      mfmT.lp=setTimeout(()=>{ // appui long : menu contextuel (pièce, face)
        mfmT.lp=null;const t=mfmT.tap;if(!t||t.moved||mfmT.pts.size!==1)return;
        mfmT.tap=null;if(_fo){_fo=null;orbitMarkShow(null);}
        try{navigator.vibrate&&navigator.vibrate(15);}catch(err){}
        mfmT.eatCtx=performance.now();
        mfmSynth('pointerdown',t.x,t.y,2);mfmSynth('contextmenu',t.x,t.y,2);mfmSynth('pointerup',t.x,t.y,2);
      },550);
    }else if(mfmT.pts.size===2){
      // second doigt : fin de l'orbite et du tap, début du pincement
      cancelLp();mfmT.tap=null;
      if(_fo){_fo=null;orbitMarkShow(null);}
      const [a,b]=[...mfmT.pts.values()];
      const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
      let P=null;try{P=viewHitAt(cx,cy)||viewTargetPlaneAt(cx,cy);}catch(err){}
      mfmT.pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,cx,cy,P:P||controls.target.clone()};
    }
  },true);
  window.addEventListener('pointermove',e=>{
    if(!mfmOn||e.pointerType!=='touch'||!mfmT.pts.has(e.pointerId))return;
    e.stopPropagation();
    mfmT.pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const t=mfmT.tap;
    if(t&&t.id===e.pointerId&&Math.hypot(e.clientX-t.x,e.clientY-t.y)>8){t.moved=true;cancelLp();}
    if(mfmT.pinch&&mfmT.pts.size>=2){
      const [a,b]=[...mfmT.pts.values()],pn=mfmT.pinch;
      const d=Math.hypot(a.x-b.x,a.y-b.y)||1,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
      if(typeof skEdit!=='undefined'&&skEdit){pn.d=d;pn.cx=cx;pn.cy=cy;return;} // esquisse : caméra pilotée par l'esquisse
      try{mfmPan(cx-pn.cx,cy-pn.cy);}catch(err){}
      try{if(orbitZoomApply(Math.log(pn.d/d),pn.P))viewUserMoved=true;}catch(err){}
      pn.d=d;pn.cx=cx;pn.cy=cy;
      return;
    }
    if(_fo&&_fo.down&&_fo.id===e.pointerId){
      const dx=e.clientX-_fo.x,dy=e.clientY-_fo.y;_fo.x=e.clientX;_fo.y=e.clientY;
      _fo.vx+=dx;_fo.vy+=dy;
      if(!_fo.moved&&Math.hypot(e.clientX-_fo.x0,e.clientY-_fo.y0)>3){_fo.moved=true;orbitMarkShow(_fo.P);}
    }
  },true);
  const up=e=>{
    if(!mfmOn||e.pointerType!=='touch'||!mfmT.pts.has(e.pointerId))return;
    e.stopPropagation();
    mfmT.pts.delete(e.pointerId);cancelLp();
    if(mfmT.pts.size<2)mfmT.pinch=null;
    if(_fo&&_fo.id===e.pointerId){_fo.down=false;if(!_fo.vx&&!_fo.vy){_fo=null;orbitMarkShow(null);}}
    const t=mfmT.tap;mfmT.tap=null;
    if(e.type!=='pointerup'||!t||t.id!==e.pointerId||t.moved||performance.now()-t.t>500)return;
    if(_fo&&!_fo.moved){_fo=null;orbitMarkShow(null);}
    const now=performance.now(),L=mfmT.lastTap;
    if(L&&now-L.t<320&&Math.hypot(t.x-L.x,t.y-L.y)<30&&!(typeof skEdit!=='undefined'&&skEdit)){ // double tap : cadrer
      mfmT.lastTap=null;mfmFit();return;
    }
    mfmT.lastTap={t:now,x:t.x,y:t.y};
    mfmSynth('pointerdown',t.x,t.y,0);mfmSynth('pointerup',t.x,t.y,0);
  };
  window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',up,true);
  // le menu natif de l'appui long (Android) doublerait le nôtre
  window.addEventListener('contextmenu',e=>{
    if(!mfmOn||!e.isTrusted)return;
    if(e.target===c||performance.now()-mfmT.eatCtx<1500){e.preventDefault();e.stopPropagation();}
  },true);
}
// appui long sur une ligne de l'arbre : son menu (renommer, masquer, supprimer…) ; iOS n'émet
// pas de contextmenu au toucher
function mfmTreeLongPress(){
  const tree=document.getElementById('tree');if(!tree)return;
  let lp=null,st=null;
  tree.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;
    st={x:e.clientX,y:e.clientY,el:e.target};
    if(lp)clearTimeout(lp);
    lp=setTimeout(()=>{lp=null;if(!st)return;mfmT.eatCtx=performance.now();
      try{navigator.vibrate&&navigator.vibrate(15);}catch(err){}
      st.el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:st.x,clientY:st.y,button:2}));st=null;},550);
  });
  const stop=()=>{if(lp){clearTimeout(lp);lp=null;}st=null;};
  tree.addEventListener('pointermove',e=>{if(st&&Math.hypot(e.clientX-st.x,e.clientY-st.y)>8)stop();});
  tree.addEventListener('pointerup',stop);tree.addEventListener('pointercancel',stop);
  tree.addEventListener('contextmenu',e=>{if(e.isTrusted&&e.pointerType!=='mouse'&&performance.now()-mfmT.eatCtx>1500&&matchMedia('(pointer:coarse)').matches){e.preventDefault();e.stopPropagation();}},true);
}
/* ---- nom du fichier (copie de #mffName) ---- */
function mfmNameSync(){
  const src=document.getElementById('mffName'),dst=document.getElementById('mfmName');if(!dst)return;
  const t=src?src.textContent.trim():'';
  dst.textContent=t.replace(/^●\s*/,'')||(typeof doc!=='undefined'&&doc.name)||'Sans titre';
  dst.classList.toggle('mod',!!(src&&src.classList.contains('mod')));
}
function mfmBuild(){
  mfmCss();
  document.body.classList.add('mf-mobile');
  // barre du haut
  const top=document.createElement('div');top.id='mfmTop';top.className='mfmBar';
  mfmBtn(top,'menu','',b=>mfmMenu(b),'mfmMenuBtn');
  const nm=document.createElement('div');nm.id='mfmName';top.appendChild(nm);
  mfmBtn(top,'undo','',()=>mfClick('btnUndo'));
  mfmBtn(top,'redo','',()=>mfClick('btnRedo'));
  document.body.appendChild(top);
  // barre d'outils
  const nav=document.createElement('div');nav.id='mfmNav';nav.className='mfmBar';
  mfmBtn(nav,'plus','Créer',()=>mfmCreateOpen(),'mfmNavCreate');
  mfmBtn(nav,'tree','Arbre',()=>mfmSheetToggle('tree'),'mfmNavTree');
  mfmBtn(nav,'props','Paramètres',()=>mfmSheetToggle('props'),'mfmNavProps');
  mfmBtn(nav,'fit','Cadrer',mfmFit);
  mfmBtn(nav,'views','Vues',b=>mfmViewsMenu(b));
  document.body.appendChild(nav);
  mfmSheetBuild();
  try{const src=document.getElementById('mffName');if(src)new MutationObserver(mfmNameSync).observe(src,{childList:true,characterData:true,subtree:true,attributes:true});}catch(e){}
  mfmNameSync();
  // double-clic dans l'arbre = éditer : la fiche s'ouvre dans l'onglet Paramètres
  try{document.getElementById('tree').addEventListener('dblclick',()=>setTimeout(()=>mfmSheetOpen('props'),0));}catch(e){}
  mfmTreeLongPress();
  mfmTouchWire();
  try{mfmPhase23();}catch(e){try{console.warn('téléphone, phases 2-3 :',e);}catch(err){}}
  // tous les « Tout afficher » de l'application (démarrage, ouverture d'un fichier…) cadrent
  // aussi selon la largeur de l'écran
  mfmShowAll0=showAll;
  window.showAll=function(){mfmShowAll0.apply(this,arguments);mfmFit();};
  // la vue change de taille (plus de bandeau, rotation de l'écran) : le canevas suit
  const refit=()=>{try{fit();}catch(e){}};
  refit();setTimeout(refit,300);
  window.addEventListener('orientationchange',()=>setTimeout(refit,300));
  try{if(window.visualViewport)window.visualViewport.addEventListener('resize',refit);}catch(e){}
}
(function(){
  try{
    mfmOn=mfmWanted();
    if(mfmOn){mfmBuild();return;}
    // interface bureau choisie sur un appareil tactile : un bouton pour revenir
    if(mfLS('minifusion_mobile')==='off'&&matchMedia('(pointer:coarse)').matches){
      mfmCss();
      const b=document.createElement('button');b.id='mfmBack';b.className='primary';b.textContent='Interface téléphone';
      b.onclick=()=>{mfLS('minifusion_mobile','on');location.reload();};
      document.body.appendChild(b);
    }
  }catch(e){try{console.warn('interface téléphone :',e);}catch(err){}}
})();
