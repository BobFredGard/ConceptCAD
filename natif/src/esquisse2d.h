// Vue 2D d'une esquisse : traduction du dessin de la version navigateur
// (drawSketch2D et drawSkDims, src/50-esquisse-4). Toutes les tailles sont en pixels logiques, comme le SVG d'origine.
#pragma once
#include <wx/wx.h>
#include <wx/graphics.h>

#include <TopoDS_Shape.hxx>

#include <functional>
#include <vector>

#include "contours.h"
#include "dessin.h"
#include "infos_esquisse.h"
#include "projet.h"

class wxSpinCtrl;

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
  // Le dessin à la souris ; nullptr : lecture seule
  void poserDessin(Dessin* d);
  std::function<void()> surDessinChange;
  // Après chaque geste : l'outil ou la sélection ont pu changer
  std::function<void()> surGeste;
  // Ce que le panneau affiche aussi : ce qui est encore libre, les bouts ouverts...
  void poserInfos(const InfosEsquisse& i);
  bool grilleVisible() const { return grille_; }
  void basculerGrille();
  bool fantomeVisible() const { return voirFantome_; }
  void basculerFantome();
  bool accrocheGrille() const { return accrocheGrille_; }
  void reglerAccrocheGrille(bool oui);
  void centrerSur(double x, double y);
  void ouvrirCoteParId(const std::string& id);
  Dessin* dessin() const { return dessin_; }
  bool boutonEnfonce() const { return gauche_; }
  // Échap et Ctrl+Z : abandonnent d'abord le tracé en cours. Rend true si Échap a servi à cela.
  bool echapDessin();
  bool abandonnerTrace();
  // Une commande du menu sur la sélection du moment, sauf pendant la saisie d'une cote
  void commande(const std::function<void(Dessin&)>& f);
  std::function<void()> surQuitter;
  // Double-clic sur une cote : rend true et le texte à proposer si elle peut changer.
  std::function<bool(const Cote& c, wxString& texte)> surDemandeCote;
  // La valeur tapée, validée par Entrée
  std::function<void(const std::string& idCote, const wxString& texte)> surSaisieCote;
  bool enSaisie() const { return saisie_ && saisie_->IsShown(); }
  void annulerSaisie();
  // Pour les essais : de vrais événements de souris et de clavier, sans prendre la main sur l'écran.
  // Le menu du clic droit ne s'ouvre pas : ses entrées sont notées et celle qui est demandée est choisie.
  void essaiSouris(wxEventType type, double x, double y, bool ctrl = false);
  void essaiTouche(int code);
  void essaiCaractere(wxChar c);
  void essaiReglagesPolygone(const wxString& cotes, const wxString& diametre);
  bool essaiBarrePolygoneVisible() const { return barrePoly_ && barrePoly_->IsShown(); }
  bool essaiSansMenu = false;
  std::string essaiChoixMenu;
  std::vector<std::string> essaiEntreesMenu;
  // Pour les essais : où double-cliquer sur cette cote, en coordonnées de la vue
  bool positionCote(const std::string& id, wxPoint& p) const;
  // Éléments qu'on ne sait pas encore dessiner (splines), pour le dire à l'utilisateur.
  int nonDessines() const { return nonDessines_; }

 private:
  void clicDroitDessin(const wxPoint& ou);  // le menu de l'écouteur contextmenu du navigateur
  void majBarrePolygone();  // skPolySync : le bandeau n'existe à l'écran que pendant l'outil Polygone
  void lireBarrePolygone();
  wxPanel* barrePoly_ = nullptr;
  wxSpinCtrl* polyN_ = nullptr;
  wxTextCtrl* polyD_ = nullptr;
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
  void ouvrirCote(const std::string& id, const wxString& texteDepart = wxString());
  void surGaucheBas(wxMouseEvent&);
  void surGaucheHaut(wxMouseEvent&);
  void surTouche(wxKeyEvent&);
  void surCaractere(wxKeyEvent&);
  void ouvrirCoteDemandee();
  void apresGeste();
  void sante(wxGraphicsContext& g) const;
  void halo(wxGraphicsContext& g) const;
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
  struct ZoneLigne {  // la ligne de cote telle que dessinée
    std::string id;
    bool arc = false;
    std::vector<wxPoint2DDouble> pts;
  };
  mutable std::vector<ZoneLigne> zonesLignes_;
  std::string ligneSous(const wxPoint& dip) const;  // hitDimLine
  mutable std::vector<ZoneCote> zonesCotes_;  // refaites à chaque dessin : là où chaque valeur est écrite
  wxTextCtrl* saisie_ = nullptr;
  std::string coteEnSaisie_;
  double echelle_ = 2.2, cx_ = 0, cy_ = 0;
  double hautX_ = 0, hautY_ = 1;  // le haut de l'écran, dans le plan de l'esquisse
  int nonDessines_ = 0;
  bool grille_ = false;
  Geste geste_;
  Dessin* dessin_ = nullptr;
  InfosEsquisse infos_;
  bool voirFantome_ = true, accrocheGrille_ = true;
  bool gauche_ = false, dblEnAttente_ = false;
  wxPoint2DDouble dblPlan_;
};
