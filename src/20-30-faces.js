let occLive=null; // solide BRep affiché conservé pour le picking d'arêtes exact
function occDropLive(){if(occLive){try{occLive.shape.delete();}catch(e){}
  try{if(occLive.shapeFao)occLive.shapeFao.delete();}catch(e){}
  (occLive.preThr||[]).forEach(p=>{try{p.shape.delete();}catch(e){}});occLive=null;}}
/* ---------- déplacement d'une face (push/pull) ----------
   Principe retenu après mesure : on ne cherche pas la primitive « déplacement » du noyau
   (BRepFeat_MakeDPrism existe mais sa signature Web est ambiguë et son résultat peut être
   vide), on fait ce que fait l'utilisateur avec deux opérations que le moteur maîtrise déjà
   et qui sont vérifiées : extruder la face le long de sa normale SORTANTE, puis FUSIONNER
   (la face sort) ou SOUSTRAIRE (la face rentre). Mesuré sur une boîte 100x60x40 :
   +10 sur +X -> 110x60x40, -10 -> 90x60x40, +15 sur +Y -> 100x75x40. */

function occFaceOutNormal(f){
  // Normale SORTANTE d'une face d'un solide. La normale géométrique de BRepAdaptor ne suffit
  // pas : sur une boîte, les deux faces opposées ont la MÊME normale géométrique, et c'est
  // l'orientation de la face qui dit laquelle pointe dehors. Orientation_1() renvoie un objet
  // enum : la comparaison doit être une identité stricte, pas une comparaison de texte.
  try{
    const ad=new occt.BRepAdaptor_Surface_2(f,true);
    let n=null;
    try{
      const gt=ad.GetType();
      if(gt===occt.GeomAbs_SurfaceType.GeomAbs_Plane){
        const d=ad.Plane().Axis().Direction();n=[d.X(),d.Y(),d.Z()];
      }else if(gt===occt.GeomAbs_SurfaceType.GeomAbs_Cylinder){
        const d=ad.Cylinder().Axis().Direction();n=[d.X(),d.Y(),d.Z()];
      }
    }catch(e){}
    if(!n){try{ad.delete();}catch(e){}return null;}
    let rev=false;
    try{rev=(f.Orientation_1()===occt.TopAbs_Orientation.TopAbs_REVERSED);}catch(e){}
    try{ad.delete();}catch(e){}
    const s=rev?-1:1;
    const L=Math.hypot(n[0],n[1],n[2]);
    if(!(L>1e-9))return null;
    return [n[0]*s/L,n[1]*s/L,n[2]*s/L];
  }catch(e){return null;}
}
function occFaceBox(f){
  // Centre et dimensions d'une face : la signature qui permet de la retrouver au rejeu.
  try{
    const b=new occt.Bnd_Box_1();
    occt.BRepBndLib.Add(f,b,true);
    const a=b.CornerMin(),z=b.CornerMax();
    const out={pos:[(a.X()+z.X())/2,(a.Y()+z.Y())/2,(a.Z()+z.Z())/2],dim:[z.X()-a.X(),z.Y()-a.Y(),z.Z()-a.Z()]};
    b.delete();return out;
  }catch(e){return null;}
}
function occFaceRef(f){
  const n=occFaceOutNormal(f),b=occFaceBox(f);
  if(!n||!b)return null;
  return {pos:b.pos.map(v=>+v.toFixed(3)),dim:b.dim.map(v=>+v.toFixed(3)),n:n.map(v=>+v.toFixed(4))};
}
function faceAnchorScore(c,ref){
  // Cohérence d'une face candidate avec l'ancre d'esquisse mémorisée : la face est-elle
  // (encore) celle que l'ancre désigne ? Test en 2D esquisse (insensible aux découpes
  // qui scindent en hauteur), comme xAnchorMatch — mais pour un CENTRE DE FACE, pas un
  // milieu d'arête. Score (plus petit = mieux) ou null si incohérent.
  try{
    const a=ref.anchor;if(!a)return null;
    const s=doc.sketches.find(k=>k.id===a.sk);if(!s)return null;
    let B;try{B=sketchBasis(s);}catch(e){return null;}
    const dx=c.b.pos[0]-B.o.x,dy=c.b.pos[1]-B.o.y,dz=c.b.pos[2]-B.o.z;
    const q=[dx*B.u.x+dy*B.u.y+dz*B.u.z,dx*B.v.x+dy*B.v.y+dz*B.v.z,dx*B.n.x+dy*B.n.y+dz*B.n.z];
    // Antériorité : la face doit appartenir à la tranche COURANTE de son extrusion
    // (suit les changements de hauteur — c'est tout l'objet de cette passe).
    const spans=(doc.features||[]).filter(f=>f.type==='extrude'&&f.sketchId===a.sk&&f.visible!==false).map(f=>extrudeSpan(f));
    if(spans.length&&!spans.some(d=>q[2]>=d.lo-1.5&&q[2]<=d.hi+1.5))return null;
    const P=s.points||{};
    if(a.t==='p'){
      const p=P[a.id];if(!p)return null;
      if(Math.hypot(q[0]-p.x,q[1]-p.y)>5.0)return null;
    }else{
      const e=(s.entities||[]).find(k=>k.id===a.id);
      if(!e||e.construction||e.ref)return null;
      let d2=1e18;
      if(e.t==='line'){const A0=P[e.p1],B0=P[e.p2];if(!A0||!B0)return null;d2=distSeg2(q[0],q[1],A0.x,A0.y,B0.x,B0.y);}
      else if(e.t==='circle'||e.t==='arc'){
        const C=P[e.pc];if(!C||!(e.r>0))return null;
        if(e.t==='arc'){const an=arcAngles(s,e);if(!an)return null;
          const TAU=Math.PI*2,rel=((Math.atan2(q[1]-C.y,q[0]-C.x)-an.a1)%TAU+TAU)%TAU;
          if(rel>an.a2-an.a1+0.05)return null;}
        d2=Math.abs(Math.hypot(q[0]-C.x,q[1]-C.y)-e.r);
      }else return null;
      if(d2>5.0)return null;
    }
    const dd=Math.abs(c.b.dim[0]-ref.dim[0])+Math.abs(c.b.dim[1]-ref.dim[1])+Math.abs(c.b.dim[2]-ref.dim[2]);
    if(dd>Math.max(2.0,0.35*(Math.abs(ref.dim[0])+Math.abs(ref.dim[1])+Math.abs(ref.dim[2]))))return null;
    const d=Math.hypot(c.b.pos[0]-ref.pos[0],c.b.pos[1]-ref.pos[1],c.b.pos[2]-ref.pos[2]);
    return 0.15*dd+0.02*d;
  }catch(e){return null;}
}
function occFindFace(shape,ref){
  // Retrouve sur le solide courant la face décrite par ref (centre + normale + dimensions).
  // Une sélection d'une seule face se fait d'un clic : 2 mm suffisent à la délimiter, et la
  // normale doit rester compatible (sinon on déplacerait la face d'en face).
  // Comme les congés : 2 passes avant de conclure (le triangle ⚠ n'arrive qu'après).
  // Passe 0 : ancre absente (anciens projets) → recalée sur ref.pos, comme les congés.
  // Passe 1 (antériorité/suivi) : cohérence d'ancre, puis identité normale+dims sans
  //   ambiguïté — suit les éditions amont (ex. hauteur d'extrusion changée) même quand
  //   le centre a bougé de loin.
  // Passe 2 (proximité) : comportement historique, couperet 2,5 mm.
  if(!shape||!ref)return null;
  // Le nom d'abord (20-05) : la position n'est que le repli, et le moyen de nommer une référence neuve
  const parNom=nomsRefFace(shape,ref);if(parNom)return parNom;
  const g=occFindFace0(shape,ref);
  nomsRefNote(shape,ref,g);
  return g;
}
function occFindFace0(shape,ref){
  if(!ref.anchor){try{const a0=xAnchorFor(ref.pos);if(a0)ref.anchor=a0;}catch(e){}}
  const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);
  const cands=[];
  while(ex.More()){
    const f=occt.TopoDS.Face_1(ex.Current());
    const b=occFaceBox(f),n=occFaceOutNormal(f);
    if(b&&n){
      const dot=n[0]*ref.n[0]+n[1]*ref.n[1]+n[2]*ref.n[2];
      if(dot>=0.9)cands.push({f,b,n});
      else{try{f.delete();}catch(e){}}
    }
    ex.Next();
  }
  try{ex.delete();}catch(e){}
  const drop=c=>{try{c.f.delete();}catch(e){}};
  const ddOf=c=>Math.abs(c.b.dim[0]-ref.dim[0])+Math.abs(c.b.dim[1]-ref.dim[1])+Math.abs(c.b.dim[2]-ref.dim[2]);
  // Passe 1a : cohérence d'ancre (précis, suit les esquisses).
  if(ref.anchor){
    let best=null,bs=1e18;
    for(const c of cands){
      const s=faceAnchorScore(c,ref);
      if(s==null)continue;
      if(s<bs){bs=s;best=c;}
    }
    if(best){cands.forEach(c=>{if(c!==best)drop(c);});return best.f;}
  }
  // Passe 1b : identité sans ambiguïté (normale déjà filtrée + dims proches + un seul
  // candidat) — couvre les grandes faces loin de toute entité d'esquisse, dont l'ancre
  // est introuvable, après de gros déplacements.
  {
    const uniq=cands.filter(c=>{
      for(let i=0;i<3;i++){if(Math.abs(c.b.dim[i]-ref.dim[i])>Math.max(1.5,0.25*Math.abs(ref.dim[i])))return false;}
      return true;
    });
    if(uniq.length===1){const w=uniq[0];cands.forEach(c=>{if(c!==w)drop(c);});return w.f;}
  }
  // Passe 2 (proximité, comportement historique inchangé).
  let best=null,bn=-2;
  for(const c of cands){
    const d=Math.hypot(c.b.pos[0]-ref.pos[0],c.b.pos[1]-ref.pos[1],c.b.pos[2]-ref.pos[2]);
    const sc=d+0.1*ddOf(c);
    if(sc<bn||best===null){if(sc<1e5){bn=sc;best=c;}}
  }
  cands.forEach(c=>{if(!best||c!==best)drop(c);});
  if(best&&bn>2.5){drop(best);return null;} // trop loin : on préfère échouer que viser une autre face
  return best?best.f:null;
}
/* ---------- déplacement de face façon « Appuyer/Tirer » (V0.34.0) ----------
   Une face déplacée garde ses LIMITES sur les faces voisines : une voisine inclinée
   (dépouille, chanfrein) est prolongée ou rognée jusqu'à la face déplacée, au lieu d'une
   marche verticale ; une face cylindrique change de RAYON (même axe) au lieu d'être
   extrudée le long de son axe, et un cône coaxial à son extrémité (pointe de foret,
   fraisure) suit le nouveau rayon. Mesuré (volumes exacts) : tronc de pyramide ±10,
   chanfrein ±5, trou débouchant Ø10 → Ø6 / Ø14, bossage R10 → R13 / R7, trou borgne à
   pointe 118° et fraisure 90° agrandis et réduits, dessus en L, bossage à dessus incliné. */
function occDot3(u,v){return u[0]*v[0]+u[1]*v[1]+u[2]*v[2];}
function occSub3(u,v){return [u[0]-v[0],u[1]-v[1],u[2]-v[2]];}
function occSurfDesc(f){
  // Surface porteuse d'une face, pour dire si deux faces sont « sur la même surface » :
  // plan {k:'pl',n,p} ; cylindre {k:'cy',a,p,r,X,Y,direct,u0..v1} ; cône {k:'co',a,apex,semi}.
  let ad=null;
  try{
    ad=new occt.BRepAdaptor_Surface_2(f,true);
    const T=occt.GeomAbs_SurfaceType,gt=ad.GetType();
    const V=d=>[d.X(),d.Y(),d.Z()];
    if(gt===T.GeomAbs_Plane){
      const ax=ad.Plane().Axis();
      return {k:'pl',n:V(ax.Direction()),p:V(ax.Location())};
    }
    if(gt===T.GeomAbs_Cylinder){
      const cy=ad.Cylinder(),pos=cy.Position();
      return {k:'cy',a:V(pos.Direction()),p:V(pos.Location()),r:cy.Radius(),X:V(pos.XDirection()),Y:V(pos.YDirection()),direct:pos.Direct(),
        u0:ad.FirstUParameter(),u1:ad.LastUParameter(),v0:ad.FirstVParameter(),v1:ad.LastVParameter()};
    }
    if(gt===T.GeomAbs_Cone){
      const co=ad.Cone();
      return {k:'co',a:V(co.Position().Direction()),apex:V(co.Apex()),semi:co.SemiAngle()};
    }
    return {k:'?'};
  }catch(e){return {k:'?'};}
  finally{try{if(ad)ad.delete();}catch(e){}}
}
function occSameSurf(a,b){
  const tol=1e-4;
  if(!a||!b||a.k!==b.k)return false;
  if(a.k==='pl')return Math.abs(Math.abs(occDot3(a.n,b.n))-1)<1e-7&&Math.abs(occDot3(occSub3(b.p,a.p),a.n))<tol;
  if(a.k==='cy'){
    if(Math.abs(Math.abs(occDot3(a.a,b.a))-1)>1e-7||Math.abs(a.r-b.r)>tol)return false;
    const w=occSub3(b.p,a.p),t=occDot3(w,a.a);
    return Math.hypot(w[0]-t*a.a[0],w[1]-t*a.a[1],w[2]-t*a.a[2])<tol;
  }
  return false;
}
function occSubShapes(sh,kind){
  const out=[];
  const ex=new occt.TopExp_Explorer_2(sh,occt.TopAbs_ShapeEnum[kind],occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
  while(ex.More()){out.push(kind==='TopAbs_FACE'?occt.TopoDS.Face_1(ex.Current()):ex.Current());ex.Next();}
  try{ex.delete();}catch(e){}
  return out;
}
function occFacesTouching(faces,group){
  // Faces de `faces` (hors `group`) qui partagent une arête avec une face de `group`.
  const ge=[];group.forEach(g=>occSubShapes(g,'TopAbs_EDGE').forEach(e=>ge.push(e)));
  const out=faces.filter(f=>{
    if(group.some(g=>g.IsSame(f)))return false;
    const fe=occSubShapes(f,'TopAbs_EDGE');
    const ok=fe.some(e=>ge.some(x=>x.IsSame(e)));
    occDispose(fe);return ok;
  });
  occDispose(ge);
  return out;
}
function occMoveFaceRuledTool(shape,face,n,dist){
  // Outil d'un déplacement de face PLANE dont les voisines sont inclinées ET tangentes entre
  // elles (V0.40.1, Barquette : coins arrondis d'une extrusion à dépouille), cas où la reprise
  // par Defeaturing échoue. Le contour de la face est relevé de |dist| le long de u =
  // n·signe(dist), chaque bord suivant le prolongement EXACT de sa voisine :
  // - surface d'extrusion (coin d'une dépouille DraftAngle = cylindre OBLIQUE, pas un cône)
  //   ou cylindre : bord translaté le long de la génératrice ;
  // - cône : bord mis à l'échelle depuis le sommet ;
  // - plan : segment entre les sommets relevés de ses deux voisins (deux plans voisins :
  //   sommet relevé le long de leur droite commune).
  // L'outil est le volume fermé entre l'ancien et le nouveau contour (parois cousues).
  // Retourne l'outil (à libérer) ou null : face à trou, voisine d'un autre type (B-spline,
  // congé tangent à la face), génératrice parallèle à la face, sommets incohérents.
  const L=Math.abs(dist),sg=dist>0?1:-1,u=n.map(x=>x*sg);
  const bin=[];
  const V3=p=>[p.X(),p.Y(),p.Z()];
  const add=(a,b,k)=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k];
  try{
    if(occSubShapes(face,'TopAbs_WIRE').length!==1)return null;
    const T=occt.GeomAbs_SurfaceType;
    const ow=occBinPush(bin,occt.BRepTools.OuterWire(face));
    const wx=occBinPush(bin,new occt.BRepTools_WireExplorer_3(ow,face));
    const it=[];
    for(;wx.More();wx.Next()){
      const e=occBinPush(bin,occt.TopoDS.Edge_1(wx.Current()));
      const v0=V3(occBinPush(bin,occt.BRep_Tool.Pnt(occBinPush(bin,wx.CurrentVertex()))));
      const fl=occEdgeFaces(shape,e);fl.forEach(x=>bin.push(x.f));
      const o=fl.find(x=>!x.f.IsSame(face));
      if(!o)return null;
      const ad=occBinPush(bin,new occt.BRepAdaptor_Surface_2(o.f,true)),gt=ad.GetType();
      let r;
      if(gt===T.GeomAbs_Plane){
        const ca=occBinPush(bin,new occt.BRepAdaptor_Curve_2(e));
        if(ca.GetType()!==occt.GeomAbs_CurveType.GeomAbs_Line)return null;
        r={k:'pl',n:V3(occBinPush(bin,ad.Plane().Axis().Direction()))};
      }else if(gt===T.GeomAbs_SurfaceOfExtrusion||gt===T.GeomAbs_Cylinder){
        let d=V3(occBinPush(bin,gt===T.GeomAbs_Cylinder?ad.Cylinder().Axis().Direction():ad.Direction()));
        const du=occDot3(d,u);
        if(Math.abs(du)<1e-3)return null;
        r={k:'tr',d:d.map(x=>x*L/du),dv:L/du,f:o.f}; // relève exactement de L le long de u
      }else if(gt===T.GeomAbs_Cone){
        r={k:'ap',a:V3(occBinPush(bin,ad.Cone().Apex()))};
      }else return null;
      it.push({e,v0,r});
    }
    const N=it.length;
    if(N<2)return null;
    // Relèvement d'un sommet par la règle d'une voisine (null pour un plan seul).
    const lift=(r,v)=>{
      if(r.k==='tr')return add(v,r.d,1);
      if(r.k==='ap'){const w=occSub3(v,r.a),wu=occDot3(w,u);if(Math.abs(wu)<1e-6)return null;return add(r.a,w,1+L/wu);}
      return null;
    };
    const tolV=Math.max(1e-4,L*1e-5);
    const V1=[];
    for(let k=0;k<N;k++){
      const a=it[(k+N-1)%N].r,b=it[k].r,v=it[k].v0;
      const c=[lift(a,v),lift(b,v)].filter(Boolean);
      let q;
      if(c.length){
        if(c.length===2&&Math.hypot(...occSub3(c[0],c[1]))>tolV)return null;
        q=c[0];
      }else{
        // deux plans : droite commune (ou, plans parallèles, ligne de plus grande pente)
        let d=[a.n[1]*b.n[2]-a.n[2]*b.n[1],a.n[2]*b.n[0]-a.n[0]*b.n[2],a.n[0]*b.n[1]-a.n[1]*b.n[0]];
        if(Math.hypot(...d)<1e-6)d=add(u,a.n,-occDot3(u,a.n));
        const du=occDot3(d,u);
        if(Math.abs(du)<1e-3)return null;
        q=add(v,d,L/du);
      }
      V1.push(q);
    }
    // Parois construites sur la géométrie de leur voisine (un outil réglé ThruSections ne
    // donne que des B-splines, que l'unification ne recolle pas aux parois d'origine) :
    // plan → face plane, extrusion/cylindre → prisme de l'arête, cône → face réglée.
    const P3=q=>occBinPush(bin,new occt.gp_Pnt_3(q[0],q[1],q[2]));
    const sew=occBinPush(bin,new occt.BRepBuilderAPI_Sewing(Math.max(1e-5,tolV),true,true,true,false));
    sew.Add(face);
    const mw=occBinPush(bin,new occt.BRepBuilderAPI_MakeWire_1());
    for(let k=0;k<N;k++){
      const {e,r}=it[k],p0=V1[k],p1=V1[(k+1)%N];
      let ne,side;
      if(r.k==='pl'){
        ne=occBinPush(bin,new occt.BRepBuilderAPI_MakeEdge_3(P3(p0),P3(p1))).Edge();
        const pg=occBinPush(bin,new occt.BRepBuilderAPI_MakePolygon_1());
        [it[k].v0,it[(k+1)%N].v0,p1,p0].forEach(q=>pg.Add_1(P3(q)));pg.Close();
        const mf=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace_15(pg.Wire(),true));
        if(!mf.IsDone())return null;
        side=mf.Face();
      }else{
        const t=occBinPush(bin,new occt.gp_Trsf_1());
        if(r.k==='tr')t.SetTranslation_1(occBinPush(bin,new occt.gp_Vec_4(r.d[0],r.d[1],r.d[2])));
        else t.SetScale(P3(r.a),1+L/occDot3(occSub3(it[k].v0,r.a),u));
        const tb=occBinPush(bin,new occt.BRepBuilderAPI_Transform_2(e,t,true));
        ne=occt.TopoDS.Edge_1(tb.Shape());
        if(r.k==='tr'){
          // Sur la SURFACE MÊME de la voisine (rectangle UV : arête iso-V, V le long de la
          // génératrice unitaire) : l'unification la recolle alors à la voisine, sans couture.
          try{
            const loc=occBinPush(bin,new occt.TopLoc_Location_1());
            const hs=occBinPush(bin,occt.BRep_Tool.Surface_1(r.f,loc));
            const g=occBinPush(bin,new occt.BRepAdaptor_Curve2d_2(e,r.f));
            const q0=occBinPush(bin,g.Value(g.FirstParameter())),q1=occBinPush(bin,g.Value(g.LastParameter()));
            if(loc.IsIdentity()&&Math.abs(q0.Y()-q1.Y())<1e-9){
              const v0=q0.Y(),v1=v0+r.dv;
              const mf=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace_14(hs,Math.min(q0.X(),q1.X()),Math.max(q0.X(),q1.X()),Math.min(v0,v1),Math.max(v0,v1),1e-7));
              if(mf.IsDone())side=mf.Face();
            }
          }catch(x){side=null;}
          if(!side)side=occBinPush(bin,new occt.BRepPrimAPI_MakePrism_1(e,occBinPush(bin,new occt.gp_Vec_4(r.d[0],r.d[1],r.d[2])),false,true)).Shape();
        }else side=occt.BRepFill.Face(e,ne);
      }
      bin.push(ne);bin.push(side);
      mw.Add_1(ne);
      if(!mw.IsDone())return null;
      sew.Add(side);
    }
    const mf1=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace_15(mw.Wire(),true));
    if(!mf1.IsDone())return null;
    sew.Add(mf1.Face());
    sew.Perform(occBinPush(bin,new occt.Handle_Message_ProgressIndicator_1()));
    if(sew.NbFreeEdges()>0)return null;
    const ex=occBinPush(bin,new occt.TopExp_Explorer_2(sew.SewedShape(),occt.TopAbs_ShapeEnum.TopAbs_SHELL,occt.TopAbs_ShapeEnum.TopAbs_SHAPE));
    if(!ex.More())return null;
    const ms=occBinPush(bin,new occt.BRepBuilderAPI_MakeSolid_1());
    ms.Add(occt.TopoDS.Shell_1(ex.Current()));
    let out=ms.Solid();
    const gp=occBinPush(bin,new occt.GProp_GProps_1());occt.BRepGProp.VolumeProperties_1(out,gp,false,false,false);
    if(gp.Mass()<0)out=out.Reversed();
    // copie SANS dupliquer la géométrie : les coins gardent la surface de leur voisine
    out=new occt.BRepBuilderAPI_Copy_2(out,false,false).Shape();
    if(!out||out.IsNull()||!occCoqueValide(out)){try{if(out)out.delete();}catch(e){}return null;}
    return out;
  }finally{occDispose(bin);}
}
function occMoveFaceOnce(shape,face,dist,warn){
  // Déplace UNE face de `dist` mm le long de sa normale sortante, ses limites SUIVANT les
  // faces voisines. dist > 0 : la face avance (matière ajoutée), dist < 0 : elle rentre.
  // Plan → plan parallèle ; cylindre → même axe, rayon ± dist (un alésage qui avance
  // RÉTRÉCIT, un arbre qui avance GROSSIT).
  // Méthode : un outil brut (prisme de la face, ou anneau entre l'ancien et le nouveau
  // rayon) est ajouté/retiré ; ses faces latérales qui ne prolongent AUCUNE voisine
  // d'origine sont ensuite retirées par BRepAlgoAPI_Defeaturing (occDeleteFacesOnce), qui
  // prolonge les voisines jusqu'à la face déplacée. Échec de cette reprise (voisine
  // tangente : congé) → résultat brut, bord droit, avec une alerte dans `warn`.
  const L=Math.abs(dist);
  if(!(L>1e-9))return occShapeCopy(shape);
  const sd=occSurfDesc(face);
  const bin=[],tmp=[];
  const all=occSubShapes(shape,'TopAbs_FACE');tmp.push(...all);
  const nomFace=nomsFaceDe(shape,face); // la face déplacée garde son nom : la nouvelle naît de l'outil
  try{
    let tool,nd;
    const group=[face];
    if(sd.k==='cy'){
      // Toutes les faces du même cylindre reliées à la face cliquée (un trou est souvent
      // fait de deux demi-cylindres) bougent ensemble.
      for(let grown=true;grown;){
        grown=false;
        occFacesTouching(all,group).forEach(f=>{if(occSameSurf(occSurfDesc(f),sd)){group.push(f);grown=true;}});
      }
      const ds=group.map(occSurfDesc);
      let du=0,v0=1e18,v1=-1e18;ds.forEach(d=>{du+=d.u1-d.u0;v0=Math.min(v0,d.v0);v1=Math.max(v1,d.v1);});
      if(!(v1-v0>1e-9))throw new Error('cylindre sans hauteur');
      // Normale sortante : radiale vers l'extérieur pour un repère direct et une face non
      // inversée (arbre, bossage), vers l'axe sinon (alésage).
      const rev=face.Orientation_1()===occt.TopAbs_Orientation.TopAbs_REVERSED;
      const sOut=(sd.direct?1:-1)*(rev?-1:1);
      const r2=sd.r+sOut*dist;
      if(!(r2>1e-6))throw new Error(`le rayon deviendrait nul ou négatif (${r2.toFixed(3)} mm)`);
      // Extrémité bordée par un CÔNE coaxial (pointe de foret, fraisure, chanfrein de
      // bossage) : l'anneau est prolongé au-delà, puis rogné par le cône prolongé — le
      // cône suit alors le nouveau rayon au lieu de laisser une marche.
      const vm=(v0+v1)/2,clips=[];
      occFacesTouching(all,group).forEach(f=>{
        const c=occSurfDesc(f);
        if(c.k!=='co'||Math.abs(Math.abs(occDot3(c.a,sd.a))-1)>1e-7)return;
        const w=occSub3(c.apex,sd.p),ta=occDot3(w,sd.a);
        if(Math.hypot(w[0]-ta*sd.a[0],w[1]-ta*sd.a[1],w[2]-ta*sd.a[2])>1e-4)return;
        const tg=Math.tan(Math.abs(c.semi));if(!(tg>1e-6))return;
        const o=c.a.map(x=>x*(c.semi>0?1:-1)); // sens d'ouverture du cône
        const b=occBoxMinMax(f),tc=occDot3(occSub3(b.lo.map((x,i)=>(x+b.hi[i])/2),sd.p),sd.a);
        const E=(Math.max(sd.r,r2)+L)/tg+L;
        if(tc>vm)v1+=E;else v0-=E;
        const rho=(vm-ta)*occDot3(o,sd.a)*tg; // rayon du cône prolongé à mi-hauteur de la face
        clips.push({apex:c.apex,ta,o,tg,inside:rho>sd.r});
      });
      // Anneau (ou secteur d'anneau pour un cylindre partiel) dans le repère du cylindre.
      const full=du>=2*Math.PI-1e-6;
      const u0=full?0:sd.u0,ang=full?2*Math.PI:(sd.u1-sd.u0);
      const X=[0,1,2].map(i=>Math.cos(u0)*sd.X[i]+Math.sin(u0)*sd.Y[i]);
      const D=[sd.X[1]*sd.Y[2]-sd.X[2]*sd.Y[1],sd.X[2]*sd.Y[0]-sd.X[0]*sd.Y[2],sd.X[0]*sd.Y[1]-sd.X[1]*sd.Y[0]];
      const H=v1-v0,vb=occDot3(D,sd.a)>0?v0:v1;
      const O=[0,1,2].map(i=>sd.p[i]+sd.a[i]*vb);
      const ax=occBinPush(bin,new occt.gp_Ax2_2(occBinPush(bin,new occt.gp_Pnt_3(O[0],O[1],O[2])),
        occBinPush(bin,new occt.gp_Dir_4(D[0],D[1],D[2])),occBinPush(bin,new occt.gp_Dir_4(X[0],X[1],X[2]))));
      const cyl=r=>occBinPush(bin,occBinPush(bin,new occt.BRepPrimAPI_MakeCylinder_4(ax,r,H,ang)).Shape());
      tool=occCut(cyl(Math.max(sd.r,r2)),cyl(Math.min(sd.r,r2)));
      clips.forEach(c=>{
        const far=Math.max(Math.abs(c.ta-v0),Math.abs(c.ta-v1))+10;
        const cax=occBinPush(bin,new occt.gp_Ax2_3(occBinPush(bin,new occt.gp_Pnt_3(c.apex[0],c.apex[1],c.apex[2])),occBinPush(bin,new occt.gp_Dir_4(c.o[0],c.o[1],c.o[2]))));
        const cs=occBinPush(bin,occBinPush(bin,new occt.BRepPrimAPI_MakeCone_3(cax,0,far*c.tg,far)).Shape());
        const t2=c.inside?occCommon(tool,cs):occCut(tool,cs);
        try{tool.delete();}catch(e){}
        tool=t2;
      });
      nd=Object.assign({},sd,{r:r2});
    }else{
      const n=occFaceOutNormal(face);
      if(!n||sd.k!=='pl')throw new Error('face non plane/cylindrique');
      // Le prisme part du CÔTÉ DE LA DISTANCE : vers l'extérieur si la face avance, vers
      // l'intérieur si elle rentre. Extruder toujours vers l'extérieur et soustraire ne retire
      // aucune matière (le prisme est alors dans le vide) : le solide restait inchangé.
      const vec=occBinPush(bin,new occt.gp_Vec_4(n[0]*dist,n[1]*dist,n[2]*dist));
      const pr=occBinPush(bin,new occt.BRepPrimAPI_MakePrism_1(face,vec,false,true));
      tool=pr.Shape();
      nd={k:'pl',n,p:[0,1,2].map(i=>sd.p[i]+n[i]*dist)};
    }
    bin.push(tool);
    const out=dist>0?occFuse(shape,tool):occCut(shape,tool);
    // Un déplacement doit laisser UN corps, comme une addition : sans unification, la
    // fusion conserve les faces coplanaires du prisme et de la pièce d'origine (10 faces au
    // lieu de 6 sur une simple boîte), ce qui se voit : coutures, arêtes parasites, impression
    // de plusieurs morceaux. occUnify recolle les faces coplanaires — c'est déjà ce que fait
    // le chemin « add » d'une extrusion. Garde-fou : sur un raccord conique (fraisure
    // réduite), l'unification rend un solide invalide alors que la fusion brute est saine —
    // on garde alors la fusion brute.
    let res=out;
    try{
      const u=occUnify(occShapeCopy(out));
      if(u&&!u.IsNull()&&(occCoqueValide(u)||!occCoqueValide(out))){try{out.delete();}catch(e){}res=u;}
      else if(u)try{u.delete();}catch(e){}
    }catch(e){}
    if(!res||res.IsNull())throw new Error('opération de déplacement impossible');
    nomsFaceSurSurface(res,nomFace,nd);
    // Reprise des limites : faces du résultat portées par une surface latérale de l'outil
    // qui ne prolonge aucune voisine d'origine (ou par la surface d'origine de la face :
    // un reste exposé est un débord de l'outil), et contenues dans l'outil.
    const nbF=occFacesTouching(all,group);
    const nb=nbF.map(occSurfDesc);
    const toolF=occSubShapes(tool,'TopAbs_FACE');tmp.push(...toolF);
    const sides=toolF.map(occSurfDesc).filter(d=>!occSameSurf(d,nd)&&!nb.some(x=>occSameSurf(x,d)));
    sides.push(sd);
    const tb=occBoxMinMax(tool),e=1e-3;
    const inTool=b=>b&&b.lo.every((v,i)=>v>=tb.lo[i]-e)&&b.hi.every((v,i)=>v<=tb.hi[i]+e);
    const resF=occSubShapes(res,'TopAbs_FACE');tmp.push(...resF);
    const extra=resF.filter(f=>sides.some(x=>occSameSurf(x,occSurfDesc(f)))&&inTool(occBoxMinMax(f)));
    if(!extra.length)return res;
    try{
      const snap=nomsInstantane(res);
      const fx=occDeleteFacesOnce(res,extra);
      nomsCompleter(fx,null,snap);
      try{res.delete();}catch(e2){}
      return fx;
    }catch(e2){
      // Voisines tangentes entre elles (coins arrondis d'une extrusion à dépouille) : leurs
      // surfaces prolongées ne se coupent pas franchement et la reprise échoue. Repli : outil
      // réglé dont chaque bord suit le prolongement exact de sa voisine.
      if(sd.k==='pl'){
        let dt=null;
        try{dt=occMoveFaceRuledTool(shape,face,nd.n,dist);}catch(e3){dt=null;}
        if(dt){
          try{
            const o2=dist>0?occFuse(shape,dt):occCut(shape,dt);
            let r2=o2;
            try{
              // copie sans dupliquer la géométrie : une surface partagée par la voisine et le
              // prolongement de son coin permet à l'unification de les recoller
              const u=occUnify(nomsPartage(o2,new occt.BRepBuilderAPI_Copy_2(o2,false,false).Shape()));
              if(u&&!u.IsNull()&&(occCoqueValide(u)||!occCoqueValide(o2))){try{o2.delete();}catch(e){}r2=u;}
              else if(u)try{u.delete();}catch(e){}
            }catch(e){}
            if(r2&&!r2.IsNull()&&occCoqueValide(r2)){nomsFaceSurSurface(r2,nomFace,nd);try{res.delete();}catch(e){}return r2;}
            try{if(r2)r2.delete();}catch(e){}
          }catch(e3){}
          finally{try{dt.delete();}catch(e){}}
        }
      }
      if(warn)warn.push(`bord de la face non prolongé le long des voisines (${(e2&&e2.message)||e2} — congé tangent ?) : bord droit conservé`);
      return res;
    }
  }finally{
    occDispose(bin);occDispose(tmp);
  }
}
function mvRefs(f){
  // Faces visées par un déplacement : `faces` (multi-sélection, V0.21.6) ou l'ancienne
  // référence unique `ref` (documents antérieurs).
  if(f&&Array.isArray(f.faces)&&f.faces.length)return f.faces;
  return (f&&f.ref)?[f.ref]:[];
}
function occFaceTrack(face){
  // Signature de SUIVI d'une face entre deux déplacements successifs : déplacer une face
  // prolonge ou rogne ses voisines (centre et dimensions changent), mais une face plane
  // reste dans SON plan. On mémorise donc normale + plan + boîte d'origine.
  const n=occFaceOutNormal(face),b=occFaceBox(face);
  if(!n||!b)return null;
  const t={n,pos:b.pos,dim:b.dim,plane:false,d:0};
  try{
    const ad=new occt.BRepAdaptor_Surface_2(face,true);
    try{
      if(ad.GetType()===occt.GeomAbs_SurfaceType.GeomAbs_Plane){
        const l=ad.Plane().Location();
        t.plane=true;t.d=n[0]*l.X()+n[1]*l.Y()+n[2]*l.Z();
      }
    }finally{try{ad.delete();}catch(e){}}
  }catch(e){}
  return t;
}
function occFindFaceTracked(shape,t){
  // Retrouve, après le déplacement d'une AUTRE face, la face suivie par occFaceTrack :
  // même normale, même plan (faces planes), et la boîte la plus proche du centre d'origine
  // (contenu = 0). Rien au-delà de 2,5 mm : on préfère échouer que viser une autre face.
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
  let best=null,bs=1e18;
  while(ex.More()){
    const f=occt.TopoDS.Face_1(ex.Current());ex.Next();
    let ok=false,sc=1e18;
    const n=occFaceOutNormal(f);
    if(n&&n[0]*t.n[0]+n[1]*t.n[1]+n[2]*t.n[2]>=0.999){
      const c=occFaceTrack(f);
      if(c&&(!t.plane||(c.plane&&Math.abs(c.d-t.d)<0.01))){
        let out=0;
        for(let i=0;i<3;i++){
          const lo=c.pos[i]-c.dim[i]/2,hi=c.pos[i]+c.dim[i]/2;
          const e=Math.max(0,lo-t.pos[i],t.pos[i]-hi);out+=e*e;
        }
        const dc=Math.hypot(c.pos[0]-t.pos[0],c.pos[1]-t.pos[1],c.pos[2]-t.pos[2]);
        sc=Math.sqrt(out)+1e-3*dc;
        ok=Math.sqrt(out)<=2.5;
      }
    }
    if(ok&&sc<bs){if(best)try{best.delete();}catch(e){}best=f;bs=sc;}
    else try{f.delete();}catch(e){}
  }
  try{ex.delete();}catch(e){}
  return best;
}
/* ---------- faces tangentes + décalage par le noyau (V0.45.1) ----------
   Fonction Face, case « Faces tangentes » : la face cliquée entraîne toutes celles qui la
   prolongent sans arête vive (parois, coins arrondis, congés, fond d'une poche). Ces faces,
   de n'importe quel type, sont décalées par BRepOffset_MakeOffset face par face (liaison
   maison CCFaceOffset, noyau OCCT 8 seulement) : décalage nul ailleurs, voisines prolongées
   ou rognées (jointure « intersection »). Barquette, intérieur (17 faces : 8 parois dont 4
   coins obliques, 8 congés du fond dont 4 B-splines, le fond) : +1 mm → +39 839 mm³ pour
   40 401 mm² de surface, en 0,25 s. Le noyau rend les faces non analytiques voisines en
   « surface décalée de 0 » (même géométrie) et un solide parfois invalide : ShapeFix le
   répare sans bouger les cotes. */
function occHasFaceOffset(){return !!(occt&&occt.CCFaceOffset);}
function occEdgeTangent(e,f1,f2){
  // Arête lisse entre f1 et f2 ? Drapeau du noyau d'abord ; s'il dit « vive » (souvent à
  // tort : coins d'une dépouille, congé sur congé), écart des normales mesuré à 25/50/75 %
  // de l'arête, comme occSharpEdges.
  try{if(occt.BRep_Tool.Continuity_1(e,f1,f2)!==occt.GeomAbs_Shape.GeomAbs_C0)return true;}catch(err){}
  const bin=[];
  try{
    const g1=occBinPush(bin,new occt.BRepAdaptor_Curve2d_2(e,f1)),g2=occBinPush(bin,new occt.BRepAdaptor_Curve2d_2(e,f2));
    const s1=occBinPush(bin,occt.BRep_Tool.Surface_1(f1,occBinPush(bin,new occt.TopLoc_Location_1())));
    const s2=occBinPush(bin,occt.BRep_Tool.Surface_1(f2,occBinPush(bin,new occt.TopLoc_Location_1())));
    const w0=g1.FirstParameter(),w1=g1.LastParameter();
    if(!(w1>w0))return false;
    for(const p of [0.25,0.5,0.75]){
      const q1=occBinPush(bin,g1.Value(w0+(w1-w0)*p)),q2=occBinPush(bin,g2.Value(w0+(w1-w0)*p));
      const n1=occSurfNormalAt(s1,q1.X(),q1.Y()),n2=occSurfNormalAt(s2,q2.X(),q2.Y());
      if(!n1||!n2)return false;
      const d=occDot3(n1,n2)/(Math.hypot(n1[0],n1[1],n1[2])||1)/(Math.hypot(n2[0],n2[1],n2[2])||1);
      const th=Math.acos(Math.max(-1,Math.min(1,d)))*180/Math.PI;
      if(Math.min(th,180-th)>=3)return false;
    }
    return true;
  }catch(err){return false;}
  finally{occDispose(bin);}
}
function occTangentChainIdx(faces,seeds){
  // Rangs (dans `faces`, les faces d'un solide dans l'ordre de l'explorateur) des faces
  // reliées aux germes par des arêtes tangentes, germes compris, triés.
  const edges=faces.map(()=>[]),bucket=new Map(),tmp=[];
  faces.forEach((f,i)=>{
    occSubShapes(f,'TopAbs_EDGE').forEach(e0=>{
      tmp.push(e0);
      try{
        const e=occt.TopoDS.Edge_1(e0);tmp.push(e);
        const ad=new occt.BRepAdaptor_Curve_2(e);
        const m=ad.Value((ad.FirstParameter()+ad.LastParameter())/2);
        const k=[m.X(),m.Y(),m.Z()].map(v=>Math.round(v*1e3)).join(',');
        try{m.delete();ad.delete();}catch(err){}
        edges[i].push({e,k});
        if(!bucket.has(k))bucket.set(k,[]);
        bucket.get(k).push({i,e});
      }catch(err){}
    });
  });
  const inChain=new Set(seeds.filter(i=>i>=0&&i<faces.length)),todo=[...inChain],seen=new Map();
  try{
    while(todo.length){
      const i=todo.pop();
      for(const a of edges[i]){
        for(const b of bucket.get(a.k)||[]){
          if(b.i===i||inChain.has(b.i)||!b.e.IsSame(a.e))continue;
          const pk=Math.min(i,b.i)+'/'+Math.max(i,b.i)+'/'+a.k;
          if(!seen.has(pk))seen.set(pk,occEdgeTangent(a.e,faces[i],faces[b.i]));
          if(seen.get(pk)){inChain.add(b.i);todo.push(b.i);}
        }
      }
    }
  }finally{occDispose(tmp);}
  return [...inChain].sort((a,b)=>a-b);
}
function occTangentChainOrds(shape,ords){
  const faces=occSubShapes(shape,'TopAbs_FACE');
  try{return occTangentChainIdx(faces,ords);}finally{occDispose(faces);}
}
function occShapeVolume(sh){
  const g=new occt.GProp_GProps_1();
  try{occt.BRepGProp.VolumeProperties_1(sh,g,false,false,false);return g.Mass();}
  finally{try{g.delete();}catch(e){}}
}
function occFaceArea(f){
  const g=new occt.GProp_GProps_1();
  try{occt.BRepGProp.SurfaceProperties_1(f,g,false,false);return g.Mass();}
  finally{try{g.delete();}catch(e){}}
}
function occShellToSolid(r){
  // V0.47.2 : le décalage du noyau peut rendre une COQUE fermée au lieu d'un solide. Elle a l'air
  // saine (valide, volume calculable), mais un outil sans solide ne retire rien : la soustraction
  // ne faisait rien, sans le dire. Retourne un solide (r est libéré) ou r tel quel s'il en a déjà un.
  const sol=occSubShapes(r,'TopAbs_SOLID');
  const nSol=sol.length;occDispose(sol);
  if(nSol)return r;
  const sh=occSubShapes(r,'TopAbs_SHELL');
  try{
    if(sh.length!==1)return r;
    const ms=new occt.BRepBuilderAPI_MakeSolid_1();
    let out=null;
    try{
      ms.Add(occt.TopoDS.Shell_1(sh[0]));
      out=ms.Solid();
      if(occShapeVolume(out)<0)out=out.Reversed();
      out=occShapeCopy(out);
    }finally{try{ms.delete();}catch(e){}}
    if(!out||out.IsNull()||!occCoqueValide(out))return r;
    try{r.delete();}catch(e){}
    return out;
  }finally{occDispose(sh);}
}
function occOffsetFaces(shape,faces,dist,warnings){
  // Décale `faces` (handles sur `shape`) de `dist` mm le long de la normale sortante, par le
  // noyau. Retourne la nouvelle forme, ou null (raison dans `warnings`). Contrôle du volume :
  // le noyau entraîne de lui-même les faces tangentes aux faces décalées ; la matière gagnée
  // (ou perdue) doit avoir le signe de `dist` et valoir à peu près l'aire de cette chaîne
  // × |dist| — sinon le résultat est refusé (solide retourné, faces mêlées…).
  const all=occSubShapes(shape,'TopAbs_FACE');
  let r=null;
  try{
    const idx=all.map((h,i)=>faces.some(f=>f.IsSame(h))?i:-1).filter(i=>i>=0);
    const area=occTangentChainIdx(all,idx).reduce((s,i)=>s+occFaceArea(all[i]),0);
    const o=new occt.CCFaceOffset();
    try{
      o.Init(shape,0,1e-6,true,false,2,false);
      faces.forEach(f=>o.SetFace(f,dist));
      if(!o.MakeOffset()){warnings.push('décalage refusé par le noyau ('+(o.Message()||'erreur '+o.Error())+')');return null;}
      r=o.Shape();
    }finally{try{o.delete();}catch(e){}}
    if(!r||r.IsNull()){warnings.push('décalage : résultat vide');return null;}
    if(!occCoqueValide(r)){
      const fx=occCoqueRepare(r);
      try{r.delete();}catch(e){}
      r=fx;
      if(!r||!occCoqueValide(r)){warnings.push('décalage : solide invalide, même réparé');if(r)try{r.delete();}catch(e){}return null;}
    }
    r=occShellToSolid(r);
    const dv=occShapeVolume(r)-occShapeVolume(shape),ev=area*dist,q=ev?dv/ev:0;
    if(!(q>0.25&&q<4)){
      warnings.push(`décalage incohérent (volume ${dv>=0?'+':''}${dv.toFixed(0)} mm³ pour ${ev>=0?'+':''}${ev.toFixed(0)} attendus)`);
      try{r.delete();}catch(e){}
      return null;
    }
    return r;
  }finally{occDispose(all);}
}
function occApplyMoveFace(result,f){
  // Rejoue le déplacement d'une ou plusieurs faces. Retourne {shape,warnings} comme
  // occApplyXFillets. Les faces sont TOUTES retrouvées sur le solide d'entrée, puis
  // déplacées l'une après l'autre (même distance) : chacune est re-suivie sur le solide
  // déjà modifié (occFindFaceTracked) — deux faces voisines avancées ensemble donnent
  // ainsi un coin plein, pas une encoche entre deux prismes.
  // V0.45.1 : « Faces tangentes » (f.tangent) ou face ni plane ni cylindrique → toutes les
  // faces d'un coup par le noyau (occOffsetFaces), si le noyau sait le faire.
  const warnings=[];
  const dist=+f.dist||0;
  const refs=mvRefs(f);
  const lab=r=>'('+(r.pos||[]).map(v=>(+v).toFixed(1)).join(', ')+')';
  const found=refs.map(r=>{try{return r.n?occFindFace(result,r):occFindFaceAny(result,r);}catch(e){return null;}});
  const trk=found.map(h=>h?occFaceTrack(h):null);
  const drop=()=>found.forEach(h=>{if(h)try{h.delete();}catch(e){}});
  found.forEach((h,i)=>{if(!h)warnings.push(`face introuvable près de ${lab(refs[i])} — la pièce a changé`);});
  if(!found.some(Boolean)){drop();return {shape:result,warnings};}
  if(!dist){drop();return {shape:result,warnings:['distance nulle — aucun déplacement']};}
  {
    // Chaîne tangente : les faces ajoutées qui ne sont que l'autre moitié d'un même cylindre
    // (ou d'un même plan) ne comptent pas — ce cas reste au calcul historique.
    const all=occSubShapes(result,'TopAbs_FACE');
    let chain=[];
    try{
      const seeds=all.map((h,i)=>found.some(x=>x&&x.IsSame(h))?i:-1).filter(i=>i>=0);
      chain=f.tangent?occTangentChainIdx(all,seeds).map(i=>all[i]):seeds.map(i=>all[i]);
      const sd=found.filter(Boolean).map(occSurfDesc);
      const plain=sd.every(d=>d.k==='pl'||d.k==='cy')&&chain.every(h=>{const d=occSurfDesc(h);return sd.some(x=>occSameSurf(x,d));});
      if(!plain){
        if(!occHasFaceOffset()){
          if(!sd.every(d=>d.k==='pl'||d.k==='cy')){drop();return {shape:result,warnings:warnings.concat(['face ni plane ni cylindrique : décalage indisponible avec ce noyau (noyau OCCT 8 requis)']),fatal:true};}
          warnings.push('faces tangentes : décalage indisponible avec ce noyau — seules les faces cliquées bougent');
        }else{
          const r=occOffsetFaces(result,chain,dist,warnings);
          if(!r){drop();return {shape:result,warnings,fatal:true};}
          drop();
          try{result.delete();}catch(e){}
          return {shape:r,warnings};
        }
      }
    }finally{occDispose(all);}
  }
  let cur=result;
  try{
    // Un cylindre bouge en entier (ses demi-faces ensemble) : une 2ᵉ face cliquée sur le
    // MÊME cylindre est sautée, sinon son rayon changerait deux fois.
    const sds=found.map(h=>h?occSurfDesc(h):null);
    for(let i=0;i<found.length;i++){
      if(!found[i])continue;
      if(sds[i].k==='cy'&&sds.slice(0,i).some((d,j)=>found[j]&&occSameSurf(d,sds[i])))continue;
      let face=found[i],own=false;
      if(cur!==result){
        face=trk[i]?occFindFaceTracked(cur,trk[i]):null;own=true;
        if(!face){warnings.push(`face ${lab(refs[i])} perdue après le déplacement des précédentes`);continue;}
      }
      let s;
      try{s=occMoveFaceOnce(cur,face,dist,warnings);}
      finally{if(own)try{face.delete();}catch(e){}}
      if(cur!==result)try{cur.delete();}catch(e){}
      cur=s;
    }
  }catch(e){
    if(cur!==result)try{cur.delete();}catch(e2){}
    drop();
    return {shape:result,warnings:warnings.concat([`déplacement impossible (${(e&&e.message)||e})`]),fatal:true};
  }
  drop();
  if(cur!==result)try{result.delete();}catch(e){}
  return {shape:cur,warnings};
}
function occBlendOfFace(face,shape,bodyId){
  // Congé ou chanfrein (fonction xfillet) qui a fait `face` : « Déplacer une face » change
  // alors sa TAILLE au lieu de pousser la face (comme Appuyer/Tirer de Fusion 360).
  // Les arêtes d'un congé ne sont gardées que par leur milieu d'arête VIVE d'origine (e.pos,
  // rafraîchi à chaque rejeu) : on les reconnaît par la géométrie.
  // Congé : face courbe de même rayon (cylindre, petit rayon d'un tore), l'arête vive à moins
  // de 2 r (r (1/sin(φ/2) − 1) pour un dièdre φ : 0,41 r à 90°). Chaîne tangente : les faces
  // voisines de même rayon sont parcourues jusqu'à celle qui borde une arête mémorisée.
  // Chanfrein : face plane qui ne contient pas l'arête vive (les deux voisines la contiennent)
  // et dont le pied de la perpendiculaire tombe dans la face.
  // → {feat, idx:[entrées], r, cham} ou null.
  const feats=tlActiveList().filter(f=>f.type==='xfillet'&&f.visible!==false&&Array.isArray(f.edges)&&
    (!bodyId||occBodyOfFeat(f)===bodyId));
  if(!feats.length||!face)return null;
  const T=occt.GeomAbs_SurfaceType;
  const blendR=f=>{
    let ad=null;
    try{
      ad=new occt.BRepAdaptor_Surface_2(f,true);
      const gt=ad.GetType();
      if(gt===T.GeomAbs_Plane){const ax=ad.Plane().Axis(),d=ax.Direction(),l=ax.Location();return {pl:true,n:[d.X(),d.Y(),d.Z()],p:[l.X(),l.Y(),l.Z()]};}
      if(gt===T.GeomAbs_Cylinder)return {r:ad.Cylinder().Radius()};
      if(gt===T.GeomAbs_Torus)return {r:ad.Torus().MinorRadius()};
      return {r:null}; // surface libre d'un congé de coin : rayon non lisible
    }catch(e){return null;}
    finally{try{if(ad)ad.delete();}catch(e){}}
  };
  const bin=[];
  const dist=(f,p)=>{
    const g=new occt.gp_Pnt_3(p[0],p[1],p[2]);bin.push(g);
    const v=new occt.BRepBuilderAPI_MakeVertex(g);bin.push(v);
    const vx=v.Vertex();bin.push(vx);
    const d=occFaceDist(vx,f);return d?d.d:1e18;
  };
  const test=(f,s)=>{
    let best=null;
    feats.forEach(F=>{
      const cham=!!F.chamfer;
      if(cham!==!!s.pl)return;
      F.edges.forEach((e,i)=>{
        if(!e||!Array.isArray(e.pos))return;
        const r=+e.r||+F.radius||0;if(!(r>0))return;
        let sc;
        if(cham){
          const dp=Math.abs(occDot3(occSub3(e.pos,s.p),s.n));
          if(dp<0.1*r||dp>1.5*Math.max(r,+F.cd2||0))return;
          const df=dist(f,e.pos);
          if(Math.abs(df-dp)>0.02*r+1e-3)return;
          sc=Math.abs(df-dp)/r;
        }else{
          if(s.r!=null&&Math.abs(s.r-r)>1e-3*Math.max(1,r))return;
          const df=dist(f,e.pos);
          if(df>2*r)return;
          sc=df/r;
        }
        if(!best||sc<best.sc)best={sc,F,i,r};
      });
    });
    return best;
  };
  try{
    const s0=blendR(face);if(!s0)return null;
    let hit=test(face,s0);
    if(!hit&&!s0.pl&&shape){
      // Chaîne tangente : de proche en proche par les faces courbes de même rayon.
      const all=occSubShapes(shape,'TopAbs_FACE');bin.push(...all);
      const me=all.find(f=>f.IsSame(face));
      if(me){
        const group=[me];
        for(let k=0;k<40&&!hit;k++){
          const nx=occFacesTouching(all,group).filter(f=>{const s=blendR(f);return s&&!s.pl&&(s.r==null||s0.r==null||Math.abs(s.r-s0.r)<1e-3*Math.max(1,s0.r));});
          if(!nx.length)break;
          for(const f of nx){group.push(f);hit=test(f,blendR(f));if(hit)break;}
        }
      }
    }
    if(!hit)return null;
    // Entrées en double (même arête, rayon égal) : toutes changent ensemble.
    const P=hit.F.edges[hit.i].pos;
    const idx=hit.F.edges.map((e,i)=>(e&&Array.isArray(e.pos)&&Math.hypot(e.pos[0]-P[0],e.pos[1]-P[1],e.pos[2]-P[2])<=0.75&&Math.abs((+e.r||+hit.F.radius||0)-hit.r)<1e-9)?i:-1).filter(i=>i>=0);
    return {feat:hit.F.id,idx,r:hit.r,cham:!!hit.F.chamfer};
  }catch(e){return null;}
  finally{occDispose(bin);}
}
/* ---------- suppression de faces (touche Suppr, façon Fusion) ----------
   BRepAlgoAPI_Defeaturing retire les faces visées et PROLONGE les faces voisines jusqu'à
   ce qu'elles se rejoignent : un congé supprimé redonne l'arête vive, un trou supprimé
   rebouche la face qui le portait. Mesuré : boîte 100x60x40 congée R10 sur une arête
   verticale, congé supprimé → 6 faces, 240 000 mm³ (la boîte d'origine, au mm³ près). */
function occSurfKind(f){
  try{
    const ad=new occt.BRepAdaptor_Surface_2(f,true);
    const gt=ad.GetType();try{ad.delete();}catch(e){}
    const T=occt.GeomAbs_SurfaceType;
    for(const k in T){if(T[k]===gt)return k.replace('GeomAbs_','');}
  }catch(e){}
  return '?';
}
function occFaceRefAny(f){
  // Référence durable de N'IMPORTE quelle face : celle du déplacement (plan/cylindre :
  // centre + normale + dimensions, suivie par les ancres d'esquisse), sinon centre +
  // dimensions + type de surface (tores et surfaces libres des congés de coin).
  const r=occFaceRef(f);if(r){r.st=occSurfKind(f);return r;}
  const b=occFaceBox(f);if(!b)return null;
  return {pos:b.pos.map(v=>+v.toFixed(3)),dim:b.dim.map(v=>+v.toFixed(3)),st:occSurfKind(f)};
}
function occFindFaceAny(shape,ref){
  if(!shape||!ref)return null;
  const parNom=nomsRefFace(shape,ref);if(parNom)return parNom;
  const g=occFindFaceAny0(shape,ref);
  nomsRefNote(shape,ref,g);
  return g;
}
function occFindFaceAny0(shape,ref){
  if(ref.n){
    const h=occFindFace0(shape,ref);
    if(h||!ref.anchor)return h;
    // Repli : une extrusion amont a changé de hauteur, la face visée a donc changé de
    // dimensions et occFindFace la refuse. L'ancre d'esquisse suffit alors : même type de
    // surface, même normale, la face la mieux placée par rapport à son entité d'esquisse
    // (les dimensions de la candidate remplacent celles mémorisées).
    const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
    const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);
    let best=null,bs=1e18;
    while(ex.More()){
      const f=occt.TopoDS.Face_1(ex.Current());
      let keep=false;
      try{
        const n=occFaceOutNormal(f),b=occFaceBox(f);
        if(n&&b&&(!ref.st||occSurfKind(f)===ref.st)&&n[0]*ref.n[0]+n[1]*ref.n[1]+n[2]*ref.n[2]>=0.9){
          const s=faceAnchorScore({f,b,n},Object.assign({},ref,{dim:b.dim}));
          if(s!=null&&s<bs){if(best)try{best.delete();}catch(e){}best=f;bs=s;keep=true;}
        }
      }catch(e){}
      if(!keep)try{f.delete();}catch(e){}
      ex.Next();
    }
    try{ex.delete();}catch(e){}
    return best;
  }
  // Face courbe quelconque : même type de surface, la plus proche (centre + dimensions),
  // à 2,5 mm au plus — on préfère échouer que retirer une autre face.
  const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);
  let best=null,bs=1e18;
  while(ex.More()){
    const f=occt.TopoDS.Face_1(ex.Current());
    let keep=false;
    if(!ref.st||occSurfKind(f)===ref.st){
      const b=occFaceBox(f);
      if(b){
        const d=Math.hypot(b.pos[0]-ref.pos[0],b.pos[1]-ref.pos[1],b.pos[2]-ref.pos[2]);
        const dd=Math.abs(b.dim[0]-ref.dim[0])+Math.abs(b.dim[1]-ref.dim[1])+Math.abs(b.dim[2]-ref.dim[2]);
        const sc=d+0.1*dd;
        if(sc<bs){if(best)try{best.delete();}catch(e){}best=f;bs=sc;keep=true;}
      }
    }
    if(!keep)try{f.delete();}catch(e){}
    ex.Next();
  }
  try{ex.delete();}catch(e){}
  if(best&&bs>2.5){try{best.delete();}catch(e){}return null;}
  return best;
}
function occDeleteFacesOnce(shape,faces){
  // Retire `faces` (handles sur `shape`) et referme le solide par prolongement des voisines.
  if(!occt.BRepAlgoAPI_Defeaturing)throw new Error('suppression de face absente de ce noyau');
  const d=new occt.BRepAlgoAPI_Defeaturing();
  try{
    d.SetShape(shape);
    faces.forEach(h=>d.AddFaceToRemove(h));
    try{d.SetToFillHistory(false);}catch(e){}
    d.Build();
    if(!d.IsDone())throw new Error('les faces voisines ne se rejoignent pas');
    let r=d.Shape();
    if(!r||r.IsNull())throw new Error('résultat vide');
    // Une face que le noyau ne sait pas retirer est GARDÉE sans erreur (IsDone reste vrai) :
    // on vérifie qu'aucune face visée ne subsiste, sinon l'isolation la désignera.
    const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE;
    const ex=new occt.TopExp_Explorer_2(r,occt.TopAbs_ShapeEnum.TopAbs_FACE,SH);
    let reste=false;
    while(ex.More()&&!reste){const c=ex.Current();if(faces.some(h=>c.IsSame(h)))reste=true;ex.Next();}
    try{ex.delete();}catch(e){}
    if(reste){try{r.delete();}catch(e){}throw new Error('les faces voisines ne se rejoignent pas');}
    r=occUnify(r);
    if(!occCoqueValide(r)){try{r.delete();}catch(e){}throw new Error('solide résultant invalide');}
    // V0.15.4 : garde-fou « part en vrille ». Le noyau referme parfois le solide en
    // prolongeant une voisine très loin (pointe de plusieurs centaines de mm hors de la
    // pièce) et rend IsDone vrai. Un prolongement légitime (congé → arête vive, chanfrein
    // → coin) reste près des faces retirées : la boîte du résultat doit tenir dans celle
    // de la pièce ∪ celle des faces retirées élargie de leur plus grande dimension.
    const sort=occDelFaceDebord(occBoxMinMax(shape),occBoxMinMax(r),faces.map(occBoxMinMax));
    if(sort>0.05){
      try{r.delete();}catch(e){}
      throw new Error(`les faces voisines partent hors de la pièce (+${sort.toFixed(0)} mm) — ajoutez aussi les faces voisines à la suppression`);
    }
    return r;
  }finally{try{d.delete();}catch(e){}}
}
function occDelFaceDebord(B,R,Fs){
  // Débord (mm) du résultat R hors de la zone permise : pièce d'origine B ∪ boîte des faces
  // retirées élargie de leur plus grande dimension. Boîtes {lo,hi} ; 0 si rien à reprocher.
  const F=(Fs||[]).filter(Boolean).reduce((a,b)=>a?{lo:a.lo.map((v,i)=>Math.min(v,b.lo[i])),hi:a.hi.map((v,i)=>Math.max(v,b.hi[i]))}:b,null);
  if(!B||!R||!F)return 0;
  const m=Math.max(1,...F.hi.map((v,i)=>v-F.lo[i]));
  let sort=0;
  for(let i=0;i<3;i++)sort=Math.max(sort,Math.min(B.lo[i],F.lo[i]-m)-R.lo[i],R.hi[i]-Math.max(B.hi[i],F.hi[i]+m));
  return sort;
}
function occBoxMinMax(sh){
  // Boîte englobante {lo:[x,y,z], hi:[x,y,z]} d'une forme, ou null.
  try{
    const box=new occt.Bnd_Box_1();occt.BRepBndLib.Add(sh,box,true);
    const a=box.CornerMin(),b=box.CornerMax();
    const r={lo:[a.X(),a.Y(),a.Z()],hi:[b.X(),b.Y(),b.Z()]};
    try{box.delete();}catch(e){}
    return r;
  }catch(e){return null;}
}
const DEL_ISOLE_MAX=6;
function occApplyDeleteFaces(result,f,ckKey,ckPre){
  // Rejoue la suppression. Retourne {shape,warnings} comme occApplyCoque : les faces sont
  // retrouvées par référence durable, et celles que le noyau refuse sont écartées une à
  // une (isolation) plutôt que de tout perdre. ckKey (rejeu) : clé du point de contrôle,
  // qui permet d'envoyer le calcul au worker ; {pending:true} tant qu'il n'a pas répondu.
  // ckPre : clé du solide d'ENTRÉE (préfixe du rejeu avant cette fonction).
  delete f._calc;
  const warnings=[];
  const total=(f.faces||[]).length;
  if(!total)return{shape:result,warnings:['aucune face à supprimer']};
  const hs=(f.faces||[]).map(fr=>{try{return occFindFaceAny(result,fr);}catch(e){return null;}}).filter(Boolean);
  const free=()=>hs.forEach(h=>{try{h.delete();}catch(e){}});
  f._m={m:hs.length,t:total};
  if(!hs.length)return{shape:result,warnings:[`aucune des ${total} face(s) n'est retrouvée — la pièce a changé`]};
  if(hs.length<total)warnings.push(`${total-hs.length} face(s) introuvable(s) sur la pièce courante`);
  // V0.15.9 : calcul dans le worker quand il existe (21-suppression-face-calcul) — l'interface
  // ne gèle plus et un calcul sans fin est abandonné au délai. Sans worker : ici même.
  let res=null;
  if(ckKey&&delWkUsable()){
    const a=delWkAsk(ckKey,result,hs,f.id,ckPre);
    if(a.pending){
      free();delete f._m;f._calc=true;
      return{shape:result,warnings:warnings.concat([a.msg]),pending:true};
    }
    res=a.res;
  }
  if(!res)res=occDelFacesTry(result,hs);
  free();
  warnings.push(...res.warnings);
  if(!res.r){
    f._m={m:0,t:total};
    return{shape:result,warnings:[`suppression impossible — ${res.err}`].concat(warnings),fatal:true};
  }
  if(res.kept<hs.length){f._m={m:res.kept,t:total};warnings.push(`suppression partielle : ${res.kept}/${total} face(s), ${hs.length-res.kept} refusée(s) par le noyau`);}
  try{result.delete();}catch(e){}
  return{shape:res.r,warnings};
}
function occDelFacesTry(result,hs){
  // Cœur commun au thread principal et au worker (sérialisé tel quel par delWkSource : ni
  // variable extérieure autre que occt / DEL_ISOLE_MAX, ni fonction hors de sa liste).
  // → {r: solide ou null, kept: nb de faces retirées, err: message d'échec, warnings}
  const warnings=[];
  let r=null,echec=null,kept=hs.length;
  try{r=occDeleteFacesOnce(result,hs);}catch(e){echec=e;}
  // Reprise face par face : N+1 suppressions complètes de plus. Sur une grosse pièce, une
  // seule coûte déjà de 0,4 s à plusieurs minutes (Defeaturing OCCT, mesuré V0.15.7) :
  // au-delà de DEL_ISOLE_MAX faces, refus direct plutôt qu'une attente interminable.
  if(!r&&hs.length>DEL_ISOLE_MAX)warnings.push(`pas de reprise face par face au-delà de ${DEL_ISOLE_MAX} faces (trop longue) — supprimez-les en plusieurs fois`);
  if(!r&&hs.length>1&&hs.length<=DEL_ISOLE_MAX){
    const garde=[];
    for(const h of hs){
      try{const t=occDeleteFacesOnce(result,garde.concat([h]));try{t.delete();}catch(e){}garde.push(h);}catch(e){}
    }
    if(garde.length){
      try{r=occDeleteFacesOnce(result,garde);}catch(e){echec=e;}
      if(r)kept=garde.length;
    }
  }
  return{r,kept:r?kept:0,err:r?null:String((echec&&echec.message)||echec),warnings};
}
/* ---------- scinder par un plan : faces ou corps (V0.11.5) ----------
   {type:'xsplit', mode:'face'|'body', body, pl:{src,cg?,o?,n?}, off, flip, faces?, newBody?}
   • Faces : chaque face visée (référence durable occFaceRefAny) est coupée par sa ligne
     d'intersection avec le plan (BRepAlgoAPI_Section) ; le Splitter imprime ces arêtes
     sur le solide, qui reste UN solide (faces voisines recousues, volume inchangé).
   • Corps : le Splitter coupe le solide par une grande face plane ; les morceaux du côté
     opposé à la normale restent dans le corps, ceux du côté de la normale vont dans le
     corps neuf `newBody` (« Inverser » échange les côtés). Mesuré : boîte 100x60x40
     coupée à X=30 → 72 000 + 168 000 mm³. */
