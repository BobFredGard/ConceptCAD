#include "faces.h"
#include "noms.h"

#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Curve2d.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepAlgoAPI_Common.hxx>
#include <BRepAlgoAPI_Defeaturing.hxx>
#include <BRepAlgoAPI_Section.hxx>
#include <BRepAlgoAPI_Splitter.hxx>
#include <BRepBndLib.hxx>
#include <BRepBuilderAPI_Copy.hxx>
#include <BRepBuilderAPI_GTransform.hxx>
#include <BRepBuilderAPI_MakeEdge.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakePolygon.hxx>
#include <BRepBuilderAPI_MakeSolid.hxx>
#include <BRepBuilderAPI_MakeWire.hxx>
#include <BRepBuilderAPI_Sewing.hxx>
#include <BRepBuilderAPI_Transform.hxx>
#include <BRepCheck_Analyzer.hxx>
#include <BRepFill.hxx>
#include <BRepGProp.hxx>
#include <BRepOffsetAPI_MakePipeShell.hxx>
#include <BRepOffsetAPI_MakeThickSolid.hxx>
#include <ShapeCustom.hxx>
#include <BRepOffset_MakeOffset.hxx>
#include <BRepPrimAPI_MakeCone.hxx>
#include <BRepPrimAPI_MakeCylinder.hxx>
#include <BRepPrimAPI_MakePrism.hxx>
#include <BRepTools.hxx>
#include <BRepTools_WireExplorer.hxx>
#include <BRep_Builder.hxx>
#include <BRep_Tool.hxx>
#include <Bnd_Box.hxx>
#include <GProp_GProps.hxx>
#include <GeomLProp_SLProps.hxx>
#include <Geom_Surface.hxx>
#include <ShapeFix_Shape.hxx>
#include <Standard_Failure.hxx>
#include <TopExp_Explorer.hxx>
#include <TopLoc_Location.hxx>
#include <TopTools_ListOfShape.hxx>
#include <TopTools_MapOfShape.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Compound.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Shell.hxx>
#include <TopoDS_Solid.hxx>
#include <TopoDS_Vertex.hxx>
#include <gp_Ax2.hxx>
#include <gp_Circ.hxx>
#include <gp_Cone.hxx>
#include <gp_Cylinder.hxx>
#include <gp_GTrsf.hxx>
#include <gp_Pln.hxx>
#include <gp_Trsf.hxx>
#include <gp_Vec.hxx>

#include <algorithm>
#include <cmath>
#include <map>
#include <set>
#include <stdexcept>

#include "conges.h"

namespace {
const double PI_ = 3.14159265358979323846;
const double TAU_ = 2 * PI_;

Vec3 xyz(const gp_Pnt& p) { return {p.X(), p.Y(), p.Z()}; }
Vec3 xyz(const gp_Dir& p) { return {p.X(), p.Y(), p.Z()}; }
double dot3(const Vec3& a, const Vec3& b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
Vec3 sub3(const Vec3& a, const Vec3& b) { return {a[0] - b[0], a[1] - b[1], a[2] - b[2]}; }
Vec3 add3(const Vec3& a, const Vec3& b, double k = 1) { return {a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k}; }
Vec3 mul3(const Vec3& a, double k) { return {a[0] * k, a[1] * k, a[2] * k}; }
Vec3 cross3(const Vec3& a, const Vec3& b) { return {a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]}; }
double len3(const Vec3& a) { return std::hypot(a[0], a[1], a[2]); }
gp_Pnt pnt(const Vec3& a) { return gp_Pnt(a[0], a[1], a[2]); }
gp_Dir dirDe(const Vec3& a) { return gp_Dir(a[0], a[1], a[2]); }

std::vector<TopoDS_Face> facesDe(const TopoDS_Shape& s) {
  std::vector<TopoDS_Face> out;
  for (TopExp_Explorer ex(s, TopAbs_FACE); ex.More(); ex.Next()) out.push_back(TopoDS::Face(ex.Current()));
  return out;
}
std::vector<TopoDS_Shape> solidesDe(const TopoDS_Shape& s) {
  std::vector<TopoDS_Shape> out;
  for (TopExp_Explorer ex(s, TopAbs_SOLID); ex.More(); ex.Next()) out.push_back(ex.Current());
  return out;
}
TopoDS_Shape composeDeFormes(const std::vector<TopoDS_Shape>& v) {
  TopoDS_Compound c;
  BRep_Builder b;
  b.MakeCompound(c);
  for (const TopoDS_Shape& x : v) b.Add(c, x);
  return c;
}
double volumeForme(const TopoDS_Shape& s) {
  GProp_GProps g;
  BRepGProp::VolumeProperties(s, g, false, false, false);
  return g.Mass();
}
double aireFace(const TopoDS_Face& f) {
  GProp_GProps g;
  BRepGProp::SurfaceProperties(f, g, false, false);
  return g.Mass();
}
bool valide(const TopoDS_Shape& s) {
  try {
    BRepCheck_Analyzer a(s, true);
    return a.IsValid(s);
  } catch (const Standard_Failure&) {
    return false;
  }
}
TopoDS_Shape reparer(const TopoDS_Shape& s) {
  try {
    ShapeFix_Shape fx(s);
    fx.Perform();
    return fx.Shape();
  } catch (const Standard_Failure&) {
    return TopoDS_Shape();
  }
}
struct Boite {
  Vec3 lo, hi;
};
Boite boiteDe(const TopoDS_Shape& s) {
  Bnd_Box b;
  BRepBndLib::Add(s, b, true);
  return {xyz(b.CornerMin()), xyz(b.CornerMax())};
}
const char* nomSurface(const TopoDS_Face& f) {
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
}

std::optional<TopoDS_Face> trouverFace0(const Document& d, const TopoDS_Shape& solide, RefFace ref);
// ── retrouver une face ───────────────────────────────────────────────────────
double distanceSegment2(double px, double py, double ax, double ay, double bx, double by) {
  const double dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const double t = L2 > 0 ? std::max(0.0, std::min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
  return std::hypot(px - ax - dx * t, py - ay - dy * t);
}
// faceAnchorScore : la face est-elle encore celle que l'ancre désigne ? Plus petit = mieux, -1 : non
double scoreAncreFace(const Document& d, const Vec3& pos, const Vec3& dim, const RefFace& ref) {
  const AncreArete& a = ref.ancre;
  const Esquisse* s = nullptr;
  for (const Esquisse& x : d.esquisses)
    if (x.id == a.sk) s = &x;
  if (!s) return -1;
  const double dx = pos[0] - s->o[0], dy = pos[1] - s->o[1], dz = pos[2] - s->o[2];
  const double q0 = dx * s->u[0] + dy * s->u[1] + dz * s->u[2], q1 = dx * s->v[0] + dy * s->v[1] + dz * s->v[2], q2 = dx * s->n[0] + dy * s->n[1] + dz * s->n[2];
  const auto spans = etenduesEsquisse(d, a.sk);
  if (!spans.empty() && std::none_of(spans.begin(), spans.end(), [&](const Etendue& e) { return q2 >= e.lo - 1.5 && q2 <= e.hi + 1.5; })) return -1;
  if (a.t == "p") {
    const Pt* p = nullptr;
    if (auto i = s->points.find(a.id); i != s->points.end()) p = &i->second;
    if (!p || std::hypot(q0 - p->x, q1 - p->y) > 5.0) return -1;
  } else {
    const Entite* e = nullptr;
    for (const Entite& x : s->entites)
      if (x.id == a.id) e = &x;
    if (!e || e->construction || e->ref) return -1;
    double d2 = 1e18;
    const auto point = [&](const std::string& id) -> const Pt* {
      auto i = s->points.find(id);
      return i == s->points.end() ? nullptr : &i->second;
    };
    if (e->t == "line") {
      const Pt* A0 = point(e->p1);
      const Pt* B0 = point(e->p2);
      if (!A0 || !B0) return -1;
      d2 = distanceSegment2(q0, q1, A0->x, A0->y, B0->x, B0->y);
    } else if (e->t == "circle" || e->t == "arc") {
      const Pt* C = point(e->pc);
      if (!C || !(e->r > 0)) return -1;
      if (e->t == "arc") {
        const auto an = anglesArc(*s, *e);
        if (!an) return -1;
        const double rel = std::fmod(std::fmod(std::atan2(q1 - C->y, q0 - C->x) - an->a1, TAU_) + TAU_, TAU_);
        if (rel > an->a2 - an->a1 + 0.05) return -1;
      }
      d2 = std::abs(std::hypot(q0 - C->x, q1 - C->y) - e->r);
    } else {
      return -1;
    }
    if (d2 > 5.0) return -1;
  }
  const double dd = std::abs(dim[0] - ref.dim[0]) + std::abs(dim[1] - ref.dim[1]) + std::abs(dim[2] - ref.dim[2]);
  if (dd > std::max(2.0, 0.35 * (std::abs(ref.dim[0]) + std::abs(ref.dim[1]) + std::abs(ref.dim[2])))) return -1;
  return 0.15 * dd + 0.02 * std::hypot(pos[0] - ref.pos[0], pos[1] - ref.pos[1], pos[2] - ref.pos[2]);
}
// occFindFaceAny0
std::optional<TopoDS_Face> trouverFaceQuelconque0(const Document& d, const TopoDS_Shape& s, const RefFace& ref) {
  if (ref.aNormale) {
    if (auto h = trouverFace0(d, s, ref)) return h;
    if (!ref.ancre.existe) return std::nullopt;
    std::optional<TopoDS_Face> best;
    double bs = 1e18;
    for (const TopoDS_Face& f : facesDe(s)) {
      const auto n = normaleDeFace(f);
      if (!n || (!ref.st.empty() && ref.st != nomSurface(f))) continue;
      if (dot3(xyz(*n), ref.n) < 0.9) continue;
      Vec3 pos, dim;
      boiteFace(f, pos, dim);
      RefFace r2 = ref;
      r2.dim = dim;
      const double sc = scoreAncreFace(d, pos, dim, r2);
      if (sc >= 0 && sc < bs) {
        bs = sc;
        best = f;
      }
    }
    return best;
  }
  std::optional<TopoDS_Face> best;
  double bs = 1e18;
  for (const TopoDS_Face& f : facesDe(s)) {
    if (!ref.st.empty() && ref.st != nomSurface(f)) continue;
    Vec3 pos, dim;
    boiteFace(f, pos, dim);
    const double sc = std::hypot(pos[0] - ref.pos[0], pos[1] - ref.pos[1], pos[2] - ref.pos[2]) + 0.1 * (std::abs(dim[0] - ref.dim[0]) + std::abs(dim[1] - ref.dim[1]) + std::abs(dim[2] - ref.dim[2]));
    if (sc < bs) {
      bs = sc;
      best = f;
    }
  }
  if (best && bs > 2.5) return std::nullopt;
  return best;
}
// occFindFaceAny : le nom d'abord ; la position n'est que le repli, et le moyen de nommer une référence neuve
std::optional<TopoDS_Face> trouverFaceQuelconque(const Document& d, const TopoDS_Shape& s, const RefFace& ref) {
  if (auto h = nomsRefFace(s, ref.nom, &ref.pos)) return h;
  auto g = trouverFaceQuelconque0(d, s, ref);
  if (g && ref.nom.empty()) ref.nom = nomsFaceDe(s, *g);
  return g;
}
}  // namespace

// ── surfaces ─────────────────────────────────────────────────────────────────
DescSurf descSurf(const TopoDS_Face& f) {
  DescSurf d;
  try {
    BRepAdaptor_Surface ad(f, true);
    if (ad.GetType() == GeomAbs_Plane) {
      const gp_Ax1 ax = ad.Plane().Axis();
      d.k = 'p';
      d.n = xyz(ax.Direction());
      d.p = xyz(ax.Location());
    } else if (ad.GetType() == GeomAbs_Cylinder) {
      const gp_Cylinder cy = ad.Cylinder();
      const gp_Ax3 pos = cy.Position();
      d.k = 'c';
      d.a = xyz(pos.Direction());
      d.p = xyz(pos.Location());
      d.r = cy.Radius();
      d.X = xyz(pos.XDirection());
      d.Y = xyz(pos.YDirection());
      d.direct = pos.Direct();
      d.u0 = ad.FirstUParameter();
      d.u1 = ad.LastUParameter();
      d.v0 = ad.FirstVParameter();
      d.v1 = ad.LastVParameter();
    } else if (ad.GetType() == GeomAbs_Cone) {
      const gp_Cone co = ad.Cone();
      d.k = 'o';
      d.a = xyz(co.Position().Direction());
      d.apex = xyz(co.Apex());
      d.semi = co.SemiAngle();
    }
  } catch (const Standard_Failure&) {
    d.k = '?';
  }
  return d;
}
bool memeSurface(const DescSurf& a, const DescSurf& b) {  // occSameSurf
  const double tol = 1e-4;
  if (a.k != b.k) return false;
  if (a.k == 'p') return std::abs(std::abs(dot3(a.n, b.n)) - 1) < 1e-7 && std::abs(dot3(sub3(b.p, a.p), a.n)) < tol;
  if (a.k == 'c') {
    if (std::abs(std::abs(dot3(a.a, b.a)) - 1) > 1e-7 || std::abs(a.r - b.r) > tol) return false;
    const Vec3 w = sub3(b.p, a.p);
    const double t = dot3(w, a.a);
    return std::hypot(w[0] - t * a.a[0], w[1] - t * a.a[1], w[2] - t * a.a[2]) < tol;
  }
  return false;
}
namespace {
// occFacesTouching : les faces hors du groupe qui partagent une arête avec lui
std::vector<TopoDS_Face> facesVoisines(const std::vector<TopoDS_Face>& faces, const std::vector<TopoDS_Face>& groupe) {
  TopTools_MapOfShape ge;
  for (const TopoDS_Face& g : groupe)
    for (TopExp_Explorer ex(g, TopAbs_EDGE); ex.More(); ex.Next()) ge.Add(ex.Current());
  std::vector<TopoDS_Face> out;
  for (const TopoDS_Face& f : faces) {
    if (std::any_of(groupe.begin(), groupe.end(), [&](const TopoDS_Face& g) { return g.IsSame(f); })) continue;
    for (TopExp_Explorer ex(f, TopAbs_EDGE); ex.More(); ex.Next())
      if (ge.Contains(ex.Current())) {
        out.push_back(f);
        break;
      }
  }
  return out;
}
bool areteTangente(const TopoDS_Edge& e, const TopoDS_Face& f1, const TopoDS_Face& f2) {  // occEdgeTangent
  try {
    if (BRep_Tool::Continuity(e, f1, f2) != GeomAbs_C0) return true;
  } catch (const Standard_Failure&) {
  }
  try {
    double pc0, pc1;  // une arête sans courbe sur sa face (rencontre d'un filet et d'un cône) : pas mesurable
    if (BRep_Tool::CurveOnSurface(e, f1, pc0, pc1).IsNull() || BRep_Tool::CurveOnSurface(e, f2, pc0, pc1).IsNull()) return false;
    BRepAdaptor_Curve2d g1(e, f1), g2(e, f2);
    TopLoc_Location l1, l2;
    const Handle(Geom_Surface) s1 = BRep_Tool::Surface(f1, l1), s2 = BRep_Tool::Surface(f2, l2);
    const double w0 = g1.FirstParameter(), w1 = g1.LastParameter();
    if (!(w1 > w0)) return false;
    for (const double p : {0.25, 0.5, 0.75}) {
      const gp_Pnt2d q1 = g1.Value(w0 + (w1 - w0) * p), q2 = g2.Value(w0 + (w1 - w0) * p);
      GeomLProp_SLProps P1(s1, q1.X(), q1.Y(), 1, 1e-6), P2(s2, q2.X(), q2.Y(), 1, 1e-6);
      if (!P1.IsNormalDefined() || !P2.IsNormalDefined()) return false;
      const double c = P1.Normal().Dot(P2.Normal());
      const double th = std::acos(std::max(-1.0, std::min(1.0, c))) * 180 / PI_;
      if (std::min(th, 180 - th) >= 3) return false;
    }
    return true;
  } catch (const Standard_Failure&) {
    return false;
  }
}
std::vector<int> chaineFacesTangentes(const std::vector<TopoDS_Face>& faces, const std::vector<int>& germes) {  // occTangentChainIdx
  struct AreteF {
    TopoDS_Edge e;
    std::string k;
  };
  std::vector<std::vector<AreteF>> aretes(faces.size());
  std::map<std::string, std::vector<std::pair<int, TopoDS_Edge>>> seaux;
  for (size_t i = 0; i < faces.size(); i++)
    for (TopExp_Explorer ex(faces[i], TopAbs_EDGE); ex.More(); ex.Next()) {
      try {
        const TopoDS_Edge e = TopoDS::Edge(ex.Current());
        BRepAdaptor_Curve ad(e);
        const gp_Pnt m = ad.Value((ad.FirstParameter() + ad.LastParameter()) / 2);
        const auto r = [](double v) { return std::to_string(static_cast<long long>(std::floor(v * 1e3 + 0.5))); };
        const std::string k = r(m.X()) + "," + r(m.Y()) + "," + r(m.Z());
        aretes[i].push_back({e, k});
        seaux[k].push_back({static_cast<int>(i), e});
      } catch (const Standard_Failure&) {
      }
    }
  std::set<int> dans;
  for (int g : germes)
    if (g >= 0 && g < static_cast<int>(faces.size())) dans.insert(g);
  std::vector<int> pile(dans.begin(), dans.end());
  std::map<std::string, bool> vu;
  while (!pile.empty()) {
    const int i = pile.back();
    pile.pop_back();
    for (const AreteF& a : aretes[i])
      for (const auto& b : seaux[a.k]) {
        if (b.first == i || dans.count(b.first) || !b.second.IsSame(a.e)) continue;
        const std::string pk = std::to_string(std::min(i, b.first)) + "/" + std::to_string(std::max(i, b.first)) + "/" + a.k;
        if (!vu.count(pk)) vu[pk] = areteTangente(a.e, faces[i], faces[b.first]);
        if (vu[pk]) {
          dans.insert(b.first);
          pile.push_back(b.first);
        }
      }
  }
  return std::vector<int>(dans.begin(), dans.end());
}

// ── supprimer des faces ──────────────────────────────────────────────────────
double debordSuppression(const Boite& B, const Boite& R, const std::vector<Boite>& Fs) {  // occDelFaceDebord
  if (Fs.empty()) return 0;
  Boite F = Fs[0];
  for (const Boite& b : Fs)
    for (int i = 0; i < 3; i++) {
      F.lo[i] = std::min(F.lo[i], b.lo[i]);
      F.hi[i] = std::max(F.hi[i], b.hi[i]);
    }
  double m = 1;
  for (int i = 0; i < 3; i++) m = std::max(m, F.hi[i] - F.lo[i]);
  double sort = 0;
  for (int i = 0; i < 3; i++) sort = std::max({sort, std::min(B.lo[i], F.lo[i] - m) - R.lo[i], R.hi[i] - std::max(B.hi[i], F.hi[i] + m)});
  return sort;
}
TopoDS_Shape supprimerFacesUneFois(const TopoDS_Shape& s, const std::vector<TopoDS_Face>& faces) {  // occDeleteFacesOnce
  BRepAlgoAPI_Defeaturing d;
  d.SetShape(s);
  for (const TopoDS_Face& h : faces) d.AddFaceToRemove(h);
  d.SetToFillHistory(false);
  d.Build();
  if (!d.IsDone()) throw std::runtime_error("les faces voisines ne se rejoignent pas");
  TopoDS_Shape r = d.Shape();
  if (r.IsNull()) throw std::runtime_error("résultat vide");
  for (const TopoDS_Face& c : facesDe(r))
    if (std::any_of(faces.begin(), faces.end(), [&](const TopoDS_Face& h) { return c.IsSame(h); })) throw std::runtime_error("les faces voisines ne se rejoignent pas");
  r = unifierForme(r);
  if (!valide(r)) throw std::runtime_error("solide résultant invalide");
  std::vector<Boite> bf;
  for (const TopoDS_Face& h : faces) bf.push_back(boiteDe(h));
  const double sort = debordSuppression(boiteDe(s), boiteDe(r), bf);
  if (sort > 0.05) throw std::runtime_error("les faces voisines partent hors de la pièce (+" + std::to_string(static_cast<int>(sort)) + " mm) : ajoutez aussi les faces voisines à la suppression");
  return r;
}

// ── déplacer une face ────────────────────────────────────────────────────────
TopoDS_Shape coqueEnSolide(const TopoDS_Shape& r) {  // occShellToSolid
  if (!solidesDe(r).empty()) return r;
  std::vector<TopoDS_Shell> sh;
  for (TopExp_Explorer ex(r, TopAbs_SHELL); ex.More(); ex.Next()) sh.push_back(TopoDS::Shell(ex.Current()));
  if (sh.size() != 1) return r;
  BRepBuilderAPI_MakeSolid ms;
  ms.Add(sh[0]);
  TopoDS_Shape so = ms.Solid();
  if (volumeForme(so) < 0) so = so.Reversed();
  return so.IsNull() || !valide(so) ? r : so;
}
std::optional<TopoDS_Shape> decalerFaces(const TopoDS_Shape& s, const std::vector<TopoDS_Face>& faces, double dist, std::vector<std::string>& alertes) {  // occOffsetFaces
  const auto all = facesDe(s);
  std::vector<int> idx;
  for (size_t i = 0; i < all.size(); i++)
    if (std::any_of(faces.begin(), faces.end(), [&](const TopoDS_Face& f) { return f.IsSame(all[i]); })) idx.push_back(static_cast<int>(i));
  double aire = 0;
  for (int i : chaineFacesTangentes(all, idx)) aire += aireFace(all[i]);
  TopoDS_Shape r;
  {
    BRepOffset_MakeOffset o;
    o.Initialize(s, 0, 1e-6, BRepOffset_Skin, true, false, GeomAbs_Intersection, false, false);
    for (const TopoDS_Face& f : faces) o.SetOffsetOnFace(f, dist);
    try {
      o.MakeOffsetShape();
    } catch (const Standard_Failure& e) {
      alertes.push_back(std::string("décalage refusé par le noyau (") + e.what() + ")");
      return std::nullopt;
    }
    if (!o.IsDone()) {
      alertes.push_back("décalage refusé par le noyau (erreur " + std::to_string(static_cast<int>(o.Error())) + ")");
      return std::nullopt;
    }
    r = o.Shape();
  }
  if (r.IsNull()) {
    alertes.push_back("décalage : résultat vide");
    return std::nullopt;
  }
  if (!valide(r)) {
    r = reparer(r);
    if (r.IsNull() || !valide(r)) {
      alertes.push_back("décalage : solide invalide, même réparé");
      return std::nullopt;
    }
  }
  r = coqueEnSolide(r);
  const double dv = volumeForme(r) - volumeForme(s), ev = aire * dist, q = ev != 0 ? dv / ev : 0;
  if (!(q > 0.25 && q < 4)) {
    alertes.push_back("décalage incohérent (volume " + std::to_string(static_cast<long long>(dv)) + " mm³ pour " + std::to_string(static_cast<long long>(ev)) + " attendus)");
    return std::nullopt;
  }
  return r;
}
// occMoveFaceRuledTool : le volume entre l'ancien contour et le contour relevé, chaque bord suivant le prolongement de sa voisine
std::optional<TopoDS_Shape> outilRegle(const TopoDS_Shape& shape, const TopoDS_Face& face, const Vec3& n, double dist) {
  const double L = std::abs(dist);
  const Vec3 u = mul3(n, dist > 0 ? 1 : -1);
  int nw = 0;
  for (TopExp_Explorer ex(face, TopAbs_WIRE); ex.More(); ex.Next()) nw++;
  if (nw != 1) return std::nullopt;
  struct Regle {
    char k = 'p';  // p plan, t translation, a sommet
    Vec3 n{}, d{}, a{};
    double dv = 0;
    TopoDS_Face f;
  };
  struct Elem {
    TopoDS_Edge e;
    Vec3 v0;
    Regle r;
  };
  std::vector<Elem> it;
  const auto all = facesDe(shape);
  const TopoDS_Wire ow = BRepTools::OuterWire(face);
  for (BRepTools_WireExplorer wx(ow, face); wx.More(); wx.Next()) {
    const TopoDS_Edge e = wx.Current();
    const Vec3 v0 = xyz(BRep_Tool::Pnt(wx.CurrentVertex()));
    std::vector<TopoDS_Face> fl;
    for (const TopoDS_Face& f : all) {
      if (fl.size() >= 2) break;
      for (TopExp_Explorer ee(f, TopAbs_EDGE); ee.More(); ee.Next())
        if (ee.Current().IsSame(e)) {
          fl.push_back(f);
          break;
        }
    }
    const auto o = std::find_if(fl.begin(), fl.end(), [&](const TopoDS_Face& x) { return !x.IsSame(face); });
    if (o == fl.end()) return std::nullopt;
    BRepAdaptor_Surface ad(*o, true);
    const GeomAbs_SurfaceType gt = ad.GetType();
    Regle r;
    if (gt == GeomAbs_Plane) {
      BRepAdaptor_Curve ca(e);
      if (ca.GetType() != GeomAbs_Line) return std::nullopt;
      r.k = 'p';
      r.n = xyz(ad.Plane().Axis().Direction());
    } else if (gt == GeomAbs_SurfaceOfExtrusion || gt == GeomAbs_Cylinder) {
      const Vec3 dg = xyz(gt == GeomAbs_Cylinder ? ad.Cylinder().Axis().Direction() : ad.Direction());
      const double du = dot3(dg, u);
      if (std::abs(du) < 1e-3) return std::nullopt;
      r.k = 't';
      r.d = mul3(dg, L / du);
      r.dv = L / du;
      r.f = *o;
    } else if (gt == GeomAbs_Cone) {
      r.k = 'a';
      r.a = xyz(ad.Cone().Apex());
    } else {
      return std::nullopt;
    }
    it.push_back({e, v0, r});
  }
  const int N = static_cast<int>(it.size());
  if (N < 2) return std::nullopt;
  const auto lift = [&](const Regle& r, const Vec3& v) -> std::optional<Vec3> {
    if (r.k == 't') return add3(v, r.d);
    if (r.k == 'a') {
      const Vec3 w = sub3(v, r.a);
      const double wu = dot3(w, u);
      if (std::abs(wu) < 1e-6) return std::nullopt;
      return add3(r.a, w, 1 + L / wu);
    }
    return std::nullopt;
  };
  const double tolV = std::max(1e-4, L * 1e-5);
  std::vector<Vec3> V1;
  for (int k = 0; k < N; k++) {
    const Regle& a = it[(k + N - 1) % N].r;
    const Regle& b = it[k].r;
    const Vec3& v = it[k].v0;
    const auto c0 = lift(a, v), c1 = lift(b, v);
    Vec3 q;
    if (c0 || c1) {
      if (c0 && c1 && len3(sub3(*c0, *c1)) > tolV) return std::nullopt;
      q = c0 ? *c0 : *c1;
    } else {
      Vec3 d = cross3(a.n, b.n);
      if (len3(d) < 1e-6) d = add3(u, a.n, -dot3(u, a.n));
      const double du = dot3(d, u);
      if (std::abs(du) < 1e-3) return std::nullopt;
      q = add3(v, d, L / du);
    }
    V1.push_back(q);
  }
  BRepBuilderAPI_Sewing sew(std::max(1e-5, tolV), true, true, true, false);
  sew.Add(face);
  BRepBuilderAPI_MakeWire mw;
  for (int k = 0; k < N; k++) {
    const Elem& el = it[k];
    const Regle& r = el.r;
    const Vec3& p0 = V1[k];
    const Vec3& p1 = V1[(k + 1) % N];
    TopoDS_Edge ne;
    TopoDS_Shape side;
    if (r.k == 'p') {
      ne = BRepBuilderAPI_MakeEdge(pnt(p0), pnt(p1)).Edge();
      BRepBuilderAPI_MakePolygon pg;
      pg.Add(pnt(el.v0));
      pg.Add(pnt(it[(k + 1) % N].v0));
      pg.Add(pnt(p1));
      pg.Add(pnt(p0));
      pg.Close();
      BRepBuilderAPI_MakeFace mf(pg.Wire(), true);
      if (!mf.IsDone()) return std::nullopt;
      side = mf.Face();
    } else {
      gp_Trsf t;
      if (r.k == 't') t.SetTranslation(gp_Vec(r.d[0], r.d[1], r.d[2]));
      else t.SetScale(pnt(r.a), 1 + L / dot3(sub3(el.v0, r.a), u));
      BRepBuilderAPI_Transform tb(el.e, t, true);
      ne = TopoDS::Edge(tb.Shape());
      if (r.k == 't') {
        try {
          TopLoc_Location loc;
          const Handle(Geom_Surface) hs = BRep_Tool::Surface(r.f, loc);
          BRepAdaptor_Curve2d g(el.e, r.f);
          const gp_Pnt2d q0 = g.Value(g.FirstParameter()), q1 = g.Value(g.LastParameter());
          if (loc.IsIdentity() && std::abs(q0.Y() - q1.Y()) < 1e-9) {
            const double a0 = q0.Y(), a1 = a0 + r.dv;
            BRepBuilderAPI_MakeFace mf(hs, std::min(q0.X(), q1.X()), std::max(q0.X(), q1.X()), std::min(a0, a1), std::max(a0, a1), 1e-7);
            if (mf.IsDone()) side = mf.Face();
          }
        } catch (const Standard_Failure&) {
          side.Nullify();
        }
        if (side.IsNull()) side = BRepPrimAPI_MakePrism(el.e, gp_Vec(r.d[0], r.d[1], r.d[2]), false, true).Shape();
      } else {
        side = BRepFill::Face(el.e, ne);
      }
    }
    mw.Add(ne);
    if (!mw.IsDone()) return std::nullopt;
    sew.Add(side);
  }
  BRepBuilderAPI_MakeFace mf1(mw.Wire(), true);
  if (!mf1.IsDone()) return std::nullopt;
  sew.Add(mf1.Face());
  sew.Perform();
  if (sew.NbFreeEdges() > 0) return std::nullopt;
  TopExp_Explorer ex(sew.SewedShape(), TopAbs_SHELL);
  if (!ex.More()) return std::nullopt;
  BRepBuilderAPI_MakeSolid ms;
  ms.Add(TopoDS::Shell(ex.Current()));
  TopoDS_Shape out = ms.Solid();
  if (volumeForme(out) < 0) out = out.Reversed();
  BRepBuilderAPI_Copy cb(out, false, false);
  out = cb.Shape();
  if (out.IsNull() || !valide(out)) return std::nullopt;
  return out;
}
// occMoveFaceOnce : la face avance ou recule, ses limites suivant les voisines
TopoDS_Shape deplacerFaceUneFois(const TopoDS_Shape& shape, const TopoDS_Face& face, double dist, std::vector<std::string>& alertes) {
  const double L = std::abs(dist);
  if (!(L > 1e-9)) return shape;
  const DescSurf sd = descSurf(face);
  const auto all = facesDe(shape);
  const std::string nomFace = nomsFaceDe(shape, face);  // la face déplacée garde son nom : la nouvelle naît de l'outil
  TopoDS_Shape tool;
  DescSurf nd;
  std::vector<TopoDS_Face> group{face};
  if (sd.k == 'c') {
    for (bool grown = true; grown;) {
      grown = false;
      for (const TopoDS_Face& f : facesVoisines(all, group))
        if (memeSurface(descSurf(f), sd)) {
          group.push_back(f);
          grown = true;
        }
    }
    double du = 0, v0 = 1e18, v1 = -1e18;
    for (const TopoDS_Face& g : group) {
      const DescSurf d = descSurf(g);
      du += d.u1 - d.u0;
      v0 = std::min(v0, d.v0);
      v1 = std::max(v1, d.v1);
    }
    if (!(v1 - v0 > 1e-9)) throw std::runtime_error("cylindre sans hauteur");
    const bool rev = face.Orientation() == TopAbs_REVERSED;
    const double sOut = (sd.direct ? 1 : -1) * (rev ? -1 : 1);
    const double r2 = sd.r + sOut * dist;
    if (!(r2 > 1e-6)) throw std::runtime_error("le rayon deviendrait nul ou négatif");
    struct Coupe {
      Vec3 apex, o;
      double ta, tg;
      bool inside;
    };
    std::vector<Coupe> clips;
    const double vm = (v0 + v1) / 2;
    for (const TopoDS_Face& f : facesVoisines(all, group)) {
      const DescSurf c = descSurf(f);
      if (c.k != 'o' || std::abs(std::abs(dot3(c.a, sd.a)) - 1) > 1e-7) continue;
      const Vec3 w = sub3(c.apex, sd.p);
      const double ta = dot3(w, sd.a);
      if (std::hypot(w[0] - ta * sd.a[0], w[1] - ta * sd.a[1], w[2] - ta * sd.a[2]) > 1e-4) continue;
      const double tg = std::tan(std::abs(c.semi));
      if (!(tg > 1e-6)) continue;
      const Vec3 o = mul3(c.a, c.semi > 0 ? 1 : -1);
      const Boite b = boiteDe(f);
      const Vec3 mid{(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2};
      const double tc = dot3(sub3(mid, sd.p), sd.a);
      const double E = (std::max(sd.r, r2) + L) / tg + L;
      if (tc > vm) v1 += E;
      else v0 -= E;
      const double rho = (vm - ta) * dot3(o, sd.a) * tg;
      clips.push_back({c.apex, o, ta, tg, rho > sd.r});
    }
    const bool full = du >= 2 * PI_ - 1e-6;
    const double u0 = full ? 0 : sd.u0, ang = full ? 2 * PI_ : (sd.u1 - sd.u0);
    const Vec3 X{std::cos(u0) * sd.X[0] + std::sin(u0) * sd.Y[0], std::cos(u0) * sd.X[1] + std::sin(u0) * sd.Y[1], std::cos(u0) * sd.X[2] + std::sin(u0) * sd.Y[2]};
    const Vec3 D = cross3(sd.X, sd.Y);
    const double H = v1 - v0, vb = dot3(D, sd.a) > 0 ? v0 : v1;
    const Vec3 O = add3(sd.p, sd.a, vb);
    const gp_Ax2 ax(pnt(O), dirDe(D), dirDe(X));
    tool = coupeFormes(BRepPrimAPI_MakeCylinder(ax, std::max(sd.r, r2), H, ang).Shape(), BRepPrimAPI_MakeCylinder(ax, std::min(sd.r, r2), H, ang).Shape());
    for (const Coupe& c : clips) {
      const double loin = std::max(std::abs(c.ta - v0), std::abs(c.ta - v1)) + 10;
      const TopoDS_Shape cs = BRepPrimAPI_MakeCone(gp_Ax2(pnt(c.apex), dirDe(c.o)), 0, loin * c.tg, loin).Shape();
      tool = c.inside ? communFormes(tool, cs) : coupeFormes(tool, cs);
    }
    nd = sd;
    nd.r = r2;
  } else {
    const auto n = normaleDeFace(face);
    if (!n || sd.k != 'p') throw std::runtime_error("face non plane/cylindrique");
    const Vec3 nv = xyz(*n);
    tool = BRepPrimAPI_MakePrism(face, gp_Vec(nv[0] * dist, nv[1] * dist, nv[2] * dist), false, true).Shape();
    nd.k = 'p';
    nd.n = nv;
    nd.p = add3(sd.p, nv, dist);
  }
  const TopoDS_Shape out = dist > 0 ? fusionFormes(shape, tool) : coupeFormes(shape, tool);
  TopoDS_Shape res = out;
  try {
    const TopoDS_Shape u = unifierForme(out);
    if (!u.IsNull() && (valide(u) || !valide(out))) res = u;
  } catch (const Standard_Failure&) {
  }
  if (res.IsNull()) throw std::runtime_error("opération de déplacement impossible");
  nomsFaceSurSurface(res, nomFace, nd);
  std::vector<DescSurf> nb;
  for (const TopoDS_Face& f : facesVoisines(all, group)) nb.push_back(descSurf(f));
  std::vector<DescSurf> sides;
  for (const TopoDS_Face& f : facesDe(tool)) {
    const DescSurf d = descSurf(f);
    if (!memeSurface(d, nd) && std::none_of(nb.begin(), nb.end(), [&](const DescSurf& x) { return memeSurface(x, d); })) sides.push_back(d);
  }
  sides.push_back(sd);
  const Boite tb = boiteDe(tool);
  const double e = 1e-3;
  const auto dansOutil = [&](const Boite& b) {
    for (int i = 0; i < 3; i++)
      if (b.lo[i] < tb.lo[i] - e || b.hi[i] > tb.hi[i] + e) return false;
    return true;
  };
  std::vector<TopoDS_Face> extra;
  for (const TopoDS_Face& f : facesDe(res)) {
    const DescSurf d = descSurf(f);
    if (std::any_of(sides.begin(), sides.end(), [&](const DescSurf& x) { return memeSurface(x, d); }) && dansOutil(boiteDe(f))) extra.push_back(f);
  }
  if (extra.empty()) return res;
  std::string raison;
  try {
    const auto snap = nomsInstantane(res);
    const TopoDS_Shape fx = supprimerFacesUneFois(res, extra);
    nomsCompleter(fx, "", snap ? &*snap : nullptr);
    return fx;
  } catch (const Standard_Failure& ex) {
    raison = ex.what();
  } catch (const std::exception& ex) {
    raison = ex.what();
  }
  if (sd.k == 'p') {
    std::optional<TopoDS_Shape> dt;
    try {
      dt = outilRegle(shape, face, nd.n, dist);
    } catch (const Standard_Failure&) {
    } catch (const std::exception&) {
    }
    if (dt) {
      try {
        const TopoDS_Shape o2 = dist > 0 ? fusionFormes(shape, *dt) : coupeFormes(shape, *dt);
        TopoDS_Shape r2 = o2;
        BRepBuilderAPI_Copy cb(o2, false, false);
        const TopoDS_Shape cs = cb.Shape();
        nomsPartage(o2, cs);
        const TopoDS_Shape u = unifierForme(cs);
        if (!u.IsNull() && (valide(u) || !valide(o2))) r2 = u;
        if (!r2.IsNull() && valide(r2)) {
          nomsFaceSurSurface(r2, nomFace, nd);
          return r2;
        }
      } catch (const Standard_Failure&) {
      } catch (const std::exception&) {
      }
    }
  }
  alertes.push_back("bord de la face non prolongé le long des voisines (" + raison + ") : bord droit conservé");
  return res;
}
struct SuiviFace {  // occFaceTrack
  Vec3 n, pos, dim;
  bool plane = false;
  double d = 0;
};
std::optional<SuiviFace> suiviDe(const TopoDS_Face& face) {
  const auto n = normaleDeFace(face);
  if (!n) return std::nullopt;
  SuiviFace t;
  t.n = xyz(*n);
  boiteFace(face, t.pos, t.dim);
  BRepAdaptor_Surface ad(face, true);
  if (ad.GetType() == GeomAbs_Plane) {
    t.plane = true;
    t.d = dot3(t.n, xyz(ad.Plane().Location()));
  }
  return t;
}
std::optional<TopoDS_Face> faceSuivie(const TopoDS_Shape& shape, const SuiviFace& t) {  // occFindFaceTracked
  std::optional<TopoDS_Face> best;
  double bs = 1e18;
  for (const TopoDS_Face& f : facesDe(shape)) {
    const auto n = normaleDeFace(f);
    if (!n || dot3(xyz(*n), t.n) < 0.999) continue;
    const auto c = suiviDe(f);
    if (!c || (t.plane && (!c->plane || std::abs(c->d - t.d) >= 0.01))) continue;
    double out = 0;
    for (int i = 0; i < 3; i++) {
      const double lo = c->pos[i] - c->dim[i] / 2, hi = c->pos[i] + c->dim[i] / 2;
      const double e = std::max({0.0, lo - t.pos[i], t.pos[i] - hi});
      out += e * e;
    }
    const double dc = len3(sub3(c->pos, t.pos));
    const double sc = std::sqrt(out) + 1e-3 * dc;
    if (std::sqrt(out) <= 2.5 && sc < bs) {
      best = f;
      bs = sc;
    }
  }
  return best;
}
}  // namespace

// occFaceBox
void boiteFace(const TopoDS_Face& f, Vec3& pos, Vec3& dim) {
  Bnd_Box b;
  BRepBndLib::Add(f, b, true);
  const gp_Pnt a = b.CornerMin(), z = b.CornerMax();
  pos = {(a.X() + z.X()) / 2, (a.Y() + z.Y()) / 2, (a.Z() + z.Z()) / 2};
  dim = {z.X() - a.X(), z.Y() - a.Y(), z.Z() - a.Z()};
}
// occFindFace0 : retrouve sur le solide courant la face décrite (ancre, puis identité, puis proximité)
std::optional<TopoDS_Face> trouverFace(const Document& d, const TopoDS_Shape& solide, const RefFace& ref) {
  if (auto h = nomsRefFace(solide, ref.nom, &ref.pos)) return h;
  auto g = trouverFace0(d, solide, ref);
  if (g && ref.nom.empty()) ref.nom = nomsFaceDe(solide, *g);
  return g;
}
namespace {
std::optional<TopoDS_Face> trouverFace0(const Document& d, const TopoDS_Shape& solide, RefFace ref) {
  if (!ref.ancre.existe) {
    AncreArete a0;
    if (ancrePour(d, ref.pos, a0)) ref.ancre = a0;
  }
  struct Cand {
    TopoDS_Face f;
    Vec3 pos, dim;
  };
  std::vector<Cand> cands;
  for (const TopoDS_Face& f : facesDe(solide)) {
    const auto n = normaleDeFace(f);
    if (!n || dot3(xyz(*n), ref.n) < 0.9) continue;
    Cand c{f};
    boiteFace(f, c.pos, c.dim);
    cands.push_back(c);
  }
  if (ref.ancre.existe) {
    const Cand* best = nullptr;
    double bs = 1e18;
    for (const Cand& c : cands) {
      const double s = scoreAncreFace(d, c.pos, c.dim, ref);
      if (s >= 0 && s < bs) {
        bs = s;
        best = &c;
      }
    }
    if (best) return best->f;
  }
  const Cand* seul = nullptr;
  int nb = 0;
  for (const Cand& c : cands) {
    bool pres = true;
    for (int i = 0; i < 3; i++)
      if (std::abs(c.dim[i] - ref.dim[i]) > std::max(1.5, 0.25 * std::abs(ref.dim[i]))) pres = false;
    if (pres) {
      nb++;
      seul = &c;
    }
  }
  if (nb == 1) return seul->f;
  const Cand* best = nullptr;
  double bn = 1e18;
  for (const Cand& c : cands) {
    const double dd = std::abs(c.dim[0] - ref.dim[0]) + std::abs(c.dim[1] - ref.dim[1]) + std::abs(c.dim[2] - ref.dim[2]);
    const double sc = len3(sub3(c.pos, ref.pos)) + 0.1 * dd;
    if (sc < bn) {
      bn = sc;
      best = &c;
    }
  }
  if (!best || bn > 2.5) return std::nullopt;
  return best->f;
}
}  // namespace

TopoDS_Shape communFormes(const TopoDS_Shape& a, const TopoDS_Shape& b) {
  BRepAlgoAPI_Common c(a, b);
  if (!c.IsDone()) throw std::runtime_error("intersection impossible");
  const TopoDS_Shape s = c.Shape();
  nomsTransmet({a, b}, histoireDe(c), s);
  return s;
}
TopoDS_Shape sansMiettes(const TopoDS_Shape& s) {
  const auto so = solidesDe(s);
  if (so.size() < 2) return s;
  size_t piece = 0;
  size_t nPiece = 0;
  for (size_t i = 0; i < so.size(); i++) {
    const size_t n = facesDe(so[i]).size();
    if (n > nPiece) {
      nPiece = n;
      piece = i;
    }
  }
  std::vector<TopoDS_Shape> ok;
  for (size_t i = 0; i < so.size(); i++)
    if (i == piece || std::abs(volumeForme(so[i])) >= 0.01) ok.push_back(so[i]);
  if (ok.size() == so.size() || ok.empty()) return s;
  const TopoDS_Shape res = ok.size() == 1 ? ok[0] : composeDeFormes(ok);
  nomsTransmet({s}, HistoireNoms{}, res);  // mêmes faces : elles gardent leurs noms
  return res;
}

TopoDS_Shape appliquerDeplacementFace(const Document& d, const Fonction& f, const TopoDS_Shape& result, std::vector<std::string>& msgs) {
  const double dist = f.dist;
  std::vector<RefFace> refs = f.facesVisees;
  if (refs.empty() && f.refFace.lue) refs.push_back(f.refFace);
  const auto lab = [](const RefFace& r) {
    char t[96];
    snprintf(t, sizeof t, "(%.1f, %.1f, %.1f)", r.pos[0], r.pos[1], r.pos[2]);
    return std::string(t);
  };
  std::vector<std::optional<TopoDS_Face>> found;
  std::vector<std::optional<SuiviFace>> trk;
  bool une = false;
  for (const RefFace& r : refs) {
    std::optional<TopoDS_Face> h;
    try {
      h = r.aNormale ? trouverFace(d, result, r) : trouverFaceQuelconque(d, result, r);
    } catch (const Standard_Failure&) {
    }
    found.push_back(h);
    trk.push_back(h ? suiviDe(*h) : std::nullopt);
    if (h) une = true;
    else msgs.push_back(f.nom + " : face introuvable près de " + lab(r) + ", la pièce a changé");
  }
  if (!une) return result;
  if (dist == 0) {
    msgs.push_back(f.nom + " : distance nulle, aucun déplacement");
    return result;
  }
  std::vector<std::string> alertes;
  const auto dire = [&] {
    for (const std::string& a : alertes) msgs.push_back(f.nom + " : " + a);
  };
  std::vector<DescSurf> sds;
  for (const auto& h : found) sds.push_back(h ? descSurf(*h) : DescSurf{});
  try {
    const auto all = facesDe(result);
    std::vector<int> seeds;
    for (size_t i = 0; i < all.size(); i++)
      if (std::any_of(found.begin(), found.end(), [&](const std::optional<TopoDS_Face>& x) { return x && x->IsSame(all[i]); })) seeds.push_back(static_cast<int>(i));
    const std::vector<int> chain = f.facesTangentes ? chaineFacesTangentes(all, seeds) : seeds;
    bool plain = true;
    for (size_t i = 0; i < found.size(); i++)
      if (found[i] && sds[i].k != 'p' && sds[i].k != 'c') plain = false;
    if (plain)
      for (int i : chain) {
        const DescSurf c = descSurf(all[i]);
        bool ok = false;
        for (size_t j = 0; j < found.size(); j++)
          if (found[j] && memeSurface(sds[j], c)) ok = true;
        if (!ok) plain = false;
      }
    if (!plain) {
      std::vector<TopoDS_Face> faces;
      for (int i : chain) faces.push_back(all[i]);
      auto r = decalerFaces(result, faces, dist, alertes);
      dire();
      return r ? *r : result;
    }
  } catch (const Standard_Failure& e) {
    msgs.push_back(f.nom + " : déplacement impossible (" + e.what() + ")");
    return result;
  }
  TopoDS_Shape cur = result;
  bool bouge = false;
  try {
    for (size_t i = 0; i < found.size(); i++) {
      if (!found[i]) continue;
      if (sds[i].k == 'c') {
        bool deja = false;
        for (size_t j = 0; j < i; j++)
          if (found[j] && memeSurface(sds[j], sds[i])) deja = true;
        if (deja) continue;
      }
      TopoDS_Face face = *found[i];
      if (bouge) {
        const auto g = trk[i] ? faceSuivie(cur, *trk[i]) : std::nullopt;
        if (!g) {
          alertes.push_back("face " + lab(refs[i]) + " perdue après le déplacement des précédentes");
          continue;
        }
        face = *g;
      }
      cur = deplacerFaceUneFois(cur, face, dist, alertes);
      bouge = true;
    }
  } catch (const Standard_Failure& e) {
    alertes.push_back(std::string("déplacement impossible (") + e.what() + ")");
    dire();
    return result;
  } catch (const std::exception& e) {
    alertes.push_back(std::string("déplacement impossible (") + e.what() + ")");
    dire();
    return result;
  }
  dire();
  return cur;
}

TopoDS_Shape appliquerSuppressionFaces(const Document& d, const Fonction& f, const TopoDS_Shape& result, std::vector<std::string>& msgs) {
  const size_t total = f.facesVisees.size();
  if (!total) {
    msgs.push_back(f.nom + " : aucune face à supprimer");
    return result;
  }
  std::vector<TopoDS_Face> hs;
  for (const RefFace& r : f.facesVisees) {
    try {
      if (auto h = trouverFaceQuelconque(d, result, r)) hs.push_back(*h);
    } catch (const Standard_Failure&) {
    }
  }
  if (hs.empty()) {
    msgs.push_back(f.nom + " : aucune des " + std::to_string(total) + " face(s) n'est retrouvée, la pièce a changé");
    return result;
  }
  if (hs.size() < total) msgs.push_back(f.nom + " : " + std::to_string(total - hs.size()) + " face(s) introuvable(s) sur la pièce courante");
  // occDelFacesTry
  TopoDS_Shape r;
  std::string echec;
  size_t gardees = hs.size();
  const auto essai = [&](const std::vector<TopoDS_Face>& l, TopoDS_Shape& out) {
    try {
      out = supprimerFacesUneFois(result, l);
      return true;
    } catch (const Standard_Failure& e) {
      echec = e.what();
    } catch (const std::exception& e) {
      echec = e.what();
    }
    return false;
  };
  if (!essai(hs, r)) {
    r.Nullify();
    if (hs.size() > 6) msgs.push_back(f.nom + " : pas de reprise face par face au-delà de 6 faces (trop longue), supprimez-les en plusieurs fois");
    if (hs.size() > 1 && hs.size() <= 6) {
      std::vector<TopoDS_Face> garde;
      for (const TopoDS_Face& h : hs) {
        auto t = garde;
        t.push_back(h);
        TopoDS_Shape x;
        if (essai(t, x)) garde.push_back(h);
      }
      if (!garde.empty() && essai(garde, r)) gardees = garde.size();
      else r.Nullify();
    }
  }
  if (r.IsNull()) {
    msgs.push_back(f.nom + " : suppression impossible, " + echec);
    return result;
  }
  if (gardees < hs.size()) msgs.push_back(f.nom + " : suppression partielle, " + std::to_string(gardees) + "/" + std::to_string(total) + " face(s), " + std::to_string(hs.size() - gardees) + " refusée(s) par le noyau");
  return r;
}

std::optional<TopoDS_Face> trouverFaceLibre(const Document& d, const TopoDS_Shape& solide, const RefFace& ref) { return trouverFaceQuelconque(d, solide, ref); }
const char* natureSurface(const TopoDS_Face& f) { return nomSurface(f); }
std::vector<int> facesTangentesDe(const std::vector<TopoDS_Face>& faces, const std::vector<int>& germes) { return chaineFacesTangentes(faces, germes); }
std::vector<TopoDS_Face> facesVoisinesDe(const std::vector<TopoDS_Face>& faces, const std::vector<TopoDS_Face>& groupe) { return facesVoisines(faces, groupe); }

// ── coque (src/20-10-prismes-booleens-coque.js) ──────────────────────────────
namespace {
// occCoqueThick : le cœur de toutes les recettes
TopoDS_Shape coqueEpaisse(const TopoDS_Shape& result, const std::vector<TopoDS_Face>& faces, double thick, GeomAbs_JoinType join, bool inter) {
  TopTools_ListOfShape L;
  for (const TopoDS_Face& f : faces) L.Append(f);
  BRepOffsetAPI_MakeThickSolid mk;
  mk.MakeThickSolidByJoin(result, L, -std::abs(thick), 0.01, BRepOffset_Skin, inter, false, join, false);
  mk.Build();
  if (!mk.IsDone()) throw std::runtime_error("évidage refusé par le moteur (paroi trop épaisse ? ouverture mal placée ?)");
  const TopoDS_Shape brut = mk.Shape();
  // Paroi intérieure : née de la face extérieure qu'elle double (« nom/int »)
  try {
    if (nomsConnus(result))
      nomsTransmet({result}, histoireDe(mk), brut, [&](const CarteFaces& m, std::vector<std::string>& noms) {
        for (const TopoDS_Face& face : facesDe(result)) {
          const std::string nom = nomsFaceDe(result, face);
          if (nom.empty()) continue;
          for (const TopoDS_Shape& y : mk.Generated(face)) {
            const int j = m.FindIndex(y);
            if (j > 0 && noms[j - 1].empty()) noms[j - 1] = nom + "/int";
          }
        }
      });
  } catch (const Standard_Failure&) {
  }
  if (brut.IsNull()) throw std::runtime_error("solide évidé vide");
  return brut;
}
int nombreDeFaces(const TopoDS_Shape& s) {
  int n = 0;
  for (TopExp_Explorer x(s, TopAbs_FACE); x.More(); x.Next()) n++;
  return n;
}
// occCoqueEvidage : le moteur rend parfois un résultat non évidé. Boîte serrée, au moins 2 faces de plus, moins de la moitié du volume.
bool vraiEvidage(const TopoDS_Shape& base, const TopoDS_Shape& out, double thick) {
  try {
    Bnd_Box bb, bo;
    BRepBndLib::AddOptimal(base, bb, true, false);
    BRepBndLib::AddOptimal(out, bo, true, false);
    const Vec3 b0 = xyz(bb.CornerMin()), b1 = xyz(bb.CornerMax()), o0 = xyz(bo.CornerMin()), o1 = xyz(bo.CornerMax());
    const double m = 2 + 2 * std::abs(thick);
    for (int i = 0; i < 3; i++)
      if (o0[i] < b0[i] - m || o1[i] > b1[i] + m) return false;
    if (nombreDeFaces(out) - nombreDeFaces(base) < 2) return false;
    const double v0 = volumeForme(base), v1 = volumeForme(out);
    return v1 > 0 && v1 < v0 * 0.5;
  } catch (const Standard_Failure&) {
    return false;
  }
}
struct EntreeCoque {
  const RefFace* fr;
  TopoDS_Face h;
};
// occCoqueRecettes : Arc direct, Intersection, conversion en B-spline puis Arc ; acceptées seulement après validation
TopoDS_Shape recettesCoque(const Document& d, const TopoDS_Shape& result, const std::vector<EntreeCoque>& entrees, double thick) {
  const auto essai = [&](const TopoDS_Shape& forme, const std::vector<TopoDS_Face>& faces, GeomAbs_JoinType join, bool inter) -> TopoDS_Shape {
    const TopoDS_Shape out = coqueEpaisse(forme, faces, thick, join, inter);
    if (!vraiEvidage(result, out, thick)) return TopoDS_Shape();
    if (valide(out)) return out;
    const TopoDS_Shape fix = reparer(out);
    if (!fix.IsNull() && valide(fix) && vraiEvidage(result, fix, thick)) return fix;
    return out;
  };
  std::vector<TopoDS_Face> hs;
  for (const EntreeCoque& e : entrees) hs.push_back(e.h);
  std::string erreur;
  const auto note = [&](const char* m) {
    if (erreur.empty()) erreur = m;
  };
  try {
    const TopoDS_Shape r = essai(result, hs, GeomAbs_Arc, false);
    if (!r.IsNull()) return r;
  } catch (const Standard_Failure& e) {
    note(e.what());
  } catch (const std::exception& e) {
    note(e.what());
  }
  try {
    const TopoDS_Shape r = essai(result, hs, GeomAbs_Intersection, true);
    if (!r.IsNull()) return r;
  } catch (const Standard_Failure& e) {
    note(e.what());
  } catch (const std::exception& e) {
    note(e.what());
  }
  try {
    const TopoDS_Shape cv = ShapeCustom::ConvertToBSpline(result, true, false, false, false);
    if (!cv.IsNull()) {
      std::vector<TopoDS_Face> fc;
      for (const EntreeCoque& e : entrees)
        if (auto h = trouverFace(d, cv, *e.fr)) fc.push_back(*h);
      if (!fc.empty()) {
        const TopoDS_Shape r = essai(cv, fc, GeomAbs_Arc, false);
        if (!r.IsNull()) return r;
      }
    }
  } catch (const Standard_Failure& e) {
    note(e.what());
  } catch (const std::exception& e) {
    note(e.what());
  }
  throw std::runtime_error(erreur.empty() ? "évidage refusé par le moteur (paroi trop épaisse ? ouverture mal placée ?)" : erreur);
}
}  // namespace

// occApplyCoque
TopoDS_Shape appliquerCoque(const Document& d, const Fonction& f, const TopoDS_Shape& result, std::vector<std::string>& msgs) {
  const double t = f.epaisseur;
  if (!(t > 1e-9)) {
    msgs.push_back(f.nom + " : épaisseur nulle — aucune coque");
    return result;
  }
  const size_t total = f.facesVisees.size();
  if (!total) {
    msgs.push_back(f.nom + " : aucune face à retirer (ouverture) — la coque resterait fermée et invisible");
    return result;
  }
  std::vector<EntreeCoque> entrees;
  for (const RefFace& r : f.facesVisees) {
    try {
      if (auto h = trouverFace(d, result, r)) entrees.push_back({&r, *h});
    } catch (const Standard_Failure&) {
    }
  }
  if (entrees.empty()) {
    msgs.push_back(f.nom + " : aucune des " + std::to_string(total) + " face(s) à retirer n'est retrouvée — la pièce a changé");
    return result;
  }
  if (entrees.size() < total) msgs.push_back(f.nom + " : " + std::to_string(total - entrees.size()) + " face(s) à retirer introuvable(s) sur la pièce courante");
  TopoDS_Shape r;
  std::string echec;
  try {
    r = recettesCoque(d, result, entrees, t);
  } catch (const Standard_Failure& e) {
    echec = e.what();
  } catch (const std::exception& e) {
    echec = e.what();
  }
  if (r.IsNull()) {
    // Isolation : quelles faces le moteur refuse
    std::vector<EntreeCoque> garde;
    for (const EntreeCoque& e : entrees) {
      auto essai = garde;
      essai.push_back(e);
      try {
        recettesCoque(d, result, essai, t);
        garde.push_back(e);
      } catch (const Standard_Failure&) {
      } catch (const std::exception&) {
      }
    }
    if (garde.empty()) {
      msgs.push_back(f.nom + " : coque impossible — " + echec + ". Essayez une paroi plus fine ou une autre face d'ouverture.");
      return result;
    }
    try {
      r = recettesCoque(d, result, garde, t);
    } catch (const Standard_Failure& e) {
      msgs.push_back(f.nom + " : coque impossible (" + e.what() + ")");
      return result;
    } catch (const std::exception& e) {
      msgs.push_back(f.nom + " : coque impossible (" + e.what() + ")");
      return result;
    }
    msgs.push_back(f.nom + " : coque partielle : " + std::to_string(garde.size()) + "/" + std::to_string(total) + " face(s) retirée(s), " + std::to_string(total - garde.size()) + " écartée(s) par le moteur");
  }
  try {
    return unifierForme(r);
  } catch (const Standard_Failure&) {
    return r;
  }
}

// occApplySplit
TopoDS_Shape appliquerScission(const Document& d, const Fonction& f, const TopoDS_Shape& result, bool cotePos, std::vector<std::string>& msgs) {
  // splitPlaneOf
  Vec3 o{0, 0, 0}, n{0, 0, 1};
  if (f.planSrc == "XZ") n = {0, 1, 0};
  else if (f.planSrc == "YZ") n = {1, 0, 0};
  else if (f.planSrc == "cg") {
    bool vu = false;
    for (const ElementConstruction& c : d.construction)
      if (c.id == f.planCg && c.aRepere) {
        o = c.o;
        n = c.z;
        vu = true;
      }
    if (!vu && f.aPlanON) {
      o = f.planO;
      n = f.planN;
    }
  } else if (f.planSrc == "face" && f.aPlanON) {
    o = f.planO;
    n = f.planN;
  }
  const double l = len3(n) != 0 ? len3(n) : 1;
  n = mul3(n, 1 / l);
  o = add3(o, n, f.decalage);
  if (f.flip) n = mul3(n, -1);
  const gp_Pln pln0(pnt(o), dirDe(n));
  const auto decouper = [](const TopoDS_Shape& s, const std::vector<TopoDS_Shape>& outils) {
    BRepAlgoAPI_Splitter sp;
    TopTools_ListOfShape la, lt;
    la.Append(s);
    for (const TopoDS_Shape& t : outils) lt.Append(t);
    sp.SetArguments(la);
    sp.SetTools(lt);
    sp.Build();
    if (!sp.IsDone()) throw std::runtime_error("découpe refusée par le noyau");
    const TopoDS_Shape r = sp.Shape();
    if (r.IsNull()) throw std::runtime_error("résultat vide");
    nomsTransmet({s}, histoireDe(sp), r);
    return r;
  };
  if (f.modeFonction == "body") {
    try {
      const Boite b = boiteDe(result);
      const Vec3 c{(b.lo[0] + b.hi[0]) / 2, (b.lo[1] + b.hi[1]) / 2, (b.lo[2] + b.hi[2]) / 2};
      const double dg = len3(sub3(b.hi, b.lo));
      const double k = dot3(sub3(c, o), n);
      const gp_Pln pln(pnt(add3(c, n, -k)), dirDe(n));
      const double R = dg + 10;
      BRepBuilderAPI_MakeFace mf(pln, -R, R, -R, R);
      if (!mf.IsDone()) throw std::runtime_error("plan de coupe invalide");
      const TopoDS_Shape r = decouper(result, {mf.Face()});
      std::vector<TopoDS_Shape> neg, pos;
      for (const TopoDS_Shape& s : solidesDe(r)) {
        GProp_GProps p;
        BRepGProp::VolumeProperties(s, p, false, false, false);
        const Vec3 ct = xyz(p.CentreOfMass());
        (dot3(sub3(ct, o), n) > 0 ? pos : neg).push_back(s);
      }
      if (neg.empty() || pos.empty()) {
        msgs.push_back(f.nom + " : le plan ne coupe pas le corps");
        return cotePos ? TopoDS_Shape() : result;
      }
      const auto& L = cotePos ? pos : neg;
      const TopoDS_Shape cote = L.size() == 1 ? L[0] : composeDeFormes(L);
      nomsCompose({r}, cote);
      return cote;
    } catch (const Standard_Failure& e) {
      msgs.push_back(f.nom + " : scission impossible, " + e.what());
    } catch (const std::exception& e) {
      msgs.push_back(f.nom + " : scission impossible, " + e.what());
    }
    return cotePos ? TopoDS_Shape() : result;
  }
  const size_t total = f.facesVisees.size();
  if (!total) {
    msgs.push_back(f.nom + " : aucune face à scinder");
    return result;
  }
  std::vector<TopoDS_Face> hs;
  for (const RefFace& r : f.facesVisees)
    if (auto h = trouverFaceQuelconque(d, result, r)) hs.push_back(*h);
  if (hs.empty()) {
    msgs.push_back(f.nom + " : aucune des " + std::to_string(total) + " face(s) n'est retrouvée, la pièce a changé");
    return result;
  }
  if (hs.size() < total) msgs.push_back(f.nom + " : " + std::to_string(total - hs.size()) + " face(s) introuvable(s) sur la pièce courante");
  try {
    std::vector<TopoDS_Shape> secs;
    for (const TopoDS_Face& h : hs) {
      BRepAlgoAPI_Section s(h, pln0, false);
      s.Build();
      if (!s.IsDone()) continue;
      const TopoDS_Shape r = s.Shape();
      if (TopExp_Explorer(r, TopAbs_EDGE).More()) secs.push_back(r);
    }
    if (secs.empty()) {
      msgs.push_back(f.nom + " : le plan ne coupe aucune des faces choisies");
      return result;
    }
    const TopoDS_Shape r = decouper(result, secs);
    const auto so = solidesDe(r);
    if (secs.size() < hs.size()) msgs.push_back(f.nom + " : " + std::to_string(hs.size() - secs.size()) + " face(s) non traversée(s) par le plan");
    if (so.size() == 1) nomsCompose({r}, so[0]);
    return so.size() == 1 ? so[0] : r;
  } catch (const Standard_Failure& e) {
    msgs.push_back(f.nom + " : scission impossible, " + e.what());
  } catch (const std::exception& e) {
    msgs.push_back(f.nom + " : scission impossible, " + e.what());
  }
  return result;
}

// occApplyBodyMove + bmFrame
TopoDS_Shape appliquerDeplacementCorps(const Fonction& f, const TopoDS_Shape& result, std::vector<std::string>& msgs) {
  Vec3 O{0, 0, 0}, X{1, 0, 0}, Y{0, 1, 0}, Z{0, 0, 1};
  const auto unit = [](const Vec3& v) -> std::optional<Vec3> {
    const double l = len3(v);
    if (!(l > 1e-12)) return std::nullopt;
    return mul3(v, 1 / l);
  };
  const auto rot = [](const Vec3& p, const Vec3& o, const Vec3& d, double a) {
    const Vec3 v = sub3(p, o);
    const double c = std::cos(a), s = std::sin(a);
    const Vec3 r = add3(add3(mul3(v, c), cross3(d, v), s), d, dot3(d, v) * (1 - c));
    return add3(r, o);
  };
  for (const EtapeDeplacement& e : f.etapes) {
    if (e.k == "t") O = add3(O, e.v);
    else if (e.k == "d") {
      if (const auto d = unit(e.d)) O = add3(O, *d, e.dist);
    } else if (e.k == "p") O = add3(O, sub3(e.b, e.a));
    else if (e.k == "r") {
      const auto d = unit(e.d);
      const double a = e.deg * PI_ / 180;
      if (!d || a == 0) continue;
      const Vec3 zero{0, 0, 0};
      O = rot(O, e.o, *d, a);
      X = rot(X, zero, *d, a);
      Y = rot(Y, zero, *d, a);
      Z = rot(Z, zero, *d, a);
    }
  }
  const Vec3 I[4] = {{0, 0, 0}, {1, 0, 0}, {0, 1, 0}, {0, 0, 1}};
  const Vec3 V[4] = {O, X, Y, Z};
  bool identite = true;
  for (int i = 0; i < 4; i++)
    for (int j = 0; j < 3; j++)
      if (std::abs(V[i][j] - I[i][j]) >= 1e-12) identite = false;
  if (identite) {
    if (f.etapes.empty()) msgs.push_back(f.nom + " : aucune étape, le corps reste en place");
    return result;
  }
  try {
    gp_Trsf t;
    t.SetValues(X[0], Y[0], Z[0], O[0], X[1], Y[1], Z[1], O[1], X[2], Y[2], Z[2], O[2]);
    BRepBuilderAPI_Transform b(result, t, true);
    const TopoDS_Shape s = b.Shape();
    nomsMemeRangs(result, s);
    return s;
  } catch (const Standard_Failure& e) {
    msgs.push_back(f.nom + " : déplacement impossible (" + e.what() + ")");
    return result;
  }
}

// occApplyBodyScale
TopoDS_Shape appliquerEchelle(const Fonction& f, const TopoDS_Shape& result, std::vector<std::string>& msgs) {
  const double k[3] = {f.echelleUni ? f.echelle : f.echelleX, f.echelleUni ? f.echelle : f.echelleY, f.echelleUni ? f.echelle : f.echelleZ};
  for (double v : k)
    if (!(v > 0) || !std::isfinite(v)) {
      msgs.push_back(f.nom + " : facteur nul ou négatif, le corps reste tel quel");
      return result;
    }
  if (std::abs(k[0] - 1) < 1e-12 && std::abs(k[1] - 1) < 1e-12 && std::abs(k[2] - 1) < 1e-12) return result;
  try {
    if (k[0] == k[1] && k[1] == k[2]) {
      gp_Trsf t;
      t.SetScale(pnt(f.centre), k[0]);
      BRepBuilderAPI_Transform b(result, t, true);
      const TopoDS_Shape s = b.Shape();
      nomsMemeRangs(result, s);
      return s;
    }
    gp_GTrsf t;
    for (int i = 0; i < 3; i++) {
      t.SetValue(i + 1, i + 1, k[i]);
      t.SetValue(i + 1, 4, f.centre[i] * (1 - k[i]));
    }
    BRepBuilderAPI_GTransform b(result, t, true);
    if (!b.IsDone()) throw std::runtime_error("transformation refusée");
    const TopoDS_Shape s = b.Shape();
    nomsMemeRangs(result, s);
    return s;
  } catch (const Standard_Failure& e) {
    msgs.push_back(f.nom + " : mise à l'échelle impossible (" + e.what() + ")");
  } catch (const std::exception& e) {
    msgs.push_back(f.nom + " : mise à l'échelle impossible (" + e.what() + ")");
  }
  return result;
}

// occShapeOfSweep
TopoDS_Shape formeBalayage(const Document& d, const Fonction& f, std::vector<std::string>& alertes) {
  const Esquisse* sk = nullptr;
  const Esquisse* pk = nullptr;
  for (const Esquisse& s : d.esquisses) {
    if (s.id == f.esquisse) sk = &s;
    if (s.id == f.chemin) pk = &s;
  }
  if (!sk) throw std::runtime_error("esquisse du profil introuvable");
  if (f.chemin.empty()) throw std::runtime_error("aucun chemin choisi");
  if (f.chemin == f.esquisse) throw std::runtime_error("le chemin doit être dans une AUTRE esquisse que le profil");
  if (!pk) throw std::runtime_error("esquisse du chemin introuvable");
  const Trace tr = tracerContours(*sk);
  if (tr.solides.empty() && tr.cerclesSeuls.empty()) throw std::runtime_error("profil non fermé");
  // sweepProfileCenter
  std::optional<Vec3> centre;
  {
    double x = 0, y = 0;
    int n = 0;
    const auto voir = [&](const std::string& id) {
      if (id.empty()) return;
      auto i = sk->points.find(id);
      if (i == sk->points.end()) return;
      x += i->second.x;
      y += i->second.y;
      n++;
    };
    for (const Entite& e : sk->entites) {
      if (e.construction || e.ref) continue;
      if (e.t == "circle") voir(e.pc);
      voir(e.p1);
      voir(e.p2);
      voir(e.pa);
      voir(e.pb);
    }
    if (n) centre = xyz(pointMonde(*sk, x / n, y / n));
  }
  // sweepPath2D : les arêtes du tracé de l'esquisse du chemin
  Trace tc = tracerContours(*pk);
  const Entite* cercle = nullptr;
  std::vector<const Entite*> ronds;
  for (const Entite& e : pk->entites)
    if (!e.construction && !e.ref && (e.t == "circle" || (e.t == "arc" && e.pa == e.pb))) ronds.push_back(&e);
  int nbTraits = 0;
  for (const Entite& e : pk->entites)
    if (!e.construction && !e.ref && (e.t == "line" || e.t == "arc" || e.t == "circle" || e.t == "spline")) nbTraits++;
  if (!nbTraits) throw std::runtime_error("le chemin est vide");
  if (!ronds.empty()) {
    if (nbTraits > 1) throw std::runtime_error("un cercle ne sert de chemin que seul dans son esquisse");
    cercle = ronds[0];
    if (!pk->points.count(cercle->pc) || !(cercle->r > 1e-9)) throw std::runtime_error("chemin : cercle dégénéré");
  }
  Chaine chaine;
  bool aSpline = false;
  Vec3 S{}, T{};
  if (cercle) {
    const Pt& C = pk->points.at(cercle->pc);
    S = xyz(pointMonde(*pk, C.x + cercle->r, C.y));
    T = {pk->v[0], pk->v[1], pk->v[2]};
  } else {
    if (tc.aretes.empty()) throw std::runtime_error("chemin : lignes, arcs ou splines dégénérés");
    std::vector<std::string> ids;
    std::map<std::string, int> deg;
    for (const Arete& a : tc.aretes) {
      for (const std::string* p : {&a.a, &a.b}) {
        if (!deg.count(*p)) ids.push_back(*p);
        deg[*p]++;
      }
      if (a.spline) aSpline = true;
    }
    std::vector<std::string> bouts;
    for (const std::string& id : ids) {
      if (deg[id] > 2) throw std::runtime_error("le chemin se ramifie : il faut UNE chaîne continue, sans embranchement");
      if (deg[id] == 1) bouts.push_back(id);
    }
    if (bouts.size() > 2) throw std::runtime_error("le chemin est en plusieurs morceaux");
    const std::vector<std::string>& cands = bouts.empty() ? ids : bouts;
    std::string depart = cands[0];
    if (centre) {
      double best = 1e18;
      for (const std::string& id : cands) {
        const Pt& p = tc.pts.at(id);
        const double dd = len3(sub3(xyz(pointMonde(*pk, p.x, p.y)), *centre));
        if (dd < best - 1e-9) {
          best = dd;
          depart = id;
        }
      }
    }
    std::vector<bool> pris(tc.aretes.size(), false);
    std::string cur = depart;
    for (;;) {
      int i = -1;
      for (size_t k = 0; k < tc.aretes.size(); k++)
        if (!pris[k] && (tc.aretes[k].a == cur || tc.aretes[k].b == cur)) {
          i = static_cast<int>(k);
          break;
        }
      if (i < 0) break;
      pris[i] = true;
      chaine.push_back({i, cur});
      cur = tc.aretes[i].a == cur ? tc.aretes[i].b : tc.aretes[i].a;
    }
    if (chaine.size() < tc.aretes.size()) throw std::runtime_error("le chemin est en plusieurs morceaux");
    // sweepStart3
    const Pas& p0 = chaine[0];
    const Arete& ed = tc.aretes[p0.arete];
    const Pt& A = tc.pts.at(p0.depuis);
    const Pt& B0 = tc.pts.at(ed.a == p0.depuis ? ed.b : ed.a);
    double tx = 0, ty = 0;
    if (ed.spline) {
      const auto pl = polyArete(ed, p0.depuis);
      if (pl.size() >= 2) {
        tx = pl[1][0] - pl[0][0];
        ty = pl[1][1] - pl[0][1];
      }
    } else if (ed.arc && ed.e) {
      const Pt* C = nullptr;
      if (auto i = pk->points.find(ed.e->pc); i != pk->points.end()) C = &i->second;
      const auto an = anglesArc(*pk, *ed.e);
      if (C && an) {
        const double a = std::atan2(A.y - C->y, A.x - C->x);
        const auto nm = [](double t) { return std::fmod(std::fmod(t, TAU_) + TAU_, TAU_); };
        const bool ccw = std::min(nm(a - an->a1), TAU_ - nm(a - an->a1)) <= std::min(nm(a - an->a2), TAU_ - nm(a - an->a2));
        tx = ccw ? -std::sin(a) : std::sin(a);
        ty = ccw ? std::cos(a) : -std::cos(a);
      }
    } else {
      tx = B0.x - A.x;
      ty = B0.y - A.y;
    }
    S = xyz(pointMonde(*pk, A.x, A.y));
    T = {pk->u[0] * tx + pk->v[0] * ty, pk->u[1] * tx + pk->v[1] * ty, pk->u[2] * tx + pk->v[2] * ty};
    const double L = len3(T) != 0 ? len3(T) : 1;
    T = mul3(T, 1 / L);
  }
  const Vec3 nSk{sk->n[0], sk->n[1], sk->n[2]};
  const double cosA = std::abs(dot3(nSk, T));
  if (cosA < 0.02) throw std::runtime_error("le chemin part DANS le plan du profil : dessinez le profil sur un plan qui coupe le chemin");
  if (const double dz = std::abs(dot3(sub3(S, Vec3{sk->o[0], sk->o[1], sk->o[2]}), nSk)); dz > 0.01) {
    char t[160];
    snprintf(t, sizeof t, "le départ du chemin est à %.2f mm du plan du profil : le solide part du profil, décalé d'autant", dz);
    alertes.push_back(t);
  }
  // Le fil du chemin
  TopoDS_Wire spine;
  if (cercle) {
    const Pt& C = pk->points.at(cercle->pc);
    const gp_Circ ci(gp_Ax2(pointMonde(*pk, C.x, C.y), gp_Dir(pk->n[0], pk->n[1], pk->n[2])), cercle->r);
    BRepBuilderAPI_MakeEdge me(ci);
    if (!me.IsDone()) throw std::runtime_error("chemin circulaire impossible");
    BRepBuilderAPI_MakeWire mw;
    mw.Add(me.Edge());
    spine = mw.Wire();
  } else {
    spine = contourEsquisse(*pk, tc, chaine);
  }
  const auto pipe = [&](const TopoDS_Wire& w, const std::vector<CoteNom>& cotes) {
    BRepOffsetAPI_MakePipeShell ps(spine);
    if (aSpline) ps.SetMode(gp_Dir(pk->n[0], pk->n[1], pk->n[2]));
    else ps.SetMode(false);
    ps.SetTransitionMode(BRepBuilderAPI_RightCorner);
    ps.Add(w, false, false);
    ps.Build();
    if (!ps.IsDone()) throw std::runtime_error("balayage impossible (rayon du chemin plus petit que le profil ?)");
    if (!ps.MakeSolid()) throw std::runtime_error("balayage : le solide ne se ferme pas");
    TopoDS_Shape s = ps.Shape();
    if (volumeForme(s) < 0) s = s.Reversed();
    nomsPrismeFaces([&ps](const TopoDS_Shape& x) { return ps.Generated(x); }, [&ps] { return ps.FirstShape(); }, [&ps] { return ps.LastShape(); }, s, cotes);
    nomsPrefixe(s, f.id);
    return s;
  };
  const auto pipeContour = [&](const Chaine& ch) {
    std::vector<CoteNom> cotes;
    const TopoDS_Wire w = contourEsquisse(*sk, tr, ch, &cotes);
    return pipe(w, cotes);
  };
  const auto pipeCercle = [&](const Entite& c) {
    auto i = sk->points.find(c.pc);
    if (i == sk->points.end()) throw std::runtime_error("pastille : centre introuvable");
    const gp_Circ ci(gp_Ax2(pointMonde(*sk, i->second.x, i->second.y), gp_Dir(sk->n[0], sk->n[1], sk->n[2])), c.r);
    BRepBuilderAPI_MakeEdge me(ci);
    if (!me.IsDone()) throw std::runtime_error("cercle du profil impossible");
    BRepBuilderAPI_MakeWire mw;
    mw.Add(me.Edge());
    const std::vector<CoteNom> cotes{{mw.Edge(), c.id}};
    return pipe(mw.Wire(), cotes);
  };
  TopoDS_Shape forme;
  const auto ajouter = [&](const TopoDS_Shape& s) { forme = forme.IsNull() ? s : unifierForme(fusionFormes(forme, s)); };
  std::set<std::string> vus;
  for (size_t si = 0; si < tr.solides.size(); si++) {
    const auto& sol = tr.solides[si];
    std::vector<std::string> cles;
    for (const Pas& q : sol.chaine) {
      const Arete& ed = tr.aretes[q.arete];
      cles.push_back(ed.e ? ed.e->id : ed.a + ">" + ed.b);
    }
    std::sort(cles.begin(), cles.end());
    std::string cle;
    for (const std::string& c : cles) cle += c + "|";
    if (!vus.insert(cle).second) continue;
    TopoDS_Shape s = pipeContour(sol.chaine);
    for (const auto& h : sol.trous) s = coupeFormes(s, pipeContour(h));
    for (const auto& ch : tr.trousRonds)
      if (ch.solide == static_cast<int>(si)) s = coupeFormes(s, pipeCercle(*ch.cercle));
    ajouter(s);
  }
  // sweepCircleNest : profondeur paire = matière, impaire = trou de son parent
  struct Nid {
    const Entite* c;
    int prof = 0;
    int parent = -1;
  };
  std::vector<Nid> nids;
  for (const Entite* c : tr.cerclesSeuls) nids.push_back({c});
  const auto dedans = [&](const Entite& a, const Entite& b) {
    auto A = sk->points.find(a.pc);
    auto B = sk->points.find(b.pc);
    return A != sk->points.end() && B != sk->points.end() && &a != &b && b.r > a.r && std::hypot(A->second.x - B->second.x, A->second.y - B->second.y) + a.r < b.r - 1e-6;
  };
  for (size_t i = 0; i < nids.size(); i++)
    for (size_t j = 0; j < nids.size(); j++)
      if (dedans(*nids[i].c, *nids[j].c)) {
        nids[i].prof++;
        if (nids[i].parent < 0 || nids[j].c->r < nids[nids[i].parent].c->r) nids[i].parent = static_cast<int>(j);
      }
  for (size_t i = 0; i < nids.size(); i++) {
    if (nids[i].prof % 2) continue;
    TopoDS_Shape s = pipeCercle(*nids[i].c);
    for (size_t j = 0; j < nids.size(); j++)
      if (nids[j].parent == static_cast<int>(i)) s = coupeFormes(s, pipeCercle(*nids[j].c));
    ajouter(s);
  }
  if (forme.IsNull()) throw std::runtime_error("solide vide");
  if (!valide(forme)) alertes.push_back("solide douteux : le profil se recoupe le long du chemin (virage trop serré ?)");
  return forme;
}
