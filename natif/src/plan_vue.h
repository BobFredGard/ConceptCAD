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
#include <vector>

#include "plan.h"

class PlanVue : public wxWindow {
 public:
  explicit PlanVue(wxWindow* parent);
  // Le fichier tel qu'il serait enregistré et le dernier calcul de la pièce.
  void charger(const std::string& texteDoc, const Document& d, const ResultatRejeu& r);
  // Pièce modifiée : tout sera recalculé au prochain passage dans l'atelier
  void oublier();
  // Pour la note de droite : ce que contient la planche courante
  wxString resume() const;
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
  std::map<std::string, std::shared_ptr<wxBitmap>> images3d_;
  bool curseurDedans_ = false;
  double curseurX_ = 0, curseurY_ = 0;  // mm papier
  wxColour bureau_{0x2b, 0x2e, 0x34};
};
