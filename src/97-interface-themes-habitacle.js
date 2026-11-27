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
   V1.1.13 (Fred, 27/11 : « les menus FAO, Assembler/Mise en plan ne sont pas traités comme le menu
   CAO », « Chaque partie doit avoir le même style partout ») : chaque espace a ses écrans, sa frise,
   sa jauge et son état — FAO : écran USINAGE incliné (posages, opérations), frise des opérations,
   jauge des parcours à jour ; assemblage : écran ASSEMBLAGE, frise des étapes, jauge des étapes
   rejouées ; PLAN : planches en rail, panneau des réglages incliné, jauge de la planche. Le
   gyroscope et la lecture sous le curseur valent dans les trois espaces en 3D ; esquisse et
   téléphone gardent la disposition habituelle. 🎨 › « Disposition de la maquette » la remet (mq-lay). */
function hbCss(){
  if(document.getElementById('hbCss'))return;
  const st=document.createElement('style');st.id='hbCss';
  const H='html body.ui-modern.mq-lay[data-theme="habitacle"]:not(.mf-mobile)';
  const C=H+'[data-ws="cao"]:not(.mf-sk):not([data-asm="1"])';
  const A=H+'[data-ws="cao"][data-asm="1"]:not(.mf-sk)'; // V1.1.13 : assemblage
  const F=H+'[data-ws="fao"]:not(.mf-sk)';                 // V1.1.13 : FAO
  const Q=H+'[data-ws="plan"]:not(.mf-sk)';                // V1.1.13 : PLAN
  const T3=[C,A,F];                                         // les espaces en 3D
  const X=(p,sel,decl)=>sel.split(',').map(s=>p+' '+s.trim()).join(',')+'{'+decl+'}';
  const MONO='font-family:"Cascadia Mono",Consolas,"JetBrains Mono",ui-monospace,monospace';
  const CY='#6ff3ff',OR='#ff8a3d';
  // l'écran incliné de gauche (CAO : HISTORIQUE, assemblage : ASSEMBLAGE)
  const ecran=(P,titre)=>[
    X(P,'#treeOverlay','transform:perspective(1100px) rotateY(16deg);max-height:calc(100% - 230px)!important;border-radius:18px!important;padding:16px 16px 14px!important;'+
      'background:linear-gradient(160deg,rgba(14,44,68,.8),rgba(5,16,28,.74))!important;border-color:rgba(111,243,255,.34)!important'),
    X(P,'#treeOverlay:hover,#treeOverlay:focus-within','transform:none'),
    X(P,'#treeOverlay .ovlTitle','font-size:0!important;margin:0 0 10px!important'),
    X(P,'#treeOverlay .ovlTitle::before','content:"'+titre+'";display:block;font-size:11px;letter-spacing:.2em;color:#8fdcef;'+MONO),
    X(P,'#treeOverlay .ovlTitle #docName','display:block;font-size:19px;font-weight:600;color:#fff;letter-spacing:.01em;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'),
    X(P,'#treeOverlay .ovlNote','display:none'),
    X(P,'#tree','border-left:1px solid rgba(111,243,255,.3);padding-left:8px'),
    X(P,'#tree .tnode','border-radius:8px;padding:4px 8px;border:1px solid transparent'),
    X(P,'#tree .tnode.sel','background:rgba(255,138,61,.14)!important;border-color:rgba(255,157,87,.55)'),
    X(P,'#tree .tgroup','color:#8fdcef!important;letter-spacing:.16em;text-transform:uppercase;font-size:10px;'+MONO)];
  // la frise : un rail, un point par étape (CAO : #mfTl des fonctions, assemblage : #asmTl des étapes)
  const frise=(P,T)=>{const Y=(sel,decl)=>X(P,sel.replace(/#mfTl/g,T),decl);return [
    Y('#mfTl','left:50%;right:auto;transform:translateX(-50%);width:min(820px,calc(100% - 560px));min-width:340px;box-sizing:border-box;bottom:22px;padding:6px 16px!important;border-radius:31px!important'),
    Y('#mfTl .tlbR','gap:22px;padding:10px 12px;background:linear-gradient(90deg,rgba(111,243,255,.2),'+CY+' 10%,'+CY+' 90%,rgba(111,243,255,.15)) 0 50%/100% 2px no-repeat local'),
    Y('#mfTl .tlbS','min-width:16px;width:16px;height:16px;padding:0!important;font-size:0;border-radius:50%!important;border:2px solid '+CY+'!important;background:#06121e!important;box-shadow:0 0 8px rgba(111,243,255,.45)!important;color:transparent!important'),
    Y('#mfTl .tlbS>span:first-child','display:none'),
    Y('#mfTl .tlbS.sk','min-width:11px;width:11px;height:11px;border-width:1.5px!important;opacity:.85'),
    Y('#mfTl .tlbS:hover','transform:scale(1.35)'),
    Y('#mfTl .tlbS.sel','min-width:22px;width:22px;height:22px;background:'+OR+'!important;border-color:#ffb27d!important;box-shadow:0 0 16px '+OR+'!important'),
    Y('#mfTl .tlbS.warn','border-color:#ff453a!important;box-shadow:0 0 10px #ff453a!important'),
    Y('#mfTl .tlbM','width:3px;height:26px;margin:0 -8px;background:'+OR+';box-shadow:0 0 10px '+OR),
    Y('#mfTl .tlbM::before','border-top-color:'+OR),
    Y('#mfTl .tlbN','color:#8fdcef;'+MONO)];};
  st.textContent=[
    '#hbMasse,#hbHud,#hbEtat,#hbRail{display:none}',
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
    /* ═══ écrans inclinés : HISTORIQUE (CAO), ASSEMBLAGE, USINAGE (FAO) à gauche — RÉGLAGES à droite ═══ */
    ...ecran(C,'HISTORIQUE'),...ecran(A,'ASSEMBLAGE'),
    X(F,'#faoTreeWrap .fao-cnt','transform:perspective(1100px) rotateY(16deg);max-height:calc(100vh - 360px)!important;border-radius:18px!important;padding:16px 16px 14px!important;'+
      'background:linear-gradient(160deg,rgba(14,44,68,.8),rgba(5,16,28,.74))!important;border-color:rgba(111,243,255,.34)!important;transition:transform .25s'),
    X(F,'#faoTreeWrap .fao-cnt:hover,#faoTreeWrap .fao-cnt:focus-within','transform:none'),
    X(F,'#faoTreeWrap .fao-title','display:block!important;font-size:0!important;margin:0 0 10px!important;padding:0!important;border:none!important'),
    X(F,'#faoTreeWrap .fao-title::before','content:"USINAGE";display:block;font-size:11px;letter-spacing:.2em;color:#8fdcef;'+MONO),
    X(F,'#faoTreeWrap .fao-title::after','content:attr(data-hb);display:block;font-size:19px;font-weight:600;color:#fff;letter-spacing:.01em;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'),
    X(F,'#faoTree','border-left:1px solid rgba(111,243,255,.3);padding-left:8px'),
    X(F,'#faoTree>div','border-radius:8px;border:1px solid transparent'),
    X(F,'#faoTree>div.sel','background:rgba(255,138,61,.14)!important;border-color:rgba(255,157,87,.55)'),
    X(F,'#faoTree .fao-setup','color:#8fdcef!important;letter-spacing:.06em;font-size:11px;'+MONO),
    X(F,'#faoToggle','background:rgba(6,22,38,.9)!important;border-color:rgba(111,243,255,.34)!important;color:#8fdcef!important'),
    X(F,'#mfPosTabs button','border-radius:999px!important;border-color:rgba(111,243,255,.3)!important;background:rgba(111,243,255,.05)!important;color:#bdf6ff!important;font-size:11px;'+MONO),
    X(F,'#mfPosTabs button.on','background:rgba(255,138,61,.22)!important;border-color:#ffb27d!important;color:#fff!important'),
    ...T3.flatMap(P=>[
      X(P,'#propsWrap>.right>.panel','transform:perspective(1100px) rotateY(-14deg);border-radius:18px!important;border-color:rgba(255,157,87,.45)!important;'+
        'background:linear-gradient(200deg,rgba(40,26,20,.76),rgba(6,16,28,.82))!important;box-shadow:0 0 30px rgba(255,138,61,.12),0 20px 50px rgba(0,0,0,.5)!important'),
      X(P,'#propsWrap>.right>.panel:hover,#propsWrap>.right>.panel:focus-within','transform:none'),
      X(P,'#propsWrap>.right>.panel .panel-title','color:#ffb27d!important;letter-spacing:.2em;text-transform:uppercase;font-size:11px;'+MONO)]),
    // PLAN : le panneau des réglages de la planche, même écran incliné
    X(Q,'#mepSidePanel','transform:perspective(1100px) rotateY(-14deg);border-radius:18px!important;border:1px solid rgba(255,157,87,.45)!important;'+
      'background:linear-gradient(200deg,rgba(40,26,20,.9),rgba(6,16,28,.92))!important;box-shadow:0 0 30px rgba(255,138,61,.12),0 20px 50px rgba(0,0,0,.5)!important;transition:transform .25s'),
    X(Q,'#mepSidePanel:hover,#mepSidePanel:focus-within','transform:none'),
    X(Q,'#mepSidePanel .panel-title','color:#ffb27d!important;letter-spacing:.2em;text-transform:uppercase;font-size:11px;'+MONO),
    /* ═══ la frise : un rail, un point par étape — fonctions (CAO), étapes (assemblage), opérations (FAO), planches (PLAN) ═══ */
    ...frise(C,'#mfTl'),...frise(A,'#asmTl'),
    X(A,'#asmTl .tlbS small,#asmTl .tlbK','display:none'),
    X(F,'#hbRail','display:flex;position:absolute;left:50%;transform:translateX(-50%);bottom:22px;z-index:22;max-width:min(820px,calc(100% - 560px));min-width:240px;box-sizing:border-box;'+
      'align-items:center;gap:10px;padding:6px 16px;border-radius:31px;border:1px solid rgba(111,243,255,.3);background:rgba(6,20,34,.78);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 0 24px rgba(34,211,238,.12)'),
    '#hbRail .hbL{display:flex;align-items:center;gap:22px;min-width:0;overflow-x:auto;scrollbar-width:none;padding:10px 12px;background:linear-gradient(90deg,rgba(111,243,255,.2),'+CY+' 10%,'+CY+' 90%,rgba(111,243,255,.15)) 0 50%/100% 2px no-repeat local}',
    '#hbRail .hbL::-webkit-scrollbar{display:none}',
    '#hbRail .hbP{flex:none;width:16px;height:16px;padding:0;border-radius:50%;border:2px solid '+CY+';background:#06121e;box-shadow:0 0 8px rgba(111,243,255,.45);cursor:pointer;transition:transform .15s}',
    '#hbRail .hbP:hover{transform:scale(1.35)}',
    '#hbRail .hbP.sel{width:22px;height:22px;background:'+OR+';border-color:#ffb27d;box-shadow:0 0 16px '+OR+'}',
    '#hbRail .hbP.off{opacity:.4;border-style:dashed}',
    '#hbRail .hbP.st{border-color:#ffb27d}',
    '#hbRail .hbS{flex:none;padding:3px 9px;border-radius:999px;border:1px solid rgba(111,243,255,.3);background:#06121e;color:#8fdcef;font-size:10.5px;letter-spacing:.12em;cursor:pointer;'+MONO+'}',
    '#hbRail .hbS.sel{border-color:#ffb27d;color:#ffcfa8}',
    '#hbRail .hbN{flex:none;color:#8fdcef;font-size:11px;white-space:nowrap;'+MONO+'}',
    X(Q,'#mepTabs','gap:12px;padding:8px 16px;background:linear-gradient(90deg,transparent,rgba(111,243,255,.55) 6%,rgba(111,243,255,.55) 94%,transparent) 0 50%/100% 1px no-repeat,rgba(6,20,34,.82)!important;border-bottom:1px solid rgba(111,243,255,.2)'),
    X(Q,'#mepTabs button','height:26px;padding:0 12px;border-radius:999px!important;border:1.5px solid '+CY+'!important;background:#06121e!important;color:#bdf6ff!important;font-size:11px;box-shadow:0 0 8px rgba(111,243,255,.35);'+MONO),
    X(Q,'#mepTabs button:hover','box-shadow:0 0 16px rgba(111,243,255,.6)'),
    X(Q,'#mepTabs button.on','background:rgba(255,138,61,.3)!important;border-color:#ffb27d!important;color:#fff!important;box-shadow:0 0 16px '+OR+'!important'),
    X(Q,'#mepTabs .mepAdd','width:26px;padding:0!important;border-style:solid!important'),
    X(Q,'#mepTabs>span','color:#8fdcef!important;'+MONO),
    /* ═══ le gyroscope : le cube de vue ceint de ses anneaux (les trois espaces en 3D) ═══ */
    ...T3.flatMap(P=>{const Y=(sel,decl)=>X(P,sel,decl);return [
    Y('#mfVpInfo','bottom:178px!important;right:24px;left:auto!important;max-width:min(520px,calc(100% - 600px));overflow:hidden;text-overflow:ellipsis'),
    Y('#mfCube','top:auto!important;bottom:16px;right:22px!important;width:136px;height:136px;border-radius:50%;background:radial-gradient(circle,rgba(5,18,30,.62) 64%,transparent 65%);border:1px solid rgba(111,243,255,.22)'),
    Y('#mfCube canvas','position:absolute;left:23px;top:23px;width:90px!important;height:90px!important'),
    Y('#mfCube::before','content:"";position:absolute;inset:10px;border-radius:50%;border:2px solid rgba(255,143,128,.75);transform:rotateX(68deg);pointer-events:none'),
    Y('#mfCube::after','content:"";position:absolute;inset:10px;border-radius:50%;border:2px solid rgba(125,255,168,.7);transform:rotate(35deg) rotateY(68deg);pointer-events:none'),
    Y('#mfCubeHome','top:6px;left:6px'),
    Y('#mfOrbit','top:28px;left:0'),
    Y('#viewbar,#setMenu','right:calc(22px + var(--mfPropsW,0px))!important'),
    Y('#hbHud.on','display:block')];}),
    /* ═══ la jauge de masse, l'état, la lecture sous le curseur ═══ */
    X(C,'#hbMasse','display:flex;position:absolute;left:26px;bottom:20px;z-index:23;align-items:center;gap:14px;pointer-events:none;'+MONO),
    X(A,'#hbMasse','display:flex;position:absolute;left:26px;bottom:20px;z-index:23;align-items:center;gap:14px;pointer-events:none;'+MONO),
    X(F,'#hbMasse','display:flex;position:absolute;left:26px;bottom:20px;z-index:23;align-items:center;gap:14px;pointer-events:none;'+MONO),
    X(Q,'#hbMasse','display:flex;position:absolute;left:26px;bottom:40px;z-index:55;align-items:center;gap:14px;pointer-events:none;padding:8px 14px 8px 8px;border-radius:18px;background:rgba(6,20,34,.86);border:1px solid rgba(111,243,255,.25);'+MONO),
    '#hbMasse svg{flex:none;filter:drop-shadow(0 0 6px rgba(111,243,255,.45))}',
    '#hbMasse .hbK{font-size:10.5px;letter-spacing:.2em;color:#7fb4c9}',
    '#hbMasse .hbV{font-size:25px;color:#fff;line-height:1.1}#hbMasse .hbV small{font-size:13px;color:#8fdcef;margin-left:4px}',
    '#hbMasse .hbS{font-size:11.5px;color:#7fa3b8}',
    ...T3.map(P=>X(P,'#hbEtat','display:flex;position:absolute;left:212px;top:10px;z-index:23;gap:10px;align-items:center;pointer-events:none;font-size:11.5px;'+MONO)),
    X(Q,'#hbEtat','display:flex;position:absolute;left:24px;top:56px;z-index:55;padding:5px 8px 5px 12px;border-radius:999px;background:rgba(6,20,34,.86);border:1px solid rgba(111,243,255,.25);gap:10px;align-items:center;pointer-events:none;font-size:11.5px;'+MONO),
    '#hbEtat .hbE{letter-spacing:.16em;color:#5f8aa3;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#hbEtat .hbC{padding:4px 10px;border-radius:999px;border:1px solid rgba(111,243,255,.25);color:#8fdcef;background:rgba(5,16,28,.55)}',
    '#hbEtat .hbC.ok{border-color:rgba(125,255,168,.4);color:#9dffbe}#hbEtat .hbC.mod{border-color:rgba(255,178,125,.55);color:#ffcfa8}',
    '#hbHud{position:fixed;z-index:5000;pointer-events:none;padding:2px 0 2px 10px;border-left:2px solid #ff9d57;'+MONO+';text-shadow:0 0 6px rgba(0,0,0,.9)}',
    '#hbHud .hbK{display:block;font-size:10.5px;letter-spacing:.16em;color:#ffb27d}',
    '#hbHud .hbT{display:block;font-size:13px;color:#ffe2cc;white-space:nowrap}',
    '#hbHud::before{content:"";position:absolute;left:-44px;bottom:-30px;width:56px;height:1.2px;background:#ff9d57;transform:rotate(-38deg);transform-origin:100% 50%}',
    '#hbHud::after{content:"";position:absolute;left:-49px;bottom:-37px;width:6px;height:6px;border-radius:50%;background:#ff9d57;box-shadow:0 0 8px #ff9d57}'
  ].join('\n');
  document.head.appendChild(st);
}
// V1.1.13 : la disposition est en place, quel que soit l'espace (hors esquisse et téléphone)
function hbOn(){
  try{
    const b=document.body;
    return b.classList.contains('mq-lay')&&b.classList.contains('ui-modern')&&!b.classList.contains('mf-mobile')&&b.getAttribute('data-theme')==='habitacle'&&
      !b.classList.contains('mf-sk');
  }catch(e){return false;}
}
function hbActif(){return hbOn()&&mfEspace()==='cao';}
// les trois espaces en 3D : gyroscope, lecture sous le curseur
function hbActif3D(){const e=mfEspace();return hbOn()&&(e==='cao'||e==='asm'||e==='fao');}
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
  const nb=x=>String(+(+x).toFixed(1)).replace('.',',');
  let ms='—';try{ms=M.g>0?fmtMasse(M.g):'—';}catch(e){}
  const mv=ms.split(' ');
  hbSigJauge='';
  hbJaugeRendu(el,{k:'MASSE',v:mv[0]||'—',u:mv[1]||'',s:(M.cm3>0?nb(M.cm3)+' cm³':'')+(M.mat?' · '+M.mat:''),rempli:M.rempli,
    t:'Masse des corps affichés'+(M.alu?' (aluminium quand le corps n’a pas de matière)':'')+'\nAnneau : remplissage de la boîte englobante, '+Math.round(M.rempli*100)+' %'});
}
// La jauge : un anneau (0..1) et sa lecture — J = {k, v, u, s, rempli, t}
function hbJaugeRendu(el,J){
  const r=31,c=2*Math.PI*r,p=Math.max(0,Math.min(1,+J.rempli||0)),arc=(p*c).toFixed(1);
  const esc=x=>String(x==null?'':x).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[ch]);
  el.title=J.t||'';
  el.innerHTML='<svg width="74" height="74" viewBox="0 0 74 74" aria-hidden="true"><circle cx="37" cy="37" r="31" fill="none" stroke="rgba(111,243,255,.18)" stroke-width="5"/>'+
    '<circle cx="37" cy="37" r="31" fill="none" stroke="#6ff3ff" stroke-width="5" stroke-linecap="round" stroke-dasharray="'+arc+' '+c.toFixed(1)+'" transform="rotate(-90 37 37)"/>'+
    '<text x="37" y="41" text-anchor="middle" font-size="12" fill="#bdf6ff">'+Math.round(p*100)+'%</text></svg>'+
    '<div><div class="hbK">'+esc(J.k)+'</div><div class="hbV">'+esc(J.v||'—')+(J.u?'<small>'+esc(J.u)+'</small>':'')+'</div><div class="hbS">'+esc(J.s)+'</div></div>';
}
/* V1.1.13 : la jauge des autres espaces. Purs sur leurs entrées. */
// FAO : opérations, posages, outils ; anneau = parcours à jour parmi les opérations actives
function hbUsinage(root){
  let n=0,act=0,ok=0;const T=new Set(),S=(root&&root.setups)||[];
  S.forEach(s=>(s.ops||[]).forEach(op=>{n++;if(op.toolId!=null)T.add(s.id+':'+op.toolId);if(op.on===false)return;act++;if(op.stale!==true)ok++;}));
  return {n,actives:act,aJour:ok,posages:S.length,outils:T.size,rempli:act?ok/act:0};
}
// Assemblage : pièces, étapes, relations, liaisons ; anneau = étapes rejouées (la pousse / le marqueur)
function hbAssemblage(nOcc,H,ptr){
  const L=H||[],n=L.length,p=ptr==null?n:Math.max(0,Math.min(n,ptr));
  return {pieces:nOcc|0,etapes:n,relations:L.filter(s=>s&&s.k==='rel').length,liaisons:L.filter(s=>s&&s.k==='join').length,rempli:n?p/n:0};
}
const hbPl=(n,u)=>n+' '+u+(n>1?'s':'');
let hbSigJauge='';
function hbJaugeMaj(){
  const e=mfEspace();
  if(e==='cao'){hbMasseMaj();return;}
  const el=document.getElementById('hbMasse');if(!el)return;
  let J=null;
  try{
    if(e==='fao'){const U=hbUsinage(faoRoot());
      J={k:'USINAGE',v:String(U.n),u:U.n>1?'opérations':'opération',s:hbPl(U.posages,'posage')+' · '+hbPl(U.outils,'outil'),rempli:U.rempli,
        t:'Opérations de tous les posages\nAnneau : parcours à jour, '+U.aJour+' sur '+U.actives+' opération(s) active(s)'};}
    else if(e==='asm'){const c=asmActiveComp(),H=c?asmHistOf(c):[],M=hbAssemblage(c&&c.occ?c.occ.length:0,H,asmHistPtr());
      J={k:'ASSEMBLAGE',v:String(M.pieces),u:M.pieces>1?'pièces':'pièce',s:hbPl(M.etapes,'étape')+' · '+hbPl(M.relations,'relation')+(M.liaisons?' · '+hbPl(M.liaisons,'liaison'):''),rempli:M.rempli,
        t:'Pièces placées dans « '+(c?c.name:'')+' »\nAnneau : étapes rejouées (glisser la pousse de la frise)'};}
    else if(e==='plan'){const m=doc.mep||{},L=m.sheets||[],cur=+m.cur||0,sh=L[cur]||{};
      J={k:'PLANCHE',v:(cur+1)+'/'+L.length,u:'',s:(sh.format||'')+(sh.orient?' '+(sh.orient==='landscape'?'paysage':'portrait'):'')+' · '+hbPl((sh.views||[]).length,'vue')+' · '+hbPl((sh.dims||[]).length,'cote'),
        rempli:L.length?(cur+1)/L.length:0,t:'Planche affichée, ses vues et ses cotes\nAnneau : rang de la planche'};}
  }catch(err){J=null;}
  if(!J)return;
  const sig=e+'|'+JSON.stringify(J);if(sig===hbSigJauge)return;hbSigJauge=sig;hbSigMasse='';
  hbJaugeRendu(el,J);
}
function hbEtatMaj(){
  const el=document.getElementById('hbEtat');if(!el)return;
  let mod=false;try{mod=typeof mffModified==='function'&&mffModified();}catch(e){}
  // V1.1.13 : l'espace où l'on est, et ce qu'il compte
  const e=mfEspace();let tete='ESPACE CAO · PIÈCE',n=0,u='fonction';
  try{
    if(e==='fao'){n=hbUsinage(faoRoot()).n;u='opération';tete='ESPACE FAO · USINAGE';}
    else if(e==='asm'){const c=asmActiveComp();n=c?asmHistOf(c).length:0;u='étape';tete='ASSEMBLAGE · '+String(c&&c.name||'').toUpperCase();}
    else if(e==='plan'){n=((doc.mep||{}).sheets||[]).length;u='planche';tete='ESPACE PLAN · MISE EN PLAN';}
    else n=(doc.features||[]).filter(f=>f&&!f.repeatId).length;
  }catch(err){}
  const k=e+'|'+mod+'|'+n+'|'+tete;if(el.dataset.k===k)return;el.dataset.k=k;
  el.innerHTML='';
  const sp=(cls,t)=>{const x=document.createElement('span');x.className=cls;x.textContent=t;el.appendChild(x);};
  sp('hbE',tete);sp('hbC',hbPl(n,u));sp('hbC '+(mod?'mod':'ok'),'● '+(mod?'modifiée':'enregistrée'));
}
/* ----- V1.1.13 : FAO — le titre de l'écran USINAGE et la frise des opérations (88 faoRenderTree → mfFaoArbreSync) ----- */
function hbFaoHabille(tree){
  if(!hbOn())return;
  let R=null;try{R=faoRoot();}catch(e){return;}
  const cnt=tree&&tree.parentNode,T=cnt&&cnt.querySelector('.fao-title');
  let cs=null;try{cs=R.setups.find(s=>typeof sel!=='undefined'&&sel&&((sel.kind==='faoSetup'&&sel.id===s.id)||(sel.kind==='faoOp'&&(s.ops||[]).some(o=>o.id===sel.id))));}catch(e){}
  if(!cs){const on=document.querySelector('#mfPosTabs button.on');cs=(R.setups||[]).find(s=>on&&s.name===on.textContent)||(R.setups||[])[0]||null;}
  if(T)T.dataset.hb=cs?cs.name:'Posages';
  hbRailMaj(R);
}
function hbRailMaj(R){
  const vp=document.getElementById('vpwrap');if(!vp)return;
  let el=document.getElementById('hbRail');
  if(!el){el=document.createElement('div');el.id='hbRail';el.setAttribute('role','toolbar');el.setAttribute('aria-label','Frise des opérations');
    ['pointerdown','mousedown','dblclick','contextmenu'].forEach(t=>el.addEventListener(t,e=>{try{e.stopPropagation();}catch(_){}}));
    el.addEventListener('wheel',e=>{try{e.stopPropagation();const L=el.querySelector('.hbL');if(L&&Math.abs(e.deltaY)>Math.abs(e.deltaX)){L.scrollLeft+=e.deltaY;e.preventDefault();}}catch(_){}},{passive:false});
    vp.appendChild(el);}
  const L=document.createElement('div');L.className='hbL';
  const est=(k,id)=>{try{return typeof sel!=='undefined'&&sel&&sel.kind===k&&sel.id===id;}catch(e){return false;}};
  let n=0;
  // V1.1.13 : une puce par posage (pour en changer), les points des opérations du posage choisi seulement
  const vus=new Set(mfPosagesVus(R).map(s=>s.id));
  ((R&&R.setups)||[]).forEach(s=>{
    const b=document.createElement('button');b.type='button';b.className='hbS'+(est('faoSetup',s.id)?' sel':'')+(vus.has(s.id)?' vu':'');b.textContent=s.name;b.title='Posage « '+s.name+' » : sa fiche';
    b.onclick=()=>{try{faoSelectSetup(s.id);}catch(e){}};L.appendChild(b);
    if(!vus.has(s.id))return;
    (s.ops||[]).forEach((op,i)=>{n++;
      const p=document.createElement('button');p.type='button';
      p.className='hbP'+(est('faoOp',op.id)?' sel':'')+(op.on===false?' off':'')+(op.stale===true?' st':'');
      let nm='';try{nm=faoOpShortLabel(op);}catch(e){nm=op.type||'';}
      p.title=(i+1)+'. '+nm+(op.on===false?' — désactivée':'')+(op.stale===true?' — parcours à régénérer':'');
      p.setAttribute('aria-label',p.title);
      p.onclick=()=>{try{faoSelectOp(s.id,op.id);}catch(e){}};L.appendChild(p);
    });
  });
  const N=document.createElement('span');N.className='hbN';N.textContent=hbPl(n,'opération');
  el.innerHTML='';el.appendChild(L);el.appendChild(N);
}
function hbSync(){
  try{
    hbCss();
    const vp=document.getElementById('vpwrap');if(!vp)return;
    if(!document.getElementById('hbMasse')){const m=document.createElement('div');m.id='hbMasse';vp.appendChild(m);}
    if(!document.getElementById('hbEtat')){const m=document.createElement('div');m.id='hbEtat';vp.appendChild(m);}
    if(!document.getElementById('hbHud')){const m=document.createElement('div');m.id='hbHud';m.innerHTML='<span class="hbK">SOUS LE CURSEUR</span><span class="hbT"></span>';document.body.appendChild(m);}
    hbSigMasse='';hbSigJauge='';
    if(hbOn()){hbJaugeMaj();hbEtatMaj();}
  }catch(e){}
}
/* ----- « sous le curseur » : la face survolée, nommée près de la souris ----- */
let hbHudT=0,hbHudXY=null,hbHudMem={k:'',I:null};
function hbHudCacher(){const h=document.getElementById('hbHud');if(h)h.classList.remove('on');}
function hbHudMaj(){
  hbHudT=0;
  const h=document.getElementById('hbHud'),P=hbHudXY;if(!h||!P)return;
  if(!hbActif3D()){hbHudCacher();return;}
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
      if(!hbActif3D())return;
      hbHudXY={x:e.clientX,y:e.clientY};
      if(!hbHudT)hbHudT=setTimeout(hbHudMaj,90);
    },{passive:true});
    document.addEventListener('pointerdown',()=>hbHudCacher(),true);
    document.addEventListener('wheel',()=>hbHudCacher(),{capture:true,passive:true});
    // jauge et état : relus chaque seconde, recalculés seulement quand la pièce a changé
    setInterval(()=>{if(hbOn()){hbJaugeMaj();hbEtatMaj();}},1000);
  }catch(e){}
})();
// au démarrage : mfTheme est passé avant que MF_MAQUETTE (97-interface-themes-futur) existe
(function(){
  try{mfMaquetteSync();}catch(e){}
})();
