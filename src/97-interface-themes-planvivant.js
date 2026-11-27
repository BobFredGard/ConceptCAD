/* ---------- Le Plan vivant, sa disposition : celle de la maquette (V1.1.11) ----------
   Fred, 27/11 : « J'aimerais vraiment que tu te rapproches de tes 4 façons proposées ». Après la
   Goutte (V1.1.9) et l'Habitacle (V1.1.10), le Plan vivant — la planche à dessin du canevas des pistes :
   • la RÈGLE TRACE-FORMES : le ruban devient une règle de dessinateur en plastique translucide,
     posée de biais en haut de la planche, graduée sur son bord bas ; chaque commande y est une
     découpe (icône au-dessus, nom au pochoir dessous) ;
   • la PLANCHE : double cadre, repères de zones 1…6 en haut et A…D à gauche ;
   • la FRISE en COTE DE CHAÎNE en bas à gauche : chaque fonction est une cote entre deux traits de
     rappel, son nom et sa valeur écrits à la main au-dessus, l'étape choisie en jaune ;
   • le CARTOUCHE en bas à droite : nom de la pièce, les espaces en TAMPONS (CAO, FAO, PLAN,
     RENDU ; celui de l'espace en cours, encré de biais), la nomenclature des fonctions
     (REP · FONCTION · RÉGLAGE : un clic choisit, un double-clic modifie), matière, masse, volume ;
   • l'ANNOTATION VIVANTE : un clic sur une face écrit, au bout d'une ligne de rappel, la fonction
     qui l'a créée et sa valeur (profondeur, hauteur, Ø…), à changer sur place puis Entrée.
   Frise, cartouche, planche et annotation : CAO seulement (hors esquisse, assemblage, téléphone) ;
   la règle vaut partout. 🎨 › « Disposition de la maquette » remet la disposition habituelle. */
const PV_MAIN='"Segoe Print","Bradley Hand","Comic Sans MS","Chalkboard SE",cursive';
const PV_MONO='"Cascadia Mono",Consolas,"Lucida Console",ui-monospace,monospace';
function pvCss(){
  if(document.getElementById('pvCss'))return;
  const st=document.createElement('style');st.id='pvCss';
  const P='html body.ui-modern.mq-lay[data-theme="planvivant"]:not(.mf-mobile)';
  const C=P+'[data-ws="cao"]:not(.mf-sk):not([data-asm="1"])';
  const X=(p,sel,decl)=>sel.split(',').map(s=>p+' '+s.trim()).join(',')+'{'+decl+'}';
  const W='#e9f3ff',J='#ffd37a',JT='#fff3d6';
  st.textContent=[
    '#pvCart,#pvRefs,#pvNote{display:none}',
    /* ═══ la règle trace-formes : le ruban, partout ═══ */
    X(P,'#mfRibbon','position:relative;width:min(1480px,calc(100% - 48px));margin:10px auto 14px!important;box-sizing:border-box;justify-content:center;gap:0;padding:4px 24px 16px;'+
      'border:1.5px solid rgba(200,240,216,.6)!important;border-radius:16px!important;outline:none!important;background:rgba(200,240,216,.15)!important;'+
      'box-shadow:0 8px 24px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.3)!important;transform:rotate(-.8deg)'),
    X(P,'#mfRibbon::after','content:"";position:absolute;left:14px;right:14px;bottom:0;height:12px;pointer-events:none;'+
      'background-image:repeating-linear-gradient(90deg,rgba(233,243,255,.7) 0 1px,transparent 1px 10px),repeating-linear-gradient(90deg,rgba(233,243,255,.9) 0 1px,transparent 1px 50px);'+
      'background-size:100% 6px,100% 12px;background-repeat:no-repeat;background-position:0 100%,0 100%'),
    X(P,'#mfRibbon .mfGrp','border-right:none!important;padding:0 6px'),
    X(P,'#mfRibbon .mfGrpT','font-family:'+PV_MONO+';font-size:9.5px;letter-spacing:.16em;color:rgba(233,243,255,.6);text-transform:uppercase'),
    X(P,'#mfRibbon .mfRb','font-family:'+PV_MONO+';font-size:10px;letter-spacing:0;color:'+W+';background:none!important;border-color:transparent!important;gap:4px'),
    X(P,'#mfRibbon .mfRb i svg','filter:none;transition:filter .2s'),
    X(P,'#mfRibbon .mfRb:hover i svg,#mfRibbon .mfRb.mfOn i svg','filter:drop-shadow(0 0 6px '+J+')'),
    X(P,'#mfRibbon .mfRb:hover,#mfRibbon .mfRb.mfOn,#mfRibbon .mfRb.mfOn i','color:'+J+'!important'),
    /* ═══ CAO : la planche ═══ */
    X(C,'.topbar .mfWs','display:none!important'),
    X(C,'#treeOverlay','max-height:calc(100% - 150px)!important'),
    X(C,'#vpwrap::before','content:"";position:absolute;inset:3px;pointer-events:none;z-index:1;border:2px solid rgba(233,243,255,.7);background:none'),
    X(C,'#pvRefs','display:block;position:absolute;inset:0;pointer-events:none;z-index:2;font-family:'+PV_MONO+';font-size:10px;color:rgba(233,243,255,.6)'),
    '#pvRefs .pvH{position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-around}#pvRefs .pvV{position:absolute;top:0;bottom:0;left:2px;display:flex;flex-direction:column;justify-content:space-around}',
    /* ═══ la frise en cote de chaîne ═══ */
    X(C,'#mfTl','left:34px;right:auto;bottom:22px;width:min(880px,calc(100% - 600px - var(--mfPropsW,0px)));min-width:300px;box-sizing:border-box;padding:24px 4px 2px!important;'+
      'background:none!important;border:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;align-items:flex-end'),
    X(C,'#mfTl::before','content:"FRISE DES FONCTIONS — COTE DE CHAÎNE";position:absolute;left:6px;top:2px;font-family:'+PV_MONO+';font-size:11px;letter-spacing:.16em;color:#bcd3ee;pointer-events:none'),
    X(C,'#mfTl .tlbC','opacity:.75;align-self:center'),
    X(C,'#mfTl .tlbN','font-family:'+PV_MONO+';color:#bcd3ee;align-self:center'),
    X(C,'#mfTl .tlbR','gap:0;align-items:stretch;padding:0 6px 0 0;height:58px;scrollbar-width:thin'),
    X(C,'#mfTl .tlbS','flex:1 1 0;min-width:78px;max-width:200px;height:58px;margin:0!important;padding:0!important;font-size:0;color:'+JT+'!important;border:none!important;border-left:1px solid '+W+'!important;border-radius:0!important;'+
      'background:linear-gradient('+W+','+W+') 0 38px/100% 1px no-repeat!important;box-shadow:none!important;position:relative;opacity:1'),
    X(C,'#mfTl .tlbS:last-of-type','border-right:1px solid '+W+'!important'),
    X(C,'#mfTl .tlbS>span:first-child','display:none'),
    X(C,'#mfTl .tlbS::before','content:"";position:absolute;left:0;top:35px;border:3.5px solid transparent;border-left:none;border-right:9px solid '+W+';pointer-events:none'),
    X(C,'#mfTl .tlbS::after','content:"";position:absolute;right:0;top:35px;border:3.5px solid transparent;border-right:none;border-left:9px solid '+W+';pointer-events:none;background:none;width:0;height:0;bottom:auto'),
    X(C,'#mfTl .tlbS.sk','flex:.7 1 0;min-width:62px'),
    X(C,'#mfTl .tlbS.off','opacity:.45'),
    X(C,'#mfTl .tlbS:hover','background-color:rgba(255,211,122,.08)!important'),
    X(C,'#mfTl .tlbS.sel','background:linear-gradient('+J+','+J+') 0 37px/100% 2.5px no-repeat,linear-gradient(rgba(255,211,122,.18),rgba(255,211,122,.18)) 2px 26px/calc(100% - 4px) 24px no-repeat!important;color:'+J+'!important'),
    X(C,'#mfTl .tlbS.warn','color:#ff8f74!important'),
    X(C,'#mfTl .pvNm','position:absolute;left:4px;right:4px;top:2px;display:flex;flex-direction:column;align-items:center;line-height:1.05;pointer-events:none;font-family:'+PV_MAIN+';white-space:nowrap;overflow:hidden'),
    X(C,'#mfTl .pvNm b','font-weight:400;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis'),
    X(C,'#mfTl .pvNm i','font-style:normal;font-size:11px;opacity:.85;max-width:100%;overflow:hidden;text-overflow:ellipsis'),
    X(C,'#mfTl .tlbS .pvNm','top:4px'),X(C,'#mfTl .tlbS.sk .pvNm b','font-size:12px'),
    X(C,'#mfTl .tlbM','width:2px;margin:0 -1px;background:'+J+';box-shadow:none;align-self:stretch;height:auto'),
    /* ═══ le cartouche ═══ */
    X(C,'#pvCart','display:grid;position:absolute;right:calc(18px + var(--mfPropsW,0px));bottom:18px;z-index:24;width:min(500px,34%);min-width:380px;box-sizing:border-box;'+
      'grid-template-columns:1fr 1fr;border:2px solid '+W+';background:rgba(18,63,115,.9);color:'+W+';font-family:'+PV_MONO+';font-size:12.5px'),
    '#pvCart .pvT{border-right:1px solid #e9f3ff;border-bottom:1px solid #e9f3ff;display:flex;flex-direction:column;justify-content:center;padding:4px 12px;min-width:0}',
    '#pvCart .pvT small{font-size:10.5px;color:#bcd3ee;letter-spacing:.08em}#pvCart .pvT b{font-family:'+PV_MAIN+';font-weight:400;font-size:19px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#pvCart .pvTp{border-bottom:1px solid #e9f3ff;display:flex;align-items:center;justify-content:space-around;gap:4px;padding:6px 6px}',
    '#pvCart .pvTp button{height:30px;padding:0 9px;border:2px solid rgba(233,243,255,.55);border-radius:4px;background:transparent;color:rgba(233,243,255,.75);font-family:'+PV_MONO+';font-size:13px;letter-spacing:.12em;cursor:pointer}',
    '#pvCart .pvTp button:hover{border-color:#ffd37a;color:#ffd37a}#pvCart .pvTp button.on{border-color:#ff7b5c;color:#ff8f74;transform:rotate(-5deg);box-shadow:inset 0 0 0 2px rgba(255,123,92,.35)}',
    '#pvCart .pvTp button:focus-visible{outline:2px dashed #ffd37a;outline-offset:3px}',
    '#pvCart .pvNom{grid-column:span 2;max-height:122px;overflow:auto;scrollbar-width:thin}',
    '#pvCart .pvR{display:grid;grid-template-columns:44px 1fr 116px;border-bottom:1px solid #e9f3ff;min-height:24px;cursor:pointer}',
    '#pvCart .pvR>span{display:flex;align-items:center;padding:0 8px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#pvCart .pvR>span+span{border-left:1px solid #e9f3ff}#pvCart .pvR>span:nth-child(2){font-family:'+PV_MAIN+';font-size:14px}',
    '#pvCart .pvR.pvE{cursor:default;color:#bcd3ee;position:sticky;top:0;background:#123f73;z-index:1}',
    '#pvCart .pvR:not(.pvE):hover{background:rgba(233,243,255,.07)}',
    '#pvCart .pvR.sel{background:rgba(255,211,122,.18);color:#ffd37a}#pvCart .pvR.off{opacity:.5}#pvCart .pvR.warn{color:#ff8f74}',
    '#pvCart .pvPied{grid-column:span 2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 12px;color:#bcd3ee;white-space:nowrap}',
    /* ═══ l'annotation vivante ═══ */
    X(C,'#pvNote.on','display:block'),
    '#pvNote{position:fixed;z-index:5000;pointer-events:none;color:#fff3d6;font-family:'+PV_MAIN+'}',
    '#pvNote svg{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}',
    '#pvNote .pvTx{position:absolute;pointer-events:auto;display:flex;flex-direction:column;gap:3px;padding:4px 8px 6px;background:rgba(11,39,71,.72);border-radius:2px;white-space:nowrap}',
    '#pvNote .pvTx b{font-weight:400;font-size:21px;color:#ffd37a;letter-spacing:.03em}#pvNote .pvTx span{font-size:16px}',
    '#pvNote .pvTx label{display:flex;align-items:center;gap:7px;font-size:17px}',
    '#pvNote input{width:66px;height:30px;box-sizing:border-box;border:1.5px solid #ffd37a;border-radius:4px;background:rgba(255,211,122,.08);color:#fff3d6;font-family:'+PV_MAIN+';font-size:18px;text-align:center;padding:0}',
    '#pvNote input:disabled{opacity:.6}#pvNote .pvErr{font-family:'+PV_MONO+';font-size:11.5px;color:#ff8f74;white-space:normal;max-width:260px}'
  ].join('\n');
  document.head.appendChild(st);
}
function pvActif(){
  try{
    const b=document.body;
    return b.classList.contains('mq-lay')&&b.classList.contains('ui-modern')&&!b.classList.contains('mf-mobile')&&b.getAttribute('data-theme')==='planvivant'&&
      (b.getAttribute('data-ws')||'cao')==='cao'&&!b.classList.contains('mf-sk')&&b.getAttribute('data-asm')!=='1';
  }catch(e){return false;}
}
// Nomenclature du cartouche : une ligne par fonction (pas les esquisses). Pur sur ses entrées :
// S = étapes de la timeline ({kind,o,id}), sel = id choisi, off = ids non rejoués
function pvNomenclature(S,sel,off){
  const L=[];let rep=0;
  (S||[]).forEach(s=>{
    if(!s||s.kind!=='feature'||!s.o)return;
    rep++;
    let k={nom:'',reg:''};try{k=pvCourt(s);}catch(e){}
    L.push({rep,id:s.id,nom:k.nom||s.o.name||s.id,complet:s.o.name||s.id,reglage:k.reg||'',sel:!!sel&&s.id===sel,off:!!(off&&off.has&&off.has(s.id)),warn:!!s.o.warn});
  });
  return L;
}
// Nom court et valeur d'une étape, comme sur un plan (« Extrusion » 30, « Perçage » Ø9). Pur.
// Un nom donné par l'utilisateur est gardé ; un nom fabriqué (« Extrusion Esquisse 1 30mm ») est réduit à son 1er mot.
function pvCourt(s){
  if(!s||!s.o)return {nom:'',val:''};
  let nom='';try{nom=gtTigeNom(s);}catch(e){nom=s.o.name||'';}
  if(s.kind==='sketch')return {nom:String(nom).replace(/\s*\(.*\)\s*$/,''),val:''};
  if(s.kind!=='feature')return {nom,val:''};
  const f=s.o;
  if(/Esquisse|\(|·|\d\s*mm\b|°/.test(nom))nom=String(nom).split(/\s+/)[0]||nom;
  // réglage du cartouche : le détail de la tige sans le mot du nom (« découpe 6 mm » → « 6 mm »)
  let d='';try{d=gtTigeDetail(s);}catch(e){}
  const w=String(nom).toLowerCase();
  d=String(d||'');if(w&&d.toLowerCase().startsWith(w))d=d.slice(w.length).replace(/^\s*·?\s*/,'');
  d=d.replace(/^(chanfrein|congé|découpe|dépouille)\s*·?\s*/i,'');
  let V=null;try{V=gtValeur(f);}catch(e){V=null;}
  const val=V?(f.type==='hole'?'Ø':'')+gtNb(V.v)+(V.u==='°'?'°':''):d;
  return {nom,val,reg:d||val};
}
// noms et valeurs écrits au-dessus de chaque cote (appelé à chaque rendu de la timeline, par gtTigeSync)
function pvFriseHabille(R,S){
  const els=[...R.querySelectorAll('.tlbS')];
  els.forEach((el,i)=>{
    const s=S&&S[i];if(!s||(el.dataset&&s.id!==el.dataset.id))return;
    const m=document.createElement('span');m.className='pvNm';
    const K=pvCourt(s);
    const b=document.createElement('b');b.textContent=K.nom;m.appendChild(b);
    if(K.val){const it=document.createElement('i');it.textContent=K.val;m.appendChild(it);}
    el.title=(s.o&&s.o.name)||K.nom;
    el.appendChild(m);
  });
  pvCartMaj(R,S);
}
let pvCartSig='';
function pvCartMaj(R,S){
  const el=document.getElementById('pvCart');if(!el||!pvActif())return;
  R=R||(typeof tlbEl!=='undefined'&&tlbEl&&tlbEl._row)||null;
  if(!S){try{S=tlbSteps();}catch(e){S=[];}}
  const els=R?[...R.querySelectorAll('.tlbS')]:[];
  let sel=null;const off=new Set();
  els.forEach(e=>{const id=e.dataset&&e.dataset.id;if(!id)return;if(e.classList.contains('sel'))sel=id;if(e.classList.contains('off'))off.add(id);});
  const L=pvNomenclature(S,sel,off);
  let ws='cao';try{ws=document.body.getAttribute('data-ws')||'cao';}catch(e){}
  let nom='';try{nom=(document.getElementById('docName')||{}).textContent||doc.name||'';}catch(e){}
  const pied=pvPied();
  const sig=JSON.stringify([L,ws,nom,pied]);if(sig===pvCartSig)return;pvCartSig=sig;
  const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  el.innerHTML='<div class="pvT"><small>CONCEPTCAD</small><b title="'+esc(nom)+'">'+esc(nom||'Sans nom')+'</b></div>'+
    '<div class="pvTp" role="group" aria-label="Espaces de travail">'+[['cao','CAO'],['fao','FAO'],['plan','PLAN'],['rendu','RENDU']].map(([k,l])=>'<button type="button" data-ws="'+k+'" aria-pressed="'+(k===ws)+'"'+(k===ws?' class="on"':'')+'>'+l+'</button>').join('')+'</div>'+
    '<div class="pvNom"><div class="pvR pvE"><span>REP</span><span>FONCTION</span><span>RÉGLAGE</span></div>'+
    (L.length?L.map(x=>'<div class="pvR'+(x.sel?' sel':'')+(x.off?' off':'')+(x.warn?' warn':'')+'" data-id="'+esc(x.id)+'" title="'+esc(x.complet)+' — clic : choisir · double-clic : modifier"><span>'+x.rep+'</span><span>'+esc(x.nom)+'</span><span>'+esc(x.reglage||'—')+'</span></div>').join('')
      :'<div class="pvR pvE"><span>—</span><span>aucune fonction</span><span></span></div>')+'</div>'+
    '<div class="pvPied">'+pied.map(esc).map(t=>'<span>'+t+'</span>').join('')+'</div>';
  const s=el.querySelector('.pvR.sel');if(s)try{s.scrollIntoView({block:'nearest'});}catch(e){}
}
// matière · masse · volume des corps affichés (même calcul que la jauge de l'Habitacle)
function pvPied(){
  let B=[];try{B=(bodies||[]).filter(b=>b&&b.mesh&&!b.ghost&&b.mesh.visible!==false);}catch(e){B=[];}
  const L=[];
  B.forEach(b=>{let id=b.id;try{id=bodyIdOfRuntime(b);}catch(e){}
    let rho=0,mat='';try{const m=matDef(bodyMatOf(id));if(m){rho=m.rho;mat=m.nom||'';}}catch(e){}
    let v=0;try{v=meshVolumeMm3(b.mesh);}catch(e){}
    L.push({v,rho,mat});});
  let M={g:0,cm3:0,mat:''};try{M=hbMesure(L,0);}catch(e){}
  let ms='—';try{ms=M.g>0?fmtMasse(M.g):'—';}catch(e){}
  const nb=x=>String(+(+x).toFixed(1)).replace('.',',');
  return [(M.mat||'sans matière').toUpperCase(),'MASSE '+ms,(M.cm3>0?nb(M.cm3):'—')+' cm³'];
}
function pvCartClic(e){
  const t=e.target.closest&&e.target.closest('button[data-ws],.pvR[data-id]');if(!t)return;
  if(t.dataset.ws){try{mfWs(t.dataset.ws);}catch(err){}return;}
  const R=typeof tlbEl!=='undefined'&&tlbEl&&tlbEl._row;
  const s=R&&[...R.querySelectorAll('.tlbS')].find(x=>x.dataset.id===t.dataset.id);
  if(!s)return;
  if(e.type==='dblclick')s.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
  else s.click();
}
function pvSync(){
  try{
    pvCss();
    const vp=document.getElementById('vpwrap');if(!vp)return;
    if(!document.getElementById('pvRefs')){const m=document.createElement('div');m.id='pvRefs';m.setAttribute('aria-hidden','true');
      m.innerHTML='<div class="pvH">'+[1,2,3,4,5,6].map(i=>'<span>'+i+'</span>').join('')+'</div><div class="pvV">'+['A','B','C','D'].map(i=>'<span>'+i+'</span>').join('')+'</div>';vp.appendChild(m);}
    if(!document.getElementById('pvCart')){const m=document.createElement('div');m.id='pvCart';m.addEventListener('click',pvCartClic);m.addEventListener('dblclick',pvCartClic);vp.appendChild(m);}
    if(!document.getElementById('pvNote')){const m=document.createElement('div');m.id='pvNote';document.body.appendChild(m);}
    pvCartSig='';pvNoteCacher();
    if(pvActif())pvCartMaj();
  }catch(e){}
}
/* ----- l'annotation vivante : la fonction de la face cliquée, sa valeur à changer sur place ----- */
function pvNoteCacher(){const n=document.getElementById('pvNote');if(n){n.classList.remove('on');n.innerHTML='';}}
function pvNoteMontrer(cx,cy){
  const n=document.getElementById('pvNote');if(!n)return;
  let S=null;try{S=gtLireSel(cx,cy);}catch(e){S=null;}
  const f=S&&S.fid&&(doc.features||[]).find(x=>x.id===S.fid);
  if(!f){pvNoteCacher();return;}
  let V=null;try{V=gtValeur(f);}catch(e){V=null;}
  let d='';try{d=gtTigeDetail({kind:'feature',o:f,id:f.id});}catch(e){}
  const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  // texte au-dessus à droite du clic, ou à gauche près du bord
  const dx=cx+260>innerWidth?-210:110,dy=-74;
  const tx=cx+dx,ty=cy+dy;
  n.style.left='0px';n.style.top='0px';
  n.innerHTML='<svg width="1" height="1" aria-hidden="true"><path d="M'+cx+' '+cy+'L'+(tx+(dx<0?150:0))+' '+(ty+34)+'H'+(tx+(dx<0?0:150))+'" fill="none" stroke="#ffd37a" stroke-width="1.4"/><circle cx="'+cx+'" cy="'+cy+'" r="4" fill="#ffd37a"/></svg>'+
    '<div class="pvTx" title="'+esc(f.name||f.id)+'" style="left:'+(dx<0?tx-10:tx)+'px;top:'+(ty-30)+'px"><b>'+esc(String(pvCourt({kind:'feature',o:f,id:f.id}).nom||f.name||f.id).toUpperCase())+'</b>'+
    (V?'<label>'+esc(V.l.toLowerCase())+' <input aria-label="'+esc(V.l)+'" autocomplete="off"> '+esc(V.fx?'ƒx':V.u)+'</label><div class="pvErr" hidden></div>':(d?'<span>'+esc(d)+'</span>':''))+'</div>';
  n.classList.add('on');
  const inp=n.querySelector('input');if(!inp)return;
  inp.value=gtNb(V.v);
  if(V.fx){inp.disabled=true;inp.title='Valeur donnée par une formule : double-clic dans la frise pour la changer';return;}
  inp.title='Nouvelle valeur puis Entrée';
  const err=n.querySelector('.pvErr');
  inp.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Escape'){e.preventDefault();pvNoteCacher();return;}
    if(e.key!=='Enter')return;
    e.preventDefault();
    const v=typeof c3Parse==='function'?c3Parse(inp.value):parseFloat(String(inp.value).replace(',','.'));
    if(!(v>0)){err.textContent='Une valeur positive, en '+V.u;err.hidden=false;return;}
    if(Math.abs(v-V.v)<1e-9){pvNoteCacher();return;}
    let r='réglage indisponible';
    try{r=c3FeatSet(f,V.k,v,'Plan vivant : '+V.l.toLowerCase()+' de « '+(f.name||f.id)+' »');}catch(ex){r=ex&&ex.message||r;}
    if(r!==true){err.textContent=String(r);err.hidden=false;return;}
    pvNoteCacher();
  });
}
(function pvEcoute(){
  try{
    let D=null;
    document.addEventListener('pointerdown',e=>{
      const n=document.getElementById('pvNote');
      if(n&&n.contains(e.target))return;
      pvNoteCacher();
      D=null;
      if(!pvActif()||e.button!==0)return;
      try{if(typeof renderer==='undefined'||!renderer||e.target!==renderer.domElement)return;}catch(err){return;}
      D={x:e.clientX,y:e.clientY,sig:gtSig()};
    },true);
    document.addEventListener('pointerup',e=>{
      const d=D;D=null;if(!d)return;
      if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>5)return;
      setTimeout(()=>{
        try{
          if(!pvActif()||gtOutilOuvert())return;
          if(gtSig()===d.sig&&!(selFaces||[]).length)return;
          if((selFaces||[]).length===1&&!(selEdges||[]).length)pvNoteMontrer(e.clientX,e.clientY);
        }catch(err){}
      },0);
    },true);
    document.addEventListener('wheel',()=>pvNoteCacher(),{capture:true,passive:true});
    // matière, masse, nom : relus chaque seconde (rien n'est refait si rien n'a changé)
    setInterval(()=>{if(pvActif())pvCartMaj();},1000);
  }catch(e){}
})();
// au démarrage : mfTheme est passé avant que MF_MAQUETTE (97-interface-themes-futur) existe
(function(){
  try{mfMaquetteSync();}catch(e){}
})();
