/* ---------- picking / mesure façon viewer ---------- */
function wirePick(){
  const el=renderer.domElement;let dx=0,dy=0;
  el.addEventListener('pointerdown',e=>{dx=e.clientX;dy=e.clientY;});
  // Ctrl / Cmd enfoncé = MESURE, quoi qu'il soit ouvert (fonction, FAO, assemblage) : le curseur
  // l'annonce dès l'appui, le clic mesure sans rien activer ni sélectionner.
  try{const st=document.createElement('style');st.textContent='canvas.mfCtrlMesure{cursor:crosshair!important}';document.head.appendChild(st);}catch(e){}
  const ctrlVue=on=>{try{el.classList.toggle('mfCtrlMesure',!!on&&!skEdit);}catch(e){}};
  window.addEventListener('keydown',e=>{if(e.key==='Control'||e.key==='Meta')ctrlVue(true);},true);
  window.addEventListener('keyup',e=>{if(e.key==='Control'||e.key==='Meta'){ctrlVue(false);if(hoverKey)clearHover();}},true);
  window.addEventListener('blur',()=>ctrlVue(false));
  el.addEventListener('pointermove',e=>ctrlVue(e.ctrlKey||e.metaKey));
  el.addEventListener('pointerup',e=>{
    if(ctrlMesureEv(e)&&!skEdit&&e.button===0&&Math.hypot(e.clientX-dx,e.clientY-dy)<=6){
      faceSelect(e,true);
      return;
    }
    if(typeof pgPick!=='undefined'&&pgPick){if(e.button===0&&Math.hypot(e.clientX-dx,e.clientY-dy)<=6)pgPickAt(e);return;} // répétition suivant un profil : départ (41)
    if(asmMode==='asm'){if(e.button===0&&Math.hypot(e.clientX-dx,e.clientY-dy)<=6)asmClick(e);return;} // vue d'assemblage (47)
    if(e.button===0&&Math.hypot(e.clientX-dx,e.clientY-dy)<=6&&typeof extProfClick==='function'&&extProfClick(e))return; // zone d'esquisse de l'extrusion (70-extrusion-profils)
    if(extPickFace||(typeof extUptoAuto==='function'&&extUptoAuto())){ // « jusqu'à la face » : clic COURT seulement (glisser = tourner la vue)
      if(e.button===0&&Math.hypot(e.clientX-dx,e.clientY-dy)<=6)extPickFaceCommit(e);return;}
    if(cgMode&&cgMode.slot!=null){if(Math.hypot(e.clientX-dx,e.clientY-dy)<=6&&e.button===0)cgPickCommit(e);return;} // construction : référence de l'emplacement actif
    if(Math.hypot(e.clientX-dx,e.clientY-dy)>6)return;
    if(filMode){if(e.button===0&&!e.ctrlKey)filletToggle(e);return;}
    if(filModeX){if(e.button===0)exactToggle(e);return;} // clic = ajouter / retirer une arête (V0.11.6)
    if(typeof parMesPick!=='undefined'&&parMesPick){if(e.button===0)parMesPickAt(e);return;} // paramètre mesuré : 2 faces (51-parametres-mesure)
    if(typeof hnPick!=='undefined'&&hnPick){if(e.button===0)hnPickAt(e);return;} // perçage normal : faces
    if(typeof holeFacePick!=='undefined'&&holeFacePick){if(e.button===0&&!e.ctrlKey)holeFacePickAt(e);return;} // fonction Perçage : face de fin
    if(typeof threadPick!=='undefined'&&threadPick){if(e.button===0&&!e.ctrlKey)threadPickAt(e);return;} // Filetage : face de l'axe (76-filetage)
    if(typeof faoHolePick!=='undefined'&&faoHolePick){if(e.button===0&&!e.ctrlKey)faoHolePickAt(e);return;} // perçage : clic sur un trou
    if(faoChainMode){if(e.button===0&&!e.ctrlKey)faoChainToggle(e);return;}
    if(faoPlanePick){if(e.button===0&&!e.ctrlKey)faoPlaneCommit(e);return;}
    if(typeof faoFramePick!=='undefined'&&faoFramePick){if(e.button===0&&!e.ctrlKey)faoFramePickCommit(e);return;} // axe Z / X du posage
    if(typeof faoFacePick!=='undefined'&&faoFacePick){if(e.button===0&&!e.ctrlKey)faoFacePickCommit(e);return;} // faces usinables / intouchables
    if(faoZPlanePick){if(e.button===0&&!e.ctrlKey)faoZPlaneCommit(e);return;}
    if(typeof bmPick!=='undefined'&&bmPick){if(e.button===0&&!e.ctrlKey)bmPickAt(e);return;} // Déplacer un corps : point / axe (85)
    if(mvMode){if(e.button===0&&!e.ctrlKey)mvFaceCommit(e);return;}
    if(draftMode){if(e.button===0&&!e.ctrlKey)draftToggle(e);return;}
    if(coqueMode){if(e.button===0&&!e.ctrlKey)coqueToggle(e);return;}
    if(splitMode){if(e.button===0&&!e.ctrlKey)splitClick(e);return;} // scinder (85-scinder)
    if(e.altKey)return;
    if(e.button===0&&!(e.ctrlKey||e.metaKey)&&typeof faoPosePickAt==='function'&&faoPosePickAt(e))return; // point cardinal → origine du posage
    if(e.shiftKey&&e.button===0){shiftMeasure(e);return;}
    if(e.button===0&&!(e.ctrlKey||e.metaKey))faceSelect(e,false);
    else if((e.ctrlKey||e.metaKey)&&e.button===0)faceSelect(e,true);
    else if(e.ctrlKey&&e.button===2)recenter(e);
  });
   el.addEventListener('dblclick',e=>{if(asmMode==='asm')asmDblClick(e);}); // double-clic = éditer la pièce
   el.addEventListener('pointermove',hoverMove);
   el.addEventListener('pointerleave',()=>clearHover());
   el.addEventListener('pointermove',e=>{
      if(ctrlMesureEv(e))return; // Ctrl : survol de mesure seulement (hoverMove), pas celui de la fonction ouverte
      if(typeof pgPick!=='undefined'&&pgPick){pgPickHover(e);return;} // répétition suivant un profil : départ (41)
      if(!e.buttons&&typeof extProfHover==='function'&&extProfHover(e))return; // zone d'esquisse de l'extrusion
      if(extPickFace||(typeof extUptoAuto==='function'&&extUptoAuto())){renderer.domElement.style.cursor='crosshair';return;}
      if(faoPlanePick){renderer.domElement.style.cursor='crosshair';return;}
      if(faoZPlanePick){renderer.domElement.style.cursor='crosshair';return;}
    if(typeof bmPick!=='undefined'&&bmPick){bmHoverAt(e);return;}
    if(mvMode){mvFaceHover(e);renderer.domElement.style.cursor='pointer';return;}
    if(draftMode){draftHover(e);return;}
    if(coqueMode){coqueHover(e);return;}
    if(splitMode){splitHover(e);return;}
      if(filModeX){
       const i=exactPick(e);
       if(i!==xHover){xHover=i;paintExact();}
       renderer.domElement.style.cursor=(i===null||i===undefined)?'default':'pointer';
       return;
     }
     if(faoChainMode){
       const ci=faoChainPick(e);
       if(ci!==faoChainHover){faoChainHover=ci;faoChainPaint();}
       renderer.domElement.style.cursor=(ci===null||ci===undefined)?'default':'pointer';
       return;
     }
     if(!filMode)return;
     const ed=filletPick(e);
     // survol = simple indication visuelle (jaune)
     const k=filEdgeHoverKey(ed);
     if(k!==filHover){filHover=k;paintFilletEdges();}
     const fc=pickFace(e);
     if(fc&&fc.bid===filMode.target)renderer.domElement.style.cursor='pointer';
     else if(!ed)renderer.domElement.style.cursor='default';
   });
  el.addEventListener('contextmenu',e=>{
    if(filMode||filModeX||faoChainMode||faoPlanePick||faoZPlanePick){e.preventDefault();return;}
    if(e.ctrlKey){e.preventDefault();return;}
    if(Math.hypot(e.clientX-dx,e.clientY-dy)>6)return;
    e.preventDefault();hideCtx();
    // pièce d'un autre composant (autour de la pièce, ou mode Assembler) devant la pièce active :
    // directement sa fenêtre d'apparence de rendu (98-rendu-apparence)
    const h=asmMode==='asm'?null:pick(e);
    try{const a=rdLookAsmHit(e);if(a&&(!h||a.distance<h.distance)){const ac=asmComp(a.t.comp);if(a.t.occ&&magOfComp(ac))magCtx(e.clientX,e.clientY,a.t,ac);else rdLookPop(e.clientX,e.clientY,a.t);return;}}catch(err){}
    if(!h)return;
    const b=bodies.find(x=>x.mesh===h.object);
    ctxPieceNext=b&&b.kind==='import'?importPieceAt(h.object,h.faceIndex):null; // pièce d'un STEP multi-corps
    showCtx3D(e.clientX,e.clientY,b?b.id:null);
  });
  el.addEventListener('dblclick',e=>{
    if(filModeX){
      // Plus de sélection par double-clic : un clic = une arête. La propagation tangente
      // passe par l'option « arêtes tangentes » du panneau (visible, donc prévisible).
      e.preventDefault();
      return;
    }
    if(filMode){
      e.preventDefault();
      const ed=filletPick(e);
      if(ed&&ed.kind==='v'&&ed.corner){
        // chaîne 2D tangente (esquisse) : lignes/arcs tangents au coin
        const F=doc.features.find(x=>x.id===filMode.target);
        const sk=doc.sketches.find(s=>s.id===(F?F.sketchId:filMode.sketchId)); if(sk) filletTangentChain(sk, ed.corner);
      }
      return;
    }
    if(!e.altKey)return;e.preventDefault();
    const h=pick(e);if(!h)return;
    const b=bodies.find(x=>x.mesh===h.object);if(b)isolate(b.id);
  });
function filletTangentChain(sk, startCorner){
  // 2D : suit les entités tangentes (angle < 8°) autour du profil
  const tr=skLoopTrace(sk); if(!tr.loops.length) return;
  const chain=tr.loops[0].chain;
  // map coin -> index dans nodes
  const nodes=chainNodesOf(chain);
  const idx=nodes.findIndex(pid=>{const p=sk.points[pid]; return p && Math.hypot(p.x-startCorner.x,p.y-startCorner.y)<0.5;});
  if(idx<0) return;
  const addCorner=(pid)=>{
    const q=sk.points[pid]; if(!q) return;
    const k=q.x.toFixed(2)+','+q.y.toFixed(2);
    if(!filMode.sel.some(s=>filEdgeKey(s)===k)) filMode.sel.push({x:+q.x.toFixed(2),y:+q.y.toFixed(2),pid});
  };
  // marche avant/arrière tant que tangent (G1)
  const isTangentAt=(i)=>{
    const n=nodes.length-1;
    const pid=nodes[i], pPrev=nodes[(i-1+n)%n], pNext=nodes[(i+1)%n];
    // angle entre les deux arêtes incidentes
    const A=sk.points[pPrev], V=sk.points[pid], B=sk.points[pNext];
    if(!A||!V||!B) return false;
    const ux=(A.x-V.x)/Math.hypot(A.x-V.x,A.y-V.y), uy=(A.y-V.y)/Math.hypot(A.x-V.x,A.y-V.y);
    const wx=(B.x-V.x)/Math.hypot(B.x-V.x,B.y-V.y), wy=(B.y-V.y)/Math.hypot(B.x-V.x,B.y-V.y);
    const dot=ux*wx+uy*wy;
    return Math.abs(dot) > 0.99;
  };
  const visited=new Set([idx]);
  let cur=idx;
  // avant
  for(let s=0;s<20;s++){
    const nxt=(cur-1+nodes.length-1)%(nodes.length-1);
    if(visited.has(nxt)) break;
    if(!isTangentAt(nxt)) break;
    visited.add(nxt); addCorner(nodes[nxt]); cur=nxt;
  }
  cur=idx;
  for(let s=0;s<20;s++){
    const nxt=(cur+1)%(nodes.length-1);
    if(visited.has(nxt)) break;
    if(!isTangentAt(cur)) break;
    visited.add(nxt); addCorner(nodes[nxt]); cur=nxt;
  }
  addCorner(nodes[idx]);
  paintFilletEdges(); renderFilletPanel();
  faceEl.textContent=`Congé : chaîne tangente 2D ${visited.size} coin(s) sélectionnée.`;
}
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){
    if(cgEscape())return; // construction : saisie de référence, puis panneau
    if(extPickFace){extPickFace=null;try{renderer.domElement.style.cursor='default';}catch(e2){}faceEl.textContent='Vers un objet : annulé.';return;}
    if(faoPlanePick){faoPlaneCancel();faceEl.textContent='Plan : annulé.';return;}
    if(typeof faoFramePick!=='undefined'&&faoFramePick){faoFramePickCancel();faceEl.textContent='Axe du posage : annulé.';return;}
    if(typeof faoFacePick!=='undefined'&&faoFacePick){faoFacePickCancel();faceEl.textContent='Saisie des faces terminée.';return;}
    if(faoZPlanePick){faoZPlaneCancel();faceEl.textContent='Plan : annulé.';return;}
    if(filMode||filModeX){exitFilletMode();return;}
    if(faoChainMode){faoChainExit(true);return;}
    if(typeof faoHolePick!=='undefined'&&faoHolePick){faoHolePickExit();return;}
    if(typeof parMesPick!=='undefined'&&parMesPick){parMesPickCancel(true);faceEl.textContent='Paramètre mesuré : annulé.';return;}
    if(typeof hnPick!=='undefined'&&hnPick){const nw=!hnPick.fid;hnPickCancel();faceEl.textContent=nw?'Perçage normal : annulé.':'Perçage normal : choix des faces terminé.';try{renderProps();}catch(e2){}return;}
    if(typeof holeFacePick!=='undefined'&&holeFacePick){const kwP=holeFacePick.which==='cylKw';holeFacePickCancel();faceEl.textContent=kwP?'Clavette : annulée.':'Perçage : sélection de face annulée.';return;}
    if(typeof threadPick!=='undefined'&&threadPick){threadPickCancel();faceEl.textContent='Filetage : sélection de face annulée.';return;}
    if(typeof bmPick!=='undefined'&&bmPick){bmPickExit(false);return;}
    if(mvMode){exitMoveFaceMode();return;}
    if(draftMode){exitDraftMode();return;}
    if(coqueMode){exitCoqueMode();return;}
    if(splitMode){if(splitMode.pick){splitMode.pick=null;renderSplitPanel();splitHelp();}else exitSplitMode();return;}clearMeasure();clearHover();hideCtx();hideCtx3D();}});
  // Entrée applique le dépouillage, comme Échap l'annule. Le champ d'angle du panneau
  // est isolé du reste : sans cela, taper un angle puis Entrée valait la saisie mais
  // n'appliquait rien, puisque le garde-fou global ignore toute cible INPUT.
  window.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||!draftMode)return;
    const t=e.target;
    const estAngle=t&&t.id==='draftAngleIn';
    if(!estAngle&&t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
    e.preventDefault();draftApply();
  });
  // Entrée applique la coque, comme Échap l'annule (même isolement du champ).
  window.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||!coqueMode)return;
    const t=e.target;
    const estThick=t&&t.id==='coqueThickIn';
    if(!estThick&&t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
    e.preventDefault();coqueApply();
  });
  // Entrée applique le déplacement de face (multi-sélection), même isolement du champ :
  // la distance tapée est validée avant d'appliquer.
  window.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||!mvMode)return;
    const t=e.target;
    const estDist=t&&t.id==='mvDistIn';
    if(!estDist&&t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
    e.preventDefault();
    if(estDist&&t.onchange)t.onchange();
    mvApply();
  });
}
/* F5 = Vue complète isométrique (au lieu du rechargement navigateur) : on voit la pièce entièrement. */
window.addEventListener('keydown',e=>{
  if(e.key==='F5'){e.preventDefault();const ov=$('sketchOverlay');if(skEdit||(ov&&ov.classList.contains('open')))return;setView('iso');return;} // en esquisse, F5 = parallèle
});
// 2026-10-16-005 : raccourcis 3D (hors esquisse, hors saisie) — H perçage · R révolution ·
// F congés · C chanfreins · M répétitions (E extrusion : ci-dessous).
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.altKey||e.metaKey||e.repeat)return;
  const map={h:'btnHole',r:'btnRevolve',f:'btnFillet',c:'btnChamfer',m:'btnRepeat'};
  const id=map[String(e.key||'').toLowerCase()];if(!id)return;
  const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;
  if(skEdit||extPickFace||faoChainMode)return;
  if(typeof viewFaoActive==='function'&&viewFaoActive())return; // FAO : pas d'outils CAO
  const ov=$('sketchOverlay');if(ov&&ov.classList.contains('open'))return;
  const b=$(id);if(!b||b.disabled)return;
  e.preventDefault();b.click();
});
/* raccourci E : ouvrir l'extrusion (Fusion360) — au niveau module pour être armé dès le chargement,
   jamais pendant la saisie (input/textarea/select), une esquisse ouverte ou un mode congé. */
window.addEventListener('keydown',e=>{
  if((e.key==='e'||e.key==='E')&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!e.repeat){
    const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;
    if(skEdit||filMode||filModeX||extPickFace||faoChainMode)return;
    if(typeof viewFaoActive==='function'&&viewFaoActive())return; // FAO : pas d'outils CAO
    const ov=$('sketchOverlay');if(ov&&ov.classList.contains('open'))return;
    e.preventDefault();
    const b=$('btnExtrude');if(b&&!b.disabled)b.click();
  }
});
// Geste de mesure : Ctrl / Cmd seul (Ctrl+Maj reste la sélection d'une plage, Alt l'isolement)
function ctrlMesureEv(e){return !!(e&&(e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey);}
// Un seul outil de mesure en Modéliser et en Assembler : il voit les corps du modèle (Modéliser) et
// les composants dessinés dans la vue (48-assemblage-mesure) ; ses tracés vont dans la scène affichée.
function mesScene(){return asmMode==='asm'?asmSceneGet():scene;}
function mesPick(e){
  if(typeof viewFaoActive==='function'&&viewFaoActive())return pick(e); // FAO : le modèle seul
  const r=renderer.domElement.getBoundingClientRect();
  rayc.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),camera);
  const hits=asmMode==='asm'?[]:rayc.intersectObjects(bodies.filter(b=>b.visible).map(b=>b.mesh),false);
  asmMeasHits(hits);
  hits.sort((a,b)=>a.distance-b.distance);
  return hits.find(h=>!(h.object.userData.rd&&h.object.userData.rd.ghost))||hits[0]||null; // les fantômes en dernier recours
}
function mesEdgeSegs(){
  const part=asmMode==='asm'?[]:edgeHoverSegs();
  return typeof viewFaoActive==='function'&&viewFaoActive()?part:part.concat(asmMeasEdgeSegs());
}
const mesPropre=m=>bodies.some(b=>b.mesh===m);
const mesGeomOf=(m,fi)=>mesPropre(m)?occFaceGeom(m,fi):asmMeasGeom(m,fi);
const mesNom=m=>mesPropre(m)?bodyName(m):asmMeasName(m);
function mesEnCours(){return !!(mesEtrangere||selFaces.length||selEdges.length||selGroup||measureGroup);}
function pick(e){
  const r=renderer.domElement.getBoundingClientRect();
  const ndc=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  rayc.setFromCamera(ndc,camera);
  const hits=rayc.intersectObjects(bodies.filter(b=>b.visible).map(b=>b.mesh),false);
  return hits[0]||null;
}
// 2026-10-16-003 : sélection d'ARÊTES (clic sur une arête présélectionnée) et MESURE entre
// 2 arêtes (Ctrl/Cmd + clic) : droites parallèles → distance perpendiculaire ; droites
// quelconques → angle + distance mini ; cercles/arcs → entraxe (+ écart des plans si
// coaxiaux) ; droite + cercle → distance centre ↔ droite.
let selEdges=[];
function edgeGeomOf(P){
  const V=P.map(p=>new THREE.Vector3(p[0],p[1],p[2]));
  const A=V[0],B=V[V.length-1],u=B.clone().sub(A);const L=u.length();
  const dev=q=>{if(L<1e-9)return 0;const t=q.clone().sub(A).dot(u)/(L*L);return q.distanceTo(A.clone().addScaledVector(u,t));};
  if(V.length<=2||V.every(q=>dev(q)<1e-3*Math.max(1,L)))return{kind:'line',a:A,b:B,u:u.clone().normalize(),pts:V};
  // cercle passant par 3 points (début, milieu, fin) ; fermé → 3 points répartis
  const closed=A.distanceTo(B)<1e-6*Math.max(1,L)+1e-6;
  const p1=V[0],p2=V[Math.floor(V.length/3)],p3=V[Math.floor(2*V.length/3)];
  const a=p2.clone().sub(p1),b=p3.clone().sub(p1),n=a.clone().cross(b);const nn=n.lengthSq();
  if(nn<1e-12)return{kind:'curve',pts:V};
  // centre circonscrit : C = p1 + ((|a|²·b − |b|²·a) × n) / (2|n|²), n = a × b
  const C=p1.clone().add(b.clone().multiplyScalar(a.lengthSq()).sub(a.clone().multiplyScalar(b.lengthSq())).cross(n).multiplyScalar(0.5/nn));
  const r=C.distanceTo(p1);
  const ok=V.every(q=>Math.abs(q.distanceTo(C)-r)<2e-3*Math.max(1,r));
  return ok?{kind:'circle',center:C,axis:n.clone().normalize(),r,closed,pts:V}:{kind:'curve',pts:V};
}
// NUMÉRO ET ORIGINE d'une face ou d'une arête cliquée. Le numéro est son rang dans le solide (il peut
// changer si le modèle change) ; l'origine vient de son nom unique (20-05), qui lui ne change pas.
function selOrigine(nom){
  // « ex_3_abc/e6/flanc » → nom de la fonction ; une arête (« a|b ») → ses deux fonctions
  if(!nom)return '';
  const L=[];
  nomsDecoupe(nom).forEach(n=>{
    const m=n.match(/^[a-z]+_\d+_\w+/);
    const f=m&&(doc.features||[]).find(x=>x.id===m[0]);
    const t=/^congé\[/.test(n)?'Congé':/^chanfrein\[/.test(n)?'Chanfrein':f?(f.name||f.id):null;
    if(t&&L.indexOf(t)<0)L.push(t);
  });
  return L.join(' / ');
}
function selShapeDe(bd){
  if(!bd)return null;
  if(bd.kind==='body'&&bd.shape&&occLive&&occLive.shape)return bd.shape;
  if(bd.kind==='import'){const e=importGeom.get(bd.ref||bd.id);if(e&&e.brep)return e.brep;}
  return null;
}
function selFaceInfo(mesh,fi){
  // → {n, origine} ; n=0 si la face n'a pas de numéro (maillage sans noyau exact)
  const R={n:0,origine:''};
  try{
    const g=(mesh.geometry.userData.occGroups||[]).find(g=>fi>=g.start&&fi<g.start+g.count);
    if(!g)return R;
    R.n=g.f+1;
    if(!occHas())return R;
    const shape=selShapeDe(bodies.find(b=>b.mesh===mesh));if(!shape)return R;
    const f=occFaceAt(shape,g.f);if(!f)return R;
    try{R.origine=selOrigine(nomsFaceDe(shape,f));}finally{try{f.delete();}catch(e){}}
  }catch(e){}
  return R;
}
function selAreteInfo(P){
  // Arête du solide dont les points tombent sur la polyligne cliquée (coordonnées monde)
  const R={n:0,origine:''};
  // Vue d'assemblage : l'arête peut venir d'une autre pièce, placée ailleurs ; pas de numéro plutôt qu'un faux
  if(!occHas()||!P||P.length<2||(typeof asmMode!=='undefined'&&asmMode==='asm'))return R;
  // Le milieu en longueur : un point de la liste peut être un coin, commun à plusieurs arêtes
  let L=0;for(let i=1;i<P.length;i++)L+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1],P[i][2]-P[i-1][2]);
  let q=P[0];
  for(let i=1,c=0;i<P.length;i++){
    const l=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1],P[i][2]-P[i-1][2]);
    if(c+l>=L/2&&l>0){const t=(L/2-c)/l;q=[0,1,2].map(k=>P[i-1][k]+(P[i][k]-P[i-1][k])*t);break;}
    c+=l;
  }
  const dSeg=(v,a,b)=>{
    const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l2=ab[0]*ab[0]+ab[1]*ab[1]+ab[2]*ab[2];
    const t=l2>0?Math.max(0,Math.min(1,((v[0]-a[0])*ab[0]+(v[1]-a[1])*ab[1]+(v[2]-a[2])*ab[2])/l2)):0;
    return Math.hypot(a[0]+ab[0]*t-v[0],a[1]+ab[1]*t-v[1],a[2]+ab[2]*t-v[2]);
  };
  let best=null,bd0=0.5; // la plus proche : les courbes sont lues en 10 segments, avec un léger écart
  (bodies||[]).forEach(bd=>{
    const shape=selShapeDe(bd);if(!shape)return;
    try{
      const inv=bd.mesh&&bd.mesh.matrixWorld?new THREE.Matrix4().copy(bd.mesh.matrixWorld).invert():null;
      const w=new THREE.Vector3(q[0],q[1],q[2]);if(inv)w.applyMatrix4(inv);
      const v=[w.x,w.y,w.z];
      occListEdges(shape).forEach(e=>{
        const T=e.pts||[];
        for(let i=1;i<T.length;i++){const d=dSeg(v,T[i-1],T[i]);if(d<bd0){bd0=d;best={shape,src:e.src};}}
      });
    }catch(e){}
  });
  if(!best)return R;
  const E=occt.TopAbs_ShapeEnum;
  let carte=null,ex=null;
  try{
    carte=nomsCarte(best.shape,E.TopAbs_EDGE,E.TopAbs_FACE);
    if(!carte){R.n=best.src+1;return R;} // noyau sans carte : le rang de lecture sert de numéro
    ex=new occt.TopExp_Explorer_2(best.shape,E.TopAbs_EDGE,E.TopAbs_SHAPE);
    for(let k=0;ex.More()&&k<best.src;k++)ex.Next();
    if(ex.More()){
      R.n=carte.FindIndex(ex.Current());
      R.origine=selOrigine(nomsAreteDe(best.shape,ex.Current()));
    }
  }catch(e){}
  finally{try{if(ex)ex.delete();}catch(e){}try{if(carte)carte.delete();}catch(e){}}
  return R;
}
function selLibelle(mot,I){return mot+(I.n?' '+I.n:'');}
function edgeSelect(e,eh,second){
  const P=eh.P||edgeHoverSegs()[eh.pi];if(!P)return;
  const G=edgeGeomOf(P);
  clearHover();
  if(!second||!selEdges.length){
    clearMeasure();selEdges=[{P,G}];
    if(!selGroup){selGroup=new THREE.Group();mesScene().add(selGroup);}
    edgeHoverDraw(P,selGroup,0xff9f0a);
    const desc=G.kind==='line'?('DROITE · longueur '+G.a.distanceTo(G.b).toFixed(2)+' mm'):(G.kind==='circle'?((G.closed?'CERCLE':'ARC')+' · Ø'+(2*G.r).toFixed(2)+' (R'+G.r.toFixed(2)+')'):'COURBE');
    const I=selAreteInfo(P);
    faceEl.textContent=selLibelle('Arête',I)+' : '+desc+(I.origine?'\nCréée par : '+I.origine:'')+'\nCtrl/Cmd+clic une 2e arête : distance perpendiculaire, angle ou entraxe.';
    return;
  }
  selEdges.push({P,G});edgeHoverDraw(P,selGroup,0xff9f0a);
  const A=selEdges[0].G,B=G;
  if(A.kind==='line'&&B.kind==='line'){
    const ang=Math.acos(Math.min(1,Math.abs(A.u.dot(B.u))))*180/Math.PI;
    if(ang<0.5){
      const M=B.a.clone().add(B.b).multiplyScalar(0.5);
      const F=A.a.clone().addScaledVector(A.u,M.clone().sub(A.a).dot(A.u));
      const d=F.distanceTo(M);
      dimPair(F,M,d.toFixed(2));
      faceEl.textContent='Arêtes parallèles : '+d.toFixed(2)+' mm (perpendiculaire) · angle '+ang.toFixed(2)+'°';
    }else{
      // plus courte distance entre les 2 segments (échantillonnage + affinage)
      let best={d:1e18};
      const segPt=(G0,t)=>G0.a.clone().lerp(G0.b,t);
      for(let i=0;i<=40;i++)for(let j=0;j<=40;j++){const p=segPt(A,i/40),q=segPt(B,j/40),d=p.distanceTo(q);if(d<best.d)best={d,p,q,i,j};}
      dimPair(best.p,best.q,best.d.toFixed(2));
      faceEl.textContent='Arêtes non parallèles : angle '+ang.toFixed(2)+'° · distance mini ≈ '+best.d.toFixed(2)+' mm';
    }
    return;
  }
  if(A.kind==='circle'&&B.kind==='circle'){
    const d=A.center.distanceTo(B.center),coax=Math.abs(Math.abs(A.axis.dot(B.axis))-1)<1e-4&&B.center.clone().sub(A.center).cross(A.axis).length()<1e-3;
    dimPair(A.center,B.center,(coax?'':'entraxe ')+d.toFixed(2));
    tagAt('Ø '+(2*A.r).toFixed(2),A.pts[0]);tagAt('Ø '+(2*B.r).toFixed(2),B.pts[0]);
    faceEl.textContent=(coax?'Cercles COAXIAUX : écart des plans '+d.toFixed(2)+' mm':'Entraxe : '+d.toFixed(2)+' mm')+'\nØ1='+(2*A.r).toFixed(2)+' · Ø2='+(2*B.r).toFixed(2);
    return;
  }
  const L=A.kind==='line'?A:(B.kind==='line'?B:null),C=A.kind==='circle'?A:(B.kind==='circle'?B:null);
  if(L&&C){
    const F=L.a.clone().addScaledVector(L.u,C.center.clone().sub(L.a).dot(L.u));const d=F.distanceTo(C.center);
    dimPair(C.center,F,d.toFixed(2));tagAt('Ø '+(2*C.r).toFixed(2),C.pts[0]);
    faceEl.textContent='Centre ↔ droite : '+d.toFixed(2)+' mm (perpendiculaire) · Ø='+(2*C.r).toFixed(2);
    return;
  }
  // courbes quelconques : distance mini entre points des polylignes
  let best={d:1e18};A.pts.forEach(p=>B.pts.forEach(q=>{const d=p.distanceTo(q);if(d<best.d)best={d,p,q};}));
  dimPair(best.p,best.q,best.d.toFixed(2));faceEl.textContent='Distance mini entre arêtes ≈ '+best.d.toFixed(2)+' mm';
}
function faceSelect(e,second){
  // V0.24.2 : Ctrl / Cmd enfoncé = MESURE seulement — rien n'est sélectionné nulle part (fonction,
  // plan, construction : ni arbre, ni timeline, ni panneau, ni outil rouge), rien n'est désélectionné
  const meas=!!(e&&(e.ctrlKey||e.metaKey));
  // Espace FAO : on mesure et on allume les faces en orange, rien d'autre — pas de fonction,
  // plan ni construction sélectionnés (pas d'édition CAO) ; V0.26.1 : le posage / l'opération est désélectionné
  const fao=typeof viewFaoActive==='function'&&viewFaoActive();
  const noSel=meas||fao;
  // FAO : un clic (sans Ctrl) dans la vue 3D annule la sélection du posage ou de l'opération
  if(fao&&!second&&!meas&&sel&&(sel.kind==='faoSetup'||sel.kind==='faoOp')){
    sel={kind:null,id:null};
    try{if(typeof faoRenderTree==='function')faoRenderTree();}catch(err){}
    try{renderProps();}catch(err){}
  }
  // 2026-10-16-017 : plans du repère (dessinés devant la pièce) prioritaires
  if(!second&&!noSel){const tp=triadPickPlane(e);if(tp){clearMeasure();sel={kind:'plane',id:tp};renderTree();renderProps();refreshParts();faceEl.textContent=`Plan ${tp} — ${PLANES[tp].label}
Bouton « Esquisse » (ou double-clic dans l'arbre) pour dessiner dessus.`;return;}}
  if(!second&&!noSel&&cgSelectAt(e))return; // construction (79) : plans, axes, points, repères
  const h=meas?mesPick(e):pick(e);
  try{
    const segs=meas?mesEdgeSegs():edgeHoverSegs(),eh=edgePickScreen(e,segs,h,6);
    if(eh){eh.P=segs[eh.pi];edgeSelect(e,eh,second);return;}
  }catch(err){}
  if(second&&selEdges.length&&!selFaces.length){selEdges=[];}
  if(!h){
    if(!second&&fao){clearMeasure();faceEl.textContent='Aucune face — cliquez sur un corps.';}
    else if(!second&&!meas){
      const pl=pickPlane(e);
      if(pl){sel={kind:'plane',id:pl};renderTree();renderProps();refreshParts();faceEl.textContent=`Plan ${pl} — ${PLANES[pl].label}\nBouton « Esquisse » (ou double-clic dans l'arbre) pour dessiner dessus.`;return;}
      clearMeasure();faceEl.textContent='Aucune face — cliquez sur un corps.';
      // V0.23.26 : clic dans le vide = plus rien de sélectionné (arbre, timeline, panneau)
      if(sel.kind||treeSel.length){sel={kind:null,id:null};treeSel=[];renderTree();renderProps();refreshParts();}
    }return;}
  clearHover();
  const propre=mesPropre(h.object),P={mesh:h.object,faceIndex:h.faceIndex,point:h.point.clone(),geom:mesGeomOf(h.object,h.faceIndex)};
  if(!second){clearMeasure();if(propre)selFaces=[P];else mesEtrangere=P;highlightTris(h.object,faceTrisFor(h.object,h.faceIndex),0xff9f0a,0.55);
    const G=P.geom;
    if(meas&&G&&G.kind==='cyl'){drawAxis(G.center,G.axis,axisLen());tagAt('Ø '+(G.r*2).toFixed(2),P.point.clone());} // Ctrl+clic seul sur un cylindre : son Ø
    const FI=selFaceInfo(h.object,h.faceIndex);
    faceEl.textContent=`${selLibelle('Face',FI)} : ${mesNom(h.object)}${G?(G.kind==='cyl'?` · CYLINDRE Ø${(G.r*2).toFixed(2)}`:' · PLAN'):''}${FI.origine?`\nCréée par : ${FI.origine}`:''}\nAire ≈ ${faceArea(h.object,h.faceIndex)}\nCtrl+clic une 2e face (entraxe auto si cylindres)${fao||!propre?'':' · Bouton « Esquisse » pour esquisser dessus.'}`;
    // V0.23.26 : la fonction créatrice est sélectionnée dans l'arbre et la timeline — différé :
    // la face s'allume tout de suite, le rejeu observé (points de contrôle) vient ensuite
    const hm=h.object,hf=h.faceIndex,hp=h.point.clone();
    if(!noSel)setTimeout(()=>{if(selFaces.length===1&&selFaces[0].mesh===hm&&selFaces[0].faceIndex===hf)faceSelectFeature(hm,hf,hp);},0);}
  else{
    const A=mesEtrangere||selFaces[0];
    if(!A){faceSelect(e,false);return;}
    if(propre)selFaces.push(P);
    highlightTris(h.object,faceTrisFor(h.object,h.faceIndex),0xff9f0a,0.55);
    const noms=`${selLibelle('Face',selFaceInfo(A.mesh,A.faceIndex))} : ${mesNom(A.mesh)}\n${selLibelle('Face',selFaceInfo(P.mesh,P.faceIndex))} : ${mesNom(P.mesh)}\n`;
    if(measurePair(A,P)){if(!propre||!mesPropre(A.mesh))faceEl.textContent=noms+faceEl.textContent;}
    else{
      const d=A.point.distanceTo(P.point);
      dimPair(A.point,P.point,d.toFixed(2)+' mm');
      faceEl.textContent=`${noms}Distance points ≈ ${d.toFixed(2)} mm${occHas()?'':'\n(Entraxe/Ø exacts : noyau OCCT requis — page en http://)'}`;
    }
    if(propre&&mesPropre(A.mesh)&&!fao){try{parMesOffer(A,P);}catch(err){}} // V0.87.0 : bouton « Créer un paramètre »
  }
}
function measurePair(A,B){
  // Mesures exactes entre 2 faces classées (plans / cylindres BRep). True si traité.
  const GA=A.geom,GB=B.geom;
  if(!GA||!GB)return false;
  if(GA.kind==='cyl'&&GB.kind==='cyl'){
    const en=entraxePts(GA.center,GA.axis,GB.center,GB.axis);
    const ang=Math.asin(Math.min(1,GA.axis.clone().cross(GB.axis).length()))*180/Math.PI;
    dimPair(en.q1,en.q2,'entraxe '+en.d.toFixed(2));
    tagAt('Ø '+(GA.r*2).toFixed(2),en.q1);tagAt('Ø '+(GB.r*2).toFixed(2),en.q2);
    drawAxis(GA.center,GA.axis,axisLen());drawAxis(GB.center,GB.axis,axisLen());
    faceEl.textContent=`Entraxe : ${en.d.toFixed(2)} mm${en.par?' (axes quasi-parallèles)':''}\nØ1=${(GA.r*2).toFixed(2)} · Ø2=${(GB.r*2).toFixed(2)} · angle axes=${ang.toFixed(2)}°`;
    return true;
  }
  const C=GA.kind==='cyl'?GA:(GB.kind==='cyl'?GB:null);
  const P=GA.kind==='plan'?GA:(GB.kind==='plan'?GB:null);
  if(C&&P){
    const a2p=Math.asin(Math.min(1,Math.abs(C.axis.dot(P.n))))*180/Math.PI;
    const dAx=(C.center.clone().sub(P.p)).dot(P.n);
    const qf=C.center.clone().addScaledVector(P.n,-dAx);
    dimPair(C.center,qf,Math.abs(dAx).toFixed(2));
    tagAt('Ø '+(C.r*2).toFixed(2),(GA.kind==='cyl'?A:B).point.clone());
    drawAxis(C.center,C.axis,axisLen());
    faceEl.textContent=`Axe↔face : ${Math.abs(dAx).toFixed(2)} mm${a2p>89?' (axe ⊥ face)':` (angle axe/plan=${a2p.toFixed(1)}°)`}\nØ=${(C.r*2).toFixed(2)}`;
    return true;
  }
  if(GA.kind==='plan'&&GB.kind==='plan'){
    const ang=Math.acos(Math.min(1,Math.abs(GA.n.dot(GB.n))))*180/Math.PI;
    if(ang<0.5){
      // Distance EXACTE entre les deux plans (équations BRep), pas entre les points
      // cliqués : un clic tombe sur le maillage, à la flèche de tessellation près.
      const signed=(GB.p.clone().sub(GA.p)).dot(GA.n);
      const A0=A.point.clone().addScaledVector(GA.n,-(A.point.clone().sub(GA.p)).dot(GA.n)); // pied SUR le plan 1
      dimPair(A0,A0.clone().addScaledVector(GA.n,signed),Math.abs(signed).toFixed(2));
      faceEl.textContent=`Faces parallèles : ${Math.abs(signed).toFixed(2)} mm (angle ${ang.toFixed(2)}°)`;
    }else{
      const d=A.point.distanceTo(B.point);
      dimPair(A.point,B.point,d.toFixed(2)+' mm');
      faceEl.textContent=`Faces non parallèles : angle=${ang.toFixed(2)}° · dist. points=${d.toFixed(2)} mm`;
    }
    return true;
  }
  return false;
}
function occFaceAt(shape,ord){
  const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);
  let k=0;
  while(ex.More()){if(k===ord){const f=occFaceCur(ex);try{ex.delete();}catch(e){}return f;}k++;ex.Next();}
  try{ex.delete();}catch(e){}
  return null;
}
function occFaceGeom(mesh,fi){
  // Géométrie exacte d'une face cliquée (plan / cylindre) via le BRep. Null sinon.
  // Multi-corps : chaque mesh a ses propres ordinaux (occGroups par solide) — la face
  // est donc résolue sur le SOLIDE DU CORPS cliqué, pas sur le composé occLive.
  // 2026-10-15-004 : un import STEP (seul dans son corps) a AUSSI son BRep exact
  // (importGeom.brep) et son maillage porte occGroups : on le résout pareil. Avant,
  // un STEP retombait sur la distance entre les points cliqués (« la mesure sur les
  // fichiers STEP n'est pas identique à celle des solides de l'application »).
  if(!occHas()||!mesh||fi===undefined)return null;
  const bd=bodies.find(b=>b.mesh===mesh);
  if(!bd)return null;
  let shape=null;
  if(bd.kind==='body'&&bd.shape&&occLive&&occLive.shape)shape=bd.shape;
  else if(bd.kind==='import'){const e=importGeom.get(bd.ref||bd.id);if(e&&e.brep)shape=e.brep;}
  if(!shape)return null;
  try{
    const groups=mesh.geometry.userData.occGroups||[];
    const g=groups.find(g=>fi>=g.start&&fi<g.start+g.count);
    if(!g)return null;
    const f=occFaceAt(shape,g.f);
    if(!f)return null;
    const ad=new occt.BRepAdaptor_Surface_2(f,true);
    const gt=ad.GetType();
    const isCyl=gt===occt.GeomAbs_SurfaceType.GeomAbs_Cylinder;
    const isPl=gt===occt.GeomAbs_SurfaceType.GeomAbs_Plane;
    if(!isCyl&&!isPl){try{ad.delete();}catch(e){}try{f.delete();}catch(e){}return null;}
    let out=null;
    if(isCyl){
      const a=ad.Cylinder().Axis();
      out={kind:'cyl',axis:new THREE.Vector3(a.Direction().X(),a.Direction().Y(),a.Direction().Z()).normalize(),
        center:new THREE.Vector3(a.Location().X(),a.Location().Y(),a.Location().Z()),r:ad.Cylinder().Radius()};
    }else{
      const p=ad.Plane();
      const a=p.Axis();
      out={kind:'plan',n:new THREE.Vector3(a.Direction().X(),a.Direction().Y(),a.Direction().Z()).normalize(),
        p:new THREE.Vector3(a.Location().X(),a.Location().Y(),a.Location().Z())};
    }
    try{ad.delete();}catch(e){}
    // Repère du mesh (import déplacé) : la géométrie BRep est en coordonnées locales.
    try{
      mesh.updateMatrixWorld(true);const M=mesh.matrixWorld;
      if(M&&!M.equals(new THREE.Matrix4())){
        const N=new THREE.Matrix3().getNormalMatrix(M);
        if(out.kind==='cyl'){out.center.applyMatrix4(M);out.axis.applyMatrix3(N).normalize();}
        else{out.p.applyMatrix4(M);out.n.applyMatrix3(N).normalize();}
      }
    }catch(e){}
    return out;
  }catch(e){return null;}
}
/* V0.23.26 : FONCTION QUI A CRÉÉ UNE FACE (clic sur une face → même sélection dans l'arbre et la
   timeline). Pas d'historique topologique OCCT : on rejoue le corps (points de contrôle : copies,
   pas de booléens) en observant le solide après chaque fonction (occPrefixTap, 20). La face
   « existe » à une étape s'il s'y trouve une face de même surface (plan : normale sortante et
   distance ; cylindre : axe et rayon ; autre : même type) dont la boîte contient le point cliqué.
   Créatrice = la fonction après la DERNIÈRE étape où elle n'existe pas (une face recouverte puis
   rebâtie appartient à la seconde). Instance de répétition → la répétition. Mémorisé par solide. */
let occCreatorMemo={live:null,m:new Map()};
function occFaceSurf(f){
  const out={st:occSurfKind(f),box:occFaceBox(f),n:occFaceOutNormal(f)};
  try{
    const ad=new occt.BRepAdaptor_Surface_2(f,true),gt=ad.GetType(),T=occt.GeomAbs_SurfaceType;
    try{
      if(gt===T.GeomAbs_Plane&&out.n){const l=ad.Plane().Location();out.d=out.n[0]*l.X()+out.n[1]*l.Y()+out.n[2]*l.Z();}
      else if(gt===T.GeomAbs_Cylinder){
        const c=ad.Cylinder(),a=c.Axis(),l=a.Location(),u=a.Direction();
        out.cy={p:[l.X(),l.Y(),l.Z()],u:[u.X(),u.Y(),u.Z()],r:c.Radius()};
      }
    }catch(e){}
    try{ad.delete();}catch(e){}
  }catch(e){}
  return out;
}
function occFaceSurfSame(a,b,p){
  // b (candidate) porte-t-elle la face a au point p ?
  if(!a||!b||a.st!==b.st||!b.box)return false;
  const tb=0.05;
  for(let k=0;k<3;k++)if(Math.abs(p[k]-b.box.pos[k])>b.box.dim[k]/2+tb)return false;
  if(a.d!=null){
    if(b.d==null||!b.n||a.n[0]*b.n[0]+a.n[1]*b.n[1]+a.n[2]*b.n[2]<0.999)return false;
    return Math.abs(a.d-b.d)<0.01;
  }
  if(a.cy){
    const A=a.cy,B=b.cy;if(!B||Math.abs(A.r-B.r)>0.01)return false;
    const dot=A.u[0]*B.u[0]+A.u[1]*B.u[1]+A.u[2]*B.u[2];if(Math.abs(dot)<0.999)return false;
    const w=[A.p[0]-B.p[0],A.p[1]-B.p[1],A.p[2]-B.p[2]],t=w[0]*B.u[0]+w[1]*B.u[1]+w[2]*B.u[2];
    return Math.hypot(w[0]-t*B.u[0],w[1]-t*B.u[1],w[2]-t*B.u[2])<0.01;
  }
  return true;
}
function occShapeHasFace(shape,ref,p){
  if(!shape)return false;
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
  let ok=false;
  try{
    while(!ok&&ex.More()){
      const f=occFaceCur(ex);
      try{
        const b=occFaceBox(f);let inBox=!!b;
        if(b)for(let k=0;k<3;k++)if(Math.abs(p[k]-b.pos[k])>b.dim[k]/2+0.05){inBox=false;break;}
        if(inBox)ok=occFaceSurfSame(ref,occFaceSurf(f),p);
      }catch(e){}
      try{f.delete();}catch(e){}
      ex.Next();
    }
  }finally{try{ex.delete();}catch(e){}}
  return ok;
}
function occFaceCreator(mesh,fi,point){
  // Id de la fonction (de premier niveau) qui a créé la face cliquée, ou null.
  if(!occHas()||!occLive||!occLive.shape||!mesh||fi==null||!point)return null;
  const hit=occFaceOfHit(mesh,fi);
  if(!hit||!hit.bd||hit.bd.kind!=='body')return null;
  if(occCreatorMemo.live!==occLive)occCreatorMemo={live:occLive,m:new Map()};
  const bid=hit.bd.bodyId||hit.bd.id,key=bid+'|'+hit.ord;
  if(occCreatorMemo.m.has(key)){try{hit.face.delete();}catch(e){}return occCreatorMemo.m.get(key);}
  // V0.89.1 : le NOM unique de la face (20-05) commence par l'id de la fonction qui l'a fait naître
  // (« ex_18_…/e123/flanc#1 », « ho_95_…/c0/s0/f1 », « im_3_…/~411 ») : lu en une fraction de
  // milliseconde. Le rejeu observé ci-dessous ne sert plus que de repli (face sans nom) : il figeait
  // la vue 1 à 10 s par clic sur une pièce de 110 fonctions et ~850 faces, et n'y trouvait presque rien.
  try{
    const nm=nomsFaceDe(hit.bd.shape,hit.face);
    const m=nm&&nm.match(/^[a-z]+_\d+_[a-z0-9]+/i);
    let fid=m&&m[0];const f0=fid&&(doc.features||[]).find(x=>x.id===fid);
    if(f0){if(f0.repeatId)fid=f0.repeatId;try{hit.face.delete();}catch(e){}occCreatorMemo.m.set(key,fid);return fid;}
  }catch(e){}
  const ref=occFaceSurf(hit.face);try{hit.face.delete();}catch(e){}
  const p=[point.x,point.y,point.z];
  const seq=[];
  let FR=null,id=null;
  occPrefixTap=(b,f,sh)=>{if(b===bid)seq.push({f,on:occShapeHasFace(sh,ref,p)});};
  try{FR=occFinalShape(tlReplayCount());}catch(e){FR=null;}
  finally{occPrefixTap=null;}
  try{if(FR)occCleanup(FR,null);}catch(e){}
  // dernière étape où la face existe, puis début de cette présence ininterrompue
  let k=seq.length-1;while(k>=0&&!seq[k].on)k--;
  if(k>=0){while(k>0&&seq[k-1].on)k--;id=seq[k].f.id;}
  const f=id&&(doc.features||[]).find(x=>x.id===id);
  if(f&&f.repeatId)id=f.repeatId;
  occCreatorMemo.m.set(key,id);
  return id;
}
function faceSelectFeature(mesh,fi,point){
  // Clic sur une face : sa fonction devient la sélection de l'arbre et de la timeline (qui
  // défilent pour la montrer) ; la face reste en surbrillance, la vue ne bouge pas.
  let id=null;try{id=occFaceCreator(mesh,fi,point);}catch(e){id=null;}
  if(!id||!(doc.features||[]).some(f=>f.id===id))return false;
  // V0.88.1 (Fred) : clic dans la vue 3D = SURBRILLANCE seule dans l'arbre et la timeline (treeSel) —
  // la fonction ne s'ouvre pas (ni panneau, ni aperçu, ni flèche). Un clic sur la ligne surlignée,
  // dans l'arbre ou la timeline, l'ouvre comme avant.
  if(sel.kind!=='feature'&&treeSel.length===1&&treeSel[0]===id)return true;
  treeSel=[id];
  if(sel.kind==='feature'||sel.kind==='sketch'||sel.kind==='cg')sel={kind:null,id:null}; // la fonction ouverte se referme
  renderTree();renderProps();refreshParts();
  return true;
}
function closestAxisPoints(c1,a1,c2,a2){
  const w0=c1.clone().sub(c2),b=a1.dot(a2),den=1-b*b;
  if(Math.abs(den)<1e-9){
    const q=c1.clone().addScaledVector(a1,c2.clone().sub(c1).dot(a1));
    return[q,c2.clone()];
  }
  const d=a1.dot(w0),e=a2.dot(w0);
  const sc=(b*e-d)/den,tc=(e-b*d)/den;
  return[c1.clone().addScaledVector(a1,sc),c2.clone().addScaledVector(a2,tc)];
}
function entraxePts(c1,a1,c2,a2){
  // Pieds anti-explosion : si quasi-parallèles (< 5°), mesure locale au point médian.
  if(Math.abs(a1.dot(a2))>Math.cos(5*Math.PI/180)){
    const m=c1.clone().add(c2).multiplyScalar(0.5);
    const q1=c1.clone().addScaledVector(a1,m.clone().sub(c1).dot(a1));
    const q2=c2.clone().addScaledVector(a2,m.clone().sub(c2).dot(a2));
    return{q1,q2,d:q1.distanceTo(q2),par:true};
  }
  const[q1,q2]=closestAxisPoints(c1,a1,c2,a2);
  return{q1,q2,d:q1.distanceTo(q2),par:false};
}
function drawAxis(center,axis,len){
  if(!selGroup){selGroup=new THREE.Group();mesScene().add(selGroup);}
  const a=center.clone().addScaledVector(axis,-len/2),b=center.clone().addScaledVector(axis,len/2);
  const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),
    new THREE.LineDashedMaterial({color:0xff9f0a,dashSize:len/20,gapSize:len/25,depthTest:false}));
  l.computeLineDistances();l.renderOrder=997;l.raycast=()=>{};selGroup.add(l);
}
function axisLen(){
  try{return Math.max(20,camera.position.distanceTo(controls.target)*0.4);}catch(e){return 40;}
}
function shiftMeasure(e){
  const h=pick(e);if(!h)return;
  const G=occFaceGeom(h.object,h.faceIndex);
  if(G&&G.kind==='cyl'){
    drawAxis(G.center,G.axis,axisLen());
    const q=G.center.clone().addScaledVector(G.axis,h.point.clone().sub(G.center).dot(G.axis));
    dimPair(q,h.point.clone(),'R '+G.r.toFixed(2));
    tagAt('Ø '+(G.r*2).toFixed(2),h.point.clone());
    faceEl.textContent=`Cylindre exact : Ø ${G.r.toFixed(2)} mm (R ${G.r.toFixed(2)})\nAxe=${G.axis.x.toFixed(3)}, ${G.axis.y.toFixed(3)}, ${G.axis.z.toFixed(3)} · centre=(${G.center.x.toFixed(1)}, ${G.center.y.toFixed(1)}, ${G.center.z.toFixed(1)})\nCtrl+clic un 2e cylindre = entraxe · Ctrl+clic un plan = cote axe↔face.`;
    return;
  }
  const box=new THREE.Box3().setFromObject(h.object);const s=box.getSize(new THREE.Vector3());
  const d=Math.min(s.x,s.y,s.z)||Math.max(s.x,s.y,s.z);
  dimPair(h.point.clone(),h.point.clone().add(new THREE.Vector3(0,0,d/2)),'Ø≈'+d.toFixed(1));
  faceEl.textContent=`Arête/solide : ${bodyName(h.object)}\nØ approx (boîte englobante) ≈ ${d.toFixed(2)} mm\n${occHas()?'(Cliquez une face cylindrique pour l\u2019Ø exact.)':'(Ø exact et entraxes : noyau OCCT requis — page en http://)'}`;
}
const bodyName=m=>(bodies.find(b=>b.mesh===m)||{name:m.name||'solide'}).name;
function faceArea(mesh,fi){
  try{const g=mesh.geometry;if(!g.index||fi===undefined)return 'n/a';
    const p=g.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    a.fromBufferAttribute(p,g.index.getX(fi*3));b.fromBufferAttribute(p,g.index.getX(fi*3+1));c.fromBufferAttribute(p,g.index.getX(fi*3+2));
    return (new THREE.Triangle(a,b,c).getArea()).toFixed(1)+' mm²';}catch(e){return 'n/a';}
}
function highlight(mesh,fi){
  if(!selGroup){selGroup=new THREE.Group();scene.add(selGroup);}
  const m=new THREE.Mesh(mesh.geometry,new THREE.MeshBasicMaterial({color:0xff9f0a,transparent:true,opacity:.35,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4,depthWrite:false}));
  m.applyMatrix4(mesh.matrixWorld);m.raycast=()=>{};selGroup.add(m);
}
const growCache=new WeakMap(); // géométrie -> {adj,fn,nTri} (surlignage + survol)
function growData(mesh){
  let d=growCache.get(mesh.geometry);
  if(d)return d;
  const g=mesh.geometry,pos=g.attributes.position;
  const idOf=new Map();let nid=0;
  const vid=i=>{const k=pos.getX(i).toFixed(4)+','+pos.getY(i).toFixed(4)+','+pos.getZ(i).toFixed(4);let id=idOf.get(k);if(id===undefined){id=nid++;idOf.set(k,id);}return id;};
  const idx=g.index,nTri=idx?idx.count/3:pos.count/3;
  if(!nTri||nTri>150000)return null;
  const T=new Array(nTri);
  for(let t=0;t<nTri;t++)T[t]=[vid(idx?idx.getX(3*t):3*t),vid(idx?idx.getX(3*t+1):3*t+1),vid(idx?idx.getX(3*t+2):3*t+2)];
  const adj=new Map();
  T.forEach((vs,t)=>{[[0,1],[1,2],[2,0]].forEach(([p,q])=>{const k=pairKey(vs[p],vs[q]);let a=adj.get(k);if(!a){a=[];adj.set(k,a);}if(a.length<2)a.push(t);});});
  d={adj,T,nTri};growCache.set(mesh.geometry,d);
  return d;
}
function growTris(mesh,tri0){
  // Région de même surface par propagation dièdre (10/20/30°), comme le viewer. Null si échec/trop gros.
  const d=growData(mesh);
  if(!d||tri0<0||tri0>=d.nTri)return null;
  const g=mesh.geometry,pos=g.attributes.position,idx=g.index;
  const A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),U=new THREE.Vector3(),V=new THREE.Vector3(),N=new THREE.Vector3();
  const fn=new Float32Array(d.nTri*3);
  for(let t=0;t<d.nTri;t++){
    A.fromBufferAttribute(pos,idx?idx.getX(3*t):3*t);B.fromBufferAttribute(pos,idx?idx.getX(3*t+1):3*t+1);C.fromBufferAttribute(pos,idx?idx.getX(3*t+2):3*t+2);
    U.subVectors(B,A);V.subVectors(C,A);N.crossVectors(U,V);
    const l=N.length()||1;fn[3*t]=N.x/l;fn[3*t+1]=N.y/l;fn[3*t+2]=N.z/l;
  }
  const neigh=t=>{
    const vs=d.T[t],res=[];
    [[vs[0],vs[1]],[vs[1],vs[2]],[vs[2],vs[0]]].forEach(([a,b])=>{
      (d.adj.get(pairKey(a,b))||[]).forEach(u=>{if(u!==t&&!res.includes(u))res.push(u);});
    });
    return res;
  };
  let best=[];
  for(const maxDeg of [10,20,30]){
    const cosMax=Math.cos(maxDeg*Math.PI/180);
    const seen=new Uint8Array(d.nTri);seen[tri0]=1;
    const stack=[tri0],out=[];
    while(stack.length&&out.length<20000){
      const t=stack.pop();out.push(t);
      neigh(t).forEach(u=>{
        if(seen[u])return;
        if(fn[3*t]*fn[3*u]+fn[3*t+1]*fn[3*u+1]+fn[3*t+2]*fn[3*u+2]>=cosMax){seen[u]=1;stack.push(u);}
      });
    }
    if(out.length>best.length)best=out;
    if(out.length>=25)break; // région large : comme le viewer, on s'arrête
  }
  return best.length?best:null;
}
function faceTrisFor(mesh,fi){
  // Triangles à surligner pour un triangle cliqué : face BRep exacte si dispo, sinon région propagée, sinon le triangle.
  try{
    const groups=mesh.geometry.userData.occGroups||[];
    const g=groups.find(g=>fi>=g.start&&fi<g.start+g.count);
    if(g){const out=[];for(let t=g.start;t<g.start+g.count;t++)out.push(t);return out;}
  }catch(e){}
  try{
    const grown=growTris(mesh,fi);
    if(grown&&grown.length)return grown;
  }catch(e){}
  return(fi>=0)?[fi]:null;
}
function highlightTris(mesh,tris,color,opacity,target){
  if(!tris||!tris.length)return;
  const grp=target||(()=>{if(!selGroup){selGroup=new THREE.Group();mesScene().add(selGroup);}return selGroup;})();
  mesh.updateMatrixWorld(true);
  const g=mesh.geometry,pos=g.attributes.position,idx=g.index;
  const arr=[],v=new THREE.Vector3();
  tris.forEach(t=>{
    for(let k=0;k<3;k++){
      const vi=idx?idx.getX(3*t+k):3*t+k;
      if(vi<0||vi>=pos.count)return;
      v.fromBufferAttribute(pos,vi).applyMatrix4(mesh.matrixWorld);
      arr.push(v.x,v.y,v.z);
    }
  });
  if(!arr.length)return;
  const hg=new THREE.BufferGeometry();
  hg.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
  hg.computeVertexNormals();
  // 2026-10-16-016 : surlignage MASQUÉ par la matière devant lui (depthTest) — avant, il se
  // voyait à travers la pièce (face arrière orange par-dessus les congés, paroi de poche
  // « flottante »). Exception : corps en verre, où l'on doit voir la face au travers.
  const xr=(()=>{try{const u=mesh.material&&mesh.material.userData;return !!(u&&typeof u.glass==='number'&&u.glass<0.999);}catch(e){return false;}})();
  const hm=new THREE.Mesh(hg,new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4,depthTest:xr?false:true,depthWrite:false}));
  hm.renderOrder=996;hm.raycast=()=>{};grp.add(hm);
}
let hoverGroup=null,hoverKey='',lastHoverT=0;
function clearHover(){
  hoverKey='';
  if(hoverGroup){hoverGroup.removeFromParent();hoverGroup.traverse(o=>{o.geometry&&o.geometry.dispose();o.material&&(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose&&m.dispose());});hoverGroup=null;}
}
// 2026-10-16-003 : PRÉSÉLECTION DES ARÊTES au survol (comme les faces) — surbrillance orange sanguine,
// ruban à peine plus épais que le trait normal (1,6 px au lieu de 1). Priorité à l'arête si le
// curseur est à ≤ 6 px d'elle ; une arête cachée derrière la face survolée est ignorée.
let edgeHoverCache={key:'',segs:null};
function edgeHoverSegs(){
  const key=(typeof _docVersion!=='undefined'?_docVersion:0)+'|'+bodyVisSig();
  if(edgeHoverCache.key===key&&edgeHoverCache.segs)return edgeHoverCache.segs;
  let data=[];try{data=edgeOverlayData()||[];}catch(e){data=[];}
  const out=[];
  data.forEach((d,ei)=>{const pts=d&&d.pts;if(!pts||pts.length<2)return;const M=(d.mw&&d.mw.elements)||null;
    const P=pts.map(p=>{let x=+p[0],y=+p[1],z=+p[2];if(M){const X=x,Y=y,Z=z;x=M[0]*X+M[4]*Y+M[8]*Z+M[12];y=M[1]*X+M[5]*Y+M[9]*Z+M[13];z=M[2]*X+M[6]*Y+M[10]*Z+M[14];}return[x,y,z];});
    out.push(P);});
  edgeHoverCache={key,segs:out};
  return out;
}
function edgeHoverPick(e,faceHit){return edgePickScreen(e,edgeHoverSegs(),faceHit,6);}
// 2026-10-26 : cœur commun du choix d'arête EN PIXELS (survol, sélection, congés/chanfreins) —
// segs = polylignes monde ; la plus proche du curseur à l'écran (≤ tolPx) gagne, à égalité
// (≤ 1 px) la plus proche de la caméra ; masquée si derrière la face sous le curseur, avec une
// marge de 2 px ramenée en mm (avant : +0,3 mm fixe, trop large sur une très petite pièce).
function edgePickScreen(e,segs,faceHit,tolPx){
  if(!segs||!segs.length)return null;
  const r=renderer.domElement.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  const v=new THREE.Vector3(),vz=new THREE.Vector3(),toS=p=>{vz.set(p[0],p[1],p[2]).applyMatrix4(camera.matrixWorldInverse);v.set(p[0],p[1],p[2]).project(camera);return[(v.x+1)/2*r.width,(1-v.y)/2*r.height,v.z,-vz.z];};
  let slack=0.3;
  if(faceHit){const wpp=camera.isOrthographicCamera?(camera.top-camera.bottom)/(camera.zoom||1)/r.height:2*faceHit.distance*Math.tan(camera.fov*Math.PI/360)/r.height;slack=Math.min(0.3,2*wpp);}
  let best=null,bd=(tolPx||6)*(window.mfmEdgeK||1); // interface téléphone : tolérance élargie au doigt (99-mobile-creer-esquisse)
  segs.forEach((P,pi)=>{
    if(!P||P.length<2)return;
    let a=toS(P[0]);
    for(let k=1;k<P.length;k++){
      const b=toS(P[k]);
      if(a[2]<1&&b[2]<1&&a[2]>-1&&b[2]>-1){
        const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1e-9;
        let t=((mx-a[0])*dx+(my-a[1])*dy)/L2;t=Math.max(0,Math.min(1,t));
        const d=Math.hypot(mx-(a[0]+t*dx),my-(a[1]+t*dy));
        if(d<bd+(best?1:0)){
          // paramètre 3D corrigé de la perspective (t écran ≠ t espace)
          if(!camera.isOrthographicCamera){const za=a[3],zb=b[3];const den=(1-t)*zb+t*za;if(Math.abs(den)>1e-12)t=t*za/den;}
          const w=[P[k-1][0]+(P[k][0]-P[k-1][0])*t,P[k-1][1]+(P[k][1]-P[k-1][1])*t,P[k-1][2]+(P[k][2]-P[k-1][2])*t];
          // masquée par la face survolée ? (l'arête doit être au moins aussi proche que la face)
          const dc=camera.position.distanceTo(new THREE.Vector3(w[0],w[1],w[2]));
          const better=!best||d<bd-1||(d<bd+1?dc<best.dc:false);
          if(better&&(!faceHit||dc<=faceHit.distance*1.004+slack)){bd=Math.min(d,bd);best={pi,dc,d};}
        }
      }
      a=b;
    }
  });
  return best;
}
function edgeHoverDraw(P,grp,color){
  // ruban écran : largeur 1,6 px à la profondeur de chaque point, face à la caméra
  const r=renderer.domElement.getBoundingClientRect();
  const wpp=q=>{if(camera.isOrthographicCamera)return (camera.top-camera.bottom)/(camera.zoom||1)/r.height;
    const d=camera.position.distanceTo(q);return 2*d*Math.tan(camera.fov*Math.PI/360)/r.height;};
  const pos=[],A=new THREE.Vector3(),B=new THREE.Vector3(),dir=new THREE.Vector3(),view=new THREE.Vector3(),n=new THREE.Vector3();
  for(let k=1;k<P.length;k++){
    A.set(P[k-1][0],P[k-1][1],P[k-1][2]);B.set(P[k][0],P[k][1],P[k][2]);
    dir.subVectors(B,A);if(dir.lengthSq()<1e-18)continue;
    view.subVectors(camera.position,A).normalize();n.crossVectors(dir,view).normalize();
    const ha=0.8*wpp(A),hb=0.8*wpp(B);
    const a1=[A.x+n.x*ha,A.y+n.y*ha,A.z+n.z*ha],a2=[A.x-n.x*ha,A.y-n.y*ha,A.z-n.z*ha];
    const b1=[B.x+n.x*hb,B.y+n.y*hb,B.z+n.z*hb],b2=[B.x-n.x*hb,B.y-n.y*hb,B.z-n.z*hb];
    pos.push(...a1,...a2,...b1,...b1,...a2,...b2);
  }
  if(!pos.length)return;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:color||0xff5a1f,side:THREE.DoubleSide,depthTest:true,depthWrite:false,transparent:true,opacity:0.95}));
  m.renderOrder=997;m.raycast=()=>{};grp.add(m);
}
function hoverMove(e){
  // Pré-sélection lumineuse au survol (comme le viewer), ~15 Hz max, jamais en orbite/clic.
  const meas=ctrlMesureEv(e); // Ctrl : les faces et arêtes s'allument aussi quand une fonction est ouverte, et en Assembler
  if(asmMode==='asm'&&!meas){if(hoverKey)clearHover();return;} // vue d'assemblage : seule la mesure survole
  if(skEdit||(!meas&&(filMode||filModeX||faoChainMode)))return;
  if(e.buttons!==0)return;
  const now=performance.now();if(now-lastHoverT<65)return;lastHoverT=now;
  try{
    if(!meas&&(triadHoverAt(e)||(typeof faoPoseHoverAt==='function'&&faoPoseHoverAt(e)))){if(hoverKey)clearHover();renderer.domElement.style.cursor='pointer';hoverMove._cur=1;return;}
    if(hoverMove._cur){hoverMove._cur=0;renderer.domElement.style.cursor='';}
    const h=meas?mesPick(e):pick(e);
    const segs=meas?mesEdgeSegs():edgeHoverSegs(),eh=edgePickScreen(e,segs,h,6);
    if(eh){
      const key='edge:'+eh.pi;if(key===hoverKey)return;
      clearHover();hoverKey=key;
      hoverGroup=new THREE.Group();mesScene().add(hoverGroup);
      edgeHoverDraw(segs[eh.pi],hoverGroup);
      return;
    }
    if(!h||h.faceIndex===undefined||h.faceIndex===null){if(hoverKey)clearHover();return;}
    const groups=(h.object.geometry.userData.occGroups||[]);
    const g=groups.find(g=>h.faceIndex>=g.start&&h.faceIndex<g.start+g.count);
    const key=h.object.uuid+':'+(g?('g'+g.f):('t'+h.faceIndex));
    if(key===hoverKey)return;
    clearHover();hoverKey=key;
    if(!hoverGroup){hoverGroup=new THREE.Group();mesScene().add(hoverGroup);}
    const tris=g?null:growTris(h.object,h.faceIndex);
    if(g){const out=[];for(let t=g.start;t<g.start+g.count&&out.length<4000;t++)out.push(t);highlightTris(h.object,out,0x0a84ff,0.35,hoverGroup);}
    else if(tris&&tris.length)highlightTris(h.object,tris.slice(0,4000),0x0a84ff,0.35,hoverGroup);
    else highlightTris(h.object,[h.faceIndex],0x0a84ff,0.35,hoverGroup);
  }catch(err){}
}
function clearMeasure(){
  selFaces=[];mesEtrangere=null;selEdges=[];selLabels=[];labelsDiv.innerHTML='';clearHover();
  // removeFromParent : les tracés sont dans la scène où ils ont été faits (mesScene), pas forcément celle de la pièce
  if(selGroup){selGroup.removeFromParent();selGroup=null;}
  if(measureGroup){measureGroup.removeFromParent();measureGroup=null;}
}
function tagAt(text,pos){
  if(!measureGroup){measureGroup=new THREE.Group();mesScene().add(measureGroup);}
  const dot=new THREE.Mesh(new THREE.SphereGeometry(0.9,10,10),new THREE.MeshBasicMaterial({color:0x30d158,depthTest:false,depthWrite:false,transparent:true}));dot.position.copy(pos);dot.renderOrder=999;dot.raycast=()=>{};measureGroup.add(dot);
  const el=document.createElement('div');el.className='mlabel';el.textContent=text;labelsDiv.appendChild(el);
  selLabels.push({el,getPos:()=>pos.clone()});
}
function dimPair(p1,p2,text){
  if(!measureGroup){measureGroup=new THREE.Group();mesScene().add(measureGroup);}
  const ml=new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1,p2]),new THREE.LineBasicMaterial({color:0x30d158,depthTest:false,depthWrite:false,transparent:true}));ml.renderOrder=999;ml.raycast=()=>{};measureGroup.add(ml);
  [p1,p2].forEach(p=>{const s=new THREE.Mesh(new THREE.SphereGeometry(1,10,10),new THREE.MeshBasicMaterial({color:0x30d158,depthTest:false,depthWrite:false,transparent:true}));s.position.copy(p);s.renderOrder=999;s.raycast=()=>{};measureGroup.add(s);});
  const el=document.createElement('div');el.className='mlabel';el.textContent=text;labelsDiv.appendChild(el);
  selLabels.push({el,getPos:()=>p1.clone().add(p2).multiplyScalar(.5)});
}
function updateLabels(){
  if(!selLabels.length)return;
  const r=renderer.domElement.getBoundingClientRect();
  selLabels.forEach(o=>{const p=o.getPos().clone().project(camera);o.el.style.left=((p.x*.5+.5)*r.width)+'px';o.el.style.top=((-p.y*.5+.5)*r.height)+'px';});
}
function recenter(e){
  const h=pick(e);if(!h||!controls)return;
  const p=h.point.clone(),off=camera.position.clone().sub(controls.target);
  controls.target.copy(p);camera.position.copy(p).add(off);controls.update();
}
function isolate(id){
  bodies.forEach(b=>{const on=(b.id===id);b.visible=on;b.mesh.visible=on;
    const f=doc.features.find(x=>x.id===b.ref);});
  doc.bodyVis={};bodies.forEach(b=>{doc.bodyVis[b.id]=b.visible;});markDirty();
  refreshParts();buildEdgeOverlay();refreshMirror();
}
function showAll2(){bodies.forEach(b=>{b.visible=true;b.mesh.visible=true;});doc.bodyVis={};doc.features.forEach(f=>f.visible=true);doc.sketches.forEach(s=>{if(!skIsRepCopy(s))s.visible=true;});markDirty();refreshParts();showAll();rebuild();} // esquisses copiées par une répétition : jamais montrées
