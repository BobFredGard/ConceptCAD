/* ═══════════════════════════════════════════════════════════════════════════
   RAINURE DE CLAVETTE AUTOMATIQUE (arbres et alésages)
   « CAO : j'aimerais une fonction clavette automatique pour les arbres et les alésages »
   Un clic sur un cylindre : face extérieure = arbre, face intérieure = alésage. Le Ø lu sur la pièce donne
   la ligne d'ISO 773 (STD_ISO773, 48-composants-normalises) : largeur b, profondeur t1 (arbre) ou t2 (moyeu).
   Comme le perçage sur cylindre (76-percage-cylindre), trois éléments ordinaires, une étape d'annulation :
     • un plan tangent (78, how:'tangent'), masqué, qui porte la position et les réglages : el.kw ;
     • une esquisse posée dessus, dont le contour est RÉÉCRIT par kwSync à chaque rejeu ;
     • une extrusion en découpe, f.kw = true, dont la profondeur est réécrite de même.
   La rainure suit donc le Ø : un arbre de 30 passé à 40 change de ligne d'ISO 773 tout seul. Répétition,
   FAO et mise en plan la voient comme n'importe quelle découpe.
   La clavette elle-même (« Oui, comme un corps de pièce ») : un corps séparé, en extrusion f.kwKey = id du plan,
   sur un plan décalé (el2.kwKeyOf) posé au fond de la rainure. kwSync réécrit aussi son contour et sa hauteur.
   el.kw = {bore, form, iso, b, t, h, L (null = automatique), end (±1, bout ouvert de la forme C), key (clavette posée)}
   Hauteurs comptées depuis l'axe, ISO 773 : fond à R − t1 (arbre), R + t2 (alésage).
   ═══════════════════════════════════════════════════════════════════════════ */
const KW_OVER=1; // mm : l'outil dépasse de la matière, il ne part jamais d'une surface tangente ou confondue
const KW_FORMS=[['A','Fermée, bouts ronds'],['B','Fermée, bouts droits'],['C','Débouchante d’un côté'],['T','Toute la longueur']];
function kwDims(kw,D){
  // Cotes de la rainure pour un Ø D → {b,t,h,row,iso,warn}
  const row=stdIso773For(D);
  if(kw.iso!==false&&row)return {b:row[2],h:row[3],t:kw.bore?row[5]:row[4],row,iso:true,warn:''};
  const b=+kw.b>0?+kw.b:+Math.max(1,D/4).toFixed(1),t=+kw.t>0?+kw.t:+(b*(kw.bore?0.4:0.6)).toFixed(1);
  const h=+kw.h>0?+kw.h:(row?row[3]:+(b*0.9).toFixed(1));
  return {b,t,h,row:row||null,iso:false,warn:kw.iso!==false?'Ø '+stdF(D)+' hors d’ISO 773 (6 à 130) : cotes à vérifier':''};
}
function kwPlaneOff(kw,R){
  // Hauteur du plan au-dessus du cylindre : au-dessus de l'arbre, au fond de la rainure dans un alésage
  return kw.bore?kwDims(kw,2*R).t:KW_OVER;
}
function kwAutoLen(kw,D,Lc,row){
  // Longueur de la série ISO : la plus grande qui tient dans le cylindre, sans dépasser 1,5 × Ø (usage courant)
  const room=Math.max(0,Lc-(kw.form==='C'?0:2)),top=Math.min(room,1.5*D);
  const lv=row?STD_KEY_LV.filter(v=>v>=row[6]&&v<=row[7]):STD_KEY_LV;
  let L=0;lv.forEach(v=>{if(v<=top+1e-9)L=v;});
  return L||Math.min(room,lv.length?lv[0]:room);
}
function kwSketchOf(el){return (doc.sketches||[]).find(s=>s.plane==='CG'&&s.cg&&s.cg.id===el.id)||null;}
function kwFeatureOf(sk){return sk?(doc.features||[]).find(f=>f&&f.kw&&f.sketchId===sk.id)||null:null;}
function kwPlaneOf(f){return f&&f.kw?holeCylPlane(f):null;}
function kwProbe(shape,pts){
  // Points dans la matière ? → tableau de booléens
  const cl=occClassifier(shape),T=occt.TopAbs_State.TopAbs_IN;
  try{
    return pts.map(q=>{const P=new occt.gp_Pnt_3(q[0],q[1],q[2]);try{cl.Perform(P,1e-6);return cl.State()===T;}finally{P.delete();}});
  }finally{cl.delete();}
}
function kwLoop(form,h,x0,x1,L,open){
  // Contour en repère d'esquisse : X = axe du cylindre, origine = point de position, h = demi-largeur
  if(form==='T')return [[x0,-h],[x1,-h],[x1,h],[x0,h]];
  if(form==='C'){
    if(open>0){const c=x1-L+h;return [[x1,-h],[x1,h],[c,h],[c,-h,{c:[c,0],ccw:true}]];}
    const c=x0+L-h;return [[x0,-h],[c,-h],[c,h,{c:[c,0],ccw:true}],[x0,h]];
  }
  const a=L/2;
  if(form==='B')return [[-a,-h],[a,-h],[a,h],[-a,h]];
  const m=a-h;
  return [[-m,-h],[m,-h],[m,h,{c:[m,0],ccw:true}],[-m,h],[-m,-h,{c:[-m,0],ccw:true}]];
}
/* ----- la clavette, corps séparé ----- */
function kwKeyPlane(el){return (doc.cgeo||[]).find(c=>c&&c.kwKeyOf===el.id)||null;}
function kwKeyFeature(el){return (doc.features||[]).find(f=>f&&f.kwKey===el.id)||null;}
function kwKeyAdd(el){
  // Plan au fond de la rainure, esquisse, extrusion en nouveau corps. Le contour vient de kwSync.
  // Le corps actif ne change pas : la suite du travail continue dans la pièce.
  if(kwKeyFeature(el))return;
  const n=(doc.cgeo||[]).filter(c=>c&&c.kwKeyOf).length+1;
  const e2=cgNew('plane','offset',[{k:'cg',id:el.id}],{d:0},'Plan de la clavette '+n);
  e2.visible=false;e2.kwKeyOf=el.id;
  const sk={id:uid('sk'),name:'Esquisse '+(doc.sketches.length+1)+' (corps de clavette)',plane:'CG',cg:{id:e2.id},
    points:{},entities:[],constraints:[],dims:[],seq:1,visible:false,origin:[0,0,0]};
  cgSyncSketch(sk);
  doc.sketches.push(sk);
  const kf={id:uid('ex'),type:'extrude',name:'Clavette',sketchId:sk.id,distance:1,op:'add',visible:true,mid:false,upto:null,kwKey:el.id,newBody:true};
  kf.body=extNewBody();
  addFeature(kf);
  el.kw.key=true;
}
function kwKeyRemove(el){
  // Retire la clavette : fonction, esquisse, plan et corps, s'il n'a rien reçu d'autre
  const kf=kwKeyFeature(el),e2=kwKeyPlane(el);
  el.kw.key=false;
  if(kf){
    doc.features=doc.features.filter(f=>f!==kf);
    doc.features.forEach(rp=>{if(rp.type==='repeat')rp.base=rp.base.filter(id=>id!==kf.id);});
    if(typeof tlMark!=='undefined'&&tlMark===kf.id)tlMark=null;
  }
  if(e2){
    const sk=kwSketchOf(e2);
    if(sk)doc.sketches=doc.sketches.filter(s=>s!==sk);
    doc.cgeo=doc.cgeo.filter(c=>c!==e2);
  }
  const bid=kf&&kf.body;
  if(bid&&!doc.features.some(f=>f.body===bid||f.newBody===bid||(f.type==='combine'&&(f.tools||[]).indexOf(bid)>=0))){
    doc.bodies=doc.bodies.filter(b=>b.id!==bid);
    if(doc.activeBody===bid)delete doc.activeBody;
  }
}
function kwOnDelete(f){
  // delFeature : supprimer la rainure retire sa clavette ; supprimer la clavette laisse la rainure
  if(f.kw){const el=holeCylPlane(f);if(el)kwKeyRemove(el);}
  else if(f.kwKey){const el=cgGet(f.kwKey);if(el){const k=f;doc.features.push(k);kwKeyRemove(el);}}
}
function kwKeySync(el,dm,L,pts){
  // Fond de la rainure → plan de la clavette ; hauteur vers l'axe dans un alésage, vers l'extérieur sur un arbre
  const kf=kwKeyFeature(el),e2=kwKeyPlane(el);
  if(!kf||!e2){if(el.kw.key)kwKeyRemove(el);return;}
  e2.p.d=el.kw.bore?0:-(dm.t+KW_OVER);
  kf.distance=el.kw.bore?-dm.h:dm.h;
  const sk=kwSketchOf(e2);
  if(sk){
    const sig=JSON.stringify(pts.map(p=>[+p[0].toFixed(6),+p[1].toFixed(6),p[2]?+p[2].c[0].toFixed(6):null]));
    if(sk.kwSig!==sig||!(sk.entities||[]).length){
      sk.points={};sk.entities=[];sk.constraints=[];sk.dims=[];sk.seq=1;
      stdLoop(sk,pts);sk.kwSig=sig;
    }
  }
  kf.name='Clavette '+stdF(dm.b)+' × '+stdF(dm.h)+' × '+stdF(L);
  const B=(doc.bodies||[]).find(b=>b.id===kf.body);
  if(B&&(/^Corps \d+$/.test(B.name||'')||/^Clavette /.test(B.name||'')))B.name=kf.name; // un nom donné à la main reste
}
function kwSync(el,ctx){
  // Réécrit le contour et la profondeur d'après le Ø réel. Appelé par cgResolveAll, plan tout juste résolu.
  if(!el||!el.kw||!el.fr)return;
  const sk=kwSketchOf(el);if(!sk)return;
  const f=kwFeatureOf(sk),kw=el.kw;
  const c=ctx||{},keep=c.self;c.self=el;
  try{
    const g0=cgEvalRef(el.refs[0],c),A=g0&&g0.axis;
    if(!A||!(A.r>0)||!(A.t1>A.t0))return;
    const R=+A.r,D=2*R,dm=kwDims(kw,D),warn=[];
    if(dm.warn)warn.push(dm.warn);
    const d=cgCylDir(A.d),rev=cgDot(d,cgUnit(A.d))<0;
    const t0=rev?-A.t1:A.t0,t1=rev?-A.t0:A.t1,Lc=t1-t0;
    const o=cgArr(el.fr.o),z=cgArr(el.fr.z),y=cgArr(el.fr.y),tO=cgDot(cgSub(o,A.o),d);
    const g=dm.b/2;
    if(!(dm.b<D)){el._kwOut={D,b:dm.b,t:dm.t,h:dm.h,L:0,iso:dm.iso,warn:'rainure plus large que le cylindre'};return;}
    if(!kw.bore&&!(dm.t<R))warn.push('rainure plus profonde que le rayon');
    const eLat=cgDot(cgSub(o,A.o),y),foot=cgAdd(A.o,cgMul(y,eLat));
    const at=(t,rad)=>cgAdd(cgAdd(foot,cgMul(d,t)),cgMul(z,rad));
    // Un bout de cylindre libre : l'outil dépasse. Un épaulement ou un fond : il s'y arrête, à fleur.
    let wall0=false,wall1=false,thin=false;
    const shape=cgShapeFor(c);
    if(shape){
      const rp=kw.bore?R+dm.t/2:R-dm.t/2;
      try{
        const P=kwProbe(shape,[at(t0-0.2,rp),at(t1+0.2,rp),at((t0+t1)/2,R+dm.t+0.2)]);
        wall0=P[0];wall1=P[1];thin=kw.bore&&!P[2];
      }catch(e){}
    }
    if(thin)warn.push('moyeu trop mince : la rainure le traverse');
    const auto=kwAutoLen(kw,D,Lc,dm.row);
    const asked=+kw.L>0?+kw.L:auto; // longueur utile, sur la matière
    let L=asked,Lout=asked;
    const x0=t0-tO-(wall0?0:KW_OVER),x1=t1-tO+(wall1?0:KW_OVER),open=kw.end<0?-1:1;
    if(kw.form==='T')Lout=Lc;
    else if(kw.form==='C'){
      if(asked>Lc+1e-6)warn.push('clavette plus longue que le cylindre');
      Lout=Math.max(Math.min(asked,Lc),g+0.01);
      L=Lout+(open>0?(wall1?0:KW_OVER):(wall0?0:KW_OVER)); // comptée depuis le bout de l'outil
    }else{
      if(kw.form==='A'&&L<dm.b+0.01)Lout=L=dm.b+0.01;
      if(L>Lc+1e-6)warn.push('clavette plus longue que le cylindre');
      else if(tO-L/2<t0-1e-6||tO+L/2>t1+1e-6)warn.push('la rainure dépasse du cylindre');
    }
    const pts=kwLoop(kw.form,g,x0,x1,L,open);
    const sig=JSON.stringify(pts.map(p=>[+p[0].toFixed(6),+p[1].toFixed(6),p[2]?+p[2].c[0].toFixed(6):null]));
    if(sk.kwSig!==sig||!(sk.entities||[]).length){
      sk.points={};sk.entities=[];sk.constraints=[];sk.dims=[];sk.seq=1;
      stdLoop(sk,pts);sk.kwSig=sig;
    }
    // Profondeur (vers −n) : du plan au fond pour un arbre ; du fond à sous la corde pour un alésage
    let depth=dm.t+KW_OVER;
    if(kw.bore){
      const e=Math.abs(eLat)+g,cord=e<R?Math.sqrt(R*R-e*e):0;
      depth=dm.t+(R-cord)+KW_OVER;
    }
    // La clavette : même contour que la rainure, sans le dépassement ; toute la longueur = clavette droite, centrée
    let Lk=Lout,ptsK;
    if(kw.form==='T'){
      Lk=Math.min(asked,Lc);
      const cx=(t0+t1)/2-tO;
      ptsK=kwLoop('B',g,0,0,Lk,1).map(p=>[p[0]+cx,p[1]]);
    }else if(kw.form==='C')ptsK=kwLoop('C',g,t0-tO,t1-tO,Lout,open);
    else ptsK=pts;
    if(kw.key)kwKeySync(el,dm,Lk,ptsK);
    el._kwOut={D:+D.toFixed(4),b:dm.b,t:dm.t,h:dm.h,L:+Lout.toFixed(3),Lk:+Lk.toFixed(3),iso:dm.iso,warn:warn.join(' ; ')};
    if(f){f.distance=-(+depth.toFixed(4));f.name=kwName(f);}
  }catch(e){
    el._kwOut=Object.assign({},el._kwOut||{},{warn:String((e&&e.message)||e)});
  }finally{c.self=keep;}
}
function kwName(f){
  const el=kwPlaneOf(f),O=el&&el._kwOut;
  if(!O||!O.D)return 'Rainure de clavette';
  return 'Rainure de clavette '+stdF(O.b)+' × '+stdF(O.L)+' ('+(el.kw.bore?'alésage':'arbre')+' Ø'+stdF(O.D)+')';
}
/* ----- création ----- */
function kwOnCylinder(C){
  // C : résultat de holeCylOfHit(…, true). Plan + esquisse + découpe, une seule étape d'annulation.
  const snap0=docSnap(),len0=docUndoStack.length;
  const D=holeCylDirection(C.A.d,C.rad);
  const n=(doc.cgeo||[]).filter(c=>c&&c.kw).length+1;
  const el=cgNew('plane','tangent',[{k:'face',ref:C.ref,name:entName('face')},D.ref,null],{a:D.a,d:0,e:0,side:1},'Plan de clavette '+n);
  el.visible=false;
  el.kw={bore:!!C.inner,form:C.inner?'T':'A',iso:true,b:0,t:0,h:0,L:null,end:C.t<0?-1:1,key:false};
  cgResolveOne(el,{});
  const fail=m=>{
    doc.cgeo=doc.cgeo.filter(c=>c!==el);docUndoStack.length=Math.min(docUndoStack.length,len0);
    try{faceEl.textContent='Clavette : '+m+'.';}catch(e){}
    return null;
  };
  if(!el.fr)return fail(el.msg||'plan tangent impossible');
  const sk={id:uid('sk'),name:'Esquisse '+(doc.sketches.length+1)+' (clavette)',plane:'CG',cg:{id:el.id},
    points:{},entities:[],constraints:[],dims:[],seq:1,visible:false,origin:[0,0,0]};
  cgSyncSketch(sk);
  doc.sketches.push(sk);
  kwSync(el,{});
  if(!sk.entities.length){
    doc.sketches=doc.sketches.filter(s=>s!==sk);
    return fail((el._kwOut&&el._kwOut.warn)||'cotes de rainure impossibles');
  }
  const nf={id:uid('ex'),type:'extrude',name:'',sketchId:sk.id,distance:-1,op:'cut',visible:true,mid:false,upto:null,kw:true};
  if(C.body)nf.body=C.body;
  addFeature(nf);
  kwKeyAdd(el);
  kwSync(el,{});
  docUndoStack.length=Math.min(docUndoStack.length,len0+1);
  fdynStart(nf,snap0,len0);
  sel={kind:'feature',id:nf.id};
  markDirty();rebuild();renderTree();renderProps();
  try{faceEl.textContent='Clavette : '+(el.kw.bore?'alésage':'arbre')+' reconnu, cotes ISO 773 appliquées. Réglez au besoin, puis OK (Échap = annuler).';}catch(e){}
  return el;
}
function kwStart(){
  // Bouton Clavette : cylindre déjà sélectionné, sinon on attend un clic
  if(!occHas()){alert('Clavette : le noyau exact doit être chargé.');return;}
  const F=selFaces&&selFaces[0];
  if(F&&F.mesh&&F.point){const C=holeCylOfHit(F.mesh,F.faceIndex,F.point,true);if(!C.err){kwOnCylinder(C);return;}}
  holeFacePick={which:'cylKw',fid:null};
  try{renderer.domElement.style.cursor='crosshair';}catch(e){}
  try{faceEl.textContent='Clavette : cliquez un ARBRE (face extérieure) ou un ALÉSAGE (face intérieure) — Échap pour annuler.';}catch(e){}
}
/* ----- panneau ----- */
function kwPanel(p,f){
  const el=kwPlaneOf(f);
  fdynEnsure(f);
  const pH=t=>{const h=document.createElement('div');h.className='pnl-h';h.textContent=t;p.appendChild(h);return h;};
  const pRow=(lab,x)=>{const r=document.createElement('div');r.className='pnl-row';
    const L=document.createElement('label');L.textContent=lab;r.appendChild(L);if(x)r.appendChild(x);p.appendChild(r);return r;};
  const pNote=t=>{const n=document.createElement('div');n.className='pnl-note';n.textContent=t;p.appendChild(n);return n;};
  if(!el){pNote('⚠ Plan de la clavette introuvable.');fdynFoot(p,f);return;}
  const kw=el.kw,O=el._kwOut||{};
  const go=()=>{markDirty();rebuild();renderTree();renderProps();};
  const set=fn=>{docPushUndo('clavette');fn();go();};
  const select=(opts,val,fn)=>{
    const s=document.createElement('select');
    opts.forEach(o=>{const q=document.createElement('option');q.value=o[0];q.textContent=o[1];s.appendChild(q);});
    s.value=val;s.onchange=()=>set(()=>fn(s.value));return s;
  };
  const num=(val,fn)=>{
    const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.style.width='70px';
    i.value=String(+(+val||0).toFixed(3)).replace('.',',');
    const c=()=>{const v=parseFloat(String(i.value).replace(',','.'));if(isFinite(v)&&v>0&&v!==+val)set(()=>fn(v));};
    i.addEventListener('change',c);
    i.addEventListener('keydown',e=>{if(e.key==='Enter'){c();i.blur();}e.stopPropagation();});
    i.addEventListener('click',e=>e.stopPropagation());
    return i;
  };
  const mini=(t,title,fn)=>{const b=document.createElement('button');b.className='mini';b.textContent=t;b.title=title;b.onclick=fn;return b;};
  const span=list=>{const w=document.createElement('span');w.style.cssText='display:flex;gap:4px;align-items:center;flex:1;justify-content:flex-end';
    list.forEach(x=>w.appendChild(x));return w;};
  pH('Rainure de clavette');
  if(O.D)pNote((kw.bore?'Alésage':'Arbre')+' Ø'+stdF(O.D)+(O.iso?' — ISO 773 : clavette '+stdF(O.b)+' × '+stdF(O.h)+', rainure '+(kw.bore?'t2 ':'t1 ')+stdF(O.t):' — cotes manuelles'));
  if(O.warn)pNote('⚠ '+O.warn);
  pRow('Pièce',select([['shaft','Arbre'],['bore','Alésage']],kw.bore?'bore':'shaft',v=>{kw.bore=v==='bore';}));
  pRow('Forme',select(KW_FORMS,kw.form,v=>{kw.form=v;}));
  const kc=document.createElement('input');kc.type='checkbox';kc.checked=!!kw.key;
  kc.title='Crée la clavette comme un corps séparé de la pièce, posée au fond de la rainure';
  kc.onchange=()=>{
    const len=docUndoStack.length;
    docPushUndo('clavette');
    if(kc.checked)kwKeyAdd(el);else kwKeyRemove(el);
    docUndoStack.length=Math.min(docUndoStack.length,len+1);
    go();
  };
  pRow('Clavette (corps séparé)',kc);
  if(kw.form!=='T'||kw.key){
    const l=[num((kw.form==='T'?O.Lk:O.L)||kw.L||0,v=>{kw.L=v;})];
    if(kw.L)l.push(mini('Auto','Reprendre la longueur de la série ISO, adaptée au cylindre',()=>set(()=>{kw.L=null;})));
    pRow(kw.form==='T'?'Long. clavette (mm)':'Longueur (mm)',span(l));
  }
  if(kw.form==='C')pRow('Bout ouvert',span([mini('⇄','Déboucher de l’autre côté du cylindre',()=>set(()=>{kw.end=kw.end<0?1:-1;}))]));
  const iso=document.createElement('input');iso.type='checkbox';iso.checked=kw.iso!==false;
  iso.onchange=()=>set(()=>{kw.iso=iso.checked;if(!iso.checked){kw.b=O.b||kw.b;kw.t=O.t||kw.t;kw.h=O.h||kw.h;}});
  pRow('Cotes ISO 773',iso);
  if(kw.iso===false){
    pRow('Largeur (mm)',num(O.b||kw.b,v=>{kw.b=v;}));
    pRow('Profondeur (mm)',num(O.t||kw.t,v=>{kw.t=v;}));
    if(kw.key)pRow('Hauteur de la clavette (mm)',num(O.h||kw.h,v=>{kw.h=v;}));
  }
  renderHoleCylProps(f,el,{pH,pRow,pNote,go,what:'Clavette',noCote:kw.form==='C'||kw.form==='T',noNote:true});
  fdynFoot(p,f);
}
function kwKeyPanel(p,f){
  // La clavette se règle depuis sa rainure : ses cotes y sont recalculées à chaque rejeu
  const n=document.createElement('div');n.className='pnl-note';
  n.textContent='Corps de clavette, posé au fond de sa rainure. Ses cotes suivent la rainure et le Ø.';p.appendChild(n);
  const el=cgGet(f.kwKey),sk=el&&kwSketchOf(el),rf=kwFeatureOf(sk);
  if(rf){
    const d=document.createElement('div');d.className='pnl-btns';
    const b=document.createElement('button');b.className='mini';b.textContent='Régler depuis la rainure';
    b.onclick=()=>{sel={kind:'feature',id:rf.id};renderTree();renderProps();};
    d.appendChild(b);p.appendChild(d);
  }
}
