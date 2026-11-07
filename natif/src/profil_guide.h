// Courbe guide d'une répétition « suivant un profil » : traduction de src/39-profil-guide.js.
// Une suite de lignes, arcs, cercles et splines d'une esquisse, jointes bout à bout. Tout se calcule sur le JSON de l'esquisse.
#pragma once
#include <nlohmann/json.hpp>

#include <array>
#include <set>
#include <string>
#include <vector>

struct CasePg {  // la transformation d'une copie
  std::array<double, 3> P0{}, Pi{}, N{};
  double ang = 0;  // degrés
};
struct PlanPg {
  double L = 0, step = 0;
  bool closed = false;
  std::vector<CasePg> cases;
  std::string warn, err;
};
struct ChoixDepart {
  nlohmann::ordered_json v;  // {pt} ou {mid}
  std::string label;
};

// Base de l'esquisse : O origine, U, V, N axes (ensureSketchBasis, faite par l'appelant)
struct BasePg {
  std::array<double, 3> O{}, U{1, 0, 0}, V{0, 1, 0}, N{0, 0, 1};
};
BasePg pgBase(const nlohmann::ordered_json& sk);

PlanPg pgPlan(const nlohmann::ordered_json& sk, const nlohmann::ordered_json& cfg, int n);       // cfg : path, pspace, dist, orient, rev
std::set<std::string> pgIdsCourbe(const nlohmann::ordered_json& sk, const nlohmann::ordered_json& path);  // les entités de la chaîne retenue
std::vector<ChoixDepart> pgChoixDepart(const nlohmann::ordered_json& sk);
nlohmann::ordered_json pgDepartDefaut(const nlohmann::ordered_json& sk);                         // {sk, pt|mid}
bool pgMemeDepart(const nlohmann::ordered_json& a, const nlohmann::ordered_json& b);
std::vector<const nlohmann::ordered_json*> pgEsquissesGuides(const nlohmann::ordered_json& doc);  // esquisses avec une ligne, un arc ou une spline, sans les copies
// « Longueur de la courbe : … · ouverte · pas … », ou « ⚠ … »
std::string pgNote(const PlanPg& p);
