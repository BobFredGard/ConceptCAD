  /* ═══════════════ traits des vues regroupés et gardés (V0.99.55) ═══════════════
     Demande de Fred : « niveau mise en plan chargé, avec SIRAP-14-002 par exemple, le GPU n'est utilisé
     qu'à 1/3 et la page n'est pas fluide ». La planche « Plaque de Base » comptait 13 500 éléments SVG
     (un <line> par segment d'arête), tous recréés à chaque rendu : cran de molette, pas du panoramique,
     survol. Ici :
     - les segments qui se suivent avec la même classe ne font qu'un <path> (un sous-chemin M…L par
       segment : pointillés, bouts ronds et ordre de peinture inchangés) ; cercles et arcs restent des
       éléments à part (l'export DXF les relit comme CIRCLE / arcs exacts) ;
     - le bloc d'une vue est gardé tant que sa géométrie (mepGeoOf), sa position et son échelle ne
       changent pas : un rendu le raccroche au lieu de le refaire ;
     - sélection et survol d'une arête sont redessinés par-dessus, seuls (même classe qu'avant).
     ?sanstraitsgroupes : comme V0.99.54. */
  let mepEntsOff=false;
  try{mepEntsOff=/[?&]sanstraitsgroupes\b/.test(String(location.search||''));}catch(e){}
  const mepEntsMemo=new WeakMap(); // géométrie de vue → {key, els, n, node}
  function mepEntCls(e){
    return e.k==='hidden'||e.k==='threadH'?'mepEnt mepHidden':e.k==='thread'?'mepEnt mepThread':e.k==='tangent'?'mepEnt mepTangent':
      e.k==='sect'?'mepEnt mepSect':e.k==='brk'?'mepEnt mepBrk':'mepEnt mepSharp';
  }
  function mepEntEl(mk,e,X,Y,cls){
    // un élément par entité (tracé d'avant V0.99.55)
    if(e.t==='L')mk('line',{x1:+X(e.x1).toFixed(3),y1:+Y(e.y1).toFixed(3),x2:+X(e.x2).toFixed(3),y2:+Y(e.y2).toFixed(3),class:cls});
    else if(e.t==='C')mk('circle',{cx:+X(e.cx).toFixed(3),cy:+Y(e.cy).toFixed(3),r:+(e.r*mepEntSc).toFixed(3),class:cls});
    else if(e.t==='A'){
      const x0=+X(e.cx+e.r*Math.cos(e.a0)).toFixed(3),y0=+Y(e.cy+e.r*Math.sin(e.a0)).toFixed(3);
      const x1=+X(e.cx+e.r*Math.cos(e.a1)).toFixed(3),y1=+Y(e.cy+e.r*Math.sin(e.a1)).toFixed(3);
      const rr=+(e.r*mepEntSc).toFixed(3);
      const la=Math.abs(e.a1-e.a0)>Math.PI?1:0,sw=e.a1>e.a0?1:0;
      mk('path',{d:'M'+x0+' '+y0+' A'+rr+' '+rr+' 0 '+la+' '+sw+' '+x1+' '+y1,class:cls});
    }
    else if(e.t==='P'&&e.pts&&e.pts.length>1){
      for(let k=0;k+1<e.pts.length;k++)
        mk('line',{x1:+X(e.pts[k][0]).toFixed(3),y1:+Y(e.pts[k][1]).toFixed(3),x2:+X(e.pts[k+1][0]).toFixed(3),y2:+Y(e.pts[k+1][1]).toFixed(3),class:cls});
    }
  }
  let mepEntSc=1; // échelle de la vue en cours (rayons)
  function mepEntsBuild(mk,g,X,Y){
    const node=mk('g',{class:'mepEntsG'});
    const add=(tag,attrs)=>mk(tag,attrs,node);
    let cur=null,d=[];
    const flush=()=>{if(d.length)add('path',{d:d.join(''),class:cur});d=[];cur=null;};
    const seg=(a,b,c,e)=>{d.push('M'+(+X(a).toFixed(3))+' '+(+Y(b).toFixed(3))+'L'+(+X(c).toFixed(3))+' '+(+Y(e).toFixed(3)));};
    for(const e of g.els){
      const c=mepEntCls(e);
      if(e.t==='L'||(e.t==='P'&&e.pts&&e.pts.length>1)){
        if(c!==cur){flush();cur=c;}
        if(e.t==='L')seg(e.x1,e.y1,e.x2,e.y2);
        else for(let k=0;k+1<e.pts.length;k++)seg(e.pts[k][0],e.pts[k][1],e.pts[k+1][0],e.pts[k+1][1]);
      }else{flush();mepEntEl(add,e,X,Y,c);}
    }
    flush();
    return node;
  }
  function mepEntsDraw(mk,v,g,X,Y){
    mepEntSc=v.scale;
    const els=g.els||[];
    // entités sélectionnées (jaune) et survolée (bleu) de cette vue
    const sel=new Set();
    (mepSt.entSel||[]).forEach(s=>{if(s&&s.vid===v.id&&typeof s.i==='number'){const e=els[s.i];if(e&&(!s.sig||s.sig===mepEntSig(e)))sel.add(s.i);}});
    const ip=mepSt.intPick;if(ip&&ip.vid===v.id&&typeof ip.i==='number'&&els[ip.i])sel.add(ip.i);
    const hv=mepSt.hovEnt;let hov=-1;
    if(hv&&hv.vid===v.id&&typeof hv.i==='number'&&!sel.has(hv.i)){const e=els[hv.i];if(e&&(!hv.sig||hv.sig===mepEntSig(e)))hov=hv.i;}
    if(mepEntsOff){
      els.forEach((e,ei)=>mepEntEl(mk,e,X,Y,mepEntCls(e)+(sel.has(ei)?' mepSelEnt':(ei===hov?' mepHovEnt':''))));
      return;
    }
    const key=v.x+'|'+v.y+'|'+v.scale;
    const c=mepEntsMemo.get(g);
    if(c&&c.key===key&&c.els===els&&c.n===els.length)mepGSheet.appendChild(c.node);
    else mepEntsMemo.set(g,{key,els,n:els.length,node:mepEntsBuild(mk,g,X,Y)});
    if(hov>=0)mepEntEl(mk,els[hov],X,Y,mepEntCls(els[hov])+' mepHovEnt');
    sel.forEach(i=>mepEntEl(mk,els[i],X,Y,mepEntCls(els[i])+' mepSelEnt'));
  }
