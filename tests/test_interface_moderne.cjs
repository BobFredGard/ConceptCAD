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
console.log(ko?'\n*** '+ko+' PROBLEME(S) ***':'\n*** TOUT PASSE ***');process.exit(ko?1:0);
