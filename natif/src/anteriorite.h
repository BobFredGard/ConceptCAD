#pragma once
// Antériorité : une fonction ne s'appuie que sur ce qui la précède (src/43-anteriorite.js),
// et l'ordre des fonctions dans leur corps (featMove, src/40-30-corps-fonctions.js)
#include <nlohmann/json.hpp>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

namespace anteriorite {
using J = nlohmann::ordered_json;

// Un déplacement refusé : le message s'affiche dans la barre d'état, rien n'a changé
struct Refus : std::runtime_error {
  using std::runtime_error::runtime_error;
};

// id de fonction → les liens vers l'aval (le ⚠ de l'arbre, antWarnMap)
std::map<std::string, std::string> avertissements(const J& d);
// Ce que dit l'ouverture d'un fichier, "" si tout est en ordre
std::string bilanOuverture(const J& d);

// Un cran dans le corps (featMove) ; lève Refus
void deplacerCran(J& d, const std::string& id, int dir);
// Déposée sur une autre fonction du même corps (treeFeatMoveTo) ; lève Refus
void deplacerSur(J& d, const std::string& id, const std::string& cible);
// Déposée entre deux fonctions du fil (tlbMoveTo) : avant `voisine` en allant vers la droite,
// après `voisine` en allant vers la gauche ; vide = le bout du fil. Lève Refus.
void deplacerDansFil(J& d, const std::string& id, bool versDroite, const std::string& voisine);
}  // namespace anteriorite
