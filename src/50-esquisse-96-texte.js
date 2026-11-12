/* ---------- Esquisse : TEXTE (V0.96.0) ----------
   Outil « Texte » : un clic pose le texte, le bandeau règle texte, police (toutes celles de
   l'ordinateur, ou un fichier .ttf / .otf / .ttc choisi), style, hauteur des majuscules, angle,
   espacement, interligne, alignement et miroir. Le texte reste modifiable : double-clic dessus.
   Modèle : une fiche cachée {id, t:'text', pa, ref, rx, ry, str, font:{ps,family,style}, h, ang, sp, lh,
   al, mir} rangée parmi les entités (annulation, fichier, copie d'esquisse sans rien de plus) ; les
   contours des lettres sont de VRAIES entités d'esquisse marquées txt:<id> : lignes et splines par
   points de contrôle EXACTES (courbes du 2ᵉ degré TrueType, du 3ᵉ degré OpenType), donc profils,
   zones, extrusion, enlèvement de matière, FAO sans rien d'autre. Le fichier garde les contours :
   il se rouvre partout, même sans la police (seule la modification du texte la demande).
   Points des lettres : marqués txt, FIXES pour le solveur (comme une projection), jamais dessinés ni
   accrochés. Seul le point d'ancrage pa (début de la ligne de base) est un point ordinaire : coté,
   contraint ou glissé, il entraîne le texte (skTxtFollow, en fin de solveSketch). ref / rx, ry : un
   point des lettres et sa place attendue par rapport à pa — un déplacement global des points
   (le texte et son ancre ensemble) ne le décale donc pas deux fois. */
const SK_TXT_EXT='.ttf,.otf,.ttc,.otc,font/ttf,font/otf,font/collection';
const skTxt={str:'Texte',ps:null,family:null,style:null,h:10,ang:0,sp:0,lh:1,al:'g',mir:false, // réglages gardés d'un texte au suivant
  cur:null,   // id de la fiche en cours de réglage (posée, ou rouverte au double-clic)
  pushed:false,
  last:null}; // dernière position de la souris (aperçu)
const SK_TXT_FONTS={list:[],byPs:new Map(),parsed:new Map(),localDone:false,localOk:false,idbDone:false,busy:null};
/* ----- polices disponibles ----- */
function skTxtAddFont(o){
  if(!o||!o.ps||SK_TXT_FONTS.byPs.has(o.ps))return;
  SK_TXT_FONTS.byPs.set(o.ps,o);SK_TXT_FONTS.list.push(o);
}
function skTxtFamilies(){
  const m=new Map();SK_TXT_FONTS.list.forEach(f=>{const k=f.family||f.full||f.ps;if(!m.has(k))m.set(k,[]);m.get(k).push(f);});
  const rank=s=>{s=(s||'').toLowerCase();return(/regular|normal|standard|roman|book/.test(s)?0:1)+(/bold|gras|black|heavy/.test(s)?2:0)+(/italic|oblique|italique/.test(s)?1:0);};
  m.forEach(v=>v.sort((a,b)=>rank(a.style)-rank(b.style)||String(a.style).localeCompare(String(b.style))));
  return [...m.keys()].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'})).map(k=>({family:k,faces:m.get(k)}));
}
async function skTxtLocalFonts(){
  // polices de l'ordinateur (Chrome, Edge, application Windows) — demande d'autorisation au 1er appel
  if(SK_TXT_FONTS.localDone)return SK_TXT_FONTS.localOk;
  SK_TXT_FONTS.localDone=true;
  if(typeof window==='undefined'||typeof window.queryLocalFonts!=='function')return false;
  try{
    const L=await window.queryLocalFonts();
    L.forEach(fd=>skTxtAddFont({family:fd.family,style:fd.style,ps:fd.postscriptName,full:fd.fullName,fd}));
    SK_TXT_FONTS.localOk=L.length>0;
  }catch(e){SK_TXT_FONTS.localOk=false;}
  return SK_TXT_FONTS.localOk;
}
// polices venues d'un fichier : gardées dans le navigateur (IndexedDB) d'une séance à l'autre
function skTxtIdb(){
  return new Promise((ok,ko)=>{
    try{const r=indexedDB.open('conceptcad-polices',1);
      r.onupgradeneeded=()=>{try{r.result.createObjectStore('f',{keyPath:'ps'});}catch(e){}};
      r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error);}catch(e){ko(e);}
  });
}
async function skTxtIdbLoad(){
  if(SK_TXT_FONTS.idbDone)return;SK_TXT_FONTS.idbDone=true;
  try{const db=await skTxtIdb();
    await new Promise(ok=>{const q=db.transaction('f').objectStore('f').getAll();q.onsuccess=()=>{(q.result||[]).forEach(o=>skTxtAddFont(Object.assign({},o,{file:true})));ok();};q.onerror=()=>ok();});
  }catch(e){}
}
async function skTxtIdbSave(recs){
  try{const db=await skTxtIdb();const tx=db.transaction('f','readwrite');recs.forEach(o=>tx.objectStore('f').put({ps:o.ps,family:o.family,style:o.style,full:o.full,buf:o.buf}));}catch(e){}
}
function skTxtAddFile(name,buf){
  // fichier de police (une collection en donne plusieurs) → [{ps…}] ajoutées ; erreur claire sinon
  let faces;try{faces=fontParseAll(buf);}catch(e){throw new Error(name+' : '+(e&&e.message||e));}
  const added=[];
  faces.forEach((F,i)=>{const ps=F.ps||(name.replace(/\.[^.]+$/,'')+(faces.length>1?'-'+i:''));
    const o={family:F.family||ps,style:F.style||'',ps,full:F.full||ps,buf,file:true};
    if(!SK_TXT_FONTS.byPs.has(ps)){skTxtAddFont(o);added.push(o);}
    SK_TXT_FONTS.parsed.set(ps,F);});
  return added;
}
function skTxtPickFiles(){
  const inp=document.createElement('input');inp.type='file';inp.accept=SK_TXT_EXT;inp.multiple=true;
  inp.onchange=async()=>{
    const files=[...(inp.files||[])];if(!files.length)return;
    const added=[],errs=[];
    for(const f of files){try{const buf=await f.arrayBuffer();added.push(...skTxtAddFile(f.name,buf));}catch(e){errs.push(e.message);}}
    if(added.length){skTxtIdbSave(added);const o=added[0];skTxt.ps=o.ps;skTxt.family=o.family;skTxt.style=o.style;}
    skTxtFillFonts();await skTxtRead(true);
    skStatus(errs.length?'Police refusée — '+errs.join(' · '):(added.length?'Police « '+added[0].family+' » ajoutée.':'Police déjà connue.'));
  };
  inp.click();
}
async function skTxtFont(ps){
  // police lue (contours) par son nom PostScript ; null si elle n'est pas sur cet ordinateur
  if(!ps)return null;
  if(SK_TXT_FONTS.parsed.has(ps))return SK_TXT_FONTS.parsed.get(ps);
  const o=SK_TXT_FONTS.byPs.get(ps);if(!o)return null;
  let buf=o.buf;
  if(!buf&&o.fd){const b=await o.fd.blob();buf=await b.arrayBuffer();}
  if(!buf)return null;
  const F=fontParse(buf,ps);SK_TXT_FONTS.parsed.set(ps,F);
  return F;
}
function skTxtDefaultFont(){
  const L=SK_TXT_FONTS.list;if(!L.length)return null;
  const pick=n=>L.find(f=>(f.ps||'').toLowerCase()===n);
  return pick('arialmt')||pick('arial')||pick('helvetica')||pick('dejavusans')||pick('liberationsans')||pick('segoeui')||L[0];
}
async function skTxtEnsureFonts(){
  if(SK_TXT_FONTS.busy)return SK_TXT_FONTS.busy;
  SK_TXT_FONTS.busy=(async()=>{await skTxtIdbLoad();await skTxtLocalFonts();
    if(!skTxt.ps||!SK_TXT_FONTS.byPs.has(skTxt.ps)){const d=skTxtDefaultFont();if(d){skTxt.ps=d.ps;skTxt.family=d.family;skTxt.style=d.style;}}
  })();
  try{await SK_TXT_FONTS.busy;}finally{SK_TXT_FONTS.busy=null;}
}
/* ----- mise en page : contours en mm, repère du texte (ancre = début de la 1re ligne de base) ----- */
function skTxtLayout(F,o){
  // o : {str,h,sp,lh,al,mir,ang} → {contours:[{s,seg}] en coordonnées de l'esquisse si o.x/o.y, missing, w}
  const k=(o.h>0?o.h:10)/(F.cap||F.upm*0.7);
  const lineH=(F.asc-F.desc+Math.max(F.gap,0))*k*(o.lh>0?o.lh:1); // interligne × hauteur de ligne de la police
  const lines=String(o.str==null?'':o.str).replace(/\r\n?/g,'\n').split('\n');
  let out=[];let missing=0,wMax=0;
  lines.forEach((ln,li)=>{
    const cps=Array.from(ln).map(ch=>ch.codePointAt(0));
    const glyphs=[];let x=0,prev=-1;
    cps.forEach(cp=>{
      if(cp===9){x+=F.adv(F.gid(32))*4*k;prev=-1;return;}
      const g=F.gid(cp);
      if(!g&&cp>32){missing++;prev=-1;return;}
      if(prev>=0)x+=F.kernPair(prev,g)*k;
      glyphs.push({g,x});x+=F.adv(g)*k+(o.sp||0);prev=g;
    });
    const w=Math.max(0,x-(glyphs.length?(o.sp||0):0));wMax=Math.max(wMax,w);
    const dx=o.al==='c'?-w/2:(o.al==='d'?-w:0),dy=-li*lineH;
    glyphs.forEach(G=>{
      F.glyph(G.g).contours.forEach(c=>{
        const T=p=>[(p[0]*k+G.x+dx),(p[1]*k+dy)];
        out.push({s:T(c.s),seg:c.seg.map(s=>s.k==='L'?{k:'L',p:T(s.p)}:(s.k==='Q'?{k:'Q',c:T(s.c),p:T(s.p),imp:s.imp}:{k:'C',c1:T(s.c1),c2:T(s.c2),p:T(s.p)}))});
      });
    });
  });
  out=skTxtUnion(out); // contours qui se croisent : réunis (polices variables)
  // miroir, rotation, ancre
  const a=(o.ang||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),mx=o.mir?-1:1,X=o.x||0,Y=o.y||0;
  const M=p=>{const u=p[0]*mx,v=p[1];return[X+u*ca-v*sa,Y+u*sa+v*ca];};
  out.forEach(c=>{c.s=M(c.s);c.seg.forEach(s=>{s.p=M(s.p);if(s.c)s.c=M(s.c);if(s.c1){s.c1=M(s.c1);s.c2=M(s.c2);}});}); // miroir : sens de parcours retourné, sans effet sur les zones
  return{contours:out,missing,w:wMax};
}
/* ----- contours qui se chevauchent : réunion exacte ----- */
/* Polices variables (Bahnschrift, Segoe UI Variable…) et écritures liées : une lettre peut être faite de
   contours qui se CROISENT, dessinés selon la règle « non nulle ». Le découpage du plan de l'esquisse
   (pair / impair, contours sans croisement) y perdrait des trous (« g », « Q » pleins) ou creuserait le
   chevauchement. On coupe donc les courbes à leurs croisements (de Casteljau : morceaux EXACTS), on ne
   garde que les morceaux qui séparent la matière du vide (enroulement nul d'un seul côté), et on les
   rechaîne. Sans aucun croisement, les contours repartent tels quels. */
function skTxtBz(g,cur){return g.k==='L'?[cur,g.p]:(g.k==='Q'?[cur,g.c,g.p]:[cur,g.c1,g.c2,g.p]);}
function skTxtBzAt(B,t){ // point et dérivée d'une courbe de Bézier (2 à 4 pôles)
  let P=B.map(q=>q.slice());const n=P.length-1;let D=null;
  for(let r=n;r>0;r--){if(r===1)D=[(P[1][0]-P[0][0])*n,(P[1][1]-P[0][1])*n];
    for(let i=0;i<r;i++)P[i]=[P[i][0]+(P[i+1][0]-P[i][0])*t,P[i][1]+(P[i+1][1]-P[i][1])*t];}
  return{p:P[0],d:D||[0,0]};
}
function skTxtBzSplit(B,t){ // [avant, après] en t, exacts
  const L=[],R=[];let P=B.map(q=>q.slice());
  while(P.length){L.push(P[0]);R.unshift(P[P.length-1]);const Q=[];for(let i=0;i+1<P.length;i++)Q.push([P[i][0]+(P[i+1][0]-P[i][0])*t,P[i][1]+(P[i+1][1]-P[i][1])*t]);P=Q;}
  return[L,R];
}
function skTxtUnion(contours){
  const S=[];// segments : {B, ci, si, poly:[[x,y,t]…], bb}
  contours.forEach((c,ci)=>{let cur=c.s;c.seg.forEach((g,si)=>{const B=skTxtBz(g,cur);cur=g.p;
    const n=B.length===2?1:(B.length===3?10:14),poly=[];for(let i=0;i<=n;i++){const t=i/n;poly.push([...skTxtBzAt(B,t).p,t]);}
    let x0=1e18,y0=1e18,x1=-1e18,y1=-1e18;B.forEach(q=>{x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);});
    S.push({B,g,ci,si,poly,bb:[x0,y0,x1,y1],cuts:[]});});});
  if(S.length<2)return contours;
  let span=1e-9;S.forEach(s=>{span=Math.max(span,s.bb[2]-s.bb[0],s.bb[3]-s.bb[1]);});
  const TE=1e-6;
  const cross=(a,b,c,d)=>{ // segments [a,b] et [c,d] : paramètres (u, v) d'un croisement propre
    const r0=b[0]-a[0],r1=b[1]-a[1],s0=d[0]-c[0],s1=d[1]-c[1],den=r0*s1-r1*s0;if(Math.abs(den)<1e-18)return null;
    const qx=c[0]-a[0],qy=c[1]-a[1],u=(qx*s1-qy*s0)/den,v=(qx*r1-qy*r0)/den;
    return u>=-1e-9&&u<=1+1e-9&&v>=-1e-9&&v<=1+1e-9?[u,v]:null;};
  let found=0;
  for(let i=0;i<S.length;i++)for(let j=i+1;j<S.length;j++){
    const A=S[i],Bs=S[j];
    // deux courbes qui se suivent dans un même contour : un recroisement est un éperon de dessin (Californian FB « B »), sans aire
    if(A.ci===Bs.ci){const n=contours[A.ci].seg.length,d=Math.abs(A.si-Bs.si);if(d===1||d===n-1)continue;}
    if(A.bb[0]>Bs.bb[2]||Bs.bb[0]>A.bb[2]||A.bb[1]>Bs.bb[3]||Bs.bb[1]>A.bb[3])continue;
    for(let a=0;a+1<A.poly.length;a++)for(let b=0;b+1<Bs.poly.length;b++){
      const P0=A.poly[a],P1=A.poly[a+1],Q0=Bs.poly[b],Q1=Bs.poly[b+1];
      const h=cross(P0,P1,Q0,Q1);if(!h)continue;
      let ta=P0[2]+(P1[2]-P0[2])*h[0],tb=Q0[2]+(Q1[2]-Q0[2])*h[1];
      for(let it=0;it<12;it++){ // Newton : A(ta) = B(tb)
        const fa=skTxtBzAt(A.B,ta),fb=skTxtBzAt(Bs.B,tb),ex=fa.p[0]-fb.p[0],ey=fa.p[1]-fb.p[1];
        const det=-fa.d[0]*fb.d[1]+fa.d[1]*fb.d[0];if(Math.abs(det)<1e-18)break;
        const da=(-ex*fb.d[1]+ey*fb.d[0])/det,db=(fa.d[0]*ey-fa.d[1]*ex)/det;
        ta-=da;tb-=db;if(Math.abs(da)<1e-13&&Math.abs(db)<1e-13)break;}
      if(!(ta>TE&&ta<1-TE&&tb>TE&&tb<1-TE))continue; // bout commun (sommet du contour) : pas un croisement
      const pa=skTxtBzAt(A.B,ta).p,pb=skTxtBzAt(Bs.B,tb).p;if(Math.hypot(pa[0]-pb[0],pa[1]-pb[1])>span*1e-7)continue;
      const X=[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2];
      if(!A.cuts.some(c=>Math.abs(c.t-ta)<1e-9))A.cuts.push({t:ta,X});
      if(!Bs.cuts.some(c=>Math.abs(c.t-tb)<1e-9))Bs.cuts.push({t:tb,X});
      found++;
    }
  }
  // contacts : sommet d'un contour posé SUR la courbe d'un autre (bord commun, jonction en T) — la courbe y est coupée
  const tol=span*1e-7;
  S.forEach(A=>{
    S.forEach(O=>{if(O===A)return;[O.B[0],O.B[O.B.length-1]].forEach(V=>{
      if(V[0]<A.bb[0]-tol||V[0]>A.bb[2]+tol||V[1]<A.bb[1]-tol||V[1]>A.bb[3]+tol)return;
      let bt=0,bd=1e18;for(const q of A.poly){const d=Math.hypot(q[0]-V[0],q[1]-V[1]);if(d<bd){bd=d;bt=q[2];}}
      let t=bt;for(let it=0;it<20;it++){const f=skTxtBzAt(A.B,t),ex=f.p[0]-V[0],ey=f.p[1]-V[1],dd=f.d[0]*f.d[0]+f.d[1]*f.d[1];if(dd<1e-24)break;
        const st=(ex*f.d[0]+ey*f.d[1])/dd;t=Math.max(0,Math.min(1,t-st));if(Math.abs(st)<1e-13)break;}
      if(!(t>TE&&t<1-TE))return;
      const p=skTxtBzAt(A.B,t).p;if(Math.hypot(p[0]-V[0],p[1]-V[1])>tol)return;
      if(!A.cuts.some(c=>Math.abs(c.t-t)<1e-9))A.cuts.push({t,X:V.slice()});found++;});});
  });
  if(!found)return contours;
  // enroulement « non nul » des contours d'origine, calculé sur les COURBES exactes (un polygone fin
  // coupait les grands arrondis : le côté intérieur d'un bord passait dehors, morceau perdu — Cascadia « 8 »)
  // règle de Sunday : chaque morceau monotone en y qui passe de « ≤ y » à « > y » à droite du point compte ±1
  const poly1=(c,t)=>{let v=0;for(let i=c.length-1;i>=0;i--)v=v*t+c[i];return v;};
  const yCoef=B=>{const y=B.map(q=>q[1]);if(y.length===2)return[y[0],y[1]-y[0]];
    if(y.length===3)return[y[0],2*(y[1]-y[0]),y[0]-2*y[1]+y[2]];
    return[y[0],3*(y[1]-y[0]),3*(y[0]-2*y[1]+y[2]),-y[0]+3*y[1]-3*y[2]+y[3]];};
  S.forEach(s=>{s.yc=yCoef(s.B);const d=s.yc.slice(1).map((v,i)=>v*(i+1)),ts=[0,1]; // coupures aux extremums en y
    if(d.length===2&&Math.abs(d[1])>1e-18){const r=-d[0]/d[1];if(r>0&&r<1)ts.push(r);}
    else if(d.length===3){const A=d[2],Bq=d[1],Cq=d[0];if(Math.abs(A)<1e-18){if(Math.abs(Bq)>1e-18){const r=-Cq/Bq;if(r>0&&r<1)ts.push(r);}}
      else{const D=Bq*Bq-4*A*Cq;if(D>=0){const q=Math.sqrt(D);[(-Bq-q)/(2*A),(-Bq+q)/(2*A)].forEach(r=>{if(r>0&&r<1)ts.push(r);});}}}
    s.mono=ts.sort((u,v)=>u-v);});
  const yJit=span*1.2345678e-9; // jamais pile à la hauteur d'un sommet
  const wind=(x,y0)=>{const y=y0+yJit;let w=0;
    for(const s of S){if(y<s.bb[1]||y>s.bb[3]||x>s.bb[2])continue;const c=s.yc.slice();c[0]-=y;
      for(let i=0;i+1<s.mono.length;i++){let u=s.mono[i],v=s.mono[i+1];const su=poly1(c,u)>0,sv=poly1(c,v)>0;if(su===sv)continue;
        if(s.bb[0]<=x){ // point dans la boîte : où la courbe croise-t-elle ? (sinon : forcément à droite)
          for(let it=0;it<48;it++){const m=(u+v)/2;if((poly1(c,m)>0)===su)u=m;else v=m;}
          if(!(skTxtBzAt(s.B,(u+v)/2).p[0]>x))continue;}
        w+=sv?1:-1;}}
    return w;};
  // morceaux : coupés aux croisements, gardés s'ils bordent la matière d'un seul côté
  const pieces=[];const eps=span*2e-5;
  S.forEach(s=>{
    s.cuts.sort((a,b)=>a.t-b.t);
    let rest=s.B,t0=0;const parts=[];
    s.cuts.forEach(c=>{const tt=(c.t-t0)/(1-t0);const[L,R]=skTxtBzSplit(rest,tt);L[L.length-1]=c.X.slice();R[0]=c.X.slice();parts.push({B:L,cut:true});rest=R;t0=c.t;});
    parts.push({B:rest,cut:!!s.cuts.length});
    parts.forEach((pc,k)=>{
      const m=skTxtBzAt(pc.B,0.5),dl=Math.hypot(m.d[0],m.d[1])||1,nx=-m.d[1]/dl,ny=m.d[0]/dl;
      const wl=wind(m.p[0]+nx*eps,m.p[1]+ny*eps),wr=wind(m.p[0]-nx*eps,m.p[1]-ny*eps);
      if((wl!==0)===(wr!==0))return; // morceau intérieur (ou extérieur) : retiré
      pieces.push({B:pc.B,whole:!pc.cut,s,last:k===parts.length-1,imp:!pc.cut&&!!s.g.imp});
    });
  });
  // rechaînage par les bouts
  const key=p=>Math.round(p[0]/(span*1e-8))+','+Math.round(p[1]/(span*1e-8));
  // bords superposés dans le même sens (deux contours qui partagent un côté, Cascadia « @ ») : un seul gardé
  {const seen=new Map(),keep=[];const mid=B=>skTxtBzAt(B,0.5).p;
    const onPc=(q,B)=>{let prev=B[0],m=1e18;for(let i=1;i<=24;i++){const c=skTxtBzAt(B,i/24).p,dx=c[0]-prev[0],dy=c[1]-prev[1],L2=dx*dx+dy*dy||1e-30;
      let t=((q[0]-prev[0])*dx+(q[1]-prev[1])*dy)/L2;t=Math.max(0,Math.min(1,t));m=Math.min(m,Math.hypot(q[0]-prev[0]-t*dx,q[1]-prev[1]-t*dy));prev=c;}return m;};
    pieces.forEach(p=>{const k=key(p.B[0])+'>'+key(p.B[p.B.length-1]),L=seen.get(k)||[];
      if(L.some(o=>onPc(mid(p.B),o.B)<span*1e-5&&onPc(mid(o.B),p.B)<span*1e-5))return;L.push(p);seen.set(k,L);keep.push(p);});
    pieces.length=0;keep.forEach(p=>pieces.push(p));}
  const from=new Map();pieces.forEach((p,i)=>{const k=key(p.B[0]);if(!from.has(k))from.set(k,[]);from.get(k).push(i);});
  const used=new Array(pieces.length).fill(false),out=[];
  for(let i0=0;i0<pieces.length;i0++){
    if(used[i0])continue;
    const ch=[];let i=i0;
    while(i!=null&&!used[i]){used[i]=true;ch.push(pieces[i]);const k=key(pieces[i].B[pieces[i].B.length-1]);const nx=(from.get(k)||[]).find(j=>!used[j]);i=nx!=null?nx:null;}
    if(ch.length<1)continue;
    const c={s:ch[0].B[0].slice(),seg:[]};
    ch.forEach((p,k)=>{const B=p.B,e=B[B.length-1],nxt=ch[(k+1)%ch.length];
      // milieu implicite gardé seulement si le morceau suivant est bien le segment suivant d'origine, entier
      const imp=p.imp&&nxt.whole&&nxt.s.ci===p.s.ci&&nxt.s.si===p.s.si+1&&nxt.s.g.k==='Q';
      if(B.length===2)c.seg.push({k:'L',p:e});else if(B.length===3)c.seg.push({k:'Q',c:B[1],p:e,imp});else c.seg.push({k:'C',c1:B[1],c2:B[2],p:e});});
    const L=c.seg[c.seg.length-1].p;c.seg[c.seg.length-1].p=c.s.slice(); // refermé exactement
    if(Math.hypot(L[0]-c.s[0],L[1]-c.s[1])>span*1e-6)c.seg.push({k:'L',p:c.s.slice()}); // chaîne restée ouverte (cas dégénéré)
    // chaîne sans aire (aller-retour sur un même bord) : rien à garder
    {let A=0,cur=c.s;c.seg.forEach(g=>{const B=skTxtBz(g,cur);cur=g.p;for(let i=1;i<=8;i++){const q=skTxtBzAt(B,(i-1)/8).p,r=skTxtBzAt(B,i/8).p;A+=q[0]*r[1]-r[0]*q[1];}});
      if(Math.abs(A)/2<span*span*1e-9)continue;}
    out.push(c);
  }
  return out;
}
/* ----- entités d'esquisse ----- */
function skTxtRec(sk,id){return(sk&&sk.entities||[]).find(e=>e&&e.t==='text'&&e.id===id)||null;}
function skTxtRecs(sk){return(sk&&sk.entities||[]).filter(e=>e&&e.t==='text');}
function skTxtClear(sk,id){
  // retire les contours d'un texte (points et entités marqués), la fiche reste
  sk.entities=(sk.entities||[]).filter(e=>!(e&&e.txt===id));
  Object.keys(sk.points||{}).forEach(p=>{const q=sk.points[p];if(q&&q.txt===id)delete sk.points[p];});
  // contraintes et cotes devenues orphelines : retirées par cleanupSk (afterEdit)
}
function skTxtBuild(sk,rec,L){
  // contours (mm, esquisse) → points + lignes + splines par points de contrôle, marqués txt
  const id=rec.id,P=sk.points,ents=[];
  const pt=(q)=>{const p=addPoint(sk,q[0],q[1]);P[p].txt=id;return p;};
  const same=(a,b)=>Math.abs(a[0]-b[0])<1e-7&&Math.abs(a[1]-b[1])<1e-7;
  let ref=null;
  L.contours.forEach(c=>{
    if(!c.seg.length)return;
    const p0=pt(c.s);if(!ref)ref=p0;
    let cur=p0,curXY=c.s;const segs=c.seg;
    const endPid=(xy,last)=>last&&same(xy,c.s)?p0:pt(xy);
    for(let i=0;i<segs.length;i++){
      const g=segs[i],last=i===segs.length-1;
      if(g.k==='L'){
        if(same(g.p,curXY))continue;
        const q=endPid(g.p,last);if(q===cur)continue;
        ents.push({id:skNewEid(sk),t:'line',p1:cur,p2:q,txt:id});cur=q;curXY=g.p;continue;
      }
      if(g.k==='C'){
        const q=endPid(g.p,last);
        ents.push({id:skNewEid(sk),t:'spline',mode:'ctrl',deg:3,pts:[cur,pt(g.c1),pt(g.c2),q],knots:[0,0,0,0,1,1,1,1],txt:id});
        cur=q;curXY=g.p;continue;
      }
      // courbes du 2ᵉ degré qui se suivent par un milieu implicite (tangentes) : une seule spline
      const run=[g];let j=i;
      while(segs[j].imp&&j+1<segs.length&&segs[j+1].k==='Q'){j++;run.push(segs[j]);}
      i=j;const lastR=j===segs.length-1;
      const n=run.length,end=run[n-1].p,q=endPid(end,lastR);
      const pts=[cur].concat(run.map(s=>pt(s.c)),[q]);
      const kn=[0,0,0];for(let u=1;u<n;u++)kn.push(u/n);kn.push(1,1,1);
      ents.push({id:skNewEid(sk),t:'spline',mode:'ctrl',deg:2,pts,knots:kn,txt:id});
      cur=q;curXY=end;
    }
    if(cur!==p0)ents.push({id:skNewEid(sk),t:'line',p1:cur,p2:p0,txt:id}); // contour refermé
  });
  sk.entities.push(...ents);
  const A=P[rec.pa];
  if(ref&&A){rec.ref=ref;rec.rx=P[ref].x-A.x;rec.ry=P[ref].y-A.y;}else{delete rec.ref;delete rec.rx;delete rec.ry;}
  return ents.length;
}
function skTxtOpts(rec,sk){const A=sk.points[rec.pa]||{x:0,y:0};return{str:rec.str,h:rec.h,sp:rec.sp,lh:rec.lh,al:rec.al,mir:rec.mir,ang:rec.ang,x:A.x,y:A.y};}
function skTxtRegen(sk,rec,F){
  // recalcule les contours d'un texte (police lue) ; {n, missing}
  skTxtClear(sk,rec.id);
  const L=skTxtLayout(F,skTxtOpts(rec,sk));
  const n=skTxtBuild(sk,rec,L);
  return{n,missing:L.missing};
}
function skTxtFollow(sk){
  // le texte suit son point d'ancrage (coté, contraint, glissé) : translation de ses points
  if(!sk||!sk.entities)return;
  const P=sk.points||{};
  for(const r of sk.entities){
    if(!r||r.t!=='text'||!r.ref)continue;
    const A=P[r.pa],Q=P[r.ref];if(!A||!Q)continue;
    const dx=A.x+r.rx-Q.x,dy=A.y+r.ry-Q.y;
    if(Math.abs(dx)<1e-10&&Math.abs(dy)<1e-10)continue;
    for(const k in P){const q=P[k];if(q&&q.txt===r.id){q.x+=dx;q.y+=dy;}}
  }
}
function skTxtFixedInto(sk,f){for(const k in(sk.points||{})){const q=sk.points[k];if(q&&q.txt)f.add(k);}}
function skTxtPidHidden(sk,pid){const q=sk&&sk.points&&sk.points[pid];return!!(q&&q.txt);}
function skTxtSelSet(){
  // ids des textes sélectionnés (un trait d'un texte sélectionne tout le texte, à l'écran)
  const s=new Set(),sk=skEdit;if(!sk)return s;
  const add=x=>{if(x&&x.kind==='ent'){const e=entById(sk,x.id);if(e&&e.txt)s.add(e.txt);}};
  add(skSel);(skSelX||[]).forEach(add);
  if(skTxt.cur)s.add(skTxt.cur);
  return s;
}
function skTxtKillWith(sk,killEnts){
  // suppression : un trait d'un texte emporte le texte entier (fiche, contours, points)
  const ids=new Set();(sk.entities||[]).forEach(e=>{if(e&&killEnts.has(e.id)&&(e.txt||e.t==='text'))ids.add(e.txt||e.id);});
  ids.forEach(id=>{(sk.entities||[]).forEach(e=>{if(e&&(e.txt===id||e.id===id))killEnts.add(e.id);});
    if(skTxt.cur===id)skTxt.cur=null;}); // les points des lettres partent au nettoyage (cleanupSk), APRÈS l'instantané d'annulation
  return ids.size;
}
/* ----- outil : poser, régler, rouvrir ----- */
function skTxtMsg(){
  if(!SK_TXT_FONTS.list.length)return(typeof window!=='undefined'&&typeof window.queryLocalFonts==='function'
    ?'Texte : le navigateur ne donne pas les polices de l’ordinateur (autorisation « Polices » refusée pour ce site) — autorisez-la, ou « 📂 Police… » pour choisir un fichier .ttf / .otf.'
    :'Texte : ce navigateur ne donne pas accès aux polices installées — « 📂 Police… » pour choisir un fichier .ttf / .otf / .ttc (Windows : C:\\Windows\\Fonts ; Mac : /Library/Fonts).');
  return skTxt.cur?'Texte : réglez-le dans le bandeau — Entrée ou ✓ pour finir, double-clic sur un texte pour le modifier.':'Texte : cliquez où commence la ligne (ancre, sur la ligne de base).';
}
async function skTxtStart(){
  // outil choisi : polices chargées (autorisation demandée par le navigateur au 1er usage)
  skTxt.cur=null;skTxt.pushed=false;
  skTxtSync();skStatus('Texte : lecture des polices de l’ordinateur…');
  await skTxtEnsureFonts();
  skTxtFillFonts();
  if(skEdit&&skTool==='text')skStatus(skTxtMsg());
  if(skTxt.ps)skTxtFont(skTxt.ps).then(()=>{if(skTxt.last&&skTool==='text')skTxtMove(skEdit,skTxt.last.x,skTxt.last.y);}).catch(()=>{});
}
function skTxtMove(sk,wx,wy){
  skTxt.last={x:wx,y:wy};
  if(skTxt.cur){return;}
  const F=SK_TXT_FONTS.parsed.get(skTxt.ps);
  let x=wx,y=wy;const s=findSnap(sk,wx,wy);if(s){x=s.x;y=s.y;}else if($('skSnap').checked){x=skSnapVal(x);y=skSnapVal(y);}
  skDraft=F?{t:'text',L:skTxtLayout(F,Object.assign({},skTxt,{x,y})),x,y}:{t:'text',L:null,x,y};
  drawSketch2D();
}
async function skTxtDown(sk,wx,wy){
  if(skTxt.cur){skTxtFinish();if(skTool!=='text')return;}
  if(!skTxt.ps){await skTxtEnsureFonts();skTxtFillFonts();}
  let F=null;try{F=await skTxtFont(skTxt.ps);}catch(e){skStatus('Police illisible : '+(e&&e.message||e));return;}
  if(!F){skStatus(skTxtMsg());return;}
  if(!String(skTxt.str||'').trim()){skStatus('Texte : tapez d’abord le texte dans le bandeau.');return;}
  skPushUndo();
  skPlUndoIfPlane(sk,wx,wy);
  const pa=snapNewPoint(sk,wx,wy);
  const rec={id:skNewEid(sk),t:'text',pa,str:skTxt.str,font:{ps:skTxt.ps,family:skTxt.family,style:skTxt.style},h:skTxt.h,ang:skTxt.ang,sp:skTxt.sp,lh:skTxt.lh,al:skTxt.al,mir:!!skTxt.mir};
  sk.entities.push(rec);
  const r=skTxtRegen(sk,rec,F);
  skTxt.cur=rec.id;skTxt.pushed=true;skDraft=null;
  afterEdit();
  skTxtFillBar(rec);
  skStatus('Texte posé ('+r.n+' traits)'+(r.missing?' — '+r.missing+' caractère(s) absent(s) de la police':'')+' — réglez-le, puis Entrée.');
}
async function skTxtApply(){
  // bandeau changé pendant le réglage d'un texte posé : contours refaits (une seule annulation)
  const sk=skEdit,rec=sk&&skTxt.cur?skTxtRec(sk,skTxt.cur):null;if(!rec)return;
  let F=null;try{F=await skTxtFont(skTxt.ps);}catch(e){F=null;}
  if(!F){skStatus('Police « '+(skTxt.family||skTxt.ps||'?')+' » absente de cet ordinateur — choisissez-en une autre (📂 Police…).');return;}
  if(skEdit!==sk||skTxt.cur!==rec.id)return;
  if(!skTxt.pushed){skPushUndo();skTxt.pushed=true;}
  Object.assign(rec,{str:skTxt.str,font:{ps:skTxt.ps,family:skTxt.family,style:skTxt.style},h:skTxt.h,ang:skTxt.ang,sp:skTxt.sp,lh:skTxt.lh,al:skTxt.al,mir:!!skTxt.mir});
  const r=skTxtRegen(sk,rec,F);
  afterEdit();
  skStatus('Texte : '+r.n+' traits'+(r.missing?' — '+r.missing+' caractère(s) absent(s) de la police':'')+' — Entrée pour finir.');
}
function skTxtFinish(){
  // fin du réglage : un texte vide est retiré
  const sk=skEdit,id=skTxt.cur;skTxt.cur=null;skTxt.pushed=false;clearTimeout(skTxt.tm);skTxt.tm=null;
  if(sk&&id){const rec=skTxtRec(sk,id);
    if(rec&&!String(rec.str||'').trim()){const k=new Set([rec.id]);skTxtKillWith(sk,k);sk.entities=sk.entities.filter(e=>!k.has(e.id));cleanupSk(sk);}
  }
  if(sk){drawSketch2D();renderSkPanel();skStatus(skTool==='text'?skTxtMsg():'Texte terminé.');}
  skTxtSync();
}
async function skTxtEdit(sk,txtId){
  // double-clic sur un texte : bandeau rouvert avec ses réglages
  const rec=skTxtRec(sk,txtId);if(!rec)return false;
  skCancelDraft();
  skTool='text';document.querySelectorAll('#skToolbar .tool').forEach(x=>x.classList.toggle('on',x.dataset.tool==='text'));
  Object.assign(skTxt,{str:rec.str,h:rec.h,ang:rec.ang||0,sp:rec.sp||0,lh:rec.lh||1,al:rec.al||'g',mir:!!rec.mir});
  if(rec.font){skTxt.ps=rec.font.ps;skTxt.family=rec.font.family;skTxt.style=rec.font.style;}
  skTxt.cur=rec.id;skTxt.pushed=false;
  skTxtSync();skTxtFillBar(rec);
  skStatus('Modification du texte — Entrée ou ✓ pour finir.');
  await skTxtEnsureFonts();
  if(rec.font&&!SK_TXT_FONTS.byPs.has(rec.font.ps))skStatus('Police « '+(rec.font.family||rec.font.ps)+' » absente de cet ordinateur : le texte garde sa forme ; choisissez une police pour le modifier.');
  skTxtFillFonts();
  drawSketch2D();
  return true;
}
/* ----- bandeau ----- */
function skTxtBuildBar(){
  const host=document.getElementById('skMain');if(!host)return null;
  const b=document.createElement('div');b.id='skTxtBar';
  b.style.cssText='position:absolute;left:10px;top:10px;max-width:min(980px,calc(100% - 230px));z-index:20;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--panel,#1e1e1e);font-size:.8rem';
  const lab=(txt,title,el)=>{const l=document.createElement('label');l.style.cssText='display:flex;gap:5px;align-items:center';l.title=title;l.appendChild(document.createTextNode(txt));l.appendChild(el);b.appendChild(l);return el;};
  const stop=el=>{el.addEventListener('keydown',e=>{e.stopPropagation();
    if(e.key==='Escape'){e.preventDefault();el.blur();skTxtFinish();skEscapeToSelect();}
    else if(e.key==='Enter'&&!(el.tagName==='TEXTAREA'&&e.shiftKey)){e.preventDefault();el.blur();skTxtRead(true).then(()=>skTxtFinish());}});
    ['pointerdown','mousedown','wheel','dblclick'].forEach(t=>el.addEventListener(t,e=>e.stopPropagation()));};
  const ta=document.createElement('textarea');ta.dataset.txt='str';ta.rows=1;ta.style.cssText='width:190px;min-height:22px;resize:vertical;font:inherit';
  lab('Texte',"Texte à écrire — Maj+Entrée : nouvelle ligne",ta);
  const fam=document.createElement('select');fam.dataset.txt='family';fam.style.maxWidth='190px';
  lab('Police','Toutes les polices de l’ordinateur (la liste se tape au clavier)',fam);
  const sty=document.createElement('select');sty.dataset.txt='style';sty.style.maxWidth='130px';
  lab('Style','Normal, gras, italique… selon la police',sty);
  const num=(key,txt,title,w,step)=>{const i=document.createElement('input');i.type='text';i.inputMode='decimal';i.dataset.txt=key;i._parFx=1;i.style.width=w;i.step=step;return lab(txt,title,i);};
  num('h','Hauteur','Hauteur des majuscules, en mm','52px');
  num('ang','Angle','Angle de la ligne de base, en degrés (sens trigonométrique)','46px');
  num('sp','Espace','Espace ajouté entre les lettres, en mm (négatif : resserré)','46px');
  num('lh','Interligne','Interligne : 1 = normal, 1,5 = une ligne et demie','40px');
  const al=document.createElement('select');al.dataset.txt='al';
  [['g','⇤ Gauche'],['c','↔ Centre'],['d','⇥ Droite']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;al.appendChild(o);});
  lab('Aligné','Position du texte par rapport au point d’ancrage',al);
  const mir=document.createElement('input');mir.type='checkbox';mir.dataset.txt='mir';
  lab('Miroir','Texte retourné (lecture dans un miroir) : moules, tampons, gravure au dos',mir);
  const bf=document.createElement('button');bf.type='button';bf.textContent='📂 Police…';bf.title='Choisir un fichier de police (.ttf, .otf, .ttc) — gardé pour les prochaines fois';bf.onclick=e=>{e.stopPropagation();skTxtPickFiles();};b.appendChild(bf);
  const ok=document.createElement('button');ok.type='button';ok.dataset.txt='ok';ok.textContent='✓ OK';ok.title='Terminer le texte (Entrée)';ok.onclick=e=>{e.stopPropagation();skTxtRead(true).then(()=>skTxtFinish());};b.appendChild(ok);
  [ta,fam,sty,al,mir,...b.querySelectorAll('input[type=text]')].forEach(el=>{stop(el);el.addEventListener(el.tagName==='SELECT'||el.type==='checkbox'?'change':'input',()=>skTxtRead(false,el));});
  ['pointerdown','mousedown','wheel','dblclick','click'].forEach(t=>b.addEventListener(t,e=>e.stopPropagation()));
  host.appendChild(b);
  return b;
}
function skTxtFillFonts(){
  const b=document.getElementById('skTxtBar');if(!b)return;
  const fam=b.querySelector('[data-txt="family"]'),sty=b.querySelector('[data-txt="style"]');if(!fam||!sty)return;
  const fams=skTxtFamilies();
  if(fam._n!==fams.length){
    fam.innerHTML='';fam._n=fams.length;
    if(!fams.length){const o=document.createElement('option');o.value='';o.textContent='(aucune police — 📂)';fam.appendChild(o);}
    fams.forEach(f=>{const o=document.createElement('option');o.value=f.family;o.textContent=f.family;try{o.style.fontFamily='"'+f.family.replace(/"/g,'')+'"';}catch(e){}fam.appendChild(o);});
  }
  const cur=SK_TXT_FONTS.byPs.get(skTxt.ps);
  const famName=cur?(cur.family||cur.full||cur.ps):(skTxt.family||'');
  if(famName&&![...fam.options].some(o=>o.value===famName)){const o=document.createElement('option');o.value=famName;o.textContent=famName+' (absente)';fam.appendChild(o);}
  fam.value=famName;
  const F=fams.find(f=>f.family===famName);
  sty.innerHTML='';
  (F?F.faces:[{ps:skTxt.ps,style:skTxt.style||'—'}]).forEach(x=>{const o=document.createElement('option');o.value=x.ps||'';o.textContent=x.style||x.full||x.ps;sty.appendChild(o);});
  sty.value=skTxt.ps||'';
}
function skTxtFillBar(rec){
  const b=document.getElementById('skTxtBar');if(!b)return;
  const v=rec||skTxt,q=k=>b.querySelector('[data-txt="'+k+'"]');if(!q('str'))return;
  const fmt=x=>String(+(+x).toFixed(4)).replace('.',',');
  q('str').value=v.str||'';q('h').value=fmt(v.h);q('ang').value=fmt(v.ang||0);q('sp').value=fmt(v.sp||0);q('lh').value=fmt(v.lh||1);
  q('al').value=v.al||'g';q('mir').checked=!!v.mir;
  skTxtFillFonts();
}
async function skTxtRead(now,src){
  // bandeau → réglages ; texte en cours de réglage refait, aperçu sinon
  const b=document.getElementById('skTxtBar');if(!b)return;
  const q=k=>b.querySelector('[data-txt="'+k+'"]'),n=k=>parseFloat(String(q(k).value).replace(',','.'));if(!q('str'))return;
  skTxt.str=q('str').value;
  const h=n('h');if(h>0)skTxt.h=h;
  const a=n('ang');if(isFinite(a))skTxt.ang=a;
  const s=n('sp');if(isFinite(s))skTxt.sp=s;
  const l=n('lh');if(l>0)skTxt.lh=l;
  skTxt.al=q('al').value||'g';skTxt.mir=!!q('mir').checked;
  if(src&&src.dataset.txt==='family'){const F=skTxtFamilies().find(f=>f.family===src.value);if(F&&F.faces[0]){skTxt.ps=F.faces[0].ps;}skTxtFillFonts();}
  else if(q('style').value)skTxt.ps=q('style').value;
  const o=SK_TXT_FONTS.byPs.get(skTxt.ps);if(o){skTxt.family=o.family;skTxt.style=o.style;}
  q('str').rows=Math.min(6,Math.max(1,String(skTxt.str).split('\n').length));
  try{await skTxtFont(skTxt.ps);}catch(e){skStatus('Police illisible : '+(e&&e.message||e));}
  if(skTxt.cur){ // texte posé : refait de suite (liste, case, Entrée), ou un instant après la dernière touche
    clearTimeout(skTxt.tm);skTxt.tm=null;
    if(now||(src&&(src.tagName==='SELECT'||src.type==='checkbox')))await skTxtApply();
    else skTxt.tm=setTimeout(()=>{skTxt.tm=null;skTxtApply();},220);
  }
  else if(skTxt.last&&skEdit&&skTool==='text')skTxtMove(skEdit,skTxt.last.x,skTxt.last.y);
}
function skTxtSync(){
  // le bandeau n'existe à l'écran que pendant l'outil Texte
  const on=!!skEdit&&skTool==='text';
  let b=document.getElementById('skTxtBar');
  if(!on){if(b)b.style.display='none';if(skTxt.cur&&skEdit)skTxtFinish();return;}
  if(!b){b=skTxtBuildBar();if(b)skTxtFillBar(skTxt.cur&&skEdit?skTxtRec(skEdit,skTxt.cur):null);}
  if(b)b.style.display='flex';
}
function skTxtDrawDraft(d){
  // aperçu sous la souris : contours en pointillé + croix d'ancrage
  const[a,b]=w2s(d.x,d.y);
  skEl('path',{d:`M ${a-6} ${b} L ${a+6} ${b} M ${a} ${b-6} L ${a} ${b+6}`,stroke:'#ffd60a','stroke-width':1.4});
  if(!d.L){const t=skEl('text',{x:a+8,y:b-8,fill:'#ffd60a','font-size':12});t.textContent=SK_TXT_FONTS.list.length?'police en lecture…':'aucune police — 📂';return;}
  skEl('path',{d:skTxtPathD(d.L.contours),fill:'rgba(255,255,255,.06)','fill-rule':'evenodd',stroke:'#fff','stroke-width':1.2,'stroke-dasharray':'4 3'});
}
function skTxtPathD(contours){
  // contours (mm) → chemin SVG écran (courbes exactes : Q / C)
  const S=p=>{const s=w2s(p[0],p[1]);return s[0].toFixed(1)+' '+s[1].toFixed(1);};
  return contours.map(c=>'M '+S(c.s)+' '+c.seg.map(g=>g.k==='L'?'L '+S(g.p):(g.k==='Q'?'Q '+S(g.c)+' '+S(g.p):'C '+S(g.c1)+' '+S(g.c2)+' '+S(g.p))).join(' ')+' Z').join(' ');
}
