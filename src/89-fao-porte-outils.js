/* ============ FAO : porte-outils (V0.90.0) ============
   Demande : « pouvoir modifier / créer ses porte-outils, avec chanfreins d'entrée,
   cône et/ou cylindres ».

   MODÈLE — setup.holders[] : bibliothèque de porte-outils du posage.
     {id:'PO1', name:'Porte-pince', segs:[…]}  — segs décrits DU NEZ VERS LA BROCHE :
       {t:'chf', c, a}        chanfrein d'entrée : longueur c (mm) le long de l'axe,
                              angle a (°, 45 par défaut) ; il entame le tronçon qui SUIT
       {t:'cone', d1, d2, h}  cône : Ø côté nez, Ø côté broche, hauteur
       {t:'cyl', d, h}        cylindre : Ø, hauteur
   Un outil choisit son porte-outil par t.holderId (absent = porte-outil générique,
   simple cylindre au Ø « mandrin » de la fiche, comme avant).
   CACHE — holderId et setup.holders ne sont PAS dans la clé de cache des parcours
   (faoToolKeyObj ne voit que les champs historiques) : aucune trajectoire périmée. */
const FAO_HOLDER_TYPES=[['chf','Chanfrein d’entrée'],['cone','Cône'],['cyl','Cylindre']];
function faoHolders(setup){ return (setup&&Array.isArray(setup.holders))?setup.holders:[]; }
function faoHolderById(setup,id){
  if(!id)return null;
  return faoHolders(setup).filter(function(h){return h&&h.id===id;})[0]||null;
}
function faoHolderSegClean(s){
  // Tronçon valide et normalisé (nombres > 0), ou null.
  if(!s||typeof s!=='object')return null;
  const n=function(v){ v=+v; return (isFinite(v)&&v>0)?Math.round(v*1000)/1000:0; };
  if(s.t==='cyl'){ const d=n(s.d),h=n(s.h); return (d&&h)?{t:'cyl',d:d,h:h}:null; }
  if(s.t==='cone'){ const d1=n(s.d1),d2=n(s.d2),h=n(s.h); return (d1&&d2&&h)?{t:'cone',d1:d1,d2:d2,h:h}:null; }
  if(s.t==='chf'){ const c=n(s.c); let a=n(s.a)||45; a=Math.min(85,Math.max(5,a)); return c?{t:'chf',c:c,a:a}:null; }
  return null;
}
function faoHolderClean(h){
  // Copie assainie d'un porte-outil (fichier importé, presse-papiers) ou null.
  if(!h||typeof h!=='object'||!Array.isArray(h.segs))return null;
  const segs=h.segs.map(faoHolderSegClean).filter(function(s){return !!s;});
  if(!segs.some(function(s){return s.t!=='chf';}))return null;
  return {id:String(h.id||'PO'),name:String(h.name||'Porte-outil').slice(0,32),segs:segs};
}
function faoHolderSame(a,b){
  // Même porte-outil (nom + tronçons), quel que soit son identifiant.
  const k=function(h){ const c=faoHolderClean(h); return c?JSON.stringify([c.name,c.segs]):''; };
  return k(a)!==''&&k(a)===k(b);
}
function faoHolderProfile(h){
  // Contour extérieur [rayon, z] du nez (z = 0) vers la broche ; null si vide.
  // Un chanfrein d'entrée entame le premier tronçon cône/cylindre qui le suit.
  const c=faoHolderClean(h);
  if(!c)return null;
  const S=c.segs,pts=[];let z=0,dmax=0;
  const push=function(r,zz){
    const l=pts[pts.length-1];
    if(!l||Math.abs(l[0]-r)>1e-9||Math.abs(l[1]-zz)>1e-9)pts.push([r,zz]);
    if(2*r>dmax)dmax=2*r;
  };
  for(let i=0;i<S.length;i++){
    const s=S[i];
    if(s.t==='cyl'){ push(s.d/2,z); z+=s.h; push(s.d/2,z); }
    else if(s.t==='cone'){ push(s.d1/2,z); z+=s.h; push(s.d2/2,z); }
    else{
      let nx=null;for(let j=i+1;j<S.length&&!nx;j++)if(S[j].t!=='chf')nx=S[j];
      if(!nx)continue;
      const r=(nx.t==='cyl'?nx.d:nx.d1)/2;
      const dr=Math.min(s.c*Math.tan(s.a*Math.PI/180),r*0.9);
      push(r-dr,z); z+=s.c; push(r,z);
    }
  }
  if(pts.length<2)return null;
  return {pts:pts,h:z,dmax:dmax,dNose:2*pts[0][0]};
}
function faoHolderNew(setup,from,d0){
  // Nouveau porte-outil (copie de `from`, sinon un porte-pince type au Ø de nez d0).
  const hs=setup.holders||(setup.holders=[]);
  let n=hs.length+1;
  while(hs.some(function(h){return h.id==='PO'+n;}))n++;
  const D=Math.max(6,Math.round(+d0||28));
  const h=from?JSON.parse(JSON.stringify(from)):
    {name:'Porte-outil '+n,segs:[{t:'chf',c:1,a:45},{t:'cyl',d:D,h:25},{t:'cone',d1:D,d2:D+16,h:12},{t:'cyl',d:D+16,h:20}]};
  if(from)h.name=((from.name||'Porte-outil')+' (copie)').slice(0,32);
  h.id='PO'+n;
  hs.push(h);
  return h;
}
function faoHolderUsers(setup,id){
  return ((setup&&setup.tools)||[]).filter(function(t){return t&&t.holderId===id;});
}
function faoHolderLabel(h){
  const p=faoHolderProfile(h);
  return (h.name||'Porte-outil')+(p?(' — nez Ø'+faoR1(p.dNose)+', haut. '+faoR1(p.h)):'');
}
/* ----- catalogue de porte-outils standard (V0.91.0) -----
   Demande : « trouver des porte-outils du marché européen pour les intégrer avec le choix de
   l'outil ». Trois familles courantes, pour trois cônes de broche. COTES INDICATIVES : nez et
   longueurs des séries courantes des catalogues (porte-pinces ER : Ø de l'écrou DIN 6499 ;
   frettage : nez/corps à 4,5° façon DIN 69882-8 ; Weldon : DIN 6359). Chaque fabricant a ses
   variantes : le porte-outil inséré est un porte-outil ordinaire, à corriger d'après son catalogue.
   Le porte-outil va du nez jusqu'à la collerette comprise ; au-dessus, c'est la broche. */
const FAO_SPINDLES={ // collerette : Ø et épaisseur comptée depuis le plan de jauge / la face d'appui
  SK40:{n:'SK40',d:63.55,h:19.1},BT40:{n:'BT40',d:63,h:27},HSKA63:{n:'HSK-A63',d:63,h:26}};
const FAO_HOLDER_STD={
  er:{n:'Porte-pince ER',L:[70,100,160], // [taille, Ø écrou, Ø de queue maxi]
    T:[['ER16',28,10],['ER20',34,13],['ER25',42,16],['ER32',50,20],['ER40',63,26]]},
  fr:{n:'Frettage', // [Ø de queue, Ø nez, Ø corps, longueur A]
    T:[[6,21,27,80],[8,21,27,80],[10,24,32,85],[12,24,32,90],[16,27,34,95],[20,33,42,100],[25,44,53,115]]},
  we:{n:'Weldon', // [Ø de queue, Ø extérieur, longueur A]
    T:[[6,25,50],[8,28,50],[10,35,50],[12,42,50],[16,48,63],[20,52,63],[25,65,100]]}};
function faoSpindleCur(){
  let k='SK40';try{ k=localStorage.getItem('minifusion_faoCone')||k; }catch(e){}
  return FAO_SPINDLES[k]?k:'SK40';
}
function faoHolderStdList(cone){
  // Toutes les références du catalogue pour ce cône : [{key,label,fam,dq0,dq1}] (dq0..dq1 = queues acceptées)
  const C=FAO_SPINDLES[cone]||FAO_SPINDLES.SK40,out=[];
  FAO_HOLDER_STD.er.T.forEach(function(t){ FAO_HOLDER_STD.er.L.forEach(function(L){
    out.push({key:'er|'+t[0]+'|'+L,fam:'er',dq0:1,dq1:t[2],label:t[0]+' × '+L+' '+C.n+' (écrou Ø'+t[1]+')'}); }); });
  FAO_HOLDER_STD.fr.T.forEach(function(t){
    out.push({key:'fr|'+t[0],fam:'fr',dq0:t[0],dq1:t[0],label:'Frettage Ø'+t[0]+' × '+t[3]+' '+C.n+' (nez Ø'+t[1]+')'}); });
  FAO_HOLDER_STD.we.T.forEach(function(t){
    out.push({key:'we|'+t[0],fam:'we',dq0:t[0],dq1:t[0],label:'Weldon Ø'+t[0]+' × '+t[2]+' '+C.n+' (Ø'+t[1]+')'}); });
  return out;
}
function faoHolderStdMake(key,cone){
  // Porte-outil {name,segs} d'une référence du catalogue, ou null.
  const C=FAO_SPINDLES[cone]||FAO_SPINDLES.SK40,q=String(key||'').split('|');
  const body=function(L){ return Math.max(0,Math.round((L-C.h)*100)/100); };
  const fl={t:'cyl',d:C.d,h:C.h};
  if(q[0]==='er'){
    const t=FAO_HOLDER_STD.er.T.filter(function(x){return x[0]===q[1];})[0],L=+q[2];
    if(!t||!(L>C.h))return null;
    return {name:(t[0]+' × '+L+' '+C.n).slice(0,32),segs:[{t:'chf',c:1,a:45},{t:'cyl',d:t[1],h:body(L-1)},fl]};
  }
  if(q[0]==='fr'){
    const t=FAO_HOLDER_STD.fr.T.filter(function(x){return x[0]===+q[1];})[0];
    if(!t)return null;
    const hc=Math.min(body(t[3]),Math.round((t[2]-t[1])/2/Math.tan(4.5*Math.PI/180)*100)/100);
    const segs=[{t:'cone',d1:t[1],d2:t[2],h:hc}];
    if(body(t[3])-hc>0.01)segs.push({t:'cyl',d:t[2],h:Math.round((body(t[3])-hc)*100)/100});
    segs.push(fl);
    return {name:('Frettage Ø'+t[0]+' × '+t[3]+' '+C.n).slice(0,32),segs:segs};
  }
  if(q[0]==='we'){
    const t=FAO_HOLDER_STD.we.T.filter(function(x){return x[0]===+q[1];})[0];
    if(!t)return null;
    return {name:('Weldon Ø'+t[0]+' × '+t[2]+' '+C.n).slice(0,32),segs:[{t:'chf',c:1,a:45},{t:'cyl',d:t[1],h:body(t[2]-1)},fl]};
  }
  return null;
}
function faoHolderStdMount(setup,t,key,cone){
  // Monte la référence sur l'outil : porte-outil identique du posage réutilisé, sinon ajouté.
  const m=faoHolderStdMake(key,cone); if(!m)return null;
  let h=faoHolders(setup).filter(function(x){return faoHolderSame(x,m);})[0];
  if(!h){ h=faoHolderNew(setup,m); h.name=m.name; }
  t.holderId=h.id;
  return h;
}
/* ----- fiche outil : rubrique « Porte-outil » ----- */
function faoHolderSection(R,setup,t,rerender){
  const mk=function(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
  const done=function(){ faoChanged(); rerender(); };
  R.appendChild(mk('div','fao-tl-h','Porte-outil — du nez vers la broche'));
  const top=mk('div','fao-tl-btns');R.appendChild(top);
  const hs=faoHolders(setup);
  const cur=faoHolderById(setup,t.holderId);
  const sel=mk('select','fao-sel');
  sel.title='Porte-outil monté sur cet outil. « Générique » = simple cylindre au Ø mandrin de la fiche.';
  [['','Générique (Ø mandrin)']].concat(hs.map(function(h){return [h.id,faoHolderLabel(h)];})).forEach(function(o){
    const e=mk('option','',o[1]);e.value=o[0];sel.appendChild(e);});
  sel.value=cur?cur.id:'';
  sel.onchange=function(){ faoSnapshot('porte-outil de l’outil'); if(sel.value)t.holderId=sel.value; else delete t.holderId; done(); };
  top.appendChild(sel);
  const btn=function(parent,txt,title,fn){const b=mk('button','fao-mini',txt);b.title=title;b.onclick=fn;parent.appendChild(b);return b;};
  btn(top,'+ Nouveau','Créer un porte-outil et le monter sur cet outil',function(){
    faoSnapshot('nouveau porte-outil');const h=faoHolderNew(setup,null,faoToolDims(t).dPo.v);t.holderId=h.id;done();});
  if(cur){
    btn(top,'⧉ Dupliquer','Copier ce porte-outil pour en faire une variante',function(){
      faoSnapshot('dupliquer le porte-outil');const h=faoHolderNew(setup,cur);t.holderId=h.id;done();});
    btn(top,'✕ Supprimer','Supprimer ce porte-outil : les outils qui le portent reviennent au porte-outil générique',function(){
      faoSnapshot('supprimer le porte-outil');
      faoHolderUsers(setup,cur.id).forEach(function(x){delete x.holderId;});
      setup.holders=hs.filter(function(h){return h!==cur;});done();});
  }
  // V0.91.0 : catalogue standard — d'abord les références qui acceptent la queue de CET outil
  const cat=mk('div','fao-tl-btns');R.appendChild(cat);
  const sC=mk('select','fao-sel');sC.title='Cône de broche de la machine : donne la collerette des porte-outils du catalogue';
  Object.keys(FAO_SPINDLES).forEach(function(k){const e=mk('option','',FAO_SPINDLES[k].n);e.value=k;sC.appendChild(e);});
  sC.value=faoSpindleCur();
  sC.onchange=function(){ try{localStorage.setItem('minifusion_faoCone',sC.value);}catch(e){} rerender(); };
  cat.appendChild(sC);
  const sK=mk('select','fao-sel');
  sK.title='Catalogue de porte-outils standard (porte-pinces ER, frettage, Weldon). Cotes indicatives des séries courantes : une fois inséré, le porte-outil se corrige comme les autres d’après le catalogue de votre fabricant.';
  const dq=faoToolDims(t).dq.v;
  const o0=mk('option','','+ Du catalogue standard…');o0.value='';sK.appendChild(o0);
  const L=faoHolderStdList(sC.value);
  const grp=function(lab,list){ if(!list.length)return; const g=mk('optgroup');g.label=lab;
    list.forEach(function(x){const e=mk('option','',x.label);e.value=x.key;g.appendChild(e);});sK.appendChild(g); };
  const fits=function(x){ return dq>=x.dq0-1e-6&&dq<=x.dq1+1e-6; };
  grp('Pour une queue Ø'+faoR1(dq),L.filter(fits));
  grp('Autres références',L.filter(function(x){return !fits(x);}));
  sK.value='';
  sK.onchange=function(){ if(!sK.value)return; faoSnapshot('porte-outil du catalogue'); faoHolderStdMount(setup,t,sK.value,sC.value); done(); };
  cat.appendChild(sK);
  if(!cur)return;
  const nU=faoHolderUsers(setup,cur.id).length;
  const rn=mk('div','fao-tl-grid');R.appendChild(rn);
  const pN=mk('label','fao-tl-f wide');pN.appendChild(mk('span','','Nom'));
  const iN=mk('input','fao-in');iN.type='text';iN.value=cur.name||'';
  iN.onchange=function(){faoSnapshot('nom du porte-outil');cur.name=String(iN.value||cur.name||'Porte-outil').slice(0,32);done();};
  pN.appendChild(iN);rn.appendChild(pN);
  if(nU>1)R.appendChild(mk('div','fao-meta','Monté sur '+nU+' outils : le modifier les change tous (« Dupliquer » pour une variante).'));
  const segs=cur.segs||(cur.segs=[]);
  const num=function(parent,lab,val,title,unit,fn,h){
    const p=mk('label','fao-tl-f');p.title=title;p.appendChild(mk('span','',lab));
    const i=mk('input','fao-in fao-num');i.type='text';i.inputMode='decimal';i.value=String(+(+val).toFixed(3));
    // V0.95.0 : tronçon h, clé lue dans fn (« s.d=v ») → formule gardée (ƒx)
    try{const m=/\{\s*\w+\.(\w+)\s*=/.exec(String(fn));if(h&&m&&typeof parFx==='function')parFx(i,h,m[1],{keep:1});}catch(e){}
    i.onchange=function(){const v=parseFloat(String(i.value).replace(',','.'));if(isFinite(v)&&v>0){faoSnapshot(title);fn(v);done();}};
    try{ if(typeof parNumKeys==='function')parNumKeys(i); }catch(e){}
    p.appendChild(i);if(unit)p.appendChild(mk('em','',unit));parent.appendChild(p);return i;
  };
  const list=mk('div','fao-ho-list');R.appendChild(list);
  segs.forEach(function(s,k){
    const row=mk('div','fao-ho-row');list.appendChild(row);
    row.appendChild(mk('b','',String(k+1)));
    const sT=mk('select','fao-sel');sT.title='Forme de ce tronçon';
    FAO_HOLDER_TYPES.forEach(function(o){const e=mk('option','',o[1]);e.value=o[0];sT.appendChild(e);});
    sT.value=s.t;
    sT.onchange=function(){
      faoSnapshot('forme du tronçon');
      const d=+(s.d||s.d1)||28,h=+s.h||10;
      segs[k]=sT.value==='chf'?{t:'chf',c:1,a:45}:(sT.value==='cone'?{t:'cone',d1:d,d2:+s.d2||d+10,h:h}:{t:'cyl',d:d,h:h});
      done();};
    row.appendChild(sT);
    const f=mk('div','fao-ho-f');row.appendChild(f);
    if(s.t==='cyl'){
      num(f,'Ø',s.d,'Diamètre du cylindre','mm',function(v){s.d=v;},s);
      num(f,'Hauteur',s.h,'Hauteur du cylindre','mm',function(v){s.h=v;},s);
    }else if(s.t==='cone'){
      num(f,'Ø nez',s.d1,'Diamètre du cône côté outil','mm',function(v){s.d1=v;},s);
      num(f,'Ø broche',s.d2,'Diamètre du cône côté broche','mm',function(v){s.d2=v;},s);
      num(f,'Hauteur',s.h,'Hauteur du cône','mm',function(v){s.h=v;},s);
    }else{
      num(f,'Longueur',s.c,'Longueur du chanfreiné le long de l’axe — il entame le tronçon suivant','mm',function(v){s.c=v;},s);
      num(f,'Angle',s.a||45,'Angle du chanfrein par rapport à l’axe (45° par défaut)','°',function(v){s.a=Math.min(85,Math.max(5,v));},s);
    }
    const mv=function(d){ return function(){ const j=k+d; if(j<0||j>=segs.length)return;
      faoSnapshot('ordre des tronçons');const x=segs[k];segs[k]=segs[j];segs[j]=x;done(); }; };
    btn(row,'↑','Rapprocher ce tronçon du nez',mv(-1));
    btn(row,'↓','Rapprocher ce tronçon de la broche',mv(1));
    btn(row,'✕','Retirer ce tronçon',function(){ faoSnapshot('retirer le tronçon');segs.splice(k,1);done(); });
  });
  const add=mk('div','fao-tl-btns');R.appendChild(add);
  const last=function(){ for(let i=segs.length-1;i>=0;i--){ const s=segs[i]; if(s.t==='cyl')return s.d; if(s.t==='cone')return s.d2; } return faoToolDims(t).dPo.v; };
  btn(add,'+ Chanfrein d’entrée','Ajouter un chanfrein au nez (il entame le tronçon qui le suit)',function(){
    faoSnapshot('ajouter un chanfrein d’entrée');segs.unshift({t:'chf',c:1,a:45});done();});
  btn(add,'+ Cône','Ajouter un cône côté broche',function(){
    faoSnapshot('ajouter un cône');const d=last();segs.push({t:'cone',d1:d,d2:d+10,h:10});done();});
  btn(add,'+ Cylindre','Ajouter un cylindre côté broche',function(){
    faoSnapshot('ajouter un cylindre');segs.push({t:'cyl',d:last(),h:20});done();});
  if(!faoHolderProfile(cur))R.appendChild(mk('div','fao-note','Ce porte-outil n’a encore ni cône ni cylindre : ajoutez-en un pour le voir sur le schéma.'));
}
