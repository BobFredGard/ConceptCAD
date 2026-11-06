#include "maths_communes.h"
#include "solveur.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <limits>
#include <map>
#include <set>
#include <unordered_map>

namespace {
constexpr double SK_GEO_W = 300, SK_SLIDE_W = 0.01, SK_OK_RES = 0.05, PI = 3.141592653589793;
constexpr double INFINI = std::numeric_limits<double>::infinity();

// Même calcul que Math.hypot du moteur JavaScript, au dernier chiffre près : la somme de Kahan et l'échelle
// y sont propres, std::hypot donne un arrondi différent.
// Le banc peut remplacer ces trois fonctions par les mêmes des deux côtés (maths_communes.h)
#ifdef SOLVEUR_MATHS_COMMUNES
inline double m_atan2(double y, double x) { return communes::atan2_(y, x); }
inline double m_sin(double x) { return communes::sin_(x); }
inline double m_cos(double x) { return communes::cos_(x); }
#else
inline double m_atan2(double y, double x) { return std::atan2(y, x); }
inline double m_sin(double x) { return std::sin(x); }
inline double m_cos(double x) { return std::cos(x); }
#endif
inline double hyp(double a, double b) {
  a = std::abs(a);
  b = std::abs(b);
  if (std::isnan(a) || std::isnan(b)) return std::numeric_limits<double>::quiet_NaN();
  const double m = a > b ? a : b;
  if (m == INFINI) return INFINI;
  if (m == 0) return 0;
  double somme = 0, comp = 0;
  double n = a / m, s = n * n - comp, pre = somme + s;
  comp = (pre - somme) - s;
  somme = pre;
  n = b / m;
  s = n * n - comp;
  pre = somme + s;
  somme = pre;
  return std::sqrt(somme) * m;
}
// Math.max et Math.min rendent NaN dès qu'un argument l'est
inline double jsmax(double a, double b) {
  if (std::isnan(a) || std::isnan(b)) return std::numeric_limits<double>::quiet_NaN();
  return a > b ? a : b;
}
inline double jsmin(double a, double b) {
  if (std::isnan(a) || std::isnan(b)) return std::numeric_limits<double>::quiet_NaN();
  return a < b ? a : b;
}
template <class Q>
inline void rotP(Q* q, double Cx, double Cy, double a) {
  const double dx = q->x - Cx, dy = q->y - Cy, c = m_cos(a), s = m_sin(a);
  q->x = Cx + dx * c - dy * s;
  q->y = Cy + dx * s + dy * c;
}
bool cholSolve(std::vector<double>& A, std::vector<double>& b, int n) {
  for (int j = 0; j < n; j++) {
    double d = A[j * n + j];
    for (int k = 0; k < j; k++) d -= A[j * n + k] * A[j * n + k] / A[k * n + k];
    if (!(d > 1e-14)) return false;
    for (int i = j + 1; i < n; i++) {
      double s = A[i * n + j];
      for (int k = 0; k < j; k++) s -= A[i * n + k] * A[j * n + k] / A[k * n + k];
      A[i * n + j] = s / d;
    }
    A[j * n + j] = 1 / d;
  }
  for (int j = 0; j < n; j++)
    for (int i = j + 1; i < n; i++) b[i] -= A[i * n + j] * b[j];
  for (int j = 0; j < n; j++) b[j] *= A[j * n + j];
  for (int j = n - 1; j >= 0; j--)
    for (int i = j + 1; i < n; i++) b[j] -= A[i * n + j] * b[i];
  return true;
}
}  // namespace

int Solveur::indexPoint(const std::string& s) const {
  if (s.empty()) return -1;
  for (size_t i = 0; i < idP_.size(); i++)
    if (idP_[i] == s) return static_cast<int>(i);
  return -1;
}
int Solveur::indexEntite(const std::string& s) const {
  if (s.empty()) return -1;
  for (size_t i = 0; i < E_.size(); i++)  // la première occurrence, comme find
    if (E_[i].id == s) return static_cast<int>(i);
  return -1;
}

Solveur::Solveur(const Esquisse& s) {
  for (const std::string& k : s.ordre) {
    idP_.push_back(k);
    const Pt& p = s.points.at(k);
    P_.push_back({p.x, p.y});
  }
  for (const Entite& x : s.entites) {
    E e;
    e.id = x.id;
    e.t = x.t == "line" ? LIGNE : x.t == "arc" ? ARC : x.t == "circle" ? CERCLE : x.t == "cpoint" ? CPOINT : AUTRE;
    if (e.t == AUTRE && raisonRefus_.empty()) raisonRefus_ = "l'esquisse contient une courbe que ce programme ne sait pas encore résoudre (" + x.t + ")";
    e.p1 = indexPoint(x.p1);
    e.p2 = indexPoint(x.p2);
    e.pc = indexPoint(x.pc);
    e.pa = indexPoint(x.pa);
    e.pb = indexPoint(x.pb);
    e.p = indexPoint(x.p);
    if (e.t == LIGNE && x.p1.empty() && raisonRefus_.empty()) raisonRefus_ = "esquisse d'un ancien format";
    e.r = x.r;
    e.proj = x.proj;
    e.ref = x.ref;
    e.ext = x.proj || x.ext;
    e.construction = x.construction;
    for (const std::string& q : x.poly) e.poly.push_back(indexPoint(q));
    E_.push_back(std::move(e));
  }
  ensureOrigin();
  static const std::map<std::string, TypeC> typesC = {{"h", H}, {"v", V}, {"coincident", COINCIDENT}, {"oncircle", ONCIRCLE}, {"online", ONLINE}, {"midpoint", MIDPOINT}, {"parallel", PARALLEL}, {"perpendicular", PERPENDICULAR}, {"collinear", COLLINEAR}, {"equal", EQUAL}, {"offset", OFFSET}, {"tangent", TANGENT}, {"tangent2", TANGENT2}, {"coaxial", COAXIAL}, {"symmetric", SYMMETRIC}, {"fix", FIX}};
  for (const Contrainte& x : s.contraintes) {
    C c;
    c.id = x.id;
    const auto it = typesC.find(x.type);
    if (it != typesC.end()) c.type = it->second;
    else if (raisonRefus_.empty()) raisonRefus_ = "contrainte que ce programme ne sait pas encore résoudre (" + x.type + ")";
    c.aP = !x.p.empty();
    c.aA = !x.a.empty();
    c.aB = !x.b.empty();
    c.p = indexPoint(x.p);
    c.line = indexEntite(x.line);
    c.ent = indexEntite(x.ent);
    // « a » et « b » désignent des points pour une coïncidence, des entités ailleurs
    const bool points = c.type == COINCIDENT;
    c.a = points ? indexPoint(x.a) : indexEntite(x.a);
    c.b = points ? indexPoint(x.b) : indexEntite(x.b);
    c.mid = indexEntite(x.mid);
    c.c = indexEntite(x.c);
    c.d = indexEntite(x.d);
    c.inf = x.inf;
    c.sa = x.sa;
    c.sb = x.sb;
    C_.push_back(std::move(c));
  }
  static const std::map<std::string, TypeD> typesD = {{"length", LENGTH}, {"distance", DISTANCE}, {"diameter", DIAMETER}, {"radius", RADIUS}, {"angle", ANGLE}, {"gap", GAP}, {"distline", DISTLINE}};
  for (const Cote& x : s.cotes) {
    D d;
    d.id = x.id;
    const auto it = typesD.find(x.type);
    if (it != typesD.end()) d.type = it->second;
    d.line = indexEntite(x.line);
    d.ent = indexEntite(x.ent);
    const bool points = d.type == DISTANCE;
    d.a = points ? indexPoint(x.a) : indexEntite(x.a);
    d.b = points ? indexPoint(x.b) : indexEntite(x.b);
    d.p = indexPoint(x.p);
    d.orient = x.orient.empty() ? 0 : x.orient[0];
    d.value = x.value;
    d.ref = x.ref;
    d.comp = x.comp;
    d.sgn = x.sgn;
    d.ccw = x.ccw;
    D_.push_back(std::move(d));
  }

  // Dans l'ordre de l'application : chargement (migrateSketch, réparation, valeurs de départ), puis ouverture
  skDimSides();
  skProjFixRepair();
  skFixSurProjRepair();
  calculerStructure();
  noterValeurs();
  skGapToAngle();
  symetriesSurDroites();
  calculerStructure();
}

void Solveur::ensureOrigin() {
  origine_ = indexPoint("O");
  if (origine_ < 0) {
    // Le navigateur sait aussi promouvoir un point déjà en (0,0) : aucun exemple n'en a besoin
    for (size_t i = 0; i < P_.size(); i++)
      if (std::abs(P_[i].x) <= 1e-6 && std::abs(P_[i].y) <= 1e-6 && raisonRefus_.empty()) raisonRefus_ = "esquisse sans origine, à ouvrir d'abord dans la version navigateur";
    idP_.push_back("O");
    P_.push_back({0, 0});
    origine_ = static_cast<int>(P_.size()) - 1;
  } else if (P_[origine_].x != 0 || P_[origine_].y != 0) {
    P_[origine_] = {0, 0};
  }
}

std::vector<int> Solveur::pidsEntite(const E& e) const {
  switch (e.t) {
    case LIGNE: return {e.p1, e.p2};
    case ARC: return {e.pc, e.pa, e.pb};
    case CERCLE: return {e.pc};
    case CPOINT: return {e.p};
    default: return {};
  }
}

void Solveur::calculerStructure() {
  // skFixed
  fix_.assign(P_.size(), 0);
  for (const C& c : C_) {
    if (c.type != FIX) continue;
    if (c.p >= 0) fix_[c.p] = 1;
    const E* e = c.ent >= 0 ? &E_[c.ent] : nullptr;
    if (e && (e->t == CERCLE || e->t == ARC || e->t == CPOINT)) {
      const int q = e->pc >= 0 ? e->pc : e->p;
      if (q >= 0) fix_[q] = 1;
    }
  }
  for (const E& e : E_)
    if (e.proj)
      for (int q : pidsEntite(e))
        if (q >= 0) fix_[q] = 1;
  if (origine_ >= 0) fix_[origine_] = 1;

  // rLocked
  for (size_t i = 0; i < E_.size(); i++) {
    E& e = E_[i];
    e.verrouille = e.proj;
    for (const C& c : C_)
      if (c.type == FIX && c.ent == static_cast<int>(i)) e.verrouille = true;
    for (const D& d : D_)
      if (d.ent == static_cast<int>(i) && (d.type == DIAMETER || d.type == RADIUS)) e.verrouille = true;
  }

  // Les rayons pilotés par une cote à travers des « égal » ou par un décalage n'ont pas d'ancrage
  std::vector<char> coteR(E_.size(), 0);
  for (const D& d : D_)
    if (!d.ref && (d.type == RADIUS || d.type == DIAMETER) && d.ent >= 0) coteR[d.ent] = 1;
  std::vector<char> conduit(E_.size(), 0);
  for (bool grow = true; grow;) {
    grow = false;
    for (const C& c : C_) {
      if (c.type != EQUAL || c.a < 0 || c.b < 0) continue;
      const bool a = coteR[c.a] || conduit[c.a], b = coteR[c.b] || conduit[c.b];
      if (a && !b && !conduit[c.b]) {
        conduit[c.b] = 1;
        grow = true;
      }
      if (b && !a && !conduit[c.a]) {
        conduit[c.a] = 1;
        grow = true;
      }
    }
  }
  for (const C& c : C_)
    if (c.type == OFFSET && c.d >= 0) conduit[c.d] = 1;
  for (size_t i = 0; i < E_.size(); i++) E_[i].conduit = conduit[i] != 0;

  // Tangences : ligne cotée, bouts partagés avec une autre entité
  for (C& c : C_) {
    if (c.type != TANGENT || c.line < 0) continue;
    c.surCote = false;
    for (const D& d : D_)
      if (d.type == LENGTH && d.line == c.line) c.surCote = true;
    const E& L = E_[c.line];
    const auto partage = [&](int q) {
      for (size_t i = 0; i < E_.size(); i++) {
        if (static_cast<int>(i) == c.line) continue;
        const std::vector<int> v = pidsEntite(E_[i]);
        if (std::find(v.begin(), v.end(), q) != v.end()) return true;
      }
      return false;
    };
    c.partage1 = L.p1 >= 0 && partage(L.p1);
    c.partage2 = L.p2 >= 0 && partage(L.p2);
  }
}

bool Solveur::dimSigne(const D& d, double& v) {
  int a = -1, q = -1;
  if (d.type == GAP) {
    const E* A = en(d.a);
    const E* B = en(d.b);
    if (!A || !B || A->t != LIGNE || B->t != LIGNE) return false;
    a = d.a;
    q = B->p1;
  } else if (d.type == DISTLINE) {
    const E* l = en(d.line);
    if (!l || l->t != LIGNE) return false;
    a = d.line;
    q = d.p;
  } else {
    return false;
  }
  const E& l = E_[a];
  const P2* A = pt(l.p1);
  const P2* B = pt(l.p2);
  const P2* Q = pt(q);
  if (!A || !B || !Q) return false;
  const double dx = B->x - A->x, dy = B->y - A->y, L = hyp(dx, dy);
  if (L < 1e-9) return false;
  const double nx = -dy / L, ny = dx / L;
  v = (Q->x - A->x) * nx + (Q->y - A->y) * ny;
  return true;
}

void Solveur::skDimSides() {
  for (D& d : D_) {
    if ((d.type != GAP && d.type != DISTLINE) || d.sgn == 1 || d.sgn == -1) continue;
    const double w = jsmax(d.value, 0);
    if (!(w > 1e-6)) continue;
    double sg;
    if (!dimSigne(d, sg)) continue;
    if (std::abs(std::abs(sg) - w) <= jsmax(0.01, w * 2e-3)) d.sgn = sg >= 0 ? 1 : -1;
  }
}

void Solveur::skProjFixRepair() {
  const auto nouveau = [&]() { return "+" + std::to_string(suivant_++); };
  for (size_t i = 0; i < E_.size(); i++) {
    const E& e = E_[i];
    if (!e.proj) continue;
    for (int q : pidsEntite(e)) {
      if (q < 0) continue;
      bool a = false;
      for (const C& c : C_) a = a || (c.type == FIX && c.p == q);
      if (!a) {
        C n;
        n.id = nouveau();
        n.type = FIX;
        n.p = q;
        n.aP = true;
        C_.push_back(n);
      }
    }
    if (e.t == CERCLE || e.t == ARC) {
      bool a = false;
      for (const C& c : C_) a = a || (c.type == FIX && c.ent == static_cast<int>(i));
      if (!a) {
        C n;
        n.id = nouveau();
        n.type = FIX;
        n.ent = static_cast<int>(i);
        C_.push_back(n);
      }
    }
  }
}

void Solveur::skFixSurProjRepair() {
  std::vector<char> proj(P_.size(), 0);
  for (const E& e : E_)
    if (e.proj)
      for (int q : pidsEntite(e))
        if (q >= 0) proj[q] = 1;
  // Liste figée au départ, comme filter(...).forEach : les « fixe » concernés se retirent un à un
  std::vector<std::string> fixes;
  for (const C& c : C_)
    if (c.type == FIX && c.p >= 0 && !proj[c.p]) fixes.push_back(c.id);
  for (const std::string& id : fixes) {
    auto it = std::find_if(C_.begin(), C_.end(), [&](const C& c) { return c.id == id; });
    if (it == C_.end()) continue;
    const int q = it->p;
    const E* on = nullptr;
    for (const C& k : C_)
      if (k.type == ONLINE && k.p == q && k.line >= 0 && E_[k.line].proj && E_[k.line].t == LIGNE) {
        on = &E_[k.line];
        break;
      }
    if (!on) continue;
    C_.erase(it);
    const P2& A = P_[q];
    int bout = -1;
    for (int b : {on->p1, on->p2})
      if (bout < 0 && b >= 0 && hyp(P_[b].x - A.x, P_[b].y - A.y) < 1e-3) bout = b;
    if (bout >= 0 && bout != q) {
      bool lie = false;
      for (const C& c : C_) lie = lie || (c.type == COINCIDENT && ((c.a == q && c.b == bout) || (c.a == bout && c.b == q)));
      if (!lie) {
        C n;
        n.id = "+" + std::to_string(suivant_++);
        n.type = COINCIDENT;
        n.a = q;
        n.b = bout;
        n.aA = n.aB = true;
        C_.push_back(n);
      }
    }
  }
}

bool Solveur::lignesParalleles(const E& A, const E& B) {
  const int ia = static_cast<int>(&A - E_.data()), ib = static_cast<int>(&B - E_.data());
  bool ah = false, av = false, bh = false, bv = false;
  for (const C& c : C_) {
    if ((c.type == PARALLEL || c.type == COLLINEAR) && ((c.a == ia && c.b == ib) || (c.a == ib && c.b == ia))) return true;
    if (c.type == H && c.line == ia) ah = true;
    if (c.type == V && c.line == ia) av = true;
    if (c.type == H && c.line == ib) bh = true;
    if (c.type == V && c.line == ib) bv = true;
  }
  if ((ah && bh) || (av && bv)) return true;
  const P2* A1 = pt(A.p1);
  const P2* A2 = pt(A.p2);
  const P2* B1 = pt(B.p1);
  const P2* B2 = pt(B.p2);
  if (!A1 || !A2 || !B1 || !B2) return false;
  // skLinesAngle (src/50-esquisse-4) : angle entre droites non orientées
  const double sA = m_atan2(A2->y - A1->y, A2->x - A1->x), sB = m_atan2(B2->y - B1->y, B2->x - B1->x);
  const double x = std::fmod(std::fmod(sB - sA, PI) + PI, PI);
  return jsmin(x, PI - x) < 0.5 * PI / 180;
}

void Solveur::skGapToAngle() {
  for (D& d : D_) {
    if (d.type != GAP) continue;
    const E* A = en(d.a);
    const E* B = en(d.b);
    if (!A || !B || A->t != LIGNE || B->t != LIGNE) continue;
    if (lignesParalleles(*A, *B)) continue;
    Cadre fr;
    if (!angleFrame(d.a, d.b, fr)) continue;
    const double ad = std::abs(fr.delta);
    if (ad < 0.03 || PI - ad < 0.03) continue;
    coteConvertie_ = true;
    d.type = ANGLE;
    d.value = std::round(ad * 1e6) / 1e6;  // +ad.toFixed(6)
    d.ccw = fr.delta > 0 ? 1 : 0;
    d.sgn = 0;
    d.orient = 0;
  }
}

void Solveur::symetriesSurDroites() {
  std::vector<char> bout(P_.size(), 0);
  for (const E& e : E_)
    if (e.t == ARC) {
      if (e.pa >= 0) bout[e.pa] = 1;
      if (e.pb >= 0) bout[e.pb] = 1;
    }
  for (C& c : C_) {
    if (c.type != SYMMETRIC || c.inf) continue;
    for (int l : {c.a, c.b}) {
      if (l < 0) continue;
      if ((E_[l].p1 >= 0 && bout[E_[l].p1]) || (E_[l].p2 >= 0 && bout[E_[l].p2])) c.inf = true;
    }
  }
}

void Solveur::noterValeurs() {
  for (D& d : D_) {
    if (std::isfinite(d.value) && !d.aVal) {
      d.aVal = true;
      d.val = d.value;
    }
  }
  if (!aPts_) {
    ptsNote();
    bonNote();  // l'état ouvert du fichier est le premier bon état
  }
}

/* ----- mesures ----- */
double Solveur::lineLen(const E& l) {
  const P2* A = pt(l.p1);
  const P2* B = pt(l.p2);
  if (!A || !B) return 0;
  return hyp(B->x - A->x, B->y - A->y);
}

bool Solveur::angleVertex(const D& d, P2& V) {
  const E* A = en(d.a);
  const E* B = en(d.b);
  if (!A || !B || A->t != LIGNE || B->t != LIGNE) return false;
  int sh = -1;
  if (A->p1 >= 0 && (A->p1 == B->p1 || A->p1 == B->p2)) sh = A->p1;
  else if (A->p2 >= 0 && (A->p2 == B->p1 || A->p2 == B->p2)) sh = A->p2;
  if (sh >= 0) {
    V = P_[sh];
    return true;
  }
  const P2* A1 = pt(A->p1);
  const P2* A2 = pt(A->p2);
  const P2* B1 = pt(B->p1);
  const P2* B2 = pt(B->p2);
  if (!A1 || !A2 || !B1 || !B2) return false;
  const double ax = A2->x - A1->x, ay = A2->y - A1->y, bx = B2->x - B1->x, by = B2->y - B1->y, cr = ax * by - ay * bx;
  const double la = hyp(ax, ay), lb = hyp(bx, by);
  if (la > 1e-12 && lb > 1e-12 && std::abs(cr) / (la * lb) > 1e-4) {
    const double t = ((B1->x - A1->x) * by - (B1->y - A1->y) * bx) / cr;
    V = {A1->x + ax * t, A1->y + ay * t};
    return true;
  }
  V = {((A1->x + A2->x) / 2 + (B1->x + B2->x) / 2) / 2, ((A1->y + A2->y) / 2 + (B1->y + B2->y) / 2) / 2};
  return true;
}

bool Solveur::angleFrame(int a, int b, Cadre& fr) {
  D d;
  d.a = a;
  d.b = b;
  return angleFrame(d, fr);
}

bool Solveur::angleFrame(const D& d, Cadre& fr) {
  const E* A = en(d.a);
  const E* B = en(d.b);
  if (!A || !B || A->t != LIGNE || B->t != LIGNE) return false;
  const P2* A1 = pt(A->p1);
  const P2* A2 = pt(A->p2);
  const P2* B1 = pt(B->p1);
  const P2* B2 = pt(B->p2);
  if (!A1 || !A2 || !B1 || !B2) return false;
  P2 V;
  if (!angleVertex(d, V)) return false;
  const P2* fA = hyp(A1->x - V.x, A1->y - V.y) > hyp(A2->x - V.x, A2->y - V.y) ? A1 : A2;
  const P2* fB = hyp(B1->x - V.x, B1->y - V.y) > hyp(B2->x - V.x, B2->y - V.y) ? B1 : B2;
  const double sA = m_atan2(fA->y - V.y, fA->x - V.x), sB = m_atan2(fB->y - V.y, fB->x - V.x);
  const double TAU = PI * 2;
  double delta = std::fmod(sB - sA, TAU);
  if (delta <= -PI) delta += TAU;
  else if (delta > PI) delta -= TAU;
  fr = {V, sA, sB, delta, hyp(fA->x - V.x, fA->y - V.y), hyp(fB->x - V.x, fB->y - V.y)};
  return true;
}

double Solveur::angleWant(const D& d, double delta) {
  const double v = jsmax(0.02, jsmin(PI - 0.02, d.value != 0 ? d.value : 0));
  if (d.comp) return (delta >= 0 ? 1 : -1) * (PI - v);
  const int ccw = (d.ccw == 0 || d.ccw == 1) ? d.ccw : (delta >= 0 ? 1 : 0);
  return (ccw ? 1 : -1) * v;
}
static inline double echelleAngle(double rA, double rB) { return jsmax(jsmax(1, rA), rB); }

bool Solveur::offsetVal(int ia, int ib, int sgn, double& v) {
  const E* A = en(ia);
  const E* B = en(ib);
  if (!A || !B) return false;
  const double s = sgn == -1 ? -1 : 1;
  if (A->t == LIGNE && B->t == LIGNE) {
    const P2* A1 = pt(A->p1);
    const P2* A2 = pt(A->p2);
    const P2* B1 = pt(B->p1);
    if (!A1 || !A2 || !B1) return false;
    const double dx = A2->x - A1->x, dy = A2->y - A1->y, L = hyp(dx, dy);
    if (!(L > 1e-9)) return false;
    v = s * ((B1->x - A1->x) * (-dy / L) + (B1->y - A1->y) * (dx / L));
    return true;
  }
  if ((A->t == CERCLE || A->t == ARC) && (B->t == CERCLE || B->t == ARC)) {
    v = s * (B->r - A->r);
    return true;
  }
  return false;
}

static inline double mesure(double ax, double ay, double bx, double by, char o) {
  return o == 'h' ? std::abs(bx - ax) : o == 'v' ? std::abs(by - ay) : hyp(bx - ax, by - ay);
}

Solveur::Bilan Solveur::audit(std::vector<Violation>* tout) {
  Bilan r;
  const auto pousse = [&](bool cote, const char* desc, double viol) {
    if (viol > r.residual) r.residual = viol;
    const double v = viol * (cote ? 1 : SK_GEO_W);
    if (v > r.score) r.score = v;
    if (tout) tout->push_back({desc, viol});
  };
  for (const D& d : D_) {
    if (d.ref) continue;
    if (d.type == LENGTH) {
      const E* l = en(d.line);
      if (l && l->t == LIGNE) {
        const P2* A = pt(l->p1);
        const P2* B = pt(l->p2);
        const double cur = (d.orient == 'h' || d.orient == 'v') && A && B ? mesure(A->x, A->y, B->x, B->y, d.orient) : lineLen(*l);
        pousse(true, "longueur", std::abs(cur - d.value));
      }
    }
    if (d.type == DISTANCE) {
      const P2* A = pt(d.a);
      const P2* B = pt(d.b);
      if (A && B) pousse(true, "distance", std::abs(mesure(A->x, A->y, B->x, B->y, d.orient) - d.value));
    }
    if (d.type == DIAMETER || d.type == RADIUS) {
      const E* e = en(d.ent);
      if (e && (e->t == CERCLE || e->t == ARC)) pousse(true, d.type == DIAMETER ? "diamètre" : "rayon", std::abs((d.type == DIAMETER ? e->r * 2 : e->r) - d.value));
    }
    if (d.type == ANGLE) {
      Cadre fr;
      if (angleFrame(d, fr)) {
        const double TAU = PI * 2, want = angleWant(d, fr.delta);
        double e = want - fr.delta;
        if (e > PI) e -= TAU;
        else if (e < -PI) e += TAU;
        pousse(true, "angle", std::abs(e) * echelleAngle(fr.rA, fr.rB));
      }
    }
    if (d.type == GAP) {
      const E* A = en(d.a);
      const E* B = en(d.b);
      if (A && B && A->t == LIGNE && B->t == LIGNE) {
        const P2* A1 = pt(A->p1);
        const P2* A2 = pt(A->p2);
        const P2* B1 = pt(B->p1);
        const P2* B2 = pt(B->p2);
        if (A1 && A2 && B1 && B2) {
          const double dx = A2->x - A1->x, dy = A2->y - A1->y, L0 = hyp(dx, dy), L = L0 != 0 ? L0 : 1e-9;
          const double sg = (B1->x - A1->x) * (-dy / L) + (B1->y - A1->y) * (dx / L);
          pousse(true, "entraxe", (d.sgn == 1 || d.sgn == -1) ? std::abs(sg - d.sgn * d.value) : std::abs(std::abs(sg) - d.value));
        }
      }
    }
    if (d.type == DISTLINE) {
      const E* l = en(d.line);
      const P2* Q = pt(d.p);
      if (l && l->t == LIGNE && Q) {
        const P2* A = pt(l->p1);
        const P2* B = pt(l->p2);
        if (A && B) {
          const double dx = B->x - A->x, dy = B->y - A->y, L0 = hyp(dx, dy), L = L0 != 0 ? L0 : 1e-9;
          const double sg = (Q->x - A->x) * (-dy / L) + (Q->y - A->y) * (dx / L);
          pousse(true, "distance à une ligne", (d.sgn == 1 || d.sgn == -1) ? std::abs(sg - d.sgn * d.value) : std::abs(std::abs(sg) - d.value));
        }
      }
    }
  }
  for (const C& c : C_) {
    if (c.type == H || c.type == V) {
      const E* l = en(c.line);
      if (l && l->t == LIGNE) {
        const P2* A = pt(l->p1);
        const P2* B = pt(l->p2);
        if (A && B) pousse(false, c.type == H ? "horizontale" : "verticale", std::abs(c.type == H ? A->y - B->y : A->x - B->x));
      }
    }
    if (c.type == PARALLEL || c.type == PERPENDICULAR || c.type == COLLINEAR) {
      const E* A = en(c.a);
      const E* B = en(c.b);
      if (A && B && A->t == LIGNE && B->t == LIGNE) {
        const P2* A1 = pt(A->p1);
        const P2* A2 = pt(A->p2);
        const P2* B1 = pt(B->p1);
        const P2* B2 = pt(B->p2);
        if (A1 && A2 && B1 && B2) {
          const double ax = A2->x - A1->x, ay = A2->y - A1->y, La = hyp(ax, ay), bx = B2->x - B1->x, by = B2->y - B1->y, Lb = hyp(bx, by);
          if (La > 1e-9 && Lb > 1e-9) {
            if (c.type == COLLINEAR) {
              const double nx = -ay / La, ny = ax / La;
              pousse(false, "colinéaire", jsmax(std::abs((B1->x - A1->x) * nx + (B1->y - A1->y) * ny), std::abs((B2->x - A1->x) * nx + (B2->y - A1->y) * ny)));
            } else {
              const double cr = (ax * by - ay * bx) / (La * Lb), dt = (ax * bx + ay * by) / (La * Lb);
              pousse(false, c.type == PARALLEL ? "parallèle" : "perpendiculaire", std::abs(c.type == PARALLEL ? cr : dt) * jsmin(La, Lb));
            }
          }
        }
      }
    }
    if (c.type == EQUAL) {
      const E* A = en(c.a);
      const E* B = en(c.b);
      if (A && B) {
        if (A->t == LIGNE && B->t == LIGNE) pousse(false, "égal", std::abs(lineLen(*A) - lineLen(*B)));
        else if ((A->t == CERCLE || A->t == ARC) && (B->t == CERCLE || B->t == ARC)) pousse(false, "égal", std::abs(A->r - B->r));
      }
    }
    if (c.type == TANGENT) {
      const E* L = en(c.line);
      const E* X = en(c.ent);
      if (L && X && L->t == LIGNE && (X->t == CERCLE || X->t == ARC)) {
        const P2* A = pt(L->p1);
        const P2* B = pt(L->p2);
        const P2* CC = pt(X->pc);
        if (A && B && CC) {
          const double dx = B->x - A->x, dy = B->y - A->y, L0 = hyp(dx, dy), Ln = L0 != 0 ? L0 : 1e-9;
          const double t = ((CC->x - A->x) * dx + (CC->y - A->y) * dy) / (Ln * Ln);
          double seg;
          if (t < 0) seg = hyp(CC->x - A->x, CC->y - A->y);
          else if (t > 1) seg = hyp(CC->x - B->x, CC->y - B->y);
          else seg = std::abs((CC->x - A->x) * (-dy / Ln) + (CC->y - A->y) * (dx / Ln));
          const double sd = (CC->x - A->x) * (-dy / Ln) + (CC->y - A->y) * (dx / Ln);
          pousse(false, "tangence", (c.cote && sd * c.cote < -1e-6) ? std::abs(sd) + X->r : std::abs(seg - X->r));
        }
      }
    }
    if (c.type == SYMMETRIC) {
      const E* A = en(c.a);
      const E* B = en(c.b);
      const E* M = en(c.mid);
      if (A && B && M && A->t == LIGNE && B->t == LIGNE && M->t == LIGNE) {
        const P2* A1 = pt(A->p1);
        const P2* A2 = pt(A->p2);
        const P2* B1 = pt(B->p1);
        const P2* B2 = pt(B->p2);
        const P2* M1 = pt(M->p1);
        const P2* M2 = pt(M->p2);
        if (A1 && A2 && B1 && B2 && M1 && M2) {
          const double mx = M2->x - M1->x, my = M2->y - M1->y, ml0 = hyp(mx, my), ml = ml0 != 0 ? ml0 : 1e-9, ux = mx / ml, uy = my / ml;
          const auto reflet = [&](const P2* Q) {
            const double wx = Q->x - M1->x, wy = Q->y - M1->y, pr = wx * ux + wy * uy;
            const double px = M1->x + ux * pr, py = M1->y + uy * pr;
            return P2{2 * px - Q->x, 2 * py - Q->y};
          };
          const P2 ra1 = reflet(A1), ra2 = reflet(A2);
          const double bx = B2->x - B1->x, by = B2->y - B1->y, bl0 = hyp(bx, by), bl = bl0 != 0 ? bl0 : 1e-9, nx = -by / bl, ny = bx / bl;
          const double v = c.inf ? jsmax(std::abs((ra1.x - B1->x) * nx + (ra1.y - B1->y) * ny), std::abs((ra2.x - B1->x) * nx + (ra2.y - B1->y) * ny))
                                 : jsmin(hyp(ra1.x - B1->x, ra1.y - B1->y) + hyp(ra2.x - B2->x, ra2.y - B2->y), hyp(ra1.x - B2->x, ra1.y - B2->y) + hyp(ra2.x - B1->x, ra2.y - B1->y));
          pousse(false, "symétrie", v);
        }
      }
    }
    if (c.type == TANGENT2) {
      const E* A = en(c.a);
      const E* B = en(c.b);
      if (A && B) {
        const P2* CA = pt(A->pc);
        const P2* CB = pt(B->pc);
        if (CA && CB) pousse(false, "tangence", std::abs(hyp(CB->x - CA->x, CB->y - CA->y) - (A->r + B->r)));
      }
    }
    if (c.type == COAXIAL) {
      const E* A = en(c.a);
      const E* B = en(c.b);
      if (A && B && (A->t == CERCLE || A->t == ARC) && (B->t == CERCLE || B->t == ARC)) {
        const P2* CA = pt(A->pc);
        const P2* CB = pt(B->pc);
        if (CA && CB) pousse(false, "coaxiaux", hyp(CB->x - CA->x, CB->y - CA->y));
      }
    }
    if (c.type == COINCIDENT) {
      const P2* A = pt(c.a);
      const P2* B = pt(c.b);
      if (A && B) pousse(false, "coïncident", hyp(B->x - A->x, B->y - A->y));
    }
    if (c.type == OFFSET) {
      double v1, v2;
      if (offsetVal(c.a, c.b, c.sa, v1) && offsetVal(c.c, c.d, c.sb, v2)) pousse(false, "décalage égal", std::abs(v2 - v1));
    }
    if (c.type == ONCIRCLE) {
      const P2* Q = pt(c.p);
      const E* X = en(c.ent);
      if (Q && X && (X->t == CERCLE || X->t == ARC)) {
        const P2* CC = pt(X->pc);
        if (CC) pousse(false, X->t == CERCLE ? "point sur cercle" : "point sur arc", std::abs(hyp(Q->x - CC->x, Q->y - CC->y) - X->r));
      }
    }
    if (c.type == ONLINE) {
      const P2* Q = pt(c.p);
      const E* l = en(c.line);
      if (Q && l && l->t == LIGNE) {
        const P2* A = pt(l->p1);
        const P2* B = pt(l->p2);
        if (A && B) {
          const double dx = B->x - A->x, dy = B->y - A->y, L = hyp(dx, dy);
          if (L > 1e-9) pousse(false, "point sur ligne", std::abs((Q->x - A->x) * (-dy / L) + (Q->y - A->y) * (dx / L)));
        }
      }
    }
    if (c.type == MIDPOINT) {
      if (c.aP) {
        const P2* Q = pt(c.p);
        const E* l = en(c.line);
        if (Q && l && l->t == LIGNE) {
          const P2* A = pt(l->p1);
          const P2* B = pt(l->p2);
          if (A && B) pousse(false, "milieu", hyp(Q->x - (A->x + B->x) / 2, Q->y - (A->y + B->y) / 2));
        }
      } else if (c.aA && c.aB) {
        const E* A = en(c.a);
        const E* B = en(c.b);
        if (A && B && A->t == LIGNE && B->t == LIGNE) {
          const P2* A1 = pt(A->p1);
          const P2* A2 = pt(A->p2);
          const P2* B1 = pt(B->p1);
          const P2* B2 = pt(B->p2);
          if (A1 && A2 && B1 && B2) pousse(false, "milieux égaux", hyp((A1->x + A2->x) / 2 - (B1->x + B2->x) / 2, (A1->y + A2->y) / 2 - (B1->y + B2->y) / 2));
        }
      }
    }
  }
  return r;
}

double Solveur::residu() {
  const double r = audit().residual;
  return std::isfinite(r) ? r : INFINI;
}

std::string Solveur::pireEcart() {
  std::vector<Violation> v;
  audit(&v);
  std::stable_sort(v.begin(), v.end(), [](const Violation& a, const Violation& b) { return b.viol < a.viol; });
  std::string s;
  int n = 0;
  for (const Violation& o : v) {
    if (!(o.viol > SK_OK_RES) || n == 3) break;
    char b[64];
    std::snprintf(b, sizeof b, " en défaut de %.2f mm", o.viol);
    if (n++) s += ", ";
    s += o.desc;
    if (o.viol < 100) s += b;
    else s += " en défaut de plus de 100 mm";
  }
  return s;
}

/* ----- relaxation ----- */
void Solveur::scaleLine(E& l, double target) {
  P2* A = pt(l.p1);
  P2* B = pt(l.p2);
  if (!A || !B) return;
  const double dx = B->x - A->x, dy = B->y - A->y, len = hyp(dx, dy);
  if (!(len > 1e-6)) return;
  const double k = target / len;
  const bool aF = fix_[l.p1], bF = fix_[l.p2];
  if (aF && !bF) {
    B->x = A->x + dx * k;
    B->y = A->y + dy * k;
  } else if (bF && !aF) {
    A->x = B->x - dx * k;
    A->y = B->y - dy * k;
  } else {
    const double mx = (A->x + B->x) / 2, my = (A->y + B->y) / 2;
    if (!aF) {
      A->x = mx - dx * k / 2;
      A->y = my - dy * k / 2;
    }
    if (!bF) {
      B->x = mx + dx * k / 2;
      B->y = my + dy * k / 2;
    }
  }
}

std::vector<char> Solveur::composante(const E& l) {
  std::vector<char> pids(P_.size(), 0), ents(E_.size(), 0);
  const auto ajouter = [&](int e) {
    for (int q : pidsEntite(E_[e]))
      if (q >= 0) pids[q] = 1;
  };
  for (int q : pidsEntite(l))
    if (q >= 0) pids[q] = 1;
  bool changed = true;
  for (int garde = 0; changed && garde++ < 128;) {
    changed = false;
    for (size_t i = 0; i < E_.size(); i++) {
      if (ents[i]) continue;
      bool touche = false;
      for (int q : pidsEntite(E_[i])) touche = touche || (q >= 0 && pids[q]);
      if (touche) {
        ents[i] = 1;
        ajouter(static_cast<int>(i));
        changed = true;
      }
    }
    for (const C& c : C_) {
      const auto paire = [&](int a, int b) {
        if (a < 0 || b < 0) return;
        if (ents[a] && !ents[b]) {
          ents[b] = 1;
          ajouter(b);
          changed = true;
        } else if (ents[b] && !ents[a]) {
          ents[a] = 1;
          ajouter(a);
          changed = true;
        }
      };
      if (c.type == COINCIDENT) {
        if (c.a >= 0 && c.b >= 0) {
          if (pids[c.a] && !pids[c.b]) {
            pids[c.b] = 1;
            changed = true;
          } else if (pids[c.b] && !pids[c.a]) {
            pids[c.a] = 1;
            changed = true;
          }
        }
      } else if (c.type == TANGENT) {
        paire(c.line, c.ent);
      } else if (c.type == ONCIRCLE || c.type == ONLINE) {
        const int e = c.type == ONCIRCLE ? c.ent : c.line;
        if (e < 0 || c.p < 0) continue;
        if (pids[c.p] && !ents[e]) {
          ents[e] = 1;
          ajouter(e);
          changed = true;
        } else if (ents[e] && !pids[c.p]) {
          pids[c.p] = 1;
          changed = true;
        }
      } else if (c.type == PARALLEL || c.type == PERPENDICULAR || c.type == COLLINEAR || c.type == SYMMETRIC) {
        paire(c.a, c.b);
      }
    }
  }
  return pids;
}

void Solveur::scaleLineDist(E& l, double target) {
  P2* A = pt(l.p1);
  P2* B = pt(l.p2);
  if (!A || !B) return;
  const double dx = B->x - A->x, dy = B->y - A->y, len = hyp(dx, dy);
  if (!(len > 1e-6)) return;
  const double k = target / len, ux = dx / len, uy = dy / len;
  const bool aF = fix_[l.p1], bF = fix_[l.p2];
  double rx, ry;
  if (aF && !bF) {
    rx = A->x;
    ry = A->y;
  } else if (bF && !aF) {
    rx = B->x;
    ry = B->y;
  } else {
    rx = (A->x + B->x) / 2;
    ry = (A->y + B->y) / 2;
  }
  const std::vector<char> pc = composante(l);
  for (size_t q = 0; q < P_.size(); q++) {
    if (!pc[q] || fix_[q]) continue;
    P2& Q = P_[q];
    const double t = (Q.x - rx) * ux + (Q.y - ry) * uy;
    Q.x += ux * t * (k - 1);
    Q.y += uy * t * (k - 1);
  }
}

void Solveur::scaleAxisPts(int pa, int pb, double val, int axis) {
  P2* A = pt(pa);
  P2* B = pt(pb);
  if (!A || !B) return;
  const double av = axis ? A->y : A->x, bv = axis ? B->y : B->x, dd = bv - av;
  if (!(std::abs(dd) > 1e-9)) return;
  const double k = jsmax(val, 0) / std::abs(dd);
  const bool aF = fix_[pa], bF = fix_[pb];
  if (aF && !bF) {
    if (axis) B->y = av + dd * k;
    else B->x = av + dd * k;
  } else if (bF && !aF) {
    if (axis) A->y = bv - dd * k;
    else A->x = bv - dd * k;
  } else if (!aF && !bF) {
    const double m = (av + bv) / 2;
    if (axis) {
      A->y = m - dd * k / 2;
      B->y = m + dd * k / 2;
    } else {
      A->x = m - dd * k / 2;
      B->x = m + dd * k / 2;
    }
  }
}

void Solveur::relax(int iters) {
  const auto fx = [&](int q) { return q >= 0 && fix_[q]; };
  for (int it = 0; it < iters; it++) {
    for (D& d : D_) {
      if (d.ref) continue;
      if (d.type == LENGTH) {
        E* l = en(d.line);
        if (l && l->t == LIGNE) {
          if (d.orient == 'h') scaleAxisPts(l->p1, l->p2, d.value, 0);
          else if (d.orient == 'v') scaleAxisPts(l->p1, l->p2, d.value, 1);
          else if (l->construction) scaleLineDist(*l, jsmax(d.value, 0.1));
          else scaleLine(*l, jsmax(d.value, 0.1));
        }
      }
      if (d.type == DISTANCE) {
        if (d.orient == 'h') scaleAxisPts(d.a, d.b, d.value, 0);
        else if (d.orient == 'v') scaleAxisPts(d.a, d.b, d.value, 1);
        else {
          P2* A = pt(d.a);
          P2* B = pt(d.b);
          if (!A || !B) continue;
          const double dx = B->x - A->x, dy = B->y - A->y, len = hyp(dx, dy);
          if (!(len > 1e-6)) continue;
          const double k = jsmax(d.value, 0) / len;
          const bool aF = fx(d.a), bF = fx(d.b);
          if (aF && !bF) {
            B->x = A->x + dx * k;
            B->y = A->y + dy * k;
          } else if (bF && !aF) {
            A->x = B->x - dx * k;
            A->y = B->y - dy * k;
          } else if (!aF && !bF) {
            const double mx = (A->x + B->x) / 2, my = (A->y + B->y) / 2;
            A->x = mx - dx * k / 2;
            A->y = my - dy * k / 2;
            B->x = mx + dx * k / 2;
            B->y = my + dy * k / 2;
          }
        }
      }
      if (d.type == DIAMETER || d.type == RADIUS) {
        E* e = en(d.ent);
        if (e && (e->t == CERCLE || e->t == ARC)) e->r = jsmax(d.type == DIAMETER ? d.value / 2 : d.value, 0.1);
      }
      if (d.type == ANGLE) {
        const E* A = en(d.a);
        const E* B = en(d.b);
        if (!A || !B || A->t != LIGNE || B->t != LIGNE) continue;
        P2* A1 = pt(A->p1);
        P2* A2 = pt(A->p2);
        P2* B1 = pt(B->p1);
        P2* B2 = pt(B->p2);
        if (!A1 || !A2 || !B1 || !B2) continue;
        const double TAU = PI * 2;
        Cadre fr;
        if (!angleFrame(d, fr)) continue;
        if (d.ccw != 0 && d.ccw != 1) d.ccw = fr.delta >= 0 ? 1 : 0;
        const double want = angleWant(d, fr.delta);
        double e = want - fr.delta;
        if (e > PI) e -= TAU;
        else if (e < -PI) e += TAU;
        if (std::abs(e) < 1e-9) continue;
        int shared = -1;
        if (A->p1 == B->p1 || A->p1 == B->p2) shared = A->p1;
        else if (A->p2 == B->p1 || A->p2 == B->p2) shared = A->p2;
        const bool aFL = fx(A->p1) && fx(A->p2), bFL = fx(B->p1) && fx(B->p2);
        if (aFL && bFL) continue;
        if (shared >= 0) {
          const P2 Vs = P_[shared];
          P2* Ao = A->p1 == shared ? A2 : A1;
          P2* Bo = B->p1 == shared ? B2 : B1;
          const bool aFree = !fx(A->p1 == shared ? A->p2 : A->p1), bFree = !fx(B->p1 == shared ? B->p2 : B->p1);
          if (aFree && bFree) {
            rotP(Ao, Vs.x, Vs.y, -e * 0.25);
            rotP(Bo, Vs.x, Vs.y, +e * 0.25);
          } else if (aFree && !bFree) {
            rotP(Ao, Vs.x, Vs.y, -e * 0.5);
          } else if (bFree && !aFree) {
            rotP(Bo, Vs.x, Vs.y, +e * 0.5);
          }
        } else {
          const double mAx = (A1->x + A2->x) / 2, mAy = (A1->y + A2->y) / 2, mBx = (B1->x + B2->x) / 2, mBy = (B1->y + B2->y) / 2;
          if (!aFL) {
            rotP(A1, mAx, mAy, -e * 0.25);
            rotP(A2, mAx, mAy, -e * 0.25);
          }
          if (!bFL) {
            rotP(B1, mBx, mBy, +e * 0.25);
            rotP(B2, mBx, mBy, +e * 0.25);
          }
        }
      }
      if (d.type == GAP) {
        const E* A = en(d.a);
        const E* B = en(d.b);
        if (!A || !B || A->t != LIGNE || B->t != LIGNE) continue;
        P2* A1 = pt(A->p1);
        P2* A2 = pt(A->p2);
        P2* B1 = pt(B->p1);
        P2* B2 = pt(B->p2);
        if (!A1 || !A2 || !B1 || !B2) continue;
        const double dx = A2->x - A1->x, dy = A2->y - A1->y, L0 = hyp(dx, dy), L = L0 != 0 ? L0 : 1e-9;
        const double nx = -dy / L, ny = dx / L;
        const double signed_ = (B1->x - A1->x) * nx + (B1->y - A1->y) * ny;
        const int sgn = (d.sgn == 1 || d.sgn == -1) ? d.sgn : (signed_ >= 0 ? 1 : -1);
        double err = sgn * (sgn * jsmax(d.value, 0) - signed_);
        if (std::abs(err) < 1e-9) continue;
        err *= 0.5;
        const bool aFree = !fx(A->p1) && !fx(A->p2), bFree = !fx(B->p1) && !fx(B->p2);
        if (!aFree && !bFree) continue;
        if (aFree && !bFree) {
          A1->x -= nx * sgn * err * 2;
          A1->y -= ny * sgn * err * 2;
          A2->x -= nx * sgn * err * 2;
          A2->y -= ny * sgn * err * 2;
        } else if (bFree && !aFree) {
          B1->x += nx * sgn * err * 2;
          B1->y += ny * sgn * err * 2;
          B2->x += nx * sgn * err * 2;
          B2->y += ny * sgn * err * 2;
        } else {
          A1->x -= nx * sgn * err;
          A1->y -= ny * sgn * err;
          A2->x -= nx * sgn * err;
          A2->y -= ny * sgn * err;
          B1->x += nx * sgn * err;
          B1->y += ny * sgn * err;
          B2->x += nx * sgn * err;
          B2->y += ny * sgn * err;
        }
      }
      if (d.type == DISTLINE) {
        const E* l = en(d.line);
        if (!l || l->t != LIGNE) continue;
        P2* Q = pt(d.p);
        if (!Q) continue;
        P2* A = pt(l->p1);
        P2* B = pt(l->p2);
        if (!A || !B) continue;
        const double dx = B->x - A->x, dy = B->y - A->y, L0 = hyp(dx, dy), L = L0 != 0 ? L0 : 1e-9;
        const double nx = -dy / L, ny = dx / L;
        const double signed_ = (Q->x - A->x) * nx + (Q->y - A->y) * ny;
        const int sgn = (d.sgn == 1 || d.sgn == -1) ? d.sgn : (signed_ >= 0 ? 1 : -1);
        const double err = sgn * d.value - signed_;
        if (std::abs(err) < 1e-9) continue;
        const bool pF = fx(d.p), lF = fx(l->p1) && fx(l->p2);
        if (pF && lF) continue;
        if (pF) {
          A->x -= nx * err;
          A->y -= ny * err;
          B->x -= nx * err;
          B->y -= ny * err;
        } else if (lF) {
          Q->x += nx * err;
          Q->y += ny * err;
        } else if (!fx(l->p1) && !fx(l->p2)) {
          const double h = err * 0.5;
          Q->x += nx * h;
          Q->y += ny * h;
          A->x -= nx * h;
          A->y -= ny * h;
          B->x -= nx * h;
          B->y -= ny * h;
        } else {
          Q->x += nx * err;
          Q->y += ny * err;
        }
      }
    }
    for (C& c : C_) {
      if (c.type == COINCIDENT) {
        P2* A = pt(c.a);
        P2* B = pt(c.b);
        if (!A || !B) continue;
        const bool aF = fx(c.a), bF = fx(c.b);
        if (aF && bF) continue;
        const double dx = B->x - A->x, dy = B->y - A->y;
        if (aF) {
          B->x = A->x;
          B->y = A->y;
        } else if (bF) {
          A->x = B->x;
          A->y = B->y;
        } else {
          A->x += dx * 0.5;
          A->y += dy * 0.5;
          B->x -= dx * 0.5;
          B->y -= dy * 0.5;
        }
      }
      if (c.type == ONCIRCLE) {
        P2* Q = pt(c.p);
        const E* X = en(c.ent);
        if (!Q || !X || (X->t != CERCLE && X->t != ARC)) continue;
        P2* CC = pt(X->pc);
        if (!CC) continue;
        const double dx = Q->x - CC->x, dy = Q->y - CC->y, d0 = hyp(dx, dy), d = d0 != 0 ? d0 : 1e-9;
        const double err = X->r - d;
        if (std::abs(err) < 1e-9) continue;
        if (!fx(c.p)) {
          Q->x += dx / d * err * 0.5;
          Q->y += dy / d * err * 0.5;
        } else if (!fx(X->pc)) {
          CC->x -= dx / d * err * 0.5;
          CC->y -= dy / d * err * 0.5;
        }
      }
      if (c.type == ONLINE) {
        P2* Q = pt(c.p);
        const E* l = en(c.line);
        if (!Q || !l || l->t != LIGNE) continue;
        P2* A = pt(l->p1);
        P2* B = pt(l->p2);
        if (!A || !B) continue;
        const double dx = B->x - A->x, dy = B->y - A->y, L2 = dx * dx + dy * dy;
        if (L2 < 1e-12) continue;
        const double L = std::sqrt(L2), nx = -dy / L, ny = dx / L;
        const double signed_ = (Q->x - A->x) * nx + (Q->y - A->y) * ny;
        if (std::abs(signed_) < 1e-9) continue;
        if (!fx(c.p)) {
          const double t = ((Q->x - A->x) * dx + (Q->y - A->y) * dy) / L2;
          const double fx_ = A->x + jsmax(0, jsmin(1, t)) * dx, fy_ = A->y + jsmax(0, jsmin(1, t)) * dy;
          Q->x += (fx_ - Q->x) * 0.5;
          Q->y += (fy_ - Q->y) * 0.5;
        } else {
          const double sh = -signed_ * 0.5;
          const bool aF = fx(l->p1), bF = fx(l->p2);
          if (aF && !bF) {
            B->x += nx * sh;
            B->y += ny * sh;
          } else if (bF && !aF) {
            A->x += nx * sh;
            A->y += ny * sh;
          } else if (!aF && !bF) {
            A->x += nx * sh;
            A->y += ny * sh;
            B->x += nx * sh;
            B->y += ny * sh;
          }
        }
      }
      if (c.type == MIDPOINT) {
        if (c.aP) {
          P2* Q = pt(c.p);
          const E* l = en(c.line);
          if (!Q || !l || l->t != LIGNE) continue;
          P2* A = pt(l->p1);
          P2* B = pt(l->p2);
          if (!A || !B) continue;
          const double ex = (A->x + B->x) / 2 - Q->x, ey = (A->y + B->y) / 2 - Q->y;
          if (std::abs(ex) < 1e-9 && std::abs(ey) < 1e-9) continue;
          if (!fx(c.p)) {
            Q->x += ex * 0.5;
            Q->y += ey * 0.5;
          } else {
            const bool aF = fx(l->p1), bF = fx(l->p2);
            if (aF && bF) continue;
            if (aF || bF) {
              if (!aF) {
                A->x -= ex;
                A->y -= ey;
              } else {
                B->x -= ex;
                B->y -= ey;
              }
            } else {
              A->x -= ex * 0.5;
              A->y -= ey * 0.5;
              B->x -= ex * 0.5;
              B->y -= ey * 0.5;
            }
          }
        } else if (c.aA && c.aB) {
          const E* la = en(c.a);
          const E* lb = en(c.b);
          if (!la || !lb || la->t != LIGNE || lb->t != LIGNE) continue;
          P2* A1 = pt(la->p1);
          P2* A2 = pt(la->p2);
          P2* B1 = pt(lb->p1);
          P2* B2 = pt(lb->p2);
          if (!A1 || !A2 || !B1 || !B2) continue;
          P2* fa[2];
          P2* fb[2];
          int na = 0, nb = 0;
          if (!fx(la->p1)) fa[na++] = A1;
          if (!fx(la->p2)) fa[na++] = A2;
          if (!fx(lb->p1)) fb[nb++] = B1;
          if (!fx(lb->p2)) fb[nb++] = B2;
          if (!na && !nb) continue;
          const double gx = ((B1->x + B2->x) - (A1->x + A2->x)) / 2, gy = ((B1->y + B2->y) - (A1->y + A2->y)) / 2;
          if (std::abs(gx) < 1e-9 && std::abs(gy) < 1e-9) continue;
          const double ka = na ? (nb ? 0.5 : 1) : 0, kb = nb ? (na ? 0.5 : 1) : 0;
          if (na) {
            const double hx = gx * ka / na, hy = gy * ka / na;
            for (int i = 0; i < na; i++) {
              fa[i]->x += hx;
              fa[i]->y += hy;
            }
          }
          if (nb) {
            const double hx = -gx * kb / nb, hy = -gy * kb / nb;
            for (int i = 0; i < nb; i++) {
              fb[i]->x += hx;
              fb[i]->y += hy;
            }
          }
        }
      }
      if (c.type == H || c.type == V) {
        const E* l = en(c.line);
        if (!l || l->t != LIGNE) continue;
        P2* A = pt(l->p1);
        P2* B = pt(l->p2);
        if (!A || !B) continue;
        const bool aF = fx(l->p1), bF = fx(l->p2);
        if (aF && bF) continue;
        double& a = c.type == H ? A->y : A->x;
        double& b = c.type == H ? B->y : B->x;
        if (aF && !bF) {
          b = a;
        } else if (bF && !aF) {
          a = b;
        } else {
          const double m = (a + b) / 2;
          a = m;
          b = m;
        }
      }
      if (c.type == PARALLEL || c.type == PERPENDICULAR) {
        const E* A = en(c.a);
        const E* B = en(c.b);
        if (!A || !B || A->t != LIGNE || B->t != LIGNE) continue;
        const double T = c.type == PARALLEL ? 0 : PI / 2;
        const auto ugap = [](double a, double b) {
          const double x = std::fmod(std::fmod(b - a, PI) + PI, PI);
          return jsmin(x, PI - x);
        };
        P2* A1 = pt(A->p1);
        P2* A2 = pt(A->p2);
        P2* B1 = pt(B->p1);
        P2* B2 = pt(B->p2);
        if (!A1 || !A2 || !B1 || !B2) continue;
        const double sA = m_atan2(A2->y - A1->y, A2->x - A1->x), sB = m_atan2(B2->y - B1->y, B2->x - B1->x);
        const double e = T - ugap(sA, sB);
        if (std::abs(e) < 1e-9) continue;
        const double h = 0.02;
        const int sgn = std::abs(ugap(sA + h, sB - h) - T) < std::abs(ugap(sA - h, sB + h) - T) ? 1 : -1;
        int shared = -1;
        if (A->p1 == B->p1 || A->p1 == B->p2) shared = A->p1;
        else if (A->p2 == B->p1 || A->p2 == B->p2) shared = A->p2;
        const bool aFL = fx(A->p1) && fx(A->p2), bFL = fx(B->p1) && fx(B->p2);
        if (aFL && bFL) continue;
        const double m = std::abs(e);
        if (shared >= 0) {
          const P2 Vs = P_[shared];
          P2* Ao = A->p1 == shared ? A2 : A1;
          P2* Bo = B->p1 == shared ? B2 : B1;
          const bool aFree = !fx(A->p1 == shared ? A->p2 : A->p1), bFree = !fx(B->p1 == shared ? B->p2 : B->p1);
          if (aFree && bFree) {
            rotP(Ao, Vs.x, Vs.y, sgn * m * 0.25);
            rotP(Bo, Vs.x, Vs.y, -sgn * m * 0.25);
          } else if (aFree && !bFree) {
            rotP(Ao, Vs.x, Vs.y, sgn * m * 0.5);
          } else if (bFree && !aFree) {
            rotP(Bo, Vs.x, Vs.y, -sgn * m * 0.5);
          }
        } else {
          const double mAx = (A1->x + A2->x) / 2, mAy = (A1->y + A2->y) / 2, mBx = (B1->x + B2->x) / 2, mBy = (B1->y + B2->y) / 2;
          if (!aFL) {
            rotP(A1, mAx, mAy, sgn * m * 0.25);
            rotP(A2, mAx, mAy, sgn * m * 0.25);
          }
          if (!bFL) {
            rotP(B1, mBx, mBy, -sgn * m * 0.25);
            rotP(B2, mBx, mBy, -sgn * m * 0.25);
          }
        }
      }
      if (c.type == EQUAL) {
        E* A = en(c.a);
        E* B = en(c.b);
        if (!A || !B) continue;
        if (A->t == LIGNE && B->t == LIGNE) {
          const double t = (lineLen(*A) + lineLen(*B)) / 2;
          scaleLine(*A, t);
          scaleLine(*B, t);
        } else if ((A->t == CERCLE || A->t == ARC) && (B->t == CERCLE || B->t == ARC)) {
          const bool la = A->verrouille, lb = B->verrouille;
          if (la && !lb) {
            B->r = jsmax(A->r, .1);
          } else if (lb && !la) {
            A->r = jsmax(B->r, .1);
          } else {
            const double t = jsmax((A->r + B->r) / 2, .1);
            A->r = t;
            B->r = t;
          }
        }
      }
      if (c.type == TANGENT) {
        const E* L = en(c.line);
        E* X = en(c.ent);
        if (!L || !X || L->t != LIGNE || (X->t != CERCLE && X->t != ARC)) continue;
        P2* A = pt(L->p1);
        P2* B = pt(L->p2);
        P2* CC = pt(X->pc);
        if (!A || !B || !CC) continue;
        const double dx = B->x - A->x, dy = B->y - A->y, l0 = hyp(dx, dy), len = l0 != 0 ? l0 : 1e-9;
        const double nx = -dy / len, ny = dx / len, ux = dx / len, uy = dy / len;
        const double dist = (CC->x - A->x) * nx + (CC->y - A->y) * ny;
        const int sgn = c.cote ? c.cote : (dist >= 0 ? 1 : -1);
        const double Er = sgn * dist - X->r, s = sgn * Er * 0.5;
        const bool aF = fx(L->p1), bF = fx(L->p2), cF = fx(X->pc);
        if (std::abs(Er) >= 1e-9) {
          if (aF && bF && cF) {
            if (!X->verrouille) X->r = jsmax(std::abs(dist), 0.1);
            continue;
          }
          const double gLine = (!aF && !bF) ? 0.5 : 0.85, gCtr = ((!aF || !bF) && !cF) ? 0.5 : 1.0;
          if (!aF && !bF) {
            A->x += nx * s * gLine;
            A->y += ny * s * gLine;
            B->x += nx * s * gLine;
            B->y += ny * s * gLine;
          } else if (!aF) {
            A->x += nx * s * 2 * gLine;
            A->y += ny * s * 2 * gLine;
          } else if (!bF) {
            B->x += nx * s * 2 * gLine;
            B->y += ny * s * 2 * gLine;
          }
          if (!cF) {
            CC->x -= nx * s * 2 * gCtr;
            CC->y -= ny * s * 2 * gCtr;
          }
        }
        if (!c.surCote) {
          const double t = ((CC->x - A->x) * ux + (CC->y - A->y) * uy) / len;
          if (t < 0 && !aF && !c.partage1) {
            const double d = -t * len + jsmax(0.5, len * 1e-3);
            A->x -= ux * d;
            A->y -= uy * d;
          } else if (t > 1 && !bF && !c.partage2) {
            const double d = (t - 1) * len + jsmax(0.5, len * 1e-3);
            B->x += ux * d;
            B->y += uy * d;
          }
        }
      }
      if (c.type == SYMMETRIC) {
        const E* A = en(c.a);
        const E* B = en(c.b);
        const E* M = en(c.mid);
        if (!A || !B || !M || A->t != LIGNE || B->t != LIGNE || M->t != LIGNE) continue;
        P2* A1 = pt(A->p1);
        P2* A2 = pt(A->p2);
        P2* B1 = pt(B->p1);
        P2* B2 = pt(B->p2);
        P2* M1 = pt(M->p1);
        P2* M2 = pt(M->p2);
        if (!A1 || !A2 || !B1 || !B2 || !M1 || !M2) continue;
        const double mx = M2->x - M1->x, my = M2->y - M1->y, ml0 = hyp(mx, my), ml = ml0 != 0 ? ml0 : 1e-9, ux = mx / ml, uy = my / ml;
        if (c.inf) {
          const double bx = B2->x - B1->x, by = B2->y - B1->y, bl0 = hyp(bx, by), bl = bl0 != 0 ? bl0 : 1e-9, nx = -by / bl, ny = bx / bl;
          const std::pair<P2*, int> bouts[2] = {{A1, A->p1}, {A2, A->p2}};
          for (const auto& [Q, pid] : bouts) {
            const double wx = Q->x - M1->x, wy = Q->y - M1->y, pr = wx * ux + wy * uy;
            const double rx = 2 * (M1->x + ux * pr) - Q->x, ry = 2 * (M1->y + uy * pr) - Q->y;
            const double err = (rx - B1->x) * nx + (ry - B1->y) * ny;
            if (std::abs(err) < 1e-12) continue;
            const bool bF = fx(B->p1) || fx(B->p2), aF = fx(pid);
            const double kA = aF ? 0 : (bF ? 1 : 0.5), kB = bF ? 0 : (aF ? 1 : 0.5);
            if (kB != 0) {
              B1->x += nx * err * kB * 0.5;
              B1->y += ny * err * kB * 0.5;
              B2->x += nx * err * kB * 0.5;
              B2->y += ny * err * kB * 0.5;
            }
            if (kA != 0) {
              const double vx = -nx * err * kA, vy = -ny * err * kA, dd = vx * ux + vy * uy;
              Q->x += 2 * dd * ux - vx;
              Q->y += 2 * dd * uy - vy;
            }
          }
          continue;
        }
        const auto refl = [&](double Px, double Py) {
          const double wx = Px - M1->x, wy = Py - M1->y, proj = wx * ux + wy * uy;
          const double px = M1->x + ux * proj, py = M1->y + uy * proj;
          return P2{2 * px - Px, 2 * py - Py};
        };
        const P2 RA1 = refl(A1->x, A1->y), RA2 = refl(A2->x, A2->y), RB1 = refl(B1->x, B1->y), RB2 = refl(B2->x, B2->y);
        const double d1 = hyp(RA1.x - B1->x, RA1.y - B1->y) + hyp(RA2.x - B2->x, RA2.y - B2->y);
        const double d2 = hyp(RA1.x - B2->x, RA1.y - B2->y) + hyp(RA2.x - B1->x, RA2.y - B1->y);
        const bool swap = d2 < d1;
        struct Paire {
          P2* PA;
          P2* PB;
          P2 RA, RB;
        };
        const Paire paires[2] = {swap ? Paire{A1, B2, RA1, RB2} : Paire{A1, B1, RA1, RB1}, swap ? Paire{A2, B1, RA2, RB1} : Paire{A2, B2, RA2, RB2}};
        const bool aFL = fx(A->p1) && fx(A->p2), bFL = fx(B->p1) && fx(B->p2);
        if (aFL && bFL) continue;
        for (const Paire& q : paires) {
          const bool aFree = !(q.PA == A1 ? fx(A->p1) : q.PA == A2 ? fx(A->p2) : false);
          const bool bFree = !(q.PB == B1 ? fx(B->p1) : q.PB == B2 ? fx(B->p2) : false);
          if (aFree && bFree) {
            const double ex = (q.RB.x - q.PA->x) * 0.25, ey = (q.RB.y - q.PA->y) * 0.25, fx1 = (q.RA.x - q.PB->x) * 0.25, fy1 = (q.RA.y - q.PB->y) * 0.25;
            q.PA->x += ex;
            q.PA->y += ey;
            q.PB->x += fx1;
            q.PB->y += fy1;
          } else if (aFree && !bFree) {
            q.PA->x = q.RB.x;
            q.PA->y = q.RB.y;
          } else if (bFree && !aFree) {
            q.PB->x = q.RA.x;
            q.PB->y = q.RA.y;
          }
        }
      }
      if (c.type == TANGENT2) {
        const E* A = en(c.a);
        const E* B = en(c.b);
        if (!A || !B) continue;
        if ((A->t != CERCLE && A->t != ARC) || (B->t != CERCLE && B->t != ARC)) continue;
        P2* CA = pt(A->pc);
        P2* CB = pt(B->pc);
        if (!CA || !CB) continue;
        const double dx = CB->x - CA->x, dy = CB->y - CA->y, d0 = hyp(dx, dy), d = d0 != 0 ? d0 : 1e-9;
        const double err = d - (A->r + B->r);
        if (std::abs(err) < 1e-9) continue;
        const double ux = dx / d, uy = dy / d;
        const bool aF = fx(A->pc), bF = fx(B->pc);
        if (!aF && !bF) {
          CA->x += ux * err * 0.25;
          CA->y += uy * err * 0.25;
          CB->x -= ux * err * 0.25;
          CB->y -= uy * err * 0.25;
        } else if (!aF) {
          CA->x += ux * err * 0.5;
          CA->y += uy * err * 0.5;
        } else if (!bF) {
          CB->x -= ux * err * 0.5;
          CB->y -= uy * err * 0.5;
        }
      }
      if (c.type == COLLINEAR) {
        const E* la = en(c.a);
        const E* lb = en(c.b);
        if (!la || !lb || la->t != LIGNE || lb->t != LIGNE) continue;
        P2* A1 = pt(la->p1);
        P2* A2 = pt(la->p2);
        P2* B1 = pt(lb->p1);
        P2* B2 = pt(lb->p2);
        if (!A1 || !A2 || !B1 || !B2) continue;
        const bool aFL = fx(la->p1) && fx(la->p2), bFL = fx(lb->p1) && fx(lb->p2);
        if (aFL && bFL) continue;
        const auto toward = [&](P2* Q, int qid, const P2* U1, const P2* U2, double k) {
          if (fx(qid)) return;
          const double dx = U2->x - U1->x, dy = U2->y - U1->y, L2 = dx * dx + dy * dy;
          if (L2 < 1e-12) return;
          const double t = ((Q->x - U1->x) * dx + (Q->y - U1->y) * dy) / L2;
          Q->x += (U1->x + t * dx - Q->x) * k;
          Q->y += (U1->y + t * dy - Q->y) * k;
        };
        const double kb = aFL ? 1 : (bFL ? 0 : 0.5), ka = bFL ? 1 : (aFL ? 0 : 0.5);
        if (kb > 0) {
          toward(B1, lb->p1, A1, A2, kb * 0.5);
          toward(B2, lb->p2, A1, A2, kb * 0.5);
        }
        if (ka > 0) {
          toward(A1, la->p1, B1, B2, ka * 0.5);
          toward(A2, la->p2, B1, B2, ka * 0.5);
        }
      }
      if (c.type == COAXIAL) {
        const E* A = en(c.a);
        const E* B = en(c.b);
        if (!A || !B) continue;
        if ((A->t != CERCLE && A->t != ARC) || (B->t != CERCLE && B->t != ARC)) continue;
        P2* CA = pt(A->pc);
        P2* CB = pt(B->pc);
        if (!CA || !CB) continue;
        const bool aF = fx(A->pc), bF = fx(B->pc);
        if (aF && bF) continue;
        const double mx = (CA->x + CB->x) / 2, my = (CA->y + CB->y) / 2;
        if (!aF) {
          CA->x += (mx - CA->x) * 0.5;
          CA->y += (my - CA->y) * 0.5;
        }
        if (!bF) {
          CB->x += (mx - CB->x) * 0.5;
          CB->y += (my - CB->y) * 0.5;
        }
      }
    }
    for (E& e : E_) {
      if (e.t != ARC) continue;
      const P2* CC = pt(e.pc);
      P2* A = pt(e.pa);
      P2* B = pt(e.pb);
      if (!CC || !A || !B) continue;
      const P2* Dd = fx(e.pb) && !fx(e.pa) ? B : A;
      if (!e.verrouille) {
        const double ra = hyp(Dd->x - CC->x, Dd->y - CC->y);
        if (ra > 1e-9) e.r = ra;
      }
      const double rr = jsmax(e.r, 1e-9);
      const auto proj = [&](P2* Q) {
        const double aa = m_atan2(Q->y - CC->y, Q->x - CC->x);
        Q->x += (CC->x + rr * m_cos(aa) - Q->x) * 0.5;
        Q->y += (CC->y + rr * m_sin(aa) - Q->y) * 0.5;
      };
      if (!fx(e.pa)) proj(A);
      if (!fx(e.pb)) proj(B);
    }
  }
}

/* ----- moindres carrés ----- */
Solveur::Build Solveur::sklsBuild() {
  Build B;
  for (size_t q = 0; q < P_.size(); q++)
    if (!fix_[q]) B.pts.push_back(static_cast<int>(q));
  for (size_t i = 0; i < E_.size(); i++)
    if ((E_[i].t == CERCLE || E_[i].t == ARC) && !E_[i].verrouille) {
      B.rad.push_back(static_cast<int>(i));
      B.r0.push_back(E_[i].r);
    }
  B.slide.assign(P_.size(), 0);
  for (const C& c : C_)
    if ((c.type == ONLINE || c.type == ONCIRCLE) && c.p >= 0) B.slide[c.p] = 1;
  B.n = 2 * static_cast<int>(B.pts.size()) + static_cast<int>(B.rad.size());
  return B;
}

void Solveur::sklsApply(const Build& B, const std::vector<double>& x) {
  for (size_t i = 0; i < B.pts.size(); i++) {
    P2& p = P_[B.pts[i]];
    p.x = x[2 * i];
    p.y = x[2 * i + 1];
  }
  for (size_t j = 0; j < B.rad.size(); j++) E_[B.rad[j]].r = jsmax(x[2 * B.pts.size() + j], 0.01);
}

void Solveur::collect(std::vector<double>& out, const Build& B) {
  out.clear();
  const auto push = [&](double f) {
    if (std::isfinite(f)) out.push_back(f);
  };
  struct Vc {
    double ux, uy, L;
  };
  const auto vec = [&](const E& l, Vc& v) {
    const P2* A = pt(l.p1);
    const P2* Q = pt(l.p2);
    if (!A || !Q) return false;
    const double L0 = hyp(Q->x - A->x, Q->y - A->y), L = L0 != 0 ? L0 : 1e-9;
    v = {(Q->x - A->x) / L, (Q->y - A->y) / L, L};
    return true;
  };
  for (const D& d : D_) {
    if (d.ref) continue;
    if (d.type == LENGTH) {
      const E* l = en(d.line);
      if (l && l->t == LIGNE) {
        if (d.orient == 'h' || d.orient == 'v') {
          const P2* A = pt(l->p1);
          const P2* Q = pt(l->p2);
          if (A && Q) push(mesure(A->x, A->y, Q->x, Q->y, d.orient) - jsmax(d.value, 0));
        } else {
          push(lineLen(*l) - jsmax(d.value, 0.1));
        }
      }
    }
    if (d.type == DISTANCE) {
      const P2* A = pt(d.a);
      const P2* Q = pt(d.b);
      if (A && Q) push(mesure(A->x, A->y, Q->x, Q->y, d.orient) - jsmax(d.value, 0));
    }
    if (d.type == DIAMETER || d.type == RADIUS) {
      const E* e = en(d.ent);
      if (e && (e->t == CERCLE || e->t == ARC)) push(e->r - (d.type == DIAMETER ? d.value / 2 : d.value));
    }
    if (d.type == ANGLE) {
      Cadre fr;
      if (angleFrame(d, fr)) {
        const double TAU = PI * 2, want = angleWant(d, fr.delta);
        double e = want - fr.delta;
        if (e > PI) e -= TAU;
        else if (e < -PI) e += TAU;
        push(e * echelleAngle(fr.rA, fr.rB));
      }
    }
    if (d.type == GAP) {
      const E* A = en(d.a);
      const E* Q = en(d.b);
      if (A && Q && A->t == LIGNE && Q->t == LIGNE) {
        Vc va, vb;
        if (vec(*A, va) && vec(*Q, vb)) {
          const double nx = -va.uy, ny = va.ux;
          const P2* sA = pt(A->p1);
          const P2* fB = pt(Q->p1);
          if (sA && fB) {
            const double signed_ = (fB->x - sA->x) * nx + (fB->y - sA->y) * ny, w = jsmax(d.value, 0);
            push((d.sgn == 1 || d.sgn == -1) ? (signed_ - d.sgn * w) : (w > 0 ? (signed_ * signed_ - w * w) / (2 * w) : signed_));
          }
        }
      }
    }
    if (d.type == DISTLINE) {
      const E* l = en(d.line);
      const P2* Q = pt(d.p);
      if (l && l->t == LIGNE && Q) {
        Vc v;
        if (vec(*l, v)) {
          const double nx = -v.uy, ny = v.ux;
          const P2* A = pt(l->p1);
          if (A) {
            const double signed_ = (Q->x - A->x) * nx + (Q->y - A->y) * ny, w = jsmax(d.value, 0);
            push((d.sgn == 1 || d.sgn == -1) ? (signed_ - d.sgn * w) : (w > 0 ? (signed_ * signed_ - w * w) / (2 * w) : signed_));
          }
        }
      }
    }
  }
  const size_t g0 = out.size();
  for (const C& c : C_) {
    switch (c.type) {
      case H:
      case V: {
        const E* l = en(c.line);
        if (l && l->t == LIGNE && l->p1 >= 0 && l->p2 >= 0) push(c.type == H ? P_[l->p1].y - P_[l->p2].y : P_[l->p1].x - P_[l->p2].x);
        break;
      }
      case COINCIDENT: {
        const P2* A = pt(c.a);
        const P2* Q = pt(c.b);
        if (A && Q) {
          push(A->x - Q->x);
          push(A->y - Q->y);
        }
        break;
      }
      case ONCIRCLE: {
        const P2* Q = pt(c.p);
        const E* X = en(c.ent);
        if (Q && X && (X->t == CERCLE || X->t == ARC)) {
          const P2* CC = pt(X->pc);
          if (CC) push(hyp(Q->x - CC->x, Q->y - CC->y) - X->r);
        }
        break;
      }
      case ONLINE: {
        const P2* Q = pt(c.p);
        const E* l = en(c.line);
        if (Q && l && l->t == LIGNE) {
          const P2* A = pt(l->p1);
          const P2* W = pt(l->p2);
          if (A && W) {
            const double dx = W->x - A->x, dy = W->y - A->y, L = hyp(dx, dy);
            if (L > 1e-9) push((Q->x - A->x) * (-dy / L) + (Q->y - A->y) * (dx / L));
          }
        }
        break;
      }
      case MIDPOINT: {
        if (c.aP) {
          const P2* Q = pt(c.p);
          const E* l = en(c.line);
          if (Q && l && l->t == LIGNE) {
            const P2* A = pt(l->p1);
            const P2* W = pt(l->p2);
            if (A && W) {
              push(Q->x - (A->x + W->x) / 2);
              push(Q->y - (A->y + W->y) / 2);
            }
          }
        } else if (c.aA && c.aB) {
          const E* A = en(c.a);
          const E* W = en(c.b);
          if (A && W && A->t == LIGNE && W->t == LIGNE) {
            const P2* A1 = pt(A->p1);
            const P2* A2 = pt(A->p2);
            const P2* B1 = pt(W->p1);
            const P2* B2 = pt(W->p2);
            if (A1 && A2 && B1 && B2) {
              push((A1->x + A2->x) / 2 - (B1->x + B2->x) / 2);
              push((A1->y + A2->y) / 2 - (B1->y + B2->y) / 2);
            }
          }
        }
        break;
      }
      case PARALLEL:
      case PERPENDICULAR: {
        const E* A = en(c.a);
        const E* W = en(c.b);
        if (A && W && A->t == LIGNE && W->t == LIGNE) {
          Vc va, vb;
          if (vec(*A, va) && vec(*W, vb)) {
            if (c.type == PARALLEL) push(va.ux * vb.uy - va.uy * vb.ux);
            else push(va.ux * vb.ux + va.uy * vb.uy);
          }
        }
        break;
      }
      case COLLINEAR: {
        const E* A = en(c.a);
        const E* W = en(c.b);
        if (A && W && A->t == LIGNE && W->t == LIGNE) {
          Vc va;
          const bool ok = vec(*A, va);
          const P2* A1 = pt(A->p1);
          const P2* B1 = pt(W->p1);
          const P2* B2 = pt(W->p2);
          if (ok && A1 && B1 && B2) {
            const double nx = -va.uy, ny = va.ux;
            push((B1->x - A1->x) * nx + (B1->y - A1->y) * ny);
            push((B2->x - A1->x) * nx + (B2->y - A1->y) * ny);
          }
        }
        break;
      }
      case EQUAL: {
        const E* A = en(c.a);
        const E* W = en(c.b);
        if (A && W) {
          if (A->t == LIGNE && W->t == LIGNE) {
            // nrm : 0 si un point manque, comme lineLen
            push(lineLen(*A) - lineLen(*W));
          } else if ((A->t == CERCLE || A->t == ARC) && (W->t == CERCLE || W->t == ARC)) {
            push(A->r - W->r);
          }
        }
        break;
      }
      case OFFSET: {
        double v1, v2;
        if (offsetVal(c.a, c.b, c.sa, v1) && offsetVal(c.c, c.d, c.sb, v2)) push(v2 - v1);
        break;
      }
      case TANGENT: {
        const E* L = en(c.line);
        const E* X = en(c.ent);
        if (L && X && L->t == LIGNE && (X->t == CERCLE || X->t == ARC)) {
          const P2* A = pt(L->p1);
          const P2* W = pt(L->p2);
          const P2* CC = pt(X->pc);
          if (A && W && CC) {
            const double dx = W->x - A->x, dy = W->y - A->y, l0 = hyp(dx, dy), len = l0 != 0 ? l0 : 1e-9;
            const double ux = dx / len, uy = dy / len;
            const double d = (CC->x - A->x) * (-uy) + (CC->y - A->y) * ux;
            if (c.cote) push(d - c.cote * X->r);
            else push((d * d - X->r * X->r) / jsmax(1e-6, std::abs(d) + std::abs(X->r)));
          }
        }
        break;
      }
      case TANGENT2: {
        const E* A = en(c.a);
        const E* W = en(c.b);
        if (A && W && (A->t == CERCLE || A->t == ARC) && (W->t == CERCLE || W->t == ARC)) {
          const P2* CA = pt(A->pc);
          const P2* CB = pt(W->pc);
          if (CA && CB) push(hyp(CB->x - CA->x, CB->y - CA->y) - (A->r + W->r));
        }
        break;
      }
      case COAXIAL: {
        const E* A = en(c.a);
        const E* W = en(c.b);
        if (A && W && (A->t == CERCLE || A->t == ARC) && (W->t == CERCLE || W->t == ARC)) {
          const P2* CA = pt(A->pc);
          const P2* CB = pt(W->pc);
          if (CA && CB) {
            push(CA->x - CB->x);
            push(CA->y - CB->y);
          }
        }
        break;
      }
      case SYMMETRIC: {
        const E* A = en(c.a);
        const E* W = en(c.b);
        const E* M = en(c.mid);
        if (A && W && M && A->t == LIGNE && W->t == LIGNE && M->t == LIGNE) {
          const P2* A1 = pt(A->p1);
          const P2* A2 = pt(A->p2);
          const P2* B1 = pt(W->p1);
          const P2* B2 = pt(W->p2);
          const P2* M1 = pt(M->p1);
          const P2* M2 = pt(M->p2);
          if (A1 && A2 && B1 && B2 && M1 && M2) {
            const double mx = M2->x - M1->x, my = M2->y - M1->y, ml0 = hyp(mx, my), ml = ml0 != 0 ? ml0 : 1e-9, ux = mx / ml, uy = my / ml;
            const auto refl = [&](const P2* Q) {
              const double wx = Q->x - M1->x, wy = Q->y - M1->y, pr = wx * ux + wy * uy;
              return P2{2 * (M1->x + ux * pr) - Q->x, 2 * (M1->y + uy * pr) - Q->y};
            };
            const P2 rA1 = refl(A1), rA2 = refl(A2);
            if (c.inf) {
              const double bx = B2->x - B1->x, by = B2->y - B1->y, bl0 = hyp(bx, by), bl = bl0 != 0 ? bl0 : 1e-9, nx = -by / bl, ny = bx / bl;
              push((rA1.x - B1->x) * nx + (rA1.y - B1->y) * ny);
              push((rA2.x - B1->x) * nx + (rA2.y - B1->y) * ny);
            } else {
              const double d1 = hyp(rA1.x - B1->x, rA1.y - B1->y) + hyp(rA2.x - B2->x, rA2.y - B2->y);
              const double d2 = hyp(rA1.x - B2->x, rA1.y - B2->y) + hyp(rA2.x - B1->x, rA2.y - B1->y);
              if (d2 < d1) {
                push(rA1.x - B2->x);
                push(rA1.y - B2->y);
                push(rA2.x - B1->x);
                push(rA2.y - B1->y);
              } else {
                push(rA1.x - B1->x);
                push(rA1.y - B1->y);
                push(rA2.x - B2->x);
                push(rA2.y - B2->y);
              }
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }
  for (const E& e : E_) {
    if (e.t != ARC) continue;
    const P2* CC = pt(e.pc);
    if (!CC) continue;
    const bool rigid = (e.pc >= 0 && fix_[e.pc]) && e.verrouille;
    const P2* A = pt(e.pa);
    const P2* W = pt(e.pb);
    if (A && !(fix_[e.pa] && rigid)) push(hyp(A->x - CC->x, A->y - CC->y) - e.r);
    if (W && !(fix_[e.pb] && rigid)) push(hyp(W->x - CC->x, W->y - CC->y) - e.r);
  }
  for (size_t gi = g0; gi < out.size(); gi++) out[gi] *= SK_GEO_W;
  for (size_t j = 0; j < B.rad.size(); j++) {
    const E& e = E_[B.rad[j]];
    if (e.conduit) continue;
    push((e.r - B.r0[j]) * 1.0);
  }
}

void Solveur::lm(const Build& B, std::vector<double>& x, int iters) {
  const int n = static_cast<int>(x.size());
  if (n <= 0) return;
  std::vector<double> f, fph, fmi, fp, fm;
  const auto apply = [&]() { sklsApply(B, x); };
  const auto collecte = [&](std::vector<double>& out) {
    collect(out, B);
    double s = 0;
    for (double v : out) s += v * v;
    return s;
  };
  std::vector<double> what(n);
  double bestCur = INFINI;
  bool hasBest = false;
  const auto saveBest = [&]() {
    const double c = collecte(f);
    if (c < bestCur) {
      bestCur = c;
      hasBest = true;
      what = x;
    }
    return c;
  };
  const auto restoreBest = [&]() {
    if (!hasBest) return;
    x = what;
    apply();
  };
  apply();
  double cur = saveBest();
  if (!std::isfinite(cur) || cur > 1e15) {
    restoreBest();
    return;
  }
  std::vector<double> W(n, 1.0);
  for (size_t i = 0; i < B.pts.size(); i++)
    if (B.slide[B.pts[i]]) {
      W[2 * i] = SK_SLIDE_W;
      W[2 * i + 1] = SK_SLIDE_W;
    }
  double lam = 1e-3;
  std::vector<std::vector<int>> pat;
  bool aPat = false;
  std::vector<std::vector<int>> groups;
  std::string sig;
  bool aSig = false, needFull = false, sparseUsed = false;
  const auto regroup = [&]() {
    std::vector<int> order(n);
    for (int i = 0; i < n; i++) order[i] = i;
    std::stable_sort(order.begin(), order.end(), [&](int a, int b) { return pat[b].size() < pat[a].size(); });
    std::vector<std::vector<unsigned char>> used;
    groups.clear();
    for (int j : order) {
      size_t g = 0;
      for (; g < groups.size(); g++) {
        const auto& u = used[g];
        bool libre = true;
        for (int r : pat[j])
          if (u[r]) {
            libre = false;
            break;
          }
        if (libre) break;
      }
      if (g == groups.size()) {
        groups.emplace_back();
        used.emplace_back(f.size(), 0);
      }
      groups[g].push_back(j);
      for (int r : pat[j]) used[g][r] = 1;
    }
    aPat_ = true;
    patSig_ = sig;
    pat_ = pat;
  };
  std::vector<double> J, g, H, A, dg, xsv, nzv, x0, hs;
  std::vector<int> nzi;
  for (int it = 0; it < iters; it++) {
    collecte(f);
    const int m = static_cast<int>(f.size());
    if (!m) return;
    if (cur < 1e-24) break;
    if (!aSig) {
      aSig = true;
      sig = std::to_string(m) + "|";
      for (int q : B.pts) sig += idP_[q] + ",";
      sig += "|";
      for (int e : B.rad) sig += E_[e].id + ",";
      sig += "|";
      for (const C& c : C_) sig += c.id + ",";
      sig += "|";
      for (const D& d : D_) sig += d.id + (d.ref ? "r," : ",");
      if (aPat_ && patSig_ == sig) {
        pat = pat_;
        aPat = true;
        regroup();
      }
    }
    J.assign(static_cast<size_t>(m) * n, 0.0);
    int nR = m;
    const bool full = !aPat || needFull;
    needFull = false;
    if (full) {
      sparseUsed = false;
      for (int j = 0; j < n; j++) {
        const double xj = x[j], h = jsmax(1e-7, std::abs(xj) * 1e-6);
        x[j] = xj + h;
        apply();
        collect(fp, B);
        x[j] = xj - h;
        apply();
        collect(fm, B);
        x[j] = xj;
        apply();
        nR = static_cast<int>(fp.size());
        if (fm.size() != fp.size()) nR = -1;
        for (int r = 0; r < nR && r < m; r++) J[static_cast<size_t>(r) * n + j] = (fp[r] - fm[r]) / (2 * h);
      }
      if (nR == m) {
        std::vector<std::vector<int>> np(n);
        for (int j = 0; j < n; j++) {
          std::set<int> s;
          if (aPat) s.insert(pat[j].begin(), pat[j].end());
          for (int r = 0; r < m; r++)
            if (J[static_cast<size_t>(r) * n + j] != 0) s.insert(r);
          np[j].assign(s.begin(), s.end());
        }
        pat = std::move(np);
        aPat = true;
        regroup();
      }
    } else {
      sparseUsed = true;
      x0 = x;
      hs.resize(n);
      for (int j = 0; j < n; j++) hs[j] = jsmax(1e-7, std::abs(x0[j]) * 1e-6);
      for (const std::vector<int>& G : groups) {
        for (int j : G) x[j] = x0[j] + hs[j];
        apply();
        collect(fph, B);
        for (int j : G) x[j] = x0[j] - hs[j];
        apply();
        collect(fmi, B);
        for (int j : G) x[j] = x0[j];
        if (static_cast<int>(fph.size()) != m || static_cast<int>(fmi.size()) != m) {
          nR = -1;
          break;
        }
        for (int j : G) {
          const double h2 = 2 * hs[j];
          for (int r : pat[j]) J[static_cast<size_t>(r) * n + j] = (fph[r] - fmi[r]) / h2;
        }
      }
      apply();
      if (nR != m) {
        aPat = false;
        pat.clear();
        aPat_ = false;
        it--;
        continue;
      }
    }
    if (nR != m) break;
    g.assign(n, 0.0);
    H.assign(static_cast<size_t>(n) * n, 0.0);
    nzi.resize(n);
    nzv.resize(n);
    for (int r = 0; r < m; r++) {
      int k = 0;
      const size_t o = static_cast<size_t>(r) * n;
      const double fr = f[r];
      for (int j = 0; j < n; j++) {
        const double v = J[o + j];
        if (v != 0) {
          nzi[k] = j;
          nzv[k] = v;
          k++;
        }
      }
      for (int a = 0; a < k; a++) {
        const int i = nzi[a];
        const double va = nzv[a];
        g[i] += va * fr;
        const size_t oi = static_cast<size_t>(i) * n;
        for (int b = 0; b < k; b++) H[oi + nzi[b]] += va * nzv[b];
      }
    }
    dg.resize(n);
    xsv.resize(n);
    bool accepted = false, stop = false;
    while (!accepted && !stop) {
      A = H;
      for (int i = 0; i < n; i++) A[static_cast<size_t>(i) * n + i] += lam * W[i] + 1e-9;
      for (int i = 0; i < n; i++) dg[i] = -g[i];
      if (!cholSolve(A, dg, n)) {
        lam *= 10;
        if (lam > 1e12) {
          restoreBest();
          stop = true;
        }
        continue;
      }
      xsv = x;
      for (int i = 0; i < n; i++) x[i] += dg[i];
      apply();
      const double e2 = saveBest();
      if (std::isfinite(e2) && e2 <= cur) {
        const double imp = cur - e2;
        cur = e2;
        accepted = true;
        lam = jsmax(lam * 0.3, 1e-8);
        if (imp < 1e-10 * jsmax(1e-12, cur) || cur < 1e-14) stop = true;
      } else {
        x = xsv;
        apply();
        if (std::isfinite(e2) && e2 - cur < 1e-10 * jsmax(1e-12, cur)) {
          stop = true;
          break;
        }
        lam *= 10;
        if (lam > 1e12) {
          restoreBest();
          stop = true;
        }
      }
    }
    if (stop && sparseUsed && cur >= 1e-14) {
      needFull = true;
      lam = jsmin(lam, 1e-3);
      continue;
    }
    if (stop) break;
  }
  restoreBest();
}

/* ----- résolution ----- */
Solveur::Instantane Solveur::snap() const {
  Instantane s;
  s.P = P_;
  s.R.reserve(E_.size());
  for (const E& e : E_) s.R.push_back(e.r);
  return s;
}
void Solveur::restaure(const Instantane& s) {
  P_ = s.P;
  for (size_t i = 0; i < E_.size(); i++)
    if (E_[i].t == CERCLE || E_[i].t == ARC) E_[i].r = s.R[i];
}

void Solveur::tangentExtend() {
  for (const C& c : C_) {
    if (c.type != TANGENT) continue;
    const E* L = en(c.line);
    const E* X = en(c.ent);
    if (!L || !X || L->t != LIGNE || (X->t != CERCLE && X->t != ARC)) continue;
    P2* A = pt(L->p1);
    P2* B = pt(L->p2);
    P2* CC = pt(X->pc);
    if (!A || !B || !CC) continue;
    const double dx = B->x - A->x, dy = B->y - A->y, l0 = hyp(dx, dy), len = l0 != 0 ? l0 : 1e-9, ux = dx / len, uy = dy / len;
    if (c.surCote) continue;
    const double t = ((CC->x - A->x) * ux + (CC->y - A->y) * uy) / len;
    if (t < 0 && !fix_[L->p1] && !c.partage1) {
      const double d = -t * len + jsmax(0.5, len * 1e-3);
      A->x -= ux * d;
      A->y -= uy * d;
    } else if (t > 1 && !fix_[L->p2] && !c.partage2) {
      const double d = (t - 1) * len + jsmax(0.5, len * 1e-3);
      B->x += ux * d;
      B->y += uy * d;
    }
  }
}

void Solveur::tangentSlide() {
  for (const C& c : C_) {
    if (c.type != TANGENT) continue;
    const E* L = en(c.line);
    const E* X = en(c.ent);
    if (!L || !X || L->t != LIGNE || (X->t != CERCLE && X->t != ARC)) continue;
    P2* A = pt(L->p1);
    P2* B = pt(L->p2);
    P2* CC = pt(X->pc);
    if (!A || !B || !CC) continue;
    if (fix_[X->pc]) continue;
    const double dx = B->x - A->x, dy = B->y - A->y, l0 = hyp(dx, dy), len = l0 != 0 ? l0 : 1e-9, ux = dx / len, uy = dy / len;
    const double t = ((CC->x - A->x) * ux + (CC->y - A->y) * uy) / len;
    if (t >= -1e-4 && t <= 1 + 1e-4) continue;
    const double t0 = jsmax(0, jsmin(1, t)), dSh = (t0 - t) * len;
    CC->x += ux * dSh;
    CC->y += uy * dSh;
  }
}

void Solveur::solveFinal() {
  const Instantane snap0 = snap();
  double bestR = audit().score;
  Instantane best = snap0;
  tangentExtend();
  const double rE = audit().score;
  if (rE < bestR - 1e-9) {
    bestR = rE;
    best = snap();
  }
  restaure(snap0);
  tangentSlide();
  const double rS = audit().score;
  if (rS < bestR - 1e-9) {
    bestR = rS;
    best = snap();
  }
  restaure(snap0);
  tangentExtend();
  tangentSlide();
  const double rES = audit().score;
  if (rES < bestR - 1e-9) {
    bestR = rES;
    best = snap();
  }
  restaure(best);
}

void Solveur::solve1(int iters) {
  if (origine_ >= 0 && (P_[origine_].x != 0 || P_[origine_].y != 0)) P_[origine_] = {0, 0};
  skDimSides();
  const Instantane base = snap();
  bool aLs = false;
  Instantane lsSnap;
  double lsRes = INFINI;
  for (D& d : D_) {
    if (d.ref || (d.type != DIAMETER && d.type != RADIUS)) continue;
    E* e = en(d.ent);
    if (e && (e->t == CERCLE || e->t == ARC)) {
      const double r = jsmax(d.type == DIAMETER ? d.value / 2 : d.value, 0.1);
      if (!e->poly.empty() && e->pc >= 0) {
        // skPolyRescale : la forme grandit autour de son centre avant la résolution
        const P2 CC = P_[e->pc];
        const double k = r / e->r;
        if (k > 0 && std::abs(k - 1) >= 1e-12)
          for (int q : e->poly)
            if (q >= 0) {
              P_[q].x = CC.x + (P_[q].x - CC.x) * k;
              P_[q].y = CC.y + (P_[q].y - CC.y) * k;
            }
      }
      e->r = r;
    }
  }
  Build B = sklsBuild();
  if (B.n > 0 && B.n <= 300) {
    std::vector<double> x(B.n);
    const auto charger = [&]() {
      for (size_t i = 0; i < B.pts.size(); i++) {
        x[2 * i] = P_[B.pts[i]].x;
        x[2 * i + 1] = P_[B.pts[i]].y;
      }
      for (size_t j = 0; j < B.rad.size(); j++) x[2 * B.pts.size() + j] = E_[B.rad[j]].r;
    };
    charger();
    lm(B, x, iters);
    std::vector<double> fr;
    collect(fr, B);
    double mx = 0;
    for (double v : fr) mx = jsmax(mx, std::abs(v));
    if (mx > 1e-6 && iters >= 100) {
      charger();
      lm(B, x, iters * 8);
    }
    solveFinal();
    const double r = audit().score;
    if (std::isfinite(r)) {
      lsSnap = snap();
      aLs = true;
      lsRes = r;
    }
  }
  restaure(base);
  relax(iters);
  const double relRes = audit().score;
  if (std::isfinite(lsRes) && std::isfinite(relRes) && lsRes < relRes - 1e-7 && aLs) {
    restaure(lsSnap);
    solveFinal();
  } else {
    solveFinal();
  }
  if (origine_ >= 0 && (P_[origine_].x != 0 || P_[origine_].y != 0)) P_[origine_] = {0, 0};
  tanSideRec();
}

void Solveur::tanSideRec() {
  for (C& c : C_) {
    if (c.type != TANGENT) continue;
    const E* L = en(c.line);
    const E* X = en(c.ent);
    if (!L || !X || L->t != LIGNE || (X->t != CERCLE && X->t != ARC)) continue;
    const P2* A = pt(L->p1);
    const P2* B = pt(L->p2);
    const P2* CC = pt(X->pc);
    if (!A || !B || !CC) continue;
    const double dx = B->x - A->x, dy = B->y - A->y, l0 = hyp(dx, dy), len = l0 != 0 ? l0 : 1e-9;
    const double d = (CC->x - A->x) * (-dy / len) + (CC->y - A->y) * (dx / len), r = X->r;
    if (!(r > 0)) continue;
    if (std::abs(std::abs(d) - r) < 1e-3 * jsmax(1, r) && std::abs(d) > 1e-6) c.cote = d > 0 ? 1 : -1;
  }
}

void Solveur::ptsNote() {
  memPts_ = P_;
  aPts_ = true;
}

void Solveur::bonNote() {
  const double r = residu();
  if (r <= 1e-3) {
    bonVals_.clear();
    for (size_t i = 0; i < D_.size(); i++)
      if (std::isfinite(D_[i].value)) bonVals_.push_back({static_cast<int>(i), D_[i].value});
    bonSnap_ = snap();
    aBon_ = true;
    bonMauvais_ = false;
    return;
  }
  if (aBon_) bonMauvais_ = true;
}

void Solveur::bonReprise() {
  if (!aBon_ || !bonMauvais_) return;
  std::vector<char> ext(P_.size(), 0);
  if (origine_ >= 0) ext[origine_] = 1;
  for (const E& e : E_)
    if (e.ext)
      for (int q : {e.p1, e.p2, e.pc, e.pa, e.pb, e.p})
        if (q >= 0) ext[q] = 1;
  std::vector<std::pair<int, P2>> cur;
  for (size_t k = 0; k < P_.size(); k++) {
    if (ext[k]) {
      cur.push_back({static_cast<int>(k), P_[k]});
      continue;
    }
    if (!aPts_ || hyp(P_[k].x - memPts_[k].x, P_[k].y - memPts_[k].y) > 1e-6) {
      aBon_ = false;
      return;
    }
  }
  restaure(bonSnap_);
  ptsNote();
  for (const auto& c : cur) P_[c.first] = c.second;
  for (const auto& v : bonVals_) {
    D_[v.first].aVal = true;
    D_[v.first].val = v.second;
  }
}

void Solveur::resoudre() {
  const int iters = 120;
  bonReprise();
  std::vector<int> Di;
  std::vector<double> fin, dep;
  for (size_t i = 0; i < D_.size(); i++)
    if (!D_[i].ref && std::isfinite(D_[i].value) && D_[i].aVal) {
      Di.push_back(static_cast<int>(i));
      fin.push_back(D_[i].value);
      dep.push_back(D_[i].val);
    }
  double k = 0;
  for (size_t i = 0; i < Di.size(); i++) {
    const double e = std::abs(fin[i] - dep[i]);
    if (e > 1e-3) k = jsmax(k, e / jsmax(std::abs(dep[i]), 1e-6));
  }
  int N = k > 0.05 ? static_cast<int>(std::ceil(k / 0.05)) : 1;

  // skPasFixes : les points fixes à faire glisser, sauf si un point libre a bougé
  struct Glisse {
    int q;
    double x0, y0, x1, y1;
  };
  std::vector<Glisse> F;
  double fmx = 0;
  if (aPts_) {
    bool libre = false;
    for (size_t q = 0; q < P_.size() && !libre; q++) {
      const P2& m = memPts_[q];
      const double d = hyp(P_[q].x - m.x, P_[q].y - m.y);
      if (fix_[q]) {
        if (d > 1e-6) {
          F.push_back({static_cast<int>(q), m.x, m.y, P_[q].x, P_[q].y});
          fmx = jsmax(fmx, d);
        }
      } else if (d > 1e-6) {
        libre = true;
      }
    }
    if (libre) {
      F.clear();
      fmx = 0;
    }
  }
  if (!F.empty()) {
    double cote = INFINI;
    for (const D& d : D_)
      if (!d.ref && d.type != ANGLE && d.value > 1e-3) cote = jsmin(cote, d.value);
    if (std::isfinite(cote) && fmx > cote / 2) N = std::max(N, static_cast<int>(std::ceil(fmx / (cote / 2))));
  }
  N = std::min(8, N);
  if (N > 1) {
    const Instantane avant = snap();
    const auto pose = [&](double t) {
      for (size_t i = 0; i < Di.size(); i++) D_[Di[i]].value = dep[i] + (fin[i] - dep[i]) * t;
      for (const Glisse& q : F) {
        P_[q.q].x = q.x0 + (q.x1 - q.x0) * t;
        P_[q.q].y = q.y0 + (q.y1 - q.y0) * t;
      }
    };
    for (int s = 1; s < N; s++) {
      pose(static_cast<double>(s) / N);
      solve1(iters);
    }
    pose(1);
    for (size_t i = 0; i < Di.size(); i++) D_[Di[i]].value = fin[i];
    solve1(iters);
    if (residu() > SK_OK_RES) {
      const Instantane parPas = snap();
      const double rp = residu();
      restaure(avant);
      solve1(iters);
      if (residu() >= rp) restaure(parPas);
    }
  } else {
    solve1(iters);
  }
  for (D& d : D_)
    if (std::isfinite(d.value)) {
      d.aVal = true;
      d.val = d.value;
    }
  ptsNote();
  bonNote();
}

bool Solveur::poserCote(const std::string& id, double valeur) {
  for (D& d : D_)
    if (d.id == id) {
      d.value = valeur;
      return true;
    }
  return false;
}

Solveur::Saisie Solveur::instantane() const {
  Saisie s;
  for (const P2& p : P_) {
    s.x.push_back(p.x);
    s.y.push_back(p.y);
  }
  for (const E& e : E_) s.r.push_back(e.r);
  for (const D& d : D_) {
    s.valeurs.push_back(d.value);
    s.sgn.push_back(d.sgn);
    s.ccw.push_back(d.ccw);
  }
  return s;
}

void Solveur::refuser(const Saisie& s) {
  restaurer(s);
  // skRevertTo passe par parApplyAll, dont parResolve (skValsNote) note aussitôt les valeurs des cotes rétablies.
  // La saisie suivante part donc de là, par petits pas ; une annulation, elle, résout avant toute note.
  for (D& d : D_)
    if (std::isfinite(d.value)) {
      d.aVal = true;
      d.val = d.value;
    }
}

void Solveur::restaurer(const Saisie& s) {
  for (size_t i = 0; i < P_.size(); i++) P_[i] = {s.x[i], s.y[i]};
  for (size_t i = 0; i < E_.size(); i++) E_[i].r = s.r[i];
  for (size_t i = 0; i < D_.size(); i++) {
    D_[i].value = s.valeurs[i];
    D_[i].sgn = s.sgn[i];
    D_[i].ccw = s.ccw[i];
    // Le navigateur remplace ici les objets : ce qu'il avait noté sur les anciens ne vaut plus
    D_[i].aVal = false;
  }
  for (C& c : C_) c.cote = 0;
  bonVals_.clear();
}

std::string Solveur::cleContrainte(const C& c) const {
  const auto nom = [&](int i) { return i >= 0 ? E_[i].id : std::string("undefined"); };
  const auto ptn = [&](int i) { return i >= 0 ? idP_[i] : std::string("undefined"); };
  const auto paire = [&](const std::string& x, const std::string& y) { return x < y ? x + "|" + y : y + "|" + x; };
  switch (c.type) {
    case H: return "h@" + nom(c.line);
    case V: return "v@" + nom(c.line);
    case FIX: return "fix@" + (c.p >= 0 ? "p:" + ptn(c.p) : "ent:" + nom(c.ent));
    case TANGENT: return "tangent@" + nom(c.line) + "|" + nom(c.ent);
    case TANGENT2: return "tangent2@" + paire(nom(c.a), nom(c.b));
    case PARALLEL: return "parallel@" + paire(nom(c.a), nom(c.b));
    case PERPENDICULAR: return "perpendicular@" + paire(nom(c.a), nom(c.b));
    case EQUAL: return "equal@" + paire(nom(c.a), nom(c.b));
    case COLLINEAR: return "collinear@" + paire(nom(c.a), nom(c.b));
    case SYMMETRIC: return "symmetric@" + paire(nom(c.a), nom(c.b)) + "|" + nom(c.mid);
    case COAXIAL: return "coaxial@" + paire(nom(c.a), nom(c.b));
    case OFFSET: return "offset@" + nom(c.a) + "|" + nom(c.b) + "|" + nom(c.c) + "|" + nom(c.d);
    case COINCIDENT: return "coincident@" + paire(ptn(c.a), ptn(c.b));
    case MIDPOINT: return c.p >= 0 ? "midpoint@" + ptn(c.p) + "|" + nom(c.line) : "midpoint@@" + paire(nom(c.a), nom(c.b));
    case ONLINE: return "online@" + ptn(c.p) + "|" + nom(c.line);
    case ONCIRCLE: return "oncircle@" + ptn(c.p) + "|" + nom(c.ent);
    default: return "id@" + c.id;
  }
}

// skDedupConstraints, et ce qui en dépend
void Solveur::nettoyer() {
  const auto aHV = [&](int ligne, TypeC t) {
    for (const C& c : C_)
      if (c.type == t && c.line == ligne) return true;
    return false;
  };
  const auto cleEnt = [&](const C& c) { const std::string &x = E_[c.a].id, &y = E_[c.b].id; return x < y ? x + "|" + y : y + "|" + x; };
  std::set<std::string> colineaires, vues;
  for (const C& c : C_)
    if (c.type == COLLINEAR && c.a >= 0 && c.b >= 0) colineaires.insert(cleEnt(c));
  std::vector<C> garde;
  for (const C& c : C_) {
    if (c.type == PERPENDICULAR && c.a >= 0 && c.b >= 0 && ((aHV(c.a, H) && aHV(c.b, V)) || (aHV(c.a, V) && aHV(c.b, H)))) continue;
    if (c.type == PARALLEL && c.a >= 0 && c.b >= 0 && colineaires.count(cleEnt(c))) continue;
    if (!vues.insert(cleContrainte(c)).second) continue;
    garde.push_back(c);
  }
  if (garde.size() == C_.size()) return;
  C_ = std::move(garde);
  calculerStructure();
}

void Solveur::premiereCoteEchelle(const D& d, double nv) {
  if (d.ref || d.type == ANGLE) return;
  if (d.ent >= 0 && !E_[d.ent].poly.empty()) return;
  for (const D& x : D_)
    if (&x != &d && !x.ref) return;
  for (const C& c : C_)
    if (c.type == FIX) return;
  for (const E& e : E_)
    if (e.proj || e.ref) return;
  double cur = 0;
  if (d.type == LENGTH || d.type == DISTANCE) {
    int a = d.a, b = d.b;
    if (d.type == LENGTH) {
      if (d.line < 0) return;
      a = E_[d.line].p1;
      b = E_[d.line].p2;
    }
    if (a < 0 || b < 0) return;
    cur = mesure(P_[a].x, P_[a].y, P_[b].x, P_[b].y, d.orient);
  } else if (d.type == DIAMETER || d.type == RADIUS) {
    if (d.ent < 0) return;
    cur = d.type == DIAMETER ? 2 * E_[d.ent].r : E_[d.ent].r;
  } else if (d.type == GAP || d.type == DISTLINE) {
    double sg;
    if (!dimSigne(d, sg)) return;
    cur = std::abs(sg);
  } else {
    return;
  }
  if (!(cur > 1e-9) || !(nv > 0)) return;
  const double k = nv / cur;
  if (std::abs(k - 1) < 1e-9) return;
  bool atO = false;
  for (size_t q = 0; q < P_.size(); q++)
    if (static_cast<int>(q) != origine_ && hyp(P_[q].x, P_[q].y) < 1e-6) atO = true;
  for (const C& c : C_)
    if (c.type == COINCIDENT && origine_ >= 0 && (c.a == origine_ || c.b == origine_)) atO = true;
  double cx = 0, cy = 0;
  if (!atO) {
    double x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (size_t q = 0; q < P_.size(); q++) {
      if (static_cast<int>(q) == origine_) continue;
      x0 = jsmin(x0, P_[q].x);
      x1 = jsmax(x1, P_[q].x);
      y0 = jsmin(y0, P_[q].y);
      y1 = jsmax(y1, P_[q].y);
    }
    cx = (x0 + x1) / 2;
    cy = (y0 + y1) / 2;
  }
  for (size_t q = 0; q < P_.size(); q++) {
    if (static_cast<int>(q) == origine_) continue;
    P_[q].x = cx + (P_[q].x - cx) * k;
    P_[q].y = cy + (P_[q].y - cy) * k;
  }
  for (E& e : E_)
    if (e.t == CERCLE || e.t == ARC) e.r *= k;
}

bool Solveur::saisir(const std::string& id, double valeur, std::string* raison) {
  D* d = nullptr;
  for (D& x : D_)
    if (x.id == id) d = &x;
  if (!d) {
    if (raison) *raison = "cote introuvable";
    return false;
  }
  const Saisie avant = instantane();
  premiereCoteEchelle(*d, valeur);
  d->value = valeur;
  resoudre();
  for (const E& e : E_) {
    if (e.t != LIGNE || e.p1 < 0 || e.p2 < 0) continue;
    if (hyp(P_[e.p2].x - P_[e.p1].x, P_[e.p2].y - P_[e.p1].y) < 1e-4 && hyp(avant.x[e.p2] - avant.x[e.p1], avant.y[e.p2] - avant.y[e.p1]) > 1e-3) {
      refuser(avant);
      if (raison) *raison = "une ligne serait réduite à un point : contraintes en conflit";
      return false;
    }
  }
  if (residu() <= SK_OK_RES) return true;
  // L'état d'avant, mesuré comme le navigateur sur sa copie : sans le côté mémorisé des tangences
  Solveur copie = *this;
  copie.restaurer(avant);
  if (copie.residu() > SK_OK_RES) return true;  // une esquisse déjà en défaut n'est pas bloquée
  const std::string pourquoi = pireEcart();
  refuser(avant);
  if (raison) *raison = pourquoi;
  return false;
}

void Solveur::recopierDans(Esquisse& s) const {
  for (size_t i = 0; i < P_.size(); i++) {
    auto it = s.points.find(idP_[i]);
    if (it != s.points.end()) it->second = {P_[i].x, P_[i].y};
  }
  for (size_t i = 0; i < E_.size() && i < s.entites.size(); i++) s.entites[i].r = E_[i].r;
  for (Cote& c : s.cotes)
    for (const D& d : D_)
      if (d.id == c.id) {
        c.value = d.value;
        c.sgn = d.sgn;
        c.ccw = d.ccw;
      }
}

void Solveur::reprendrePoints(const Esquisse& s) {
  for (size_t i = 0; i < P_.size(); i++) {
    const Pt* q = s.point(idP_[i]);
    if (q) P_[i] = {q->x, q->y};
  }
  for (size_t i = 0; i < E_.size() && i < s.entites.size(); i++) E_[i].r = s.entites[i].r;
}

void Solveur::etat(std::vector<double>& pts, std::vector<double>& rayons) const {
  pts.clear();
  rayons.clear();
  for (const P2& p : P_) {
    pts.push_back(p.x);
    pts.push_back(p.y);
  }
  for (const E& e : E_)
    if (e.t == CERCLE || e.t == ARC) rayons.push_back(e.r);
}

void Solveur::deplacerProjections(double dx, double dy) {
  std::vector<char> vu(P_.size(), 0);
  for (const E& e : E_)
    if (e.proj)
      for (int q : pidsEntite(e))
        if (q >= 0 && !vu[q]) {
          vu[q] = 1;
          P_[q].x += dx;
          P_[q].y += dy;
        }
}
