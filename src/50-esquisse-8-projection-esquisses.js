/* ---------- ⧉ Projeter : points, lignes et courbes d'une AUTRE esquisse ----------
   Outil Projeter de l'esquisse ouverte (la « cible ») : les esquisses visibles (les « sources »)
   s'affichent en bleu ; un clic projette le point, la ligne, le cercle, l'arc ou la courbe
   survolés, perpendiculairement au plan de la cible, en construction et fixe comme une arête
   projetée (passable en profil). Les plans peuvent être quelconques :
     plans parallèles → cercle et arc restent cercle et arc ;
     plans inclinés   → un cercle ou un arc devient une ellipse, donc une spline ;
     vu par la tranche (une ligne réduite à un point, un cercle réduit à un trait) → non proposé.
   L'entité mémorise sa source : e.skSrc = {sk, ent|pt, m} (m : nombre de segments d'une spline).
   Elle la suit à chaque rejeu (updateAssociativeProjections0) ; source supprimée = entité figée à
   sa dernière place, avec un avertissement. Une esquisse ne peut pas dépendre d'elle-même : les
   sources qui, de proche en proche, s'appuient déjà sur la cible ne sont pas proposées. */
let _skpCache=null; // {cle, items} : formes des sources, le temps de l'ouverture de la cible
function skpSketch(id){return(doc.sketches||[]).find(s=>s.id===id)||null;}
function skpDeps(sk){
  // esquisses dont sk reprend directement la géométrie
  const s=new Set();(sk.entities||[]).forEach(e=>{if(e&&e.skSrc&&e.skSrc.sk)s.add(e.skSrc.sk);});return s;
}
function skpDepend(s,id,vu){
  // s s'appuie-t-elle, de proche en proche, sur l'esquisse id ?
  vu=vu||new Set();if(vu.has(s.id))return false;vu.add(s.id);
  for(const d of skpDeps(s)){if(d===id)return true;const q=skpSketch(d);if(q&&skpDepend(q,id,vu))return true;}
  return false;
}
function skpOrdre(L){
  // liste {sk,k} triée : chaque source avant les esquisses qui la reprennent (toute une chaîne en une passe)
  const par=new Map(L.map(x=>[x.sk.id,x])),vu=new Set(),out=[];
  const voir=x=>{if(vu.has(x.sk.id))return;vu.add(x.sk.id);skpDeps(x.sk).forEach(d=>{const q=par.get(d);if(q)voir(q);});out.push(x);};
  L.forEach(voir);
  return out;
}
function skpNotesPurge(){
  // les avertissements « source perdue » sont reposés à chaque passe : plus d'entité, plus de message
  [...NOMS_PERTES_ESQ.keys()].forEach(c=>{if(String(c).startsWith('skp:'))NOMS_PERTES_ESQ.delete(c);});
}
function skpPlan(S,T){
  // (x,y) de S → (x,y) de T, projeté perpendiculairement à T ; .par : plans parallèles
  const a=sketchBasis(S),b=sketchBasis(T);
  const f=(x,y)=>{
    const dx=a.o.x+a.u.x*x+a.v.x*y-b.o.x,dy=a.o.y+a.u.y*x+a.v.y*y-b.o.y,dz=a.o.z+a.u.z*x+a.v.z*y-b.o.z;
    return[dx*b.u.x+dy*b.u.y+dz*b.u.z,dx*b.v.x+dy*b.v.y+dz*b.v.z];};
  f.par=Math.abs(a.n.x*b.n.x+a.n.y*b.n.y+a.n.z*b.n.z)>1-1e-9;
  return f;
}
function skpPlat(pts){
  // la polyligne se réduit-elle à un trait droit ? (courbe vue par la tranche)
  const A=pts[0];let B=A,dm=0;
  pts.forEach(p=>{const d=Math.hypot(p[0]-A[0],p[1]-A[1]);if(d>dm){dm=d;B=p;}});
  if(dm<1e-4)return true;
  return pts.every(p=>Math.abs((p[0]-A[0])*(B[1]-A[1])-(p[1]-A[1])*(B[0]-A[0]))/dm<1e-4);
}
function skpForme(S,e,f){
  // forme projetée d'une entité de S → {type:'line'|'circle'|'arc'|'curve',…}, ou null
  const P=S.points||{};
  if(e.t==='line'){
    const A=P[e.p1],B=P[e.p2];if(!A||!B||e.handle)return null;
    const a=f(A.x,A.y),b=f(B.x,B.y);
    return Math.hypot(b[0]-a[0],b[1]-a[1])<1e-4?null:{type:'line',x1:a[0],y1:a[1],x2:b[0],y2:b[1]};
  }
  const courbe=(pts,closed,m)=>skpPlat(pts)?null:{type:'curve',pts,closed:!!closed,m};
  if(e.t==='circle'){
    const C=P[e.pc];if(!C||!(e.r>0))return null;
    if(f.par){const c=f(C.x,C.y);return{type:'circle',cx:c[0],cy:c[1],r:e.r};}
    const pts=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*2;pts.push(f(C.x+Math.cos(a)*e.r,C.y+Math.sin(a)*e.r));}
    return courbe(pts,true,48);
  }
  if(e.t==='arc'){
    const C=P[e.pc];if(!C||!(e.r>0))return null;
    const an=arcAngles(S,e);if(!an)return null;
    const at=a=>f(C.x+Math.cos(a)*e.r,C.y+Math.sin(a)*e.r);
    if(f.par){
      const c=f(C.x,C.y),u=at(an.a1),w=at(an.a2),m=at((an.a1+an.a2)/2);
      const o=arcOrient(c[0],c[1],u[0],u[1],w[0],w[1],m[0],m[1]); // plan retourné : le sens de l'arc s'inverse
      return{type:'arc',cx:c[0],cy:c[1],r:e.r,x1:o[0],y1:o[1],x2:o[2],y2:o[3]};
    }
    const d=an.a2-an.a1,n=Math.max(8,Math.ceil(d/(Math.PI*2)*96)),pts=[];
    for(let i=0;i<=n;i++)pts.push(at(an.a1+d*i/n));
    return courbe(pts,false,Math.max(6,Math.ceil(n/2)));
  }
  if(e.t==='spline'){
    const pl=skSplinePoly(S,e);if(!pl||pl.length<2)return null;
    return courbe(pl.map(q=>f(q[0],q[1])),e.closed,Math.max(24,Math.min(96,(e.pts||[]).length*6)));
  }
  return null;
}
function skpEchantillon(pts,closed,m){
  // m segments réguliers en longueur ; une boucle ne répète pas son premier point
  const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const tot=L[L.length-1],Q=[];
  for(let k=0;k<=m;k++){
    const s=tot*k/m;let i=1;while(i<L.length-1&&L[i]<s)i++;
    const w=(s-L[i-1])/((L[i]-L[i-1])||1);
    Q.push([pts[i-1][0]+(pts[i][0]-pts[i-1][0])*w,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*w]);
  }
  if(closed)Q.pop();
  return Q;
}
function skpPoints(S){
  // points désignables de S : ceux de ses entités, sans les poignées de spline
  const ids=new Set();
  (S.entities||[]).forEach(e=>{
    if(!e)return;
    if(e.t==='line'){if(e.handle){if(e.p1)ids.add(e.p1);}else{ids.add(e.p1);ids.add(e.p2);}}
    else if(e.t==='circle')ids.add(e.pc);
    else if(e.t==='arc'){ids.add(e.pc);ids.add(e.pa);ids.add(e.pb);}
    else if(e.t==='cpoint')ids.add(e.p);
    else if(e.t==='spline')(e.pts||[]).forEach(p=>ids.add(p));
  });
  return[...ids].filter(p=>p&&(S.points||{})[p]);
}
function skpItems(T){
  // formes projetées des esquisses visibles que T peut reprendre
  const src=(doc.sketches||[]).filter(s=>s.id!==T.id&&s.visible!==false&&!repCloneSkName(s)&&!skpDepend(s,T.id));
  const cle=T.id+'|'+src.map(s=>s.id).join();
  if(_skpCache&&_skpCache.cle===cle)return _skpCache.items;
  const items=src.map(S=>{
    const f=skpPlan(S,T),P=S.points;
    return{S,
      pts:skpPoints(S).map(pid=>{const q=f(P[pid].x,P[pid].y);return{pid,x:q[0],y:q[1]};}),
      ents:(S.entities||[]).map(e=>{const pr=e&&e.t!=='cpoint'?skpForme(S,e,f):null;return pr?{e,pr}:null;}).filter(Boolean)};
  });
  _skpCache={cle,items};
  return items;
}
function skpDistance(pr,x,y){
  if(pr.type==='line')return distSeg2(x,y,pr.x1,pr.y1,pr.x2,pr.y2);
  if(pr.type==='circle')return Math.abs(Math.hypot(x-pr.cx,y-pr.cy)-pr.r);
  if(pr.type==='arc'){
    const a=Math.atan2(pr.y1-pr.cy,pr.x1-pr.cx),b=Math.atan2(pr.y2-pr.cy,pr.x2-pr.cx);
    if(angInArc(Math.atan2(y-pr.cy,x-pr.cx),a,b))return Math.abs(Math.hypot(x-pr.cx,y-pr.cy)-pr.r);
    return Math.min(Math.hypot(x-pr.x1,y-pr.y1),Math.hypot(x-pr.x2,y-pr.y2));
  }
  let d=Infinity;
  for(let i=0;i+1<pr.pts.length;i++)d=Math.min(d,distSeg2(x,y,pr.pts[i][0],pr.pts[i][1],pr.pts[i+1][0],pr.pts[i+1][1]));
  return d;
}
function skpHit(T,x,y){
  // ce qui est sous (x,y) : un point d'abord (comme partout dans l'esquisse), puis une entité
  const items=skpItems(T);let best=null,bd=SK_PT;
  items.forEach(it=>it.pts.forEach(q=>{const d=Math.hypot(q.x-x,q.y-y);if(d<bd){bd=d;best={type:'point',x:q.x,y:q.y,srcName:it.S.name,skSrc:{sk:it.S.id,pt:q.pid}};}}));
  if(best)return best;
  bd=SK_PICK;
  items.forEach(it=>it.ents.forEach(c=>{const d=skpDistance(c.pr,x,y);if(d<bd){bd=d;best=Object.assign({},c.pr,{srcName:it.S.name,skSrc:{sk:it.S.id,ent:c.e.id}});}}));
  return best;
}
function skpExistante(T,pr){
  const s=pr.skSrc;
  return(T.entities||[]).find(e=>e&&e.skSrc&&e.skSrc.sk===s.sk&&(s.pt?e.skSrc.pt===s.pt:e.skSrc.ent===s.ent))||null;
}
function skpCreer(T,pr){
  // entité projetée dans T (mêmes réglages qu'une arête projetée) → id, ou null
  let eid;
  if(pr.type==='point'){
    const p=addPoint(T,pr.x,pr.y);
    T.constraints.push({id:skNewEid(T),type:'fix',p});
    eid=skNewEid(T);
    T.entities.push(Object.assign({id:eid,t:'cpoint',p,construction:true,proj:true},projNames({})));
  }else if(pr.type==='curve'){
    const Q=skpEchantillon(pr.pts,pr.closed,pr.m);if(Q.length<3)return null;
    const ids=Q.map(q=>{const p=addPoint(T,q[0],q[1]);T.constraints.push({id:skNewEid(T),type:'fix',p});return p;});
    eid=skNewEid(T);
    const e=Object.assign({id:eid,t:'spline',pts:ids,construction:true,proj:true},projNames({}));
    if(pr.closed)e.closed=true;
    T.entities.push(e);
    T.constraints.push({id:skNewEid(T),type:'fix',ent:eid});
  }else eid=skProjectCreate(T,pr);
  if(!eid)return null;
  const e=entById(T,eid);
  e.skSrc=Object.assign({},pr.skSrc,pr.type==='curve'?{m:pr.m}:null);
  e.srcName='« '+(pr.srcName||'Esquisse')+' »';
  return eid;
}
function skpNom(pr){return pr.type==='point'?'Point':pr.type==='circle'?'Cercle':pr.type==='arc'?'Arc':pr.type==='curve'?'Courbe':'Ligne';}
function skpClic(T,x,y){
  // outil ⧉ : true si le clic a porté sur une autre esquisse
  const pr=skpHit(T,x,y);if(!pr)return false;
  const dej=skpExistante(T,pr);
  if(dej){skStatus(skpNom(pr)+' de « '+pr.srcName+' » déjà projeté(e) ici.');return true;}
  skPushUndo();
  if(!skpCreer(T,pr)){skUndoStack.pop();skUndoBtn();skStatus('Élément trop court pour être projeté.');return true;}
  skStatus(skpNom(pr)+' de « '+pr.srcName+' » projeté(e) en construction : suit son esquisse.');
  afterEdit();
  return true;
}
function skpTrack(T,e){
  // rejeu : l'entité suit sa source. → true si elle a bougé ; source perdue : figée, avec un avertissement
  const s=e.skSrc,S=skpSketch(s.sk),P=T.points,TOL=1e-5;
  const perdu=q=>{NOMS_PERTES_ESQ.set('skp:'+T.id+'/'+e.id,(T.name||'Esquisse')+' : '+(e.projName||'projection')+' — '+q+' ; elle reste figée à sa dernière place');return false;};
  if(!S)return perdu('son esquisse source n’existe plus');
  const f=skpPlan(S,T);
  const pose=(q,x,y)=>{if(!q||Math.hypot(q.x-x,q.y-y)<=TOL)return false;q.x=x;q.y=y;return true;};
  if(s.pt){
    const q=(S.points||{})[s.pt],Q=P[e.p];
    if(!q||!Q)return perdu('son point source n’existe plus');
    const c=f(q.x,q.y);return pose(Q,c[0],c[1]);
  }
  const src=(S.entities||[]).find(x=>x&&x.id===s.ent);
  if(!src)return perdu('son élément source n’existe plus');
  const pr=skpForme(S,src,f);
  const attendu={line:'line',circle:'circle',arc:'arc',spline:'curve'}[e.t];
  if(!pr||pr.type!==attendu)return perdu('sa source n’a plus la même forme vue depuis ce plan');
  let bouge=false;const b=v=>{if(v)bouge=true;};
  if(e.t==='line'){b(pose(P[e.p1],pr.x1,pr.y1));b(pose(P[e.p2],pr.x2,pr.y2));}
  else if(e.t==='circle'){b(pose(P[e.pc],pr.cx,pr.cy));if(Math.abs(e.r-pr.r)>TOL){e.r=pr.r;bouge=true;}}
  else if(e.t==='arc'){b(pose(P[e.pc],pr.cx,pr.cy));b(pose(P[e.pa],pr.x1,pr.y1));b(pose(P[e.pb],pr.x2,pr.y2));if(Math.abs(e.r-pr.r)>TOL){e.r=pr.r;bouge=true;}}
  else{
    const Q=skpEchantillon(pr.pts,pr.closed,s.m);
    if(Q.length!==(e.pts||[]).length)return perdu('sa source n’a plus la même forme vue depuis ce plan');
    Q.forEach((q,i)=>b(pose(P[e.pts[i]],q[0],q[1])));
  }
  return bouge;
}
function skpDessin(T){
  // outil ⧉ : les sources en bleu, tiretées, et leurs points — sinon on projette à l'aveugle
  const C='#5ac8fa',st={fill:'none',stroke:C,'stroke-width':1.5,'stroke-dasharray':'3 3',opacity:0.9};
  skpItems(T).forEach(it=>{
    it.ents.forEach(({pr})=>{
      if(pr.type==='line'){const[a,b]=w2s(pr.x1,pr.y1),[c,d]=w2s(pr.x2,pr.y2);skEl('line',Object.assign({x1:a,y1:b,x2:c,y2:d},st));}
      else if(pr.type==='circle'){const[a,b]=w2s(pr.cx,pr.cy);skEl('circle',Object.assign({cx:a,cy:b,r:pr.r*skView.s},st));}
      else if(pr.type==='arc'){
        const a1=Math.atan2(pr.y1-pr.cy,pr.x1-pr.cx),a2=Math.atan2(pr.y2-pr.cy,pr.x2-pr.cx);let dd=a2-a1;while(dd<=0)dd+=Math.PI*2;
        const[a,b]=w2s(pr.x1,pr.y1),[c,d]=w2s(pr.x2,pr.y2),R=pr.r*skView.s;
        skEl('path',Object.assign({d:`M ${a} ${b} A ${R} ${R} 0 ${dd>Math.PI?1:0} 0 ${c} ${d}`},st));}
      else skEl('path',Object.assign({d:'M '+pr.pts.map(q=>{const w=w2s(q[0],q[1]);return w[0].toFixed(1)+' '+w[1].toFixed(1);}).join(' L ')},st));
    });
    it.pts.forEach(q=>{const[a,b]=w2s(q.x,q.y);skEl('rect',{x:a-2.5,y:b-2.5,width:5,height:5,fill:'#101012',stroke:C,'stroke-width':1.2});});
  });
}
