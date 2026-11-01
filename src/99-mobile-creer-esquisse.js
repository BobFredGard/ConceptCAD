/* ---------- Interface téléphone : créer et esquisser au doigt (V0.27.1, phases 2 et 3) ----------
   Chargé avant 99-mobile.js (ordre alphabétique) : n'y sont que des définitions, appelées par
   mfmBuild (mfmPhase23).
   • Créer (barre d'outils) : les commandes du ruban CAO (MF_CAO, mêmes boutons d'origine), en
     grille. La fiche de la commande s'ouvre dans le panneau translucide : réduit quand la commande
     attend des clics dans la vue (arêtes d'un congé, face d'une dépouille…), moitié sinon.
     Les arêtes se touchent avec une tolérance élargie (window.mfmEdgeK, lu par edgePickScreen).
   • Esquisse : la barre d'esquisse (#mfSkBar) devient un bandeau défilant à la place de la barre
     d'outils (à gauche en paysage) ; la barre du haut porte Abandonner, la liste (contraintes,
     cotes : #mfSkSidePanel dans le panneau) et Terminer.
     Au doigt : un outil de tracé VISE en glissant (l'aperçu et les accrochages suivent le doigt)
     et pose le point au LEVER ; un tap pose sur place. Outil Sélection : tap = sélectionner,
     glisser = déplacer (point, entité, cote) ou cadre. Double tap = double-clic (éditer une cote),
     appui long = menu de la sélection, 2 doigts = pincer / déplacer la vue. Tous ces gestes sont
     rejoués en événements souris sur le dessin : le code de l'esquisse ne change pas. */
function mfmCss2(){
  if(document.getElementById('mfmCss2'))return;
  const st=document.createElement('style');st.id='mfmCss2';
  st.textContent=[
  /* grille Créer */
  '#mfmCreate{position:fixed;z-index:65;left:8px;right:8px;bottom:calc(64px + env(safe-area-inset-bottom));max-height:70dvh;overflow:auto;padding:8px 10px 10px;border-radius:16px;background:rgba(20,22,27,.94);color:#eceef2;border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px rgba(0,0,0,.5)}',
  'body[data-theme="clair"] #mfmCreate{background:rgba(255,255,255,.97);color:#1c1c1e;border-color:rgba(0,0,0,.12)}',
  '#mfmCreate .t{font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;opacity:.6;margin:8px 4px 4px}',
  '#mfmCreate .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:4px}',
  '#mfmCreate button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border:none;background:rgba(127,127,127,.1);color:inherit;border-radius:10px;font-size:.72rem;box-shadow:none;min-height:64px}',
  '#mfmCreate button:active{background:var(--primary);color:#fff}',
  '#mfmCreate button svg{width:24px;height:24px}',
  '@media (orientation:landscape){#mfmCreate{left:calc(68px + env(safe-area-inset-left));right:auto;width:min(60vw,520px);top:52px;bottom:8px;max-height:none}}',
  /* esquisse : la barre d'outils laisse la place au bandeau d'esquisse */
  'body.mf-mobile.mf-sk #mfmNav{display:none}',
  'body.mf-mobile.mf-sk #mfSkBar{display:block!important;position:fixed;z-index:60;left:0;right:0;bottom:0;margin:0;border-radius:0;border:none;border-top:1px solid var(--border);padding-bottom:env(safe-area-inset-bottom);overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;background:rgba(20,22,27,.92)}',
  'body.mf-mobile.mf-sk[data-theme="clair"] #mfSkBar{background:rgba(255,255,255,.95)}',
  'body.mf-mobile.mf-sk #mfSkBar #skToolbar{flex-wrap:nowrap!important;width:max-content;padding:4px 6px!important;gap:2px}',
  'body.mf-mobile.mf-sk #skToolbar .tool,body.mf-mobile.mf-sk #skToolbar .con{min-width:52px!important;min-height:52px;padding:4px!important}',
  'body.mf-mobile.mf-sk #skToolbar .mfSkLab{display:block!important;font-size:.56rem}',
  'body.mf-mobile.mf-sk #skToolbar #skOk,body.mf-mobile.mf-sk #skToolbar #skCancel,body.mf-mobile.mf-sk #skToolbar #skClear{display:none!important}',
  'body.mf-mobile.mf-sk #skToolbar>span[style*="flex:1"]{display:none}',
  'body.mf-mobile.mf-sk #sketchOverlay{top:calc(44px + env(safe-area-inset-top));bottom:calc(62px + env(safe-area-inset-bottom))}',
  'body.mf-mobile.mf-sk #skSvg{touch-action:none}',
  'body.mf-mobile.mf-sk #skSide{display:block!important;width:auto!important;border:none!important;background:none!important;padding:0!important;max-height:none!important}',
  'body.mf-mobile.mf-sk #skStatus{font-size:.72rem;padding:3px 10px}',
  'body.mf-mobile.mf-sk #mfmSheet{bottom:calc(62px + env(safe-area-inset-bottom))}',
  'body.mf-mobile.mf-sk #mfCube,body.mf-mobile.mf-sk #mfVpInfo{display:none!important}',
  '@media (orientation:landscape){',
  ' body.mf-mobile.mf-sk #mfSkBar{top:0;right:auto;width:calc(64px + env(safe-area-inset-left));padding:48px 0 env(safe-area-inset-bottom) env(safe-area-inset-left);overflow-x:hidden;overflow-y:auto;border-top:none;border-right:1px solid var(--border)}',
  ' body.mf-mobile.mf-sk #mfSkBar #skToolbar{flex-direction:column;width:auto}',
  ' body.mf-mobile.mf-sk #skToolbar .sksep{width:auto!important;height:1px;margin:3px 0!important}',
  ' body.mf-mobile.mf-sk #sketchOverlay{bottom:0}',
  ' body.mf-mobile.mf-sk #mfmSheet{bottom:0}',
  '}',
  /* barre du haut : boutons propres à l'esquisse */
  '.mfmSkOnly{display:none!important}',
  'body.mf-mobile.mf-sk .mfmSkOnly{display:flex!important}',
  'body.mf-mobile.mf-sk .mfmSkHide{display:none!important}',
  '#mfmSkOk{color:#fff!important;background:var(--primary)!important;padding:4px 12px!important;font-weight:600}',
  '#mfmSkCancel{font-size:.8rem!important;padding:4px 10px!important}'
  ].join('\n');
  document.head.appendChild(st);
}
/* ---- Créer ---- */
function mfmCreateClose(){const p=document.getElementById('mfmCreate');if(p)p.remove();}
function mfmCreateOpen(){
  if(document.getElementById('mfmCreate')){mfmCreateClose();return;}
  const P=document.createElement('div');P.id='mfmCreate';
  (typeof MF_CAO!=='undefined'?MF_CAO:[]).forEach(([title,btns])=>{
    if(title==='Fichier')return; // dans le menu ☰
    const t=document.createElement('div');t.className='t';t.textContent=title;P.appendChild(t);
    const g=document.createElement('div');g.className='g';
    btns.forEach(([ic,lab,act])=>{
      const src=typeof act==='string'?document.getElementById(act):null;
      if(typeof act==='string'&&!src)return; // commande absente de cette version
      const b=document.createElement('button');b.innerHTML=(mfI(ic,24)||'')+'<span>'+lab+'</span>';
      b.onclick=()=>{mfmCreateClose();mfmRun(act);};
      g.appendChild(b);
    });
    P.appendChild(g);
  });
  document.body.appendChild(P);
  setTimeout(()=>{const off=ev=>{if(!P.contains(ev.target)&&!(ev.target.closest&&ev.target.closest('#mfmNavCreate'))){mfmCreateClose();document.removeEventListener('pointerdown',off,true);}};document.addEventListener('pointerdown',off,true);},0);
}
// la commande attend-elle des clics dans la vue ? (arêtes, faces, points, emplacements)
function mfmPicking(){
  const on=f=>{try{return !!f();}catch(e){return false;}};
  return [()=>filMode,()=>filModeX,()=>mvMode,()=>draftMode,()=>coqueMode,()=>splitMode,()=>holeFacePick,()=>extPickFace,()=>bmPick,()=>cgMode].some(on);
}
function mfmRun(act){
  mfmSheetClose();
  try{typeof act==='function'?act():mfClick(act);}catch(e){}
  // la fiche se remplit dans #props : panneau ouvert, réduit si la vue doit rester libre au doigt
  setTimeout(()=>{
    if(document.body.classList.contains('mf-sk'))return; // esquisse ouverte : son propre écran
    const S=document.getElementById('mfmSheet');if(!S)return;
    S.dataset.h=mfmPicking()?'peek':'half';
    mfmSheetOpen('props');
  },60);
}
/* ---- esquisse : mise en page ---- */
function mfmSkSync(){
  const on=document.body.classList.contains('mf-sk');
  const S=document.getElementById('mfmSheet');if(!S)return;
  const tab=S.querySelector('#mfmHead .tab[data-t="sk"]'),box=S.querySelector('#mfmBody>div[data-t="sk"]');
  if(tab)tab.style.display=on?'':'none';
  if(on){
    mfmCreateClose();mfmSheetClose();
    // contraintes et cotes (panneau latéral de l'esquisse, construit par mfSkLayout) → panneau
    const pn=document.getElementById('mfSkSidePanel');if(pn&&box&&pn.parentNode!==box)box.appendChild(pn);
    try{fit();}catch(e){}
  }else if(mfmTab==='sk'){mfmTab='tree';mfmSheetClose();}
}
function mfmSkSheetBuild(){
  const S=document.getElementById('mfmSheet');if(!S)return;
  const head=S.querySelector('#mfmHead'),body=S.querySelector('#mfmBody');
  const b=document.createElement('button');b.className='tab';b.dataset.t='sk';b.textContent='Esquisse';b.style.display='none';
  b.onclick=()=>mfmSheetOpen('sk');
  const tabs=head.querySelectorAll('.tab');head.insertBefore(b,tabs[tabs.length-1].nextSibling);
  const d=document.createElement('div');d.dataset.t='sk';body.appendChild(d);
}
/* ---- esquisse : gestes rejoués en souris sur le dessin ---- */
const mfmS={p:new Map(),one:null,pinch:null,lastTap:null,lp:null};
function mfmSkTarget(x,y){
  const el=document.elementFromPoint(x,y);
  return el&&svg.contains(el)?el:svg;
}
function mfmSkSynth(type,x,y,o){
  o=o||{};
  const btn=o.button||0;
  const init={bubbles:true,cancelable:true,clientX:x,clientY:y,button:type==='pointermove'?-1:btn,
    buttons:o.buttons!=null?o.buttons:(type==='pointerdown'?1:0),pointerId:9002,pointerType:'mouse',isPrimary:true,detail:o.detail||1};
  const el=mfmSkTarget(x,y);
  if(type==='contextmenu'||type==='dblclick'||type==='click')el.dispatchEvent(new MouseEvent(type,init));
  else el.dispatchEvent(new PointerEvent(type,init));
}
function mfmSkTouchWire(){
  const inSvg=e=>typeof svg!=='undefined'&&svg&&(e.target===svg||svg.contains(e.target));
  const cancelLp=()=>{if(mfmS.lp){clearTimeout(mfmS.lp);mfmS.lp=null;}};
  const drawTool=()=>typeof skTool!=='undefined'&&skTool!=='select';
  window.addEventListener('pointerdown',e=>{
    if(!mfmOn||e.pointerType!=='touch'||!inSvg(e)||!(typeof skEdit!=='undefined'&&skEdit))return;
    e.stopPropagation();e.preventDefault();
    try{svg.setPointerCapture(e.pointerId);}catch(err){}
    mfmS.p.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(mfmS.p.size===1){
      mfmS.one={id:e.pointerId,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,t:performance.now(),moved:false,down:false};
      if(drawTool())mfmSkSynth('pointermove',e.clientX,e.clientY); // aperçu tout de suite sous le doigt
      cancelLp();
      mfmS.lp=setTimeout(()=>{ // appui long : menu de la sélection (ou annuler le tracé en cours)
        mfmS.lp=null;const o=mfmS.one;if(!o||o.moved||o.down||mfmS.p.size!==1)return;
        mfmS.one=null;try{navigator.vibrate&&navigator.vibrate(15);}catch(err){}
        mfmT.eatCtx=performance.now();
        mfmSkSynth('contextmenu',o.x,o.y,{button:2});
      },600);
    }else if(mfmS.p.size===2){
      cancelLp();
      const o=mfmS.one;mfmS.one=null;
      if(o&&o.down)mfmSkSynth('pointerup',o.x,o.y); // un glisser commencé s'arrête là
      const [a,b]=[...mfmS.p.values()];
      mfmS.pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};
    }
  },true);
  window.addEventListener('pointermove',e=>{
    if(!mfmOn||e.pointerType!=='touch'||!mfmS.p.has(e.pointerId))return;
    e.stopPropagation();e.preventDefault();
    mfmS.p.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const pn=mfmS.pinch;
    if(pn&&mfmS.p.size>=2){
      const [a,b]=[...mfmS.p.values()];
      const d=Math.hypot(a.x-b.x,a.y-b.y)||1,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
      try{
        skView.cx-=(cx-pn.cx)/skView.s;skView.cy+=(cy-pn.cy)/skView.s;
        const r=svg.getBoundingClientRect();
        skSetZoom(skView.s*d/pn.d,cx-r.left,cy-r.top);
        drawSketch2D();
      }catch(err){}
      pn.d=d;pn.cx=cx;pn.cy=cy;return;
    }
    const o=mfmS.one;if(!o||o.id!==e.pointerId)return;
    o.x=e.clientX;o.y=e.clientY;
    if(!o.moved&&Math.hypot(o.x-o.x0,o.y-o.y0)>8){o.moved=true;cancelLp();
      // outil Sélection : le glisser commence là où le doigt s'est posé
      if(!drawTool()){mfmSkSynth('pointermove',o.x0,o.y0);mfmSkSynth('pointerdown',o.x0,o.y0);o.down=true;}
    }
    if(o.down)mfmSkSynth('pointermove',o.x,o.y,{buttons:1});
    else if(drawTool())mfmSkSynth('pointermove',o.x,o.y); // visée : survol, accrochages, aperçu
  },true);
  const up=e=>{
    if(!mfmOn||e.pointerType!=='touch'||!mfmS.p.has(e.pointerId))return;
    e.stopPropagation();e.preventDefault();
    mfmS.p.delete(e.pointerId);cancelLp();
    if(mfmS.p.size<2)mfmS.pinch=null;
    const o=mfmS.one;if(!o||o.id!==e.pointerId)return;
    mfmS.one=null;
    if(e.type==='pointercancel'){if(o.down)mfmSkSynth('pointerup',o.x,o.y);return;}
    if(o.down){mfmSkSynth('pointerup',o.x,o.y);return;}
    if(drawTool()&&o.moved){ // visée terminée : le point est posé au lever du doigt
      mfmSkSynth('pointerdown',o.x,o.y);mfmSkSynth('pointerup',o.x,o.y);return;}
    if(o.moved)return;
    // tap (et double tap = double-clic : éditer une cote, coter une entité)
    const now=performance.now(),L=mfmS.lastTap;
    if(L&&now-L.t<350&&Math.hypot(o.x-L.x,o.y-L.y)<24){
      mfmS.lastTap=null;
      mfmSkSynth('pointerdown',o.x,o.y,{detail:2});mfmSkSynth('pointerup',o.x,o.y,{detail:2});
      mfmSkSynth('dblclick',o.x,o.y,{detail:2});return;
    }
    mfmS.lastTap={t:now,x:o.x,y:o.y};
    mfmSkSynth('pointermove',o.x,o.y);mfmSkSynth('pointerdown',o.x,o.y);mfmSkSynth('pointerup',o.x,o.y);
    mfmSkSynth('click',o.x,o.y);
  };
  window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',up,true);
  window.addEventListener('contextmenu',e=>{
    if(mfmOn&&e.isTrusted&&inSvg(e)){e.preventDefault();e.stopPropagation();} // menu natif de l'appui long
  },true);
}
/* ---- branchement (appelé par mfmBuild) ---- */
function mfmPhase23(){
  mfmCss2();
  window.mfmEdgeK=2.5; // arêtes : tolérance ×2,5 au doigt (edgePickScreen)
  // barre du haut : Abandonner · liste · Terminer pendant une esquisse
  const top=document.getElementById('mfmTop');
  if(top){
    ['mfmMenuBtn','mfmName'].forEach(id=>{const n=document.getElementById(id);if(n)n.classList.add('mfmSkHide');});
    const sp=document.createElement('span');sp.className='mfmSkOnly';sp.style.flex='1';top.insertBefore(sp,document.getElementById('mfmName'));
    const c=document.createElement('button');c.id='mfmSkCancel';c.className='mfmSkOnly';c.textContent='Abandonner';
    c.onclick=()=>mfClick('skCancel');top.insertBefore(c,top.firstChild);
    const l=mfmBtn(top,'tree','',()=>mfmSheetToggle('sk'),'mfmSkList');l.classList.add('mfmSkOnly');l.title='Contraintes et cotes';
    const ok=document.createElement('button');ok.id='mfmSkOk';ok.className='mfmSkOnly';ok.textContent='✔ Terminer';
    ok.onclick=()=>mfClick('skOk');top.appendChild(ok);
  }
  mfmSkSheetBuild();
  new MutationObserver(()=>{const on=document.body.classList.contains('mf-sk');if(on!==mfmSkWas){mfmSkWas=on;mfmSkSync();}})
    .observe(document.body,{attributes:true,attributeFilter:['class']});
  mfmSkTouchWire();
}
let mfmSkWas=false;
