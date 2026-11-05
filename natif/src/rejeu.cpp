#include "rejeu.h"

#include <BOPAlgo_Options.hxx>
#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepAlgoAPI_Cut.hxx>
#include <BRepAlgoAPI_Fuse.hxx>
#include <BRepBndLib.hxx>
#include <BRepBuilderAPI_MakeEdge.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakeWire.hxx>
#include <BRepCheck_Analyzer.hxx>
#include <BRepGProp.hxx>
#include <BRepMesh_IncrementalMesh.hxx>
#include <BRepPrimAPI_MakePrism.hxx>
#include <BRep_Builder.hxx>
#include <Bnd_Box.hxx>
#include <GProp_GProps.hxx>
#include <ShapeUpgrade_UnifySameDomain.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Compound.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Wire.hxx>
#include <gp_Ax2.hxx>
#include <gp_Circ.hxx>
#include <gp_Cone.hxx>
#include <gp_Cylinder.hxx>
#include <gp_Dir.hxx>
#include <gp_Pln.hxx>
#include <gp_Pnt.hxx>
#include <gp_Sphere.hxx>
#include <gp_Torus.hxx>
#include <gp_Vec.hxx>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <map>
#include <optional>
#include <stdexcept>

#include "contours.h"

namespace {
const double PI = 3.14159265358979323846, TAU = PI * 2;
bool gParallele = true;

double arrondi3(double v) {  // +v.toFixed(3)
  char b[64];
  snprintf(b, sizeof b, "%.3f", v);
  return strtod(b, nullptr);
}
double produit(const Vec3& a, const Vec3& b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

struct Plage {
  double lo = 0, hi = 0, far = 1;
  bool nonMesuree = false;
};

std::optional<Plage> plageSurForme(const TopoDS_Shape& s, const Esquisse& e) {  // occSpanFromShape
  if (s.IsNull()) return std::nullopt;
  Bnd_Box box;
  BRepBndLib::Add(s, box, true);
  gp_Pnt a = box.CornerMin(), b = box.CornerMax();
  double mn = 1e300, mx = -1e300;
  for (double x : {a.X(), b.X()})
    for (double y : {a.Y(), b.Y()})
      for (double z : {a.Z(), b.Z()}) {
        double d = (x - e.o[0]) * e.n[0] + (y - e.o[1]) * e.n[1] + (z - e.o[2]) * e.n[2];
        mn = std::min(mn, d);
        mx = std::max(mx, d);
      }
  if (!(mx > mn && std::isfinite(mn) && std::isfinite(mx))) return std::nullopt;
  double m = std::max(1.0, (mx - mn) * 0.01);
  return Plage{mn - m, mx + m};
}

Plage plageDe(const Fonction& f, const Esquisse* e, const TopoDS_Shape& base) {  // extrudeSpan
  auto retourne = [&](Plage p) {
    if (f.flip) {
      double lo = p.lo;
      p.lo = -p.hi;
      p.hi = -lo;
      p.far = -p.far;
    }
    return p;
  };
  if (f.through) {
    if (e)
      if (auto r = plageSurForme(base, *e)) return retourne(*r);
    Plage p{-5000, 5000, 1, true};
    return retourne(p);
  }
  double raw = f.aDistance && std::isfinite(f.distance) ? f.distance : 10;
  Plage p;
  if (f.mid) {
    double h = std::abs(raw) / 2;
    p = Plage{-h, h, raw < 0 ? -1.0 : 1.0};
  } else {
    p = Plage{std::min(0.0, raw), std::max(0.0, raw), raw < 0 ? -1.0 : 1.0};
  }
  return retourne(p);
}

bool replacerHote(Document& d, Esquisse& s) {  // resolveSketchHost
  if (!s.hote.existe) return false;
  const Fonction* hf = d.fonction(s.hote.feat);
  if (!hf) return false;
  const Esquisse* hs = d.esquisse(hf->esquisse);
  if (!hs) return false;
  Plage sp = plageDe(*hf, hs, TopoDS_Shape());
  if (sp.nonMesuree) return false;
  double x = s.hote.x, y = s.hote.y, h;
  if (s.hote.tag == "SIDE") {
    for (auto& en : hs->entites)
      if (en.id == s.hote.edge && en.t == "line") {
        const Pt* a = hs->point(en.p1);
        const Pt* b = hs->point(en.p2);
        if (a && b) {
          double ex = b->x - a->x, ey = b->y - a->y, L2 = ex * ex + ey * ey;
          if (L2 > 1e-12) {
            double t = ((x - a->x) * ex + (y - a->y) * ey) / L2;
            x = arrondi3(a->x + ex * t);
            y = arrondi3(a->y + ey * t);
          }
        }
        break;
      }
    h = s.hote.aH ? s.hote.h : 0;
    h = std::max(sp.lo, std::min(sp.hi, h));
  } else {
    h = s.hote.tag == "TOP" ? sp.hi : sp.lo;
  }
  Vec3 o2;
  for (int i = 0; i < 3; i++) o2[i] = hs->o[i] + hs->n[i] * h + hs->u[i] * x + hs->v[i] * y;
  if (std::hypot(o2[0] - s.o[0], o2[1] - s.o[1], o2[2] - s.o[2]) < 1e-6) return false;
  for (int i = 0; i < 3; i++) s.o[i] = arrondi3(o2[i]);
  return true;
}

void replacerHotes(Document& d) {  // resolveAllSketchHosts
  for (int pass = 0; pass < 3; pass++) {
    bool bouge = false;
    for (auto& s : d.esquisses)
      if (s.plan == "FACE" && s.hote.existe && replacerHote(d, s)) bouge = true;
    if (!bouge) break;
  }
}

gp_Pnt mondeDe(const Esquisse& s, double x, double y, double z0) {
  return gp_Pnt(s.o[0] + s.u[0] * x + s.v[0] * y + s.n[0] * z0, s.o[1] + s.u[1] * x + s.v[1] * y + s.n[1] * z0,
                s.o[2] + s.u[2] * x + s.v[2] * y + s.n[2] * z0);
}

TopoDS_Wire contourDe(const Esquisse& s, const Trace& tr, const Chaine& chaine, double z0) {  // occWireFromChain
  gp_Dir dir(s.n[0], s.n[1], s.n[2]);
  Vec3 c{s.u[1] * s.v[2] - s.u[2] * s.v[1], s.u[2] * s.v[0] - s.u[0] * s.v[2], s.u[0] * s.v[1] - s.u[1] * s.v[0]};
  const bool gaucher = produit(c, s.n) < 0;  // esquisse miroir : le sens trigo tourne à l'envers
  BRepBuilderAPI_MakeWire mkW;
  auto norm = [](double t) { return std::fmod(std::fmod(t, TAU) + TAU, TAU); };
  for (auto& st : chaine) {
    const Arete& ed = tr.aretes[st.arete];
    const std::string& vers = ed.a == st.depuis ? ed.b : ed.a;
    const Pt& A = tr.pts.at(st.depuis);
    const Pt& B = tr.pts.at(vers);
    if (!ed.arc) {
      BRepBuilderAPI_MakeEdge me(mondeDe(s, A.x, A.y, z0), mondeDe(s, B.x, B.y, z0));
      if (!me.IsDone()) throw std::runtime_error("arête ligne impossible");
      mkW.Add(me.Edge());
      continue;
    }
    const Entite& a = *ed.e;
    auto an = anglesArc(s, a);
    const Pt& Cc = tr.pts.at(a.pc);
    if (!an) throw std::runtime_error("arc invalide");
    gp_Ax2 ax(mondeDe(s, Cc.x, Cc.y, z0), gaucher ? dir.Reversed() : dir);
    gp_Circ circ(ax, a.r);
    if (std::abs((an->a2 - an->a1) - TAU) < 1e-6) {
      BRepBuilderAPI_MakeEdge m1(circ);
      if (!m1.IsDone()) throw std::runtime_error("cercle complet impossible");
      mkW.Add(m1.Edge());
      continue;
    }
    double aF = std::atan2(A.y - Cc.y, A.x - Cc.x), aT = std::atan2(B.y - Cc.y, B.x - Cc.x);
    double dA1 = std::min(norm(aF - an->a1), TAU - norm(aF - an->a1));
    double dA2 = std::min(norm(aF - (an->a2 - TAU)), TAU - norm(aF - (an->a2 - TAU)));
    const bool ccw = dA1 <= dA2;
    auto sur = [&](double t) { return mondeDe(s, Cc.x + a.r * std::cos(t), Cc.y + a.r * std::sin(t), z0); };
    BRepBuilderAPI_MakeEdge me(circ, sur(ccw ? aF : aT), sur(ccw ? aT : aF));
    if (!me.IsDone()) throw std::runtime_error("arête arc impossible");
    TopoDS_Edge e = me.Edge();
    if (!ccw) e = TopoDS::Edge(e.Reversed());
    mkW.Add(e);
  }
  mkW.Build();
  if (!mkW.IsDone()) throw std::runtime_error("contour non fermé");
  return mkW.Wire();
}

TopoDS_Shape prismeDeFace(const TopoDS_Wire& w, const Esquisse& s, double longueur) {
  BRepBuilderAPI_MakeFace fm(w, true);
  if (!fm.IsDone()) throw std::runtime_error("face impossible");
  gp_Vec vec(s.n[0] * longueur, s.n[1] * longueur, s.n[2] * longueur);
  BRepPrimAPI_MakePrism pr(fm.Face(), vec, false, true);
  if (!pr.IsDone()) throw std::runtime_error("prisme impossible");
  return pr.Shape();
}

TopoDS_Shape prismeContour(const Esquisse& s, const Trace& tr, const Chaine& ch, const Plage& sp, double aire) {  // occSpanPrism
  double len = sp.hi - sp.lo;
  if (!(len > 1e-9)) throw std::runtime_error("prisme vide (course nulle)");
  TopoDS_Wire w = contourDe(s, tr, ch, sp.lo);
  if (aire < 0) w = TopoDS::Wire(w.Reversed());
  return prismeDeFace(w, s, len);
}

TopoDS_Shape prismeRond(const Esquisse& s, double cx, double cy, double r, const Plage& sp) {  // occDiskPrism
  double len = sp.hi - sp.lo;
  if (!(len > 1e-9)) throw std::runtime_error("prisme pastille vide (course nulle)");
  gp_Ax2 ax(mondeDe(s, cx, cy, sp.lo), gp_Dir(s.n[0], s.n[1], s.n[2]));
  BRepBuilderAPI_MakeEdge m1{gp_Circ(ax, r)};
  if (!m1.IsDone()) throw std::runtime_error("pastille impossible");
  BRepBuilderAPI_MakeWire mkW(m1.Edge());
  if (!mkW.IsDone()) throw std::runtime_error("pastille non fermée");
  return prismeDeFace(mkW.Wire(), s, len);
}

TopoDS_Shape fusion(const TopoDS_Shape& a, const TopoDS_Shape& b) {
  BRepAlgoAPI_Fuse f(a, b);
  if (!f.IsDone()) throw std::runtime_error("fusion impossible");
  return f.Shape();
}
TopoDS_Shape coupe(const TopoDS_Shape& a, const TopoDS_Shape& b) {
  BRepAlgoAPI_Cut c(a, b);
  if (!c.IsDone()) throw std::runtime_error("découpe impossible");
  return c.Shape();
}

std::optional<gp_Dir> normaleSortante(const TopoDS_Face& f) {  // occFaceOutNormal
  BRepAdaptor_Surface ad(f, true);
  gp_Dir n;
  if (ad.GetType() == GeomAbs_Plane) n = ad.Plane().Axis().Direction();
  else if (ad.GetType() == GeomAbs_Cylinder) n = ad.Cylinder().Axis().Direction();
  else return std::nullopt;
  return f.Orientation() == TopAbs_REVERSED ? n.Reversed() : n;
}

// Garde-fou de occUnifyKeepEdges : le recollage boucle sans fin sur deux faces de révolution de
// même domaine mais de paramétrage incompatible. Leurs arêtes communes restent.
std::vector<TopoDS_Edge> aretesAGarder(const TopoDS_Shape& s) {
  struct Rev {
    TopoDS_Face f;
    int k;
    std::vector<double> sig;
    gp_Pnt P;
    gp_Dir D;
    bool direct;
  };
  std::vector<Rev> R;
  for (TopExp_Explorer ex(s, TopAbs_FACE); ex.More(); ex.Next()) {
    TopoDS_Face f = TopoDS::Face(ex.Current());
    BRepAdaptor_Surface ad(f, true);
    auto t = ad.GetType();
    gp_Ax3 ax;
    int k;
    std::vector<double> sig;
    if (t == GeomAbs_Cylinder) {
      k = 0;
      sig = {ad.Cylinder().Radius()};
      ax = ad.Cylinder().Position();
    } else if (t == GeomAbs_Cone) {
      k = 1;
      gp_Pnt a = ad.Cone().Apex();
      sig = {a.X(), a.Y(), a.Z(), std::abs(ad.Cone().SemiAngle())};
      ax = ad.Cone().Position();
    } else if (t == GeomAbs_Sphere) {
      k = 2;
      sig = {ad.Sphere().Radius()};
      ax = ad.Sphere().Position();
    } else if (t == GeomAbs_Torus) {
      k = 3;
      sig = {ad.Torus().MajorRadius(), ad.Torus().MinorRadius()};
      ax = ad.Torus().Position();
    } else {
      continue;
    }
    R.push_back(Rev{f, k, sig, ax.Location(), ax.Direction(), ax.Direct()});
  }
  std::vector<TopoDS_Edge> out;
  const double tol = 1e-6;
  for (size_t i = 0; i < R.size(); i++)
    for (size_t j = i + 1; j < R.size(); j++) {
      auto& a = R[i];
      auto& b = R[j];
      if (a.k != b.k || a.sig.size() != b.sig.size()) continue;
      bool ecart = false;
      for (size_t n = 0; n < a.sig.size(); n++) ecart = ecart || std::abs(a.sig[n] - b.sig[n]) > tol;
      if (ecart) continue;
      double c = a.D.Dot(b.D);
      if (std::abs(std::abs(c) - 1) > 1e-9) continue;
      gp_Vec w(a.P, b.P);
      double dist = (a.k == 2 || a.k == 3) ? w.Magnitude() : w.Crossed(gp_Vec(a.D)).Magnitude();
      if (dist > tol) continue;
      if (c > 0 && a.direct == b.direct) continue;
      for (TopExp_Explorer ea(a.f, TopAbs_EDGE); ea.More(); ea.Next()) {
        const TopoDS_Shape& e = ea.Current();
        bool commune = false;
        for (TopExp_Explorer eb(b.f, TopAbs_EDGE); eb.More() && !commune; eb.Next()) commune = e.IsSame(eb.Current());
        if (!commune) continue;
        bool deja = false;
        for (auto& x : out) deja = deja || x.IsSame(e);
        if (!deja) out.push_back(TopoDS::Edge(e));
      }
    }
  return out;
}

TopoDS_Shape unifier(const TopoDS_Shape& s) {  // occUnify
  try {
    ShapeUpgrade_UnifySameDomain u(s, true, true, false);
    for (auto& e : aretesAGarder(s)) u.KeepShape(e);
    u.Build();
    TopoDS_Shape r = u.Shape();
    return r.IsNull() ? s : r;
  } catch (const Standard_Failure&) {
    return s;
  }
}

// ---- Découpe : coutures planes parasites (occPlaneSeams, occOnSeam, occUnifyCutSeams, src/20-10) ----
struct Couture {
  TopoDS_Edge e;
  int fi;
  gp_Dir n;
  double d;
  gp_Pnt mid;
  std::vector<gp_Pnt> pts;
  bool pris = false;
};
struct Boite {
  double a[3], z[3];
};
Boite boiteDe(const TopoDS_Shape& s, double m) {
  Bnd_Box b;
  BRepBndLib::Add(s, b, true);
  gp_Pnt a = b.CornerMin(), z = b.CornerMax();
  return Boite{{a.X() - m, a.Y() - m, a.Z() - m}, {z.X() + m, z.Y() + m, z.Z() + m}};
}
std::vector<Couture> coutures(const TopoDS_Shape& s, const Boite* box, bool avecPoints) {
  std::vector<Couture> toutes;
  std::map<std::string, std::vector<size_t>> casiers;
  int fi = 0;
  for (TopExp_Explorer ex(s, TopAbs_FACE); ex.More(); ex.Next(), fi++) {
    TopoDS_Face f = TopoDS::Face(ex.Current());
    if (box) {
      Boite b = boiteDe(f, 0);
      bool touche = true;
      for (int i = 0; i < 3; i++) {
        // occFaceBox donne centre et dimensions : même calcul, mêmes bornes
        double pos = (b.a[i] + b.z[i]) / 2, dim = b.z[i] - b.a[i];
        if (pos + dim / 2 < box->a[i] || pos - dim / 2 > box->z[i]) touche = false;
      }
      if (!touche) continue;
    }
    BRepAdaptor_Surface ad(f, true);
    if (ad.GetType() != GeomAbs_Plane) continue;
    auto n = normaleSortante(f);
    if (!n) continue;
    gp_Pnt L = ad.Plane().Location();
    double d = n->X() * L.X() + n->Y() * L.Y() + n->Z() * L.Z();
    for (TopExp_Explorer ee(f, TopAbs_EDGE); ee.More(); ee.Next()) {
      TopoDS_Edge e = TopoDS::Edge(ee.Current());
      BRepAdaptor_Curve c(e);
      double u0 = c.FirstParameter(), u1 = c.LastParameter();
      gp_Pnt m = c.Value((u0 + u1) / 2);
      char k[96];
      snprintf(k, sizeof k, "%.3f,%.3f,%.3f", m.X(), m.Y(), m.Z());
      auto& casier = casiers[k];
      Couture rec{e, fi, *n, d, m};
      if (casier.empty()) {
        toutes.push_back(std::move(rec));
        casier.push_back(toutes.size() - 1);
        continue;
      }
      for (size_t idx : casier) {
        Couture& o = toutes[idx];
        if (o.fi == fi || !o.e.IsSame(e)) continue;
        // premier jumeau seulement, comme bk.find
        if (o.n.Dot(*n) > 1 - 1e-9 && std::abs(o.d - d) < 1e-6 && !o.pris) {
          if (avecPoints) {
            const int N = 32;
            for (int i = 0; i <= 2 * N; i++) o.pts.push_back(c.Value(u0 + (u1 - u0) * i / (2 * N)));
          }
          o.pris = true;
        }
        break;
      }
      toutes.push_back(std::move(rec));
      casier.push_back(toutes.size() - 1);
    }
  }
  std::vector<Couture> out;
  for (auto& c : toutes)
    if (c.pris) out.push_back(std::move(c));
  return out;
}
bool surCouture(const gp_Pnt& p, const std::vector<gp_Pnt>& pts) {  // occOnSeam
  for (size_t i = 0; i + 2 < pts.size(); i += 2) {
    const gp_Pnt &a = pts[i], &b = pts[i + 2], &h = pts[i + 1];
    gp_Vec ab(a, b);
    double l2 = ab.SquareMagnitude();
    auto dSeg = [&](const gp_Pnt& q) {
      double t = l2 > 0 ? gp_Vec(a, q).Dot(ab) / l2 : 0;
      t = std::max(0.0, std::min(1.0, t));
      return gp_Pnt(a.X() + ab.X() * t, a.Y() + ab.Y() * t, a.Z() + ab.Z() * t).Distance(q);
    };
    if (dSeg(p) <= 1e-4 + 1.5 * dSeg(h)) return true;
  }
  return false;
}
TopoDS_Shape sansCouturesParasites(const TopoDS_Shape& res, const TopoDS_Shape& prev, const TopoDS_Shape& outil) {  // occUnifyCutSeams
  try {
    Boite box = boiteDe(outil, 1e-3);
    auto R = coutures(res, &box, false);
    if (R.empty()) return res;
    auto P = coutures(prev, &box, true), Q = coutures(outil, nullptr, true);
    std::vector<const Couture*> aRetirer;
    for (auto& r : R) {
      bool connue = false;
      for (auto& x : P) connue = connue || surCouture(r.mid, x.pts);
      for (auto& x : Q) connue = connue || surCouture(r.mid, x.pts);
      if (!connue) aRetirer.push_back(&r);
    }
    if (aRetirer.empty()) return res;
    ShapeUpgrade_UnifySameDomain u(res, true, true, false);
    for (TopExp_Explorer ex(res, TopAbs_EDGE); ex.More(); ex.Next()) {
      bool retirer = false;
      for (auto* r : aRetirer) retirer = retirer || r->e.IsSame(ex.Current());
      if (!retirer) u.KeepShape(TopoDS::Edge(ex.Current()));
    }
    u.Build();
    TopoDS_Shape r = u.Shape();
    return r.IsNull() ? res : r;
  } catch (const Standard_Failure&) {
    return res;
  }
}

int microAretes(const TopoDS_Shape& s) {  // occMicroAretes
  int n = 0;
  for (TopExp_Explorer x(s, TopAbs_EDGE); x.More(); x.Next()) {
    GProp_GProps G;
    BRepGProp::LinearProperties(x.Current(), G, false, false);
    if (G.Mass() < 1e-3) n++;
  }
  return n;
}
double volumeDe(const TopoDS_Shape& s) {
  GProp_GProps G;
  BRepGProp::VolumeProperties(s, G, false, false, false);
  return G.Mass();
}

TopoDS_Shape formeExtrusion(const Fonction& f, const Esquisse& s, const TopoDS_Shape& base) {  // occShapeOfExtrude
  Trace tr = tracerContours(s);
  if (tr.solides.empty() && tr.cerclesSeuls.empty()) throw std::runtime_error("profil non fermé");
  Plage sp = plageDe(f, &s, base);
  TopoDS_Shape forme;
  auto ajouter = [&](const TopoDS_Shape& x) { forme = forme.IsNull() ? x : unifier(fusion(forme, x)); };
  for (size_t si = 0; si < tr.solides.size(); si++) {
    auto& sol = tr.solides[si];
    TopoDS_Shape x = prismeContour(s, tr, sol.chaine, sp, sol.aire);
    for (auto& h : sol.trous) x = coupe(x, prismeContour(s, tr, h, sp, 1));
    for (auto& ch : tr.trousRonds) {
      if (ch.solide != static_cast<int>(si)) continue;
      const Pt* C = s.point(ch.cercle->pc);
      if (!C) throw std::runtime_error("pastille : centre introuvable");
      x = coupe(x, prismeRond(s, C->x, C->y, ch.cercle->r, sp));
    }
    ajouter(x);
  }
  for (auto* c : tr.cerclesSeuls) {
    const Pt* C = s.point(c->pc);
    if (!C) throw std::runtime_error("pastille : centre introuvable");
    ajouter(prismeRond(s, C->x, C->y, c->r, sp));
  }
  if (forme.IsNull()) throw std::runtime_error("solide vide");
  return forme;
}

// occCutSansFaceFine : une découpe qui laisse des micro-arêtes est refaite aux tangences exactes
std::optional<TopoDS_Shape> decoupeSansFaceFine(const Fonction& f, const Esquisse& s, const TopoDS_Shape& avant, const TopoDS_Shape& c0) {
  try {
    auto exacte = tangencesExactes(s);
    if (!exacte) return std::nullopt;
    int n = microAretes(c0);
    if (!n || n <= microAretes(avant)) return std::nullopt;
    TopoDS_Shape outil = formeExtrusion(f, *exacte, avant);
    TopoDS_Shape c = sansCouturesParasites(coupe(avant, outil), avant, outil);
    double v0 = volumeDe(c0), v1 = volumeDe(c);
    BRepCheck_Analyzer verif(c, true);
    if (microAretes(c) < n && verif.IsValid() && std::abs(v1 - v0) <= 1e-3) return c;
  } catch (const Standard_Failure&) {
  } catch (const std::exception&) {
  }
  return std::nullopt;
}

TopoDS_Shape rejouerCorps(Document& d, const std::vector<const Fonction*>& liste, std::vector<std::string>& msgs) {
  TopoDS_Shape resultat;
  for (auto* fp : liste) {
    const Fonction& f = *fp;
    if (f.type != "extrude") continue;
    Esquisse* s = d.esquisse(f.esquisse);
    TopoDS_Shape outil;
    try {
      if (!s) throw std::runtime_error("esquisse introuvable");
      outil = formeExtrusion(f, *s, resultat);
    } catch (const Standard_Failure& e) {
      msgs.push_back(f.nom + " : exclu (" + (e.what()) + ")");
      continue;
    } catch (const std::exception& e) {
      msgs.push_back(f.nom + " : exclu (" + e.what() + ")");
      continue;
    }
    try {
      if (f.op == "cut") {
        if (resultat.IsNull()) {
          msgs.push_back(f.nom + " : découpe dans le vide, ignorée");
          continue;
        }
        TopoDS_Shape c = sansCouturesParasites(coupe(resultat, outil), resultat, outil);
        if (auto c2 = decoupeSansFaceFine(f, *s, resultat, c)) c = *c2;
        resultat = c;
      } else {
        resultat = resultat.IsNull() ? outil : unifier(fusion(resultat, outil));
      }
    } catch (const Standard_Failure& e) {
      msgs.push_back(f.nom + " : " + (e.what()));
    } catch (const std::exception& e) {
      msgs.push_back(f.nom + " : " + e.what());
    }
  }
  return resultat;
}
}  // namespace

ResultatRejeu rejouer(Document& d) {
  replacerHotes(d);
  std::vector<std::string> ordre;
  std::map<std::string, std::vector<const Fonction*>> parCorps;
  for (auto& f : d.fonctions) {
    if (!f.visible) continue;
    std::string b = std::find(d.corps.begin(), d.corps.end(), f.corps) != d.corps.end() ? f.corps : d.corps[0];
    if (!parCorps.count(b)) ordre.push_back(b);
    parCorps[b].push_back(&f);
  }
  ResultatRejeu r;
  std::vector<TopoDS_Shape> pieces;
  for (auto& b : ordre) {
    TopoDS_Shape s = rejouerCorps(d, parCorps[b], r.messages);
    if (!s.IsNull()) pieces.push_back(s);
  }
  if (pieces.size() == 1) r.forme = pieces[0];
  else if (pieces.size() > 1) {
    TopoDS_Compound comp;
    BRep_Builder bd;
    bd.MakeCompound(comp);
    for (auto& s : pieces) bd.Add(comp, s);
    r.forme = comp;
  }
  return r;
}

Mesures mesurer(const TopoDS_Shape& s) {
  Mesures m;
  if (s.IsNull()) return m;
  m.volume = volumeDe(s);
  GProp_GProps G;
  BRepGProp::SurfaceProperties(s, G, false, false);
  m.aire = G.Mass();
  auto compter = [&](TopAbs_ShapeEnum t) {
    int n = 0;
    for (TopExp_Explorer x(s, t); x.More(); x.Next()) n++;
    return n;
  };
  m.faces = compter(TopAbs_FACE);
  m.aretes = compter(TopAbs_EDGE);
  m.sommets = compter(TopAbs_VERTEX);
  m.solides = compter(TopAbs_SOLID);
  BRepCheck_Analyzer verif(s, true);
  m.valide = verif.IsValid();
  Bnd_Box b;
  BRepBndLib::Add(s, b, true);
  gp_Pnt a = b.CornerMin(), z = b.CornerMax();
  double v[6] = {a.X(), a.Y(), a.Z(), z.X(), z.Y(), z.Z()};
  std::copy(v, v + 6, m.boite);
  return m;
}

void mailler(const TopoDS_Shape& s, bool par) {
  Bnd_Box b;
  BRepBndLib::Add(s, b, true);
  double dg = b.IsVoid() ? 100 : b.CornerMin().Distance(b.CornerMax());
  double lin = std::min(0.35, std::max(0.05, dg / 1600));
  BRepMesh_IncrementalMesh m(s, lin, false, 0.2, par);
}

void reglerParallele(bool actif) {
  gParallele = actif;
  BOPAlgo_Options::SetParallelMode(actif);
}
bool parallele() { return gParallele; }
