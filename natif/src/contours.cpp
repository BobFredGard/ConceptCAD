#include "contours.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <map>
#include <set>
#include <stdexcept>

namespace {
const double PI = 3.14159265358979323846, TAU = PI * 2;
using Anneau = std::vector<std::array<double, 2>>;

double normAng(double a) {
  a = std::fmod(a, TAU);
  if (a < 0) a += TAU;
  return a;
}
struct DemiArete {
  std::string de, vers;
  double oAng, iAng;
  int arete, jumelle;
  bool utilise = false;
};
struct FaceBrute {
  std::vector<int> pas;
  Anneau anneau;
  double aire = 0;
  int parent = -1, profondeur = 0;
  std::vector<int> enfants;
};
double aireAnneau(const Anneau& r) {
  double s = 0;
  for (size_t i = 0; i < r.size(); i++) {
    auto& a = r[i];
    auto& b = r[(i + 1) % r.size()];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}
bool dansAnneau(double x, double y, const Anneau& r) {
  bool ins = false;
  for (size_t i = 0, j = r.size() - 1; i < r.size(); j = i++) {
    double xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if (((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
  }
  return ins;
}
double distSegment(double px, double py, double ax, double ay, double bx, double by) {
  double dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  if (L2 == 0) L2 = 1e-18;
  double t = ((px - ax) * dx + (py - ay) * dy) / L2;
  t = std::max(0.0, std::min(1.0, t));
  return std::hypot(px - (ax + t * dx), py - (ay + t * dy));
}
double distAnneau(double x, double y, const Anneau& r) {
  double m = 1e18;
  for (size_t i = 0; i < r.size(); i++) {
    auto& a = r[i];
    auto& b = r[(i + 1) % r.size()];
    m = std::min(m, distSegment(x, y, a[0], a[1], b[0], b[1]));
  }
  return m;
}
bool strictementDedans(double x, double y, const Anneau& r) { return dansAnneau(x, y, r) && distAnneau(x, y, r) > 1e-6; }
std::string cleAnneau(const Anneau& r) {
  double x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18;
  for (auto& p : r) {
    x0 = std::min(x0, p[0]);
    x1 = std::max(x1, p[0]);
    y0 = std::min(y0, p[1]);
    y1 = std::max(y1, p[1]);
  }
  char b[160];
  snprintf(b, sizeof b, "%zu|%.3f,%.3f|%.3f,%.3f", r.size(), x0, y0, x1, y1);
  return b;
}
}  // namespace

std::optional<Angles> anglesArc(const Esquisse& s, const Entite& e) {
  const Pt* C = s.point(e.pc);
  const Pt* A = s.point(e.pa);
  const Pt* B = s.point(e.pb);
  if (!C || !A || !B) return std::nullopt;
  double a1 = std::atan2(A->y - C->y, A->x - C->x);
  if (e.pa == e.pb) return Angles{a1, a1 + TAU};
  double a2 = std::atan2(B->y - C->y, B->x - C->x);
  double d = std::fmod(a2 - a1, TAU);
  if (d <= 0) d += TAU;
  return Angles{a1, a1 + d};
}

Trace tracerContours(const Esquisse& s) {
  Trace tr;
  tr.pts = s.points;
  std::vector<std::string> ordre = s.ordre;
  std::vector<const Entite*> lignes, arcs, cercles;
  for (auto& e : s.entites) {
    if (e.construction) continue;
    if (e.t == "line" && !e.ref) {
      const Pt* A = s.point(e.p1);
      const Pt* B = s.point(e.p2);
      if (A && B && std::hypot(B->x - A->x, B->y - A->y) > 1e-9) lignes.push_back(&e);
    } else if (e.t == "arc") {
      if (s.point(e.pc) && s.point(e.pa) && s.point(e.pb) && e.r > 1e-9) arcs.push_back(&e);
    } else if (e.t == "circle") {
      if (s.point(e.pc) && e.r > 1e-9) cercles.push_back(&e);
    }
  }
  std::map<const Entite*, std::array<std::string, 2>> boutsArc;
  int tn = 0;
  for (auto* a : arcs) {
    auto an = anglesArc(s, *a);
    if (!an) continue;
    const Pt* C = s.point(a->pc);
    std::string pa = "__a" + std::to_string(tn++), pb = "__a" + std::to_string(tn++);
    tr.pts[pa] = Pt{C->x + a->r * std::cos(an->a1), C->y + a->r * std::sin(an->a1)};
    tr.pts[pb] = Pt{C->x + a->r * std::cos(an->a2), C->y + a->r * std::sin(an->a2)};
    ordre.push_back(pa);
    ordre.push_back(pb);
    boutsArc[a] = {pa, pb};
  }
  // Noeuds quasi confondus (1 micron) fusionnés sur le premier rencontré
  std::unordered_map<std::string, std::string> canon;
  std::vector<std::string> reps;
  for (auto& pid : ordre) {
    const Pt& p = tr.pts[pid];
    std::string choisi;
    for (auto& r : reps) {
      const Pt& q = tr.pts[r];
      if (std::hypot(q.x - p.x, q.y - p.y) < 1e-3) {
        choisi = r;
        break;
      }
    }
    if (choisi.empty()) {
      reps.push_back(pid);
      choisi = pid;
    }
    canon[pid] = choisi;
  }
  auto Cid = [&](const std::string& p) {
    auto it = canon.find(p);
    return it == canon.end() ? p : it->second;
  };
  std::map<const Entite*, int> indiceArete;
  auto pousser = [&](const std::string& a, const std::string& b, const Entite* e, bool arc) {
    tr.aretes.push_back(Arete{Cid(a), Cid(b), e, arc});
    return static_cast<int>(tr.aretes.size()) - 1;
  };
  for (auto* l : lignes) indiceArete[l] = pousser(l->p1, l->p2, l, false);
  for (auto* a : arcs) {
    auto it = boutsArc.find(a);
    if (it != boutsArc.end()) indiceArete[a] = pousser(it->second[0], it->second[1], a, true);
  }
  std::vector<DemiArete> hes;
  auto ajouter = [&](int ei, double o, double i) {
    auto& ed = tr.aretes[ei];
    int a = static_cast<int>(hes.size());
    hes.push_back(DemiArete{ed.a, ed.b, normAng(o), normAng(i), ei, a + 1});
    hes.push_back(DemiArete{ed.b, ed.a, normAng(i + PI), normAng(o + PI), ei, a});
  };
  for (auto* l : lignes) {
    const Pt& A = tr.pts[Cid(l->p1)];
    const Pt& B = tr.pts[Cid(l->p2)];
    double a = std::atan2(B.y - A.y, B.x - A.x);
    ajouter(indiceArete[l], a, a);
  }
  for (auto* a : arcs) {
    auto it = indiceArete.find(a);
    if (it == indiceArete.end()) continue;
    auto an = anglesArc(s, *a);
    if (an) ajouter(it->second, an->a1 + PI / 2, an->a2 + PI / 2);
  }
  std::unordered_map<std::string, std::vector<int>> sortants;
  for (int i = 0; i < static_cast<int>(hes.size()); i++) sortants[hes[i].de].push_back(i);
  // Successeur : plus petit virage horaire depuis le retour (mur à gauche)
  auto successeur = [&](int hi) {
    auto& h = hes[hi];
    double rev = normAng(h.iAng + PI);
    int best = -1;
    double bestCw = 1e9;
    for (int j : sortants[h.vers]) {
      if (j == h.jumelle || hes[j].utilise) continue;
      double cw = normAng(rev - hes[j].oAng);
      if (cw < bestCw - 1e-12) {
        bestCw = cw;
        best = j;
      }
    }
    return best >= 0 ? best : h.jumelle;
  };
  std::vector<std::vector<int>> brutes;
  for (int i = 0; i < static_cast<int>(hes.size()); i++) {
    if (hes[i].utilise) continue;
    std::string depart = hes[i].de;
    hes[i].utilise = true;
    std::vector<int> pile{i};
    std::set<int> vus{i};
    int cur = i, garde = 0;
    bool fini = false;
    while (garde++ < 10000) {
      int nx = successeur(cur);
      if (nx < 0) break;
      cur = nx;
      hes[cur].utilise = true;
      if (!pile.empty() && hes[pile.back()].jumelle == cur) pile.pop_back();
      else pile.push_back(cur);
      if (hes[cur].vers == depart) {
        fini = true;
        break;
      }
      if (vus.count(cur)) break;
      vus.insert(cur);
    }
    if (fini && !pile.empty()) brutes.push_back(pile);
  }
  auto anneauDe = [&](const std::vector<int>& pas) {
    Anneau r;
    for (int ci : pas) {
      auto& h = hes[ci];
      auto& ed = tr.aretes[h.arete];
      if (!ed.arc) {
        const Pt& q = tr.pts[h.vers];
        r.push_back({q.x, q.y});
      } else {
        const Entite& a = *ed.e;
        const Pt& Cc = tr.pts[a.pc];
        auto an = anglesArc(s, a);
        if (!an) continue;
        bool av = ed.a == h.de;
        double sA = av ? an->a1 : an->a2, sB = av ? an->a2 : an->a1;
        double dd = std::fmod(std::fmod(sB - sA, TAU) + TAU, TAU);
        if (dd < 1e-9) dd = TAU;
        int n2 = std::max(2, static_cast<int>(std::ceil(dd / TAU * 24)));
        for (int k = 1; k <= n2; k++) {
          double t = sA + dd * k / n2;
          r.push_back({Cc.x + a.r * std::cos(t), Cc.y + a.r * std::sin(t)});
        }
      }
    }
    return r;
  };
  std::vector<FaceBrute> faces;
  for (auto& pas : brutes) {
    Anneau r = anneauDe(pas);
    if (r.size() < 3) continue;
    double ai = aireAnneau(r);
    if (std::abs(ai) < 1e-6) continue;  // éperon / dégénéré
    FaceBrute f;
    f.pas = pas;
    f.anneau = std::move(r);
    f.aire = ai;
    faces.push_back(std::move(f));
  }
  // Imbrication stricte : un jumeau (même anneau) ne peut jamais être parent
  for (size_t i = 0; i < faces.size(); i++) {
    int best = -1;
    double bestA = 1e18;
    for (size_t j = 0; j < faces.size(); j++) {
      if (i == j) continue;
      auto& g = faces[j];
      if (!(std::abs(g.aire) > std::abs(faces[i].aire) * 1.000000001 + 1e-12)) continue;
      bool ok = !faces[i].anneau.empty();
      for (auto& v : faces[i].anneau)
        if (!strictementDedans(v[0], v[1], g.anneau)) {
          ok = false;
          break;
        }
      if (ok && std::abs(g.aire) < bestA) {
        bestA = std::abs(g.aire);
        best = static_cast<int>(j);
      }
    }
    faces[i].parent = best;
  }
  for (size_t i = 0; i < faces.size(); i++)
    if (faces[i].parent >= 0) faces[faces[i].parent].enfants.push_back(static_cast<int>(i));
  for (auto& f : faces) {
    int d = 0, p = f.parent;
    while (p >= 0) {
      d++;
      p = faces[p].parent;
    }
    f.profondeur = d;
  }
  auto versChaine = [&](const std::vector<int>& pas) {
    Chaine c;
    for (int ci : pas) c.push_back(Pas{hes[ci].arete, hes[ci].de});
    return c;
  };
  auto estTrou = [](const FaceBrute& f) { return f.profondeur % 2 == 1 && f.aire < 0; };
  for (size_t i = 0; i < faces.size(); i++) {
    auto& f = faces[i];
    if (f.parent < 0 && f.aire < 0) continue;  // face infinie
    if (f.profondeur % 2 == 0) {
      std::set<std::string> vus;
      ContourPlein c;
      c.chaine = versChaine(f.pas);
      c.aire = f.aire;
      c.faces.push_back(static_cast<int>(i));
      for (int e : f.enfants) {
        if (!(faces[e].profondeur % 2 == 1 && faces[e].aire < 0)) continue;
        std::string k = cleAnneau(faces[e].anneau);
        if (vus.insert(k).second) {
          c.trous.push_back(versChaine(faces[e].pas));
          c.faces.push_back(e);
        }
      }
      tr.solides.push_back(std::move(c));
      continue;
    }
    if (f.aire < 0) continue;  // trou déjà rattaché à son solide
    if (estTrou(faces[f.parent])) {  // îlot dans un trou : solide propre
      ContourPlein c;
      c.chaine = versChaine(f.pas);
      c.aire = f.aire;
      c.faces.push_back(static_cast<int>(i));
      tr.solides.push_back(std::move(c));
    }
  }
  // Cercles complets : trou du solide dont la matière les contient, sinon solide propre
  for (auto* c : cercles) {
    const Pt* Cc = s.point(c->pc);
    double rx = Cc->x + c->r, ry = Cc->y;
    int best = -1;
    double bestA = 1e18;
    for (size_t j = 0; j < faces.size(); j++) {
      auto& f = faces[j];
      if (std::abs(f.aire) < bestA && dansAnneau(rx, ry, f.anneau) && distAnneau(rx, ry, f.anneau) > 1e-6) {
        bestA = std::abs(f.aire);
        best = static_cast<int>(j);
      }
    }
    bool pris = false;
    if (best >= 0 && faces[best].profondeur % 2 == 0)
      for (size_t si = 0; si < tr.solides.size() && !pris; si++)
        if (std::find(tr.solides[si].faces.begin(), tr.solides[si].faces.end(), best) != tr.solides[si].faces.end()) {
          tr.trousRonds.push_back(TrouRond{c, static_cast<int>(si)});
          pris = true;
        }
    if (!pris) tr.cerclesSeuls.push_back(c);
  }
  // Bouts ouverts. Un bout qui repose sur un vrai cercle ou arc est raccordé, pas ouvert.
  std::vector<std::string> ordreDegre;
  std::unordered_map<std::string, int> degre;
  for (const Arete& ed : tr.aretes)
    for (const std::string* q : {&ed.a, &ed.b})
      if (degre[*q]++ == 0) ordreDegre.push_back(*q);
  const auto surCourbe = [&](const Pt& q) {
    for (const Entite* c : cercles) {
      const Pt* C = s.point(c->pc);
      if (C && std::abs(std::hypot(q.x - C->x, q.y - C->y) - c->r) < 0.02) return true;
    }
    for (const Entite* a : arcs) {
      const Pt* C = s.point(a->pc);
      if (!C || std::abs(std::hypot(q.x - C->x, q.y - C->y) - a->r) > 0.02) continue;
      const auto an = anglesArc(s, *a);
      if (!an) continue;
      double d = std::fmod(an->a2 - an->a1, TAU);
      if (d < 0) d += TAU;
      double r = std::fmod(std::atan2(q.y - C->y, q.x - C->x) - an->a1, TAU);
      if (r < 0) r += TAU;
      if (r <= d) return true;
    }
    return false;
  };
  for (const std::string& id : ordreDegre) {
    const auto it = tr.pts.find(id);
    if (degre[id] == 1 && it != tr.pts.end() && !surCourbe(it->second)) tr.ouverts.push_back(it->second);
  }
  return tr;
}

std::optional<Esquisse> tangencesExactes(const Esquisse& s) {
  std::vector<const Entite*> L;
  for (auto& e : s.entites)
    if (!e.construction) L.push_back(&e);
  std::unordered_map<std::string, int> degre;
  for (auto* e : L)
    for (auto* p : {&e->p1, &e->p2, &e->pa, &e->pb})
      if (!p->empty()) degre[*p]++;
  std::optional<Esquisse> copie;
  for (auto* a : L) {
    if (a->t != "arc" || !(a->r > 0) || a->pa == a->pb) continue;
    const Pt* C = s.point(a->pc);
    if (!C) continue;
    for (auto* pid : {&a->pa, &a->pb}) {
      if (degre[*pid] != 2) continue;  // jonction d'une ligne et d'un arc, rien d'autre
      const Entite* l = nullptr;
      for (auto* e : L)
        if (e->t == "line" && (e->p1 == *pid || e->p2 == *pid)) {
          l = e;
          break;
        }
      const Pt* Q = s.point(*pid);
      const Pt* R = l ? s.point(l->p1 == *pid ? l->p2 : l->p1) : nullptr;
      if (!Q || !R) continue;
      double n = std::hypot(Q->x - R->x, Q->y - R->y);
      if (!(n > 1e-6)) continue;
      double ux = (Q->x - R->x) / n, uy = (Q->y - R->y) / n, t = (C->x - R->x) * ux + (C->y - R->y) * uy;
      Pt F{R->x + ux * t, R->y + uy * t};
      double d = std::hypot(F.x - Q->x, F.y - Q->y);
      if (std::abs(std::hypot(C->x - F.x, C->y - F.y) - a->r) > 1e-7 || d <= 1e-7 || d > 0.02) continue;
      if (!copie) copie = s;
      copie->points[*pid] = F;
    }
  }
  return copie;
}
