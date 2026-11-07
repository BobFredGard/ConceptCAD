// Vue 3D : une fenêtre wxWidgets dans laquelle OCCT dessine ; souris comme la version navigateur
// (gauche ou milieu : tourner, droit : déplacer, molette : zoomer) ; survol et clic sur les faces et arêtes.
#pragma once
#include <wx/wx.h>

#include <array>
#include <functional>
#include <set>
#include <string>
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
#include <gp_Trsf.hxx>

#include "mesure.h"
#include "plan.h"

class Vue3D : public wxWindow {
 public:
  explicit Vue3D(wxWindow* parent);
  // teintes : le solide de chaque corps et sa couleur (0xRRVVBB) ; sans elles, le bleu des pièces.
  void afficher(const TopoDS_Shape& forme, bool ajusterVue, const std::vector<std::pair<TopoDS_Shape, unsigned>>& teintes = {}, const std::vector<std::pair<TopoDS_Shape, double>>& transparences = {});
  // Pour les essais : la vue dans une image, et le temps des arêtes et du reflet au dernier affichage
  bool image(const wxString& chemin);
  // L'image ombrée d'une vue de mise en plan : hors écran, fond transparent, seulement ces corps
  bool imagePlan(const plan::DemandeImage& d, wxImage& sortie);
  // mepAddCameraView : de la cible vers l'œil
  bool directionCamera(std::array<double, 3>& d) const;
  void montrerFilets(const std::vector<std::vector<gp_Pnt>>& helices, const std::vector<std::vector<gp_Pnt>>& anneaux);
  // cgDraw : plans translucides, axes en pointillés, points, repères. Rien de tout cela ne se clique ici : on les choisit dans l'arbre ou les listes.
  struct DessinConstruction {
    std::string kind;
    double o[3], x[3], y[3], z[3];
    bool choisi = false;
  };
  void montrerConstruction(const std::vector<DessinConstruction>& L, const double centre[3], double h);
  wxPoint dernierClic() const { return dernierClic_; }
  // Le point de la pièce sous le dernier clic
  void dernierPoint(double p[3]) const {
    p[0] = dernierPoint_[0];
    p[1] = dernierPoint_[1];
    p[2] = dernierPoint_[2];
  }
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

  // L'assemblage : chaque instance placée, autour de la pièce du composant actif
  struct OccVue {
    TopoDS_Shape forme;
    gp_Trsf t;
    std::vector<std::pair<TopoDS_Shape, unsigned>> teintes;
    std::vector<std::pair<TopoDS_Shape, double>> transparences;
    double transparence = -1;  // celle de l'occurrence, sinon celles des corps
    bool fantome = false, cliquable = false;
    std::string cle;  // l'enfant direct du composant actif auquel elle appartient
    std::vector<std::string> chemin;
    bool aretes = false;
    TopoDS_Shape vives, lisses;
    std::vector<std::array<float, 9>> traits;  // lignes de champ d'un aimant : a, b, couleur
  };
  void montrerOccurrences(const std::vector<OccVue>& L);
  void modePlacer(bool oui);
  void cheminPiece(const std::vector<std::string>& c) { cheminPiece_ = c; }
  void choisirOccurrences(const std::set<std::string>& cles);
  std::function<void(const std::string& cle, bool ctrl, bool maj)> surOccurrence;  // cle vide : rien sous le clic
  std::function<void(const std::string& cle)> surOccDouble, surOccDroit;
  // Le manipulateur : flèches et anneaux de taille constante à l'écran, saisis au plus près du pixel
  struct Gizmo {
    bool actif = false;
    std::array<double, 3> o{0, 0, 0};
    std::array<std::array<double, 3>, 3> ax{};
    bool fleche[3] = {false, false, false}, anneau[3] = {false, false, false};
    std::string degreFleche[3], degreAnneau[3];
  };
  void poserGizmo(const Gizmo& g);
  std::function<void(int phase, const std::string& sorte, int axe, const std::string& degre, double valeur, bool libre)> surGeste;
  // Les marques de la commande Aligner : triades et points, cliquables
  struct Marque {
    std::array<double, 3> o{0, 0, 0}, x{1, 0, 0}, y{0, 1, 0}, z{0, 0, 1};
    bool point = false, orange = false, grand = false;
  };
  void poserMarques(const std::vector<Marque>& L);
  // L'inspection : les volumes en interférence en rouge, le centre de gravité en jaune
  void montrerInspection(const std::vector<TopoDS_Shape>& rouges, bool aCentre, const gp_Pnt& centre);
  std::function<void(int)> surMarque;
  // Une commande qui prend le rayon du clic (pose sur des trous) : rend vrai si le clic est consommé
  std::function<bool(const gp_Pnt& o, const gp_Dir& d)> surRayon;
  std::function<void(const std::vector<std::string>& chemin, const gp_Pnt& p, bool plan, const std::array<double, 3>& normaleLocale)> surFaceOcc;
  // La mesure : la face ou l'arête sous le clic (propre : la pièce affichée, sinon une occurrence), et ce qu'il faut tracer
  struct CoupVue {
    TopoDS_Shape s;
    gp_Trsf t;
    gp_Pnt p;
    bool propre = false;
    std::vector<std::string> chemin;
  };
  std::function<void(const CoupVue* c, bool ctrl, bool maj)> surMesure;
  void montrerMesure(const mesure::Dessin& d);
  int essaiCtrl = -1, essaiMaj = -1;  // l'essai automatique tient les touches à la place de l'utilisateur

 private:
  void surPeinture(wxPaintEvent&);
  void surTaille(wxSizeEvent&);
  void surEnfonce(wxMouseEvent&);
  void surRelache(wxMouseEvent&);
  void surMouvement(wxMouseEvent&);
  void surMolette(wxMouseEvent&);
  void surPerteSouris(wxMouseCaptureLostEvent&);
  void majReflets();
  void surDouble(wxMouseEvent&);
  void refaireReflets();
  void majTailles();
  double echelleEn(const gp_Pnt& p) const;
  void rayon(int x, int y, gp_Pnt& o, gp_Dir& d) const;
  bool lireCoup(const wxPoint& p, CoupVue& c);
  bool coupMesure(const wxPoint& p, CoupVue& c);
  std::vector<occ::handle<AIS_InteractiveObject>> mesureAis_;
  bool saisirGizmo(const wxPoint& p, wxMouseEvent& e);
  void bougerGizmo(const wxPoint& p, bool libre);
  int marqueSous(const wxPoint& p) const;
  struct OccAffichee {
    occ::handle<AIS_Shape> piece, vives, lisses;
    occ::handle<AIS_InteractiveObject> traits;
    OccVue v;
  };
  std::vector<OccAffichee> occs_;
  bool placer_ = false, ignorerRelache_ = false, aligner_ = false;
  std::vector<std::string> cheminPiece_;
  std::vector<std::pair<TopoDS_Shape, unsigned>> teintesPiece_;
  TopoDS_Shape formePiece_;
  std::vector<occ::handle<AIS_Shape>> gizmoAis_, inspectionAis_;
  Gizmo gizmo_;
  int gizmoSaisi_ = -1;  // 0..2 : flèche ; 3..5 : anneau
  bool gizmoBouge_ = false;
  double gizmoT0_ = 0;
  gp_Vec gizmoP0_;
  std::vector<occ::handle<AIS_Shape>> marquesAis_;
  std::vector<Marque> marques_;

  occ::handle<Aspect_DisplayConnection> connexion_;
  occ::handle<OpenGl_GraphicDriver> pilote_;
  occ::handle<V3d_Viewer> visu_, visuImage_;
  occ::handle<V3d_View> vueImage_;
  occ::handle<AIS_InteractiveContext> contexteImage_;
  wxWindow* fenetreImage_ = nullptr;
  occ::handle<V3d_View> vue_;
  occ::handle<AIS_InteractiveContext> contexte_;
  occ::handle<AIS_ViewCube> cube_;
  occ::handle<AIS_Shape> affichee_;
  occ::handle<AIS_Shape> traitsVifs_, traitsLisses_, traitsChoisis_, apercu_;
  occ::handle<AIS_Shape> facesRetenues_, faceReference_, planChoix_;
  bool modeFaces_ = false;
  occ::handle<AIS_Shape> filetsHelices_, filetsAnneaux_;
  std::vector<occ::handle<AIS_Shape>> construction_;
  wxPoint dernierClic_;
  double dernierPoint_[3] = {0, 0, 0};  // les filets cosmétiques
  occ::handle<AIS_Shape> aretesVives_, aretesLisses_;  // les traits de la pièce, hors du choix d'un congé
  std::vector<occ::handle<AIS_Shape>> reflets_;  // chaque corps renversé sous le sol
  double sol_ = 0, msAffichage_ = 0, msImage_ = 0;
  bool refletsVus_ = false;
  bool enChoix_ = false;
  double toleranceAvant_ = 2;
  bool selectionPrete_ = false, aBouge_ = false;
  wxPoint depart_, precedent_;
};
