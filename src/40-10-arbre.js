/* ---------- arbre + timeline + props ---------- */
let repMode=null;
// ── CSS panneau Paramètres (aside.right #props) : MÊME style que le panneau
//    « Paramètres — Plan » de l'espace PLAN (98-mep-*.js) — sections,
//    rangées label/control, cases alignées, boutons d'action groupés.
(function(){
  try{
    if(typeof document==='undefined'||document.getElementById('cssPropsPlan'))return;
    const st=document.createElement('style');st.id='cssPropsPlan';
    st.textContent=
      /* sections */
      '#props .pnl-h{margin:10px 0 4px;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600}'+
      /* rangées label + contrôle */
      '#props .pnl-row{display:flex;gap:5px;align-items:center;margin:4px 0;flex-wrap:wrap}'+
      '#props .pnl-row>pnl-lab,#props .pnl-row>label{flex:1;min-width:0;color:var(--muted);font-size:.74rem;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
      '#props .pnl-row>input[type=text],#props .pnl-row>input[type=number],#props .pnl-row>input[data-fxnum],#props .pnl-row>select{max-width:130px;padding:3px 6px;font-size:.72rem;border:1px solid var(--border);border-radius:5px;background:var(--bg);color:var(--text);width:auto;flex:none}'+
      '#props .pnl-row>input[type=checkbox]{max-width:none;flex:none;margin-left:auto}'+
      /* boutons d'action (Cadrer / Rejeter / Supprimer…) */
      '#props .pnl-btns{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}'+
      '#props .pnl-btns button{padding:3px 8px;font-size:.71rem;border:1px solid var(--border);background:none;color:var(--text);border-radius:6px;cursor:pointer}'+
      '#props .pnl-btns button:hover{border-color:var(--primary)}'+
      '#props .pnl-btns button.danger{border-color:#ff453a;color:#ff453a}'+
      /* note d'aide */
      '#props .pnl-note{color:var(--muted);font-size:.68rem;margin:4px 0;line-height:1.35}'+
      /* les anciens .row/.col du panneau héritent aussi du style compact */
      '#props .row{display:flex;gap:5px;align-items:center;margin:4px 0;flex-wrap:wrap}'+
      '#props .row>label{flex:1;min-width:0;color:var(--muted);font-size:.74rem}'+
      '#props button{padding:3px 8px;font-size:.71rem;border:1px solid var(--border);background:none;color:var(--text);border-radius:6px;cursor:pointer}'+
      '#props button:hover{border-color:var(--primary)}'+
      '#props .note{font-size:.68rem;color:var(--muted);margin:4px 0;display:block;line-height:1.35}';
    (document.head||document.body||document.documentElement).appendChild(st);
  }catch(e){}
})();
// ── Barres de défilement de l'arbre (#treeOverlay) et du panneau FAO
//    (#faoTreeWrap .fao-cnt) : thème cohérent (pouce = --muted, piste transparente),
//    MASQUÉES par défaut, visibles 1,2 s à chaque défilement (molette / tactile).
(function(){
  try{
    if(typeof document==='undefined'||document.getElementById('cssScrollbars'))return;
    const st=document.createElement('style');st.id='cssScrollbars';
    st.textContent=
      /* Firefox : barre entièrement masquée par défaut */
      '#treeOverlay,#faoTreeWrap .fao-cnt{scrollbar-width:none;-ms-overflow-style:none}'+
      /* WebKit : piste et pouce transparents par défaut, la piste garde sa zone de clic */
      '#treeOverlay::-webkit-scrollbar,#faoTreeWrap .fao-cnt::-webkit-scrollbar{width:8px;height:8px}'+
      '#treeOverlay::-webkit-scrollbar-track,#faoTreeWrap .fao-cnt::-webkit-scrollbar-track{background:transparent}'+
      '#treeOverlay::-webkit-scrollbar-thumb,#faoTreeWrap .fao-cnt::-webkit-scrollbar-thumb{background:transparent;border-radius:4px;transition:background .2s}'+
      /* classe .sbOn posée 1,2 s au défilement : la barre apparaît dans le thème */
      '#treeOverlay.sbOn,#faoTreeWrap .fao-cnt.sbOn{scrollbar-width:thin;scrollbar-color:var(--muted) transparent}'+
      '#treeOverlay.sbOn::-webkit-scrollbar-thumb,#faoTreeWrap .fao-cnt.sbOn::-webkit-scrollbar-thumb{background:var(--muted)}'+
      '#treeOverlay.sbOn::-webkit-scrollbar-thumb:hover,#faoTreeWrap .fao-cnt.sbOn::-webkit-scrollbar-thumb:hover{background:var(--text)}';
    (document.head||document.body||document.documentElement).appendChild(st);
    let t=null;
    const show=function(el){
      if(!el||!el.classList)return;
      el.classList.add('sbOn');
      if(t)clearTimeout(t);
      t=setTimeout(function(){ try{ if(el.classList)el.classList.remove('sbOn'); }catch(e){} t=null; },1200);
    };
    const bind=function(){
      try{
        const a=document.getElementById('treeOverlay');
        if(a&&!a._sbBound){ a._sbBound=1; a.addEventListener('scroll',function(){show(a);}); }
      }catch(e){}
      try{
        const f=document.querySelector('#faoTreeWrap .fao-cnt');
        if(f&&!f._sbBound){ f._sbBound=1; f.addEventListener('scroll',function(){show(f);}); }
      }catch(e){}
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);
    else bind();
    setTimeout(bind,600);setTimeout(bind,2500); // la FAO est créée plus tard par 88-fao.js
  }catch(e){}
})();
// Marques « source de la répétition » : styles injectés depuis le code, la coque
// HTML/CSS du livrable généré n'étant jamais éditée à la main (même règle que le
// bouton Révolution, 30h).
(function(){
  try{
    if(typeof document==='undefined'||document.getElementById('cssRepSrc'))return;
    const st=document.createElement('style');st.id='cssRepSrc';
    st.textContent='.repsrc{font-size:.72rem;font-weight:700;margin-left:4px;color:#7ee0c0;}'+
      '.repsrc.vide{color:#ff9f6e;}'+
      '.srcmark{color:#7ee0c0;font-weight:700;margin-right:2px;}';
    (document.head||document.body||document.documentElement).appendChild(st);
  }catch(e){}
})();
// Bandeau de CORPS (🧱) : fond teinté, nom en gras, ⏻ de rejeu et 👁 de vue
// distincts. Injecté depuis le code — la coque HTML/CSS du livrable généré n'est
// jamais éditée à la main (même règle que cssRepSrc ci-dessus).
(function(){
  try{
    if(typeof document==='undefined'||document.getElementById('cssTreeBody'))return;
    const st=document.createElement('style');st.id='cssTreeBody';
    st.textContent=
      '.tnode.bh{background:linear-gradient(90deg,rgba(142,142,147,.13),rgba(142,142,147,0))}'+
      '.tnode.bh .nm,.tnode.bh>span:nth-child(2){font-weight:700}'+
      '.tnode.bh .tri{opacity:.75}'+
      '.tnode.bh.off .nm{opacity:.6}'+
      '.tnode.bh.gone .nm{opacity:.6;text-decoration:line-through}'+
      '.tnode .pwr{cursor:pointer;user-select:none;font-size:.8rem;opacity:.34;filter:grayscale(1)}'+
      '.tnode .pwr.on{opacity:1;filter:none;color:var(--accent)}'+
      '.tnode .eye{cursor:pointer;user-select:none}'+
      '.tnode.bh.hidden .pwr{filter:none;opacity:.6}'+
      // V0.23.26 : œil BARRÉ grisé (remplace 🙈) ; transparent aux clics, la cible reste .eye
      '.eyeoff{position:relative;display:inline-block;pointer-events:none;filter:grayscale(1);opacity:.5}'+
      '.eyeoff::after{content:"";position:absolute;left:-2px;right:-2px;top:50%;border-top:1.7px solid #8e8e93;transform:rotate(-38deg)}';
    (document.head||document.body||document.documentElement).appendChild(st);
  }catch(e){}
})();
const EYE_OFF='<span class="eyeoff">👁</span>'; // œil des arbres, élément masqué
// Sélection MULTIPLE de fonctions (Ctrl+clic) + suppression au clavier (Suppr).
// `sel` reste le modèle simple utilisé partout ailleurs (panneau, outils) : la
// multi-sélection est un état parallèle, jamais une refonte de `sel`.
// L'annulation, elle, est celle du DOCUMENT (voir 45-annuler-document.js) : pas
// de pile locale ici, sinon deux historiques qui se désynchronisent.
let treeSel=[];   // ids de fonctions, dans l'ordre de clic
// Un glyphe par TYPE de fonction ; l'œil (👁 / barré) reste, lui, exclusivement la
// visibilité. Fonction globale : servant aussi à la liste de sources de la
// répétition, qui vit hors de renderTree.
function featIconOf(f){
  if(!f)return '◧';
  if(f.type==='import'&&f.derive){const L=derLinkOf(f);return '🔗'+(!L||L.st==='warn'?'⚠':'');} // corps dérivé (52)
  if(f.type==='extrude')return (f.op||'add')==='cut'?'▾':'▤';
  if(f.type==='xfillet')return xIcon(xKindOf(f))+((f._m&&f._m.m<f._m.t)||f._err||f._adj?'⚠':'');
  if(f.type==='fillet')return xIcon(xKindOf(f));
  if(f.type==='repeat')return '🔁';
  if(f.type==='combine')return f.mode==='cut'?'⊖':(f.mode==='intersect'?'⊗':'⊕');
  if(f.type==='revolve')return (f.op||'add')==='cut'?'◔':'◍';
  if(f.type==='sweep')return (f.op||'add')==='cut'?'≋':'〰';
  if(f.type==='hole')return '⊚';
  if(f.kwKey)return '🔑'; // clavette, corps séparé (76-clavette)
  if(f.kw)return '⊟'; // rainure de clavette
  if(f.type==='xthread')return f._err?'⚠':'🔩'; // filetage d'un axe (76-filetage)
  if(f.type==='gear')return f._err?'⚠':'⚙️'; // engrenage (76-engrenage)
  if(f.type==='xmove')return '📐';
  if(f.type==='bmove')return '✥';
  if(f.type==='bremove')return '⊘';
  if(f.type==='bscale')return f._err?'⚠':'⤡';
  if(f.type==='xdelface')return f._calc?'⏳':((f._m&&f._m.m<f._m.t)||f._err)?'⚠':'⌫'; // ⏳ : calcul au worker (21)
  if(f.type==='xdraft')return ((f._m&&f._m.m<f._m.t)||f._err||f._thin)?'⚠':'📐';
  if(f.type==='xshell')return ((f._m&&f._m.m<f._m.t)||f._err)?'⚠':'🥚';
  if(f.type==='xsplit')return ((f._m&&f._m.m<f._m.t)||f._err)?'⚠':'✂';
  return '◧';
}
function renderTree(){
  // L'arbre est construit par le modèle générique (42-arbre-modele.js : treeModel → treeDraw)
  treeRender();
  try{mfFaoGate();}catch(e){} // V0.21.11 : FAO grisé sans pièce active (97)
}
