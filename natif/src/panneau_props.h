// Le panneau Paramètres présenté comme celui du navigateur (src/40-50-panneau-proprietes.js) : titres de rubrique
// en capitales, libellé à gauche et case à droite, choix courts en tuiles (icône au-dessus du nom, cadre vert
// quand choisie), cases à cocher. Il défile quand tout ne tient pas.
// La grille de propriétés reste le modèle : chaque réglage change sa propriété (ChangePropertyValue), le
// reste du logiciel n'a rien à savoir de cette présentation.
#pragma once
#include <wx/propgrid/propgrid.h>
#include <wx/scrolwin.h>
#include <wx/wrapsizer.h>
#include <wx/wx.h>

#include <functional>
#include <string>
#include <vector>

// Une tuile du navigateur (.seg button) : symbole au-dessus, nom dessous ; choisie = cadre vert et texte bleu
class Tuile : public wxWindow {
 public:
  Tuile(wxWindow* parent, const wxString& nom, const wxString& texte, const wxString& aide);
  void actif(bool oui);
  void fond(const wxColour& c);
  void themeChange(int de, int vers);
  std::function<void()> surClic;
  bool AcceptsFocus() const override { return false; }
  bool AcceptsFocusFromKeyboard() const override { return false; }

 private:
  void peindre(wxPaintEvent&);
  wxString symbole_, texte_;
  wxColour fond_;
  bool actif_ = false, survol_ = false;
};

class PanneauProps : public wxScrolled<wxPanel> {
 public:
  PanneauProps(wxWindow* parent, wxPropertyGrid* grille);
  // Refait la présentation si la grille a changé ; sinon met seulement les valeurs à jour. Rend vrai si refait.
  bool synchroniser();
  void forcer() { structure_.clear(); }  // thème changé : tout refaire
  int hauteurVoulue() const;            // en pixels : tout le contenu, sans défilement
  std::function<void(wxTextCtrl*)> surChampTexte;  // la liste des noms ƒx sous un champ
  std::function<void()> surTaille;
  // Essais : règle un champ comme le ferait la souris ou le clavier
  bool essaiRegler(const wxString& nom, const wxString& valeur);
  std::vector<std::string> essaiLignes() const;
  int nbRefaits = 0, nbRafraichis = 0;

 private:
  struct Ligne {
    wxPGProperty* p = nullptr;
    enum Sorte { TITRE, LECTURE, TEXTE, COCHE, TUILES, LISTE } sorte = LECTURE;
    wxStaticText* valeur = nullptr;
    wxTextCtrl* texte = nullptr;
    wxChoice* liste = nullptr;
    wxStaticText* coche = nullptr;
    std::vector<Tuile*> tuiles;
    wxString titre;
  };
  void reconstruire();
  void rafraichir();
  void changer(const wxString& nom, const wxVariant& v);
  std::string signature(bool valeurs) const;
  wxPropertyGrid* g_;
  std::string structure_, valeurs_;
  std::vector<Ligne> lignes_;
  bool vidage_ = false;  // les champs disparaissent : leur perte du clavier ne vaut pas saisie
};
