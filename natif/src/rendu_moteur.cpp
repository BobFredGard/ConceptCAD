#include "rendu_moteur.h"

#include <algorithm>
#include <chrono>
#include <cmath>

#include <BRepBndLib.hxx>
#include <BRepBuilderAPI_MakeEdge.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakeWire.hxx>
#include <BRepTools.hxx>
#include <BRepMesh_IncrementalMesh.hxx>
#include <Bnd_Box.hxx>
#include <Graphic3d_BSDF.hxx>
#include <Graphic3d_Camera.hxx>
#include <Graphic3d_CubeMapSeparate.hxx>
#include <Graphic3d_MaterialAspect.hxx>
#include <Graphic3d_PBRMaterial.hxx>
#include <Graphic3d_RenderingParams.hxx>
#include <Graphic3d_TextureEnv.hxx>
#include <Image_PixMap.hxx>
#include <NCollection_Array1.hxx>
#include <Prs3d_Drawer.hxx>
#include <Prs3d_ShadingAspect.hxx>
#include <Quantity_Color.hxx>
#include <Prs3d_LineAspect.hxx>
#include <V3d_AmbientLight.hxx>
#include <V3d_ImageDumpOptions.hxx>
#include <WNT_Window.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Wire.hxx>
#include <gp_Ax2.hxx>
#include <gp_Circ.hxx>
#include <gp_Pln.hxx>
#include <thread>

const std::vector<MatiereRendu>& bibliothequeRendu() {
  static const std::vector<MatiereRendu> L = {
#include "rendu_materiaux.inc"
  };
  return L;
}
const MatiereRendu* matiereRendu(const std::string& cle) {
  for (const MatiereRendu& m : bibliothequeRendu())
    if (cle == m.cle) return &m;
  return nullptr;
}

namespace {
const double PI = 3.14159265358979323846;
using V3 = std::array<double, 3>;

double smooth(double a, double b, double x) {
  const double t = std::clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3 - 2 * t);
}
double lin(double c) { return c <= 0.04045 ? c / 12.92 : std::pow((c + 0.055) / 1.055, 2.4); }
V3 linHex(unsigned h) { return {lin(((h >> 16) & 255) / 255.0), lin(((h >> 8) & 255) / 255.0), lin((h & 255) / 255.0)}; }
V3 linTexte(const std::string& s) {
  unsigned v = 0;
  if (s.size() == 7) v = static_cast<unsigned>(std::strtoul(s.c_str() + 1, nullptr, 16));
  return linHex(v);
}

// L'ambiance, décrite comme rdEnvDesc : un ciel en dégradé vertical et des panneaux lumineux tournés vers le centre
struct Panneau {
  double az, el, dist, l, h, force;
  unsigned teinte;
  V3 centre, axeL, axeH, n;
};
struct Ambiance {
  V3 haut, horizon, bas;
  std::vector<Panneau> panneaux;
  std::array<double, 2> cle;
  void panneau(double az, double el, double dist, double l, double h, double f, unsigned t = 0xffffff) {
    Panneau p{az, el, dist, l, h, f, t, {}, {}, {}, {}};
    const double a = az * PI / 180, e = el * PI / 180;
    p.centre = {dist * std::cos(e) * std::cos(a), dist * std::cos(e) * std::sin(a), dist * std::sin(e)};
    const double L = std::sqrt(p.centre[0] * p.centre[0] + p.centre[1] * p.centre[1] + p.centre[2] * p.centre[2]);
    p.n = {-p.centre[0] / L, -p.centre[1] / L, -p.centre[2] / L};
    // up = Z : l'axe de largeur est horizontal
    V3 x{-p.n[1], p.n[0], 0};
    double lx = std::hypot(x[0], x[1]);
    if (lx < 1e-6) x = {1, 0, 0}, lx = 1;
    x = {x[0] / lx, x[1] / lx, 0};
    p.axeL = x;
    p.axeH = {p.n[1] * x[2] - p.n[2] * x[1], p.n[2] * x[0] - p.n[0] * x[2], p.n[0] * x[1] - p.n[1] * x[0]};
    panneaux.push_back(p);
  }
};
Ambiance ambiance(const std::string& amb) {
  Ambiance D;
  const auto ciel = [&](V3 t, V3 h, V3 b) { D.haut = t, D.horizon = h, D.bas = b; };
  const auto x = [](V3 c, double k) { return V3{c[0] * k, c[1] * k, c[2] * k}; };
  D.cle = {-60, 40};
  if (amb == "clair") {
    ciel(linHex(0xf4f5f7), linHex(0xd9dce1), linHex(0x8e939b));
    D.panneau(90, 80, 30, 40, 40, 3);
    D.panneau(-60, 35, 30, 22, 30, 5);
    D.panneau(30, 25, 30, 20, 26, 3);
    D.panneau(150, 20, 30, 40, 8, 2.5);
  } else if (amb == "atelier") {
    ciel(linHex(0x6a5a48), linHex(0x4a3d30), linHex(0x1d1813));
    D.panneau(-40, 30, 30, 10, 34, 7, 0xffd9a8);
    D.panneau(-15, 30, 30, 10, 34, 7, 0xffd9a8);
    D.panneau(140, 55, 30, 30, 12, 2.5, 0xfff1dc);
    D.panneau(60, 10, 30, 30, 10, 1.2, 0xffe2bd);
    D.cle = {-28, 32};
  } else if (amb == "exterieur") {
    ciel(x(linHex(0x2f5fb3), 1.4), x(linHex(0xdde8f2), 1.5), linHex(0x4a4236));
    D.panneau(-45, 50, 40, 5, 5, 120, 0xfff2d6);
    D.cle = {-45, 50};
  } else if (amb == "noir") {
    ciel(linHex(0x050506), linHex(0x0b0b0d), linHex(0x020203));
    D.panneau(160, 20, 30, 7, 44, 24);
    D.panneau(-160, 20, 30, 7, 44, 24);
    D.panneau(90, 75, 30, 34, 18, 5);
    D.panneau(-70, 15, 30, 26, 20, 1.2);
    D.cle = {90, 70};
  } else {
    ciel(linHex(0x45484d), linHex(0x26282c), linHex(0x0c0d0f));
    D.panneau(90, 75, 30, 36, 36, 8);
    D.panneau(-55, 30, 30, 20, 28, 12);
    D.panneau(40, 20, 30, 16, 24, 4);
    D.panneau(170, 25, 30, 6, 36, 10);
    D.cle = {-55, 45};
  }
  return D;
}
// La lumière qui vient de la direction d (unitaire, Z en haut), sans la rotation
V3 lumiere(const Ambiance& A, const V3& d) {
  V3 c;
  const auto mel = [&](const V3& a, const V3& b, double t) {
    for (int k = 0; k < 3; k++) c[k] = a[k] + (b[k] - a[k]) * t;
  };
  if (d[2] >= 0) mel(A.horizon, A.haut, std::pow(d[2], 0.6));
  else mel(A.horizon, A.bas, std::pow(-d[2], 0.5));
  double meilleur = 1e30;
  for (const Panneau& p : A.panneaux) {
    const double dn = d[0] * p.n[0] + d[1] * p.n[1] + d[2] * p.n[2];
    if (dn > -1e-6) continue;
    const double t = (p.centre[0] * p.n[0] + p.centre[1] * p.n[1] + p.centre[2] * p.n[2]) / dn;
    if (t <= 0 || t >= meilleur) continue;
    const V3 q{d[0] * t - p.centre[0], d[1] * t - p.centre[1], d[2] * t - p.centre[2]};
    if (std::abs(q[0] * p.axeL[0] + q[1] * p.axeL[1] + q[2] * p.axeL[2]) > p.l / 2) continue;
    if (std::abs(q[0] * p.axeH[0] + q[1] * p.axeH[1] + q[2] * p.axeH[2]) > p.h / 2) continue;
    meilleur = t;
    const V3 t2 = linHex(p.teinte);
    for (int k = 0; k < 3; k++) c[k] = t2[k] * p.force;
  }
  return c;
}
V3 tourne(const V3& d, double a) {  // la direction vue dans l'ambiance d'origine : on la tourne en sens inverse
  const double co = std::cos(-a), si = std::sin(-a);
  return {d[0] * co - d[1] * si, d[0] * si + d[1] * co, d[2]};
}

// La lumière que reçoit un plan horizontal du ciel et des panneaux (rtEnvData)
std::array<double, 3> eclairement(const Ambiance& A) {
  const int W = 256, H = 128;
  std::array<double, 3> e{0, 0, 0};
  for (int y = 0; y < H / 2; y++) {
    const double el = (y + 0.5) / H * PI, ce = std::cos(el), se = std::sin(el);  // el : angle depuis le zénith
    for (int x = 0; x < W; x++) {
      const double a = 2 * PI * (x + 0.5) / W;
      const V3 c = lumiere(A, {se * std::cos(a), se * std::sin(a), ce});
      const double dO = (2 * PI / W) * (PI / H) * se;
      for (int k = 0; k < 3; k++) e[k] += c[k] * ce * dO;
    }
  }
  return e;
}

// Le panorama du lancer de rayons (Latlong de RaytraceBase.fs : Z en haut)
occ::handle<Image_PixMap> panorama(const Ambiance& A, double rot, double force) {
  const int W = 1024, H = 512;
  occ::handle<Image_PixMap> im = new Image_PixMap();
  im->SetTopDown(false);
  im->InitTrash(Image_Format_RGBF, W, H);
  for (int y = 0; y < H; y++) {
    const double psi = PI * (1 - (y + 0.5) / H), sp = std::sin(psi), z = -std::cos(psi);
    for (int x = 0; x < W; x++) {
      const double phi = 2 * PI * (x + 0.5) / W - PI;
      const V3 c = lumiere(A, tourne({sp * std::cos(phi), sp * std::sin(phi), z}, rot));
      float* o = reinterpret_cast<float*>(im->ChangeRawValue(y, x));
      for (int k = 0; k < 3; k++) o[k] = static_cast<float>(c[k] * force);
    }
  }
  return im;
}

// Le même ciel en cube pour le calcul rapide. OCCT lit ses reflets en 8 bits : la lumière est divisée par ECH_RAPIDE, l'image multipliée à la sortie.
const double ECH_RAPIDE = 16;
occ::handle<Graphic3d_CubeMap> cubeAmbiance(const Ambiance& A, double rot, double force, const V3* sol) {
  const int N = 256;
  NCollection_Array1<occ::handle<Image_PixMap>> F(0, 5);
  // Les six faces d'OCCT (+X -X +Y -Y +Z -Z), rangées comme le cube de GL : le « haut » du cube est Y
  const auto dir = [](int f, double u, double v) -> V3 {
    switch (f) {
      case 0: return {1, -v, -u};
      case 1: return {-1, -v, u};
      case 2: return {u, 1, v};
      case 3: return {u, -1, -v};
      case 4: return {u, -v, 1};
      default: return {-u, -v, -1};
    }
  };
  for (int f = 0; f < 6; f++) {
    occ::handle<Image_PixMap> im = new Image_PixMap();
    im->SetTopDown(true);
    im->InitTrash(Image_Format_RGB, N, N);
    for (int y = 0; y < N; y++)
      for (int x = 0; x < N; x++) {
        const V3 d0 = dir(f, 2 * (x + 0.5) / N - 1, 2 * (y + 0.5) / N - 1);
        const double L = std::sqrt(d0[0] * d0[0] + d0[1] * d0[1] + d0[2] * d0[2]);
        // OCCT travaille Y en haut dans ses cubes : la direction du monde (Z en haut) s'en déduit
        const V3 d{d0[0] / L, -d0[2] / L, d0[1] / L};
        V3 c = lumiere(A, tourne(d, rot));
        // Sans lancer de rayons, rien ne se reflète : un sol clair remplace le bas du ciel
        if (sol && d[2] < 0) {
          const double t = smooth(0.0, 0.15, -d[2]);
          for (int k = 0; k < 3; k++) c[k] += ((*sol)[k] - c[k]) * t;
        }
        unsigned char* o = im->ChangeRawValue(y, x);
        for (int k = 0; k < 3; k++) {
          const double v = std::min(1.0, c[k] * force / ECH_RAPIDE);
          const double s = v <= 0.0031308 ? v * 12.92 : 1.055 * std::pow(v, 1 / 2.4) - 0.055;
          o[k] = static_cast<unsigned char>(std::lround(s * 255));
        }
      }
    F(f) = im;
  }
  return new Graphic3d_CubeMapSeparate(F);
}

Graphic3d_MaterialAspect matiere(const MatiereRendu* d, unsigned hex) {
  const V3 c = linHex(hex);
  Graphic3d_MaterialAspect m(Graphic3d_NameOfMaterial_DEFAULT);
  m.SetMaterialType(Graphic3d_MATERIAL_PHYSIC);
  const float rg = static_cast<float>(c[0]), vt = static_cast<float>(c[1]), bl = static_cast<float>(c[2]);
  const double metal = d ? d->metal : 0.15, rugo = d ? d->rugosite : 0.42;
  Graphic3d_PBRMaterial p;
  p.SetColor(Quantity_ColorRGBA(rg, vt, bl, 1.f));
  p.SetMetallic(static_cast<float>(metal));
  p.SetRoughness(static_cast<float>(std::max(0.04, rugo)));
  p.SetIOR(1.5f);
  m.SetPBRMaterial(p);
  Graphic3d_BSDF b = Graphic3d_BSDF::CreateMetallicRoughness(p);
  const double vernis = d ? d->vernis : 0.25;
  if (d && d->transmission > 0) {
    b = Graphic3d_BSDF::CreateGlass(NCollection_Vec3<float>(1, 1, 1), NCollection_Vec3<float>(rg, vt, bl), d->transmission < 1 ? 0.2f : 0.02f, static_cast<float>(d->indice));
    m.SetTransparency(static_cast<float>(0.6 * d->transmission));
  } else if (vernis > 0) {
    const float k = static_cast<float>(vernis);
    b.Kc = NCollection_Vec4<float>(k, k, k, static_cast<float>(d ? d->vernisRugosite : 0.25));
    b.FresnelCoat = Graphic3d_Fresnel::CreateDielectric(1.5f);
  }
  m.SetBSDF(b);
  return m;
}
}  // namespace

MoteurRendu::MoteurRendu(wxWindow* parent, const occ::handle<OpenGl_GraphicDriver>& pilote) {
  visu_ = new V3d_Viewer(pilote);
  lampe_ = new V3d_DirectionalLight(gp_Dir(0, 0, -1));
  visu_->AddLight(lampe_);
  // Le lancer de rayons multiplie la lumière du ciel par l'ambiante : sans elle, le ciel n'éclaire rien
  visu_->AddLight(new V3d_AmbientLight(Quantity_NOC_WHITE));
  visu_->SetLightOn();
  fenetre_ = new wxWindow(parent, wxID_ANY, wxDefaultPosition, wxSize(64, 64));
  fenetre_->Hide();
  vue_ = visu_->CreateView();
  vue_->SetWindow(new WNT_Window(reinterpret_cast<Aspect_Handle>(fenetre_->GetHWND())));
  Graphic3d_RenderingParams& r = vue_->ChangeRenderingParams();
  r.NbMsaaSamples = 0;  // le bord lisse vient des passes, l'œil bouge sous le pixel
  r.PbrEnvPow2Size = 9;
  r.ShadowMapResolution = 4096;
  vue_->SetShadingModel(Graphic3d_TypeOfShadingModel_Pbr);
  vue_->View()->SetBackgroundType(Graphic3d_TOB_NONE);
  vue_->SetBackgroundColor(Quantity_NOC_BLACK);
  vue_->Camera()->SetProjectionType(Graphic3d_Camera::Projection_Perspective);
  vue_->SetAutoZFitMode(false);
  contexte_ = new AIS_InteractiveContext(visu_);
}

MoteurRendu::~MoteurRendu() {
  vue_->View()->SetFBO(occ::handle<Standard_Transient>());
  if (!tampon_.IsNull()) vue_->View()->FBORelease(tampon_);
  if (!tamponOmbre_.IsNull()) vue_->View()->FBORelease(tamponOmbre_);
  objets_.clear();
  sol_.Nullify();
  contexte_.Nullify();
  vue_->Remove();
  vue_.Nullify();
  visu_.Nullify();
}

void MoteurRendu::pieces(const std::vector<PieceRendu>& L) {
  for (auto& o : objets_) contexte_->Remove(o, false);
  objets_.clear();
  pieces_ = L;
  Bnd_Box b;
  for (const PieceRendu& p : pieces_) {
    if (p.forme.IsNull()) continue;
    BRepBndLib::Add(p.forme, b);
    BRepMesh_IncrementalMesh(p.forme, 0.1, false, 0.3, true);
  }
  if (!b.IsVoid()) b.Get(box_[0], box_[1], box_[2], box_[3], box_[4], box_[5]);
  cx_ = (box_[0] + box_[3]) / 2, cy_ = (box_[1] + box_[4]) / 2, z0_ = box_[2];
  R_ = 0.5 * std::sqrt(std::pow(box_[3] - box_[0], 2) + std::pow(box_[4] - box_[1], 2) + std::pow(box_[5] - box_[2], 2));
  if (R_ <= 0) R_ = 50;
  for (const PieceRendu& p : pieces_) {
    if (p.forme.IsNull()) continue;
    occ::handle<AIS_Shape> a = new AIS_Shape(p.forme);
    a->Attributes()->SetAutoTriangulation(false);
    const MatiereRendu* d = matiereRendu(p.cle);
    a->SetMaterial(matiere(d, p.couleur));
    a->Attributes()->SetFaceBoundaryDraw(false);
    contexte_->Display(a, AIS_Shaded, -1, false);
    contexte_->Deactivate(a);
    objets_.push_back(a);
  }
  reprendre();
}

void MoteurRendu::boite(double b[6]) const {
  for (int i = 0; i < 6; i++) b[i] = box_[i];
}

void MoteurRendu::reglerRayons(bool oui) {
  Graphic3d_RenderingParams& r = vue_->ChangeRenderingParams();
  rayons_ = oui;
  r.Method = oui ? Graphic3d_RM_RAYTRACING : Graphic3d_RM_RASTERIZATION;
  r.IsGlobalIlluminationEnabled = oui;
  r.RaytracingDepth = 8;
  r.IsShadowEnabled = true;
  r.IsReflectionEnabled = oui;
  r.IsTransparentShadowEnabled = oui;
  r.IsAntialiasingEnabled = oui;
  r.UseEnvironmentMapBackground = false;
  r.RadianceClampingValue = 60;
  r.ToneMappingMethod = Graphic3d_ToneMappingMethod_Disabled;
  r.Resolution = 96;
  r.CameraApertureRadius = 0;
}

void MoteurRendu::appliquer(const ReglagesRendu& s) {
  // Les arêtes de la CAO : en rapide seulement
  const bool aretes = s.aretes == "cao" && s.moteur != "rayons";
  for (auto& o : objets_)
    if (o->Attributes()->FaceBoundaryDraw() != aretes) {
      o->Attributes()->SetFaceBoundaryDraw(aretes);
      o->Attributes()->SetFaceBoundaryAspect(new Prs3d_LineAspect(Quantity_NOC_BLACK, Aspect_TOL_SOLID, 1.0));
      contexte_->Redisplay(o, false);
    }
  st_ = s;
  const Ambiance A = ambiance(s.amb);
  cle_ = A.cle;
  const double rot = s.envRot * PI / 180;
  reglerRayons(s.moteur == "rayons");
  if (rayons_) {
    vue_->SetBackgroundCubeMap(nullptr, false);
    vue_->SetTextureEnv(new Graphic3d_TextureEnv(panorama(A, rot, s.envInt)));
  } else {
    vue_->SetTextureEnv(nullptr);
    const V3 s0 = linTexte(solHex());
    const V3 solReflet{s0[0] * 0.45, s0[1] * 0.45, s0[2] * 0.45};
    const bool avecSol = (s.solOn || s.miroir) && s.fond != "studio";
    vue_->SetBackgroundCubeMap(cubeAmbiance(A, rot, s.envInt, avecSol ? &solReflet : nullptr), true);
    // Le ciel n'éclaire que les reflets : le fond est composé à la finition
    vue_->View()->SetBackgroundType(Graphic3d_TOB_NONE);
    vue_->SetBackgroundColor(Quantity_NOC_BLACK);
  }
  // La lampe : la direction de l'ambiance tournée avec elle
  const double a = (cle_[0] + s.envRot) * PI / 180, e = cle_[1] * PI / 180;
  lampe_->SetDirection(gp_Dir(-std::cos(e) * std::cos(a), -std::cos(e) * std::sin(a), -std::sin(e)));
  const double force = s.lum * (s.amb == "noir" ? 0.6 : 1.4) * PI;
  const double cone = std::max(s.douceur, 0.5) * 0.4 * PI / 180;
  const double omega = 2 * PI * (1 - std::cos(cone));
  lampe_->SetIntensity(static_cast<float>(rayons_ ? force / omega : force / ECH_RAPIDE));
  lampe_->SetCastShadows(false);
  lampe_->SetSmoothAngle(static_cast<float>(cone));
  visu_->UpdateLights();
  // Le sol : un disque, fondu dans le fond à la finition
  if (!sol_.IsNull()) {
    contexte_->Remove(sol_, false);
    sol_.Nullify();
  }
  if (rayons_ && (s.solOn || s.miroir) && s.fond != "studio") {
    const gp_Ax2 ax(gp_Pnt(cx_, cy_, z0_ - R_ * 0.001), gp::DZ());
    TopoDS_Edge ar = BRepBuilderAPI_MakeEdge(gp_Circ(ax, R_ * 8));
    TopoDS_Face f = BRepBuilderAPI_MakeFace(gp_Pln(ax), BRepBuilderAPI_MakeWire(ar));
    BRepMesh_IncrementalMesh(f, R_ * 0.05, false, 0.1, false);
    sol_ = new AIS_Shape(f);
    sol_->Attributes()->SetAutoTriangulation(false);
    // Hors de l'ombre, le sol garde la couleur choisie : albédo = couleur × π / lumière reçue (rtFloorMat)
    const std::array<double, 3> eUp = eclairement(A);
    const V3 c0 = linTexte(solHex());
    const double eKey = force * std::max(0.0, std::sin(e));
    V3 c;
    for (int k = 0; k < 3; k++) c[k] = std::min(1.0, c0[k] * PI / std::max(1e-3, eUp[k] * s.envInt + eKey));
    Graphic3d_MaterialAspect m(Graphic3d_NameOfMaterial_DEFAULT);
    m.SetMaterialType(Graphic3d_MATERIAL_PHYSIC);
    Graphic3d_PBRMaterial p;
    p.SetColor(Quantity_ColorRGBA(static_cast<float>(c[0]), static_cast<float>(c[1]), static_cast<float>(c[2]), 1.f));
    p.SetMetallic(0);
    p.SetRoughness(s.miroir ? 0.2f : 0.85f);
    m.SetPBRMaterial(p);
    Graphic3d_BSDF b = Graphic3d_BSDF::CreateDiffuse(NCollection_Vec3<float>(static_cast<float>(c[0]), static_cast<float>(c[1]), static_cast<float>(c[2])));
    if (s.miroir) {
      b.Kc = NCollection_Vec4<float>(1, 1, 1, 0.02f);
      b.FresnelCoat = Graphic3d_Fresnel::CreateConstant(0.25f);
    }
    m.SetBSDF(b);
    sol_->SetMaterial(m);
    contexte_->Display(sol_, AIS_Shaded, -1, false);
    contexte_->Deactivate(sol_);
  }
  reprendre();
  mw_ = 0;
}

void MoteurRendu::poserCamera(const CameraRendu& c) {
  const occ::handle<Graphic3d_Camera>& k = vue_->Camera();
  k->SetEye(gp_Pnt(c.oeil[0], c.oeil[1], c.oeil[2]));
  k->SetCenter(gp_Pnt(c.cible[0], c.cible[1], c.cible[2]));
  k->SetUp(gp_Dir(c.haut[0], c.haut[1], c.haut[2]));
  k->OrthogonalizeUp();
  k->SetFOVy(2 * std::atan(18 / focale_ / (16.0 / 9)) * 180 / PI);
  vue_->ZFitAll();
}

void MoteurRendu::camera(const CameraRendu& c, double focale) {
  cam_ = c;
  focale_ = focale;
  reprendre();
  mw_ = 0;
}

bool MoteurRendu::passe(int w, int h) {
  const auto t0 = std::chrono::steady_clock::now();
  // Le lancer de rayons prend la taille de ce tampon : elle doit être celle de l'image
  const int tw = w, th = h;
  if (tampon_.IsNull() || tw != tw_ || th != th_) {
    if (!tampon_.IsNull()) {
      vue_->View()->SetFBO(occ::handle<Standard_Transient>());
      vue_->View()->FBORelease(tampon_);
    }
    tampon_ = vue_->View()->FBOCreate(tw, th);
    vue_->View()->SetFBO(tampon_);
    tw_ = tw, th_ = th;
    reprendre();
  }
  const bool ok = rayons_ ? passeRayons(w, h) : passeRapide(w, h);
  msPasse = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
  return ok;
}

namespace {
void lirePx(const std::vector<float>& p, int w, int h, double u, double v, float* o) {
  const double X = u * w - 0.5, Y = v * h - 0.5;
  const int x0 = std::clamp(static_cast<int>(std::floor(X)), 0, w - 1), y0 = std::clamp(static_cast<int>(std::floor(Y)), 0, h - 1);
  const int x1 = std::min(w - 1, x0 + 1), y1 = std::min(h - 1, y0 + 1);
  const float fx = static_cast<float>(std::clamp(X - x0, 0.0, 1.0)), fy = static_cast<float>(std::clamp(Y - y0, 0.0, 1.0));
  for (int k = 0; k < 4; k++) {
    const float a = p[4 * (static_cast<size_t>(y0) * w + x0) + k], b = p[4 * (static_cast<size_t>(y0) * w + x1) + k];
    const float c = p[4 * (static_cast<size_t>(y1) * w + x0) + k], d = p[4 * (static_cast<size_t>(y1) * w + x1) + k];
    o[k] = (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  }
}
double halton(int i, int b) {
  double f = 1, r = 0;
  i++;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i /= b;
  }
  return r;
}
struct Repere {
  V3 o, f, d, u;
  double tanV, asp;
};
Repere repere(const CameraRendu& c, double fovy, double asp) {
  Repere r;
  r.o = c.oeil;
  V3 a{c.cible[0] - c.oeil[0], c.cible[1] - c.oeil[1], c.cible[2] - c.oeil[2]};
  const double D = std::sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  r.f = {a[0] / D, a[1] / D, a[2] / D};
  V3 x{r.f[1] * c.haut[2] - r.f[2] * c.haut[1], r.f[2] * c.haut[0] - r.f[0] * c.haut[2], r.f[0] * c.haut[1] - r.f[1] * c.haut[0]};
  const double L = std::sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
  r.d = {x[0] / L, x[1] / L, x[2] / L};
  r.u = {r.d[1] * r.f[2] - r.d[2] * r.f[1], r.d[2] * r.f[0] - r.d[0] * r.f[2], r.d[0] * r.f[1] - r.d[1] * r.f[0]};
  r.tanV = std::tan(fovy * PI / 360);
  r.asp = asp;
  return r;
}
}  // namespace

// La couverture de la pièce : la même vue sur fond noir puis sur fond blanc, en calcul rapide ; les matières ne bougent pas
bool MoteurRendu::masque(int w, int h, const CameraRendu& c) {
  if (mw_ == w && mh_ == h && !masque_.empty()) return true;
  const Graphic3d_RenderingParams garde = vue_->RenderingParams();
  Graphic3d_RenderingParams& r = vue_->ChangeRenderingParams();
  r.Method = Graphic3d_RM_RASTERIZATION;
  r.NbMsaaSamples = 8;
  if (!sol_.IsNull()) contexte_->Erase(sol_, false);
  poserCamera(c);
  vue_->Camera()->SetAspect(static_cast<double>(w) / h);
  vue_->ZFitAll();
  V3d_ImageDumpOptions op;
  op.Width = w, op.Height = h;
  op.ToAdjustAspect = false;
  op.BufferType = Graphic3d_BT_RGB;
  Image_PixMap noir, blanc;
  noir.SetTopDown(true);
  blanc.SetTopDown(true);
  noir.InitZero(Image_Format_RGB, w, h);
  blanc.InitZero(Image_Format_RGB, w, h);
  vue_->SetBackgroundColor(Quantity_NOC_BLACK);
  bool ok = vue_->ToPixMap(noir, op);
  vue_->SetBackgroundColor(Quantity_NOC_WHITE);
  ok = ok && vue_->ToPixMap(blanc, op);
  vue_->SetBackgroundColor(Quantity_NOC_BLACK);
  if (!sol_.IsNull()) contexte_->Display(sol_, AIS_Shaded, -1, false);
  vue_->ChangeRenderingParams() = garde;
  if (!ok) return false;
  masque_.resize(static_cast<size_t>(w) * h);
  for (int y = 0; y < h; y++) {
    const unsigned char* n = noir.Row(y);
    const unsigned char* f = blanc.Row(y);
    for (int x = 0; x < w; x++) masque_[static_cast<size_t>(y) * w + x] = 1.f - std::clamp((f[x * 3 + 1] - n[x * 3 + 1]) / 255.f, 0.f, 1.f);
  }
  mw_ = w, mh_ = h;
  return true;
}

bool MoteurRendu::passeRayons(int w, int h) {
  if (!masque(w, h, cam_)) {
    erreur = "masque impossible";
    return false;
  }
  if (passes_ == 0) {
    poserCamera(cam_);
    vue_->Camera()->SetAspect(static_cast<double>(w) / h);
    // Une plage large : le sol s'étend loin, et la précision reste bonne
    { const double dk = vue_->Camera()->Distance(); vue_->Camera()->SetZRange(dk * 0.1, dk + 40 * R_); }
    Graphic3d_RenderingParams& r = vue_->ChangeRenderingParams();
    r.CameraApertureRadius = st_.ouv > 0 ? static_cast<float>(focale_ / st_.ouv / 2) : 0.f;
    const double dx = cam_.cible[0] - cam_.oeil[0], dy = cam_.cible[1] - cam_.oeil[1], dz = cam_.cible[2] - cam_.oeil[2];
    r.CameraFocalPlaneDist = static_cast<float>(st_.map > 0 ? st_.map : std::sqrt(dx * dx + dy * dy + dz * dz));
  }
  V3d_ImageDumpOptions op;
  op.Width = w, op.Height = h;
  op.ToAdjustAspect = false;
  op.BufferType = Graphic3d_BT_RGB_RayTraceHdrLeft;
  Image_PixMap im;
  im.SetTopDown(true);
  im.InitZero(Image_Format_RGBF, w, h);
  // Directement, sans ToPixMap : il remet la caméra à chaque appel, et OCCT recommencerait son accumulation
  vue_->View()->SetFBO(tampon_);
  vue_->Invalidate();
  vue_->Redraw();
  if (!vue_->View()->BufferDump(im, op.BufferType)) {
    erreur = "le lancer de rayons n'a pas répondu";
    return false;
  }
  // OCCT moyenne lui-même : l'image rendue est déjà celle de toutes les passes
  passes_++;
  const double fovy = 2 * std::atan(18 / focale_ / (16.0 / 9)) * 180 / PI;
  const Repere Rc = repere(cam_, fovy, 16.0 / 9);
  image_.w = w, image_.h = h;
  image_.px.resize(4 * static_cast<size_t>(w) * h);
  const bool hautEnBas = im.IsTopDown();
  for (int y = 0; y < h; y++) {
    const float* l = reinterpret_cast<const float*>(im.Row(hautEnBas ? y : h - 1 - y));
    float* o = image_.px.data() + 4 * static_cast<size_t>(y) * w;
    const float* m = masque_.data() + static_cast<size_t>(y) * w;
    for (int x = 0; x < w; x++) {
      double al = m[x];
      if (!sol_.IsNull() && al < 0.999) {
        const double nx = 2 * (x + 0.5) / w - 1, ny = 1 - 2 * (y + 0.5) / h;
        const V3 ray{Rc.f[0] + Rc.d[0] * nx * Rc.tanV * Rc.asp + Rc.u[0] * ny * Rc.tanV, Rc.f[1] + Rc.d[1] * nx * Rc.tanV * Rc.asp + Rc.u[1] * ny * Rc.tanV, Rc.f[2] + Rc.d[2] * nx * Rc.tanV * Rc.asp + Rc.u[2] * ny * Rc.tanV};
        if (ray[2] < -1e-9) {
          const double t = (z0_ - Rc.o[2]) / ray[2];
          const double P[3] = {Rc.o[0] + ray[0] * t, Rc.o[1] + ray[1] * t, z0_};
          al += alphaSol(P) * (1 - al);
        }
      }
      const float k = m[x] > 0.999f ? 1.f : static_cast<float>(al);
      o[4 * x] = l[3 * x] * k, o[4 * x + 1] = l[3 * x + 1] * k, o[4 * x + 2] = l[3 * x + 2] * k, o[4 * x + 3] = static_cast<float>(al);
    }
  }
  return true;
}

// Les pièces seules, sur fond vide : rgb tel quel (donc déjà multiplié par la couverture), a la couverture
bool MoteurRendu::rendre(const CameraRendu& c, double fovy, bool ortho, double echelle, int w, int h, std::vector<float>& px) {
  const occ::handle<Graphic3d_Camera>& k = vue_->Camera();
  k->SetProjectionType(ortho ? Graphic3d_Camera::Projection_Orthographic : Graphic3d_Camera::Projection_Perspective);
  k->SetEye(gp_Pnt(c.oeil[0], c.oeil[1], c.oeil[2]));
  k->SetCenter(gp_Pnt(c.cible[0], c.cible[1], c.cible[2]));
  k->SetUp(gp_Dir(c.haut[0], c.haut[1], c.haut[2]));
  k->OrthogonalizeUp();
  if (ortho) k->SetScale(echelle);
  else k->SetFOVy(fovy);
  k->SetAspect(static_cast<double>(w) / h);
  vue_->ZFitAll();
  vue_->SetBackgroundColor(Quantity_Color(1, 0, 1, Quantity_TOC_RGB));
  if (w == tw_ && h == th_) vue_->View()->SetFBO(tampon_);
  else {
    if (tamponOmbre_.IsNull()) tamponOmbre_ = vue_->View()->FBOCreate(w, h);
    vue_->View()->SetFBO(tamponOmbre_);
  }
  V3d_ImageDumpOptions op;
  op.Width = w, op.Height = h;
  op.ToAdjustAspect = false;
  op.BufferType = Graphic3d_BT_RGBA;
  Image_PixMap im;
  im.SetTopDown(true);
  im.InitZero(Image_Format_RGBA, w, h);
  if (!vue_->ToPixMap(im, op)) return false;
  static float TABLE[256];
  static bool pret = false;
  if (!pret) {
    for (int t = 0; t < 256; t++) TABLE[t] = static_cast<float>(lin(t / 255.0) * ECH_RAPIDE);
    pret = true;
  }
  px.resize(4 * static_cast<size_t>(w) * h);
  const bool hautEnBas = im.IsTopDown();
  for (int y = 0; y < h; y++) {
    const unsigned char* l = im.Row(hautEnBas ? y : h - 1 - y);
    float* o = px.data() + 4 * static_cast<size_t>(y) * w;
    for (int x = 0; x < w; x++) {
      o[4 * x] = TABLE[l[4 * x]], o[4 * x + 1] = TABLE[l[4 * x + 1]], o[4 * x + 2] = TABLE[l[4 * x + 2]];
      const bool fond = l[4 * x] == 255 && l[4 * x + 1] == 0 && l[4 * x + 2] == 255;
      o[4 * x + 3] = fond ? 0.f : 1.f;
      if (fond) o[4 * x] = o[4 * x + 1] = o[4 * x + 2] = 0.f;
    }
  }
  return true;
}

// Le sol tel que l'œil le voit à ce pixel : la couverture du disque (fondu dans le fond)
double MoteurRendu::alphaSol(const double P[3]) const {
  const double d = std::hypot(P[0] - cx_, P[1] - cy_);
  return 1 - smooth(R_ * 1.6, R_ * 5.5, d);
}

bool MoteurRendu::passeRapide(int w, int h) {
  const double fovy = 2 * std::atan(18 / focale_ / (16.0 / 9)) * 180 / PI;
  // Chaque passe bouge un peu l'œil (bords lisses, profondeur de champ) et la lampe (ombre douce) ; la première reste nette
  CameraRendu c = cam_;
  const Repere R0 = repere(cam_, fovy, 16.0 / 9);
  const double D = std::sqrt(std::pow(cam_.cible[0] - cam_.oeil[0], 2) + std::pow(cam_.cible[1] - cam_.oeil[1], 2) + std::pow(cam_.cible[2] - cam_.oeil[2], 2));
  const int i = passes_;
  if (i > 0) {
    const double pixel = 2 * D * R0.tanV / h;
    const double jx = (halton(i, 2) - 0.5) * pixel, jy = (halton(i, 3) - 0.5) * pixel;
    double ax = 0, ay = 0;
    const double focal = st_.map > 0 ? st_.map : D;
    if (st_.ouv > 0) {
      const double rr = std::sqrt(halton(i, 11)) * focale_ / st_.ouv / 2, tt = 2 * PI * halton(i, 13);
      ax = rr * std::cos(tt), ay = rr * std::sin(tt);
    }
    for (int k = 0; k < 3; k++) {
      c.oeil[k] += R0.d[k] * (jx + ax) + R0.u[k] * (jy + ay);
      // Le point visé sur le plan net ne bouge pas (seul le décalage sous le pixel s'y ajoute)
      c.cible[k] = cam_.oeil[k] + R0.f[k] * focal + R0.d[k] * jx + R0.u[k] * jy;
    }
  }
  // La lampe : un point de son disque
  double aL = (cle_[0] + st_.envRot) * PI / 180, eL = cle_[1] * PI / 180;
  if (i > 0 && st_.douceur > 0) {
    const double s = st_.douceur * 0.4 * PI / 180, r1 = std::sqrt(halton(i, 5)), r2 = 2 * PI * halton(i, 7);
    aL += r1 * std::cos(r2) * s / std::max(0.2, std::cos(eL));
    eL += r1 * std::sin(r2) * s;
  }
  const V3 versLampe{std::cos(eL) * std::cos(aL), std::cos(eL) * std::sin(aL), std::sin(eL)};
  lampe_->SetDirection(gp_Dir(-versLampe[0], -versLampe[1], -versLampe[2]));
  if (!rendre(c, fovy, false, 0, w, h, pieces1_)) {
    erreur = "le calcul rapide n'a pas répondu";
    return false;
  }
  const bool studio = st_.fond == "studio";
  const bool avecSol = !studio && (st_.solOn || st_.miroir);
  const bool avecOmbre = !studio && st_.ombreOn;
  // Le reflet : la même vue depuis l'œil renversé sous le sol
  Repere M{};
  if (avecSol && st_.miroir) {
    CameraRendu mc = c;
    const double zs = z0_;
    mc.oeil[2] = 2 * zs - c.oeil[2];
    mc.cible[2] = 2 * zs - c.cible[2];
    const Repere Rc = repere(c, fovy, 16.0 / 9);
    mc.haut = {Rc.u[0], Rc.u[1], -Rc.u[2]};
    M = repere(mc, fovy, 16.0 / 9);
    if (!rendre(mc, fovy, false, 0, w, h, reflet_)) return false;
  }
  // L'ombre : la pièce vue de la lampe
  const int NO = 1024;
  Repere L{};
  const double demi = R_ * 1.6;
  if (avecOmbre) {
    CameraRendu lc;
    lc.cible = {cx_, cy_, (box_[2] + box_[5]) / 2};
    lc.oeil = {lc.cible[0] + versLampe[0] * R_ * 4, lc.cible[1] + versLampe[1] * R_ * 4, lc.cible[2] + versLampe[2] * R_ * 4};
    lc.haut = std::abs(versLampe[2]) > 0.99 ? V3{0, 1, 0} : V3{0, 0, 1};
    L = repere(lc, 30, 1);
    if (!rendre(lc, 0, true, 2 * demi, NO, NO, ombre_)) return false;
  }
  const Repere Rc = repere(c, fovy, 16.0 / 9);
  const V3 base = linTexte(solHex());
  if (somme_.size() != 4 * static_cast<size_t>(w) * h) somme_.assign(4 * static_cast<size_t>(w) * h, 0.0);
  const double ombreForce = st_.ombre;
  const auto ligne = [&](int y) {
    const double ny = 1 - 2 * (y + 0.5) / h;
    const float* a = pieces1_.data() + 4 * static_cast<size_t>(y) * w;
    double* s = somme_.data() + 4 * static_cast<size_t>(y) * w;
    for (int x = 0; x < w; x++) {
      const double nx = 2 * (x + 0.5) / w - 1;
      double under[4] = {0, 0, 0, 0};
      const double ap = a[4 * x + 3];
      if (ap < 0.999 && (avecSol || avecOmbre)) {
        const V3 ray{Rc.f[0] + Rc.d[0] * nx * Rc.tanV * Rc.asp + Rc.u[0] * ny * Rc.tanV, Rc.f[1] + Rc.d[1] * nx * Rc.tanV * Rc.asp + Rc.u[1] * ny * Rc.tanV, Rc.f[2] + Rc.d[2] * nx * Rc.tanV * Rc.asp + Rc.u[2] * ny * Rc.tanV};
        if (ray[2] < -1e-9) {
          const double t = (z0_ - Rc.o[2]) / ray[2];
          const double P[3] = {Rc.o[0] + ray[0] * t, Rc.o[1] + ray[1] * t, z0_};
          const double dc = std::hypot(P[0] - cx_, P[1] - cy_);
          if (avecSol) {
            const double al = st_.solOn ? alphaSol(P) : 0;
            double ra = 0, refl[3] = {0, 0, 0}, f = 0;
            if (st_.miroir) {
              const double qx = P[0] - M.o[0], qy = P[1] - M.o[1], qz = P[2] - M.o[2];
              const double zq = qx * M.f[0] + qy * M.f[1] + qz * M.f[2];
              if (zq > 1e-6) {
                const double xq = (qx * M.d[0] + qy * M.d[1] + qz * M.d[2]) / (zq * M.tanV * M.asp), yq = (qx * M.u[0] + qy * M.u[1] + qz * M.u[2]) / (zq * M.tanV);
                if (std::abs(xq) < 1 && std::abs(yq) < 1) {
                  float r4[4];
                  lirePx(reflet_, w, h, (xq + 1) / 2, (1 - yq) / 2, r4);
                  ra = r4[3];
                  if (ra > 1e-4)
                    for (int k = 0; k < 3; k++) refl[k] = r4[k] / ra;
                  const double e = dc / std::max(R_ * 1.2, 1e-3);
                  f = std::exp(-e * e * 1.6) * 0.8;
                }
              }
            }
            if (st_.solOn) {
              const double m = std::clamp(f * ra * 0.7, 0.0, 1.0);
              for (int k = 0; k < 3; k++) under[k] = (base[k] + (refl[k] - base[k]) * m) * al;
              under[3] = al;
            } else {
              const double af = ra * f * 0.6;
              for (int k = 0; k < 3; k++) under[k] = refl[k] * af;
              under[3] = af;
            }
          }
          if (avecOmbre && dc < R_ * 6) {
            const double qx = P[0] - L.o[0], qy = P[1] - L.o[1], qz = P[2] - L.o[2];
            const double xq = (qx * L.d[0] + qy * L.d[1] + qz * L.d[2]) / demi, yq = (qx * L.u[0] + qy * L.u[1] + qz * L.u[2]) / demi;
            if (std::abs(xq) < 1 && std::abs(yq) < 1) {
              float o4[4];
              lirePx(ombre_, NO, NO, (xq + 1) / 2, (1 - yq) / 2, o4);
              const double sa = o4[3] * ombreForce;
              for (int k = 0; k < 3; k++) under[k] *= 1 - sa;
              under[3] = sa + under[3] * (1 - sa);
            }
          }
        }
      }
      for (int k = 0; k < 3; k++) s[4 * x + k] += a[4 * x + k] + under[k] * (1 - ap);
      s[4 * x + 3] += ap + under[3] * (1 - ap);
    }
  };
  {
    const int n = std::max(1u, std::min(16u, std::thread::hardware_concurrency()));
    std::vector<std::thread> T;
    for (int t = 0; t < n; t++)
      T.emplace_back([&, t] {
        for (int y = t; y < h; y += n) ligne(y);
      });
    for (auto& t : T) t.join();
  }
  passes_++;
  image_.w = w, image_.h = h;
  image_.px.resize(4 * static_cast<size_t>(w) * h);
  const double inv = 1.0 / passes_;
  for (size_t k = 0; k < image_.px.size(); k++) image_.px[k] = static_cast<float>(somme_[k] * inv);
  return true;
}

std::string MoteurRendu::solHex() const {
  if (!st_.solCol.empty()) return st_.solCol;
  return st_.fond == "degrade" ? st_.fc2 : st_.fond == "uni" ? st_.fc1 : st_.fond == "studio" ? "#d9dbdf" : "#9a9ea6";
}
