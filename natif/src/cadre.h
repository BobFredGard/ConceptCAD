// Fenêtre principale : menus, arbre de la pièce, panneau de propriétés, vue 3D, barre d'état.
#pragma once
#include <wx/wx.h>
#include <wx/aui/aui.h>
#include <wx/propgrid/propgrid.h>
#include <wx/treectrl.h>

#include <cstdio>
#include <memory>
#include <string>
#include <vector>

#include "coter.h"
#include "dessin.h"
#include "esquisse2d.h"
#include "rejeu.h"
#include "vue3d.h"

// Même suite de modifications que la version navigateur (natif/mesures/banc.cjs)
struct Protocole {
  bool actif = false;
  int total = 120, i = 0, fonction = -1;
  double base = 0, pas = 0.05;
  FILE* journal = nullptr;
  std::wstring signal;
};

class Cadre : public wxFrame {
 public:
  Cadre();
  ~Cadre() override;
  bool ouvrir(const std::wstring& chemin);
  bool lancerProtocole(const std::wstring& fichier, const std::wstring& journal, int total);

 private:
  // Une profondeur (fonction >= 0), ou une cote d'esquisse : alors toutes les esquisses, car celles qui suivent le solide bougent aussi
  struct ModifCote {
    int fonction;
    double avant, apres;
    std::vector<Esquisse> esquissesAvant, esquissesApres;
  };
  void etat(const wxString& texte);
  void creerMenus();
  void remplirArbre();
  void montrerRien();
  void montrerManques();
  void montrerFonction(int i);
  void montrerEsquisse(int i);
  void montrerForme(const TopoDS_Shape& s);
public:
  void entrerEsquisse(int i);
  void capturerEsquisses(const std::wstring& dossier);
 private:
  void quitterEsquisse();
  void brancherDessin();
  void faireSuivre();  // ce qui a été dessiné : les esquisses qui s'appuient sur le solide suivent, puis le solide
  double recalculer();
  void changerCote(int fonction, double valeur, bool memoriser);
  bool demandeCote(const Cote& c, wxString& texte);
  void saisieCote(const std::string& id, const wxString& texte);
  void poserEsquisses(const std::vector<Esquisse>& v);
  void annuler();
  void retablir();
  void surOuvrir(wxCommandEvent&);
  void surFermer(wxCloseEvent&);
  bool enregistrer();
  bool enregistrerSous();
  bool ecrire(const std::wstring& cible);
  bool peutAbandonner();
  void majTitre();
  void surArbre(wxTreeEvent&);
  void surArbreActive(wxTreeEvent&);
  void surPropriete(wxPropertyGridEvent&);
  void pasProtocole(wxTimerEvent&);

  wxAuiManager aui_;
  wxTreeCtrl* arbre_ = nullptr;
  wxPropertyGrid* props_ = nullptr;
  wxPanel* centre_ = nullptr;
  Vue3D* vue_ = nullptr;
  VueEsquisse* vueEsquisse_ = nullptr;
  int esquisseOuverte_ = -1;
  std::unique_ptr<Edition> edition_;
  std::unique_ptr<Dessin> dessin_;  // déclaré après edition_ : il s'en sert et disparaît avant lui
  bool dessinModifie_ = false;      // des esquisses suivantes et le solide restent à mettre à jour
  std::string figee_;  // pourquoi l'esquisse ouverte ne peut pas changer
  TopoDS_Shape forme_;  // le solide affiché, pour le fantôme des esquisses
  wxTimer minuterie_;
  Document doc_;
  bool docOuvert_ = false, ajusterVue_ = true, solideCalculable_ = false;
  int fonctionMontree_ = -1;
  double msRejeu_ = 0, msMaillage_ = 0;
  std::vector<ModifCote> annulations_, retablissements_;
  Protocole proto_;
};
