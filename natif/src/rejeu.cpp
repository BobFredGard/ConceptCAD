#include "rejeu.h"

#include <charconv>

#include <BOPAlgo_Options.hxx>
#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepAlgoAPI_Cut.hxx>
#include <BRepAlgoAPI_Fuse.hxx>
#include <BRepBndLib.hxx>
#include <BRepClass_FaceClassifier.hxx>
#include <BRepTools.hxx>
#include <IntCurvesFace_ShapeIntersector.hxx>
#include <gp_Lin.hxx>
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
#include <Geom_BSplineCurve.hxx>
#include <TColStd_Array1OfInteger.hxx>
#include <TColStd_Array1OfReal.hxx>
#include <TColgp_Array1OfPnt.hxx>
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
#include <chrono>
#include <cmath>
#include <cstdio>
#include <map>
#include <optional>
#include <stdexcept>

#include "conges.h"
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
    if (ed.spline) {
      // B-spline exacte : mêmes pôles et nœuds que le dessin 2D, posés dans le plan comme les lignes
      const BSpline& bs = ed.bs;
      if (static_cast<int>(bs.P.size()) < bs.p + 1) throw std::runtime_error("spline invalide");
      TColgp_Array1OfPnt poles(1, static_cast<int>(bs.P.size()));
      for (size_t i = 0; i < bs.P.size(); i++) poles.SetValue(static_cast<int>(i) + 1, mondeDe(s, bs.P[i][0], bs.P[i][1], z0));
      std::vector<double> kv;  // skBsKnotMults : nœuds distincts et multiplicités
      std::vector<int> mv;
      for (double v : bs.U) {
        if (!kv.empty() && kv.back() == v) mv.back()++;
        else {
          kv.push_back(v);
          mv.push_back(1);
        }
      }
      TColStd_Array1OfReal kn(1, static_cast<int>(kv.size()));
      TColStd_Array1OfInteger mu(1, static_cast<int>(kv.size()));
      for (size_t i = 0; i < kv.size(); i++) {
        kn.SetValue(static_cast<int>(i) + 1, kv[i]);
        mu.SetValue(static_cast<int>(i) + 1, mv[i]);
      }
      Handle(Geom_BSplineCurve) courbe = new Geom_BSplineCurve(poles, kn, mu, bs.p, false);
      BRepBuilderAPI_MakeEdge me(courbe);
      if (!me.IsDone()) throw std::runtime_error("arête spline impossible");
      TopoDS_Edge e = me.Edge();
      if (ed.a != st.depuis) e = TopoDS::Edge(e.Reversed());
      mkW.Add(e);
      continue;
    }
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
  // Des traits qui se croisent peuvent faire s'effondrer la fusion : ne jamais montrer ce qui reste comme un solide
  if (std::abs(volumeDe(forme)) < 1e-6) throw std::runtime_error("solide vide : les traits de l'esquisse se croisent peut-être");
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

// occThroughBase : le solide d'avant la dernière extrusion « à travers tout », seule mesure de son étendue pendant le rejeu
TopoDS_Shape gBaseTraversante;

TopoDS_Shape rejouerCorps(Document& d, const std::vector<Fonction*>& liste, std::vector<std::string>& msgs) {
  TopoDS_Shape resultat;
  for (auto* fp : liste) {
    Fonction& f = *fp;
    if (f.type == "xfillet") {
      if (resultat.IsNull()) {
        msgs.push_back(f.nom + " : aucun volume à congédier — ignoré");
        continue;
      }
      resultat = appliquerConge(d, f, resultat, msgs);
      continue;
    }
    if (f.type != "extrude") continue;
    gBaseTraversante = f.through ? resultat : TopoDS_Shape();
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

ResultatRejeu rejouer(Document& d, int n) {
  replacerHotes(d);
  std::vector<std::string> ordre;
  std::map<std::string, std::vector<Fonction*>> parCorps;
  for (auto& f : d.fonctions) {
    if (n >= 0 && &f - d.fonctions.data() >= n) break;
    if (!f.visible) continue;
    std::string b = std::find(d.corps.begin(), d.corps.end(), f.corps) != d.corps.end() ? f.corps : d.corps[0];
    if (!parCorps.count(b)) ordre.push_back(b);
    parCorps[b].push_back(&f);
  }
  ResultatRejeu r;
  std::vector<TopoDS_Shape> pieces;
  for (auto& b : ordre) {
    gBaseTraversante = TopoDS_Shape();
    TopoDS_Shape s = rejouerCorps(d, parCorps[b], r.messages);
    // Un congé a pu scinder des faces voisines : recoudre celles de même surface (occUnifyAfterFillets)
    if (!s.IsNull() && std::any_of(parCorps[b].begin(), parCorps[b].end(), [](const Fonction* f) { return f->type == "xfillet"; })) s = unifier(s);
    if (!s.IsNull()) {
      pieces.push_back(s);
      r.corps.push_back({b, s});
    }
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

std::vector<Etendue> etenduesEsquisse(const Document& d, const std::string& esquisse) {
  std::vector<Etendue> out;
  const Esquisse* s = nullptr;
  for (auto& e : d.esquisses)
    if (e.id == esquisse) s = &e;
  for (auto& f : d.fonctions)
    if (f.type == "extrude" && f.esquisse == esquisse && f.visible) {
      const Plage p = plageDe(f, s, gBaseTraversante);
      out.push_back({p.lo, p.hi});
    }
  return out;
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
  if (b.IsVoid()) return m;  // une découpe qui a tout retiré : plus rien à mesurer
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

// ---------- Créer une esquisse (src/50-esquisse-1-ouverture-references.js, src/10-scene-3d.js) ----------
namespace {
const double TOUR = 6.283185307179586476925;
double produitVec(const Vec3& a, const Vec3& b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
Vec3 diff(const Vec3& a, const Vec3& b) { return {a[0] - b[0], a[1] - b[1], a[2] - b[2]}; }
double fixe3(double v) {  // +v.toFixed(3)
  char b[64];
  snprintf(b, sizeof b, "%.3f", v);
  return strtod(b, nullptr);
}
std::string base36(unsigned long long v) {
  std::string s;
  do {
    s.insert(s.begin(), "0123456789abcdefghijklmnopqrstuvwxyz"[v % 36]);
    v /= 36;
  } while (v);
  return s;
}
Esquisse esquisseVide(const Document& d, const std::string& plan) {
  Esquisse s;
  const unsigned long long ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
  size_t k = d.esquisses.size() + 1;
  const auto pris = [&](const std::string& id) { return std::any_of(d.esquisses.begin(), d.esquisses.end(), [&](const Esquisse& x) { return x.id == id; }); };
  do s.id = "sk_" + std::to_string(k++) + "_" + base36(ms);
  while (pris(s.id));
  s.nom = "Esquisse " + std::to_string(d.esquisses.size() + 1);
  s.plan = plan;
  if (!d.fonctions.empty()) s.at = d.fonctions.back().id;
  return s;
}

std::string nombreNom(double v) {  // comme un nombre JavaScript écrit dans un nom
  if (v == 0) return "0";
  char b[64];
  const auto r = std::to_chars(b, b + sizeof b, v, std::chars_format::fixed);
  return std::string(b, r.ptr);
}

using Anneau2 = std::vector<std::array<double, 2>>;
Anneau2 polygoneChaine(const Esquisse& s, const Trace& tr, const Chaine& ch) {  // chainPolygon
  Anneau2 r;
  for (size_t i = 0; i < ch.size(); i++) {
    const Pas& st = ch[i];
    const Arete& ed = tr.aretes[st.arete];
    if (ed.spline) {
      const std::vector<P2d> pl = polyArete(ed, st.depuis);
      for (size_t k = 1; k < pl.size(); k++) r.push_back({pl[k][0], pl[k][1]});
    } else if (!ed.arc) {
      const Pt& q = tr.pts.at(ed.a == st.depuis ? ed.b : ed.a);
      r.push_back({q.x, q.y});
    } else {
      const auto an = anglesArc(s, *ed.e);
      if (!an) return {};
      const Pt& C = tr.pts.at(ed.e->pc);
      const bool av = ed.a == st.depuis;
      const double a1 = av ? an->a1 : an->a2, a2 = av ? an->a2 : an->a1;
      double dd = std::fmod(std::fmod(a2 - a1, TOUR) + TOUR, TOUR);
      if (dd < 1e-9) dd = TOUR;
      const int n = std::max(8, static_cast<int>(std::ceil(dd / TOUR * 48)));
      for (int k = 1; k <= n; k++) {
        const double t = a1 + dd * k / n;
        r.push_back({C.x + ed.e->r * std::cos(t), C.y + ed.e->r * std::sin(t)});
      }
    }
    if (i == 0) {
      const Pt& a = tr.pts.at(st.depuis);
      r.insert(r.begin(), {a.x, a.y});
    }
  }
  return r;
}
bool dansPoly(double x, double y, const Anneau2& r) {  // pip
  bool dedans = false;
  for (size_t i = 0, j = r.size() - 1; i < r.size(); j = i++) {
    const double xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if (((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) dedans = !dedans;
  }
  return dedans;
}
double distSeg(double px, double py, double ax, double ay, double bx, double by) {  // distSeg2
  const double dx = bx - ax, dy = by - ay;
  double L2 = dx * dx + dy * dy;
  if (L2 == 0) L2 = 1e-18;
  const double t = std::max(0.0, std::min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2));
  return std::hypot(px - (ax + t * dx), py - (ay + t * dy));
}
bool surBord(double x, double y, const Anneau2& a) {
  for (size_t i = 0; i < a.size(); i++) {
    const auto& q = a[(i + 1) % a.size()];
    if (distSeg(x, y, a[i][0], a[i][1], q[0], q[1]) < 0.6) return true;
  }
  return false;
}

struct HoteTrouve {
  const Fonction* f = nullptr;
  std::string tag, edge;
  double x = 0, y = 0, h = 0;
};
HoteTrouve hotePourFace(const Document& d, const Vec3& pt, const Vec3& n) {  // findHostForFace, tol 1 mm
  const double tol = 1.0;
  HoteTrouve best;
  double bd = 1e9;
  for (const Fonction& f : d.fonctions) {
    if (f.type != "extrude" || !f.visible) continue;
    const Esquisse* hs = nullptr;
    for (const Esquisse& s : d.esquisses)
      if (s.id == f.esquisse) hs = &s;
    if (!hs) continue;
    const double dot = produitVec(n, hs->n);
    if (std::abs(std::abs(dot) - 1) > 1e-2 && std::abs(dot) > 1e-2) continue;
    const Plage sp = plageDe(f, hs, TopoDS_Shape());
    const Vec3 dp = diff(pt, hs->o);
    const double x = produitVec(dp, hs->u), y = produitVec(dp, hs->v);
    if (std::abs(std::abs(dot) - 1) <= 1e-2) {
      const bool onLo = f.op == "cut" ? dot > 0 : dot < 0;
      const double h = onLo ? sp.lo : sp.hi;
      const Vec3 cand{hs->o[0] + hs->n[0] * h, hs->o[1] + hs->n[1] * h, hs->o[2] + hs->n[2] * h};
      const double mDist = std::abs(produitVec(n, diff(pt, cand)));
      if (mDist > tol || mDist > bd) continue;
      const Trace tr = tracerContours(*hs);
      if (tr.solides.empty() && tr.cerclesSeuls.empty()) continue;
      bool touche = false;
      const auto essayer = [&](const Anneau2& ring, const std::vector<Anneau2>& trous) {
        if (touche) return;
        const bool bord = surBord(x, y, ring);
        if (!dansPoly(x, y, ring) && !bord) return;
        bool dansTrou = false;
        for (const Anneau2& t : trous)
          if (dansPoly(x, y, t) || surBord(x, y, t)) dansTrou = true;
        if (!dansTrou || bord) touche = true;
      };
      for (const ContourPlein& c : tr.solides) {
        if (c.chaine.empty()) continue;
        const Anneau2 ring = polygoneChaine(*hs, tr, c.chaine);
        if (ring.size() < 3) continue;
        std::vector<Anneau2> trous;
        for (const Chaine& t : c.trous) trous.push_back(polygoneChaine(*hs, tr, t));
        essayer(ring, trous);
      }
      for (const Entite* c : tr.cerclesSeuls) {
        const Pt* C = hs->point(c->pc);
        if (!C) continue;
        Anneau2 ring;
        for (int i = 0; i < 48; i++) ring.push_back({C->x + c->r * std::cos(i / 48.0 * TOUR), C->y + c->r * std::sin(i / 48.0 * TOUR)});
        essayer(ring, {});
      }
      if (!touche) continue;
      best = HoteTrouve{&f, onLo ? "BOTTOM" : "TOP", "", fixe3(x), fixe3(y), 0};
      bd = mDist;
    } else {
      const double zl = produitVec(dp, hs->n);
      if (zl < sp.lo - tol || zl > sp.hi + tol) continue;
      const double n2x = produitVec(n, hs->u), n2y = produitVec(n, hs->v);
      if (std::hypot(n2x, n2y) < 0.99) continue;
      const Entite* bE = nullptr;
      double bd2 = 1e9, bx = 0, by = 0;
      for (const Entite& en : hs->entites) {
        if (en.t != "line" || en.construction) continue;
        const Pt* a = hs->point(en.p1);
        const Pt* b = hs->point(en.p2);
        if (!a || !b) continue;
        const double ex = b->x - a->x, ey = b->y - a->y, L2 = ex * ex + ey * ey;
        if (L2 < 1e-12) continue;
        const double ux = ex / std::sqrt(L2), uy = ey / std::sqrt(L2);
        if (std::abs(ux * n2x + uy * n2y) > 0.1) continue;
        const double u = ((x - a->x) * ex + (y - a->y) * ey) / L2;
        const double px = a->x + ex * u, py = a->y + ey * u, dist = std::hypot(x - px, y - py);
        if (dist > tol || dist > bd2) continue;
        bd2 = dist;
        bE = &en;
        bx = px;
        by = py;
      }
      if (!bE || bd2 > bd) continue;
      best = HoteTrouve{&f, "SIDE", bE->id, fixe3(bx), fixe3(by), fixe3(zl)};
      bd = bd2;
    }
  }
  return best;
}
}  // namespace

std::string idFonction(const Document& d, const char* prefixe) {
  const unsigned long long ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
  size_t k = d.fonctions.size() + d.esquisses.size() + 1;
  const auto pris = [&](const std::string& id) { return std::any_of(d.fonctions.begin(), d.fonctions.end(), [&](const Fonction& x) { return x.id == id; }); };
  std::string id;
  do id = std::string(prefixe) + "_" + std::to_string(k++) + "_" + base36(ms);
  while (pris(id));
  return id;
}

Fonction nouvelleExtrusion(const Document& d, const Esquisse& s) {
  Fonction f;
  const unsigned long long ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
  size_t k = d.fonctions.size() + d.esquisses.size() + 1;
  const auto pris = [&](const std::string& id) { return std::any_of(d.fonctions.begin(), d.fonctions.end(), [&](const Fonction& x) { return x.id == id; }); };
  do f.id = "ex_" + std::to_string(k++) + "_" + base36(ms);
  while (pris(f.id));
  f.type = "extrude";
  f.esquisse = s.id;
  f.corps = d.corpsActif;
  f.distance = 20;
  f.aDistance = true;
  f.nom = nomExtrusion(d, f);
  return f;
}

std::string nomExtrusion(const Document& d, const Fonction& f) {
  std::string nom = "?";
  for (const Esquisse& s : d.esquisses)
    if (s.id == f.esquisse) {
      nom = s.nom;
      break;
    }
  const std::string base = (f.op == "cut" ? "Découpe " : "Extrusion ") + nom;
  const std::string suite = f.flip ? " ⇄" : "";
  // À travers tout : le fichier n'a pas de distance, le navigateur écrit alors 0
  const double v = f.through ? 0 : f.distance;
  if (f.mid) return base + " ±" + nombreNom(std::abs(v) / 2) + "mm" + suite;
  return base + " " + nombreNom(v) + "mm" + suite;
}

void reglerOperation(Fonction& f, const std::string& op) {
  f.op = op;
  if (!f.through) f.distance = std::abs(f.distance) * (op == "cut" ? -1 : 1);
}

void reglerProfondeur(Fonction& f, double valeur) {
  char b[64];
  snprintf(b, sizeof b, "%.3f", std::abs(valeur) * (f.op == "cut" ? -1 : 1));  // extDistSet : +v.toFixed(3)
  f.distance = strtod(b, nullptr);
  f.aDistance = true;
}

void reglerATravers(Fonction& f, bool oui) {
  f.through = oui;
  f.aDistance = !oui;
  f.distance = 10 * (!oui && f.op == "cut" ? -1 : 1);  // à la relecture, sans distance : 10
}

std::string raisonSansVolume(const Esquisse& s) {
  try {
    Fonction f;
    f.distance = 20;
    f.aDistance = true;
    formeExtrusion(f, s, TopoDS_Shape());
    return "";
  } catch (const Standard_Failure& e) {
    return e.what();
  } catch (const std::exception& e) {
    return e.what();
  }
}

Esquisse nouvelleEsquissePlan(const Document& d, const std::string& plan) {
  Esquisse s = esquisseVide(d, plan);
  if (plan == "XZ") {  // planeBasis, comme à la lecture
    s.u = {1, 0, 0};
    s.v = {0, 0, 1};
    s.n = {0, -1, 0};
  } else if (plan == "YZ") {
    s.u = {0, 1, 0};
    s.v = {0, 0, 1};
    s.n = {1, 0, 0};
  }
  return s;
}

bool pointDansFace(const TopoDS_Face& face, double p[3]) {
  GProp_GProps g;
  BRepGProp::SurfaceProperties(face, g);
  const BRepAdaptor_Surface a(face);
  const auto garder = [&](const gp_Pnt& q) {
    p[0] = q.X();
    p[1] = q.Y();
    p[2] = q.Z();
    return true;
  };
  double u0, u1, v0, v1;
  BRepTools::UVBounds(face, u0, u1, v0, v1);
  BRepClass_FaceClassifier c;
  if (a.GetType() == GeomAbs_Plane) {
    double uc = 0, vc = 0;
    const gp_Pln pl = a.Plane();
    const gp_Vec w(pl.Location(), g.CentreOfMass());
    uc = w.Dot(gp_Vec(pl.XAxis().Direction()));
    vc = w.Dot(gp_Vec(pl.YAxis().Direction()));
    c.Perform(face, gp_Pnt2d(uc, vc), 1e-6);
    if (c.State() == TopAbs_IN) return garder(a.Value(uc, vc));
  }
  // Centre hors de la face (trou, forme en U) : le point de la grille le plus loin de ce centre n'est pas utile, le premier dedans suffit
  for (int n = 3; n <= 33; n += 2)
    for (int i = 0; i < n; i++)
      for (int j = 0; j < n; j++) {
        const double u = u0 + (u1 - u0) * (i + 0.5) / n, v = v0 + (v1 - v0) * (j + 0.5) / n;
        c.Perform(face, gp_Pnt2d(u, v), 1e-6);
        if (c.State() == TopAbs_IN) return garder(a.Value(u, v));
      }
  return false;
}

bool nouvelleEsquisseFace(Document& d, const TopoDS_Shape& solide, const TopoDS_Face& face, Esquisse& out) {
  const BRepAdaptor_Surface a(face);
  if (a.GetType() != GeomAbs_Plane) return false;
  double clic[3];
  if (!pointDansFace(face, clic)) return false;
  const gp_Pln pl = a.Plane();
  gp_Vec nv = gp_Vec(pl.XAxis().Direction()).Crossed(gp_Vec(pl.YAxis().Direction()));
  if (face.Orientation() == TopAbs_REVERSED) nv.Reverse();
  nv.Normalize();
  const Vec3 n{nv.X(), nv.Y(), nv.Z()}, pt{clic[0], clic[1], clic[2]};
  // faceSketchOrigin : l'origine globale projetée si elle tombe sur le solide, sinon celle d'une esquisse, sinon le centre de la face
  const double d0 = produitVec(n, pt);
  const auto projeter = [&](const Vec3& o) {
    const double k = produitVec(n, o) - d0;
    return Vec3{o[0] - n[0] * k, o[1] - n[1] * k, o[2] - n[2] * k};
  };
  IntCurvesFace_ShapeIntersector inter;
  inter.Load(solide, 1e-6);
  const auto surSolide = [&](const Vec3& p) {
    inter.PerformNearest(gp_Lin(gp_Pnt(p[0] + n[0], p[1] + n[1], p[2] + n[2]), gp_Dir(-n[0], -n[1], -n[2])), 0.01, 3);
    if (inter.NbPnt() < 1) return false;
    if (!(inter.WParameter(1) < 2.5 && inter.Pnt(1).Distance(gp_Pnt(p[0], p[1], p[2])) < 0.75)) return false;
    if (inter.State(1) == TopAbs_IN) return true;
    // Pile sur le bord d'une face : le navigateur, qui vise un maillage, tombe d'un côté ou de l'autre. On ne garde ce point que s'il touche la face choisie.
    BRepClass_FaceClassifier c;
    const gp_Vec w(pl.Location(), gp_Pnt(p[0], p[1], p[2]));
    c.Perform(face, gp_Pnt2d(w.Dot(gp_Vec(pl.XAxis().Direction())), w.Dot(gp_Vec(pl.YAxis().Direction()))), 1e-3);
    return c.State() == TopAbs_IN || c.State() == TopAbs_ON;
  };
  std::vector<Vec3> candidats{{0, 0, 0}};
  for (size_t i = d.esquisses.size(); i-- > 0;) candidats.push_back(d.esquisses[i].o);
  bool trouve = false;
  Vec3 origine = pt;
  for (const Vec3& c : candidats) {
    const Vec3 p = projeter(c);
    if (surSolide(p)) {
      origine = p;
      trouve = true;
      break;
    }
  }
  if (!trouve) {
    GProp_GProps g;
    BRepGProp::SurfaceProperties(face, g);
    const gp_Pnt c = g.CentreOfMass();
    origine = projeter({c.X(), c.Y(), c.Z()});
  }
  // faceRefU + basisOnFace : U de la dernière esquisse parallèle, sinon X du monde
  Vec3 ref{1, 0, 0};
  for (size_t i = d.esquisses.size(); i-- > 0;)
    if (std::abs(std::abs(produitVec(d.esquisses[i].n, n)) - 1) < 1e-3) {
      ref = d.esquisses[i].u;
      break;
    }
  const auto projeteU = [&](const Vec3& r) {
    const double k = produitVec(n, r);
    return Vec3{r[0] - n[0] * k, r[1] - n[1] * k, r[2] - n[2] * k};
  };
  Vec3 u = projeteU(ref);
  if (produitVec(u, u) < 1e-8) u = projeteU({1, 0, 0});
  if (produitVec(u, u) < 1e-8) u = projeteU({0, 1, 0});
  const double lu = std::sqrt(produitVec(u, u));
  u = {u[0] / lu, u[1] / lu, u[2] / lu};
  Vec3 v{n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]};
  const double lv = std::sqrt(produitVec(v, v));
  v = {v[0] / lv, v[1] / lv, v[2] / lv};
  // Face verticale ou inclinée : v vers le haut, sinon l'esquisse s'ouvrait à l'envers
  if (std::abs(n[2]) < 0.95 && v[2] < -1e-6) {
    u = {-u[0], -u[1], -u[2]};
    v = {-v[0], -v[1], -v[2]};
  }
  HoteTrouve h = hotePourFace(d, origine, n);
  if (!h.f) {  // hostViaPoints : origine hors de la face visée, la face sous le clic ; jamais une face latérale
    const HoteTrouve c = hotePourFace(d, pt, n);
    if (c.f && c.tag != "SIDE") {
      const Esquisse* hs = nullptr;
      for (const Esquisse& s : d.esquisses)
        if (s.id == c.f->esquisse) hs = &s;
      if (hs) {
        const Vec3 dp = diff(origine, hs->o);
        h = HoteTrouve{c.f, c.tag, "", fixe3(produitVec(dp, hs->u)), fixe3(produitVec(dp, hs->v)), 0};
      }
    }
  }
  out = esquisseVide(d, "FACE");
  out.nom += " (face)";
  out.o = {fixe3(origine[0]), fixe3(origine[1]), fixe3(origine[2])};
  out.u = u;
  out.v = v;
  out.n = n;
  if (h.f) {
    out.hote.existe = true;
    out.hote.feat = h.f->id;
    out.hote.tag = h.tag;
    out.hote.x = h.x;
    out.hote.y = h.y;
    out.hote.nom = "Face " + std::to_string(++d.nomsFace);
    if (h.tag == "SIDE") {
      out.hote.edge = h.edge;
      out.hote.h = h.h;
      out.hote.aH = true;
    }
  }
  return true;
}
