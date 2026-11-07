// Traduction de src/48-composants-normalises.js et des calculs de 48-aimants-*.js, gearPair de 48-engrenages-calcul.js
#include "normalises.h"

#include <algorithm>
#include <cmath>
#include <map>
#include <set>
#include <stdexcept>

#include "engrenage.h"
#include "filets.h"
#include "nombres_js.h"

namespace as = assemblage;

namespace normalises {
namespace {
const double PI = 3.141592653589793;
const double STD_IN = 25.4;
const double FHC_RETRAIT = 0.2;  // src/76-percage

struct LignePas {
  const char* t;
  std::vector<double> pas;
};
const std::vector<LignePas> STD_ISO_PAS = {{"M1.6", {0.35, 0.2}}, {"M2", {0.4, 0.25}}, {"M2.5", {0.45, 0.35}}, {"M3", {0.5, 0.35}}, {"M4", {0.7, 0.5}}, {"M5", {0.8, 0.5}},
  {"M6", {1, 0.75}}, {"M8", {1.25, 1, 0.75}}, {"M10", {1.5, 1.25, 1, 0.75}}, {"M12", {1.75, 1.5, 1.25, 1}}, {"M14", {2, 1.5, 1.25, 1}}, {"M16", {2, 1.5, 1}},
  {"M20", {2.5, 2, 1.5, 1}}, {"M24", {3, 2, 1.5, 1}}, {"M30", {3.5, 3, 2, 1.5, 1}}, {"M36", {4, 3, 2, 1.5}}};
const std::vector<double>* pasDe(const std::string& t) {
  for (const LignePas& l : STD_ISO_PAS)
    if (t == l.t) return &l.pas;
  return nullptr;
}
struct VisIso {
  const char* t;
  double d, dk, k, s, tp, lmin, lmax;
};
const VisIso STD_ISO4762[] = {{"M1.6", 1.6, 3, 1.6, 1.5, 0.7, 2.5, 16}, {"M2", 2, 3.8, 2, 1.5, 1, 3, 20}, {"M2.5", 2.5, 4.5, 2.5, 2, 1.1, 4, 25},
  {"M3", 3, 5.5, 3, 2.5, 1.3, 5, 30}, {"M4", 4, 7, 4, 3, 2, 6, 40}, {"M5", 5, 8.5, 5, 4, 2.5, 8, 50}, {"M6", 6, 10, 6, 5, 3, 10, 60},
  {"M8", 8, 13, 8, 6, 4, 12, 80}, {"M10", 10, 16, 10, 8, 5, 16, 100}, {"M12", 12, 18, 12, 10, 6, 20, 120}, {"M14", 14, 21, 14, 12, 7, 25, 140},
  {"M16", 16, 24, 16, 14, 8, 25, 160}, {"M20", 20, 30, 20, 17, 10, 30, 200}, {"M24", 24, 36, 24, 19, 12, 40, 200},
  {"M30", 30, 45, 30, 22, 15.5, 45, 200}, {"M36", 36, 54, 36, 27, 19, 55, 200}};
const VisIso STD_ISO10642[] = {{"M3", 3, 6.72, 1.86, 2, 1.1, 8, 30}, {"M4", 4, 8.96, 2.48, 2.5, 1.5, 8, 40}, {"M5", 5, 11.2, 3.1, 3, 1.9, 8, 50},
  {"M6", 6, 13.44, 3.72, 4, 2.2, 8, 60}, {"M8", 8, 17.92, 4.96, 5, 3, 10, 80}, {"M10", 10, 22.4, 6.2, 6, 3.6, 12, 100},
  {"M12", 12, 26.88, 7.44, 8, 4.3, 20, 100}, {"M16", 16, 33.6, 8.8, 10, 4.8, 30, 100}, {"M20", 20, 40.32, 10.16, 12, 5.6, 35, 100}};
const std::vector<double> STD_ISO_LV = {2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200};
struct VisAnsi {
  const char* t;
  double D, A, H, J_, T, unc, unf;
  const char* lmin;
  const char* lmax;
};
const VisAnsi STD_ANSI_SHCS[] = {{"#0", .06, .096, .06, .05, .025, 0, 80, "1/8", "1/2"}, {"#1", .073, .118, .073, 1.0 / 16, .031, 64, 72, "1/8", "5/8"},
  {"#2", .086, .14, .086, 5.0 / 64, .038, 56, 64, "1/8", "3/4"}, {"#3", .099, .161, .099, 5.0 / 64, .044, 48, 56, "1/8", "1"},
  {"#4", .112, .183, .112, 3.0 / 32, .051, 40, 48, "1/8", "1"}, {"#5", .125, .205, .125, 3.0 / 32, .057, 40, 44, "1/8", "1"},
  {"#6", .138, .226, .138, 7.0 / 64, .064, 32, 40, "1/8", "1-1/2"}, {"#8", .164, .27, .164, 9.0 / 64, .077, 32, 36, "1/4", "2"},
  {"#10", .19, .312, .19, 5.0 / 32, .09, 24, 32, "1/4", "2-1/2"}, {"1/4", .25, .375, .25, 3.0 / 16, .12, 20, 28, "1/4", "4"},
  {"5/16", .3125, .469, .3125, 1.0 / 4, .151, 18, 24, "3/8", "4"}, {"3/8", .375, .562, .375, 5.0 / 16, .182, 16, 24, "3/8", "5"},
  {"7/16", .4375, .656, .4375, 3.0 / 8, .213, 14, 20, "1/2", "5"}, {"1/2", .5, .75, .5, 3.0 / 8, .245, 13, 20, "1/2", "6"},
  {"5/8", .625, .938, .625, 1.0 / 2, .307, 11, 18, "3/4", "6"}, {"3/4", .75, 1.125, .75, 5.0 / 8, .37, 10, 16, "1", "6"},
  {"7/8", .875, 1.312, .875, 3.0 / 4, .432, 9, 14, "1-1/4", "6"}, {"1", 1, 1.5, 1, 3.0 / 4, .495, 8, 12, "1-1/2", "6"}};
struct VisAnsiF {
  const char* t;
  double D, A, J_, T;
  const char* lmin;
  const char* lmax;
};
const VisAnsiF STD_ANSI_FHCS[] = {{"#2", .086, .197, .05, .038, "1/8", "3/4"}, {"#3", .099, .226, 1.0 / 16, .044, "1/8", "1"},
  {"#4", .112, .255, 1.0 / 16, .055, "1/8", "1"}, {"#5", .125, .281, 5.0 / 64, .061, "1/8", "1"}, {"#6", .138, .307, 5.0 / 64, .066, "1/8", "1-1/2"},
  {"#8", .164, .359, 3.0 / 32, .076, "1/4", "2"}, {"#10", .19, .411, 1.0 / 8, .087, "1/4", "2"}, {"1/4", .25, .531, 5.0 / 32, .111, "3/8", "3"},
  {"5/16", .3125, .656, 3.0 / 16, .135, "1/2", "3"}, {"3/8", .375, .781, 7.0 / 32, .159, "1/2", "3"}, {"7/16", .4375, .844, 1.0 / 4, .159, "5/8", "3"},
  {"1/2", .5, .938, 5.0 / 16, .172, "5/8", "4"}, {"5/8", .625, 1.188, 3.0 / 8, .22, "1", "4"}, {"3/4", .75, 1.438, 1.0 / 2, .265, "1", "4"}};
const std::vector<std::string> STD_INCH_LV = {"1/8", "3/16", "1/4", "5/16", "3/8", "7/16", "1/2", "5/8", "3/4", "7/8", "1", "1-1/4", "1-1/2", "1-3/4", "2",
  "2-1/4", "2-1/2", "2-3/4", "3", "3-1/4", "3-1/2", "3-3/4", "4", "4-1/2", "5", "5-1/2", "6"};
struct Din906 { const char* t; double d, tpi, L, s, tp; };
const Din906 STD_DIN906[] = {{"R 1/8", 9.728, 28, 8, 5, 4}, {"R 1/4", 13.157, 19, 10, 7, 5}, {"R 3/8", 16.662, 19, 10, 8, 5}, {"R 1/2", 20.955, 14, 10, 10, 5},
  {"R 3/4", 26.441, 14, 12, 12, 6}, {"R 1", 33.249, 11, 12, 17, 6}, {"R 1-1/4", 41.91, 11, 18, 22, 11.5}, {"R 1-1/2", 47.803, 11, 20, 24, 11.5}};
struct Din908 { const char* t; double d, tpi, dk, k, i, s, tp; };
const Din908 STD_DIN908[] = {{"G 1/8", 9.728, 28, 14, 3, 8, 5, 5}, {"G 1/4", 13.157, 19, 18, 3, 12, 6, 7}, {"G 3/8", 16.662, 19, 22, 3, 12, 8, 7.5},
  {"G 1/2", 20.955, 14, 26, 4, 14, 10, 7.5}, {"G 3/4", 26.441, 14, 32, 4, 16, 12, 9}, {"G 1", 33.249, 11, 39, 5, 16, 17, 9},
  {"G 1-1/4", 41.91, 11, 49, 5, 16, 22, 10.5}, {"G 1-1/2", 47.803, 11, 52, 5, 16, 24, 10.5}, {"G 2", 59.614, 11, 68, 5, 20, 32, 14}};
struct Nptf { const char* t; double D, tpi, cle, L; };
const Nptf STD_NPTF[] = {{"1/16", .3125, 27, 5.0 / 32, .31}, {"1/8", .405, 27, 3.0 / 16, .31}, {"1/4", .54, 18, 1.0 / 4, .44}, {"3/8", .675, 18, 5.0 / 16, .44},
  {"1/2", .84, 14, 3.0 / 8, .56}, {"3/4", 1.05, 14, 9.0 / 16, .56}, {"1", 1.315, 11.5, 5.0 / 8, .69}, {"1-1/4", 1.66, 11.5, 3.0 / 4, .69},
  {"1-1/2", 1.9, 11.5, 3.0 / 4, .69}, {"2", 2.375, 11.5, 1, .69}};
double chanfreinGoupille(double d) {  // STD_PIN_C, 0 : pas dans la table
  static const std::map<double, double> T = {{1, .2}, {1.5, .3}, {2, .35}, {2.5, .4}, {3, .5}, {4, .63}, {5, .8}, {6, 1.2}, {8, 1.6}, {10, 2}, {12, 2.5}, {13, 2.5}, {14, 2.5}, {16, 3}, {18, 3}, {20, 3.5}};
  const auto it = T.find(d);
  return it == T.end() ? 0 : it->second;
}
struct LigneGoupille {  // Ø écrit comme le navigateur : nombre, ou fraction de pouce
  double d;
  std::string txt;
  double ep, lmin, lmax;
  std::string lminT, lmaxT;
};
std::vector<LigneGoupille> lignesMm(const std::vector<std::array<double, 3>>& T) {
  std::vector<LigneGoupille> o;
  for (const auto& r : T) o.push_back({r[0], js::texte(r[0]), 0, r[1], r[2], "", ""});
  return o;
}
const std::vector<LigneGoupille>& STD_ISO2338() { static const auto v = lignesMm({{1, 4, 10}, {1.5, 4, 16}, {2, 6, 20}, {2.5, 6, 24}, {3, 8, 30}, {4, 8, 40}, {5, 10, 50}, {6, 12, 60}, {8, 14, 80}, {10, 18, 95}, {12, 22, 140}, {16, 26, 180}, {20, 35, 200}}); return v; }
const std::vector<LigneGoupille>& STD_ISO8734() { static const auto v = lignesMm({{1, 3, 10}, {1.5, 4, 16}, {2, 5, 20}, {2.5, 6, 24}, {3, 8, 30}, {4, 10, 40}, {5, 12, 50}, {6, 14, 60}, {8, 18, 80}, {10, 22, 100}, {12, 26, 100}, {16, 40, 100}, {20, 50, 100}}); return v; }
const std::vector<LigneGoupille>& STD_ISO2339() { static const auto v = lignesMm({{1, 6, 10}, {1.5, 8, 24}, {2, 10, 35}, {2.5, 10, 35}, {3, 12, 45}, {4, 14, 55}, {5, 18, 60}, {6, 22, 90}, {8, 22, 120}, {10, 26, 160}, {12, 32, 180}, {16, 40, 200}, {20, 45, 200}}); return v; }
const std::vector<LigneGoupille>& STD_ISO8752() {
  static const std::vector<LigneGoupille> v = [] {
    const double T[][4] = {{1, .2, 4, 20}, {1.5, .3, 4, 20}, {2, .4, 4, 30}, {2.5, .5, 4, 30}, {3, .6, 4, 40}, {4, .8, 4, 50}, {5, 1, 5, 80}, {6, 1.2, 10, 100},
      {8, 1.5, 10, 120}, {10, 2, 10, 160}, {12, 2.5, 10, 180}, {13, 2.5, 10, 180}, {14, 3, 10, 200}, {16, 3, 10, 200}, {18, 3.5, 10, 200}, {20, 4, 10, 200}};
    std::vector<LigneGoupille> o;
    for (const auto& r : T) o.push_back({r[0], js::texte(r[0]), r[1], r[2], r[3], "", ""});
    return o;
  }();
  return v;
}
double fraction(const std::string& s);
std::vector<LigneGoupille> lignesPouce(const std::vector<std::array<std::string, 3>>& T) {
  std::vector<LigneGoupille> o;
  for (const auto& r : T) o.push_back({fraction(r[0]), r[0], 0, 0, 0, r[1], r[2]});
  return o;
}
const std::vector<LigneGoupille>& STD_ANSI_DOWEL() { static const auto v = lignesPouce({{"1/16", "3/16", "1"}, {"3/32", "3/16", "1-1/4"}, {"1/8", "1/4", "2"}, {"5/32", "3/8", "2"}, {"3/16", "3/8", "2-1/2"},
  {"1/4", "1/2", "3"}, {"5/16", "1/2", "3"}, {"3/8", "1/2", "4"}, {"7/16", "3/4", "4"}, {"1/2", "3/4", "5"}, {"5/8", "1", "6"}, {"3/4", "1", "6"},
  {"7/8", "1-1/2", "6"}, {"1", "1-1/2", "6"}}); return v; }
const std::vector<LigneGoupille>& STD_ANSI_SPRING() {
  static const std::vector<LigneGoupille> v = [] {
    struct L { const char* t; double e; const char* a; const char* b; };
    const L T[] = {{"1/16", .012, "1/8", "1"}, {"5/64", .018, "1/8", "1"}, {"3/32", .022, "3/16", "1-1/2"}, {"1/8", .028, "1/4", "2"},
      {"5/32", .032, "1/4", "2-1/2"}, {"3/16", .04, "5/16", "3"}, {"7/32", .048, "3/8", "3"}, {"1/4", .062, "3/8", "4"}, {"5/16", .062, "1/2", "4"},
      {"3/8", .077, "1/2", "4"}, {"7/16", .077, "3/4", "4"}, {"1/2", .094, "3/4", "4"}};
    std::vector<LigneGoupille> o;
    for (const L& r : T) o.push_back({fraction(r.t), r.t, r.e, 0, 0, r.a, r.b});
    return o;
  }();
  return v;
}
const std::vector<double> STD_PIN_LV = {3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 120, 140, 160, 180, 200};
struct Iso773 { double de, a, b, h, t1, t2, lmin, lmax; };
const Iso773 STD_ISO773[] = {{6, 8, 2, 2, 1.2, 1, 6, 20}, {8, 10, 3, 3, 1.8, 1.4, 6, 36}, {10, 12, 4, 4, 2.5, 1.8, 8, 45}, {12, 17, 5, 5, 3, 2.3, 10, 56},
  {17, 22, 6, 6, 3.5, 2.8, 14, 70}, {22, 30, 8, 7, 4, 3.3, 18, 90}, {30, 38, 10, 8, 5, 3.3, 22, 110}, {38, 44, 12, 8, 5, 3.3, 28, 140},
  {44, 50, 14, 9, 5.5, 3.8, 36, 160}, {50, 58, 16, 10, 6, 4.3, 45, 180}, {58, 65, 18, 11, 7, 4.4, 50, 200}, {65, 75, 20, 12, 7.5, 4.9, 56, 220},
  {75, 85, 22, 14, 9, 5.4, 63, 250}, {85, 95, 25, 14, 9, 5.4, 70, 280}, {95, 110, 28, 16, 10, 6.4, 80, 320}, {110, 130, 32, 18, 11, 7.4, 90, 360}};
const std::vector<double> STD_KEY_LV = {6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 63, 70, 80, 90, 100, 110, 125, 140, 160, 180, 200, 220, 250, 280, 320, 360};
const std::vector<double> GEAR_MODULES = {0.5, 0.6, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25};

struct Aimant {
  const char* code; const char* src; const char* mat; const char* grade; const char* s;
  double d, di, a, b, h, br0, br1, hcb0, hcb1, hcj, bh0, bh1, tmax;
  const char* force; const char* dirTxt;
};
const Aimant MAG_CAT[] = {
#include "aimants_catalogue.inc"
};

// ---- outils ----
std::string S(const J& st, const char* k) {
  const auto it = st.find(k);
  return it != st.end() && it->is_string() ? it->get<std::string>() : std::string();
}
double N(const J& st, const char* k) {
  const auto it = st.find(k);
  if (it == st.end()) return std::nan("");
  if (it->is_number()) return it->get<double>();
  if (it->is_string()) return js::nombre(it->get<std::string>());
  return it->is_null() ? 0 : std::nan("");
}
double ouZero(double v) { return std::isnan(v) ? 0 : v; }
double fraction(const std::string& s) {  // stdFrac
  size_t i = 0;
  double ent = 0;
  std::string reste = s;
  const size_t tiret = s.find('-');
  if (tiret != std::string::npos) {
    ent = js::nombre(s.substr(0, tiret));
    reste = s.substr(tiret + 1);
  }
  const size_t b = reste.find('/');
  (void)i;
  if (b == std::string::npos) return js::nombre(s);
  return ent + js::nombre(reste.substr(0, b)) / js::nombre(reste.substr(b + 1));
}
std::string F(double v) {  // stdF
  std::string s = js::texte(js::arrondi(v, 3));
  std::replace(s.begin(), s.end(), '.', ',');
  return s;
}
std::string F2(double v) {  // les contrôles : f(v)
  std::string s = js::texte(js::arrondi(v, 2));
  std::replace(s.begin(), s.end(), '.', ',');
  return s;
}
std::vector<double> longueurs(const std::vector<double>& lv, double a, double b) {
  std::vector<double> o;
  for (double x : lv)
    if (x >= a - 1e-9 && x <= b + 1e-9) o.push_back(x);
  return o;
}
std::vector<std::string> longueursPouce(const std::string& a, const std::string& b) {
  const double A = fraction(a), B = fraction(b);
  std::vector<std::string> o;
  for (const std::string& x : STD_INCH_LV)
    if (fraction(x) >= A - 1e-9 && fraction(x) <= B + 1e-9) o.push_back(x);
  return o;
}
Sommet P(double x, double y) {
  Sommet s;
  s.x = x;
  s.y = y;
  return s;
}
Sommet PA(double x, double y, double cx, double cy, int sens = -1) {
  Sommet s = P(x, y);
  s.arc = true;
  s.cx = cx;
  s.cy = cy;
  s.sens = sens;
  return s;
}
struct Bombe {
  Sommet edge, top;
};
Bombe bombe(double r, double R, double z0, bool up) {  // stdCrown
  const double h = R - std::sqrt(std::max(0.0, R * R - r * r)), zc = up ? z0 - R : z0 + R;
  return {P(r, up ? z0 - h : z0 + h), PA(0, z0, 0, zc)};
}
std::vector<std::array<double, 2>> polyPoints(const std::vector<Sommet>& pts) {  // stdPolyPts
  std::vector<std::array<double, 2>> out;
  for (size_t j = 0; j < pts.size(); j++) {
    const Sommet& q = pts[j];
    const Sommet& p = pts[(j + pts.size() - 1) % pts.size()];
    if (q.arc) {
      const double r = std::hypot(q.x - q.cx, q.y - q.cy);
      double a0 = std::atan2(p.y - q.cy, p.x - q.cx), a1 = std::atan2(q.y - q.cy, q.x - q.cx);
      const bool ccw = q.sens >= 0 ? q.sens == 1 : ((p.x - q.cx) * (q.y - q.cy) - (p.y - q.cy) * (q.x - q.cx)) > 0;
      if (ccw) {
        while (a1 <= a0) a1 += 2 * PI;
      } else {
        while (a1 >= a0) a1 -= 2 * PI;
      }
      for (int k = 1; k <= 16; k++) {
        const double a = a0 + (a1 - a0) * k / 16;
        out.push_back({q.cx + r * std::cos(a), q.cy + r * std::sin(a)});
      }
    } else out.push_back({q.x, q.y});
  }
  return out;
}
Operation opHex(double z, double s, double t) {
  Operation o;
  o.k = "hex";
  o.z = z;
  o.s = s;
  o.t = t;
  return o;
}

// ---- vis ----
void visCHC(Piece& sp, double d, double dk, double k, double s, double t, double L, double Pas) {  // stdScrewCHC
  const double c = std::min(Pas, d * 0.15), ch = std::max(0.1, dk * 0.04);
  sp.prof = {P(0, -L), P(d / 2 - c, -L), P(d / 2, -L + c), P(d / 2, 0), P(dk / 2, 0), P(dk / 2, k - ch), P(dk / 2 - ch, k), P(0, k)};
  sp.ops = {opHex(k, s, t)};
}
void visFHC(Piece& sp, double d, double dk, double k, double angle, double s, double t, double L, double Pas) {  // stdScrewFHC
  const double c = std::min(Pas, d * 0.15), dr = dk * 0.97, tg = std::tan(angle / 2 * PI / 180);
  const double zb = -k, ze = zb + (dr - d) / 2 / tg;
  sp.prof = {P(0, -L), P(d / 2 - c, -L), P(d / 2, -L + c), P(d / 2, zb), P(dr / 2, std::min(ze, -0.05)), P(dr / 2, 0), P(0, 0)};
  sp.ops = {opHex(0, s, t)};
}
std::optional<Filetage> filetageTige(const std::string& size, double Pas, double d, double L, double b, double k, bool mod) {  // stdThr
  if (!filetageDe(size)) return std::nullopt;
  const bool full = L - k <= b + 1e-6;
  Filetage f;
  f.size = size;
  f.p = js::arrondi(Pas, 4);
  f.r = d / 2;
  f.z = -(k + (L - k) / 2);
  f.lenMode = full ? "full" : "len";
  f.len = js::arrondi(b, 3);
  f.model = mod;
  return f;
}
Piece visIso(const J& st) {  // stdIsoScrew
  const bool fhc = S(st, "type") == "fhc";
  const VisIso* r = nullptr;
  if (fhc) {
    r = &STD_ISO10642[0];
    for (const VisIso& x : STD_ISO10642)
      if (S(st, "size") == x.t) r = &x;
  } else {
    r = &STD_ISO4762[0];
    for (const VisIso& x : STD_ISO4762)
      if (S(st, "size") == x.t) r = &x;
  }
  const std::vector<double>& pas = *pasDe(r->t);
  double Pas = N(st, "pitch");
  if (std::isnan(Pas) || Pas == 0) Pas = pas[0];
  const double L = N(st, "len");
  const bool fin = std::abs(Pas - pas[0]) > 1e-9;
  Piece g;
  if (fhc) visFHC(g, r->d, r->dk, r->k, 90, r->s, r->tp, L, Pas);
  else visCHC(g, r->d, r->dk, r->k, r->s, r->tp, L, Pas);
  const std::string th = std::string(r->t) + (fin ? "×" + F(Pas) : "");
  const std::string norm = fhc ? "ISO 10642" : "ISO 4762";
  const bool mod = S(st, "fil") == "mod";
  g.thr = filetageTige(r->t, Pas, r->d, L, 2 * r->d + 12, fhc ? r->k : 0, mod);
  g.seat = fhc ? "flush" : "under";
  g.sink = fhc ? FHC_RETRAIT : 0;
  g.key = norm + "|" + th + "|" + js::texte(L) + (mod ? "|filet" : "");
  g.norm = norm;
  g.desig = th + "×" + F(L);
  g.name = (fhc ? "FHC " : "CHC ") + th + "×" + F(L);
  g.info = std::string(fhc ? "Vis à tête fraisée six pans creux, fraisure 90°" : "Vis à tête cylindrique six pans creux") + " · pas " + F(Pas) + (fin ? " (fin)" : " (gros)") +
           " · " + (fhc ? "Ø tête " : "dk ") + F(r->dk) + " · k " + F(r->k) + " · clé " + F(r->s) + " · L " + F(L) + (fhc ? " (tête comprise)" : " (sous tête)");
  return g;
}
const VisAnsi* ligneShcs(const std::string& t) {
  for (const VisAnsi& x : STD_ANSI_SHCS)
    if (t == x.t) return &x;
  return nullptr;
}
const VisAnsiF* ligneFhcs(const std::string& t) {
  for (const VisAnsiF& x : STD_ANSI_FHCS)
    if (t == x.t) return &x;
  return nullptr;
}
Piece visAnsi(const J& st) {  // stdAnsiScrew
  const bool fhc = S(st, "type") == "fhc";
  const VisAnsiF* rf = fhc ? (ligneFhcs(S(st, "size")) ? ligneFhcs(S(st, "size")) : &STD_ANSI_FHCS[0]) : nullptr;
  const VisAnsi* rs = !fhc ? (ligneShcs(S(st, "size")) ? ligneShcs(S(st, "size")) : &STD_ANSI_SHCS[0]) : nullptr;
  const std::string t = fhc ? rf->t : rs->t;
  const VisAnsi* s3 = ligneShcs(t);
  const std::string serie = S(st, "thr") == "UNF" || s3->unc == 0 ? "UNF" : "UNC";
  const double tpi = serie == "UNF" ? s3->unf : s3->unc;
  const std::string len = S(st, "len");
  const double L = fraction(len), I = STD_IN, Pas = I / tpi;
  Piece g;
  const double kf = fhc ? (rf->A - rf->D) / 2 / std::tan(41 * PI / 180) * I : 0;
  if (fhc) visFHC(g, rf->D * I, rf->A * I, kf, 82, rf->J_ * I, rf->T * I, L * I, Pas);
  else visCHC(g, rs->D * I, rs->A * I, rs->H * I, rs->J_ * I, rs->T * I, L * I, Pas);
  const std::string th = t + "-" + js::texte(tpi) + " " + serie;
  const std::string norm = fhc ? "ASME B18.3 FHCS" : "ASME B18.3 SHCS";
  const bool mod = S(st, "fil") == "mod";
  const double D = fhc ? rf->D : rs->D;
  g.thr = filetageTige(th, Pas, D * I, L * I, (2 * D + 0.5) * I, fhc ? kf : 0, mod);
  g.seat = fhc ? "flush" : "under";
  g.sink = fhc ? FHC_RETRAIT : 0;
  g.key = norm + "|" + th + "|" + len + (mod ? "|filet" : "");
  g.norm = norm;
  g.desig = th + " × " + len + "\"";
  g.name = (fhc ? "FHCS " : "SHCS ") + th + " × " + len + "\"";
  g.info = std::string(fhc ? "Flat head socket cap screw, fraisure 82°" : "Socket head cap screw") + " · " + js::texte(tpi) + " filets/pouce · Ø " + F(D * I) + " mm · L " + F(L * I) + " mm" + (fhc ? " (tête comprise)" : " (sous tête)");
  return g;
}
Piece bouchon(const J& st) {  // stdPlug
  Piece g;
  const std::string ty = S(st, "type"), si = S(st, "size");
  if (ty == "din908") {
    const Din908* r = &STD_DIN908[0];
    for (const Din908& x : STD_DIN908)
      if (si == x.t) r = &x;
    const double d = r->d, tpi = r->tpi, dk = r->dk, k = r->k, i = r->i, s = r->s, t = r->tp, c = std::min(STD_IN / tpi, 1.5), ch = 0.4;
    std::string sansEsp = r->t;
    sansEsp.erase(sansEsp.find(' '), 1);
    g.thr = filetageTige(sansEsp, STD_IN / tpi, d, i, i, 0, false);
    g.seat = "under";
    g.key = std::string("DIN 908|") + r->t;
    g.norm = "DIN 908";
    g.desig = std::string(r->t) + " A";
    g.name = std::string("Bouchon DIN 908 ") + r->t;
    g.info = std::string("Bouchon à collerette, six pans creux, filet cylindrique ") + r->t + " (ISO 228) · Ø collerette " + F(dk) + " · k " + F(k) + " · filetée " + F(i) + " · clé " + F(s);
    g.prof = {P(0, -i), P(d / 2 - c, -i), P(d / 2, -i + c), P(d / 2, 0), P(dk / 2, 0), P(dk / 2, k - ch), P(dk / 2 - ch, k), P(0, k)};
    g.ops = {opHex(k, s, t)};
    return g;
  }
  const bool npt = ty == "nptf";
  const double I = STD_IN;
  std::string t0;
  double D, tpi, s, L, t;
  if (npt) {
    const Nptf* r = &STD_NPTF[0];
    for (const Nptf& x : STD_NPTF)
      if (si == x.t) r = &x;
    t0 = r->t;
    D = r->D * I;
    tpi = r->tpi;
    s = r->cle * I;
    L = r->L * I;
    t = L * 0.6;
  } else {
    const Din906* r = &STD_DIN906[0];
    for (const Din906& x : STD_DIN906)
      if (si == x.t) r = &x;
    t0 = r->t;
    D = r->d;
    tpi = r->tpi;
    s = r->s;
    L = r->L;
    t = r->tp;
  }
  const double rt = D / 2, rb = rt - L / 32, c = std::min(I / tpi * 0.6, L * 0.12);
  const std::string nm = npt ? t0 + "-" + js::texte(tpi) + " NPTF" : t0;
  g.seat = "flush";
  g.key = std::string(npt ? "NPTF" : "DIN 906") + "|" + t0;
  g.norm = npt ? "ASME B1.20.3 NPTF" : "DIN 906";
  g.desig = nm;
  g.name = "Bouchon " + (npt ? nm : "DIN 906 " + nm);
  g.info = std::string("Bouchon conique six pans creux, sans collerette") + (npt ? " (Dryseal, conicité 1:16, dimensions de catalogue)" : " (ISO 7-1, conicité 1:16)") + " · Ø " + F(D) + " · L " + F(L) + " · clé " + F(s);
  g.prof = {P(0, -L), P(rb - c, -L), P(rb, -L + c), P(rt, 0), P(0, 0)};
  g.ops = {opHex(0, s, t)};
  return g;
}
const std::vector<LigneGoupille>& lignesGoupille(const std::string& t) {  // stdPinRows
  return t == "iso8734" ? STD_ISO8734() : t == "iso2339" ? STD_ISO2339() : t == "iso8752" ? STD_ISO8752() : t == "dowel" ? STD_ANSI_DOWEL() : t == "spring" ? STD_ANSI_SPRING() : STD_ISO2338();
}
Piece corpsGoupille(const J& st) {  // stdPinBody
  const std::string ty = S(st, "type"), size = S(st, "size"), len = S(st, "len");
  const bool ansi = ty == "dowel" || ty == "spring";
  const double d = ansi ? fraction(size) * STD_IN : N(st, "size"), L = ansi ? fraction(len) * STD_IN : N(st, "len"), r = d / 2;
  double c;
  if (ansi) c = std::max(0.15, d * 0.08);
  else {
    c = chanfreinGoupille(N(st, "size"));
    if (c == 0) c = d * 0.15;
  }
  const std::string lab = ansi ? size + "\" × " + len + "\"" : F(d) + "×" + F(L);
  Piece g;
  if (ty == "iso8752" || ty == "spring") {
    double w;
    if (ty == "spring") {
      w = STD_ANSI_SPRING()[0].ep * STD_IN;
      for (const LigneGoupille& x : STD_ANSI_SPRING())
        if (x.txt == size) {
          w = x.ep * STD_IN;
          break;
        }
    } else {
      w = STD_ISO8752()[0].ep;
      for (const LigneGoupille& x : STD_ISO8752())
        if (x.d == N(st, "size")) {
          w = x.ep;
          break;
        }
    }
    const double ri = r - w, cc = std::min(w * 0.8, c), gg = std::max(0.15, d * 0.1);
    g.norm = ty == "spring" ? "ASME B18.8.2 spring" : "ISO 8752";
    g.key = g.norm + "|" + lab;
    g.desig = lab;
    g.name = (ty == "spring" ? "Spring pin " : "Goupille élastique ISO 8752 ") + lab;
    g.info = "Goupille élastique fendue · épaisseur " + F(w) + " · fente " + F(gg) + " · Ø " + F(d) + " · L " + F(L);
    g.prof = {P(ri, 0), P(r - cc, 0), P(r, cc), P(r, L - cc), P(r - cc, L), P(ri, L)};
    Operation o;
    o.k = "slot";
    o.x0 = ri - 0.3;
    o.x1 = r + 1;
    o.w = gg;
    o.L = L;
    g.ops = {o};
    return g;
  }
  if (ty == "iso2339") {
    const double R2 = r + L / 100;
    const Bombe a = bombe(r, d, 0, false), b = bombe(R2, 2 * R2, L, true);
    g.key = "ISO 2339|" + lab;
    g.norm = "ISO 2339";
    g.desig = "A " + lab;
    g.name = "Goupille conique ISO 2339 " + lab;
    g.info = "Goupille conique 1:50 · Ø petit bout " + F(d) + " · Ø gros bout " + F(2 * R2) + " · L " + F(L);
    g.prof = {P(0, 0), PA(a.edge.x, a.edge.y, 0, d), b.edge, b.top};
    return g;
  }
  if (ty == "iso8734" || ty == "dowel") {
    const Bombe b = bombe(r, d, L, true);
    g.norm = ty == "dowel" ? "ASME B18.8.2 dowel" : "ISO 8734";
    g.key = g.norm + "|" + lab;
    g.desig = lab;
    g.name = (ty == "dowel" ? "Dowel pin " : "Goupille ISO 8734 ") + lab;
    g.info = "Goupille cylindrique trempée, rectifiée (m6) · un bout chanfreiné, un bout bombé · Ø " + F(d) + " · L " + F(L);
    g.prof = {P(0, 0), P(r - c, 0), P(r, c), b.edge, b.top};
    return g;
  }
  g.key = "ISO 2338|" + lab;
  g.norm = "ISO 2338";
  g.desig = "m6 " + lab;
  g.name = "Goupille ISO 2338 " + lab;
  g.info = "Goupille cylindrique non trempée (m6) · chanfreins " + F(c) + " · Ø " + F(d) + " · L " + F(L);
  g.prof = {P(0, 0), P(r - c, 0), P(r, c), P(r, L - c), P(r - c, L), P(0, L)};
  return g;
}
Piece goupille(const J& st) {  // stdPin
  Piece sp = corpsGoupille(st);
  double zmin = 1e300, zmax = -1e300;
  for (const auto& p : polyPoints(sp.prof)) {
    zmin = std::min(zmin, p[1]);
    zmax = std::max(zmax, p[1]);
  }
  const double dz = -(zmin + zmax) / 2;
  for (Sommet& q : sp.prof) {
    q.y += dz;
    if (q.arc) q.cy += dz;
  }
  for (Operation& o : sp.ops)
    if (o.k == "slot") o.z0 = dz;
  sp.seat = "mid";
  return sp;
}
std::string tailleCle(const Iso773& r) { return js::texte(r.b) + "x" + js::texte(r.h); }
Piece clavette(const J& st) {  // stdKey
  const Iso773* r = &STD_ISO773[0];
  for (const Iso773& x : STD_ISO773)
    if (tailleCle(x) == S(st, "size")) {
      r = &x;
      break;
    }
  const double b = r->b, h = r->h, L = N(st, "len");
  std::string f = S(st, "type");
  if (f.empty()) f = "A";
  const std::string lab = js::texte(b) + "×" + js::texte(h) + "×" + F(L);
  Piece g;
  g.key = "ISO 773|" + f + "|" + lab;
  g.norm = "ISO 773";
  g.desig = f + " " + lab;
  g.name = "Clavette " + f + " " + lab;
  g.info = "Clavette parallèle forme " + f + (f == "A" ? " (bouts ronds)" : f == "B" ? " (bouts droits)" : " (un bout rond)") + " · arbre Ø " + js::texte(r->de) + " à " + js::texte(r->a) +
           " · rainure arbre t1 " + F(r->t1) + " · moyeu t2 " + F(r->t2);
  Operation o;
  o.k = "key";
  o.forme = f;
  o.b = b;
  o.h = h;
  o.L = L;
  g.ops = {o};
  return g;
}
std::vector<Sommet> contourClavette(const Operation& o) {  // stdKeyOutline
  const double hl = o.L / 2, r = o.b / 2, x0 = -hl + r, x1 = hl - r;
  if (o.forme == "B") return {P(-hl, -r), P(hl, -r), P(hl, r), P(-hl, r)};
  if (o.forme == "C") return {PA(x0, -r, x0, 0, 1), P(hl, -r), P(hl, r), P(x0, r)};
  return {PA(x0, -r, x0, 0, 1), P(x1, -r), PA(x1, r, x1, 0, 1), P(x0, r)};
}
const Iso773* iso773Pour(double d) {  // stdIso773For
  for (size_t i = 0; i < std::size(STD_ISO773); i++) {
    const Iso773& r = STD_ISO773[i];
    if ((i == 0 ? d >= r.de : d > r.de) && d <= r.a) return &r;
  }
  return nullptr;
}
std::vector<Sommet> boucleAlesage(const Operation& o) {  // gearBoreLoop
  const double r = o.d / 2, h = o.b / 2, xe = std::sqrt(r * r - h * h), xf = r + o.t2;
  return {P(xe, h), PA(xe, -h, 0, 0, 1), P(xf, -h), P(xf, h)};
}
std::vector<Controle> controlesRoue(const GeoEngrenage& g) {
  std::vector<Controle> o;
  for (const auto& c : controlesEngrenage(g)) o.push_back({c.first, c.second});
  return o;
}
std::vector<Controle> controlesAlesage(const GeoEngrenage& g, const Operation& B) {  // gearBoreChecks
  const double wall = g.rf - (B.d / 2 + B.t2);
  if (B.b != 0 && !(B.d > B.b)) throw std::runtime_error("alésage plus petit que sa rainure");
  if (!(wall > 0)) throw std::runtime_error(std::string("alésage trop grand : ") + (B.b != 0 ? "sa rainure atteint" : "il atteint") + " le pied de dent");
  const std::string lab = B.b != 0 ? "Paroi sous la rainure" : "Paroi sous les dents";
  std::vector<Controle> out;
  if (wall < 2 * g.m) out.push_back({false, lab + " mince : " + F2(wall) + " mm (repère usuel : au moins 2 modules, soit " + F2(2 * g.m) + " mm)."});
  else out.push_back({true, lab + " : " + F2(wall) + " mm."});
  if (B.b != 0 && g.b < B.b) out.push_back({false, "Roue plus étroite (" + F2(g.b) + " mm) que la rainure (" + F2(B.b) + " mm) : la pose automatique de la clavette se trompera de sens."});
  return out;
}
std::string mainDe(const GeoEngrenage& g) { return g.hand == "L" ? "gauche" : "droite"; }
Piece engrenage(const J& st) {  // stdGear
  ReglageEngrenage o;
  o.m = N(st, "m");
  o.z = std::floor(N(st, "z") + 0.5);
  o.alpha = N(st, "alpha");
  o.b = N(st, "b");
  o.x = ouZero(N(st, "x"));
  o.beta = ouZero(N(st, "beta"));
  o.hand = S(st, "hand") == "L" ? "L" : "R";
  if (N(st, "j") > 0) o.j = N(st, "j");
  if (N(st, "ks") > 0) o.ks = N(st, "ks");
  const std::string pairKey = o.j != 0 || o.ks != 0 ? "|j" + js::texte(o.j) + "|k" + js::texte(o.ks) : std::string();
  const std::string pairInfo = o.j != 0 ? " · dent amincie de " + F(o.j) + " mm (jeu de paire)" : std::string();
  const std::string kind = S(st, "kind");
  if (kind == "rack") {
    o.kind = "rack";
    o.H = ouZero(N(st, "H"));
    o.x = 0;
  }
  if (kind == "int") {
    o.kind = "int";
    o.D = ouZero(N(st, "D"));
  }
  const GeoEngrenage g = geoEngrenage(o);
  Piece sp;
  sp.aControles = true;
  Operation op;
  op.k = "gear";
  const std::string z = js::texte(g.z);
  const std::string alphaLab = g.aDeg == 20 ? std::string() : " α" + F(g.aDeg) + "°";
  const std::string helixLab = g.betaDeg != 0 ? " β" + F(g.betaDeg) + "° " + (g.hand == "L" ? "G" : "D") : std::string();
  const auto cle = [](std::initializer_list<std::string> l) {
    std::string s = "GEAR";
    for (const std::string& x : l) s += "|" + x;
    return s;
  };
  const std::string betaMain = g.betaDeg != 0 ? g.hand : "R";
  if (g.rack) {
    o.H = g.H;
    const std::string labR = "m" + F(g.m) + " Z" + z + alphaLab + helixLab + " × " + F(g.b) + " H" + F(g.ya - g.yb);
    sp.key = cle({js::texte(g.m), z, js::texte(g.aDeg), js::texte(g.b), "0", "0", "0", js::texte(g.betaDeg), betaMain, "rack", js::texte(g.H)}) + pairKey;
    sp.norm = "ISO 53";
    sp.desig = labR;
    sp.name = "Crémaillère " + labR;
    sp.info = "Pas " + F(g.pt) + " · longueur " + F(g.L) + " · hauteur totale " + F(g.ya - g.yb) + " · ligne de référence à " + F(g.ya) + " mm du sommet des dents" + (g.betaDeg != 0 ? " · module apparent " + F(g.mt) : std::string()) + pairInfo;
    sp.checks = controlesRoue(g);
    op.gear = o;
    sp.ops = {op};
    sp.reach = g.L / 2;
    return sp;
  }
  verifierProfil(g);
  const std::string deport = g.x != 0 ? " x" + std::string(g.x > 0 ? "+" : "") + F(g.x) : std::string();
  const std::string cotes = "Ø primitif " + F(2 * g.rp) + " · Ø de tête " + F(2 * g.ra) + " · Ø de pied " + F(2 * g.rf) + " · Ø de base " + F(2 * g.rb) + " · pas " + F(g.pitch) + " mm";
  const std::string apparent = g.betaDeg != 0 ? "Module apparent " + F(g.mt) + " · main " + mainDe(g) + " · " : std::string();
  if (g.internal) {
    o.D = g.D;
    const std::string labI = "m" + F(g.m) + " Z" + z + alphaLab + helixLab + deport + " × " + F(g.b) + " Ø" + F(g.D);
    sp.key = cle({js::texte(g.m), z, js::texte(g.aDeg), js::texte(g.b), js::texte(g.x), "0", "0", js::texte(g.betaDeg), betaMain, "int", js::texte(g.D)}) + pairKey;
    sp.norm = "ISO 53 / ISO 21771";
    sp.desig = labI;
    sp.name = "Couronne " + labI;
    sp.info = apparent + cotes + pairInfo;
    sp.checks = controlesRoue(g);
    op.gear = o;
    sp.ops = {op};
    sp.reach = g.D / 2;
    return sp;
  }
  const double d = ouZero(N(st, "d"));
  const Iso773* row = d > 0 && S(st, "kw") == "iso" ? iso773Pour(d) : nullptr;
  op.gear = o;
  sp.ops = {op};
  sp.checks = controlesRoue(g);
  std::string bore, hint;
  if (d > 0) {
    Operation B;
    B.k = "bore";
    B.d = d;
    B.b = row ? row->b : 0;
    B.t2 = row ? row->t2 : 0;
    B.w = g.b;
    for (const Controle& c : controlesAlesage(g, B)) sp.checks.push_back(c);
    sp.ops.push_back(B);
    bore = " Ø" + F(d) + (row ? " rainure " + F(row->b) + "×" + F(row->t2) : std::string());
    if (row) hint = " · clavette " + F(row->b) + "×" + F(row->h);
  }
  const std::string lab = "m" + F(g.m) + " Z" + z + alphaLab + helixLab + deport + " × " + F(g.b) + bore;
  sp.key = cle({js::texte(g.m), z, js::texte(g.aDeg), js::texte(g.b), js::texte(g.x), js::texte(d), js::texte(row ? row->b : 0), js::texte(g.betaDeg), betaMain}) + pairKey;
  sp.norm = std::string("ISO 53 / ISO 21771") + (row ? " / ISO 773" : "");
  sp.desig = lab;
  sp.name = "Engrenage " + lab;
  sp.info = apparent + cotes + hint + pairInfo;
  sp.reach = g.ra;
  return sp;
}

// ---- paire d'engrenages (gearPair) ----
double invo(double a) { return std::tan(a) - a; }
double invoInverse(double v) {
  double a = std::cbrt(3 * v);
  for (int i = 0; i < 30; i++) {
    const double t = std::tan(a), d = (t - a - v) / (t * t);
    a -= d;
    if (std::abs(d) < 1e-15) break;
  }
  return a;
}
as::Repere repereRoue(double cx, double cy, double t) {
  as::Repere F;
  F.o = {cx, cy, 0};
  F.x = {std::cos(t), std::sin(t), 0};
  F.y = {-std::sin(t), std::cos(t), 0};
  F.z = {0, 0, 1};
  return F;
}
J etatRoue(const ReglageEngrenage& O, const std::string& kind, double d) {
  J s = J::object();
  s["kind"] = kind;
  s["m"] = js::texte(O.m);
  s["z"] = js::texte(O.z);
  s["alpha"] = js::texte(O.alpha);
  s["b"] = js::texte(O.b);
  s["x"] = js::texte(O.x);
  s["beta"] = js::texte(O.beta);
  s["hand"] = O.hand;
  if (O.j != 0) s["j"] = js::texte(O.j);
  if (O.ks != 0) s["ks"] = js::texte(O.ks);
  if (d > 0) s["d"] = js::texte(d);
  return s;
}
Piece paireEngrenages(const J& st) {  // stdGearPair
  const std::string k0 = S(st, "kind"), kind = k0 == "int" || k0 == "rack" ? k0 : "ext";
  const double z1 = std::floor(N(st, "z1") + 0.5), z2 = std::floor(N(st, "z2") + 0.5), m = N(st, "m"), x1 = ouZero(N(st, "x1")), x2 = kind == "rack" ? 0 : ouZero(N(st, "x2"));
  const double jn = std::max(0.0, ouZero(N(st, "jn")));
  const std::string hand1 = S(st, "hand") == "L" ? "L" : "R", hand2 = kind == "int" ? hand1 : (hand1 == "L" ? "R" : "L");
  const double alpha = N(st, "alpha"), beta = ouZero(N(st, "beta")), b = N(st, "b");
  const double a0n = alpha * PI / 180, jsv = jn / (2 * std::cos(a0n));
  ReglageEngrenage o1, o2;
  o1.m = o2.m = m;
  o1.alpha = o2.alpha = alpha;
  o1.beta = o2.beta = beta;
  o1.b = o2.b = b;
  o1.z = z1;
  o1.x = x1;
  o1.hand = hand1;
  o1.j = jsv;
  o2.z = z2;
  o2.x = x2;
  o2.hand = hand2;
  o2.j = jsv;
  if (kind == "int") o2.kind = "int";
  if (kind == "rack") o2.kind = "rack";
  if (kind == "int" && !(z2 > z1)) throw std::runtime_error("la couronne doit avoir plus de dents que le pignon");
  GeoEngrenage g1 = geoEngrenage(o1), g2 = geoEngrenage(o2);
  const double at = g1.at, ta = std::tan(g1.a), rp1 = g1.rp, pb = g1.pitchB;
  double a, aw;
  if (kind == "rack") {
    a = rp1 + x1 * m;
    aw = at;
  } else {
    const double zs = kind == "int" ? z2 - z1 : z1 + z2, xs = kind == "int" ? -(x1 + x2) : x1 + x2, in = invo(at) + 2 * xs * ta / zs;
    if (!(in > 0)) throw std::runtime_error("déports trop négatifs : les roues ne peuvent plus se rapprocher autant");
    aw = invoInverse(in);
    a = (kind == "int" ? g2.rp - rp1 : rp1 + g2.rp) * std::cos(at) / std::cos(aw);
  }
  const double c0 = 0.25 * m;
  double k1 = 0, k2 = 0;
  if (kind == "ext") {
    k1 = std::max(0.0, (g1.ra - (a - g2.rf - c0)) / m);
    k2 = std::max(0.0, (g2.ra - (a - g1.rf - c0)) / m);
  }
  if (kind == "int") {
    const double raNeed = std::hypot(g2.rb, a * std::sin(aw) + debutFlanc(g1) * g1.rb + 1e-3 * m);
    k1 = std::max(0.0, (g1.ra - (g2.rf - c0 - a)) / m);
    k2 = std::max({0.0, (a + g1.rf + c0 - g2.ra) / m, (raNeed - g2.ra) / m});
  }
  if (k1 > 1e-9) o1.ks = k1;
  if (k2 > 1e-9) o2.ks = k2;
  g1 = geoEngrenage(o1);
  g2 = geoEngrenage(o2);
  as::Repere fr1, fr2;
  double reach;
  if (kind == "ext") {
    fr1 = repereRoue(0, 0, 0);
    fr2 = repereRoue(a, 0, PI - PI / z2);
    reach = g1.ra;
  } else if (kind == "int") {
    fr2 = repereRoue(0, 0, 0);
    fr1 = repereRoue(a, 0, 0);
    reach = g2.D / 2;
  } else {
    fr2 = repereRoue(0, 0, 0);
    fr1 = repereRoue(std::fmod(z2, 2) != 0 ? g2.pt / 2 : 0, a, -PI / 2);
    reach = g2.L / 2;
  }
  const auto rho = [](const GeoEngrenage& g) { return std::sqrt(g.ra * g.ra - g.rb * g.rb); };
  const double L = a * std::sin(aw);
  double epsA;
  if (kind == "ext") epsA = (rho(g1) + rho(g2) - L) / pb;
  else if (kind == "int") epsA = (rho(g1) - rho(g2) + L) / pb;
  else epsA = (rho(g1) - rp1 * std::sin(at) + (g2.ya - x1 * m) / std::sin(at)) / pb;
  const double epsB = g1.overlap;
  std::vector<Controle> checks;
  const std::string lab2 = kind == "int" ? "Couronne" : kind == "rack" ? "Crémaillère" : "Roue";
  const double flank1 = debutFlanc(g1) * g1.rb;
  if (epsA < 1) checks.push_back({false, "Rapport de conduite " + F2(epsA) + ", sous 1 : les dents se lâchent avant que la suivante prenne le relais."});
  else if (epsA < 1.2) checks.push_back({false, "Rapport de conduite faible : " + F2(epsA) + " (repère usuel : au moins 1,2)."});
  else checks.push_back({true, "Rapport de conduite : " + F2(epsA) + (g1.betaDeg != 0 ? " (total avec le recouvrement : " + F2(epsA + epsB) + ")" : std::string()) + "."});
  const auto bad = [&](const std::string& who) { checks.push_back({false, "Interférence : " + who + ". Il faut un déport, plus de dents ou un plus grand angle de pression."}); };
  const double tolI = 1e-3 * m;
  bool ok = true;
  if (kind == "ext") {
    const double flank2 = debutFlanc(g2) * g2.rb;
    if (L - rho(g2) < flank1 - tolI) {
      bad("la tête de la roue attaque le pied du pignon");
      ok = false;
    }
    if (L - rho(g1) < flank2 - tolI) {
      bad("la tête du pignon attaque le pied de la roue");
      ok = false;
    }
  } else if (kind == "int") {
    const double lim2 = finFlanc(g2) * g2.rb;
    if (rho(g2) - L < flank1 - tolI) {
      bad("la tête de la couronne attaque le pied du pignon");
      ok = false;
    }
    if (rho(g1) + L > lim2 + tolI) {
      bad("la tête du pignon dépasse le flanc de la couronne");
      ok = false;
    }
    if (z2 - z1 < 10) {
      checks.push_back({false, "Couronne et pignon trop proches : " + js::texte(z2 - z1) + " dents d’écart (repère usuel : au moins 10), les têtes risquent de se toucher hors de la ligne d’action."});
      ok = false;
    }
  } else {
    if (rp1 * std::sin(at) - (g2.ya - x1 * m) / std::sin(at) < flank1 - tolI) {
      bad("la tête de la crémaillère attaque le pied du pignon");
      ok = false;
    }
  }
  if (ok) checks.push_back({true, "Pas d’interférence sur la ligne d’action."});
  std::string minus2 = lab2;
  if (kind == "int") minus2 = "couronne";
  else if (kind == "rack") minus2 = "crémaillère";
  else minus2 = "roue";
  if (g1.ks != 0 || g2.ks != 0) checks.push_back({true, "Têtes raccourcies pour garder le jeu au fond de dent" + (g1.ks != 0 ? " (pignon : " + F2(g1.ks * m) + " mm)" : std::string()) + (g2.ks != 0 ? " (" + minus2 + " : " + F2(g2.ks * m) + " mm)" : std::string()) + "."});
  if (jn == 0) checks.push_back({false, "Jeu nul : les flancs se touchent des deux côtés. Prévoyez un jeu pour une pièce réelle."});
  for (const auto& c : controlesEngrenage(g1))
    if (!c.first) checks.push_back({false, "Pignon : " + c.second});
  for (const auto& c : controlesEngrenage(g2))
    if (!c.first) checks.push_back({false, lab2 + " : " + c.second});
  checks.push_back({true, "Contrôle géométrique seulement : la résistance des dents n’est pas calculée."});
  // stdGearPair
  Piece sp1 = specification("gear", etatRoue(o1, "ext", ouZero(N(st, "d1"))));
  Piece sp2 = specification("gear", etatRoue(o2, kind, kind == "ext" ? ouZero(N(st, "d2")) : 0));
  for (const Piece* q : {&sp1, &sp2})
    for (const Controle& c : q->checks)
      if (!c.ok && (c.txt.find("Paroi") != std::string::npos || c.txt.find("Roue plus étroite") != std::string::npos)) checks.push_back(c);
  const std::string lab = "m" + F(g1.m) + " Z" + js::texte(g1.z) + "/" + js::texte(g2.z) + (g1.aDeg == 20 ? std::string() : " α" + F(g1.aDeg) + "°") + (g1.betaDeg != 0 ? " β" + F(g1.betaDeg) + "°" : std::string()) + " × " + F(g1.b);
  const std::string prefixe = kind == "ext" ? "Paire " : kind == "int" ? "Pignon et couronne " : "Pignon et crémaillère ";
  const std::string dist = kind == "rack" ? "Hauteur de l’axe du pignon " + F(a) + " mm au-dessus de la ligne de référence" : "Entraxe " + F(js::arrondi(a, 3)) + " mm";
  Piece sp;
  sp.aControles = true;
  sp.key = "GEARPAIR|" + sp1.key + "|" + sp2.key;
  sp.norm = "ISO 53 / ISO 21771";
  sp.desig = lab;
  sp.name = prefixe + lab;
  sp.info = dist + (kind != "rack" ? " · rapport " + F(js::arrondi(z2 / z1, 3)) : std::string()) + " · angle de fonctionnement " + F(js::arrondi(aw * 180 / PI, 2)) + "°" +
            (g1.betaDeg != 0 ? " · pignon main " + std::string(hand1 == "L" ? "gauche" : "droite") + ", " + minus2 + " main " + (hand2 == "L" ? "gauche" : "droite") : std::string());
  sp.checks = checks;
  sp.reach = reach;
  sp.paire.push_back({sp1, fr1, o1});
  sp.paire.push_back({sp2, fr2, o2});
  return sp;
}

// ---- aimants ----
const Aimant* ligneAimant(const std::string& code) {
  for (const Aimant& r : MAG_CAT)
    if (code == r.code) return &r;
  return nullptr;
}
std::vector<const Aimant*> lignesAimant(const J& st) {  // magRows
  std::vector<const Aimant*> o;
  const std::string shape = S(st, "shape"), grade = S(st, "grade");
  for (const Aimant& r : MAG_CAT)
    if (shape == r.s && (grade.empty() || grade == "*" || grade == r.grade)) o.push_back(&r);
  return o;
}
std::string dimsAimant(const Aimant& r) {  // magDims
  const std::string s = r.s;
  return s == "cyl" ? "Ø" + F(r.d) + " × " + F(r.h) : s == "ring" ? "Ø" + F(r.d) + "/" + F(r.di) + " × " + F(r.h) : F(r.a) + " × " + F(r.b) + " × " + F(r.h);
}
double celBulirsch(double kc, double p0, double c0, double s0) {  // magCel
  double k = std::abs(kc), e = k, m = 1, p = std::sqrt(p0), c = c0, s = s0 / p, f = c, g;
  c = c + s / p;
  g = e / p;
  s = 2 * (s + f * g);
  p = g + p;
  g = m;
  m = k + m;
  for (int i = 0; i < 64 && std::abs(g - k) > g * 1e-10; i++) {
    k = 2 * std::sqrt(e);
    e = k * m;
    f = c;
    c = c + s / p;
    g = e / p;
    s = 2 * (s + f * g);
    p = g + p;
    g = m;
    m = k + m;
  }
  return (PI / 2) * (s + c * m) / (m * (m + p));
}
std::array<double, 2> champCylindre(double rho, double z, double a, double b, double Br) {  // magCyl
  double r = std::max(rho, 1e-9 * a);
  if (std::abs(r - a) < 1e-9 * a) r = a * (1 + 1e-9);
  const double zp = z + b, zm = z - b, hp = std::hypot(zp, r + a), hm = std::hypot(zm, r + a), g = (a - r) / (a + r);
  const double kp = std::max(1e-12, std::hypot(zp, a - r) / hp), km = std::max(1e-12, std::hypot(zm, a - r) / hm);
  const double K = Br / PI;
  return {K * (a / hp * celBulirsch(kp, 1, 1, -1) - a / hm * celBulirsch(km, 1, 1, -1)),
          K * (a / (a + r)) * (zp / hp * celBulirsch(kp, g * g, 1, g) - zm / hm * celBulirsch(km, g * g, 1, g))};
}
std::array<double, 3> champPave(double x, double y, double z, double a, double b, double c, double Br) {  // magBox
  double bx = 0, by = 0, bz = 0;
  const double SW[2][2] = {{1, c}, {-1, -c}};
  for (const auto& sw : SW)
    for (double su : {1.0, -1.0})
      for (double sv : {1.0, -1.0}) {
        const double u = x + su * a, v = y + sv * b, w = z - sw[1];
        double R = std::sqrt(u * u + v * v + w * w);
        if (R == 0) R = 1e-12;
        const double s = sw[0] * su * sv;
        bz += s * std::atan2(u * v, w * R);
        bx -= s * std::log(std::max(v + R, 1e-12));
        by -= s * std::log(std::max(u + R, 1e-12));
      }
  const double K = Br / (4 * PI);
  return {K * bx, K * by, K * bz};
}
struct GeoAimant {
  std::string s;
  double Br = 0, h = 0, d = 0, di = 0, a = 0, b = 0;
};
GeoAimant geoAimant(const J& m) {
  GeoAimant g;
  g.s = S(m, "s");
  g.Br = N(m, "Br");
  g.h = N(m, "h");
  g.d = ouZero(N(m, "d"));
  g.di = ouZero(N(m, "di"));
  g.a = ouZero(N(m, "a"));
  g.b = ouZero(N(m, "b"));
  return g;
}
std::array<double, 3> champ(const GeoAimant& m, double x, double y, double z) {  // magField
  const double zc = z - m.h / 2;
  if (m.s == "box") return champPave(x, y, zc, m.a / 2, m.b / 2, m.h / 2, m.Br);
  const double r = std::hypot(x, y), q = std::max(r, 1e-12);
  auto B = champCylindre(r, zc, m.d / 2, m.h / 2, m.Br);
  if (m.s == "ring") {
    const auto I = champCylindre(r, zc, m.di / 2, m.h / 2, m.Br);
    B[0] -= I[0];
    B[1] -= I[1];
  }
  return {B[0] * x / q, B[0] * y / q, B[1]};
}
bool dansAimant(const GeoAimant& m, double x, double y, double z) {  // magInside
  if (z < 0 || z > m.h) return false;
  if (m.s == "box") return std::abs(x) <= m.a / 2 && std::abs(y) <= m.b / 2;
  const double r = std::hypot(x, y);
  return r <= m.d / 2 && (m.s != "ring" || r >= m.di / 2);
}
double tailleAimant(const GeoAimant& m) { return m.s == "box" ? std::max({m.a, m.b, m.h}) : std::max(m.d, m.h); }
double champPole(const GeoAimant& m) {  // magPoleField
  return champ(m, m.s == "ring" ? (m.d + m.di) / 4 : 0, 0, m.h + 1e-6 * tailleAimant(m))[2];
}
J jsonGeoAimant(const Aimant& r) {  // magGeom
  J m = J::object();
  const std::string s = r.s;
  m["s"] = s == "cube" ? "box" : s;
  m["Br"] = (r.br0 + r.br1) / 2;
  m["h"] = r.h;
  if (s == "cube" || s == "box") {
    m["a"] = r.a;
    m["b"] = r.b;
  } else {
    m["d"] = r.d;
    if (s == "ring") m["di"] = r.di;
  }
  return m;
}
Piece aimant(const J& st) {  // magSpec
  const Aimant* r = ligneAimant(S(st, "art"));
  if (!r) throw std::runtime_error("Article introuvable dans le catalogue.");
  J g = jsonGeoAimant(*r);
  const GeoAimant G = geoAimant(g);
  const bool ferrite = std::string(r->mat) == "Ferrite";
  Piece sp;
  sp.key = std::string("MAG:") + r->code;
  sp.name = std::string("Aimant ") + r->code;
  sp.norm = r->src;
  sp.desig = r->code;
  sp.reach = 0;
  const auto Fn = [](double v, int n) { return F(js::arrondi(v, n)); };
  sp.info = std::string(r->mat) + " " + r->grade + " · Br " + Fn(r->br0, 3) + " à " + Fn(r->br1, 3) + " T · " + r->dirTxt + " · force " + r->force + " · " + js::texte(r->tmax) + " °C maxi · champ calculé " +
            (G.s == "ring" ? "sur la face nord, à mi-largeur : " : "au centre de la face nord : ") + js::texte(std::floor(std::abs(champPole(G)) * 1000 + 0.5)) + " mT";
  J mag = g;
  mag["code"] = r->code;
  mag["src"] = r->src;
  mag["grade"] = r->grade;
  mag["mat"] = r->mat;
  mag["br"] = {r->br0, r->br1};
  mag["hcb"] = {r->hcb0, r->hcb1};
  mag["hcj"] = r->hcj;
  mag["bh"] = {r->bh0, r->bh1};
  mag["tmax"] = r->tmax;
  mag["force"] = r->force;
  mag["dirTxt"] = r->dirTxt;
  sp.mag = mag;
  sp.mat = J::object();
  sp.mat["name"] = ferrite ? "Ferrite" : "NdFeB (néodyme)";
  sp.mat["rho"] = ferrite ? 4.9 : 7.5;
  sp.couleur = ferrite ? 0x3c3d40u : 0xc3c6cau;
  if (G.s == "box") {
    Operation o;
    o.k = "mbox";
    o.a = G.a;
    o.b = G.b;
    o.h = G.h;
    sp.ops = {o};
  } else {
    const double r0 = G.s == "ring" ? G.di / 2 : 0, r1 = G.d / 2;
    sp.prof = {P(r0, 0), P(r1, 0), P(r1, G.h), P(r0, G.h)};
  }
  return sp;
}

// ---- champs de la fenêtre ----
std::vector<Option> liste(std::initializer_list<std::pair<const char*, const char*>> L) {
  std::vector<Option> o;
  for (const auto& x : L) o.push_back({x.first, x.second});
  return o;
}
const VisIso* ligneVis(const J& st) {
  const std::string si = S(st, "size");
  if (S(st, "type") == "fhc") {
    for (const VisIso& x : STD_ISO10642)
      if (si == x.t) return &x;
  } else {
    for (const VisIso& x : STD_ISO4762)
      if (si == x.t) return &x;
  }
  return nullptr;
}
Champ champListe(const std::string& k, const std::string& lib, std::function<std::vector<Option>(const J&)> o, std::function<std::string(const J&)> d = nullptr, std::function<bool(const J&)> v = nullptr) {
  Champ c;
  c.k = k;
  c.lib = lib;
  c.options = std::move(o);
  c.defaut = std::move(d);
  c.visible = std::move(v);
  return c;
}
Champ champNombre(const std::string& k, const std::string& lib, double mi, double ma, double pas, bool entier, std::function<std::vector<Option>(const J&)> o, const std::string& d, std::function<bool(const J&)> v = nullptr) {
  Champ c = champListe(k, lib, std::move(o), [d](const J&) { return d; }, std::move(v));
  c.num = true;
  c.mini = mi;
  c.maxi = ma;
  c.pas = pas;
  c.entier = entier;
  return c;
}
std::vector<Option> memes(std::initializer_list<const char*> L) {
  std::vector<Option> o;
  for (const char* x : L) o.push_back({x, x});
  return o;
}
std::vector<Option> optionsAlesage(const J& st) {  // stdGearBoreOpts
  double rf = 0;
  try {
    ReglageEngrenage o;
    o.m = N(st, "m");
    o.z = N(st, "z");
    o.alpha = N(st, "alpha");
    const double b = N(st, "b");
    o.b = std::isnan(b) || b == 0 ? 1 : b;
    o.x = ouZero(N(st, "x"));
    o.beta = ouZero(N(st, "beta"));
    rf = geoEngrenage(o).rf;
  } catch (const std::exception&) {
    rf = 0;
  }
  const double v = js::arrondi(0.8 * rf, 1);
  std::vector<Option> o = {{"0", "0"}};
  if (v > 0) o.push_back({js::texte(v), F(v)});
  return o;
}
std::vector<Categorie> faireCategories() {
  std::vector<Categorie> C;
  const auto filet = [] { return liste({{"cos", "Cosmétique (spirale dessinée)"}, {"mod", "Modélisé (profil ISO, impression 3D)"}}); };
  C.push_back({"iso", "Vis ISO", {
    champListe("type", "Type", [](const J&) { return liste({{"chc", "CHC — ISO 4762 (tête cylindrique)"}, {"fhc", "FHC — ISO 10642 (tête fraisée 90°)"}}); }),
    champListe("size", "Taille", [](const J& st) {
      std::vector<Option> o;
      if (S(st, "type") == "fhc") for (const VisIso& r : STD_ISO10642) o.push_back({r.t, r.t});
      else for (const VisIso& r : STD_ISO4762) o.push_back({r.t, r.t});
      return o;
    }, [](const J&) { return std::string("M6"); }),
    champListe("pitch", "Pas", [](const J& st) {
      const std::vector<double>* p = pasDe(S(st, "size"));
      const std::vector<double> un = {1};
      std::vector<Option> o;
      const std::vector<double>& L = p ? *p : un;
      for (size_t i = 0; i < L.size(); i++) o.push_back({js::texte(L[i]), F(L[i]) + (i ? " — fin" : " — gros (M)")});
      return o;
    }),
    champListe("len", "Longueur (mm)", [](const J& st) {
      std::vector<Option> o;
      if (const VisIso* r = ligneVis(st))
        for (double v : longueurs(STD_ISO_LV, r->lmin, r->lmax)) o.push_back({js::texte(v), F(v)});
      return o;
    }, [](const J& st) {
      const VisIso* r = ligneVis(st);
      if (!r) return std::string();
      const auto l = longueurs(STD_ISO_LV, std::max(r->lmin, 3 * r->d), r->lmax);
      return js::texte(!l.empty() ? l[0] : r->lmin);
    }),
    champListe("fil", "Filet", [filet](const J&) { return filet(); })}});
  C.push_back({"ansi", "Vis ANSI", {
    champListe("type", "Type", [](const J&) { return liste({{"chc", "SHCS — tête cylindrique (B18.3)"}, {"fhc", "FHCS — tête fraisée 82° (B18.3)"}}); }),
    champListe("size", "Taille", [](const J& st) {
      std::vector<Option> o;
      if (S(st, "type") == "fhc") for (const VisAnsiF& r : STD_ANSI_FHCS) o.push_back({r.t, r.t});
      else for (const VisAnsi& r : STD_ANSI_SHCS) o.push_back({r.t, r.t});
      return o;
    }, [](const J&) { return std::string("1/4"); }),
    champListe("thr", "Filetage", [](const J& st) {
      const VisAnsi* r = ligneShcs(S(st, "size"));
      if (!r) r = &STD_ANSI_SHCS[0];
      std::vector<Option> o;
      if (r->unc != 0) o.push_back({"UNC", "UNC — " + js::texte(r->unc) + " filets/pouce"});
      o.push_back({"UNF", "UNF — " + js::texte(r->unf) + " filets/pouce"});
      return o;
    }),
    champListe("len", "Longueur (po)", [](const J& st) {
      std::vector<Option> o;
      const std::string si = S(st, "size");
      std::string a, b;
      if (S(st, "type") == "fhc") {
        const VisAnsiF* r = ligneFhcs(si);
        if (!r) return o;
        a = r->lmin;
        b = r->lmax;
      } else {
        const VisAnsi* r = ligneShcs(si);
        if (!r) return o;
        a = r->lmin;
        b = r->lmax;
      }
      for (const std::string& v : longueursPouce(a, b)) o.push_back({v, v + "\""});
      return o;
    }, [](const J& st) {
      const std::string si = S(st, "size");
      std::string a, b;
      double D;
      if (S(st, "type") == "fhc") {
        const VisAnsiF* r = ligneFhcs(si);
        if (!r) return std::string();
        a = r->lmin;
        b = r->lmax;
        D = r->D;
      } else {
        const VisAnsi* r = ligneShcs(si);
        if (!r) return std::string();
        a = r->lmin;
        b = r->lmax;
        D = r->D;
      }
      const auto l = longueursPouce(a, b);
      for (const std::string& v : l)
        if (fraction(v) >= 3 * D) return v;
      return l.empty() ? std::string() : l[0];
    }),
    champListe("fil", "Filet", [filet](const J&) { return filet(); })}});
  C.push_back({"plug", "Bouchons gaz", {
    champListe("type", "Type", [](const J&) { return liste({{"din906", "DIN 906 — conique R (sans collerette)"}, {"din908", "DIN 908 — cylindrique G, à collerette"}, {"nptf", "NPTF — conique (ANSI)"}}); }),
    champListe("size", "Taille", [](const J& st) {
      std::vector<Option> o;
      const std::string t = S(st, "type");
      if (t == "din908") for (const Din908& r : STD_DIN908) o.push_back({r.t, std::string(r.t) + " — " + js::texte(r.tpi) + " filets/pouce"});
      else if (t == "nptf") for (const Nptf& r : STD_NPTF) o.push_back({r.t, std::string(r.t) + "\" — " + js::texte(r.tpi) + " filets/pouce"});
      else for (const Din906& r : STD_DIN906) o.push_back({r.t, std::string(r.t) + " — " + js::texte(r.tpi) + " filets/pouce"});
      return o;
    })}});
  const auto ligneG = [](const J& st) -> const LigneGoupille* {
    for (const LigneGoupille& x : lignesGoupille(S(st, "type")))
      if (x.txt == S(st, "size")) return &x;
    return nullptr;
  };
  const auto estPouce = [](const J& st) { const std::string t = S(st, "type"); return t == "dowel" || t == "spring"; };
  C.push_back({"pin", "Goupilles", {
    champListe("type", "Norme", [](const J&) { return liste({{"iso2338", "ISO 2338 — cylindrique m6"}, {"iso8734", "ISO 8734 — cylindrique trempée"}, {"iso2339", "ISO 2339 — conique 1:50"}, {"iso8752", "ISO 8752 — élastique fendue"}, {"dowel", "ANSI B18.8.2 — dowel pin trempée"}, {"spring", "ANSI B18.8.2 — spring pin fendue"}}); }),
    champListe("size", "Diamètre", [estPouce](const J& st) {
      std::vector<Option> o;
      for (const LigneGoupille& r : lignesGoupille(S(st, "type"))) o.push_back({r.txt, estPouce(st) ? r.txt + "\"" : F(r.d) + " mm"});
      return o;
    }, [estPouce](const J& st) {
      const auto& t = lignesGoupille(S(st, "type"));
      for (const LigneGoupille& r : t)
        if ((estPouce(st) ? r.d * STD_IN : r.d) >= 5.5) return r.txt;
      return t[0].txt;
    }),
    champListe("len", "Longueur", [ligneG, estPouce](const J& st) {
      std::vector<Option> o;
      const LigneGoupille* r = ligneG(st);
      if (!r) return o;
      if (estPouce(st)) for (const std::string& v : longueursPouce(r->lminT, r->lmaxT)) o.push_back({v, v + "\""});
      else for (double v : longueurs(STD_PIN_LV, r->lmin, r->lmax)) o.push_back({js::texte(v), F(v) + " mm"});
      return o;
    }, [ligneG, estPouce](const J& st) {
      const LigneGoupille* r = ligneG(st);
      if (!r) return std::string();
      std::vector<std::string> l;
      if (estPouce(st)) l = longueursPouce(r->lminT, r->lmaxT);
      else for (double v : longueurs(STD_PIN_LV, r->lmin, r->lmax)) l.push_back(js::texte(v));
      for (const std::string& v : l)
        if (fraction(v) >= 4 * r->d) return v;
      return l.empty() ? std::string() : l.back();
    })}});
  const auto ligneK = [](const J& st) -> const Iso773* {
    for (const Iso773& x : STD_ISO773)
      if (tailleCle(x) == S(st, "size")) return &x;
    return nullptr;
  };
  C.push_back({"key", "Clavettes", {
    champListe("type", "Forme", [](const J&) { return liste({{"A", "A — bouts ronds"}, {"B", "B — bouts droits"}, {"C", "C — un bout rond"}}); }),
    champListe("size", "b × h (arbre)", [](const J&) {
      std::vector<Option> o;
      for (const Iso773& r : STD_ISO773) o.push_back({tailleCle(r), js::texte(r.b) + " × " + js::texte(r.h) + "  (arbre Ø " + js::texte(r.de) + " à " + js::texte(r.a) + ")"});
      return o;
    }, [](const J&) { return std::string("8x7"); }),
    champListe("len", "Longueur (mm)", [ligneK](const J& st) {
      std::vector<Option> o;
      if (const Iso773* r = ligneK(st))
        for (double v : longueurs(STD_KEY_LV, r->lmin, r->lmax)) o.push_back({js::texte(v), F(v)});
      return o;
    }, [ligneK](const J& st) {
      const Iso773* r = ligneK(st);
      if (!r) return std::string();
      const auto l = longueurs(STD_KEY_LV, std::max(r->lmin, 4 * r->b), r->lmax);
      return js::texte(!l.empty() ? l[0] : r->lmin);
    })}});
  const auto angles = [](const J&) { return liste({{"20", "20° (usuel)"}, {"14.5", "14,5°"}, {"25", "25°"}}); };
  const auto sens = [](const char*) {
    return [](const J& st) { return N(st, "beta") > 0 ? liste({{"R", "Main droite"}, {"L", "Main gauche"}}) : liste({{"R", "— (pas d’hélice)"}}); };
  };
  Champ module = champNombre("m", "Module (mm)", 0.1, 50, 0.05, false, [](const J&) { return liste({{"0.5", "0,5"}, {"2", "2"}, {"10", "10"}}); }, "2");
  module.propositions = GEAR_MODULES;
  C.push_back({"gear", "Engrenages", {
    champListe("kind", "Denture", [](const J&) { return liste({{"ext", "Extérieure (roue)"}, {"int", "Intérieure (couronne)"}, {"rack", "Crémaillère"}}); }),
    module,
    champNombre("z", "Nombre de dents", 6, 500, 1, true, [](const J& st) {
      const std::string k = S(st, "kind");
      return k == "int" ? memes({"24", "60", "200"}) : k == "rack" ? memes({"6", "30"}) : memes({"6", "20", "60", "200"});
    }, "20"),
    champListe("alpha", "Angle de pression", angles),
    champNombre("beta", "Angle d’hélice β (0 = denture droite)", 0, 45, 1, false, [](const J&) { return memes({"0", "15"}); }, "0"),
    champListe("hand", "Sens de l’hélice", sens("")),
    champNombre("x", "Déport x (en modules, 0 = aucun)", -1, 2, 0.05, false, [](const J&) { return liste({{"-0.3", "−0,3"}, {"0", "0"}, {"0.2", "0,2"}}); }, "0", [](const J& st) { return S(st, "kind") != "rack"; }),
    champNombre("b", "Largeur (mm)", 0.1, 2000, 0.5, false, [](const J&) { return memes({"5", "20", "100"}); }, "20"),
    champNombre("H", "Hauteur du corps sous les dents (mm, 0 = automatique)", 0, 2000, 0.5, false, [](const J&) { return memes({"0"}); }, "0", [](const J& st) { return S(st, "kind") == "rack"; }),
    champNombre("D", "Ø extérieur de la couronne (mm, 0 = automatique)", 0, 10000, 0.5, false, [](const J&) { return memes({"0"}); }, "0", [](const J& st) { return S(st, "kind") == "int"; }),
    champNombre("d", "Alésage Ø (mm, 0 = roue pleine)", 0, 5000, 0.5, false, optionsAlesage, "0", [](const J& st) { return S(st, "kind") == "ext"; }),
    champListe("kw", "Rainure de clavette", [](const J& st) {
      const double d = ouZero(N(st, "d"));
      const Iso773* r = iso773Pour(d);
      std::vector<Option> o;
      if (r) o.push_back({"iso", "ISO 773 : largeur " + F(r->b) + ", profondeur " + F(r->t2) + " (clavette " + F(r->b) + "×" + F(r->h) + ")"});
      o.push_back({"none", d > 0 ? "Sans rainure" : "— (pas d’alésage)"});
      return o;
    }, nullptr, [](const J& st) { return S(st, "kind") == "ext"; })}});
  Champ module2 = champNombre("m", "Module (mm)", 0.1, 50, 0.05, false, [](const J&) { return memes({"2"}); }, "2");
  module2.propositions = GEAR_MODULES;
  C.push_back({"gearPair", "Paire d’engrenages", {
    champListe("kind", "Le pignon engrène avec", [](const J&) { return liste({{"ext", "Une roue extérieure"}, {"int", "Une couronne intérieure"}, {"rack", "Une crémaillère"}}); }),
    module2,
    champNombre("z1", "Dents du pignon", 6, 500, 1, true, [](const J&) { return memes({"20"}); }, "20"),
    champNombre("z2", "Dents de l’autre pièce", 6, 500, 1, true, [](const J& st) { const std::string k = S(st, "kind"); return k == "int" ? memes({"60"}) : k == "rack" ? memes({"30"}) : memes({"40"}); }, "40"),
    champListe("alpha", "Angle de pression", angles),
    champNombre("beta", "Angle d’hélice β (0 = denture droite)", 0, 45, 1, false, [](const J&) { return memes({"0", "15"}); }, "0"),
    champListe("hand", "Sens d’hélice du pignon (l’autre pièce s’en déduit)", sens("")),
    champNombre("x1", "Déport du pignon (en modules)", -1, 2, 0.05, false, [](const J&) { return liste({{"0", "0"}, {"0.3", "0,3"}}); }, "0"),
    champNombre("x2", "Déport de l’autre pièce (en modules)", -1, 2, 0.05, false, [](const J&) { return memes({"0"}); }, "0", [](const J& st) { return S(st, "kind") != "rack"; }),
    champNombre("b", "Largeur (mm)", 0.1, 2000, 0.5, false, [](const J&) { return memes({"20"}); }, "20"),
    champNombre("jn", "Jeu entre flancs (mm, 0 = aucun)", 0, 50, 0.01, false, [](const J&) { return liste({{"0", "0"}, {"0.1", "0,1"}}); }, "0.1"),
    champNombre("d1", "Alésage du pignon Ø (mm, 0 = plein)", 0, 5000, 0.5, false, [](const J&) { return memes({"0"}); }, "0"),
    champNombre("d2", "Alésage de la roue Ø (mm, 0 = pleine)", 0, 5000, 0.5, false, [](const J&) { return memes({"0"}); }, "0", [](const J& st) { return S(st, "kind") == "ext"; })}});
  C.push_back({"magnet", "Aimants", {
    champListe("shape", "Forme", [](const J&) { return liste({{"cyl", "Disque / cylindre"}, {"cube", "Cube"}, {"box", "Pavé"}, {"ring", "Anneau"}}); }),
    champListe("grade", "Nuance", [](const J& st) {
      std::set<std::string> g;
      for (const Aimant& r : MAG_CAT)
        if (S(st, "shape") == r.s) g.insert(r.grade);
      std::vector<Option> o = {{"*", "Toutes"}};
      for (const std::string& x : g) o.push_back({x, x});
      return o;
    }, [](const J&) { return std::string("*"); }),
    champListe("art", "Article", [](const J& st) {
      std::vector<Option> o;
      for (const Aimant* r : lignesAimant(st)) o.push_back({r->code, dimsAimant(*r) + " mm · " + r->grade + " — " + r->code});
      return o;
    }, [](const J& st) {
      const auto R = lignesAimant(st);
      for (const Aimant* r : R)
        if ((std::isnan(r->d) || r->d == 0 ? r->a : r->d) >= 10) return std::string(r->code);
      return R.empty() ? std::string() : std::string(R[0]->code);
    })}});
  return C;
}
Piece generer(const std::string& k, const J& st) {
  if (k == "iso") return visIso(st);
  if (k == "ansi") return visAnsi(st);
  if (k == "plug") return bouchon(st);
  if (k == "pin") return goupille(st);
  if (k == "key") return clavette(st);
  if (k == "gear") return engrenage(st);
  if (k == "gearPair") return paireEngrenages(st);
  return aimant(st);
}
}  // namespace

const std::vector<Categorie>& categories() {
  static const std::vector<Categorie> C = faireCategories();
  return C;
}
const Categorie& categorie(const std::string& k) {
  for (const Categorie& c : categories())
    if (c.k == k) return c;
  return categories()[0];
}
J etatNormalise(const std::string& cat, const J& st) {
  const Categorie& C = categorie(cat);
  J o = st.is_object() ? st : J::object();
  for (const Champ& f : C.champs) {
    if (f.visible && !f.visible(o)) o.erase(f.k);
    if (f.num) {
      std::string t = o.contains(f.k) ? (o[f.k].is_string() ? o[f.k].get<std::string>() : o[f.k].is_number() ? js::texte(o[f.k].get<double>()) : std::string("x")) : std::string("x");
      std::replace(t.begin(), t.end(), ',', '.');
      char* fin = nullptr;
      double v = std::strtod(t.c_str(), &fin);  // parseFloat : le début du texte
      if (fin == t.c_str() || !std::isfinite(v)) v = js::nombre(f.defaut(o));
      if (f.entier) v = std::floor(v + 0.5);
      o[f.k] = js::texte(std::min(f.maxi, std::max(f.mini, v)));
      continue;
    }
    const std::vector<Option> op = f.options(o);
    const auto cherche = [&](const std::string& v) { return std::any_of(op.begin(), op.end(), [&](const Option& x) { return x.v == v; }); };
    const auto it = o.find(f.k);
    if (it == o.end() || !it->is_string() || !cherche(it->get<std::string>())) {
      const std::string d = f.defaut ? f.defaut(o) : std::string();
      o[f.k] = f.defaut && cherche(d) ? d : (!op.empty() ? op[0].v : std::string());
    }
  }
  return o;
}
Piece specification(const std::string& cat, const J& st) {
  const Categorie& C = categorie(cat);
  const J s = etatNormalise(C.k, st);
  Piece sp = generer(C.k, s);
  sp.cat = C.k;
  sp.st = s;
  return sp;
}
std::optional<std::pair<std::string, J>> etatDe(const J& d) {
  if (!d.is_object() || !d.contains("key") || !d["key"].is_string()) return std::nullopt;
  const std::string cat = d.value("cat", std::string());
  if (d.contains("st") && d["st"].is_object())
    for (const Categorie& c : categories())
      if (c.k == cat) return std::make_pair(cat, etatNormalise(cat, d["st"]));
  const std::string key = d["key"].get<std::string>();
  for (const Categorie& C : categories()) {
    std::optional<std::pair<std::string, J>> hit;
    std::function<void(size_t, const J&)> walk = [&](size_t i, const J& st) {
      if (hit) return;
      if (i == C.champs.size()) {
        try {
          if (generer(C.k, st).key == key) hit = std::make_pair(C.k, st);
        } catch (const std::exception&) {
        }
        return;
      }
      const Champ& f = C.champs[i];
      for (const Option& o : f.options(st)) {
        if (hit) return;
        J s2 = st;
        s2[f.k] = o.v;
        walk(i + 1, s2);
      }
    };
    walk(0, J::object());
    if (hit) return hit;
  }
  return std::nullopt;
}
bool estClavette(const Piece& sp) {
  return std::any_of(sp.ops.begin(), sp.ops.end(), [](const Operation& o) { return o.k == "key"; });
}

// ---- le document ----
namespace {
J esquisseVide(J& d, const char* name, const char* plane, double off) {  // stdSketch
  J s = J::object();
  s["id"] = as::nouvelIdentifiant("sk");
  s["name"] = name;
  s["plane"] = plane;
  s["entities"] = J::array();
  s["points"] = J::object();
  s["constraints"] = J::array();
  s["dims"] = J::array();
  s["seq"] = 1;
  s["visible"] = false;
  const bool xz = std::string(plane) == "XZ";
  const std::array<double, 3> n = xz ? std::array<double, 3>{0, -1, 0} : std::array<double, 3>{0, 0, 1};
  s["origin"] = {n[0] * off, n[1] * off, n[2] * off};
  s["axU"] = {1, 0, 0};
  s["axV"] = xz ? J{0, 0, 1} : J{0, 1, 0};
  s["axN"] = {n[0], n[1], n[2]};
  (void)d;
  return s;
}
std::string pointNeuf(J& s, double x, double y) {  // addPoint
  const int q = s["seq"].get<int>();
  s["seq"] = q + 1;
  const std::string id = "p" + std::to_string(q);
  J p = J::object();
  p["x"] = x;
  p["y"] = y;
  s["points"][id] = p;
  return id;
}
std::string entiteNeuve(J& s) {  // skNewEid
  const int q = s["seq"].get<int>();
  s["seq"] = q + 1;
  return "e" + std::to_string(q);
}
void boucle(J& s, const std::vector<Sommet>& pts) {  // stdLoop
  std::vector<std::string> ids;
  for (const Sommet& p : pts) ids.push_back(pointNeuf(s, p.x, p.y));
  const size_t n = pts.size();
  for (size_t j = 0; j < n; j++) {
    const size_t i = (j + n - 1) % n;
    const Sommet& p = pts[i];
    const Sommet& q = pts[j];
    const std::string& a = ids[i];
    const std::string& b = ids[j];
    J e = J::object();
    if (q.arc) {
      const std::string pc = pointNeuf(s, q.cx, q.cy);
      const double r = std::hypot(q.x - q.cx, q.y - q.cy);
      const bool ccw = q.sens >= 0 ? q.sens == 1 : ((p.x - q.cx) * (q.y - q.cy) - (p.y - q.cy) * (q.x - q.cx)) > 0;
      e["id"] = entiteNeuve(s);
      e["t"] = "arc";
      e["pc"] = pc;
      e["pa"] = ccw ? a : b;
      e["pb"] = ccw ? b : a;
      e["r"] = r;
    } else {
      e["id"] = entiteNeuve(s);
      e["t"] = "line";
      e["p1"] = a;
      e["p2"] = b;
    }
    s["entities"].push_back(std::move(e));
  }
}
std::vector<Sommet> hexagone(double s) {  // stdHex
  const double R = s / std::sqrt(3.0);
  std::vector<Sommet> o;
  for (int i = 0; i < 6; i++) {
    const double a = i * PI / 3;
    o.push_back(P(R * std::cos(a), R * std::sin(a)));
  }
  return o;
}
std::string nomFiletageTige(const Filetage& t) {  // threadName
  const auto* T = filetageDe(t.size);
  std::string pas = js::texte(t.p);
  std::replace(pas.begin(), pas.end(), '.', ',');
  std::string lon = js::texte(js::arrondi(t.len, 2));
  std::replace(lon.begin(), lon.end(), '.', ',');
  return "Filetage " + t.size + (T && t.p != (*T)[2].get<double>() ? "×" + pas : std::string()) + (t.lenMode == "len" ? " × " + lon : std::string(" (toute la face)"));
}
}  // namespace

J documentDe(const Piece& sp) {
  J d = as::documentVide(sp.name);
  J corps = J::object();
  corps["id"] = "b1";
  corps["name"] = sp.name;
  corps["c"] = nullptr;
  if (sp.couleur) corps["color"] = *sp.couleur;
  d["bodies"] = J::array({corps});
  d["bodySeq"] = 2;
  d["activeBody"] = "b1";
  J st = J::object();
  st["key"] = sp.key;
  st["norm"] = sp.norm;
  st["desig"] = sp.desig;
  if (!sp.cat.empty() && !sp.st.is_null()) {
    st["cat"] = sp.cat;
    st["st"] = sp.st;
  }
  if (!sp.mag.is_null()) st["mag"] = sp.mag;
  d["std"] = st;
  if (!sp.mat.is_null()) d["mat"] = sp.mat;
  const auto fonction = [&](J f) {
    const std::string t = f["type"].get<std::string>();
    f["id"] = as::nouvelIdentifiant(t == "revolve" ? "rv" : t == "xthread" ? "th" : t == "gear" ? "gr" : "ex");
    f["visible"] = true;
    f["body"] = "b1";
    d["features"].push_back(std::move(f));
  };
  const auto extrusion = [&](const std::string& nom, const J& s, double dist, const char* op) {
    J f = J::object();
    f["type"] = "extrude";
    f["name"] = nom;
    f["sketchId"] = s["id"];
    f["distance"] = dist;
    f["op"] = op;
    f["mid"] = false;
    f["upto"] = nullptr;
    d["sketches"].push_back(s);
    fonction(std::move(f));
  };
  if (!sp.prof.empty()) {
    J s = esquisseVide(d, "Profil", "XZ", 0);
    boucle(s, sp.prof);
    J f = J::object();
    f["type"] = "revolve";
    f["name"] = "Révolution";
    f["sketchId"] = s["id"];
    J ax = J::object();
    ax["k"] = "sys";
    ax["d"] = "Z";
    f["axis"] = ax;
    f["angle"] = 360;
    f["op"] = "add";
    d["sketches"].push_back(std::move(s));
    fonction(std::move(f));
  }
  if (!sp.prof.empty() && sp.thr) {
    const Filetage& t = *sp.thr;
    const double r6 = js::arrondi(t.r, 6);
    J f = J::object();
    f["type"] = "xthread";
    f["name"] = nomFiletageTige(t);
    J cyl = J::object();
    cyl["c"] = {0, 0, 0};
    cyl["u"] = {0, 0, 1};
    cyl["r"] = r6;
    cyl["p"] = {r6, 0, js::arrondi(t.z, 6)};
    f["cyl"] = cyl;
    f["size"] = t.size;
    f["p"] = t.p;
    f["lh"] = false;
    f["model"] = t.model;
    f["clear"] = 0;
    f["lenMode"] = t.lenMode;
    f["len"] = t.len;
    f["flip"] = false;
    f["visible"] = true;
    fonction(std::move(f));
  }
  for (const Operation& o : sp.ops) {
    if (o.k == "hex") {
      J s = esquisseVide(d, "Six pans creux", "XY", o.z + 0.5);
      boucle(s, hexagone(o.s));
      extrusion("Six pans creux " + F(o.s), s, -(o.t + 0.5), "cut");
    } else if (o.k == "slot") {
      J s = esquisseVide(d, "Fente", "XY", o.z0 - 1);
      const double g = o.w / 2;
      boucle(s, {P(o.x0, -g), P(o.x1, -g), P(o.x1, g), P(o.x0, g)});
      extrusion("Fente", s, o.L + 2, "cut");
    } else if (o.k == "key") {
      J s = esquisseVide(d, "Contour", "XY", 0);
      boucle(s, contourClavette(o));
      extrusion("Clavette", s, o.h, "add");
    } else if (o.k == "gear") {
      const ReglageEngrenage& q = o.gear;
      J f = J::object();
      f["type"] = "gear";
      f["name"] = "Denture";
      f["m"] = q.m;
      f["z"] = q.z;
      f["alpha"] = q.alpha;
      f["b"] = q.b;
      f["x"] = q.x;
      f["beta"] = q.beta;
      f["hand"] = q.hand;
      f["op"] = "add";
      f["id"] = as::nouvelIdentifiant("gr");
      f["visible"] = true;
      f["body"] = "b1";
      if (q.kind == "int") {
        f["kind"] = "int";
        f["D"] = q.D;
      }
      if (q.kind == "rack") {
        f["kind"] = "rack";
        f["H"] = q.H;
      }
      if (q.j != 0) f["j"] = q.j;
      if (q.ks != 0) f["ks"] = q.ks;
      d["features"].push_back(std::move(f));
    } else if (o.k == "mbox") {
      J s = esquisseVide(d, "Contour", "XY", 0);
      const double a = o.a / 2, b = o.b / 2;
      boucle(s, {P(-a, -b), P(a, -b), P(a, b), P(-a, b)});
      extrusion("Aimant", s, o.h, "add");
    } else if (o.k == "bore") {
      J s = esquisseVide(d, "Alésage", "XY", -1);
      if (o.b != 0) boucle(s, boucleAlesage(o));
      else {
        J e = J::object();
        e["id"] = entiteNeuve(s);
        const std::string pc = pointNeuf(s, 0, 0);
        e["t"] = "circle";
        e["pc"] = pc;
        e["r"] = o.d / 2;
        s["entities"].push_back(std::move(e));
      }
      extrusion(o.b != 0 ? "Alésage et rainure" : "Alésage", s, o.w + 2, "cut");
    }
  }
  return d;
}

Apercu apercuDe(const Piece& sp) {
  Apercu A;
  const auto cercle = [](double r, int n) {
    std::vector<std::array<double, 2>> C;
    for (int i = 0; i < n; i++) {
      const double a = 2.0 * PI * i / n;
      C.push_back({r * std::cos(a), r * std::sin(a)});
    }
    return C;
  };
  for (const MembrePaire& M : sp.paire) {
    try {
      const GeoEngrenage g = geoEngrenage(M.o);
      const auto mv = [&](std::vector<std::array<double, 2>> L) {
        for (auto& q : L) {
          const double x = M.fr.o[0] + q[0] * M.fr.x[0] + q[1] * M.fr.y[0], y = M.fr.o[1] + q[0] * M.fr.x[1] + q[1] * M.fr.y[1];
          q = {x, y};
        }
        return L;
      };
      if (g.internal) {
        A.formes.push_back(mv(cercle(g.D / 2, 96)));
        A.trous.push_back(mv(polylineEngrenage(g, 0.05)));
      } else A.formes.insert(A.formes.begin(), mv(polylineEngrenage(g, 0.05)));
    } catch (const std::exception&) {
    }
  }
  if (!sp.prof.empty()) {
    const auto Q = polyPoints(sp.prof);
    A.formes.push_back(Q);
    auto Qm = Q;
    for (auto& q : Qm) q[0] = -q[0];
    A.formes.push_back(Qm);
    A.axe = true;
    for (const Operation& o : sp.ops) {
      if (o.k == "hex") {
        const double e = o.s / std::sqrt(3.0);
        A.caches.push_back({{-e, o.z}, {-e, o.z - o.t}, {e, o.z - o.t}, {e, o.z}});
      }
      if (o.k == "slot") {
        A.caches.push_back({{-o.w / 2, o.z0}, {-o.w / 2, o.z0 + o.L}});
        A.caches.push_back({{o.w / 2, o.z0}, {o.w / 2, o.z0 + o.L}});
      }
    }
  }
  for (const Operation& o : sp.ops) {
    if (o.k == "gear") {
      const GeoEngrenage g = geoEngrenage(o.gear);
      if (g.internal) {
        A.formes.push_back(cercle(g.D / 2, 96));
        A.trous.push_back(polylineEngrenage(g, 0.05));
      } else A.formes.push_back(polylineEngrenage(g, 0.05));
    }
    if (o.k == "bore") {
      if (o.b != 0) A.trous.push_back(polyPoints(boucleAlesage(o)));
      else A.trous.push_back(cercle(o.d / 2, 48));
    }
    if (o.k == "mbox") A.formes.push_back({{-o.a / 2, 0}, {o.a / 2, 0}, {o.a / 2, o.h}, {-o.a / 2, o.h}});
    if (o.k == "key") {
      auto Q = polyPoints(contourClavette(o));
      const double gap = o.b * 0.8;
      for (auto& q : Q) q[1] += o.b / 2 + gap / 2;
      A.formes.push_back(Q);
      A.formes.push_back({{-o.L / 2, -gap / 2}, {o.L / 2, -gap / 2}, {o.L / 2, -gap / 2 - o.h}, {-o.L / 2, -gap / 2 - o.h}});
    }
  }
  return A;
}

// ---- l'assemblage ----
namespace {
using V = as::V3;
V sub(const V& a, const V& b) { return {a[0] - b[0], a[1] - b[1], a[2] - b[2]}; }
V add(const V& a, const V& b) { return {a[0] + b[0], a[1] + b[1], a[2] + b[2]}; }
V mul(const V& a, double k) { return {a[0] * k, a[1] * k, a[2] * k}; }
double dot(const V& a, const V& b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
double len(const V& a) { return std::sqrt(dot(a, a)); }
V cross(const V& a, const V& b) { return {a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]}; }
bool unit(const V& a, V& o) {
  const double l = len(a);
  if (l < 1e-12) return false;
  o = mul(a, 1 / l);
  return true;
}
bool peutPoser(const J& a, const std::string& cid, const std::string& ownerId) {  // asmCanPlace
  const J* c = as::composant(a, cid);
  const J* o = as::composant(a, ownerId);
  if (!c || !o || as::contient(a, cid, ownerId)) return false;
  const J* L = as::proprietaireLien(a, ownerId);
  return !L || c->value("of", std::string()) == L->value("id", std::string());
}
J composantNeuf(J& a, const Piece& sp, const std::string& owner) {
  J c = J::object();
  c["id"] = as::nouvelIdentifiant("cp");
  c["kind"] = "comp";
  c["name"] = sp.name;
  c["doc"] = documentDe(sp);
  c["occ"] = J::array();
  c["link"] = nullptr;
  if (const J* L = as::proprietaireLien(a, owner)) c["of"] = (*L)["id"];
  return c;
}
const J* composantPareil(const J& a, const std::string& key, const std::function<bool(const std::string&)>& peut) {
  for (const J& q : a["comps"]) {
    if (!q.contains("doc") || !q["doc"].is_object() || !q["doc"].contains("std") || !q["doc"]["std"].is_object()) continue;
    if (q["doc"]["std"].value("key", std::string()) == key && peut(q["id"].get<std::string>())) return &q;
  }
  return nullptr;
}
// stdCompFor : celui de même désignation s'il peut aller dans le porteur, sinon un neuf
std::string composantPour(J& a, const Piece& sp, const std::string& owner) {
  if (const J* q = composantPareil(a, sp.key, [&](const std::string& id) { return peutPoser(a, id, owner); })) return (*q)["id"].get<std::string>();
  J c = composantNeuf(a, sp, owner);
  const std::string id = c["id"].get<std::string>();
  a["comps"].push_back(std::move(c));
  return id;
}
std::vector<J*> occurrencesDe(J& a, const std::string& cid) {  // asmCompOccs
  std::vector<J*> L;
  for (J& c : a["comps"])
    if (c.contains("occ"))
      for (J& o : c["occ"])
        if (o.value("comp", std::string()) == cid) L.push_back(&o);
  return L;
}
void purger(J& a) {  // asmPurge
  for (bool encore = true; encore;) {
    encore = false;
    std::set<std::string> vus = {as::racine(a)};
    for (const J& c : a["comps"])
      if (c.contains("occ"))
        for (const J& o : c["occ"]) vus.insert(o.value("comp", std::string()));
    J garde = J::array();
    for (const J& c : a["comps"])
      if (vus.count(c["id"].get<std::string>())) garde.push_back(c);
    if (garde.size() < a["comps"].size()) {
      a["comps"] = std::move(garde);
      encore = true;
    }
  }
}
J liaisonRigide(const as::Chemin& relatif, const J& sn, bool flip, double rz, const V& off) {
  J src = J::object();
  src["path"] = J::array();
  src["cg"] = nullptr;
  J dst = J::object();
  dst["path"] = relatif;
  dst["cg"] = nullptr;
  dst["sn"] = sn;
  J al = J::object();
  al["src"] = src;
  al["dst"] = dst;
  al["flip"] = flip;
  al["rz"] = rz;
  al["off"] = {off[0], off[1], off[2]};
  return al;
}
const as::PointAccroche* chercher(const std::vector<as::PointAccroche>& L, const std::function<bool(const as::PointAccroche&)>& f) {
  for (const as::PointAccroche& q : L)
    if (f(q)) return &q;
  return nullptr;
}
std::string arr3(double v) { return js::fixe(v, 3); }
std::string cleV(const V& v) { return arr3(v[0]) + "," + arr3(v[1]) + "," + arr3(v[2]); }
J referenceTrou(const Trou& h, const std::string& mode, const std::string& pos) {  // stdHoleSn
  if (mode == "mid") {
    if (!h.aCyl) return nullptr;
    const std::vector<as::PointAccroche> its = as::pointsDe(h.cyl);
    const as::PointAccroche* it = nullptr;
    if (pos == "top" || pos == "bot") {
      std::vector<std::pair<const as::PointAccroche*, double>> ends;
      for (const as::PointAccroche& q : its)
        if (q.w == "a0" || q.w == "a1") ends.push_back({&q, -dot(sub(q.fr.o, h.ec), h.n)});
      std::stable_sort(ends.begin(), ends.end(), [](const auto& a, const auto& b) { return a.second < b.second; });
      if (!ends.empty()) it = (pos == "top" ? ends.front() : ends.back()).first;
    } else it = chercher(its, [](const as::PointAccroche& q) { return q.w == "am"; });
    return it ? as::referenceAccroche(h.cyl, *it) : J(nullptr);
  }
  const as::FaceAccroche& F = mode == "under" ? h.assise : h.entree;
  const V Sc = mode == "under" ? h.sc : h.ec, Sn = mode == "under" ? h.sn : h.en;
  const auto at = [&](const as::PointAccroche& q) { return len(sub(q.fr.o, Sc)) < 1e-3 && dot(q.fr.z, Sn) > 0.999; };
  const std::vector<as::PointAccroche> its = as::pointsDe(F);
  const as::PointAccroche* it = chercher(its, [&](const as::PointAccroche& q) { return q.w == "ec" && q.aArete && at(q); });
  if (!it) it = chercher(its, [&](const as::PointAccroche& q) { return q.w == "c" && at(q); });
  return it ? as::referenceAccroche(F, *it) : J(nullptr);
}
}  // namespace

std::string ajouterOccurrence(J& a, const Piece& sp, const std::string& ownerId, const as::Repere& fr, bool* neuf) {
  J* owner = as::composant(a, ownerId);
  if (!owner) return "";
  if (const J* same = composantPareil(a, sp.key, [&](const std::string& id) { return peutPoser(a, id, ownerId); })) {
    if (neuf) *neuf = false;
    const std::string cid = (*same)["id"].get<std::string>();
    J o = as::nouvelleOccurrenceObjet(cid, as::nomOccurrence(a, cid), as::arrondir(fr));
    const std::string id = o["id"].get<std::string>();
    (*owner)["occ"].push_back(std::move(o));
    return id;
  }
  if (neuf) *neuf = true;
  J c = composantNeuf(a, sp, ownerId);
  const std::string cid = c["id"].get<std::string>();
  a["comps"].push_back(std::move(c));
  owner = as::composant(a, ownerId);
  J o = as::nouvelleOccurrenceObjet(cid, sp.name + ":1", as::arrondir(fr));
  const std::string id = o["id"].get<std::string>();
  (*owner)["occ"].push_back(std::move(o));
  return id;
}

std::vector<Trou> trousDe(const std::vector<as::FaceAccroche>& G) {
  struct Cercle {
    const as::FaceAccroche* F;
    V c, n;
    double r;
  };
  std::vector<Cercle> circ;
  std::vector<std::pair<std::string, const as::FaceAccroche*>> cyl;
  std::vector<Trou> out;
  for (const as::FaceAccroche& F : G) {
    if (F.k == "cyl") {
      const std::string k = cleV(F.l) + "|" + cleV(F.n) + "|" + arr3(F.r) + "|" + arr3(F.t[0]) + "|" + arr3(F.t[1]);
      if (std::none_of(cyl.begin(), cyl.end(), [&](const auto& q) { return q.first == k; })) cyl.push_back({k, &F});
      continue;
    }
    const double u0 = F.rect[0], u1 = F.rect[1], v0 = F.rect[2], v1 = F.rect[3];
    for (const as::AreteAccroche& e : F.aretes) {
      if (e.k != "circ" || std::abs(dot(e.n, F.n)) < 0.999) continue;
      const V q = sub(e.c, F.c);
      const double u = dot(q, F.x), v = dot(q, F.y);
      if (std::min({u1 - u, u - u0, v1 - v, v - v0}) < e.r + 0.01) continue;
      if (std::any_of(circ.begin(), circ.end(), [&](const Cercle& c) { return c.F == &F && len(sub(c.c, e.c)) < 1e-3 && std::abs(c.r - e.r) < 1e-3; })) continue;
      circ.push_back({&F, e.c, F.n, e.r});
    }
  }
  const auto depth = [](const Cercle& E, const V& p) { return -dot(sub(p, E.c), E.n); };
  const auto off = [](const Cercle& E, const V& p) {
    const V w = sub(p, E.c);
    return len(sub(w, mul(E.n, dot(w, E.n))));
  };
  for (const Cercle& E : circ) {
    std::vector<const Cercle*> co;
    for (const Cercle& o : circ)
      if (&o != &E && dot(o.n, E.n) > 0.999 && off(E, o.c) < 0.01) co.push_back(&o);
    if (std::any_of(co.begin(), co.end(), [&](const Cercle* o) { return depth(E, o->c) < -0.01; })) continue;
    struct Seg {
      double r, d0, d1;
      const as::FaceAccroche* F;
    };
    std::vector<Seg> cs;
    for (const auto& q : cyl) {
      const as::FaceAccroche& F = *q.second;
      if (!(std::abs(dot(F.n, E.n)) > 0.999 && off(E, F.l) < 0.01)) continue;
      const double a = depth(E, add(F.l, mul(F.n, F.t[0]))), b = depth(E, add(F.l, mul(F.n, F.t[1])));
      const Seg s = {F.r, std::min(a, b), std::max(a, b), &F};
      if (s.d1 > 0.01) cs.push_back(s);
    }
    std::stable_sort(cs.begin(), cs.end(), [](const Seg& a, const Seg& b) { return a.d0 < b.d0; });
    std::vector<Seg> seg;
    for (const Seg& c : cs) {
      const double prev = !seg.empty() ? seg.back().d1 : (c.r < E.r - 0.01 ? c.d0 : 0);
      if (std::abs(c.d0 - prev) > 0.02 || c.r > E.r + 0.01) break;
      seg.push_back(c);
    }
    if (seg.empty()) continue;
    const std::string kind = seg[0].r < E.r - 0.01 ? "csink" : (seg.size() > 1 && seg[1].r < seg[0].r - 0.01) ? "cbore" : "simple";
    const Cercle* seat = &E;
    if (kind == "cbore")
      for (const Cercle* o : co)
        if (std::abs(depth(E, o->c) - seg[0].d1) < 0.02 && std::abs(o->r - seg[1].r) < 0.01) {
          seat = o;
          break;
        }
    const Seg& mainS = seg[kind == "cbore" ? 1 : 0];
    Trou t;
    t.entree = *E.F;
    t.assise = *seat->F;
    t.ec = E.c;
    t.en = E.n;
    t.er = E.r;
    t.sc = seat->c;
    t.sn = seat->n;
    t.sr = seat->r;
    t.sorte = kind;
    t.n = E.n;
    t.r = mainS.r;
    t.cyl = *mainS.F;
    t.aCyl = true;
    t.d0 = mainS.d0;
    t.d1 = mainS.d1;
    t.sig = kind + "|" + js::fixe(E.r, 2) + "|";
    for (size_t i = 0; i < seg.size(); i++) t.sig += (i ? ";" : "") + js::fixe(seg[i].r, 2) + ":" + js::fixe(seg[i].d0, 2) + ":" + js::fixe(seg[i].d1, 2);
    out.push_back(std::move(t));
  }
  return out;
}
const Trou* trouSous(const std::vector<Trou>& H, const V& p, const V* regard) {
  const Trou* best = nullptr;
  double bs = 0;
  for (const Trou& h : H) {
    const V w = sub(p, h.ec);
    const double d = -dot(w, h.n), lat = len(add(w, mul(h.n, d)));
    if (d < -0.6 || lat > h.er + 0.6) continue;
    const double sc = lat + (regard && dot(h.n, *regard) > 0 ? 1e3 : 0);
    if (!best || sc < bs) {
      best = &h;
      bs = sc;
    }
  }
  return best;
}
std::vector<const Trou*> trousPareils(const std::vector<Trou>& H, const Trou& h) {
  std::vector<const Trou*> o;
  for (const Trou& q : H)
    if (q.sig == h.sig && dot(q.n, h.n) > 0.999) o.push_back(&q);
  return o;
}
std::string positionGoupille(const Trou& h, const V& p) {
  const double d = -dot(sub(p, h.ec), h.n);
  const std::pair<const char*, double> c[3] = {{"top", h.d0}, {"mid", (h.d0 + h.d1) / 2}, {"bot", h.d1}};
  size_t b = 0;
  for (size_t i = 1; i < 3; i++)
    if (std::abs(c[i].second - d) < std::abs(c[b].second - d)) b = i;
  return c[b].first;
}
std::vector<std::string> poserSurTrous(J& a, const Piece& sp, const std::string& ownerId, const as::Chemin& relatif, const std::vector<const Trou*>& trous, const std::string& at) {
  std::vector<std::string> ids;
  if (!as::composant(a, ownerId) || trous.empty()) return ids;
  const std::string mode = sp.seat.empty() ? "under" : sp.seat, pos = at.empty() ? "mid" : at;
  std::vector<std::pair<J, const Trou*>> sns;
  for (const Trou* h : trous) {
    J sn = referenceTrou(*h, mode, pos);
    if (!sn.is_null()) sns.push_back({std::move(sn), h});
  }
  if (sns.empty()) return ids;
  const std::string cid = composantPour(a, sp, ownerId);
  J* owner = as::composant(a, ownerId);
  for (const auto& [sn, h] : sns) {
    J o = as::nouvelleOccurrenceObjet(cid, as::nomOccurrence(a, cid), as::Repere());
    const bool flip = sp.seat == "mid" && dot(as::repereDe(sn["fr"]).z, h->n) < 0;
    o["align"] = liaisonRigide(relatif, sn, flip, 0, {0, 0, -sp.sink});
    ids.push_back(o["id"].get<std::string>());
    (*owner)["occ"].push_back(std::move(o));
  }
  return ids;
}
std::optional<Rainure> rainureDe(const as::FaceAccroche& F) {
  if (F.k != "plane") return std::nullopt;
  std::vector<std::pair<V, double>> arcs;
  std::vector<const as::AreteAccroche*> lines;
  for (const as::AreteAccroche& e : F.aretes) {
    if (e.k == "circ" && !e.complet && std::abs(dot(e.n, F.n)) >= 0.999 && std::none_of(arcs.begin(), arcs.end(), [&](const auto& q) { return len(sub(q.first, e.c)) < 1e-3; })) arcs.push_back({e.c, e.r});
    if (e.k == "line") lines.push_back(&e);
  }
  const auto inPl = [&](const V& v, V& o) { return unit(sub(v, mul(F.n, dot(v, F.n))), o); };
  const auto ext = [&](const V& c, const V& ax, double& a, double& b) {
    a = 1e18;
    b = -1e18;
    for (const auto* l : lines)
      for (const V* p : {&l->p0, &l->p1}) {
        const double t = dot(sub(*p, c), ax);
        a = std::min(a, t);
        b = std::max(b, t);
      }
  };
  Rainure K;
  if (arcs.size() == 2 && std::abs(arcs[0].second - arcs[1].second) < 1e-3) {
    V ax;
    if (!inPl(sub(arcs[1].first, arcs[0].first), ax)) return std::nullopt;
    const double r = arcs[0].second, dd = len(sub(arcs[1].first, arcs[0].first));
    K.forme = "A";
    K.c = mul(add(arcs[0].first, arcs[1].first), 0.5);
    K.ax = ax;
    K.w = 2 * r;
    K.len = dd + 2 * r;
  } else if (arcs.size() == 1) {
    V ax;
    if (!inPl(sub(F.c, arcs[0].first), ax)) return std::nullopt;
    double a, b;
    ext(arcs[0].first, ax, a, b);
    K.forme = "open";
    K.c = F.c;
    K.ax = ax;
    K.w = 2 * arcs[0].second;
    K.len = b + arcs[0].second;
  } else if (arcs.empty() && lines.size() >= 4) {
    const as::AreteAccroche* lg = lines[0];
    for (const auto* l : lines)
      if (len(sub(l->p1, l->p0)) > len(sub(lg->p1, lg->p0))) lg = l;
    V ax;
    if (!inPl(sub(lg->p1, lg->p0), ax)) return std::nullopt;
    double a, b, c0, c1;
    ext(F.c, ax, a, b);
    ext(F.c, cross(F.n, ax), c0, c1);
    K.forme = "rect";
    K.c = F.c;
    K.ax = ax;
    K.w = c1 - c0;
    K.len = b - a;
  } else return std::nullopt;
  K.F = F;
  K.arcs = arcs;
  K.sig = K.forme + "|" + js::fixe(K.w, 2) + "|" + js::fixe(K.len, 2);
  return K;
}
std::optional<PoseRainure> choisirRainure(const std::vector<as::FaceAccroche>& G, const V& p, const V* n, const std::string& keyAt) {
  const as::FaceAccroche* F = as::faceSous(G, p, n);
  if (!F || F->k != "plane") return std::nullopt;
  const auto K = rainureDe(*F);
  if (!K) return std::nullopt;
  PoseRainure R;
  R.K = *K;
  R.mode = keyAt == "arc" ? "arc" : "face";
  bool aBout = false;
  std::pair<V, double> bout;
  if (K->forme == "open") {
    R.mode = "arc";
    bout = K->arcs[0];
    aBout = true;
  } else if (R.mode == "arc" && !K->arcs.empty()) {
    bout = K->arcs[0];
    for (const auto& b : K->arcs)
      if (len(sub(b.first, p)) < len(sub(bout.first, p))) bout = b;
    aBout = true;
  }
  if (K->forme == "rect") R.mode = "face";
  R.items.push_back({*K, aBout, bout});
  if (K->forme != "rect") {
    const V dir = aBout ? sub(bout.first, K->c) : V{0, 0, 0};
    for (const as::FaceAccroche& Gq : G) {
      if (&Gq == F || Gq.k != "plane") continue;
      const auto Q = rainureDe(Gq);
      if (!Q || Q->sig != K->sig) continue;
      RainureChoisie it;
      it.K = *Q;
      if (R.mode == "arc") {
        if (Q->forme == "open") {
          it.bout = Q->arcs[0];
          it.aBout = true;
        } else if (!Q->arcs.empty()) {  // stdKeyEndFor
          it.bout = Q->arcs[0];
          for (const auto& b : Q->arcs)
            if (dot(sub(b.first, Q->c), dir) > dot(sub(it.bout.first, Q->c), dir)) it.bout = b;
          it.aBout = true;
        }
      }
      R.items.push_back(std::move(it));
    }
  }
  return R;
}
std::vector<std::string> poserDansRainures(J& a, const Piece& sp, const std::string& ownerId, const as::Chemin& relatif, const PoseRainure& pose) {
  std::vector<std::string> ids;
  const Operation* key = nullptr;
  for (const Operation& o : sp.ops)
    if (o.k == "key") key = &o;
  if (!as::composant(a, ownerId) || !key) return ids;
  struct Al {
    J sn;
    double rz;
    V off;
  };
  std::vector<Al> al;
  for (const RainureChoisie& x : pose.items) {  // stdKeyAlign
    const Rainure& K = x.K;
    const std::vector<as::PointAccroche> its = as::pointsDe(K.F);
    const as::PointAccroche* it = nullptr;
    V u = K.ax;
    double d = 0;
    if (K.forme == "open" || (pose.mode == "arc" && x.aBout && K.forme != "rect")) {
      const std::pair<V, double> E = x.aBout ? x.bout : K.arcs[0];
      it = chercher(its, [&](const as::PointAccroche& q) { return q.w == "ec" && len(sub(q.fr.o, E.first)) < 1e-3; });
      if (K.forme != "open" && !unit(sub(K.c, E.first), u)) continue;
      d = key->L / 2 - E.second;
    } else it = chercher(its, [](const as::PointAccroche& q) { return q.w == "c"; });
    if (!it) continue;
    const double ux = dot(u, it->fr.x), uy = dot(u, it->fr.y);
    al.push_back({as::referenceAccroche(K.F, *it), js::arrondi(std::atan2(uy, ux) * 180 / PI, 9), {ux * d, uy * d, 0}});
  }
  if (al.empty()) return ids;
  const std::string cid = composantPour(a, sp, ownerId);
  J* owner = as::composant(a, ownerId);
  for (const Al& q : al) {
    J o = as::nouvelleOccurrenceObjet(cid, as::nomOccurrence(a, cid), as::Repere());
    o["align"] = liaisonRigide(relatif, q.sn, false, q.rz, q.off);
    ids.push_back(o["id"].get<std::string>());
    (*owner)["occ"].push_back(std::move(o));
  }
  return ids;
}
std::optional<Remplacement> remplacer(J& a, const std::string& occ, const Piece& sp, bool toutes) {
  const J* o = as::occurrence(a, occ);
  if (!o || !as::porteur(a, occ)) return std::nullopt;
  const std::string cid = o->value("comp", std::string());
  const J* c = as::composant(a, cid);
  if (!c || !c->contains("doc") || !(*c)["doc"].is_object() || !(*c)["doc"].contains("std") || !(*c)["doc"]["std"].is_object()) return std::nullopt;
  Remplacement R;
  if ((*c)["doc"]["std"].value("key", std::string()) == sp.key) {
    R.comp = cid;
    R.comment = "same";
    return R;
  }
  std::vector<std::string> ids;
  if (toutes)
    for (J* q : occurrencesDe(a, cid)) ids.push_back((*q)["id"].get<std::string>());
  else ids.push_back(occ);
  std::optional<Piece> was;
  if (const auto oS = etatDe((*c)["doc"]["std"])) {
    try {
      was = specification(oS->first, oS->second);
    } catch (const std::exception&) {
    }
  }
  const auto sink = [&] {
    if (!was || was->seat != sp.seat) return;
    for (const std::string& id : ids) {
      J* q = as::occurrence(a, id);
      if (q && q->contains("align") && (*q)["align"].is_object() && (*q)["align"].contains("dst") && (*q)["align"]["dst"].contains("sn")) (*q)["align"]["off"] = {0, 0, -sp.sink};
    }
  };
  const auto move = [&](const std::string& t) {
    for (const std::string& id : ids) {
      const std::string nom = as::nomOccurrence(a, t);
      J* q = as::occurrence(a, id);
      (*q)["name"] = nom;
      (*q)["comp"] = t;
    }
  };
  const J* same = composantPareil(a, sp.key, [&](const std::string& q) {
    if (q == cid) return false;
    for (const std::string& id : ids)
      if (!peutPoser(a, q, as::porteur(a, id)->value("id", std::string()))) return false;
    return true;
  });
  if (same) {
    const std::string t = (*same)["id"].get<std::string>();
    move(t);
    sink();
    purger(a);
    R.comp = t;
    R.n = static_cast<int>(ids.size());
    R.comment = "moved";
    return R;
  }
  if (toutes || occurrencesDe(a, cid).size() == 1) {
    J* cm = as::composant(a, cid);
    const std::string old = (*cm)["name"].get<std::string>();
    (*cm)["doc"] = documentDe(sp);
    (*cm)["name"] = sp.name;
    for (J* q : occurrencesDe(a, cid)) {
      std::string n = q->value("name", std::string());
      if (n.rfind(old, 0) == 0) (*q)["name"] = sp.name + n.substr(old.size());
    }
    sink();
    R.comp = cid;
    R.n = static_cast<int>(occurrencesDe(a, cid).size());
    R.comment = "rebuilt";
    return R;
  }
  const std::string ownerId = as::porteur(a, occ)->value("id", std::string());
  J t = composantNeuf(a, sp, ownerId);
  const std::string tid = t["id"].get<std::string>();
  a["comps"].push_back(std::move(t));
  move(tid);
  sink();
  R.comp = tid;
  R.n = 1;
  R.comment = "moved";
  return R;
}

// ---- aimants ----
bool aimantDe(const J& doc, J& m) {
  if (!doc.is_object() || !doc.contains("std") || !doc["std"].is_object() || !doc["std"].contains("mag") || !doc["std"]["mag"].is_object() || !doc["std"]["mag"].contains("s")) return false;
  m = doc["std"]["mag"];
  return true;
}
double champFaceNord(const J& m) { return champPole(geoAimant(m)); }
namespace {
struct Trace {
  std::vector<std::array<double, 3>> pts;
  bool ferme = false;
};
Trace tracer(const GeoAimant& m, const std::array<double, 3>& depart) {  // magTrace
  const double Sz = tailleAimant(m), h = Sz / 48, R = 4 * Sz, zc = m.h / 2;
  Trace T;
  T.pts.push_back(depart);
  const auto dir = [&](double x, double y, double z) {
    const auto B = champ(m, x, y, z);
    double n = std::sqrt(B[0] * B[0] + B[1] * B[1] + B[2] * B[2]);
    if (n == 0) n = 1e-30;
    return std::array<double, 3>{B[0] / n, B[1] / n, B[2] / n};
  };
  std::array<double, 3> p = depart;
  for (int i = 0; i < 1200; i++) {
    const auto k1 = dir(p[0], p[1], p[2]);
    const auto k2 = dir(p[0] + h / 2 * k1[0], p[1] + h / 2 * k1[1], p[2] + h / 2 * k1[2]);
    const auto k3 = dir(p[0] + h / 2 * k2[0], p[1] + h / 2 * k2[1], p[2] + h / 2 * k2[2]);
    const auto k4 = dir(p[0] + h * k3[0], p[1] + h * k3[1], p[2] + h * k3[2]);
    for (int j = 0; j < 3; j++) p[j] = p[j] + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
    if (!std::isfinite(p[0]) || !std::isfinite(p[1]) || !std::isfinite(p[2])) break;
    T.pts.push_back(p);
    if (i > 1 && dansAimant(m, p[0], p[1], p[2])) {
      T.ferme = true;
      return T;
    }
    if (std::sqrt(p[0] * p[0] + p[1] * p[1] + (p[2] - zc) * (p[2] - zc)) > R) return T;
  }
  return T;
}
std::array<float, 3> teinte(double t) {  // magColor : violet (faible) à orange (fort)
  const double H = (270 - 255 * t) / 360, Sa = 0.85, L = 0.58;
  const double q = L < 0.5 ? L * (1 + Sa) : L + Sa - L * Sa, p = 2 * L - q;
  const auto canal = [&](double x) {
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1.0 / 6) return p + (q - p) * 6 * x;
    if (x < 0.5) return q;
    if (x < 2.0 / 3) return p + (q - p) * (2.0 / 3 - x) * 6;
    return p;
  };
  return {static_cast<float>(canal(H + 1.0 / 3)), static_cast<float>(canal(H)), static_cast<float>(canal(H - 1.0 / 3))};
}
}  // namespace
std::vector<SegmentChamp> lignesChamp(const J& mj) {
  const GeoAimant m = geoAimant(mj);
  std::vector<SegmentChamp> out;
  const double lo = std::log(1e-3), hi = std::log(std::max(m.Br, 2e-3));
  const auto col = [&](const std::array<double, 3>& p) {
    const auto B = champ(m, p[0], p[1], p[2]);
    const double n = std::max(std::sqrt(B[0] * B[0] + B[1] * B[1] + B[2] * B[2]), 1e-6);
    return teinte(std::max(0.0, std::min(1.0, (std::log(n) - lo) / (hi - lo))));
  };
  const double Sz = tailleAimant(m), w = Sz * 0.05;
  // magSeeds
  std::vector<std::array<double, 3>> graines;
  const double z = m.h + Sz * 1e-3;
  if (m.s == "box") {
    const int nx = std::max(2, static_cast<int>(std::floor(std::sqrt(36 * m.a / m.b) + 0.5))), ny = std::max(2, static_cast<int>(std::floor(36.0 / nx + 0.5)));
    for (int i = 0; i < nx; i++)
      for (int j = 0; j < ny; j++) graines.push_back({m.a * ((i + .5) / nx - .5), m.b * ((j + .5) / ny - .5), z});
  } else {
    const double r0 = m.s == "ring" ? m.di / 2 : 0, r1 = m.d / 2;
    for (int i = 0; i < 4; i++) {
      const double r = r0 + (r1 - r0) * (i + .5) / 4;
      for (int j = 0; j < 12; j++) {
        const double t = 2 * PI * (j + (i % 2) * .5) / 12;
        graines.push_back({r * std::cos(t), r * std::sin(t), z});
      }
    }
  }
  const auto dessiner = [&](const std::vector<std::array<double, 3>>& Q) {
    const int nq = static_cast<int>(Q.size()), st = std::max(1, static_cast<int>(std::floor(nq / 90.0 + 0.5)));
    std::array<double, 3> prev = Q[0];
    int n = 0;
    for (int i = st;; i += st) {
      const auto& q = Q[std::min(i, nq - 1)];
      out.push_back({prev, q, col(q)});
      prev = q;
      if (i >= nq - 1 || ++n > 4000) break;
    }
    if (nq < 4) return;
    const int i = nq / 2;
    const auto& a = Q[i];
    const auto& b = Q[std::min(i + 1, nq - 1)];
    std::array<double, 3> d = {b[0] - a[0], b[1] - a[1], b[2] - a[2]};
    double l = std::sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    if (l == 0) l = 1;
    for (double& v : d) v /= l;
    std::array<double, 3> u = {-d[2], 0, d[0]};
    if (std::sqrt(u[0] * u[0] + u[2] * u[2]) < 1e-3) u = {1, 0, 0};
    const double lu = std::sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
    for (double& v : u) v /= lu;
    const auto k = col(a);
    std::array<double, 3> t1, t2;
    for (int j = 0; j < 3; j++) {
      t1[j] = a[j] - w * d[j] + w * .5 * u[j];
      t2[j] = a[j] - w * d[j] - w * .5 * u[j];
    }
    out.push_back({a, t1, k});
    out.push_back({a, t2, k});
  };
  for (const auto& s : graines) {
    const Trace T = tracer(m, s);
    dessiner(T.pts);
    if (!T.ferme) {
      auto Q = T.pts;
      std::reverse(Q.begin(), Q.end());
      for (auto& p : Q) p[2] = m.h - p[2];
      dessiner(Q);
    }
  }
  return out;
}
std::vector<std::pair<std::string, std::string>> caracteristiques(const J& m) {
  const auto Fn = [](double v, int n) { return F(js::arrondi(v, n)); };
  const auto pair = [&](const char* k, const char* u, int n) {
    if (!m.contains(k) || !m[k].is_array()) return std::string("non indiqué");
    return Fn(m[k][0].get<double>(), n) + " à " + Fn(m[k][1].get<double>(), n) + " " + u;
  };
  std::vector<std::pair<std::string, std::string>> L;
  L.push_back({"Article", S(m, "code") + " (" + S(m, "src") + ")"});
  L.push_back({"Matière", S(m, "mat") + " " + S(m, "grade")});
  L.push_back({"Rémanence Br", pair("br", "T", 3)});
  L.push_back({"Coercivité HcB", pair("hcb", "kA/m", 0)});
  L.push_back({"Coercivité HcJ", N(m, "hcj") > 0 ? "≥ " + Fn(N(m, "hcj"), 0) + " kA/m" : std::string("non indiquée")});
  L.push_back({"Énergie (BH)max", pair("bh", "kJ/m³", 0)});
  L.push_back({"Force d’adhérence", S(m, "force").empty() ? std::string("non indiquée") : S(m, "force")});
  L.push_back({"Température maxi", m.contains("tmax") && m["tmax"].is_number() ? js::texte(m["tmax"].get<double>()) + " °C" : std::string("non indiquée")});
  L.push_back({"Aimantation", S(m, "dirTxt").empty() ? std::string("axiale") : S(m, "dirTxt")});
  L.push_back({"Champ face nord", js::texte(std::floor(std::abs(champFaceNord(m)) * 1000 + 0.5)) + " mT (calculé)"});
  return L;
}
}  // namespace normalises
