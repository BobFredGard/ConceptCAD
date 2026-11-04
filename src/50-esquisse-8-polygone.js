/* ---------- Esquisse : polygone régulier (pentagone, 6 pans…) ----------
   Réglages : nombre de côtés + Ø intérieur, celui du cercle tangent aux côtés (le « sur-plats »
   d'un 6 pans). Clic 1 = centre ; clic 2 = orientation (le curseur vise le milieu d'un côté), et
   Ø si le champ est vide. Entrée valide avec un côté à plat en haut.
   Modèle paramétrique : cercle de construction piloté par la cote Ø, côtés tangents et égaux, plus
   un rayon de construction, perpendiculaire au 1er côté en son milieu.
   « Tangents + égaux » ne suffit pas : à nombre de côtés pair, les sommets peuvent alterner (un
   losange est tangent à son cercle avec 4 côtés égaux). Le rayon impose le contact au milieu du côté et l'interdit.
   Reste centre (2) + rotation (1) ; un côté posé à plat reçoit H ou V, ce qui bloque la rotation.
   Pas de 2e cercle par les sommets : le solveur retient les rayons libres (ancrage doux), et l'écart
   gênerait la résolution. */
const SK_POLY_MIN=3,SK_POLY_MAX=64;
const skPoly={n:6,d:null,ang:Math.PI/2}; // réglages gardés d'un polygone au suivant ; d=null : Ø à la souris
function skPolyPts(cx,cy,n,r,ang){
  // sommets ; ang = direction centre → milieu du 1er côté (sommets 0 et 1), r = rayon intérieur
  const a=Math.PI/n,R=r/Math.cos(a),out=[];
  for(let i=0;i<n;i++){const t=ang-a+i*2*a;out.push({x:cx+R*Math.cos(t),y:cy+R*Math.sin(t)});}
  return out;
}
function skPolyAngle(dx,dy){
  // aimante l'orientation tous les 15° : les côtés tombent facilement à plat
  const a=Math.atan2(dy,dx),st=Math.PI/12,k=Math.round(a/st);
  return Math.abs(a-k*st)<4*Math.PI/180?k*st:a;
}
function skPolyCreate(sk,pc,n,r,ang){
  const C=sk.points[pc];if(!C)return null;
  const dVal=+(2*r).toFixed(3);r=dVal/2;
  const pids=skPolyPts(C.x,C.y,n,r,ang).map(q=>addPoint(sk,q.x,q.y));
  const inner={id:skNewEid(sk),t:'circle',pc,r,construction:true,poly:pids.slice()};
  const lines=pids.map((p,i)=>({id:skNewEid(sk),t:'line',p1:p,p2:pids[(i+1)%n]}));
  sk.entities.push(...lines,inner);
  lines.forEach(l=>sk.constraints.push({id:skNewEid(sk),type:'tangent',line:l.id,ent:inner.id}));
  lines.slice(1).forEach(l=>sk.constraints.push({id:skNewEid(sk),type:'equal',a:lines[0].id,b:l.id}));
  const mid=addPoint(sk,C.x+r*Math.cos(ang),C.y+r*Math.sin(ang));
  const ray={id:skNewEid(sk),t:'line',p1:pc,p2:mid,construction:true};
  inner.poly.push(mid);
  sk.entities.push(ray);
  sk.constraints.push({id:skNewEid(sk),type:'midpoint',p:mid,line:lines[0].id},{id:skNewEid(sk),type:'perpendicular',a:ray.id,b:lines[0].id});
  if(Math.abs(Math.cos(ang))<1e-9)sk.constraints.push({id:skNewEid(sk),type:'h',line:lines[0].id});
  else if(Math.abs(Math.sin(ang))<1e-9)sk.constraints.push({id:skNewEid(sk),type:'v',line:lines[0].id});
  sk.dims.push({id:skNewEid(sk),type:'diameter',ent:inner.id,value:dVal,ox:0,oy:0});
  skAutoAttach(sk,pc,C.x,C.y,1e-3);
  return {lines,inner,ray};
}
function skPolyRescale(sk,e,r){
  // Ø changé (cote, paramètre) : la forme grandit autour de son centre AVANT la résolution, sinon le
  // solveur, qui bouge le moins de points possible, ferait glisser un centre encore libre.
  const C=sk.points[e.pc],k=r/e.r;if(!C||!(k>0)||Math.abs(k-1)<1e-12)return;
  e.poly.forEach(p=>{const q=sk.points[p];if(q){q.x=C.x+(q.x-C.x)*k;q.y=C.y+(q.y-C.y)*k;}});
}
function skPolyAim(sk,wx,wy){
  // lit la souris : orientation d'après la position brute, Ø d'après la position accrochée
  if(!skDown)return null;
  let bx=wx,by=wy;const s=findSnap(sk,wx,wy);
  if(s){bx=s.x;by=s.y;}else if($('skSnap').checked){bx=skSnapVal(bx);by=skSnapVal(by);}
  const moved=Math.hypot(wx-skDown.x,wy-skDown.y)>skMinLen();
  if(moved)skPoly.ang=skPolyAngle(wx-skDown.x,wy-skDown.y);
  const r=skPoly.d?skPoly.d/2:Math.hypot(bx-skDown.x,by-skDown.y);
  return {moved,r,ang:skPoly.ang};
}
function skPolyDraft(r,ang){
  skDraft=r>0?{t:'polygon',cx:skDown.x,cy:skDown.y,n:skPoly.n,r,ang}:null;
  drawSketch2D();
}
function skPolyMove(sk,wx,wy){
  const a=skPolyAim(sk,wx,wy);if(!a)return;
  skPoly.last={x:wx,y:wy};
  skPolyDraft(a.r,a.ang);
}
function skPolyFinish(sk,r,ang){
  skPushUndo();
  skPolyCreate(sk,skDown.pid,skPoly.n,r,ang);
  skDown=null;skDraft=null;skPoly.last=null;afterEdit();
  skStatus('Polygone créé — cliquez le centre du suivant (Échap = fin).');
}
function skPolyUp(sk,wx,wy){
  const a=skPolyAim(sk,wx,wy);if(!a)return;
  if(!a.moved||a.r<=skMinLen()){
    skDraft=null;drawSketch2D();
    skStatus(skPoly.d?'Polygone : centre posé — cliquez pour orienter (Entrée = un côté à plat en haut).':'Polygone : centre posé — cliquez le milieu d’un côté, ou tapez le Ø intérieur.');
    return;
  }
  skPolyFinish(sk,a.r,a.ang);
}
function skPolyEnter(){
  // Entrée : valide si le centre est posé et que le Ø est connu
  const sk=skEdit;if(!sk||!skDown)return false;
  const r=skDraft&&skDraft.t==='polygon'?skDraft.r:(skPoly.d?skPoly.d/2:0);
  if(!(r>skMinLen())){skStatus('Polygone : indiquez le Ø intérieur.');return false;}
  skPolyFinish(sk,skPoly.d?skPoly.d/2:r,skPoly.last?skPoly.ang:Math.PI/2);
  return true;
}
function skPolyRead(){
  const b=document.getElementById('skPolyBar');if(!b)return;
  const nv=Math.round(parseFloat(b.querySelector('[data-poly="n"]').value));
  if(nv>=SK_POLY_MIN&&nv<=SK_POLY_MAX)skPoly.n=nv;
  const dv=parseFloat(String(b.querySelector('[data-poly="d"]').value).replace(',','.'));
  skPoly.d=dv>0?dv:null;
  if(skDown&&skTool==='polygon'&&skEdit){
    if(skPoly.d)skStatus('Polygone : cliquez pour orienter, ou Entrée (un côté à plat en haut).');
    if(skPoly.last)skPolyMove(skEdit,skPoly.last.x,skPoly.last.y);
    else skPolyDraft(skPoly.d?skPoly.d/2:0,Math.PI/2);
  }
}
function skPolyBuild(){
  const host=document.getElementById('skMain');if(!host)return null;
  const b=document.createElement('div');b.id='skPolyBar';
  b.style.cssText='position:absolute;left:10px;top:10px;z-index:20;display:flex;gap:10px;align-items:center;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--panel,#1e1e1e);font-size:.8rem';
  const field=(key,label,w,title,attrs)=>{
    const lb=document.createElement('label');lb.style.cssText='display:flex;gap:5px;align-items:center';lb.title=title;
    lb.appendChild(document.createTextNode(label));
    const i=document.createElement('input');i.dataset.poly=key;i._parFx=1;i.style.width=w;
    Object.keys(attrs).forEach(k=>{i[k]=attrs[k];});
    i.addEventListener('input',skPolyRead);
    i.addEventListener('keydown',e=>{
      e.stopPropagation();
      if(e.key==='Enter'){e.preventDefault();skPolyRead();i.blur();skPolyEnter();}
      else if(e.key==='Escape'){e.preventDefault();i.blur();skEscapeToSelect();}
    });
    lb.appendChild(i);b.appendChild(lb);
  };
  field('n','Côtés','52px','Nombre de côtés ('+SK_POLY_MIN+' à '+SK_POLY_MAX+')',{type:'number',min:SK_POLY_MIN,max:SK_POLY_MAX,step:1,value:skPoly.n});
  field('d','Ø intérieur','92px','Ø du cercle tangent aux côtés (sur-plats) — vide : à la souris',{type:'text',inputMode:'decimal',placeholder:'à la souris',value:skPoly.d||''});
  host.appendChild(b);
  return b;
}
function skPolySync(){
  // le bandeau de réglages n'existe à l'écran que pendant l'outil Polygone
  const on=!!skEdit&&skTool==='polygon';
  let b=document.getElementById('skPolyBar');
  if(!on){if(b)b.style.display='none';return;}
  if(!b)b=skPolyBuild();
  if(b)b.style.display='flex';
}
function skPolyType(ch){
  // chiffre tapé pendant l'outil : il part dans le champ Ø
  skPolySync();
  const b=document.getElementById('skPolyBar');if(!b)return false;
  const i=b.querySelector('[data-poly="d"]');
  i.value=ch;i.focus();skPolyRead();
  return true;
}
function skPolyDrawDraft(d){
  const q=skPolyPts(d.cx,d.cy,d.n,d.r,d.ang).map(p=>w2s(p.x,p.y));
  skEl('path',{d:'M '+q.map(s=>s[0].toFixed(1)+' '+s[1].toFixed(1)).join(' L ')+' Z',fill:'rgba(255,255,255,.06)',stroke:'#fff','stroke-width':2,'stroke-dasharray':'5 3'});
  const[a,b]=w2s(d.cx,d.cy);
  skEl('circle',{cx:a,cy:b,r:d.r*skView.s,fill:'none',stroke:'#ffd60a','stroke-width':1,'stroke-dasharray':'3 3'});
  const t=skEl('text',{x:a,y:b-(d.r/Math.cos(Math.PI/d.n))*skView.s-10,fill:'#ffd60a','font-size':13,'font-weight':'bold','text-anchor':'middle'});
  t.textContent=d.n+' côtés · ⌀'+(d.r*2).toFixed(2);
}
