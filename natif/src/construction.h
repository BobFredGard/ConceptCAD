// Les plans, axes, points et repères de construction (src/78-construction-modele, src/79-construction-interface).
// Ils vivent à part des fonctions, dans doc.cgeo. Chaque élément garde son JSON : le calcul y lit ses réglages et y écrit son repère.
#pragma once
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>

#include "conges.h"
#include "fiches.h"
#include "projet.h"

// cgResolveAll : recalcule les éléments avant le marqueur n (-1 : tous) et replace les esquisses posées dessus. Rend vrai si une esquisse a bougé.
bool resoudreConstruction(Document& d, int n);
// cgPos : le rang de la fonction après laquelle l'élément est évalué, -1 au début
int rangConstruction(const Document& d, const ElementConstruction& e);
// cgLabel : « Plan 1 · Décalé »
std::string libelleConstruction(const ElementConstruction& e);
const char* iconeConstruction(const std::string& kind);
const char* nomSorteConstruction(const std::string& kind);
// La base d'un plan d'élément, pour y poser une esquisse. Faux si l'élément n'a pas (encore) de repère.
bool baseDeConstruction(const Document& d, const std::string& id, const std::string& sub, Vec3& o, Vec3& u, Vec3& v, Vec3& n);

// cgNew : l'élément naît au marqueur, avec les réglages de sa méthode par défaut. Rend son identifiant.
std::string creerConstruction(nlohmann::ordered_json& d, const std::string& kind, int marque, const nlohmann::ordered_json& ref0);
// cgDelete : les esquisses posées dessus restent où elles sont, les éléments qui en dépendent gardent leur position (⚠)
void supprimerConstruction(nlohmann::ordered_json& d, const std::string& id);
// Ce qui s'appuie sur l'élément : le texte de la question avant suppression (cgAskDelete)
std::string questionSuppressionConstruction(const Document& d, const std::string& id);

// La fiche d'un élément : méthode, références, valeurs. Clés : x/how, r/<rang>, n/<valeur>, b/flip, b/visible.
std::vector<ChampFiche> ficheConstruction(const Document& d, const ElementConstruction& e);
// Rend le refus, vide si fait. valeur de r/<rang> : « o:XY », « cg:id[:sub] », « skent:sk:e », « skpt:sk:pt », « none », ou la référence en JSON.
std::string appliquerConstruction(nlohmann::ordered_json& d, const std::string& id, const std::string& cle, const std::string& valeur);
// Le type attendu par un emplacement (plane, axis, point, frame, curve) et sa consigne ; faux s'il n'existe pas
bool emplacementConstruction(const ElementConstruction& e, int rang, std::string& type, std::string& titre, bool* facultatif = nullptr);
// cgNextSlot : le premier emplacement obligatoire vide, -1 s'il n'y en a pas
int emplacementVide(const ElementConstruction& e);
// cgSlotHint
std::string consigneEmplacement(const std::string& type);

// Un clic sur un cylindre (holeCylOfHit) : de quoi poser un perçage ou une rainure
struct ClicCylindre {
  nlohmann::ordered_json ref;  // occFaceRefAny
  Vec3 o{}, d{}, rad{};
  double r = 0, t = 0;
  bool inner = false;
  std::string corps;
};
bool lireClicCylindre(const TopoDS_Face& f, const double point[3], bool interieurAdmis, ClicCylindre& out, std::string& erreur);
std::string creerPercageCylindre(nlohmann::ordered_json& d, const ClicCylindre& c, int marque);  // holeOnCylinder
std::string creerClavette(nlohmann::ordered_json& d, const ClicCylindre& c, int marque);  // kwOnCylinder
void clavetteSupprimee(nlohmann::ordered_json& d, const nlohmann::ordered_json& f);  // kwOnDelete, la fonction déjà retirée
// La partie de la fiche d'un perçage sur cylindre ou d'une rainure : clés z/...
void ficheCylindre(const Document& d, const ElementConstruction& e, bool sansCote, std::vector<ChampFiche>& c, bool note = false);
void ficheClavette(const Document& d, const nlohmann::ordered_json& f, std::vector<ChampFiche>& c);
const ElementConstruction* planDuCylindre(const Document& d, const std::string& esquisse);  // holeCylPlane
std::string appliquerCylindre(nlohmann::ordered_json& d, const nlohmann::ordered_json& f, const std::string& cle, const std::string& valeur);
// holeCylPlacement : la cote qui garde le trou où il est, mesurée depuis ref (nul : le milieu du cylindre). Rend le refus, vide si fait.
std::string placementCylindre(Document& d, const TopoDS_Shape& solide, const std::string& plan, const nlohmann::ordered_json& ref, double& cote, int& cote_sens);

// cgEdgeGeom, sur les points d'une arête listée : droite, cercle (centre, normale, rayon) ou rien
struct GeoArete {
  bool droite = false, cercle = false;
  Vec3 a{}, b{}, c{}, n{};
  double r = 0;
};
GeoArete geoArete(const std::vector<Vec3>& pts);
