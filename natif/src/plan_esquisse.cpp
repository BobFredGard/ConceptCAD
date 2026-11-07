// L'esquisse de planche et le cartouche dessiné : solveur, outils, contraintes, aides d'édition
// (src/98-mep-40-esquisse-planche.js, src/98-mep-75-esquisse-solveur-dessin.js, modèle Standard de 98-mep-50).
#include <windows.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <map>
#include <set>
#include <string>
#include <vector>

#include "plan_interne.h"

namespace plan {
namespace {
using S = std::string;
const char* const REFS_PT[4] = {"p1", "p2", "pc", "p"};

bool dansListe(const std::vector<S>& v, const S& x) { return std::find(v.begin(), v.end(), x) != v.end(); }
const J* ptDe(const J& sk, const S& id) {
  const J& p = sous(sk, "pts");
  if (id.empty() || !p.is_object()) return nullptr;
  const auto it = p.find(id);
  return it == p.end() ? nullptr : &*it;
}
J* entDe(J& sk, const S& id) {
  if (!sk.contains("ents")) return nullptr;
  for (J& e : sk["ents"])
    if (chaine(e, "id") == id) return &e;
  return nullptr;
}
const J* entDe(const J& sk, const S& id) { return entDe(const_cast<J&>(sk), id); }
int numeroSuivant(J& sk) {
  const int n = static_cast<int>(num(sk, "seq", 1));
  sk["seq"] = n + 1;
  return n;
}
S ajouterPoint(J& sk, double x, double y) {  // mepSkPt
  const S id = "p" + std::to_string(numeroSuivant(sk));
  sk["pts"][id] = J{{"x", x}, {"y", y}};
  return id;
}
J& ajouterEnt(J& sk, J e) {  // mepSkEnt
  e["id"] = "e" + std::to_string(numeroSuivant(sk));
  sk["ents"].push_back(std::move(e));
  return sk["ents"].back();
}
J& ajouterCons(J& sk, J c) {  // mepSkCons
  c["id"] = "c" + std::to_string(numeroSuivant(sk));
  sk["cons"].push_back(std::move(c));
  return sk["cons"].back();
}
J& assurer(J& sh) {  // mepSkEnsure
  if (!vrai(sh, "sk")) sh["sk"] = J{{"pts", J::object()}, {"ents", J::array()}, {"cons", J::array()}, {"seq", 1}};
  J& sk = sh["sk"];
  if (!vrai(sk, "pts")) sk["pts"] = J::object();
  if (!sk.contains("ents") || !sk["ents"].is_array()) sk["ents"] = J::array();
  if (!sk.contains("cons") || !sk["cons"].is_array()) sk["cons"] = J::array();
  if (!vrai(sk, "seq")) sk["seq"] = 1;
  return sk;
}
struct SkCtx {
  J* sk = nullptr;
  double ox = 0, oy = 0;
  bool tb = false;
};
SkCtx contexte(J& sh, const EtatEsquisse& et, bool creer) {  // mepSkCtx
  SkCtx c;
  if (et.tbEdit && cartoucheDessine(sh)) {
    ancreCartouche(sh, c.ox, c.oy);
    c.sk = &sh["title"]["tb"]["sk"];
    c.tb = true;
    return c;
  }
  if (creer) c.sk = &assurer(sh);
  else if (vrai(sh, "sk")) c.sk = &sh["sk"];
  return c;
}

// ---- Le solveur : Levenberg-Marquardt, jacobien numérique creux (mepSkSolve) ----
enum Type { COINC, HORIZ, VERT, PARA, PERP, TANG, EGAL, DIST, RAYON, ANGLE, SUR_LIGNE, SUR_CERCLE, MILIEU, DIST_X, DIST_Y, DIST_PL, EG_R, AUTRE };
Type typeDe(const S& t) {
  static const std::map<S, Type> M = {{"coincident", COINC}, {"horizontal", HORIZ}, {"vertical", VERT}, {"parallel", PARA}, {"perp", PERP}, {"tangent", TANG}, {"equal", EGAL}, {"dist", DIST}, {"radius", RAYON}, {"angle", ANGLE}, {"onLine", SUR_LIGNE}, {"onCircle", SUR_CERCLE}, {"midpoint", MILIEU}, {"distX", DIST_X}, {"distY", DIST_Y}, {"distPL", DIST_PL}, {"eqR", EG_R}};
  const auto it = M.find(t);
  return it == M.end() ? AUTRE : it->second;
}
struct SolEnt {
  char t = 0;  // l, c, a, autre
  int p1 = -1, p2 = -1, pc = -1, p = -1;
  double r = 0;
  bool aR = false;
};
struct SolCon {
  Type type = AUTRE;
  int a = -1, b = -1, p = -1;      // les points
  int ea = -1, eb = -1, ent = -1;  // les éléments
  double val = 0;
  J* source = nullptr;
  bool echange = false;
  std::vector<int> colonnes;
};
struct Solveur {
  std::vector<double> x, y;
  std::vector<SolEnt> ents;
  int residu(SolCon& c, double* r) {
    switch (c.type) {
      case COINC:
        if (c.a < 0 || c.b < 0) return 0;
        r[0] = x[c.a] - x[c.b], r[1] = y[c.a] - y[c.b];
        return 2;
      case HORIZ:
        if (c.a < 0 || c.b < 0) return 0;
        r[0] = y[c.a] - y[c.b];
        return 1;
      case VERT:
        if (c.a < 0 || c.b < 0) return 0;
        r[0] = x[c.a] - x[c.b];
        return 1;
      case PARA:
      case PERP: {
        if (c.ea < 0 || c.eb < 0) return 0;
        const SolEnt& A = ents[c.ea];
        const SolEnt& B = ents[c.eb];
        if (A.p1 < 0 || A.p2 < 0 || B.p1 < 0 || B.p2 < 0) return 0;
        const double d1x = x[A.p2] - x[A.p1], d1y = y[A.p2] - y[A.p1], d2x = x[B.p2] - x[B.p1], d2y = y[B.p2] - y[B.p1];
        r[0] = c.type == PARA ? d1x * d2y - d1y * d2x : d1x * d2x + d1y * d2y;
        return 1;
      }
      case TANG: {
        if (c.ea < 0 || c.eb < 0) return 0;
        const SolEnt* L = &ents[c.ea];
        const SolEnt* C = &ents[c.eb];
        if (L->t == 'l' && (C->t == 'c' || C->t == 'a')) {
        } else if (C->t == 'l' && (L->t == 'c' || L->t == 'a')) {
          std::swap(c.ea, c.eb);
          c.echange = !c.echange;
          std::swap(L, C);
        } else {
          return 0;
        }
        if (L->p1 < 0 || L->p2 < 0 || C->pc < 0) return 0;
        const double dx = x[L->p2] - x[L->p1], dy = y[L->p2] - y[L->p1];
        double L2 = std::hypot(dx, dy);
        if (L2 == 0) L2 = 1;
        r[0] = std::abs((x[C->pc] - x[L->p1]) * dy - (y[C->pc] - y[L->p1]) * dx) / L2 - C->r;
        return 1;
      }
      case EGAL: {
        if (c.ea < 0 || c.eb < 0) return 0;
        const auto lon = [&](const SolEnt& e, double& l) {
          if (e.t == 'l') {
            if (e.p1 < 0 || e.p2 < 0) return false;
            l = std::hypot(x[e.p2] - x[e.p1], y[e.p2] - y[e.p1]);
            return true;
          }
          if (e.t == 'c') {
            l = 2 * PI * e.r;
            return true;
          }
          return false;
        };
        double la, lb;
        if (!lon(ents[c.ea], la) || !lon(ents[c.eb], lb)) return 0;
        r[0] = la - lb;
        return 1;
      }
      case DIST:
        if (c.a < 0 || c.b < 0) return 0;
        r[0] = std::hypot(x[c.b] - x[c.a], y[c.b] - y[c.a]) - c.val;
        return 1;
      case RAYON: {
        if (c.ea < 0) return 0;
        const SolEnt& C = ents[c.ea];
        if (C.t != 'c' && C.t != 'a') return 0;
        r[0] = C.r - c.val;
        return 1;
      }
      case ANGLE: {
        if (c.ea < 0 || c.eb < 0) return 0;
        const SolEnt& A = ents[c.ea];
        const SolEnt& B = ents[c.eb];
        if (A.p1 < 0 || A.p2 < 0 || B.p1 < 0 || B.p2 < 0) return 0;
        double d = std::atan2(y[B.p2] - y[B.p1], x[B.p2] - x[B.p1]) - std::atan2(y[A.p2] - y[A.p1], x[A.p2] - x[A.p1]);
        while (d <= -PI) d += 2 * PI;
        while (d > PI) d -= 2 * PI;
        r[0] = d - c.val;
        return 1;
      }
      case SUR_LIGNE:
      case DIST_PL: {
        if (c.p < 0 || c.ent < 0) return 0;
        const SolEnt& L = ents[c.ent];
        if (L.t != 'l' || L.p1 < 0 || L.p2 < 0) return 0;
        const double dx = x[L.p2] - x[L.p1], dy = y[L.p2] - y[L.p1];
        double L2 = std::hypot(dx, dy);
        if (L2 == 0) L2 = 1;
        r[0] = ((x[c.p] - x[L.p1]) * dy - (y[c.p] - y[L.p1]) * dx) / L2 - (c.type == DIST_PL ? c.val : 0);
        return 1;
      }
      case SUR_CERCLE: {
        if (c.p < 0 || c.ent < 0) return 0;
        const SolEnt& C = ents[c.ent];
        if ((C.t != 'c' && C.t != 'a') || C.pc < 0) return 0;
        r[0] = std::hypot(x[c.p] - x[C.pc], y[c.p] - y[C.pc]) - C.r;
        return 1;
      }
      case MILIEU:
        if (c.p < 0 || c.a < 0 || c.b < 0) return 0;
        r[0] = x[c.p] - (x[c.a] + x[c.b]) / 2, r[1] = y[c.p] - (y[c.a] + y[c.b]) / 2;
        return 2;
      case DIST_X:
        if (c.a < 0 || c.b < 0) return 0;
        r[0] = (x[c.b] - x[c.a]) - c.val;
        return 1;
      case DIST_Y:
        if (c.a < 0 || c.b < 0) return 0;
        r[0] = (y[c.b] - y[c.a]) - c.val;
        return 1;
      case EG_R: {
        if (c.ea < 0 || c.eb < 0) return 0;
        const SolEnt& A = ents[c.ea];
        const SolEnt& B = ents[c.eb];
        if (!A.aR || !B.aR) return 0;
        r[0] = A.r - B.r;
        return 1;
      }
      default:
        return 0;
    }
  }
};
bool resoudreDense(std::vector<double> M, std::vector<double> b, int n, std::vector<double>& s) {  // mepSolveDense
  for (int col = 0; col < n; col++) {
    int piv = col;
    for (int r = col + 1; r < n; r++)
      if (std::abs(M[r * n + col]) > std::abs(M[piv * n + col])) piv = r;
    if (std::abs(M[piv * n + col]) < 1e-14) return false;
    if (piv != col) {
      for (int c = 0; c < n; c++) std::swap(M[piv * n + c], M[col * n + c]);
      std::swap(b[piv], b[col]);
    }
    const double d = M[col * n + col];
    for (int r = col + 1; r < n; r++) {
      const double f = M[r * n + col] / d;
      if (f == 0) continue;
      for (int c = col; c < n; c++) M[r * n + c] -= f * M[col * n + c];
      b[r] -= f * b[col];
    }
  }
  s.assign(n, 0);
  for (int i = n - 1; i >= 0; i--) {
    double v = b[i];
    for (int j = i + 1; j < n; j++) v -= M[i * n + j] * s[j];
    s[i] = v / M[i * n + i];
  }
  return true;
}
std::set<S> pointsFixes(const J& sk) {  // mepSkFixed
  std::set<S> s;
  const J& pts = sous(sk, "pts");
  if (pts.is_object() && pts.contains("o")) s.insert("o");
  const J& cons = sous(sk, "cons");
  if (cons.is_array())
    for (const J& c : cons)
      if (chaine(c, "type") == "fix" && vrai(c, "p")) s.insert(chaine(c, "p"));
  if (pts.is_object())
    for (auto it = pts.begin(); it != pts.end(); ++it)
      if (vrai(it.value(), "lk")) s.insert(it.key());
  return s;
}
void nettoyerCons(J& sk) {  // mepSkCleanCons
  const auto a = [&](const S& id) { return ptDe(sk, id) || entDe(sk, id); };
  J n = J::array();
  for (J& c : sk["cons"]) {
    bool bon = true;
    for (const char* k : {"a", "b", "p", "ent"})
      if (vrai(c, k) && !a(chaine(c, k))) bon = false;
    if (bon) n.push_back(std::move(c));
  }
  sk["cons"] = std::move(n);
}
void retirerEnt(J& sk, const S& id) {  // mepSkRmEnt
  const J* e0 = entDe(sk, id);
  if (!e0) return;
  const J e = *e0;
  J n = J::array();
  for (J& x : sk["ents"])
    if (chaine(x, "id") != id) n.push_back(std::move(x));
  sk["ents"] = std::move(n);
  std::set<S> servis{"o"};
  for (const J& x : sk["ents"])
    for (const char* k : REFS_PT)
      if (vrai(x, k)) servis.insert(chaine(x, k));
  for (const char* k : REFS_PT) {
    const S pid = chaine(e, k);
    if (!pid.empty() && !servis.count(pid)) sk["pts"].erase(pid);
  }
  nettoyerCons(sk);
}
void fusionnerPoints(J& sk, S garde, S parti) {  // mepSkMerge
  if (garde == parti || !ptDe(sk, garde) || !ptDe(sk, parti)) return;
  if (parti == "o") std::swap(garde, parti);
  if (vrai(sk["pts"][parti], "lk") && !vrai(sk["pts"][garde], "lk") && garde != "o") sk["pts"][garde]["lk"] = sk["pts"][parti]["lk"];
  for (J& e : sk["ents"])
    for (const char* k : REFS_PT)
      if (chaine(e, k) == parti) e[k] = garde;
  for (J& c : sk["cons"])
    for (const char* k : {"a", "b", "p"})
      if (chaine(c, k) == parti) c[k] = garde;
  sk["pts"].erase(parti);
  J ne = J::array();
  for (J& e : sk["ents"])
    if (!(chaine(e, "t") == "line" && chaine(e, "p1") == chaine(e, "p2"))) ne.push_back(std::move(e));
  sk["ents"] = std::move(ne);
  J nc = J::array();
  for (J& c : sk["cons"]) {
    const S t = chaine(c, "type");
    if (!((t == "horizontal" || t == "vertical" || t == "dist" || t == "coincident") && chaine(c, "a") == chaine(c, "b"))) nc.push_back(std::move(c));
  }
  sk["cons"] = std::move(nc);
  nettoyerCons(sk);
}
double mesure(const J& sk, const J& c) {  // mepSkMeasure
  const S t = chaine(c, "type");
  const J* a = ptDe(sk, chaine(c, "a"));
  const J* b = ptDe(sk, chaine(c, "b"));
  if (t == "dist") return a && b ? std::hypot(num(*b, "x") - num(*a, "x"), num(*b, "y") - num(*a, "y")) : 0;
  if (t == "distX") return a && b ? num(*b, "x") - num(*a, "x") : 0;
  if (t == "distY") return a && b ? num(*b, "y") - num(*a, "y") : 0;
  if (t == "distPL") {
    const J* p = ptDe(sk, chaine(c, "p"));
    const J* L = entDe(sk, chaine(c, "ent"));
    if (!p || !L) return 0;
    const J* A = ptDe(sk, chaine(*L, "p1"));
    const J* B = ptDe(sk, chaine(*L, "p2"));
    if (!A || !B) return 0;
    const double dx = num(*B, "x") - num(*A, "x"), dy = num(*B, "y") - num(*A, "y");
    double l = std::hypot(dx, dy);
    if (l == 0) l = 1;
    return ((num(*p, "x") - num(*A, "x")) * dy - (num(*p, "y") - num(*A, "y")) * dx) / l;
  }
  if (t == "radius") {
    const J* e = entDe(sk, chaine(c, "a"));
    return e ? num(*e, "r") : 0;
  }
  if (t == "angle") {
    const J* A = entDe(sk, chaine(c, "a"));
    const J* B = entDe(sk, chaine(c, "b"));
    if (!A || !B) return 0;
    const J* a1 = ptDe(sk, chaine(*A, "p1"));
    const J* a2 = ptDe(sk, chaine(*A, "p2"));
    const J* b1 = ptDe(sk, chaine(*B, "p1"));
    const J* b2 = ptDe(sk, chaine(*B, "p2"));
    if (!a1 || !a2 || !b1 || !b2) return 0;
    double d = std::atan2(num(*b2, "y") - num(*b1, "y"), num(*b2, "x") - num(*b1, "x")) - std::atan2(num(*a2, "y") - num(*a1, "y"), num(*a2, "x") - num(*a1, "x"));
    while (d <= -PI) d += 2 * PI;
    while (d > PI) d -= 2 * PI;
    return d;
  }
  return 0;
}

// ---- Les liens vers les vues (mepSkLink…) ----
J geoDeLien(const Ent& e) {
  if (e.t == 'L') return J{{"t", "L"}, {"x1", e.x1}, {"y1", e.y1}, {"x2", e.x2}, {"y2", e.y2}};
  return J{{"t", "C"}, {"cx", e.cx}, {"cy", e.cy}, {"r", e.r}};
}
J lienDeAccroche(Ctx& c, const Accroche& s) {  // mepSkLinkOfHit
  if (!s.hit || s.vid.empty()) return J();
  J* v = vueParId(c.sh, s.vid);
  if (!v) return J();
  J i;
  if (!s.ak.empty()) i = "ax:" + s.ak;
  else if (s.i >= 0) i = s.i;
  else return J();
  const auto e = entiteParHint(c, *v, J{{"i", i}});
  if (!e || !(e->t == 'L' || e->t == 'C' || e->t == 'A')) return J();
  const double sc = num(*v, "scale"), qx = (s.x - num(*v, "x")) / sc, qy = (s.y - num(*v, "y")) / sc;
  J lk = J::object();
  lk["vid"] = chaine(*v, "id");
  lk["i"] = i;
  if (i.is_number()) lk["g"] = geoDeLien(*e);
  if (e->t == 'L') {
    if (s.t == "mid" || s.t == "axMid") lk["k"] = "mid";
    else {
      const double d1 = std::hypot(qx - e->x1, qy - e->y1), d2 = std::hypot(qx - e->x2, qy - e->y2);
      double L = std::hypot(e->x2 - e->x1, e->y2 - e->y1);
      if (L == 0) L = 1;
      if (std::min(d1, d2) < L * 1e-4) lk["k"] = d1 <= d2 ? "p1" : "p2";
      else {
        lk["k"] = "f";
        lk["f"] = ((qx - e->x1) * (e->x2 - e->x1) + (qy - e->y1) * (e->y2 - e->y1)) / (L * L);
      }
    }
  } else if (s.t == "ctr") {
    lk["k"] = "ctr";
  } else {
    lk["k"] = "ang";
    lk["a"] = std::atan2(qy - e->cy, qx - e->cx);
  }
  return lk;
}
std::optional<Ent> elementDuLien(Ctx& c, J& v, J& lk) {  // mepSkLinkEl
  if (sous(lk, "i").is_string()) return entiteParHint(c, v, J{{"i", lk["i"]}});
  const std::vector<Ent>& els = c.calc.geoDe(v, c.sh, c.mep, c.piece).els;
  const J G = sous(lk, "g");
  const bool aG = G.is_object();
  const S famG = chaine(G, "t");
  const auto fam = [](const Ent& e) { return e.t == 'L' ? S("L") : (e.t == 'C' || e.t == 'A' ? S("C") : S()); };
  struct R {
    double d = INFINITY;
    bool sw = false;
  };
  const auto dist = [&](const Ent& e) {
    R r;
    if (!aG || fam(e) != famG) return r;
    if (famG == "C") {
      r.d = std::hypot(e.cx - num(G, "cx"), e.cy - num(G, "cy")) + std::abs(e.r - num(G, "r"));
      return r;
    }
    const double x1 = num(G, "x1"), y1 = num(G, "y1"), x2 = num(G, "x2"), y2 = num(G, "y2");
    const double a = std::hypot(e.x1 - x1, e.y1 - y1) + std::hypot(e.x2 - x2, e.y2 - y2), b = std::hypot(e.x1 - x2, e.y1 - y2) + std::hypot(e.x2 - x1, e.y2 - y1);
    r.d = a <= b ? a : b;
    r.sw = !(a <= b);
    return r;
  };
  const int i0 = static_cast<int>(num(lk, "i", -1));
  const bool dans = i0 >= 0 && i0 < static_cast<int>(els.size());
  if (!aG) return dans ? std::optional<Ent>(els[i0]) : std::nullopt;
  R r = dans ? dist(els[i0]) : R();
  int i = i0;
  if (!(r.d < 1e-3)) {  // numérotation changée ou pièce modifiée : l'élément le plus proche de même nature
    int bi = -1;
    R br;
    for (int j = 0; j < static_cast<int>(els.size()); j++) {
      const R q = dist(els[j]);
      if (q.d < br.d) br = q, bi = j;
    }
    if (bi < 0 || !(br.d < 3)) return std::nullopt;  // disparu : le point garde sa dernière position
    lk["i"] = bi;
    i = bi, r = br;
  }
  if (r.sw) {
    const S k = chaine(lk, "k");
    if (k == "p1") lk["k"] = "p2";
    else if (k == "p2") lk["k"] = "p1";
    else if (k == "f") lk["f"] = 1 - num(lk, "f");
  }
  lk["g"] = geoDeLien(els[i]);
  return els[i];
}
bool positionDuLien(Ctx& c, J& lk, double& X, double& Y) {  // mepSkLinkPos
  J* v = vueParId(c.sh, chaine(lk, "vid"));
  if (!v) return false;
  const auto e = elementDuLien(c, *v, lk);
  if (!e) return false;
  double x, y;
  const S k = chaine(lk, "k");
  if (e->t == 'L') {
    const double f = k == "p1" ? 0 : k == "p2" ? 1 : k == "mid" ? 0.5 : num(lk, "f");
    x = e->x1 + (e->x2 - e->x1) * f, y = e->y1 + (e->y2 - e->y1) * f;
  } else if (k == "ang") {
    x = e->cx + e->r * std::cos(num(lk, "a")), y = e->cy + e->r * std::sin(num(lk, "a"));
  } else {
    x = e->cx, y = e->cy;
  }
  if (!std::isfinite(x) || !std::isfinite(y)) return false;
  const double s = num(*v, "scale");
  X = num(*v, "x") + x * s, Y = num(*v, "y") + y * s;
  return true;
}

// ---- L'accrochage des outils (mepSkSnap) ----
SkPoint accrocherSk(Ctx& c, const SkCtx& ctx, double px, double py, double tol, double zoom) {
  SkPoint best;
  bool trouve = false;
  double bd = tol;
  const auto consider = [&](double x, double y, const SkPoint& o, double biais) {
    const double d = std::hypot(x - px, y - py) + biais;
    if (d < bd) {
      bd = d, best = o, best.x = x, best.y = y, trouve = true;
    }
  };
  if (ctx.sk) {
    J& sk = *ctx.sk;
    for (auto it = sk["pts"].begin(); it != sk["pts"].end(); ++it) {
      SkPoint o;
      o.pid = it.key();
      consider(num(it.value(), "x") + ctx.ox, num(it.value(), "y") + ctx.oy, o, -tol * 0.5);
    }
    for (const J& e : sk["ents"]) {
      const S t = chaine(e, "t");
      if (t == "line") {
        const J* A = ptDe(sk, chaine(e, "p1"));
        const J* B = ptDe(sk, chaine(e, "p2"));
        if (!A || !B) continue;
        const double ax = num(*A, "x") + ctx.ox, ay = num(*A, "y") + ctx.oy, bx = num(*B, "x") + ctx.ox, by = num(*B, "y") + ctx.oy;
        SkPoint m;
        m.midA = chaine(e, "p1"), m.midB = chaine(e, "p2");
        consider((ax + bx) / 2, (ay + by) / 2, m, -tol * 0.2);
        const double dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        if (L2 > 1e-12) {
          const double u = ((px - ax) * dx + (py - ay) * dy) / L2;
          if (u > 0 && u < 1) {
            SkPoint o;
            o.onT = "line", o.onId = chaine(e, "id");
            consider(ax + dx * u, ay + dy * u, o, tol * 0.3);
          }
        }
      } else if (t == "circle" || t == "arc") {
        const J* C = ptDe(sk, chaine(e, "pc"));
        if (!C) continue;
        const double cx = num(*C, "x") + ctx.ox, cy = num(*C, "y") + ctx.oy, r = num(e, "r"), an = std::atan2(py - cy, px - cx);
        SkPoint o;
        o.onT = "circle", o.onId = chaine(e, "id");
        consider(cx + r * std::cos(an), cy + r * std::sin(an), o, tol * 0.3);
      }
    }
  }
  if (trouve) return best;
  SkPoint r;
  r.x = px, r.y = py;
  if (ctx.tb) return r;
  Accroche s = accrocher(c, px, py, zoom);
  // « sur le trait / sur le cercle » près d'une extrémité, d'un milieu ou du centre : le point remarquable l'emporte
  J* v = !s.vid.empty() ? vueParId(c.sh, s.vid) : nullptr;
  if (v && (s.t == "onSeg" || s.t == "onC" || s.t == "onAx")) {
    J i;
    if (!s.ak.empty()) i = "ax:" + s.ak;
    else i = s.i;
    if (const auto e = entiteParHint(c, *v, J{{"i", i}})) {
      struct Cand {
        double x, y;
        const char* t;
      };
      std::vector<Cand> cand;
      if (e->t == 'L') cand = {{e->x1, e->y1, "end"}, {e->x2, e->y2, "end"}, {(e->x1 + e->x2) / 2, (e->y1 + e->y2) / 2, "mid"}};
      else if (e->t == 'C' || e->t == 'A') cand = {{e->cx, e->cy, "ctr"}};
      double d0 = tol;
      const double sc = num(*v, "scale"), vx = num(*v, "x"), vy = num(*v, "y");
      for (const Cand& q : cand) {
        const double qx = vx + q.x * sc, qy = vy + q.y * sc, d = std::hypot(qx - px, qy - py);
        if (d < d0) {
          d0 = d;
          const S qt = q.t;
          const S at0 = s.t;
          (void)at0;
          s.x = qx, s.y = qy;
          s.t = !s.ak.empty() && qt != "ctr" ? (qt == "end" ? "axEnd" : "axMid") : qt;
        }
      }
    }
  }
  r.x = s.x, r.y = s.y;
  r.vw = lienDeAccroche(c, s);
  return r;
}
S pointDepuis(const SkCtx& ctx, const SkPoint& pt) {  // mepSkPtFrom
  J& sk = *ctx.sk;
  if (!pt.pid.empty() && ptDe(sk, pt.pid)) return pt.pid;
  const S id = ajouterPoint(sk, pt.x - ctx.ox, pt.y - ctx.oy);
  if (!pt.vw.is_null() && !ctx.tb) {
    sk["pts"][id]["lk"] = pt.vw;  // tenu par la vue : ni « sur ligne » ni « milieu »
    return id;
  }
  if (!pt.onT.empty()) ajouterCons(sk, pt.onT == "line" ? J{{"type", "onLine"}, {"p", id}, {"ent", pt.onId}} : J{{"type", "onCircle"}, {"p", id}, {"ent", pt.onId}});
  else if (!pt.midA.empty() && ptDe(sk, pt.midA) && ptDe(sk, pt.midB)) ajouterCons(sk, J{{"type", "midpoint"}, {"p", id}, {"a", pt.midA}, {"b", pt.midB}});
  return id;
}
void autoHV(J& sk, const S& a, const S& b) {  // mepSkAutoHV
  const J* A = ptDe(sk, a);
  const J* B = ptDe(sk, b);
  if (!A || !B || (vrai(*A, "lk") && vrai(*B, "lk"))) return;
  const double dx = num(*B, "x") - num(*A, "x"), dy = num(*B, "y") - num(*A, "y");
  if (std::hypot(dx, dy) < 1e-6) return;
  const double ang = std::abs(std::atan2(dy, dx)) * 180 / PI;
  if (ang < 3 || ang > 177) ajouterCons(sk, J{{"type", "horizontal"}, {"a", a}, {"b", b}});
  else if (std::abs(ang - 90) < 3) ajouterCons(sk, J{{"type", "vertical"}, {"a", a}, {"b", b}});
}
J style(J e, const EtatEsquisse& et) {  // mepSkStyled
  const bool texte = chaine(e, "t") == "text";
  for (const char* k : {"w", "lw", "lt", "col", "cst"}) {
    if (texte && std::string(k) != "col") continue;
    if (!et.style.contains(k)) continue;
    const J& v = et.style[k];
    if (v.is_null() || (v.is_string() && v.get<S>().empty())) continue;
    e[k] = v;
  }
  return e;
}
S base36(unsigned long long n) {
  S s;
  do {
    s.insert(s.begin(), "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36]);
    n /= 36;
  } while (n);
  return s;
}
S champPerso() { return "c" + base36(static_cast<unsigned long long>(std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count())); }
double corps(double h, double noteH) { return js::arrondi((h != 0 ? h : noteH) / CAP_RATIO, 3); }  // mepFs

// ---- Ajuster (mepSkTrim) ----
struct Croise {
  double t;
  const J* o;
};
bool ajuster(J& sk, const SkCtx& ctx, double sx, double sy, double tol, S& message) {
  sx -= ctx.ox, sy -= ctx.oy;
  const J* e0 = nullptr;
  double bd = std::max(1.5, tol), tb = 0;
  for (const J& e : sk["ents"]) {
    if (chaine(e, "t") != "line") continue;
    const J* A = ptDe(sk, chaine(e, "p1"));
    const J* B = ptDe(sk, chaine(e, "p2"));
    if (!A || !B) continue;
    const double ax = num(*A, "x"), ay = num(*A, "y"), dx = num(*B, "x") - ax, dy = num(*B, "y") - ay, L2 = dx * dx + dy * dy;
    if (L2 < 1e-12) continue;
    const double t = std::max(0.0, std::min(1.0, ((sx - ax) * dx + (sy - ay) * dy) / L2));
    const double d = std::hypot(sx - (ax + dx * t), sy - (ay + dy * t));
    if (d < bd) bd = d, e0 = &e, tb = t;
  }
  if (!e0) {
    message = "Ajuster : cliquez le tronçon de ligne à retirer.";
    return false;
  }
  const J e = *e0;
  const S idE = chaine(e, "id"), p1 = chaine(e, "p1"), p2 = chaine(e, "p2");
  const double ax = num(sk["pts"][p1], "x"), ay = num(sk["pts"][p1], "y"), bx = num(sk["pts"][p2], "x"), by = num(sk["pts"][p2], "y");
  const double L = std::hypot(bx - ax, by - ay), eps = 1e-4 / std::max(L, 1e-9) + 1e-6;
  struct X {
    double t;
    S id, sorte;
  };
  std::vector<X> xs;
  for (const J& o : sk["ents"]) {
    if (chaine(o, "id") == idE || (vrai(o, "cst") && !vrai(e, "cst"))) continue;  // une construction ne coupe pas un trait réel
    const S t = chaine(o, "t");
    if (t == "line") {
      const J* C = ptDe(sk, chaine(o, "p1"));
      const J* D = ptDe(sk, chaine(o, "p2"));
      if (!C || !D) continue;
      const double dx1 = bx - ax, dy1 = by - ay, dx2 = num(*D, "x") - num(*C, "x"), dy2 = num(*D, "y") - num(*C, "y"), den = dx1 * dy2 - dy1 * dx2;
      if (std::abs(den) < 1e-12) continue;
      const double tt = ((num(*C, "x") - ax) * dy2 - (num(*C, "y") - ay) * dx2) / den, u = ((num(*C, "x") - ax) * dy1 - (num(*C, "y") - ay) * dx1) / den;
      if (u >= -1e-6 && u <= 1 + 1e-6 && tt > eps && tt < 1 - eps) xs.push_back({tt, chaine(o, "id"), "line"});
    } else if (t == "circle" || t == "arc") {
      const J* C = ptDe(sk, chaine(o, "pc"));
      if (!C) continue;
      const double cx = num(*C, "x"), cy = num(*C, "y"), r = num(o, "r");
      const auto surArc = [&](double x, double y) {
        if (t != "arc") return true;
        const J* P1 = ptDe(sk, chaine(o, "p1"));
        const J* P2 = ptDe(sk, chaine(o, "p2"));
        if (!P1 || !P2) return true;
        const double a0 = std::atan2(num(*P1, "y") - cy, num(*P1, "x") - cx), a1 = std::atan2(num(*P2, "y") - cy, num(*P2, "x") - cx), a = std::atan2(y - cy, x - cx);
        const auto n = [](double v) {
          while (v < 0) v += 2 * PI;
          while (v >= 2 * PI) v -= 2 * PI;
          return v;
        };
        return n(a - a0) <= n(a1 - a0) + 1e-6;
      };
      // interLineCircle
      const double dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      if (L2 < 1e-12) continue;
      const double t0 = ((cx - ax) * dx + (cy - ay) * dy) / L2, qx = ax + dx * t0, qy = ay + dy * t0;
      const double h2 = r * r - (qx - cx) * (qx - cx) - (qy - cy) * (qy - cy), GRAZE = 0.05;
      if (h2 < -GRAZE * GRAZE) continue;
      const double h = std::sqrt(std::max(h2, 0.0)), Lq = std::sqrt(L2);
      const auto essai = [&](double px, double py, double tt) {
        if (tt > eps && tt < 1 - eps && surArc(px, py)) xs.push_back({tt, chaine(o, "id"), "circle"});
      };
      if (h < GRAZE) essai(qx, qy, t0);
      else {
        essai(qx - dx / Lq * h, qy - dy / Lq * h, t0 - h / Lq);
        essai(qx + dx / Lq * h, qy + dy / Lq * h, t0 + h / Lq);
      }
    }
  }
  const X* lo = nullptr;
  const X* hi = nullptr;
  for (const X& q : xs) {
    if (q.t < tb) {
      if (!lo || q.t > lo->t) lo = &q;
    } else if (!hi || q.t < hi->t) {
      hi = &q;
    }
  }
  S hv;
  for (const J& c : sk["cons"]) {
    const S ty = chaine(c, "type"), a = chaine(c, "a"), b = chaine(c, "b");
    if ((ty == "horizontal" || ty == "vertical") && ((a == p1 && b == p2) || (a == p2 && b == p1))) {
      hv = ty;
      break;
    }
  }
  const auto morceau = [&](const S& a, const S& b) {
    J n = J{{"t", "line"}, {"p1", a}, {"p2", b}};
    for (const char* k : {"w", "lw", "lt", "col", "cst"})
      if (e.contains(k)) n[k] = e[k];
    ajouterEnt(sk, std::move(n));
    if (!hv.empty()) ajouterCons(sk, J{{"type", hv}, {"a", a}, {"b", b}});
  };
  const auto couper = [&](const X& q) {
    const S id = ajouterPoint(sk, ax + (bx - ax) * q.t, ay + (by - ay) * q.t);
    ajouterCons(sk, q.sorte == "line" ? J{{"type", "onLine"}, {"p", id}, {"ent", q.id}} : J{{"type", "onCircle"}, {"p", id}, {"ent", q.id}});
    return id;
  };
  if (lo) morceau(p1, couper(*lo));
  if (hi) morceau(couper(*hi), p2);
  retirerEnt(sk, idE);
  nettoyerCons(sk);
  resoudreEsquisse(sk, 60);
  message = lo || hi ? "Ajuster : tronçon retiré." : "Ajuster : aucune intersection — ligne entière retirée.";
  return true;
}

// ---- Géométrie, pour les cadres (mepSkEntPoly, mepBoxHitPoly) ----
struct Poly {
  std::vector<std::array<double, 2>> pts;
  bool ferme = false;
};
bool polyDe(Ctx& c, const SkCtx& ctx, const J& e, Poly& g) {
  const J& sk = *ctx.sk;
  const S t = chaine(e, "t");
  const auto P = [&](const char* k) { return ptDe(sk, chaine(e, k)); };
  const auto X = [&](const J* p) { return num(*p, "x") + ctx.ox; };
  const auto Y = [&](const J* p) { return num(*p, "y") + ctx.oy; };
  if (t == "line") {
    if (!P("p1") || !P("p2")) return false;
    g.pts = {{X(P("p1")), Y(P("p1"))}, {X(P("p2")), Y(P("p2"))}};
    return true;
  }
  if (t == "circle" || t == "arc") {
    const J* C = P("pc");
    if (!C) return false;
    double a0 = 0, a1 = 2 * PI;
    const double r = num(e, "r");
    if (t == "arc") {
      if (!P("p1") || !P("p2")) return false;
      a0 = std::atan2(num(*P("p1"), "y") - num(*C, "y"), num(*P("p1"), "x") - num(*C, "x"));
      a1 = std::atan2(num(*P("p2"), "y") - num(*C, "y"), num(*P("p2"), "x") - num(*C, "x"));
      while (a1 <= a0) a1 += 2 * PI;
    }
    const int n = t == "arc" ? 24 : 48;
    for (int i = 0; i <= n; i++) {
      const double a = a0 + (a1 - a0) * i / n;
      g.pts.push_back({X(C) + r * std::cos(a), Y(C) + r * std::sin(a)});
    }
    g.ferme = t == "circle";
    return true;
  }
  if (t == "text") {
    const J* P0 = P("p");
    if (!P0) return false;
    const double h = num(e, "h") != 0 ? num(e, "h") : 3.5;
    double w = std::max(h, longueurCar(texteEsquisse(c, e, true)) * h * 0.56);
    if (num(e, "mw") > 0) w = std::min(w, num(e, "mw"));
    const S al = chaine(e, "al");
    const double x0 = al == "middle" ? X(P0) - w / 2 : (al == "end" ? X(P0) - w : X(P0)), y = Y(P0);
    g.pts = {{x0, y - h * 0.75}, {x0 + w, y - h * 0.75}, {x0 + w, y}, {x0, y}};
    g.ferme = true;
    return true;
  }
  if (t == "logo") {
    if (!P("p1") || !P("p2")) return false;
    const double ax = X(P("p1")), ay = Y(P("p1")), bx = X(P("p2")), by = Y(P("p2"));
    g.pts = {{ax, ay}, {bx, ay}, {bx, by}, {ax, by}};
    g.ferme = true;
    return true;
  }
  return false;
}
const char* touchePoly(double x0, double y0, double x1, double y1, const Poly& g) {  // 'in', 'touch', null
  if (g.pts.empty()) return nullptr;
  const auto dans = [&](const std::array<double, 2>& p) { return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1; };
  size_t nb = 0;
  for (const auto& p : g.pts) nb += dans(p) ? 1 : 0;
  if (nb == g.pts.size()) return "in";
  if (nb) return "touch";
  const auto o = [](const std::array<double, 2>& p, const std::array<double, 2>& q, const std::array<double, 2>& r) {
    const double v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    return v > 0 ? 1 : v < 0 ? -1 : 0;
  };
  const std::array<double, 2> c[4] = {{x0, y0}, {x1, y0}, {x1, y1}, {x0, y1}};
  const size_t n = g.pts.size() - (g.ferme ? 0 : 1);
  for (size_t i = 0; i < n; i++) {
    const auto& a = g.pts[i];
    const auto& b = g.pts[(i + 1) % g.pts.size()];
    for (int k = 0; k < 4; k++) {
      const auto& p = c[k];
      const auto& q = c[(k + 1) % 4];
      if (o(a, b, p) != o(a, b, q) && o(p, q, a) != o(p, q, b)) return "touch";
    }
  }
  return nullptr;
}
}  // namespace

// ---- Publics ----
bool estOutilEsquisse(const std::string& t) { return t == "line" || t == "rect" || t == "circle" || t == "arc" || t == "point" || t == "trim" || t == "text" || t == "logo"; }

double resoudreEsquisse(J& sk, int iters, const std::vector<std::string>& ancres) {  // mepSkSolve
  if (!sk.is_object() || !sk.contains("cons") || !sk["cons"].is_array() || sk["cons"].empty()) return 0;
  Solveur s;
  std::map<S, int> iP, iE;
  std::vector<S> noms;
  J& pts = sk["pts"];
  for (auto it = pts.begin(); it != pts.end(); ++it) {
    iP[it.key()] = static_cast<int>(noms.size());
    noms.push_back(it.key());
    s.x.push_back(num(it.value(), "x"));
    s.y.push_back(num(it.value(), "y"));
  }
  const auto ptI = [&](const S& id) {
    const auto it = iP.find(id);
    return it == iP.end() ? -1 : it->second;
  };
  J& ents = sk["ents"];
  for (const J& e : ents) {
    SolEnt q;
    const S t = chaine(e, "t");
    q.t = t == "line" ? 'l' : t == "circle" ? 'c' : t == "arc" ? 'a' : 'x';
    q.p1 = ptI(chaine(e, "p1")), q.p2 = ptI(chaine(e, "p2")), q.pc = ptI(chaine(e, "pc")), q.p = ptI(chaine(e, "p"));
    q.aR = e.contains("r") && !e["r"].is_null();
    q.r = num(e, "r");
    iE[chaine(e, "id")] = static_cast<int>(s.ents.size());
    s.ents.push_back(q);
  }
  const auto entI = [&](const S& id) {
    const auto it = iE.find(id);
    return it == iE.end() ? -1 : it->second;
  };
  std::set<S> fixes = pointsFixes(sk);
  for (const S& a : ancres) fixes.insert(a);
  std::vector<SolCon> cons;
  for (J& c : sk["cons"]) {
    const S t = chaine(c, "type");
    if (t == "fix") continue;
    SolCon q;
    q.type = typeDe(t);
    q.a = ptI(chaine(c, "a")), q.b = ptI(chaine(c, "b")), q.p = ptI(chaine(c, "p"));
    q.ea = entI(chaine(c, "a")), q.eb = entI(chaine(c, "b")), q.ent = entI(chaine(c, "ent"));
    q.val = num(c, "val");
    q.source = &c;
    cons.push_back(q);
  }
  // Les variables : seuls les points et les rayons touchés par une contrainte (mepSkConRefs)
  struct Var {
    int genre, i;  // 0 x, 1 y, 2 rayon
  };
  std::vector<Var> vars;
  std::map<int, int> vP, vR;
  for (size_t ci = 0; ci < cons.size(); ci++) {
    SolCon& c = cons[ci];
    std::vector<int> P, R;
    const auto addP = [&](int i) {
      if (i >= 0 && std::find(P.begin(), P.end(), i) == P.end()) P.push_back(i);
    };
    const auto addE = [&](int i) {
      if (i < 0) return;
      const SolEnt& e = s.ents[i];
      addP(e.p1), addP(e.p2), addP(e.pc), addP(e.p);
      if ((e.t == 'c' || e.t == 'a') && std::find(R.begin(), R.end(), i) == R.end()) R.push_back(i);
    };
    if (c.a >= 0) addP(c.a);
    else addE(c.ea);
    if (c.b >= 0) addP(c.b);
    else addE(c.eb);
    if (c.p >= 0) addP(c.p);
    else addE(entI(chaine(*c.source, "p")));
    addE(c.ent);
    for (int i : P) {
      if (fixes.count(noms[i]) || vP.count(i)) continue;
      vP[i] = static_cast<int>(vars.size());
      vars.push_back({0, i});
      vars.push_back({1, i});
    }
    for (int i : R) {
      if (vR.count(i)) continue;
      vR[i] = static_cast<int>(vars.size());
      vars.push_back({2, i});
    }
    for (int i : P) {
      const auto it = vP.find(i);
      if (it != vP.end()) c.colonnes.push_back(it->second), c.colonnes.push_back(it->second + 1);
    }
    for (int i : R) c.colonnes.push_back(vR[i]);
  }
  const auto lit = [&](const Var& v) { return v.genre == 0 ? s.x[v.i] : v.genre == 1 ? s.y[v.i] : s.ents[v.i].r; };
  const auto ecrit = [&](const Var& v, double a) {
    if (v.genre == 0) s.x[v.i] = a;
    else if (v.genre == 1) s.y[v.i] = a;
    else s.ents[v.i].r = std::max(0.01, a);
  };
  const auto somme = [&]() {
    double q = 0, r[2];
    for (SolCon& c : cons) {
      const int n = s.residu(c, r);
      for (int k = 0; k < n; k++)
        if (std::isfinite(r[k])) q += r[k] * r[k];
    }
    return q;
  };
  const int n = static_cast<int>(vars.size());
  double ss = somme(), lam = 1e-3;
  const double eps = 1e-6;
  std::vector<double> A, g, sauve, dx;
  for (int it = 0; it < (iters ? iters : 60) && n && ss > 1e-16; it++) {
    A.assign(static_cast<size_t>(n) * n, 0);
    g.assign(n, 0);
    for (SolCon& c : cons) {
      const std::vector<int>& cs = c.colonnes;
      if (cs.empty()) continue;
      double r0[2], r1[2];
      const int m = s.residu(c, r0);
      if (!m) continue;
      std::vector<std::array<double, 2>> Jc(cs.size());
      for (size_t a = 0; a < cs.size(); a++) {
        const Var& v = vars[cs[a]];
        const double x0 = lit(v);
        ecrit(v, x0 + eps);
        s.residu(c, r1);
        ecrit(v, x0);
        for (int q = 0; q < m; q++) Jc[a][q] = std::isfinite(r0[q]) && std::isfinite(r1[q]) ? (r1[q] - r0[q]) / eps : 0;
      }
      for (int q = 0; q < m; q++) {
        if (!std::isfinite(r0[q])) continue;
        for (size_t a = 0; a < cs.size(); a++) {
          const double ja = Jc[a][q];
          if (ja == 0) continue;
          g[cs[a]] += ja * r0[q];
          for (size_t b = 0; b < cs.size(); b++) {
            const double jb = Jc[b][q];
            if (jb != 0) A[static_cast<size_t>(cs[a]) * n + cs[b]] += ja * jb;
          }
        }
      }
    }
    sauve.resize(n);
    for (int j = 0; j < n; j++) sauve[j] = lit(vars[j]);
    bool ok = false;
    for (int essais = 0; essais < 6 && !ok; essais++) {
      std::vector<double> M = A;
      for (int i = 0; i < n; i++) M[static_cast<size_t>(i) * n + i] += lam * (1 + A[static_cast<size_t>(i) * n + i]);
      if (!resoudreDense(std::move(M), g, n, dx)) {
        lam *= 10;
        continue;
      }
      for (int j = 0; j < n; j++) ecrit(vars[j], sauve[j] - dx[j]);
      const double s2 = somme();
      if (s2 < ss || s2 < 1e-18) {
        ss = s2, lam = std::max(1e-9, lam / 4), ok = true;
      } else {
        for (int j = 0; j < n; j++) ecrit(vars[j], sauve[j]);
        lam *= 8;
      }
    }
    if (!ok) break;
  }
  double err = 0, r[2];
  for (SolCon& c : cons) {
    const int m = s.residu(c, r);
    for (int k = 0; k < m; k++)
      if (std::isfinite(r[k])) err = std::max(err, std::abs(r[k]));
  }
  // Le résultat revient dans le document
  for (const Var& v : vars) {
    if (v.genre == 0) pts[noms[v.i]]["x"] = s.x[v.i];
    else if (v.genre == 1) pts[noms[v.i]]["y"] = s.y[v.i];
    else ents[v.i]["r"] = s.ents[v.i].r;
  }
  for (SolCon& c : cons)
    if (c.echange) {
      const J a = (*c.source)["a"];
      (*c.source)["a"] = (*c.source)["b"];
      (*c.source)["b"] = a;
    }
  return err;
}

void rafraichirLiensEsquisse(Ctx& c) {  // mepSkLinksRefresh
  if (!vrai(c.sh, "sk") || !sous(c.sh["sk"], "pts").is_object()) return;
  J& sk = c.sh["sk"];
  bool bouge = false;
  for (auto it = sk["pts"].begin(); it != sk["pts"].end(); ++it) {
    J& p = it.value();
    if (!vrai(p, "lk")) continue;
    double x, y;
    bool ok = false;
    try {
      ok = positionDuLien(c, p["lk"], x, y);
    } catch (const std::exception&) {
    }
    if (ok && std::hypot(x - num(p, "x"), y - num(p, "y")) > 1e-6) {
      p["x"] = x, p["y"] = y;
      bouge = true;
    }
  }
  if (bouge) resoudreEsquisse(sk, 60);
}

bool survolEsquisse(J& mep, int planche, const Piece& p, Calcul& calc, const EtatEsquisse& et, OutilPlan& o, double x, double y, double tol, double zoom) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  const SkCtx ctx = contexte(c.sh, et, false);
  o.skCur = accrocherSk(c, ctx, x, y, tol, zoom);
  return o.skDebut;
}

SuiteOutil cliqueEsquisse(J& mep, int planche, const Piece& p, Calcul& calc, const EtatEsquisse& et, OutilPlan& o, SelectionPlan& sel, double x, double y, double tol, double zoom) {
  SuiteOutil r;
  Ctx c = contexteGeste(mep, planche, p, calc);
  J& sh = c.sh;
  const S tool = o.tool;
  const SkCtx lu = contexte(sh, et, false);
  const SkPoint pt = accrocherSk(c, lu, x, y, tol, zoom);
  if (tool == "line" || tool == "rect" || tool == "circle" || tool == "arc" || tool == "logo") {
    if (!o.skDebut) {
      o.skDebut = true, o.skStart = pt, o.skCur = pt, o.skPts = {pt};
      r.message = tool == "arc" ? "Arc : cliquez le point de départ." : tool == "line" ? "Ligne : cliquez le point suivant." : "Cliquez le 2ᵉ point.";
      return r;
    }
    const SkCtx ctx = contexte(sh, et, true);
    J& sk = *ctx.sk;
    if (tool == "line") {  // mepSkAddLine
      const S a = pointDepuis(ctx, o.skStart), b = pointDepuis(ctx, pt);
      r.change = true, r.libelle = "ligne";
      if (a != b) {
        ajouterEnt(sk, style(J{{"t", "line"}, {"p1", a}, {"p2", b}}, et));
        autoHV(sk, a, b);
        resoudreEsquisse(sk, 40);
        SkPoint n;
        n.x = pt.x, n.y = pt.y, n.pid = b;
        o.skStart = n, o.skCur = pt, o.skPts.clear();
      }
      r.message = "Ligne enchaînée — clic suivant, ou Échap / clic droit pour terminer.";
      return r;
    }
    if (tool == "arc") {  // mepSkAddArc
      o.skPts.push_back(pt);
      if (o.skPts.size() < 3) {
        r.message = "Arc : cliquez le point d’arrivée.";
        return r;
      }
      const S cid = pointDepuis(ctx, o.skPts[0]);
      const double cx = num(sk["pts"][cid], "x"), cy = num(sk["pts"][cid], "y");
      const SkPoint& A = o.skPts[1];
      const SkPoint& B = o.skPts[2];
      const double rr = std::max(0.1, std::hypot(A.x - ctx.ox - cx, A.y - ctx.oy - cy));
      const double a0 = std::atan2(A.y - ctx.oy - cy, A.x - ctx.ox - cx), a1 = std::atan2(B.y - ctx.oy - cy, B.x - ctx.ox - cx);
      const S p1 = ajouterPoint(sk, cx + rr * std::cos(a0), cy + rr * std::sin(a0)), p2 = ajouterPoint(sk, cx + rr * std::cos(a1), cy + rr * std::sin(a1));
      const J& e = ajouterEnt(sk, style(J{{"t", "arc"}, {"pc", cid}, {"p1", p1}, {"p2", p2}, {"r", rr}, {"a0", a0}, {"a1", a1}}, et));
      const S ide = chaine(e, "id");
      ajouterCons(sk, J{{"type", "onCircle"}, {"p", p1}, {"ent", ide}});
      ajouterCons(sk, J{{"type", "onCircle"}, {"p", p2}, {"ent", ide}});
      o.skDebut = false, o.skPts.clear();
      r.change = true, r.libelle = "arc";
      return r;
    }
    if (tool == "rect") {  // mepSkAddRect
      const S a = pointDepuis(ctx, o.skStart), cc = pointDepuis(ctx, pt);
      const double ax = num(sk["pts"][a], "x"), ay = num(sk["pts"][a], "y"), cx = num(sk["pts"][cc], "x"), cy = num(sk["pts"][cc], "y");
      const S b = ajouterPoint(sk, cx, ay), d = ajouterPoint(sk, ax, cy);
      ajouterEnt(sk, style(J{{"t", "line"}, {"p1", a}, {"p2", b}}, et));
      ajouterEnt(sk, style(J{{"t", "line"}, {"p1", b}, {"p2", cc}}, et));
      ajouterEnt(sk, style(J{{"t", "line"}, {"p1", cc}, {"p2", d}}, et));
      ajouterEnt(sk, style(J{{"t", "line"}, {"p1", d}, {"p2", a}}, et));
      ajouterCons(sk, J{{"type", "horizontal"}, {"a", a}, {"b", b}});
      ajouterCons(sk, J{{"type", "vertical"}, {"a", b}, {"b", cc}});
      ajouterCons(sk, J{{"type", "horizontal"}, {"a", cc}, {"b", d}});
      ajouterCons(sk, J{{"type", "vertical"}, {"a", d}, {"b", a}});
      resoudreEsquisse(sk, 40);
      r.libelle = "rectangle";
    } else if (tool == "circle") {  // mepSkAddCircle
      const S cid = pointDepuis(ctx, o.skStart);
      ajouterEnt(sk, style(J{{"t", "circle"}, {"pc", cid}, {"r", std::max(0.1, std::hypot(pt.x - o.skStart.x, pt.y - o.skStart.y))}}, et));
      r.libelle = "cercle";
    } else {  // mepSkAddLogo
      SkPoint q1, q2;
      q1.x = std::min(o.skStart.x, pt.x), q1.y = std::min(o.skStart.y, pt.y), q2.x = std::max(o.skStart.x, pt.x), q2.y = std::max(o.skStart.y, pt.y);
      const S p1 = pointDepuis(ctx, q1), p2 = pointDepuis(ctx, q2);
      ajouterEnt(sk, J{{"t", "logo"}, {"p1", p1}, {"p2", p2}});
      r.libelle = "zone logo";
    }
    o.skDebut = false, o.skPts.clear();
    r.change = true;
    return r;
  }
  if (tool == "point") {
    const SkCtx ctx = contexte(sh, et, true);
    pointDepuis(ctx, pt);
    r.change = true, r.libelle = "point";
    return r;
  }
  if (tool == "text") {  // mepSkAddText
    const SkCtx ctx = contexte(sh, et, true);
    J& sk = *ctx.sk;
    const S pid = pointDepuis(ctx, pt), f = et.textF.empty() ? "txt" : et.textF;
    J e = J{{"t", "text"}, {"p", pid}, {"f", f}, {"h", corps(et.textH, c.st.noteH)}, {"st", f == "txt" ? "lab" : "val"}, {"al", "start"}};
    if (f == "txt") e["s"] = et.textS.empty() ? "TEXTE" : et.textS;
    if (f == "perso") e["k"] = champPerso(), e["lab"] = "CHAMP";
    const J& n = ajouterEnt(sk, style(std::move(e), et));
    sel.skSel = {"e:" + chaine(n, "id")};
    r.change = true, r.libelle = "texte";
    return r;
  }
  if (tool == "trim") {
    const SkCtx ctx = contexte(sh, et, true);
    r.change = ajuster(*ctx.sk, ctx, x, y, tol, r.message);
    r.libelle = "ajuster";
    return r;
  }
  return r;
}

bool editionEsquisse(const EtatEsquisse& et, const std::string& outil, const SelectionPlan& sel) { return et.tbEdit || estOutilEsquisse(outil) || !sel.skSel.empty(); }  // mepSkEditing

std::string esquisseSous(J& mep, int planche, const Piece& p, Calcul& calc, EtatEsquisse& et, const std::string& outil, const SelectionPlan& sel, double x, double y, double tol) {  // mepSkHit
  Ctx c = contexteGeste(mep, planche, p, calc);
  const SkCtx ctx = contexte(c.sh, et, false);
  if (!ctx.sk) return "";
  const J& sk = *ctx.sk;
  if (editionEsquisse(et, outil, sel)) {
    S best;
    double bd = tol * 0.8;
    std::set<S> ancres;
    for (const J& e : sk["ents"])
      if (chaine(e, "t") == "text") ancres.insert(chaine(e, "p"));
    for (auto it = sk["pts"].begin(); it != sk["pts"].end(); ++it) {
      if (ancres.count(it.key())) continue;
      const double d = std::hypot(num(it.value(), "x") + ctx.ox - x, num(it.value(), "y") + ctx.oy - y);
      if (d < bd) bd = d, best = "p:" + it.key();
    }
    if (!best.empty()) return best;
    for (const EtatEsquisse::ConHit& h : et.conHits)
      if (std::abs(x - h.x) <= h.w / 2 + tol * 0.2 && std::abs(y - h.y) <= h.h / 2 + tol * 0.2) return "c:" + h.id;
  }
  S best, bestT;
  double bd = tol;
  for (const J& e : sk["ents"]) {
    const S t = chaine(e, "t");
    double d = INFINITY;
    if (t == "line") {
      const J* A = ptDe(sk, chaine(e, "p1"));
      const J* B = ptDe(sk, chaine(e, "p2"));
      if (!A || !B) continue;
      const double ax = num(*A, "x") + ctx.ox, ay = num(*A, "y") + ctx.oy, dx = num(*B, "x") + ctx.ox - ax, dy = num(*B, "y") + ctx.oy - ay, L2 = dx * dx + dy * dy;
      const double u = L2 > 1e-12 ? std::max(0.0, std::min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
      d = std::hypot(x - (ax + dx * u), y - (ay + dy * u));
    } else if (t == "circle" || t == "arc") {
      const J* C = ptDe(sk, chaine(e, "pc"));
      if (!C) continue;
      d = std::abs(std::hypot(x - (num(*C, "x") + ctx.ox), y - (num(*C, "y") + ctx.oy)) - num(e, "r"));
    } else if (t == "text") {
      const J* P0 = ptDe(sk, chaine(e, "p"));
      if (!P0) continue;
      const double px = num(*P0, "x") + ctx.ox, py = num(*P0, "y") + ctx.oy, h = num(e, "h") != 0 ? num(e, "h") : 3.5;
      const double w = std::max(h, longueurCar(texteEsquisse(c, e, true)) * h * 0.56);
      const S al = chaine(e, "al");
      const double x0 = al == "middle" ? px - w / 2 : (al == "end" ? px - w : px);
      if (x >= x0 - 0.5 && x <= x0 + w + 0.5 && y >= py - h - 0.5 && y <= py + 0.5 && bestT.empty()) bestT = "e:" + chaine(e, "id");
      continue;
    } else if (t == "logo") {
      const J* A = ptDe(sk, chaine(e, "p1"));
      const J* B = ptDe(sk, chaine(e, "p2"));
      if (!A || !B) continue;
      const double ax = num(*A, "x") + ctx.ox, ay = num(*A, "y") + ctx.oy, bx = num(*B, "x") + ctx.ox, by = num(*B, "y") + ctx.oy;
      if (x >= std::min(ax, bx) && x <= std::max(ax, bx) && y >= std::min(ay, by) && y <= std::max(ay, by) && bestT.empty()) bestT = "e:" + chaine(e, "id");
      continue;
    } else {
      continue;
    }
    if (d < bd) bd = d, best = "e:" + chaine(e, "id");
  }
  return best.empty() ? bestT : best;
}

void choisirEsquisse(SelectionPlan& sel, const std::string& cle, bool ajout) {  // mepSkSelect
  auto& q = sel.skSel;
  const auto it = std::find(q.begin(), q.end(), cle);
  if (ajout) {
    if (it != q.end()) q.erase(it);
    else q.push_back(cle);
  } else if (it == q.end()) {
    q = {cle};
  }
  sel.vue.clear(), sel.cote.clear(), sel.axeVue.clear(), sel.axeId.clear(), sel.axeAk.clear();
}
bool texteNonChoisi(J& sh, const EtatEsquisse& et, const SelectionPlan& sel, const std::string& cle) {
  if (cle.empty() || cle[0] != 'e' || dansListe(sel.skSel, cle)) return false;
  const SkCtx ctx = contexte(sh, et, false);
  if (!ctx.sk) return false;
  const J* e = entDe(*ctx.sk, cle.substr(2));
  return e && chaine(*e, "t") == "text";
}
J photoEsquisse(J& sh, const EtatEsquisse& et) {  // mepSkSnapshot
  const SkCtx ctx = contexte(sh, et, false);
  if (!ctx.sk) return J();
  J& sk = *ctx.sk;
  return J{{"pts", sk["pts"]}, {"ents", sk["ents"]}, {"cons", sk["cons"]}, {"seq", sk["seq"]}};
}
static void remettre(J& sk, const J& photo) {
  sk["pts"] = photo["pts"], sk["ents"] = photo["ents"], sk["cons"] = photo["cons"], sk["seq"] = photo["seq"];
}
bool bougerEsquisse(J& sh, const EtatEsquisse& et, const J& base, const std::string& cle, double sx, double sy, double x, double y, bool& averti, std::string& message) {
  const SkCtx ctx = contexte(sh, et, false);
  if (!ctx.sk || !base.is_object()) return false;
  J& sk = *ctx.sk;
  remettre(sk, base);
  const double dx = x - sx, dy = y - sy;
  const std::string id = cle.substr(2);
  const std::set<S> fx = pointsFixes(sk);
  std::vector<S> ancres;
  const auto mv = [&](const S& pid) {
    if (pid.empty() || fx.count(pid) || !ptDe(sk, pid) || dansListe(ancres, pid)) return;
    J& q = sk["pts"][pid];
    q["x"] = num(q, "x") + dx, q["y"] = num(q, "y") + dy;
    ancres.push_back(pid);
  };
  if (cle[0] == 'p') {
    mv(id);
  } else if (J* e = entDe(sk, id)) {
    const S t = chaine(*e, "t");
    if (t == "circle" || t == "arc") {
      if (const J* C = ptDe(sk, chaine(*e, "pc"))) {
        (*e)["r"] = std::max(0.1, std::hypot(x - ctx.ox - num(*C, "x"), y - ctx.oy - num(*C, "y")));
        ancres.push_back(chaine(*e, "pc"));
      }
    } else {
      for (const char* k : REFS_PT) mv(chaine(*e, k));
    }
  }
  // position impossible (élément coté ou fixé) : les contraintes l'emportent, rien ne se déforme
  if (resoudreEsquisse(sk, 30, ancres) > 1e-4) {
    resoudreEsquisse(sk, 80);
    if (!averti) {
      averti = true;
      message = "Élément tenu par ses cotes ou ses fixations : modifiez la cote (sélectionnez-la) pour le déplacer.";
    }
  }
  return true;
}
int cadreEsquisse(J& mep, int planche, const Piece& p, Calcul& calc, const EtatEsquisse& et, SelectionPlan& sel, double x0, double y0, double x1, double y1, bool capture) {  // mepBoxSelect, l'esquisse
  Ctx c = contexteGeste(mep, planche, p, calc);
  const SkCtx ctx = contexte(c.sh, et, false);
  if (!ctx.sk) return 0;
  const J& sk = *ctx.sk;
  int n = 0;
  std::set<S> servis{"o"};
  for (const J& e : sk["ents"]) {
    for (const char* k : REFS_PT)
      if (vrai(e, k)) servis.insert(chaine(e, k));
    Poly g;
    if (!polyDe(c, ctx, e, g)) continue;
    const char* r = touchePoly(x0, y0, x1, y1, g);
    const bool veut = r && (capture || std::string(r) == "in");
    const S cle = "e:" + chaine(e, "id");
    if (veut && !dansListe(sel.skSel, cle)) sel.skSel.push_back(cle), n++;
  }
  for (auto it = sk["pts"].begin(); it != sk["pts"].end(); ++it) {
    if (servis.count(it.key())) continue;
    const double px = num(it.value(), "x") + ctx.ox, py = num(it.value(), "y") + ctx.oy;
    const S cle = "p:" + it.key();
    if (px >= x0 && px <= x1 && py >= y0 && py <= y1 && !dansListe(sel.skSel, cle)) sel.skSel.push_back(cle), n++;
  }
  return n;
}
void supprimerEsquisse(J& sh, const EtatEsquisse& et, SelectionPlan& sel) {  // mepSkDelRaw
  const SkCtx ctx = contexte(sh, et, false);
  if (ctx.sk) {
    J& sk = *ctx.sk;
    for (const S& k : sel.skSel) {
      const S id = k.substr(2);
      if (k[0] == 'c') {
        J n = J::array();
        for (J& c : sk["cons"])
          if (chaine(c, "id") != id) n.push_back(std::move(c));
        sk["cons"] = std::move(n);
      } else if (k[0] == 'e') {
        retirerEnt(sk, id);
      } else if (k[0] == 'p' && id != "o" && ptDe(sk, id)) {
        std::vector<S> a;
        for (const J& e : sk["ents"])
          for (const char* q : REFS_PT)
            if (chaine(e, q) == id) {
              a.push_back(chaine(e, "id"));
              break;
            }
        for (const S& e : a) retirerEnt(sk, e);
        if (sk["pts"].contains(id)) sk["pts"].erase(id);
        nettoyerCons(sk);
      }
    }
    resoudreEsquisse(sk, 40);
  }
  sel.skSel.clear();
}

// ---- Les contraintes (MEP_SK_CONS) ----
namespace {
struct Parts {  // mepSkSelParts
  std::vector<S> P, L, C, T, K, O;
};
Parts partsDe(const J& sk, const std::vector<S>& sel) {
  Parts s;
  for (const S& k : sel) {
    const S id = k.substr(2);
    if (k[0] == 'p') {
      if (ptDe(sk, id)) s.P.push_back(id);
    } else if (k[0] == 'e') {
      const J* e = entDe(sk, id);
      if (!e) continue;
      const S t = chaine(*e, "t");
      if (t == "line") s.L.push_back(id);
      else if (t == "circle" || t == "arc") s.C.push_back(id);
      else if (t == "text") s.T.push_back(id), s.P.push_back(chaine(*e, "p"));
      else s.O.push_back(id);
    } else if (k[0] == 'c') {
      for (const J& c : sk["cons"])
        if (chaine(c, "id") == id) {
          s.K.push_back(id);
          break;
        }
    }
  }
  return s;
}
bool admis(const S& id, const Parts& s) {
  const size_t P = s.P.size(), L = s.L.size(), C = s.C.size(), O = s.O.size();
  if (id == "coincident") return P == 2 && !L && !C;
  if (id == "horizontal" || id == "vertical") return (L >= 1 && !P && !C) || (P == 2 && !L);
  if (id == "parallel") return L >= 2 && !P && !C;
  if (id == "perp") return L == 2 && !P && !C;
  if (id == "equal") return !P && ((L >= 2 && !C) || (C >= 2 && !L));
  if (id == "midpoint") return P == 1 && L == 1 && !C;
  if (id == "onLine") return P >= 1 && L == 1 && !C;
  if (id == "onCircle") return P >= 1 && C == 1 && !L;
  if (id == "tangent") return L == 1 && C == 1 && !P;
  if (id == "concentric") return C >= 2 && !L && !P;
  if (id == "fix") return P + L + C + O > 0;
  if (id == "dist") return !C && ((P == 2 && !L) || (L == 1 && P <= 1) || (L == 2 && !P));
  if (id == "distX" || id == "distY") return !C && ((P == 2 && !L) || (L == 1 && !P));
  if (id == "radius") return C == 1 && !L && !P;
  if (id == "angle") return L == 2 && !P && !C;
  return false;
}
// La cote créée, pour y poser la valeur actuelle
J* poser(J& sk, const S& id, const Parts& s) {
  const auto bouts = [&](const S& l) {
    const J* e = entDe(sk, l);
    return std::make_pair(chaine(*e, "p1"), chaine(*e, "p2"));
  };
  const auto C2 = [&](const char* t, const S& a, const S& b) { return &ajouterCons(sk, J{{"type", t}, {"a", a}, {"b", b}}); };
  if (id == "coincident") fusionnerPoints(sk, s.P[0], s.P[1]);
  else if (id == "horizontal" || id == "vertical") {
    if (!s.L.empty()) {
      for (const S& l : s.L) {
        const auto b = bouts(l);
        C2(id.c_str(), b.first, b.second);
      }
    } else {
      C2(id.c_str(), s.P[0], s.P[1]);
    }
  } else if (id == "parallel") {
    for (size_t i = 1; i < s.L.size(); i++) C2("parallel", s.L[0], s.L[i]);
  } else if (id == "perp") {
    C2("perp", s.L[0], s.L[1]);
  } else if (id == "equal") {
    const std::vector<S>& a = !s.L.empty() ? s.L : s.C;
    for (size_t i = 1; i < a.size(); i++) C2(!s.L.empty() ? "equal" : "eqR", a[0], a[i]);
  } else if (id == "midpoint") {
    const auto b = bouts(s.L[0]);
    ajouterCons(sk, J{{"type", "midpoint"}, {"p", s.P[0]}, {"a", b.first}, {"b", b.second}});
  } else if (id == "onLine") {
    for (const S& q : s.P) ajouterCons(sk, J{{"type", "onLine"}, {"p", q}, {"ent", s.L[0]}});
  } else if (id == "onCircle") {
    for (const S& q : s.P) ajouterCons(sk, J{{"type", "onCircle"}, {"p", q}, {"ent", s.C[0]}});
  } else if (id == "tangent") {
    C2("tangent", s.L[0], s.C[0]);
  } else if (id == "concentric") {
    for (size_t i = 1; i < s.C.size(); i++) {
      const S a = chaine(*entDe(sk, s.C[0]), "pc"), b = chaine(*entDe(sk, s.C[i]), "pc");
      fusionnerPoints(sk, a, b);
    }
  } else if (id == "fix") {
    std::vector<S> ps = s.P;
    const auto ajoute = [&](const S& q) {
      if (!q.empty() && !dansListe(ps, q)) ps.push_back(q);
    };
    for (const S& l : s.L) ajoute(bouts(l).first), ajoute(bouts(l).second);
    for (const S& l : s.O) ajoute(bouts(l).first), ajoute(bouts(l).second);
    for (const S& q : s.C) ajoute(chaine(*entDe(sk, q), "pc"));
    const std::set<S> fx = pointsFixes(sk);
    for (const S& q : ps)
      if (!fx.count(q)) ajouterCons(sk, J{{"type", "fix"}, {"p", q}});
  } else if (id == "dist") {
    if (s.P.size() == 2 && s.L.empty()) return C2("dist", s.P[0], s.P[1]);
    if (s.L.size() == 1 && s.P.empty()) {
      const auto b = bouts(s.L[0]);
      return C2("dist", b.first, b.second);
    }
    if (s.L.size() == 1) return &ajouterCons(sk, J{{"type", "distPL"}, {"p", s.P[0]}, {"ent", s.L[0]}});
    return &ajouterCons(sk, J{{"type", "distPL"}, {"p", bouts(s.L[1]).first}, {"ent", s.L[0]}});
  } else if (id == "distX" || id == "distY") {
    if (!s.L.empty()) {
      const auto b = bouts(s.L[0]);
      return C2(id.c_str(), b.first, b.second);
    }
    return C2(id.c_str(), s.P[0], s.P[1]);
  } else if (id == "radius") {
    return &ajouterCons(sk, J{{"type", "radius"}, {"a", s.C[0]}});
  } else if (id == "angle") {
    return C2("angle", s.L[0], s.L[1]);
  }
  return nullptr;
}
}  // namespace

const std::vector<ContrainteEsquisse>& contraintesEsquisse() {
  static const std::vector<ContrainteEsquisse> T = {
      {"coincident", "Coïncident", "Fusionne 2 points", false},
      {"horizontal", "Horizontal", "Ligne(s) horizontale(s), ou 2 points à même hauteur", false},
      {"vertical", "Vertical", "Ligne(s) verticale(s), ou 2 points alignés verticalement", false},
      {"parallel", "Parallèle", "Lignes parallèles à la première sélectionnée", false},
      {"perp", "Perpendic.", "2 lignes perpendiculaires", false},
      {"equal", "Égal", "Mêmes longueurs (lignes) ou mêmes rayons (cercles)", false},
      {"midpoint", "Milieu", "Point au milieu de la ligne", false},
      {"onLine", "Sur ligne", "Point(s) sur la ligne (prolongée)", false},
      {"onCircle", "Sur cercle", "Point(s) sur le cercle", false},
      {"tangent", "Tangent", "Ligne tangente au cercle", false},
      {"concentric", "Concentrique", "Cercles de même centre", false},
      {"fix", "Fixe", "Bloque les points sélectionnés à leur position", false},
      {"dist", "Distance", "Cote pilotante : 2 points, longueur d’une ligne, point↔ligne ou 2 lignes parallèles", true},
      {"distX", "Dist. horiz.", "Cote pilotante horizontale (2 points ou une ligne)", true},
      {"distY", "Dist. vert.", "Cote pilotante verticale (2 points ou une ligne)", true},
      {"radius", "Rayon", "Cote pilotante de rayon", true},
      {"angle", "Angle", "Cote pilotante d’angle entre 2 lignes", true},
  };
  return T;
}
bool contrainteAdmise(J& sh, const EtatEsquisse& et, const SelectionPlan& sel, const std::string& id) {
  const SkCtx ctx = contexte(sh, et, false);
  return ctx.sk && admis(id, partsDe(*ctx.sk, sel.skSel));
}
std::string appliquerContrainte(J& sh, EtatEsquisse& et, SelectionPlan& sel, const std::string& id, bool& change) {  // mepSkApply
  change = false;
  const SkCtx ctx = contexte(sh, et, false);
  if (!ctx.sk) return "";
  J& sk = *ctx.sk;
  const ContrainteEsquisse* D = nullptr;
  for (const ContrainteEsquisse& q : contraintesEsquisse())
    if (q.id == id) D = &q;
  if (!D) return "";
  const Parts s = partsDe(sk, sel.skSel);
  if (!admis(id, s)) return "Contrainte « " + D->lab + " » : sélection inadaptée.";
  const J photo = photoEsquisse(sh, et);
  const size_t n0 = sk["cons"].size();
  J* r = poser(sk, id, s);
  S cree;
  if (D->dim && r) {
    (*r)["val"] = mesure(sk, *r);  // cote posée à la valeur actuelle : rien ne bouge
    cree = chaine(*r, "id");
  }
  const double err = resoudreEsquisse(sk, 80);
  if (err > 1e-3) {
    remettre(sk, photo);
    return "Contrainte « " + D->lab + " » refusée : incompatible ou redondante avec les contraintes existantes.";
  }
  if (cree.empty() && sk["cons"].size() > n0) cree = chaine(sk["cons"].back(), "id");
  if (!cree.empty() && D->dim) {
    sel.skSel = {"c:" + cree};
    et.focusVal = true;
  }
  change = true;
  return "Contrainte « " + D->lab + " » posée.";
}
std::string valeurContrainte(J& sh, const EtatEsquisse& et, const std::string& idC, double v, bool& change) {  // mepSkSetVal
  change = false;
  const SkCtx ctx = contexte(sh, et, false);
  if (!ctx.sk || !std::isfinite(v)) return "";
  J& sk = *ctx.sk;
  const J photo = photoEsquisse(sh, et);
  for (J& c : sk["cons"]) {
    if (chaine(c, "id") != idC) continue;
    const S t = chaine(c, "type");
    const double av = num(c, "val"), sg = av > 0 ? 1 : av < 0 ? -1 : 1;
    if (t == "angle") c["val"] = sg * std::abs(v) * PI / 180;
    else if (t == "distX" || t == "distY" || t == "distPL") c["val"] = sg * std::abs(v);
    else c["val"] = std::abs(v);
    break;
  }
  const double err = resoudreEsquisse(sk, 120);
  change = true;
  if (err > 1e-3) {
    remettre(sk, photo);
    return "Valeur impossible avec les autres contraintes — non appliquée.";
  }
  return "";
}
void detacherDeLaVue(J& sh, const EtatEsquisse& et, const std::vector<std::string>& pts) {
  const SkCtx ctx = contexte(sh, et, false);
  if (!ctx.sk) return;
  for (const S& id : pts)
    if ((*ctx.sk)["pts"].contains(id)) (*ctx.sk)["pts"][id].erase("lk");
}
InfosEsquisse infosEsquisse(J& sh, const EtatEsquisse& et, const SelectionPlan& sel) {
  InfosEsquisse q;
  const SkCtx ctx = contexte(sh, et, false);
  q.tb = ctx.tb;
  if (!ctx.sk) return q;
  q.existe = true;
  const J& sk = *ctx.sk;
  const Parts s = partsDe(sk, sel.skSel);
  q.textes = s.T, q.lignes = s.L, q.cercles = s.C;
  q.contraintes = s.K;
  // Les points tenus par une vue
  std::vector<S> ids = s.P;
  const auto ajoute = [&](const S& v) {
    if (!v.empty() && !dansListe(ids, v)) ids.push_back(v);
  };
  for (const S& l : s.L) {
    const J* e = entDe(sk, l);
    ajoute(chaine(*e, "p1")), ajoute(chaine(*e, "p2"));
  }
  for (const S& l : s.C) ajoute(chaine(*entDe(sk, l), "pc"));
  for (const S& id : ids) {
    const J* p = ptDe(sk, id);
    if (p && vrai(*p, "lk")) q.lies.push_back(id);
  }
  // mepSkDimsOf
  std::set<S> cles(s.P.begin(), s.P.end()), propres;
  for (const S& l : s.L) {
    const J* e = entDe(sk, l);
    const S a = chaine(*e, "p1"), b = chaine(*e, "p2");
    cles.insert(l), cles.insert(a), cles.insert(b);
    propres.insert(l), propres.insert(a + "|" + b), propres.insert(b + "|" + a);
  }
  for (const S& l : s.C) {
    cles.insert(l);
    const S pc = chaine(*entDe(sk, l), "pc");
    if (!pc.empty()) cles.insert(pc);
    propres.insert(l);
  }
  std::set<S> txt;
  for (const J& e : sk["ents"])
    if (chaine(e, "t") == "text" && !dansListe(s.T, chaine(e, "id"))) txt.insert(chaine(e, "p"));
  std::vector<S> D, Dm;
  for (const J& c : sk["cons"]) {
    if (!c.contains("val") || c["val"].is_null() || chaine(c, "type") == "fix") continue;
    const S a = chaine(c, "a"), b = chaine(c, "b"), p = chaine(c, "p"), en = chaine(c, "ent");
    if (!(cles.count(a) || cles.count(b) || cles.count(p) || cles.count(en))) continue;
    if (txt.count(a) || txt.count(b) || txt.count(p)) continue;
    (propres.count(a) || propres.count(en) || propres.count(a + "|" + b) ? Dm : D).push_back(chaine(c, "id"));
  }
  Dm.insert(Dm.end(), D.begin(), D.end());
  q.cotes = Dm;
  q.nbCons = sk["cons"].size(), q.nbEnts = sk["ents"].size();
  return q;
}
plan::J* elementEsquisse(J& sh, const EtatEsquisse& et, const std::string& id) {
  const SkCtx ctx = contexte(sh, et, false);
  return ctx.sk ? entDe(*ctx.sk, id) : nullptr;
}
plan::J* contrainteEsquisse(J& sh, const EtatEsquisse& et, const std::string& id) {
  const SkCtx ctx = contexte(sh, et, false);
  if (!ctx.sk) return nullptr;
  for (J& c : (*ctx.sk)["cons"])
    if (chaine(c, "id") == id) return &c;
  return nullptr;
}
const J* pointEsquisse(J& sh, const EtatEsquisse& et, const std::string& id) {
  const SkCtx ctx = contexte(sh, et, false);
  return ctx.sk ? ptDe(*ctx.sk, id) : nullptr;
}

std::vector<std::string> pointsHorsFeuille(const J& sh) {  // mepTbStray
  std::vector<S> r;
  if (!cartoucheDessine(sh)) return r;
  double w, h;
  limitesCartouche(sh, w, h);
  const J& pts = sh["title"]["tb"]["sk"]["pts"];
  for (auto it = pts.begin(); it != pts.end(); ++it) {
    const double x = num(it.value(), "x"), y = num(it.value(), "y");
    if (x < -w || y < -h || x > 1 || y > 1) r.push_back(it.key());
  }
  return r;
}
void retirerHorsFeuille(J& sh) {  // mepTbDropStray
  const std::vector<S> partis = pointsHorsFeuille(sh);
  if (partis.empty()) return;
  J& sk = sh["title"]["tb"]["sk"];
  std::vector<S> ents;
  for (const J& e : sk["ents"])
    for (const char* q : REFS_PT)
      if (dansListe(partis, chaine(e, q))) {
        ents.push_back(chaine(e, "id"));
        break;
      }
  for (const S& id : ents) retirerEnt(sk, id);
  for (const S& id : partis)
    if (sk["pts"].contains(id)) sk["pts"].erase(id);
  nettoyerCons(sk);
}

// ---- Le modèle Standard (mepTbFromStd) ----
J cartoucheStandard(const J& sh) {
  double ix, iy, W, ih;
  surfaceUtile(sh, ix, iy, W, ih);
  const J& tt = sous(sh, "title");
  const double H = 26, H2 = H / 2, LW = vrai(tt, "logo") ? 32 : 0, pw = std::min(130.0, (W - LW) * 0.4);
  J sk = J{{"pts", J::object()}, {"ents", J::array()}, {"cons", J::array()}, {"seq", 1}};
  sk["pts"]["o"] = J{{"x", 0}, {"y", 0}};
  const auto pt = [&](double x, double y) { return ajouterPoint(sk, x, y); };
  const auto ln = [&](const S& a, const S& b, const char* w = nullptr) {
    J e = J{{"t", "line"}, {"p1", a}, {"p2", b}};
    if (w) e["w"] = w;
    return chaine(ajouterEnt(sk, std::move(e)), "id");
  };
  const auto C = [&](J c) { ajouterCons(sk, std::move(c)); };
  const auto C2 = [&](const char* t, const S& a, const S& b) { C(J{{"type", t}, {"a", a}, {"b", b}}); };
  const auto CV = [&](const char* t, const S& a, const S& b, double v) { C(J{{"type", t}, {"a", a}, {"b", b}, {"val", v}}); };
  const auto SUR = [&](const S& p, const S& e) { C(J{{"type", "onLine"}, {"p", p}, {"ent", e}}); };
  const S TL = pt(-W, -H), TR = pt(0, -H), BL = pt(-W, 0);
  const S top = ln(TL, TR, "thick"), right = ln(TR, "o", "thick"), bot = ln(BL, "o", "thick"), left = ln(TL, BL, "thick");
  C2("horizontal", TL, TR);
  C2("horizontal", BL, "o");
  C2("vertical", TL, BL);
  C2("vertical", TR, "o");
  CV("distX", BL, "o", W);
  CV("distY", TR, "o", H);
  const S M2 = pt(0, -H2);
  SUR(M2, right);
  CV("distY", TR, M2, H2);
  S rowL[2], mid;
  if (LW != 0) {
    const S a = pt(-W + LW, -H), b = pt(-W + LW, 0), lg = ln(a, b);
    SUR(a, top);
    SUR(b, bot);
    C2("vertical", a, b);
    CV("distX", TL, a, LW);
    const S m = pt(-W + LW, -H2);
    SUR(m, lg);
    mid = ln(m, M2);
    C2("horizontal", m, M2);
    const S l1 = pt(-W + 2, -H + 2), l2 = pt(-W + LW - 2, -2);
    ajouterEnt(sk, J{{"t", "logo"}, {"p1", l1}, {"p2", l2}});
    CV("distX", TL, l1, 2);
    CV("distY", TL, l1, 2);
    CV("distX", l2, a, 2);
    CV("distY", l2, b, 2);
    rowL[0] = a, rowL[1] = m;
  } else {
    const S M1 = pt(-W, -H2);
    SUR(M1, left);
    mid = ln(M1, M2);
    C2("horizontal", M1, M2);
    rowL[0] = TL, rowL[1] = M1;
  }
  const double x0 = -W + LW;
  struct Rangee {
    S top, bot;
    double y;
    std::vector<std::pair<const char*, const char*>> cells;
  };
  const std::vector<Rangee> rows = {
      {top, mid, -H, {{"PROJET", "projet"}, {"PLANCHE", "planche"}, {"ÉCHELLE", "echelle"}, {"DATE", "date"}, {"DESSINÉ PAR", "auteur"}}},
      {mid, bot, -H2, {{"MATIÈRE", "matiere"}, {"TTS", "traitement"}, {"TTH", "tth"}, {"TOL. GÉNÉRALES", "tolgen"}, {"INDICE", "indice"}}}};
  const std::vector<double> seps = {pw + 4, pw + 52, pw + 96, pw + 156};
  for (size_t ri = 0; ri < rows.size(); ri++) {
    const Rangee& r = rows[ri];
    std::vector<S> lefts = {rowL[ri]};
    for (const double sx : seps) {
      const S a = pt(x0 + sx, r.y), b = pt(x0 + sx, r.y + H2);
      ajouterEnt(sk, J{{"t", "line"}, {"p1", a}, {"p2", b}});
      SUR(a, r.top);
      SUR(b, r.bot);
      C2("vertical", a, b);
      CV("distX", TL, a, LW + sx);
      lefts.push_back(a);
    }
    for (size_t ci = 0; ci < r.cells.size(); ci++) {
      const S L = lefts[ci];
      const double lx = num(sk["pts"][L], "x");
      const double xs = ci ? x0 + seps[ci - 1] : x0, xr = ci < seps.size() ? x0 + seps[ci] : 0, cw = xr - xs - 3;
      const S pl = pt(lx + 2, r.y + 4.4), pv = pt(lx + 2, r.y + 11);
      ajouterEnt(sk, J{{"t", "text"}, {"p", pl}, {"f", "txt"}, {"s", r.cells[ci].first}, {"h", 5}, {"st", "lab"}, {"al", "start"}, {"mw", cw}});
      ajouterEnt(sk, J{{"t", "text"}, {"p", pv}, {"f", r.cells[ci].second}, {"h", 7.5}, {"st", "val"}, {"al", "start"}, {"mw", cw}});
      CV("distX", L, pl, 2);
      CV("distY", L, pl, 4.4);
      CV("distX", L, pv, 2);
      CV("distY", L, pv, 11);
    }
  }
  resoudreEsquisse(sk, 80);
  return J{{"kind", "sk"}, {"name", "Standard (esquisse)"}, {"sk", sk}};
}

// ---- Les aides d'édition (mepDrawSkCtx, en édition ; mepDrawDraft) ----
ApercuEsquisse aidesEsquisse(J& mep, int planche, const Piece& p, Calcul& calc, EtatEsquisse& et, const OutilPlan* o, const SelectionPlan& sel, double pxMm) {
  ApercuEsquisse A;
  Ctx c = contexteGeste(mep, planche, p, calc);
  const SkCtx ctx = contexte(c.sh, et, false);
  const std::string outil = o ? o->tool : std::string();
  // Le tracé en cours
  if (o && o->skDebut) {
    const SkPoint& s = o->skStart;
    const SkPoint& u = o->skCur;
    ApercuEsquisse::Ligne l;
    l.genre = ApercuEsquisse::BROUILLON;
    if (outil == "line") l.pts = {{s.x, s.y}, {u.x, u.y}};
    else if (outil == "rect" || outil == "logo") l.pts = {{s.x, s.y}, {u.x, s.y}, {u.x, u.y}, {s.x, u.y}, {s.x, s.y}};
    else if (outil == "circle" || (outil == "arc" && o->skPts.size() >= 1)) {
      const double r = outil == "circle" || o->skPts.size() < 2 ? std::hypot(u.x - s.x, u.y - s.y) : std::hypot(o->skPts[1].x - s.x, o->skPts[1].y - s.y);
      for (int i = 0; i <= 48; i++) l.pts.push_back({s.x + r * std::cos(i * PI / 24), s.y + r * std::sin(i * PI / 24)});
    }
    if (!l.pts.empty()) A.lignes.push_back(std::move(l));
  }
  et.conHits.clear();
  if (!ctx.sk || !editionEsquisse(et, outil, sel)) return A;
  J& sk = *ctx.sk;
  const auto choisi = [&](const S& k) { return dansListe(sel.skSel, k); };
  const auto X = [&](const J* q) { return num(*q, "x") + ctx.ox; };
  const auto Y = [&](const J* q) { return num(*q, "y") + ctx.oy; };
  // Ce qui se voit en plus du dessin : construction, sélection, survol
  for (const J& e : sk["ents"]) {
    const S t = chaine(e, "t"), id = chaine(e, "id"), cle = "e:" + id;
    const bool on = choisi(cle), hov = et.hov == cle;
    if (t == "text" || t == "logo") {
      Poly g;
      if (polyDe(c, ctx, e, g)) {
        if (on || hov) {
          ApercuEsquisse::Ligne l;
          l.genre = on ? ApercuEsquisse::CHOISI : ApercuEsquisse::SURVOL;
          l.pts = g.pts;
          l.pts.push_back(g.pts[0]);
          A.lignes.push_back(std::move(l));
        } else if (t == "logo") {
          ApercuEsquisse::Ligne l;
          l.genre = ApercuEsquisse::AIDE_POINTILLE;
          l.pts = g.pts;
          l.pts.push_back(g.pts[0]);
          A.lignes.push_back(std::move(l));
        }
      }
      continue;
    }
    if (!vrai(e, "cst") && !on && !hov) continue;
    Poly g;
    if (!polyDe(c, ctx, e, g)) continue;
    ApercuEsquisse::Ligne l;
    l.genre = on ? ApercuEsquisse::CHOISI : hov ? ApercuEsquisse::SURVOL : ApercuEsquisse::CONSTRUCTION;
    l.pts = g.pts;
    A.lignes.push_back(std::move(l));
  }
  // Les points
  const std::set<S> fx = pointsFixes(sk);
  const double z = std::max(0.6, pxMm * 3);
  for (auto it = sk["pts"].begin(); it != sk["pts"].end(); ++it) {
    const bool on = choisi("p:" + it.key());
    ApercuEsquisse::Rond r;
    r.x = num(it.value(), "x") + ctx.ox, r.y = num(it.value(), "y") + ctx.oy, r.r = on ? z * 1.25 : z * 0.75;
    r.genre = on ? 1 : vrai(it.value(), "lk") ? 2 : fx.count(it.key()) ? 3 : 0;
    A.ronds.push_back(r);
  }
  if (ctx.tb) {
    ApercuEsquisse::Ligne h, v;
    h.genre = v.genre = ApercuEsquisse::AIDE;
    h.pts = {{ctx.ox - 4, ctx.oy}, {ctx.ox + 4, ctx.oy}};
    v.pts = {{ctx.ox, ctx.oy - 4}, {ctx.ox, ctx.oy + 4}};
    A.lignes.push_back(std::move(h));
    A.lignes.push_back(std::move(v));
  }
  // Les glyphes de contraintes et les cotes pilotantes
  const double fs = std::max(2.2, pxMm * 11);
  const auto glyphe = [&](const J& k, double x, double y, const S& txt) {
    const double w = std::max(fs * 0.9, longueurCar(txt) * fs * 0.6) + 1, h = fs + 0.8;
    const S id = chaine(k, "id");
    const auto occupe = [&]() {
      for (const auto& q : et.conHits)
        if (std::abs(q.x - x) < (q.w + w) / 2 - 0.05 && std::abs(q.y - y) < (q.h + h) / 2 - 0.05) return true;
      return false;
    };
    for (int n = 0; n < 8 && occupe(); n++) y += h + 0.2;
    ApercuEsquisse::Glyphe g;
    g.x = x, g.y = y, g.w = w, g.h = h, g.fs = fs, g.texte = txt, g.choisi = choisi("c:" + id);
    A.glyphes.push_back(g);
    et.conHits.push_back({id, x, y, w, h});
  };
  const auto P = [&](const S& id) { return ptDe(sk, id); };
  const auto milieu = [&](const J& L, double off, double& mx, double& my) {
    const J* a = P(chaine(L, "p1"));
    const J* b = P(chaine(L, "p2"));
    if (!a || !b) return false;
    const double dx = X(b) - X(a), dy = Y(b) - Y(a);
    double l = std::hypot(dx, dy);
    if (l == 0) l = 1;
    mx = (X(a) + X(b)) / 2 - dy / l * off, my = (Y(a) + Y(b)) / 2 + dx / l * off;
    return true;
  };
  const auto ligneDe = [&](const S& a, const S& b) -> const J* {
    for (const J& e : sk["ents"]) {
      if (chaine(e, "t") != "line") continue;
      const S p1 = chaine(e, "p1"), p2 = chaine(e, "p2");
      if ((p1 == a && p2 == b) || (p1 == b && p2 == a)) return &e;
    }
    return nullptr;
  };
  const auto fmt = [](double v) { return fmtNum(std::abs(v), 2); };
  const auto trait = [&](double x1, double y1, double x2, double y2, ApercuEsquisse::Genre g) {
    ApercuEsquisse::Ligne l;
    l.genre = g, l.pts = {{x1, y1}, {x2, y2}};
    A.lignes.push_back(std::move(l));
  };
  std::map<S, int> compte;
  std::map<S, S> ptTexte;
  for (const J& e : sk["ents"])
    if (chaine(e, "t") == "text") ptTexte[chaine(e, "p")] = chaine(e, "id");
  const auto touche = [&](const J& k) {
    if (choisi("c:" + chaine(k, "id"))) return true;
    const S a = chaine(k, "a"), b = chaine(k, "b"), pp = chaine(k, "p"), en = chaine(k, "ent");
    for (const S& q : {a, b, pp})
      if (!q.empty() && choisi("p:" + q)) return true;
    for (const S& q : {a, b, en})
      if (!q.empty() && choisi("e:" + q)) return true;
    for (const J& e : sk["ents"]) {
      if (chaine(e, "t") != "line" || !choisi("e:" + chaine(e, "id"))) continue;
      const S p1 = chaine(e, "p1"), p2 = chaine(e, "p2");
      for (const S& q : {a, b, pp})
        if (!q.empty() && (q == p1 || q == p2)) return true;
    }
    return false;
  };
  for (const J& k : sk["cons"]) {
    const S ty = chaine(k, "type");
    const bool cote = ty == "dist" || ty == "distX" || ty == "distY" || ty == "distPL" || ty == "radius" || ty == "angle";
    if (!(cote ? et.visDims : et.visCons) && !touche(k)) continue;
    S tp;
    for (const S& q : {chaine(k, "a"), chaine(k, "b"), chaine(k, "p")})
      if (tp.empty() && !q.empty() && ptTexte.count(q)) tp = q;
    if (!tp.empty() && !et.visTxt && !choisi("e:" + ptTexte[tp]) && !choisi("p:" + tp) && !choisi("c:" + chaine(k, "id"))) continue;
    const S cleN = (vrai(k, "a") ? chaine(k, "a") : chaine(k, "p")) + "|" + (vrai(k, "b") ? chaine(k, "b") : chaine(k, "ent"));
    const int n = ++compte[cleN];
    const double sh2 = (n - 1) * fs * 1.1;
    const J* a = P(chaine(k, "a"));
    const J* b = P(chaine(k, "b"));
    if (ty == "horizontal" || ty == "vertical") {
      const J* L = ligneDe(chaine(k, "a"), chaine(k, "b"));
      double mx, my;
      if (L ? milieu(*L, fs * 1.1 + sh2, mx, my) : (a && b)) {
        if (!L) mx = (X(a) + X(b)) / 2 + fs, my = (Y(a) + Y(b)) / 2 - fs;
        glyphe(k, mx, my, ty == "horizontal" ? "H" : "V");
      }
    } else if (ty == "parallel" || ty == "perp" || ty == "equal" || ty == "tangent") {
      const J* B = entDe(sk, chaine(k, "b"));
      double mx, my;
      if (B && chaine(*B, "t") == "line" && milieu(*B, -(fs * 1.1 + sh2), mx, my)) glyphe(k, mx, my, ty == "parallel" ? "∥" : ty == "perp" ? "⊥" : ty == "equal" ? "=" : "T");
      if (ty == "equal") {
        const J* Aa = entDe(sk, chaine(k, "a"));
        if (Aa && chaine(*Aa, "t") == "line" && milieu(*Aa, -(fs * 1.1), mx, my)) glyphe(k, mx, my, "=");
      }
    } else if (ty == "eqR") {
      const J* E = entDe(sk, chaine(k, "b"));
      const J* C = E ? P(chaine(*E, "pc")) : nullptr;
      if (C) glyphe(k, X(C) + num(*E, "r") * 0.7, Y(C) - num(*E, "r") * 0.7, "=");
    } else if (ty == "midpoint") {
      if (const J* q = P(chaine(k, "p"))) glyphe(k, X(q) + fs, Y(q) + fs, "M");
    } else if (ty == "onLine" || ty == "onCircle") {
      if (const J* q = P(chaine(k, "p"))) glyphe(k, X(q) + fs * 0.9, Y(q) - fs * 0.9, "⌖");
    } else if (ty == "fix") {
      if (const J* q = P(chaine(k, "p"))) glyphe(k, X(q) - fs * 0.9, Y(q) + fs * 1.1, "⚓");
    } else if (ty == "dist" || ty == "distX" || ty == "distY") {
      if (!a || !b) continue;
      double x1 = X(a), y1 = Y(a);
      const double x2 = X(b), y2 = Y(b);
      if (ty == "distX") y1 = y2;
      else if (ty == "distY") x1 = x2;
      trait(x1, y1, x2, y2, ApercuEsquisse::AIDE);
      if (ty != "dist" && (std::abs(x1 - X(a)) > 1e-6 || std::abs(y1 - Y(a)) > 1e-6)) trait(X(a), Y(a), x1, y1, ApercuEsquisse::AIDE_POINTILLE);
      const S v = fmt(num(k, "val"));
      const double lw = longueurCar(v) * fs * 0.3 + fs * 0.6;
      const auto sg = [](double q) { return q > 0 ? 1.0 : q < 0 ? -1.0 : 1.0; };
      if (ty == "distX") glyphe(k, x2 - sg(x2 - x1) * lw, y2 - fs * 0.9 + sh2, v);
      else if (ty == "distY") glyphe(k, x2 + lw + sh2, y2 - sg(y2 - y1) * fs * 0.9, v);
      else glyphe(k, (x1 + x2) / 2, (y1 + y2) / 2 - fs * 0.9 + sh2, v);
    } else if (ty == "distPL") {
      const J* q = P(chaine(k, "p"));
      const J* L = entDe(sk, chaine(k, "ent"));
      if (!q || !L) continue;
      const J* la = P(chaine(*L, "p1"));
      const J* lb = P(chaine(*L, "p2"));
      if (!la || !lb) continue;
      const double dx = X(lb) - X(la), dy = Y(lb) - Y(la);
      double l2 = dx * dx + dy * dy;
      if (l2 == 0) l2 = 1;
      const double u = ((X(q) - X(la)) * dx + (Y(q) - Y(la)) * dy) / l2, fx0 = X(la) + dx * u, fy0 = Y(la) + dy * u;
      trait(X(q), Y(q), fx0, fy0, ApercuEsquisse::AIDE);
      glyphe(k, (X(q) + fx0) / 2 + fs * 1.2, (Y(q) + fy0) / 2, fmt(num(k, "val")));
    } else if (ty == "radius") {
      const J* E = entDe(sk, chaine(k, "a"));
      const J* C = E ? P(chaine(*E, "pc")) : nullptr;
      if (C) glyphe(k, X(C) + num(*E, "r") * 0.71, Y(C) - num(*E, "r") * 0.71, "R" + fmt(num(k, "val")));
    } else if (ty == "angle") {
      const J* B = entDe(sk, chaine(k, "b"));
      double mx, my;
      if (B && milieu(*B, fs * 1.5, mx, my)) glyphe(k, mx, my, fmt(num(k, "val") * 180 / PI) + "°");
    }
  }
  return A;
}
}  // namespace plan
