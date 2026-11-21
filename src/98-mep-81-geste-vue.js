  /* ═══════════════ panoramique et zoom par la carte graphique (V0.99.55) ═══════════════
     Avant : chaque cran de molette et chaque pas du panoramique refaisaient toute la planche (mepRender)
     puis le navigateur la repeignait en entier à la nouvelle échelle, sur un seul cœur.
     Ici, pendant le geste, l'image déjà peinte est seulement déplacée / agrandie (transformation CSS de
     #mepSvg, calque composé par la carte graphique) ; la planche est redessinée nette une fois, quand le
     geste s'arrête (MEP_GESTE_MS sans molette, ou bouton relâché).
     Le viewBox reste celui de l'image peinte : mepPt et mepPxToMm calculent le point visé avec le cadrage
     voulu (mepSt.pan / mepSt.zoom), comme si la planche était déjà redessinée.
     ?sansgeste : comme V0.99.54. */
  const MEP_GESTE_MS=160;
  let mepGesteOff=false;
  try{mepGesteOff=/[?&]sansgeste\b/.test(String(location.search||''));}catch(e){}
  let mepGeste=null; // {vb0:{x,y,width,height}, w, h, t}
  function mepGesteMeet(vb,w,h){
    // cadrage « meet » centré du viewBox dans la zone (w × h px) : écran = o + s·mm
    const s=Math.min(w/vb.width,h/vb.height)||1;
    return{s,ox:(w-vb.width*s)/2-vb.x*s,oy:(h-vb.height*s)/2-vb.y*s};
  }
  function mepGesteVb(){const pg=mepPage();return{x:pg.vb[0],y:pg.vb[1],width:pg.vb[2],height:pg.vb[3]};}
  function mepGesteMs(){try{return +window.__mepGesteMs||MEP_GESTE_MS;}catch(e){return MEP_GESTE_MS;}} // tests : délai allongé
  // point écran → mm papier dans le cadrage voulu (pendant un geste)
  function mepGestePt(ev){
    const r=mepSheetEl.getBoundingClientRect();
    const M=mepGesteMeet(mepGesteVb(),mepGeste.w,mepGeste.h);
    const px=ev.clientX-r.left,py=ev.clientY-r.top;
    return{x:(px-M.ox)/M.s,y:(py-M.oy)/M.s,px,py};
  }
  function mepGestePxMm(){return 1/mepGesteMeet(mepGesteVb(),mepGeste.w,mepGeste.h).s;}
  function mepVueGeste(){
    // pan / zoom changés : image déplacée tout de suite, planche redessinée à la fin du geste
    if(mepGesteOff||!mepSvgEl||!mepSheetEl||!mepSt.open){mepRender();return;}
    if(!mepGeste){
      const R=mepSheetEl.getBoundingClientRect(),w=R.width,h=R.height; // taille exacte (clientWidth est arrondi)
      if(!(w>0&&h>0)){mepRender();return;}
      mepGeste={vb0:mepSvgViewBox(),w,h,t:0};
      const st=mepSvgEl.style;
      st.transformOrigin='0 0';st.willChange='transform';st.overflow='visible';
    }
    const G=mepGeste;
    const A=mepGesteMeet(G.vb0,G.w,G.h),B=mepGesteMeet(mepGesteVb(),G.w,G.h);
    const k=B.s/A.s,tx=B.ox-k*A.ox,ty=B.oy-k*A.oy;
    mepSvgEl.style.transform='matrix('+k+',0,0,'+k+','+tx+','+ty+')';
    try{mepRulers();}catch(e){}
    clearTimeout(G.t);
    G.t=setTimeout(mepVueGesteFin,mepGesteMs());
  }
  function mepVueGesteLache(){
    // fin du geste sans redessiner (le rendu qui suit remet tout en place)
    if(!mepGeste)return;
    clearTimeout(mepGeste.t);mepGeste=null;
    const st=mepSvgEl.style;st.transform='';st.willChange='';st.overflow='';st.transformOrigin='';
  }
  function mepVueGesteFin(){
    if(!mepGeste)return;
    if(mepSt.pick&&mepSt.pick.kind==='pan'){clearTimeout(mepGeste.t);mepGeste.t=setTimeout(mepVueGesteFin,mepGesteMs());return;}
    mepVueGesteLache();
    try{const pg=mepPage();mepSvgEl.setAttribute('viewBox',pg.vb.map(v=>+v.toFixed(3)).join(' '));}catch(e){}
    try{mepRender();}catch(e){}
  }
