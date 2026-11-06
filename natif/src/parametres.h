// Paramètres, cotes nommées et formules (src/51-parametres.js du navigateur). Sans fenêtre : les essais passent par le même chemin.
#pragma once
#include <functional>
#include <string>
#include <vector>

#include "projet.h"

// parEval : lève std::runtime_error avec le message du navigateur
double parEval(const std::string& source, const std::function<double(const std::string&)>& lookup);
bool parEstNombre(const std::string& texte);       // parIsNumber
double parDimUser(const Cote& c);                  // ce que voit l'utilisateur : degrés, diamètre
double parDimFromUser(const Cote& c, double f);    // ce qu'écrit le fichier : radians, rayon
std::string parTexteSaisie(const Cote& c);         // parDimInputText : « nom = expression »
std::string nombreJs(double v);                    // String(v)
std::string nombreJsFixe(double v, int chiffres);  // String(+v.toFixed(n))

// parResolve : réévalue paramètres et cotes à formule, note dans d.parEnAttente les esquisses dont une cote a changé
void parResoudre(Document& d);
// parValueNow : la valeur actuelle d'un nom, sans réévaluer ; lève std::runtime_error
double parValeurNom(const Document& d, const std::string& nom);
// parNameCheck : vide si le nom convient, sinon le message
std::string parControleNom(const Document& d, const std::string& nom, const Cote* cote, const Parametre* param, const PorteurFx* porteur);
void parRenommer(Document& d, const std::string& ancien, const std::string& nouveau);  // parRename

struct SaisieCote {
  bool ok = false;
  double valeur = 0;  // dans les unités du fichier
  std::string message;
};
// parDimCommit : applique « [nom =] valeur|expression » à la cote. Refusée, tout reste comme avant.
SaisieCote parValiderCote(Document& d, Cote& c, const std::string& texte);
// parSetParam : vide si accepté, sinon le message
std::string parReglerParametre(Document& d, Parametre& p, const std::string& expr);
// parSetFeat, profondeur d'une extrusion seulement : vide si accepté, sinon le message
std::string parReglerPorteur(Document& d, PorteurFx& h, const std::string& texte);
// skDimAutoName : nomme la cote d<n>, le premier libre
std::string parNomAutomatique(Document& d, Cote& c);

// La liste des noms qu'on peut insérer pendant la frappe (parAcList)
struct NomPropose {
  std::string affiche, insere, info, sorte;
};
std::vector<NomPropose> parNomsProposes(const Document& d, const std::string& mot);
// Le mot en cours de frappe avant le curseur (parAcToken), en caractères du champ. False s'il n'y en a pas.
bool parMotEnCours(const std::wstring& texte, long curseur, long& debut, long& fin, std::string& mot);
