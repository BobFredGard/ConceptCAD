#include <BRepMesh_IncrementalMesh.hxx>
#include "vue3d.h"
#include <AIS_InteractiveObject.hxx>
#include <AIS_Point.hxx>
#include <AIS_TextLabel.hxx>
#include <Geom_CartesianPoint.hxx>
#include <Prs3d_TextAspect.hxx>
#include <Graphic3d_AspectText3d.hxx>
#include <TCollection_ExtendedString.hxx>
#include <Graphic3d_ArrayOfPoints.hxx>
#include <Graphic3d_ArrayOfPolylines.hxx>
#include <Graphic3d_ArrayOfSegments.hxx>
#include <Graphic3d_ArrayOfTriangles.hxx>
#include <Graphic3d_AspectFillArea3d.hxx>
#include <Graphic3d_AspectMarker3d.hxx>
#include <Graphic3d_AspectLine3d.hxx>
#include <Graphic3d_Group.hxx>
#include <Prs3d_Presentation.hxx>
#include <SelectMgr_Selection.hxx>
#include <StdSelect_ViewerSelector3d.hxx>
#include <BRepBuilderAPI_MakeEdge.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakePolygon.hxx>
#include <BRepPrimAPI_MakeCone.hxx>
#include <BRepPrimAPI_MakeSphere.hxx>
#include <BRepBuilderAPI_Transform.hxx>
#include <gp_Circ.hxx>
#include <gp_Ax3.hxx>
#include <Prs3d_LineAspect.hxx>

#include <wx/dcclient.h>

#include <AIS_ColoredShape.hxx>
#include <BRepBndLib.hxx>
#include <BRep_Builder.hxx>
#include <Bnd_Box.hxx>
#include <Graphic3d_AspectFillArea3d.hxx>
#include <Graphic3d_Camera.hxx>
#include <Graphic3d_CubeMapSeparate.hxx>
#include <Graphic3d_NameOfMaterial.hxx>
#include <Graphic3d_PBRMaterial.hxx>
#include <Graphic3d_RenderingParams.hxx>
#include <Graphic3d_ShaderObject.hxx>
#include <Graphic3d_ShaderProgram.hxx>
#include <Graphic3d_TransformPers.hxx>
#include <Image_PixMap.hxx>
#include <NCollection_Array1.hxx>
#include <Prs3d_ShadingAspect.hxx>
#include <Graphic3d_ZLayerId.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Compound.hxx>
#include <V3d_AmbientLight.hxx>
#include <V3d_DirectionalLight.hxx>
#include <gp_Ax2.hxx>
#include <gp_Trsf.hxx>

#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>

#include "conges.h"
#include <Prs3d_Drawer.hxx>
#include <Prs3d_LineAspect.hxx>
#include <Quantity_Color.hxx>
#include <TopAbs_ShapeEnum.hxx>
#include <WNT_Window.hxx>
#include <Image_AlienPixMap.hxx>
#include <V3d_ImageDumpOptions.hxx>

namespace {
const double MARGE_VUE = 0.45;  // de l'air autour de la pièce, sinon la perspective à 50° la déforme
const int SEUIL_CLIC = 4;  // pixels : au-delà, le bouton gauche tourne la vue au lieu de sélectionner

Quantity_Color couleur(int r, int v, int b) { return Quantity_Color(r / 255.0, v / 255.0, b / 255.0, Quantity_TOC_sRGB); }

void reglerStyle(const occ::handle<AIS_InteractiveContext>& c, Prs3d_TypeOfHighlight type, const Quantity_Color& teinte) {
  const occ::handle<Prs3d_Drawer>& s = c->HighlightStyle(type);
  s->SetColor(teinte);
  s->SetDisplayMode(1);
  s->SetTransparency(0.25f);
}

// La matière des pièces du navigateur (MeshStandardMaterial : métal 0,35, rugosité 0,4)
Graphic3d_MaterialAspect matierePiece() {
  Graphic3d_MaterialAspect m(Graphic3d_NameOfMaterial_Plastified);
  Graphic3d_PBRMaterial p;
  p.SetMetallic(0.35f);
  p.SetRoughness(0.4f);
  m.SetPBRMaterial(p);
  return m;
}

// Le reflet au sol, avec le calcul du navigateur (floorMesh, src/10-scene-3d.js) : le rayon de l'œil vers le point renversé
// perce le sol ; plus ce point du sol est loin du centre de la pièce, plus le fond reprend le dessus. La lumière est celle de la pièce d'origine.
const char* const REFLET_SOMMET = R"(
THE_SHADER_OUT vec3 vMonde;
THE_SHADER_OUT vec3 vNormale;
void main() {
  vec4 p = occModelWorldMatrix * occVertex;
  vMonde = p.xyz;
  vNormale = (occModelWorldMatrixInverseTranspose * vec4(occNormal, 0.0)).xyz;
  gl_Position = occProjectionMatrix * occWorldViewMatrix * p;
}
)";
const char* const REFLET_PIXEL = R"(
uniform vec3 uCouleur;
uniform vec3 uFond;
uniform vec3 uCentre;
uniform float uRayon;
THE_SHADER_IN vec3 vMonde;
THE_SHADER_IN vec3 vNormale;
void main() {
  vec3 oeil = occWorldViewMatrixInverse[3].xyz;
  float t = (uCentre.z - oeil.z) / (vMonde.z - oeil.z);
  float d = distance(oeil + (vMonde - oeil) * t, uCentre);
  float f = exp(-pow(d / max(uRayon * 1.15, 0.001), 2.0) * 2.0) * 0.85;
  vec3 n = normalize(vNormale);
  n.z = -n.z;
  float ciel = mix(0.2, 0.75, (n.z + 1.0) * 0.5);
  float cle = max(dot(n, normalize(vec3(60.0, -40.0, 120.0))), 0.0);
  // Le navigateur mélange le reflet, en lumière brute, avec la couleur du sol telle qu'elle s'affiche : c'est ce qui le rend sombre
  // La part neutre tient lieu des reflets du studio, que le reflet du navigateur contient aussi ; réglée sur ses couleurs mesurées
  vec3 reflet = min(uCouleur * (ciel + cle), vec3(1.0)) * 0.45 + vec3(0.07);
  vec3 ecran = mix(pow(uFond, vec3(1.0 / 2.2)), reflet, clamp(f, 0.0, 0.85));
  occSetFragColor(vec4(pow(ecran, vec3(2.2)), 1.0));
}
)";

occ::handle<Graphic3d_ShaderProgram> programmeReflet(const Quantity_Color& c, const Quantity_Color& fond, const gp_Pnt& centre, double rayon) {
  occ::handle<Graphic3d_ShaderProgram> p = new Graphic3d_ShaderProgram();
  p->AttachShader(Graphic3d_ShaderObject::CreateFromSource(Graphic3d_TOS_VERTEX, REFLET_SOMMET));
  p->AttachShader(Graphic3d_ShaderObject::CreateFromSource(Graphic3d_TOS_FRAGMENT, REFLET_PIXEL));
  p->PushVariableVec3("uCouleur", NCollection_Vec3<float>(float(c.Red()), float(c.Green()), float(c.Blue())));
  p->PushVariableVec3("uFond", NCollection_Vec3<float>(float(fond.Red()), float(fond.Green()), float(fond.Blue())));
  p->PushVariableVec3("uCentre", NCollection_Vec3<float>(float(centre.X()), float(centre.Y()), float(centre.Z())));
  p->PushVariableFloat("uRayon", float(rayon));
  return p;
}

Quantity_Color couleurFond() { return couleur(0x13, 0x15, 0x19); }  // le fond tel qu'il apparaît dans le navigateur, sol compris

Quantity_Color couleurHex(unsigned c) { return couleur((c >> 16) & 255, (c >> 8) & 255, c & 255); }

// L'environnement « studio » du navigateur (makeStudioEnv, src/10-scene-3d.js) : six dégradés et des boîtes lumineuses, sans aucun fichier
// FORCE_STUDIO : à pleine force, OCCT voile la couleur de blanc bien plus que Three.js
const double FORCE_STUDIO = 0.3;
using Teinte = std::array<int, 3>;
struct Boite { int x, y, l, h; };
occ::handle<Image_PixMap> faceStudio(Teinte haut, Teinte milieu, Teinte bas, std::vector<Boite> boites) {
  const int N = 256;
  std::vector<std::array<double, 3>> img(N * N);
  for (int y = 0; y < N; y++) {
    const double t = (y + 0.5) / N;
    const Teinte& a = t < 0.55 ? haut : milieu;
    const Teinte& b = t < 0.55 ? milieu : bas;
    const double u = t < 0.55 ? t / 0.55 : (t - 0.55) / 0.45;
    for (int x = 0; x < N; x++)
      for (int k = 0; k < 3; k++) img[y * N + x][k] = a[k] + (b[k] - a[k]) * u;
  }
  const auto rect = [&](int x0, int y0, int l, int h, double alpha) {
    for (int y = std::max(0, y0); y < std::min(N, y0 + h); y++)
      for (int x = std::max(0, x0); x < std::min(N, x0 + l); x++)
        for (int k = 0; k < 3; k++) img[y * N + x][k] += (255.0 - img[y * N + x][k]) * alpha;
  };
  for (const Boite& b : boites) {
    rect(b.x, b.y, b.l, b.h, 0.95);
    rect(b.x - 8, b.y - 8, b.l + 16, b.h + 16, 0.25);
  }
  occ::handle<Image_PixMap> im = new Image_PixMap();
  im->SetTopDown(true);
  im->InitTrash(Image_Format_RGB, N, N);
  for (int y = 0; y < N; y++)
    for (int x = 0; x < N; x++) {
      unsigned char* o = im->ChangeRawValue(y, x);
      for (int k = 0; k < 3; k++) o[k] = static_cast<unsigned char>(std::lround(std::min(255.0, img[y * N + x][k] * FORCE_STUDIO)));
    }
  return im;
}

occ::handle<Graphic3d_CubeMap> environnementStudio() {
  const Teinte c1{0x3a, 0x3f, 0x4a}, c2{0x6b, 0x74, 0x84}, c3{0x17, 0x18, 0x1c};
  NCollection_Array1<occ::handle<Image_PixMap>> f(0, 5);
  f(0) = faceStudio(c1, c2, c3, {{60, 60, 136, 60}});
  f(1) = faceStudio(c1, c2, c3, {{60, 110, 136, 60}});
  f(2) = faceStudio({0xf5, 0xf7, 0xfa}, {0xc9, 0xce, 0xd6}, {0x8a, 0x8f, 0x99}, {});
  f(3) = faceStudio({0x10, 0x11, 0x14}, c3, {0x0a, 0x0b, 0x0d}, {});
  f(4) = faceStudio(c1, {0x7a, 0x84, 0x94}, c3, {{30, 70, 60, 110}, {166, 70, 60, 110}});
  f(5) = faceStudio({0x33, 0x36, 0x3d}, {0x5d, 0x66, 0x73}, {0x14, 0x15, 0x18}, {});
  return new Graphic3d_CubeMapSeparate(f);
}
}  // namespace

Vue3D::Vue3D(wxWindow* parent) : wxWindow(parent, 2005, wxDefaultPosition, wxDefaultSize, wxCLIP_CHILDREN | wxFULL_REPAINT_ON_RESIZE | wxWANTS_CHARS) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);  // tout le dessin vient d'OCCT
  connexion_ = new Aspect_DisplayConnection();
  pilote_ = new OpenGl_GraphicDriver(connexion_);
  visu_ = new V3d_Viewer(pilote_);
  // Les lumières du navigateur (buildScene) : sa lumière principale, et son éclairage du ciel rendu par une ambiance et une lumière d'en haut.
  // OCCT n'a pas les mêmes unités : valeurs réglées sur les couleurs mesurées du Drapeau (dessus #20b0fc ici, #10b0fc dans le navigateur).
  occ::handle<V3d_AmbientLight> ambiance = new V3d_AmbientLight();
  ambiance->SetIntensity(2.0f);
  visu_->AddLight(ambiance);
  occ::handle<V3d_DirectionalLight> cle = new V3d_DirectionalLight(gp_Dir(-60, 40, -120));
  cle->SetIntensity(7.5f);
  visu_->AddLight(cle);
  occ::handle<V3d_DirectionalLight> ciel = new V3d_DirectionalLight(gp_Dir(0, 0, -1));
  ciel->SetIntensity(3.0f);
  visu_->AddLight(ciel);
  visu_->SetLightOn();
  vue_ = visu_->CreateView();
  vue_->SetWindow(new WNT_Window(reinterpret_cast<Aspect_Handle>(GetHWND())));
  Graphic3d_RenderingParams& rendu = vue_->ChangeRenderingParams();
  rendu.NbMsaaSamples = 4;  // bords lissés, comme antialias:true ; 8 coûterait 40 Mo de plus sans gain visible
  rendu.PbrEnvPow2Size = 8;  // des reflets doux n'ont pas besoin de plus
  vue_->SetShadingModel(Graphic3d_TypeOfShadingModel_Pbr);
  // Le studio ne sert qu'aux reflets : le fond reste uni
  vue_->SetBackgroundCubeMap(environnementStudio(), true);
  vue_->View()->SetBackgroundType(Graphic3d_TOB_NONE);
  vue_->SetBackgroundColor(couleurFond());
  // Perspective à 50°, le réglage de départ du navigateur
  vue_->Camera()->SetProjectionType(Graphic3d_Camera::Projection_Perspective);
  vue_->Camera()->SetFOVy(50);
  vue_->SetProj(V3d_XposYnegZpos);
  contexte_ = new AIS_InteractiveContext(visu_);
  // Le cube de vue, en haut à droite comme dans le navigateur
  cube_ = new AIS_ViewCube();
  cube_->SetSize(FromDIP(38));
  cube_->SetFontHeight(FromDIP(8));
  cube_->SetDrawAxes(false);
  cube_->SetFitSelected(false);  // le recadrage vient après, avec la marge habituelle
  cube_->SetFont("Arial");
  cube_->SetBoxSideLabel(V3d_Xpos, "DROITE");
  cube_->SetBoxSideLabel(V3d_Xneg, "GAUCHE");
  cube_->SetBoxSideLabel(V3d_Ypos, "ARRIERE");
  cube_->SetBoxSideLabel(V3d_Yneg, "FACE");
  cube_->SetBoxSideLabel(V3d_Zpos, "DESSUS");
  cube_->SetBoxSideLabel(V3d_Zneg, "DESSOUS");
  cube_->SetBoxColor(couleur(0x3a, 0x3c, 0x42));
  cube_->SetTextColor(Quantity_NOC_WHITE);
  // OrthoPers : le cube reste un vrai cube, la perspective de la pièce ne le déforme pas
  cube_->SetTransformPersistence(new Graphic3d_TransformPers(static_cast<Graphic3d_TransModeFlags>(Graphic3d_TMF_TriedronPers | Graphic3d_TMF_OrthoPers), Aspect_TOTP_RIGHT_UPPER, NCollection_Vec2<int>(FromDIP(58), FromDIP(58))));
  cube_->SetZLayer(Graphic3d_ZLayerId_Topmost);
  contexte_->Display(cube_, false);
  contexte_->SetPixelTolerance(4);
  reglerStyle(contexte_, Prs3d_TypeOfHighlight_LocalDynamic, couleur(0x0a, 0x84, 0xff));
  reglerStyle(contexte_, Prs3d_TypeOfHighlight_LocalSelected, couleur(0x30, 0xd1, 0x58));
  reglerStyle(contexte_, Prs3d_TypeOfHighlight_Dynamic, couleur(0x4d, 0xa3, 0xff));
  reglerStyle(contexte_, Prs3d_TypeOfHighlight_Selected, couleur(0x0a, 0x84, 0xff));

  Bind(wxEVT_PAINT, &Vue3D::surPeinture, this);
  Bind(wxEVT_ERASE_BACKGROUND, [](wxEraseEvent&) {});
  Bind(wxEVT_SIZE, &Vue3D::surTaille, this);
  Bind(wxEVT_LEFT_DOWN, &Vue3D::surEnfonce, this);
  Bind(wxEVT_MIDDLE_DOWN, &Vue3D::surEnfonce, this);
  Bind(wxEVT_RIGHT_DOWN, &Vue3D::surEnfonce, this);
  Bind(wxEVT_LEFT_UP, &Vue3D::surRelache, this);
  Bind(wxEVT_MIDDLE_UP, &Vue3D::surRelache, this);
  Bind(wxEVT_RIGHT_UP, &Vue3D::surRelache, this);
  Bind(wxEVT_MOTION, &Vue3D::surMouvement, this);
  Bind(wxEVT_MOUSEWHEEL, &Vue3D::surMolette, this);
  Bind(wxEVT_MOUSE_CAPTURE_LOST, &Vue3D::surPerteSouris, this);
  Bind(wxEVT_LEFT_DCLICK, &Vue3D::surDouble, this);
}

void Vue3D::afficher(const TopoDS_Shape& forme, bool ajusterVue, const std::vector<std::pair<TopoDS_Shape, unsigned>>& teintes, const std::vector<std::pair<TopoDS_Shape, double>>& transparences) {
  const auto oter = [this](occ::handle<AIS_Shape>& a) {
    if (!a.IsNull()) contexte_->Remove(a, false);
    a.Nullify();
  };
  oter(affichee_);
  oter(filetsHelices_);
  oter(filetsAnneaux_);
  oter(aretesVives_);
  oter(aretesLisses_);
  for (occ::handle<AIS_Shape>& r : reflets_) contexte_->Remove(r, false);
  reflets_.clear();
  refletsVus_ = false;
  selectionPrete_ = false;
  formePiece_ = forme;
  teintesPiece_ = teintes;
  if (!forme.IsNull()) {
    const auto debut = std::chrono::steady_clock::now();
    occ::handle<AIS_ColoredShape> piece = new AIS_ColoredShape(forme);
    piece->Attributes()->SetAutoTriangulation(false);  // le maillage vient de mailler()
    piece->SetColor(couleurHex(0x0a84ff));
    for (const auto& [corps, c] : teintes) piece->SetCustomColor(corps, couleurHex(c));
    piece->SetMaterial(matierePiece());
    for (const auto& [corps, t] : transparences) piece->SetCustomTransparency(corps, t);
    affichee_ = piece;
    contexte_->Display(affichee_, AIS_Shaded, -1, false);  // sélection préparée plus tard : un recalcul n'en paie pas le prix

    // Les arêtes du navigateur : vives en noir, raccords tangents en gris, pas de couture
    BRep_Builder bb;
    TopoDS_Compound vives, lisses;
    bb.MakeCompound(vives);
    bb.MakeCompound(lisses);
    // Corps par corps comme le navigateur : entre deux corps qui se touchent, une arête serait prise pour la voisine d'une face de l'autre corps, et le noyau plante
    const auto ajouter = [&](const TopoDS_Shape& corps) {
      for (const AreteVue& a : aretesVisibles(corps)) bb.Add(a.vive ? vives : lisses, a.arete);
    };
    if (teintes.empty()) ajouter(forme);
    else for (const auto& t : teintes) ajouter(t.first);
    const auto traits = [this](const TopoDS_Shape& s, const Quantity_Color& c) {
      occ::handle<AIS_Shape> a = new AIS_Shape(s);
      a->Attributes()->SetAutoTriangulation(false);
      a->SetColor(c);
      a->SetWidth(1.25);  // setPixelRatio(1,25) du navigateur
      contexte_->Display(a, AIS_WireFrame, -1, false);
      return a;
    };
    aretesVives_ = traits(vives, couleur(5, 5, 6));
    aretesLisses_ = traits(lisses, couleur(0x9a, 0x9f, 0xa6));

    // Le reflet au sol : chaque corps renversé sous la pièce, fondu dans le fond, jamais cliquable
    Bnd_Box boite;
    BRepBndLib::Add(forme, boite, true);
    if (!boite.IsVoid()) {
      sol_ = boite.CornerMin().Z();
      gp_Trsf miroir;
      miroir.SetMirror(gp_Ax2(gp_Pnt(0, 0, sol_), gp_Dir(0, 0, 1)));
      const gp_Pnt bas = boite.CornerMin(), haut = boite.CornerMax();
      const gp_Pnt centre((bas.X() + haut.X()) / 2, (bas.Y() + haut.Y()) / 2, sol_);
      const double rayon = bas.Distance(haut) / 2;
      std::vector<std::pair<TopoDS_Shape, unsigned>> liste = teintes;
      if (liste.empty()) liste.push_back({forme, 0x0a84ff});
      for (const auto& [corps, c] : liste) {
        occ::handle<AIS_Shape> r = new AIS_Shape(corps);
        r->Attributes()->SetAutoTriangulation(false);
        r->Attributes()->SetFaceBoundaryDraw(false);
        r->SetColor(couleurHex(c));
        r->Attributes()->ShadingAspect()->Aspect()->SetFaceCulling(Graphic3d_TypeOfBackfacingModel_DoubleSided);
        r->Attributes()->ShadingAspect()->Aspect()->SetShaderProgram(programmeReflet(couleurHex(c), couleurFond(), centre, rayon));
        r->SetLocalTransformation(miroir);
        reflets_.push_back(r);
      }
    }
    msAffichage_ = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - debut).count();
  }
  if (ajusterVue) vue_->FitAll(MARGE_VUE, false);
  else vue_->ZFitAll();
  majReflets();
  vue_->Redraw();
}

// Le reflet n'existe que vu de dessus : comme le navigateur, plus rien quand l'œil passe sous le sol
void Vue3D::majReflets() {
  const bool voir = !reflets_.empty() && vue_->Camera()->Eye().Z() > sol_;
  if (voir == refletsVus_) return;
  refletsVus_ = voir;
  for (occ::handle<AIS_Shape>& r : reflets_) {
    if (voir) contexte_->Display(r, AIS_Shaded, -1, false);
    else contexte_->Erase(r, false);
  }
}

bool Vue3D::directionCamera(std::array<double, 3>& d) const {
  if (vue_.IsNull()) return false;
  const gp_Pnt o = vue_->Camera()->Eye(), c = vue_->Camera()->Center();
  const double x = o.X() - c.X(), y = o.Y() - c.Y(), z = o.Z() - c.Z(), L = std::sqrt(x * x + y * y + z * z);
  if (L < 1e-9) return false;
  d = {x / L, y / L, z / L};
  return true;
}
bool Vue3D::imagePlan(const plan::DemandeImage& d, wxImage& sortie) {
  if (vueImage_.IsNull()) {
    // Un second visualiseur, sans sol, cube ni arêtes : même pilote, mêmes lumières et même matière que la vue 3D
    visuImage_ = new V3d_Viewer(pilote_);
    occ::handle<V3d_AmbientLight> ambiance = new V3d_AmbientLight();
    ambiance->SetIntensity(2.0f);
    visuImage_->AddLight(ambiance);
    occ::handle<V3d_DirectionalLight> cle = new V3d_DirectionalLight(gp_Dir(-60, 40, -120));
    cle->SetIntensity(7.5f);
    visuImage_->AddLight(cle);
    occ::handle<V3d_DirectionalLight> ciel = new V3d_DirectionalLight(gp_Dir(0, 0, -1));
    ciel->SetIntensity(3.0f);
    visuImage_->AddLight(ciel);
    visuImage_->SetLightOn();
    fenetreImage_ = new wxWindow(this, wxID_ANY, wxDefaultPosition, wxSize(64, 64));
    fenetreImage_->Hide();
    vueImage_ = visuImage_->CreateView();
    vueImage_->SetWindow(new WNT_Window(reinterpret_cast<Aspect_Handle>(fenetreImage_->GetHWND())));
    Graphic3d_RenderingParams& rendu = vueImage_->ChangeRenderingParams();
    rendu.NbMsaaSamples = 4;
    rendu.PbrEnvPow2Size = 8;
    vueImage_->SetShadingModel(Graphic3d_TypeOfShadingModel_Pbr);
    vueImage_->SetBackgroundCubeMap(environnementStudio(), true);
    vueImage_->View()->SetBackgroundType(Graphic3d_TOB_NONE);
    vueImage_->SetBackgroundColor(Quantity_NOC_BLACK);
    contexteImage_ = new AIS_InteractiveContext(visuImage_);
  }
  std::vector<occ::handle<AIS_InteractiveObject>> poses;
  for (const plan::DemandeImage::Teinte& c : d.corps) {
    // Construit comme la pièce de la vue 3D : la teinte est la même
    occ::handle<AIS_ColoredShape> a = new AIS_ColoredShape(c.forme);
    a->Attributes()->SetAutoTriangulation(false);
    a->SetColor(couleurHex(0x0a84ff));
    a->SetCustomColor(c.forme, couleurHex(c.couleur));
    a->SetMaterial(matierePiece());
    if (c.opacite < 1) a->SetCustomTransparency(c.forme, 1 - c.opacite);
    contexteImage_->Display(a, AIS_Shaded, -1, false);
    poses.push_back(a);
  }
  {
    // Les filets cosmétiques, comme la 3D : l'hélice en trait plein, l'anneau en tirets
    const auto compose = [&](bool anneau) {
      BRep_Builder bb;
      TopoDS_Compound c;
      bb.MakeCompound(c);
      bool un = false;
      for (const plan::FiletImage& f : d.filets) {
        BRepBuilderAPI_MakePolygon p;
        for (const auto& q : anneau ? f.anneau : f.helice) p.Add(gp_Pnt(q[0], q[1], q[2]));
        if (p.IsDone()) {
          bb.Add(c, p.Wire());
          un = true;
        }
      }
      return std::make_pair(c, un);
    };
    for (const bool anneau : {false, true}) {
      const auto [c, un] = compose(anneau);
      if (!un) continue;
      const Quantity_Color orange = couleur(0xe8, 0x93, 0x0c);
      occ::handle<AIS_Shape> a = new AIS_Shape(c);
      a->Attributes()->SetAutoTriangulation(false);
      a->SetColor(orange);
      if (anneau) a->Attributes()->SetWireAspect(new Prs3d_LineAspect(orange, Aspect_TOL_DASH, 1.0));
      contexteImage_->Display(a, AIS_WireFrame, -1, false);
      poses.push_back(a);
    }
  }
  const occ::handle<Graphic3d_Camera>& cam = vueImage_->Camera();
  const double aspect = (d.r - d.l) / std::max(1e-9, d.b - d.t);
  cam->SetProjectionType(d.persp ? Graphic3d_Camera::Projection_Perspective : Graphic3d_Camera::Projection_Orthographic);
  cam->SetEye(gp_Pnt(d.oeil[0], d.oeil[1], d.oeil[2]));
  cam->SetCenter(gp_Pnt(d.vise[0], d.vise[1], d.vise[2]));
  cam->SetUp(gp_Dir(-d.v[0], -d.v[1], -d.v[2]));
  cam->SetAspect(aspect);
  if (d.persp) cam->SetFOVy(d.fov);
  else cam->SetScale(d.b - d.t);
  vueImage_->ZFitAll();
  V3d_ImageDumpOptions o;
  o.Width = d.W, o.Height = d.H;
  o.BufferType = Graphic3d_BT_RGBA;
  o.ToAdjustAspect = true;
  // Le fond transparent : la même image sur fond noir puis sur fond blanc. Ce qui change d'une à l'autre, c'est le fond qui transparaît.
  Image_AlienPixMap surNoir, surBlanc;
  bool ok = false;
  try {
    o.BufferType = Graphic3d_BT_RGB;
    vueImage_->SetBackgroundColor(Quantity_NOC_BLACK);
    ok = vueImage_->ToPixMap(surNoir, o);
    vueImage_->SetBackgroundColor(Quantity_NOC_WHITE);
    ok = ok && vueImage_->ToPixMap(surBlanc, o);
  } catch (const Standard_Failure&) {
    ok = false;
  }
  for (const occ::handle<AIS_InteractiveObject>& a : poses) contexteImage_->Remove(a, false);
  if (!ok || surNoir.Width() != surBlanc.Width() || surNoir.Height() != surBlanc.Height()) return false;
  wxImage im(static_cast<int>(surNoir.Width()), static_cast<int>(surNoir.Height()), false);
  im.SetAlpha();
  for (int y = 0; y < im.GetHeight(); y++)
    for (int x = 0; x < im.GetWidth(); x++) {
      const Quantity_Color n = surNoir.PixelColor(x, y, false).GetRGB(), b = surBlanc.PixelColor(x, y, false).GetRGB();
      const double a = std::max(0.0, std::min(1.0, 1 - ((b.Red() - n.Red()) + (b.Green() - n.Green()) + (b.Blue() - n.Blue())) / 3));
      const auto oct = [&](double v) { return static_cast<unsigned char>(std::max(0.0, std::min(255.0, std::round((a > 0 ? v / a : 0) * 255)))); };
      im.SetRGB(x, y, oct(n.Red()), oct(n.Green()), oct(n.Blue()));
      im.SetAlpha(x, y, static_cast<unsigned char>(std::round(a * 255)));
    }
  sortie = im;
  return true;
}

bool Vue3D::image(const wxString& chemin) {
  // Le temps d'une image, pour comparer la fluidité d'un réglage à l'autre
  const auto debut = std::chrono::steady_clock::now();
  for (int i = 0; i < 20; i++) {
    vue_->Invalidate();
    vue_->Redraw();
  }
  msImage_ = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - debut).count() / 20;
  return vue_->Dump(chemin.utf8_str());
}

void Vue3D::ajuster() {
  vue_->FitAll(MARGE_VUE, false);
  vue_->Redraw();
}

void Vue3D::vueInitiale() {
  vue_->SetProj(V3d_XposYnegZpos);
  ajuster();
}

void Vue3D::preparerSelection() {
  if (selectionPrete_ || affichee_.IsNull()) return;
  contexte_->Load(affichee_, -1);  // affichée sans sélection : sans ce chargement, activer les modes ne détecte rien
  contexte_->Activate(affichee_, AIS_Shape::SelectionMode(TopAbs_EDGE));
  contexte_->Activate(affichee_, AIS_Shape::SelectionMode(TopAbs_FACE));
  selectionPrete_ = true;
}

void Vue3D::surPeinture(wxPaintEvent&) {
  wxPaintDC dc(this);
  majReflets();
  vue_->Redraw();
}

void Vue3D::surTaille(wxSizeEvent& e) {
  vue_->MustBeResized();
  e.Skip();
}

void Vue3D::surEnfonce(wxMouseEvent& e) {
  SetFocus();
  if (!HasCapture()) CaptureMouse();
  depart_ = precedent_ = e.GetPosition();
  aBouge_ = false;
  ignorerRelache_ = false;
  if (e.LeftDown() && saisirGizmo(e.GetPosition(), e)) return;
  if (!e.RightDown()) vue_->StartRotation(depart_.x, depart_.y);
}

void Vue3D::surRelache(wxMouseEvent& e) {
  if (HasCapture()) ReleaseMouse();
  if (gizmoSaisi_ >= 0) {
    gizmoSaisi_ = -1;
    if (surGeste) surGeste(2, "", 0, "", 0, false);
    return;
  }
  if (ignorerRelache_) {
    ignorerRelache_ = false;
    return;
  }
  if (aBouge_) return;
  if (surClicFao && (e.LeftUp() || e.RightUp())) {
    cliquerFao(e.GetPosition(), e.RightUp() ? 2 : 0, e.ControlDown(), e.ShiftDown());
    if (faoPrisClic_) return;
  }
  if (e.RightUp()) return droitEn(e.GetPosition());
  if (!e.LeftUp()) return;
  cliquerEn(e.GetPosition());
}

void Vue3D::faoModeChoix(const std::string& mode) {
  faoSurvol = mode == "chaine";
  SetCursor(mode.empty() ? wxNullCursor : wxCursor(mode == "point" ? wxCURSOR_CROSS : wxCURSOR_HAND));
}

void Vue3D::cliquerFao(const wxPoint& p, int bouton, bool ctrl, bool maj, bool survol) {
  faoPrisClic_ = false;
  if (!surClicFao) return;
  ClicFao c;
  c.survol = survol;
  c.x = p.x;
  c.y = p.y;
  const wxSize t = GetClientSize();
  c.w = t.x;
  c.h = t.y;
  c.bouton = bouton;
  c.ctrl = ctrl;
  c.maj = maj;
  const occ::handle<Graphic3d_Camera>& cam = vue_->Camera();
  c.persp = cam->ProjectionType() != Graphic3d_Camera::Projection_Orthographic;
  c.pres = cam->ZNear();
  c.loin = cam->ZFar();
  const auto& P = cam->ProjectionMatrix();
  const auto& O = cam->OrientationMatrix();
  for (int i = 0; i < 16; i++) {
    c.proj[i] = P.GetData()[i];
    c.vue[i] = O.GetData()[i];
  }
  const bool pris = surClicFao(c);
  if (!survol) faoPrisClic_ = pris;
}

void Vue3D::droitEn(const wxPoint& p) {
  if (placer_) {
    contexte_->MoveTo(p.x, p.y, vue_, false);
    std::string cle;
    if (contexte_->HasDetected())
      for (const OccAffichee& o : occs_)
        if (o.piece == contexte_->DetectedInteractive()) cle = o.v.cle;
    if (surOccDroit) surOccDroit(cle);
    return;
  }
  if (!surDroit) return;
  TopoDS_Shape sous;
  if (!affichee_.IsNull() && !enChoix_) {
    preparerSelection();
    contexte_->MoveTo(p.x, p.y, vue_, false);
    if (contexte_->HasDetected() && contexte_->HasDetectedShape()) sous = contexte_->DetectedShape();
  }
  surDroit(sous);
}

namespace {
occ::handle<AIS_Shape> nappe(const occ::handle<AIS_InteractiveContext>& c, const std::vector<TopoDS_Face>& faces, const Quantity_Color& teinte);
}

void Vue3D::cliquerEn(const wxPoint& p) {
  dernierClic_ = p;
  if (!marques_.empty()) {
    const int m = marqueSous(p);
    if (m >= 0) {
      if (surMarque) surMarque(m);
      return;
    }
  }
  if (!placer_) preparerSelection();
  contexte_->MoveTo(p.x, p.y, vue_, false);
  if (contexte_->HasDetected() && contexte_->MainSelector()->NbPicked() > 0) {
    const gp_Pnt q = contexte_->MainSelector()->PickedPoint(1);
    dernierPoint_[0] = q.X();
    dernierPoint_[1] = q.Y();
    dernierPoint_[2] = q.Z();
  }
  if (contexte_->HasDetected()) {
    const occ::handle<AIS_ViewCubeOwner> face = occ::down_cast<AIS_ViewCubeOwner>(contexte_->DetectedOwner());
    if (!face.IsNull()) {
      cube_->HandleClick(face);
      vue_->FitAll(MARGE_VUE, false);
      majReflets();
      vue_->Redraw();
      return;
    }
  }
  // La mesure passe avant toute commande : Ctrl ne sélectionne ni n'active rien (ctrlMesureEv)
  const bool ctrl = essaiCtrl >= 0 ? essaiCtrl != 0 : wxGetKeyState(WXK_CONTROL), maj = essaiMaj >= 0 ? essaiMaj != 0 : wxGetKeyState(WXK_SHIFT);
  const bool libre = surMesure && marques_.empty() && !aligner_ && !enChoix_ && !modeFaces_;
  CoupVue coup;
  bool aCoup = false;
  if (libre && ctrl && !maj) {
    aCoup = coupMesure(p, coup);
    if (placer_ || (aCoup && !coup.propre)) {
      surMesure(aCoup ? &coup : nullptr, true, false);
      return;
    }
  } else if (libre && !placer_) aCoup = lireCoup(p, coup);
  if (surRayon) {
    gp_Pnt o;
    gp_Dir d;
    rayon(p.x, p.y, o, d);
    double px, py, pz;
    vue_->Proj(px, py, pz);  // vers l'œil : le rayon va dans l'autre sens
    if (d.X() * px + d.Y() * py + d.Z() * pz > 0) d.Reverse();
    if (surRayon(o, d)) return;
  }
  if (placer_) {
    std::string cle;
    const OccAffichee* trouvee = nullptr;
    if (contexte_->HasDetected())
      for (const OccAffichee& o : occs_)
        if (o.piece == contexte_->DetectedInteractive()) {
          cle = o.v.cle;
          trouvee = &o;
        }
    if (!marques_.empty() || aligner_) {
      // La commande Aligner : une face, et ses points d'accroche
      if (surFaceOcc && contexte_->HasDetected() && contexte_->MainSelector()->NbPicked() > 0) {
        const bool surPiece = !affichee_.IsNull() && affichee_ == contexte_->DetectedInteractive();
        if (trouvee || surPiece) {
          const gp_Pnt q = contexte_->MainSelector()->PickedPoint(1);
          surFaceOcc(trouvee ? trouvee->v.chemin : cheminPiece_, q, false, {0, 0, 0});
        }
      }
      return;
    }
    if (surOccurrence) surOccurrence(cle, wxGetKeyState(WXK_CONTROL), wxGetKeyState(WXK_SHIFT));
    return;
  }
  if (affichee_.IsNull()) return;
  contexte_->SelectDetected(!enChoix_ && wxGetKeyState(WXK_CONTROL) ? AIS_SelectionScheme_XOR : AIS_SelectionScheme_Replace);
  contexte_->UpdateCurrentViewer();
  TopoDS_Shape choisie;
  contexte_->InitSelected();
  if (contexte_->MoreSelected() && contexte_->HasSelectedShape()) choisie = contexte_->SelectedShape();
  if (enChoix_) contexte_->ClearSelected(true);  // ce qui est retenu a son propre trait orange
  if (surSelection) surSelection(choisie);
  if (libre) surMesure(aCoup ? &coup : nullptr, ctrl, maj);
}

// Ce qui est sous le dernier passage de la souris : une face ou une arête de la pièce, ou d'une occurrence
bool Vue3D::lireCoup(const wxPoint& p, CoupVue& c) {
  contexte_->MoveTo(p.x, p.y, vue_, false);
  if (!contexte_->HasDetected() || !contexte_->HasDetectedShape()) return false;
  const TopoDS_Shape s = contexte_->DetectedShape();
  if (s.IsNull() || (s.ShapeType() != TopAbs_FACE && s.ShapeType() != TopAbs_EDGE)) return false;
  const occ::handle<AIS_InteractiveObject> io = contexte_->DetectedInteractive();
  c = CoupVue();
  bool trouve = false;
  if (!affichee_.IsNull() && affichee_ == io) {
    c.propre = true;
    c.chemin = cheminPiece_;
    trouve = true;
  } else
    for (const OccAffichee& o : occs_)
      if (o.piece == io) {
        c.t = o.v.t;
        c.chemin = o.v.chemin;
        trouve = true;
        break;
      }
  if (!trouve || contexte_->MainSelector()->NbPicked() <= 0) return false;
  c.s = s;
  c.p = contexte_->MainSelector()->PickedPoint(1);
  return true;
}

// Ctrl+clic : pour mesurer, les occurrences donnent aussi leurs faces et leurs arêtes ; les pièces
// estompées d'une autre branche de l'assemblage seulement si rien d'autre n'est sous la souris (mesPick)
bool Vue3D::coupMesure(const wxPoint& p, CoupVue& c) {
  const bool pieceOuverte = !selectionPrete_ && !affichee_.IsNull();
  if (pieceOuverte) {
    contexte_->Load(affichee_, -1);
    contexte_->Activate(affichee_, AIS_Shape::SelectionMode(TopAbs_EDGE));
    contexte_->Activate(affichee_, AIS_Shape::SelectionMode(TopAbs_FACE));
  }
  std::vector<const OccAffichee*> ouvertes;
  const auto ouvrir = [&](bool fantomes) {
    for (const OccAffichee& o : occs_) {
      if (o.v.fantome != fantomes) continue;
      contexte_->Load(o.piece, -1);
      contexte_->Deactivate(o.piece);
      contexte_->Activate(o.piece, AIS_Shape::SelectionMode(TopAbs_EDGE));
      contexte_->Activate(o.piece, AIS_Shape::SelectionMode(TopAbs_FACE));
      ouvertes.push_back(&o);
    }
  };
  ouvrir(false);
  bool ok = lireCoup(p, c);
  if (!ok) {
    ouvrir(true);
    ok = lireCoup(p, c);
  }
  for (const OccAffichee* o : ouvertes) {
    contexte_->Deactivate(o->piece);
    if (o->v.cliquable) contexte_->Activate(o->piece, 0);
  }
  if (pieceOuverte) contexte_->Deactivate(affichee_);
  contexte_->MoveTo(p.x, p.y, vue_, false);
  return ok;
}

void Vue3D::montrerMesure(const mesure::Dessin& d) {
  for (const auto& a : mesureAis_) contexte_->Remove(a, false);
  mesureAis_.clear();
  if (d.vide()) {
    vue_->Redraw();
    return;
  }
  const Quantity_Color vert(0x30 / 255.0, 0xd1 / 255.0, 0x58 / 255.0, Quantity_TOC_sRGB), orange(1.0, 0x9f / 255.0, 0x0a / 255.0, Quantity_TOC_sRGB);
  const auto ajouter = [&](const occ::handle<AIS_InteractiveObject>& a) {
    contexte_->SetZLayer(a, Graphic3d_ZLayerId_TopOSD);
    mesureAis_.push_back(a);
  };
  const auto ligne = [&](const std::vector<gp_Pnt>& P, const Quantity_Color& c, double largeur, bool tirets) {
    if (P.size() < 2) return;
    BRepBuilderAPI_MakePolygon m;
    for (const gp_Pnt& q : P) m.Add(q);
    if (!m.IsDone()) return;
    occ::handle<AIS_Shape> a = new AIS_Shape(m.Wire());
    a->Attributes()->SetAutoTriangulation(false);
    a->SetColor(c);
    a->SetWidth(largeur);
    if (tirets) a->Attributes()->WireAspect()->SetTypeOfLine(Aspect_TOL_DASH);
    contexte_->Display(a, AIS_WireFrame, -1, false);
    ajouter(a);
  };
  const auto point = [&](const gp_Pnt& q) {
    occ::handle<AIS_Point> a = new AIS_Point(new Geom_CartesianPoint(q));
    a->SetMarker(Aspect_TOM_BALL);
    a->SetColor(vert);
    contexte_->Display(a, 0, -1, false);
    ajouter(a);
  };
  const auto etiquette = [&](const std::string& t, const gp_Pnt& q) {
    occ::handle<AIS_TextLabel> a = new AIS_TextLabel();
    a->SetText(TCollection_ExtendedString(t.c_str(), true));
    a->SetPosition(q);
    a->SetFont("Segoe UI");
    a->SetHeight(14);
    a->SetColor(Quantity_NOC_WHITE);
    a->SetHJustification(Graphic3d_HTA_CENTER);
    a->SetVJustification(Graphic3d_VTA_CENTER);
    a->Attributes()->TextAspect()->Aspect()->SetDisplayType(Aspect_TODT_SUBTITLE);
    a->Attributes()->TextAspect()->Aspect()->SetColorSubTitle(Quantity_Color(0.10, 0.35, 0.16, Quantity_TOC_sRGB));
    contexte_->Display(a, 0, -1, false);
    ajouter(a);
  };
  if (!d.faces.empty()) {
    std::vector<TopoDS_Face> F;
    for (const TopoDS_Shape& s : d.faces) F.push_back(TopoDS::Face(s));
    mesureAis_.push_back(nappe(contexte_, F, orange));
  }
  for (const auto& P : d.aretes) ligne(P, orange, 3, false);
  const double lg = std::max(20.0, vue_->Camera()->Scale() * 0.4);  // axisLen
  for (const mesure::Axe& x : d.axes) {
    const gp_Pnt a(x.c.X() - x.a.X() * lg / 2, x.c.Y() - x.a.Y() * lg / 2, x.c.Z() - x.a.Z() * lg / 2), b(x.c.X() + x.a.X() * lg / 2, x.c.Y() + x.a.Y() * lg / 2, x.c.Z() + x.a.Z() * lg / 2);
    ligne({a, b}, orange, 1, true);
  }
  for (const mesure::Cote& k : d.cotes) {
    ligne({k.a, k.b}, vert, 2, false);
    point(k.a);
    point(k.b);
    etiquette(k.texte, gp_Pnt((k.a.X() + k.b.X()) / 2, (k.a.Y() + k.b.Y()) / 2, (k.a.Z() + k.b.Z()) / 2));
  }
  for (const mesure::Etiquette& t : d.etiquettes) {
    point(t.p);
    etiquette(t.texte, t.p);
  }
  vue_->Redraw();
}

wxPoint Vue3D::pixelDe(double x, double y, double z) const {
  int X = 0, Y = 0;
  vue_->Convert(x, y, z, X, Y);
  return wxPoint(X, Y);
}

namespace {
occ::handle<AIS_Shape> trait(const occ::handle<AIS_InteractiveContext>& c, const TopoDS_Shape& s, const Quantity_Color& couleur, double largeur) {
  occ::handle<AIS_Shape> a = new AIS_Shape(s);
  a->Attributes()->SetAutoTriangulation(false);
  a->SetColor(couleur);
  a->SetWidth(largeur);
  c->Display(a, AIS_WireFrame, -1, false);
  return a;
}
void retirer(const occ::handle<AIS_InteractiveContext>& c, occ::handle<AIS_Shape>& a) {
  if (!a.IsNull()) c->Remove(a, false);
  a.Nullify();
}
}  // namespace

void Vue3D::debutChoix(const TopoDS_Shape& vives, const TopoDS_Shape& tangentes) {
  if (affichee_.IsNull()) return;
  preparerSelection();
  enChoix_ = true;
  contexte_->ClearSelected(false);
  toleranceAvant_ = contexte_->PixelTolerance();
  contexte_->SetPixelTolerance(7);  // 7 pixels autour de l'arête, comme edgePickScreen dans le navigateur
  if (!aretesVives_.IsNull()) contexte_->Erase(aretesVives_, false);
  if (!aretesLisses_.IsNull()) contexte_->Erase(aretesLisses_, false);
  traitsVifs_ = trait(contexte_, vives, couleur(0, 0, 0), 1.2);
  traitsLisses_ = trait(contexte_, tangentes, couleur(0x8a, 0x8f, 0x99), 1.0);
  vue_->Redraw();
}

// La couleur des filets du navigateur (holeThreadGrp) : l'hélice en trait plein, le cercle en pointillé
void Vue3D::montrerFilets(const std::vector<std::vector<gp_Pnt>>& helices, const std::vector<std::vector<gp_Pnt>>& anneaux) {
  retirer(contexte_, filetsHelices_);
  retirer(contexte_, filetsAnneaux_);
  const auto compose = [](const std::vector<std::vector<gp_Pnt>>& lignes) {
    BRep_Builder bb;
    TopoDS_Compound c;
    bb.MakeCompound(c);
    for (const auto& l : lignes) {
      BRepBuilderAPI_MakePolygon p;
      for (const gp_Pnt& q : l) p.Add(q);
      if (p.IsDone()) bb.Add(c, p.Wire());
    }
    return c;
  };
  if (!helices.empty()) filetsHelices_ = trait(contexte_, compose(helices), couleur(0xff, 0xb3, 0x40), 1.0);
  if (!anneaux.empty()) {
    filetsAnneaux_ = new AIS_Shape(compose(anneaux));
    filetsAnneaux_->Attributes()->SetAutoTriangulation(false);
    filetsAnneaux_->SetColor(couleur(0xff, 0xb3, 0x40));
    filetsAnneaux_->Attributes()->SetWireAspect(new Prs3d_LineAspect(couleur(0xff, 0xb3, 0x40), Aspect_TOL_DASH, 1.0));
    contexte_->Display(filetsAnneaux_, AIS_WireFrame, -1, false);
  }
  vue_->Redraw();
}

void Vue3D::montrerConstruction(const std::vector<DessinConstruction>& L, const double C[3], double h) {
  for (auto& a : construction_) contexte_->Remove(a, false);
  construction_.clear();
  const auto pt = [](const double o[3], const double u[3], double a, const double v[3], double b) { return gp_Pnt(o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b); };
  const auto ligne = [&](const gp_Pnt& a, const gp_Pnt& b, const Quantity_Color& c, Aspect_TypeOfLine t, double l) {
    if (a.Distance(b) < 1e-9) return;
    occ::handle<AIS_Shape> s = new AIS_Shape(BRepBuilderAPI_MakeEdge(a, b).Edge());
    s->Attributes()->SetAutoTriangulation(false);
    s->SetColor(c);
    s->Attributes()->SetWireAspect(new Prs3d_LineAspect(c, t, l));
    s->SetInfiniteState(true);
    contexte_->Display(s, AIS_WireFrame, -1, false);
    construction_.push_back(s);
  };
  const double nul[3] = {0, 0, 0};
  for (const DessinConstruction& e : L) {
    const Quantity_Color col = e.choisi ? couleur(0xff, 0x9f, 0x0a) : couleur(0xe0, 0xa5, 0x26);
    if (e.kind == "plane") {
      // centré sur la projection du centre de la pièce : le plan « couvre » la pièce
      const double d[3] = {C[0] - e.o[0], C[1] - e.o[1], C[2] - e.o[2]};
      const double du = d[0] * e.x[0] + d[1] * e.x[1] + d[2] * e.x[2], dv = d[0] * e.y[0] + d[1] * e.y[1] + d[2] * e.y[2];
      const gp_Pnt c = pt(e.o, e.x, du, e.y, dv);
      const double cc[3] = {c.X(), c.Y(), c.Z()};
      const gp_Pnt P[4] = {pt(cc, e.x, -h, e.y, -h), pt(cc, e.x, h, e.y, -h), pt(cc, e.x, h, e.y, h), pt(cc, e.x, -h, e.y, h)};
      BRepBuilderAPI_MakePolygon poly(P[0], P[1], P[2], P[3], true);
      try {
        occ::handle<AIS_Shape> f = new AIS_Shape(BRepBuilderAPI_MakeFace(poly.Wire(), true).Face());
        f->SetColor(col);
        f->SetTransparency(e.choisi ? 0.7 : 0.84);
        f->SetInfiniteState(true);
        contexte_->Display(f, AIS_Shaded, -1, false);
        construction_.push_back(f);
      } catch (const Standard_Failure&) {
      }
      for (int i = 0; i < 4; i++) ligne(P[i], P[(i + 1) % 4], col, Aspect_TOL_SOLID, e.choisi ? 2.0 : 1.0);
      // petite flèche de normale au coin : le sens du plan se lit
      const gp_Pnt k = pt(cc, e.x, h * 0.88, e.y, h * 0.88);
      const double kk[3] = {k.X(), k.Y(), k.Z()};
      ligne(k, pt(kk, e.z, h * 0.18, nul, 0), col, Aspect_TOL_SOLID, 1.0);
    } else if (e.kind == "axis") {
      ligne(pt(e.o, e.z, -h * 1.3, nul, 0), pt(e.o, e.z, h * 1.3, nul, 0), col, Aspect_TOL_DASH, e.choisi ? 2.0 : 1.2);
    } else if (e.kind == "point") {
      occ::handle<AIS_Shape> s = new AIS_Shape(BRepPrimAPI_MakeSphere(gp_Pnt(e.o[0], e.o[1], e.o[2]), h * 0.025).Shape());
      s->SetColor(col);
      s->SetInfiniteState(true);
      contexte_->Display(s, AIS_Shaded, -1, false);
      construction_.push_back(s);
    } else if (e.kind == "frame") {
      const gp_Pnt O(e.o[0], e.o[1], e.o[2]);
      const double l = h * 0.4, ep = e.choisi ? 3.0 : 2.0;
      ligne(O, pt(e.o, e.x, l, nul, 0), couleur(0xff, 0x45, 0x3a), Aspect_TOL_SOLID, ep);
      ligne(O, pt(e.o, e.y, l, nul, 0), couleur(0x30, 0xd1, 0x58), Aspect_TOL_SOLID, ep);
      ligne(O, pt(e.o, e.z, l, nul, 0), couleur(0x0a, 0x84, 0xff), Aspect_TOL_SOLID, ep);
    }
  }
  vue_->Redraw();
}

void Vue3D::montrerChoix(const TopoDS_Shape& choisies, const TopoDS_Shape& apercu, const std::vector<TopoDS_Face>& nouvelles) {
  retirer(contexte_, traitsChoisis_);
  retirer(contexte_, apercu_);
  if (!choisies.IsNull()) traitsChoisis_ = trait(contexte_, choisies, couleur(0xff, 0x9f, 0x0a), 3.0);
  if (!apercu.IsNull()) {
    occ::handle<AIS_ColoredShape> a = new AIS_ColoredShape(apercu);
    a->Attributes()->SetAutoTriangulation(false);
    a->SetColor(couleurHex(0x0a84ff));
    for (const TopoDS_Face& f : nouvelles) a->SetCustomColor(f, couleur(0xff, 0x7a, 0x1f));
    a->SetMaterial(matierePiece());
    contexte_->Display(a, AIS_Shaded, -1, false);
    apercu_ = a;
    contexte_->SetTransparency(affichee_, 1.0, false);  // toujours là pour recevoir les clics, mais on voit l'aperçu
  } else {
    contexte_->UnsetTransparency(affichee_, false);
  }
  vue_->Redraw();
}

void Vue3D::debutChoixFaces() {
  if (affichee_.IsNull()) return;
  preparerSelection();
  enChoix_ = true;
  modeFaces_ = true;
  contexte_->ClearSelected(false);
  toleranceAvant_ = contexte_->PixelTolerance();
  contexte_->Deactivate(affichee_, AIS_Shape::SelectionMode(TopAbs_EDGE));  // un clic près d'une arête vise la face
  vue_->Redraw();
}

namespace {
occ::handle<AIS_Shape> nappe(const occ::handle<AIS_InteractiveContext>& c, const std::vector<TopoDS_Face>& faces, const Quantity_Color& teinte) {
  TopoDS_Compound k;
  BRep_Builder b;
  b.MakeCompound(k);
  for (const TopoDS_Face& f : faces) b.Add(k, f);
  occ::handle<AIS_Shape> a = new AIS_Shape(k);
  a->Attributes()->SetAutoTriangulation(false);
  a->SetColor(teinte);
  a->Attributes()->ShadingAspect()->Aspect()->SetShadingModel(Graphic3d_TypeOfShadingModel_Unlit);
  c->Display(a, AIS_Shaded, -1, false);
  c->SetZLayer(a, Graphic3d_ZLayerId_Topmost);  // toujours visible, comme depthTest:false dans le navigateur
  c->SetTransparency(a, 0.45, false);
  return a;
}
}  // namespace

void Vue3D::montrerFaces(const std::vector<TopoDS_Face>& retenues, const std::vector<TopoDS_Face>& reference, const TopoDS_Shape& apercu, unsigned couleurApercu, const TopoDS_Shape& plan) {
  retirer(contexte_, facesRetenues_);
  retirer(contexte_, faceReference_);
  retirer(contexte_, planChoix_);
  retirer(contexte_, apercu_);
  if (!retenues.empty()) facesRetenues_ = nappe(contexte_, retenues, couleur(0xff, 0x9f, 0x0a));
  if (!reference.empty()) faceReference_ = nappe(contexte_, reference, couleur(0x0a, 0x84, 0xff));
  if (!plan.IsNull()) {
    occ::handle<AIS_Shape> a = new AIS_Shape(plan);
    a->Attributes()->SetAutoTriangulation(false);
    a->SetColor(couleur(0x0a, 0x84, 0xff));
    contexte_->Display(a, AIS_Shaded, -1, false);
    contexte_->SetTransparency(a, 0.82, false);
    planChoix_ = a;
  }
  if (!apercu.IsNull()) {
    occ::handle<AIS_Shape> a = new AIS_Shape(apercu);
    a->Attributes()->SetAutoTriangulation(false);
    a->SetColor(couleurHex(couleurApercu));
    a->SetMaterial(matierePiece());
    contexte_->Display(a, AIS_Shaded, -1, false);
    contexte_->SetTransparency(a, 0.45, false);
    apercu_ = a;
    contexte_->SetTransparency(affichee_, 0.72, false);  // la pièce s'estompe et reçoit toujours les clics
  } else if (!affichee_.IsNull()) {
    contexte_->UnsetTransparency(affichee_, false);
  }
  vue_->Redraw();
}

std::vector<TopoDS_Face> Vue3D::facesChoisies() const {
  std::vector<TopoDS_Face> v;
  for (contexte_->InitSelected(); contexte_->MoreSelected(); contexte_->NextSelected())
    if (contexte_->HasSelectedShape() && contexte_->SelectedShape().ShapeType() == TopAbs_FACE) v.push_back(TopoDS::Face(contexte_->SelectedShape()));
  return v;
}

void Vue3D::finChoix() {
  if (!enChoix_) return;
  enChoix_ = false;
  retirer(contexte_, facesRetenues_);
  retirer(contexte_, faceReference_);
  retirer(contexte_, planChoix_);
  if (modeFaces_ && !affichee_.IsNull()) contexte_->Activate(affichee_, AIS_Shape::SelectionMode(TopAbs_EDGE));
  modeFaces_ = false;
  retirer(contexte_, traitsVifs_);
  retirer(contexte_, traitsLisses_);
  retirer(contexte_, traitsChoisis_);
  retirer(contexte_, apercu_);
  contexte_->SetPixelTolerance(static_cast<int>(toleranceAvant_));
  contexte_->ClearSelected(false);
  if (!affichee_.IsNull()) {
    contexte_->UnsetTransparency(affichee_, false);
    if (!aretesVives_.IsNull()) contexte_->Display(aretesVives_, AIS_WireFrame, -1, false);
    if (!aretesLisses_.IsNull()) contexte_->Display(aretesLisses_, AIS_WireFrame, -1, false);
  }
  vue_->Redraw();
}

void Vue3D::surMouvement(wxMouseEvent& e) {
  const wxPoint p = e.GetPosition();
  if (gizmoSaisi_ >= 0) return bougerGizmo(p, e.ShiftDown());
  if (e.LeftIsDown() || e.MiddleIsDown()) {
    if (!aBouge_ && std::abs(p.x - depart_.x) + std::abs(p.y - depart_.y) <= SEUIL_CLIC) return;
    aBouge_ = true;
    vue_->Rotation(p.x, p.y);
    const bool avant = refletsVus_;
    majReflets();
    majTailles();
    if (avant != refletsVus_) vue_->Redraw();
  } else if (e.RightIsDown()) {
    aBouge_ = true;
    vue_->Pan(p.x - precedent_.x, precedent_.y - p.y);
    precedent_ = p;
    majTailles();
  } else if (faoSurvol) {
    cliquerFao(p, 0, false, false, true);
  } else {
    if (!placer_) preparerSelection();
    contexte_->MoveTo(p.x, p.y, vue_, true);
  }
}

void Vue3D::surMolette(wxMouseEvent& e) {
  const wxPoint p = e.GetPosition();  // wxWidgets la donne déjà dans le repère de cette fenêtre
  vue_->StartZoomAtPoint(p.x, p.y);
  const int d = e.GetWheelRotation() / 4;
  vue_->ZoomAtPoint(p.x, p.y, p.x + d, p.y + d);
  majTailles();
  vue_->Redraw();
}

void Vue3D::surPerteSouris(wxMouseCaptureLostEvent&) { aBouge_ = true; }

// ---- L'assemblage ----
void Vue3D::modePlacer(bool oui) {
  if (oui == placer_) return;
  placer_ = oui;
  if (oui && selectionPrete_ && !affichee_.IsNull()) {
    contexte_->Deactivate(affichee_);
    selectionPrete_ = false;
  }
  contexte_->ClearSelected(false);
}

namespace {
// Des segments de couleur : les lignes de champ d'un aimant
class TraitsCouleur : public AIS_InteractiveObject {
 public:
  explicit TraitsCouleur(const std::vector<std::array<float, 9>>& L) : l_(L) {}
  void Compute(const occ::handle<PrsMgr_PresentationManager>&, const occ::handle<Prs3d_Presentation>& prs, const int) override {
    occ::handle<Graphic3d_ArrayOfSegments> A = new Graphic3d_ArrayOfSegments(static_cast<int>(2 * l_.size()), 0, Graphic3d_ArrayFlags_VertexColor);
    for (const auto& t : l_) {
      const Quantity_Color c(t[6], t[7], t[8], Quantity_TOC_RGB);
      A->AddVertex(gp_Pnt(t[0], t[1], t[2]), c);
      A->AddVertex(gp_Pnt(t[3], t[4], t[5]), c);
    }
    occ::handle<Graphic3d_Group> g = prs->CurrentGroup();
    g->SetGroupPrimitivesAspect(new Graphic3d_AspectLine3d(Quantity_NOC_WHITE, Aspect_TOL_SOLID, 1.0));
    g->AddPrimitiveArray(A);
  }
  void ComputeSelection(const occ::handle<SelectMgr_Selection>&, const int) override {}

 private:
  std::vector<std::array<float, 9>> l_;
};
}  // namespace

void Vue3D::montrerOccurrences(const std::vector<OccVue>& L) {
  for (OccAffichee& o : occs_) {
    contexte_->Remove(o.piece, false);
    if (!o.vives.IsNull()) contexte_->Remove(o.vives, false);
    if (!o.lisses.IsNull()) contexte_->Remove(o.lisses, false);
    if (!o.traits.IsNull()) contexte_->Remove(o.traits, false);
  }
  occs_.clear();
  for (const OccVue& v : L) {
    OccAffichee o;
    o.v = v;
    occ::handle<AIS_ColoredShape> piece = new AIS_ColoredShape(v.forme);
    piece->Attributes()->SetAutoTriangulation(false);
    piece->SetColor(couleurHex(0x0a84ff));
    for (const auto& [corps, c] : v.teintes) piece->SetCustomColor(corps, couleurHex(c));
    piece->SetMaterial(matierePiece());
    const double tr = v.fantome ? 0.82 : v.transparence;
    if (tr > 0) {
      for (const auto& t : v.teintes) piece->SetCustomTransparency(t.first, tr);
    } else if (tr < 0) {
      for (const auto& [corps, t] : v.transparences) piece->SetCustomTransparency(corps, t);
    }
    piece->SetLocalTransformation(v.t);
    contexte_->Display(piece, AIS_Shaded, v.cliquable ? 0 : -1, false);
    o.piece = piece;
    if (v.aretes) {
      const auto traits = [&](const TopoDS_Shape& s, const Quantity_Color& c) {
        occ::handle<AIS_Shape> a = new AIS_Shape(s);
        a->Attributes()->SetAutoTriangulation(false);
        a->SetColor(c);
        a->SetWidth(1.25);
        a->SetLocalTransformation(v.t);
        contexte_->Display(a, AIS_WireFrame, -1, false);
        return a;
      };
      if (!v.vives.IsNull()) o.vives = traits(v.vives, couleur(5, 5, 6));
      if (!v.lisses.IsNull()) o.lisses = traits(v.lisses, couleur(0x9a, 0x9f, 0xa6));
    }
    if (!v.traits.empty()) {
      o.traits = new TraitsCouleur(v.traits);
      o.traits->SetLocalTransformation(v.t);
      contexte_->Display(o.traits, 0, -1, false);
    }
    occs_.push_back(std::move(o));
  }
  refaireReflets();
  majReflets();
  vue_->ZFitAll();
  vue_->Redraw();
}

namespace {
// Beaucoup de segments d'une seule couleur : dessinés d'un coup, sans passer par des formes OCCT
class TraitsFao : public AIS_InteractiveObject {
 public:
  TraitsFao(std::vector<float> v, const Quantity_Color& c, double l) : v_(std::move(v)), c_(c), l_(l) {}
  void Compute(const occ::handle<PrsMgr_PresentationManager>&, const occ::handle<Prs3d_Presentation>& prs, const int) override {
    const int n = static_cast<int>(v_.size() / 3);
    occ::handle<Graphic3d_ArrayOfSegments> A = new Graphic3d_ArrayOfSegments(n);
    for (int i = 0; i + 1 < n; i += 2) {
      A->AddVertex(v_[3 * i], v_[3 * i + 1], v_[3 * i + 2]);
      A->AddVertex(v_[3 * i + 3], v_[3 * i + 4], v_[3 * i + 5]);
    }
    occ::handle<Graphic3d_Group> g = prs->CurrentGroup();
    g->SetGroupPrimitivesAspect(new Graphic3d_AspectLine3d(c_, Aspect_TOL_SOLID, l_));
    g->AddPrimitiveArray(A);
  }
  void ComputeSelection(const occ::handle<SelectMgr_Selection>&, const int) override {}

 private:
  std::vector<float> v_;
  Quantity_Color c_;
  double l_;
};
}  // namespace

void Vue3D::montrerFao(const DessinFao& d) {
  for (auto& a : faoAis_) contexte_->Remove(a, false);
  faoAis_.clear();
  gp_Trsf t;
  t.SetValues(d.x[0], d.y[0], d.z[0], d.o[0], d.x[1], d.y[1], d.z[1], d.o[1], d.x[2], d.y[2], d.z[2], d.o[2]);
  const auto couche = [&](const std::vector<float>& v, unsigned rgb, double l) {
    if (v.size() < 6) return;
    occ::handle<TraitsFao> a = new TraitsFao(v, couleur(rgb >> 16, (rgb >> 8) & 255, rgb & 255), l);
    a->SetLocalTransformation(t);
    contexte_->Display(a, 0, -1, false);
    contexte_->Deactivate(a);
    faoAis_.push_back(a);
  };
  couche(d.coupe, 0x2f80ff, 1.0);
  couche(d.plongees, 0x30d158, 2.0);
  if (!d.masque) {
    // « Fondus » : 8 % sur le fond, une couleur éteinte fait le même effet sans trier les traits
    couche(d.rapides, d.fondu ? 0x3a3a30 : 0xffd60a, d.fondu ? 1.0 : 2.0);
    couche(d.remontees, d.fondu ? 0x3a2a33 : 0xff2d92, d.fondu ? 1.0 : 2.0);
  }
  vue_->ZFitAll();
  vue_->Redraw();
}

namespace {
// Un objet de la scène FAO : sans éclairage, comme les matières « Basic » de la page
class ObjetSceneFao : public AIS_InteractiveObject {
 public:
  explicit ObjetSceneFao(const Vue3D::ObjetFao& o) : o_(o) {}
  void Compute(const occ::handle<PrsMgr_PresentationManager>&, const occ::handle<Prs3d_Presentation>& prs, const int) override {
    const int n = static_cast<int>(o_.a.size() / 3);
    const Quantity_Color c((o_.couleur >> 16) / 255.0, ((o_.couleur >> 8) & 255) / 255.0, (o_.couleur & 255) / 255.0, Quantity_TOC_sRGB);
    occ::handle<Graphic3d_Group> g = prs->CurrentGroup();
    const auto V = [&](int i) { return gp_Pnt(o_.a[3 * i], o_.a[3 * i + 1], o_.a[3 * i + 2]); };
    if (o_.sorte == 'T' && !o_.n.empty()) {
      g->SetGroupPrimitivesAspect(aspectEclaire(o_.couleur, o_.reflet, o_.brillance));
      occ::handle<Graphic3d_ArrayOfTriangles> T = new Graphic3d_ArrayOfTriangles(n, 0, Graphic3d_ArrayFlags_VertexNormal);
      for (int i = 0; i < n; i++) T->AddVertex(o_.a[3 * i], o_.a[3 * i + 1], o_.a[3 * i + 2], o_.n[3 * i], o_.n[3 * i + 1], o_.n[3 * i + 2]);
      g->AddPrimitiveArray(T);
      return;
    }
    if (o_.sorte == 'T') {
      occ::handle<Graphic3d_AspectFillArea3d> A = new Graphic3d_AspectFillArea3d();
      A->SetInteriorStyle(Aspect_IS_SOLID);
      A->SetInteriorColor(Quantity_ColorRGBA(c, static_cast<float>(o_.alpha)));
      A->SetBackInteriorColor(Quantity_ColorRGBA(c, static_cast<float>(o_.alpha)));
      A->SetShadingModel(Graphic3d_TypeOfShadingModel_Unlit);
      A->SetDistinguish(false);
      A->SetSuppressBackFaces(false);
      if (o_.alpha < 1) {
        A->SetAlphaMode(Graphic3d_AlphaMode_Blend);
        A->SetPolygonOffsets(Aspect_POM_Fill, -1.f, -2.f);  // posé sur la matière : jamais à moitié dedans
      }
      g->SetGroupPrimitivesAspect(A);
      occ::handle<Graphic3d_ArrayOfTriangles> T = new Graphic3d_ArrayOfTriangles(n);
      for (int i = 0; i < n; i++) T->AddVertex(V(i));
      g->AddPrimitiveArray(T);
      return;
    }
    if (o_.sorte == 'P') {
      g->SetGroupPrimitivesAspect(new Graphic3d_AspectMarker3d(Aspect_TOM_POINT, c, std::max(1.0, o_.taille / 1.5)));
      occ::handle<Graphic3d_ArrayOfPoints> P = new Graphic3d_ArrayOfPoints(n);
      for (int i = 0; i < n; i++) P->AddVertex(V(i));
      g->AddPrimitiveArray(P);
      return;
    }
    // Les traits translucides de la page : même teinte, mêlée au fond
    const double al = o_.alpha;
    const Quantity_Color cl(c.Red() * al + 0.08 * (1 - al), c.Green() * al + 0.08 * (1 - al), c.Blue() * al + 0.09 * (1 - al), Quantity_TOC_RGB);
    g->SetGroupPrimitivesAspect(new Graphic3d_AspectLine3d(cl, Aspect_TOL_SOLID, std::max(1.0, o_.taille)));
    if (o_.sorte == 'S') {
      occ::handle<Graphic3d_ArrayOfSegments> S = new Graphic3d_ArrayOfSegments(n);
      for (int i = 0; i < n; i++) S->AddVertex(V(i));
      g->AddPrimitiveArray(S);
    } else {
      occ::handle<Graphic3d_ArrayOfPolylines> L = new Graphic3d_ArrayOfPolylines(o_.sorte == 'B' ? n + 1 : n);
      for (int i = 0; i < n; i++) L->AddVertex(V(i));
      if (o_.sorte == 'B' && n) L->AddVertex(V(0));
      g->AddPrimitiveArray(L);
    }
  }
  void ComputeSelection(const occ::handle<SelectMgr_Selection>&, const int) override {}

 private:
  Vue3D::ObjetFao o_;
};
}  // namespace

void Vue3D::montrerSceneFao(const std::vector<ObjetFao>& L) {
  for (auto& a : faoScene_) contexte_->Remove(a, false);
  faoScene_.clear();
  for (const ObjetFao& o : L) {
    if (o.a.size() < 3) continue;
    occ::handle<ObjetSceneFao> a = new ObjetSceneFao(o);
    if (!o.profondeur) a->SetZLayer(Graphic3d_ZLayerId_Topmost);
    if (o.ancre) a->SetTransformPersistence(new Graphic3d_TransformPers(Graphic3d_TMF_ZoomPers, gp_Pnt(o.ax, o.ay, o.az)));
    contexte_->Display(a, 0, -1, false);
    contexte_->Deactivate(a);
    faoScene_.push_back(a);
  }
  vue_->ZFitAll();
  vue_->Redraw();
}

namespace {
// Le bout de parcours derrière l'outil : une couleur par point
class LigneSimFao : public AIS_InteractiveObject {
 public:
  explicit LigneSimFao(std::vector<float> v) : v_(std::move(v)) {}
  void Compute(const occ::handle<PrsMgr_PresentationManager>&, const occ::handle<Prs3d_Presentation>& prs, const int) override {
    const int n = static_cast<int>(v_.size() / 6);
    occ::handle<Graphic3d_ArrayOfPolylines> L = new Graphic3d_ArrayOfPolylines(n, 0, 0, true);
    for (int i = 0; i < n; i++) L->AddVertex(gp_Pnt(v_[6 * i], v_[6 * i + 1], v_[6 * i + 2]), Quantity_Color(v_[6 * i + 3], v_[6 * i + 4], v_[6 * i + 5], Quantity_TOC_sRGB));
    occ::handle<Graphic3d_Group> g = prs->CurrentGroup();
    g->SetGroupPrimitivesAspect(new Graphic3d_AspectLine3d(Quantity_NOC_WHITE, Aspect_TOL_SOLID, 1.5));
    g->AddPrimitiveArray(L);
  }
  void ComputeSelection(const occ::handle<SelectMgr_Selection>&, const int) override {}

 private:
  std::vector<float> v_;
};
gp_Trsf matriceEnTrsf(const double* m) {
  gp_Trsf t;
  t.SetValues(m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14]);
  return t;
}
}  // namespace

void Vue3D::simMatiere(const GrilleFao& g, const float* cols, size_t n, const double* racine) {
  simSansMatiere();
  simMatiere_ = new MatiereFao(g);
  simMatiere_->colonnes(cols, n);
  if (racine) simMatiere_->SetLocalTransformation(matriceEnTrsf(racine));
  contexte_->Display(simMatiere_, 0, -1, false);
  contexte_->Deactivate(simMatiere_);
  vue_->ZFitAll();
}

void Vue3D::simColonnes(const float* cols, size_t n) {
  if (!simMatiere_.IsNull()) simMatiere_->colonnes(cols, n);
}

void Vue3D::simSansMatiere() {
  if (simMatiere_.IsNull()) return;
  contexte_->Remove(simMatiere_, false);
  simMatiere_.Nullify();
}

void Vue3D::simOutil(const std::vector<ObjetFao>& fixes, const std::vector<ObjetFao>& tournants) {
  for (auto& a : simFixes_) contexte_->Remove(a, false);
  for (auto& a : simTournants_) contexte_->Remove(a, false);
  simFixes_.clear();
  simTournants_.clear();
  const auto poser = [&](const std::vector<ObjetFao>& L, std::vector<occ::handle<AIS_InteractiveObject>>& D) {
    for (const ObjetFao& o : L) {
      occ::handle<ObjetSceneFao> a = new ObjetSceneFao(o);
      contexte_->Display(a, 0, -1, false);
      contexte_->Deactivate(a);
      D.push_back(a);
    }
  };
  poser(fixes, simFixes_);
  poser(tournants, simTournants_);
}

void Vue3D::simPoseOutil(const double m[16], double angle) {
  const gp_Trsf t = matriceEnTrsf(m);
  gp_Trsf r;
  r.SetRotation(gp_Ax1(gp_Pnt(0, 0, 0), gp_Dir(0, 0, 1)), angle);
  for (auto& a : simFixes_) a->SetLocalTransformation(t);
  for (auto& a : simTournants_) a->SetLocalTransformation(t * r);
}

void Vue3D::simLigne(const std::vector<float>& v, const double* racine) {
  if (!simLigne_.IsNull()) contexte_->Remove(simLigne_, false);
  simLigne_.Nullify();
  if (v.size() < 12) return;
  simLigne_ = new LigneSimFao(v);
  if (racine) simLigne_->SetLocalTransformation(matriceEnTrsf(racine));
  contexte_->Display(simLigne_, 0, -1, false);
  contexte_->Deactivate(simLigne_);
}

// Les corps s'effacent pendant la lecture : la matière les remplace. Le reste de la scène FAO reste là.
void Vue3D::simMasquerPiece(bool oui) {
  if (oui == simPieceMasquee_) return;
  simPieceMasquee_ = oui;
  if (!oui) {
    for (auto& a : simCaches_) contexte_->Display(a, false);
    for (auto& a : simCaches_) contexte_->Deactivate(a);
    simCaches_.clear();
    return;
  }
  NCollection_List<occ::handle<AIS_InteractiveObject>> L;
  contexte_->DisplayedObjects(L);
  const auto garde = [&](const occ::handle<AIS_InteractiveObject>& a) {
    if (a == cube_ || a == simMatiere_ || a == simLigne_) return true;
    for (const auto* V : {&faoAis_, &faoScene_, &simFixes_, &simTournants_})
      for (const auto& x : *V)
        if (x == a) return true;
    return false;
  };
  for (NCollection_List<occ::handle<AIS_InteractiveObject>>::Iterator i(L); i.More(); i.Next())
    if (!garde(i.Value())) {
      simCaches_.push_back(i.Value());
      contexte_->Erase(i.Value(), false);
    }
}

void Vue3D::simFin() {
  simSansMatiere();
  simOutil({}, {});
  simLigne({}, nullptr);
  simMasquerPiece(false);
}

void Vue3D::simDessiner() {
  vue_->Invalidate();
  vue_->Redraw();
}

// floorMesh : le sol passe sous tout ce qui est plein, pièce active comprise
void Vue3D::refaireReflets() {
  for (occ::handle<AIS_Shape>& r : reflets_) contexte_->Remove(r, false);
  reflets_.clear();
  refletsVus_ = false;
  struct Un {
    TopoDS_Shape s;
    unsigned c;
    gp_Trsf t;
  };
  std::vector<Un> tous;
  if (!formePiece_.IsNull()) {
    if (teintesPiece_.empty()) tous.push_back({formePiece_, 0x0a84ff, gp_Trsf()});
    for (const auto& [s, c] : teintesPiece_) tous.push_back({s, c, gp_Trsf()});
  }
  Bnd_Box boite;
  if (!formePiece_.IsNull()) BRepBndLib::Add(formePiece_, boite, true);
  for (const OccAffichee& o : occs_) {
    if (o.v.fantome) continue;
    for (const auto& [s, c] : o.v.teintes) tous.push_back({s, c, o.v.t});
    Bnd_Box b;
    BRepBndLib::Add(o.v.forme, b, true);
    if (!b.IsVoid()) boite.Add(b.Transformed(o.v.t));
  }
  if (boite.IsVoid()) return;
  sol_ = boite.CornerMin().Z();
  gp_Trsf miroir;
  miroir.SetMirror(gp_Ax2(gp_Pnt(0, 0, sol_), gp_Dir(0, 0, 1)));
  const gp_Pnt bas = boite.CornerMin(), haut = boite.CornerMax();
  const gp_Pnt centre((bas.X() + haut.X()) / 2, (bas.Y() + haut.Y()) / 2, sol_);
  const double rayon = bas.Distance(haut) / 2;
  for (const Un& u : tous) {
    occ::handle<AIS_Shape> r = new AIS_Shape(u.s);
    r->Attributes()->SetAutoTriangulation(false);
    r->Attributes()->SetFaceBoundaryDraw(false);
    r->SetColor(couleurHex(u.c));
    r->Attributes()->ShadingAspect()->Aspect()->SetFaceCulling(Graphic3d_TypeOfBackfacingModel_DoubleSided);
    r->Attributes()->ShadingAspect()->Aspect()->SetShaderProgram(programmeReflet(couleurHex(u.c), couleurFond(), centre, rayon));
    r->SetLocalTransformation(miroir * u.t);
    reflets_.push_back(r);
  }
}

void Vue3D::choisirOccurrences(const std::set<std::string>& cles) {
  contexte_->ClearSelected(false);
  for (const OccAffichee& o : occs_)
    if (o.v.cliquable && cles.count(o.v.cle)) contexte_->AddOrRemoveSelected(o.piece, false);
  contexte_->UpdateCurrentViewer();
}

void Vue3D::surDouble(wxMouseEvent& e) {
  ignorerRelache_ = true;
  if (!placer_ || !surOccDouble) return;
  const wxPoint p = e.GetPosition();
  contexte_->MoveTo(p.x, p.y, vue_, false);
  if (contexte_->HasDetected())
    for (const OccAffichee& o : occs_)
      if (o.piece == contexte_->DetectedInteractive()) {
        const std::string c = o.v.cle;
        surOccDouble(c);
        return;
      }
}

// Combien de mm fait un pixel, à la profondeur de ce point
double Vue3D::echelleEn(const gp_Pnt& p) const {
  int x0, y0;
  vue_->Convert(p.X(), p.Y(), p.Z(), x0, y0);
  const occ::handle<Graphic3d_Camera>& c = vue_->Camera();
  const gp_Dir haut = c->Up();
  const double L = std::max(1e-6, c->Eye().Distance(p) * 0.05);
  int x1, y1;
  vue_->Convert(p.X() + haut.X() * L, p.Y() + haut.Y() * L, p.Z() + haut.Z() * L, x1, y1);
  const double px = std::hypot(double(x1 - x0), double(y1 - y0));
  return px > 1e-6 ? L / px : 1;
}

void Vue3D::rayon(int x, int y, gp_Pnt& o, gp_Dir& d) const {
  double X, Y, Z, Vx, Vy, Vz;
  vue_->ConvertWithProj(x, y, X, Y, Z, Vx, Vy, Vz);
  o = gp_Pnt(X, Y, Z);
  d = gp_Dir(Vx, Vy, Vz);
}

namespace {
// Une flèche ou un anneau d'une unité de long, autour de l'origine
TopoDS_Shape formeFleche() {
  BRep_Builder bb;
  TopoDS_Compound k;
  bb.MakeCompound(k);
  bb.Add(k, BRepBuilderAPI_MakeEdge(gp_Pnt(0, 0, 0), gp_Pnt(0, 0, 0.8)).Edge());
  bb.Add(k, BRepPrimAPI_MakeCone(gp_Ax2(gp_Pnt(0, 0, 0.8), gp_Dir(0, 0, 1)), 0.07, 0, 0.2).Shape());
  return k;
}
TopoDS_Shape formeAnneau() { return BRepBuilderAPI_MakeEdge(gp_Circ(gp_Ax2(gp_Pnt(0, 0, 0), gp_Dir(0, 0, 1)), 0.62)).Edge(); }
const int TAILLE_GIZMO = 110, TAILLE_TRIADE = 54, TAILLE_TRIADE_GRANDE = 78;
gp_Trsf poseAxe(const std::array<double, 3>& z) {
  gp_Trsf t;
  t.SetTransformation(gp_Ax3(gp_Pnt(0, 0, 0), gp_Dir(z[0], z[1], z[2])), gp_Ax3());
  return t;
}
}  // namespace

void Vue3D::poserGizmo(const Gizmo& g) {
  if (gizmoSaisi_ >= 0) return;
  for (auto& a : gizmoAis_) contexte_->Remove(a, false);
  gizmoAis_.clear();
  gizmo_ = g;
  if (g.actif) {
    const Quantity_Color C[3] = {couleur(0xff, 0x45, 0x3a), couleur(0x30, 0xd1, 0x58), couleur(0x0a, 0x84, 0xff)};
    static const TopoDS_Shape fl = formeFleche(), an = formeAnneau();
    for (int i = 0; i < 3; i++)
      for (int k = 0; k < 2; k++) {
        if (!(k ? g.anneau[i] : g.fleche[i])) continue;
        occ::handle<AIS_Shape> a = new AIS_Shape(k ? an : fl);
        a->SetColor(C[i]);
        a->SetWidth(2);
        a->SetInfiniteState(true);
        a->SetZLayer(Graphic3d_ZLayerId_Topmost);
        a->Attributes()->SetFaceBoundaryDraw(false);
        contexte_->Display(a, AIS_Shaded, -1, false);
        gizmoAis_.push_back(a);
      }
  }
  majTailles();
  vue_->Redraw();
}

void Vue3D::montrerInspection(const std::vector<TopoDS_Shape>& rouges, bool aCentre, const gp_Pnt& centre) {
  for (auto& a : inspectionAis_) contexte_->Remove(a, false);
  inspectionAis_.clear();
  const auto poser = [&](const TopoDS_Shape& s, const Quantity_Color& c, double tr) {
    BRepMesh_IncrementalMesh(s, 0.3, false, 0.3);
    occ::handle<AIS_Shape> a = new AIS_Shape(s);
    a->Attributes()->SetAutoTriangulation(false);
    a->SetColor(c);
    if (tr > 0) a->SetTransparency(tr);
    a->SetZLayer(Graphic3d_ZLayerId_Topmost);
    contexte_->Display(a, AIS_Shaded, -1, false);
    inspectionAis_.push_back(a);
  };
  for (const TopoDS_Shape& s : rouges) poser(s, couleurHex(0xff3b30), 0.15);
  if (aCentre) poser(BRepPrimAPI_MakeSphere(centre, 1.5).Shape(), couleurHex(0xffd60a), 0);
  vue_->Redraw();
}

void Vue3D::poserMarques(const std::vector<Marque>& L) {
  for (auto& a : marquesAis_) contexte_->Remove(a, false);
  marquesAis_.clear();
  marques_ = L;
  aligner_ = !L.empty();
  if (aligner_) {
    // Les faces se cliquent sur toutes les instances pleines du composant actif, la pièce comprise
    for (const OccAffichee& o : occs_)
      if (o.v.cliquable) {
        contexte_->Deactivate(o.piece);
        contexte_->Activate(o.piece, AIS_Shape::SelectionMode(TopAbs_FACE));
      }
    if (!affichee_.IsNull()) {
      contexte_->Load(affichee_, -1);
      contexte_->Activate(affichee_, AIS_Shape::SelectionMode(TopAbs_FACE));
      selectionPrete_ = false;
    }
  } else {
    if (placer_ && !affichee_.IsNull()) contexte_->Deactivate(affichee_);
    for (const OccAffichee& o : occs_)
      if (o.v.cliquable) {
        contexte_->Deactivate(o.piece);
        contexte_->Activate(o.piece, 0);
      }
  }
  for (const Marque& m : L) {
    const auto un = [&](const TopoDS_Shape& s, const Quantity_Color& c) {
      occ::handle<AIS_Shape> a = new AIS_Shape(s);
      a->SetColor(c);
      a->SetWidth(m.grand ? 3 : 2);
      a->SetInfiniteState(true);
      a->SetZLayer(Graphic3d_ZLayerId_Topmost);
      contexte_->Display(a, AIS_Shaded, -1, false);
      marquesAis_.push_back(a);
    };
    if (m.point) {
      un(BRepPrimAPI_MakeSphere(gp_Pnt(0, 0, 0), 1).Shape(), m.orange ? couleur(0xff, 0xb0, 0x20) : couleur(0x30, 0xd1, 0x58));
    } else {
      const auto ligne = [](const std::array<double, 3>& v) { return BRepBuilderAPI_MakeEdge(gp_Pnt(0, 0, 0), gp_Pnt(v[0], v[1], v[2])).Edge(); };
      un(ligne(m.x), couleur(0xff, 0x45, 0x3a));
      un(ligne(m.y), couleur(0x30, 0xd1, 0x58));
      un(ligne(m.z), couleur(0x0a, 0x84, 0xff));
    }
  }
  majTailles();
  vue_->Redraw();
}

// Le manipulateur et les marques gardent leur taille à l'écran
void Vue3D::majTailles() {
  size_t n = 0;
  if (gizmo_.actif) {
    const gp_Pnt O(gizmo_.o[0], gizmo_.o[1], gizmo_.o[2]);
    const double s = echelleEn(O) * FromDIP(TAILLE_GIZMO);
    for (int i = 0; i < 3; i++)
      for (int k = 0; k < 2; k++) {
        if (!(k ? gizmo_.anneau[i] : gizmo_.fleche[i]) || n >= gizmoAis_.size()) continue;
        gp_Trsf e, d;
        e.SetScale(gp_Pnt(0, 0, 0), s);
        d.SetTranslation(gp_Vec(O.XYZ()));
        contexte_->SetLocation(gizmoAis_[n++], TopLoc_Location(d * poseAxe(gizmo_.ax[i]).Inverted() * e));
      }
  }
  n = 0;
  for (const Marque& m : marques_) {
    const gp_Pnt O(m.o[0], m.o[1], m.o[2]);
    gp_Trsf e, d;
    d.SetTranslation(gp_Vec(O.XYZ()));
    if (m.point) {
      e.SetScale(gp_Pnt(0, 0, 0), echelleEn(O) * FromDIP(5));
      if (n < marquesAis_.size()) contexte_->SetLocation(marquesAis_[n++], TopLoc_Location(d * e));
    } else {
      e.SetScale(gp_Pnt(0, 0, 0), echelleEn(O) * FromDIP(m.grand ? TAILLE_TRIADE_GRANDE : TAILLE_TRIADE));
      for (int i = 0; i < 3 && n < marquesAis_.size(); i++) contexte_->SetLocation(marquesAis_[n++], TopLoc_Location(d * e));
    }
  }
}

int Vue3D::marqueSous(const wxPoint& p) const {
  int best = -1;
  double bd = FromDIP(12);
  for (size_t i = 0; i < marques_.size(); i++) {
    int x, y;
    vue_->Convert(marques_[i].o[0], marques_[i].o[1], marques_[i].o[2], x, y);
    const double d = std::hypot(double(x - p.x), double(y - p.y));
    if (d < bd) {
      bd = d;
      best = static_cast<int>(i);
    }
  }
  return best;
}

bool Vue3D::saisirGizmo(const wxPoint& p, wxMouseEvent& e) {
  if (!gizmo_.actif) return false;
  const gp_Pnt O(gizmo_.o[0], gizmo_.o[1], gizmo_.o[2]);
  const double s = echelleEn(O) * FromDIP(TAILLE_GIZMO);
  double bd = FromDIP(8);
  int best = -1;
  const auto dist = [&](const gp_Pnt& a, const gp_Pnt& b) {
    int ax, ay, bx, by;
    vue_->Convert(a.X(), a.Y(), a.Z(), ax, ay);
    vue_->Convert(b.X(), b.Y(), b.Z(), bx, by);
    const double dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const double t = l > 0 ? std::min(1.0, std::max(0.0, ((p.x - ax) * dx + (p.y - ay) * dy) / l)) : 0;
    return std::hypot(p.x - (ax + t * dx), p.y - (ay + t * dy));
  };
  for (int i = 0; i < 3; i++) {
    const gp_Dir z(gizmo_.ax[i][0], gizmo_.ax[i][1], gizmo_.ax[i][2]);
    if (gizmo_.fleche[i]) {
      const double d = dist(O.Translated(gp_Vec(z) * (0.1 * s)), O.Translated(gp_Vec(z) * s));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (gizmo_.anneau[i]) {
      const gp_Ax3 rep(O, z);
      const gp_Vec u(rep.XDirection()), v(rep.YDirection());
      gp_Pnt prec = O.Translated(u * (0.62 * s));
      for (int k = 1; k <= 48; k++) {
        const double t = 2 * 3.14159265358979 * k / 48;
        const gp_Pnt q = O.Translated(u * (0.62 * s * std::cos(t)) + v * (0.62 * s * std::sin(t)));
        const double d = dist(prec, q);
        if (d < bd) {
          bd = d;
          best = 3 + i;
        }
        prec = q;
      }
    }
  }
  if (best < 0) return false;
  (void)e;
  gizmoSaisi_ = best;
  gp_Pnt ro;
  gp_Dir rd;
  rayon(p.x, p.y, ro, rd);
  const int i = best % 3;
  const gp_Vec a(gizmo_.ax[i][0], gizmo_.ax[i][1], gizmo_.ax[i][2]);
  if (best < 3) {
    const gp_Vec w(O, ro);
    const double b = a.Dot(gp_Vec(rd)), d = a.Dot(w), ee = gp_Vec(rd).Dot(w), den = 1 - b * b;
    gizmoT0_ = std::abs(den) < 1e-9 ? 0 : (d - b * ee) / den;
  } else {
    const double den = a.Dot(gp_Vec(rd));
    const double t = std::abs(den) < 1e-9 ? 0 : a.Dot(gp_Vec(ro, O)) / den;
    gizmoP0_ = gp_Vec(O, ro.Translated(gp_Vec(rd) * t));
  }
  if (surGeste) surGeste(0, "", 0, "", 0, false);
  return true;
}

void Vue3D::bougerGizmo(const wxPoint& p, bool libre) {
  const gp_Pnt O(gizmo_.o[0], gizmo_.o[1], gizmo_.o[2]);
  gp_Pnt ro;
  gp_Dir rd;
  rayon(p.x, p.y, ro, rd);
  const int i = gizmoSaisi_ % 3;
  const gp_Vec a(gizmo_.ax[i][0], gizmo_.ax[i][1], gizmo_.ax[i][2]);
  double v;
  if (gizmoSaisi_ < 3) {
    const gp_Vec w(O, ro);
    const double b = a.Dot(gp_Vec(rd)), d = a.Dot(w), ee = gp_Vec(rd).Dot(w), den = 1 - b * b;
    if (std::abs(den) < 1e-9) return;
    v = (d - b * ee) / den - gizmoT0_;
    if (surGeste) surGeste(1, "move", i, gizmo_.degreFleche[i], v, libre);
  } else {
    const double den = a.Dot(gp_Vec(rd));
    if (std::abs(den) < 1e-9) return;
    const double t = a.Dot(gp_Vec(ro, O)) / den;
    const gp_Vec q(O, ro.Translated(gp_Vec(rd) * t));
    v = std::atan2(a.Dot(gizmoP0_.Crossed(q)), gizmoP0_.Dot(q)) * 180 / 3.14159265358979;
    if (surGeste) surGeste(1, "rot", i, gizmo_.degreAnneau[i], v, libre);
  }
}
