/* ---------- Esquisse : oblong en 3 clics (comme Fusion 360) ----------
   2026-11-06 : « quand on crée un oblong, il est créé par 2 points et le positionnement du rayon
   souhaité. Toutes les cotes sont créées à ce moment-là, au 3ᵉ clic. » Trois façons de le poser :
   - centres : les 2 centres des demi-cercles, puis le rayon ;
   - bouts   : les 2 points extrêmes des demi-cercles, puis le rayon ;
   - milieu  : le milieu de la droite qui relie les centres, un centre (l'écartement), puis le rayon.
   Dans toutes les directions ; un oblong à plat (± 3°) reçoit H ou V.
   « Les points créés, s'ils sont dans le vide, ne pas les fixer » : aucun « Fixe » ; un point cliqué
   sur une géométrie s'y accroche (point partagé ou contrainte), un point dans le vide reste libre,
   et les autres points de l'oblong ne s'attachent pas à ce qui passe à côté.
   Modèle : 2 côtés et 2 arcs tangents, rayons égaux, droite de construction entre les centres
   (entraxe : le glisser d'un centre reste rigide). Cotes : entraxe (centres, milieu) ou longueur
   hors tout (bouts) ; rayon. */
const SK_SLOT_MODES=[
  ['centres','2 centres','Cliquez les 2 centres des demi-cercles, puis le rayon'],
  ['bouts','2 extrémités','Cliquez les 2 points extrêmes des demi-cercles, puis le rayon'],
  ['milieu','Centre','Cliquez le milieu, l’écartement (un centre de demi-cercle), puis le rayon']];
const skSlot={mode:'centres'}; // gardé d'un oblong au suivant
const SK_SLOT_MSG={
  centres:['Oblong : cliquez le 1er centre.','Oblong : cliquez le 2e centre.'],
  bouts:['Oblong : cliquez le 1er point extrême.','Oblong : cliquez le 2e point extrême.'],
  milieu:['Oblong : cliquez le milieu.','Oblong : cliquez un centre de demi-cercle (l’écartement).']};
const SK_SLOT_FLAT=3*Math.PI/180;
// les 2 centres d'après les 2 points cliqués et le rayon
function skSlotCentres(mode,A,B,r){
  if(mode==='milieu')return{c1:{x:2*A.x-B.x,y:2*A.y-B.y},c2:{x:B.x,y:B.y}};
  if(mode==='bouts'){
    const L=Math.hypot(B.x-A.x,B.y-A.y)||1,ux=(B.x-A.x)/L,uy=(B.y-A.y)/L;
    return{c1:{x:A.x+ux*r,y:A.y+uy*r},c2:{x:B.x-ux*r,y:B.y-uy*r}};
  }
  return{c1:{x:A.x,y:A.y},c2:{x:B.x,y:B.y}};
}
// le rayon laisse-t-il un entraxe ? (en « bouts », le hors-tout doit dépasser 2 R)
function skSlotRayonOk(mode,A,B,r){
  if(!(r>skMinLen()))return false;
  const L=Math.hypot(B.x-A.x,B.y-A.y);
  return mode!=='bouts'||L-2*r>skMinLen();
}
/* Crée l'oblong. a, b = pid des 2 points cliqués ; ils ne bougent que s'ils sont libres (fa, fb :
   accrochés), pour tomber sur une cote ronde. Rend {lines,arcs,axis,dims} ou null. */
function skSlotCreate(sk,mode,a,b,r0,fa,fb){
  const A=sk.points[a],B=sk.points[b];if(!A||!B)return null;
  const r=+r0.toFixed(2);
  let L=Math.hypot(B.x-A.x,B.y-A.y);if(!(L>1e-6))return null;
  // écart cliqué arrondi, en déplaçant l'extrémité libre (2 points accrochés : la cote prend l'écart exact)
  const ux0=(B.x-A.x)/L,uy0=(B.y-A.y)/L;
  if(!fb||!fa){
    const Ln=+L.toFixed(2);
    if(Ln>0){
      if(!fb){B.x=A.x+ux0*Ln;B.y=A.y+uy0*Ln;}else{A.x=B.x-ux0*Ln;A.y=B.y-uy0*Ln;}
      L=Ln;
    }
  }
  if(mode==='bouts'&&!(L-2*r>1e-6))return null;
  const{c1,c2}=skSlotCentres(mode,A,B,r);
  const d=Math.hypot(c2.x-c1.x,c2.y-c1.y);if(!(d>1e-6))return null;
  const ux=(c2.x-c1.x)/d,uy=(c2.y-c1.y)/d,nx=-uy*r,ny=ux*r;
  const h=Math.abs(uy)<1e-9,v=Math.abs(ux)<1e-9;
  const pc1=mode==='centres'?a:addPoint(sk,c1.x,c1.y);
  const pc2=mode==='bouts'?addPoint(sk,c2.x,c2.y):b;
  const p1=pidAt(sk,c1.x+nx,c1.y+ny),p2=pidAt(sk,c2.x+nx,c2.y+ny),p3=pidAt(sk,c2.x-nx,c2.y-ny),p4=pidAt(sk,c1.x-nx,c1.y-ny);
  const id=()=>skNewEid(sk);
  const l1={id:id(),t:'line',p1,p2},l2={id:id(),t:'line',p1:p4,p2:p3};
  const a1={id:id(),t:'arc',pc:pc1,pa:p1,pb:p4,r},a2={id:id(),t:'arc',pc:pc2,pa:p3,pb:p2,r};
  const axis={id:id(),t:'line',p1:pc1,p2:pc2,construction:true};
  sk.entities.push(l1,l2,a1,a2,axis);
  // seuls les points cliqués s'accrochent : les autres ne s'attachent qu'à ce qui les touche exactement
  [p1,p2,p3,p4].forEach(p=>{const q=sk.points[p];skAutoAttach(sk,p,q.x,q.y,1e-3);});
  [[a,fa],[b,fb]].forEach(([p,f])=>{const q=sk.points[p];skAutoAttach(sk,p,q.x,q.y,f?undefined:1e-3);});
  const dir=h?'h':v?'v':null;
  if(dir)[l1,l2,axis].forEach(l=>sk.constraints.push({id:id(),type:dir,line:l.id}));
  else[l1,l2].forEach(l=>sk.constraints.push({id:id(),type:'parallel',a:axis.id,b:l.id}));
  [[l1,a1],[l1,a2],[l2,a1],[l2,a2]].forEach(([l,e])=>sk.constraints.push({id:id(),type:'tangent',line:l.id,ent:e.id}));
  sk.constraints.push({id:id(),type:'equal',a:a1.id,b:a2.id});
  const dims=[];
  const cote=q=>{const o=Object.assign({id:id()},q);sk.dims.push(o);dims.push(o);};
  if(mode==='bouts'){
    // hors-tout : droite de construction d'un bout à l'autre, centres dessus, bouts sur les arcs
    const hors={id:id(),t:'line',p1:a,p2:b,construction:true};
    sk.entities.push(hors);
    if(dir)sk.constraints.push({id:id(),type:dir,line:hors.id});
    [pc1,pc2].forEach(p=>sk.constraints.push({id:id(),type:'online',p,line:hors.id}));
    sk.constraints.push({id:id(),type:'oncircle',p:a,ent:a1.id},{id:id(),type:'oncircle',p:b,ent:a2.id});
    cote({type:'length',line:hors.id,value:+L.toFixed(fa&&fb?6:2)});
  }else{
    if(mode==='milieu')sk.constraints.push({id:id(),type:'midpoint',p:a,line:axis.id});
    cote({type:'length',line:axis.id,value:+d.toFixed(fa&&fb?6:2)});
  }
  cote({type:'radius',ent:a1.id,value:r});
  return{lines:[l1,l2],arcs:[a1,a2],axis,dims};
}
// point visé : accroche d'abord, puis grille, puis à plat si l'axe est presque horizontal ou vertical
function skSlotAim(sk,wx,wy,from){
  const s=findSnap(sk,wx,wy,skDown&&skDown.pid);
  if(s)return{x:s.x,y:s.y,s};
  let x=wx,y=wy;
  if($('skSnap').checked){x=skSnapVal(x);y=skSnapVal(y);}
  if(from){
    const a=Math.atan2(y-from.y,x-from.x),k=Math.round(a/(Math.PI/2));
    if(Math.abs(a-k*Math.PI/2)<SK_SLOT_FLAT){if(k%2)x=from.x;else y=from.y;}
  }
  return{x,y,s:null};
}
function skSlotRayon(A,B,x,y){
  const L=Math.hypot(B.x-A.x,B.y-A.y)||1;
  return Math.abs((x-A.x)*(A.y-B.y)+(y-A.y)*(B.x-A.x))/L;
}
function skSlotStart(sk,wx,wy){
  if(SK_ASLOT_MODES.has(skSlot.mode))return skASlotStart(sk,wx,wy); // oblong en arc, secteur (50-esquisse-92)
  const fa=!!findSnap(sk,wx,wy);
  const pid=snapNewPoint(sk,wx,wy),S=sk.points[pid];
  skDown={pid,x:S.x,y:S.y,slot:{p2:null,fa}};
  skStatus(SK_SLOT_MSG[skSlot.mode][1]);
}
function skSlotMove(sk,wx,wy){
  if(skDown.slot.arc)return skASlotMove(sk,wx,wy);
  const st=skDown.slot,A={x:skDown.x,y:skDown.y};
  const m=skSlotAim(sk,wx,wy,st.p2?null:A);
  skSnapMk=m.s?{x:m.s.x,y:m.s.y}:null;
  if(!st.p2){skDraft={t:'slot',mode:skSlot.mode,A,B:{x:m.x,y:m.y}};drawSketch2D();return;}
  const r=skSlotRayon(A,st.p2,m.x,m.y);
  skDraft={t:'slot',mode:skSlot.mode,A,B:st.p2,r,ok:skSlotRayonOk(skSlot.mode,A,st.p2,r)};
  drawSketch2D();
}
function skSlotUp(sk,wx,wy){
  if(skDown.slot.arc)return skASlotUp(sk,wx,wy);
  const st=skDown.slot,A={x:skDown.x,y:skDown.y};
  const m=skSlotAim(sk,wx,wy,st.p2?null:A);
  if(!st.p2){ // 1er clic relâché sur place : le 1er point reste armé ; sinon c'est le 2e point
    if(Math.hypot(m.x-A.x,m.y-A.y)<=skMinLen()){skStatus(SK_SLOT_MSG[skSlot.mode][1]);return;}
    st.p2={x:m.x,y:m.y,raw:{x:wx,y:wy},snap:!!m.s};
    skStatus('Oblong : cliquez pour le rayon.');
    skSlotMove(sk,wx,wy);
    return;
  }
  const r=skSlotRayon(A,st.p2,m.x,m.y);
  if(!skSlotRayonOk(skSlot.mode,A,st.p2,r)){
    skStatus(skSlot.mode==='bouts'?'Oblong : rayon trop grand pour cette longueur — visez plus près de l’axe.':'Oblong : éloignez le curseur de l’axe pour donner le rayon.');
    return;
  }
  skPushUndo();
  const b=st.p2.snap?snapNewPoint(sk,st.p2.raw.x,st.p2.raw.y):addPoint(sk,st.p2.x,st.p2.y);
  const R=skSlotCreate(sk,skSlot.mode,skDown.pid,b,r,st.fa,st.p2.snap);
  skDown=null;skDraft=null;skSnapMk=null;afterEdit();
  skStatus(R?'Oblong créé, cotes posées — '+SK_SLOT_MSG[skSlot.mode][0].replace('Oblong : c','c').replace(/\.$/,'')+' du suivant (Échap = fin).':'Oblong : forme impossible avec ces points.');
}
function skSlotDrawDraft(d){
  const trait={fill:'none',stroke:'#fff','stroke-width':2,'stroke-dasharray':'5 3'};
  const seg=(P,Q,o)=>{const[a,b]=w2s(P.x,P.y),[c,e]=w2s(Q.x,Q.y);skEl('line',Object.assign({x1:a,y1:b,x2:c,y2:e},o));};
  const dot=P=>{const[a,b]=w2s(P.x,P.y);skEl('circle',{cx:a,cy:b,r:3,fill:'#ffd60a'});};
  dot(d.A);dot(d.B);
  const axe={stroke:'#ffd60a','stroke-width':1,'stroke-dasharray':'6 3 1 3'};
  const L=Math.hypot(d.B.x-d.A.x,d.B.y-d.A.y);
  const label=(x,y,txt)=>{const t=skEl('text',{x,y,fill:'#ffd60a','font-size':13,'font-weight':'bold','text-anchor':'middle'});t.textContent=txt;};
  if(!(d.r>0)||!d.ok){
    const{c1,c2}=skSlotCentres(d.mode,d.A,d.B,0);
    seg(c1,c2,axe);
    const[mx,my]=w2s((c1.x+c2.x)/2,(c1.y+c2.y)/2);
    label(mx,my-10,(d.mode==='milieu'?2*L:L).toFixed(2));
    return;
  }
  const{c1,c2}=skSlotCentres(d.mode,d.A,d.B,d.r);
  const D=Math.hypot(c2.x-c1.x,c2.y-c1.y)||1,a0=Math.atan2(c2.y-c1.y,c2.x-c1.x);
  const pts=[];
  for(let k=0;k<=24;k++){const t=a0+Math.PI/2+k/24*Math.PI;pts.push(w2s(c1.x+d.r*Math.cos(t),c1.y+d.r*Math.sin(t)));}
  for(let k=0;k<=24;k++){const t=a0-Math.PI/2+k/24*Math.PI;pts.push(w2s(c2.x+d.r*Math.cos(t),c2.y+d.r*Math.sin(t)));}
  skEl('path',Object.assign({d:'M '+pts.map(s=>s[0].toFixed(1)+' '+s[1].toFixed(1)).join(' L ')+' Z'},trait,{fill:'rgba(255,255,255,.06)'}));
  seg(c1,c2,axe);
  const[mx,my]=w2s((c1.x+c2.x)/2,(c1.y+c2.y)/2);
  label(mx,my-10,(d.mode==='bouts'?L:D).toFixed(2)+' · R'+d.r.toFixed(2));
}
