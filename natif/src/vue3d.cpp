#include "theme.h"
#include <BRepMesh_IncrementalMesh.hxx>
#include "vue3d.h"
#include <AIS_InteractiveObject.hxx>
#include <AIS_Point.hxx>
#include <IntCurvesFace_ShapeIntersector.hxx>
#include <gp_Lin.hxx>
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
#include <Graphic3d_Texture2D.hxx>
#include <Graphic3d_TextureParams.hxx>
#include <Graphic3d_ZLayerSettings.hxx>
#include <Poly_Triangulation.hxx>
#include <TopExp_Explorer.hxx>
#include <BRep_Tool.hxx>
#include <AIS_ColoredDrawer.hxx>
#include "rendu_moteur.h"
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

// highlightTris du navigateur : un voile de couleur sans éclairage (MeshBasicMaterial), la pièce reste visible dessous
void reglerStyle(const occ::handle<AIS_InteractiveContext>& c, Prs3d_TypeOfHighlight type, const Quantity_Color& teinte, float opacite) {
  const occ::handle<Prs3d_Drawer>& s = c->HighlightStyle(type);
  s->SetColor(teinte);
  s->SetDisplayMode(1);
  s->SetTransparency(1.0f - opacite);
  occ::handle<Prs3d_ShadingAspect> a = new Prs3d_ShadingAspect();
  a->SetColor(teinte);
  a->SetTransparency(1.0f - opacite);
  a->Aspect()->SetShadingModel(Graphic3d_TypeOfShadingModel_Unlit);
  s->SetShadingAspect(a);
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
THE_SHADER_OUT vec2 vEcran;
THE_SHADER_OUT vec3 vNormale;
void main() {
  vec4 p = occModelWorldMatrix * occVertex;
  vMonde = p.xyz;
  vNormale = (occModelWorldMatrixInverseTranspose * vec4(occNormal, 0.0)).xyz;
  gl_Position = occProjectionMatrix * occWorldViewMatrix * p;
  vEcran = gl_Position.yw;
}
)";
// Ce que le sol et le reflet partagent : tout est opaque, le fond est recalculé là où le sol s'efface (OCCT mélange ses objets translucides après tous les autres)
const char* const SOL_COMMUN = R"(
uniform vec3 uHaut;
uniform vec3 uBas;
uniform vec3 uFond;
uniform vec3 uCentre;
uniform float uRayon;
uniform float uDisque;
uniform vec4 uSolP;   // tuile ? ; sa taille ; force du reflet sur elle ; force du reflet
uniform vec4 uOmbre;  // force ; origine x, y ; côté
uniform sampler2D uTuile;
uniform sampler2D uOmbreT;
THE_SHADER_IN vec2 vEcran;
float gOmbre = 0.0;
float gSol = 0.0;
vec3 solEn(vec2 p) {
  vec3 fond = mix(uBas, uHaut, clamp(0.5 * vEcran.x / vEcran.y + 0.5, 0.0, 1.0));
  gSol = uDisque > 0.5 ? 1.0 - smoothstep(uRayon * 1.5, uRayon * 5.0, distance(vec3(p, uCentre.z), uCentre)) : 0.0;
  vec3 base = uSolP.x > 0.5 ? occTexture2D(uTuile, p / uSolP.y).rgb : uFond;
  vec3 c = mix(fond, base, gSol);
  if (uOmbre.x > 0.0) {
    vec2 uv = (p - uOmbre.yz) / uOmbre.w;
    if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) gOmbre = occTexture2D(uOmbreT, uv).r;
    c *= 1.0 - uOmbre.x * gOmbre;
  }
  return c;
}
)";
const char* const REFLET_PIXEL = R"(
uniform vec3 uCouleur;
uniform vec4 uCoupe;
uniform float uAvecCoupe;
THE_SHADER_IN vec3 vMonde;
THE_SHADER_IN vec3 vNormale;
void main() {
  if (uAvecCoupe > 0.5 && dot(uCoupe.xyz, vec3(vMonde.xy, 2.0 * uCentre.z - vMonde.z)) + uCoupe.w < 0.0) discard;
  vec3 oeil = occWorldViewMatrixInverse[3].xyz;
  float t = (uCentre.z - oeil.z) / (vMonde.z - oeil.z);
  vec3 s = oeil + (vMonde - oeil) * t;
  float d = distance(s, uCentre);
  float f = exp(-pow(d / max(uRayon * 1.15, 0.001), 2.0) * 2.0) * 0.85;
  vec3 n = normalize(vNormale);
  n.z = -n.z;
  float ciel = mix(0.2, 0.75, (n.z + 1.0) * 0.5);
  float cle = max(dot(n, normalize(vec3(60.0, -40.0, 120.0))), 0.0);
  // Le navigateur mélange le reflet, en lumière brute, avec la couleur du sol telle qu'elle s'affiche : c'est ce qui le rend sombre
  // La part neutre tient lieu des reflets du studio, que le reflet du navigateur contient aussi ; réglée sur ses couleurs mesurées
  vec3 reflet = (min(uCouleur * (ciel + cle), vec3(1.0)) * 0.45 + vec3(0.07)) * uSolP.w;
  vec3 ecran = mix(pow(solEn(s.xy), vec3(1.0 / 2.2)), reflet, clamp(f * uSolP.z, 0.0, 0.85));
  occSetFragColor(vec4(pow(ecran, vec3(2.2)), 1.0));
}
)";
const char* const DISQUE_PIXEL = R"(
THE_SHADER_IN vec3 vMonde;
THE_SHADER_IN vec3 vNormale;
void main() {
  vec3 c = solEn(vMonde.xy);
  if (gSol <= 0.0 && gOmbre <= 0.0) discard;
  occSetFragColor(vec4(c, 1.0));
}
)";

// Réglés sur les couleurs mesurées du navigateur (Perçages, Studio et Atelier) ; OCCT n'a pas ses tons ACES
const double FORCE_CIEL = 0.8, FORCE_CLE = 1.0, FORCE_HEMI = 2.0;
// Rendu léger : métal et rugosité du matériau, vernis approché par la rugosité (vEnvApply)
Graphic3d_MaterialAspect matiereVue(const std::string& cle) {
  Graphic3d_MaterialAspect m(Graphic3d_NameOfMaterial_Plastified);
  Graphic3d_PBRMaterial p;
  const MatiereRendu* d = matiereRendu(cle);
  double metal = 0.15, rug = 0.42;
  if (d && d->transmission > 0) metal = 0, rug = d->rugosite;
  else if (d) metal = d->metal, rug = d->vernis > 0 ? d->rugosite + (d->vernisRugosite - d->rugosite) * d->vernis * 0.5 : d->rugosite;
  p.SetMetallic(static_cast<float>(metal));
  p.SetRoughness(static_cast<float>(std::max(rug, 0.05)));
  m.SetPBRMaterial(p);
  return m;
}

void pousserSol(const occ::handle<Graphic3d_ShaderProgram>& p, const ParamSol& P) {
  const auto f = [](double v) { return static_cast<float>(v); };
  const auto v3 = [&](const Quantity_Color& c) { return NCollection_Vec3<float>(f(c.Red()), f(c.Green()), f(c.Blue())); };
  p->PushVariableVec3("uHaut", v3(P.haut));
  p->PushVariableVec3("uBas", v3(P.bas));
  p->PushVariableVec3("uFond", v3(P.fond));
  p->PushVariableVec3("uCentre", NCollection_Vec3<float>(f(P.centre.X()), f(P.centre.Y()), f(P.centre.Z())));
  p->PushVariableFloat("uRayon", f(P.rayon));
  p->PushVariableFloat("uDisque", P.disque ? 1.0f : 0.0f);
  p->PushVariableVec4("uSolP", NCollection_Vec4<float>(P.tuile ? 1.0f : 0.0f, f(P.tuileT), f(P.tuileK), f(P.refletK)));
  p->PushVariableVec4("uOmbre", NCollection_Vec4<float>(f(P.ombreK), f(P.ombreO[0]), f(P.ombreO[1]), f(P.ombreT)));
  p->PushVariableInt("uTuile", 0);
  p->PushVariableInt("uOmbreT", 1);
}
occ::handle<Graphic3d_ShaderProgram> programmeReflet(const Quantity_Color& c, const ParamSol& P) {
  occ::handle<Graphic3d_ShaderProgram> p = new Graphic3d_ShaderProgram();
  p->AttachShader(Graphic3d_ShaderObject::CreateFromSource(Graphic3d_TOS_VERTEX, REFLET_SOMMET));
  p->AttachShader(Graphic3d_ShaderObject::CreateFromSource(Graphic3d_TOS_FRAGMENT, TCollection_AsciiString(SOL_COMMUN) + REFLET_PIXEL));
  p->PushVariableVec3("uCouleur", NCollection_Vec3<float>(float(c.Red()), float(c.Green()), float(c.Blue())));
  pousserSol(p, P);
  p->PushVariableVec4("uCoupe", NCollection_Vec4<float>(float(P.cn[0]), float(P.cn[1]), float(P.cn[2]), float(P.cd)));
  p->PushVariableFloat("uAvecCoupe", P.coupe ? 1.0f : 0.0f);
  return p;
}
occ::handle<Graphic3d_ShaderProgram> programmeDisque(const ParamSol& P) {
  occ::handle<Graphic3d_ShaderProgram> p = new Graphic3d_ShaderProgram();
  p->AttachShader(Graphic3d_ShaderObject::CreateFromSource(Graphic3d_TOS_VERTEX, REFLET_SOMMET));
  p->AttachShader(Graphic3d_ShaderObject::CreateFromSource(Graphic3d_TOS_FRAGMENT, TCollection_AsciiString(SOL_COMMUN) + DISQUE_PIXEL));
  pousserSol(p, P);
  return p;
}

Quantity_Color couleurFond() {
  const wxColour c = th(wxColour(0x13, 0x15, 0x19));
  return couleur(c.Red(), c.Green(), c.Blue());
}  // le fond tel qu'il apparaît dans le navigateur, sol compris

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
  lumAmbiante_ = new V3d_AmbientLight();
  lumAmbiante_->SetIntensity(2.0f);
  visu_->AddLight(lumAmbiante_);
  lumCle_ = new V3d_DirectionalLight(gp_Dir(-60, 40, -120));
  lumCle_->SetIntensity(7.5f);
  visu_->AddLight(lumCle_);
  lumCiel_ = new V3d_DirectionalLight(gp_Dir(0, 0, -1));
  lumCiel_->SetIntensity(3.0f);
  visu_->AddLight(lumCiel_);
  visu_->SetLightOn();
  vue_ = visu_->CreateView();
  vue_->SetWindow(new WNT_Window(reinterpret_cast<Aspect_Handle>(GetHWND())));
  Graphic3d_RenderingParams& rendu = vue_->ChangeRenderingParams();
  rendu.NbMsaaSamples = 4;  // bords lissés, comme antialias:true ; 8 coûterait 40 Mo de plus sans gain visible
  rendu.PbrEnvPow2Size = 8;  // des reflets doux n'ont pas besoin de plus
  vue_->SetShadingModel(Graphic3d_TypeOfShadingModel_Pbr);
  // Le studio ne sert qu'aux reflets : le fond reste uni
  cubeStudio_ = environnementStudio();
  vue_->SetBackgroundCubeMap(cubeStudio_, true);
  vue_->View()->SetBackgroundType(Graphic3d_TOB_NONE);
  vue_->SetBackgroundColor(couleurFond());
  // Perspective à 50°, le réglage de départ du navigateur
  vue_->Camera()->SetProjectionType(Graphic3d_Camera::Projection_Perspective);
  vue_->Camera()->SetFOVy(50);
  vue_->SetProj(V3d_XposYnegZpos);
  contexte_ = new AIS_InteractiveContext(visu_);
  {
    // Le sol se dessine avant tout le reste et n'écrit pas dans la profondeur : le reflet, dessous, reste visible
    Graphic3d_ZLayerId couche = Graphic3d_ZLayerId_UNKNOWN;
    Graphic3d_ZLayerSettings r;
    r.SetEnableDepthWrite(false);
    r.SetEnableDepthTest(true);
    if (visu_->InsertLayerBefore(couche, r, Graphic3d_ZLayerId_Default)) coucheSol_ = couche;
    else coucheSol_ = Graphic3d_ZLayerId_Default;
  }
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
  // hoverMove : face survolée bleue à 35 % ; faceSelect : face choisie orange à 55 %
  reglerStyle(contexte_, Prs3d_TypeOfHighlight_LocalDynamic, couleur(0x0a, 0x84, 0xff), 0.35f);
  reglerStyle(contexte_, Prs3d_TypeOfHighlight_LocalSelected, couleur(0xff, 0x9f, 0x0a), 0.55f);
  reglerStyle(contexte_, Prs3d_TypeOfHighlight_Dynamic, couleur(0x0a, 0x84, 0xff), 0.35f);
  reglerStyle(contexte_, Prs3d_TypeOfHighlight_Selected, couleur(0x0a, 0x84, 0xff), 0.55f);  // ASM_SEL_COL

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
  minuterieOrbite_.SetOwner(this);
  Bind(wxEVT_TIMER, &Vue3D::surTicOrbite, this, minuterieOrbite_.GetId());
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

    msAffichage_ = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - debut).count();
  }
  transparencesPiece_ = transparences;
  majMatieres();
  if (!disque_.IsNull()) contexte_->Erase(disque_, false);
  if (ajusterVue) vue_->FitAll(MARGE_VUE, false);
  refaireReflets();
  majAretes();
  majCoupe();
  majReflets();
  vue_->ZFitAll();
  vue_->Redraw();
}

// Le reflet n'existe que vu de dessus : comme le navigateur, plus rien quand l'œil passe sous le sol
void Vue3D::majReflets() {
  const bool dessus = vue_->Camera()->Eye().Z() > sol_;
  if (!disque_.IsNull()) {
    const bool vu = contexte_->IsDisplayed(disque_);
    if (dessus != vu) {
      if (dessus) contexte_->Display(disque_, AIS_Shaded, -1, false);
      else contexte_->Erase(disque_, false);
    }
  }
  const bool voir = !reflets_.empty() && dessus;
  if (voir == refletsVus_) return;
  refletsVus_ = voir;
  for (occ::handle<AIS_Shape>& r : reflets_) {
    if (voir) contexte_->Display(r, AIS_Shaded, -1, false);
    else contexte_->Erase(r, false);
  }
}

std::array<double, 3> Vue3D::oeil() const {
  const gp_Pnt p = vue_->Camera()->Eye();
  return {p.X(), p.Y(), p.Z()};
}
std::array<double, 3> Vue3D::cibleVue() const {
  const gp_Pnt p = vue_->Camera()->Center();
  return {p.X(), p.Y(), p.Z()};
}

bool Vue3D::directionCamera(std::array<double, 3>& d) const {
  if (vue_.IsNull()) return false;
  const gp_Pnt o = vue_->Camera()->Eye(), c = vue_->Camera()->Center();
  const double x = o.X() - c.X(), y = o.Y() - c.Y(), z = o.Z() - c.Z(), L = std::sqrt(x * x + y * y + z * z);
  if (L < 1e-9) return false;
  d = {x / L, y / L, z / L};
  return true;
}
namespace {
// Les pièces retournées, sans lumière : le rouge de chaque point dit combien son reflet reste visible
class FonduReflet : public AIS_InteractiveObject {
 public:
  DEFINE_STANDARD_RTTI_INLINE(FonduReflet, AIS_InteractiveObject)
  FonduReflet(const TopoDS_Shape& forme, double zBas, double fondu) : forme_(forme), zBas_(zBas), fondu_(fondu) {}
  bool AcceptDisplayMode(const int m) const override { return m == 1; }

 protected:
  void Compute(const occ::handle<PrsMgr_PresentationManager>&, const occ::handle<Prs3d_Presentation>& prs, const int) override {
    prs->Clear();
    int nb = 0;
    for (TopExp_Explorer x(forme_, TopAbs_FACE); x.More(); x.Next()) {
      TopLoc_Location loc;
      const occ::handle<Poly_Triangulation> T = BRep_Tool::Triangulation(TopoDS::Face(x.Current()), loc);
      if (!T.IsNull()) nb += T->NbTriangles() * 3;
    }
    if (!nb) return;
    occ::handle<Graphic3d_ArrayOfTriangles> tri = new Graphic3d_ArrayOfTriangles(nb, 0, Graphic3d_ArrayFlags_VertexColor);
    for (TopExp_Explorer x(forme_, TopAbs_FACE); x.More(); x.Next()) {
      TopLoc_Location loc;
      const occ::handle<Poly_Triangulation> T = BRep_Tool::Triangulation(TopoDS::Face(x.Current()), loc);
      if (T.IsNull()) continue;
      const gp_Trsf tr = loc.Transformation();
      for (int t = 1; t <= T->NbTriangles(); t++) {
        int n[3];
        T->Triangle(t).Get(n[0], n[1], n[2]);
        for (const int i : n) {
          gp_Pnt p = T->Node(i).Transformed(tr);
          p.SetZ(2 * zBas_ - p.Z());
          const double k = std::max(0.0, std::min(1.0, (zBas_ - p.Z()) / fondu_)), f = 0.5 * (1 - k) * (1 - k);
          tri->AddVertex(p, Quantity_Color(static_cast<float>(f), 0.f, 0.f, Quantity_TOC_RGB));
        }
      }
    }
    occ::handle<Graphic3d_AspectFillArea3d> asp = new Graphic3d_AspectFillArea3d();
    asp->SetInteriorStyle(Aspect_IS_SOLID);
    asp->SetShadingModel(Graphic3d_TypeOfShadingModel_Unlit);
    asp->SetInteriorColor(Quantity_NOC_WHITE);
    asp->SetFaceCulling(Graphic3d_TypeOfBackfacingModel_DoubleSided);
    const occ::handle<Graphic3d_Group> gr = prs->NewGroup();
    gr->SetGroupPrimitivesAspect(asp);
    gr->AddPrimitiveArray(tri);
  }
  void ComputeSelection(const occ::handle<SelectMgr_Selection>&, const int) override {}

 private:
  TopoDS_Shape forme_;
  double zBas_, fondu_;
};
}  // namespace

bool Vue3D::imagePlan(const plan::DemandeImage& d, wxImage& sortie, const OptionsVue* reel, const std::vector<ApparenceVue>* apparences) {
  if (vueImage_.IsNull()) {
    // Un second visualiseur, sans sol, cube ni arêtes : même pilote, mêmes lumières et même matière que la vue 3D
    visuImage_ = new V3d_Viewer(pilote_);
    imageAmbiante_ = new V3d_AmbientLight();
    imageAmbiante_->SetIntensity(2.0f);
    visuImage_->AddLight(imageAmbiante_);
    imageCle_ = new V3d_DirectionalLight(gp_Dir(-60, 40, -120));
    imageCle_->SetIntensity(7.5f);
    visuImage_->AddLight(imageCle_);
    imageCiel_ = new V3d_DirectionalLight(gp_Dir(0, 0, -1));
    imageCiel_->SetIntensity(3.0f);
    visuImage_->AddLight(imageCiel_);
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
  {
    // « Rendu réaliste » : le ciel et les lampes du Rendu direct, le temps de cette image
    const bool rd = d.reel && reel;
    const std::string sig = rd ? reel->amb + "|" + std::to_string(reel->rot) + "|" + std::to_string(reel->force) + "|" + std::to_string(reinterpret_cast<uintptr_t>(reel->hdri.get())) : std::string("cao");
    if (sig != imageSigActif_) {
      imageSigActif_ = sig;
      if (rd) {
        std::array<double, 2> k{};
        vueImage_->SetBackgroundCubeMap(cubeVue(reel->amb, reel->hdri.get(), reel->rot * M_PI / 180, FORCE_HEMI, k), true);
        imageAmbiante_->SetIntensity(static_cast<float>(ECH_CUBE * reel->force * FORCE_CIEL));
        imageCle_->SetIntensity(static_cast<float>(FORCE_CLE));
        imageCiel_->SetIntensity(0.0f);
      } else {
        vueImage_->SetBackgroundCubeMap(environnementStudio(), true);
        imageAmbiante_->SetIntensity(2.0f);
        imageCle_->SetIntensity(7.5f);
        imageCiel_->SetIntensity(3.0f);
      }
      vueImage_->View()->SetBackgroundType(Graphic3d_TOB_NONE);
      vueImage_->SetBackgroundColor(Quantity_NOC_BLACK);
    }
  }
  std::vector<occ::handle<AIS_InteractiveObject>> poses;
  for (const plan::DemandeImage::Teinte& c : d.corps) {
    // Construit comme la pièce de la vue 3D : la teinte est la même
    occ::handle<AIS_ColoredShape> a = new AIS_ColoredShape(c.forme);
    a->Attributes()->SetAutoTriangulation(false);
    a->SetColor(couleurHex(0x0a84ff));
    const ApparenceVue* look = nullptr;
    if (d.reel && reel && apparences)
      for (const ApparenceVue& q : *apparences)
        if (q.forme.IsSame(c.forme)) look = &q;
    const unsigned teinte = look ? look->couleur : c.couleur;
    a->SetCustomColor(c.forme, couleurHex(teinte));
    if (d.reel && reel) {
      const Graphic3d_MaterialAspect mat = matiereVue(look ? look->cle : std::string());
      a->SetMaterial(mat);
      a->CustomAspects(c.forme)->ShadingAspect()->SetMaterial(mat);
      a->CustomAspects(c.forme)->ShadingAspect()->SetColor(couleurHex(teinte));
    } else a->SetMaterial(matierePiece());
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
  Image_AlienPixMap surNoir, surBlanc, refletNoir, refletBlanc;
  Image_AlienPixMap fondus;
  bool ok = false;
  bool avecReflet = false;
  try {
    o.BufferType = Graphic3d_BT_RGB;
    vueImage_->SetBackgroundColor(Quantity_NOC_BLACK);
    ok = vueImage_->ToPixMap(surNoir, o);
    vueImage_->SetBackgroundColor(Quantity_NOC_WHITE);
    ok = ok && vueImage_->ToPixMap(surBlanc, o);
    if (ok && d.miroir) {
      // Le reflet : les mêmes pièces retournées autour du point le plus bas (les filets ne se reflètent pas,
      // comme dans le navigateur). Une dernière image, sans lumière, donne le fondu de chaque point
      gp_Trsf retourne;
      retourne.SetMirror(gp_Ax2(gp_Pnt(0, 0, d.zBas), gp_Dir(0, 0, 1)));
      for (size_t i = 0; i < poses.size(); i++) {
        if (i < d.corps.size()) poses[i]->SetLocalTransformation(retourne);
        else contexteImage_->Erase(poses[i], false);
      }
      vueImage_->ZFitAll();
      vueImage_->SetBackgroundColor(Quantity_NOC_BLACK);
      avecReflet = vueImage_->ToPixMap(refletNoir, o);
      vueImage_->SetBackgroundColor(Quantity_NOC_WHITE);
      avecReflet = avecReflet && vueImage_->ToPixMap(refletBlanc, o);
      if (avecReflet) {
        for (size_t i = 0; i < d.corps.size() && i < poses.size(); i++) contexteImage_->Erase(poses[i], false);
        std::vector<occ::handle<AIS_InteractiveObject>> masques;
        for (const plan::DemandeImage::Teinte& c : d.corps) {
          occ::handle<AIS_InteractiveObject> m = new FonduReflet(c.forme, d.zBas, d.fondu);
          contexteImage_->Display(m, 1, -1, false);
          masques.push_back(m);
        }
        vueImage_->SetBackgroundColor(Quantity_NOC_BLACK);
        avecReflet = vueImage_->ToPixMap(fondus, o);
        for (const occ::handle<AIS_InteractiveObject>& m : masques) contexteImage_->Remove(m, false);
      }
    }
  } catch (const Standard_Failure&) {
    ok = false;
  }
  for (const occ::handle<AIS_InteractiveObject>& a : poses) contexteImage_->Remove(a, false);
  if (!ok || surNoir.Width() != surBlanc.Width() || surNoir.Height() != surBlanc.Height()) return false;
  if (avecReflet && (refletNoir.Width() != surNoir.Width() || refletNoir.Height() != surNoir.Height() || fondus.Width() != surNoir.Width() || fondus.Height() != surNoir.Height())) avecReflet = false;
  wxImage im(static_cast<int>(surNoir.Width()), static_cast<int>(surNoir.Height()), false);
  im.SetAlpha();
  for (int y = 0; y < im.GetHeight(); y++)
    for (int x = 0; x < im.GetWidth(); x++) {
      const Quantity_Color n = surNoir.PixelColor(x, y, false).GetRGB(), b = surBlanc.PixelColor(x, y, false).GetRGB();
      double a = std::max(0.0, std::min(1.0, 1 - ((b.Red() - n.Red()) + (b.Green() - n.Green()) + (b.Blue() - n.Blue())) / 3));
      double nr = n.Red(), nv = n.Green(), nb = n.Blue();
      if (avecReflet && a < 0.999) {
        const Quantity_Color rn = refletNoir.PixelColor(x, y, false).GetRGB(), rb = refletBlanc.PixelColor(x, y, false).GetRGB();
        const double ar = std::max(0.0, std::min(1.0, 1 - ((rb.Red() - rn.Red()) + (rb.Green() - rn.Green()) + (rb.Blue() - rn.Blue())) / 3));
        if (ar > 0) {
          const double f = fondus.PixelColor(x, y, true).GetRGB().Red();
          nr += (1 - a) * rn.Red() * f, nv += (1 - a) * rn.Green() * f, nb += (1 - a) * rn.Blue() * f;
          a += (1 - a) * ar * f;
        }
      }
      const auto oct = [&](double v) { return static_cast<unsigned char>(std::max(0.0, std::min(255.0, std::round((a > 0 ? v / a : 0) * 255)))); };
      im.SetRGB(x, y, oct(nr), oct(nv), oct(nb));
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
  // Le sol ne compte pas dans « tout afficher »
  if (!disque_.IsNull()) contexte_->Erase(disque_, false);
  vue_->FitAll(MARGE_VUE, false);
  majReflets();
  vue_->ZFitAll();
  majTailles();
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
  if (!e.RightDown()) {
    arreterOrbite();
    vue_->StartRotation(depart_.x, depart_.y);
    pivot_ = pointPivot(depart_);
    orbiteTenue_ = true;
  }
}

gp_Pnt Vue3D::pointPivot(const wxPoint& p) {
  if (!simMatiere_.IsNull() && contexte_->IsDisplayed(simMatiere_)) {
    gp_Pnt o;
    gp_Dir d;
    rayon(p.x, p.y, o, d);
    double px, py, pz;
    vue_->Proj(px, py, pz);  // comme cliquerEn : le rayon part vers la scène
    if (d.X() * px + d.Y() * py + d.Z() * pz > 0) d.Reverse();
    o.Translate(gp_Vec(d) * -1e5);  // origine loin derrière : rien de la matière n'est manqué
    // viewHitAt (V0.69.2) : d'abord les faces de la pièce, même masquée et sous la matière pas encore enlevée
    {
      double meilleur = 1e300;
      gp_Pnt vise;
      for (const auto& a : simCaches_) {
        const occ::handle<AIS_Shape> s = occ::down_cast<AIS_Shape>(a);
        if (s.IsNull() || s->Shape().IsNull()) continue;
        const gp_Trsf Ts = s->LocalTransformation(), Tsi = Ts.Inverted();
        IntCurvesFace_ShapeIntersector X;
        X.Load(s->Shape(), 1e-6);
        X.Perform(gp_Lin(o.Transformed(Tsi), d.Transformed(Tsi)), -RealLast(), RealLast());
        if (!X.IsDone()) continue;
        for (int i = 1; i <= X.NbPnt(); i++)
          if (X.WParameter(i) < meilleur) {
            meilleur = X.WParameter(i);
            vise = X.Pnt(i).Transformed(Ts);
          }
      }
      if (meilleur < 1e299) return vise;
    }
    if (simCaches_.empty()) {  // pièce encore affichée : la détection ordinaire la trouve
      contexte_->MoveTo(p.x, p.y, vue_, false);
      if (contexte_->HasDetected() && contexte_->HasDetectedShape() && contexte_->MainSelector()->NbPicked() > 0)
        return contexte_->MainSelector()->PickedPoint(1);
    }
    const gp_Trsf T = simMatiere_->LocalTransformation(), Ti = T.Inverted();
    gp_Pnt q;
    if (simMatiere_->viser(o.Transformed(Ti), d.Transformed(Ti), q)) return q.Transformed(T);
    return simMatiere_->centre().Transformed(T);
  }
  if (!placer_) preparerSelection();
  contexte_->MoveTo(p.x, p.y, vue_, false);
  if (contexte_->HasDetected() && occ::down_cast<AIS_ViewCubeOwner>(contexte_->DetectedOwner()).IsNull() && contexte_->MainSelector()->NbPicked() > 0)
    return contexte_->MainSelector()->PickedPoint(1);
  return vue_->GravityPoint();
}

void Vue3D::essaiOrbite3D(int x, int y, int dx, int dy, double r[7]) {
  depart_ = precedent_ = wxPoint(x, y);
  aBouge_ = false;
  vue_->StartRotation(x, y);
  pivot_ = pointPivot(depart_);
  const wxPoint a = ecranDe(pivot_);
  tourner(dx, dy);
  const wxPoint b = ecranDe(pivot_);
  cacherPivot();
  const double v[7] = {pivot_.X(), pivot_.Y(), pivot_.Z(), double(a.x), double(a.y), double(b.x), double(b.y)};
  for (int i = 0; i < 7; i++) r[i] = v[i];
}

void Vue3D::cacherPivot() {
  if (marquePivot_.IsNull()) return;
  contexte_->Remove(marquePivot_, false);
  marquePivot_.Nullify();
  vue_->Redraw();
}

void Vue3D::surRelache(wxMouseEvent& e) {
  if (HasCapture()) ReleaseMouse();
  orbiteTenue_ = false;
  if (!minuterieOrbite_.IsRunning()) cacherPivot();
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
  if (e.RightUp() && e.ControlDown() && !placer_) return recentrerEn(e.GetPosition());
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

// recenter : le point visé devient le centre de la vue, la direction ne change pas
void Vue3D::recentrerEn(const wxPoint& p) {
  CoupVue c;
  if (!coupMesure(p, c)) return;
  const occ::handle<Graphic3d_Camera> k = vue_->Camera();
  const gp_XYZ ecart = k->Eye().XYZ() - k->Center().XYZ();
  k->SetCenter(c.p);
  k->SetEye(gp_Pnt(c.p.XYZ() + ecart));
  vue_->Redraw();
  Refresh();
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
      if (!disque_.IsNull()) contexte_->Erase(disque_, false);
      vue_->FitAll(MARGE_VUE, false);
      majReflets();
      vue_->ZFitAll();
      vue_->Redraw();
      return;
    }
  }
  // La mesure passe avant toute commande : Ctrl ne sélectionne ni n'active rien (ctrlMesureEv)
  const bool ctrl = essaiCtrl >= 0 ? essaiCtrl != 0 : wxGetKeyState(WXK_CONTROL), maj = essaiMaj >= 0 ? essaiMaj != 0 : wxGetKeyState(WXK_SHIFT);
  if (surZone && !ctrl && surZone(p, true)) return;
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
void Vue3D::montrerFiletsAutres(const std::vector<std::vector<gp_Pnt>>& helices, const std::vector<std::vector<gp_Pnt>>& anneaux) {
  retirer(contexte_, filetsAutresH_);
  retirer(contexte_, filetsAutresA_);
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
  if (!helices.empty()) filetsAutresH_ = trait(contexte_, compose(helices), couleur(0xff, 0xb3, 0x40), 1.0);
  if (!anneaux.empty()) {
    filetsAutresA_ = new AIS_Shape(compose(anneaux));
    filetsAutresA_->Attributes()->SetAutoTriangulation(false);
    filetsAutresA_->SetColor(couleur(0xff, 0xb3, 0x40));
    filetsAutresA_->Attributes()->SetWireAspect(new Prs3d_LineAspect(couleur(0xff, 0xb3, 0x40), Aspect_TOL_DASH, 1.0));
    contexte_->Display(filetsAutresA_, AIS_WireFrame, -1, false);
  }
  vue_->Redraw();
}

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

wxPoint Vue3D::ecranDe(const gp_Pnt& p) const {
  int x = 0, y = 0;
  vue_->Convert(p.X(), p.Y(), p.Z(), x, y);
  return wxPoint(x, y);
}

void Vue3D::montrerZones(const std::vector<ZoneVue>& L) {
  for (auto& a : zonesVue_) contexte_->Remove(a, false);
  zonesVue_.clear();
  const auto fil = [](const std::vector<gp_Pnt>& r) {
    BRepBuilderAPI_MakePolygon p;
    for (const gp_Pnt& q : r) p.Add(q);
    p.Close();
    return p.Wire();
  };
  for (const ZoneVue& z : L) {
    if (z.anneaux.empty()) continue;
    try {
      const gp_Pln pln(gp_Ax3(z.o, gp_Dir(z.u.XYZ().Crossed(z.v.XYZ())), z.u));
      BRepBuilderAPI_MakeFace mf(pln, fil(z.anneaux[0]), true);
      for (size_t k = 1; k < z.anneaux.size(); k++) mf.Add(fil(z.anneaux[k]));
      if (!mf.IsDone()) continue;
      const Quantity_Color fond = z.choisie ? couleur(0x0a, 0x84, 0xff) : couleur(0x64, 0xd2, 0xff);
      occ::handle<AIS_Shape> a = new AIS_Shape(mf.Face());
      a->SetColor(fond);
      a->SetTransparency(1 - (z.choisie ? (z.survol ? 0.6 : 0.42) : (z.survol ? 0.32 : 0.08)));
      a->Attributes()->ShadingAspect()->Aspect()->SetShadingModel(Graphic3d_TypeOfShadingModel_Unlit);
      a->SetZLayer(Graphic3d_ZLayerId_Topmost);
      contexte_->Display(a, AIS_Shaded, -1, false);
      zonesVue_.push_back(a);
      BRep_Builder bb;
      TopoDS_Compound c;
      bb.MakeCompound(c);
      for (const auto& r : z.anneaux) bb.Add(c, fil(r));
      occ::handle<AIS_Shape> t = trait(contexte_, c, z.choisie ? couleur(0x64, 0xd2, 0xff) : couleur(0x8e, 0x8e, 0x93), 1.0);
      contexte_->SetZLayer(t, Graphic3d_ZLayerId_Topmost);
      zonesVue_.push_back(t);
    } catch (const Standard_Failure&) {
    }
  }
  vue_->Redraw();
}

// sk3dTraits : ce qu'un solide cache reste dessiné plus fin, ce qui est vu est plein. La passe « cachée » a sa propre profondeur (Topmost), la passe « vue » celle de la scène.
void Vue3D::montrerEsquisses(const std::vector<std::vector<gp_Pnt>>& forts, const std::vector<std::vector<gp_Pnt>>& aides, const std::vector<std::vector<gp_Pnt>>& axes, const Quantity_Color& couleurForts) {
  for (auto& a : traitsEsquisses_) contexte_->Remove(a, false);
  traitsEsquisses_.clear();
  const auto passe = [&](const TopoDS_Shape& c, const Quantity_Color& coul, double larg, int tiret, bool cache) {
    occ::handle<AIS_Shape> a = new AIS_Shape(c);
    a->Attributes()->SetAutoTriangulation(false);
    a->SetColor(coul);
    occ::handle<Prs3d_LineAspect> asp = new Prs3d_LineAspect(coul, tiret ? Aspect_TOL_DASH : Aspect_TOL_SOLID, larg);
    if (tiret == 2) asp->Aspect()->SetLinePattern(0xFFF0), asp->Aspect()->SetLineStippleFactor(2);
    a->Attributes()->SetWireAspect(asp);
    a->Attributes()->SetFreeBoundaryAspect(asp);
    a->Attributes()->SetUnFreeBoundaryAspect(asp);
    if (cache) a->SetZLayer(Graphic3d_ZLayerId_Topmost);
    contexte_->Display(a, AIS_WireFrame, -1, false);
    traitsEsquisses_.push_back(a);
  };
  const auto style = [&](const std::vector<std::vector<gp_Pnt>>& L, const Quantity_Color& coul, double vu, double cache, int tiret) {
    BRep_Builder bb;
    TopoDS_Compound c;
    bb.MakeCompound(c);
    bool plein = false;
    for (const auto& l : L) {
      BRepBuilderAPI_MakePolygon p;
      gp_Pnt der;
      bool premier = true;
      int n = 0;
      for (const gp_Pnt& q : l) {
        if (!premier && q.Distance(der) < 1e-7) continue;
        p.Add(q);
        der = q;
        premier = false;
        n++;
      }
      if (n >= 2 && p.IsDone()) bb.Add(c, p.Wire()), plein = true;
    }
    if (!plein) return;
    passe(c, coul, cache, tiret, true);
    passe(c, coul, vu, tiret, false);
  };
  style(forts, couleurForts, 3, 2, 0);
  style(aides, couleur(0xff, 0xd6, 0x0a), 2, 1.5, 1);
  style(axes, couleur(0xff, 0x9f, 0x0a), 2, 1.5, 2);
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
    majAretes();
  }
  vue_->Redraw();
}

void Vue3D::surMouvement(wxMouseEvent& e) {
  const wxPoint p = e.GetPosition();
  if (gizmoSaisi_ >= 0) return bougerGizmo(p, e.ShiftDown());
  if (e.LeftIsDown() || e.MiddleIsDown()) {
    if (!aBouge_ && std::abs(p.x - depart_.x) + std::abs(p.y - depart_.y) <= SEUIL_CLIC) return;
    const bool premier = !aBouge_;
    aBouge_ = true;
    if (premier && marquePivot_.IsNull()) {
      occ::handle<AIS_Point> a = new AIS_Point(new Geom_CartesianPoint(pivot_));
      a->SetMarker(Aspect_TOM_BALL);
      a->SetColor(couleur(0xff, 0x9f, 0x0a));
      a->SetZLayer(Graphic3d_ZLayerId_Topmost);
      contexte_->Display(a, 0, -1, false);
      contexte_->Deactivate(a);
      marquePivot_ = a;
    }
    resteX_ += premier ? p.x - depart_.x : p.x - precedent_.x;
    resteY_ += premier ? p.y - depart_.y : p.y - precedent_.y;
    precedent_ = p;
    if (!minuterieOrbite_.IsRunning()) minuterieOrbite_.Start(16);
  } else if (e.RightIsDown()) {
    aBouge_ = true;
    vue_->Pan(p.x - precedent_.x, precedent_.y - p.y);
    precedent_ = p;
    majTailles();
  } else if (faoSurvol) {
    cliquerFao(p, 0, false, false, true);
  } else {
    const bool surUneZone = surZone && surZone(p, false);
    if (surUneZone != mainZone_) {
      mainZone_ = surUneZone;
      SetCursor(surUneZone ? wxCursor(wxCURSOR_HAND) : wxNullCursor);
    }
    if (surUneZone) return;
    if (!placer_) preparerSelection();
    survoler(p);
  }
}

void Vue3D::survoler(const wxPoint& p) {
  contexte_->MoveTo(p.x, p.y, vue_, false);
  const bool arete = contexte_->HasDetected() && contexte_->HasDetectedShape() && contexte_->DetectedShape().ShapeType() == TopAbs_EDGE;
  if (arete != survolArete_) {
    survolArete_ = arete;
    const occ::handle<Prs3d_Drawer>& s = contexte_->HighlightStyle(Prs3d_TypeOfHighlight_LocalDynamic);
    const Quantity_Color c = arete ? couleur(0xff, 0x5a, 0x1f) : couleur(0x0a, 0x84, 0xff);
    const float t = arete ? 0.05f : 0.65f;
    s->SetColor(c);
    s->SetTransparency(t);
    if (!s->ShadingAspect().IsNull()) {
      s->ShadingAspect()->SetColor(c);
      s->ShadingAspect()->SetTransparency(t);
    }
    // le surlignage déjà posé garde l'ancienne couleur : on le refait avec la nouvelle
    contexte_->ClearDetected(false);
    contexte_->MoveTo(p.x, p.y, vue_, false);
  }
  vue_->RedrawImmediate();
}

void Vue3D::surMolette(wxMouseEvent& e) {
  const wxPoint p = e.GetPosition();  // wxWidgets la donne déjà dans le repère de cette fenêtre
  vue_->StartZoomAtPoint(p.x, p.y);
  const int d = (opt_.zoomInverse ? -1 : 1) * e.GetWheelRotation() / 4;
  vue_->ZoomAtPoint(p.x, p.y, p.x + d, p.y + d);
  majTailles();
  vue_->Redraw();
}

void Vue3D::surPerteSouris(wxMouseCaptureLostEvent&) {
  aBouge_ = true;
  arreterOrbite();
}

void Vue3D::arreterOrbite() {
  minuterieOrbite_.Stop();
  resteX_ = resteY_ = 0;
  orbiteTenue_ = false;
  cacherPivot();
}

void Vue3D::surTicOrbite(wxTimerEvent&) {
  const double f = 0.2, dx = resteX_ * f, dy = resteY_ * f;
  resteX_ -= dx;
  resteY_ -= dy;
  if (dx != 0 || dy != 0) {
    tourner(dx, dy);
    majReflets();
    majTailles();
    vue_->Redraw();
  }
  if (std::abs(resteX_) < 0.01 && std::abs(resteY_) < 0.01) {
    resteX_ = resteY_ = 0;
    if (!orbiteTenue_) {
      minuterieOrbite_.Stop();
      cacherPivot();
    }
  }
}

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
  majMatieres();
  refaireReflets();
  majAretes();
  majCoupe();
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
  if (boite.IsVoid()) {
    if (!disque_.IsNull()) contexte_->Remove(disque_, false);
    disque_.Nullify();
    return;
  }
  sol_ = boite.CornerMin().Z();
  const gp_Pnt bas = boite.CornerMin(), haut = boite.CornerMax();
  centreSol_[0] = (bas.X() + haut.X()) / 2;
  centreSol_[1] = (bas.Y() + haut.Y()) / 2;
  rayonSol_ = std::max(bas.Distance(haut) / 2, 1.0);
  std::vector<std::pair<TopoDS_Shape, gp_Trsf>> ombrants;
  for (const Un& u : tous) ombrants.push_back({u.s, u.t});
  {
    const auto t0 = std::chrono::steady_clock::now();
    calculerOmbre(ombrants);
    msOmbre_ = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
  }
  majSol();
  if (!opt_.miroir) return;
  // Le reflet au sol : chaque corps renversé sous la pièce, fondu dans le fond, jamais cliquable
  gp_Trsf miroir;
  miroir.SetMirror(gp_Ax2(gp_Pnt(0, 0, sol_), gp_Dir(0, 0, 1)));
  const auto solVue = [this]() { return paramSol(); };
  for (const Un& u : tous) {
    Quantity_Color teinte = couleurHex(u.c);
    for (const ApparenceVue& a : apparences_)
      if (opt_.env != "actuel" && a.forme.IsSame(u.s)) teinte = couleurHex(a.couleur);
    occ::handle<AIS_Shape> r = new AIS_Shape(u.s);
    r->Attributes()->SetAutoTriangulation(false);
    r->Attributes()->SetFaceBoundaryDraw(false);
    r->SetColor(teinte);
    occ::handle<Graphic3d_AspectFillArea3d> as = r->Attributes()->ShadingAspect()->Aspect();
    as->SetFaceCulling(Graphic3d_TypeOfBackfacingModel_DoubleSided);
    const ParamSol P = solVue();
    as->SetShaderProgram(programmeReflet(teinte, P));
    if (!texturesSol_.IsNull()) {
      as->SetTextureSet(texturesSol_);
      as->SetTextureMapOn(true);
    }
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
  if (e.AltDown() && !placer_ && surAltDouble && !affichee_.IsNull() && !enChoix_) {
    preparerSelection();
    contexte_->MoveTo(e.GetX(), e.GetY(), vue_, false);
    if (contexte_->HasDetected() && contexte_->HasDetectedShape()) surAltDouble(contexte_->DetectedShape());
    return;
  }
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
  gizmoTenu_ = gizmo_;
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

void Vue3D::deplacerGizmo(const std::array<double, 3>& o, const std::array<double, 3>& axe) {
  if (!gizmo_.actif) return;
  gizmo_.o = o;
  gizmo_.ax[2] = axe;
  majTailles();
  vue_->Redraw();
  Refresh();
}

wxPoint Vue3D::pointeGizmo() const {
  if (!gizmo_.actif) return wxPoint(-100000, -100000);
  const gp_Pnt O(gizmo_.o[0], gizmo_.o[1], gizmo_.o[2]);
  const double s = echelleEn(O) * FromDIP(TAILLE_GIZMO);
  const gp_Dir z(gizmo_.ax[2][0], gizmo_.ax[2][1], gizmo_.ax[2][2]);
  if (gizmo_.anneau[2]) return ecranDe(O.Translated(gp_Vec(gp_Ax3(O, z).XDirection()) * (0.62 * s)));
  return ecranDe(O.Translated(gp_Vec(z) * s));
}

bool Vue3D::essaiTirer(const wxPoint& a, const wxPoint& b, bool libre) {
  wxMouseEvent e(wxEVT_LEFT_DOWN);
  if (!saisirGizmo(a, e)) return false;
  bougerGizmo(b, libre);
  gizmoSaisi_ = -1;
  if (surGeste) surGeste(2, "", 0, "", 0, false);
  return true;
}

void Vue3D::bougerGizmo(const wxPoint& p, bool libre) {
  const gp_Pnt O(gizmoTenu_.o[0], gizmoTenu_.o[1], gizmoTenu_.o[2]);
  gp_Pnt ro;
  gp_Dir rd;
  rayon(p.x, p.y, ro, rd);
  const int i = gizmoSaisi_ % 3;
  const gp_Vec a(gizmoTenu_.ax[i][0], gizmoTenu_.ax[i][1], gizmoTenu_.ax[i][2]);
  double v;
  if (gizmoSaisi_ < 3) {
    const gp_Vec w(O, ro);
    const double b = a.Dot(gp_Vec(rd)), d = a.Dot(w), ee = gp_Vec(rd).Dot(w), den = 1 - b * b;
    if (std::abs(den) < 1e-9) return;
    v = (d - b * ee) / den - gizmoT0_;
    if (surGeste) surGeste(1, "move", i, gizmoTenu_.degreFleche[i], v, libre);
  } else {
    const double den = a.Dot(gp_Vec(rd));
    if (std::abs(den) < 1e-9) return;
    const double t = a.Dot(gp_Vec(ro, O)) / den;
    const gp_Vec q(O, ro.Translated(gp_Vec(rd) * t));
    v = std::atan2(a.Dot(gizmoP0_.Crossed(q)), gizmoP0_.Dot(q)) * 180 / 3.14159265358979;
    if (surGeste) surGeste(1, "rot", i, gizmoTenu_.degreAnneau[i], v, libre);
  }
}

// ---- La fiche ⚙ et le Rendu direct (src/98-rendu-vue.js) ----
namespace {
Quantity_Color couleurTexte(const std::string& t) {
  unsigned v = 0x808080;
  if (t.size() == 7 && t[0] == '#') v = static_cast<unsigned>(std::strtoul(t.c_str() + 1, nullptr, 16));
  return couleurHex(v);
}
}  // namespace

ParamSol Vue3D::paramSol() const {
  ParamSol P;
  const bool actuel = opt_.env == "actuel";
  P.fond = actuel ? couleurFond() : couleurTexte(opt_.solCouleur);
  P.centre = gp_Pnt(centreSol_[0], centreSol_[1], sol_);
  P.rayon = rayonSol_;
  P.ombreK = imageOmbre_.IsNull() ? 0 : (actuel || opt_.amb == "noir" || opt_.amb == "atelier" ? 0.55 : 0.32);
  P.ombreO[0] = ombreO_[0];
  P.ombreO[1] = ombreO_[1];
  P.ombreT = ombreT_;
  const SupportRendu* b = opt_.sol ? supportRendu(opt_.support) : nullptr;
  P.tuile = b != nullptr;
  if (b) P.tuileT = b->t, P.tuileK = b->k;
  P.refletK = actuel ? 1 : 0.8 / 0.62;
  // En CAO, le fond et le sol sont une seule couleur
  P.disque = opt_.sol && (!actuel || b != nullptr);
  P.haut = actuel ? couleurFond() : couleurTexte(opt_.fond1);
  P.bas = actuel ? couleurFond() : couleurTexte(opt_.fond2);
  if (!opt_.sol && !actuel) P.tuileK = 0.55;
  if (opt_.coupe) {
    const double s = opt_.coupeInverse ? -1 : 1;
    P.coupe = true;
    P.cn[opt_.coupeAxe] = -s;
    P.cd = s * opt_.coupePos;
  }
  return P;
}

// L'ombre portée : les triangles projetés sur le sol le long de la lampe, puis adoucis. Rien à recalculer tant que la pièce ne change pas.
void Vue3D::calculerOmbre(const std::vector<std::pair<TopoDS_Shape, gp_Trsf>>& L) {
  imageOmbre_.Nullify();
  if (!opt_.ombre) return;
  const int N = 1024;
  const double T = rayonSol_ * 6.4;
  ombreO_[0] = centreSol_[0] - T / 2;
  ombreO_[1] = centreSol_[1] - T / 2;
  ombreT_ = T;
  const double a = cleAmbiance_[0] * M_PI / 180, e = cleAmbiance_[1] * M_PI / 180;
  const double lx = std::cos(e) * std::cos(a), ly = std::cos(e) * std::sin(a), lz = std::max(std::sin(e), 0.05);
  std::vector<unsigned char> im(static_cast<size_t>(N) * N, 0);
  for (const auto& [forme, t] : L) {
    for (TopExp_Explorer x(forme, TopAbs_FACE); x.More(); x.Next()) {
      TopLoc_Location loc;
      const occ::handle<Poly_Triangulation> tri = BRep_Tool::Triangulation(TopoDS::Face(x.Current()), loc);
      if (tri.IsNull()) continue;
      const gp_Trsf m = t * loc.Transformation();
      const int nb = tri->NbNodes();
      std::vector<std::array<float, 2>> q(static_cast<size_t>(nb) + 1);
      for (int i = 1; i <= nb; i++) {
        const gp_Pnt p = tri->Node(i).Transformed(m);
        const double h = (p.Z() - sol_) / lz;
        q[i] = {static_cast<float>((p.X() - h * lx - ombreO_[0]) / T * N), static_cast<float>((p.Y() - h * ly - ombreO_[1]) / T * N)};
      }
      for (int i = 1; i <= tri->NbTriangles(); i++) {
        int i0, i1, i2;
        tri->Triangle(i).Get(i0, i1, i2);
        const auto& A = q[i0];
        const auto& B = q[i1];
        const auto& C = q[i2];
        const double aire = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
        if (aire == 0) continue;
        const int x0 = std::max(0, static_cast<int>(std::floor(std::min({A[0], B[0], C[0]})))), x1 = std::min(N - 1, static_cast<int>(std::ceil(std::max({A[0], B[0], C[0]}))));
        const int y0 = std::max(0, static_cast<int>(std::floor(std::min({A[1], B[1], C[1]})))), y1 = std::min(N - 1, static_cast<int>(std::ceil(std::max({A[1], B[1], C[1]}))));
        const double sg = aire > 0 ? 1 : -1;
        for (int y = y0; y <= y1; y++)
          for (int xx = x0; xx <= x1; xx++) {
            const double px = xx + 0.5, py = y + 0.5;
            const double w0 = sg * ((B[0] - A[0]) * (py - A[1]) - (B[1] - A[1]) * (px - A[0]));
            const double w1 = sg * ((C[0] - B[0]) * (py - B[1]) - (C[1] - B[1]) * (px - B[0]));
            const double w2 = sg * ((A[0] - C[0]) * (py - C[1]) - (A[1] - C[1]) * (px - C[0]));
            if (w0 >= 0 && w1 >= 0 && w2 >= 0) im[static_cast<size_t>(y) * N + xx] = 255;
          }
      }
    }
  }
  // Deux passes de boîte : les bords s'adoucissent comme l'ombre du navigateur
  std::vector<unsigned char> tmp(im.size());
  const int r = 3;
  for (int passe = 0; passe < 2; passe++) {
    for (int y = 0; y < N; y++) {
      int somme = 0;
      for (int x = -r; x <= r; x++) somme += im[static_cast<size_t>(y) * N + std::clamp(x, 0, N - 1)];
      for (int x = 0; x < N; x++) {
        tmp[static_cast<size_t>(y) * N + x] = static_cast<unsigned char>(somme / (2 * r + 1));
        somme += im[static_cast<size_t>(y) * N + std::min(x + r + 1, N - 1)] - im[static_cast<size_t>(y) * N + std::max(x - r, 0)];
      }
    }
    for (int x = 0; x < N; x++) {
      int somme = 0;
      for (int y = -r; y <= r; y++) somme += tmp[static_cast<size_t>(std::clamp(y, 0, N - 1)) * N + x];
      for (int y = 0; y < N; y++) {
        im[static_cast<size_t>(y) * N + x] = static_cast<unsigned char>(somme / (2 * r + 1));
        somme += tmp[static_cast<size_t>(std::min(y + r + 1, N - 1)) * N + x] - tmp[static_cast<size_t>(std::max(y - r, 0)) * N + x];
      }
    }
  }
  imageOmbre_ = new Image_PixMap();
  imageOmbre_->SetTopDown(false);
  imageOmbre_->InitTrash(Image_Format_Gray, N, N);
  for (int y = 0; y < N; y++)
    for (int x = 0; x < N; x++) *imageOmbre_->ChangeRawValue(y, x) = im[static_cast<size_t>(y) * N + x];
}

void Vue3D::majSol() {
  if (!disque_.IsNull()) contexte_->Remove(disque_, false);
  disque_.Nullify();
  texturesSol_.Nullify();
  const SupportRendu* b = opt_.sol ? supportRendu(opt_.support) : nullptr;
  std::vector<occ::handle<Graphic3d_Texture2D>> tex;
  if (b) {
    const auto tuile = tuileSupport(opt_.support);
    if (tuile) {
      occ::handle<Image_PixMap> im = new Image_PixMap();
      im->SetTopDown(false);
      im->InitTrash(Image_Format_RGB, tuile->n, tuile->n);
      for (int y = 0; y < tuile->n; y++)
        for (int x = 0; x < tuile->n; x++) {
          unsigned char* o = im->ChangeRawValue(y, x);
          const unsigned char* i = &tuile->rgb[3 * (static_cast<size_t>(y) * tuile->n + x)];
          o[0] = i[0], o[1] = i[1], o[2] = i[2];
        }
      occ::handle<Graphic3d_Texture2D> t = new Graphic3d_Texture2D(im);
      t->EnableRepeat();
      t->GetParams()->SetFilter(Graphic3d_TOTF_TRILINEAR);
      t->GetParams()->SetTextureUnit(Graphic3d_TextureUnit_0);
      tex.push_back(t);
    }
  }
  if (!imageOmbre_.IsNull()) {
    occ::handle<Graphic3d_Texture2D> t = new Graphic3d_Texture2D(imageOmbre_);
    t->DisableRepeat();
    t->GetParams()->SetFilter(Graphic3d_TOTF_BILINEAR);
    t->GetParams()->SetTextureUnit(Graphic3d_TextureUnit_1);
    tex.push_back(t);
  }
  if (!tex.empty()) {
    texturesSol_ = new Graphic3d_TextureSet(static_cast<int>(tex.size()));
    for (int i = 0; i < static_cast<int>(tex.size()); i++) texturesSol_->SetValue(i, tex[i]);
  }
  // Sans ambiance ni support ni ombre, rien à dessiner : le fond suffit
  const bool actuel = opt_.env == "actuel";
  if (imageOmbre_.IsNull() && (actuel ? b == nullptr : !opt_.sol)) return;
  const double m = rayonSol_ * 6;
  BRepBuilderAPI_MakeFace fabrique(gp_Pln(gp_Pnt(centreSol_[0], centreSol_[1], sol_), gp_Dir(0, 0, 1)), -m, m, -m, m);
  const TopoDS_Face f = fabrique.Face();
  BRepMesh_IncrementalMesh(f, m, false, 1.0, false);
  disque_ = new AIS_Shape(f);
  disque_->Attributes()->SetAutoTriangulation(false);
  disque_->Attributes()->SetFaceBoundaryDraw(false);
  disque_->SetColor(Quantity_NOC_WHITE);  // crée son aspect propre
  occ::handle<Graphic3d_AspectFillArea3d> as = disque_->Attributes()->ShadingAspect()->Aspect();
  as->SetFaceCulling(Graphic3d_TypeOfBackfacingModel_DoubleSided);
  as->SetShaderProgram(programmeDisque(paramSol()));
  if (!texturesSol_.IsNull()) {
    as->SetTextureSet(texturesSol_);
    as->SetTextureMapOn(true);
  }
  disque_->SetZLayer(coucheSol_);
  contexte_->Display(disque_, AIS_Shaded, -1, false);
  contexte_->Deactivate(disque_);
}

// Chaque corps prend son apparence de rendu, ou retrouve celle de la CAO
void Vue3D::majMatieres() {
  const bool rendu = opt_.env != "actuel";
  const auto chercher = [this](const TopoDS_Shape& s) -> const ApparenceVue* {
    for (const ApparenceVue& a : apparences_)
      if (a.forme.IsSame(s)) return &a;
    return nullptr;
  };
  const auto poser = [&](const occ::handle<AIS_Shape>& ais, const std::vector<std::pair<TopoDS_Shape, unsigned>>& teintes) {
    occ::handle<AIS_ColoredShape> piece = occ::down_cast<AIS_ColoredShape>(ais);
    if (piece.IsNull()) return;
    const Graphic3d_MaterialAspect defaut = rendu ? matiereVue("") : matierePiece();
    piece->SetMaterial(defaut);
    for (const auto& [corps, c] : teintes) {
      const ApparenceVue* a = rendu ? chercher(corps) : nullptr;
      piece->SetCustomColor(corps, couleurHex(a ? a->couleur : c));
      const occ::handle<AIS_ColoredDrawer>& d = piece->CustomAspects(corps);
      d->ShadingAspect()->SetMaterial(a ? matiereVue(a->cle) : defaut);
      d->ShadingAspect()->SetColor(couleurHex(a ? a->couleur : c));
    }
    contexte_->Redisplay(piece, false);
  };
  // Ne rien toucher tant qu'on n'a jamais quitté la CAO : l'affichage habituel reste celui d'avant
  if (!rendu && !matieresRendues_) return;
  matieresRendues_ = rendu;
  if (!affichee_.IsNull()) poser(affichee_, teintesPiece_);
  for (OccAffichee& o : occs_)
    if (!o.v.fantome) poser(o.piece, o.v.teintes);
}

void Vue3D::apparences(const std::vector<ApparenceVue>& L) {
  apparences_ = L;
  if (opt_.env == "actuel") return;
  majMatieres();
  refaireReflets();
  majReflets();
  vue_->Redraw();
}

void Vue3D::majAretes() {
  const auto montrer = [this](const occ::handle<AIS_Shape>& a) {
    if (a.IsNull()) return;
    if (opt_.aretes) contexte_->Display(a, AIS_WireFrame, -1, false);
    else contexte_->Erase(a, false);
  };
  if (!enChoix_) {
    montrer(aretesVives_);
    montrer(aretesLisses_);
  }
  for (OccAffichee& o : occs_) {
    montrer(o.vives);
    montrer(o.lisses);
  }
}

void Vue3D::majAxes() {
  if (!opt_.axes) {
    if (!axes_.IsNull()) contexte_->Remove(axes_, false);
    axes_.Nullify();
    return;
  }
  if (!axes_.IsNull()) return;
  const float L = static_cast<float>(FromDIP(70));
  axes_ = new TraitsCouleur({{0, 0, 0, L, 0, 0, 0.9f, 0.16f, 0.13f}, {0, 0, 0, 0, L, 0, 0.19f, 0.82f, 0.35f}, {0, 0, 0, 0, 0, L, 0.04f, 0.52f, 1.0f}});
  axes_->SetTransformPersistence(new Graphic3d_TransformPers(Graphic3d_TMF_ZoomPers, gp_Pnt(0, 0, 0)));
  axes_->SetZLayer(Graphic3d_ZLayerId_Topmost);
  contexte_->Display(axes_, 0, -1, false);
  contexte_->Deactivate(axes_);
}

void Vue3D::majCoupe() {
  if (!planCoupe_.IsNull()) contexte_->Remove(planCoupe_, false);
  planCoupe_.Nullify();
  occ::handle<Graphic3d_SequenceOfHClipPlane> plans;
  if (opt_.coupe) {
    const double s = opt_.coupeInverse ? -1 : 1;
    double n[3] = {0, 0, 0};
    n[opt_.coupeAxe] = -s;
    coupe_ = new Graphic3d_ClipPlane(gp_Pln(n[0], n[1], n[2], s * opt_.coupePos));
    coupe_->SetCapping(opt_.coupeRemplie);
    coupe_->SetUseObjectMaterial(true);
    coupe_->SetUseObjectShader(false);
    plans = new Graphic3d_SequenceOfHClipPlane();
    plans->Append(coupe_);
  }
  if (!opt_.coupe && !coupeAppliquee_) return;
  coupeAppliquee_ = opt_.coupe;
  const auto poser = [&](const occ::handle<AIS_InteractiveObject>& a) {
    if (!a.IsNull()) a->SetClipPlanes(plans);
  };
  poser(affichee_);
  poser(aretesVives_);
  poser(aretesLisses_);
  poser(filetsHelices_);
  poser(filetsAnneaux_);
  for (OccAffichee& o : occs_) {
    poser(o.piece);
    poser(o.vives);
    poser(o.lisses);
  }
  if (opt_.coupe && opt_.coupePlan) {
    double b[6];
    if (boiteVisible(b)) {
      const double m = std::max({b[3] - b[0], b[4] - b[1], b[5] - b[2]}) * 0.6;
      gp_Pnt c((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
      double x[3] = {c.X(), c.Y(), c.Z()};
      x[opt_.coupeAxe] = opt_.coupePos;
      gp_Dir d(opt_.coupeAxe == 0, opt_.coupeAxe == 1, opt_.coupeAxe == 2);
      BRepBuilderAPI_MakeFace f(gp_Pln(gp_Pnt(x[0], x[1], x[2]), d), -m, m, -m, m);
      BRepMesh_IncrementalMesh(f.Face(), m, false, 1.0, false);
      planCoupe_ = new AIS_Shape(f.Face());
      planCoupe_->Attributes()->SetAutoTriangulation(false);
      planCoupe_->SetColor(couleurHex(0x0a84ff));
      {
        // Un voile : sans lumière, on voit la pièce à travers
        occ::handle<Graphic3d_AspectFillArea3d> a = planCoupe_->Attributes()->ShadingAspect()->Aspect();
        a->SetShadingModel(Graphic3d_TypeOfShadingModel_Unlit);
        a->SetInteriorColor(Quantity_ColorRGBA(couleurHex(0x0a84ff), 0.18f));
        a->SetAlphaMode(Graphic3d_AlphaMode_Blend);
        a->SetFaceCulling(Graphic3d_TypeOfBackfacingModel_DoubleSided);
      }
      contexte_->Display(planCoupe_, AIS_Shaded, -1, false);
      contexte_->Deactivate(planCoupe_);
    }
  }
}

bool Vue3D::boiteVisible(double b[6]) const {
  Bnd_Box boite;
  if (!formePiece_.IsNull()) BRepBndLib::Add(formePiece_, boite, true);
  for (const OccAffichee& o : occs_) {
    if (o.v.fantome) continue;
    Bnd_Box u;
    BRepBndLib::Add(o.v.forme, u, true);
    if (!u.IsVoid()) boite.Add(u.Transformed(o.v.t));
  }
  if (boite.IsVoid()) return false;
  boite.Get(b[0], b[1], b[2], b[3], b[4], b[5]);
  return true;
}

// Le ciel, les lampes, le fond
void Vue3D::majAmbiance() {
  const bool actuel = opt_.env == "actuel";
  std::string sig = actuel ? "actuel" : opt_.amb + "|" + std::to_string(opt_.rot) + "|" + std::to_string(opt_.force) + "|" + (opt_.hdri ? "h" + std::to_string(reinterpret_cast<uintptr_t>(opt_.hdri.get())) : "");
  if (sig != sigAmbiance_) {
    sigAmbiance_ = sig;
    if (actuel) {
      cleAmbiance_ = {-34, 59};
      vue_->SetBackgroundCubeMap(cubeStudio_, true);
      lumAmbiante_->SetIntensity(2.0f);
      lumCle_->SetIntensity(7.5f);
      lumCiel_->SetIntensity(3.0f);
    } else {
      std::array<double, 2> cle{};
      vue_->SetBackgroundCubeMap(cubeVue(opt_.amb, opt_.hdri.get(), opt_.rot * M_PI / 180, FORCE_HEMI, cle), true);
      cleAmbiance_ = {cle[0] + opt_.rot, cle[1]};
      lumAmbiante_->SetIntensity(static_cast<float>(ECH_CUBE * opt_.force * FORCE_CIEL));
      lumCle_->SetIntensity(static_cast<float>(FORCE_CLE));
      lumCiel_->SetIntensity(0.0f);
    }
  }
  if (actuel) {
    vue_->View()->SetBackgroundType(Graphic3d_TOB_NONE);
    vue_->SetBackgroundColor(couleurFond());
  } else {
    vue_->View()->SetBackgroundType(Graphic3d_TOB_GRADIENT);
    vue_->SetBgGradientColors(couleurTexte(opt_.fond1), couleurTexte(opt_.fond2), Aspect_GradientFillMethod_Vertical, false);
    vue_->View()->SetBackgroundType(Graphic3d_TOB_GRADIENT);
  }
}

void Vue3D::options(const OptionsVue& o) {
  const double t0 = std::tan(opt_.fov * M_PI / 360), t1 = std::tan(o.fov * M_PI / 360);
  const bool fov = o.fov != opt_.fov;
  opt_ = o;
  if (fov) {
    occ::handle<Graphic3d_Camera> c = vue_->Camera();
    c->SetDistance(c->Distance() * t0 / t1);
    c->SetFOVy(o.fov);
  }
  majAmbiance();
  majMatieres();
  refaireReflets();
  majAretes();
  majAxes();
  majCoupe();
  majReflets();
  vue_->ZFitAll();
  vue_->Redraw();
}

void Vue3D::filmDebut() {
  cameraFilm_ = new Graphic3d_Camera();
  cameraFilm_->Copy(vue_->Camera());
  if (!cube_.IsNull()) contexte_->Erase(cube_, false);
}

void Vue3D::filmFin() {
  if (!cameraFilm_.IsNull()) vue_->Camera()->Copy(cameraFilm_);
  cameraFilm_.Nullify();
  if (!cube_.IsNull()) contexte_->Display(cube_, false);
  majReflets();
  majTailles();
  vue_->ZFitAll();
  vue_->Redraw();
}

void Vue3D::filmOrbite(const double c[3], double d, double a, double el) {
  occ::handle<Graphic3d_Camera> k = vue_->Camera();
  const double ce = std::cos(el);
  k->SetCenter(gp_Pnt(c[0], c[1], c[2]));
  k->SetEye(gp_Pnt(c[0] + d * ce * std::cos(a), c[1] + d * ce * std::sin(a), c[2] + d * std::sin(el)));
  k->SetUp(gp_Dir(0, 0, 1));
  k->OrthogonalizeUp();
  majReflets();
  majTailles();
  vue_->ZFitAll();
  vue_->Redraw();
}

bool Vue3D::captureFilm(wxImage& sortie, int l, int h) {
  Image_PixMap px;
  V3d_ImageDumpOptions o;
  o.Width = l;
  o.Height = h;
  o.BufferType = Graphic3d_BT_RGB;
  o.ToAdjustAspect = true;
  try {
    if (!px.InitZero(Image_Format_RGB, l, h) || !vue_->ToPixMap(px, o)) return false;
  } catch (const Standard_Failure&) {
    return false;
  }
  sortie.Create(l, h, false);
  unsigned char* d = sortie.GetData();
  for (int y = 0; y < h; y++) {
    const unsigned char* r = px.Row(y);
    memcpy(d + static_cast<size_t>(y) * l * 3, r, static_cast<size_t>(l) * 3);
  }
  return true;
}

void Vue3D::vueStandard(const std::string& q) {
  if (q == "iso") return vueInitiale();
  const gp_Pnt c = vue_->Camera()->Center();
  const double d = vue_->Camera()->Distance();
  gp_Dir vers(0, -1, 0), haut(0, 0, 1);
  if (q == "top") vers = gp_Dir(0, 0, 1), haut = gp_Dir(0, 1, 0);
  else if (q == "right") vers = gp_Dir(1, 0, 0);
  occ::handle<Graphic3d_Camera> k = vue_->Camera();
  k->SetCenter(c);
  k->SetEye(c.XYZ() + vers.XYZ() * d);
  k->SetUp(haut);
  k->OrthogonalizeUp();
  majReflets();
  majTailles();
  vue_->ZFitAll();
  vue_->Redraw();
}

// L'orbite libre : glisser à droite tourne la pièce vers la droite, vers le bas passe par-dessus (orbitRotate)
void Vue3D::tournerLibre(double dx, double dy) {
  occ::handle<Graphic3d_Camera> k = vue_->Camera();
  const double v = 2 * M_PI / std::max(GetClientSize().y, 1);
  const gp_Dir U = k->Up();
  const gp_Vec droite = gp_Vec(k->Direction()).Crossed(gp_Vec(U));
  if (droite.Magnitude() < 1e-9) return;
  gp_Trsf t1, t2;
  t1.SetRotation(gp_Ax1(pivot_, U), -dx * v);
  t2.SetRotation(gp_Ax1(pivot_, gp_Dir(droite)), -dy * v);
  const gp_Trsf T = t1 * t2;
  const gp_Pnt oeil = k->Eye().Transformed(T), centre = k->Center().Transformed(T);
  const gp_Dir haut = U.Transformed(T);
  k->SetCenter(centre);
  k->SetEye(oeil);
  k->SetUp(haut);
  k->OrthogonalizeUp();
  vue_->ZFitAll();
}

// L'orbite contrainte : Z reste en haut, l'élévation s'arrête avant les pôles (orbitRotate, src/10-scene-3d.js)
void Vue3D::tournerZ(double dx, double dy) {
  occ::handle<Graphic3d_Camera> k = vue_->Camera();
  const double v = 2 * M_PI / std::max(GetClientSize().y, 1);
  const gp_Vec fw(k->Eye(), k->Center());
  if (fw.Magnitude() < 1e-9) return;
  const gp_Dir d(fw.Reversed());
  gp_Vec droite = gp_Vec(k->Direction()).Crossed(gp_Vec(k->Up()));
  if (droite.Magnitude() < 1e-9) return;
  const gp_Dir R(droite);
  const double phi = std::acos(std::clamp(d.Z(), -1.0, 1.0)), lim = 1e-3;
  const double a = std::clamp(phi - dy * v, lim, M_PI - lim) - phi;
  gp_Trsf t1, t2;
  t1.SetRotation(gp_Ax1(pivot_, gp_Dir(0, 0, 1)), -dx * v);
  t2.SetRotation(gp_Ax1(pivot_, R), a);
  const gp_Trsf T = t1 * t2;
  const gp_Pnt oeil = k->Eye().Transformed(T), centre = k->Center().Transformed(T);
  k->SetCenter(centre);
  k->SetEye(oeil);
  k->SetUp(gp_Dir(0, 0, 1));
  k->OrthogonalizeUp();
  vue_->ZFitAll();
}
