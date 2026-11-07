#include "profil_guide.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <functional>
#include <limits>
#include <map>
#include <regex>

#include "maths_js.h"
#include "spline.h"

using json = nlohmann::ordered_json;

namespace {
const double PG_TOL = 0.01;
const double PI_JS = 3.141592653589793;

std::string str(const json& o, const char* k) {
  const auto i = o.find(k);
  return i != o.end() && i->is_string() ? i->get<std::string>() : std::string();
}
bool vrai(const json& o, const char* k) {
  const auto i = o.find(k);
  if (i == o.end() || i->is_null()) return false;
  if (i->is_boolean()) return i->get<bool>();
  if (i->is_number()) return i->get<double>() != 0;
  if (i->is_string()) return !i->get<std::string>().empty();
  return true;
}
double nombre(const json& o, const char* k) {
  const auto i = o.find(k);
  if (i == o.end()) return 0;
  if (i->is_number()) return i->get<double>();
  if (i->is_string()) return std::strtod(i->get<std::string>().c_str(), nullptr);
  return 0;
}
struct P {
  double x = 0, y = 0;
};
bool pointDe(const json& sk, const std::string& id, P& q) {
  if (id.empty() || !sk.contains("points") || !sk["points"].is_object()) return false;
  const auto i = sk["points"].find(id);
  if (i == sk["points"].end() || !i->is_object()) return false;
  q.x = nombre(*i, "x");
  q.y = nombre(*i, "y");
  return true;
}
std::vector<const json*> entitesDe(const json& sk) {  // pgEnts
  std::vector<const json*> v;
  if (!sk.contains("entities") || !sk["entities"].is_array()) return v;
  for (const json& e : sk["entities"]) {
    if (!e.is_object() || vrai(e, "handle")) continue;
    const std::string t = str(e, "t");
    if (t == "line" || t == "arc" || t == "circle" || t == "spline") v.push_back(&e);
  }
  return v;
}
bool bouts(const json& e, std::string& a, std::string& b) {  // pgEnds : false = fermée à elle seule
  const std::string t = str(e, "t");
  if (t == "line") {
    a = str(e, "p1");
    b = str(e, "p2");
    return true;
  }
  if (t == "arc") {
    a = str(e, "pa");
    b = str(e, "pb");
    return a != b;
  }
  if (t == "spline" && !vrai(e, "closed") && e.contains("pts") && e["pts"].is_array() && e["pts"].size() >= 2) {
    a = e["pts"].front().get<std::string>();
    b = e["pts"].back().get<std::string>();
    return true;
  }
  return false;
}
bool memeJoint(const json& sk, const std::string& a, const std::string& b) {  // skJointSame
  if (a == b) return true;
  if (a.empty() || b.empty()) return false;
  if (sk.contains("constraints") && sk["constraints"].is_array())
    for (const json& c : sk["constraints"])
      if (str(c, "type") == "coincident" && ((str(c, "a") == a && str(c, "b") == b) || (str(c, "a") == b && str(c, "b") == a))) return true;
  P A, B;
  return pointDe(sk, a, A) && pointDe(sk, b, B) && hyp(A.x - B.x, A.y - B.y) < 1e-6;
}
struct Lieu {
  double x = 0, y = 0, tx = 0, ty = 0;
};
struct Pres {
  double s = 0, d = std::numeric_limits<double>::infinity();
};
struct Troncon {
  const json* e = nullptr;
  bool fwd = true;
  double len = 0;
  std::function<Lieu(double)> at;
  std::function<Pres(double, double)> pres;
};
void presSeg(const P& A, const P& B, double x, double y, double& t, double& d) {
  const double dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
  t = L2 > 0 ? ((x - A.x) * dx + (y - A.y) * dy) / L2 : 0;
  t = std::max(0.0, std::min(1.0, t));
  d = hyp(A.x + dx * t - x, A.y + dy * t - y);
}
bool bspline(const json& sk, const json& e, BSpline& f) {  // skSplineFit
  const bool ctrl = str(e, "mode") == "ctrl";
  std::vector<P2d> Q, H;
  std::vector<char> aH;
  if (!e.contains("pts") || !e["pts"].is_array() || e["pts"].size() < 2) return false;
  for (const json& idj : e["pts"]) {
    const std::string id = idj.is_string() ? idj.get<std::string>() : std::string();
    P q;
    if (!pointDe(sk, id, q)) return false;
    Q.push_back({q.x, q.y});
    bool a = false;
    P h;
    if (!ctrl && sk.contains("entities"))
      for (const json& l : sk["entities"])
        if (str(l, "t") == "line" && str(l, "handle") == str(e, "id") && str(l, "p1") == id && pointDe(sk, str(l, "p2"), h)) a = true;
    H.push_back(a ? P2d{h.x, h.y} : P2d{0, 0});
    aH.push_back(a);
  }
  const bool ferme = vrai(e, "closed") && Q.size() >= 3;
  if (ctrl) {
    std::vector<double> kn;
    if (e.contains("knots") && e["knots"].is_array())
      for (const json& k : e["knots"])
        if (k.is_number()) kn.push_back(k.get<double>());
    return bsControl(Q, ferme, kn.empty() ? nullptr : &kn, static_cast<int>(nombre(e, "deg")), f);
  }
  return bsInterpolate(Q, H, aH, ferme, f);
}
bool troncon(const json& sk, const json& e, bool fwd, Troncon& g) {  // pgSeg
  g.e = &e;
  g.fwd = fwd;
  const std::string t = str(e, "t");
  if (t == "line") {
    P A, B;
    if (!pointDe(sk, str(e, fwd ? "p1" : "p2"), A) || !pointDe(sk, str(e, fwd ? "p2" : "p1"), B)) return false;
    const double dx = B.x - A.x, dy = B.y - A.y, L = hyp(dx, dy);
    if (!(L > 1e-9)) return false;
    g.len = L;
    g.at = [=](double s) { return Lieu{A.x + dx * s / L, A.y + dy * s / L, dx / L, dy / L}; };
    g.pres = [=](double x, double y) {
      double u, d;
      presSeg(A, B, x, y, u, d);
      return Pres{u * L, d};
    };
    return true;
  }
  if (t == "arc" || t == "circle") {
    P C;
    const double r = nombre(e, "r");
    if (!pointDe(sk, str(e, "pc"), C) || !(r > 1e-9)) return false;
    double a1 = 0, d = 2 * PI_JS;
    if (t == "arc") {  // arcAngles
      P A, B;
      if (!pointDe(sk, str(e, "pa"), A) || !pointDe(sk, str(e, "pb"), B)) return false;
      a1 = m_atan2(A.y - C.y, A.x - C.x);
      if (str(e, "pa") == str(e, "pb")) {
        d = PI_JS * 2;
      } else {
        const double a2 = m_atan2(B.y - C.y, B.x - C.x);
        d = std::fmod(a2 - a1, PI_JS * 2);
        if (d <= 0) d += PI_JS * 2;
      }
    }
    const double sg = fwd ? 1 : -1, a0 = fwd ? a1 : a1 + d, L = r * d, TAU = 2 * PI_JS;
    const auto at = [=](double s) {
      const double a = a0 + sg * s / r;
      return Lieu{C.x + r * m_cos(a), C.y + r * m_sin(a), -sg * m_sin(a), sg * m_cos(a)};
    };
    g.len = L;
    g.at = at;
    g.pres = [=](double x, double y) {
      double u = sg * (m_atan2(y - C.y, x - C.x) - a0);
      u = std::fmod(std::fmod(u, TAU) + TAU, TAU);
      double s = u * r;
      if (u > d + 1e-12) {
        const Lieu q0 = at(0), q1 = at(L);
        s = hyp(q0.x - x, q0.y - y) <= hyp(q1.x - x, q1.y - y) ? 0 : L;
      }
      const Lieu q = at(s);
      return Pres{s, hyp(q.x - x, q.y - y)};
    };
    return true;
  }
  if (t == "spline") {
    BSpline f;
    if (!bspline(sk, e, f)) return false;
    const std::vector<P2d> brut = bsSample(f, f.a, f.b, 64);
    if (brut.size() < 2) return false;
    auto pl = std::make_shared<std::vector<P>>();
    for (const P2d& q : brut) pl->push_back({q[0], q[1]});
    if (!fwd) std::reverse(pl->begin(), pl->end());
    auto cum = std::make_shared<std::vector<double>>(1, 0.0);
    for (size_t i = 1; i < pl->size(); i++) cum->push_back((*cum)[i - 1] + hyp((*pl)[i].x - (*pl)[i - 1].x, (*pl)[i].y - (*pl)[i - 1].y));
    const double L = cum->back();
    if (!(L > 1e-9)) return false;
    g.len = L;
    g.at = [=](double s0) {
      const double s = std::max(0.0, std::min(L, s0));
      int lo = 0, hi = static_cast<int>(cum->size()) - 1;
      while (hi - lo > 1) {
        const int m = (lo + hi) >> 1;
        if ((*cum)[m] <= s) lo = m;
        else hi = m;
      }
      const P A = (*pl)[lo], B = (*pl)[hi];
      double l = (*cum)[hi] - (*cum)[lo];
      if (l == 0) l = 1;
      const double u = (s - (*cum)[lo]) / l;
      const int dernier = static_cast<int>(pl->size()) - 1;
      const auto dir = [&](int k) {
        const P a = (*pl)[std::max(0, k)], b = (*pl)[std::min(dernier, k + 1)];
        double n = hyp(b.x - a.x, b.y - a.y);
        if (n == 0) n = 1;
        return std::array<double, 2>{(b.x - a.x) / n, (b.y - a.y) / n};
      };
      const auto d0 = dir(lo), dm = u < 0.5 ? dir(lo - 1) : dir(lo + 1);
      const double w = u < 0.5 ? 0.5 - u : u - 0.5;
      double tx = d0[0] * (1 - w) + dm[0] * w, ty = d0[1] * (1 - w) + dm[1] * w;
      double n = hyp(tx, ty);
      if (n == 0) n = 1;
      return Lieu{A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u, tx / n, ty / n};
    };
    g.pres = [=](double x, double y) {
      Pres best;
      for (size_t i = 0; i + 1 < pl->size(); i++) {
        double u, d;
        presSeg((*pl)[i], (*pl)[i + 1], x, y, u, d);
        if (d < best.d) best = {(*cum)[i] + u * ((*cum)[i + 1] - (*cum)[i]), d};
      }
      return best;
    };
    return true;
  }
  return false;
}
struct Chaine {
  std::vector<Troncon> segs;
  std::vector<double> off;
  bool closed = false;
  double L = 0;
  std::string head, tail;
  Lieu at(double s) const {
    if (closed) s = std::fmod(std::fmod(s, L) + L, L);
    else s = std::max(0.0, std::min(L, s));
    size_t k = 0;
    while (k + 1 < segs.size() && s >= off[k + 1] - 1e-9) k++;  // à une jonction : le tronçon qui commence
    return segs[k].at(s - off[k]);
  }
  Pres locate(double x, double y) const {
    Pres best;
    for (size_t k = 0; k < segs.size(); k++) {
      const Pres n = segs[k].pres(x, y);
      if (n.d < best.d) best = {off[k] + n.s, n.d};
    }
    return best;
  }
};
Chaine faire(std::vector<Troncon> segs, bool closed, const std::string& head, const std::string& tail) {  // pgMake
  Chaine c;
  c.off.push_back(0);
  for (size_t i = 0; i < segs.size(); i++) c.off.push_back(c.off[i] + segs[i].len);
  c.L = c.off.back();
  c.segs = std::move(segs);
  c.closed = closed;
  c.head = head;
  c.tail = tail;
  return c;
}
std::vector<Chaine> chaines(const json& sk) {  // pgChains
  const std::vector<const json*> E = entitesDe(sk);
  std::set<std::string> used;
  std::vector<Chaine> out;
  for (const json* e : E) {
    const std::string id = str(*e, "id");
    if (used.count(id)) continue;
    used.insert(id);
    std::string head, tail;
    if (!bouts(*e, head, tail)) {
      Troncon g;
      if (troncon(sk, *e, true, g)) out.push_back(faire({std::move(g)}, true, "", ""));
      continue;
    }
    struct O {
      const json* e;
      bool fwd;
    };
    std::vector<O> ord{{e, true}};
    bool closed = memeJoint(sk, head, tail);
    const auto grow = [&](bool atTail) {
      while (!closed) {
        const std::string pt = atTail ? tail : head;
        const json* nx = nullptr;
        std::string a, b;
        for (const json* q : E) {
          if (used.count(str(*q, "id"))) continue;
          std::string x, y;
          if (bouts(*q, x, y) && (memeJoint(sk, x, pt) || memeJoint(sk, y, pt))) {
            nx = q;
            a = x;
            b = y;
            break;
          }
        }
        if (!nx) return;
        used.insert(str(*nx, "id"));
        if (atTail) {
          const bool fwd = memeJoint(sk, a, pt);
          ord.push_back({nx, fwd});
          tail = fwd ? b : a;
        } else {
          const bool fwd = memeJoint(sk, b, pt);
          ord.insert(ord.begin(), O{nx, fwd});
          head = fwd ? a : b;
        }
        if (memeJoint(sk, head, tail)) closed = true;
      }
    };
    grow(true);
    grow(false);
    std::vector<Troncon> segs;
    for (const O& o : ord) {
      Troncon g;
      if (troncon(sk, *o.e, o.fwd, g)) segs.push_back(std::move(g));
    }
    if (!segs.empty()) out.push_back(faire(std::move(segs), closed, closed ? "" : head, closed ? "" : tail));
  }
  return out;
}
bool departDe(const json& sk, const json& path, P& q) {  // pgStartXY
  if (!path.is_object()) return false;
  if (vrai(path, "mid")) {
    if (!sk.contains("entities")) return false;
    for (const json& e : sk["entities"])
      if (str(e, "id") == str(path, "mid")) {
        P A, B;
        if (!pointDe(sk, str(e, "p1"), A) || !pointDe(sk, str(e, "p2"), B)) return false;
        q = {(A.x + B.x) / 2, (A.y + B.y) / 2};
        return true;
      }
    return false;
  }
  return vrai(path, "pt") && pointDe(sk, str(path, "pt"), q);
}
std::string fixeTexte(double v, int n) {
  char b[64];
  snprintf(b, sizeof b, "%.*f", n, v);
  return b;
}
struct Resolu {
  std::vector<Chaine> C;
  int ch = -1;
  double s0 = 0;
  std::string err;
};
Resolu resoudre(const json& sk, const json& path) {  // pgResolve
  Resolu R;
  R.C = chaines(sk);
  if (R.C.empty()) {
    R.err = "l’esquisse guide n’a ni ligne, ni arc, ni spline";
    return R;
  }
  P q;
  if (!departDe(sk, path, q)) {
    if (path.is_object() && (vrai(path, "pt") || vrai(path, "mid"))) {
      R.err = "point de départ introuvable dans l’esquisse guide";
      return R;
    }
    R.ch = 0;
    for (size_t i = 1; i < R.C.size(); i++)
      if (R.C[i].L > R.C[R.ch].L) R.ch = static_cast<int>(i);
    return R;
  }
  double bd = std::numeric_limits<double>::infinity();
  for (size_t i = 0; i < R.C.size(); i++) {
    const Pres n = R.C[i].locate(q.x, q.y);
    if (R.ch < 0 || n.d < bd) {
      R.ch = static_cast<int>(i);
      R.s0 = n.s;
      bd = n.d;
    }
  }
  if (bd > PG_TOL) {
    R.err = "le point de départ n’est pas sur la courbe guide (écart " + fixeTexte(bd, 3) + " mm)";
    R.ch = -1;
    return R;
  }
  if (R.C[R.ch].closed && R.s0 > R.C[R.ch].L - 1e-9) R.s0 = 0;
  return R;
}
std::string virgule(double v) {  // String(+v.toFixed(n)).replace('.', ',')
  char b[64];
  snprintf(b, sizeof b, "%.3f", v);
  std::string s = b;
  while (!s.empty() && s.back() == '0') s.pop_back();
  if (!s.empty() && s.back() == '.') s.pop_back();
  std::replace(s.begin(), s.end(), '.', ',');
  return s;
}
std::string virgule2(double v) {
  char b[64];
  snprintf(b, sizeof b, "%.2f", v);
  std::string s = b;
  while (!s.empty() && s.back() == '0') s.pop_back();
  if (!s.empty() && s.back() == '.') s.pop_back();
  std::replace(s.begin(), s.end(), '.', ',');
  return s;
}
}  // namespace

BasePg pgBase(const json& sk) {
  BasePg b;
  const auto v3 = [&](const char* k, std::array<double, 3>& a) {
    if (!sk.contains(k) || !sk[k].is_array() || sk[k].size() < 3) return false;
    for (size_t i = 0; i < 3; i++) a[i] = sk[k][i].is_number() ? sk[k][i].get<double>() : 0;
    return true;
  };
  v3("origin", b.O);
  if (v3("axU", b.U) && v3("axV", b.V) && v3("axN", b.N)) return b;
  const std::string p = str(sk, "plane");
  if (p == "XZ") {
    b.U = {1, 0, 0};
    b.V = {0, 0, 1};
    b.N = {0, -1, 0};
  } else if (p == "YZ") {
    b.U = {0, 1, 0};
    b.V = {0, 0, 1};
    b.N = {1, 0, 0};
  }
  return b;
}

PlanPg pgPlan(const json& sk, const json& cfg, int n) {
  PlanPg P_;
  const json path = cfg.contains("path") ? cfg["path"] : json();
  const Resolu R = resoudre(sk, path);
  if (!R.err.empty()) {
    P_.err = R.err;
    return P_;
  }
  const Chaine& ch = R.C[R.ch];
  // pgStations
  n = std::max(1, n);
  const double L = ch.L;
  const bool pitch = str(cfg, "pspace") == "pitch", rev = vrai(cfg, "rev");
  const double dist = std::abs(nombre(cfg, "dist"));
  double dir, step;
  if (ch.closed) {
    dir = rev ? -1 : 1;
    step = pitch ? dist : L / n;
    if (pitch && step * (n - 1) >= L - 1e-9) P_.warn = "le pas × (quantité − 1) dépasse un tour : des exemplaires se superposent";
  } else {
    dir = (R.s0 <= L / 2 ? 1 : -1) * (rev ? -1 : 1);
    const double avail = dir > 0 ? L - R.s0 : R.s0;
    step = pitch ? dist : (n > 1 ? avail / (n - 1) : 0);
    if (!(avail > 1e-9) && n > 1) P_.warn = "aucune longueur dans ce sens : inversez le sens ou partez de l’autre extrémité";
  }
  std::vector<double> S;
  for (int i = 0; i < n; i++) {
    double s = R.s0 + dir * step * i;
    if (ch.closed) {
      s = std::fmod(std::fmod(s, L) + L, L);
    } else if (s < -1e-6 || s > L + 1e-6) {
      if (P_.warn.empty()) P_.warn = std::to_string(n - i) + " exemplaire(s) au-delà de l’extrémité de la courbe : abandonné(s)";
      break;
    } else {
      s = std::max(0.0, std::min(L, s));
    }
    S.push_back(s);
  }
  // pgPlan
  const BasePg b = pgBase(sk);
  const auto W = [&](double x, double y) {
    return std::array<double, 3>{b.O[0] + x * b.U[0] + y * b.V[0], b.O[1] + x * b.U[1] + y * b.V[1], b.O[2] + x * b.U[2] + y * b.V[2]};
  };
  const Lieu q0 = ch.at(S[0]);
  const auto P0 = W(q0.x, q0.y);
  const double T0[2] = {dir * q0.tx, dir * q0.ty};
  const bool tangent = str(cfg, "orient") == "tangent";
  for (size_t i = 1; i < S.size(); i++) {
    const Lieu q = ch.at(S[i]);
    const double Ti[2] = {dir * q.tx, dir * q.ty};
    double ang = 0;
    if (tangent) {
      ang = m_atan2(T0[0] * Ti[1] - T0[1] * Ti[0], T0[0] * Ti[0] + T0[1] * Ti[1]) * 180 / PI_JS;
      const double uv[3] = {b.U[1] * b.V[2] - b.U[2] * b.V[1], b.U[2] * b.V[0] - b.U[0] * b.V[2], b.U[0] * b.V[1] - b.U[1] * b.V[0]};
      if (uv[0] * b.N[0] + uv[1] * b.N[1] + uv[2] * b.N[2] < 0) ang = -ang;
    }
    P_.cases.push_back({P0, W(q.x, q.y), b.N, ang});
  }
  P_.L = ch.L;
  P_.closed = ch.closed;
  P_.step = step;
  return P_;
}

std::set<std::string> pgIdsCourbe(const json& sk, const json& path) {
  std::set<std::string> ids;
  const Resolu R = resoudre(sk, path);
  if (R.ch >= 0)
    for (const Troncon& g : R.C[R.ch].segs) ids.insert(str(*g.e, "id"));
  return ids;
}

std::vector<ChoixDepart> pgChoixDepart(const json& sk) {
  std::vector<ChoixDepart> out;
  std::vector<P> vus;
  std::set<std::string> seen;
  const std::vector<Chaine> C = chaines(sk);
  const auto xy = [](const P& q) { return "(" + virgule2(q.x) + " ; " + virgule2(q.y) + ")"; };
  const auto surCourbe = [&](const P& q) {
    for (const Chaine& ch : C)
      if (ch.locate(q.x, q.y).d <= PG_TOL) return true;
    return false;
  };
  const auto ajoute = [&](const json& v, const std::string& label, const P& q) {
    const std::string k = v.dump();
    if (seen.count(k)) return;
    for (const P& o : vus)
      if (hyp(o.x - q.x, o.y - q.y) < 1e-6) return;
    seen.insert(k);
    vus.push_back(q);
    out.push_back({v, label});
  };
  const json vide = json::array();
  const json& ents = sk.contains("entities") && sk["entities"].is_array() ? sk["entities"] : vide;
  for (const json& e : ents) {
    P q;
    if (str(e, "t") == "cpoint" && pointDe(sk, str(e, "p"), q) && surCourbe(q)) ajoute(json{{"pt", str(e, "p")}}, "Point " + xy(q), q);
  }
  std::set<std::string> hd, tour;
  std::vector<std::string> ent;
  std::set<std::string> dansEnt;
  for (const json& e : ents) {
    if (!e.is_object()) continue;
    if (vrai(e, "handle")) {
      for (const char* k : {"p", "p1", "p2"})
        if (!str(e, k).empty()) hd.insert(str(e, k));
    } else if (str(e, "t") != "cpoint") {
      const auto met = [&](const std::string& x) {
        if (!x.empty() && dansEnt.insert(x).second) ent.push_back(x);
      };
      for (const char* k : {"p1", "p2", "pa", "pb", "pc"}) met(str(e, k));
      if (e.contains("pts") && e["pts"].is_array())
        for (const json& x : e["pts"])
          if (x.is_string()) met(x.get<std::string>());
    }
  }
  for (const Chaine& ch : C)
    for (const Troncon& g : ch.segs) {
      std::string a, b;
      if (bouts(*g.e, a, b)) {
        tour.insert(a);
        tour.insert(b);
      }
    }
  for (const std::string& id : ent) {
    P q;
    if (pointDe(sk, id, q) && !hd.count(id) && !tour.count(id) && surCourbe(q)) ajoute(json{{"pt", id}}, "Point " + xy(q), q);
  }
  for (size_t k = 0; k < C.size(); k++) {
    const Chaine& ch = C[k];
    const std::string tag = C.size() > 1 ? " · courbe " + std::to_string(k + 1) : "";
    P q;
    if (!ch.closed) {
      if (pointDe(sk, ch.head, q)) ajoute(json{{"pt", ch.head}}, "Extrémité A " + xy(q) + tag, q);
      if (pointDe(sk, ch.tail, q)) ajoute(json{{"pt", ch.tail}}, "Extrémité B " + xy(q) + tag, q);
    } else {
      for (const Troncon& g : ch.segs) {
        std::string a, b;
        if (!bouts(*g.e, a, b)) continue;
        const std::string pid = g.fwd ? a : b;
        if (pointDe(sk, pid, q)) ajoute(json{{"pt", pid}}, "Sommet " + xy(q) + tag, q);
      }
    }
    for (const Troncon& g : ch.segs) {
      if (str(*g.e, "t") != "line") continue;
      const json v{{"mid", str(*g.e, "id")}};
      if (departDe(sk, v, q)) ajoute(v, "Milieu de ligne " + xy(q) + tag, q);
    }
  }
  return out;
}

json pgDepartDefaut(const json& sk) {
  json r = json::object();
  r["sk"] = str(sk, "id");
  const auto c = pgChoixDepart(sk);
  if (!c.empty())
    for (auto it = c[0].v.begin(); it != c[0].v.end(); ++it) r[it.key()] = *it;
  return r;
}

bool pgMemeDepart(const json& a, const json& b) { return a.is_object() && b.is_object() && str(a, "pt") == str(b, "pt") && str(a, "mid") == str(b, "mid"); }

std::vector<const json*> pgEsquissesGuides(const json& doc) {
  std::vector<const json*> v;
  if (!doc.contains("sketches") || !doc["sketches"].is_array()) return v;
  static const std::regex copie("\\(rép\\s*\\d+\\)\\s*$");
  for (const json& s : doc["sketches"])
    if (!entitesDe(s).empty() && !std::regex_search(str(s, "name"), copie)) v.push_back(&s);
  return v;
}

std::string pgNote(const PlanPg& p) {
  if (!p.err.empty()) return "⚠ " + p.err;
  return "Longueur de la courbe : " + virgule(p.L) + " mm · " + (p.closed ? "fermée" : "ouverte") + " · pas " + virgule(p.step) + " mm" + (p.warn.empty() ? "" : " — ⚠ " + p.warn);
}
