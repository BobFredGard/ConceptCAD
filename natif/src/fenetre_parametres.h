// La fenêtre ƒx Paramètres, sa mini-liste et la liste des noms pendant la frappe (src/51-parametres, src/52-derivee)
#pragma once
#include <wx/wx.h>

#include <functional>
#include <string>

#include "projet.h"

// Dans tout champ de formule : dès la première lettre d'un nom, la liste propose paramètres, cotes nommées,
// constantes et fonctions. Haut et Bas choisissent, Entrée ou Tab insère le nom sans valider, Échap ferme.
void brancherListeNoms(wxTextCtrl* champ, std::function<const Document&()> document);

struct ActionsFormules {
  std::function<Document&()> document;
  // Fait la modification, reporte ses conséquences, recalcule. Rend le message de refus, vide si accepté.
  std::function<std::string(const std::function<std::string()>&)> changer;
  // parSetDim : la saisie d'une cote de n'importe quelle esquisse
  std::function<std::string(size_t esquisse, const std::string& idCote, const std::string& texte)> reglerCote;
  std::function<void(wxWindow*)> menuDerivees;  // les fichiers dont celui-ci dérive
};

// Clic droit sur le bouton ƒx : la liste complète
void ouvrirFenetreParametres(wxWindow* parent, const ActionsFormules& a);
wxDialog* creerFenetreParametres(wxWindow* parent, const ActionsFormules& a);  // pour les essais

// Clic sur le bouton ƒx : la mini-liste du bandeau de droite
class MiniParametres : public wxPanel {
 public:
  MiniParametres(wxWindow* parent, const ActionsFormules& a);
  void rafraichir();
  std::function<void()> surFermer;
  std::function<void()> surListeComplete;

 private:
  void reconstruire();
  ActionsFormules a_;
  wxScrolledWindow* liste_ = nullptr;
  wxStaticText* erreur_ = nullptr;
  std::string signature_;
  bool enReconstruction_ = false;
};
