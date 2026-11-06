#include "conges.h"
#include "noms.h"

#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Curve2d.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepAlgoAPI_Common.hxx>
#include <BRepAlgoAPI_Cut.hxx>
#include <BRepAlgoAPI_Fuse.hxx>
#include <BRepAlgoAPI_Splitter.hxx>
#include <BRepBndLib.hxx>
#include <BRepBuilderAPI_Copy.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakePolygon.hxx>
#include <BRepBuilderAPI_NurbsConvert.hxx>
#include <BRepCheck_Analyzer.hxx>
#include <BRepClass3d_SolidClassifier.hxx>
#include <BRepFilletAPI_MakeChamfer.hxx>
#include <BRepFilletAPI_MakeFillet.hxx>
#include <BRepGProp.hxx>
#include <BRepPrimAPI_MakeBox.hxx>
#include <BRepPrimAPI_MakeCylinder.hxx>
#include <BRepPrimAPI_MakePrism.hxx>
#include <BRep_Builder.hxx>
#include <BRep_Tool.hxx>
#include <GeomLProp_SLProps.hxx>
#include <Geom_Surface.hxx>
#include <TopLoc_Location.hxx>
#include <gp_Pnt2d.hxx>
#include <Bnd_Box.hxx>
#include <GProp_GProps.hxx>
#include <Standard_Failure.hxx>
#include <TopExp_Explorer.hxx>
#include <TopTools_ListOfShape.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Compound.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <gp_Ax2.hxx>
#include <gp_Cylinder.hxx>
#include <gp_Dir.hxx>
#include <gp_Pln.hxx>
#include <gp_Pnt.hxx>
#include <gp_Vec.hxx>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <map>
#include <optional>
#include <set>
#include <stdexcept>

namespace {
const double PI = 3.14159265358979323846, TAU = PI * 2;

double hyp(double x, double y) { return std::sqrt(x * x + y * y); }
double hyp(double x, double y, double z) { return std::sqrt(x * x + y * y + z * z); }
double ecart(const Vec3& a, const Vec3& b) { return hyp(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
double distSeg2(double px, double py, double ax, double ay, double bx, double by) {
  const double dx = bx - ax, dy = by - ay;
  const double L2 = dx * dx + dy * dy != 0 ? dx * dx + dy * dy : 1e-18;
  double t = ((px - ax) * dx + (py - ay) * dy) / L2;
  t = std::max(0.0, std::min(1.0, t));
  return hyp(px - (ax + t * dx), py - (ay + t * dy));
}
std::string fixe(double v, int chiffres) {  // toFixed
  if (v == 0) v = 0;  // -0 s'écrit 0 en JavaScript
  char b[64];
  snprintf(b, sizeof b, "%.*f", chiffres, v);
  return b;
}
double arrondi(double v, int chiffres) { return strtod(fixe(v, chiffres).c_str(), nullptr); }
std::string xNum(double v) {  // String(+v.toFixed(2)).replace('.',',')
  std::string s = fixe(v, 2);
  while (!s.empty() && s.back() == '0') s.pop_back();
  if (!s.empty() && s.back() == '.') s.pop_back();
  for (char& c : s)
    if (c == '.') c = ',';
  return s == "-0" || s.empty() ? "0" : s;
}
std::string posTexte(const Vec3& p) { return "(" + fixe(p[0], 1) + ", " + fixe(p[1], 1) + ", " + fixe(p[2], 1) + ")"; }

Vec3 projeter(const Esquisse& s, const Vec3& m) {
  const double dx = m[0] - s.o[0], dy = m[1] - s.o[1], dz = m[2] - s.o[2];
  return {dx * s.u[0] + dy * s.u[1] + dz * s.u[2], dx * s.v[0] + dy * s.v[1] + dz * s.v[2], dx * s.n[0] + dy * s.n[1] + dz * s.n[2]};
}
// arcAngles : a2 - a1 > 0 ; rend false s'il manque un point
bool anglesArc(const Esquisse& s, const Entite& e, double& a1, double& a2) {
  const Pt* C = s.point(e.pc);
  const Pt* A = s.point(e.pa);
  const Pt* B = s.point(e.pb);
  if (!C || !A || !B) return false;
  a1 = std::atan2(A->y - C->y, A->x - C->x);
  if (e.pa == e.pb) {
    a2 = a1 + TAU;
    return true;
  }
  const double b = std::atan2(B->y - C->y, B->x - C->x);
  double d = std::fmod(b - a1, TAU);
  if (d <= 0) d += TAU;
  a2 = a1 + d;
  return true;
}
double relatif(double angle, double a1) {  // ((x%TAU)+TAU)%TAU
  return std::fmod(std::fmod(angle - a1, TAU) + TAU, TAU);
}
const Esquisse* esquisseDe(const Document& d, const std::string& id) {
  for (const Esquisse& s : d.esquisses)
    if (s.id == id) return &s;
  return nullptr;
}

// Extrusion dépouillée : l'arête s'écarte de l'entité d'esquisse selon sa hauteur et l'angle (xDraftDist)
double distDepouille(const Document& d, const std::string& esquisse, double z2, double dist) {
  double best = dist;
  for (const Fonction& f : d.fonctions) {
    if (f.type != "extrude" || f.esquisse != esquisse || !f.visible) continue;
    const double a = std::abs(f.draft);
    if (!(a > 1e-9 && a < 89)) continue;
    best = std::min(best, std::abs(dist - std::abs(z2) * std::tan(a * M_PI / 180)));
  }
  return best;
}

// ---- Une sélection = une arête : recherche par l'ancre d'esquisse ----
struct Ligne {
  int i = 0;
  double sc = 0, lvl = 0, d0 = 0;
};
int meilleure(std::vector<Ligne> bk) {
  if (bk.empty()) return -1;
  std::stable_sort(bk.begin(), bk.end(), [](const Ligne& x, const Ligne& y) { return x.sc < y.sc; });
  const double g0 = bk[0].sc;
  std::vector<Ligne> pres;
  for (auto& c : bk)
    if (c.sc <= g0 + 6) pres.push_back(c);
  if (pres.size() < 2) return bk[0].i;
  std::stable_sort(pres.begin(), pres.end(), [](const Ligne& x, const Ligne& y) { return x.d0 < y.d0; });
  return pres[0].i;
}
int chercherParAncre(const Document& d, const AreteConge& se, const std::vector<AreteListee>& aretes) {  // xAnchorMatch
  if (!se.ancre.existe) return -1;
  const AncreArete& a = se.ancre;
  const Esquisse* s = esquisseDe(d, a.sk);
  if (!s) return -1;
  const auto proj = [&](const Vec3& m) { return projeter(*s, m); };
  const double zRef = a.aZ && std::isfinite(a.z) ? a.z : se.aPos0 ? proj(se.pos0)[2] : (a.aZ ? a.z : 0);
  const auto etendues = etenduesEsquisse(d, a.sk);
  if (a.t == "p") {
    const Pt* p = s->point(a.id);
    if (!p) return -1;
    const auto dzPref = [&](double q2) {
      if (etendues.empty()) return std::abs(q2 - zRef);
      double m = 1e9;
      for (auto& e : etendues) m = std::min({m, std::abs(q2 - e.lo), std::abs(q2 - e.hi)});
      return std::min(m, std::abs(q2 - zRef) + 2);
    };
    std::vector<Ligne> rows;
    for (size_t i = 0; i < aretes.size(); i++) {
      const AreteListee& e = aretes[i];
      const Vec3 q = proj(e.mid);
      const double d2 = hyp(q[0] - p->x, q[1] - p->y);
      if (d2 > 5.0) continue;
      if (ecart(e.pts.front(), e.pts.back()) < 1e-9) continue;
      const double d0 = se.aPos0 ? ecart(e.mid, se.pos0) : 0;
      Ligne l;
      l.i = static_cast<int>(i);
      l.lvl = std::abs(q[2] - zRef);
      l.d0 = d0;
      l.sc = d2 + 0.3 * dzPref(q[2]) + 0.6 * std::min(d0, 60.0);
      rows.push_back(l);
    }
    const auto seuil = [&](double m) {
      std::vector<Ligne> b;
      for (auto& r : rows)
        if (r.lvl <= m) b.push_back(r);
      return b;
    };
    int c = meilleure(seuil(2.0));
    if (c < 0) c = meilleure(seuil(8.0));
    if (c < 0) c = meilleure(rows);
    return c;
  }
  const Entite* e = s->entite(a.id);
  if (!e || e->construction || e->ref) return -1;
  const auto coteZ = [&](int cote) {
    if (etendues.empty()) return cote == 0 ? 0.0 : (a.dist != 0 ? a.dist : (a.z != 0 ? a.z : 10.0));
    return cote == 0 ? etendues[0].lo : etendues[0].hi;
  };
  const double rawZ = a.aSide ? coteZ(a.side) : (std::abs(a.z) < 0.6 ? coteZ(0) : coteZ(1));
  const double expectedZ = !std::isfinite(rawZ) || std::abs(rawZ) > 1000 ? zRef : rawZ;
  std::vector<Ligne> bA, bB, bC;
  for (size_t i = 0; i < aretes.size(); i++) {
    const AreteListee& ed = aretes[i];
    const Vec3 q = proj(ed.mid);
    const Vec3& P0 = ed.pts.front();
    const Vec3& P1 = ed.pts.back();
    const bool vert = std::abs(P1[2] - P0[2]) > hyp(P1[0] - P0[0], P1[1] - P0[1]);
    const double ldiff = std::abs(ed.len - se.len);
    double d2;
    if (e->t == "line") {
      const Pt* A0 = s->point(e->p1);
      const Pt* B0 = s->point(e->p2);
      if (!A0 || !B0) continue;
      d2 = distSeg2(q[0], q[1], A0->x, A0->y, B0->x, B0->y);
    } else if (e->t == "circle" || e->t == "arc") {
      const Pt* C = s->point(e->pc);
      if (!C || !(e->r > 0)) continue;
      if (e->t == "arc") {
        double a1, a2;
        if (!anglesArc(*s, *e, a1, a2)) continue;
        if (relatif(std::atan2(q[1] - C->y, q[0] - C->x), a1) > a2 - a1 + 0.05) continue;
      }
      d2 = std::abs(hyp(q[0] - C->x, q[1] - C->y) - e->r);
    } else {
      continue;
    }
    d2 = distDepouille(d, a.sk, q[2], d2);
    if (d2 > (a.loin ? 8.0 : 2.5)) continue;
    const double zErr = std::min(std::abs(q[2] - expectedZ), std::abs(q[2] - zRef));
    const double d0 = se.aPos0 ? ecart(ed.mid, se.pos0) : 0;
    const double p0t = 0.6 * std::min(d0, 60.0);
    Ligne l;
    l.i = static_cast<int>(i);
    l.d0 = d0;
    l.sc = vert ? d2 + 0.3 * std::min(ldiff, 20.0) + 0.2 * std::abs(q[2] - zRef) + p0t : d2 + 0.3 * std::min(ldiff, 30.0) + 0.2 * zErr + p0t;
    (zErr <= 1.0 ? bA : zErr <= 8.0 ? bB : bC).push_back(l);
  }
  int c = meilleure(bA);
  if (c < 0) c = meilleure(bB);
  if (c < 0) c = meilleure(bC);
  return c;
}
// xAnchorStill : 1 le clic est encore sous l'ancre, 0 l'esquisse a emporté l'arête, -1 indécidable
int ancreEncoreLa(const Document& d, const AreteConge& se) {
  try {
    if (!se.ancre.existe || !se.aPos0) return -1;
    const AncreArete& a = se.ancre;
    const Esquisse* s = esquisseDe(d, a.sk);
    if (!s) return -1;
    const Vec3 q = projeter(*s, se.pos0);
    if (a.t == "p") {
      const Pt* p = s->point(a.id);
      if (!p) return -1;
      return hyp(q[0] - p->x, q[1] - p->y) <= 2.5 ? 1 : 0;
    }
    const Entite* e = s->entite(a.id);
    if (!e) return -1;
    double d2;
    if (e->t == "line") {
      const Pt* A0 = s->point(e->p1);
      const Pt* B0 = s->point(e->p2);
      if (!A0 || !B0) return -1;
      d2 = distSeg2(q[0], q[1], A0->x, A0->y, B0->x, B0->y);
    } else if (e->t == "circle" || e->t == "arc") {
      const Pt* C = s->point(e->pc);
      if (!C || !(e->r > 0)) return -1;
      d2 = std::abs(hyp(q[0] - C->x, q[1] - C->y) - e->r);
    } else {
      return -1;
    }
    d2 = distDepouille(d, a.sk, q[2], d2);
    if (d2 > (a.loin ? 8.0 : 2.5)) return 0;
    std::vector<double> zs;
    if (a.aZ && std::isfinite(a.z)) zs.push_back(a.z);
    if (a.aSide) {
      const auto sp = etenduesEsquisse(d, a.sk);
      if (!sp.empty()) {
        const double z = a.side == 0 ? sp[0].lo : sp[0].hi;
        if (std::isfinite(z) && std::abs(z) <= 1000) zs.push_back(z);
      }
    }
    if (zs.empty()) return 1;
    for (double z : zs)
      if (std::abs(q[2] - z) <= 1.5) return 1;
    return 0;
  } catch (const std::exception&) {
    return -1;
  }
}

// ---- Calcul : le lot, puis arête par arête ----
struct Travail {
  int src = 0;
  double r = 0;
  Vec3 mid{0, 0, 0};
};
struct Options {
  bool seule = false, lot = false;
};
int rangDe(const std::vector<AreteListee>& aretes, int src) {
  for (size_t i = 0; i < aretes.size(); i++)
    if (aretes[i].src == src) return static_cast<int>(i);
  return -1;
}
double volume(const TopoDS_Shape& s) {
  GProp_GProps G;
  BRepGProp::VolumeProperties(s, G, false, false, false);
  return G.Mass();
}
bool valide(const TopoDS_Shape& s) {
  try {
    BRepCheck_Analyzer a(s, true);
    return a.IsValid();
  } catch (...) {
    return false;
  }
}
TopoDS_Shape copie(const TopoDS_Shape& s) {  // occShapeCopy
  BRepBuilderAPI_Copy c(s, true, true);
  const TopoDS_Shape r = c.Shape();
  nomsPartage(s, r);
  return r;
}
TopoDS_Shape coupe(const TopoDS_Shape& a, const TopoDS_Shape& b) {
  BRepAlgoAPI_Cut c(a, b);
  if (!c.IsDone()) throw std::runtime_error("découpe impossible");
  const TopoDS_Shape s = c.Shape();
  nomsTransmet({a, b}, histoireDe(c), s);
  return s;
}
TopoDS_Shape fusion(const TopoDS_Shape& a, const TopoDS_Shape& b) {
  BRepAlgoAPI_Fuse f(a, b);
  if (!f.IsDone()) throw std::runtime_error("fusion impossible");
  const TopoDS_Shape s = f.Shape();
  nomsTransmet({a, b}, histoireDe(f), s);
  return s;
}
// occFaceKeys : ce qui sert à compter les faces nées d'un congé
std::vector<std::string> clesFaces(const TopoDS_Shape& s) {
  const auto r = [](double v) {
    const double a = std::floor(v * 200 + 0.5) / 200;
    char b[64];
    snprintf(b, sizeof b, "%.15g", a == 0 ? 0.0 : a);
    return std::string(b);
  };
  std::vector<std::string> cles;
  for (TopExp_Explorer ex(s, TopAbs_FACE); ex.More(); ex.Next()) {
    std::string k = "?";
    try {
      BRepAdaptor_Surface ad(TopoDS::Face(ex.Current()), true);
      const auto signe = [](const gp_Dir& d) { return (std::abs(d.X()) > 1e-9 ? d.X() : (std::abs(d.Y()) > 1e-9 ? d.Y() : d.Z())) < 0 ? -1.0 : 1.0; };
      if (ad.GetType() == GeomAbs_Plane) {
        const gp_Ax1 ax = ad.Plane().Axis();
        const gp_Dir d = ax.Direction();
        const gp_Pnt p = ax.Location();
        const double sg = signe(d), n[3] = {d.X() * sg, d.Y() * sg, d.Z() * sg};
        k = "P" + r(n[0]) + "," + r(n[1]) + "," + r(n[2]) + "|" + r(n[0] * p.X() + n[1] * p.Y() + n[2] * p.Z());
      } else if (ad.GetType() == GeomAbs_Cylinder) {
        const gp_Ax1 ax = ad.Cylinder().Axis();
        const gp_Dir d = ax.Direction();
        const gp_Pnt p = ax.Location();
        const double sg = signe(d), n[3] = {d.X() * sg, d.Y() * sg, d.Z() * sg};
        const double t = n[0] * p.X() + n[1] * p.Y() + n[2] * p.Z();
        k = "C" + r(n[0]) + "," + r(n[1]) + "," + r(n[2]) + "|" + r(p.X() - n[0] * t) + "," + r(p.Y() - n[1] * t) + "," + r(p.Z() - n[2] * t) + "|" + r(ad.Cylinder().Radius());
      } else {
        const gp_Pnt m = ad.Value((ad.FirstUParameter() + ad.LastUParameter()) / 2, (ad.FirstVParameter() + ad.LastVParameter()) / 2);
        k = "S" + std::to_string(static_cast<int>(ad.GetType())) + "|" + r(m.X()) + "," + r(m.Y()) + "," + r(m.Z());
      }
    } catch (...) {
      k = "?";
    }
    cles.push_back(k);
  }
  return cles;
}

// occSingleEdgeTool : l'outil qui arrondit UNE arête droite et convexe sans suivre sa chaîne tangente
std::optional<TopoDS_Shape> outilAreteSeule(const TopoDS_Shape& shape, const std::vector<Vec3>& pts, double r, bool chanfrein, bool& borne) {
  if (pts.size() < 2 || !(r > 0)) return std::nullopt;
  using V = Vec3;
  const auto sub = [](const V& p, const V& q) { return V{p[0] - q[0], p[1] - q[1], p[2] - q[2]}; };
  const auto add = [](const V& p, const V& q) { return V{p[0] + q[0], p[1] + q[1], p[2] + q[2]}; };
  const auto mul = [](const V& p, double k) { return V{p[0] * k, p[1] * k, p[2] * k}; };
  const auto dot = [](const V& p, const V& q) { return p[0] * q[0] + p[1] * q[1] + p[2] * q[2]; };
  const auto len = [](const V& p) { return hyp(p[0], p[1], p[2]); };
  const auto nrm = [&](const V& p) {
    const double l = len(p);
    return mul(p, 1 / (l != 0 ? l : 1));
  };
  const auto cross = [](const V& p, const V& q) { return V{p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]}; };
  const V A = pts.front(), B = pts.back();
  const double L = len(sub(B, A));
  if (L < 1e-6) return std::nullopt;
  const V t = nrm(sub(B, A));
  for (const V& p : pts) {
    const V w = sub(p, A);
    if (len(sub(w, mul(t, dot(w, t)))) > 1e-4 * std::max(1.0, L)) return std::nullopt;
  }
  const V M = mul(add(A, B), 0.5);
  const V a0 = std::abs(t[0]) < 0.9 ? V{1, 0, 0} : V{0, 1, 0};
  const V u = nrm(sub(a0, mul(t, dot(a0, t)))), v = cross(t, u);
  const auto dir = [&](double th) { return add(mul(u, std::cos(th)), mul(v, std::sin(th))); };
  try {
    BRepClass3d_SolidClassifier cl(shape);
    const auto dedans = [&](const V& q) {
      cl.Perform(gp_Pnt(q[0], q[1], q[2]), 1e-7);
      return cl.State() == TopAbs_IN;
    };
    const double eps = std::max(1e-3, std::min(0.05, r * 0.05));
    const auto inAt = [&](double th) { return dedans(add(M, mul(dir(th), eps))); };
    const int N = 180;
    std::vector<char> S(N);
    for (int k = 0; k < N; k++) S[k] = inAt(TAU * k / N);
    std::vector<int> debuts;
    for (int k = 0; k < N; k++)
      if (S[k] && !S[(k + N - 1) % N]) debuts.push_back(k);
    if (debuts.size() != 1) return std::nullopt;
    int k1 = debuts[0], k2 = k1;
    while (S[(k2 + 1) % N] && (k2 + 1) % N != k1) k2 = (k2 + 1) % N;
    const auto bis = [&](double lo, double hi, bool veut) {
      for (int i = 0; i < 14; i++) {
        const double m = (lo + hi) / 2;
        if (inAt(m) == veut) hi = m;
        else lo = m;
      }
      return (lo + hi) / 2;
    };
    const double st = TAU / N;
    const double th1 = bis(TAU * k1 / N - st, TAU * k1 / N, true);
    const double th2 = bis(TAU * (k2 + 1) / N, TAU * k2 / N, true);
    double al = th2 - th1;
    while (al < 0) al += TAU;
    while (al > TAU) al -= TAU;
    if (!(al > 0.05 && al < PI - 0.02)) return std::nullopt;
    V d1 = dir(th1), d2 = dir(th2);
    // Directions exactes dans les faces planes qui bordent l'arête
    const auto caler = [&](const V& d) {
      V best = d;
      double bd = 0.999;
      for (TopExp_Explorer ex(shape, TopAbs_FACE); ex.More(); ex.Next()) {
        BRepAdaptor_Surface ad(TopoDS::Face(ex.Current()), true);
        if (ad.GetType() != GeomAbs_Plane) continue;
        const gp_Ax1 ax = ad.Plane().Axis();
        const V n{ax.Direction().X(), ax.Direction().Y(), ax.Direction().Z()}, p{ax.Location().X(), ax.Location().Y(), ax.Location().Z()};
        if (std::abs(dot(sub(A, p), n)) > 1e-5 || std::abs(dot(sub(B, p), n)) > 1e-5) continue;
        V c = nrm(cross(n, t));
        if (dot(c, d) < 0) c = mul(c, -1);
        if (dot(c, d) > bd) {
          bd = dot(c, d);
          best = c;
        }
      }
      return best;
    };
    d1 = caler(d1);
    d2 = caler(d2);
    al = std::acos(std::max(-1.0, std::min(1.0, dot(d1, d2))));
    if (!(al > 0.05 && al < PI - 0.02)) return std::nullopt;
    const V b = nrm(add(d1, d2));
    const double s = chanfrein ? r : r / std::tan(al / 2);
    const V T1 = add(M, mul(d1, s)), T2 = add(M, mul(d2, s));
    const V Eo = sub(M, mul(b, 0.5 * s + 0.5));
    const double o = std::max(2 * s, 2.0), half = L / 2 + o;
    std::vector<V> sect;
    const double poids[5][3] = {{.1, .45, .45}, {.34, .33, .33}, {.1, .8, .1}, {.1, .1, .8}, {.6, .2, .2}};
    for (const V* T : {&T1, &T2})
      for (auto& w : poids) sect.push_back(add(add(mul(Eo, w[0]), mul(*T, w[1])), mul(M, w[2])));
    const auto libre = [&](double sg, double dd) {
      for (const V& q : sect)
        if (dedans(add(q, mul(t, sg * (L / 2 + dd))))) return false;
      return true;
    };
    const auto portee = [&](double sg) {
      if (!libre(sg, 1e-3)) return 0.0;
      const int n = 8;
      double lo = 1e-3;
      for (int k = 1; k <= n; k++) {
        const double dd = o * k / n;
        if (libre(sg, dd)) {
          lo = dd;
          continue;
        }
        double hi = dd;
        for (int i = 0; i < 10; i++) {
          const double m = (lo + hi) / 2;
          if (libre(sg, m)) lo = m;
          else hi = m;
        }
        return lo;
      }
      return o;
    };
    const double oA = portee(-1), oB = portee(1);
    borne = oA < o || oB < o;
    const auto at0 = [&](const V& p) { return sub(p, mul(t, L / 2 + oA)); };
    const auto P = [](const V& p) { return gp_Pnt(p[0], p[1], p[2]); };
    BRepBuilderAPI_MakePolygon poly(P(at0(Eo)), P(at0(T1)), P(at0(T2)), true);
    if (!poly.IsDone()) return std::nullopt;
    BRepBuilderAPI_MakeFace fm(poly.Wire(), true);
    if (!fm.IsDone()) return std::nullopt;
    const double lg = L + oA + oB;
    BRepPrimAPI_MakePrism pr(fm.Face(), gp_Vec(t[0] * lg, t[1] * lg, t[2] * lg), false, true);
    pr.Build();
    if (!pr.IsDone()) return std::nullopt;
    TopoDS_Shape outil = pr.Shape();
    if (!chanfrein) {
      const double h = r / std::sin(al / 2);
      const V C = add(M, mul(b, h)), C0 = sub(C, mul(t, half + 1));
      BRepPrimAPI_MakeCylinder cy(gp_Ax2(P(C0), gp_Dir(t[0], t[1], t[2])), r, 2 * half + 2);
      outil = coupe(outil, cy.Shape());
    }
    return outil;
  } catch (...) {
    return std::nullopt;
  }
}

// occFilletRun : rend une forme vide si rien n'a pu être arrondi
TopoDS_Shape lancer(const TopoDS_Shape& base, const std::vector<Travail>& jobs, std::vector<std::string>& warns, bool chanfrein, Options opts) {
  const std::string quoi = chanfrein ? "chanfrein" : "arrondi";
  const auto mk = [&](const TopoDS_Shape& cur, const std::vector<Travail>& js) -> TopoDS_Shape {
    try {
      std::map<int, double> voulu;
      for (auto& j : js) voulu[j.src] = j.r;  // dernier gagnant, comme new Map(js)
      std::vector<std::pair<TopoDS_Edge, double>> hs;
      int k = 0;
      for (TopExp_Explorer ex(cur, TopAbs_EDGE); ex.More(); ex.Next(), k++) {
        auto it = voulu.find(k);
        if (it != voulu.end()) hs.push_back({TopoDS::Edge(ex.Current()), it->second});
      }
      if (hs.empty()) return {};
      TopoDS_Shape s;
      if (chanfrein) {
        BRepFilletAPI_MakeChamfer mf(cur);
        for (auto& h : hs) mf.Add(h.second, h.first);
        mf.Build();
        if (!mf.IsDone()) return {};
        s = mf.Shape();
        nomsApresConge([&mf](const TopoDS_Shape& x) { return mf.Generated(x); }, histoireDe(mf), cur, s, true);
      } else {
        BRepFilletAPI_MakeFillet mf(cur, ChFi3d_Rational);
        for (auto& h : hs) mf.Add(h.second, h.first);
        mf.Build();
        if (!mf.IsDone()) return {};
        s = mf.Shape();
        nomsApresConge([&mf](const TopoDS_Shape& x) { return mf.Generated(x); }, histoireDe(mf), cur, s, false);
      }
      return s;
    } catch (...) {
      return {};
    }
  };
  const std::string raison = chanfrein ? "distance trop grande ?" : "rayon trop grand ?";
  if (opts.seule) {
    TopoDS_Shape cur = base;
    for (auto& j : jobs) {
      std::vector<AreteListee> E;
      try {
        E = listerAretes(cur);
      } catch (...) {
      }
      const AreteListee* ed = nullptr;
      for (auto& e : E) {
        if (cur.IsSame(base) ? e.src == j.src : ecart(e.mid, j.mid) < 3) {
          ed = &e;
          break;
        }
      }
      TopoDS_Shape nx;
      bool borne = false;
      std::optional<TopoDS_Shape> outil;
      if (ed) outil = outilAreteSeule(cur, ed->pts, j.r, chanfrein, borne);
      if (outil && borne) {
        // Arête arrêtée par un mur : pris s'il ne crée qu'une face, sinon il a suivi une chaîne que la case écarte
        Travail t = j;
        t.src = ed->src;
        TopoDS_Shape kk = mk(cur, {t});
        if (!kk.IsNull()) {
          const auto cles = clesFaces(cur);
          const std::set<std::string> avant(cles.begin(), cles.end());
          int nees = 0;
          for (auto& c : clesFaces(kk))
            if (c == "?" || !avant.count(c)) nees++;
          if (nees <= 1 && valide(kk)) nx = kk;
        }
      }
      if (outil && nx.IsNull()) {
        try {
          nx = coupe(cur, *outil);
        } catch (...) {
          nx = TopoDS_Shape();
        }
      }
      if (!nx.IsNull()) {
        try {
          if (!(volume(cur) - volume(nx) > 1e-6)) nx = TopoDS_Shape();
        } catch (...) {
        }
      }
      if (nx.IsNull() && ed) {
        Travail t = j;
        t.src = ed->src;
        nx = mk(cur, {t});
        if (!nx.IsNull()) warns.push_back(quoi + " : arête courbe ou concave — suivi de la chaîne tangente (noyau)");
      }
      if (!nx.IsNull()) cur = nx;
      else warns.push_back(quoi + " isolé impossible (" + raison + ")");
    }
    return cur.IsSame(base) ? TopoDS_Shape() : cur;
  }
  TopoDS_Shape s = mk(base, jobs);
  if (!s.IsNull()) return s;
  if (opts.lot) return {};
  TopoDS_Shape cur = base;
  int faits = 0;
  for (auto& j : jobs) {
    std::vector<AreteListee> E;
    try {
      E = listerAretes(cur);
    } catch (...) {
    }
    const AreteListee* ed = nullptr;
    for (auto& e : E)
      if (ecart(e.mid, j.mid) < 3.0) {
        ed = &e;
        break;
      }
    if (!ed) {
      warns.push_back("arête introuvable (" + quoi + " isolé)");
      continue;
    }
    Travail t = j;
    t.src = ed->src;
    TopoDS_Shape un = mk(cur, {t});
    if (!un.IsNull()) {
      cur = un;
      faits++;
    } else {
      warns.push_back(quoi + " isolé impossible (" + raison + ")");
    }
  }
  if (cur.IsSame(base)) return {};
  if (faits < static_cast<int>(jobs.size())) warns.push_back(quoi + " partiel : " + std::to_string(faits) + "/" + std::to_string(jobs.size()));
  return cur;
}

// ---- Résultat invalide refusé : contrôle local des faces autour des arêtes (occFilletZone, occFacesValides) ----
struct Zone {
  double lo[3] = {1e9, 1e9, 1e9}, hi[3] = {-1e9, -1e9, -1e9};
};
bool facesValides(const TopoDS_Shape& sh, const Zone& zone) {
  if (sh.IsNull() || !(zone.hi[0] >= zone.lo[0])) return true;
  try {
    for (TopExp_Explorer ex(sh, TopAbs_FACE); ex.More(); ex.Next()) {
      const TopoDS_Face f = TopoDS::Face(ex.Current());
      Bnd_Box b;
      BRepBndLib::Add(f, b, false);
      const gp_Pnt a = b.CornerMin(), z = b.CornerMax();
      const double A[3] = {a.X(), a.Y(), a.Z()}, Z[3] = {z.X(), z.Y(), z.Z()};
      bool touche = true;
      for (int k = 0; k < 3; k++) touche = touche && Z[k] >= zone.lo[k] && A[k] <= zone.hi[k];
      if (!touche) continue;
      BRepCheck_Analyzer C(f, true);
      if (!C.IsValid()) return false;
    }
    return true;
  } catch (...) {
    return true;
  }
}

// ---- Reprise de dernier recours sur des surfaces converties en NURBS (occFilletNurbs) ----
int compter(const TopoDS_Shape& s, TopAbs_ShapeEnum t) {
  int n = 0;
  for (TopExp_Explorer x(s, t); x.More(); x.Next()) n++;
  return n;
}
TopoDS_Shape composeDe(const std::vector<TopoDS_Shape>& l) {
  if (l.size() == 1) return l[0];
  TopoDS_Compound c;
  BRep_Builder b;
  b.MakeCompound(c);
  for (auto& s : l) b.Add(c, s);
  return c;
}
struct Repris {
  TopoDS_Shape forme;
  bool local = false;
};
std::optional<Repris> repriseNurbs(const TopoDS_Shape& base, const std::vector<Travail>& js, bool chanfrein, bool seule, const std::vector<AreteListee>& aretes) {
  const auto filletNurbs = [&](const TopoDS_Shape& sh) -> TopoDS_Shape {
    try {
      BRepBuilderAPI_NurbsConvert nc(sh, false);
      TopoDS_Shape nb = copie(nc.Shape());
      if (nb.IsNull()) return {};
      const auto E = listerAretes(nb);
      std::vector<Travail> js2;
      for (auto& j : js) {
        const AreteListee* b = nullptr;
        double bd = 1e-3;
        for (auto& e : E) {
          const double d = ecart(e.mid, j.mid);
          if (d < bd) {
            bd = d;
            b = &e;
          }
        }
        if (!b) return {};
        Travail t = j;
        t.src = b->src;
        js2.push_back(t);
      }
      std::vector<std::string> w;
      Options o;
      o.seule = seule;
      o.lot = true;
      TopoDS_Shape s = lancer(nb, js2, w, chanfrein, o);
      if (s.IsNull()) return {};
      for (auto& m : w)
        if (m.find("partiel") != std::string::npos || m.find("impossible") != std::string::npos || m.find("introuvable") != std::string::npos) return {};
      return s;
    } catch (...) {
      return {};
    }
  };
  bool refusNurbs = false;
  const auto local = [&]() -> TopoDS_Shape {
    try {
      double lo[3] = {1e9, 1e9, 1e9}, hi[3] = {-1e9, -1e9, -1e9};
      double rMax = 0;
      for (auto& j : js) {
        rMax = std::max(rMax, j.r);
        const int i = rangDe(aretes, j.src);
        const std::vector<Vec3> un{j.mid};
        for (const Vec3& q : i >= 0 ? aretes[i].pts : un)
          for (int k = 0; k < 3; k++) {
            lo[k] = std::min(lo[k], q[k]);
            hi[k] = std::max(hi[k], q[k]);
          }
      }
      const double m = rMax + 1;
      for (int k = 0; k < 3; k++) {
        lo[k] -= m;
        hi[k] += m;
      }
      const TopoDS_Shape bx = BRepPrimAPI_MakeBox(gp_Pnt(lo[0], lo[1], lo[2]), gp_Pnt(hi[0], hi[1], hi[2])).Shape();
      TopoDS_Shape loc, rest;
      const double tri = std::min(0.5, m / 4);
      try {
        TopTools_ListOfShape L1, L2;
        L1.Append(base);
        L2.Append(bx);
        BRepAlgoAPI_Splitter SP;
        SP.SetArguments(L1);
        SP.SetTools(L2);
        SP.Build();
        if (SP.IsDone()) {
          std::vector<TopoDS_Shape> ins, out;
          const TopoDS_Shape r = SP.Shape();
          for (TopExp_Explorer x(r, TopAbs_SOLID); x.More(); x.Next()) {
            Bnd_Box bb;
            BRepBndLib::Add(x.Current(), bb, false);
            const gp_Pnt A = bb.CornerMin(), Z = bb.CornerMax();
            const double a[3] = {A.X(), A.Y(), A.Z()}, z[3] = {Z.X(), Z.Y(), Z.Z()};
            bool dedans = true;
            for (int k = 0; k < 3; k++) dedans = dedans && a[k] >= lo[k] - tri && z[k] <= hi[k] + tri;
            (dedans ? ins : out).push_back(copie(x.Current()));
          }
          if (!ins.empty() && !out.empty()) {
            loc = composeDe(ins);
            rest = composeDe(out);
          }
        }
      } catch (...) {
        loc = rest = TopoDS_Shape();
      }
      if (loc.IsNull() || rest.IsNull()) {
        BRepAlgoAPI_Common c(base, bx);
        if (!c.IsDone()) return {};
        loc = c.Shape();
        rest = coupe(base, bx);
      }
      const auto airesCoupe = [&](const TopoDS_Shape& sh) {
        double a = 0;
        for (TopExp_Explorer x(sh, TopAbs_FACE); x.More(); x.Next()) {
          GProp_GProps G;
          BRepGProp::SurfaceProperties(x.Current(), G, false, false);
          const gp_Pnt c = G.CentreOfMass();
          const double q[3] = {c.X(), c.Y(), c.Z()};
          bool sur = false;
          for (int k = 0; k < 3; k++) sur = sur || std::abs(q[k] - lo[k]) < 1e-6 || std::abs(q[k] - hi[k]) < 1e-6;
          if (sur) a += G.Mass();
        }
        return a;
      };
      const TopoDS_Shape f = filletNurbs(loc);
      if (f.IsNull()) {
        refusNurbs = true;
        return {};
      }
      const double a0 = airesCoupe(loc), a1 = airesCoupe(f);
      if (!(std::abs(a1 - a0) <= 1e-6 * std::max(1.0, a0))) return {};
      const auto nCaps = [&](const TopoDS_Shape& sh) {
        int n = 0;
        for (TopExp_Explorer x(sh, TopAbs_FACE); x.More(); x.Next()) {
          Bnd_Box bb;
          BRepBndLib::Add(x.Current(), bb, false);
          const gp_Pnt A = bb.CornerMin(), Z = bb.CornerMax();
          const double a[3] = {A.X(), A.Y(), A.Z()}, z[3] = {Z.X(), Z.Y(), Z.Z()};
          bool cap = false;
          for (int k = 0; k < 3; k++)
            for (double c : {lo[k], hi[k]}) cap = cap || (std::abs(a[k] - c) < 1e-4 && std::abs(z[k] - c) < 1e-4);
          if (cap) n++;
        }
        return n;
      };
      const auto sain = [&](const TopoDS_Shape& sh) {
        return !sh.IsNull() && compter(sh, TopAbs_FACE) == compter(rest, TopAbs_FACE) + compter(f, TopAbs_FACE) - nCaps(rest) - nCaps(f) &&
               compter(sh, TopAbs_SOLID) == compter(base, TopAbs_SOLID) && valide(sh);
      };
      TopoDS_Shape g;
      try {
        TopTools_ListOfShape L1, L2;
        L1.Append(rest);
        L2.Append(f);
        BRepAlgoAPI_Fuse F;
        F.SetArguments(L1);
        F.SetTools(L2);
        F.SetGlue(BOPAlgo_GlueShift);
        F.Build();
        if (F.IsDone()) g = copie(F.Shape());
      } catch (...) {
        g = TopoDS_Shape();
      }
      if (sain(g)) return g;
      g = TopoDS_Shape();
      try {
        g = fusion(rest, f);
      } catch (...) {
        g = TopoDS_Shape();
      }
      return sain(g) ? g : TopoDS_Shape();
    } catch (...) {
      return {};
    }
  };
  const TopoDS_Shape g = local();
  if (!g.IsNull()) return Repris{g, true};
  if (refusNurbs) return std::nullopt;
  const TopoDS_Shape s = filletNurbs(base);
  if (!s.IsNull()) return Repris{s, false};
  return std::nullopt;
}
}  // namespace

std::vector<AreteListee> listerAretes(const TopoDS_Shape& shape) {
  std::vector<AreteListee> tout;
  int src = 0;
  for (TopExp_Explorer ex(shape, TopAbs_EDGE); ex.More(); ex.Next(), src++) {
    try {
      BRepAdaptor_Curve ad(TopoDS::Edge(ex.Current()));
      const double u0 = ad.FirstParameter(), u1 = ad.LastParameter();
      if (!(u1 > u0)) continue;
      AreteListee a;
      const gp_Pnt m = ad.Value((u0 + u1) / 2);
      a.mid = {m.X(), m.Y(), m.Z()};
      const int NP = 10;
      for (int i = 0; i <= NP; i++) {
        const gp_Pnt p = ad.Value(u0 + (u1 - u0) * i / NP);
        a.pts.push_back({p.X(), p.Y(), p.Z()});
      }
      for (size_t i = 1; i < a.pts.size(); i++) a.len += ecart(a.pts[i], a.pts[i - 1]);
      a.src = src;
      if (a.len > 1e-6) tout.push_back(std::move(a));
    } catch (const Standard_Failure&) {
    }
  }
  std::set<std::string> vus;
  std::vector<AreteListee> uniques;
  for (auto& a : tout) {
    const std::string k = fixe(a.mid[0], 2) + "," + fixe(a.mid[1], 2) + "," + fixe(a.mid[2], 2);
    if (vus.insert(k).second) uniques.push_back(std::move(a));
  }
  return uniques;
}

std::vector<int> chaineTangente(const std::vector<AreteListee>& liste, int depart) {
  const int n = static_cast<int>(liste.size());
  if (depart < 0 || depart >= n) return {depart};
  const auto cle = [](const Vec3& p) {
    const auto nm = [](double v) { return fixe(std::abs(v) < 0.0005 ? 0.0 : v, 3); };
    return nm(p[0]) + "," + nm(p[1]) + "," + nm(p[2]);
  };
  std::map<std::string, std::vector<int>> sommets;
  std::vector<std::array<std::string, 2>> bouts(n);
  for (int i = 0; i < n; i++) {
    const auto& pts = liste[i].pts;
    if (pts.size() < 2) continue;
    bouts[i] = {cle(pts.front()), cle(pts.back())};
    sommets[bouts[i][0]].push_back(i);
    sommets[bouts[i][1]].push_back(i);
  }
  const auto tangente = [&](int ei, bool auBout) {
    const auto& pts = liste[ei].pts;
    const Vec3& a = auBout ? pts[pts.size() - 2] : pts[0];
    const Vec3& b = auBout ? pts[pts.size() - 1] : pts[1];
    return Vec3{b[0] - a[0], b[1] - a[1], b[2] - a[2]};
  };
  const auto estTangente = [&](int a, int b, const std::string& k) {
    if (bouts[a][0].empty() || bouts[b][0].empty()) return false;
    const Vec3 ta = tangente(a, bouts[a][0] != k), tb = tangente(b, bouts[b][0] != k);
    const double la = hyp(ta[0], ta[1], ta[2]), lb = hyp(tb[0], tb[1], tb[2]);
    if (la < 1e-9 || lb < 1e-9) return false;
    return std::abs((ta[0] * tb[0] + ta[1] * tb[1] + ta[2] * tb[2]) / (la * lb)) > 0.985;
  };
  std::vector<int> vus{depart};
  std::vector<char> pris(n, 0);
  pris[depart] = 1;
  for (size_t tete = 0; tete < vus.size(); tete++) {
    const int cur = vus[tete];
    if (bouts[cur][0].empty()) continue;
    for (const std::string& k : bouts[cur])
      for (int nb : sommets[k]) {
        if (pris[nb]) continue;
        if (estTangente(cur, nb, k)) {
          pris[nb] = 1;
          vus.push_back(nb);
        }
      }
  }
  return vus;
}

bool ancrePour(const Document& d, const Vec3& m, AncreArete& out) {
  const auto scan = [&](double RAD, bool loin) {
    bool trouve = false;
    double meilleur = 0;
    const auto considerer = [&](const AncreArete& res, double d2, double w) {
      const double sc = d2 + 0.25 * std::abs(w) + (res.t == "p" ? -0.001 : 0);
      if (!trouve || sc < meilleur) {
        trouve = true;
        meilleur = sc;
        out = res;
      }
    };
    for (const Esquisse& s : d.esquisses) {
      const Vec3 q = projeter(s, m);
      const double x2 = q[0], y2 = q[1], z2 = q[2];
      const std::string* bestP = nullptr;
      double bdP = RAD;
      // Object.keys : l'ordre du fichier, pour départager deux points à la même distance
      for (const std::string& pid : s.ordre) {
        const Pt* p = s.point(pid);
        if (!p) continue;
        const double dd = hyp(p->x - x2, p->y - y2);
        if (dd < bdP) {
          bdP = dd;
          bestP = &pid;
        }
      }
      if (bestP) {
        AncreArete a;
        a.existe = true;
        a.t = "p";
        a.sk = s.id;
        a.id = *bestP;
        a.z = arrondi(z2, 3);
        a.aZ = true;
        a.loin = loin;
        considerer(a, bdP, z2);
      }
      const Entite* bestE = nullptr;
      double bdE = RAD;
      for (const Entite& e : s.entites) {
        if (e.construction || e.ref) continue;
        if (e.t == "line") {
          const Pt* A0 = s.point(e.p1);
          const Pt* B0 = s.point(e.p2);
          if (!A0 || !B0) continue;
          const double dd = distDepouille(d, s.id, z2, distSeg2(x2, y2, A0->x, A0->y, B0->x, B0->y));
          if (dd < bdE) {
            bdE = dd;
            bestE = &e;
          }
        } else if (e.t == "circle" || e.t == "arc") {
          const Pt* C = s.point(e.pc);
          if (!C || !(e.r > 0)) continue;
          if (e.t == "arc") {
            double a1, a2;
            if (!anglesArc(s, e, a1, a2)) continue;
            if (relatif(std::atan2(y2 - C->y, x2 - C->x), a1) > a2 - a1 + 0.05) continue;
          }
          const double dd = distDepouille(d, s.id, z2, std::abs(hyp(x2 - C->x, y2 - C->y) - e.r));
          if (dd < bdE) {
            bdE = dd;
            bestE = &e;
          }
        }
      }
      if (bestE) {
        const auto dists = etenduesEsquisse(d, s.id);
        int cote = 0;
        if (!dists.empty()) {
          bool sentinelle = true;
          for (auto& x : dists) sentinelle = sentinelle && (!std::isfinite(x.lo) || !std::isfinite(x.hi) || std::abs(x.lo) > 1000 || std::abs(x.hi) > 1000);
          if (sentinelle) {
            cote = z2 >= -0.5 ? 1 : 0;
          } else {
            bool bas = false, haut = false;
            for (auto& x : dists) {
              bas = bas || std::abs(z2 - x.lo) < 1.0;
              haut = haut || std::abs(z2 - x.hi) < 1.0;
            }
            cote = bas ? 0 : 1;
            if (bas && haut) cote = std::abs(z2) < 1.0 ? 0 : 1;
          }
        } else {
          cote = std::abs(z2) < 1.0 ? 0 : 1;
        }
        AncreArete a;
        a.existe = true;
        a.t = "e";
        a.sk = s.id;
        a.id = bestE->id;
        a.z = arrondi(z2, 3);
        a.aZ = true;
        a.side = cote;
        a.aSide = true;
        a.dist = dists.empty() ? 0 : dists[0].hi;
        a.loin = loin;
        considerer(a, bdE, z2);
      }
    }
    return trouve;
  };
  return scan(1.0, false) || scan(8.0, true);
}

TopoDS_Shape appliquerConge(const Document& d, Fonction& f, const TopoDS_Shape& base, std::vector<std::string>& messages) {
  const bool chanfrein = f.chamfer;
  const std::string lab = chanfrein ? "chanfrein exact" : "congé exact";
  const std::string dp = chanfrein ? "D" : "R";
  const std::string prefixe = f.nom + " : ";
  const auto dire = [&](const std::string& m) { messages.push_back(prefixe + m); };
  f.congeErreur.clear();
  f.congeAjuste.clear();
  std::vector<AreteListee> aretes = listerAretes(base);
  const auto aliasAretes = nomsSurAretes(base, aretes);
  if (aretes.empty()) {
    dire(lab + " : aucune arête détectée");
    return base;
  }
  // Entrées « tangente » d'anciens rejeux : la chaîne se re-déduit au calcul
  {
    bool cliquee = false;
    for (auto& e : f.aretes) cliquee = cliquee || e.nomAffiche != "tangente";
    if (cliquee) f.aretes.erase(std::remove_if(f.aretes.begin(), f.aretes.end(), [](const AreteConge& e) { return e.nomAffiche == "tangente"; }), f.aretes.end());
  }
  // Doublons anciens : même rayon, même longueur, même position, même sélection
  {
    const auto cleAncre = [](const AreteConge& e) {
      if (!e.ancre.existe) return std::string();
      return e.ancre.t + "|" + e.ancre.sk + "|" + e.ancre.id + "|" + std::to_string(e.ancre.aSide ? e.ancre.side : -1) + "|" + std::to_string(std::llround(e.ancre.z * 10));
    };
    std::vector<AreteConge> uniques;
    int nd = 0;
    for (auto& se : f.aretes) {
      bool double_ = false;
      for (auto& u : uniques) {
        const bool memeSel = (!u.ancre.existe || !se.ancre.existe || cleAncre(u) == cleAncre(se)) && (!u.aPos0 || !se.aPos0 || ecart(u.pos0, se.pos0) <= 2.0);
        if (std::abs(u.r - se.r) < 1e-9 && std::abs(u.len - se.len) <= std::max(0.01, 0.02 * se.len) && ecart(u.pos, se.pos) <= 0.75 && memeSel) {
          double_ = true;
          break;
        }
      }
      if (double_) nd++;
      else uniques.push_back(se);
    }
    if (nd) {
      f.aretes = std::move(uniques);
      dire(f.nom + " : " + std::to_string(nd) + " doublon(s) fusionné(s)");
    }
  }
  struct Job {
    int bi = 0;
    double r = 0;
  };
  std::vector<Job> jobs;
  std::vector<int> rangTrouve(f.aretes.size(), -1);
  const auto prendre = [&](int bi, double r, int se) {
    if (se >= 0) {
      AreteConge& e = f.aretes[se];
      rangTrouve[se] = bi;
      if (!e.aPos0) {
        e.pos0 = e.pos;
        e.aPos0 = true;
      }
      e.pos = aretes[bi].mid;
      e.len = arrondi(aretes[bi].len, 3);
      if (e.nom.empty() && !aretes[bi].nom.empty()) e.nom = aretes[bi].nom;  // référence neuve ou document ancien : le nom est retenu
    }
    for (auto& j : jobs)
      if (j.bi == bi) {
        j.r = std::max(j.r, r);
        return;
      }
    jobs.push_back({bi, r});
  };
  const auto trouvee = [&](int se) { return rangTrouve[se] >= 0; };
  for (size_t k = 0; k < f.aretes.size(); k++) {
    const int ks = static_cast<int>(k);
    AreteConge& se = f.aretes[k];
    if (!(se.r > 0)) continue;
    // Le nom d'abord : l'arête est celle qui sépare les mêmes faces, où qu'elle soit partie
    if (!se.nom.empty()) {
      const int iN = nomsTrouveArete(aretes, aliasAretes, se.nom, &se.pos);
      if (iN >= 0) {
        se.nom = aretes[iN].nom;
        prendre(iN, se.r, ks);
        continue;
      }
      dire(std::string(chanfrein ? "chanfrein" : "congé") + " " + dp + xNum(se.r) + " : l’arête d’origine n’existe plus près de " + nomsPos(se.pos) + " — recherche par position");
    }
    if (!se.ancre.existe) {
      AncreArete a0;
      if (ancrePour(d, se.pos, a0)) se.ancre = a0;
    }
    const int ancree = chercherParAncre(d, se, aretes);
    if (ancree >= 0) {
      const Vec3& ref = se.aPos0 ? se.pos0 : se.pos;
      const double bd = ecart(aretes[ancree].mid, ref);
      if (bd <= 2.0) {
        prendre(ancree, se.r, ks);
        continue;
      }
      std::vector<int> nees;
      for (size_t i = 0; i < aretes.size(); i++)
        if (ecart(aretes[i].mid, ref) <= 2.0) nees.push_back(static_cast<int>(i));
      if (!nees.empty() && ancreEncoreLa(d, se) != 0) {
        std::stable_sort(nees.begin(), nees.end(), [&](int a, int b) { return ecart(aretes[a].mid, ref) < ecart(aretes[b].mid, ref); });
        prendre(nees[0], se.r, ks);
        dire("congé " + dp + xNum(se.r) + " : ancre d'esquisse divergente ignorée (pointait " + xNum(bd) + " mm du clic) — arête sélectionnée rétablie");
        continue;
      }
      prendre(ancree, se.r, ks);
      continue;
    }
    // Passe 2 : meilleur candidat unique
    int best = -1;
    double bs = 0;
    for (size_t i = 0; i < aretes.size(); i++) {
      const AreteListee& e = aretes[i];
      const double xyd = hyp(e.mid[0] - se.pos[0], e.mid[1] - se.pos[1]);
      if (xyd > 10.0) continue;
      const Vec3& p0 = e.pts.front();
      const Vec3& p1 = e.pts.back();
      double sc;
      if (std::abs(p1[2] - p0[2]) > hyp(p1[0] - p0[0], p1[1] - p0[1])) {
        if (xyd > 3.0) continue;
        sc = xyd + 0.2 * std::min(std::abs(e.mid[2] - se.pos[2]), 10.0) + 0.15 * std::min(std::abs(e.len - se.len), 20.0);
      } else {
        double zref = se.pos[2];
        if (se.ancre.existe && se.ancre.t == "e") {
          const auto cd = etenduesEsquisse(d, se.ancre.sk);
          const double lo = cd.empty() ? 0 : cd[0].lo, hi = cd.empty() ? 0 : cd[0].hi;
          const double zr = se.ancre.aZ ? se.ancre.z : se.pos[2];
          zref = se.ancre.aSide ? (se.ancre.side == 0 ? lo : hi) : (std::abs(zr) < 0.6 ? lo : hi);
        } else if (se.ancre.existe && se.ancre.t == "p") {
          continue;
        }
        if (std::abs(e.mid[2] - zref) > 1.5) continue;
        if (se.len > 0 && std::abs(e.len - se.len) > std::max(1.5, 0.25 * se.len)) continue;
        sc = xyd + 0.2 * std::abs(e.mid[2] - zref) + 0.15 * std::abs(e.len - se.len);
      }
      if (best < 0 || sc < bs) {
        best = static_cast<int>(i);
        bs = sc;
      }
    }
    if (best >= 0) prendre(best, se.r, ks);
  }
  // Passe 2b : tangence persistée, la chaîne se recalcule sur le solide actuel
  if (f.tangent == 1) {
    std::vector<int> es, racines;
    bool germe = false;
    for (size_t k = 0; k < f.aretes.size(); k++)
      if (f.aretes[k].r > 0) {
        es.push_back(static_cast<int>(k));
        germe = germe || f.aretes[k].seed;
      }
    for (int k : es)
      if ((!germe || f.aretes[k].seed) && trouvee(k)) racines.push_back(k);
    if (!racines.empty()) {
      std::vector<int> chaine;  // ordre d'insertion d'un Set
      for (int k : racines)
        for (int j : chaineTangente(aretes, rangTrouve[k]))
          if (std::find(chaine.begin(), chaine.end(), j) == chaine.end()) chaine.push_back(j);
      const auto aJob = [&](int j) {
        for (auto& x : jobs)
          if (x.bi == j) return true;
        return false;
      };
      if (!chaine.empty()) {
        const auto refDe = [&](int k) -> const Vec3& { return f.aretes[k].aPos0 ? f.aretes[k].pos0 : f.aretes[k].pos; };
        for (int k : es) {
          if (trouvee(k)) continue;
          int best = -1;
          double bd = 60;
          for (int j : chaine) {
            if (aJob(j)) continue;
            const double dd = ecart(aretes[j].mid, refDe(k));
            if (dd < bd) {
              bd = dd;
              best = j;
            }
          }
          if (best >= 0) prendre(best, f.aretes[k].r, k);
        }
        for (int j : chaine) {
          if (aJob(j)) continue;
          bool doublon = false;
          for (int k : es) doublon = doublon || ecart(refDe(k), aretes[j].mid) < 0.75;
          if (doublon) continue;
          int bs = -1;
          double bd = 1e9;
          for (int k : racines) {
            const double dd = ecart(refDe(k), aretes[j].mid);
            if (dd < bd) {
              bd = dd;
              bs = k;
            }
          }
          if (bs >= 0) prendre(j, f.aretes[bs].r, -1);
        }
      }
    }
  }
  // Passe 3 : signature de groupe pour orphelins, seulement si c'est une bijection
  {
    struct Groupe {
      double z2, r;
      std::vector<int> liste;
    };
    std::vector<Groupe> groupes;
    for (size_t k = 0; k < f.aretes.size(); k++) {
      const AreteConge& se = f.aretes[k];
      if (!(se.r > 0) || trouvee(static_cast<int>(k))) continue;
      const double z2 = std::floor(se.pos[2] * 2 + 0.5) / 2;
      Groupe* g = nullptr;
      for (auto& x : groupes)
        if (x.z2 == z2 && x.r == se.r) g = &x;
      if (!g) {
        groupes.push_back({z2, se.r, {}});
        g = &groupes.back();
      }
      g->liste.push_back(static_cast<int>(k));
    }
    for (auto& g : groupes) {
      const double zref = f.aretes[g.liste[0]].pos[2], rr = f.aretes[g.liste[0]].r;
      std::vector<int> cands;
      for (size_t i = 0; i < aretes.size(); i++) {
        bool pris = false;
        for (auto& j : jobs) pris = pris || j.bi == static_cast<int>(i);
        if (pris || std::abs(aretes[i].mid[2] - zref) > 35) continue;
        cands.push_back(static_cast<int>(i));
      }
      if (cands.size() == g.liste.size() && !cands.empty()) {
        for (size_t c = 0; c < cands.size(); c++) prendre(cands[c], f.aretes[g.liste[c]].r, g.liste[c]);
        dire("boucle de " + std::to_string(cands.size()) + " arête(s) retrouvée par signature (z≈" + fixe(zref, 1) + ", " + dp + xNum(rr) + ")");
      } else {
        for (int k : g.liste)
          dire(std::string(chanfrein ? "chanfrein" : "congé") + " " + dp + xNum(f.aretes[k].r) + " : arête introuvable près de " + posTexte(f.aretes[k].pos) + " — géométrie modifiée ? (re-sélectionnez la boucle)");
      }
    }
  }
  f.congeTrouvees = 0;
  f.congeTotal = 0;
  for (size_t k = 0; k < f.aretes.size(); k++)
    if (f.aretes[k].r > 0) {
      f.congeTotal++;
      if (trouvee(static_cast<int>(k))) f.congeTrouvees++;
    }
  if (jobs.empty()) return base;

  std::vector<Travail> js;
  for (auto& j : jobs) js.push_back({aretes[j.bi].src, j.r, aretes[j.bi].mid});
  const bool seule = f.tangent == 0;
  Options opts;
  opts.seule = seule;
  std::vector<std::string> wA;
  Zone zone;
  {
    double rMax = -1e300;
    for (auto& j : js) rMax = std::max(rMax, j.r);
    const double m = rMax + 1;
    for (auto& j : jobs)
      for (const Vec3& q : aretes[j.bi].pts)
        for (int k = 0; k < 3; k++) {
          zone.lo[k] = std::min(zone.lo[k], q[k] - m);
          zone.hi[k] = std::max(zone.hi[k], q[k] + m);
        }
  }
  bool invalide = false;
  int baseSaine = -1;  // -1 : pas encore regardé
  const auto refuser = [&](const TopoDS_Shape& sh) {
    if (sh.IsNull() || facesValides(sh, zone)) return false;
    if (baseSaine < 0) baseSaine = facesValides(base, zone) ? 1 : 0;
    if (!baseSaine) return false;
    invalide = true;
    return true;
  };
  TopoDS_Shape s = lancer(base, js, wA, chanfrein, opts);
  if (refuser(s)) s = TopoDS_Shape();
  std::optional<Repris> rN;
  if (s.IsNull()) rN = repriseNurbs(base, js, chanfrein, seule, aretes);
  if (rN && refuser(rN->forme)) rN.reset();
  if (rN) {
    s = rN->forme;
    double rMin = 1e300;
    for (auto& j : js) rMin = std::min(rMin, j.r);
    const std::string qui = f.nom + " : " + lab + " " + dp + xNum(rMin) + " refusé par le noyau sur les surfaces exactes — calculé en NURBS";
    dire(rN->local ? qui + " dans un bloc autour des arêtes, recollé au corps (faces de ce bloc en NURBS et scindées à son bord : esquisse sur ces faces et reconnaissance FAO peuvent en souffrir)"
                   : qui + " sur une copie du corps entier (faces de ce corps en NURBS à partir d'ici : esquisse sur face plane, reconnaissance FAO et cotes de cercles en aval peuvent ne plus fonctionner)");
  } else {
    for (auto& m : wA) dire(m);
  }
  if (s.IsNull()) {
    // Le plus grand rayon qui passe est cherché puis appliqué, avec un avertissement : le rayon demandé reste enregistré
    double rMax = 1e300, lMin = 1e300;
    for (auto& j : js) rMax = std::min(rMax, j.r);
    for (auto& j : jobs) lMin = std::min(lMin, aretes[j.bi].len);
    const std::string dl = lMin > 0 ? " sur une arête de " + xNum(lMin) + " mm" : "";
    double ok = 0, kOk = 0, kKo = 1;
    TopoDS_Shape okSh;
    bool aV0 = true, aRef = false;
    double v0 = 0, refR = 0, refDv = 0;
    try {
      v0 = volume(base);
    } catch (...) {
      aV0 = false;
    }
    const auto essai = [&](double k) {
      const double r2 = std::max(0.5, arrondi(rMax * k, 2));
      std::vector<std::string> w2;
      std::vector<Travail> js2 = js;
      for (auto& j : js2) j.r = r2;
      TopoDS_Shape t = lancer(copie(base), js2, w2, chanfrein, opts);
      bool bon = !t.IsNull() && (facesValides(t, zone) || baseSaine == 0);
      if (bon && aV0) {
        try {
          const double dv = volume(t) - v0;
          if (!aRef) {
            aRef = true;
            refR = r2;
            refDv = dv;
          } else if (std::abs(refDv) > 1e-6 && ((dv * refDv < 0 && std::abs(dv) > 1e-3 * std::abs(v0)) || std::abs(dv) > 1.5 * std::abs(refDv) * (r2 / refR) * (r2 / refR))) {
            bon = false;
          }
        } catch (...) {
        }
      }
      if (!bon) return false;
      ok = r2;
      okSh = t;
      kOk = k;
      return true;
    };
    if (essai(0.2)) {
      const TopoDS_Shape sh0 = okSh;
      const double ok0 = ok;
      okSh = TopoDS_Shape();
      for (double k : {0.7, 0.5, 0.4, 0.3}) {
        if (essai(k)) break;
        kKo = k;
      }
      if (!okSh.IsNull()) {
        for (int i = 0; i < 3; i++) {
          const double k = (kOk + kKo) / 2;
          if (!essai(k)) kKo = k;
        }
      } else {
        okSh = sh0;
        ok = ok0;
      }
    }
    if (!okSh.IsNull()) {
      const std::string adj = dp + xNum(rMax) + " impossible ici" + (invalide ? " (le noyau rend un solide déchiré)" : "") + " — appliqué " + dp + xNum(ok) + ", le plus grand qui passe";
      dire(lab + " " + adj);
      f.congeAjuste = adj;
      return okSh;
    }
    const std::string why = chanfrein ? "distance trop grande" : "rayon trop grand";
    const std::string dechire = invalide ? " : le noyau rend un solide déchiré (faces invalides), refusé" : "";
    dire(lab + " " + dp + xNum(rMax) + " impossible sur " + std::to_string(js.size()) + " arête(s)" + dl + dechire + " — " + why + " ou faces déjà consommées par un autre congé ? — arête trop courte, aucun rayon testé ne passe");
    f.congeErreur = dp + xNum(rMax) + " impossible" + dl + dechire + " — arête trop courte ou faces déjà consommées par un autre congé";
    return base;
  }
  return s;
}

// ---- Le choix des arêtes (src/80-conges-chanfreins.js) ----
namespace {
std::string cleArete(const Vec3& m, double l) { return fixe(m[0], 2) + "," + fixe(m[1], 2) + "," + fixe(m[2], 2) + "|" + fixe(l, 2); }
// sample : milieu et longueur sur 12 cordes
bool mesureArete(const TopoDS_Edge& e, Vec3& mid, double& len) {
  BRepAdaptor_Curve ad(e);
  const double u0 = ad.FirstParameter(), u1 = ad.LastParameter();
  if (!(u1 > u0)) return false;
  const gp_Pnt m = ad.Value((u0 + u1) / 2);
  mid = {m.X(), m.Y(), m.Z()};
  len = 0;
  gp_Pnt p0;
  for (int i = 0; i <= 12; i++) {
    const gp_Pnt p = ad.Value(u0 + (u1 - u0) * i / 12);
    if (i) len += p.Distance(p0);
    p0 = p;
  }
  return len > 1e-6;
}
struct AxeCylindre {
  bool oui = false;
  double r = 0;
  gp_Dir d;
  gp_Pnt o;
};
bool memeCylindre(const std::vector<int>& fl, const std::vector<AxeCylindre>& cyl) {
  if (fl.size() != 2) return false;
  const AxeCylindre& a = cyl[fl[0]];
  const AxeCylindre& b = cyl[fl[1]];
  if (!a.oui || !b.oui || std::abs(a.r - b.r) > 1e-6) return false;
  const double c = a.d.X() * b.d.X() + a.d.Y() * b.d.Y() + a.d.Z() * b.d.Z();
  if (std::abs(std::abs(c) - 1) > 1e-9) return false;
  const double w[3] = {b.o.X() - a.o.X(), b.o.Y() - a.o.Y(), b.o.Z() - a.o.Z()};
  const double t = w[0] * a.d.X() + w[1] * a.d.Y() + w[2] * a.d.Z();
  return hyp(w[0] - t * a.d.X(), w[1] - t * a.d.Y(), w[2] - t * a.d.Z()) < 1e-6;
}
}  // namespace

std::vector<AreteVue> aretesVisibles(const TopoDS_Shape& shape) {
  std::vector<AreteVue> out;
  std::vector<TopoDS_Face> faces;
  std::vector<AxeCylindre> cyl;
  for (TopExp_Explorer fx(shape, TopAbs_FACE); fx.More(); fx.Next()) {
    const TopoDS_Face f = TopoDS::Face(fx.Current());
    faces.push_back(f);
    AxeCylindre c;
    try {
      BRepAdaptor_Surface ad(f, true);
      if (ad.GetType() == GeomAbs_Cylinder) {
        const gp_Cylinder C = ad.Cylinder();
        c.oui = true;
        c.r = C.Radius();
        c.d = C.Axis().Direction();
        c.o = C.Axis().Location();
      }
    } catch (const Standard_Failure&) {
    }
    cyl.push_back(c);
  }
  std::map<std::string, std::vector<int>> voisines;
  std::set<std::string> coutures;
  for (size_t fi = 0; fi < faces.size(); fi++)
    for (TopExp_Explorer ee(faces[fi], TopAbs_EDGE); ee.More(); ee.Next()) {
      try {
        Vec3 m;
        double l = 0;
        if (!mesureArete(TopoDS::Edge(ee.Current()), m, l)) continue;
        std::vector<int>& fl = voisines[cleArete(m, l)];
        if (std::find(fl.begin(), fl.end(), static_cast<int>(fi)) == fl.end()) fl.push_back(static_cast<int>(fi));
        else coutures.insert(cleArete(m, l));
      } catch (const Standard_Failure&) {
      }
    }
  std::set<std::string> vus;
  for (TopExp_Explorer ex(shape, TopAbs_EDGE); ex.More(); ex.Next()) {
    const TopoDS_Edge e = TopoDS::Edge(ex.Current());
    try {
      Vec3 mid;
      double len = 0;
      if (!mesureArete(e, mid, len)) continue;
      const std::string k = cleArete(mid, len);
      if (!vus.insert(k).second) continue;
      const std::vector<int> fl = voisines.count(k) ? voisines[k] : std::vector<int>();
      if ((coutures.count(k) && fl.size() <= 1) || memeCylindre(fl, cyl)) continue;
      bool vive = true;
      if (fl.size() >= 2) {
        try {
          vive = BRep_Tool::Continuity(e, faces[fl[0]], faces[fl[1]]) == GeomAbs_C0;
        } catch (const Standard_Failure&) {
          vive = true;
        }
      } else {
        vive = false;
      }
      // Le noyau dit « vive » pour un congé sur un congé alors que les surfaces sont tangentes : on le vérifie sur la géométrie
      if (vive && fl.size() >= 2) {
        bool mesure = false, stop = false;
        double maxA = 0;
        for (size_t i = 0; i < fl.size() && !stop; i++)
          for (size_t j = i + 1; j < fl.size() && !stop; j++) {
            try {
              const TopoDS_Face& E1 = faces[fl[i]];
              const TopoDS_Face& E2 = faces[fl[j]];
              BRepAdaptor_Curve2d g1(e, E1), g2(e, E2);
              const double w0 = g1.FirstParameter(), w1 = g1.LastParameter();
              if (!(w1 > w0)) continue;
              TopLoc_Location l1, l2;
              const occ::handle<Geom_Surface> s1 = BRep_Tool::Surface(E1, l1), s2 = BRep_Tool::Surface(E2, l2);
              for (double p : {0.25, 0.5, 0.75}) {
                const gp_Pnt2d q1 = g1.Value(w0 + (w1 - w0) * p), q2 = g2.Value(w0 + (w1 - w0) * p);
                GeomLProp_SLProps P1(s1, q1.X(), q1.Y(), 1, 1e-6), P2(s2, q2.X(), q2.Y(), 1, 1e-6);
                if (!P1.IsNormalDefined() || !P2.IsNormalDefined()) {
                  mesure = false;
                  stop = true;
                  break;
                }
                mesure = true;
                const gp_Dir n1 = P1.Normal(), n2 = P2.Normal();
                const double d = n1.X() * n2.X() + n1.Y() * n2.Y() + n1.Z() * n2.Z();
                const double th = std::acos(std::max(-1.0, std::min(1.0, d))) * 180 / PI;
                maxA = std::max(maxA, std::min(th, 180 - th));
              }
            } catch (const Standard_Failure&) {
              mesure = false;
              stop = true;
            }
          }
        if (mesure && maxA < 3) vive = false;
      }
      out.push_back({mid, len, vive, e});
    } catch (const Standard_Failure&) {
    }
  }
  return out;
}

ChoixConge::ChoixConge(const Document& d, const TopoDS_Shape& base, bool chanfrein, double rayon, bool tangent) : doc_(d), base_(base), chanfrein_(chanfrein), rayon_(rayon), tangent_(tangent) {
  for (AreteVue& a : aretesVisibles(base)) (a.vive ? vives_ : tangentes_).push_back(a);
  const std::vector<std::string> cles = clesFaces(base);
  clesBase_.insert(cles.begin(), cles.end());
}

std::string ChoixConge::libelle() const { return chanfrein_ ? "Chanfrein exact" : "Congé exact"; }

// xSelSync : la sélection = les arêtes cliquées ; un rayon saisi arête par arête survit
void ChoixConge::synchroniser() {
  std::vector<SelConge> gardees;
  for (int i : germes_) {
    const AreteVue& e = vives_[i];
    bool deja = false;
    for (auto& u : gardees) deja = deja || ecart(u.pos, e.mid) < 0.75;
    if (deja) continue;
    SelConge s;
    s.pos = e.mid;
    s.r = rayon_;
    s.len = arrondi(e.len, 3);
    ancrePour(doc_, e.mid, s.ancre);
    gardees.push_back(std::move(s));
  }
  for (const SelConge& s : sel_)
    for (SelConge& k : gardees)
      if (ecart(k.pos, s.pos) < 0.75) {
        k.r = s.r;
        break;
      }
  sel_ = std::move(gardees);
}

void ChoixConge::basculer(int i) {
  if (i < 0 || i >= static_cast<int>(vives_.size())) return;
  const auto it = std::find(germes_.begin(), germes_.end(), i);
  if (it != germes_.end()) germes_.erase(it);
  else germes_.push_back(i);
  synchroniser();
}

std::string ChoixConge::cliquer(const TopoDS_Shape& s) {
  const std::string L = libelle();
  const std::string aide = L + " : cliquez une arête vive (noire · surlignée au survol) ou une face (= toute sa boucle)." + (tangent_ ? " Les arêtes tangentes à celle cliquée sont suivies." : " Clic = ajouter / retirer une arête.");
  if (s.IsNull()) return aide;
  const auto proche = [](const std::vector<AreteVue>& l, const Vec3& m) {
    int b = -1;
    double bd = 0.75;
    for (size_t i = 0; i < l.size(); i++) {
      const double d = ecart(l[i].mid, m);
      if (d < bd) {
        bd = d;
        b = static_cast<int>(i);
      }
    }
    return b;
  };
  if (s.ShapeType() == TopAbs_EDGE) {
    Vec3 m;
    double l = 0;
    if (!mesureArete(TopoDS::Edge(s), m, l)) return aide;
    const int i = proche(vives_, m);
    if (i < 0) {
      if (proche(tangentes_, m) >= 0)
        return L + " : arête TANGENTE (raccord lisse, grise) — les deux faces se rejoignent en douceur, il n’y a rien à " + (chanfrein_ ? "chanfreiner" : "arrondir") + " ici ; cliquez une arête vive (noire) ou une face (= toute sa boucle).";
      return aide;
    }
    basculer(i);
    return L + " : " + std::to_string(sel_.size()) + " arête(s) sélectionnée(s).";
  }
  if (s.ShapeType() != TopAbs_FACE) return aide;
  // exactFaceToggle
  std::vector<Vec3> mids;
  for (TopExp_Explorer ee(s, TopAbs_EDGE); ee.More(); ee.Next()) {
    Vec3 m;
    double l = 0;
    BRepAdaptor_Curve ad(TopoDS::Edge(ee.Current()));
    if (!(ad.LastParameter() > ad.FirstParameter())) continue;
    if (mesureArete(TopoDS::Edge(ee.Current()), m, l)) mids.push_back(m);
  }
  if (mids.empty()) return aide;
  std::vector<int> valides;
  for (auto& m : mids)
    if (const int i = proche(vives_, m); i >= 0) valides.push_back(i);
  if (valides.empty()) return L + " : cette face n’a aucune arête vive à " + (chanfrein_ ? "chanfreiner." : "arrondir.");
  bool toutes = true;
  for (int i : valides) toutes = toutes && std::find(germes_.begin(), germes_.end(), i) != germes_.end();
  for (int i : valides) {
    const auto it = std::find(germes_.begin(), germes_.end(), i);
    if (toutes && it != germes_.end()) germes_.erase(it);
    if (!toutes && it == germes_.end()) germes_.push_back(i);
  }
  synchroniser();
  return L + " : boucle de " + std::to_string(valides.size()) + " arête(s) " + (toutes ? "retirée" : "ajoutée") + " · " + std::to_string(sel_.size()) + " au total.";
}

void ChoixConge::rayonDefaut(double r) {
  // Les arêtes restées au rayon par défaut le suivent ; un rayon tapé pour une arête reste le sien
  for (SelConge& s : sel_)
    if (s.r == rayon_) s.r = r;
  rayon_ = r;
}
void ChoixConge::rayonArete(size_t i, double r) {
  if (i < sel_.size()) sel_[i].r = r;
}
void ChoixConge::tangentes(bool oui) {
  tangent_ = oui;
  synchroniser();
}

// xPreviewUpdate et xPreviewShape : la pièce telle qu'elle sera, ou pourquoi ce n'est pas possible
const ApercuConge& ChoixConge::apercu() {
  std::string sig = chanfrein_ ? "#c" : "#f";
  sig += tangent_ ? "#t" : "#1";
  std::vector<Travail> jobs;
  std::vector<std::vector<Vec3>> traces;
  bool aSel = false;
  const std::vector<AreteListee> E = listerAretes(base_);
  for (const SelConge& s : sel_) {
    if (!(s.r > 0)) continue;
    aSel = true;
    sig += "|" + fixe(s.pos[0], 2) + "," + fixe(s.pos[1], 2) + "," + fixe(s.pos[2], 2) + "/" + std::to_string(s.r);
    int bi = -1;
    double bd = 1e9;
    for (size_t i = 0; i < E.size(); i++) {
      const double d = ecart(E[i].mid, s.pos);
      if (d < bd) {
        bd = d;
        bi = static_cast<int>(i);
      }
    }
    if (bi >= 0 && bd < 1.5) {
      Travail t;
      t.src = E[bi].src;
      t.r = s.r;
      t.mid = E[bi].mid;
      jobs.push_back(t);
      traces.push_back(E[bi].pts);
    }
  }
  if (sig == signature_) return apercu_;
  signature_ = sig;
  apercu_ = ApercuConge();
  if (!aSel || jobs.empty()) return apercu_;
  const auto zonePour = [&](double r) {
    Zone z;
    const double m = r + 1;
    for (auto& pts : traces)
      for (const Vec3& q : pts)
        for (int k = 0; k < 3; k++) {
          z.lo[k] = std::min(z.lo[k], q[k] - m);
          z.hi[k] = std::max(z.hi[k], q[k] + m);
        }
    return z;
  };
  double rGrand = 0, rPetit = 1e300;
  for (auto& j : jobs) {
    rGrand = std::max(rGrand, j.r);
    rPetit = std::min(rPetit, j.r);
  }
  Options o;
  o.seule = !tangent_;
  std::vector<std::string> warns;
  TopoDS_Shape sh;
  try {
    sh = lancer(base_, jobs, warns, chanfrein_, o);
  } catch (const Standard_Failure&) {
    sh.Nullify();
  }
  if (!sh.IsNull()) {
    const Zone zone = zonePour(rGrand);
    if (!facesValides(sh, zone) && facesValides(base_, zone)) {
      sh.Nullify();
      std::optional<Repris> rN;
      try {
        rN = repriseNurbs(base_, jobs, chanfrein_, !tangent_, E);
      } catch (const Standard_Failure&) {
      }
      if (rN && facesValides(rN->forme, zone)) sh = rN->forme;
      else warns.push_back("le noyau rend un solide déchiré (faces invalides)");
    }
  }
  if (sh.IsNull()) {
    std::string msg;
    for (auto& w : warns) msg += (msg.empty() ? "" : " · ") + w;
    if (msg.empty()) msg = "aperçu impossible";
    const std::string dp = chanfrein_ ? "D" : "R";
    bool trouve = false;
    const Zone zone = zonePour(rPetit);
    for (double kk : {0.7, 0.5, 0.4, 0.3, 0.2}) {
      const double r2 = std::max(0.3, arrondi(rPetit * kk, 2));
      std::vector<Travail> j2 = jobs;
      for (auto& j : j2) j.r = r2;
      std::vector<std::string> w2;
      TopoDS_Shape t;
      try {
        t = lancer(base_, j2, w2, chanfrein_, o);
      } catch (const Standard_Failure&) {
        t.Nullify();
      }
      if (!t.IsNull() && facesValides(t, zone)) {
        msg += " — max vérifié : " + dp + xNum(r2) + " ; réduisez " + (chanfrein_ ? "la distance" : "le rayon");
        trouve = true;
        break;
      }
    }
    if (!trouve) msg += std::string(" — aucun ") + (chanfrein_ ? "réglage" : "rayon") + " testé ne passe (arête trop courte ou faces déjà " + (chanfrein_ ? "chanfreinées" : "congées") + " ?)";
    apercu_.message = msg;
    return apercu_;
  }
  apercu_.forme = sh;
  const std::vector<std::string> cles = clesFaces(sh);
  size_t i = 0;
  for (TopExp_Explorer ex(sh, TopAbs_FACE); ex.More(); ex.Next(), i++)
    if (i < cles.size() && (cles[i] == "?" || !clesBase_.count(cles[i]))) apercu_.nouvelles.push_back(TopoDS::Face(ex.Current()));
  return apercu_;
}

// applyExactFillet : la fonction créée ; elle va dans le corps des arêtes choisies (xCorpsDesAretes)
Fonction ChoixConge::creer(Document& d, const std::vector<std::pair<std::string, TopoDS_Shape>>& corps) const {
  Fonction f;
  f.id = idFonction(d, "xf");
  f.type = "xfillet";
  f.nom = libelle() + " (" + std::to_string(sel_.size()) + " arête(s))";
  f.chamfer = chanfrein_;
  f.tangent = tangent_ ? 1 : 0;
  f.congeTotal = static_cast<int>(sel_.size());
  for (const SelConge& s : sel_) {
    AreteConge a;
    a.pos = s.pos;
    a.pos0 = s.pos;
    a.aPos0 = true;
    for (size_t i = 0; i < vives_.size(); i++)
      if (ecart(vives_[i].mid, s.pos) < 0.75) {
        a.seed = std::find(germes_.begin(), germes_.end(), static_cast<int>(i)) != germes_.end();
        break;
      }
    a.r = s.r;
    a.len = s.len;
    a.ancre = s.ancre;
    a.nomAffiche = "Arête " + std::to_string(++d.nomsArete);
    f.aretes.push_back(std::move(a));
  }
  f.corps = d.corpsActif;
  int bc = 0;
  bool bActif = false;
  for (auto& [id, forme] : corps) {
    const std::vector<AreteListee> E = listerAretes(forme);
    int c = 0;
    for (const SelConge& s : sel_)
      if (std::any_of(E.begin(), E.end(), [&](const AreteListee& e) { return ecart(e.mid, s.pos) < 0.75; })) c++;
    if (!c) continue;
    const bool actif = id == d.corpsActif;
    if (c > bc || (c == bc && actif && !bActif)) {
      f.corps = id;
      bc = c;
      bActif = actif;
    }
  }
  return f;
}
