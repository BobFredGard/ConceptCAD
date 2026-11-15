/* ----- V0.99.8 : liste déroulante à étiquettes animées (Mode de vidage de l'ébauche 3D) -----
   Une liste native n'émet aucun survol sur ses options : faoSelAnim garde le <select>
   d'origine (valeur, onchange, clavier, tests) mais ouvre à la souris une liste maison.
   Survoler un choix montre une étiquette : son nom, son explication et un petit dessin
   animé du parcours vu de dessus (la fraise trace ses passes ; tirets = déplacement à vide,
   point rouge = descente dans la matière).
   Dessins : vraies lignes de niveau d'un champ de distance (parois + îlot), pas des
   formes approchées — l'Escargot montre bien les anneaux qui entourent l'îlot puis
   rejoignent ceux de la paroi. */
const FAO_ANIM_W=160, FAO_ANIM_H=100;
const FAO_ANIM_ZONE={x0:10,y0:10,x1:150,y1:90};
const FAO_ANIM_ISLE={x:112,y:50,r:9};
let faoAnimCache={}, faoAnimList=null, faoAnimCard=null, faoAnimOff=null;

// Lignes de niveau D=lv d'un champ (marching squares, pas de 1), chaînées en boucles.
function faoAnimIso(D,lv){
  const segs=[], W=FAO_ANIM_W, H=FAO_ANIM_H;
  const v=function(x,y){ return D(x,y)-lv; };
  const lerp=function(ax,ay,av,bx,by,bv){ const t=av/(av-bv); return [ax+(bx-ax)*t,ay+(by-ay)*t]; };
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const a=v(x,y),b=v(x+1,y),c=v(x+1,y+1),d=v(x,y+1);
    const e=[];
    if((a<0)!==(b<0))e.push(lerp(x,y,a,x+1,y,b));
    if((b<0)!==(c<0))e.push(lerp(x+1,y,b,x+1,y+1,c));
    if((c<0)!==(d<0))e.push(lerp(x+1,y+1,c,x,y+1,d));
    if((d<0)!==(a<0))e.push(lerp(x,y+1,d,x,y,a));
    if(e.length===2)segs.push(e);
    else if(e.length===4){ segs.push([e[0],e[1]]); segs.push([e[2],e[3]]); }
  }
  const k=function(p){ return Math.round(p[0]*1000)+','+Math.round(p[1]*1000); };
  const by={}; segs.forEach(function(s,i){ [0,1].forEach(function(j){ const q=k(s[j]); (by[q]=by[q]||[]).push(i); }); });
  const used=new Array(segs.length).fill(false), loops=[];
  for(let i=0;i<segs.length;i++){
    if(used[i])continue; used[i]=true;
    const L=[segs[i][0],segs[i][1]];
    for(;;){ const end=L[L.length-1]; const c=(by[k(end)]||[]).find(function(j){ return !used[j]; });
      if(c===undefined)break; used[c]=true;
      L.push(k(segs[c][0])===k(end)?segs[c][1]:segs[c][0]); }
    if(L.length>6)loops.push(L.filter(function(p,j){ return j%2===0||j===L.length-1; }));
  }
  return loops;
}
function faoAnimDist(isle){
  const Z=FAO_ANIM_ZONE, I=FAO_ANIM_ISLE;
  return function(x,y){
    let d=Math.min(x-Z.x0,Z.x1-x,y-Z.y0,Z.y1-y);
    if(isle)d=Math.min(d,Math.hypot(x-I.x,y-I.y)-I.r);
    return d; };
}
function faoAnimNear(L,p){ // fait commencer la boucle L au point le plus proche de p
  let bi=0,bd=Infinity; L.forEach(function(q,i){ const d=Math.hypot(q[0]-p[0],q[1]-p[1]); if(d<bd){bd=d;bi=i;} });
  const R=L.slice(bi).concat(L.slice(1,bi+1)); return R;
}
function faoAnimSpiral(cx,cy,r1,turns,a0){
  const P=[], n=Math.round(turns*40);
  for(let i=0;i<=n;i++){ const t=i/n, a=(a0||0)+t*turns*2*Math.PI; P.push([cx+r1*t*Math.cos(a),cy+r1*t*Math.sin(a)]); }
  return P;
}
// Parcours d'un mode : liste de morceaux {p:[[x,y]..], k:'cut'|'rapid'|'glide'|'helix'}
function faoAnimPaths(mode){
  if(faoAnimCache[mode])return faoAnimCache[mode];
  const out=[]; let last=null;
  const add=function(p,kd){ if(!p.length)return;
    if(last){ const g=Math.hypot(p[0][0]-last[0],p[0][1]-last[1]);
      if(g>0.5)out.push({p:[last,p[0]],k:(kd==='glide'?'link':'rapid')}); }
    out.push({p:p,k:(kd==='glide'?'cut':kd)}); last=p[p.length-1]; };
  if(mode==='escargot'){ // Trochoïdal : spirale centrale puis demi-anneaux gauche, puis droite
    const cx=80,cy=50,lim=function(q){ return [Math.max(14,Math.min(146,q[0])),Math.max(14,Math.min(86,q[1]))]; };
    add([[cx,cy]],'helix');
    add(faoAnimSpiral(cx,cy,30,3,-Math.PI/2-6*Math.PI),'cut'); // finit en haut : départ des demi-anneaux
    [-1,1].forEach(function(s){
      for(let r=38;r<=66;r+=7){
        // demi-anneau du haut vers le bas, côté gauche (s<0) puis côté droit
        const P=[]; for(let i=0;i<=30;i++){ const ang=-Math.PI/2+s*i/30*Math.PI;
          P.push(lim([cx+r*Math.cos(ang),cy+r*Math.sin(ang)])); }
        add(P,'cut');
      }
    });
    add(faoAnimNear([[14,14],[146,14],[146,86],[14,86],[14,14]],last),'cut'); // passe finale le long des faces
  }else{
    const D=faoAnimDist(true);
    const lv=[]; for(let l=34;l>=4;l-=6)lv.push(l);
    const start=[56,50]; // centre du plateau le plus loin des parois et de l'îlot
    add([start],'helix');
    add(faoAnimSpiral(start[0],start[1],5,1.25,0),'cut');
    lv.forEach(function(l){
      let loops=faoAnimIso(D,l);
      // boucles du niveau : la plus proche d'abord
      while(loops.length){
        let bi=0,bd=Infinity;
        loops.forEach(function(L,i){ L.forEach(function(q){ const d=Math.hypot(q[0]-last[0],q[1]-last[1]); if(d<bd){bd=d;bi=i;} }); });
        const L=faoAnimNear(loops.splice(bi,1)[0],last);
        // Escargot : chaque anneau séparé (autour de l'îlot) = nouvelle entrée ;
        // Contours : on glisse à la cote dans le déjà-vidé (aucune remontée).
        if(mode==='anneaux'&&bd>8){ add([L[0]],'helix'); add(L,'cut'); }
        else add(L,'glide');
      }
    });
  }
  faoAnimCache[mode]=out; return out;
}
function faoAnimLen(p){ let s=0; for(let i=1;i<p.length;i++)s+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]); return s; }
function faoAnimSvg(mode){
  const NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','0 0 '+FAO_ANIM_W+' '+FAO_ANIM_H); svg.setAttribute('class','fao-anim-svg');
  const el=function(t,a){ const e=document.createElementNS(NS,t); Object.keys(a).forEach(function(k){ e.setAttribute(k,a[k]); }); svg.appendChild(e); return e; };
  const Z=FAO_ANIM_ZONE, I=FAO_ANIM_ISLE;
  el('rect',{x:Z.x0,y:Z.y0,width:Z.x1-Z.x0,height:Z.y1-Z.y0,rx:2,'class':'fao-anim-zone'});
  if(mode!=='escargot')el('circle',{cx:I.x,cy:I.y,r:I.r,'class':'fao-anim-isle'});
  const parts=faoAnimPaths(mode);
  const pd=function(p){ return 'M'+p.map(function(q){ return q[0].toFixed(1)+' '+q[1].toFixed(1); }).join('L'); };
  const total=parts.reduce(function(s,c){ return s+(c.k==='helix'?14:faoAnimLen(c.p)); },0);
  const DUR=7, HOLD=1.4, T=DUR+HOLD;
  let acc=0; const motion=[];
  parts.forEach(function(c){
    const len=c.k==='helix'?14:faoAnimLen(c.p);
    const t0=acc/total*DUR, t1=(acc+len)/total*DUR; acc+=len;
    const kt0=(t0/T).toFixed(4), kt1=(t1/T).toFixed(4);
    if(c.k==='helix'){
      const g=el('circle',{cx:c.p[0][0],cy:c.p[0][1],r:0,'class':'fao-anim-entry'});
      const a=document.createElementNS(NS,'animate');
      a.setAttribute('attributeName','r'); a.setAttribute('dur',T+'s'); a.setAttribute('repeatCount','indefinite');
      a.setAttribute('values','0;0;3.2;2.2;2.2'); a.setAttribute('keyTimes','0;'+kt0+';'+kt1+';'+Math.min(0.999,+kt1+0.03).toFixed(4)+';1');
      g.appendChild(a); motion.push([c.p[0][0],c.p[0][1],t1]); return;
    }
    const L=Math.max(0.01,len);
    const p=el('path',{d:pd(c.p),'class':'fao-anim-'+c.k,'stroke-dasharray':(c.k==='rapid'?'':L.toFixed(2)+' '+L.toFixed(2))});
    if(c.k==='rapid'){ p.setAttribute('stroke-dasharray','2 2'); p.setAttribute('opacity','0');
      const a=document.createElementNS(NS,'animate'); a.setAttribute('attributeName','opacity');
      a.setAttribute('dur',T+'s'); a.setAttribute('repeatCount','indefinite');
      a.setAttribute('values','0;0;1;1'); a.setAttribute('keyTimes','0;'+kt0+';'+kt1+';1'); p.appendChild(a);
    }else{
      const a=document.createElementNS(NS,'animate'); a.setAttribute('attributeName','stroke-dashoffset');
      a.setAttribute('dur',T+'s'); a.setAttribute('repeatCount','indefinite');
      a.setAttribute('values',L.toFixed(2)+';'+L.toFixed(2)+';0;0'); a.setAttribute('keyTimes','0;'+kt0+';'+kt1+';1');
      p.appendChild(a);
    }
    c.p.forEach(function(q,i){ if(i)motion.push([q[0],q[1],t0+(t1-t0)*faoAnimLen(c.p.slice(0,i+1))/L]); else motion.push([q[0],q[1],t0]); });
  });
  // la fraise : un disque qui suit le parcours (valeurs échantillonnées, temps réels)
  const tool=el('circle',{r:3.2,'class':'fao-anim-tool'});
  const S=[]; let j=0;
  for(let i=0;i<=160;i++){ const t=i/160*T;
    while(j<motion.length-1&&motion[j+1][2]<=t)j++;
    const a=motion[j], b=motion[Math.min(j+1,motion.length-1)];
    const u=(b[2]>a[2])?Math.max(0,Math.min(1,(t-a[2])/(b[2]-a[2]))):0;
    S.push([(a[0]+(b[0]-a[0])*u).toFixed(1),(a[1]+(b[1]-a[1])*u).toFixed(1)]); }
  ['cx','cy'].forEach(function(at,ix){ const a=document.createElementNS(NS,'animate');
    a.setAttribute('attributeName',at); a.setAttribute('dur',T+'s'); a.setAttribute('repeatCount','indefinite');
    a.setAttribute('values',S.map(function(s){ return s[ix]; }).join(';')); tool.appendChild(a); });
  return svg;
}
function faoAnimStyle(){
  if(document.getElementById('faoAnimCss'))return;
  const st=document.createElement('style'); st.id='faoAnimCss';
  st.textContent=
    '.fao-anim-list{position:fixed;z-index:10000;background:rgba(28,30,34,.98);border:1px solid rgba(255,255,255,.16);'
   +'border-radius:8px;padding:4px;box-shadow:0 8px 28px rgba(0,0,0,.5);font-size:.76rem;color:#f5f5f7;'
   +'animation:faoAnimIn .14s ease-out}'
   +'.fao-anim-item{padding:6px 10px;border-radius:6px;cursor:pointer;white-space:nowrap}'
   +'.fao-anim-item:hover,.fao-anim-item.on:hover{background:#0a84ff;color:#fff}'
   +'.fao-anim-item.on{background:rgba(10,132,255,.22)}'
   +'.fao-anim-card{position:fixed;z-index:10001;width:270px;background:rgba(22,24,28,.98);border:1px solid rgba(10,132,255,.45);'
   +'border-radius:10px;padding:10px;box-shadow:0 10px 34px rgba(0,0,0,.55);color:#f5f5f7;pointer-events:none;'
   +'opacity:0;transform:translateX(-6px) scale(.97);transition:opacity .16s ease,transform .18s ease}'
   +'.fao-anim-card.vis{opacity:1;transform:none}'
   +'.fao-anim-card b{display:block;font-size:.8rem;margin-bottom:6px;color:#fff}'
   +'.fao-anim-card p{margin:7px 0 0;font-size:.71rem;line-height:1.4;color:#c7c7cc}'
   +'.fao-anim-svg{display:block;width:100%;height:auto;background:#101215;border-radius:6px}'
   +'.fao-anim-zone{fill:#3a3226;stroke:#a08a6a;stroke-width:1}'
   +'.fao-anim-isle{fill:#5b6470;stroke:#c9d1d9;stroke-width:1}'
   +'.fao-anim-cut{fill:none;stroke:#4cc2ff;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}'
   +'.fao-anim-link{fill:none;stroke:#4cc2ff;stroke-width:.8;opacity:.55}'
   +'.fao-anim-rapid{fill:none;stroke:#ffd60a;stroke-width:.8}'
   +'.fao-anim-entry{fill:none;stroke:#ff453a;stroke-width:1.4}'
   +'.fao-anim-tool{fill:#fff;stroke:#0a84ff;stroke-width:1;filter:drop-shadow(0 0 2px #4cc2ff)}'
   +'.fao-anim-leg{display:flex;gap:10px;margin-top:6px;font-size:.66rem;color:#8e8e93}'
   +'.fao-anim-leg i{display:inline-block;width:12px;height:0;border-top:2px solid;vertical-align:middle;margin-right:4px}'
   +'@keyframes faoAnimIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'
   +'body[data-theme="clair"] .fao-anim-list,body[data-theme="clair"] .fao-anim-card{background:#fff;color:#1c1c1e;border-color:rgba(0,0,0,.18)}'
   +'body[data-theme="clair"] .fao-anim-card b{color:#1c1c1e}body[data-theme="clair"] .fao-anim-card p{color:#3a3a3c}';
  document.head.appendChild(st);
}
function faoAnimClose(){
  try{ if(faoAnimList)faoAnimList.remove(); if(faoAnimCard)faoAnimCard.remove(); }catch(e){}
  faoAnimList=null; faoAnimCard=null;
  if(faoAnimOff){ faoAnimOff(); faoAnimOff=null; }
}
function faoAnimShowCard(item,o){
  if(!faoAnimCard){ faoAnimCard=document.createElement('div'); faoAnimCard.className='fao-anim-card'; document.body.appendChild(faoAnimCard); }
  const c=faoAnimCard; c.classList.remove('vis'); c.innerHTML='';
  const b=document.createElement('b'); b.textContent=o[1]; c.appendChild(b);
  c.appendChild(faoAnimSvg(o[0]));
  const lg=document.createElement('div'); lg.className='fao-anim-leg';
  lg.innerHTML='<span><i style="border-color:#4cc2ff"></i>coupe</span><span><i style="border-color:#ffd60a;border-top-style:dashed"></i>à vide</span><span><i style="border-color:#ff453a"></i>descente</span>';
  c.appendChild(lg);
  const p=document.createElement('p'); p.textContent=o[2]||''; c.appendChild(p);
  const r=item.getBoundingClientRect(), L=faoAnimList.getBoundingClientRect();
  const w=270, vw=window.innerWidth, vh=window.innerHeight;
  let x=L.right+8; if(x+w>vw-8)x=L.left-w-8; if(x<8)x=8;
  c.style.left=x+'px'; c.style.top='0px';
  const h=c.offsetHeight||300;
  c.style.top=Math.max(8,Math.min(vh-h-8,r.top-20))+'px';
  void c.offsetWidth; c.classList.add('vis');
}
// <select> ordinaire (faoSel) + liste maison au clic de souris, étiquette animée au survol.
function faoSelAnim(opts,val,fn,title){
  const s=faoSel(opts,val,fn,title);
  s.addEventListener('mousedown',function(ev){
    if(ev.button!==0)return;
    ev.preventDefault(); s.focus();
    if(faoAnimList){ faoAnimClose(); return; }
    faoAnimStyle();
    const R=s.getBoundingClientRect();
    const ls=document.createElement('div'); ls.className='fao-anim-list';
    ls.style.minWidth=Math.max(R.width,200)+'px'; ls.style.left=R.left+'px'; ls.style.top=(R.bottom+3)+'px';
    opts.forEach(function(o){
      const it=document.createElement('div'); it.className='fao-anim-item'+(s.value===o[0]?' on':''); it.textContent=o[1];
      it.onmouseenter=function(){ faoAnimShowCard(it,o); };
      it.onmousedown=function(e){ e.preventDefault(); e.stopPropagation(); };
      it.onclick=function(){ faoAnimClose(); if(s.value!==o[0]){ s.value=o[0]; s.onchange(); } };
      ls.appendChild(it);
    });
    ls.onmouseleave=function(){ if(faoAnimCard)faoAnimCard.classList.remove('vis'); };
    document.body.appendChild(ls); faoAnimList=ls;
    const LB=ls.getBoundingClientRect();
    if(LB.bottom>window.innerHeight-8)ls.style.top=Math.max(8,R.top-LB.height-3)+'px';
    const out=function(e){ if(!ls.contains(e.target)&&e.target!==s)faoAnimClose(); };
    const key=function(e){ if(e.key==='Escape')faoAnimClose(); };
    const scr=function(e){ if(!ls.contains(e.target))faoAnimClose(); };
    setTimeout(function(){ document.addEventListener('mousedown',out,true); },0);
    document.addEventListener('keydown',key,true); window.addEventListener('scroll',scr,true);
    faoAnimOff=function(){ document.removeEventListener('mousedown',out,true);
      document.removeEventListener('keydown',key,true); window.removeEventListener('scroll',scr,true); };
  });
  return s;
}
