// Oblong en 3 clics et nouvelles façons de tracer rectangle, cercle et arc : traduction de
// src/50-esquisse-9-oblong.js et src/50-esquisse-91-traces.js du navigateur (V0.69.0), au dernier chiffre près.
// Aucun « Fixe » : un point cliqué sur une géométrie s'y accroche, un point dans le vide reste libre.
#include <algorithm>
#include <array>
#include <cmath>
#include <limits>
#include <optional>

#include "dessin.h"
#include "dessin_commun.h"

namespace {
const double SLOT_PLAT = 3 * PI_ / 180;

// Math.hypot à 3 valeurs : même somme de Kahan que hyp()
double hyp3(double a, double b, double c) {
  a = std::abs(a);
  b = std::abs(b);
  c = std::abs(c);
  const double m = std::max({a, b, c});
  if (m == 0) return 0;
  double somme = 0, comp = 0;
  for (const double v : {a, b, c}) {
    const double n = v / m, s = n * n - comp, pre = somme + s;
    comp = (pre - somme) - s;
    somme = pre;
  }
  return std::sqrt(somme) * m;
}

const char* msgSlot(const std::string& mode, int i) {
  if (mode == "bouts") return i ? "Oblong : cliquez le 2e point extrême." : "Oblong : cliquez le 1er point extrême.";
  if (mode == "milieu") return i ? "Oblong : cliquez un centre de demi-cercle (l’écartement)." : "Oblong : cliquez le milieu.";
  return i ? "Oblong : cliquez le 2e centre." : "Oblong : cliquez le 1er centre.";
}
// SK_TR_MSG
const char* msgTrace(Dessin::Outil o, const std::string& m, size_t i) {
  static const char* R3[] = {"Rectangle : cliquez le début d’un côté.", "Rectangle : cliquez la fin de ce côté.", "Rectangle : cliquez pour la largeur."};
  static const char* C2[] = {"Cercle : cliquez le 1er bout du diamètre.", "Cercle : cliquez le 2e bout du diamètre."};
  static const char* C3[] = {"Cercle : cliquez le 1er point du tour.", "Cercle : cliquez le 2e point.", "Cercle : cliquez le 3e point."};
  static const char* CT[] = {"Cercle : cliquez le 1er trait touché.", "Cercle : cliquez le 2e trait touché.", "Cercle : cliquez un 3e trait, ou dans le vide pour la taille."};
  static const char* A3[] = {"Arc : cliquez le départ.", "Arc : cliquez l’arrivée.", "Arc : cliquez un point de passage."};
  static const char* AT[] = {"Arc : cliquez un trait, du côté du bout d’où partir (sur un cercle : à l’endroit voulu).", "Arc : cliquez l’arrivée, ou un 2e trait à toucher.", "Arc : cliquez pour la taille."};
  if (o == Dessin::RECTANGLE) {
    if (m == "coins") return "Rectangle : cliquez le 1er coin.";
    if (m == "centre") return "Rectangle : cliquez le centre.";
    return R3[std::min<size_t>(i, 2)];
  }
  if (o == Dessin::CERCLE) {
    if (m == "centre") return "Cercle : cliquez le centre.";
    if (m == "2pts") return C2[std::min<size_t>(i, 1)];
    if (m == "3pts") return C3[std::min<size_t>(i, 2)];
    return CT[std::min<size_t>(i, 2)];
  }
  if (m == "centre") return "Arc : cliquez le centre.";
  if (m == "3pts") return A3[std::min<size_t>(i, 2)];
  return AT[std::min<size_t>(i, 2)];
}
// La fin du message d'un tracé réussi : « cliquez le centre »
std::string suiteMsg(std::string m) {
  const size_t d = m.find(": c");
  if (d != std::string::npos) m = m.substr(d + 2);
  const size_t p = m.find(" (");
  if (p != std::string::npos) m.resize(p);
  if (!m.empty() && m.back() == '.') m.pop_back();
  return m;
}

// skCirc3
struct Rond {
  double x, y, r;
};
std::optional<Rond> cercle3(double a0, double a1, double b0, double b1, double c0, double c1) {
  const double ax = b0 - a0, ay = b1 - a1, bx = c0 - a0, by = c1 - a1;
  const double det = 2 * (ax * by - ay * bx), L = jsmax(ax * ax + ay * ay, bx * bx + by * by);
  if (!(L > 1e-12) || std::abs(det) < 1e-6 * L) return std::nullopt;
  const double a2 = ax * ax + ay * ay, b2 = bx * bx + by * by;
  const double ux = (by * a2 - ay * b2) / det, uy = (ax * b2 - bx * a2) / det;
  return Rond{a0 + ux, a1 + uy, hyp(ux, uy)};
}

// skTanElem : un trait vu par la tangence, droite (n·C = d) ou cercle
struct TanE {
  bool ligne = false;
  std::string id;
  double nx = 0, ny = 0, d = 0, x = 0, y = 0, R = 0;
};
struct Sol {
  double x = 0, y = 0, r = 0;
  std::vector<int> s;
  bool tenu = false;
};
std::optional<TanE> elemTan(const Esquisse& sk, const std::string& id) {
  const Entite* e = nullptr;
  for (const Entite& q : sk.entites)
    if (q.id == id) {
      e = &q;
      break;
    }
  if (!e) return std::nullopt;
  TanE o;
  o.id = id;
  if (e->t == "line") {
    const Pt* A = sk.point(e->p1);
    const Pt* B = sk.point(e->p2);
    if (!A || !B) return std::nullopt;
    const double L = hyp(B->x - A->x, B->y - A->y);
    if (!(L > 1e-9)) return std::nullopt;
    o.ligne = true;
    o.nx = -(B->y - A->y) / L;
    o.ny = (B->x - A->x) / L;
    o.d = o.nx * A->x + o.ny * A->y;
    return o;
  }
  if (e->t == "circle" || e->t == "arc") {
    const Pt* C = sk.point(e->pc);
    if (!C || !(e->r > 0)) return std::nullopt;
    o.x = C->x;
    o.y = C->y;
    o.R = e->r;
    return o;
  }
  return std::nullopt;
}
// skTanCandidats : tous les cercles tangents à E (3 traits, ou 2 traits et le rayon r0 quand aR0)
std::vector<Sol> candidats(const std::vector<TanE>& E, bool aR0, double r0) {
  std::vector<Sol> out;
  const int n = static_cast<int>(E.size());
  using L4 = std::array<double, 4>;
  for (int m = 0; m < (1 << n); m++) {
    std::vector<int> s(n);
    for (int i = 0; i < n; i++) s[i] = (m >> i) & 1 ? -1 : 1;
    std::vector<L4> lin;
    const TanE* qe = nullptr;
    int qs = 0;
    for (int i = 0; i < n; i++) {
      const TanE& e = E[i];
      if (e.ligne) lin.push_back({e.nx, e.ny, static_cast<double>(-s[i]), e.d});
      else if (!qe) {
        qe = &e;
        qs = s[i];
      } else {
        const TanE& O = *qe;
        lin.push_back({-2 * (e.x - O.x), -2 * (e.y - O.y), -2 * (s[i] * e.R - qs * O.R), e.R * e.R - O.R * O.R - (e.x * e.x + e.y * e.y) + (O.x * O.x + O.y * O.y)});
      }
    }
    if (aR0) lin.push_back({0, 0, 1, r0});
    std::vector<L4> rows;
    bool bad = false;
    for (const L4& l : lin) {
      const double k = hyp3(l[0], l[1], l[2]);
      if (k < 1e-12) bad = true;
      else rows.push_back({l[0] / k, l[1] / k, l[2] / k, l[3] / k});
    }
    if (bad || rows.size() < 2) continue;
    const L4& n1 = rows[0];
    const L4& n2 = rows[1];
    const double V[3] = {n1[1] * n2[2] - n1[2] * n2[1], n1[2] * n2[0] - n1[0] * n2[2], n1[0] * n2[1] - n1[1] * n2[0]};
    const double v2 = V[0] * V[0] + V[1] * V[1] + V[2] * V[2];
    if (v2 < 1e-16) continue;
    const double c21[3] = {n2[1] * V[2] - n2[2] * V[1], n2[2] * V[0] - n2[0] * V[2], n2[0] * V[1] - n2[1] * V[0]};
    const double c1v[3] = {V[1] * n1[2] - V[2] * n1[1], V[2] * n1[0] - V[0] * n1[2], V[0] * n1[1] - V[1] * n1[0]};
    double P0[3];
    for (int i = 0; i < 3; i++) P0[i] = (n1[3] * c21[i] + n2[3] * c1v[i]) / v2;
    std::vector<double> ts;
    if (!qe) {
      if (rows.size() < 3) continue;
      const L4& n3 = rows[2];
      const double den = n3[0] * V[0] + n3[1] * V[1] + n3[2] * V[2];
      if (std::abs(den) < 1e-12) continue;
      ts.push_back((n3[3] - n3[0] * P0[0] - n3[1] * P0[1] - n3[2] * P0[2]) / den);
    } else {
      const TanE& O = *qe;
      const double qx = P0[0] - O.x, qy = P0[1] - O.y, g = O.R + qs * P0[2], gv = qs * V[2];
      const double A = V[0] * V[0] + V[1] * V[1] - gv * gv, B = 2 * (qx * V[0] + qy * V[1] - g * gv), C = qx * qx + qy * qy - g * g;
      if (std::abs(A) < 1e-12) {
        if (std::abs(B) > 1e-12) ts.push_back(-C / B);
      } else {
        double D = B * B - 4 * A * C;
        if (D < 0 && D > -1e-9 * jsmax(1, B * B)) D = 0;
        if (D >= 0) {
          const double w = std::sqrt(D);
          ts.push_back((-B + w) / (2 * A));
          ts.push_back((-B - w) / (2 * A));
        }
      }
    }
    for (const double t : ts) {
      const double x = P0[0] + t * V[0], y = P0[1] + t * V[1], r = P0[2] + t * V[2];
      if (!(r > 1e-6) || !std::isfinite(x) || !std::isfinite(y)) continue;
      const double tol = 1e-6 * (1 + r);
      bool ok = true;
      for (int i = 0; i < n && ok; i++) {
        const TanE& e = E[i];
        ok = e.ligne ? std::abs(e.nx * x + e.ny * y - s[i] * r - e.d) < tol : std::abs(hyp(x - e.x, y - e.y) - std::abs(e.R + s[i] * r)) < tol;
      }
      if (!ok) continue;
      if (std::any_of(out.begin(), out.end(), [&](const Sol& o) { return hyp(o.x - x, o.y - y) < 1e-6 && std::abs(o.r - r) < 1e-6; })) continue;
      Sol o;
      o.x = x;
      o.y = y;
      o.r = r;
      o.s = s;
      out.push_back(std::move(o));
    }
  }
  return out;
}
Pt piedTan(const TanE& e, const Sol& c) {  // skTanPied
  if (e.ligne) {
    const double k = e.nx * c.x + e.ny * c.y - e.d;
    return {c.x - e.nx * k, c.y - e.ny * k};
  }
  const double h = hyp(c.x - e.x, c.y - e.y), d = h != 0 ? h : 1e-9, ux = (c.x - e.x) / d, uy = (c.y - e.y) / d;
  const double k = (d < c.r && c.r > e.R) ? -e.R : e.R;  // grand cercle-solution qui contient le trait : contact du côté opposé
  return {e.x + ux * k, e.y + uy * k};
}
double distTan(const TanE& e, double x, double y) { return e.ligne ? std::abs(e.nx * x + e.ny * y - e.d) : std::abs(hyp(x - e.x, y - e.y) - e.R); }
// skTan2Sol : le centre suit le curseur, la taille vient de sa distance aux traits ; 2 droites parallèles imposent la taille
std::optional<Sol> sol2(const std::vector<TanE>& E, double x, double y) {
  const TanE& a = E[0];
  const TanE& b = E[1];
  if (a.ligne && b.ligne && std::abs(a.nx * b.ny - a.ny * b.nx) < 1e-9) {
    const int sg = a.nx * b.nx + a.ny * b.ny > 0 ? 1 : -1;
    const double db = sg * b.d, r = std::abs(a.d - db) / 2;
    if (!(r > 1e-6)) return std::nullopt;
    const double k = a.nx * x + a.ny * y - (a.d + db) / 2;
    const int s1 = a.d < db ? 1 : -1;
    Sol o;
    o.x = x - a.nx * k;
    o.y = y - a.ny * k;
    o.r = r;
    o.s = {s1, -s1 * sg};
    o.tenu = true;
    return o;
  }
  const double D = fixe(distTan(a, x, y) + distTan(b, x, y), 2);
  if (!(D > 0)) return std::nullopt;
  // arrondi vers le bas : le cercle juste assez grand pour toucher les 2 traits peut ne plus exister → on remonte d'un cran
  for (int k = 0; k < 4; k++) {
    const std::vector<Sol> c = candidats(E, true, (D + k * 0.01) / 2);
    if (c.empty()) continue;
    const Sol* best = nullptr;
    double bd = std::numeric_limits<double>::infinity();
    for (const Sol& o : c) {
      const double q = hyp(o.x - x, o.y - y);
      if (q < bd) {
        bd = q;
        best = &o;
      }
    }
    if (best) return *best;
    return std::nullopt;
  }
  return std::nullopt;
}
// skArcTanGeom : arc qui prolonge un trait, de P parti dans la direction T jusqu'à Q
struct GeoArc {
  double x, y, r, qx, qy;
  bool ccw;
};
std::optional<GeoArc> geoArcTan(double bx, double by, double tx, double ty, bool cercle, double Qx, double Qy, bool arrondi) {
  const double dx = Qx - bx, dy = Qy - by;
  const int sens = cercle && dx * tx + dy * ty < 0 ? -1 : 1;  // sur un cercle : on part du côté de l'arrivée
  const double nx = -ty * sens, ny = tx * sens, h = dx * nx + dy * ny, d2 = dx * dx + dy * dy;
  if (!(d2 > 1e-12) || std::abs(h) < 1e-6 * std::sqrt(d2)) return std::nullopt;  // dans le prolongement : ce serait une droite
  const int sg = h > 0 ? 1 : -1;
  double r = d2 / (2 * std::abs(h)), cx = bx + sg * nx * r, cy = by + sg * ny * r, qx = Qx, qy = Qy;
  if (arrondi && fixe(r, 2) > 0) {
    r = fixe(r, 2);
    cx = bx + sg * nx * r;
    cy = by + sg * ny * r;
    const double l = hyp(Qx - cx, Qy - cy), k = l != 0 ? l : 1;
    qx = cx + (Qx - cx) / k * r;
    qy = cy + (Qy - cy) / k * r;
  }
  return GeoArc{cx, cy, r, qx, qy, h > 0};
}
// skArcEntre : le morceau du cercle-solution entre ses 2 contacts, le plus court
struct Entre {
  std::vector<Pt> f;
  double a1, a2;
  bool sw;
};
std::optional<Entre> arcEntre(const std::vector<TanE>& E, const Sol& sol) {
  Entre o;
  for (const TanE& e : E) o.f.push_back(piedTan(e, sol));
  const double a0 = m_atan2(o.f[0].y - sol.y, o.f[0].x - sol.x), a1 = m_atan2(o.f[1].y - sol.y, o.f[1].x - sol.x);
  double d = std::fmod(a1 - a0, 2 * PI_);
  if (d < 0) d += 2 * PI_;
  if (d < 1e-6 || 2 * PI_ - d < 1e-6) return std::nullopt;  // contacts confondus : pas d'arc
  o.sw = d > PI_ + 1e-9;
  o.a1 = o.sw ? a1 : a0;
  o.a2 = o.sw ? a0 : a1;
  return o;
}
// skTrArcPts
std::vector<Pt> ptsArc(double cx, double cy, double r, double a1, double a2) {
  double d = std::fmod(a2 - a1, 2 * PI_);
  if (d <= 0) d += 2 * PI_;
  const int n = jsmax(8, std::ceil(d / (PI_ / 32)));
  std::vector<Pt> out;
  for (int k = 0; k <= n; k++) {
    const double t = a1 + d * k / n;
    out.push_back({cx + r * m_cos(t), cy + r * m_sin(t)});
  }
  return out;
}
std::string aDeux(double v) {
  char b[64];
  snprintf(b, sizeof b, "%.2f", fixe(v, 2));
  return b;
}
}  // namespace

// La géométrie retenue par l'aperçu, reprise telle quelle au dernier clic
struct Dessin::GeoTrace {
  bool ok = false, aW = false, aSol = false;
  double w = 0;
  Sol sol;
  std::vector<std::string> ids;
};

// ---------- Le bandeau ----------
const char* Dessin::titreModes(Outil o) {
  switch (o) {
    case OBLONG: return "Oblong par";
    case RECTANGLE: return "Rectangle par";
    case CERCLE: return "Cercle par";
    case ARC: return "Arc par";
    default: return nullptr;
  }
}
const std::vector<Dessin::ModeTrace>& Dessin::modesDe(Outil o) {
  static const std::vector<ModeTrace> slot = {{"centres", "2 centres", "Cliquez les 2 centres des demi-cercles, puis le rayon"},
                                              {"bouts", "2 extrémités", "Cliquez les 2 points extrêmes des demi-cercles, puis le rayon"},
                                              {"milieu", "Centre", "Cliquez le milieu, l’écartement (un centre de demi-cercle), puis le rayon"}};
  static const std::vector<ModeTrace> rect = {{"coins", "2 coins", "Cliquez 2 coins opposés"},
                                              {"centre", "Centre et coin", "Cliquez le centre, puis un coin"},
                                              {"3pts", "3 points", "Cliquez les 2 bouts d’un côté, dans n’importe quelle direction, puis la largeur"}};
  static const std::vector<ModeTrace> cercle = {{"centre", "Centre et rayon", "Cliquez le centre, puis un point du tour"},
                                                {"2pts", "2 points", "Cliquez les 2 bouts d’un diamètre"},
                                                {"3pts", "3 points", "Cliquez 3 points du tour"},
                                                {"tangent", "Tangent", "Cliquez 2 traits, puis un 3e trait ou le vide pour la taille"}};
  static const std::vector<ModeTrace> arc = {{"centre", "Centre et 2 points", "Cliquez le centre, le départ, puis l’arrivée"},
                                             {"3pts", "3 points", "Cliquez le départ, l’arrivée, puis un point de passage"},
                                             {"tangent", "Tangent", "Cliquez un trait, du côté du bout d’où partir, puis l’arrivée ; ou 2 traits, puis la taille"}};
  static const std::vector<ModeTrace> rien;
  return o == OBLONG ? slot : o == RECTANGLE ? rect : o == CERCLE ? cercle : o == ARC ? arc : rien;
}
const std::string& Dessin::modeDe(Outil o) {
  static const std::string rien;
  return o == OBLONG ? modeOblong_ : o == RECTANGLE ? modeRect_ : o == CERCLE ? modeCercle_ : o == ARC ? modeArc_ : rien;
}
std::string Dessin::messageTrace(Outil o) {  // skTraceMsg
  if (o == OBLONG) return msgSlot(modeOblong_, 0);
  if (!titreModes(o)) return "";
  return msgTrace(o, modeDe(o), 0);
}
void Dessin::choisirMode(Outil o, const std::string& k) {  // skModeSet
  if (o == OBLONG) {
    modeOblong_ = k;
    if (bas_.actif && slot_.actif && brouillon_.sorte == Brouillon::B_OBLONG) brouillon_.mode = k;
    else message(msgSlot(k, 0));
    return;
  }
  (o == RECTANGLE ? modeRect_ : o == CERCLE ? modeCercle_ : modeArc_) = k;
  dyn_ = Saisie{};
  annulerTrace();  // le tracé commencé d'une autre façon est abandonné
  message(messageTrace(o));
}
void Dessin::centresOblong(const std::string& mode, Pt A, Pt B, double r, Pt& c1, Pt& c2) {  // skSlotCentres
  if (mode == "milieu") {
    c1 = {2 * A.x - B.x, 2 * A.y - B.y};
    c2 = B;
    return;
  }
  if (mode == "bouts") {
    const double h = hyp(B.x - A.x, B.y - A.y), L = h != 0 ? h : 1, ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
    c1 = {A.x + ux * r, A.y + uy * r};
    c2 = {B.x - ux * r, B.y - uy * r};
    return;
  }
  c1 = A;
  c2 = B;
}

// ---------- Oblong ----------
bool Dessin::rayonOblongOk(const Pt& A, const Pt& B, double r) const {  // skSlotRayonOk
  if (!(r > longueurMini())) return false;
  const double L = hyp(B.x - A.x, B.y - A.y);
  return modeOblong_ != "bouts" || L - 2 * r > longueurMini();
}
Dessin::Accroche Dessin::viser(double wx, double wy, const Pt* from, double& x, double& y) const {  // skSlotAim
  const Accroche s = accroche(wx, wy, bas_.actif ? bas_.pid : std::string());
  if (s) {
    x = s.x;
    y = s.y;
    return s;
  }
  x = wx;
  y = wy;
  if (grille) {
    x = surGrille(x);
    y = surGrille(y);
  }
  if (from) {
    const double a = m_atan2(y - from->y, x - from->x), k = std::floor(a / (PI_ / 2) + 0.5);
    if (std::abs(a - k * PI_ / 2) < SLOT_PLAT) {
      if (std::fmod(k, 2) != 0) x = from->x;
      else y = from->y;
    }
  }
  return s;
}
void Dessin::oblongDepart(double wx, double wy) {  // skSlotStart
  const bool fa = static_cast<bool>(accroche(wx, wy));
  const std::string pid = pointAccroche(wx, wy);
  const Pt S = *s_.point(pid);
  bas_ = Bas{};
  bas_.actif = true;
  bas_.pid = pid;
  bas_.x = S.x;
  bas_.y = S.y;
  slot_ = SlotEnCours{};
  slot_.actif = true;
  slot_.fa = fa;
  message(msgSlot(modeOblong_, 1));
}
namespace {
double rayonOblong(const Pt& A, const Pt& B, double x, double y) {  // skSlotRayon
  const double h = hyp(B.x - A.x, B.y - A.y), L = h != 0 ? h : 1;
  return std::abs((x - A.x) * (A.y - B.y) + (y - A.y) * (B.x - A.x)) / L;
}
}  // namespace
void Dessin::oblongBouge(double wx, double wy) {  // skSlotMove
  const Pt A{bas_.x, bas_.y};
  double x, y;
  const Accroche s = viser(wx, wy, slot_.aP2 ? nullptr : &A, x, y);
  aMarque_ = static_cast<bool>(s);
  marque_ = {s.x, s.y};
  brouillon_ = Brouillon{};
  brouillon_.sorte = Brouillon::B_OBLONG;
  brouillon_.mode = modeOblong_;
  brouillon_.A = A;
  if (!slot_.aP2) {
    brouillon_.B = {x, y};
    return;
  }
  brouillon_.B = slot_.p2;
  brouillon_.r = rayonOblong(A, slot_.p2, x, y);
  brouillon_.ok = rayonOblongOk(A, slot_.p2, brouillon_.r);
}
void Dessin::oblongRelache(double wx, double wy) {  // skSlotUp
  const Pt A{bas_.x, bas_.y};
  double x, y;
  const Accroche s = viser(wx, wy, slot_.aP2 ? nullptr : &A, x, y);
  if (!slot_.aP2) {  // 1er clic relâché sur place : le 1er point reste armé ; sinon c'est le 2e point
    if (hyp(x - A.x, y - A.y) <= longueurMini()) {
      message(msgSlot(modeOblong_, 1));
      return;
    }
    slot_.aP2 = true;
    slot_.p2 = {x, y};
    slot_.rawX = wx;
    slot_.rawY = wy;
    slot_.p2Accroche = static_cast<bool>(s);
    message("Oblong : cliquez pour le rayon.");
    oblongBouge(wx, wy);
    return;
  }
  const double r = rayonOblong(A, slot_.p2, x, y);
  if (!rayonOblongOk(A, slot_.p2, r)) {
    message(modeOblong_ == "bouts" ? "Oblong : rayon trop grand pour cette longueur — visez plus près de l’axe." : "Oblong : éloignez le curseur de l’axe pour donner le rayon.");
    return;
  }
  pousser();
  const std::string b = slot_.p2Accroche ? pointAccroche(slot_.rawX, slot_.rawY) : ajouterPoint(slot_.p2.x, slot_.p2.y);
  const bool fait = creerOblong(modeOblong_, bas_.pid, b, r, slot_.fa, slot_.p2Accroche);
  bas_ = Bas{};
  slot_ = SlotEnCours{};
  brouillon_ = Brouillon{};
  aMarque_ = false;
  apresEdition();
  message(fait ? "Oblong créé, cotes posées — " + suiteMsg(msgSlot(modeOblong_, 0)) + " du suivant (Échap = fin)." : "Oblong : forme impossible avec ces points.");
}
bool Dessin::creerOblong(const std::string& mode, const std::string& a, const std::string& b, double r0, bool fa, bool fb) {  // skSlotCreate
  if (!s_.point(a) || !s_.point(b)) return false;
  Pt& A = s_.points.at(a);
  Pt& B = s_.points.at(b);
  const double r = fixe(r0, 2);
  double L = hyp(B.x - A.x, B.y - A.y);
  if (!(L > 1e-6)) return false;
  // écart cliqué arrondi, en déplaçant l'extrémité libre (2 points accrochés : la cote prend l'écart exact)
  const double ux0 = (B.x - A.x) / L, uy0 = (B.y - A.y) / L;
  if (!fb || !fa) {
    const double Ln = fixe(L, 2);
    if (Ln > 0) {
      if (!fb) {
        B.x = A.x + ux0 * Ln;
        B.y = A.y + uy0 * Ln;
      } else {
        A.x = B.x - ux0 * Ln;
        A.y = B.y - uy0 * Ln;
      }
      L = Ln;
    }
  }
  if (mode == "bouts" && !(L - 2 * r > 1e-6)) return false;
  Pt c1, c2;
  centresOblong(mode, A, B, r, c1, c2);
  const double d = hyp(c2.x - c1.x, c2.y - c1.y);
  if (!(d > 1e-6)) return false;
  const double ux = (c2.x - c1.x) / d, uy = (c2.y - c1.y) / d, nx = -uy * r, ny = ux * r;
  const bool h = std::abs(uy) < 1e-9, v = std::abs(ux) < 1e-9;
  const std::string pc1 = mode == "centres" ? a : ajouterPoint(c1.x, c1.y);
  const std::string pc2 = mode == "bouts" ? ajouterPoint(c2.x, c2.y) : b;
  const std::string p1 = pointA(c1.x + nx, c1.y + ny);
  const std::string p2 = pointA(c2.x + nx, c2.y + ny);
  const std::string p3 = pointA(c2.x - nx, c2.y - ny);
  const std::string p4 = pointA(c1.x - nx, c1.y - ny);
  const auto ligne = [&](const std::string& q1, const std::string& q2, bool construction) {
    Entite e;
    e.id = nouvelE();
    e.t = "line";
    e.p1 = q1;
    e.p2 = q2;
    e.construction = construction;
    return e;
  };
  const auto arc = [&](const std::string& c, const std::string& pa, const std::string& pb) {
    Entite e;
    e.id = nouvelE();
    e.t = "arc";
    e.pc = c;
    e.pa = pa;
    e.pb = pb;
    e.r = r;
    return e;
  };
  const Entite l1 = ligne(p1, p2, false);
  const Entite l2 = ligne(p4, p3, false);
  const Entite a1 = arc(pc1, p1, p4);
  const Entite a2 = arc(pc2, p3, p2);
  const Entite axe = ligne(pc1, pc2, true);
  s_.entites.insert(s_.entites.end(), {l1, l2, a1, a2, axe});
  structure_ = true;
  // seuls les points cliqués s'accrochent : les autres ne s'attachent qu'à ce qui les touche exactement
  for (const std::string* p : {&p1, &p2, &p3, &p4}) {
    const Pt q = *s_.point(*p);
    accrocher(*p, q.x, q.y, 1e-3);
  }
  {
    const Pt q = *s_.point(a);
    accrocher(a, q.x, q.y, fa ? -1 : 1e-3);
  }
  {
    const Pt q = *s_.point(b);
    accrocher(b, q.x, q.y, fb ? -1 : 1e-3);
  }
  const char* dir = h ? "h" : v ? "v" : nullptr;
  const auto lierSens = [&](const Entite& l) {
    Contrainte c = contrainte(dir);
    c.line = l.id;
    lier(c);
  };
  if (dir) {
    lierSens(l1);
    lierSens(l2);
    lierSens(axe);
  } else {
    for (const Entite* l : {&l1, &l2}) {
      Contrainte c = contrainte("parallel");
      c.a = axe.id;
      c.b = l->id;
      lier(c);
    }
  }
  const auto tangente = [&](const Entite& l, const Entite& e) {
    Contrainte c = contrainte("tangent");
    c.line = l.id;
    c.ent = e.id;
    lier(c);
  };
  tangente(l1, a1);
  tangente(l1, a2);
  tangente(l2, a1);
  tangente(l2, a2);
  {
    Contrainte c = contrainte("equal");
    c.a = a1.id;
    c.b = a2.id;
    lier(c);
  }
  const auto longueur = [&](const std::string& ligneId, double value) {
    Cote o;
    o.id = nouvelE();
    o.type = "length";
    o.line = ligneId;
    o.value = value;
    s_.cotes.push_back(std::move(o));
  };
  if (mode == "bouts") {
    // hors-tout : droite de construction d'un bout à l'autre, centres dessus, bouts sur les arcs
    const Entite hors = ligne(a, b, true);
    s_.entites.push_back(hors);
    if (dir) lierSens(hors);
    for (const std::string* p : {&pc1, &pc2}) {
      Contrainte c = contrainte("online");
      c.p = *p;
      c.line = hors.id;
      lier(c);
    }
    {
      Contrainte c = contrainte("oncircle");
      c.p = a;
      c.ent = a1.id;
      lier(c);
    }
    {
      Contrainte c = contrainte("oncircle");
      c.p = b;
      c.ent = a2.id;
      lier(c);
    }
    longueur(hors.id, fixe(L, fa && fb ? 6 : 2));
  } else {
    if (mode == "milieu") {
      Contrainte c = contrainte("midpoint");
      c.p = a;
      c.line = axe.id;
      lier(c);
    }
    longueur(axe.id, fixe(d, fa && fb ? 6 : 2));
  }
  coteRond("radius", a1.id, r);
  return true;
}
void Dessin::coteRond(const char* type, const std::string& ent, double value) {
  Cote o;
  o.id = nouvelE();
  o.type = type;
  o.ent = ent;
  o.value = value;
  s_.cotes.push_back(std::move(o));
}

// ---------- Les nouveaux tracés ----------
bool Dessin::trActif(Outil o) {  // skTrActif
  return (o == RECTANGLE && modeRect_ == "3pts") || (o == CERCLE && modeCercle_ != "centre") || (o == ARC && modeArc_ != "centre");
}
std::optional<Entite> Dessin::trEnt(double x, double y, const std::vector<std::string>& sauf) const {  // skTrEnt
  const Entite* e = entiteProche(x, y, SNAP_);
  if (!e || std::find(sauf.begin(), sauf.end(), e->id) != sauf.end()) return std::nullopt;
  if (e->t == "line" || e->t == "circle" || e->t == "arc") return *e;
  return std::nullopt;
}
bool Dessin::trBoutDe(const Entite& E, const std::string& pid, ClicTrace& o) const {  // skTrBoutDe
  const Pt* P = s_.point(pid);
  if (!P) return false;
  double tx, ty;
  if (E.t == "line") {
    const Pt* O = s_.point(E.p1 == pid ? E.p2 : E.p1);
    if (!O) return false;
    const double L = hyp(P->x - O->x, P->y - O->y);
    if (!(L > 1e-9)) return false;
    tx = (P->x - O->x) / L;
    ty = (P->y - O->y) / L;
  } else {
    const Pt* C = s_.point(E.pc);
    if (!C) return false;
    const double L = hyp(P->x - C->x, P->y - C->y);
    if (!(L > 1e-9)) return false;
    const int sg = E.pb == pid ? 1 : -1;  // l'arc tourne dans le sens direct, de pa vers pb
    tx = -sg * (P->y - C->y) / L;
    ty = sg * (P->x - C->x) / L;
  }
  o = ClicTrace{};
  o.pid = pid;
  o.ent = E.id;
  o.x = P->x;
  o.y = P->y;
  o.tx = tx;
  o.ty = ty;
  return true;
}
bool Dessin::trBout(double x, double y, ClicTrace& o) const {  // skTrBout
  const std::string pid = pointProche(x, y, SNAP_);
  if (!pid.empty()) {
    const Entite* E = nullptr;  // le dernier tracé d'abord (chaîne qu'on continue), le trait de construction seulement s'il n'y a que lui
    for (size_t i = s_.entites.size(); i-- > 0;) {
      const Entite& e = s_.entites[i];
      if (!((e.t == "line" && (e.p1 == pid || e.p2 == pid)) || (e.t == "arc" && (e.pa == pid || e.pb == pid)))) continue;
      if (!E || (E->construction && !e.construction)) E = &e;
      if (!E->construction) break;
    }
    if (E) return trBoutDe(*E, pid, o);
  }
  const std::optional<Entite> e = trEnt(x, y, {});
  if (!e) return false;
  if (e->t == "circle") {
    const Pt* C = s_.point(e->pc);
    if (!C) return false;
    const double d = hyp(x - C->x, y - C->y);
    if (!(d > 1e-9)) return false;
    const double ux = (x - C->x) / d, uy = (y - C->y) / d;
    o = ClicTrace{};
    o.cercle = true;
    o.ent = e->id;
    o.x = C->x + ux * e->r;
    o.y = C->y + uy * e->r;
    o.tx = -uy;
    o.ty = ux;
    return true;
  }
  const std::string p1 = e->t == "line" ? e->p1 : e->pa, p2 = e->t == "line" ? e->p2 : e->pb;
  const Pt* A = s_.point(p1);
  const Pt* B = s_.point(p2);
  if (!A || !B) return false;
  return trBoutDe(*e, hyp(x - A->x, y - A->y) <= hyp(x - B->x, y - B->y) ? p1 : p2, o);
}
Dessin::ClicTrace Dessin::trViser(const Trace* tr, double wx, double wy) const {  // skTrAim
  const Pt* aplat = nullptr;
  Pt depart;
  if (tr && tr->outil == RECTANGLE && tr->pts.size() == 1) {
    depart = {tr->pts[0].x, tr->pts[0].y};
    aplat = &depart;
  }
  ClicTrace m;
  m.acc = viser(wx, wy, aplat, m.x, m.y);
  m.rx = wx;
  m.ry = wy;
  return m;
}
std::optional<Entite> Dessin::trDeuxieme(const ClicTrace& m, const ClicTrace& A) const {  // skTrDeuxieme
  if (m.acc && m.acc.sorte != Accroche::MILIEU) return std::nullopt;  // un point cliqué reste une arrivée, le milieu d'un trait désigne ce trait
  return trEnt(m.rx, m.ry, {A.ent});
}
Dessin::Brouillon Dessin::trApercu(const Trace& tr, const ClicTrace& m, GeoTrace* geo) const {  // skTrDraft
  const Outil tool = tr.outil;
  const std::string& mode = tr.mode;
  const std::vector<ClicTrace>& pts = tr.pts;
  const ClicTrace& A = pts[0];
  const size_t n = pts.size();
  const double min = longueurMini();
  GeoTrace vide;
  GeoTrace& g0 = geo ? *geo : vide;
  Brouillon d;
  d.sorte = Brouillon::B_TRACE;
  for (const ClicTrace& p : pts)
    if (p.ent.empty() || !p.pid.empty() || p.cercle) d.marques.push_back({p.x, p.y});
  if (mode != "tangent") d.marques.push_back({m.x, m.y});
  const Pt MA{A.x, A.y}, Mm{m.x, m.y};
  const auto surligner = [&](const std::vector<std::string>& ids) { d.ents = ids; };
  const auto toTan = [&](const std::vector<std::string>& ids, std::vector<TanE>& E) {
    E.clear();
    for (const std::string& id : ids) {
      auto e = elemTan(s_, id);
      if (!e) return false;
      E.push_back(*e);
    }
    return true;
  };
  const auto idsDe = [&]() {
    std::vector<std::string> ids;
    for (const ClicTrace& p : pts) ids.push_back(p.ent);
    return ids;
  };
  if (tool == RECTANGLE) {
    if (n == 1) {
      d.poly = {MA, Mm};
      d.etiquette = aDeux(hyp(m.x - A.x, m.y - A.y));
      return d;
    }
    const ClicTrace& B = pts[1];
    const double h = hyp(B.x - A.x, B.y - A.y), L = h != 0 ? h : 1, nx = -(B.y - A.y) / L, ny = (B.x - A.x) / L, w = (m.x - B.x) * nx + (m.y - B.y) * ny;
    d.poly = {MA, {B.x, B.y}, {B.x + nx * w, B.y + ny * w}, {A.x + nx * w, A.y + ny * w}};
    d.ferme = true;
    d.etiquette = aDeux(L) + " × " + aDeux(std::abs(w));
    d.ok = std::abs(w) > min;
    g0.w = w;
    return d;
  }
  if (tool == CERCLE && mode == "2pts") {
    const double r = hyp(m.x - A.x, m.y - A.y) / 2;
    d.poly = ptsArc((A.x + m.x) / 2, (A.y + m.y) / 2, r, 0, 2 * PI_);
    d.ferme = true;
    d.etiquette = "⌀" + aDeux(2 * r);
    d.ok = 2 * r > min;
    return d;
  }
  if (tool == CERCLE && mode == "3pts") {
    if (n == 1) {
      d.poly = {MA, Mm};
      return d;
    }
    const auto g = cercle3(A.x, A.y, pts[1].x, pts[1].y, m.x, m.y);
    if (!g) {
      d.poly = {MA, {pts[1].x, pts[1].y}, Mm};
      return d;
    }
    d.poly = ptsArc(g->x, g->y, g->r, 0, 2 * PI_);
    d.ferme = true;
    d.etiquette = "⌀" + aDeux(2 * g->r);
    d.ok = g->r > min;
    return d;
  }
  if (tool == CERCLE) {  // tangent
    std::vector<std::string> ids = idsDe();
    if (n == 1) {
      const auto e = trEnt(m.rx, m.ry, ids);
      if (e) ids.push_back(e->id);
      surligner(ids);
      return d;
    }
    std::vector<TanE> E;
    surligner(ids);
    if (!toTan(ids, E)) return d;
    std::optional<Sol> sol;
    std::vector<std::string> all = ids;
    const auto e3 = trEnt(m.rx, m.ry, ids);
    if (e3) {
      const auto T = elemTan(s_, e3->id);
      if (T) {  // skTan3Sol : parmi les solutions, celle dont les contacts tombent près des clics
        std::vector<TanE> E3 = E;
        E3.push_back(*T);
        const Sol* best = nullptr;
        double bd = std::numeric_limits<double>::infinity();
        const std::vector<Sol> cand = candidats(E3, false, 0);
        for (const Sol& o : cand) {
          double q = 0;
          for (size_t i = 0; i < E3.size(); i++) {
            const Pt f = piedTan(E3[i], o);
            const double cx = i < pts.size() ? pts[i].x : m.rx, cy = i < pts.size() ? pts[i].y : m.ry;
            q += hyp(f.x - cx, f.y - cy);
          }
          if (q < bd) {
            bd = q;
            best = &o;
          }
        }
        if (best) {
          sol = *best;
          all.push_back(e3->id);
        }
      }
    }
    if (!sol) sol = sol2(E, m.rx, m.ry);
    surligner(all);
    if (!sol) return d;
    d.poly = ptsArc(sol->x, sol->y, sol->r, 0, 2 * PI_);
    d.ferme = true;
    d.etiquette = "⌀" + aDeux(2 * sol->r);
    d.ok = sol->r > min;
    g0.sol = *sol;
    g0.aSol = true;
    g0.ids = all;
    return d;
  }
  if (mode == "3pts") {  // arc
    if (n == 1) {
      d.poly = {MA, Mm};
      d.etiquette = aDeux(hyp(m.x - A.x, m.y - A.y));
      return d;
    }
    const ClicTrace& B = pts[1];
    const auto g = cercle3(A.x, A.y, m.x, m.y, B.x, B.y);
    if (!g) {
      d.poly = {MA, {B.x, B.y}};
      return d;
    }
    const double a1 = m_atan2(A.y - g->y, A.x - g->x), a2 = m_atan2(B.y - g->y, B.x - g->x), am = m_atan2(m.y - g->y, m.x - g->x);
    d.poly = dansArc(am, a1, a2) ? ptsArc(g->x, g->y, g->r, a1, a2) : ptsArc(g->x, g->y, g->r, a2, a1);
    d.etiquette = "R" + aDeux(g->r);
    d.ok = g->r > min;
    return d;
  }
  // arc tangent à 2 traits
  if (tr.deux) {
    const std::vector<std::string> ids = idsDe();
    std::vector<TanE> E;
    surligner(ids);
    d.marques.clear();
    if (!toTan(ids, E)) return d;
    const auto sol = sol2(E, m.rx, m.ry);
    const auto g = sol ? arcEntre(E, *sol) : std::nullopt;
    if (!g) return d;
    d.poly = ptsArc(sol->x, sol->y, sol->r, g->a1, g->a2);
    d.etiquette = "R" + aDeux(sol->r);
    d.ok = sol->r > min;
    g0.sol = *sol;
    g0.aSol = true;
    g0.ids = ids;
    return d;
  }
  // arc tangent : on vise un 2e trait, ou l'arrivée
  surligner({A.ent});
  const auto e2 = trDeuxieme(m, A);
  if (e2) {
    surligner({A.ent, e2->id});
    return d;
  }
  const auto g = geoArcTan(A.x, A.y, A.tx, A.ty, A.cercle, m.x, m.y, !m.acc);
  if (!g) {
    d.poly = {MA, Mm};
    return d;
  }
  const double a1 = m_atan2(A.y - g->y, A.x - g->x), a2 = m_atan2(g->qy - g->y, g->qx - g->x);
  d.poly = g->ccw ? ptsArc(g->x, g->y, g->r, a1, a2) : ptsArc(g->x, g->y, g->r, a2, a1);
  d.etiquette = "R" + aDeux(g->r);
  d.ok = g->r > min;
  return d;
}
void Dessin::trSurlignes(Brouillon& d) const {  // les traits choisis, surlignés (skTrDrawDraft)
  for (const std::string& id : d.ents) {
    const Entite* e = nullptr;
    for (const Entite& q : s_.entites)
      if (q.id == id) e = &q;
    if (!e) continue;
    if (e->t == "line") {
      const Pt* a = s_.point(e->p1);
      const Pt* b = s_.point(e->p2);
      if (a && b) d.surlignes.push_back({*a, *b});
    } else if (e->t == "circle") {
      if (const Pt* C = s_.point(e->pc)) d.surlignes.push_back(ptsArc(C->x, C->y, e->r, 0, 2 * PI_));
    } else if (e->t == "arc") {
      const Pt* C = s_.point(e->pc);
      An an;
      if (C && anglesArc2(s_, *e, an)) d.surlignes.push_back(ptsArc(C->x, C->y, e->r, an.a1, an.a2));
    }
  }
}
void Dessin::trMarque(const ClicTrace* m) {  // skTrMarque
  aMarque_ = m && m->acc;
  if (aMarque_) marque_ = {m->acc.x, m->acc.y};
}
void Dessin::trBouge(double wx, double wy) {  // skTrMove
  if (!tr_.actif) {  // avant le 1er clic : on montre ce que le clic prendrait
    const std::string& mode = modeDe(outil_);
    brouillon_ = Brouillon{};
    aMarque_ = false;
    if (mode == "tangent" && outil_ == CERCLE) {
      if (const auto e = trEnt(wx, wy, {})) {
        brouillon_.sorte = Brouillon::B_TRACE;
        brouillon_.ents = {e->id};
      }
    } else if (mode == "tangent") {
      ClicTrace b;
      if (trBout(wx, wy, b)) {
        brouillon_.sorte = Brouillon::B_TRACE;
        brouillon_.ents = {b.ent};
        aMarque_ = true;
        marque_ = {b.x, b.y};
      }
    } else {
      const ClicTrace m = trViser(nullptr, wx, wy);
      trMarque(&m);
    }
    trSurlignes(brouillon_);
    return;
  }
  const ClicTrace m = trViser(&tr_, wx, wy);
  trMarque(tr_.mode == "tangent" && (tr_.outil == CERCLE || tr_.deux) ? nullptr : &m);
  brouillon_ = trApercu(tr_, m, nullptr);
  trSurlignes(brouillon_);
}
void Dessin::trEnfonce(double wx, double wy) {  // skTrDown
  if (bas_.actif) return;
  const std::string& mode = modeDe(outil_);
  ClicTrace c;
  if (mode == "tangent" && outil_ == CERCLE) {
    const auto e = trEnt(wx, wy, {});
    if (!e) {
      message(std::string(msgTrace(CERCLE, "tangent", 0)) + " (une ligne, un cercle ou un arc)");
      return;
    }
    c.ent = e->id;
    c.x = wx;
    c.y = wy;
    c.rx = wx;
    c.ry = wy;
  } else if (mode == "tangent") {
    if (!trBout(wx, wy, c)) {
      message(msgTrace(ARC, "tangent", 0));
      return;
    }
    c.rx = wx;
    c.ry = wy;
  } else {
    c = trViser(nullptr, wx, wy);
  }
  bas_ = Bas{};
  bas_.actif = true;
  bas_.x = c.x;
  bas_.y = c.y;
  tr_ = Trace{};
  tr_.actif = true;
  tr_.outil = outil_;
  tr_.mode = mode;
  tr_.pts = {c};
  message(msgTrace(outil_, mode, 1));
}
void Dessin::trPid(ClicTrace& c) {  // skTrPid : le point cliqué sur une géométrie n'existe vraiment qu'à la fin du tracé
  if (!c.acc) return;
  c.pid = pointAccroche(c.rx, c.ry);
  const Pt& p = *s_.point(c.pid);
  c.x = p.x;
  c.y = p.y;
}
void Dessin::trAttache(const ClicTrace& c, const std::string& pid) {  // skTrAttache
  const Pt* q = s_.point(pid);
  if (q && c.pid.empty()) {
    const Pt v = *q;
    accrocher(pid, v.x, v.y, -1);
  }
}
void Dessin::trLien(const std::string& id, const std::string& cible, bool inner) {  // skTanLien
  const Entite* e = entite(id);
  if (e && e->t == "line") {
    Contrainte c = contrainte("tangent");
    c.line = id;
    c.ent = cible;
    lier(c);
  } else {
    Contrainte c = contrainte("tangent2");
    c.a = id;
    c.b = cible;
    c.inner = inner;
    lier(c);
  }
}
std::string Dessin::trCercle(double x, double y, double r) {  // skTrCercle
  Entite e;
  e.id = nouvelE();
  e.t = "circle";
  e.pc = ajouterPoint(x, y);
  e.r = r;
  s_.entites.push_back(e);
  structure_ = true;
  return e.id;
}
void Dessin::trOnCircle(const std::string& p, const std::string& ent) {
  Contrainte c = contrainte("oncircle");
  c.p = p;
  c.ent = ent;
  lier(c);
}
bool Dessin::trRect3(const ClicTrace& a, const ClicTrace& b, double w0) {  // skRect3Create
  double ax = a.x, ay = a.y, bx = b.x, by = b.y, L = hyp(bx - ax, by - ay);
  if (!(L > 1e-6)) return false;
  const double ux = (bx - ax) / L, uy = (by - ay) / L;
  if (a.pid.empty() || b.pid.empty()) {  // longueur ronde, en déplaçant le bout libre
    const double Ln = fixe(L, 2);
    if (Ln > 0) {
      if (b.pid.empty()) {
        bx = ax + ux * Ln;
        by = ay + uy * Ln;
      } else {
        ax = bx - ux * Ln;
        ay = by - uy * Ln;
      }
      L = Ln;
    }
  }
  const double w = fixe(w0, 2);
  if (w == 0) return false;
  const double nx = -uy * w, ny = ux * w;
  const std::string pa = !a.pid.empty() ? a.pid : ajouterPoint(ax, ay);
  const std::string pb = !b.pid.empty() ? b.pid : ajouterPoint(bx, by);
  const std::string pc = pointA(bx + nx, by + ny);
  const std::string pd = pointA(ax + nx, ay + ny);
  const auto ligne = [&](const std::string& q1, const std::string& q2) {
    Entite e;
    e.id = nouvelE();
    e.t = "line";
    e.p1 = q1;
    e.p2 = q2;
    return e;
  };
  const Entite l1 = ligne(pa, pb);
  const Entite l2 = ligne(pb, pc);
  const Entite l3 = ligne(pc, pd);
  const Entite l4 = ligne(pd, pa);
  s_.entites.insert(s_.entites.end(), {l1, l2, l3, l4});
  structure_ = true;
  trAttache(a, pa);
  trAttache(b, pb);
  for (const std::string* p : {&pc, &pd}) {
    const Pt q = *s_.point(*p);
    accrocher(*p, q.x, q.y, 1e-3);
  }
  const auto deuxLignes = [&](const char* t, const Entite& x, const Entite& y) {
    Contrainte c = contrainte(t);
    c.a = x.id;
    c.b = y.id;
    lier(c);
  };
  if (std::abs(uy) < 1e-9 || std::abs(ux) < 1e-9) {  // à plat : un rectangle ordinaire
    const char* dh = std::abs(uy) < 1e-9 ? "h" : "v";
    const char* dv = std::abs(uy) < 1e-9 ? "v" : "h";
    const auto sens = [&](const char* t, const Entite& l) {
      Contrainte c = contrainte(t);
      c.line = l.id;
      lier(c);
    };
    sens(dh, l1);
    sens(dh, l3);
    sens(dv, l2);
    sens(dv, l4);
  } else {
    deuxLignes("parallel", l1, l3);
    deuxLignes("parallel", l2, l4);
    deuxLignes("perpendicular", l1, l2);
  }
  const auto cote = [&](const Entite& l, double v) {
    Cote o;
    o.id = nouvelE();
    o.type = "length";
    o.line = l.id;
    o.value = v;
    s_.cotes.push_back(std::move(o));
  };
  cote(l1, fixe(L, !a.pid.empty() && !b.pid.empty() ? 6 : 2));
  cote(l2, std::abs(w));
  return true;
}
bool Dessin::trCercle2Pts(const ClicTrace& a, const ClicTrace& b) {  // skCercle2Pts
  const double d = hyp(b.x - a.x, b.y - a.y);
  if (!(d > 1e-6)) return false;
  const int n = (a.pid.empty() ? 0 : 1) + (b.pid.empty() ? 0 : 1);
  const double O = n ? d : fixe(d, 2);
  const std::string e = trCercle((a.x + b.x) / 2, (a.y + b.y) / 2, O / 2);
  if (n == 2) {  // 2 points existants : un vrai diamètre, qui les suit
    Entite dia;
    dia.id = nouvelE();
    dia.t = "line";
    dia.p1 = a.pid;
    dia.p2 = b.pid;
    dia.construction = true;
    s_.entites.push_back(dia);
    Contrainte c = contrainte("midpoint");
    c.p = entite(e)->pc;
    c.line = dia.id;
    lier(c);
    trOnCircle(a.pid, e);
    return true;
  }
  if (n == 1) trOnCircle(!a.pid.empty() ? a.pid : b.pid, e);
  coteRond("diameter", e, fixe(O, 2));
  return true;
}
bool Dessin::trCercle3Pts(const ClicTrace& a, const ClicTrace& b, const ClicTrace& c) {  // skCercle3Pts
  const auto g = cercle3(a.x, a.y, b.x, b.y, c.x, c.y);
  if (!g) return false;
  std::vector<std::string> tenus;
  for (const ClicTrace* q : {&a, &b, &c})
    if (!q->pid.empty()) tenus.push_back(q->pid);
  const double O = tenus.size() == 2 ? 2 * g->r : fixe(2 * g->r, 2);
  if (!(O > 0)) return false;
  const std::string e = trCercle(g->x, g->y, !tenus.empty() ? g->r : O / 2);
  for (const std::string& p : tenus) trOnCircle(p, e);
  if (tenus.size() < 3) coteRond("diameter", e, fixe(O, tenus.size() == 2 ? 6 : 2));
  return true;
}
bool Dessin::trArc3Pts(const ClicTrace& a, const ClicTrace& b, const ClicTrace& m) {  // skArc3Pts
  const auto g = cercle3(a.x, a.y, m.x, m.y, b.x, b.y);
  if (!g) return false;
  const double a1 = m_atan2(a.y - g->y, a.x - g->x), a2 = m_atan2(b.y - g->y, b.x - g->x), am = m_atan2(m.y - g->y, m.x - g->x);
  const std::string pA = !a.pid.empty() ? a.pid : ajouterPoint(a.x, a.y);
  const std::string pB = !b.pid.empty() ? b.pid : ajouterPoint(b.x, b.y);
  const bool ccw = dansArc(am, a1, a2);  // un arc se décrit dans le sens direct : sinon on échange ses bouts
  Entite e;
  e.id = nouvelE();
  e.t = "arc";
  e.pc = ajouterPoint(g->x, g->y);
  e.pa = ccw ? pA : pB;
  e.pb = ccw ? pB : pA;
  e.r = g->r;
  s_.entites.push_back(e);
  structure_ = true;
  trAttache(a, pA);
  trAttache(b, pB);
  if (!m.pid.empty()) trOnCircle(m.pid, e.id);
  if (!(!a.pid.empty() && !b.pid.empty() && !m.pid.empty())) {
    const double corde = hyp(b.x - a.x, b.y - a.y) / 2, Rr = fixe(g->r, 2), R = Rr > corde ? Rr : fixe(g->r, 6);
    coteRond("radius", e.id, R);
  }
  return true;
}
bool Dessin::trArcTangent(const ClicTrace& b, const ClicTrace& q) {  // skArcTangent
  const auto g = geoArcTan(b.x, b.y, b.tx, b.ty, b.cercle, q.x, q.y, q.pid.empty());
  if (!g) return false;
  const std::string pQ = !q.pid.empty() ? q.pid : ajouterPoint(g->qx, g->qy);
  const std::string pP = !b.pid.empty() ? b.pid : ajouterPoint(b.x, b.y);
  Entite e;
  e.id = nouvelE();
  e.t = "arc";
  e.pc = ajouterPoint(g->x, g->y);
  e.pa = g->ccw ? pP : pQ;
  e.pb = g->ccw ? pQ : pP;
  e.r = g->r;
  s_.entites.push_back(e);
  structure_ = true;
  const Entite src = *entite(b.ent);
  if (b.pid.empty()) trOnCircle(pP, src.id);  // départ posé sur le cercle
  bool inner = false;
  if (src.t != "line") {
    const Pt& C = *s_.point(src.pc);
    inner = (g->x - b.x) * (C.x - b.x) + (g->y - b.y) * (C.y - b.y) > 0;
  }
  trLien(b.ent, e.id, inner);
  if (q.pid.empty()) {
    accrocher(pQ, g->qx, g->qy, -1);
    coteRond("radius", e.id, g->r);
  }
  return true;
}
void Dessin::trFin(const ClicTrace& m0) {  // skTrFin
  ClicTrace m = m0;
  const Outil tool = tr_.outil;
  const std::string mode = tr_.mode;
  GeoTrace g;
  const Brouillon d = trApercu(tr_, m, &g);
  if (!d.ok) {
    message(tool == RECTANGLE ? "Rectangle : éloignez le curseur du côté pour donner la largeur."
            : tr_.deux         ? "Arc : aucun arc ne touche ces traits ici — déplacez le curseur."
            : mode == "tangent" ? (tool == ARC ? "Arc : visez hors du prolongement du trait." : "Cercle : aucun cercle ne touche ces traits ici — déplacez le curseur.")
                                : std::string(tool == ARC ? "Arc" : "Cercle") + " : ces points sont alignés ou confondus — visez ailleurs.");
    return;
  }
  pousser();
  bool fait = false;
  std::vector<ClicTrace>& pts = tr_.pts;
  if (tool == CERCLE && mode == "tangent") {  // skCercleTangent
    const std::string e = trCercle(g.sol.x, g.sol.y, g.sol.r);
    for (size_t i = 0; i < g.ids.size(); i++) trLien(g.ids[i], e, g.sol.s[i] < 0);
    if (g.ids.size() == 2 && !g.sol.tenu) coteRond("diameter", e, fixe(2 * g.sol.r, 2));
    fait = true;
  } else if (tr_.deux) {  // skArcTangent2
    std::vector<TanE> E;
    bool tous = true;
    for (const std::string& id : g.ids) {
      const auto e = elemTan(s_, id);
      if (e) E.push_back(*e);
      else tous = false;
    }
    const auto en = tous ? arcEntre(E, g.sol) : std::nullopt;
    if (en) {
      std::vector<std::string> p;
      for (const Pt& q : en->f) p.push_back(ajouterPoint(q.x, q.y));
      Entite e;
      e.id = nouvelE();
      e.t = "arc";
      e.pc = ajouterPoint(g.sol.x, g.sol.y);
      e.pa = p[en->sw ? 1 : 0];
      e.pb = p[en->sw ? 0 : 1];
      e.r = g.sol.r;
      s_.entites.push_back(e);
      structure_ = true;
      for (size_t i = 0; i < g.ids.size(); i++) {
        trLien(g.ids[i], e.id, g.sol.s[i] < 0);
        const Entite* src = entite(g.ids[i]);
        if (src->t == "line") {
          Contrainte c = contrainte("online");
          c.p = p[i];
          c.line = g.ids[i];
          lier(c);
        } else {
          trOnCircle(p[i], g.ids[i]);
        }
      }
      if (!g.sol.tenu) coteRond("radius", e.id, fixe(g.sol.r, 3));
      fait = true;
    }
  } else if (mode == "tangent") {
    trPid(m);
    fait = trArcTangent(pts[0], m);
  } else {
    for (ClicTrace& p : pts) trPid(p);
    trPid(m);
    if (tool == RECTANGLE) fait = trRect3(pts[0], pts[1], g.w);
    else if (tool == CERCLE && mode == "2pts") fait = trCercle2Pts(pts[0], m);
    else if (tool == CERCLE) fait = trCercle3Pts(pts[0], pts[1], m);
    else fait = trArc3Pts(pts[0], pts[1], m);
  }
  bas_ = Bas{};
  tr_ = Trace{};
  brouillon_ = Brouillon{};
  aMarque_ = false;
  apresEdition();
  const std::string nom = tool == RECTANGLE ? "Rectangle" : tool == CERCLE ? "Cercle" : "Arc";
  message(fait ? nom + " créé — " + suiteMsg(messageTrace(tool)) + " pour le suivant (Échap = fin)." : nom + " : forme impossible avec ces points.");
}
void Dessin::trRelache(double wx, double wy) {  // skTrUp
  const ClicTrace m = trViser(&tr_, wx, wy);
  const ClicTrace A = tr_.pts[0];
  const bool pick = tr_.outil == CERCLE && tr_.mode == "tangent";
  if (!tr_.up) {  // 1er relâché : sur place, le 1er point reste armé ; sinon c'est déjà le 2e point
    tr_.up = true;
    if (pick || hyp(wx - A.rx, wy - A.ry) <= longueurMini()) {
      message(msgTrace(tr_.outil, tr_.mode, 1));
      return;
    }
  }
  if (tr_.outil == ARC && tr_.mode == "tangent" && !tr_.deux) {  // sur un autre trait : arc tangent aux 2, la taille reste à donner
    if (const auto e2 = trDeuxieme(m, A)) {
      tr_.deux = true;
      ClicTrace c;
      c.ent = e2->id;
      c.x = wx;
      c.y = wy;
      c.rx = wx;
      c.ry = wy;
      tr_.pts.push_back(c);
      message(msgTrace(ARC, "tangent", 2));
      trBouge(wx, wy);
      return;
    }
  }
  const size_t clics = (tr_.outil == CERCLE && tr_.mode == "2pts") || (tr_.outil == ARC && tr_.mode == "tangent") ? 2 : 3;  // skTrClics
  if (tr_.deux || tr_.pts.size() + 1 >= clics) return trFin(m);
  // clic intermédiaire
  if (pick) {
    std::vector<std::string> ids;
    for (const ClicTrace& p : tr_.pts) ids.push_back(p.ent);
    const auto e = trEnt(wx, wy, ids);
    if (!e) {
      message(std::string(msgTrace(CERCLE, "tangent", 1)) + " (un autre trait)");
      return;
    }
    ClicTrace c;
    c.ent = e->id;
    c.x = wx;
    c.y = wy;
    c.rx = wx;
    c.ry = wy;
    tr_.pts.push_back(c);
  } else {
    if (hyp(m.x - A.x, m.y - A.y) <= longueurMini()) return;
    tr_.pts.push_back(m);
  }
  message(msgTrace(tr_.outil, tr_.mode, tr_.pts.size()));
  trBouge(wx, wy);
}
