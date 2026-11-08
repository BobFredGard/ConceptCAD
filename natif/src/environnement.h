// L'environnement du navigateur : barre du haut, ruban de chaque atelier, cartes flottantes, fil des fonctions.
// Noms, infobulles, ordre et icônes viennent de environnement_donnees.inc, recopié du navigateur par mesures/extraire-environnement.cjs.
// Ce qui n'est pas encore repris reste visible, grisé, et le dit quand on clique dessus.
#pragma once
#include <wx/wx.h>

#include <functional>
#include <map>
#include <string>
#include <vector>

#include "interface_esquisse.h"

enum class Atelier { CAO, FAO, PLAN, RENDU };

class BarreHaute : public wxWindow {
 public:
  explicit BarreHaute(wxWindow* parent);
  std::function<void(Atelier)> surAtelier;
  std::function<void()> surAnnuler, surRetablir, surNouveau, surRecent, surOuvrir, surEnregistrer, surEnregistrerSous, surRegenerer;
  std::function<void()> surDossier;
  std::function<void()> surTheme;
  std::function<void()> surAide;
  std::function<void(const wxString&)> surIndisponible;
  void atelier(Atelier a);
  void document(const wxString& nom);
  void etats(bool annuler, bool retablir, bool enregistrer, bool document);
  wxTextCtrl* champRecherche() const { return recherche_; }

 private:
  void placer();
  wxTextCtrl* recherche_ = nullptr;
  std::vector<BoutonEsquisse*> ateliers_, icones_;
  std::vector<int> separateurs_;
  BoutonEsquisse* regenerer_ = nullptr;
  BoutonEsquisse* aide_ = nullptr;
  BoutonEsquisse* theme_ = nullptr;
  wxString document_;
  int finIcones_ = 0;
  int themeBandeau_ = -1;  // le thème pour lequel les boutons ont reçu le fond du bandeau
  void fondsBandeau();
};

struct CommandeRuban {
  Atelier a;
  wxString nom, aide;
};

class Ruban : public wxWindow {
 public:
  explicit Ruban(wxWindow* parent);
  // Ce que la recherche de commandes peut lancer : les boutons repris, ceux du moment en assemblage
  std::vector<CommandeRuban> commandes() const;
  // La fonction rend true si ce bouton est repris ; elle n'est appelée que pour dire disponible ou non
  std::function<bool(Atelier, const wxString&)> estRepris;
  std::function<void(Atelier, const wxString&)> surBouton;
  std::function<void(const wxString&)> surIndisponible;
  void atelier(Atelier a);
  void couleursFamilles();  // « Couleurs par famille » ou au trait, selon le réglage
  // Vue d'assemblage : seuls les boutons de composants, et « Assembler » devient « Modéliser »
  void modeAssemblage(bool oui);
  bool enAssemblage() const { return assemblage_; }

 private:
  void placer();
  bool assemblage_ = false;
  std::vector<BoutonEsquisse*> boutonsAsm_;
  BoutonEsquisse* boutonAssembler_ = nullptr;
  struct Groupe {
    Atelier atelier;
    std::vector<BoutonEsquisse*> boutons;
    std::vector<bool> coupes;
  };
  std::vector<Groupe> groupes_;
  Atelier courant_ = Atelier::CAO;
  std::vector<wxRect> traits_;
  std::vector<std::pair<wxRect, wxString>> libelles_;  // le nom de chaque groupe
  int hauteur_ = 0;
};

// Une carte arrondie posée sur le fond : titre en petites capitales, contenu dessous.
class Carte : public wxPanel {
 public:
  // Grand : titre en clair sur deux lignes au plus, comme l'arbre du navigateur
  Carte(wxWindow* parent, const wxString& titre, const wxColour& fond, bool grand = false);
  void titre(const wxString& t);
  void themeChange(int de, int vers);
  wxBoxSizer* contenu() { return contenu_; }
  // En vitre sur la vue 3D, comme les panneaux du navigateur : la pièce se voit au travers (opacité 0..255)
  void vitre(int opacite);

 private:
  wxString titre_;
  wxColour fond_;
  bool grand_ = false, vitre_ = false;
  wxBoxSizer* contenu_ = nullptr;
};

// Le fil des fonctions, sous la vue 3D : esquisses et fonctions dans l'ordre
// L'icône d'une fonction, dans le fil et dans l'arbre : rang dans le ruban CAO, couleur, petit moins
void iconeFonction(const std::string& type, const std::string& op, const std::string& mode, bool chanfrein, bool derive, int& ruban, wxColour& c, bool& moins);
class FilFonctions : public wxWindow {
 public:
  struct Element {
    bool estFonction = false;
    int i = 0;
    std::string type, op;
    std::string cg;            // un élément de construction
    int ruban = 1;             // l'icône : son rang dans le ruban CAO
    wxColour couleur;
    bool moins = false;        // un enlèvement de matière
    bool grise = false;        // masquée, ou au-delà du marqueur
    bool apresMarque = false;  // au-delà du marqueur de temps
    wxString nom;
  };
  explicit FilFonctions(wxWindow* parent);
  void montrer(const std::vector<Element>& e, int nbFonctions);
  const std::vector<Element>& liste() const { return elements_; }
  std::function<void(const Element&)> surClic, surDouble, surDroit;
  // Glisser une fonction : l'interstice où elle est déposée, dans la liste des éléments
  std::function<void(const std::vector<Element>&, int source, int interstice)> surDepot;
  std::function<void(int)> surMarqueur;  // 0 début, 1 précédent, 2 suivant, 3 fin
  std::function<void()> surFilm;
  std::function<void(const wxString&)> surIndisponible;

 private:
  int sous(const wxPoint& p) const;
  int visibles() const;
  void bornerDebut();
  const wxBitmap& image(const Element& e, const wxColour& c);
  std::vector<Element> elements_;
  std::map<std::string, wxBitmap> images_;
  int nb_ = 0, survol_ = -1, debut_ = 0;
  int tire_ = -1, tireX0_ = 0, depot_ = -1;  // le glisser d'une fonction
  int interstice(const wxPoint& p) const;
};

// Ligne de texte sur la vue : l'état du moment, comme en bas de la vue du navigateur
class EtatVue : public wxWindow {
 public:
  EtatVue(wxWindow* parent, int id, const wxColour& fond);
  void montrer(const wxString& t);
  const wxString& texte() const { return texte_; }
  int largeurVoulue() const;

 private:
  wxString texte_;
  wxColour fond_;
};

const char* iconeVue(int i);  // Rendu, Rendu direct
const char* iconeRubanCao(int i);  // dans l'ordre du ruban : 0 Esquisse, 1 Extrusion, 6 Corps

// Ce qui reste à faire dans un atelier : une page d'attente au lieu d'un faux écran
class PageAtelier : public wxWindow {
 public:
  explicit PageAtelier(wxWindow* parent);
  void montrer(const wxString& titre, const wxString& texte, bool feuille);

 private:
  wxString titre_, texte_;
  bool feuille_ = false;
};

