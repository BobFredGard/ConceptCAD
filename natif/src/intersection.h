// Outil Intersection de l'esquisse, côté noyau : les courbes de section du plan d'esquisse avec le solide
// (src/62-esquisse-intersection.js). Le dessin ne voit que ces courbes, jamais OCCT.
#pragma once
#include <array>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <string>
#include <vector>

#include "projet.h"

struct CourbeSection {
  enum Sorte { LIGNE, CERCLE, ARC, COURBE } sorte = LIGNE;
  double x1 = 0, y1 = 0, x2 = 0, y2 = 0, cx = 0, cy = 0, r = 0;
  std::vector<std::array<double, 2>> dense;  // courbe libre : 257 points réguliers en paramètre
  int n = 0;                                 // son nombre de segments visé
  bool closed = false;
  Vec3 mid3{0, 0, 0}, on3{0, 0, 0}, c3{0, 0, 0};
  bool aC3 = false;
  std::string fk, ref;                // la face d'origine : sa clé, sa référence (JSON, telle qu'écrite au fichier)
  std::vector<std::string> fks, refs;  // cercle fait de plusieurs demi-arcs : toutes ses faces
  std::string st;                     // type de surface, pour le message
  int solide = 0;
};

struct SourceIntersection {
  std::string mode;  // "body" ou "faces"
  bool aPt = false;
  Vec3 pt{0, 0, 0};
  std::vector<std::string> faces;  // références JSON
};
inline std::string sourceEnJson(const SourceIntersection& s) {
  if (s.mode == "faces") {
    std::string o = "{\"mode\":\"faces\",\"faces\":[";
    for (size_t i = 0; i < s.faces.size(); i++) o += (i ? "," : "") + s.faces[i];
    return o + "]}";
  }
  if (!s.aPt) return "{\"mode\":\"body\",\"pt\":null}";
  const auto court = [](double v) {  // le moins de chiffres qui redonne le même nombre, comme JavaScript
    char b[40];
    for (int p = 15; p <= 17; p++) {
      snprintf(b, sizeof b, "%.*g", p, v);
      if (strtod(b, nullptr) == v) break;
    }
    return std::string(b);
  };
  return "{\"mode\":\"body\",\"pt\":[" + court(s.pt[0]) + "," + court(s.pt[1]) + "," + court(s.pt[2]) + "]}";
}

// Les sections du solide que voit l'esquisse i, calculées au premier besoin puis gardées pour la session de l'outil
class SectionsEsquisse {
 public:
  SectionsEsquisse(const Document& d, size_t i);
  ~SectionsEsquisse();
  const std::vector<CourbeSection>& candidates();
  // skIsectSourceCurves : false s'il n'y a pas de solide
  bool courbesDe(const SourceIntersection& src, std::vector<CourbeSection>& out, SourceIntersection& rebranchee);

 private:
  struct Impl;
  std::unique_ptr<Impl> i_;
};

// skIsectTrack : rebranche l'élément sur la section actuelle de sa source (ces sections sont celles de t). true s'il a bougé.
bool suivreIntersection(Esquisse& t, Entite& e, SectionsEsquisse& S);
