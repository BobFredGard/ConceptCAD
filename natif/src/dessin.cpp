#include "dessin.h"

#include <algorithm>
#include <charconv>
#include <cmath>
#include <cstdio>

#include "maths_js.h"

namespace {
constexpr double PI_ = 3.141592653589793, SK_OK = 0.05;

// Number.prototype.toFixed : le plus proche, et le plus grand en cas d'égalité exacte (printf choisit le pair)
double fixe(double v, int chiffres) {
  char b[512];
  snprintf(b, sizeof b, "%.*f", chiffres + 60, v);  // tous les chiffres exacts du nombre
  std::string t(b);
  const size_t coupe = t.size() - 60;
  const bool plus = t[coupe] >= '5';
  t.resize(coupe);
  if (plus) {
    for (size_t i = t.size(); i-- > 0;) {
      if (t[i] == '.' || t[i] == '-') continue;
      if (t[i] == '9') {
        t[i] = '0';
        if (i == 0 || (i == 1 && t[0] == '-')) t.insert(i, 1, '1');
        else continue;
        break;
      }
      t[i]++;
      break;
    }
  }
  double r = 0;
  std::from_chars(t.data(), t.data() + t.size(), r);  // sans dépendre des réglages régionaux
  return r;
}

double distSeg(double px, double py, const Pt& A, const Pt& B) {
  const double dx = B.x - A.x, dy = B.y - A.y;
  double L2 = dx * dx + dy * dy;
  if (L2 == 0) L2 = 1e-9;
  double t = ((px - A.x) * dx + (py - A.y) * dy) / L2;
  t = jsmax(0, jsmin(1, t));
  return hyp(px - (A.x + t * dx), py - (A.y + t * dy));
}
bool dansArc(double a, double a1, double a2) {  // angInArc
  const double T = PI_ * 2;
  double d = std::fmod(a2 - a1, T);
  if (d < 0) d += T;
  double r = std::fmod(a - a1, T);
  if (r < 0) r += T;
  return r <= d;
}
struct An {
  double a1, a2;
};
bool anglesArc2(const Esquisse& s, const Entite& e, An& o) {  // arcAngles
  const Pt* C = s.point(e.pc);
  const Pt* A = s.point(e.pa);
  const Pt* B = s.point(e.pb);
  if (!C || !A || !B) return false;
  const double a1 = m_atan2(A->y - C->y, A->x - C->x);
  if (e.pa == e.pb) {
    o = {a1, a1 + PI_ * 2};
    return true;
  }
  const double a2 = m_atan2(B->y - C->y, B->x - C->x);
  double d = std::fmod(a2 - a1, PI_ * 2);
  if (d <= 0) d += PI_ * 2;
  o = {a1, a1 + d};
  return true;
}
std::string paire(const std::string& x, const std::string& y) { return x < y ? x + "|" + y : y + "|" + x; }
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
Contrainte contrainte(const char* type) {
  Contrainte c;
  c.type = type;
  return c;
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
  for (const Choix& c : selection_)
    if (c.sorte == so && c.id == id) return true;
  return false;
}

bool Dessin::departTrace(Pt& p) const {
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
  std::set<std::string> ref{"O", chaine_, arcC_, glisseP_};
  if (bas_.actif) ref.insert(bas_.pid);
  ref.erase("");
  for (const Entite& e : s_.entites)
    for (const std::string* q : {&e.p1, &e.p2, &e.p, &e.pc, &e.pa, &e.pb})
      if (!q->empty()) ref.insert(*q);
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

const Entite* Dessin::entiteProche(double x, double y, double maxD) const {
  const Entite* best = nullptr;
  double bd = maxD;
  for (const Entite& e : s_.entites) {
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
    }
    if (d < bd) {
      bd = d;
      best = &e;
    }
  }
  return best;
}

Dessin::Accroche Dessin::accroche(double x, double y, const std::string& sauf) const {
  Accroche a;
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
      } else if (c.type == "oncircle") {
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

void Dessin::enfonce(double wx, double wy, bool ctrl) {
  premiere();
  sync();
  if (outil_ == SELECTION) {
    const std::string pid = pointProche(wx, wy, PT_);
    if (!pid.empty()) {
      if (ctrl) {
        selection_.push_back({Choix::POINT, pid});
        return;
      }
      selection_ = {{Choix::POINT, pid}};
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
    const Entite* en = entiteProche(wx, wy, PICK_);
    if (en) {
      const Entite e = *en;
      if (ctrl) {
        if (!(selection_.size() && selection_[0] == Choix{Choix::ENTITE, e.id})) selection_.push_back({Choix::ENTITE, e.id});
      } else {
        selection_ = {{Choix::ENTITE, e.id}};
      }
      const Compo comp0 = composante(ptsEntite(e));
      const bool rig = rigide(comp0);
      Compo comp;
      if (rig) {
        comp = comp0;
      } else {
        for (const std::string& q : ptsEntite(e))
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
    if (!ctrl) selection_.clear();
    return;
  }
  if (outil_ == LIGNE) {
    if (bas_.actif) {
      bas_.clique = true;
      return;
    }
    const bool depuisChaine = !chaine_.empty();
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
  if (outil_ == RECTANGLE || outil_ == CERCLE) {
    if (bas_.actif) return;
    const std::string pid = pointAccroche(wx, wy);
    const Pt& S = *s_.point(pid);
    bas_ = Bas{};
    bas_.actif = true;
    bas_.pid = pid;
    bas_.x = S.x;
    bas_.y = S.y;
    bas_.centre = ctrl && outil_ != CERCLE;
    return;
  }
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
}

void Dessin::bouge(double wx, double wy) {
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
  if (!bas_.actif && glisseP_.empty() && (outil_ == LIGNE || outil_ == ARC)) {
    const Accroche a = accroche(wx, wy);
    aMarque_ = static_cast<bool>(a);
    marque_ = {a.x, a.y};
  }
}

void Dessin::bougerLigne(double wx, double wy) {
  double gx = wx, gy = wy;
  guide_ = Guide{};
  aMarque_ = false;
  const Accroche s = accroche(wx, wy, bas_.pid);
  if (s.sorte == Accroche::POINT) {
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
    if (grille && !s) {
      if (!guide_.v) gx = surGrille(gx);
      if (!guide_.h) gy = surGrille(gy);
    }
  }
  const double dxB = gx - bas_.x, dyB = gy - bas_.y, lenB = hyp(dxB, dyB);
  if (lenB > 1e-6) {
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
  for (const std::string* q : {&A, &Bp, &Cp, &D})
    if (const Pt* pp = s_.point(*q)) accrocher(*q, pp->x, pp->y, -1);
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
  outil_ = SELECTION;
  message("Rectangle créé.");
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
  Entite nc;
  nc.id = nouvelE();
  nc.t = "circle";
  nc.pc = bas_.pid;
  nc.r = r;
  s_.entites.push_back(nc);
  structure_ = true;
  if (const Pt* cp = s_.point(nc.pc)) accrocher(nc.pc, cp->x, cp->y, 1e-3);
  if (s.sorte == Accroche::POINT && s.id != nc.pc && !aContrainte([&](const Contrainte& c) { return c.type == "oncircle" && c.p == s.id && c.ent == nc.id; })) {
    Contrainte c = contrainte("oncircle");
    c.p = s.id;
    c.ent = nc.id;
    lier(c);
  }
  bas_ = Bas{};
  brouillon_ = Brouillon{};
  apresEdition();
  message("Cercle créé : cliquez le centre du suivant (Échap : fin).");
}

void Dessin::relache(double wx, double wy) {
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
  if (outil_ == LIGNE && bas_.actif) relacherLigne(wx, wy);
  else if (outil_ == RECTANGLE && bas_.actif) relacherRectangle(wx, wy);
  else if (outil_ == CERCLE && bas_.actif) relacherCercle(wx, wy);
}

std::string Dessin::doubleClic(double wx, double wy) {
  premiere();
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
  chaine_.clear();
  arcC_.clear();
  arcA1Pose_ = false;
  arcPa_.clear();
  brouillon_ = Brouillon{};
  bas_ = Bas{};
  glisseP_.clear();
  glisseE_ = GlisseE{};
  ed_.solveur.glisserOublier();
  guide_ = Guide{};
  aMarque_ = false;
  nettoyer();
}

void Dessin::choisirOutil(Outil o) {
  annulerTrace();
  outil_ = o;
}

void Dessin::echap() {
  annulerTrace();
  outil_ = SELECTION;
  message("Sélection.");
}

void Dessin::choisirCote(const std::string& id) { selection_ = {{Choix::COTE, id}}; }

void Dessin::supprimer() {
  premiere();
  std::set<std::string> ents, pts, cotes;
  for (const Choix& c : selection_) {
    if (c.sorte == Choix::ENTITE) ents.insert(c.id);
    else if (c.sorte == Choix::POINT) pts.insert(c.id);
    else cotes.insert(c.id);
  }
  if (ents.empty() && pts.empty() && cotes.empty()) {
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
  s_.cotes.erase(std::remove_if(s_.cotes.begin(), s_.cotes.end(), [&](const Cote& d) { return cotes.count(d.id) > 0; }), s_.cotes.end());
  const size_t n = ents.size() + pts.size() + cotes.size();
  selection_.clear();
  structure_ = true;
  // cleanupSk retire les points orphelins : ceux qui ont été choisis ne servent plus à rien non plus
  nettoyer();
  structure_ = true;
  resoudre();
  message((origine ? std::string("L'origine est permanente, elle reste. ") : std::string()) + std::to_string(n) + " élément(s) supprimé(s) : Ctrl+Z pour annuler.");
}
