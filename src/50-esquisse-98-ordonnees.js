/* ---------- Esquisse : cotes d'ordonnées (V1.0.20, avec les cotes 3D) ----------
   2026-11-27 — Fred : « il faudrait ajouter les cotes d'ordonnées dans l'esquisse et donc le 3D et donc
   la mise en plan ».
   Outil « Ordonnées » : bandeau X / Y ; clic 1 = le zéro (point, extrémité, centre d'un cercle ou d'un
   arc), puis chaque point à coter ; Entrée ou Échap pour finir (le bandeau change d'axe en gardant le
   zéro). Chaque valeur est une cote « distance » ordinaire du zéro au point, orientée H (X) ou V (Y) :
   le solveur la pilote comme les autres (scaleAxisPts), elle passe en référence si elle est en trop.
   Elle porte en plus ord:1 et og (la famille) : dessinée en ordonnée, sans flèche, la valeur au bout
   d'une ligne de rappel, toutes les valeurs d'une famille alignées (même écart w depuis le zéro),
   « 0 » au zéro. Glisser une valeur déplace toute la famille. */
let skOrd=null; // {o: point zéro, ax: 'h' | 'v', og: famille en cours ou null}
SK_TRACE_MODES.ord={titre:'Ordonnées en',modes:[
  ['x','X','Positions le long de X depuis le zéro'],
  ['y','Y','Positions le long de Y depuis le zéro']]};
skTraceMode.ord='x';
SK_TR_MSG.ord={x:['Ordonnées X : cliquez le zéro (point, extrémité, centre de cercle).'],y:['Ordonnées Y : cliquez le zéro (point, extrémité, centre de cercle).']};
try{if(typeof SK_ICONS!=='undefined')SK_ICONS.ord='<path d="M5 19V5M5 19h15"/><path d="M10 19V9M15 19V6M20 19v-7" stroke-dasharray="2 2"/><path d="M3.5 3.5h3M8.5 7.5h3M13.5 4.5h3"/>';}catch(e){}
function skOrdAx(){return skTraceMode.ord==='y'?'v':'h';}
function skOrdPick(sk,x,y){
  const pid=nearestPoint(sk,x,y,SK_PT)||nearestPoint(sk,x,y,SK_SNAP);if(pid)return pid;
  const e=nearestEntity(sk,x,y,SK_PICK);
  if(e&&(e.t==='circle'||e.t==='arc')&&e.pc)return e.pc;
  if(e&&e.t==='cpoint'&&e.p)return e.p;
  return null;
}
function skOrdFam(sk,og){return (sk.dims||[]).filter(d=>d&&d.ord&&d.og===og);}
function skOrdDefW(sk,A,ax){
  // valeurs posées hors du dessin : 30 px au-delà des points de l'esquisse, du côté le plus proche du zéro
  let lo=1e18,hi=-1e18;
  Object.keys(sk.points||{}).forEach(k=>{const p=sk.points[k];if(!p||p.txt)return;const v=ax==='h'?p.y:p.x;if(v<lo)lo=v;if(v>hi)hi=v;});
  const z=ax==='h'?A.y:A.x,g=30/((typeof skView!=='undefined'&&skView.s)||1);
  if(!(hi>=lo))return g;
  return (hi-z)<=(z-lo)?(hi-z)+g:(lo-z)-g;
}
function skOrdClick(sk,x,y){
  const pid=skOrdPick(sk,x,y);
  if(!pid){skStatus('Ordonnées : cliquez un point, une extrémité ou un cercle.');return;}
  const ax=skOrdAx();
  if(!skOrd||!sk.points[skOrd.o]){
    skOrd={o:pid,ax,og:null};
    skStatus('Ordonnées '+(ax==='h'?'X':'Y')+' : zéro posé — cliquez les points à coter (Entrée ou Échap pour finir).');
    drawSketch2D();return;
  }
  if(pid===skOrd.o)return;
  if(skOrd.ax!==ax){skOrd.ax=ax;skOrd.og=null;}
  const ex=(sk.dims||[]).find(d=>d&&d.ord&&d.a===skOrd.o&&d.b===pid&&d.orient===ax);
  if(ex){skSel={kind:'dim',id:ex.id};skSelX=[];skStatus('Ce point a déjà son ordonnée depuis ce zéro.');drawSketch2D();renderSkPanel();return;}
  const A=sk.points[skOrd.o],B=sk.points[pid];if(!A||!B)return;
  skPushUndo();
  let w;
  const fam=skOrd.og?skOrdFam(sk,skOrd.og):[];
  if(fam.length&&isFinite(fam[0].w))w=fam[0].w;
  else{
    // une famille déjà là sur ce zéro et cet axe : on la continue
    const old=(sk.dims||[]).find(d=>d&&d.ord&&d.a===skOrd.o&&d.orient===ax);
    if(old){skOrd.og=old.og;w=old.w;}
    else{skOrd.og='og'+skNewEid(sk);w=skOrdDefW(sk,A,ax);}
  }
  const id=skNewEid(sk);
  sk.dims.push({id,type:'distance',a:skOrd.o,b:pid,orient:ax,ord:1,og:skOrd.og,w:+(+w).toFixed(3),value:+dimMeasureOf(A,B,ax).toFixed(2)});
  try{skCheckNewDims(sk);}catch(e){}
  afterEdit();
  skStatus('Ordonnée '+(ax==='h'?'X':'Y')+' = '+dimMeasureOf(A,B,ax).toFixed(2)+' — point suivant, ou Entrée / Échap pour finir.');
}
function skOrdEnd(){if(!skOrd)return false;skOrd=null;try{skStatus(skTraceMsg('ord'));drawSketch2D();}catch(e){}return true;}
// segment « ligne de cote » d'une ordonnée : du point coté jusqu'à l'alignement des valeurs
function skOrdSeg(d,A,B){
  const w=(d.w!=null&&isFinite(d.w))?d.w:0;
  if(d.orient==='v'){const cx=A.x+w;return{a:{x:B.x,y:B.y},b:{x:cx,y:B.y},A,B,nx:1,ny:0,w,ord:1};}
  const cy=A.y+w;return{a:{x:B.x,y:B.y},b:{x:B.x,y:cy},A,B,nx:0,ny:1,w,ord:1};
}
function skOrdTxt(d){const t=(+d.value).toFixed(2);return d.ref?'('+t+')':t;}
function skOrdTextAt(S,d){
  // la valeur au bout de la ligne de rappel, dans son prolongement
  const dx=S.b.x-S.a.x,dy=S.b.y-S.a.y,L=Math.hypot(dx,dy);
  let ux=dx/L,uy=dy/L;if(!(L>1e-9)){ux=S.nx;uy=S.ny;if(d.w<0){ux=-ux;uy=-uy;}}
  const s=(typeof skView!=='undefined'&&skView.s)||1,half=(skOrdTxt(d).length*7.8+10)/2/s+2/s;
  return{x:S.b.x+ux*half,y:S.b.y+uy*half};
}
function skOrdSyncW(sk,d){
  // toutes les valeurs d'une famille restent alignées
  if(!d||!d.og)return;
  skOrdFam(sk,d.og).forEach(x=>{if(x!==d)x.w=d.w;});
}
function skOrdTextTo(sk,d,tx,ty){
  const A=sk.points[d.a];if(!A)return false;
  const s=(typeof skView!=='undefined'&&skView.s)||1,half=(skOrdTxt(d).length*7.8+10)/2/s;
  let w=d.orient==='v'?tx-A.x:ty-A.y;
  // le texte est au-delà du bout : on retire sa demi-longueur
  const B=sk.points[d.b];
  if(B){const far=d.orient==='v'?(tx>B.x?1:-1):(ty>B.y?1:-1);w-=far*half;}
  d.w=+w.toFixed(3);d.sl=0;skOrdSyncW(sk,d);return true;
}
function skOrdDraw(sk,d,st){
  const S=dimSeg(sk,d);if(!S)return;
  const s=skView.s||1,gap=3/s;
  const dx=S.b.x-S.a.x,dy=S.b.y-S.a.y,L=Math.hypot(dx,dy);
  if(L>gap){const[ax,ay]=w2s(S.a.x+dx/L*gap,S.a.y+dy/L*gap),[bx,by]=w2s(S.b.x,S.b.y);
    skEl('line',{x1:ax,y1:ay,x2:bx,y2:by,stroke:st,'stroke-width':1,opacity:.85,'pointer-events':'none'});}
  dimTextOnLine(S,skOrdTxt(d),d.id,d);
  // « 0 » au zéro : une fois par famille (la cote de plus petit rang la porte)
  const fam=skOrdFam(sk,d.og);
  if(fam[0]===d){
    const A=S.A,Z=d.orient==='v'?{a:{x:A.x,y:A.y},b:{x:A.x+S.w,y:A.y},nx:1,ny:0}:{a:{x:A.x,y:A.y},b:{x:A.x,y:A.y+S.w},nx:0,ny:1};
    const zl=Math.hypot(Z.b.x-Z.a.x,Z.b.y-Z.a.y);
    if(zl>gap){const ux=(Z.b.x-Z.a.x)/zl,uy=(Z.b.y-Z.a.y)/zl,[ax,ay]=w2s(Z.a.x+ux*gap,Z.a.y+uy*gap),[bx,by]=w2s(Z.b.x,Z.b.y);
      skEl('line',{x1:ax,y1:ay,x2:bx,y2:by,stroke:st,'stroke-width':1,opacity:.85,'pointer-events':'none'});
      const T={x:Z.b.x+ux*9/s,y:Z.b.y+uy*9/s},[tx,ty]=w2s(T.x,T.y);
      const t=skEl('text',{x:tx.toFixed(1),y:(ty+4.5).toFixed(1),fill:st,'font-size':13,'font-weight':'bold','text-anchor':'middle',stroke:'#101012','stroke-width':3,'paint-order':'stroke','pointer-events':'none'});
      t.textContent='0';}
  }
}
function skOrdOverlay(sk){
  // zéro choisi : rond orange
  if(!skOrd||skTool!=='ord')return;
  const P=sk.points[skOrd.o];if(!P)return;
  const[x,y]=w2s(P.x,P.y);
  skEl('circle',{cx:x,cy:y,r:7,fill:'none',stroke:'#ff9f0a','stroke-width':2,'pointer-events':'none'});
  const t=skEl('text',{x:x+10,y:y-9,fill:'#ff9f0a','font-size':12,'font-weight':'bold','pointer-events':'none'});t.textContent='0';
}
// bouton de la barre d'esquisse, juste après 📐 Cote
(function(){
  const bar=document.getElementById('skToolbar');if(!bar||bar.querySelector('[data-tool="ord"]'))return;
  const title='Ordonnées : cliquez le zéro, puis les points — toutes les positions en X (ou en Y) depuis un même zéro, valeurs alignées ; Entrée pour finir';
  const b=document.createElement('button');b.className='tool';b.dataset.tool='ord';b.title=title;
  if(typeof SK_ICONS!=='undefined'&&SK_ICONS.ord)b.innerHTML=skIcon('ord',20);else b.textContent='⊢';
  b.onclick=()=>{skCancelDraft();skOrd=null;skTool='ord';document.querySelectorAll('#skToolbar .tool').forEach(x=>x.classList.toggle('on',x===b));
    try{skModeBarSync();}catch(e){}
    if(skEdit){skStatus(skTraceMsg('ord'));drawSketch2D();}};
  const dm=bar.querySelector('[data-tool="dim"]');
  if(dm&&dm.parentNode)dm.parentNode.insertBefore(b,dm.nextSibling);else bar.appendChild(b);
})();
