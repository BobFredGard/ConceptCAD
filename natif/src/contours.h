// Tracé des contours d'une esquisse : traduction de skLoopTrace (src/10-scene-3d.js),
// arcAngles (src/50-esquisse-2) et skTangencesExactes (src/20-20).
#pragma once
#include <optional>
#include "projet.h"

struct Arete {
  std::string a, b;
  const Entite* e = nullptr;
  bool arc = false;
};
struct Pas {
  int arete = 0;
  std::string depuis;
};
using Chaine = std::vector<Pas>;

struct ContourPlein {
  Chaine chaine;
  std::vector<Chaine> trous;
  double aire = 0;
  std::vector<int> faces;
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
};

struct Angles {
  double a1, a2;
};
std::optional<Angles> anglesArc(const Esquisse& s, const Entite& e);
Trace tracerContours(const Esquisse& s);
// Copie de l'esquisse aux tangences exactes, ou rien s'il n'y a rien à corriger.
std::optional<Esquisse> tangencesExactes(const Esquisse& s);
