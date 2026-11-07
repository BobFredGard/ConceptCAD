// Calcul et fiche des éléments de construction : mêmes formules, dans le même ordre, que src/78-construction-modele.js
#include "assemblage_refs.h"
#include "construction.h"

#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepClass3d_SolidClassifier.hxx>
#include <ElSLib.hxx>
#include <GeomAbs_SurfaceType.hxx>
#include <Standard_Failure.hxx>
#include <TopAbs.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <gp_Cone.hxx>
#include <gp_Cylinder.hxx>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <functional>
#include <map>
#include <memory>
#include <stdexcept>

#include "contours.h"
#include "faces.h"
#include "noms.h"
#include "rejeu.h"
#include "spline.h"

namespace {
using json = nlohmann::ordered_json;
const double PI = 3.14159265358979323846;

Vec3 add(const Vec3& a, const Vec3& b) { return {a[0] + b[0], a[1] + b[1], a[2] + b[2]}; }
Vec3 sub(const Vec3& a, const Vec3& b) { return {a[0] - b[0], a[1] - b[1], a[2] - b[2]}; }
Vec3 mul(const Vec3& a, double s) { return {a[0] * s, a[1] * s, a[2] * s}; }
double dot(const Vec3& a, const Vec3& b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
Vec3 cross(const Vec3& a, const Vec3& b) { return {a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]}; }
double len(const Vec3& a) { return std::hypot(a[0], a[1], a[2]); }
Vec3 unit(const Vec3& a) {
  const double L = len(a);
  if (!(L > 1e-12)) throw std::runtime_error("direction nulle");
  return {a[0] / L, a[1] / L, a[2] / L};
}
Vec3 rot(const Vec3& p, const Vec3& o, const Vec3& d, double ang) {  // cgRot : Rodrigues
  const Vec3 v = sub(p, o);
  const double c = std::cos(ang), s = std::sin(ang);
  return add(add(add(mul(v, c), mul(cross(d, v), s)), mul(d, dot(d, v) * (1 - c))), o);
}
Vec3 rotDir(const Vec3& v, const Vec3& d, double ang) { return rot(v, {0, 0, 0}, d, ang); }

struct Base {
  Vec3 u, v, n;
};
Base baseN(Vec3 n, const Vec3* indice) {  // cgBasisN
  n = unit(n);
  Vec3 u{};
  bool a = false;
  if (indice) {
    u = sub(*indice, mul(n, dot(n, *indice)));
    a = len(u) >= 1e-8;
  }
  if (!a) {
    u = sub({1, 0, 0}, mul(n, n[0]));
    if (len(u) < 1e-8) u = sub({0, 1, 0}, mul(n, n[1]));
  }
  u = unit(u);
  Vec3 v = cross(n, u);
  if (!indice && std::abs(n[2]) < 0.95 && v[2] < -1e-6) {
    u = mul(u, -1);
    v = mul(v, -1);
  }
  return {u, v, n};
}
struct Plan {
  Vec3 o, u, v, n;
};
struct Axe {
  Vec3 o, d;
  double r = -1, t0 = 0, t1 = 0;  // r : rayon d'un cylindre
};
struct Repere {
  Vec3 o, x, y, z;
};
struct Courbe {
  std::vector<Vec3> pts;
};
struct Formes {
  std::optional<Plan> plane;
  std::optional<Axe> axis;
  std::optional<Vec3> point;
  std::optional<Repere> frame;
  std::optional<Courbe> curve;
  std::function<Courbe()> courbeTardive;  // échantillonnée à la demande seulement
};
const Repere REPERE0{{0, 0, 0}, {1, 0, 0}, {0, 1, 0}, {0, 0, 1}};

Vec3 lireV(const json& j, const char* k) {
  Vec3 v{0, 0, 0};
  if (auto x = j.find(k); x != j.end() && x->is_array() && x->size() >= 3)
    for (int i = 0; i < 3; i++) v[i] = (*x)[i].is_number() ? (*x)[i].get<double>() : 0;
  return v;
}
std::string str(const json& j, const char* k) {
  const auto x = j.find(k);
  return x != j.end() && x->is_string() ? x->get<std::string>() : std::string();
}
json jv(const Vec3& v) { return json::array({v[0], v[1], v[2]}); }

Formes sousRepere(const Repere& F, const std::string& s) {  // cgFrameSub
  Formes g;
  if (s == "XY") g.plane = Plan{F.o, F.x, F.y, F.z};
  else if (s == "XZ") g.plane = Plan{F.o, F.x, F.z, mul(F.y, -1)};
  else if (s == "YZ") g.plane = Plan{F.o, F.y, F.z, F.x};
  else if (s == "X") g.axis = Axe{F.o, F.x};
  else if (s == "Y") g.axis = Axe{F.o, F.y};
  else if (s == "Z") g.axis = Axe{F.o, F.z};
  return g;
}
bool lireRepere(const json& el, Repere& F) {
  const auto x = el.find("fr");
  if (x == el.end() || !x->is_object()) return false;
  F = {lireV(*x, "o"), lireV(*x, "x"), lireV(*x, "y"), lireV(*x, "z")};
  return true;
}
Formes formesDe(const json& el) {  // cgShapes
  Formes g;
  Repere F;
  if (!lireRepere(el, F)) return g;
  const std::string k = str(el, "kind");
  g.point = F.o;
  if (k == "plane" || k == "frame") g.plane = Plan{F.o, F.x, F.y, F.z};
  if (k == "axis" || k == "frame") g.axis = Axe{F.o, F.z};
  if (k == "frame") g.frame = F;
  return g;
}

// Les emplacements et les valeurs d'une méthode (CG_HOW)
struct Valeur {
  const char* cle;
  const char* titre;
  double def;
  const char* unite;
};
struct Slot {
  const char* type;
  const char* titre;
  bool option;
};
struct Methode {
  const char* how;
  const char* titre;
  std::vector<Slot> slots;
  std::vector<Valeur> par;
  bool flip;
};
const std::vector<Valeur> PAR_REPERE = {{"dx", "Décalage X", 0, "mm"}, {"dy", "Décalage Y", 0, "mm"}, {"dz", "Décalage Z", 0, "mm"}, {"rz", "Rotation autour de Z", 0, "°"}};
const std::vector<Methode>& methodes(const std::string& kind) {
  static const std::map<std::string, std::vector<Methode>> M = {
      {"plane",
       {{"offset", "Décalé", {{"plane", "Plan ou face", false}}, {{"d", "Distance", 10, "mm"}}, true},
        {"angle", "À un angle", {{"plane", "Plan ou face", false}, {"axis", "Axe de rotation", false}}, {{"a", "Angle", 30, "°"}}, true},
        {"3pts", "Par 3 points", {{"point", "Point 1", false}, {"point", "Point 2", false}, {"point", "Point 3", false}}, {}, true},
        {"mid", "Médian", {{"plane", "Plan 1", false}, {"plane", "Plan 2", false}}, {}, true},
        {"normal", "Normal à un axe", {{"axis", "Axe", false}, {"point", "Point", true}}, {}, true},
        {"curve", "Perpendiculaire à une courbe", {{"curve", "Droite, arc ou spline", false}}, {{"t", "Position (0 début → 1 fin)", 0.5, "ratio"}}, true},
        {"ext", "Depuis un autre composant", {}, {}, true},
        {"tangent", "Tangent à un cylindre", {{"axis", "Face cylindrique", false}, {"axis", "Direction", true}, {"point", "Référence de cote", true}}, {{"a", "Angle autour de l’axe", 0, "°"}, {"d", "Cote depuis la référence", 0, "mm"}, {"e", "Décalage latéral", 0, "mm"}}, false}}},
      {"axis",
       {{"ref", "Arête, cylindre ou axe", {{"axis", "Arête droite, cylindre ou axe", false}}, {}, true},
        {"2pts", "Par 2 points", {{"point", "Point 1", false}, {"point", "Point 2", false}}, {}, true},
        {"inter", "Intersection de 2 plans", {{"plane", "Plan 1", false}, {"plane", "Plan 2", false}}, {}, true},
        {"normal", "Normal à un plan", {{"plane", "Plan ou face", false}, {"point", "Point", false}}, {}, true},
        {"ext", "Depuis un autre composant", {}, {}, true}}},
      {"point",
       {{"xyz", "Coordonnées", {{"frame", "Repère (origine si vide)", true}}, {{"dx", "X", 0, "mm"}, {"dy", "Y", 0, "mm"}, {"dz", "Z", 0, "mm"}}, false},
        {"ref", "Sommet, centre ou point d’esquisse", {{"point", "Point", false}}, {}, false},
        {"inter", "Intersection axe / plan", {{"axis", "Axe", false}, {"plane", "Plan ou face", false}}, {}, false},
        {"ext", "Depuis un autre composant", {}, {}, false}}},
      {"frame",
       {{"zx", "Origine, Z et X", {{"point", "Origine", false}, {"axis", "Direction Z", false}, {"axis", "Direction X", true}}, PAR_REPERE, true},
        {"face", "Sur un plan ou une face", {{"plane", "Plan ou face", false}, {"axis", "Direction X", true}}, PAR_REPERE, true},
        {"3pts", "Par 3 points", {{"point", "Origine", false}, {"point", "Point sur X", false}, {"point", "Point dans XY", false}}, PAR_REPERE, true},
        {"ext", "Depuis un autre composant", {}, PAR_REPERE, true}}}};
  static const std::vector<Methode> vide;
  const auto it = M.find(kind);
  return it == M.end() ? vide : it->second;
}
const Methode* methodeDe(const std::string& kind, const std::string& how) {
  for (const Methode& m : methodes(kind))
    if (how == m.how) return &m;
  return nullptr;
}
const char* nomSorte(const std::string& k) { return k == "plane" ? "Plan" : k == "axis" ? "Axe" : k == "point" ? "Point" : k == "frame" ? "Repère" : "?"; }
const char* defautHow(const std::string& k) { return k == "plane" ? "offset" : k == "axis" ? "ref" : k == "point" ? "xyz" : "zx"; }

// La passe de résolution : le solide qui précède l'élément, gardé tant que la position ne change pas
struct Contexte {
  Document& d;
  const ElementConstruction* self = nullptr;
  std::vector<const ElementConstruction*> ordre;
  bool later = false;
  int pos = -2;
  TopoDS_Shape solide;
  std::vector<AreteListee> aretes;
  std::map<std::string, std::string> alias;
  bool aAretes = false;
  explicit Contexte(Document& x) : d(x) {}
};

const TopoDS_Shape& solideDe(Contexte& c) {  // cgShapeFor
  const int p = c.self ? rangConstruction(c.d, *c.self) : static_cast<int>(c.d.fonctions.size()) - 1;
  if (p != c.pos) {
    c.pos = p;
    c.aAretes = false;
    c.aretes.clear();
    c.alias.clear();
    c.solide = TopoDS_Shape();
    try {
      c.solide = rejouerSansConstruction(c.d, p + 1).forme;
    } catch (const std::exception&) {
    } catch (const Standard_Failure&) {
    }
  }
  return c.solide;
}

std::vector<P2d> ptsEntite(const Esquisse& s, const Entite& e) {  // cgSkEntPts
  std::vector<P2d> o;
  if (e.t == "line") {
    const Pt* A = s.point(e.p1);
    const Pt* B = s.point(e.p2);
    if (A && B) o = {{A->x, A->y}, {B->x, B->y}};
  } else if (e.t == "circle" || e.t == "arc") {
    const Pt* C = s.point(e.pc);
    if (!C || !(e.r > 0)) return o;
    double a1 = 0, a2 = 2 * PI;
    if (e.t == "arc") {
      const auto an = anglesArc(s, e);
      if (!an) return o;
      a1 = an->a1;
      a2 = an->a2;
    }
    const int m = std::max(8, static_cast<int>(std::ceil(256 * std::abs(a2 - a1) / (2 * PI))));
    for (int i = 0; i <= m; i++) {
      const double a = a1 + (a2 - a1) * i / m;
      o.push_back({C->x + std::cos(a) * e.r, C->y + std::sin(a) * e.r});
    }
  } else if (e.t == "spline") {
    BSpline f;
    if (splineDe(s, e, f)) o = bsSample(f, f.a, f.b, 64);
  }
  return o;
}

struct PointCourbe {
  Vec3 o, d;
};
PointCourbe courbeEn(const Courbe& C, double t) {  // cgCurveAt
  const auto& P = C.pts;
  const int n = static_cast<int>(P.size());
  if (n < 2) throw std::runtime_error("courbe vide");
  std::vector<double> S{0};
  for (int i = 1; i < n; i++) S.push_back(S[i - 1] + len(sub(P[i], P[i - 1])));
  const double L = S[n - 1];
  if (!(L > 1e-9)) throw std::runtime_error("courbe de longueur nulle");
  const double s = std::max(0.0, std::min(1.0, std::isfinite(t) ? t : 0.0)) * L;
  int k = 1;
  while (k < n - 1 && S[k] < s) k++;
  const double g = (S[k] - S[k - 1]) > 1e-12 ? (s - S[k - 1]) / (S[k] - S[k - 1]) : 0;
  const bool ferme = len(sub(P[0], P[n - 1])) < 1e-9 * std::max(1.0, L);
  const auto tan = [&](int i) -> Vec3 {
    if (i == 0 || i == n - 1) {
      if (ferme) return unit(sub(P[1], P[n - 2]));
      if (n < 3) return unit(sub(P[1], P[0]));
      const Vec3& a = i ? P[n - 1] : P[0];
      const Vec3& b = i ? P[n - 2] : P[1];
      const Vec3& c = i ? P[n - 3] : P[2];
      const Vec3 d = sub(mul(sub(b, a), 4), sub(c, a));
      return unit(i ? mul(d, -1) : d);
    }
    return unit(sub(P[i + 1], P[i - 1]));
  };
  return {add(P[k - 1], mul(sub(P[k], P[k - 1]), g)), unit(add(mul(tan(k - 1), 1 - g), mul(tan(k), g)))};
}

const ElementConstruction* elementDe(const Document& d, const std::string& id) {
  for (const ElementConstruction& e : d.construction)
    if (e.id == id) return &e;
  return nullptr;
}
const Esquisse* esquisseDeId(const Document& d, const std::string& id) {
  for (const Esquisse& s : d.esquisses)
    if (s.id == id) return &s;
  return nullptr;
}

Courbe courbeArete(const TopoDS_Shape& shape, const AreteListee& E) {  // cgEdgeCurve
  try {
    int rang = 0;
    for (TopExp_Explorer ex(shape, TopAbs_EDGE); ex.More(); ex.Next(), rang++)
      if (rang == E.src) {
        BRepAdaptor_Curve ad(TopoDS::Edge(ex.Current()));
        const double u0 = ad.FirstParameter(), u1 = ad.LastParameter();
        Courbe c;
        for (int i = 0; i <= 400; i++) {
          const gp_Pnt p = ad.Value(u0 + (u1 - u0) * i / 400);
          c.pts.push_back({p.X(), p.Y(), p.Z()});
        }
        return c;
      }
  } catch (const Standard_Failure&) {
  }
  return {E.pts};
}

std::optional<Formes> evaluerModele(json& ref, Contexte& c) {  // cgEvalModelRef
  const TopoDS_Shape& shape = solideDe(c);
  if (shape.IsNull()) return std::nullopt;
  const std::string k = str(ref, "k");
  if (k == "face") {
    try {
      if (!ref.contains("ref") || !ref["ref"].is_object()) return std::nullopt;
      const RefFace rf = lireRefFaceJson(ref["ref"]);
      const auto f = trouverFaceLibre(c.d, shape, rf);
      if (!f) return std::nullopt;
      if (!rf.nom.empty()) ref["ref"]["nom"] = rf.nom;
      Vec3 pos{}, dim{};
      boiteFace(*f, pos, dim);
      BRepAdaptor_Surface ad(*f, true);
      const GeomAbs_SurfaceType gt = ad.GetType();
      Formes g;
      if (gt == GeomAbs_Plane) {
        const auto n = normaleDeFace(*f);
        if (!n) return std::nullopt;
        const Base B = baseN({n->X(), n->Y(), n->Z()}, nullptr);
        g.plane = Plan{pos, B.u, B.v, B.n};
        g.point = pos;
        return g;
      }
      if (gt == GeomAbs_Cylinder || gt == GeomAbs_Cone) {
        const gp_Ax1 ax = gt == GeomAbs_Cylinder ? ad.Cylinder().Axis() : ad.Cone().Axis();
        const Vec3 d = unit({ax.Direction().X(), ax.Direction().Y(), ax.Direction().Z()}), lo{ax.Location().X(), ax.Location().Y(), ax.Location().Z()};
        const Vec3 o = add(lo, mul(d, dot(sub(pos, lo), d)));
        Axe A{o, d};
        if (gt == GeomAbs_Cylinder) {
          A.r = ad.Cylinder().Radius();
          double v0 = dot(sub(add(lo, mul(d, ad.FirstVParameter())), o), d), v1 = dot(sub(add(lo, mul(d, ad.LastVParameter())), o), d);
          if (v0 > v1) std::swap(v0, v1);
          A.t0 = v0;
          A.t1 = v1;
        }
        g.axis = A;
        g.point = o;
        return g;
      }
      g.point = pos;
      return g;
    } catch (const Standard_Failure&) {
      return std::nullopt;
    } catch (const std::exception&) {
      return std::nullopt;
    }
  }
  if (k != "edge" && k != "vtx") return std::nullopt;
  if (!c.aAretes) {
    c.aAretes = true;
    try {
      c.aretes = listerAretes(shape);
      c.alias = nomsSurAretes(shape, c.aretes);
    } catch (const Standard_Failure&) {
      c.aretes.clear();
    } catch (const std::exception&) {
      c.aretes.clear();
    }
  }
  const int i = chercherAreteParReference(c.d, ref, c.aretes, c.alias);
  if (i < 0) return std::nullopt;
  const AreteListee& E = c.aretes[i];
  const auto arrondi4 = [](const Vec3& v) {
    json a = json::array();
    for (double x : v) a.push_back(std::round(x * 1e4) / 1e4);
    return a;
  };
  ref["pos"] = arrondi4(E.mid);
  ref["len"] = std::round(E.len * 1e4) / 1e4;
  Formes g;
  if (k == "vtx") {
    const Vec3 a = E.pts.front(), b = E.pts.back();
    const Vec3 q = ref.contains("vpos") ? lireV(ref, "vpos") : a;
    const Vec3 o = len(sub(a, q)) <= len(sub(b, q)) ? a : b;
    ref["vpos"] = arrondi4(o);
    g.point = o;
    return g;
  }
  const GeoArete G = geoArete(E.pts);
  if (!G.droite && !G.cercle) g.point = E.mid;
  else if (G.droite) {
    g.axis = Axe{E.mid, sub(G.b, G.a)};
    g.point = E.mid;
  } else {
    const Base B = baseN(G.n, nullptr);
    g.point = G.c;
    g.axis = Axe{G.c, G.n};
    g.plane = Plan{G.c, B.u, B.v, B.n};
  }
  if (G.droite) g.curve = Courbe{{E.pts.front(), E.pts.back()}};
  else {
    const AreteListee copie = E;
    const TopoDS_Shape forme = shape;
    g.courbeTardive = [copie, forme] { return courbeArete(forme, copie); };
  }
  return g;
}

std::optional<Formes> evaluerRef(json& ref, Contexte* c) {  // cgEvalRef
  if (!ref.is_object()) return std::nullopt;
  const std::string k = str(ref, "k");
  if (k == "o") {
    const std::string id = str(ref, "id");
    Formes g;
    g.point = Vec3{0, 0, 0};
    if (id == "XY") g.plane = Plan{{0, 0, 0}, {1, 0, 0}, {0, 1, 0}, {0, 0, 1}};
    else if (id == "XZ") g.plane = Plan{{0, 0, 0}, {1, 0, 0}, {0, 0, 1}, {0, -1, 0}};
    else if (id == "YZ") g.plane = Plan{{0, 0, 0}, {0, 1, 0}, {0, 0, 1}, {1, 0, 0}};
    else if (id == "X" || id == "Y" || id == "Z") g.axis = *sousRepere(REPERE0, id).axis;
    else if (id == "O") g.frame = REPERE0;
    else return std::nullopt;
    return g;
  }
  if (!c) return std::nullopt;
  if (k == "cg") {
    const ElementConstruction* el = elementDe(c->d, str(ref, "id"));
    Repere F;
    if (!el || !lireRepere(el->j, F)) return std::nullopt;
    if (c->self) {
      const auto a = std::find(c->ordre.begin(), c->ordre.end(), el), b = std::find(c->ordre.begin(), c->ordre.end(), c->self);
      if (a > b) c->later = true;
    }
    const std::string s = str(ref, "sub");
    if (!s.empty() && el->kind == "frame") {
      Formes g = sousRepere(F, s);
      g.point = F.o;
      if (g.plane || g.axis) return g;
    }
    return formesDe(el->j);
  }
  if (k == "skent") {
    const Esquisse* sk = esquisseDeId(c->d, str(ref, "sk"));
    if (!sk) return std::nullopt;
    if (c->self && sk->plan == "CG" && sk->plan_cg == c->self->id) return std::nullopt;  // esquisse posée sur ce plan : boucle
    const Entite* e = sk->entite(str(ref, "e"));
    if (!e) return std::nullopt;
    const auto P2 = ptsEntite(*sk, *e);
    if (P2.size() < 2) return std::nullopt;
    Courbe C;
    for (const P2d& q : P2) C.pts.push_back(add(add(sk->o, mul(sk->u, q[0])), mul(sk->v, q[1])));
    Formes g;
    g.point = courbeEn(C, 0.5).o;
    if (e->t == "line") g.axis = Axe{*g.point, sub(C.pts[1], C.pts[0])};
    g.curve = std::move(C);
    return g;
  }
  if (k == "skpt") {
    const Esquisse* sk = esquisseDeId(c->d, str(ref, "sk"));
    if (!sk) return std::nullopt;
    const Pt* q = sk->point(str(ref, "pt"));
    if (!q) return std::nullopt;
    Formes g;
    g.point = add(add(sk->o, mul(sk->u, q->x)), mul(sk->v, q->y));
    return g;
  }
  if (k == "xf") {  // asmXfEval
    assemblage::FaceCapturee E;
    assemblage::Repere F;
    if (!assemblage::faceExterne(c->d, ref, E, F)) return std::nullopt;
    Formes g;
    if (E.plan) {
      const Vec3 o = assemblage::appliquer(F, E.o);
      const Base B = baseN(assemblage::tourner(F, E.n), nullptr);
      g.plane = Plan{o, B.u, B.v, B.n};
      g.point = o;
    } else {
      const Vec3 o = assemblage::appliquer(F, E.ao);
      g.axis = Axe{o, unit(assemblage::tourner(F, E.ad))};
      g.point = o;
    }
    return g;
  }
  if (k == "xe") {  // asmXeEval
    AreteListee E;
    assemblage::Repere F;
    if (!assemblage::areteExterne(c->d, ref, E, F)) return std::nullopt;
    const auto Pp = [&](const Vec3& p) { return assemblage::appliquer(F, p); };
    const auto Vv = [&](const Vec3& v) { return assemblage::tourner(F, v); };
    Formes g;
    if (str(ref, "sub") == "vtx") {
      const Vec3 a = E.pts.front(), b = E.pts.back();
      const Vec3 q = ref.contains("vpos") ? lireV(ref, "vpos") : a;
      const Vec3 o = len(sub(a, q)) <= len(sub(b, q)) ? a : b;
      ref["vpos"] = json::array({std::round(o[0] * 1e4) / 1e4, std::round(o[1] * 1e4) / 1e4, std::round(o[2] * 1e4) / 1e4});
      g.point = Pp(o);
      return g;
    }
    const GeoArete G = geoArete(E.pts);
    if (G.droite) {
      g.axis = Axe{Pp(E.mid), unit(Vv(sub(G.b, G.a)))};
      g.point = Pp(E.mid);
    } else if (G.cercle) {
      const Vec3 o = Pp(G.c);
      const Base B = baseN(Vv(G.n), nullptr);
      g.point = o;
      g.axis = Axe{o, B.n};
      g.plane = Plan{o, B.u, B.v, B.n};
    } else {
      g.point = Pp(E.mid);
    }
    return g;
  }
  return evaluerModele(ref, *c);
}

double numero(const json& el, const char* k) {
  const auto p = el.find("p");
  if (p == el.end() || !p->is_object()) return 0;
  const auto x = p->find(k);
  if (x == p->end()) return 0;
  double v = 0;
  if (x->is_number()) v = x->get<double>();
  else if (x->is_string()) {
    try {
      v = std::stod(x->get<std::string>());
    } catch (const std::exception&) {
      v = 0;
    }
  }
  return std::isfinite(v) ? v : 0;
}

Repere frPlan(const Vec3& o, const Vec3& u, const Vec3& v, const Vec3& n) { return {o, unit(u), unit(v), unit(n)}; }
Repere frAxe(const Vec3& o, const Vec3& d) {
  const Vec3 z = unit(d);
  const Base B = baseN(z, nullptr);
  return {o, B.u, B.v, z};
}
struct Ortho {
  Vec3 x, y, z;
  std::string warn;
};
Ortho ortho(Vec3 z, const Vec3* indice) {  // cgOrtho
  z = unit(z);
  Ortho r;
  Vec3 x{};
  bool a = false;
  if (indice) {
    x = sub(*indice, mul(z, dot(z, *indice)));
    a = len(x) >= 1e-8;
    if (!a) r.warn = "X parallèle à Z : X remplacé";
  }
  if (!a) x = baseN(z, nullptr).u;
  x = unit(x);
  r.x = x;
  r.y = cross(z, x);
  r.z = z;
  return r;
}

double axialDe(const json& ref, const Formes& g, const Vec3& o, const Vec3& d) {  // cgAxialOf
  const std::string k = str(ref, "k");
  const bool arete = k == "edge" || k == "vtx" || k == "xe";
  if (g.plane && !arete) {
    const Vec3 n = unit(g.plane->n);
    const double den = dot(n, d);
    if (std::abs(den) < 1e-6) throw std::runtime_error("face parallèle à l’axe du cylindre : cote impossible");
    return dot(n, sub(g.plane->o, o)) / den;
  }
  if (g.point) return dot(sub(*g.point, o), d);
  if (g.axis) return dot(sub(g.axis->o, o), d);
  throw std::runtime_error("référence de cote inutilisable");
}
Vec3 sensCylindre(const Vec3& d) {  // cgCylDir
  const Vec3 u = unit(d);
  for (int i = 0; i < 3; i++)
    if (std::abs(u[i]) > 1e-9) return u[i] < 0 ? mul(u, -1) : u;
  return u;
}

// kwPlaneOff (src/76-clavette) : ISO 773 pour le Ø de l'arbre
struct LigneIso773 {
  double de, a, b, h, t1, t2, l0, l1;
};
const LigneIso773 ISO773[] = {{6, 8, 2, 2, 1.2, 1, 6, 20}, {8, 10, 3, 3, 1.8, 1.4, 6, 36}, {10, 12, 4, 4, 2.5, 1.8, 8, 45}, {12, 17, 5, 5, 3, 2.3, 10, 56},
                              {17, 22, 6, 6, 3.5, 2.8, 14, 70}, {22, 30, 8, 7, 4, 3.3, 18, 90}, {30, 38, 10, 8, 5, 3.3, 22, 110}, {38, 44, 12, 8, 5, 3.3, 28, 140},
                              {44, 50, 14, 9, 5.5, 3.8, 36, 160}, {50, 58, 16, 10, 6, 4.3, 45, 180}, {58, 65, 18, 11, 7, 4.4, 50, 200}, {65, 75, 20, 12, 7.5, 4.9, 56, 220},
                              {75, 85, 22, 14, 9, 5.4, 63, 250}, {85, 95, 25, 14, 9, 5.4, 70, 280}, {95, 110, 28, 16, 10, 6.4, 80, 320}, {110, 130, 32, 18, 11, 7.4, 90, 360}};
double decalageClavette(const json& kw, double R) {
  const auto nb = [&](const char* k) {
    const auto x = kw.find(k);
    return x != kw.end() && x->is_number() ? x->get<double>() : 0.0;
  };
  const auto bore = kw.find("bore");
  const bool alesage = bore != kw.end() && bore->is_boolean() && bore->get<bool>();
  if (!alesage) return 1;  // KW_OVER
  const double D = 2 * R;
  const LigneIso773* row = nullptr;
  for (size_t i = 0; i < sizeof ISO773 / sizeof ISO773[0] && !row; i++)
    if ((i == 0 ? D >= ISO773[i].de : D > ISO773[i].de) && D <= ISO773[i].a) row = &ISO773[i];
  const auto iso = kw.find("iso");
  const bool vieux = iso != kw.end() && iso->is_boolean() && !iso->get<bool>();
  if (nb("ot") > 0) return nb("ot");
  if (vieux && nb("t") > 0) return nb("t");
  if (row) return row->t2;
  double b = nb("ob") > 0 ? nb("ob") : vieux && nb("b") > 0 ? nb("b") : std::round(std::max(1.0, D / 4) * 10) / 10;
  return std::round(b * 0.4 * 10) / 10;
}

struct Bati {
  Repere fr;
  std::string warn;
};
Bati batir(ElementConstruction& el, Contexte& ctx) {  // cgBuild
  json& J = el.j;
  if (!J.contains("refs") || !J["refs"].is_array()) J["refs"] = json::array();
  json& refs = J["refs"];
  const auto eval = [&](size_t i) -> std::optional<Formes> {
    if (i >= refs.size() || !refs[i].is_object()) return std::nullopt;
    return evaluerRef(refs[i], &ctx);
  };
  const auto slot = [&](size_t i, bool option) -> std::optional<Formes> {
    const bool la = i < refs.size() && refs[i].is_object();
    if (!la) {
      if (option) return std::nullopt;
      throw std::runtime_error("référence " + std::to_string(i + 1) + " manquante");
    }
    auto g = eval(i);
    if (!g) {
      const std::string k = str(refs[i], "k");
      if (k == "cg") throw std::runtime_error("référence " + std::to_string(i + 1) + " supprimée ou non résolue");
      if (k == "xf") throw std::runtime_error("référence " + std::to_string(i + 1) + " : face de l’autre composant introuvable — position mémorisée");
      if (k == "xe") throw std::runtime_error("référence " + std::to_string(i + 1) + " : arête de l’autre composant introuvable — position mémorisée");
      throw std::runtime_error("référence " + std::to_string(i + 1) + " introuvable — la pièce a changé");
    }
    return g;
  };
  const auto refuse = [](size_t i, const char* q) { return std::runtime_error("référence " + std::to_string(i + 1) + " : ce n’est pas " + q); };
  const auto P = [&](size_t i) -> Plan {
    auto g = slot(i, false);
    if (!g->plane) throw refuse(i, "un plan");
    return *g->plane;
  };
  const auto A = [&](size_t i) -> Axe {
    auto g = slot(i, false);
    if (!g->axis) throw refuse(i, "un axe");
    return *g->axis;
  };
  const auto Ao = [&](size_t i) -> std::optional<Axe> {
    auto g = slot(i, true);
    if (!g) return std::nullopt;
    if (!g->axis) throw refuse(i, "un axe");
    return g->axis;
  };
  const auto Pt3 = [&](size_t i) -> Vec3 {
    auto g = slot(i, false);
    if (!g->point) throw refuse(i, "un point");
    return *g->point;
  };
  const auto Pto = [&](size_t i) -> std::optional<Vec3> {
    auto g = slot(i, true);
    if (!g) return std::nullopt;
    if (!g->point) throw refuse(i, "un point");
    return g->point;
  };
  const auto Cb = [&](size_t i) -> Courbe {
    auto g = slot(i, false);
    if (g->curve) return *g->curve;
    if (g->courbeTardive) return g->courbeTardive();
    throw refuse(i, "une courbe");
  };
  const auto N = [&](const char* k) { return numero(J, k); };
  bool flip = false;
  if (auto p = J.find("p"); p != J.end() && p->is_object())
    if (auto f = p->find("flip"); f != p->end()) flip = f->is_boolean() ? f->get<bool>() : f->is_number() && f->get<double>() != 0;
  const std::string how = str(J, "how");
  Repere fr{};
  bool fait = false;
  std::string warn;
  const auto X = [&]() -> Repere {  // asmExtFrame
    const auto xe = J.find("ext");
    assemblage::Repere F;
    if (xe == J.end() || !xe->is_object() || !assemblage::repereExterne(ctx.d, *xe, F)) throw std::runtime_error("référence externe introuvable : position mémorisée");
    Repere R{F.o, F.x, F.y, F.z};
    (*xe)["last"] = {{"o", jv(R.o)}, {"x", jv(R.x)}, {"y", jv(R.y)}, {"z", jv(R.z)}};
    return R;
  };
  if (how == "ext") {
    const auto xe = J.find("ext");
    Repere gele;
    if (xe != J.end() && xe->is_object() && xe->value("frozen", false) && lireRepere(J, gele)) {
      Bati b;
      b.fr = gele;
      return b;
    }
  }
  if (el.kind == "plane") {
    fait = true;
    if (how == "ext") {
      const Repere F = X();
      fr = frPlan(F.o, F.x, F.y, F.z);
    } else if (how == "offset") {
      const Plan p = P(0);
      fr = frPlan(add(p.o, mul(p.n, N("d"))), p.u, p.v, p.n);
    } else if (how == "angle") {
      const Plan p = P(0);
      const Axe ax = A(1);
      const Vec3 d = unit(ax.d);
      if (std::abs(dot(d, unit(p.n))) > 1e-6) warn = "axe non contenu dans le plan : rotation autour de l’axe quand même";
      const double a = N("a") * PI / 180;
      const Vec3 o = add(ax.o, mul(d, dot(sub(p.o, ax.o), d)));
      fr = frPlan(o, rotDir(p.u, d, a), rotDir(p.v, d, a), rotDir(p.n, d, a));
    } else if (how == "3pts") {
      const Vec3 a = Pt3(0), b = Pt3(1), c = Pt3(2);
      const Vec3 n = cross(sub(b, a), sub(c, a));
      if (len(n) < 1e-9 * std::max(1.0, len(sub(b, a)) * len(sub(c, a)))) throw std::runtime_error("points alignés : aucun plan unique");
      const Vec3 u = unit(sub(b, a));
      fr = frPlan(a, u, cross(unit(n), u), n);
    } else if (how == "mid") {
      const Plan p = P(0), q = P(1);
      const Vec3 n1 = unit(p.n);
      Vec3 n2 = unit(q.n);
      if (dot(n1, n2) < 0) n2 = mul(n2, -1);
      if (dot(n1, n2) < 1 - 1e-6) throw std::runtime_error("plans non parallèles : pas de plan médian");
      const double e = dot(n1, sub(q.o, p.o));
      fr = frPlan(add(p.o, mul(n1, e / 2)), p.u, p.v, n1);
    } else if (how == "normal") {
      const Axe ax = A(0);
      const auto pt = Pto(1);
      const Vec3 n = unit(ax.d);
      const Base B = baseN(n, nullptr);
      fr = frPlan(pt ? *pt : ax.o, B.u, B.v, n);
    } else if (how == "curve") {
      const double t = N("t");
      if (t < 0 || t > 1) warn = "position hors de [0 ; 1] : ramenée au bout";
      const PointCourbe K = courbeEn(Cb(0), t);
      const Base B = baseN(K.d, nullptr);
      fr = frPlan(K.o, B.u, B.v, K.d);
    } else if (how == "tangent") {  // cgTangentBuild
      const Axe ax = A(0);
      if (!(ax.r > 0)) throw std::runtime_error("choisissez une face cylindrique");
      const Vec3 d = sensCylindre(ax.d);
      std::vector<std::string> w;
      const auto evalRef = [&](size_t i, const char* lab) -> std::optional<Formes> {
        if (i >= refs.size() || !refs[i].is_object()) return std::nullopt;
        auto g = eval(i);
        if (!g) throw std::runtime_error(std::string(lab) + " introuvable — la pièce a changé");
        return g;
      };
      const auto gD = evalRef(1, "direction");
      Vec3 D0 = baseN(d, nullptr).u;
      if (gD) {
        if (gD->axis) D0 = gD->axis->d;
        else if (gD->plane) D0 = gD->plane->n;
        else throw std::runtime_error("la direction doit être un axe, une arête droite ou une face plane");
      }
      const Vec3 pr = sub(unit(D0), mul(d, dot(unit(D0), d)));
      if (len(pr) < 1e-6) throw std::runtime_error("direction parallèle à l’axe du cylindre");
      const Vec3 n = unit(rotDir(unit(pr), d, N("a") * PI / 180));
      const auto gP = evalRef(2, "référence de cote");
      const double t0 = gP ? axialDe(refs[2], *gP, ax.o, d) : 0;
      const double t = t0 + N("d") * (N("side") < 0 ? -1 : 1), e = N("e");
      if (std::abs(e) > ax.r) w.push_back("décalage latéral plus grand que le rayon : le trou manque le cylindre");
      const double hR = ax.r + (J.contains("kw") && J["kw"].is_object() ? decalageClavette(J["kw"], ax.r) : 0);
      const Vec3 o = add(add(add(ax.o, mul(d, t)), mul(n, hR)), mul(cross(n, d), e));
      if (!w.empty()) warn = w[0];
      fr = frPlan(o, d, cross(n, d), n);
    } else {
      fait = false;
    }
    if (fait && flip) {
      fr.y = mul(fr.y, -1);
      fr.z = mul(fr.z, -1);
    }
  } else if (el.kind == "axis") {
    Vec3 o{}, d{};
    fait = true;
    if (how == "ext") {
      const Repere F = X();
      o = F.o;
      d = F.z;
    } else if (how == "ref") {
      const Axe ax = A(0);
      o = ax.o;
      d = ax.d;
    } else if (how == "2pts") {
      const Vec3 a = Pt3(0), b = Pt3(1);
      if (len(sub(b, a)) < 1e-9) throw std::runtime_error("points confondus");
      o = a;
      d = sub(b, a);
    } else if (how == "inter") {
      const Plan p = P(0), q = P(1);
      const Vec3 n1 = unit(p.n), n2 = unit(q.n);
      d = cross(n1, n2);
      if (len(d) < 1e-9) throw std::runtime_error("plans parallèles : pas d’intersection");
      const double c1 = dot(n1, p.o), c2 = dot(n2, q.o), k = dot(n1, n2), den = 1 - k * k;
      const Vec3 p0 = add(mul(n1, (c1 - c2 * k) / den), mul(n2, (c2 - c1 * k) / den));
      const Vec3 du = unit(d), m = mul(add(p.o, q.o), 0.5);
      o = add(p0, mul(du, dot(sub(m, p0), du)));
    } else if (how == "normal") {
      const Plan p = P(0);
      const Vec3 pt = Pt3(1), n = unit(p.n);
      o = sub(pt, mul(n, dot(sub(pt, p.o), n)));
      d = n;
    } else {
      fait = false;
    }
    if (fait) {
      if (flip) d = mul(d, -1);
      fr = frAxe(o, d);
    }
  } else if (el.kind == "point") {
    Vec3 o{};
    fait = true;
    if (how == "ext") o = X().o;
    else if (how == "ref") o = Pt3(0);
    else if (how == "xyz") {
      auto g = slot(0, true);
      if (g && !g->frame) throw refuse(0, "un repère");
      const Repere F = g ? *g->frame : REPERE0;
      o = add(add(add(F.o, mul(F.x, N("dx"))), mul(F.y, N("dy"))), mul(F.z, N("dz")));
    } else if (how == "inter") {
      const Axe ax = A(0);
      const Plan p = P(1);
      const Vec3 d = unit(ax.d), n = unit(p.n);
      const double den = dot(n, d);
      if (std::abs(den) < 1e-9) throw std::runtime_error("axe parallèle au plan : pas d’intersection");
      o = add(ax.o, mul(d, dot(n, sub(p.o, ax.o)) / den));
    } else {
      fait = false;
    }
    if (fait) fr = {o, {1, 0, 0}, {0, 1, 0}, {0, 0, 1}};
  } else if (el.kind == "frame") {
    Vec3 O{};
    Ortho R;
    fait = true;
    if (how == "ext") {
      const Repere F = X();
      O = F.o;
      R.x = F.x;
      R.y = F.y;
      R.z = F.z;
    } else if (how == "zx") {
      O = Pt3(0);
      const Axe Z = A(1);
      const auto X = Ao(2);
      R = ortho(Z.d, X ? &X->d : nullptr);
    } else if (how == "face") {
      const Plan p = P(0);
      const auto X = Ao(1);
      O = p.o;
      const Vec3 ind = X ? X->d : p.u;
      R = ortho(p.n, &ind);
    } else if (how == "3pts") {
      const Vec3 a = Pt3(0), b = Pt3(1), c = Pt3(2);
      const Vec3 X = sub(b, a), Z = cross(X, sub(c, a));
      if (len(X) < 1e-9) throw std::runtime_error("origine et point sur X confondus");
      if (len(Z) < 1e-9 * std::max(1.0, len(X) * len(sub(c, a)))) throw std::runtime_error("points alignés : plan XY indéfini");
      O = a;
      R = ortho(Z, &X);
    } else {
      fait = false;
    }
    if (fait) {
      warn = R.warn;
      Vec3 x = R.x, y = R.y, z = R.z;
      if (flip) {
        z = mul(z, -1);
        y = mul(y, -1);
      }
      const double rz = N("rz") * PI / 180;
      if (rz != 0) {
        const double c = std::cos(rz), s = std::sin(rz);
        const Vec3 xn = add(mul(x, c), mul(y, s));
        y = add(mul(y, c), mul(x, -s));
        x = xn;
      }
      O = add(add(add(O, mul(x, N("dx"))), mul(y, N("dy"))), mul(z, N("dz")));
      fr = {O, x, y, z};
    }
  }
  if (!fait) throw std::runtime_error("méthode inconnue : " + how);
  return {fr, warn};
}

/* ----- rainure de clavette (src/76-clavette) ----- */
struct DimsClavette {
  double b = 0, t = 0, h = 0, kb = 0;
  const LigneIso773* row = nullptr;
  bool iso = false;
  std::string warn;
};
double nbJ(const json& j, const char* k) {
  const auto x = j.find(k);
  return x != j.end() && x->is_number() ? x->get<double>() : 0.0;
}
bool ouiJ(const json& j, const char* k) {
  const auto x = j.find(k);
  return x != j.end() && x->is_boolean() && x->get<bool>();
}
double dec1(double v) { return std::round(v * 10) / 10; }
std::string stdF(double v) {  // String(+v.toFixed(3)) à virgule
  char b[64];
  snprintf(b, sizeof b, "%.3f", v);
  std::string s = b;
  while (!s.empty() && s.back() == '0') s.pop_back();
  if (!s.empty() && s.back() == '.') s.pop_back();
  std::replace(s.begin(), s.end(), '.', ',');
  return s;
}
const LigneIso773* ligneIso773(double D) {
  for (size_t i = 0; i < sizeof ISO773 / sizeof ISO773[0]; i++)
    if ((i == 0 ? D >= ISO773[i].de : D > ISO773[i].de) && D <= ISO773[i].a) return &ISO773[i];
  return nullptr;
}
DimsClavette dimsClavette(const json& kw, double D) {  // kwDims
  DimsClavette r;
  r.row = ligneIso773(D);
  const auto iso = kw.find("iso");
  const bool vieux = iso != kw.end() && iso->is_boolean() && !iso->get<bool>();
  const bool bore = ouiJ(kw, "bore");
  const auto pick = [&](const char* o, const char* leg, double isoV, double fb) { return nbJ(kw, o) > 0 ? nbJ(kw, o) : vieux && nbJ(kw, leg) > 0 ? nbJ(kw, leg) : r.row ? isoV : fb; };
  r.b = pick("ob", "b", r.row ? r.row->b : 0, dec1(std::max(1.0, D / 4)));
  r.t = pick("ot", "t", r.row ? (bore ? r.row->t2 : r.row->t1) : 0, dec1(r.b * (bore ? 0.4 : 0.6)));
  r.h = pick("oh", "h", r.row ? r.row->h : 0, dec1(r.b * 0.9));
  r.kb = nbJ(kw, "okb") > 0 ? nbJ(kw, "okb") : r.b;
  const bool libre = nbJ(kw, "ob") > 0 && nbJ(kw, "ot") > 0 && nbJ(kw, "oh") > 0;
  r.iso = r.row && !vieux && !(nbJ(kw, "ob") > 0 || nbJ(kw, "ot") > 0 || nbJ(kw, "oh") > 0 || nbJ(kw, "okb") > 0);
  if (!r.row && !vieux && !libre) r.warn = "Ø " + stdF(D) + " hors d’ISO 773 (6 à 130) : cotes à vérifier";
  return r;
}
const double KW_OVER = 1;
double autoLongueur(const json& kw, double D, double Lc, const LigneIso773* row) {  // kwAutoLen
  static const double LV[] = {6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 63, 70, 80, 90, 100, 110, 125, 140, 160, 180, 200, 220, 250, 280, 320, 360};
  const double room = std::max(0.0, Lc - (str(kw, "form") == "C" ? 0 : 2)), top = std::min(room, 1.5 * D);
  double L = 0, premier = -1;
  for (double v : LV) {
    if (row && (v < row->l0 || v > row->l1)) continue;
    if (premier < 0) premier = v;
    if (v <= top + 1e-9) L = v;
  }
  return L != 0 ? L : std::min(room, premier >= 0 ? premier : room);
}
struct PtBoucle {
  double x, y;
  bool arc = false;
  double cx = 0, cy = 0;
};
std::vector<PtBoucle> boucleClavette(const std::string& form, double h, double x0, double x1, double L, int open) {  // kwLoop
  if (form == "T") return {{x0, -h}, {x1, -h}, {x1, h}, {x0, h}};
  if (form == "C") {
    if (open > 0) {
      const double c = x1 - L + h;
      return {{x1, -h}, {x1, h}, {c, h}, {c, -h, true, c, 0}};
    }
    const double c = x0 + L - h;
    return {{x0, -h}, {c, -h}, {c, h, true, c, 0}, {x0, h}};
  }
  const double a = L / 2;
  if (form == "B") return {{-a, -h}, {a, -h}, {a, h}, {-a, h}};
  const double m = a - h;
  return {{-m, -h}, {m, -h}, {m, h, true, m, 0}, {-m, h}, {-m, -h, true, -m, 0}};
}
// stdLoop : le contour réécrit, seulement si ses cotes ont changé : un fichier relu ne devient pas « modifié »
void poserBoucle(Esquisse& s, const std::vector<PtBoucle>& pts) {
  Esquisse t = s;
  t.points.clear();
  t.ordre.clear();
  t.entites.clear();
  t.contraintes.clear();
  t.cotes.clear();
  t.seq = 1;
  const auto point = [&](double x, double y) {
    const std::string id = "p" + std::to_string(t.seq++);
    Pt p;
    p.x = x;
    p.y = y;
    t.points[id] = p;
    t.ordre.push_back(id);
    return id;
  };
  std::vector<std::string> ids;
  for (const PtBoucle& p : pts) ids.push_back(point(p.x, p.y));
  for (size_t j = 0; j < pts.size(); j++) {
    const size_t i = (j + pts.size() - 1) % pts.size();
    const PtBoucle& q = pts[j];
    Entite e;
    if (q.arc) {
      const std::string pc = point(q.cx, q.cy);
      e.id = "e" + std::to_string(t.seq++);
      e.t = "arc";
      e.pc = pc;
      e.pa = ids[i];  // ccw : du sommet précédent à celui-ci
      e.pb = ids[j];
      e.r = std::hypot(q.x - q.cx, q.y - q.cy);
    } else {
      e.id = "e" + std::to_string(t.seq++);
      e.t = "line";
      e.p1 = ids[i];
      e.p2 = ids[j];
    }
    t.entites.push_back(std::move(e));
  }
  bool pareil = s.ordre == t.ordre && s.entites.size() == t.entites.size();
  if (pareil)
    for (const std::string& id : t.ordre) {
      const Pt* a = s.point(id);
      const Pt* b = t.point(id);
      pareil = pareil && a && b && std::abs(a->x - b->x) < 1e-6 && std::abs(a->y - b->y) < 1e-6;
    }
  if (pareil)
    for (size_t i = 0; i < t.entites.size(); i++) pareil = pareil && s.entites[i].id == t.entites[i].id && s.entites[i].t == t.entites[i].t && std::abs(s.entites[i].r - t.entites[i].r) < 1e-6;
  if (!pareil) s = std::move(t);
}
Esquisse* esquisseSur(Document& d, const std::string& cg) {  // kwSketchOf
  for (Esquisse& s : d.esquisses)
    if (s.plan == "CG" && s.plan_cg == cg) return &s;
  return nullptr;
}
void poserProfondeurKw(Fonction& f, double v) {
  if (std::abs(f.distance - v) > 1e-9) f.distance = v;
}
void syncClavette(ElementConstruction& el, Contexte& c) {  // kwSync
  if (!el.j.contains("kw") || !el.j["kw"].is_object() || !el.aRepere) return;
  Esquisse* sk = esquisseSur(c.d, el.id);
  if (!sk) return;
  const json& kw = el.j["kw"];
  Fonction* f = nullptr;
  for (Fonction& x : c.d.fonctions)
    if (x.kw && x.esquisse == sk->id) f = &x;
  c.self = &el;
  std::vector<std::string> warn;
  const auto fin = [&] {
    c.self = nullptr;
  };
  try {
    auto g0 = el.j["refs"].size() ? evaluerRef(el.j["refs"][0], &c) : std::nullopt;
    if (!g0 || !g0->axis || !(g0->axis->r > 0) || !(g0->axis->t1 > g0->axis->t0)) return fin();
    const Axe& A = *g0->axis;
    const double R = A.r, D = 2 * R;
    const DimsClavette dm = dimsClavette(kw, D);
    if (!dm.warn.empty()) warn.push_back(dm.warn);
    const Vec3 dd = sensCylindre(A.d);
    const bool rev = dot(dd, unit(A.d)) < 0;
    const double t0 = rev ? -A.t1 : A.t0, t1 = rev ? -A.t0 : A.t1, Lc = t1 - t0;
    const Vec3 o = el.o, z = el.z, y = el.y;
    const double tO = dot(sub(o, A.o), dd), g = dm.b / 2;
    const bool bore = ouiJ(kw, "bore");
    if (!(dm.b < D)) {
      el.kwSortie = {{"D", D}, {"b", dm.b}, {"t", dm.t}, {"h", dm.h}, {"L", 0}, {"iso", dm.iso}, {"warn", "rainure plus large que le cylindre"}};
      return fin();
    }
    if (!bore && !(dm.t < R)) warn.push_back("rainure plus profonde que le rayon");
    const double eLat = dot(sub(o, A.o), y);
    const Vec3 pied = add(A.o, mul(y, eLat));
    const auto at = [&](double t, double rad) { return add(add(pied, mul(dd, t)), mul(z, rad)); };
    bool wall0 = false, wall1 = false, thin = false;
    const TopoDS_Shape& shape = solideDe(c);
    if (!shape.IsNull()) {
      const double rp = bore ? R + dm.t / 2 : R - dm.t / 2;
      try {
        BRepClass3d_SolidClassifier cl(shape);
        const auto dedans = [&](const Vec3& q) {
          cl.Perform(gp_Pnt(q[0], q[1], q[2]), 1e-6);
          return cl.State() == TopAbs_IN;
        };
        wall0 = dedans(at(t0 - 0.2, rp));
        wall1 = dedans(at(t1 + 0.2, rp));
        thin = bore && !dedans(at((t0 + t1) / 2, R + dm.t + 0.2));
      } catch (const Standard_Failure&) {
      }
    }
    if (thin) warn.push_back("moyeu trop mince : la rainure le traverse");
    const double autoL = autoLongueur(kw, D, Lc, dm.row);
    const double asked = nbJ(kw, "L") > 0 ? nbJ(kw, "L") : autoL;
    double L = asked, Lout = asked;
    const double x0 = t0 - tO - (wall0 ? 0 : KW_OVER), x1 = t1 - tO + (wall1 ? 0 : KW_OVER);
    const int open = nbJ(kw, "end") < 0 ? -1 : 1;
    const std::string form = str(kw, "form");
    if (form == "T") Lout = Lc;
    else if (form == "C") {
      if (asked > Lc + 1e-6) warn.push_back("clavette plus longue que le cylindre");
      Lout = std::max(std::min(asked, Lc), g + 0.01);
      L = Lout + (open > 0 ? (wall1 ? 0 : KW_OVER) : (wall0 ? 0 : KW_OVER));
    } else {
      if (form == "A" && L < dm.b + 0.01) Lout = L = dm.b + 0.01;
      if (L > Lc + 1e-6) warn.push_back("clavette plus longue que le cylindre");
      else if (tO - L / 2 < t0 - 1e-6 || tO + L / 2 > t1 + 1e-6) warn.push_back("la rainure dépasse du cylindre");
    }
    poserBoucle(*sk, boucleClavette(form, g, x0, x1, L, open));
    double depth = dm.t + KW_OVER;
    if (bore) {
      const double e = std::abs(eLat) + g, corde = e < R ? std::sqrt(R * R - e * e) : 0;
      depth = dm.t + (R - corde) + KW_OVER;
    }
    const double gk = dm.kb / 2;
    double Lk = nbJ(kw, "okL") > 0 ? nbJ(kw, "okL") : (form == "T" ? std::min(asked, Lc) : Lout);
    if (form == "A" && Lk < dm.kb + 0.01) Lk = dm.kb + 0.01;
    if (form == "C" && Lk < gk + 0.01) Lk = gk + 0.01;
    const bool cle = ouiJ(kw, "key");
    if (cle) {
      if (dm.kb > dm.b + 1e-6) warn.push_back("clavette plus large que la rainure");
      if (form != "T" && Lk > Lout + 1e-6) warn.push_back("clavette plus longue que la rainure");
      else if (Lk > Lc + 1e-6) warn.push_back("clavette plus longue que le cylindre");
    }
    std::vector<PtBoucle> ptsK;
    if (form == "T") {
      const double cx = (t0 + t1) / 2 - tO;
      ptsK = boucleClavette("B", gk, 0, 0, Lk, 1);
      for (PtBoucle& p : ptsK) p.x += cx;
    } else if (form == "C") ptsK = boucleClavette("C", gk, t0 - tO, t1 - tO, Lk, open);
    else ptsK = boucleClavette(form, gk, 0, 0, Lk, open);
    if (cle) {  // kwKeySync
      Fonction* kf = nullptr;
      ElementConstruction* e2 = nullptr;
      for (Fonction& x : c.d.fonctions)
        if (x.kwKey == el.id) kf = &x;
      for (ElementConstruction& x : c.d.construction)
        if (x.j.value("kwKeyOf", std::string()) == el.id) e2 = &x;
      if (kf && e2) {
        const double nd = bore ? 0 : -(dm.t + KW_OVER);
        if (std::abs(numero(e2->j, "d") - nd) > 1e-9) {
          e2->j["p"]["d"] = nd;
          e2->neuf = true;
        }
        poserProfondeurKw(*kf, bore ? -dm.h : dm.h);
        if (Esquisse* sk2 = esquisseSur(c.d, e2->id)) poserBoucle(*sk2, ptsK);
        kf->nom = "Clavette " + stdF(dm.kb) + " × " + stdF(dm.h) + " × " + stdF(Lk);
      }
    }
    std::string w;
    for (size_t i = 0; i < warn.size(); i++) w += (i ? " ; " : "") + warn[i];
    el.kwSortie = {{"D", D}, {"b", dm.b}, {"t", dm.t}, {"h", dm.h}, {"L", Lout}, {"kb", dm.kb}, {"Lk", Lk}, {"iso", dm.iso}, {"warn", w}};
    if (f) {
      poserProfondeurKw(*f, -(std::round(depth * 1e4) / 1e4));
      f->nom = "Rainure de clavette " + stdF(dm.b) + " × " + stdF(Lout) + " (" + (bore ? "alésage" : "arbre") + " Ø" + stdF(D) + ")";
    }
  } catch (const Standard_Failure& e) {
    el.kwSortie["warn"] = e.what();
  } catch (const std::exception& e) {
    el.kwSortie["warn"] = e.what();
  }
  fin();
}

double arrondi(double x, double q) {
  const double y = std::round(x * q) / q;
  return y == 0 ? 0.0 : y;
}
Repere arrondiRepere(const Repere& f) {  // cgRound
  const auto r = [](const Vec3& v, double q) { return Vec3{arrondi(v[0], q), arrondi(v[1], q), arrondi(v[2], q)}; };
  return {r(f.o, 1e6), r(f.x, 1e9), r(f.y, 1e9), r(f.z, 1e9)};
}
bool memeRepere(const Repere& a, const Repere& b) {
  const auto m = [](const Vec3& x, const Vec3& y) {
    for (int i = 0; i < 3; i++)
      if (std::abs(x[i] - y[i]) > 1e-9) return false;
    return true;
  };
  return m(a.o, b.o) && m(a.x, b.x) && m(a.y, b.y) && m(a.z, b.z);
}

void resoudreUn(ElementConstruction& el, Contexte& ctx) {  // cgResolveOne
  ctx.self = &el;
  ctx.later = false;
  std::string st = "ok", msg;
  try {
    const Bati b = batir(el, ctx);
    const Repere fr = arrondiRepere(b.fr);
    std::vector<std::string> t;
    if (!b.warn.empty()) t.push_back(b.warn);
    if (ctx.later) t.push_back("référence à un élément créé après");
    if (!t.empty()) st = "warn";
    for (size_t i = 0; i < t.size(); i++) msg += (i ? " ; " : "") + t[i];
    Repere avant;
    if (!lireRepere(el.j, avant) || !memeRepere(avant, fr)) {
      el.j["fr"] = {{"o", jv(fr.o)}, {"x", jv(fr.x)}, {"y", jv(fr.y)}, {"z", jv(fr.z)}};
      el.neuf = true;
    }
  } catch (const Standard_Failure& e) {
    st = "warn";
    msg = e.what();
  } catch (const std::exception& e) {
    st = "warn";
    msg = e.what();
  }
  ctx.self = nullptr;
  const std::string st0 = str(el.j, "st").empty() ? "ok" : str(el.j, "st");
  if (st != st0 || msg != str(el.j, "msg")) el.neuf = true;
  el.j["st"] = st;
  el.j["msg"] = msg;
  el.lireRepere();
}

bool suivreEsquisse(Document& d, Esquisse& s) {  // cgSyncSketch
  Vec3 o, u, v, n;
  if (!baseDeConstruction(d, s.plan_cg, s.plan_cg_sous, o, u, v, n)) return false;
  for (double& x : o) x = std::round(x * 1e6) / 1e6;
  const auto meme = [](const Vec3& a, const Vec3& b) {
    for (int i = 0; i < 3; i++)
      if (std::abs(a[i] - b[i]) >= 1e-9) return false;
    return true;
  };
  if (meme(s.o, o) && meme(s.u, u) && meme(s.v, v) && meme(s.n, n)) return false;
  s.o = o;
  s.u = u;
  s.v = v;
  s.n = n;
  return true;
}
}  // namespace

int rangConstruction(const Document& d, const ElementConstruction& e) {  // cgPos
  const auto at = e.j.find("at");
  if (at == e.j.end() || !at->is_string()) return -1;
  const std::string& id = at->get_ref<const std::string&>();
  for (size_t i = 0; i < d.fonctions.size(); i++)
    if (d.fonctions[i].id == id) return static_cast<int>(i);
  const auto ai = e.j.find("ai");
  const int F = static_cast<int>(d.fonctions.size());
  return std::min(ai != e.j.end() && ai->is_number() ? ai->get<int>() : F, F) - 1;
}

bool baseDeConstruction(const Document& d, const std::string& id, const std::string& sous, Vec3& o, Vec3& u, Vec3& v, Vec3& n) {  // cgSketchBase
  const ElementConstruction* el = elementDe(d, id);
  Repere F;
  if (!el || !lireRepere(el->j, F)) return false;
  std::optional<Plan> p;
  if (!sous.empty() && el->kind == "frame") p = sousRepere(F, sous).plane;
  else p = formesDe(el->j).plane;
  if (!p) return false;
  o = p->o;
  u = p->u;
  v = p->v;
  n = p->n;
  return true;
}

bool resoudreConstruction(Document& d, int n) {
  if (d.construction.empty()) return false;
  bool bouge = false;
  std::vector<std::pair<int, size_t>> rangs;
  for (size_t k = 0; k < d.construction.size(); k++) rangs.push_back({rangConstruction(d, d.construction[k]), k});
  std::stable_sort(rangs.begin(), rangs.end(), [](const auto& a, const auto& b) { return a.first < b.first; });
  Contexte ctx(d);
  for (const auto& [r, k] : rangs) ctx.ordre.push_back(&d.construction[k]);
  for (const auto& [r, k] : rangs) {
    ElementConstruction& el = d.construction[k];
    el.j["ai"] = r;
    if (auto at = el.j.find("at"); at != el.j.end() && at->is_string()) {  // sa fonction est partie : il se raccroche à celle d'avant
      const bool la = r >= 0 && d.fonctions[r].id == at->get<std::string>();
      if (!la) el.j["at"] = r >= 0 ? json(d.fonctions[r].id) : json(nullptr);
    }
    if (!(n >= 0 && r >= n) && methodeDe(el.kind, str(el.j, "how"))) {
      resoudreUn(el, ctx);
      syncClavette(el, ctx);
    }
    for (Esquisse& s : d.esquisses)
      if (s.plan == "CG" && s.plan_cg == el.id && suivreEsquisse(d, s)) bouge = true;
  }
  return bouge;
}

const char* nomSorteConstruction(const std::string& k) { return nomSorte(k); }
const char* iconeConstruction(const std::string& k) { return k == "plane" ? "▱" : k == "axis" ? "↗" : k == "point" ? "•" : k == "frame" ? "⊹" : "?"; }

std::string libelleConstruction(const ElementConstruction& e) {  // cgLabel
  const Methode* m = methodeDe(e.kind, str(e.j, "how"));
  std::string t = e.nom + " · " + (m ? m->titre : "?");
  if (e.kind == "point" && e.aRepere) {
    char b[96];
    snprintf(b, sizeof b, " (%.1f ; %.1f ; %.1f)", e.o[0], e.o[1], e.o[2]);
    std::string s = b;
    std::replace(s.begin(), s.end(), '.', ',');
    t += s;
  }
  return t;
}

std::string creerConstruction(json& d, const std::string& kind, int marque, const json& ref0) {  // cgNew
  if (!d.contains("cgeo") || !d["cgeo"].is_array()) d["cgeo"] = json::array();
  json& L = d["cgeo"];
  const std::string lab = nomSorte(kind);
  int mx = 0;
  for (const json& c : L) {
    const std::string n = str(c, "name");
    if (n.rfind(lab + " ", 0) == 0) {
      try {
        size_t lu = 0;
        const int v = std::stoi(n.substr(lab.size() + 1), &lu);
        if (lu == n.size() - lab.size() - 1) mx = std::max(mx, v);
      } catch (const std::exception&) {
      }
    }
  }
  const unsigned long long ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
  std::string id;
  for (size_t k = L.size() + 1;; k++) {
    id = "cg_" + std::to_string(k) + "_" + std::to_string(ms % 100000000ULL);
    bool pris = false;
    for (const json& c : L) pris = pris || str(c, "id") == id;
    if (!pris) break;
  }
  const std::string how = defautHow(kind);
  const Methode* m = methodeDe(kind, how);
  json p = json::object();
  for (const Valeur& v : m->par) p[v.cle] = v.def;
  json at = nullptr;
  const json& F = d["features"];
  const int i = (marque < 0 ? static_cast<int>(F.size()) : marque) - 1;
  if (i >= 0 && i < static_cast<int>(F.size())) at = F[i].value("id", std::string());
  json refs = json::array();
  if (!ref0.is_null() && !m->slots.empty()) refs.push_back(ref0);
  L.push_back({{"id", id}, {"kind", kind}, {"how", how}, {"name", lab + " " + std::to_string(mx + 1)}, {"refs", refs}, {"p", p}, {"at", at}, {"visible", true}, {"fr", nullptr}, {"st", "ok"}, {"msg", ""}});
  return id;
}

void supprimerConstruction(json& d, const std::string& id) {
  if (d.contains("cgeo") && d["cgeo"].is_array()) {
    json garde = json::array();
    for (json& c : d["cgeo"])
      if (str(c, "id") != id) garde.push_back(std::move(c));
    d["cgeo"] = std::move(garde);
  }
  if (d.contains("sketches") && d["sketches"].is_array())
    for (json& s : d["sketches"])
      if (str(s, "plane") == "CG" && s.contains("cg") && s["cg"].is_object() && str(s["cg"], "id") == id) {  // cgDetachSketch
        s["plane"] = "FACE";
        s.erase("cg");
        s["host"] = nullptr;
      }
}

std::string questionSuppressionConstruction(const Document& d, const std::string& id) {  // cgAskDelete, cgUsers
  const ElementConstruction* e = elementDe(d, id);
  int sks = 0, cgs = 0;
  for (const Esquisse& s : d.esquisses)
    if (s.plan == "CG" && s.plan_cg == id) sks++;
  for (const ElementConstruction& c : d.construction)
    if (c.id != id && std::find(c.surElements.begin(), c.surElements.end(), id) != c.surElements.end()) cgs++;
  std::string t = "Supprimer « " + (e ? e->nom : id) + " » ?";
  if (sks || cgs) {
    t += "\nIl est utilisé par ";
    if (sks) t += std::to_string(sks) + " esquisse(s) (laissées en place, plan figé)";
    if (sks && cgs) t += " et ";
    if (cgs) t += std::to_string(cgs) + " élément(s) de construction (figés, ⚠)";
    t += ".";
  }
  return t;
}

bool emplacementConstruction(const ElementConstruction& e, int rang, std::string& type, std::string& titre, bool* option) {
  const Methode* m = methodeDe(e.kind, str(e.j, "how"));
  if (!m || rang < 0 || rang >= static_cast<int>(m->slots.size())) return false;
  type = m->slots[rang].type;
  titre = m->slots[rang].titre;
  if (option) *option = m->slots[rang].option;
  return true;
}

int emplacementVide(const ElementConstruction& e) {
  const Methode* m = methodeDe(e.kind, str(e.j, "how"));
  if (!m) return -1;
  const auto r = e.j.find("refs");
  for (size_t i = 0; i < m->slots.size(); i++) {
    const bool la = r != e.j.end() && r->is_array() && i < r->size() && (*r)[i].is_object();
    if (!la && !m->slots[i].option) return static_cast<int>(i);
  }
  return -1;
}

std::string consigneEmplacement(const std::string& t) {
  if (t == "plane") return "un plan de la liste ou une face plane";
  if (t == "axis") return "un axe de la liste, une arête droite ou circulaire, ou une face cylindrique";
  if (t == "point") return "un point de la liste, un sommet ou le centre d’une arête circulaire";
  if (t == "frame") return "un repère de la liste";
  if (t == "curve") return "une courbe de la liste ou une arête";
  return "une référence";
}

namespace {
std::string libelleRef(const Document& d, const json& r) {  // cgRefLabel
  const std::string k = str(r, "k");
  if (k == "o") {
    const std::string id = str(r, "id");
    if (id == "XY" || id == "XZ" || id == "YZ") return "Plan " + id;
    return id == "O" ? "Origine" : "Axe " + id;
  }
  if (k == "cg") {
    const ElementConstruction* e = elementDe(d, str(r, "id"));
    const std::string s = str(r, "sub");
    return (e ? e->nom : std::string("(supprimé)")) + (s.empty() ? "" : " · " + s);
  }
  if (k == "skpt") {
    const Esquisse* s = esquisseDeId(d, str(r, "sk"));
    return "Point · " + (s ? s->nom : std::string("esquisse ?"));
  }
  if (k == "skent" && str(r, "name").empty()) {
    const Esquisse* s = esquisseDeId(d, str(r, "sk"));
    return "Courbe · " + (s ? s->nom : std::string("esquisse ?"));
  }
  if (!str(r, "name").empty()) return str(r, "name");
  return k == "face" ? "Face" : k == "edge" ? "Arête" : k == "vtx" ? "Sommet" : "Référence";
}
std::string texteV(const Vec3& v, int dec) {
  char b[96];
  snprintf(b, sizeof b, "%.*f ; %.*f ; %.*f", dec, v[0], dec, v[1], dec, v[2]);
  std::string s = b;
  std::replace(s.begin(), s.end(), '.', ',');
  return s;
}
const char* nomTraitEsquisse(const std::string& t) { return t == "line" ? "Ligne" : t == "arc" ? "Arc" : t == "circle" ? "Cercle" : "Spline"; }
}  // namespace

std::vector<ChampFiche> ficheConstruction(const Document& d, const ElementConstruction& e) {
  std::vector<ChampFiche> c;
  const auto lecture = [&](const std::string& t, const std::string& v) {
    ChampFiche f;
    f.sorte = ChampFiche::LECTURE;
    f.titre = t;
    f.texte = v;
    c.push_back(std::move(f));
  };
  const auto booleen = [&](const std::string& t, const std::string& cle, bool oui) {
    ChampFiche f;
    f.sorte = ChampFiche::BOOLEEN;
    f.titre = t;
    f.cle = cle;
    f.oui = oui;
    c.push_back(std::move(f));
  };
  const std::string how = str(e.j, "how");
  const Methode* m = methodeDe(e.kind, how);
  lecture("Nom", std::string(iconeConstruction(e.kind)) + " " + e.nom);
  {
    ChampFiche f;
    f.sorte = ChampFiche::CHOIX;
    f.titre = "Méthode";
    f.cle = "x/how";
    f.texte = how;
    const std::vector<assemblage::CandidatExterne> ext = d.assemblage ? assemblage::candidatsExternes(*d.assemblage, e.kind) : std::vector<assemblage::CandidatExterne>();
    for (const Methode& x : methodes(e.kind))
      if (std::string(x.how) != "ext" || how == "ext" || !ext.empty()) f.choix.push_back({x.how, x.titre});  // pas d'autre instance : pas de choix
    if (!m) f.choix.push_back({how, "Depuis un autre composant"});
    c.push_back(std::move(f));
    if (how == "ext") {
      ChampFiche g;
      g.sorte = ChampFiche::CHOIX;
      g.titre = "Élément visé";
      g.cle = "x/ext";
      const auto xe = e.j.find("ext");
      const auto cle = [](const json& v) { return v.value("path", json::array()).dump() + "|" + (v.contains("cg") ? v["cg"].dump() : "") + "|" + (v.contains("o") ? v["o"].dump() : ""); };
      g.choix.push_back({"", "— choisir —"});
      for (const assemblage::CandidatExterne& q : ext) {
        g.choix.push_back({q.valeur.dump(), q.titre});
        if (xe != e.j.end() && xe->is_object() && cle(*xe) == cle(q.valeur)) g.texte = q.valeur.dump();
      }
      c.push_back(std::move(g));
      if (xe != e.j.end() && xe->is_object()) booleen("Figer à la position actuelle", "b/frozen", xe->value("frozen", false));
    }
  }
  if (m) {
    const auto refs = e.j.find("refs");
    const int moi = rangConstruction(d, e);
    for (size_t i = 0; i < m->slots.size(); i++) {
      const Slot& sl = m->slots[i];
      const std::string type = sl.type;
      const json* r = refs != e.j.end() && refs->is_array() && i < refs->size() && (*refs)[i].is_object() ? &(*refs)[i] : nullptr;
      ChampFiche f;
      f.sorte = ChampFiche::CHOIX;
      f.titre = sl.titre;
      f.cle = "r/" + std::to_string(i);
      if (r) {
        f.choix.push_back({"", libelleRef(d, *r)});
        f.texte = "";
      } else {
        f.choix.push_back({"", sl.option ? "(facultatif)" : "— choisir —"});
      }
      f.choix.push_back({"pick", "👆 Cliquer dans la vue…"});
      if (r) f.choix.push_back({"none", "✕ Retirer"});
      if (type == "plane")
        for (const char* p : {"XY", "XZ", "YZ"}) f.choix.push_back({std::string("o:") + p, std::string("Plan ") + p});
      if (type == "axis")
        for (const char* p : {"X", "Y", "Z"}) f.choix.push_back({std::string("o:") + p, std::string("Axe ") + p});
      if (type == "point" || type == "frame") f.choix.push_back({"o:O", "Origine"});
      for (const ElementConstruction& a : d.construction) {
        if (a.id == e.id || rangConstruction(d, a) > moi) continue;
        const bool repere = a.kind == "frame";
        if (type == "curve") continue;
        const bool bon = type == "plane" ? a.kind == "plane" || repere : type == "axis" ? a.kind == "axis" || repere : type == "point" ? true : repere;
        if (bon) f.choix.push_back({"cg:" + a.id, std::string(iconeConstruction(a.kind)) + " " + a.nom});
        if (repere && type == "plane")
          for (const char* p : {"XY", "XZ", "YZ"}) f.choix.push_back({"cg:" + a.id + ":" + p, a.nom + " · " + p});
        if (repere && type == "axis")
          for (const char* p : {"X", "Y", "Z"}) f.choix.push_back({"cg:" + a.id + ":" + p, a.nom + " · " + p});
      }
      if (type == "curve" || type == "axis" || type == "point")
        for (const Esquisse& s : d.esquisses) {
          if (!s.visible) continue;
          for (const Entite& x : s.entites) {
            if (x.poignee) continue;
            if (type == "curve" && (x.t == "line" || x.t == "arc" || x.t == "circle" || x.t == "spline")) f.choix.push_back({"skent:" + s.id + ":" + x.id, std::string(nomTraitEsquisse(x.t)) + " " + x.id + " · " + s.nom});
            if (type == "axis" && x.t == "line") f.choix.push_back({"skent:" + s.id + ":" + x.id, "Ligne " + x.id + " · " + s.nom});
          }
          if (type == "point")
            for (const std::string& p : s.ordre) f.choix.push_back({"skpt:" + s.id + ":" + p, "Point " + p + " · " + s.nom});
        }
      c.push_back(std::move(f));
    }
    for (const Valeur& v : m->par) {
      ChampFiche f;
      f.sorte = ChampFiche::NOMBRE;
      f.titre = std::string(v.titre) + (std::string(v.unite) == "ratio" ? "" : " (" + std::string(v.unite) + ")");
      f.cle = std::string("n/") + v.cle;
      f.nombre = numero(e.j, v.cle);
      c.push_back(std::move(f));
    }
    if (m->flip) {
      bool fl = false;
      if (auto p = e.j.find("p"); p != e.j.end() && p->is_object())
        if (auto x = p->find("flip"); x != p->end() && x->is_boolean()) fl = x->get<bool>();
      booleen(e.kind == "axis" ? "Inverser le sens" : "Inverser la normale", "b/flip", fl);
    }
  }
  if (str(e.j, "st") == "warn") lecture("⚠", str(e.j, "msg"));
  if (e.aRepere) {
    lecture(e.kind == "point" ? "Position" : "Origine", texteV(e.o, 3));
    if (e.kind != "point") lecture(e.kind == "axis" ? "Direction" : "Normale Z", texteV(e.z, 3));
  }
  booleen("Visible", "b/visible", e.visible);
  return c;
}

std::string appliquerConstruction(json& d, const std::string& id, const std::string& cle, const std::string& valeur) {
  if (!d.contains("cgeo") || !d["cgeo"].is_array()) return "Élément introuvable.";
  json* pe = nullptr;
  for (json& c : d["cgeo"])
    if (str(c, "id") == id) pe = &c;
  if (!pe) return "Élément introuvable.";
  json& e = *pe;
  const std::string kind = str(e, "kind"), sorte = cle.substr(0, 1), chemin = cle.size() > 2 ? cle.substr(2) : "";
  if (!e.contains("p") || !e["p"].is_object()) e["p"] = json::object();
  if (!e.contains("refs") || !e["refs"].is_array()) e["refs"] = json::array();
  if (cle == "x/how") {  // cgSetHow : on garde les références compatibles et les valeurs communes
    const Methode* n = methodeDe(kind, valeur);
    const Methode* a = methodeDe(kind, str(e, "how"));
    if (!n) return "Méthode inconnue.";
    json refs = json::array();
    for (size_t i = 0; i < n->slots.size(); i++) {
      const bool garde = a && i < a->slots.size() && std::string(a->slots[i].type) == n->slots[i].type && i < e["refs"].size();
      refs.push_back(garde ? e["refs"][i] : json(nullptr));
    }
    e["how"] = valeur;
    e["refs"] = refs;
    if (valeur != "ext") e.erase("ext");
    json p = json::object();
    for (const Valeur& v : n->par) p[v.cle] = e["p"].contains(v.cle) ? e["p"][v.cle] : json(v.def);
    for (const char* k : {"flip", "expr", "pname"})
      if (e["p"].contains(k)) p[k] = e["p"][k];
    e["p"] = p;
    return "";
  }
  if (sorte == "r") {
    const size_t i = static_cast<size_t>(std::stoi(chemin));
    json r = nullptr;
    if (valeur.rfind("o:", 0) == 0) {
      r = {{"k", "o"}, {"id", valeur.substr(2)}};
    } else if (valeur.rfind("cg:", 0) == 0) {
      const std::string q = valeur.substr(3);
      const size_t c = q.find(':');
      r = {{"k", "cg"}, {"id", q.substr(0, c)}};
      if (c != std::string::npos) r["sub"] = q.substr(c + 1);
    } else if (valeur.rfind("skent:", 0) == 0 || valeur.rfind("skpt:", 0) == 0) {
      const bool ent = valeur[2] == 'e';
      const std::string q = valeur.substr(ent ? 6 : 5);
      const size_t c = q.find(':');
      if (c == std::string::npos) return "Référence illisible.";
      r = {{"k", ent ? "skent" : "skpt"}, {"sk", q.substr(0, c)}};
      r[ent ? "e" : "pt"] = q.substr(c + 1);
    } else if (!valeur.empty() && valeur[0] == '{') {
      r = json::parse(valeur);
    } else if (valeur != "none") {
      return "";
    }
    while (e["refs"].size() <= i) e["refs"].push_back(nullptr);
    e["refs"][i] = r;
    return "";
  }
  if (sorte == "n") {
    std::string t = valeur;
    std::replace(t.begin(), t.end(), ',', '.');
    double v = 0;
    try {
      v = std::stod(t);
    } catch (const std::exception&) {
      return "Saisir un nombre.";
    }
    if (!std::isfinite(v)) return "Saisir un nombre.";
    e["p"][chemin] = v;
    return "";
  }
  if (cle == "x/ext") {  // cgRefresh : l'élément visé
    if (valeur.empty()) return "";
    e["ext"] = json::parse(valeur);
    return "";
  }
  if (cle == "b/frozen") {
    if (!e.contains("ext") || !e["ext"].is_object()) return "";
    e["ext"]["frozen"] = valeur == "1" || valeur == "true" || valeur == "oui";
    return "";
  }
  if (cle == "b/flip") {
    e["p"]["flip"] = valeur == "1";
    return "";
  }
  if (cle == "b/visible") {
    e["visible"] = valeur == "1";
    return "";
  }
  return "Réglage inconnu.";
}

GeoArete geoArete(const std::vector<Vec3>& P) {  // cgEdgeGeom
  GeoArete g;
  if (P.size() < 2) return g;
  const Vec3 a = P.front(), b = P.back(), d = sub(b, a);
  const double L = len(d);
  if (L > 1e-9) {
    double dev = 0;
    for (const Vec3& q : P) dev = std::max(dev, len(cross(sub(q, a), d)) / L);
    if (dev <= std::max(1e-4, 0.002 * L)) {
      g.droite = true;
      g.a = a;
      g.b = b;
      return g;
    }
  }
  if (P.size() < 5) return g;
  const Vec3 p0 = P[0], p1 = P[P.size() / 3], p2 = P[2 * P.size() / 3];
  const Vec3 u = sub(p1, p0), w = sub(p2, p0), n = cross(u, w);
  const double nn = dot(n, n);
  if (nn < 1e-12) return g;
  const Vec3 c = add(p0, mul(add(mul(cross(n, u), dot(w, w)), mul(cross(w, n), dot(u, u))), 1 / (2 * nn)));
  const double r = len(sub(p0, c));
  for (const Vec3& q : P)
    if (std::abs(len(sub(q, c)) - r) > std::max(0.02, 0.01 * r)) return g;
  g.cercle = true;
  g.c = c;
  g.n = unit(n);
  g.r = r;
  return g;
}

/* ----- perçage et rainure sur un cylindre (src/76-percage-cylindre, src/76-clavette) ----- */
bool lireClicCylindre(const TopoDS_Face& f, const double point[3], bool interieurAdmis, ClicCylindre& C, std::string& erreur) {
  try {
    BRepAdaptor_Surface ad(f, true);
    if (ad.GetType() != GeomAbs_Cylinder) {
      erreur = "cliquez une face CYLINDRIQUE";
      return false;
    }
    Vec3 pos{}, dim{};
    boiteFace(f, pos, dim);
    const gp_Cylinder cy = ad.Cylinder();
    const gp_Ax1 ax = cy.Axis();
    const Vec3 d0 = unit({ax.Direction().X(), ax.Direction().Y(), ax.Direction().Z()}), lo{ax.Location().X(), ax.Location().Y(), ax.Location().Z()};
    C.o = add(lo, mul(d0, dot(sub(pos, lo), d0)));
    C.r = cy.Radius();
    C.d = sensCylindre(d0);
    const Vec3 P{point[0], point[1], point[2]}, w = sub(P, C.o);
    C.t = dot(w, C.d);
    const Vec3 rad = sub(w, mul(C.d, C.t));
    if (len(rad) < 1e-6) {
      erreur = "point cliqué sur l’axe";
      return false;
    }
    C.rad = unit(rad);
    // Sens de la normale au point cliqué : la matière est-elle dehors (alésage) ?
    double u = 0, v = 0;
    ElSLib::Parameters(cy, gp_Pnt(P[0], P[1], P[2]), u, v);
    gp_Pnt q;
    gp_Vec du, dv;
    ad.D1(u, v, q, du, dv);
    gp_Vec nv = du.Crossed(dv);
    if (f.Orientation() == TopAbs_REVERSED) nv.Reverse();
    C.inner = nv.X() * C.rad[0] + nv.Y() * C.rad[1] + nv.Z() * C.rad[2] < 0;
    if (C.inner && !interieurAdmis) {
      erreur = "cliquez la face EXTÉRIEURE du cylindre (l’intérieur d’un alésage n’est pas pris en charge)";
      return false;
    }
    return true;
  } catch (const Standard_Failure& e) {
    erreur = e.what();
    return false;
  }
}

namespace {
struct DirCyl {
  json ref;
  double a;
};
double angleLibre(const Vec3& d, const Vec3& rad) {  // holeCylFreeAngle
  const Vec3 u = baseN(d, nullptr).u;
  return std::atan2(dot(cross(u, rad), d), dot(u, rad)) * 180 / PI;
}
DirCyl directionCylindre(const Vec3& d, const Vec3& rad) {  // holeCylDirection
  const struct {
    const char* id;
    Vec3 w;
  } AX[] = {{"X", {1, 0, 0}}, {"Y", {0, 1, 0}}, {"Z", {0, 0, 1}}};
  for (const auto& a : AX) {
    const Vec3 pr = sub(a.w, mul(d, dot(a.w, d)));
    if (len(pr) < 0.5) continue;
    const double c = dot(unit(pr), rad);
    if (std::abs(c) >= std::cos(10 * PI / 180)) return {{{"k", "o"}, {"id", a.id}}, c > 0 ? 0.0 : 180.0};
  }
  return {nullptr, std::round(angleLibre(d, rad))};
}
json& listeJ(json& d, const char* k) {
  if (!d.contains(k) || !d[k].is_array()) d[k] = json::array();
  return d[k];
}
std::string idEsquisse(json& d) {
  json& L = listeJ(d, "sketches");
  const unsigned long long ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
  for (size_t k = L.size() + 1;; k++) {
    const std::string id = "sk_" + std::to_string(k) + "_" + std::to_string(ms % 100000000ULL);
    bool pris = false;
    for (const json& s : L) pris = pris || str(s, "id") == id;
    if (!pris) return id;
  }
}
json* elementJ(json& d, const std::string& id) {
  for (json& c : listeJ(d, "cgeo"))
    if (str(c, "id") == id) return &c;
  return nullptr;
}
int compteJ(const json& L, const std::function<bool(const json&)>& f) {
  int n = 0;
  for (const json& x : L) n += f(x) ? 1 : 0;
  return n;
}
json esquisseSurPlan(json& d, const std::string& nom, const std::string& cg) {
  return {{"id", idEsquisse(d)}, {"name", nom}, {"plane", "CG"}, {"cg", {{"id", cg}}}, {"points", json::object()}, {"entities", json::array()}, {"constraints", json::array()}, {"dims", json::array()}, {"seq", 1}, {"visible", false}, {"origin", json::array({0, 0, 0})}};
}
void clefAjouter(json& d, const std::string& el, int marque) {  // kwKeyAdd
  for (const json& f : listeJ(d, "features"))
    if (str(f, "kwKey") == el) return;
  const int n = compteJ(listeJ(d, "cgeo"), [](const json& c) { return !str(c, "kwKeyOf").empty(); }) + 1;
  const std::string idP = creerConstruction(d, "plane", marque, nullptr);
  json& e2 = *elementJ(d, idP);
  e2["name"] = "Plan de la clavette " + std::to_string(n);
  e2["refs"] = json::array({{{"k", "cg"}, {"id", el}}});
  e2["p"] = {{"d", 0}};
  e2["visible"] = false;
  e2["kwKeyOf"] = el;
  json sk = esquisseSurPlan(d, "Esquisse " + std::to_string(listeJ(d, "sketches").size() + 1) + " (corps de clavette)", idP);
  const std::string idS = str(sk, "id");
  listeJ(d, "sketches").push_back(std::move(sk));
  // extNewBody : le corps actif ne change pas
  json& B = listeJ(d, "bodies");
  int nb = d.contains("bodySeq") && d["bodySeq"].is_number() ? d["bodySeq"].get<int>() : 1;
  const auto pris = [&](int k) { return compteJ(B, [&](const json& b) { return str(b, "id") == "b" + std::to_string(k); }) > 0; };
  while (pris(nb)) nb++;
  d["bodySeq"] = nb + 1;
  B.push_back({{"id", "b" + std::to_string(nb)}, {"name", "Corps " + std::to_string(nb)}, {"c", nullptr}});
  const std::string fid = ajouterFonction(d, {{"type", "extrude"}, {"name", "Clavette"}, {"sketchId", idS}, {"distance", 1}, {"op", "add"}, {"visible", true}, {"mid", false}, {"upto", nullptr}, {"kwKey", el}, {"newBody", true}, {"body", "b" + std::to_string(nb)}}, "ex", marque);
  for (json& f : listeJ(d, "features"))
    if (str(f, "id") == fid) f["name"] = "Clavette";
  elementJ(d, el)->operator[]("kw")["key"] = true;
}
void clefRetirer(json& d, const std::string& el, const json* dejaRetiree = nullptr) {  // kwKeyRemove
  json* pe = elementJ(d, el);
  if (pe && pe->contains("kw")) (*pe)["kw"]["key"] = false;
  std::string bid = dejaRetiree ? str(*dejaRetiree, "body") : std::string();
  json& F = listeJ(d, "features");
  json garde = json::array();
  for (json& f : F) {
    if (str(f, "kwKey") == el) {
      bid = str(f, "body");
      continue;
    }
    garde.push_back(std::move(f));
  }
  F = std::move(garde);
  std::string plan;
  for (const json& c : listeJ(d, "cgeo"))
    if (str(c, "kwKeyOf") == el) plan = str(c, "id");
  if (!plan.empty()) {
    json gs = json::array();
    for (json& s : listeJ(d, "sketches")) {
      if (str(s, "plane") == "CG" && s.contains("cg") && s["cg"].is_object() && str(s["cg"], "id") == plan) continue;
      gs.push_back(std::move(s));
    }
    d["sketches"] = std::move(gs);
    json gc = json::array();
    for (json& c : listeJ(d, "cgeo"))
      if (str(c, "id") != plan) gc.push_back(std::move(c));
    d["cgeo"] = std::move(gc);
  }
  if (bid.empty()) return;
  for (const json& f : listeJ(d, "features")) {
    if (str(f, "body") == bid || str(f, "newBody") == bid) return;
    if (str(f, "type") == "combine" && f.contains("tools") && f["tools"].is_array())
      for (const json& t : f["tools"])
        if (t.is_string() && t.get<std::string>() == bid) return;
  }
  json gb = json::array();
  for (json& b : listeJ(d, "bodies"))
    if (str(b, "id") != bid) gb.push_back(std::move(b));
  d["bodies"] = std::move(gb);
  if (str(d, "activeBody") == bid) d.erase("activeBody");
}
}  // namespace

std::string creerPercageCylindre(json& d, const ClicCylindre& C, int marque) {
  const DirCyl D = directionCylindre(C.d, C.rad);
  const double t = std::abs(C.t) < 1 ? 0 : C.t;
  const int n = compteJ(listeJ(d, "cgeo"), [](const json& c) { return str(c, "how") == "tangent"; }) + 1;
  const std::string idP = creerConstruction(d, "plane", marque, nullptr);
  json& el = *elementJ(d, idP);
  el["how"] = "tangent";
  el["name"] = "Plan tangent " + std::to_string(n);
  el["refs"] = json::array({{{"k", "face"}, {"ref", C.ref}, {"name", "Face"}}, D.ref, nullptr});
  el["p"] = {{"a", D.a}, {"d", std::round(std::abs(t) * 10) / 10}, {"e", 0}, {"side", t < 0 ? -1 : 1}};
  el["visible"] = false;
  json sk = esquisseSurPlan(d, "Esquisse " + std::to_string(listeJ(d, "sketches").size() + 1) + " (cylindre)", idP);
  const std::string idS = str(sk, "id");
  sk["points"]["p1"] = {{"x", 0}, {"y", 0}};
  sk["entities"].push_back({{"id", "e2"}, {"t", "cpoint"}, {"p", "p1"}, {"hole", true}});
  sk["seq"] = 3;
  listeJ(d, "sketches").push_back(std::move(sk));
  const std::string id = creerPercage(d, idS, false, marque);
  for (json& f : listeJ(d, "features"))
    if (str(f, "id") == id) {
      f["d"] = std::min(6.6, std::round(C.r * 10) / 10);
      f["depth"] = std::min(15.0, std::round(C.r * 100) / 100);
      if (!C.corps.empty()) f["body"] = C.corps;
      f["name"] = nomAutoFonction(d, f);
    }
  return id;
}

std::string creerClavette(json& d, const ClicCylindre& C, int marque) {
  const DirCyl D = directionCylindre(C.d, C.rad);
  const int n = compteJ(listeJ(d, "cgeo"), [](const json& c) { return c.contains("kw"); }) + 1;
  const std::string idP = creerConstruction(d, "plane", marque, nullptr);
  json& el = *elementJ(d, idP);
  el["how"] = "tangent";
  el["name"] = "Plan de clavette " + std::to_string(n);
  el["refs"] = json::array({{{"k", "face"}, {"ref", C.ref}, {"name", "Face"}}, D.ref, nullptr});
  el["p"] = {{"a", D.a}, {"d", 0}, {"e", 0}, {"side", 1}};
  el["visible"] = false;
  el["kw"] = {{"bore", C.inner}, {"form", C.inner ? "T" : "A"}, {"iso", true}, {"b", 0}, {"t", 0}, {"h", 0}, {"L", nullptr}, {"end", C.t < 0 ? -1 : 1}, {"key", false}};
  json sk = esquisseSurPlan(d, "Esquisse " + std::to_string(listeJ(d, "sketches").size() + 1) + " (clavette)", idP);
  const std::string idS = str(sk, "id");
  listeJ(d, "sketches").push_back(std::move(sk));
  json nf = {{"type", "extrude"}, {"name", ""}, {"sketchId", idS}, {"distance", -1}, {"op", "cut"}, {"visible", true}, {"mid", false}, {"upto", nullptr}, {"kw", true}};
  if (!C.corps.empty()) nf["body"] = C.corps;
  const std::string id = ajouterFonction(d, nf, "ex", marque);
  clefAjouter(d, idP, marque < 0 ? marque : marque + 1);
  return id;
}

void clavetteSupprimee(json& d, const json& f) {  // kwOnDelete
  if (f.value("kw", false)) {
    const std::string sk = str(f, "sketchId");
    for (const json& s : listeJ(d, "sketches"))
      if (str(s, "id") == sk && s.contains("cg") && s["cg"].is_object()) {
        const std::string el = str(s["cg"], "id");
        clefRetirer(d, el);
        return;
      }
  } else if (!str(f, "kwKey").empty()) {
    clefRetirer(d, str(f, "kwKey"), &f);
  }
}

const ElementConstruction* planDuCylindre(const Document& d, const std::string& esquisse) {
  const Esquisse* s = esquisseDeId(d, esquisse);
  if (!s || s->plan != "CG") return nullptr;
  const ElementConstruction* e = elementDe(d, s->plan_cg);
  return e && e->kind == "plane" && str(e->j, "how") == "tangent" ? e : nullptr;
}

void ficheCylindre(const Document& d, const ElementConstruction& e, bool sansCote, std::vector<ChampFiche>& c) {  // renderHoleCylProps
  const auto ajout = [&](ChampFiche::Sorte so, const std::string& t, const std::string& cle) -> ChampFiche& {
    ChampFiche f;
    f.sorte = so;
    f.categorie = "Position sur le cylindre";
    f.titre = t;
    f.cle = cle;
    c.push_back(std::move(f));
    return c.back();
  };
  if (str(e.j, "st") == "warn" && !str(e.j, "msg").empty()) ajout(ChampFiche::LECTURE, "⚠", "").texte = str(e.j, "msg");
  const json& refs = e.j["refs"];
  const json* r1 = refs.size() > 1 && refs[1].is_object() ? &refs[1] : nullptr;
  const double a = std::fmod(std::fmod(numero(e.j, "a"), 360) + 360, 360);
  const std::string id1 = r1 && str(*r1, "k") == "o" ? str(*r1, "id") : "";
  const bool estAxe = id1 == "X" || id1 == "Y" || id1 == "Z";
  const std::string cur = estAxe && (a == 0 || a == 180) ? std::string(a != 0 ? "-" : "+") + id1 : r1 ? "ref" : "free";
  ChampFiche& ch = ajout(ChampFiche::CHOIX, "Direction", "z/dir");
  ch.texte = cur;
  const Vec3 dAxe = e.aRepere ? e.x : Vec3{0, 0, 1};
  const struct {
    const char* id;
    Vec3 w;
  } AX[] = {{"X", {1, 0, 0}}, {"Y", {0, 1, 0}}, {"Z", {0, 0, 1}}};
  for (const auto& x : AX) {
    if (len(cross(x.w, dAxe)) < 0.5) continue;
    ch.choix.push_back({std::string("+") + x.id, std::string("Suivant +") + x.id});
    ch.choix.push_back({std::string("-") + x.id, std::string("Suivant −") + x.id});
  }
  ch.choix.push_back({"free", "Angle libre"});
  ch.choix.push_back({"ref", r1 && cur == "ref" ? libelleRef(d, *r1) : "Face ou arête…"});
  ajout(ChampFiche::NOMBRE, "Angle (°)", "z/a").nombre = numero(e.j, "a");
  if (!sansCote) {
    const json* r2 = refs.size() > 2 && refs[2].is_object() ? &refs[2] : nullptr;
    ChampFiche& cr = ajout(ChampFiche::CHOIX, "Cote depuis", "z/ref");
    cr.choix.push_back({"", r2 ? libelleRef(d, *r2) : "Milieu du cylindre"});
    cr.choix.push_back({"pick", "👆 Face, arête ou sommet…"});
    if (r2) cr.choix.push_back({"none", "✕ Le milieu du cylindre"});
    ajout(ChampFiche::NOMBRE, "Cote (mm)", "z/d").nombre = numero(e.j, "d");
    ajout(ChampFiche::BOOLEEN, "Autre côté de la référence", "z/side").oui = numero(e.j, "side") < 0;
  }
  ajout(ChampFiche::NOMBRE, "Décalage latéral (mm)", "z/e").nombre = numero(e.j, "e");
}

void ficheClavette(const Document& d, const json& f, std::vector<ChampFiche>& c) {  // kwPanel, kwKeyPanel
  const std::string kk = str(f, "kwKey");
  const ElementConstruction* el = kk.empty() ? planDuCylindre(d, str(f, "sketchId")) : elementDe(d, kk);
  const auto lecture = [&](const std::string& t, const std::string& v) {
    ChampFiche x;
    x.sorte = ChampFiche::LECTURE;
    x.titre = t;
    x.texte = v;
    c.push_back(std::move(x));
  };
  if (!el) return lecture("⚠", kk.empty() ? "Plan de la clavette introuvable." : "Rainure de cette clavette introuvable.");
  const json& kw = el->j.contains("kw") ? el->j["kw"] : json::object();
  const json& O = el->kwSortie;
  const auto sortie = [&](const char* k) { return O.is_object() ? nbJ(O, k) : 0.0; };
  const auto cote = [&](const std::string& t, const std::string& cle, double v) {
    ChampFiche x;
    x.sorte = ChampFiche::NOMBRE;
    x.titre = t;
    x.cle = "z/" + cle;
    x.nombre = v;
    c.push_back(std::move(x));
  };
  const bool bore = ouiJ(kw, "bore");
  const std::string form = str(kw, "form");
  if (O.is_object() && !str(O, "warn").empty()) lecture("⚠", str(O, "warn"));
  if (kk.empty()) {
    if (sortie("D") > 0) {
      const LigneIso773* r = ligneIso773(sortie("D"));
      std::string t = std::string(bore ? "Alésage" : "Arbre") + " Ø" + stdF(sortie("D"));
      if (r) t += " — ISO 773 : clavette " + stdF(r->b) + " × " + stdF(r->h) + ", rainure " + (bore ? "t2 " : "t1 ") + stdF(bore ? r->t2 : r->t1);
      if (!ouiJ(O, "iso")) t += " — cotes modifiées";
      lecture("Rainure", t);
    }
    ChampFiche p;
    p.sorte = ChampFiche::CHOIX;
    p.titre = "Pièce";
    p.cle = "z/kw-bore";
    p.texte = bore ? "bore" : "shaft";
    p.choix = {{"shaft", "Arbre"}, {"bore", "Alésage"}};
    c.push_back(std::move(p));
    ChampFiche fo;
    fo.sorte = ChampFiche::CHOIX;
    fo.titre = "Forme";
    fo.cle = "z/kw-form";
    fo.texte = form;
    fo.choix = {{"A", "Fermée, bouts ronds"}, {"B", "Fermée, bouts droits"}, {"C", "Débouchante d’un côté"}, {"T", "Toute la longueur"}};
    c.push_back(std::move(fo));
    cote("Largeur (mm)", "kw-ob", sortie("b"));
    cote("Profondeur (mm)", "kw-ot", sortie("t"));
    if (form != "T") cote("Longueur (mm)", "kw-L", sortie("L"));
    if (form == "C") {
      ChampFiche b;
      b.sorte = ChampFiche::BOOLEEN;
      b.titre = "Déboucher de l’autre côté";
      b.cle = "z/kw-end";
      b.oui = nbJ(kw, "end") < 0;
      c.push_back(std::move(b));
    }
    ChampFiche b;
    b.sorte = ChampFiche::BOOLEEN;
    b.titre = "Clavette (corps séparé)";
    b.cle = "z/kw-key";
    b.oui = ouiJ(kw, "key");
    c.push_back(std::move(b));
  }
  if (ouiJ(kw, "key") || !kk.empty()) {
    cote("Clavette : largeur (mm)", "kw-okb", sortie("kb"));
    cote("Clavette : hauteur (mm)", "kw-oh", sortie("h"));
    cote("Clavette : longueur (mm)", "kw-okL", sortie("Lk"));
  }
  lecture("Note", "Une cote saisie ne suit plus le Ø ; 0 la rend automatique.");
  if (kk.empty()) ficheCylindre(d, *el, form == "C" || form == "T", c);
}

std::string appliquerCylindre(json& d, const json& f, const std::string& cle, const std::string& valeur) {
  std::string plan;
  const std::string kk = str(f, "kwKey");
  if (!kk.empty()) plan = kk;
  else
    for (const json& s : listeJ(d, "sketches"))
      if (str(s, "id") == str(f, "sketchId") && s.contains("cg") && s["cg"].is_object()) plan = str(s["cg"], "id");
  json* pe = elementJ(d, plan);
  if (!pe) return "Plan introuvable.";
  json& e = *pe;
  if (!e.contains("p") || !e["p"].is_object()) e["p"] = json::object();
  if (!e.contains("refs") || !e["refs"].is_array()) e["refs"] = json::array();
  while (e["refs"].size() < 3) e["refs"].push_back(nullptr);
  const std::string c = cle.substr(2);
  const auto nombre = [&](double& v) {
    std::string t = valeur;
    std::replace(t.begin(), t.end(), ',', '.');
    try {
      v = std::stod(t);
    } catch (const std::exception&) {
      return false;
    }
    return std::isfinite(v);
  };
  double v = 0;
  if (c == "dir") {
    if (valeur == "ref") return "";
    if (valeur == "free") {
      e["refs"][1] = nullptr;
      if (e.contains("fr") && e["fr"].is_object()) e["p"]["a"] = std::round(angleLibre(lireV(e["fr"], "x"), lireV(e["fr"], "z")));
    } else if (valeur.size() == 2) {
      e["refs"][1] = {{"k", "o"}, {"id", valeur.substr(1)}};
      e["p"]["a"] = valeur[0] == '-' ? 180 : 0;
    } else if (valeur[0] == '{') {
      e["refs"][1] = json::parse(valeur);
      e["p"]["a"] = 0;
    }
    return "";
  }
  if (c == "pose") {  // z/ref : { ref, d, side }
    const json q = json::parse(valeur);
    e["refs"][2] = q["ref"];
    e["p"]["d"] = q["d"];
    e["p"]["side"] = q["side"];
    return "";
  }
  if (c == "a" || c == "e") {
    if (!nombre(v)) return "Saisir un nombre.";
    e["p"][c] = v;
    return "";
  }
  if (c == "d") {
    if (!nombre(v) || v < 0) return "Saisir une cote positive.";
    e["p"]["d"] = v;
    return "";
  }
  if (c == "side") {
    e["p"]["side"] = valeur == "1" ? -1 : 1;
    return "";
  }
  if (c.rfind("kw-", 0) != 0) return "Réglage inconnu.";
  json& kw = e["kw"];
  const std::string k = c.substr(3);
  if (k == "bore") kw["bore"] = valeur == "bore";
  else if (k == "form") kw["form"] = valeur;
  else if (k == "end") kw["end"] = valeur == "1" ? -1 : 1;
  else if (k == "key") {
    if (valeur == "1") {
      int rang = -1;
      json& F = listeJ(d, "features");
      for (size_t i = 0; i < F.size(); i++)
        if (str(F[i], "id") == str(f, "id")) rang = static_cast<int>(i) + 1;
      clefAjouter(d, plan, rang >= static_cast<int>(F.size()) ? -1 : rang);
    } else {
      clefRetirer(d, plan);
    }
  } else {  // ob, ot, oh, okb, okL, L : 0 ou vide = automatique
    double w = 0;
    if (!valeur.empty() && !nombre(w)) return "Saisir un nombre.";
    if (w < 0) return "Saisir une cote positive.";
    if (k == "L") kw["L"] = w > 0 ? json(w) : json(nullptr);
    else kw[k] = w;
    if (k == "ob" && w == 0) kw["b"] = 0;
    if (k == "ot" && w == 0) kw["t"] = 0;
    if (k == "oh" && w == 0) kw["h"] = 0;
  }
  return "";
}

std::string placementCylindre(Document& d, const TopoDS_Shape& solide, const std::string& plan, const json& ref, double& cote, int& sens) {
  ElementConstruction* el = nullptr;
  for (ElementConstruction& e : d.construction)
    if (e.id == plan) el = &e;
  if (!el || !el->aRepere) return "cylindre introuvable";
  try {
    Contexte ici(d);  // la pièce affichée
    ici.pos = static_cast<int>(d.fonctions.size()) - 1;
    ici.solide = solide;
    auto A0 = el->j["refs"].size() ? evaluerRef(el->j["refs"][0], &ici) : std::nullopt;
    if (!A0 || !A0->axis) {  // le cylindre s'évalue sur la pièce d'avant, qui le porte à coup sûr
      Contexte avant(d);
      avant.self = el;
      A0 = evaluerRef(el->j["refs"][0], &avant);
      if (!A0 || !A0->axis) return "cylindre introuvable";
    }
    const Vec3 dd = sensCylindre(A0->axis->d), oa = A0->axis->o;
    const double here = dot(sub(el->o, oa), dd);
    double tRef = 0;
    if (!ref.is_null()) {
      json r = ref;
      auto g = evaluerRef(r, &ici);
      if (!g) return "référence illisible";
      tRef = axialDe(r, *g, oa, dd);
      Contexte avant(d);
      avant.self = el;
      json c = ref;
      auto gp = evaluerRef(c, &avant);
      if (!gp || std::abs(axialDe(c, *gp, oa, dd) - tRef) > 0.01) return "cette référence appartient au trou ou à une fonction plus récente : choisissez-en une qui existait avant";
    }
    const double v = here - tRef;
    cote = std::round(std::abs(v) * 100) / 100;
    sens = v < 0 ? -1 : 1;
    return "";
  } catch (const Standard_Failure& e) {
    return e.what();
  } catch (const std::exception& e) {
    return e.what();
  }
}
