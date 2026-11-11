/* ============ FAO : catalogues d'outils des fabricants (V0.92.0) ============
   Demande : « une page spéciale avec les fraises, forets et tarauds des catalogues
   (Vargus, Jongen, Dixi…) et leurs caractéristiques de coupe en fonction des matériaux,
   en vue d'insérer un nouvel outil de catalogue ».

   DONNÉES — elles ne sont PAS dans l'application (ConceptCAD est publié : les tableaux des
   fabricants restent chez l'utilisateur). Un catalogue est un fichier « .cccatalogue » :
     {format:'conceptcad-catalogue', v:1, fabricant, source,
      series:[{ref, nom, kind, flutes, mat, cornerR, ang,
        outils:[{ref, d, lc, lDeg, dq, lt, lCq, cornerR, flutes, size, p}],
        coupe:[{matiere, vc, fz, fr}]}]}
   vc (m/min), fz (mm/dent) et fr (mm/tour, forets) valent :
     · un NOMBRE, ou une fourchette {min, max} ;
     · un tableau [[Ø, valeur], …] interpolé au Ø de l'outil (borné aux extrémités) ;
     · des plages de diamètres {plages:[[Ømin, Ømax, bas, haut], …]}, comme dans les catalogues
       (« Ø6 à 10 : 0,05 à 0,10 ») : hors de toute plage, PAS de valeur (rien n'est inventé).
   Une fourchette se lit en bas, au milieu ou en haut (choix de la page, milieu par défaut).
   Les catalogues chargés sont gardés dans ce navigateur (localStorage), pas dans la pièce.
   INSERTION — la fiche créée prend la géométrie de la référence et les conditions de coupe
   de la matière choisie ; c'est ensuite un outil ordinaire de la bibliothèque. */
const FAO_CAT_FMT='conceptcad-catalogue';
const FAO_CAT_KEY='minifusion_faoCatalogues';
let faoCatSel={c:0,s:0,m:0,p:0.5};
let faoCatMem=null; // liste de la séance (lue une fois dans localStorage, réécrite à chaque changement)
function faoCatNum(v){ v=+v; return (isFinite(v)&&v>0)?v:0; }
function faoCatTable(v){
  // nombre > 0, fourchette {min,max}, plages {plages:[[Ø0,Ø1,bas,haut]]}, ou tableau [[Ø, valeur], …] trié ; sinon null
  if(v&&typeof v==='object'&&!Array.isArray(v)){
    if(Array.isArray(v.plages)){
      const p=v.plages.filter(function(q){return Array.isArray(q)&&faoCatNum(q[0])&&faoCatNum(q[1])>=faoCatNum(q[0])&&faoCatNum(q[2]);})
        .map(function(q){return [+q[0],+q[1],+q[2],Math.max(+q[2],faoCatNum(q[3])||+q[2])];}).sort(function(a,b){return a[0]-b[0];});
      return p.length?{plages:p}:null;
    }
    if(faoCatNum(v.min))return {min:+v.min,max:Math.max(+v.min,faoCatNum(v.max)||+v.min)};
    return null;
  }
  if(Array.isArray(v)){
    const t=v.filter(function(p){return Array.isArray(p)&&faoCatNum(p[0])&&faoCatNum(p[1]);})
      .map(function(p){return [+p[0],+p[1]];}).sort(function(a,b){return a[0]-b[0];});
    return t.length?t:null;
  }
  return faoCatNum(v)||null;
}
function faoCatRange(v,d){
  // [bas, haut] au Ø d, ou null (pas de valeur dans le catalogue pour ce Ø)
  if(v&&typeof v==='object'&&!Array.isArray(v)){
    if(v.plages){
      const P=v.plages;
      for(let i=0;i<P.length;i++)if(d>=P[i][0]-1e-9&&d<=P[i][1]+1e-9)return [P[i][2],P[i][3]];
      // entre deux plages (le catalogue saute de « 6-10 » à « 12-20 ») : la plage la plus proche
      for(let i=0;i+1<P.length;i++)if(d>P[i][1]&&d<P[i+1][0]){ const q=(d-P[i][1]<=P[i+1][0]-d)?P[i]:P[i+1]; return [q[2],q[3]]; }
      return null;
    }
    return faoCatNum(v.min)?[v.min,v.max]:null;
  }
  const x=faoCatAt(v,d);
  return x?[x,x]:null;
}
function faoCatAt(v,d,pos){
  // valeur au Ø d : nombre tel quel, tableau interpolé (borné aux extrémités), fourchette ou plage
  // lue à la position pos (0 = bas, 0,5 = milieu par défaut, 1 = haut) ; 0 si absent
  if(v&&typeof v==='object'&&!Array.isArray(v)){
    const r=faoCatRange(v,d); if(!r)return 0;
    const k=(isFinite(+pos)&&pos!==null&&pos!==undefined)?Math.min(1,Math.max(0,+pos)):0.5;
    return r[0]+(r[1]-r[0])*k;
  }
  if(!Array.isArray(v))return faoCatNum(v);
  if(!v.length)return 0;
  if(d<=v[0][0])return v[0][1];
  for(let i=1;i<v.length;i++)if(d<=v[i][0]){ const a=v[i-1],b=v[i]; return a[1]+(d-a[0])/(b[0]-a[0])*(b[1]-a[1]); }
  return v[v.length-1][1];
}
function faoCatClean(o){
  // Catalogue assaini, ou {err}.
  if(!o||typeof o!=='object'||o.format!==FAO_CAT_FMT||!Array.isArray(o.series))return {err:'ce fichier n’est pas un catalogue d’outils ConceptCAD.'};
  const str=function(v,n){ return String(v==null?'':v).slice(0,n||64); };
  const series=[];
  o.series.forEach(function(s){
    if(!s||typeof s!=='object'||!Array.isArray(s.outils))return;
    const kind=FAO_TOOL_KINDS.indexOf(s.kind)>=0?s.kind:'flat';
    const outils=s.outils.map(function(t){
      if(!t||!faoCatNum(t.d))return null;
      const r={ref:str(t.ref,32),d:+t.d};
      ['lc','lDeg','dq','lt','lCq','cornerR','flutes','p','ang'].forEach(function(k){ if(faoCatNum(t[k]))r[k]=+t[k]; });
      if(t.size)r.size=str(t.size,16);
      return r;
    }).filter(function(t){return !!t;});
    if(!outils.length)return;
    const coupe=(Array.isArray(s.coupe)?s.coupe:[]).map(function(c){
      if(!c||!c.matiere)return null;
      const r={matiere:str(c.matiere,96)};
      ['vc','fz','fr'].forEach(function(k){ const v=faoCatTable(c[k]); if(v)r[k]=v; });
      return r.vc?r:null;
    }).filter(function(c){return !!c;});
    const S={ref:str(s.ref,32),nom:str(s.nom,64),kind:kind,outils:outils,coupe:coupe};
    ['flutes','cornerR','ang'].forEach(function(k){ if(faoCatNum(s[k]))S[k]=+s[k]; });
    if(s.mat)S.mat=str(s.mat,32);
    series.push(S);
  });
  if(!series.length)return {err:'aucune série d’outils utilisable dans ce catalogue.'};
  return {format:FAO_CAT_FMT,v:1,fabricant:str(o.fabricant||'Fabricant',40),source:str(o.source,120),series:series};
}
function faoCatParse(text){
  let o=null;
  try{ o=JSON.parse(String(text||'')); }catch(e){ return {err:'fichier illisible.'}; }
  return faoCatClean(o);
}
function faoCatList(){
  if(faoCatMem)return faoCatMem;
  let L=[];
  try{ const a=JSON.parse(localStorage.getItem(FAO_CAT_KEY)||'[]'); if(Array.isArray(a))L=a.map(faoCatClean).filter(function(c){return !c.err;}); }catch(e){}
  faoCatMem=L;
  return L;
}
function faoCatSave(list){
  // true = gardé dans le navigateur ; false = seulement pour cette séance (stockage plein)
  faoCatMem=list;
  try{ localStorage.setItem(FAO_CAT_KEY,JSON.stringify(list)); return true; }catch(e){ return false; }
}
function faoCatAdd(cat){
  // Ajoute (ou remplace, même fabricant) un catalogue ; renvoie son rang.
  const L=faoCatList();
  const i=L.findIndex(function(c){return c.fabricant===cat.fabricant;});
  if(i>=0)L[i]=cat; else L.push(cat);
  faoCatSave(L);
  return i>=0?i:L.length-1;
}
function faoCatName(fab,ref){
  // « Fabricant référence » en 32 caractères : la référence est gardée entière ; le fabricant
  // seulement s'il tient en entier (ou abrégé à 4 lettres au moins), jamais réduit à « Va » ou « V »
  ref=String(ref||'').slice(0,32); fab=String(fab||'').trim();
  const room=31-ref.length;
  fab=(fab.length<=room)?fab:(room>=4?fab.slice(0,room).trim():'');
  return ((fab?fab+' ':'')+ref).trim()||'Outil';
}
function faoCatTool(cat,serie,outil,coupe,pos){
  // Fiche outil ConceptCAD d'une référence de catalogue, pour une matière (coupe peut être absent).
  const kind=serie.kind||'flat';
  const t={kind:kind,d:+outil.d,name:faoCatName(cat.fabricant,outil.ref||serie.ref),
    flutes:Math.round(outil.flutes||serie.flutes||2),cornerR:0,cat:((cat.fabricant||'')+' '+(serie.ref||'')+' '+(outil.ref||'')).trim().slice(0,64)};
  if(kind==='ball')t.cornerR=t.d/2;
  else if(kind==='bull')t.cornerR=Math.min(outil.cornerR||serie.cornerR||0,t.d/2);
  ['lc','lDeg','dq','lt','lCq','p'].forEach(function(k){ if(outil[k])t[k]=outil[k]; });
  if(outil.size)t.size=outil.size;
  const ang=outil.ang||serie.ang; if(ang)t.ang=ang;
  if(serie.mat)t.mat=serie.mat;
  t.vc=250; t.fz=0.05;
  if(coupe){
    const vc=faoCatAt(coupe.vc,t.d,pos),fz=faoCatAt(coupe.fz,t.d,pos),fr=faoCatAt(coupe.fr,t.d,pos);
    if(vc)t.vc=Math.round(vc*10)/10;
    if(fz)t.fz=Math.round(fz*10000)/10000;
    if(fr)t.fr=Math.round(fr*10000)/10000;
    // Ø hors du tableau du fabricant : aucune valeur n'est inventée — avance volontairement
    // minuscule (1 ‰ du Ø) et fiche marquée, à corriger d'après le catalogue
    const need=(kind==='tap')?null:(faoToolIsDrill(t)?'fr':'fz');
    if(!vc||(need&&coupe[need]&&!(need==='fz'?fz:fr))){ t.horsTableau=true; if(need)t[need]=Math.round(t.d)/1000||0.001; }
    t.matiere=coupe.matiere; // matière pour laquelle ces conditions ont été prises (mémoire)
  }
  return t;
}
function faoCatInsert(setup,cat,serie,outils,coupe,pos){
  // Ajoute les références choisies à la bibliothèque du posage ; renvoie les fiches créées.
  const fiches=outils.map(function(o,k){ const t=faoCatTool(cat,serie,o,coupe,pos); t.id='C'+k; t.num=0; return t; });
  const nums=(setup.tools||[]).map(function(a){return +a.num||0;});
  let n=Math.max.apply(null,[0].concat(nums));
  fiches.forEach(function(t){ t.num=++n; });
  return faoToolsImport(setup,{tools:fiches,holders:[]},fiches);
}
function faoCatLoadFile(done){
  try{
    const inp=document.createElement('input');inp.type='file';inp.accept='.cccatalogue,.json,application/json';
    inp.onchange=function(){
      const f=inp.files&&inp.files[0];if(!f)return;
      const rd=new FileReader();
      rd.onload=function(){
        const c=faoCatParse(rd.result);
        if(c.err){ faoClipMsg('catalogue — '+c.err); return; }
        faoCatSel={c:faoCatAdd(c),s:0,m:0};
        faoClipMsg('catalogue « '+c.fabricant+' » chargé : '+c.series.length+' série(s), '+c.series.reduce(function(n,s){return n+s.outils.length;},0)+' outil(s).');
        if(done)done();
      };
      rd.readAsText(f);
    };
    inp.click();
  }catch(e){ faoClipMsg('catalogue : chargement impossible ('+((e&&e.message)||e)+')'); }
}
/* ----- la page : fabricant → série → matière → références, puis « Insérer » ----- */
function faoCatOpen(setup){
  const mk=function(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
  const bg=mk('div','mffDlgBg'),d=mk('div','mffDlg fao-cat');
  bg.appendChild(d);
  const close=function(){ try{document.removeEventListener('keydown',key,true);}catch(e){} try{bg.remove();}catch(e){} };
  const key=function(e){ if(e.key==='Escape'){ e.preventDefault();e.stopPropagation();close(); } };
  const fr=function(v,n){ return String(+(+v).toFixed(n==null?2:n)).replace('.',','); };
  const sel=function(parent,lab,opts,val,fn){
    const p=mk('label','fao-cat-f');p.appendChild(mk('span','',lab));
    const s=mk('select','fao-sel');
    opts.forEach(function(o,i){const e=mk('option','',o);e.value=String(i);s.appendChild(e);});
    s.value=String(val);s.onchange=function(){fn(+s.value);};
    p.appendChild(s);parent.appendChild(p);return s;
  };
  const render=function(){
    try{ d.innerHTML=''; }catch(e){}
    if(Array.isArray(d.children))d.children.length=0; // DOM bouchonné des tests
    const L=faoCatList();
    d.appendChild(mk('div','fao-imp-t','Catalogue d’outils'));
    const top=mk('div','fao-cat-top');d.appendChild(top);
    const bL=mk('button','','Charger un catalogue…');bL.title='Ajouter le fichier .cccatalogue d’un fabricant (gardé dans ce navigateur, pas dans la pièce)';
    bL.onclick=function(){ faoCatLoadFile(render); };
    if(!L.length){
      d.appendChild(mk('div','fao-imp-s','Aucun catalogue chargé. Un catalogue est un fichier « .cccatalogue » par fabricant : ses séries de fraises, forets et tarauds, avec les conditions de coupe par matière. Chargez-en un pour choisir un outil et l’insérer dans la bibliothèque.'));
      const row0=mk('div','mffBtns');const b0=mk('button','','Fermer');b0.onclick=close;bL.className='primary';
      row0.appendChild(b0);row0.appendChild(bL);d.appendChild(row0);
      return;
    }
    const S=faoCatSel;
    S.c=Math.min(Math.max(0,S.c|0),L.length-1);
    const cat=L[S.c];
    S.s=Math.min(Math.max(0,S.s|0),cat.series.length-1);
    const serie=cat.series[S.s];
    S.m=Math.min(Math.max(0,S.m|0),Math.max(0,serie.coupe.length-1));
    const coupe=serie.coupe[S.m]||null;
    sel(top,'Fabricant',L.map(function(c){return c.fabricant;}),S.c,function(v){ faoCatSel={c:v,s:0,m:0,p:S.p}; render(); });
    sel(top,'Série',cat.series.map(function(s){return (s.ref+' — '+s.nom).replace(/^ — | — $/g,'');}),S.s,function(v){ S.s=v; S.m=0; render(); });
    if(serie.coupe.length)sel(top,'Matière usinée',serie.coupe.map(function(c){return c.matiere;}),S.m,function(v){ S.m=v; render(); });
    const obj=function(v){ return !!v&&typeof v==='object'&&!Array.isArray(v); };
    const aPlage=!!coupe&&(obj(coupe.vc)||obj(coupe.fz)||obj(coupe.fr));
    const POS=[0,0.5,1];
    if(aPlage)sel(top,'Dans la fourchette du fabricant',['Bas (prudent)','Milieu','Haut'],Math.max(0,POS.indexOf(S.p===undefined?0.5:S.p)),function(v){ S.p=POS[v]; render(); });
    const pos=aPlage?(S.p===undefined?0.5:S.p):0.5;
    d.appendChild(mk('div','fao-imp-s',faoKindLabel(serie.kind)+(serie.mat?(' · '+serie.mat):'')+' · '+serie.outils.length+' référence(s)'
      +(coupe?'':' · aucune condition de coupe dans le catalogue : valeurs par défaut à corriger')+(cat.source?(' · source : '+cat.source):'')));
    const list=mk('div','fao-imp-list');d.appendChild(list);
    const boxes=[];
    const bOk=mk('button','primary');
    const count=function(){ const n=boxes.filter(function(b){return b.checked;}).length; bOk.textContent='Insérer ('+n+')'; bOk.disabled=!n; };
    serie.outils.forEach(function(o){
      const t=faoCatTool(cat,serie,o,coupe,pos),sf=faoToolSF(t,setup),g=faoToolDims(t);
      const it=mk('label','fao-imp-it');
      const cb=mk('input');cb.type='checkbox';cb.checked=false;cb.onchange=count;it.appendChild(cb);
      const tx=mk('div','fao-imp-x');
      tx.appendChild(mk('div','fao-imp-n',(o.ref||serie.ref)+'  ·  Ø'+fr(o.d)+(t.kind==='bull'?(' R'+fr(t.cornerR)):'')+(t.size?('  '+t.size):'')));
      tx.appendChild(mk('div','fao-imp-d','Coupe '+fr(g.lc.v,1)+' · queue Ø'+fr(g.dq.v,1)+' · longueur '+fr(g.lt.v,1)+(t.kind==='tap'?'':(' · '+t.flutes+' dents'))));
      it.appendChild(tx);
      if(t.horsTableau)it.appendChild(mk('span','fao-imp-has','Ø hors tableau : avance à saisir'));
      it.appendChild(mk('span','fao-cat-c',coupe?('Vc '+fr(t.vc,0)+' · '+(faoToolIsDrill(t)?('f '+fr(faoToolFr(t),3)+' mm/tr'):(t.kind==='tap'?('pas '+fr(t.p||0)):('fz '+fr(t.fz,3))))+' · S'+sf.s+' F'+sf.f):'—'));
      list.appendChild(it);boxes.push(cb);
    });
    const row=mk('div','mffBtns');
    const all=function(v){ return function(){ boxes.forEach(function(b){b.checked=v;}); count(); }; };
    const bA=mk('button','','Tout cocher');bA.onclick=all(true);
    const bN=mk('button','','Tout décocher');bN.onclick=all(false);
    const bR=mk('button','','Retirer ce catalogue');bR.title='Oublier le catalogue de ce fabricant dans ce navigateur (les outils déjà insérés restent)';
    bR.onclick=function(){ const K=faoCatList();K.splice(S.c,1);faoCatSave(K);faoCatSel={c:0,s:0,m:0};render(); };
    const bC=mk('button','','Fermer');bC.onclick=close;
    bOk.onclick=function(){
      const picked=serie.outils.filter(function(o,i){return boxes[i].checked;});
      if(!picked.length)return;
      faoSnapshot('insérer '+picked.length+' outil(s) du catalogue');
      const added=faoCatInsert(setup,cat,serie,picked,coupe,pos);
      if(added.length)faoToolSelId=added[0].id;
      faoChanged();
      try{ faoToolsWindowRefresh(); }catch(e){}
      faoClipMsg(added.length+' outil(s) du catalogue '+cat.fabricant+' inséré(s)'+(coupe?(' — conditions pour « '+coupe.matiere+' »'):'')+' : '+added.map(function(t){return 'T'+t.num+' '+t.name;}).join(', ').slice(0,140));
      close();
    };
    [bA,bN,bL,bR,mk('span','fao-imp-sp'),bC,bOk].forEach(function(b){row.appendChild(b);});
    d.appendChild(row);
    count();
  };
  render();
  document.body.appendChild(bg);
  try{document.addEventListener('keydown',key,true);}catch(e){}
  return bg;
}
