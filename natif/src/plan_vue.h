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
  const plan::J& planche() const { return mep_["sheets"][planche_]; }
  void bullesAuto();
  void exporter(const std::string& format);  // svg, pdf, dxf : demande le fichier
  wxString exporterVers(const std::string& format, const std::string& chemin);
  void imprimer();
  void importerDxf(const std::string& chemin = std::string());  // chemin vide : demande le fichier
  void remplacerDxf(const std::string& id, const std::string& chemin = std::string());
  void supprimerLocale(const std::string& vid, const std::string& id);
  void retirerPointLocale(const std::string& vid, const std::string& id, int i);
  void changerAreteLocale(const std::string& vid, const std::string& id);
  void choisirLocale(const std::string& vid, const std::string& id);
  void supprimerPointOrdonnee(const std::string& id, int i);
  bool ajoutBulle() const { return ajoutBulle_; }
  void basculerAjoutBulle();
  void commencerAlignement(const std::vector<std::string>& ids);
  void ajouterPointsOrdonnees(const std::string& id, const std::string& outil);
  plan::J* vueCourante(const std::string& id) { return plan::vueParId(planche(), id); }
  void lancerAxes(const std::string& mode);  // mepSetAxisMode
  void lancerOutil(const std::string& tool);
  void quitterOutil();
  bool echap();  // Échap : geste, puis outil, puis sélection
  plan::EtatEsquisse& esq() { return esq_; }
  void basculerCartouche(bool on);  // mepTbEdit
  void choisirSk(const std::vector<std::string>& cles);
  void redessinerPlan() { redessiner(); }
  void appliquerContrainte(const std::string& id);  // mepSkApply
  void valeurContrainte(const std::string& id, double v);  // mepSkSetVal
  void valider2(const wxString& libelle) { valider(libelle); }
  void effacerAxeChoisi() { sel_.axeVue.clear(), sel_.axeId.clear(), sel_.axeAk.clear(); }
  const std::string outilCourant() const { return outilActif_ ? outil_.tool : std::string(); }
  const std::string modeAxes() const { return outilActif_ && outil_.tool == "axis" ? outil_.axisMode : std::string(); }
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
  // Le ruban de la mise en plan. Faux : pas encore repris.
  bool boutonRuban(const wxString& nom);
  bool estRepris(const wxString& nom) const;
  void rejeter(const std::string& id);
  void orienter(const std::string& id, const std::string& vk);
  std::function<bool(std::array<double, 3>&)> directionCamera;
  std::function<void(const plan::J&)> surVuesAutomatiques;
  // Les gestes de l'essai automatique, en mm sur la feuille
  void essaiGeste(const plan::J& e);
  plan::J essaiPerf(int n);  // durées moyennes (ms) : construire, peindre, survol d'un outil
  // Le rendu des vues ombrées : c'est la vue 3D qui sait le faire
  std::function<bool(const plan::DemandeImage&, wxImage&)> rendreImage;
  void sigReel(const std::string& s) { calcul_.sigReel = s; }

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
  std::string svgDesPrimitives() const;
  std::string pdfDesPrimitives() const;
  void dessinerSurImprimante(wxDC& dc, int largeurPx, int hauteurPx, double pxParMmX, double pxParMmY) const;
  std::string nomDeSortie() const;
  template <typename F>
  void pourExport(F&& faire);
  bool exportEnCours_ = false, noirSeul_ = false;
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
  void lancerCommande(const std::string& kind);
  void menuContextuel(double x, double y, const std::string& essai);  // mepOnContext ; essai : le libellé à choisir sans ouvrir le menu
  bool echapEsquisse();
  void saisirNote(const std::string& id);
  void finirCommande(const wxString& message);
  void apresPlanche();
  bool essaiEnCours_ = false;
  bool differer_ = false, aConstruire_ = false;  // redessiner pendant un mouvement de souris : au prochain dessin
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
    enum Sorte { RIEN, VUE, COTE, BULLE, TITRE, CADRE, FLECHE, TRONCON, AXE, ESQUISSE, LOCALE } sorte = RIEN;
    std::vector<std::array<double, 2>> locPts;  // mepSt.pick « locPt »
    int locI = -1;
    bool locIns = false;
    std::string cleSk;
    plan::J baseSk;
    bool averti = false;
    std::string id;
    double ox = 0, oy = 0, px0 = 0, py0 = 0, curX = 0, curY = 0;
    bool commence = false, bouge = false, ajout = false;
    plan::GesteCote cote;
    int jogI = -1;  // cassure d'une ordonnée
    double jogJ0 = 0;
    plan::GesteCoupe coupe;
    std::string rappel;
    plan::AxeTouche axe;
    bool debut = false;
  } geste_;
  double zoomEntier_ = 0;
  bool grille_ = false;
  bool commandeActive_ = false;
  plan::CommandeVue commande_;
  bool outilActif_ = false;
  plan::OutilPlan outil_;
  plan::EtatEsquisse esq_;
  bool ajoutBulle_ = false;  // mepSt.blAdd
  std::vector<std::string> alignement_;  // mepSt.alignDims
  std::vector<wxRect> actionsOnglets_;
  std::string coteAppui_;
  wxLongLong tempsAppui_ = 0;
  std::string vueAppui_;  // le double-clic sur une vue
  wxLongLong tempsVue_ = 0;
  double vueAppuiPx_ = 0, vueAppuiPy_ = 0;
  void dialogueHachures();
  double appuiPx_ = 0, appuiPy_ = 0;
  std::map<std::string, std::shared_ptr<wxBitmap>> images3d_;
  bool curseurDedans_ = false;
  double curseurX_ = 0, curseurY_ = 0;  // mm papier
  wxColour bureau_{0x2b, 0x2e, 0x34};
};
