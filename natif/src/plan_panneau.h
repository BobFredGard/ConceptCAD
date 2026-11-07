// Le panneau de droite de la mise en plan : la planche et ses réglages, la vue ou la cote choisie (src/98-mep-90-proprietes.js).
#pragma once
#include <wx/scrolwin.h>
#include <wx/sizer.h>

#include <functional>
#include <map>
#include <string>
#include <utility>
#include <vector>

#include "plan.h"

class PlanVue;

class PanneauPlan : public wxScrolledWindow {
 public:
  PanneauPlan(wxWindow* parent, PlanVue* vue);
  // Tout est refait à chaque changement, comme dans le navigateur
  void refaire();
  // Ce qui n'est pas encore repris le dit
  std::function<void(const wxString&)> surIndisponible;
  // Essai : {"champ":"Échelle","valeur":"2:1"} ou {"bouton":"Justet"}
  bool essai(const plan::J& e);

 private:
  using Options = std::vector<std::pair<std::string, wxString>>;
  void accueil();
  void vueChoisie(const std::string& id);
  void coteChoisie(const std::string& id);
  void lot();
  void tolerance(const std::string& idCote);
  void classeIso(const std::string& idCote);

  // Les briques du panneau
  void section(const wxString& titre);
  wxBoxSizer* rang();
  wxWindow* libelle(wxBoxSizer* r, const wxString& t);
  void note(const wxString& t, const wxColour* c = nullptr);
  void texte(const wxString& lab, const wxString& valeur, const std::function<void(const wxString&)>& f, const wxString& indice = wxString());
  void nombre(const wxString& lab, double valeur, const std::function<void(double)>& f, const wxString& indice = wxString(), bool videPossible = false);
  void choix(const wxString& lab, const Options& o, const std::string& cur, const std::function<void(const std::string&)>& f);
  void coche(const wxString& lab, bool v, const std::function<void(bool)>& f, const wxString& indice = wxString());
  void couleur(const wxString& lab, const std::string& v, const std::string& defaut, const std::function<void(const std::string&)>& f);
  void bouton(wxBoxSizer* r, const wxString& lab, const std::function<void()>& f, const wxString& indice = wxString(), bool actif = false, bool grise = false);
  void boutonPasEncore(wxBoxSizer* r, const wxString& lab);
  void editer(const wxString& lab, const std::function<void()>& f);
  void reglage(const std::function<void()>& f);  // un réglage de plan : l'annulation suit, comme le fichier
  void finir(const std::string& cle);

  PlanVue* vue_;
  wxBoxSizer* racine_ = nullptr;
  wxBoxSizer* cible_ = nullptr;
  struct Sect {
    wxString titre;
    wxBoxSizer* s;
  };
  std::vector<Sect> sections_;
  std::map<std::string, wxString> ongletChoisi_;
  std::map<wxString, std::function<void(const wxString&)>> champs_;
  std::map<wxString, std::function<void()>> boutons_;
};
