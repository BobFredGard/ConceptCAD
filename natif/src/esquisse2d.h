// Vue 2D d'une esquisse, en lecture seule : traduction du dessin de la version navigateur
// (drawSketch2D et drawSkDims, src/50-esquisse-4). Toutes les tailles sont en pixels logiques, comme le SVG d'origine.
#pragma once
#include <wx/wx.h>
#include <wx/graphics.h>

#include <TopoDS_Shape.hxx>

#include <functional>
#include <vector>

#include "contours.h"
#include "projet.h"

class VueEsquisse : public wxWindow {
 public:
  explicit VueEsquisse(wxWindow* parent);
  // Montre l'esquisse (qui doit rester vivante) ; piece : solide dessiné en fantôme derrière, ou forme vide.
  void montrer(const Esquisse* s, const TopoDS_Shape& piece);
  void ajuster();
  // Image de la vue, pour comparer au navigateur sans prendre la main sur l'écran.
  bool enregistrer(const wxString& chemin);
  std::function<void()> surQuitter;
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
  void surEnfonce(wxMouseEvent&);
  void surRelache(wxMouseEvent&);
  void surMouvement(wxMouseEvent&);
  void surMolette(wxMouseEvent&);

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
  double echelle_ = 2.2, cx_ = 0, cy_ = 0;
  double hautX_ = 0, hautY_ = 1;  // le haut de l'écran, dans le plan de l'esquisse
  int nonDessines_ = 0;
  bool grille_ = false;
  Geste geste_;
  wxButton* terminer_ = nullptr;
};
