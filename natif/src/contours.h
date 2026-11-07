// Tracé des contours d'une esquisse : traduction de skLoopTrace (src/10-scene-3d.js),
// arcAngles (src/50-esquisse-2) et skTangencesExactes (src/20-20).
#pragma once
#include <optional>
#include "projet.h"
#include "spline.h"

struct Arete {
  std::string a, b;
  const Entite* e = nullptr;
  bool arc = false;
  bool spline = false;  // morceau de spline : la courbe exacte et sa polyligne, de a vers b
  BSpline bs;
  std::vector<P2d> poly;
};
struct Pas {
  int arete = 0;
  std::string depuis;
};
using Chaine = std::vector<Pas>;

using Anneau = std::vector<std::array<double, 2>>;
struct FaceTrace {
  Anneau ring;
  double aire = 0;
  Chaine chaine;
};
struct ContourPlein {
  Chaine chaine;
  std::vector<Chaine> trous;
  double aire = 0;
  std::vector<int> faces;
  const Entite* cercle = nullptr;  // zone choisie : un disque à trous, sans chaîne
};
struct TrouRond {
  const Entite* cercle = nullptr;
  int solide = 0;
};
struct Trace {
  std::unordered_map<std::string, Pt> pts;
  std::vector<Arete> aretes;
  std::vector<ContourPlein> solides;
  std::vector<const Entite*> cerclesSeuls;
  std::vector<TrouRond> trousRonds;
  std::vector<Pt> ouverts;  // noeuds de degré 1 : opens
  std::vector<FaceTrace> faces;           // matière première des zones fermées
  std::vector<const Entite*> cercles;
};

struct Angles {
  double a1, a2;
};
std::optional<Angles> anglesArc(const Esquisse& s, const Entite& e);
Trace tracerContours(const Esquisse& s);

// Les zones fermées d'une esquisse, profils à choisir (src/70-extrusion-profils.js)
struct BordZone {
  bool cercle = false;
  int face = -1;
  const Entite* c = nullptr;
  Pt C;
  double r = 0;
  Anneau ring;
  double aire = 0;
};
struct ZoneEsq {
  BordZone K;
  std::vector<BordZone> trous;
  double aire = 0;
  bool aPoint = false;  // skRegInner : un point bien au large des bords, ancre du choix
  std::array<double, 2> pt{};
  bool parDefaut = false;  // dans la matière de l'extrusion « toutes zones »
};
std::vector<ZoneEsq> zonesEsquisse(const Esquisse& s, const Trace& tr);  // skRegions
void completerZones(const Esquisse& s, const Trace& tr, std::vector<ZoneEsq>& zones);  // skRegionsCached
int zoneEn(const std::vector<ZoneEsq>& zones, double x, double y);  // skRegionAt : la plus petite, -1 si aucune
Trace tracePourZones(const Esquisse& s, const std::vector<std::array<double, 2>>& choix);  // skTracePick
// La polyligne d'un morceau de spline, parcourue depuis le nœud donné
std::vector<P2d> polyArete(const Arete& ed, const std::string& depuis);
// Copie de l'esquisse aux tangences exactes, ou rien s'il n'y a rien à corriger.
std::optional<Esquisse> tangencesExactes(const Esquisse& s);
