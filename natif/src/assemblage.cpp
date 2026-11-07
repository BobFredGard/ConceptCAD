// Voir assemblage.h. Les noms des fonctions du navigateur sont donnés en regard de leur traduction.
#include "assemblage.h"

#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepGProp.hxx>
#include <BRep_Builder.hxx>
#include <GProp_GProps.hxx>
#include <Standard_Failure.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Compound.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <gp_Circ.hxx>
#include <gp_Cylinder.hxx>
#include <gp_Pln.hxx>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <set>

#include "conges.h"

namespace assemblage {
namespace {
const double PI = 3.14159265358979323846;
std::string texteDe(const J& j, const char* k) {
  const auto x = j.find(k);
  return x != j.end() && x->is_string() ? x->get<std::string>() : std::string();
}
V3 v3(const J& j) {
  V3 r{0, 0, 0};
  if (j.is_array())
    for (size_t i = 0; i < 3 && i < j.size(); i++)
      if (j[i].is_number()) r[i] = j[i].get<double>();
  return r;
}
J jv(const V3& v) { return J::array({v[0], v[1], v[2]}); }
V3 plus(const V3& a, const V3& b) { return {a[0] + b[0], a[1] + b[1], a[2] + b[2]}; }
V3 moins(const V3& a, const V3& b) { return {a[0] - b[0], a[1] - b[1], a[2] - b[2]}; }
V3 fois(const V3& a, double s) { return {a[0] * s, a[1] * s, a[2] * s}; }
double scal(const V3& a, const V3& b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
V3 vect(const V3& a, const V3& b) { return {a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]}; }
double lg(const V3& a) { return std::sqrt(scal(a, a)); }
bool unite(const V3& a, V3& r) {
  const double l = lg(a);
  if (l <= 1e-12) return false;
  r = fois(a, 1 / l);
  return true;
}
double arrondi6(double v) {
  const double b = std::round(v * 1e6) / 1e6;
  return b == 0 ? 0 : b;
}
J jv6(const V3& v) { return J::array({arrondi6(v[0]), arrondi6(v[1]), arrondi6(v[2])}); }
V3 pointDe(const gp_Pnt& p) { return {p.X(), p.Y(), p.Z()}; }
V3 dirDe(const gp_Dir& p) { return {p.X(), p.Y(), p.Z()}; }

// asmSnapFr
Repere repereZX(const V3& o, const V3& z, const V3* x) {
  V3 Z{0, 0, 1}, X{0, 0, 0};
  unite(z, Z);
  bool a = false;
  if (x) a = unite(moins(*x, fois(Z, scal(*x, Z))), X);
  if (!a) {
    const V3 t = std::abs(Z[0]) < 0.9 ? V3{1, 0, 0} : V3{0, 1, 0};
    unite(moins(t, fois(Z, scal(t, Z))), X);
  }
  Repere r;
  r.o = o;
  r.x = X;
  r.y = vect(Z, X);
  r.z = Z;
  return r;
}
std::string cleSeen(const Repere& fr) {
  char b[160];
  snprintf(b, sizeof b, "%.4f,%.4f,%.4f|%.3f,%.3f,%.3f", fr.o[0], fr.o[1], fr.o[2], fr.z[0], fr.z[1], fr.z[2]);
  return b;
}
AreteAccroche infoArete(const TopoDS_Edge& e, std::vector<V3>& pts) {
  AreteAccroche out;
  out.k = "other";
  try {
    BRepAdaptor_Curve ad(e);
    const double u0 = ad.FirstParameter(), u1 = ad.LastParameter();
    std::vector<V3> p;
    for (int i = 0; i <= 12; i++) p.push_back(pointDe(ad.Value(u0 + (u1 - u0) * i / 12)));
    pts.insert(pts.end(), p.begin(), p.end());
    if (ad.GetType() == GeomAbs_Line) {
      out.k = "line";
      out.p0 = p[0];
      out.p1 = p[12];
      out.m = pointDe(ad.Value((u0 + u1) / 2));
      unite(moins(out.p1, out.p0), out.d);
    } else if (ad.GetType() == GeomAbs_Circle) {
      const gp_Circ C = ad.Circle();
      out.k = "circ";
      out.c = pointDe(C.Location());
      out.n = dirDe(C.Axis().Direction());
      out.x = dirDe(C.XAxis().Direction());
      out.r = C.Radius();
      out.complet = std::abs(std::abs(u1 - u0) - 2 * PI) < 1e-6;
    }
  } catch (const Standard_Failure&) {
  }
  return out;
}
bool normaleSortante(const TopoDS_Face& f, const BRepAdaptor_Surface& ad, V3& n) {
  // occFaceOutNormal
  if (ad.GetType() != GeomAbs_Plane) return false;
  n = dirDe(ad.Plane().Axis().Direction());
  if (f.Orientation() == TopAbs_REVERSED) n = fois(n, -1);
  return true;
}
}  // namespace

Repere repereDe(const J& j) {
  Repere r;
  if (!j.is_object()) return r;
  if (j.contains("o")) r.o = v3(j["o"]);
  if (j.contains("x")) r.x = v3(j["x"]);
  if (j.contains("y")) r.y = v3(j["y"]);
  if (j.contains("z")) r.z = v3(j["z"]);
  return r;
}
J jsonDe(const Repere& r) {
  J j = J::object();
  j["o"] = jv(r.o);
  j["x"] = jv(r.x);
  j["y"] = jv(r.y);
  j["z"] = jv(r.z);
  return j;
}
V3 appliquer(const Repere& F, const V3& p) {
  return {F.o[0] + F.x[0] * p[0] + F.y[0] * p[1] + F.z[0] * p[2], F.o[1] + F.x[1] * p[0] + F.y[1] * p[1] + F.z[1] * p[2], F.o[2] + F.x[2] * p[0] + F.y[2] * p[1] + F.z[2] * p[2]};
}
V3 tourner(const Repere& F, const V3& v) {
  return {F.x[0] * v[0] + F.y[0] * v[1] + F.z[0] * v[2], F.x[1] * v[0] + F.y[1] * v[1] + F.z[1] * v[2], F.x[2] * v[0] + F.y[2] * v[1] + F.z[2] * v[2]};
}
Repere composer(const Repere& A, const Repere& B) {
  Repere r;
  r.o = appliquer(A, B.o);
  r.x = tourner(A, B.x);
  r.y = tourner(A, B.y);
  r.z = tourner(A, B.z);
  return r;
}
Repere inverser(const Repere& F) {
  Repere r;
  r.x = {F.x[0], F.y[0], F.z[0]};
  r.y = {F.x[1], F.y[1], F.z[1]};
  r.z = {F.x[2], F.y[2], F.z[2]};
  r.o = {-(r.x[0] * F.o[0] + r.y[0] * F.o[1] + r.z[0] * F.o[2]), -(r.x[1] * F.o[0] + r.y[1] * F.o[1] + r.z[1] * F.o[2]), -(r.x[2] * F.o[0] + r.y[2] * F.o[1] + r.z[2] * F.o[2])};
  return r;
}
Repere arrondir(const Repere& F) {
  const auto a = [](const V3& v) {
    V3 r;
    for (int i = 0; i < 3; i++) {
      const double b = std::round(v[i] * 1e9) / 1e9;
      r[i] = b == 0 ? 0 : b;
    }
    return r;
  };
  Repere r;
  r.o = a(F.o);
  r.x = a(F.x);
  r.y = a(F.y);
  r.z = a(F.z);
  return r;
}

// ---- Points d'accroche ----
std::vector<FaceAccroche> extraireAccroches(const std::vector<TopoDS_Shape>& formes) {
  std::vector<FaceAccroche> faces;
  for (const TopoDS_Shape& sh : formes) {
    if (sh.IsNull()) continue;
    for (TopExp_Explorer ex(sh, TopAbs_FACE); ex.More(); ex.Next()) {
      const TopoDS_Face f = TopoDS::Face(ex.Current());
      try {
        BRepAdaptor_Surface ad(f, true);
        FaceAccroche F;
        if (ad.GetType() == GeomAbs_Plane) {
          F.k = "plane";
          if (!normaleSortante(f, ad, F.n)) continue;
        } else if (ad.GetType() == GeomAbs_Cylinder) {
          const gp_Cylinder cy = ad.Cylinder();
          F.k = "cyl";
          F.l = pointDe(cy.Axis().Location());
          F.n = dirDe(cy.Axis().Direction());
          F.x = dirDe(cy.Position().XDirection());
          F.r = cy.Radius();
          // sens de l'axe fixé : sa plus grande composante positive
          int big = 0;
          for (int i = 1; i < 3; i++)
            if (std::abs(F.n[i]) > std::abs(F.n[big])) big = i;
          if (F.n[big] < 0) {
            F.n = fois(F.n, -1);
            F.x = fois(F.x, -1);
          }
        } else continue;
        std::vector<V3> pts;
        for (TopExp_Explorer ee(f, TopAbs_EDGE); ee.More(); ee.Next()) F.aretes.push_back(infoArete(TopoDS::Edge(ee.Current()), pts));
        GProp_GProps G;
        BRepGProp::SurfaceProperties(f, G, false, false);
        F.c = pointDe(G.CentreOfMass());
        F.aire = G.Mass();
        if (F.k == "plane") {
          const V3 dir = std::abs(F.n[2]) > 0.999 ? V3{1, 0, 0} : vect(V3{0, 0, 1}, F.n);
          const Repere fr = repereZX(F.c, F.n, &dir);
          F.x = fr.x;
          F.y = fr.y;
          double u0 = 1e18, u1 = -1e18, v0 = 1e18, v1 = -1e18;
          for (const V3& p : pts) {
            const V3 q = moins(p, F.c);
            const double u = scal(q, fr.x), v = scal(q, fr.y);
            u0 = std::min(u0, u);
            u1 = std::max(u1, u);
            v0 = std::min(v0, v);
            v1 = std::max(v1, v);
          }
          F.rect[0] = u0;
          F.rect[1] = u1;
          F.rect[2] = v0;
          F.rect[3] = v1;
        } else {
          double t0 = 1e18, t1 = -1e18;
          for (const V3& p : pts) {
            const double t = scal(moins(p, F.l), F.n);
            t0 = std::min(t0, t);
            t1 = std::max(t1, t);
          }
          F.t[0] = t0;
          F.t[1] = t1;
          F.c = plus(F.l, fois(F.n, (t0 + t1) / 2));
        }
        faces.push_back(std::move(F));
      } catch (const Standard_Failure&) {
      }
    }
  }
  return faces;
}

std::vector<PointAccroche> pointsDe(const FaceAccroche& F) {
  std::vector<PointAccroche> out;
  std::set<std::string> vus;
  const auto pousser = [&](const std::string& w, const std::string& nom, const Repere& fr, const AreteAccroche* e, const char* ek, const V3& em, bool aEr, double er) {
    if (!vus.insert(cleSeen(fr)).second) return;
    PointAccroche p;
    p.w = w;
    p.nom = nom;
    p.fr = fr;
    if (e) {
      p.aArete = true;
      p.ek = ek;
      p.em = em;
      p.aEr = aEr;
      p.er = er;
    }
    out.push_back(std::move(p));
  };
  if (F.k == "plane") {
    const double u0 = F.rect[0], u1 = F.rect[1], v0 = F.rect[2], v1 = F.rect[3];
    const double uc = (u0 + u1) / 2, vc = (v0 + v1) / 2, hu = (u1 - u0) / 2, hv = (v1 - v0) / 2;
    const auto at = [&](double su, double sv) { return plus(F.c, plus(fois(F.x, uc + su * hu), fois(F.y, vc + sv * hv))); };
    const struct { const char* w; const char* nom; double su, sv; } L[] = {{"n", "nord", 0, 1}, {"s", "sud", 0, -1}, {"e", "est", 1, 0}, {"o", "ouest", -1, 0}, {"ne", "nord-est", 1, 1}, {"no", "nord-ouest", -1, 1}, {"se", "sud-est", 1, -1}, {"so", "sud-ouest", -1, -1}};
    pousser("c", "centre", repereZX(F.c, F.n, &F.x), nullptr, "", V3{}, false, 0);
    for (const auto& q : L) pousser(q.w, q.nom, repereZX(at(q.su, q.sv), F.n, &F.x), nullptr, "", V3{}, false, 0);
  } else {
    const double t0 = F.t[0], t1 = F.t[1];
    pousser("a0", "début de l’axe", repereZX(plus(F.l, fois(F.n, t0)), F.n, &F.x), nullptr, "", V3{}, false, 0);
    pousser("am", "milieu de l’axe", repereZX(plus(F.l, fois(F.n, (t0 + t1) / 2)), F.n, &F.x), nullptr, "", V3{}, false, 0);
    pousser("a1", "fin de l’axe", repereZX(plus(F.l, fois(F.n, t1)), F.n, &F.x), nullptr, "", V3{}, false, 0);
  }
  // un cercle d'esquisse devient souvent DEUX demi-arcs : même centre, même rayon → « cercle »
  const auto ck = [](const AreteAccroche& e) {
    char b[120];
    snprintf(b, sizeof b, "%.4f,%.4f,%.4f|%.4f", e.c[0], e.c[1], e.c[2], e.r);
    return std::string(b);
  };
  std::map<std::string, int> nArc;
  for (const AreteAccroche& e : F.aretes)
    if (e.k == "circ") nArc[ck(e)]++;
  for (const AreteAccroche& e : F.aretes) {
    if (e.k == "line" && F.k == "plane") {
      pousser("em", "milieu d’arête", repereZX(e.m, F.n, &e.d), &e, "line", e.m, false, 0);
      pousser("ep", "extrémité d’arête", repereZX(e.p0, F.n, &e.d), &e, "line", e.m, false, 0);
      pousser("ep", "extrémité d’arête", repereZX(e.p1, F.n, &e.d), &e, "line", e.m, false, 0);
    } else if (e.k == "circ") {
      const V3 z = scal(e.n, F.n) < 0 ? fois(e.n, -1) : e.n;
      char d[40];
      snprintf(d, sizeof d, "%.3f", 2 * e.r);
      std::string ds = d;
      while (!ds.empty() && ds.back() == '0') ds.pop_back();
      if (!ds.empty() && ds.back() == '.') ds.pop_back();
      pousser("ec", std::string(e.complet || nArc[ck(e)] > 1 ? "centre du cercle" : "centre de l’arc") + " Ø" + ds, repereZX(e.c, z, &e.x), &e, "circ", e.c, true, e.r);
    }
  }
  return out;
}

std::string nomFace(const FaceAccroche& F) {
  if (F.k == "plane") return "Face plane";
  char d[40];
  snprintf(d, sizeof d, "%.3f", 2 * F.r);
  std::string ds = d;
  while (!ds.empty() && ds.back() == '0') ds.pop_back();
  if (!ds.empty() && ds.back() == '.') ds.pop_back();
  return "Cylindre Ø" + ds;
}

J referenceAccroche(const FaceAccroche& F, const PointAccroche& p) {
  J sn = J::object();
  J f = J::object();
  f["k"] = F.k;
  f["c"] = jv6(F.c);
  f["n"] = jv6(F.n);
  if (F.k == "cyl") f["r"] = arrondi6(F.r);
  sn["f"] = std::move(f);
  sn["w"] = p.w;
  sn["fr"] = jsonDe(arrondir(p.fr));
  sn["name"] = nomFace(F) + " · " + p.nom;
  if (p.aArete) {
    J e = J::object();
    e["k"] = p.ek;
    e["m"] = jv6(p.em);
    if (p.aEr) e["r"] = arrondi6(p.er);
    sn["e"] = std::move(e);
  }
  return sn;
}

const FaceAccroche* faceSous(const std::vector<FaceAccroche>& G, const V3& p, const V3* n) {
  const FaceAccroche* best = nullptr;
  double bs = 0;
  for (const FaceAccroche& F : G) {
    double s;
    if (F.k == "plane") {
      if (n && scal(*n, F.n) < 0.8) continue;
      const V3 q = moins(p, F.c);
      const double d = std::abs(scal(q, F.n));
      if (d > 0.6) continue;
      const double u = scal(q, F.x), v = scal(q, F.y);
      if (u < F.rect[0] - 0.6 || u > F.rect[1] + 0.6 || v < F.rect[2] - 0.6 || v > F.rect[3] + 0.6) continue;
      s = d;
    } else {
      const V3 q = moins(p, F.l);
      const double t = scal(q, F.n), rad = lg(moins(q, fois(F.n, t)));
      if (t < F.t[0] - 0.6 || t > F.t[1] + 0.6) continue;
      s = std::abs(rad - F.r);
      if (s > 0.6) continue;
    }
    if (!best || s < bs) {
      best = &F;
      bs = s;
    }
  }
  return best;
}

// asmSnapFind
static bool trouverAccroche(const std::vector<FaceAccroche>& G, const J& sn, const FaceAccroche*& fF, PointAccroche& pt) {
  if (!sn.contains("f") || !sn["f"].is_object()) return false;
  const J& sf = sn["f"];
  const std::string k = texteDe(sf, "k"), w = texteDe(sn, "w");
  const V3 sc = v3(sf.value("c", J::array())), sN = v3(sf.value("n", J::array()));
  const double sr = sf.contains("r") && sf["r"].is_number() ? sf["r"].get<double>() : 0;
  const FaceAccroche* best = nullptr;
  double bs = 0;
  int bsr = 0;
  for (const FaceAccroche& F : G) {
    if (F.k != k) continue;
    const double d = scal(F.n, sN);
    if (F.k == "plane" ? d < 0.999 : std::abs(d) < 0.999) continue;
    double s = lg(moins(F.c, sc));
    const int r = F.k == "cyl" && std::abs(F.r - sr) < 1e-4 ? 0 : 1;
    if (F.k == "cyl") s += 10 * std::abs(F.r - sr);
    if (!best || r < bsr || (r == bsr && s < bs)) {
      best = &F;
      bs = s;
      bsr = r;
    }
  }
  if (!best) return false;
  const std::vector<PointAccroche> items = pointsDe(*best);
  const PointAccroche* it = nullptr;
  if (sn.contains("e") && sn["e"].is_object()) {
    const J& se = sn["e"];
    const std::string ek = texteDe(se, "k");
    const V3 em = v3(se.value("m", J::array()));
    const bool aR = se.contains("r") && se["r"].is_number();
    const double er = aR ? se["r"].get<double>() : 0;
    double bd = 1e300;
    for (const PointAccroche& q : items) {
      if (!q.aArete || q.ek != ek || q.w != w) continue;
      const V3 ref = w == "ep" && sn.contains("fr") ? repereDe(sn["fr"]).o : em;
      const double dist = lg(moins(w == "ep" ? q.fr.o : q.em, ref)) + (q.aEr && aR ? 10 * std::abs(q.er - er) : 0);
      if (dist < bd) {
        bd = dist;
        it = &q;
      }
    }
  } else {
    for (const PointAccroche& q : items)
      if (q.w == w && !q.aArete) {
        it = &q;
        break;
      }
  }
  if (!it) return false;
  fF = best;
  pt = *it;
  return true;
}

void poserTeintes(const Document& d, SolideComposant& s) {
  static const unsigned PALETTE[] = {0x0a84ff, 0x30d158, 0xff9f0a, 0xbf5af2, 0xff453a, 0x64d2ff, 0xffd60a, 0x5e5ce6};
  s.teintes.clear();
  s.transparences.clear();
  for (const auto& [id, f] : s.corps) {
    if (std::find(d.corpsMasques.begin(), d.corpsMasques.end(), id) != d.corpsMasques.end()) continue;
    const size_t i = std::find(d.corps.begin(), d.corps.end(), id) - d.corps.begin();
    if (i < d.opacitesCorps.size() && d.opacitesCorps[i] < 1) s.transparences.push_back({f, 1 - d.opacitesCorps[i]});
    unsigned c = i < d.couleursCorps.size() ? d.couleursCorps[i] : 0;
    if (!c) c = d.teinte;
    if (!c) c = PALETTE[(i < d.corps.size() ? i : 0) % 8];
    s.teintes.push_back({f, c});
  }
}

const std::vector<FaceAccroche>& accrochesDe(SolideComposant& s) {
  if (!s.accrochesFaites) {
    std::vector<TopoDS_Shape> L;
    for (const auto& c : s.corps) L.push_back(c.second);
    s.accroches = extraireAccroches(L);
    s.accrochesFaites = true;
  }
  return s.accroches;
}

// ---- Lecture de l'arbre ----
J* composant(J& a, const std::string& id) {
  if (!a.contains("comps") || !a["comps"].is_array()) return nullptr;
  for (J& c : a["comps"])
    if (texteDe(c, "id") == id) return &c;
  return nullptr;
}
const J* composant(const J& a, const std::string& id) { return composant(const_cast<J&>(a), id); }
J* occurrence(J& a, const std::string& id) {
  if (!a.contains("comps") || !a["comps"].is_array()) return nullptr;
  for (J& c : a["comps"])
    if (c.contains("occ") && c["occ"].is_array())
      for (J& o : c["occ"])
        if (texteDe(o, "id") == id) return &o;
  return nullptr;
}
const J* occurrence(const J& a, const std::string& id) { return occurrence(const_cast<J&>(a), id); }
J* porteur(J& a, const std::string& idOcc) {
  if (!a.contains("comps") || !a["comps"].is_array()) return nullptr;
  for (J& c : a["comps"])
    if (c.contains("occ") && c["occ"].is_array())
      for (J& o : c["occ"])
        if (texteDe(o, "id") == idOcc) return &c;
  return nullptr;
}
std::string racine(const J& a) { return texteDe(a, "root"); }
std::string actif(const J& a) {
  const std::string x = texteDe(a, "active");
  return composant(a, x) ? x : racine(a);
}
Chemin cheminActif(const J& a) {
  Chemin p;
  if (a.contains("path") && a["path"].is_array())
    for (const J& x : a["path"])
      if (x.is_string()) p.push_back(x.get<std::string>());
  if (compDuChemin(a, p) != actif(a)) return premierChemin(a, actif(a));
  return p;
}
bool aDesEnfants(const J& a) {
  if (!a.contains("comps") || !a["comps"].is_array()) return false;
  for (const J& c : a["comps"])
    if (c.contains("occ") && c["occ"].is_array() && !c["occ"].empty()) return true;
  return false;
}
static const J* occDans(const J& c, const std::string& id) {
  if (!c.contains("occ") || !c["occ"].is_array()) return nullptr;
  for (const J& o : c["occ"])
    if (texteDe(o, "id") == id) return &o;
  return nullptr;
}
bool repereChemin(const J& a, const std::string& cid, const Chemin& chemin, Repere& F, std::string& fin) {
  Repere R;
  const J* c = composant(a, cid);
  for (const std::string& id : chemin) {
    if (!c) return false;
    const J* o = occDans(*c, id);
    if (!o) return false;
    R = composer(R, repereDe(o->value("fr", J::object())));
    c = composant(a, texteDe(*o, "comp"));
  }
  if (!c) return false;
  F = R;
  fin = texteDe(*c, "id");
  return true;
}
bool monde(const J& a, const Chemin& chemin, Repere& F) {
  std::string fin;
  return repereChemin(a, racine(a), chemin, F, fin);
}
std::string compDuChemin(const J& a, const Chemin& chemin) {
  Repere F;
  std::string fin;
  return repereChemin(a, racine(a), chemin, F, fin) ? fin : std::string();
}
bool cheminMasque(const J& a, const Chemin& chemin) {
  const J* c = composant(a, racine(a));
  for (const std::string& id : chemin) {
    const J* o = c ? occDans(*c, id) : nullptr;
    if (!o) return true;
    if (o->contains("visible") && (*o)["visible"].is_boolean() && !(*o)["visible"].get<bool>()) return true;
    c = composant(a, texteDe(*o, "comp"));
  }
  return false;
}
Chemin premierChemin(const J& a, const std::string& cid) {
  if (cid == racine(a)) return {};
  std::vector<std::pair<std::string, Chemin>> q{{racine(a), {}}};
  std::set<std::string> vus{racine(a)};
  for (size_t i = 0; i < q.size(); i++) {
    const std::string id = q[i].first;
    const Chemin p = q[i].second;
    const J* c = composant(a, id);
    if (!c || !c->contains("occ")) continue;
    for (const J& o : (*c)["occ"]) {
      Chemin np = p;
      np.push_back(texteDe(o, "id"));
      const std::string oc = texteDe(o, "comp");
      if (oc == cid) return np;
      if (vus.insert(oc).second) q.push_back({oc, np});
    }
  }
  return {};
}
std::vector<Instance> instances(const J& a, const std::string& depuis) {
  std::vector<Instance> out;
  std::set<std::string> pile;
  const std::function<void(const std::string&, const Chemin&, const Repere&, int)> go = [&](const std::string& id, const Chemin& p, const Repere& F, int d) {
    Instance i;
    i.chemin = p;
    i.comp = id;
    i.F = F;
    i.profondeur = d;
    out.push_back(std::move(i));
    const J* c = composant(a, id);
    if (!c || pile.count(id)) return;
    pile.insert(id);
    if (c->contains("occ") && (*c)["occ"].is_array())
      for (const J& o : (*c)["occ"]) {
        Chemin np = p;
        np.push_back(texteDe(o, "id"));
        go(texteDe(o, "comp"), np, composer(F, repereDe(o.value("fr", J::object()))), d + 1);
      }
    pile.erase(id);
  };
  go(depuis, {}, Repere(), 0);
  return out;
}
bool contient(const J& a, const std::string& gros, const std::string& petit) {
  if (gros == petit) return true;
  std::set<std::string> vus;
  const std::function<bool(const std::string&)> go = [&](const std::string& id) -> bool {
    if (id == petit) return true;
    if (!vus.insert(id).second) return false;
    const J* c = composant(a, id);
    if (!c || !c->contains("occ")) return false;
    for (const J& o : (*c)["occ"])
      if (go(texteDe(o, "comp"))) return true;
    return false;
  };
  return go(gros);
}
void apparenceDe(const J& a, const Chemin& chemin, double& op, double& gl, std::string& aretes) {
  op = gl = -1;
  aretes.clear();
  const J* c = composant(a, racine(a));
  for (const std::string& id : chemin) {
    const J* o = c ? occDans(*c, id) : nullptr;
    if (!o) break;
    if (o->contains("look") && (*o)["look"].is_object()) {
      const J& L = (*o)["look"];
      if (L.contains("op") && L["op"].is_number()) op = L["op"].get<double>();
      if (L.contains("gl") && L["gl"].is_number()) gl = L["gl"].get<double>();
      if (L.contains("edges") && L["edges"].is_string()) aretes = L["edges"].get<std::string>();
    }
    c = composant(a, texteDe(*o, "comp"));
  }
}
std::vector<std::string> dofs(const J& align) {
  const std::string t = align.is_object() ? texteDe(align, "type") : std::string();
  if (t == "revolute") return {"rz"};
  if (t == "slider") return {"tz"};
  if (t == "cylindrical") return {"rz", "tz"};
  if (t == "planar") return {"tx", "ty", "rz"};
  if (t == "ball") return {"rx", "ry", "rz"};
  return {};
}
const char* nomLiaison(const std::string& t) {
  if (t == "revolute") return "Pivot";
  if (t == "slider") return "Glissière";
  if (t == "cylindrical") return "Pivot glissant";
  if (t == "planar") return "Plan";
  if (t == "ball") return "Rotule";
  return "Rigide";
}

// ---- Le calcul ----
void majSolides(Solides& S, Document& haut, const ResultatRejeu& rActif) {
  if (!haut.assemblage) {
    S.clear();
    return;
  }
  const J& a = *haut.assemblage;
  const std::string act = actif(a);
  std::set<std::string> vus;
  if (a.contains("comps") && a["comps"].is_array())
    for (const J& c : a["comps"]) {
      const std::string id = texteDe(c, "id");
      vus.insert(id);
      if (id == act) {
        auto s = std::make_shared<SolideComposant>();
        s->empreinte = "actif";
        s->nom = haut.nom;
        s->forme = rActif.forme;
        s->corps = rActif.corps;
        s->spirales = rActif.spirales;
        s->messages = rActif.messages;
        s->construction = haut.construction;
        poserTeintes(haut, *s);
        S[id] = s;
        continue;
      }
      if (!c.contains("doc") || !c["doc"].is_object()) continue;
      const std::string texte = c["doc"].dump(-1, ' ', false, J::error_handler_t::replace);
      const std::string emp = std::to_string(std::hash<std::string>()(texte)) + ":" + std::to_string(texte.size());
      const auto it = S.find(id);
      if (it != S.end() && it->second->empreinte == emp) continue;
      auto s = std::make_shared<SolideComposant>();
      s->empreinte = emp;
      try {
        Document d = documentDeComposant(c["doc"], haut);
        s->nom = d.nom;
        if (d.nonPrisEnCharge.empty()) {
          ResultatRejeu r = rejouer(d);
          if (!r.forme.IsNull()) mailler(r.forme, parallele());
          s->forme = r.forme;
          s->corps = r.corps;
          s->spirales = r.spirales;
          s->messages = r.messages;
          s->construction = d.construction;
          poserTeintes(d, *s);
        } else {
          for (const std::string& m : d.nonPrisEnCharge) s->messages.push_back("pas encore repris : " + m);
        }
      } catch (const Standard_Failure& e) {
        s->messages.push_back(e.what());
      } catch (const std::exception& e) {
        s->messages.push_back(e.what());
      }
      S[id] = s;
    }
  for (auto it = S.begin(); it != S.end();)
    it = vus.count(it->first) ? std::next(it) : S.erase(it);
}

namespace {
struct Calcul {
  J& a;
  Solides& S;
  bool repereComposant(const std::string& cid, const std::string& cg, Repere& F) {
    // asmCompFrame
    if (cg.empty()) {
      F = Repere();
      return true;
    }
    const auto it = S.find(cid);
    if (it != S.end())
      for (const ElementConstruction& e : it->second->construction)
        if (e.id == cg && e.kind == "frame" && e.j.contains("fr") && e.j["fr"].is_object()) {
          F = repereDe(J::parse(e.j["fr"].dump()));
          return true;
        }
    const J* c = composant(a, cid);
    if (c && c->contains("doc") && (*c)["doc"].is_object() && (*c)["doc"].contains("cgeo"))
      for (const J& k : (*c)["doc"]["cgeo"])
        if (texteDe(k, "id") == cg && texteDe(k, "kind") == "frame" && k.contains("fr")) {
          F = repereDe(k["fr"]);
          return true;
        }
    return false;
  }
  // asmSnapFrame
  bool repereAccroche(const std::string& cid, J& sn, Repere& F) {
    const auto it = S.find(cid);
    if (it != S.end()) {
      const std::vector<FaceAccroche>& G = accrochesDe(*it->second);
      const FaceAccroche* Fa = nullptr;
      PointAccroche p;
      if (!trouverAccroche(G, sn, Fa, p)) {
        sn["miss"] = true;
        return false;
      }
      sn.erase("miss");
      const J nw = referenceAccroche(*Fa, p);
      sn["f"] = nw["f"];
      if (nw.contains("e")) sn["e"] = nw["e"];
      sn["fr"] = nw["fr"];
      sn["name"] = nw["name"];
    } else if (sn.contains("miss")) return false;
    if (!sn.contains("fr") || !sn["fr"].is_object()) return false;
    F = repereDe(sn["fr"]);
    return true;
  }
  // asmRelFrame
  bool repereRel(const std::string& cid, J& rel, Repere& out) {
    Chemin p;
    if (rel.is_object() && rel.contains("path") && rel["path"].is_array())
      for (const J& x : rel["path"])
        if (x.is_string()) p.push_back(x.get<std::string>());
    Repere R;
    std::string fin;
    if (!repereChemin(a, cid, p, R, fin)) return false;
    Repere G;
    bool ok;
    if (rel.is_object() && rel.contains("sn") && rel["sn"].is_object()) ok = repereAccroche(fin, rel["sn"], G);
    else ok = repereComposant(fin, rel.is_object() ? texteDe(rel, "cg") : std::string(), G);
    if (!ok) return false;
    out = composer(R, G);
    return true;
  }
  bool repereCible(const std::string& owner, J& al, Repere& out) {
    Repere T;
    if (!al.contains("dst") || !repereRel(owner, al["dst"], T)) return false;
    if (al.contains("rel") && al["rel"].is_object()) {
      out = composer(T, repereDe(al["rel"]));
      return true;
    }
    Repere L;
    if (al.value("flip", false)) {
      L.y = {0, -1, 0};
      L.z = {0, 0, -1};
    }
    const double r = (al.contains("rz") && al["rz"].is_number() ? al["rz"].get<double>() : 0) * PI / 180;
    if (r != 0) {
      const double c = std::cos(r), s = std::sin(r);
      Repere Rz;
      Rz.x = {c, s, 0};
      Rz.y = {-s, c, 0};
      L = composer(Rz, L);
    }
    L.o = al.contains("off") ? v3(al["off"]) : V3{0, 0, 0};
    out = composer(T, L);
    return true;
  }
  static Repere repereLiaison(const J& al) {
    // asmJointFrame
    std::map<std::string, double> q;
    for (const std::string& k : dofs(al)) {
      double v = al.contains("q") && al["q"].is_object() && al["q"].contains(k) && al["q"][k].is_number() ? al["q"][k].get<double>() : 0;
      if (al.contains("lim") && al["lim"].is_object() && al["lim"].contains(k) && al["lim"][k].is_array() && al["lim"][k].size() == 2) {
        const double l0 = al["lim"][k][0].get<double>(), l1 = al["lim"][k][1].get<double>();
        v = std::min(std::max(v, std::min(l0, l1)), std::max(l0, l1));
      }
      q[k] = v;
    }
    const auto ang = [&](const char* k) {
      const auto it = q.find(k);
      return it == q.end() ? 0.0 : it->second * PI / 180;
    };
    const auto val = [&](const char* k) {
      const auto it = q.find(k);
      return it == q.end() ? 0.0 : it->second;
    };
    Repere Rx, Ry, Rz;
    const double tx = ang("rx"), ty = ang("ry"), tz = ang("rz");
    Rx.y = {0, std::cos(tx), std::sin(tx)};
    Rx.z = {0, -std::sin(tx), std::cos(tx)};
    Ry.x = {std::cos(ty), 0, -std::sin(ty)};
    Ry.z = {std::sin(ty), 0, std::cos(ty)};
    Rz.x = {std::cos(tz), std::sin(tz), 0};
    Rz.y = {-std::sin(tz), std::cos(tz), 0};
    Repere R = composer(Rz, composer(Ry, Rx));
    R.o = {val("tx"), val("ty"), val("tz")};
    return R;
  }
  bool resoudreDans(J& owner) {
    // asmResolveIn
    bool ch = false;
    if (!owner.contains("occ") || !owner["occ"].is_array()) return false;
    std::vector<J*> todo;
    std::set<std::string> faits, freres;
    for (J& o : owner["occ"]) {
      freres.insert(texteDe(o, "id"));
      if (o.contains("align") && o["align"].is_object()) todo.push_back(&o);
      else {
        o["st"] = "ok";
        o["msg"] = "";
        faits.insert(texteDe(o, "id"));
      }
    }
    bool progres = true;
    const std::string idOwner = texteDe(owner, "id");
    while (!todo.empty() && progres) {
      progres = false;
      for (size_t i = 0; i < todo.size(); i++) {
        J& o = *todo[i];
        J& al = o["align"];
        std::string dep;
        if (al.contains("dst") && al["dst"].is_object() && al["dst"].contains("path") && al["dst"]["path"].is_array() && !al["dst"]["path"].empty() && al["dst"]["path"][0].is_string()) dep = al["dst"]["path"][0].get<std::string>();
        const std::string id = texteDe(o, "id");
        if (!dep.empty() && dep != id && !faits.count(dep) && freres.count(dep)) continue;
        todo.erase(todo.begin() + i);
        i--;
        progres = true;
        faits.insert(id);
        if (dep == id) {
          o["st"] = "warn";
          o["msg"] = "la cible est dans l’occurrence elle-même";
          continue;
        }
        Repere T, Sr;
        const bool okT = repereCible(idOwner, al, T);
        bool okS = false;
        if (al.contains("sfr") && al["sfr"].is_object()) {
          Sr = repereDe(al["sfr"]);
          okS = true;
        } else if (al.contains("src")) okS = repereRel(texteDe(o, "comp"), al["src"], Sr);
        else okS = true;
        if (!okT || !okS) {
          const J& q = !okS ? al["src"] : al["dst"];
          o["st"] = "warn";
          if (q.is_object() && q.contains("sn") && q["sn"].is_object()) o["msg"] = "point d’accroche introuvable (« " + texteDe(q["sn"], "name") + " » : la face a disparu ?) — position mémorisée";
          else o["msg"] = !okS ? "repère du composant introuvable" : "repère cible introuvable";
          continue;
        }
        const Repere M = arrondir(composer(T, composer(repereLiaison(al), inverser(Sr))));
        const Repere A = repereDe(o.value("fr", J::object()));
        bool bouge = false;
        for (int k = 0; k < 3; k++)
          if (std::abs(M.o[k] - A.o[k]) > 1e-9 || std::abs(M.x[k] - A.x[k]) > 1e-9 || std::abs(M.y[k] - A.y[k]) > 1e-9 || std::abs(M.z[k] - A.z[k]) > 1e-9) bouge = true;
        if (bouge) {
          o["fr"] = jsonDe(M);
          ch = true;
        }
        o["st"] = "ok";
        o["msg"] = "";
      }
    }
    for (J* o : todo) {
      (*o)["st"] = "warn";
      (*o)["msg"] = "alignement circulaire : position mémorisée";
    }
    return ch;
  }
};
// asmAlignNorm : les formes anciennes de V0.6.0 (src = identifiant, dst = {occ, cg})
void normaliser(J& a) {
  if (!a.contains("comps") || !a["comps"].is_array()) return;
  std::set<std::string> ids;
  for (const J& c : a["comps"]) ids.insert(texteDe(c, "id"));
  const auto rel = [](J& r, bool dst) {
    if (r.is_object() && r.contains("path") && r["path"].is_array()) return;
    J n = J::object();
    n["path"] = J::array();
    n["cg"] = nullptr;
    if (dst && r.is_object()) {
      if (r.contains("occ") && r["occ"].is_string()) {
        n["path"].push_back(r["occ"]);
        if (r.contains("cg") && r["cg"].is_string()) n["cg"] = r["cg"];
      }
    } else if (r.is_string()) n["cg"] = r;
    r = std::move(n);
  };
  for (J& c : a["comps"]) {
    if (!c.contains("occ") || !c["occ"].is_array()) {
      c["occ"] = J::array();
      continue;
    }
    J garde = J::array();
    for (J& o : c["occ"]) {
      if (!ids.count(texteDe(o, "comp"))) continue;
      if (o.contains("align") && o["align"].is_object()) {
        J& al = o["align"];
        if (!al.contains("src")) al["src"] = nullptr;
        if (!al.contains("dst")) al["dst"] = nullptr;
        rel(al["src"], false);
        rel(al["dst"], true);
      }
      garde.push_back(std::move(o));
    }
    c["occ"] = std::move(garde);
  }
}
}  // namespace

bool resoudre(J& a, Solides& S) {
  normaliser(a);
  Calcul C{a, S};
  bool ch = false;
  std::set<std::string> vus;
  const std::function<void(J*)> visite = [&](J* c) {
    if (!c) return;
    const std::string id = texteDe(*c, "id");
    if (!vus.insert(id).second) return;
    if (c->contains("occ") && (*c)["occ"].is_array())
      for (const J& o : (*c)["occ"]) visite(composant(a, texteDe(o, "comp")));
    if (C.resoudreDans(*c)) ch = true;
  };
  visite(composant(a, racine(a)));
  if (a.contains("comps"))
    for (J& c : a["comps"]) visite(&c);
  return ch;
}

bool cibleLiaison(J& a, Solides& S, const std::string& porteur, J& align, Repere& T) {
  Calcul C{a, S};
  return C.repereCible(porteur, align, T);
}

void activer(J& haut, const std::string& cid, const Chemin& chemin) {
  if (!haut.contains("asm") || !haut["asm"].is_object()) return;
  J a = std::move(haut["asm"]);
  const std::string ancien = actif(a);
  a["path"] = J::array();
  for (const std::string& s : chemin) a["path"].push_back(s);
  if (ancien == cid || !composant(a, cid)) {
    haut["asm"] = std::move(a);
    return;
  }
  J doc = std::move(haut);
  doc.erase("asm");
  (*composant(a, ancien))["doc"] = std::move(doc);
  J* c = composant(a, cid);
  J nouveau = c->contains("doc") && (*c)["doc"].is_object() ? std::move((*c)["doc"]) : J::object();
  (*c)["doc"] = nullptr;
  a["active"] = cid;
  haut = std::move(nouveau);
  haut["asm"] = std::move(a);
}

// ---- Modifications ----
std::string nouvelIdentifiant(const char* prefixe) {
  static int suite = 0;
  long long t = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
  std::string b;
  while (t > 0) {
    b.insert(b.begin(), "0123456789abcdefghijklmnopqrstuvwxyz"[t % 36]);
    t /= 36;
  }
  return std::string(prefixe) + "_" + std::to_string(++suite) + "_" + b;
}
J& assurer(J& haut) {
  if (!haut.contains("asm") || !haut["asm"].is_object()) {
    const std::string id = nouvelIdentifiant("cp");
    std::string nom = texteDe(haut, "name");
    if (nom.empty()) nom = "Racine";
    J c = J::object();
    c["id"] = id;
    c["kind"] = "comp";
    c["name"] = nom;
    c["doc"] = nullptr;
    c["occ"] = J::array();
    c["link"] = nullptr;
    J a = J::object();
    a["v"] = 2;
    a["name"] = nom;
    a["root"] = id;
    a["active"] = id;
    a["path"] = J::array();
    a["mode"] = "part";
    a["comps"] = J::array({c});
    haut["asm"] = std::move(a);
  }
  return haut["asm"];
}
J nouvelleOccurrenceObjet(const std::string& cid, const std::string& nom, const Repere& fr) {
  J o = J::object();
  o["id"] = nouvelIdentifiant("oc");
  o["comp"] = cid;
  o["name"] = nom;
  o["fr"] = jsonDe(fr);
  o["fixed"] = false;
  o["visible"] = true;
  o["align"] = nullptr;
  return o;
}
std::string nomOccurrence(const J& a, const std::string& cid) {
  const J* c = composant(a, cid);
  std::string base = c ? texteDe(*c, "name") : std::string();
  if (base.empty()) base = "Composant";
  int n = 0;
  for (const J& k : a["comps"])
    if (k.contains("occ") && k["occ"].is_array())
      for (const J& o : k["occ"])
        if (texteDe(o, "comp") == cid) {
          const std::string nom = texteDe(o, "name");
          const size_t p = nom.rfind(':');
          if (p != std::string::npos && p + 1 < nom.size() && nom.find_first_not_of("0123456789", p + 1) == std::string::npos) n = std::max(n, std::atoi(nom.c_str() + p + 1));
        }
  return base + ":" + std::to_string(n + 1);
}
void supprimerOccurrence(J& a, const std::string& id) {
  J* ow = porteur(a, id);
  if (!ow) return;
  J garde = J::array();
  for (J& o : (*ow)["occ"])
    if (texteDe(o, "id") != id) garde.push_back(std::move(o));
  (*ow)["occ"] = std::move(garde);
  // les alignements qui passaient par elle tombent (les occurrences gardent leur position)
  const auto passe = [&](const J& r) {
    if (!r.is_object() || !r.contains("path") || !r["path"].is_array()) return false;
    for (const J& x : r["path"])
      if (x.is_string() && x.get<std::string>() == id) return true;
    return false;
  };
  for (J& c : a["comps"])
    if (c.contains("occ") && c["occ"].is_array())
      for (J& q : c["occ"])
        if (q.contains("align") && q["align"].is_object() && ((q["align"].contains("dst") && passe(q["align"]["dst"])) || (q["align"].contains("src") && passe(q["align"]["src"])))) q["align"] = nullptr;
  // asmPurge : les composants plus utilisés nulle part partent, en cascade
  for (bool encore = true; encore;) {
    encore = false;
    std::set<std::string> utilises{racine(a)};
    for (const J& c : a["comps"])
      if (c.contains("occ") && c["occ"].is_array())
        for (const J& o : c["occ"]) utilises.insert(texteDe(o, "comp"));
    J reste = J::array();
    for (J& c : a["comps"]) {
      if (utilises.count(texteDe(c, "id"))) reste.push_back(std::move(c));
      else encore = true;
    }
    a["comps"] = std::move(reste);
  }
}
J alignementTelQueConstruit(const J& occ, const std::string& type, const std::string& axe) {
  Repere R;
  if (axe == "x") {
    R.x = {0, 1, 0};
    R.y = {0, 0, 1};
    R.z = {1, 0, 0};
  } else if (axe == "y") {
    R.x = {0, 0, 1};
    R.y = {1, 0, 0};
    R.z = {0, 1, 0};
  }
  J al = J::object();
  const auto rel0 = [] {
    J r = J::object();
    r["path"] = J::array();
    r["cg"] = nullptr;
    return r;
  };
  al["src"] = rel0();
  al["dst"] = rel0();
  al["flip"] = false;
  al["rz"] = 0;
  al["off"] = J::array({0, 0, 0});
  al["type"] = type;
  al["q"] = J::object();
  al["q0"] = J::object();
  al["rel"] = jsonDe(arrondir(composer(repereDe(occ.value("fr", J::object())), R)));
  al["sfr"] = jsonDe(R);
  return al;
}
void renommerComposant(J& a, const std::string& idOcc, const std::string& nom) {
  const J* o = occurrence(a, idOcc);
  if (!o) return;
  const std::string cid = texteDe(*o, "comp");
  J* c = composant(a, cid);
  if (!c) return;
  const std::string ancien = texteDe(*c, "name");
  (*c)["name"] = nom;
  for (J& k : a["comps"])
    if (k.contains("occ") && k["occ"].is_array())
      for (J& q : k["occ"])
        if (texteDe(q, "comp") == cid) {
          const std::string n = texteDe(q, "name");
          if (!ancien.empty() && n.rfind(ancien, 0) == 0) q["name"] = nom + n.substr(ancien.size());
        }
  if (c->contains("doc") && (*c)["doc"].is_object()) (*c)["doc"]["name"] = nom;
}
}  // namespace assemblage
