// Lire un DXF pour en faire une vue de la mise en plan (src/98-01-import-dxf.js, mepDxfParse) :
// lignes, cercles, arcs, polylignes avec renflements, ellipses, splines, blocs, et les cotes reprises en cotes du plan.
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdlib>
#include <limits>
#include <map>
#include <regex>
#include <string>
#include <vector>

#include "nombres_js.h"
#include "plan.h"

namespace plan {
namespace {
constexpr double PI_ = 3.14159265358979323846;
using Mat = std::array<double, 6>;  // x' = a x + c y + e ; y' = b x + d y + f
using Pt = std::array<double, 2>;
struct Entite {
  std::string t;
  std::vector<std::pair<int, std::string>> g;
  double num(int c, double d) const {
    for (const auto& q : g)
      if (q.first == c) return nombre(q.second);
    return d;
  }
  std::string str(int c) const {
    for (const auto& q : g)
      if (q.first == c) return coupe(q.second);
    return "";
  }
  static std::string coupe(const std::string& s) {
    const size_t a = s.find_first_not_of(" \t\r\n");
    if (a == std::string::npos) return "";
    return s.substr(a, s.find_last_not_of(" \t\r\n") - a + 1);
  }
  static double nombre(const std::string& s) {  // +v du JS : vide = 0, illisible = NaN
    const std::string c = coupe(s);
    if (c.empty()) return 0;
    char* fin = nullptr;
    const double v = std::strtod(c.c_str(), &fin);
    return *fin ? std::numeric_limits<double>::quiet_NaN() : v;
  }
};
struct Bloc {
  std::string name;
  double bx = 0, by = 0;
  std::vector<Entite> ents;
};
struct Sortie {
  char t = 'L';
  double x1 = 0, y1 = 0, x2 = 0, y2 = 0, cx = 0, cy = 0, r = 0, s = 0, e = 0;
  std::vector<Pt> pts;
  std::string k;
};
struct CoteDxf {
  std::string kind, orient;
  Pt a{}, b{}, p{}, c{}, tx{};
  double r = 0;
};
Mat mul(const Mat& M, const Mat& N) {
  return {M[0] * N[0] + M[2] * N[1], M[1] * N[0] + M[3] * N[1], M[0] * N[2] + M[2] * N[3], M[1] * N[2] + M[3] * N[3], M[0] * N[4] + M[2] * N[5] + M[4], M[1] * N[4] + M[3] * N[5] + M[5]};
}
Pt tp(const Mat& M, double x, double y) { return {M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]}; }
double det(const Mat& M) { return M[0] * M[3] - M[1] * M[2]; }
double scl(const Mat& M) { return std::sqrt(std::abs(det(M))); }
std::string majuscules(std::string s) {
  std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
  return s;
}
std::string genre(const Entite& e) {  // /HIDDEN|DASH|CACHE|INTERROMPU|DOT/i
  const std::string s = majuscules(e.str(6));
  for (const char* m : {"HIDDEN", "DASH", "CACHE", "INTERROMPU", "DOT"})
    if (s.find(m) != std::string::npos) return "hidden";
  return "sharp";
}
bool calqueDeCotes(const Entite& e) {  // /(^|[^A-Z])(COT|DIM)/i
  const std::string s = majuscules(e.str(8));
  for (const char* m : {"COT", "DIM"})
    for (size_t p = s.find(m); p != std::string::npos; p = s.find(m, p + 1)) {
      if (p == 0) return true;
      const unsigned char c = static_cast<unsigned char>(s[p - 1]);
      if (!(c >= 'A' && c <= 'Z')) return true;
    }
  return false;
}
std::vector<Pt> nurbs(int deg, const std::vector<Pt>& ctrl, std::vector<double> knots, std::vector<double> w) {
  const int n = static_cast<int>(ctrl.size());
  if (n < 2) return ctrl;
  if (static_cast<int>(knots.size()) != n + deg + 1) {
    knots.clear();
    for (int i = 0; i < n + deg + 1; i++) knots.push_back(i <= deg ? 0 : (i >= n ? n - deg : i - deg));
  }
  if (static_cast<int>(w.size()) != n) w.assign(n, 1.0);
  const double t0 = knots[deg], t1 = knots[n];
  const int N = std::max(24, n * 8);
  std::vector<Pt> pts;
  for (int s = 0; s <= N; s++) {
    const double t = std::min(t1 - 1e-12, t0 + (t1 - t0) * s / N);
    int k = deg;
    while (k < n - 1 && t >= knots[k + 1]) k++;
    std::vector<std::array<double, 3>> d;
    for (int j = 0; j <= deg; j++) {
      const Pt& c = ctrl[k - deg + j];
      const double ww = w[k - deg + j];
      d.push_back({c[0] * ww, c[1] * ww, ww});
    }
    for (int r = 1; r <= deg; r++)
      for (int j = deg; j >= r; j--) {
        const int i = k - deg + j;
        const double den = knots[i + deg - r + 1] - knots[i], a = den > 1e-12 ? (t - knots[i]) / den : 0;
        d[j] = {(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1], (1 - a) * d[j - 1][2] + a * d[j][2]};
      }
    pts.push_back({d[deg][0] / d[deg][2], d[deg][1] / d[deg][2]});
  }
  return pts;
}
struct Lecteur {
  std::map<std::string, Bloc> blocks;
  std::vector<Sortie> out;
  std::vector<CoteDxf> dims;
  J skipped = J::object();
  void skip(const std::string& t) { skipped[t] = (skipped.contains(t) ? skipped[t].get<int>() : 0) + 1; }
  void pushL(const Mat& M, double x1, double y1, double x2, double y2, const std::string& k) {
    const Pt a = tp(M, x1, y1), b = tp(M, x2, y2);
    Sortie o;
    o.t = 'L', o.x1 = a[0], o.y1 = a[1], o.x2 = b[0], o.y2 = b[1], o.k = k;
    out.push_back(o);
  }
  void pushA(const Mat& M, double cx, double cy, double r, double s, double e, const std::string& k) {
    while (e <= s) e += 2 * PI_;
    const Pt c = tp(M, cx, cy);
    const double R = r * scl(M);
    const Pt ps = tp(M, cx + r * std::cos(s), cy + r * std::sin(s)), pe = tp(M, cx + r * std::cos(e), cy + r * std::sin(e));
    double a0 = std::atan2(ps[1] - c[1], ps[0] - c[0]), a1 = std::atan2(pe[1] - c[1], pe[0] - c[0]);
    if (det(M) < 0) std::swap(a0, a1);
    while (a1 <= a0) a1 += 2 * PI_;
    Sortie o;
    o.cx = c[0], o.cy = c[1], o.r = R, o.k = k;
    if (e - s >= 2 * PI_ - 1e-9) {
      o.t = 'C';
    } else {
      o.t = 'A', o.s = a0, o.e = a1;
    }
    out.push_back(o);
  }
  void pushPts(const Mat& M, const std::vector<Pt>& pts, bool closed, const std::string& k) {
    std::vector<Pt> q;
    for (const Pt& p : pts) q.push_back(tp(M, p[0], p[1]));
    if (closed && q.size() > 2) q.push_back(q[0]);
    if (q.size() > 1) {
      Sortie o;
      o.t = 'P', o.pts = std::move(q), o.k = k;
      out.push_back(std::move(o));
    }
  }
  void seg(const Mat& M, const std::array<double, 3>& p, const std::array<double, 3>& q, double bu, const std::string& k) {
    if (!bu || std::abs(bu) < 1e-9) return pushL(M, p[0], p[1], q[0], q[1], k);
    const double th = 4 * std::atan(bu), dx = q[0] - p[0], dy = q[1] - p[1], ch = std::hypot(dx, dy);
    if (ch < 1e-12) return;
    const double r = ch / (2 * std::sin(std::abs(th) / 2)), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    const double h = (ch / 2) / std::tan(th / 2);
    const double cx = mx - dy / ch * h, cy = my + dx / ch * h;
    double s = std::atan2(p[1] - cy, p[0] - cx), e = std::atan2(q[1] - cy, q[0] - cx);
    if (bu < 0) std::swap(s, e);
    pushA(M, cx, cy, r, s, e, k);
  }
  void entites(const std::vector<Entite>& list, const Mat& M, int depth) {
    for (size_t i = 0; i < list.size(); i++) {
      const Entite& e = list[i];
      const std::string k = genre(e);
      const Mat Mo = mul(M, e.num(230, 1) < 0 ? Mat{-1, 0, 0, 1, 0, 0} : Mat{1, 0, 0, 1, 0, 0});
      if (e.t != "DIMENSION" && e.t != "SEQEND" && e.t != "VERTEX" && calqueDeCotes(e)) {
        skip("cotation (calque " + e.str(8) + ")");
        if (e.t == "POLYLINE")
          while (i + 1 < list.size() && list[i + 1].t != "SEQEND") i++;
        continue;
      }
      if (e.t == "DIMENSION") {
        const int ty = static_cast<int>(e.num(70, 0)) & 7;
        const auto P_ = [&](int c) { return tp(M, e.num(c, 0), e.num(c + 10, 0)); };
        if (ty == 0 || ty == 1) {
          const Pt a = P_(13), b = P_(14), pl = P_(10);
          const double rot = std::fmod(std::fmod(e.num(50, 0), 180) + 180, 180);
          const std::string orient = ty == 1 ? "a" : (std::abs(rot) < 1e-6 ? "h" : (std::abs(rot - 90) < 1e-6 ? "v" : ""));
          if (!orient.empty()) {
            CoteDxf d;
            d.kind = "lin", d.orient = orient, d.a = a, d.b = b, d.p = pl;
            dims.push_back(d);
          } else {
            skip("cote tournée");
          }
        } else if (ty == 3 || ty == 4) {
          const Pt p10 = P_(10), p15 = P_(15), t11 = tp(Mo, e.num(11, 0), e.num(21, 0));
          const Pt c = ty == 4 ? p10 : Pt{(p10[0] + p15[0]) / 2, (p10[1] + p15[1]) / 2};
          CoteDxf d;
          d.kind = ty == 4 ? "rad" : "dia", d.c = c, d.r = std::hypot(p15[0] - c[0], p15[1] - c[1]), d.tx = t11;
          dims.push_back(d);
        } else {
          skip("cote angulaire / ordonnée");
        }
      } else if (e.t == "LINE") {
        pushL(M, e.num(10, 0), e.num(20, 0), e.num(11, 0), e.num(21, 0), k);
      } else if (e.t == "CIRCLE") {
        pushA(Mo, e.num(10, 0), e.num(20, 0), e.num(40, 0), 0, 2 * PI_, k);
      } else if (e.t == "ARC") {
        pushA(Mo, e.num(10, 0), e.num(20, 0), e.num(40, 0), e.num(50, 0) * PI_ / 180, e.num(51, 360) * PI_ / 180, k);
      } else if (e.t == "LWPOLYLINE") {
        std::vector<std::array<double, 3>> V;
        for (const auto& q : e.g) {
          if (q.first == 10) V.push_back({Entite::nombre(q.second), 0, 0});
          else if (q.first == 20 && !V.empty()) V.back()[1] = Entite::nombre(q.second);
          else if (q.first == 42 && !V.empty()) V.back()[2] = Entite::nombre(q.second);
        }
        const bool closed = (static_cast<int>(e.num(70, 0)) & 1) == 1;
        for (size_t j = 0; j + 1 < V.size(); j++) seg(Mo, V[j], V[j + 1], V[j][2], k);
        if (closed && V.size() > 2) seg(Mo, V.back(), V[0], V.back()[2], k);
      } else if (e.t == "POLYLINE") {
        const int flag = static_cast<int>(e.num(70, 0));
        if (flag & (16 | 64)) {
          skip("POLYLINE 3D");
          continue;
        }
        std::vector<std::array<double, 3>> V;
        size_t j = i + 1;
        for (; j < list.size() && list[j].t != "SEQEND"; j++)
          if (list[j].t == "VERTEX") V.push_back({list[j].num(10, 0), list[j].num(20, 0), list[j].num(42, 0)});
        i = j;
        for (size_t q = 0; q + 1 < V.size(); q++) seg(Mo, V[q], V[q + 1], V[q][2], k);
        if ((flag & 1) && V.size() > 2) seg(Mo, V.back(), V[0], V.back()[2], k);
      } else if (e.t == "ELLIPSE") {
        const double cx = e.num(10, 0), cy = e.num(20, 0), mx = e.num(11, 1), my = e.num(21, 0), ra = e.num(40, 1);
        double s = e.num(41, 0), t = e.num(42, 2 * PI_);
        while (t <= s) t += 2 * PI_;
        const double R = std::hypot(mx, my), an = std::atan2(my, mx);
        if (std::abs(ra - 1) < 1e-9) {
          pushA(Mo, cx, cy, R, s + an, t + an, k);
          continue;
        }
        const int N = std::max(16, static_cast<int>(std::ceil((t - s) / (PI_ / 48))));
        std::vector<Pt> pts;
        for (int q = 0; q <= N; q++) {
          const double u = s + (t - s) * q / N, x = R * std::cos(u), y = R * ra * std::sin(u);
          pts.push_back({cx + x * std::cos(an) - y * std::sin(an), cy + x * std::sin(an) + y * std::cos(an)});
        }
        pushPts(Mo, pts, false, k);
      } else if (e.t == "SPLINE") {
        const int deg = static_cast<int>(e.num(71, 3));
        std::vector<Pt> ctrl, fit;
        std::vector<double> knots, w;
        for (const auto& q : e.g) {
          const double x = Entite::nombre(q.second);
          if (q.first == 10) ctrl.push_back({x, 0});
          else if (q.first == 20 && !ctrl.empty()) ctrl.back()[1] = x;
          else if (q.first == 11) fit.push_back({x, 0});
          else if (q.first == 21 && !fit.empty()) fit.back()[1] = x;
          else if (q.first == 40) knots.push_back(x);
          else if (q.first == 41) w.push_back(x);
        }
        const bool parPoles = static_cast<int>(ctrl.size()) > deg;
        pushPts(Mo, parPoles ? nurbs(deg, ctrl, knots, w) : fit, (static_cast<int>(e.num(70, 0)) & 1) == 1 && !parPoles, k);
      } else if (e.t == "INSERT") {
        const std::string nom = e.str(2);
        if (nom.size() >= 2 && nom[0] == '*' && (nom[1] == 'D' || nom[1] == 'd')) {
          skip("cotation (bloc " + nom + ")");
          continue;
        }
        const auto b = blocks.find(nom);
        if (b == blocks.end() || depth > 8) {
          skip("INSERT");
          continue;
        }
        const double sx = e.num(41, 1), sy = e.num(42, 1), ro = e.num(50, 0) * PI_ / 180, co = std::cos(ro), si = std::sin(ro);
        Mat T = {co * sx, si * sx, -si * sy, co * sy, e.num(10, 0), e.num(20, 0)};
        T = mul(T, Mat{1, 0, 0, 1, -b->second.bx, -b->second.by});
        const std::vector<Entite> contenu = b->second.ents;
        entites(contenu, mul(Mo, T), depth + 1);
      } else if (e.t == "SEQEND" || e.t == "VERTEX" || e.t == "ATTRIB") {
      } else {
        skip(e.t);
      }
    }
  }
};
}  // namespace

J lireDxf(const std::string& txt) {  // mepDxfParse
  std::vector<std::string> lines;
  {
    size_t d = 0;
    for (size_t i = 0; i <= txt.size(); i++) {
      if (i == txt.size() || txt[i] == '\n' || txt[i] == '\r') {
        lines.push_back(txt.substr(d, i - d));
        if (i + 1 < txt.size() && txt[i] == '\r' && txt[i + 1] == '\n') i++;
        d = i + 1;
      }
    }
  }
  std::vector<std::pair<int, std::string>> P;
  for (size_t i = 0; i + 1 < lines.size(); i += 2) {
    const std::string c0 = Entite::coupe(lines[i]);
    char* fin = nullptr;
    const long c = std::strtol(c0.c_str(), &fin, 10);
    if (fin == c0.c_str()) continue;  // parseInt du JS : le code doit commencer par un nombre
    std::string v = lines[i + 1];
    while (!v.empty() && std::isspace(static_cast<unsigned char>(v.back()))) v.pop_back();
    P.emplace_back(static_cast<int>(c), std::move(v));
  }
  double units = 0;
  Lecteur L;
  std::vector<Entite> ents;
  std::string sec;
  Entite* cur = nullptr;
  Entite enTete;
  Bloc blk;
  bool inBlk = false, aBlk = false;
  for (size_t i = 0; i < P.size(); i++) {
    const int c = P[i].first;
    const std::string& v = P[i].second;
    if (c == 0 && v == "SECTION") {
      sec = i + 1 < P.size() && P[i + 1].first == 2 ? Entite::coupe(P[i + 1].second) : "";
      i++;
      continue;
    }
    if (c == 0 && v == "ENDSEC") {
      sec.clear();
      cur = nullptr;
      continue;
    }
    if (sec == "HEADER") {
      if (c == 9 && Entite::coupe(v) == "$INSUNITS" && i + 1 < P.size() && P[i + 1].first == 70) units = Entite::nombre(P[i + 1].second);
      continue;
    }
    if (sec != "BLOCKS" && sec != "ENTITIES") continue;
    if (c == 0) {
      const std::string t = Entite::coupe(v);
      if (sec == "BLOCKS" && t == "BLOCK") {
        blk = Bloc();
        aBlk = true, inBlk = true;
        enTete = Entite();
        enTete.t = "BLOCK";
        cur = &enTete;
        continue;
      }
      if (sec == "BLOCKS" && t == "ENDBLK") {
        if (aBlk && !blk.name.empty()) L.blocks[blk.name] = blk;
        aBlk = false, inBlk = false;
        cur = nullptr;
        continue;
      }
      if (sec == "BLOCKS" && inBlk && aBlk) {
        blk.ents.emplace_back();
        cur = &blk.ents.back();
      } else if (sec == "ENTITIES") {
        ents.emplace_back();
        cur = &ents.back();
      } else {
        enTete = Entite();
        cur = &enTete;
      }
      cur->t = t;
      continue;
    }
    if (!cur) continue;
    if (cur->t == "BLOCK" && aBlk && cur == &enTete) {
      if (c == 2) blk.name = Entite::coupe(v);
      else if (c == 10) blk.bx = Entite::nombre(v);
      else if (c == 20) blk.by = Entite::nombre(v);
      continue;
    }
    cur->g.emplace_back(c, v);
  }
  static const std::map<int, double> UNITES = {{1, 25.4}, {2, 304.8}, {4, 1}, {5, 10}, {6, 1000}, {8, 1e-6}, {9, 0.0254}, {10, 914.4}, {11, 1e-7}, {12, 1e-6}, {13, 1e-3}, {14, 100}};
  const auto u = UNITES.find(static_cast<int>(units));
  const double K = u != UNITES.end() ? u->second : 1;
  L.entites(ents, Mat{K, 0, 0, K, 0, 0}, 0);
  // repère des vues : y vers le bas, centré sur l'encombrement
  const double inf = std::numeric_limits<double>::infinity();
  double x0 = inf, y0 = inf, x1 = -inf, y1 = -inf;
  const auto bb = [&](double x, double y) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  for (const Sortie& e : L.out) {
    if (e.t == 'L') {
      bb(e.x1, e.y1), bb(e.x2, e.y2);
    } else if (e.t == 'C') {
      bb(e.cx - e.r, e.cy - e.r), bb(e.cx + e.r, e.cy + e.r);
    } else if (e.t == 'A') {
      for (int q = 0; q <= 32; q++) {
        const double a = e.s + (e.e - e.s) * q / 32;
        bb(e.cx + e.r * std::cos(a), e.cy + e.r * std::sin(a));
      }
    } else {
      for (const Pt& p : e.pts) bb(p[0], p[1]);
    }
  }
  if (L.out.empty()) x0 = y0 = x1 = y1 = 0;
  const double mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const auto R = [](double v) { return js::arrondi(v, 6); };
  J els = J::array();
  for (const Sortie& e : L.out) {
    if (e.t == 'L') {
      els.push_back({{"t", "L"}, {"x1", R(e.x1 - mx)}, {"y1", R(my - e.y1)}, {"x2", R(e.x2 - mx)}, {"y2", R(my - e.y2)}, {"k", e.k}});
    } else if (e.t == 'C') {
      els.push_back({{"t", "C"}, {"cx", R(e.cx - mx)}, {"cy", R(my - e.cy)}, {"r", R(e.r)}, {"k", e.k}});
    } else if (e.t == 'A') {
      els.push_back({{"t", "A"}, {"cx", R(e.cx - mx)}, {"cy", R(my - e.cy)}, {"r", R(e.r)}, {"a0", R(-e.s)}, {"a1", R(-e.e)}, {"k", e.k}});
    } else {
      J pts = J::array();
      for (const Pt& p : e.pts) pts.push_back(J::array({R(p[0] - mx), R(my - p[1])}));
      els.push_back({{"t", "P"}, {"pts", std::move(pts)}, {"k", e.k}});
    }
  }
  const auto Q = [&](const Pt& p) { return J::array({R(p[0] - mx), R(my - p[1])}); };
  J dims = J::array();
  for (const CoteDxf& d : L.dims) {
    if (d.kind == "lin") dims.push_back({{"kind", "lin"}, {"orient", d.orient}, {"a", Q(d.a)}, {"b", Q(d.b)}, {"p", Q(d.p)}});
    else dims.push_back({{"kind", d.kind}, {"c", Q(d.c)}, {"r", R(d.r)}, {"t", Q(d.tx)}});
  }
  J r = J::object();
  r["els"] = std::move(els);
  r["dims"] = std::move(dims);
  r["units"] = K;
  r["n"] = r["els"].size();
  r["skipped"] = std::move(L.skipped);
  r["bbox"] = {{"w", R(x1 - x0)}, {"h", R(y1 - y0)}};
  r["origin"] = {{"x", R(mx)}, {"y", R(my)}};
  return r;
}
}  // namespace plan
