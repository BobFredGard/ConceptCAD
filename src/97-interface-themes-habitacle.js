/* ---------- L'Habitacle, sa disposition : celle de la maquette (V1.1.10) ----------
   Fred, 27/11 : « J'aimerais vraiment que tu te rapproches de tes 4 façons proposées ». Après la
   Goutte (V1.1.9), l'Habitacle — le poste de pilotage du canevas des pistes :
   • une VISIÈRE suspendue en haut : bandeau et ruban réunis, centrés, coins bas arrondis ; les
     commandes y deviennent des « pods » carrés (icône seule, nom en bulle), les groupes séparés
     par un point lumineux, ▾ ouvre toujours la liste complète du groupe ;
   • deux ÉCRANS INCLINÉS : à gauche l'historique (l'arbre, titre HISTORIQUE et nom de la pièce),
     à droite les RÉGLAGES (le panneau des paramètres, cadre orange) ; ils se redressent dès que la
     souris y va ;
   • la FRISE des fonctions en bas au milieu : un rail lumineux, un point par étape, l'étape
     choisie en orange ;
   • la JAUGE DE MASSE en bas à gauche : masse, volume, matière, et l'anneau = remplissage de la
     boîte englobante ;
   • le GYROSCOPE en bas à droite : le cube de vue, ceint de ses anneaux X, Y, Z ;
   • « SOUS LE CURSEUR » : la face survolée est nommée à côté de la souris (trait orange) ;
   • en haut de la vue : l'espace et l'état (enregistré / modifié, nombre de fonctions).
   CAO seulement pour la frise, la jauge, le gyroscope et la lecture sous le curseur ; la visière
   vaut partout. 🎨 › « Disposition de la maquette » remet la disposition habituelle (mq-lay). */
function hbCss(){
  if(document.getElementById('hbCss'))return;
  const st=document.createElement('style');st.id='hbCss';
  const H='html body.ui-modern.mq-lay[data-theme="habitacle"]:not(.mf-mobile)';
  const C=H+'[data-ws="cao"]:not(.mf-sk):not([data-asm="1"])';
  const X=(p,sel,decl)=>sel.split(',').map(s=>p+' '+s.trim()).join(',')+'{'+decl+'}';
  const MONO='font-family:"Cascadia Mono",Consolas,"JetBrains Mono",ui-monospace,monospace';
  const CY='#6ff3ff',OR='#ff8a3d';
  st.textContent=[
    '#hbMasse,#hbHud,#hbEtat{display:none}',
    /* ═══ la visière : bandeau + ruban, centrés, suspendus ═══ */
    X(H,'.topbar','width:min(1240px,calc(100% - 24px));margin:0 auto!important;box-sizing:border-box;border:1px solid rgba(111,243,255,.32)!important;border-top:none!important;border-bottom:1px solid rgba(111,243,255,.14)!important;border-radius:0;background:linear-gradient(180deg,rgba(8,30,48,.95),rgba(6,22,38,.9))!important'),
    X(H,'.topbar .mfSearch','flex:0 0 190px;min-width:190px'),
    X(H,'#mfRibbon','width:min(1240px,calc(100% - 24px));margin:0 auto 10px!important;box-sizing:border-box;justify-content:center;gap:0;padding:8px 18px 10px;border:1px solid rgba(111,243,255,.32)!important;border-top:none!important;border-radius:0 0 26px 26px!important;'+
      'background:linear-gradient(180deg,rgba(6,22,38,.9),rgba(6,20,34,.72))!important;box-shadow:0 14px 40px rgba(0,0,0,.45),0 0 30px rgba(34,211,238,.1)!important'),
    X(H,'#mfRibbon .mfGrp','flex-direction:row;align-items:center;border-right:none!important;padding:0 2px'),
    X(H,'#mfRibbon .mfGrp+.mfGrp::before','content:"";flex:none;width:5px;height:5px;border-radius:50%;background:'+CY+';box-shadow:0 0 8px '+CY+';margin:0 10px'),
    X(H,'#mfRibbon .mfGrpB','gap:6px;align-items:center'),
    X(H,'#mfRibbon .mfRb','width:40px;min-width:40px;height:40px;padding:0;font-size:0;gap:0;border-radius:10px;border:1px solid rgba(111,243,255,.18);background:rgba(111,243,255,.05);color:#bdf6ff;transition:background .2s,box-shadow .2s,transform .2s'),
    X(H,'#mfRibbon .mfRb i','height:auto;color:#bdf6ff'),
    X(H,'#mfRibbon .mfRb:hover','background:rgba(111,243,255,.18);box-shadow:0 0 18px rgba(111,243,255,.45);transform:translateY(-2px)'),
    X(H,'#mfRibbon .mfRb.mfOn','background:rgba(255,138,61,.22);border-color:rgba(255,178,125,.8);box-shadow:0 0 16px rgba(255,138,61,.5)'),
    X(H,'#mfRibbon .mfGrpT','order:2;font-size:0;width:16px;height:40px;margin:0 0 0 2px;padding:0;border-radius:6px'),
    X(H,'#mfRibbon .mfGrpT::after','content:"▾";font-size:11px;color:#7fb4c9;opacity:1'),
    /* ═══ CAO : écrans inclinés ═══ */
    X(C,'#treeOverlay','transform:perspective(1100px) rotateY(16deg);max-height:calc(100% - 230px)!important;border-radius:18px!important;padding:16px 16px 14px!important;'+
      'background:linear-gradient(160deg,rgba(14,44,68,.8),rgba(5,16,28,.74))!important;border-color:rgba(111,243,255,.34)!important'),
    X(C,'#treeOverlay:hover,#treeOverlay:focus-within','transform:none'),
    X(C,'#treeOverlay .ovlTitle','font-size:0!important;margin:0 0 10px!important'),
    X(C,'#treeOverlay .ovlTitle::before','content:"HISTORIQUE";display:block;font-size:11px;letter-spacing:.2em;color:#8fdcef;'+MONO),
    X(C,'#treeOverlay .ovlTitle #docName','display:block;font-size:19px;font-weight:600;color:#fff;letter-spacing:.01em;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'),
    X(C,'#treeOverlay .ovlNote','display:none'),
    X(C,'#tree','border-left:1px solid rgba(111,243,255,.3);padding-left:8px'),
    X(C,'#tree .tnode','border-radius:8px;padding:4px 8px;border:1px solid transparent'),
    X(C,'#tree .tnode.sel','background:rgba(255,138,61,.14)!important;border-color:rgba(255,157,87,.55)'),
    X(C,'#tree .tgroup','color:#8fdcef!important;letter-spacing:.16em;text-transform:uppercase;font-size:10px;'+MONO),
    X(C,'#propsWrap>.right>.panel','transform:perspective(1100px) rotateY(-14deg);border-radius:18px!important;border-color:rgba(255,157,87,.45)!important;'+
      'background:linear-gradient(200deg,rgba(40,26,20,.76),rgba(6,16,28,.82))!important;box-shadow:0 0 30px rgba(255,138,61,.12),0 20px 50px rgba(0,0,0,.5)!important'),
    X(C,'#propsWrap>.right>.panel:hover,#propsWrap>.right>.panel:focus-within','transform:none'),
    X(C,'#propsWrap>.right>.panel .panel-title','color:#ffb27d!important;letter-spacing:.2em;text-transform:uppercase;font-size:11px;'+MONO),
    /* ═══ la frise des fonctions : un rail, un point par étape ═══ */
    X(C,'#mfTl','left:calc(50% - var(--mfPropsW,0px) / 2);right:auto;transform:translateX(-50%);width:min(820px,calc(100% - 560px - var(--mfPropsW,0px)));min-width:340px;box-sizing:border-box;bottom:22px;padding:6px 16px!important;border-radius:31px!important'),
    X(C,'#mfTl .tlbR','gap:22px;padding:10px 12px;background:linear-gradient(90deg,rgba(111,243,255,.2),'+CY+' 10%,'+CY+' 90%,rgba(111,243,255,.15)) 0 50%/100% 2px no-repeat local'),
    X(C,'#mfTl .tlbS','min-width:16px;width:16px;height:16px;padding:0!important;font-size:0;border-radius:50%!important;border:2px solid '+CY+'!important;background:#06121e!important;box-shadow:0 0 8px rgba(111,243,255,.45)!important;color:transparent!important'),
    X(C,'#mfTl .tlbS>span:first-child','display:none'),
    X(C,'#mfTl .tlbS.sk','min-width:11px;width:11px;height:11px;border-width:1.5px!important;opacity:.85'),
    X(C,'#mfTl .tlbS:hover','transform:scale(1.35)'),
    X(C,'#mfTl .tlbS.sel','min-width:22px;width:22px;height:22px;background:'+OR+'!important;border-color:#ffb27d!important;box-shadow:0 0 16px '+OR+'!important'),
    X(C,'#mfTl .tlbS.warn','border-color:#ff453a!important;box-shadow:0 0 10px #ff453a!important'),
    X(C,'#mfTl .tlbM','width:3px;height:26px;margin:0 -8px;background:'+OR+';box-shadow:0 0 10px '+OR),
    X(C,'#mfTl .tlbM::before','border-top-color:'+OR),
    X(C,'#mfTl .tlbN','color:#8fdcef;'+MONO),
    X(C,'#mfVpInfo','bottom:178px!important;right:calc(24px + var(--mfPropsW,0px))'),
    /* ═══ le gyroscope : le cube de vue ceint de ses anneaux ═══ */
    X(C,'#mfCube','top:auto!important;bottom:16px;right:calc(22px + var(--mfPropsW,0px))!important;width:136px;height:136px;border-radius:50%;background:radial-gradient(circle,rgba(5,18,30,.62) 64%,transparent 65%);border:1px solid rgba(111,243,255,.22)'),
    X(C,'#mfCube canvas','position:absolute;left:23px;top:23px;width:90px!important;height:90px!important'),
    X(C,'#mfCube::before','content:"";position:absolute;inset:10px;border-radius:50%;border:2px solid rgba(255,143,128,.75);transform:rotateX(68deg);pointer-events:none'),
    X(C,'#mfCube::after','content:"";position:absolute;inset:10px;border-radius:50%;border:2px solid rgba(125,255,168,.7);transform:rotate(35deg) rotateY(68deg);pointer-events:none'),
    X(C,'#mfCubeHome','top:6px;left:6px'),
    X(C,'#mfOrbit','top:28px;left:0'),
    X(C,'#viewbar,#setMenu','right:calc(22px + var(--mfPropsW,0px))!important'),
    /* ═══ la jauge de masse, l'état, la lecture sous le curseur ═══ */
    X(C,'#hbMasse','display:flex;position:absolute;left:26px;bottom:20px;z-index:23;align-items:center;gap:14px;pointer-events:none;'+MONO),
    '#hbMasse svg{flex:none;filter:drop-shadow(0 0 6px rgba(111,243,255,.45))}',
    '#hbMasse .hbK{font-size:10.5px;letter-spacing:.2em;color:#7fb4c9}',
    '#hbMasse .hbV{font-size:25px;color:#fff;line-height:1.1}#hbMasse .hbV small{font-size:13px;color:#8fdcef;margin-left:4px}',
    '#hbMasse .hbS{font-size:11.5px;color:#7fa3b8}',
    X(C,'#hbEtat','display:flex;position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:23;gap:10px;align-items:center;pointer-events:none;font-size:11.5px;'+MONO),
    '#hbEtat .hbE{letter-spacing:.16em;color:#5f8aa3}',
    '#hbEtat .hbC{padding:4px 10px;border-radius:999px;border:1px solid rgba(111,243,255,.25);color:#8fdcef;background:rgba(5,16,28,.55)}',
    '#hbEtat .hbC.ok{border-color:rgba(125,255,168,.4);color:#9dffbe}#hbEtat .hbC.mod{border-color:rgba(255,178,125,.55);color:#ffcfa8}',
    X(C,'#hbHud.on','display:block'),
    '#hbHud{position:fixed;z-index:5000;pointer-events:none;padding:2px 0 2px 10px;border-left:2px solid #ff9d57;'+MONO+';text-shadow:0 0 6px rgba(0,0,0,.9)}',
    '#hbHud .hbK{display:block;font-size:10.5px;letter-spacing:.16em;color:#ffb27d}',
    '#hbHud .hbT{display:block;font-size:13px;color:#ffe2cc;white-space:nowrap}',
    '#hbHud::before{content:"";position:absolute;left:-44px;bottom:-30px;width:56px;height:1.2px;background:#ff9d57;transform:rotate(-38deg);transform-origin:100% 50%}',
    '#hbHud::after{content:"";position:absolute;left:-49px;bottom:-37px;width:6px;height:6px;border-radius:50%;background:#ff9d57;box-shadow:0 0 8px #ff9d57}'
  ].join('\n');
  document.head.appendChild(st);
}
function hbActif(){
  try{
    const b=document.body;
    return b.classList.contains('mq-lay')&&b.classList.contains('ui-modern')&&!b.classList.contains('mf-mobile')&&b.getAttribute('data-theme')==='habitacle'&&
      (b.getAttribute('data-ws')||'cao')==='cao'&&!b.classList.contains('mf-sk')&&b.getAttribute('data-asm')!=='1';
  }catch(e){return false;}
}
// Masse, volume, matière et remplissage de la boîte englobante des corps affichés. Pur sur ses entrées :
// L = [{v: mm³, rho: g/cm³ ou 0, mat: nom ou ''}], box = volume de la boîte englobante (mm³)
function hbMesure(L,box){
  let v=0,g=0,alu=false;const mats=new Set();
  (L||[]).forEach(x=>{const vv=+x.v||0;v+=vv;let r=+x.rho||0;if(!(r>0)){r=2.7;alu=true;}else if(x.mat)mats.add(x.mat);g+=vv/1000*r;});
  const mat=mats.size>1?mats.size+' matières':mats.size===1?[...mats][0]:(alu&&v>0?'alu par défaut':'');
  const rempli=box>0&&v>0?Math.max(0,Math.min(1,v/box)):0;
  return {g,cm3:v/1000,mat,rempli,alu};
}
let hbSigMasse='';
function hbMasseMaj(){
  const el=document.getElementById('hbMasse');if(!el)return;
  let B=[];try{B=(bodies||[]).filter(b=>b&&b.mesh&&!b.ghost&&b.mesh.visible!==false);}catch(e){B=[];}
  const sig=B.map(b=>(b.mesh.geometry&&b.mesh.geometry.uuid)||'').join(',');
  if(sig===hbSigMasse)return;hbSigMasse=sig;
  const L=[];let box=0;
  try{
    const bb=new THREE.Box3();
    B.forEach(b=>{let id=b.id;try{if(typeof bodyIdOfRuntime==='function')id=bodyIdOfRuntime(b);}catch(e){}
      let rho=0,mat='';try{const m=typeof matDef==='function'&&matDef(bodyMatOf(id));if(m){rho=m.rho;mat=m.nom||'';}}catch(e){}
      let v=0;try{v=meshVolumeMm3(b.mesh);}catch(e){}
      L.push({v,rho,mat});try{bb.expandByObject(b.mesh);}catch(e){}});
    if(!bb.isEmpty()){const s=bb.getSize(new THREE.Vector3());box=s.x*s.y*s.z;}
  }catch(e){}
  const M=hbMesure(L,box);
  const r=31,c=2*Math.PI*r,arc=(M.rempli*c).toFixed(1);
  const nb=x=>String(+(+x).toFixed(1)).replace('.',',');
  let ms='—';try{ms=M.g>0?fmtMasse(M.g):'—';}catch(e){}
  const mv=ms.split(' ');
  el.title='Masse des corps affichés'+(M.alu?' (aluminium quand le corps n’a pas de matière)':'')+'\nAnneau : remplissage de la boîte englobante, '+Math.round(M.rempli*100)+' %';
  el.innerHTML='<svg width="74" height="74" viewBox="0 0 74 74" aria-hidden="true"><circle cx="37" cy="37" r="31" fill="none" stroke="rgba(111,243,255,.18)" stroke-width="5"/>'+
    '<circle cx="37" cy="37" r="31" fill="none" stroke="#6ff3ff" stroke-width="5" stroke-linecap="round" stroke-dasharray="'+arc+' '+c.toFixed(1)+'" transform="rotate(-90 37 37)"/>'+
    '<text x="37" y="41" text-anchor="middle" font-size="12" fill="#bdf6ff">'+Math.round(M.rempli*100)+'%</text></svg>'+
    '<div><div class="hbK">MASSE</div><div class="hbV">'+(mv[0]||'—')+(mv[1]?'<small>'+mv[1]+'</small>':'')+'</div><div class="hbS">'+(M.cm3>0?nb(M.cm3)+' cm³':'')+(M.mat?' · '+M.mat:'')+'</div></div>';
}
function hbEtatMaj(){
  const el=document.getElementById('hbEtat');if(!el)return;
  let mod=false;try{mod=typeof mffModified==='function'&&mffModified();}catch(e){}
  let n=0;try{n=(doc.features||[]).filter(f=>f&&!f.repeatId).length;}catch(e){}
  const k=mod+'|'+n;if(el.dataset.k===k)return;el.dataset.k=k;
  el.innerHTML='<span class="hbE">ESPACE CAO · PIÈCE</span><span class="hbC">'+n+' fonction'+(n>1?'s':'')+'</span><span class="hbC '+(mod?'mod':'ok')+'">● '+(mod?'modifiée':'enregistrée')+'</span>';
}
function hbSync(){
  try{
    hbCss();
    const vp=document.getElementById('vpwrap');if(!vp)return;
    if(!document.getElementById('hbMasse')){const m=document.createElement('div');m.id='hbMasse';vp.appendChild(m);}
    if(!document.getElementById('hbEtat')){const m=document.createElement('div');m.id='hbEtat';vp.appendChild(m);}
    if(!document.getElementById('hbHud')){const m=document.createElement('div');m.id='hbHud';m.innerHTML='<span class="hbK">SOUS LE CURSEUR</span><span class="hbT"></span>';document.body.appendChild(m);}
    hbSigMasse='';
    if(hbActif()){hbMasseMaj();hbEtatMaj();}
  }catch(e){}
}
/* ----- « sous le curseur » : la face survolée, nommée près de la souris ----- */
let hbHudT=0,hbHudXY=null,hbHudMem={k:'',I:null};
function hbHudCacher(){const h=document.getElementById('hbHud');if(h)h.classList.remove('on');}
function hbHudMaj(){
  hbHudT=0;
  const h=document.getElementById('hbHud'),P=hbHudXY;if(!h||!P)return;
  if(!hbActif()){hbHudCacher();return;}
  let hit=null;try{hit=pick({clientX:P.x,clientY:P.y});}catch(e){hit=null;}
  if(!hit||!hit.object||hit.faceIndex==null){hbHudCacher();return;}
  // même face que le coup d'avant : pas de nouvelle lecture du noyau
  let k='';try{const G=(hit.object.geometry.userData.occGroups||[]).find(g=>hit.faceIndex>=g.start&&hit.faceIndex<g.start+g.count);k=hit.object.geometry.uuid+'|'+(G?G.f:-1);}catch(e){}
  let I=null;
  if(k&&hbHudMem.k===k)I=hbHudMem.I;
  else{try{I=selFaceInfo(hit.object,hit.faceIndex);}catch(e){I=null;}hbHudMem={k,I};}
  if(!I||!I.n){hbHudCacher();return;}
  const t='Face '+I.n+(I.origine?' · '+I.origine:'');
  const T=h.querySelector('.hbT');if(T.textContent!==t)T.textContent=t;
  h.style.left=(P.x+52)+'px';h.style.top=(P.y-58)+'px';
  h.classList.add('on');
}
(function hbEcoute(){
  try{
    const vue=e=>{try{return typeof renderer!=='undefined'&&renderer&&e.target===renderer.domElement;}catch(err){return false;}};
    document.addEventListener('pointermove',e=>{
      if(!vue(e)||e.buttons){if(hbHudXY){hbHudXY=null;hbHudCacher();}return;}
      if(!hbActif())return;
      hbHudXY={x:e.clientX,y:e.clientY};
      if(!hbHudT)hbHudT=setTimeout(hbHudMaj,90);
    },{passive:true});
    document.addEventListener('pointerdown',()=>hbHudCacher(),true);
    document.addEventListener('wheel',()=>hbHudCacher(),{capture:true,passive:true});
    // jauge et état : relus chaque seconde, recalculés seulement quand la pièce a changé
    setInterval(()=>{if(hbActif()){hbMasseMaj();hbEtatMaj();}},1000);
  }catch(e){}
})();
// au démarrage : mfTheme est passé avant que MF_MAQUETTE (97-interface-themes-futur) existe
(function(){
  try{mfMaquetteSync();}catch(e){}
})();
