#include "vue3d.h"

#include <wx/dcclient.h>

#include <AIS_ColoredShape.hxx>
#include <Graphic3d_NameOfMaterial.hxx>
#include <Graphic3d_TransformPers.hxx>
#include <Prs3d_Drawer.hxx>
#include <Prs3d_LineAspect.hxx>
#include <Quantity_Color.hxx>
#include <TopAbs_ShapeEnum.hxx>
#include <WNT_Window.hxx>

namespace {
const int SEUIL_CLIC = 4;  // pixels : au-delà, le bouton gauche tourne la vue au lieu de sélectionner

Quantity_Color couleur(int r, int v, int b) { return Quantity_Color(r / 255.0, v / 255.0, b / 255.0, Quantity_TOC_sRGB); }

void reglerStyle(const occ::handle<AIS_InteractiveContext>& c, Prs3d_TypeOfHighlight type, const Quantity_Color& teinte) {
  const occ::handle<Prs3d_Drawer>& s = c->HighlightStyle(type);
  s->SetColor(teinte);
  s->SetDisplayMode(1);
  s->SetTransparency(0.25f);
}
}  // namespace

Vue3D::Vue3D(wxWindow* parent) : wxWindow(parent, 2005, wxDefaultPosition, wxDefaultSize, wxCLIP_CHILDREN | wxFULL_REPAINT_ON_RESIZE | wxWANTS_CHARS) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);  // tout le dessin vient d'OCCT
  connexion_ = new Aspect_DisplayConnection();
  pilote_ = new OpenGl_GraphicDriver(connexion_);
  visu_ = new V3d_Viewer(pilote_);
  visu_->SetDefaultLights();
  // Plus de lumière que par défaut : la pièce garde le bleu franc du navigateur
  for (const occ::handle<Graphic3d_CLight>& l : visu_->DefinedLights()) l->SetIntensity(l->Type() == Graphic3d_TypeOfLightSource_Ambient ? 2.2f : 1.3f);
  visu_->SetLightOn();
  vue_ = visu_->CreateView();
  vue_->SetWindow(new WNT_Window(reinterpret_cast<Aspect_Handle>(GetHWND())));
  vue_->SetBackgroundColor(couleur(0x13, 0x15, 0x19));  // le fond de la scène du navigateur
  vue_->SetProj(V3d_XposYnegZpos);
  contexte_ = new AIS_InteractiveContext(visu_);
  // Le cube de vue, en haut à droite comme dans le navigateur
  cube_ = new AIS_ViewCube();
  cube_->SetSize(FromDIP(38));
  cube_->SetFontHeight(FromDIP(8));
  cube_->SetDrawAxes(false);
  cube_->SetFont("Arial");
  cube_->SetBoxSideLabel(V3d_Xpos, "DROITE");
  cube_->SetBoxSideLabel(V3d_Xneg, "GAUCHE");
  cube_->SetBoxSideLabel(V3d_Ypos, "ARRIERE");
  cube_->SetBoxSideLabel(V3d_Yneg, "FACE");
  cube_->SetBoxSideLabel(V3d_Zpos, "DESSUS");
  cube_->SetBoxSideLabel(V3d_Zneg, "DESSOUS");
  cube_->SetBoxColor(couleur(0x3a, 0x3c, 0x42));
  cube_->SetTextColor(Quantity_NOC_WHITE);
  cube_->SetTransformPersistence(new Graphic3d_TransformPers(Graphic3d_TMF_TriedronPers, Aspect_TOTP_RIGHT_UPPER, NCollection_Vec2<int>(FromDIP(58), FromDIP(58))));
  cube_->SetZLayer(Graphic3d_ZLayerId_Topmost);
  contexte_->Display(cube_, false);
  contexte_->SetPixelTolerance(4);
  reglerStyle(contexte_, Prs3d_TypeOfHighlight_LocalDynamic, couleur(0x0a, 0x84, 0xff));
  reglerStyle(contexte_, Prs3d_TypeOfHighlight_LocalSelected, couleur(0x30, 0xd1, 0x58));

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
}

void Vue3D::afficher(const TopoDS_Shape& forme, bool ajusterVue) {
  if (!affichee_.IsNull()) contexte_->Remove(affichee_, false);
  affichee_.Nullify();
  selectionPrete_ = false;
  if (!forme.IsNull()) {
    affichee_ = new AIS_Shape(forme);
    affichee_->Attributes()->SetAutoTriangulation(false);  // le maillage vient de mailler()
    affichee_->SetMaterial(Graphic3d_NameOfMaterial_Plastified);
    affichee_->SetColor(couleur(0x14, 0xa8, 0xff));  // le bleu des pièces du navigateur
    // Après la couleur, qui repeint aussi les arêtes
    affichee_->Attributes()->SetFaceBoundaryDraw(true);
    affichee_->Attributes()->SetFaceBoundaryAspect(new Prs3d_LineAspect(Quantity_NOC_BLACK, Aspect_TOL_SOLID, 1.0));
    contexte_->Display(affichee_, AIS_Shaded, -1, false);  // sélection préparée plus tard : un recalcul n'en paie pas le prix
  }
  if (ajusterVue) vue_->FitAll(0.2, false);
  else vue_->ZFitAll();
  vue_->Redraw();
}

void Vue3D::ajuster() {
  vue_->FitAll(0.2, false);
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
  if (!e.RightDown()) vue_->StartRotation(depart_.x, depart_.y);
}

void Vue3D::surRelache(wxMouseEvent& e) {
  if (HasCapture()) ReleaseMouse();
  if (!e.LeftUp() || aBouge_) return;
  cliquerEn(e.GetPosition());
}

void Vue3D::cliquerEn(const wxPoint& p) {
  preparerSelection();
  contexte_->MoveTo(p.x, p.y, vue_, false);
  if (contexte_->HasDetected()) {
    const occ::handle<AIS_ViewCubeOwner> face = occ::down_cast<AIS_ViewCubeOwner>(contexte_->DetectedOwner());
    if (!face.IsNull()) {
      cube_->HandleClick(face);
      vue_->Redraw();
      return;
    }
  }
  if (affichee_.IsNull()) return;
  contexte_->SelectDetected(AIS_SelectionScheme_Replace);
  contexte_->UpdateCurrentViewer();
  TopoDS_Shape choisie;
  contexte_->InitSelected();
  if (contexte_->MoreSelected() && contexte_->HasSelectedShape()) choisie = contexte_->SelectedShape();
  if (enChoix_) contexte_->ClearSelected(true);  // ce qui est retenu a son propre trait orange
  if (surSelection) surSelection(choisie);
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
  affichee_->Attributes()->SetFaceBoundaryDraw(false);
  contexte_->Redisplay(affichee_, false);
  traitsVifs_ = trait(contexte_, vives, couleur(0, 0, 0), 1.2);
  traitsLisses_ = trait(contexte_, tangentes, couleur(0x8a, 0x8f, 0x99), 1.0);
  vue_->Redraw();
}

void Vue3D::montrerChoix(const TopoDS_Shape& choisies, const TopoDS_Shape& apercu, const std::vector<TopoDS_Face>& nouvelles) {
  retirer(contexte_, traitsChoisis_);
  retirer(contexte_, apercu_);
  if (!choisies.IsNull()) traitsChoisis_ = trait(contexte_, choisies, couleur(0xff, 0x9f, 0x0a), 3.0);
  if (!apercu.IsNull()) {
    occ::handle<AIS_ColoredShape> a = new AIS_ColoredShape(apercu);
    a->Attributes()->SetAutoTriangulation(false);
    a->SetMaterial(Graphic3d_NameOfMaterial_Plastified);
    a->SetColor(couleur(0x14, 0xa8, 0xff));
    for (const TopoDS_Face& f : nouvelles) a->SetCustomColor(f, couleur(0xff, 0x7a, 0x1f));
    contexte_->Display(a, AIS_Shaded, -1, false);
    apercu_ = a;
    contexte_->SetTransparency(affichee_, 1.0, false);  // toujours là pour recevoir les clics, mais on voit l'aperçu
  } else {
    contexte_->UnsetTransparency(affichee_, false);
  }
  vue_->Redraw();
}

void Vue3D::finChoix() {
  if (!enChoix_) return;
  enChoix_ = false;
  retirer(contexte_, traitsVifs_);
  retirer(contexte_, traitsLisses_);
  retirer(contexte_, traitsChoisis_);
  retirer(contexte_, apercu_);
  contexte_->SetPixelTolerance(static_cast<int>(toleranceAvant_));
  contexte_->ClearSelected(false);
  if (!affichee_.IsNull()) {
    contexte_->UnsetTransparency(affichee_, false);
    affichee_->Attributes()->SetFaceBoundaryDraw(true);
    contexte_->Redisplay(affichee_, false);
  }
  vue_->Redraw();
}

void Vue3D::surMouvement(wxMouseEvent& e) {
  const wxPoint p = e.GetPosition();
  if (e.LeftIsDown() || e.MiddleIsDown()) {
    if (!aBouge_ && std::abs(p.x - depart_.x) + std::abs(p.y - depart_.y) <= SEUIL_CLIC) return;
    aBouge_ = true;
    vue_->Rotation(p.x, p.y);
  } else if (e.RightIsDown()) {
    aBouge_ = true;
    vue_->Pan(p.x - precedent_.x, precedent_.y - p.y);
    precedent_ = p;
  } else {
    preparerSelection();
    contexte_->MoveTo(p.x, p.y, vue_, true);
  }
}

void Vue3D::surMolette(wxMouseEvent& e) {
  const wxPoint p = e.GetPosition();  // wxWidgets la donne déjà dans le repère de cette fenêtre
  vue_->StartZoomAtPoint(p.x, p.y);
  const int d = e.GetWheelRotation() / 4;
  vue_->ZoomAtPoint(p.x, p.y, p.x + d, p.y + d);
  vue_->Redraw();
}

void Vue3D::surPerteSouris(wxMouseCaptureLostEvent&) { aBouge_ = true; }
