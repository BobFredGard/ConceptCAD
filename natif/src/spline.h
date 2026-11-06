// La courbe d'une spline d'esquisse : les calculs de src/50-esquisse-6-spline.js, sans lien avec l'esquisse.
// B-spline cubique bornée, non rationnelle. Le solveur ne voit que des points ; la courbe se recalcule à partir d'eux.
#pragma once
#include <array>
#include <functional>
#include <vector>

using P2d = std::array<double, 2>;

struct BSpline {
  std::vector<double> U;  // nœuds
  std::vector<P2d> P;     // pôles
  int p = 3;              // degré
  std::vector<double> u, d;  // paramètre et corde de chaque point de passage (interpolée)
  bool closed = false, ctrl = false;
  int n = 0;
  double a = 0, b = 0;  // domaine
};

// [C, C', C''...] en u : nd dérivées ; au-delà du degré, nulles
std::vector<P2d> bsEval(const BSpline& bs, double u, int nd = 0);
// Q : points de passage ; H : bout de poignée de chaque point, a[i] false s'il n'y en a pas
bool bsInterpolate(const std::vector<P2d>& Q, const std::vector<P2d>& H, const std::vector<char>& aH, bool closed, BSpline& out);
bool bsControl(const std::vector<P2d>& Q, bool closed, const std::vector<double>* knots, int deg, BSpline& out);
std::vector<P2d> bsSample(const BSpline& bs, double u0, double u1, int per);
struct EchantillonU {
  double u, x, y;
};
std::vector<EchantillonU> bsSampleU(const BSpline& bs, double u0, double u1, int per);
double bsNewtonClosest(const BSpline& f, double u, double x, double y);
std::vector<double> bsRoots(const BSpline& f, const std::function<double(double)>& g, int per = 12);
BSpline bsInsertKnot(const BSpline& bs, double u);
// Coupe en u : gauche et droite, bornées ; Pu : point exact en u, ou nul
void bsSplit(const BSpline& bs, double u, const P2d* Pu, BSpline& gauche, BSpline& droite);
BSpline bsRange(const BSpline& bs, double u0, double u1, const P2d* P0, const P2d* P1);
BSpline bsJoin(const BSpline& A, const BSpline& B);

struct Esquisse;
struct Entite;
// skSplineFit : la courbe telle qu'elle est maintenant, avec ses poignées
bool splineDe(const Esquisse& s, const Entite& e, BSpline& f);

struct PiedSpline {
  double u = 0, x = 0, y = 0, d = 0, s = 0, nx = 0, ny = 0;
};
// Le pied de (x, y) sur la courbe. u0 : le départ de la recherche, ou nul
PiedSpline bsClosest(const BSpline& f, double x, double y, const double* u0);
