#include "intersection.h"

#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepAlgoAPI_Section.hxx>
#include <BRepBndLib.hxx>
#include <Bnd_Box.hxx>
#include <Standard_Failure.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <gp_Circ.hxx>
#include <gp_Dir.hxx>
#include <gp_Pln.hxx>
#include <gp_Pnt.hxx>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <map>

#include <nlohmann/json.hpp>

#include "conges.h"
#include "contours.h"
#include "rejeu.h"

namespace {
const double PI = 3.14159265358979323846, TAU = 2 * PI;
const int DENSE = 256;
const double TOL_COURBE = 0.02;

Vec3 versPlan(const Esquisse& s, const Vec3& q) {  // isectTo2 : (x, y) dans le plan, z : hauteur au-dessus
  const double dx = q[0] - s.o[0], dy = q[1] - s.o[1], dz = q[2] - s.o[2];
  return {dx * s.u[0] + dy * s.u[1] + dz * s.u[2], dx * s.v[0] + dy * s.v[1] + dz * s.v[2], dx * s.n[0] + dy * s.n[1] + dz * s.n[2]};
}
double hyp3(double a, double b, double c) { return std::sqrt(a * a + b * b + c * c); }

// Nombre écrit comme +v.toFixed(n) en JavaScript, sans « -0 »
std::string nombreArrondi(double v, int n) {
  char b[64];
  snprintf(b, sizeof b, "%.*f", n, v);
  double r = atof(b);
  if (r == 0) return "0";
  snprintf(b, sizeof b, "%.*f", n, v);
  std::string t = b;
  if (t.find('.') != std::string::npos) {
    while (t.back() == '0') t.pop_back();
    if (t.back() == '.') t.pop_back();
  }
  return t;
}
std::string tableau(const double* v, int n) {
  return "[" + nombreArrondi(v[0], n) + "," + nombreArrondi(v[1], n) + "," + nombreArrondi(v[2], n) + "]";
}
const char* typeSurface(const TopoDS_Face& f) {  // occSurfKind
  try {
    BRepAdaptor_Surface ad(f, true);
    switch (ad.GetType()) {
      case GeomAbs_Plane: return "Plane";
      case GeomAbs_Cylinder: return "Cylinder";
      case GeomAbs_Cone: return "Cone";
      case GeomAbs_Sphere: return "Sphere";
      case GeomAbs_Torus: return "Torus";
      case GeomAbs_BezierSurface: return "BezierSurface";
      case GeomAbs_BSplineSurface: return "BSplineSurface";
      case GeomAbs_SurfaceOfRevolution: return "SurfaceOfRevolution";
      case GeomAbs_SurfaceOfExtrusion: return "SurfaceOfExtrusion";
      case GeomAbs_OffsetSurface: return "OffsetSurface";
      default: return "OtherSurface";
    }
  } catch (const Standard_Failure&) {
    return "?";
  }
}
// occFaceRefAny : centre, dimensions, normale sortante si plan ou cylindre, type de surface
bool boiteFace(const TopoDS_Face& f, Vec3& pos, Vec3& dim) {  // occFaceBox
  Bnd_Box b;
  BRepBndLib::Add(f, b, true);
  if (b.IsVoid()) return false;
  const gp_Pnt A = b.CornerMin(), Z = b.CornerMax();
  pos = {(A.X() + Z.X()) / 2, (A.Y() + Z.Y()) / 2, (A.Z() + Z.Z()) / 2};
  dim = {Z.X() - A.X(), Z.Y() - A.Y(), Z.Z() - A.Z()};
  return true;
}
bool normaleFace(const TopoDS_Face& f, double v[3]) {  // occFaceOutNormal
  BRepAdaptor_Surface ad(f, true);
  gp_Dir n;
  if (ad.GetType() == GeomAbs_Plane) n = ad.Plane().Axis().Direction();
  else if (ad.GetType() == GeomAbs_Cylinder) n = ad.Cylinder().Axis().Direction();
  else return false;
  if (f.Orientation() == TopAbs_REVERSED) n.Reverse();
  v[0] = n.X();
  v[1] = n.Y();
  v[2] = n.Z();
  return true;
}
std::string referenceFace(const TopoDS_Face& f, std::string& st) {
  Vec3 p, d;
  if (!boiteFace(f, p, d)) return "";
  const double pos[3] = {p[0], p[1], p[2]}, dim[3] = {d[0], d[1], d[2]};
  std::string r = "{\"pos\":" + tableau(pos, 3) + ",\"dim\":" + tableau(dim, 3);
  double v[3];
  if (normaleFace(f, v)) r += ",\"n\":" + tableau(v, 4);
  st = typeSurface(f);
  return r + ",\"st\":\"" + st + "\"}";
}
// occCurvePts, partie des courbes libres : on coupe en deux tant que la courbe s'écarte de sa corde
int segmentsVises(const BRepAdaptor_Curve& ad, double u0, double u1) {
  const auto dev = [&](double a, double b) {
    const gp_Pnt A = ad.Value(a), B = ad.Value(b), M = ad.Value((a + b) / 2);
    return hyp3(M.X() - (A.X() + B.X()) / 2, M.Y() - (A.Y() + B.Y()) / 2, M.Z() - (A.Z() + B.Z()) / 2);
  };
  const size_t cap = 256;
  std::vector<std::array<double, 2>> pile{{u0, u1}}, feuilles;
  while (!pile.empty() && feuilles.size() < cap) {
    const auto s = pile.back();
    pile.pop_back();
    if (dev(s[0], s[1]) > TOL_COURBE) {
      const double m = (s[0] + s[1]) / 2;
      pile.push_back({m, s[1]});
      pile.push_back({s[0], m});
    } else {
      feuilles.push_back(s);
    }
  }
  std::sort(feuilles.begin(), feuilles.end(), [](const auto& a, const auto& b) { return a[0] < b[0]; });
  double dernier = u0;
  int n = 0;
  for (const auto& l : feuilles)
    if (l[1] > dernier + 1e-12) {
      dernier = l[1];
      n++;
    }
  return n;
}
bool dansSecteur(double a, double a1, double a2) {  // angInArc
  double d = std::fmod(a2 - a1, TAU);
  if (d < 0) d += TAU;
  double r = std::fmod(a - a1, TAU);
  if (r < 0) r += TAU;
  return r <= d;
}
bool primitive(const TopoDS_Edge& e, const Esquisse& B, CourbeSection& c) {  // occIsectEdgePrim
  try {
    BRepAdaptor_Curve ad(e);
    const double u0 = ad.FirstParameter(), u1 = ad.LastParameter();
    if (!(u1 > u0)) return false;
    const auto P3 = [&](double u) {
      const gp_Pnt p = ad.Value(u);
      return Vec3{p.X(), p.Y(), p.Z()};
    };
    const Vec3 a3 = P3(u0), b3 = P3(u1), m3 = P3((u0 + u1) / 2);
    const Vec3 a = versPlan(B, a3), b = versPlan(B, b3), m = versPlan(B, m3);
    const bool closed = hyp3(a3[0] - b3[0], a3[1] - b3[1], a3[2] - b3[2]) < 1e-6;
    c.mid3 = m3;
    c.on3 = m3;
    if (ad.GetType() == GeomAbs_Line) {
      if (std::hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) return false;
      c.sorte = CourbeSection::LIGNE;
      c.x1 = a[0];
      c.y1 = a[1];
      c.x2 = b[0];
      c.y2 = b[1];
      return true;
    }
    if (ad.GetType() == GeomAbs_Circle) {
      const gp_Circ k = ad.Circle();
      const gp_Pnt L = k.Location();
      const Vec3 C3{L.X(), L.Y(), L.Z()}, C = versPlan(B, C3);
      c.cx = C[0];
      c.cy = C[1];
      c.r = k.Radius();
      if (closed) {
        c.sorte = CourbeSection::CERCLE;
        c.mid3 = C3;
        return true;
      }
      // arcOrient : le secteur direct de pa à pb doit contenir le milieu réel
      const double a1 = std::atan2(a[1] - C[1], a[0] - C[0]), a2 = std::atan2(b[1] - C[1], b[0] - C[0]), am = std::atan2(m[1] - C[1], m[0] - C[0]);
      const bool garde = dansSecteur(am, a1, a2);
      c.sorte = CourbeSection::ARC;
      c.x1 = garde ? a[0] : b[0];
      c.y1 = garde ? a[1] : b[1];
      c.x2 = garde ? b[0] : a[0];
      c.y2 = garde ? b[1] : a[1];
      c.c3 = C3;
      c.aC3 = true;
      return true;
    }
    c.sorte = CourbeSection::COURBE;
    for (int i = 0; i <= DENSE; i++) {
      const Vec3 q = versPlan(B, P3(u0 + (u1 - u0) * i / DENSE));
      c.dense.push_back({q[0], q[1]});
    }
    c.n = std::max(4, std::min(128, segmentsVises(ad, u0, u1)));
    c.closed = closed;
    return true;
  } catch (const Standard_Failure&) {
    return false;
  }
}
std::string cle5(double v) {  // (Math.round(v*1e5)/1e5).toFixed(5)
  char b[64];
  snprintf(b, sizeof b, "%.5f", std::floor(v * 1e5 + 0.5) / 1e5);
  return b;
}
// Un trou percé a sa face cylindrique coupée en deux par sa couture : deux demi-arcs qui ferment le tour font un cercle
std::vector<CourbeSection> fusionnerArcs(const std::vector<CourbeSection>& L) {
  std::vector<CourbeSection> out;
  std::vector<std::pair<std::string, std::vector<const CourbeSection*>>> G;
  for (const CourbeSection& c : L) {
    if (c.sorte != CourbeSection::ARC) {
      out.push_back(c);
      continue;
    }
    const std::string k = cle5(c.cx) + "," + cle5(c.cy) + "," + cle5(c.r);
    auto it = std::find_if(G.begin(), G.end(), [&](const auto& g) { return g.first == k; });
    if (it == G.end()) {
      G.push_back({k, {}});
      it = G.end() - 1;
    }
    it->second.push_back(&c);
  }
  for (const auto& g : G) {
    double tour = 0;
    for (const CourbeSection* a : g.second) {
      double d = std::atan2(a->y2 - a->cy, a->x2 - a->cx) - std::atan2(a->y1 - a->cy, a->x1 - a->cx);
      while (d <= 0) d += TAU;
      tour += d;
    }
    if (g.second.size() < 2 || std::abs(tour - TAU) > 1e-4) {
      for (const CourbeSection* a : g.second) out.push_back(*a);
      continue;
    }
    const CourbeSection& a0 = *g.second[0];
    CourbeSection c;
    c.sorte = CourbeSection::CERCLE;
    c.cx = a0.cx;
    c.cy = a0.cy;
    c.r = a0.r;
    c.mid3 = a0.aC3 ? a0.c3 : a0.mid3;
    c.on3 = a0.on3;
    c.solide = a0.solide;
    c.st = a0.st;
    for (const CourbeSection* a : g.second)
      if (!a->fk.empty() && std::find(c.fks.begin(), c.fks.end(), a->fk) == c.fks.end()) {
        c.fks.push_back(a->fk);
        c.refs.push_back(a->ref);
      }
    if (!c.fks.empty()) {
      c.fk = c.fks[0];
      c.ref = c.refs[0];
    }
    out.push_back(std::move(c));
  }
  return out;
}
double distSegment(double px, double py, double ax, double ay, double bx, double by) {
  const double dx = bx - ax, dy = by - ay;
  double L2 = dx * dx + dy * dy;
  if (L2 == 0) L2 = 1e-9;
  const double t = std::max(0.0, std::min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2));
  return std::hypot(px - (ax + t * dx), py - (ay + t * dy));
}
double distance2D(const CourbeSection& c, double x, double y) {  // isectDistTo
  if (c.sorte == CourbeSection::LIGNE) return distSegment(x, y, c.x1, c.y1, c.x2, c.y2);
  if (c.sorte == CourbeSection::CERCLE) return std::abs(std::hypot(x - c.cx, y - c.cy) - c.r);
  if (c.sorte == CourbeSection::ARC) {
    const double a1 = std::atan2(c.y1 - c.cy, c.x1 - c.cx), a2 = std::atan2(c.y2 - c.cy, c.x2 - c.cx);
    if (dansSecteur(std::atan2(y - c.cy, x - c.cx), a1, a2)) return std::abs(std::hypot(x - c.cx, y - c.cy) - c.r);
    return std::min(std::hypot(x - c.x1, y - c.y1), std::hypot(x - c.x2, y - c.y2));
  }
  double d = 1e18;
  for (size_t i = 0; i + 1 < c.dense.size(); i++) d = std::min(d, distSegment(x, y, c.dense[i][0], c.dense[i][1], c.dense[i + 1][0], c.dense[i + 1][1]));
  return d;
}
double distance3D(const Esquisse& B, const CourbeSection& c, const Vec3& pt) {  // isectDist3
  const Vec3 q = versPlan(B, pt);
  return std::hypot(distance2D(c, q[0], q[1]), q[2]);
}
}  // namespace

struct SectionsEsquisse::Impl {
  Document doc;
  size_t rang;
  bool forme = false, faites = false;
  TopoDS_Shape solide;
  std::vector<CourbeSection> cand;
  std::map<std::string, TopoDS_Face> faces;  // la face de chaque clé rencontrée

  Impl(const Document& d, size_t i) : doc(d), rang(i) {}
  const Esquisse& esq() const { return doc.esquisses[rang]; }
  const TopoDS_Shape& laForme() {  // skIsectWithShape : le solide avant la fonction qui consomme l'esquisse, sinon le solide fini
    if (!forme) {
      forme = true;
      int k = -1;
      for (size_t f = 0; f < doc.fonctions.size(); f++)
        if (k < 0 && doc.fonctions[f].visible && doc.fonctions[f].esquisse == esq().id) k = static_cast<int>(f);
      try {
        solide = rejouer(doc, k).forme;
      } catch (const std::exception&) {
      } catch (const Standard_Failure&) {
      }
    }
    return solide;
  }
  std::vector<CourbeSection> section(const TopoDS_Shape& cible, bool avecFaces) {  // occIsectSection
    std::vector<CourbeSection> out;
    const Esquisse& B = esq();
    try {
      const gp_Pln pln(gp_Pnt(B.o[0], B.o[1], B.o[2]), gp_Dir(B.n[0], B.n[1], B.n[2]));
      BRepAlgoAPI_Section sec(cible, pln, false);
      sec.Build();
      if (!sec.IsDone()) return out;
      for (TopExp_Explorer ex(sec.Shape(), TopAbs_EDGE); ex.More(); ex.Next()) {
        const TopoDS_Edge e = TopoDS::Edge(ex.Current());
        CourbeSection c;
        if (!primitive(e, B, c)) continue;
        if (avecFaces) {
          TopoDS_Face f;
          if (sec.HasAncestorFaceOn1(e, f)) {
            const std::string ref = referenceFace(f, c.st);
            if (!ref.empty()) {
              c.fk = c.ref = ref;
              faces.emplace(ref, f);
            }
          }
        }
        out.push_back(std::move(c));
      }
    } catch (const Standard_Failure&) {
    }
    return fusionnerArcs(out);
  }
  nlohmann::json ancreDe(const Vec3& pos) {  // xAnchorFor
    AncreArete a;
    nlohmann::json j;
    if (ancrePour(doc, pos, a) && a.existe) {
      j = {{"t", a.t}, {"sk", a.sk}, {"id", a.id}, {"z", a.z}, {"far", a.loin ? 1 : 0}};
      if (a.aSide) {
        j["side"] = a.side;
        j["dist"] = a.dist;
      }
    }
    return j;
  }
  // Une face tout juste choisie : son ancre est prise maintenant, tant que l'esquisse dit encore où elle se trouve
  std::string ancree(const std::string& ref) {
    const nlohmann::json r = nlohmann::json::parse(ref, nullptr, false);
    if (!r.is_object() || !r.contains("n") || r.contains("anchor") || !r.contains("pos")) return ref;
    const nlohmann::json a = ancreDe({r["pos"][0].get<double>(), r["pos"][1].get<double>(), r["pos"][2].get<double>()});
    if (!a.is_object()) return ref;
    std::string t = ref;
    t.pop_back();
    return t + ",\"anchor\":" + a.dump() + "}";
  }
  // occFindFaceAny, sans les noms de faces (pas encore repris) : la face que désigne une référence lue au fichier
  bool retrouver(const std::string& refJson, TopoDS_Face& face, std::string& nouvelle) {
    const nlohmann::json ref = nlohmann::json::parse(refJson, nullptr, false);
    if (!ref.is_object() || !ref.contains("pos") || !ref.contains("dim")) return false;
    const Vec3 rp{ref["pos"][0].get<double>(), ref["pos"][1].get<double>(), ref["pos"][2].get<double>()};
    const Vec3 rd{ref["dim"][0].get<double>(), ref["dim"][1].get<double>(), ref["dim"][2].get<double>()};
    const std::string rst = ref.value("st", "");
    const bool aN = ref.contains("n") && ref["n"].is_array();
    nlohmann::json ancre = ref.value("anchor", nlohmann::json());
    if (aN && !ancre.is_object()) ancre = ancreDe(rp);  // ancien projet : recalée sur la position, comme les congés
    struct Cand {
      TopoDS_Face f;
      Vec3 pos, dim;
    };
    std::vector<Cand> tout;
    for (TopExp_Explorer ex(laForme(), TopAbs_FACE); ex.More(); ex.Next()) {
      Cand c;
      c.f = TopoDS::Face(ex.Current());
      if (boiteFace(c.f, c.pos, c.dim)) tout.push_back(std::move(c));
    }
    const auto distPos = [&](const Cand& c) { return hyp3(c.pos[0] - rp[0], c.pos[1] - rp[1], c.pos[2] - rp[2]); };
    const auto ddOf = [&](const Cand& c) { return std::abs(c.dim[0] - rd[0]) + std::abs(c.dim[1] - rd[1]) + std::abs(c.dim[2] - rd[2]); };
    const Cand* trouve = nullptr;
    if (aN) {
      const double rn[3] = {ref["n"][0].get<double>(), ref["n"][1].get<double>(), ref["n"][2].get<double>()};
      std::vector<const Cand*> cands;
      for (const Cand& c : tout) {
        double n[3];
        if (normaleFace(c.f, n) && n[0] * rn[0] + n[1] * rn[1] + n[2] * rn[2] >= 0.9) cands.push_back(&c);
      }
      // faceAnchorScore : la face est-elle encore celle que l'ancre désigne ? Test en 2D d'esquisse.
      const auto score = [&](const Cand& c, const Vec3& dimRef, double& s) {
        if (!ancre.is_object()) return false;
        const Esquisse* E = nullptr;
        for (const Esquisse& k : doc.esquisses)
          if (k.id == ancre.value("sk", "")) E = &k;
        if (!E) return false;
        const Vec3 q = versPlan(*E, c.pos);
        const auto plages = plagesExtrusions(doc, E->id);
        if (!plages.empty() && std::none_of(plages.begin(), plages.end(), [&](const auto& d) { return q[2] >= d.first - 1.5 && q[2] <= d.second + 1.5; })) return false;
        const std::string id = ancre.value("id", "");
        if (ancre.value("t", "") == "p") {
          const Pt* p = E->point(id);
          if (!p || std::hypot(q[0] - p->x, q[1] - p->y) > 5.0) return false;
        } else {
          const Entite* e = nullptr;
          for (const Entite& x : E->entites)
            if (x.id == id) e = &x;
          if (!e || e->construction) return false;
          double d2;
          if (e->t == "line") {
            const Pt* A = E->point(e->p1);
            const Pt* B = E->point(e->p2);
            if (!A || !B) return false;
            d2 = distSegment(q[0], q[1], A->x, A->y, B->x, B->y);
          } else if (e->t == "circle" || e->t == "arc") {
            const Pt* C = E->point(e->pc);
            if (!C || !(e->r > 0)) return false;
            if (e->t == "arc") {
              const auto an = anglesArc(*E, *e);
              if (!an) return false;
              const double rel = std::fmod(std::fmod(std::atan2(q[1] - C->y, q[0] - C->x) - an->a1, TAU) + TAU, TAU);
              if (rel > an->a2 - an->a1 + 0.05) return false;
            }
            d2 = std::abs(std::hypot(q[0] - C->x, q[1] - C->y) - e->r);
          } else {
            return false;
          }
          if (d2 > 5.0) return false;
        }
        const double dd = std::abs(c.dim[0] - dimRef[0]) + std::abs(c.dim[1] - dimRef[1]) + std::abs(c.dim[2] - dimRef[2]);
        if (dd > std::max(2.0, 0.35 * (std::abs(dimRef[0]) + std::abs(dimRef[1]) + std::abs(dimRef[2])))) return false;
        s = 0.15 * dd + 0.02 * distPos(c);
        return true;
      };
      // Passe 1a : cohérence d'ancre
      double bs = 1e18;
      for (const Cand* c : cands) {
        double s;
        if (score(*c, rd, s) && s < bs) {
          bs = s;
          trouve = c;
        }
      }
      // Passe 1b : identité sans ambiguïté
      if (!trouve) {
        std::vector<const Cand*> uniq;
        for (const Cand* c : cands) {
          bool ok = true;
          for (int i = 0; i < 3; i++)
            if (std::abs(c->dim[i] - rd[i]) > std::max(1.5, 0.25 * std::abs(rd[i]))) ok = false;
          if (ok) uniq.push_back(c);
        }
        if (uniq.size() == 1) trouve = uniq[0];
      }
      // Passe 2 : proximité, 2,5 mm au plus
      if (!trouve) {
        double bn = 1e18;
        const Cand* b = nullptr;
        for (const Cand* c : cands) {
          const double sc = distPos(*c) + 0.1 * ddOf(*c);
          if (sc < bn && sc < 1e5) {
            bn = sc;
            b = c;
          }
        }
        if (b && bn <= 2.5) trouve = b;
      }
      // Repli : l'extrusion en amont a changé de hauteur, l'ancre suffit
      if (!trouve && ancre.is_object()) {
        bs = 1e18;
        for (const Cand& c : tout) {
          double n[3], s;
          if ((rst.empty() || rst == typeSurface(c.f)) && normaleFace(c.f, n) && n[0] * rn[0] + n[1] * rn[1] + n[2] * rn[2] >= 0.9 && score(c, c.dim, s) && s < bs) {
            bs = s;
            trouve = &c;
          }
        }
      }
    } else {
      // Face courbe quelconque : même type de surface, la plus proche, à 2,5 mm au plus
      double bs = 1e18;
      for (const Cand& c : tout) {
        if (!rst.empty() && rst != typeSurface(c.f)) continue;
        const double sc = distPos(c) + 0.1 * ddOf(c);
        if (sc < bs) {
          bs = sc;
          trouve = &c;
        }
      }
      if (trouve && bs > 2.5) trouve = nullptr;
    }
    if (!trouve) return false;
    face = trouve->f;
    std::string st;
    nouvelle = referenceFace(face, st);
    if (nouvelle.empty()) return false;
    nouvelle.pop_back();
    if (ancre.is_object()) nouvelle += ",\"anchor\":" + ancre.dump();
    if (ref.contains("nom")) nouvelle += ",\"nom\":" + ref["nom"].dump();
    nouvelle += "}";
    return true;
  }
  std::vector<TopoDS_Shape> solides() {  // occIsectSolids
    std::vector<TopoDS_Shape> L;
    for (TopExp_Explorer ex(laForme(), TopAbs_SOLID); ex.More(); ex.Next()) L.push_back(ex.Current());
    if (L.empty()) L.push_back(laForme());
    return L;
  }
};

SectionsEsquisse::SectionsEsquisse(const Document& d, size_t i) : i_(std::make_unique<Impl>(d, i)) {}
SectionsEsquisse::~SectionsEsquisse() = default;

const std::vector<CourbeSection>& SectionsEsquisse::candidates() {
  if (!i_->faites) {
    i_->faites = true;
    if (!i_->laForme().IsNull()) {
      int k = 0;
      for (const TopoDS_Shape& so : i_->solides()) {
        for (CourbeSection& c : i_->section(so, true)) {
          c.solide = k;
          i_->cand.push_back(std::move(c));
        }
        k++;
      }
    }
  }
  return i_->cand;
}

bool SectionsEsquisse::courbesDe(const SourceIntersection& src, std::vector<CourbeSection>& out, SourceIntersection& reb) {
  if (i_->laForme().IsNull()) return false;
  reb = src;
  out.clear();
  if (src.mode == "faces") {
    std::vector<CourbeSection> L;
    reb.faces.clear();
    for (const std::string& ref : src.faces) {
      TopoDS_Face f;
      std::string nouvelle = ref;
      auto it = i_->faces.find(ref);
      if (it != i_->faces.end()) {
        f = it->second;
        nouvelle = i_->ancree(ref);
      } else if (!i_->retrouver(ref, f, nouvelle)) {  // face perdue : l'ancienne référence est gardée
        reb.faces.push_back(ref);
        continue;
      }
      reb.faces.push_back(nouvelle);
      for (CourbeSection& c : i_->section(f, false)) L.push_back(std::move(c));
    }
    out = fusionnerArcs(L);
    return true;
  }
  // Corps : le solide dont la section passe au plus près de pt (tous si pt est nul)
  double bd = 1e18;
  for (const TopoDS_Shape& so : i_->solides()) {
    std::vector<CourbeSection> cs = i_->section(so, false);
    if (cs.empty()) continue;
    if (!src.aPt) {
      for (CourbeSection& c : cs) out.push_back(std::move(c));
      continue;
    }
    double d = 1e18;
    for (const CourbeSection& c : cs) d = std::min(d, distance3D(i_->esq(), c, src.pt));
    if (d < bd) {
      bd = d;
      out = std::move(cs);
    }
  }
  if (src.aPt && !out.empty()) {
    const CourbeSection* bc = nullptr;
    double b2 = 1e18;
    for (const CourbeSection& c : out) {
      const double d = distance3D(i_->esq(), c, src.pt);
      if (d < b2) {
        b2 = d;
        bc = &c;
      }
    }
    if (bc) reb.pt = bc->on3;
  }
  return true;
}

bool suivreIntersection(Esquisse& t, Entite& e, SectionsEsquisse& S) {
  const nlohmann::json j = nlohmann::json::parse(e.isectJson, nullptr, false);
  if (!j.is_object() || j.value("mode", "") == "mesh") return false;
  SourceIntersection src;
  src.mode = j.value("mode", "");
  if (auto p = j.find("pt"); p != j.end() && p->is_array() && p->size() == 3) {
    src.aPt = true;
    src.pt = {(*p)[0].get<double>(), (*p)[1].get<double>(), (*p)[2].get<double>()};
  }
  if (auto f = j.find("faces"); f != j.end() && f->is_array())
    for (const auto& r : *f) src.faces.push_back(r.dump());
  std::vector<CourbeSection> L;
  SourceIntersection reb;
  if (!S.courbesDe(src, L, reb) || L.empty()) return false;
  const std::string nouvelle = sourceEnJson(reb);
  if (nlohmann::json::parse(nouvelle) != j) e.isectJson = nouvelle;  // sinon le texte d'origine est gardé
  const CourbeSection::Sorte voulu = e.t == "spline" ? CourbeSection::COURBE : e.t == "circle" ? CourbeSection::CERCLE : e.t == "arc" ? CourbeSection::ARC : CourbeSection::LIGNE;
  const auto P = [&](const std::string& id) -> Pt* {
    auto q = t.points.find(id);
    return q == t.points.end() ? nullptr : &q->second;
  };
  // Le candidat le plus proche du milieu 3D mémorisé (identité), sinon de la position 2D
  double hx, hy;
  if (e.t == "circle") {
    const Pt* C = P(e.pc);
    if (!C) return false;
    hx = C->x;
    hy = C->y;
  } else if (e.t == "spline") {
    double sx = 0, sy = 0;
    int n = 0;
    for (const std::string& id : e.pts)
      if (const Pt* q = P(id)) {
        sx += q->x;
        sy += q->y;
        n++;
      }
    if (!n) return false;
    hx = sx / n;
    hy = sy / n;
  } else {
    const Pt* A = P(e.t == "arc" ? e.pa : e.p1);
    const Pt* B = P(e.t == "arc" ? e.pb : e.p2);
    if (!A || !B) return false;
    hx = (A->x + B->x) / 2;
    hy = (A->y + B->y) / 2;
  }
  const CourbeSection* best = nullptr;
  double bs = 1e18;
  for (const CourbeSection& c : L) {
    if (c.sorte != voulu) continue;
    const double s = e.aSrcMid ? hyp3(c.mid3[0] - e.srcMid[0], c.mid3[1] - e.srcMid[1], c.mid3[2] - e.srcMid[2]) : distance2D(c, hx, hy);
    if (s < bs) {
      bs = s;
      best = &c;
    }
  }
  if (!best) return false;
  e.aSrcMid = true;
  e.srcMid = best->mid3;
  bool bouge = false;
  if (e.t == "spline") {
    if (!e.isplN || best->dense.size() < 2) return false;
    // Mêmes n points de passage, ordre conservé
    const int N = static_cast<int>(best->dense.size()) - 1;
    std::vector<std::array<double, 2>> Q;
    for (int i = 0; i <= e.isplN; i++) {
      const double ft = static_cast<double>(i) / e.isplN * N;
      const int k = std::min(N - 1, static_cast<int>(std::floor(ft)));
      const double w = ft - k;
      Q.push_back({best->dense[k][0] + (best->dense[k + 1][0] - best->dense[k][0]) * w, best->dense[k][1] + (best->dense[k + 1][1] - best->dense[k][1]) * w});
    }
    if (e.closed) Q.pop_back();
    std::vector<Pt*> cur;
    for (const std::string& id : e.pts) cur.push_back(P(id));
    if (Q.size() != cur.size() || std::find(cur.begin(), cur.end(), nullptr) != cur.end()) return false;
    double dF = 0, dR = 0;
    for (size_t i = 0; i < cur.size(); i++) {
      dF += std::hypot(cur[i]->x - Q[i][0], cur[i]->y - Q[i][1]);
      dR += std::hypot(cur[i]->x - Q[Q.size() - 1 - i][0], cur[i]->y - Q[Q.size() - 1 - i][1]);
    }
    if (dR < dF) std::reverse(Q.begin(), Q.end());
    for (size_t i = 0; i < cur.size(); i++)
      if (std::hypot(cur[i]->x - Q[i][0], cur[i]->y - Q[i][1]) > 1e-6) {
        cur[i]->x = Q[i][0];
        cur[i]->y = Q[i][1];
        bouge = true;
      }
  } else if (e.t == "line") {
    Pt* A = P(e.p1);
    Pt* B = P(e.p2);
    const double d1 = std::hypot(A->x - best->x1, A->y - best->y1) + std::hypot(B->x - best->x2, B->y - best->y2);
    const double d2 = std::hypot(A->x - best->x2, A->y - best->y2) + std::hypot(B->x - best->x1, B->y - best->y1);
    if (std::min(d1, d2) > 0.02) {
      if (d2 < d1) {
        A->x = best->x2;
        A->y = best->y2;
        B->x = best->x1;
        B->y = best->y1;
      } else {
        A->x = best->x1;
        A->y = best->y1;
        B->x = best->x2;
        B->y = best->y2;
      }
      bouge = true;
    }
  } else if (e.t == "circle") {
    Pt* C = P(e.pc);
    if (std::hypot(C->x - best->cx, C->y - best->cy) > 0.02 || std::abs(e.r - best->r) > 0.02) {
      C->x = best->cx;
      C->y = best->cy;
      e.r = best->r;
      bouge = true;
    }
  } else if (e.t == "arc") {
    Pt* C = P(e.pc);
    Pt* A = P(e.pa);
    Pt* B = P(e.pb);
    if (!C || !A || !B) return false;
    if (std::hypot(C->x - best->cx, C->y - best->cy) > 0.02 || std::hypot(A->x - best->x1, A->y - best->y1) > 0.02 || std::hypot(B->x - best->x2, B->y - best->y2) > 0.02 || std::abs(e.r - best->r) > 0.02) {
      C->x = best->cx;
      C->y = best->cy;
      A->x = best->x1;
      A->y = best->y1;
      B->x = best->x2;
      B->y = best->y2;
      e.r = best->r;
      bouge = true;
    }
  }
  return bouge;
}
