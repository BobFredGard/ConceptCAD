#include "coter.h"

#include <BRepAdaptor_Curve.hxx>
#include <Standard_Failure.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <limits>
#include <set>

#include "rejeu.h"

namespace {
const double PI = 3.14159265358979323846, TAU = 2 * PI;

struct AreteSource {
  Vec3 mid;
  std::vector<Vec3> pts;
};

// occListEdges (src/20-40) : 11 points par arête, jumeaux au même milieu fusionnés
std::vector<AreteSource> listerAretes(const TopoDS_Shape& forme) {
  std::vector<AreteSource> out;
  std::set<std::string> vus;
  if (forme.IsNull()) return out;
  const int NP = 10;
  for (TopExp_Explorer ex(forme, TopAbs_EDGE); ex.More(); ex.Next()) {
    try {
      BRepAdaptor_Curve ad(TopoDS::Edge(ex.Current()));
      const double u0 = ad.FirstParameter(), u1 = ad.LastParameter();
      if (!(u1 > u0)) continue;
      AreteSource a;
      const gp_Pnt m = ad.Value((u0 + u1) / 2);
      a.mid = {m.X(), m.Y(), m.Z()};
      double len = 0;
      for (int i = 0; i <= NP; i++) {
        const gp_Pnt p = ad.Value(u0 + (u1 - u0) * i / NP);
        a.pts.push_back({p.X(), p.Y(), p.Z()});
        if (i) len += std::hypot(a.pts[i][0] - a.pts[i - 1][0], a.pts[i][1] - a.pts[i - 1][1], a.pts[i][2] - a.pts[i - 1][2]);
      }
      if (!(len > 1e-6)) continue;
      char k[96];
      snprintf(k, sizeof k, "%.2f,%.2f,%.2f", a.mid[0], a.mid[1], a.mid[2]);
      if (vus.insert(k).second) out.push_back(std::move(a));
    } catch (const Standard_Failure&) {
    }
  }
  return out;
}

bool dansArc(double a, double a1, double a2) {  // angInArc
  double d = std::fmod(a2 - a1, TAU);
  if (d < 0) d += TAU;
  double r = std::fmod(a - a1, TAU);
  if (r < 0) r += TAU;
  return r <= d;
}

enum TypeArete { RIEN, LIGNE, CERCLE, ARC };
struct Trouvee {
  TypeArete type = RIEN;
  double x1 = 0, y1 = 0, x2 = 0, y2 = 0, cx = 0, cy = 0, r = 0;
  Vec3 mid{0, 0, 0};
};

// findClosestProjectedEdge (src/50-esquisse-1)
Trouvee areteLaPlusProche(const Esquisse& s, const std::vector<AreteSource>& aretes, double x, double y, const Vec3* prefere, TypeArete voulu, bool sansPoint) {
  Trouvee best, bTy;
  double bd = 1e9, bTyd = 1e9;
  for (const AreteSource& e : aretes) {
    std::vector<std::pair<double, double>> p2;
    for (const Vec3& p : e.pts) {
      const double dx = p[0] - s.o[0], dy = p[1] - s.o[1], dz = p[2] - s.o[2];
      p2.push_back({dx * s.u[0] + dy * s.u[1] + dz * s.u[2], dx * s.v[0] + dy * s.v[1] + dz * s.v[2]});
    }
    if (sansPoint && std::all_of(p2.begin(), p2.end(), [&](const auto& q) { return std::hypot(q.first - p2[0].first, q.second - p2[0].second) < 1e-4; })) continue;
    double d = 1e9;
    for (size_t i = 0; i + 1 < p2.size(); i++) {
      const double ax = p2[i].first, ay = p2[i].second, bx = p2[i + 1].first, by = p2[i + 1].second;
      const double abx = bx - ax, aby = by - ay, l2 = abx * abx + aby * aby;
      const double t = std::max(0.0, std::min(1.0, ((x - ax) * abx + (y - ay) * aby) / (l2 != 0 ? l2 : 1)));
      d = std::min(d, std::hypot(x - (ax + abx * t), y - (ay + aby * t)));
    }
    double sc = d;
    if (prefere) {
      const double w[3] = {e.mid[0] - (*prefere)[0], e.mid[1] - (*prefere)[1], e.mid[2] - (*prefere)[2]};
      const double dn = w[0] * s.n[0] + w[1] * s.n[1] + w[2] * s.n[2];
      const double dp = std::sqrt(std::max(0.0, w[0] * w[0] + w[1] * w[1] + w[2] * w[2] - dn * dn));
      sc = (dp + 1e-3 * std::abs(dn)) * 1000 + d;
    }
    if (sc > bd && sc > bTyd) continue;
    if (!(sc < bd || sc < bTyd)) continue;
    Trouvee pr;
    bool estCercle = false;
    const size_t n = p2.size();
    {
      const auto& p0 = p2[0];
      const auto& p1 = p2[n / 3];
      const auto& q2 = p2[2 * n / 3];
      const double d2 = 2 * (p0.first * (p1.second - q2.second) + p1.first * (q2.second - p0.second) + q2.first * (p0.second - p1.second));
      if (std::abs(d2) > 1e-9) {
        const double s0 = p0.first * p0.first + p0.second * p0.second, s1 = p1.first * p1.first + p1.second * p1.second, s2 = q2.first * q2.first + q2.second * q2.second;
        pr.cx = (s0 * (p1.second - q2.second) + s1 * (q2.second - p0.second) + s2 * (p0.second - p1.second)) / d2;
        pr.cy = (s0 * (q2.first - p1.first) + s1 * (p0.first - q2.first) + s2 * (p1.first - p0.first)) / d2;
        pr.r = std::hypot(p0.first - pr.cx, p0.second - pr.cy);
        if (pr.r > 0.5) {
          double dev = 0;
          for (const auto& q : p2) dev = std::max(dev, std::abs(std::hypot(q.first - pr.cx, q.second - pr.cy) - pr.r));
          estCercle = dev < 0.4;
        }
      }
    }
    const auto& deb = p2.front();
    const auto& fin = p2.back();
    if (estCercle) {
      if (std::hypot(deb.first - fin.first, deb.second - fin.second) < 0.5) {
        pr.type = CERCLE;
      } else {
        // arcOrient : l'arc va de pa à pb en sens direct et contient le milieu réel de l'arête
        const auto& pm = p2[n / 2];
        const double a1 = std::atan2(deb.second - pr.cy, deb.first - pr.cx), a2 = std::atan2(fin.second - pr.cy, fin.first - pr.cx), am = std::atan2(pm.second - pr.cy, pm.first - pr.cx);
        const bool endroit = dansArc(am, a1, a2);
        pr.type = ARC;
        pr.x1 = endroit ? deb.first : fin.first;
        pr.y1 = endroit ? deb.second : fin.second;
        pr.x2 = endroit ? fin.first : deb.first;
        pr.y2 = endroit ? fin.second : deb.second;
      }
    } else {
      pr.type = LIGNE;
      pr.x1 = deb.first;
      pr.y1 = deb.second;
      pr.x2 = fin.first;
      pr.y2 = fin.second;
    }
    if (sansPoint && pr.type == LIGNE && std::hypot(pr.x2 - pr.x1, pr.y2 - pr.y1) < 1e-4) continue;
    pr.mid = e.mid;
    if (sc < bd) {
      bd = sc;
      best = pr;
    }
    if (pr.type == voulu && sc < bTyd) {
      bTyd = sc;
      bTy = pr;
    }
  }
  return best.type != voulu && bTy.type != RIEN ? bTy : best;
}

// Repli du navigateur : une ligne de construction aux deux bouts fixés est traitée comme une projection
bool estSuivie(const Esquisse& s, const Entite& e) {
  if (e.proj) return true;
  if (!e.construction || e.t != "line") return false;
  bool f1 = false, f2 = false;
  for (const Contrainte& c : s.contraintes)
    if (c.type == "fix") {
      f1 = f1 || c.p == e.p1;
      f2 = f2 || c.p == e.p2;
    }
  return f1 && f2;
}

bool avecProjection(const Esquisse& s) {
  for (const Entite& e : s.entites)
    if (estSuivie(s, e) || e.suiviInconnu) return true;
  return false;
}

// updateAssociativeProjections0, sans ce que la pièce n'a pas : rend true si l'esquisse a bougé
bool suivreProjections(Esquisse& s, const std::vector<AreteSource>& aretes) {
  bool change = false;
  const auto noter = [](Entite& e, const Trouvee& pr) {
    e.aSrcMid = true;
    e.srcMid = pr.mid;
  };
  for (Entite& e : s.entites) {
    if (!estSuivie(s, e)) continue;
    const Vec3* pref = e.aSrcMid ? &e.srcMid : nullptr;
    if (e.t == "line") {
      auto ia = s.points.find(e.p1), ib = s.points.find(e.p2);
      if (ia == s.points.end() || ib == s.points.end()) continue;
      Pt& A = ia->second;
      Pt& B = ib->second;
      const Trouvee pr = areteLaPlusProche(s, aretes, (A.x + B.x) / 2, (A.y + B.y) / 2, pref, LIGNE, std::hypot(B.x - A.x, B.y - A.y) >= 1e-4);
      if (pr.type != LIGNE) continue;
      noter(e, pr);
      const double d1 = std::hypot(A.x - pr.x1, A.y - pr.y1) + std::hypot(B.x - pr.x2, B.y - pr.y2);
      const double d2 = std::hypot(A.x - pr.x2, A.y - pr.y2) + std::hypot(B.x - pr.x1, B.y - pr.y1);
      if (std::min(d1, d2) > 0.02) {
        if (d2 < d1) {
          A = {pr.x2, pr.y2};
          B = {pr.x1, pr.y1};
        } else {
          A = {pr.x1, pr.y1};
          B = {pr.x2, pr.y2};
        }
        change = true;
      }
    } else if (e.t == "circle") {
      auto ic = s.points.find(e.pc);
      if (ic == s.points.end()) continue;
      Pt& C = ic->second;
      const Trouvee pr = areteLaPlusProche(s, aretes, C.x, C.y, pref, CERCLE, false);
      if (pr.type != CERCLE) continue;
      noter(e, pr);
      if (std::hypot(C.x - pr.cx, C.y - pr.cy) > 0.02 || std::abs(e.r - pr.r) > 0.02) {
        C = {pr.cx, pr.cy};
        e.r = pr.r;
        change = true;
      }
    } else if (e.t == "arc") {
      auto ic = s.points.find(e.pc), ia = s.points.find(e.pa), ib = s.points.find(e.pb);
      if (ic == s.points.end() || ia == s.points.end() || ib == s.points.end()) continue;
      Pt& C = ic->second;
      Pt& A = ia->second;
      Pt& B = ib->second;
      const Trouvee pr = areteLaPlusProche(s, aretes, (A.x + B.x) / 2, (A.y + B.y) / 2, pref, ARC, false);
      if (pr.type != ARC) continue;
      noter(e, pr);
      if (std::hypot(C.x - pr.cx, C.y - pr.cy) > 0.02 || std::hypot(A.x - pr.x1, A.y - pr.y1) > 0.02 || std::hypot(B.x - pr.x2, B.y - pr.y2) > 0.02 || std::abs(e.r - pr.r) > 0.02) {
        C = {pr.cx, pr.cy};
        A = {pr.x1, pr.y1};
        B = {pr.x2, pr.y2};
        e.r = pr.r;
        change = true;
      }
    }
  }
  return change;
}

// Rang dans les fonctions de celle qui consomme l'esquisse (skConsumerIdx), -1 si aucune
int consommatrice(const Document& d, const std::string& id) {
  for (size_t i = 0; i < d.fonctions.size(); i++)
    if (d.fonctions[i].visible && d.fonctions[i].esquisse == id) return static_cast<int>(i);
  return -1;
}

// Les esquisses qui voient ce que l'esquisse i produit, dans l'ordre de la pièce
std::vector<size_t> suivantes(const Document& d, size_t i) {
  std::vector<size_t> out;
  const int k = consommatrice(d, d.esquisses[i].id);
  if (k < 0) return out;
  const auto rang = [&](size_t j) {
    const int c = consommatrice(d, d.esquisses[j].id);
    return c < 0 ? std::numeric_limits<int>::max() : c;
  };
  for (size_t j = 0; j < d.esquisses.size(); j++)
    if (j != i && rang(j) > k && avecProjection(d.esquisses[j])) out.push_back(j);
  std::stable_sort(out.begin(), out.end(), [&](size_t a, size_t b) { return rang(a) < rang(b); });
  return out;
}
}  // namespace

int fonctionConsommatrice(const Document& d, const std::string& id) { return consommatrice(d, id); }

std::string esquisseFigee(const Document& d, size_t i) {
  // Une esquisse libre, sans fonction ni lien avec le solide, ne dépend pas de ce que le natif ne sait pas calculer
  const Esquisse& e = d.esquisses[i];
  if (!d.nonPrisEnCharge.empty() && (consommatrice(d, e.id) >= 0 || e.hote.existe || avecProjection(e))) return "le solide de cette pièce n'est pas encore calculé par ce programme";
  const Solveur S(d.esquisses[i]);
  if (!S.prisEnCharge()) return S.raisonRefus();
  if (S.coteConvertie()) return "cette esquisse contient une ancienne cote d'entraxe à convertir dans le navigateur";
  for (const size_t j : suivantes(d, i)) {
    const Esquisse& s = d.esquisses[j];
    for (const Entite& e : s.entites)
      if (e.suiviInconnu) return "l'esquisse « " + s.nom + " » suit cette pièce d'une façon pas encore reprise (arête nommée ou intersection)";
    if (!Solveur(s).prisEnCharge()) return "l'esquisse « " + s.nom + " », qui dépend de celle-ci, n'est pas encore prise en charge";
  }
  return "";
}

std::string coteFigee(const Cote& c) {
  if (c.ref) return "cote de référence : elle mesure sans piloter";
  if (c.formule) return "cote définie par une formule : à changer dans le navigateur pour l'instant";
  if (!c.nom.empty()) return "cote nommée, peut-être utilisée ailleurs : à changer dans le navigateur pour l'instant";
  return "";
}

void suivreEsquisses(Document& d, size_t i) {
  for (const size_t j : suivantes(d, i)) {
    Esquisse& s = d.esquisses[j];
    ResultatRejeu r = rejouer(d, consommatrice(d, s.id));  // replace aussi les esquisses posées sur une face
    // Le solveur voit d'abord l'état d'avant, comme dans le navigateur qui l'a déjà résolu : sans cette mémoire,
    // un élément libre peut changer de côté (Drapeau, e29 à 82,8 : la découpe s'inverse).
    Solveur S(s);
    S.resoudre();
    Esquisse t = s;
    S.recopierDans(t);
    if (suivreProjections(t, listerAretes(r.forme))) {
      S.reprendrePoints(t);
      S.resoudre();
      S.recopierDans(t);
      s = std::move(t);
    } else {
      suivreProjections(s, listerAretes(r.forme));  // rien n'a bougé : seul le repère de l'arête source est rafraîchi
    }
  }
}

bool saisirCote(Document& d, size_t i, Edition& ed, const std::string& idCote, double valeur, std::string& raison) {
  if (!ed.resolue) {
    ed.solveur.resoudre();
    ed.resolue = true;
  }
  if (!ed.solveur.saisir(idCote, valeur, &raison)) return false;
  ed.solveur.recopierDans(d.esquisses[i]);
  suivreEsquisses(d, i);
  return true;
}
