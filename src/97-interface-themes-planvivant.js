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
   V1.1.13 (Fred, 27/11 : « les menus FAO, Assembler/Mise en plan ne sont pas traités comme le menu
   CAO », « Chaque partie doit avoir le même style partout ») : le cartouche et ses tampons dans chaque
   espace — nomenclature des opérations (REP · OPÉRATION · OUTIL) en FAO, des pièces (REP · PIÈCE ·
   QTÉ) en assemblage, des planches (REP · PLANCHE · FORMAT) en PLAN ; la cote de chaîne des étapes
   de l'assemblage et des opérations FAO ; les planches du PLAN en cote de chaîne ; la planche à
   dessin (cadre, repères) en assemblage et en FAO. L'annotation vivante reste en CAO (elle change
   une fonction de la pièce). Esquisse et téléphone : disposition habituelle. 🎨 › « Disposition de
   la maquette » remet la disposition habituelle. */
const PV_MAIN='"Segoe Print","Bradley Hand","Comic Sans MS","Chalkboard SE",cursive';
const PV_CART_D=338; // V1.2.1 : bord droit du cartouche = 18 px + la place du panneau des réglages (288 px, onglet, marges)
const PV_MONO='"Cascadia Mono",Consolas,"Lucida Console",ui-monospace,monospace';
function pvCss(){
  if(document.getElementById('pvCss'))return;
  const st=document.createElement('style');st.id='pvCss';
  const P='html body.ui-modern.mq-lay[data-theme="planvivant"]:not(.mf-mobile)';
  const C=P+'[data-ws="cao"]:not(.mf-sk):not([data-asm="1"])';
  const A=P+'[data-ws="cao"][data-asm="1"]:not(.mf-sk)'; // V1.1.13 : assemblage
  const F=P+'[data-ws="fao"]:not(.mf-sk)';                 // V1.1.13 : FAO
  const Q=P+'[data-ws="plan"]:not(.mf-sk)';                // V1.1.13 : PLAN
  const T3=[C,A,F];
  const X=(p,sel,decl)=>sel.split(',').map(s=>p+' '+s.trim()).join(',')+'{'+decl+'}';
  const W='#e9f3ff',J='#ffd37a',JT='#fff3d6';
  // la cote de chaîne d'une barre d'étapes (CAO : #mfTl des fonctions, assemblage : #asmTl des étapes)
  const chaine=(Z,T,titre)=>{const Y=(sel,decl)=>X(Z,sel.replace(/#mfTl/g,T),decl);return [
    Y('#mfTl','left:34px;right:auto;bottom:22px;width:min(880px,calc(100% - 920px));min-width:300px;box-sizing:border-box;padding:24px 4px 2px!important;'+
      'background:none!important;border:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;align-items:flex-end'),
    Y('#mfTl::before','content:"'+titre+'";position:absolute;left:6px;top:2px;font-family:'+PV_MONO+';font-size:11px;letter-spacing:.16em;color:#bcd3ee;pointer-events:none;white-space:nowrap'),
    Y('#mfTl .tlbC','opacity:.75;align-self:center'),
    Y('#mfTl .tlbN','font-family:'+PV_MONO+';color:#bcd3ee;align-self:center'),
    Y('#mfTl .tlbR','gap:0;align-items:stretch;padding:0 6px 0 0;height:58px;scrollbar-width:thin'),
    Y('#mfTl .tlbS','flex:1 1 0;min-width:78px;max-width:200px;height:58px;margin:0!important;padding:0!important;font-size:0;color:'+JT+'!important;border:none!important;border-left:1px solid '+W+'!important;border-radius:0!important;'+
      'background:linear-gradient('+W+','+W+') 0 38px/100% 1px no-repeat!important;box-shadow:none!important;position:relative;opacity:1'),
    Y('#mfTl .tlbS:last-of-type','border-right:1px solid '+W+'!important'),
    Y('#mfTl .tlbS>span:first-child','display:none'),
    Y('#mfTl .tlbS::before','content:"";position:absolute;left:0;top:35px;border:3.5px solid transparent;border-left:none;border-right:9px solid '+W+';pointer-events:none'),
    Y('#mfTl .tlbS::after','content:"";position:absolute;right:0;top:35px;border:3.5px solid transparent;border-right:none;border-left:9px solid '+W+';pointer-events:none;background:none;width:0;height:0;bottom:auto'),
    Y('#mfTl .tlbS.sk','flex:.7 1 0;min-width:62px'),
    Y('#mfTl .tlbS.off','opacity:.45'),
    Y('#mfTl .tlbS:hover','background-color:rgba(255,211,122,.08)!important'),
    Y('#mfTl .tlbS.sel','background:linear-gradient('+J+','+J+') 0 37px/100% 2.5px no-repeat,linear-gradient(rgba(255,211,122,.18),rgba(255,211,122,.18)) 2px 26px/calc(100% - 4px) 24px no-repeat!important;color:'+J+'!important'),
    Y('#mfTl .tlbS.warn','color:#ff8f74!important'),
    Y('#mfTl .pvNm','position:absolute;left:4px;right:4px;top:2px;display:flex;flex-direction:column;align-items:center;line-height:1.05;pointer-events:none;font-family:'+PV_MAIN+';white-space:nowrap;overflow:hidden'),
    Y('#mfTl .pvNm b','font-weight:400;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis'),
    Y('#mfTl .pvNm i','font-style:normal;font-size:11px;opacity:.85;max-width:100%;overflow:hidden;text-overflow:ellipsis'),
    Y('#mfTl .tlbS .pvNm','top:4px'),Y('#mfTl .tlbS.sk .pvNm b','font-size:12px'),
    Y('#mfTl .tlbM','width:2px;margin:0 -1px;background:'+J+';box-shadow:none;align-self:stretch;height:auto')];};
  st.textContent=[
    '#pvCart,#pvRefs,#pvNote,#pvFriseF{display:none}',
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
    ...[C,A,F,Q].map(Z=>X(Z,'.topbar .mfWs','display:none!important')), // les espaces : tampons du cartouche
    X(C,'#treeOverlay','max-height:calc(100% - 150px)!important'),X(A,'#treeOverlay','max-height:calc(100% - 150px)!important'),
    X(F,'#faoTreeWrap .fao-cnt','max-height:calc(100vh - 340px)!important'),
    ...T3.flatMap(Z=>[
      X(Z,'#vpwrap::before','content:"";position:absolute;inset:3px;pointer-events:none;z-index:1;border:2px solid rgba(233,243,255,.7);background:none'),
      X(Z,'#pvRefs','display:block;position:absolute;inset:0;pointer-events:none;z-index:2;font-family:'+PV_MONO+';font-size:10px;color:rgba(233,243,255,.6)')]),
    '#pvRefs .pvH{position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-around}#pvRefs .pvV{position:absolute;top:0;bottom:0;left:2px;display:flex;flex-direction:column;justify-content:space-around}',
    /* ═══ la frise en cote de chaîne : fonctions (CAO), étapes (assemblage), opérations (FAO), planches (PLAN) ═══ */
    ...chaine(C,'#mfTl','FRISE DES FONCTIONS — COTE DE CHAÎNE'),
    ...chaine(A,'#asmTl','FRISE DE L’ASSEMBLAGE'),
    X(A,'#asmTl .tlbK','display:none'),
    // le message de la vue : en haut, après les onglets (en bas il passait sous le cartouche)
    ...T3.map(Z=>X(Z,'#mfVpInfo','top:12px!important;bottom:auto!important;left:212px!important;right:auto!important;max-width:calc(100% - 640px);overflow:hidden;text-overflow:ellipsis')),
    X(F,'#pvFriseF','display:flex;position:absolute;left:34px;bottom:22px;z-index:22;width:min(880px,calc(100% - 920px));min-width:300px;box-sizing:border-box;padding:24px 4px 2px;align-items:flex-end;gap:8px'),
    '#pvFriseF::before{content:"FRISE DES OPÉRATIONS";position:absolute;left:6px;top:2px;font-family:'+PV_MONO+';font-size:11px;letter-spacing:.16em;color:#bcd3ee;pointer-events:none;white-space:nowrap}',
    '#pvFriseF .pvRow{display:flex;flex:1 1 auto;min-width:0;height:58px;overflow-x:auto;scrollbar-width:thin;padding:0 6px 0 0}',
    '#pvFriseF .pvSeg{flex:1 1 0;min-width:78px;max-width:200px;height:58px;position:relative;padding:0;border:none;border-left:1px solid '+W+';border-radius:0;color:'+JT+';cursor:pointer;'+
      'background:linear-gradient('+W+','+W+') 0 38px/100% 1px no-repeat;font:inherit}',
    '#pvFriseF .pvSeg:last-child{border-right:1px solid '+W+'}',
    '#pvFriseF .pvSeg::before{content:"";position:absolute;left:0;top:35px;border:3.5px solid transparent;border-left:none;border-right:9px solid '+W+';pointer-events:none}',
    '#pvFriseF .pvSeg::after{content:"";position:absolute;right:0;top:35px;border:3.5px solid transparent;border-right:none;border-left:9px solid '+W+';pointer-events:none}',
    '#pvFriseF .pvSeg:hover{background-color:rgba(255,211,122,.08)}',
    '#pvFriseF .pvSeg.sel{background:linear-gradient('+J+','+J+') 0 37px/100% 2.5px no-repeat,linear-gradient(rgba(255,211,122,.18),rgba(255,211,122,.18)) 2px 26px/calc(100% - 4px) 24px no-repeat;color:'+J+'}',
    '#pvFriseF .pvSeg.off{opacity:.45}#pvFriseF .pvSeg.warn{color:#ff8f74}',
    '#pvFriseF .pvSeg.pvPos{flex:0 0 auto;min-width:64px;font-family:'+PV_MONO+';font-size:10px;letter-spacing:.1em;color:#bcd3ee}',
    '#pvFriseF .pvNm{position:absolute;left:4px;right:4px;top:4px;display:flex;flex-direction:column;align-items:center;line-height:1.05;pointer-events:none;font-family:'+PV_MAIN+';white-space:nowrap;overflow:hidden}',
    '#pvFriseF .pvNm b{font-weight:400;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis}',
    '#pvFriseF .pvNm i{font-style:normal;font-size:11px;opacity:.85;max-width:100%;overflow:hidden;text-overflow:ellipsis}',
    '#pvFriseF .pvSeg.pvPos .pvNm b{font-family:'+PV_MONO+';font-size:10px;letter-spacing:.1em}',
    // PLAN : les planches en cote de chaîne, au-dessus de la feuille
    X(Q,'#mepTabs','gap:0;align-items:stretch;padding:6px 14px 4px;background:rgba(18,63,115,.92)!important;border-bottom:1.5px solid rgba(233,243,255,.55)'),
    X(Q,'#mepTabs button:not(.mepAdd)','min-width:150px;height:40px;padding:0 10px 14px!important;position:relative;border:none!important;border-left:1px solid '+W+'!important;border-right:1px solid '+W+'!important;border-radius:0!important;'+
      'background:linear-gradient('+W+','+W+') 0 28px/100% 1px no-repeat!important;color:'+JT+'!important;font-family:'+PV_MAIN+';font-size:13px;font-weight:400!important'),
    X(Q,'#mepTabs button:not(.mepAdd)+button:not(.mepAdd)','border-left:none!important'),
    X(Q,'#mepTabs button:not(.mepAdd)::before','content:"";position:absolute;left:0;top:25px;border:3.5px solid transparent;border-left:none;border-right:9px solid '+W),
    X(Q,'#mepTabs button:not(.mepAdd)::after','content:"";position:absolute;right:0;top:25px;border:3.5px solid transparent;border-right:none;border-left:9px solid '+W),
    X(Q,'#mepTabs button.on','color:'+J+'!important;background:linear-gradient('+J+','+J+') 0 27px/100% 2.5px no-repeat,linear-gradient(rgba(255,211,122,.16),rgba(255,211,122,.16)) 2px 4px/calc(100% - 4px) 20px no-repeat!important'),
    X(Q,'#mepTabs .mepAdd','align-self:center;margin-left:8px;border:1.5px solid rgba(233,243,255,.55)!important;border-radius:4px!important;background:none!important;color:'+W+'!important'),
    X(Q,'#mepTabs>span','align-self:center;color:#bcd3ee!important;font-family:'+PV_MONO),
    /* ═══ le cartouche ═══
       V1.2.1 (Fred, 28/11 : « le bandeau avec le CAO/FAO/Mise en plan est caché par la fenêtre des modifications des fonctions ») :
       il reste immobile (rien ne glisse quand le panneau s'ouvre, règle du 27/11) mais toujours à gauche de la PLACE du
       panneau des réglages (288 px + son onglet), ouvert ou non ; la frise s'arrête avant lui */
    ...T3.map(Z=>X(Z,'#pvCart','display:grid;position:absolute;right:'+PV_CART_D+'px;bottom:18px;z-index:24;width:min(500px,34%);min-width:380px;box-sizing:border-box;'+
      'grid-template-columns:1fr 1fr;border:2px solid '+W+';background:rgba(18,63,115,.9);color:'+W+';font-family:'+PV_MONO+';font-size:12.5px')),
    // PLAN : en bas à gauche (le cartouche du dessin est en bas à droite de la feuille)
    X(Q,'#pvCart','display:grid;position:absolute;left:34px;right:auto;bottom:34px;z-index:55;width:min(460px,34%);min-width:360px;box-sizing:border-box;'+
      'grid-template-columns:1fr 1fr;border:2px solid '+W+';background:rgba(18,63,115,.94);color:'+W+';font-family:'+PV_MONO+';font-size:12.5px'),
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
// V1.1.13 : la disposition est en place, quel que soit l'espace (hors esquisse et téléphone)
function pvOn(){
  try{
    const b=document.body;
    return b.classList.contains('mq-lay')&&b.classList.contains('ui-modern')&&!b.classList.contains('mf-mobile')&&b.getAttribute('data-theme')==='planvivant'&&
      !b.classList.contains('mf-sk');
  }catch(e){return false;}
}
// CAO (pièce) : frise des fonctions, annotation vivante
function pvActif(){return pvOn()&&mfEspace()==='cao';}
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
/* V1.1.13 : nomenclatures du cartouche des autres espaces. Pures sur leurs entrées. */
// FAO : une ligne par opération, tous posages (REP · OPÉRATION · OUTIL)
function pvNomFao(root,selId){
  const L=[];let rep=0;
  ((root&&root.setups)||[]).forEach(s=>(s.ops||[]).forEach(op=>{
    rep++;
    let nom='';try{nom=faoOpShortLabel(op);}catch(e){}
    if(!nom)nom=op.name||op.type||op.id;
    let t=null;try{t=faoToolById(s,op.toolId);}catch(e){t=null;}
    const outil=t?'T'+(t.num!=null?t.num:'?')+(t.d>0?' Ø'+gtNb(t.d):''):'—';
    L.push({rep,id:op.id,sid:s.id,nom,complet:s.name+' · '+nom,reglage:outil,sel:!!selId&&op.id===selId,off:op.on===false,warn:op.stale===true});
  }));
  return L;
}
// Assemblage : une ligne par composant, avec sa quantité (REP · PIÈCE · QTÉ) — nomFn(occ) donne le nom du composant
function pvNomAsm(occ,selId,nomFn){
  const L=[],par=new Map();
  (occ||[]).forEach(o=>{
    if(!o)return;
    let nom='';try{nom=nomFn?nomFn(o):'';}catch(e){}
    if(!nom)nom=String(o.name||o.id).replace(/:\d+$/,'');
    const k=o.comp||nom;
    if(!par.has(k)){const x={rep:0,id:o.id,ids:[],nom,complet:nom,reglage:'',sel:false,off:false,warn:false};par.set(k,x);L.push(x);}
    const x=par.get(k);x.ids.push(o.id);if(selId&&o.id===selId){x.sel=true;x.id=o.id;}
    if(o.st==='warn')x.warn=true;
  });
  L.forEach((x,i)=>{x.rep=i+1;x.reglage='× '+x.ids.length;});
  return L;
}
// PLAN : une ligne par planche (REP · PLANCHE · FORMAT)
function pvNomPlan(mep){
  const L=(mep&&mep.sheets)||[],cur=mep&&mep.cur|0;
  return L.map((sh,i)=>({rep:i+1,id:String(i),nom:sh.name||('Planche '+(i+1)),complet:sh.name||'',reglage:(sh.format||'')+(sh.orient?' '+(sh.orient==='landscape'?'paysage':'portrait'):''),
    sel:i===cur,off:false,warn:false}));
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
  const el=document.getElementById('pvCart');if(!el||!pvOn())return;
  const e=mfEspace();
  // V1.1.13 : la nomenclature de l'espace où l'on est
  let L=[],tete=['REP','FONCTION','RÉGLAGE'],vide='aucune fonction',aide='clic : choisir · double-clic : modifier';
  if(e==='fao'){let sid=null;try{sid=sel&&sel.kind==='faoOp'?sel.id:null;}catch(x){}
    try{const r=faoRoot();L=pvNomFao({setups:mfPosagesVus(r)},sid);}catch(x){L=[];}tete=['REP','OPÉRATION','OUTIL'];vide='aucune opération';aide='clic : sa fiche';}
  else if(e==='asm'){let c=null;try{c=asmActiveComp();}catch(x){}
    L=pvNomAsm(c&&c.occ,typeof asmSelId!=='undefined'?asmSelId:null,o=>{const k=asmComp(o.comp);return k&&k.name;});tete=['REP','PIÈCE','QTÉ'];vide='aucune pièce';aide='clic : choisir la pièce';}
  else if(e==='plan'){L=pvNomPlan(doc.mep);tete=['REP','PLANCHE','FORMAT'];vide='aucune planche';aide='clic : afficher la planche';}
  else{
    R=R||(typeof tlbEl!=='undefined'&&tlbEl&&tlbEl._row)||null;
    if(!S){try{S=tlbSteps();}catch(x){S=[];}}
    const els=R?[...R.querySelectorAll('.tlbS')]:[];
    let sl=null;const off=new Set();
    els.forEach(x=>{const id=x.dataset&&x.dataset.id;if(!id)return;if(x.classList.contains('sel'))sl=id;if(x.classList.contains('off'))off.add(id);});
    L=pvNomenclature(S,sl,off);
  }
  let ws='cao';try{ws=document.body.getAttribute('data-ws')||'cao';}catch(x){}
  let nom='';try{nom=(document.getElementById('docName')||{}).textContent||doc.name||'';}catch(x){}
  const pied=pvPied(e);
  const sig=JSON.stringify([e,L,ws,nom,pied]);if(sig===pvCartSig)return;pvCartSig=sig;
  const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  el.innerHTML='<div class="pvT"><small>CONCEPTCAD</small><b title="'+esc(nom)+'">'+esc(nom||'Sans nom')+'</b></div>'+
    '<div class="pvTp" role="group" aria-label="Espaces de travail">'+[['cao','CAO'],['fao','FAO'],['plan','PLAN'],['rendu','RENDU']].map(([k,l])=>'<button type="button" data-ws="'+k+'" aria-pressed="'+(k===ws)+'"'+(k===ws?' class="on"':'')+'>'+l+'</button>').join('')+'</div>'+
    '<div class="pvNom"><div class="pvR pvE">'+tete.map(t=>'<span>'+t+'</span>').join('')+'</div>'+
    (L.length?L.map(x=>'<div class="pvR'+(x.sel?' sel':'')+(x.off?' off':'')+(x.warn?' warn':'')+'" data-k="'+e+'" data-id="'+esc(x.id)+'"'+(x.sid?' data-s="'+esc(x.sid)+'"':'')+' title="'+esc(x.complet)+' — '+aide+'"><span>'+x.rep+'</span><span>'+esc(x.nom)+'</span><span>'+esc(x.reglage||'—')+'</span></div>').join('')
      :'<div class="pvR pvE"><span>—</span><span>'+vide+'</span><span></span></div>')+'</div>'+
    '<div class="pvPied">'+pied.map(esc).map(t=>'<span>'+t+'</span>').join('')+'</div>';
  const s=el.querySelector('.pvR.sel');if(s)try{s.scrollIntoView({block:'nearest'});}catch(x){}
}
// matière · masse · volume des corps affichés (même calcul que la jauge de l'Habitacle)
// V1.1.13 : FAO, assemblage et PLAN ont leur pied (posages et outils, pièces et étapes, vues et cotes)
function pvPied(e){
  const pl=(n,u)=>n+' '+u+(n>1?'S':'');
  try{
    if(e==='fao'){const U=hbUsinage(faoRoot());return [pl(U.posages,'POSAGE'),pl(U.outils,'OUTIL'),pl(U.n,'OPÉRATION')];}
    if(e==='asm'){const c=asmActiveComp(),H=c?asmHistOf(c):[];return [pl(c&&c.occ?c.occ.length:0,'PIÈCE'),pl(H.length,'ÉTAPE'),pl(H.filter(s=>s.k==='rel').length,'RELATION')];}
    if(e==='plan'){const m=doc.mep||{},sh=(m.sheets||[])[m.cur|0]||{};return [String(sh.format||'').toUpperCase(),pl((sh.views||[]).length,'VUE'),pl((sh.dims||[]).length,'COTE')];}
  }catch(err){return ['','',''];}
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
  // V1.1.13 : une opération (sa fiche), une pièce de l'assemblage (choisie), une planche (affichée)
  const k=t.dataset.k;
  if(k==='fao'){try{faoSelectOp(t.dataset.s,t.dataset.id);}catch(err){}return;}
  if(k==='asm'){try{asmSelId=t.dataset.id;asmDraw();asmGizmoDraw();renderTree();renderProps();}catch(err){}pvCartSig='';pvCartMaj();return;}
  if(k==='plan'){const b=[...document.querySelectorAll('#mepTabs button:not(.mepAdd)')][+t.dataset.id];if(b)b.click();pvCartSig='';setTimeout(()=>pvCartMaj(),0);return;}
  const R=typeof tlbEl!=='undefined'&&tlbEl&&tlbEl._row;
  const s=R&&[...R.querySelectorAll('.tlbS')].find(x=>x.dataset.id===t.dataset.id);
  if(!s)return;
  if(e.type==='dblclick')s.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
  else s.click();
}
/* ----- V1.1.13 : assemblage — noms et valeurs au-dessus des cotes de l'assemblage (48 → mfAsmTlSync) ----- */
function pvAsmHabille(R,H,c){
  if(!pvOn())return;
  [...R.querySelectorAll('.tlbS')].forEach((el,i)=>{
    const s=H&&H[i];if(!s)return;
    let nc='';try{nc=asmHistName(c,s);}catch(e){}
    const E=mfAsmEtape(nc);
    const m=document.createElement('span');m.className='pvNm';
    const b=document.createElement('b');b.textContent=E.nom;m.appendChild(b);
    if(E.detail){const it=document.createElement('i');it.textContent=E.detail;m.appendChild(it);}
    el.appendChild(m);
  });
  pvCartSig='';pvCartMaj();
}
/* ----- V1.1.13 : FAO — la cote de chaîne des opérations et le cartouche (88 faoRenderTree → mfFaoArbreSync) ----- */
function pvFaoHabille(tree){
  if(!pvOn())return;
  const vp=document.getElementById('vpwrap');if(!vp)return;
  let el=document.getElementById('pvFriseF');
  if(!el){el=document.createElement('div');el.id='pvFriseF';el.setAttribute('role','toolbar');el.setAttribute('aria-label','Frise des opérations');
    ['pointerdown','mousedown','dblclick','contextmenu'].forEach(t=>el.addEventListener(t,e=>{try{e.stopPropagation();}catch(_){}}));
    vp.appendChild(el);}
  let R=null;try{R=faoRoot();}catch(e){return;}
  let sid=null,pid=null;try{if(sel&&sel.kind==='faoOp')sid=sel.id;if(sel&&sel.kind==='faoSetup')pid=sel.id;}catch(e){}
  const row=document.createElement('div');row.className='pvRow';
  const seg=(cls,nom,val,tip,fn)=>{const b=document.createElement('button');b.type='button';b.className='pvSeg'+cls;b.title=tip;
    const m=document.createElement('span');m.className='pvNm';const x=document.createElement('b');x.textContent=nom;m.appendChild(x);
    if(val){const i=document.createElement('i');i.textContent=val;m.appendChild(i);}
    b.appendChild(m);b.onclick=fn;row.appendChild(b);};
  const vus=new Set(mfPosagesVus(R).map(s=>s.id)); // V1.1.13 : les opérations du posage choisi seulement
  (R.setups||[]).forEach(s=>{
    seg(' pvPos'+(pid===s.id?' sel':''),String(s.name).toUpperCase(),'','Posage « '+s.name+' » : sa fiche',()=>{try{faoSelectSetup(s.id);}catch(e){}});
    if(!vus.has(s.id))return;
    const L=pvNomFao({setups:[s]},sid);
    L.forEach((x,i)=>seg((x.sel?' sel':'')+(x.off?' off':'')+(x.warn?' warn':''),(i+1)+'. '+String(x.nom).split(/\s+/)[0],x.reglage,x.complet+(x.warn?' — parcours à régénérer':''),()=>{try{faoSelectOp(s.id,x.id);}catch(e){}}));
  });
  el.innerHTML='';el.appendChild(row);
  pvCartSig='';pvCartMaj();
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
    if(pvOn())pvCartMaj();
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
    setInterval(()=>{if(pvOn())pvCartMaj();},1000);
  }catch(e){}
})();
// au démarrage : mfTheme est passé avant que MF_MAQUETTE (97-interface-themes-futur) existe
(function(){
  try{mfMaquetteSync();}catch(e){}
})();
