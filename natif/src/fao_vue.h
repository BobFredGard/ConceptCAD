// Ce que le moteur FAO a construit (arbre des posages, fiches, bibliothèque d'outils), dessiné avec de vrais
// contrôles. Aucune règle de la FAO ici : chaque clic ou valeur repart vers le moteur, qui renvoie le nouvel état.
#pragma once
#include <wx/scrolwin.h>
#include <wx/sizer.h>

#include <functional>
#include <map>
#include <string>
#include <vector>

#include "plan.h"

class VueDom : public wxScrolledWindow {
 public:
  explicit VueDom(wxWindow* parent, const wxColour& fond);
  void montrer(const plan::J& racine);
  // sorte : click ou change ; valeur : le texte tapé, le choix, ou la case
  std::function<void(long el, const std::string& sorte, const plan::J& valeur, bool ctrl, bool maj)> surToucher;
  // Essai : le premier élément dont le texte commence ainsi, à cliquer ; ou le champ qui suit ce libellé
  bool essaiCliquer(const std::string& texte, int rang = 0);
  bool essaiChamp(const std::string& libelle, const plan::J& valeur);
  const plan::J& racine() const { return racine_; }

 private:
  void poser(wxWindow* parent, wxSizer* s, const plan::J& e, long cliquable, int largeur);
  void toucher(long el, const std::string& sorte, const plan::J& v, const wxMouseEvent* m);
  wxColour fond_;
  plan::J racine_;
};
