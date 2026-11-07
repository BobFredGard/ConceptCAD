// Les filets : tables, vides filetés (taraudage, filetage d'axe) et spirales du filet cosmétique (src/76-percage, src/76-filetage)
#pragma once
#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>
#include <gp_Dir.hxx>
#include <gp_Pnt.hxx>
#include <nlohmann/json.hpp>

#include <array>
#include <optional>
#include <string>
#include <vector>

#include "projet.h"

const nlohmann::ordered_json& tablesPercage();
const nlohmann::ordered_json* filetageDe(const std::string& taille);    // isoThread
const nlohmann::ordered_json* infoFiletage(const std::string& taille);  // threadInfo, absent : métrique
bool filetModelable(const std::string& taille);

// Le dessin d'un filet cosmétique : l'hélice et le cercle d'entrée (holeThreadPaths)
struct SpiraleFilet {
  std::string corps;
  std::vector<gp_Pnt> helice, anneau;
};

// isoHoleThread : filet intérieur ISO 68-1 ; rien pour le gaz, cosmétique seulement
struct FiletInterieur {
  double D = 0, P = 0, D1 = 0, rCrete = 0, rRacine = 0, c = 0;
  bool lh = false;
};
std::optional<FiletInterieur> filetInterieur(const std::string& taille, double p, double jeu);
// threadDims, pour la fiche : rayon de crête, rayon de racine, pas
std::optional<std::array<double, 3>> dimsFiletExterieur(const std::string& taille, double p, double jeu, double R);

// occHoleThreadVoid : le vide fileté d'un trou, de l'axe à la paroi, sans aucun booléen. Forme nulle s'il ne peut pas exister ; lève une exception s'il rate.
TopoDS_Shape videTaraude(const gp_Pnt& P, const gp_Dir& D, double zStart, int nT, const FiletInterieur& th, double rb, double zEnd, double tip);

// threadCompute : le filetage d'un axe résolu sur la pièce. vide : nul si le filet n'est pas modélisé. Lève une exception si la face n'existe plus.
struct FiletageCalcule {
  TopoDS_Shape vide;
  std::vector<std::string> alertes;
  bool cosmetique = false;  // à dessiner : le filet n'est pas dans le solide
  SpiraleFilet spirale;
};
FiletageCalcule calculerFiletage(const TopoDS_Shape& piece, const Fonction& f);

// threadFaceInfo : {c,u,r,p} d'une face cylindrique extérieure, ou le message à montrer dans erreur
nlohmann::ordered_json cylindreDeFiletage(const TopoDS_Shape& piece, const TopoDS_Face& face, const double point[3], std::string& erreur);

// occCutEach : un composé de composés se creuse enfant par enfant, sinon tous les outils d'un coup
TopoDS_Shape creuserFilets(const TopoDS_Shape& a, const TopoDS_Shape& vides);
TopoDS_Shape composeFilets(const std::vector<TopoDS_Shape>& v);  // occCompoundOf : un seul reste lui-même
