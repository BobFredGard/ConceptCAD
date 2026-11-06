function splitPlaneOf(f){
  // Plan résolu {o,n} (monde) : origine, plan de construction (repère persistant) ou face
  // figée au clic ; décalage le long de la normale ; flip retourne la normale.
  const P=f.pl||{};let o=[0,0,0],n=[0,0,1];
  if(P.src==='XZ')n=[0,1,0];
  else if(P.src==='YZ')n=[1,0,0];
  else if(P.src==='cg'){
    const c=(doc.cgeo||[]).find(x=>x&&x.id===P.cg);
    if(c&&c.fr&&c.fr.o&&c.fr.z){o=c.fr.o.slice();n=c.fr.z.slice();}
    else if(P.o&&P.n){o=P.o.slice();n=P.n.slice();}
  }else if(P.src==='face'&&P.o&&P.n){o=P.o.slice();n=P.n.slice();}
  const l=Math.hypot(n[0],n[1],n[2])||1;n=n.map(v=>v/l);
  const d=+f.off||0;o=[o[0]+n[0]*d,o[1]+n[1]*d,o[2]+n[2]*d];
  if(f.flip)n=n.map(v=>-v);
  return{o,n};
}
function splitCutPlanes(){
  // Plans des scissions de FACES actives (visibles, non sautées en édition) : leurs arêtes
  // de coupe sont affichées vives (occSharpEdges), même entre faces tangentes.
  const out=[];
  try{(doc.features||[]).forEach(f=>{if(f&&f.type==='xsplit'&&f.mode!=='body'&&f.visible!==false&&!(occSkipFeat&&f.id===occSkipFeat))out.push(splitPlaneOf(f));});}catch(e){}
  return out;
}
function occSplitPln(P){const a=new occt.gp_Pnt_3(P.o[0],P.o[1],P.o[2]),b=new occt.gp_Dir_4(P.n[0],P.n[1],P.n[2]);try{return new occt.gp_Pln_3(a,b);}finally{occFree(a);occFree(b);}}
function occSplitRun(shape,tools){
  // Splitter : `shape` découpé par `tools` (liste de shapes). Rend le résultat brut.
  const sp=new occt.BRepAlgoAPI_Splitter_1();
  const la=new occt.TopTools_ListOfShape_1(),lt=new occt.TopTools_ListOfShape_1();
  try{
    la.Append_1(shape);tools.forEach(t=>lt.Append_1(t));
    sp.SetArguments(la);sp.SetTools(lt);sp.Build();
    if(!sp.IsDone())throw new Error('découpe refusée par le noyau');
    const r=sp.Shape();if(!r||r.IsNull())throw new Error('résultat vide');
    nomsTransmet([shape],sp,r);
    return r;
  }finally{try{sp.delete();}catch(e){}try{la.delete();}catch(e){}try{lt.delete();}catch(e){}}
}
function occSolidsOf(shape){
  const out=[],SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_SOLID,SH);
  while(ex.More()){out.push(occSolidCur(ex));ex.Next();}
  try{ex.delete();}catch(e){}
  return out;
}
function occSplitFacesOnce(shape,faces,P){
  // Coupe les faces visées par le plan ; le solide reste entier. → {shape, cut:nb de faces coupées}
  const pln=occSplitPln(P),secs=[];let cut=0;
  try{
    faces.forEach(h=>{
      const s=new occt.BRepAlgoAPI_Section_5(h,pln,false);
      try{
        s.Build();if(!s.IsDone())return;
        const r=s.Shape();
        const ex=new occt.TopExp_Explorer_2(r,occt.TopAbs_ShapeEnum.TopAbs_EDGE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
        const has=ex.More();try{ex.delete();}catch(e){}
        if(has){secs.push(r);cut++;}else try{r.delete();}catch(e){}
      }finally{try{s.delete();}catch(e){}}
    });
    if(!secs.length)return{shape:null,cut:0};
    const r=occSplitRun(shape,secs);
    const so=occSolidsOf(r);
    if(so.length===1){nomsCompose([r],so[0]);try{r.delete();}catch(e){}return{shape:so[0],cut};}
    so.forEach(s=>{try{s.delete();}catch(e){}});
    return{shape:r,cut};
  }finally{try{pln.delete();}catch(e){}secs.forEach(s=>{try{s.delete();}catch(e){}});}
}
function occSplitBodyOnce(shape,P){
  // Coupe le solide en deux côtés. → {neg, pos} (null si vide de ce côté)
  const b=occSolidBox(shape);if(!b)throw new Error('boîte du solide illisible');
  const c=b.c,k=(c[0]-P.o[0])*P.n[0]+(c[1]-P.o[1])*P.n[1]+(c[2]-P.o[2])*P.n[2];
  // face de coupe centrée sur la projection du centre, débordant largement du solide
  const q={o:[c[0]-k*P.n[0],c[1]-k*P.n[1],c[2]-k*P.n[2]],n:P.n};
  const R=b.dg+10,pln=occSplitPln(q);
  let face=null,r=null;
  try{
    const mf=new occt.BRepBuilderAPI_MakeFace_9(pln,-R,R,-R,R);
    try{if(!mf.IsDone())throw new Error('plan de coupe invalide');face=mf.Face();}finally{try{mf.delete();}catch(e){}}
    r=occSplitRun(shape,[face]);
  }finally{try{pln.delete();}catch(e){}if(face)try{face.delete();}catch(e){}}
  const neg=[],pos=[];
  occSolidsOf(r).forEach(s=>{
    let ct=null;
    try{const p=new occt.GProp_GProps_1();occt.BRepGProp.VolumeProperties_1(s,p,false,false,false);const m=p.CentreOfMass();ct=[m.X(),m.Y(),m.Z()];try{m.delete();}catch(e){}try{p.delete();}catch(e){}}catch(e){}
    if(!ct){try{s.delete();}catch(e){}return;}
    const d=(ct[0]-P.o[0])*P.n[0]+(ct[1]-P.o[1])*P.n[1]+(ct[2]-P.o[2])*P.n[2];
    (d>0?pos:neg).push(s);
  });
  const pack=L=>!L.length?null:(L.length===1?L[0]:occCompoundOf(L));
  const pN=pack(neg),pP=pack(pos);
  [pN,pP].forEach(s=>{if(s)nomsCompose([r],s);});
  try{r.delete();}catch(e){}
  return{neg:pN,pos:pP,nNeg:neg.length,nPos:pos.length};
}
function occApplySplit(result,f,side){
  // Rejoue la scission. side : 'neg' (corps d'origine) | 'pos' (corps neuf, mode corps).
  // Retourne {shape,warnings} comme occApplyDeleteFaces.
  const warnings=[];const P=splitPlaneOf(f);
  if(f.mode==='body'){
    let s=null;
    try{s=occSplitBodyOnce(result,P);}
    catch(e){return{shape:side==='pos'?null:result,warnings:[`scission impossible — ${(e&&e.message)||e}`],fatal:true};}
    f._m={m:(s.nNeg&&s.nPos)?1:0,t:1};
    if(!s.neg||!s.pos){
      // le plan ne traverse pas le corps : tout reste dans le corps d'origine
      if(s.neg)try{s.neg.delete();}catch(e){}if(s.pos)try{s.pos.delete();}catch(e){}
      return{shape:side==='pos'?null:result,warnings:['le plan ne coupe pas le corps']};
    }
    try{result.delete();}catch(e){}
    if(side==='pos'){try{s.neg.delete();}catch(e){}return{shape:s.pos,warnings};}
    try{s.pos.delete();}catch(e){}
    return{shape:s.neg,warnings};
  }
  const total=(f.faces||[]).length;
  if(!total)return{shape:result,warnings:['aucune face à scinder']};
  const hs=(f.faces||[]).map(fr=>{try{return occFindFaceAny(result,fr);}catch(e){return null;}}).filter(Boolean);
  f._m={m:hs.length,t:total};
  if(!hs.length)return{shape:result,warnings:[`aucune des ${total} face(s) n'est retrouvée — la pièce a changé`]};
  if(hs.length<total)warnings.push(`${total-hs.length} face(s) introuvable(s) sur la pièce courante`);
  let r=null;
  try{r=occSplitFacesOnce(result,hs,P);}
  catch(e){r=null;warnings.push(`scission impossible — ${(e&&e.message)||e}`);}
  finally{hs.forEach(h=>{try{h.delete();}catch(e){}});}
  if(!r||!r.shape){
    f._m={m:0,t:total};
    if(r&&!r.cut)warnings.push('le plan ne coupe aucune des faces choisies');
    return{shape:result,warnings,fatal:true};
  }
  if(r.cut<hs.length){f._m={m:r.cut,t:total};warnings.push(`${hs.length-r.cut} face(s) non traversée(s) par le plan`);}
  try{result.delete();}catch(e){}
  return{shape:r.shape,warnings};
}
function occListEdges(shape){
  // Données pures par arête (pas de handles conservés) : mid, polyline pts, longueur, src (rang explorateur).
  const out=[],bin=[];
  const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_EDGE,SH);bin.push(ex);
  let src=0;
  while(ex.More()){
    const e=occEdgeCur(ex);bin.push(e);
    try{
      const ad=new occt.BRepAdaptor_Curve_2(e);bin.push(ad);
      const u0=ad.FirstParameter(),u1=ad.LastParameter();
      if(u1>u0){
        const m=ad.Value((u0+u1)/2);bin.push(m);
        const pts=[],NP=10;
        for(let i=0;i<=NP;i++){const p=ad.Value(u0+(u1-u0)*i/NP);bin.push(p);pts.push([p.X(),p.Y(),p.Z()]);}
        let len=0;
        for(let i=1;i<pts.length;i++)len+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]);
        if(len>1e-6)out.push({mid:[m.X(),m.Y(),m.Z()],pts,len,src});
      }
    }catch(err){}
    src++;ex.Next();
  }
  occDispose(bin);
  const seen=new Set(),dedup=[]; // jumeaux exacts (splits) fusionnés
  out.forEach(o=>{const k=o.mid.map(v=>v.toFixed(2)).join(',');if(!seen.has(k)){seen.add(k);dedup.push(o);}});
  return dedup;
}
// ── affinage de la POLYLIGNE d'une arête (affichage seulement) ──────────────
// Les arêtes étaient échantillonnées à 12 points fixes : un cercle devenait un
// 12-gone, très lisible sur la silhouette d'une révolution (le polygone se voit).
// Ici on subdivise chaque intervalle tant que la COURBE ne s'écarte pas de sa
// corde de plus de EDGE_TOL : une droite tombe à 2 points, un cercle s'affine tout
// seul. L'IDENTITÉ des arêtes (mid + len) reste calculée à 12 points fixes — inchangée,
// donc aucun effet sur l'appariement des congés, les signatures ni le rejeu.
const EDGE_TOL=0.02; // mm — écart maximal entre la courbe et sa polyligne
function occCurvePts(ad,u0,u1,tol,cap){
  tol=tol>0?tol:EDGE_TOL;cap=cap||600;
  const at=u=>{
    const p=ad.Value(u);
    const q=[p.X(),p.Y(),p.Z()];
    try{p.delete();}catch(e){} // handle jetable : ad.Value en alloue un à chaque appel
    return q;
  };
  const sweep=u1-u0;
  // ── 1) cercle ou arc : le nombre de segments se CALCULE, pas subdivise à l'aveugle
  //    flèche d'une corde = R(1−cos(Δθ/2)) ≤ tol  ⇒  Δθ = 2·acos(1−tol/R)
  let R=-1;
  // Demander son cercle à une courbe qui n'en est pas un lève une erreur du noyau : une par arête
  // droite ou courbe, à chaque rejeu, et chacune use sa pile (voir occPileRemettre).
  if(ad.GetType()===occt.GeomAbs_CurveType.GeomAbs_Circle)try{
    const c=ad.Circle(),a1=c.Axis(),ax=occXyz(a1.Direction());
    if(isFinite(ax[0])&&isFinite(ax[1])&&isFinite(ax[2]))R=c.Radius();
    occFree(a1);occFree(c);
  }catch(e){}
  if(R>1e-6){
    let dth=2*Math.acos(Math.max(-1,Math.min(1,1-tol/R)));
    if(!(dth>1e-3))dth=1e-3;
    let n=Math.ceil(Math.abs(sweep)/dth);
    n=Math.max(4,Math.min(cap,Math.round(n)));
    const out=[];
    for(let i=0;i<=n;i++)out.push(at(u0+sweep*i/n));
    return out;
  }
  // ── 2) autres courbes (droites, B-splines…) : on subdivise tant que la courbe
  //    s'écarte de sa corde de plus de tol. Une droite tombe à 2 points du premier coup.
  const cache={};
  const atc=u=>{const k=u.toFixed(9);if(cache[k])return cache[k];return cache[k]=at(u);};
  const dev=(a,b)=>{
    const A=atc(a),B=atc(b),M=atc((a+b)/2);
    return Math.hypot(M[0]-(A[0]+B[0])/2,M[1]-(A[1]+B[1])/2,M[2]-(A[2]+B[2])/2);
  };
  const stack=[[u0,u1]],leaves=[];
  while(stack.length&&leaves.length<cap){
    const s=stack.pop();
    if(dev(s[0],s[1])>tol){const m=(s[0]+s[1])/2;stack.push([m,s[1]]);stack.push([s[0],m]);}
    else leaves.push(s);
  }
  leaves.sort((a,b)=>a[0]-b[0]);
  const us=[u0];
  leaves.forEach(l=>{const e=l[1];if(e>us[us.length-1]+1e-12)us.push(e);});
  return us.map(atc);
}
function occDraftOnce(result,refFace,faces,angle,opts){
  const bin=[];
  try{
    const dir=occBinPush(bin,new occt.gp_Dir_4(refFace.n[0],refFace.n[1],refFace.n[2]));
    const P=occBinPush(bin,new occt.gp_Pnt_3(refFace.pos[0],refFace.pos[1],refFace.pos[2]));
    const pln=occBinPush(bin,new occt.gp_Pln_3(P,dir));
    const da=occBinPush(bin,new occt.BRepOffsetAPI_DraftAngle_2(result));
    const refused=[];
    let ok=0;
    for(const f of faces){
      // DownCast via le namespace TopoDS (TopoDS.Face_1) : la forme `TopoDS_Face_1`
      // avec underscore N'EXISTE PAS dans ce build (undefined → TypeError à chaque
      // Add → dépouille systématiquement « impossible », Pièce 7). Toutes les autres
      // fonctions utilisent déjà TopoDS.Face_1 / Edge_1.
      const fc=occBinPush(bin,occt.TopoDS.Face_1(f));
      try{da.Add(fc,dir,angle,pln,false);ok++;}
      catch(e){
        const b=occFaceBox(f);
        refused.push(b?b.pos.map(v=>+v.toFixed(1)):null);
      }
    }
    if(!ok)throw new Error(refused.length
      ?`aucune des ${faces.length} face(s) ne touche le plan neutre`
      :'aucune face à dépouiller');
    da.Build();
    let done=false;
    try{done=!!da.IsDone();}catch(e){}
    if(!done)throw new Error('dépouille refusée par le moteur');
    const brut=occBinPush(bin,da.Shape());
    nomsTransmet([result],da,brut);
    const out=occShapeCopy(brut);
    if(!out||out.IsNull())throw new Error('solide dépouillé vide');
    let thin=null;
    if(opts&&opts.thin){try{thin=occDraftThin(da,faces);}catch(e){thin=null;}}
    return {shape:out,refused:refused,thin};
  }finally{occDispose(bin);} // toujours : un `throw` en cours de boucle ne doit pas fuir de handles
}
function occFaceDist(a,b){
  // Distance mini entre deux formes → {d, p:[x,y,z] sur a} ou null
  const x=new occt.BRepExtrema_DistShapeShape_2(a,b,occt.Extrema_ExtFlag.Extrema_ExtFlag_MIN,occt.Extrema_ExtAlgo.Extrema_ExtAlgo_Grad);
  try{
    if(!x.IsDone()||!(x.NbSolution()>0))return null;
    return{d:x.Value(),p:occXyz(x.PointOnShape1(1))};
  }finally{try{x.delete();}catch(e){}}
}
function occDraftThin(da,faces){
  // ALERTE PAROI (2026-10-27) : deux faces dépouillées OPPOSÉES (normales sortantes contraires)
  // se rapprochent l'une de l'autre si le plan neutre ou le sens ne conviennent pas. Cavité
  // Test : nervure de 5 mm, flancs dépouillés de 25° autour de son dessus incliné → 1,2 mm au
  // pied ; la dépouille « réussissait » sans un mot et tous les congés suivants échouaient
  // (« arête trop courte »). On compare la distance mini de chaque paire avant et après
  // (BRepOffsetAPI_DraftAngle.ModifiedShape) : → {d0, d, p, paroi} pour la pire chute de plus
  // de moitié, sinon null. paroi : matière entre les deux faces (nervure) ; sinon passage
  // (rainure, fente) qui se referme.
  const L=faces.map(f=>{const n=occFaceOutNormal(f),b=occFaceBox(f);return n&&b?{f,n,c:b.pos}:null;});
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  let pire=null;
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){
    const A=L[i],B=L[j];
    if(!A||!B||dot(A.n,B.n)>-0.9)continue;
    const r0=occFaceDist(A.f,B.f);
    if(!r0||!(r0.d>1e-3))continue; // faces voisines (arête commune) : pas une épaisseur
    let r1=null;
    let ma=null,mb=null;
    try{ma=da.ModifiedShape(A.f);mb=da.ModifiedShape(B.f);r1=occFaceDist(ma,mb);}catch(e){continue;}
    finally{occFree(ma);occFree(mb);}
    if(!r1||!(r1.d<0.5*r0.d))continue;
    const k=r1.d/r0.d;
    if(!pire||k<pire.k)pire={k,d0:r0.d,d:r1.d,p:r1.p,paroi:dot([B.c[0]-A.c[0],B.c[1]-A.c[1],B.c[2]-A.c[2]],A.n)<0};
  }
  return pire;
}
function occDraftThinMsg(t){
  const nb=(v,k)=>String(+(+v).toFixed(k)).replace('.',',');
  const ou=' près de ('+t.p.map(v=>nb(v,1)).join(' ; ')+')';
  return (t.d<1e-3
    ?`les faces dépouillées se rejoignent : ${t.paroi?'paroi':'passage'} de ${nb(t.d0,2)} mm réduit${t.paroi?'e':''} à zéro${ou}`
    :`${t.paroi?'paroi amincie':'passage rétréci'} de ${nb(t.d0,2)} à ${nb(t.d,2)} mm${ou}`)
    +' — vérifiez la face de référence (plan neutre) ou le sens de l’angle ; les congés posés ensuite sur cette paroi risquent d’échouer';
}
function occExtrudeDraft(shape,bs,sp,angleDeg){
  // Dépouille d'un OUTIL d'extrusion, pivotée sur le plan d'esquisse : les parois
  // latérales (tout sauf les deux calottes aux extrémités lo/hi) sont inclinées de
  // l'angle SIGNÉ, direction +n. Le signe donne le sens : l'angle est passé tel quel
  // à DraftAngle. Les faces qui refusent (pas de contact avec le plan neutre, p.ex.
  // raccords de pourtour) sont sautées et signalées — jamais d'exception silencieuse.
  // En cas d'échec global, on lève : l'appelant conserve l'extrusion droite + avertit.
  const warnings=[];
  const ang=(+angleDeg||0)*Math.PI/180;
  if(!(Math.abs(ang)>1e-9))return{shape,warnings};
  const n=[bs.n.x,bs.n.y,bs.n.z],o=[bs.o.x,bs.o.y,bs.o.z];
  const len=Math.abs(sp.hi-sp.lo)||1;
  const tol=Math.max(0.02,len*1e-4);
  const sides=[],bin=[];
  try{
    const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
    const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);bin.push(ex);
    while(ex.More()){
      const fc=occFaceCur(ex);bin.push(fc);
      let cap=false;
      try{
        const ad=new occt.BRepAdaptor_Surface_2(fc,true);bin.push(ad);
        if(ad.GetType()===occt.GeomAbs_SurfaceType.GeomAbs_Plane){
          const pl=ad.Plane(),ax=pl.Axis(),d=occXyz(ax.Direction()),Lp=occXyz(pl.Location());occFree(ax);occFree(pl);
          let nx=d[0],ny=d[1],nz=d[2];
          try{if(fc.Orientation_1()===occt.TopAbs_Orientation.TopAbs_REVERSED){nx=-nx;ny=-ny;nz=-nz;}}catch(e){}
          if(Math.abs(nx*n[0]+ny*n[1]+nz*n[2])>0.999){
            const off=(Lp[0]-o[0])*n[0]+(Lp[1]-o[1])*n[1]+(Lp[2]-o[2])*n[2];
            if(Math.abs(off-sp.lo)<tol||Math.abs(off-sp.hi)<tol)cap=true;
          }
        }
      }catch(e){}
      if(!cap)sides.push(fc);
      ex.Next();
    }
    if(!sides.length)throw new Error('aucune paroi latérale à dépouiller');
    // occDraftOnce copie les handles (TopoDS.Face_1) dans son propre bin : les nôtres
    // restent valides pendant l'appel et sont libérés avec `bin` ci-dessous.
    const r=occDraftOnce(shape,{pos:o,n:n},sides,ang);
    if(r.refused&&r.refused.length)warnings.push(r.refused.length+' face(s) ne touchent pas le plan d\u2019esquisse — non dépouillées');
    try{shape.delete();}catch(e){}
    return{shape:r.shape,warnings};
  }finally{occDispose(bin);}
}
function occSurfNormalAt(surf,u,v){
  // Normale de surface en (u,v) : [x,y,z] NON orientée (donne min(θ,π−θ) par produit
  // scalaire) ou null si la surface ne la définit pas. Utilisée uniquement pour
  // trancher un conflit drapeau/géométrie (congé sur congé) : coût faible.
  try{
    const pr=new occt.GeomLProp_SLProps_1(surf,u,v,1,1e-6);
    let r=null;
    if(pr.IsNormalDefined()){
      const N=pr.Normal();r=[N.X(),N.Y(),N.Z()];N.delete();
    }
    pr.delete();
    return r;
  }catch(err){return null;}
}
function occSharpEdges(shape){
  // Arêtes uniques classées : sharp (noire, C0) vs tangente (grise, G1+). Validé par exécution.
  const out=[],bin=[];
  // V0.11.5 : arêtes de COUPE d'une scission de faces (xsplit) — entre les deux moitiés d'un
  // congé, la continuité est G1 et l'arête serait grise ; c'est une limite voulue : noire.
  const cuts=splitCutPlanes();
  const onCut=pts=>cuts.some(P=>pts.every(q=>Math.abs((q[0]-P.o[0])*P.n[0]+(q[1]-P.o[1])*P.n[1]+(q[2]-P.o[2])*P.n[2])<1e-3));
  try{
    const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE,NP=12;
    const ekey=(m,l)=>m.map(v=>v.toFixed(2)).join(',')+'|'+l.toFixed(2);
    const sample=ad=>{
      const u0=ad.FirstParameter(),u1=ad.LastParameter(),pts=[];
      let len=0,px=null;
      for(let i=0;i<=NP;i++){
        const p=ad.Value(u0+(u1-u0)*i/NP);bin.push(p);
        const q=[p.X(),p.Y(),p.Z()];pts.push(q);
        if(px)len+=Math.hypot(q[0]-px[0],q[1]-px[1],q[2]-px[2]);
        px=q;
      }
      return{pts,len,u0,u1};
    };
    const faces=[];
    const fx=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);bin.push(fx);
    while(fx.More()){const f=occFaceCur(fx);bin.push(f);faces.push(f);fx.Next();}
    const fmap=new Map();
    // 2026-10-23 : COUTURES — une face de révolution (cylindre, cône…) est bordée deux fois par
    // la même arête (sa couture) : vue deux fois DANS LA MÊME FACE. Ce n'est pas une arête de la
    // pièce : ni tracée ni sélectionnable. Idem pour la jonction de deux morceaux du MÊME
    // cylindre (perçage repassé, découpe coaxiale) : un seul cylindre à l'écran.
    const seam=new Set(),cyl=faces.map(f=>{
      try{const ad=new occt.BRepAdaptor_Surface_2(f,true);bin.push(ad);
        if(ad.GetType()!==occt.GeomAbs_SurfaceType.GeomAbs_Cylinder)return null;
        const C=ad.Cylinder(),A=C.Axis();
        try{return{r:C.Radius(),d:occXyz(A.Direction()),o:occXyz(A.Location())};}finally{occFree(A);occFree(C);}
      }catch(err){return null;}
    });
    const sameCyl=fl=>{
      if(fl.length!==2)return false;const a=cyl[fl[0]],b=cyl[fl[1]];if(!a||!b)return false;
      if(Math.abs(a.r-b.r)>1e-6)return false;
      const c=a.d[0]*b.d[0]+a.d[1]*b.d[1]+a.d[2]*b.d[2];if(Math.abs(Math.abs(c)-1)>1e-9)return false;
      const w=[b.o[0]-a.o[0],b.o[1]-a.o[1],b.o[2]-a.o[2]],t=w[0]*a.d[0]+w[1]*a.d[1]+w[2]*a.d[2];
      return Math.hypot(w[0]-t*a.d[0],w[1]-t*a.d[1],w[2]-t*a.d[2])<1e-6; // même axe
    };
    faces.forEach((f,fi)=>{
      const ee=new occt.TopExp_Explorer_2(f,occt.TopAbs_ShapeEnum.TopAbs_EDGE,SH);bin.push(ee);
      while(ee.More()){
        const e=occEdgeCur(ee);bin.push(e);
        try{
          const ad=new occt.BRepAdaptor_Curve_2(e);bin.push(ad);
          if(ad.LastParameter()>ad.FirstParameter()){
            const m=ad.Value((ad.FirstParameter()+ad.LastParameter())/2);bin.push(m);
            const s=sample(ad,ad.FirstParameter(),ad.LastParameter());
            if(s.len>1e-6){
              const k=ekey([m.X(),m.Y(),m.Z()],s.len);
              if(!fmap.has(k))fmap.set(k,[]);
              if(!fmap.get(k).includes(fi))fmap.get(k).push(fi);else seam.add(k); // 2ᵉ passage dans la même face
            }
          }
        }catch(err){}
        ee.Next();
      }
    });
    const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_EDGE,SH);bin.push(ex);
    const seen=new Set();
    while(ex.More()){
      const e=occEdgeCur(ex);bin.push(e);
      try{
        const ad=new occt.BRepAdaptor_Curve_2(e);bin.push(ad);
        const u0=ad.FirstParameter(),u1=ad.LastParameter();
        if(u1>u0){
          const m=ad.Value((u0+u1)/2);bin.push(m);
          const mid=[m.X(),m.Y(),m.Z()];
          const s=sample(ad,u0,u1);
          if(s.len>1e-6){
            const kk=ekey(mid,s.len);
            if(!seen.has(kk)){
              seen.add(kk);
              let sharp=true;
              const fl=fmap.get(kk)||[];
              const onC=cuts.length>0&&onCut(s.pts); // arête de coupe d'une scission : toujours tracée
              if(!onC&&((seam.has(kk)&&fl.length<=1)||sameCyl(fl))){ex.Next();continue;} // couture : pas une arête
              if(fl.length>=2){
                try{sharp=(occt.BRep_Tool.Continuity_1(e,faces[fl[0]],faces[fl[1]])===occt.GeomAbs_Shape.GeomAbs_C0);}
                catch(err){sharp=true;}
              }else sharp=false;
              // 2026-10-18 V0.2.5 : congé SUR congé — le noyau ne pose PAS le drapeau G1
              // sur la jonction des deux congés : BRep_Tool répond C0 alors que les
              // surfaces sont TANGENTES (mesuré sur la pédale : 4 fragments noirs de 2 à
              // 7 mm, dihédrale mesurée 0.0°, pendant que toutes les vraies arêtes vives
              // font ≥ 24°). Si le drapeau dit « vive », on INTERROGE la géométrie :
              // pcurve de l'arête dans chaque face → UV → normale (SLProps) à 3 stations
              // (25/50/75 %) ; dès QU'UN échantillon dépasse le seuil, on garde « vive »
              // (test MAX : un congé avec raccord non tangent quelque part reste noir).
              if(sharp&&fl.length>=2){
                // le drapeau OCCT dit « vive » : on le MET À L'ÉPREUVE du point de
                // vue géométrique avant de l'accepter (toutes les paires de faces).
                let mesure=false,maxA=0;
                test_paires:
                for(let i=0;i<fl.length;i++){
                  for(let j=i+1;j<fl.length;j++){
                    const E1=faces[fl[i]],E2=faces[fl[j]];
                    try{
                      const g1=new occt.BRepAdaptor_Curve2d_2(e,E1);bin.push(g1);
                      const g2=new occt.BRepAdaptor_Curve2d_2(e,E2);bin.push(g2);
                      const w0=g1.FirstParameter(),w1=g1.LastParameter();
                      if(!(w1>w0))continue; // arête vue comme point dans ce couple : rien à mesurer ici
                      const s1=occt.BRep_Tool.Surface_1(E1,occBinPush(bin,new occt.TopLoc_Location_1()));bin.push(s1);
                      const s2=occt.BRep_Tool.Surface_1(E2,occBinPush(bin,new occt.TopLoc_Location_1()));bin.push(s2);
                      for(const p of [0.25,0.5,0.75]){
                        const q1=g1.Value(w0+(w1-w0)*p),q2=g2.Value(w0+(w1-w0)*p);
                        bin.push(q1);bin.push(q2);
                        const n1=occSurfNormalAt(s1,q1.X(),q1.Y()),n2=occSurfNormalAt(s2,q2.X(),q2.Y());
                        if(!n1||!n2){mesure=false;break test_paires;} // mesure indisponible : verdict OCCT conservé
                        mesure=true;
                        const d=(n1[0]*n2[0]+n1[1]*n2[1]+n1[2]*n2[2])/(Math.hypot(n1[0],n1[1],n1[2])||1)/(Math.hypot(n2[0],n2[1],n2[2])||1);
                        const th=Math.acos(Math.max(-1,Math.min(1,d)))*180/Math.PI;
                        const dev=Math.min(th,180-th);
                        if(dev>maxA)maxA=dev;
                      }
                    }catch(err){mesure=false;break test_paires;}
                  }
                }
                if(mesure&&maxA<3)sharp=false; // G1 confirmé sur toute l'arête : TANGENTE (grise)
              }
              const cut=!sharp&&onC;
              const E=cut?{mid,pts:occCurvePts(ad,u0,u1),len:s.len,sharp:true,split:true}:{mid,pts:occCurvePts(ad,u0,u1),len:s.len,sharp};
              if(fl.length)E.fs=fl.slice(); // V0.23.8 : faces voisines (ordinaux) → pièce d'un STEP multi-corps
              out.push(E);
            }
          }
        }
      }catch(err){}
      ex.Next();
    }
  }catch(e){}
  occDispose(bin);
  return out;
}
function occApplyDraft(result,f){
  const warnings=[];
  const ang=draftAngleEff(f)*Math.PI/180; // V0.11.19 : signé (flip inverse le sens)
  if(!(Math.abs(ang)>1e-9))return{shape:result,warnings:['angle nul — aucune dépouille']};
  if(!f.ref||!(f.faces||[]).length)return{shape:result,warnings:['face de référence ou faces à dépouiller manquantes']};
  const ref=occFindFace(result,f.ref);
  if(!ref){f._m={m:0,t:f.faces.length};return{shape:result,warnings:[`face de référence introuvable près de (${(f.ref.pos||[]).map(v=>(+v).toFixed(1)).join(', ')}) — ni suivi d'ancre, ni proximité : re-sélectionnez-la (bouton « Changer la référence »)`]} };
  const rn=occFaceOutNormal(ref);
  if(!rn){try{ref.delete();}catch(e){}return{shape:result,warnings:['face de référence non plane/cylindrique']}};
  const rb=occFaceBox(ref);
  if(!rb){try{ref.delete();}catch(e){}return{shape:result,warnings:['face de référence illisible']}};
  // Résolution LOCALE : les handles OCCT retrouvés restent dans `got`, les références
  // durables `f.ref` / `f.faces` (pos/n/dim) ne sont JAMAIS écrasées. Les écraser avec
  // des handles rendait le document insérialisable et cassait tous les rejeux suivants
  // (occFindFace recevait un handle au lieu d'une ref → NaN → aucune face retrouvée).
  const total=(f.faces||[]).length;
  const hsAll=(f.faces||[]).map(fr=>{try{return occFindFace(result,fr)||null;}catch(e){return null;}});
  const got=hsAll.filter(Boolean);
  const miss=total-got.length;
  if(!got.length){
    try{ref.delete();}catch(e){}
    f._m={m:0,t:total};
    return{shape:result,warnings:[`aucune des ${total} face(s) visée(s) n'est retrouvée`]};
  }
  if(miss)warnings.push(`${miss} face(s) visée(s) introuvable(s) sur la pièce courante`);
  f._m={m:got.length,t:total};
  // `run` prend des handles DÉJÀ résolus (pas de double occFindFace) et ne les détruit
  // pas : c'est l'appelant qui libère `got`/`ref` une fois le solide de sortie construit.
  const run=list=>{
    if(!list.length)throw new Error('aucune face retrouvable');
    return occDraftOnce(result,{pos:rb.pos,n:rn},list,ang,{thin:true});
  };
  const dropShape=s=>{try{if(s&&s.shape)s.shape.delete();}catch(e){}};
  let r=null,echec=null;
  try{r=run(got);}catch(e){echec=e;}
  if(!r){
    const garde=[];
    for(const h of got){
      try{const t=run(garde.concat([h]));dropShape(t);garde.push(h);}catch(e2){/* cette face-là est écartée */}
    }
    if(!garde.length){
      got.forEach(g=>{try{g.delete();}catch(e){}});
      try{ref.delete();}catch(e2){}
      const m=echec&&echec.message||echec;
      const lisible=/^\d+$/.test(String(m))
        ?`le moteur de dépouille a refusé la géométrie (code ${m})`
        :m;
      return{shape:result,warnings:[`dépouille impossible — ${lisible}. Vérifiez que chaque face retenue touche encore le plan neutre.`],fatal:true};
    }
    r=run(garde);
    f._m={m:garde.length,t:total};
    warnings.push(`dépouillage partiel : ${garde.length}/${total} face(s) appliquée(s), `+
      `${total-garde.length} écartée(s) par le moteur`);
  }
  try{
    const s=r.shape;
    if(r.refused&&r.refused.length){
      const ou=r.refused.map(p=>p?'('+p.map(v=>v.toFixed(1)).join(' ; ')+') mm':'inconnue');
      warnings.push(`${r.refused.length} face(s) non dépouillée(s) — elle(s) ne touche(nt) pas le plan neutre : ${ou.slice(0,3).join(', ')}${r.refused.length>3?'…':''}`);
    }
    if(r.thin)warnings.push(occDraftThinMsg(r.thin));
    let out=s;
    try{out=occUnify(s);}catch(e){}
    if(out!==s){try{s.delete();}catch(e){} }
    got.forEach(g=>{try{g.delete();}catch(e){} });
    try{ref.delete();}catch(e){}
    try{result.delete();}catch(e){}
    return{shape:out,warnings};
  }catch(e){
    got.forEach(g=>{try{g.delete();}catch(e2){}});
    try{ref.delete();}catch(e2){}
    return{shape:result,warnings:[`dépouille impossible (${(e&&e.message)||e})`],fatal:true};
  }
}
