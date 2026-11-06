// Vue 2D d'une esquisse : traduction du dessin de la version navigateur
// (drawSketch2D et drawSkDims, src/50-esquisse-4). Toutes les tailles sont en pixels logiques, comme le SVG d'origine.
#pragma once
#include <wx/wx.h>
#include <wx/graphics.h>
#include <wx/tglbtn.h>

#include <TopoDS_Shape.hxx>

#include <functional>
#include <vector>

#include "contours.h"
#include "dessin.h"
#include "projet.h"

class VueEsquisse : public wxWindow {
 public:
  explicit VueEsquisse(wxWindow* parent);
  // Montre l'esquisse (qui doit rester vivante) ; piece : solide dessiné en fantôme derrière, ou forme vide.
  void montrer(const Esquisse* s, const TopoDS_Shape& piece);
  void ajuster();
  // Image de la vue, pour comparer au navigateur sans prendre la main sur l'écran.
  bool enregistrer(const wxString& chemin);
  // Le solide a changé : nouveau fantôme, sans toucher au cadrage
  void majPiece(const TopoDS_Shape& piece);
  // Le dessin à la souris ; nullptr : lecture seule, sans barre d'outils
  void poserDessin(Dessin* d);
  std::function<void()> surDessinChange;
  // Échap et Ctrl+Z : abandonnent d'abord le tracé en cours. Rend true si Échap a servi à cela.
  bool echapDessin();
  bool abandonnerTrace();
  std::function<void()> surQuitter;
  // Double-clic sur une cote : rend true et le texte à proposer si elle peut changer.
  std::function<bool(const Cote& c, wxString& texte)> surDemandeCote;
  // La valeur tapée, validée par Entrée
  std::function<void(const std::string& idCote, const wxString& texte)> surSaisieCote;
  bool enSaisie() const { return saisie_ && saisie_->IsShown(); }
  void annulerSaisie();
  // Pour les essais : où double-cliquer sur cette cote, en coordonnées de la vue
  bool positionCote(const std::string& id, wxPoint& p) const;
  // Éléments qu'on ne sait pas encore dessiner (splines), pour le dire à l'utilisateur.
  int nonDessines() const { return nonDessines_; }

 private:
  struct Trait {
    double x1, y1, x2, y2;
  };
  struct Geste {
    wxPoint depart;
    double cx, cy;
    bool actif = false;
  };
  wxPoint2DDouble e(double x, double y) const;  // monde → écran
  wxPoint2DDouble direction(double x, double y) const;  // direction du plan → direction à l'écran
  void surPeinture(wxPaintEvent&);
  void dessiner(wxDC& dc);
  wxPoint2DDouble plan(const wxPoint& p) const;  // position de la souris → point du plan
  std::string zoneSous(const wxPoint& dip) const;
  void ouvrirCote(const std::string& id);
  void surGaucheBas(wxMouseEvent&);
  void surGaucheHaut(wxMouseEvent&);
  void surTouche(wxKeyEvent&);
  void apresGeste();
  void synchroniserOutils();
  void placerOutils();
  void trace(wxGraphicsContext& g) const;
  void surEnfonce(wxMouseEvent&);
  void surRelache(wxMouseEvent&);
  void surMouvement(wxMouseEvent&);
  void surMolette(wxMouseEvent&);
  void surDoubleClic(wxMouseEvent&);
  void ouvrirSaisie(const Cote& c, const wxString& texte, double x, double y);
  void validerSaisie();
  void fantomeDe(const TopoDS_Shape& piece);
  void noterZone(const Cote& d, double x, double y, double demiL, double demiH, double angle) const;

  void grille(wxGraphicsContext& g, double W, double H) const;
  void fantome(wxGraphicsContext& g) const;
  void zones(wxGraphicsContext& g) const;
  void entites(wxGraphicsContext& g) const;
  void points(wxGraphicsContext& g) const;
  void cotes(wxGraphicsContext& g) const;
  void coteLineaire(wxGraphicsContext& g, const Cote& d) const;
  void coteRayon(wxGraphicsContext& g, const Cote& d) const;
  void coteAngle(wxGraphicsContext& g, const Cote& d) const;
  void prolonge(wxGraphicsContext& g, const std::string& idLigne, double x, double y, const wxColour& c) const;
  void pastilles(wxGraphicsContext& g, const std::vector<std::string>& noms, double x, double y) const;

  const Esquisse* s_ = nullptr;
  std::vector<Trait> traitsFantome_;
  struct ZoneCote {
    std::string id;
    double x, y, demiL, demiH, angle;  // en pixels logiques
  };
  mutable std::vector<ZoneCote> zonesCotes_;  // refaites à chaque dessin : là où chaque valeur est écrite
  wxTextCtrl* saisie_ = nullptr;
  std::string coteEnSaisie_;
  double echelle_ = 2.2, cx_ = 0, cy_ = 0;
  double hautX_ = 0, hautY_ = 1;  // le haut de l'écran, dans le plan de l'esquisse
  int nonDessines_ = 0;
  bool grille_ = false;
  Geste geste_;
  wxButton* terminer_ = nullptr;
  Dessin* dessin_ = nullptr;
  std::vector<wxToggleButton*> outils_;
  wxCheckBox* caseGrille_ = nullptr;
  bool gauche_ = false, dblEnAttente_ = false;
  wxPoint2DDouble dblPlan_;
};
