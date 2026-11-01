/* ---------- FILM DE CONSTRUCTION (V0.32.0) ----------
   L'historique de la pièce rejoué comme un petit film : la vue passe en plein écran (bandes
   cinéma), la caméra tourne lentement autour de la pièce FINALE, et le marqueur temps avance
   d'une fonction à la fois — chaque étape apparaît avec sa légende (n° / total, nom, nature :
   ajout vert, enlèvement rouge, modification bleue…). Carton d'ouverture et de fin.
   - Lancement : 🎬 du bandeau de timeline, ou Ctrl+K « Film de construction ».
   - Échap = arrêter · Espace = pause · ● = enregistrer en vidéo WebM (légendes incrustées :
     la vue est recopiée dans un canevas 2D JUSTE après son rendu, filmFrame() appelé par animate).
   - Rien n'est modifié : ni le document (instantané au départ, rendu tel quel à la fin ; filet
     d'annulation suspendu pendant le film, docUndoBusy), ni le marqueur,
     la caméra et la sélection, rendus tels quels à la fin. Espace CAO seulement (la FAO suit
     le solide reconstruit : on ne la promène pas dans des états intermédiaires). */
let film=null; // état du film en cours (null = aucun)
const FILM_KIND={extrude:'Extrusion',revolve:'Révolution',sweep:'Balayage',hole:'Perçage',fillet:'Congé',repeat:'Répétition',
  combine:'Combiner',xmove:'Déplacer une face',xdelface:'Supprimer une face',xdraft:'Dépouille',xshell:'Coque',xsplit:'Scinder',bmove:'Déplacer le corps',import:'Import'};
function filmKind(f){
  // [libellé, couleur] de la nature d'une fonction — mêmes couleurs que le bandeau (TLB_COL)
  let k=null;try{k=tlbSvgKey({kind:'feature',o:f});}catch(e){}
  const col=(k&&TLB_COL[k[1]])||'#64d2ff';
  let l=FILM_KIND[f.type]||'Fonction';
  if(f.type==='xfillet'){let x='';try{x=xKindOf(f);}catch(e){}l=/cham/i.test(x)?'Chanfrein':'Congé';}
  if((f.type==='extrude'||f.type==='revolve'||f.type==='sweep')&&(f.op||'add')==='cut')l='Enlèvement · '+l.toLowerCase();
  if(f.type==='combine'&&f.mode==='cut')l+=' · soustraction';
  return [l,col];
}
(function(){
  try{
    const st=document.createElement('style');st.id='filmCss';
    st.textContent=
      'body.mf-film #vpwrap>*:not(#viewport):not(#mfFilm){visibility:hidden!important}'+
      '#vpwrap:fullscreen{background:#000}'+
      '#mfFilm{position:absolute;inset:0;z-index:40;pointer-events:none;overflow:hidden;font-family:-apple-system,"SF Pro Display",Inter,"Segoe UI",sans-serif;color:#f5f5f7}'+
      '#mfFilm .bd{position:absolute;left:0;right:0;height:9%;background:#000;transition:transform .9s cubic-bezier(.6,0,.2,1)}'+
      '#mfFilm .bd.t{top:0;transform:translateY(-100%)}#mfFilm .bd.b{bottom:0;transform:translateY(100%)}'+
      '#mfFilm.on .bd{transform:none}'+
      '#mfFilm .card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:radial-gradient(closest-side,rgba(8,10,16,.82),rgba(8,10,16,.55));opacity:0;transition:opacity .7s ease}'+
      '#mfFilm .card.on{opacity:1}'+
      '#mfFilm .card .k{font-size:.78rem;letter-spacing:.34em;text-transform:uppercase;color:#98989d}'+
      '#mfFilm .card .h{font-size:2.6rem;font-weight:700;letter-spacing:-.02em;background:linear-gradient(135deg,#6cb6ff,#0a84ff 50%,#8a88ff);-webkit-background-clip:text;background-clip:text;color:transparent;text-align:center;max-width:80%}'+
      '#mfFilm .card .s{font-size:.95rem;color:#c7c7cc}'+
      '#mfFilm .cap{position:absolute;left:5%;bottom:calc(9% + 34px);display:flex;align-items:center;gap:16px;opacity:0;transform:translateY(14px);transition:opacity .45s ease,transform .45s cubic-bezier(.2,.8,.2,1)}'+
      '#mfFilm .cap.on{opacity:1;transform:none}'+
      '#mfFilm .cap .n{font-size:2.4rem;font-weight:700;font-variant-numeric:tabular-nums;line-height:1;text-shadow:0 2px 12px rgba(0,0,0,.6)}'+
      '#mfFilm .cap .n small{font-size:1rem;color:#98989d;font-weight:500}'+
      '#mfFilm .cap .bar{width:4px;height:44px;border-radius:2px}'+
      '#mfFilm .cap .t{font-size:1.25rem;font-weight:600;text-shadow:0 2px 12px rgba(0,0,0,.7)}'+
      '#mfFilm .cap .y{font-size:.82rem;letter-spacing:.12em;text-transform:uppercase;margin-top:3px}'+
      '#mfFilm .prog{position:absolute;left:5%;right:5%;bottom:calc(9% + 14px);height:3px;border-radius:2px;background:rgba(255,255,255,.14)}'+
      '#mfFilm .prog i{position:absolute;left:0;top:0;bottom:0;border-radius:2px;background:linear-gradient(90deg,#0a84ff,#8a88ff);transition:width .6s ease}'+
      '#mfFilm .prog b{position:absolute;top:-3px;width:3px;height:9px;margin-left:-1.5px;border-radius:2px;background:rgba(255,255,255,.35)}'+
      '#mfFilm .flash{position:absolute;inset:0;opacity:0;background:radial-gradient(closest-side at 50% 50%,var(--fc,#fff),transparent 75%);mix-blend-mode:screen}'+
      '#mfFilm .flash.go{animation:filmFlash .9s ease-out}'+
      '@keyframes filmFlash{0%{opacity:.38}100%{opacity:0}}'+
      '#mfFilm .ctl{position:absolute;top:calc(9% + 12px);right:16px;display:flex;gap:8px;pointer-events:auto;opacity:0;transition:opacity .3s}'+
      '#mfFilm.hover .ctl,#mfFilm.paused .ctl{opacity:1}'+
      '#mfFilm .ctl button{font-size:.8rem;padding:7px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:rgba(20,22,28,.75);color:#f5f5f7;cursor:pointer;backdrop-filter:blur(6px)}'+
      '#mfFilm .ctl button:hover{border-color:#0a84ff}'+
      '#mfFilm .ctl button.rec{border-color:rgba(255,69,58,.6)}#mfFilm .ctl button.rec.on{background:#ff453a;border-color:#ff453a}'+
      '#mfFilm .rdot{position:absolute;top:calc(9% + 18px);left:18px;display:none;align-items:center;gap:7px;font-size:.75rem;letter-spacing:.1em;color:#ff6961}'+
      '#mfFilm.recording .rdot{display:flex}#mfFilm .rdot i{width:9px;height:9px;border-radius:50%;background:#ff453a;animation:filmRec 1s steps(2) infinite}'+
      '@keyframes filmRec{50%{opacity:.2}}'+
      '#mfFilm .hint{position:absolute;top:calc(9% + 18px);left:50%;transform:translateX(-50%);font-size:.72rem;color:#8e8e93;letter-spacing:.06em;opacity:0;transition:opacity .3s}'+
      '#mfFilm.hover .hint{opacity:1}'+
      '@media(prefers-reduced-motion:reduce){#mfFilm *{transition:none!important;animation:none!important}}';
    (document.head||document.body||document.documentElement).appendChild(st);
  }catch(e){}
})();
function filmSteps(){
  // Fonctions de premier niveau, dans l'ordre du fil (les instances d'une répétition suivent
  // leur répétition, comme les crans ⏮ ◀ ▶ ⏭ du bandeau)
  return (doc.features||[]).filter(f=>!f.repeatId);
}
function filmCan(){
  if(film)return 'Film déjà en cours.';
  if(document.body.getAttribute('data-ws')&&document.body.getAttribute('data-ws')!=='cao')return 'Le film de construction se lance depuis l’espace CAO.';
  try{if(typeof skEdit!=='undefined'&&skEdit)return 'Fermez l’esquisse avant de lancer le film.';}catch(e){}
  if(!filmSteps().length)return 'Fil vide : rien à rejouer — créez une esquisse puis une extrusion.';
  return '';
}
function filmBuilt(){
  // marqueur en tête du fil : pièce vide, aucun solide exact à attendre
  try{return buildKeyUpToDate()&&(tlIdx()===0||!(typeof occtReady!=='undefined'&&occtReady)||builtEngine==='exact');}catch(e){return true;}
}
function filmSleep(ms){
  // attente qui respecte la pause et l'arrêt
  return new Promise(r=>{const F=film;let left=ms,t=performance.now();
    const tick=()=>{if(!film||film!==F||F.stop)return r();const n=performance.now();if(!F.paused)left-=n-t;t=n;if(left<=0)return r();setTimeout(tick,40);};tick();});
}
async function filmWaitBuilt(){
  const F=film,t0=performance.now();
  await new Promise(r=>setTimeout(r,30));
  while(film===F&&!F.stop&&!filmBuilt()&&performance.now()-t0<12000)await new Promise(r=>setTimeout(r,50));
}
function filmGoto(k){
  // État après les k premières fonctions (k = n : tout le fil)
  const T=film.steps;
  tlSetPtr(k<T.length?T[k]:null);
  try{rebuild();}catch(e){}
}
function filmFrameBox(){
  // Orbite calée sur la pièce FINALE : centre + distance (même calcul que viewFit, marge 35 %)
  const box=new THREE.Box3();
  bodies.forEach(b=>{if(b.visible&&!b.ghost)box.expandByObject(b.mesh);});
  if(box.isEmpty())return {c:new THREE.Vector3(),d:150,h:0};
  const c=box.getCenter(new THREE.Vector3()),sz=box.getSize(new THREE.Vector3());
  const r=(sz.length()*0.5)||50,fv=(camera.fov||45)*Math.PI/180,aspect=camera.aspect||1;
  const s=Math.max(Math.sin(fv*0.5),Math.sin(Math.atan(Math.tan(fv*0.5)*aspect)));
  return {c,d:(r/Math.max(s,0.05))*1.35,h:sz.z};
}
function filmTick(now){
  const F=film;if(!F)return;
  requestAnimationFrame(filmTick);
  const dt=Math.min(0.1,(now-(F.tPrev||now))/1000);F.tPrev=now;
  if(!F.paused)F.ang+=dt*F.speed;
  const B=F.box,el=0.42+0.08*Math.sin(F.ang*0.7); // légère houle de l'élévation
  const ce=Math.cos(el);
  controls.target.copy(B.c);
  camera.position.set(B.c.x+B.d*ce*Math.cos(F.ang),B.c.y+B.d*ce*Math.sin(F.ang),B.c.z+B.d*Math.sin(el));
  try{if(camera.view&&camera.view.enabled)camera.clearViewOffset();}catch(e){} // plein cadre : pas de décalage des panneaux
}
function filmUi(){
  const wrap=$('vpwrap');
  const d=document.createElement('div');d.id='mfFilm';
  d.innerHTML='<div class="flash"></div><div class="bd t"></div><div class="bd b"></div>'+
    '<div class="cap"><div class="n"></div><div class="bar"></div><div><div class="t"></div><div class="y"></div></div></div>'+
    '<div class="prog"><i style="width:0"></i></div>'+
    '<div class="card"><div class="k"></div><div class="h"></div><div class="s"></div></div>'+
    '<div class="rdot"><i></i>REC</div><div class="hint">Échap = arrêter · Espace = pause</div>'+
    '<div class="ctl"><button class="rec" title="Enregistrer le film en vidéo (WebM, légendes incrustées)">● Enregistrer</button><button class="pz" title="Pause (Espace)">⏸</button><button class="x" title="Arrêter (Échap)">✕ Arrêter</button></div>';
  wrap.appendChild(d);
  const q=s=>d.querySelector(s);
  const P=q('.prog');
  film.steps.forEach((f,i)=>{const b=document.createElement('b');b.style.left=((i+1)/film.steps.length*100)+'%';P.appendChild(b);});
  q('.x').onclick=()=>filmStop();
  q('.pz').onclick=()=>filmPause();
  q('.rec').onclick=()=>filmRecToggle();
  let hv=null;
  d.onpointermove=()=>{d.classList.add('hover');clearTimeout(hv);hv=setTimeout(()=>d.classList.remove('hover'),1800);};
  d.style.pointerEvents='auto'; // la vue ne tourne pas sous le film (la caméra est pilotée)
  ['pointerdown','wheel','dblclick','contextmenu'].forEach(t=>d.addEventListener(t,e=>{if(!e.target.closest('.ctl')){try{e.preventDefault();e.stopPropagation();}catch(_){}}},{passive:false}));
  return {root:d,cap:q('.cap'),n:q('.cap .n'),bar:q('.cap .bar'),t:q('.cap .t'),y:q('.cap .y'),prog:q('.prog i'),
    card:q('.card'),ck:q('.card .k'),ch:q('.card .h'),cs:q('.card .s'),flash:q('.flash'),pz:q('.pz'),rec:q('.rec')};
}
function filmCard(k,h,s){
  const U=film.ui;U.ck.textContent=k;U.ch.textContent=h;U.cs.textContent=s||'';U.card.classList.add('on');
  film.txt={card:[k,h,s||'']};
}
function filmShowStep(i){
  const U=film.ui,f=film.steps[i],n=film.steps.length,[kl,col]=filmKind(f);
  U.cap.classList.remove('on');
  setTimeout(()=>{if(!film)return;
    U.n.innerHTML=String(i+1).padStart(2,'0')+'<small> / '+String(n).padStart(2,'0')+'</small>';
    U.bar.style.background=col;U.t.textContent=f.name||kl;U.y.textContent=kl;U.y.style.color=col;
    U.cap.classList.add('on');
  },film.firstCap?0:180);
  film.firstCap=false;
  U.prog.style.width=((i+1)/n*100)+'%';
  U.flash.style.setProperty('--fc',col);U.flash.classList.remove('go');void U.flash.offsetWidth;U.flash.classList.add('go');
  film.txt={i,n,name:f.name||kl,kind:kl,col};film.flashT=performance.now();
}
async function filmPlay(){
  const why=filmCan();
  if(why){try{faceEl.textContent=why;}catch(e){}return false;}
  const T=filmSteps();
  film={steps:T,ang:-Math.PI/2.6,speed:0.22,paused:false,stop:false,firstCap:true,txt:null,
    saved:{snap:docSnap(),key:docSnapKey(),tl:tlMark,pos:camera.position.clone(),tgt:controls.target.clone(),sel:Object.assign({},sel),treeSel:(treeSel||[]).slice(),ctl:controls.enabled,msg:faceEl&&faceEl.textContent}};
  const F=film;
  F.ui=filmUi();
  document.body.classList.add('mf-film');
  controls.enabled=false;
  sel={kind:null,id:null};treeSel=[];try{refreshParts();}catch(e){} // pas de fantôme d'outil ni de surbrillance
  // plein écran demandé sans l'attendre plus de 0,8 s (certains cadres intégrés ne répondent jamais)
  try{const w=$('vpwrap');if(w.requestFullscreen&&!document.fullscreenElement)await Promise.race([w.requestFullscreen().catch(()=>{}),new Promise(r=>setTimeout(r,800))]);}catch(e){}
  F.onKey=e=>{
    if(!film)return;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();filmStop();}
    else if(e.key===' '){e.preventDefault();e.stopPropagation();filmPause();}
    else{e.stopPropagation();} // aucun raccourci de l'application pendant le film
  };
  F.onFs=()=>{if(film&&!document.fullscreenElement&&F.wasFs)filmStop();if(document.fullscreenElement)F.wasFs=true;};
  document.addEventListener('keydown',F.onKey,true);
  document.addEventListener('fullscreenchange',F.onFs);
  if(document.fullscreenElement)F.wasFs=true;
  const nm=(typeof mffName!=='undefined'&&mffName)||doc.name||'Sans titre';
  filmCard('Film de construction',nm,T.length+' fonction'+(T.length>1?'s':'')+' · '+(doc.bodies||[]).length+' corps');
  // 1) pièce finale (sous le carton) : cadre de l'orbite
  filmGoto(T.length);await filmWaitBuilt();
  if(F.stop)return filmEnd();
  F.box=filmFrameBox();
  requestAnimationFrame(t=>{F.tPrev=t;filmTick(t);});
  await new Promise(r=>setTimeout(r,60)); // (pas de rAF ici : suspendu quand la vue est cachée)
  F.ui.root.classList.add('on'); // bandes cinéma
  // 2) on repart de zéro, derrière le carton
  filmGoto(0);await filmWaitBuilt();
  await filmSleep(1900);
  if(F.stop)return filmEnd();
  F.ui.card.classList.remove('on');F.txt=null;
  await filmSleep(500);
  // 3) une fonction à la fois — rythme : ~25 s au total, 0,9 à 2,2 s par étape
  const hold=Math.max(900,Math.min(2200,25000/T.length));
  for(let k=1;k<=T.length;k++){
    if(F.stop)return filmEnd();
    filmGoto(k);await filmWaitBuilt();
    if(F.stop)return filmEnd();
    filmShowStep(k-1);
    await filmSleep(hold);
  }
  // 4) carton de fin, pièce entière qui tourne encore un peu
  await filmSleep(600);
  if(F.stop)return filmEnd();
  F.ui.cap.classList.remove('on');F.speed=0.34;
  filmCard('Terminé',nm,'construite en '+T.length+' étape'+(T.length>1?'s':'')+' · MiniFusion '+APP_VER);
  F.ui.card.style.background='radial-gradient(closest-side,rgba(8,10,16,.6),rgba(8,10,16,.2))';
  await filmSleep(3200);
  return filmEnd();
}
function filmPause(){
  if(!film)return;film.paused=!film.paused;
  film.ui.root.classList.toggle('paused',film.paused);film.ui.pz.textContent=film.paused?'▶':'⏸';
}
function filmStop(){if(film)film.stop=true;}
async function filmEnd(){
  const F=film;if(!F||F.ending)return;F.ending=true;
  let rec=null;try{rec=filmRecStop();}catch(e){}
  F.ui.root.classList.remove('on');F.ui.cap.classList.remove('on');F.ui.card.classList.remove('on');
  document.removeEventListener('keydown',F.onKey,true);
  document.removeEventListener('fullscreenchange',F.onFs);
  await new Promise(r=>setTimeout(r,450));
  film=null; // arrête filmTick
  try{if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});}catch(e){}
  try{F.ui.root.remove();}catch(e){}
  document.body.classList.remove('mf-film');
  // tout revient comme avant : marqueur, sélection, caméra
  const S=F.saved;
  tlMark=S.tl;try{tlSyncActiveBody();}catch(e){}
  // Rejouer des états intermédiaires réancre les esquisses posées sur des faces (origine et
  // points réexprimés) : le document est remis à l'identique de l'instantané du départ.
  // Les points de contrôle du rejeu (occCk) gardent les noms de faces donnés pendant ces états :
  // vidés d'abord, sinon le rejeu final renommerait les faces hôtes (Face 119 → Face 122).
  let back=false;try{if(S.snap&&!undoSame(docSnapKey(),S.key)){try{occCkClear();}catch(e){}back=docApplySnap(S.snap);}}catch(e){}
  if(!back)try{rebuild();}catch(e){}
  // Les copies d'esquisse des répétitions, réexpansées, reçoivent de nouveaux noms d'hôte
  // (Face 119 → Face 122) : simple étiquette (la face se retrouve par fonction + type + position),
  // l'étiquette et le compteur d'origine sont rendus — le document redevient « non modifié ».
  if(back)try{
    const P=JSON.parse(S.snap),byId={};(P.sketches||[]).forEach(k=>{byId[k.id]=k;});
    (doc.sketches||[]).forEach(k=>{const o=byId[k.id];
      if(o&&o.host&&k.host&&o.host.name&&o.host.feat===k.host.feat&&o.host.tag===k.host.tag)k.host.name=o.host.name;});
    if(P.entNames)doc.entNames=P.entNames;
    docBaseSync();
  }catch(e){}
  sel=S.sel;treeSel=S.treeSel;
  try{mffTitle();}catch(e){}
  camera.position.copy(S.pos);controls.target.copy(S.tgt);controls.enabled=S.ctl;controls.update();
  try{viewCenterShift();}catch(e){}
  try{renderTree();renderProps();refreshParts();}catch(e){}
  try{faceEl.textContent=rec?'🎬 Film enregistré : '+rec:(F.stop?'Film de construction arrêté.':'🎬 Fin du film de construction.');}catch(e){}
}
/* ── enregistrement vidéo : canevas 2D = vue 3D + bandes + légendes ── */
function filmRecToggle(){
  if(!film)return;
  if(film.rec){filmRecStop();return;}
  if(typeof MediaRecorder==='undefined'){try{faceEl.textContent='Enregistrement vidéo indisponible dans ce navigateur.';}catch(e){}return;}
  const gl=renderer.domElement,k=Math.min(1,1920/Math.max(1,gl.width));
  const c=document.createElement('canvas');c.width=Math.round(gl.width*k/2)*2;c.height=Math.round(gl.height*k/2)*2;
  let st=null;try{st=c.captureStream(30);}catch(e){}
  if(!st){try{faceEl.textContent='Enregistrement vidéo indisponible (captureStream).';}catch(e){}return;}
  const mt=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>{try{return MediaRecorder.isTypeSupported(t);}catch(e){return false;}})||'';
  let mr;try{mr=new MediaRecorder(st,mt?{mimeType:mt,videoBitsPerSecond:8e6}:{});}catch(e){try{faceEl.textContent='Enregistrement vidéo : '+e.message;}catch(_){}return;}
  const chunks=[];mr.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
  const nm=((typeof mffName!=='undefined'&&mffName)||doc.name||'piece').replace(/[\\/:*?"<>|]/g,'_');
  mr.onstop=()=>{try{const b=new Blob(chunks,{type:'video/webm'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=nm+' — film de construction.webm';
    document.body.appendChild(a);a.click();setTimeout(()=>{try{URL.revokeObjectURL(a.href);a.remove();}catch(e){}},4000);}catch(e){}};
  mr.start(250);
  film.rec={mr,c,ctx:c.getContext('2d'),name:nm+' — film de construction.webm'};
  film.ui.rec.classList.add('on');film.ui.rec.textContent='■ Arrêter l’enregistrement';film.ui.root.classList.add('recording');
}
function filmRecStop(){
  const R=film&&film.rec;if(!R)return null;
  film.rec=null;try{R.mr.stop();}catch(e){}
  film.ui.rec.classList.remove('on');film.ui.rec.textContent='● Enregistrer';film.ui.root.classList.remove('recording');
  return R.name;
}
function filmFrame(){
  // appelé par animate() JUSTE après le rendu : le tampon WebGL est encore lisible
  const R=film&&film.rec;if(!R)return;
  const c=R.c,x=R.ctx,W=c.width,H=c.height,u=H/1080;
  x.drawImage(renderer.domElement,0,0,W,H);
  const on=film.ui.root.classList.contains('on'),bh=on?Math.round(H*0.09):0;
  x.fillStyle='#000';x.fillRect(0,0,W,bh);x.fillRect(0,H-bh,W,bh);
  const T=film.txt;if(!T)return;
  const ff='-apple-system,"Segoe UI",Inter,sans-serif';
  if(T.card){
    const g=x.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*0.6);g.addColorStop(0,'rgba(8,10,16,.8)');g.addColorStop(1,'rgba(8,10,16,.5)');
    x.fillStyle=g;x.fillRect(0,bh,W,H-2*bh);
    x.textAlign='center';x.textBaseline='middle';
    x.fillStyle='#98989d';x.font=Math.round(22*u)+'px '+ff;x.fillText(T.card[0].toUpperCase().split('').join(String.fromCharCode(8202)),W/2,H/2-70*u);
    const lg=x.createLinearGradient(W/2-300*u,0,W/2+300*u,0);lg.addColorStop(0,'#6cb6ff');lg.addColorStop(.5,'#0a84ff');lg.addColorStop(1,'#8a88ff');
    x.fillStyle=lg;x.font='bold '+Math.round(74*u)+'px '+ff;x.fillText(T.card[1],W/2,H/2);
    x.fillStyle='#c7c7cc';x.font=Math.round(26*u)+'px '+ff;x.fillText(T.card[2],W/2,H/2+66*u);
    return;
  }
  // éclair coloré à l'apparition de l'étape
  const fa=Math.max(0,1-(performance.now()-(film.flashT||0))/900)*0.3;
  if(fa>0){const g=x.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.min(W,H)*0.6);g.addColorStop(0,T.col);g.addColorStop(1,'rgba(0,0,0,0)');
    x.globalAlpha=fa;x.globalCompositeOperation='screen';x.fillStyle=g;x.fillRect(0,0,W,H);x.globalAlpha=1;x.globalCompositeOperation='source-over';}
  const L=W*0.05,by=H-bh-34*u-44*u;
  x.textAlign='left';x.textBaseline='alphabetic';x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=12*u;
  x.fillStyle='#f5f5f7';x.font='bold '+Math.round(68*u)+'px '+ff;const sn=String(T.i+1).padStart(2,'0');x.fillText(sn,L,by+44*u);
  const nw=x.measureText(sn).width;
  x.fillStyle='#98989d';x.font=Math.round(28*u)+'px '+ff;const st=' / '+String(T.n).padStart(2,'0');x.fillText(st,L+nw,by+44*u);
  const bx=L+nw+x.measureText(st).width+22*u;x.shadowBlur=0;
  x.fillStyle=T.col;x.fillRect(bx,by,5*u,52*u);
  x.shadowBlur=12*u;x.fillStyle='#f5f5f7';x.font='600 '+Math.round(34*u)+'px '+ff;x.fillText(T.name,bx+22*u,by+24*u);
  x.fillStyle=T.col;x.font=Math.round(22*u)+'px '+ff;x.fillText(T.kind.toUpperCase(),bx+22*u,by+52*u);
  x.shadowBlur=0;
  const py=H-bh-14*u,pw=W*0.9;
  x.fillStyle='rgba(255,255,255,.14)';x.fillRect(L,py,pw,3*u);
  const pg=x.createLinearGradient(L,0,L+pw,0);pg.addColorStop(0,'#0a84ff');pg.addColorStop(1,'#8a88ff');
  x.fillStyle=pg;x.fillRect(L,py,pw*(T.i+1)/T.n,3*u);
}
