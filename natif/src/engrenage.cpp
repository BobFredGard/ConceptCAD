// Traduction de gearGeom, gearOutline, gearSolid (src/48-engrenages-calcul, src/76-engrenage)
#include "engrenage.h"

#include <BRepAdaptor_Surface.hxx>
#include <BRepAlgoAPI_Common.hxx>
#include <BRepBuilderAPI_MakeEdge.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakeSolid.hxx>
#include <BRepBuilderAPI_MakeWire.hxx>
#include <BRepBuilderAPI_Sewing.hxx>
#include <BRepGProp.hxx>
#include <BRepLib.hxx>
#include <BRepOffsetAPI_MakePipeShell.hxx>
#include <BRepPrimAPI_MakeBox.hxx>
#include <BRepPrimAPI_MakePrism.hxx>
#include <BRepTools.hxx>
#include <GProp_GProps.hxx>
#include <Geom2d_Line.hxx>
#include <Geom_BSplineCurve.hxx>
#include <Geom_CylindricalSurface.hxx>
#include <ShapeFix_Face.hxx>
#include <TColStd_Array1OfInteger.hxx>
#include <TColStd_Array1OfReal.hxx>
#include <TColgp_Array1OfPnt.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Wire.hxx>
#include <gp_Ax2.hxx>
#include <gp_Ax3.hxx>
#include <gp_Circ.hxx>
#include <gp_Pnt2d.hxx>
#include <gp_Vec.hxx>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <functional>
#include <optional>
#include <stdexcept>

#include "nombres_js.h"

namespace {
const double PI = 3.141592653589793;
const int FLANK_SEG = 6, ROOT_SEG = 32;
const double PHI_MIN = 0.01;  // la développante part du cercle de base avec une tangente nulle : on la prend juste au-dessus

using P2 = std::array<double, 2>;
double inv(double a) { return std::tan(a) - a; }
double roundJs(double v) { return std::floor(v + 0.5); }
std::string fr(double v) {
  std::string s = js::texte(js::arrondi(v, 2));
  std::replace(s.begin(), s.end(), '.', ',');
  return s;
}

struct Courbe {  // B-spline cubique C1
  std::vector<P2> poles;
  std::vector<double> knots;
  std::vector<int> mults;
};
struct Seg {
  enum { LN, ARC, BS } k = LN;
  P2 a{}, b{};
  double r = 0, a0 = 0, a1 = 0;
  Courbe c;
};
struct Hermite {
  P2 p, d;
};
// gearHermite : construite sur les valeurs et les tangentes, à pas constant, nœuds doubles
Courbe hermite(const std::function<Hermite(double)>& fn, double t0, double t1, int n) {
  Courbe C;
  const double h = (t1 - t0) / n;
  for (int i = 0; i <= n; i++) {
    const double t = t0 + i * h;
    const Hermite P = fn(t);
    C.knots.push_back(t);
    C.mults.push_back(i == 0 || i == n ? 4 : 2);
    if (i == 0) C.poles.push_back(P.p);
    if (i > 0) C.poles.push_back({P.p[0] - P.d[0] * h / 3, P.p[1] - P.d[1] * h / 3});
    if (i < n) C.poles.push_back({P.p[0] + P.d[0] * h / 3, P.p[1] + P.d[1] * h / 3});
    if (i == n) C.poles.push_back(P.p);
  }
  return C;
}

GeoEngrenage geoCremaillere(const ReglageEngrenage& o) {
  GeoEngrenage g;
  g.rack = true;
  const double m = o.m;
  const double zr = roundJs(o.z);
  g.aDeg = o.alpha;
  g.b = o.b;
  g.betaDeg = o.beta;
  g.hand = o.hand == "L" ? "L" : "R";
  g.j = o.j;
  if (!(m > 0)) throw std::runtime_error("module invalide");
  if (!(zr >= 1)) throw std::runtime_error("il faut au moins une dent");
  if (!(g.aDeg > 0 && g.aDeg < 38)) throw std::runtime_error("angle de pression invalide");
  if (!(g.b > 0)) throw std::runtime_error("largeur invalide");
  if (!(g.betaDeg >= 0 && g.betaDeg <= 45)) throw std::runtime_error("angle d'hélice invalide");
  g.m = m;
  g.z = static_cast<int>(zr);
  g.a = g.aDeg * PI / 180;
  const double ca = std::cos(g.a), ta = std::tan(g.a);
  g.beta = g.betaDeg * PI / 180;
  g.cb = std::cos(g.beta);
  const double tb = std::tan(g.beta);
  g.rho = m * std::min(0.38, (PI / 4 - 1.25 * ta) / (1 / ca - ta));
  g.dC = 1.25 * m - g.rho;
  g.H = o.H > 0 ? o.H : 3 * m;
  g.uTip = PI * m / 4 - m * ta - g.j / 2;
  if (!(g.uTip > 0)) throw std::runtime_error("jeu trop grand : la dent n'a plus de sommet");
  g.at = g.betaDeg != 0 ? std::atan(ta / g.cb) : g.a;
  g.mt = m / g.cb;
  g.ya = m;
  g.yf = -1.25 * m;
  g.yb = -1.25 * m - g.H;
  g.pitch = PI * m;
  g.pt = PI * m / g.cb;
  g.L = g.z * PI * m / g.cb;
  g.uC = PI * m / 4 - g.j / 2 + g.dC * ta + g.rho / ca;
  g.thick = PI * m / 2 - g.j;
  g.shift = (g.hand == "L" ? 1 : -1) * g.b * tb;
  g.overlap = g.b * std::sin(g.beta) / (PI * m);
  return g;
}

std::vector<Seg> contourCremaillere(const GeoEngrenage& g, int k) {  // gearRackOutline
  const double pm = g.pitch, ta = std::tan(g.a), sa = std::sin(g.a), ca = std::cos(g.a);
  const auto X = [&](double u) { return u / g.cb; };
  std::vector<Seg> out;
  const double uEnd = (g.z / 2.0 + k) * pm, xr = X(uEnd), xl = -xr, uT = g.uC - g.rho * ca, yT = -(g.dC + g.rho * sa);
  (void)ta;
  P2 cur = {xl, g.yb};
  const auto to = [&](const P2& q) {
    if (std::hypot(q[0] - cur[0], q[1] - cur[1]) > 1e-9) {
      Seg s;
      s.k = Seg::LN;
      s.a = cur;
      s.b = q;
      out.push_back(s);
    }
    cur = q;
  };
  const double t0 = -PI / 2, t1 = g.a - PI, dt = t1 - t0;
  const Courbe F = hermite([&](double s) -> Hermite {
    const double t = t0 + dt * s;
    return {{X(g.uC + g.rho * std::cos(t)), -g.dC + g.rho * std::sin(t)}, {-X(g.rho * std::sin(t)) * dt, g.rho * std::cos(t) * dt}};
  }, 0, 1, 4);
  const auto droite = [&](double c) {
    Seg s;
    s.k = Seg::BS;
    s.c = F;
    for (P2& q : s.c.poles) q[0] += c;
    return s;
  };
  const auto gauche = [&](double c) {
    Seg s;
    s.k = Seg::BS;
    s.c = F;
    std::reverse(s.c.poles.begin(), s.c.poles.end());
    for (P2& q : s.c.poles) q[0] = c - q[0];
    return s;
  };
  to({xr, g.yb});
  to({xr, g.yf});
  for (int i = g.z - 1 + k; i >= -k; i--) {
    const double u = (i - g.z / 2.0 + 0.5) * pm, c = X(u);
    to({X(u + g.uC), g.yf});
    out.push_back(droite(c));
    cur = {X(u + uT), yT};
    to({X(u + g.uTip), g.ya});
    to({X(u - g.uTip), g.ya});
    to({X(u - uT), yT});
    out.push_back(gauche(c));
    cur = {X(u - g.uC), g.yf};
  }
  to({xl, g.yf});
  to({xl, g.yb});
  return out;
}

Hermite flancEn(const GeoEngrenage& g, double phi) {  // gearFlankAt
  const double c = std::cos(phi), s = std::sin(phi), C = std::cos(-g.psiB), S = std::sin(-g.psiB);
  const auto rot = [&](double x, double y) { return P2{x * C - y * S, x * S + y * C}; };
  return {rot(g.rb * (c + phi * s), g.rb * (s - phi * c)), rot(g.rb * phi * c, g.rb * phi * s)};
}
P2 piedEn(const GeoEngrenage& g, double gam) {  // gearRootAt
  const double qh = g.x * g.m - g.dC - g.rho * std::sin(gam), qy = g.yC + g.rho * std::cos(gam) / g.cb;
  const double y0 = qy + qh * g.cb / std::tan(gam), th = -y0 / g.rp, X = g.rp + qh, Y = qy - y0, c = std::cos(th), s = std::sin(th);
  return {X * c + Y * s, -X * s + Y * c};
}
std::optional<double> croisement(const GeoEngrenage& g) {  // gearCrossing
  const auto angleFlanc = [&](double r) { return -g.psiB + inv(std::acos(g.rb / r)); };
  const double rMin = g.rb * std::hypot(1.0, PHI_MIN);
  const auto D = [&](double gam) -> std::optional<double> {
    const P2 q = piedEn(g, gam);
    const double r = std::hypot(q[0], q[1]);
    if (r < rMin) return std::nullopt;
    return std::atan2(q[1], q[0]) - angleFlanc(r);
  };
  const int N = 600;
  const double g0 = PI / 2, g1 = g.a;
  double prev = g0;
  for (int i = 1; i <= N; i++) {
    const double gam = g0 + (g1 - g0) * i / N;
    const auto d = D(gam);
    if (d && *d <= 0) {
      double lo = prev, hi = gam;
      for (int k = 0; k < 60; k++) {
        const double mid = (lo + hi) / 2;
        const auto v = D(mid);
        if (v && *v <= 0) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    prev = gam;
  }
  // φF tout juste nul : le pied s'arrête sur le cercle de base, là où la développante commence
  const P2 qE = piedEn(g, g1), S = flancEn(g, PHI_MIN).p;
  if (std::hypot(qE[0] - S[0], qE[1] - S[1]) < 1e-3 * g.m) return g1;
  return std::nullopt;
}
struct Profil {
  Courbe flank, root;  // couronne : root est l'arc qui raccorde le flanc au pied
};
Profil profilCouronne(const GeoEngrenage& g) {  // gearProfileInt
  const double phi0 = std::sqrt((g.ra / g.rb) * (g.ra / g.rb) - 1), phiMax = std::sqrt((g.rf / g.rb) * (g.rf / g.rb) - 1);
  const auto centre = [&](double phi, double rho) {
    const Hermite F = flancEn(g, phi);
    const double L = std::hypot(F.d[0], F.d[1]);
    return P2{F.p[0] - rho * F.d[1] / L, F.p[1] + rho * F.d[0] / L};
  };
  double rho = g.rho, phiT = 0;
  bool trouve = false;
  P2 C{};
  for (int k = 0; k < 40; k++, rho *= 0.85) {
    double lo = phi0, hi = phiMax;
    const auto ecart = [&](double phi) {
      const P2 c = centre(phi, rho);
      return std::hypot(c[0], c[1]) - (g.rf - rho);
    };
    if (ecart(lo) < 0 && ecart(hi) > 0) {
      for (int i = 0; i < 70; i++) {
        const double mid = (lo + hi) / 2;
        if (ecart(mid) < 0) lo = mid;
        else hi = mid;
      }
      const P2 c = centre(hi, rho);
      if (c[1] < -1e-4 * g.m) {
        phiT = hi;
        C = c;
        trouve = true;
        break;
      }
    }
  }
  if (!trouve) throw std::runtime_error("creux trop étroit : le pied de dent ne se raccorde pas");
  Profil P;
  P.flank = hermite([&](double phi) { return flancEn(g, phi); }, phi0, phiT, FLANK_SEG);
  const P2 T = P.flank.poles.back();
  const double kr = g.rf / std::hypot(C[0], C[1]);
  const P2 R = {C[0] * kr, C[1] * kr};
  const double a0 = std::atan2(T[1] - C[1], T[0] - C[0]);
  double a1 = std::atan2(R[1] - C[1], R[0] - C[0]);
  while (a1 <= a0) a1 += 2 * PI;
  P.root = hermite([&](double t) -> Hermite { return {{C[0] + rho * std::cos(t), C[1] + rho * std::sin(t)}, {-rho * std::sin(t), rho * std::cos(t)}}; }, a0, a1, 4);
  P.root.poles.front() = T;
  P.root.poles.back() = R;
  return P;
}
Profil profilRoue(const GeoEngrenage& g) {  // gearProfile
  if (g.internal) return profilCouronne(g);
  const double phi1 = std::sqrt((g.ra / g.rb) * (g.ra / g.rb) - 1);
  double gamE = g.a, phi0 = g.phiF;
  if (g.phiF < PHI_MIN) {
    const auto c = croisement(g);
    if (!c) throw std::runtime_error("sous-coupe : le pied de dent ne rejoint pas le flanc");
    gamE = *c;
    const P2 q = piedEn(g, gamE);
    phi0 = std::max(PHI_MIN, std::sqrt(std::max(0.0, (q[0] * q[0] + q[1] * q[1]) / (g.rb * g.rb) - 1)));
  }
  if (!(phi0 < phi1 - 1e-6)) throw std::runtime_error("il ne reste plus de flanc : sous-coupe totale ou déport excessif");
  Profil P;
  P.flank = hermite([&](double phi) { return flancEn(g, phi); }, phi0, phi1, FLANK_SEG);
  const auto G = [&](double t) { return PI / 2 + (gamE - PI / 2) * t; };
  const double e = 1e-5;
  P.root = hermite([&](double t) -> Hermite {
    const P2 a = piedEn(g, G(t - e)), b = piedEn(g, G(t + e));
    return {piedEn(g, G(t)), {(b[0] - a[0]) / (2 * e), (b[1] - a[1]) / (2 * e)}};
  }, 0, 1, ROOT_SEG);
  P.root.poles.back() = P.flank.poles.front();
  return P;
}
std::vector<Seg> contourRoue(const GeoEngrenage& g) {  // gearOutline
  const Profil P = profilRoue(g);
  const auto rot = [](const P2& q, double c) {
    const double C = std::cos(c), S = std::sin(c);
    return P2{q[0] * C - q[1] * S, q[0] * S + q[1] * C};
  };
  const auto fwd = [&](const Courbe& K, double c) {
    Seg s;
    s.k = Seg::BS;
    s.c = K;
    for (P2& q : s.c.poles) q = rot(q, c);
    return s;
  };
  const auto rev = [&](const Courbe& K, double c) {
    Seg s;
    s.k = Seg::BS;
    s.c = K;
    std::reverse(s.c.poles.begin(), s.c.poles.end());
    for (P2& q : s.c.poles) q = rot({q[0], -q[1]}, c);
    const size_t n = K.knots.size();
    for (size_t i = 0; i < n; i++) s.c.knots[i] = K.knots[0] + K.knots[n - 1] - K.knots[n - 1 - i];
    return s;
  };
  const auto arc = [](double r, double a0, double a1) {
    Seg s;
    s.k = Seg::ARC;
    s.r = r;
    s.a0 = a0;
    s.a1 = a1;
    return s;
  };
  std::vector<Seg> out;
  const double step = 2 * PI / g.z;
  if (g.internal) {
    const P2 S = P.flank.poles.front(), R = P.root.poles.back();
    const double aS = std::atan2(S[1], S[0]), aR = std::atan2(R[1], R[0]);
    for (int i = 0; i < g.z; i++) {
      const double c = i * step;
      out.push_back(fwd(P.flank, c));
      out.push_back(fwd(P.root, c));
      out.push_back(arc(g.rf, c + aR, c - aR));
      out.push_back(rev(P.root, c));
      out.push_back(rev(P.flank, c));
      out.push_back(arc(g.ra, c - aS, c + step + aS));
    }
    return out;
  }
  const P2 Se = P.flank.poles.back(), R0 = P.root.poles.front();
  const double angE = std::atan2(Se[1], Se[0]), ang0 = std::atan2(R0[1], R0[0]);
  for (int i = 0; i < g.z; i++) {
    const double c = i * step;
    out.push_back(fwd(P.root, c));
    out.push_back(fwd(P.flank, c));
    out.push_back(arc(g.ra, c + angE, c - angE));
    out.push_back(rev(P.flank, c));
    out.push_back(rev(P.root, c));
    // fond de dent : absent quand l'outil a une tête toute ronde
    if (step + 2 * ang0 > 1e-7) out.push_back(arc(g.rf, c - ang0, c + step + ang0));
  }
  return out;
}

TopoDS_Wire filDe(const std::vector<Seg>& contour) {  // gearWire
  const gp_Ax2 ax(gp_Pnt(0, 0, 0), gp_Dir(0, 0, 1));
  BRepBuilderAPI_MakeWire mk;
  for (const Seg& s : contour) {
    TopoDS_Edge e;
    if (s.k == Seg::LN) {
      BRepBuilderAPI_MakeEdge me(gp_Pnt(s.a[0], s.a[1], 0), gp_Pnt(s.b[0], s.b[1], 0));
      if (!me.IsDone()) throw std::runtime_error("arête de denture impossible");
      e = me.Edge();
    } else if (s.k == Seg::ARC) {
      const gp_Circ circ(ax, s.r);
      BRepBuilderAPI_MakeEdge me(circ, gp_Pnt(s.r * std::cos(s.a0), s.r * std::sin(s.a0), 0), gp_Pnt(s.r * std::cos(s.a1), s.r * std::sin(s.a1), 0));
      if (!me.IsDone()) throw std::runtime_error("arête de denture impossible");
      e = me.Edge();
    } else {
      TColgp_Array1OfPnt poles(1, static_cast<int>(s.c.poles.size()));
      for (size_t i = 0; i < s.c.poles.size(); i++) poles.SetValue(static_cast<int>(i) + 1, gp_Pnt(s.c.poles[i][0], s.c.poles[i][1], 0));
      TColStd_Array1OfReal kn(1, static_cast<int>(s.c.knots.size()));
      TColStd_Array1OfInteger mu(1, static_cast<int>(s.c.knots.size()));
      for (size_t i = 0; i < s.c.knots.size(); i++) {
        kn.SetValue(static_cast<int>(i) + 1, s.c.knots[i]);
        mu.SetValue(static_cast<int>(i) + 1, s.c.mults[i]);
      }
      occ::handle<Geom_BSplineCurve> courbe = new Geom_BSplineCurve(poles, kn, mu, 3, false);
      BRepBuilderAPI_MakeEdge me(courbe);
      if (!me.IsDone()) throw std::runtime_error("arête de denture impossible");
      e = me.Edge();
    }
    mk.Add(e);
  }
  mk.Build();
  if (!mk.IsDone()) throw std::runtime_error("contour de denture non fermé");
  return mk.Wire();
}

TopoDS_Shape solideHelice(const GeoEngrenage& g) {  // gearHelixSolid
  const gp_Pnt O(0, 0, 0);
  occ::handle<Geom_CylindricalSurface> surf = new Geom_CylindricalSurface(gp_Ax3(O, gp_Dir(0, 0, 1), gp_Dir(1, 0, 0)), g.rp);
  occ::handle<Geom2d_Line> ligne = new Geom2d_Line(gp_Pnt2d(0, 0), gp_Dir2d(g.twist, g.b));
  BRepBuilderAPI_MakeEdge me(ligne, surf, 0, std::hypot(g.twist, g.b));
  if (!me.IsDone()) throw std::runtime_error("hélice de la denture impossible");
  TopoDS_Edge he = me.Edge();
  BRepLib::BuildCurves3d(he);
  const TopoDS_Wire hw = BRepBuilderAPI_MakeWire(he).Wire();
  const TopoDS_Wire sw = BRepBuilderAPI_MakeWire(BRepBuilderAPI_MakeEdge(O, gp_Pnt(0, 0, g.b)).Edge()).Wire();
  BRepOffsetAPI_MakePipeShell ps(sw);
  ps.SetMode(hw, false, BRepFill_NoContact);
  ps.Add(filDe(contourRoue(g)), false, false);
  ps.Build();
  if (!ps.IsDone()) throw std::runtime_error("balayage de la denture hélicoïdale impossible");
  if (!ps.MakeSolid()) throw std::runtime_error("denture hélicoïdale : le solide ne se ferme pas");
  return ps.Shape();
}
TopoDS_Face baseCouronne(const GeoEngrenage& g, double z, const TopoDS_Wire& inner) {  // gearRingFace
  const gp_Circ c(gp_Ax2(gp_Pnt(0, 0, z), gp_Dir(0, 0, 1)), g.D / 2);
  const TopoDS_Wire w = BRepBuilderAPI_MakeWire(BRepBuilderAPI_MakeEdge(c).Edge()).Wire();
  BRepBuilderAPI_MakeFace mf(w, true);
  mf.Add(TopoDS::Wire(inner.Reversed()));
  mf.Build();
  if (!mf.IsDone()) throw std::runtime_error("base de couronne impossible");
  ShapeFix_Face fx(mf.Face());
  fx.FixOrientation();
  return fx.Face();
}
TopoDS_Shape solideCouronne(const GeoEngrenage& g) {  // gearRingSolid
  if (g.betaDeg == 0) {
    BRepPrimAPI_MakePrism pr(baseCouronne(g, 0, filDe(contourRoue(g))), gp_Vec(0, 0, g.b), false, true);
    pr.Build();
    if (!pr.IsDone()) throw std::runtime_error("extrusion de la couronne impossible");
    return pr.Shape();
  }
  const TopoDS_Shape bouchon = solideHelice(g);
  BRepBuilderAPI_Sewing sew(1e-4, true, true, true, false);
  for (TopExp_Explorer ex(bouchon, TopAbs_FACE); ex.More(); ex.Next()) {
    const TopoDS_Face F = TopoDS::Face(ex.Current());
    if (BRepAdaptor_Surface(F, true).GetType() != GeomAbs_Plane) {
      sew.Add(F);
      continue;
    }
    GProp_GProps P;
    BRepGProp::SurfaceProperties(F, P, false, false);
    sew.Add(baseCouronne(g, P.CentreOfMass().Z(), BRepTools::OuterWire(F)));
  }
  const gp_Circ c(gp_Ax2(gp_Pnt(0, 0, 0), gp_Dir(0, 0, 1)), g.D / 2);
  BRepPrimAPI_MakePrism cote(BRepBuilderAPI_MakeEdge(c).Edge(), gp_Vec(0, 0, g.b), false, true);
  cote.Build();
  sew.Add(cote.Shape());
  sew.Perform();
  if (sew.NbFreeEdges() > 0) throw std::runtime_error("couronne non fermée (" + std::to_string(sew.NbFreeEdges()) + " arêtes libres)");
  TopExp_Explorer ex(sew.SewedShape(), TopAbs_SHELL);
  if (!ex.More()) throw std::runtime_error("coque de couronne introuvable");
  BRepBuilderAPI_MakeSolid ms;
  ms.Add(TopoDS::Shell(ex.Current()));
  TopoDS_Shape sol = ms.Solid();
  GProp_GProps gp;
  BRepGProp::VolumeProperties(sol, gp, false, false, false);
  if (gp.Mass() < 0) sol = sol.Reversed();
  return sol;
}
TopoDS_Shape solideCremaillere(const GeoEngrenage& g) {  // gearRackSolid
  const int extra = g.betaDeg != 0 ? static_cast<int>(std::ceil(std::abs(g.shift) / g.pt)) + 1 : 0;
  BRepBuilderAPI_MakeFace mf(filDe(contourCremaillere(g, extra)), true);
  if (!mf.IsDone()) throw std::runtime_error("face de crémaillère impossible");
  BRepPrimAPI_MakePrism pr(mf.Face(), gp_Vec(g.betaDeg != 0 ? g.shift : 0, 0, g.b), false, true);
  pr.Build();
  if (!pr.IsDone()) throw std::runtime_error("extrusion de la crémaillère impossible");
  if (g.betaDeg == 0) return pr.Shape();
  BRepPrimAPI_MakeBox box(gp_Pnt(-g.L / 2, g.yb - 1, -1), gp_Pnt(g.L / 2, g.ya + 1, g.b + 1));
  BRepAlgoAPI_Common c(pr.Shape(), box.Shape());
  if (!c.IsDone()) throw std::runtime_error("coupe des bouts de la crémaillère impossible");
  return c.Shape();
}
}  // namespace

GeoEngrenage geoEngrenage(const ReglageEngrenage& o) {
  if (o.kind == "rack") return geoCremaillere(o);
  GeoEngrenage g;
  const double m = o.m, zr = roundJs(o.z);
  g.m = m;
  g.aDeg = o.alpha;
  g.b = o.b;
  g.x = o.x;
  g.betaDeg = o.beta;
  g.hand = o.hand == "L" ? "L" : "R";
  g.j = o.j;
  g.ks = o.ks;
  if (!(m > 0)) throw std::runtime_error("module invalide");
  if (!(zr >= 6)) throw std::runtime_error("il faut au moins 6 dents");
  if (!(g.aDeg > 0 && g.aDeg < 45)) throw std::runtime_error("angle de pression invalide");
  if (!(g.b > 0)) throw std::runtime_error("largeur invalide");
  if (!(g.betaDeg >= 0 && g.betaDeg <= 45)) throw std::runtime_error("angle d'hélice invalide");
  g.z = static_cast<int>(zr);
  const int z = g.z;
  const double x = g.x, js = g.j, ks = g.ks;
  g.a = g.aDeg * PI / 180;
  const double ca = std::cos(g.a), sa = std::sin(g.a), ta = std::tan(g.a);
  g.beta = g.betaDeg * PI / 180;
  g.cb = std::cos(g.beta);
  const double tb = std::tan(g.beta), cb = g.cb;
  g.at = g.betaDeg != 0 ? std::atan(ta / cb) : g.a;
  g.mt = m / cb;
  g.twist = (g.hand == "L" ? -1 : 1) * g.b * tb / (g.mt * z / 2);
  g.overlap = g.b * std::sin(g.beta) / (PI * m);
  g.rp = g.mt * z / 2;
  g.rb = g.rp * std::cos(g.at);
  g.pitch = PI * m;
  g.pitchB = PI * g.mt * std::cos(g.at);
  g.thick = m * (PI / 2 + 2 * x * ta) - js;
  if (o.kind == "int") {
    g.internal = true;
    g.rf = g.rp + m * (1.25 - x);
    const double rTip = g.rp - m * (1 + x - ks), rMin = g.rb * std::hypot(1.0, PHI_MIN);
    g.ra = std::max(rTip, rMin);
    if (!(g.rf > g.ra)) throw std::runtime_error("déport trop grand : il ne reste plus de flanc");
    g.psiB = PI / (2 * z) + inv(g.at) - 2 * x * ta / z + js / (2 * cb * g.rp);
    if (!(g.psiB - inv(std::acos(g.rb / g.rf)) > 0)) throw std::runtime_error("creux en pointe : le fond de dent n'a plus de largeur, augmentez le déport");
    g.psiTip = PI / z - (g.psiB - inv(std::acos(g.rb / g.ra)));
    if (!(g.psiTip > 0)) throw std::runtime_error("dent en pointe : son sommet n'a plus de largeur, augmentez le déport");
    g.D = o.D > 0 ? o.D : std::ceil(2 * (g.rf + 3 * m));
    if (!(g.D > 2 * g.rf)) throw std::runtime_error("Ø extérieur trop petit : il atteint le pied de dent (Ø " + fr(2 * g.rf) + ")");
    g.tipCut = rTip < rMin;
    g.xMaxFull = (g.rp - g.rb) / m - 1;
    g.space = m * (PI / 2 - 2 * x * ta) + js;
    g.rho = 0.38 * m;
    g.tipThick = 2 * g.psiTip * g.ra * std::cos(std::atan(g.ra / g.rp * tb));
    return g;
  }
  g.ra = g.rp + m * (1 + x - ks);
  g.rf = g.rp - m * (1.25 - x);
  if (!(g.rf > 0)) throw std::runtime_error("déport trop négatif : le cercle de pied disparaît");
  g.psiB = PI / (2 * z) + inv(g.at) + 2 * x * ta / z - js / (2 * cb * g.rp);
  const double aTip = std::acos(std::min(1.0, g.rb / g.ra));
  g.psiTip = g.psiB - inv(aTip);
  if (!(g.psiTip > 0)) throw std::runtime_error("dent en pointe : son sommet n'a plus de largeur, réduisez le déport");
  g.rho = m * std::min(0.38, (PI / 4 - 1.25 * ta) / (1 / ca - ta));
  g.dC = 1.25 * m - g.rho;
  g.yC = (-PI * m / 4 + js / 2 - g.dC * ta - g.rho / ca) / cb;
  const double dT = g.dC + g.rho * sa, st = std::sin(g.at);
  g.phiF = std::tan(g.at) - (dT - x * m) / (g.rb * st);
  g.undercut = g.phiF < 0;
  g.xMin = dT / m - z * st * st / (2 * cb);
  g.tipThick = 2 * g.psiTip * g.ra * std::cos(std::atan(g.ra / g.rp * tb));
  return g;
}

void verifierProfil(const GeoEngrenage& g) {
  if (!g.rack) profilRoue(g);
}
double debutFlanc(const GeoEngrenage& g) { return profilRoue(g).flank.knots.front(); }
double finFlanc(const GeoEngrenage& g) { return profilRoue(g).flank.knots.back(); }
std::vector<std::array<double, 2>> polylineEngrenage(const GeoEngrenage& g, double pasArc) {
  std::vector<std::array<double, 2>> out;
  for (const Seg& s : g.rack ? contourCremaillere(g, 0) : contourRoue(g)) {
    if (s.k == Seg::BS) {
      for (size_t i = 0; i + 1 < s.c.poles.size(); i += 3) out.push_back(s.c.poles[i]);
    } else if (s.k == Seg::LN) out.push_back(s.a);
    else {
      const int n = std::max(1, static_cast<int>(std::ceil((s.a1 - s.a0) / pasArc)));
      for (int i = 0; i < n; i++) {
        const double t = s.a0 + (s.a1 - s.a0) * i / n;
        out.push_back({s.r * std::cos(t), s.r * std::sin(t)});
      }
    }
  }
  return out;
}

std::vector<std::pair<bool, std::string>> controlesEngrenage(const GeoEngrenage& g) {
  std::vector<std::pair<bool, std::string>> out;
  const std::string recouvrement = "Recouvrement ε_β : " + fr(g.overlap) + " (dents en prise sur la largeur, en plus du rapport de conduite).";
  if (g.rack) {
    if (g.H < 2 * g.m) out.push_back({false, "Corps mince : " + fr(g.H) + " mm sous les dents (repère usuel : au moins 2 modules, soit " + fr(2 * g.m) + " mm)."});
    else out.push_back({true, "Corps sous les dents : " + fr(g.H) + " mm."});
    if (g.betaDeg != 0) out.push_back({true, recouvrement});
    return out;
  }
  if (g.internal) {
    if (g.tipCut) out.push_back({false, "Dents raccourcies : la tête descendrait sous le cercle de base, où la développante n’existe pas. Tête ramenée à Ø " + fr(2 * g.ra) + ". Il faudrait plus de dents ou un déport x ≤ " + fr(std::floor(g.xMaxFull * 100) / 100) + "."});
    if (g.tipThick < 0.25 * g.m) out.push_back({false, "Tête de dent très fine (" + fr(g.tipThick) + " mm) : fragile à cet endroit. Augmentez le déport ou ajoutez des dents."});
    else out.push_back({true, "Épaisseur en tête de dent : " + fr(g.tipThick) + " mm."});
    const double rim = g.D / 2 - g.rf;
    if (rim < 2 * g.m) out.push_back({false, "Couronne mince : " + fr(rim) + " mm sous les dents (repère usuel : au moins 2 modules, soit " + fr(2 * g.m) + " mm)."});
    else out.push_back({true, "Couronne sous les dents : " + fr(rim) + " mm."});
    out.push_back({true, "Pied de dent en arc simple : la forme réelle dépend de l’outil-pignon."});
    if (g.betaDeg != 0) out.push_back({true, recouvrement});
    return out;
  }
  if (g.undercut) out.push_back({false, "Sous-coupe : le pied de dent est creusé par l’outil, la dent est affaiblie. Déport conseillé : x ≥ " + fr(std::ceil(g.xMin * 100) / 100) + "."});
  else out.push_back({true, "Pas de sous-coupe."});
  if (g.tipThick < 0.25 * g.m) out.push_back({false, "Tête de dent très fine (" + fr(g.tipThick) + " mm) : fragile à cet endroit. Réduisez le déport ou ajoutez des dents."});
  else out.push_back({true, "Épaisseur en tête de dent : " + fr(g.tipThick) + " mm."});
  if (g.betaDeg != 0) out.push_back({true, recouvrement});
  return out;
}

TopoDS_Shape formeEngrenage(const ReglageEngrenage& o) {
  const GeoEngrenage g = geoEngrenage(o);
  if (g.rack) return solideCremaillere(g);
  if (g.internal) return solideCouronne(g);
  if (g.betaDeg != 0) return solideHelice(g);
  BRepBuilderAPI_MakeFace mf(filDe(contourRoue(g)), true);
  if (!mf.IsDone()) throw std::runtime_error("face de denture impossible");
  BRepPrimAPI_MakePrism pr(mf.Face(), gp_Vec(0, 0, g.b), false, true);
  pr.Build();
  if (!pr.IsDone()) throw std::runtime_error("extrusion de la denture impossible");
  return pr.Shape();
}
