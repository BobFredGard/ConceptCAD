/* ---------- La Table holographique, sa disposition : celle de la maquette (V1.1.12) ----------
   Fred, 27/11 : « J'aimerais vraiment que tu te rapproches de tes 4 façons proposées ». Après la
   Goutte, l'Habitacle et le Plan vivant, la Table holographique — la pièce posée sur une table de lumière :
   • la TABLE : une grande ellipse lumineuse en bas de la vue, son nom, sa matière, sa masse et son
     volume écrits sur l'anneau ;
   • les ESPACES autour de la table : CAO devant, FAO à gauche, PLAN au fond, RENDU à droite ;
   • les COMMANDES sur l'arc avant de la table, plus grosses au milieu : d'abord les groupes du ruban
     (Esquisse, Créer, Modifier…), un groupe y déroule ses commandes (épinglées ou non), « ‹ » revient ;
     plus de ruban en CAO (Ctrl+K et les raccourcis restent) ;
   • l'HISTOIRE DE LA PIÈCE à gauche : les fonctions empilées en tranches de cylindre, la plus
     ancienne en bas, une tranche fine par esquisse, nom et valeur à côté ; l'étape choisie en ambre ;
     clic, double-clic, glisser comme dans la timeline ; bascule Histoire · Arbre ;
   • le CADRAN à droite : la valeur principale de la fonction choisie (profondeur, hauteur, Ø, angle)
     sur un arc ; on fait glisser le curseur ou on tape la valeur, et la pièce est refaite au lâcher.
   CAO seulement (hors esquisse, assemblage, téléphone). 🎨 › « Disposition de la maquette » remet la
   disposition habituelle. Aucune animation sans fin (la vue en veille ne doit pas faire souffler la carte). */
const TB_MONO='"Cascadia Mono",Consolas,"Lucida Console",ui-monospace,monospace';
function tbCss(){
  if(document.getElementById('tbCss'))return;
  const st=document.createElement('style');st.id='tbCss';
  const T='html body.ui-modern.mq-lay[data-theme="holo"]:not(.mf-mobile)';
  const C=T+'[data-ws="cao"]:not(.mf-sk):not([data-asm="1"])';
  const X=(p,sel,decl)=>sel.split(',').map(s=>p+' '+s.trim()).join(',')+'{'+decl+'}';
  const CY='#38f2d0',AM='#ffb547';
  st.textContent=[
    '#tbTable,#tbArc,#tbWs,#tbDial,#tbSw{display:none}',
    /* ═══ CAO : plus de ruban, le bandeau s'efface ═══ */
    X(C,'#mfRibbon,#mfBrTabs','display:none!important'),
    X(C,'.topbar .mfWs','display:none!important'),
    X(C,'.topbar','background:linear-gradient(180deg,rgba(2,7,8,.92),rgba(2,7,8,0))!important;border-bottom-color:transparent!important;box-shadow:none!important'),
    C+':not(.tb-arbre) #treeWrap{display:none!important}',
    C+'.tb-arbre #mfTl{display:none!important}',
    X(C,'#tbSw','display:flex;position:absolute;left:40px;top:12px;z-index:26;gap:2px;padding:3px;border-radius:999px;border:1px solid rgba(56,242,208,.3);background:rgba(3,20,20,.75)'),
    '#tbSw button{border:none;background:none;color:#7fe9d3;font-family:'+TB_MONO+';font-size:11px;letter-spacing:.14em;padding:4px 12px;border-radius:999px;cursor:pointer}',
    'body:not(.tb-arbre) #tbSw button[data-tb="hist"],body.tb-arbre #tbSw button[data-tb="arbre"]{background:'+CY+';color:#02110f;font-weight:700}',
    C+'.tb-arbre #treeWrap{top:46px}',
    /* ═══ l'histoire de la pièce : la timeline en pile de tranches ═══ */
    X(C,'#mfTl','left:30px;right:auto;top:52px;bottom:auto;width:310px;max-height:calc(100% - 210px);height:auto;flex-direction:column;align-items:flex-start;gap:6px;padding:22px 0 0!important;'+
      'background:none!important;border:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;pointer-events:none'),
    X(C,'#mfTl>*','pointer-events:auto'),
    X(C,'#mfTl::before','content:"HISTOIRE DE LA PIÈCE";position:absolute;left:22px;top:2px;font-family:'+TB_MONO+';font-size:11.5px;letter-spacing:.2em;color:#7fe9d3;pointer-events:none'),
    X(C,'#mfTl .tlbC','order:5;opacity:.7'),X(C,'#mfTl .tlbN','order:6;font-family:'+TB_MONO+';color:#7fbfb2'),
    X(C,'#mfTl .tlbR','order:4;flex:0 1 auto;min-height:0;flex-direction:column-reverse;align-items:flex-start;gap:0;width:310px;overflow-x:hidden;overflow-y:auto;padding:16px 0 8px 22px;box-sizing:border-box;scrollbar-width:thin'),
    X(C,'#mfTl .tlbS','flex:none;width:110px;min-width:110px;height:36px;margin:0!important;padding:0!important;font-size:0;color:transparent!important;position:relative;opacity:1;'+
      'border:1px solid rgba(56,242,208,.6)!important;border-top:none!important;border-radius:0 0 55px 55px / 0 0 12px 12px!important;'+
      'background:linear-gradient(90deg,#08302b,#14524b 45%,#08302b)!important;box-shadow:none!important'),
    X(C,'#mfTl .tlbS::before','content:"";position:absolute;left:-1px;right:-1px;top:-12px;height:24px;border-radius:50%;background:#14524b;border:1px solid rgba(56,242,208,.8);box-sizing:border-box;pointer-events:none'),
    X(C,'#mfTl .tlbS>span:first-child','display:none'),
    X(C,'#mfTl .tlbS.sk','height:18px'),
    X(C,'#mfVpInfo','bottom:6px!important;right:calc(14px + var(--mfPropsW,0px))'),
    X(C,'#mfTl .tlbS.sk::before','background:#0f4741'),
    X(C,'#mfTl .tlbS.off','opacity:.4'),
    X(C,'#mfTl .tlbS:hover','filter:brightness(1.35)'),
    X(C,'#mfTl .tlbS.sel','background:linear-gradient(90deg,#6b4310,#c98a2c 45%,#6b4310)!important;border-color:#ffc46b!important'),
    X(C,'#mfTl .tlbS.sel::before','background:#e0a040;border-color:#ffd08a'),
    X(C,'#mfTl .tlbS.warn','border-color:#ff6b5a!important'),
    X(C,'#mfTl .tlbM','flex:none;width:130px;height:2px;margin:6px 0 6px -12px;background:'+AM+';box-shadow:0 0 8px '+AM+';border-radius:2px'),
    X(C,'#mfTl .tbNm','position:absolute;left:122px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:1px;width:170px;pointer-events:none;white-space:nowrap;line-height:1.15'),
    X(C,'#mfTl .tbNm::before','content:"";position:absolute;left:-10px;top:50%;width:8px;height:1px;background:rgba(56,242,208,.5)'),
    X(C,'#mfTl .tbNm b','font-weight:500;font-size:13.5px;color:#e8fffa;overflow:hidden;text-overflow:ellipsis'),
    X(C,'#mfTl .tbNm i','font-style:normal;font-size:11.5px;color:#7fbfb2;overflow:hidden;text-overflow:ellipsis'),
    X(C,'#mfTl .tlbS.sk .tbNm b','font-size:12.5px;color:#bfeee4;font-weight:400'),
    X(C,'#mfTl .tlbS.sel .tbNm b','color:#ffd08a;font-weight:600'),X(C,'#mfTl .tlbS.sel .tbNm i','color:#e7b875'),
    /* ═══ la table, les espaces, l'arc des commandes ═══ */
    X(C,'#tbTable','display:block;position:absolute;inset:0;pointer-events:none;z-index:2;overflow:visible'),
    X(C,'#tbWs','display:block;position:absolute;inset:0;pointer-events:none;z-index:24'),
    X(C,'#tbArc','display:block;position:absolute;inset:0;pointer-events:none;z-index:25'),
    '#tbWs button{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;padding:7px 16px;border-radius:999px;border:1px solid rgba(56,242,208,.35);background:rgba(3,20,20,.78);color:#a7fbe9;font-family:'+TB_MONO+';font-size:13.5px;letter-spacing:.22em;cursor:pointer;white-space:nowrap}',
    '#tbWs button.on{background:'+CY+';color:#02110f;font-weight:700;box-shadow:0 0 26px rgba(56,242,208,.55)}',
    '#tbWs button:hover:not(.on){border-color:'+CY+';color:#e8fffa}',
    '#tbArc button{position:absolute;transform:translate(-50%,-50%) scale(var(--k,1));pointer-events:auto;height:32px;padding:0 14px;border-radius:999px;border:1px solid rgba(56,242,208,.3);background:rgba(4,26,26,.86);color:#d6fff6;'+
      'font-family:'+TB_MONO+';font-size:12.5px;letter-spacing:.06em;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px;transition:background .2s,box-shadow .2s}',
    '#tbArc button:hover{background:rgba(56,242,208,.2);box-shadow:0 0 18px rgba(56,242,208,.5)}',
    '#tbArc button.tbGrp{border-color:rgba(255,181,71,.45);color:#ffe0ad}#tbArc button.tbGrp em{font-style:normal;font-size:10.5px;color:#ffcf85;opacity:.8}',
    '#tbArc button.tbRet{border-color:rgba(255,181,71,.7);background:rgba(40,24,4,.85);color:#ffcf85}',
    '#tbArc button i{display:inline-flex}#tbArc button i svg{width:16px;height:16px}',
    '#tbWs button:focus-visible,#tbArc button:focus-visible,#tbDial input:focus-visible,#tbSw button:focus-visible{outline:2px solid #fff;outline-offset:3px}',
    /* ═══ le cadran de la fonction choisie ═══ */
    X(C,'#tbDial.on','display:block'),
    '#tbDial{position:absolute;z-index:24;right:calc(24px + var(--mfPropsW,0px));top:44%;pointer-events:none;color:#e8fffa;font-family:'+TB_MONO+'}',
    '#tbDial svg{position:absolute;left:0;top:0;overflow:visible}',
    '#tbDial .tbK{pointer-events:auto;cursor:grab;touch-action:none}#tbDial .tbK:active{cursor:grabbing}',
    '#tbDial .tbTi{position:absolute;font-family:Bahnschrift,"Segoe UI",system-ui,sans-serif;font-size:21px;font-weight:600;color:#fff;white-space:nowrap}',
    '#tbDial .tbVal{position:absolute;display:flex;flex-direction:column;gap:2px;pointer-events:auto}',
    '#tbDial .tbVal span{font-size:11px;letter-spacing:.2em;color:#ffcf85}',
    '#tbDial .tbVal label{display:flex;align-items:baseline;gap:6px;font-size:13px;color:#ffcf85}',
    '#tbDial input{width:92px;border:none;border-bottom:1px solid rgba(255,207,133,.5);background:transparent;color:#fff;font-family:'+TB_MONO+';font-size:24px;padding:0}',
    '#tbDial input:disabled{opacity:.6}#tbDial .tbErr{font-size:11.5px;color:#ff8f74;max-width:230px;white-space:normal}'
  ].join('\n');
  document.head.appendChild(st);
}
function tbActif(){
  try{
    const b=document.body;
    return b.classList.contains('mq-lay')&&b.classList.contains('ui-modern')&&!b.classList.contains('mf-mobile')&&b.getAttribute('data-theme')==='holo'&&
      (b.getAttribute('data-ws')||'cao')==='cao'&&!b.classList.contains('mf-sk')&&b.getAttribute('data-asm')!=='1';
  }catch(e){return false;}
}
// Géométrie de la table dans une vue W×H : centre, rayons. Pur.
function tbGeom(W,H){
  const rx=Math.max(220,Math.min(W*0.39,560)),ry=rx*0.19;
  return {cx:W/2,cy:H-ry*1.5-42,rx,ry};
}
// Positions de n boutons sur l'arc avant, de gauche (150°) à droite (30°), plus gros au milieu. Pur.
function tbArcPos(n,G){
  const out=[];
  for(let i=0;i<n;i++){
    const deg=n>1?150-i*(120/(n-1)):90,a=deg*Math.PI/180,s=Math.sin(a);
    out.push({x:G.cx+G.rx*Math.cos(a),y:G.cy+G.ry*1.05*s,k:+(0.82+0.24*s).toFixed(2),o:+(0.6+0.4*s).toFixed(2)});
  }
  return out;
}
// Les espaces autour de la table : CAO devant, FAO à gauche, PLAN au fond, RENDU à droite. Pur.
function tbWsPos(G){
  const R=G.rx*1.13,r=G.ry*1.5;
  return [['cao','CAO',90],['fao','FAO',180],['plan','PLAN',270],['rendu','RENDU',0]].map(([k,l,d])=>{
    const a=d*Math.PI/180,f=(Math.sin(a)+1)/2;
    return {k,l,x:G.cx+R*Math.cos(a),y:G.cy+r*Math.sin(a),o:+(0.45+0.55*f).toFixed(2),s:+(0.8+0.3*f).toFixed(2)};
  });
}
let tbGrp=null,tbTxtSig='';
function tbTableMaj(force){
  const vp=document.getElementById('vpwrap'),sv=document.getElementById('tbTable');if(!vp||!sv)return;
  const W=vp.clientWidth,H=vp.clientHeight;if(!(W>0&&H>0))return;
  let txt='';try{txt=tbTexte();}catch(e){}
  const sig=W+'x'+H+'|'+txt;if(!force&&sig===tbTxtSig)return;tbTxtSig=sig;
  const G=tbGeom(W,H),esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  sv.setAttribute('viewBox','0 0 '+W+' '+H);sv.setAttribute('width',W);sv.setAttribute('height',H);
  const e=(k,stroke,op,w,extra)=>'<ellipse cx="'+G.cx+'" cy="'+G.cy+'" rx="'+(G.rx*k)+'" ry="'+(G.ry*k)+'" fill="none" stroke="'+stroke+'" stroke-opacity="'+op+'" stroke-width="'+w+'"'+(extra||'')+'/>';
  const ar=G.rx*0.8,br=G.ry*0.8;
  sv.innerHTML='<defs><radialGradient id="tbDisc"><stop offset="0" stop-color="#38f2d0" stop-opacity=".2"/><stop offset="1" stop-color="#38f2d0" stop-opacity="0"/></radialGradient></defs>'+
    '<ellipse cx="'+G.cx+'" cy="'+G.cy+'" rx="'+G.rx+'" ry="'+G.ry+'" fill="rgba(4,26,25,.35)" stroke="#38f2d0" stroke-opacity=".7" stroke-width="2.5"/>'+
    e(0.84,'#38f2d0',.42,1.2,' stroke-dasharray="2 10"')+
    '<ellipse cx="'+G.cx+'" cy="'+G.cy+'" rx="'+(G.rx*0.64)+'" ry="'+(G.ry*0.64)+'" fill="url(#tbDisc)" stroke="#38f2d0" stroke-opacity=".3" stroke-width="1"/>'+
    e(0.43,'#38f2d0',.5,1.5)+
    '<path id="tbTxtArc" d="M'+(G.cx-ar)+' '+G.cy+'A'+ar+' '+br+' 0 0 1 '+(G.cx+ar)+' '+G.cy+'" fill="none"/>'+
    '<text font-family="'+esc(TB_MONO)+'" font-size="12" letter-spacing="2.5" fill="#7fe9d3"><textPath href="#tbTxtArc" startOffset="50%" text-anchor="middle">'+esc(txt)+'</textPath></text>';
  tbWsMaj(G);tbArcMaj(G);
}
function tbTexte(){
  let nom='';try{nom=(document.getElementById('docName')||{}).textContent||doc.name||'';}catch(e){}
  let P=['','',''];try{P=pvPied();}catch(e){}
  return [String(nom||'Sans nom').toUpperCase()].concat(P).filter(Boolean).join(' · ');
}
function tbWsMaj(G){
  const el=document.getElementById('tbWs');if(!el)return;
  let ws='cao';try{ws=document.body.getAttribute('data-ws')||'cao';}catch(e){}
  el.innerHTML='';
  tbWsPos(G).forEach(p=>{
    const b=document.createElement('button');b.type='button';b.textContent=p.l;b.dataset.ws=p.k;
    if(p.k===ws){b.className='on';b.setAttribute('aria-pressed','true');}else b.setAttribute('aria-pressed','false');
    b.title=p.k===ws?'Espace en cours':'Aller dans l’espace '+p.l;
    b.style.left=p.x+'px';b.style.top=p.y+'px';b.style.opacity=p.o;b.style.transform='translate(-50%,-50%) scale('+p.s+')';b.style.zIndex=Math.round(10+p.s*10);
    b.onclick=e=>{e.stopPropagation();if(p.k!==ws)try{mfWs(p.k);}catch(err){}};
    el.appendChild(b);
  });
}
function tbArcMaj(G){
  const el=document.getElementById('tbArc');if(!el)return;
  if(!G){const vp=document.getElementById('vpwrap');if(!vp)return;G=tbGeom(vp.clientWidth,vp.clientHeight);}
  let Gs=[];try{Gs=gtGroupes();}catch(e){Gs=[];}
  const g=tbGrp&&Gs.find(x=>x.nom===tbGrp);if(!g)tbGrp=null;
  const items=g?[{ret:true,l:'‹ '+g.nom}].concat(g.cmds.map(c=>({c,l:c.l,ic:c.ic,tip:c.tip}))):Gs.map(x=>({grp:x,l:x.nom,n:x.cmds.length}));
  const P=tbArcPos(items.length,G);
  el.innerHTML='';
  items.forEach((it,i)=>{
    const b=document.createElement('button');b.type='button';const p=P[i];
    b.style.left=p.x+'px';b.style.top=p.y+'px';b.style.opacity=p.o;b.style.setProperty('--k',p.k);b.style.zIndex=Math.round(30+p.k*10);
    if(it.ret){b.className='tbRet';b.textContent=it.l;b.title='Revenir aux groupes';b.onclick=e=>{e.stopPropagation();tbGrp=null;tbArcMaj();};}
    else if(it.grp){
      b.className='tbGrp';b.innerHTML='<span></span><em></em>';b.firstChild.textContent=it.l;b.lastChild.textContent=it.n;b.title=it.l+' : '+it.n+' commande'+(it.n>1?'s':'');
      b.onclick=e=>{e.stopPropagation();if(it.grp.cmds.length===1){try{it.grp.cmds[0].b.click();}catch(err){}return;}tbGrp=it.grp.nom;tbArcMaj();};
    }else{
      b.innerHTML='<i aria-hidden="true"></i><span></span>';b.firstChild.innerHTML=it.ic||'';b.lastChild.textContent=it.l;b.title=it.tip||it.l;
      b.onclick=e=>{e.stopPropagation();try{it.c.b.click();}catch(err){}};
    }
    ['pointerdown','mousedown','dblclick'].forEach(t=>b.addEventListener(t,ev=>{try{ev.stopPropagation();}catch(_){}}));
    el.appendChild(b);
  });
}
// noms et valeurs à côté de chaque tranche (appelé à chaque rendu de la timeline, par gtTigeSync)
function tbHistHabille(R,S){
  const els=[...R.querySelectorAll('.tlbS')];
  els.forEach((el,i)=>{
    const s=S&&S[i];if(!s||(el.dataset&&s.id!==el.dataset.id))return;
    let K={nom:'',val:''};try{K=pvCourt(s);}catch(e){}
    const m=document.createElement('span');m.className='tbNm';
    const b=document.createElement('b');b.textContent=K.nom;m.appendChild(b);
    let d='';try{d=s.kind==='feature'?(K.reg||K.val):'';}catch(e){}
    if(d){const it=document.createElement('i');it.textContent=d;m.appendChild(it);}
    el.title=(s.o&&s.o.name)||K.nom;
    el.appendChild(m);
  });
  tbDialMaj(R,S);
}
/* ----- le cadran : la valeur principale de la fonction choisie ----- */
let tbDialFid=null;
// La fonction est ouverte dans sa fenêtre (clic sur la tranche) : c'est la fenêtre qui règle, avec OK / Annuler ;
// le cadran ne fait que montrer (sinon Annuler effacerait un réglage fait au cadran sans qu'on le voie)
function tbFenetreOuverte(f){
  try{
    if(typeof sel!=='undefined'&&sel&&sel.kind==='feature'&&sel.id===f.id)return true;
    return !!((typeof extDyn!=='undefined'&&extDyn&&extDyn.id===f.id)||(typeof fdyn!=='undefined'&&fdyn&&fdyn.id===f.id));
  }catch(e){return false;}
}
// Valeur ↔ angle du cadran (arc de -70° à +70°, 0 en haut). Bornes : 0 → max. Pur.
function tbDialMax(v){return Math.max(10,Math.ceil((v*2)/5)*5);}
function tbDialAngle(v,max){return -70+140*Math.max(0,Math.min(1,v/max));}
function tbDialValeur(deg,max){const t=Math.max(0,Math.min(1,(deg+70)/140));return t*max;}
function tbDialMaj(R,S){
  const el=document.getElementById('tbDial');if(!el)return;
  if(!tbActif()){el.classList.remove('on');return;}
  R=R||(typeof tlbEl!=='undefined'&&tlbEl&&tlbEl._row)||null;
  const sel=R&&R.querySelector('.tlbS.sel');const id=sel&&sel.dataset.id;
  const f=id&&(doc.features||[]).find(x=>x.id===id);
  let V=null;try{V=f?gtValeur(f):null;}catch(e){V=null;}
  if(!f||!V){el.classList.remove('on');el.innerHTML='';tbDialFid=null;return;}
  if(el._drag)return;
  tbDialFid=f.id;
  const vp=document.getElementById('vpwrap');const H=vp?vp.clientHeight:800;
  // le cadran est une boîte collée à droite (elle suit le panneau des réglages par --mfPropsW, en CSS) ;
  // l'arc tourne autour d'un centre placé à sa gauche (côté pièce), la valeur s'écrit à sa droite
  const r=Math.round(Math.min(240,H*0.3)),cx=Math.round(10-0.342*r),cy=Math.round(44+0.94*r);
  const bw=Math.round(10+0.658*r+24+160),bh=Math.round(2*0.94*r+64);
  // points : angle d (degrés, 0 = droite du centre, -70 en haut, +70 en bas) → (x, y)
  const pt=d=>{const a=d*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];};
  const max=tbDialMax(V.v),dv=tbDialAngle(V.v,max);
  const arc=(d0,d1)=>{const a=pt(d0),b=pt(d1);return 'M'+a[0].toFixed(1)+' '+a[1].toFixed(1)+'A'+r+' '+r+' 0 0 1 '+b[0].toFixed(1)+' '+b[1].toFixed(1);};
  const k=pt(dv);
  const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let K={nom:f.name||f.id};try{K=pvCourt({kind:'feature',o:f,id:f.id});}catch(e){}
  el.style.width=bw+'px';el.style.height=bh+'px';el.style.marginTop=(-bh/2)+'px';
  el.innerHTML='<svg width="1" height="1" aria-hidden="true">'+
    '<path d="'+arc(-70,70)+'" fill="none" stroke="#ffb547" stroke-opacity=".3" stroke-width="10" stroke-linecap="round"/>'+
    '<path class="tbArcV" d="'+arc(-70,dv)+'" fill="none" stroke="#ffb547" stroke-width="10" stroke-linecap="round"/>'+
    '<circle class="tbK" cx="'+k[0].toFixed(1)+'" cy="'+k[1].toFixed(1)+'" r="11" fill="#ffffff" stroke="#ffb547" stroke-width="4"><title>Glisser pour changer la valeur</title></circle></svg>'+
    '<div class="tbTi" style="left:'+(pt(-70)[0]+10).toFixed(0)+'px;top:'+(pt(-70)[1]-40).toFixed(0)+'px" title="'+esc(f.name||f.id)+'">'+esc(K.nom||f.name||f.id)+'</div>'+
    '<div class="tbVal" style="left:'+(cx+r+24).toFixed(0)+'px;top:'+(cy-26).toFixed(0)+'px"><span>'+esc(V.l.toUpperCase())+'</span>'+
    '<label><input aria-label="'+esc(V.l)+'" autocomplete="off"> '+esc(V.fx?'ƒx':V.u)+'</label><div class="tbErr" hidden></div></div>';
  el.classList.add('on');
  const inp=el.querySelector('input'),err=el.querySelector('.tbErr'),kn=el.querySelector('.tbK'),av=el.querySelector('.tbArcV');
  inp.value=gtNb(V.v);
  if(V.fx){inp.disabled=true;inp.title='Valeur donnée par une formule : double-clic sur la tranche pour la changer';kn.style.display='none';return;}
  if(tbFenetreOuverte(f)){inp.disabled=true;inp.title='La fonction est ouverte : réglez-la dans sa fenêtre, puis OK. Un clic sur une face de la pièce rend le cadran réglable.';kn.style.display='none';return;}
  inp.title='Nouvelle valeur puis Entrée';
  const appliquer=v=>{
    if(tbFenetreOuverte(f)){err.textContent='La fonction est ouverte : réglez-la dans sa fenêtre';err.hidden=false;return false;}
    if(!(v>0)){err.textContent='Une valeur positive, en '+V.u;err.hidden=false;return false;}
    if(Math.abs(v-V.v)<1e-9)return true;
    let res='réglage indisponible';
    try{res=c3FeatSet(f,V.k,v,'Table : '+V.l.toLowerCase()+' de « '+(f.name||f.id)+' »');}catch(ex){res=ex&&ex.message||res;}
    if(res!==true){err.textContent=String(res);err.hidden=false;return false;}
    return true;
  };
  inp.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Escape'){e.preventDefault();inp.value=gtNb(V.v);inp.blur();return;}
    if(e.key!=='Enter')return;e.preventDefault();
    const v=typeof c3Parse==='function'?c3Parse(inp.value):parseFloat(String(inp.value).replace(',','.'));
    appliquer(v);
  });
  // glisser le curseur le long de l'arc ; la pièce est refaite au lâcher
  const pas=V.u==='°'?1:(max>40?1:0.5);
  kn.addEventListener('pointerdown',e=>{
    e.stopPropagation();e.preventDefault();
    try{kn.setPointerCapture(e.pointerId);}catch(_){}
    el._drag={v:V.v};
    const bouge=ev=>{
      const vr=el.getBoundingClientRect();
      const d=Math.atan2(ev.clientY-vr.top-cy,ev.clientX-vr.left-cx)*180/Math.PI;
      let v=Math.round(tbDialValeur(Math.max(-70,Math.min(70,d)),max)/pas)*pas;if(v<pas)v=pas;
      el._drag.v=v;const q=pt(tbDialAngle(v,max));
      kn.setAttribute('cx',q[0].toFixed(1));kn.setAttribute('cy',q[1].toFixed(1));
      av.setAttribute('d',arc(-70,tbDialAngle(v,max)));inp.value=gtNb(v);
    };
    const fin=()=>{
      kn.removeEventListener('pointermove',bouge);kn.removeEventListener('pointerup',fin);kn.removeEventListener('pointercancel',fin);
      const v=el._drag&&el._drag.v;el._drag=null;
      if(v!=null&&Math.abs(v-V.v)>1e-9)appliquer(v);
    };
    kn.addEventListener('pointermove',bouge);kn.addEventListener('pointerup',fin);kn.addEventListener('pointercancel',fin);
  });
}
function tbSwBuild(){
  const vp=document.getElementById('vpwrap');if(!vp||document.getElementById('tbSw'))return;
  const w=document.createElement('div');w.id='tbSw';w.setAttribute('role','group');w.setAttribute('aria-label','L’histoire ou l’arbre');
  [['hist','Histoire','L’histoire de la pièce : une tranche par fonction, la plus ancienne en bas'],['arbre','Arbre','L’arbre du modèle : origine, corps, esquisses, paramètres']].forEach(([k,l,t])=>{
    const bt=document.createElement('button');bt.type='button';bt.dataset.tb=k;bt.textContent=l;bt.title=t;
    bt.onclick=e=>{e.stopPropagation();tbArbre(k==='arbre');};w.appendChild(bt);});
  ['pointerdown','mousedown','dblclick'].forEach(t=>w.addEventListener(t,e=>{try{e.stopPropagation();}catch(_){}}));
  vp.appendChild(w);
}
function tbArbre(on){
  try{mfLS('minifusion_holo_arbre',on?'1':'0');}catch(e){}
  document.body.classList.toggle('tb-arbre',!!on);
  try{if(!on&&typeof renderTimeline==='function')renderTimeline();}catch(e){}
}
function tbSync(){
  try{
    tbCss();
    const vp=document.getElementById('vpwrap');if(!vp)return;
    if(!document.getElementById('tbTable')){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.id='tbTable';s.setAttribute('aria-hidden','true');vp.appendChild(s);}
    ['tbWs','tbArc','tbDial'].forEach(id=>{if(!document.getElementById(id)){const m=document.createElement('div');m.id=id;
      if(id==='tbWs'){m.setAttribute('role','group');m.setAttribute('aria-label','Espaces de travail');}
      if(id==='tbArc'){m.setAttribute('role','toolbar');m.setAttribute('aria-label','Commandes de la CAO');}
      vp.appendChild(m);}});
    tbSwBuild();
    let a=false;try{a=mfLS('minifusion_holo_arbre')==='1';}catch(e){}
    document.body.classList.toggle('tb-arbre',a);
    tbGrp=null;tbTxtSig='';
    if(tbActif()){tbTableMaj(true);tbDialMaj();}
  }catch(e){}
}
(function tbEcoute(){
  try{
    // nom, matière, masse, taille de la vue : relus chaque seconde, la table n'est refaite que s'ils changent
    setInterval(()=>{if(tbActif())tbTableMaj();},1000);
    window.addEventListener('resize',()=>{if(tbActif()){tbTableMaj(true);tbDialMaj();}});
  }catch(e){}
})();
// au démarrage : mfTheme est passé avant que MF_MAQUETTE (97-interface-themes-futur) existe
(function(){
  try{mfMaquetteSync();}catch(e){}
})();
