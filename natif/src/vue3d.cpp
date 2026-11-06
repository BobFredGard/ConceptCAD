#include "vue3d.h"

#include <wx/dcclient.h>

#include <Graphic3d_NameOfMaterial.hxx>
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
  visu_->SetLightOn();
  vue_ = visu_->CreateView();
  vue_->SetWindow(new WNT_Window(reinterpret_cast<Aspect_Handle>(GetHWND())));
  // Mêmes teintes que le thème sombre de la version navigateur (--bg #1c1c1e)
  vue_->SetBgGradientColors(couleur(0x1c, 0x1c, 0x1e), couleur(0x3a, 0x3a, 0x3e), Aspect_GradientFillMethod_Vertical);
  vue_->SetProj(V3d_XposYnegZpos);
  vue_->TriedronDisplay(Aspect_TOTP_LEFT_LOWER, Quantity_NOC_WHITE, 0.09);
  contexte_ = new AIS_InteractiveContext(visu_);
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
    affichee_->Attributes()->SetFaceBoundaryDraw(true);
    affichee_->Attributes()->SetFaceBoundaryAspect(new Prs3d_LineAspect(Quantity_NOC_BLACK, Aspect_TOL_SOLID, 1.0));
    affichee_->SetColor(Quantity_Color(0.62, 0.68, 0.76, Quantity_TOC_sRGB));
    affichee_->SetMaterial(Graphic3d_NameOfMaterial_Steel);
    contexte_->Display(affichee_, AIS_Shaded, -1, false);  // sélection préparée plus tard : un recalcul n'en paie pas le prix
  }
  if (ajusterVue) vue_->FitAll(0.08, false);
  else vue_->ZFitAll();
  vue_->Redraw();
}

void Vue3D::ajuster() {
  vue_->FitAll(0.08, false);
  vue_->Redraw();
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
  if (!e.LeftUp() || aBouge_ || affichee_.IsNull()) return;
  preparerSelection();
  const wxPoint p = e.GetPosition();
  contexte_->MoveTo(p.x, p.y, vue_, false);
  contexte_->SelectDetected(AIS_SelectionScheme_Replace);
  contexte_->UpdateCurrentViewer();
  TopoDS_Shape choisie;
  contexte_->InitSelected();
  if (contexte_->MoreSelected() && contexte_->HasSelectedShape()) choisie = contexte_->SelectedShape();
  if (surSelection) surSelection(choisie);
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
  } else if (!affichee_.IsNull()) {
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
