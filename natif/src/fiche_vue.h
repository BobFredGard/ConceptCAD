// La fiche ⚙ des réglages de la vue (#setMenu du navigateur) : vues, affichage, coupe
#pragma once

#include <functional>
#include <string>

#include <wx/wx.h>

#include "vue3d.h"

class FicheVue : public wxPanel {
 public:
  FicheVue(wxWindow* parent, Vue3D* vue);
  OptionsVue* o = nullptr;            // ce que la fiche règle
  std::string* support = nullptr;     // le support est celui de l'atelier Rendu
  std::function<void()> surChange;    // à chaque réglage
  std::function<void()> surFin;       // réglage terminé (curseur lâché)
  void refaire();
  int hauteurVoulue() const { return hauteur_; }

 private:
  void change(bool refaireApres = false);
  wxBoxSizer* rang();
  void titre(const wxString& t);
  void coche(wxSizer* s, const wxString& t, bool* v);
  void liste(const wxString& t, const std::vector<std::pair<std::string, wxString>>& L, const std::string& actuel, std::function<void(const std::string&)> f);
  Vue3D* vue_;
  wxBoxSizer* boite_ = nullptr;
  int hauteur_ = 0;
};
