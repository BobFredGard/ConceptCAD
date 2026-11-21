/* ---------- Facettes de la nouvelle pièce préparées pendant le recalcul de fond (V0.99.54) ----------
   Demande de Fred : « maximiser les CPU », suite du recalcul de fond (V0.99.52). La pièce recalculée en
   arrière-plan était ensuite maillée d'un bloc par le rejeu final : SIRAP-14-002 (perçage n°10 modifié),
   1,5 s de maillage d'affichage et 0,8 s de maillage d'outillage FAO, écran figé.
   Ici, dès que le rejeu de préchauffe a fini (31-regen-progression, fondTache), ses faces neuves (empreinte
   absente des facettes gardées, 20-25) sont maillées par paquets, entre deux peintures, l'ancienne pièce
   toujours affichée : à la finesse d'affichage et, s'il y a de la FAO, à celle de l'outillage. Le noyau
   multicœur maille les faces d'un paquet en parallèle (20-20, occMeshParallele). Chaque face est COPIÉE
   sans maillage avant d'être maillée : le solide de préchauffe partage ses faces avec les points de
   contrôle, qui ne doivent jamais perdre ni gagner de triangles ici. Le résultat est rangé comme le fait
   occTriPosFaces (mêmes clés finesse|empreinte, triangles, normales, triangulation et polygones d'arêtes à
   greffer). Le rejeu final trouve alors chaque face déjà faite : il greffe au lieu de mailler.
   Pas d'aller-retour par un worker : un solide relu en BRep binaire ne se maille pas au bit près comme
   l'original (dernière décimale des normales, quelques nœuds), et la FAO garde ses parcours d'après
   l'empreinte de ce maillage. Ici tout est identique au bit près (tests/browser/recalcul-fond.spec).
   ?sansfondmaillage : comme V0.99.53. */
const FOND_MAILLAGE_MIN=24;    // faces neuves : en dessous, le rejeu final les maille sans qu'on le voie
const FOND_MAILLAGE_PAQUET=24; // faces maillées d'un coup (une tranche du fond en fait plusieurs)
let fondMaillageOff=false;
try{fondMaillageOff=/[?&]sansfondmaillage\b/.test(String(location.search||''));}catch(e){}
let fondMaillageDernier=null; // mesure du dernier passage (fondInfo)
function fondMaillagePossible(){
  try{return !fondMaillageOff&&!freshHard&&occFaceMemoDispo();}catch(e){return false;}
}
function fondMaillageFao(){
  // outillage FAO à préparer aussi : seulement s'il y a des opérations (faoLegacyGeo les lira au buildDone)
  try{const r=typeof faoRoot==='function'?faoRoot():null;return !!(r&&(r.setups||[]).some(s=>(s.ops||[]).length));}
  catch(e){return false;}
}
function fondMaillagePrend(FR){
  // FR : rejeu de préchauffe fini (copie du document), appelé AVANT que ses solides soient libérés.
  // → {corps: poignées gardées (mêmes solides), niv: finesses} ou null
  if(!fondMaillagePossible()||!FR)return null;
  const parts=(FR.perBody||[]).filter(p=>p&&p.shape);
  if(!parts.length)return null;
  let D=null;
  try{D=occDisplayDefl(FR.shape||parts[0].shape);}catch(e){return null;}
  const niv=[{lin:D.lin,ang:D.ang}];
  if(fondMaillageFao()){try{const X=occXDefl();if(X.lin!==D.lin||X.ang!==D.ang)niv.push({lin:X.lin,ang:X.ang});}catch(e){}}
  const corps=[];
  for(const p of parts){
    // nouvelle poignée sur le même solide : survit à occCleanup(FR)
    try{const h=p.shape.Oriented(p.shape.Orientation_1());if(h&&!h.IsNull())corps.push(h);else if(h)h.delete();}catch(e){}
  }
  return corps.length?{corps,niv,t0:performance.now()}:null;
}
function fondFaceNue(f){
  // copie de la face sans aucun maillage (géométrie copiée telle quelle)
  let c=null;
  try{c=new occt.BRepBuilderAPI_Copy_2(f,true,false);const s=c.Shape();return occt.TopoDS.Face_1(s);}
  catch(e){return null;}finally{try{c&&c.delete();}catch(e){}}
}
function* fondMaillageFait(job){
  // faces neuves maillées par paquets et rangées dans occFaceMemo
  const E=occt.TopAbs_ShapeEnum;
  let F=[],vus=0,ranges=0,neuves=0,pas=0;
  const st={faces:0};
  try{
    // 1. empreintes des faces (une fois pour toutes les finesses)
    const L=[];
    for(const sh of job.corps){
      const ex=new occt.TopExp_Explorer_2(sh,E.TopAbs_FACE,E.TopAbs_SHAPE);
      try{while(ex.More()){F.push(occFaceCur(ex));ex.Next();}}finally{try{ex.delete();}catch(e){}}
    }
    const K=new Array(F.length);
    for(let i=0;i<F.length;i++){
      K[i]=occFaceEmpreinte(F[i]);
      if(++pas%40===0)yield {};
    }
    st.faces=F.length;
    for(const N of job.niv){
      const pre=N.lin+'|'+N.ang+'|';
      // faces à faire : empreinte lisible, absente, une seule fois par empreinte
      const vu=new Set(),manque=[];
      for(let i=0;i<F.length;i++){
        if(K[i]===null)continue;
        const k=pre+K[i];
        if(vu.has(k)||occFaceMemo.has(k))continue;
        vu.add(k);manque.push(i);
      }
      vus+=F.length;neuves+=manque.length;
      if(manque.length<FOND_MAILLAGE_MIN)continue;
      for(let a=0;a<manque.length;a+=FOND_MAILLAGE_PAQUET){
        const lot=manque.slice(a,a+FOND_MAILLAGE_PAQUET),nues=[];
        let C=null,bld=null;
        try{
          bld=new occt.BRep_Builder();C=new occt.TopoDS_Compound();bld.MakeCompound(C);
          for(const i of lot){const n=fondFaceNue(F[i]);nues.push(n);if(n)bld.Add(C,n);}
          const T=occTriPos(C,N.lin,N.ang,true); // même code que occTriPosFaces pour ses faces manquantes
          const parOrd=new Map();T.groups.forEach(g=>parOrd.set(g.f,g));
          let o=0;
          lot.forEach((i,j)=>{
            const n=nues[j];if(!n)return;
            const g=parOrd.get(o++);
            const k=pre+K[i];
            if(occFaceMemo.has(k))return;
            const e={p:g?Float64Array.from(T.pos.slice(g.start*9,(g.start+g.count)*9)):new Float64Array(0),
                     n:g?Float64Array.from(T.nrm.slice(g.start*9,(g.start+g.count)*9)):new Float64Array(0),
                     tri:null,polys:null,g:occFaceMemoGen};
            const h=occFacePrise(n);
            if(h){e.tri=h.tri;e.polys=h.polys;}
            else if(e.p.length)return; // maillée mais non greffable : pas gardée (comme occTriPosFaces)
            occFaceMemo.set(k,e);ranges++;
          });
        }catch(e){}
        finally{
          nues.forEach(n=>{try{n&&n.delete();}catch(e){}});
          try{C&&C.delete();}catch(e){}try{bld&&bld.delete();}catch(e){}
        }
        yield {};
      }
    }
  }finally{
    F.forEach(f=>{try{f.delete();}catch(e){}});
    job.corps.forEach(h=>{try{h.delete();}catch(e){}});
    fondMaillageDernier={faces:st.faces,neuves,rangees:ranges,niveaux:job.niv.length,ms:Math.round(performance.now()-job.t0)};
  }
}
