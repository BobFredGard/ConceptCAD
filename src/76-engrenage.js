/* ---------- ENGRENAGE (fonction 3D, plan docs/plan-engrenages-niveau-1.md) ----------
   f = {type:'gear', m, z, alpha, b, x, beta, hand, kind ('int' couronne, 'rack' crémaillère), D, H} : solide posé sur XY (z = 0 à z = b), axe sur Z, une
   dent sur +X en bas. Pas d'esquisse : le contour (48-engrenages-calcul) va directement au noyau, en vraies
   courbes (B-spline des flancs, arcs de tête et de pied), et les 60 dents d'une grande roue ne
   chargent pas le solveur. On change la roue par « Modifier la pièce normalisée… ». */
function gearSig(f){return [+f.m,+f.z,+f.alpha,+f.b,+f.x||0,+f.beta||0,f.hand==='L'?'L':'R',f.kind==='int'||f.kind==='rack'?f.kind:'ext',+f.D||0,+f.H||0,+f.j||0,+f.ks||0];}
function gearWire(g,bin,outline){
  const pnt=q=>occBinPush(bin,new occt.gp_Pnt_3(q[0],q[1],0));
  const ax=occBinPush(bin,new occt.gp_Ax2_3(pnt([0,0]),occBinPush(bin,new occt.gp_Dir_4(0,0,1))));
  const mkW=occBinPush(bin,new occt.BRepBuilderAPI_MakeWire_1());
  (outline||gearOutline(g)).forEach(s=>{
    let me;
    if(s.k==='ln')me=new occt.BRepBuilderAPI_MakeEdge_3(pnt(s.a),pnt(s.b));
    else if(s.k==='arc'){
      const circ=occBinPush(bin,new occt.gp_Circ_2(ax,s.r));
      const at=a=>pnt([s.r*Math.cos(a),s.r*Math.sin(a)]);
      me=new occt.BRepBuilderAPI_MakeEdge_10(circ,at(s.a0),at(s.a1));
    }else{
      const poles=occBinPush(bin,new occt.TColgp_Array1OfPnt_2(1,s.poles.length));
      s.poles.forEach((q,i)=>poles.SetValue(i+1,pnt(q)));
      const kn=occBinPush(bin,new occt.TColStd_Array1OfReal_2(1,s.knots.length)),mu=occBinPush(bin,new occt.TColStd_Array1OfInteger_2(1,s.knots.length));
      s.knots.forEach((v,i)=>{kn.SetValue(i+1,v);mu.SetValue(i+1,s.mults[i]);});
      me=new occt.BRepBuilderAPI_MakeEdge_24(occBinPush(bin,new occt.Handle_Geom_Curve_2(new occt.Geom_BSplineCurve_1(poles,kn,mu,3,false))));
    }
    occBinPush(bin,me);me.Build();
    if(!me.IsDone())throw new Error('arête de denture impossible');
    mkW.Add_1(me.Edge());
  });
  mkW.Build();
  if(!mkW.IsDone())throw new Error('contour de denture non fermé');
  return mkW.Wire();
}
function gearHelixSolid(g,bin){
  // Denture hélicoïdale : la section droite balaie l'axe, et une hélice tracée sur le cylindre primitif
  // (fil auxiliaire) la fait tourner. Écart du flanc mesuré contre la théorie : < 1 µm (tests/test_engrenages.cjs).
  const O=occBinPush(bin,new occt.gp_Pnt_3(0,0,0)),Z=occBinPush(bin,new occt.gp_Dir_4(0,0,1));
  const cyl=occBinPush(bin,new occt.gp_Ax3_3(O,Z,occBinPush(bin,new occt.gp_Dir_4(1,0,0))));
  const surf=occBinPush(bin,new occt.Handle_Geom_Surface_2(new occt.Geom_CylindricalSurface_1(cyl,g.rp)));
  const line=occBinPush(bin,new occt.Handle_Geom2d_Curve_2(new occt.Geom2d_Line_3(occBinPush(bin,new occt.gp_Pnt2d_3(0,0)),occBinPush(bin,new occt.gp_Dir2d_4(g.twist,g.b)))));
  const me=occBinPush(bin,new occt.BRepBuilderAPI_MakeEdge_31(line,surf,0,Math.hypot(g.twist,g.b)));
  if(!me.IsDone())throw new Error('hélice de la denture impossible');
  const he=me.Edge();occt.BRepLib.BuildCurves3d_2(he);
  const hw=occBinPush(bin,new occt.BRepBuilderAPI_MakeWire_1());hw.Add_1(he);hw.Build();
  const se=occBinPush(bin,new occt.BRepBuilderAPI_MakeEdge_3(O,occBinPush(bin,new occt.gp_Pnt_3(0,0,g.b))));
  const sw=occBinPush(bin,new occt.BRepBuilderAPI_MakeWire_1());sw.Add_1(se.Edge());sw.Build();
  const ps=occBinPush(bin,new occt.BRepOffsetAPI_MakePipeShell(sw.Wire()));
  const noContact=occt.BRepFill_TypeOfContact.BRepFill_NoContact; // même appel, nommé autrement selon le noyau
  if(ps.SetMode_5)ps.SetMode_5(hw.Wire(),false,noContact);else ps.SetMode(hw.Wire(),false,noContact);
  ps.Add_1(gearWire(g,bin),false,false);
  ps.Build();
  if(!ps.IsDone())throw new Error('balayage de la denture hélicoïdale impossible');
  if(!ps.MakeSolid())throw new Error('denture hélicoïdale : le solide ne se ferme pas');
  return ps.Shape();
}
function gearRingFace(g,z,inner,bin){
  // Base de couronne à la hauteur z : disque extérieur percé du bord intérieur donné
  const ax=occBinPush(bin,new occt.gp_Ax2_3(occBinPush(bin,new occt.gp_Pnt_3(0,0,z)),occBinPush(bin,new occt.gp_Dir_4(0,0,1))));
  const edge=occBinPush(bin,new occt.BRepBuilderAPI_MakeEdge_8(occBinPush(bin,new occt.gp_Circ_2(ax,g.D/2))));
  const w=occBinPush(bin,new occt.BRepBuilderAPI_MakeWire_1());w.Add_1(edge.Edge());w.Build();
  const mf=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace_15(w.Wire(),true));
  mf.Add(occt.TopoDS.Wire_1(inner.Reversed()));mf.Build();
  if(!mf.IsDone())throw new Error('base de couronne impossible');
  const fx=occBinPush(bin,new occt.ShapeFix_Face_2(mf.Face()));fx.FixOrientation_1();
  return fx.Face();
}
function gearRingSolid(g,bin){
  // Couronne, sans découpe (50 fois plus lente sur ces surfaces, et figerait l'application) :
  // droite : base percée extrudée. Hélicoïdale : les flancs balayés de la « roue » de son bord intérieur,
  // cousus avec l'extérieur et deux bases percées de ce même bord.
  if(!g.betaDeg){
    const pr=occBinPush(bin,new occt.BRepPrimAPI_MakePrism_1(gearRingFace(g,0,gearWire(g,bin),bin),occBinPush(bin,new occt.gp_Vec_4(0,0,g.b)),false,true));
    pr.Build();
    if(!pr.IsDone())throw new Error('extrusion de la couronne impossible');
    return pr.Shape();
  }
  const plug=gearHelixSolid(g,bin),sew=occBinPush(bin,new occt.BRepBuilderAPI_Sewing(1e-4,true,true,true,false));
  const faces=occSubShapes(plug,'TopAbs_FACE');
  try{
    faces.forEach(f=>{
      const F=occt.TopoDS.Face_1(f),S=occBinPush(bin,new occt.BRepAdaptor_Surface_2(F,true));
      if(S.GetType()!==occt.GeomAbs_SurfaceType.GeomAbs_Plane){sew.Add(f);return;}
      const P=occBinPush(bin,new occt.GProp_GProps_1());occt.BRepGProp.SurfaceProperties_1(F,P,false,false);
      sew.Add(gearRingFace(g,P.CentreOfMass().Z(),occt.BRepTools.OuterWire(F),bin));
    });
  }finally{occDispose(faces);}
  const ax=occBinPush(bin,new occt.gp_Ax2_3(occBinPush(bin,new occt.gp_Pnt_3(0,0,0)),occBinPush(bin,new occt.gp_Dir_4(0,0,1))));
  const edge=occBinPush(bin,new occt.BRepBuilderAPI_MakeEdge_8(occBinPush(bin,new occt.gp_Circ_2(ax,g.D/2))));
  const side=occBinPush(bin,new occt.BRepPrimAPI_MakePrism_1(edge.Edge(),occBinPush(bin,new occt.gp_Vec_4(0,0,g.b)),false,true));side.Build();
  sew.Add(side.Shape());
  sew.Perform(occBinPush(bin,new occt.Handle_Message_ProgressIndicator_1()));
  if(sew.NbFreeEdges()>0)throw new Error('couronne non fermée ('+sew.NbFreeEdges()+' arêtes libres)');
  const ex=occBinPush(bin,new occt.TopExp_Explorer_2(sew.SewedShape(),occt.TopAbs_ShapeEnum.TopAbs_SHELL,occt.TopAbs_ShapeEnum.TopAbs_SHAPE));
  if(!ex.More())throw new Error('coque de couronne introuvable');
  const ms=occBinPush(bin,new occt.BRepBuilderAPI_MakeSolid_1());
  ms.Add(occShellCur(ex));
  let sol=ms.Solid();
  const gp=occBinPush(bin,new occt.GProp_GProps_1());occt.BRepGProp.VolumeProperties_1(sol,gp,false,false,false);
  if(gp.Mass()<0)sol=sol.Reversed();
  return sol;
}
function gearRackSolid(g,bin){
  // Droite : section extrudée. Inclinée : section plus longue poussée en biais, puis recoupée d'équerre aux deux bouts.
  const extra=g.betaDeg?Math.ceil(Math.abs(g.shift)/g.pt)+1:0;
  const mf=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace_15(gearWire(g,bin,gearRackOutline(g,extra)),true));
  if(!mf.IsDone())throw new Error('face de crémaillère impossible');
  const pr=occBinPush(bin,new occt.BRepPrimAPI_MakePrism_1(mf.Face(),occBinPush(bin,new occt.gp_Vec_4(g.betaDeg?g.shift:0,0,g.b)),false,true));
  pr.Build();
  if(!pr.IsDone())throw new Error('extrusion de la crémaillère impossible');
  if(!g.betaDeg)return pr.Shape();
  const pnt=(x,y,z)=>occBinPush(bin,new occt.gp_Pnt_3(x,y,z));
  const box=occBinPush(bin,new occt.BRepPrimAPI_MakeBox_3(pnt(-g.L/2,g.yb-1,-1),pnt(g.L/2,g.ya+1,g.b+1)));
  const c=occBinPush(bin,new occt.BRepAlgoAPI_Common_3(pr.Shape(),box.Shape()));
  c.Build();
  if(!c.IsDone())throw new Error('coupe des bouts de la crémaillère impossible');
  return c.Shape();
}
function gearSolid(f,bin){
  const g=gearGeom(f);
  if(g.rack)return gearRackSolid(g,bin);
  if(g.internal)return gearRingSolid(g,bin);
  if(g.betaDeg)return gearHelixSolid(g,bin);
  const mf=occBinPush(bin,new occt.BRepBuilderAPI_MakeFace_15(gearWire(g,bin),true));
  if(!mf.IsDone())throw new Error('face de denture impossible');
  const pr=occBinPush(bin,new occt.BRepPrimAPI_MakePrism_1(mf.Face(),occBinPush(bin,new occt.gp_Vec_4(0,0,g.b)),false,true));
  pr.Build();
  if(!pr.IsDone())throw new Error('extrusion de la denture impossible');
  return pr.Shape();
}
function renderGearProps(p,f){
  const row=(lab,val)=>{const r=document.createElement('div');r.className='pnl-row';
    const L=document.createElement('label');L.textContent=lab;r.appendChild(L);
    const v=document.createElement('span');v.textContent=val;r.appendChild(v);p.appendChild(r);};
  let g=null;try{g=gearGeom(f);}catch(e){g=null;}
  const h=document.createElement('div');h.className='pnl-h';h.textContent=g&&g.rack?'Crémaillère':g&&g.internal?'Couronne à denture intérieure':'Engrenage';p.appendChild(h);
  if(g&&g.rack){
    row('Module',stdF(g.m)+' mm');row('Dents',String(g.z));row('Angle de pression',stdF(g.aDeg)+'°');
    if(g.betaDeg)row('Inclinaison',stdF(g.betaDeg)+'° main '+(g.hand==='L'?'gauche':'droite'));
    row('Largeur',stdF(g.b)+' mm');row('Pas',stdF(g.pt)+' mm');row('Longueur',stdF(g.L)+' mm');row('Hauteur totale',stdF(g.ya-g.yb)+' mm');
    gearChecks(g).forEach(c=>{const d=document.createElement('div');d.className='pnl-note';d.textContent=(c.lvl==='ok'?'✓ ':'⚠ ')+c.txt;p.appendChild(d);});
  }else if(g){
    row(g.betaDeg?'Module normal':'Module',stdF(g.m)+' mm');row('Dents',String(g.z));row('Angle de pression',stdF(g.aDeg)+'°');
    if(g.betaDeg){row('Hélice',stdF(g.betaDeg)+'° main '+(g.hand==='L'?'gauche':'droite'));row('Module apparent',stdF(g.mt)+' mm');}
    row('Déport x',stdF(g.x));row('Largeur',stdF(g.b)+' mm');
    row('Ø primitif',stdF(2*g.rp)+' mm');row('Ø de tête',stdF(2*g.ra)+' mm');row('Ø de pied',stdF(2*g.rf)+' mm');row('Ø de base',stdF(2*g.rb)+' mm');
    if(g.internal)row('Ø extérieur',stdF(g.D)+' mm');
    gearChecks(g).forEach(c=>{const d=document.createElement('div');d.className='pnl-note';d.textContent=(c.lvl==='ok'?'✓ ':'⚠ ')+c.txt;p.appendChild(d);});
  }
  const n=document.createElement('div');n.className='pnl-note';
  n.textContent=f._err?('⚠ '+f._err):'Pour changer cette roue : en assemblage, clic droit sur la pièce → « Modifier la pièce normalisée… ».';
  p.appendChild(n);
}
