#include "mesure.h"

#include <algorithm>
#include <cmath>

#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <GeomAbs_SurfaceType.hxx>
#include <Standard_Failure.hxx>
#include <gp_Cylinder.hxx>
#include <gp_Pln.hxx>

#include "nombres_js.h"

namespace mesure {
namespace {
constexpr double PI = 3.14159265358979323846;
std::string f2(double v) { return js::fixe(v, 2); }
std::string f1(double v) { return js::fixe(v, 1); }
std::string f3(double v) { return js::fixe(v, 3); }
gp_Pnt plus(const gp_Pnt& p, const gp_Vec& v, double k) { return gp_Pnt(p.X() + v.X() * k, p.Y() + v.Y() * k, p.Z() + v.Z() * k); }
gp_Vec moins(const gp_Pnt& a, const gp_Pnt& b) { return gp_Vec(b, a); }
gp_Vec unitaire(const gp_Vec& v) {
  const double m = v.Magnitude();
  return m > 0 ? v / m : v;
}

struct Entraxe {
  gp_Pnt q1, q2;
  double d = 0;
  bool par = false;
};
Entraxe entraxe(const gp_Pnt& c1, const gp_Vec& a1, const gp_Pnt& c2, const gp_Vec& a2) {  // entraxePts
  Entraxe e;
  if (std::abs(a1.Dot(a2)) > std::cos(5 * PI / 180)) {
    const gp_Pnt m((c1.X() + c2.X()) * 0.5, (c1.Y() + c2.Y()) * 0.5, (c1.Z() + c2.Z()) * 0.5);
    e.q1 = plus(c1, a1, moins(m, c1).Dot(a1));
    e.q2 = plus(c2, a2, moins(m, c2).Dot(a2));
    e.par = true;
  } else {  // closestAxisPoints
    const gp_Vec w0 = moins(c1, c2);
    const double b = a1.Dot(a2), den = 1 - b * b;
    if (std::abs(den) < 1e-9) {
      e.q1 = plus(c1, a1, moins(c2, c1).Dot(a1));
      e.q2 = c2;
    } else {
      const double d = a1.Dot(w0), f = a2.Dot(w0);
      e.q1 = plus(c1, a1, (b * f - d) / den);
      e.q2 = plus(c2, a2, (f - b * d) / den);
    }
  }
  e.d = e.q1.Distance(e.q2);
  return e;
}
}  // namespace

GeoFace geoFace(const TopoDS_Face& f, const gp_Trsf& t) {
  GeoFace g;
  try {
    BRepAdaptor_Surface ad(f, true);
    if (ad.GetType() == GeomAbs_Cylinder) {
      const gp_Cylinder c = ad.Cylinder();
      g.sorte = GeoFace::Cylindre;
      g.p = c.Axis().Location();
      g.n = gp_Vec(c.Axis().Direction());
      g.r = c.Radius();
    } else if (ad.GetType() == GeomAbs_Plane) {
      const gp_Pln p = ad.Plane();
      g.sorte = GeoFace::Plan;
      g.p = p.Axis().Location();
      g.n = gp_Vec(p.Axis().Direction());
    } else return g;
    g.p.Transform(t);
    g.n.Transform(t);
    g.n = unitaire(g.n);
  } catch (const Standard_Failure&) {
    g.sorte = GeoFace::Aucune;
  }
  return g;
}

std::vector<gp_Pnt> pointsArete(const TopoDS_Edge& e, const gp_Trsf& t) {
  std::vector<gp_Pnt> pts;
  try {
    const BRepAdaptor_Curve ad(e);
    const double u0 = ad.FirstParameter(), u1 = ad.LastParameter();
    if (!(u1 > u0)) return pts;
    for (int i = 0; i <= 10; i++) {
      gp_Pnt p;
      ad.D0(u0 + (u1 - u0) * i / 10, p);
      p.Transform(t);
      pts.push_back(p);
    }
  } catch (const Standard_Failure&) {
    pts.clear();
  }
  return pts;
}

GeoArete geoArete(const std::vector<gp_Pnt>& V) {
  GeoArete g;
  g.pts = V;
  if (V.empty()) return g;
  const gp_Pnt A = V.front(), B = V.back();
  const gp_Vec u = moins(B, A);
  const double L = u.Magnitude();
  const auto ecart = [&](const gp_Pnt& q) {
    if (L < 1e-9) return 0.0;
    const double t = moins(q, A).Dot(u) / (L * L);
    return q.Distance(plus(A, u, t));
  };
  if (V.size() <= 2 || std::all_of(V.begin(), V.end(), [&](const gp_Pnt& q) { return ecart(q) < 1e-3 * std::max(1.0, L); })) {
    g.sorte = GeoArete::Droite;
    g.a = A;
    g.b = B;
    g.u = unitaire(u);
    return g;
  }
  const bool ferme = A.Distance(B) < 1e-6 * std::max(1.0, L) + 1e-6;
  const gp_Pnt p1 = V[0], p2 = V[V.size() / 3], p3 = V[2 * V.size() / 3];
  const gp_Vec a = moins(p2, p1), b = moins(p3, p1), n = a.Crossed(b);
  const double nn = n.SquareMagnitude();
  if (nn < 1e-12) return g;
  const gp_Vec w = (b * a.SquareMagnitude() - a * b.SquareMagnitude()).Crossed(n) * (0.5 / nn);
  const gp_Pnt C = plus(p1, w, 1);
  const double r = C.Distance(p1);
  if (!std::all_of(V.begin(), V.end(), [&](const gp_Pnt& q) { return std::abs(q.Distance(C) - r) < 2e-3 * std::max(1.0, r); })) return g;
  g.sorte = GeoArete::Cercle;
  g.centre = C;
  g.axe = unitaire(n);
  g.r = r;
  g.ferme = ferme;
  return g;
}

std::string decrireArete(const GeoArete& g) {
  if (g.sorte == GeoArete::Droite) return "DROITE · longueur " + f2(g.a.Distance(g.b)) + " mm";
  if (g.sorte == GeoArete::Cercle) return std::string(g.ferme ? "CERCLE" : "ARC") + " · Ø" + f2(2 * g.r) + " (R" + f2(g.r) + ")";
  return "COURBE";
}

bool mesurerFaces(const GeoFace& A, const gp_Pnt& pA, const GeoFace& B, const gp_Pnt& pB, Dessin& d, std::string& texte) {
  if (A.sorte == GeoFace::Aucune || B.sorte == GeoFace::Aucune) return false;
  if (A.sorte == GeoFace::Cylindre && B.sorte == GeoFace::Cylindre) {
    const Entraxe en = entraxe(A.p, A.n, B.p, B.n);
    const double ang = std::asin(std::min(1.0, A.n.Crossed(B.n).Magnitude())) * 180 / PI;
    d.cotes.push_back({en.q1, en.q2, "entraxe " + f2(en.d)});
    d.etiquettes.push_back({"Ø " + f2(A.r * 2), en.q1});
    d.etiquettes.push_back({"Ø " + f2(B.r * 2), en.q2});
    d.axes.push_back({A.p, A.n});
    d.axes.push_back({B.p, B.n});
    texte = "Entraxe : " + f2(en.d) + " mm" + (en.par ? " (axes quasi-parallèles)" : "") + "\nØ1=" + f2(A.r * 2) + " · Ø2=" + f2(B.r * 2) + " · angle axes=" + f2(ang) + "°";
    return true;
  }
  if (A.sorte != B.sorte) {
    const GeoFace& C = A.sorte == GeoFace::Cylindre ? A : B;
    const GeoFace& P = A.sorte == GeoFace::Plan ? A : B;
    const double a2p = std::asin(std::min(1.0, std::abs(C.n.Dot(P.n)))) * 180 / PI;
    const double dAx = moins(C.p, P.p).Dot(P.n);
    const gp_Pnt qf = plus(C.p, P.n, -dAx);
    d.cotes.push_back({C.p, qf, f2(std::abs(dAx))});
    d.etiquettes.push_back({"Ø " + f2(C.r * 2), A.sorte == GeoFace::Cylindre ? pA : pB});
    d.axes.push_back({C.p, C.n});
    texte = "Axe↔face : " + f2(std::abs(dAx)) + " mm" + (a2p > 89 ? std::string(" (axe ⊥ face)") : " (angle axe/plan=" + f1(a2p) + "°)") + "\nØ=" + f2(C.r * 2);
    return true;
  }
  const double ang = std::acos(std::min(1.0, std::abs(A.n.Dot(B.n)))) * 180 / PI;
  if (ang < 0.5) {
    // Distance exacte entre les deux plans, pas entre les points cliqués
    const double signe = moins(B.p, A.p).Dot(A.n);
    const gp_Pnt A0 = plus(pA, A.n, -moins(pA, A.p).Dot(A.n));
    d.cotes.push_back({A0, plus(A0, A.n, signe), f2(std::abs(signe))});
    texte = "Faces parallèles : " + f2(std::abs(signe)) + " mm (angle " + f2(ang) + "°)";
  } else {
    const double l = pA.Distance(pB);
    d.cotes.push_back({pA, pB, f2(l) + " mm"});
    texte = "Faces non parallèles : angle=" + f2(ang) + "° · dist. points=" + f2(l) + " mm";
  }
  return true;
}

std::string mesurerAretes(const GeoArete& A, const GeoArete& B, Dessin& d) {
  if (A.sorte == GeoArete::Droite && B.sorte == GeoArete::Droite) {
    const double ang = std::acos(std::min(1.0, std::abs(A.u.Dot(B.u)))) * 180 / PI;
    if (ang < 0.5) {
      const gp_Pnt M((B.a.X() + B.b.X()) * 0.5, (B.a.Y() + B.b.Y()) * 0.5, (B.a.Z() + B.b.Z()) * 0.5);
      const gp_Pnt F = plus(A.a, A.u, moins(M, A.a).Dot(A.u));
      const double l = F.Distance(M);
      d.cotes.push_back({F, M, f2(l)});
      return "Arêtes parallèles : " + f2(l) + " mm (perpendiculaire) · angle " + f2(ang) + "°";
    }
    // plus courte distance entre les deux segments, par échantillonnage
    double best = 1e18;
    gp_Pnt bp, bq;
    const auto lerp = [](const GeoArete& G, double t) { return gp_Pnt(G.a.X() + (G.b.X() - G.a.X()) * t, G.a.Y() + (G.b.Y() - G.a.Y()) * t, G.a.Z() + (G.b.Z() - G.a.Z()) * t); };
    for (int i = 0; i <= 40; i++)
      for (int j = 0; j <= 40; j++) {
        const gp_Pnt p = lerp(A, i / 40.0), q = lerp(B, j / 40.0);
        const double l = p.Distance(q);
        if (l < best) {
          best = l;
          bp = p;
          bq = q;
        }
      }
    d.cotes.push_back({bp, bq, f2(best)});
    return "Arêtes non parallèles : angle " + f2(ang) + "° · distance mini ≈ " + f2(best) + " mm";
  }
  if (A.sorte == GeoArete::Cercle && B.sorte == GeoArete::Cercle) {
    const double l = A.centre.Distance(B.centre);
    const bool coax = std::abs(std::abs(A.axe.Dot(B.axe)) - 1) < 1e-4 && moins(B.centre, A.centre).Crossed(A.axe).Magnitude() < 1e-3;
    d.cotes.push_back({A.centre, B.centre, (coax ? "" : "entraxe ") + f2(l)});
    d.etiquettes.push_back({"Ø " + f2(2 * A.r), A.pts[0]});
    d.etiquettes.push_back({"Ø " + f2(2 * B.r), B.pts[0]});
    return (coax ? "Cercles COAXIAUX : écart des plans " + f2(l) + " mm" : "Entraxe : " + f2(l) + " mm") + "\nØ1=" + f2(2 * A.r) + " · Ø2=" + f2(2 * B.r);
  }
  const GeoArete* L = A.sorte == GeoArete::Droite ? &A : B.sorte == GeoArete::Droite ? &B : nullptr;
  const GeoArete* C = A.sorte == GeoArete::Cercle ? &A : B.sorte == GeoArete::Cercle ? &B : nullptr;
  if (L && C) {
    const gp_Pnt F = plus(L->a, L->u, moins(C->centre, L->a).Dot(L->u));
    const double l = F.Distance(C->centre);
    d.cotes.push_back({C->centre, F, f2(l)});
    d.etiquettes.push_back({"Ø " + f2(2 * C->r), C->pts[0]});
    return "Centre ↔ droite : " + f2(l) + " mm (perpendiculaire) · Ø=" + f2(2 * C->r);
  }
  double best = 1e18;
  gp_Pnt bp, bq;
  for (const gp_Pnt& p : A.pts)
    for (const gp_Pnt& q : B.pts) {
      const double l = p.Distance(q);
      if (l < best) {
        best = l;
        bp = p;
        bq = q;
      }
    }
  d.cotes.push_back({bp, bq, f2(best)});
  return "Distance mini entre arêtes ≈ " + f2(best) + " mm";
}

std::string mesurerCylindre(const GeoFace& g, const gp_Pnt& p, Dessin& d) {
  d.axes.push_back({g.p, g.n});
  const gp_Pnt q = plus(g.p, g.n, moins(p, g.p).Dot(g.n));
  d.cotes.push_back({q, p, "R " + f2(g.r)});
  d.etiquettes.push_back({"Ø " + f2(g.r * 2), p});
  // Le navigateur écrit ici « Ø R » : on donne le vrai diamètre
  return "Cylindre exact : Ø " + f2(g.r * 2) + " mm (R " + f2(g.r) + ")\nAxe=" + f3(g.n.X()) + ", " + f3(g.n.Y()) + ", " + f3(g.n.Z()) + " · centre=(" + f1(g.p.X()) + ", " + f1(g.p.Y()) + ", " + f1(g.p.Z()) + ")\nCtrl+clic un 2e cylindre = entraxe · Ctrl+clic un plan = cote axe↔face.";
}

}  // namespace mesure
