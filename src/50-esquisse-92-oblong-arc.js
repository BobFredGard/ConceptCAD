/* ---------- Esquisse : oblong en arc et secteur de couronne (comme Fusion 360) ----------
   2026-11-09 : « Esquisse : création d'un trou oblong circulaire et en secteur ». Fred a choisi les
   2 formes : l'oblong courbé à bouts ronds et le secteur de couronne à bouts droits tournés vers le
   centre. Trois nouveaux choix dans le bandeau de l'Oblong :
   - arc3    : départ, arrivée, un point de passage de l'arc d'axe, puis la largeur ;
   - arcC    : centre, départ, arrivée (l'arc suit la souris, dans un sens ou dans l'autre), largeur ;
   - secteur : centre, 1er coin, arrivée, puis le 2e rayon.
   Mêmes principes que l'oblong droit : aucun « Fixe », un point cliqué sur une géométrie s'y accroche,
   un point dans le vide reste libre, toutes les cotes posées à la création.
   Modèle de l'oblong en arc : arc d'axe (construction) du centre pc, de S à E (sens direct) ;
   2 rayons de construction pc→Po1, pc→Po2 qui portent S, Pi1 et E, Pi2 ; arcs extérieur (Po1→Po2) et
   intérieur (Pi1→Pi2) au centre pc ; 2 bouts ronds de centre S et E. Les points alignés sur les rayons
   donnent la tangence et l'égalité des bouts sans autre contrainte. Cotes : R de l'axe, R du bout,
   angle entre les 2 rayons (s'il est sous 180°).
   Secteur : arcs extérieur et intérieur au centre pc, 2 côtés droits Pi→Po dont le prolongement
   passe par pc. Cotes : les 2 rayons et l'angle entre les côtés. */
const SK_ASLOT_MODES=new Set(['arc3','arcC','secteur']);
SK_SLOT_MODES.push(
  ['arc3','Arc 3 points','Cliquez le départ, l’arrivée, un point de passage, puis la largeur'],
  ['arcC','Arc par centre','Cliquez le centre de l’arc, le départ, l’arrivée, puis la largeur'],
  ['secteur','Secteur','Cliquez le centre, un 1er coin, l’arrivée, puis le 2e rayon']);
Object.assign(SK_SLOT_MSG,{
  arc3:['Oblong en arc : cliquez le départ (centre du 1er bout).','Oblong en arc : cliquez l’arrivée (centre du 2e bout).','Oblong en arc : cliquez un point de passage de l’arc.','Oblong en arc : cliquez pour la largeur.'],
  arcC:['Oblong en arc : cliquez le centre de l’arc.','Oblong en arc : cliquez le départ (centre du 1er bout).','Oblong en arc : tournez jusqu’à l’arrivée et cliquez.','Oblong en arc : cliquez pour la largeur.'],
  secteur:['Secteur : cliquez le centre.','Secteur : cliquez un 1er coin.','Secteur : tournez jusqu’à l’arrivée et cliquez.','Secteur : cliquez pour le 2e rayon.']});
const SK_TAU=Math.PI*2;
function skAngWrap(a){while(a>Math.PI)a-=SK_TAU;while(a<=-Math.PI)a+=SK_TAU;return a;}
/* Crée la forme. kind 'arc' : g={cx,cy,R,w,a1,sw} (R : rayon de l'axe, w : demi-largeur) ;
   kind 'secteur' : g={cx,cy,r1,r2,a1,sw} (r1 < r2). a1 = angle de départ, sw = ouverture (> 0, sens direct).
   roles : pid des points cliqués à garder — c (centre), et S/E (arc) ou i1/o1/i2/o2 (secteur).
   snaps : rôles accrochés à une géométrie (s'attachent avec la tolérance normale). Rend {ents,dims} ou null. */
function skASlotCreate(sk,kind,g,roles,snaps){
  roles=roles||{};snaps=snaps||{};
  const sw=g.sw,a1=g.a1,a2=a1+sw;
  if(!(sw>1e-6)||sw>=SK_TAU-1e-6)return null;
  if(kind==='arc'&&!(g.w>1e-6&&g.R-g.w>1e-6))return null;
  if(kind==='secteur'&&!(g.r1>1e-6&&g.r2-g.r1>1e-6))return null;
  const id=()=>skNewEid(sk);
  const pt=(role,ang,rho)=>{
    const x=g.cx+rho*Math.cos(ang),y=g.cy+rho*Math.sin(ang);
    const p=roles[role];
    if(p&&sk.points[p]){sk.points[p].x=x;sk.points[p].y=y;return p;}
    return pidAt(sk,x,y);
  };
  const pc=roles.c&&sk.points[roles.c]?roles.c:addPoint(sk,g.cx,g.cy);
  if(roles.c&&sk.points[pc]){sk.points[pc].x=g.cx;sk.points[pc].y=g.cy;}
  const ents=[],dims=[],cons=[];
  const cote=q=>{const o=Object.assign({id:id()},q);sk.dims.push(o);dims.push(o);};
  let mine; // points de la forme, pour les accroches
  if(kind==='arc'){
    const R=g.R,w=g.w;
    const S=pt('S',a1,R),E=pt('E',a2,R);
    const Po1=pt('o1',a1,R+w),Pi1=pt('i1',a1,R-w),Po2=pt('o2',a2,R+w),Pi2=pt('i2',a2,R-w);
    const axe={id:id(),t:'arc',pc,pa:S,pb:E,r:R,construction:true};
    const L1={id:id(),t:'line',p1:pc,p2:Po1,construction:true},L2={id:id(),t:'line',p1:pc,p2:Po2,construction:true};
    const ext={id:id(),t:'arc',pc,pa:Po1,pb:Po2,r:R+w},int={id:id(),t:'arc',pc,pa:Pi1,pb:Pi2,r:R-w};
    const b1={id:id(),t:'arc',pc:S,pa:Pi1,pb:Po1,r:w},b2={id:id(),t:'arc',pc:E,pa:Po2,pb:Pi2,r:w};
    ents.push(ext,int,b1,b2,axe,L1,L2);
    sk.entities.push(...ents);
    [[S,L1],[Pi1,L1],[E,L2],[Pi2,L2]].forEach(([p,l])=>cons.push({id:id(),type:'online',p,line:l.id}));
    sk.constraints.push(...cons);
    cote({type:'radius',ent:axe.id,value:+R.toFixed(6)});
    cote({type:'radius',ent:b1.id,value:+w.toFixed(6)});
    if(sw<Math.PI-0.03)cote({type:'angle',a:L1.id,b:L2.id,value:+sw.toFixed(6),ccw:1,ox:0,oy:0});
    mine={S,E,o1:Po1,i1:Pi1,o2:Po2,i2:Pi2};
  }else{
    const r1=g.r1,r2=g.r2;
    const Pi1=pt('i1',a1,r1),Po1=pt('o1',a1,r2),Pi2=pt('i2',a2,r1),Po2=pt('o2',a2,r2);
    const ext={id:id(),t:'arc',pc,pa:Po1,pb:Po2,r:r2},int={id:id(),t:'arc',pc,pa:Pi1,pb:Pi2,r:r1};
    const c1={id:id(),t:'line',p1:Pi1,p2:Po1},c2={id:id(),t:'line',p1:Pi2,p2:Po2};
    ents.push(ext,int,c1,c2);
    sk.entities.push(...ents);
    [c1,c2].forEach(l=>cons.push({id:id(),type:'online',p:pc,line:l.id}));
    sk.constraints.push(...cons);
    cote({type:'radius',ent:int.id,value:+r1.toFixed(6)});
    cote({type:'radius',ent:ext.id,value:+r2.toFixed(6)});
    if(sw<Math.PI-0.03)cote({type:'angle',a:c1.id,b:c2.id,value:+sw.toFixed(6),ccw:1,ox:0,oy:0});
    mine={o1:Po1,i1:Pi1,o2:Po2,i2:Pi2};
  }
  // seuls les points cliqués accrochés s'attachent largement ; les autres seulement à ce qui les touche exactement
  Object.keys(mine).forEach(k=>{const p=mine[k],q=sk.points[p];if(q)skAutoAttach(sk,p,q.x,q.y,snaps[k]?undefined:1e-3);});
  {const q=sk.points[pc];if(q)skAutoAttach(sk,pc,q.x,q.y,snaps.c?undefined:1e-3);}
  return{ents,dims,pc};
}
/* ----- saisie à la souris (4 clics) ----- */
function skASlotAim(sk,wx,wy){
  const s=findSnap(sk,wx,wy,skDown&&skDown.pid);
  if(s)return{x:s.x,y:s.y,s};
  let x=wx,y=wy;
  if($('skSnap').checked){x=skSnapVal(x);y=skSnapVal(y);}
  return{x,y,s:null};
}
function skASlotStart(sk,wx,wy){
  const fa=!!findSnap(sk,wx,wy);
  const pid=snapNewPoint(sk,wx,wy),P0=sk.points[pid];
  skDown={pid,x:P0.x,y:P0.y,slot:{arc:true,mode:skSlot.mode,fa,pts:[{x:P0.x,y:P0.y}]}};
  skStatus(SK_SLOT_MSG[skSlot.mode][1]);
}
// géométrie en cours d'après les points posés et le curseur m → draft
function skASlotGeom(st,m){
  const P=st.pts,mode=st.mode,n=P.length;
  if(mode==='arc3'){
    if(n===1)return{stage:1,A:P[0],B:m};
    const c=skCirc3(P[0],P[1],n>=3?P[2]:m);
    if(!c)return{stage:n,A:P[0],B:P[1],bad:true};
    const a1=Math.atan2(P[0].y-c.y,P[0].x-c.x),a2=Math.atan2(P[1].y-c.y,P[1].x-c.x);
    const T=n>=3?P[2]:m,aT=Math.atan2(T.y-c.y,T.x-c.x);
    let d=a2-a1;while(d<=0)d+=SK_TAU;
    let sw=d;{let r=aT-a1;while(r<0)r+=SK_TAU;if(r>d)sw=d-SK_TAU;}
    const g={stage:n,cx:c.x,cy:c.y,R:c.r,a1,sw};
    if(n>=3)g.w=Math.abs(Math.hypot(m.x-c.x,m.y-c.y)-c.r);
    return g;
  }
  const C=P[0];
  if(n===1)return{stage:1,cx:C.x,cy:C.y,B:m};
  const R=Math.hypot(P[1].x-C.x,P[1].y-C.y),a1=Math.atan2(P[1].y-C.y,P[1].x-C.x);
  const g={stage:n,cx:C.x,cy:C.y,R,a1,sw:st.sweep||0};
  if(n>=3){const rr=Math.hypot(m.x-C.x,m.y-C.y);if(mode==='secteur')g.r2=rr;else g.w=Math.abs(rr-R);}
  return g;
}
function skASlotOk(mode,g){
  const mn=skMinLen();
  if(!g||g.bad||!(g.R>mn)||!(Math.abs(g.sw||0)>1e-3)||Math.abs(g.sw)>=SK_TAU-1e-3)return false;
  if(g.stage<3)return true;
  if(mode==='secteur')return g.r2>mn&&Math.abs(g.r2-g.R)>mn;
  return g.w>mn&&g.R-g.w>mn;
}
function skASlotMove(sk,wx,wy){
  const st=skDown.slot,m=skASlotAim(sk,wx,wy);
  skSnapMk=m.s?{x:m.s.x,y:m.s.y}:null;
  if(st.mode!=='arc3'&&st.pts.length===2){ // l'arc suit la souris, tour après tour, dans les 2 sens
    const C=st.pts[0],a=Math.atan2(m.y-C.y,m.x-C.x);
    if(Math.hypot(m.x-C.x,m.y-C.y)>1e-9){
      st.sweep=(st.sweep||0)+skAngWrap(a-(st.prevA!=null?st.prevA:a));st.prevA=a;
      st.sweep=Math.max(-SK_TAU+1e-3,Math.min(SK_TAU-1e-3,st.sweep));
    }
  }
  const g=skASlotGeom(st,m);
  skDraft=Object.assign({t:'aslot',mode:st.mode,ok:skASlotOk(st.mode,g),pts:st.pts.slice(),cur:{x:m.x,y:m.y}},g);
  drawSketch2D();
}
function skASlotUp(sk,wx,wy){
  const st=skDown.slot,m=skASlotAim(sk,wx,wy),last=st.pts[st.pts.length-1];
  const msg=SK_SLOT_MSG[st.mode];
  if(st.pts.length<3&&Math.hypot(m.x-last.x,m.y-last.y)<=skMinLen()){skStatus(msg[st.pts.length]);return;} // relâché sur place
  if(st.pts.length<3){
    if(st.mode!=='arc3'&&st.pts.length===1){st.prevA=Math.atan2(m.y-last.y,m.x-last.x);st.sweep=0;}
    if(st.mode!=='arc3'&&st.pts.length===2&&!(Math.abs(st.sweep||0)>1e-3)){skStatus(msg[2]);return;}
    if(st.mode==='arc3'&&st.pts.length===2&&!skCirc3(st.pts[0],st.pts[1],m)){skStatus('Oblong en arc : ces 3 points sont alignés — visez ailleurs.');return;}
    st.pts.push({x:m.x,y:m.y,raw:{x:wx,y:wy},snap:!!m.s});
    skStatus(msg[st.pts.length]);
    skASlotMove(sk,wx,wy);
    return;
  }
  const g=skASlotGeom(st,m);
  if(!skASlotOk(st.mode,g)){
    skStatus(st.mode==='secteur'?'Secteur : éloignez le curseur du 1er rayon.':'Oblong en arc : largeur nulle ou plus grande que le rayon — visez ailleurs.');
    return;
  }
  skPushUndo();
  const R=skASlotCommit(sk,st,g);
  skDown=null;skDraft=null;skSnapMk=null;afterEdit();
  skStatus(R?(st.mode==='secteur'?'Secteur créé':'Oblong en arc créé')+', cotes posées — '+msg[0].replace(/^[^:]+: c/,'c').replace(/\.$/,'')+' du suivant (Échap = fin).'
    :'Oblong en arc : forme impossible avec ces points.');
}
/* passe des clics à la forme : valeurs arrondies là où un point est libre, sens direct, rôles des points cliqués */
function skASlotCommit(sk,st,g){
  const P=st.pts,first=skDown.pid,r2=v=>+v.toFixed(2);
  const ptOf=k=>{const q=P[k];return q.snap?snapNewPoint(sk,q.raw.x,q.raw.y):addPoint(sk,q.x,q.y);};
  let cx=g.cx,cy=g.cy,a1=g.a1,sw=g.sw,roles={},snaps={};
  if(st.mode==='arc3'){
    // départ et arrivée cliqués : le rayon s'arrondit en déplaçant le centre (libre) sur la médiatrice
    const A=P[0],B=P[1],c=Math.hypot(B.x-A.x,B.y-A.y),Rn=r2(g.R);
    let R=g.R;
    if(Rn>c/2+1e-6&&Math.abs(Rn-g.R)>1e-9){
      const mx=(A.x+B.x)/2,my=(A.y+B.y)/2,ux=(B.x-A.x)/c,uy=(B.y-A.y)/c;
      const side=Math.sign((cx-mx)*(-uy)+(cy-my)*ux)||1,h=Math.sqrt(Rn*Rn-c*c/4);
      cx=mx-uy*h*side;cy=my+ux*h*side;R=Rn;
      const b1=Math.atan2(A.y-cy,A.x-cx),b2=Math.atan2(B.y-cy,B.x-cx);
      let d=b2-b1;while(d<=0)d+=SK_TAU;
      a1=b1;sw=sw>0?d:d-SK_TAU;
    }
    const w=r2(g.w);if(!(w>0&&R-w>1e-6))return null;
    const S=first,E=ptOf(1);
    if(sw>0){roles={S,E};snaps={S:st.fa,E:P[1].snap};}
    else{roles={S:E,E:S};snaps={S:P[1].snap,E:st.fa};a1+=sw;sw=-sw;}
    return skASlotCreate(sk,'arc',{cx,cy,R,w,a1,sw},roles,snaps);
  }
  // centre cliqué en premier ; départ cliqué : le rayon s'arrondit en glissant le départ (s'il est libre)
  const c=first,S0=ptOf(1),fs=P[1].snap;
  const R=fs?g.R:r2(g.R);
  sw=+(Math.round(sw*180/Math.PI*100)/100*Math.PI/180).toFixed(9); // ouverture au 1/100 de degré
  if(st.mode==='secteur'){
    const R2=r2(g.r2),inner=R2>R;
    const r1=Math.min(R,R2),rB=Math.max(R,R2);if(!(rB-r1>1e-6&&r1>1e-6))return null;
    const startRole=inner?'i':'o';
    if(sw>0){roles={c,[startRole+'1']:S0};snaps={c:st.fa,[startRole+'1']:fs};}
    else{roles={c,[startRole+'2']:S0};snaps={c:st.fa,[startRole+'2']:fs};a1+=sw;sw=-sw;}
    return skASlotCreate(sk,'secteur',{cx,cy,r1,r2:rB,a1,sw},roles,snaps);
  }
  const w=r2(g.w);if(!(w>0&&R-w>1e-6))return null;
  if(sw>0){roles={c,S:S0};snaps={c:st.fa,S:fs};}
  else{roles={c,E:S0};snaps={c:st.fa,E:fs};a1+=sw;sw=-sw;}
  return skASlotCreate(sk,'arc',{cx,cy,R,w,a1,sw},roles,snaps);
}
function skASlotDrawDraft(d){
  const jaune='#ffd60a';
  const dot=P=>{const[a,b]=w2s(P.x,P.y);skEl('circle',{cx:a,cy:b,r:3,fill:jaune});};
  const label=(x,y,txt)=>{const[a,b]=w2s(x,y);const t=skEl('text',{x:a,y:b-10,fill:jaune,'font-size':13,'font-weight':'bold','text-anchor':'middle'});t.textContent=txt;};
  const axe={fill:'none',stroke:jaune,'stroke-width':1,'stroke-dasharray':'6 3 1 3'};
  const arcPts=(cx,cy,r,a,sw,n)=>{const o=[];for(let k=0;k<=n;k++){const t=a+sw*k/n;o.push(w2s(cx+r*Math.cos(t),cy+r*Math.sin(t)));}return o;};
  const path=(pts,close,o)=>skEl('path',Object.assign({d:'M '+pts.map(s=>s[0].toFixed(1)+' '+s[1].toFixed(1)).join(' L ')+(close?' Z':'')},o));
  (d.pts||[]).forEach(dot);
  if(d.stage===1){ // 1er segment : départ→arrivée (arc3) ou centre→départ
    const A=d.A||{x:d.cx,y:d.cy},B=d.B;
    path([w2s(A.x,A.y),w2s(B.x,B.y)],false,axe);
    label((A.x+B.x)/2,(A.y+B.y)/2,(d.mode==='arc3'?'':'R ')+Math.hypot(B.x-A.x,B.y-A.y).toFixed(2));
    return;
  }
  if(d.bad||!(d.R>0))return;
  const n=Math.max(8,Math.ceil(Math.abs(d.sw)/(Math.PI/48)));
  const[cxs,cys]=w2s(d.cx,d.cy);skEl('circle',{cx:cxs,cy:cys,r:3,fill:'none',stroke:jaune});
  path(arcPts(d.cx,d.cy,d.R,d.a1,d.sw,n),false,axe);
  if(d.mode!=='secteur'||d.stage<3){ // rayons de construction aux 2 bouts
    [d.a1,d.a1+d.sw].forEach(a=>path([[cxs,cys],w2s(d.cx+d.R*Math.cos(a),d.cy+d.R*Math.sin(a))],false,axe));
  }
  const deg=(Math.abs(d.sw)*180/Math.PI).toFixed(1)+'°';
  const am=d.a1+d.sw/2;
  if(d.stage<3||!d.ok){label(d.cx+d.R*Math.cos(am),d.cy+d.R*Math.sin(am),'R '+d.R.toFixed(2)+' · '+deg);return;}
  const trait={fill:'rgba(255,255,255,.06)',stroke:'#fff','stroke-width':2,'stroke-dasharray':'5 3'};
  const a1=d.sw>0?d.a1:d.a1+d.sw,sw=Math.abs(d.sw);
  if(d.mode==='secteur'){
    const r1=Math.min(d.R,d.r2),r2=Math.max(d.R,d.r2);
    const pts=arcPts(d.cx,d.cy,r2,a1,sw,n).concat(arcPts(d.cx,d.cy,r1,a1+sw,-sw,n));
    path(pts,true,trait);
    label(d.cx+r2*Math.cos(am),d.cy+r2*Math.sin(am),'R '+r1.toFixed(2)+' / R '+r2.toFixed(2)+' · '+deg);
    return;
  }
  const w=d.w,R=d.R,pts=arcPts(d.cx,d.cy,R+w,a1,sw,n);
  const e2=a1+sw,Ex=d.cx+R*Math.cos(e2),Ey=d.cy+R*Math.sin(e2);
  pts.push(...arcPts(Ex,Ey,w,e2,Math.PI,16));
  pts.push(...arcPts(d.cx,d.cy,R-w,e2,-sw,n));
  const Sx=d.cx+R*Math.cos(a1),Sy=d.cy+R*Math.sin(a1);
  pts.push(...arcPts(Sx,Sy,w,a1+Math.PI,Math.PI,16));
  path(pts,true,trait);
  label(d.cx+(R+w)*Math.cos(am),d.cy+(R+w)*Math.sin(am),'R '+R.toFixed(2)+' · '+deg+' · largeur '+(2*w).toFixed(2));
}
