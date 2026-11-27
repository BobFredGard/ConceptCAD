/* ---------- Interfaces du futur : quatre thèmes de plus (V1.1.6) ----------
   Fred, 27/11, devant le canevas des quatre pistes d'interface (Habitacle, Table holographique,
   Plan vivant, Goutte) : « Je trouve les idées géniales, on pourrait toutes les proposer en plus
   des thèmes existants ». Elles s'ajoutent donc aux cinq thèmes du menu 🎨 (MF_THEMES, 97) :
     • Habitacle           : poste de pilotage — bleu nuit, traits cyan lumineux, panneaux latéraux
                             inclinés comme des écrans de cockpit (ils se redressent au survol),
                             coins de visée sur la vue.
     • Table holographique : table lumineuse — noir profond, sarcelle et ambre, anneau de lumière
                             sous la pièce, fines lignes de balayage.
     • Plan vivant         : bleu d'architecte — papier quadrillé, cadre de planche, traits blancs,
                             boutons en pochoir (inversés quand ils sont choisis), angles vifs.
     • Goutte              : surfaces douces — tons chauds, panneaux et menus en galets de verre,
                             menus contextuels en gouttes qui ondulent doucement.
   Comme les autres thèmes, RIEN n'est déplacé ni retiré : des règles CSS sous
   body[data-theme="…"], le fond et le sol de la vue 3D (MF_3D, 97), la teinte des arêtes de la
   pièce (mfEdgeCols, lue par buildEdgeOverlay de 20-50) et un voile décoratif sur la vue
   (#vpwrap::after, qui ne prend jamais la souris). Polices du système seulement (fichier
   autonome hors ligne) : Bahnschrift sous Windows, repli sur les polices habituelles ailleurs.
   Aucune animation sans fin au repos (la vue en veille ne doit pas faire souffler la carte
   graphique) : seules les gouttes ouvertes ondulent, et rien si l'ordinateur demande moins de
   mouvement. */
const MF_FUTUR=['habitacle','holo','planvivant','goutte'];
function mfIsFutur(t){return MF_FUTUR.indexOf(t)>=0;}
/* V1.1.10 : « Disposition de la maquette » — Fred, 27/11 : « J'aimerais vraiment que tu te rapproches
   de tes 4 façons proposées ». Une interface du futur peut DÉPLACER les choses comme sur sa maquette
   (classe mq-lay sur body, règles du fichier de l'interface) ; 🎨 › « Disposition de la maquette » la
   coupe (localStorage minifusion_maquette_<thème>). La Goutte suit sa bulle (gt-lay, 97-…-goutte). */
const MF_MAQUETTE=['habitacle'];
function mfMaquetteOn(t){try{return MF_MAQUETTE.indexOf(t)>=0&&mfLS('minifusion_maquette_'+t)!=='0';}catch(e){return false;}}
function mfMaquetteSync(refaire){
  try{
    const t=document.body.getAttribute('data-theme')||'nuit';
    document.body.classList.toggle('mq-lay',mfMaquetteOn(t));
    if(t==='habitacle'&&typeof hbSync==='function')hbSync();
    if(refaire&&typeof renderTimeline==='function')renderTimeline();
  }catch(e){}
}
function mfMaquetteSet(t,on){try{mfLS('minifusion_maquette_'+t,on?'1':'0');}catch(e){}mfMaquetteSync(true);}
// arêtes de la pièce [vives, tangentes] en RVB 0..1 — teintes foncées et saturées, lisibles sur
// les pièces claires comme sur les sombres ; null = couleurs d'origine (noir / gris doux)
function mfEdgeCols(){
  let t='nuit';try{t=document.body.getAttribute('data-theme')||'nuit';}catch(e){}
  switch(t){
    case 'habitacle':return [[0.0,0.33,0.47],[0.36,0.62,0.74]];
    case 'holo':return [[0.0,0.34,0.29],[0.33,0.64,0.58]];
    case 'planvivant':return [[0.04,0.15,0.31],[0.45,0.58,0.76]];
    case 'goutte':return [[0.27,0.15,0.1],[0.62,0.55,0.5]];
  }
  return null;
}
let mfEdgeKey='';
function mfEdgeSync(){
  // couleur des arêtes : l'aperçu n'est reconstruit que si la teinte change vraiment
  let k='';try{k=JSON.stringify(mfEdgeCols());}catch(e){}
  if(k===mfEdgeKey)return;
  const first=!mfEdgeKey;mfEdgeKey=k;
  if(first&&k==='null')return;
  try{if(typeof scene!=='undefined'&&scene&&scene.getObjectByName&&scene.getObjectByName('edgeOverlay')&&typeof buildEdgeOverlay==='function')buildEdgeOverlay();}catch(e){}
  try{if(typeof viewWake==='function')viewWake();}catch(e){}
}
function mfFuturCss(){
  if(document.getElementById('mfFuturCss'))return;
  const st=document.createElement('style');st.id='mfFuturCss';
  // B('t', 'sel1,sel2', 'déclarations') → body[data-theme="t"] sel1,body[data-theme="t"] sel2{…}
  // (préfixe html : passe devant les règles communes de mfCss, quel que soit l'ordre des feuilles)
  const B=(t,sel,decl)=>sel.split(',').map(s=>'html body[data-theme="'+t+'"]'+(s.trim()?' '+s.trim():'')).join(',')+'{'+decl+'}';
  // panneaux posés sur la vue et autour (mêmes cibles que le thème Clair)
  const P='#treeOverlay,#treeToggle,#propsToggle,#propsWrap>.right>.panel,#viewbar,#setMenu,#skSetMenu,#faoTreeWrap .fao-cnt,#faoToggle,#faoAddBar,#faoViewerBar,#mfBrTabs,#mfTl';
  // menus qui s'ouvrent (ruban, clic droit, choix)
  const M='.mfPop,.ddMenu,#ctxMenu,#ctxMenu3D,#skCtxMenu,#ctxPiece,.fao-ctx';
  const BTN='.mfRb,.mfWs button,#mfBrTabs button,#viewbar button,.mfQuick button,#mfThemeBtn,#mfTl button,#mfTl .tlbS';
  const R=[];
  /* ═══ Habitacle : poste de pilotage ═══ */
  const H='habitacle';
  R.push(
    B(H,'','--bg:#060b14;--surface:rgba(8,18,32,.86);--primary:#0a87a8;--glow:rgba(34,211,238,.22);--accent:#ff9d42;--warn:#ffd60a;--text:#e3f6ff;--muted:#7ea2b6;--border:rgba(111,243,255,.2);--radius:6px;--topbar:#050a12;--fx:#6ff3ff;font-family:Bahnschrift,"DIN Alternate","Segoe UI",system-ui,sans-serif'),
    B(H,'','background:radial-gradient(1200px 520px at 50% -12%,rgba(34,211,238,.2),transparent),radial-gradient(900px 600px at 50% 120%,rgba(10,60,110,.35),transparent),#060b14'),
    B(H,'.topbar','background:linear-gradient(180deg,#0b1a31,#050a12)!important;border-bottom:1px solid rgba(111,243,255,.55)!important;box-shadow:0 8px 26px rgba(34,211,238,.16)'),
    B(H,'.topbar .brand','text-shadow:0 0 14px rgba(111,243,255,.55);letter-spacing:.04em'),
    B(H,'.mfWs','background:rgba(111,243,255,.06);border:1px solid rgba(111,243,255,.22)'),
    B(H,'.mfWs button','letter-spacing:.14em;color:#8fb9cc'),
    B(H,'.mfWs button.on','background:rgba(111,243,255,.12);color:var(--fx);box-shadow:inset 0 -2px 0 var(--fx);text-shadow:0 0 10px rgba(111,243,255,.8)'),
    B(H,'#mfRibbon','background:linear-gradient(180deg,rgba(10,24,42,.9),rgba(6,14,26,.9));border-color:rgba(111,243,255,.24);box-shadow:0 0 22px rgba(34,211,238,.1),inset 0 1px 0 rgba(111,243,255,.14)'),
    B(H,'.mfGrp','border-right-color:rgba(111,243,255,.14)'),
    B(H,'.mfGrpT','color:#5f8ea4;letter-spacing:.16em'),
    B(H,'.mfRb:hover i,.mfQuick button:hover','color:var(--fx);filter:drop-shadow(0 0 6px rgba(111,243,255,.75))'),
    B(H,'.mfRb:hover','background:rgba(111,243,255,.08);border-color:rgba(111,243,255,.25)'),
    B(H,P,'background:linear-gradient(180deg,rgba(9,22,40,.84),rgba(5,12,24,.86))!important;border:1px solid rgba(111,243,255,.28)!important;border-radius:6px!important;box-shadow:0 0 22px rgba(34,211,238,.13),inset 0 1px 0 rgba(111,243,255,.16)!important;color:var(--text)'),
    B(H,'#mfBrTabs button.on,#viewbar button.on','background:rgba(111,243,255,.16)!important;color:var(--fx)!important;box-shadow:inset 0 0 0 1px rgba(111,243,255,.55),0 0 10px rgba(111,243,255,.35)'),
    // écrans latéraux inclinés, redressés dès que la souris y va (ou qu'on y tape)
    B(H,'#treeOverlay','transform:perspective(1100px) rotateY(9deg);transform-origin:0 50%;transition:transform .35s ease'),
    B(H,'#treeOverlay:hover,#treeOverlay:focus-within','transform:none'),
    B(H,'#propsWrap>.right>.panel','transform:perspective(1100px) rotateY(-7deg);transform-origin:100% 50%;transition:transform .35s ease'),
    B(H,'#propsWrap>.right>.panel:hover,#propsWrap>.right>.panel:focus-within','transform:none'),
    B(H,'.ovlTitle,.panel-title','color:var(--fx)!important;letter-spacing:.06em'),
    B(H,'#mfTl .tlbS','border-radius:999px'),
    B(H,'#mfTl .tlbS.sel','box-shadow:0 0 12px rgba(111,243,255,.6)'),
    B(H,M,'background:rgba(6,14,26,.97)!important;border:1px solid rgba(111,243,255,.32)!important;border-radius:6px!important;box-shadow:0 0 26px rgba(34,211,238,.18),0 14px 36px rgba(0,0,0,.55)!important'),
    B(H,'#vpwrap','border:1px solid rgba(111,243,255,.22);box-shadow:0 0 30px rgba(34,211,238,.1)'),
    // coins de visée + lueur du bord haut, sur la vue (jamais cliquables)
    B(H,'#vpwrap::after','content:"";position:absolute;inset:8% 10% 12% 26%;pointer-events:none;z-index:1;opacity:.55;'+
      'background:linear-gradient(#6ff3ff,#6ff3ff) 0 0/34px 2px no-repeat,linear-gradient(#6ff3ff,#6ff3ff) 0 0/2px 34px no-repeat,'+
      'linear-gradient(#6ff3ff,#6ff3ff) 100% 0/34px 2px no-repeat,linear-gradient(#6ff3ff,#6ff3ff) 100% 0/2px 34px no-repeat,'+
      'linear-gradient(#6ff3ff,#6ff3ff) 0 100%/34px 2px no-repeat,linear-gradient(#6ff3ff,#6ff3ff) 0 100%/2px 34px no-repeat,'+
      'linear-gradient(#6ff3ff,#6ff3ff) 100% 100%/34px 2px no-repeat,linear-gradient(#6ff3ff,#6ff3ff) 100% 100%/2px 34px no-repeat,'+
      'linear-gradient(#6ff3ff,#6ff3ff) 50% 50%/14px 1px no-repeat,linear-gradient(#6ff3ff,#6ff3ff) 50% 50%/1px 14px no-repeat'),
    B(H,'#vpwrap::before','content:"";position:absolute;inset:0;pointer-events:none;z-index:1;background:radial-gradient(60% 12% at 50% 0%,rgba(111,243,255,.14),transparent)'),
    B(H,'#mfCube','filter:drop-shadow(0 0 8px rgba(111,243,255,.45))')
  );
  /* ═══ Table holographique : la pièce posée sur une table de lumière ═══ */
  const T='holo';
  R.push(
    B(T,'','--bg:#03070b;--surface:rgba(4,18,21,.84);--primary:#0b8a77;--glow:rgba(56,242,208,.16);--accent:#ffb547;--warn:#ffd166;--text:#ddfff7;--muted:#79aca1;--border:rgba(56,242,208,.2);--radius:14px;--topbar:#020507;--fx:#38f2d0;font-family:Bahnschrift,"DIN Alternate","Segoe UI",system-ui,sans-serif'),
    B(T,'','background:radial-gradient(900px 420px at 50% 112%,rgba(56,242,208,.16),transparent),radial-gradient(1200px 500px at 50% -14%,rgba(255,181,71,.07),transparent),#03070b'),
    B(T,'.topbar','background:linear-gradient(180deg,#04110f,#020507)!important;border-bottom:1px solid rgba(56,242,208,.45)!important'),
    B(T,'.topbar .brand','color:#eafffa;text-shadow:0 0 12px rgba(56,242,208,.5);letter-spacing:.05em'),
    // espaces de travail : un arc de lumière (bas arrondi)
    B(T,'.mfWs','background:rgba(56,242,208,.05);border:1px solid rgba(56,242,208,.25);border-radius:6px 6px 26px 26px / 6px 6px 16px 16px;padding:2px 8px 4px'),
    B(T,'.mfWs button','letter-spacing:.16em;color:#8ac9bb;font-weight:300'),
    B(T,'.mfWs button.on','background:none;color:var(--accent);text-shadow:0 0 10px rgba(255,181,71,.7);box-shadow:inset 0 -2px 0 var(--accent)'),
    B(T,'#mfRibbon','background:linear-gradient(180deg,rgba(5,22,24,.86),rgba(2,9,11,.9));border-color:rgba(56,242,208,.22);box-shadow:0 0 28px rgba(56,242,208,.08)'),
    B(T,'.mfGrp','border-right:1px solid rgba(56,242,208,.12)'),
    B(T,'.mfGrpT','color:#4f9a8a;letter-spacing:.18em'),
    B(T,'.mfRb:hover i,.mfQuick button:hover','color:var(--fx);filter:drop-shadow(0 0 6px rgba(56,242,208,.7))'),
    B(T,'.mfRb:hover','background:rgba(56,242,208,.07)'),
    B(T,'.mfRb.mfOn,#mfBrTabs button.on,#viewbar button.on','background:rgba(255,181,71,.16)!important;border-color:rgba(255,181,71,.6)!important;color:#ffcf85!important'),
    B(T,'.mfRb.mfOn i','color:#ffcf85'),
    B(T,P,'background:linear-gradient(180deg,rgba(5,24,26,.8),rgba(2,10,12,.86))!important;border:1px solid rgba(56,242,208,.26)!important;border-radius:14px!important;box-shadow:0 0 30px rgba(56,242,208,.08),inset 0 0 22px rgba(56,242,208,.05)!important;color:var(--text)'),
    B(T,'.ovlTitle,.panel-title','color:var(--fx)!important;letter-spacing:.06em;font-weight:400'),
    B(T,'#mfTl .tlbS','border-radius:4px 4px 12px 12px'),
    B(T,'#mfTl .tlbS.sel','background:var(--accent)!important;border-color:var(--accent)!important;color:#2a1700!important'),
    B(T,M,'background:rgba(3,14,16,.97)!important;border:1px solid rgba(56,242,208,.3)!important;border-radius:14px!important;box-shadow:0 0 30px rgba(56,242,208,.14),0 14px 36px rgba(0,0,0,.6)!important'),
    // anneau de lumière sous la pièce + lignes de balayage très légères
    B(T,'#vpwrap::after','content:"";position:absolute;inset:0;pointer-events:none;z-index:1;mix-blend-mode:screen;'+
      'background:radial-gradient(ellipse 44% 8% at 50% 86%,transparent 88%,rgba(56,242,208,.38) 94%,transparent 100%),'+
      'radial-gradient(ellipse 30% 5% at 50% 86%,transparent 86%,rgba(255,181,71,.22) 93%,transparent 100%),'+
      'radial-gradient(ellipse 36% 44% at 50% 100%,rgba(56,242,208,.1),transparent 72%),'+
      'repeating-linear-gradient(0deg,rgba(56,242,208,.025) 0 1px,transparent 1px 4px)'),
    B(T,'#vpwrap','border:1px solid rgba(56,242,208,.16)'),
    B(T,'#mfCube','filter:drop-shadow(0 0 8px rgba(56,242,208,.4)) hue-rotate(-30deg)')
  );
  /* ═══ Plan vivant : le bleu d'architecte ═══ */
  const L='planvivant';
  R.push(
    B(L,'','--bg:#0b2747;--surface:rgba(12,44,80,.92);--primary:#2f78c8;--glow:rgba(160,205,255,.14);--accent:#ffd84a;--warn:#ffd84a;--text:#eef5ff;--muted:#9fbde0;--border:rgba(220,236,255,.32);--radius:0px;--topbar:#08203b;--fx:#eaf3ff;font-family:Bahnschrift,"DIN Alternate","Segoe UI",system-ui,sans-serif'),
    B(L,'','background-color:#0b2747;background-image:linear-gradient(rgba(220,236,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(220,236,255,.05) 1px,transparent 1px);background-size:24px 24px'),
    B(L,'.topbar','background:#08203b!important;border-bottom:3px double rgba(220,236,255,.6)!important'),
    B(L,'.topbar .brand','letter-spacing:.08em;text-transform:uppercase;font-weight:600'),
    B(L,BTN,'border-radius:0!important'),
    // pochoir : bouton choisi = découpe blanche, texte bleu d'architecte
    B(L,'.mfWs','background:none;border:1px solid rgba(220,236,255,.55);border-radius:0;padding:2px'),
    B(L,'.mfWs button','letter-spacing:.14em;color:#cfe0f5'),
    B(L,'.mfWs button.on,#mfBrTabs button.on','background:#eaf3ff!important;color:#0b2747!important;font-weight:700'),
    B(L,'.mfRb.mfOn','background:#eaf3ff;border-color:#eaf3ff;color:#0b2747'),
    B(L,'.mfRb.mfOn i','color:#0b2747'),
    B(L,'#mfRibbon','background:rgba(10,38,70,.94);border:1px solid rgba(220,236,255,.5);border-radius:0;outline:1px solid rgba(220,236,255,.16);outline-offset:3px'),
    B(L,'.mfGrp','border-right:1px dashed rgba(220,236,255,.3)'),
    B(L,'.mfGrpT','color:#a9c6e8;letter-spacing:.18em'),
    B(L,'.mfRb:hover','background:rgba(220,236,255,.08);border-color:rgba(220,236,255,.45)'),
    B(L,'.mfRb:hover i','color:var(--accent)'),
    B(L,P,'background:rgba(10,38,70,.92)!important;border:1px solid rgba(220,236,255,.5)!important;border-radius:0!important;box-shadow:5px 5px 0 rgba(0,0,0,.22)!important;color:var(--text)'),
    B(L,'.ovlTitle,.panel-title','color:#eaf3ff!important;letter-spacing:.06em;border-bottom:1px solid rgba(220,236,255,.35);padding-bottom:4px'),
    B(L,'#mfTl .tlbS','border:1px solid rgba(220,236,255,.55)'),
    B(L,'#mfTl .tlbS.sel','background:#eaf3ff!important;color:#0b2747!important;border-color:#eaf3ff!important'),
    B(L,M,'background:#0b2747!important;border:1px solid rgba(220,236,255,.6)!important;border-radius:0!important;box-shadow:6px 6px 0 rgba(0,0,0,.3)!important'),
    B(L,'.mfPop button:hover,.mfPop button.on','background:#eaf3ff;color:#0b2747'),
    // la vue devient une planche : quadrillage fin, gros carreaux, cadre intérieur
    B(L,'#vpwrap::after','content:"";position:absolute;inset:10px;pointer-events:none;z-index:1;border:1px solid rgba(220,236,255,.4);'+
      'background-image:linear-gradient(rgba(220,236,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(220,236,255,.07) 1px,transparent 1px),'+
      'linear-gradient(rgba(220,236,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(220,236,255,.03) 1px,transparent 1px);'+
      'background-size:120px 120px,120px 120px,24px 24px,24px 24px'),
    B(L,'#vpwrap','border:1px solid rgba(220,236,255,.45);border-radius:0'),
    B(L,'kbd','border-radius:0')
  );
  /* ═══ Goutte : galets de verre et tons chauds ═══ */
  const G='goutte';
  R.push(
    B(G,'','--bg:#151217;--surface:rgba(40,34,38,.8);--primary:#d9573a;--glow:rgba(255,154,127,.12);--accent:#9fd8b8;--warn:#ffcf6b;--text:#f3ede4;--muted:#a89f94;--border:rgba(255,240,225,.13);--radius:24px;--topbar:#110e12;--fx:#ff7a59;font-family:"Segoe UI Variable Display","Segoe UI Variable","SF Pro Rounded","Nunito","Segoe UI",system-ui,sans-serif'),
    B(G,'','background:radial-gradient(900px 520px at 42% 30%,rgba(255,214,186,.07),transparent),radial-gradient(1200px 700px at 50% 110%,rgba(0,0,0,.5),transparent),#151217'),
    B(G,'.topbar','background:transparent!important;border-bottom:1px solid rgba(255,240,225,.07)!important'),
    B(G,'.topbar .brand','font-weight:600;letter-spacing:.01em'),
    B(G,BTN,'border-radius:999px!important'),
    B(G,'.mfRb','border-radius:18px!important'),
    B(G,'.mfWs','background:rgba(243,237,228,.05);border:1px solid rgba(243,237,228,.14);border-radius:999px;padding:3px'),
    B(G,'.mfWs button','color:#c9c1b6'),
    B(G,'.mfWs button.on,#mfBrTabs button.on','background:#f3ede4!important;color:#1a1614!important'),
    B(G,'.mfRb.mfOn','background:var(--fx);border-color:var(--fx);color:#1a0d08'),
    B(G,'.mfRb.mfOn i','color:#1a0d08'),
    B(G,'#mfRibbon','border-radius:30px;background:radial-gradient(120% 140% at 30% 0%,rgba(255,250,242,.09),rgba(255,250,242,.02) 60%),rgba(34,29,33,.82);border-color:rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 18px 40px rgba(0,0,0,.35);padding:6px 16px'),
    B(G,'.mfGrp','border-right:none'),
    B(G,'.mfGrpT','color:#9d948a;text-transform:none;letter-spacing:.02em;font-size:.66rem'),
    B(G,'.mfRb:hover','background:rgba(255,122,89,.16)'),
    B(G,'.mfRb:hover i','color:#ffb39f'),
    B(G,P,'background:radial-gradient(120% 100% at 30% 0%,rgba(255,250,242,.1),rgba(255,250,242,.03) 60%),rgba(30,25,29,.76)!important;border:1px solid rgba(255,255,255,.15)!important;border-radius:26px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 24px 50px rgba(0,0,0,.42)!important;backdrop-filter:blur(14px) saturate(1.15);-webkit-backdrop-filter:blur(14px) saturate(1.15);color:var(--text)'),
    B(G,'#treeOverlay','padding-left:14px;padding-right:14px'),
    B(G,'#mfBrTabs,#viewbar','border-radius:999px!important'),
    B(G,'#mfTl','border-radius:999px!important;padding-left:14px;padding-right:14px'),
    // V1.1.8 : la tige — l'historique pousse comme une plante (éclosion : gtTigeSync, 97-interface-themes-goutte)
    B(G,'#mfTl .tlbR','gap:9px;padding:6px 10px 5px;background:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 40 16%27%3E%3Cpath d=%27M0 8C10 3 10 3 20 8S30 13 40 8%27 fill=%27none%27 stroke=%27%23968a7d%27 stroke-width=%272.2%27 stroke-linecap=%27round%27/%3E%3C/svg%3E") repeat-x 0 50%/40px 16px local'),
    B(G,'#mfTl .tlbS','min-width:32px;height:32px;padding:0 5px;border:1px solid rgba(255,250,242,.55);background:radial-gradient(circle at 34% 28%,#fffaf2 0%,#e9e1d5 52%,#bfb4a6 100%);box-shadow:0 3px 8px rgba(0,0,0,.35);color:#1a1614'),
    B(G,'#mfTl .tlbS.sk','min-width:26px;height:26px;padding:0 3px;border-radius:70% 0 70% 0 / 70% 0 70% 0!important;border-color:rgba(205,240,218,.7);background:linear-gradient(135deg,#d6f2e1 0%,#9fd8b8 55%,#5fa883 100%)'),
    B(G,'#mfTl .tlbS.cg','border-style:dashed;background:radial-gradient(circle at 34% 28%,#fff7da,#e8d9a6 70%)'),
    B(G,'#mfTl .tlbS:hover','border-color:#ff9a7f;box-shadow:0 0 0 3px rgba(255,122,89,.25),0 3px 8px rgba(0,0,0,.35)'),
    B(G,'#mfTl .tlbS.sel','background:radial-gradient(circle at 34% 28%,#ffc4b2 0%,#ff7a59 60%,#d9573a 100%)!important;border-color:#ffb39f!important;color:#1a0d08!important;box-shadow:0 0 0 4px rgba(255,122,89,.28),0 3px 10px rgba(0,0,0,.4)'),
    B(G,'#mfTl .tlbS.warn','border-color:#ff453a;box-shadow:inset 0 0 0 1px #ff453a,0 3px 8px rgba(0,0,0,.35)'),
    B(G,'#mfTl .tlbS.rsrc,#mfTl .tlbS.rsrc.rcand','background:radial-gradient(circle at 34% 28%,#c9f7d6,#30d158 75%)'),
    B(G,'#mfTl .tlbS.rcand','background:rgba(48,209,88,.12)'),
    // le marqueur temps = la pousse verte au bout de la tige
    B(G,'#mfTl .tlbM','width:13px;height:26px;margin:0 4px;border-radius:0 100% 0 100%;background:linear-gradient(135deg,#e2f7ea,#7fc9a0 55%,#4f9a74);box-shadow:0 2px 6px rgba(0,0,0,.35)'),
    B(G,'#mfTl .tlbM::before','display:none'),
    B(G,'#mfTl .tlbM.on','box-shadow:0 0 0 3px rgba(159,216,184,.45),0 2px 6px rgba(0,0,0,.35)'),
    B(G,'#mfTl .tlbS.gtNeuf','animation:gtEclot .9s cubic-bezier(.3,1.5,.5,1) both'),
    '@keyframes gtEclot{0%{transform:scale(0) translateY(12px);opacity:0}55%{transform:scale(1.25);opacity:1}75%{transform:scale(.94)}100%{transform:none}}',
    B(G,'.ovlTitle,.panel-title','color:#e9e1d6!important;font-weight:600'),
    B(G,'input,select,textarea','border-radius:12px'),
    // menus ouverts = gouttes : forme irrégulière qui ondule tant qu'elles sont ouvertes
    B(G,M,'background:radial-gradient(120% 100% at 30% 10%,rgba(255,250,242,.16),rgba(255,250,242,.05) 60%),rgba(34,28,32,.94)!important;border:1px solid rgba(255,255,255,.2)!important;border-radius:22px 28px 24px 30px / 26px 22px 30px 24px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 26px 56px rgba(0,0,0,.5)!important;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);animation:mfGoutte 9s ease-in-out infinite'),
    B(G,'.mfPop button,#ctxMenu button,#ctxMenu3D button,#skCtxMenu button,#ctxPiece button','border-radius:14px!important'),
    B(G,'.mfPop button:hover,.mfPop button.on','background:rgba(255,122,89,.85);color:#1a0d08'),
    B(G,'#vpwrap','border-radius:26px'),
    B(G,'#vpwrap::after','content:"";position:absolute;inset:0;pointer-events:none;z-index:1;border-radius:inherit;'+
      'background:radial-gradient(70% 60% at 42% 38%,rgba(255,220,190,.05),transparent 70%),radial-gradient(130% 95% at 50% 50%,transparent 62%,rgba(10,6,8,.42))'),
    '@keyframes mfGoutte{0%,100%{border-radius:22px 28px 24px 30px / 26px 22px 30px 24px}50%{border-radius:30px 22px 28px 24px / 22px 30px 24px 28px}}',
    '@media (prefers-reduced-motion:reduce){html body[data-theme="goutte"] :is('+M+'){animation:none!important}html body[data-theme="habitacle"] :is(#treeOverlay,#propsWrap>.right>.panel){transition:none}html body[data-theme="goutte"] #mfTl .tlbS.gtNeuf{animation:none!important}}'
  );
  st.textContent=R.join('\n');
  document.head.appendChild(st);
}
