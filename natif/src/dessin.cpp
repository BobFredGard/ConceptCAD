#include "dessin.h"

#include "infos_esquisse.h"

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <limits>

#include "cote_geometrie.h"
#include "dessin_commun.h"
#include "maths_js.h"

namespace {
constexpr double SK_OK = 0.05;

double distSeg(double px, double py, const Pt& A, const Pt& B) {
  const double dx = B.x - A.x, dy = B.y - A.y;
  double L2 = dx * dx + dy * dy;
  if (L2 == 0) L2 = 1e-9;
  double t = ((px - A.x) * dx + (py - A.y) * dy) / L2;
  t = jsmax(0, jsmin(1, t));
  return hyp(px - (A.x + t * dx), py - (A.y + t * dy));
}
std::string paire(const std::string& x, const std::string& y) { return x < y ? x + "|" + y : y + "|" + x; }
// angleVertex : sommet commun, sinon intersection des deux droites
bool sommetAngle(const Esquisse& s, const std::string& a, const std::string& b, Pt& V) {
  const Entite* A = s.entite(a);
  const Entite* B = s.entite(b);
  if (!A || !B || A->t != "line" || B->t != "line") return false;
  for (const std::string* q : {&A->p1, &A->p2})
    if (*q == B->p1 || *q == B->p2)
      if (const Pt* P = s.point(*q)) {
        V = *P;
        return true;
      }
  const Pt* A1 = s.point(A->p1);
  const Pt* A2 = s.point(A->p2);
  const Pt* B1 = s.point(B->p1);
  const Pt* B2 = s.point(B->p2);
  if (!A1 || !A2 || !B1 || !B2) return false;
  const double ax = A2->x - A1->x, ay = A2->y - A1->y, bx = B2->x - B1->x, by = B2->y - B1->y, cr = ax * by - ay * bx;
  const double la = hyp(ax, ay), lb = hyp(bx, by);
  if (la > 1e-12 && lb > 1e-12 && std::abs(cr) / (la * lb) > 1e-4) {
    const double t = ((B1->x - A1->x) * by - (B1->y - A1->y) * bx) / cr;
    V = {A1->x + ax * t, A1->y + ay * t};
    return true;
  }
  V = {((A1->x + A2->x) / 2 + (B1->x + B2->x) / 2) / 2, ((A1->y + A2->y) / 2 + (B1->y + B2->y) / 2) / 2};
  return true;
}
struct SecteurAngle {
  double sA = 0, sB = 0, delta = 0;
};
// angleFrame
bool secteurAngle(const Esquisse& s, const std::string& a, const std::string& b, SecteurAngle& f) {
  const Entite* A = s.entite(a);
  const Entite* B = s.entite(b);
  if (!A || !B || A->t != "line" || B->t != "line") return false;
  const Pt* A1 = s.point(A->p1);
  const Pt* A2 = s.point(A->p2);
  const Pt* B1 = s.point(B->p1);
  const Pt* B2 = s.point(B->p2);
  Pt V;
  if (!A1 || !A2 || !B1 || !B2 || !sommetAngle(s, a, b, V)) return false;
  const Pt* fA = hyp(A1->x - V.x, A1->y - V.y) > hyp(A2->x - V.x, A2->y - V.y) ? A1 : A2;
  const Pt* fB = hyp(B1->x - V.x, B1->y - V.y) > hyp(B2->x - V.x, B2->y - V.y) ? B1 : B2;
  f.sA = m_atan2(fA->y - V.y, fA->x - V.x);
  f.sB = m_atan2(fB->y - V.y, fB->x - V.x);
  const double T = PI_ * 2;
  f.delta = std::fmod(f.sB - f.sA, T);
  if (f.delta <= -PI_) f.delta += T;
  else if (f.delta > PI_) f.delta -= T;
  return true;
}
// lineGap
double ecartLignes(const Esquisse& s, const Entite& A, const Entite& B) {
  const Pt* A1 = s.point(A.p1);
  const Pt* A2 = s.point(A.p2);
  const Pt* B1 = s.point(B.p1);
  const Pt* B2 = s.point(B.p2);
  if (!A1 || !A2 || !B1) return 0;
  const double dx = A2->x - A1->x, dy = A2->y - A1->y, L0 = hyp(dx, dy), L = L0 != 0 ? L0 : 1e-9;
  const double d1 = std::abs((B1->x - A1->x) * (-dy / L) + (B1->y - A1->y) * (dx / L));
  if (!B2) return d1;
  const double d2 = std::abs((B2->x - A1->x) * (-dy / L) + (B2->y - A1->y) * (dx / L));
  return (d1 + d2) / 2;
}
// skLinesAngle : false si l'un n'est pas une ligne entière
bool angleDroites(const Esquisse& s, const Entite& A, const Entite& B, double& v) {
  const Pt* A1 = s.point(A.p1);
  const Pt* A2 = s.point(A.p2);
  const Pt* B1 = s.point(B.p1);
  const Pt* B2 = s.point(B.p2);
  if (!A1 || !A2 || !B1 || !B2) return false;
  const double ax = A2->x - A1->x, ay = A2->y - A1->y, bx = B2->x - B1->x, by = B2->y - B1->y;
  const double la = hyp(ax, ay), lb = hyp(bx, by);
  if (la < 1e-9 || lb < 1e-9) return false;
  v = m_atan2(std::abs(ax * by - ay * bx) / (la * lb), std::abs(ax * bx + ay * by) / (la * lb));
  return true;
}
// skConKey
std::string cleContrainte(const Contrainte& c) {
  const std::string& t = c.type;
  if (t == "h" || t == "v") return t + "@" + c.line;
  if (t == "fix") return "fix@" + (!c.p.empty() ? "p:" + c.p : "ent:" + c.ent);
  if (t == "tangent") return "tangent@" + c.line + "|" + c.ent;
  if (t == "tangent2") return "tangent2@" + paire(c.a, c.b);
  if (t == "parallel" || t == "perpendicular" || t == "equal" || t == "collinear") return t + "@" + paire(c.a, c.b);
  if (t == "symmetric") return "symmetric@" + paire(c.a, c.b) + "|" + c.mid;
  if (t == "coaxial") return "coaxial@" + paire(c.a, c.b);
  if (t == "offset") return "offset@" + c.a + "|" + c.b + "|" + c.c + "|" + c.d;
  if (t == "coincident") return "coincident@" + paire(c.a, c.b);
  if (t == "midpoint") return !c.p.empty() ? "midpoint@" + c.p + "|" + c.line : "midpoint@@" + paire(c.a, c.b);
  if (t == "online") return "online@" + c.p + "|" + c.line;
  if (t == "oncircle") return "oncircle@" + c.p + "|" + c.ent;
  return t + "@" + c.id;
}
}  // namespace

Dessin::Dessin(Esquisse& s, Edition& ed) : s_(s), ed_(ed) { vue(1); }

void Dessin::vue(double p) {
  echelle_ = p;
  SNAP_ = 10 / p;
  PICK_ = 8 / p;
  PT_ = 10 / p;
  INF_ = 6 / p;
}

bool Dessin::estChoisi(Choix::Sorte so, const std::string& id) const {
  if (so == Choix::ENTITE && id == dimLigne_) return true;  // première ligne d'une cote entre deux lignes
  if (so == Choix::POINT && id == dimPoint_) return true;   // premier point d'une cote de distance
  for (const Choix& c : selection_)
    if (c.sorte == so && c.id == id) return true;
  return false;
}

bool Dessin::departTrace(Pt& p) const {
  if (outil_ == DECALER && offArme_) {  // la distance tapée s'affiche près du curseur
    p = curseurDecalage_;
    return true;
  }
  if (bas_.actif) {
    p = {bas_.x, bas_.y};
    return true;
  }
  return false;
}

// Ce que le navigateur a déjà fait à l'ouverture de l'esquisse : on ne le fait qu'au premier geste,
// pour qu'une esquisse seulement regardée reste identique au fichier.
void Dessin::premiere() {
  if (premiereFaite_) return;
  premiereFaite_ = true;
  if (!s_.point("O")) {
    s_.points["O"] = Pt{0, 0};
    s_.ordre.push_back("O");
  }
  std::vector<std::string> retirees;
  const std::vector<Contrainte> nouvelles = ed_.solveur.contraintesNouvelles(retirees, s_.contraintes);
  std::vector<Contrainte> garde;
  for (const Contrainte& c : s_.contraintes)
    if (std::find(retirees.begin(), retirees.end(), c.id) == retirees.end()) garde.push_back(c);
  s_.contraintes = std::move(garde);
  for (Contrainte c : nouvelles) {
    c.id = nouvelE();
    s_.contraintes.push_back(std::move(c));
  }
  if (!nouvelles.empty() || !retirees.empty()) structure_ = true;
  if (!ed_.resolue) {
    ed_.solveur.resoudre();
    ed_.resolue = true;
  }
  ed_.solveur.recopierDans(s_);
  sync();
}

void Dessin::pousser() {
  change_ = true;
  if (avantModif) avantModif();
}

void Dessin::sync() {
  if (!structure_) return;
  ed_.solveur = Solveur(s_, ed_.solveur);
  structure_ = false;
}

void Dessin::resoudre(int iters) {
  sync();
  ed_.solveur.resoudre(iters);
  ed_.solveur.recopierDans(s_);
}

void Dessin::apresEdition() {
  controlerCotes();
  resoudre();
  nettoyer();
}

void Dessin::controlerCotes() {
  for (Cote& d : s_.cotes) {
    const std::string sg = d.type + "|" + d.line + "|" + d.a + "|" + d.b + "|" + d.p + "|" + d.ent + "|" + d.orient;
    const auto it = signatures_.find(d.id);
    const bool vu = it != signatures_.end();
    if (d.chk && (!vu || it->second == sg)) continue;
    d.chk = true;
    signatures_[d.id] = sg;
    const auto axe = [&](const std::string& id) {
      const Entite* e = s_.entite(id);
      return e && e->axe;
    };
    if (!d.dia && ((d.type == "distline" && axe(d.line)) || (d.type == "gap" && (axe(d.a) || axe(d.b))))) d.dia = true;
    if (d.ref) {
      if (!vu || d.refV != 2) continue;
      d.ref = false;
      d.refV = 0;
    }
    sync();
    ed_.solveur = Solveur(s_, ed_.solveur);  // la cote a pu changer de statut
    if (ed_.solveur.coteRedondante(d.id)) {
      d.ref = true;
      d.refV = 2;
      ed_.solveur.poserReference(d.id);
      message("Cote en sur-contrainte : elle devient une cote de référence (entre parenthèses), elle mesure sans piloter.");
    }
  }
}

void Dessin::dedoublonner() {
  const auto hv = [&](const std::string& id, const char* t) { return aHV(id, t); };
  std::set<std::string> coll, vues;
  for (const Contrainte& c : s_.contraintes)
    if (c.type == "collinear") coll.insert(paire(c.a, c.b));
  std::vector<Contrainte> out;
  for (const Contrainte& c : s_.contraintes) {
    if (c.type == "perpendicular" && ((hv(c.a, "h") && hv(c.b, "v")) || (hv(c.a, "v") && hv(c.b, "h")))) continue;
    if (c.type == "parallel" && coll.count(paire(c.a, c.b))) continue;
    if (!vues.insert(cleContrainte(c)).second) continue;
    out.push_back(c);
  }
  s_.contraintes = std::move(out);
}

void Dessin::nettoyer() {
  sync();
  if (ed_.solveur.convertirEntraxes()) ed_.solveur.recopierDans(s_);
  nettoyerSplines();
  std::set<std::string> ref{"O", chaine_, arcC_, glisseP_, dimPoint_};
  if (bas_.actif) ref.insert(bas_.pid);
  ref.erase("");
  for (const Entite& e : s_.entites)
  {
    for (const std::string* q : {&e.p1, &e.p2, &e.p, &e.pc, &e.pa, &e.pb})
      if (!q->empty()) ref.insert(*q);
    for (const std::string& q : e.pts) ref.insert(q);
  }
  for (const Cote& d : s_.cotes)
    for (const std::string* q : {&d.a, &d.b, &d.p})
      if (!q->empty()) ref.insert(*q);
  for (const Contrainte& c : s_.contraintes)
    for (const std::string* q : {&c.p, &c.a, &c.b, &c.mid})
      if (!q->empty()) ref.insert(*q);
  const size_t nP = s_.ordre.size(), nC = s_.contraintes.size(), nD = s_.cotes.size();
  for (size_t i = s_.ordre.size(); i-- > 0;)
    if (!ref.count(s_.ordre[i])) {
      s_.points.erase(s_.ordre[i]);
      s_.ordre.erase(s_.ordre.begin() + i);
    }
  std::set<std::string> eids;
  for (const Entite& e : s_.entites) eids.insert(e.id);
  const auto gardeC = [&](const Contrainte& c) {
    const auto ent = [&](const std::string& q) { return eids.count(q) > 0; };
    const auto pt = [&](const std::string& q) { return s_.point(q) != nullptr; };
    if (!c.line.empty() && !ent(c.line)) return false;
    if (!c.ent.empty() && !ent(c.ent)) return false;
    if (!c.p.empty() && !pt(c.p)) return false;
    if (!c.s.empty() && !ent(c.s)) return false;
    if (c.type == "stangent" || c.type == "scurv") {
      const Entite* S = s_.entite(c.s);
      const Entite* O = s_.entite(c.ent);
      if (!S || S->t != "spline" || std::find(S->pts.begin(), S->pts.end(), c.p) == S->pts.end() || pointTangente(*S, c.p).empty()) return false;
      if (O && O->t == "spline" && pointTangente(*O, c.p).empty()) return false;
      if (c.type == "scurv" && !aContrainte([&](const Contrainte& k) { return k.type == "stangent" && k.s == c.s && k.p == c.p && k.ent == c.ent; })) return false;
    }
    if (c.type == "coincident") return (c.a.empty() || pt(c.a)) && (c.b.empty() || pt(c.b));
    if (c.type == "symmetric") return ent(c.a) && ent(c.b) && ent(c.mid);
    if (c.type == "offset" && !(ent(c.c) && ent(c.d))) return false;
    if (!c.a.empty() && !ent(c.a)) return false;
    if (!c.b.empty() && !ent(c.b)) return false;
    if (!c.mid.empty() && !ent(c.mid)) return false;
    return true;
  };
  s_.contraintes.erase(std::remove_if(s_.contraintes.begin(), s_.contraintes.end(), [&](const Contrainte& c) { return !gardeC(c); }), s_.contraintes.end());
  dedoublonner();
  const auto gardeD = [&](const Cote& d) {
    if (!d.line.empty() && !eids.count(d.line)) return false;
    if (!d.ent.empty() && !eids.count(d.ent)) return false;
    if (d.type == "distance" || d.type == "distline") {
      if (!d.a.empty() && !s_.point(d.a)) return false;
      if (!d.b.empty() && !s_.point(d.b)) return false;
      if (!d.p.empty() && !s_.point(d.p)) return false;
    }
    if (d.type == "gap" || d.type == "angle") {
      if (!d.a.empty() && !eids.count(d.a)) return false;
      if (!d.b.empty() && !eids.count(d.b)) return false;
    }
    return true;
  };
  s_.cotes.erase(std::remove_if(s_.cotes.begin(), s_.cotes.end(), [&](const Cote& d) { return !gardeD(d); }), s_.cotes.end());
  if (s_.ordre.size() != nP || s_.contraintes.size() != nC || s_.cotes.size() != nD) structure_ = true;
}

std::string Dessin::ajouterPoint(double x, double y) {
  std::string id = "p" + std::to_string(s_.seq++);
  s_.points[id] = Pt{x, y};
  s_.ordre.push_back(id);
  structure_ = true;
  return id;
}

std::string Dessin::pointA(double x, double y) {
  std::string best;
  double bd = 0.01;
  for (const std::string& q : s_.ordre) {
    const Pt& p = s_.points.at(q);
    const double d = hyp(p.x - x, p.y - y);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best.empty() ? ajouterPoint(x, y) : best;
}

void Dessin::lier(Contrainte c) {
  c.id = nouvelE();
  s_.contraintes.push_back(std::move(c));
  structure_ = true;
}

bool Dessin::aContrainte(const std::function<bool(const Contrainte&)>& f) const { return std::any_of(s_.contraintes.begin(), s_.contraintes.end(), f); }
bool Dessin::aHV(const std::string& l, const char* t) const {
  return aContrainte([&](const Contrainte& c) { return c.type == t && c.line == l; });
}

std::vector<std::string> Dessin::ptsEntite(const Entite& e) const {
  if (e.t == "line") return {e.p1, e.p2};
  if (e.t == "arc") return {e.pc, e.pa, e.pb};
  if (e.t == "circle") return {e.pc};
  if (e.t == "cpoint") return {e.p};
  if (e.t == "spline") return e.pts;
  return {};
}

Entite* Dessin::entite(const std::string& id) {
  for (Entite& e : s_.entites)
    if (e.id == id) return &e;
  return nullptr;
}

std::string Dessin::pointProche(double x, double y, double maxD, const std::string& sauf) const {
  std::string best;
  double bd = maxD;
  for (const std::string& q : s_.ordre) {
    if (q == sauf) continue;
    const Pt& p = s_.points.at(q);
    const double d = hyp(p.x - x, p.y - y);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

const Entite* Dessin::entiteProche(double x, double y, double maxD, bool sansConstruction) const {
  const Entite* best = nullptr;
  double bd = maxD;
  for (const Entite& e : s_.entites) {
    if (sansConstruction && e.construction) continue;  // outil Ajuster : la construction ne se coupe pas
    double d = 1e9;
    if (e.t == "line") {
      const Pt* A = s_.point(e.p1);
      const Pt* B = s_.point(e.p2);
      if (A && B) d = distSeg(x, y, *A, *B);
    } else if (e.t == "circle") {
      if (const Pt* C = s_.point(e.pc)) d = std::abs(hyp(x - C->x, y - C->y) - e.r);
    } else if (e.t == "arc") {
      if (const Pt* C = s_.point(e.pc)) {
        An an;
        const bool ok = anglesArc2(s_, e, an);
        const double dR = std::abs(hyp(x - C->x, y - C->y) - e.r);
        d = ok && dR < maxD * 1.5 && dansArc(m_atan2(y - C->y, x - C->x), an.a1, an.a2) ? dR : 1e9;
      }
    } else if (e.t == "cpoint") {
      if (const Pt* Q = s_.point(e.p)) d = hyp(x - Q->x, y - Q->y);
    } else if (e.t == "spline") {
      BSpline f;
      if (splineDe(s_, e, f)) {  // skPolyDist
        const std::vector<P2d> pl = bsSample(f, f.a, f.b, 16);
        double m = 1e308;
        for (size_t i = 0; i + 1 < pl.size(); i++) {
          const Pt A{pl[i][0], pl[i][1]}, B{pl[i + 1][0], pl[i + 1][1]};
          m = jsmin(m, distSeg(x, y, A, B));
        }
        d = m;
      }
    }
    if (d < bd) {
      bd = d;
      best = &e;
    }
  }
  return best;
}

std::vector<P2d> touchesPlan(const Esquisse& s, const std::vector<Vec3>& P) {  // skPlTouches
  std::vector<P2d> out;
  const auto z = [&](const Vec3& p) { return (p[0] - s.o[0]) * s.n[0] + (p[1] - s.o[1]) * s.n[1] + (p[2] - s.o[2]) * s.n[2]; };
  const auto mettre = [&](const Vec3& p) { out.push_back({(p[0] - s.o[0]) * s.u[0] + (p[1] - s.o[1]) * s.u[1] + (p[2] - s.o[2]) * s.u[2], (p[0] - s.o[0]) * s.v[0] + (p[1] - s.o[1]) * s.v[1] + (p[2] - s.o[2]) * s.v[2]}); };
  for (size_t i = 0; i < P.size(); i++) {
    const double zi = z(P[i]);
    if (std::abs(zi) < 2e-3) {
      mettre(P[i]);
      continue;
    }
    if (i + 1 < P.size()) {
      const double zj = z(P[i + 1]);
      if (std::abs(zj) >= 2e-3 && zi * zj < 0) {
        const double t = zi / (zi - zj);
        mettre({P[i][0] + (P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t, P[i][2] + (P[i + 1][2] - P[i][2]) * t});
      }
    }
  }
  return out;
}

Dessin::Accroche Dessin::accroche(double x, double y, const std::string& sauf) const {
  Accroche a;
  survolPlan_ = CiblePlan{};
  const std::string pid = pointProche(x, y, SNAP_, sauf);
  if (!pid.empty()) {
    const Pt& p = s_.points.at(pid);
    a.sorte = Accroche::POINT;
    a.id = pid;
    a.x = p.x;
    a.y = p.y;
    return a;
  }
  double bd = SNAP_;
  for (const Entite& e : s_.entites) {
    if (e.t != "line") continue;
    const Pt* A = s_.point(e.p1);
    const Pt* B = s_.point(e.p2);
    if (!A || !B) continue;
    const double mx = (A->x + B->x) / 2, my = (A->y + B->y) / 2, d = hyp(mx - x, my - y);
    if (d < bd) {
      bd = d;
      a.sorte = Accroche::MILIEU;
      a.id = e.id;
      a.x = mx;
      a.y = my;
    }
  }
  if (a) return a;
  bd = SNAP_;
  std::string bc;
  for (const Entite& e : s_.entites) {
    if (e.t != "circle" && e.t != "arc") continue;
    const Pt* C = s_.point(e.pc);
    if (!C) continue;
    const double d = hyp(C->x - x, C->y - y);
    if (d < bd) {
      bd = d;
      bc = e.pc;
    }
  }
  if (!bc.empty()) {
    const Pt& p = s_.points.at(bc);
    a.sorte = Accroche::POINT;
    a.id = bc;
    a.x = p.x;
    a.y = p.y;
    return a;
  }
  if (outilPlan()) {  // skPlSnap
    survolPlan_ = ciblePlan(x, y);
    if (survolPlan_) {
      a.sorte = Accroche::PLAN;
      a.x = survolPlan_.x;
      a.y = survolPlan_.y;
      a.plan = survolPlan_;
    }
  }
  return a;
}

Dessin::Accroche Dessin::accrocheGlisse(double x, double y, const std::string& pid) const {
  std::set<std::string> propres;
  for (const Entite& e : s_.entites) {
    const auto v = ptsEntite(e);
    if (std::find(v.begin(), v.end(), pid) == v.end()) continue;
    propres.insert(e.id);
    for (const std::string& q : v)
      if (!q.empty()) propres.insert(q);
  }
  Accroche best;
  double bd = SNAP_;
  for (const std::string& q : s_.ordre) {
    if (q == pid || propres.count(q)) continue;
    const Pt& p = s_.points.at(q);
    const double d = hyp(p.x - x, p.y - y);
    if (d < bd) {
      bd = d;
      best.sorte = Accroche::POINT;
      best.id = q;
      best.x = p.x;
      best.y = p.y;
    }
  }
  if (best) return best;
  bd = SNAP_;
  for (const Entite& e : s_.entites) {
    if (e.t != "line" || propres.count(e.id)) continue;
    const Pt* A = s_.point(e.p1);
    const Pt* B = s_.point(e.p2);
    if (!A || !B) continue;
    const double mx = (A->x + B->x) / 2, my = (A->y + B->y) / 2, d = hyp(mx - x, my - y);
    if (d < bd) {
      bd = d;
      best.sorte = Accroche::MILIEU;
      best.id = e.id;
      best.x = mx;
      best.y = my;
    }
  }
  if (best) return best;
  bd = SNAP_ * 0.6;
  for (const Entite& e : s_.entites) {
    if (propres.count(e.id)) continue;
    if (e.t == "line") {
      const Pt* A = s_.point(e.p1);
      const Pt* B = s_.point(e.p2);
      if (!A || !B) continue;
      const double dx = B->x - A->x, dy = B->y - A->y, L2 = dx * dx + dy * dy;
      if (L2 < 1e-12) continue;
      const double t = ((x - A->x) * dx + (y - A->y) * dy) / L2;
      if (t <= 1e-3 || t >= 1 - 1e-3) continue;
      const double fx = A->x + t * dx, fy = A->y + t * dy, d = hyp(fx - x, fy - y);
      if (d < bd) {
        bd = d;
        best.sorte = Accroche::SUR_LIGNE;
        best.id = e.id;
        best.x = fx;
        best.y = fy;
      }
    } else if (e.t == "circle" || e.t == "arc") {
      const Pt* C = s_.point(e.pc);
      if (!C || !(e.r > 0)) continue;
      const double dc = hyp(x - C->x, y - C->y);
      if (dc < 1e-9) continue;
      const double d = std::abs(dc - e.r);
      if (d < bd) {
        const double ux = (x - C->x) / dc, uy = (y - C->y) / dc;
        const double qx = C->x + ux * e.r, qy = C->y + uy * e.r;
        if (e.t == "arc") {
          An an;
          if (anglesArc2(s_, e, an) && !dansArc(m_atan2(uy, ux), an.a1, an.a2)) continue;
        }
        bd = d;
        best.sorte = Accroche::SUR_CERCLE;
        best.id = e.id;
        best.x = qx;
        best.y = qy;
      }
    } else if (e.t == "spline") {
      BSpline f;
      if (!splineDe(s_, e, f)) continue;
      const PiedSpline h = bsClosest(f, x, y, nullptr);
      if (h.d < bd) {
        bd = h.d;
        best.sorte = Accroche::SUR_SPLINE;
        best.id = e.id;
        best.x = h.x;
        best.y = h.y;
      }
    }
  }
  return best;
}

bool Dessin::lacher(const std::string& pid, const Accroche& a) {
  if (!a || pid.empty() || !s_.point(pid)) return false;
  Contrainte c;
  std::string msg;
  if (a.sorte == Accroche::POINT) {
    if (!s_.point(a.id) || aContrainte([&](const Contrainte& k) { return k.type == "coincident" && ((k.a == pid && k.b == a.id) || (k.a == a.id && k.b == pid)); })) return false;
    c.type = "coincident";
    c.a = pid;
    c.b = a.id;
    msg = "Points coïncidents (lâcher sur un point).";
  } else if (a.sorte == Accroche::MILIEU) {
    if (aContrainte([&](const Contrainte& k) { return k.type == "midpoint" && k.p == pid && k.line == a.id; })) return false;
    c.type = "midpoint";
    c.p = pid;
    c.line = a.id;
    msg = "Point au milieu de la ligne.";
  } else if (a.sorte == Accroche::SUR_LIGNE) {
    if (aContrainte([&](const Contrainte& k) { return k.type == "online" && k.p == pid && k.line == a.id; })) return false;
    c.type = "online";
    c.p = pid;
    c.line = a.id;
    msg = "Point sur la ligne.";
  } else if (a.sorte == Accroche::SUR_SPLINE) {
    if (aContrainte([&](const Contrainte& k) { return k.type == "onspline" && k.p == pid && k.ent == a.id; })) return false;
    c.type = "onspline";
    c.p = pid;
    c.ent = a.id;
    msg = "Point sur la spline.";
  } else {
    if (aContrainte([&](const Contrainte& k) { return k.type == "oncircle" && k.p == pid && k.ent == a.id; })) return false;
    c.type = "oncircle";
    c.p = pid;
    c.ent = a.id;
    msg = "Point sur le cercle.";
  }
  lier(c);
  const std::string id = s_.contraintes.back().id;
  resoudre();
  if (ed_.solveur.residu() > SK_OK) {
    s_.contraintes.erase(std::remove_if(s_.contraintes.begin(), s_.contraintes.end(), [&](const Contrainte& k) { return k.id == id; }), s_.contraintes.end());
    structure_ = true;
    resoudre();
    message("Accroche impossible ici (contraintes en conflit) : point déplacé sans contrainte.");
    return false;
  }
  message(msg + " Ctrl+Z pour annuler.");
  return true;
}

std::string Dessin::pointAccroche(double x, double y) {
  const Accroche a = accroche(x, y);
  if (a.sorte == Accroche::POINT) return a.id;
  if (a.sorte == Accroche::PLAN) return materialiser(a.plan);
  if (a.sorte == Accroche::MILIEU) {
    const std::string pid = ajouterPoint(a.x, a.y);
    Contrainte c = contrainte("midpoint");
    c.p = pid;
    c.line = a.id;
    lier(c);
    return pid;
  }
  if (grille) {
    x = surGrille(x);
    y = surGrille(y);
  }
  return ajouterPoint(x, y);
}

double Dessin::pasGrille() const {
  for (double st : {0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1., 2., 5., 10., 20., 50., 100., 200., 500., 1000.})
    if (st * echelle_ >= 8) return st;
  return 1000;
}
double Dessin::surGrille(double v) const {
  const double st = pasGrille();
  return std::floor(v / st + 0.5) * st;  // Math.round
}
double Dessin::longueurMini() const { return jsmax(1e-4, 3 / (echelle_ != 0 ? echelle_ : 1)); }

bool Dessin::attacherCourbe(const std::string& pid, double x, double y, double tol) {
  if (pid.empty() || !s_.point(pid)) return false;
  if (tol == 0) tol = 1e-3;
  bool n = false;
  for (size_t i = 0; i < s_.entites.size(); i++) {
    const Entite e = s_.entites[i];
    if ((e.t != "circle" && e.t != "arc") || !s_.point(e.pc)) continue;
    if (e.pc == pid || e.pa == pid || e.pb == pid) continue;
    const Pt* C = s_.point(e.pc);
    if (std::abs(hyp(x - C->x, y - C->y) - e.r) > tol) continue;
    if (e.t == "arc") {
      An an;
      if (!anglesArc2(s_, e, an) || !dansArc(m_atan2(y - C->y, x - C->x), an.a1, an.a2)) continue;
    }
    if (aContrainte([&](const Contrainte& c) { return c.type == "oncircle" && c.p == pid && c.ent == e.id; })) continue;
    Contrainte c = contrainte("oncircle");
    c.p = pid;
    c.ent = e.id;
    lier(c);
    n = true;
  }
  if (!n) n = attacherSpline(pid, x, y, tol);
  return n;
}

void Dessin::accrocher(const std::string& pid, double x, double y, double tol) {
  if (pid.empty() || !s_.point(pid)) return;
  if (tol < 0) tol = SNAP_;
  const Entite* best = nullptr;
  double bd = tol;
  for (const Entite& e : s_.entites) {
    if (e.t != "line" || e.p1 == pid || e.p2 == pid) continue;
    const Pt* A = s_.point(e.p1);
    const Pt* B = s_.point(e.p2);
    if (!A || !B) continue;
    const double dx = B->x - A->x, dy = B->y - A->y, L2 = dx * dx + dy * dy;
    if (L2 < 1e-12) continue;
    const double t = ((x - A->x) * dx + (y - A->y) * dy) / L2;
    if (t <= 1e-3 || t >= 1 - 1e-3) continue;
    const double d = hyp(A->x + t * dx - x, A->y + t * dy - y);
    if (d < bd) {
      bd = d;
      best = &e;
    }
  }
  if (best) {
    const std::string id = best->id;
    if (aContrainte([&](const Contrainte& c) { return (c.type == "online" || c.type == "midpoint") && c.p == pid && c.line == id; })) return;
    Contrainte c = contrainte("online");
    c.p = pid;
    c.line = id;
    lier(c);
    return;
  }
  attacherCourbe(pid, x, y, tol);
}

void Dessin::epinglerTangence(const std::string& ligne, const std::string& ent) {
  const Entite* L = s_.entite(ligne);
  const Entite* E = s_.entite(ent);
  if (!L || !E || (E->t != "circle" && E->t != "arc")) return;
  const Pt* C = s_.point(E->pc);
  const Pt* A = s_.point(L->p1);
  const Pt* B = s_.point(L->p2);
  if (!C || !A || !B) return;
  const double dx = B->x - A->x, dy = B->y - A->y, Ln = hyp(dx, dy);
  if (Ln < 1e-9) return;
  const double t = jsmax(0, jsmin(1, ((C->x - A->x) * dx + (C->y - A->y) * dy) / (Ln * Ln)));
  const double fx = A->x + t * dx, fy = A->y + t * dy;
  const double tol = jsmax(3, E->r * 0.08);
  std::string best;
  double bd = 1e308;
  for (const std::string* q : {&L->p1, &L->p2}) {
    if (*q == E->pc || *q == E->pa || *q == E->pb) continue;
    const Pt* P = s_.point(*q);
    if (!P) continue;
    if (std::abs(hyp(P->x - C->x, P->y - C->y) - E->r) > tol) continue;
    const double d = hyp(P->x - fx, P->y - fy);
    if (d < bd) {
      bd = d;
      best = *q;
    }
  }
  if (best.empty() || bd > tol) return;
  const std::string idE = E->id;
  if (aContrainte([&](const Contrainte& c) { return c.type == "oncircle" && c.p == best && c.ent == idE; })) return;
  Contrainte c = contrainte("oncircle");
  c.p = best;
  c.ent = idE;
  lier(c);
}

Dessin::Compo Dessin::composante(const std::vector<std::string>& graines) const {
  Compo out;
  std::set<std::string> pids, ents;
  const auto addP = [&](const std::string& q) {
    if (pids.insert(q).second) out.pids.push_back(q);
  };
  const auto addE = [&](const std::string& q) {
    if (ents.insert(q).second) out.ents.push_back(q);
  };
  for (const std::string& q : graines)
    if (!q.empty() && s_.point(q)) addP(q);
  const auto avecPts = [&](const Entite& E) {
    addE(E.id);
    for (const std::string& q : ptsEntite(E))
      if (!q.empty() && s_.point(q)) addP(q);
  };
  bool change = true;
  int garde = 0;
  while (change && garde++ < 128) {
    change = false;
    for (const Entite& e : s_.entites) {
      if (ents.count(e.id)) continue;
      const auto ep = ptsEntite(e);
      if (std::any_of(ep.begin(), ep.end(), [&](const std::string& q) { return pids.count(q) && s_.point(q); })) {
        avecPts(e);
        change = true;
      }
    }
    for (const Contrainte& c : s_.contraintes) {
      if (c.type == "coincident") {
        if (pids.count(c.a) && !pids.count(c.b) && s_.point(c.b)) {
          addP(c.b);
          change = true;
        } else if (pids.count(c.b) && !pids.count(c.a) && s_.point(c.a)) {
          addP(c.a);
          change = true;
        }
      } else if (c.type == "tangent") {
        const Entite* L = s_.entite(c.line);
        const Entite* E = s_.entite(c.ent);
        if (!L || !E) continue;
        if (ents.count(L->id) && !ents.count(E->id)) {
          avecPts(*E);
          change = true;
        } else if (ents.count(E->id) && !ents.count(L->id)) {
          avecPts(*L);
          change = true;
        }
      } else if (c.type == "stangent" || c.type == "scurv") {
        const Entite* S = s_.entite(c.s);
        const Entite* E = s_.entite(c.ent);
        if (!S || !E) continue;
        if (ents.count(S->id) && !ents.count(E->id)) {
          avecPts(*E);
          change = true;
        } else if (ents.count(E->id) && !ents.count(S->id)) {
          avecPts(*S);
          change = true;
        }
      } else if (c.type == "oncircle" || c.type == "onspline") {
        const Entite* E = s_.entite(c.ent);
        if (!E || !s_.point(c.p)) continue;
        if (pids.count(c.p) && !ents.count(E->id)) {
          avecPts(*E);
          change = true;
        } else if (ents.count(E->id) && !pids.count(c.p)) {
          addP(c.p);
          change = true;
        }
      } else if (c.type == "online") {
        const Entite* L = s_.entite(c.line);
        if (!L || !s_.point(c.p)) continue;
        if (pids.count(c.p) && !ents.count(L->id)) {
          avecPts(*L);
          change = true;
        } else if (ents.count(L->id) && !pids.count(c.p)) {
          addP(c.p);
          change = true;
        }
      } else if (c.type == "parallel" || c.type == "perpendicular" || c.type == "collinear" || c.type == "symmetric") {
        const Entite* A = s_.entite(c.a);
        const Entite* B = s_.entite(c.b);
        if (!A || !B) continue;
        if (ents.count(A->id) && !ents.count(B->id)) {
          avecPts(*B);
          change = true;
        } else if (ents.count(B->id) && !ents.count(A->id)) {
          avecPts(*A);
          change = true;
        }
      }
    }
  }
  return out;
}

bool Dessin::rigide(const Compo& c) {
  sync();
  for (const std::string& q : c.pids)
    if (ed_.solveur.pointFixe(q)) return false;
  return ed_.solveur.degresLibres() <= 3;
}

void Dessin::prendreCote(const std::string& id, double wx, double wy) {
  premiere();
  const Cote* d = cote(id);
  if (!d) return;
  sansTete_ = false, selection_ = {{Choix::COTE, id}};
  glisseC_ = GlisseCote{};
  glisseC_.actif = true;
  glisseC_.etiquette = true;
  glisseC_.id = id;
  glisseC_.x0 = wx;
  glisseC_.y0 = wy;
  glisseC_.ox0 = d->ox;
  glisseC_.oy0 = d->oy;
  // Le texte ne saute pas sous le curseur : l'écart entre la prise et le texte est gardé (dimLabelPos)
  Seg S;
  if ((d->type == "length" || d->type == "distance" || d->type == "gap" || d->type == "distline") && segment(s_, *d, S)) {
    P2 T{(S.a.x + S.b.x) / 2, (S.a.y + S.b.y) / 2};
    if (d->type != "gap" && d->sl != 0) {
      const double L0 = dist(S.a, S.b), L = L0 != 0 ? L0 : 1e-9;
      T.x += (S.b.x - S.a.x) / L * d->sl;
      T.y += (S.b.y - S.a.y) / L * d->sl;
    }
    glisseC_.gx = T.x - wx;
    glisseC_.gy = T.y - wy;
  }
}

void Dessin::prendreLigneCote(const std::string& id, double wx, double wy) {
  const Cote* d = cote(id);
  if (!d) return;
  sansTete_ = false, selection_ = {{Choix::COTE, id}};
  glisseC_ = GlisseCote{};
  glisseC_.actif = true;
  glisseC_.id = id;
  glisseC_.x0 = wx;
  glisseC_.y0 = wy;
  glisseC_.w0 = d->aW ? d->w : (d->type == "length" ? 5 : 0);
  glisseC_.sl0 = d->sl;
}

// La branche skDimDrag de pointermove
void Dessin::bougerCoteSaisie(double wx, double wy) {
  Cote* d = cote(glisseC_.id);
  if (!d) {
    glisseC_.actif = false;
    return;
  }
  const bool lineaire = d->type == "length" || d->type == "distance" || d->type == "distline";
  const double ddx = wx - glisseC_.x0, ddy = wy - glisseC_.y0;
  if (!glisseC_.etiquette) {
    if (!glisseC_.pousse && std::abs(ddx) + std::abs(ddy) > 1e-6) {
      pousser();
      glisseC_.pousse = true;
    }
    Seg S;
    if (lineaire) {
      if (segment(s_, *d, S)) {
        d->w = glisseC_.w0 + ddx * S.nx + ddy * S.ny;
        d->aW = true;
      }
    } else if (d->type == "gap") {
      if (segment(s_, *d, S)) d->sl = glisseC_.sl0 + ddx * S.ux + ddy * S.uy;
    } else if (d->type == "angle") {
      Pt V;
      if (sommetAngle(s_, d->a, d->b, V)) {
        d->w = jsmax(1, hyp(wx - V.x, wy - V.y));
        d->aW = true;
      }
    }
    return;
  }
  if (lineaire || d->type == "gap") {
    const double tx = wx + glisseC_.gx, ty = wy + glisseC_.gy;
    if (!glisseC_.pousse && hyp(ddx, ddy) * echelle_ > 1) {
      pousser();
      glisseC_.pousse = true;
    }
    // skDimTextTo : l'écart suit le texte, puis le texte glisse le long de sa ligne
    Seg S;
    if (!segment(s_, *d, S)) return;
    if (d->type == "gap") {
      const double bx = (S.a.x + S.b.x) / 2 - S.ux * d->sl, by = (S.a.y + S.b.y) / 2 - S.uy * d->sl;
      d->sl = (tx - bx) * S.ux + (ty - by) * S.uy;
      return;
    }
    d->w = (tx - (S.A.x + S.B.x) / 2) * S.nx + (ty - (S.A.y + S.B.y) / 2) * S.ny;
    d->aW = true;
    if (!segment(s_, *d, S)) return;
    const double dx = S.b.x - S.a.x, dy = S.b.y - S.a.y, L = hyp(dx, dy);
    if (L < 1e-9) {
      d->sl = 0;
      return;
    }
    d->sl = ((tx - (S.a.x + S.b.x) / 2) * dx + (ty - (S.a.y + S.b.y) / 2) * dy) / L;
    if (std::abs(d->sl) < 0.5 / echelle_) d->sl = 0;
    return;
  }
  d->ox = glisseC_.ox0 + ddx;
  d->oy = glisseC_.oy0 + ddy;
}

namespace {
double signe(double v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
// segSegHit
bool segmentsSeCoupent(const Pt& a, const Pt& b, const Pt& c, const Pt& d) {
  const auto o = [](const Pt& p, const Pt& q, const Pt& r) { return signe((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); };
  const double o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  if (o1 != o2 && o3 != o4) return true;
  const auto sur = [](const Pt& p, const Pt& q, const Pt& r) { return p.x <= jsmax(q.x, r.x) && p.x >= jsmin(q.x, r.x) && p.y <= jsmax(q.y, r.y) && p.y >= jsmin(q.y, r.y); };
  return (o1 == 0 && sur(c, a, b)) || (o2 == 0 && sur(d, a, b)) || (o3 == 0 && sur(a, c, d)) || (o4 == 0 && sur(b, c, d));
}
}  // namespace

// Gauche → droite : entièrement dedans. Droite → gauche : tout ce que la fenêtre touche.
std::vector<Dessin::Choix> Dessin::dansBoite(const Boite& box) const {
  const double x0 = jsmin(box.x0, box.x1), x1 = jsmax(box.x0, box.x1), y0 = jsmin(box.y0, box.y1), y1 = jsmax(box.y0, box.y1);
  const bool avant = box.x1 >= box.x0;
  const auto dedans = [&](double x, double y) { return x >= x0 && x <= x1 && y >= y0 && y <= y1; };
  const auto segDedans = [&](const Pt& a, const Pt& b) {
    if (avant) return dedans(a.x, a.y) && dedans(b.x, b.y);
    if (dedans(a.x, a.y) || dedans(b.x, b.y)) return true;
    Pt c1, c2, c3, c4;
    c1.x = x0; c1.y = y0;
    c2.x = x1; c2.y = y0;
    c3.x = x1; c3.y = y1;
    c4.x = x0; c4.y = y1;
    return segmentsSeCoupent(a, b, c1, c2) || segmentsSeCoupent(a, b, c2, c3) || segmentsSeCoupent(a, b, c3, c4) || segmentsSeCoupent(a, b, c4, c1);
  };
  std::vector<Choix> r;
  for (const Entite& e : s_.entites) {
    bool pris = false;
    if (e.t == "line") {
      const Pt* A = s_.point(e.p1);
      const Pt* B = s_.point(e.p2);
      if (A && B) pris = segDedans(*A, *B);
    } else if (e.t == "cpoint") {
      if (const Pt* Q = s_.point(e.p)) pris = dedans(Q->x, Q->y);
    } else if (e.t == "spline") {
      BSpline f;
      if (splineDe(s_, e, f)) {
        const std::vector<P2d> pl = bsSample(f, f.a, f.b, 8);
        pris = pl.size() > 1;
        if (avant) {
          for (const P2d& q : pl) pris = pris && dedans(q[0], q[1]);
        } else {
          pris = false;
          for (size_t i = 1; i < pl.size() && !pris; i++) pris = segDedans(Pt{pl[i - 1][0], pl[i - 1][1]}, Pt{pl[i][0], pl[i][1]});
        }
      }
    } else if (const Pt* C = s_.point(e.pc)) {
      pris = avant ? dedans(C->x, C->y) : (C->x + e.r >= x0 && C->x - e.r <= x1 && C->y + e.r >= y0 && C->y - e.r <= y1);
      An an;
      if (e.t == "arc" && anglesArc2(s_, e, an)) {
        Pt p1, p2;
        p1.x = C->x + e.r * m_cos(an.a1);
        p1.y = C->y + e.r * m_sin(an.a1);
        p2.x = C->x + e.r * m_cos(an.a2);
        p2.y = C->y + e.r * m_sin(an.a2);
        pris = pris || dedans(p1.x, p1.y) || dedans(p2.x, p2.y) || (avant ? false : segDedans(p1, p2));
      }
    }
    if (pris) r.push_back({Choix::ENTITE, e.id});
  }
  for (const std::string& q : s_.ordre) {
    const Pt& p = s_.points.at(q);
    if (dedans(p.x, p.y)) r.push_back({Choix::POINT, q});
  }
  return r;
}

void Dessin::enfonce(double wx, double wy, bool ctrl, const std::string& ligneCote) {
  premiere();
  sync();
  if (outil_ == PROJETER) return clicProjeter(wx, wy);
  if (outil_ == INTERSECTION) return clicIsect(wx, wy, ctrl);
  if (outil_ == SELECTION) {
    const std::string pid = pointProche(wx, wy, PT_);
    if (!pid.empty()) {
      if (ctrl) {
        if (selection_.empty()) sansTete_ = true;
        selection_.push_back({Choix::POINT, pid});
        return;
      }
      sansTete_ = false, selection_ = {{Choix::POINT, pid}};
      int partages = 0;
      for (const Entite& e : s_.entites) {
        const auto v = ptsEntite(e);
        if (std::find(v.begin(), v.end(), pid) != v.end() && !e.poignee) partages++;
      }
      const bool coin = aContrainte([&](const Contrainte& c) { return c.type == "coincident" && (c.a == pid || c.b == pid); });
      const auto centres = ed_.solveur.centresSymetrie();
      bool estCentre = false;
      if (std::find(centres.begin(), centres.end(), pid) != centres.end()) {
        estCentre = true;
        for (const std::string& q : composante({pid}).pids)
          if (ed_.solveur.pointFixe(q)) estCentre = false;
      }
      if (partages > 1 || coin) {
        if (estCentre || rigide(composante({pid}))) {
          const Compo comp = composante({pid});
          glisseE_ = GlisseE{};
          glisseE_.actif = true;
          glisseE_.x0 = wx;
          glisseE_.y0 = wy;
          glisseE_.pids = comp.pids;
          for (const std::string& q : comp.pids) {
            glisseE_.orig.push_back(*s_.point(q));
            if (!ed_.solveur.pointFixe(q)) glisseE_.ancre.push_back(q);
          }
          ed_.solveur.glisserOublier();
          return;
        }
      }
      glisseP_ = pid;
      ed_.solveur.glisserOublier();
      glisseBouge_ = false;
      glissePousse_ = false;
      const Pt& p = *s_.point(pid);
      deWx_ = wx;
      deWy_ = wy;
      deX_ = p.x;
      deY_ = p.y;
      return;
    }
    if (!ligneCote.empty() && cote(ligneCote)) return prendreLigneCote(ligneCote, wx, wy);
    const Entite* en = entiteProche(wx, wy, PICK_);
    if (en) {
      const Entite e = *en;
      if (ctrl) {
        if (selection_.empty()) sansTete_ = true;
        if (!(!sansTete_ && selection_.size() && selection_[0] == Choix{Choix::ENTITE, e.id})) selection_.push_back({Choix::ENTITE, e.id});
      } else {
        sansTete_ = false, selection_ = {{Choix::ENTITE, e.id}};
      }
      const Compo comp0 = composante(ptsEntite(e));
      const bool rig = rigide(comp0);
      Compo comp;
      if (rig) {
        comp = comp0;
      } else {
        for (const std::string& q : e.t == "spline" ? pidsSpline(e) : ptsEntite(e))
          if (!q.empty() && s_.point(q)) comp.pids.push_back(q);
      }
      glisseE_ = GlisseE{};
      glisseE_.actif = true;
      glisseE_.x0 = wx;
      glisseE_.y0 = wy;
      glisseE_.pids = comp.pids;
      glisseE_.rigide = rig;
      for (const std::string& q : comp.pids) {
        glisseE_.orig.push_back(*s_.point(q));
        if (!ed_.solveur.pointFixe(q)) glisseE_.ancre.push_back(q);
      }
      ed_.solveur.glisserOublier();
      return;
    }
    if (choisirPlan(wx, wy, ctrl)) return;
    if (!ctrl) selection_.clear();
    boite_ = Boite{};
    boite_.actif = true;
    boite_.ajoute = ctrl;
    boite_.x0 = boite_.x1 = wx;
    boite_.y0 = boite_.y1 = wy;
    return;
  }
  if (outil_ == COINCIDENT) {
    const std::string pid = pointProche(wx, wy, SNAP_);
    if (pid.empty()) return message("Coïncident : cliquez une extrémité existante.");
    if (coinPt_.empty()) {
      coinPt_ = pid;
      message("Coïncident : cliquez la 2e extrémité à fusionner.");
      return;
    }
    if (pid != coinPt_) pousser();
    if (fusionner(pid, coinPt_)) message("Points fusionnés.");
    coinPt_.clear();
    apresEdition();
    return;
  }
  if (outil_ == SPLINE || outil_ == CSPLINE) return clicSpline(wx, wy);
  if (outil_ == COTE) {
    preparerCotePlan(wx, wy);
    return enfonceCote(wx, wy, ctrl);
  }
  if (outil_ == AJUSTER) return clicAjuster(wx, wy);
  if (outil_ == DECALER) return clicDecaler(wx, wy);
  if (outil_ == LIGNE) {
    if (dyn_.actif) return validerSaisie();
    if (bas_.actif) {
      bas_.clique = true;
      return;
    }
    const bool depuisChaine = !chaine_.empty();
    if (chaine_.empty()) pousserSiPlan(wx, wy);
    const std::string dep = !chaine_.empty() ? chaine_ : pointAccroche(wx, wy);
    const Pt& S = *s_.point(dep);
    bas_ = Bas{};
    bas_.actif = true;
    bas_.pid = dep;
    bas_.x = S.x;
    bas_.y = S.y;
    bas_.depuisChaine = depuisChaine;
    bas_.wx = wx;
    bas_.wy = wy;
    message("Premier point posé : déplacez puis cliquez le second.");
    return;
  }
  if (outil_ == OBLONG) {  // oblong en 3 clics
    if (!bas_.actif) {
      pousserSiPlan(wx, wy);
      oblongDepart(wx, wy);
    }
    return;
  }
  if (trActif(outil_)) return trEnfonce(wx, wy);  // nouveaux modes du bandeau
  if (outil_ == RECTANGLE || outil_ == CERCLE || outil_ == POLYGONE) {
    if (bas_.actif) return;
    pousserSiPlan(wx, wy);
    const bool fa = static_cast<bool>(accroche(wx, wy));
    const std::string pid = pointAccroche(wx, wy);
    const Pt& S = *s_.point(pid);
    bas_ = Bas{};
    bas_.actif = true;
    bas_.pid = pid;
    bas_.x = S.x;
    bas_.y = S.y;
    bas_.fa = fa;
    bas_.centre = outil_ == RECTANGLE && (ctrl || modeRect_ == "centre");
    if (outil_ == POLYGONE) {
      poly_.aDernier = false;
      poly_.ang = PI_ / 2;
    }
    return;
  }
  if (outil_ == POINT_C || outil_ == PERCAGE) return poserPointSeul(wx, wy, outil_ == PERCAGE);
  if (outil_ == CONGE || outil_ == CHANFREIN) return clicCoin(wx, wy, outil_ == CONGE);
  if (outil_ == ARC) enfonceArc(wx, wy);
}

void Dessin::enfonceArc(double wx, double wy) {
  if (arcC_.empty()) {
    pousser();
    arcC_ = pointAccroche(wx, wy);
    message("Arc : cliquez le point de départ.");
    return;
  }
  if (!arcA1Pose_) {
    pousser();
    const std::string pa = pointAccroche(wx, wy);
    const Pt P0 = *s_.point(pa);
    const Pt C = *s_.point(arcC_);
    const double rr = hyp(P0.x - C.x, P0.y - C.y);
    if (rr < 4 / echelle_) {
      message("Arc : départ trop près du centre.");
      return;
    }
    arcPa_ = pa;
    arcA1_ = m_atan2(P0.y - C.y, P0.x - C.x);
    arcA1Pose_ = true;
    brouillon_ = Brouillon{};
    brouillon_.sorte = Brouillon::B_ARC;
    brouillon_.cx = C.x;
    brouillon_.cy = C.y;
    brouillon_.r = rr;
    brouillon_.a1 = arcA1_;
    brouillon_.a2 = arcA1_ + 0.6;
    message("Arc : cliquez le point final.");
    return;
  }
  pousser();
  const std::string pb = pointAccroche(wx, wy);
  Entite na;
  na.id = nouvelE();
  na.t = "arc";
  na.pc = arcC_;
  na.pa = arcPa_;
  na.pb = pb;
  na.r = brouillon_.r;
  // cote R posée à la création, sauf si le centre et un bout sont déjà tenus par ce qu'on a cliqué
  const auto tenu = [&](const std::string& q) {
    if (q == "O") return true;
    for (const Entite& x : s_.entites) {
      const std::vector<std::string> v = ptsEntite(x);
      if (std::find(v.begin(), v.end(), q) != v.end()) return true;
    }
    return aContrainte([&](const Contrainte& x) { return x.p == q || x.a == q || x.b == q; });
  };
  if (!(tenu(na.pc) && (tenu(na.pa) || tenu(na.pb)))) {
    const Pt& Pa = *s_.point(na.pa);
    const Pt& Pb = *s_.point(na.pb);
    const double Rr = fixe(na.r, 2), demi = hyp(Pb.x - Pa.x, Pb.y - Pa.y) / 2;
    coteRond("radius", na.id, Rr > demi ? Rr : fixe(na.r, 6));
  }
  s_.entites.push_back(na);
  structure_ = true;
  for (const std::string* q : {&na.pa, &na.pb})
    if (const Pt* pp = s_.point(*q)) accrocher(*q, pp->x, pp->y, -1);
  if (const Pt* cp = s_.point(na.pc)) accrocher(na.pc, cp->x, cp->y, 1e-3);
  arcC_.clear();
  arcPa_.clear();
  arcA1Pose_ = false;
  brouillon_ = Brouillon{};
  apresEdition();
  message("Arc créé — cliquez le centre du suivant (Échap = fin).");
}

void Dessin::bouge(double wx, double wy, bool gaucheTenu) {
  if (glisseC_.actif) return bougerCoteSaisie(wx, wy);
  if (boite_.actif) {
    boite_.x1 = wx;
    boite_.y1 = wy;
    return;
  }
  if (planActif && !bas_.actif && glisseP_.empty() && !glisseE_.actif && !glisseC_.actif) {  // les arêtes du solide s'allument au survol
    if (outil_ == SELECTION) survolPlan_ = !pointProche(wx, wy, SNAP_).empty() || entiteProche(wx, wy, PICK_) ? CiblePlan{} : ciblePlan(wx, wy, true);
    else if (outilPlan()) accroche(wx, wy);
  }
  if (outil_ == SPLINE || outil_ == CSPLINE) return bougerSpline(wx, wy);
  if (outil_ == PROJETER) return bougerProjeter(wx, wy);
  if (outil_ == INTERSECTION) return bougerIsect(wx, wy);
  if (outil_ == COINCIDENT) {
    const Accroche a = accroche(wx, wy);
    aMarque_ = static_cast<bool>(a);
    marque_ = {a.x, a.y};
    return;
  }
  if (outil_ == COTE && !dimPose_.empty()) {
    if (Cote* d = cote(dimPose_)) return suivreCote(*d, wx, wy);
    dimPose_.clear();
  }
  if (outil_ == AJUSTER) {
    if (coupeGlisse_ && gaucheTenu) glisserAjuster(wx, wy);  // Windows envoie aussi des mouvements fictifs : seul un bouton tenu coupe
    apercu_ = calculerApercu(wx, wy);
    return;
  }
  if (outil_ == DECALER) {
    if (offArme_) {  // la distance vivante, sans aperçu : le clic fige
      curseurDecalage_ = Pt{wx, wy};
      const std::vector<std::string> ids = choixDecalables();
      if (!ids.empty() && !dyn_.actif) {
        char b[96];
        double best = 1e9;
        for (const std::string& id : ids) {
          const Entite* e = s_.entite(id);
          if (e->t == "line") {
            const Pt* A = s_.point(e->p1);
            const Pt* B = s_.point(e->p2);
            if (A && B) best = jsmin(best, distSeg(wx, wy, *A, *B));
          } else if (const Pt* C = s_.point(e->pc)) {
            if (e->r > 0) best = jsmin(best, std::abs(hyp(wx - C->x, wy - C->y) - e->r));
          }
        }
        snprintf(b, sizeof b, "%.2f mm : clic pour appliquer, Échap annule.", best);
        message(std::string("Décalage : ") + b);
      } else if (ids.empty() && !dyn_.actif && !splinesChoisies().empty()) {
        char b[96];
        snprintf(b, sizeof b, "%.2f mm : clic pour appliquer, Échap annule.", distanceSplines(splinesChoisies(), wx, wy));
        message(std::string("Décalage : ") + b);
      }
    }
    return;
  }
  if (!glisseP_.empty()) {
    if (!glisseBouge_ && hyp(wx - deWx_, wy - deWy_) * echelle_ <= 4) return;
    sync();
    if (ed_.solveur.pointFixe(glisseP_)) {
      message("Point fixé : retirez « Fixe » pour le déplacer.");
      return;
    }
    if (!glissePousse_) {
      pousser();
      glissePousse_ = true;
    }
    const Accroche a = accrocheGlisse(wx, wy, glisseP_);
    glisseAcc_ = a;
    double nx = wx, ny = wy;
    if (a) {
      nx = a.x;
      ny = a.y;
      aMarque_ = true;
      marque_ = {nx, ny};
    } else {
      if (grille) {
        nx = surGrille(nx);
        ny = surGrille(ny);
      }
      aMarque_ = false;
    }
    glisseBouge_ = true;
    ed_.solveur.glisserPoint(glisseP_, nx, ny, echelle_);
    ed_.solveur.recopierDans(s_);
    return;
  }
  if (glisseE_.actif) {
    const double dx = wx - glisseE_.x0, dy = wy - glisseE_.y0;
    if (!glisseE_.pousse) {
      if (hyp(dx, dy) * echelle_ <= 4) return;
      if (glisseE_.ancre.empty()) {
        message("Élément fixé : retirez « Fixe » pour le déplacer.");
        return;
      }
      pousser();
      glisseE_.pousse = true;
    }
    sync();
    ed_.solveur.glisserGroupe(glisseE_.pids, glisseE_.orig, glisseE_.ancre, dx, dy, glisseE_.rigide, echelle_);
    ed_.solveur.recopierDans(s_);
    return;
  }
  if (outil_ == LIGNE && bas_.actif) {
    bougerLigne(wx, wy);
    return;
  }
  if (outil_ == POLYGONE && bas_.actif) {
    bougerPolygone(wx, wy);
    return;
  }
  if (trActif(outil_) && glisseP_.empty() && !glisseE_.actif && (!bas_.actif || tr_.actif)) return trBouge(wx, wy);
  if (outil_ == OBLONG && bas_.actif) return oblongBouge(wx, wy);
  if (outil_ == RECTANGLE && bas_.actif) {
    double bx = wx, by = wy;
    const Accroche a = accroche(wx, wy);
    if (a) {
      bx = a.x;
      by = a.y;
    } else if (grille) {
      bx = surGrille(bx);
      by = surGrille(by);
    }
    double x1 = bas_.x, y1 = bas_.y;
    if (bas_.centre) {
      x1 = 2 * bas_.x - bx;
      y1 = 2 * bas_.y - by;
    }
    brouillon_ = Brouillon{};
    brouillon_.sorte = Brouillon::B_RECT;
    brouillon_.x1 = x1;
    brouillon_.y1 = y1;
    brouillon_.x2 = bx;
    brouillon_.y2 = by;
    return;
  }
  if (outil_ == CERCLE && bas_.actif) {
    double bx = wx, by = wy;
    const Accroche a = accroche(wx, wy);
    if (a) {
      bx = a.x;
      by = a.y;
    } else if (grille) {
      bx = surGrille(bx);
      by = surGrille(by);
    }
    brouillon_ = Brouillon{};
    brouillon_.sorte = Brouillon::B_CERCLE;
    brouillon_.cx = bas_.x;
    brouillon_.cy = bas_.y;
    brouillon_.r = hyp(bx - bas_.x, by - bas_.y);
    char t[80];
    snprintf(t, sizeof t, "Diamètre %.2f : second clic pour valider.", 2 * brouillon_.r);
    message(t);
    return;
  }
  if (outil_ == ARC && !arcC_.empty() && arcA1Pose_ && brouillon_.sorte == Brouillon::B_ARC) {
    const Pt& C = *s_.point(arcC_);
    const double a2 = m_atan2(wy - C.y, wx - C.x);
    double d = a2 - arcA1_;
    while (d <= 0) d += PI_ * 2;
    brouillon_.a2 = arcA1_ + d;
    return;
  }
  if (!bas_.actif && glisseP_.empty() && (outil_ == LIGNE || outil_ == ARC || outil_ == COTE)) {
    const Accroche a = accroche(wx, wy);
    aMarque_ = static_cast<bool>(a);
    marque_ = {a.x, a.y};
  }
}

void Dessin::bougerLigne(double wx, double wy) {
  double gx = wx, gy = wy;
  guide_ = Guide{};
  aMarque_ = false;
  Accroche s = accroche(wx, wy, bas_.pid);
  // Point du plan : accroche exacte ; arête du plan : le pied, sauf guide H / V actif
  if (s.sorte == Accroche::POINT || (s.sorte == Accroche::PLAN && s.plan.estPoint)) {
    gx = s.x;
    gy = s.y;
    aMarque_ = true;
    marque_ = {gx, gy};
  } else {
    if (s.sorte == Accroche::MILIEU) {
      aMarque_ = true;
      marque_ = {s.x, s.y};
    }
    if (std::abs(wx - bas_.x) < INF_) {
      gx = bas_.x;
      guide_.v = true;
      guide_.x = gx;
    }
    if (std::abs(wy - bas_.y) < INF_) {
      gy = bas_.y;
      guide_.h = true;
      guide_.y = gy;
    }
    if (s.sorte == Accroche::PLAN) {
      if (guide_.v || guide_.h) {
        s = Accroche{};
        survolPlan_ = CiblePlan{};
      } else {
        gx = s.x;
        gy = s.y;
        aMarque_ = true;
        marque_ = {gx, gy};
      }
    }
    if (grille && !s) {
      if (!guide_.v) gx = surGrille(gx);
      if (!guide_.h) gy = surGrille(gy);
    }
  }
  const double dxB = gx - bas_.x, dyB = gy - bas_.y, lenB = hyp(dxB, dyB);
  if (lenB > 1e-6 && s.sorte != Accroche::PLAN) {
    std::string bestPerp;
    double bestD = 1e9;
    for (const Entite& l : s_.entites) {
      if (l.t != "line") continue;
      const Pt* A = s_.point(l.p1);
      const Pt* B = s_.point(l.p2);
      if (!A || !B) continue;
      const double ux = B->x - A->x, uy = B->y - A->y;
      double ul = hyp(ux, uy);
      if (ul == 0) ul = 1e-9;
      if (std::abs((dxB * ux + dyB * uy) / (lenB * ul)) > 0.053) continue;
      const bool partage = l.p1 == bas_.pid || l.p2 == bas_.pid;
      const double dl = distSeg(wx, wy, *A, *B);
      if (!partage && dl > INF_ * 4) continue;
      if (dl < bestD) {
        bestD = dl;
        bestPerp = l.id;
      }
    }
    if (!bestPerp.empty()) guide_.perp = bestPerp;
    if (bestPerp.empty() && !guide_.h && !guide_.v) {
      std::string bestPar, bestExt;
      double bestPD = 1e9, bestED = 1e9, extX = 0, extY = 0;
      Pt extDe;
      for (const Entite& l : s_.entites) {
        if (l.t != "line") continue;
        const Pt* A = s_.point(l.p1);
        const Pt* B = s_.point(l.p2);
        if (!A || !B) continue;
        const double ux = B->x - A->x, uy = B->y - A->y, ul = hyp(ux, uy);
        if (ul < 1e-9) continue;
        if (std::abs(ux) < 1e-9 * ul || std::abs(uy) < 1e-9 * ul) continue;
        const bool touche = l.p1 == bas_.pid || l.p2 == bas_.pid;
        const double t = ((wx - A->x) * ux + (wy - A->y) * uy) / (ul * ul), dL = std::abs((wx - A->x) * (-uy) + (wy - A->y) * ux) / ul;
        if (!touche && (t < -1e-3 || t > 1 + 1e-3) && dL < INF_ * 0.8 && dL < bestED) {
          bestED = dL;
          bestExt = l.id;
          extX = A->x + ux * t;
          extY = A->y + uy * t;
          extDe = t < 0 ? *A : *B;
        }
        if (touche) continue;
        const double sn = std::abs((dxB * uy - dyB * ux) / (lenB * ul));
        if (sn > 0.053) continue;
        const double dl = distSeg(wx, wy, *A, *B);
        if (dl < bestPD) {
          bestPD = dl;
          bestPar = l.id;
        }
      }
      if (!bestExt.empty()) {
        gx = extX;
        gy = extY;
        guide_.ext = bestExt;
        guide_.depuis = extDe;
        guide_.x = gx;
        guide_.y = gy;
      } else if (!bestPar.empty()) {
        const Entite* l = s_.entite(bestPar);
        const Pt* A = s_.point(l->p1);
        const Pt* B = s_.point(l->p2);
        const double ux = B->x - A->x, uy = B->y - A->y;
        double ul = hyp(ux, uy);
        if (ul == 0) ul = 1e-9;
        const double pr = (dxB * ux + dyB * uy) / ul;
        gx = bas_.x + ux / ul * pr;
        gy = bas_.y + uy / ul * pr;
        guide_.par = bestPar;
      }
    }
    std::string bestTan;
    for (const Entite& c : s_.entites) {
      if (c.t != "circle" && c.t != "arc") continue;
      const Pt* C = s_.point(c.pc);
      if (!C) continue;
      const double dd = distSeg(C->x, C->y, Pt{bas_.x, bas_.y}, Pt{gx, gy});
      if (std::abs(dd - c.r) < INF_ * 1.5) bestTan = c.id;
    }
    if (!bestTan.empty()) guide_.tan = bestTan;
  }
  brouillon_ = Brouillon{};
  brouillon_.sorte = Brouillon::B_LIGNE;
  brouillon_.x1 = bas_.x;
  brouillon_.y1 = bas_.y;
  brouillon_.x2 = gx;
  brouillon_.y2 = gy;
  brouillon_.accroche = s;
}

std::string Dessin::validerLigne(const std::string& depuis, const Accroche& a, double ex, double ey) {
  pousser();
  std::string fin;
  if (a.sorte == Accroche::POINT) {
    fin = a.id;
  } else if (a.sorte == Accroche::PLAN) {
    fin = materialiser(a.plan);
  } else if (a.sorte == Accroche::MILIEU) {
    fin = ajouterPoint(a.x, a.y);
    Contrainte c = contrainte("midpoint");
    c.p = fin;
    c.line = a.id;
    lier(c);
  } else {
    fin = ajouterPoint(ex, ey);
  }
  if (fin.empty() || fin == depuis) return "";
  Entite nl;
  nl.id = nouvelE();
  nl.t = "line";
  nl.p1 = depuis;
  nl.p2 = fin;
  s_.entites.push_back(nl);
  structure_ = true;
  const Guide g = guide_;
  if (g.h && !aHV(nl.id, "h")) {
    Contrainte c = contrainte("h");
    c.line = nl.id;
    lier(c);
  }
  if (g.v && !aHV(nl.id, "v")) {
    Contrainte c = contrainte("v");
    c.line = nl.id;
    lier(c);
  }
  if (!g.perp.empty()) {
    const bool deja = aContrainte([&](const Contrainte& k) { return k.type == "perpendicular" && ((k.a == nl.id && k.b == g.perp) || (k.a == g.perp && k.b == nl.id)); });
    const bool impl = (aHV(nl.id, "h") && aHV(g.perp, "v")) || (aHV(nl.id, "v") && aHV(g.perp, "h"));
    if (!deja && !impl) {
      Contrainte c = contrainte("perpendicular");
      c.a = nl.id;
      c.b = g.perp;
      lier(c);
    }
  }
  if (!g.par.empty() && g.par != nl.id && !aContrainte([&](const Contrainte& k) { return k.type == "parallel" && ((k.a == nl.id && k.b == g.par) || (k.a == g.par && k.b == nl.id)); }) && s_.entite(g.par)) {
    Contrainte c = contrainte("parallel");
    c.a = nl.id;
    c.b = g.par;
    lier(c);
  }
  if (!g.ext.empty() && g.ext != nl.id && s_.entite(g.ext) && !aContrainte([&](const Contrainte& k) { return k.type == "online" && k.p == fin && k.line == g.ext; })) {
    Contrainte c = contrainte("online");
    c.p = fin;
    c.line = g.ext;
    lier(c);
  }
  if (!g.tan.empty() && !aContrainte([&](const Contrainte& k) { return k.type == "tangent" && k.line == nl.id && k.ent == g.tan; })) {
    Contrainte c = contrainte("tangent");
    c.line = nl.id;
    c.ent = g.tan;
    lier(c);
    epinglerTangence(nl.id, g.tan);
  }
  for (const std::string* q : {&nl.p1, &nl.p2})
    if (const Pt* pp = s_.point(*q)) accrocher(*q, pp->x, pp->y, -1);
  chaine_ = fin;
  return nl.id;
}

void Dessin::relacherLigne(double wx, double wy) {
  const Brouillon d = brouillon_;
  const bool aB = d.sorte == Brouillon::B_LIGNE;
  const double L = aB ? hyp(d.x2 - d.x1, d.y2 - d.y1) : 0;
  const double distBrute = hyp(wx - bas_.x, wy - bas_.y);
  const bool valide = bas_.clique || hyp((wx - bas_.wx) * echelle_, (wy - bas_.wy) * echelle_) > 5;
  std::string nl;
  if (valide && aB && L > longueurMini()) {
    nl = validerLigne(bas_.pid, d.accroche, d.x2, d.y2);
  } else if (valide && distBrute > longueurMini()) {
    const Accroche s = accroche(wx, wy, bas_.pid);
    double ex = wx, ey = wy;
    if (s) {
      ex = s.x;
      ey = s.y;
    } else if (grille) {
      ex = surGrille(ex);
      ey = surGrille(ey);
    }
    nl = validerLigne(bas_.pid, s, ex, ey);
  } else {
    if (bas_.clique || bas_.depuisChaine) {
      bas_ = Bas{};
      chaine_.clear();
      message("Point de départ annulé : recliquez pour recommencer.");
    } else {
      message("Point de départ posé : déplacez puis second clic.");
    }
  }
  if (!nl.empty()) {
    const Entite* e = s_.entite(nl);
    const std::string fin = e->p2;
    const Pt* EP = s_.point(fin);
    int usages = 0;
    for (const Entite& x : s_.entites)
      if (x.p1 == fin || x.p2 == fin || x.pa == fin || x.pb == fin) usages++;
    if (EP && usages < 2) {
      bas_ = Bas{};
      bas_.actif = true;
      bas_.pid = fin;
      bas_.x = EP->x;
      bas_.y = EP->y;
      bas_.depuisChaine = true;
      bas_.clique = true;
      bas_.wx = wx;
      bas_.wy = wy;
      chaine_.clear();
      message("Ligne créée : la suivante part de son extrémité (clic : ligne suivante ; Échap ou clic droit : fin).");
    } else {
      bas_ = Bas{};
      chaine_.clear();
      message("Contour refermé : cliquez un nouveau point de départ (Échap : fin).");
    }
  }
  resoudre();
  brouillon_ = Brouillon{};
  guide_ = Guide{};
  aMarque_ = false;
  nettoyer();
}

// Oblong : deux droites, deux arcs tangents et la droite de construction entre les centres.
// Couché ou debout, le navigateur écrit deux fois la même chose : seuls les noms et H ou V changent.
// Point de construction et centre de perçage : un clic, et l'outil reste
void Dessin::poserPointSeul(double wx, double wy, bool percage) {
  pousser();
  const std::string pid = pointAccroche(wx, wy);
  Entite e;
  e.id = nouvelE();
  e.t = "cpoint";
  e.p = pid;
  e.percage = percage;
  s_.entites.push_back(std::move(e));
  structure_ = true;
  accrocher(pid, wx, wy, -1);
  apresEdition();
  if (percage) message("Centre de perçage posé : cotez-le, puis fonction 3D « Perçage ».");
}

// ---------- Polygone (50-esquisse-8-polygone.js) ----------
bool Dessin::viserPolygone(double wx, double wy, bool& bouge, double& r) {
  if (!bas_.actif) return false;
  double bx = wx, by = wy;
  const Accroche s = accroche(wx, wy);
  if (s) {
    bx = s.x;
    by = s.y;
  } else if (grille) {
    bx = surGrille(bx);
    by = surGrille(by);
  }
  bouge = hyp(wx - bas_.x, wy - bas_.y) > longueurMini();
  if (bouge) {
    // Aimant tous les 15° : les côtés tombent facilement à plat
    const double a = m_atan2(wy - bas_.y, wx - bas_.x), pas = PI_ / 12, k = std::floor(a / pas + 0.5);
    poly_.ang = std::abs(a - k * pas) < 4 * PI_ / 180 ? k * pas : a;
  }
  r = poly_.d != 0 ? poly_.d / 2 : hyp(bx - bas_.x, by - bas_.y);
  return true;
}
void Dessin::brouillonPolygone(double r, double ang) {
  brouillon_ = Brouillon{};
  if (r <= 0) return;
  brouillon_.sorte = Brouillon::B_POLYGONE;
  brouillon_.cx = bas_.x;
  brouillon_.cy = bas_.y;
  brouillon_.n = poly_.n;
  brouillon_.r = r;
  brouillon_.a1 = ang;
}
void Dessin::bougerPolygone(double wx, double wy) {
  bool bouge = false;
  double r = 0;
  if (!viserPolygone(wx, wy, bouge, r)) return;
  poly_.aDernier = true;
  poly_.dernier = Pt{wx, wy};
  brouillonPolygone(r, poly_.ang);
}
void Dessin::relacherPolygone(double wx, double wy) {
  bool bouge = false;
  double r = 0;
  if (!viserPolygone(wx, wy, bouge, r)) return;
  if (!bouge || r <= longueurMini()) {
    brouillon_ = Brouillon{};
    message(poly_.d != 0 ? "Polygone : centre posé, cliquez pour orienter (Entrée : un côté à plat en haut)." : "Polygone : centre posé, cliquez le milieu d'un côté, ou tapez le diamètre intérieur.");
    return;
  }
  finirPolygone(r, poly_.ang);
}
void Dessin::finirPolygone(double r, double ang) {
  pousser();
  creerPolygone(bas_.pid, poly_.n, r, ang);
  bas_ = Bas{};
  brouillon_ = Brouillon{};
  poly_.aDernier = false;
  apresEdition();
  message("Polygone créé : cliquez le centre du suivant (Échap : fin).");
}
void Dessin::creerPolygone(const std::string& pc, int n, double r, double ang) {
  const Pt* cp = s_.point(pc);
  if (!cp) return;
  const Pt C = *cp;
  const double dVal = fixe(2 * r, 3);
  r = dVal / 2;
  // Sommets : ang vise le milieu du premier côté, r est le rayon intérieur
  const double a = PI_ / n, R = r / m_cos(a);
  std::vector<std::string> pids;
  for (int i = 0; i < n; i++) {
    const double t = ang - a + i * 2 * a;
    pids.push_back(ajouterPoint(C.x + R * m_cos(t), C.y + R * m_sin(t)));
  }
  Entite inner;
  inner.id = nouvelE();
  inner.t = "circle";
  inner.pc = pc;
  inner.r = r;
  inner.construction = true;
  inner.poly = pids;
  std::vector<Entite> lignes;
  for (int i = 0; i < n; i++) {
    Entite l;
    l.id = nouvelE();
    l.t = "line";
    l.p1 = pids[i];
    l.p2 = pids[(i + 1) % n];
    lignes.push_back(std::move(l));
  }
  for (const Entite& l : lignes) {
    Contrainte c = contrainte("tangent");
    c.line = l.id;
    c.ent = inner.id;
    lier(c);
  }
  for (size_t i = 1; i < lignes.size(); i++) {
    Contrainte c = contrainte("equal");
    c.a = lignes[0].id;
    c.b = lignes[i].id;
    lier(c);
  }
  const std::string mid = ajouterPoint(C.x + r * m_cos(ang), C.y + r * m_sin(ang));
  Entite rayon;
  rayon.id = nouvelE();
  rayon.t = "line";
  rayon.p1 = pc;
  rayon.p2 = mid;
  rayon.construction = true;
  inner.poly.push_back(mid);
  s_.entites.insert(s_.entites.end(), lignes.begin(), lignes.end());
  s_.entites.push_back(inner);
  s_.entites.push_back(rayon);
  structure_ = true;
  Contrainte m = contrainte("midpoint");
  m.p = mid;
  m.line = lignes[0].id;
  lier(m);
  Contrainte pp = contrainte("perpendicular");
  pp.a = rayon.id;
  pp.b = lignes[0].id;
  lier(pp);
  if (std::abs(m_cos(ang)) < 1e-9) {
    Contrainte c = contrainte("h");
    c.line = lignes[0].id;
    lier(c);
  } else if (std::abs(m_sin(ang)) < 1e-9) {
    Contrainte c = contrainte("v");
    c.line = lignes[0].id;
    lier(c);
  }
  Cote d;
  d.id = nouvelE();
  d.type = "diameter";
  d.ent = inner.id;
  d.value = dVal;
  s_.cotes.push_back(std::move(d));
  accrocher(pc, C.x, C.y, 1e-3);
}
bool Dessin::entreePolygone() {
  if (!bas_.actif) return false;
  premiere();
  sync();
  const double r = brouillon_.sorte == Brouillon::B_POLYGONE ? brouillon_.r : (poly_.d != 0 ? poly_.d / 2 : 0);
  if (!(r > longueurMini())) {
    message("Polygone : indiquez le diamètre intérieur.");
    return false;
  }
  finirPolygone(poly_.d != 0 ? poly_.d / 2 : r, poly_.aDernier ? poly_.ang : PI_ / 2);
  return true;
}
void Dessin::lirePolygone(int n, const std::string& diametre) {
  if (n >= 3 && n <= 64) poly_.n = n;
  std::string t = diametre;
  const size_t virgule = t.find(',');
  if (virgule != std::string::npos) t[virgule] = '.';
  const double dv = t.empty() ? 0 : std::strtod(t.c_str(), nullptr);
  poly_.d = dv > 0 ? dv : 0;
  if (bas_.actif && outil_ == POLYGONE) {
    if (poly_.d != 0) message("Polygone : cliquez pour orienter, ou Entrée (un côté à plat en haut).");
    if (poly_.aDernier) bougerPolygone(poly_.dernier.x, poly_.dernier.y);
    else brouillonPolygone(poly_.d != 0 ? poly_.d / 2 : 0, PI_ / 2);
  }
}

// ---------- Congé et chanfrein d'esquisse (50-esquisse-3-edition-geometrie.js) ----------
namespace {
// skNiceVal : valeur ronde au plus égale à v, dans la série 1-2-5
double valeurRonde(double v) {
  if (!(v > 0)) return 0.1;
  const double e = std::pow(10.0, std::floor(std::log10(v)));
  const double m = v / e;
  return (m >= 5 ? 5 : (m >= 2 ? 2 : 1)) * e;
}
struct GeomConge {
  bool ok = false;
  const char* motif = "";
  double rEff = 0;
  Pt T1, T2, C1, C2;
};
// filletCornerGeom
GeomConge geomConge(const Pt& A, const Pt& V, const Pt& B, double r) {
  GeomConge g;
  const double lIn = hyp(V.x - A.x, V.y - A.y), lOut = hyp(B.x - V.x, B.y - V.y);
  if (!(lIn > 1e-9) || !(lOut > 1e-9)) {
    g.motif = "coin dégénéré";
    return g;
  }
  const double ux = (A.x - V.x) / lIn, uy = (A.y - V.y) / lIn, wx = (B.x - V.x) / lOut, wy = (B.y - V.y) / lOut;
  const double cosA = jsmin(1.0, jsmax(-1.0, ux * wx + uy * wy));
  const double sinH = std::sqrt(jsmax((1 - cosA) / 2, 1e-12)), cosH = std::sqrt(jsmax((1 + cosA) / 2, 1e-12));
  const double rEff = jsmin(r, 0.49 * jsmin(lIn, lOut) * sinH / jsmax(cosH, 1e-12));
  if (!(rEff > 1e-3)) {
    g.motif = "coin trop tangent, pas de place pour le rayon";
    return g;
  }
  const double t = rEff * cosH / jsmax(sinH, 1e-12);
  if (!(t > 1e-9)) {
    g.motif = "rayon invalide";
    return g;
  }
  double bx = ux + wx, by = uy + wy;
  const double bl = hyp(bx, by);
  if (!(bl > 1e-9)) {
    g.motif = "coin droit (180°), rien à arrondir";
    return g;
  }
  bx /= bl;
  by /= bl;
  const double off = rEff / jsmax(sinH, 1e-12);
  g.ok = true;
  g.rEff = rEff;
  g.T1 = Pt{V.x + ux * t, V.y + uy * t};
  g.T2 = Pt{V.x + wx * t, V.y + wy * t};
  g.C1 = Pt{V.x + bx * off, V.y + by * off};
  g.C2 = Pt{V.x - bx * off, V.y - by * off};
  return g;
}
}  // namespace

double Dessin::longueurLigne(const std::string& id) const {
  const Entite* e = s_.entite(id);
  if (!e) return 0;
  const Pt* A = s_.point(e->p1);
  const Pt* B = s_.point(e->p2);
  return A && B ? hyp(B->x - A->x, B->y - A->y) : 0;
}

bool Dessin::coinCommun(const std::string& a, const std::string& b, std::string& pid, std::string& msg) const {
  const Entite* A = s_.entite(a);
  const Entite* B = s_.entite(b);
  if (!A || !B || A->t != "line" || B->t != "line") {
    msg = "Congé ou chanfrein : sélectionnez 2 lignes droites.";
    return false;
  }
  if (a == b) {
    msg = "Sélectionnez 2 lignes distinctes.";
    return false;
  }
  pid = (A->p1 == B->p1 || A->p1 == B->p2) ? A->p1 : (A->p2 == B->p1 || A->p2 == B->p2) ? A->p2 : "";
  if (pid.empty()) {
    msg = "Les 2 lignes doivent se toucher (coin commun).";
    return false;
  }
  for (const Entite& e : s_.entites) {
    if (e.id == a || e.id == b || e.construction || e.t == "cpoint") continue;
    if (e.p1 == pid || e.p2 == pid || e.pa == pid || e.pb == pid || e.p == pid) {
      msg = "Coin partagé avec une autre entité : congé ou chanfrein impossible ici.";
      return false;
    }
  }
  return true;
}

void Dessin::garderCoinVirtuel(const std::string& pid, const std::string& a, const std::string& b) {
  const bool sert = aContrainte([&](const Contrainte& c) { return c.p == pid || c.a == pid || c.b == pid; }) ||
                    std::any_of(s_.cotes.begin(), s_.cotes.end(), [&](const Cote& d) { return d.a == pid || d.b == pid || d.p == pid; });
  if (!sert) return;
  for (const std::string* l : {&a, &b})
    if (!aContrainte([&](const Contrainte& c) { return c.type == "online" && c.p == pid && c.line == *l; })) {
      Contrainte c = contrainte("online");
      c.p = pid;
      c.line = *l;
      lier(c);
    }
}

void Dessin::garderCotesHorsTout(const std::vector<std::string>& ids) {
  for (Contrainte& c : s_.contraintes)
    if (c.type == "symmetric" && (std::find(ids.begin(), ids.end(), c.a) != ids.end() || std::find(ids.begin(), ids.end(), c.b) != ids.end())) c.inf = true;
  for (const std::string& id : ids) {
    const Entite* L = s_.entite(id);
    if (!L || L->t != "line") continue;
    const auto voisine = [&](const std::string& pid) -> const Entite* {
      for (const Entite& e : s_.entites)
        if (e.id != id && e.t == "line" && (e.p1 == pid || e.p2 == pid)) return &e;
      return nullptr;
    };
    const Entite* N1 = voisine(L->p1);
    const Entite* N2 = voisine(L->p2);
    if (!N1 || !N2 || N1 == N2) continue;
    const auto sens = [&](const Entite& e) {
      const Pt* a = s_.point(e.p1);
      const Pt* b = s_.point(e.p2);
      const double dx = b->x - a->x, dy = b->y - a->y, l0 = hyp(dx, dy), l = l0 != 0 ? l0 : 1;
      return Pt{dx / l, dy / l};
    };
    if (!s_.point(N1->p1) || !s_.point(N1->p2) || !s_.point(N2->p1) || !s_.point(N2->p2)) continue;
    const Pt a = sens(*N1), b = sens(*N2);
    if (std::abs(a.x * b.y - a.y * b.x) > 1e-6) continue;
    for (Cote& d : s_.cotes) {
      if (d.type != "length" || d.line != id) continue;
      const Pt* A1 = s_.point(N1->p1);
      const Pt* B1 = s_.point(N2->p1);
      const double g = std::abs((B1->x - A1->x) * (-a.y) + (B1->y - A1->y) * a.x);
      d.type = "gap";
      d.a = N1->id;
      d.b = N2->id;
      d.value = fixe(g, 4);
      d.line.clear();
      d.orient.clear();
      d.aW = false;
      d.w = 0;
      d.sgn = 0;
    }
  }
}

bool Dessin::congeCoin(const std::string& a, const std::string& b, double r, std::string& nouveau, std::string& msg) {
  std::string pid;
  if (!coinCommun(a, b, pid, msg)) return false;
  const Entite A0 = *s_.entite(a), B0 = *s_.entite(b);
  const Pt* Vp = s_.point(pid);
  const Pt* Aop = s_.point(A0.p1 == pid ? A0.p2 : A0.p1);
  const Pt* Bop = s_.point(B0.p1 == pid ? B0.p2 : B0.p1);
  if (!Vp || !Aop || !Bop) {
    msg = "Congé : coin illisible.";
    return false;
  }
  const Pt V = *Vp;
  const GeomConge g = geomConge(*Aop, V, *Bop, r);
  if (!g.ok) {
    msg = std::string("Congé : ") + g.motif + (std::string(g.motif).find("place") != std::string::npos ? " : essayez un rayon plus petit." : ".");
    return false;
  }
  garderCotesHorsTout({a, b});
  garderCoinVirtuel(pid, a, b);
  const bool plafonne = g.rEff < r - 1e-6;
  // filletCenterFor : le centre qui remplace la pointe, de l'autre côté de la corde par rapport à V
  const double sV = (g.T2.x - g.T1.x) * (V.y - g.T1.y) - (g.T2.y - g.T1.y) * (V.x - g.T1.x);
  const double s1 = (g.T2.x - g.T1.x) * (g.C1.y - g.T1.y) - (g.T2.y - g.T1.y) * (g.C1.x - g.T1.x);
  const Pt C = (sV != 0 && s1 * sV >= 0) ? g.C2 : g.C1;
  const std::string idT1 = ajouterPoint(g.T1.x, g.T1.y), idT2 = ajouterPoint(g.T2.x, g.T2.y), idC = ajouterPoint(C.x, C.y);
  Entite* A = entite(a);
  Entite* B = entite(b);
  if (A->p1 == pid) A->p1 = idT1;
  else A->p2 = idT1;
  if (B->p1 == pid) B->p1 = idT2;
  else B->p2 = idT2;
  std::string pa = idT1, pb = idT2;
  {
    const double b1 = m_atan2(g.T1.y - C.y, g.T1.x - C.x), b2 = m_atan2(g.T2.y - C.y, g.T2.x - C.x);
    double d = std::fmod(b2 - b1, PI_ * 2);
    if (d <= 0) d += PI_ * 2;
    if (d > PI_) {
      pa = idT2;
      pb = idT1;
    }
  }
  Entite arc;
  arc.id = nouvelE();
  arc.t = "arc";
  arc.pc = idC;
  arc.pa = pa;
  arc.pb = pb;
  arc.r = g.rEff;
  const std::string arcId = arc.id;
  s_.entites.push_back(std::move(arc));
  structure_ = true;
  for (const std::string* l : {&a, &b})
    if (!aContrainte([&](const Contrainte& c) { return c.type == "tangent" && c.line == *l && c.ent == arcId; })) {
      Contrainte c = contrainte("tangent");
      c.line = *l;
      c.ent = arcId;
      lier(c);
    }
  epinglerTangence(a, arcId);
  epinglerTangence(b, arcId);
  Cote d;
  d.id = nouvelE();
  d.type = "radius";
  d.ent = arcId;
  d.value = fixe(g.rEff, 3);
  s_.cotes.push_back(std::move(d));
  nouveau = arcId;
  char t[80];
  snprintf(t, sizeof t, "Congé R%.2f%s", g.rEff, plafonne ? " (plafonné pour tenir)" : "");
  msg = t;
  return true;
}

bool Dessin::chanfreinCoin(const std::string& a, const std::string& b, double dVoulu, std::string& nouveau, std::string& msg) {
  std::string pid;
  if (!coinCommun(a, b, pid, msg)) return false;
  const Entite A0 = *s_.entite(a), B0 = *s_.entite(b);
  const Pt* Vp = s_.point(pid);
  const Pt* Aop = s_.point(A0.p1 == pid ? A0.p2 : A0.p1);
  const Pt* Bop = s_.point(B0.p1 == pid ? B0.p2 : B0.p1);
  if (!Vp || !Aop || !Bop) {
    msg = "Chanfrein : coin illisible.";
    return false;
  }
  const Pt V = *Vp, Ao = *Aop, Bo = *Bop;
  const double lA = hyp(Ao.x - V.x, Ao.y - V.y), lB = hyp(Bo.x - V.x, Bo.y - V.y);
  if (!(jsmin(lA, lB) > 1)) {
    msg = "Chanfrein : segment trop court.";
    return false;
  }
  const double dd = jsmin(dVoulu, 0.95 * jsmin(lA, lB));
  const bool plafonne = dd < dVoulu - 1e-9;
  const Pt P1{V.x + (Ao.x - V.x) / lA * dd, V.y + (Ao.y - V.y) / lA * dd};
  const Pt P2{V.x + (Bo.x - V.x) / lB * dd, V.y + (Bo.y - V.y) / lB * dd};
  garderCotesHorsTout({a, b});
  garderCoinVirtuel(pid, a, b);
  const std::string id1 = ajouterPoint(P1.x, P1.y), id2 = ajouterPoint(P2.x, P2.y);
  Entite* A = entite(a);
  Entite* B = entite(b);
  if (A->p1 == pid) A->p1 = id1;
  else A->p2 = id1;
  if (B->p1 == pid) B->p1 = id2;
  else B->p2 = id2;
  Entite seg;
  seg.id = nouvelE();
  seg.t = "line";
  seg.p1 = id1;
  seg.p2 = id2;
  const std::string segId = seg.id;
  s_.entites.push_back(std::move(seg));
  structure_ = true;
  Cote d;
  d.id = nouvelE();
  d.type = "length";
  d.line = segId;
  d.value = fixe(hyp(P2.x - P1.x, P2.y - P1.y), 3);
  s_.cotes.push_back(std::move(d));
  nouveau = segId;
  char t[80];
  snprintf(t, sizeof t, "Chanfrein %.2f mm%s", dd, plafonne ? " (plafonné au segment)" : "");
  msg = t;
  return true;
}

bool Dessin::lierCoin(bool conge, const std::string& nouveau) {
  if (nouveau.empty()) return false;
  if (passeCoin_.empty() || passeConge_ != conge || !s_.entite(passeCoin_)) {
    passeCoin_ = nouveau;
    passeConge_ = conge;
    return false;
  }
  s_.cotes.erase(std::remove_if(s_.cotes.begin(), s_.cotes.end(), [&](const Cote& d) { return conge ? d.type == "radius" && d.ent == nouveau : d.type == "length" && d.line == nouveau; }), s_.cotes.end());
  Contrainte c = contrainte("equal");
  c.a = passeCoin_;
  c.b = nouveau;
  lier(c);
  return true;
}

void Dessin::clicCoin(double wx, double wy, bool conge) {
  const char* nom = conge ? "Congé" : "Chanfrein";
  std::string depuisCoin;
  if (coinA_.empty()) {
    const std::string cp = pointProche(wx, wy, SNAP_);
    if (!cp.empty()) {
      std::vector<std::string> ls;
      for (const Entite& e : s_.entites)
        if (e.t == "line" && !e.construction && (e.p1 == cp || e.p2 == cp)) ls.push_back(e.id);
      if (ls.size() == 2) {
        coinA_ = ls[0];
        coinOutilConge_ = conge;
        depuisCoin = ls[1];
      }
    }
  }
  const Entite* ent = !depuisCoin.empty() ? s_.entite(depuisCoin) : entiteProche(wx, wy, 12 / echelle_, false);
  if (!ent || ent->t != "line") return message(std::string(nom) + " : cliquez une ligne droite.");
  const std::string idE = ent->id;
  if (coinA_.empty() || coinOutilConge_ != conge) {
    coinA_ = idE;
    coinOutilConge_ = conge;
    return message(std::string(nom) + " : première arête choisie, cliquez la seconde (coin commun).");
  }
  if (idE == coinA_) return message("Même ligne : cliquez une autre ligne.");
  pousser();
  const double lA = longueurLigne(coinA_), lB = longueurLigne(idE);
  const double cap = valeurRonde(0.2 * jsmin(lA, lB));
  std::string neuf, msg;
  const std::string a = coinA_;
  const bool ok = conge ? congeCoin(a, idE, jsmin(filletR_, cap), neuf, msg) : chanfreinCoin(a, idE, jsmin(chamferD_, cap), neuf, msg);
  coinA_.clear();
  if (!ok) {
    if (annulerPas) annulerPas();
    return message(msg);
  }
  const bool lie = lierCoin(conge, neuf);
  apresEdition();
  message(msg + (lie ? " : lié au premier, une seule cote pilote tous les coins de la passe (Échap : nouvelle passe)." : conge ? " : R modifiable (double-clic sur la cote), les coins suivants suivront cette cote." : " : retrait modifiable (double-clic sur la cote), les coins suivants suivront cette cote."));
}

void Dessin::congeSelection() {
  std::vector<std::string> ls;
  for (const Entite* e : entitesChoisies())
    if (e->t == "line" && !e->construction) ls.push_back(e->id);
  std::vector<std::pair<std::string, std::string>> paires;
  for (size_t i = 0; i < ls.size(); i++)
    for (size_t j = i + 1; j < ls.size(); j++) {
      const Entite* a = s_.entite(ls[i]);
      const Entite* b = s_.entite(ls[j]);
      if (a->p1 == b->p1 || a->p1 == b->p2 || a->p2 == b->p1 || a->p2 == b->p2) paires.push_back({ls[i], ls[j]});
    }
  if (paires.empty()) return message("Congé : sélectionnez des lignes qui forment un coin (2 ou plus).");
  pousser();
  double minL = std::numeric_limits<double>::infinity();
  for (const std::string& l : ls) minL = jsmin(minL, longueurLigne(l));
  const double R = jsmin(filletR_, valeurRonde(0.2 * minL));
  passeCoin_.clear();
  int n = 0;
  std::string msg;
  for (const auto& [a, b] : paires) {
    std::string neuf;
    if (congeCoin(a, b, R, neuf, msg)) {
      lierCoin(true, neuf);
      n++;
    }
  }
  passeCoin_.clear();
  if (!n) {
    if (annulerPas) annulerPas();
    return message(msg.empty() ? "Congé impossible." : msg);
  }
  apresEdition();
  char t[100];
  snprintf(t, sizeof t, "%d congé(s) R%g : une seule cote pilote (double-clic pour la modifier).", n, R);
  message(t);
}

void Dessin::chanfreinSelection() {
  std::vector<std::string> ls;
  for (const Entite* e : entitesChoisies())
    if (e->t == "line") ls.push_back(e->id);
  if (ls.size() != 2) return message("Chanfrein : sélectionnez exactement 2 lignes.");
  pousser();
  std::string neuf, msg;
  if (!chanfreinCoin(ls[0], ls[1], jsmin(chamferD_, valeurRonde(0.2 * jsmin(longueurLigne(ls[0]), longueurLigne(ls[1])))), neuf, msg)) {
    if (annulerPas) annulerPas();
    return message(msg);
  }
  apresEdition();
  message(msg + " : retrait modifiable (double-clic sur la cote).");
}

// ---------- Le menu du clic droit (showSkCtx) ----------
std::vector<Dessin::EntreeMenu> Dessin::menuContextuel(std::string& titre) const {
  std::vector<EntreeMenu> m;
  titre = "Cote / Contrainte";
  const auto add = [&](const std::string& libelle, const std::string& code, const char* icone = "") { m.push_back({libelle, code, icone, true}); };
  const auto con = [&](const std::string& libelle, const char* type) { add(libelle, std::string("c:") + type, type); };
  if (outil_ == INTERSECTION) {  // skIsectCtx
    titre = "Intersection \xE2\xA8\xAF";
    const size_t n = isectSel_.size();
    const std::string pl = n > 1 ? "s" : "";
    if (n) add("\xE2\x9C\x93 Créer l'intersection des " + std::to_string(n) + " face" + pl + " retenue" + pl + " (Entrée)", "isect:valider");
    if (survolIsect_.ok) add("\xE2\xA8\xAF Corps entier sous le curseur", "isect:corps");
    add("\xE2\xA8\xAF Tous les corps coupés par le plan", "isect:tous");
    add(std::string(isectNormale ? "\xE2\x98\x91" : "\xE2\x98\x90") + " Créer en géométrie normale (profil)", "isect:normale");
    if (n) add("\xE2\x9C\x95 Vider la sélection", "isect:vider");
    return m;
  }
  const std::vector<const Entite*> ents = const_cast<Dessin*>(this)->entitesChoisies();
  std::vector<std::string> pts;  // pas pointsChoisis : le menu du navigateur compte deux fois un point choisi deux fois
  for (const Choix& c : selection_)
    if (c.sorte == Choix::POINT) pts.push_back(c.id);
  std::vector<const Entite*> lignes, cercles, arcs;
  for (const Entite* e : ents) {
    if (e->t == "line") lignes.push_back(e);
    if (e->t == "circle") cercles.push_back(e);
    if (e->t == "arc") arcs.push_back(e);
  }
  const size_t tot = ents.size() + pts.size();
  bool has = false;
  if (!selection_.empty() && selection_[0].sorte == Choix::COTE && ents.empty() && pts.empty()) {
    for (const Cote& d : s_.cotes)
      if (d.id == selection_[0].id) {
        titre = "Cote " + descCote(d) + (d.ref ? " (référence)" : "");
        add("Modifier la valeur", "modifier");
        add(d.ref ? "Rendre PILOTANTE" : "Rendre RÉFÉRENCE (mesure seulement)", "reference");
        add("Replacer le texte", "replacer");
        add("Supprimer", "supprimerCote");
        return m;
      }
  }
  bool uneNormale = false, uneBasculable = false;
  for (const Entite* e : ents)
    if ((e->t == "line" && !e->poignee) || e->t == "circle" || e->t == "arc" || e->t == "spline") {
      uneBasculable = true;
      uneNormale = uneNormale || !e->construction;
    }
  if (uneBasculable) {
    add(uneNormale ? "Construction (X)" : "Géométrie normale (X)", "c:construction", "construction");
    has = true;
  }
  std::vector<const Entite*> splines;
  for (const Entite* e : ents)
    if (e->t == "spline") splines.push_back(e);
  if (pts.size() == 1 && ents.size() <= 1) {
    for (const Entite& e : s_.entites) {
      if (e.t != "spline" || e.mode == "ctrl" || std::find(e.pts.begin(), e.pts.end(), pts[0]) == e.pts.end() || (!ents.empty() && ents[0]->id != e.id)) continue;
      const bool aH = lignePoignee(e, pts[0]) != nullptr;
      add(aH ? "Retirer la poignée de tangence" : "Poignée de tangence (direction + tension)", (aH ? "spl:retire:" : "spl:poignee:") + e.id, "tangent");
      has = true;
      break;
    }
  }
  if (pts.size() == 1 && splines.size() == 1 && ents.size() == 1 && std::find(splines[0]->pts.begin(), splines[0]->pts.end(), pts[0]) == splines[0]->pts.end()) {
    add("Coïncident (point sur la spline)", "c:coincident", "coincident");
    has = true;
  }
  if (splines.size() == 1 && tot == 1) {
    con("Fixe", "fix");
    add(peignes_.count(splines[0]->id) ? "Masquer le peigne de courbure" : "Peigne de courbure", "spl:peigne:" + splines[0]->id, "spline");
    has = true;
  }
  if (!splines.empty() && ents.size() == 2 && std::all_of(ents.begin(), ents.end(), [](const Entite* e) { return e->t == "spline" || (e->t == "line" && !e->poignee) || e->t == "circle" || e->t == "arc"; })) {
    add("Tangence", "c:tangent", "tangent");
    add("Courbure continue (G2)", "c:curvature", "spline");
    has = true;
  }
  if (lignes.size() == 1 && tot == 1) {
    add("Longueur", "longueur", "length");
    con("Horizontal (H)", "h");
    con("Vertical (V)", "v");
    con("Fixe", "fix");
    has = true;
    add(lignes[0]->axe ? "Retirer l’axe de rotation" : "Axe de rotation", "axe");
  }
  if (cercles.size() == 1 && tot == 1) {
    add("Diamètre", "diametre", "diameter");
    add("Rayon", "rayon", "radius");
    if (cercles[0]->pc != "O") add("Centre à l’origine", "centreOrigine", "coincident");
    con("Fixe", "fix");
    has = true;
  }
  if (arcs.size() == 1 && tot == 1) {
    add("Rayon", "rayon", "radius");
    if (arcs[0]->pc != "O") add("Centre à l’origine", "centreOrigine", "coincident");
    con("Fixe", "fix");
    has = true;
  }
  if (pts.size() == 1 && tot == 1) {
    if (pts[0] == "O") m.push_back({"(Origine 0,0 : point fixe permanent)", "", "", false});
    else {
      add("Fixer à l’origine", "pointOrigine", "coincident");
      con("Fixe", "fix");
    }
    has = true;
  }
  if (lignes.size() == 2) {
    add("Entraxe (//)", "entraxe", "gap");
    add("Angle", "angle", "angle");
    con("Parallèle", "parallel");
    con("Perpendiculaire", "perpendicular");
    con("Colinéaire", "collinear");
    con("Égal", "equal");
    con("Horizontal", "h");
    con("Vertical", "v");
    con("Milieux égaux (2 lignes)", "midpoint");
    has = true;
    add("Congé (arc tangent + R)", "conge", "fillet");
    add("Chanfrein (coupe + cote)", "chanfrein", "chamfer");
    bool decalable = false;
    for (const Entite* e : ents) decalable = decalable || ((e->t == "line" || e->t == "circle" || e->t == "arc") && !e->ref);
    if (decalable) {
      char t[64];
      snprintf(t, sizeof t, "%.1f", fixe(offsetD_, 1));
      std::string v(t);
      v[v.find('.')] = ',';
      add("Décaler (" + v + " mm, auto)", "decaler", "offset");
    }
  }
  if (pts.size() == 2) {
    add("Distance points", "distancePoints", "distance");
    add("Coïncident", "coincidentPoints", "coincident");
    con("Fixe", "fix");
    has = true;
  }
  if (lignes.size() > 2) {
    add("Congé sur tous les coins (une seule cote R)", "conge", "fillet");
    has = true;
  }
  if (pts.size() == 1 && lignes.size() == 1) {
    add("Distance point–ligne", "distancePointLigne", "distline");
    con("Coïncident (point sur la droite)", "coincident");
    con("Milieu (point au centre)", "midpoint");
    con("Fixe", "fix");
    has = true;
  }
  if (pts.size() == 1 && (cercles.size() == 1 || arcs.size() == 1)) {
    const Entite* c = !cercles.empty() ? cercles[0] : arcs[0];
    if (c->pc != pts[0]) {
      con(std::string("Coïncident (point sur ") + (!cercles.empty() ? "le cercle" : "l’arc") + ")", "coincident");
      add("Coïncident centre–point", "coincidentCentre", "coincident");
    }
    con("Fixe", "fix");
    has = true;
  }
  if (lignes.size() == 1 && (cercles.size() == 1 || arcs.size() == 1)) {
    con("Tangence", "tangent");
    add("Distance", "distanceLigneCentre", "distline");
    has = true;
  }
  if (lignes.size() == 3) {
    con("Symétrie (2 + axe)", "symmetric");
    has = true;
  }
  if (cercles.size() + arcs.size() == 2) {
    con("Égal", "equal");
    con("Tangence", "tangent");
    con("Coaxial (concentriques)", "coaxial");
    add("Distance centres", "distanceCentres", "distance");
    has = true;
  }
  if (!has) m.push_back({"(sélectionnez 1–2 entités : ligne, point, cercle, arc, ou 3D violet)", "", "", false});
  return m;
}

void Dessin::reinitTexteCote(const std::string& id) {
  Cote* d = cote(id);
  if (!d) return;
  pousser();
  d->aW = false;
  d->w = 0;
  d->sl = 0;
  d->ox = 0;
  d->oy = 0;
  message("Texte de la cote replacé.");
}

void Dessin::basculerAxe(const std::string& id) {
  Entite* e = entite(id);
  if (!e || e->t != "line") return;
  pousser();
  if (e->axe) e->axe = false;
  else {
    e->axe = true;
    e->construction = true;
  }
  const bool axe = e->axe;
  for (Cote& d : s_.cotes)
    if ((d.type == "distline" && d.line == id) || (d.type == "gap" && (d.a == id || d.b == id))) d.dia = axe;
  structure_ = true;
  apresEdition();
  message(axe ? "Axe de rotation : les cotes depuis cet axe sont en Ø." : "Ligne normale (axe retiré).");
}

void Dessin::coteAngleMenu(const Entite& A, const Entite& B) {
  SecteurAngle fr;
  const bool aFr = secteurAngle(s_, A.id, B.id, fr);
  const double ad = aFr ? std::abs(fr.delta) : 0;
  if (!aFr || ad < 0.03 || PI_ - ad < 0.03) return message("Angle trop proche de 0° ou 180° : non cotable.");
  for (const Cote& d : s_.cotes)
    if (d.type == "angle" && ((d.a == A.id && d.b == B.id) || (d.a == B.id && d.b == A.id))) {  // déjà là : rien de neuf, le navigateur repasse seulement la résolution
      apresEdition();
      return;
    }
  pousser();
  Cote d;
  d.id = nouvelE();
  d.type = "angle";
  d.a = A.id;
  d.b = B.id;
  d.value = fixe(ad, 4);
  d.ccw = fr.delta > 0 ? 1 : 0;
  s_.cotes.push_back(std::move(d));
  structure_ = true;
  apresEdition();
}

void Dessin::actionMenu(const std::string& code) {
  premiere();
  sync();
  if (code.rfind("c:", 0) == 0) return poserContrainte(code.substr(2));
  if (code.rfind("isect:", 0) == 0) {
    SourceIntersection src;
    src.mode = "body";
    if (code == "isect:valider") return validerIsect();
    if (code == "isect:vider") {
      isectSel_.clear();
      return;
    }
    if (code == "isect:normale") {
      isectNormale = !isectNormale;
      return message(std::string("Intersection \xE2\xA8\xAF : courbes créées en ") + (isectNormale ? "géométrie normale (profil)." : "construction."));
    }
    if (code == "isect:corps" && survolIsect_.aAt) {
      src.aPt = true;
      src.pt = survolIsect_.at;
    }
    return appliquerIsect(src);
  }
  if (code.rfind("spl:", 0) == 0) {
    const size_t k = code.find(':', 4);
    const std::string quoi = code.substr(4, k - 4), id = code.substr(k + 1);
    if (quoi == "peigne") {
      if (!peignes_.erase(id)) peignes_.insert(id);
      return;
    }
    std::string pid;
    for (const Choix& c : selection_)
      if (c.sorte == Choix::POINT && pid.empty()) pid = c.id;
    pousser();
    if (quoi == "poignee") ajouterPoignee(id, pid);
    else retirerPoignee(id, pid);
    apresEdition();
    message(quoi == "poignee" ? "Poignée posée : glissez son bout (losange violet) pour orienter la tangente et régler la tension." : "Poignée retirée : la courbe redevient libre en ce point.");
    return;
  }
  const std::vector<const Entite*> choisies = entitesChoisies();
  std::vector<Entite> ents;
  for (const Entite* e : choisies) ents.push_back(*e);
  std::vector<std::string> pts;
  for (const Choix& c : selection_)
    if (c.sorte == Choix::POINT) pts.push_back(c.id);
  std::vector<Entite> lignes, ronds;
  for (const Entite& e : ents) {
    if (e.t == "line") lignes.push_back(e);
    if (e.t == "circle" || e.t == "arc") ronds.push_back(e);
  }
  // Dans le navigateur, le cercle passe avant l'arc pour les menus à un seul rond
  std::stable_sort(ronds.begin(), ronds.end(), [](const Entite& a, const Entite& b) { return a.t == "circle" && b.t != "circle"; });
  const std::string idCote = !selection_.empty() && selection_[0].sorte == Choix::COTE ? selection_[0].id : "";
  const auto nouvelleCote = [&](const char* type, double valeur, const std::function<void(Cote&)>& f) {
    pousser();
    Cote d;
    d.id = nouvelE();
    d.type = type;
    f(d);
    d.value = fixe(valeur, 2);
    s_.cotes.push_back(std::move(d));
    structure_ = true;
    apresEdition();
  };
  const auto nouvelleCoincidence = [&](const std::string& a, const std::string& b, const char* msg) {
    pousser();
    Contrainte c = contrainte("coincident");
    c.a = a;
    c.b = b;
    lier(c);
    apresEdition();
    message(msg);
  };
  if (code == "conge") congeSelection();
  else if (code == "chanfrein") chanfreinSelection();
  else if (code == "reference") basculerReference(idCote);
  else if (code == "replacer") reinitTexteCote(idCote);
  else if (code == "supprimerCote") {
    sansTete_ = false, selection_ = {{Choix::COTE, idCote}};
    supprimer();
  } else if (code == "longueur" && !lignes.empty()) {
    const Pt* A = s_.point(lignes[0].p1);
    const Pt* B = s_.point(lignes[0].p2);
    nouvelleCote("length", A && B ? hyp(B->x - A->x, B->y - A->y) : 0, [&](Cote& d) { d.line = lignes[0].id; });
  } else if (code == "axe" && !lignes.empty()) basculerAxe(lignes[0].id);
  else if (code == "diametre" && !ronds.empty()) nouvelleCote("diameter", ronds[0].r * 2, [&](Cote& d) { d.ent = ronds[0].id; });
  else if (code == "rayon" && !ronds.empty()) nouvelleCote("radius", ronds[0].r, [&](Cote& d) { d.ent = ronds[0].id; });
  else if (code == "centreOrigine" && !ronds.empty()) nouvelleCoincidence(ronds[0].pc, "O", "Centre fixé à l’origine.");
  else if (code == "pointOrigine" && !pts.empty()) nouvelleCoincidence(pts[0], "O", "Point fixé à l’origine.");
  else if (code == "entraxe" && lignes.size() >= 2) nouvelleCote("gap", ecartLignes(s_, lignes[0], lignes[1]), [&](Cote& d) {
    d.a = lignes[0].id;
    d.b = lignes[1].id;
  });
  else if (code == "angle" && lignes.size() >= 2) coteAngleMenu(lignes[0], lignes[1]);
  else if (code == "decaler") {
    std::vector<std::string> ids;
    for (const Entite& e : ents)
      if ((e.t == "line" || e.t == "circle" || e.t == "arc") && !e.ref) ids.push_back(e.id);
    pousser();
    std::string msg;
    if (!decalerElements(ids, offsetD_, nullptr, msg)) {
      if (annulerPas) annulerPas();
      return message(msg);
    }
    structure_ = true;
    apresEdition();
    message(msg + " Cote modifiable (double-clic).");
  } else if (code == "distancePoints" && pts.size() >= 2) {
    const Pt* A = s_.point(pts[0]);
    const Pt* B = s_.point(pts[1]);
    if (A && B) nouvelleCote("distance", hyp(B->x - A->x, B->y - A->y), [&](Cote& d) {
      d.a = pts[0];
      d.b = pts[1];
    });
  } else if (code == "coincidentPoints" && pts.size() >= 2) nouvelleCoincidence(pts[0], pts[1], "Points coïncidents.");
  else if (code == "distancePointLigne" && !pts.empty() && !lignes.empty()) {
    const Pt* p = s_.point(pts[0]);
    const Pt* A = s_.point(lignes[0].p1);
    const Pt* B = s_.point(lignes[0].p2);
    if (p && A && B) nouvelleCote("distline", distSeg(p->x, p->y, *A, *B), [&](Cote& d) {
      d.line = lignes[0].id;
      d.p = pts[0];
    });
  } else if (code == "coincidentCentre" && !pts.empty() && !ronds.empty()) nouvelleCoincidence(ronds[0].pc, pts[0], "Centre et point coïncidents.");
  else if (code == "distanceLigneCentre" && !lignes.empty() && !ronds.empty()) {
    const Pt* C = s_.point(ronds[0].pc);
    const Pt* A = s_.point(lignes[0].p1);
    const Pt* B = s_.point(lignes[0].p2);
    if (C && A && B) nouvelleCote("distline", distSeg(C->x, C->y, *A, *B), [&](Cote& d) {
      d.line = lignes[0].id;
      d.p = ronds[0].pc;
    });
  } else if (code == "distanceCentres" && ronds.size() >= 2) {
    const Pt* A = s_.point(ronds[0].pc);
    const Pt* B = s_.point(ronds[1].pc);
    if (A && B) nouvelleCote("distance", hyp(B->x - A->x, B->y - A->y), [&](Cote& d) {
      d.a = ronds[0].pc;
      d.b = ronds[1].pc;
    });
  }
}

void Dessin::relacherRectangle(double wx, double wy) {
  double bx = wx, by = wy;
  const Accroche s = accroche(wx, wy);
  if (s) {
    bx = s.x;
    by = s.y;
  } else if (grille) {
    bx = surGrille(bx);
    by = surGrille(by);
  }
  double ax = bas_.x, ay = bas_.y;
  const bool centre = bas_.centre;
  const std::string cPid = bas_.pid;
  if (centre) {
    ax = 2 * ax - bx;
    ay = 2 * ay - by;
  }
  if (!(std::abs(bx - ax) > longueurMini() && std::abs(by - ay) > longueurMini())) {
    brouillon_ = Brouillon{};
    message(std::string("Rectangle") + (centre ? " (depuis le centre)" : "") + " : premier point posé, déplacez puis second clic.");
    return;
  }
  pousser();
  const std::string A = centre ? pointA(ax, ay) : cPid;
  const std::string Bp = pointA(bx, ay), Cp = pointA(bx, by), D = pointA(ax, by);
  const auto ligne = [&](const std::string& p1, const std::string& p2, bool construction = false) {
    Entite e;
    e.id = nouvelE();
    e.t = "line";
    e.p1 = p1;
    e.p2 = p2;
    e.construction = construction;
    return e;
  };
  const Entite l1 = ligne(A, Bp);
  const Entite l2 = ligne(Bp, Cp);
  const Entite l3 = ligne(Cp, D);
  const Entite l4 = ligne(D, A);
  s_.entites.insert(s_.entites.end(), {l1, l2, l3, l4});
  structure_ = true;
  for (const std::string* q : {&A, &Bp, &Cp, &D})  // les coins non cliqués ne s'attachent pas à ce qui passe à côté
    if (const Pt* pp = s_.point(*q)) accrocher(*q, pp->x, pp->y, *q == Cp || (*q == A && !centre) ? -1 : 1e-3);
  const auto hv = [&](const char* t, const Entite& l) {
    Contrainte c = contrainte(t);
    c.line = l.id;
    lier(c);
  };
  hv("h", l1);
  hv("h", l3);
  hv("v", l2);
  hv("v", l4);
  if (centre) {
    const double cx = s_.point(cPid)->x, cy = s_.point(cPid)->y;
    const double demiL = std::abs(bx - ax), demiH = std::abs(by - ay);
    const std::string pH = ajouterPoint(cx + demiL, cy), pV = ajouterPoint(cx, cy + demiH);
    const Entite axeH = ligne(cPid, pH, true);
    const Entite axeV = ligne(cPid, pV, true);
    s_.entites.insert(s_.entites.end(), {axeH, axeV});
    hv("h", axeH);
    hv("v", axeV);
    const auto sym = [&](const Entite& a, const Entite& b, const Entite& m) {
      Contrainte c = contrainte("symmetric");
      c.a = a.id;
      c.b = b.id;
      c.mid = m.id;
      c.inf = true;
      lier(c);
    };
    sym(l4, l2, axeV);
    sym(l1, l3, axeH);
    const auto sur = [&](const std::string& p, const Entite& l) {
      Contrainte c = contrainte("online");
      c.p = p;
      c.line = l.id;
      lier(c);
    };
    sur(pH, l2);
    sur(pV, l3);
  }
  const double w = std::abs(bx - ax), h = std::abs(by - ay);
  const auto cote = [&](const Entite& l, double v, double ox, double oy) {
    Cote d;
    d.id = nouvelE();
    d.type = "length";
    d.line = l.id;
    d.value = fixe(v, 4);
    d.ox = ox;
    d.oy = oy;
    s_.cotes.push_back(std::move(d));
  };
  if (w > 1e-4) cote(l1, w, 0, 6);
  if (h > 1e-4) cote(l2, h, 6, 0);
  bas_ = Bas{};
  brouillon_ = Brouillon{};
  apresEdition();
  std::string suite = messageTrace(RECTANGLE);
  suite = suite.substr(suite.find(": c") + 2);
  suite.pop_back();
  message("Rectangle créé, cotes posées — " + suite + " du suivant (Échap = fin).");
}

void Dessin::relacherCercle(double wx, double wy) {
  double bx = wx, by = wy;
  const Accroche s = accroche(wx, wy);
  if (s) {
    bx = s.x;
    by = s.y;
  } else if (grille) {
    bx = surGrille(bx);
    by = surGrille(by);
  }
  const double r = hyp(bx - bas_.x, by - bas_.y);
  if (r <= longueurMini()) {
    brouillon_ = Brouillon{};
    message("Cercle : centre posé, déplacez puis second clic pour le diamètre.");
    return;
  }
  pousser();
  const double O = fixe(2 * r, 2);  // Ø rond, sauf si le tour est posé sur un point
  Entite nc;
  nc.id = nouvelE();
  nc.t = "circle";
  nc.pc = bas_.pid;
  nc.r = s || !(O > 0) ? r : O / 2;
  s_.entites.push_back(nc);
  structure_ = true;
  if (const Pt* cp = s_.point(nc.pc)) accrocher(nc.pc, cp->x, cp->y, 1e-3);
  if (s.sorte == Accroche::PLAN) {
    const std::string q = materialiser(s.plan);
    if (!q.empty() && q != nc.pc) {
      Contrainte c = contrainte("oncircle");
      c.p = q;
      c.ent = nc.id;
      lier(c);
    }
  } else if (s.sorte == Accroche::POINT && s.id != nc.pc && !aContrainte([&](const Contrainte& c) { return c.type == "oncircle" && c.p == s.id && c.ent == nc.id; })) {
    Contrainte c = contrainte("oncircle");
    c.p = s.id;
    c.ent = nc.id;
    lier(c);
  }
  // cote Ø posée à la création, sauf si le centre et le tour sont déjà tenus par ce qu'on a cliqué
  const bool coter = !(bas_.fa && (s.sorte == Accroche::POINT || s.sorte == Accroche::PLAN)) && O > 0;
  if (coter) coteRond("diameter", nc.id, O);
  bas_ = Bas{};
  brouillon_ = Brouillon{};
  apresEdition();
  message(std::string("Cercle créé") + (coter ? ", cote posée" : "") + " — cliquez le centre du suivant (Échap = fin).");
}

void Dessin::relache(double wx, double wy) {
  if (glisseC_.actif) {
    glisseC_.actif = false;
    return;
  }
  if (boite_.actif) {
    const Boite b = boite_;
    boite_.actif = false;
    if (hyp(b.x1 - b.x0, b.y1 - b.y0) * echelle_ > 5) {
      const std::vector<Choix> pris = dansBoite(b);
      if (b.ajoute) {
        for (const Choix& c : pris)
          if (std::find(selection_.begin(), selection_.end(), c) == selection_.end()) selection_.push_back(c);
      } else {
        selection_ = pris;
        sansTete_ = true;
      }
      message(std::to_string(pris.size()) + " élément(s) sélectionné(s) : Ctrl+clic pour ajouter.");
    }
    return;
  }
  if (coupeGlisse_) {
    if (coupesGlissees_ > 1) message(std::to_string(coupesGlissees_) + " morceaux retirés en glissant. Ctrl+Z les rend tous.");
    coupeGlisse_ = false;
    return;
  }
  if (!glisseP_.empty()) {
    const std::string pid = glisseP_;
    const Accroche a = glisseAcc_;
    glisseP_.clear();
    ed_.solveur.glisserOublier();
    glissePousse_ = false;
    aMarque_ = false;
    glisseAcc_ = Accroche{};
    const bool deja = a && hyp(a.x - deX_, a.y - deY_) < 1e-6;
    if (a && glisseBouge_ && !deja) lacher(pid, a);
    return;
  }
  if (glisseE_.actif) {
    const bool bouge = glisseE_.pousse;
    glisseE_ = GlisseE{};
    ed_.solveur.glisserOublier();
    if (bouge) {
      resoudre(60);
      message("Élément déplacé.");
    }
    return;
  }
  if (outil_ == LIGNE && bas_.actif) {
    if (!dyn_.actif) relacherLigne(wx, wy);  // saisie en cours : c'est le clic suivant qui valide
  } else if (tr_.actif) trRelache(wx, wy);
  else if (outil_ == OBLONG && bas_.actif) oblongRelache(wx, wy);
  else if (outil_ == RECTANGLE && bas_.actif) relacherRectangle(wx, wy);
  else if (outil_ == POLYGONE && bas_.actif) relacherPolygone(wx, wy);
  else if (outil_ == CERCLE && bas_.actif) relacherCercle(wx, wy);
}

std::string Dessin::doubleClic(double wx, double wy) {
  premiere();
  if (outil_ == SPLINE || outil_ == CSPLINE) {
    if (splActif_ && !spl_.empty()) finirTraceSpline(false);
    return "";
  }
  if (outil_ != SELECTION) return "";
  const Entite* en = entiteProche(wx, wy, PT_);
  if (!en || (en->t != "line" && en->t != "circle" && en->t != "arc")) return "";
  const Entite e = *en;
  for (const Cote& d : s_.cotes)
    if ((d.type == "length" && d.line == e.id) || (d.ent == e.id && (d.type == "diameter" || d.type == "radius"))) return rendrePilotante(d.id) ? d.id : "";
  pousser();
  Cote d;
  d.id = nouvelE();
  if (e.t == "line") {
    const Pt* A = s_.point(e.p1);
    const Pt* B = s_.point(e.p2);
    d.type = "length";
    d.line = e.id;
    d.value = fixe(A && B ? hyp(B->x - A->x, B->y - A->y) : 0, 3);
  } else if (e.t == "circle") {
    d.type = "diameter";
    d.ent = e.id;
    d.value = fixe(e.r * 2, 3);
  } else {
    d.type = "radius";
    d.ent = e.id;
    d.value = fixe(e.r, 3);
  }
  s_.cotes.push_back(d);
  structure_ = true;
  apresEdition();
  message("Cote créée : double-clic sur la valeur pour la changer.");
  return "";
}

bool Dessin::rendrePilotante(const std::string& id) {
  premiere();
  sync();
  for (Cote& d : s_.cotes) {
    if (d.id != id) continue;
    if (!d.ref) return true;
    double v = d.value;
    if (!ed_.solveur.pilotanteSiPossible(id, v)) {
      message("Cote de référence (sur-contrainte) : elle mesure sans piloter. Retirez une contrainte ou une cote pour la rendre pilotante.");
      return false;
    }
    pousser();
    d.value = v;
    d.ref = false;
    d.refV = 0;
    structure_ = true;
    sync();
    message("Cote redevenue pilotante.");
    return true;
  }
  return false;
}

void Dessin::annulerTrace() {
  premiere();
  spl_.clear();
  splActif_ = false;
  glisseC_.actif = false;
  boite_.actif = false;
  coinPt_.clear();
  if (!dimPose_.empty()) {  // Échap pendant la pose annule la cote
    s_.cotes.erase(std::remove_if(s_.cotes.begin(), s_.cotes.end(), [&](const Cote& d) { return d.id == dimPose_; }), s_.cotes.end());
    dimPose_.clear();
    structure_ = true;
  }
  dimPoint_.clear();
  dimLigne_.clear();
  coteAOuvrir_.clear();
  coinA_.clear();
  passeCoin_.clear();
  dyn_ = Saisie{};
  offArme_ = false;
  coupeGlisse_ = false;
  apercu_ = ApercuCoupe{};
  chaine_.clear();
  arcC_.clear();
  arcA1Pose_ = false;
  arcPa_.clear();
  brouillon_ = Brouillon{};
  bas_ = Bas{};
  tr_ = Trace{};
  slot_ = SlotEnCours{};
  glisseP_.clear();
  glisseE_ = GlisseE{};
  ed_.solveur.glisserOublier();
  guide_ = Guide{};
  aMarque_ = false;
  nettoyer();
}

void Dessin::choisirOutil(Outil o) {
  annulerTrace();
  survolProj_ = Projetable{};
  survolIsect_ = SurvolIsect{};
  isectSel_.clear();
  outil_ = o;
  if (titreModes(o)) message(messageTrace(o));
}

void Dessin::echap() {
  finirSpline();  // Échap finit le tracé avant de revenir à la sélection
  annulerTrace();
  outil_ = SELECTION;
  message("Sélection.");
}

void Dessin::choisirCote(const std::string& id) { sansTete_ = false, selection_ = {{Choix::COTE, id}}; }
void Dessin::choisirLigneCote(const std::string& id) {
  if (selection_.empty() || sansTete_) selection_.insert(selection_.begin(), {Choix::COTE, id});
  else selection_[0] = {Choix::COTE, id};
  sansTete_ = false;
}
void Dessin::choisirContrainte(const std::string& id) {
  if (selection_.empty() || sansTete_) selection_.insert(selection_.begin(), {Choix::CONTRAINTE, id});
  else selection_[0] = {Choix::CONTRAINTE, id};
  sansTete_ = false;
}

namespace {
// skIsProjFix : le « fixe » d'une projection ne se retire pas, elle suit son arête source
bool fixeDeProjection(const Esquisse& s, const Contrainte& c) {
  if (c.type != "fix") return false;
  for (const Entite& e : s.entites) {
    if (!e.proj) continue;
    if (c.ent == e.id) return true;
    if (!c.p.empty())
      for (const std::string* q : {&e.p1, &e.p2, &e.pc, &e.pa, &e.pb, &e.p})
        if (*q == c.p) return true;
  }
  return false;
}
}  // namespace

void Dessin::retirerContrainte(const std::string& id) {
  premiere();
  const auto it = std::find_if(s_.contraintes.begin(), s_.contraintes.end(), [&](const Contrainte& c) { return c.id == id; });
  if (it == s_.contraintes.end()) return;
  if (fixeDeProjection(s_, *it)) return message("Fixe d'une projection : elle suit son arête source. Supprimez la projection pour la libérer.");
  pousser();
  s_.contraintes.erase(it);
  selection_.erase(std::remove_if(selection_.begin(), selection_.end(), [&](const Choix& c) { return c.id == id; }), selection_.end());
  structure_ = true;
  resoudre();
}

void Dessin::retirerCote(const std::string& id) {
  premiere();
  const auto it = std::find_if(s_.cotes.begin(), s_.cotes.end(), [&](const Cote& d) { return d.id == id; });
  if (it == s_.cotes.end()) return;
  pousser();
  s_.cotes.erase(it);
  selection_.erase(std::remove_if(selection_.begin(), selection_.end(), [&](const Choix& c) { return c.id == id; }), selection_.end());
  structure_ = true;  // sans résoudre, comme le navigateur : le dessin reste où il est
  sync();
}

bool Dessin::basculerReference(const std::string& id) {
  premiere();
  sync();
  Cote* d = cote(id);
  if (!d) return false;
  if (d->ref) {
    double v = d->value;
    if (!ed_.solveur.pilotanteSiPossible(id, v)) {
      message("Cote de référence (sur-contrainte) : elle mesure sans piloter. Retirez une contrainte ou une cote pour la rendre pilotante.");
      return false;
    }
    pousser();
    d->value = v;
    d->ref = false;
    d->refV = 0;
    structure_ = true;
    apresEdition();
    message("Cote pilotante : double-clic pour changer la valeur.");
    return true;
  }
  pousser();
  d->ref = true;
  d->refV = 1;  // choix de l'utilisateur, gardé (2 = sur-contrainte, réévaluée)
  d->formule = false;
  d->formuleFausse = false;
  d->expr.clear();
  d->exprErr.clear();
  structure_ = true;
  apresEdition();
  message("Cote de référence : elle mesure sans piloter.");
  return true;
}

void Dessin::reglerPoint(const std::string& id, double x, double y) {
  premiere();
  if (!s_.point(id)) return;
  pousserAvant();
  Pt& p = s_.points[id];
  p.x = x;
  p.y = y;
  structure_ = true;
  resoudreOuRefuser("Valeur");
}

void Dessin::reglerRayon(const std::string& id, double r) {
  premiere();
  Entite* e = entite(id);
  if (!e) return;
  pousserAvant();
  e->r = std::max(r, 0.1);
  structure_ = true;
  resoudreOuRefuser("Valeur");
}

void Dessin::reglerAngleArc(const std::string& id, bool fin, double degres) {
  premiere();
  const Entite* e = entite(id);
  const Pt* C = e ? s_.point(e->pc) : nullptr;
  if (!C || !s_.point(fin ? e->pb : e->pa)) return;
  pousserAvant();
  const double a = degres * 3.141592653589793 / 180;
  Pt& q = s_.points[fin ? e->pb : e->pa];
  q.x = C->x + e->r * m_cos(a);
  q.y = C->y + e->r * m_sin(a);
  structure_ = true;
  resoudreOuRefuser("Valeur");
}

void Dessin::refermerEcart() {
  premiere();
  const SanteEsquisse H = santeDe(s_);
  if (!H.aEcart) return message("Rien à refermer.");
  // pidNear, dans l'ordre des points
  const auto proche = [&](const Pt& q) {
    std::string m;
    double bd = 50;
    for (const std::string& k : s_.ordre) {
      const Pt* p = s_.point(k);
      const double d = p ? hyp(p->x - q.x, p->y - q.y) : 1e18;
      if (d < bd) {
        bd = d;
        m = k;
      }
    }
    return m;
  };
  const std::string pa = proche(H.ecartA), pb = proche(H.ecartB);
  if (pa.empty() || pb.empty() || pa == pb) return message("Refermer : points introuvables.");
  pousser();
  fusionner(pb, pa);
  structure_ = true;
  apresEdition();
  message("Bouts refermés.");
}

void Dessin::fusionnerDoublons() {
  premiere();
  const SanteEsquisse H = santeDe(s_);
  if (H.doublons.empty()) return;
  pousser();
  for (const auto& [a, b] : H.doublons)
    if (s_.point(a) && s_.point(b)) fusionner(b, a);
  structure_ = true;
  apresEdition();
}

void Dessin::supprimerDegeneres() {
  premiere();
  const SanteEsquisse H = santeDe(s_);
  if (H.degeneres.empty()) return;
  pousser();
  const std::set<std::string> morts(H.degeneres.begin(), H.degeneres.end());
  s_.entites.erase(std::remove_if(s_.entites.begin(), s_.entites.end(), [&](const Entite& e) { return morts.count(e.id) > 0; }), s_.entites.end());
  selection_.erase(std::remove_if(selection_.begin(), selection_.end(), [&](const Choix& c) { return morts.count(c.id) > 0; }), selection_.end());
  structure_ = true;
  apresEdition();
}

// ---------- Outil Cote ----------
Cote* Dessin::cote(const std::string& id) {
  for (Cote& d : s_.cotes)
    if (d.id == id) return &d;
  return nullptr;
}

std::string Dessin::prendreCoteAOuvrir() {
  std::string id;
  id.swap(coteAOuvrir_);
  return id;
}

bool Dessin::lignesParalleles(const Entite& A, const Entite& B) const {
  const auto paireDe = [&](const char* t) {
    return aContrainte([&](const Contrainte& c) { return c.type == t && ((c.a == A.id && c.b == B.id) || (c.a == B.id && c.b == A.id)); });
  };
  if (paireDe("parallel") || paireDe("collinear")) return true;
  if ((aHV(A.id, "h") && aHV(B.id, "h")) || (aHV(A.id, "v") && aHV(B.id, "v"))) return true;
  double va;
  return angleDroites(s_, A, B, va) && va < 0.5 * PI_ / 180;
}

void Dessin::orienterCote(Cote& d, double wx, double wy) {
  const Pt* A;
  const Pt* B;
  if (d.type == "length") {
    const Entite* l = s_.entite(d.line);
    if (!l) return;
    A = s_.point(l->p1);
    B = s_.point(l->p2);
  } else {
    A = s_.point(d.a);
    B = s_.point(d.b);
  }
  if (!A || !B) return;
  const double mx = (A->x + B->x) / 2, my = (A->y + B->y) / 2, dx = B->x - A->x, dy = B->y - A->y, rdx = wx - mx, rdy = wy - my;
  std::string o = d.orient.empty() ? "a" : d.orient;
  if (hyp(rdx, rdy) > 1e-6) {
    const double beta = m_atan2(dy, dx), phi = m_atan2(rdy, rdx);
    const auto w180 = [](double a) {
      a = std::fmod(a * 180 / PI_, 180.0);
      if (a < 0) a += 180;
      return std::min(a, 180 - a);
    };
    struct Candidat {
      const char* o;
      double d;
      bool ok;
    };
    std::vector<Candidat> c{{"h", w180(phi - PI_ / 2), std::abs(dx) > 1e-6}, {"v", w180(phi), std::abs(dy) > 1e-6}, {"a", w180(phi - (beta + PI_ / 2)), true}};
    const Candidat dernier = c[2];
    std::stable_sort(c.begin(), c.end(), [](const Candidat& x, const Candidat& y) { return x.d < y.d; });
    const auto t = std::find_if(c.begin(), c.end(), [](const Candidat& x) { return x.ok; });
    o = t != c.end() ? t->o : dernier.o;
  }
  d.orient = o;
  d.aW = true;
  const double L0 = hyp(dx, dy), L = L0 != 0 ? L0 : 1e-9;
  if (o == "h") {
    d.w = wy - my;
    d.value = fixe(std::abs(dx), 2);
  } else if (o == "v") {
    d.w = wx - mx;
    d.value = fixe(std::abs(dy), 2);
  } else {
    d.w = rdx * (-dy / L) + rdy * (dx / L);
    d.value = fixe(hyp(dx, dy), 2);
  }
}

void Dessin::angleCote(Cote& d, double wx, double wy) {
  Pt V;
  if (!sommetAngle(s_, d.a, d.b, V)) return;
  d.w = std::max(1.0, hyp(wx - V.x, wy - V.y));
  d.aW = true;
  if (d.oa.empty()) {
    d.oa = d.a;
    d.ob = d.b;
  }
  const double T = PI_ * 2;
  SecteurAngle fr;
  if (!secteurAngle(s_, d.oa, d.ob, fr)) return;
  const double v = std::abs(fr.delta), mu = m_atan2(wy - V.y, wx - V.x);
  const auto dans = [&](double debut, double balayage) {
    double r = std::fmod(mu - debut, T);
    if (r < 0) r += T;
    return balayage >= 0 ? r <= balayage + 1e-9 : r >= T + balayage - 1e-9;
  };
  const double comp = PI_ - std::max(0.02, std::min(PI_ - 0.02, v));
  if (dans(fr.sA, fr.delta)) {
    d.a = d.oa;
    d.b = d.ob;
    d.comp = false;
    d.ccw = fr.delta > 0 ? 1 : 0;
    d.value = v;
  } else if (dans(fr.sA, fr.delta > 0 ? -comp : comp)) {
    d.a = d.oa;
    d.b = d.ob;
    d.comp = true;
    d.ccw = fr.delta > 0 ? 0 : 1;
    d.value = comp;
  } else if (dans(fr.sB, fr.delta > 0 ? comp : -comp)) {
    const std::string oa = d.ob, ob = d.oa;
    d.a = oa;
    d.b = ob;
    d.comp = true;
    d.ccw = fr.delta > 0 ? 1 : 0;
    d.value = comp;
  }
}

void Dessin::suivreCote(Cote& d, double wx, double wy) {
  if (d.type == "length" || d.type == "distance") {
    const std::string o0 = d.orient;
    orienterCote(d, wx, wy);
    structure_ = true;
    if (d.orient != o0) controlerCotes();
    return;
  }
  if (d.type == "distline") {
    const Entite* l = s_.entite(d.line);
    const Pt* Q = s_.point(d.p);
    if (!l || l->t != "line" || !Q) return;
    const Pt* A = s_.point(l->p1);
    const Pt* B = s_.point(l->p2);
    if (!A || !B) return;
    const double dx = B->x - A->x, dy = B->y - A->y, L20 = dx * dx + dy * dy, L2 = L20 != 0 ? L20 : 1e-9, t = ((Q->x - A->x) * dx + (Q->y - A->y) * dy) / L2;
    const double Fx = A->x + dx * t, Fy = A->y + dy * t, sx = Fx - Q->x, sy = Fy - Q->y, L0 = hyp(sx, sy), L = L0 != 0 ? L0 : 1e-9;
    double nx, ny;
    if (L > 1e-9) {
      nx = -sy / L;
      ny = sx / L;
    } else {
      const double Ln0 = hyp(dx, dy), Ln = Ln0 != 0 ? Ln0 : 1e-9;
      nx = dx / Ln;
      ny = dy / Ln;
    }
    d.w = (wx - Q->x) * nx + (wy - Q->y) * ny;
    d.aW = true;
  } else if (d.type == "gap") {
    const Entite* A = s_.entite(d.a);
    const Entite* B = s_.entite(d.b);
    if (!A || !B) return;
    const Pt* A1 = s_.point(A->p1);
    const Pt* A2 = s_.point(A->p2);
    if (!A1 || !A2 || !s_.point(B->p1) || !s_.point(B->p2)) return;
    const double dx = A2->x - A1->x, dy = A2->y - A1->y, L0 = hyp(dx, dy), L = L0 != 0 ? L0 : 1e-9, ux = dx / L, uy = dy / L;
    d.sl = (wx - (A1->x + A2->x) / 2) * ux + (wy - (A1->y + A2->y) / 2) * uy;
  } else if (d.type == "angle") {
    angleCote(d, wx, wy);
  } else if (d.type == "diameter" || d.type == "radius") {
    const Entite* e = s_.entite(d.ent);
    if (!e || !(e->r > 0)) return;
    const Pt* C = s_.point(e->pc);
    if (!C) return;
    double ux = 0.7071067811865476, uy = 0.7071067811865476;
    if (e->t == "arc") {
      An an;
      const double am = anglesArc2(s_, *e, an) ? (an.a1 + an.a2) / 2 : PI_ / 4;
      ux = m_cos(am);
      uy = m_sin(am);
    }
    d.ox = wx - (C->x + ux * e->r);
    d.oy = wy - (C->y + uy * e->r);
    if (d.ox == 0 && d.oy == 0) d.ox = 1e-6;
  }
  structure_ = true;
}

bool Dessin::versDistanceLigne(const std::string& id, const std::string& pt, const std::string& ligne) {
  const Pt* Q = s_.point(pt);
  const Entite* l = s_.entite(ligne);
  if (!Q || !l || l->t != "line") return false;
  const Pt* A = s_.point(l->p1);
  const Pt* B = s_.point(l->p2);
  if (!A || !B) return false;
  const double dx = B->x - A->x, dy = B->y - A->y, L0 = hyp(dx, dy), L = L0 != 0 ? L0 : 1e-9;
  const double v = std::abs((Q->x - A->x) * (-dy / L) + (Q->y - A->y) * (dx / L));
  pousser();
  Cote* d = cote(id);
  d->type = "distline";
  d->p = pt;
  d->line = ligne;
  d->ent.clear();
  d->aW = false;
  d->w = 0;
  d->sl = 0;
  d->value = fixe(std::max(v, 0.01), 2);
  structure_ = true;
  apresEdition();
  message("Converti en distance du point à la ligne : cliquez dans le vide pour poser.");
  return true;
}

void Dessin::versDistanceCentres(const std::string& id, const std::string& a, const std::string& b, const char* quoi) {
  const Pt* A = s_.point(a);
  const Pt* B = s_.point(b);
  const double v = hyp(B->x - A->x, B->y - A->y);
  pousser();
  Cote* d = cote(id);
  d->type = "distance";
  d->a = a;
  d->b = b;
  d->ent.clear();
  d->aW = false;
  d->w = 0;
  d->sl = 0;
  d->value = fixe(v, 2);
  structure_ = true;
  apresEdition();
  message(quoi);
}

bool Dessin::etendreCote(const std::string& id, const Entite* ent, const std::string& pid) {
  Cote* dd = cote(id);
  if (!dd) return false;
  if (dd->type == "length") {
    const Entite* src = s_.entite(dd->line);
    if (!src) return false;
    const std::string ligne = dd->line;
    if (!pid.empty() && pid != src->p1 && pid != src->p2) return versDistanceLigne(id, pid, ligne);
    if (ent && ent->t == "line" && ent->id != ligne) {
      const Entite E = *ent, F = *src;
      pousser();
      dd = cote(id);
      double va;
      if (angleDroites(s_, F, E, va) && lignesParalleles(F, E)) {
        dd->type = "gap";
        dd->a = F.id;
        dd->b = E.id;
        dd->line.clear();
        dd->aW = false;
        dd->w = 0;
        dd->value = fixe(ecartLignes(s_, F, E), 2);
        structure_ = true;
        apresEdition();
        message("Converti en entraxe : cliquez dans le vide pour poser.");
      } else {
        SecteurAngle fr;
        const bool aFr = secteurAngle(s_, F.id, E.id, fr);
        const bool sommet = F.p1 == E.p1 || F.p1 == E.p2 || F.p2 == E.p1 || F.p2 == E.p2;
        dd->type = "angle";
        dd->a = F.id;
        dd->b = E.id;
        dd->line.clear();
        dd->aW = false;
        dd->w = 0;
        dd->value = fixe(aFr ? std::abs(fr.delta) : 0, 4);
        dd->ccw = sommet && aFr && fr.delta > 0 ? 1 : 0;
        structure_ = true;
        apresEdition();
        message("Converti en angle : déplacez pour choisir le secteur, puis cliquez.");
      }
      return true;
    }
    if (ent && (ent->t == "circle" || ent->t == "arc") && !ent->pc.empty()) return versDistanceLigne(id, ent->pc, ligne);
    if (!pid.empty() && !(ent && ent->id == ligne)) return versDistanceLigne(id, pid, ligne);
    return false;
  }
  if (dd->type == "diameter" || dd->type == "radius") {
    const Entite* src = s_.entite(dd->ent);
    if (!src || src->pc.empty()) return false;
    const std::string pc = src->pc, pa = src->pa, pb = src->pb, idSrc = src->id;
    const bool entRond = ent && (ent->t == "circle" || ent->t == "arc");
    if (!pid.empty() && pid != pc && pid != pa && pid != pb && !(entRond && ent->pc == pid) && s_.point(pc) && s_.point(pid)) {
      versDistanceCentres(id, pc, pid, "Converti en distance du centre au point : cliquez dans le vide pour poser.");
      return true;
    }
    if (entRond && ent->id != idSrc && !ent->pc.empty()) {
      if (!s_.point(pc) || !s_.point(ent->pc)) return false;
      versDistanceCentres(id, pc, ent->pc, "Converti en entraxe des centres : cliquez dans le vide pour poser.");
      return true;
    }
    if (ent && ent->t == "line") return versDistanceLigne(id, pc, ent->id);
    if (!pid.empty() && !(ent && (ent->id == idSrc || ent->pc == pc)) && s_.point(pc) && s_.point(pid)) {
      versDistanceCentres(id, pc, pid, "Converti en distance du centre au point : cliquez dans le vide pour poser.");
      return true;
    }
    return false;
  }
  return false;
}

std::string Dessin::poserCote(const std::string id) {  // par valeur : on reçoit parfois dimPose_, vidé juste après
  dimPose_.clear();
  const Cote* dd = cote(id);
  if (!dd) return "";
  const std::string o = dd->orient.empty() ? "a" : dd->orient;
  std::string dup;
  for (const Cote& x : s_.cotes) {
    if (x.id == id || (x.orient.empty() ? "a" : x.orient) != o || x.type != dd->type) continue;
    const auto meme = [&](const std::string& a, const std::string& b) { return (x.a == a && x.b == b) || (x.a == b && x.b == a); };
    const std::string& t = dd->type;
    const bool egal = t == "length" ? x.line == dd->line : (t == "diameter" || t == "radius") ? x.ent == dd->ent : t == "distline" ? (x.line == dd->line && x.p == dd->p) : (t == "distance" || t == "gap" || t == "angle") ? meme(dd->a, dd->b) : false;
    if (egal) {
      dup = x.id;
      break;
    }
  }
  if (dup.empty()) return id;
  s_.cotes.erase(std::remove_if(s_.cotes.begin(), s_.cotes.end(), [&](const Cote& x) { return x.id == id; }), s_.cotes.end());
  structure_ = true;
  apresEdition();
  sansTete_ = false, selection_ = {{Choix::COTE, dup}};
  message("Cote déjà existante : sélectionnée, pas de doublon.");
  return "";
}

std::string Dessin::poserCoteIci() {
  premiere();
  sync();
  if (dimPose_.empty()) return "";
  const std::string id = poserCote(dimPose_);
  if (id.empty()) return "";
  message("Cote posée.");
  return rendrePilotante(id) ? id : "";
}

void Dessin::enfonceCote(double wx, double wy, bool ctrl) {
  if (!dimPose_.empty()) {
    const std::string id = dimPose_;
    const Entite* ent = entiteProche(wx, wy, PICK_);
    const std::string pid = pointProche(wx, wy, PT_);
    if (cote(id) && etendreCote(id, ent, pid)) return;
    coteAOuvrir_ = poserCoteIci();
    return;
  }
  clicCote(wx, wy, ctrl);
}

void Dessin::clicCote(double x, double y, bool ctrl) {
  const Entite* ent0 = entiteProche(x, y, PICK_);
  if (ctrl && ent0) {
    const Entite B = *ent0;
    if (!dimLigne_.empty() && dimLigne_ != B.id) {
      if (const Entite* pa = s_.entite(dimLigne_)) {
        const Entite A = *pa;
        double va;
        Cote d;
        if (angleDroites(s_, A, B, va) && lignesParalleles(A, B)) {
          for (const Cote& x2 : s_.cotes)
            if (x2.type == "gap" && ((x2.a == A.id && x2.b == B.id) || (x2.a == B.id && x2.b == A.id))) {
              dimLigne_.clear();
              sansTete_ = false, selection_ = {{Choix::COTE, x2.id}};
              message("Cote déjà existante : sélectionnée, pas de doublon.");
              return;
            }
          pousser();
          d.id = nouvelE();
          d.type = "gap";
          d.a = A.id;
          d.b = B.id;
          d.value = fixe(ecartLignes(s_, A, B), 2);
          message("Cote d'entraxe créée : déplacez puis cliquez pour poser.");
        } else {
          SecteurAngle fr;
          const bool aFr = secteurAngle(s_, A.id, B.id, fr);
          for (const Cote& x2 : s_.cotes)
            if (x2.type == "angle" && ((x2.a == A.id && x2.b == B.id) || (x2.a == B.id && x2.b == A.id))) {
              dimLigne_.clear();
              sansTete_ = false, selection_ = {{Choix::COTE, x2.id}};
              message("Cote déjà existante : sélectionnée, pas de doublon.");
              return;
            }
          pousser();
          d.id = nouvelE();
          d.type = "angle";
          d.a = A.id;
          d.b = B.id;
          d.value = fixe(aFr ? std::abs(fr.delta) : 0, 4);
          d.ccw = aFr && fr.delta > 0 ? 1 : 0;
          message("Cote d'angle créée : déplacez pour choisir le secteur, puis cliquez pour poser.");
        }
        dimLigne_.clear();
        dimPose_ = d.id;
        s_.cotes.push_back(d);
        structure_ = true;
        apresEdition();
        return;
      }
    }
    dimLigne_ = B.id;
    message("Cote entre deux lignes : Ctrl+clic sur la 2e ligne (angle si elles se coupent, entraxe si elles sont parallèles).");
    return;
  }
  if (!dimPoint_.empty()) {
    const std::string pid = pointProche(x, y, SNAP_);
    const Entite* ent = entiteProche(x, y, PICK_);
    const std::string autre = !pid.empty() ? pid : (ent && ent->t == "cpoint" ? ent->p : "");
    if (!autre.empty() && autre != dimPoint_) {
      const Pt* A = s_.point(dimPoint_);
      const Pt* B = s_.point(autre);
      if (A && B) {
        const double v = hyp(B->x - A->x, B->y - A->y);
        pousser();
        Cote d;
        d.id = nouvelE();
        d.type = "distance";
        d.a = dimPoint_;
        d.b = autre;
        d.value = fixe(v, 2);
        s_.cotes.push_back(d);
        structure_ = true;
        dimPose_ = d.id;
        message("Cote de distance : déplacez puis cliquez pour poser.");
      }
    }
    dimPoint_.clear();
    apresEdition();
    return;
  }
  const Entite* ent = entiteProche(x, y, PICK_);
  const std::string premier = pointProche(x, y, PT_);
  if (!premier.empty()) {
    dimPoint_ = premier;
    message("Cote de distance : cliquez un second point.");
    return;
  }
  if (ent && (ent->t == "line" || ent->t == "circle" || ent->t == "arc")) {
    const Entite e = *ent;
    Cote d;
    if (e.t == "line") {
      dimLigne_.clear();
      const Pt* A = s_.point(e.p1);
      const Pt* B = s_.point(e.p2);
      d.type = "length";
      d.line = e.id;
      d.value = fixe(A && B ? hyp(B->x - A->x, B->y - A->y) : 0, 2);
    } else if (e.t == "circle") {
      d.type = "diameter";
      d.ent = e.id;
      d.value = fixe(e.r * 2, 2);
    } else {
      d.type = "radius";
      d.ent = e.id;
      d.value = fixe(e.r, 2);
    }
    pousser();
    d.id = nouvelE();
    s_.cotes.push_back(d);
    structure_ = true;
    dimPose_ = d.id;
    message(e.t == "line" ? "Cote de longueur : déplacez puis cliquez pour poser." : "Cote : cliquez un 2e cercle (entraxe) ou une ligne (distance au centre), ou posez dans le vide.");
    apresEdition();
    return;
  }
  const std::string pid = pointProche(x, y, SNAP_);
  const std::string p0 = !pid.empty() ? pid : (ent && ent->t == "cpoint" ? ent->p : "");
  if (!p0.empty()) {
    dimPoint_ = p0;
    message("Cote de distance : cliquez un second point.");
    return;
  }
  message("Cote : ligne = longueur, cercle = diamètre, arc = rayon, 2 points = distance. Ctrl+clic sur 2 lignes = angle ou entraxe.");
}

// ---------- Longueur ou angle tapés pendant le tracé ----------
bool Dessin::caractere(char c) {
  const bool chiffre = c >= '0' && c <= '9';
  if (outil_ == DECALER && offArme_ && !dyn_.actif && (chiffre || c == '.' || c == ',')) {
    dyn_ = Saisie{true, false, ""};
    message("Décalage : distance tapée. La souris donne le côté, Entrée ou clic pour valider, Échap annule.");
  }
  if (dyn_.actif) {
    if (chiffre) {
      dyn_.texte += c;
      return true;
    }
    if (c == '.' || c == ',') {
      if (dyn_.texte.find('.') == std::string::npos) dyn_.texte += '.';
      return true;
    }
    return false;
  }
  if (outil_ == LIGNE && bas_.actif && chiffre) {
    dyn_ = Saisie{true, false, std::string(1, c)};
    return true;
  }
  return false;
}

bool Dessin::tabulation() {
  if (outil_ == DECALER) return false;  // une distance seulement, pas d'angle
  if (dyn_.actif) {
    dyn_ = Saisie{true, !dyn_.angle, ""};
    return true;
  }
  if (outil_ == LIGNE && bas_.actif) {
    dyn_ = Saisie{true, false, ""};
    return true;
  }
  return false;
}

bool Dessin::retourArriere() {
  if (!dyn_.actif) return false;
  if (!dyn_.texte.empty()) dyn_.texte.pop_back();
  return true;
}

bool Dessin::entree() {
  if (finirSpline()) return true;
  if (outil_ == INTERSECTION) {
    validerIsect();
    return true;
  }
  if (outil_ == POLYGONE) {
    entreePolygone();
    return true;
  }
  if (!dyn_.actif) return false;
  validerSaisie();
  return true;
}

void Dessin::validerSaisie() {
  if (outil_ == DECALER && offArme_) return validerDistance();
  if (!dyn_.actif || !bas_.actif) return;
  premiere();
  sync();
  double val = 0;
  const char* debut = dyn_.texte.data();
  const char* fin = debut + dyn_.texte.size();
  const auto lu = std::from_chars(debut, fin, val);
  if (lu.ec != std::errc() || !(val > 0)) {
    message("Valeur invalide.");
    dyn_ = Saisie{};
    return;
  }
  const bool aB = brouillon_.sorte == Brouillon::B_LIGNE;
  const Brouillon D = brouillon_;
  const double ang = dyn_.angle ? val * PI_ / 180 : (aB ? m_atan2(D.y2 - D.y1, D.x2 - D.x1) : 0);
  double L = val;
  if (dyn_.angle) {
    L = aB ? hyp(D.x2 - D.x1, D.y2 - D.y1) : 0;
    if (L < 4 / echelle_) {
      message("Déplacez le curseur pour définir la longueur, puis tapez l'angle.");
      return;
    }
  }
  const double ex = bas_.x + L * m_cos(ang), ey = bas_.y + L * m_sin(ang);
  const std::string nl = validerLigne(bas_.pid, Accroche{}, ex, ey);
  if (!nl.empty()) {
    Cote d;
    d.id = nouvelE();
    d.type = "length";
    d.line = nl;
    d.value = fixe(L, 3);
    s_.cotes.push_back(d);
    structure_ = true;
  }
  dyn_ = Saisie{};
  bas_ = Bas{};
  brouillon_ = Brouillon{};
  guide_ = Guide{};
  aMarque_ = false;
  if (!nl.empty()) {
    resoudre();
    nettoyer();
    char t[80];
    snprintf(t, sizeof t, "Ligne de %.2f mm créée.", L);
    message(t);
  }
}

void Dessin::pousserAvant() {
  pousser();
  avant_ = s_;
}

bool Dessin::resoudreOuRefuser(const std::string& quoi) {
  resoudre();
  std::string pourquoi;
  for (const Entite& e : s_.entites) {
    if (e.t != "line") continue;
    const Pt* A = s_.point(e.p1);
    const Pt* B = s_.point(e.p2);
    const Pt* A0 = avant_.point(e.p1);
    const Pt* B0 = avant_.point(e.p2);
    if (A && B && A0 && B0 && hyp(B->x - A->x, B->y - A->y) < 1e-4 && hyp(B0->x - A0->x, B0->y - A0->y) > 1e-3) {
      pourquoi = "la ligne " + e.id + " serait réduite à un point : contraintes en conflit";
      break;
    }
  }
  if (pourquoi.empty()) {
    if (ed_.solveur.residu() <= SK_OK) return true;
    // Une esquisse déjà en défaut n'est pas bloquée. Mesurée comme le navigateur : sur une copie, sans mémoire
    Solveur copie(avant_, ed_.solveur);
    copie.restaurer(copie.instantane());
    if (copie.residu() > SK_OK) return true;
    pourquoi = ed_.solveur.pireEcart();
  }
  // skRevertTo : les coordonnées exactement celles d'avant, sans nouvelle résolution. Le compteur d'identifiants, lui, ne revient pas.
  if (annulerPas) annulerPas();
  s_.ordre = avant_.ordre;
  s_.points = avant_.points;
  s_.entites = avant_.entites;
  s_.contraintes = avant_.contraintes;
  s_.cotes = avant_.cotes;
  structure_ = true;
  sync();
  ed_.solveur.apresRefus();
  message(quoi + " impossible (" + pourquoi + ") : esquisse laissée telle quelle.");
  return false;
}

std::vector<std::string> Dessin::pointsChoisis() const {
  std::vector<std::string> v;
  for (const Choix& c : selection_)
    if (c.sorte == Choix::POINT && std::find(v.begin(), v.end(), c.id) == v.end()) v.push_back(c.id);
  return v;
}

std::vector<const Entite*> Dessin::entitesChoisies() const {
  std::vector<const Entite*> v;
  for (const Choix& c : selection_)
    if (c.sorte == Choix::ENTITE)
      if (const Entite* e = s_.entite(c.id))
        if (std::find(v.begin(), v.end(), e) == v.end()) v.push_back(e);
  return v;
}

bool Dessin::fusionner(std::string de, std::string vers) {
  if (de.empty() || vers.empty() || de == vers) return false;
  sync();
  if (de == "O") {
    std::swap(de, vers);  // jamais l'origine
  } else if (vers != "O" && ed_.solveur.pointFixe(de) && !ed_.solveur.pointFixe(vers)) {
    std::swap(de, vers);  // le point fixe reste, c'est l'autre qui le rejoint
  }
  if (vers == "O") {  // translation de tout le reste du dessin
    const Pt* P = s_.point(de);
    const Pt* O = s_.point("O");
    if (P && O && (P->x != O->x || P->y != O->y)) {
      const double dx = O->x - P->x, dy = O->y - P->y;
      for (const std::string& k : s_.ordre)
        if (k != de && k != "O") {
          Pt& q = s_.points[k];
          q.x += dx;
          q.y += dy;
        }
    }
  }
  const auto suit = [&](std::string& x) {
    if (x == de) x = vers;
  };
  for (Entite& e : s_.entites) {
    suit(e.p1);
    suit(e.p2);
    suit(e.p);
    suit(e.pc);
    suit(e.pa);
    suit(e.pb);
    if (!e.pts.empty()) {  // spline : le doublon voisin part
      std::vector<std::string> v;
      for (std::string q : e.pts) {
        suit(q);
        if (v.empty() || q != v.back()) v.push_back(q);
      }
      e.pts = std::move(v);
    }
  }
  for (Cote& d : s_.cotes) {
    suit(d.a);
    suit(d.b);
    suit(d.p);
  }
  for (Contrainte& c : s_.contraintes) {
    suit(c.p);
    if (c.type == "coincident") {
      suit(c.a);
      suit(c.b);
    }
  }
  s_.points.erase(de);
  s_.ordre.erase(std::remove(s_.ordre.begin(), s_.ordre.end(), de), s_.ordre.end());
  structure_ = true;
  return true;
}

void Dessin::basculerConstruction() {
  std::vector<std::string> ids;
  bool une = false;
  for (const Entite* e : entitesChoisies())
    if ((e->t == "line" && !e->poignee) || e->t == "circle" || e->t == "arc" || e->t == "spline") {
      ids.push_back(e->id);
      une = une || e->construction;
    }
  if (ids.empty()) return message("Sélectionnez une ligne, un cercle, un arc ou une spline, puis basculez en construction (X).");
  pousser();
  for (const std::string& id : ids) entite(id)->construction = !une;
  structure_ = true;
  apresEdition();
  message(!une ? "Géométrie de construction : trait discontinu, hors profil." : "Géométrie normale : participe au profil.");
}

void Dessin::poserContrainte(const std::string& type) {
  premiere();
  sync();
  if (type == "construction") return basculerConstruction();
  const std::vector<const Entite*> ents = entitesChoisies();
  std::vector<const Entite*> lignes;
  for (const Entite* e : ents)
    if (e->t == "line") lignes.push_back(e);
  const auto rond = [](const Entite* e) { return e->t == "circle" || e->t == "arc"; };
  const auto paire = [&](const char* t, const std::string& a, const std::string& b) {
    return aContrainte([&](const Contrainte& c) { return c.type == t && ((c.a == a && c.b == b) || (c.a == b && c.b == a)); });
  };
  const auto deux = [&](const char* t, const std::string& a, const std::string& b) {
    Contrainte c;
    c.type = t;
    c.a = a;
    c.b = b;
    return c;
  };
  const std::vector<std::string> pts = pointsChoisis();
  if (type == "coincident") {
    std::vector<const Entite*> ronds;
    for (const Entite* e : ents)
      if (rond(e)) ronds.push_back(e);
    if (pts.size() == 2 && ents.empty()) {
      if (paire("coincident", pts[0], pts[1])) return message("Coïncidence déjà posée.");
      pousserAvant();
      lier(deux("coincident", pts[0], pts[1]));
    } else if (pts.size() == 1 && lignes.size() == 1 && ents.size() == 1) {
      const std::string l = lignes[0]->id;
      if (lignes[0]->p1 == pts[0] || lignes[0]->p2 == pts[0]) return message("Ce point est déjà une extrémité de la ligne.");
      if (aContrainte([&](const Contrainte& c) { return c.type == "online" && c.p == pts[0] && c.line == l; })) return message("Point déjà sur cette ligne.");
      pousserAvant();
      Contrainte c;
      c.type = "online";
      c.p = pts[0];
      c.line = l;
      lier(c);
    } else if (pts.size() == 1 && ronds.size() == 1 && ents.size() == 1) {
      const std::string e = ronds[0]->id;
      if (ronds[0]->pc == pts[0]) return message("Ce point est le centre : utilisez Concentrique ou déplacez-le.");
      if (aContrainte([&](const Contrainte& c) { return c.type == "oncircle" && c.p == pts[0] && c.ent == e; })) return message("Point déjà sur ce cercle.");
      pousserAvant();
      Contrainte c;
      c.type = "oncircle";
      c.p = pts[0];
      c.ent = e;
      lier(c);
    } else if (pts.size() == 1 && ents.size() == 1 && ents[0]->t == "spline") {
      const Entite* E = ents[0];
      const std::string id = E->id;
      if (std::find(E->pts.begin(), E->pts.end(), pts[0]) != E->pts.end()) return message("Ce point appartient déjà à la spline.");
      if (aContrainte([&](const Contrainte& c) { return c.type == "onspline" && c.p == pts[0] && c.ent == id; })) return message("Point déjà sur cette spline.");
      pousserAvant();
      Contrainte c;
      c.type = "onspline";
      c.p = pts[0];
      c.ent = id;
      lier(c);
    } else {
      return message("Coïncident : sélectionnez 2 points, ou 1 point + 1 ligne, ou 1 point + 1 cercle ou arc (Ctrl+clic pour le 2e).");
    }
    if (resoudreOuRefuser("Contrainte")) message(pts.size() == 2 ? "Points coïncidents." : ents.size() == 1 && lignes.size() == 1 ? "Point sur la droite : il peut glisser au-delà du segment." : "Point sur la courbe.");
    return;
  }
  const auto aUneSpline = [&] { return std::any_of(ents.begin(), ents.end(), [](const Entite* e) { return e->t == "spline"; }); };
  if (type == "curvature" || (type == "tangent" && ents.size() == 2 && aUneSpline())) {
    const bool g2 = type == "curvature";
    if (ents.size() != 2 || !aUneSpline()) return message("Courbure (G2) : sélectionnez une spline + une ligne, un cercle, un arc ou une spline.");
    const Entite* S = ents[0]->t == "spline" ? ents[0] : ents[1];
    const Entite* O = S == ents[0] ? ents[1] : ents[0];
    std::string pid;
    if (!g2 && !pts.empty() && std::find(S->pts.begin(), S->pts.end(), pts[0]) != S->pts.end()) pid = pts[0];
    else pid = jointSpline(*S, *O);
    if (pid.empty() && O->t == "spline") {
      pid = jointSpline(*O, *S);
      std::swap(S, O);
    }
    if (pid.empty()) return message(g2 ? "Courbure (G2) : joignez d'abord la spline à l'autre courbe (point commun, F1)." : "Tangence spline : joignez d'abord la spline à l'autre courbe (point commun, F1).");
    const std::string sId = S->id, oId = O->id;
    pousserAvant();
    const std::string err = g2 ? courbureVers(sId, oId, pid) : tangenteVers(sId, oId, pid);
    if (!err.empty()) {
      if (annulerPas) annulerPas();
      return message(err);
    }
    const bool ok = resoudreOuRefuser(g2 ? "Courbure G2" : "Tangence");
    nettoyer();
    if (ok) message(g2 ? "Courbure continue (G2) : raccord sans saut de courbure ; peigne de courbure au clic droit sur la spline." : "Spline tangente : la poignée suit la tangente, sa longueur règle la tension.");
    return;
  }
  if (type == "h" || type == "v") {
    if (lignes.empty()) return message("Sélectionnez d'abord une ou plusieurs lignes.");
    std::vector<std::string> ids;
    for (const Entite* l : lignes) ids.push_back(l->id);
    pousserAvant();
    for (const std::string& id : ids)
      if (!aHV(id, type.c_str())) {
        Contrainte c;
        c.type = type;
        c.line = id;
        lier(c);
      }
  } else if (type == "equal") {
    if (ents.size() != 2) return message("Égal : sélectionnez exactement 2 lignes ou 2 cercles ou arcs.");
    if (!((ents[0]->t == "line" && ents[1]->t == "line") || (rond(ents[0]) && rond(ents[1])))) return message("Égal : types incompatibles.");
    const std::string a = ents[0]->id, b = ents[1]->id;
    pousserAvant();
    lier(deux("equal", a, b));
  } else if (type == "tangent") {
    if (ents.size() != 2) return message("Tangence : sélectionnez 1 ligne + 1 cercle ou arc, ou 2 cercles.");
    const Entite* a = ents[0];
    const Entite* b = ents[1];
    const std::string ia = a->id, ib = b->id;
    if ((a->t == "line" && rond(b)) || (b->t == "line" && rond(a))) {
      const std::string l = a->t == "line" ? ia : ib, e = a->t == "line" ? ib : ia;
      pousserAvant();
      Contrainte c;
      c.type = "tangent";
      c.line = l;
      c.ent = e;
      lier(c);
      epinglerTangence(l, e);
    } else if (rond(a) && rond(b)) {
      pousserAvant();
      lier(deux("tangent2", ia, ib));
    } else {
      return message("Tangence : ligne et cercle, ou cercle et cercle uniquement.");
    }
  } else if (type == "coaxial") {
    if (ents.size() != 2 || !rond(ents[0]) || !rond(ents[1])) return message("Concentrique : sélectionnez exactement 2 cercles ou arcs.");
    if (ents[0]->id == ents[1]->id || ents[0]->pc == ents[1]->pc) return message("Ces deux courbes ont déjà le même centre.");
    const std::string a = ents[0]->id, b = ents[1]->id;
    if (paire("coaxial", a, b)) return message("Concentricité déjà posée.");
    pousserAvant();
    lier(deux("coaxial", a, b));
  } else if (type == "parallel" || type == "perpendicular") {
    if (lignes.size() != 2) return message((type == "parallel" ? std::string("Parallèle") : std::string("Perpendiculaire")) + " : sélectionnez exactement 2 lignes.");
    const std::string a = lignes[0]->id, b = lignes[1]->id;
    if (paire(type.c_str(), a, b)) return message(type == "parallel" ? "Parallèle déjà posée." : "Perpendiculaire déjà posée.");
    if (type == "perpendicular" && ((aHV(a, "h") && aHV(b, "v")) || (aHV(a, "v") && aHV(b, "h")))) return message("Déjà perpendiculaires : l'une est horizontale, l'autre verticale.");
    pousserAvant();
    lier(deux(type.c_str(), a, b));
  } else if (type == "collinear") {
    if (lignes.size() != 2) return message("Colinéaire : sélectionnez exactement 2 lignes.");
    const std::string a = lignes[0]->id, b = lignes[1]->id;
    if (paire("collinear", a, b)) return message("Colinéaire déjà posée.");
    if (paire("perpendicular", a, b)) return message("Colinéaire impossible : ces lignes sont perpendiculaires.");
    pousserAvant();
    lier(deux("collinear", a, b));
    dedoublonner();
    structure_ = true;
    if (resoudreOuRefuser("Contrainte")) message("Colinéaire : les 2 lignes portées par la même droite.");
    return;
  } else if (type == "symmetric") {
    if (lignes.size() != 3) return message("Symétrie : sélectionnez 3 lignes, les 2 à symétriser et l'axe (la ligne de construction, ou la dernière cliquée).");
    int nCons = 0;
    const Entite* axe = lignes[2];
    for (const Entite* l : lignes)
      if (l->construction) nCons++;
    if (nCons == 1)
      for (const Entite* l : lignes)
        if (l->construction) axe = l;
    std::vector<std::string> ids;
    for (const Entite* l : lignes)
      if (l != axe) ids.push_back(l->id);
    const std::string mid = axe->id;
    if (aContrainte([&](const Contrainte& c) { return c.type == "symmetric" && ((c.a == ids[0] && c.b == ids[1]) || (c.a == ids[1] && c.b == ids[0])) && c.mid == mid; })) return message("Symétrie déjà posée.");
    pousserAvant();
    Contrainte c = deux("symmetric", ids[0], ids[1]);
    c.mid = mid;
    lier(c);
  } else if (type == "fix") {
    std::vector<std::string> aFixer;
    const auto garder = [&](const std::string& p) {
      if (p != "O" && std::find(aFixer.begin(), aFixer.end(), p) == aFixer.end()) aFixer.push_back(p);
    };
    for (const std::string& p : pts) garder(p);
    for (const Entite* l : lignes) {
      garder(l->p1);
      garder(l->p2);
    }
    std::vector<std::string> ronds;
    for (const Entite* e : ents)
      if (rond(e) || e->t == "spline") ronds.push_back(e->id);  // spline : points de passage et poignées
    if (aFixer.empty() && ronds.empty()) return message("Fixe : sélectionnez un point, une ligne ou un cercle. L'origine est déjà fixe.");
    pousserAvant();
    for (const std::string& p : aFixer) {
      Contrainte c;
      c.type = "fix";
      c.p = p;
      lier(c);
    }
    for (const std::string& e : ronds) {
      Contrainte c;
      c.type = "fix";
      c.ent = e;
      lier(c);
    }
  } else if (type == "midpoint") {
    if (lignes.size() == 2 && pts.empty()) {
      const std::string a = lignes[0]->id, b = lignes[1]->id;
      if (paire("midpoint", a, b)) return message("Milieux égaux déjà posés.");
      pousserAvant();
      lier(deux("midpoint", a, b));
      if (resoudreOuRefuser("Contrainte")) message("Milieux égaux : les 2 lignes se centrent l'une sur l'autre.");
    } else if (lignes.size() == 1 && pts.size() == 1) {
      const std::string l = lignes[0]->id;
      if (aContrainte([&](const Contrainte& c) { return c.type == "midpoint" && c.p == pts[0] && c.line == l; })) return message("Point au milieu déjà posé.");
      pousserAvant();
      Contrainte c;
      c.type = "midpoint";
      c.p = pts[0];
      c.line = l;
      lier(c);
      if (resoudreOuRefuser("Contrainte")) message("Point au milieu de la ligne.");
    } else {
      message("Milieu : sélectionnez 2 lignes (milieux égaux) ou 1 point + 1 ligne (point au centre).");
    }
    return;
  } else {
    return;
  }
  if (resoudreOuRefuser("Contrainte")) message("Contrainte posée. Ctrl+Z pour annuler.");
}

void Dessin::toucheF2() {
  premiere();
  sync();
  std::vector<std::string> ids;
  for (const Entite* e : entitesChoisies())
    if (e->t == "line") ids.push_back(e->id);
  if (ids.empty()) return message("F2 : sélectionnez une ou plusieurs lignes (H si plutôt horizontale, V si plutôt verticale).");
  pousser();
  int n = 0;
  for (const std::string& id : ids) {
    const Entite* l = s_.entite(id);
    const Pt* A = s_.point(l->p1);
    const Pt* B = s_.point(l->p2);
    if (!A || !B) continue;
    if (aHV(id, "h") || aHV(id, "v")) continue;
    Contrainte c;
    c.type = std::abs(B->x - A->x) >= std::abs(B->y - A->y) ? "h" : "v";
    c.line = id;
    lier(c);
    n++;
  }
  structure_ = true;
  apresEdition();
  message(n ? std::to_string(n) + " contrainte(s) H ou V posée(s)." : "F2 : déjà horizontale(s) ou verticale(s).");
}

void Dessin::toucheF1() {
  premiere();
  sync();
  const std::vector<std::string> pts = pointsChoisis();
  const std::vector<const Entite*> ents = entitesChoisies();
  if (pts.size() == 2) {
    pousser();
    if (fusionner(pts[1], pts[0])) {
      selection_.clear();
      apresEdition();
      message("Points fusionnés.");
    }
    return;
  }
  if (pts.size() == 1 && ents.size() == 1) {
    const Entite* E = ents[0];
    if (E->t == "spline" && std::find(E->pts.begin(), E->pts.end(), pts[0]) == E->pts.end()) {
      const std::string id = E->id;
      pousser();
      Contrainte c;
      c.p = pts[0];
      c.type = "onspline";
      c.ent = id;
      lier(c);
      apresEdition();
      message("Point posé sur la spline.");
      return;
    }
    if (E->t != "line" && E->t != "circle" && E->t != "arc") return message("F1 : point + ligne ou cercle, ou 2 points.");
    const bool ligne = E->t == "line";
    const std::string id = E->id;
    pousser();
    Contrainte c;
    c.p = pts[0];
    c.type = ligne ? "online" : "oncircle";
    (ligne ? c.line : c.ent) = id;
    lier(c);
    apresEdition();
    message(ligne ? "Point posé sur la ligne." : "Point posé sur le cercle.");
    return;
  }
  annulerTrace();
  outil_ = COINCIDENT;
  message("Coïncident : cliquez 2 extrémités à fusionner, ou sélectionnez 2 points, ou un point + une ligne ou un cercle (Ctrl+clic pour le 2e), puis F1.");
}

void Dessin::supprimer() {
  premiere();
  std::set<std::string> ents, pts, cotes, contraintes;
  bool projFixe = false;
  for (const Choix& c : selection_) {
    if (c.sorte == Choix::ENTITE) ents.insert(c.id);
    else if (c.sorte == Choix::POINT) pts.insert(c.id);
    else if (c.sorte == Choix::COTE) cotes.insert(c.id);
    else if (c.sorte == Choix::CONTRAINTE) {
      const auto it = std::find_if(s_.contraintes.begin(), s_.contraintes.end(), [&](const Contrainte& k) { return k.id == c.id; });
      if (it != s_.contraintes.end() && !fixeDeProjection(s_, *it)) contraintes.insert(c.id);
      else if (it != s_.contraintes.end()) projFixe = true;
    }
  }
  if (projFixe && ents.empty() && pts.empty() && cotes.empty() && contraintes.empty()) {
    message("Fixe d'une projection : elle suit son arête source. Supprimez la projection pour la libérer.");
    return;
  }
  if (ents.empty() && pts.empty() && cotes.empty() && contraintes.empty()) {
    message("Rien à supprimer : sélectionnez d'abord.");
    return;
  }
  const bool origine = pts.erase("O") > 0;
  pousser();
  std::map<std::string, std::vector<std::string>> projAvant;
  for (const Entite& e : s_.entites)
    if (e.proj) projAvant[e.id] = ptsEntite(e);
  const auto meurt = [&](const Entite& x) {
    if (ents.count(x.id)) return true;
    if (x.t == "line" && (pts.count(x.p1) || pts.count(x.p2))) return true;
    if ((x.t == "circle" || x.t == "arc") && pts.count(x.pc)) return true;
    if (x.t == "arc" && (pts.count(x.pa) || pts.count(x.pb))) return true;
    if (x.t == "cpoint" && pts.count(x.p)) return true;
    return false;
  };
  s_.entites.erase(std::remove_if(s_.entites.begin(), s_.entites.end(), meurt), s_.entites.end());
  for (Entite& x : s_.entites)  // spline : le point de passage seul est retiré
    if (x.t == "spline") x.pts.erase(std::remove_if(x.pts.begin(), x.pts.end(), [&](const std::string& q) { return pts.count(q) > 0; }), x.pts.end());
  // skProjFixOublier : les « fixe » des points qui n'appartiennent plus à aucune projection
  std::set<std::string> libres, reste;
  for (const auto& [id, v] : projAvant) {
    if (s_.entite(id)) continue;
    for (const std::string& q : v) libres.insert(q);
  }
  if (!libres.empty()) {
    for (const Entite& e : s_.entites)
      if (e.proj)
        for (const std::string& q : ptsEntite(e)) reste.insert(q);
    s_.contraintes.erase(std::remove_if(s_.contraintes.begin(), s_.contraintes.end(), [&](const Contrainte& c) { return c.type == "fix" && !c.p.empty() && libres.count(c.p) && !reste.count(c.p); }), s_.contraintes.end());
  }
  s_.contraintes.erase(std::remove_if(s_.contraintes.begin(), s_.contraintes.end(), [&](const Contrainte& c) { return contraintes.count(c.id) > 0; }), s_.contraintes.end());
  s_.cotes.erase(std::remove_if(s_.cotes.begin(), s_.cotes.end(), [&](const Cote& d) { return cotes.count(d.id) > 0; }), s_.cotes.end());
  const size_t n = ents.size() + pts.size() + cotes.size() + contraintes.size();
  selection_.clear();
  structure_ = true;
  // cleanupSk retire les points orphelins : ceux qui ont été choisis ne servent plus à rien non plus
  nettoyer();
  structure_ = true;
  resoudre();
  message((origine ? std::string("L'origine est permanente, elle reste. ") : std::string()) + std::to_string(n) + " élément(s) supprimé(s) : Ctrl+Z pour annuler.");
}

// ---------- Ajuster (src/60-trim-et-souris.js) ----------
namespace {
constexpr double FROLE = 0.05;  // TRIM_GRAZE : un frôlement compte comme une intersection, en mm
struct Coupe {
  double x = 0, y = 0, t = 0, u = 0;
};
bool croiseDroites(const Pt& A, const Pt& B, const Pt& C, const Pt& D, Coupe& o) {  // interLineLine
  const double dx1 = B.x - A.x, dy1 = B.y - A.y, dx2 = D.x - C.x, dy2 = D.y - C.y;
  const double den = dx1 * dy2 - dy1 * dx2;
  if (std::abs(den) < 1e-12) return false;
  const double t = ((C.x - A.x) * dy2 - (C.y - A.y) * dx2) / den, u = ((C.x - A.x) * dy1 - (C.y - A.y) * dx1) / den;
  o = {A.x + dx1 * t, A.y + dy1 * t, t, u};
  return true;
}
std::vector<Coupe> croiseCercle(const Pt& A, const Pt& B, const Pt& C, double r) {  // interLineCircle
  const double dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
  if (L2 < 1e-12) return {};
  const double t0 = ((C.x - A.x) * dx + (C.y - A.y) * dy) / L2;
  const double px = A.x + dx * t0, py = A.y + dy * t0;
  const double h2 = r * r - (px - C.x) * (px - C.x) - (py - C.y) * (py - C.y);
  if (h2 < -FROLE * FROLE) return {};
  const double h = std::sqrt(jsmax(h2, 0)), L = std::sqrt(L2);
  if (h < FROLE) return {{px, py, t0, 0}};
  return {{px - dx / L * h, py - dy / L * h, t0 - h / L, 0}, {px + dx / L * h, py + dy / L * h, t0 + h / L, 0}};
}
std::vector<Pt> croiseRonds(const Pt& C0, double r0, const Pt& C1, double r1) {  // interCircCirc
  const double dx = C1.x - C0.x, dy = C1.y - C0.y, d = hyp(dx, dy);
  if (d < 1e-9 || d > r0 + r1 + FROLE || d < std::abs(r0 - r1) - FROLE) return {};
  const double a = (r0 * r0 - r1 * r1 + d * d) / (2 * d), h = std::sqrt(jsmax(r0 * r0 - a * a, 0));
  const double xm = C0.x + dx * a / d, ym = C0.y + dy * a / d;
  if (h < FROLE) return {{xm, ym}};
  return {{xm - dy * h / d, ym + dx * h / d}, {xm + dy * h / d, ym - dx * h / d}};
}
double angleNorme(double a) {  // angNorm
  const double T = PI_ * 2;
  a = std::fmod(a, T);
  if (a < 0) a += T;
  return a;
}
bool paireLignes(const std::string& t) { return t == "parallel" || t == "perpendicular" || t == "collinear" || t == "symmetric"; }  // skPairLineType
// lineConstrsOf : la contrainte est-elle dédiée à cette ligne ?
bool lienDeLigne(const Contrainte& c, const std::string& id) {
  if (c.type == "h" || c.type == "v" || c.type == "tangent") return c.line == id;
  if (paireLignes(c.type)) return c.a == id || c.b == id || (c.type == "symmetric" && c.mid == id);
  if (c.type == "midpoint") return c.line == id || c.a == id || c.b == id;
  if (c.type == "fix") return c.ent == id;
  return false;
}
double mesureCote(const Pt& A, const Pt& B, const std::string& o) {  // dimMeasureOf
  return o == "h" ? std::abs(B.x - A.x) : o == "v" ? std::abs(B.y - A.y) : hyp(B.x - A.x, B.y - A.y);
}
}  // namespace

std::vector<Pt> Dessin::croisements(const Entite& ent) const {
  std::vector<Pt> out;
  const auto surArcEps = [](double a, const An& an) { return dansArc(a, an.a1, an.a2 + 1e-4); };  // bruit du solveur aux extrémités
  const auto ignore = [&](const Entite& o) { return o.id == ent.id || (o.construction && !o.proj); };
  if (ent.t == "line") {
    const Pt* A = s_.point(ent.p1);
    const Pt* B = s_.point(ent.p2);
    if (!A || !B) return out;
    for (const Entite& o : s_.entites) {
      if (ignore(o)) continue;
      if (o.t == "line") {
        const Pt* C = s_.point(o.p1);
        const Pt* D = s_.point(o.p2);
        if (!C || !D) continue;
        Coupe h;
        if (croiseDroites(*A, *B, *C, *D, h) && h.t > -1e-6 && h.t < 1 + 1e-6 && h.u > -1e-6 && h.u < 1 + 1e-6) out.push_back({h.x, h.y});
      }
      if (o.t == "circle" || o.t == "arc") {
        const Pt* C = s_.point(o.pc);
        if (!C) continue;
        for (const Coupe& h : croiseCercle(*A, *B, *C, o.r)) {
          if (!(h.t > -1e-6 && h.t < 1 + 1e-6)) continue;
          if (o.t == "arc") {
            An an;
            if (!anglesArc2(s_, o, an) || !surArcEps(m_atan2(h.y - C->y, h.x - C->x), an)) continue;
          }
          out.push_back({h.x, h.y});
        }
      }
      if (o.t == "spline")
        for (const Pt& h : croiseSpline(o, ent)) out.push_back(h);
    }
  }
  if (ent.t == "spline") {
    for (const Entite& o : s_.entites) {
      if (ignore(o)) continue;
      for (const Pt& h : croiseSpline(ent, o)) out.push_back(h);
    }
  }
  if (ent.t == "circle" || ent.t == "arc") {
    const Pt* C = s_.point(ent.pc);
    if (!C) return out;
    const auto surSoi = [&](double x, double y) {
      if (ent.t == "circle") return true;
      An an;
      return anglesArc2(s_, ent, an) && surArcEps(m_atan2(y - C->y, x - C->x), an);
    };
    for (const Entite& o : s_.entites) {
      if (ignore(o)) continue;
      if (o.t == "line") {
        const Pt* A = s_.point(o.p1);
        const Pt* B = s_.point(o.p2);
        if (!A || !B) continue;
        const double h0 = hyp(B->x - A->x, B->y - A->y), span = h0 != 0 ? h0 : 1, tt = jsmax(1e-6, 0.02 / span);  // une tangence compte
        for (const Coupe& h : croiseCercle(*A, *B, *C, ent.r))
          if (h.t > -tt && h.t < 1 + tt && surSoi(h.x, h.y)) out.push_back({h.x, h.y});
      }
      if (o.t == "circle" || o.t == "arc") {
        const Pt* C2 = s_.point(o.pc);
        if (!C2) continue;
        for (const Pt& h : croiseRonds(*C, ent.r, *C2, o.r)) {
          if (!surSoi(h.x, h.y)) continue;
          if (o.t == "arc") {
            An an;
            if (!anglesArc2(s_, o, an) || !surArcEps(m_atan2(h.y - C2->y, h.x - C2->x), an)) continue;
          }
          out.push_back(h);
        }
      }
      if (o.t == "spline")
        for (const Pt& h : croiseSpline(o, ent)) out.push_back(h);
    }
  }
  std::vector<Pt> u;
  for (const Pt& h : out)
    if (std::none_of(u.begin(), u.end(), [&](const Pt& k) { return hyp(k.x - h.x, k.y - h.y) < 1e-6; })) u.push_back(h);
  return u;
}

bool Dessin::piedDans(const Contrainte& c, const std::string& ligne) const {
  const Entite* E = s_.entite(c.ent);
  if (!E || E->pc.empty()) return false;
  const Pt* C = s_.point(E->pc);
  const Entite* L = s_.entite(ligne);
  if (!C || !L) return false;
  const Pt* A = s_.point(L->p1);
  const Pt* B = s_.point(L->p2);
  if (!A || !B) return false;
  const double dx = B->x - A->x, dy = B->y - A->y, len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return false;
  const double t = ((C->x - A->x) * dx + (C->y - A->y) * dy) / len2;
  return t >= -5e-3 && t <= 1 + 5e-3;
}

void Dessin::recopierLiens(const std::string& vieille, const std::vector<std::string>& neuves, bool retirer) {
  std::vector<Contrainte> liens;
  for (const Contrainte& c : s_.contraintes)
    if (lienDeLigne(c, vieille)) liens.push_back(c);
  for (const Contrainte& c : liens)
    for (const std::string& nid : neuves) {
      if (c.type == "h" || c.type == "v") {
        if (!aHV(nid, c.type.c_str())) {
          Contrainte k = contrainte(c.type.c_str());
          k.line = nid;
          lier(k);
        }
      } else if (c.type == "tangent") {
        if (piedDans(c, nid) && !aContrainte([&](const Contrainte& x) { return x.type == "tangent" && x.line == nid && x.ent == c.ent; })) {
          Contrainte k = contrainte("tangent");
          k.line = nid;
          k.ent = c.ent;
          lier(k);
        }
      } else if (c.type == "fix") {
        if (!aContrainte([&](const Contrainte& x) { return x.type == "fix" && x.ent == nid; })) {
          Contrainte k = contrainte("fix");
          k.ent = nid;
          lier(k);
        }
      } else if (paireLignes(c.type)) {
        const std::string a = c.a == vieille ? nid : c.a, b = c.b == vieille ? nid : c.b, mid = c.mid == vieille ? nid : c.mid;
        if (a != b && a != mid && b != mid && !aContrainte([&](const Contrainte& x) { return x.type == c.type && x.mid == c.mid && ((x.a == a && x.b == b) || (c.type != "parallel" && x.a == b && x.b == a)); })) {
          Contrainte k = contrainte(c.type.c_str());
          k.a = a;
          k.b = b;
          if (!c.mid.empty()) k.mid = mid;
          lier(k);
        }
      }
    }
  if (retirer) {
    s_.contraintes.erase(std::remove_if(s_.contraintes.begin(), s_.contraintes.end(), [&](const Contrainte& c) { return lienDeLigne(c, vieille); }), s_.contraintes.end());
    s_.cotes.erase(std::remove_if(s_.cotes.begin(), s_.cotes.end(), [&](const Cote& d) { return d.type == "length" && d.line == vieille; }), s_.cotes.end());
    structure_ = true;
  }
}

void Dessin::scinderLigne(const std::string& ligne, const std::string& pid) {
  Entite* l = entite(ligne);
  if (!l || l->t != "line" || l->p1 == pid || l->p2 == pid) return;
  Entite nl;
  nl.id = nouvelE();
  nl.t = "line";
  nl.p1 = pid;
  nl.p2 = l->p2;
  nl.construction = l->construction;  // V0.67.3 : sa moitié neuve reste hors des profils
  nl.ref = l->ref;
  l->p2 = pid;
  const std::string nid = nl.id;
  s_.entites.push_back(std::move(nl));
  structure_ = true;
  recopierLiens(ligne, {nid}, false);
  std::vector<Contrainte> tangences;
  for (const Contrainte& c : s_.contraintes)
    if (c.type == "tangent" && (c.line == ligne || c.line == nid)) tangences.push_back(c);
  for (const Contrainte& c : tangences) {
    const bool pied = piedDans(c, ligne), piedNeuf = piedDans(c, nid);
    if (c.line == ligne && !pied && piedNeuf) {
      const auto it = std::find_if(s_.contraintes.begin(), s_.contraintes.end(), [&](const Contrainte& x) { return x.id == c.id && x.type == c.type && x.line == c.line && x.ent == c.ent; });
      if (it != s_.contraintes.end()) s_.contraintes.erase(it);
    }
    if ((pied || piedNeuf) && !aContrainte([&](const Contrainte& x) { return x.type == "parallel" && ((x.a == ligne && x.b == nid) || (x.a == nid && x.b == ligne)); })) {
      Contrainte k = contrainte("parallel");
      k.a = ligne;
      k.b = nid;
      lier(k);
    }
  }
  for (Cote& d : s_.cotes)
    if (d.type == "length" && d.line == ligne) {
      const Entite* e = s_.entite(ligne);
      const Pt* A = s_.point(e->p1);
      const Pt* B = s_.point(e->p2);
      if (A && B) d.value = mesureCote(*A, *B, d.orient);
      else d.value = 0;
      break;
    }
}

std::string Dessin::pointCoupe(const std::string& soi, double x, double y) {
  const double tol = jsmin(0.5, SNAP_ * 0.5);  // jonction en T : 5 pixels au plus
  std::string pid;
  double bd = tol;
  for (const std::string& q : s_.ordre) {
    const Pt& p = s_.points.at(q);
    const double d = hyp(p.x - x, p.y - y);
    if (d < bd) {
      bd = d;
      pid = q;
    }
  }
  if (pid.empty()) pid = ajouterPoint(x, y);
  const size_t n = s_.entites.size();  // les lignes créées en route ne sont pas revues
  for (size_t i = 0; i < n; i++) {
    const Entite o = s_.entites[i];
    if (o.id == soi || o.t != "line") continue;
    const Pt* A = s_.point(o.p1);
    const Pt* B = s_.point(o.p2);
    if (!A || !B || o.p1 == pid || o.p2 == pid) continue;
    if (distSeg(x, y, *A, *B) >= tol) continue;
    if (o.proj) {  // une projection ne se coupe pas : le point est posé sur la droite
      if (!aContrainte([&](const Contrainte& c) { return c.type == "online" && c.p == pid && c.line == o.id; })) {
        Contrainte k = contrainte("online");
        k.p = pid;
        k.line = o.id;
        lier(k);
      }
      continue;
    }
    scinderLigne(o.id, pid);
  }
  return pid;
}

void Dessin::majCotesLigne(const std::string& ligne) {
  const Entite* l = s_.entite(ligne);
  if (!l) return;
  const Pt* A = s_.point(l->p1);
  const Pt* B = s_.point(l->p2);
  if (!A || !B) return;
  for (Cote& d : s_.cotes)
    if (d.type == "length" && d.line == ligne) d.value = mesureCote(*A, *B, d.orient);
}

std::string Dessin::ajusterElement(const std::string& id, double cx, double cy) {
  const Entite ent = *entite(id);
  structure_ = true;
  if (ent.proj && ent.t == "line") {  // la projetée repasse en construction, le tronçon gardé devient une droite posée dessus
    Entite cl;
    cl.id = nouvelE();
    cl.t = "line";
    cl.p1 = ent.p1;
    cl.p2 = ent.p2;
    const std::string cid = cl.id;
    s_.entites.push_back(std::move(cl));
    entite(id)->construction = true;
    return ajusterElement(cid, cx, cy);
  }
  if (ent.proj) return "Projection : elle suit son arête source, elle ne s'ajuste pas (elle sert de limite aux autres).";
  if (ent.construction) return "Entité de construction : repère de positionnement, rien à ajuster.";
  const auto retirerSoi = [&] { s_.entites.erase(std::remove_if(s_.entites.begin(), s_.entites.end(), [&](const Entite& x) { return x.id == id; }), s_.entites.end()); };
  if (ent.t == "line") {
    const Pt* pA = s_.point(ent.p1);
    const Pt* pB = s_.point(ent.p2);
    if (!pA || !pB) return "Ligne invalide.";
    const Pt A = *pA, B = *pB;
    const double dx = B.x - A.x, dy = B.y - A.y, len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return "Ligne dégénérée.";
    const auto couper = [&](double x, double y) {
      const std::string pid = pointCoupe(id, x, y);
      attacherCourbe(pid, x, y, 1e-3);
      return pid;
    };
    const double tc = ((cx - A.x) * dx + (cy - A.y) * dy) / len2;
    std::vector<Coupe> bruts;
    for (const Pt& h : croisements(ent)) {
      const double t = ((h.x - A.x) * dx + (h.y - A.y) * dy) / len2;
      if (t >= -1e-6 && t <= 1 + 1e-6) bruts.push_back({h.x, h.y, t, 0});
    }
    std::stable_sort(bruts.begin(), bruts.end(), [](const Coupe& p, const Coupe& q) { return p.t < q.t; });
    std::vector<Coupe> hits;
    for (const Coupe& h : bruts)
      if (hits.empty() || hyp(h.x - hits.back().x, h.y - hits.back().y) > 1e-4) hits.push_back(h);
    if (hits.empty()) return "Aucune intersection : rien à ajuster.";
    const Coupe* prev = nullptr;
    const Coupe* next = nullptr;
    for (const Coupe& h : hits) {
      if (h.t < tc - 1e-9) prev = &h;
      else if (h.t > tc + 1e-9 && !next) next = &h;
    }
    const auto retirerLigne = [&] {
      recopierLiens(id, {}, true);
      retirerSoi();
      return std::string("Ligne retirée.");
    };
    if (prev && next && prev->t <= 1e-9 && next->t >= 1 - 1e-9) return retirerLigne();
    if (prev && next && prev->t <= 1e-9) {
      const std::string q = couper(next->x, next->y);
      entite(id)->p1 = q;
      majCotesLigne(id);
      return "Ligne ajustée.";
    }
    if (prev && next && next->t >= 1 - 1e-9) {
      const std::string q = couper(prev->x, prev->y);
      entite(id)->p2 = q;
      majCotesLigne(id);
      return "Ligne ajustée.";
    }
    if (prev && !next && prev->t <= 1e-9) return retirerLigne();
    if (!prev && next && next->t >= 1 - 1e-9) return retirerLigne();
    if (prev && next) {
      const std::string qA = couper(prev->x, prev->y), qB = couper(next->x, next->y);
      const std::string p1 = entite(id)->p1, p2 = entite(id)->p2;
      const bool reference = entite(id)->ref;  // V0.67.3 : une référence 3D le reste, ses tronçons n'entrent pas dans les profils
      retirerSoi();
      Entite l1, l2;
      l1.ref = l2.ref = reference;
      l1.id = nouvelE();
      l2.id = nouvelE();
      l1.t = l2.t = "line";
      l1.p1 = p1;
      l1.p2 = qA;
      l2.p1 = qB;
      l2.p2 = p2;
      const std::vector<std::string> neuves{l1.id, l2.id};
      s_.entites.push_back(std::move(l1));
      s_.entites.push_back(std::move(l2));
      recopierLiens(id, neuves, true);
      return "Tronçon retiré.";
    }
    if (prev && !next) {
      const std::string q = couper(prev->x, prev->y);
      entite(id)->p2 = q;
      majCotesLigne(id);
      return "Ligne ajustée.";
    }
    if (!prev && next) {
      const std::string q = couper(next->x, next->y);
      entite(id)->p1 = q;
      majCotesLigne(id);
      return "Ligne ajustée.";
    }
    return "Rien à ajuster ici.";
  }
  if (ent.t == "spline") return ajusterSpline(id, cx, cy);
  if (ent.t != "arc" && ent.t != "circle") return "Ajuster : lignes, arcs, cercles et splines uniquement.";
  const Pt* pC = s_.point(ent.pc);
  if (!pC) return "Cercle invalide.";
  const Pt C = *pC;
  const std::vector<Pt> hits = croisements(ent);
  if (ent.t == "circle" && hits.size() < 2) return "Il faut au moins 2 intersections pour ajuster un cercle.";
  if (hits.empty()) return "Aucune intersection : rien à ajuster.";
  std::vector<double> angs;
  for (const Pt& h : hits) angs.push_back(angleNorme(m_atan2(h.y - C.y, h.x - C.x)));
  std::sort(angs.begin(), angs.end());
  const double clicA = angleNorme(m_atan2(cy - C.y, cx - C.x)), T = PI_ * 2;
  if (ent.t == "circle") {  // le cercle devient l'arc complémentaire du segment cliqué
    size_t i0 = angs.size() - 1;
    for (size_t i = 0; i < angs.size(); i++) {
      const double a0 = angs[i], a1 = angs[(i + 1) % angs.size()];
      if (a1 > a0 ? (clicA >= a0 && clicA <= a1) : (clicA >= a0 || clicA <= a1)) {
        i0 = i;
        break;
      }
    }
    const double aDebut = angs[(i0 + 1) % angs.size()];
    double aFin = angs[i0];
    if (aFin <= aDebut) aFin += T;
    if (aFin - aDebut < 0.05) return "Arc restant trop petit.";
    entite(id)->t = "arc";
    const auto bout = [&](double ang) {
      const double xx = C.x + ent.r * m_cos(ang), yy = C.y + ent.r * m_sin(ang);
      std::string pid = pointCoupe(id, xx, yy);
      if (pid == ent.pc) pid = ajouterPoint(xx, yy);
      attacherCourbe(pid, xx, yy, 1e-3);
      return pid;
    };
    const std::string pa = bout(aDebut);
    entite(id)->pa = pa;
    const std::string pb0 = bout(aFin);
    entite(id)->pb = pb0;
    if (pb0 == pa) {
      const std::string q = ajouterPoint(C.x + ent.r * m_cos(aFin), C.y + ent.r * m_sin(aFin));
      entite(id)->pb = q;
    }
    // Ce qui était ancré sur le segment retiré part avec lui
    const auto dansRetire = [&](double a) {
      const double s = aFin;
      double e = aDebut;
      if (e <= s) e += T;
      double r = std::fmod(a - s, T);
      if (r < 0) r += T;
      return r > 1e-5 && r < (e - s) - 1e-5;
    };
    const auto ancre = [&](const Contrainte& c, double& a) {
      if (c.type == "oncircle") {
        const Pt* p = s_.point(c.p);
        if (!p) return false;
        a = angleNorme(m_atan2(p->y - C.y, p->x - C.x));
        return true;
      }
      const Entite* L = s_.entite(c.line);
      if (!L) return false;
      const Pt* A = s_.point(L->p1);
      const Pt* B = s_.point(L->p2);
      if (!A || !B) return false;
      const double dx = B->x - A->x, dy = B->y - A->y, L2 = dx * dx + dy * dy;
      if (L2 < 1e-12) return false;
      const double t = ((C.x - A->x) * dx + (C.y - A->y) * dy) / L2;
      a = angleNorme(m_atan2(A->y + t * dy - C.y, A->x + t * dx - C.x));
      return true;
    };
    std::vector<Contrainte> garde;
    for (const Contrainte& c : s_.contraintes) {
      double a = 0;
      if (c.ent == id && (c.type == "oncircle" || c.type == "tangent") && ancre(c, a) && dansRetire(a)) continue;
      garde.push_back(c);
    }
    s_.contraintes = std::move(garde);
    return "Cercle ajusté en arc (cotes Ø conservées).";
  }
  An an0;
  if (!anglesArc2(s_, ent, an0)) return "Arc invalide.";
  const double A1 = an0.a1;
  double d = an0.a2 - an0.a1;
  if (d < 1e-9) d = T;
  const auto rel = [&](double a) {
    double r = std::fmod(a - A1, T);
    if (r < 0) r += T;
    return r;
  };
  const auto ancreRel = [&](const Contrainte& c, double& r) {
    if (c.type == "oncircle") {
      const Pt* p = s_.point(c.p);
      if (!p) return false;
      r = rel(m_atan2(p->y - C.y, p->x - C.x));
      return true;
    }
    const Entite* L = s_.entite(c.line);
    if (!L) return false;
    const Pt* A = s_.point(L->p1);
    const Pt* B = s_.point(L->p2);
    if (!A || !B) return false;
    const double dx = B->x - A->x, dy = B->y - A->y, L2 = dx * dx + dy * dy;
    if (L2 < 1e-12) return false;
    const double t = ((C.x - A->x) * dx + (C.y - A->y) * dy) / L2;
    r = rel(m_atan2(A->y + t * dy - C.y, A->x + t * dx - C.x));
    return true;
  };
  std::vector<double> dans;
  for (const double a : angs) {
    const double r = rel(a);
    if (r > 1e-4 && r < d - 1e-4) dans.push_back(r);
  }
  std::sort(dans.begin(), dans.end());
  if (dans.empty()) return "Rien à ajuster ici.";
  const double rc = rel(clicA);
  bool aP = false, aN = false;
  double pB = 0, nB = 0;
  for (const double r : dans) {
    if (r < rc) {
      pB = r;
      aP = true;
    } else if (!aN) {
      nB = r;
      aN = true;
    }
  }
  constexpr double E = 1e-5;
  // Point de coupe neuf : on ne déplace jamais un bout existant, partagé peut-être avec une ligne
  const auto couperRel = [&](double r, const std::vector<std::string>& exclus) {
    const double x = C.x + ent.r * m_cos(A1 + r), y = C.y + ent.r * m_sin(A1 + r);
    std::string pid = pointCoupe(id, x, y);
    if (pid.empty() || std::find(exclus.begin(), exclus.end(), pid) != exclus.end()) pid = ajouterPoint(x, y);
    if (!aContrainte([&](const Contrainte& c) { return c.type == "oncircle" && c.p == pid && c.ent == id; })) {
      Contrainte k = contrainte("oncircle");
      k.p = pid;
      k.ent = id;
      lier(k);
    }
    return pid;
  };
  const auto router = [&](const std::string& neuf) {  // chaque ancrage suit le tronçon qui le porte, celui du tronçon retiré part
    std::vector<Contrainte> garde;
    for (Contrainte c : s_.contraintes) {
      double r = 0;
      if (c.ent == id && (c.type == "oncircle" || c.type == "tangent") && ancreRel(c, r)) {
        if (aP && aN) {
          if (r > pB + E) {
            if (r >= nB - E) {
              if (!neuf.empty()) c.ent = neuf;
            } else {
              continue;
            }
          }
        } else if (aP) {
          if (r > pB + E) continue;
        } else if (r < nB - E) {
          continue;
        }
      }
      garde.push_back(std::move(c));
    }
    s_.contraintes = std::move(garde);
  };
  if (aP && aN) {
    const std::string vieuxPb = ent.pb;
    const std::string qB = couperRel(pB, {ent.pc, ent.pa, ent.pb});
    entite(id)->pb = qB;
    const std::string np = couperRel(nB, {ent.pc, ent.pa, qB, vieuxPb, qB});
    Entite nA;
    nA.id = nouvelE();
    nA.t = "arc";
    nA.pc = ent.pc;
    nA.pa = np;
    nA.pb = vieuxPb;
    nA.r = ent.r;
    const std::string nid = nA.id;
    s_.entites.push_back(std::move(nA));
    router(nid);
    // Le nouveau tronçon hérite des liaisons sans ancrage angulaire, et des cotes de rayon
    const size_t n = s_.contraintes.size();
    for (size_t i = 0; i < n; i++) {
      const Contrainte c = s_.contraintes[i];
      if (paireLignes(c.type) && (c.a == id || c.b == id || c.mid == id)) {
        const std::string a = c.a == id ? nid : c.a, b = c.b == id ? nid : c.b, mid = c.mid == id ? nid : c.mid;
        if (a != b && a != mid && b != mid && !aContrainte([&](const Contrainte& x) { return x.type == c.type && x.mid == mid && ((x.a == a && x.b == b) || (c.type != "parallel" && x.a == b && x.b == a)); })) {
          Contrainte k = contrainte(c.type.c_str());
          k.a = a;
          k.b = b;
          if (!mid.empty()) k.mid = mid;
          lier(k);
        }
      } else if (c.type == "fix" && c.ent == id) {
        if (!aContrainte([&](const Contrainte& x) { return x.type == "fix" && x.ent == nid; })) {
          Contrainte k = contrainte("fix");
          k.ent = nid;
          lier(k);
        }
      }
    }
    const std::vector<Cote> cotes = s_.cotes;
    for (const Cote& dd : cotes) {
      if (dd.type != "radius" || dd.ent != id) continue;
      if (std::any_of(s_.cotes.begin(), s_.cotes.end(), [&](const Cote& x) { return x.type == "radius" && x.ent == nid; })) continue;
      Cote k;
      k.id = nouvelE();
      k.type = "radius";
      k.ent = nid;
      k.value = dd.value;
      k.ox = dd.ox;
      k.oy = dd.oy;
      s_.cotes.push_back(std::move(k));
    }
    return "Arc scindé.";
  }
  if (aP) {
    const std::string q = couperRel(pB, {ent.pc, ent.pa, ent.pb});
    entite(id)->pb = q;
    router("");
    return "Arc ajusté.";
  }
  if (aN) {
    const std::string q = couperRel(nB, {ent.pc, ent.pa, ent.pb});
    entite(id)->pa = q;
    router("");
    return "Arc ajusté.";
  }
  return "Rien à ajuster ici.";
}

void Dessin::clicAjuster(double wx, double wy) {
  coupeGlisse_ = true;
  coupePoussee_ = coupeFaite_ = false;
  coupesGlissees_ = 0;
  coupePrec_ = Pt{wx, wy};
  const Entite* e = entiteProche(wx, wy, 12 / echelle_, true);  // SK_PICKX
  if (!e) {
    message("Ajuster : cliquez un morceau de ligne, d'arc ou de cercle près d'une intersection, ou glissez à travers plusieurs morceaux.");
    apercu_ = ApercuCoupe{};
    return;
  }
  const std::string id = e->id;
  pousser();
  coupePoussee_ = true;
  coupeFaite_ = true;
  coupesGlissees_ = 1;
  coupeDerniere_ = Pt{wx, wy};
  message(ajusterElement(id, wx, wy));
  apresEdition();
  apercu_ = calculerApercu(wx, wy);
}

void Dessin::couperSansResoudre(double wx, double wy) {
  if (const Entite* e = entiteProche(wx, wy, 12 / echelle_, true)) {
    const std::string id = e->id;
    ajusterElement(id, wx, wy);
  }
}

// Ce que le clic retirerait : mêmes choix que ajusterElement, sans rien toucher
Dessin::ApercuCoupe Dessin::calculerApercu(double wx, double wy) const {
  ApercuCoupe o;
  const Entite* pe = entiteProche(wx, wy, 12 / echelle_, true);
  if (!pe || (pe->proj && pe->t != "line")) return o;
  const Entite& ent = *pe;
  if (ent.t == "line") {
    const Pt* pA = s_.point(ent.p1);
    const Pt* pB = s_.point(ent.p2);
    if (!pA || !pB) return o;
    const double dx = pB->x - pA->x, dy = pB->y - pA->y, len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return o;
    const double tc = ((wx - pA->x) * dx + (wy - pA->y) * dy) / len2;
    bool aP = false, aN = false, vu = false;
    double tP = 0, tN = 0;
    for (const Pt& h : croisements(ent)) {
      const double t = ((h.x - pA->x) * dx + (h.y - pA->y) * dy) / len2;
      if (t < -1e-6 || t > 1 + 1e-6) continue;
      vu = true;
      if (t < tc - 1e-9) {
        if (!aP || t > tP) tP = t;
        aP = true;
      } else if (t > tc + 1e-9) {
        if (!aN || t < tN) tN = t;
        aN = true;
      }
    }
    if (!vu || (!aP && !aN)) return o;
    const double t0 = aP ? tP : 0, t1 = aN ? tN : 1;
    o.sorte = ApercuCoupe::TRAIT;
    o.A = Pt{pA->x + dx * t0, pA->y + dy * t0};
    o.B = Pt{pA->x + dx * t1, pA->y + dy * t1};
    return o;
  }
  if (ent.t != "circle" && ent.t != "arc") return o;
  const Pt* pC = s_.point(ent.pc);
  if (!pC) return o;
  const std::vector<Pt> hits = croisements(ent);
  if (hits.empty() || (ent.t == "circle" && hits.size() < 2)) return o;
  std::vector<double> angs;
  for (const Pt& h : hits) angs.push_back(angleNorme(m_atan2(h.y - pC->y, h.x - pC->x)));
  std::sort(angs.begin(), angs.end());
  const double clicA = angleNorme(m_atan2(wy - pC->y, wx - pC->x)), T = PI_ * 2;
  o.C = *pC;
  o.r = ent.r;
  if (ent.t == "circle") {
    size_t i0 = angs.size() - 1;
    for (size_t i = 0; i < angs.size(); i++) {
      const double a0 = angs[i], a1 = angs[(i + 1) % angs.size()];
      if (a1 > a0 ? (clicA >= a0 && clicA <= a1) : (clicA >= a0 || clicA <= a1)) {
        i0 = i;
        break;
      }
    }
    const double aDebut = angs[(i0 + 1) % angs.size()];
    double aFin = angs[i0];
    if (aFin <= aDebut) aFin += T;
    if (aFin - aDebut < 0.05) return o;
    o.sorte = ApercuCoupe::ROND;
    o.a1 = angs[i0];
    o.a2 = aDebut;
    if (o.a2 <= o.a1) o.a2 += T;
    return o;
  }
  An an;
  if (!anglesArc2(s_, ent, an)) return o;
  double d = an.a2 - an.a1;
  if (d < 1e-9) d = T;
  const auto rel = [&](double a) {
    double r = std::fmod(a - an.a1, T);
    if (r < 0) r += T;
    return r;
  };
  std::vector<double> dans;
  for (const double a : angs) {
    const double r = rel(a);
    if (r > 1e-4 && r < d - 1e-4) dans.push_back(r);
  }
  std::sort(dans.begin(), dans.end());
  if (dans.empty()) return o;
  const double rc = rel(clicA);
  double r0 = 0, r1 = d;
  bool aN = false;
  for (const double r : dans) {
    if (r < rc) r0 = r;
    else if (!aN) {
      r1 = r;
      aN = true;
    }
  }
  o.sorte = ApercuCoupe::ROND;
  o.a1 = an.a1 + r0;
  o.a2 = an.a1 + r1;
  return o;
}

// La souris passe sur un morceau, à quelques pixels près : il part. Après une coupe, il faut s'en éloigner
// un peu : sans cela le voisin, de l'autre côté du croisement, partirait dans le même mouvement.
void Dessin::glisserAjuster(double wx, double wy) {
  const double L = hyp(wx - coupePrec_.x, wy - coupePrec_.y);
  const int n = jsmax(1, std::ceil(L * echelle_ / 2));
  const Pt de = coupePrec_;
  coupePrec_ = Pt{wx, wy};
  for (int i = 1; i <= n; i++) {
    const double x = de.x + (wx - de.x) * i / n, y = de.y + (wy - de.y) * i / n;
    if (coupeFaite_ && hyp(x - coupeDerniere_.x, y - coupeDerniere_.y) * echelle_ < 6) continue;
    const Entite* e = entiteProche(x, y, 3 / echelle_, true);
    if (!e || calculerApercu(x, y).sorte == ApercuCoupe::RIEN) continue;
    const std::string id = e->id;
    if (!coupePoussee_) {
      pousser();
      coupePoussee_ = true;
    }
    message(ajusterElement(id, x, y));
    apresEdition();
    coupeFaite_ = true;
    coupesGlissees_++;
    coupeDerniere_ = Pt{x, y};
  }
}

// ---------- Décaler (src/50-esquisse-3-edition-geometrie.js, skOffsetApply) ----------
std::vector<std::string> Dessin::choixDecalables() const {
  std::vector<std::string> v;
  for (const Entite* e : entitesChoisies())
    if (((e->t == "line" && !e->poignee) || e->t == "circle" || e->t == "arc") && !e->ref) v.push_back(e->id);
  return v;
}

void Dessin::clicDecaler(double wx, double wy) {
  const std::vector<std::string> ids = choixDecalables(), spl = splinesChoisies();
  if (ids.empty() && spl.empty()) {
    message("Décalage : sélectionnez d'abord une ou plusieurs lignes, cercles, arcs ou splines (Ctrl+clic pour les suivants).");
    return;
  }
  if (!offArme_) {
    offArme_ = true;
    curseurDecalage_ = Pt{wx, wy};
    message("Décalage : cliquez le côté (la distance est celle du curseur, ou tapez-la). Échap annule.");
    return;
  }
  if (dyn_.actif) {  // distance tapée : le clic donne le côté
    double tapee = 0;
    if (distanceTapee(tapee)) appliquerDecalage(ids, tapee, wx, wy);
    return;
  }
  double D = 1e9;
  for (const std::string& id : ids) {
    const Entite* e = s_.entite(id);
    if (e->t == "line") {
      const Pt* A = s_.point(e->p1);
      const Pt* B = s_.point(e->p2);
      if (A && B) D = jsmin(D, distSeg(wx, wy, *A, *B));
    } else if (const Pt* C = s_.point(e->pc)) {
      if (e->r > 0) D = jsmin(D, std::abs(hyp(wx - C->x, wy - C->y) - e->r));
    }
  }
  if (ids.empty()) D = distanceSplines(spl, wx, wy);
  offArme_ = false;
  if (!(D >= 4 / echelle_)) {
    message("Décalage : cliquez plus loin du profil.");
    return;
  }
  appliquerDecalage(ids, D, wx, wy);
}

void Dessin::appliquerDecalage(const std::vector<std::string>& ids, double D, double wx, double wy) {
  offArme_ = false;
  dyn_ = Saisie{};
  pousser();
  std::string msg;
  const Pt cible{wx, wy};
  if (!ids.empty()) {
    if (!decalerElements(ids, D, &cible, msg)) {
      if (annulerPas) annulerPas();
      message(msg);
      return;
    }
    msg += " Cote modifiable (double-clic).";
  }
  int nS = 0;
  bool rebroussement = false;
  for (const std::string& id : splinesChoisies()) {
    BSpline f;
    const Entite e = *entite(id);
    if (!splineDe(s_, e, f)) continue;
    bool fait = false;
    decalerSpline(id, D, bsClosest(f, wx, wy, nullptr).s >= 0 ? 1 : -1, fait, rebroussement);
    if (fait) nS++;
  }
  if (nS) {
    char b[64];
    snprintf(b, sizeof b, "%d spline(s) décalée(s) de %.2f mm", nS, D);
    msg += std::string(msg.empty() ? "" : " ") + b + " (copie approchée à 0,005 mm, non associative)" + (rebroussement ? " : distance plus grande que le rayon de courbure, la copie se recoupe." : ".");
  }
  offsetD_ = D;
  structure_ = true;
  apresEdition();
  message(msg);
}

bool Dessin::distanceTapee(double& D) {
  const char* debut = dyn_.texte.data();
  const auto lu = std::from_chars(debut, debut + dyn_.texte.size(), D);
  if (lu.ec == std::errc() && D >= 0.001) return true;
  message("Décalage : distance invalide, retapez-la ou cliquez le côté.");
  dyn_ = Saisie{};
  return false;
}

void Dessin::validerDistance() {
  const std::vector<std::string> ids = choixDecalables();
  double D = 0;
  if ((ids.empty() && splinesChoisies().empty()) || !dyn_.actif || !distanceTapee(D)) return;
  appliquerDecalage(ids, D, curseurDecalage_.x, curseurDecalage_.y);
}

namespace {
struct Maillon {
  Entite e;
  bool fwd = true;
};
struct Chaine {
  std::vector<Maillon> ordre;
  bool fermee = false;
};
struct BoutsE {
  std::string a, b;
};
BoutsE boutsE(const Entite& e, bool fwd) {  // skEdgeEnds
  if (e.t == "line") return fwd ? BoutsE{e.p1, e.p2} : BoutsE{e.p2, e.p1};
  return fwd ? BoutsE{e.pa, e.pb} : BoutsE{e.pb, e.pa};
}
Pt normaleGauche(const Pt& A, const Pt& B) {  // skLeftNormal
  const double dx = B.x - A.x, dy = B.y - A.y, L0 = hyp(dx, dy), L = L0 != 0 ? L0 : 1e-9;
  return {-dy / L, dx / L};
}
bool dansAnneau(double x, double y, const std::vector<Pt>& ring) {  // pip
  bool inside = false;
  for (size_t i = 0, j = ring.size() - 1; i < ring.size(); j = i++) {
    const double xi = ring[i].x, yi = ring[i].y, xj = ring[j].x, yj = ring[j].y;
    if (((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
std::vector<Pt> droiteCercle(const Pt& P, const Pt& D, const Pt& C, double r) {  // lineCircleInt
  const double fx = P.x - C.x, fy = P.y - C.y;
  const double b = fx * D.x + fy * D.y, cc = fx * fx + fy * fy - r * r, disc = b * b - cc;
  if (disc < -1e-9) return {};
  const double s = std::sqrt(jsmax(disc, 0));
  return {{P.x + D.x * (-b + s), P.y + D.y * (-b + s)}, {P.x + D.x * (-b - s), P.y + D.y * (-b - s)}};
}
std::vector<Pt> cercleCercle(const Pt& C0, double r0, const Pt& C1, double r1) {  // circleCircleInt
  const double dx = C1.x - C0.x, dy = C1.y - C0.y, d = hyp(dx, dy);
  if (!(d > 1e-9) || d > r0 + r1 + 1e-9 || d < std::abs(r0 - r1) - 1e-9) return {};
  const double a = (r0 * r0 - r1 * r1 + d * d) / (2 * d), h = std::sqrt(jsmax(r0 * r0 - a * a, 0));
  const double xm = C0.x + dx * a / d, ym = C0.y + dy * a / d;
  return {{xm - dy * h / d, ym + dx * h / d}, {xm + dy * h / d, ym - dx * h / d}};
}
// skOffsetVal : écart signé de la source à la copie
bool valeurDecalage(const Esquisse& s, const std::string& aId, const std::string& bId, double& v) {
  const Entite* A = s.entite(aId);
  const Entite* B = s.entite(bId);
  if (!A || !B) return false;
  if (A->t == "line" && B->t == "line") {
    const Pt* A1 = s.point(A->p1);
    const Pt* A2 = s.point(A->p2);
    const Pt* B1 = s.point(B->p1);
    if (!A1 || !A2 || !B1) return false;
    const double dx = A2->x - A1->x, dy = A2->y - A1->y, L = hyp(dx, dy);
    if (!(L > 1e-9)) return false;
    v = (B1->x - A1->x) * (-dy / L) + (B1->y - A1->y) * (dx / L);
    return true;
  }
  if ((A->t == "circle" || A->t == "arc") && (B->t == "circle" || B->t == "arc")) {
    v = B->r - A->r;
    return true;
  }
  return false;
}
}  // namespace

bool Dessin::decalerElements(const std::vector<std::string>& ids0, double D, const Pt* S, std::string& msg) {
  if (!(D >= 0.001)) {
    msg = "Décalage : distance d'au moins 0,001 mm requise.";
    return false;
  }
  std::vector<Entite> ents;
  for (const std::string& id : ids0) {
    if (std::any_of(ents.begin(), ents.end(), [&](const Entite& x) { return x.id == id; })) continue;
    const Entite* e = s_.entite(id);
    if (e && (e->t == "line" || e->t == "circle" || e->t == "arc") && !e->ref) ents.push_back(*e);
  }
  if (ents.empty()) {
    msg = "Décalage : sélectionnez lignes, cercles ou arcs.";
    return false;
  }
  const auto memeBout = [&](const std::string& a, const std::string& b) {  // skSameEnd
    if (a == b) return true;
    return !a.empty() && !b.empty() && aContrainte([&](const Contrainte& c) { return c.type == "coincident" && ((c.a == a && c.b == b) || (c.a == b && c.b == a)); });
  };
  const auto jointMeme = [&](const std::string& a, const std::string& b) {  // skJointSame
    if (memeBout(a, b)) return true;
    if (a.empty() || b.empty()) return false;
    const Pt* pa = s_.point(a);
    const Pt* pb = s_.point(b);
    return pa && pb && hyp(pa->x - pb->x, pa->y - pb->y) < 1e-6;
  };
  // skOffsetChains
  std::vector<Entite> cand;
  for (const Entite& e : s_.entites)
    if ((e.t == "line" || e.t == "arc") && !e.ref && std::any_of(ents.begin(), ents.end(), [&](const Entite& x) { return x.id == e.id; })) cand.push_back(e);
  std::set<std::string> vus;
  std::vector<Chaine> chaines;
  const auto touche = [&](const Entite& e, const std::string& p) {
    const BoutsE b = boutsE(e, true);
    return jointMeme(b.a, p) || jointMeme(b.b, p);
  };
  for (;;) {
    const auto dep = std::find_if(cand.begin(), cand.end(), [&](const Entite& e) { return !vus.count(e.id); });
    if (dep == cand.end()) break;
    const Entite& start = *dep;
    const auto degre = [&](const std::string& p) {
      int n = 0;
      for (const Entite& e : cand)
        if (!vus.count(e.id) && touche(e, p)) n++;
      return n;
    };
    const BoutsE ss = boutsE(start, true);
    const std::string entree = degre(ss.a) <= 1 ? ss.a : ss.b;
    Chaine ch;
    ch.ordre.push_back({start, ss.a == entree});
    vus.insert(start.id);
    std::string sortie = ch.ordre[0].fwd ? ss.b : ss.a;
    for (;;) {
      const auto nx = std::find_if(cand.begin(), cand.end(), [&](const Entite& e) { return !vus.count(e.id) && touche(e, sortie); });
      if (nx == cand.end()) break;
      const BoutsE b = boutsE(*nx, true);
      const bool fwd = jointMeme(b.a, sortie);
      ch.ordre.push_back({*nx, fwd});
      vus.insert(nx->id);
      sortie = fwd ? b.b : b.a;
      if (jointMeme(sortie, entree)) {
        ch.fermee = true;
        break;
      }
    }
    chaines.push_back(std::move(ch));
  }

  const std::vector<Contrainte> cons0 = s_.contraintes;
  std::map<std::string, std::string> copieDe;
  std::vector<std::string> copies;
  int jointsBad = 0, faites = 0;
  const auto proche = [](const std::vector<Pt>& pts, const Pt& C, Pt& o) {
    bool ok = false;
    double bd = 1e9;
    for (const Pt& p : pts) {
      const double d = hyp(p.x - C.x, p.y - C.y);
      if (d < bd) {
        bd = d;
        o = p;
        ok = true;
      }
    }
    return ok;
  };
  const auto aParallele = [&](const std::string& a, const std::string& b) {
    return aContrainte([&](const Contrainte& c) { return c.type == "parallel" && ((c.a == a && c.b == b) || (c.a == b && c.b == a)); });
  };
  for (const Chaine& ch : chaines) {
    const size_t n = ch.ordre.size();
    double sg = 1;
    std::vector<Maillon> ordre = ch.ordre;
    if (ch.fermee) {
      std::vector<Pt> ring;
      for (const Maillon& o : ch.ordre)
        if (const Pt* q = s_.point(boutsE(o.e, o.fwd).b)) ring.push_back(*q);
      double aire = 0;
      for (size_t i = 0; i < ring.size(); i++) {
        const Pt& p = ring[i];
        const Pt& w = ring[(i + 1) % ring.size()];
        aire += p.x * w.y - w.x * p.y;
      }
      aire /= 2;
      const bool ext = S ? !dansAnneau(S->x, S->y, ring) : true;
      sg = ((aire > 0) == !ext) ? 1 : -1;
    } else if (S) {
      const BoutsE b = boutsE(ordre[0].e, ordre[0].fwd);
      const Pt* U = s_.point(b.a);
      const Pt* W = s_.point(b.b);
      if (U && W) {
        const double cr = (W->x - U->x) * (S->y - U->y) - (W->y - U->y) * (S->x - U->x);
        if (cr < 0) {
          std::reverse(ordre.begin(), ordre.end());
          for (Maillon& o : ordre) o.fwd = !o.fwd;
        }
      }
    }
    struct Joint {
      bool existe = false, force = false;
      std::string pid;
    };
    std::vector<Joint> joints(n);
    for (size_t i = 0; i < n; i++) {
      if (i == n - 1 && !ch.fermee) continue;
      const BoutsE la = boutsE(ordre[i].e, ordre[i].fwd), lb = boutsE(ordre[(i + 1) % n].e, ordre[(i + 1) % n].fwd);
      const std::string* L[2] = {&la.a, &la.b};
      const std::string* M[2] = {&lb.a, &lb.b};
      Joint& J = joints[i];
      for (int a = 0; a < 2 && !J.existe; a++)
        for (int b = 0; b < 2 && !J.existe; b++)
          if (*L[a] == *M[b]) J = {true, false, *L[a]};
      for (int a = 0; a < 2 && !J.existe; a++)
        for (int b = 0; b < 2 && !J.existe; b++)
          if (memeBout(*L[a], *M[b])) J = {true, true, *L[a]};
      if (!J.existe && jointMeme(la.b, lb.a)) J = {true, false, la.b};
    }
    struct Dec {
      bool ligne = false;
      Pt A, B, C;
      double r = 0;
    };
    std::vector<Dec> offs;
    bool bad = false;
    for (const Maillon& o : ordre) {
      const BoutsE b = boutsE(o.e, o.fwd);
      const Pt* A = s_.point(b.a);
      const Pt* B = s_.point(b.b);
      if (!A || !B) {
        bad = true;
        break;
      }
      Dec d;
      if (o.e.t == "line") {
        const Pt nn = normaleGauche(*A, *B);
        d.ligne = true;
        d.A = {A->x + sg * D * nn.x, A->y + sg * D * nn.y};
        d.B = {B->x + sg * D * nn.x, B->y + sg * D * nn.y};
      } else {
        const Pt* C = s_.point(o.e.pc);
        if (!C) {
          bad = true;
          break;
        }
        const double rr = o.e.r + sg * D * (o.fwd ? -1 : 1);
        if (!(rr > 0.5)) {
          bad = true;
          break;
        }
        d.C = *C;
        d.r = rr;
      }
      offs.push_back(d);
    }
    if (bad) continue;
    struct Fin {
      std::string pid, pid2;
      bool force = false;
    };
    std::vector<Fin> fins(n);
    for (size_t i = 0; i < n; i++) {
      if (i == n - 1 && !ch.fermee) break;
      const size_t nx = (i + 1) % n;
      const Joint& J0 = joints[i];
      const Pt* pC0 = J0.existe ? s_.point(J0.pid) : nullptr;
      const Dec& oi = offs[i];
      const Dec& oj = offs[nx];
      Pt M;
      bool aM = false;
      const Pt origine{0, 0};
      const Pt& repere = pC0 ? *pC0 : origine;
      struct Dr {
        Pt P, D;
      };
      const auto droiteDe = [](const Dec& o) {
        const double dx = o.B.x - o.A.x, dy = o.B.y - o.A.y, L0 = hyp(dx, dy), L = L0 != 0 ? L0 : 1e-9;
        return Dr{o.A, {dx / L, dy / L}};
      };
      if (oi.ligne && oj.ligne) {
        const Dr a = droiteDe(oi), b = droiteDe(oj);
        // segInter : le navigateur repasse par un second point de chaque droite, l'arrondi de ces soustractions compte
        const Pt P2{a.P.x + a.D.x, a.P.y + a.D.y}, P4{b.P.x + b.D.x, b.P.y + b.D.y};
        const double dx1 = P2.x - a.P.x, dy1 = P2.y - a.P.y, dx2 = P4.x - b.P.x, dy2 = P4.y - b.P.y;
        const double den = dx1 * dy2 - dy1 * dx2;
        if (std::abs(den) >= 1e-12) {
          const double t = ((b.P.x - a.P.x) * dy2 - (b.P.y - a.P.y) * dx2) / den;
          M = {a.P.x + dx1 * t, a.P.y + dy1 * t};
          aM = true;
        }
        if (!aM && pC0) {
          const Pt n1 = normaleGauche(oi.A, oi.B);
          M = {pC0->x + sg * D * n1.x, pC0->y + sg * D * n1.y};
          aM = true;
        }
      } else if (oi.ligne || oj.ligne) {
        const Dec& li = oi.ligne ? oi : oj;
        const Dec& ci = oi.ligne ? oj : oi;
        const Dr a = droiteDe(li);
        aM = proche(droiteCercle(a.P, a.D, ci.C, ci.r), repere, M);
        if (!aM && pC0) {  // jamais de trou : point commun approché
          const double dx = li.B.x - li.A.x, dy = li.B.y - li.A.y, L0 = dx * dx + dy * dy, L = L0 != 0 ? L0 : 1e-12;
          const double t = ((pC0->x - li.A.x) * dx + (pC0->y - li.A.y) * dy) / L;
          const double lx = li.A.x + dx * t, ly = li.A.y + dy * t;
          const double vx = pC0->x - ci.C.x, vy = pC0->y - ci.C.y, V0 = hyp(vx, vy), V = V0 != 0 ? V0 : 1e-12;
          const double cx = ci.C.x + vx / V * ci.r, cy = ci.C.y + vy / V * ci.r;
          M = {(lx + cx) / 2, (ly + cy) / 2};
          aM = true;
        }
      } else {
        aM = proche(cercleCercle(oi.C, oi.r, oj.C, oj.r), repere, M);
        if (!aM && pC0) {  // centres confondus : les rayons décalés à l'angle du joint
          const double vx = pC0->x - oi.C.x, vy = pC0->y - oi.C.y, V0 = hyp(vx, vy), V = V0 != 0 ? V0 : 1e-12;
          const Pt p1{oi.C.x + vx / V * oi.r, oi.C.y + vy / V * oi.r}, p2{oj.C.x + vx / V * oj.r, oj.C.y + vy / V * oj.r};
          M = {(p1.x + p2.x) / 2, (p1.y + p2.y) / 2};
          aM = true;
        }
      }
      if (!aM) {
        jointsBad++;
        continue;
      }
      fins[i].pid = ajouterPoint(M.x, M.y);
      if (J0.existe && J0.force) {  // source contrainte : deux points distincts au joint, liés par un coïncident
        fins[i].pid2 = ajouterPoint(M.x, M.y);
        fins[i].force = true;
      }
    }
    std::vector<std::string> copieIds(n);
    struct PaireD {
      std::string a, b;
      bool ligne;
    };
    std::vector<PaireD> paires;
    for (size_t i = 0; i < n; i++) {
      const Maillon& o = ordre[i];
      const Dec& off = offs[i];
      static const Fin finVide;
      const Fin& avantJ = ch.fermee ? fins[(i + n - 1) % n] : (i == 0 ? finVide : fins[i - 1]);
      const Fin& apresJ = ch.fermee ? fins[i] : (i == n - 1 ? finVide : fins[i]);
      const auto debut = [&](const Pt& p) {
        if (!avantJ.pid.empty()) {
          if (avantJ.force && !avantJ.pid2.empty() && !aContrainte([&](const Contrainte& c) { return c.type == "coincident" && ((c.a == avantJ.pid && c.b == avantJ.pid2) || (c.a == avantJ.pid2 && c.b == avantJ.pid)); })) {
            Contrainte k = contrainte("coincident");
            k.a = avantJ.pid;
            k.b = avantJ.pid2;
            lier(k);
          }
          return avantJ.pid2.empty() ? avantJ.pid : avantJ.pid2;
        }
        return ajouterPoint(p.x, p.y);
      };
      const auto fin = [&](const Pt& p) { return !apresJ.pid.empty() ? apresJ.pid : ajouterPoint(p.x, p.y); };
      Entite cp;
      cp.construction = o.e.construction;
      if (o.e.t == "line") {
        const std::string p1 = debut(off.A), p2 = fin(off.B);
        cp.id = nouvelE();
        cp.t = "line";
        cp.p1 = p1;
        cp.p2 = p2;
        const std::string nid = cp.id;
        s_.entites.push_back(std::move(cp));
        if (!aParallele(o.e.id, nid)) {
          Contrainte k = contrainte("parallel");
          k.a = o.e.id;
          k.b = nid;
          lier(k);
        }
        paires.push_back({o.e.id, nid, true});
        copies.push_back(nid);
        copieIds[i] = nid;
      } else {
        const std::string pA = debut(off.C), pB = fin(off.C);
        const auto poser = [&](const std::string& voulu, const Pt& reper) {
          const double a = m_atan2(reper.y - off.C.y, reper.x - off.C.x);
          Pt& q = s_.points.at(voulu);
          q = {off.C.x + off.r * m_cos(a), off.C.y + off.r * m_sin(a)};
        };
        const BoutsE src = boutsE(o.e, o.fwd);
        if (avantJ.pid.empty())
          if (const Pt* A0 = s_.point(src.a)) poser(pA, Pt(*A0));
        if (apresJ.pid.empty())
          if (const Pt* B0 = s_.point(src.b)) poser(pB, Pt(*B0));
        cp.id = nouvelE();
        cp.t = "arc";
        cp.pc = o.e.pc;
        cp.pa = o.fwd ? pA : pB;
        cp.pb = o.fwd ? pB : pA;
        cp.r = off.r;
        const std::string nid = cp.id;
        s_.entites.push_back(std::move(cp));
        paires.push_back({o.e.id, nid, false});
        copies.push_back(nid);
        copieIds[i] = nid;
      }
    }
    // Une cote par chaîne ; les autres paires suivent par la contrainte « décalage égal »
    const PaireD* refP = nullptr;
    for (const PaireD& p : paires)
      if (p.ligne) {
        refP = &p;
        break;
      }
    if (!refP && !paires.empty()) refP = &paires[0];
    if (refP) {
      Cote dc;
      dc.id = nouvelE();
      if (refP->ligne) {
        dc.type = "gap";
        dc.a = refP->a;
        dc.b = refP->b;
        dc.value = fixe(D, 3);
      } else {
        const Entite* cpE = s_.entite(refP->b);
        dc.type = "radius";
        dc.ent = refP->b;
        dc.value = fixe(cpE ? cpE->r : D, 3);
      }
      s_.cotes.push_back(std::move(dc));
      const auto signe = [&](const PaireD& p) {
        double v = 0;
        return valeurDecalage(s_, p.a, p.b, v) && v < 0 ? -1 : 1;
      };
      const int sa = signe(*refP);
      for (const PaireD& p : paires) {
        if (&p == refP) continue;
        Contrainte k = contrainte("offset");
        k.a = refP->a;
        k.b = refP->b;
        k.c = p.a;
        k.d = p.b;
        k.sa = sa;
        k.sb = signe(p);
        lier(k);
      }
    }
    for (const PaireD& p : paires) copieDe[p.a] = p.b;
    // Une tangence de la source se retrouve entre les copies
    for (size_t i = 0; i < n; i++) {
      if (!joints[i].existe) continue;
      const size_t nx = (i + 1) % n;
      const Entite& ea = ordre[i].e;
      const Entite& eb = ordre[nx].e;
      if (!((ea.t == "line" && eb.t == "arc") || (ea.t == "arc" && eb.t == "line"))) continue;
      const std::string& lid = ea.t == "line" ? copieIds[i] : copieIds[nx];
      const std::string& eid = ea.t == "arc" ? copieIds[i] : copieIds[nx];
      if (lid.empty() || eid.empty()) continue;
      const auto aTangence = [&](const std::string& l, const std::string& e) {
        return aContrainte([&](const Contrainte& c) { return c.type == "tangent" && ((c.line == l && c.ent == e) || (c.line == e && c.ent == l)); });
      };
      if (aTangence(ea.id, eb.id) && !aTangence(lid, eid)) {
        Contrainte k = contrainte("tangent");
        k.line = lid;
        k.ent = eid;
        lier(k);
      }
    }
    faites++;
  }
  // Les contraintes de la source se retrouvent entre les copies : la copie garde sa forme sans cote de plus
  if (!copieDe.empty())
    for (const Contrainte& c : cons0) {
      if ((c.type == "h" || c.type == "v") && copieDe.count(c.line)) {
        const std::string l = copieDe.at(c.line);
        if (!aHV(l, c.type.c_str())) {
          Contrainte k = contrainte(c.type.c_str());
          k.line = l;
          lier(k);
        }
      } else if ((c.type == "parallel" || c.type == "perpendicular" || c.type == "collinear") && copieDe.count(c.a) && copieDe.count(c.b)) {
        const std::string a = copieDe.at(c.a), b = copieDe.at(c.b);
        if (!aContrainte([&](const Contrainte& k) { return k.type == c.type && ((k.a == a && k.b == b) || (k.a == b && k.b == a)); })) {
          Contrainte k = contrainte(c.type.c_str());
          k.a = a;
          k.b = b;
          lier(k);
        }
      }
    }
  for (const Entite& e : ents) {
    if (e.t != "circle") continue;
    const Pt* C = s_.point(e.pc);
    if (!C) continue;
    const double rr = e.r + (!S || hyp(S->x - C->x, S->y - C->y) >= e.r ? 1 : -1) * D;
    if (!(rr > 0.5)) {
      jointsBad++;
      continue;
    }
    Entite cp;
    cp.id = nouvelE();
    cp.t = "circle";
    cp.pc = e.pc;
    cp.r = rr;
    cp.construction = e.construction;
    const std::string nid = cp.id;
    s_.entites.push_back(std::move(cp));
    Cote dc;
    dc.id = nouvelE();
    dc.type = "radius";
    dc.ent = nid;
    dc.value = fixe(rr, 3);
    s_.cotes.push_back(std::move(dc));
    copies.push_back(nid);
  }
  if (copies.empty()) {
    msg = "Décalage impossible (arcs trop petits ou joints non résolus).";
    return false;
  }
  char b[160];
  snprintf(b, sizeof b, "Décalage de %.2f mm : %d copiée(s)", D, static_cast<int>(copies.size()));
  msg = b;
  if (faites > 1) msg += " en " + std::to_string(faites) + " chaînes";
  if (jointsBad) msg += ", " + std::to_string(jointsBad) + " joint(s) non raccordé(s)";
  msg += ".";
  return true;
}

// ---------- Spline (src/50-esquisse-6-spline.js) ----------
std::vector<std::string> Dessin::pidsSpline(const Entite& e) const {
  std::vector<std::string> v = e.pts;
  std::vector<std::pair<std::string, std::string>> m;
  for (const Entite& l : s_.entites) {
    if (l.t != "line" || l.handle != e.id || l.p1.empty() || l.p2.empty()) continue;
    const auto it = std::find_if(m.begin(), m.end(), [&](const auto& x) { return x.first == l.p1; });
    if (it != m.end()) it->second = l.p2;
    else m.push_back({l.p1, l.p2});
  }
  for (const auto& x : m) v.push_back(x.second);
  return v;
}

const Entite* Dessin::lignePoignee(const Entite& S, const std::string& pid) const {
  for (const Entite& l : s_.entites)
    if (l.t == "line" && l.handle == S.id && l.p1 == pid) return &l;
  return nullptr;
}

bool Dessin::paramSpline(const Entite& e, const std::string& pid, double& u) const {
  BSpline f;
  const auto it = std::find(e.pts.begin(), e.pts.end(), pid);
  if (it == e.pts.end() || !splineDe(s_, e, f)) return false;
  const size_t k = it - e.pts.begin();
  if (!f.ctrl) {
    u = f.u[k];
    return true;
  }
  if (f.closed) return false;
  if (k == 0) u = f.a;
  else if (k == e.pts.size() - 1) u = f.b;
  else return false;
  return true;
}

std::string Dessin::pointTangente(const Entite& e, const std::string& pid) const {
  if (e.t != "spline") return "";
  if (e.mode == "ctrl") {
    if (e.closed || e.pts.size() < 2) return "";
    const size_t n = e.pts.size() - 1;
    return pid == e.pts[0] ? e.pts[1] : pid == e.pts[n] ? e.pts[n - 1] : "";
  }
  const Entite* l = lignePoignee(e, pid);
  return l ? l->p2 : "";
}

bool Dessin::tangenteSpline(const Entite& e, const std::string& pid, double& x, double& y) const {
  BSpline f;
  double u;
  if (!splineDe(s_, e, f) || !paramSpline(e, pid, u)) return false;
  const P2d d = bsEval(f, u, 1)[1];
  const double L = hyp(d[0], d[1]);
  if (!(L > 1e-12)) return false;
  x = d[0] / L;
  y = d[1] / L;
  return true;
}

bool Dessin::versLInterieur(const Entite& ent, const std::string& pid, double& x, double& y) const {
  const Pt* Q = s_.point(pid);
  if (!Q) return false;
  const auto unit = [&](double a, double b) {
    const double L = hyp(a, b);
    if (!(L > 1e-12)) return false;
    x = a / L;
    y = b / L;
    return true;
  };
  if (ent.t == "line") {
    const Pt* o = ent.p1 == pid ? s_.point(ent.p2) : ent.p2 == pid ? s_.point(ent.p1) : nullptr;
    return o && unit(o->x - Q->x, o->y - Q->y);
  }
  if (ent.t == "arc") {
    const Pt* C = s_.point(ent.pc);
    if (!C) return false;
    const double rx = Q->x - C->x, ry = Q->y - C->y;
    if (ent.pa == pid) return unit(-ry, rx);
    if (ent.pb == pid) return unit(ry, -rx);
    return false;
  }
  if (ent.t == "spline") {
    const auto it = std::find(ent.pts.begin(), ent.pts.end(), pid);
    if (it == ent.pts.end() || ent.closed || !tangenteSpline(ent, pid, x, y)) return false;
    if (it == ent.pts.begin()) return true;
    if (it - ent.pts.begin() == static_cast<long long>(ent.pts.size()) - 1) {
      x = -x;
      y = -y;
      return true;
    }
    return false;
  }
  return false;
}

std::string Dessin::ajouterPoignee(const std::string& idS, const std::string& pid) {
  const Entite* S = s_.entite(idS);
  if (!S || S->mode == "ctrl") return "";
  if (const Entite* ex = lignePoignee(*S, pid)) return ex->id;
  BSpline f;
  const auto it = std::find(S->pts.begin(), S->pts.end(), pid);
  const Pt* P = s_.point(pid);
  if (!splineDe(s_, *S, f) || it == S->pts.end() || !P) return "";
  const int k = static_cast<int>(it - S->pts.begin()), n = f.n;
  const P2d der = bsEval(f, f.u[k], 1)[1];
  double dl;
  if (!S->closed && k == 0) {
    dl = -f.d[1] / 3;
  } else if (!S->closed && k == n) {
    dl = f.d[n] / 3;
  } else {
    const double dp = k > 0 ? f.d[k] : f.d[n], dn = k < n ? f.d[k + 1] : f.d[1];
    dl = (dp + dn) / 6;
  }
  double hx = P->x + der[0] * dl, hy = P->y + der[1] * dl;
  if (!(hyp(hx - P->x, hy - P->y) > 1e-6)) {
    hx = P->x + 1;
    hy = P->y;
  }
  const std::string hp = ajouterPoint(hx, hy);
  Entite l;
  l.id = nouvelE();
  l.t = "line";
  l.p1 = pid;
  l.p2 = hp;
  l.construction = true;
  l.handle = idS;
  l.poignee = true;
  const std::string id = l.id;
  s_.entites.push_back(std::move(l));
  structure_ = true;
  return id;
}

void Dessin::retirerPoignee(const std::string& idS, const std::string& pid) {
  const Entite* S = s_.entite(idS);
  if (!S) return;
  const Entite* l = lignePoignee(*S, pid);
  if (!l) return;
  const std::string id = l->id;
  s_.entites.erase(std::remove_if(s_.entites.begin(), s_.entites.end(), [&](const Entite& x) { return x.id == id; }), s_.entites.end());
  s_.contraintes.erase(std::remove_if(s_.contraintes.begin(), s_.contraintes.end(), [&](const Contrainte& c) { return c.type == "stangent" && c.p == pid && (c.s == idS || c.ent == idS); }), s_.contraintes.end());
  structure_ = true;
}

std::string Dessin::tangenteVers(const std::string& idS, const std::string& idO, const std::string& pid) {
  const Entite S = *s_.entite(idS);
  const Entite O = *s_.entite(idO);
  if (S.t != "spline" || O.id == S.id) return "Tangence spline : choisissez une autre courbe.";
  if (std::find(S.pts.begin(), S.pts.end(), pid) == S.pts.end()) return "Tangence spline : le point n'est pas un point de passage de la spline.";
  const char* bouts = "Spline par points de contrôle : tangence à son premier ou dernier pôle seulement, les autres ne sont pas sur la courbe.";
  double u;
  if (S.mode == "ctrl" && !paramSpline(S, pid, u)) return bouts;
  if (aContrainte([&](const Contrainte& c) { return c.type == "stangent" && c.s == idS && c.p == pid && c.ent == idO; })) return "Tangence déjà posée.";
  if (O.t == "spline") {
    if (std::find(O.pts.begin(), O.pts.end(), pid) == O.pts.end()) return "Tangence entre splines : elles doivent partager ce point (joignez-les d'abord, F1).";
    if (O.mode == "ctrl" && !paramSpline(O, pid, u)) return bouts;
    ajouterPoignee(idO, pid);
  } else if (O.t == "line") {
    if (O.p1 != pid && O.p2 != pid && !aContrainte([&](const Contrainte& c) { return c.type == "online" && c.p == pid && c.line == idO; })) {
      Contrainte c = contrainte("online");
      c.p = pid;
      c.line = idO;
      lier(c);
    }
  } else if (O.t == "circle" || O.t == "arc") {
    if (O.pa != pid && O.pb != pid && !aContrainte([&](const Contrainte& c) { return c.type == "oncircle" && c.p == pid && c.ent == idO; })) {
      Contrainte c = contrainte("oncircle");
      c.p = pid;
      c.ent = idO;
      lier(c);
    }
  } else {
    return "Tangence spline : ligne, cercle, arc ou spline.";
  }
  ajouterPoignee(idS, pid);
  if (pointTangente(*s_.entite(idS), pid).empty() || !s_.point(pid)) return "Tangence spline : poignée impossible.";
  Contrainte c = contrainte("stangent");
  c.s = idS;
  c.p = pid;
  c.ent = idO;
  lier(c);
  return "";
}

std::string Dessin::courbureVers(const std::string& idS, const std::string& idO, const std::string& pid) {
  if (aContrainte([&](const Contrainte& c) { return c.type == "scurv" && c.s == idS && c.p == pid && c.ent == idO; })) return "Courbure (G2) déjà posée.";
  if (!aContrainte([&](const Contrainte& c) { return c.type == "stangent" && c.s == idS && c.p == pid && c.ent == idO; })) {
    const std::string r = tangenteVers(idS, idO, pid);
    if (!r.empty()) return r;
  }
  Contrainte c = contrainte("scurv");
  c.s = idS;
  c.p = pid;
  c.ent = idO;
  lier(c);
  return "";
}

std::string Dessin::jointSpline(const Entite& S, const Entite& O) const {
  std::vector<std::string> bouts = S.pts;
  if (!S.closed && !S.pts.empty()) bouts = {S.pts.front(), S.pts.back()};
  const std::vector<std::string> vo = ptsEntite(O);
  for (const std::string& p : bouts)
    if (std::find(vo.begin(), vo.end(), p) != vo.end()) return p;
  for (const std::string& p : S.pts)
    if (std::find(vo.begin(), vo.end(), p) != vo.end()) return p;
  std::string best;
  double bd = 1e308;
  for (const std::string& p : bouts) {
    const Pt* q = s_.point(p);
    if (!q) continue;
    double d = 1e308;
    if (O.t == "line") {
      const Pt* A = s_.point(O.p1);
      const Pt* B = s_.point(O.p2);
      if (A && B) d = distSeg(q->x, q->y, *A, *B);
    } else if (O.t == "circle" || O.t == "arc") {
      if (const Pt* C = s_.point(O.pc)) d = std::abs(hyp(q->x - C->x, q->y - C->y) - O.r);
    }
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return O.t == "spline" ? "" : best;
}

int Dessin::tangentesAuto(const std::string& idS) {
  const Entite S0 = *s_.entite(idS);
  if (S0.closed) return 0;
  int n = 0;
  const std::vector<std::string> bouts{S0.pts.front(), S0.pts.back()};
  for (const std::string& pid : bouts) {
    const Entite S = *s_.entite(idS);
    double ox, oy;
    if (!tangenteSpline(S, pid, ox, oy)) continue;
    const auto it = std::find(S.pts.begin(), S.pts.end(), pid);
    if (!S.closed && it == S.pts.begin()) {  // skSplineOutward : vers l'extérieur
      ox = -ox;
      oy = -oy;
    }
    std::string best;
    double bc = m_cos(20 * PI_ / 180);
    for (const Entite& o : s_.entites) {
      if (o.id == idS || o.construction || o.poignee) continue;
      double vx, vy;
      if (!versLInterieur(o, pid, vx, vy)) continue;
      const double c = ox * vx + oy * vy;
      if (c > bc) {
        bc = c;
        best = o.id;
      }
    }
    if (!best.empty() && tangenteVers(idS, best, pid).empty()) n++;
  }
  return n;
}

std::string Dessin::validerSpline(const std::vector<ClicSpline>& d, bool ferme, bool ctrl) {
  std::vector<std::string> pids, libres;
  for (const ClicSpline& q : d) {
    const bool vise = !q.pid.empty() && s_.point(q.pid);
    const std::string pid = vise ? q.pid : ctrl ? ajouterPoint(q.x, q.y) : pointAccroche(q.x, q.y);  // pôle : jamais posé sur un milieu
    if (pids.empty() || pids.back() != pid) {
      pids.push_back(pid);
      if (!vise) libres.push_back(pid);
    }
  }
  if (ferme && pids.size() > 1 && pids.back() == pids.front()) pids.pop_back();
  if (pids.size() < 2 || (ferme && pids.size() < 3)) return "";
  Entite e;
  e.id = nouvelE();
  e.t = "spline";
  e.pts = pids;
  if (ctrl) e.mode = "ctrl";
  e.closed = ferme;
  const std::string id = e.id;
  s_.entites.push_back(std::move(e));
  structure_ = true;
  for (const std::string& pid : libres) {  // pôles intérieurs : hors de la courbe, jamais attachés
    if (ctrl && pid != pids.front() && pid != pids.back()) continue;
    if (const Pt* q = s_.point(pid)) {
      const Pt c = *q;
      accrocher(pid, c.x, c.y, -1);
    }
  }
  tangentesAuto(id);
  return id;
}

std::vector<P2d> Dessin::apercuSpline(const std::vector<ClicSpline>& d, const Pt* cur, bool ferme, bool ctrl) const {
  std::vector<P2d> U;
  const auto ajoute = [&](double x, double y) {
    if (U.empty() || hyp(x - U.back()[0], y - U.back()[1]) > 1e-9) U.push_back({x, y});
  };
  for (const ClicSpline& q : d) ajoute(q.x, q.y);
  if (cur) ajoute(cur->x, cur->y);
  if (U.size() < 2) return {};
  const bool cl = ferme && U.size() >= 3;
  BSpline f;
  const std::vector<P2d> H(U.size(), P2d{0, 0});
  const std::vector<char> A(U.size(), 0);
  if (!(ctrl ? bsControl(U, cl, nullptr, 0, f) : bsInterpolate(U, H, A, cl, f))) return {};
  return bsSample(f, f.a, f.b, 16);
}

void Dessin::finirTraceSpline(bool ferme) {
  const std::vector<ClicSpline> d = spl_;
  const bool ctrl = outil_ == CSPLINE;
  spl_.clear();
  splActif_ = false;
  brouillon_ = Brouillon{};
  aMarque_ = false;
  const char* quoi = ctrl ? "pôles" : "points de passage";
  if (d.size() < 2) return message(std::string("Spline : cliquez au moins 2 ") + quoi + ".");
  pousser();
  const std::string id = validerSpline(d, ferme, ctrl);
  if (id.empty()) {
    if (annulerPas) annulerPas();
    return message("Spline : points confondus, rien de créé.");
  }
  int nT = 0;
  for (const Contrainte& c : s_.contraintes)
    if (c.type == "stangent" && c.s == id) nT++;
  const size_t nb = s_.entite(id)->pts.size();
  apresEdition();
  message(std::string("Spline ") + (ferme ? "fermée " : "") + "créée (" + std::to_string(nb) + " " + quoi + ")" + (nT ? ", " + std::to_string(nT) + " bout(s) tangent(s)" : "") + (ctrl ? ". Glissez les pôles pour modeler la courbe." : ". Glissez les points ; clic droit sur un point : poignée de tangence.") + " Cliquez pour une nouvelle spline.");
}

bool Dessin::finirSpline() {
  if ((outil_ != SPLINE && outil_ != CSPLINE) || !splActif_) return false;
  finirTraceSpline(false);
  return true;
}

void Dessin::clicSpline(double wx, double wy) {
  const Accroche a = accroche(wx, wy);
  double x = wx, y = wy;
  if (a) {
    x = a.x;
    y = a.y;
  } else if (grille) {
    x = surGrille(x);
    y = surGrille(y);
  }
  splActif_ = true;
  const double tol = 6 / echelle_;
  const bool ctrl = outil_ == CSPLINE;
  if (spl_.size() >= 3 && hyp(x - spl_[0].x, y - spl_[0].y) < tol) return finirTraceSpline(true);
  if (!spl_.empty() && hyp(x - spl_.back().x, y - spl_.back().y) < tol) return finirTraceSpline(false);
  ClicSpline c;
  c.x = x;
  c.y = y;
  if (a.sorte == Accroche::POINT) c.pid = a.id;
  spl_.push_back(c);
  brouillon_ = Brouillon{};
  brouillon_.sorte = Brouillon::B_SPLINE;
  brouillon_.ctrl = ctrl;
  for (const ClicSpline& q : spl_) brouillon_.clics.push_back(Pt{q.x, q.y});
  brouillon_.courbe = apercuSpline(spl_, nullptr, false, ctrl);
  message("Spline : " + std::to_string(spl_.size()) + (ctrl ? " pôle(s)" : " point(s)") + ". Clic : suivant. Double-clic, Entrée ou clic droit : fin. Clic sur le 1er : fermée.");
}

void Dessin::bougerSpline(double wx, double wy) {
  const Accroche a = accroche(wx, wy);
  double x = wx, y = wy;
  if (a) {
    x = a.x;
    y = a.y;
    aMarque_ = true;
    marque_ = {x, y};
  } else {
    aMarque_ = false;
    if (grille) {
      x = surGrille(x);
      y = surGrille(y);
    }
  }
  if (!splActif_ || spl_.empty()) return;
  const bool ctrl = outil_ == CSPLINE, proche = spl_.size() >= 3 && hyp(x - spl_[0].x, y - spl_[0].y) < 6 / echelle_;
  const Pt cur{x, y};
  brouillon_ = Brouillon{};
  brouillon_.sorte = Brouillon::B_SPLINE;
  brouillon_.ctrl = ctrl;
  for (const ClicSpline& q : spl_) brouillon_.clics.push_back(Pt{q.x, q.y});
  brouillon_.aCurseur = !proche;
  brouillon_.curseur = cur;
  brouillon_.fermeture = proche;
  brouillon_.courbe = apercuSpline(spl_, proche ? nullptr : &cur, proche, ctrl);
}

bool Dessin::attacherSpline(const std::string& pid, double x, double y, double tol) {
  std::string best;
  double bd = tol;
  for (const Entite& e : s_.entites) {
    if (e.t != "spline" || std::find(e.pts.begin(), e.pts.end(), pid) != e.pts.end()) continue;
    BSpline f;
    if (!splineDe(s_, e, f)) continue;
    const PiedSpline h = bsClosest(f, x, y, nullptr);
    if (h.d < bd) {
      bd = h.d;
      best = e.id;
    }
  }
  if (best.empty() || aContrainte([&](const Contrainte& c) { return c.type == "onspline" && c.p == pid && c.ent == best; })) return false;
  Contrainte c = contrainte("onspline");
  c.p = pid;
  c.ent = best;
  lier(c);
  return true;
}

void Dessin::nettoyerSplines() {
  bool une = false;
  for (Entite& e : s_.entites) {
    if (e.t != "spline") continue;
    une = true;
    const size_t n = e.pts.size();
    e.pts.erase(std::remove_if(e.pts.begin(), e.pts.end(), [&](const std::string& q) { return !s_.point(q); }), e.pts.end());
    if (e.pts.size() != n) structure_ = true;
    if (e.closed && e.pts.size() < 3) {
      e.closed = false;
      structure_ = true;
    }
  }
  bool poignee = false;
  for (const Entite& e : s_.entites) poignee = poignee || e.poignee;
  if (!une && !poignee) return;
  const size_t n = s_.entites.size();
  std::map<std::string, const Entite*> parId;
  for (const Entite& e : s_.entites)
    if (e.t == "spline") parId[e.id] = &e;
  std::vector<Entite> garde;
  for (const Entite& e : s_.entites) {
    if (e.t == "spline" && e.pts.size() < 2) continue;
    if (e.t == "line" && !e.handle.empty()) {
      const auto it = parId.find(e.handle);
      if (it == parId.end() || it->second->pts.size() < 2 || std::find(it->second->pts.begin(), it->second->pts.end(), e.p1) == it->second->pts.end()) continue;
    }
    garde.push_back(e);
  }
  if (garde.size() != n) {
    s_.entites = std::move(garde);
    structure_ = true;
    sync();
  }
}

std::vector<Pt> Dessin::croiseSpline(const Entite& e, const Entite& o, std::vector<double>* us) const {
  std::vector<Pt> out;
  BSpline f;
  if (o.id == e.id || !splineDe(s_, e, f)) return out;
  const auto pousse = [&](double u) {
    const P2d c = bsEval(f, u, 0)[0];
    for (const Pt& h : out)
      if (hyp(h.x - c[0], h.y - c[1]) < 1e-6) return;
    out.push_back(Pt{c[0], c[1]});
    if (us) us->push_back(u);
  };
  if (o.t == "line") {
    const Pt* A = s_.point(o.p1);
    const Pt* B = s_.point(o.p2);
    if (!A || !B) return out;
    const double dx = B->x - A->x, dy = B->y - A->y, L = hyp(dx, dy);
    if (!(L > 1e-9)) return out;
    const double nx = -dy / L, ny = dx / L;
    for (const double u : bsRoots(f, [&](double t) {
           const P2d c = bsEval(f, t, 0)[0];
           return (c[0] - A->x) * nx + (c[1] - A->y) * ny;
         })) {
      const P2d c = bsEval(f, u, 0)[0];
      const double t = ((c[0] - A->x) * dx + (c[1] - A->y) * dy) / (L * L);
      if (t > -1e-6 && t < 1 + 1e-6) pousse(u);
    }
  } else if (o.t == "circle" || o.t == "arc") {
    const Pt* C = s_.point(o.pc);
    if (!C || !(o.r > 0)) return out;
    An an;
    if (o.t == "arc" && !anglesArc2(s_, o, an)) return out;
    for (const double u : bsRoots(f, [&](double t) {
           const P2d c = bsEval(f, t, 0)[0];
           return hyp(c[0] - C->x, c[1] - C->y) - o.r;
         })) {
      const P2d c = bsEval(f, u, 0)[0];
      if (o.t == "arc" && !dansArc(m_atan2(c[1] - C->y, c[0] - C->x), an.a1, an.a2 + 1e-6)) continue;
      pousse(u);
    }
  } else if (o.t == "spline") {
    BSpline g;
    if (!splineDe(s_, o, g)) return out;
    const auto S1 = bsSampleU(f, f.a, f.b, 12), S2 = bsSampleU(g, g.a, g.b, 12);
    for (size_t i = 0; i + 1 < S1.size(); i++)
      for (size_t j = 0; j + 1 < S2.size(); j++) {
        Coupe h;
        if (!croiseDroites(Pt{S1[i].x, S1[i].y}, Pt{S1[i + 1].x, S1[i + 1].y}, Pt{S2[j].x, S2[j].y}, Pt{S2[j + 1].x, S2[j + 1].y}, h) || h.t < -1e-9 || h.t > 1 + 1e-9 || h.u < -1e-9 || h.u > 1 + 1e-9) continue;
        double u = S1[i].u + h.t * (S1[i + 1].u - S1[i].u), v = S2[j].u + h.u * (S2[j + 1].u - S2[j].u);
        for (int it = 0; it < 15; it++) {  // Newton : C1(u) = C2(v)
          const auto D1 = bsEval(f, u, 1), D2 = bsEval(g, v, 1);
          const double rx = D1[0][0] - D2[0][0], ry = D1[0][1] - D2[0][1];
          const double a = D1[1][0], b = -D2[1][0], c = D1[1][1], d = -D2[1][1], det = a * d - b * c;
          if (std::abs(det) < 1e-18) break;
          const double du = (d * rx - b * ry) / det, dv = (-c * rx + a * ry) / det;
          u = jsmin(f.b, jsmax(f.a, u - du));
          v = jsmin(g.b, jsmax(g.a, v - dv));
          if (std::abs(du) + std::abs(dv) < 1e-13) break;
        }
        const P2d c1 = bsEval(f, u, 0)[0], c2 = bsEval(g, v, 0)[0];
        if (hyp(c1[0] - c2[0], c1[1] - c2[1]) < 1e-6) pousse(u);
      }
  }
  return out;
}

std::string Dessin::pointCoupeTol(double x, double y) {
  const double tol = jsmin(0.5, SNAP_ * 0.5);
  std::string best;
  double bd = tol;
  for (const std::string& q : s_.ordre) {
    const Pt& p = s_.points.at(q);
    const double d = hyp(p.x - x, p.y - y);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return !best.empty() ? best : ajouterPoint(x, y);
}

Entite Dessin::splineDepuis(const Entite& src, const BSpline& bs, const std::string& pa, const std::string& pb) {
  const size_t n = bs.P.size() - 1;
  const double U0 = bs.U[0], e0 = bs.U.back() - U0, sc = e0 != 0 ? e0 : 1;
  Entite e;
  for (size_t i = 0; i <= n; i++) {
    const P2d& q = bs.P[i];
    if (i == 0 && !pa.empty()) {
      if (s_.point(pa)) s_.points[pa] = Pt{q[0], q[1]};
      e.pts.push_back(pa);
    } else if (i == n && !pb.empty()) {
      if (s_.point(pb)) s_.points[pb] = Pt{q[0], q[1]};
      e.pts.push_back(pb);
    } else {
      e.pts.push_back(ajouterPoint(q[0], q[1]));
    }
  }
  e.id = nouvelE();
  e.t = "spline";
  e.mode = "ctrl";
  for (const double v : bs.U) e.knots.push_back(fixe((v - U0) / sc, 12));
  e.deg = bs.p;
  e.construction = src.construction;
  return e;
}

std::string Dessin::ajusterSpline(const std::string& id, double cx, double cy) {
  const Entite ent = *entite(id);
  BSpline f;
  if (!splineDe(s_, ent, f)) return "Spline invalide.";
  const std::vector<std::string>& ids = ent.pts;
  const double eps = 1e-7 * (f.b - f.a);
  std::vector<double> hu;
  for (const Pt& h : croisements(ent)) {
    const PiedSpline c = bsClosest(f, h.x, h.y, nullptr);
    if (c.d < 1e-4 && std::none_of(hu.begin(), hu.end(), [&](double u) { return std::abs(u - c.u) < eps; })) hu.push_back(c.u);
  }
  std::sort(hu.begin(), hu.end());
  std::vector<double> inner;
  for (const double u : hu)
    if (u > f.a + eps && u < f.b - eps) inner.push_back(u);
  if (inner.empty() && !(!hu.empty() && !f.closed)) return "Aucune intersection : rien à ajuster.";
  const double uc = bsClosest(f, cx, cy, nullptr).u;
  const auto pt = [&](double u) { return bsEval(f, u, 0)[0]; };
  std::vector<std::string> coupes;
  const auto pointDe = [&](double u) {
    const P2d c = pt(u);
    const std::string pid = pointCoupeTol(c[0], c[1]);
    if (std::find(ids.begin(), ids.end(), pid) == ids.end()) coupes.push_back(pid);
    return pid;
  };
  struct Morceau {
    BSpline bs;
    std::string pa, pb;
  };
  std::vector<Morceau> pieces;
  const bool boucle = f.closed || ids.front() == ids.back();
  if (!boucle) {
    double lo = f.a, hi = f.b;
    for (const double u : inner) {
      if (u < uc) lo = u;
      else if (u > uc && hi == f.b) hi = u;
    }
    if (lo <= f.a + eps && hi >= f.b - eps) {
      s_.entites.erase(std::remove_if(s_.entites.begin(), s_.entites.end(), [&](const Entite& x) { return x.id == id; }), s_.entites.end());
      return "Spline retirée.";
    }
    if (lo > f.a + eps) {
      const std::string pb = pointDe(lo);
      const P2d q = pt(lo);
      pieces.push_back({bsRange(f, f.a, lo, nullptr, &q), ids.front(), pb});
    }
    if (hi < f.b - eps) {
      const std::string pa = pointDe(hi);
      const P2d q = pt(hi);
      pieces.push_back({bsRange(f, hi, f.b, &q, nullptr), pa, ids.back()});
    }
  } else {
    if (inner.size() < 2 && !(inner.size() == 1 && !(f.ctrl && f.closed))) return "Spline fermée : il faut deux intersections pour ajuster.";
    std::vector<double> cuts = inner;
    if (cuts.size() == 1) cuts.push_back(f.a);  // une seule coupe : le point de départ sert de 2e bout
    std::sort(cuts.begin(), cuts.end());
    bool aLo = false, aHi = false;
    double lo = 0, hi = 0;
    for (const double u : cuts) {
      if (u < uc) {
        lo = u;
        aLo = true;
      } else if (u > uc && !aHi) {
        hi = u;
        aHi = true;
      }
    }
    if (!aLo || !aHi) {  // tronçon à cheval sur le départ : on garde [premier, dernier]
      const double u0 = cuts.front(), u1 = cuts.back();
      if (!(u1 - u0 > eps)) return "Rien à ajuster ici.";
      const P2d q0 = pt(u0), q1 = pt(u1);
      const BSpline bs = bsRange(f, u0, u1, &q0, &q1);
      const std::string pa = pointDe(u0), pb = pointDe(u1);
      pieces.push_back({bs, pa, pb});
    } else {  // garde [hi, b] + [a, lo], raccordés au départ de la boucle
      const bool aA = hi < f.b - eps, aB = lo > f.a + eps;
      if (!aA && !aB) return "Rien à ajuster ici.";
      const P2d qh = pt(hi), qb = pt(f.b), qa = pt(f.a), ql = pt(lo);
      BSpline A, B;
      if (aA) A = bsRange(f, hi, f.b, &qh, &qb);
      if (aB) B = bsRange(f, f.a, lo, &qa, &ql);
      const BSpline bs = aA && aB ? bsJoin(A, B) : aA ? A : B;
      const std::string pa = pointDe(hi), pb = pointDe(lo);
      pieces.push_back({bs, pa, pb});
    }
  }
  std::vector<Entite> neuves;
  for (const Morceau& q : pieces) neuves.push_back(splineDepuis(ent, q.bs, q.pa, q.pb));
  // Les contraintes qui visaient l'ancienne spline vont au morceau qui porte le point ; « Fixe » sur chaque morceau
  const auto duPoint = [&](const std::string& pid) -> const Entite* {
    for (const Entite& n : neuves)
      if (n.pts.front() == pid || n.pts.back() == pid) return &n;
    return nullptr;
  };
  std::vector<Contrainte> ajouts;
  for (Contrainte& c : s_.contraintes) {
    if (c.type == "fix" && c.ent == id) {
      for (size_t i = 0; i < neuves.size(); i++) {
        if (i == 0) {
          c.ent = neuves[0].id;
        } else {
          Contrainte k = c;
          k.id = nouvelE();
          k.ent = neuves[i].id;
          ajouts.push_back(k);
        }
      }
      continue;
    }
    if (c.type == "stangent" || c.type == "scurv") {
      if (const Entite* n = duPoint(c.p)) {
        if (c.s == id) c.s = n->id;
        if (c.ent == id) c.ent = n->id;
      }
    }
    if (c.type == "onspline" && c.ent == id) {
      if (const Pt* Q = s_.point(c.p)) {
        for (const Entite& m : neuves) {
          BSpline g;
          if (splineDe(s_, m, g) && bsClosest(g, Q->x, Q->y, nullptr).d < 1e-3) {
            c.ent = m.id;
            break;
          }
        }
      }
    }
  }
  for (const Contrainte& k : ajouts) s_.contraintes.push_back(k);
  s_.entites.erase(std::remove_if(s_.entites.begin(), s_.entites.end(), [&](const Entite& x) { return x.id == id; }), s_.entites.end());
  for (Entite& n : neuves) s_.entites.push_back(std::move(n));
  structure_ = true;
  for (const std::string& pid : coupes)
    if (const Pt* Q = s_.point(pid)) {
      const Pt c = *Q;
      accrocher(pid, c.x, c.y, 1e-3);  // bout coupé posé sur la courbe qui coupe
    }
  return "Spline ajustée (" + std::to_string(pieces.size()) + (pieces.size() > 1 ? " morceaux exacts" : " morceau exact") + ", en points de contrôle).";
}

std::string Dessin::decalerSpline(const std::string& id, double D, int cote, bool& fait, bool& rebroussement) {
  const Entite e = *entite(id);
  BSpline f;
  if (!splineDe(s_, e, f)) return "Spline invalide.";
  const bool boucle = f.closed || e.pts.front() == e.pts.back();
  const auto off = [&](double u) {
    const auto d = bsEval(f, u, 1);
    const double L0 = hyp(d[1][0], d[1][1]), L = L0 != 0 ? L0 : 1e-12;
    return P2d{d[0][0] - cote * D * d[1][1] / L, d[0][1] + cote * D * d[1][0] / L};
  };
  double km = 0;
  for (const EchantillonU& s : bsSampleU(f, f.a, f.b, 16)) {
    const auto d = bsEval(f, s.u, 2);
    const double L = hyp(d[1][0], d[1][1]);
    if (L > 1e-12) km = jsmax(km, std::abs((d[1][0] * d[2][1] - d[1][1] * d[2][0]) / (L * L * L)));
  }
  BSpline res;
  bool aRes = false;
  double err = 1e308;
  for (int per = 4; per <= 64 && err > 0.005; per *= 2) {
    const auto S = bsSampleU(f, f.a, f.b, per);
    std::vector<P2d> Q;
    for (size_t i = 0; i < S.size() - (boucle ? 1 : 0); i++) Q.push_back(off(S[i].u));
    BSpline g;
    const std::vector<P2d> H(Q.size(), P2d{0, 0});
    const std::vector<char> A(Q.size(), 0);
    if (!bsInterpolate(Q, H, A, boucle, g)) return "Décalage impossible.";
    err = 0;
    for (size_t i = 0; i + 1 < S.size(); i++) {
      const double um = (S[i].u + S[i + 1].u) / 2;
      const P2d t = off(um);
      const double v = bsNewtonClosest(g, g.a + (g.b - g.a) * (static_cast<double>(i) + 0.5) / (static_cast<double>(S.size()) - 1), t[0], t[1]);
      const P2d c = bsEval(g, v, 0)[0];
      err = jsmax(err, hyp(c[0] - t[0], c[1] - t[1]));
    }
    res = g;
    aRes = true;
  }
  if (!aRes) return "Décalage impossible.";
  const size_t n = res.P.size() - 1;
  const std::string pa = ajouterPoint(res.P[0][0], res.P[0][1]), pb = boucle ? pa : ajouterPoint(res.P[n][0], res.P[n][1]);
  s_.entites.push_back(splineDepuis(e, res, pa, pb));
  structure_ = true;
  fait = true;
  rebroussement = rebroussement || D * km >= 1;
  return "";
}

std::vector<std::string> Dessin::splinesChoisies() const {
  std::vector<std::string> v;
  for (const Entite* e : const_cast<Dessin*>(this)->entitesChoisies())
    if (e->t == "spline") v.push_back(e->id);
  return v;
}

double Dessin::distanceSplines(const std::vector<std::string>& ids, double wx, double wy) const {
  double m = 1e308;
  for (const std::string& id : ids) {
    const Entite* e = s_.entite(id);
    BSpline f;
    if (e && splineDe(s_, *e, f)) m = jsmin(m, bsClosest(f, wx, wy, nullptr).d);
  }
  return m;
}

// ---- Projeter : projectEdgeAt (50-esquisse-1), skProjectCreate (50-esquisse-7), skSplineProject (50-esquisse-6),
// et la projection des autres esquisses (50-esquisse-8)
namespace {
double distSeg2(double px, double py, double ax, double ay, double bx, double by) { return distSeg(px, py, Pt{ax, ay}, Pt{bx, by}); }
double restePositif(double a) {  // ((a%T)+T)%T
  const double T = PI_ * 2;
  return std::fmod(std::fmod(a, T) + T, T);
}
void arcOriente(double cx, double cy, double x1, double y1, double x2, double y2, double mx, double my, double o[4]) {
  // L'arc va toujours de pa à pb en sens direct : le secteur doit contenir le milieu réel de l'arête, jamais son complément
  const double a1 = m_atan2(y1 - cy, x1 - cx), a2 = m_atan2(y2 - cy, x2 - cx), am = m_atan2(my - cy, mx - cx);
  const bool garde = !std::isfinite(mx) || !std::isfinite(my) || dansArc(am, a1, a2);
  o[0] = garde ? x1 : x2;
  o[1] = garde ? y1 : y2;
  o[2] = garde ? x2 : x1;
  o[3] = garde ? y2 : y1;
}
struct PlanVers {  // skpPlan
  const Esquisse& a;
  const Esquisse& b;
  bool par;
  PlanVers(const Esquisse& A, const Esquisse& B) : a(A), b(B) {
    par = std::abs(a.n[0] * b.n[0] + a.n[1] * b.n[1] + a.n[2] * b.n[2]) > 1 - 1e-9;
  }
  P2d operator()(double x, double y) const {
    const double dx = a.o[0] + a.u[0] * x + a.v[0] * y - b.o[0], dy = a.o[1] + a.u[1] * x + a.v[1] * y - b.o[1], dz = a.o[2] + a.u[2] * x + a.v[2] * y - b.o[2];
    return {dx * b.u[0] + dy * b.u[1] + dz * b.u[2], dx * b.v[0] + dy * b.v[1] + dz * b.v[2]};
  }
};
bool plat(const std::vector<P2d>& pts) {  // skpPlat : la polyligne n'est qu'un trait droit
  const P2d A = pts[0];
  P2d B = A;
  double dm = 0;
  for (const P2d& p : pts) {
    const double d = hyp(p[0] - A[0], p[1] - A[1]);
    if (d > dm) {
      dm = d;
      B = p;
    }
  }
  if (dm < 1e-4) return true;
  for (const P2d& p : pts)
    if (!(std::abs((p[0] - A[0]) * (B[1] - A[1]) - (p[1] - A[1]) * (B[0] - A[0])) / dm < 1e-4)) return false;
  return true;
}
using Prj = Dessin::Projetable;
Prj formeProjetee(const Esquisse& S, const Entite& e, const PlanVers& f) {  // skpForme
  Prj r;
  const auto courbe = [&](std::vector<P2d> pts, bool closed, int m) {
    Prj c;
    if (plat(pts)) return c;
    c.sorte = Prj::COURBE;
    c.pts = std::move(pts);
    c.closed = closed;
    c.m = m;
    return c;
  };
  if (e.t == "line") {
    const Pt* A = S.point(e.p1);
    const Pt* B = S.point(e.p2);
    if (!A || !B || !e.handle.empty()) return r;
    const P2d a = f(A->x, A->y), b = f(B->x, B->y);
    if (hyp(b[0] - a[0], b[1] - a[1]) < 1e-4) return r;
    r.sorte = Prj::LIGNE;
    r.x1 = a[0];
    r.y1 = a[1];
    r.x2 = b[0];
    r.y2 = b[1];
    return r;
  }
  if (e.t == "circle") {
    const Pt* C = S.point(e.pc);
    if (!C || !(e.r > 0)) return r;
    if (f.par) {
      const P2d c = f(C->x, C->y);
      r.sorte = Prj::CERCLE;
      r.cx = c[0];
      r.cy = c[1];
      r.r = e.r;
      return r;
    }
    std::vector<P2d> pts;
    for (int i = 0; i <= 96; i++) {
      const double a = i / 96.0 * PI_ * 2;
      pts.push_back(f(C->x + m_cos(a) * e.r, C->y + m_sin(a) * e.r));
    }
    return courbe(std::move(pts), true, 48);
  }
  if (e.t == "arc") {
    const Pt* C = S.point(e.pc);
    An an;
    if (!C || !(e.r > 0) || !anglesArc2(S, e, an)) return r;
    const auto en = [&](double a) { return f(C->x + m_cos(a) * e.r, C->y + m_sin(a) * e.r); };
    if (f.par) {
      const P2d c = f(C->x, C->y), u = en(an.a1), w = en(an.a2), m = en((an.a1 + an.a2) / 2);
      double o[4];
      arcOriente(c[0], c[1], u[0], u[1], w[0], w[1], m[0], m[1], o);  // plan retourné : le sens de l'arc s'inverse
      r.sorte = Prj::ARC;
      r.cx = c[0];
      r.cy = c[1];
      r.r = e.r;
      r.x1 = o[0];
      r.y1 = o[1];
      r.x2 = o[2];
      r.y2 = o[3];
      return r;
    }
    const double d = an.a2 - an.a1;
    const int n = std::max(8, static_cast<int>(std::ceil(d / (PI_ * 2) * 96)));
    std::vector<P2d> pts;
    for (int i = 0; i <= n; i++) pts.push_back(en(an.a1 + d * i / n));
    return courbe(std::move(pts), false, std::max(6, static_cast<int>(std::ceil(n / 2.0))));
  }
  if (e.t == "spline") {
    BSpline b;
    if (!splineDe(S, e, b)) return r;
    const std::vector<P2d> pl = bsSample(b, b.a, b.b, 16);
    if (pl.size() < 2) return r;
    std::vector<P2d> pts;
    for (const P2d& q : pl) pts.push_back(f(q[0], q[1]));
    return courbe(std::move(pts), e.closed, std::max(24, std::min(96, static_cast<int>(e.pts.size()) * 6)));
  }
  return r;
}
std::vector<std::string> pointsDesignables(const Esquisse& S) {  // skpPoints
  std::vector<std::string> ids;
  std::set<std::string> vus;
  const auto mettre = [&](const std::string& p) {
    if (!p.empty() && vus.insert(p).second) ids.push_back(p);
  };
  for (const Entite& e : S.entites) {
    if (e.t == "line") {
      mettre(e.p1);
      if (e.handle.empty()) mettre(e.p2);
    } else if (e.t == "circle") {
      mettre(e.pc);
    } else if (e.t == "arc") {
      mettre(e.pc);
      mettre(e.pa);
      mettre(e.pb);
    } else if (e.t == "cpoint") {
      mettre(e.p);
    } else if (e.t == "spline") {
      for (const std::string& q : e.pts) mettre(q);
    }
  }
  std::vector<std::string> L;
  for (const std::string& p : ids)
    if (S.point(p)) L.push_back(p);
  return L;
}
const Esquisse* esquisseDe(const std::vector<Esquisse>& L, const std::string& id) {
  for (const Esquisse& s : L)
    if (s.id == id) return &s;
  return nullptr;
}
bool depend(const std::vector<Esquisse>& L, const Esquisse& s, const std::string& id, std::set<std::string>& vu) {  // skpDepend
  if (!vu.insert(s.id).second) return false;
  for (const Entite& e : s.entites) {
    if (e.skSrcSk.empty()) continue;
    if (e.skSrcSk == id) return true;
    const Esquisse* q = esquisseDe(L, e.skSrcSk);
    if (q && depend(L, *q, id, vu)) return true;
  }
  return false;
}
bool cloneRepetition(const std::string& nom) {  // repCloneSkName : « (rép 2) » à la fin du nom
  size_t i = nom.size();
  while (i && nom[i - 1] == ' ') i--;
  if (!i || nom[i - 1] != ')') return false;
  i--;
  const size_t fin = i;
  while (i && nom[i - 1] >= '0' && nom[i - 1] <= '9') i--;
  if (i == fin) return false;
  while (i && nom[i - 1] == ' ') i--;
  static const std::string REP = "(r\xC3\xA9p";
  return i >= REP.size() && nom.compare(i - REP.size(), REP.size(), REP) == 0;
}
double distanceForme(const Prj& pr, double x, double y) {  // skpDistance
  if (pr.sorte == Prj::LIGNE) return distSeg2(x, y, pr.x1, pr.y1, pr.x2, pr.y2);
  if (pr.sorte == Prj::CERCLE) return std::abs(hyp(x - pr.cx, y - pr.cy) - pr.r);
  if (pr.sorte == Prj::ARC) {
    const double a = m_atan2(pr.y1 - pr.cy, pr.x1 - pr.cx), b = m_atan2(pr.y2 - pr.cy, pr.x2 - pr.cx);
    if (dansArc(m_atan2(y - pr.cy, x - pr.cx), a, b)) return std::abs(hyp(x - pr.cx, y - pr.cy) - pr.r);
    return jsmin(hyp(x - pr.x1, y - pr.y1), hyp(x - pr.x2, y - pr.y2));
  }
  double d = std::numeric_limits<double>::infinity();
  for (size_t i = 0; i + 1 < pr.pts.size(); i++) d = jsmin(d, distSeg2(x, y, pr.pts[i][0], pr.pts[i][1], pr.pts[i + 1][0], pr.pts[i + 1][1]));
  return d;
}
std::vector<P2d> echantillon(const std::vector<P2d>& pts, bool closed, int m) {  // skpEchantillon
  std::vector<double> L{0};
  for (size_t i = 1; i < pts.size(); i++) L.push_back(L[i - 1] + hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const double tot = L.back();
  std::vector<P2d> Q;
  for (int k = 0; k <= m; k++) {
    const double s = tot * k / m;
    size_t i = 1;
    while (i < L.size() - 1 && L[i] < s) i++;
    const double dl = L[i] - L[i - 1], w = (s - L[i - 1]) / (dl != 0 ? dl : 1);
    Q.push_back({pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * w, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * w});
  }
  if (closed) Q.pop_back();
  return Q;
}
}  // namespace

Dessin::Projetable Dessin::areteProjetable(double x, double y) const {
  Projetable best;
  const std::vector<Arete3D>* L = aretes3D ? aretes3D() : nullptr;
  if (!L) return best;
  const double tol = jsmax(4.0, 8 / jsmax(1.0, echelle_));
  double bd = 1e9;
  for (const Arete3D& e : *L) {
    std::vector<P2d> pts2;
    for (const Vec3& p : e.pts) {
      const double dx = p[0] - s_.o[0], dy = p[1] - s_.o[1], dz = p[2] - s_.o[2];
      pts2.push_back({dx * s_.u[0] + dy * s_.u[1] + dz * s_.u[2], dx * s_.v[0] + dy * s_.v[1] + dz * s_.v[2]});
    }
    bool ponctuelle = true;
    for (const P2d& p : pts2) ponctuelle = ponctuelle && hyp(p[0] - pts2[0][0], p[1] - pts2[0][1]) < 1e-4;
    if (ponctuelle) continue;  // arête perpendiculaire au plan : un point, rien à projeter
    bool isCirc = false;
    double cx = 0, cy = 0, r = 0, a1 = 0, a2 = 0;
    if (pts2.size() >= 6) {
      const P2d p0 = pts2[0], p1 = pts2[pts2.size() / 3], p2 = pts2[2 * pts2.size() / 3];
      const double d = 2 * (p0[0] * (p1[1] - p2[1]) + p1[0] * (p2[1] - p0[1]) + p2[0] * (p0[1] - p1[1]));
      if (std::abs(d) > 1e-9) {
        const double s0 = p0[0] * p0[0] + p0[1] * p0[1], s1 = p1[0] * p1[0] + p1[1] * p1[1], s2 = p2[0] * p2[0] + p2[1] * p2[1];
        cx = (s0 * (p1[1] - p2[1]) + s1 * (p2[1] - p0[1]) + s2 * (p0[1] - p1[1])) / d;
        cy = (s0 * (p2[0] - p1[0]) + s1 * (p0[0] - p2[0]) + s2 * (p1[0] - p0[0])) / d;
        r = hyp(p0[0] - cx, p0[1] - cy);
        if (r > 0.5) {
          double dev = 0;
          for (const P2d& p : pts2) {
            const double dd = std::abs(hyp(p[0] - cx, p[1] - cy) - r);
            if (dd > dev) dev = dd;
          }
          if (dev < 0.35) {
            isCirc = true;
            a1 = m_atan2(p0[1] - cy, p0[0] - cx);
            a2 = m_atan2(pts2.back()[1] - cy, pts2.back()[0] - cx);
          }
        }
      }
    }
    bool isFull = false;
    double d = 1e9;
    if (isCirc) {
      const double span = std::abs(restePositif(a2 - a1));
      isFull = span > 6.0 || hyp(pts2[0][0] - pts2.back()[0], pts2[0][1] - pts2.back()[1]) < 0.5;
      if (isFull) d = std::abs(hyp(x - cx, y - cy) - r);
      else {
        double bestA = 1e9;
        for (size_t i = 0; i + 1 < pts2.size(); i++) bestA = jsmin(bestA, distSeg2(x, y, pts2[i][0], pts2[i][1], pts2[i + 1][0], pts2[i + 1][1]));
        d = bestA;
      }
    } else {
      for (size_t i = 0; i + 1 < pts2.size(); i++) d = jsmin(d, distSeg2(x, y, pts2[i][0], pts2[i][1], pts2[i + 1][0], pts2[i + 1][1]));
    }
    // Deux arêtes peuvent se superposer en 2D : celle du plan d'esquisse gagne
    double dz = 1e9;
    for (const Vec3& p : e.pts) {
      const double t = std::abs((p[0] - s_.o[0]) * s_.n[0] + (p[1] - s_.o[1]) * s_.n[1] + (p[2] - s_.o[2]) * s_.n[2]);
      if (t < dz) dz = t;
    }
    if (dz > 1e8) dz = 0;
    if (d < tol && d + 0.25 * dz < bd) {
      bd = d + 0.25 * dz;
      best = Projetable{};
      best.aMid = true;
      best.mid = e.mid;
      if (isCirc) {
        best.cx = cx;
        best.cy = cy;
        best.r = r;
        if (isFull) best.sorte = Projetable::CERCLE;
        else {
          const P2d m = pts2[pts2.size() / 2];
          double o[4];
          arcOriente(cx, cy, pts2[0][0], pts2[0][1], pts2.back()[0], pts2.back()[1], m[0], m[1], o);
          best.sorte = Projetable::ARC;
          best.x1 = o[0];
          best.y1 = o[1];
          best.x2 = o[2];
          best.y2 = o[3];
        }
      } else {
        const P2d A0 = pts2[0], B0 = pts2.back();
        const double cl = hyp(B0[0] - A0[0], B0[1] - A0[1]);
        double dv = 0;
        for (const P2d& p : pts2)
          dv = jsmax(dv, cl > 1e-9 ? std::abs((p[0] - A0[0]) * (B0[1] - A0[1]) - (p[1] - A0[1]) * (B0[0] - A0[0])) / cl : hyp(p[0] - A0[0], p[1] - A0[1]));
        if (dv > 0.02) {
          best.sorte = Projetable::COURBE;
          best.pts = pts2;
        } else {
          best.sorte = Projetable::LIGNE;
          best.x1 = A0[0];
          best.y1 = A0[1];
          best.x2 = B0[0];
          best.y2 = B0[1];
        }
      }
    }
  }
  return best;
}

std::string Dessin::nomEntite(bool arete) {
  int* c = arete ? nomsArete : nomsProj;
  static int secours = 0;
  if (!c) c = &secours;
  return std::string(arete ? "Ar\xC3\xAAte " : "Projet\xC3\xA9" "e ") + std::to_string(++*c);
}

void Dessin::nommer(Entite& e, const Projetable& pr) {  // projNames
  e.projName = nomEntite(false);
  if (pr.aMid) {
    e.srcName = nomEntite(true);
    e.aSrcMid = true;
    e.srcMid = pr.mid;
  }
}

std::string Dessin::creerProjection(const Projetable& pr) {  // skProjectCreate
  const auto fixer = [&](const std::string& p) {
    Contrainte c = contrainte("fix");
    c.p = p;
    lier(c);
  };
  const auto fixerEntite = [&](const std::string& id) {
    Contrainte c = contrainte("fix");
    c.ent = id;
    lier(c);
  };
  Entite e;
  e.construction = true;
  e.proj = true;
  if (pr.sorte == Projetable::CERCLE) {
    const std::string pc = ajouterPoint(pr.cx, pr.cy);
    fixer(pc);
    e.id = nouvelE();
    e.t = "circle";
    e.pc = pc;
    e.r = pr.r;
    nommer(e, pr);
    s_.entites.push_back(e);
    fixerEntite(e.id);
    return e.id;
  }
  if (pr.sorte == Projetable::ARC) {
    const std::string pc = ajouterPoint(pr.cx, pr.cy), pa = ajouterPoint(pr.x1, pr.y1), pb = ajouterPoint(pr.x2, pr.y2);
    fixer(pc);
    fixer(pa);
    fixer(pb);
    e.id = nouvelE();
    e.t = "arc";
    e.pc = pc;
    e.pa = pa;
    e.pb = pb;
    e.r = pr.r;
    nommer(e, pr);
    s_.entites.push_back(e);
    fixerEntite(e.id);
    return e.id;
  }
  if (pr.sorte == Projetable::COURBE) {  // skSplineProject : au plus 25 points fixés, répartis en longueur
    const std::vector<P2d>& pts = pr.pts;
    if (pts.size() < 2) return "";
    std::vector<double> L{0};
    for (size_t i = 1; i < pts.size(); i++) L.push_back(L[i - 1] + hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    if (!(L.back() > 1e-6)) return "";
    const bool closed = hyp(pts[0][0] - pts.back()[0], pts[0][1] - pts.back()[1]) < 1e-4;
    const int m = std::max(3, std::min(25, static_cast<int>(pts.size()) - 1));
    const std::vector<P2d> Q = echantillon(pts, closed, m);
    std::vector<std::string> ids;
    for (const P2d& q : Q) {
      const std::string p = ajouterPoint(q[0], q[1]);
      fixer(p);
      ids.push_back(p);
    }
    e.id = nouvelE();
    e.t = "spline";
    e.pts = ids;
    e.closed = closed && ids.size() >= 3;
    s_.entites.push_back(e);
    fixerEntite(e.id);
    nommer(s_.entites.back(), pr);
    return e.id;
  }
  const std::string p1 = ajouterPoint(pr.x1, pr.y1), p2 = ajouterPoint(pr.x2, pr.y2);
  e.id = nouvelE();
  e.t = "line";
  e.p1 = p1;
  e.p2 = p2;
  nommer(e, pr);
  s_.entites.push_back(e);
  fixer(p1);
  fixer(p2);
  return e.id;
}

bool suivreEsquisseSource(const std::vector<Esquisse>& L, Esquisse& T, Entite& e) {  // skpTrack
  const Esquisse* S = esquisseDe(L, e.skSrcSk);
  if (!S) return false;  // source perdue : l'élément reste à sa dernière place
  const PlanVers f(*S, T);
  const double TOL = 1e-5;
  const auto pose = [&](const std::string& id, double x, double y) {
    auto q = T.points.find(id);
    if (q == T.points.end() || hyp(q->second.x - x, q->second.y - y) <= TOL) return false;
    q->second.x = x;
    q->second.y = y;
    return true;
  };
  if (!e.skSrcPt.empty()) {
    const Pt* q = S->point(e.skSrcPt);
    if (!q || !T.point(e.p)) return false;
    const P2d c = f(q->x, q->y);
    return pose(e.p, c[0], c[1]);
  }
  const Entite* src = nullptr;
  for (const Entite& x : S->entites)
    if (x.id == e.skSrcEnt) src = &x;
  if (!src) return false;
  const Prj pr = formeProjetee(*S, *src, f);
  const Prj::Sorte attendu = e.t == "line" ? Prj::LIGNE : e.t == "circle" ? Prj::CERCLE : e.t == "arc" ? Prj::ARC : Prj::COURBE;
  if (!pr || pr.sorte != attendu) return false;
  bool bouge = false;
  const auto b = [&](bool v) { bouge = bouge || v; };
  if (e.t == "line") {
    b(pose(e.p1, pr.x1, pr.y1));
    b(pose(e.p2, pr.x2, pr.y2));
  } else if (e.t == "circle") {
    b(pose(e.pc, pr.cx, pr.cy));
    if (std::abs(e.r - pr.r) > TOL) {
      e.r = pr.r;
      bouge = true;
    }
  } else if (e.t == "arc") {
    b(pose(e.pc, pr.cx, pr.cy));
    b(pose(e.pa, pr.x1, pr.y1));
    b(pose(e.pb, pr.x2, pr.y2));
    if (std::abs(e.r - pr.r) > TOL) {
      e.r = pr.r;
      bouge = true;
    }
  } else {
    const std::vector<P2d> Q = echantillon(pr.pts, pr.closed, e.skSrcM);
    if (Q.size() != e.pts.size()) return false;
    for (size_t i = 0; i < Q.size(); i++) b(pose(e.pts[i], Q[i][0], Q[i][1]));
  }
  return bouge;
}

std::vector<Dessin::SourceProjection> Dessin::sourcesProjection() const {  // skpItems
  std::vector<SourceProjection> out;
  if (!esquisses) return out;
  for (const Esquisse& S : *esquisses) {
    std::set<std::string> vu;
    if (S.id == s_.id || !S.visible || cloneRepetition(S.nom) || depend(*esquisses, S, s_.id, vu)) continue;
    const PlanVers f(S, s_);
    SourceProjection it;
    for (const std::string& pid : pointsDesignables(S)) {
      const Pt* q = S.point(pid);
      it.pts.push_back(f(q->x, q->y));
    }
    for (const Entite& e : S.entites) {
      if (e.t == "cpoint") continue;
      Projetable pr = formeProjetee(S, e, f);
      if (!pr) continue;
      pr.skSk = S.id;
      pr.skEnt = e.id;
      pr.srcNom = S.nom;
      it.formes.push_back(std::move(pr));
    }
    out.push_back(std::move(it));
  }
  return out;
}

Dessin::Projetable Dessin::sourceSous(double x, double y) const {  // skpHit : un point d'abord, puis une entité
  Projetable best;
  if (!esquisses) return best;
  double bd = PT_;
  for (const Esquisse& S : *esquisses) {
    std::set<std::string> vu;
    if (S.id == s_.id || !S.visible || cloneRepetition(S.nom) || depend(*esquisses, S, s_.id, vu)) continue;
    const PlanVers f(S, s_);
    for (const std::string& pid : pointsDesignables(S)) {
      const Pt* q = S.point(pid);
      const P2d c = f(q->x, q->y);
      const double d = hyp(c[0] - x, c[1] - y);
      if (d < bd) {
        bd = d;
        best = Projetable{};
        best.sorte = Projetable::UN_POINT;
        best.x1 = c[0];
        best.y1 = c[1];
        best.skSk = S.id;
        best.skPt = pid;
        best.srcNom = S.nom;
      }
    }
  }
  if (best) return best;
  bd = PICK_;
  for (const SourceProjection& it : sourcesProjection())
    for (const Projetable& c : it.formes) {
      const double d = distanceForme(c, x, y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
  return best;
}

std::string Dessin::creerDepuisEsquisse(const Projetable& pr) {  // skpCreer
  std::string id;
  const auto fixer = [&](const std::string& p) {
    Contrainte c = contrainte("fix");
    c.p = p;
    lier(c);
  };
  Projetable sansMid = pr;
  sansMid.aMid = false;
  if (pr.sorte == Projetable::UN_POINT) {
    const std::string p = ajouterPoint(pr.x1, pr.y1);
    fixer(p);
    Entite e;
    e.id = id = nouvelE();
    e.t = "cpoint";
    e.p = p;
    e.construction = e.proj = true;
    nommer(e, sansMid);
    s_.entites.push_back(e);
  } else if (pr.sorte == Projetable::COURBE) {
    const std::vector<P2d> Q = echantillon(pr.pts, pr.closed, pr.m);
    if (Q.size() < 3) return "";
    Entite e;
    for (const P2d& q : Q) {
      const std::string p = ajouterPoint(q[0], q[1]);
      fixer(p);
      e.pts.push_back(p);
    }
    e.id = id = nouvelE();
    e.t = "spline";
    e.construction = e.proj = true;
    e.closed = pr.closed;
    nommer(e, sansMid);
    s_.entites.push_back(e);
    Contrainte c = contrainte("fix");
    c.ent = id;
    lier(c);
  } else {
    id = creerProjection(sansMid);
  }
  if (id.empty()) return id;
  Entite* e = nullptr;
  for (Entite& x : s_.entites)
    if (x.id == id) e = &x;
  e->skSrcSk = pr.skSk;
  e->skSrcPt = pr.skPt;
  e->skSrcEnt = pr.skEnt;
  e->skSrcM = pr.sorte == Projetable::COURBE ? pr.m : 0;
  e->srcName = "\xC2\xAB " + (pr.srcNom.empty() ? std::string("Esquisse") : pr.srcNom) + " \xC2\xBB";
  return id;
}

namespace {
const char* nomForme(Dessin::Projetable::Sorte s) {  // skpNom
  using P = Dessin::Projetable;
  return s == P::UN_POINT ? "Point" : s == P::CERCLE ? "Cercle" : s == P::ARC ? "Arc" : s == P::COURBE ? "Courbe" : "Ligne";
}
}  // namespace

void Dessin::clicProjeter(double wx, double wy) {
  const Projetable src = sourceSous(wx, wy);
  if (src) {
    for (const Entite& e : s_.entites)
      if (e.skSrcSk == src.skSk && (!src.skPt.empty() ? e.skSrcPt == src.skPt : e.skSrcEnt == src.skEnt))
        return message(std::string(nomForme(src.sorte)) + " de « " + src.srcNom + " » déjà projeté(e) ici.");
    pousser();
    if (creerDepuisEsquisse(src).empty()) {
      if (annulerPas) annulerPas();
      return message("Élément trop court pour être projeté.");
    }
    apresEdition();
    return message(std::string(nomForme(src.sorte)) + " de « " + src.srcNom + " » projeté(e) en construction : suit son esquisse.");
  }
  const std::vector<Arete3D>* L = aretes3D ? aretes3D() : nullptr;
  if (!L) return message("Projeter : noyau OCCT requis et solide visible.");
  const Projetable pr = areteProjetable(wx, wy);
  if (!pr) return message("Aucune arête 3D sur ce plan à proximité.");
  pousser();
  if (creerProjection(pr).empty()) {
    if (annulerPas) annulerPas();
    return message("Arête courbe trop courte pour être projetée.");
  }
  apresEdition();
  message(pr.sorte == Projetable::CERCLE ? "Cercle projeté en construction (centre fixe)."
          : pr.sorte == Projetable::ARC  ? "Arc projeté en construction (fixe)."
          : pr.sorte == Projetable::COURBE ? "Courbe projetée en construction : spline aux points fixés (non suivie au rejeu)."
                                           : "Arête projetée en construction (fixe).");
}

void Dessin::bougerProjeter(double wx, double wy) {
  Projetable pr = sourceSous(wx, wy);
  const bool autre = static_cast<bool>(pr);
  if (!autre) pr = areteProjetable(wx, wy);
  survolProj_ = pr;
  if (autre) message("⧉ " + std::string(nomForme(pr.sorte)) + " de « " + pr.srcNom + " » (suit cette esquisse) — clic pour projeter en construction.");
  else if (pr) message("⧉ " + std::string(pr.sorte == Projetable::CERCLE ? "Cercle" : pr.sorte == Projetable::ARC ? "Arc" : pr.sorte == Projetable::COURBE ? "Courbe" : "Arête") + " — clic pour projeter en construction.");
  else message("⧉ Survolez une arête 3D (même hors plan) ou le tracé bleu d'une autre esquisse visible — il s'illumine en orange.");
}

// ---- Intersection : le choix et la création (src/62-esquisse-intersection.js). Les courbes viennent du noyau.
bool Dessin::isectNormale = false;
namespace {
double distSection(const CourbeSection& c, double x, double y) {  // isectDistTo
  if (c.sorte == CourbeSection::LIGNE) return distSeg(x, y, Pt{c.x1, c.y1}, Pt{c.x2, c.y2});
  if (c.sorte == CourbeSection::CERCLE) return std::abs(hyp(x - c.cx, y - c.cy) - c.r);
  if (c.sorte == CourbeSection::ARC) {
    const double a1 = m_atan2(c.y1 - c.cy, c.x1 - c.cx), a2 = m_atan2(c.y2 - c.cy, c.x2 - c.cx);
    if (dansArc(m_atan2(y - c.cy, x - c.cx), a1, a2)) return std::abs(hyp(x - c.cx, y - c.cy) - c.r);
    return jsmin(hyp(x - c.x1, y - c.y1), hyp(x - c.x2, y - c.y2));
  }
  double d = 1e18;
  for (size_t i = 0; i + 1 < c.dense.size(); i++) d = jsmin(d, distSeg(x, y, Pt{c.dense[i][0], c.dense[i][1]}, Pt{c.dense[i + 1][0], c.dense[i + 1][1]}));
  return d;
}
using Seg2 = std::array<std::array<double, 2>, 2>;
std::vector<Seg2> segmentsDe(const CourbeSection& c, int n) {  // isectSegs
  const int N = static_cast<int>(c.dense.size()) - 1;
  const auto en = [&](double t) {
    const double f = t * N;
    const int i = std::min(N - 1, static_cast<int>(std::floor(f)));
    const double w = f - i;
    return std::array<double, 2>{c.dense[i][0] + (c.dense[i + 1][0] - c.dense[i][0]) * w, c.dense[i][1] + (c.dense[i + 1][1] - c.dense[i][1]) * w};
  };
  std::vector<Seg2> out;
  for (int i = 0; i < n; i++) out.push_back({en(static_cast<double>(i) / n), en(static_cast<double>(i + 1) / n)});
  return out;
}
}  // namespace

Dessin::SurvolIsect Dessin::choixIsect(double x, double y, bool corps) const {
  SurvolIsect h;
  const std::vector<CourbeSection>* L = sectionsCandidates ? sectionsCandidates() : nullptr;
  if (!L) return h;
  const CourbeSection* best = nullptr;
  double bd = 10 / jsmax(1e-9, echelle_);
  for (const CourbeSection& c : *L) {
    const double d = distSection(c, x, y);
    if (d < bd) {
      bd = d;
      best = &c;
    }
  }
  if (!best) return h;
  h.ok = true;
  h.corps = corps || best->fk.empty();
  h.solide = best->solide;
  h.aAt = true;
  h.at = best->on3;
  h.st = best->st;
  if (!h.corps) {
    h.fk = best->fk;
    h.ref = best->ref;
    h.fks = best->fks.empty() ? std::vector<std::string>{best->fk} : best->fks;
    h.refs = best->refs.empty() ? std::vector<std::string>{best->ref} : best->refs;
  }
  return h;
}

std::vector<const CourbeSection*> Dessin::groupeSurvole() const {
  std::vector<const CourbeSection*> out;
  const std::vector<CourbeSection>* L = sectionsCandidates ? sectionsCandidates() : nullptr;
  if (!L || !survolIsect_.ok) return out;
  for (const CourbeSection& c : *L)
    if (survolIsect_.corps ? c.solide == survolIsect_.solide
                           : c.fk == survolIsect_.fk || std::find(c.fks.begin(), c.fks.end(), survolIsect_.fk) != c.fks.end())
      out.push_back(&c);
  return out;
}

bool Dessin::sectionRetenue(const CourbeSection& c) const {
  for (const FaceRetenue& s : isectSel_)
    if (c.fk == s.fk || std::find(c.fks.begin(), c.fks.end(), s.fk) != c.fks.end()) return true;
  return false;
}

int Dessin::emettreIsect(const std::vector<CourbeSection>& L, const SourceIntersection& src) {
  int faits = 0;
  struct Q {
    double x, y;
    std::string id;
  };
  std::vector<Q> pts;
  const auto pid = [&](double x, double y) {  // points partagés aux jonctions : le contour reste fermé
    for (const Q& q : pts)
      if (hyp(q.x - x, q.y - y) < 1e-5) return q.id;
    const std::string p = ajouterPoint(x, y);
    pts.push_back({x, y, p});
    Contrainte c = contrainte("fix");
    c.p = p;
    lier(c);
    return p;
  };
  const size_t nf = src.mode == "faces" ? src.faces.size() : 0;
  const std::string srcName = src.mode == "faces" ? std::to_string(nf) + " face" + (nf > 1 ? "s" : "") : src.aPt ? "corps entier" : "tous les corps";
  const std::string json = sourceEnJson(src);
  const auto base = [&](Entite& e, const CourbeSection& c) {
    e.proj = true;
    e.ext = true;
    e.isectJson = json;
    static int secours = 0;
    int* k = nomsIsect ? nomsIsect : &secours;
    e.projName = "Intersection " + std::to_string(++*k);
    e.srcName = srcName;
    e.aSrcMid = true;
    e.srcMid = c.mid3;
    e.construction = !isectNormale;
  };
  const auto fixerEntite = [&](const std::string& id) {
    Contrainte c = contrainte("fix");
    c.ent = id;
    lier(c);
  };
  for (const CourbeSection& c : L) {
    Entite e;
    if (c.sorte == CourbeSection::LIGNE) {
      const std::string p1 = pid(c.x1, c.y1), p2 = pid(c.x2, c.y2);
      if (p1 == p2) continue;
      e.id = nouvelE();
      e.t = "line";
      e.p1 = p1;
      e.p2 = p2;
      base(e, c);
      s_.entites.push_back(e);
    } else if (c.sorte == CourbeSection::CERCLE) {
      e.pc = pid(c.cx, c.cy);
      e.id = nouvelE();
      e.t = "circle";
      e.r = c.r;
      base(e, c);
      s_.entites.push_back(e);
      fixerEntite(e.id);
    } else if (c.sorte == CourbeSection::ARC) {
      e.pc = pid(c.cx, c.cy);
      e.pa = pid(c.x1, c.y1);
      e.pb = pid(c.x2, c.y2);
      e.id = nouvelE();
      e.t = "arc";
      e.r = c.r;
      base(e, c);
      s_.entites.push_back(e);
      fixerEntite(e.id);
    } else {
      const std::vector<Seg2> S = segmentsDe(c, c.n);
      std::vector<std::string> ids{pid(S[0][0][0], S[0][0][1])};
      for (const Seg2& q : S) {
        const std::string p = pid(q[1][0], q[1][1]);
        if (p != ids.back()) ids.push_back(p);
      }
      const bool ferme = ids.size() > 3 && ids.front() == ids.back();
      if (ferme) ids.pop_back();
      if (ids.size() < 2) continue;
      e.id = nouvelE();
      e.t = "spline";
      e.pts = ids;
      e.isplN = c.n;
      e.closed = ferme;
      base(e, c);
      s_.entites.push_back(e);
      fixerEntite(e.id);
    }
    faits++;
  }
  structure_ = true;
  return faits;
}

void Dessin::appliquerIsect(const SourceIntersection& src) {
  std::vector<CourbeSection> L;
  SourceIntersection reb = src;
  if (!sectionsDe || !sectionsDe(src, L, reb) || L.empty()) return message("Intersection \xE2\xA8\xAF : la sélection ne coupe pas le plan d'esquisse.");
  pousser();
  const int n = emettreIsect(L, reb);
  if (!n) {
    if (annulerPas) annulerPas();
    return message("Intersection \xE2\xA8\xAF : aucune courbe exploitable.");
  }
  isectSel_.clear();
  survolIsect_ = SurvolIsect{};
  apresEdition();
  const std::string pl = n > 1 ? "s" : "";
  message("Intersection \xE2\xA8\xAF : " + std::to_string(n) + " courbe" + pl + " créée" + pl + (isectNormale ? " (géométrie normale)" : " en construction") + " — elles suivent le modèle au rejeu.");
}

void Dessin::validerIsect() {
  if (isectSel_.empty()) return message("\xE2\xA8\xAF Intersection : aucune face retenue (Ctrl+clic sur les courbes de section).");
  SourceIntersection src;
  src.mode = "faces";
  for (const FaceRetenue& s : isectSel_) src.faces.push_back(s.ref);
  appliquerIsect(src);
}

void Dessin::clicIsect(double x, double y, bool ctrl) {
  const SurvolIsect h = choixIsect(x, y, majTenue);
  if (!h.ok) return message("\xE2\xA8\xAF Intersection : aucune courbe de section ici — survolez le trait bleu clair d'une face qui coupe le plan.");
  if (h.corps) {
    SourceIntersection src;
    src.mode = "body";
    src.aPt = h.aAt;
    src.pt = h.at;
    return appliquerIsect(src);
  }
  const bool deja = std::any_of(isectSel_.begin(), isectSel_.end(), [&](const FaceRetenue& s) { return s.fk == h.fk; });
  const auto ajouter = [&] {
    for (size_t j = 0; j < h.fks.size(); j++)
      if (std::none_of(isectSel_.begin(), isectSel_.end(), [&](const FaceRetenue& s) { return s.fk == h.fks[j]; })) isectSel_.push_back({h.fks[j], h.refs[j]});
  };
  if (ctrl) {
    if (deja) isectSel_.erase(std::remove_if(isectSel_.begin(), isectSel_.end(), [&](const FaceRetenue& s) { return std::find(h.fks.begin(), h.fks.end(), s.fk) != h.fks.end(); }), isectSel_.end());
    else ajouter();
    const size_t n = isectSel_.size();
    const std::string pl = n > 1 ? "s" : "";
    return message("\xE2\xA8\xAF Intersection : " + std::to_string(n) + " face" + pl + " retenue" + pl + " — Entrée (ou clic simple) pour créer, Échap annule.");
  }
  if (!deja) ajouter();
  validerIsect();
}

void Dessin::bougerIsect(double x, double y) {
  const SurvolIsect h = choixIsect(x, y, majTenue);
  survolIsect_ = h;
  const std::vector<CourbeSection>* L = sectionsCandidates ? sectionsCandidates() : nullptr;
  const size_t ns = isectSel_.size();
  const std::string pl = ns > 1 ? "s" : "";
  if (!L || L->empty()) message("\xE2\xA8\xAF Intersection : aucun corps ne coupe ce plan.");
  else if (!h.ok) message("\xE2\xA8\xAF Intersection : survolez une courbe de section (bleu clair) — clic : la face · Maj+clic : le corps entier · Ctrl+clic : plusieurs faces" + (ns ? " (" + std::to_string(ns) + " retenue" + pl + ", Entrée valide)" : std::string()) + ".");
  else if (h.corps) message("\xE2\xA8\xAF Corps entier — clic pour créer ses courbes d'intersection avec le plan.");
  else message("\xE2\xA8\xAF Face" + (h.st.empty() ? std::string() : " (" + h.st + ")") + " — clic : intersection de " + (ns ? "la sélection + cette face" : "cette face") + " · Ctrl+clic : ajouter/retirer · Maj : corps entier.");
}

// ---- Arêtes et points du solide utilisables directement (src/50-esquisse-7-plan-cibles.js)
namespace {
const double TOL_Z_PLAN = 2e-3;
using FP = Dessin::FormePlan;
using PP = Dessin::PointPlan;
bool formeDe(const std::vector<P2d>& p2, FP& out) {  // skPlShape
  if (p2.size() < 2) return false;
  const P2d A = p2[0], B = p2.back();
  if (p2.size() >= 6) {
    const P2d p0 = A, p1 = p2[p2.size() / 3], q2 = p2[2 * p2.size() / 3];
    const double d = 2 * (p0[0] * (p1[1] - q2[1]) + p1[0] * (q2[1] - p0[1]) + q2[0] * (p0[1] - p1[1]));
    if (std::abs(d) > 1e-9) {
      const double s0 = p0[0] * p0[0] + p0[1] * p0[1], s1 = p1[0] * p1[0] + p1[1] * p1[1], s2 = q2[0] * q2[0] + q2[1] * q2[1];
      const double cx = (s0 * (p1[1] - q2[1]) + s1 * (q2[1] - p0[1]) + s2 * (p0[1] - p1[1])) / d, cy = (s0 * (q2[0] - p1[0]) + s1 * (p0[0] - q2[0]) + s2 * (p1[0] - p0[0])) / d;
      const double r = hyp(p0[0] - cx, p0[1] - cy);
      if (r > 0.5) {
        double dev = 0;
        for (const P2d& p : p2) dev = jsmax(dev, std::abs(hyp(p[0] - cx, p[1] - cy) - r));
        if (dev < 0.35) {
          out.cx = cx;
          out.cy = cy;
          out.r = r;
          if (hyp(B[0] - A[0], B[1] - A[1]) < 0.5) {
            out.sorte = FP::CERCLE;
            return true;
          }
          const P2d pm = p2[p2.size() / 2];
          double o[4];
          arcOriente(cx, cy, A[0], A[1], B[0], B[1], pm[0], pm[1], o);
          out.sorte = FP::ARC;
          out.x1 = o[0];
          out.y1 = o[1];
          out.x2 = o[2];
          out.y2 = o[3];
          return true;
        }
      }
    }
  }
  const double cl = hyp(B[0] - A[0], B[1] - A[1]);
  if (cl < 1e-6) return false;
  double dv = 0;
  for (const P2d& p : p2) dv = jsmax(dv, std::abs((p[0] - A[0]) * (B[1] - A[1]) - (p[1] - A[1]) * (B[0] - A[0])) / cl);
  if (dv > 0.02) {
    out.sorte = FP::COURBE;
    out.pts = p2;
    return true;
  }
  out.sorte = FP::LIGNE;
  out.x1 = A[0];
  out.y1 = A[1];
  out.x2 = B[0];
  out.y2 = B[1];
  return true;
}
std::vector<P2d> croisementsPlan(const FP& a, const FP& b) {  // skPlIsect
  const auto sur = [](const FP& e, double x, double y) {
    if (e.sorte == FP::LIGNE) {
      const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L2 = dx * dx + dy * dy;
      if (L2 < 1e-12) return false;
      const double t = ((x - e.x1) * dx + (y - e.y1) * dy) / L2;
      return t > -1e-6 && t < 1 + 1e-6;
    }
    if (e.sorte == FP::ARC) return dansArc(m_atan2(y - e.cy, x - e.cx), m_atan2(e.y1 - e.cy, e.x1 - e.cx), m_atan2(e.y2 - e.cy, e.x2 - e.cx));
    return true;
  };
  const auto rond = [](const FP& e) { return e.sorte == FP::CERCLE || e.sorte == FP::ARC; };
  std::vector<P2d> R;
  if (a.sorte == FP::LIGNE && b.sorte == FP::LIGNE) {
    const double dx1 = a.x2 - a.x1, dy1 = a.y2 - a.y1, dx2 = b.x2 - b.x1, dy2 = b.y2 - b.y1, den = dx1 * dy2 - dy1 * dx2;
    if (std::abs(den) < 1e-12) return {};
    const double t = ((b.x1 - a.x1) * dy2 - (b.y1 - a.y1) * dx2) / den;
    R.push_back({a.x1 + t * dx1, a.y1 + t * dy1});
  } else if ((a.sorte == FP::LIGNE && rond(b)) || (rond(a) && b.sorte == FP::LIGNE)) {
    const FP& L = a.sorte == FP::LIGNE ? a : b;
    const FP& K = a.sorte == FP::LIGNE ? b : a;
    const double dx = L.x2 - L.x1, dy = L.y2 - L.y1, fx = L.x1 - K.cx, fy = L.y1 - K.cy, A2 = dx * dx + dy * dy, B2 = 2 * (fx * dx + fy * dy), C2 = fx * fx + fy * fy - K.r * K.r, D = B2 * B2 - 4 * A2 * C2;
    if (A2 < 1e-12 || D < 0) return {};
    const double s = std::sqrt(D);
    for (const double t : {(-B2 - s) / (2 * A2), (-B2 + s) / (2 * A2)}) R.push_back({L.x1 + t * dx, L.y1 + t * dy});
  } else if (rond(a) && rond(b)) {
    const double dx = b.cx - a.cx, dy = b.cy - a.cy, d = hyp(dx, dy);
    if (d < 1e-9 || d > a.r + b.r || d < std::abs(a.r - b.r)) return {};
    const double l = (a.r * a.r - b.r * b.r + d * d) / (2 * d), h = std::sqrt(jsmax(0.0, a.r * a.r - l * l)), mx = a.cx + dx * l / d, my = a.cy + dy * l / d;
    R.push_back({mx - dy * h / d, my + dx * h / d});
    R.push_back({mx + dy * h / d, my - dx * h / d});
  } else {
    return {};
  }
  std::vector<P2d> out;
  for (const P2d& p : R)
    if (sur(a, p[0], p[1]) && sur(b, p[0], p[1])) out.push_back(p);
  return out;
}
bool piedForme(const FP& s, double x, double y, double& d, double& fx, double& fy) {  // skPlFoot
  if (s.sorte == FP::LIGNE) {
    const double dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    double L2 = dx * dx + dy * dy;
    if (L2 == 0) L2 = 1e-12;
    const double t = jsmax(0.0, jsmin(1.0, ((x - s.x1) * dx + (y - s.y1) * dy) / L2));
    fx = s.x1 + t * dx;
    fy = s.y1 + t * dy;
    d = hyp(x - fx, y - fy);
    return true;
  }
  if (s.sorte == FP::CERCLE || s.sorte == FP::ARC) {
    const double dc = hyp(x - s.cx, y - s.cy);
    if (dc < 1e-9) return false;
    if (s.sorte == FP::ARC && !dansArc(m_atan2(y - s.cy, x - s.cx), m_atan2(s.y1 - s.cy, s.x1 - s.cx), m_atan2(s.y2 - s.cy, s.x2 - s.cx))) return false;
    d = std::abs(dc - s.r);
    fx = s.cx + (x - s.cx) / dc * s.r;
    fy = s.cy + (y - s.cy) / dc * s.r;
    return true;
  }
  return false;
}
}  // namespace

bool Dessin::outilPlan() const {  // SK_PL_TOOLS
  switch (outil_) {
    case LIGNE: case RECTANGLE: case OBLONG: case CERCLE: case POLYGONE: case ARC: case POINT_C: case PERCAGE: case SPLINE: case CSPLINE: case COTE:
      return true;
    default:
      return false;
  }
}

const Dessin::CiblesPlan& Dessin::ciblesPlan() const {  // skPlBuild
  if (ciblesFaites_) return cibles_;
  ciblesFaites_ = true;
  cibles_ = CiblesPlan{};
  const std::vector<Arete3D>* L = planActif && aretes3D ? aretes3D() : nullptr;
  if (!L) return cibles_;
  std::vector<FormePlan>& E = cibles_.E;
  std::vector<PointPlan>& P = cibles_.P;
  const auto z = [&](const Vec3& p) { return (p[0] - s_.o[0]) * s_.n[0] + (p[1] - s_.o[1]) * s_.n[1] + (p[2] - s_.o[2]) * s_.n[2]; };
  const auto en2d = [&](const Vec3& p) { return P2d{(p[0] - s_.o[0]) * s_.u[0] + (p[1] - s_.o[1]) * s_.u[1] + (p[2] - s_.o[2]) * s_.u[2], (p[0] - s_.o[0]) * s_.v[0] + (p[1] - s_.o[1]) * s_.v[1] + (p[2] - s_.o[2]) * s_.v[2]}; };
  std::set<std::string> vus;
  const auto k = [](double x) {  // (Math.round(x*1e4)/1e4).toFixed(4)
    double v = std::floor(x * 1e4 + 0.5) / 1e4;
    if (v == 0) v = 0;
    char b[64];
    snprintf(b, sizeof b, "%.4f", v);
    return std::string(b);
  };
  const auto cle = [&](const FormePlan& s) {
    if (s.sorte == FormePlan::CERCLE) return "c" + k(s.cx) + k(s.cy) + k(s.r);
    if (s.sorte == FormePlan::COURBE) {
      std::string o = "s";
      for (size_t i = 0; i < s.pts.size(); i++) o += (i ? "," : "") + k(s.pts[i][0]) + k(s.pts[i][1]);
      return o;
    }
    std::string a = k(s.x1) + "," + k(s.y1), b = k(s.x2) + "," + k(s.y2);
    if (b < a) std::swap(a, b);
    return std::string(s.sorte == FormePlan::ARC ? "arc" : "line") + a + ";" + b + (s.sorte == FormePlan::ARC ? k(s.cx) + k(s.cy) : "");
  };
  const auto ajouterForme = [&](const FormePlan& s) {
    if (vus.insert(cle(s)).second) E.push_back(s);
  };
  struct Traverse {
    double x, y;
    bool aMid;
    Vec3 mid;
  };
  std::vector<Traverse> traverses;
  std::vector<FormePlan> loin;
  for (const Arete3D& e : *L) {
    if (e.pts.size() < 2) continue;
    bool dans = true;
    for (const Vec3& p : e.pts) dans = dans && std::abs(z(p)) < TOL_Z_PLAN;
    std::vector<P2d> p2;
    for (const Vec3& p : e.pts) p2.push_back(en2d(p));
    FormePlan s;
    if (dans) {
      if (formeDe(p2, s)) {
        s.aMid = true;
        s.mid = e.mid;
        ajouterForme(s);
      }
      continue;
    }
    for (const P2d& q : touchesPlan(s_, e.pts)) traverses.push_back({q[0], q[1], true, e.mid});
    if (formeDe(p2, s)) {
      s.loin = true;
      s.aMid = true;
      s.mid = e.mid;
      loin.push_back(std::move(s));
    }
  }
  const int nIn = static_cast<int>(E.size());
  for (const FormePlan& s : loin) ajouterForme(s);
  const auto pres = [&](double x, double y) -> PointPlan* {
    for (PointPlan& p : P)
      if (hyp(p.x - x, p.y - y) < 1e-4) return &p;
    return nullptr;
  };
  const auto ajouterPt = [&](PointPlan::Sorte sorte, double x, double y, int i) {
    if (PointPlan* q = pres(x, y)) {
      if (std::find(q->e.begin(), q->e.end(), i) == q->e.end() && !(i >= nIn && std::any_of(q->e.begin(), q->e.end(), [&](int j) { return j < nIn; }))) q->e.push_back(i);
      return;
    }
    PointPlan p;
    p.sorte = sorte;
    p.x = x;
    p.y = y;
    p.e = {i};
    p.loin = i >= nIn;
    P.push_back(std::move(p));
  };
  const auto ptsDe = [&](bool lo) {
    for (int i = 0; i < static_cast<int>(E.size()); i++) {
      if ((i >= nIn) != lo) continue;
      const FormePlan& s = E[i];
      if (s.sorte == FormePlan::LIGNE || s.sorte == FormePlan::ARC) {
        ajouterPt(PointPlan::BOUT, s.x1, s.y1, i);
        ajouterPt(PointPlan::BOUT, s.x2, s.y2, i);
      } else if (s.sorte == FormePlan::COURBE) {
        ajouterPt(PointPlan::BOUT, s.pts[0][0], s.pts[0][1], i);
        ajouterPt(PointPlan::BOUT, s.pts.back()[0], s.pts.back()[1], i);
      }
    }
    // Centres et milieux après les sommets : un sommet confondu garde sa nature de sommet
    for (int i = 0; i < static_cast<int>(E.size()); i++) {
      if ((i >= nIn) != lo) continue;
      const FormePlan& s = E[i];
      PointPlan p;
      p.e = {i};
      p.loin = lo;
      if (s.sorte == FormePlan::LIGNE) {
        p.x = (s.x1 + s.x2) / 2;
        p.y = (s.y1 + s.y2) / 2;
        p.sorte = PointPlan::MILIEU;
        if (!pres(p.x, p.y)) P.push_back(p);
      } else if (s.sorte != FormePlan::COURBE && !pres(s.cx, s.cy)) {
        p.x = s.cx;
        p.y = s.cy;
        p.sorte = PointPlan::CENTRE;
        P.push_back(p);
      }
    }
  };
  ptsDe(false);
  if (nIn <= 600)
    for (int i = 0; i < nIn; i++)
      for (int j = i + 1; j < nIn; j++)
        for (const P2d& q : croisementsPlan(E[i], E[j]))
          if (!pres(q[0], q[1])) {
            PointPlan p;
            p.sorte = PointPlan::CROISEMENT;
            p.x = q[0];
            p.y = q[1];
            p.e = {i, j};
            P.push_back(std::move(p));
          }
  for (const Traverse& q : traverses)
    if (!pres(q.x, q.y)) {
      PointPlan p;
      p.sorte = PointPlan::TRAVERSEE;
      p.x = q.x;
      p.y = q.y;
      p.aMid = q.aMid;
      p.mid = q.mid;
      P.push_back(std::move(p));
    }
  ptsDe(true);
  return cibles_;
}

Dessin::CiblePlan Dessin::ciblePlan(double x, double y, bool sel) const {
  CiblePlan best;
  const CiblesPlan& T = ciblesPlan();
  if (T.E.empty() && T.P.empty()) return best;
  double bd = SNAP_;
  for (const PointPlan& p : T.P) {
    if (sel && p.sorte == PointPlan::CROISEMENT) continue;  // SK_PL_SELKINDS : bouts, milieux, centres, traversées
    const double d = hyp(p.x - x, p.y - y) * (p.loin ? 1.5 : 1);
    if (d < bd) {
      bd = d;
      best.existe = true;
      best.estPoint = true;
      best.p = p;
      best.x = p.x;
      best.y = p.y;
    }
  }
  if (best) return best;
  bd = PICK_;
  for (size_t i = 0; i < T.E.size(); i++) {
    double d, fx, fy;
    if (!piedForme(T.E[i], x, y, d, fx, fy)) continue;
    d *= T.E[i].loin ? 1.5 : 1;
    if (d < bd) {
      bd = d;
      best.existe = true;
      best.estPoint = false;
      best.i = static_cast<int>(i);
      best.x = fx;
      best.y = fy;
    }
  }
  return best;
}

bool Dessin::memeForme(const Entite& en, const FormePlan& s) const {
  const auto eq = [&](const std::string& id, double x, double y) {
    const Pt* p = s_.point(id);
    return p && hyp(p->x - x, p->y - y) < 1e-4;
  };
  if (s.sorte == FormePlan::LIGNE && en.t == "line") return (eq(en.p1, s.x1, s.y1) && eq(en.p2, s.x2, s.y2)) || (eq(en.p1, s.x2, s.y2) && eq(en.p2, s.x1, s.y1));
  if (s.sorte == FormePlan::CERCLE && en.t == "circle") return eq(en.pc, s.cx, s.cy) && std::abs(en.r - s.r) < 1e-4;
  if (s.sorte == FormePlan::ARC && en.t == "arc") return eq(en.pc, s.cx, s.cy) && std::abs(en.r - s.r) < 1e-4 && eq(en.pa, s.x1, s.y1) && eq(en.pb, s.x2, s.y2);
  if (s.sorte == FormePlan::COURBE && en.t == "spline" && !en.pts.empty()) {
    const P2d a = s.pts[0], b = s.pts.back();
    return (eq(en.pts[0], a[0], a[1]) && eq(en.pts.back(), b[0], b[1])) || (eq(en.pts[0], b[0], b[1]) && eq(en.pts.back(), a[0], a[1]));
  }
  return false;
}

const Entite* Dessin::areteDansEsquisse(int i) {
  const CiblesPlan& T = ciblesPlan();
  if (i < 0 || i >= static_cast<int>(T.E.size())) return nullptr;
  const FormePlan& s = T.E[i];
  for (const Entite& en : s_.entites)
    if (memeForme(en, s)) return &en;
  Projetable pr;
  pr.sorte = s.sorte == FormePlan::LIGNE ? Projetable::LIGNE : s.sorte == FormePlan::CERCLE ? Projetable::CERCLE : s.sorte == FormePlan::ARC ? Projetable::ARC : Projetable::COURBE;
  pr.x1 = s.x1;
  pr.y1 = s.y1;
  pr.x2 = s.x2;
  pr.y2 = s.y2;
  pr.cx = s.cx;
  pr.cy = s.cy;
  pr.r = s.r;
  pr.pts = s.pts;
  pr.aMid = s.aMid;
  pr.mid = s.mid;
  const std::string id = creerProjection(pr);
  return id.empty() ? nullptr : s_.entite(id);
}

void Dessin::poserSur(const std::string& pid, const Entite& en) {
  if (en.t == "line") {
    if (en.p1 == pid || en.p2 == pid || aContrainte([&](const Contrainte& c) { return c.type == "online" && c.p == pid && c.line == en.id; })) return;
    Contrainte c = contrainte("online");
    c.p = pid;
    c.line = en.id;
    lier(c);
  } else if (en.t == "circle" || en.t == "arc") {
    if (en.pa == pid || en.pb == pid || aContrainte([&](const Contrainte& c) { return c.type == "oncircle" && c.p == pid && c.ent == en.id; })) return;
    Contrainte c = contrainte("oncircle");
    c.p = pid;
    c.ent = en.id;
    lier(c);
  } else if (en.t == "spline") {
    if (aContrainte([&](const Contrainte& c) { return c.type == "onspline" && c.p == pid && c.ent == en.id; })) return;
    Contrainte c = contrainte("onspline");
    c.p = pid;
    c.ent = en.id;
    lier(c);
  }
}

std::string Dessin::materialiser(const CiblePlan& h) {
  if (!h) return "";
  const CiblesPlan& T = ciblesPlan();
  if (!h.estPoint) {
    const Entite* en = areteDansEsquisse(h.i);
    const Entite copie = en ? *en : Entite{};  // ajouter un point peut déplacer la liste
    const std::string pid = ajouterPoint(h.x, h.y);
    if (en) poserSur(pid, copie);
    return pid;
  }
  const PointPlan p = h.p;
  const auto eq = [&](const std::string& id) {
    const Pt* q = s_.point(id);
    return q && hyp(q->x - p.x, q->y - p.y) < 1e-4;
  };
  if (p.sorte == PointPlan::BOUT) {
    // L'arête déjà projetée d'abord, sinon une ligne, sinon un arc (le sommet en est une extrémité)
    const auto rang = [&](int i) {
      const FormePlan& s = T.E[i];
      const bool deja = std::any_of(s_.entites.begin(), s_.entites.end(), [&](const Entite& en) { return memeForme(en, s); });
      return (deja ? 0 : 10) + (s.sorte == FormePlan::LIGNE ? 0 : s.sorte == FormePlan::ARC ? 1 : 2);
    };
    std::vector<int> ordre = p.e;
    std::stable_sort(ordre.begin(), ordre.end(), [&](int a, int b) { return rang(a) < rang(b); });
    if (const Entite* en = areteDansEsquisse(ordre[0])) {
      std::vector<std::string> bouts;
      if (en->t == "line") bouts = {en->p1, en->p2};
      else if (en->t == "arc") bouts = {en->pa, en->pb};
      else if (en->t == "spline") bouts = {en->pts.front(), en->pts.back()};
      for (const std::string& q : bouts)
        if (eq(q)) return q;
    }
    return ajouterPoint(p.x, p.y);
  }
  if (p.sorte == PointPlan::CENTRE) {
    const Entite* en = areteDansEsquisse(p.e[0]);
    return en && !en->pc.empty() ? en->pc : ajouterPoint(p.x, p.y);
  }
  const std::string pid = ajouterPoint(p.x, p.y);
  if (p.sorte == PointPlan::MILIEU) {
    const Entite* en = areteDansEsquisse(p.e[0]);
    if (en && en->t == "line") {
      Contrainte c = contrainte("midpoint");
      c.p = pid;
      c.line = en->id;
      lier(c);
    }
  } else if (p.sorte == PointPlan::CROISEMENT) {
    for (const int i : p.e)
      if (const Entite* en = areteDansEsquisse(i)) {
        const Entite copie = *en;
        poserSur(pid, copie);
      }
  } else if (p.sorte == PointPlan::TRAVERSEE) {
    Contrainte c = contrainte("fix");
    c.p = pid;
    lier(c);
    Entite e;
    e.id = nouvelE();
    e.t = "cpoint";
    e.p = pid;
    e.construction = true;
    e.proj = true;
    e.pierce = true;
    Projetable pr;
    pr.aMid = p.aMid;
    pr.mid = p.mid;
    nommer(e, pr);
    s_.entites.push_back(e);
    structure_ = true;
  }
  return pid;
}

void Dessin::pousserSiPlan(double x, double y) {
  if (!outilPlan()) return;
  if (!pointProche(x, y, SNAP_).empty()) return;
  if (ciblePlan(x, y)) pousser();
}

bool Dessin::preparerCotePlan(double x, double y) {
  if (!pointProche(x, y, PT_).empty() || entiteProche(x, y, PICK_)) return false;
  const CiblePlan h = ciblePlan(x, y);
  if (!h) return false;
  pousser();
  if (!h.estPoint) areteDansEsquisse(h.i);
  else materialiser(h);
  survolPlan_ = CiblePlan{};
  return true;
}

bool Dessin::choisirPlan(double x, double y, bool multi) {
  const CiblePlan h = ciblePlan(x, y, true);
  if (!h) return false;
  pousser();
  bool trouve = false;
  Choix c;
  if (!h.estPoint) {
    if (const Entite* en = areteDansEsquisse(h.i)) {
      c = {Choix::ENTITE, en->id};
      trouve = true;
    }
  } else if (h.p.sorte == PointPlan::CENTRE) {
    if (const Entite* en = areteDansEsquisse(h.p.e[0])) {
      c = !en->pc.empty() ? Choix{Choix::POINT, en->pc} : Choix{Choix::ENTITE, en->id};
      trouve = true;
    }
  } else {
    const std::string pid = materialiser(h);
    if (!pid.empty()) {
      c = {Choix::POINT, pid};
      trouve = true;
    }
  }
  if (!trouve) {
    if (annulerPas) annulerPas();
    return false;
  }
  if (multi && !selection_.empty()) {
    if (std::find(selection_.begin(), selection_.end(), c) == selection_.end()) selection_.push_back(c);
  } else {
    sansTete_ = false;
    selection_ = {c};
  }
  survolPlan_ = CiblePlan{};
  apresEdition();
  return true;
}
