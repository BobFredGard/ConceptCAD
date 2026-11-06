// Vue 3D : une fenêtre wxWidgets dans laquelle OCCT dessine ; souris comme la version navigateur
// (gauche ou milieu : tourner, droit : déplacer, molette : zoomer) ; survol et clic sur les faces et arêtes.
#pragma once
#include <wx/wx.h>

#include <functional>
#include <vector>

#include <AIS_InteractiveContext.hxx>
#include <AIS_Shape.hxx>
#include <AIS_ViewCube.hxx>
#include <Aspect_DisplayConnection.hxx>
#include <OpenGl_GraphicDriver.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>
#include <V3d_View.hxx>
#include <V3d_Viewer.hxx>

class Vue3D : public wxWindow {
 public:
  explicit Vue3D(wxWindow* parent);
  void afficher(const TopoDS_Shape& forme, bool ajusterVue);
  void ajuster();
  void vueInitiale();
  // Prépare la sélection de la forme affichée (fait tout seul au premier passage de la souris).
  void preparerSelection();
  // Appelé après un clic : la face ou l'arête choisie, ou une forme vide.
  std::function<void(const TopoDS_Shape&)> surSelection;
  // Le choix des arêtes d'un congé : arêtes vives en noir, tangentes en gris ; les clics restent sur la pièce d'origine, même quand l'aperçu la remplace.
  void debutChoix(const TopoDS_Shape& vives, const TopoDS_Shape& tangentes);
  void montrerChoix(const TopoDS_Shape& choisies, const TopoDS_Shape& apercu, const std::vector<TopoDS_Face>& nouvelles);
  void finChoix();
  // Pour les essais : là où un point de la pièce tombe à l'écran, et un clic à cet endroit
  wxPoint pixelDe(double x, double y, double z) const;
  void cliquerEn(const wxPoint& p);

 private:
  void surPeinture(wxPaintEvent&);
  void surTaille(wxSizeEvent&);
  void surEnfonce(wxMouseEvent&);
  void surRelache(wxMouseEvent&);
  void surMouvement(wxMouseEvent&);
  void surMolette(wxMouseEvent&);
  void surPerteSouris(wxMouseCaptureLostEvent&);

  occ::handle<Aspect_DisplayConnection> connexion_;
  occ::handle<OpenGl_GraphicDriver> pilote_;
  occ::handle<V3d_Viewer> visu_;
  occ::handle<V3d_View> vue_;
  occ::handle<AIS_InteractiveContext> contexte_;
  occ::handle<AIS_ViewCube> cube_;
  occ::handle<AIS_Shape> affichee_;
  occ::handle<AIS_Shape> traitsVifs_, traitsLisses_, traitsChoisis_, apercu_;
  bool enChoix_ = false;
  double toleranceAvant_ = 2;
  bool selectionPrete_ = false, aBouge_ = false;
  wxPoint depart_, precedent_;
};
