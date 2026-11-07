#include "contours.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <map>
#include <set>
#include <stdexcept>

namespace {
const double PI = 3.14159265358979323846, TAU = PI * 2;

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

std::vector<P2d> polyArete(const Arete& ed, const std::string& depuis) {  // skEdgePoly
  std::vector<P2d> pl = ed.poly;
  if (ed.a != depuis) std::reverse(pl.begin(), pl.end());
  return pl;
}

namespace {
struct MorceauSpline {
  std::string a, b;
  const Entite* e = nullptr;
  BSpline bs;
  std::vector<P2d> poly;
  double o = 0, i = 0;
  std::vector<std::pair<std::string, P2d>> virt;
};
// skSplineEdges + skSplineCutsFor
std::vector<MorceauSpline> morceauxSpline(const Esquisse& s, const Entite& e, const std::vector<std::string>& bouts) {
  std::vector<MorceauSpline> out;
  BSpline f;
  if (!splineDe(s, e, f) || e.pts.empty()) return out;
  struct Noeud {
    double u;
    std::string id;
  };
  std::vector<Noeud> coupes;
  for (const std::string& pid : bouts) {
    if (pid == e.pts.front() || pid == e.pts.back()) continue;
    const Pt* Q = s.point(pid);
    if (!Q) continue;
    const PiedSpline h = bsClosest(f, Q->x, Q->y, nullptr);
    if (h.d < 1e-3 && h.u > f.a + 1e-9 && h.u < f.b - 1e-9) coupes.push_back({h.u, pid});
  }
  std::vector<std::pair<std::string, P2d>> virt;
  const auto en = [&](double u) { return bsEval(f, u, 0)[0]; };
  const bool boucle = e.closed || e.pts.front() == e.pts.back();
  std::vector<Noeud> noeuds;
  if (!boucle) noeuds = {{f.a, e.pts.front()}, {f.b, e.pts.back()}};
  else if (f.ctrl && f.closed) {
    const std::string id = "__s" + e.id + "a";
    virt.push_back({id, en(f.a)});
    noeuds = {{f.a, id}, {f.b, id}};
  } else noeuds = {{f.a, e.pts.front()}, {f.b, e.pts.front()}};
  for (const Noeud& c : coupes) {
    if (!(c.u > f.a + 1e-9 && c.u < f.b - 1e-9)) continue;
    bool deja = false;
    for (const Noeud& n : noeuds) deja = deja || std::abs(n.u - c.u) < 1e-9 || n.id == c.id;
    if (!deja) noeuds.push_back(c);
  }
  std::stable_sort(noeuds.begin(), noeuds.end(), [](const Noeud& x, const Noeud& y) { return x.u < y.u; });
  if (boucle && noeuds.size() < 3) {  // boucle sans autre nœud : coupée au milieu (point de passage, sinon nœud virtuel)
    bool trouve = false;
    Noeud mid{0, ""};
    if (!f.ctrl && !f.u.empty()) {
      const size_t m = std::max<size_t>(1, e.pts.size() / 2);
      if (m < f.u.size() && f.u[m] > f.a && f.u[m] < f.b && s.point(e.pts[m])) {
        mid = {f.u[m], e.pts[m]};
        trouve = true;
      }
    }
    if (!trouve) {
      const std::string id = "__s" + e.id + "b";
      const double u = (f.a + f.b) / 2;
      virt.push_back({id, en(u)});
      mid = {u, id};
    }
    noeuds.insert(noeuds.begin() + 1, mid);
  }
  const auto ptDe = [&](const Noeud& n) -> P2d {
    for (auto& v : virt)
      if (v.first == n.id) return v.second;
    if (const Pt* q = s.point(n.id)) return {q->x, q->y};
    return en(n.u);
  };
  for (size_t i = 0; i + 1 < noeuds.size(); i++) {
    const Noeud& A = noeuds[i];
    const Noeud& B = noeuds[i + 1];
    if (!(B.u - A.u > 1e-12)) continue;
    const P2d pa = ptDe(A), pb = ptDe(B);
    MorceauSpline m;
    m.a = A.id;
    m.b = B.id;
    m.e = &e;
    m.bs = bsRange(f, A.u, B.u, &pa, &pb);
    const double u0 = m.bs.U.front(), u1 = m.bs.U.back();
    const P2d d0 = bsEval(m.bs, u0, 1)[1], d1 = bsEval(m.bs, u1, 1)[1];
    m.poly = bsSample(m.bs, u0, u1, 16);
    m.o = std::atan2(d0[1], d0[0]);
    m.i = std::atan2(d1[1], d1[0]);
    m.virt = virt;
    out.push_back(std::move(m));
  }
  return out;
}
}  // namespace

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
  // Splines : arêtes calculées ici (skSplineEdges). Un bout de ligne, d'arc ou d'une autre spline posé sur la courbe
  // la coupe (jonction en T) ; une spline fermée est coupée en deux, ses nœuds virtuels « __s… » s'ajoutent aux points.
  std::vector<MorceauSpline> morceaux;
  {
    std::vector<std::string> bouts;
    std::set<std::string> vus;
    const auto bout = [&](const std::string& p) {
      if (vus.insert(p).second) bouts.push_back(p);
    };
    for (auto* l : lignes) {
      bout(l->p1);
      bout(l->p2);
    }
    for (auto* a : arcs) {
      bout(a->pa);
      bout(a->pb);
    }
    for (auto& e : s.entites)
      if (e.t == "spline" && !e.construction && !e.pts.empty()) {
        bout(e.pts.front());
        bout(e.pts.back());
      }
    for (auto& e : s.entites) {
      if (e.t != "spline" || e.construction) continue;
      for (MorceauSpline& m : morceauxSpline(s, e, bouts)) {
        for (auto& v : m.virt) {
          if (tr.pts.find(v.first) == tr.pts.end()) ordre.push_back(v.first);
          tr.pts[v.first] = Pt{v.second[0], v.second[1]};
        }
        morceaux.push_back(std::move(m));
      }
    }
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
  std::vector<int> aretesSpline;
  for (MorceauSpline& m : morceaux) {
    const int ei = pousser(m.a, m.b, m.e, false);
    tr.aretes[ei].spline = true;
    tr.aretes[ei].bs = std::move(m.bs);
    tr.aretes[ei].poly = std::move(m.poly);
    aretesSpline.push_back(ei);
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
  for (size_t k = 0; k < morceaux.size(); k++) ajouter(aretesSpline[k], morceaux[k].o, morceaux[k].i);  // tangentes de départ et d'arrivée
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
      if (ed.spline) {
        const std::vector<P2d> pl = polyArete(ed, h.de);
        for (size_t k = 1; k < pl.size(); k++) r.push_back({pl[k][0], pl[k][1]});
      } else if (!ed.arc) {
        const Pt& q = tr.pts[h.vers];
        r.push_back({q.x, q.y});
      } else {
        const Entite& a = *ed.e;
        const Pt& Cc = tr.pts[a.pc];
        auto an = anglesArc(s, a);
        if (!an) continue;
        bool av = ed.a == h.de;
        // À rebours, l'arc se parcourt en sens horaire (l'anneau prenait le RESTE du cercle : disque fantôme sur un arc creux)
        const double sA = av ? an->a1 : an->a2, sens = av ? 1 : -1;
        double dd = std::fmod(std::fmod(an->a2 - an->a1, TAU) + TAU, TAU);
        if (dd < 1e-9) dd = TAU;
        int n2 = std::max(2, static_cast<int>(std::ceil(dd / TAU * 24)));
        for (int k = 1; k <= n2; k++) {
          double t = sA + sens * dd * k / n2;
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
  for (const auto& f : faces) tr.faces.push_back({f.anneau, f.aire, versChaine(f.pas)});
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
  tr.cercles = cercles;
  return tr;
}

// ---- Zones fermées : une zone est une face du découpage du plan par les traits, moins ce qui est posé dedans
namespace {
double distBord(double x, double y, const Anneau& rg) {  // skRingDist
  double m = 1e18;
  for (size_t i = 0; i < rg.size(); i++) {
    const auto& a = rg[i];
    const auto& b = rg[(i + 1) % rg.size()];
    const double dx = b[0] - a[0], dy = b[1] - a[1];
    double L2 = dx * dx + dy * dy;
    if (L2 == 0) L2 = 1e-18;
    double t = ((x - a[0]) * dx + (y - a[1]) * dy) / L2;
    t = std::max(0.0, std::min(1.0, t));
    m = std::min(m, std::hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)));
  }
  return m;
}
bool bordContient(const BordZone& b, double x, double y) {  // skRegBoundIn : frontière exclue
  if (b.cercle) return std::hypot(x - b.C.x, y - b.C.y) < b.r - 1e-6;
  return dansAnneau(x, y, b.ring) && distBord(x, y, b.ring) > 1e-6;
}
bool zoneContient(const ZoneEsq& R, double x, double y) {  // skRegHas
  if (!bordContient(R.K, x, y)) return false;
  for (const BordZone& b : R.trous)
    if (bordContient(b, x, y)) return false;
  return true;
}
bool pointMatiere(const Trace& tr, const Esquisse& s, double x, double y) {  // skTraceMatter
  const auto dansC = [&](const Entite* c) {
    const Pt* C = s.point(c->pc);
    return C && std::hypot(x - C->x, y - C->y) < c->r;
  };
  for (const Entite* c : tr.cerclesSeuls)
    if (dansC(c)) return true;
  for (size_t si = 0; si < tr.solides.size(); si++) {
    const ContourPlein& sol = tr.solides[si];
    if (sol.faces.empty() || sol.faces[0] >= static_cast<int>(tr.faces.size()) || !dansAnneau(x, y, tr.faces[sol.faces[0]].ring)) continue;
    bool dehors = false;
    for (size_t k = 1; k < sol.faces.size(); k++)
      if (sol.faces[k] < static_cast<int>(tr.faces.size()) && dansAnneau(x, y, tr.faces[sol.faces[k]].ring)) dehors = true;
    if (dehors) continue;
    for (const TrouRond& ch : tr.trousRonds)
      if (ch.solide == static_cast<int>(si) && dansC(ch.cercle)) dehors = true;
    if (!dehors) return true;
  }
  return false;
}
bool pointInterieur(ZoneEsq& R) {  // skRegInner : grille puis affinage
  double x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
  for (const auto& p : R.K.ring) {
    x0 = std::min(x0, p[0]);
    y0 = std::min(y0, p[1]);
    x1 = std::max(x1, p[0]);
    y1 = std::max(y1, p[1]);
  }
  if (!(x1 > x0 && y1 > y0)) return false;
  const auto large = [&](double x, double y) {
    if (!zoneContient(R, x, y)) return -1.0;
    double d = R.K.cercle ? R.K.r - std::hypot(x - R.K.C.x, y - R.K.C.y) : distBord(x, y, R.K.ring);
    for (const BordZone& b : R.trous) d = std::min(d, b.cercle ? std::hypot(x - b.C.x, y - b.C.y) - b.r : distBord(x, y, b.ring));
    return d;
  };
  bool trouve = false;
  std::array<double, 2> best{};
  double bd = 0, sx = (x1 - x0) / 32, sy = (y1 - y0) / 32;
  for (int i = 0; i < 32; i++)
    for (int j = 0; j < 32; j++) {
      const double x = x0 + (i + 0.5) * sx, y = y0 + (j + 0.5) * sy, d = large(x, y);
      if (d > bd) {
        bd = d;
        best = {x, y};
        trouve = true;
      }
    }
  if (!trouve) {  // zone très fine : centre d'un triangle de l'anneau
    const Anneau& r = R.K.ring;
    for (size_t i = 1; i + 1 < r.size(); i++) {
      const double x = (r[0][0] + r[i][0] + r[i + 1][0]) / 3, y = (r[0][1] + r[i][1] + r[i + 1][1]) / 3;
      if (large(x, y) > 0) {
        R.pt = {x, y};
        return true;
      }
    }
    return false;
  }
  for (int k = 0; k < 3; k++) {
    sx /= 2;
    sy /= 2;
    const std::array<double, 2> c = best;
    for (int i = -2; i <= 2; i++)
      for (int j = -2; j <= 2; j++) {
        const double x = c[0] + i * sx, y = c[1] + j * sy, d = large(x, y);
        if (d > bd) {
          bd = d;
          best = {x, y};
        }
      }
  }
  R.pt = best;
  return true;
}
}  // namespace

std::vector<ZoneEsq> zonesEsquisse(const Esquisse& s, const Trace& tr) {
  std::vector<BordZone> conts, bords;
  for (size_t i = 0; i < tr.faces.size(); i++) {
    BordZone b;
    b.face = static_cast<int>(i);
    b.ring = tr.faces[i].ring;
    b.aire = std::abs(tr.faces[i].aire);
    (tr.faces[i].aire > 0 ? conts : bords).push_back(std::move(b));
  }
  for (const Entite* c : tr.cercles) {
    const Pt* C = s.point(c->pc);
    if (!C || !(c->r > 0)) continue;
    BordZone b;
    b.cercle = true;
    b.c = c;
    b.C = *C;
    b.r = c->r;
    b.aire = PI * c->r * c->r;
    for (int i = 0; i < 64; i++) {
      const double a = static_cast<double>(i) / 64 * PI * 2;
      b.ring.push_back({C->x + c->r * std::cos(a), C->y + c->r * std::sin(a)});
    }
    conts.push_back(b);
    bords.push_back(std::move(b));
  }
  std::vector<ZoneEsq> regs;
  for (const BordZone& K : conts) {
    ZoneEsq R;
    R.K = K;
    R.aire = K.aire;
    regs.push_back(std::move(R));
  }
  for (const BordZone& b : bords) {
    // Le conteneur : la plus petite zone qui l'entoure strictement (jamais lui-même ni son jumeau)
    ZoneEsq* best = nullptr;
    for (ZoneEsq& R : regs) {
      const BordZone& K = R.K;
      if ((K.cercle && b.cercle && K.c == b.c) || !(K.aire > b.aire * (1 + 1e-9) + 1e-12)) continue;
      if (best && K.aire >= best->K.aire) continue;
      bool dedans = true;
      for (const auto& p : b.ring)
        if (!bordContient(K, p[0], p[1])) {
          dedans = false;
          break;
        }
      if (dedans) best = &R;
    }
    if (best) {
      best->trous.push_back(b);
      best->aire -= b.aire;
    }
  }
  regs.erase(std::remove_if(regs.begin(), regs.end(), [](const ZoneEsq& R) { return !(R.aire > 1e-6); }), regs.end());
  return regs;
}

void completerZones(const Esquisse& s, const Trace& tr, std::vector<ZoneEsq>& zones) {
  for (ZoneEsq& R : zones) {
    R.aPoint = pointInterieur(R);
    R.parDefaut = R.aPoint && pointMatiere(tr, s, R.pt[0], R.pt[1]);
  }
}

int zoneEn(const std::vector<ZoneEsq>& zones, double x, double y) {
  int best = -1;
  for (size_t i = 0; i < zones.size(); i++)
    if (zoneContient(zones[i], x, y) && (best < 0 || zones[i].aire < zones[best].aire)) best = static_cast<int>(i);
  return best;
}

Trace tracePourZones(const Esquisse& s, const std::vector<std::array<double, 2>>& choix) {
  Trace tr = tracerContours(s);
  if (choix.empty()) return tr;
  const std::vector<ZoneEsq> regs = zonesEsquisse(s, tr);
  std::vector<int> pris;
  for (const auto& p : choix) {
    const int k = zoneEn(regs, p[0], p[1]);
    if (k >= 0 && std::find(pris.begin(), pris.end(), k) == pris.end()) pris.push_back(k);
  }
  std::vector<ContourPlein> solides;
  std::vector<const Entite*> seuls;
  std::vector<TrouRond> ronds;
  for (int k : pris) {
    const ZoneEsq& R = regs[k];
    if (R.K.cercle && R.trous.empty()) {
      seuls.push_back(R.K.c);
      continue;
    }
    const int si = static_cast<int>(solides.size());
    ContourPlein c;
    c.aire = R.K.aire;
    for (const BordZone& b : R.trous)
      if (!b.cercle) c.trous.push_back(tr.faces[b.face].chaine);
    if (R.K.cercle) c.cercle = R.K.c;
    else c.chaine = tr.faces[R.K.face].chaine;
    solides.push_back(std::move(c));
    for (const BordZone& b : R.trous)
      if (b.cercle) ronds.push_back({b.c, si});
  }
  tr.solides = std::move(solides);
  tr.cerclesSeuls = std::move(seuls);
  tr.trousRonds = std::move(ronds);
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
