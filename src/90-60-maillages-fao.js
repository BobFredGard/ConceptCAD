const FAO_FINE_DEFL={lin:0.01,ang:0.1};
function faoFineGeo(b){
  try{
    let shape=null,holder=null;
    if(b&&b.kind==='import'){const e=importGeom.get(b.id);if(e&&e.brep){shape=e.brep;holder=e;}}
    else if(b&&b.kind==='body'&&b.shape){shape=b.shape;holder=b;}
    if(!shape)return null;
    if(holder._faoGeoFine)return holder._faoGeoFine;
    let g=null;
    try{occt.BRepTools.Clean(shape);}catch(e){}
    try{g=occTessellate(shape,FAO_FINE_DEFL.lin,FAO_FINE_DEFL.ang);}catch(e){g=null;}
    // le solide garde sa triangulation fine : on l'efface (les autres
    // lectures — outillage, affichage — retessellent à LEUR définition)
    try{occt.BRepTools.Clean(shape);}catch(e){}
    if(!g)return null;
    holder._faoGeoFine=g;
    return g;
  }catch(e){return null;}
}
// 2026-10-22-009 : maillage INTERMÉDIAIRE (ébauche 3D, contour profil) — le
// maillage d'outillage d'un import STEP est à 0,5 mm / 0,5 rad : autant que la
// surépaisseur courante (« J'espère que tu prends bien en compte les vraies
// faces du modèle exact »). 0,05 mm / 0,2 rad : écart à la surface exacte
// 10 fois plus petit, triangles raisonnables pour le moteur d'ébauche.
const FAO_MID_DEFL={lin:0.05,ang:0.2};
function faoMidGeo(b){
  try{
    let shape=null,holder=null;
    if(b&&b.kind==='import'){const e=importGeom.get(b.id);if(e&&e.brep){shape=e.brep;holder=e;}}
    else if(b&&b.kind==='body'&&b.shape){shape=b.shape;holder=b;}
    if(!shape)return null;
    if(holder._faoGeoMid)return holder._faoGeoMid;
    let g=null;
    try{occt.BRepTools.Clean(shape);}catch(e){}
    try{g=occTessellate(shape,FAO_MID_DEFL.lin,FAO_MID_DEFL.ang);}catch(e){g=null;}
    try{occt.BRepTools.Clean(shape);}catch(e){}
    if(!g)return null;
    holder._faoGeoMid=g;
    return g;
  }catch(e){return null;}
}
function faoMeshFromBodyMid(b){
  try{
    const g=faoMidGeo(b);
    if(g&&_faoMeshFromBodyOrig)return _faoMeshFromBodyOrig({mesh:{geometry:g,matrixWorld:b.mesh&&b.mesh.matrixWorld}},600000);
  }catch(e){}
  return null;
}
function faoMeshFromBodyFine(b){
  try{
    const g=faoFineGeo(b);
    if(g&&_faoMeshFromBodyOrig)return _faoMeshFromBodyOrig({mesh:{geometry:g,matrixWorld:b.mesh&&b.mesh.matrixWorld}},600000);
  }catch(e){}
  return null;
}
