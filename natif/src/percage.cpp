// Perçage : traduction de occShapeOfHole (src/76-percage) sans le filet modélisé, refusé à la lecture.
#include "percage.h"
#include "noms.h"

#include <BRepAlgoAPI_Fuse.hxx>
#include <BRepBndLib.hxx>
#include <BRepClass3d_SolidClassifier.hxx>
#include <BRepPrimAPI_MakeCone.hxx>
#include <BRepPrimAPI_MakeCylinder.hxx>
#include <BRep_Builder.hxx>
#include <Bnd_Box.hxx>
#include <TopoDS_Compound.hxx>
#include <gp_Ax2.hxx>
#include <gp_Dir.hxx>
#include <gp_Pnt.hxx>

#include <algorithm>
#include <cmath>
#include <optional>
#include <stdexcept>

namespace {
const double PI = 3.141592653589793;

struct Norme {
  double d = 0, r = 0, stD = 0, stH = 0, stTip = 0, cbD = 0, cbH = 0, csD = 0, csA = 0, depth = 0, tip = 0, thruLen = 0;
  std::string kind, end, pilot;
  bool through = false;
};

// x || y de JavaScript : 0 et l'absence (NaN) prennent la valeur de secours
double ou(double x, double y) { return (std::isnan(x) || x == 0) ? y : x; }
double pointe(double t) { return (!std::isnan(t) && t == 0) ? 0 : std::min(170.0, std::max(60.0, ou(t, 118))); }
double arrondi3(double v) { return std::round(v * 1000) / 1000; }

Norme normer(const ReglagePercage& f) {  // holeNorm
  Norme N;
  if (f.kind == "ream") {
    const double D = std::max(0.2, ou(f.reamD, 6)), H = std::max(0.1, ou(f.reamH, D * 1.5));
    const std::string pil = (f.pilot == "blind" || f.pilot == "through" || f.pilot == "open") ? f.pilot : "none";
    N.kind = "ream";
    N.pilot = pil;
    N.cbD = D;
    N.cbH = H;
    N.csD = D + 0.2;
    N.csA = 90;
    if (pil == "none" || pil == "open") {
      N.d = D;
      N.r = D / 2;
      N.end = pil == "open" ? "through" : "blind";
      N.through = pil == "open";
      N.depth = H;
      N.tip = 0;
      return N;
    }
    // holeReamDrill
    const double dd = f.reamOff > 0 ? D - f.reamOff : ou(f.d, D - 0.5);
    const double d = arrondi3(std::min(D - 0.05, std::max(0.2, dd)));
    N.d = d;
    N.r = d / 2;
    N.end = pil == "through" ? "through" : "blind";
    N.through = pil == "through";
    N.depth = std::max(H + 0.1, ou(f.depth, H + 2 * D));
    N.tip = pointe(f.tip);
    return N;
  }
  const double d = std::max(0.2, ou(f.d, 6.6));
  N.d = d;
  N.r = d / 2;
  N.kind = (f.kind == "cbore" || f.kind == "csink" || f.kind == "step") ? f.kind : "simple";
  N.stD = std::max(d + 0.2, ou(f.stD, std::max(8.0, d * 2)));
  N.stH = std::max(0.1, ou(f.stH, 5));
  N.stTip = pointe(f.stTip);
  N.cbD = std::max(d + 0.2, ou(f.cbD, d * 1.7));
  N.cbH = std::max(0.1, ou(f.cbH, d * 0.9));
  N.csD = std::max(d + 0.2, ou(f.csD, d * 2));
  N.csA = std::min(150.0, std::max(60.0, ou(f.csA, 90)));
  N.end = (f.end == "through" || f.end == "next" || f.end == "upto") ? f.end : "blind";
  N.through = f.end == "through";
  N.depth = std::max(0.2, ou(f.depth, d * 2.5));
  N.tip = pointe(f.tip);
  return N;
}

struct Segment {
  double z, h, r0, r1;
};

std::vector<Segment> profil(const Norme& N, double zFin) {  // holeProfileSegs
  std::vector<Segment> s;
  double z = 0;
  if (N.kind == "cbore" || (N.kind == "ream" && (N.pilot == "blind" || N.pilot == "through"))) {
    s.push_back({z, N.cbH, N.cbD / 2, N.cbD / 2});
    z = N.cbH;
  } else if (N.kind == "csink") {
    const double h = (N.csD - N.d) / 2 / std::tan(N.csA * PI / 360);
    s.push_back({z, h, N.csD / 2, N.r});
    z = h;
  } else if (N.kind == "step") {
    s.push_back({z, N.stH, N.stD / 2, N.stD / 2});
    z = N.stH;
    if (N.stTip > 0) {
      const double h = (N.stD - N.d) / 2 / std::tan(N.stTip * PI / 360);
      s.push_back({z, h, N.stD / 2, N.r});
      z += h;
    }
  }
  const double zEnd = std::max(zFin, z + 0.05);
  s.push_back({z, zEnd - z, N.r, N.r});
  if (N.end == "blind" && N.tip > 0) s.push_back({zEnd, N.r / std::tan(N.tip * PI / 360), N.r, 0});
  return s;
}

// holePlaneDist : distance le long de l'axe jusqu'au plan choisi ; rien s'il est absent, parallèle ou derrière
std::optional<double> distancePlan(const ReglagePercage& f, const gp_Pnt& P, const gp_Dir& D) {
  if (!f.aPlan) return std::nullopt;
  const double dn = D.X() * f.planN[0] + D.Y() * f.planN[1] + D.Z() * f.planN[2];
  if (std::abs(dn) < 1e-6) return std::nullopt;
  const double t = ((f.planP[0] - P.X()) * f.planN[0] + (f.planP[1] - P.Y()) * f.planN[1] + (f.planP[2] - P.Z()) * f.planN[2]) / dn;
  if (t > 0.01) return t;
  return std::nullopt;
}

// holeNextExit : la première sortie de matière le long de l'axe. Marche, puis dichotomie.
std::optional<double> prochaineSortie(const TopoDS_Shape& sh, const gp_Pnt& P, const gp_Dir& D) {
  if (sh.IsNull()) return std::nullopt;
  try {
    BRepClass3d_SolidClassifier cl(sh);
    const auto dedans = [&](double t) {
      cl.Perform(gp_Pnt(P.X() + D.X() * t, P.Y() + D.Y() * t, P.Z() + D.Z() * t), 1e-7);
      return cl.State() == TopAbs_IN;
    };
    Bnd_Box bb;
    BRepBndLib::Add(sh, bb, true);
    const gp_Pnt a = bb.CornerMin(), b = bb.CornerMax();
    const double Lmax = std::hypot(b.X() - a.X(), b.Y() - a.Y(), b.Z() - a.Z()) + 1, pas = 0.25;
    bool vuDedans = false, avant = false;
    for (double t = 0.05; t <= Lmax; t += pas) {
      if (dedans(t)) {
        vuDedans = avant = true;
        continue;
      }
      if (vuDedans && avant) {
        double lo = t - pas, hi = t;
        for (int k = 0; k < 30; k++) {
          const double m = (lo + hi) / 2;
          (dedans(m) ? lo : hi) = m;
        }
        return hi;
      }
      avant = false;
    }
  } catch (const Standard_Failure&) {
  }
  return std::nullopt;
}
}  // namespace

std::vector<TopoDS_Shape> formePercage(const Fonction& f, const Esquisse& s, const TopoDS_Shape& base, std::vector<std::string>& alertes) {
  std::vector<gp_Pnt> centres;
  for (const Entite& e : s.entites) {
    if (e.t != "cpoint" || !e.percage) continue;
    const Pt* q = s.point(e.p);
    if (!q) continue;
    centres.emplace_back(s.o[0] + s.u[0] * q->x + s.v[0] * q->y, s.o[1] + s.u[1] * q->x + s.v[1] * q->y, s.o[2] + s.u[2] * q->x + s.v[2] * q->y);
  }
  if (centres.empty()) throw std::runtime_error("aucun centre de perçage dans l'esquisse");
  Norme N = normer(f.percage);
  const double sg = f.flip ? 1 : -1;
  const gp_Dir D(s.n[0] * sg, s.n[1] * sg, s.n[2] * sg);
  // Débouchant : course limitée à la pièce déjà construite (+1 mm)
  if (N.through && !base.IsNull()) {
    Bnd_Box bb;
    BRepBndLib::Add(base, bb, true);
    const gp_Pnt a = bb.CornerMin(), b = bb.CornerMax();
    const double cs[3][2] = {{a.X(), b.X()}, {a.Y(), b.Y()}, {a.Z(), b.Z()}};
    double L = 0;
    for (const gp_Pnt& P : centres)
      for (int i = 0; i < 8; i++)
        L = std::max(L, (cs[0][i & 1] - P.X()) * D.X() + (cs[1][(i >> 1) & 1] - P.Y()) * D.Y() + (cs[2][(i >> 2) & 1] - P.Z()) * D.Z());
    if (L > 0) N.thruLen = L + 1;
  }
  const auto finDe = [&](const gp_Pnt& P) {  // zEndOf
    if (N.end == "upto") {
      if (auto t = distancePlan(f.percage, P, D)) return *t;
      alertes.push_back("fin « jusqu'à la face » : face non choisie ou parallèle à l'axe, profondeur saisie utilisée");
      return N.depth;
    }
    if (N.end == "next") {
      if (auto t = prochaineSortie(base, P, D)) return *t + 0.05;  // franchit la face de sortie
      alertes.push_back("fin « débouchant » : aucune sortie de matière trouvée, profondeur saisie utilisée");
      return N.depth;
    }
    if (N.through) return N.thruLen != 0 ? N.thruLen : 2000.0;
    return N.depth;
  };
  const double OVER = 0.02;  // départ légèrement au-dessus du plan : jamais de face coplanaire
  std::vector<TopoDS_Shape> outils;
  int iCentre = -1;
  for (const gp_Pnt& P : centres) {
    iCentre++;
    TopoDS_Shape prof;
    const auto segs = profil(N, finDe(P));
    for (size_t i = 0; i < segs.size(); i++) {
      const Segment& g = segs[i];
      const bool premier = i == 0;
      const double z0 = g.z - (premier ? OVER : 0), h = g.h + (premier ? OVER : 0);
      const double r0 = (premier && g.h > 1e-9) ? g.r0 + OVER * (g.r0 - g.r1) / g.h : g.r0;
      const gp_Ax2 ax(gp_Pnt(P.X() + D.X() * z0, P.Y() + D.Y() * z0, P.Z() + D.Z() * z0), D);
      TopoDS_Shape x;
      if (std::abs(g.r0 - g.r1) < 1e-9) x = BRepPrimAPI_MakeCylinder(ax, g.r0, h).Shape();
      else x = BRepPrimAPI_MakeCone(ax, r0, g.r1, h).Shape();
      // Noms : centre, segment du profil, rang de la face du cylindre ou du cône (ordre fixe du noyau)
      nomsNomme(x, [&](const CarteFaces&, std::vector<std::string>& fn) {
        for (size_t k = 0; k < fn.size(); k++) fn[k] = f.id + "/c" + std::to_string(iCentre) + "/s" + std::to_string(i) + "/f" + std::to_string(k + 1);
      });
      if (prof.IsNull()) {
        prof = x;
        continue;
      }
      BRepAlgoAPI_Fuse fu(prof, x);
      if (!fu.IsDone()) throw std::runtime_error("fusion impossible");
      const TopoDS_Shape nx = fu.Shape();
      nomsTransmet({prof, x}, histoireDe(fu), nx);
      prof = nx;
    }
    outils.push_back(prof);
  }
  return outils;
}
