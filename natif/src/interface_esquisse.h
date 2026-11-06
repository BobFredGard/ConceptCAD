// L'écran d'esquisse du navigateur : barre d'icônes en haut, panneau à droite, bandeau d'état en bas.
// Les icônes sont celles de src/49-esquisse-registre-icones.js, sans modification.
#pragma once
#include <wx/wx.h>
#include <wx/arrstr.h>
#include <wx/bmpbndl.h>

#include <functional>
#include <map>
#include <string>
#include <vector>

#include "dessin.h"
#include "infos_esquisse.h"

// Un bouton dessiné par nous. Une vraie fenêtre, avec son nom : les essais la retrouvent et lui envoient des clics.
class BoutonEsquisse : public wxWindow {
 public:
  enum Style { ICONE, ENCADRE, TEXTE, PRINCIPAL, PASTILLE, RUBAN };
  BoutonEsquisse(wxWindow* parent, int id, const wxString& nom, const wxString& infobulle, Style style = ICONE);
  void icone(const std::string& corpsSvg, const wxColour& couleur);
  void iconeComplete(const std::string& svg, const wxColour& couleur);  // un <svg> entier, tel que le navigateur le dessine
  void fond(const wxColour& c);  // la couleur sur laquelle le bouton est posé
  void titre(const wxString& t);
  void actif(bool oui);
  void disponible(bool oui);
  bool estDisponible() const { return disponible_; }
  std::function<void()> surClic;
  bool AcceptsFocus() const override { return false; }
  bool AcceptsFocusFromKeyboard() const override { return false; }

 private:
  void peindre(wxPaintEvent&);
  wxBitmapBundle image_;
  wxBitmapBundle imageActive_;
  wxString titre_;
  Style style_;
  wxColour fond_;
  bool actif_ = false, disponible_ = true, survol_ = false, enfonce_ = false;
};

wxBitmapBundle iconeSvgComplete(const std::string& svg, const wxColour& c, int taille);

class BarreEsquisse : public wxWindow {
 public:
  explicit BarreEsquisse(wxWindow* parent);
  std::function<void(Dessin::Outil)> surOutil;
  std::function<void(const std::string&)> surContrainte;
  std::function<void(const wxString&)> surIndisponible;
  std::function<void()> surCadrer, surGrille, surGrilleMenu, surFantome, surAbandon, surTerminer;
  void outilActif(Dessin::Outil o);
  void lectureSeule(bool oui);
  void grilleActive(bool oui);
  void fantomeActif(bool oui);

 private:
  void placer();
  std::vector<wxWindow*> ordre_;   // dans l'ordre, nullptr pour un séparateur
  std::vector<BoutonEsquisse*> outils_, contraintes_;
  BoutonEsquisse* grille_ = nullptr;
  BoutonEsquisse* fantome_ = nullptr;
  BoutonEsquisse* abandon_ = nullptr;
  BoutonEsquisse* terminer_ = nullptr;
  std::vector<int> separateurs_;
  int hauteur_ = 0;
};

class PanneauEsquisse : public wxScrolledWindow {
 public:
  explicit PanneauEsquisse(wxWindow* parent);
  // Un geste sur le dessin, passé par la vue pour que l'écran suive
  std::function<void(const std::function<void(Dessin&)>&)> faire;
  std::function<void(const std::string&)> surOuvrirCote;
  std::function<void(double, double)> surVoir;
  void montrer(const wxString& titre, const Esquisse* s, Dessin* d, const InfosEsquisse& i, const std::string& lectureSeule);
  void vider();

 private:
  struct Action {
    wxRect r;  // en pixels logiques, depuis le haut du contenu
    wxString texte, infobulle;
    bool bouton = false;  // bouton encadré, sinon petit signe discret
    std::function<void()> f;
  };
  struct Rang {
    enum Sorte { TITRE, TETE, NOTE, LIGNE, CHAMP } sorte = NOTE;
    wxRect r;
    wxArrayString lignes;
    std::string icone;
    wxColour bord;
    std::vector<Action> actions;
    std::function<void()> clic, dbl;
    int champ = -1;
  };
  struct Champ {
    wxTextCtrl* ctrl = nullptr;
    std::function<void(double)> f;
    wxString initial;
  };
  void construire();
  void peindre(wxPaintEvent&);
  wxPoint versContenu(const wxPoint& p) const;
  const Action* actionSous(const wxPoint& c, const Rang** rang = nullptr) const;
  const Rang* rangSous(const wxPoint& c) const;
  void surBas(wxMouseEvent&);
  void surDouble(wxMouseEvent&);
  void surMouvement(wxMouseEvent&);
  void validerChamp(int i);
  void placerChamps();
  wxBitmapBundle iconeLigne(const std::string& nom);

  wxString titre_;
  const Esquisse* s_ = nullptr;
  Dessin* d_ = nullptr;
  InfosEsquisse infos_;
  std::string lecture_;
  std::vector<Rang> rangs_;
  std::vector<Champ> champs_;
  std::map<std::string, wxBitmapBundle> icones_;
  wxPoint survol_{-1, -1};
  int hauteur_ = 0;
};

class BandeauEsquisse : public wxWindow {
 public:
  explicit BandeauEsquisse(wxWindow* parent);
  void montrer(const wxString& texte);
  const wxString& texte() const { return texte_; }

 private:
  wxString texte_;
};
