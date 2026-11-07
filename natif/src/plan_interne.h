// Les aides du dessin de planche, partagées entre plan.cpp et plan_cotes.cpp
#pragma once
#include <cmath>
#include <optional>
#include <set>

#include "nombres_js.h"
#include "plan.h"

namespace plan {
namespace {
const double PI = 3.14159265358979323846;
const double CAP_RATIO = 0.716;

// ── lecture du JSON, à la manière de JavaScript ──
double num(const J& o, const char* k, double d = 0) {
  if (!o.is_object() || !o.contains(k)) return d;
  const J& v = o[k];
  if (v.is_number()) return v.get<double>();
  if (v.is_string()) {
    const double x = js::nombre(v.get<std::string>());
    return std::isnan(x) ? d : x;
  }
  if (v.is_boolean()) return v.get<bool>() ? 1 : 0;
  return d;
}
double nv(const J& v, double d = 0) {
  if (v.is_number()) return v.get<double>();
  if (v.is_string()) {
    const double x = js::nombre(v.get<std::string>());
    return std::isnan(x) ? d : x;
  }
  return d;
}
bool vrai(const J& o, const char* k) {  // !!o[k]
  if (!o.is_object() || !o.contains(k)) return false;
  const J& v = o[k];
  if (v.is_boolean()) return v.get<bool>();
  if (v.is_number()) return v.get<double>() != 0;
  if (v.is_string()) return !v.get<std::string>().empty();
  return !v.is_null();
}
std::string chaine(const J& o, const char* k, const std::string& d = "") {
  if (!o.is_object() || !o.contains(k)) return d;
  const J& v = o[k];
  if (v.is_string()) return v.get<std::string>();
  if (v.is_number()) return js::texte(v.get<double>());
  if (v.is_boolean()) return v.get<bool>() ? "true" : "false";
  return d;
}
const J& vide() {
  static const J n;
  return n;
}
const J& sous(const J& o, const char* k) { return o.is_object() && o.contains(k) ? o[k] : vide(); }
V3 v3(const J& a, V3 d = {0, 0, 0}) {
  if (!a.is_array() || a.size() < 3) return d;
  return {nv(a[0]), nv(a[1]), nv(a[2])};
}
double arr3(double v) { return js::arrondi(v, 3); }
std::string tx(double v) { return js::texte(v); }

// ── vecteurs (mepNorm...) ──
V3 norme(V3 a) {
  double l = std::sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  if (l == 0) l = 1;
  return {a[0] / l, a[1] / l, a[2] / l};
}
double dot(const V3& a, const V3& b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
V3 cross(const V3& a, const V3& b) { return {a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]}; }
V3 moins(const V3& a, const V3& b) { return {a[0] - b[0], a[1] - b[1], a[2] - b[2]}; }

struct Base {
  V3 dir{0, -1, 0}, u{1, 0, 0}, v{0, 0, -1};
};
Base baseDeDirection(const V3& dir0) {  // mepBasisFromDir sans indication
  const V3 d = norme(dir0);
  V3 up{0, 0, 1};
  if (std::abs(dot(up, d)) > 0.98) up = std::abs(d[2]) > 0.9 ? V3{0, 1, 0} : V3{0, 0, 1};
  Base b;
  b.dir = d;
  b.u = norme(cross(up, d));
  b.v = norme(cross(b.u, d));
  return b;
}
bool vueStandard(const std::string& vk, V3& dir, V3& u, V3& v, bool& aUV) {
  aUV = true;
  if (vk == "front") dir = {0, -1, 0}, u = {1, 0, 0}, v = {0, 0, -1};
  else if (vk == "top") dir = {0, 0, 1}, u = {1, 0, 0}, v = {0, -1, 0};
  else if (vk == "bottom") dir = {0, 0, -1}, u = {1, 0, 0}, v = {0, 1, 0};
  else if (vk == "right") dir = {1, 0, 0}, u = {0, 1, 0}, v = {0, 0, -1};
  else if (vk == "left") dir = {-1, 0, 0}, u = {0, -1, 0}, v = {0, 0, -1};
  else if (vk == "rear") dir = {0, 1, 0}, u = {-1, 0, 0}, v = {0, 0, -1};
  else if (vk == "iso") dir = {0.62, -0.62, 0.48}, aUV = false;
  else return false;
  return true;
}
Base baseDe(const J& w) {  // mepBasisOf
  const std::string kind = chaine(w, "kind");
  const bool flip = vrai(w, "flip");
  const auto retourne = [&](Base b) {
    if (flip) b.v = {-b.v[0], -b.v[1], -b.v[2]};
    return b;
  };
  if (kind == "base") {
    V3 d, u, v;
    bool aUV;
    if (vueStandard(chaine(w, "vk"), d, u, v, aUV)) {
      Base b;
      if (aUV) b.dir = d, b.u = u, b.v = v;
      else b = baseDeDirection(d);
      return retourne(b);
    }
    if (vrai(w, "camera") && vrai(w, "dir")) return retourne(baseDeDirection(v3(w["dir"])));
  }
  const V3 u = norme(v3(sous(w, "u"), {1, 0, 0}));
  const V3 d = norme(v3(sous(w, "dir"), {0, -1, 0}));
  V3 v = cross(u, d);
  const double L = std::sqrt(dot(v, v));
  if (L < 1e-6) return baseDeDirection(d);
  v = {v[0] / L, v[1] / L, v[2] / L};
  Base b;
  b.dir = d, b.u = u, b.v = v;
  return retourne(b);
}

const J* vueDe(const J& sh, const std::string& id) {  // mepView
  const J& L = sous(sh, "views");
  if (L.is_array())
    for (const J& v : L)
      if (chaine(v, "id") == id) return &v;
  return nullptr;
}

std::string fmtNum(double v, int dp = -1) {  // mepFmtNum
  if (!std::isfinite(v)) return "—";
  const int d = dp >= 0 ? dp : (std::abs(v) >= 10 ? 1 : (std::abs(v) >= 1 ? 2 : 3));
  std::string s = js::fixe(v, d);
  if (s.find('.') != std::string::npos) {
    size_t f = s.size();
    while (f > 0 && s[f - 1] == '0') f--;
    if (f > 0 && s[f - 1] == '.') f--;
    s.resize(f);
  }
  return s == "-0" ? "0" : s;
}

bool boiteEnt(const Ent& e, double& minx, double& miny, double& maxx, double& maxy) {
  if (e.t == 'L') {
    minx = std::min(e.x1, e.x2), miny = std::min(e.y1, e.y2), maxx = std::max(e.x1, e.x2), maxy = std::max(e.y1, e.y2);
    return true;
  }
  if (e.t == 'C') {
    minx = e.cx - e.r, miny = e.cy - e.r, maxx = e.cx + e.r, maxy = e.cy + e.r;
    return true;
  }
  if (e.t == 'A') {
    std::vector<P2> pts{{e.cx + e.r * std::cos(e.a0), e.cy + e.r * std::sin(e.a0)}, {e.cx + e.r * std::cos(e.a1), e.cy + e.r * std::sin(e.a1)}};
    const double lo = std::min(e.a0, e.a1), hi = std::max(e.a0, e.a1);
    for (int k = 0; k < 4; k++) {
      double tt = k * PI / 2;
      while (tt < lo) tt += 2 * PI;
      if (tt <= hi) pts.push_back({e.cx + e.r * std::cos(tt), e.cy + e.r * std::sin(tt)});
    }
    minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const P2& p : pts) minx = std::min(minx, p[0]), maxx = std::max(maxx, p[0]), miny = std::min(miny, p[1]), maxy = std::max(maxy, p[1]);
    return true;
  }
  if (e.t == 'P' && !e.pts.empty()) {
    minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const P2& p : e.pts) minx = std::min(minx, p[0]), maxx = std::max(maxx, p[0]), miny = std::min(miny, p[1]), maxy = std::max(maxy, p[1]);
    return true;
  }
  return false;
}
struct Boite {
  double x = 0, y = 0, w = 0, h = 0;
};
}  // namespace

struct XY {
  double x = 0, y = 0;
};
struct Prim {  // un trait d'axe
  char t = 'L';
  double x1 = 0, y1 = 0, x2 = 0, y2 = 0, cx = 0, cy = 0, r = 0;
  std::string cls;
};
struct Axe : Prim {
  double bx1 = 0, by1 = 0, bx2 = 0, by2 = 0;  // le trait d'origine, avant allongement
  std::string ak;
  bool manuel = false;
};
struct StyleCotes {  // MEP_DIM_STYLE, MEP_TEXT_STYLE
  double gap = 1.5, overrun = 2, leaderGap = 1.5, arrowAngle = 36, arrowLen = 7, dimH = 3.5, lblH = 5, noteH = 3.5, textHeight = 4.888;
  int prec = 2;
};
struct At {
  Elt& e;
  At& n(const char* k, double v) {
    e.at.emplace_back(k, tx(v));
    return *this;
  }
  At& s(const char* k, const std::string& v) {
    e.at.emplace_back(k, v);
    return *this;
  }
  At& t(const std::string& v) {
    e.txt = v;
    return *this;
  }
};
struct Ctx {
  std::vector<Elt>& out;
  J& mep;
  J& sh;
  int cur;
  const Piece& piece;
  Calcul& calc;
  StyleCotes st;
  std::map<std::string, std::vector<Axe>> axes;  // par vue, pour ce dessin
  std::map<std::string, std::shared_ptr<void>> oblongs;
  std::map<std::string, int> nbTrous;
  At mk(const char* tag) {
    out.emplace_back();
    out.back().tag = tag;
    return At{out.back()};
  }
};
namespace {
size_t longueurCar(const std::string& s) {  // .length, UTF-16
  size_t n = 0;
  for (unsigned char ch : s) {
    if ((ch & 0xC0) != 0x80) n++;
    if ((ch & 0xF8) == 0xF0) n++;
  }
  return n;
}
std::string debutCar(const std::string& s, size_t n) {  // .slice(0,n), caractères
  size_t i = 0, c = 0;
  while (i < s.size() && c < n) {
    const unsigned char ch = s[i];
    const size_t l = ch < 0x80 ? 1 : (ch & 0xE0) == 0xC0 ? 2 : (ch & 0xF0) == 0xE0 ? 3 : 4;
    i += l;
    c += l == 4 ? 2 : 1;
  }
  return s.substr(0, i);
}
}  // namespace

// Les axes d'une vue et les cotes (98-mep-70-cotes.js, 98-mep-71-oblong.js)
void dessinerAxesVue(Ctx& c, J& v);
void dessinerCote(Ctx& c, J& d);
void ceQuiSaisitLaCote(Ctx& c, J& d, CoteVue& q);  // mepDimTextPos, les flèches
GesteCote saisirCoteDans(Ctx& c, J& d, double x, double y, double zoom);
bool deplacerCoteDans(Ctx& c, J& d, double x, double y, const GesteCote& g);
void inverserAngleDans(Ctx& c, J& d);
Ctx contexteGeste(J& mep, int planche, const Piece& p, Calcul& calc);
void suivreLiensCoupes(Ctx& c);  // mepCutFollowAll
void liensAutoCoupe(Ctx& c, J& v);  // mepCutAutoRefs
void suivreLesFilles(J& sh, const std::string& id, double dx, double dy);  // mepProjFollow
std::optional<Ent> entiteParHint(Ctx& c, J& v, const J& hint);  // mepEntByHint
struct Accroche {  // mepSnapPt
  double x = 0, y = 0;
  bool hit = false;
  std::string t, vid, ak;
  int i = -1;
};
Accroche accrocher(Ctx& c, double x, double y, double zoom, bool sansAxes = false);
struct EntTouchee {  // mepHitViewEnt
  std::string vid, ak;
  int i = -1;
  Ent e;
  double lx = 0, ly = 0;
};
std::optional<EntTouchee> entiteSousCurseur(Ctx& c, double x, double y, double zoom, bool avecAxes);
void surfaceUtile(const J& sh, double& ix, double& iy, double& iw, double& ih);  // mepPageDim
std::string texteEsquisse(Ctx& c, const J& e, bool edition);  // mepSkTextValue
void rafraichirLiensEsquisse(Ctx& c);  // mepSkLinksRefresh
}  // namespace plan
