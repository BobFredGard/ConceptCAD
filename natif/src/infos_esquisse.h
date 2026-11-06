// Ce que l'écran d'esquisse affiche sur l'état du dessin, sans fenêtre : santé, libertés, textes des listes.
// Traduction de skHealth, skDofInfo, skDefaultStatus, conDesc et dimDesc (src/50-esquisse-5).
// mesures/tester-panneau.cjs compare tout cela au navigateur, esquisse par esquisse.
#pragma once
#include <map>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "projet.h"

struct SanteEsquisse {
  int contours = 0, trous = 0;
  std::vector<Pt> ouverts;
  bool aEcart = false;  // gapPair
  Pt ecartA, ecartB;
  double ecart = 1e9;
  std::vector<std::pair<std::string, std::string>> doublons;
  std::vector<std::string> degeneres;
  std::vector<Pt> croisements;
};

struct InfosEsquisse {
  bool calculees = false;  // faux si le solveur ne prend pas cette esquisse en charge
  int libertes = 0;
  double residu = 0;
  std::set<std::string> pointsLibres, rayonsLibres;
  std::map<std::string, double> ecarts;  // par contrainte ou cote : au-delà de 0,05 mm, la ligne de la liste le dit
  std::set<std::string> fixes;           // skFixed
  SanteEsquisse sante;
  bool pointDetermine(const std::string& id) const { return !pointsLibres.count(id); }
  bool determinee(const Entite& e) const;  // blanc si vrai, bleu sinon
  std::map<std::string, std::vector<std::string>> poignees;  // spline : les bouts de ses poignées
  const std::vector<std::string>& poigneesDe_(const Entite& e) const {
    static const std::vector<std::string> rien;
    const auto it = poignees.find(e.id);
    return it == poignees.end() ? rien : it->second;
  }
};

SanteEsquisse santeDe(const Esquisse& s);
// Sur un solveur neuf : la mémoire de celui de l'édition ne doit pas en dépendre
InfosEsquisse infosDe(const Esquisse& s);

std::string descContrainte(const Esquisse& s, const Contrainte& c);  // conDesc
std::string descCote(const Cote& d);                                 // dimDesc
std::string nomContrainte(const std::string& type);                  // SK_CON
std::string iconeContrainte(const std::string& type);                // SK_CON
std::string texteSante(const SanteEsquisse& h);                      // première ligne du cadre Santé
std::string statutEsquisse(const Esquisse& s, const InfosEsquisse& i);  // skDefaultStatus
bool sousContrainte(const Esquisse& s, const InfosEsquisse& i);
// La note du cadre Sélection pour un élément ou un point
std::string noteEntite(const Esquisse& s, const Entite& e);
