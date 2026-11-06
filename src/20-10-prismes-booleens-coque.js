/* ----- congés 3D (arêtes verticales) : sélection en 3D, insertion paramétrique dans l'esquisse ----- */
function chainNodesOf(chain){
  const nodes=[chain[0].from];
  chain.forEach(st=>{const ed=st.ed;nodes.push(ed.a===st.from?ed.b:ed.a);});
  return nodes;
}
function pip(pt,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
    if(((yi>pt[1])!==(yj>pt[1]))&&(pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}
let filSeq=1;
function insertSketchFillet(data,fx,fy,r,fxPid){
  // fxPid (id de point d'esquisse) = nommage persistant : le coin suit les éditions.
  // Sans pid (anciens projets), repli sur la proximité 0.5 mm.
  const tr=skLoopTrace(data);
  for(const L of tr.loops){
    const ch=L.chain,nodes=chainNodesOf(ch),m=nodes.length-1;
    if(m<2)continue;
    for(let i=0;i<m;i++){
      const pid=nodes[i],V=data.points[pid];
      if(!V)continue;
      if(fxPid){if(pid!==fxPid)continue;}
      else if(Math.hypot(V.x-fx,V.y-fy)>0.5)continue;
      const pPrev=nodes[(i-1+m)%m],pNext=nodes[(i+1)%m];
      const eIn=ch[(i-1+m)%m].ed,eOut=ch[i].ed;
      if(eIn.kind!=='line'||eOut.kind!=='line')return{ok:false,warn:'coin sur arc : ignoré'};
      const A=data.points[pPrev],B=data.points[pNext];
      // Même math que l'outil interactif (filletCornerGeom, 50) : un seul calcul de coin.
      const g=filletCornerGeom(A,V,B,r);
      if(!g.ok)return{ok:false,warn:g.warn};
      const rEff=g.rEff;
      const T1x=g.T1.x,T1y=g.T1.y,T2x=g.T2.x,T2y=g.T2.y;
      const C1=[g.C1.x,g.C1.y],C2=[g.C2.x,g.C2.y];
      const rings=tr.loops.map(c2=>chainNodesOf(c2.chain).slice(0,-1).map(p=>{const q=data.points[p];return[q.x,q.y];}));
      const in1=rings.reduce((s,rg)=>s+(pip(C1,rg)?1:0),0)%2===1;
      const in2=rings.reduce((s,rg)=>s+(pip(C2,rg)?1:0),0)%2===1;
      const C=in1?C1:(in2?C2:null);
      if(!C)return{ok:false,warn:'côté matière indéterminé'};
      const idT1='fc'+(filSeq++)+'a',idT2='fc'+(filSeq++)+'b',idC='fc'+(filSeq++)+'c',idA='fc'+(filSeq++)+'e';
      data.points[idT1]={x:T1x,y:T1y};data.points[idT2]={x:T2x,y:T2y};data.points[idC]={x:C[0],y:C[1]};
      const entIn=eIn.e,entOut=eOut.e;
      if(entIn.p1===pid)entIn.p1=idT1;else entIn.p2=idT1;
      if(entOut.p1===pid)entOut.p1=idT2;else entOut.p2=idT2;
      // arcAngles() renvoie toujours le CCW pa→pb : on ordonne pa/pb pour que
      // cet intervalle soit le petit arc (<180°, celui qui fait face au coin).
      // Sinon, selon le sens de la boucle (CW/CCW), on obtenait le grand arc
      // complémentaire (270° au lieu de 90°) : le « filet à l'envers ».
      let pa=idT1,pb=idT2;
      {
        const b1=Math.atan2(T1y-C[1],T1x-C[0]),b2=Math.atan2(T2y-C[1],T2x-C[0]);
        let d=(b2-b1)%(Math.PI*2);if(d<=0)d+=Math.PI*2;
        if(d>Math.PI){pa=idT2;pb=idT1;}
      }
      data.entities.push({id:idA,t:'arc',pc:idC,pa,pb,r:rEff});
      return{ok:true,rApplied:rEff};
    }
  }
  return{ok:false,warn:'arête introuvable (esquisse modifiée ?)'};
}
 function applyFilletsToSketch(sk,fils){
   const clone={points:JSON.parse(JSON.stringify(sk.points||{})),entities:JSON.parse(JSON.stringify(sk.entities||[])),
     plane:sk.plane,origin:sk.origin?[sk.origin[0],sk.origin[1],sk.origin[2]]:[0,0,0],
     axU:sk.axU&&sk.axU.slice(),axV:sk.axV&&sk.axV.slice(),axN:sk.axN&&sk.axN.slice()};
   const warnings=[],done=[];
   for(const f of fils){
     if(!(f.radius>0)){warnings.push('Congé : rayon invalide, ignoré.');continue;}
     for(const c of (f.corners||[])){
       // Rebranchement : ancien projet sans pid, ou pid orphelin (point GC) →
       // rattache le coin au point d'esquisse le plus proche (suit les cotes ensuite).
       if(!c.pid||!sk.points[c.pid]){
         let best=null,bd=1e9;
         Object.keys(sk.points||{}).forEach(pid=>{const p=sk.points[pid];if(!p)return;
           const d=Math.hypot(p.x-c.x,p.y-c.y);if(d<bd){bd=d;best=pid;}});
         if(best)c.pid=best;
       }
       if(c.pid&&done.some(a=>a.pid===c.pid))continue;
       if(!c.pid&&done.some(a=>Math.hypot(a.x-c.x,a.y-c.y)<0.5))continue;
       const res=insertSketchFillet(clone,c.x,c.y,f.radius,c.pid);
       if(res.ok){
         done.push({x:c.x,y:c.y,pid:c.pid,rApplied:res.rApplied||f.radius});
         if(res.rApplied&&res.rApplied<f.radius-1e-6)warnings.push('Congé R'+f.radius+' → R'+res.rApplied.toFixed(2)+' en ('+c.x+', '+c.y+') : rayon plafonné (coin presque tangent)');
       } else warnings.push('Congé R'+f.radius+' en ('+c.x+', '+c.y+') : '+res.warn);
     }
   }
   return{sk:clone,warnings,applied:done.length,radii:done};
 }
/* ================= noyau exact OCCT : prismes BRep + booléens + tessellation =================
   Validé par exécution : MakeEdge_3/ gp_Circ_2+MakeEdge_10 / MakeWire_1 / MakeFace_15 /
   MakePrism_1 / Fuse_3 / Cut_3 / MakeFillet+Add_2 / IncrementalMesh_2 / Triangulation. */
function occHas(){return occtReady&&occt;}
function occBinPush(bin,h){if(h)bin.push(h);return h;}
function occDispose(list){(list||[]).forEach(h=>{try{h.delete();}catch(e){}});}
// V0.64.3 : le noyau rend une COPIE à chaque appel qui rend un objet (Current, FindKey, Corner…, Direction…), à
// libérer une par une : rien ne le fait à notre place. Une copie de forme oubliée garde aussi en vie la géométrie
// et le maillage qu'elle désigne, même une fois le solide supprimé. Vérifié par test_fuite_noyau.
function occFree(h){try{if(h&&h.delete)h.delete();}catch(e){}}
function occCastLibre(c,cast){try{return cast(c);}finally{occFree(c);}} // transtypage : la source part, le résultat reste
function occFaceCur(x){return occCastLibre(x.Current(),c=>occt.TopoDS.Face_1(c));}
function occEdgeCur(x){return occCastLibre(x.Current(),c=>occt.TopoDS.Edge_1(c));}
function occSolidCur(x){return occCastLibre(x.Current(),c=>occt.TopoDS.Solid_1(c));}
function occShellCur(x){return occCastLibre(x.Current(),c=>occt.TopoDS.Shell_1(c));}
function occXyz(p){try{return[p.X(),p.Y(),p.Z()];}finally{occFree(p);}} // lit un point / une direction, puis le libère
function occAvec(h,fn){try{return fn(h);}finally{occFree(h);}} // prête h à fn le temps de l'appel
function occClassifier(shape){
  // Point dedans / dehors RAPIDE (V0.44.1) : même usage que BRepClass3d_SolidClassifier_2
  // (Perform(p,tol), State(), delete()). Sous OCCT 8 le classifieur coûte ~22 ms par point sur un
  // corps fileté (hélices), contre ~0,5 ms pour une parité de rayon (IntCurvesFace) — même verdict
  // mesuré. Deux rayons obliques : s'ils ne sont pas d'accord (rayon qui frôle une arête), ou si le
  // point est sur une face, le vrai classifieur tranche.
  let I=null,cl=null,st=null;
  const D=[[0.5773,0.5774,0.5773],[-0.2673,0.5345,0.8018]];
  const slow=(p,tol)=>{if(!cl)cl=new occt.BRepClass3d_SolidClassifier_2(shape);cl.Perform(p,tol);return cl.State();};
  const ray=(p,d,tol)=>{
    const dd=new occt.gp_Dir_4(d[0],d[1],d[2]),L=new occt.gp_Lin_3(p,dd);
    try{
      I.Perform_1(L,-tol,1e7);if(!I.IsDone())return -1;
      let c=0;for(let k=1;k<=I.NbPnt();k++){const w=I.WParameter(k);if(w<=tol)return -1;c++;}
      return c&1;
    }finally{try{L.delete();}catch(e){}try{dd.delete();}catch(e){}}
  };
  return{
    Perform(p,tol){
      const t=Math.max(+tol||0,1e-7);
      try{
        if(!I){I=new occt.IntCurvesFace_ShapeIntersector();I.Load(shape,1e-6);}
        const a=ray(p,D[0],t),b=a<0?-1:ray(p,D[1],t);
        if(a>=0&&a===b){st=a?occt.TopAbs_State.TopAbs_IN:occt.TopAbs_State.TopAbs_OUT;return;}
      }catch(e){}
      st=slow(p,tol);
    },
    State(){return st;},
    delete(){try{if(I)I.delete();}catch(e){}try{if(cl)cl.delete();}catch(e){}I=cl=null;}
  };
}
function occW(sk,x,y){ // sketch 2D -> monde
  const{u,v,n,o}=sketchBasis(sk);
  return[o.x+u.x*x+v.x*y,o.y+u.y*x+v.y*y,o.z+u.z*x+v.z*y];
}
function occWireFromChain(sk,tr,chain,bin,z0,cotes){
  // cotes (facultatif, noms uniques) : reçoit {e:arête du contour,id:entité d'esquisse}
  // Construit un TopoDS_Wire fermé en coords monde depuis une chaîne skLoopTrace.
  // Sens préservé (arcs CW via .Reversed()). Jette une Error en cas d'échec.
  // z0 = décalage du plan de construction le long de n (prisme décalé : plage [lo,hi]).
  const TAU=Math.PI*2,norm=t=>((t%TAU)+TAU)%TAU;
  const{u,v,n}=sketchBasis(sk);
  // Repère droit ou MIRROIR (gaucher) ? Une esquisse miroir (symétrie) garde les mêmes
  // coords 2D mais son repère est gaucher : axU×axV opposé à +n. Le sens trigo 2D y
  // tourne alors à l'envers autour de +n — il faut en tenir compte pour les arcs.
  let gaucher=false;
  try{
    const cx=u.y*v.z-u.z*v.y,cy=u.z*v.x-u.x*v.z,cz=u.x*v.y-u.y*v.x;
    gaucher=(cx*n.x+cy*n.y+cz*n.z)<0;
  }catch(e){}
  const dz=z0||0;
  const OP=w=>dz?[w[0]+n.x*dz,w[1]+n.y*dz,w[2]+n.z*dz]:w;
  const dir=occBinPush(bin,new occt.gp_Dir_4(n.x,n.y,n.z));
  const PW=(x,y)=>{const w=OP(occW(sk,x,y));return occBinPush(bin,new occt.gp_Pnt_3(w[0],w[1],w[2]));};
  const mkW=occBinPush(bin,new occt.BRepBuilderAPI_MakeWire_1());
  const nodes=chainNodesOf(chain);
  // MakeWire recopie l'arête pour partager les sommets : on retient celle du contour
  const noteCote=ed=>{if(cotes&&ed&&ed.e&&ed.e.id!=null)cotes.push({e:occBinPush(bin,mkW.Edge()),id:ed.e.id});};
  const projOnCirc=(Cw,r,a)=>{const w=OP(occW(sk,Cw.x+r*Math.cos(a),Cw.y+r*Math.sin(a)));return occBinPush(bin,new occt.gp_Pnt_3(w[0],w[1],w[2]));};
  for(let i=0;i<nodes.length-1;i++){
    const st=chain[i],ed=st.ed;
    const toId=(ed.a===st.from)?ed.b:ed.a;
    if(ed.kind==='line'){
      const A=tr.pts[st.from],B=tr.pts[toId];
      if(!A||!B)throw new Error('ligne incomplète');
      const me=occBinPush(bin,new occt.BRepBuilderAPI_MakeEdge_3(PW(A.x,A.y),PW(B.x,B.y)));
      me.Build();if(!me.IsDone())throw new Error('arête ligne impossible');
      mkW.Add_1(occBinPush(bin,me.Edge()));noteCote(ed);
    }else if(ed.kind==='spline'){
      // 2026-10-29 : spline d'esquisse = B-spline EXACTE (mêmes pôles et nœuds que le dessin 2D, 50-esquisse-6),
      // pôles posés dans le plan par la même application affine que les lignes : bouts identiques aux voisines
      const bs=ed.bs;if(!bs||!bs.P||bs.P.length<(bs.p||SK_SPL_DEG)+1)throw new Error('spline invalide');
      const poles=occBinPush(bin,new occt.TColgp_Array1OfPnt_2(1,bs.P.length));
      bs.P.forEach((q,i)=>poles.SetValue(i+1,PW(q[0],q[1])));
      const km=skBsKnotMults(bs.U);
      const kn=occBinPush(bin,new occt.TColStd_Array1OfReal_2(1,km.k.length)),mu=occBinPush(bin,new occt.TColStd_Array1OfInteger_2(1,km.k.length));
      km.k.forEach((v,i)=>{kn.SetValue(i+1,v);mu.SetValue(i+1,km.m[i]);});
      const h=occBinPush(bin,new occt.Handle_Geom_Curve_2(new occt.Geom_BSplineCurve_1(poles,kn,mu,bs.p||SK_SPL_DEG,false))); // la poignée possède la courbe
      const me=occBinPush(bin,new occt.BRepBuilderAPI_MakeEdge_24(h));
      me.Build();if(!me.IsDone())throw new Error('arête spline impossible');
      let e=occBinPush(bin,me.Edge());if(ed.a!==st.from)e=occBinPush(bin,occCastLibre(e.Reversed(),c=>occt.TopoDS.Edge_1(c)));
      mkW.Add_1(e);noteCote(ed);
    }else{
      const a=ed.e,Cc=tr.pts[a.pc];
      const an=arcAngles(sk,a);if(!an||!Cc)throw new Error('arc invalide');
      const Cw=OP(occW(sk,Cc.x,Cc.y));
      // Sens du cercle : en repère gaucher (esquisse miroir), le trigo 2D tourne à
      // l'envers autour de +n. Construire le cercle autour de +n y faisait passer les
      // arcs du mauvais côté (constaté : slot miroir amputé de ses extrémités R4 —
      // outil large de 52 au lieu de 60). On oriente donc le cercle selon le repère.
      const dirC=gaucher?occBinPush(bin,new occt.gp_Dir_4(-n.x,-n.y,-n.z)):dir;
      const ax=occBinPush(bin,new occt.gp_Ax2_3(occBinPush(bin,new occt.gp_Pnt_3(Cw[0],Cw[1],Cw[2])),dirC));
      const circ=occBinPush(bin,new occt.gp_Circ_2(ax,a.r));
      const Pf=tr.pts[st.from],Pt=tr.pts[toId];
      const aF=Math.atan2(Pf.y-Cc.y,Pf.x-Cc.x),aT=Math.atan2(Pt.y-Cc.y,Pt.x-Cc.x);
      const dEnt=an.a2-an.a1;
      if(Math.abs(dEnt-TAU)<1e-6){
        // V0.11.5 : cercle complet = UNE arête fermée (et non 2 moitiés) → le prisme a UN
        // cylindre, sans arête de jonction ; sa projection en esquisse est un seul cercle.
        const m1=occBinPush(bin,new occt.BRepBuilderAPI_MakeEdge_8(circ));m1.Build();
        if(!m1.IsDone())throw new Error('cercle complet impossible');
        mkW.Add_1(m1.Edge());noteCote(ed);
        continue;
      }
      // Sens réel : le départ coïncide-t-il avec a1 (sens CCW de l'entité) ou a2 (retour CW) ?
      // (Comparer des distances seules est ambigu pour les demi-cercles : π dans les 2 sens.)
      const dA1=Math.min(norm(aF-an.a1),TAU-norm(aF-an.a1));
      const dA2=Math.min(norm(aF-(an.a2-TAU)),TAU-norm(aF-(an.a2-TAU)));
      let ccw=dA1<=dA2;
      let P1,P2,rev=false;
      if(ccw){P1=projOnCirc(Cc,a.r,aF);P2=projOnCirc(Cc,a.r,aT);}
      else{P1=projOnCirc(Cc,a.r,aT);P2=projOnCirc(Cc,a.r,aF);rev=true;}
      const me=occBinPush(bin,new occt.BRepBuilderAPI_MakeEdge_10(circ,P1,P2));
      me.Build();if(!me.IsDone())throw new Error('arête arc impossible');
      // Note : .Reversed() rend un TopoDS_Shape -> recast obligatoire en TopoDS_Edge.
      let e=occBinPush(bin,me.Edge());if(rev)e=occBinPush(bin,occCastLibre(e.Reversed(),c=>occt.TopoDS.Edge_1(c)));
      mkW.Add_1(e);noteCote(ed);
    }
  }
  mkW.Build();if(!mkW.IsDone())throw new Error('contour non fermé (wire)');
  return mkW.Wire();
}
function occPrismOfChain(sk,tr,chain,distance,area,z0){
  // Face plane au plan z0 (contour CCW autour de +n) puis prisme de longueur distance
  // vers +n : distance>0 toujours (la plage [lo,hi] est gérée par z0=lo, longueur hi-lo).
  const bin=[];
  try{
    const cotes=[];
    let w=occWireFromChain(sk,tr,chain,bin,z0,cotes);
    if(area<0){const w0=w;w=occCastLibre(w0.Reversed(),c=>occt.TopoDS.Wire_1(c));occFree(w0);}
    const fm=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace_15(w,true));
    fm.Build();if(!fm.IsDone())throw new Error('face impossible');
    const{u,v,n}=sketchBasis(sk);
    const vec=occBinPush(bin,new occt.gp_Vec_4(n.x*distance,n.y*distance,n.z*distance));
    const pr=occBinPush(bin,new occt.BRepPrimAPI_MakePrism_1(occBinPush(bin,fm.Face()),vec,false,true));
    pr.Build();if(!pr.IsDone())throw new Error('prisme impossible');
    const s=pr.Shape();
    nomsPrismeFaces(pr,s,cotes);
    try{w.delete();}catch(e){}
    return{shape:s,bin};
  }catch(err){occDispose(bin);throw err;}
}
function extrudeSpan(f){
  // Plage [lo,hi] le long de la normale d'esquisse (0 = plan). f.mid = symétrique/miroir
  // (distance = course TOTALE, prisme de -|d|/2 à +|d|/2) ; sinon distance signée classique.
  // far = sens de la flèche d'extrusion (1 = +n). Toute la géométrie (prismes, rims,
  // plans d'ancrage, hôtes de faces) passe par cette fonction.
  // A travers tout : l'outil ne couvre QUE l'étendue réelle du solide projetée sur l'axe
  // (pas tout l'espace) — repli sur une grande course si aucun solide n'est encore résolu.
  const THROUGH=1e4;
  // (même miroir f.flip que ci-dessous — factorisé pour ne pas diverger)
  const flipSp=(r,unres)=>{
    let sp={lo:r.lo,hi:r.hi,far:1};
    if(unres)sp.unres=true;
    if(f&&f.flip)sp={lo:-sp.hi,hi:-sp.lo,far:-sp.far,unres:sp.unres};
    return sp;
  };
  if(f&&f.through){
    let r=null;
    if(f.sketchId){
      const sk=doc.sketches.find(s=>s.id===f.sketchId);
      if(sk){try{const B=sketchBasis(sk);r=throughPartRange(B);}catch(e){}}
    }
    if(r)return flipSp(r);
    const h=THROUGH/2;
    // unres : aucun solide disponible pour mesurer l'étendue réelle — les appelants qui
    // ANCRENT une géométrie (hôtes de faces) doivent alors NE PAS bouger (sinon l'origine
    // part à ±5000mm et le rejeu suivant la « répare » → rejeu imbriqué inutile).
    return flipSp({lo:-h,hi:h},true);
  }
  const raw=(f&&f.distance!==undefined&&f.distance!==null&&isFinite(+f.distance))?+f.distance:10;
  let sp;
  if(f&&f.mid){const h=Math.abs(raw)/2;sp={lo:-h,hi:h,far:raw<0?-1:1};}
  else sp={lo:Math.min(0,raw),hi:Math.max(0,raw),far:raw<0?-1:1};
  // Inversion du sens (f.flip) : miroir géométrique pur de la course par rapport au plan
  // d'esquisse — l'opération (Plot = ajout, Poche = retrait) est INCHANGÉE, seul le côté
  // change. Tout passe par ici (prismes, rims, ancrages, hôtes), donc tout suit ensemble.
  if(f&&f.flip)sp={lo:-sp.hi,hi:-sp.lo,far:-sp.far};
  return sp;
}
let lastSolidBodies=[];
// Solide déjà reconstruit dans le rejeu EN COURS (voie exacte) : c'est la seule référence
// fide��le. Avant, l'étendue était mesurée sur les corps AFFICHÉS, c'est-à-dire ceux de
// l'ÉDITION PRÉCÉDENTE : après avoir changé la hauteur d'une base, l'outil d'une découpe
// « à travers tout » se retrouvait hors du solide et la découpe disparaissait (il fallait
// alors un « Hard » pour revenir — le réservoir vidé et le repli s activait).
let occThroughBase=null;
function occSpanFromShape(shape,B){
  // Boîte englobante du solide exact projetée sur l'axe de l'esquisse.
  if(!shape||!B)return null;
  try{
    const box=new occt.Bnd_Box_1();
    let a,b;
    try{occt.BRepBndLib.Add(shape,box,true);a=occXyz(box.CornerMin());b=occXyz(box.CornerMax());}finally{occFree(box);}
    // Les 8 coins : deux coins opposés ne suffisent que si l'axe penche vers (+,+,+). Barquette,
    // Ø30 incliné à 20° au coin de la pièce : les copies de la symétrie double (axe (−,+,+)…)
    // recevaient un outil trop court, qui enlevait 0 à 1923 mm³ au lieu de 7475.
    const xs=[a[0],b[0]],ys=[a[1],b[1]],zs=[a[2],b[2]];
    let mn=Infinity,mx=-Infinity;
    for(const x of xs)for(const y of ys)for(const z of zs){
      const d=(x-B.o.x)*B.n.x+(y-B.o.y)*B.n.y+(z-B.o.z)*B.n.z;
      if(d<mn)mn=d;if(d>mx)mx=d;
    }
    if(!(mx>mn&&isFinite(mn)&&isFinite(mx)))return null;
    const m=Math.max(1,(mx-mn)*0.01);
    return{lo:mn-m,hi:mx+m};
  }catch(e){return null;}
}
function throughPartRange(B){
  // Projection de la pièce sur l'axe de l'esquisse : le prisme « à travers tout » s'arrête
  // aux limites réelles du solide (+marge), il ne traverse plus tout l'espace disponible.
  // Corps affichés courants, puis corps du dernier rebuild réussi (les anciens meshes ne
  // sont libérés qu'après le commit du nouveau — leur lecture reste sûre pendant la
  // construction de la géométrie où bodies vient d'être vidé).
  if(!B)return null;
  // 1) le solide du rejeu en cours (fideèle, sans historique)
  const live=occSpanFromShape(occThroughBase,B);
  if(live)return live;
  // 2) repli : les corps affichés (repli du moteur maillage, sans BRep disponible)
  const pool=bodies&&bodies.length?bodies:lastSolidBodies;
  let mn=Infinity,mx=-Infinity;
  for(const b of pool){
    if(b.ghost||!b.mesh||!b.mesh.geometry)continue;
    const pos=b.mesh.geometry.attributes&&b.mesh.geometry.attributes.position;
    if(!pos||pos.count<3)continue;
    try{b.mesh.updateMatrixWorld();}catch(e){}
    const m=b.mesh.matrixWorld,e=m&&m.elements||null;
    for(let i=0;i<pos.count;i++){
      const vx=pos.getX(i),vy=pos.getY(i),vz=pos.getZ(i);
      let wx=vx,wy=vy,wz=vz;
      if(e){
        wx=e[12]+e[0]*vx+e[4]*vy+e[8]*vz;
        wy=e[13]+e[1]*vx+e[5]*vy+e[9]*vz;
        wz=e[14]+e[2]*vx+e[6]*vy+e[10]*vz;
      }
      const d=(wx-B.o.x)*B.n.x+(wy-B.o.y)*B.n.y+(wz-B.o.z)*B.n.z;
      if(d<mn)mn=d;if(d>mx)mx=d;
    }
  }
  if(!(mx>mn&&isFinite(mn)&&isFinite(mx)))return null;
  const m=Math.max(1,(mx-mn)*0.01);
  return{lo:mn-m,hi:mx+m};
}
function occSpanPrism(sk,tr,chain,sp,area){
  // Prisme UNIQUE sur la plage {lo,hi} : face construite au plan décalé z0=lo le long de n,
  // puis un seul prisme de longueur hi-lo vers +n. Pas de fusion de deux prismes → aucune
  // couture coplanaire au plan médian : en Extrusion Miroir chaque face verticale reste
  // UNE face (comme en un seul côté), et le trou/découpe en plage couvrante aussi.
  const len=sp.hi-sp.lo;
  if(!(len>1e-9))throw new Error('prisme vide (course nulle)');
  return occPrismOfChain(sk,tr,chain,len,area,sp.lo);
}
// Ces constructeurs à deux solides calculent déjà le booléen : un Build() de plus le refait en entier.
function occFuse(a,b){
  const f=new occt.BRepAlgoAPI_Fuse_3(a,b);
  const ok=f.IsDone();const s=ok?f.Shape():null;
  if(s)nomsTransmet([a,b],f,s);
  try{f.delete();}catch(e){}
  if(!ok||!s)throw new Error('fusion impossible');
  return s;
}
function occCut(a,b){
  const c=new occt.BRepAlgoAPI_Cut_3(a,b);
  const ok=c.IsDone();const s=ok?c.Shape():null;
  if(s)nomsTransmet([a,b],c,s);
  try{c.delete();}catch(e){}
  if(!ok||!s)throw new Error('découpe impossible');
  return s;
}
// V0.21.16 : découpe par un COMPOSÉ dont les solides se chevauchent (perçage : fût + gorge
// du filet modélisé). Un composé passé comme outil unique doit être sans auto-interférence :
// sinon le cœur du trou restait en 2ᵉ solide. Chaque enfant devient un outil de la liste,
// le noyau les traite toujours en UNE passe.
// Composé dont TOUS les enfants sont des composés = ÉTAPES découpées l'une après l'autre
// (filet modélisé : avant-trou, puis filet, puis tête — src/76, occShapeOfHole).
function occCutEach(a,b){
  const CP=occt.TopAbs_ShapeEnum.TopAbs_COMPOUND;
  if(!b||b.ShapeType()!==CP)return occCut(a,b);
  const kids=[];
  const it=new occt.TopoDS_Iterator_2(b,true,true);
  try{for(;it.More();it.Next())kids.push(it.Value());}finally{try{it.delete();}catch(e){}}
  try{return occCutKids(a,b,kids);}finally{occDispose(kids);}
}
function occCutKids(a,b,kids){
  const CP=occt.TopAbs_ShapeEnum.TopAbs_COMPOUND;
  if(kids.length&&kids.every(k=>k.ShapeType()===CP)){
    let r=a;
    kids.forEach(k=>{const n=occCutEach(r,k);if(r!==a){try{r.delete();}catch(e){}}r=n;});
    return r;
  }
  const la=new occt.TopTools_ListOfShape_1(),lt=new occt.TopTools_ListOfShape_1(),c=new occt.BRepAlgoAPI_Cut_1();
  try{
    la.Append_1(a);kids.forEach(k=>lt.Append_1(k));
    // outils de perçage orientés par construction : le contrôle « solide retourné »
    // (une classification complète contre les faces du filet) est superflu
    c.SetArguments(la);c.SetTools(lt);c.SetCheckInverted(false);c.Build();
    const s=c.IsDone()?c.Shape():null;
    if(!s||s.IsNull())throw new Error('découpe impossible');
    nomsTransmet([a,b],c,s); // b : le composé porte les noms, ses enfants non
    return s;
  }finally{try{c.delete();}catch(e){}try{la.delete();}catch(e){}try{lt.delete();}catch(e){}}
}
function occCommon(a,b){
  const c=new occt.BRepAlgoAPI_Common_3(a,b);
  const ok=c.IsDone();const s=ok?c.Shape():null;
  if(s)nomsTransmet([a,b],c,s);
  try{c.delete();}catch(e){}
  if(!ok||!s)throw new Error('intersection impossible');
  return s;
}
// 2026-10-16-009 : COMBINER des corps (union / soustraction / intersection), comme Fusion.
function occBodyOfFeat(f){return (f&&f.body&&doc.bodies.some(e=>e.id===f.body))?f.body:(doc.bodies[0]&&doc.bodies[0].id);}
// V0.15.12 : DÉCOUPE MULTI-CORPS. Une découpe (poche, perçage, révolution en retrait) peut viser,
// en plus de son corps, d'autres corps (f.cutBodies) : elle est alors rejouée dans chacun, à sa
// place dans la timeline — comme « Objets à découper » de Fusion.
function occIsCutFeat(f){return !!f&&(f.type==='hole'||((f.type==='extrude'||f.type==='revolve'||f.type==='sweep')&&(f.op||'add')==='cut'));}
function occCutExtraBodies(f){
  if(!occIsCutFeat(f)||!Array.isArray(f.cutBodies))return [];
  const own=occBodyOfFeat(f);
  return f.cutBodies.filter((b,i,a)=>b!==own&&a.indexOf(b)===i&&doc.bodies.some(e=>e.id===b));
}
// V0.15.12 : ANTÉRIORITÉ DES CORPS. Un corps « naît » avec sa première fonction dans la
// timeline (corps d'une répétition « Nouveau corps », d'une extrusion « Nouveau corps », d'une
// scission…). Marqueur reculé avant cette naissance : le corps n'existe pas encore, on ne
// peut donc pas y créer de fonction. Un corps sans aucune fonction (créé vide) existe toujours.
function bodyBornAt(bid,idx){
  const L=doc.features||[];
  const owns=f=>f&&(f.body===bid||occSplitNewBody(f)===bid||occCutExtraBodies(f).indexOf(bid)>=0);
  const first=L.findIndex(owns);
  if(first<0)return true;
  return idx==null||idx<0||first<idx;
}
function bodyBirthFallback(bid,idx){
  // Corps où travailler quand `bid` n'est pas encore né à l'index `idx` : le corps SOURCE
  // d'une répétition « Nouveau corps » (en remontant la chaîne), sinon le corps de la
  // dernière fonction rejouée, sinon le premier corps né.
  const born=b=>!!b&&doc.bodies.some(e=>e.id===b)&&bodyBornAt(b,idx);
  let cur=bid;
  for(let k=0;k<8&&cur&&!born(cur);k++){
    const rp=(doc.features||[]).find(r=>r&&r.type==='repeat'&&r.bodyMap&&Object.keys(r.bodyMap).some(q=>r.bodyMap[q]===cur));
    if(!rp)break;
    const key=Object.keys(rp.bodyMap).find(q=>rp.bodyMap[q]===cur);
    cur=key?key.split('@')[0]:null;
  }
  if(born(cur))return cur;
  const L=(doc.features||[]).slice(0,idx==null||idx<0?undefined:idx);
  for(let i=L.length-1;i>=0;i--){const b=occBodyOfFeat(L[i]);if(born(b))return b;}
  const e=doc.bodies.find(x=>born(x.id));
  return e?e.id:(doc.bodies[0]&&doc.bodies[0].id);
}
function occSplitNewBody(f){
  // Corps NEUF né d'une scission de corps (xsplit mode 'body'), ou null : la fonction est
  // rejouée dans son corps (côté gardé) ET en tête du corps neuf (l'autre côté).
  // Échelle « Nouveau corps » (bscale copy, 85-echelle-corps) : même mécanique, le corps
  // source reste tel quel et la copie mise à l'échelle naît dans le corps neuf.
  if(!f||!f.newBody||!((f.type==='xsplit'&&f.mode==='body')||(f.type==='bscale'&&f.copy)))return null;
  return (f.newBody!==occBodyOfFeat(f)&&doc.bodies.some(e=>e.id===f.newBody))?f.newBody:null;
}
function occCombinePrefix(f,tb){
  // fonctions du corps outil tb AVANT la combinaison f (timeline visible)
  const vis=doc.features.filter(x=>x.visible!==false&&!(occSkipFeat&&x.id===occSkipFeat));
  const i=vis.indexOf(f);
  return vis.slice(0,i<0?vis.length:i).filter(x=>x.type!=='repeat'&&(occBodyOfFeat(x)===tb||occSplitNewBody(x)===tb||occCutExtraBodies(x).indexOf(tb)>=0));
}
function occCombineTool(f,tb,bin){
  const list=occCombinePrefix(f,tb);if(!list.length)return null;
  // V0.47.0 : corps outil fait d'un seul import (STEP, corps dérivé) : il entre aussi dans la
  // chaîne exacte, sinon « corps outil vide » et la soustraction ne faisait rien
  const sf=occStepForce;occStepForce=true;
  let r;try{r=occReplayBody(tb,list);}finally{occStepForce=sf;}
  bin.push(...(r.bin||[]));(r.itemShapes||[]).forEach(s=>{if(s&&s!==r.shape)bin.push(s);});
  return r.shape||null;
}
function occUnify(s){
  // Uniformise une fusion additive (ShapeUpgrade_UnifySameDomain) : les faces coplanaires
  // voisines sont recollées → plus de couture horizontale quand un solide est "Uni" par
  // l'option Additif (empilement de deux fonctions, pastilles jointives…). Idempotent,
  // n'efface les arêtes réelles que si elles sont superflues, jamais d'exception :
  // en cas d'échec la shape d'origine est rendue telle quelle. Sa propre shape (s) est
  // supprimée si l'unification en produit une nouvelle.
  if(!s||!occtReady||!occt||!occt.ShapeUpgrade_UnifySameDomain_2)return s;
  let u=null,keep=[];
  try{
    u=new occt.ShapeUpgrade_UnifySameDomain_2(s,true,true,false);
    keep=occUnifyKeepEdges(s);
    keep.forEach(e=>u.KeepShape(e));
    u.Build();
    const r=u.Shape();
    if(r&&r!==s){nomsApresUnify(u,s,r);try{s.delete();}catch(e){}return r;}
    return s;
  }catch(e){
    return s;
  }finally{
    try{if(u)u.delete();}catch(e){}
    occDispose(keep);
  }
}
function occUnifyKeepEdges(s){
  // GARDE-FOU (2026-10-27) : UnifySameDomain BOUCLE SANS FIN (wasm figé, > 60 s) quand il
  // recolle deux faces de révolution du même domaine mais de paramétrage incompatible : axe
  // de sens opposé (deux révolutions de 90° qui se touchent par leur face d'extrémité, l'une
  // autour de +Y, l'autre autour de −Y) ou repère indirect (symétrie d'une révolution
  // partielle). Les arêtes communes à ces paires sont rendues ici pour KeepShape : les deux
  // faces restent séparées (une couture de plus), tout le reste est uni normalement.
  // Paires sûres (même sens, même main) : rien. Jamais d'exception : [] en cas d'échec.
  const out=[];
  if(!occt.BRepAdaptor_Surface_2||!occt.GeomAbs_SurfaceType)return out;
  const T=occt.GeomAbs_SurfaceType,E=occt.TopAbs_ShapeEnum,bin=[];
  const v3=p=>[p.X(),p.Y(),p.Z()];
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const tol=1e-6;
  try{
    const R=[];
    const ex=occBinPush(bin,new occt.TopExp_Explorer_2(s,E.TopAbs_FACE,E.TopAbs_SHAPE));
    for(;ex.More();ex.Next()){
      const f=occBinPush(bin,occFaceCur(ex));
      const ad=occBinPush(bin,new occt.BRepAdaptor_Surface_2(f,true));
      const t=ad.GetType();let g=null,k='',sig=[];
      if(t===T.GeomAbs_Cylinder){g=occBinPush(bin,ad.Cylinder());k='cyl';sig=[g.Radius()];}
      else if(t===T.GeomAbs_Cone){g=occBinPush(bin,ad.Cone());k='cone';sig=v3(occBinPush(bin,g.Apex())).concat([Math.abs(g.SemiAngle())]);}
      else if(t===T.GeomAbs_Sphere){g=occBinPush(bin,ad.Sphere());k='sph';sig=[g.Radius()];}
      else if(t===T.GeomAbs_Torus){g=occBinPush(bin,ad.Torus());k='tor';sig=[g.MajorRadius(),g.MinorRadius()];}
      if(!g)continue;
      const ax=occBinPush(bin,g.Position());
      R.push({f,k,sig,P:v3(occBinPush(bin,ax.Location())),D:v3(occBinPush(bin,ax.Direction())),direct:!!ax.Direct()});
    }
    for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){
      const a=R[i],b=R[j];
      if(a.k!==b.k||a.sig.length!==b.sig.length||a.sig.some((x,n)=>Math.abs(x-b.sig[n])>tol))continue;
      const c=dot(a.D,b.D);
      if(Math.abs(Math.abs(c)-1)>1e-9)continue; // axes non parallèles : pas le même domaine
      const w=sub(b.P,a.P);
      if(a.k==='sph'||a.k==='tor'?Math.hypot(...w)>tol:Math.hypot(...crs(w,a.D))>tol)continue; // axes non confondus
      if(c>0&&a.direct===b.direct)continue; // paramétrages compatibles : UnifySameDomain s'en sort
      const ea=occBinPush(bin,new occt.TopExp_Explorer_2(a.f,E.TopAbs_EDGE,E.TopAbs_SHAPE));
      for(;ea.More();ea.Next()){
        const e=occBinPush(bin,ea.Current());let com=false;
        const eb=occBinPush(bin,new occt.TopExp_Explorer_2(b.f,E.TopAbs_EDGE,E.TopAbs_SHAPE));
        for(;eb.More()&&!com;eb.Next())com=occAvec(eb.Current(),x=>e.IsSame(x));
        if(com&&!out.some(x=>x.IsSame(e)))out.push(occt.TopoDS.Edge_1(e));
      }
    }
  }catch(e){}finally{occDispose(bin);}
  return out;
}
/* ---------- découpe : recoller les faces coplanaires qu'elle a créées (V0.11.28) ----------
   Une découpe dont le fond (ou une paroi) tombe PILE dans le plan d'une face existante
   scinde cette face : encoche taillée sous un bossage jusqu'au dessus du bloc → le fond de
   l'encoche restait une « mini surface » à part du dessus (Exemples/test suppr). Les découpes
   ne passent pas par occUnify, qui effacerait aussi les coutures d'esquisse (point de scission
   d'un profil, cf. test_conge_fond_poche) et les scissions de face voulues. Ici on ne retire
   QUE les coutures planes nées de la découpe : une arête entre deux faces du même plan qui
   n'était couture ni du solide d'avant ni de l'outil. Toutes les autres arêtes sont gardées. */
function occShapeBox(s,m){
  const b=new occt.Bnd_Box_1();
  try{occt.BRepBndLib.Add(s,b,true);const a=occXyz(b.CornerMin()),z=occXyz(b.CornerMax());
    return [[a[0]-m,a[1]-m,a[2]-m],[z[0]+m,z[1]+m,z[2]+m]];}
  finally{try{b.delete();}catch(e){}}
}
function occPlaneSeams(s,box,withPts){
  // Coutures planes de s : arêtes communes à deux faces planes de même normale sortante et
  // même cote. Seules les faces qui touchent `box` sont lues (la découpe est locale).
  // Retourne {seams:[{e,mid,pts?}],bin} : l'appelant libère bin (les handles e y vivent).
  const out=[],bin=[];
  const E=occt.TopAbs_ShapeEnum,T=occt.GeomAbs_SurfaceType;
  const hit=b=>{for(let i=0;i<3;i++){if(b.pos[i]+b.dim[i]/2<box[0][i]||b.pos[i]-b.dim[i]/2>box[1][i])return false;}return true;};
  try{
    const buckets=new Map();let fi=0;
    const ex=occBinPush(bin,new occt.TopExp_Explorer_2(s,E.TopAbs_FACE,E.TopAbs_SHAPE));
    for(;ex.More();ex.Next(),fi++){
      const f=occBinPush(bin,occFaceCur(ex));
      if(box){const b=occFaceBox(f);if(!b||!hit(b))continue;}
      const ad=occBinPush(bin,new occt.BRepAdaptor_Surface_2(f,true));
      if(ad.GetType()!==T.GeomAbs_Plane)continue;
      const n=occFaceOutNormal(f);if(!n)continue;
      const L=occBinPush(bin,occBinPush(bin,ad.Plane()).Location());
      const d=n[0]*L.X()+n[1]*L.Y()+n[2]*L.Z();
      const ee=occBinPush(bin,new occt.TopExp_Explorer_2(f,E.TopAbs_EDGE,E.TopAbs_SHAPE));
      for(;ee.More();ee.Next()){
        const e=occBinPush(bin,occEdgeCur(ee));
        const c=occBinPush(bin,new occt.BRepAdaptor_Curve_2(e));
        const u0=c.FirstParameter(),u1=c.LastParameter();
        const m=occBinPush(bin,c.Value((u0+u1)/2));
        const rec={e,fi,n,d,mid:[m.X(),m.Y(),m.Z()]};
        const k=rec.mid.map(v=>v.toFixed(3)).join(',');
        const bk=buckets.get(k);
        if(!bk){buckets.set(k,[rec]);continue;}
        const twin=bk.find(o=>o.fi!==fi&&o.e.IsSame(e));
        if(twin&&twin.n[0]*n[0]+twin.n[1]*n[1]+twin.n[2]*n[2]>1-1e-9&&Math.abs(twin.d-d)<1e-6&&!out.includes(twin)){
          if(withPts){
            // 2N+1 points : les impairs mesurent la flèche des cordes (couture courbe)
            twin.pts=[];const N=32;
            for(let i=0;i<=2*N;i++){const p=occBinPush(bin,c.Value(u0+(u1-u0)*i/(2*N)));twin.pts.push([p.X(),p.Y(),p.Z()]);}
          }
          out.push(twin);
        }
        bk.push(rec);
      }
    }
  }catch(e){}
  return{seams:out,bin};
}
function occOnSeam(p,pts){
  // p est-il sur la polyligne pts (cordes paires, tolérance = flèche mesurée + 1e-4 mm) ?
  for(let i=0;i+2<pts.length;i+=2){
    const a=pts[i],b=pts[i+2],h=pts[i+1];
    const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l2=ab[0]*ab[0]+ab[1]*ab[1]+ab[2]*ab[2];
    const dSeg=q=>{let t=l2>0?((q[0]-a[0])*ab[0]+(q[1]-a[1])*ab[1]+(q[2]-a[2])*ab[2])/l2:0;t=Math.max(0,Math.min(1,t));
      return Math.hypot(q[0]-a[0]-ab[0]*t,q[1]-a[1]-ab[1]*t,q[2]-a[2]-ab[2]*t);};
    if(dSeg(p)<=1e-4+1.5*dSeg(h))return true;
  }
  return false;
}
function occUnifyCutSeams(res,prev,tool){
  // res = occCut(prev,tool). Rend res sans ses coutures planes parasites (res est supprimée
  // si une forme neuve est rendue). Jamais d'exception : en cas de doute, res telle quelle.
  if(!res||!prev||!tool||!occt.ShapeUpgrade_UnifySameDomain_2)return res;
  const bin=[];let u=null;
  try{
    const box=occShapeBox(tool,1e-3);
    const R=occPlaneSeams(res,box,false);bin.push(...R.bin);
    if(!R.seams.length)return res;
    const P=occPlaneSeams(prev,box,true),Q=occPlaneSeams(tool,null,true);
    const refs=P.seams.concat(Q.seams).map(x=>x.pts);
    occDispose(P.bin);occDispose(Q.bin);
    const drop=R.seams.filter(r=>!refs.some(pts=>occOnSeam(r.mid,pts)));
    if(!drop.length)return res;
    u=new occt.ShapeUpgrade_UnifySameDomain_2(res,true,true,false);
    const E=occt.TopAbs_ShapeEnum;
    const ex=occBinPush(bin,new occt.TopExp_Explorer_2(res,E.TopAbs_EDGE,E.TopAbs_SHAPE));
    for(;ex.More();ex.Next()){
      const e=occBinPush(bin,ex.Current());
      if(!drop.some(r=>r.e.IsSame(e)))u.KeepShape(occBinPush(bin,occt.TopoDS.Edge_1(e)));
    }
    u.Build();
    const r=u.Shape();
    if(!r||r.IsNull()||r===res)return res;
    nomsApresUnify(u,res,r);
    try{res.delete();}catch(e){}
    return r;
  }catch(e){
    return res;
  }finally{
    try{if(u)u.delete();}catch(e){}
    occDispose(bin);
  }
}

// ---------- Coque (évidage paroi mince) ----------
// Évider = creuser le solide en ne gardant qu'une PAROI d'épaisseur donnée, en
// retirant les faces d'ouverture (ex. le dessus d'une boîte → un bac ouvert).
// Noyau : BRepOffsetAPI_MakeThickSolid(S, facesARetirer, -épaisseur, tol, …).
// L'ancienne version utilisait BRepBuilderAPI_MakeShell — qui assemble une coque
// à partir de FACES, pas la conversion solide→évidé : son ctor exigeait 2 params
// (« invalid number of parameters (1) ») et l'opération n'avait aucun sens ici.
function shellName(f){
  const t=String(Math.round((+f.thick||0)*100)/100).replace('.',',');
  return `Coque ${t} mm · ${(f.faces||[]).length} face(s) retirée(s)`;
}
function occCoqueThick(result,faces,thick,join,inter){
  // Cœur MakeThickSolid partagé par toutes les recettes : join/inter paramétrables
  // (Arc direct, Intersection, …). `faces` = handles OCCT résolus, `thick` > 0 en mm.
  const bin=[];
  try{
    const L=occBinPush(bin,new occt.TopTools_ListOfShape_1());
    for(const f of faces)L.Append_1(occBinPush(bin,occt.TopoDS.Face_1(f)));
    let mk;
    if(occt.BRepOffsetAPI_MakeThickSolid_2){
      mk=occBinPush(bin,new occt.BRepOffsetAPI_MakeThickSolid_2(
        result,L,-Math.abs(thick),0.01,join,inter,false,join,false));
    }else{ // OCCT ≥ 7.6 (noyau recompilé, occt-build/) : constructeur vide + MakeThickSolidByJoin
      mk=occBinPush(bin,new occt.BRepOffsetAPI_MakeThickSolid());
      mk.MakeThickSolidByJoin(result,L,-Math.abs(thick),0.01,occt.BRepOffset_Mode.BRepOffset_Skin,
        inter,false,join,false,occBinPush(bin,new occt.Message_ProgressRange_1()));
    }
    mk.Build();
    let done=false;
    try{done=!!mk.IsDone();}catch(e){}
    if(!done)throw new Error('évidage refusé par le moteur (paroi trop épaisse ? ouverture mal placée ?)');
    const brut=mk.Shape();
    // Paroi intérieure : née de la face extérieure qu'elle double (« nom/int »)
    try{
      const T=nomsDe(result),mS=T?nomsCarteFaces(result):null;
      if(mS)try{
        nomsTransmet([result],mk,brut,{nais:(m,f)=>{
          for(let i=1;i<=mS.Size();i++){
            const nom=T.f[i-1];if(!nom)continue;
            occAvec(mS.FindKey(i),c=>nomsChaque(mk.Generated(c),y=>{const j=m.FindIndex(y);if(j>0&&!f[j-1])f[j-1]=nom+'/int';}));
          }
        }});
      }finally{try{mS.delete();}catch(e){}}
    }catch(e){}
    const out=occShapeCopy(brut);
    if(!out||out.IsNull()){try{if(out)out.delete();}catch(e){}throw new Error('solide évidé vide');}
    return out;
  }finally{occDispose(bin);}
}
function occCoqueOnce(result,faces,thick){
  // Recette « directe » (Arc) seule — aperçus et cas simples. Les appels qui
  // doivent supporter dépouille/congés passent par occCoqueRecettes (chaîne).
  return {shape:occCoqueThick(result,faces,thick,occt.GeomAbs_JoinType.GeomAbs_Arc,false)};
}
function occCoqueBBox(sh){
  // AddOptimal = boîte PRÉCISE (le Add conservateur gonfle les pôles BSpline et
  // ferait passer des junk pour du gabarit). Filet d'échec conservateur si indispo.
  const b=new occt.Bnd_Box_1();
  try{occt.BRepBndLib.AddOptimal(sh,b,true,false);}
  catch(e){try{occt.BRepBndLib.AddOptimal(sh,b);}catch(e2){try{b.delete();}catch(e){}return null;}}
  try{
    const o=occXyz(b.CornerMin()).concat(occXyz(b.CornerMax()));
    try{b.delete();}catch(e){}
    return o;
  }catch(e){try{b.delete();}catch(e2){}return null;}
}
function occCoqueVolume(sh){
  try{
    const G=new occt.GProp_GProps_1();
    occt.BRepGProp.VolumeProperties_1(sh,G,false,false,false);
    const v=G.Mass();
    try{G.delete();}catch(e){}
    return v;
  }catch(e){return null;}
}
function occCoqueNFaces(sh){
  let n=0;
  try{
    const x=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while(x.More()){n++;x.Next();}
    x.delete();
  }catch(e){}
  return n;
}
function occCoqueEvidage(base,out,thick){
  // Vrai évidage ? Le moteur rend parfois IsDone=true avec un résultat NON
  // évidé (dessus conservé, face parasite qui explose hors gabarit) — c'était le
  // bug « la coque ne marche pas toujours ». Trois critères mesurés (sondages) :
  //  · bbox serrée autour de la base, ±(2+2×paroi) — attrape le junk hors gabarit ;
  //  · ≥ +2 faces — l'évidage crée parois internes + rebord (un junk n'en crée pas) ;
  //  · volume < 0.5×base — junk ≈ 105 % de la base, évidage « partiel » ≈ 72 %,
  //    évidage réel 7..13 % : 0.5 discrimine nettement les trois familles.
  try{
    const b=occCoqueBBox(base),o=occCoqueBBox(out);
    if(!b||!o)return false;
    const m=2+2*Math.abs(+thick||0);
    for(let i=0;i<3;i++)if(o[i]<b[i]-m)return false;
    for(let i=3;i<6;i++)if(o[i]>b[i]+m)return false;
    if(occCoqueNFaces(out)-occCoqueNFaces(base)<2)return false;
    const v0=occCoqueVolume(base),v1=occCoqueVolume(out);
    if(!(typeof v0==="number"&&typeof v1==="number"))return false;
    return v1>0&&v1<v0*0.5;
  }catch(e){return false;}
}
function occCoqueValide(sh){
  try{
    const a=new occt.BRepCheck_Analyzer(sh,true);
    const v=a.IsValid_1(sh);
    try{a.delete();}catch(e){}
    return !!v;
  }catch(e){return false;}
}
function occCoqueRepare(sh){
  // ShapeFix : le résultat de conversion Arc peut être GÉOMÉTRIQUEMENT juste et
  // topologiquement invalide (3 faces/35) — le fix répare sans bouger les cotes.
  try{
    const h=new occt.Handle_Message_ProgressIndicator_1();
    const fx=new occt.ShapeFix_Shape_2(sh);
    fx.Perform(h);
    const s2=fx.Shape();
    let c=null;
    if(s2&&!s2.IsNull())c=occShapeCopy(s2);
    try{fx.delete();}catch(e){}
    try{h.delete();}catch(e){}
    return c;
  }catch(e){return null;}
}
function occCoqueRecettes(result,entries,thick){
  // Chaîne de recettes d'évidage, acceptées UNIQUEMENT après validation :
  //   1. Arc direct            — cas simples (boîte, dépouille nulle) : inchangé ;
  //   2. Intersection (jI)     — dépouille simple sans congé ;
  //   3. ConvertToBSpline+Arc  — arcs non maniables sur les surfaces de dépouille
  //      (convertir les extrusions en BSpline rend l'offset Arc calculable),
  //      suivie de ShapeFix si la topologie ressort invalide.
  // entries = [{fr,h}] : refs durables (recette 3 re-résout les refs sur la forme
  // convertie — les handles de `result` n'y sont pas valables) + handles résolus.
  const Arc=occt.GeomAbs_JoinType.GeomAbs_Arc;
  const I=occt.GeomAbs_JoinType.GeomAbs_Intersection;
  const essai=(shape,faces,join,inter)=>{
    const out=occCoqueThick(shape,faces,thick,join,inter);
    if(!occCoqueEvidage(result,out,thick)){try{out.delete();}catch(e){}return null;}
    if(occCoqueValide(out))return out;
    const fix=occCoqueRepare(out);
    if(fix&&occCoqueValide(fix)&&occCoqueEvidage(result,fix,thick)){
      try{out.delete();}catch(e){}
      return fix;
    }
    try{if(fix)fix.delete();}catch(e){}
    return out;
  };
  const hs=entries.map(e=>e.h).filter(Boolean);
  let errA=null;
  try{
    const r=essai(result,hs,Arc,false);
    if(r)return{shape:r};
  }catch(e){errA=e;}
  try{
    const r=essai(result,hs,I,true);
    if(r)return{shape:r};
  }catch(e){if(!errA)errA=e;}
  try{
    if(occt.ShapeCustom&&occt.ShapeCustom.ConvertToBSpline){
      const cv=occt.ShapeCustom.ConvertToBSpline(result,true,false,false,false);
      if(cv&&!cv.IsNull()){
        try{
          const fc=[];
          for(const e of entries){
            try{const h=occFindFace(cv,e.fr);if(h)fc.push(h);}catch(e2){}
          }
          if(fc.length){
            try{
              const r=essai(cv,fc,Arc,false);
              if(r)return{shape:r};
            }finally{fc.forEach(g=>{try{g.delete();}catch(e2){}});}
          }
        }finally{try{cv.delete();}catch(e){}}
      }else{try{if(cv)cv.delete();}catch(e){}}
    }
  }catch(e){if(!errA)errA=e;}
  throw errA||new Error('évidage refusé par le moteur (paroi trop épaisse ? ouverture mal placée ?)');
}
function occApplyCoque(result,f){
  // Rejoue l'évidage. Retourne {shape,warnings} comme occApplyDraft/occApplyMoveFace.
  // Les refs durables `f.faces` ne sont JAMAIS écrasées (même règle que le
  // dépouillage : des handles dans le document casseraient les rejeux suivants).
  const warnings=[];
  const t=+f.thick||0;
  if(!(t>1e-9))return{shape:result,warnings:['épaisseur nulle — aucune coque']};
  if(!(f.faces||[]).length)return{shape:result,warnings:['aucune face à retirer (ouverture) — la coque resterait fermée et invisible']};
  const total=(f.faces||[]).length;
  const entries=(f.faces||[]).map(fr=>{try{const h=occFindFace(result,fr);return h?{fr:fr,h:h}:null;}catch(e){return null;}}).filter(Boolean);
  const miss=total-entries.length;
  if(!entries.length){
    f._m={m:0,t:total};
    return{shape:result,warnings:[`aucune des ${total} face(s) à retirer n'est retrouvée — la pièce a changé`]};
  }
  if(miss)warnings.push(`${miss} face(s) à retirer introuvable(s) sur la pièce courante`);
  f._m={m:entries.length,t:total};
  const freeHs=list=>list.forEach(e=>{try{if(e&&e.h)e.h.delete();}catch(e2){}});
  const run=list=>{
    if(!list.length)throw new Error('aucune face retrouvable');
    return occCoqueRecettes(result,list,t);
  };
  const dropShape=s=>{try{if(s&&s.shape)s.shape.delete();}catch(e){}};
  let r=null,echec=null;
  try{r=run(entries);}catch(e){echec=e;}
  if(!r){
    // Isolation : comme le dépouillage, on cherche quelles faces le moteur refuse.
    const garde=[];
    for(const e of entries){
      try{const tst=run(garde.concat([e]));dropShape(tst);garde.push(e);}catch(e2){/* écartée */}
    }
    if(!garde.length){
      freeHs(entries);
      const m=echec&&echec.message||echec;
      return{shape:result,warnings:[`coque impossible — ${m}. Essayez une paroi plus fine ou une autre face d'ouverture.`],fatal:true};
    }
    r=run(garde);
    f._m={m:garde.length,t:total};
    warnings.push(`coque partielle : ${garde.length}/${total} face(s) retirée(s), `+
      `${total-garde.length} écartée(s) par le moteur`);
  }
  try{
    const s=r.shape;
    let out=s;
    try{out=occUnify(s);}catch(e){}
    if(out!==s){try{s.delete();}catch(e){}}
    freeHs(entries);
    try{result.delete();}catch(e){}
    return{shape:out,warnings};
  }catch(e){
    freeHs(entries);
    return{shape:result,warnings:[`coque impossible (${(e&&e.message)||e})`],fatal:true};
  }
}
