/* ---------- Esquisse : outil Décalage (O) comme Fusion ----------
   2026-11-10 : demande de Fred — le Décalage n'était pas optimum (sélection, puis clic du côté, distance
   au curseur). Maintenant :
   1. le bouton reste allumé tant que l'outil est actif ; on enchaîne les décalages sans le relancer ;
   2. un clic choisit une ligne, un arc, un cercle ou une spline ; Ctrl/Cmd (ou Maj) ajoute / retire ;
      « Chaîne tangente » (bandeau, ou double-clic) prend d'un coup tous les traits qui se suivent en
      tangence (oblong, contour à coins arrondis…) ;
   3. un APERÇU orange apparaît tout de suite à 3 mm (puis la dernière distance utilisée), du côté
      proposé (extérieur d'un contour fermé) ; « ⇄ Inverser » (ou un clic dans le vide du côté voulu)
      le passe de l'autre côté ; la distance se tape au clavier ;
   4. « Des deux côtés » : une copie de chaque côté de la référence (miroir) ;
   5. la copie n'est JAMAIS en construction, même quand la référence l'est (arête projetée…).
   Entrée / ✓ = valider (l'outil reste actif) · Échap = vider la sélection, 2ᵉ Échap = outil Sélection.
   Le calcul reste skOffsetApply (50-esquisse-3) : cotes, parallèles et décalages égaux associatifs. */
let skOffOpt={D:3,flip:false,both:false,chain:true}; // gardé d'un décalage au suivant (sauf l'inversion)
let skOffPv=null;   // aperçu calculé {key, ents:[entités copiées], P:points, label}
let skOffHov=null;  // ids survolés (ce qu'un clic prendrait)
function skOffElig(e){return !!e&&!e.ref&&!e.handle&&(e.t==='line'||e.t==='circle'||e.t==='arc'||e.t==='spline');}
function skOffSelIds(){return skSelectedEnts().filter(skOffElig).map(e=>e.id);}
function skOffSetSel(ids){
  ids=[...new Set(ids)];
  skSel=ids.length?{kind:'ent',id:ids[0]}:null;
  skSelX=ids.slice(1).map(id=>({kind:'ent',id}));
}
// tangente unitaire d'une ligne / d'un arc au point pid (sens sans importance)
function skOffTanAt(sk,e,pid){
  const P=sk.points,Q=P[pid];if(!Q)return null;
  if(e.t==='line'){const A=P[e.p1],B=P[e.p2];if(!A||!B)return null;const L=Math.hypot(B.x-A.x,B.y-A.y);return L>1e-12?{x:(B.x-A.x)/L,y:(B.y-A.y)/L}:null;}
  if(e.t==='arc'){const C=P[e.pc];if(!C)return null;const vx=Q.x-C.x,vy=Q.y-C.y,L=Math.hypot(vx,vy);return L>1e-12?{x:-vy/L,y:vx/L}:null;}
  return null;
}
// traits qui se suivent EN TANGENCE à partir de « start » (bouts joints + même direction au joint, à 1° près)
function skOffTangentChain(sk,start){
  if(!start||(start.t!=='line'&&start.t!=='arc'))return start?[start.id]:[];
  const ends=e=>e.t==='line'?[e.p1,e.p2]:[e.pa,e.pb];
  const cand=(sk.entities||[]).filter(e=>skOffElig(e)&&(e.t==='line'||e.t==='arc'));
  const seen=new Set([start.id]),todo=[start],SIN=Math.sin(Math.PI/180);
  while(todo.length){
    const e=todo.pop();
    for(const p of ends(e)){
      const t1=skOffTanAt(sk,e,p);if(!t1)continue;
      for(const o of cand){
        if(seen.has(o.id))continue;
        const q=ends(o).find(x=>skJointSame(sk,x,p));if(!q)continue;
        const t2=skOffTanAt(sk,o,q);if(!t2)continue;
        if(Math.abs(t1.x*t2.y-t1.y*t2.x)<=SIN){seen.add(o.id);todo.push(o);}
      }
    }
  }
  return[...seen];
}
// ce qu'un clic en (wx,wy) prendrait : l'entité, ou sa chaîne tangente
function skOffPickAt(sk,wx,wy,chain){
  const ent=nearestEntity(sk,wx,wy,SK_PICK);
  if(!skOffElig(ent))return null;
  return(chain?skOffTangentChain(sk,ent):[ent.id]);
}
// le décalage sur une COPIE de l'esquisse (rien ne change dans le document) → les entités créées
function skOffSimulate(sk,ids,D,flip){
  const c=Object.assign({},sk,{points:JSON.parse(JSON.stringify(sk.points||{})),entities:JSON.parse(JSON.stringify(sk.entities||[])),
    constraints:(sk.constraints||[]).slice(),dims:(sk.dims||[]).slice()});
  const n0=c.entities.length;
  skOffDo(c,ids,D,flip);
  return{ents:c.entities.slice(n0),P:c.points,sk:c};
}
// décalage d'un côté : lignes / arcs / cercles (associatif) + splines (copie approchée)
function skOffDo(sk,ids,D,flip){
  const ents=ids.map(id=>entById(sk,id)).filter(Boolean);
  const geo=ents.filter(e=>e.t!=='spline').map(e=>e.id),spl=ents.filter(e=>e.t==='spline');
  const out={ok:false,msg:'',n:0,cusp:false,nS:0};
  if(geo.length){const r=skOffsetApply(sk,geo,D,null,{flip});out.msg=r.msg;if(r.ok){out.ok=true;out.n+=r.copies.length;}}
  spl.forEach(e=>{const r=skSplineOffset(sk,e,D,flip?-1:1);if(r&&typeof r==='object'){delete r.e.construction;out.ok=true;out.nS++;out.cusp=out.cusp||r.cusp;}});
  return out;
}
function skOffSigKey(sk,ids){
  let s=0;const P=sk.points;
  ids.forEach(id=>{const e=entById(sk,id);if(!e)return;skEntPids(e).forEach(p=>{const q=P[p];if(q)s+=q.x*1.31+q.y*0.77;});if(e.r)s+=e.r;});
  return ids.join(',')+'|'+s.toFixed(9);
}
function skOffPreview(sk){
  const ids=skOffSelIds();
  if(!ids.length||!(skOffOpt.D>=0.001)){skOffPv=null;return null;}
  const key=skOffSigKey(sk,ids)+'|'+skOffOpt.D+'|'+skOffOpt.flip+'|'+skOffOpt.both;
  if(skOffPv&&skOffPv.key===key&&skOffPv.sk===sk)return skOffPv;
  const sides=skOffOpt.both?[false,true]:[skOffOpt.flip];
  const pv={key,sk,parts:[]};
  try{sides.forEach(f=>pv.parts.push(skOffSimulate(sk,ids,skOffOpt.D,f)));}catch(e){pv.err=String(e&&e.message||e);}
  skOffPv=pv;return pv;
}
// tracé d'une entité d'une copie (lignes, arcs, cercles, splines)
function skOffDrawEnt(c,e,attrs){
  const P=c.P;
  if(e.t==='line'){const A=P[e.p1],B=P[e.p2];if(!A||!B)return null;const[a,b]=w2s(A.x,A.y),[x2,y2]=w2s(B.x,B.y);
    skEl('line',Object.assign({x1:a,y1:b,x2,y2},attrs));return{x:(A.x+B.x)/2,y:(A.y+B.y)/2};}
  if(e.t==='circle'){const C=P[e.pc];if(!C)return null;const[a,b]=w2s(C.x,C.y);
    skEl('circle',Object.assign({cx:a,cy:b,r:e.r*skView.s,fill:'none'},attrs));return{x:C.x,y:C.y+e.r};}
  if(e.t==='arc'){const C=P[e.pc],A=P[e.pa],B=P[e.pb];if(!C||!A||!B)return null;
    let a1=Math.atan2(A.y-C.y,A.x-C.x),a2=Math.atan2(B.y-C.y,B.x-C.x),dd=a2-a1;while(dd<=0)dd+=Math.PI*2;
    const[x1,y1]=w2s(A.x,A.y),[x2,y2]=w2s(B.x,B.y),R=e.r*skView.s;
    skEl('path',Object.assign({d:`M ${x1} ${y1} A ${R} ${R} 0 ${dd>Math.PI?1:0} 0 ${x2} ${y2}`,fill:'none'},attrs));
    const am=a1+dd/2;return{x:C.x+e.r*Math.cos(am),y:C.y+e.r*Math.sin(am)};}
  if(e.t==='spline'){let pl=null;try{pl=skSplinePoly(c.sk||{points:P,entities:[e]},e);}catch(_){}
    if(!pl||pl.length<2)return null;
    skEl('path',Object.assign({d:'M '+pl.map(q=>{const s=w2s(q[0],q[1]);return s[0].toFixed(1)+' '+s[1].toFixed(1);}).join(' L '),fill:'none'},attrs));
    const m=pl[Math.floor(pl.length/2)];return{x:m[0],y:m[1]};}
  return null;
}
// appelé par drawSketch2D quand l'outil Décalage est actif
function skOffDraw(sk){
  const P=sk.points;
  if(skOffHov&&skOffHov.length){ // survol : ce que le clic prendrait (chaîne tangente comprise)
    const sel=new Set(skOffSelIds());
    skOffHov.forEach(id=>{const e=entById(sk,id);if(e&&!sel.has(id))skOffDrawEnt({P,sk},e,{stroke:'#64d2ff','stroke-width':3,opacity:0.55});});
  }
  const pv=skOffPreview(sk);
  if(!pv)return;
  pv.parts.forEach(c=>{
    let lab=null;
    c.ents.forEach(e=>{const m=skOffDrawEnt(c,e,{stroke:'#ff9f0a','stroke-width':2,'stroke-dasharray':'6 3'});if(!lab&&m)lab=m;});
    if(lab){const[a,b]=w2s(lab.x,lab.y);
      const t=skEl('text',{x:a+8,y:b-8,fill:'#ff9f0a','font-size':13,'font-weight':'bold'});
      t.textContent=String(+skOffOpt.D.toFixed(3)).replace('.',',')+' mm';}
  });
}
/* ----- bandeau (en haut à gauche, comme les choix de l'oblong / du rectangle) ----- */
function skOffBarBuild(){
  const host=document.getElementById('skMain');if(!host)return null;
  const b=document.createElement('div');b.id='skOffBar';
  b.style.cssText='position:absolute;left:10px;top:10px;z-index:20;display:flex;gap:6px;align-items:center;flex-wrap:wrap;max-width:calc(100% - 20px);padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--panel,#1e1e1e);font-size:.8rem';
  const btn=(k,lab,tip,fn)=>{const c=document.createElement('button');c.type='button';c.dataset.k=k;c.textContent=lab;c.title=tip;
    c.addEventListener('click',ev=>{ev.stopPropagation();fn();});b.appendChild(c);return c;};
  const t=document.createElement('b');t.textContent='Décalage';b.appendChild(t);
  btn('chain','Chaîne tangente','Un clic prend tous les traits qui se suivent en tangence (double-clic : toujours la chaîne)',()=>{skOffOpt.chain=!skOffOpt.chain;skOffBarSync();});
  const lab=document.createElement('label');lab.style.cssText='display:flex;align-items:center;gap:4px';lab.textContent='Distance';
  const inp=document.createElement('input');inp.id='skOffD';inp.type='text';inp.inputMode='decimal';inp.style.cssText='width:64px';
  inp.title='Distance du décalage (mm) — Entrée valide';
  inp.addEventListener('input',()=>{const v=parseFloat(String(inp.value).replace(',','.'));if(isFinite(v)&&v>0){skOffOpt.D=Math.abs(v);skOffPv=null;if(skEdit)drawSketch2D();}});
  inp.addEventListener('keydown',ev=>{ev.stopPropagation();
    if(ev.key==='Enter'){ev.preventDefault();skOffApplyNow();}
    else if(ev.key==='Escape'){ev.preventDefault();inp.blur();skOffEscape();}});
  inp.addEventListener('pointerdown',ev=>ev.stopPropagation());
  lab.appendChild(inp);lab.appendChild(document.createTextNode('mm'));b.appendChild(lab);
  btn('flip','⇄ Inverser','Passer la copie de l’autre côté (ou cliquez dans le vide du côté voulu)',()=>{skOffOpt.flip=!skOffOpt.flip;skOffPv=null;if(skEdit)drawSketch2D();});
  btn('both','⇋ Des deux côtés','Une copie de chaque côté de la référence (miroir)',()=>{skOffOpt.both=!skOffOpt.both;skOffPv=null;if(skEdit)drawSketch2D();});
  btn('ok','✓ OK','Valider le décalage (Entrée) — l’outil reste actif',()=>skOffApplyNow());
  btn('no','✕','Vider la sélection (Échap)',()=>skOffEscape());
  host.appendChild(b);
  return b;
}
function skOffBarSync(){
  let b=document.getElementById('skOffBar');
  const on=!!skEdit&&skTool==='offset';
  if(!on){if(b)b.style.display='none';return;}
  if(!b)b=skOffBarBuild();if(!b)return;
  b.style.display='flex';
  const has=skOffSelIds().length>0;
  const inp=document.getElementById('skOffD');
  if(inp&&document.activeElement!==inp)inp.value=String(+skOffOpt.D.toFixed(3)).replace('.',',');
  const lit=(k,act)=>{const c=b.querySelector('[data-k="'+k+'"]');if(!c)return;c.style.background=act?'var(--accent,#2f7ff0)':'';c.style.color=act?'#fff':'';c.setAttribute('aria-pressed',act?'true':'false');};
  lit('chain',skOffOpt.chain);lit('flip',skOffOpt.flip&&!skOffOpt.both);lit('both',skOffOpt.both);
  ['flip','ok','no'].forEach(k=>{const c=b.querySelector('[data-k="'+k+'"]');if(c)c.disabled=!has;});
  const fl=b.querySelector('[data-k="flip"]');if(fl)fl.disabled=!has||skOffOpt.both;
}
function skOffMsg(){
  const n=skOffSelIds().length;
  if(!n)return'Décalage : cliquez une ligne, un arc, un cercle ou une spline'+(skOffOpt.chain?' (la chaîne tangente est prise d’un coup)':'')+' — Ctrl = ajouter / retirer, double-clic = chaîne tangente.';
  return'Décalage : '+n+' trait(s) — tapez la distance, ⇄ Inverser ou cliquez du côté voulu, puis Entrée / ✓ (Ctrl+clic = ajouter / retirer, Échap = vider).';
}
/* ----- souris et clavier ----- */
function skOffClick(sk,wx,wy,e){
  const chain=skOffOpt.chain||(e&&e.detail===2);
  const ids=skOffPickAt(sk,wx,wy,chain);
  if(ids){
    const cur=skOffSelIds();
    if(skMulti(e)||(e&&e.shiftKey)){
      const all=ids.every(id=>cur.includes(id));
      skOffSetSel(all?cur.filter(id=>!ids.includes(id)):cur.concat(ids));
    }else if(e&&e.detail===2)skOffSetSel(ids);
    else skOffSetSel(ids);
    const had=cur.length>0;
    skOffPv=null;renderSkPanel();drawSketch2D();skStatus(skOffMsg());
    if(!had)skOffFocus();
    return;
  }
  // clic dans le vide : la copie passe du côté cliqué (la plus proche des deux)
  const cur=skOffSelIds();
  if(!cur.length){skStatus(skOffMsg());return;}
  if(skOffOpt.both)return;
  const d=f=>{const c=skOffSimulate(sk,cur,skOffOpt.D,f);let b=Infinity;
    c.ents.forEach(en=>{const P=c.P;
      if(en.t==='line'){const A=P[en.p1],B=P[en.p2];if(A&&B)b=Math.min(b,distSeg(wx,wy,A,B));}
      else if(en.t==='circle'||en.t==='arc'){const C=P[en.pc];if(C)b=Math.min(b,Math.abs(Math.hypot(wx-C.x,wy-C.y)-en.r));}
      else if(en.t==='spline'){try{const pl=skSplinePoly(c.sk,en);if(pl)b=Math.min(b,skPolyDist(wx,wy,pl));}catch(_){}}});
    return b;};
  const want=d(true)<d(false);
  if(want!==skOffOpt.flip){skOffOpt.flip=want;skOffPv=null;drawSketch2D();}
  skStatus(skOffMsg());
}
function skOffHover(sk,wx,wy){
  const ids=skOffPickAt(sk,wx,wy,skOffOpt.chain);
  const k=ids?ids.join(','):'',k0=skOffHov?skOffHov.join(','):'';
  if(k!==k0){skOffHov=ids;drawSketch2D();}
}
function skOffFocus(){
  setTimeout(()=>{const i=document.getElementById('skOffD');if(i&&skEdit&&skTool==='offset'){try{i.focus();i.select();}catch(e){}}},0);
}
function skOffEscape(){
  if(skOffSelIds().length){skOffSetSel([]);skOffPv=null;renderSkPanel();drawSketch2D();skStatus(skOffMsg());return true;}
  return false;
}
function skOffApplyNow(){
  const sk=skEdit;if(!sk)return;
  const ids=skOffSelIds();
  if(!ids.length){skStatus(skOffMsg());return;}
  const D=skOffOpt.D;
  if(!(D>=0.001)){skStatus('Décalage : distance ≥ 0,001 mm requise.');return;}
  skPushUndo();
  const sides=skOffOpt.both?[false,true]:[skOffOpt.flip];
  let n=0,nS=0,cusp=false,msg='';
  sides.forEach(f=>{const r=skOffDo(sk,ids,D,f);if(r.ok){n+=r.n;nS+=r.nS;cusp=cusp||r.cusp;}else msg=r.msg;});
  if(!n&&!nS){skUndoStack.pop();skUndoBtn();skStatus(msg||'Décalage impossible.');drawSketch2D();return;}
  skOffsetD=D;
  skOffSetSel([]);skOffPv=null;skOffHov=null;
  afterEdit();
  skStatus('Décalage de '+String(+D.toFixed(3)).replace('.',',')+' mm'+(skOffOpt.both?' des deux côtés':'')+' : '+(n+nS)+' copie(s)'+
    (nS?' (spline : copie approchée à 0,005 mm, non associative'+(cusp?' ⚠ elle se recoupe':'')+')':'')+
    ' — cote modifiable (double-clic). Cliquez le trait suivant.');
}
// clavier quand l'outil est actif (hors champ de saisie) : true = touche prise
function skOffKey(e){
  if(e.ctrlKey||e.altKey||e.metaKey)return false;
  if(e.key==='Escape'){if(skOffEscape()){e.preventDefault();return true;}return false;}
  if(e.key==='Enter'){e.preventDefault();skOffApplyNow();return true;}
  if(/^[0-9.,]$/.test(e.key)&&skOffSelIds().length){ // taper un chiffre : la distance se remplace
    const i=document.getElementById('skOffD');if(!i)return false;
    e.preventDefault();i.focus();i.value=e.key===','?'0,':(e.key==='.'?'0.':e.key);i.dispatchEvent(new Event('input'));return true;
  }
  return false;
}
// boutons de la barre d'esquisse : allumé = outil actif (quel que soit le chemin qui l'a changé)
function skToolBtnSync(){
  try{document.querySelectorAll('#skToolbar .tool').forEach(x=>{const on=x.dataset.tool===skTool;if(x.classList.contains('on')!==on)x.classList.toggle('on',on);});}catch(e){}
}
