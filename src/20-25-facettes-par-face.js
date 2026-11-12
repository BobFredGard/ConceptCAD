/* ---------- Facettes d'affichage gardées FACE PAR FACE (V0.96.1) ----------
   Après chaque modification, toute la pièce était remaillée puis relue triangle par triangle,
   même quand seules quelques faces avaient changé (plaque SIRAP-14-003, modification de la
   profondeur d'un perçage : calcul du solide 0,03 s, maillage et lecture 1,1 s).
   Ici, chaque face a une EMPREINTE tirée de sa géométrie exacte (surface, bornes, tolérance, et
   pour chaque arête du contour : sens, paramètres et 4 points). Même empreinte et même finesse :
   • ses triangles et normales, déjà lus, sont repris tels quels pour l'affichage ;
   • sa triangulation du noyau (et les polygones de ses arêtes) est GREFFÉE sur la face du solide
     neuf : le mailleur du noyau, lancé ensuite comme avant sur le solide entier, la trouve à jour
     et ne maille que les faces neuves ou modifiées.
   Le solide ressort donc ENTIÈREMENT maillé, avec les mêmes triangulations qu'un maillage complet :
   tout ce qui les relit ensuite (FAO, boîte du solide, pièce gardée sur le poste) voit la même
   chose qu'avant. Vérifié au bit près par tests/test_facettes_par_face.cjs : triangles, normales,
   groupes, boîte, relecture à une autre finesse ; et chaque face maillée seule = la même face
   maillée avec toute la pièce (1 036 faces de 3 pièces), ce qui fonde la reprise.
   Jamais gardée ni greffée : une face déjà maillée à l'arrivée (triangulation venue d'ailleurs, le
   mailleur décide seul comme avant), une face déplacée par une position (Location), une face
   illisible. Hors cadre → ancien chemin inchangé : rafraîchissement dur, budget de triangles
   dépassé, noyau sans les fonctions voulues, ?sansfacettes dans l'adresse. */
let occFaceMemo=new Map(); // finesse|empreinte → {p,n (Float64Array, 9 nombres par triangle), tri, polys, g}
let occFaceMemoGen=0;
let occFaceMemoOff=(()=>{try{return /[?&]sansfacettes\b/.test(location.search);}catch(e){return false;}})();
const occFaceMemoStat={appels:0,faces:0,reprises:0,maillees:0,replis:0};
// empreintes des faces du dernier solide lu par occTriPosFaces (objet du solide → liste, dans l'ordre des
// faces) : le classement des arêtes, qui suit aussitôt sur le même solide, ne les recalcule pas
const occEmpDeSolide=new WeakMap();
function occFaceMemoLibere(e){
  // les poignées du noyau gardées par une entrée (triangulation, polygones d'arêtes)
  try{if(e.tri)e.tri.delete();}catch(er){}
  if(e.polys)for(const q of e.polys){if(!q)continue;try{q.a&&q.a.delete();}catch(er){}try{q.b&&q.b.delete();}catch(er){}}
  e.tri=null;e.polys=null;
}
function occFaceMemoClear(){
  for(const e of occFaceMemo.values())occFaceMemoLibere(e);
  occFaceMemo=new Map();
  try{occAreteMemoClear();}catch(e){}
}
function occFaceMemoPurge(){
  // garde ce qui a servi aux 3 derniers affichages (annuler / rétablir, aller-retour d'une valeur)
  occFaceMemoGen++;
  for(const [k,e] of occFaceMemo)if(e.g<occFaceMemoGen-3){occFaceMemoLibere(e);occFaceMemo.delete(k);}
  try{occAreteMemoPurge();}catch(e){}
}
function occFaceEmpreinte(f){
  // null : face illisible → jamais gardée (remaillée à chaque fois)
  const E=occt.TopAbs_ShapeEnum,parts=[];
  let ad=null,ee=null;
  try{
    parts.push(f.Orientation_1().value);
    ad=new occt.BRepAdaptor_Surface_2(f,true);
    const u0=ad.FirstUParameter(),u1=ad.LastUParameter(),v0=ad.FirstVParameter(),v1=ad.LastVParameter();
    parts.push(ad.GetType().value,u0,u1,v0,v1,occt.BRep_Tool.Tolerance_1(f));
    for(let q=0;q<2;q++){
      const p=ad.Value(u0+(u1-u0)*(q?0.23:0.5),v0+(v1-v0)*(q?0.71:0.5));
      try{parts.push(p.X(),p.Y(),p.Z());}finally{p.delete();}
    }
    ee=new occt.TopExp_Explorer_2(f,E.TopAbs_EDGE,E.TopAbs_SHAPE);
    while(ee.More()){
      const e=occEdgeCur(ee);let c=null;
      try{
        parts.push(e.Orientation_1().value);
        let ok=false;
        try{
          c=new occt.BRepAdaptor_Curve_2(e);
          const a=c.FirstParameter(),b=c.LastParameter();parts.push(a,b);
          for(let q=0;q<4;q++){
            const p=c.Value(a+(b-a)*(q===0?0:q===1?0.31:q===2?0.5:1));
            try{parts.push(p.X(),p.Y(),p.Z());}finally{p.delete();}
          }
          ok=true;
        }catch(er){}
        if(!ok)parts.push('d'); // arête dégénérée (pointe de cône) : pas de courbe
      }finally{try{c&&c.delete();}catch(er){}try{e.delete();}catch(er){}}
      ee.Next();
    }
    for(let i=0;i<parts.length;i++)if(typeof parts[i]==='number'&&parts[i]!==parts[i])return null; // NaN : illisible
    return parts.join(';');
  }catch(e){return null;}
  finally{try{ad&&ad.delete();}catch(e){}try{ee&&ee.delete();}catch(e){}}
}
function occFaceMemoDispo(){
  if(occFaceMemoOff)return false;
  if(occFaceMemoDispo.ok===undefined){
    let b=null;
    try{b=new occt.BRep_Builder();
      occFaceMemoDispo.ok=typeof b.UpdateFace==='function'&&typeof b.UpdateEdge==='function'
        &&typeof occt.BRep_Tool.PolygonOnTriangulation==='function'&&typeof occt.BRep_Tool.IsClosed==='function'
        &&typeof occt.BRep_Tool.Triangulation==='function'&&typeof occt.TopoDS_Compound==='function'&&typeof occt.BRepTools.Clean==='function';}
    catch(e){occFaceMemoDispo.ok=false;}
    finally{try{b&&b.delete();}catch(e){}}
  }
  return occFaceMemoDispo.ok;
}
function occFaceAretes(f){
  // arêtes du contour, dans l'ordre du noyau (à libérer par l'appelant)
  const E=occt.TopAbs_ShapeEnum,L=[],ee=new occt.TopExp_Explorer_2(f,E.TopAbs_EDGE,E.TopAbs_SHAPE);
  try{while(ee.More()){L.push(occEdgeCur(ee));ee.Next();}}finally{try{ee.delete();}catch(e){}}
  return L;
}
function occFaceMaillee(f){
  let loc=null,h=null;
  try{loc=new occt.TopLoc_Location_1();h=occt.BRep_Tool.Triangulation(f,loc);return !!(h&&!h.IsNull());}
  catch(e){return true;} // dans le doute : comme déjà maillée (ni gardée ni greffée)
  finally{try{h&&h.delete();}catch(e){}try{loc&&loc.delete();}catch(e){}}
}
function occFacePrise(f){
  // Poignées du noyau d'une face que le mailleur vient de mailler : {tri, polys} ou null (face à position,
  // sans triangulation, lecture impossible : pas de greffe pour elle).
  let loc=null,hT=null,polys=null,AR=null,ok=false;
  try{
    loc=new occt.TopLoc_Location_1();hT=occt.BRep_Tool.Triangulation(f,loc);
    if(!hT||hT.IsNull()||!loc.IsIdentity())return null;
    AR=occFaceAretes(f);polys=[];
    for(const e of AR){
      let q=null;
      const h=occt.BRep_Tool.PolygonOnTriangulation(e,hT,loc);
      if(h&&!h.IsNull()){
        q={a:h,b:null};
        if(occt.BRep_Tool.IsClosed(e,f)){ // couture : deux polygones, un par sens
          const r=e.Reversed();let er=null,h2=null;
          try{er=occt.TopoDS.Edge_1(r);h2=occt.BRep_Tool.PolygonOnTriangulation(er,hT,loc);}
          finally{try{er&&er.delete();}catch(x){}try{r.delete();}catch(x){}}
          if(!h2||h2.IsNull()){try{h2&&h2.delete();}catch(x){}polys.push(q);throw new Error('couture sans second polygone');}
          if(e.Orientation_1()===occt.TopAbs_Orientation.TopAbs_FORWARD)q.b=h2;else{q.b=q.a;q.a=h2;}
        }
      }else{try{h&&h.delete();}catch(x){}}
      polys.push(q);
    }
    ok=true;
    return {tri:hT,polys};
  }catch(e){return null;}
  finally{
    if(!ok){try{hT&&hT.delete();}catch(e){}if(polys)for(const q of polys){if(!q)continue;try{q.a&&q.a.delete();}catch(e){}try{q.b&&q.b.delete();}catch(e){}}}
    if(AR)AR.forEach(e=>{try{e.delete();}catch(x){}});
    try{loc&&loc.delete();}catch(e){}
  }
}
function occFaceGreffe(f,ent,bld,locId){
  // Pose sur la face f (sans triangulation) celle gardée dans ent. false : rien n'a été touché.
  // Une exception après le premier appel au noyau remonte : l'appelant abandonne la voie.
  if(!ent.tri||!ent.polys)return false;
  const AR=occFaceAretes(f);
  try{
    if(AR.length!==ent.polys.length)return false;
    bld.UpdateFace(f,ent.tri);
    for(let j=0;j<AR.length;j++){
      const q=ent.polys[j];if(!q)continue;
      if(q.b)bld.UpdateEdge(AR[j],q.a,q.b,ent.tri,locId);
      else bld.UpdateEdge(AR[j],q.a,ent.tri,locId);
    }
    return true;
  }finally{AR.forEach(e=>{try{e.delete();}catch(x){}});}
}
function occFaceMemoNettoie(sh){try{occt.BRepTools.Clean(sh,true);}catch(e){try{occt.BRepTools.Clean(sh);}catch(e2){}}}
function occTriPosFaces(shape,defl,ang){
  // Même rendu que occTriPos(shape,defl,ang,true) — {pos,nrm,groups} — et même état du solide à la
  // sortie : entièrement maillé. Rend null si la voie ne s'applique pas (l'appelant prend l'ancien chemin).
  if(!occFaceMemoDispo())return null;
  const E=occt.TopAbs_ShapeEnum,F=[];
  let C=null,bld=null,locId=null,touche=false;
  try{
    const ex=new occt.TopExp_Explorer_2(shape,E.TopAbs_FACE,E.TopAbs_SHAPE);
    try{while(ex.More()){F.push(occFaceCur(ex));ex.Next();}}finally{try{ex.delete();}catch(e){}}
    const nf=F.length;if(!nf)return null;
    const pre=defl+'|'+ang+'|',K=new Array(nf),ent=new Array(nf),manque=[],neuve=new Array(nf),brutes=new Array(nf);
    try{occEmpDeSolide.set(shape,brutes);}catch(e){}
    bld=new occt.BRep_Builder();locId=new occt.TopLoc_Location_1();
    for(let i=0;i<nf;i++){
      const k=occFaceEmpreinte(F[i]);brutes[i]=k;K[i]=k===null?null:pre+k;
      neuve[i]=!occFaceMaillee(F[i]); // déjà maillée à l'arrivée : le mailleur décide, rien n'est gardé
      const e=(K[i]!==null&&neuve[i])?occFaceMemo.get(K[i]):null;
      if(e&&(e.tri?(touche=true,occFaceGreffe(F[i],e,bld,locId)):e.p.length===0)){e.g=occFaceMemoGen;ent[i]=e;}
      else manque.push(i);
    }
    occFaceMemoStat.appels++;occFaceMemoStat.faces+=nf;occFaceMemoStat.reprises+=nf-manque.length;occFaceMemoStat.maillees+=manque.length;
    if(manque.length){
      const tout=manque.length===nf;
      let cible=shape;
      if(!tout){C=new occt.TopoDS_Compound();bld.MakeCompound(C);manque.forEach(i=>bld.Add(C,F[i]));cible=C;}
      touche=true;
      const T=occTriPos(cible,defl,ang,true); // maille (les seules faces manquantes) et lit
      const parOrd=new Map();T.groups.forEach(g=>parOrd.set(g.f,g));
      manque.forEach((i,o)=>{
        const g=parOrd.get(tout?i:o);
        const e={p:g?Float64Array.from(T.pos.slice(g.start*9,(g.start+g.count)*9)):new Float64Array(0),
                 n:g?Float64Array.from(T.nrm.slice(g.start*9,(g.start+g.count)*9)):new Float64Array(0),
                 tri:null,polys:null,g:occFaceMemoGen};
        ent[i]=e;
        if(K[i]===null||!neuve[i])return;
        const h=occFacePrise(F[i]);
        if(h){e.tri=h.tri;e.polys=h.polys;}
        else if(e.p.length)return; // maillée mais non greffable : pas gardée
        const vieux=occFaceMemo.get(K[i]);if(vieux)occFaceMemoLibere(vieux);
        occFaceMemo.set(K[i],e);
      });
    }
    // assemblage dans l'ordre des faces
    let nt=0;for(let i=0;i<nf;i++)nt+=ent[i].p.length;
    const pos=new Float64Array(nt),nrm=new Float64Array(nt),groups=[];
    let o=0;
    for(let i=0;i<nf;i++){
      const e=ent[i],l=e.p.length;if(!l)continue;
      pos.set(e.p,o);nrm.set(e.n,o);groups.push({f:i,start:o/9,count:l/9});o+=l;
    }
    return {pos,nrm,groups};
  }catch(e){
    // greffe ou lecture interrompue : on retire tout ce qui a pu être posé, l'ancien chemin remaille
    occFaceMemoStat.replis++;
    if(touche)occFaceMemoNettoie(shape);
    return null;
  }finally{
    F.forEach(f=>{try{f.delete();}catch(e){}});
    try{C&&C.delete();}catch(e){}try{bld&&bld.delete();}catch(e){}try{locId&&locId.delete();}catch(e){}
  }
}
function occTessellateFaces(shape,D,maxTris){
  // Géométrie d'affichage d'un corps par les facettes gardées. null → ancien chemin
  // (occTessellateBudget), notamment si le budget de triangles est dépassé : il décide seul
  // de la finesse dégradée, comme avant.
  if(freshHard)return null;
  const T=occTriPosFaces(shape,D.lin,D.ang);
  if(!T)return null;
  if(maxTris&&T.pos.length/9>maxTris)return null;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(T.pos,3));
  try{g.setAttribute('normal',new THREE.Float32BufferAttribute(occTriNormals(T),3));}
  catch(e){g.computeVertexNormals();}
  g.userData.occGroups=T.groups;
  return g;
}

/* ---------- Arêtes classées gardées ARÊTE PAR ARÊTE (V0.96.1) ----------
   Même principe pour le tracé des arêtes (vives noires, tangentes grises) : occSharpEdges
   rééchantillonnait et reclassait toutes les arêtes de la pièce à chaque modification (plaque
   SIRAP-14-003 : 0,24 s). Ici :
   • par face (même empreinte) : la liste de ses arêtes, déjà échantillonnées, est reprise ;
   • par arête : sa fiche est reprise quand rien de ce qui la décide n'a changé — l'arête
     elle-même, toutes ses faces voisines (empreintes), les plans de scission, ET le drapeau de
     continuité du noyau, relu à chaque fois sur le solide courant (il tient à l'histoire du
     solide, pas seulement à sa géométrie).
   Les arêtes neuves ou touchées passent par occAreteClasse, le même code que le classement complet.
   Même liste, même ordre, mêmes fiches que occSharpEdgesPlein (tests/test_facettes_par_face.cjs).
   null → l'appelant fait le classement complet (face illisible, noyau sans les fonctions voulues). */
let occAreteMemo=new Map();    // clé d'arête → {E: fiche sans fs | null (couture), ct, g}
let occFaceUsesMemo=new Map(); // empreinte de face → {u:[clé d'arête ou null, par arête du contour], cyl, g}
let occEmpIds=new Map(),occEmpIdN=0; // empreinte → {id, g} : numéro court, jamais réattribué
const occAreteMemoStat={appels:0,aretes:0,reprises:0,classees:0};
function occAreteMemoClear(){occAreteMemo=new Map();occFaceUsesMemo=new Map();occEmpIds=new Map();}
function occAreteMemoPurge(){
  const lim=occFaceMemoGen-3;
  for(const [k,e] of occAreteMemo)if(e.g<lim)occAreteMemo.delete(k);
  for(const [k,e] of occFaceUsesMemo)if(e.g<lim)occFaceUsesMemo.delete(k);
  for(const [k,e] of occEmpIds)if(e.g<lim)occEmpIds.delete(k);
}
function occSharpEdgesMemo(shape){
  if(freshHard||!occFaceMemoDispo())return null;
  const out=[],bin=[];
  const cuts=splitCutPlanes(),cutsSig=cuts.length?JSON.stringify(cuts):'';
  const onCut=pts=>cuts.some(P=>pts.every(q=>Math.abs((q[0]-P.o[0])*P.n[0]+(q[1]-P.o[1])*P.n[1]+(q[2]-P.o[2])*P.n[2])<1e-3));
  try{
    const SH=occt.TopAbs_ShapeEnum.TopAbs_SHAPE,ED=occt.TopAbs_ShapeEnum.TopAbs_EDGE,NP=12,G=occFaceMemoGen;
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
    const nf=faces.length,ID=new Array(nf),U=new Array(nf),cyl=new Array(nf),AR=new Array(nf);
    // empreintes déjà calculées par le maillage de ce même solide (ou des corps qui composent occLive) ;
    // contrôlées sur la première et la dernière face de chaque corps, recalculées au moindre doute
    let dej=null;
    try{
      const debuts=[0];
      dej=occEmpDeSolide.get(shape)||null;
      if(!dej&&occLive&&shape===occLive.shape){
        const L=[];let ok=true;
        for(const b of bodies){if(!b||b.kind!=='body'||b.ghost||!b.shape)continue;const q=occEmpDeSolide.get(b.shape);if(!q){ok=false;break;}L.push(q);}
        if(ok&&L.length){dej=[];L.forEach(q=>{debuts.push(dej.length+q.length);for(let i=0;i<q.length;i++)dej.push(q[i]);});}
      }
      if(dej&&dej.length!==nf)dej=null;
      if(dej){
        const voir=new Set([nf-1]);debuts.forEach(d=>{if(d<nf)voir.add(d);if(d>0)voir.add(d-1);});
        for(const i of voir)if(dej[i]!==occFaceEmpreinte(faces[i])){dej=null;break;}
      }
    }catch(err){dej=null;}
    const aretes=fi=>{ // arêtes du contour de la face, dans l'ordre du noyau (une fois par face)
      if(AR[fi])return AR[fi];
      const L=[],ee=new occt.TopExp_Explorer_2(faces[fi],ED,SH);bin.push(ee);
      while(ee.More()){const e=occEdgeCur(ee);bin.push(e);L.push(e);ee.Next();}
      return AR[fi]=L;
    };
    for(let fi=0;fi<nf;fi++){
      const k=dej?dej[fi]:occFaceEmpreinte(faces[fi]);
      if(k===null||k===undefined){occDispose(bin);return null;}
      let d=occEmpIds.get(k);if(!d){d={id:++occEmpIdN,g:G};occEmpIds.set(k,d);}else d.g=G;
      ID[fi]=d.id;
      let m=occFaceUsesMemo.get(k);
      if(m){m.g=G;}
      else{
        // comme la 1re passe du classement complet : clé de chaque arête du contour, cylindre de la face
        const u=[];
        aretes(fi).forEach(e=>{
          let kk=null;
          try{
            const ad=new occt.BRepAdaptor_Curve_2(e);bin.push(ad);
            if(ad.LastParameter()>ad.FirstParameter()){
              const mp=ad.Value((ad.FirstParameter()+ad.LastParameter())/2);bin.push(mp);
              const s=sample(ad);
              if(s.len>1e-6)kk=ekey([mp.X(),mp.Y(),mp.Z()],s.len);
            }
          }catch(err){kk=null;}
          u.push(kk);
        });
        let c=null;
        try{const ad=new occt.BRepAdaptor_Surface_2(faces[fi],true);bin.push(ad);
          if(ad.GetType()===occt.GeomAbs_SurfaceType.GeomAbs_Cylinder){
            const C=ad.Cylinder(),A=C.Axis();
            try{c={r:C.Radius(),d:occXyz(A.Direction()),o:occXyz(A.Location())};}finally{occFree(A);occFree(C);}
          }
        }catch(err){c=null;}
        m={u,cyl:c,g:G};occFaceUsesMemo.set(k,m);
      }
      U[fi]=m.u;cyl[fi]=m.cyl;
    }
    const fmap=new Map(),seam=new Set();
    for(let fi=0;fi<nf;fi++){const u=U[fi];
      for(let j=0;j<u.length;j++){const k=u[j];if(k===null)continue;
        let l=fmap.get(k);if(!l){l=[];fmap.set(k,l);}
        if(!l.includes(fi))l.push(fi);else seam.add(k); // 2e passage dans la même face
      }
    }
    const sameCyl=fl=>{
      if(fl.length!==2)return false;const a=cyl[fl[0]],b=cyl[fl[1]];if(!a||!b)return false;
      if(Math.abs(a.r-b.r)>1e-6)return false;
      const c=a.d[0]*b.d[0]+a.d[1]*b.d[1]+a.d[2]*b.d[2];if(Math.abs(Math.abs(c)-1)>1e-9)return false;
      const w=[b.o[0]-a.o[0],b.o[1]-a.o[1],b.o[2]-a.o[2]],t=w[0]*a.d[0]+w[1]*a.d[1]+w[2]*a.d[2];
      return Math.hypot(w[0]-t*a.d[0],w[1]-t*a.d[1],w[2]-t*a.d[2])<1e-6; // même axe
    };
    const X={faces,cuts,onCut,seam,sameCyl},seen=new Set();
    occAreteMemoStat.appels++;
    for(let fi=0;fi<nf;fi++){const u=U[fi];
      for(let j=0;j<u.length;j++){
        const kk=u[j];if(kk===null||seen.has(kk))continue;
        seen.add(kk);
        const fl=fmap.get(kk)||[];
        const e=aretes(fi)[j];
        if(!e){occDispose(bin);return null;} // contour différent de celui gardé : ne devrait pas arriver
        // drapeau de continuité du noyau, relu sur le solide courant
        let ct=null;
        if(fl.length>=2){try{ct=occt.BRep_Tool.Continuity_1(e,faces[fl[0]],faces[fl[1]]).value;}catch(err){ct='x';}}
        const cle=ID[fi]+'#'+j+'|'+fl.map(i=>ID[i]).join(',')+'|'+cutsSig;
        occAreteMemoStat.aretes++;
        let m=occAreteMemo.get(cle);
        if(m&&m.ct===ct){m.g=G;occAreteMemoStat.reprises++;}
        else{
          occAreteMemoStat.classees++;
          let E=null;
          try{
            const ad=new occt.BRepAdaptor_Curve_2(e);bin.push(ad);
            const u0=ad.FirstParameter(),u1=ad.LastParameter();
            if(u1>u0){
              const mp=ad.Value((u0+u1)/2);bin.push(mp);
              const mid=[mp.X(),mp.Y(),mp.Z()];
              const s=sample(ad);
              if(s.len>1e-6)E=occAreteClasse(e,ad,u0,u1,mid,s,kk,fl,X,bin);
            }
          }catch(err){E=null;}
          if(E)delete E.fs;
          m={E,ct,g:G};occAreteMemo.set(cle,m);
        }
        if(m.E){const E=Object.assign({},m.E);if(fl.length)E.fs=fl.slice();out.push(E);}
      }
    }
  }catch(e){occDispose(bin);return null;}
  occDispose(bin);
  return out;
}
