// La mise en plan : modèle, vues projetées et dessin de la planche (src/98-mep-00, 10, 20, 30, 40, 50, 60).
#include "plan.h"

#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepAlgoAPI_Cut.hxx>
#include <BRepBndLib.hxx>
#include <BRepBuilderAPI_GTransform.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakePolygon.hxx>
#include <BRepBuilderAPI_Transform.hxx>
#include <BRepPrimAPI_MakePrism.hxx>
#include <BRep_Builder.hxx>
#include <Bnd_Box.hxx>
#include <HLRAppli_ReflectLines.hxx>
#include <HLRBRep_TypeOfResultingEdge.hxx>
#include <Poly_Triangulation.hxx>
#include <BRep_Tool.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Compound.hxx>
#include <gp_GTrsf.hxx>
#include <gp_Pln.hxx>

#include <algorithm>
#include <cmath>
#include <functional>
#include <set>
#include <sstream>
#include <unordered_map>

#include "conges.h"
#include "filets.h"
#include "rejeu.h"
#include "percage.h"
#include "plan_interne.h"

namespace plan {
namespace {
// ── format, cadre ──
struct Cadre {
  double l = 12, r = 12, t = 12, b = 12, lw = 0.9;
  bool inner = true, centre = false, zones = false, trim = false;
  std::string col, mcol;
  double zw = 0, zh = 0, zx0 = 0, zy0 = 0;
  bool aZx0 = false, aZy0 = false;
};
bool couleurHex(const std::string& s) {
  if (s.size() != 7 || s[0] != '#') return false;
  for (size_t i = 1; i < 7; i++)
    if (!std::isxdigit(static_cast<unsigned char>(s[i]))) return false;
  return true;
}
Cadre cadreDe(const J& sh) {  // mepFrameOf
  Cadre f;
  const J& o = sous(sh, "frame");
  if (o.is_object()) {
    f.l = o.contains("l") ? nv(o["l"]) : f.l;
    f.r = o.contains("r") ? nv(o["r"]) : f.r;
    f.t = o.contains("t") ? nv(o["t"]) : f.t;
    f.b = o.contains("b") ? nv(o["b"]) : f.b;
    if (o.contains("lw")) f.lw = nv(o["lw"]) != 0 ? nv(o["lw"]) : 0.9;
    if (o.contains("inner")) f.inner = vrai(o, "inner");
    if (o.contains("centre")) f.centre = vrai(o, "centre");
    if (o.contains("zones")) f.zones = vrai(o, "zones");
    if (o.contains("trim")) f.trim = vrai(o, "trim");
    f.col = chaine(o, "col");
    f.mcol = chaine(o, "mcol");
    if (!couleurHex(f.col)) f.col.clear();
    if (!couleurHex(f.mcol)) f.mcol.clear();
    f.zw = num(o, "zw"), f.zh = num(o, "zh");
    if (o.contains("zx0") && !o["zx0"].is_null()) f.aZx0 = true, f.zx0 = nv(o["zx0"]);
    if (o.contains("zy0") && !o["zy0"].is_null()) f.aZy0 = true, f.zy0 = nv(o["zy0"]);
  }
  for (double* c : {&f.l, &f.r, &f.t, &f.b}) *c = std::min(40.0, std::max(0.0, *c));
  f.lw = std::min(2.0, std::max(0.1, f.lw));
  return f;
}
void pageWH(const J& sh, double& W, double& H) {  // mepPageWH
  const std::string fmt = chaine(sh, "format", "A3");
  if (fmt == "Manuel") {
    W = num(sh, "fw", 420);
    H = num(sh, "fh", 297);
    if (W == 0) W = 420;
    if (H == 0) H = 297;
    return;
  }
  double a = 297, b = 420;
  if (fmt == "A0") a = 841, b = 1189;
  else if (fmt == "A1") a = 594, b = 841;
  else if (fmt == "A2") a = 420, b = 594;
  else if (fmt == "A4") a = 210, b = 297;
  if (chaine(sh, "orient") == "landscape") W = b, H = a;
  else W = a, H = b;
}
struct Page {
  double W = 0, H = 0, ix = 0, iy = 0, iw = 0, ih = 0, th = 0;
  Cadre fr;
};
const double TITLE_H = 26;
bool cartoucheEsquisse(const J& sh) {  // mepTbIsSk
  const J& tb = sous(sous(sh, "title"), "tb");
  return tb.is_object() && chaine(tb, "kind") == "sk" && vrai(tb, "sk") && vrai(tb["sk"], "pts");
}
double pointX(const J& p) { return num(p, "x"); }
double pointY(const J& p) { return num(p, "y"); }
void tbBoite(const J& sk, double limW, double limH, double& minx, double& miny) {  // mepTbBBox
  minx = 0, miny = 0;
  const auto dehors = [&](const J& p) {
    const double x = pointX(p), y = pointY(p);
    return x < -limW || y < -limH || x > 1 || y > 1;
  };
  std::set<std::string> reels, cst;
  const J& ents = sous(sk, "ents");
  if (ents.is_array())
    for (const J& e : ents)
      for (const char* k : {"p1", "p2", "pc", "p"})
        if (vrai(e, k)) (vrai(e, "cst") ? cst : reels).insert(chaine(e, k));
  const J& pts = sous(sk, "pts");
  if (pts.is_object())
    for (auto it = pts.begin(); it != pts.end(); ++it) {
      if (dehors(it.value()) || (cst.count(it.key()) && !reels.count(it.key()))) continue;
      minx = std::min(minx, pointX(it.value()));
      miny = std::min(miny, pointY(it.value()));
    }
  if (ents.is_array())
    for (const J& e : ents) {
      const std::string t = chaine(e, "t");
      if (t == "circle" && !vrai(e, "cst")) {
        const J& c = sous(pts, chaine(e, "pc").c_str());
        if (c.is_object() && !dehors(c)) {
          minx = std::min(minx, pointX(c) - num(e, "r"));
          miny = std::min(miny, pointY(c) - num(e, "r"));
        }
      } else if (t == "text") {
        const J& p = sous(pts, chaine(e, "p").c_str());
        if (p.is_object() && !dehors(p)) {
          const double h = num(e, "h") != 0 ? num(e, "h") : 3.5;
          miny = std::min(miny, pointY(p) - 0.75 * h);
        }
      }
    }
}
double tbHauteur(const J& sh) {  // mepTbH
  if (!cartoucheEsquisse(sh)) return TITLE_H;
  double W, H;
  pageWH(sh, W, H);
  const Cadre f = cadreDe(sh);
  const double lw = W - f.l - f.r, lh = H - f.t - f.b;
  const J& tb = sh["title"]["tb"];
  if (num(tb, "hRes") > 0) return std::min(lh * 0.6, num(tb, "hRes"));
  double mx, my;
  tbBoite(tb["sk"], lw, lh, mx, my);
  return std::min(lh * 0.6, std::max(0.0, -my));
}
Page pageDe(const J& sh) {  // mepPageDim
  Page p;
  pageWH(sh, p.W, p.H);
  p.fr = cadreDe(sh);
  p.th = tbHauteur(sh);
  p.ix = p.fr.l;
  p.iy = p.fr.t;
  p.iw = p.W - p.fr.l - p.fr.r;
  p.ih = p.H - p.fr.t - p.fr.b - p.th;
  return p;
}

// ── projection (mepFitCircle, mepHlrAddEdge, mepHlrExact...) ──
long long rond(double x) { return static_cast<long long>(std::floor(x + 0.5)); }
struct Cercle {
  double cx = 0, cy = 0, r = 0, a0 = 0, a1 = 0, sweep = 0;
  bool full = false;
};
bool cercleDePoints(const std::vector<P2>& pts, Cercle& out) {  // mepFitCircle
  if (pts.size() < 4) return false;
  std::vector<P2> p = pts;
  bool closed = false;
  if (std::hypot(pts.back()[0] - pts[0][0], pts.back()[1] - pts[0][1]) < 1e-6) {
    closed = true;
    p.pop_back();
  }
  if (p.size() < 4) return false;
  const size_t n = p.size();
  const size_t ib = closed ? n / 3 : n >> 1, ic = closed ? 2 * n / 3 : n - 1;
  const P2 a = p[0], b = p[ib], c = p[ic];
  const double d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (std::abs(d) < 1e-9) return false;
  const double A = a[0] * a[0] + a[1] * a[1], B = b[0] * b[0] + b[1] * b[1], C = c[0] * c[0] + c[1] * c[1];
  const double ux = (A * (b[1] - c[1]) + B * (c[1] - a[1]) + C * (a[1] - b[1])) / d;
  const double uy = (A * (c[0] - b[0]) + B * (a[0] - c[0]) + C * (b[0] - a[0])) / d;
  const double r = std::hypot(a[0] - ux, a[1] - uy);
  if (!(r > 0.05)) return false;
  for (const P2& q : p)
    if (std::abs(std::hypot(q[0] - ux, q[1] - uy) - r) > 0.03) return false;
  const auto th = [&](size_t i) { return std::atan2(p[i][1] - uy, p[i][0] - ux); };
  const auto borne = [](double x) {
    while (x > PI) x -= 2 * PI;
    while (x < -PI) x += 2 * PI;
    return x;
  };
  double sweep = 0;
  for (size_t i = 0; i + 1 < p.size(); i++) sweep += borne(th(i + 1) - th(i));
  if (closed) sweep += borne(th(0) - th(p.size() - 1));
  out.cx = ux, out.cy = uy, out.r = r, out.a0 = th(0), out.a1 = th(0) + sweep, out.sweep = sweep;
  out.full = (closed && std::abs(sweep) >= PI * 1.5) || std::abs(sweep) >= 2 * PI * 0.97;
  return true;
}
std::vector<V3> pointsCourbe(const BRepAdaptor_Curve& ad, double u0, double u1, double tol, size_t cap) {  // occCurvePts
  const auto at = [&](double u) {
    const gp_Pnt p = ad.Value(u);
    return V3{p.X(), p.Y(), p.Z()};
  };
  const double sweep = u1 - u0;
  double R = -1;
  if (ad.GetType() == GeomAbs_Circle) R = ad.Circle().Radius();
  std::vector<V3> out;
  if (R > 1e-6) {
    double dth = 2 * std::acos(std::max(-1.0, std::min(1.0, 1 - tol / R)));
    if (!(dth > 1e-3)) dth = 1e-3;
    const double n0 = std::ceil(std::abs(sweep) / dth);
    const int n = static_cast<int>(std::max(4.0, std::min(static_cast<double>(cap), n0)));
    for (int i = 0; i <= n; i++) out.push_back(at(u0 + sweep * i / n));
    return out;
  }
  const auto dev = [&](double a, double b) {
    const V3 A = at(a), B = at(b), M = at((a + b) / 2);
    return std::sqrt(std::pow(M[0] - (A[0] + B[0]) / 2, 2) + std::pow(M[1] - (A[1] + B[1]) / 2, 2) + std::pow(M[2] - (A[2] + B[2]) / 2, 2));
  };
  std::vector<std::array<double, 2>> pile{{u0, u1}}, feuilles;
  while (!pile.empty() && feuilles.size() < cap) {
    const auto s = pile.back();
    pile.pop_back();
    if (dev(s[0], s[1]) > tol) {
      const double m = (s[0] + s[1]) / 2;
      pile.push_back({m, s[1]});
      pile.push_back({s[0], m});
    } else {
      feuilles.push_back(s);
    }
  }
  std::sort(feuilles.begin(), feuilles.end(), [](const auto& a, const auto& b) { return a[0] < b[0]; });
  std::vector<double> us{u0};
  for (const auto& l : feuilles)
    if (l[1] > us.back() + 1e-12) us.push_back(l[1]);
  for (double u : us) out.push_back(at(u));
  return out;
}
int ajouterAretes(Geo& geo, std::set<std::string>& added, const Base& b, const TopoDS_Shape& forme, const std::string& kind) {  // mepHlrAddEdge
  if (forme.IsNull()) return 0;
  int n = 0;
  for (TopExp_Explorer ex(forme, TopAbs_EDGE); ex.More(); ex.Next()) {
    try {
      const BRepAdaptor_Curve ad(TopoDS::Edge(ex.Current()));
      const double u0 = ad.FirstParameter(), u1 = ad.LastParameter();
      if (!(u1 > u0)) continue;
      const std::vector<V3> pts = pointsCourbe(ad, u0, u1, 0.02, 400);
      if (pts.size() < 2) continue;
      std::vector<P2> lp;
      std::vector<double> wp;
      for (const V3& p : pts) {
        lp.push_back({dot(p, b.u), dot(p, b.v)});
        wp.push_back(dot(p, b.dir));
      }
      Cercle cir;
      if (cercleDePoints(lp, cir)) {
        const std::string kc = "C" + std::to_string(rond(cir.cx * 100)) + "," + std::to_string(rond(cir.cy * 100)) + "," + std::to_string(rond(cir.r * 100));
        const std::string ka = "A" + kc + "," + std::to_string(rond(cir.a0 * 400)) + "," + std::to_string(rond(cir.a1 * 400));
        const std::string& kk = cir.full ? kc : ka;
        if (added.insert(kk).second) {
          double w = 0;
          for (double x : wp) w += x;
          Ent e;
          e.t = cir.full ? 'C' : 'A';
          e.cx = cir.cx, e.cy = cir.cy, e.r = cir.r, e.a0 = cir.a0, e.a1 = cir.a1, e.k = kind;
          e.aW = true, e.w = w / wp.size();
          geo.els.push_back(e);
          n++;
        }
      } else {
        for (size_t i = 0; i + 1 < lp.size(); i++) {
          const P2 A = lp[i], B = lp[i + 1];
          const double dx = B[0] - A[0], dy = B[1] - A[1];
          if (dx * dx + dy * dy < 1e-8) continue;
          const auto cle = [](const P2& p, const P2& q) { return std::to_string(rond(p[0] * 100)) + "," + std::to_string(rond(p[1] * 100)) + "," + std::to_string(rond(q[0] * 100)) + "," + std::to_string(rond(q[1] * 100)); };
          const std::string k = cle(A, B);
          if (added.count(k) || added.count(cle(B, A))) continue;
          added.insert(k);
          Ent e;
          e.t = 'L';
          e.x1 = A[0], e.y1 = A[1], e.x2 = B[0], e.y2 = B[1], e.k = kind;
          e.aW = true, e.w = (wp[i] + wp[i + 1]) / 2;
          geo.els.push_back(e);
          n++;
        }
      }
    } catch (const Standard_Failure&) {
    }
  }
  return n;
}
TopoDS_Shape compose(const std::vector<TopoDS_Shape>& L) {  // occCompoundOf
  if (L.empty()) return TopoDS_Shape();
  if (L.size() == 1) return L[0];
  TopoDS_Compound c;
  BRep_Builder bd;
  bd.MakeCompound(c);
  for (const TopoDS_Shape& s : L) bd.Add(c, s);
  return c;
}
bool hlrExact(Geo& geo, const J& view, const Base& b, const std::vector<TopoDS_Shape>& formes, std::set<std::string>& added) {  // mepHlrExact
  try {
    const TopoDS_Shape model = compose(formes);
    if (model.IsNull()) return false;
    HLRAppli_ReflectLines hlr(model);
    hlr.SetAxes(b.dir[0], b.dir[1], b.dir[2], 0, 0, 0, b.u[0], b.u[1], b.u[2]);
    hlr.Perform();
    const bool sec = vrai(view, "section"), tan = vrai(view, "tangent");
    const std::string mode = chaine(view, "mode", "hide");
    const std::string kindV = sec ? "sect" : "sharp";
    int n = 0;
    n += ajouterAretes(geo, added, b, hlr.GetCompoundOf3dEdges(HLRBRep_Sharp, true, true), kindV);
    n += ajouterAretes(geo, added, b, hlr.GetCompoundOf3dEdges(HLRBRep_OutLine, true, true), kindV);
    if (tan) n += ajouterAretes(geo, added, b, hlr.GetCompoundOf3dEdges(HLRBRep_Rg1Line, true, true), sec ? "sect" : "tangent");
    if (mode == "dash") {
      n += ajouterAretes(geo, added, b, hlr.GetCompoundOf3dEdges(HLRBRep_Sharp, false, true), "hidden");
      n += ajouterAretes(geo, added, b, hlr.GetCompoundOf3dEdges(HLRBRep_OutLine, false, true), "hidden");
      if (tan) n += ajouterAretes(geo, added, b, hlr.GetCompoundOf3dEdges(HLRBRep_Rg1Line, false, true), "hidden");
    }
    return n > 0;
  } catch (const Standard_Failure&) {
    return false;
  }
}
// Traits colinéaires bout à bout → un seul trait (mepMergeCollinear)
void souder(std::vector<Ent>& els) {
  using Cle = std::string;
  const auto key = [](double x, double y) { return std::to_string(rond(x * 500)) + "," + std::to_string(rond(y * 500)); };
  std::unordered_map<Cle, int> deg;
  std::unordered_map<Cle, std::vector<int>> at;
  const auto bump = [&](double x, double y) {
    const Cle k = key(x, y);
    deg[k]++;
    return k;
  };
  for (int i = 0; i < static_cast<int>(els.size()); i++) {
    const Ent& e = els[i];
    if (e.t == 'L') {
      at[bump(e.x1, e.y1)].push_back(i);
      at[bump(e.x2, e.y2)].push_back(i);
    } else if (e.t == 'A') {
      bump(e.cx + e.r * std::cos(e.a0), e.cy + e.r * std::sin(e.a0));
      bump(e.cx + e.r * std::cos(e.a1), e.cy + e.r * std::sin(e.a1));
    }
  }
  std::set<int> dead;
  const auto tryEnd = [&](int i, int end) {
    Ent& e = els[i];
    const double px = end == 1 ? e.x1 : e.x2, py = end == 1 ? e.y1 : e.y2;
    const Cle k = key(px, py);
    auto d = deg.find(k);
    if (d == deg.end() || d->second != 2) return false;
    int j = -1;
    for (int n : at[k])
      if (n != i && !dead.count(n)) {
        j = n;
        break;
      }
    if (j < 0) return false;
    const Ent& f = els[j];
    if (f.k != e.k) return false;
    const int fj = key(f.x1, f.y1) == k ? 2 : (key(f.x2, f.y2) == k ? 1 : 0);
    if (!fj) return false;
    const double fx = fj == 1 ? f.x1 : f.x2, fy = fj == 1 ? f.y1 : f.y2;
    const double ox = end == 1 ? e.x2 : e.x1, oy = end == 1 ? e.y2 : e.y1;
    const double dx = fx - ox, dy = fy - oy, L = std::hypot(dx, dy);
    if (L < 1e-9) return false;
    const double dev = std::abs((px - ox) * dy - (py - oy) * dx) / L;
    if (dev > 0.002 || ((px - ox) * dx + (py - oy) * dy) <= 0 || ((fx - px) * dx + (fy - py) * dy) <= 0) return false;
    dead.insert(j);
    if (end == 1) e.x1 = fx, e.y1 = fy;
    else e.x2 = fx, e.y2 = fy;
    const Cle nk = key(fx, fy);
    auto a = at.find(nk);
    if (a != at.end()) a->second.push_back(i);
    return true;
  };
  for (int i = 0; i < static_cast<int>(els.size()); i++) {
    if (els[i].t != 'L' || dead.count(i)) continue;
    while (tryEnd(i, 1) || tryEnd(i, 2)) {
    }
  }
  if (dead.empty()) return;
  std::vector<Ent> r;
  for (int i = 0; i < static_cast<int>(els.size()); i++)
    if (!dead.count(i)) r.push_back(els[i]);
  els.swap(r);
}
// Boîte des corps, pour la matière ôtée d'une coupe
void boite(const TopoDS_Shape& s, double& diag, V3& C, bool& aC) {
  Bnd_Box b;
  BRepBndLib::Add(s, b);
  if (b.IsVoid()) return;
  double x0, y0, z0, x1, y1, z1;
  b.Get(x0, y0, z0, x1, y1, z1);
  const double d = std::sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0) + (z1 - z0) * (z1 - z0));
  if (d > diag) {
    diag = d;
    C = {(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2};
    aC = true;
  }
}
TopoDS_Shape coupeDemiEspace(const TopoDS_Shape& forme, const std::vector<TopoDS_Shape>& tous, const V3& p0, const V3& nrm) {  // mepCutHalfSpace
  try {
    const V3 n = norme(nrm), p = norme(std::abs(n[2]) > 0.9 ? V3{0, 1, 0} : V3{0, 0, 1});
    V3 U = cross(n, p);
    const double Lu = std::sqrt(dot(U, U));
    if (Lu < 1e-6) return TopoDS_Shape();
    U = {U[0] / Lu, U[1] / Lu, U[2] / Lu};
    const V3 W = cross(n, U);
    double diag = 0;
    V3 C{0, 0, 0};
    bool aC = false;
    {
      TopoDS_Shape t = compose(tous);
      if (!t.IsNull()) boite(t, diag, C, aC);
    }
    if (!(diag > 1)) diag = 400;
    V3 Q = p0;
    if (aC) {
      const double h = (C[0] - p0[0]) * n[0] + (C[1] - p0[1]) * n[1] + (C[2] - p0[2]) * n[2];
      Q = {C[0] - n[0] * h, C[1] - n[1] * h, C[2] - n[2] * h};
    }
    const double A = diag / 2 + 20;
    BRepBuilderAPI_MakePolygon poly;
    for (const auto& c : {P2{-A, -A}, P2{A, -A}, P2{A, A}, P2{-A, A}}) poly.Add(gp_Pnt(Q[0] + U[0] * c[0] + W[0] * c[1], Q[1] + U[1] * c[0] + W[1] * c[1], Q[2] + U[2] * c[0] + W[2] * c[1]));
    poly.Close();
    if (!poly.IsDone()) return TopoDS_Shape();
    BRepBuilderAPI_MakeFace fm(poly.Wire(), true);
    if (!fm.IsDone()) return TopoDS_Shape();
    const double dep = diag * 2 + (aC ? std::abs((C[0] - p0[0]) * n[0] + (C[1] - p0[1]) * n[1] + (C[2] - p0[2]) * n[2]) : 0);
    BRepPrimAPI_MakePrism pr(fm.Face(), gp_Vec(n[0] * dep, n[1] * dep, n[2] * dep), false, true);
    if (!pr.IsDone()) return TopoDS_Shape();
    BRepAlgoAPI_Cut cut(forme, pr.Shape());
    if (cut.IsDone()) return cut.Shape();
  } catch (const Standard_Failure&) {
  }
  return TopoDS_Shape();
}
// Coupe brisée (mepSecStepped)
struct Brisee {
  std::vector<V3> poly, planes;
  V3 vec{0, 0, 0};
  std::vector<std::pair<V3, V3>> steps;
};
bool coupeBrisee(const J& view, const J& sh, const std::vector<TopoDS_Shape>& tous, Brisee& st) {
  const J& s = sous(view, "section");
  const J& pts = sous(s, "pts");
  if (!pts.is_array() || pts.size() < 3) return false;
  std::string pid = chaine(s, "pid");
  if (pid.empty()) pid = chaine(view, "parent");
  const J* par = vueDe(sh, pid);
  if (!par) return false;
  const Base pb = baseDe(*par);
  const V3 n = norme(v3(sous(s, "n")));
  const auto W = [&](double x, double y) { return V3{pb.u[0] * x + pb.v[0] * y, pb.u[1] * x + pb.v[1] * y, pb.u[2] * x + pb.v[2] * y}; };
  double gx = dot(n, pb.u), gy = dot(n, pb.v);
  const double gl = std::hypot(gx, gy);
  if (gl < 1e-6) return false;
  gx /= gl, gy /= gl;
  std::vector<P2> P;
  for (const J& q : pts) P.push_back({nv(q[0]), nv(q[1])});
  double tx0 = P[1][0] - P[0][0], ty0 = P[1][1] - P[0][1];
  const double tl = std::hypot(tx0, ty0);
  if (tl < 1e-9) return false;
  tx0 /= tl, ty0 /= tl;
  double R = 0;
  {
    double diag = 0;
    V3 C{0, 0, 0};
    bool aC = false;
    const TopoDS_Shape t = compose(tous);
    if (!t.IsNull()) boite(t, diag, C, aC);
    R = diag + std::sqrt(dot(C, C));
    R = (R > 1 ? R : 400) + 20;
  }
  const size_t k = P.size() - 1;
  std::vector<P2> poly2{{P[0][0] - tx0 * R, P[0][1] - ty0 * R}};
  poly2.insert(poly2.end(), P.begin(), P.end());
  poly2.push_back({P[k][0] + tx0 * R, P[k][1] + ty0 * R});
  poly2.push_back({P[k][0] + tx0 * R + gx * R, P[k][1] + ty0 * R + gy * R});
  poly2.push_back({P[0][0] - tx0 * R + gx * R, P[0][1] - ty0 * R + gy * R});
  const V3 pd = norme(pb.dir);
  for (const P2& q : poly2) {
    const V3 w = W(q[0], q[1]);
    st.poly.push_back({w[0] - pd[0] * R, w[1] - pd[1] * R, w[2] - pd[2] * R});
  }
  st.vec = {pd[0] * 2 * R, pd[1] * 2 * R, pd[2] * 2 * R};
  for (size_t j = 0; j < k; j++) {
    if (j % 2 == 0) st.planes.push_back(W(P[j][0], P[j][1]));
    else st.steps.push_back({W(P[j][0], P[j][1]), pd});
  }
  return true;
}
TopoDS_Shape coupePrisme(const TopoDS_Shape& forme, const Brisee& st) {  // mepCutPrism
  try {
    BRepBuilderAPI_MakePolygon pg;
    for (const V3& q : st.poly) pg.Add(gp_Pnt(q[0], q[1], q[2]));
    pg.Close();
    if (!pg.IsDone()) return TopoDS_Shape();
    BRepBuilderAPI_MakeFace fm(pg.Wire(), true);
    if (!fm.IsDone()) return TopoDS_Shape();
    BRepPrimAPI_MakePrism pr(fm.Face(), gp_Vec(st.vec[0], st.vec[1], st.vec[2]), false, true);
    if (!pr.IsDone()) return TopoDS_Shape();
    BRepAlgoAPI_Cut cut(forme, pr.Shape());
    if (cut.IsDone()) return cut.Shape();
  } catch (const Standard_Failure&) {
  }
  return TopoDS_Shape();
}
void retirerMarches(std::vector<Ent>& els, const Base& b, const Brisee& st) {  // mepDropStepEdges
  if (st.steps.empty()) return;
  struct Ln { double px, py, nx, ny; };
  std::vector<Ln> ln;
  for (const auto& q : st.steps) {
    const double px = dot(q.first, b.u), py = dot(q.first, b.v);
    double dx = dot(q.second, b.u), dy = dot(q.second, b.v);
    const double L = std::hypot(dx, dy);
    if (L < 1e-6) continue;
    dx /= L, dy /= L;
    ln.push_back({px, py, -dy, dx});
  }
  std::vector<Ent> r;
  for (const Ent& e : els) {
    bool oui = false;
    if (e.t == 'L')
      for (const Ln& l : ln)
        if (std::abs((e.x1 - l.px) * l.nx + (e.y1 - l.py) * l.ny) < 0.01 && std::abs((e.x2 - l.px) * l.nx + (e.y2 - l.py) * l.ny) < 0.01) oui = true;
    if (!oui) r.push_back(e);
  }
  els.swap(r);
}
std::vector<Boucle> joindreBoucles(const std::vector<std::array<P2, 2>>& segs) {  // mepJoinLoops
  const auto q = [](const P2& p) { return std::to_string(rond(p[0] * 1000)) + "_" + std::to_string(rond(p[1] * 1000)); };
  struct Bout { int i, k; };
  std::unordered_map<std::string, std::vector<Bout>> at;
  for (int i = 0; i < static_cast<int>(segs.size()); i++)
    for (int k = 0; k < 2; k++) at[q(segs[i][k])].push_back({i, k});
  std::vector<char> used(segs.size(), 0);
  std::vector<Boucle> loops;
  for (int i0 = 0; i0 < static_cast<int>(segs.size()); i0++) {
    if (used[i0]) continue;
    Boucle loop{segs[i0][0]};
    P2 curPt = segs[i0][1];
    used[i0] = 1;
    int guard = 0;
    while (guard++ < 4000) {
      loop.push_back(curPt);
      const auto& cands = at[q(curPt)];
      const Bout* c = nullptr;
      for (const Bout& b : cands)
        if (!used[b.i]) {
          c = &b;
          break;
        }
      if (!c) break;
      used[c->i] = 1;
      curPt = segs[c->i][1 - c->k];
    }
    if (loop.size() > 3) loops.push_back(loop);
  }
  return loops;
}
std::vector<Boucle> bouclesHachures(const std::vector<TopoDS_Shape>& formes, const Base& b, const std::vector<V3>& P0s, const V3& nrm) {  // mepHatchLoops
  const V3 n = norme(nrm);
  std::vector<std::array<V3, 2>> segs;
  for (const TopoDS_Shape& sh : formes)
    for (TopExp_Explorer fx(sh, TopAbs_FACE); fx.More(); fx.Next()) {
      try {
        const TopoDS_Face f = TopoDS::Face(fx.Current());
        const BRepAdaptor_Surface ad(f, true);
        if (ad.GetType() != GeomAbs_Plane) continue;
        const gp_Ax1 ax = ad.Plane().Axis();
        const V3 dn{ax.Direction().X(), ax.Direction().Y(), ax.Direction().Z()}, lp{ax.Location().X(), ax.Location().Y(), ax.Location().Z()};
        if (std::abs(std::abs(dot(dn, n)) - 1) >= 1e-3) continue;
        bool sur = false;
        for (const V3& q : P0s)
          if (std::abs(dot(moins(lp, q), n)) < 0.05) sur = true;
        if (!sur) continue;
        for (TopExp_Explorer ee(f, TopAbs_EDGE); ee.More(); ee.Next()) {
          try {
            const BRepAdaptor_Curve ca(TopoDS::Edge(ee.Current()));
            const double u0 = ca.FirstParameter(), u1 = ca.LastParameter();
            if (!(u1 > u0)) continue;
            const int N = 8;
            std::vector<V3> pts;
            for (int i = 0; i <= N; i++) {
              const gp_Pnt q = ca.Value(u0 + (u1 - u0) * i / N);
              pts.push_back({q.X(), q.Y(), q.Z()});
            }
            for (int i = 0; i < N; i++) segs.push_back({pts[i], pts[i + 1]});
          } catch (const Standard_Failure&) {
          }
        }
      } catch (const Standard_Failure&) {
      }
    }
  if (segs.empty()) return {};
  std::vector<std::array<P2, 2>> ls;
  for (const auto& pr : segs) ls.push_back({P2{dot(pr[0], b.u), dot(pr[0], b.v)}, P2{dot(pr[1], b.u), dot(pr[1], b.v)}});
  return joindreBoucles(ls);
}
std::vector<Ent> rognerDetail(const std::vector<Ent>& els, double cx, double cy, double r) {  // mepClipDetail
  std::vector<Ent> out;
  const auto inC = [&](double x, double y) { return std::hypot(x - cx, y - cy) <= r - 0.01; };
  const auto clipSeg = [&](double x1, double y1, double x2, double y2) {
    std::vector<std::array<double, 4>> s;
    const double dx = x2 - x1, dy = y2 - y1, a = dx * dx + dy * dy;
    if (a < 1e-12) {
      if (inC(x1, y1)) s.push_back({x1, y1, x2, y2});
      return s;
    }
    const double bx = x1 - cx, by = y1 - cy;
    const double bq = 2 * (bx * dx + by * dy), cq = bx * bx + by * by - r * r;
    const double disc = bq * bq - 4 * a * cq;
    if (disc < 0) {
      if (inC(x1, y1)) s.push_back({x1, y1, x2, y2});
      return s;
    }
    const double sq = std::sqrt(disc);
    double t0 = (-bq - sq) / (2 * a), t1 = (-bq + sq) / (2 * a);
    if (t0 > t1) std::swap(t0, t1);
    const bool i0 = inC(x1, y1), i1 = inC(x2, y2);
    if (i0 && i1) s.push_back({x1, y1, x2, y2});
    else if (i0) s.push_back({x1, y1, x1 + dx * t1, y1 + dy * t1});
    else if (i1) s.push_back({x1 + dx * t0, y1 + dy * t0, x2, y2});
    else if (t0 > 0 && t1 < 1) s.push_back({x1 + dx * t0, y1 + dy * t0, x1 + dx * t1, y1 + dy * t1});
    return s;
  };
  const auto ligne = [](double a, double b, double c, double d, const std::string& k) {
    Ent e;
    e.t = 'L', e.x1 = a, e.y1 = b, e.x2 = c, e.y2 = d, e.k = k;
    return e;
  };
  const auto suite = [&](const std::vector<P2>& pts, const std::string& k) {
    std::vector<P2> run;
    const auto flush = [&] {
      for (size_t i = 0; i + 1 < run.size(); i++) out.push_back(ligne(run[i][0], run[i][1], run[i + 1][0], run[i + 1][1], k));
      run.clear();
    };
    for (const P2& p : pts) {
      if (inC(p[0], p[1])) run.push_back(p);
      else flush();
    }
    flush();
  };
  for (const Ent& e : els) {
    if (e.t == 'L') {
      for (const auto& s : clipSeg(e.x1, e.y1, e.x2, e.y2)) out.push_back(ligne(s[0], s[1], s[2], s[3], e.k));
    } else if (e.t == 'C') {
      if (inC(e.cx, e.cy) && e.r <= r - 0.01) out.push_back(e);
      else {
        const double d = std::hypot(e.cx - cx, e.cy - cy);
        if (d >= e.r + r || d <= std::abs(e.r - r)) continue;
        const double a0 = std::atan2(e.cy - cy, e.cx - cx);
        const double cosA = (d * d + e.r * e.r - r * r) / (2 * d * e.r);
        const double da = std::acos(std::max(-1.0, std::min(1.0, cosA)));
        const int N = 24;
        std::vector<P2> pts;
        for (int i = 0; i <= N; i++) {
          const double t = a0 - da + (2 * da) * i / N;
          pts.push_back({e.cx + e.r * std::cos(t), e.cy + e.r * std::sin(t)});
        }
        for (int i = 0; i < N; i++) out.push_back(ligne(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], e.k));
      }
    } else if (e.t == 'A') {
      const int N = std::max(8, std::min(48, static_cast<int>(rond(std::abs(e.a1 - e.a0) * e.r * 2)) + 4));
      std::vector<P2> pts;
      for (int i = 0; i <= N; i++) {
        const double t = e.a0 + (e.a1 - e.a0) * i / N;
        pts.push_back({e.cx + e.r * std::cos(t), e.cy + e.r * std::sin(t)});
      }
      suite(pts, e.k);
    } else if (e.t == 'P') {
      suite(e.pts, e.k);
    }
  }
  return out;
}
// Les filetages selon ISO 6410-1 (mepThreadEls)
void filetages(const J& view, const Base& b, const std::vector<V3>& planes, const V3* nS, const Piece& p, std::vector<Ent>& out) {
  if ((vrai(view, "obl") || vrai(view, "persp")) && chaine(view, "kind") == "base" && !vrai(view, "section") && !vrai(view, "detail")) return;
  const std::string bodyId = chaine(view, "bodyId");
  const auto ligne = [&](double a, double c, double d, double e, const std::string& k) {
    Ent x;
    x.t = 'L', x.x1 = a, x.y1 = c, x.x2 = d, x.y2 = e, x.k = k;
    out.push_back(x);
  };
  const bool coupe = nS != nullptr;
  for (const Filet& f : p.filets) {
    if (!bodyId.empty() && !f.corps.empty() && f.corps != bodyId) continue;
    const V3 D = norme(f.dir);
    const double R = f.D / 2, off = f.entree;
    const bool thru = (f.lenMode.empty() ? "len" : f.lenMode) == std::string("through");
    const double L = std::max(0.0, f.len != 0 ? f.len : f.depth);
    if (!(L > 0)) continue;
    const double facing = dot(D, b.dir);
    for (const V3& w : f.centres) {
      const auto at = [&](double t) {
        const V3 q{w[0] + D[0] * t, w[1] + D[1] * t, w[2] + D[2] * t};
        return P2{dot(q, b.u), dot(q, b.v)};
      };
      if (std::abs(facing) > 0.999) {
        if (coupe) {
          const auto s = [&](const V3& p0, double t) { return dot(*nS, V3{w[0] + D[0] * t - p0[0], w[1] + D[1] * t - p0[1], w[2] + D[2] * t - p0[2]}); };
          bool oui = false;
          for (const V3& p0 : planes)
            if (s(p0, off) * s(p0, off + L) <= 0) oui = true;
          if (!oui) continue;
        } else if (!(facing < 0 || thru)) {
          continue;
        }
        const P2 c = at(0);
        Ent e;
        e.t = 'A', e.cx = c[0], e.cy = c[1], e.r = R, e.a0 = 0, e.a1 = 1.5 * PI, e.k = "thread";
        out.push_back(e);
        continue;
      }
      if (std::abs(facing) > 0.02) continue;
      const double d0 = dot(D, b.u), d1 = dot(D, b.v);
      double l2 = std::hypot(d0, d1);
      if (l2 == 0) l2 = 1;
      const double nx = -d1 / l2, ny = d0 / l2;
      const double rCut = std::min(R, f.d > 0 ? f.d / 2 : R);
      bool inCut = false;
      if (coupe && std::abs(dot(*nS, D)) < 0.02)
        for (const V3& p0 : planes)
          if (std::abs(dot(*nS, moins(w, p0))) < rCut) inCut = true;
      if (!inCut && chaine(view, "mode") != "dash") continue;
      const std::string k = inCut ? "thread" : "threadH";
      const P2 a = at(off), e = at(off + L);
      for (int sg : {-1, 1}) ligne(a[0] + nx * R * sg, a[1] + ny * R * sg, e[0] + nx * R * sg, e[1] + ny * R * sg, k);
      if (!thru) ligne(e[0] - nx * R, e[1] - ny * R, e[0] + nx * R, e[1] + ny * R, inCut ? "sharp" : "threadH");
    }
  }
}
TopoDS_Shape cisaillement(const TopoDS_Shape& sh, const J& view, const Base& b) {  // mepOblShear
  const J& o = sous(view, "obl");
  const double a0 = num(o, "a", 45);
  const double a = std::max(-180.0, std::min(180.0, a0));
  const double k = num(o, "k") > 0 ? std::min(2.0, num(o, "k")) : 0.5;
  const double ca = std::cos(a * PI / 180), sa = std::sin(a * PI / 180);
  const V3 sv{k * (ca * b.u[0] - sa * b.v[0]), k * (ca * b.u[1] - sa * b.v[1]), k * (ca * b.u[2] - sa * b.v[2])};
  gp_GTrsf g;
  for (int i = 0; i < 3; i++)
    for (int j = 0; j < 3; j++) g.SetValue(i + 1, j + 1, (i == j ? 1 : 0) - sv[i] * b.dir[j]);
  try {
    BRepBuilderAPI_GTransform t(sh, g, true);
    return t.IsDone() ? t.Shape() : sh;
  } catch (const Standard_Failure&) {
    return sh;
  }
}
bool obliqueDe(const J& v) { return chaine(v, "kind") == "base" && !vrai(v, "section") && !vrai(v, "detail") && vrai(v, "obl"); }
bool perspDe(const J& v) { return chaine(v, "kind") == "base" && !vrai(v, "section") && !vrai(v, "detail") && vrai(v, "persp"); }

// Les triangles d'un solide, sens de la face respecté
struct Tri {
  V3 a, b, c;
};
std::vector<Tri> trianglesDe(const TopoDS_Shape& s) {
  std::vector<Tri> out;
  for (int essai = 0; essai < 2; essai++) {
    bool manque = false;
    out.clear();
    for (TopExp_Explorer fx(s, TopAbs_FACE); fx.More(); fx.Next()) {
      const TopoDS_Face f = TopoDS::Face(fx.Current());
      TopLoc_Location L;
      const occ::handle<Poly_Triangulation> T = BRep_Tool::Triangulation(f, L);
      if (T.IsNull()) {
        manque = true;
        break;
      }
      const gp_Trsf tr = L.Transformation();
      const bool inverse = f.Orientation() == TopAbs_REVERSED;
      const auto P = [&](int i) {
        const gp_Pnt q = T->Node(i).Transformed(tr);
        return V3{q.X(), q.Y(), q.Z()};
      };
      for (int i = 1; i <= T->NbTriangles(); i++) {
        int a, b, c;
        T->Triangle(i).Get(a, b, c);
        if (inverse) std::swap(b, c);
        out.push_back({P(a), P(b), P(c)});
      }
    }
    if (!manque) break;
    mailler(s, false);
  }
  return out;
}
// Le réglage de la perspective : le plan qui passe par le centre de la pièce reste en vraie grandeur (mepPerspCam)
struct CamPersp {
  double fov = 35, S = 1, dist = 1, cu = 0, cv = 0;
  V3 E{0, 0, 0}, C{0, 0, 0};
  Base b;
  std::array<double, 3> proj(const V3& p) const {
    const V3 q = moins(p, E);
    const double dep = std::max(1e-6, -dot(q, b.dir)), f = dist / dep;
    return {cu + dot(q, b.u) * f, cv + dot(q, b.v) * f, dep};
  }
};
bool camPersp(const J& view, const std::vector<std::vector<Tri>>& maillages, CamPersp& K) {
  const J& o = sous(view, "persp");
  K.fov = o.is_object() && o.contains("fov") && o["fov"].is_number() ? std::max(5.0, std::min(120.0, num(o, "fov"))) : 35;
  K.b = baseDe(view);
  V3 lo{1e9, 1e9, 1e9}, hi{-1e9, -1e9, -1e9};
  bool un = false;
  for (const auto& m : maillages)
    for (const Tri& t : m)
      for (const V3* q : {&t.a, &t.b, &t.c})
        for (int j = 0; j < 3; j++) {
          lo[j] = std::min(lo[j], (*q)[j]);
          hi[j] = std::max(hi[j], (*q)[j]);
          un = true;
        }
  if (!un) return false;
  K.C = {(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2};
  K.S = std::max(1.0, std::hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]));
  K.dist = (K.S / 2) / std::tan(K.fov * PI / 360) + K.S / 2;  // l'œil reste hors de la pièce
  K.E = {K.C[0] + K.b.dir[0] * K.dist, K.C[1] + K.b.dir[1] * K.dist, K.C[2] + K.b.dir[2] * K.dist};
  K.cu = dot(K.C, K.b.u);
  K.cv = dot(K.C, K.b.v);
  return true;
}
// Le rayon de l'œil vers un point : les triangles sont rangés par case de leur image sur le papier
class Occulteur {
 public:
  Occulteur(const CamPersp& K, const std::vector<std::vector<Tri>>& maillages) : K_(K) {
    for (const auto& m : maillages)
      for (const Tri& t : m) tris_.push_back(&t);
    x0_ = y0_ = 1e18;
    double x1 = -1e18, y1 = -1e18;
    std::vector<std::array<double, 4>> boites;
    boites.reserve(tris_.size());
    for (const Tri* t : tris_) {
      std::array<double, 4> bo{1e18, 1e18, -1e18, -1e18};
      for (const V3* q : {&t->a, &t->b, &t->c}) {
        const auto r = K_.proj(*q);
        bo[0] = std::min(bo[0], r[0]), bo[1] = std::min(bo[1], r[1]), bo[2] = std::max(bo[2], r[0]), bo[3] = std::max(bo[3], r[1]);
      }
      x0_ = std::min(x0_, bo[0]), y0_ = std::min(y0_, bo[1]), x1 = std::max(x1, bo[2]), y1 = std::max(y1, bo[3]);
      boites.push_back(bo);
    }
    dx_ = std::max(1e-9, (x1 - x0_) / N), dy_ = std::max(1e-9, (y1 - y0_) / N);
    cases_.resize(N * N);
    for (size_t i = 0; i < tris_.size(); i++) {
      const auto& bo = boites[i];
      for (int y = caseDe(bo[1], y0_, dy_); y <= caseDe(bo[3], y0_, dy_); y++)
        for (int x = caseDe(bo[0], x0_, dx_); x <= caseDe(bo[2], x0_, dx_); x++) cases_[y * N + x].push_back(static_cast<int>(i));
    }
  }
  // true si rien n'est touché avant le point, à la tolérance près
  bool voit(const V3& p, double tol) const {
    const V3 d0 = moins(p, K_.E);
    const double L = std::hypot(d0[0], d0[1], d0[2]);
    if (!(L > 1e-9)) return true;
    const V3 D{d0[0] / L, d0[1] / L, d0[2] / L};
    const auto r = K_.proj(p);
    const double loin = L - tol;
    for (int i : cases_[caseDe(r[1], y0_, dy_) * N + caseDe(r[0], x0_, dx_)]) {
      const Tri& t = *tris_[i];
      const V3 e1 = moins(t.b, t.a), e2 = moins(t.c, t.a);
      const V3 q{D[1] * e2[2] - D[2] * e2[1], D[2] * e2[0] - D[0] * e2[2], D[0] * e2[1] - D[1] * e2[0]};
      const double det = dot(e1, q);
      if (std::abs(det) < 1e-14) continue;
      const double inv = 1 / det;
      const V3 s = moins(K_.E, t.a);
      const double uu = dot(s, q) * inv;
      if (uu < 0 || uu > 1) continue;
      const V3 w{s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]};
      const double vv = dot(D, w) * inv;
      if (vv < 0 || uu + vv > 1) continue;
      const double tt = dot(e2, w) * inv;
      if (tt > 0 && tt < loin) return false;
    }
    return true;
  }

 private:
  static const int N = 256;
  static int caseDe(double x, double x0, double dx) { return std::max(0, std::min(N - 1, static_cast<int>((x - x0) / dx))); }
  const CamPersp& K_;
  std::vector<const Tri*> tris_;
  std::vector<std::vector<int>> cases_;
  double x0_, y0_, dx_ = 1, dy_ = 1;
};
// mepPerspBuild : les arêtes exactes et les contours apparents du maillage vus de l'œil, la visibilité par rayon
void perspective(Geo& geo, const J& view, const std::vector<TopoDS_Shape>& shapes) {
  std::vector<std::vector<Tri>> maillages;
  for (const TopoDS_Shape& s : shapes) maillages.push_back(trianglesDe(s));
  CamPersp K;
  if (!camPersp(view, maillages, K)) {
    geo.src = "aucun corps";
    return;
  }
  const std::string mode = chaine(view, "mode").empty() ? "hide" : chaine(view, "mode");
  const Occulteur occ1(K, maillages);
  const double tol = std::max(0.05, K.S * 0.004), step = std::max(0.3, K.S / 120);
  const auto emit = [&](const std::vector<V3>& pts, const char* kind) {
    std::vector<V3> P;
    for (size_t i = 0; i + 1 < pts.size(); i++) {
      const V3& a = pts[i];
      const V3& c = pts[i + 1];
      const double L = std::hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      const int n = std::min(200, std::max(1, static_cast<int>(std::ceil(L / step))));
      for (int k = i ? 1 : 0; k <= n; k++) {
        const double t = static_cast<double>(k) / n;
        P.push_back({a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t});
      }
    }
    if (P.size() < 2) return;
    std::vector<char> V(P.size());
    for (size_t i = 0; i < P.size(); i++) V[i] = mode == "wire" || occ1.voit(P[i], tol);
    for (size_t i = 0; i + 1 < P.size(); i++) {
      const bool vis = V[i] && V[i + 1];
      if (!vis && mode != "dash") continue;
      const auto a = K.proj(P[i]), c = K.proj(P[i + 1]);
      if (std::hypot(c[0] - a[0], c[1] - a[1]) < 1e-6) continue;
      Ent e;
      e.t = 'L', e.x1 = a[0], e.y1 = a[1], e.x2 = c[0], e.y2 = c[1], e.k = vis ? kind : "hidden";
      geo.els.push_back(std::move(e));
    }
  };
  for (const TopoDS_Shape& s : shapes)
    for (const AreteVue& a : aretesVisibles(s)) {
      if (!a.vive && !vrai(view, "tangent")) continue;
      const BRepAdaptor_Curve ad(a.arete);
      emit(pointsCourbe(ad, ad.FirstParameter(), ad.LastParameter(), 0.02, 600), a.vive ? "sharp" : "tangent");
    }
  // Les contours apparents
  for (const auto& m : maillages) {
    struct Cote {
      V3 a, c;
      int n = 0;
      bool front[2] = {false, false};
      V3 N[2];
    };
    using Cle = std::array<long long, 6>;
    std::map<Cle, int> table;
    std::vector<Cote> cotes;
    const auto cle = [](const V3& p, const V3& q) {
      const auto r = [](double x) { return static_cast<long long>(std::floor(x * 1e3 + 0.5)); };
      const std::array<long long, 3> A{r(p[0]), r(p[1]), r(p[2])}, B{r(q[0]), r(q[1]), r(q[2])};
      return A < B ? Cle{A[0], A[1], A[2], B[0], B[1], B[2]} : Cle{B[0], B[1], B[2], A[0], A[1], A[2]};
    };
    const size_t nT = std::min<size_t>(120000, m.size());
    for (size_t t = 0; t < nT; t++) {
      const Tri& T = m[t];
      const V3 e1 = moins(T.b, T.a), e2 = moins(T.c, T.a);
      const V3 nn{e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]};
      const double nl = std::hypot(nn[0], nn[1], nn[2]);
      if (!(nl > 1e-12)) continue;
      const V3 N{nn[0] / nl, nn[1] / nl, nn[2] / nl};
      const V3 mil{(T.a[0] + T.b[0] + T.c[0]) / 3, (T.a[1] + T.b[1] + T.c[1]) / 3, (T.a[2] + T.b[2] + T.c[2]) / 3};
      const bool front = dot(N, moins(K.E, mil)) > 0;
      const V3* S[3] = {&T.a, &T.b, &T.c};
      for (int k = 0; k < 3; k++) {
        const V3& a = *S[k];
        const V3& c = *S[(k + 1) % 3];
        const auto ins = table.emplace(cle(a, c), static_cast<int>(cotes.size()));
        if (ins.second) {
          Cote q;
          q.a = a, q.c = c;
          cotes.push_back(q);
        }
        Cote& r = cotes[ins.first->second];
        if (r.n < 2) r.front[r.n] = front, r.N[r.n] = N;
        r.n++;
      }
    }
    for (const Cote& r : cotes)
      if (r.n == 2 && r.front[0] != r.front[1] && dot(r.N[0], r.N[1]) > 0.85) emit({r.a, r.c}, "sharp");
  }
  geo.src = "OCCT (perspective)";
}

Geo construire(const J& view, const J& sh, const Piece& piece) {  // mepBuildGeo
  Geo geo;
  const Base b = baseDe(view);
  const std::string bodyId = chaine(view, "bodyId");
  std::vector<TopoDS_Shape> shapes;
  std::vector<std::string> cles;
  const bool vueAsm = vrai(view, "asm") && piece.assemblage;  // mepMeshesOf : le composant et tout ce qu'il contient
  for (const Corps& c : piece.corps) {
    if (!vueAsm && !bodyId.empty() && c.id != bodyId) continue;
    shapes.push_back(c.forme);
    cles.push_back("b:" + c.id);
  }
  if (vueAsm)
    for (const CorpsInstance& c : piece.instances) {
      shapes.push_back(c.forme);
      cles.push_back("c:" + c.comp);
    }
  if (shapes.empty()) {
    geo.src = "aucun corps";
    return geo;
  }
  std::vector<TopoDS_Shape> tous;
  for (const Corps& c : piece.corps) tous.push_back(c.forme);
  if (vueAsm)
    for (const CorpsInstance& c : piece.instances) tous.push_back(c.forme);
  const bool section = vrai(view, "section");
  std::vector<TopoDS_Shape> cutShapes = shapes;
  Brisee st;
  bool brisee = false;
  if (section) {
    const J& s = view["section"];
    brisee = coupeBrisee(view, sh, tous, st);
    cutShapes.clear();
    for (const TopoDS_Shape& f : shapes) {
      TopoDS_Shape cs = brisee ? coupePrisme(f, st) : coupeDemiEspace(f, tous, v3(sous(s, "p")), v3(sous(s, "n")));
      cutShapes.push_back(cs.IsNull() ? f : cs);
    }
  }
  if (perspDe(view)) {
    perspective(geo, view, cutShapes);
    souder(geo.els);
    return geo;
  }
  if (obliqueDe(view))
    for (TopoDS_Shape& f : cutShapes) f = cisaillement(f, view, b);
  std::set<std::string> added;
  if (hlrExact(geo, view, b, cutShapes, added)) geo.src = "OCCT HLR";
  else geo.src = "OCCT";
  // mepFinishGeo
  souder(geo.els);
  {
    std::vector<V3> planes;
    V3 nS{0, 0, 0};
    if (section) {
      nS = norme(v3(sous(view["section"], "n")));
      planes = brisee ? st.planes : std::vector<V3>{v3(sous(view["section"], "p"))};
    }
    filetages(view, b, planes, section ? &nS : nullptr, piece, geo.els);
    if (section) {
      const V3 n = v3(sous(view["section"], "n"));
      std::vector<std::string> U;
      for (const std::string& k : cles)
        if (std::find(U.begin(), U.end(), k) == U.end()) U.push_back(k);
      if (U.size() > 1) {
        for (size_t i = 0; i < U.size(); i++) {
          std::vector<TopoDS_Shape> L;
          for (size_t j = 0; j < cles.size(); j++)
            if (cles[j] == U[i]) L.push_back(cutShapes[j]);
          std::vector<Boucle> B = bouclesHachures(L, b, planes, n);
          if (!B.empty()) {
            geo.hatch.insert(geo.hatch.end(), B.begin(), B.end());
          }
          geo.hatchG.push_back(std::move(B));
        }
        geo.hatchG.erase(std::remove_if(geo.hatchG.begin(), geo.hatchG.end(), [](const std::vector<Boucle>& x) { return x.empty(); }), geo.hatchG.end());
      } else {
        geo.hatch = bouclesHachures(cutShapes, b, planes, n);
      }
      if (brisee) retirerMarches(geo.els, b, st);
    }
  }
  if (vrai(view, "detail") && vrai(view, "parent")) {
    if (vueDe(sh, chaine(view, "parent"))) {
      const J& d = view["detail"];
      geo.els = rognerDetail(geo.els, num(d, "cx"), num(d, "cy"), num(d, "r"));
    }
  }
  return geo;
}

// ── encombrement (mepElAABB, mepAABBOf) ──
bool boiteVue(const J& v, const Geo& g, Boite& bb) {  // mepViewSheetBBox
  double minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  bool any = false;
  for (const Ent& e : g.els) {
    double a, c, d, f;
    if (!boiteEnt(e, a, c, d, f)) continue;
    minx = std::min(minx, a), maxx = std::max(maxx, d), miny = std::min(miny, c), maxy = std::max(maxy, f);
    any = true;
  }
  if (vrai(v, "detail")) {
    const J& t = v["detail"];
    const double cx = num(t, "cx"), cy = num(t, "cy"), r = num(t, "r");
    minx = std::min(minx, cx - r), maxx = std::max(maxx, cx + r), miny = std::min(miny, cy - r), maxy = std::max(maxy, cy + r);
    any = true;
  }
  if (!any) return false;
  const double x0 = num(v, "x"), y0 = num(v, "y"), s = num(v, "scale");
  bb.x = x0 + minx * s, bb.y = y0 + miny * s, bb.w = (maxx - minx) * s, bb.h = (maxy - miny) * s;
  return true;
}

// ── le dessin ──
double corpsPolice(double h) { return js::arrondi((h != 0 ? h : 3.5) / CAP_RATIO, 3); }  // mepFs

void dessinerCadre(Ctx& c, const Page& pd) {  // mepDrawFrame
  const Cadre& fr = pd.fr;
  const std::string fc = fr.col.empty() ? "" : ";stroke:" + fr.col, mc = fr.mcol.empty() ? "" : ";stroke:" + fr.mcol;
  const auto uc = [](const std::string& x) { return x.empty() ? std::string() : std::string(" mepUc"); };
  const double x0 = pd.ix, y0 = pd.iy, x1 = pd.ix + pd.iw, y1 = pd.iy + pd.ih + pd.th, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, mw = 0.2;
  c.mk("rect").n("x", x0).n("y", y0).n("width", x1 - x0).n("height", y1 - y0).s("class", "mepFrame" + uc(fc)).s("style", "stroke-width:" + tx(fr.lw) + fc);
  if (fr.inner) c.mk("rect").n("x", x0 + 3).n("y", y0 + 3).n("width", x1 - x0 - 6).n("height", y1 - y0 - 6).s("class", "mepFrame2");
  const auto L = [&](double a, double b, double d, double e, double w) { c.mk("line").n("x1", a).n("y1", b).n("x2", d).n("y2", e).s("class", "mepFrame" + uc(mc)).s("style", "stroke-width:" + tx(w) + mc); };
  if (fr.trim) {
    const double k = 15, W = pd.W, H = pd.H;
    const double T[4][4] = {{0, 0, 1, 1}, {W, 0, -1, 1}, {0, H, 1, -1}, {W, H, -1, -1}};
    for (const auto& q : T) {
      L(q[0], q[1], q[0] + q[2] * k, q[1], mw * 2);
      L(q[0], q[1], q[0], q[1] + q[3] * k, mw * 2);
    }
  }
  if (fr.zones) {
    const auto cuts = [](double a, double b, double m, double p) {
      std::vector<double> o;
      for (int i = -40; i <= 40; i++) {
        const double v = m + i * p;
        if (v > a + 1 && v < b - 1) o.push_back(v);
      }
      return o;
    };
    const double zw = fr.zw > 0 ? fr.zw : 50, zh = fr.zh > 0 ? fr.zh : 50;
    const std::vector<double> xs = cuts(x0, x1, fr.aZx0 ? x0 + fr.zx0 : cx, zw), ys = cuts(y0, y1, fr.aZy0 ? y1 - fr.zy0 : cy, zh);
    for (double x : xs) {
      if (fr.centre && std::abs(x - cx) < 1e-6) continue;
      L(x, y0 - 5, x, y0, mw);
      L(x, y1, x, y1 + 5, mw);
    }
    for (double y : ys) {
      if (fr.centre && std::abs(y - cy) < 1e-6) continue;
      L(x0 - 5, y, x0, y, mw);
      L(x1, y, x1 + 5, y, mw);
    }
    const double h = 3, fs = corpsPolice(h);
    const std::string tf = fr.mcol.empty() ? "" : ";fill:" + fr.mcol;
    const auto T = [&](double x, double y, const std::string& t) { c.mk("text").n("x", x).n("y", y + h / 2).s("class", "mepFrameTxt" + uc(tf)).s("text-anchor", "middle").s("style", "font-size:" + tx(fs) + "px" + tf).t(t); };
    std::vector<double> bx{x0}, by{y0};
    bx.insert(bx.end(), xs.begin(), xs.end());
    bx.push_back(x1);
    by.insert(by.end(), ys.begin(), ys.end());
    by.push_back(y1);
    for (size_t i = 0; i + 1 < bx.size(); i++) {
      const double m = (bx[i] + bx[i + 1]) / 2;
      T(m, y0 - 2.5, std::to_string(i + 1));
      T(m, y1 + 2.5, std::to_string(i + 1));
    }
    for (size_t j = 0; j + 1 < by.size(); j++) {
      const double m = (by[j] + by[j + 1]) / 2;
      const std::string l(1, static_cast<char>(65 + j));
      T(x0 - 2.5, m, l);
      T(x1 + 2.5, m, l);
    }
  }
  if (fr.centre) {
    const double w = fr.zones ? mw : fr.lw;
    const std::string& q = fr.zones ? mc : fc;
    const auto M = [&](double a, double b, double d, double e) { c.mk("line").n("x1", a).n("y1", b).n("x2", d).n("y2", e).s("class", "mepFrame" + uc(q)).s("style", "stroke-width:" + tx(w) + q); };
    M(cx, y0 - 5, cx, y0 + 5);
    M(cx, y1 - 5, cx, y1 + 5);
    M(x0 - 5, cy, x0 + 5, cy);
    M(x1 - 5, cy, x1 + 5, cy);
  }
}
std::string etiquetteEchelle(const J& sh) {  // mepSheetScaleLabel
  const J& L = sous(sh, "views");
  if (L.is_array())
    for (const J& v : L) {
      const double s = num(v, "scale", 1);
      if (s != 1 && chaine(v, "kind") != "detail") {
        if (s >= 1) {
          std::string t = fmtNum(s, 2);
          const size_t p = t.find(",0");
          if (p != std::string::npos) t.erase(p, 2);
          return t + ":1";
        }
        return "1:" + fmtNum(1 / s, 2);
      }
    }
  return "1:1";
}
void dessinerTitre(Ctx& c, const Page& pd, double ty) {  // mepDrawTitle
  const J& tt = sous(c.sh, "title");
  const double H2 = TITLE_H / 2;
  const std::string logo = chaine(tt, "logo");
  const double LW = logo.empty() ? 0 : 32, x0 = pd.ix + LW, iw = pd.iw - LW;
  if (LW != 0) {
    c.mk("line").n("x1", x0).n("y1", ty).n("x2", x0).n("y2", ty + TITLE_H).s("class", "mepTitleBlock");
    c.mk("image").s("href", logo).n("x", pd.ix + 2).n("y", ty + 2).n("width", LW - 4).n("height", TITLE_H - 4).s("preserveAspectRatio", "xMidYMid meet");
  }
  c.mk("line").n("x1", x0).n("y1", ty + H2).n("x2", pd.ix + pd.iw).n("y2", ty + H2).s("class", "mepTitleBlock");
  const double pw = std::min(130.0, iw * 0.4);
  const J& revs = sous(tt, "revs");
  std::string ind = chaine(tt, "indice");
  if (revs.is_array() && !revs.empty()) ind = chaine(revs.back(), "i");
  else if (ind.empty()) ind = "—";
  struct Champ { const char* lab; double x, w; std::string val; };
  const auto row = [&](double y, const std::vector<Champ>& F) {
    for (size_t i = 0; i < F.size(); i++) {
      const Champ& f = F[i];
      if (i > 0) c.mk("line").n("x1", f.x - 2).n("y1", y).n("x2", f.x - 2).n("y2", y + H2).s("class", "mepTitleBlock");
      c.mk("text").n("x", f.x).n("y", y + 4.4).s("class", "mepTitleText").t(f.lab);
      c.mk("text").n("x", f.x).n("y", y + 11).s("class", "mepTitleVal").t(debutCar(f.val, static_cast<size_t>(std::max(3.0, std::floor(f.w / 2.1)))));
    }
  };
  const double wLast = iw - pw - 164;
  const auto ou = [&](const char* k) {
    const std::string v = chaine(tt, k);
    return v.empty() ? std::string("—") : v;
  };
  const int nb = static_cast<int>(sous(c.mep, "sheets").size());
  row(ty, {{"PROJET", x0 + 4, pw, chaine(tt, "projet")}, {"PLANCHE", x0 + pw + 6, 44, std::to_string(c.cur + 1) + " / " + std::to_string(nb)}, {"ÉCHELLE", x0 + pw + 54, 40, etiquetteEchelle(c.sh)}, {"DATE", x0 + pw + 98, 56, chaine(tt, "date")}, {"DESSINÉ PAR", x0 + pw + 158, wLast, chaine(tt, "auteur")}});
  row(ty + H2, {{"MATIÈRE", x0 + 4, pw, ou("matiere")}, {"TTS", x0 + pw + 6, 44, ou("traitement")}, {"TTH", x0 + pw + 54, 40, ou("tth")}, {"TOL. GÉNÉRALES", x0 + pw + 98, 56, ou("tolgen")}, {"INDICE", x0 + pw + 158, wLast, ind}});
}
int rangsRevisions(const J& sh) {  // mepTbRevRows
  if (!cartoucheEsquisse(sh)) return 0;
  int n = 0;
  for (const J& e : sh["title"]["tb"]["sk"]["ents"])
    if (chaine(e, "t") == "text" && chaine(e, "f") == "rev") n = std::max(n, static_cast<int>(num(e, "r")) + 1);
  return n;
}
std::string valeurCartouche(Ctx& c, const J& e) {  // mepTbValue, mepSkTextValue
  const std::string f = chaine(e, "f");
  if (f == "txt") return chaine(e, "s");
  const J& tt = sous(c.sh, "title");
  const J& revs = sous(tt, "revs");
  std::string v;
  if (f == "planche") v = std::to_string(c.cur + 1) + " / " + std::to_string(sous(c.mep, "sheets").size());
  else if (f == "echelle") v = etiquetteEchelle(c.sh);
  else if (f == "format") {
    if (chaine(c.sh, "format") == "Manuel") v = fmtNum(num(c.sh, "fw"), 1) + " × " + fmtNum(num(c.sh, "fh"), 1) + " mm";
    else v = chaine(c.sh, "format") + (chaine(c.sh, "orient") == "landscape" ? "-H" : "-V");
  } else if (f == "indice") {
    if (revs.is_array() && !revs.empty()) v = chaine(revs.back(), "i");
    else {
      v = chaine(tt, "indice");
      if (v.empty()) v = "—";
    }
  } else if (f == "perso") {
    v = chaine(sous(tt, "cust"), chaine(e, "k").c_str());
  } else if (f == "rev") {
    if (revs.is_array()) {
      const int nr = rangsRevisions(c.sh);
      const int i = std::max(0, static_cast<int>(revs.size()) - nr) + static_cast<int>(num(e, "r"));
      if (i < static_cast<int>(revs.size())) v = chaine(revs[i], chaine(e, "k").c_str());
    }
  } else {
    v = chaine(tt, f.c_str());
    if (v.empty()) v = f == "projet" || f == "date" || f == "auteur" ? "" : "—";
  }
  return vrai(e, "nd") && v == "—" ? "" : v;
}
void dessinerEsquisse(Ctx& c, const J& sk, double ox, double oy, bool planche) {  // mepDrawSkCtx, hors édition
  const std::string wDef = planche ? "thick" : "thin";
  const J& pts = sous(sk, "pts");
  const auto pt = [&](const std::string& id) -> const J* { return pts.is_object() && pts.contains(id) ? &pts[id] : nullptr; };
  const auto classeTrait = [&](const J& e) {
    const std::string w = chaine(e, "w").empty() ? wDef : chaine(e, "w");
    std::string s = planche ? "mepEnt mepSkFull" + std::string(w == "thick" ? " mepSkThick" : " mepSkThin") : "mepTbLine" + std::string(w == "thick" ? " mepTbThick" : "");
    const std::string lt = chaine(e, "lt");
    if (lt == "hid") s += " mepLtHid";
    else if (lt == "axis") s += " mepLtAxis";
    if (!chaine(e, "col").empty()) s += " mepUc";
    return s;
  };
  const auto styleTrait = [&](At a, const J& e) {
    a.s("class", classeTrait(e));
    std::string st;
    if (num(e, "lw") > 0) st += "stroke-width:" + tx(num(e, "lw"));
    if (!chaine(e, "col").empty()) st += (st.empty() ? "" : ";") + std::string("stroke:") + chaine(e, "col");
    if (!st.empty()) a.s("style", st);
  };
  const J& ents = sous(sk, "ents");
  if (!ents.is_array()) return;
  for (const J& e : ents) {
    const std::string t = chaine(e, "t");
    if (vrai(e, "cst") && (t == "line" || t == "circle" || t == "arc")) continue;
    if (t == "line") {
      const J* A = pt(chaine(e, "p1"));
      const J* B = pt(chaine(e, "p2"));
      if (!A || !B) continue;
      styleTrait(c.mk("line").n("x1", pointX(*A) + ox).n("y1", pointY(*A) + oy).n("x2", pointX(*B) + ox).n("y2", pointY(*B) + oy), e);
    } else if (t == "circle") {
      const J* C = pt(chaine(e, "pc"));
      if (!C) continue;
      styleTrait(c.mk("circle").n("cx", pointX(*C) + ox).n("cy", pointY(*C) + oy).n("r", num(e, "r")).s("fill", "none"), e);
    } else if (t == "arc") {
      const J* C = pt(chaine(e, "pc"));
      const J* P1 = pt(chaine(e, "p1"));
      const J* P2 = pt(chaine(e, "p2"));
      if (!C || !P1 || !P2) continue;
      const double cx = pointX(*C) + ox, cy = pointY(*C) + oy, r = num(e, "r");
      const double a0 = std::atan2(pointY(*P1) - pointY(*C), pointX(*P1) - pointX(*C)), a1 = std::atan2(pointY(*P2) - pointY(*C), pointX(*P2) - pointX(*C));
      double da = a1 - a0;
      while (da <= 0) da += 2 * PI;
      const std::string d = "M" + tx(cx + r * std::cos(a0)) + "," + tx(cy + r * std::sin(a0)) + " A" + tx(r) + "," + tx(r) + " 0 " + (da > PI ? "1" : "0") + " 1 " + tx(cx + r * std::cos(a1)) + "," + tx(cy + r * std::sin(a1));
      styleTrait(c.mk("path").s("d", d).s("fill", "none"), e);
    } else if (t == "text") {
      const J* P0 = pt(chaine(e, "p"));
      if (!P0) continue;
      const double px = pointX(*P0) + ox, py = pointY(*P0) + oy;
      std::string val = valeurCartouche(c, e);
      if (val.empty()) continue;
      const double h = num(e, "h") != 0 ? num(e, "h") : 3.5;
      if (num(e, "mw") > 0) {
        const size_t nmax = static_cast<size_t>(std::max(2.0, std::floor(num(e, "mw") / (h * 0.56))));
        if (longueurCar(val) > nmax) val = debutCar(val, nmax - 1) + "…";
      }
      const std::string al = chaine(e, "al"), col = chaine(e, "col");
      std::string st = "font-size:" + tx(h) + "px";
      if (vrai(e, "b")) st += ";font-weight:700";
      if (!al.empty() && al != "start") st += ";text-anchor:" + al;
      if (!col.empty()) st += ";fill:" + col;
      At a = c.mk("text").n("x", px).n("y", py).s("class", (chaine(e, "st") == "val" ? std::string("mepTitleVal") : std::string("mepTitleText")) + (col.empty() ? "" : " mepUc")).s("style", st);
      if (num(e, "rot") != 0) a.s("transform", "rotate(" + tx(-num(e, "rot")) + " " + tx(px) + " " + tx(py) + ")");
      a.t(val);
      // fit : la largeur disponible, retenue pour l'affichage (le navigateur la mesure)
      if (num(e, "fit") > 0) a.s("data-fit", js::fixe(num(e, "fit"), 2));
    } else if (t == "logo") {
      const J* A = pt(chaine(e, "p1"));
      const J* B = pt(chaine(e, "p2"));
      if (!A || !B) continue;
      const std::string logo = chaine(sous(c.sh, "title"), "logo");
      const double ax = pointX(*A) + ox, ay = pointY(*A) + oy, bx = pointX(*B) + ox, by = pointY(*B) + oy;
      if (!logo.empty()) c.mk("image").s("href", logo).n("x", std::min(ax, bx)).n("y", std::min(ay, by)).n("width", std::abs(bx - ax)).n("height", std::abs(by - ay)).s("preserveAspectRatio", "xMidYMid meet");
    }
  }
}
void dessinerRevisions(Ctx& c, const Page& pd, double ty) {  // mepDrawRevs
  const J& tt = sous(c.sh, "title");
  const J& revs = sous(tt, "revs");
  if (!revs.is_array() || revs.empty() || rangsRevisions(c.sh)) return;
  // mepRevSt
  double stw = 0, sth = 2.5, stlw = 0.8;
  const auto lit = [&](const J& o) {
    if (!o.is_object()) return;
    if (o.contains("w")) stw = nv(o["w"]);
    if (o.contains("h")) sth = nv(o["h"]);
    if (o.contains("lw")) stlw = nv(o["lw"]);
  };
  lit(sous(tt, "revSt"));
  if (cartoucheEsquisse(c.sh)) lit(sous(tt["tb"], "revSt"));
  stw = std::max(0.0, stw);
  sth = std::min(10.0, std::max(1.8, sth != 0 ? sth : 2.5));
  stlw = std::min(2.0, std::max(0.1, stlw != 0 ? stlw : 0.8));
  const double k = sth / 2.5, fs = corpsPolice(sth), cw = fs * 0.6;
  const auto wTx = [&](const char* l, const char* f) {
    size_t m = longueurCar(l);
    for (const J& r : revs) m = std::max(m, longueurCar(chaine(r, f)));
    return m * cw + 3;
  };
  const double RH = sth + 3, wI = std::max({8.0, 10 * k, wTx("IND.", "i")}), wD = std::max({18.0, 22 * k, wTx("DATE", "d")}), wN = std::max(20.0, 28 * k);
  const double Wd = wI + wD + wN + std::min(110.0, pd.iw * 0.45), W = std::min(pd.iw, std::max(wI + wD + wN + 15, stw > 0 ? stw : Wd));
  const double wT = W - wI - wD - wN, xr = pd.ix + pd.iw - W;
  const int n = std::min(static_cast<int>(revs.size()), 8);
  const double y0 = ty - RH * (n + 1), ly = RH / 2 + sth / 2;
  const std::string sl = "stroke-width:" + tx(stlw);
  const auto T = [&](double x, double y, const std::string& t) { c.mk("text").n("x", x).n("y", y).s("class", "mepRevText").s("style", "font-size:" + tx(fs) + "px").t(t); };
  c.mk("rect").n("x", xr).n("y", y0).n("width", W).n("height", RH * (n + 1)).s("class", "mepTitleBlock").s("style", sl);
  struct Col { const char* l; double x, w; };
  const Col cols[4] = {{"IND.", xr, wI}, {"DATE", xr + wI, wD}, {"NOM", xr + wI + wD, wN}, {"MODIFICATION", xr + wI + wD + wN, wT}};
  const auto fit = [&](const std::string& t, double w) {
    const size_t m = static_cast<size_t>(std::max(1.0, std::floor((w - 2) / cw)));
    return longueurCar(t) > m ? debutCar(t, std::max<size_t>(1, m - 1)) + "…" : t;
  };
  for (int i = 0; i < 4; i++) {
    if (i) c.mk("line").n("x1", cols[i].x).n("y1", y0).n("x2", cols[i].x).n("y2", ty).s("class", "mepTitleBlock").s("style", sl);
    T(cols[i].x + 1.2, y0 + RH * n + ly, fit(cols[i].l, cols[i].w));
  }
  for (int j = 0; j < n; j++) {
    const J& r = revs[revs.size() - 1 - j];
    const double y = y0 + RH * j;
    c.mk("line").n("x1", xr).n("y1", y + RH).n("x2", xr + W).n("y2", y + RH).s("class", "mepTitleBlock").s("style", sl);
    const char* F[4] = {"i", "d", "n", "t"};
    for (int q = 0; q < 4; q++) T(cols[q].x + 1.2, y + ly, fit(chaine(r, F[q]), cols[q].w));
  }
}
struct LigneBom {
  std::string name, dims, mat;
  int qty = 1;
  std::string id;  // le premier corps ou composant de la ligne
};
std::vector<LigneBom> lignesBom(const Ctx& c) {  // mepBomRows, asmBomRows
  std::vector<LigneBom> rows;
  const J& bom = sous(c.sh, "bom");
  const J& bm = sous(bom, "mat");
  const std::string lvl = chaine(bom, "lvl");
  if (!lvl.empty() && lvl != "corps" && c.piece.assemblage) {
    for (const LigneInstance& i : c.piece.lignesInstances) {
      if (lvl == "comp1" && i.profondeur != 1) continue;
      if (lvl == "parts" && !i.feuille) continue;
      bool fait = false;
      for (LigneBom& q : rows)
        if (q.id == i.comp) q.qty++, fait = true;
      if (fait) continue;
      const std::string m = chaine(bm, i.comp.c_str());
      rows.push_back({i.nom, i.dims, m.empty() ? i.mat : m, 1, i.comp});
    }
    return rows;
  }
  for (const auto& [id, nom] : c.piece.nomsCorps) {
    const auto it = std::find_if(c.piece.corps.begin(), c.piece.corps.end(), [&, idc = id](const Corps& q) { return q.id == idc; });
    if (it == c.piece.corps.end()) continue;
    const std::string dims = fmtNum(it->taille[0], 1) + " × " + fmtNum(it->taille[1], 1) + " × " + fmtNum(it->taille[2], 1);
    const std::string name = nom.empty() ? id : nom;
    std::string mat = chaine(bm, id.c_str());
    if (mat.empty()) mat = chaine(sous(c.sh, "title"), "matiere");
    bool fait = false;
    for (LigneBom& q : rows)
      if (q.name == name && q.dims == dims && q.mat == mat) q.qty++, fait = true;
    if (!fait) rows.push_back({name, dims, mat, 1, id});
  }
  return rows;
}
// Les bulles : le numéro est celui de la ligne du composant dans la nomenclature (mepDrawBalloons)
void dessinerBulles(Ctx& c) {
  const J& bl = sous(c.sh, "balloons");
  if (!bl.is_array() || bl.empty()) return;
  const std::vector<LigneBom> rows = lignesBom(c);
  for (const J& b : bl) {
    const J* v = vueDe(c.sh, chaine(b, "view"));
    if (!v) continue;
    int rang = -1;
    for (size_t i = 0; i < rows.size(); i++)
      if (rows[i].id == chaine(b, "comp")) {
        rang = static_cast<int>(i);
        break;
      }
    if (rang < 0) continue;
    const Base B0 = baseDe(*v);
    const V3 p = v3(sous(b, "p"));
    const double ax = num(*v, "x") + dot(p, B0.u) * num(*v, "scale"), ay = num(*v, "y") + dot(p, B0.v) * num(*v, "scale");
    const double bx = ax + num(b, "dx"), by = ay + num(b, "dy"), Rb = 3.6;
    const double d = std::hypot(bx - ax, by - ay) == 0 ? 1 : std::hypot(bx - ax, by - ay);
    c.mk("line").n("x1", ax).n("y1", ay).n("x2", bx - (bx - ax) / d * Rb).n("y2", by - (by - ay) / d * Rb).s("class", "mepTitleBlock");
    c.mk("circle").n("cx", ax).n("cy", ay).n("r", 0.6).s("class", "mepTitleBlock").s("fill", "currentColor");
    c.mk("circle").n("cx", bx).n("cy", by).n("r", Rb).s("class", "mepTitleBlock");
    c.mk("text").n("x", bx).n("y", by + 1.3).s("class", "mepRevText").s("text-anchor", "middle").t(std::to_string(rang + 1));
  }
}
void dessinerNomenclature(Ctx& c, const Page& pd, double ty0) {  // mepDrawBom
  const J& bom = sous(c.sh, "bom");
  if (!vrai(bom, "on")) return;
  const std::vector<LigneBom> rows = lignesBom(c);
  if (rows.empty()) return;
  const double RH = 5.5;
  const std::pair<const char*, double> cols[5] = {{"REP.", 10}, {"QTÉ", 10}, {"DÉSIGNATION", 62}, {"MATIÈRE", 40}, {"DIMENSIONS (mm)", 42}};
  const double W = 164, x0 = pd.ix;
  const int n = std::min(static_cast<int>(rows.size()), 12);
  double ty = ty0;
  const double yF = pd.iy + pd.ih + pd.th;
  if (cartoucheEsquisse(c.sh)) {
    // mepTbW : la largeur du cartouche dessiné
    double mx, my;
    tbBoite(c.sh["title"]["tb"]["sk"], pd.iw, pd.H - pd.fr.t - pd.fr.b, mx, my);
    if (W <= pd.iw - std::min(pd.iw, std::max(0.0, -mx)) - 2) ty = yF;
  }
  const double y0 = ty - RH * (n + 1);
  c.mk("rect").n("x", x0).n("y", y0).n("width", W).n("height", RH * (n + 1)).s("class", "mepTitleBlock");
  c.mk("line").n("x1", x0).n("y1", ty - RH).n("x2", x0 + W).n("y2", ty - RH).s("class", "mepTitleBlock");
  double x = x0;
  for (int k = 0; k < 5; k++) {
    if (k) c.mk("line").n("x1", x).n("y1", y0).n("x2", x).n("y2", ty).s("class", "mepTitleBlock");
    c.mk("text").n("x", x + 1.5).n("y", ty - RH + 3.9).s("class", "mepRevText").t(cols[k].first);
    x += cols[k].second;
  }
  for (int k = 0; k < n; k++) {
    const double y = ty - RH * (k + 2);
    if (k) c.mk("line").n("x1", x0).n("y1", y + RH).n("x2", x0 + W).n("y2", y + RH).s("class", "mepTitleBlock");
    double xx = x0;
    const std::string T[5] = {std::to_string(k + 1), std::to_string(rows[k].qty), rows[k].name, rows[k].mat.empty() ? "—" : rows[k].mat, rows[k].dims};
    for (int q = 0; q < 5; q++) {
      c.mk("text").n("x", xx + 1.5).n("y", y + 4).s("class", "mepRevText").t(debutCar(T[q], static_cast<size_t>(std::floor(cols[q].second / 1.7))));
      xx += cols[q].second;
    }
  }
}
StyleCotes styleCotes(const J& mep) {  // mepDimStyleLoad
  StyleCotes s;
  const J& ls = sous(sous(mep, "prefs"), "ls");
  if (ls.is_object() && ls.contains("minifusion_mepDimStyle") && ls["minifusion_mepDimStyle"].is_string()) {
    try {
      const J o = J::parse(ls["minifusion_mepDimStyle"].get<std::string>());
      const auto haut = [&](const char* k, double& v) {
        if (o.contains(k) && !o[k].is_null() && chaine(o, k) != "" && std::isfinite(nv(o[k], NAN))) v = std::min(20.0, std::max(1.8, nv(o[k])));
      };
      haut("dimH", s.dimH);
      haut("lblH", s.lblH);
      haut("noteH", s.noteH);
      if (!o.contains("dimH") && num(o, "textHeight") > 0) s.dimH = std::min(20.0, std::max(1.8, std::floor(num(o, "textHeight") * CAP_RATIO * 10 + 0.5) / 10));
      const auto borne = [&](const char* k, double a, double b, double& v) {
        if (o.contains(k) && !o[k].is_null() && chaine(o, k) != "" && std::isfinite(nv(o[k], NAN))) v = std::min(b, std::max(a, nv(o[k])));
      };
      borne("arrowAngle", 10, 90, s.arrowAngle);
      borne("arrowLen", 2, 30, s.arrowLen);
      if (o.contains("prec") && o["prec"].is_number()) {
        const double p = o["prec"].get<double>();
        if (p == 0 || p == 1 || p == 2 || p == 3) s.prec = static_cast<int>(p);
      }
    } catch (const std::exception&) {
    }
  }
  s.textHeight = js::arrondi(s.dimH / CAP_RATIO, 3);
  return s;
}
// ── hachures ──
struct CfgHach {
  std::string pat = "iso", col;
  double ang = 45, sc = 1;
  bool parts = true;
};
CfgHach cfgHachures(const J& mep) {  // mepHatchCfg
  CfgHach H;
  const J& h = sous(mep, "hatch");
  if (!h.is_object()) return H;
  const std::string p = chaine(h, "pat");
  if (p == "iso" || p == "acier" || p == "cuivre" || p == "alu" || p == "plast" || p == "plein") H.pat = p;
  if (h.contains("ang") && !h["ang"].is_null() && chaine(h, "ang") != "") H.ang = std::fmod(std::fmod(nv(h["ang"]), 180) + 180, 180);
  if (num(h, "sc") > 0) H.sc = std::min(10.0, std::max(0.1, num(h, "sc")));
  const std::string col = chaine(h, "col");
  if (couleurHex(col)) H.col = col;
  H.parts = !(h.contains("parts") && h["parts"].is_boolean() && !h["parts"].get<bool>());
  return H;
}
CfgHach varianteHachures(int k, CfgHach H) {  // mepHatchVar
  H.ang = std::fmod(std::fmod(H.ang + (k % 2 ? 90 : 0), 180) + 180, 180);
  static const double f[6] = {1, 1, 1.6, 1.6, 0.65, 0.65};
  H.sc = H.sc * f[k % 6];
  return H;
}
std::vector<std::array<P2, 2>> lignesHachures(const std::vector<Boucle>& loops, double deg, double sp, double phase) {  // mepHatchLines
  const double t = deg * PI / 180, c = std::cos(t), s = std::sin(t);
  std::vector<std::vector<P2>> RL;
  double miny = 1e9, maxy = -1e9;
  for (const Boucle& l : loops) {
    RL.emplace_back();
    for (const P2& p : l) {
      const P2 q{p[0] * c - p[1] * s, p[0] * s + p[1] * c};
      RL.back().push_back(q);
      miny = std::min(miny, q[1]), maxy = std::max(maxy, q[1]);
    }
  }
  std::vector<std::array<P2, 2>> lines;
  const double ph = phase * sp;
  for (double y = std::ceil((miny - ph) / sp) * sp + ph; y <= maxy; y += sp) {
    std::vector<double> xs;
    for (const auto& l : RL)
      for (size_t i = 0; i < l.size(); i++) {
        const P2& a = l[i];
        const P2& b = l[(i + 1) % l.size()];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push_back(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
    std::sort(xs.begin(), xs.end());
    for (size_t i = 0; i + 1 < xs.size(); i += 2)
      if (xs[i + 1] - xs[i] > 0.2) {
        const auto un = [&](double x) { return P2{x * c + y * s, -x * s + y * c}; };
        lines.push_back({un(xs[i]), un(xs[i + 1])});
      }
  }
  return lines;
}
void dessinerHachures(Ctx& c, const std::vector<Boucle>& loops, double vx, double vy, double sc, const CfgHach& H) {  // mepDrawHatch
  if (loops.empty()) return;
  const std::string st = H.col.empty() ? "" : (H.pat == "plein" ? "fill:" : "stroke:") + H.col;
  if (H.pat == "plein") {
    std::string d;
    for (const Boucle& l : loops) {
      if (!d.empty()) d += " ";
      d += "M";
      for (size_t i = 0; i < l.size(); i++) d += (i ? " L" : "") + tx(arr3(vx + l[i][0] * sc)) + " " + tx(arr3(vy + l[i][1] * sc));
      d += " Z";
    }
    At a = c.mk("path").s("d", d).s("fill-rule", "evenodd").s("class", "mepHatch mepHatchFill");
    if (!st.empty()) a.s("style", st);
    return;
  }
  struct Fam { double ang, pas, ph; const char* tir; };
  std::vector<Fam> P;
  if (H.pat == "acier") P = {{0, 2, 0, nullptr}, {0, 2, 0.2, nullptr}};
  else if (H.pat == "cuivre") P = {{0, 2, 0, nullptr}, {0, 2, 0.5, "1.6 0.8"}};
  else if (H.pat == "alu") P = {{0, 1, 0, nullptr}, {90, 1, 0, nullptr}};
  else if (H.pat == "plast") P = {{0, 1, 0, "2 1"}};
  else P = {{0, 1, 0, nullptr}};
  const double sp0 = 2.5 * H.sc / sc;
  for (const Fam& F : P)
    for (const auto& ln : lignesHachures(loops, H.ang + F.ang, sp0 * F.pas, F.ph)) {
      At a = c.mk("line").n("x1", arr3(vx + ln[0][0] * sc)).n("y1", arr3(vy + ln[0][1] * sc)).n("x2", arr3(vx + ln[1][0] * sc)).n("y2", arr3(vy + ln[1][1] * sc)).s("class", "mepHatch");
      if (F.tir) a.s("stroke-dasharray", F.tir);
      if (!st.empty()) a.s("style", st);
    }
}
// ── une vue (mepDrawView) ──
struct P { double x, y; };
std::string texteTitreVue(const J& v) {  // mepViewTitleText
  const std::string label = chaine(v, "label");
  if (label.empty()) return "";
  const std::string k = chaine(v, "kind");
  if (k == "section") return "COUPE " + label + "-" + label;
  if (k == "detail") {
    const double s = num(v, "scale");
    return "DÉTAIL " + label + " (" + (s >= 1 ? fmtNum(s, 2) + ":1" : "1:" + fmtNum(1 / s, 2)) + ")";
  }
  if (k == "aux") return label;
  return "";
}
std::string classeEnt(const Ent& e) {
  if (e.k == "hidden" || e.k == "threadH") return "mepEnt mepHidden";
  if (e.k == "thread") return "mepEnt mepThread";
  if (e.k == "tangent") return "mepEnt mepTangent";
  if (e.k == "sect") return "mepEnt mepSect";
  if (e.k == "brk") return "mepEnt mepBrk";
  return "mepEnt mepSharp";
}
void dessinerVue(Ctx& c, J& v) {
  const Geo& g = c.calc.geoDe(v, c.sh, c.mep, c.piece);
  const double vx = num(v, "x"), vy = num(v, "y"), sc = num(v, "scale");
  const auto X = [&](double l) { return vx + l * sc; };
  const auto Y = [&](double l) { return vy + l * sc; };
  if (vrai(v, "render3d") || vrai(v, "real")) {
    // Le rendu 3D derrière les arêtes (mepImg3dRect)
    const CadreImage& im = c.calc.imageDe(v, c.piece);
    if (im.ok) c.mk("image").n("x", arr3(X(im.l))).n("y", arr3(Y(im.t))).n("width", arr3(im.largeur * sc)).n("height", arr3(im.hauteur * sc)).s("href", "vue:" + im.cle).s("class", "mepRender3d");
  }
  dessinerAxesVue(c, v);
  for (const Ent& e : g.els) {
    const std::string cls = classeEnt(e);
    if (e.t == 'L') {
      c.mk("line").n("x1", arr3(X(e.x1))).n("y1", arr3(Y(e.y1))).n("x2", arr3(X(e.x2))).n("y2", arr3(Y(e.y2))).s("class", cls);
    } else if (e.t == 'C') {
      c.mk("circle").n("cx", arr3(X(e.cx))).n("cy", arr3(Y(e.cy))).n("r", arr3(e.r * sc)).s("class", cls);
    } else if (e.t == 'A') {
      const double x0 = arr3(X(e.cx + e.r * std::cos(e.a0))), y0 = arr3(Y(e.cy + e.r * std::sin(e.a0)));
      const double x1 = arr3(X(e.cx + e.r * std::cos(e.a1))), y1 = arr3(Y(e.cy + e.r * std::sin(e.a1)));
      const double rr = arr3(e.r * sc);
      const int la = std::abs(e.a1 - e.a0) > PI ? 1 : 0, sw = e.a1 > e.a0 ? 1 : 0;
      c.mk("path").s("d", "M" + tx(x0) + " " + tx(y0) + " A" + tx(rr) + " " + tx(rr) + " 0 " + std::to_string(la) + " " + std::to_string(sw) + " " + tx(x1) + " " + tx(y1)).s("class", cls);
    } else if (e.t == 'P' && e.pts.size() > 1) {
      for (size_t k = 0; k + 1 < e.pts.size(); k++) c.mk("line").n("x1", arr3(X(e.pts[k][0]))).n("y1", arr3(Y(e.pts[k][1]))).n("x2", arr3(X(e.pts[k + 1][0]))).n("y2", arr3(Y(e.pts[k + 1][1]))).s("class", cls);
    }
  }
  const CfgHach H = cfgHachures(c.mep);
  if (g.hatchG.size() > 1 && H.parts) {
    for (size_t k = 0; k < g.hatchG.size(); k++) dessinerHachures(c, g.hatchG[k], vx, vy, sc, varianteHachures(static_cast<int>(k), H));
  } else if (!g.hatch.empty()) {
    dessinerHachures(c, g.hatch, vx, vy, sc, H);
  }
  // ligne de coupe sur la vue mère
  const J& sec = sous(v, "section");
  if (sec.is_object() && vrai(sec, "a") && vrai(sec, "pid")) {
    if (const J* par = vueDe(c.sh, chaine(sec, "pid"))) {
      const double px = num(*par, "x"), py = num(*par, "y"), ps = num(*par, "scale");
      const auto S = [&](double a, double b) { return P{px + a * ps, py + b * ps}; };
      const P A = S(nv(sec["a"][0]), nv(sec["a"][1]));
      const P B0 = S(nv(sous(sec, "b")[0]), nv(sous(sec, "b")[1]));
      std::vector<P> SP;
      if (sous(sec, "pts").is_array() && sec["pts"].size() > 2)
        for (const J& q : sec["pts"]) SP.push_back(S(nv(q[0]), nv(q[1])));
      const P B = SP.empty() ? B0 : SP.back();
      if (!SP.empty()) {
        for (size_t i = 0; i + 1 < SP.size(); i++) c.mk("line").n("x1", SP[i].x).n("y1", SP[i].y).n("x2", SP[i + 1].x).n("y2", SP[i + 1].y).s("class", "mepCutLine");
        for (size_t i = 1; i + 1 < SP.size(); i++)
          for (const P& Q : {SP[i - 1], SP[i + 1]}) {
            const double qx = Q.x - SP[i].x, qy = Q.y - SP[i].y;
            double ql = std::hypot(qx, qy);
            if (ql == 0) ql = 1;
            const double m = std::min(4.0, ql / 2);
            c.mk("line").n("x1", SP[i].x).n("y1", SP[i].y).n("x2", SP[i].x + qx / ql * m).n("y2", SP[i].y + qy / ql * m).s("class", "mepCutEnd");
          }
      } else {
        c.mk("line").n("x1", A.x).n("y1", A.y).n("x2", B.x).n("y2", B.y).s("class", "mepCutLine");
      }
      // mepCutEnds
      const double dx = B0.x - A.x, dy = B0.y - A.y;
      double L = std::hypot(dx, dy);
      if (L == 0) L = 1;
      const double tx0 = dx / L, ty0 = dy / L;
      const Base pb = baseDe(*par);
      const V3 nd = vrai(sec, "n") ? v3(sec["n"]) : v3(sous(v, "dir"));
      double ax = -dot(nd, pb.u), ay = -dot(nd, pb.v);
      const double La = std::hypot(ax, ay);
      if (La < 1e-6) ax = -ty0, ay = tx0;
      else ax /= La, ay /= La;
      const double lh = c.st.lblH, off = lh / 2 + 1.6;
      const J& shf = sous(sec, "sh");
      const std::string label = chaine(v, "label");
      for (int end = 0; end < 2; end++) {
        const P Pp = end ? B : A;
        const double sg = end ? 1 : -1;
        const double s0 = shf.is_array() && static_cast<int>(shf.size()) > end ? nv(shf[end]) : 0;
        const double ux = tx0 * sg, uy = ty0 * sg;
        const P Q{Pp.x + ux * s0, Pp.y + uy * s0};
        const P o{Q.x + ux * 3, Q.y + uy * 3}, i{Q.x - ux * 5, Q.y - uy * 5}, M{Q.x - ux, Q.y - uy};
        const P tail{M.x - ax * 10, M.y - ay * 10}, lbl{M.x - ax * 6 + ux * off, M.y - ay * 6 + uy * off};
        if (s0 > 0) c.mk("line").n("x1", Pp.x).n("y1", Pp.y).n("x2", Q.x).n("y2", Q.y).s("class", "mepCutLine");
        c.mk("line").n("x1", o.x).n("y1", o.y).n("x2", i.x).n("y2", i.y).s("class", "mepCutEnd");
        c.mk("line").n("x1", tail.x).n("y1", tail.y).n("x2", M.x).n("y2", M.y).s("class", "mepCutArr").s("marker-end", "url(#mepArrK)");
        if (!label.empty()) c.mk("text").n("x", lbl.x).n("y", lbl.y + c.st.lblH / 2).s("class", "mepLbl mepCutLbl").s("text-anchor", "middle").t(label);
      }
    }
  }
  // détail
  const J& det = sous(v, "detail");
  if (det.is_object()) {
    const double dcx = num(det, "cx"), dcy = num(det, "cy"), dr = num(det, "r");
    c.mk("circle").n("cx", vx + dcx * sc).n("cy", vy + dcy * sc).n("r", dr * sc).s("class", "mepDetailB");
    if (vrai(v, "parent"))
      if (const J* par = vueDe(c.sh, chaine(v, "parent"))) {
        const double ps = num(*par, "scale");
        const double Cx = num(*par, "x") + dcx * ps, Cy = num(*par, "y") + dcy * ps, rr = dr * ps;
        c.mk("circle").n("cx", Cx).n("cy", Cy).n("r", rr).s("class", "mepDetailC");
        const std::string label = chaine(v, "label");
        if (!label.empty()) c.mk("text").n("x", Cx + rr * 0.75 + 2).n("y", Cy - rr * 0.75 - 2).s("class", "mepLbl").s("text-anchor", "start").t(label);
      }
  }
  // titre (mepViewTitleGeo)
  const std::string txt = texteTitreVue(v);
  Boite bb;
  if (!txt.empty() && boiteVue(v, g, bb)) {
    const J& t = sous(v, "ttl");
    const double lh = c.st.lblH, gap = t.is_object() && t.contains("gap") && std::isfinite(nv(t["gap"], NAN)) ? nv(t["gap"]) : 5;
    const double x = bb.x + bb.w / 2, y = chaine(t, "side") == "above" ? bb.y - gap : bb.y + bb.h + gap + lh;
    c.mk("text").n("x", x).n("y", y).s("class", "mepLbl").s("text-anchor", "middle").t(txt);
  }
}
}  // namespace

std::vector<V3> pointsDeCourbe(const BRepAdaptor_Curve& ad, double u0, double u1, double tol, size_t cap) { return pointsCourbe(ad, u0, u1, tol, cap); }

Piece pieceDe(const Document& d, const ResultatRejeu& r, const J& doc) {
  Piece p;
  for (const auto& [id, s] : r.corpsVus) {
    if (std::find(d.corpsMasques.begin(), d.corpsMasques.end(), id) != d.corpsMasques.end()) continue;
    Corps q;
    q.id = id, q.forme = s;
    q.import = std::any_of(d.fonctions.begin(), d.fonctions.end(), [&](const Fonction& f) { return f.type == "import" && f.corps == id; });
    Bnd_Box b;
    BRepBndLib::AddOptimal(s, b, false, false);
    if (!b.IsVoid()) {
      double x0, y0, z0, x1, y1, z1;
      b.Get(x0, y0, z0, x1, y1, z1);
      q.taille = {x1 - x0, y1 - y0, z1 - z0};
    }
    {  // bodyColorOf : la fiche du corps, sinon la teinte de la pièce, sinon la palette automatique selon le rang
      static const unsigned PALETTE[] = {0x0a84ff, 0x30d158, 0xff9f0a, 0xbf5af2, 0xff453a, 0x64d2ff, 0xffd60a, 0x5e5ce6};
      const size_t i = std::find(d.corps.begin(), d.corps.end(), id) - d.corps.begin();
      unsigned c = i < d.couleursCorps.size() ? d.couleursCorps[i] : 0;
      if (!c) c = d.teinte;
      if (!c) c = PALETTE[(i < d.corps.size() ? i : 0) % 8];
      q.couleur = c;
      if (i < d.opacitesCorps.size()) q.opacite = d.opacitesCorps[i];
    }
    p.corps.push_back(std::move(q));
  }
  for (const SpiraleFilet& s : r.spirales) {
    if (std::find(d.corpsMasques.begin(), d.corpsMasques.end(), s.corps) != d.corpsMasques.end()) continue;
    FiletImage f;
    f.corps = s.corps;
    for (const gp_Pnt& q : s.helice) f.helice.push_back({q.X(), q.Y(), q.Z()});
    for (const gp_Pnt& q : s.anneau) f.anneau.push_back({q.X(), q.Y(), q.Z()});
    p.helices.push_back(std::move(f));
  }
  for (const J& b : sous(doc, "bodies")) p.nomsCorps.push_back({chaine(b, "id"), chaine(b, "name")});
  // Les perçages
  const J& feats = sous(doc, "features");
  const auto brut = [&](const std::string& id) -> const J& {
    if (feats.is_array())
      for (const J& x : feats)
        if (chaine(x, "id") == id) return x;
    return vide();
  };
  for (const Fonction& f : d.fonctions) {
    if (f.type != "hole") continue;
    const Esquisse* sk = nullptr;
    for (const Esquisse& s : d.esquisses)
      if (s.id == f.esquisse) sk = &s;
    if (!sk) continue;
    Trou t;
    const InfosPercage N = percageInfos(f);
    t.fid = f.id, t.visible = f.visible, t.kind = N.kind, t.end = N.end, t.pilot = N.pilot;
    t.d = N.d, t.stD = N.stD, t.stH = N.stH, t.cbD = N.cbD, t.cbH = N.cbH, t.csD = N.csD, t.csA = N.csA, t.depth = N.depth;
    const ReglageFilet& F = f.percage.filet;
    t.taille = F.size, t.lenMode = F.lenMode, t.modele = F.model, t.lh = F.lh, t.pas = F.p, t.lenFilet = F.len;
    t.aPlan = f.percage.aPlan, t.planP = f.percage.planP, t.planN = f.percage.planN;
    t.aPlanFilet = F.aPlan, t.planFiletP = F.planP, t.planFiletN = F.planN;
    if (const nlohmann::ordered_json* iso = filetageDe(F.size)) t.aPasDifferent = F.p != (*iso)[2].get<double>();
    if (!F.size.empty())
      if (const auto th = filetInterieur(F.size, F.p, F.clear)) t.aFiletIso = true, t.thD = th->D, t.thD1 = th->D1, t.thC = th->c;
    const double sg = f.flip ? 1 : -1;
    t.dir = {sk->n[0] * sg, sk->n[1] * sg, sk->n[2] * sg};
    for (const Entite& e : sk->entites) {
      if (e.t != "cpoint" || !e.percage) continue;
      const Pt* Q = sk->point(e.p);
      if (Q) t.pts.push_back({e.id, {sk->o[0] + sk->u[0] * Q->x + sk->v[0] * Q->y, sk->o[1] + sk->u[1] * Q->x + sk->v[1] * Q->y, sk->o[2] + sk->u[2] * Q->x + sk->v[2] * Q->y}});
    }
    for (const FiletDuPlan& fp : r.filetsCosmetiques)
      if (fp.fonction == f.id) t.longueurFilet = fp.longueur, t.corps = fp.corps;
    const J& jf = brut(f.id);
    t.tolAlesage = chaine(jf, "reamTol");
    const std::string rid = chaine(jf, "repeatId");
    if (feats.is_array())
      for (const J& x : feats)
        if (chaine(x, "type") == "repeat") {
          bool dedans = !rid.empty() && chaine(x, "id") == rid;
          if (sous(x, "base").is_array())
            for (const J& b : x["base"])
              if (b.is_string() && b.get<std::string>() == f.id) dedans = true;
          if (dedans) {
            t.repetition = chaine(x, "id");
            break;
          }
        }
    p.trous.push_back(std::move(t));
  }
  for (const FiletDuPlan& fp : r.filetsCosmetiques) {
    const double len = fp.longueur;
    const Fonction* f = d.fonction(fp.fonction);
    if (!f || !f->visible || f->type != "hole" || f->percage.filet.model) continue;
    const Esquisse* sk = nullptr;
    for (const Esquisse& s : d.esquisses)
      if (s.id == f->esquisse) sk = &s;
    if (!sk) continue;
    const auto infos = percageInfos(*f);
    Filet F;
    F.corps = fp.corps;
    if (std::find(d.corpsMasques.begin(), d.corpsMasques.end(), F.corps) != d.corpsMasques.end()) continue;
    F.taille = f->percage.filet.size;
    F.lenMode = f->percage.filet.lenMode;
    const nlohmann::ordered_json* t = filetageDe(F.taille);
    if (!t) continue;
    F.D = (*t)[1].get<double>();
    F.d = infos.d, F.depth = infos.depth, F.entree = infos.entree;
    F.len = len != 0 ? len : (f->percage.filet.len != 0 ? f->percage.filet.len : infos.depth);
    const double sg = f->flip ? 1 : -1;
    F.dir = {sk->n[0] * sg, sk->n[1] * sg, sk->n[2] * sg};
    for (const Entite& e : sk->entites) {
      if (e.t != "cpoint" || !e.percage) continue;
      const Pt* Q = sk->point(e.p);
      if (!Q) continue;
      F.centres.push_back({sk->o[0] + sk->u[0] * Q->x + sk->v[0] * Q->y, sk->o[1] + sk->u[1] * Q->x + sk->v[1] * Q->y, sk->o[2] + sk->u[2] * Q->x + sk->v[2] * Q->y});
    }
    p.filets.push_back(std::move(F));
  }
  return p;
}

void normaliser(J& mep) {  // mepEnsure, mepNormSheet
  if (!mep.is_object()) mep = J{{"cur", 0}, {"sheets", J::array()}};
  if (!mep.contains("sheets") || !mep["sheets"].is_array()) mep["sheets"] = J::array();
  if (mep["sheets"].empty()) {
    J sh = J::object();
    sh["id"] = "sh1";
    sh["name"] = "Planche 1";
    sh["format"] = "A3";
    sh["orient"] = "landscape";
    sh["views"] = J::array();
    sh["dims"] = J::array();
    sh["sk"] = nullptr;
    sh["title"] = J{{"projet", "ConceptCAD — Plan"}, {"auteur", "—"}, {"date", ""}, {"tb", nullptr}};
    sh["seq"] = 1;
    sh["dseq"] = 1;
    mep["sheets"].push_back(sh);
  }
  const int nb = static_cast<int>(mep["sheets"].size());
  const double cur = num(mep, "cur", -1);
  if (!(cur >= 0 && cur < nb)) mep["cur"] = 0;
  for (J& sh : mep["sheets"]) {
    if (!sh.contains("name") || chaine(sh, "name").empty()) sh["name"] = "Planche";
    const std::string f = chaine(sh, "format");
    if (f != "A0" && f != "A1" && f != "A2" && f != "A3" && f != "A4" && f != "Manuel") sh["format"] = "A3";
    sh["orient"] = chaine(sh, "orient") == "portrait" ? "portrait" : "landscape";
    if (chaine(sh, "format") == "Manuel") {
      const double fw = num(sh, "fw") != 0 ? num(sh, "fw") : 420, fh = num(sh, "fh") != 0 ? num(sh, "fh") : 297;
      sh["fw"] = std::min(5000.0, std::max(50.0, fw));
      sh["fh"] = std::min(5000.0, std::max(50.0, fh));
      sh["orient"] = sh["fw"].get<double>() >= sh["fh"].get<double>() ? "landscape" : "portrait";
    }
    if (!sous(sh, "views").is_array()) sh["views"] = J::array();
    if (!sous(sh, "dims").is_array()) sh["dims"] = J::array();
    if (!sous(sh, "title").is_object()) sh["title"] = J::object();
    if (mep.value("camBasisV", 0) != 2)
      for (J& v : sh["views"])
        if (v.is_object() && chaine(v, "kind") == "base" && chaine(v, "vk").empty() && vrai(v, "dir")) v["camera"] = true;
  }
  mep["camBasisV"] = 2;
}

const Geo& Calcul::geoDe(const J& vue, const J& planche, const J& mep, const Piece& p) {
  (void)mep;
  const std::string id = chaine(vue, "id");
  J cle = J::object();
  for (const char* k : {"kind", "vk", "bodyId", "asm", "dir", "u", "v", "flip", "mode", "tangent", "section", "detail", "obl", "persp", "camera", "parent"})
    if (vue.is_object() && vue.contains(k)) cle[k] = vue[k];
  std::string sig = cle.dump(-1, ' ', false, J::error_handler_t::replace);
  // Une vue dépend aussi de sa mère (coupe brisée) : son repère est dans la clé
  const J& sec = sous(vue, "section");
  if (sec.is_object())
    if (const J* par = vueDe(planche, chaine(sec, "pid"))) sig += chaine(*par, "vk") + sous(*par, "u").dump() + sous(*par, "dir").dump();
  auto it = cache_.find(id);
  if (it != cache_.end() && it->second.first == sig) return *it->second.second;
  auto g = std::make_shared<Geo>(construire(vue, planche, p));
  cache_[id] = {sig, g};
  return *g;
}

// asmPlanInstances, asmPlanBodies : les instances sous le composant actif, lui exclu, sans celles masquées
void completerAssemblage(Piece& p, const Document& d, const assemblage::Solides& S) {
  namespace as = assemblage;
  if (!d.assemblage) return;
  const J& a = *d.assemblage;
  const J* base = as::composant(a, as::actif(a));
  const bool aDesOcc = base && base->contains("occ") && (*base)["occ"].is_array() && !(*base)["occ"].empty();
  if (!aDesOcc) return;
  p.assemblage = true;
  const auto texte = [](const J& o, const char* k) { return chaine(o, k); };
  for (const as::Instance& I : as::instances(a, as::actif(a))) {
    if (I.chemin.empty()) continue;
    bool masquee = false;
    for (const std::string& id : I.chemin) {
      const J* o = as::occurrence(a, id);
      if (!o || (o->contains("visible") && (*o)["visible"].is_boolean() && !(*o)["visible"].get<bool>())) masquee = true;
    }
    if (masquee) continue;
    const J* c = as::composant(a, I.comp);
    if (!c) continue;
    const J& doc = sous(*c, "doc");
    const J& vis = sous(doc, "bodyVis");
    LigneInstance L;
    L.comp = I.comp, L.nom = texte(*c, "name"), L.profondeur = static_cast<int>(I.chemin.size());
    L.feuille = !(c->contains("occ") && (*c)["occ"].is_array() && !(*c)["occ"].empty());
    const J& mat = sous(doc, "mat");
    L.mat = mat.is_object() && num(mat, "rho") > 0 ? texte(mat, "name") : "Acier";
    gp_Trsf t;
    t.SetValues(I.F.x[0], I.F.y[0], I.F.z[0], I.F.o[0], I.F.x[1], I.F.y[1], I.F.z[1], I.F.o[1], I.F.x[2], I.F.y[2], I.F.z[2], I.F.o[2]);
    const auto it = S.find(I.comp);
    V3 lo{1e18, 1e18, 1e18}, hi{-1e18, -1e18, -1e18};
    bool un = false;
    if (it != S.end() && it->second)
      for (const auto& [id, forme] : it->second->corps) {
        if (forme.IsNull()) continue;
        if (vis.is_object() && vis.contains(id) && vis[id].is_boolean() && !vis[id].get<bool>()) continue;
        for (const Tri& q : trianglesDe(forme))
          for (const V3* w : {&q.a, &q.b, &q.c})
            for (int j = 0; j < 3; j++) {
              lo[j] = std::min(lo[j], (*w)[j]);
              hi[j] = std::max(hi[j], (*w)[j]);
              un = true;
            }
        CorpsInstance x;
        x.comp = I.comp, x.id = id;
        x.forme = BRepBuilderAPI_Transform(forme, t, true).Shape();
        for (const auto& q : it->second->teintes)
          if (q.first.IsSame(forme)) x.couleur = q.second;
        for (const auto& q : it->second->transparences)
          if (q.first.IsSame(forme)) x.opacite = 1 - q.second;
        p.instances.push_back(std::move(x));
      }
    if (un) {
      const auto f = [](double v) {
        std::string s = js::fixe(v, 1);
        std::replace(s.begin(), s.end(), '.', ',');
        return s;
      };
      L.dims = f(hi[0] - lo[0]) + " × " + f(hi[1] - lo[1]) + " × " + f(hi[2] - lo[2]);
    }
    p.lignesInstances.push_back(std::move(L));
  }
}

// mepRender3dImage : le cadre de l'image et ce qu'elle montre ; le rendu lui-même revient à la fenêtre 3D
const CadreImage& Calcul::imageDe(const J& vue, const Piece& p) {
  const std::string id = chaine(vue, "id");
  J cle = J::object();
  for (const char* k : {"kind", "vk", "bodyId", "asm", "dir", "u", "v", "flip", "persp", "camera", "section", "detail", "obl", "render3d", "real", "mirror"})
    if (vue.is_object() && vue.contains(k)) cle[k] = vue[k];
  const std::string sig = cle.dump(-1, ' ', false, J::error_handler_t::replace);
  auto it = images_.find(id);
  if (it != images_.end() && it->second.first == sig) return it->second.second;
  CadreImage im;
  // L'image d'une coupe, d'un détail ou d'une vue cavalière n'existe pas encore ici
  if (rendreImage && !vrai(vue, "section") && !vrai(vue, "detail") && !obliqueDe(vue)) {
    const Base b = baseDe(vue);
    const std::string bodyId = chaine(vue, "bodyId");
    DemandeImage d;
    std::vector<std::vector<Tri>> maillages;
    const bool vueAsm = vrai(vue, "asm") && p.assemblage;
    for (const Corps& c : p.corps) {
      if (!vueAsm && !bodyId.empty() && c.id != bodyId) continue;
      d.corps.push_back({c.forme, c.couleur, c.opacite});
      maillages.push_back(trianglesDe(c.forme));
    }
    if (vueAsm)
      for (const CorpsInstance& c : p.instances) {
        maillages.push_back(trianglesDe(c.forme));  // maille la forme, s'il le faut, avant son affichage
        d.corps.push_back({c.forme, c.couleur, c.opacite});
      }
    for (const FiletImage& f : p.helices)
      if (bodyId.empty() || f.corps.empty() || f.corps == bodyId) d.filets.push_back(f);
    CamPersp K;
    const bool persp = perspDe(vue) && camPersp(vue, maillages, K);
    double minu = 1e9, maxu = -1e9, minv = 1e9, maxv = -1e9, mind = 1e9, maxd = -1e9, su0 = 1e9, su1 = -1e9, sv0 = 1e9, sv1 = -1e9;
    for (const auto& m : maillages)
      for (const Tri& t : m)
        for (const V3* q : {&t.a, &t.b, &t.c}) {
          const double du = dot(*q, b.u), dv = dot(*q, b.v), dd = dot(*q, b.dir);
          minu = std::min(minu, du), maxu = std::max(maxu, du), minv = std::min(minv, dv), maxv = std::max(maxv, dv), mind = std::min(mind, dd), maxd = std::max(maxd, dd);
          double su = du, sv = dv;
          if (persp) {
            const auto r = K.proj(*q);
            su = r[0], sv = r[1];
          }
          su0 = std::min(su0, su), su1 = std::max(su1, su), sv0 = std::min(sv0, sv), sv1 = std::max(sv1, sv);
        }
    if (maxu > minu && maxv > minv) {
      const double pad = std::max(0.5, (maxu - minu + maxv - minv) * 0.012);
      double l = su0 - pad, r = su1 + pad, t = sv0 - pad, bas = sv1 + pad;
      d.u = b.u, d.v = b.v, d.dir = b.dir, d.persp = persp;
      if (persp) {
        // La caméra d'OCCT vise le milieu de l'image : le cadre est rendu symétrique autour du centre de la pièce
        const double hw = std::max(std::abs(l - K.cu), std::abs(r - K.cu)), hh = std::max(std::abs(t - K.cv), std::abs(bas - K.cv));
        l = K.cu - hw, r = K.cu + hw, t = K.cv - hh, bas = K.cv + hh;
        d.oeil = K.E, d.vise = K.C;
        d.fov = 2 * std::atan(hh / K.dist) * 180 / PI;
      } else {
        const double cx = (l + r) / 2, cy = (t + bas) / 2, cd = (mind + maxd) / 2;
        d.vise = {b.u[0] * cx + b.v[0] * cy + b.dir[0] * cd, b.u[1] * cx + b.v[1] * cy + b.dir[1] * cd, b.u[2] * cx + b.v[2] * cy + b.dir[2] * cd};
        const double depth = std::max(1.0, maxd - mind), dist = depth * 2 + std::max(10.0, maxu - minu + maxv - minv);
        d.oeil = {d.vise[0] + b.dir[0] * dist, d.vise[1] + b.dir[1] * dist, d.vise[2] + b.dir[2] * dist};
      }
      const double aspect = (r - l) / std::max(1e-9, bas - t);
      const int LONG = 1600;
      if (aspect >= 1) {
        d.W = LONG, d.H = std::max(64, static_cast<int>(std::round(LONG / aspect)));
      } else {
        d.H = LONG, d.W = std::max(64, static_cast<int>(std::round(LONG * aspect)));
      }
      d.l = l, d.t = t, d.r = r, d.b = bas;
      d.cle = id + "#" + std::to_string(++compteurImages_);
      rendreImage(d);
      im.ok = true, im.l = l, im.t = t, im.largeur = r - l, im.hauteur = bas - t, im.cle = d.cle;
    }
  }
  return (images_[id] = {sig, im}).second;
}

void tailleFeuille(const J& planche, double& w, double& h) { pageWH(planche, w, h); }

Style styleDe(const J& mep) {  // mepPrefsApply, mepLwGet
  Style s;
  const J& ls = sous(sous(mep, "prefs"), "ls");
  if (!ls.is_object()) return s;
  if (chaine(ls, "mep_paper") == "dark") s.papier = "dark";
  try {
    if (ls.contains("mep_lw") && ls["mep_lw"].is_string()) {
      const J o = J::parse(ls["mep_lw"].get<std::string>());
      if (o.is_object() && o.contains("thick")) {
        s.thick = num(o, "thick"), s.thin = num(o, "thin"), s.hid = num(o, "hid"), s.dim = num(o, "dim"), s.ext = num(o, "ext"), s.axis = num(o, "axis");
      }
    }
    if (ls.contains("minifusion_mepDimStyle") && ls["minifusion_mepDimStyle"].is_string()) {
      const J o = J::parse(ls["minifusion_mepDimStyle"].get<std::string>());
      const std::string c = chaine(o, "color");
      if (couleurHex(c) && c != "#0a84ff" && c != "#0A84FF") s.couleurCotes = c;
    }
  } catch (const std::exception&) {
  }
  return s;
}

TaillesCotes taillesCotes(const J& mep) {
  const StyleCotes s = styleCotes(mep);
  TaillesCotes t;
  t.corpsCote = s.textHeight, t.corpsLbl = js::arrondi(s.lblH / CAP_RATIO, 3), t.fleche = s.arrowLen, t.angleFleche = s.arrowAngle;
  return t;
}

std::vector<Elt> dessiner(J& mep, int planche, const Piece& p, Calcul& calc) {  // mepRenderCorps
  std::vector<Elt> out;
  calc.cotesVues.clear();
  J& sh = mep["sheets"][planche];
  Ctx c{out, mep, sh, planche, p, calc};
  c.st = styleCotes(mep);
  const Page pd = pageDe(sh);
  c.mk("rect").n("x", 0).n("y", 0).n("width", pd.W).n("height", pd.H).s("class", "mepPage");
  dessinerCadre(c, pd);
  const double ty = pd.H - pd.fr.b - pd.th;
  if (cartoucheEsquisse(sh)) {
    dessinerEsquisse(c, sh["title"]["tb"]["sk"], pd.ix + pd.iw, pd.H - pd.fr.b, false);
  } else {
    c.mk("rect").n("x", pd.ix).n("y", ty).n("width", pd.iw).n("height", pd.th).s("class", "mepTitleBlock");
    c.mk("line").n("x1", pd.ix).n("y1", ty).n("x2", pd.ix + pd.iw).n("y2", ty).s("class", "mepTitleBlock");
    dessinerTitre(c, pd, ty);
  }
  dessinerRevisions(c, pd, ty);
  dessinerNomenclature(c, pd, ty);
  try {
    suivreLiensCoupes(c);
  } catch (const std::exception&) {
  }
  for (J& v : sh["views"]) {
    // mepBuildGeo : la base de la vue, retournement compris, reste écrite dans la vue
    if (chaine(v, "kind") != "dxf" && vrai(v, "flip")) {
      const Base b = baseDe(v);
      v["dir"] = {b.dir[0], b.dir[1], b.dir[2]}, v["u"] = {b.u[0], b.u[1], b.u[2]}, v["v"] = {b.v[0], b.v[1], b.v[2]};
    }
  }
  for (J& v : sh["views"]) {
    if (!v.is_object()) continue;
    try {
      dessinerVue(c, v);
    } catch (const Standard_Failure&) {
    } catch (const std::exception&) {
    }
  }
  if (sh.contains("dims") && sh["dims"].is_array())
    for (J& d : sh["dims"]) {
      const size_t n0 = out.size();
      try {
        dessinerCote(c, d);
      } catch (const Standard_Failure&) {
      } catch (const std::exception&) {
      }
      const std::string idc = chaine(d, "id");
      const bool choisie = calc.selection && (calc.selection->cote == idc || calc.selection->lotCotes.count(idc));
      CoteVue q;
      for (size_t i = n0; i < out.size(); i++) {
        Elt& e = out[i];
        if (e.tag == "line") {
          const auto val = [&](const char* k) {
            const std::string* a = e.attr(k);
            return a ? std::strtod(a->c_str(), nullptr) : 0.0;
          };
          q.traits.push_back({val("x1"), val("y1"), val("x2"), val("y2")});
        }
        if (!choisie) continue;
        for (auto& a : e.at) {
          if (a.first == "class") {
            if (a.second.rfind("mepDimL", 0) == 0 || a.second.rfind("mepDimT", 0) == 0) a.second += " mepDimSel";
          } else if ((a.first == "marker-start" || a.first == "marker-end") && a.second.find("mepArr") != std::string::npos && a.second.find("Sel") == std::string::npos) {
            a.second.insert(a.second.size() - 1, "Sel");
          }
        }
      }
      try {
        ceQuiSaisitLaCote(c, d, q);
      } catch (const std::exception&) {
      }
      calc.cotesVues[idc] = std::move(q);
    }
  try {
    dessinerBulles(c);
  } catch (const std::exception&) {
  }
  if (vrai(sh, "sk")) dessinerEsquisse(c, sh["sk"], 0, 0, true);
  return out;
}

// ---- Les gestes de la souris ----
J* vueParId(J& sh, const std::string& id) {
  if (sh.contains("views") && sh["views"].is_array())
    for (J& v : sh["views"])
      if (chaine(v, "id") == id) return &v;
  return nullptr;
}
J* coteParId(J& sh, const std::string& id) {
  if (sh.contains("dims") && sh["dims"].is_array())
    for (J& v : sh["dims"])
      if (chaine(v, "id") == id) return &v;
  return nullptr;
}
J* bulleParId(J& sh, const std::string& id) {
  if (sh.contains("balloons") && sh["balloons"].is_array())
    for (J& v : sh["balloons"])
      if (chaine(v, "id") == id) return &v;
  return nullptr;
}
bool boiteDeVue(const J& v, const J& sh, const J& mep, const Piece& p, Calcul& c, double& x, double& y, double& w, double& h) {
  const Geo& g = c.geoDe(v, sh, mep, p);
  Boite b;
  if (!boiteVue(v, g, b)) return false;
  x = b.x, y = b.y, w = b.w, h = b.h;
  return true;
}
std::string vueSous(const J& sh, const J& mep, const Piece& p, Calcul& c, double sx, double sy) {
  std::string best;
  double aire = 1e18;
  const J& vs = sous(sh, "views");
  if (!vs.is_array()) return best;
  for (const J& v : vs) {
    double x, y, w, h;
    if (!boiteDeVue(v, sh, mep, p, c, x, y, w, h)) continue;
    const double pad = 2;
    if (sx >= x - pad && sx <= x + w + pad && sy >= y - pad && sy <= y + h + pad) {
      const double a = (w + pad * 2) * (h + pad * 2);
      if (a < aire) aire = a, best = chaine(v, "id");
    }
  }
  return best;
}
std::string titreSous(const J& sh, const J& mep, const Piece& p, Calcul& c, double px, double py, double zoom, double& ecartY) {
  const J& vs = sous(sh, "views");
  if (!vs.is_array()) return "";
  const double tol = 1.5 / zoom, lh = styleCotes(mep).lblH;
  const double fs = js::arrondi(lh / CAP_RATIO, 3);
  for (size_t i = vs.size(); i-- > 0;) {
    const J& v = vs[i];
    const std::string txt = texteTitreVue(v);
    if (txt.empty()) continue;
    double x, y, w, h;
    if (!boiteDeVue(v, sh, mep, p, c, x, y, w, h)) continue;
    const J& t = sous(v, "ttl");
    const double gap = t.is_object() && t.contains("gap") && std::isfinite(nv(t["gap"], NAN)) ? nv(t["gap"]) : 5;
    const double tx0 = x + w / 2, ty = chaine(t, "side") == "above" ? y - gap : y + h + gap + lh;
    const double larg = longueurCar(txt) * fs * 0.64;
    if (std::abs(px - tx0) <= larg / 2 + tol && py >= ty - lh - tol && py <= ty + tol + 0.8) {
      ecartY = py - (ty - lh / 2);
      return chaine(v, "id");
    }
  }
  return "";
}
void deplacerTitre(J& sh, const J& mep, const Piece& p, Calcul& c, J& v, double y, double dy) {
  double x0, y0, w, h;
  if (!boiteDeVue(v, sh, mep, p, c, x0, y0, w, h)) return;
  const double lh = styleCotes(mep).lblH, tc = y - dy;
  const bool above = tc < y0 + h / 2;
  const double gap = std::max(1.0, std::floor((above ? y0 - tc - lh / 2 : tc - y0 - h - lh / 2) * 2 + 0.5) / 2);
  J t = J::object();
  t["side"] = above ? "above" : "below";
  t["gap"] = gap;
  v["ttl"] = t;
}
std::string coteSous(const J& sh, const Calcul& c, double sx, double sy, double zoom) {
  std::string best;
  double score = 1e18;
  const double bd = 6 / zoom, bdTxt = 18 / zoom;
  const J& ds = sous(sh, "dims");
  if (!ds.is_array()) return best;
  const auto segDist = [&](const CoteVue::Seg& s) {
    const double dx = s.x2 - s.x1, dy = s.y2 - s.y1, L2 = dx * dx + dy * dy;
    double t = 0;
    if (L2 > 1e-12) t = std::max(0.0, std::min(1.0, ((sx - s.x1) * dx + (sy - s.y1) * dy) / L2));
    return std::hypot(sx - (s.x1 + dx * t), sy - (s.y1 + dy * t));
  };
  for (const J& d : ds) {
    const auto it = c.cotesVues.find(chaine(d, "id"));
    if (it == c.cotesVues.end()) continue;
    double d1 = 1e9;
    for (const CoteVue::Seg& s : it->second.traits) d1 = std::min(d1, segDist(s));
    const double d2 = it->second.aTexte ? std::hypot(sx - it->second.tx, sy - it->second.ty) : 1e9;
    if (d1 < bd || d2 < bdTxt) {
      const double sc = std::min(d1 / bd, d2 / bdTxt);
      if (sc < score) score = sc, best = chaine(d, "id");
    }
  }
  return best;
}
std::string flecheSous(const J& sh, const Calcul& c, double sx, double sy, double zoom) {
  std::string best;
  double bd = 8 / zoom;
  const J& ds = sous(sh, "dims");
  if (!ds.is_array()) return best;
  for (const J& d : ds) {
    const std::string k = chaine(d, "kind");
    if (k != "len" && k != "dist") continue;
    const auto it = c.cotesVues.find(chaine(d, "id"));
    if (it == c.cotesVues.end() || !it->second.aFleches) continue;
    const double e = std::min(std::hypot(sx - it->second.fx1, sy - it->second.fy1), std::hypot(sx - it->second.fx2, sy - it->second.fy2));
    if (e < bd) bd = e, best = chaine(d, "id");
  }
  return best;
}
void pointBulle(const J& sh, const J& b, double& ax, double& ay) {
  const J* v = vueDe(sh, chaine(b, "view"));
  ax = ay = 0;
  if (!v) return;
  const Base B0 = baseDe(*v);
  const V3 q = v3(sous(b, "p"));
  ax = num(*v, "x") + dot(q, B0.u) * num(*v, "scale"), ay = num(*v, "y") + dot(q, B0.v) * num(*v, "scale");
}
std::string bulleSous(const J& sh, double x, double y) {
  const J& B = sous(sh, "balloons");
  if (!B.is_array()) return "";
  for (size_t k = B.size(); k-- > 0;) {
    if (!vueDe(sh, chaine(B[k], "view"))) continue;
    double ax, ay;
    pointBulle(sh, B[k], ax, ay);
    if (std::hypot(x - (ax + num(B[k], "dx")), y - (ay + num(B[k], "dy"))) <= 4.4) return chaine(B[k], "id");
  }
  return "";
}
namespace {
void suivreFilles(J& sh, const std::string& id, double dx, double dy) {  // mepProjFollow
  for (J& c : sh["views"])
    if ((chaine(c, "kind") == "proj" || vrai(c, "align")) && chaine(c, "parent") == id) {
      c["x"] = num(c, "x") + dx;
      c["y"] = num(c, "y") + dy;
      suivreFilles(sh, chaine(c, "id"), dx, dy);
    }
}
}  // namespace
void deplacerVue(J& sh, J& v, double nx, double ny) {
  const std::string kind = chaine(v, "kind");
  const double x0 = num(v, "x"), y0 = num(v, "y");
  if (vrai(v, "align") && kind != "proj") {
    // coupe / auxiliaire alignées : glissement sur la ligne de rappel
    const double ax = num(v["align"], "x"), ay = num(v["align"], "y");
    const double t = (nx - x0) * ax + (ny - y0) * ay;
    nx = x0 + t * ax, ny = y0 + t * ay;
  }
  if (kind == "proj") {
    // vue projetée : l'axe commun reste verrouillé sur la mère
    if (const J* par = vueDe(sh, chaine(v, "parent"))) {
      const std::string pr = chaine(v, "proj");
      if (pr == "top" || pr == "bottom") nx = num(*par, "x");
      else ny = num(*par, "y");
    }
  }
  const double dx = nx - x0, dy = ny - y0;
  v["x"] = nx;
  v["y"] = ny;
  if (std::abs(dx) > 1e-9 || std::abs(dy) > 1e-9) suivreFilles(sh, chaine(v, "id"), dx, dy);
}
void supprimerVue(J& sh, const std::string& id) {
  J vs = J::array(), ds = J::array();
  for (J& v : sh["views"])
    if (chaine(v, "id") != id && chaine(v, "parent") != id) vs.push_back(std::move(v));
  if (sh.contains("dims") && sh["dims"].is_array())
    for (J& d : sh["dims"])
      if (chaine(d, "vid") != id && chaine(d, "vid2") != id) ds.push_back(std::move(d));
  sh["views"] = std::move(vs);
  sh["dims"] = std::move(ds);
}
void supprimerVues(J& sh, const std::set<std::string>& ids) {
  std::set<std::string> gone = ids;
  bool grew = true;
  while (grew) {
    grew = false;
    for (const J& v : sh["views"])
      if (vrai(v, "parent") && gone.count(chaine(v, "parent")) && !gone.count(chaine(v, "id"))) {
        gone.insert(chaine(v, "id"));
        grew = true;
      }
  }
  J vs = J::array(), ds = J::array();
  for (J& v : sh["views"])
    if (!gone.count(chaine(v, "id"))) vs.push_back(std::move(v));
  if (sh.contains("dims") && sh["dims"].is_array())
    for (J& d : sh["dims"])
      if (!gone.count(chaine(d, "vid")) && !gone.count(chaine(d, "vid2"))) ds.push_back(std::move(d));
  sh["views"] = std::move(vs);
  sh["dims"] = std::move(ds);
}
bool cartoucheDessine(const J& sh) { return cartoucheEsquisse(sh); }
double largeurCartouche(const J& sh) {
  const Page pd = pageDe(sh);
  if (!cartoucheEsquisse(sh)) return pd.iw;
  double mx, my;
  tbBoite(sh["title"]["tb"]["sk"], pd.W - pd.fr.l - pd.fr.r, pd.H - pd.fr.t - pd.fr.b, mx, my);
  return std::max(0.0, -mx);
}
std::vector<RangNomenclature> rangsNomenclature(J& mep, int planche, const Piece& p, Calcul& calc) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  std::vector<RangNomenclature> o;
  for (const LigneBom& l : lignesBom(c)) o.push_back({l.id, l.name, static_cast<int>(l.qty)});
  return o;
}
Ctx contexteGeste(J& mep, int planche, const Piece& p, Calcul& calc) {
  static std::vector<Elt> poubelle;
  poubelle.clear();
  Ctx c{poubelle, mep, mep["sheets"][planche], planche, p, calc};
  c.st = styleCotes(mep);
  return c;
}
GesteCote saisirCote(J& mep, int planche, const Piece& p, Calcul& calc, J& d, double x, double y, double zoom) {
  std::vector<Elt> poubelle;
  J& sh = mep["sheets"][planche];
  Ctx c{poubelle, mep, sh, planche, p, calc};
  c.st = styleCotes(mep);
  return saisirCoteDans(c, d, x, y, zoom);
}
bool deplacerCote(J& mep, int planche, const Piece& p, Calcul& calc, J& d, double x, double y, const GesteCote& g) {
  std::vector<Elt> poubelle;
  J& sh = mep["sheets"][planche];
  Ctx c{poubelle, mep, sh, planche, p, calc};
  c.st = styleCotes(mep);
  return deplacerCoteDans(c, d, x, y, g);
}
void inverserAngle(J& mep, int planche, const Piece& p, Calcul& calc, J& d) {
  std::vector<Elt> poubelle;
  J& sh = mep["sheets"][planche];
  Ctx c{poubelle, mep, sh, planche, p, calc};
  c.st = styleCotes(mep);
  inverserAngleDans(c, d);
}

std::string versSvg(const std::vector<Elt>& e, const J& planche, const Style& s) {
  (void)s;
  double W, H;
  pageWH(planche, W, H);
  std::ostringstream o;
  const auto ech = [](const std::string& t) {
    std::string r;
    for (char ch : t) {
      if (ch == '&') r += "&amp;";
      else if (ch == '<') r += "&lt;";
      else if (ch == '>') r += "&gt;";
      else if (ch == '"') r += "&quot;";
      else r += ch;
    }
    return r;
  };
  o << "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " << tx(W) << " " << tx(H) << "\" width=\"" << tx(W) << "mm\" height=\"" << tx(H) << "mm\">\n";
  for (size_t i = 0; i < e.size(); i++) {
    const Elt& x = e[i];
    if (x.aide) continue;
    o << "<" << x.tag;
    for (const auto& a : x.at) o << " " << a.first << "=\"" << ech(a.second) << "\"";
    const int suite = i + 1 < e.size() ? e[i + 1].niveau : 0;
    o << ">" << ech(x.txt);
    // Les éléments de niveau supérieur qui suivent sont ses enfants
    if (suite > x.niveau) continue;
    o << "</" << x.tag << ">";
    for (int n = x.niveau; n > suite; n--) o << (n == 2 ? "</tspan>" : "</text>");
    o << "\n";
  }
  o << "</svg>\n";
  return o.str();
}
void surfaceUtile(const J& sh, double& ix, double& iy, double& iw, double& ih) {
  const Page p = pageDe(sh);
  ix = p.ix, iy = p.iy, iw = p.iw, ih = p.ih;
}
}  // namespace plan
