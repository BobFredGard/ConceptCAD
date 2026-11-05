/* ═══════════════════════════════════════════════════════════════════════════
   PERÇAGE SUR UN CYLINDRE
   « Fusion permet de faire un perçage sur un cylindre : je dois pouvoir le positionner suivant une
   direction et coter sa position par rapport à une face, une arête, etc. »
   Un clic sur la face EXTÉRIEURE d'un cylindre crée, en une seule étape d'annulation :
     • un plan de construction tangent (78, how:'tangent'), masqué, qui porte le placement :
       refs = [cylindre, direction, référence de cote], p = {a (angle), d (cote), side (côté), e (décalage)} ;
     • une esquisse posée dessus, avec le centre de perçage à son origine ;
     • une fonction Perçage ordinaire : tous ses types, sa répétition et la FAO fonctionnent à l'identique.
   Le plan se résout à chaque rejeu sur le solide qui le précède : le trou suit le cylindre, la direction
   et la référence. La profondeur se compte depuis le plan tangent, comme dans Fusion.
   ═══════════════════════════════════════════════════════════════════════════ */
const HOLE_CYL_SNAP=10; // ° : un clic aussi près d'un axe du repère prend exactement cette direction
const HOLE_CYL_AXES={X:[1,0,0],Y:[0,1,0],Z:[0,0,1]};
function holeCylPlane(f){
  // Plan tangent qui porte le perçage, ou null pour un perçage ordinaire
  const sk=f&&(doc.sketches||[]).find(function(s){return s.id===f.sketchId;});
  const el=sk&&sk.plane==='CG'&&sk.cg?cgGet(sk.cg.id):null;
  return el&&el.kind==='plane'&&el.how==='tangent'?el:null;
}
function holeCylOfHit(mesh,fi,point){
  // Face cliquée → {ref,A,rad,t,body} ou {err}
  const hit=occFaceOfHit(mesh,fi);
  if(!hit||!hit.face)return {err:'face illisible (noyau exact requis)'};
  try{
    if(occSurfKind(hit.face)!=='Cylinder')return {err:'cliquez une face CYLINDRIQUE'};
    const ref=occFaceRefAny(hit.face);if(!ref)return {err:'face illisible'};
    const g=cgEvalRef({k:'face',ref:ref},null),A=g&&g.axis;
    if(!A||!(A.r>0))return {err:'cylindre introuvable'};
    const d=cgCylDir(A.d),P=cgArr(point),w=cgSub(P,A.o),t=cgDot(w,d),rad=cgSub(w,cgMul(d,t));
    if(cgLen(rad)<1e-6)return {err:'point cliqué sur l’axe'};
    const nw=faceNormalWorld(mesh,fi);
    if(nw&&cgDot(cgArr(nw),rad)<0)return {err:'cliquez la face EXTÉRIEURE du cylindre (l’intérieur d’un alésage n’est pas pris en charge)'};
    const inDoc=hit.bd&&(doc.bodies||[]).some(function(b){return b.id===hit.bd.id;});
    return {ref:ref,A:{o:A.o,d:d,r:A.r},rad:cgUnit(rad),t:t,body:inDoc?hit.bd.id:null};
  }catch(e){return {err:String((e&&e.message)||e)};}
  finally{try{hit.face.delete();}catch(e){}}
}
function holeCylFreeAngle(d,rad){
  // Angle (°) du rayon autour de l'axe, depuis la direction par défaut de cgTangentBuild
  const u=cgBasisN(d,null).u;
  return Math.atan2(cgDot(cgCross(u,rad),d),cgDot(u,rad))*180/Math.PI;
}
function holeCylDirection(d,rad){
  // Axe du repère proche du point cliqué, sinon angle libre (arrondi au degré) → {ref,a}
  for(const id of Object.keys(HOLE_CYL_AXES)){
    const w=HOLE_CYL_AXES[id],pr=cgSub(w,cgMul(d,cgDot(w,d)));
    if(cgLen(pr)<0.5)continue;
    const c=cgDot(cgUnit(pr),rad);
    if(Math.abs(c)>=Math.cos(HOLE_CYL_SNAP*Math.PI/180))return {ref:{k:'o',id:id},a:c>0?0:180};
  }
  return {ref:null,a:Math.round(holeCylFreeAngle(d,rad))};
}
function holeOnCylinder(C){
  // C : résultat de holeCylOfHit. Plan + esquisse + perçage, une seule étape d'annulation.
  const snap0=docSnap(),len0=docUndoStack.length;
  const D=holeCylDirection(C.A.d,C.rad);
  const t=Math.abs(C.t)<1?0:C.t; // à moins d'1 mm du milieu : au milieu
  const n=(doc.cgeo||[]).filter(function(c){return c&&c.how==='tangent';}).length+1;
  const el=cgNew('plane','tangent',[{k:'face',ref:C.ref,name:entName('face')},D.ref,null],
    {a:D.a,d:+Math.abs(t).toFixed(1),e:0,side:t<0?-1:1},'Plan tangent '+n);
  el.visible=false;
  if(!el.fr){
    doc.cgeo=doc.cgeo.filter(function(c){return c!==el;});docUndoStack.length=Math.min(docUndoStack.length,len0);
    try{faceEl.textContent='Perçage : '+(el.msg||'plan tangent impossible')+'.';}catch(e){}
    return null;
  }
  const sk={id:uid('sk'),name:'Esquisse '+(doc.sketches.length+1)+' (cylindre)',plane:'CG',cg:{id:el.id},
    points:{},entities:[],constraints:[],dims:[],seq:1,visible:false,origin:[0,0,0]};
  const pid=skNewPid(sk);sk.points[pid]={x:0,y:0};
  sk.entities.push({id:skNewEid(sk),t:'cpoint',p:pid,hole:true});
  cgSyncSketch(sk);
  doc.sketches.push(sk);
  // Ø et profondeur de départ à l'échelle du cylindre : jusqu'à l'axe, sans dépasser les valeurs habituelles
  const init={d:Math.min(6.6,+C.A.r.toFixed(1)),depth:Math.min(15,+C.A.r.toFixed(2))};
  if(C.body)init.body=C.body;
  askHole(sk.id,{snap:snap0,len:len0,init:init});
  docUndoStack.length=Math.min(docUndoStack.length,len0+1);
  try{faceEl.textContent='Perçage sur cylindre : réglez la direction et la cote dans le panneau, puis OK (Échap = annuler).';}catch(e){}
  return el;
}
function holeStart(){
  // Bouton Perçage : esquisse choisie, puis cylindre sélectionné, puis centres pas encore percés ;
  // sinon on attend un clic sur un cylindre.
  const s=sel&&sel.kind==='sketch'?doc.sketches.find(function(x){return x.id===sel.id;}):null;
  if(s&&holePoints(s).length){askHole(s.id);return;}
  if(!occHas()){askHole(null);return;}
  const F=selFaces&&selFaces[0];
  if(F&&F.mesh&&F.point){const C=holeCylOfHit(F.mesh,F.faceIndex,F.point);if(!C.err){holeOnCylinder(C);return;}}
  const used=new Set((doc.features||[]).filter(function(f){return f.type==='hole';}).map(function(f){return f.sketchId;}));
  for(let i=doc.sketches.length-1;i>=0;i--){
    const q=doc.sketches[i];
    if(!used.has(q.id)&&holePoints(q).length){askHole(q.id);return;}
  }
  holeFacePick={which:'cyl',fid:null};
  try{renderer.domElement.style.cursor='crosshair';}catch(e){}
  try{faceEl.textContent='Perçage : cliquez un CYLINDRE de la pièce, ou placez d’abord des centres dans une esquisse (outil ⊕) — Échap pour annuler.';}catch(e){}
}
function holeCylRefPick(e,which){
  // Référence sous le curseur. Cote : plan, arête ou sommet. Direction : axe, arête ou face plane.
  const body=pick(e);
  const c=cgPickAt(e);
  if(c&&!(c.plane&&body&&body.distance<c.dist-1e-6))return c.sub?{k:'cg',id:c.id,sub:c.sub}:{k:'cg',id:c.id};
  const tp=triadPickPlane(e);if(tp)return {k:'o',id:tp};
  const model=function(how,slot){return cgPickModelRef(e,{kind:'plane',how:how},slot);};
  const r=(which==='cylDir'?model('tangent',0):model('tangent',2))||model('offset',0);
  if(r)return r;
  if(!body){const pl=pickPlane(e);if(pl)return {k:'o',id:pl};}
  return null;
}
function holeCylPlacement(el,ref){
  // Cote qui garde le trou où il est, mesurée depuis la référence → {d,side}. Lève si inutilisable.
  const g=cgEvalRef(ref,{}),A0=cgEvalRef(el.refs[0],{});
  if(!g)throw new Error('référence illisible');
  if(!A0||!A0.axis||!el.fr)throw new Error('cylindre introuvable');
  const d=cgCylDir(A0.axis.d),here=cgDot(cgSub(el.fr.o,A0.axis.o),d),tRef=cgAxialOf(ref,g,A0.axis.o,d);
  // Le plan se calcule sur la pièce d'AVANT le trou : le bord du trou, ou une fonction plus récente,
  // n'y existe pas et la référence irait se poser ailleurs (le trou sauterait).
  const ctx={self:el,shapes:new Map()};
  try{
    const c=JSON.parse(JSON.stringify(ref)),gp=cgEvalRef(c,ctx);
    if(!gp||Math.abs(cgAxialOf(c,gp,A0.axis.o,d)-tRef)>0.01)
      throw new Error('cette référence appartient au trou ou à une fonction plus récente : choisissez-en une qui existait avant');
  }finally{cgShapesRelease(ctx);}
  const v=here-tRef;
  return {d:+Math.abs(v).toFixed(2),side:v<0?-1:1};
}
function holeCylPickAt(e){
  const W=holeFacePick,msg=function(t){try{faceEl.textContent='Perçage : '+t;}catch(err){}};
  if(W.which==='cyl'){
    const h=pick(e);if(!h){msg('aucune face sous le curseur.');return true;}
    const C=holeCylOfHit(h.object,h.faceIndex,h.point);
    if(C.err){msg(C.err+'.');return true;}
    holeFacePickCancel();holeOnCylinder(C);
    return true;
  }
  const f=doc.features.find(function(x){return x.id===W.fid;}),el=holeCylPlane(f);
  if(!el){holeFacePickCancel();return false;}
  const ref=holeCylRefPick(e,W.which);
  if(!ref){msg('rien de reconnu ici.');return true;}
  try{
    if(W.which==='cylPos'){
      const P=holeCylPlacement(el,ref);
      docPushUndo('perçage : référence de cote');
      el.refs[2]=ref;el.p.d=P.d;el.p.side=P.side;
      if(el.p.expr)delete el.p.expr.d;
    }else{
      const g=cgEvalRef(ref,{}),v=g&&(g.axis?g.axis.d:(g.plane?g.plane.n:null));
      if(!v)throw new Error('choisissez un axe, une arête droite ou une face plane');
      const A0=cgEvalRef(el.refs[0],{}),d=A0&&A0.axis?cgCylDir(A0.axis.d):cgArr(el.fr.x),u=cgUnit(v);
      if(cgLen(cgCross(u,d))<1e-6)throw new Error('direction parallèle à l’axe du cylindre');
      docPushUndo('perçage : direction');
      el.refs[1]=ref;el.p.a=0;
      if(el.p.expr)delete el.p.expr.a;
    }
  }catch(err){msg(((err&&err.message)||err)+'.');return true;}
  holeFacePickCancel();
  f.name=holeName(f);markDirty();rebuild();renderTree();renderProps();
  msg(W.which==='cylPos'?'référence retenue — tapez la cote voulue.':'direction retenue.');
  return true;
}
/* ----- panneau ----- */
function renderHoleCylProps(f,el,U){
  // U : aides du panneau Perçage {pH,pRow,pNote,go}
  const start=function(which,txt){
    holeFacePick={which:which,fid:f.id};
    try{renderer.domElement.style.cursor='crosshair';}catch(e){}
    try{faceEl.textContent='Perçage : '+txt+' — Échap pour annuler.';}catch(e){}
  };
  const startDir=function(){start('cylDir','cliquez un axe, une arête droite ou une face plane (direction du trou)');};
  const startPos=function(){start('cylPos','cliquez une face, une arête ou un sommet (référence de la cote)');};
  // valeur signée ou nulle, ƒx comprise (les champs du perçage n'acceptent que > 0)
  const field=function(k,min){
    const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.style.width='70px';
    i.value=String(+(+el.p[k]||0).toFixed(3)).replace('.',',');
    if(typeof parFx==='function')parFx(i,el.p,k);
    const c=function(){
      const v=parseFloat(String(i.value).replace(',','.'));
      if(!isFinite(v)||(min!=null&&v<min)||v===+el.p[k])return;
      docPushUndo('perçage : position');el.p[k]=v;U.go();
    };
    i.addEventListener('change',c);
    i.addEventListener('keydown',function(e){if(e.key==='Enter'){c();i.blur();}e.stopPropagation();});
    i.addEventListener('click',function(e){e.stopPropagation();});
    return i;
  };
  const mini=function(t,title,fn){
    const b=document.createElement('button');b.className='mini';b.textContent=t;b.title=title;b.onclick=fn;return b;
  };
  const span=function(list){
    const w=document.createElement('span');w.style.cssText='display:flex;gap:4px;align-items:center;flex:1;justify-content:flex-end';
    list.forEach(function(x){w.appendChild(x);});return w;
  };
  U.pH('Position sur le cylindre');
  if(el.st==='warn'&&el.msg)U.pNote('⚠ '+el.msg);
  /* direction */
  const r1=el.refs[1],a=((+el.p.a||0)%360+360)%360;
  const cur=r1&&r1.k==='o'&&HOLE_CYL_AXES[r1.id]&&(a===0||a===180)?(a?'-':'+')+r1.id:(r1?'ref':'free');
  const opts=[];
  const dAxe=el.fr?el.fr.x:[0,0,1];
  Object.keys(HOLE_CYL_AXES).forEach(function(id){
    if(cgLen(cgCross(HOLE_CYL_AXES[id],dAxe))<0.5)return; // le long du cylindre : impossible
    opts.push(['+'+id,'Suivant +'+id],['-'+id,'Suivant −'+id]);
  });
  opts.push(['free','Angle libre'],['ref',r1&&cur==='ref'?cgRefLabel(r1):'Face ou arête…']);
  const s=document.createElement('select');
  opts.forEach(function(o){const q=document.createElement('option');q.value=o[0];q.textContent=o[1];s.appendChild(q);});
  s.value=cur;
  s.onchange=function(){
    const v=s.value;
    if(v==='ref'){startDir();return;}
    docPushUndo('perçage : direction');
    if(el.p.expr)delete el.p.expr.a;
    if(v==='free'){el.refs[1]=null;if(el.fr)el.p.a=Math.round(holeCylFreeAngle(cgArr(el.fr.x),cgArr(el.fr.z)));}
    else{el.refs[1]={k:'o',id:v[1]};el.p.a=v[0]==='-'?180:0;}
    U.go();
  };
  U.pRow('Direction',s);
  U.pRow('Angle (°)',field('a'));
  /* cote */
  const r2=el.refs[2];
  const bRef=mini(r2?cgRefLabel(r2):'Milieu du cylindre','Choisir la face, l’arête ou le sommet depuis lequel la cote est mesurée',startPos);
  const lRef=[bRef];
  if(r2)lRef.push(mini('✕','Mesurer depuis le milieu du cylindre (le trou ne bouge pas)',function(){
    docPushUndo('perçage : référence de cote');
    try{
      const A0=cgEvalRef(el.refs[0],{}),d=cgCylDir(A0.axis.d),v=cgDot(cgSub(el.fr.o,A0.axis.o),d);
      el.p.d=+Math.abs(v).toFixed(2);el.p.side=v<0?-1:1;if(el.p.expr)delete el.p.expr.d;
    }catch(e){}
    el.refs[2]=null;U.go();
  }));
  U.pRow('Cote depuis',span(lRef));
  U.pRow('Cote (mm)',span([field('d',0),mini('⇄','Passer de l’autre côté de la référence',function(){
    docPushUndo('perçage : position');el.p.side=(+el.p.side<0)?1:-1;U.go();
  })]));
  U.pRow('Décalage latéral (mm)',field('e'));
  U.pNote('La profondeur se compte depuis le sommet du cylindre (plan tangent).');
}
