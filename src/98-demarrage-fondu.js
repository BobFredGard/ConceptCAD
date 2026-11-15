/* ---------- Démarrage et ouverture : logo pendant le chargement, puis fondu vers la pièce ----------
   2026-10-16-015 : la vue 3D restait invisible tant que le noyau n'avait pas recalculé la pièce en exact.
   V0.99.11 (demande de Fred) :
   • DÉMARRAGE : l'écran de présentation (#mfSplash) reste affiché jusqu'à la pièce chargée en exact,
     puis fondu croisé écran de présentation → vue 3D. S'il est passé (clic, Échap), le logo attend dans la vue.
   • OUVERTURE d'une autre pièce : la vue 3D devient floue, le logo s'affiche par-dessus ; à la fin du
     chargement, le logo s'efface pendant que la vue redevient nette sur la nouvelle pièce. Plus de
     retour de l'ancienne pièce : le filet de secours (4 s) la ré-affichait au milieu d'un long rejeu ;
     il attend désormais que le rejeu soit fini (120 s au plus).
   Garde-fous : noyau en échec → on montre le maillage ; 60 s au plus au démarrage. */
let bootVeilOn=false,viewLoadOn=false,viewLoadTimer=null,mfLogoVeil=null;
function mfLogoCss(){
  if(document.getElementById('mfLogoCss'))return;
  const st=document.createElement('style');st.id='mfLogoCss';
  st.textContent=[
    '.mfLV{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;pointer-events:none;opacity:0;transition:opacity .35s ease;color:var(--muted,#8e8e93);font-size:.85rem;letter-spacing:.03em}',
    '.mfLV.on{opacity:1}.mfLV.off{opacity:0;transition:opacity 1s ease}',
    '.mfLV .mk{position:relative;width:72px;height:72px;animation:mfLvIn .6s cubic-bezier(.2,.9,.25,1.15) both}',
    '.mfLV .gl{position:absolute;inset:-34px;border-radius:50%;background:radial-gradient(closest-side,rgba(10,132,255,.35),transparent 70%);animation:mfLvPulse 2.4s ease-in-out infinite}',
    '.mfLV .ha{position:absolute;inset:-22px;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 55%,rgba(10,132,255,.55) 72%,rgba(94,92,230,.9) 82%,transparent 92%);-webkit-mask:radial-gradient(closest-side,transparent 86%,#000 88%,#000 92%,transparent 94%);mask:radial-gradient(closest-side,transparent 86%,#000 88%,#000 92%,transparent 94%);animation:mfLvSpin 1.6s linear infinite}',
    '.mfLV .sq{position:absolute;inset:0;border-radius:17px;border:3px solid rgba(245,245,247,.92);overflow:hidden;box-shadow:0 12px 40px rgba(10,132,255,.25)}',
    '.mfLV .h1{position:absolute;left:0;top:0;bottom:0;width:50%;background:linear-gradient(160deg,#3aa0ff,#0a84ff 45%,#5e5ce6)}',
    '.mfLV .h2{position:absolute;right:0;top:0;bottom:0;width:50%;background:linear-gradient(160deg,#ffa53a,#ff8a00 55%,#f06a00)}',
    '.mfLV .ct{position:absolute;left:50%;top:-10%;bottom:-10%;width:3px;margin-left:-1.5px;background:rgba(245,245,247,.92)}',
    '.mfLV .sh{position:absolute;inset:-20%;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);transform:translateX(-120%);animation:mfLvShine 2.2s ease-in-out .4s infinite}',
    '.mfLV .tx{text-shadow:0 1px 8px rgba(0,0,0,.35)}',
    '@keyframes mfLvIn{from{opacity:0;transform:scale(.7)}}',
    '@keyframes mfLvSpin{to{transform:rotate(360deg)}}',
    '@keyframes mfLvPulse{50%{transform:scale(1.15);opacity:.55}}',
    '@keyframes mfLvShine{0%{transform:translateX(-120%)}45%,100%{transform:translateX(120%)}}',
    '@media(prefers-reduced-motion:reduce){.mfLV *{animation:none!important}}'
  ].join('\n');
  try{document.head.appendChild(st);}catch(e){}
}
function mfLogoShow(texte,fond){
  // Logo ConceptCAD au milieu de la vue 3D (fond : couleur de la scène, ou transparent sur la vue floue)
  try{
    const wrap=document.getElementById('vpwrap');if(!wrap||!wrap.appendChild)return null;
    mfLogoCss();
    let v=mfLogoVeil;
    if(!v||!v.parentNode){
      v=document.createElement('div');v.className='mfLV';
      v.innerHTML='<div class="mk"><div class="gl"></div><div class="ha"></div><div class="sq"><div class="h1"></div><div class="h2"></div><div class="ct"></div><div class="sh"></div></div></div><div class="tx"></div>';
      wrap.appendChild(v);mfLogoVeil=v;
    }
    v.classList.remove('off');
    v.style.background=fond||'transparent';
    v.querySelector('.tx').textContent=texte||'';
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{try{v.classList.add('on');}catch(e){}});else v.classList.add('on');
    return v;
  }catch(e){return null;}
}
function mfLogoText(t){try{if(mfLogoVeil)mfLogoVeil.querySelector('.tx').textContent=t;}catch(e){}}
function mfLogoHide(){
  const v=mfLogoVeil;mfLogoVeil=null;if(!v)return;
  try{v.classList.remove('on');v.classList.add('off');setTimeout(()=>{try{v.remove();}catch(e){}},1050);}catch(e){}
}
function mfSceneBg(){try{return '#'+scene.background.getHexString();}catch(e){return '#1c1c1e';}}
function viewFadeOut(){
  // Ouverture d'un modèle : vue 3D floue (l'ancien modèle ne se lit plus), logo par-dessus
  try{
    if(bootVeilOn)return;const cv=document.getElementById('viewport');if(!cv||!cv.style)return;
    viewLoadOn=true;
    cv.style.transition='filter .35s ease,opacity .35s ease';cv.style.filter='blur(18px) saturate(.6)';cv.style.opacity='.45';
    mfLogoShow('Ouverture de la pièce…');
    // Filet : ouverture en échec. On n'ouvre la vue qu'une fois le rejeu (barre de progression) fini
    // depuis 3 s — l'ancien filet de 4 s ré-affichait l'ancienne pièce en plein rejeu.
    clearInterval(viewLoadTimer);const t0=Date.now();let calme=0;
    viewLoadTimer=setInterval(()=>{try{
      if(!viewLoadOn){clearInterval(viewLoadTimer);return;}
      const occupe=(typeof regenRun!=='undefined'&&regenRun)||(typeof regenUi!=='undefined'&&regenUi);
      calme=occupe?0:calme+250;
      if(calme>=3000||Date.now()-t0>120000)viewFadeIn();
    }catch(e){viewFadeIn();}},250);
  }catch(e){}
}
function viewFadeIn(){
  // … puis la vue redevient nette pendant que le logo s'efface, une fois le nouveau modèle reconstruit
  try{
    if(bootVeilOn)return;clearInterval(viewLoadTimer);
    const cv=document.getElementById('viewport');if(!cv||!cv.style)return;
    if(!viewLoadOn&&cv.style.opacity!=='0'&&!cv.style.filter)return;
    viewLoadOn=false;
    const go=()=>{cv.style.transition='filter 1s ease,opacity 1s ease';cv.style.filter='';cv.style.opacity='1';mfLogoHide();};
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(go));else go();
  }catch(e){}
}
(function(){
  try{
    const cv=document.getElementById('viewport'),wrap=document.getElementById('vpwrap');
    if(!cv||!cv.style||typeof setInterval!=='function')return;
    cv.style.opacity='0';cv.style.transition='opacity .9s ease';bootVeilOn=true;
    // Logo dans la vue (vu seulement si l'écran de présentation a été passé)
    mfLogoShow('Chargement du noyau 3D…',mfSceneBg());
    const st=document.getElementById('mfSplashSt');
    let etat='';
    const dire=t=>{if(t===etat)return;etat=t;mfLogoText(t);try{if(st)st.textContent=t;}catch(e){}};
    const t0=Date.now();
    const reveal=()=>{
      clearInterval(iv);bootVeilOn=false;
      // fondu croisé : l'écran de présentation s'efface pendant que la pièce apparaît
      const go=()=>{cv.style.transition='opacity 1.1s ease';cv.style.opacity='1';mfLogoHide();};
      if(typeof window.__mfSplashDone==='function'&&document.getElementById('mfSplash')){dire('Prêt');window.__mfSplashDone();setTimeout(go,250);}
      else go();
    };
    const iv=setInterval(()=>{
      try{
        const dt=Date.now()-t0;
        const pret=typeof occtReady!=='undefined'&&occtReady;
        const ready=pret&&((typeof builtEngine!=='undefined'&&builtEngine==='exact')||!((doc&&doc.features)||[]).length);
        const failed=typeof occBaseMsg==='string'&&/échec|impossible|absent|incomplet/i.test(occBaseMsg);
        if(!ready)dire(pret?'Calcul de la pièce…':'Chargement du noyau 3D…');
        if(ready||failed||dt>60000)reveal();
      }catch(e){reveal();}
    },150);
  }catch(e){}
})();
