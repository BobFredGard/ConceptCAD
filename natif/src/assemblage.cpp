#include <cstdint>
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
#include "nombres_js.h"

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
  return js::fixe(fr.o[0], 4) + "," + js::fixe(fr.o[1], 4) + "," + js::fixe(fr.o[2], 4) + "|" + js::fixe(fr.z[0], 3) + "," + js::fixe(fr.z[1], 3) + "," + js::fixe(fr.z[2], 3);
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
    return js::fixe(e.c[0], 4) + "," + js::fixe(e.c[1], 4) + "," + js::fixe(e.c[2], 4) + "|" + js::fixe(e.r, 4);
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
  // asmPatCells : les cases de la répétition, original exclu, dans le repère du porteur
  struct Case {
    std::string k;
    Repere M;
  };
  static V3 unitaire(const V3& v) {
    const double l = std::sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return l > 0 ? V3{v[0] / l, v[1] / l, v[2] / l} : V3{1, 0, 0};
  }
  static V3 axeDe(const Repere& F, const std::string& a) { return unitaire(a == "Y" ? F.y : a == "Z" ? F.z : F.x); }
  static Repere rotationPat(const V3& P, const V3& a, double ang) {
    const double c = std::cos(ang), s = std::sin(ang), x = a[0], y = a[1], z = a[2];
    const auto R = [&](const V3& v) {
      const double d = x * v[0] + y * v[1] + z * v[2];
      return V3{v[0] * c + (y * v[2] - z * v[1]) * s + x * d * (1 - c), v[1] * c + (z * v[0] - x * v[2]) * s + y * d * (1 - c), v[2] * c + (x * v[1] - y * v[0]) * s + z * d * (1 - c)};
    };
    const V3 rp = R(P);
    Repere M;
    M.o = {P[0] - rp[0], P[1] - rp[1], P[2] - rp[2]};
    M.x = R({1, 0, 0});
    M.y = R({0, 1, 0});
    M.z = R({0, 0, 1});
    return M;
  }
  static Repere miroirPat(const V3& P, const V3& n) {
    const auto R = [&](const V3& v) {
      const double d = 2 * (n[0] * v[0] + n[1] * v[1] + n[2] * v[2]);
      return V3{v[0] - d * n[0], v[1] - d * n[1], v[2] - d * n[2]};
    };
    const V3 rp = R(P);
    Repere M;
    M.o = {P[0] - rp[0], P[1] - rp[1], P[2] - rp[2]};
    M.x = R({1, 0, 0});
    M.y = R({0, 1, 0});
    M.z = R({0, 0, 1});
    return M;
  }
  static double nombreDe(const J& p, const char* k, double d) { return p.contains(k) && p[k].is_number() ? p[k].get<double>() : d; }
  bool casesDe(const J& owner, const J& p, std::vector<Case>& out, std::string& pourquoi) {
    const std::string type = texteDe(p, "type");
    if (type == "path") {
      pourquoi = "répétition suivant un profil : calcul pas encore repris ici, instances laissées en place";
      return false;
    }
    Repere F;
    const std::string cg = p.contains("ref") && p["ref"].is_object() ? texteDe(p["ref"], "cg") : std::string();
    if (!repereComposant(texteDe(owner, "id"), cg, F)) return false;
    if (type == "lin") {
      const V3 d1 = axeDe(F, texteDe(p, "axis"));
      const int n1 = std::max(1, static_cast<int>(nombreDe(p, "copies", 1)));
      const double s1 = nombreDe(p, "dist", 0);
      const bool deux = p.value("lin2", false);
      const V3 d2 = deux ? axeDe(F, texteDe(p, "axis2")) : V3{0, 0, 0};
      const int n2 = deux ? std::max(1, static_cast<int>(nombreDe(p, "copies2", 1))) : 0;
      const double s2 = deux ? nombreDe(p, "dist2", 0) : 0;
      for (int j = 0; j <= n2; j++)
        for (int i = 0; i <= n1; i++) {
          if (!i && !j) continue;
          Repere M;
          M.o = {d1[0] * s1 * i + d2[0] * s2 * j, d1[1] * s1 * i + d2[1] * s2 * j, d1[2] * s1 * i + d2[2] * s2 * j};
          out.push_back({std::to_string(i) + "," + std::to_string(j), M});
        }
    } else if (type == "circ") {
      const V3 a = axeDe(F, texteDe(p, "axis"));
      const int n = std::max(1, static_cast<int>(nombreDe(p, "copies", 1)));
      double an = nombreDe(p, "angle", 360);
      if (an == 0) an = 360;
      const double pas = std::abs(an) >= 360 - 1e-9 ? an / (n + 1) : an / n;
      for (int i = 1; i <= n; i++) out.push_back({"r" + std::to_string(i), rotationPat(F.o, a, pas * i * PI / 180)});
    } else if (type == "mir") {
      const Repere M1 = miroirPat(F.o, axeDe(F, texteDe(p, "axis")));
      out.push_back({"m1", M1});
      if (p.contains("plane2") && p["plane2"].is_string()) {
        const Repere M2 = miroirPat(F.o, axeDe(F, p["plane2"].get<std::string>()));
        out.push_back({"m2", M2});
        out.push_back({"m12", composer(M1, M2)});
      }
    }
    if (out.size() > 500) out.resize(500);
    return true;
  }
  // asmPatGen : instances créées, placées, retirées
  bool genererInstances(J& owner) {
    if (!owner.contains("occ") || !owner["occ"].is_array()) return false;
    bool ch = false;
    const auto occDe = [&](const std::string& id) -> J* {
      for (J& o : owner["occ"])
        if (texteDe(o, "id") == id) return &o;
      return nullptr;
    };
    const bool aPats = owner.contains("pats") && owner["pats"].is_array();
    if (aPats) {
      J garde = J::array();
      for (J& p : owner["pats"]) {
        J src = J::array();
        if (p.contains("src") && p["src"].is_array())
          for (const J& x : p["src"]) {
            if (!x.is_string()) continue;
            const J* o = occDe(x.get<std::string>());
            if (o && !(o->contains("pat") && (*o)["pat"].is_object())) src.push_back(x);
          }
        p["src"] = std::move(src);
        if (p["src"].empty()) ch = true;
        else garde.push_back(std::move(p));
      }
      if (garde.empty()) owner.erase("pats");
      else owner["pats"] = std::move(garde);
    }
    std::set<std::string> garder;
    std::vector<J> neuves;
    std::map<std::string, std::string> connues;  // répétition#clé → identifiant
    for (const J& o : owner["occ"])
      if (o.contains("pat") && o["pat"].is_object()) connues[texteDe(o["pat"], "id") + "#" + texteDe(o["pat"], "k")] = texteDe(o, "id");
    if (owner.contains("pats"))
      for (J& p : owner["pats"]) {
        p["st"] = "ok";
        p["msg"] = "";
        const std::string pid = texteDe(p, "id");
        std::vector<Case> cases;
        std::string pourquoi;
        if (!casesDe(owner, p, cases, pourquoi)) {
          p["st"] = "warn";
          p["msg"] = pourquoi.empty() ? "repère de référence introuvable : instances laissées en place" : pourquoi;
          for (const J& o : owner["occ"])
            if (o.contains("pat") && o["pat"].is_object() && texteDe(o["pat"], "id") == pid) garder.insert(texteDe(o, "id"));
          continue;
        }
        std::set<std::string> saute;
        if (p.contains("skip") && p["skip"].is_array())
          for (const J& x : p["skip"])
            if (x.is_string()) saute.insert(x.get<std::string>());
        for (const J& sidJ : p["src"]) {
          const std::string sid = sidJ.get<std::string>();
          const J* s = occDe(sid);
          if (!s) continue;
          const Repere Fs = repereDe(s->value("fr", J::object()));
          for (const Case& cell : cases) {
            const std::string k = sid + "|" + cell.k;
            if (saute.count(k)) continue;
            const auto it = connues.find(pid + "#" + k);
            J* o = it == connues.end() ? nullptr : occDe(it->second);
            J nv;
            if (!o) {
              nv = nouvelleOccurrenceObjet(texteDe(*s, "comp"), "", Repere());
              J pat = J::object();
              pat["id"] = pid;
              pat["k"] = k;
              nv["pat"] = std::move(pat);
              ch = true;
              o = &nv;
            }
            if (texteDe(*o, "comp") != texteDe(*s, "comp")) {
              (*o)["comp"] = (*s)["comp"];
              ch = true;
            }
            const Repere fr = arrondir(composer(cell.M, Fs));
            const Repere A = repereDe(o->value("fr", J::object()));
            for (int q = 0; q < 3; q++)
              if (std::abs(fr.o[q] - A.o[q]) > 1e-9 || std::abs(fr.x[q] - A.x[q]) > 1e-9 || std::abs(fr.y[q] - A.y[q]) > 1e-9 || std::abs(fr.z[q] - A.z[q]) > 1e-9) {
                (*o)["fr"] = jsonDe(fr);
                ch = true;
                break;
              }
            if (o->contains("align") && (*o)["align"].is_object()) {
              (*o)["align"] = nullptr;
              ch = true;
            }
            (*o)["fixed"] = false;
            for (const char* cle : {"look", "rendu"}) {
              const std::string a = s->contains(cle) ? (*s)[cle].dump() : std::string(), b = o->contains(cle) ? (*o)[cle].dump() : std::string();
              if (a != b) {
                if (a.empty()) o->erase(cle);
                else (*o)[cle] = (*s)[cle];
                ch = true;
              }
            }
            (*o)["st"] = "ok";
            (*o)["msg"] = "";
            if (o == &nv) neuves.push_back(std::move(nv));
            else garder.insert(texteDe(*o, "id"));
          }
        }
      }
    // Les instances neuves se rangent après leur source, puis sont nommées une à une
    std::vector<std::string> neufsIds;
    for (J& o : neuves) {
      const std::string k = texteDe(o["pat"], "k"), pid = texteDe(o["pat"], "id"), sid = k.substr(0, k.find('|'));
      int at = -1;
      for (size_t i = 0; i < owner["occ"].size(); i++) {
        const J& q = owner["occ"][i];
        if (texteDe(q, "id") == sid || (q.contains("pat") && q["pat"].is_object() && texteDe(q["pat"], "id") == pid && texteDe(q["pat"], "k").substr(0, texteDe(q["pat"], "k").find('|')) == sid)) at = static_cast<int>(i);
      }
      garder.insert(texteDe(o, "id"));
      neufsIds.push_back(texteDe(o, "id"));
      owner["occ"].insert(at < 0 ? owner["occ"].end() : owner["occ"].begin() + at + 1, std::move(o));
    }
    for (const std::string& id : neufsIds)
      if (J* o = occDe(id)) (*o)["name"] = nomOccurrence(a, texteDe(*o, "comp"));
    // Une instance sur le chemin de l'instance éditée reste : on ne retire pas la pièce sous les pieds
    const Chemin chemin = cheminActif(a);
    std::set<std::string> partis;
    for (const J& o : owner["occ"]) {
      const std::string id = texteDe(o, "id");
      if (o.contains("pat") && o["pat"].is_object() && !garder.count(id) && std::find(chemin.begin(), chemin.end(), id) == chemin.end()) partis.insert(id);
    }
    if (!partis.empty()) {
      ch = true;
      J reste = J::array();
      for (J& o : owner["occ"])
        if (!partis.count(texteDe(o, "id"))) reste.push_back(std::move(o));
      owner["occ"] = std::move(reste);
      const auto passe = [&](const J& r) {
        if (!r.is_object() || !r.contains("path") || !r["path"].is_array()) return false;
        for (const J& x : r["path"])
          if (x.is_string() && partis.count(x.get<std::string>())) return true;
        return false;
      };
      for (J& c : a["comps"])
        if (c.contains("occ") && c["occ"].is_array())
          for (J& q : c["occ"])
            if (q.contains("align") && q["align"].is_object() && ((q["align"].contains("dst") && passe(q["align"]["dst"])) || (q["align"].contains("src") && passe(q["align"]["src"])))) q["align"] = nullptr;
    }
    return ch;
  }
  bool resoudreDans(J& owner) {
    // asmResolveIn
    bool ch = genererInstances(owner);
    if (!owner.contains("occ") || !owner["occ"].is_array()) return ch;
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
    if (genererInstances(owner)) ch = true;
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
J documentVide(const std::string& nom) {
  J doc = J::object();
  doc["name"] = nom;
  doc["tint"] = 0;
  doc["sketches"] = J::array();
  doc["features"] = J::array();
  doc["cgeo"] = J::array();
  doc["bodyVis"] = J::object();
  doc["bodies"] = J::array();
  doc["bodySeq"] = 1;
  doc["activeBody"] = nullptr;
  doc["mep"] = nullptr;
  return doc;
}

const char* nomRepetition(const J& p) {
  const std::string t = texteDe(p, "type");
  if (t == "mir") return p.contains("plane2") && p["plane2"].is_string() ? "Symétrie double" : "Symétrie";
  if (t == "lin") return p.value("lin2", false) ? "Linéaire 2 directions" : "Linéaire";
  if (t == "circ") return "Circulaire";
  if (t == "path") return "Suivant un profil";
  return "Répétition";
}

J nouvelleRepetition(J& owner, const std::vector<std::string>& ids, double pas) {
  if (!owner.contains("pats") || !owner["pats"].is_array()) owner["pats"] = J::array();
  J p = J::object();
  p["id"] = nouvelIdentifiant("pt");
  p["name"] = "Répétition " + std::to_string(owner["pats"].size() + 1);
  p["type"] = "lin";
  p["src"] = J::array();
  for (const std::string& s : ids) p["src"].push_back(s);
  p["ref"] = J::object();
  p["ref"]["cg"] = nullptr;
  p["axis"] = "X";
  p["copies"] = 2;
  p["dist"] = pas;
  p["angle"] = 360;
  p["skip"] = J::array();
  owner["pats"].push_back(p);
  return p;
}

// ---- Depuis un corps ----
namespace {
struct ElementDoc {
  int sorte = 0;  // 0 fonction, 1 esquisse, 2 construction
  const J* o = nullptr;
};
std::map<std::string, ElementDoc> indexDoc(const J& d) {
  std::map<std::string, ElementDoc> m;
  const auto ajouter = [&](const char* cle, int sorte) {
    if (d.contains(cle) && d[cle].is_array())
      for (const J& x : d[cle])
        if (x.is_object() && x.contains("id") && x["id"].is_string()) m[x["id"].get<std::string>()] = {sorte, &x};
  };
  ajouter("features", 0);
  ajouter("sketches", 1);
  ajouter("cgeo", 2);
  return m;
}
void idsDans(const J& v, bool haut, const std::map<std::string, ElementDoc>& idx, const std::string& soi, std::set<std::string>& out) {
  if (v.is_string()) {
    const std::string s = v.get<std::string>();
    if (s != soi && idx.count(s)) out.insert(s);
  } else if (v.is_array()) {
    for (const J& x : v) idsDans(x, false, idx, soi, out);
  } else if (v.is_object()) {
    for (auto it = v.begin(); it != v.end(); ++it) {
      if (!it.key().empty() && it.key()[0] == '_') continue;
      if (haut && it.key() == "at") continue;
      idsDans(it.value(), false, idx, soi, out);
    }
  }
}
J sansTransitoires(const J& v) {
  if (v.is_object()) {
    J r = J::object();
    for (auto it = v.begin(); it != v.end(); ++it)
      if (it.key().empty() || it.key()[0] != '_') r[it.key()] = sansTransitoires(it.value());
    return r;
  }
  if (v.is_array()) {
    J r = J::array();
    for (const J& x : v) r.push_back(sansTransitoires(x));
    return r;
  }
  return v;
}
J renommerIds(const J& v, const std::map<std::string, std::string>& m) {
  if (v.is_string()) {
    const auto it = m.find(v.get<std::string>());
    return it == m.end() ? v : J(it->second);
  }
  if (v.is_array()) {
    J r = J::array();
    for (const J& x : v) r.push_back(renommerIds(x, m));
    return r;
  }
  if (v.is_object()) {
    J r = J::object();
    for (auto it = v.begin(); it != v.end(); ++it) r[it.key()] = renommerIds(it.value(), m);
    return r;
  }
  return v;
}
unsigned couleurAuto(size_t i) {
  static const unsigned PALETTE[] = {0x0a84ff, 0x30d158, 0xff9f0a, 0xbf5af2, 0xff453a, 0x64d2ff, 0xffd60a, 0x5e5ce6};
  return PALETTE[i % 8];
}
}  // namespace

PlanSeparation planSeparation(const J& d, const std::vector<std::string>& corps, const std::vector<std::string>& esquisses) {
  PlanSeparation P;
  P.corps = corps;
  const auto idx = indexDoc(d);
  const std::set<std::string> bodies(corps.begin(), corps.end());
  std::set<std::string> why;
  const auto nm = [&](const std::string& id) {
    const auto it = idx.find(id);
    const std::string n = it == idx.end() ? std::string() : texteDe(*it->second.o, "name");
    return "« " + (n.empty() ? id : n) + " »";
  };
  const auto bn = [&](const std::string& b) {
    std::string n = b;
    if (d.contains("bodies") && d["bodies"].is_array())
      for (const J& e : d["bodies"])
        if (texteDe(e, "id") == b) n = texteDe(e, "name");
    return "« " + n + " »";
  };
  if (!bodies.empty() && d.contains("features"))
    for (const J& f : d["features"])
      if (f.is_object() && bodies.count(texteDe(f, "body"))) P.M.insert(texteDe(f, "id"));
  for (const std::string& s : esquisses)
    if (idx.count(s)) P.M.insert(s);
  std::map<std::string, std::set<std::string>> refs;
  const auto R = [&](const std::string& id) -> const std::set<std::string>& {
    auto it = refs.find(id);
    if (it == refs.end()) {
      std::set<std::string> s;
      idsDans(*idx.at(id).o, true, idx, id, s);
      it = refs.emplace(id, std::move(s)).first;
    }
    return it->second;
  };
  const auto outils = [](const J& f) {
    std::vector<std::string> L;
    if (f.contains("tools") && f["tools"].is_array())
      for (const J& x : f["tools"])
        if (x.is_string()) L.push_back(x.get<std::string>());
    return L;
  };
  std::set<std::string> need = P.M;
  std::vector<std::string> q(P.M.begin(), P.M.end());
  while (!q.empty()) {
    const std::string id = q.back();
    q.pop_back();
    const ElementDoc& it = idx.at(id);
    if (it.sorte == 0)
      for (const std::string& b : outils(*it.o))
        if (!bodies.count(b)) why.insert(nm(id) + " combine avec le corps " + bn(b) + " qui reste");
    for (const std::string& r : R(id)) {
      if (idx.at(r).sorte == 0 && !P.M.count(r)) {
        why.insert(nm(id) + " s’appuie sur " + nm(r) + ", qui reste");
        continue;
      }
      if (need.insert(r).second) q.push_back(r);
    }
  }
  for (const std::string& id : need)
    if (!P.M.count(id)) P.deplacer.insert(id);
  for (bool ch = true; ch;) {
    ch = false;
    for (const std::string& x : std::set<std::string>(P.deplacer)) {
      for (const auto& [id, e] : idx) {
        if (P.M.count(id) || P.deplacer.count(id)) continue;
        if (R(id).count(x)) {
          P.deplacer.erase(x);
          ch = true;
          break;
        }
      }
    }
  }
  for (const std::string& id : need)
    if (!P.M.count(id) && !P.deplacer.count(id)) P.copier.insert(id);
  for (const auto& [id, it] : idx) {
    if (P.M.count(id) || P.deplacer.count(id)) continue;
    if (it.sorte == 0)
      for (const std::string& b : outils(*it.o))
        if (bodies.count(b)) {
          why.insert(nm(id) + " combine avec un corps qui part");
          break;
        }
    for (const std::string& r : R(id))
      if (P.M.count(r)) why.insert(nm(id) + ", qui reste, utilise " + nm(r));
  }
  P.pourquoi.assign(why.begin(), why.end());
  P.ok = why.empty();
  return P;
}

void appliquerSeparation(J& src, J& dst, const PlanSeparation& plan) {
  const auto prend = [&](const std::string& id) { return plan.M.count(id) || plan.deplacer.count(id) || plan.copier.count(id); };
  for (const char* k : {"features", "sketches", "cgeo", "bodies", "params"})
    if (!dst.contains(k) || !dst[k].is_array()) dst[k] = J::array();
  std::set<std::string> pris;
  for (const char* k : {"features", "sketches", "cgeo"})
    for (const J& x : dst[k]) pris.insert(texteDe(x, "id"));
  std::map<std::string, std::string> carte;
  for (const std::set<std::string>* s : {&plan.M, &plan.deplacer, &plan.copier})
    for (const std::string& id : *s)
      if (pris.count(id)) carte[id] = nouvelIdentifiant(id.substr(0, id.find('_')).c_str());
  int seq = dst.contains("bodySeq") && dst["bodySeq"].is_number() ? dst["bodySeq"].get<int>() : 1;
  for (const J& e : dst["bodies"]) {
    const std::string b = texteDe(e, "id");
    if (b.size() > 1 && b[0] == 'b' && b.find_first_not_of("0123456789", 1) == std::string::npos) seq = std::max(seq, std::atoi(b.c_str() + 1) + 1);
  }
  std::map<std::string, std::string> cartesCorps;
  for (const std::string& b : plan.corps) {
    bool existe = false;
    for (const J& e : dst["bodies"]) existe = existe || texteDe(e, "id") == b;
    cartesCorps[b] = existe ? "b" + std::to_string(seq++) : b;
  }
  dst["bodySeq"] = seq;
  const size_t n0 = dst["features"].size();
  const J vide = J::array();
  const J& sf = src.contains("features") && src["features"].is_array() ? src["features"] : vide;
  for (const J& f : sf) {
    if (!plan.M.count(texteDe(f, "id"))) continue;
    J g = renommerIds(sansTransitoires(f), carte);
    const std::string b = texteDe(g, "body");
    if (cartesCorps.count(b)) g["body"] = cartesCorps[b];
    if (g.contains("tools") && g["tools"].is_array())
      for (J& t : g["tools"])
        if (t.is_string() && cartesCorps.count(t.get<std::string>())) t = cartesCorps[t.get<std::string>()];
    dst["features"].push_back(std::move(g));
  }
  if (src.contains("sketches") && src["sketches"].is_array())
    for (const J& s : src["sketches"])
      if (prend(texteDe(s, "id"))) dst["sketches"].push_back(renommerIds(sansTransitoires(s), carte));
  // La construction : ancrée après la dernière fonction transférée qui la précédait, sinon après celles que la cible avait déjà
  if (src.contains("cgeo") && src["cgeo"].is_array())
    for (const J& o : src["cgeo"]) {
      if (!prend(texteDe(o, "id"))) continue;
      J c = renommerIds(sansTransitoires(o), carte);
      const bool sansAt = !o.contains("at") || o["at"].is_null();
      int i = -1;
      if (!sansAt) {
        const std::string at0 = texteDe(o, "at");
        int trouve = -1;
        for (size_t k = 0; k < sf.size(); k++)
          if (texteDe(sf[k], "id") == at0) trouve = static_cast<int>(k);
        i = trouve >= 0 ? trouve : std::min(o.contains("ai") && o["ai"].is_number() ? o["ai"].get<int>() : 0, static_cast<int>(sf.size())) - 1;
      }
      std::string at;
      for (; i >= 0; i--) {
        const std::string fid = texteDe(sf[i], "id");
        if (plan.M.count(fid)) {
          at = carte.count(fid) ? carte[fid] : fid;
          break;
        }
      }
      if (at.empty() && !sansAt && n0 > 0) at = texteDe(dst["features"][n0 - 1], "id");
      if (sansAt || at.empty()) {
        c["at"] = nullptr;
        c["ai"] = 0;
      } else {
        c["at"] = at;
        int rang = 0;
        for (size_t k = 0; k < dst["features"].size(); k++)
          if (texteDe(dst["features"][k], "id") == at) rang = static_cast<int>(k) + 1;
        c["ai"] = rang;
      }
      dst["cgeo"].push_back(std::move(c));
    }
  const auto couleur = [&](const J& e, size_t rang) -> unsigned {
    const unsigned teinte = src.contains("tint") && src["tint"].is_number() ? src["tint"].get<unsigned>() : 0;
    (void)e;
    return teinte ? teinte : couleurAuto(rang);
  };
  for (const std::string& b : plan.corps) {
    if (src.contains("bodies") && src["bodies"].is_array())
      for (size_t i = 0; i < src["bodies"].size(); i++) {
        const J& e = src["bodies"][i];
        if (texteDe(e, "id") != b) continue;
        J k = sansTransitoires(e);
        k["id"] = cartesCorps[b];
        if (!(k.contains("color") && k["color"].is_number() && k["color"].get<double>() > 0)) k["color"] = couleur(e, i);
        dst["bodies"].push_back(std::move(k));
      }
    if (src.contains("bodyVis") && src["bodyVis"].is_object() && src["bodyVis"].contains(b) && src["bodyVis"][b] == false) {
      if (!dst.contains("bodyVis") || !dst["bodyVis"].is_object()) dst["bodyVis"] = J::object();
      dst["bodyVis"][cartesCorps[b]] = false;
    }
  }
  if (src.contains("params") && src["params"].is_array())
    for (const J& p : src["params"]) {
      const std::string nom = texteDe(p, "name");
      if (nom.empty()) continue;
      bool la = false;
      for (const J& q : dst["params"]) la = la || texteDe(q, "name") == nom;
      if (!la) dst["params"].push_back(sansTransitoires(p));
    }
  if (src.contains("derive") && src["derive"].is_array())
    for (const J& L : src["derive"]) {
      if (!dst.contains("derive") || !dst["derive"].is_array()) dst["derive"] = J::array();
      bool la = false;
      for (const J& q : dst["derive"]) la = la || texteDe(q, "id") == texteDe(L, "id");
      if (!la) dst["derive"].push_back(sansTransitoires(L));
    }
  bool actifLa = false;
  const std::string ab = texteDe(dst, "activeBody");
  for (const J& e : dst["bodies"]) actifLa = actifLa || texteDe(e, "id") == ab;
  if (!actifLa) dst["activeBody"] = dst["bodies"].empty() ? J() : dst["bodies"][0]["id"];
  // Le retrait de la source
  const auto filtrer = [&](const char* cle, const std::function<bool(const std::string&)>& part) {
    if (!src.contains(cle) || !src[cle].is_array()) return;
    J reste = J::array();
    for (J& x : src[cle])
      if (!part(texteDe(x, "id"))) reste.push_back(std::move(x));
    src[cle] = std::move(reste);
  };
  filtrer("features", [&](const std::string& id) { return plan.M.count(id) > 0; });
  filtrer("sketches", [&](const std::string& id) { return plan.M.count(id) || plan.deplacer.count(id); });
  filtrer("cgeo", [&](const std::string& id) { return plan.deplacer.count(id) > 0; });
  if (!plan.corps.empty() && src.contains("bodies") && src["bodies"].is_array()) {
    // La couleur automatique dépend du rang : on fige celle des corps qui restent
    const std::set<std::string> partent(plan.corps.begin(), plan.corps.end());
    J reste = J::array();
    for (size_t i = 0; i < src["bodies"].size(); i++) {
      J& e = src["bodies"][i];
      if (partent.count(texteDe(e, "id"))) continue;
      if (!(e.contains("color") && e["color"].is_number() && e["color"].get<double>() > 0)) e["color"] = couleur(e, i);
      reste.push_back(std::move(e));
    }
    src["bodies"] = std::move(reste);
    if (src.contains("bodyVis") && src["bodyVis"].is_object())
      for (const std::string& b : plan.corps) src["bodyVis"].erase(b);
    if (src["bodies"].empty()) {
      const int n = src.contains("bodySeq") && src["bodySeq"].is_number() ? src["bodySeq"].get<int>() : 1;
      src["bodySeq"] = n + 1;
      J e = J::object();
      e["id"] = "b" + std::to_string(n);
      e["name"] = "Corps " + std::to_string(n);
      e["c"] = nullptr;
      src["bodies"].push_back(std::move(e));
    }
    bool ok = false;
    const std::string sa = texteDe(src, "activeBody");
    for (const J& e : src["bodies"]) ok = ok || texteDe(e, "id") == sa;
    if (!ok) src["activeBody"] = src["bodies"][0]["id"];
  }
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
  // Répétitions : une instance est notée supprimée ; une source part avec ses instances, avant la purge
  if (const J* o = occurrence(a, id); o && ow->contains("pats") && (*ow)["pats"].is_array()) {
    if (o->contains("pat") && (*o)["pat"].is_object()) {
      for (J& p : (*ow)["pats"])
        if (texteDe(p, "id") == texteDe((*o)["pat"], "id")) {
          if (!p.contains("skip") || !p["skip"].is_array()) p["skip"] = J::array();
          p["skip"].push_back((*o)["pat"]["k"]);
        }
    } else {
      for (J& p : (*ow)["pats"])
        if (p.contains("src") && p["src"].is_array()) {
          J s = J::array();
          for (const J& x : p["src"])
            if (!x.is_string() || x.get<std::string>() != id) s.push_back(x);
          p["src"] = std::move(s);
        }
      J reste = J::array();
      for (J& q : (*ow)["occ"]) {
        const bool sienne = q.contains("pat") && q["pat"].is_object() && texteDe(q["pat"], "k").rfind(id + "|", 0) == 0;
        if (!sienne) reste.push_back(std::move(q));
      }
      (*ow)["occ"] = std::move(reste);
    }
  }
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

// ---- Composants liés à un fichier (47-composants-lies) ----
std::string empreinteTexte(const std::string& s) {
  uint32_t h = 2166136261u;
  size_t n = 0;
  const auto mange = [&](uint32_t u) {
    h ^= u;
    h *= 16777619u;
    n++;
  };
  for (size_t i = 0; i < s.size();) {
    const unsigned char c = s[i];
    uint32_t p = c;
    int k = 0;
    if (c >= 0xf0) { p = c & 7; k = 3; }
    else if (c >= 0xe0) { p = c & 15; k = 2; }
    else if (c >= 0xc0) { p = c & 31; k = 1; }
    i++;
    for (; k > 0 && i < s.size(); k--, i++) p = (p << 6) | (static_cast<unsigned char>(s[i]) & 63);
    if (p >= 0x10000) {
      p -= 0x10000;
      mange(0xd800 + (p >> 10));
      mange(0xdc00 + (p & 0x3ff));
    } else mange(p);
  }
  std::string b;
  uint32_t v = h;
  do {
    b.insert(b.begin(), "0123456789abcdefghijklmnopqrstuvwxyz"[v % 36]);
    v /= 36;
  } while (v);
  return b + "_" + std::to_string(n);
}

const J* proprietaireLien(const J& a, const std::string& cid) {
  const J* c = composant(a, cid);
  if (!c) return nullptr;
  if (c->contains("link") && (*c)["link"].is_object()) return c;
  const std::string of = texteDe(*c, "of");
  return of.empty() ? nullptr : composant(a, of);
}

std::vector<std::string> membresLien(const J& a, const std::string& cid) {
  std::vector<std::string> r{cid};
  std::set<std::string> s{cid};
  for (bool ch = true; ch;) {
    ch = false;
    for (const J& c : a["comps"]) {
      const std::string id = texteDe(c, "id"), of = texteDe(c, "of");
      if (!of.empty() && s.count(of) && !s.count(id)) {
        s.insert(id);
        r.push_back(id);
        ch = true;
      }
    }
  }
  return r;
}

namespace {
J remplaceChemin(const J& rel, const std::function<std::string(const std::string&)>& M) {
  J r = rel;
  if (r.is_object() && r.contains("path") && r["path"].is_array())
    for (J& x : r["path"])
      if (x.is_string()) x = M(x.get<std::string>());
  return r;
}
std::string cleNeuve(const std::string& k, const std::function<std::string(const std::string&)>& M) {
  const size_t i = k.find('|');
  return i == std::string::npos ? k : M(k.substr(0, i)) + k.substr(i);
}
J repetitionsNeuves(const J& pats, const std::function<std::string(const std::string&)>& M) {
  J L = J::array();
  for (const J& p0 : pats) {
    J p = J::object();
    for (auto it = p0.begin(); it != p0.end(); ++it)
      if (it.key() != "st" && it.key() != "msg" && it.key()[0] != '_') p[it.key()] = it.value();
    J src = J::array(), skip = J::array();
    if (p.contains("src") && p["src"].is_array())
      for (const J& x : p["src"]) src.push_back(x.is_string() ? J(M(x.get<std::string>())) : x);
    if (p.contains("skip") && p["skip"].is_array())
      for (const J& x : p["skip"]) skip.push_back(x.is_string() ? J(cleNeuve(x.get<std::string>(), M)) : x);
    p["src"] = std::move(src);
    p["skip"] = std::move(skip);
    L.push_back(std::move(p));
  }
  return L;
}
J lienSansEtat(const J& l) {  // asmLinkSerial, sans pend
  if (!l.is_object()) return J();
  J o = J::object();
  for (auto it = l.begin(); it != l.end(); ++it)
    if (it.key() != "st" && it.key() != "msg" && it.key() != "pend" && it.key() != "base" && it.key()[0] != '_') o[it.key()] = it.value();
  return o;
}
J sansAsm(const J& haut) {
  J d = J::object();
  for (auto it = haut.begin(); it != haut.end(); ++it)
    if (it.key() != "asm") d[it.key()] = it.value();
  return d;
}
}  // namespace

J sousArbreLien(const J& haut, const std::string& cid) {
  const J& a = haut["asm"];
  const std::string act = actif(a);
  const J* L = composant(a, cid);
  const auto docDe = [&](const J& c) { return texteDe(c, "id") == act ? sansAsm(haut) : c.value("doc", J()); };
  std::map<std::string, std::string> inv;
  const J* lk = L->contains("link") && (*L)["link"].is_object() ? &(*L)["link"] : nullptr;
  if (lk && lk->contains("map") && (*lk)["map"].is_object())
    for (auto it = (*lk)["map"].begin(); it != (*lk)["map"].end(); ++it)
      if (it.value().is_string()) inv[it.value().get<std::string>()] = it.key();
  const std::string sr = lk ? texteDe(*lk, "srcRoot") : std::string();
  inv[cid] = sr.empty() ? cid : sr;
  const std::function<std::string(const std::string&)> I = [&](const std::string& id) {
    const auto it = inv.find(id);
    return it == inv.end() ? id : it->second;
  };
  const std::string nom = texteDe(*L, "name");
  J top = docDe(*L);
  if (!top.is_object()) top = J::object();
  top["name"] = nom;
  const std::vector<std::string> mem = membresLien(a, cid);
  if (mem.size() > 1 || (L->contains("occ") && !(*L)["occ"].empty())) {
    J t = J::object();
    t["v"] = 2;
    t["name"] = nom;
    t["root"] = I(cid);
    t["active"] = I(cid);
    t["path"] = J::array();
    t["mode"] = "part";
    t["comps"] = J::array();
    for (const std::string& mid : mem) {
      const J& c = *composant(a, mid);
      J k = J::object();
      k["id"] = I(mid);
      k["kind"] = "comp";
      k["name"] = texteDe(c, "name");
      k["doc"] = mid == cid ? J() : docDe(c);
      k["occ"] = J::array();
      if (c.contains("occ") && c["occ"].is_array())
        for (const J& o : c["occ"]) {
          J q = J::object();
          q["id"] = I(texteDe(o, "id"));
          q["comp"] = I(texteDe(o, "comp"));
          q["name"] = texteDe(o, "name");
          q["fr"] = o.value("fr", J());
          q["fixed"] = o.value("fixed", false);
          q["visible"] = !(o.contains("visible") && o["visible"].is_boolean() && !o["visible"].get<bool>());
          if (o.contains("align") && o["align"].is_object()) {
            J al = o["align"];
            if (al.contains("src")) al["src"] = remplaceChemin(al["src"], I);
            if (al.contains("dst")) al["dst"] = remplaceChemin(al["dst"], I);
            q["align"] = std::move(al);
          } else q["align"] = nullptr;
          if (o.contains("pat") && o["pat"].is_object()) q["pat"] = J{{"id", texteDe(o["pat"], "id")}, {"k", cleNeuve(texteDe(o["pat"], "k"), I)}};
          k["occ"].push_back(std::move(q));
        }
      k["link"] = mid == cid ? J() : lienSansEtat(c.value("link", J()));
      const std::string of = texteDe(c, "of");
      if (!of.empty() && of != cid) k["of"] = I(of);
      if (c.contains("pats") && c["pats"].is_array() && !c["pats"].empty()) k["pats"] = repetitionsNeuves(c["pats"], I);
      t["comps"].push_back(std::move(k));
    }
    top["asm"] = std::move(t);
  } else top.erase("asm");
  return top;
}

void chargerLien(J& haut, const std::string& cid, const J& top, const std::string& sig) {
  // asmTreeOfFile
  J comps = J::array();
  std::string racineSrc = "_r";
  if (top.contains("asm") && top["asm"].is_object() && top["asm"].contains("comps") && top["asm"]["comps"].is_array() && !top["asm"]["comps"].empty()) {
    racineSrc = texteDe(top["asm"], "root");
    for (const J& c0 : top["asm"]["comps"]) {
      J c = c0;
      if (!c.contains("doc") || !c["doc"].is_object()) c["doc"] = sansAsm(top);
      comps.push_back(std::move(c));
    }
  } else {
    J c = J::object();
    c["id"] = racineSrc;
    c["kind"] = "comp";
    c["name"] = top.contains("name") && top["name"].is_string() ? top["name"] : J("Composant");
    c["doc"] = top;
    c["occ"] = J::array();
    c["link"] = nullptr;
    comps.push_back(std::move(c));
  }
  J& a = haut["asm"];
  std::map<std::string, std::string> map;
  {
    const J* L = composant(a, cid);
    if (L && L->contains("link") && (*L)["link"].is_object() && (*L)["link"].contains("map") && (*L)["link"]["map"].is_object())
      for (auto it = (*L)["link"]["map"].begin(); it != (*L)["link"]["map"].end(); ++it)
        if (it.value().is_string()) map[it.key()] = it.value().get<std::string>();
  }
  std::vector<std::string> oldM = membresLien(a, cid);
  oldM.erase(oldM.begin());
  const std::set<std::string> old(oldM.begin(), oldM.end());
  std::set<std::string> pris;
  for (const J& c : a["comps"]) {
    const std::string id = texteDe(c, "id");
    if (id == cid || old.count(id)) continue;
    pris.insert(id);
    if (c.contains("occ") && c["occ"].is_array())
      for (const J& o : c["occ"]) pris.insert(texteDe(o, "id"));
  }
  const std::function<std::string(const std::string&)> M = [&](const std::string& id) {
    if (id == racineSrc) return cid;
    const auto it = map.find(id);
    if (it != map.end()) return it->second;
    if (pris.count(id) || id == cid) {
      const size_t u = id.find('_');
      map[id] = nouvelIdentifiant(u == std::string::npos || u == 0 ? "id" : id.substr(0, u).c_str());
      return map[id];
    }
    return id;
  };
  std::set<std::string> garde;
  for (const J& c : comps) {
    const std::string n = M(texteDe(c, "id"));
    if (texteDe(c, "id") != racineSrc) garde.insert(n);
    if (c.contains("occ") && c["occ"].is_array())
      for (const J& o : c["occ"]) M(texteDe(o, "id"));
  }
  // Le composant actif disparaît avec la source : on remonte d'abord à la racine
  if (old.count(actif(a)) && !garde.count(actif(a))) activer(haut, racine(a), {});
  const auto occNeuve = [&](const J& o0) {
    J o = o0;
    o["id"] = M(texteDe(o0, "id"));
    o["comp"] = M(texteDe(o0, "comp"));
    o["st"] = "ok";
    o["msg"] = "";
    if (o.contains("align") && o["align"].is_object()) {
      if (o["align"].contains("src")) o["align"]["src"] = remplaceChemin(o["align"]["src"], M);
      if (o["align"].contains("dst")) o["align"]["dst"] = remplaceChemin(o["align"]["dst"], M);
    }
    if (o.contains("pat") && o["pat"].is_object()) o["pat"] = J{{"id", texteDe(o["pat"], "id")}, {"k", cleNeuve(texteDe(o["pat"], "k"), M)}};
    return o;
  };
  const auto occsDe = [&](const J& c) {
    J L = J::array();
    if (c.contains("occ") && c["occ"].is_array())
      for (const J& o : c["occ"]) L.push_back(occNeuve(o));
    return L;
  };
  // Le bloc peut changer de place : chaque composant est retrouvé par son identifiant
  std::string nomL = texteDe(*composant(haut["asm"], cid), "name");
  for (const J& c : comps) {
    const bool estRacine = texteDe(c, "id") == racineSrc;
    const std::string id = M(texteDe(c, "id"));
    const J occs = occsDe(c);
    const J pats = c.contains("pats") && c["pats"].is_array() && !c["pats"].empty() ? repetitionsNeuves(c["pats"], M) : J();
    J& ha = haut["asm"];
    J* h = composant(ha, id);
    if (estRacine) {
      J nd = c["doc"];
      nd["name"] = nomL;
      const bool etaitActif = id == actif(ha);
      if (etaitActif) {
        J bloc = ha;
        haut = std::move(nd);
        haut["asm"] = std::move(bloc);
      } else (*h)["doc"] = std::move(nd);
      h = composant(haut["asm"], id);
      (*h)["occ"] = occs;
      if (pats.is_null()) h->erase("pats");
      else (*h)["pats"] = pats;
    } else if (h) {
      const bool etaitActif = id == actif(ha);
      if (etaitActif) {
        J bloc = ha;
        J nd = c["doc"];
        haut = std::move(nd);
        haut["asm"] = std::move(bloc);
      } else (*h)["doc"] = c["doc"];
      h = composant(haut["asm"], id);
      (*h)["name"] = c.value("name", J());
      (*h)["occ"] = occs;
      (*h)["link"] = c.value("link", J());
      (*h)["of"] = c.contains("of") && c["of"].is_string() ? M(c["of"].get<std::string>()) : cid;
      if (pats.is_null()) h->erase("pats");
      else (*h)["pats"] = pats;
    } else {
      J n = J::object();
      n["id"] = id;
      n["kind"] = "comp";
      n["name"] = c.value("name", J());
      n["doc"] = c["doc"];
      n["occ"] = occs;
      n["link"] = c.value("link", J());
      n["of"] = c.contains("of") && c["of"].is_string() ? M(c["of"].get<std::string>()) : cid;
      if (!pats.is_null()) n["pats"] = pats;
      ha["comps"].push_back(std::move(n));
    }
  }
  J& a2 = haut["asm"];
  J reste = J::array();
  for (J& c : a2["comps"]) {
    const std::string id = texteDe(c, "id");
    if (!old.count(id) || garde.count(id)) reste.push_back(std::move(c));
  }
  a2["comps"] = std::move(reste);
  for (auto it = map.begin(); it != map.end();) it = it->first == it->second ? map.erase(it) : std::next(it);
  J& lk = (*composant(a2, cid))["link"];
  J mj = J::object();
  for (const auto& [k, v] : map) mj[k] = v;
  lk["map"] = std::move(mj);
  lk["srcRoot"] = racineSrc;
  lk["sig"] = sig;
  lk.erase("pend");
  lk.erase("st");
  lk.erase("msg");
}

std::set<std::string> sousComposants(const J& a, const std::string& cid) {
  std::set<std::string> s;
  for (const Instance& i : instances(a, cid)) s.insert(i.comp);
  s.erase(cid);
  return s;
}

std::string refusExtraction(const J& a, const std::string& cid) {
  const J* C = composant(a, cid);
  if (!C || cid == racine(a)) return "la racine ne s'extrait pas";
  if (C->contains("link") && (*C)["link"].is_object()) return "« " + texteDe(*C, "name") + " » est déjà lié à " + texteDe((*C)["link"], "name");
  if (proprietaireLien(a, cid)) return "« " + texteDe(*C, "name") + " » fait partie d'un composant lié : extrayez plutôt celui-ci";
  const std::set<std::string> sub = sousComposants(a, cid);
  std::vector<std::string> bad;
  for (const J& c : a["comps"]) {
    const std::string own = texteDe(c, "id");
    if (own == cid || sub.count(own) || !c.contains("occ")) continue;
    for (const J& o : c["occ"]) {
      const std::string oc = texteDe(o, "comp");
      if (sub.count(oc)) {
        const std::string n = texteDe(*composant(a, oc), "name");
        if (std::find(bad.begin(), bad.end(), n) == bad.end()) bad.push_back(n);
      }
    }
  }
  if (bad.empty()) return "";
  std::string m;
  for (const std::string& n : bad) m += (m.empty() ? "" : ", ") + n;
  return m + " sert aussi ailleurs dans l'assemblage";
}
}  // namespace assemblage
