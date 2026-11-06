// Fenêtre principale : menus, arbre de la pièce, panneau de propriétés, vue 3D, barre d'état.
#pragma once
#include <wx/wx.h>
#include <wx/aui/aui.h>
#include <wx/propgrid/propgrid.h>
#include <wx/treectrl.h>

#include <cstdio>
#include <string>
#include <vector>

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
  struct ModifCote {
    int fonction;
    double avant, apres;
  };
  void etat(const wxString& texte);
  void creerMenus();
  void remplirArbre();
  void montrerRien();
  void montrerManques();
  void montrerFonction(int i);
  void montrerEsquisse(int i);
  void montrerForme(const TopoDS_Shape& s);
  double recalculer();
  void changerCote(int fonction, double valeur, bool memoriser);
  void annuler();
  void retablir();
  void surOuvrir(wxCommandEvent&);
  void surArbre(wxTreeEvent&);
  void surPropriete(wxPropertyGridEvent&);
  void pasProtocole(wxTimerEvent&);

  wxAuiManager aui_;
  wxTreeCtrl* arbre_ = nullptr;
  wxPropertyGrid* props_ = nullptr;
  Vue3D* vue_ = nullptr;
  wxTimer minuterie_;
  Document doc_;
  bool docOuvert_ = false, ajusterVue_ = true, solideCalculable_ = false;
  int fonctionMontree_ = -1;
  double msRejeu_ = 0, msMaillage_ = 0;
  std::vector<ModifCote> annulations_, retablissements_;
  Protocole proto_;
};
