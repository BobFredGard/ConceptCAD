// L'engrenage (src/48-engrenages-calcul, src/76-engrenage) : la denture calculée va directement au noyau, sans esquisse
#pragma once
#include <TopoDS_Shape.hxx>

#include <array>
#include <string>
#include <utility>
#include <vector>

#include "projet.h"

// gearGeom : les cotes de la roue, de la couronne ou de la crémaillère. Lève une exception si les réglages sont impossibles.
struct GeoEngrenage {
  bool rack = false, internal = false, undercut = false, tipCut = false;
  std::string hand = "R";
  double m = 0, aDeg = 0, a = 0, b = 0, x = 0, betaDeg = 0, beta = 0, cb = 1, at = 0, mt = 0, j = 0, ks = 0;
  int z = 0;
  double rp = 0, rb = 0, ra = 0, rf = 0, D = 0, psiB = 0, psiTip = 0, xMaxFull = 0, xMin = 0;
  double pitch = 0, pitchB = 0, thick = 0, space = 0, rho = 0, dC = 0, yC = 0, phiF = 0, tipThick = 0, twist = 0, overlap = 0;
  // crémaillère
  double H = 0, ya = 0, yf = 0, yb = 0, pt = 0, L = 0, uC = 0, uTip = 0, shift = 0;
};
GeoEngrenage geoEngrenage(const ReglageEngrenage& o);
// gearChecks : vrai = bon, faux = à surveiller
std::vector<std::pair<bool, std::string>> controlesEngrenage(const GeoEngrenage& g);
// gearSolid : posé sur XY, de z = 0 à z = b, axe sur Z, une dent sur +X en bas
TopoDS_Shape formeEngrenage(const ReglageEngrenage& o);
// Pour la paire et l'aperçu : le profil (lève une exception si la dent ne se raccorde pas), ses bornes, le contour en points
void verifierProfil(const GeoEngrenage& g);                                     // gearProfile
double debutFlanc(const GeoEngrenage& g);                                       // flank.knots[0]
double finFlanc(const GeoEngrenage& g);                                         // flank.knots[dernier]
std::vector<std::array<double, 2>> polylineEngrenage(const GeoEngrenage& g, double pasArc);  // gearPolyline
