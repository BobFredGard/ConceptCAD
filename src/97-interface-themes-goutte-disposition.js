/* ---------- La Goutte, sa disposition : celle de la maquette (V1.1.8) ----------
   Fred, 27/11, après les quatre interfaces du futur (V1.1.6) et la bulle d'actions (V1.1.7) :
   « les interfaces sont proches de l'agencement de l'interface de ConceptCAD actuel. J'aimerais
   vraiment que tu te rapproches de tes 4 façons proposées ». Première des quatre : la Goutte,
   disposée comme sur le canevas des pistes (rien à parcourir, la pièce au milieu).
   Thème Goutte avec sa bulle d'actions, espace CAO, hors esquisse et hors assemblage :
   • plus de ruban : les commandes viennent dans la goutte — sur une face ou une arête, ce qu'on
     peut y faire (97-interface-themes-goutte) ; dans le vide quand rien n'est sélectionné, ou sur
     « + la suite » au bout de la tige : TOUTES les commandes de la CAO, en galets (les groupes du
     ruban, mêmes boutons, épinglés ou non). La recherche Ctrl+K et les raccourcis restent ;
   • l'historique pousse en TIGE verticale à gauche, de bas en haut : bourgeons (fonctions),
     feuilles (esquisses), nom et valeur à côté, pousse verte = marqueur temps ; on glisse toujours
     une fonction ou le marqueur (41-bandeau-timeline : tlbVert) ;
   • l'arbre se range : bascule « Tige · Arbre » en haut à gauche de la vue ;
   • en haut : logo et nom, les espaces en galets au milieu, des orbes à droite (annuler,
     rétablir, enregistrer ; les autres boutons de fichier sortent au survol).
   V1.1.13 (Fred, 27/11 : « les menus FAO, Assembler/Mise en plan ne sont pas traités comme le menu
   CAO », « Chaque partie doit avoir le même style partout ») : la même chose en FAO, en assemblage et
   en PLAN — plus de ruban, la goutte donne les commandes de l'espace où l'on est (clic dans le vide en
   FAO et en assemblage, « + la suite » partout) ; tige des étapes de l'assemblage (bourgeons, nom de la
   pièce, relation), tige de l'usinage (posages en nœuds, opérations en bourgeons, esquisses et corps
   FAO en feuilles ; Tige · Arbre rend le panneau habituel), planches du PLAN en galets.
   Esquisse et téléphone : disposition habituelle. « Ne plus montrer » la bulle rend aussi le ruban
   (classe gt-lay = bulle active). */
function gtLayCss(){
  if(document.getElementById('gtLayCss'))return;
  const st=document.createElement('style');st.id='gtLayCss';
  const L='html body.ui-modern.gt-lay[data-theme="goutte"]:not(.mf-mobile)';
  const C=L+'[data-ws="cao"]:not(.mf-sk):not([data-asm="1"])';
  const A=L+'[data-ws="cao"][data-asm="1"]:not(.mf-sk)'; // V1.1.13 : assemblage
  const F=L+'[data-ws="fao"]:not(.mf-sk)',FT=F+':not(.gt-arbre)'; // V1.1.13 : FAO (FT : en tige)
  const Q=L+'[data-ws="plan"]:not(.mf-sk)'; // V1.1.13 : PLAN
  const X=(p,sel,decl)=>sel.split(',').map(s=>p+' '+s.trim()).join(',')+'{'+decl+'}';
  const NQ=':not([data-fi="q/undo"]):not([data-fi="q/redo"]):not([data-fi="q/save"])';
  // un bout de tige par étape : de son bourgeon à celui du dessous (les bourgeons vont de gauche à droite)
  const seg=(a,b)=>'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 30 46%27%3E%3Cpath d=%27M'+a+' 0C'+a+' 23 '+b+' 23 '+b+' 46%27 fill=%27none%27 stroke=%27%23887c70%27 stroke-width=%272.4%27 stroke-linecap=%27round%27/%3E%3C/svg%3E")';
  const BUD='radial-gradient(circle at 34% 28%,#fffaf2 0%,#e9e1d5 52%,#bfb4a6 100%)';
  const POUSSE='linear-gradient(135deg,#e2f7ea,#7fc9a0 55%,#4f9a74)';
  // V1.1.13 : les règles de la tige, pour une barre (#mfTl de la pièce, #asmTl de l'assemblage)
  const gtTigeCss=(P,T,titre)=>{
    const Y=(sel,decl)=>X(P,sel.replace(/#mfTl/g,T),decl);
    return [
      // la tige : colonne posée sur la vue, sans cadre ; le vide autour laisse passer les clics vers la pièce
      Y('#mfTl','left:8px;right:auto;top:50px;bottom:12px;width:250px;flex-direction:column;justify-content:flex-end;align-items:stretch;gap:4px;padding:0!important;'+
        'background:none!important;border:none!important;border-radius:0!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;pointer-events:none'),
      Y('#mfTl>*','pointer-events:auto'),
      Y('#mfTl::before','content:"'+titre+'";order:1;padding:0 0 0 12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a49c92;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.7)'),
      Y('#mfTl .tlbN','order:2;padding:0 0 2px 12px;font-size:11px;text-shadow:0 1px 3px rgba(0,0,0,.7)'),
      Y('#mfTl .gtSuite','order:3;display:flex;align-items:center;gap:8px;align-self:flex-start;margin:2px 0 0 12px;padding:0 14px 0 8px;height:30px;border-radius:15px!important;border:1px dashed rgba(159,216,184,.6);background:rgba(159,216,184,.08);color:#9fd8b8;font:inherit;font-size:13px;cursor:pointer'),
      Y('#mfTl .gtSuite i','display:inline-block;width:11px;height:20px;border-radius:0 100% 0 100%;background:'+POUSSE),
      Y('#mfTl .gtSuite:hover,#mfTl .gtSuite:focus-visible','background:rgba(159,216,184,.2);border-style:solid;outline:none'),
      Y('#mfTl .tlbR','order:4;flex:0 1 auto;min-height:0;flex-direction:column-reverse;justify-content:flex-start;align-items:stretch;gap:6px;overflow-x:hidden;overflow-y:auto;padding:2px 0 4px;background:none!important'),
      Y('#mfTl .tlbC','order:5;padding-left:8px'),
      Y('#mfTl .tlbK','order:6;padding-left:12px'),
      Y('#mfTl .tlbB','display:none!important'),
      Y('#mfTl .tlbE','white-space:normal;padding:6px 12px;font-size:12px'),
      Y('#mfTl .tlbD','width:auto;height:3px;margin:0 0 0 14px;background:var(--fx)'),
      // une étape = une rangée : le bourgeon (son icône), le nom et la valeur à côté
      Y('#mfTl .tlbS','flex:none;width:auto;min-width:0;height:40px;padding:0 6px 0 52px!important;justify-content:flex-start;background:none!important;border:none!important;border-radius:0!important;box-shadow:none!important;color:var(--text)!important;overflow:visible'),
      Y('#mfTl .tlbR>.tlbS:nth-child(even)','padding-left:62px!important'),
      Y('#mfTl .tlbS>span:first-child','position:absolute;left:10px;top:5px;z-index:1;width:30px;height:30px;box-sizing:border-box;border-radius:50%;display:flex;align-items:center;justify-content:center;'+
        'border:1px solid rgba(255,250,242,.55);background:'+BUD+';box-shadow:0 3px 8px rgba(0,0,0,.35);color:#1a1614;font-size:.8rem;transition:transform .15s'),
      Y('#mfTl .tlbR>:nth-child(even)>span:first-child','left:20px'),
      Y('#mfTl .tlbS.sk>span:first-child','width:24px;height:24px;top:8px;margin-left:3px;border-radius:70% 0 70% 0 / 70% 0 70% 0;border-color:rgba(205,240,218,.7);background:linear-gradient(135deg,#d6f2e1 0%,#9fd8b8 55%,#5fa883 100%)'),
      Y('#mfTl .tlbS.cg>span:first-child','border-style:dashed;background:radial-gradient(circle at 34% 28%,#fff7da,#e8d9a6 70%)'),
      Y('#mfTl .tlbS:hover>span:first-child','transform:scale(1.12);border-color:#ff9a7f;box-shadow:0 0 0 3px rgba(255,122,89,.25),0 3px 8px rgba(0,0,0,.35)'),
      Y('#mfTl .tlbS.sel>span:first-child','background:radial-gradient(circle at 34% 28%,#ffc4b2 0%,#ff7a59 60%,#d9573a 100%);border-color:#ffb39f;color:#1a0d08;box-shadow:0 0 0 4px rgba(255,122,89,.28),0 3px 10px rgba(0,0,0,.4)'),
      Y('#mfTl .tlbS.warn>span:first-child','border-color:#ff453a;box-shadow:inset 0 0 0 1px #ff453a,0 3px 8px rgba(0,0,0,.35)'),
      Y('#mfTl .tlbS.rsrc>span:first-child','background:radial-gradient(circle at 34% 28%,#c9f7d6,#30d158 75%)'),
      Y('#mfTl .tlbS.rcand>span:first-child','border:1px dashed rgba(48,209,88,.85)'),
      Y('#mfTl .tlbS.rsrc::after','left:32px;right:auto;bottom:2px'),
      Y('#mfTl .tlbS .w','left:36px;right:auto;top:0'),
      Y('#mfTl .tlbR>:nth-child(even) .w','left:46px'),
      Y('#mfTl .gtNm','display:flex;flex-direction:column;justify-content:center;min-width:0;max-width:100%;line-height:1.18;text-align:left;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.75)'),
      Y('#mfTl .gtNm b','font-weight:500;font-size:13px;color:#f3ede4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'),
      Y('#mfTl .gtNm i','font-style:normal;font-size:11px;color:#a49c92;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'),
      Y('#mfTl .tlbS.sk .gtNm b','font-size:12.5px;font-weight:400;color:#cfc6ba'),
      Y('#mfTl .tlbS.sel .gtNm b','color:#ff9a7f;font-weight:600'),
      Y('#mfTl .tlbS.sel .gtNm i','color:#d9a594'),
      // la tige elle-même : un bout par rangée, du bourgeon jusqu'à celui du dessous
      Y('#mfTl .tlbR>.tlbS::before,#mfTl .tlbR>.tlbM::before','content:"";display:block;position:absolute;left:15px;top:20px;width:30px;height:46px;z-index:0;pointer-events:none;border:none;background:'+seg(10,20)+' no-repeat 0 0/30px 46px'),
      Y('#mfTl .tlbR>:nth-child(even)::before','background-image:'+seg(20,10)),
      Y('#mfTl .tlbR>:first-child::before','height:22px;opacity:.6'),
      // le marqueur temps : la pousse verte (glisser vers le bas = revenir en arrière)
      Y('#mfTl .tlbM','flex:none;display:flex;align-items:center;width:auto;height:40px;margin:0!important;padding-left:52px;background:none!important;box-shadow:none!important;border-radius:0!important;cursor:ns-resize'),
      Y('#mfTl .tlbR>.tlbM:nth-child(even)','padding-left:62px'),
      Y('#mfTl .tlbM::after','content:"";position:absolute;left:19px;top:6px;width:13px;height:26px;border-radius:0 100% 0 100%;background:'+POUSSE+';box-shadow:0 2px 6px rgba(0,0,0,.35)'),
      Y('#mfTl .tlbR>.tlbM:nth-child(even)::after','left:29px'),
      Y('#mfTl .tlbM.on::after','box-shadow:0 0 0 3px rgba(159,216,184,.45),0 2px 6px rgba(0,0,0,.35)'),
      Y('#mfTl .tlbM .gtNm b','color:#9fd8b8'),
    ];
  };
  st.textContent=[
    // éléments propres à la disposition : invisibles ailleurs
    '#gtSw,#mfTl .gtSuite,#mfTl .gtNm,#asmTl .gtSuite,#asmTl .gtNm,#faoTreeWrap .gtSuite,#faoTree .gtBud,#gtSuiteP{display:none}',
    /* ═══ en haut : logo et nom · espaces au milieu · orbes à droite (tous les espaces) ═══ */
    X(L,'.topbar','position:relative;min-height:54px;padding:8px 18px!important;gap:10px;border-bottom:none!important;margin-bottom:2px'),
    X(L,'.topbar .brand','order:0;font-size:1.05rem'),
    X(L,'.topbar #mffName','order:1;color:var(--muted);font-weight:400'),
    X(L,'.topbar #mfStatus','order:2'),
    // recherche en galet court ; elle s'allonge (vers la gauche, par-dessus les espaces) quand on y tape
    X(L,'.topbar .mfSearch','order:3;flex:0 0 150px;max-width:150px;position:relative;z-index:4;transition:max-width .25s,flex-basis .25s'),
    X(L,'.topbar .mfSearch:focus-within','flex-basis:320px;max-width:320px'),
    X(L,'.topbar .mfSearch:focus-within input','background:#2a2226'),
    X(L,'.topbar .mfSearch input','height:34px;border-radius:17px;padding:0 14px;background:rgba(243,237,228,.05);border-color:rgba(243,237,228,.16)'),
    X(L,'.topbar #mfStRegen','order:4;height:34px;padding:0 14px;border-radius:17px!important'),
    X(L,'.topbar .mfQuick','order:5;display:flex;gap:6px;align-items:center'),
    X(L,'.topbar #prodVer','order:6;opacity:.7'),
    X(L,'.topbar #mfTopBox','order:7'),
    X(L,'.mfWs','position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;gap:8px!important;padding:0!important;background:none!important;border:none!important'),
    X(L,'.mfWs button','height:34px;padding:0 18px;border-radius:17px!important;border:1px solid rgba(243,237,228,.2)!important;background:rgba(243,237,228,.05);color:#c9c1b6;font-size:.8rem;letter-spacing:.08em'),
    X(L,'.mfWs button:hover','background:rgba(255,122,89,.16)'),
    X(L,'.mfWs button.on','background:#f3ede4!important;color:#1a1614!important;border-color:#f3ede4!important'),
    X(L,'.mfQuick button,#mfThemeBtn','width:38px;height:38px;padding:0!important;border-radius:50%!important;border:1px solid rgba(243,237,228,.18)!important;background:rgba(243,237,228,.06)'),
    X(L,'.mfQuick button:hover,#mfThemeBtn:hover','background:rgba(255,122,89,.2)'),
    X(L,'.mfQuick>*','order:4'),
    X(L,'.mfQuick>[data-fi="q/undo"]','order:1'),X(L,'.mfQuick>[data-fi="q/redo"]','order:2'),X(L,'.mfQuick>[data-fi="q/save"]','order:3'),
    // les autres boutons de fichier (nouveau, ouvrir, récents, enregistrer sous, dossier, pilotage) sortent au survol
    X(L,'.mfQuick>*'+NQ,'max-width:0;min-width:0;opacity:0;margin:0 -3px;border-width:0!important;overflow:hidden;transition:max-width .25s,opacity .2s,margin .25s'),
    X(L,'.mfQuick:hover>*'+NQ+',.mfQuick:focus-within>*'+NQ,'max-width:40px;opacity:1;margin:0;border-width:1px!important'),
    X(L,'.mfQuick:hover>.mfQsep,.mfQuick:focus-within>.mfQsep','border-width:0!important;max-width:1px'),
    '@media (max-width:1250px){'+X(L,'.mfWs','position:static;transform:none')+'}',
    /* ═══ CAO : plus de ruban, la tige à gauche, l'arbre rangé ═══ */
    X(C,'#mfRibbon,#mfBrTabs','display:none!important'),
    // V1.1.13 : ni en assemblage, ni en FAO, ni en PLAN (la goutte donne les commandes de l'espace)
    X(A,'#mfRibbon,#mfBrTabs','display:none!important'),X(F,'#mfRibbon,#mfBrTabs','display:none!important'),X(Q,'#mfRibbon,#mfBrTabs','display:none!important'),
    C+':not(.gt-arbre) #treeWrap{display:none!important}',
    C+'.gt-arbre #mfTl{display:none!important}',
    A+':not(.gt-arbre) #treeWrap{display:none!important}',
    A+'.gt-arbre #asmTl{display:none!important}',
    X(C,'#mfVpInfo','bottom:12px'),X(A,'#mfVpInfo','bottom:12px'),
    // bascule Tige · Arbre (la place des onglets Modèle / Usinage / Plan : les espaces sont en haut) — CAO, assemblage, FAO
    ...[C,A,F].flatMap(P=>[
      X(P,'#gtSw','display:flex;position:absolute;top:10px;left:12px;z-index:24;gap:6px'),
      X(P,'#gtSw button','height:30px;padding:0 14px;border-radius:15px!important;border:1px solid rgba(243,237,228,.2);background:rgba(20,16,19,.55);color:#c9c1b6;font:inherit;font-size:.78rem;letter-spacing:.06em;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)'),
      X(P,'#gtSw button:hover','background:rgba(255,122,89,.2)'),
      P+':not(.gt-arbre) #gtSw [data-gt="tige"],'+P+'.gt-arbre #gtSw [data-gt="arbre"]{background:#f3ede4;color:#1a1614;border-color:#f3ede4}']),
    // la tige de la pièce (CAO) et celle de l'assemblage : mêmes règles, barre différente
    ...gtTigeCss(C,'#mfTl','La tige de la pièce'),
    ...gtTigeCss(A,'#asmTl','La tige de l’assemblage'),
    X(A,'#asmTl .tlbS.k-rel>span:first-child','background:radial-gradient(circle at 34% 28%,#eef5ff 0%,#c9dcf5 55%,#8fa9c9 100%)'),
    X(A,'#asmTl .tlbS.k-pat>span:first-child','background:radial-gradient(circle at 34% 28%,#effbf3,#bfe6cd 60%,#7fb796 100%)'),
    X(A,'#asmTl .tlbS.k-move>span:first-child','border-style:dashed'),
    X(A,'#asmTl .tlbS small','display:none'),
    /* ═══ FAO : la tige de l'usinage — posages en nœuds, opérations en bourgeons, esquisses et corps FAO en feuilles ═══ */
    X(FT,'#faoWrap','top:50px!important;bottom:12px!important;left:8px!important;right:auto!important;min-width:0!important;max-width:none!important;align-items:stretch!important'),
    X(FT,'#faoTreeWrap','flex:1 1 auto;min-height:0;align-self:stretch!important;pointer-events:none'),
    X(FT,'#faoToggle,#faoTreeWrap .fao-title','display:none!important'),
    X(FT,'#faoTreeWrap .fao-cnt','display:flex!important;flex-direction:column;justify-content:flex-end;gap:4px;width:250px;height:100%;max-height:none;box-sizing:border-box;margin:0!important;padding:0!important;overflow:visible;'+
      'background:none!important;border:none!important;border-radius:0!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;pointer-events:none'),
    X(FT,'#faoTreeWrap .fao-cnt>*','pointer-events:auto'),
    X(FT,'#faoTreeWrap .fao-cnt::before','content:"La tige de l’usinage";order:1;padding:0 0 0 12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a49c92;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.7)'),
    X(FT,'#faoTreeWrap .gtSuite','order:3;display:flex;align-items:center;gap:8px;align-self:flex-start;margin:2px 0 0 12px;padding:0 14px 0 8px;height:30px;border-radius:15px!important;border:1px dashed rgba(159,216,184,.6);background:rgba(159,216,184,.08);color:#9fd8b8;font:inherit;font-size:13px;cursor:pointer'),
    X(FT,'#faoTreeWrap .gtSuite i','display:inline-block;width:11px;height:20px;border-radius:0 100% 0 100%;background:'+POUSSE),
    X(FT,'#faoTreeWrap .gtSuite:hover,#faoTreeWrap .gtSuite:focus-visible','background:rgba(159,216,184,.2);border-style:solid;outline:none'),
    X(FT,'#faoTree','order:4;flex:0 1 auto;min-height:0;display:flex;flex-direction:column-reverse;justify-content:flex-start;gap:6px;overflow-x:hidden;overflow-y:auto;padding:2px 0 4px'),
    // les posages : galets au pied de la tige
    X(FT,'#mfPosTabs','order:5;margin:4px 0 0 12px!important;gap:6px'),
    X(FT,'#mfPosTabs button','height:28px;padding:0 12px;border-radius:14px!important;border:1px solid rgba(243,237,228,.2);background:rgba(20,16,19,.55);color:#c9c1b6;font-size:.74rem;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)'),
    X(FT,'#mfPosTabs button:hover','background:rgba(255,122,89,.2)'),
    X(FT,'#mfPosTabs button.on','background:#f3ede4!important;color:#1a1614!important;border-color:#f3ede4!important'),
    // une ligne = une rangée de la tige : le bourgeon, le nom et l'outil à côté
    X(FT,'#faoTree>div','position:relative;flex:none;display:flex;align-items:center;gap:6px;height:40px;min-height:40px;box-sizing:border-box;margin:0!important;padding:0 6px 0 52px!important;'+
      'background:none!important;border:none!important;border-radius:0!important;box-shadow:none!important;color:#f3ede4;font-size:13px;text-shadow:0 1px 3px rgba(0,0,0,.75);overflow:visible;cursor:pointer'),
    X(FT,'#faoTree>div:nth-child(even)','padding-left:62px!important'),
    X(FT,'#faoTree .gtBud','display:flex;position:absolute;left:10px;top:5px;z-index:1;width:30px;height:30px;box-sizing:border-box;border-radius:50%;align-items:center;justify-content:center;'+
      'border:1px solid rgba(255,250,242,.55);background:'+BUD+';box-shadow:0 3px 8px rgba(0,0,0,.35);color:#1a1614;pointer-events:none;transition:transform .15s'),
    X(FT,'#faoTree>div:nth-child(even) .gtBud','left:20px'),
    X(FT,'#faoTree .gtBud svg','width:16px;height:16px'),
    X(FT,'#faoTree .fao-setup .gtBud','border-radius:10px;border-color:rgba(241,220,192,.6);background:radial-gradient(circle at 34% 28%,#f6e6cf 0%,#c9a57f 60%,#8a6644 100%)'),
    X(FT,'#faoTree .fao-grp .gtBud,#faoTree .fao-sub .gtBud','width:24px;height:24px;top:8px;margin-left:3px;border-radius:70% 0 70% 0 / 70% 0 70% 0;border-color:rgba(205,240,218,.7);background:linear-gradient(135deg,#d6f2e1 0%,#9fd8b8 55%,#5fa883 100%)'),
    X(FT,'#faoTree>div:hover .gtBud','transform:scale(1.12);border-color:#ff9a7f;box-shadow:0 0 0 3px rgba(255,122,89,.25),0 3px 8px rgba(0,0,0,.35)'),
    X(FT,'#faoTree>div.sel .gtBud','background:radial-gradient(circle at 34% 28%,#ffc4b2 0%,#ff7a59 60%,#d9573a 100%);border-color:#ffb39f;color:#1a0d08;box-shadow:0 0 0 4px rgba(255,122,89,.28),0 3px 10px rgba(0,0,0,.4)'),
    X(FT,'#faoTree>div.isoff .gtBud,#faoTree>div.struck .gtBud','background:radial-gradient(circle at 34% 28%,#e3ddd5,#9a9186 75%);opacity:.7'),
    X(FT,'#faoTree .lb,#faoTree .fao-setup>span:not(.fao-tri):not(.gtBud)','flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500'),
    X(FT,'#faoTree>div.sel .lb,#faoTree .fao-setup.sel>span:not(.fao-tri):not(.gtBud)','color:#ff9a7f;font-weight:600'),
    X(FT,'#faoTree .fao-grp .lb,#faoTree .fao-sub .lb','font-weight:400;font-size:12.5px;color:#cfc6ba'),
    X(FT,'#faoTree .badge','flex:none;font-size:11px;color:#a49c92'),
    X(FT,'#faoTree .eye,#faoTree .fao-tri','flex:none;font-size:10px;color:#a49c92'),
    X(FT,'#faoTree .eye.on','color:#9fd8b8'),
    X(FT,'#faoTree .hbtn','flex:none;opacity:0;font-size:11px;transition:opacity .15s'),
    X(FT,'#faoTree>div:hover .hbtn,#faoTree .hbtn.on','opacity:1'),
    X(FT,'#faoTree>div.isoff .lb','text-decoration:line-through;opacity:.6'),
    X(FT,'#faoTree>div.ishid .lb','font-style:italic;opacity:.75'),
    // la tige elle-même, comme celle de la pièce
    X(FT,'#faoTree>div::before','content:"";display:block;position:absolute;left:15px;top:20px;width:30px;height:46px;z-index:0;pointer-events:none;border:none;background:'+seg(10,20)+' no-repeat 0 0/30px 46px'),
    X(FT,'#faoTree>div:nth-child(even)::before','background-image:'+seg(20,10)),
    X(FT,'#faoTree>div:first-child::before','height:22px;opacity:.6'),
    /* ═══ PLAN : les planches en galets, « + la suite » devant elles ═══ */
    X(Q,'#mepTabs','gap:8px;padding:6px 10px 6px 132px;background:none;border:none'),
    X(Q,'#mepTabs button','height:30px;padding:0 14px;border-radius:15px!important;border:1px solid rgba(243,237,228,.2)!important;background:rgba(243,237,228,.05);color:#c9c1b6;font-size:.78rem;letter-spacing:.04em'),
    X(Q,'#mepTabs button:hover','background:rgba(255,122,89,.16)'),
    X(Q,'#mepTabs button.on','background:#f3ede4!important;color:#1a1614!important;border-color:#f3ede4!important;font-weight:500'),
    X(Q,'#mepTabs .mepAdd','width:30px;padding:0!important;border-radius:50%!important;border-style:solid!important'),
    X(Q,'#gtSuiteP','display:flex;position:absolute;top:6px;left:10px;z-index:55;align-items:center;gap:8px;padding:0 14px 0 8px;height:30px;border-radius:15px!important;border:1px dashed rgba(159,216,184,.6);background:rgba(20,16,19,.6);color:#9fd8b8;font:inherit;font-size:13px;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)'),
    X(Q,'#gtBulle','background-color:rgba(38,31,35,.9)'), // sur le papier blanc de la planche : la goutte plus dense, lisible
    X(Q,'#gtSuiteP i','display:inline-block;width:11px;height:20px;border-radius:0 100% 0 100%;background:'+POUSSE),
    X(Q,'#gtSuiteP:hover,#gtSuiteP:focus-visible','background:rgba(159,216,184,.2);border-style:solid;outline:none'),
    // la bulle de toutes les commandes : un peu plus large, des icônes dans les galets
    '#gtBulle.gtOut{width:370px;padding:32px 40px 26px}',
    '#gtBulle .gtA{display:flex;align-items:center;gap:7px;text-align:left}',
    '#gtBulle .gtA>i{flex:none;display:flex;width:18px;height:18px;align-items:center;justify-content:center;font-style:normal;color:#ffcbbd}',
    '#gtBulle .gtA>i svg{width:18px;height:18px}',
    '#gtBulle .gtA>span{min-width:0;overflow:hidden;text-overflow:ellipsis}',
    '#gtBulle .gtA.gtGrp>em{margin-left:auto;font-style:normal;font-size:11px;color:#a89f94}',
    '#gtBulle .gtA.gtRet{grid-column:1/-1;justify-content:center;background:none;border-style:dashed}',
    '#gtBulle .gtA.on{background:rgba(255,122,89,.3);border-color:#ff9a7f;color:#fff}',
    // la valeur de la fonction créatrice, dans la bulle d'une face (la maquette : « Profondeur 12 mm »)
    '#gtBulle .gtV{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:#e7dfd3}',
    '#gtBulle .gtV>span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#gtBulle .gtV input{width:74px;height:30px;box-sizing:border-box;border-radius:15px;border:1px solid rgba(255,154,127,.55);background:rgba(255,122,89,.1);color:#fff;font:inherit;font-size:13px;text-align:center;padding:0 8px}',
    '#gtBulle .gtV input:focus{outline:none;border-color:#ff9a7f;background:rgba(255,122,89,.2)}',
    '#gtBulle .gtV input:disabled{opacity:.6}',
    '#gtBulle .gtV em{font-style:normal;color:#a89f94;min-width:18px}',
    '#gtBulle .gtErr{margin-top:6px;font-size:11.5px;color:#ffb39f}'
  ].join('\n');
  document.head.appendChild(st);
}
// V1.1.13 : la disposition de la maquette est en place, quel que soit l'espace (thème Goutte et sa bulle, ordinateur, hors esquisse)
function gtLayOn(){
  try{
    const b=document.body;
    return !!b&&b.classList.contains('gt-lay')&&b.classList.contains('ui-modern')&&!b.classList.contains('mf-mobile')&&
      b.getAttribute('data-theme')==='goutte'&&!b.classList.contains('mf-sk');
  }catch(e){return false;}
}
// La disposition de la maquette est-elle en place ? (thème Goutte et sa bulle, ordinateur, CAO hors esquisse / assemblage)
function gtLayCao(){
  try{
    const b=document.body;
    return !!b&&b.classList.contains('gt-lay')&&b.classList.contains('ui-modern')&&!b.classList.contains('mf-mobile')&&
      b.getAttribute('data-theme')==='goutte'&&(b.getAttribute('data-ws')||'cao')==='cao'&&!b.classList.contains('mf-sk')&&b.getAttribute('data-asm')!=='1';
  }catch(e){return false;}
}
function gtLaySync(refaire){
  // refaire : la tige est redessinée (noms ajoutés en Goutte) — pas au chargement, la pièce n'existe pas encore
  try{
    const b=document.body;if(!b)return;
    gtLayCss();
    b.classList.toggle('gt-lay',gtOn());
    b.classList.toggle('gt-arbre',mfLS('minifusion_goutte_arbre')==='1');
    gtSwBuild();gtSuitePBuild();
    if(refaire)try{if(typeof mfMaquetteRefaire==='function')mfMaquetteRefaire();else if(typeof renderTimeline==='function')renderTimeline();}catch(e){} // V1.1.13 : FAO et assemblage aussi
  }catch(e){}
}
function gtSwBuild(){
  const vp=document.getElementById('vpwrap');if(!vp||document.getElementById('gtSw'))return;
  const w=document.createElement('div');w.id='gtSw';w.setAttribute('role','group');w.setAttribute('aria-label','La tige ou l’arbre');
  [['tige','Tige','L’historique en tige : une fonction par bourgeon, la plus ancienne en bas'],['arbre','Arbre','L’arbre du modèle : origine, corps, esquisses, paramètres']].forEach(([k,l,t])=>{
    const bt=document.createElement('button');bt.type='button';bt.dataset.gt=k;bt.textContent=l;bt.title=t;
    bt.onclick=e=>{e.stopPropagation();gtArbre(k==='arbre');};w.appendChild(bt);});
  ['pointerdown','mousedown','dblclick'].forEach(t=>w.addEventListener(t,e=>{try{e.stopPropagation();}catch(_){}}));
  vp.appendChild(w);
}
function gtArbre(on){
  try{mfLS('minifusion_goutte_arbre',on?'1':'0');}catch(e){}
  document.body.classList.toggle('gt-arbre',!!on);
  try{if(!on&&typeof renderTimeline==='function')renderTimeline();}catch(e){}
}
// V1.1.13 : PLAN — « + la suite » devant les planches (la vue des planches n'a pas de vide à cliquer)
function gtSuitePBuild(){
  const vp=document.getElementById('vpwrap');if(!vp||document.getElementById('gtSuiteP'))return;
  const g=document.createElement('button');g.type='button';g.id='gtSuiteP';g.innerHTML='<i></i>+ la suite';
  g.title='Toutes les commandes du PLAN, dans une goutte';
  g.onclick=e=>{e.stopPropagation();const r=g.getBoundingClientRect();gtOutils(r.right-6,r.top+r.height/2);};
  ['pointerdown','mousedown','dblclick'].forEach(t=>g.addEventListener(t,e=>{try{e.stopPropagation();}catch(_){}}));
  vp.appendChild(g);
}
// « + la suite » : un bouton de la tige (pièce, assemblage, usinage)
function gtSuiteBouton(quoi){
  const g=document.createElement('button');g.type='button';g.className='gtSuite';g.innerHTML='<i></i>+ la suite';
  g.title='Toutes les commandes '+quoi+', dans une goutte';
  g.onclick=e=>{e.stopPropagation();const r=g.getBoundingClientRect();gtOutils(r.right-6,r.top+r.height/2);};
  return g;
}
/* ----- V1.1.13 : la tige de l'assemblage (barre 48 asmTlRender, appelée par mfAsmTlSync) ----- */
function gtAsmHabille(R,H,c){
  if(!gtLayOn())return;
  const els=[...R.querySelectorAll('.tlbS')];
  els.forEach((el,i)=>{
    const s=H&&H[i];if(!s)return;
    let nc='';try{nc=asmHistName(c,s);}catch(e){}
    const E=mfAsmEtape(nc);
    const m=document.createElement('span');m.className='gtNm';
    const b=document.createElement('b');b.textContent=E.nom;m.appendChild(b);
    if(E.detail){const it=document.createElement('i');it.textContent=E.detail;m.appendChild(it);}
    el.appendChild(m);
  });
  const M=R.querySelector('.tlbM');
  if(M&&M.nextElementSibling){const m=document.createElement('span');m.className='gtNm';m.innerHTML='<b>assemblé jusqu’ici</b><i>glisser la pousse pour avancer</i>';M.appendChild(m);}
  const h=R.parentNode;
  if(h&&!h.querySelector('.gtSuite'))h.insertBefore(gtSuiteBouton('de l’assemblage'),R);
}
/* ----- V1.1.13 : la tige de l'usinage (arbre 88 faoRenderTree, appelé par mfFaoArbreSync) ----- */
function gtFaoHabille(tree){
  if(!gtLayOn()||!tree)return;
  const ic=k=>{try{return mfI(k,16)||'';}catch(e){return '';}};
  const bud=(row,k)=>{const b=document.createElement('span');b.className='gtBud';b.innerHTML=ic(k);row.appendChild(b);}; // à la fin : l'œil reste le premier enfant
  let vues=[];try{vues=mfFaoOpsVues(faoRoot());}catch(e){vues=[];}
  let n=0,grp='sketch';
  [...tree.children].forEach(row=>{
    const cl=row.classList;
    if(cl.contains('fao-setup'))bud(row,'setup');
    else if(cl.contains('fao-grp')){grp=/Corps/.test(row.textContent)?'extrude':'sketch';bud(row,grp);}
    else if(cl.contains('fao-sub'))bud(row,grp);
    else if(cl.contains('fao-op')){const v=vues[n++];bud(row,(v&&typeof MF_FAO_ICON!=='undefined'&&MF_FAO_ICON[v.op.type])||'pocket');}
  });
  const cnt=tree.parentNode;
  if(cnt&&!cnt.querySelector(':scope>.gtSuite'))cnt.insertBefore(gtSuiteBouton('de la FAO'),tree);
}
/* ----- la tige : nom et valeur de chaque étape ----- */
const gtNb=v=>String(+(+v||0).toFixed(2)).replace('.',','); // 5,5 et non 5,50
// Ce qu'on lit sous le nom d'une étape (la maquette : « Extrusion 1 / 25 mm »). Pur.
function gtTigeDetail(s){
  if(!s)return '';
  if(s.kind==='sketch')return 'esquisse';
  if(s.kind==='cg')return 'construction';
  const o=s.o||{},n=v=>gtNb(Math.abs(+v||0));
  switch(o.type){
    case 'extrude':return o.upto?(o.op==='cut'?'découpe':'extrusion')+' jusqu’à une face':(o.op==='cut'?'découpe ':'')+n(o.distance)+' mm';
    case 'revolve':return n(o.angle)+'°';
    case 'hole':return 'Ø'+n(o.d)+(o.end==='through'?' débouchant':' × '+n(o.depth));
    case 'xfillet':case 'fillet':{const k=(o.edges||[]).length;return (o.chamfer?'chanfrein':'congé')+(k?' · '+k+' arête'+(k>1?'s':''):'');}
    case 'xdraft':return 'dépouille '+n(o.angle)+'°';
    case 'xmove':return n(o.dist)+' mm';
    case 'repeat':return 'répétition'+(o.mode==='circ'?' circulaire':o.mode==='lin'?' linéaire':'');
    default:return '';
  }
}
function gtTigeNom(s){
  if(!s||!s.o)return '';
  if(s.kind==='cg'){try{return cgLabel(s.o);}catch(e){return s.o.name||'Construction';}}
  return s.o.name||'';
}
// Habille la rangée refaite par renderTimeline : noms, « + la suite » (appelé par gtTigeSync)
function gtTigeHabille(R,S){
  const els=[...R.querySelectorAll('.tlbS')];
  els.forEach((el,i)=>{
    const s=S&&S[i];if(!s||(el.dataset&&s.id!==el.dataset.id))return;
    const m=document.createElement('span');m.className='gtNm';
    const b=document.createElement('b');b.textContent=gtTigeNom(s);m.appendChild(b);
    const d=gtTigeDetail(s);if(d){const it=document.createElement('i');it.textContent=d;m.appendChild(it);}
    el.appendChild(m);
  });
  // le marqueur, quand il n'est pas au bout : il dit jusqu'où la pièce est rejouée
  const M=R.querySelector('.tlbM');
  if(M&&M.nextElementSibling){const m=document.createElement('span');m.className='gtNm';m.innerHTML='<b>rejouée jusqu’ici</b><i>glisser la pousse pour avancer</i>';M.appendChild(m);}
  const H=R.parentNode;
  if(H&&!H.querySelector('.gtSuite')){
    const g=document.createElement('button');g.type='button';g.className='gtSuite';g.innerHTML='<i></i>+ la suite';
    g.title='Toutes les commandes de la CAO, dans une goutte';
    g.onclick=e=>{e.stopPropagation();const r=g.getBoundingClientRect();gtOutils(r.right-6,r.top+r.height/2);};
    H.insertBefore(g,R);
  }
}
/* ----- la goutte de toutes les commandes ----- */
// Les commandes de la CAO, lues dans le ruban : mêmes groupes, mêmes boutons (épinglés ou non), même ordre
function gtLab(b){
  let t='';
  b.childNodes.forEach(n=>{
    if(n.nodeType===3)t+=n.textContent;
    else if(n.nodeType===1&&n.tagName!=='I'){let vis=true;try{vis=getComputedStyle(n).display!=='none';}catch(e){}if(vis)t+=n.textContent;}
  });
  return t.replace(/\s+/g,' ').trim();
}
// V1.1.13 : les groupes de l'espace où l'on est (CAO, assemblage, FAO, PLAN) — ceux que le ruban montrerait
function gtGroupes(){
  const out=[],asm=document.body.getAttribute('data-asm')==='1';
  document.querySelectorAll('#mfRibbon .mfGrp').forEach(g=>{
    try{if(getComputedStyle(g).display==='none')return;}catch(e){}
    const T=g.querySelector('.mfGrpT'),nom=T?T.textContent.replace(/\s*▾\s*$/,'').trim():'';
    const cmds=[];
    g.querySelectorAll('.mfGrpB>.mfRb').forEach(b=>{
      if(b.classList.contains('mfAsmOnly')&&!asm)return;
      if(!b.classList.contains('mfOff')){try{if(getComputedStyle(b).display==='none')return;}catch(e){}}
      const l=gtLab(b);if(!l)return;
      const i=b.querySelector('i');cmds.push({l,ic:i?i.innerHTML:'',b,tip:b.title||l,on:b.classList.contains('mfOn')});
    });
    if(nom&&cmds.length)out.push({nom,cmds});
  });
  return out;
}
// Place la goutte (et ses deux perles) près du point (cx, cy), dans la vue
function gtPoser(B){
  const el=B.el;
  let R={left:0,top:0,right:window.innerWidth,bottom:window.innerHeight};
  try{const r=document.getElementById('vpwrap').getBoundingClientRect();if(r.width>200)R=r;}catch(e){}
  const w=el.offsetWidth||330,h=el.offsetHeight||220,p=gtPlace(B.cx,B.cy,w,h,R);
  el.style.left=p.x+'px';el.style.top=p.y+'px';
  B.perles.forEach(q=>{try{q.remove();}catch(e){}});B.perles=[];
  const tx=p.x<B.cx?p.x+w-18:p.x+18,ty=p.y+h*0.55;
  [[0.3,12],[0.64,20]].forEach(([k,d])=>{
    const q=document.createElement('div');q.className='gtPerle';
    q.style.width=q.style.height=d+'px';q.style.left=(B.cx+(tx-B.cx)*k-d/2)+'px';q.style.top=(B.cy+(ty-B.cy)*k-d/2)+'px';
    document.body.appendChild(q);B.perles.push(q);
  });
}
// « de la CAO », « de la FAO »… : l'espace dont la goutte donne les commandes
function gtEspaceNom(){
  const e=typeof mfEspace==='function'?mfEspace():'cao';
  return {asm:'de l’assemblage',fao:'de la FAO',plan:'du PLAN'}[e]||'de la CAO';
}
function gtOutils(cx,cy){
  const G=gtGroupes();if(!G.length)return;
  const esp=gtEspaceNom();
  gtCss();gtCacher();
  const el=document.createElement('section');el.id='gtBulle';el.className='gtOut';el.setAttribute('aria-label','La goutte : toutes les commandes '+esp);
  const B={el,perles:[],cx,cy,force:null,fid:null,ctx:{kind:'outils'}};
  const bouton=(ic,txt,tip,fn,cls)=>{
    const b=document.createElement('button');b.type='button';b.className='gtA'+(cls?' '+cls:'');b.title=tip||txt;
    if(ic){const i=document.createElement('i');i.innerHTML=ic;b.appendChild(i);}
    const s=document.createElement('span');s.textContent=txt;b.appendChild(s);
    b.onclick=ev=>{ev.stopPropagation();fn();};return b;
  };
  const lancer=c=>{gtCacher();try{c.b.click();}catch(e){}};
  const remplir=g=>{
    el.innerHTML='';
    const t=document.createElement('div');t.className='gtT';t.textContent=g?g.nom:'La suite ?';
    const s=document.createElement('div');s.className='gtS';s.textContent=g&&G.length>1?g.cmds.length+' commande'+(g.cmds.length>1?'s':''):'Toutes les commandes '+esp;
    const grid=document.createElement('div');grid.className='gtG';
    if(!g)G.forEach(x=>{
      const one=x.cmds.length===1;
      const b=bouton(x.cmds[0].ic,one?x.cmds[0].l:x.nom,one?x.cmds[0].tip:x.cmds.map(c=>c.l).join(' · '),()=>one?lancer(x.cmds[0]):remplir(x),'gtGrp'+(x.cmds.some(c=>c.on)?' on':''));
      if(!one){const n=document.createElement('em');n.textContent=x.cmds.length;b.appendChild(n);}
      b.dataset.gt='g:'+x.nom;grid.appendChild(b);
    });
    else{
      g.cmds.forEach(c=>{const b=bouton(c.ic,c.l,c.tip,()=>lancer(c),c.on?'on':'');b.dataset.gt='c:'+c.l;grid.appendChild(b);});
      if(G.length>1)grid.appendChild(bouton('','‹ Toutes les commandes','Revenir aux groupes',()=>remplir(null),'gtRet')); // V1.1.13 : un seul groupe (assemblage) = ses commandes tout de suite
    }
    const ft=document.createElement('div');ft.className='gtF';
    const a=document.createElement('span');a.textContent='Ctrl+K : chercher une commande';
    const e=document.createElement('span');e.textContent='Échap pour fermer';
    ft.appendChild(a);ft.appendChild(e);
    el.appendChild(t);el.appendChild(s);el.appendChild(grid);el.appendChild(ft);
    if(el.isConnected)gtPoser(B);
    try{const f=grid.querySelector('button');if(f&&g)f.focus({preventScroll:true});}catch(err){}
  };
  remplir(G.length===1?G[0]:null);
  document.body.appendChild(el);
  gtPoser(B);
  gtBulle=B;
}
// Rien de sélectionné (ni face, ni arête, ni fonction, ni esquisse) : un clic dans le vide ouvre toutes les commandes
function gtRien(){
  try{
    if(typeof asmMode!=='undefined'&&asmMode==='asm'&&((typeof asmSelId!=='undefined'&&asmSelId)||(typeof asmHistSel!=='undefined'&&asmHistSel)))return false; // V1.1.13 : une pièce de l'assemblage
    return !(selFaces||[]).length&&!(selEdges||[]).length&&!(typeof sel!=='undefined'&&sel&&sel.kind)&&!(typeof treeSel!=='undefined'&&treeSel&&treeSel.length);
  }catch(e){return false;}
}
/* ----- la valeur de la fonction créatrice, réglable dans la bulle d'une face ----- */
// Pur : quelle valeur d'une fonction montrer (clé, libellé, unité) ; null = rien de simple à régler
function gtValeur(f){
  if(!f||typeof f!=='object')return null;
  const M={extrude:['distance',f.op==='cut'?'Profondeur':'Hauteur','mm'],hole:['d','Diamètre','mm'],revolve:['angle','Angle','°'],xdraft:['angle','Angle de dépouille','°']};
  const m=M[f.type];if(!m)return null;
  if(f.type==='extrude'&&f.upto)return null; // jusqu'à une face : pas de distance
  const v=+f[m[0]];if(!isFinite(v))return null;
  return {k:m[0],l:m[1],u:m[2],v:Math.abs(v),fx:!!(f.expr&&f.expr[m[0]])};
}
function gtValeurRang(B,f){
  const V=gtValeur(f);if(!V)return null;
  const row=document.createElement('label');row.className='gtV';
  const l=document.createElement('span');l.textContent=V.l+' · '+(f.name||'');l.title=V.l+' de « '+(f.name||f.id)+' »';
  const inp=document.createElement('input');inp.value=gtNb(V.v);inp.setAttribute('aria-label',V.l);inp.autocomplete='off';
  const u=document.createElement('em');u.textContent=V.fx?'ƒx':V.u;
  if(V.fx){inp.disabled=true;inp.title='Valeur donnée par une formule : « Modifier » pour la changer';}
  else inp.title='Nouvelle valeur puis Entrée';
  const err=document.createElement('div');err.className='gtErr';err.style.display='none';
  const appliquer=()=>{
    const v=typeof c3Parse==='function'?c3Parse(inp.value):parseFloat(String(inp.value).replace(',','.'));
    if(!(v>0)){err.textContent='Une valeur positive, en '+V.u;err.style.display='';return;}
    if(Math.abs(v-V.v)<1e-9){gtCacher();return;}
    let r='réglage indisponible';
    try{r=c3FeatSet(f,V.k,v,'Goutte : '+V.l.toLowerCase()+' de « '+(f.name||f.id)+' »');}catch(e){r=e&&e.message||r;}
    if(r!==true){err.textContent=String(r);err.style.display='';return;}
    gtCacher();
    try{faceEl.textContent=V.l+' de « '+(f.name||f.id)+' » : '+gtNb(v)+' '+V.u;}catch(e){}
  };
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();appliquer();}});
  row.appendChild(l);row.appendChild(inp);row.appendChild(u);
  const box=document.createElement('div');box.appendChild(row);box.appendChild(err);
  return box;
}
(function(){
  try{gtLaySync();}catch(e){}
})();
