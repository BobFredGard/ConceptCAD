/* ══ La Pièce qui propose (V1.0.19) ══
   Fred, 26/11 : « On y va. Je ferai le tri à la fin » ; 26/11 au soir : gardée avec la loupe, « mais il
   va falloir la rendre utilisable » — propositions à côté, trop envahissante, pas claire à utiliser.
   Comme le clavier du téléphone qui devine le mot suivant : APRÈS CHAQUE FONCTION, ConceptCAD propose ce
   que l'on ferait probablement ensuite SUR CE QUE L'ON VIENT DE FAIRE, dans une bande discrète en bas de
   la vue (« Ensuite ? »). Rien à l'ouverture d'une pièce, rien tant qu'on ne fait rien :
     · le même congé (ou chanfrein) sur les arêtes pareilles, juste après en avoir posé un : les autres
       coins de la même poche, les autres trous, puis les mêmes arêtes ailleurs sur la pièce ;
     · arrondir les coins vifs creux de ce que l'on vient de faire, au rayon de la plus petite fraise
       (aucune fraise ne fait de coin vif) ;
     · les habitudes de la séance : un chanfrein posé sur le bord d'une poche est proposé sur la suivante.
   Chaque arête est rattachée aux fonctions qui ont créé ses deux faces (noms des faces, 20-05-noms) ;
   creux ou saillant : un point dedans / dehors autour de son milieu (occClassifier). Le survol d'une
   proposition la dessine en fantôme orange ; 1, 2, 3 ou un clic la fait (un script : mêmes fonctions
   Congé, Chanfrein, Perçage que l'interface, une seule annulation) ; Échap ou « Non merci » : plus
   reproposée pour cette fonction. Le bouton étincelle ouvre un petit menu : Proposer la suite (oui /
   non), Écrire une demande (/), Essayer une variante. */
const PP_CALME=600, PP_SIG_MS=400, PP_MAX=3, PP_EDGES_MAX=1500, PP_RHO=0.25, PP_N=12;
const PP_ORANGE='#ff8a3d';
const pp={on:false,gen:0,reqGen:0,req:null,ask:null,askBar:null,askOpen:false,busy:false,sig:'',want:'',wantT:0,sigT:0,list:[],all:[],focus:-1,hover:-1,
  base:null,prevRead:null,habits:[],refus:new Set(),act:null,hintT:-1e9,menuOpen:false,
  layer:null,strip:null,box:null,menu:null,svg:null,btn:null,varEl:null,msg:'',msgOk:true,msgT:-1e9,visT:0,placeT:0,ms:0};
function ppNow(){return (typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();}
function ppWs(){try{return (typeof document!=='undefined'&&document.body&&document.body.dataset.ws)||'cao';}catch(e){return 'cao';}}
function ppYield(){return new Promise(r=>setTimeout(r,0));}
function ppNum(v){const r=Math.round(v*100)/100;return String(r).replace('.',',');}
function ppBodies(){
  try{return (bodies||[]).filter(b=>b&&b.kind==='body'&&b.shape&&b.visible!==false&&!b.ghost&&!b.asmComp&&(typeof bodyShown!=='function'||bodyShown(b)));}
  catch(e){return [];}
}
/* ── ce que la FAO dit : axe d'outil du dessus, plus petite fraise ── */
function ppSetups(){
  try{const f=typeof doc!=='undefined'&&doc&&doc.fao;
    return (f&&Array.isArray(f.setups)?f.setups:[]).filter(s=>s&&!(typeof faoSetupStruck==='function'&&faoSetupStruck(s)));}
  catch(e){return [];}
}
function ppAxes(){
  // axes d'outil (vers la broche) : Z de chaque posage, puis le repère propre de chaque opération en 3+2
  // (faoOpFrame, comme l'usinage en direct) ; une direction déjà vue n'est pas reprise ; sans FAO : le dessus
  const out=[],S=ppSetups();
  const add=Z=>{if(Z&&!out.some(z=>z[0]*Z[0]+z[1]*Z[1]+z[2]*Z[2]>0.9999))out.push(Z.slice());};
  S.forEach(s=>{try{const F=faoFrame(s);if(F)add(F.Z);}catch(e){}});
  const nPos=out.length; // les congés extérieurs restent sur les axes des posages (un axe 3+2 de côté les prendrait presque tous)
  if(typeof faoOpFrame==='function')S.forEach(s=>(s.ops||[]).forEach(op=>{
    if(!op||!op.frame)return;try{const F=faoOpFrame(s,op);if(F)add(F.Z);}catch(e){}}));
  if(!out.length)out.push([0,0,1]);
  out.nPos=nPos||1;
  return out;
}
function ppMill(){
  // plus petite fraise (les forets, tarauds, chanfreins ne font pas de coin) ; sans FAO : la liste de départ
  let src=[];ppSetups().forEach(s=>(s.tools||[]).forEach(t=>src.push(t)));
  if(!src.length&&typeof faoDefaultTools==='function'){try{src=faoDefaultTools();}catch(e){src=[];}}
  let best=null;
  src.forEach(t=>{
    if(!t||!['flat','bull','ball'].includes(t.kind||'flat'))return;
    let D=+t.d;try{if(typeof faoToolDims==='function')D=faoToolDims(t).D;}catch(e){}
    if(D>0&&(!best||D<best))best=D;
  });
  return best;
}
/* ── habitudes : valeurs déjà employées dans le document (la plus récente) ── */
function ppHabit(cham,max){
  // la plus récente au plus max (un gros congé de forme n'est pas un cassage d'angle)
  const F=(typeof doc!=='undefined'&&doc&&doc.features)||[];
  for(let i=F.length-1;i>=0;i--){const f=F[i];
    if(!f||f.type!=='xfillet'||!!f.chamfer!==!!cham||!f.edges||!f.edges.length)continue;
    const r=+f.edges[0].r;if(r>0&&r<=(max||Infinity))return r;}
  return null;
}
/* ── lecture de la pièce : arêtes, creux ou saillant ── */
function ppV(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function ppDot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function ppNorm(a){const l=Math.hypot(a[0],a[1],a[2]);return l>1e-12?[a[0]/l,a[1]/l,a[2]/l]:null;}
function ppCross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function ppTangent(P,mid){
  let k=0,bd=Infinity;P.forEach((p,i)=>{const d=Math.hypot(p[0]-mid[0],p[1]-mid[1],p[2]-mid[2]);if(d<bd){bd=d;k=i;}});
  const a=P[Math.max(0,k-1)],b=P[Math.min(P.length-1,k+1)];
  return ppNorm(ppV(b,a));
}
function ppProbe(st,mid,t,rho){
  // part de matière sur un petit cercle autour de l'arête (sur une face : ½), et le côté vide (bissectrice)
  if(!t)return {frac:0.5,out:null};
  const ref=Math.abs(t[0])<0.9?[1,0,0]:[0,1,0],u=ppNorm(ppCross(t,ref)),v=ppCross(t,u);
  let s=0;const o=[0,0,0];
  for(let k=0;k<PP_N;k++){const a=(k+0.37)/PP_N*2*Math.PI,c=Math.cos(a),d=Math.sin(a);
    const w=[c*u[0]+d*v[0],c*u[1]+d*v[1],c*u[2]+d*v[2]];
    const m=st([mid[0]+rho*w[0],mid[1]+rho*w[1],mid[2]+rho*w[2]]);s+=m;
    if(m<1){o[0]+=(1-m)*w[0];o[1]+=(1-m)*w[1];o[2]+=(1-m)*w[2];}}
  return {frac:s/PP_N,out:ppNorm(o)};
}
function ppReach(st,e,AX,B){
  // un coin intérieur n'est proposé que si une fraise y descend : on part du vide au ras de l'arête et on
  // remonte vers la broche le long de chaque axe d'outil parallèle à l'arête. De la matière au-dessus
  // (fond d'une poche ouverte sur le côté, sous un plafond : Perçages, 26/11) = aucune fraise n'y va.
  if(!st||!e||!e.out||!e.dir||!B)return true;
  const d0=Math.min(0.5,e.len/4),m=e.mid,p0=[m[0]+e.out[0]*d0,m[1]+e.out[1]*d0,m[2]+e.out[2]*d0];
  if(st(p0)>=1)return true; // le vide n'est pas là où on l'attend : on ne sait pas dire, comme avant
  let seen=false;
  for(const A of AX){
    if(Math.abs(ppDot(e.dir,A))<0.9995)continue;
    seen=true;
    let hi=-Infinity;
    for(let i=0;i<8;i++){const c=[(i&1?B.hi:B.lo)[0],(i&2?B.hi:B.lo)[1],(i&4?B.hi:B.lo)[2]];hi=Math.max(hi,ppDot(c,A));}
    const L=hi-ppDot(p0,A)+0.5;if(!(L>0))return true;
    const step=Math.max(0.5,L/60);let free=true;
    for(let k=step;k<=L+1e-9;k+=step)if(st([p0[0]+A[0]*k,p0[1]+A[1]*k,p0[2]+A[2]*k])>=1){free=false;break;}
    if(free)return true;
  }
  return !seen;
}
function ppStateFn(shape){
  // f(p) → 1 dedans, 0 dehors, ½ sur une face ; libérer par f.free()
  const cl=occClassifier(shape),T=occt.TopAbs_State;
  const f=p=>{const q=new occt.gp_Pnt_3(p[0],p[1],p[2]);try{cl.Perform(q,1e-6);const r=cl.State();return r===T.TopAbs_IN?1:r===T.TopAbs_ON?0.5:0;}
    finally{try{q.delete();}catch(e){}}};
  f.free=()=>{try{cl.delete();}catch(e){}};
  return f;
}
function ppFaces(shape){
  // faces planes : centre, taille, normale (repère monde)
  const out=[];
  try{
    const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE,ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);
    try{
      while(ex.More()){
        const f=occFaceCur(ex);
        try{
          let plane=false;const ad=new occt.BRepAdaptor_Surface_2(f,true);
          try{plane=ad.GetType()===occt.GeomAbs_SurfaceType.GeomAbs_Plane;}finally{try{ad.delete();}catch(e){}}
          if(plane){const r=occFaceRef(f);if(r)out.push({c:r.pos,s:r.dim,n:r.n});}
        }finally{try{f.delete();}catch(e){}}
        ex.Next();
      }
    }finally{try{ex.delete();}catch(e){}}
  }catch(e){}
  return out;
}
async function ppRead(gen,cur){
  cur=cur||(()=>pp.gen);
  const out=[],OC=ppOwnerCtx();let t0=ppNow();
  for(const b of ppBodies()){
    let E=null;try{E=occListEdges(b.shape);}catch(e){E=null;}
    if(!E)continue;
    try{if(typeof nomsSurAretes==='function')nomsSurAretes(b.shape,E);}catch(e){} // e.nom = « faceA|faceB »
    const st=ppStateFn(b.shape),R={id:b.id,edges:[],faces:[],st:null};
    try{
      for(let i=0;i<E.length&&i<PP_EDGES_MAX;i++){
        if(ppNow()-t0>12){await ppYield();t0=ppNow();if(gen!==cur()){st.free();return null;}}
        const e=E[i],P=e.pts;if(!P||P.length<2||!(e.len>0.05))continue;
        const a=P[0],z=P[P.length-1],L=Math.hypot(z[0]-a[0],z[1]-a[1],z[2]-a[2]);
        const line=L>0.05&&Math.abs(e.len-L)<=0.002*L+1e-3;
        const t=line?ppNorm(ppV(z,a)):ppTangent(P,e.mid);
        const rho=Math.min(PP_RHO,e.len/6);
        const pr=ppProbe(st,e.mid,t,rho);
        R.edges.push({mid:e.mid.slice(),pts:P,len:e.len,line,dir:line?t:null,frac:pr.frac,out:pr.out,nom:e.nom||null,own:e.nom?ppOwners(e.nom,OC):[]});
      }
      R.faces=ppFaces(b.shape);
      R.st=st;out.push(R);
    }catch(e){st.free();throw e;}
  }
  return out;
}
/* ── les propositions ── */
function ppRound(v,s){return Math.round(v/s)*s;}
function ppBox(Rs){
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  Rs.forEach(R=>R.edges.forEach(e=>e.pts.forEach(p=>{for(let k=0;k<3;k++){if(p[k]<lo[k])lo[k]=p[k];if(p[k]>hi[k])hi[k]=p[k];}})));
  return {lo,hi,size:[hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]]};
}
function ppCircle(c,n,r,k){
  const ref=Math.abs(n[0])<0.9?[1,0,0]:[0,1,0],u=ppNorm(ppCross(n,ref)),v=ppCross(n,u),P=[];
  for(let i=0;i<=(k||32);i++){const a=i/(k||32)*2*Math.PI;P.push([c[0]+r*(Math.cos(a)*u[0]+Math.sin(a)*v[0]),c[1]+r*(Math.cos(a)*u[1]+Math.sin(a)*v[1]),c[2]+r*(Math.cos(a)*u[2]+Math.sin(a)*v[2])]);}
  return P;
}
function ppEdgeCmds(op,L,val){
  // une commande par corps (une fonction Congé ne travaille que sur un corps) ; arête = la plus proche du milieu
  const by=new Map();L.forEach(x=>{if(!by.has(x.b))by.set(x.b,[]);by.get(x.b).push(x.e);});
  const cmds=[];
  by.forEach((E,b)=>{const c={op,edges:E.map(e=>({body:b,near:e.mid.map(v=>+v.toFixed(4))}))};if(op==='chamfer')c.distance=val;else c.radius=val;cmds.push(c);});
  return cmds;
}
/* ── d'où vient chaque arête : les fonctions qui ont créé ses deux faces ── */
function ppSplitNom(nom){
  // nom d'arête → noms de ses deux faces (crochets respectés, chevrons de départage ignorés)
  if(typeof nomsDecoupe==='function')return nomsDecoupe(String(nom));
  let prof=0,cur='';const fa=[];
  for(const c of String(nom)){if(c==='[')prof++;else if(c===']')prof--;if(!prof&&c==='<')break;if(!prof&&c==='|'){fa.push(cur);cur='';continue;}cur+=c;}
  fa.push(cur);return fa;
}
function ppNomKey(nom){return ppSplitNom(nom).map(n=>n.replace(/(#\d+|@[^|[\]]*)+$/,'')).sort().join('|');}
function ppOwnerCtx(){
  // id → fonction de premier niveau (une copie de répétition → la répétition) ; arête d'origine → son congé
  const F=(typeof doc!=='undefined'&&doc&&doc.features)||[],top=new Map(),fil=new Map();
  F.forEach(f=>{if(!f||!f.id)return;const k=f.repeatId||f.id;top.set(f.id,k);
    if(f.type==='xfillet'&&Array.isArray(f.edges))f.edges.forEach(e=>{if(e&&e.nom)fil.set(ppNomKey(e.nom),k);});});
  return {top,fil};
}
function ppOwnerOf(face,C){
  // « ex_4_x/e5/flanc » → ex_4_x ; « congé[A|B] », « chanfrein[A|B] » → le congé posé sur l'arête A|B
  const m=String(face).match(/^(?:congé|chanfrein)\[([\s\S]*)\]/);
  if(m)return C.fil.get(ppNomKey(m[1]))||null;
  const id=String(face).split('/')[0].replace(/(#\d+|@.*)+$/,'');
  return C.top.get(id)||null;
}
function ppOwners(nom,C){return ppSplitNom(nom).map(f=>ppOwnerOf(f,C));}
/* ── le genre d'une arête ── */
// arête vive : 90° environ (¼ ou ¾ de matière autour) ; le pli à 135° qu'un chanfrein laisse (⅜) n'en est pas une
function ppSharp(e,conv){return conv==='in'?(e.frac>=0.68&&e.frac<=0.92):(e.frac>=0.08&&e.frac<=0.32);}
function ppCls(e,AX){
  // creux ou saillant ; dans l'axe d'un outil, droite de travers ou courbe ; entre deux faces de la même
  // fonction (coin, fond : « int ») ou à la frontière avec une autre (bord d'une poche : « bord »)
  const conv=e.frac>0.5?'in':'out';
  const ori=e.line?(e.dir&&AX.some(z=>Math.abs(ppDot(e.dir,z))>0.9995)?'ax':'flat'):'curve';
  const o=e.own||[],role=o.length>=2&&o[0]&&o[0]===o[1]?'int':'bord';
  return {conv,ori,role};
}
const PP_MOTS={'in ax':['coin','coins','le coin'],'out ax':['arête verticale','arêtes verticales','l’arête verticale'],
  'in flat':['arête du fond','arêtes du fond','l’arête du fond'],'out flat':['arête du bord','arêtes du bord','l’arête du bord'],
  'in curve':['arête courbe du fond','arêtes courbes du fond','l’arête courbe du fond'],'out curve':['arête courbe','arêtes courbes','l’arête courbe'],
  hole:['trou','trous','le trou']};
function ppFeatById(id){return ((typeof doc!=='undefined'&&doc&&doc.features)||[]).find(f=>f&&f.id===id)||null;}
function ppIsHole(id){const F=(typeof doc!=='undefined'&&doc&&doc.features)||[];return F.some(f=>f&&f.type==='hole'&&(f.id===id||f.repeatId===id));}
function ppMots(c,n,own){
  const w=(c.ori==='curve'&&(own||[]).some(id=>id&&ppIsHole(id)))?PP_MOTS.hole:(PP_MOTS[c.conv+' '+c.ori]||['arête','arêtes','l’arête']);
  return {one:w[0],many:w[1],le:w[2],txt:n>1?n+' '+w[1]:w[2]};
}
const PP_TYPE={extrude:'Extrusion',revolve:'Révolution',xfillet:'Congé',hole:'Perçage',repeat:'Répétition',shell:'Coque',sweep:'Balayage'};
function ppFeatName(f){
  if(!f)return 'la pièce';
  // « Découpe Esquisse 2 -6mm » → « Découpe Esquisse 2 » ; « Congé exact (4 arête(s)) » → « Congé exact »
  let n=String(f.name||'').replace(/\s*\(.*$/,'').replace(/\s+[±+\-−]?\d+(?:[.,]\d+)?\s*mm\b.*$/,'').trim();
  if(!n)n=f.type==='extrude'&&f.op==='cut'?'Découpe':(f.type==='xfillet'&&f.chamfer?'Chanfrein':(PP_TYPE[f.type]||f.type||'fonction'));
  return n.length>34?n.slice(0,33)+'…':n;
}
function ppMain(own){
  // la plus récente des fonctions propriétaires (le bord d'une poche : la poche, pas le bloc)
  const F=(typeof doc!=='undefined'&&doc&&doc.features)||[];let best=null,bi=-1;
  (own||[]).forEach(id=>{if(!id)return;const i=F.findIndex(f=>f&&f.id===id);if(i>bi){bi=i;best=id;}});
  return best;
}
/* ── ce que l'on vient de faire ── */
function ppFeatSig(f){const o=ppFeatVals(f);if(Array.isArray(f.edges))o.ne=f.edges.length;return JSON.stringify(o);}
function ppSkSig(s){try{return JSON.stringify([s.points,s.entities,(s.dims||[]).map(d=>d&&d.value)]);}catch(e){return '';}}
function ppSnapBase(){
  const d=typeof doc!=='undefined'?doc:null,F=(d&&d.features)||[],S=(d&&d.sketches)||[];
  return {doc:d,f:new Map(F.filter(f=>f&&f.id&&!f.repeatId).map(f=>[f.id,ppFeatSig(f)])),s:new Map(S.filter(s=>s&&s.id).map(s=>[s.id,ppSkSig(s)]))};
}
function ppAction(prev,cur){
  // la fonction ajoutée (la dernière), sinon celle dont un réglage ou l'esquisse a changé ; une fonction
  // retirée (annulation, suppression) ou une autre pièce ouverte : rien à suivre
  if(!prev||!cur||!cur.doc||prev.doc!==cur.doc)return null;
  for(const id of prev.f.keys())if(!cur.f.has(id))return null; // avant les ajouts : un document rempli à nouveau n'est pas « ajouté »
  const F=(cur.doc.features||[]).filter(f=>f&&f.id&&!f.repeatId);
  const added=F.filter(f=>!prev.f.has(f.id));
  if(added.length)return {f:added[added.length-1],nouv:true};
  const chg=F.find(f=>prev.f.get(f.id)!==cur.f.get(f.id));
  if(chg)return {f:chg,nouv:false};
  const g=F.find(f=>f.sketchId&&prev.s.has(f.sketchId)&&prev.s.get(f.sketchId)!==cur.s.get(f.sketchId));
  return g?{f:g,nouv:false}:null;
}
function ppTreated(F,prev){
  // les arêtes que le congé (ou chanfrein) F vient de traiter, retrouvées dans la lecture d'avant : par leur
  // nom, sinon au plus près du point retenu par la fonction
  const out=[];if(!prev||!F||!Array.isArray(F.edges))return out;
  F.edges.forEach(fe=>{
    if(!fe)return;const k=fe.nom?ppNomKey(fe.nom):null,p=Array.isArray(fe.pos)?fe.pos:null;
    let best=null,bd=Infinity;
    prev.forEach(R=>R.edges.forEach(e=>{
      const byNom=!!(k&&e.nom&&ppNomKey(e.nom)===k),d=p?Math.hypot(e.mid[0]-p[0],e.mid[1]-p[1],e.mid[2]-p[2]):0;
      if(!byNom&&!(p&&d<0.3))return;
      const s=(byNom?0:1e3)+d;if(s<bd){bd=s;best={b:R.id,e};}}));
    if(best&&!out.some(x=>x.e===best.e))out.push(best);
  });
  return out;
}
/* ── les propositions ── */
function ppValTxt(cham,v){return cham?'chanfrein '+ppNum(v):'congé R'+ppNum(v);}
function ppKeep(S){return S.filter(s=>!pp.refus.has(s.key)).sort((a,b)=>b.score-a.score);}
function ppSuggestCtx(Rs,act,prev){
  const S=[];if(!Rs||!Rs.length||!act||!act.f)return S;
  const F=act.f,AX=ppAxes(),B=ppBox(Rs),up=AX[0];
  const all=[];Rs.forEach(R=>R.edges.forEach(e=>{if(e.len>=0.3)all.push({b:R.id,R,e,c:ppCls(e,AX)});}));
  const mine=x=>(x.e.own||[]).includes(F.id),okey=x=>(x.e.own||[]).filter(Boolean).slice().sort().join('|');
  const pick=L=>L.map(x=>({b:x.b,e:x.e}));
  // ── 1. le congé ou le chanfrein que l'on vient de poser : le même sur les arêtes pareilles ──
  if(F.type==='xfillet'){
    const v=+(((F.edges||[])[0])||{}).r,cham=!!F.chamfer;
    const T=ppTreated(F,prev).map(t=>Object.assign(t,{c:ppCls(t.e,AX)}));
    if(!(v>0)||!T.length)return S;
    const t0=T[0],nm0=ppFeatName(ppFeatById(ppMain(t0.e.own)));
    // habitude de la séance : ce genre d'arête reçoit ce congé (ou ce chanfrein)
    const hk=t0.c.conv+' '+t0.c.ori+' '+t0.c.role+' '+(cham?'c':'f');
    pp.habits=[{k:hk,c:t0.c,cham,v,from:nm0}].concat(pp.habits.filter(x=>x.k!==hk)).slice(0,6);
    const same=(t,x)=>t.c.conv===x.c.conv&&t.c.ori===x.c.ori&&t.c.role===x.c.role&&ppSharp(x.e,x.c.conv)
      &&(x.c.ori==='ax'||Math.abs(ppDot(x.e.mid,up)-ppDot(t.e.mid,up))<0.01)
      &&(x.c.ori!=='curve'||Math.abs(x.e.len-t.e.len)<=0.05*t.e.len+0.01);
    const K=new Set(T.map(t=>(t.e.own||[]).filter(Boolean).slice().sort().join('|')));
    const C=all.filter(x=>!mine(x)&&!T.some(t=>t.e===x.e)&&T.some(t=>same(t,x)));
    const here=C.filter(x=>K.has(okey(x))),there=C.filter(x=>!K.has(okey(x)));
    const kind=cham?'chamfer':'fillet',w0=ppMots(t0.c,T.length,t0.e.own);
    if(here.length){const w=ppMots(t0.c,here.length,t0.e.own);
      S.push({key:'meme:'+F.id+':ici',score:3,kind,
        title:'Même '+ppValTxt(cham,v)+' sur '+(here.length>1?'les '+here.length+' autres '+w.many:'l’autre '+w.one),
        why:'Tu viens de le poser sur '+(T.length>1?T.length+' '+w0.many:w0.le)+' de '+nm0+' : '+(here.length>1?'les '+here.length+' autres sont pareils.':'l’autre est pareil.'),
        lines:here.map(x=>x.e.pts),cmds:()=>ppEdgeCmds(kind,pick(here),v)});}
    if(there.length){
      const G=new Map();there.forEach(x=>{const m=ppMain(x.e.own);if(!G.has(m))G.set(m,[]);G.get(m).push(x);});
      const names=[...G.keys()].map(id=>ppFeatName(ppFeatById(id))),w=ppMots(t0.c,there.length,there[0].e.own);
      S.push({key:'meme:'+F.id+':ail',score:2.5,kind,
        title:'Même '+ppValTxt(cham,v)+' sur '+(G.size===1?(there.length>1?'les '+w.txt:w.le)+' de '+names[0]:w.txt+' semblables'),
        why:'Les mêmes arêtes ailleurs sur la pièce : '+names.slice(0,3).join(', ')+(names.length>3?'…':'')+'.',
        lines:there.map(x=>x.e.pts),cmds:()=>ppEdgeCmds(kind,pick(there),v)});
    }
    return ppKeep(S);
  }
  // ── 2. les coins vifs creux de ce que l'on vient de faire, au rayon de la plus petite fraise ──
  const nm=ppFeatName(F),Dm=ppMill(),hIn=pp.habits.find(h=>!h.cham&&h.c.conv==='in'&&h.c.ori==='ax');
  const inner=all.filter(x=>mine(x)&&x.e.line&&x.e.len>=0.5&&x.c.ori==='ax'&&ppSharp(x.e,'in')&&ppReach(x.R.st,x.e,AX,B));
  if(inner.length&&(Dm||hIn)){
    const r0=Dm?Math.ceil(Dm/2*2-1e-9)/2:0,r=hIn&&hIn.v>=r0?hIn.v:r0;
    S.push({key:'coins:'+F.id,score:3,kind:'fillet',title:'Arrondir '+(inner.length>1?'les '+inner.length+' coins':'le coin')+' de '+nm+' · R'+ppNum(r),
      why:hIn&&r===hIn.v&&(r>r0||!Dm)?'Comme les coins de '+hIn.from+(Dm?' ; ta plus petite fraise (Ø'+ppNum(Dm)+') y passe.':'.')
        :'Une fraise ne fait pas de coin vif : ta plus petite (Ø'+ppNum(Dm)+') laissera R'+ppNum(r0)+' dans ces coins.',
      lines:inner.map(x=>x.e.pts),cmds:()=>ppEdgeCmds('fillet',pick(inner),r)});
  }
  // ── 3. les habitudes de la séance, sur ce que l'on vient de faire ──
  pp.habits.forEach(h=>{
    if(h===hIn&&inner.length)return; // déjà dans « Arrondir les coins »
    const L=all.filter(x=>mine(x)&&x.c.conv===h.c.conv&&x.c.ori===h.c.ori&&x.c.role===h.c.role&&ppSharp(x.e,h.c.conv));
    if(!L.length)return;
    const w=ppMots(h.c,L.length,L[0].e.own),kind=h.cham?'chamfer':'fillet';
    S.push({key:'hab:'+F.id+':'+h.k,score:2,kind,
      title:(h.cham?'Chanfrein '+ppNum(h.v):'Congé R'+ppNum(h.v))+' sur '+(L.length>1?'les '+w.txt:w.le)+' de '+nm,
      why:'Comme tu l’as fait sur '+h.from+'.',
      lines:L.map(x=>x.e.pts),cmds:()=>ppEdgeCmds(kind,pick(L),h.v)});
  });
  // ── 4. V1.1.3 : les arêtes vives de ce que l'on vient de faire (Fred, 27/11 : « une esquisse une extrusion »
  //    → « rien ») — arêtes verticales d'un plot, arêtes du dessus (ou du bord d'une poche, entrée des trous),
  //    pied d'un plot posé sur la pièce ; seulement quand ni les coins ni les habitudes n'ont rien à dire
  //    (une poche ne propose toujours que ses coins : pas envahissante) ──
  if(S.length)return ppKeep(S);
  const libre=L=>L.length>0;
  const hole=ppIsHole(F.id); // V1.1.5 : petites valeurs, sans regarder la taille (Fred : « les valeurs sont trop grandes »)
  const outM=all.filter(x=>mine(x)&&x.c.conv==='out'&&ppSharp(x.e,'out'));
  const vert=outM.filter(x=>x.c.ori==='ax'&&x.e.len>=1);
  if(libre(vert)&&!hole){
    const hr=ppHabit(false,5),r=hr||1;
    S.push({key:'plot:'+F.id+':vert',score:1.9,kind:'fillet',
      title:'Arrondir '+(vert.length>1?'les '+vert.length+' arêtes verticales':'l’arête verticale')+' de '+nm+' · R'+ppNum(r),
      why:'Une arête vive blesse et s’abîme'+(hr?' : au rayon de ton dernier congé.':'.'),
      lines:vert.map(x=>x.e.pts),cmds:()=>ppEdgeCmds('fillet',pick(vert),r)});
  }
  const hiOf=x=>Math.max(...x.e.pts.map(p=>ppDot(p,up)));
  const zt=outM.length?Math.max(...outM.map(hiOf)):0;
  const top=outM.filter(x=>x.c.ori!=='ax'&&x.e.pts.every(p=>Math.abs(ppDot(p,up)-zt)<0.01));
  if(libre(top)){
    const v=ppHabit(true,2)||0.5,bord=top.every(x=>x.c.role==='bord');
    const n=top.length,lieu=hole?(n>1?'à l’entrée des '+n+' trous':'à l’entrée du trou'):(n>1?'sur les '+n+' arêtes du '+(bord?'bord':'dessus'):'sur l’arête du '+(bord?'bord':'dessus'));
    S.push({key:'plot:'+F.id+':haut',score:1.8,kind:'chamfer',title:'Chanfrein '+ppNum(v)+' '+lieu+' de '+nm,
      why:'Casser les angles vifs'+(hole?' : le trou s’ouvre sans bavure, la vis entre droit.':' : rien ne coupe, rien ne s’abîme.'),
      lines:top.map(x=>x.e.pts),cmds:()=>ppEdgeCmds('chamfer',pick(top),v)});
  }
  const pied=all.filter(x=>mine(x)&&x.c.conv==='in'&&x.c.ori!=='ax'&&x.c.role==='bord'&&ppSharp(x.e,'in'));
  if(libre(pied)&&!hole){
    const r=ppHabit(false,2)||0.5;
    S.push({key:'plot:'+F.id+':pied',score:1.7,kind:'fillet',
      title:'Congé R'+ppNum(r)+' au pied de '+nm+' ('+pied.length+' arête'+(pied.length>1?'s':'')+')',
      why:'Un congé au pied renforce '+nm+' et évite l’angle vif où la pièce casse.',
      lines:pied.map(x=>x.e.pts),cmds:()=>ppEdgeCmds('fillet',pick(pied),r)});
  }
  return ppKeep(S);
}
function ppTapSize(w){return w<30?'M3':w<60?'M4':w<120?'M6':'M8';}
function ppTopFace(Rs,ztop){
  // la plus grande face plane du dessus (+Z), et le corps qui la porte
  let F=null,R0=null;
  Rs.forEach(R=>R.faces.forEach(f=>{if(f.n&&f.n[2]>0.9999&&Math.abs(f.c[2]-ztop)<2e-3&&(!F||f.s[0]*f.s[1]>F.s[0]*F.s[1])){F=f;R0=R;}}));
  return F&&R0&&R0.st?{F,R:R0,st:R0.st,x0:F.c[0]-F.s[0]/2,x1:F.c[0]+F.s[0]/2,y0:F.c[1]-F.s[1]/2,y1:F.c[1]+F.s[1]/2}:null;
}
function ppHoleOk(st,x,y,ztop,depth,D){
  // de la matière sous l'emplacement, sur toute la profondeur, et tout autour du trou
  for(const z of [ztop-0.3,ztop-depth*0.6,ztop-depth+0.3])if(st([x,y,z])<1)return false;
  for(let k=0;k<8;k++){const a=k/8*2*Math.PI;if(st([x+Math.cos(a)*D*0.9,y+Math.sin(a)*D*0.9,ztop-0.3])<1)return false;}
  return true;
}
/* ── calcul en fond, quand tout est calme ── */
function ppCalm(){
  try{
    if(typeof rebuildDepth!=='undefined'&&rebuildDepth>0)return false;
    if(typeof skEdit!=='undefined'&&skEdit)return false;
    if(typeof fondEnCours==='function'&&fondEnCours())return false;
    if(typeof buildKeyUpToDate==='function'&&!buildKeyUpToDate())return false;
    if(typeof pcCalme==='function'&&!pcCalme())return false;
  }catch(e){return false;}
  return true;
}
function ppSigOf(){
  const B=ppBodies();
  let s='';try{s=B.map(b=>b.id+':'+(b.mesh&&b.mesh.geometry?b.mesh.geometry.uuid:'')).join('|');}catch(e){}
  let t='';try{t=JSON.stringify([ppAxes(),ppMill(),ppHabit(true,2),ppHabit(false)]);}catch(e){}
  return s+'#'+t;
}
function ppTick(now){
  // V1.1.5 : état de départ pris dès qu'un document est vu (Nouveau, ouverture), pas au premier calcul :
  // sinon la 1re fonction d'une pièce neuve n'avait pas de suite (Fred, 27/11 : « à la 2nd extrusion »)
  try{if(now-pp.sigT>PP_SIG_MS&&(!pp.base||pp.base.doc!==doc))pp.base=ppSnapBase();}catch(e){}
  if(now-pp.sigT>PP_SIG_MS){pp.sigT=now;const s=ppSigOf();if(s!==pp.want){pp.want=s;pp.wantT=now;pp.focus=-1;pp.hover=-1;
    if(pp.req){pp.req.items=[];pp.req.stale=true;}pp.list=[];pp.all=[];ppStripSync();}}
  // demande écrite ouverte : refaite sur la pièce modifiée
  if(pp.req&&pp.req.stale&&!pp.req.busy&&now-pp.wantT>=PP_CALME&&ppCalm()){pp.req.stale=false;ppAsk(pp.req.text);}
  if(!pp.on||pp.want===pp.sig||pp.busy||now-pp.wantT<PP_CALME||!ppCalm())return;
  // ce que l'on vient de faire : comparé à l'état de la lecture précédente
  const cur=ppSnapBase(),act=ppAction(pp.base,cur),prev=pp.prevRead;pp.base=cur;
  if(!ppBodies().length){pp.sig=pp.want;pp.all=[];pp.prevRead=null;ppListSync();return;}
  const gen=++pp.gen,want=pp.want,t0=ppNow();pp.busy=true;
  ppRead(gen).then(Rs=>{
    if(!Rs||gen!==pp.gen)return;
    try{pp.all=ppSuggestCtx(Rs,act,prev);pp.act=act;}
    finally{Rs.forEach(R=>{try{R.st&&R.st.free();}catch(e){}R.st=null;});}
    pp.prevRead=Rs;pp.sig=want;pp.ms=ppNow()-t0;ppListSync();
  }).catch(e=>{pp.sig=want;pp.all=[];pp.prevRead=null;ppSay('Lecture de la pièce impossible : '+(e&&e.message||e),false);ppListSync();})
    .finally(()=>{if(gen===pp.gen){pp.busy=false;ppStripSync();ppWake();}});
}
function ppListSync(){
  if(pp.req)pp.list=pp.req.items;
  else pp.list=pp.on?pp.all.filter(s=>!pp.refus.has(s.key)).slice(0,PP_MAX):[];
  if(pp.focus>=pp.list.length)pp.focus=-1;
  if(pp.hover>=pp.list.length)pp.hover=-1;
  ppStripSync();ppWake();
}
function ppWake(){try{if(typeof viewWake==='function')viewWake();}catch(e){}}
function ppSay(t,ok){pp.msg=t;pp.msgOk=ok!==false;pp.msgT=ppNow();}
/* ── faire, ne pas faire ── */
function ppAccept(i){
  const s=pp.list[i];if(!s)return false;
  let r=null;try{r=mfScriptRun(s.cmds());}catch(e){r={ok:false,error:String(e&&e.message||e)};}
  const ok=!!(r&&r.ok);
  ppSay(ok?'Fait : '+s.title+' · Ctrl+Z pour revenir':'Refusé : '+((r&&r.error)||'erreur'),ok);
  if(ok){pp.list=[];pp.all=[];pp.focus=pp.hover=-1;pp.sig='';pp.want='';pp.sigT=0;
    if(pp.req){pp.req=null;pp.askOpen=false;if(pp.ask){pp.ask.value='';try{pp.ask.blur();}catch(e){}}}} // refusé : la pièce n'a pas bougé, les propositions restent
  ppStripSync();ppWake();
  return ok;
}
function ppRefuse(){
  // « Non merci » : ces propositions ne reviennent plus pour cette fonction
  pp.list.forEach(s=>pp.refus.add(s.key));pp.all=pp.all.filter(s=>!pp.refus.has(s.key));
  pp.list=[];pp.focus=pp.hover=-1;pp.msg='';ppStripSync();ppWake();
}
function ppTyping(){
  const a=typeof document!=='undefined'?document.activeElement:null;
  return !!(a&&(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable));
}
function ppKey(e){
  if(ppWs()!=='cao')return;
  if(e.key==='Escape'&&pp.menuOpen){e.preventDefault();e.stopPropagation();ppMenuShow(false);return;}
  if(e.key==='/'&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!ppTyping()&&!(typeof skEdit!=='undefined'&&skEdit)){e.preventDefault();e.stopPropagation();ppAskOpen();return;}
  if(e.key==='Escape'&&pp.req&&!pp.list.length){const a=typeof document!=='undefined'?document.activeElement:null;if(!(a&&a.id==='ppAsk'))ppAskClose();return;}
  if(!pp.list.length)return;
  if(e.ctrlKey||e.altKey||e.metaKey)return;
  try{if(typeof skEdit!=='undefined'&&skEdit)return;}catch(x){}
  if(ppTyping())return;
  if(/^[1-9]$/.test(e.key)&&+e.key<=pp.list.length){e.preventDefault();e.stopPropagation();ppAccept(+e.key-1);return;}
  if(e.key==='Tab'){e.preventDefault();e.stopPropagation();const n=pp.list.length;pp.focus=pp.focus<0?(e.shiftKey?n-1:0):(pp.focus+(e.shiftKey?n-1:1))%n;pp.visT=0;ppStripSync();ppWake();return;}
  if(e.key==='Enter'&&pp.focus>=0){e.preventDefault();e.stopPropagation();ppAccept(pp.focus);return;}
  if(e.key==='Escape'){if(pp.focus>=0){pp.focus=-1;ppStripSync();}else if(pp.req)ppAskClose();else ppRefuse();ppWake();}
}
/* ══ Étape 2 — LA DEMANDE ÉCRITE : « 4 trous M6 à 10 du bord » → placements dessinés en fantôme ══
   Lue sur place (aucun service extérieur) : trous, taraudages, congés, chanfreins, avec leur nombre,
   leur Ø ou filetage, la profondeur, la distance au bord, l'endroit (coins, centre, dessus, intérieur,
   extérieur, partout). Les trous vont sur la plus grande face plane du dessus (+Z) ; chaque placement
   possible (aux coins, au milieu des côtés, en cercle, en ligne…) est contrôlé dans la matière et
   proposé ; 1, 2, 3 ou un clic choisit. */
const PP_EX=['4 trous M6 à 10 du bord','2 trous Ø8 traversants','congés R2 sur les arêtes extérieures','chanfrein 0,5 sur le dessus','congés dans les coins intérieurs'];
const PP_NB={un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,dix:10,douze:12};
function ppTxt(t){
  return String(t||'').replace(/[øØ⌀]/g,' diam ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/(\d),(\d)/g,'$1.$2').replace(/[×]/g,'x').replace(/\s+/g,' ').trim();
}
function ppParse(text){
  const t=' '+ppTxt(text)+' ',f=re=>{const m=t.match(re);return m?parseFloat(m[1]):null;};
  if(!t.trim())return {err:'Écris ce que tu veux faire.'};
  let n=f(/ (\d+) ?(?:x )?(?:trous?|percages?|taraudages?|lamages?|congés?|conges?|chanfreins?)/);
  if(n==null){const w=t.match(/ (un|une|deux|trois|quatre|cinq|six|sept|huit|dix|douze) /);if(w)n=PP_NB[w[1]];}
  const where=/ (?:au )?(?:centre|milieu) | en cercle /.test(t)?'centre':/ coins? /.test(t)&&!/ coins? (?:interieur|vif|creux)/.test(t)?'coins':null;
  if(/ (?:trous?|percages?|taraud|lamages?) /.test(t)||/ taraud/.test(t)||/ m\d/.test(t)){
    const m=t.match(/ m ?(\d+(?:\.\d+)?)(?: ?x ?\d+(?:\.\d+)?)? /);
    let thread=m?'M'+String(+m[1]).replace('.',','):null;
    if(thread&&typeof isoThread==='function'&&!isoThread(thread)){const t2='M'+(+m[1]);thread=isoThread(t2)?t2:thread;}
    if(thread&&typeof isoThread==='function'&&!isoThread(thread))return {err:'Filetage « '+thread+' » inconnu (M3, M4, M5, M6, M8, M10…).'};
    const d=f(/ diam(?:etre)? ?(?:de )?(\d+(?:\.\d+)?)/)??f(/ d ?(\d+(?:\.\d+)?) /);
    const through=/ (?:traversants?|debouchants?|de part en part|traverse)/.test(t);
    const depth=f(/ prof(?:ondeur|\.)? ?(?:de )?(\d+(?:\.\d+)?)/)??f(/ (\d+(?:\.\d+)?) ?(?:mm )?de (?:profondeur|profond)/);
    const e=f(/ a (\d+(?:\.\d+)?) ?(?:mm )?(?:du|des|de) (?:bords?|cotes?|l.?arete)/);
    const tap=/ taraud/.test(t);
    if(!thread&&!(d>0)&&!tap)return {err:'Quel Ø ou quel filetage ? Par exemple « 4 trous Ø8 » ou « 2 taraudages M6 ».'};
    if(n==null)n=where==='centre'?1:(/ trou |percage |taraudage |lamage /.test(t)&&!/ trous /.test(t)?1:4);
    if(!(n>=1&&n<=24))return {err:'Entre 1 et 24 trous à la fois.'};
    return {kind:'holes',n:Math.round(n),thread,tap,d,through,depth,e,where};
  }
  const target=/ (?:interieur|creux|coins? vif|dans les coins|dans la poche)/.test(t)?'in'
    :/ (?:exterieur|verticale|autour|contour)/.test(t)?'out':/ (?:dessus|haut|face superieure)/.test(t)?'top':/ (?:partout|toutes|tout) /.test(t)?'all':null;
  if(/ (?:conges?|arrondis?|arrondir|raccord)/.test(t)){
    const r=f(/ r ?(\d+(?:\.\d+)?)/)??f(/ rayon (?:de )?(\d+(?:\.\d+)?)/)??f(/ (\d+(?:\.\d+)?) ?mm/);
    if(r!=null&&!(r>0))return {err:'Rayon > 0 attendu.'};
    return {kind:'fillet',r,target};
  }
  if(/ (?:chanfreins?|chanfreiner|casser les (?:angles|aretes)|ebavurer)/.test(t)){
    const d=f(/ (\d+(?:\.\d+)?) ?(?:mm )?x ?45/)??f(/ chanfreins? (?:de )?(\d+(?:\.\d+)?)/)??f(/ (\d+(?:\.\d+)?) ?mm/);
    if(d!=null&&!(d>0))return {err:'Distance > 0 attendue.'};
    return {kind:'chamfer',d,target};
  }
  return {err:'Je ne sais pas encore faire « '+String(text).trim()+' ». Je comprends les trous, taraudages, congés et chanfreins :',ex:true};
}
function ppLayouts(T,n,e,where){
  // emplacements possibles de n trous sur la face T, à e du bord ; le plus courant d'abord
  const x0=T.x0+e,x1=T.x1-e,y0=T.y0+e,y1=T.y1-e,cx=(T.x0+T.x1)/2,cy=(T.y0+T.y1)/2,long=(T.x1-T.x0)>=(T.y1-T.y0);
  const ring=(k,lab)=>{const rr=Math.min(T.x1-T.x0,T.y1-T.y0)/2-e;if(!(rr>0))return null;
    const P=[];for(let i=0;i<k;i++){const a=Math.PI/2+i/k*2*Math.PI;P.push([cx+rr*Math.cos(a),cy+rr*Math.sin(a)]);}
    return {pts:P,lab:lab||('en cercle Ø'+ppNum(2*rr)),edge:false};};
  const line=k=>{const P=[];for(let i=0;i<k;i++){const u=k>1?i/(k-1):0.5;P.push(long?[x0+u*(x1-x0),cy]:[cx,y0+u*(y1-y0)]);}return {pts:P,lab:'en ligne au milieu',edge:true};};
  const corners={pts:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],lab:'aux coins',edge:true};
  const mid4={pts:[[cx,y0],[x1,cy],[cx,y1],[x0,cy]],lab:'au milieu des côtés',edge:true};
  const L=[];
  if(n===1)L.push({pts:[[cx,cy]],lab:'au centre',edge:false});
  else if(where==='centre')L.push(ring(n,null));
  if(n===2){L.push({pts:[[x0,y0],[x1,y1]],lab:'en diagonale',edge:true});L.push({pts:long?[[x0,cy],[x1,cy]]:[[cx,y0],[cx,y1]],lab:'au milieu des petits côtés',edge:true});}
  else if(n===3){L.push(line(3));L.push(ring(3));}
  else if(n===4){L.push(corners);L.push(mid4);}
  else if(n===6){L.push({pts:long?[[x0,y0],[cx,y0],[x1,y0],[x0,y1],[cx,y1],[x1,y1]]:[[x0,y0],[x0,cy],[x0,y1],[x1,y0],[x1,cy],[x1,y1]],lab:'3 × 2 le long des bords',edge:true});L.push(ring(6));}
  else if(n===8){L.push({pts:corners.pts.concat(mid4.pts),lab:'aux coins et au milieu des côtés',edge:true});L.push(ring(8));}
  else if(n>1){L.push(ring(n));L.push(line(n));}
  if(where==='coins'&&n!==4&&n!==2)L.unshift({pts:corners.pts.slice(0,n),lab:'aux coins',edge:true});
  return L.filter(Boolean);
}
function ppReqItems(q,Rs){
  if(!Rs||!Rs.length)return {err:'Pas encore de pièce.'};
  const AX=ppAxes(),up=AX[0],B=ppBox(Rs);
  const ztop=Math.max(...Rs.map(R=>Math.max(-Infinity,...R.edges.map(e=>ppDot(e.mid,up)))));
  if(q.kind==='holes'){
    if(Math.abs(up[2]-1)>1e-6)return {err:'Je pose les trous sur le dessus (+Z) seulement pour l’instant.'};
    const T=ppTopFace(Rs,ztop);if(!T)return {err:'Pas de face plane sur le dessus de la pièce.'};
    const thread=q.thread||(q.tap&&!(q.d>0)?ppTapSize(Math.min(T.F.s[0],T.F.s[1])):null);
    const th=thread&&typeof isoThread==='function'?isoThread(thread):null,D=th?+th[1]:+q.d;
    if(!(D>0))return {err:'Quel Ø ?'};
    const e=q.e!=null?q.e:Math.max(5,Math.ceil(1.6*D/5)*5);
    const H=ztop-B.lo[2],through=q.through||(!thread&&q.depth==null);
    const depth=through?H:(q.depth!=null?q.depth:Math.round(2.5*D));
    if(!through&&depth>=H-1e-6)return {err:'Profondeur '+ppNum(depth)+' : la pièce ne fait que '+ppNum(H)+' d’épaisseur ici (écris « traversant »).'};
    const chk=Math.min(depth,3*D);
    const what=thread?'taraudage'+(q.n>1?'s':'')+' '+thread:'trou'+(q.n>1?'s':'')+' Ø'+ppNum(D);
    const why=(thread?'taraudé '+thread+', ':'Ø'+ppNum(D)+', ')+(through?'traversant':'profondeur '+ppNum(depth));
    // distance au bord : celle demandée, sinon la plus proche de l'habituelle où chaque placement tient
    // (dessus en cadre autour d'une poche : les trous se recentrent sur le cadre)
    let EL=[e];
    if(q.e==null){const c=[1.5*D,2*D,D+2,2.5*D,3*D,4*D,D/2+1.5,0.75*D+1].map(v=>Math.round(v*2)/2).filter(v=>v>=D/2+1);
      EL=[...new Set([e].concat(c))].sort((a,b)=>Math.abs(a-e)-Math.abs(b-e));}
    const found=[],seen=new Set();
    for(const ee of EL){
      ppLayouts(T,q.n,ee,q.where).forEach((Ly,li)=>{
        if(found[li]||Ly.pts.length!==q.n)return;
        const key=Ly.pts.map(p=>p.map(v=>v.toFixed(2)).join(',')).sort().join(';');if(seen.has(key))return;
        if(!Ly.pts.every(p=>ppHoleOk(T.st,p[0],p[1],ztop,chk,D)))return;
        seen.add(key);found[li]=Object.assign({e:ee,key},Ly);
      });
    }
    const items=[];
    found.filter(Boolean).forEach(Ly=>{
      const P=Ly.pts,key=Ly.key,e=Ly.e;
      const hole={op:'hole',sketch:'ppQ'};if(thread)hole.thread=thread;else hole.d=+D;
      if(through)hole.through=true;else hole.depth=+depth;
      items.push({key:'req:'+key,kind:'hole',title:q.n+' '+what+' '+Ly.lab+(Ly.edge?', à '+ppNum(e)+' du bord':''),why,
        lines:P.map(p=>ppCircle([p[0],p[1],ztop],[0,0,1],D/2,28)),
        cmds:()=>[{op:'sketch',id:'ppQ',name:(thread?'Taraudages ':'Trous ')+(thread||'Ø'+ppNum(D)),plane:'XY',offset:+ztop.toFixed(4),shapes:P.map(p=>({hole:[+p[0].toFixed(4),+p[1].toFixed(4)]}))},hole]});
    });
    if(!items.length)return {err:'Pas la place pour '+q.n+' '+what+(q.e!=null?' à '+ppNum(e)+' du bord':'')+' sur le dessus'+(q.where==='centre'?' autour du centre':'')+' : essaie un autre nombre'+(q.e!=null?' ou une autre distance':'')+'.'};
    return {items:items.slice(0,PP_MAX)};
  }
  // congés et chanfreins : les arêtes de la pièce, triées comme la suite probable
  const isAx=d=>d&&AX.some(z=>Math.abs(ppDot(d,z))>0.9995),isAxP=d=>d&&AX.slice(0,AX.nPos||AX.length).some(z=>Math.abs(ppDot(d,z))>0.9995);
  const sets={in:[],out:[],top:[],all:[]};
  Rs.forEach(R=>R.edges.forEach(e=>{
    if(ppSharp(e,'in')&&e.line&&e.len>=0.5&&isAx(e.dir)&&ppReach(R.st,e,AX,B))sets.in.push({b:R.id,e});
    if(ppSharp(e,'out')){
      sets.all.push({b:R.id,e});
      if(e.line&&e.len>=1&&isAxP(e.dir))sets.out.push({b:R.id,e});
      if(e.pts.every(p=>Math.abs(ppDot(p,up)-ztop)<2e-3))sets.top.push({b:R.id,e});
    }}));
  const NOM={in:['dans les ','coins intérieurs','le coin intérieur'],out:['sur les ','arêtes extérieures','l’arête extérieure'],top:['sur les ','arêtes vives du dessus','l’arête vive du dessus'],all:['sur les ','arêtes vives','l’arête vive']};
  const cham=q.kind==='chamfer',Dm=ppMill();
  const order=q.target?[q.target]:(cham?['top','all']:['in','out','all']);
  const items=[];
  order.forEach(k=>{
    const L=sets[k];if(!L.length)return;
    const v=cham?(q.d||ppHabit(true,2)||(Math.hypot(...B.size)<80?0.5:1)):(q.r||(k==='in'&&Dm?Math.ceil(Dm/2*2-1e-9)/2:(ppHabit(false,5)||1)));
    const N=NOM[k],lab=L.length>1?N[0]+L.length+' '+N[1]:(N[0]==='dans les '?'dans ':'sur ')+N[2];
    items.push({key:'req:'+k+':'+v,kind:cham?'chamfer':'fillet',title:(cham?'Chanfrein '+ppNum(v)+' × 45° ':'Congés R'+ppNum(v)+' ')+lab,
      why:(k==='in'&&!cham&&!q.r&&Dm?'le rayon de ta fraise Ø'+ppNum(Dm):L.length+' arête'+(L.length>1?'s':'')),
      lines:L.map(x=>x.e.pts),cmds:()=>ppEdgeCmds(cham?'chamfer':'fillet',L,v)});
  });
  if(!items.length)return {err:q.target?'Aucune arête vive '+({in:'dans les coins intérieurs',out:'extérieure dans l’axe de l’outil',top:'sur le dessus',all:''}[q.target]||'')+' : rien à faire ici.':'Aucune arête vive sur la pièce.'};
  return {items:items.slice(0,PP_MAX)};
}
async function ppAsk(text){
  text=String(text||'').trim();
  if(!text){ppReqClose();return;}
  const q=ppParse(text),tok=++pp.reqGen;
  pp.req={text,items:[],busy:!q.err,err:q.err||null,ex:!!q.ex};pp.focus=-1;pp.hover=-1;pp.msg='';ppListSync();
  if(q.err)return;
  let Rs=null,res=null;
  try{
    Rs=await ppRead(tok,()=>pp.reqGen);
    if(!Rs||tok!==pp.reqGen||!pp.req)return;
    res=ppReqItems(q,Rs);
  }catch(e){res={err:'Lecture de la pièce impossible : '+(e&&e.message||e)};}
  finally{if(Rs)Rs.forEach(R=>{try{R.st&&R.st.free();}catch(e){}});}
  if(tok!==pp.reqGen||!pp.req)return;
  pp.req.busy=false;pp.req.items=res.items||[];pp.req.err=res.err||null;
  ppListSync();
}
function ppReqClose(){pp.reqGen++;pp.req=null;pp.focus=-1;pp.hover=-1;ppListSync();}
/* ══ Étape 3 — LES FUTURS PARALLÈLES : deux variantes vivantes, chiffrées côte à côte ══
   « Essayer une variante » met la pièce telle qu'elle est de côté (A) et l'on continue sur une copie
   (B). Les deux restent chiffrées (masse) ; un clic montre l'une ou l'autre (chacune
   garde son historique d'annulation) ; « Garder A / B » oublie l'autre ; « Garder les deux » laisse
   la variante affichée dans ce document et enregistre l'autre dans son propre fichier. Rien n'est
   ajouté au document : la variante de côté ne vit qu'en mémoire jusqu'au choix. */
const PP_VCOL={A:'#6ea8ff',B:'#ff8a3d'};
function ppMass(){
  // masse des corps visibles : matériau du corps, sinon aluminium
  let g=0,alu=false;
  try{ppBodies().forEach(b=>{let id=b.id;try{if(typeof bodyIdOfRuntime==='function')id=bodyIdOfRuntime(b);}catch(e){}
    let rho=0;try{const m=typeof matDef==='function'&&matDef(bodyMatOf(id));rho=m&&m.rho;}catch(e){}
    if(!(rho>0)){rho=2.7;alu=true;}
    let v=0;try{v=meshVolumeMm3(b.mesh);}catch(e){}
    g+=v/1000*rho;});}catch(e){}
  return {g,alu};
}
function ppMassTxt(m){if(!m||!(m.g>0))return '—';try{return fmtMasse(m.g);}catch(e){return ppNum(m.g/1000)+' kg';}}
function ppFeatVals(f){
  // valeurs comparables d'une fonction : nombres du premier niveau, rayon / distance de ses arêtes
  const o={};if(!f)return o;
  Object.keys(f).forEach(k=>{if(k[0]==='_'||k==='id')return;const v=f[k];if(typeof v==='number'&&isFinite(v))o[k]=v;else if(typeof v==='string'&&k!=='name'&&v.length<20)o[k]=v;else if(typeof v==='boolean')o[k]=v;});
  if(Array.isArray(f.edges)&&f.edges.length&&isFinite(+f.edges[0].r))o.r=+f.edges[0].r;
  if(f.thread&&f.thread.size)o.thread=f.thread.size;
  return o;
}
const PP_CHAMP={distance:'',depth:'prof. ',d:'Ø',r:'R',angle:'',thick:'ép. ',copies:'× ',dist:'pas ',thread:'',cbD:'lamage Ø',tip:'pointe '};
function ppDiff(a,b){
  // ce qui distingue deux états du document, en mots courts : [pour A, pour B]
  const A=[],B=[];
  try{
    const fa=new Map((a.features||[]).filter(f=>f&&!f.repeatId).map(f=>[f.id,f])),fb=new Map((b.features||[]).filter(f=>f&&!f.repeatId).map(f=>[f.id,f]));
    const nm=f=>String(f.name||f.type||'fonction').replace(/\s*\(.*$/,'').slice(0,28);
    const fmt=(k,v)=>typeof v==='number'?(PP_CHAMP[k]!=null?PP_CHAMP[k]:k+' ')+ppNum(Math.abs(v))+(k==='angle'?'°':(k==='copies'?'':' mm')):String(v);
    // valeurs changées (dans l'ordre de l'historique)
    fb.forEach((f,id)=>{const g=fa.get(id);if(!g||A.length>=2)return;
      const va=ppFeatVals(g),vb=ppFeatVals(f);
      const k=Object.keys(Object.assign({},va,vb)).find(k=>k!=='visible'&&va[k]!==vb[k]&&(typeof va[k]==='number'||typeof vb[k]==='number'||k==='thread'));
      if(k){A.push(nm(f)+' : '+fmt(k,va[k]));B.push(nm(f)+' : '+fmt(k,vb[k]));}
      else if((g.visible!==false)!==(f.visible!==false)){A.push(nm(f)+(g.visible===false?' supprimée':''));B.push(nm(f)+(f.visible===false?' supprimée':''));}});
    // cotes d'esquisse
    const sa=new Map((a.sketches||[]).map(k=>[k.id,k]));
    (b.sketches||[]).forEach(k=>{const j=sa.get(k.id);if(!j||A.length>=2)return;
      (k.dims||[]).some((d,i)=>{const e=(j.dims||[])[i];if(e&&isFinite(+d.value)&&isFinite(+e.value)&&Math.abs(+d.value-+e.value)>1e-9){
        const n=(d.name||k.name||'cote');A.push(n+' '+ppNum(+e.value));B.push(n+' '+ppNum(+d.value));return true;}return false;});});
    // paramètres
    const pa=new Map((a.params||[]).map(q=>[q.name,q]));
    (b.params||[]).forEach(q=>{const r=pa.get(q.name);if(r&&A.length<2&&String(r.expr)!==String(q.expr)){A.push(q.name+' = '+r.expr);B.push(q.name+' = '+q.expr);}});
    // fonctions en plus ou en moins
    const plus=[...fb.keys()].filter(id=>!fa.has(id)).map(id=>nm(fb.get(id))),moins=[...fa.keys()].filter(id=>!fb.has(id)).map(id=>nm(fa.get(id)));
    if(plus.length){B.push('+ '+plus[0]+(plus.length>1?' et '+(plus.length-1)+' autre'+(plus.length>2?'s':''):''));A.push('sans '+plus[0]+(plus.length>1?'…':''));}
    if(moins.length){A.push('+ '+moins[0]+(moins.length>1?' et '+(moins.length-1)+' autre'+(moins.length>2?'s':''):''));B.push('sans '+moins[0]+(moins.length>1?'…':''));}
  }catch(e){}
  if(!A.length)return ['identique','identique pour l’instant'];
  return [A.slice(0,2).join(' · '),B.slice(0,2).join(' · ')];
}
function ppVarStart(){
  if(pp.var)return;
  const snap=typeof docSnap==='function'?docSnap():null;if(!snap)return;
  const m={mass:ppMass()};
  pp.var={doc,live:'B',A:{snap,undo:docUndoStack.slice(),redo:docRedoStack.slice(),m:Object.assign({},m)},B:{snap:null,m:Object.assign({},m)},labels:['identique','identique pour l’instant'],labT:0};
  pp.msg='A est gardée de côté : modifie la pièce, c’est la variante B.';pp.msgOk=true;pp.msgT=ppNow();
  ppVarSync();ppStripSync();
}
function ppVarLiveObj(){try{return docSnapObj();}catch(e){return doc;}}
function ppVarLabels(){
  const V=pp.var;if(!V)return;
  try{const other=V.live==='A'?'B':'A',o=JSON.parse(V[other].snap),cur=ppVarLiveObj();
    const L=V.live==='B'?ppDiff(o,cur):ppDiff(cur,o);V.labels=L;}catch(e){}
}
function ppVarTick(now){
  const V=pp.var;if(!V)return;
  if(V.doc!==doc){pp.var=null;ppVarSync();return;} // autre pièce ouverte : la variante de côté n'a plus de sens
  if(now-V.labT<500||!ppCalm())return;
  V.labT=now;
  V[V.live].m.mass=ppMass();
  ppVarLabels();ppVarSync();
}
function ppVarShow(k){
  const V=pp.var;if(!V||k===V.live||!V[k].snap)return false;
  const cur=docSnap();if(!cur)return false;
  const from=V.live;
  V[from].snap=cur;V[from].undo=docUndoStack.slice();V[from].redo=docRedoStack.slice();
  if(!docApplySnap(V[k].snap))return false;
  docUndoStack=V[k].undo||[];docRedoStack=V[k].redo||[];V[k].snap=null;V.live=k;
  try{docUndoUI();}catch(e){}
  pp.msg='Variante '+k+' affichée.';pp.msgOk=true;pp.msgT=ppNow();
  pp.sig='';pp.want='';pp.sigT=0;ppVarLabels();ppVarSync();ppStripSync();ppWake();
  return true;
}
function ppVarKeep(k){
  const V=pp.var;if(!V)return false;
  if(k!==V.live&&!ppVarShow(k))return false;
  const other=k==='A'?'B':'A';
  pp.var=null;pp.msg='Variante '+k+' gardée, '+other+' oubliée.';pp.msgOk=true;pp.msgT=ppNow();
  ppVarSync();ppStripSync();return true;
}
async function ppVarKeepBoth(){
  const V=pp.var;if(!V)return false;
  const other=V.live==='A'?'B':'A';
  let ok=false;
  try{
    const d=JSON.parse(V[other].snap);
    const txt=JSON.stringify(serialiseObj(d,false),null,2),bad=mffCheckData(txt);if(bad)throw new Error(bad);
    const name=String((typeof mffName!=='undefined'&&mffName)||doc.name||'piece').replace(/[\\/:*?"<>|]/g,'_')+' — variante '+other+'.conceptcad';
    const data=await mffPack(txt);
    if(typeof window!=='undefined'&&window.showSaveFilePicker){
      try{const h=await window.showSaveFilePicker({suggestedName:name,types:MFF_TYPES});const w=await h.createWritable();await w.write(mffBlob(data));await w.close();ok=h.name;}
      catch(e){if(e&&e.name==='AbortError'){pp.msg='Enregistrement annulé : les deux variantes restent ici.';pp.msgOk=false;pp.msgT=ppNow();ppStripSync();return false;}throw e;}
    }else{const a=document.createElement('a');a.href=URL.createObjectURL(mffBlob(data));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);ok=name;}
  }catch(e){pp.msg='Variante '+other+' non enregistrée : '+(e&&e.message||e);pp.msgOk=false;pp.msgT=ppNow();ppStripSync();return false;}
  pp.var=null;pp.msg='Variante '+V.live+' gardée ici, variante '+other+' enregistrée dans « '+ok+' ».';pp.msgOk=true;pp.msgT=ppNow();
  ppVarSync();ppStripSync();return true;
}
function ppVarHtml(){
  const V=pp.var;if(!V)return '';
  const row=k=>{const m=V[k].m||{},live=V.live===k,lab=V.labels[k==='A'?0:1];
    return '<div class="vr'+(live?' live':'')+'" style="--c:'+PP_VCOL[k]+'"><span class="vk">'+k+'</span><span class="vl"><b title="'+ppEsc(lab)+'">'+ppEsc(lab)+'</b>'
      +'<span class="vn">'+ppEsc(ppMassTxt(m.mass))+(m.mass&&m.mass.alu?' <i>alu</i>':'')+'</span><small>'+(live?'affichée':'de côté')+'</small></span>'
      +(live?'':'<button type="button" class="vs" data-v="show'+k+'" title="Montrer la variante '+k+'">Voir</button>')+'</div>';};
  return '<div class="vh"><span>Deux variantes</span><small>Tu modifies la variante affichée ; l’autre reste de côté.</small></div>'+row('A')+row('B')
    +'<div class="vb"><button type="button" data-v="keepA" style="--c:'+PP_VCOL.A+'">Garder A</button><button type="button" data-v="keepB" style="--c:'+PP_VCOL.B+'">Garder B</button><button type="button" data-v="both" title="La variante affichée reste dans ce document ; l’autre est enregistrée dans son propre fichier">Les deux</button></div>';
}
function ppVarSync(){
  const P=pp.varEl;if(!P)return;
  const h=ppVarHtml();if(P.dataset.h!==h){P.dataset.h=h;P.innerHTML=h;P.classList.toggle('on',!!pp.var);}
}
function ppVarClick(ev){
  const b=ev.target&&ev.target.closest?ev.target.closest('button[data-v]'):null;if(!b)return;
  ev.stopPropagation();const v=b.dataset.v;
  if(v==='start')ppVarStart();else if(v==='showA')ppVarShow('A');else if(v==='showB')ppVarShow('B');
  else if(v==='keepA')ppVarKeep('A');else if(v==='keepB')ppVarKeep('B');else if(v==='both')ppVarKeepBoth();
}
/* ── le fantôme : seulement la proposition survolée (ou choisie au clavier) ; toutes celles d'une demande ── */
function ppCanvas(){try{return renderer&&renderer.domElement;}catch(e){return null;}}
function ppGhostSync(now){
  const S=pp.svg;if(!S)return;
  const sel=pp.hover>=0?pp.hover:pp.focus;
  const show=pp.req?pp.list.map((g,i)=>i):(sel>=0&&pp.list[sel]?[sel]:[]);
  if(!show.length){if(S.dataset.h){S.innerHTML='';S.dataset.h='';}return;}
  const c=ppCanvas(),W=c.clientWidth,H=c.clientHeight,v=new THREE.Vector3();
  const scr=p=>{v.set(p[0],p[1],p[2]).project(camera);return [(v.x+1)/2*W,(1-v.y)/2*H,v.z];};
  const key=show.join(',');
  if(!(now-pp.visT<250)||pp.visK!==key){ // ce que la pièce cache, relu au plus 4 fois par seconde
    pp.visT=now;pp.visK=key;
    const rc=new THREE.Raycaster(),cp=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const M=ppBodies().map(b=>b.mesh).filter(Boolean);
    show.forEach(i=>{const s=pp.list[i];s.hid=s.lines.map(P=>{const m=P[Math.floor(P.length/2)],t=new THREE.Vector3(m[0],m[1],m[2]),d=t.clone().sub(cp),D=d.length();
      rc.set(cp,d.normalize());rc.far=Math.max(0,D-0.4);let h=[];try{h=rc.intersectObjects(M,true);}catch(e){}return h.length>0;});});
  }
  let s='',badges='';const placed=[];
  show.forEach(i=>{
    const g=pp.list[i],cls='g'+(!pp.req||sel<0?'':sel===i?' on':' off');let d='',dh='';const mids=[],hm=[];
    g.lines.forEach((P,j)=>{
      let q='';let ok=true;
      for(let k=0;k<P.length;k++){const a=scr(P[k]);if(a[2]>1){ok=false;break;}q+=(k?'L':'M')+a[0].toFixed(1)+' '+a[1].toFixed(1);}
      if(!ok)return;
      const m=scr(P[Math.floor(P.length/2)]);
      if(g.hid&&g.hid[j]){dh+=q;hm.push(m);}else{d+=q;mids.push(m);}
    });
    if(dh)s+='<path class="'+cls+' hid" d="'+dh+'"/>';
    if(d)s+='<path class="'+cls+' band" d="'+d+'"/><path class="'+cls+' dash" d="'+d+'"/>';
    // pastille : sur le trait vu le plus proche du milieu du fantôme (pas dans le vide entre ses traits)
    const Q=mids.length?mids:hm;
    if(Q.length){const cx=Q.reduce((a,m)=>a+m[0],0)/Q.length,cy=Q.reduce((a,m)=>a+m[1],0)/Q.length;
      let bm=Q[0],bd=Infinity;Q.forEach(m=>{const dd=Math.hypot(m[0]-cx,m[1]-cy)+(placed.some(p=>Math.hypot(p[0]-m[0]-16,p[1]-m[1]+16)<28)?1e4:0);if(dd<bd){bd=dd;bm=m;}});
      let x=bm[0]+16,y=bm[1]-16;
      for(let t=0;t<6&&placed.some(p=>Math.hypot(p[0]-x,p[1]-y)<28);t++)y+=28;
      placed.push([x,y]);x=Math.min(W-14,Math.max(14,x));y=Math.min(H-14,Math.max(14,y));
      badges+='<g class="b'+(sel===i?' on':'')+'"><circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="12"/><text x="'+x.toFixed(1)+'" y="'+(y+4.5).toFixed(1)+'">'+(i+1)+'</text></g>';}
  });
  s+=badges;
  if(S.dataset.h!==s){S.innerHTML=s;S.dataset.h=s;}
}
/* ── la bande « Ensuite ? », en bas de la vue ── */
function ppEsc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function ppChip(s,i){return '<button type="button" class="c" data-i="'+i+'" title="'+ppEsc(s.title)+'"><kbd>'+(i+1)+'</kbd><span>'+ppEsc(s.title)+'</span></button>';}
function ppKeysTxt(n){return Array.from({length:Math.max(1,n)},(_,i)=>i+1).join(', ');} // « 1, 2 » … puis « ou un clic »
function ppStripParts(){
  // r1 : la ligne des propositions (refaite seulement quand elles changent) ; r2 : l'explication de celle
  // que l'on survole, l'aide, ou le message (texte changé sur place : le survol ne refait pas la bande)
  const L=pp.list,sel=pp.hover>=0?pp.hover:pp.focus,now=ppNow();
  const msg=pp.msg&&now-pp.msgT<6000?pp.msg:'',err=msg&&!pp.msgOk?' err':'';
  if(pp.req){
    let r1='<div class="r1"><span class="lab">Ta demande</span>';
    if(L.length)r1+=L.map((s,i)=>ppChip(s,i)).join('');
    else r1+='<span class="s'+(pp.req.err?' err':'')+'">'+ppEsc(pp.req.busy?'Je regarde la pièce…':(pp.req.err||'Aucun placement possible.'))+'</span>';
    r1+='</div>';
    if(pp.req.err&&pp.req.ex&&!pp.req.busy)return {r1,r2:{html:'<div class="r2 x">'+PP_EX.map(x=>'<button type="button" data-ex="'+ppEsc(x)+'">'+ppEsc(x)+'</button>').join('')+'</div>'}};
    return {r1,r2:{cls:'r2'+err,txt:msg||(sel>=0&&L[sel]?L[sel].why:(L.length?'Les placements sont dessinés sur la pièce · '+ppKeysTxt(L.length)+' ou un clic pour en choisir un · Échap pour fermer':'Échap pour fermer'))}};
  }
  if(L.length)
    return {r1:'<div class="r1"><span class="lab">Ensuite ?</span>'+L.map((s,i)=>ppChip(s,i)).join('')
      +'<button type="button" class="no" data-no="1" title="Ne plus le proposer pour cette fonction (Échap)">Non merci</button></div>',
      r2:{cls:'r2'+err,txt:msg||(sel>=0&&L[sel]?L[sel].why:'Survole une proposition pour la voir sur la pièce · '+ppKeysTxt(L.length)+' ou un clic pour la faire')}};
  if(msg)return {r1:'<div class="r1 m'+err+'">'+ppEsc(msg)+'</div>',r2:null};
  if(pp.on&&now-pp.hintT<6000)return {r1:'<div class="r1 m">Fais une fonction : je te proposerai la suite ici.</div>',r2:null};
  return {r1:'',r2:null};
}
function ppStripSync(){
  const B=pp.box;if(!B)return;
  const P=ppStripParts(),sel=pp.hover>=0?pp.hover:pp.focus;
  const k=P.r1+(P.r2?(P.r2.html||'§'):'');
  if(B.dataset.k!==k){B.dataset.k=k;B.innerHTML=P.r1+(P.r2?(P.r2.html||'<div class="r2"></div>'):'');}
  if(P.r2&&!P.r2.html){const r=B.querySelector('.r2');if(r){if(r.className!==P.r2.cls)r.className=P.r2.cls;if(r.textContent!==P.r2.txt)r.textContent=P.r2.txt;}}
  B.querySelectorAll('button.c').forEach(b=>{const on=+b.dataset.i===sel;if(b.classList.contains('on')!==on)b.classList.toggle('on',on);});
  const show=!!P.r1;if(pp.strip&&(pp.strip.style.display==='none')===show)pp.strip.style.display=show?'':'none';
}
function ppStripClick(ev){
  const t=ev.target&&ev.target.closest?ev.target:null;if(!t)return;
  const x=t.closest('button[data-ex]');if(x){ev.stopPropagation();if(pp.ask)pp.ask.value=x.dataset.ex;ppAsk(x.dataset.ex);return;}
  if(t.closest('button[data-no]')){ev.stopPropagation();ppRefuse();return;}
  const b=t.closest('button[data-i]');if(b){ev.stopPropagation();ppAccept(+b.dataset.i);}
}
function ppStripHover(ev){
  const b=ev.target&&ev.target.closest?ev.target.closest('button[data-i]'):null;
  const i=b?+b.dataset.i:-1;if(i!==pp.hover){pp.hover=i;pp.visT=0;ppStripSync();ppWake();}
}
/* ── la demande écrite : ouverte par / ou par le menu ── */
function ppAskOpen(){
  pp.askOpen=true;ppMenuShow(false);
  const L=ppLayerSync();if(L)L.style.display='';
  try{ppPlace();}catch(e){}
  if(pp.ask)try{pp.ask.focus();pp.ask.select();}catch(e){}
  ppStripSync();ppWake();
}
function ppAskClose(){
  pp.askOpen=false;if(pp.ask){pp.ask.value='';try{pp.ask.blur();}catch(e){}}
  if(pp.req)ppReqClose();else ppListSync();
  try{ppPlace();}catch(e){}
}
/* ── le menu du bouton étincelle ── */
function ppMenuHtml(){
  return '<button type="button" role="menuitemcheckbox" aria-checked="'+(pp.on?'true':'false')+'" data-m="auto" class="'+(pp.on?'on':'')+'"><span class="i">'+(pp.on?'✓':'')+'</span>'
      +'<span class="t"><b>Proposer la suite</b><small>Après chaque fonction, ce que tu ferais probablement ensuite, en bas de la vue</small></span></button>'
    +'<button type="button" role="menuitem" data-m="ask"><span class="i">✎</span><span class="t"><b>Écrire une demande…</b><small>« 4 trous M6 à 10 du bord », « congés R2 dans les coins »</small></span><kbd>/</kbd></button>'
    +'<button type="button" role="menuitem" data-m="var"'+(pp.var?' disabled':'')+'><span class="i">⑂</span><span class="t"><b>Essayer une variante</b><small>'
      +(pp.var?'Déjà en cours : garde A ou B dans la carte à droite':'Garde la pièce de côté (A) pour la comparer à ce que tu vas changer (B)')+'</small></span></button>';
}
function ppMenuSync(){const M=pp.menu;if(!M)return;const h=ppMenuHtml();if(M.dataset.h!==h){M.innerHTML=h;M.dataset.h=h;}}
function ppMenuShow(v){
  pp.menuOpen=!!v;const M=pp.menu;if(!M)return;
  if(!pp.menuOpen){M.style.display='none';return;}
  ppMenuSync();M.style.display='';
  try{const r=pp.btn.getBoundingClientRect();M.style.top=Math.round(r.bottom+6)+'px';M.style.right=Math.round(Math.max(8,innerWidth-r.right))+'px';}catch(e){}
}
function ppMenuClick(ev){
  const b=ev.target&&ev.target.closest?ev.target.closest('button[data-m]'):null;if(!b||b.disabled)return;
  ev.stopPropagation();const m=b.dataset.m;
  if(m==='auto'){ppSetAuto(!pp.on);ppMenuShow(false);}
  else if(m==='ask')ppAskOpen();
  else if(m==='var'){ppMenuShow(false);const L=ppLayerSync();if(L)L.style.display='';ppVarStart();}
}
function ppCss(){
  if(typeof document==='undefined'||!document.head||document.getElementById('ppCss'))return;
  const s=document.createElement('style');s.id='ppCss';
  s.textContent=[
    '#ppLayer{position:absolute;pointer-events:none;z-index:6;overflow:hidden;font-family:inherit}',
    '#ppGhost{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}',
    '#ppGhost path{fill:none;stroke:'+PP_ORANGE+';stroke-linecap:round;stroke-linejoin:round}',
    '#ppGhost .band{stroke-width:9;opacity:.22}#ppGhost .dash{stroke-width:2;stroke-dasharray:6 4;opacity:.95}',
    '#ppGhost .hid{stroke-width:1.5;stroke-dasharray:3 4;opacity:.4}',
    '#ppGhost .on.band{opacity:.38;stroke-width:12}#ppGhost .on.dash{stroke-width:2.6}',
    '#ppGhost .off{opacity:.12!important}',
    '#ppGhost .b circle{fill:'+PP_ORANGE+';stroke:#0a111c;stroke-width:2}#ppGhost .b text{fill:#1a0e05;font:700 13px "JetBrains Mono",Consolas,monospace;text-anchor:middle}',
    '#ppGhost .b.on circle{stroke:#fff}',
    // la bande : une ligne de propositions, une ligne d'explication
    '#ppStrip{position:absolute;display:flex;justify-content:center;pointer-events:none}',
    '#ppStrip .box{pointer-events:auto;max-width:100%;box-sizing:border-box;padding:7px 9px 6px;border-radius:12px;background:rgba(13,23,36,.92);border:1px solid #2c3d56;color:#e8edf5;font-size:12.5px;display:flex;flex-direction:column;gap:5px;box-shadow:0 6px 22px rgba(0,0,0,.35)}',
    '#ppStrip .r1{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}',
    '#ppStrip .lab{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#ff9a52;padding:0 4px 0 2px;white-space:nowrap}',
    '#ppStrip .c{display:flex;align-items:center;gap:7px;max-width:380px;height:30px;padding:0 10px 0 5px;border-radius:8px;border:1px solid #3a4d68;background:#141e2e;color:#f2f5fa;font:inherit;font-size:12.5px;cursor:pointer;min-width:0}',
    '#ppStrip .c span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#ppStrip .c:hover,#ppStrip .c.on{border-color:'+PP_ORANGE+';background:#22180f}',
    '#ppStrip .c kbd{flex:none;width:20px;height:20px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:5px;border:1px solid '+PP_ORANGE+';color:#ff9a52;font:700 11.5px "JetBrains Mono",Consolas,monospace}',
    '#ppStrip .c:hover kbd,#ppStrip .c.on kbd{background:'+PP_ORANGE+';color:#1a0e05}',
    '#ppStrip .c:focus-visible{outline:2px solid '+PP_ORANGE+';outline-offset:2px}',
    '#ppStrip .no{height:30px;padding:0 10px;border-radius:8px;border:1px solid transparent;background:transparent;color:#8fa0b6;font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}#ppStrip .no:hover{color:#f2f5fa;border-color:#3a4d68}',
    '#ppStrip .r2{font-size:11.5px;color:#9fb0c6;padding:0 4px;line-height:1.35}#ppStrip .err{color:#ffb07a}',
    '#ppStrip .r1.m{padding:3px 6px;color:#8fd0f3}#ppStrip .r1.m.err{color:#ff8c90}#ppStrip .s{color:#9fb0c6}',
    '#ppStrip .r2.x{display:flex;flex-wrap:wrap;gap:5px}#ppStrip .r2.x button{padding:4px 9px;border-radius:7px;border:1px solid #2c3d56;background:transparent;color:#c5cfdc;font:inherit;font-size:12px;cursor:pointer}#ppStrip .r2.x button:hover{border-color:#8fb8ff;color:#f2f5fa}',
    // la demande écrite
    '#ppAskBar{position:absolute;height:44px;box-sizing:border-box;padding:0 8px 0 14px;border-radius:12px;background:rgba(13,23,36,.94);border:1px solid #3a4d68;display:flex;align-items:center;gap:10px;pointer-events:auto;margin:0}',
    '#ppAskBar:focus-within{border-color:#8fb8ff}',
    '#ppAskBar input{flex:1;min-width:0;height:100%;border:none;outline:none;background:transparent;color:#f2f5fa;font:inherit;font-size:14px}',
    '#ppAskBar input::placeholder{color:#6f819a}',
    '#ppAskBar kbd{font:11px "JetBrains Mono",Consolas,monospace;color:#c5cfdc;border:1px solid #3a4d68;border-radius:6px;padding:3px 7px}',
    '#ppAskBar .x{height:28px;width:28px;border-radius:7px;border:none;background:transparent;color:#8fa0b6;font:inherit;font-size:15px;cursor:pointer}#ppAskBar .x:hover{color:#f2f5fa;background:#1a2333}',
    // les variantes : seulement pendant un essai
    '#ppVar{position:absolute;right:14px;width:270px;box-sizing:border-box;overflow-y:auto;pointer-events:auto;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:#e8edf5}','#ppVar>*{flex:none}',
    '#ppVar:not(.on){display:none}',
    '#ppVar.on{padding:13px 14px;border-radius:14px;background:rgba(13,23,36,.94);border:1px solid #2c3d56}',
    '#ppVar .vh{display:flex;flex-direction:column;gap:2px}#ppVar .vh span{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;color:#8fa0b6}#ppVar .vh small{font-size:11.5px;color:#8fa0b6}',
    '#ppVar .vr{display:flex;align-items:flex-start;gap:9px;padding:8px 10px;border-radius:10px;background:#141e2e;border:1px solid #2c3d56}',
    '#ppVar .vr.live{border-color:var(--c)}',
    '#ppVar .vk{flex:none;width:22px;height:22px;border-radius:5px;background:var(--c);color:#0a111c;display:flex;align-items:center;justify-content:center;font:700 12px "JetBrains Mono",Consolas,monospace}',
    '#ppVar .vl{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}#ppVar .vl b{font-weight:500;color:#e8edf5;line-height:1.3;overflow-wrap:anywhere}#ppVar .vl small{color:#8fa0b6;font-size:11px}',
    '#ppVar .vn{font:12px "JetBrains Mono",Consolas,monospace;color:#aebbcd;white-space:nowrap}#ppVar .vn i{font-style:normal;color:#6f819a;font-size:10.5px}',
    '#ppVar .vs{height:26px;padding:0 9px;border-radius:7px;border:1px solid var(--c);background:transparent;color:#e8edf5;font:inherit;font-size:12px;cursor:pointer}',
    '#ppVar .vb{display:flex;gap:6px}#ppVar .vb button{flex:1;height:32px;border-radius:8px;border:1px solid var(--c,#3a4d68);background:transparent;color:#e8edf5;font:inherit;font-size:12.5px;cursor:pointer;padding:0 6px}',
    '#ppVar .vb button:hover{background:#1a2333}',
    // le menu du bouton
    '#ppMenu{position:fixed;z-index:1000;width:330px;box-sizing:border-box;padding:6px;border-radius:12px;background:rgba(13,23,36,.98);border:1px solid #2c3d56;box-shadow:0 10px 30px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:2px;font-size:12.5px;color:#e8edf5}',
    '#ppMenu button{display:flex;align-items:flex-start;gap:10px;text-align:left;padding:8px 10px;border-radius:8px;border:none;background:transparent;color:inherit;font:inherit;cursor:pointer}',
    '#ppMenu button:hover:not([disabled]){background:#1a2333}#ppMenu button[disabled]{opacity:.55;cursor:default}',
    '#ppMenu .i{flex:none;width:18px;height:18px;border-radius:5px;border:1px solid #3a4d68;display:flex;align-items:center;justify-content:center;color:#ff9a52;font-size:12px}',
    '#ppMenu button.on .i{background:'+PP_ORANGE+';border-color:'+PP_ORANGE+';color:#1a0e05;font-weight:700}',
    '#ppMenu .t{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}#ppMenu .t b{font-weight:600;color:#f2f5fa}#ppMenu .t small{color:#9fb0c6;font-size:11.5px;line-height:1.35}',
    '#ppMenu kbd{font:11px "JetBrains Mono",Consolas,monospace;color:#c5cfdc;border:1px solid #3a4d68;border-radius:5px;padding:1px 6px;align-self:center}',
    '#viewbar #btnPp.on{background:'+PP_ORANGE+'!important;border-color:'+PP_ORANGE+'!important;color:#1a0e05!important}',
    'body[data-ws="plan"] #ppLayer,body[data-ws="fao"] #ppLayer,body[data-ws="plan"] #ppMenu,body[data-ws="fao"] #ppMenu{display:none!important}'
  ].join('\n');
  document.head.appendChild(s);
}
function ppLayerSync(){
  const c=ppCanvas();if(!c||!c.parentNode||typeof document==='undefined')return null;
  let L=pp.layer;
  if(!L||!L.isConnected){
    L=document.getElementById('ppLayer');
    if(!L){L=document.createElement('div');L.id='ppLayer';c.parentNode.insertBefore(L,c.nextSibling);}
    pp.layer=L;L.innerHTML='';
    const G=document.createElementNS('http://www.w3.org/2000/svg','svg');G.id='ppGhost';G.setAttribute('aria-hidden','true');L.appendChild(G);pp.svg=G;
    const S=document.createElement('div');S.id='ppStrip';S.style.display='none';
    const B=document.createElement('div');B.className='box';B.setAttribute('role','region');B.setAttribute('aria-label','La suite probable');B.setAttribute('aria-live','polite');
    B.addEventListener('click',ppStripClick);B.addEventListener('pointermove',ppStripHover);B.addEventListener('pointerleave',()=>{if(pp.hover!==-1){pp.hover=-1;ppStripSync();ppWake();}});
    S.appendChild(B);L.appendChild(S);pp.strip=S;pp.box=B;ppStripSync();
    const V=document.createElement('div');V.id='ppVar';V.setAttribute('role','region');V.setAttribute('aria-label','Variantes');
    V.addEventListener('click',ppVarClick);L.appendChild(V);pp.varEl=V;ppVarSync();
    const A=document.createElement('form');A.id='ppAskBar';A.setAttribute('role','search');A.style.display='none';
    A.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#8fb8ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>'
      +'<input id="ppAsk" type="text" autocomplete="off" spellcheck="false" aria-label="Demande écrite" placeholder="Écris ce que tu veux : 4 trous M6 à 10 du bord, congés R2…"><kbd>Entrée</kbd>'
      +'<button type="button" class="x" title="Fermer (Échap)" aria-label="Fermer">✕</button>';
    A.addEventListener('submit',ev=>{ev.preventDefault();ppAsk(pp.ask.value);});
    A.querySelector('.x').addEventListener('click',ev=>{ev.stopPropagation();ppAskClose();});
    L.appendChild(A);pp.askBar=A;pp.ask=A.querySelector('input');
    pp.ask.addEventListener('keydown',ev=>{
      ev.stopPropagation(); // les raccourcis de la page ne voient pas la frappe
      if(ev.key==='Escape'){ev.preventDefault();if(pp.ask.value)pp.ask.value='';else ppAskClose();}
    });
  }
  const k=c.offsetLeft+','+c.offsetTop+','+c.clientWidth+','+c.clientHeight;
  if(L.dataset.k!==k){L.dataset.k=k;Object.assign(L.style,{left:c.offsetLeft+'px',top:c.offsetTop+'px',width:c.clientWidth+'px',height:c.clientHeight+'px'});}
  return L;
}
function ppPlace(){
  // la bande (et la demande écrite) en bas, entre l'arbre et le bord droit, au-dessus du bandeau des
  // fonctions et de la ligne d'état ; les variantes en haut à droite, sous la barre de vue et le cube
  const L=pp.layer;if(!L||typeof document==='undefined')return;
  const lr=L.getBoundingClientRect(),vis=e=>{if(!e)return null;const q=e.getBoundingClientRect();
    return q.width>0&&q.height>0&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'?q:null;};
  let left=14,bottom=14;
  const tw=vis(document.getElementById('treeWrap'));if(tw&&tw.left<lr.left+lr.width/2)left=Math.max(left,tw.right-lr.left+14);
  // V1.1.8 : bandeau des fonctions dressé en tige à gauche (disposition de la Goutte) : il compte comme l'arbre
  const tg=vis(document.getElementById('mfTl'));const tige=!!(tg&&tg.height>tg.width*1.5&&tg.left<lr.left+lr.width/2);if(tige)left=Math.max(left,tg.right-lr.left+14);
  [tige?'':'mfTl','faceInfo','mfStatus','mfStEng','mfStMeas'].forEach(id=>{const q=vis(document.getElementById(id));if(q&&q.top<lr.bottom&&q.bottom>lr.bottom-160)bottom=Math.max(bottom,lr.bottom-q.top+8);}); // la ligne d'état déborde de son cadre : ses textes comptent
  // V1.1.5 : ni sur le panneau des paramètres à droite (la fenêtre Extrusion : la bande cachait le champ Distance)
  let right=14;const pe=document.getElementById('props'),pw=vis(pe&&pe.closest&&pe.closest('.panel'));if(pw&&pw.left>lr.left+lr.width/2&&pw.bottom>lr.bottom-200)right=Math.max(right,lr.right-pw.left+14); // le cadre visible : une petite aide en haut ne compte pas
  const room=Math.max(260,lr.width-left-right);
  let sb=bottom;
  const A=pp.askBar;
  if(A){const show=pp.askOpen;if((A.style.display==='none')===show)A.style.display=show?'':'none';
    if(show){const w=Math.min(560,room),x=left+(room-w)/2,k=Math.round(x)+','+Math.round(bottom)+','+Math.round(w);
      if(A.dataset.p!==k){A.dataset.p=k;A.style.left=Math.round(x)+'px';A.style.bottom=Math.round(bottom)+'px';A.style.width=Math.round(w)+'px';}
      sb=bottom+44+8;}}
  const S=pp.strip;
  if(S){const k=Math.round(left)+','+Math.round(sb)+','+Math.round(room);
    if(S.dataset.p!==k){S.dataset.p=k;S.style.left=Math.round(left)+'px';S.style.bottom=Math.round(sb)+'px';S.style.width=Math.round(room)+'px';}}
  const VE=pp.varEl;
  if(VE&&pp.var){
    let top=14;['viewbar','mfCube'].forEach(id=>{const q=vis(document.getElementById(id));
      if(q&&q.right>lr.right-320&&q.top<lr.top+260)top=Math.max(top,q.bottom-lr.top+10);});
    const mh=Math.max(120,lr.height-top-sb-60),k=Math.round(top)+','+Math.round(mh);
    if(VE.dataset.p!==k){VE.dataset.p=k;VE.style.top=Math.round(top)+'px';VE.style.maxHeight=Math.round(mh)+'px';}
  }
}
function ppUiShow(v){
  if(!v){if(pp.layer&&pp.layer.style.display!=='none')pp.layer.style.display='none';return;}
  const L=ppLayerSync();if(L&&L.style.display==='none')L.style.display='';
}
function ppActive(){return pp.on||!!pp.req||pp.askOpen||!!pp.var||(pp.msg&&ppNow()-pp.msgT<6000);}
function ppRender(RS){
  if(!ppActive()){ppUiShow(false);return;}
  const S=typeof scene!=='undefined'?scene:null;
  if(!RS||RS!==S||ppWs()!=='cao'){ppUiShow(false);return;}
  ppUiShow(true);
  const now=ppNow();
  try{ppTick(now);}catch(e){}
  try{ppVarTick(now);}catch(e){}
  if(!(now-pp.placeT<300)){pp.placeT=now;try{ppPlace();}catch(e){}ppStripSync();}
  try{ppGhostSync(now);}catch(e){}
}
function ppBtnSync(){const b=pp.btn;if(!b)return;b.classList.toggle('on',pp.on);b.setAttribute('aria-pressed',pp.on?'true':'false');}
function ppSetAuto(v){
  // Proposer la suite : oui / non (retenu sur le poste). La demande écrite et les variantes restent.
  pp.on=v===undefined?!pp.on:!!v;
  try{localStorage.setItem('ppAuto',pp.on?'1':'0');}catch(e){}
  pp.gen++;pp.busy=false;pp.all=[];pp.sig='';pp.want='';pp.sigT=0;pp.base=null;pp.prevRead=null;pp.focus=pp.hover=-1;
  pp.hintT=pp.on?ppNow():-1e9;
  if(pp.svg&&!pp.req){pp.svg.innerHTML='';pp.svg.dataset.h='';}
  ppBtnSync();ppMenuSync();ppListSync();ppWake();
}
function ppToggle(v){ppSetAuto(v);}
function ppInit(){
  try{
    let auto=false;
    try{const v=localStorage.getItem('ppAuto');auto=v!=null?v==='1':!(typeof navigator!=='undefined'&&navigator.webdriver);}catch(e){}
    pp.on=auto;
    if(typeof document==='undefined'||!document.getElementById)return;
    ppCss();
    const vb=document.getElementById('viewbar'),st=document.getElementById('btnLens')||document.getElementById('btnSettings');
    if(vb&&!document.getElementById('btnPp')){
      const b=document.createElement('button');b.id='btnPp';
      b.title='La pièce qui propose : la suite probable après chaque fonction, une demande écrite, une variante à comparer';
      b.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M18 15l.8 1.9 1.9.8-1.9.8L18 20.4l-.8-1.9-1.9-.8 1.9-.8z"/></svg>';
      b.setAttribute('aria-label','La pièce qui propose');b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-pressed',pp.on?'true':'false');
      b.onclick=ev=>{if(ev)ev.stopPropagation();ppMenuShow(!pp.menuOpen);};
      vb.insertBefore(b,st||null);pp.btn=b;ppBtnSync();
    }
    if(!document.getElementById('ppMenu')&&document.body){
      const M=document.createElement('div');M.id='ppMenu';M.setAttribute('role','menu');M.setAttribute('aria-label','La pièce qui propose');M.style.display='none';
      M.addEventListener('click',ppMenuClick);document.body.appendChild(M);pp.menu=M;
    }
    if(typeof addEventListener==='function'&&!ppInit.k){ppInit.k=true;addEventListener('keydown',ppKey,true);
      addEventListener('pointerdown',ev=>{if(!pp.menuOpen)return;const t=ev.target;if(t&&t.closest&&(t.closest('#ppMenu')||t.closest('#btnPp')))return;ppMenuShow(false);},true);}
  }catch(e){}
}
ppInit();
