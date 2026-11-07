// L'atelier Mise en plan : la feuille à l'écran, ses onglets de planches, le zoom et le déplacement.
#pragma once
#include <wx/bitmap.h>
#include <wx/graphics.h>
#include <wx/window.h>

#include <array>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "plan.h"

class PlanVue : public wxWindow {
 public:
  explicit PlanVue(wxWindow* parent);
  // Le fichier tel qu'il serait enregistré et le dernier calcul de la pièce.
  void charger(const std::string& texteDoc, const Document& d, const ResultatRejeu& r, const assemblage::Solides& S);
  // Pièce modifiée : tout sera recalculé au prochain passage dans l'atelier
  void oublier();
  // Pour la note de droite : ce que contient la planche courante
  wxString resume() const;
  // La planche a changé : le fichier reçoit le plan, sans recalculer la pièce
  std::function<void(const plan::J& mep, const wxString& libelle)> surChangement;
  std::function<void(const wxString&)> surEtat;
  std::function<void()> surSelection;  // ce qui est choisi a changé
  // Annuler, Rétablir : le plan du document revient, le calcul des vues reste bon
  void reprendre(const std::string& texteDoc);
  const plan::SelectionPlan& selection() const { return sel_; }
  // Pour le panneau
  bool planPret() const { return mep_.is_object() && mep_.contains("sheets") && mep_["sheets"].is_array() && !mep_["sheets"].empty(); }
  plan::J& mep() { return mep_; }
  plan::J& planche() { return mep_["sheets"][planche_]; }
  plan::J* vueCourante(const std::string& id) { return plan::vueParId(planche(), id); }
  plan::J* coteCourante(const std::string& id) { return plan::coteParId(planche(), id); }
  void editer(const wxString& libelle, const std::function<void()>& f);  // mepEdit
  void etat(const wxString& t) {
    if (surEtat) surEtat(t);
  }
  bool assemblage() const { return piece_.assemblage; }
  std::vector<plan::RangNomenclature> nomenclature() { return plan::rangsNomenclature(mep_, planche_, piece_, calcul_); }
  std::vector<std::pair<std::string, std::string>> corpsDuDoc() const { return piece_.nomsCorps; }
  std::string logoDepuisFichier(const wxString& chemin);
  bool grille() const { return grille_; }
  void basculerGrille();
  void zoomer(double k);
  void ajuster();
  void cadrerVue(const std::string& id);
  void ajouterBrisure(const std::string& id) { plan::ajouterBrisure(mep_, planche_, piece_, calcul_, id); }
  void enleverBrisure(const std::string& id) { plan::enleverBrisure(mep_, planche_, piece_, calcul_, id); }
  void enleverVue(const std::string& id);
  void enleverCote(const std::string& id);
  std::string texteDeCote(const std::string& id);
  double accrocherTexte(plan::J& d, double v) { return plan::accrocherTexteCote(mep_, planche_, piece_, calcul_, d, v); }
  std::string toleranceAutoPercage(const plan::J& d) { return plan::toleranceAuto(mep_, planche_, piece_, calcul_, d); }
  void supprimerSelection() { supprimer(); }
  void viderSelection();
  // Les gestes de l'essai automatique, en mm sur la feuille
  void essaiGeste(const plan::J& e);
  // Le rendu des vues ombrées : c'est la vue 3D qui sait le faire
  std::function<bool(const plan::DemandeImage&, wxImage&)> rendreImage;

 private:
  struct Trait {
    std::vector<std::array<double, 2>> pts;
    bool ferme = false;
  };
  struct Prim {
    enum Genre { TRAITS, REMPLI, TEXTE, IMAGE } genre = TRAITS;
    std::vector<Trait> traits;  // TRAITS, REMPLI
    wxColour couleur;
    wxColour fond;  // REMPLI avec un contour : le fond (les traits suivent)
    double largeur = 0;
    double opacite = 1;
    wxPenCap cap = wxCAP_BUTT;
    wxPenJoin join = wxJOIN_MITER;
    // TEXTE
    wxString texte;
    double x = 0, y = 0, corps = 0, halo = 0, angle = 0, axeX = 0, axeY = 0;
    bool gras = false;
    wxColour couleurHalo;
    // IMAGE
    double l = 0, h = 0;
    std::shared_ptr<wxBitmap> image;
  };

  void construire();
  void ajusterFeuille();
  void peindre(wxGraphicsContext& g);
  void changerPlanche(int i);
  int ongletSous(const wxPoint& p) const;
  void peindreRegles(wxDC& dc, const wxSize& t);
  void peindreSelection(wxDC& dc);
  void enfonce(double x, double y, bool maj, bool ctrl, double px, double py);
  void bouge(double x, double y, double px, double py);
  void relache();
  void supprimer();
  void valider(const wxString& libelle);
  void redessiner();
  double zoomRelatif() const { return zoomEntier_ > 0 ? zoom_ / zoomEntier_ : 1; }
  int hauteurOnglets() const;

  plan::J top_, mep_;
  plan::Piece piece_;
  plan::Calcul calcul_;
  std::vector<Prim> prims_;
  int planche_ = 0;
  double largeurPage_ = 420, hauteurPage_ = 297;
  bool aJour_ = false;
  bool ajuster_ = true;
  double zoom_ = 1, ox_ = 0, oy_ = 0;
  wxPoint saisie_, decalage_;
  bool glisse_ = false;
  wxBitmap image_;
  bool imageBonne_ = false;
  std::vector<wxRect> onglets_;
  plan::SelectionPlan sel_;
  std::string vueSurvol_;
  struct Geste {
    enum Sorte { RIEN, VUE, COTE, BULLE, TITRE, CADRE, FLECHE, TRONCON } sorte = RIEN;
    std::string id;
    double ox = 0, oy = 0, px0 = 0, py0 = 0, curX = 0, curY = 0;
    bool commence = false, bouge = false, ajout = false;
    plan::GesteCote cote;
    plan::GesteCoupe coupe;
  } geste_;
  double zoomEntier_ = 0;
  bool grille_ = false;
  std::string coteAppui_;
  wxLongLong tempsAppui_ = 0;
  double appuiPx_ = 0, appuiPy_ = 0;
  std::map<std::string, std::shared_ptr<wxBitmap>> images3d_;
  bool curseurDedans_ = false;
  double curseurX_ = 0, curseurY_ = 0;  // mm papier
  wxColour bureau_{0x2b, 0x2e, 0x34};
};
