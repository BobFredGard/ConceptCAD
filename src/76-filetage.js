/* ═══════════════════════════════════════════════════════════════════════════
   FILETAGE (fonction 3D) — V0.35.0
   Demande : « une fonction filetage pour les axes, pour faire des vis par exemple,
   et l'appliquer au standard de visserie de l'Assemblage » ; « les filets auront les
   mêmes spirales que les trous taraudés, cachées avec la vis quand elle l'est ».

   • On clique la face CYLINDRIQUE EXTÉRIEURE d'un axe. Taille proposée d'après son Ø
     (métrique ISO, UNC / UNF, gaz G), pas, sens (LH), longueur (toute la face ou donnée),
     filet cosmétique (spirale dessinée, comme un taraudage) ou modélisé (profil ISO 68-1
     creusé dans le corps, noyau exact).
   • f = {type:'xthread', cyl:{c,u,r,p} (axe, rayon et point cliqué : référence durable),
          size, p, lh, model, clear, lenMode:'full'|'len', len, flip (départ à l'autre bout)}
   • Le départ est le bout LIBRE de la face (rien au-delà, ou seulement un chanfrein) :
     le filet y débouche ; l'autre bout (épaulement, tête de vis) l'arrête net.
   • Filet modélisé : comme le taraudage (src/76-percage, occHoleThreadVoid), le VIDE
     fileté est construit directement (faces réglées entre hélices, aucun booléen) et
     creusé en fin de rejeu du corps (occReplayBody, `threads`, worker). Il contient la
     peau du cylindre (crête 0,01 sous le Ø de la face) : la découpe ne calcule aucune
     intersection de flanc avec le cylindre, seulement avec les faces des bouts.
   • Rien n'est ajouté au solide dans l'arbre : les fonctions suivantes voient l'axe lisse.
   ═══════════════════════════════════════════════════════════════════════════ */
// Géométrie résolue au dernier rejeu, par fonction : {o (axe, bout de départ), d (vers
// l'intérieur), R, rR, len, bid} — hors du document (pas dans l'empreinte docHash).
const threadGeo=new Map();
const threadCk=new Map(); // clé de préfixe du rejeu → {g, thr (copie), w}
function threadDims(size,p,clear,R){
  // Filet extérieur ISO 68-1 (profil de base) : crête au Ø majeur d (méplat p/8), racine
  // au Ø d1 = d − 1,0825·p (méplat p/4), flancs à 60°. clear : jeu d'impression sur le Ø.
  const t=isoThread(size);if(!t)return null;
  const d=+t[1],P=+p||+t[2];if(!(d>0)||!(P>0))return null;
  const c=Math.max(0,+clear||0)/2,d1=d-1.082532*P;
  const rC=Math.min((R>0?R:d/2)-0.01,d/2-c),rR=d1/2-c;
  if(!(rC-rR>0.1*P)||!(rR>0))return null;
  return {d,P,d1,rC,rR,w:P/8,h:P/8+(rC-rR)*Math.tan(Math.PI/6)};
}
function threadSizeFor(D){
  // Taille la plus proche du Ø (métrique ISO d'abord, à Ø égal), pas gros
  let best=null,bd=1e9;
  ALL_THREADS.forEach(function(t){if(threadInfo(t[0]).cone)return;const e=Math.abs(t[1]-D)+(threadInfo(t[0]).fam==='M'?0:1e-3);if(e<bd){bd=e;best=t;}});
  return best?{size:best[0],p:best[2],err:bd}:null;
}
function threadLabel(f){
  if(!f||!f.size)return '';
  const t=isoThread(f.size);
  return f.size+((t&&+f.p!==t[2])?('×'+String(f.p).replace('.',',')):'')+(f.lh?'-LH':'');
}
function threadName(f){
  const L=(f.lenMode==='len')?(' × '+String(+(+f.len||0).toFixed(2)).replace('.',',')):' (toute la face)';
  return 'Filetage '+threadLabel(f)+L;
}
/* ----- face cylindrique de la fonction, sur le solide courant ----- */
function threadCylOf(face){
  // {c,u,r} d'une face cylindrique (axe monde), ou null
  let ad=null;
  try{
    ad=new occt.BRepAdaptor_Surface_2(face,true);
    if(ad.GetType()!==occt.GeomAbs_SurfaceType.GeomAbs_Cylinder)return null;
    const cy=ad.Cylinder(),a=cy.Axis(),l=a.Location(),d=a.Direction();
    const c=[l.X(),l.Y(),l.Z()],u=[d.X(),d.Y(),d.Z()];
    const v0=ad.FirstVParameter(),v1=ad.LastVParameter();
    return {c,u,r:cy.Radius(),v0:Math.min(v0,v1),v1:Math.max(v0,v1)};
  }catch(e){return null;}
  finally{try{if(ad)ad.delete();}catch(e){}}
}
function threadAxisT(ref,q){return (q[0]-ref.c[0])*ref.u[0]+(q[1]-ref.c[1])*ref.u[1]+(q[2]-ref.c[2])*ref.u[2];}
function threadPerp(u){
  const ref=Math.abs(u[2])<0.9?[0,0,1]:[1,0,0];
  const x=[u[1]*ref[2]-u[2]*ref[1],u[2]*ref[0]-u[0]*ref[2],u[0]*ref[1]-u[1]*ref[0]],L=Math.hypot(x[0],x[1],x[2])||1;
  return [x[0]/L,x[1]/L,x[2]/L];
}
function threadResolve(shape,f){
  // Faces cylindriques coaxiales de même rayon que la référence → étendue axiale [a, b]
  // (repère de f.cyl : t le long de f.cyl.u) du tronçon contenant le point cliqué.
  const ref=f.cyl;if(!ref||!Array.isArray(ref.c)||!Array.isArray(ref.u)||!(ref.r>0))throw new Error('face de l’axe non définie');
  // La face cylindrique par son NOM (20-05) : l'axe et le rayon la suivent si la pièce a bougé
  if(ref.nom){
    const h=nomsRefFace(shape,ref);
    if(h){
      const C=threadCylOf(h);try{h.delete();}catch(e){}
      if(C){
        const w=[C.c[0]-ref.c[0],C.c[1]-ref.c[1],C.c[2]-ref.c[2]],t=w[0]*ref.u[0]+w[1]*ref.u[1]+w[2]*ref.u[2];
        const q=[w[0]-t*ref.u[0],w[1]-t*ref.u[1],w[2]-t*ref.u[2]];
        if(Math.hypot(q[0],q[1],q[2])>1e-6&&Math.abs(C.u[0]*ref.u[0]+C.u[1]*ref.u[1]+C.u[2]*ref.u[2])>0.9999){
          ref.c=ref.c.map((v,i)=>v+q[i]);
          if(Array.isArray(ref.p))ref.p=ref.p.map((v,i)=>v+q[i]);
        }
        if(Math.abs(C.r-ref.r)>1e-6)ref.r=C.r;
      }
    }
  }
  const spans=[];let nomVu=null;
  const tp0=!ref.nom&&Array.isArray(ref.p)?threadAxisT(ref,ref.p):null;
  const ex=new occt.TopExp_Explorer_2(shape,occt.TopAbs_ShapeEnum.TopAbs_FACE,occt.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try{
    for(;ex.More();ex.Next()){
      const fc=occFaceCur(ex);
      const C=threadCylOf(fc);
      if(!C||Math.abs(C.r-ref.r)>0.02){try{fc.delete();}catch(e){}continue;}
      const dot=C.u[0]*ref.u[0]+C.u[1]*ref.u[1]+C.u[2]*ref.u[2];if(Math.abs(dot)<0.9999){try{fc.delete();}catch(e){}continue;}
      const w=[C.c[0]-ref.c[0],C.c[1]-ref.c[1],C.c[2]-ref.c[2]],t=w[0]*ref.u[0]+w[1]*ref.u[1]+w[2]*ref.u[2];
      if(Math.hypot(w[0]-t*ref.u[0],w[1]-t*ref.u[1],w[2]-t*ref.u[2])>0.02){try{fc.delete();}catch(e){}continue;}
      const ta=t+dot*C.v0,tb=t+dot*C.v1;
      spans.push([Math.min(ta,tb),Math.max(ta,tb)]);
      // Référence ancienne : la face sous le point cliqué donne son nom
      if(tp0!==null&&!nomVu&&tp0>=Math.min(ta,tb)-0.01&&tp0<=Math.max(ta,tb)+0.01)nomVu=nomsFaceDe(shape,fc);
      try{fc.delete();}catch(e){}
    }
  }finally{try{ex.delete();}catch(e){}}
  if(nomVu)ref.nom=nomVu;
  if(!spans.length)throw new Error('face cylindrique Ø'+String(+(2*ref.r).toFixed(2)).replace('.',',')+' introuvable');
  spans.sort(function(x,y){return x[0]-y[0];});
  const M=[];spans.forEach(function(s){const L=M[M.length-1];if(L&&s[0]<=L[1]+0.01)L[1]=Math.max(L[1],s[1]);else M.push(s.slice());});
  const tp=Array.isArray(ref.p)?threadAxisT(ref,ref.p):(M[0][0]+M[0][1])/2;
  let best=M[0],bd=1e18;
  M.forEach(function(s){const d=tp<s[0]?s[0]-tp:(tp>s[1]?tp-s[1]:0);if(d<bd){bd=d;best=s;}});
  return {a:best[0],b:best[1]};
}
function threadFreeDist(cl,ref,t0,sg,r,maxD){
  // Bout libre ? distance (le long de sg·u, depuis t0) où la matière cesse au rayon r
  // (racine du filet), ou null si elle continue au-delà de maxD (épaulement, tête).
  const U=threadPerp(ref.u),IN=occt.TopAbs_State.TopAbs_IN;
  const inAt=function(s){
    const t=t0+sg*s;let n=0;
    for(let k=0;k<3;k++){
      const a=k*2*Math.PI/3,V=[ref.u[1]*U[2]-ref.u[2]*U[1],ref.u[2]*U[0]-ref.u[0]*U[2],ref.u[0]*U[1]-ref.u[1]*U[0]];
      const q=[0,1,2].map(function(i){return ref.c[i]+ref.u[i]*t+(U[i]*Math.cos(a)+V[i]*Math.sin(a))*r;});
      const P=new occt.gp_Pnt_3(q[0],q[1],q[2]);cl.Perform(P,1e-7);if(cl.State()===IN)n++;try{P.delete();}catch(e){}
    }
    return n>0;
  };
  for(let s=0.02;s<=maxD;s+=0.05)if(!inAt(s))return s;
  return null;
}
/* ----- vide fileté extérieur ----- */
// Même construction que le vide d'un taraudage (occHoleThreadVoid), retournée : le vide
// va de la paroi filetée VERS L'EXTÉRIEUR, jusqu'au rayon Rout (hors matière). Un tour =
// 4 faces réglées de paroi (flanc, racine, flanc, crête) + 1 bande cylindrique au rayon
// Rout ; tours suivants translatés d'un pas, cousus ; fermeture aux deux bouts par une
// rampe hélicoïdale (Rout → crête) et un bouchon plan dans le plan axial.
// Étendue le long de D : de zStart à zStart + (nT+1)·p.
function occShaftThreadVoid(P,D,zStart,nT,th,Rout,lh,bins){
  const p=th.P,rC=th.rC,rR=th.rR,w=th.w,h=th.h;
  if(!(nT>=1)||!(Rout>rC+1e-3)||!(h<p/2))return null;
  const cross=function(a,b){return {x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x};};
  const norm=function(a){const l=Math.hypot(a.x,a.y,a.z)||1;return {x:a.x/l,y:a.y/l,z:a.z/l};};
  const ref=Math.abs(D.z)<0.9?{x:0,y:0,z:1}:{x:1,y:0,z:0};
  // départ tourné de ~37° : jamais aligné sur la couture du cylindre de l'axe
  const U0=norm(cross(D,ref)),V0=cross(D,U0),ca=Math.cos(0.65),sa=Math.sin(0.65);
  const U={x:U0.x*ca+V0.x*sa,y:U0.y*ca+V0.y*sa,z:U0.z*ca+V0.z*sa};
  const z0=zStart+h;
  const pnt=function(q){return occBinPush(bins,new occt.gp_Pnt_3(q.x,q.y,q.z));};
  const dirOf=function(q){return occBinPush(bins,new occt.gp_Dir_4(q.x,q.y,q.z));};
  const at=function(r,s){return {x:P.x+D.x*(z0+s)+U.x*r,y:P.y+D.y*(z0+s)+U.y*r,z:P.z+D.z*(z0+s)+U.z*r};};
  // profil d'un tour (r, s le long de D) : gorge à racine p/4, crête p/8 entre deux tours
  const q=[[Rout,-h],[rC,-h],[rR,-w],[rR,w],[rC,h],[rC,p-h],[Rout,p-h]];
  const hs=lh?-1:1;
  const helix=function(r,s){
    const ax3=occBinPush(bins,new occt.gp_Ax3_3(pnt(at(0,s)),dirOf(D),dirOf(U)));
    const hSurf=occBinPush(bins,new occt.Handle_Geom_Surface_2(new occt.Geom_CylindricalSurface_1(ax3,r)));
    const hLine=occBinPush(bins,new occt.Handle_Geom2d_Curve_2(new occt.Geom2d_Line_3(
      occBinPush(bins,new occt.gp_Pnt2d_3(0,0)),occBinPush(bins,new occt.gp_Dir2d_4(hs*2*Math.PI,p)))));
    const me=occBinPush(bins,new occt.BRepBuilderAPI_MakeEdge_31(hLine,hSurf,0,Math.hypot(2*Math.PI,p)));
    if(!me.IsDone())throw new Error('hélice impossible');
    const e=me.Edge();occt.BRepLib.BuildCurves3d_2(e);return e;
  };
  const H=q.map(function(a){return helix(a[0],a[1]);});
  const ruled=function(i,j){return occt.BRepFill.Face(H[i],H[j]);};
  const turn=[ruled(1,2),ruled(2,3),ruled(3,4),ruled(4,5),ruled(0,6)];
  const cap=function(k){
    const pl=occBinPush(bins,new occt.BRepBuilderAPI_MakePolygon_1());
    q.forEach(function(a){pl.Add_1(pnt(at(a[0],a[1]+k*p)));});pl.Close();
    const mf=occBinPush(bins,new occt.BRepBuilderAPI_MakeFace_15(pl.Wire(),true));
    if(!mf.IsDone())throw new Error('bouchon de filet impossible');
    return mf.Face();
  };
  const moved=function(s,k){
    if(!k)return s;
    const g=occBinPush(bins,new occt.gp_Trsf_1());g.SetTranslation_1(occBinPush(bins,new occt.gp_Vec_4(D.x*p*k,D.y*p*k,D.z*p*k)));
    return occBinPush(bins,new occt.BRepBuilderAPI_Transform_2(s,g,true)).Shape();
  };
  const sew=occBinPush(bins,new occt.BRepBuilderAPI_Sewing(1e-4,true,true,true,false));
  for(let k=0;k<nT;k++)turn.forEach(function(s){sew.Add(moved(s,k));});
  sew.Add(ruled(0,1));sew.Add(cap(0));          // départ : rampe + bouchon
  sew.Add(moved(ruled(5,6),nT-1));sew.Add(cap(nT)); // arrêt : rampe + bouchon
  sew.Perform(occBinPush(bins,new occt.Handle_Message_ProgressIndicator_1()));
  if(sew.NbFreeEdges()>0)throw new Error('filet non fermé ('+sew.NbFreeEdges()+' arêtes libres)');
  const sewn=sew.SewedShape();
  const ex=occBinPush(bins,new occt.TopExp_Explorer_2(sewn,occt.TopAbs_ShapeEnum.TopAbs_SHELL,occt.TopAbs_ShapeEnum.TopAbs_SHAPE));
  if(!ex.More())throw new Error('coque de filet introuvable');
  const ms=occBinPush(bins,new occt.BRepBuilderAPI_MakeSolid_1());
  ms.Add(occShellCur(ex));
  let sol=ms.Solid();
  const gp=occBinPush(bins,new occt.GProp_GProps_1());occt.BRepGProp.VolumeProperties_1(sol,gp,false,false,false);
  if(gp.Mass()<0)sol=sol.Reversed();
  return sol;
}
function threadModelable(f){return !!(f&&f.size&&threadInfo(f.size).model);}
function threadCompute(shape,f,bin){
  // Résout la face, choisit le départ, construit le vide si le filet est modélisé.
  const ref=f.cyl,S=threadResolve(shape,f),w=[];
  const t=isoThread(f.size);if(!t)throw new Error('taille de filet inconnue ('+f.size+')');
  const P=+f.p||t[2],R=ref.r;
  const th=threadDims(f.size,P,threadModelable(f)&&f.model?f.clear:0,R);
  if(!th)throw new Error('profil de filet impossible sur Ø'+String(+(2*R).toFixed(2)).replace('.',','));
  if(Math.abs(2*R-th.d)>Math.max(0.3,0.06*th.d))w.push('Ø de l’axe '+String(+(2*R).toFixed(2)).replace('.',',')+' éloigné du Ø nominal '+String(th.d).replace('.',',')+' du '+f.size);
  // bouts libres (rien au-delà, ou seulement un chanfrein) : le filet y débouche
  let cl=null,fa=null,fb=null;
  try{
    cl=occClassifier(shape);
    const maxD=Math.max(3*P,0.4*R);
    fa=threadFreeDist(cl,ref,S.a,-1,th.rR+0.02,maxD);
    fb=threadFreeDist(cl,ref,S.b,1,th.rR+0.02,maxD);
  }finally{try{if(cl)cl.delete();}catch(e){}}
  // départ : le bout libre (à égalité, le bas de l'axe de référence) ; inversé : l'autre
  let atA=(fa!=null)||(fb==null);if(f.flip)atA=!atA;
  const t0=atA?S.a:S.b,sg=atA?1:-1,free0=atA?fa:fb,free1=atA?fb:fa,span=S.b-S.a;
  const o=[0,1,2].map(function(i){return ref.c[i]+ref.u[i]*t0;}),d=ref.u.map(function(v){return v*sg;});
  // fin du vide (depuis le départ, vers l'intérieur) : jamais dans un épaulement
  const full=free1!=null?span+free1+P+0.1:span-0.05;
  const lim=f.lenMode==='len'?Math.min(Math.max(P,+f.len||0),full):full;
  const zStart=free0!=null?-(free0+P+0.05):0.05;
  const len=f.lenMode==='len'?Math.min(Math.max(P,+f.len||0),span):span;
  const g={o,d,R,rR:th.rR,len,P,lh:!!f.lh,free:free0!=null};
  let thr=null;
  if(f.model&&threadModelable(f)){
    const nT=Math.floor((lim-zStart)/P+1e-9)-1;
    if(nT<1)w.push('filet modélisé ignoré : longueur filetée trop courte');
    else{
      const bins=[];
      try{thr=occShaftThreadVoid({x:o[0],y:o[1],z:o[2]},{x:d[0],y:d[1],z:d[2]},zStart,nT,th,R+Math.max(0.3,0.3*P),!!f.lh,bins);}
      catch(err){w.push('filet modélisé impossible (axe lisse) : '+String(err.message||err));}
      if(bin)bin.push(...bins);else occDispose(bins);
    }
  }else if(f.model)w.push('filet '+(threadInfo(f.size).cone?'conique ':'')+'cosmétique seulement (profil non modélisé)');
  if(!g.free)w.push('aucun bout libre : le filet part du bout de la face et s’y arrête net');
  return {g,thr,w};
}
function threadReplayStep(f,result,ck,msgs,threads,bid,bin){
  // Branche du rejeu (occReplayBodyIn, src/20) : le solide n'est pas modifié ; le vide
  // fileté rejoint les filets des taraudages, creusés en fin de rejeu.
  if(occThreadSkip)return;
  if(!result){msgs.push(`${f.name} : aucun axe à fileter — ignoré`);return;}
  let e=threadCk.get(ck);
  if(!e){
    try{e=threadCompute(result,f,bin);}
    catch(err){threadGeo.delete(f.id);f._err=String(err.message||err);msgs.push(`${f.name} : ${f._err}`);return;}
    if(e.thr){const cp=occShapeCopy(e.thr);e={g:e.g,w:e.w,thr:cp};}
    threadCk.set(ck,e);
    while(threadCk.size>40){const k=threadCk.keys().next().value;const o=threadCk.get(k);threadCk.delete(k);try{if(o.thr)o.thr.delete();}catch(x){}}
  }
  delete f._err;
  threadGeo.set(f.id,Object.assign({bid:bid},e.g));
  f._thLen=+e.g.len.toFixed(3);
  if(e.w.length)msgs.push(...e.w.map(x=>`${f.name} : ${x}`));
  if(e.thr){const cp=occShapeCopy(e.thr);if(cp)threads.push({f,thr:cp});}
}
/* ----- spirales (filet cosmétique) : même dessin que les taraudages ----- */
function threadShaftPaths(stepsPerTurn,inset){
  // Un élément par filetage : {bodyId, helix, ring, spt} — format de holeThreadPaths (76-percage)
  const out=[],spt=stepsPerTurn||24;
  (doc.features||[]).forEach(function(f){
    if(!f||f.type!=='xthread'||f.visible===false||!f.size)return;
    if(f.model&&threadModelable(f)&&!f._err&&!(typeof occThrPending!=='undefined'&&occThrPending))return; // filet dans le solide
    if(typeof tlLocked==='function'&&tlLocked(f))return;
    const g=threadGeo.get(f.id);if(!g)return;
    const D=new THREE.Vector3(g.d[0],g.d[1],g.d[2]).normalize();
    const ref=Math.abs(D.z)<0.9?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0);
    const U=new THREE.Vector3().crossVectors(D,ref).normalize(),V=new THREE.Vector3().crossVectors(D,U).normalize();
    const O=new THREE.Vector3(g.o[0],g.o[1],g.o[2]),rh=g.R+(inset||0.04); // juste HORS de la paroi (facettes du maillage)
    const turns=g.len/g.P,steps=Math.max(spt,Math.ceil(turns*spt)),helix=[],ring=[];
    for(let i=0;i<=steps;i++){
      const a=(g.lh?-1:1)*i/steps*turns*Math.PI*2,z=i/steps*g.len;
      const q=O.clone().addScaledVector(D,z).addScaledVector(U,rh*Math.cos(a)).addScaledVector(V,rh*Math.sin(a));
      helix.push([q.x,q.y,q.z]);
    }
    // fin de la longueur filetée : cercle pointillé
    for(let k=0;k<=48;k++){const a=k/48*Math.PI*2;
      const q=O.clone().addScaledVector(D,g.len).addScaledVector(U,rh*Math.cos(a)).addScaledVector(V,rh*Math.sin(a));
      ring.push([q.x,q.y,q.z]);}
    out.push({bodyId:(typeof occBodyOfFeat==='function'?occBodyOfFeat(f):f.body)||g.bid||null,helix:helix,ring:ring,spt:steps/turns});
  });
  return out;
}
/* ----- création : clic sur la face cylindrique d'un axe ----- */
let threadPick=null; // {fid|null}
function threadFaceInfo(mesh,fi,point){
  // {cyl, bid} d'une face cylindrique EXTÉRIEURE cliquée, ou {err}
  if(!occHas()||!occLive)return {err:'noyau exact requis'};
  const hit=occFaceOfHit(mesh,fi);if(!hit)return {err:'face introuvable'};
  const C=threadCylOf(hit.face);try{hit.face.delete();}catch(e){}
  if(!C)return {err:'choisissez une face CYLINDRIQUE (l’axe à fileter)'};
  const p=[point.x,point.y,point.z],t=threadAxisT(C,p);
  const ax=[0,1,2].map(function(i){return C.c[i]+C.u[i]*t;}),rd=[p[0]-ax[0],p[1]-ax[1],p[2]-ax[2]],L=Math.hypot(rd[0],rd[1],rd[2])||1;
  // extérieure : juste au-delà de la paroi, on est hors matière (un trou : dans la matière)
  let out=true,cl=null;
  try{
    cl=occClassifier(hit.bd.shape);
    const s=C.r+Math.min(0.2,0.1*C.r),P=new occt.gp_Pnt_3(ax[0]+rd[0]/L*s,ax[1]+rd[1]/L*s,ax[2]+rd[2]/L*s);
    cl.Perform(P,1e-7);out=cl.State()!==occt.TopAbs_State.TopAbs_IN;try{P.delete();}catch(e){}
  }catch(e){}finally{try{if(cl)cl.delete();}catch(e){}}
  if(!out)return {err:'c’est un trou : son taraudage se règle dans la fonction Perçage'};
  const r6=function(a){return a.map(function(v){return +(+v).toFixed(6);});};
  return {cyl:{c:r6(ax),u:r6(C.u),r:+C.r.toFixed(6),p:r6(p)},bid:hit.bd.bodyId||hit.bd.id||null};
}
function askThread(){
  if(typeof skEdit!=='undefined'&&skEdit){try{faceEl.textContent='Fermez d’abord l’esquisse.';}catch(e){}return;}
  if(!occHas()||!occLive){alert('Filetage : le noyau exact n’est pas prêt.');return;}
  const s=selFaces&&selFaces[0];
  if(s&&s.geom&&s.geom.kind==='cyl'){const I=threadFaceInfo(s.mesh,s.faceIndex,s.point);if(I.cyl){threadCreate(I);return;}}
  threadPickStart(null);
}
function threadPickStart(fid){
  threadPick={fid:fid};
  try{renderer.domElement.style.cursor='crosshair';}catch(e){}
  try{faceEl.textContent='Filetage : cliquez la face cylindrique de l’axe à fileter — Échap pour annuler.';}catch(e){}
}
function threadPickCancel(){threadPick=null;try{renderer.domElement.style.cursor='default';}catch(e){}}
function threadPickAt(e){
  if(!threadPick)return false;
  const h=pick(e);if(!h){try{faceEl.textContent='Filetage : aucune face sous le curseur.';}catch(e2){}return true;}
  const I=threadFaceInfo(h.object,h.faceIndex,h.point);
  if(!I.cyl){try{faceEl.textContent='Filetage : '+I.err+'.';}catch(e2){}return true;}
  const fid=threadPick.fid;threadPickCancel();
  const f=fid&&doc.features.find(function(x){return x.id===fid;});
  if(f){
    docPushUndo('filetage : face');
    f.cyl=I.cyl;if(I.bid)f.body=I.bid;
    const z=threadSizeFor(2*I.cyl.r);if(z&&z.err<0.5){f.size=z.size;f.p=z.p;}
    f.name=threadName(f);markDirty();rebuild();renderTree();renderProps();
    try{faceEl.textContent='Filetage : nouvelle face retenue.';}catch(e2){}
  }else threadCreate(I);
  return true;
}
function threadCreate(I){
  const z=threadSizeFor(2*I.cyl.r)||{size:'M8',p:1.25};
  const nf={id:uid('th'),type:'xthread',name:'',cyl:I.cyl,size:z.size,p:z.p,lh:false,model:false,clear:0,
    lenMode:'full',len:+Math.max(z.p*3,2*I.cyl.r*1.5).toFixed(1),flip:false,visible:true};
  if(I.bid)nf.body=I.bid;
  nf.name=threadName(nf);
  addFeature(nf);
  sel={kind:'feature',id:nf.id};treeSel=[];
  markDirty();rebuild();renderTree();renderProps();
  try{faceEl.textContent='Filetage '+threadLabel(nf)+' : réglez la taille, la longueur et le type de filet.'+(z.err>0.3?' (Ø de l’axe éloigné des tailles normalisées)':'');}catch(e){}
}
/* ----- panneau de la fonction ----- */
function renderThreadProps(p,f){
  const go=function(){f.name=threadName(f);markDirty();rebuild();renderTree();renderProps();};
  const pH=t=>{const h=document.createElement('div');h.className='pnl-h';h.textContent=t;p.appendChild(h);return h;};
  const pRow=(lab,el)=>{const r=document.createElement('div');r.className='pnl-row';
    const L=document.createElement('label');L.textContent=lab;r.appendChild(L);if(el)r.appendChild(el);p.appendChild(r);return r;};
  const pNote=t=>{const n=document.createElement('div');n.className='pnl-note';n.textContent=t;p.appendChild(n);return n;};
  const pBtns=list=>{const d=document.createElement('div');d.className='pnl-btns';
    list.forEach(([t,fn])=>{const b=document.createElement('button');b.textContent=t;b.onclick=fn;d.appendChild(b);});p.appendChild(d);return d;};
  const sel=function(opts,val,fn){const s=document.createElement('select');let grp=s;
    opts.forEach(function(o){if(o.g){grp=document.createElement('optgroup');grp.label=o.g;s.appendChild(grp);return;}
      const op=document.createElement('option');op.value=o[0];op.textContent=o[1];grp.appendChild(op);});
    s.value=String(val);s.onchange=function(){docPushUndo('filetage');fn(s.value);go();};return s;};
  const num=function(val,fn,min){const i=document.createElement('input');i.type='text';i.inputMode='decimal';
    i.value=String(+(+val).toFixed(3)).replace('.',',');
    const c=function(){const v=parseFloat(String(i.value).replace(',','.'));if(isFinite(v)&&v>=min){docPushUndo('filetage');fn(v);go();}};
    i.addEventListener('change',c);i.addEventListener('keydown',function(e){if(e.key==='Enter'){c();i.blur();}e.stopPropagation();});
    i.addEventListener('click',function(e){e.stopPropagation();});return i;};
  const fx=v=>String(+(+v).toFixed(3)).replace('.',',');
  const D=f.cyl?2*f.cyl.r:0;
  pH('Filetage');
  pNote('Axe Ø'+fx(D)+(f._err?' — ⚠ '+f._err:''));
  // tailles : celles proches du Ø de l'axe d'abord, puis toutes (mêmes familles que le taraudage)
  const opts=[];
  const near=ALL_THREADS.filter(function(t){return !threadInfo(t[0]).cone&&Math.abs(t[1]-D)<Math.max(0.6,0.08*D);}); // coniques (Rc, NPT) : pas sur un axe cylindrique
  const push=function(t){if(threadInfo(t[0]).fam==='M'){for(let k=2;k<t.length;k++)opts.push([t[0]+'|'+t[k],threadOptLabel(t,k)]);}else opts.push([t[0]+'|'+t[2],threadOptLabel(t,2)]);};
  if(near.length){opts.push({g:'Au Ø de l’axe'});near.forEach(push);}
  opts.push({g:'Métrique ISO'});ISO_THREADS.forEach(push);
  [['UNC','ANSI UNC (gros)'],['UNF','ANSI UNF (fin)'],['G','Gaz G — cylindrique (ISO 228)']].forEach(function(F){
    opts.push({g:F[1]});THREADS_UN.concat(THREADS_GAZ).forEach(function(t){if(threadInfo(t[0]).fam===F[0])push(t);});});
  const cur=f.size+'|'+f.p;
  pRow('Taille',sel(opts,cur,function(v){const q=v.split('|');f.size=q[0];f.p=+q[1];if(!threadModelable(f))f.model=false;}));
  pRow('Sens du filet',sel([['rh','À droite'],['lh','À gauche (LH)']],f.lh?'lh':'rh',function(v){f.lh=(v==='lh');}));
  pRow('Longueur filetée',sel([['full','Toute la face'],['len','Longueur']],f.lenMode==='len'?'len':'full',function(v){f.lenMode=v;}));
  if(f.lenMode==='len')pRow('Longueur (mm)',num(f.len||10,function(v){f.len=v;},0.1));
  if(f._thLen)pNote('Longueur filetée effective : '+fx(f._thLen)+' mm');
  pRow('Départ',sel([['0','Bout libre (auto)'],['1','Autre bout']],f.flip?'1':'0',function(v){f.flip=(v==='1');}));
  if(threadModelable(f)){
    pRow('Filet',sel([['cosmetic','Cosmétique (spirale dessinée, axe lisse)'],['model','Modélisé — profil ISO dans le corps']],f.model?'model':'cosmetic',function(v){f.model=(v==='model');}));
    if(f.model){
      pRow('Jeu (Ø mm, impression 3D)',num(f.clear||0,function(v){f.clear=v;},0));
      const th=threadDims(f.size,f.p,f.clear,f.cyl&&f.cyl.r);
      if(th)pNote((threadInfo(f.size).fam==='M'?'ISO 68-1 / ISO 965-1':'ASME B1.1 (profil 60°)')+' : Ø majeur '+fx(2*th.rC+0.02)+' (crête) / Ø mineur '+fx(2*th.rR)+' (racine), pas '+fx(th.P)+' mm. Noyau exact requis.');
    }
  }else pNote('Filet gaz (55°) : cosmétique seulement.');
  pBtns([['🎯 Changer la face',function(){threadPickStart(f.id);}]]);
}
