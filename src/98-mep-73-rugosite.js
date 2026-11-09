// Espace PLAN — suite de la fonction englobante ouverte dans 98-mep-00-modele.js (état privé partagé, fermée dans 98-mep-95-export-init.js) : état de surface (rugosité, ISO 21920-1 / ex-ISO 1302).
  /* ═══════════════ O5. rugosité (état de surface) ═══════════════ */
  /* 2026-11-09 : « Mise en plan, ajouter l'outil pour la rugosité, bien faire attention au sens des arêtes
     choisies / à la vue et de mettre la valeur comme il le faut ». Troisième sorte de tolérance (même
     sélection, glisser, Suppr, annulation et export que les cadres ISO 1101) :
     - d.kind 'rough' : d.a = pied du symbole sur l'arête (mm locaux de la vue, suit la pièce comme une note),
       d.b = point qui donne le CÔTÉ de l'arête où se tient le symbole (hors de la matière : là où l'on clique),
       d.r = {par:'Ra'|'Rz'|…, val:'1.6', proc:'remove'|'any'|'forbid', txt:'' (procédé : rectifié…)}.
     Règles de la norme appliquées au dessin :
     - le symbole (deux branches inégales à 60° de la surface) touche l'arête par sa pointe, perpendiculaire
       à elle, du côté choisi ; la valeur se lit du bas ou de la droite du plan (comme une cote) : elle est
       écrite le long de l'arête, sous le trait horizontal de la branche longue (position a), précédée du
       paramètre (« Ra 1,6 ») ; le procédé éventuel au-dessus du trait (position c) ;
     - si, de ce côté, le symbole se lirait à l'envers (dessous d'une arête, droite d'une arête verticale…)
       ou si on l'éloigne de l'arête, il est porté par une ligne de repère terminée par une flèche sur la
       surface, symbole posé sur un trait horizontal (lecture normale) ;
     - enlèvement de matière exigé : branche courte fermée (triangle) ; interdit : petit cercle dans le V. */
  const MEP_RGH_PARS=['Ra','Rz','Rt','Rmax','Rq','Rp','Rv'];
  const MEP_RGH_VALS=['0.1','0.2','0.4','0.8','1.6','3.2','6.3','12.5','25','50'];
  const MEP_RGH_PROC=[['remove','Enlèvement de matière exigé (usinage)'],['any','Tout procédé'],['forbid','Enlèvement de matière interdit']];
  let mepRghLast=null; // dernière rugosité réglée : la suivante la reprend
  function mepIsTol(k){return k==='gdt'||k==='datum'||k==='rough';}
  function mepRghNew(){const l=mepRghLast;return{par:l?l.par:'Ra',val:l?l.val:'3.2',proc:l?l.proc:'remove',txt:''};}
  function mepRghCap(){return mepGdtTh()*0.7;} // hauteur des majuscules h (ISO 1302 : H1 = 1,4 h, H2 = 3 h)
  function mepRghLabel(r){r=r||{};const v=mepGdtValText(r.val);return v?(r.par||'Ra')+' '+v:'';}
  // direction (mm papier) de l'arête sous le pied : droite, ou tangente d'un cercle / arc
  function mepRghEdgeDir(v,q){
    const S=(x,y)=>mepToSheet(v,x,y),toS=e=>{if(!e)return null;const A=S(q.x,q.y),B=S(q.x+e.x,q.y+e.y);let x=B.x-A.x,y=B.y-A.y;const l=Math.hypot(x,y);return l>1e-12?{x:x/l,y:y/l}:null;};
    const e=mepGdtEdgeDir(v,q);if(e)return toS(e);
    const g=mepGeoOf(v);if(!g||!g.els)return null;
    let best=null,bd=0.6/Math.max(v.scale,1e-9)+0.05;
    g.els.forEach(c=>{if(c.t!=='C'&&c.t!=='A')return;const dd=Math.abs(Math.hypot(q.x-c.cx,q.y-c.cy)-c.r);if(dd<bd){bd=dd;best=c;}});
    if(!best)return null;
    const rx=q.x-best.cx,ry=q.y-best.cy,rl=Math.hypot(rx,ry)||1;
    return toS({x:-ry/rl,y:rx/rl});
  }
  /* géométrie du symbole posé : pied F, sens de lecture u, « haut » m (vers le haut des lettres) */
  function mepRghShape(d,F,u,m,textW){
    const r=d.r||{},h=mepRghCap(),H1=1.4*h,H2=3*h,c60=0.5,s60=Math.sqrt(3)/2,ct=c60/s60;
    const P=(a,b)=>({x:F.x+u.x*a+m.x*b,y:F.y+u.y*a+m.y*b});
    const lab=mepRghLabel(r),gap=0.35*h;
    const short=P(-H1*ct,H1),top=P(H2*ct,H2);
    const tx0=(H2-gap)*ct+gap*1.2; // départ du texte sous le trait : à droite de la branche longue
    const barEnd=lab||r.txt?Math.max(tx0+(textW||0)+gap,H2*ct+2*h):H2*ct;
    return{h,H1,H2,P,short,top,bar:lab||r.txt?P(barEnd,H2):null,tx0,base:H2-gap-h,lab,ct};
  }
  function mepDrawRough(draw,d,sh,L,T,AR){
    const w=mepGdtWorld(sh,d);if(!w)return;
    const r=d.r||(d.r=mepRghNew()),h=mepRghCap(),th=mepGdtTh();
    // arête et côté choisi
    let e=d.a?mepRghEdgeDir(w.v1,d.a):null;if(!e)e={x:1,y:0};
    let bx=w.b.x-w.a.x,by=w.b.y-w.a.y;const bl=Math.hypot(bx,by);
    let n={x:-e.y,y:e.x};if(bl>1e-9&&n.x*bx+n.y*by<0)n={x:-n.x,y:-n.y};else if(bl<=1e-9&&n.y>0)n={x:-n.x,y:-n.y};
    // sens de lecture : de gauche à droite, ou de bas en haut pour une arête verticale (lu de la droite)
    let u={x:e.x,y:e.y};if(u.x<-1e-6||(Math.abs(u.x)<=1e-6&&u.y>0))u={x:-u.x,y:-u.y};
    const m={x:u.y,y:-u.x};
    const lead=!!d.lead||n.x*m.x+n.y*m.y<0.2||bl>mepRghCap()*9;
    const lab=mepRghLabel(r);
    const tw=s=>s?s.length*th*0.6:0;
    const pts=[];
    const ln=(A,B,extra)=>{pts.push(A,B);return draw('line',Object.assign({x1:A.x,y1:A.y,x2:B.x,y2:B.y},L,extra||{}));};
    const txt=(s,Q,uu,anchor)=>{if(!s)return 0;const ang=Math.atan2(uu.y,uu.x)*180/Math.PI;
      const t=draw('text',Object.assign({x:Q.x,y:Q.y,'text-anchor':anchor||'start',style:'font-size:'+th.toFixed(3)+'px'},T,Math.abs(ang)>0.01?{transform:'rotate('+ang.toFixed(3)+' '+Q.x.toFixed(3)+' '+Q.y.toFixed(3)+')'}:{}));
      t.textContent=s;return mepTxtW(t,s,th);};
    const symbol=(F,uu,mm)=>{
      const tW=Math.max(tw(lab),tw(r.txt));
      const S=mepRghShape(d,F,uu,mm,tW);
      ln(F,S.short);ln(F,S.top);
      if(r.proc==='remove')ln(S.short,S.P(S.H1*S.ct,S.H1));
      if(r.proc==='forbid'){const c=S.H1/1.5,C=S.P(0,c);pts.push({x:C.x-c/2,y:C.y-c/2},{x:C.x+c/2,y:C.y+c/2});draw('circle',Object.assign({cx:C.x,cy:C.y,r:c/2},L));}
      if(S.bar)ln(S.top,S.bar);
      const w1=txt(lab,S.P(S.tx0,S.base),uu),w2=txt(r.txt,S.P(S.tx0,S.H2+0.35*h),uu);
      [w1,w2].forEach((ww,i)=>{if(ww){pts.push(S.P(S.tx0+ww,i?S.H2+1.4*h:S.base));}});
      return S;
    };
    if(!lead){symbol(w.a,u,m);}
    else{
      // ligne de repère : flèche sur la surface, symbole sur un trait horizontal au point d'attache
      const U={x:1,y:0},M={x:0,y:-1},tW=Math.max(tw(lab),tw(r.txt));
      const S0=mepRghShape(d,{x:0,y:0},U,M,tW),W=(S0.bar?S0.bar.x:S0.top.x)-S0.short.x+0.8*h;
      const B=bl>mepRghCap()*2?w.b:{x:w.a.x+n.x*mepRghCap()*8,y:w.a.y+n.y*mepRghCap()*8};
      const left=w.a.x>B.x; // trait de référence tourné vers la flèche
      const x0=left?B.x-W:B.x,x1=left?B.x:B.x+W;
      ln({x:x0,y:B.y},{x:x1,y:B.y});
      ln(B,w.a,{'marker-end':AR});
      symbol({x:x0-S0.short.x+h*0.4,y:B.y},U,M);
    }
    if(pts.length){const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
      mepGdtBoxes.set(d,{x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys),lead});}
  }
  /* ----- panneau ----- */
  function mepSideRough(root,d,sh){
    const h=document.createElement('h4');h.textContent='État de surface (rugosité)';root.appendChild(h);
    const row=(lab,el)=>{const r=document.createElement('div');r.className='row';const L=document.createElement('label');L.textContent=lab;r.appendChild(L);if(el)r.appendChild(el);root.appendChild(r);return r;};
    const note=t=>{const n=document.createElement('div');n.className='note';n.style.whiteSpace='pre-line';n.textContent=t;root.appendChild(n);return n;};
    const r=d.r||(d.r=mepRghNew());
    const set=(lab,fn)=>{mepEdit(lab,()=>{fn(r);});mepRghLast={par:r.par,val:r.val,proc:r.proc};mepSideShow();mepRender();};
    const ps=document.createElement('select');
    MEP_RGH_PARS.forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;if(k===(r.par||'Ra'))o.selected=true;ps.appendChild(o);});
    ps.onchange=()=>set('paramètre de rugosité',x=>{x.par=ps.value;});
    row('Paramètre',ps);
    const vi=document.createElement('input');vi.type='text';vi.value=mepGdtValText(r.val);vi.style.width='6em';vi.setAttribute('list','mepRghVals');vi.placeholder='3,2';
    const dl=document.createElement('datalist');dl.id='mepRghVals';MEP_RGH_VALS.forEach(v=>{const o=document.createElement('option');o.value=mepGdtValText(v);dl.appendChild(o);});root.appendChild(dl);
    vi.onchange=()=>set('valeur de rugosité',x=>{x.val=vi.value.trim().replace(',','.');});
    const rv=row('Valeur (µm)',vi);
    const vr=document.createElement('div');vr.className='row';
    ['0.4','0.8','1.6','3.2','6.3','12.5'].forEach(v=>{const b=document.createElement('button');b.textContent=mepGdtValText(v);b.title=(r.par||'Ra')+' '+mepGdtValText(v)+' µm';
      if(String(r.val)===v)b.className='active';b.onclick=()=>set('valeur de rugosité',x=>{x.val=v;});vr.appendChild(b);});
    root.appendChild(vr);
    const pr=document.createElement('select');
    MEP_RGH_PROC.forEach(([k,lab])=>{const o=document.createElement('option');o.value=k;o.textContent=lab;if(k===(r.proc||'remove'))o.selected=true;pr.appendChild(o);});
    pr.onchange=()=>set('procédé',x=>{x.proc=pr.value;});
    row('Symbole',pr);
    const ti=document.createElement('input');ti.type='text';ti.value=r.txt||'';ti.placeholder='ex. rectifié';ti.style.width='9em';
    ti.onchange=()=>set('procédé de fabrication',x=>{x.txt=ti.value.trim();});
    row('Procédé (facultatif)',ti);
    const lb=document.createElement('input');lb.type='checkbox';lb.checked=!!d.lead;
    lb.onchange=()=>{mepEdit('ligne de repère',()=>{if(lb.checked)d.lead=1;else delete d.lead;});mepSideShow();mepRender();};
    row('Ligne de repère',lb);
    const bx=mepGdtBoxes.get(d);
    note((bx&&bx.lead&&!d.lead?'Symbole porté par une ligne de repère : de ce côté de l’arête il se lirait à l’envers (ou il a été éloigné de l’arête).\n':'')+
      'Le symbole se tient du côté de l’arête où vous l’avez posé (hors matière) ; glissez-le de l’autre côté pour le retourner, ou loin de l’arête pour une ligne de repère. La valeur se lit du bas ou de la droite du plan.');
    const act=document.createElement('div');act.className='row';
    const bDel=document.createElement('button');bDel.textContent='Supprimer';bDel.className='danger';
    bDel.onclick=()=>{mepEdit('suppression rugosité',()=>{sh.dims=sh.dims.filter(x=>x.id!==d.id);mepSt.selDim=null;});mepSideShow();};
    act.appendChild(bDel);root.appendChild(act);
  }
