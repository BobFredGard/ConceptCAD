// Perçage : traduction de occShapeOfHole (src/76-percage) sans le filet modélisé, refusé à la lecture.
#include "percage.h"
#include "noms.h"

#include <BRepBuilderAPI_Transform.hxx>
#include <Standard_Failure.hxx>
#include <gp_Trsf.hxx>
#include <gp_Vec.hxx>
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
using json_t = nlohmann::ordered_json;
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

double entreeTrou(const Norme& N) {  // holeEntryOff
  if (N.kind == "cbore") return N.cbH;
  if (N.kind == "csink") return std::max(0.0, (N.csD - N.d) / 2 / std::tan(N.csA * PI / 360));
  if (N.kind == "step") return N.stH + (N.stTip > 0 ? (N.stD - N.d) / 2 / std::tan(N.stTip * PI / 360) : 0);
  return 0;
}

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
template <class R>
std::optional<double> distancePlan(const R& f, const gp_Pnt& P, const gp_Dir& D) {
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

InfosPercage percageInfos(const Fonction& f) {
  const Norme N = normer(f.percage);
  InfosPercage r;
  r.d = N.d, r.r = N.r, r.stD = N.stD, r.stH = N.stH, r.cbD = N.cbD, r.cbH = N.cbH, r.csD = N.csD, r.csA = N.csA, r.depth = N.depth, r.tip = N.tip, r.entree = entreeTrou(N);
  r.kind = N.kind, r.end = N.end, r.pilot = N.pilot;
  return r;
}

std::vector<TopoDS_Shape> formePercage(const Fonction& f, const Esquisse& s, const TopoDS_Shape& base, std::vector<std::string>& alertes, FiletsPercage* fil) {
  std::vector<gp_Pnt> centres;
  for (const Entite& e : s.entites) {
    if (e.t != "cpoint" || !e.percage) continue;
    const Pt* q = s.point(e.p);
    if (!q) continue;
    centres.emplace_back(s.o[0] + s.u[0] * q->x + s.v[0] * q->y, s.o[1] + s.u[1] * q->x + s.v[1] * q->y, s.o[2] + s.u[2] * q->x + s.v[2] * q->y);
  }
  if (centres.empty()) throw std::runtime_error("aucun centre de perçage dans l'esquisse");
  Norme N = normer(f.percage);
  const ReglageFilet& F = f.percage.filet;
  const bool taraude = N.kind != "ream" && !F.size.empty();
  std::optional<FiletInterieur> thModel;
  if (taraude && F.model) thModel = filetInterieur(F.size, F.p, F.clear);
  if (thModel) {
    thModel->lh = F.lh;
    N.r = std::max(N.r, thModel->rCrete);  // le corps n'est jamais plus étroit que la crête du filet
  }
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
  // Longueur filetée effective
  double thLen = 0;
  if (taraude) {
    const std::string m = F.lenMode.empty() ? "len" : F.lenMode;
    thLen = F.len;
    if (m == "upto") {
      if (auto t = distancePlan(F, centres[0], D)) thLen = *t;
      else alertes.push_back("longueur filetée « jusqu'à la face » : face non choisie");
    } else if (m == "next") {
      if (auto t = prochaineSortie(base, centres[0], D)) thLen = *t;
    } else if (m == "through") {
      thLen = std::max(0.0, finDe(centres[0]) - entreeTrou(N));
    }
  }
  const double OVER = 0.02;  // départ légèrement au-dessus du plan : jamais de face coplanaire
  std::vector<TopoDS_Shape> outils, vides;
  int iCentre = -1;
  const auto fusionne = [&](const gp_Pnt& P, double zFin) {
    TopoDS_Shape prof;
    const auto segs = profil(N, zFin);
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
    return prof;
  };
  const double rC = N.r + 0.01;
  std::string cleV0;
  gp_Pnt P0;
  TopoDS_Shape v0;
  for (const gp_Pnt& P : centres) {
    iCentre++;
    const double zEnd = finDe(P);
    if (!thModel) {
      outils.push_back(fusionne(P, zEnd));
      continue;
    }
    const double p = thModel->P, off = entreeTrou(N);
    const double L = (F.lenMode.empty() ? "len" : F.lenMode) == std::string("through") ? std::max(0.0, zEnd - off) : std::min(thLen != 0 ? thLen : (F.len != 0 ? F.len : N.depth), zEnd - off);
    // Le vide commence un pas avant l'entrée et, pour un débouchant, finit un pas après la sortie ; borgne : un pas lisse sous la dernière crête
    const double zStart = off - p;
    const bool borgne = !(N.through || N.end == "next");
    int nT = std::max(1, static_cast<int>(std::lround((L + p + (borgne ? 0 : p)) / p)));
    double zB = zEnd;
    if (borgne) while (nT > 1 && zStart + (nT + 1) * p > zEnd - 0.05) nT--;
    else zB = std::max(zEnd, zStart + (nT + 1) * p + 0.1);
    const double tip = borgne && N.end == "blind" ? N.tip : 0;
    bool creux = false;
    if (L > 0.9 * p) {
      if (!fil) {
        creux = true;  // rejeu partiel : même avant-trou, le filet n'est pas construit
      } else {
        char cle[160];
        std::snprintf(cle, sizeof cle, "%.4f|%d|%.4f|%.4f", zStart, nT, zB, tip);
        TopoDS_Shape v;
        try {
          if (!v0.IsNull() && cleV0 == cle) {  // même filet sur plusieurs centres : construit une fois, puis translaté
            gp_Trsf g;
            g.SetTranslation(gp_Vec(P0, P));
            v = BRepBuilderAPI_Transform(v0, g, false).Shape();
          } else {
            v = videTaraude(P, D, zStart, nT, *thModel, rC, zB, tip);
            if (!v.IsNull()) {
              v0 = v;
              cleV0 = cle;
              P0 = P;
            }
          }
        } catch (const Standard_Failure& e) {
          alertes.push_back(std::string("filet modélisé impossible (trou lisse) : ") + e.what());
        } catch (const std::exception& e) {
          alertes.push_back(std::string("filet modélisé impossible (trou lisse) : ") + e.what());
        }
        if (v.IsNull() && alertes.empty()) alertes.push_back("filet modélisé ignoré : trou trop court pour le filet");
        if (!v.IsNull()) {
          vides.push_back(v);
          creux = true;
        }
      }
    } else {
      alertes.push_back("filet modélisé ignoré : longueur filetée inférieure à un pas");
    }
    // avant-trou : fond 0,01 au-dessus de celui du vide (jamais de faces coplanaires)
    outils.push_back(fusionne(P, creux && borgne ? zEnd - 0.01 : zEnd));
  }
  if (fil) {
    fil->vides = composeFilets(vides);
    fil->longueur = thLen;
    fil->taraude = taraude;
    // holeThreadPaths : le dessin du filet qui n'est pas dans le solide
    if (const json_t* t = filetageDe(F.size); taraude && !F.model && t) {
      const double pz = F.p != 0 ? F.p : (*t)[2].get<double>(), Rn = (*t)[1].get<double>() / 2;
      const double rh = std::max(0.05, N.r - 0.04), len = std::max(pz, thLen != 0 ? thLen : (F.len != 0 ? F.len : N.depth));
      const gp_Vec dv(D), ref = std::abs(D.Z()) < 0.9 ? gp_Vec(0, 0, 1) : gp_Vec(1, 0, 0);
      const gp_Vec U = dv.Crossed(ref).Normalized(), V = dv.Crossed(U);
      const double off = N.kind == "cbore" || N.kind == "step" ? entreeTrou(N) : 0, tours = len / pz;
      const int pas = std::max(24, static_cast<int>(std::ceil(tours * 24)));
      for (const gp_Pnt& P : centres) {
        SpiraleFilet sp;
        for (int i = 0; i <= pas; i++) {
          const double u = static_cast<double>(i) / pas, a = (F.lh ? -1 : 1) * u * tours * 2 * PI;
          sp.helice.push_back(P.Translated(dv * (off + u * len) + (U * std::cos(a) + V * std::sin(a)) * rh));
        }
        for (int k = 0; k <= 48; k++) {
          const double a = k / 48.0 * 2 * PI;
          sp.anneau.push_back(P.Translated(dv * (off - 0.03) + (U * std::cos(a) + V * std::sin(a)) * Rn));
        }
        fil->spirales.push_back(sp);
      }
    }
  }
  return outils;
}
