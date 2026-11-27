/* ---------- La Goutte : la bulle d'actions près de la souris (V1.1.7) ----------
   Fred, 27/11, après les quatre interfaces du futur en thèmes (V1.1.6) : « La Goutte » — la
   première à recevoir son idée propre, celle de la maquette : pas de barre à parcourir, une
   goutte de verre qui apparaît là où l'on vient de cliquer, avec ce qu'on peut faire À CET
   ENDROIT.
   • Thème Goutte, espace CAO, interface d'ordinateur : un clic simple sur UNE face ou UNE arête
     de la pièce (hors esquisse, hors outil en cours) fait apparaître la goutte à côté du curseur,
     reliée à lui par deux petites perles.
   • Ce qu'elle propose dépend de ce qui est sous le clic :
       face plane      → Esquisse ici · Déplacer la face · Évider (coque) · Dépouille · Coter
       face cylindrique→ Fileter · Déplacer la face · Coter
       autre face      → Déplacer la face · Évider (coque) · Coter
       arête           → Congé · Chanfrein · Coter
     et, pour une face, « Modifier « … » » : la fonction qui l'a créée s'ouvre comme au
     double-clic dans la timeline (tlbDbl).
   • Chaque action lance la commande habituelle (même bouton, même code), puis REJOUE le clic
     d'origine dans l'outil qui vient de s'ouvrir, comme la liste du clic long (wirePick._up +
     mfPickForce, 90-15) : le congé démarre avec l'arête déjà prise, le déplacement avec la face…
     Rien de nouveau dans le document : une goutte n'est qu'un raccourci.
   • Elle disparaît au moindre geste ailleurs : clic hors d'elle, molette, touche du clavier,
     changement d'espace ou de thème. Elle ondule doucement tant qu'elle est ouverte (rien si
     l'ordinateur demande moins de mouvement), et ne coûte rien fermée.
   • « Ne plus montrer » la coupe ; 🎨 › « Bulle d'actions » (thème Goutte) la remet
     (localStorage minifusion_goutte_bulle). */
let gtBulle=null;   // {el, perles, cx, cy, force, ctx}
let gtAvant='';     // empreinte de la sélection à l'appui (la bulle ne vient que si le clic l'a changée)
let gtAppui=null;   // position de l'appui sur la vue
function gtOn(){return (typeof mfLS==='function'?mfLS('minifusion_goutte_bulle'):null)!=='0';}
function gtSetOn(on){try{mfLS('minifusion_goutte_bulle',on?'1':'0');}catch(e){}if(!on)gtCacher();try{gtLaySync(true);}catch(e){}} // V1.1.8 : la disposition suit la bulle
function gtActif(){
  try{
    const b=document.body;
    if(b.getAttribute('data-theme')!=='goutte'||!gtOn())return false;
    if(!b.classList.contains('ui-modern')||b.classList.contains('mf-mobile'))return false;
    if((b.getAttribute('data-ws')||'cao')!=='cao')return false;
    if(typeof skEdit!=='undefined'&&skEdit)return false;
    if(typeof asmMode!=='undefined'&&asmMode==='asm')return false;
  }catch(e){return false;}
  return !gtOutilOuvert();
}
// V1.1.13 : FAO et assemblage — pas de bulle sur les faces, mais le clic dans le vide donne les commandes de l'espace
function gtVideAilleurs(){
  try{
    if(!gtOn()||typeof gtLayOn!=='function'||!gtLayOn())return false;
    const e=typeof mfEspace==='function'?mfEspace():'cao';
    return (e==='fao'||e==='asm')&&!gtOutilOuvert();
  }catch(e){return false;}
}
// un outil attend déjà un clic sur la pièce : la goutte se tait
function gtOutilOuvert(){
  const T=[
    ()=>typeof filMode!=='undefined'&&filMode,()=>typeof filModeX!=='undefined'&&filModeX,
    ()=>typeof mvMode!=='undefined'&&mvMode,()=>typeof draftMode!=='undefined'&&draftMode,
    ()=>typeof coqueMode!=='undefined'&&coqueMode,()=>typeof splitMode!=='undefined'&&splitMode,
    ()=>typeof c3Tool!=='undefined'&&c3Tool,()=>typeof hnPick!=='undefined'&&hnPick,
    ()=>typeof holeFacePick!=='undefined'&&holeFacePick,()=>typeof threadPick!=='undefined'&&threadPick,
    ()=>typeof parMesPick!=='undefined'&&parMesPick,()=>typeof cgMode!=='undefined'&&cgMode,
    ()=>typeof extPickFace!=='undefined'&&extPickFace,()=>typeof pgPick!=='undefined'&&pgPick,
    ()=>typeof bmPick!=='undefined'&&bmPick,()=>typeof skRedef!=='undefined'&&skRedef,
    ()=>typeof faoChainMode!=='undefined'&&faoChainMode,()=>typeof faoPlanePick!=='undefined'&&faoPlanePick
  ];
  return T.some(f=>{try{return !!f();}catch(e){return false;}});
}
function gtSig(){
  try{
    const f=(selFaces||[]).map(s=>(s.mesh&&s.mesh.uuid)+':'+s.faceIndex).join(',');
    const a=(selEdges||[]).map(s=>{const P=s.P||[],p=P[0]||[],q=P[P.length-1]||[];return p.join('/')+'>'+q.join('/');}).join(',');
    return f+'|'+a;
  }catch(e){return '';}
}
const gtR=x=>(+x).toFixed(Math.abs(x-Math.round(x))<0.005?0:2).replace('.',',');
// Ce qui est sous le clic → titre, détail, actions. Pur : testable sans vue (tests/test_goutte.cjs).
// d = {face:{kind:'plan'|'cyl'|…, r, n, origine, fid, fnom}} ou {edge:{kind:'line'|'circle'|'curve', L, r, closed, n, origine}}
function gtContexte(d){
  if(d&&d.face){
    const F=d.face,A=[];
    let t='Face'+(F.n?' '+F.n:''),s;
    if(F.kind==='plan'){s='face plane';A.push('esquisse','deplacer','coque','depouille','coter');}
    else if(F.kind==='cyl'){s='cylindre Ø'+gtR(2*F.r);t='Face cylindrique'+(F.n?' '+F.n:'');A.push('fileter','deplacer','coter');}
    else{s='face courbe';A.push('deplacer','coque','coter');}
    if(F.origine)s+=' · '+F.origine;
    if(F.fid)A.push('modifier');
    return {kind:'face',titre:t,detail:s,actions:A,fnom:F.fnom||''};
  }
  if(d&&d.edge){
    const E=d.edge;
    const s=E.kind==='line'?('droite · '+gtR(E.L)+' mm'):E.kind==='circle'?((E.closed?'cercle Ø':'arc R')+gtR(E.closed?2*E.r:E.r)):'courbe';
    return {kind:'edge',titre:'Arête'+(E.n?' '+E.n:''),detail:s+(E.origine?' · '+E.origine:''),actions:['conge','chanfrein','coter'],fnom:''};
  }
  return null;
}
// Les actions : libellé, commande (bouton d'origine ou fonction) et outil attendu pour rejouer le clic
const GT_ACT={
  esquisse:{l:'Esquisse ici',go:()=>mfClick('btnSketch')},
  deplacer:{l:'Déplacer la face',go:()=>mfClick('btnMoveFace'),outil:()=>typeof mvMode!=='undefined'&&mvMode},
  coque:{l:'Évider (coque)',go:()=>mfClick('btnCoque'),outil:()=>typeof coqueMode!=='undefined'&&coqueMode},
  depouille:{l:'Dépouille',go:()=>mfClick('btnDraft'),outil:()=>typeof draftMode!=='undefined'&&draftMode},
  coter:{l:'Coter',go:()=>{if(typeof c3ToolStart==='function')c3ToolStart();},outil:()=>typeof c3Tool!=='undefined'&&c3Tool},
  fileter:{l:'Fileter',go:()=>mfClick('btnThread')},
  conge:{l:'Congé',go:()=>mfClick('btnFillet'),outil:()=>(typeof filModeX!=='undefined'&&filModeX)||(typeof filMode!=='undefined'&&filMode)},
  chanfrein:{l:'Chanfrein',go:()=>mfClick('btnChamfer'),outil:()=>typeof filModeX!=='undefined'&&filModeX},
  modifier:{l:'Modifier',go:B=>gtModifier(B)}
};
function gtModifier(B){
  const f=B&&B.fid&&(doc.features||[]).find(x=>x.id===B.fid);if(!f)return;
  try{tlbDbl({kind:'feature',id:f.id,o:f});}catch(e){try{sel={kind:'feature',id:f.id};renderTree();renderProps();}catch(e2){}}
}
// Place la goutte à côté du curseur, dans la vue ; à gauche si elle déborde à droite. Pur.
function gtPlace(cx,cy,w,h,R){
  let x=cx+84,y=cy-h*0.55;
  if(x+w>R.right-8)x=cx-84-w;
  x=Math.max(R.left+8,Math.min(x,R.right-w-8));
  y=Math.max(R.top+8,Math.min(y,R.bottom-h-8));
  return {x,y};
}
function gtCss(){
  if(document.getElementById('gtCss'))return;
  const st=document.createElement('style');st.id='gtCss';
  st.textContent=[
    '#gtBulle{position:fixed;z-index:5100;width:330px;box-sizing:border-box;padding:30px 32px 22px;color:#f3ede4;font-family:"Segoe UI Variable Display","Segoe UI Variable","SF Pro Rounded","Segoe UI",system-ui,sans-serif;'+
      'background:radial-gradient(120% 100% at 30% 15%,rgba(255,250,242,.22),rgba(255,250,242,.07) 60%),rgba(38,31,35,.74);border:1px solid rgba(255,255,255,.26);'+
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 30px 60px rgba(0,0,0,.45);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);'+
      'border-radius:72px 88px 80px 96px / 84px 72px 96px 80px;animation:gtNait .28s cubic-bezier(.3,1.4,.5,1),gtOndule 9s ease-in-out .28s infinite}',
    '#gtBulle .gtT{font-weight:600;font-size:17px;line-height:1.2;color:#fff}',
    '#gtBulle .gtS{font-size:12.5px;color:#d8cfc3;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#gtBulle .gtG{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:12px}',
    '#gtBulle .gtA{height:36px;padding:0 10px;border-radius:18px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#f3ede4;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#gtBulle .gtA:hover,#gtBulle .gtA:focus-visible{background:rgba(255,122,89,.32);border-color:rgba(255,154,127,.6);outline:none}',
    '#gtBulle .gtA.gtL{grid-column:1/-1}',
    '#gtBulle .gtF{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:11.5px;color:#a89f94}',
    '#gtBulle .gtF button{background:none;border:none;padding:2px 0;color:#c9b8a9;font:inherit;font-size:11.5px;cursor:pointer;text-decoration:underline}',
    '.gtPerle{position:fixed;z-index:5099;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.55),rgba(255,250,242,.18) 60%);border:1px solid rgba(255,255,255,.45);box-shadow:0 4px 10px rgba(0,0,0,.35);pointer-events:none;animation:gtNait .28s ease-out}',
    '@keyframes gtNait{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}',
    '@keyframes gtOndule{0%,100%{border-radius:72px 88px 80px 96px / 84px 72px 96px 80px}50%{border-radius:90px 74px 94px 80px / 72px 92px 80px 94px}}',
    '@media (prefers-reduced-motion:reduce){#gtBulle,.gtPerle{animation:none}}'
  ].join('\n');
  document.head.appendChild(st);
}
function gtCacher(){
  if(!gtBulle)return;
  try{gtBulle.el.remove();gtBulle.perles.forEach(p=>p.remove());}catch(e){}
  gtBulle=null;
}
// Lit la sélection que le clic vient de faire → données de gtContexte (+ ce qu'il faut pour rejouer)
function gtLireSel(cx,cy){
  const F=(selFaces||[]),E=(selEdges||[]);
  if(F.length===1&&!E.length&&!(typeof mesEtrangere!=='undefined'&&mesEtrangere)){
    const s=F[0];let I={n:0,origine:''},fid=null,fnom='';
    try{I=selFaceInfo(s.mesh,s.faceIndex);}catch(e){}
    try{fid=occFaceCreator(s.mesh,s.faceIndex,s.point);}catch(e){fid=null;}
    const f=fid&&(doc.features||[]).find(x=>x.id===fid);if(!f)fid=null;else fnom=f.name||f.id;
    const G=s.geom||{};
    let hit=null;try{hit=pick({clientX:cx,clientY:cy});}catch(e){hit=null;}
    if(hit&&(hit.object!==s.mesh))hit=null;
    return {d:{face:{kind:G.kind||'',r:G.r||0,n:I.n,origine:I.origine,fid,fnom}},force:hit?{face:hit}:null,fid};
  }
  if(E.length===1&&!F.length){
    const s=E[0],G=s.G||{};let I={n:0,origine:''};
    try{I=selAreteInfo(s.P);}catch(e){}
    const L=G.kind==='line'&&G.a&&G.b?G.a.distanceTo(G.b):0;
    return {d:{edge:{kind:G.kind||'curve',L,r:G.r||0,closed:!!G.closed,n:I.n,origine:I.origine}},force:{P:s.P},fid:null};
  }
  return null;
}
function gtMontrer(cx,cy){
  const S=gtLireSel(cx,cy);if(!S)return;
  const C=gtContexte(S.d);if(!C)return;
  gtCss();gtCacher();
  const el=document.createElement('section');el.id='gtBulle';el.setAttribute('aria-label','La goutte : actions à cet endroit');
  const t=document.createElement('div');t.className='gtT';t.textContent=C.titre;
  const s=document.createElement('div');s.className='gtS';s.textContent=C.detail;s.title=C.detail;
  const g=document.createElement('div');g.className='gtG';
  const B={el,perles:[],cx,cy,force:S.force,fid:S.fid,ctx:C};
  C.actions.forEach(k=>{
    const a=GT_ACT[k];if(!a)return;
    const b=document.createElement('button');b.type='button';b.className='gtA'+(k==='modifier'?' gtL':'');b.dataset.gt=k;
    b.textContent=k==='modifier'?'Modifier « '+C.fnom+' »':a.l;b.title=b.textContent;
    b.onclick=ev=>{ev.stopPropagation();gtAgir(B,k);};
    g.appendChild(b);
  });
  const ft=document.createElement('div');ft.className='gtF';
  const no=document.createElement('button');no.type='button';no.textContent='Ne plus montrer';
  no.onclick=ev=>{ev.stopPropagation();gtSetOn(false);try{faceEl.textContent='Bulle de la Goutte coupée — 🎨 › « Bulle d’actions » pour la remettre.';}catch(e){}};
  const esc=document.createElement('span');esc.textContent='Échap pour fermer';
  ft.appendChild(no);ft.appendChild(esc);
  el.appendChild(t);el.appendChild(s);el.appendChild(g);
  // V1.1.8 : la valeur de la fonction qui a créé la face, réglable ici (la maquette : « Profondeur 12 mm »)
  try{const f=S.fid&&(doc.features||[]).find(x=>x.id===S.fid),V=f&&typeof gtValeurRang==='function'?gtValeurRang(B,f):null;if(V)el.appendChild(V);}catch(e){}
  el.appendChild(ft);
  document.body.appendChild(el);
  // à côté du curseur, deux perles du curseur vers la goutte (97-interface-themes-goutte-disposition)
  gtPoser(B);
  gtBulle=B;
}
function gtAgir(B,k){
  const a=GT_ACT[k];if(!a)return;
  gtCacher();
  try{a.go(B);}catch(e){return;}
  if(!a.outil||!B.force)return;
  // l'outil s'ouvre (parfois après un recalcul du solide) : on rejoue le clic dès qu'il attend
  let n=0;
  const essai=()=>{
    let pret=false;try{pret=!!a.outil();}catch(e){}
    if(!pret){if(++n<25)setTimeout(essai,80);return;}
    gtRejoue(B);
  };
  setTimeout(essai,0);
}
function gtRejoue(B){
  try{
    if(typeof wirePick==='undefined'||!wirePick._up)return;
    const el=renderer.domElement;
    const fake={clientX:B.cx,clientY:B.cy,button:0,buttons:0,pointerType:'mouse',target:el,currentTarget:el,detail:1,
      ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}};
    // face : imposée seulement si son maillage est toujours affiché (sinon le clic retrouve la face sous la souris)
    let F=B.force;
    if(F&&F.face&&!(bodies||[]).some(b=>b&&b.mesh===F.face.object))F=null;
    mfPickForce=F;
    try{wirePick._up(fake);}finally{mfPickForce=null;}
  }catch(e){}
}
/* ----- la tige (V1.1.8) : l'historique pousse comme une plante ----------------------------
   Thème Goutte : le bandeau du bas devient une tige ondulée (CSS de mfFuturCss, 97-interface-
   themes-futur) ; les fonctions sont des bourgeons ronds, les esquisses des feuilles, le marqueur
   temps la pousse verte du bout. Ici : la fonction (ou l'esquisse) qui vient d'être créée éclot —
   seulement une ou deux étapes neuves d'un coup (une fonction, son esquisse) ; un fichier ouvert,
   une annulation qui en remet plusieurs, ne font rien éclore. */
let gtTigeIds=null; // étapes déjà vues dans le bandeau (null : rien vu encore)
function gtTigeNeuves(avant,ids){
  // Pur : les étapes à faire éclore — 1 ou 2 nouvelles, jamais au premier passage ni en masse
  if(!avant)return [];
  const n=ids.filter(id=>!avant.has(id));
  return n.length>=1&&n.length<=2?n:[];
}
function gtTigeSync(R,S){
  if(!R||!R.querySelectorAll)return;
  const els=[...R.querySelectorAll('.tlbS')],ids=els.map(e=>e.dataset&&e.dataset.id).filter(Boolean);
  let goutte=false;try{goutte=document.body.getAttribute('data-theme')==='goutte';}catch(e){}
  if(goutte)try{gtTigeHabille(R,S);}catch(e){} // V1.1.8 : nom et valeur de chaque étape, « + la suite »
  else if(typeof pvActif==='function'&&pvActif())try{pvFriseHabille(R,S);}catch(e){} // V1.1.11 : Plan vivant, cotes de la frise et cartouche
  else if(typeof tbActif==='function'&&tbActif())try{tbHistHabille(R,S);}catch(e){} // V1.1.12 : Table holographique, tranches et cadran
  const neuves=goutte?gtTigeNeuves(gtTigeIds,ids):[];
  gtTigeIds=new Set(ids);
  // le bandeau est refait à chaque rejeu / sélection : l'éclosion reprend où elle en était
  const now=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
  neuves.forEach(id=>gtTigeEclos.set(id,now));
  gtTigeEclos.forEach((t,id)=>{
    const dt=now-t;if(dt>GT_ECLOS_MS||!goutte){gtTigeEclos.delete(id);return;}
    const el=els.find(e=>e.dataset.id===id);if(!el)return;
    el.classList.add('gtNeuf');el.style.animationDelay=(-Math.round(dt))+'ms';
  });
}
const GT_ECLOS_MS=900;
const gtTigeEclos=new Map(); // étape → instant où elle a éclos
/* ----- écoute : au niveau du document (la vue n'existe pas encore au chargement) ----- */
(function gtEcoute(){
  try{
    const vue=e=>{try{return typeof renderer!=='undefined'&&renderer&&e.target===renderer.domElement;}catch(err){return false;}};
    document.addEventListener('pointerdown',e=>{
      if(gtBulle&&!gtBulle.el.contains(e.target))gtCacher();
      if(vue(e)){gtAppui={x:e.clientX,y:e.clientY,rien:typeof gtRien==='function'&&gtRien()};gtAvant=gtSig();}else gtAppui=null;
    },true);
    // relâcher sur la vue : le clic ordinaire a déjà sélectionné (écouteur de la vue, avant le document)
    document.addEventListener('pointerup',e=>{
      if(!vue(e)||!gtAppui||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
      if(Math.hypot(e.clientX-gtAppui.x,e.clientY-gtAppui.y)>6)return;
      if(!gtActif()&&!gtVideAilleurs())return;
      const cx=e.clientX,cy=e.clientY,avant=gtAvant,rien=gtAppui.rien;
      setTimeout(()=>{
        if(gtActif()){if(gtSig()!==avant){gtMontrer(cx,cy);return;}}
        else if(!gtVideAilleurs())return;
        // V1.1.8 : clic dans le vide, rien de sélectionné avant ni après (disposition de la maquette, sans ruban) → toutes les commandes
        // V1.1.13 : aussi en FAO et en assemblage (les commandes de l'espace)
        let vide=false;try{vide=rien&&gtLayOn()&&gtRien()&&!pick({clientX:cx,clientY:cy});}catch(err){vide=false;}
        if(vide)gtOutils(cx,cy);
      },30);
    });
    document.addEventListener('wheel',e=>{if(gtBulle&&!gtBulle.el.contains(e.target))gtCacher();},{capture:true,passive:true});
    // clavier : Échap ferme ; ailleurs que dans la goutte, toute touche ferme (Tab / Entrée y restent permis)
    document.addEventListener('keydown',e=>{if(gtBulle&&(e.key==='Escape'||(!gtBulle.el.contains(e.target)&&!/^(Shift|Control|Alt|Meta)$/.test(e.key))))gtCacher();},true);
    window.addEventListener('resize',()=>gtCacher());
    window.addEventListener('blur',()=>gtCacher());
  }catch(e){}
})();
