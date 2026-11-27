// V0.2.1 : interface « Moderne » (en option, l'interface classique reste intacte) + thèmes.
// Chaque bouton du ruban CLIQUE un bouton existant : on vérifie que tous ces boutons existent.
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
const {loadApp}=require('./appvm.cjs');
let ko=0;const A=(c,m)=>{if(!c){ko++;console.log('  x '+m);}else console.log('  ✓ '+m);};
const html=fs.readFileSync(path.join(ROOT,'ConceptCAD.html'),'utf8');
const src=fs.readFileSync(path.join(ROOT,'src','97-interface-moderne.js'),'utf8');
const ids=[...src.matchAll(/\['[^']*','[^']*','(btn\w+|fao\w+Btn)'/g)].map(m=>m[1]);
const missing=ids.filter(id=>!new RegExp("id=[\"']"+id+"[\"']|\.id=[\"']"+id+"[\"']|id='"+id+"'").test(html));
A(ids.length>=20,'ruban : '+ids.length+' boutons reliés à des commandes existantes');
A(!missing.length,'tous les boutons cibles existent ('+(missing.join(', ')||'aucun manquant')+')');
A(/body\.ui-modern \.mfM\{display:flex!important\}/.test(src)&&/'\.mfM\{display:none!important\}'/.test(src),'éléments modernes invisibles en classique (classe .mfM)');
A(!/\.remove\(\)/.test(src.replace(/p\.remove\(\)|res\.remove\(\)|\.mfPop\.mfTmp'\)\.forEach\(p=>p\.remove\(\)\)/g,'')),'le mode moderne ne détruit rien de l’interface classique');
const {ctx,sandbox}=loadApp();
const LS={};sandbox.localStorage.getItem=k=>(k in LS?LS[k]:null);sandbox.localStorage.setItem=(k,v)=>{LS[k]=String(v);}; // mémoire réelle pour le test
const r=vm.runInContext(`(function(){const o=[];
  o.push(typeof mfTheme==='function'&&typeof mfUiMode==='function'&&typeof mfWs==='function'&&typeof mfCommands==='function');
  o.push(MF_THEMES.map(t=>t[0]).join(','));
  mfTheme('atelier');o.push(mfLS('minifusion_theme'));mfTheme('inconnu');o.push(mfLS('minifusion_theme'));
  mfUiMode('moderne');o.push(mfLS('minifusion_ui'));mfUiMode('classique');o.push(mfLS('minifusion_ui'));

  return o;})()`,ctx);
A(r[0],'fonctions thème / interface / espaces / recherche présentes');
A(r[1]==='nuit,graphite,atelier,clair,contraste,habitacle,holo,planvivant,goutte','9 thèmes (5 + 4 interfaces du futur, V1.1.6) : '+r[1]);
A(r[2]==='atelier'&&r[3]==='nuit','thème mémorisé ; thème inconnu → Nuit (actuel)');
A(r[4]==='moderne'&&r[5]==='moderne','interface : Moderne seule (la demande « classique » reste en moderne)');
// V1.1.6 : interfaces du futur (97-interface-themes-futur) — règles de chaque thème, arêtes teintées
const f=JSON.parse(vm.runInContext(`(function(){const o={};
  let cap=null;const hd=document.head,old=hd.appendChild,gid=document.getElementById;
  document.getElementById=()=>null;hd.appendChild=n=>{cap=n;return n;};
  try{mfFuturCss();}finally{document.getElementById=gid;hd.appendChild=old;}
  o.css=(cap&&cap.textContent)||'';
  const ga=document.body.getAttribute;let th='nuit';document.body.getAttribute=k=>k==='data-theme'?th:null;
  o.ec={};['nuit','clair','habitacle','holo','planvivant','goutte'].forEach(t=>{th=t;o.ec[t]=mfEdgeCols();});
  document.body.getAttribute=ga;
  o.fut=MF_FUTUR.slice();o.d3=MF_FUTUR.filter(t=>MF_3D[t]&&MF_3D[t].length===3);
  o.isF=[mfIsFutur('goutte'),mfIsFutur('nuit')];
  return JSON.stringify(o);})()`,ctx));
A(f.fut.join(',')==='habitacle,holo,planvivant,goutte','interfaces du futur : '+f.fut.join(', '));
A(f.isF[0]===true&&f.isF[1]===false,'mfIsFutur : Goutte oui, Nuit non');
A(f.d3.length===4,'fond et sol de la vue 3D pour les 4 (MF_3D)');
f.fut.forEach(t=>{
  const sel='html body[data-theme="'+t+'"]';
  A(f.css.includes(sel+'{--bg:')&&f.css.includes(sel+' #vpwrap::after{'),t+' : couleurs + voile de la vue');
});
const voiles=[...f.css.matchAll(/#vpwrap::(?:after|before)\{([^}]*)\}/g)].map(m=>m[1]);
A(voiles.length>=4&&voiles.every(v=>/pointer-events:none/.test(v)),'voiles de la vue jamais cliquables ('+voiles.length+')');
A((f.css.match(/infinite/g)||[]).length===1&&/animation:mfGoutte 9s ease-in-out infinite/.test(f.css),'une seule animation sans fin : les gouttes ouvertes');
A(/@media \(prefers-reduced-motion:reduce\)/.test(f.css),'moins de mouvement si l’ordinateur le demande');
A(/rotateY\(9deg\)/.test(f.css)&&f.css.includes('#treeOverlay:hover,html body[data-theme="habitacle"] #treeOverlay:focus-within{transform:none}'),'Habitacle : arbre incliné, redressé au survol / à la frappe');
A(f.ec.nuit===null&&f.ec.clair===null,'arêtes : couleurs d’origine hors interfaces du futur');
const lum=c=>0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
A(f.fut.every(t=>Array.isArray(f.ec[t])&&f.ec[t].length===2&&f.ec[t].every(c=>c.length===3&&c.every(x=>x>=0&&x<=1))&&lum(f.ec[t][0])<0.35&&lum(f.ec[t][0])<lum(f.ec[t][1])),
  'arêtes teintées : vives foncées (lisibles sur une pièce claire), tangentes plus claires');
const mep=fs.readFileSync(path.join(ROOT,'src','98-mep-30-planches-cartouche.js'),'utf8');
A(['MEP_DESK','MEP_ACC_W','MEP_ACC_D'].every(k=>new RegExp('const '+k+'=\\{[^}]*habitacle:[^}]*holo:[^}]*planvivant:[^}]*goutte:').test(mep)),'espace PLAN : bureau et accent pour les 4');
A(/mfEdgeCols\(\)/.test(fs.readFileSync(path.join(ROOT,'src','20-50-aretes-affichees.js'),'utf8')),'les arêtes de la pièce lisent la teinte du thème');
A(/\{title:'Interfaces du futur'\}/.test(src),'menu 🎨 : partie « Interfaces du futur »');
// V1.1.7 : la Goutte — bulle d'actions près de la souris (97-interface-themes-goutte)
const g=JSON.parse(vm.runInContext(`(function(){const o={};
  o.plan=gtContexte({face:{kind:'plan',n:21,origine:'Découpe 2',fid:'ex_2',fnom:'Découpe 2'}});
  o.planSans=gtContexte({face:{kind:'plan',n:3,origine:'',fid:null}});
  o.cyl=gtContexte({face:{kind:'cyl',r:5,n:7,fid:null}});
  o.bspl=gtContexte({face:{kind:'',n:9}});
  o.ligne=gtContexte({edge:{kind:'line',L:110,n:6,origine:'Chanfrein'}});
  o.cercle=gtContexte({edge:{kind:'circle',r:5,closed:true,n:2}});
  o.arc=gtContexte({edge:{kind:'circle',r:8,closed:false,n:4}});
  o.rien=gtContexte({});
  o.toutes=[].concat(o.plan.actions,o.cyl.actions,o.bspl.actions,o.ligne.actions).every(k=>GT_ACT[k]&&typeof GT_ACT[k].go==='function');
  const R={left:0,top:100,right:1400,bottom:900};
  o.droite=gtPlace(500,400,330,260,R);o.gauche=gtPlace(1300,400,330,260,R);o.haut=gtPlace(500,110,330,260,R);
  o.on=gtOn();gtSetOn(false);o.off=gtOn();o.ls=mfLS('minifusion_goutte_bulle');gtSetOn(true);o.on2=gtOn();
  o.actif=gtActif(); // thème du harnais : pas la Goutte
  o.sig=typeof gtSig()==='string';
  return JSON.stringify(o);})()`,ctx));
A(g.plan.actions.join(',')==='esquisse,deplacer,coque,depouille,coter,modifier'&&g.plan.titre==='Face 21'&&g.plan.detail==='face plane · Découpe 2'&&g.plan.fnom==='Découpe 2','Goutte : face plane → Esquisse ici, Déplacer, Évider, Dépouille, Coter, Modifier « Découpe 2 »');
A(g.planSans.actions.indexOf('modifier')<0,'Goutte : pas de « Modifier » sans fonction créatrice connue');
A(g.cyl.actions.join(',')==='fileter,deplacer,coter'&&g.cyl.detail==='cylindre Ø10'&&/cylindrique/.test(g.cyl.titre),'Goutte : cylindre → Fileter, Déplacer, Coter (Ø10)');
A(g.bspl.actions.join(',')==='deplacer,coque,coter','Goutte : face courbe → Déplacer, Évider, Coter');
A(g.ligne.actions.join(',')==='conge,chanfrein,coter'&&g.ligne.detail==='droite · 110 mm · Chanfrein','Goutte : arête droite → Congé, Chanfrein, Coter (110 mm)');
A(g.cercle.detail==='cercle Ø10'&&g.arc.detail==='arc R8','Goutte : cercle Ø10, arc R8');
A(g.rien===null,'Goutte : rien sous le clic → pas de bulle');
A(g.toutes,'Goutte : chaque action proposée a sa commande');
A(g.droite.x===584&&g.gauche.x===1300-84-330&&g.haut.y===108,'Goutte : à droite du curseur, à gauche au bord, jamais hors de la vue');
A(g.on===true&&g.off===false&&g.ls==='0'&&g.on2===true,'Goutte : « Ne plus montrer » la coupe, le menu 🎨 la remet');
A(g.actif===false&&g.sig,'Goutte : muette hors du thème Goutte');
const gsrc=fs.readFileSync(path.join(ROOT,'src','97-interface-themes-goutte.js'),'utf8');
A(/mfPickForce=F;\s*try\{wirePick\._up\(fake\);\}finally\{mfPickForce=null;\}/.test(gsrc),'Goutte : le clic d’origine est rejoué dans l’outil (comme le clic long), le forçage toujours relâché');
A(/gtCacher\(\)/.test(src)&&/gtSetOn\(!gtOn\(\)\)/.test(src),'Goutte : fermée au changement de thème / d’espace ; bulle à cocher dans le menu 🎨');
// V1.1.8 : la Goutte disposée comme sa maquette (97-interface-themes-goutte-disposition) — tige, sans ruban
const d=JSON.parse(vm.runInContext(`(function(){const o={};
  const st=(kind,o2)=>({kind,o:o2,id:'x'});
  o.det=[gtTigeDetail(st('feature',{type:'extrude',distance:30,op:'add'})),gtTigeDetail(st('feature',{type:'extrude',distance:-6,op:'cut'})),
    gtTigeDetail(st('feature',{type:'hole',d:9,end:'through'})),gtTigeDetail(st('feature',{type:'hole',d:5.5,end:'blind',depth:12})),
    gtTigeDetail(st('feature',{type:'xfillet',chamfer:true,edges:[{}]})),gtTigeDetail(st('feature',{type:'xfillet',edges:[{},{},{}]})),
    gtTigeDetail(st('sketch',{name:'Esquisse 1'})),gtTigeDetail(st('feature',{type:'revolve',angle:360})),gtTigeDetail(st('feature',{type:'import'}))];
  o.val=[gtValeur({type:'extrude',distance:-6,op:'cut'}),gtValeur({type:'extrude',distance:25,op:'add'}),gtValeur({type:'extrude',distance:10,upto:{f:1}}),
    gtValeur({type:'hole',d:9}),gtValeur({type:'xfillet',edges:[]}),gtValeur({type:'extrude',distance:8,expr:{distance:'ep*2'}})];
  let cap=null;const hd=document.head,old=hd.appendChild,gid=document.getElementById;
  document.getElementById=()=>null;hd.appendChild=n=>{cap=n;return n;};
  try{gtLayCss();}finally{document.getElementById=gid;hd.appendChild=old;}
  o.css=(cap&&cap.textContent)||'';
  o.fn=[typeof gtOutils,typeof gtGroupes,typeof gtRien,typeof gtLayCao,typeof tlbVert,typeof gtPoser].join(',');
  return JSON.stringify(o);})()`,ctx));
A(d.det.join('|')==='30 mm|découpe 6 mm|Ø9 débouchant|Ø5,5 × 12|chanfrein · 1 arête|congé · 3 arêtes|esquisse|360°|','Goutte, tige : nom et valeur de chaque étape (« découpe 6 mm », « Ø9 débouchant »…) : '+d.det.join(' | '));
A(d.val[0].l==='Profondeur'&&d.val[0].v===6&&d.val[0].k==='distance'&&d.val[1].l==='Hauteur'&&d.val[2]===null&&d.val[3].l==='Diamètre'&&d.val[4]===null&&d.val[5].fx===true,
  'Goutte : la valeur de la fonction créatrice dans la bulle (profondeur d’une découpe, Ø d’un perçage ; rien « jusqu’à une face » ; formule ƒx non écrasée)');
const C0='html body.ui-modern.gt-lay[data-theme="goutte"]:not(.mf-mobile)[data-ws="cao"]:not(.mf-sk):not([data-asm="1"])';
A(d.css.includes(C0+' #mfRibbon,'+C0+' #mfBrTabs{display:none!important}'),'Goutte : plus de ruban en CAO (hors esquisse, assemblage, téléphone) — FAO et PLAN le gardent');
A(d.css.includes(C0+' #mfTl .tlbR{order:4;flex:0 1 auto;min-height:0;flex-direction:column-reverse'),'Goutte : l’historique en tige verticale, la plus ancienne en bas');
A(d.css.includes(C0+':not(.gt-arbre) #treeWrap{display:none!important}')&&d.css.includes(C0+'.gt-arbre #mfTl{display:none!important}'),'Goutte : bascule Tige · Arbre');
A(/position:absolute;left:50%;top:50%;transform:translate\(-50%,-50%\)/.test(d.css),'Goutte : espaces en galets au milieu du bandeau');
A(!/infinite/.test(d.css),'Goutte : la disposition n’ajoute aucune animation sans fin');
A(/#mfTl\{[^}]*pointer-events:none/.test(d.css)&&/#mfTl>\*\{pointer-events:auto\}/.test(d.css),'Goutte : le vide autour de la tige laisse passer les clics vers la pièce');
A(d.fn==='function,function,function,function,function,function','Goutte : goutte de toutes les commandes, clic dans le vide, tige verticale (fonctions présentes)');
const tl=fs.readFileSync(path.join(ROOT,'src','41-bandeau-timeline.js'),'utf8');
A(/function tlbGapAt\(x,y\)/.test(tl)&&/D\.gap=tlbGapAt\(e\.clientX,e\.clientY\)/.test(tl)&&/y0:e\.clientY/.test(tl),'tige : glisser une fonction ou la pousse vers le haut / le bas');
A(/gtLaySync\(mfBuilt\)/.test(src),'Goutte : la disposition suit le thème');
A(/tige\?'':'mfTl'/.test(fs.readFileSync(path.join(ROOT,'src','93-piece-propose.js'),'utf8')),'la pièce qui propose : la tige compte comme l’arbre (la bande reste en bas)');
// V1.1.10 : l'Habitacle disposé comme sa maquette (97-interface-themes-habitacle) — visière, écrans, frise, jauge, gyroscope
const h=JSON.parse(vm.runInContext(`(function(){const o={};
  o.m=[hbMesure([{v:1000,rho:7.85,mat:'Acier'}],2000),hbMesure([{v:2000,rho:0,mat:''}],0),hbMesure([{v:1000,rho:7.85,mat:'Acier'},{v:1000,rho:2.7,mat:'Alu'}],1000),hbMesure([],0)];
  o.on=[mfMaquetteOn('habitacle'),mfMaquetteOn('nuit'),mfMaquetteOn('goutte')];
  try{mfMaquetteSet('habitacle',false);}catch(e){}
  o.off=[mfMaquetteOn('habitacle'),mfLS('minifusion_maquette_habitacle')];
  try{mfMaquetteSet('habitacle',true);}catch(e){}
  o.on2=mfMaquetteOn('habitacle');
  let cap=null;const hd=document.head,old=hd.appendChild,gid=document.getElementById;
  document.getElementById=()=>null;hd.appendChild=n=>{cap=n;return n;};
  try{hbCss();}finally{document.getElementById=gid;hd.appendChild=old;}
  o.css=(cap&&cap.textContent)||'';
  o.fn=[typeof hbSync,typeof hbActif,typeof hbMasseMaj,typeof hbEtatMaj,typeof hbHudMaj].join(',');
  return JSON.stringify(o);})()`,ctx));
const m0=h.m[0],m1=h.m[1],m2=h.m[2];
A(Math.abs(m0.g-7.85)<1e-9&&m0.cm3===1&&m0.mat==='Acier'&&m0.rempli===0.5,'Habitacle, jauge : masse, volume, matière et remplissage de la boîte (1 cm³ d’acier = 7,85 g, 50 %)');
A(Math.abs(m1.g-5.4)<1e-9&&m1.mat==='alu par défaut'&&m1.rempli===0&&m1.alu===true,'Habitacle, jauge : un corps sans matière compte en aluminium, et le dit');
A(m2.mat==='2 matières'&&m2.rempli===1&&h.m[3].g===0&&h.m[3].mat==='','Habitacle, jauge : plusieurs matières, remplissage borné à 100 %, pièce vide = rien');
A(h.on.join()==='true,false,false'&&h.off[0]===false&&h.off[1]==='0'&&h.on2===true,'Habitacle : disposition de la maquette par défaut, 🎨 › « Disposition de la maquette » la coupe puis la remet');
const H0='html body.ui-modern.mq-lay[data-theme="habitacle"]:not(.mf-mobile)',HC=H0+'[data-ws="cao"]:not(.mf-sk):not([data-asm="1"])';
A(h.css.includes(H0+' #mfRibbon{width:min(1240px')&&h.css.includes(H0+' #mfRibbon .mfRb{width:40px')&&h.css.includes(H0+' #mfRibbon .mfGrpT::after{content:"▾"'),'Habitacle : visière centrée, commandes en pods, ▾ garde la liste complète de chaque groupe');
A(h.css.includes(HC+' #treeOverlay{transform:perspective(1100px) rotateY(16deg)')&&h.css.includes(HC+' #propsWrap>.right>.panel{transform:perspective(1100px) rotateY(-14deg)')&&h.css.includes('content:"HISTORIQUE"'),'Habitacle : écrans inclinés HISTORIQUE à gauche, RÉGLAGES à droite (redressés au survol)');
A(h.css.includes(HC+' #mfTl{left:calc(50% - var(--mfPropsW,0px) / 2);right:auto;transform:translateX(-50%)')&&h.css.includes(HC+' #mfCube{top:auto!important;bottom:16px;right:calc(22px + var(--mfPropsW,0px))!important'),'Habitacle : frise en bas au milieu, gyroscope en bas à droite qui suit le panneau des réglages');
A(/#hbMasse\{display:flex;[^}]*pointer-events:none/.test(h.css)&&/#hbHud\{[^}]*pointer-events:none/.test(h.css)&&/#hbEtat\{display:flex;[^}]*pointer-events:none/.test(h.css),'Habitacle : jauge, état et lecture sous le curseur ne prennent aucun clic');
A(!/infinite/.test(h.css),'Habitacle : la disposition n’ajoute aucune animation sans fin');
A(h.fn==='function,function,function,function,function','Habitacle : jauge de masse, état, lecture sous le curseur (fonctions présentes)');
A(/mfMaquetteSync\(mfBuilt\)/.test(src)&&/Disposition de la maquette/.test(src)&&/mfMaquetteSet\(cur,!mfMaquetteOn\(cur\)\)/.test(src),'Habitacle : la disposition suit le thème ; case dans le menu 🎨');
// V1.1.11 : le Plan vivant disposé comme sa maquette (97-interface-themes-planvivant) — règle trace-formes, cote de chaîne, cartouche, annotation
const p=JSON.parse(vm.runInContext(`(function(){const o={};
  const st=(kind,o2,id)=>({kind,o:o2,id:id||'x'});
  o.c=[pvCourt(st('feature',{type:'extrude',distance:30,op:'add',name:'Extrusion Esquisse 1 30mm'})),pvCourt(st('feature',{type:'extrude',distance:-6,op:'cut',name:'Découpe Esquisse 2 (face) -6mm'})),
    pvCourt(st('feature',{type:'hole',d:9,end:'through',name:'Perçage (4)'})),pvCourt(st('feature',{type:'xfillet',chamfer:true,edges:[{}],name:'Chanfrein exact (1 arête(s))'})),
    pvCourt(st('feature',{type:'extrude',distance:12,op:'cut',name:'Poche centrale'})),pvCourt(st('sketch',{name:'Esquisse 2 (face)'}))];
  o.n=pvNomenclature([st('sketch',{name:'Esquisse 1'},'s1'),st('feature',{type:'extrude',distance:25,op:'add',name:'Extrusion Esquisse 1 25mm'},'f1'),
    st('feature',{type:'extrude',distance:-12,op:'cut',name:'Poche'},'f2'),st('feature',{type:'hole',d:10,end:'through',name:'Perçage'},'f3')],'f2',new Set(['f3']));
  o.on=[mfMaquetteOn('planvivant'),mfMaquetteOn('holo')];
  let cap=null;const hd=document.head,old=hd.appendChild,gid=document.getElementById;
  document.getElementById=()=>null;hd.appendChild=n=>{cap=n;return n;};
  try{pvCss();}finally{document.getElementById=gid;hd.appendChild=old;}
  o.css=(cap&&cap.textContent)||'';
  o.fn=[typeof pvSync,typeof pvActif,typeof pvFriseHabille,typeof pvCartMaj,typeof pvNoteMontrer,typeof pvPied].join(',');
  return JSON.stringify(o);})()`,ctx));
const pc=p.c.map(k=>k.nom+' '+k.val).join(' | ');
A(pc==='Extrusion 30 | Découpe 6 | Perçage Ø9 | Chanfrein 1 arête | Poche centrale 12 | Esquisse 2 ','Plan vivant : nom court et valeur de chaque cote, comme sur un plan (un nom donné par l’utilisateur est gardé) : '+pc);
A(p.n.length===3&&p.n.map(x=>x.rep+':'+x.nom+':'+x.reglage).join(',')==='1:Extrusion:25 mm,2:Poche:12 mm,3:Perçage:Ø10 débouchant'&&p.n[1].sel&&p.n[2].off&&!p.n[0].sel,
  'Plan vivant, cartouche : nomenclature REP · FONCTION · RÉGLAGE sans les esquisses, ligne choisie et ligne non rejouée : '+p.n.map(x=>x.rep+':'+x.nom+':'+x.reglage).join(','));
A(p.on.join()==='true,true','Plan vivant (et Table holographique, V1.1.12) : disposition de la maquette par défaut');
const P0='html body.ui-modern.mq-lay[data-theme="planvivant"]:not(.mf-mobile)',PC=P0+'[data-ws="cao"]:not(.mf-sk):not([data-asm="1"])';
A(p.css.includes(P0+' #mfRibbon{position:relative;width:min(1480px')&&/transform:rotate\(-\.8deg\)/.test(p.css)&&p.css.includes(P0+' #mfRibbon::after{content:"";position:absolute;left:14px;right:14px;bottom:0;height:12px;pointer-events:none'),'Plan vivant : le ruban en règle trace-formes de biais, graduée, partout');
A(p.css.includes(PC+' .topbar .mfWs{display:none!important}')&&/#pvCart \.pvTp button\.on\{[^}]*rotate\(-5deg\)/.test(p.css),'Plan vivant : en CAO, les espaces deviennent des tampons du cartouche (le bandeau les garde ailleurs)');
A(p.css.includes(PC+' #mfTl .tlbS{flex:1 1 0')&&p.css.includes(PC+' #mfTl::before{content:"FRISE DES FONCTIONS — COTE DE CHAÎNE"'),'Plan vivant : la frise en cote de chaîne');
A(p.css.includes(PC+' #pvCart{display:grid;position:absolute;right:calc(18px + var(--mfPropsW,0px))')&&p.css.includes(PC+' #treeOverlay{max-height:calc(100% - 150px)!important}'),'Plan vivant : cartouche en bas à droite (suit le panneau des réglages), l’arbre s’arrête au-dessus de la frise');
A(/#pvRefs\{[^}]*pointer-events:none/.test(p.css)&&/#pvNote\{[^}]*pointer-events:none/.test(p.css)&&!/infinite/.test(p.css),'Plan vivant : repères et ligne de rappel ne prennent aucun clic ; aucune animation sans fin');
A(p.fn==='function,function,function,function,function,function','Plan vivant : cotes, cartouche, annotation vivante (fonctions présentes)');
A(/pvFriseHabille\(R,S\)/.test(gsrc)&&/MF_MAQUETTE=\['habitacle','planvivant'[,\]]/.test(fs.readFileSync(path.join(ROOT,'src','97-interface-themes-futur.js'),'utf8')),'Plan vivant : la frise est habillée à chaque rendu de la timeline ; case 🎨 de la disposition');
const pvsrc=fs.readFileSync(path.join(ROOT,'src','97-interface-themes-planvivant.js'),'utf8');
A(/c3FeatSet\(f,V\.k,v,/.test(pvsrc)&&/e\.stopPropagation\(\);\s*if\(e\.key==='Escape'\)/.test(pvsrc),'Plan vivant : la valeur de l’annotation passe par c3FeatSet (Ctrl+Z), les touches tapées ne lancent aucun raccourci');
// V1.1.12 : la Table holographique disposée comme sa maquette (97-interface-themes-holo) — table, espaces autour, arc des commandes, pile, cadran
const t=JSON.parse(vm.runInContext(`(function(){const o={};
  const G=tbGeom(1600,900);o.G=G;
  o.arc=tbArcPos(7,G);o.arc1=tbArcPos(1,G);
  o.ws=tbWsPos(G);
  o.dial=[tbDialMax(6),tbDialMax(30),tbDialAngle(0,15),tbDialAngle(15,15),tbDialAngle(7.5,15),Math.round(tbDialValeur(0,20)*1000)/1000,tbDialValeur(-90,20),tbDialValeur(90,20)];
  o.ouverte=[tbFenetreOuverte({id:'zz'})];
  let cap=null;const hd=document.head,old=hd.appendChild,gid=document.getElementById;
  document.getElementById=()=>null;hd.appendChild=n=>{cap=n;return n;};
  try{tbCss();}finally{document.getElementById=gid;hd.appendChild=old;}
  o.css=(cap&&cap.textContent)||'';
  o.fn=[typeof tbSync,typeof tbActif,typeof tbTableMaj,typeof tbArcMaj,typeof tbHistHabille,typeof tbDialMaj,typeof tbArbre].join(',');
  return JSON.stringify(o);})()`,ctx));
A(t.G.rx===560&&Math.abs(t.G.ry-106.4)<1e-9&&Math.abs(t.G.cy-(900-106.4*1.5-42))<1e-9,'Table : table centrée en bas, rayons bornés (560 × 106 dans une vue de 1600 × 900)');
const a0=t.arc[0],a6=t.arc[6],a3=t.arc[3];
A(a0.x<a3.x&&a3.x<a6.x&&Math.abs(a3.x-800)<1e-6&&a3.y>a0.y&&a3.k>a0.k&&a3.o===1&&Math.abs(t.arc1[0].x-800)<1e-6,'Table : commandes sur l’arc avant, de gauche à droite, la plus grosse au milieu');
const wsm=Object.fromEntries(t.ws.map(w=>[w.k,w]));
A(Math.abs(wsm.cao.x-800)<1e-6&&wsm.cao.y>t.G.cy&&wsm.fao.x<t.G.cx&&wsm.rendu.x>t.G.cx&&wsm.plan.y<t.G.cy&&wsm.cao.s>wsm.plan.s&&wsm.cao.o>wsm.plan.o,'Table : CAO devant, FAO à gauche, PLAN au fond (plus petit, plus pâle), RENDU à droite');
A(t.dial.join()==='15,60,-70,70,0,10,0,20','Table, cadran : bornes (0 → 2 × la valeur, arrondi à 5), angle ↔ valeur, butées : '+t.dial.join());
A(t.ouverte[0]===false,'Table : cadran réglable quand la fonction n’est pas ouverte dans sa fenêtre');
const T0='html body.ui-modern.mq-lay[data-theme="holo"]:not(.mf-mobile)',TC=T0+'[data-ws="cao"]:not(.mf-sk):not([data-asm="1"])';
A(t.css.includes(TC+' #mfRibbon,'+TC+' #mfBrTabs{display:none!important}')&&t.css.includes(TC+' .topbar .mfWs{display:none!important}'),'Table : plus de ruban ni d’espaces dans le bandeau en CAO (ils sont sur la table)');
A(t.css.includes(TC+' #mfTl .tlbR{order:4;flex:0 1 auto;min-height:0;flex-direction:column-reverse')&&t.css.includes(TC+' #mfTl::before{content:"HISTOIRE DE LA PIÈCE"')&&/border-radius:0 0 55px 55px \/ 0 0 12px 12px/.test(t.css),'Table : l’histoire de la pièce en pile de tranches, la plus ancienne en bas');
A(t.css.includes(TC+':not(.tb-arbre) #treeWrap{display:none!important}')&&t.css.includes(TC+'.tb-arbre #mfTl{display:none!important}'),'Table : bascule Histoire · Arbre');
A(/#tbDial\{[^}]*right:calc\(24px \+ var\(--mfPropsW,0px\)\)/.test(t.css)&&t.css.includes(TC+' #tbTable{display:block;position:absolute;inset:0;pointer-events:none'),'Table : le cadran suit le panneau des réglages ; la table ne prend aucun clic');
A(!/infinite/.test(t.css),'Table : la disposition n’ajoute aucune animation sans fin (l’anneau ne tourne pas)');
A(t.fn==='function,function,function,function,function,function,function','Table : table, arc, pile, cadran, bascule (fonctions présentes)');
const tbsrc=fs.readFileSync(path.join(ROOT,'src','97-interface-themes-holo.js'),'utf8');
A(/tbHistHabille\(R,S\)/.test(gsrc)&&/MF_MAQUETTE=\['habitacle','planvivant','holo'\]/.test(fs.readFileSync(path.join(ROOT,'src','97-interface-themes-futur.js'),'utf8'))&&/c3FeatSet\(f,V\.k,v,/.test(tbsrc)&&/if\(tbFenetreOuverte\(f\)\)\{err\.textContent/.test(tbsrc),
  'Table : pile habillée à chaque rendu de la timeline ; cadran par c3FeatSet (Ctrl+Z), jamais pendant la fenêtre de la fonction');
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');process.exit(ko?1:0);
