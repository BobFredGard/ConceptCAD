// Vue 3D : une fenêtre wxWidgets dans laquelle OCCT dessine ; souris comme la version navigateur
// (gauche ou milieu : tourner, droit : déplacer, molette : zoomer) ; survol et clic sur les faces et arêtes.
#pragma once
#include <wx/wx.h>

#include <functional>
#include <utility>
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
#include <gp_Pnt.hxx>

class Vue3D : public wxWindow {
 public:
  explicit Vue3D(wxWindow* parent);
  // teintes : le solide de chaque corps et sa couleur (0xRRVVBB) ; sans elles, le bleu des pièces.
  void afficher(const TopoDS_Shape& forme, bool ajusterVue, const std::vector<std::pair<TopoDS_Shape, unsigned>>& teintes = {}, const std::vector<std::pair<TopoDS_Shape, double>>& transparences = {});
  // Pour les essais : la vue dans une image, et le temps des arêtes et du reflet au dernier affichage
  bool image(const wxString& chemin);
  void montrerFilets(const std::vector<std::vector<gp_Pnt>>& helices, const std::vector<std::vector<gp_Pnt>>& anneaux);
  double msAffichage() const { return msAffichage_; }
  double msImage() const { return msImage_; }
  void ajuster();
  void vueInitiale();
  // Prépare la sélection de la forme affichée (fait tout seul au premier passage de la souris).
  void preparerSelection();
  // Appelé après un clic : la face ou l'arête choisie, ou une forme vide.
  std::function<void(const TopoDS_Shape&)> surSelection;
  // Clic droit sans déplacement : ce qui est sous la souris, ou une forme vide
  std::function<void(const TopoDS_Shape&)> surDroit;
  void droitEn(const wxPoint& p);
  // Le choix des arêtes d'un congé : arêtes vives en noir, tangentes en gris ; les clics restent sur la pièce d'origine, même quand l'aperçu la remplace.
  void debutChoix(const TopoDS_Shape& vives, const TopoDS_Shape& tangentes);
  void montrerChoix(const TopoDS_Shape& choisies, const TopoDS_Shape& apercu, const std::vector<TopoDS_Face>& nouvelles);
  void finChoix();
  // Le choix de faces : seules les faces se cliquent ; les retenues en orange, la référence en bleu, par-dessus la pièce
  void debutChoixFaces();
  void montrerFaces(const std::vector<TopoDS_Face>& retenues, const std::vector<TopoDS_Face>& reference, const TopoDS_Shape& apercu, unsigned couleurApercu, const TopoDS_Shape& plan);
  std::vector<TopoDS_Face> facesChoisies() const;  // hors choix : les faces sélectionnées (Ctrl+clic pour en ajouter)
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
  void majReflets();

  occ::handle<Aspect_DisplayConnection> connexion_;
  occ::handle<OpenGl_GraphicDriver> pilote_;
  occ::handle<V3d_Viewer> visu_;
  occ::handle<V3d_View> vue_;
  occ::handle<AIS_InteractiveContext> contexte_;
  occ::handle<AIS_ViewCube> cube_;
  occ::handle<AIS_Shape> affichee_;
  occ::handle<AIS_Shape> traitsVifs_, traitsLisses_, traitsChoisis_, apercu_;
  occ::handle<AIS_Shape> facesRetenues_, faceReference_, planChoix_;
  bool modeFaces_ = false;
  occ::handle<AIS_Shape> filetsHelices_, filetsAnneaux_;  // les filets cosmétiques
  occ::handle<AIS_Shape> aretesVives_, aretesLisses_;  // les traits de la pièce, hors du choix d'un congé
  std::vector<occ::handle<AIS_Shape>> reflets_;  // chaque corps renversé sous le sol
  double sol_ = 0, msAffichage_ = 0, msImage_ = 0;
  bool refletsVus_ = false;
  bool enChoix_ = false;
  double toleranceAvant_ = 2;
  bool selectionPrete_ = false, aBouge_ = false;
  wxPoint depart_, precedent_;
};
