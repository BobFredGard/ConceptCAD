// La mise en plan : traits d'axe et cotes (src/98-mep-70-cotes.js, 98-mep-71-oblong.js, 98-mep-80-souris.js, 98-mep-86-accrochages.js).
#include <windows.h>

#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRep_Tool.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <gp_Circ.hxx>
#include <gp_Cone.hxx>
#include <gp_Cylinder.hxx>
#include <gp_Torus.hxx>

#include <algorithm>
#include <functional>
#include <map>
#include <optional>
#include <regex>

#include "iso286.h"
#include "plan_interne.h"

namespace plan {
namespace {
J& jvide() {
  static J n;
  n = nullptr;
  return n;
}
J* vueJ(J& sh, const std::string& id) {
  if (!sh.contains("views") || !sh["views"].is_array()) return nullptr;
  for (J& v : sh["views"])
    if (chaine(v, "id") == id) return &v;
  return nullptr;
}
const Geo& geoDe(Ctx& c, const J& v) { return c.calc.geoDe(v, c.sh, c.mep, c.piece); }
double hyp(double a, double b) { return std::hypot(a, b); }
bool perspOuOblique(const J& v) { return chaine(v, "kind") == "base" && !vrai(v, "section") && !vrai(v, "detail") && (vrai(v, "obl") || vrai(v, "persp")); }

// La largeur d'un texte en Arial gras, comme la police « sans-serif » de la cote affichée
double largeur(const std::string& s, double fs, bool gras = true) {
  if (s.empty()) return 0;
  static const int CORPS = 2048;  // l'unité du dessin de la police : les chasses sont exactes
  static HDC dc = CreateCompatibleDC(nullptr);
  static HFONT policeGrasse = CreateFontW(-CORPS, 0, 0, 0, FW_BOLD, 0, 0, 0, DEFAULT_CHARSET, OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS, ANTIALIASED_QUALITY, DEFAULT_PITCH, L"Arial");
  static HFONT policeMaigre = CreateFontW(-CORPS, 0, 0, 0, FW_NORMAL, 0, 0, 0, DEFAULT_CHARSET, OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS, ANTIALIASED_QUALITY, DEFAULT_PITCH, L"Arial");
  SelectObject(dc, gras ? policeGrasse : policeMaigre);
  const int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);
  std::wstring w(static_cast<size_t>(n), L' ');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), w.data(), n);
  // « ↧ » n'existe pas en Arial : Chrome le prend dans une police de secours
  double em = 0;
  std::wstring sans;
  for (wchar_t ch : w) {
    if (ch == 0x21A7) em += 0.48812;
    else sans += ch;
  }
  if (sans.empty()) return em * fs;
  // Avec le crénage, comme Chrome (« Te » est plus serré que T + e)
  GCP_RESULTSW r{};
  r.lStructSize = sizeof(r);
  r.nGlyphs = static_cast<UINT>(sans.size());
  const DWORD rep = GetCharacterPlacementW(dc, sans.data(), static_cast<int>(sans.size()), 0, &r, GCP_USEKERNING);
  double unites = LOWORD(rep);
  if (rep == 0) {
    SIZE q{};
    GetTextExtentPoint32W(dc, sans.data(), static_cast<int>(sans.size()), &q);
    unites = q.cx;
  }
  return (em + unites / CORPS) * fs;
}
double mesureTexte(const std::string& s, double fs) {  // mepTxtW
  const double w = largeur(s, fs);
  return w > 0 ? w : longueurCar(s) * fs * 0.6;
}

// ── les perçages ──
std::string etiquetteFilet(const Trou& f) {  // holeThreadLabel
  if (f.taille.empty()) return "";
  return f.taille + (f.aPasDifferent ? "×" + tx(f.pas) : std::string()) + (f.lh ? "-LH" : "");
}
std::optional<double> distPlan(bool a, const V3& p, const V3& n, const V3& P, const V3& D) {  // holePlaneDist
  if (!a) return std::nullopt;
  const double dn = dot(D, n);
  if (std::abs(dn) < 1e-6) return std::nullopt;
  const double t = dot(moins(p, P), n) / dn;
  if (t > 0.01) return t;
  return std::nullopt;
}
std::string texteTrou(const Trou& f, int dp) {  // mepHoleFeatureText
  const auto fr = [&](double v) { return fmtNum(v, dp); };
  const V3* P = f.pts.empty() ? nullptr : &f.pts[0].p;
  const auto holeDepth = [&]() -> std::string {
    if (f.end == "through" || f.end == "next") return "déb.";
    if (f.end == "upto") {
      if (P)
        if (auto t = distPlan(f.aPlan, f.planP, f.planN, *P, f.dir)) return "↧" + fr(*t);
      return "↧ face";
    }
    return "↧" + fr(f.depth);
  };
  const auto threadDepth = [&]() -> std::string {
    const std::string m = f.lenMode.empty() ? "len" : f.lenMode;
    const double eff = f.longueurFilet != 0 ? f.longueurFilet : f.lenFilet;
    if (m == "through" || m == "next") return "déb.";
    if (m == "upto") {
      if (P)
        if (auto t = distPlan(f.aPlanFilet, f.planFiletP, f.planFiletN, *P, f.dir)) return "↧" + fr(*t);
      return "↧ face";
    }
    return "↧" + fr(eff != 0 ? eff : f.depth);
  };
  std::vector<std::string> L;
  if (f.kind == "ream") {
    if (f.pilot == "open") return "Ø" + fr(f.cbD) + " déb.";
    L.push_back("Ø" + fr(f.cbD) + " ↧" + fr(f.cbH));
    if (f.pilot != "none") L.push_back("Ø" + fr(f.d) + " " + holeDepth());
  } else {
    if (f.kind == "step") L.push_back("Ø" + fr(f.stD) + " ↧" + fr(f.stH));
    if (!f.taille.empty()) {
      L.push_back(etiquetteFilet(f) + " " + threadDepth());
      L.push_back("Ø" + fr(f.d) + " " + holeDepth());
    } else {
      L.push_back("Ø" + fr(f.d) + " " + holeDepth());
    }
    if (f.kind == "cbore") L.push_back("Lamage Ø" + fr(f.cbD) + " ↧" + fr(f.cbH));
    if (f.kind == "csink") L.push_back("Fraisure Ø" + fr(f.csD) + " x " + fr(f.csA) + "°");
  }
  std::string o;
  for (size_t i = 0; i < L.size(); i++) o += (i ? "\n" : "") + L[i];
  return o;
}
const Trou* trouDe(Ctx& c, const std::string& fid) {
  for (const Trou& t : c.piece.trous)
    if (t.fid == fid) return &t;
  return nullptr;
}
std::string familleTrou(Ctx& c, const Trou& f) {  // mepHoleFam
  return !f.repetition.empty() ? "rp:" + f.repetition + "|" + texteTrou(f, c.st.prec) : f.fid;
}
struct TrouTrouve {
  const Trou* f = nullptr;
  const PointTrou* P = nullptr;
  double score = 0;
};
std::vector<double> rayonsAu(const Trou& f, bool tousFilets) {
  std::vector<double> rs{f.d / 2};
  if (f.kind == "ream") rs.push_back(f.cbD / 2);
  if (f.kind == "cbore") rs.push_back(f.cbD / 2);
  if (f.kind == "step") rs.push_back(f.stD / 2);
  if (f.kind == "csink") rs.push_back(f.csD / 2);
  if (f.aFiletIso && (tousFilets || f.modele)) {
    rs.push_back(f.thD / 2);
    if (!tousFilets) rs.push_back(f.thD1 / 2 + f.thC);
  }
  return rs;
}
std::optional<TrouTrouve> trouAuCercle(Ctx& c, const J& v, const Ent& e) {  // mepHoleAt
  if (e.t != 'C' && e.t != 'A') return std::nullopt;
  const Base b = baseDe(v);
  std::optional<TrouTrouve> best;
  for (const Trou& f : c.piece.trous) {
    if (!f.visible || f.pts.empty()) continue;
    if (std::abs(dot(f.dir, b.dir)) < 0.999) continue;
    const std::vector<double> rs = rayonsAu(f, false);
    const double rTol = std::max(0.18, e.r * 0.03);
    bool ok = false;
    for (double r : rs)
      if (std::abs(e.r - r) <= rTol) ok = true;
    if (!ok) continue;
    for (const PointTrou& P : f.pts) {
      const double lx = dot(P.p, b.u), ly = dot(P.p, b.v);
      const double dc = hyp(lx - e.cx, ly - e.cy);
      if (dc > 0.4) continue;
      double dr = 1e300;
      for (double r : rs) dr = std::min(dr, std::abs(e.r - r));
      const double score = dc + dr * 0.5;
      if (!best || score < best->score) best = TrouTrouve{&f, &P, score};
    }
  }
  return best;
}
int nombreDeTrous(Ctx& c, const J& v, const std::string& fam) {  // mepHoleCount
  const std::string k = chaine(v, "id") + "|" + fam;
  if (auto it = c.nbTrous.find(k); it != c.nbTrous.end()) return it->second;
  std::set<std::string> pts;
  for (const Ent& e : geoDe(c, v).els) {
    const auto m = trouAuCercle(c, v, e);
    if (m && familleTrou(c, *m->f) == fam) pts.insert(js::fixe(m->P->p[0], 3) + "," + js::fixe(m->P->p[1], 3) + "," + js::fixe(m->P->p[2], 3));
  }
  c.nbTrous[k] = static_cast<int>(pts.size());
  return static_cast<int>(pts.size());
}
int totalFamille(Ctx& c, const std::string& fam) {  // mepHoleFamTotal
  int n = 0;
  for (const Trou& f : c.piece.trous)
    if (f.visible && familleTrou(c, f) == fam) n += static_cast<int>(f.pts.size());
  return n;
}

// ── oblongs (98-mep-71-oblong.js) ──
struct Oblong {
  double x1 = 0, y1 = 0, x2 = 0, y2 = 0, r = 0, d = 0;
  std::vector<int> ia, ib, il;
};
const int NB_CASES = 72;
struct GroupeArc {
  double cx = 0, cy = 0, r = 0;
  std::vector<int> idx;
  std::set<int> cases;
};
std::vector<GroupeArc> groupesArcs(const std::vector<Ent>& els) {
  std::vector<GroupeArc> g;
  std::map<std::string, size_t> rang;
  const double st = 2 * PI / NB_CASES;
  for (int i = 0; i < static_cast<int>(els.size()); i++) {
    const Ent& e = els[i];
    if (e.t != 'A' || e.k == "thread" || e.k == "threadH" || !(e.r > 1e-6)) continue;
    const std::string key = js::fixe(e.cx, 3) + "," + js::fixe(e.cy, 3) + "," + js::fixe(e.r, 3);
    auto it = rang.find(key);
    if (it == rang.end()) {
      it = rang.emplace(key, g.size()).first;
      g.emplace_back();
      g.back().cx = e.cx, g.back().cy = e.cy, g.back().r = e.r;
    }
    GroupeArc& q = g[it->second];
    q.idx.push_back(i);
    const double lo = std::min(e.a0, e.a1), hi = std::max(e.a0, e.a1);
    for (double a = lo + st / 2; a < hi; a += st) {
      const long long f = static_cast<long long>(std::floor(a / st));
      q.cases.insert(static_cast<int>(((f % NB_CASES) + NB_CASES) % NB_CASES));
    }
  }
  std::vector<GroupeArc> r;
  for (GroupeArc& q : g)
    if (static_cast<int>(q.cases.size()) >= NB_CASES / 2 - 3 && static_cast<int>(q.cases.size()) <= NB_CASES / 2 + 1) r.push_back(std::move(q));
  return r;
}
bool arcVersExterieur(const GroupeArc& g, double ux, double uy) {
  const double st = 2 * PI / NB_CASES;
  for (int b : g.cases) {
    const double a = (b + 0.5) * st;
    if (std::cos(a) * ux + std::sin(a) * uy > 0.15) return false;
  }
  return true;
}
void cotesOblong(const std::vector<Ent>& els, const GroupeArc& A, double ux, double uy, double d, double off, double tol, double& cov, std::vector<int>& idx) {
  std::vector<std::array<double, 2>> iv;
  const double nx = -uy, ny = ux;
  for (int i = 0; i < static_cast<int>(els.size()); i++) {
    const Ent& e = els[i];
    if (e.t != 'L' || e.k == "thread" || e.k == "threadH") continue;
    const double o1 = (e.x1 - A.cx) * nx + (e.y1 - A.cy) * ny, o2 = (e.x2 - A.cx) * nx + (e.y2 - A.cy) * ny;
    if (std::abs(o1 - off) > tol || std::abs(o2 - off) > tol) continue;
    const double t1 = (e.x1 - A.cx) * ux + (e.y1 - A.cy) * uy, t2 = (e.x2 - A.cx) * ux + (e.y2 - A.cy) * uy;
    if (std::min(t1, t2) < -tol || std::max(t1, t2) > d + tol) continue;
    iv.push_back({std::min(t1, t2), std::max(t1, t2)});
    idx.push_back(i);
  }
  std::stable_sort(iv.begin(), iv.end(), [](const auto& p, const auto& q) { return p[0] < q[0]; });
  cov = 0;
  double end = -1e300;
  for (const auto& q : iv)
    if (q[1] > end) {
      cov += q[1] - std::max(q[0], end);
      end = q[1];
    }
}
const std::vector<Oblong>& oblongsDe(Ctx& c, const J& v) {  // mepSlotsOf
  static const std::vector<Oblong> aucun;
  if (perspOuOblique(v)) return aucun;
  const std::string vid = chaine(v, "id");
  if (auto it = c.oblongs.find(vid); it != c.oblongs.end()) return *std::static_pointer_cast<std::vector<Oblong>>(it->second);
  const std::vector<Ent>& els = geoDe(c, v).els;
  const std::vector<GroupeArc> arcs = groupesArcs(els);
  std::vector<Oblong> cand;
  for (size_t i = 0; i < arcs.size(); i++)
    for (size_t j = i + 1; j < arcs.size(); j++) {
      const GroupeArc& A = arcs[i];
      const GroupeArc& B = arcs[j];
      const double tol = std::max(0.01, A.r * 0.002);
      if (std::abs(A.r - B.r) > tol) continue;
      const double dx = B.cx - A.cx, dy = B.cy - A.cy, d = hyp(dx, dy);
      if (!(d > tol)) continue;
      const double ux = dx / d, uy = dy / d;
      if (!arcVersExterieur(A, ux, uy) || !arcVersExterieur(B, -ux, -uy)) continue;
      double c1, c2;
      std::vector<int> i1, i2;
      cotesOblong(els, A, ux, uy, d, A.r, tol, c1, i1);
      cotesOblong(els, A, ux, uy, d, -A.r, tol, c2, i2);
      if (c1 < 0.9 * d || c2 < 0.9 * d) continue;
      Oblong o;
      o.x1 = A.cx, o.y1 = A.cy, o.x2 = B.cx, o.y2 = B.cy, o.r = A.r, o.d = d, o.ia = A.idx, o.ib = B.idx;
      o.il = i1;
      o.il.insert(o.il.end(), i2.begin(), i2.end());
      cand.push_back(std::move(o));
    }
  std::stable_sort(cand.begin(), cand.end(), [](const Oblong& a, const Oblong& b) { return a.d < b.d; });
  std::set<int> used;
  auto L = std::make_shared<std::vector<Oblong>>();
  for (Oblong& o : cand) {
    bool pris = false;
    for (int i : o.ia)
      if (used.count(i)) pris = true;
    for (int i : o.ib)
      if (used.count(i)) pris = true;
    if (pris) continue;
    used.insert(o.ia.begin(), o.ia.end());
    used.insert(o.ib.begin(), o.ib.end());
    L->push_back(std::move(o));
  }
  c.oblongs[vid] = L;
  return *L;
}
bool memesCentres(double ax1, double ay1, double ax2, double ay2, double bx1, double by1, double bx2, double by2, double t) {
  const auto n = [&](double x, double y) { return std::abs(x - y) <= t; };
  return (n(ax1, bx1) && n(ay1, by1) && n(ax2, bx2) && n(ay2, by2)) || (n(ax1, bx2) && n(ay1, by2) && n(ax2, bx1) && n(ay2, by1));
}
// mepSlotFollow : le mémo {x1,y1,x2,y2,r} suit l'oblong retrouvé
void suivreOblong(Ctx& c, const J& v, J& m) {
  const double mx1 = num(m, "x1"), my1 = num(m, "y1"), mx2 = num(m, "x2"), my2 = num(m, "y2"), mr = num(m, "r");
  const double L0 = hyp(mx2 - mx1, my2 - my1), u0x = L0 > 1e-9 ? (mx2 - mx1) / L0 : 1, u0y = L0 > 1e-9 ? (my2 - my1) / L0 : 0;
  const Oblong* best = nullptr;
  double bc = 1e300;
  for (const Oblong& s : oblongsDe(c, v)) {
    const double sx = (s.x2 - s.x1) / s.d, sy = (s.y2 - s.y1) / s.d;
    const double k = hyp((s.x1 + s.x2 - mx1 - mx2) / 2, (s.y1 + s.y2 - my1 - my2) / 2) + 0.5 * std::abs(s.d - L0) + std::abs(s.r - mr) + 0.5 * L0 * std::abs(u0x * sy - u0y * sx);
    if (k < bc) bc = k, best = &s;
  }
  if (!best || bc > std::max({3.0, 2 * mr, L0})) return;
  const bool sw = (best->x2 - best->x1) * u0x + (best->y2 - best->y1) * u0y < 0;
  m["x1"] = sw ? best->x2 : best->x1, m["y1"] = sw ? best->y2 : best->y1, m["x2"] = sw ? best->x1 : best->x2, m["y2"] = sw ? best->y1 : best->y2, m["r"] = best->r;
}
std::vector<Prim> traitsOblong(double x1, double y1, double x2, double y2, double r, double echelle) {  // mepSlotPrims
  const double dx = x2 - x1, dy = y2 - y1, L = hyp(dx, dy);
  if (!(L > 1e-9)) return {};
  const double ux = dx / L, uy = dy / L, E = r + 3 / echelle;
  const auto trait = [](double a, double b, double e, double f, const char* cls) {
    Prim p;
    p.x1 = a, p.y1 = b, p.x2 = e, p.y2 = f, p.cls = cls;
    return p;
  };
  return {trait(x1 - ux * E, y1 - uy * E, x2 + ux * E, y2 + uy * E, "mepAxis"), trait(x1 + uy * E, y1 - ux * E, x1 - uy * E, y1 + ux * E, "mepAxisCross"), trait(x2 + uy * E, y2 - ux * E, x2 - uy * E, y2 + ux * E, "mepAxisCross")};
}

// ── les axes ──
const double AX_DEPASSE = 3, AX_TOL = 0.2;
const int AX_ALIGN = 3, AX_PITCH = 3;
double echelleAxe(const J& v) { return std::max(1e-9, num(v, "scale") > 0 ? num(v, "scale") : 1); }
Prim traitL(double a, double b, double e, double f, const char* cls) {
  Prim p;
  p.x1 = a, p.y1 = b, p.x2 = e, p.y2 = f, p.cls = cls;
  return p;
}
std::vector<Prim> croixAxe(double x, double y, double r, const J& v, const char* cls = "mepAxisCross") {  // mepAxisCrossPrims
  const double over = AX_DEPASSE / echelleAxe(v), L = std::max(r + over, 1.5 / echelleAxe(v));
  return {traitL(x - L, y, x + L, y, cls), traitL(x, y - L, x, y + L, cls)};
}
struct TrouVu {  // mepAxisHoleOfFeature
  const Trou* f = nullptr;
  std::string fid, pid;
  double x = 0, y = 0, r = 0;
  bool aRev = false;
  RevAxe rev;
};
TrouVu trouVu(const Trou& f, const PointTrou& P, const Base& b) {
  TrouVu h;
  h.f = &f, h.fid = f.fid, h.pid = P.id;
  h.x = dot(P.p, b.u), h.y = dot(P.p, b.v);
  h.r = std::max({f.d / 2, f.kind == "cbore" ? f.cbD / 2 : 0, f.kind == "csink" ? f.csD / 2 : 0, f.kind == "step" ? f.stD / 2 : 0});
  return h;
}
template <class T>
bool memeDia(const T& a, const T& b) {
  const double tol = std::max(0.05, std::max(a.r, b.r) * 0.05);
  return std::abs(a.r - b.r) <= tol;
}
bool cercle3(const TrouVu& a, const TrouVu& b, const TrouVu& c, double& cx, double& cy, double& r) {  // mepAxisCircle3
  const double d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (std::abs(d) < 1e-9) return false;
  const double a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
  cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  r = hyp(a.x - cx, a.y - cy);
  return r > 0.05;
}
bool ajusterCercle(const std::vector<TrouVu>& hs, double& cx, double& cy, double& r) {  // mepAxisFitCircle
  if (hs.size() < 3) return false;
  double n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sx3 = 0, sy3 = 0, s2 = 0;
  for (const TrouVu& p : hs) {
    const double x = p.x, y = p.y;
    n++, sx += x, sy += y, sxx += x * x, syy += y * y, sxy += x * y;
    sx3 += x * (x * x + y * y), sy3 += y * (x * x + y * y), s2 += x * x + y * y;
  }
  const auto det = [](const double a[3][3]) { return a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]); };
  const double m[3][3] = {{sxx, sxy, sx}, {sxy, syy, sy}, {sx, sy, n}};
  const double D = det(m);
  if (std::abs(D) < 1e-9) return false;
  const double b[3] = {-sx3, -sy3, -s2};
  const auto col = [&](int i) {
    double q[3][3];
    for (int r0 = 0; r0 < 3; r0++)
      for (int c0 = 0; c0 < 3; c0++) q[r0][c0] = c0 == i ? b[r0] : m[r0][c0];
    return det(q);
  };
  const double A = col(0) / D, B = col(1) / D, C = col(2) / D;
  cx = -A / 2, cy = -B / 2;
  const double r2 = cx * cx + cy * cy - C;
  if (!(r2 > 1e-9)) return false;
  r = std::sqrt(r2);
  return true;
}
bool espacementRegulier(const std::vector<TrouVu>& hs, double cx, double cy) {  // mepAxisEqualSpacing
  const size_t n = hs.size();
  if (n < 3) return false;
  std::vector<double> a;
  for (const TrouVu& h : hs) a.push_back(std::atan2(h.y - cy, h.x - cx));
  std::sort(a.begin(), a.end());
  const double ideal = 2 * PI / n;
  for (size_t i = 0; i < n; i++) {
    double g = a[(i + 1) % n] - a[i];
    if (i == n - 1) g += 2 * PI;
    if (std::abs(g - ideal) > std::max(0.12 * ideal, 0.08)) return false;
  }
  return true;
}
std::string cleAxe(const TrouVu& h) { return h.fid + "|" + h.pid; }
struct GroupePas {
  double cx = 0, cy = 0, r = 0;
  std::vector<TrouVu> pts;
};
std::vector<GroupePas> groupesPas(const std::vector<TrouVu>& hs, const J& v) {  // mepAxisPitchGroups
  std::vector<GroupePas> cand, out;
  if (hs.size() < 3) return out;
  const double tol = std::max(0.05, AX_TOL / echelleAxe(v));
  for (size_t i = 0; i < hs.size(); i++)
    for (size_t j = i + 1; j < hs.size(); j++)
      for (size_t k = j + 1; k < hs.size(); k++) {
        if (!memeDia(hs[i], hs[j]) || !memeDia(hs[i], hs[k])) continue;
        GroupePas g;
        if (!cercle3(hs[i], hs[j], hs[k], g.cx, g.cy, g.r)) continue;
        for (const TrouVu& h : hs)
          if (memeDia(h, hs[i]) && std::abs(hyp(h.x - g.cx, h.y - g.cy) - g.r) <= tol) g.pts.push_back(h);
        if (static_cast<int>(g.pts.size()) < AX_PITCH || !espacementRegulier(g.pts, g.cx, g.cy)) continue;
        cand.push_back(std::move(g));
      }
  std::stable_sort(cand.begin(), cand.end(), [](const GroupePas& a, const GroupePas& b) { return a.pts.size() != b.pts.size() ? a.pts.size() > b.pts.size() : a.r < b.r; });
  std::set<std::string> used;
  for (GroupePas& g : cand) {
    bool pris = false;
    for (const TrouVu& h : g.pts)
      if (used.count(cleAxe(h))) pris = true;
    if (pris) continue;
    for (const TrouVu& h : g.pts) used.insert(cleAxe(h));
    out.push_back(std::move(g));
  }
  return out;
}
std::vector<std::vector<TrouVu>> groupesAlignes(const std::vector<TrouVu>& hs, const J& v) {  // mepAxisLineGroups
  std::vector<std::vector<TrouVu>> cand, out;
  if (static_cast<int>(hs.size()) < AX_ALIGN) return out;
  const double tol = std::max(0.05, AX_TOL / echelleAxe(v));
  for (size_t i = 0; i < hs.size(); i++)
    for (size_t j = i + 1; j < hs.size(); j++) {
      const double dx = hs[j].x - hs[i].x, dy = hs[j].y - hs[i].y, L = hyp(dx, dy);
      if (L < 1e-9) continue;
      const double ux = dx / L, uy = dy / L;
      std::vector<TrouVu> pts;
      for (const TrouVu& h : hs)
        if (std::abs((h.x - hs[i].x) * uy - (h.y - hs[i].y) * ux) <= tol) pts.push_back(h);
      if (static_cast<int>(pts.size()) >= AX_ALIGN) cand.push_back(std::move(pts));
    }
  std::stable_sort(cand.begin(), cand.end(), [](const auto& a, const auto& b) { return a.size() > b.size(); });
  std::set<std::string> used;
  for (auto& g : cand) {
    bool pris = false;
    for (const TrouVu& h : g)
      if (used.count(cleAxe(h))) pris = true;
    if (pris) continue;
    for (const TrouVu& h : g) used.insert(cleAxe(h));
    out.push_back(std::move(g));
  }
  return out;
}
std::vector<Prim> traitsPas(double cx, double cy, double r, const std::vector<TrouVu>& hs, const J& v) {  // mepAxisPitchPrims
  std::vector<Prim> out;
  Prim c0;
  c0.t = 'C', c0.cx = cx, c0.cy = cy, c0.r = r, c0.cls = "mepAxis";
  out.push_back(c0);
  const double over = AX_DEPASSE / echelleAxe(v);
  for (const TrouVu& h : hs) {
    const double dx = h.x - cx, dy = h.y - cy;
    double L = hyp(dx, dy);
    if (L == 0) L = 1;
    const double end = r + h.r + over;
    out.push_back(traitL(cx, cy, cx + dx / L * end, cy + dy / L * end, "mepAxis"));
  }
  const double L = 6 / echelleAxe(v);
  out.push_back(traitL(cx - L, cy, cx + L, cy, "mepAxis"));
  out.push_back(traitL(cx, cy - L, cx, cy + L, "mepAxis"));
  return out;
}
std::vector<Prim> traitsAlignes(const std::vector<TrouVu>& hs, const J& v, bool marques) {  // mepAxisAlignPrims
  if (hs.size() < 2) return {};
  const TrouVu* A = &hs[0];
  const TrouVu* B = &hs.back();
  double best = -1;
  for (size_t i = 0; i < hs.size(); i++)
    for (size_t j = i + 1; j < hs.size(); j++) {
      const double d = std::pow(hs[i].x - hs[j].x, 2) + std::pow(hs[i].y - hs[j].y, 2);
      if (d > best) best = d, A = &hs[i], B = &hs[j];
    }
  const double dx = B->x - A->x, dy = B->y - A->y, L = hyp(dx, dy);
  if (L < 1e-9) return {};
  const double ux = dx / L, uy = dy / L, over = AX_DEPASSE / echelleAxe(v);
  double t0 = 1e300, t1 = -1e300;
  for (const TrouVu& h : hs) {
    const double t = (h.x - A->x) * ux + (h.y - A->y) * uy;
    t0 = std::min(t0, t), t1 = std::max(t1, t);
  }
  t0 -= over, t1 += over;
  std::vector<Prim> out{traitL(A->x + ux * t0, A->y + uy * t0, A->x + ux * t1, A->y + uy * t1, "mepAxis")};
  if (marques)
    for (const TrouVu& h : hs) {
      const auto c = croixAxe(h.x, h.y, h.r, v);
      out.insert(out.end(), c.begin(), c.end());
    }
  return out;
}

// Les axes de révolution d'un solide (mepShapeCyls, mepShapeRevs)
void normaliserAxe(const gp_Pnt& L, const gp_Dir& D, V3& o, V3& d) {
  d = {D.X(), D.Y(), D.Z()};
  double sgn = std::abs(d[0]) > 1e-6 ? (d[0] > 0 ? 1 : -1) : (std::abs(d[1]) > 1e-6 ? (d[1] > 0 ? 1 : -1) : (d[2] < 0 ? -1 : 1));
  if (sgn < 0) d = {-d[0], -d[1], -d[2]};
  const V3 l{L.X(), L.Y(), L.Z()};
  const double ld = dot(l, d);
  o = {l[0] - d[0] * ld, l[1] - d[1] * ld, l[2] - d[2] * ld};
}
std::string cleAxe3D(const V3& o, const V3& d) { return js::fixe(o[0], 2) + "," + js::fixe(o[1], 2) + "," + js::fixe(o[2], 2) + "|" + js::fixe(d[0], 3) + "," + js::fixe(d[1], 3) + "," + js::fixe(d[2], 3); }
const std::vector<RevAxe>& cylindresDe(Ctx& c, const Corps& bd) {
  auto it = c.calc.cylindres.find(bd.id);
  if (it != c.calc.cylindres.end()) return it->second;
  struct G {
    V3 o, d;
    std::string axk;
    double t0, t1, r, u;
  };
  std::vector<G> groupes;
  std::map<std::string, size_t> rang;
  for (TopExp_Explorer ex(bd.forme, TopAbs_FACE); ex.More(); ex.Next()) {
    try {
      const BRepAdaptor_Surface ad(TopoDS::Face(ex.Current()), true);
      if (ad.GetType() != GeomAbs_Cylinder) continue;
      const gp_Cylinder cy = ad.Cylinder();
      V3 o, d;
      const gp_Dir D = cy.Axis().Direction();
      normaliserAxe(cy.Axis().Location(), D, o, d);
      const bool flip = dot(V3{D.X(), D.Y(), D.Z()}, d) < 0;
      const gp_Pnt Lp = cy.Axis().Location();
      const double ld = dot(V3{Lp.X(), Lp.Y(), Lp.Z()}, d);
      const double v0 = ad.FirstVParameter(), v1 = ad.LastVParameter();
      const double t0 = ld + (flip ? -v1 : v0), t1 = ld + (flip ? -v0 : v1);
      const std::string axk = cleAxe3D(o, d), key = axk + "|" + js::fixe(cy.Radius(), 2);
      auto q = rang.find(key);
      if (q == rang.end()) {
        q = rang.emplace(key, groupes.size()).first;
        groupes.push_back({o, d, axk, std::min(t0, t1), std::max(t0, t1), 0, 0});
      }
      G& g = groupes[q->second];
      g.t0 = std::min({g.t0, t0, t1}), g.t1 = std::max({g.t1, t0, t1});
      g.r = std::max(g.r, cy.Radius());
      g.u += std::abs(ad.LastUParameter() - ad.FirstUParameter());
    } catch (const Standard_Failure&) {
    }
  }
  std::vector<RevAxe> list;
  std::map<std::string, size_t> parAxe;
  for (const G& g : groupes) {
    if (!(g.u >= PI * 0.95 && g.t1 - g.t0 > 1e-3)) continue;
    auto a = parAxe.find(g.axk);
    if (a == parAxe.end()) {
      parAxe.emplace(g.axk, list.size());
      RevAxe r;
      r.o = g.o, r.d = g.d, r.t0 = g.t0, r.t1 = g.t1, r.r = g.r, r.u = g.u, r.rs = {g.r};
      list.push_back(r);
    } else {
      RevAxe& r = list[a->second];
      r.t0 = std::min(r.t0, g.t0), r.t1 = std::max(r.t1, g.t1), r.r = std::max(r.r, g.r);
      r.rs.push_back(g.r);
    }
  }
  return c.calc.cylindres[bd.id] = std::move(list);
}
const std::vector<RevAxe>& revolutionsDe(Ctx& c, const Corps& bd) {
  auto it = c.calc.revolutions.find(bd.id);
  if (it != c.calc.revolutions.end()) return it->second;
  std::vector<RevAxe> list;
  std::map<std::string, size_t> parAxe;
  const auto add = [&](const V3& o, const V3& d, const std::vector<V3>& pts, double r, double u) {
    const std::string axk = cleAxe3D(o, d);
    double t0 = 1e300, t1 = -1e300, rm = r > 0 ? r : 0;
    for (const V3& p : pts) {
      const double t = dot(p, d);
      t0 = std::min(t0, t), t1 = std::max(t1, t);
      if (!(r > 0)) {
        const V3 q{p[0] - o[0] - d[0] * t, p[1] - o[1] - d[1] * t, p[2] - o[2] - d[2] * t};
        rm = std::max(rm, std::sqrt(dot(q, q)));
      }
    }
    if (!(t1 >= t0) || !(rm > 1e-3)) return;
    auto a = parAxe.find(axk);
    if (a == parAxe.end()) {
      parAxe.emplace(axk, list.size());
      RevAxe g;
      g.o = o, g.d = d, g.t0 = t0, g.t1 = t1, g.r = rm, g.u = u, g.rs = {rm};
      list.push_back(g);
      return;
    }
    RevAxe& g = list[a->second];
    g.t0 = std::min(g.t0, t0), g.t1 = std::max(g.t1, t1), g.r = std::max(g.r, rm), g.u = std::max(g.u, u);
    if (std::none_of(g.rs.begin(), g.rs.end(), [&](double x) { return std::abs(x - rm) < 0.01; })) g.rs.push_back(rm);
  };
  std::vector<TopoDS_Shape> coutures;
  const auto pointsFace = [&](const TopoDS_Face& f) {
    std::vector<V3> pts;
    for (TopExp_Explorer e(f, TopAbs_EDGE); e.More(); e.Next()) {
      try {
        const TopoDS_Edge ar = TopoDS::Edge(e.Current());
        if (BRep_Tool::IsClosed(ar, f)) coutures.push_back(ar);
        const BRepAdaptor_Curve ad(ar);
        const double u0 = ad.FirstParameter(), u1 = ad.LastParameter();
        if (u1 > u0) {
          const auto q = pointsDeCourbe(ad, u0, u1, 0.05, 64);
          pts.insert(pts.end(), q.begin(), q.end());
        }
      } catch (const Standard_Failure&) {
      }
    }
    return pts;
  };
  for (TopExp_Explorer ex(bd.forme, TopAbs_FACE); ex.More(); ex.Next()) {
    try {
      const TopoDS_Face f = TopoDS::Face(ex.Current());
      const BRepAdaptor_Surface ad(f, true);
      const GeomAbs_SurfaceType ty = ad.GetType();
      bool aAxe = false;
      gp_Ax1 ax;
      double r = 0;
      if (ty == GeomAbs_Cylinder) {
        const gp_Cylinder cy = ad.Cylinder();
        ax = cy.Axis(), r = cy.Radius(), aAxe = true;
      } else if (ty == GeomAbs_Cone) {
        ax = ad.Cone().Axis(), aAxe = true;
      } else if (ty == GeomAbs_Torus) {
        ax = ad.Torus().Axis(), aAxe = true;
      } else if (ty == GeomAbs_SurfaceOfRevolution) {
        ax = ad.AxeOfRevolution(), aAxe = true;
      } else if (ty == GeomAbs_Sphere) {
        pointsFace(f);
      }
      if (aAxe) {
        V3 o, d;
        normaliserAxe(ax.Location(), ax.Direction(), o, d);
        const std::vector<V3> pts = pointsFace(f);
        add(o, d, pts, r, std::abs(ad.LastUParameter() - ad.FirstUParameter()));
      }
    } catch (const Standard_Failure&) {
    }
  }
  for (TopExp_Explorer ex(bd.forme, TopAbs_EDGE); ex.More(); ex.Next()) {
    try {
      const TopoDS_Edge e = TopoDS::Edge(ex.Current());
      const BRepAdaptor_Curve ad(e);
      if (ad.GetType() != GeomAbs_Circle) continue;
      if (std::any_of(coutures.begin(), coutures.end(), [&](const TopoDS_Shape& q) { return q.IsSame(e); })) continue;
      const gp_Circ ci = ad.Circle();
      V3 o, d;
      normaliserAxe(ci.Axis().Location(), ci.Axis().Direction(), o, d);
      const gp_Pnt L = ci.Axis().Location();
      add(o, d, {V3{L.X(), L.Y(), L.Z()}}, ci.Radius(), std::abs(ad.LastParameter() - ad.FirstParameter()));
    } catch (const Standard_Failure&) {
    }
  }
  return c.calc.revolutions[bd.id] = std::move(list);
}
std::vector<const Corps*> corpsDeVue(Ctx& c, const J& v) {  // mepMeshesOf
  std::vector<const Corps*> o;
  const std::string b = chaine(v, "bodyId");
  for (const Corps& q : c.piece.corps)
    if (b.empty() || q.id == b) o.push_back(&q);
  return o;
}
bool memeAxe3D(const V3& ao, const V3& ad, const V3& bo, const V3& bd, double tol) {  // mepRevSameAxis
  if (std::abs(dot(ad, bd)) < 0.9995) return false;
  const V3 w = moins(bo, ao);
  const double t = dot(w, ad);
  return std::sqrt(std::pow(w[0] - ad[0] * t, 2) + std::pow(w[1] - ad[1] * t, 2) + std::pow(w[2] - ad[2] * t, 2)) <= tol;
}
std::vector<Prim> traitsRev(const V3& o, const V3& d, double t0, double t1, double r, const J& v, const Base& b, double over) {  // mepRevPrims
  const double facing = dot(d, b.dir);
  const auto P = [&](double t) { return V3{o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t}; };
  if (std::abs(facing) > 0.999) {
    const V3 c = P(t0);
    return croixAxe(dot(c, b.u), dot(c, b.v), r, v);
  }
  if (std::abs(facing) < 0.02) {
    const V3 A = P(t0), B = P(t1);
    const double ax = dot(A, b.u), ay = dot(A, b.v), bx = dot(B, b.u), by = dot(B, b.v);
    const double L = hyp(bx - ax, by - ay);
    if (L < 1e-6) return {};
    const double ux = (bx - ax) / L, uy = (by - ay) / L;
    return {traitL(ax - ux * over, ay - uy * over, bx + ux * over, by + uy * over, "mepAxis")};
  }
  return {};
}
std::vector<Prim> traitsCylindres(Ctx& c, const J& v) {  // mepAxisCylPrims
  std::vector<Prim> out;
  const Base b = baseDe(v);
  const double over = AX_DEPASSE / echelleAxe(v);
  const std::vector<Oblong>& slots = oblongsDe(c, v);
  const auto surOblong = [&](const RevAxe& g) {
    if (slots.empty() || std::abs(dot(g.d, b.dir)) <= 0.999) return false;
    const double x = dot(g.o, b.u), y = dot(g.o, b.v);
    const auto n = [&](double p, double q) { return hyp(p - x, q - y) < 0.01; };
    return std::any_of(slots.begin(), slots.end(), [&](const Oblong& s) { return n(s.x1, s.y1) || n(s.x2, s.y2); });
  };
  for (const Corps* bd : corpsDeVue(c, v)) {
    const std::vector<RevAxe>& cyl = cylindresDe(c, *bd);
    std::vector<RevAxe> L = cyl;
    for (const RevAxe& g : revolutionsDe(c, *bd))
      if (g.u >= PI * 0.95 && std::none_of(cyl.begin(), cyl.end(), [&](const RevAxe& q) { return memeAxe3D(q.o, q.d, g.o, g.d, 0.05); })) L.push_back(g);
    for (const RevAxe& g : L) {
      if (surOblong(g)) continue;
      const auto p = traitsRev(g.o, g.d, g.t0, g.t1, g.r, v, b, over);
      out.insert(out.end(), p.begin(), p.end());
    }
  }
  return out;
}
const RevAxe* suivreRev(Ctx& c, const J& v, const V3& o, const V3& d, double r) {  // mepRevTrack
  const RevAxe* best = nullptr;
  double bc = 1e300;
  for (const Corps* bd : corpsDeVue(c, v))
    for (const RevAxe& g : revolutionsDe(c, *bd)) {
      if (std::abs(dot(g.d, d)) < 0.9995) continue;
      const V3 w = moins(o, g.o);
      const double t = dot(w, g.d);
      const double off = std::sqrt(std::pow(w[0] - g.d[0] * t, 2) + std::pow(w[1] - g.d[1] * t, 2) + std::pow(w[2] - g.d[2] * t, 2));
      double dr = 1e300;
      for (double x : g.rs) dr = std::min(dr, std::abs(x - r));
      const double k = off + 0.5 * dr;
      if (k < bc) bc = k, best = &g;
    }
  return bc <= std::max(2.0, 0.6 * r) ? best : nullptr;
}
std::optional<TrouVu> axeDeReference(Ctx& c, const J& v, J& ref) {  // mepAxisRefGeom, mepAxisGeoRef
  const Base b = baseDe(v);
  if (ref.is_null()) return std::nullopt;
  if (vrai(ref, "fid")) {
    const Trou* f = trouDe(c, chaine(ref, "fid"));
    if (!f) return std::nullopt;
    const std::string pid = chaine(ref, "pid");
    for (const PointTrou& P : f->pts)
      if (P.id == pid) return trouVu(*f, P, b);
    return std::nullopt;
  }
  if (vrai(ref, "ax")) {
    J& a = ref["ax"];
    const V3 o = v3(sous(a, "o")), d = v3(sous(a, "d"));
    const double r0 = num(a, "r");
    const RevAxe* g = suivreRev(c, v, o, d, r0);
    if (g) {
      a = J{{"o", {g->o[0], g->o[1], g->o[2]}}, {"d", {g->d[0], g->d[1], g->d[2]}}, {"r", r0}, {"t0", g->t0}, {"t1", g->t1}};
    }
    const V3 Go = g ? g->o : o, Gd = g ? g->d : d;
    const double r = r0 != 0 ? r0 : (g ? g->r : 1);
    const double t0 = g ? g->t0 : num(a, "t0"), t1 = g ? g->t1 : (a.contains("t1") ? num(a, "t1") : t0);
    const V3 q{Go[0] + Gd[0] * t0, Go[1] + Gd[1] * t0, Go[2] + Gd[2] * t0};
    TrouVu h;
    h.x = dot(q, b.u), h.y = dot(q, b.v), h.r = r;
    h.aRev = true;
    h.rev.o = Go, h.rev.d = Gd, h.rev.t0 = t0, h.rev.t1 = t1, h.rev.r = r;
    return h;
  }
  if (vrai(ref, "c")) {
    J& q = ref["c"];
    const double cx = num(q, "cx"), cy = num(q, "cy"), cr = num(q, "r");
    const Ent* best = nullptr;
    double bc = 1e300;
    for (const Ent& e : geoDe(c, v).els) {
      if ((e.t != 'C' && e.t != 'A') || e.k == "thread" || e.k == "threadH") continue;
      const double k = hyp(e.cx - cx, e.cy - cy) + 0.5 * std::abs(e.r - cr);
      if (k < bc) bc = k, best = &e;
    }
    if (bc > std::max(2.0, 0.5 * cr)) best = nullptr;
    if (best) q = J{{"cx", best->cx}, {"cy", best->cy}, {"r", best->r}};
    TrouVu h;
    h.x = best ? best->cx : cx, h.y = best ? best->cy : cy, h.r = best ? best->r : cr;
    return h;
  }
  return std::nullopt;
}
// Axes de symétrie (98-mep-80-souris.js)
struct Seg {
  double x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  std::string k;
};
Seg segDe(const J& l) {
  Seg s;
  s.x1 = num(l, "x1"), s.y1 = num(l, "y1"), s.x2 = num(l, "x2"), s.y2 = num(l, "y2"), s.k = chaine(l, "k");
  return s;
}
J segVers(const Ent& e) {
  J o = J::object();
  o["x1"] = e.x1, o["y1"] = e.y1, o["x2"] = e.x2, o["y2"] = e.y2;
  if (!e.k.empty()) o["k"] = e.k;
  return o;
}
double coutSuivi(const Seg& L, const Ent& e) {  // mepAxisTrackCost
  const double dx = L.x2 - L.x1, dy = L.y2 - L.y1, len = hyp(dx, dy);
  if (!(len > 1e-9) || e.t != 'L') return 1e300;
  if (!L.k.empty() && !e.k.empty() && L.k != e.k) return 1e300;
  if (L.k.empty() && (e.k == "thread" || e.k == "threadH")) return 1e300;
  const double ex = e.x2 - e.x1, ey = e.y2 - e.y1, el = hyp(ex, ey);
  if (!(el > 1e-9)) return 1e300;
  const double ux = dx / len, uy = dy / len;
  if (std::abs(ux * ey / el - uy * ex / el) > 0.035) return 1e300;
  const double cx = (e.x1 + e.x2) / 2 - (L.x1 + L.x2) / 2, cy = (e.y1 + e.y2) / 2 - (L.y1 + L.y2) / 2;
  return std::abs(cx * uy - cy * ux) + 0.5 * std::abs(cx * ux + cy * uy) + 0.5 * std::abs(el - len);
}
const Ent* suivreTrait(const Geo& g, const Seg& L) {  // mepAxisTrackLine
  const double dx = L.x2 - L.x1, dy = L.y2 - L.y1, len = hyp(dx, dy);
  if (!(len > 1e-9)) return nullptr;
  const double ux = dx / len, uy = dy / len, mx = (L.x1 + L.x2) / 2, my = (L.y1 + L.y2) / 2;
  const Ent* best = nullptr;
  double bc = 1e300;
  for (const Ent& e : g.els) {
    if (e.t != 'L') continue;
    if (!L.k.empty() && !e.k.empty() && L.k != e.k) continue;
    const double ex = e.x2 - e.x1, ey = e.y2 - e.y1, el = hyp(ex, ey);
    if (!(el > 1e-9)) continue;
    if (std::abs(ux * ey / el - uy * ex / el) > 0.035) continue;
    const double cx = (e.x1 + e.x2) / 2 - mx, cy = (e.y1 + e.y2) / 2 - my;
    const double k = std::abs(cx * uy - cy * ux) + 0.5 * std::abs(cx * ux + cy * uy) + 0.5 * std::abs(el - len);
    if (k < bc) bc = k, best = &e;
  }
  return bc <= std::max(3.0, 0.6 * len) ? best : nullptr;
}
bool axeSym(const Seg& e1, const Seg& e2, const J& v, XY& A, XY& B) {  // mepAxisSymGeom
  const auto nrm = [](double x, double y, double& ox, double& oy) {
    const double L = hyp(x, y);
    if (!(L > 1e-12)) return false;
    ox = x / L, oy = y / L;
    return true;
  };
  double d1x, d1y, d2x, d2y;
  if (!nrm(e1.x2 - e1.x1, e1.y2 - e1.y1, d1x, d1y) || !nrm(e2.x2 - e2.x1, e2.y2 - e2.y1, d2x, d2y)) return false;
  const double over = AX_DEPASSE / echelleAxe(v), cr = d1x * d2y - d1y * d2x;
  double Ox, Oy, ux, uy;
  if (std::abs(cr) < 0.02) {
    if (d1x * d2x + d1y * d2y < 0) d2x = -d2x, d2y = -d2y;
    if (!nrm(d1x + d2x, d1y + d2y, ux, uy)) return false;
    Ox = (e1.x1 + e1.x2 + e2.x1 + e2.x2) / 4, Oy = (e1.y1 + e1.y2 + e2.y1 + e2.y2) / 4;
  } else {
    const double t = ((e2.x1 - e1.x1) * d2y - (e2.y1 - e1.y1) * d2x) / cr;
    const double X = e1.x1 + d1x * t, Y = e1.y1 + d1y * t;
    const auto vers = [&](const Seg& s, double& dx, double& dy) {
      const bool loin = hyp(s.x1 - X, s.y1 - Y) > hyp(s.x2 - X, s.y2 - Y);
      const double fx = loin ? s.x1 : s.x2, fy = loin ? s.y1 : s.y2;
      if ((fx - X) * dx + (fy - Y) * dy < 0) dx = -dx, dy = -dy;
    };
    vers(e1, d1x, d1y);
    vers(e2, d2x, d2y);
    if (!nrm(d1x + d2x, d1y + d2y, ux, uy)) return false;
    Ox = X, Oy = Y;
  }
  double t0 = 1e300, t1 = -1e300;
  for (const auto& p : {P2{e1.x1, e1.y1}, P2{e1.x2, e1.y2}, P2{e2.x1, e2.y1}, P2{e2.x2, e2.y2}}) {
    const double t = (p[0] - Ox) * ux + (p[1] - Oy) * uy;
    t0 = std::min(t0, t), t1 = std::max(t1, t);
  }
  t0 -= over, t1 += over;
  A = {Ox + ux * t0, Oy + uy * t0}, B = {Ox + ux * t1, Oy + uy * t1};
  return true;
}
void migrerSym(Ctx& c, const J& v, J& ann) {  // mepAxisSymMigrate
  const Geo& g = geoDe(c, v);
  const double ax = num(ann["a"], "x"), ay = num(ann["a"], "y"), dx = num(ann["b"], "x") - ax, dy = num(ann["b"], "y") - ay, L = hyp(dx, dy);
  if (!(L > 1e-9)) return;
  const double ux = dx / L, uy = dy / L;
  const auto sd = [&](const Ent& e) { return ((e.x1 + e.x2) / 2 - ax) * uy - ((e.y1 + e.y2) / 2 - ay) * ux; };
  std::vector<const Ent*> par;
  for (const Ent& e : g.els) {
    if (e.t != 'L' || e.k == "thread" || e.k == "threadH") continue;
    const double ex = e.x2 - e.x1, ey = e.y2 - e.y1, el = hyp(ex, ey);
    if (el > 1e-6 && std::abs(ux * ey / el - uy * ex / el) < 0.02 && std::abs(sd(e)) > 0.01) par.push_back(&e);
  }
  const Ent* b0 = nullptr;
  const Ent* b1 = nullptr;
  double bd = 1e300;
  for (const Ent* a : par)
    for (const Ent* b : par) {
      const double da = sd(*a), db = sd(*b);
      if (da <= 0 || db >= 0 || std::abs(da + db) > 0.02 || a->k != b->k) continue;
      if (std::abs(hyp(a->x2 - a->x1, a->y2 - a->y1) - hyp(b->x2 - b->x1, b->y2 - b->y1)) > 0.05) continue;
      if (da < bd) bd = da, b0 = a, b1 = b;
    }
  if (!b0) return;
  ann["kind"] = "sym", ann["l1"] = segVers(*b0), ann["l2"] = segVers(*b1);
  ann.erase("a"), ann.erase("b"), ann.erase("sym");
}
bool suivreSym(Ctx& c, const J& v, J& ann, XY& A, XY& B) {  // mepAxisSymTrack, mepAxisTrackPair
  if (!vrai(ann, "l1") || !vrai(ann, "l2")) return false;
  const Seg l1 = segDe(ann["l1"]), l2 = segDe(ann["l2"]);
  const Geo& g = geoDe(c, v);
  const double dx = l1.x2 - l1.x1, dy = l1.y2 - l1.y1, len = hyp(dx, dy);
  const Ent* e1 = nullptr;
  const Ent* e2 = nullptr;
  if (len > 1e-9) {
    const double nx = -dy / len, ny = dx / len;
    const auto off = [&](double x1, double y1, double x2, double y2) { return ((x1 + x2) / 2) * nx + ((y1 + y2) / 2) * ny; };
    const double sep0 = off(l2.x1, l2.y1, l2.x2, l2.y2) - off(l1.x1, l1.y1, l1.x2, l1.y2);
    double bc = 1e300;
    std::vector<std::pair<const Ent*, double>> c1, c2;
    for (const Ent& e : g.els) {
      if (e.t != 'L') continue;
      const double a = coutSuivi(l1, e), b = coutSuivi(l2, e);
      if (a < 1e299) c1.push_back({&e, a});
      if (b < 1e299) c2.push_back({&e, b});
    }
    for (const auto& [a, ca] : c1)
      for (const auto& [b, cb] : c2) {
        if (a == b || a->k != b->k) continue;
        const double sep = off(b->x1, b->y1, b->x2, b->y2) - off(a->x1, a->y1, a->x2, a->y2);
        if (sep * sep0 <= 0 || std::abs(sep) < 0.3 * std::abs(sep0)) continue;
        const double lim = std::max({3.0, 0.6 * len, 0.6 * std::abs(sep0)});
        if (ca > lim || cb > lim) continue;
        const double k = ca + cb + std::abs(sep - sep0);
        if (k < bc) bc = k, e1 = a, e2 = b;
      }
  }
  if (e1 && e2) {
    ann["l1"] = segVers(*e1), ann["l2"] = segVers(*e2);
  }
  const auto vers = [](const Ent* e, const Seg& s) {
    if (!e) return s;
    Seg q;
    q.x1 = e->x1, q.y1 = e->y1, q.x2 = e->x2, q.y2 = e->y2, q.k = e->k;
    return q;
  };
  return axeSym(vers(e1, l1), vers(e2, l2), v, A, B);
}
std::vector<Prim> traitsManuels(Ctx& c, const J& v, J& ann) {  // mepAxisManualGeom
  const std::string kind = chaine(ann, "kind");
  if (kind == "free" && vrai(ann, "sym") && vrai(ann, "a") && vrai(ann, "b")) migrerSym(c, v, ann);
  const std::string k2 = chaine(ann, "kind");
  if (k2 == "free") {
    if (!vrai(ann, "a") || !vrai(ann, "b")) return {};
    return {traitL(num(ann["a"], "x"), num(ann["a"], "y"), num(ann["b"], "x"), num(ann["b"], "y"), "mepAxis")};
  }
  if (k2 == "sym") {
    XY A, B;
    if (!suivreSym(c, v, ann, A, B)) return {};
    return {traitL(A.x, A.y, B.x, B.y, "mepAxis")};
  }
  if (k2 == "slot") {
    if (!vrai(ann, "s")) return {};
    suivreOblong(c, v, ann["s"]);
    const J& s = ann["s"];
    return traitsOblong(num(s, "x1"), num(s, "y1"), num(s, "x2"), num(s, "y2"), num(s, "r"), echelleAxe(v));
  }
  if (k2 == "hole") {
    if (!ann.contains("ref")) return {};
    const auto h = axeDeReference(c, v, ann["ref"]);
    if (!h) return {};
    const Base b = baseDe(v);
    if (h->aRev) return traitsRev(h->rev.o, h->rev.d, h->rev.t0, h->rev.t1, h->rev.r, v, b, AX_DEPASSE / echelleAxe(v));
    return croixAxe(h->x, h->y, h->r, v);
  }
  std::vector<TrouVu> hs;
  if (ann.contains("refs") && ann["refs"].is_array())
    for (J& r : ann["refs"]) {
      const auto h = axeDeReference(c, v, r);
      if (h) hs.push_back(*h);
    }
  if (k2 == "align") return traitsAlignes(hs, v, true);
  if (k2 == "pitch") {
    if (hs.size() < 3) return {};
    double cx, cy, r;
    if (!ajusterCercle(hs, cx, cy, r)) return {};
    return traitsPas(cx, cy, r, hs, v);
  }
  return {};
}
std::vector<Prim> traitsAuto(Ctx& c, const J& v) {  // mepAxisAutoGeom
  std::vector<Prim> out;
  const bool autoAxes = vrai(v, "autoAxes"), autoPitch = vrai(v, "autoPitch");
  if ((!autoAxes && !autoPitch) || perspOuOblique(v)) return out;
  std::set<std::string> manual;
  const J& ax = sous(v, "axes");
  if (ax.is_array())
    for (const J& a : ax) {
      const auto ajoute = [&](const J& r) {
        if (!r.is_null()) manual.insert(chaine(r, "fid") + "|" + chaine(r, "pid"));
      };
      if (chaine(a, "kind") == "hole") ajoute(sous(a, "ref"));
      else if (sous(a, "refs").is_array())
        for (const J& r : a["refs"]) ajoute(r);
    }
  const Base b = baseDe(v);
  const Geo& g = geoDe(c, v);
  std::vector<TrouVu> face;
  std::set<std::string> seen;
  for (const Ent& e : g.els) {
    const auto m = trouAuCercle(c, v, e);
    if (!m) continue;
    const TrouVu h = trouVu(*m->f, *m->P, b);
    if (!seen.insert(cleAxe(h)).second) continue;
    if (!manual.count(cleAxe(h))) face.push_back(h);
  }
  std::set<std::string> inPitch;
  if (autoPitch)
    for (const GroupePas& G : groupesPas(face, v)) {
      for (const TrouVu& h : G.pts) inPitch.insert(cleAxe(h));
      const auto p = traitsPas(G.cx, G.cy, G.r, G.pts, v);
      out.insert(out.end(), p.begin(), p.end());
    }
  if (autoAxes) {
    std::vector<TrouVu> rest;
    for (const TrouVu& h : face)
      if (!inPitch.count(cleAxe(h))) {
        const auto p = croixAxe(h.x, h.y, h.r, v);
        out.insert(out.end(), p.begin(), p.end());
        rest.push_back(h);
      }
    for (const auto& G : groupesAlignes(rest, v)) {
      const auto p = traitsAlignes(G, v, false);
      out.insert(out.end(), p.begin(), p.end());
    }
    const auto cy = traitsCylindres(c, v);
    out.insert(out.end(), cy.begin(), cy.end());
    // mepSlotsAuto : un seul pour des contours emboîtés, pas celui qui a son axe manuel
    std::vector<const Oblong*> tri;
    for (const Oblong& s : oblongsDe(c, v)) tri.push_back(&s);
    std::stable_sort(tri.begin(), tri.end(), [](const Oblong* p, const Oblong* q) { return p->r > q->r; });
    std::vector<const Oblong*> gardes;
    for (const Oblong* s : tri)
      if (std::none_of(gardes.begin(), gardes.end(), [&](const Oblong* o) { return memesCentres(o->x1, o->y1, o->x2, o->y2, s->x1, s->y1, s->x2, s->y2, 0.01); })) gardes.push_back(s);
    for (const Oblong* s : gardes) {
      bool manuel = false;
      if (ax.is_array())
        for (const J& a : ax)
          if (chaine(a, "kind") == "slot" && vrai(a, "s")) {
            const J& q = a["s"];
            if (memesCentres(num(q, "x1"), num(q, "y1"), num(q, "x2"), num(q, "y2"), s->x1, s->y1, s->x2, s->y2, 0.01)) manuel = true;
          }
      if (manuel) continue;
      const auto p = traitsOblong(s->x1, s->y1, s->x2, s->y2, s->r, echelleAxe(v));
      out.insert(out.end(), p.begin(), p.end());
    }
  }
  return out;
}
const std::vector<Axe>& lignesAxes(Ctx& c, J& v) {  // mepAxisLines
  const std::string vid = chaine(v, "id");
  if (auto it = c.axes.find(vid); it != c.axes.end()) return it->second;
  std::vector<Axe> out;
  const J& ext = sous(v, "axExt");
  const auto add = [&](const Prim& p, const std::string& ak, const std::string* annKind) {
    Axe q;
    static_cast<Prim&>(q) = p;
    q.ak = ak, q.manuel = annKind != nullptr;
    if (p.t == 'L') {
      q.bx1 = p.x1, q.by1 = p.y1, q.bx2 = p.x2, q.by2 = p.y2;
      const double L = hyp(p.x2 - p.x1, p.y2 - p.y1);
      if (ext.is_object() && ext.contains(ak) && L > 1e-9 && !(annKind && *annKind == "free")) {
        const J& e = ext[ak];
        const double ux = (p.x2 - p.x1) / L, uy = (p.y2 - p.y1) / L;
        const double e1 = e.is_array() && e.size() > 0 ? nv(e[0]) : 0, e2 = e.is_array() && e.size() > 1 ? nv(e[1]) : 0;
        q.x1 = p.x1 - ux * e1, q.y1 = p.y1 - uy * e1, q.x2 = p.x2 + ux * e2, q.y2 = p.y2 + uy * e2;
        if (e1 > 1e-6 || e2 > 1e-6) q.cls = "mepAxis";
      }
    }
    out.push_back(std::move(q));
  };
  std::map<std::string, int> seen;
  std::vector<Prim> au;
  try {
    au = traitsAuto(c, v);
  } catch (const Standard_Failure&) {
  }
  for (const Prim& p : au) {
    std::string k = "a" + (p.t == 'L' ? js::fixe(p.x1, 2) + "," + js::fixe(p.y1, 2) + "," + js::fixe(p.x2, 2) + "," + js::fixe(p.y2, 2) : js::fixe(p.cx, 2) + "," + js::fixe(p.cy, 2) + "," + js::fixe(p.r, 2));
    const int n = seen[k]++;
    if (n) k += "#" + std::to_string(n);
    add(p, k, nullptr);
  }
  if (v.contains("axes") && v["axes"].is_array())
    for (J& ann : v["axes"]) {
      std::vector<Prim> ps;
      try {
        ps = traitsManuels(c, v, ann);
      } catch (const Standard_Failure&) {
      }
      const std::string kind = chaine(ann, "kind");
      for (size_t i = 0; i < ps.size(); i++) add(ps[i], "m" + chaine(ann, "id") + "." + std::to_string(i), &kind);
    }
  return c.axes[vid] = std::move(out);
}
const Axe* axeParCle(Ctx& c, J& v, const std::string& ak) {  // mepAxisLineByKey
  for (const Axe& a : lignesAxes(c, v))
    if (a.ak == ak) return &a;
  return nullptr;
}

// ── entités et points suivis ──
std::optional<Ent> entiteDeHint(Ctx& c, J& v, const J& hint) {  // mepEntByHint
  if (!hint.is_object() || !hint.contains("i")) return std::nullopt;
  const J& i = hint["i"];
  if (i.is_string()) {
    const std::string s = i.get<std::string>();
    if (s.rfind("ax:", 0) != 0) return std::nullopt;
    const Axe* a = axeParCle(c, v, s.substr(3));
    if (!a) return std::nullopt;
    Ent e;
    e.t = a->t, e.x1 = a->x1, e.y1 = a->y1, e.x2 = a->x2, e.y2 = a->y2, e.cx = a->cx, e.cy = a->cy, e.r = a->r;
    return e;
  }
  if (!i.is_number()) return std::nullopt;
  const double k = i.get<double>();
  const Geo& g = geoDe(c, v);
  if (k < 0 || k >= static_cast<double>(g.els.size()) || k != std::floor(k)) return std::nullopt;
  return g.els[static_cast<size_t>(k)];
}
J formeDe(const Ent& e) {  // mepIdxSnap
  J s = J::object();
  s["t"] = std::string(1, e.t);
  if (e.t == 'L') {
    s["x1"] = e.x1, s["y1"] = e.y1, s["x2"] = e.x2, s["y2"] = e.y2;
    if (!e.k.empty()) s["k"] = e.k;
  } else {
    s["cx"] = e.cx, s["cy"] = e.cy, s["r"] = e.r;
  }
  return s;
}
bool memeForme(const Ent& e, const J& s) {  // mepIdxSame
  const bool sL = chaine(s, "t") == "L";
  if ((e.t == 'L') != sL) return false;
  const auto n = [](double a, double b) { return std::abs(a - b) < 1e-6; };
  if (sL) return n(e.x1, num(s, "x1")) && n(e.y1, num(s, "y1")) && n(e.x2, num(s, "x2")) && n(e.y2, num(s, "y2"));
  return n(e.cx, num(s, "cx")) && n(e.cy, num(s, "cy")) && n(e.r, num(s, "r"));
}
double distSeg(double x, double y, const Ent& e) {  // mepSegDist
  const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L2 = dx * dx + dy * dy;
  const double t = L2 > 1e-12 ? std::max(0.0, std::min(1.0, ((x - e.x1) * dx + (y - e.y1) * dy) / L2)) : 0;
  return hyp(x - (e.x1 + dx * t), y - (e.y1 + dy * t));
}
bool suivreIndex(Ctx& c, const J& v, J& q) {  // mepIdxFollow
  if (!q.is_object() || !q.contains("hint") || !q["hint"].is_object()) return false;
  J& h = q["hint"];
  const std::string t = chaine(h, "t");
  if ((t != "seg" && t != "ctr") || !h.contains("i") || !h["i"].is_number()) return false;
  const Geo& g = geoDe(c, v);
  const double qx = num(q, "x"), qy = num(q, "y");
  const double iv = h["i"].get<double>();
  const Ent* cur = iv >= 0 && iv < static_cast<double>(g.els.size()) ? &g.els[static_cast<size_t>(iv)] : nullptr;
  if (!vrai(h, "s")) {
    if (cur && (cur->t == 'L' ? (t == "seg" && distSeg(qx, qy, *cur) < 0.6) : ((cur->t == 'C' || cur->t == 'A') && hyp(cur->cx - qx, cur->cy - qy) < 0.6))) {
      h["s"] = formeDe(*cur);
    } else if (t == "ctr") {
      for (size_t k = 0; k < g.els.size(); k++) {
        const Ent& e = g.els[k];
        if ((e.t == 'C' || e.t == 'A') && hyp(e.cx - qx, e.cy - qy) < 0.05) {
          h["i"] = static_cast<int>(k);
          h["s"] = formeDe(e);
          break;
        }
      }
    }
    return false;
  }
  const J s = h["s"];
  if (cur && memeForme(*cur, s)) return false;
  const Ent* e = nullptr;
  const bool sL = chaine(s, "t") == "L";
  if (sL) {
    e = suivreTrait(g, segDe(s));
  } else {
    double bc = 1e300;
    const double scx = num(s, "cx"), scy = num(s, "cy"), sr = num(s, "r");
    for (const Ent& x : g.els) {
      if (x.t != 'C' && x.t != 'A') continue;
      const double k = hyp(x.cx - scx, x.cy - scy) + 2 * std::abs(x.r - sr);
      if (k < bc) bc = k, e = &x;
    }
    if (bc > std::max(3.0, sr)) e = nullptr;
  }
  if (!e) return false;
  if (sL) {
    const Seg S = segDe(s);
    const double dx = S.x2 - S.x1, dy = S.y2 - S.y1, L2 = dx * dx + dy * dy;
    const double f = L2 > 1e-12 ? ((qx - S.x1) * dx + (qy - S.y1) * dy) / L2 : 0;
    const bool rev = hyp(e->x1 - S.x1, e->y1 - S.y1) + hyp(e->x2 - S.x2, e->y2 - S.y2) > hyp(e->x2 - S.x1, e->y2 - S.y1) + hyp(e->x1 - S.x2, e->y1 - S.y2);
    const double ax = rev ? e->x2 : e->x1, ay = rev ? e->y2 : e->y1, bx = rev ? e->x1 : e->x2, by = rev ? e->y1 : e->y2;
    q["x"] = ax + (bx - ax) * f, q["y"] = ay + (by - ay) * f;
  } else {
    q["x"] = e->cx, q["y"] = e->cy;
  }
  h["i"] = static_cast<int>(e - g.els.data());
  h["s"] = formeDe(*e);
  return true;
}
J refAxe(Ctx& c, J& v, const J& q, const std::string& ak) {  // mepAxisRefOf
  const Axe* e = axeParCle(c, v, ak);
  if (!e) return nullptr;
  if (e->t == 'C' || e->t == 'A') return J{{"t", "axc"}, {"ak", ak}};
  const double dx = e->bx2 - e->bx1, dy = e->by2 - e->by1, L2 = dx * dx + dy * dy;
  if (!(L2 > 1e-12)) return nullptr;
  return J{{"t", "axp"}, {"ak", ak}, {"f", ((num(q, "x") - e->bx1) * dx + (num(q, "y") - e->by1) * dy) / L2}};
}
void rafraichirPoint(Ctx& c, J& v, J& q, char pref) {  // mepPtRefresh
  if (!q.is_object()) return;
  const bool aH = vrai(q, "hint");
  if (aH) {
    J& h = q["hint"];
    const std::string t = chaine(h, "t");
    if (t == "eln" && vrai(h, "l")) {
      const Ent* e = suivreTrait(geoDe(c, v), segDe(h["l"]));
      if (!e) return;
      h["l"] = J{{"x1", e->x1}, {"y1", e->y1}, {"x2", e->x2}, {"y2", e->y2}, {"k", e->k}};
      const double f = num(h, "f");
      q["x"] = e->x1 + (e->x2 - e->x1) * f, q["y"] = e->y1 + (e->y2 - e->y1) * f;
      return;
    }
    if (t == "slot" && vrai(h, "s")) {
      suivreOblong(c, v, h["s"]);
      const bool n = num(h, "n") != 0;
      q["x"] = num(h["s"], n ? "x2" : "x1"), q["y"] = num(h["s"], n ? "y2" : "y1");
      return;
    }
    if (t == "axp" || t == "axc") {
      const Axe* e = axeParCle(c, v, chaine(h, "ak"));
      if (!e) return;
      if (t == "axc") {
        if (e->t != 'L') q["x"] = e->cx, q["y"] = e->cy;
        return;
      }
      const double f = num(h, "f");
      q["x"] = e->bx1 + (e->bx2 - e->bx1) * f, q["y"] = e->by1 + (e->by2 - e->by1) * f;
      return;
    }
    return;
  }
  // point libre posé sur un axe manuel ou une arête : il s'y rattache
  const double qx = num(q, "x"), qy = num(q, "y");
  const auto dirOk = [&](double dx, double dy) { return !(pref == 'v' && std::abs(dx) > std::abs(dy) * 0.05) && !(pref == 'h' && std::abs(dy) > std::abs(dx) * 0.05); };
  const auto on = [&](double x1, double y1, double dx, double dy, double L) {
    if (std::abs((qx - x1) * dy - (qy - y1) * dx) / L >= 0.02) return -1;
    const double f = ((qx - x1) * dx + (qy - y1) * dy) / (L * L);
    return f >= -0.02 && f <= 1.02 ? 2 : 1;
  };
  J best = nullptr;
  double bs = -1;
  for (const Axe& e : lignesAxes(c, v)) {
    if (e.ak.empty() || e.ak[0] != 'm') continue;
    if (e.t == 'C') {
      if (!pref && hyp(qx - e.cx, qy - e.cy) < 0.02 && bs < 3) {
        bs = 3;
        best = refAxe(c, v, q, e.ak);
      }
      continue;
    }
    if (e.t != 'L') continue;
    const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L = hyp(dx, dy);
    if (!(L > 1e-9) || !dirOk(dx, dy)) continue;
    const int k = on(e.x1, e.y1, dx, dy, L);
    if (k < 0) continue;
    const double sc = k + std::min(0.9, L / 1000);
    if (sc > bs) {
      bs = sc;
      best = refAxe(c, v, q, e.ak);
    }
  }
  if (best.is_null()) {
    const Ent* be = nullptr;
    double bl = 0;
    for (const Ent& e : geoDe(c, v).els) {
      if (e.t != 'L') continue;
      const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L = hyp(dx, dy);
      if (!(L > 1e-6) || !dirOk(dx, dy)) continue;
      if (on(e.x1, e.y1, dx, dy, L) == 2 && L > bl) bl = L, be = &e;
    }
    if (be) {
      const double dx = be->x2 - be->x1, dy = be->y2 - be->y1, L2 = dx * dx + dy * dy;
      best = J{{"t", "eln"}, {"l", {{"x1", be->x1}, {"y1", be->y1}, {"x2", be->x2}, {"y2", be->y2}, {"k", be->k}}}, {"f", L2 > 1e-12 ? ((qx - be->x1) * dx + (qy - be->y1) * dy) / L2 : 0}};
    }
  }
  if (!best.is_null()) q["hint"] = best;
}
Ent entDeSnap(const J& s) {
  Ent e;
  e.t = chaine(s, "t", "L")[0];
  e.x1 = num(s, "x1"), e.y1 = num(s, "y1"), e.x2 = num(s, "x2"), e.y2 = num(s, "y2"), e.cx = num(s, "cx"), e.cy = num(s, "cy"), e.r = num(s, "r"), e.a0 = num(s, "a0"), e.a1 = num(s, "a1"), e.k = chaine(s, "k");
  return e;
}
J snapDeEnt(const Ent& e) {  // mepSnapEntOf
  if (e.t == 'L') {
    J o = J{{"t", "L"}, {"x1", e.x1}, {"y1", e.y1}, {"x2", e.x2}, {"y2", e.y2}};
    if (!e.k.empty()) o["k"] = e.k;
    return o;
  }
  if (e.t == 'A') return J{{"t", "A"}, {"cx", e.cx}, {"cy", e.cy}, {"r", e.r}, {"a0", e.a0}, {"a1", e.a1}};
  return J{{"t", "C"}, {"cx", e.cx}, {"cy", e.cy}, {"r", e.r}};
}
bool arcContient(const Ent& e, double a) {  // mepArcIn
  const double lo = std::min(e.a0, e.a1), hi = std::max(e.a0, e.a1);
  double an = a;
  while (an < lo) an += 2 * PI;
  while (an - 2 * PI >= lo) an -= 2 * PI;
  return an <= hi + 1e-9;
}
std::vector<XY> intersections(const Ent& a, const Ent& b) {  // mepSnapInter
  std::vector<XY> out;
  const auto lineCirc = [&](const Ent& p, const Ent& c0) {
    const double dx = p.x2 - p.x1, dy = p.y2 - p.y1, L = hyp(dx, dy);
    if (!(L > 1e-12)) return;
    const double ux = dx / L, uy = dy / L, t0 = (c0.cx - p.x1) * ux + (c0.cy - p.y1) * uy;
    const double fx = p.x1 + ux * t0, fy = p.y1 + uy * t0, h = hyp(c0.cx - fx, c0.cy - fy);
    if (h > c0.r * (1 + 1e-9)) return;
    const double s = std::sqrt(std::max(0.0, c0.r * c0.r - h * h));
    out.push_back({fx + ux * s, fy + uy * s});
    if (s > 1e-9) out.push_back({fx - ux * s, fy - uy * s});
  };
  if (a.t == 'L' && b.t == 'L') {
    const double dx1 = a.x2 - a.x1, dy1 = a.y2 - a.y1, dx2 = b.x2 - b.x1, dy2 = b.y2 - b.y1;
    const double den = dx1 * dy2 - dy1 * dx2, n = hyp(dx1, dy1) * hyp(dx2, dy2);
    if (!(n > 1e-18) || std::abs(den) / n < 1e-6) return out;
    const double t = ((b.x1 - a.x1) * dy2 - (b.y1 - a.y1) * dx2) / den;
    out.push_back({a.x1 + dx1 * t, a.y1 + dy1 * t});
  } else if (a.t == 'L') {
    lineCirc(a, b);
  } else if (b.t == 'L') {
    lineCirc(b, a);
  } else {
    const double dx = b.cx - a.cx, dy = b.cy - a.cy, d = hyp(dx, dy);
    if (!(d > 1e-9) || d > a.r + b.r + 1e-9 || d < std::abs(a.r - b.r) - 1e-9) return out;
    const double q = (a.r * a.r - b.r * b.r + d * d) / (2 * d), h = std::sqrt(std::max(0.0, a.r * a.r - q * q));
    const double mx = a.cx + dx * q / d, my = a.cy + dy * q / d;
    out.push_back({mx - dy * h / d, my + dx * h / d});
    if (h > 1e-9) out.push_back({mx + dy * h / d, my - dx * h / d});
  }
  return out;
}
void rafraichirIntersection(Ctx& c, const J& v, J& q) {  // mepIntRefresh
  if (!q.is_object() || !vrai(q, "hint")) return;
  J& h = q["hint"];
  if (chaine(h, "t") != "int" || !sous(h, "e").is_array() || h["e"].size() != 2) return;
  const Geo& g = geoDe(c, v);
  J ne = J::array();
  for (const J& s : h["e"]) {
    if (chaine(s, "t") == "L") {
      const Ent* e = suivreTrait(g, segDe(s));
      ne.push_back(e ? snapDeEnt(*e) : s);
    } else {
      const Ent* bst = nullptr;
      double bc = 1e300;
      const double sr = num(s, "r"), scx = num(s, "cx"), scy = num(s, "cy");
      for (const Ent& e : g.els) {
        if (e.t != 'C' && e.t != 'A') continue;
        if (std::abs(e.r - sr) > std::max(0.05, 0.2 * sr)) continue;
        const double k = hyp(e.cx - scx, e.cy - scy) + std::abs(e.r - sr);
        if (k < bc) bc = k, bst = &e;
      }
      ne.push_back(bst && bc <= std::max(3.0, sr) ? snapDeEnt(*bst) : s);
    }
  }
  std::optional<XY> p;
  double bd = 1e300;
  for (const XY& r : intersections(entDeSnap(ne[0]), entDeSnap(ne[1]))) {
    const double d = hyp(r.x - num(q, "x"), r.y - num(q, "y"));
    if (d < bd) bd = d, p = r;
  }
  if (!p) return;
  h["e"] = ne;
  q["x"] = p->x, q["y"] = p->y;
}
void rafraichirPoints(Ctx& c, J& d) {  // mepDimPtsRefresh
  J* v1 = vueJ(c.sh, chaine(d, "vid"));
  if (!v1) return;
  const std::string kind = chaine(d, "kind");
  const std::string vid2 = chaine(d, "vid2");
  if (kind == "ord") {
    if (d.contains("o")) suivreIndex(c, *v1, d["o"]);
    if (d.contains("pts") && d["pts"].is_array())
      for (J& q : d["pts"]) suivreIndex(c, *v1, q);
  } else {
    J* v2 = !vid2.empty() ? vueJ(c.sh, vid2) : v1;
    if (d.contains("a") && suivreIndex(c, *v1, d["a"]) && kind == "len" && vid2.empty() && vrai(d, "b")) {
      const auto e = entiteDeHint(c, *v1, sous(d["a"], "hint"));
      if (e && e->t == 'L') {
        const double ax = num(d["a"], "x"), ay = num(d["a"], "y");
        const bool sw = hyp(e->x2 - ax, e->y2 - ay) < hyp(e->x1 - ax, e->y1 - ay);
        d["a"]["x"] = sw ? e->x2 : e->x1, d["a"]["y"] = sw ? e->y2 : e->y1;
        d["b"] = J{{"x", sw ? e->x1 : e->x2}, {"y", sw ? e->y1 : e->y2}};
      }
    }
    if (vrai(d, "b") && v2) suivreIndex(c, *v2, d["b"]);
  }
  if (kind == "dist") {
    if (d.contains("a")) rafraichirIntersection(c, *v1, d["a"]);
    if (vrai(d, "b")) {
      J* v2 = !vid2.empty() ? vueJ(c.sh, vid2) : v1;
      if (v2) rafraichirIntersection(c, *v2, d["b"]);
    }
  }
  if (kind == "ord") {
    const char pr = chaine(d, "axis") == "y" ? 'h' : 'v';
    if (d.contains("o")) {
      rafraichirPoint(c, *v1, d["o"], pr);
      d["a"] = d["o"];
      d["b"] = d["o"];
    }
    if (d.contains("pts") && d["pts"].is_array())
      for (J& q : d["pts"]) rafraichirPoint(c, *v1, q, pr);
    return;
  }
  if (kind != "dist" && kind != "note") return;
  const std::string o = chaine(d, "orient");
  const char pr = kind == "dist" ? (o == "h" ? 'v' : (o == "v" ? 'h' : 0)) : 0;
  const auto ok = [&](const J& q) { return q.is_object() && (pr || kind != "dist" || vrai(q, "hint")); };
  if (d.contains("a") && ok(d["a"])) rafraichirPoint(c, *v1, d["a"], pr);
  if (kind == "dist" && d.contains("b") && ok(d["b"])) {
    J* v2 = !vid2.empty() ? vueJ(c.sh, vid2) : v1;
    if (v2) rafraichirPoint(c, *v2, d["b"], pr);
  }
}
XY versFeuille(const J& v, double x, double y) { return {num(v, "x") + x * num(v, "scale"), num(v, "y") + y * num(v, "scale")}; }
struct Monde {
  XY a, b;
  J* v1 = nullptr;
  J* v2 = nullptr;
};
std::optional<Monde> mondeCote(Ctx& c, J& d) {  // mepDimWorld
  J* v1 = vueJ(c.sh, chaine(d, "vid"));
  if (!v1) return std::nullopt;
  try {
    rafraichirPoints(c, d);
  } catch (const std::exception&) {
  }
  if (chaine(d, "kind") == "len" && !vrai(d, "vid2") && d.contains("a") && vrai(d["a"], "hint") && sous(d["a"]["hint"], "i").is_string()) {
    const auto e = entiteDeHint(c, *v1, d["a"]["hint"]);
    if (e && e->t == 'L') {
      const J hint = d["a"]["hint"];
      d["a"] = J{{"x", e->x1}, {"y", e->y1}, {"hint", hint}};
      d["b"] = J{{"x", e->x2}, {"y", e->y2}};
    }
  }
  Monde w;
  w.v1 = v1;
  const J& A = sous(d, "a");
  w.a = versFeuille(*v1, num(A, "x"), num(A, "y"));
  if (vrai(d, "vid2")) {
    J* v2 = vueJ(c.sh, chaine(d, "vid2"));
    if (!v2) return std::nullopt;
    w.v2 = v2;
    w.b = versFeuille(*v2, num(sous(d, "b"), "x"), num(sous(d, "b"), "y"));
  } else {
    const bool aB = vrai(d, "b");
    w.b = versFeuille(*v1, aB ? num(d["b"], "x") : num(A, "x"), aB ? num(d["b"], "y") : num(A, "y"));
  }
  return w;
}
// ── angles ──
struct GeoAngle {
  XY O;
  double a1 = 0, a2 = 0, dd = 0, b1 = 0, b2 = 0;
  bool aExt = false;
  std::array<double, 2> e1{0, 0}, e2{0, 0};
};
std::optional<GeoAngle> geoAngle(Ctx& c, J& d) {  // mepAngGeom, mepAngSector
  const auto w = mondeCote(c, d);
  if (!w) return std::nullopt;
  const auto hintDe = [](const J& p) -> const J& { return sous(p, "hint"); };
  const auto e1 = entiteDeHint(c, *w->v1, hintDe(sous(d, "a")));
  J* vb = vrai(d, "vid2") ? w->v2 : w->v1;
  const auto e2 = vb ? entiteDeHint(c, *vb, hintDe(sous(d, "b"))) : std::nullopt;
  if (!(e1 && e1->t == 'L' && e2 && e2->t == 'L')) return std::nullopt;
  const double ax = e1->x2 - e1->x1, ay = e1->y2 - e1->y1, bx = e2->x2 - e2->x1, by = e2->y2 - e2->y1;
  GeoAngle g;
  if (vrai(d, "vid2") && chaine(d, "vid2") != chaine(d, "vid")) {
    g.O = w->a, g.a1 = std::atan2(ay, ax), g.a2 = std::atan2(by, bx);
  } else {
    const double den = ax * by - ay * bx;
    double ox = e1->x1, oy = e1->y1;
    if (std::abs(den) > 1e-9) {
      const double t = ((e2->x1 - e1->x1) * by - (e2->y1 - e1->y1) * bx) / den;
      ox = e1->x1 + ax * t, oy = e1->y1 + ay * t;
    }
    const double sc = num(*w->v1, "scale");
    const auto ray = [&](const Ent& e, double& a, std::array<double, 2>& ext) {
      double dx = (e.x1 + e.x2) / 2 - ox, dy = (e.y1 + e.y2) / 2 - oy;
      if (hyp(dx, dy) < 1e-9) dx = e.x2 - e.x1, dy = e.y2 - e.y1;
      double l = hyp(dx, dy);
      if (l == 0) l = 1;
      const double ux = dx / l, uy = dy / l, s1 = (e.x1 - ox) * ux + (e.y1 - oy) * uy, s2 = (e.x2 - ox) * ux + (e.y2 - oy) * uy;
      a = std::atan2(uy, ux);
      ext = {std::min(s1, s2) * sc, std::max(s1, s2) * sc};
    };
    ray(*e1, g.a1, g.e1);
    ray(*e2, g.a2, g.e2);
    g.aExt = true;
    g.O = versFeuille(*w->v1, ox, oy);
  }
  g.b1 = g.a1, g.b2 = g.a2;
  const int q = static_cast<int>(num(d, "q")) & 3;
  const auto flip = [&](double& a, std::array<double, 2>& e) {
    a += PI;
    e = {-e[1], -e[0]};
  };
  if (q & 1) flip(g.a1, g.e1);
  if (q & 2) flip(g.a2, g.e2);
  double dd = g.a2 - g.a1;
  while (dd <= -PI) dd += 2 * PI;
  while (dd > PI) dd -= 2 * PI;
  if (vrai(d, "big")) dd = dd > 0 ? dd - 2 * PI : dd + 2 * PI;
  g.dd = dd;
  return g;
}
double rayonAngle(const J& d) { return std::max(6.0, std::min(80.0, num(d, "off", 14))); }
double mesureCote(Ctx& c, J& d) {  // mepDimMeasure
  const auto w = mondeCote(c, d);
  if (!w) return 0;
  const std::string o = chaine(d, "orient", "a");
  const auto oriente = [&](double ax, double ay, double bx, double by) { return o == "h" ? std::abs(bx - ax) : o == "v" ? std::abs(by - ay) : hyp(bx - ax, by - ay); };
  const J& A = sous(d, "a");
  const J& B = sous(d, "b");
  const auto modele = [&]() { return vrai(d, "b") ? oriente(num(A, "x"), num(A, "y"), num(B, "x"), num(B, "y")) : 0.0; };
  const std::string kind = chaine(d, "kind");
  if (kind == "len") {
    const auto e = entiteDeHint(c, *w->v1, sous(A, "hint"));
    if (e && e->t == 'L') return oriente(e->x1, e->y1, e->x2, e->y2);
    return modele();
  }
  if (kind == "dist") return modele();
  if (kind == "rad" || kind == "dia") {
    const auto e = entiteDeHint(c, *w->v1, sous(A, "hint"));
    const double f = kind == "dia" ? 2 : 1;
    return e && (e->t == 'C' || e->t == 'A') ? f * e->r : f * modele();
  }
  if (kind == "ang") {
    const auto g = geoAngle(c, d);
    if (g) return std::abs(g->dd) * 180 / PI;
    return std::abs(std::atan2(w->a.y - w->b.y, w->a.x - w->b.x) * 180 / PI);
  }
  return hyp(w->b.x - w->a.x, w->b.y - w->a.y);
}
// ── textes de cote ──
struct Parts {
  std::string main, up, lo, sym, post;
  bool par = false;
};
struct DT {  // ce que les textes lisent d'une cote
  std::string kind, pre, post, dsym, txt, holeText;
  double holeN = 0;
  J tol;
  int prec = -1;
  bool aPrec = false;
};
std::string coupeBlancs(std::string s) {
  size_t a = 0;
  while (a < s.size() && std::isspace(static_cast<unsigned char>(s[a]))) a++;
  size_t b = s.size();
  while (b > a && std::isspace(static_cast<unsigned char>(s[b - 1]))) b--;
  return s.substr(a, b - a);
}
DT dtDe(const J& d) {
  DT t;
  t.kind = chaine(d, "kind"), t.pre = chaine(d, "pre"), t.post = chaine(d, "post"), t.dsym = chaine(d, "dsym"), t.txt = chaine(d, "txt"), t.holeText = chaine(d, "holeText");
  t.holeN = num(d, "holeN");
  t.tol = sous(d, "tol");
  if (d.contains("prec") && d["prec"].is_number()) {
    const double p = d["prec"].get<double>();
    if (p == 0 || p == 1 || p == 2 || p == 3) t.prec = static_cast<int>(p), t.aPrec = true;
  }
  return t;
}
int precCote(Ctx& c, const DT& d) { return d.aPrec ? d.prec : (d.kind == "ang" ? 1 : c.st.prec); }
std::string tolSignee(double v) { return (v < 0 ? "−" : "+") + fmtNum(std::abs(v), 3); }
std::string tolSignee0(double v) { return std::abs(v) < 1e-9 ? "0" : tolSignee(v); }
std::string joint(const std::string& a, const std::string& b) { return !a.empty() && !b.empty() ? a + " " + b : (!a.empty() ? a : b); }
Parts partiesTexte(Ctx& c, DT d, double value);
Parts partiesSymbole(Ctx& c, DT d, double value, const std::string& sym) {  // mepDimSymbolParts
  const std::string pre = coupeBlancs(d.pre), post = coupeBlancs(d.post);
  DT q = d;
  q.pre.clear(), q.post.clear();
  Parts p = partiesTexte(c, q, value);
  const std::string main = joint(pre, sym + p.main);
  if (!p.sym.empty()) {
    p.main = main, p.sym = joint(p.sym, post);
    return p;
  }
  if (p.par) {
    p.main = main, p.post = post;
    return p;
  }
  p.main = joint(main, post);
  return p;
}
Parts partiesTexte(Ctx& c, DT d, double value) {  // mepDimTextParts
  if (!d.dsym.empty() && d.txt.empty() && d.kind != "dia" && d.kind != "rad") {
    const std::string s = d.dsym;
    d.dsym.clear();
    return partiesSymbole(c, d, value, s);
  }
  const std::string pre = coupeBlancs(d.pre), post = coupeBlancs(d.post);
  const auto wrap = [&](const std::string& s) { return joint(joint(pre, s), post); };
  Parts P;
  if (d.kind == "hole") {
    P.main = wrap((d.holeN > 1 && d.txt.empty() ? js::texte(d.holeN) + "× " : std::string()) + (!d.txt.empty() ? d.txt : d.holeText));
    return P;
  }
  if (!d.txt.empty()) {
    P.main = wrap(d.txt);
    return P;
  }
  const std::string unit = d.kind == "ang" ? "°" : "";
  const std::string base = fmtNum(value, precCote(c, d)) + unit;
  const std::string m = chaine(d.tol, "m");
  if (m == "pm" && num(d.tol, "s") > 0) {
    P.main = joint(pre, base);
    P.sym = "±" + fmtNum(num(d.tol, "s"), 3) + (!post.empty() ? " " + post : "");
    return P;
  }
  if (m == "dbl") {
    P.main = wrap(base), P.up = tolSignee(num(d.tol, "hi")), P.lo = tolSignee(num(d.tol, "lo"));
    return P;
  }
  const std::string cls = chaine(d.tol, "cls");
  if (m == "cls" && !cls.empty()) {
    if (cls.find('/') == std::string::npos) {
      const auto r = std::abs(value) > 0 ? ecartsIso286(cls, std::abs(value)) : std::nullopt;
      if (r) {
        P.main = joint(pre, base + " " + cls), P.up = tolSignee0(r->hi), P.lo = tolSignee0(r->lo), P.par = true, P.post = post;
        return P;
      }
    }
    P.main = wrap(base + " " + cls);
    return P;
  }
  P.main = wrap(base);
  return P;
}
std::string marquesTolerance(std::string s);
std::string texteTolTrou(Ctx& c, const std::string& txt, const J& tol);
J tolDeTrou(Ctx& c, const J& d) {  // mepHoleTol
  if (vrai(d, "tol")) return d["tol"];
  if (vrai(d, "tolManual")) return nullptr;
  if (chaine(d, "kind") != "hole" || !vrai(d, "holeFid")) return nullptr;
  const Trou* f = trouDe(c, chaine(d, "holeFid"));
  if (f && f->kind == "ream" && !f->tolAlesage.empty()) return J{{"m", "cls"}, {"cls", f->tolAlesage}};
  return nullptr;
}
std::string texteCote(Ctx& c, const J& d, double value) {  // mepDimText
  const DT t = dtDe(d);
  const Parts p = (t.kind == "dia" || t.kind == "rad") ? partiesSymbole(c, t, value, t.kind == "dia" ? "Ø" : "R") : partiesTexte(c, t, value);
  const std::string main = !p.sym.empty() ? p.main + " " + p.sym : p.main;
  const J ht = t.kind == "hole" && t.txt.empty() ? tolDeTrou(c, d) : J();
  if (!ht.is_null()) return marquesTolerance(texteTolTrou(c, main, ht));
  if (p.par) return main + " (" + p.up + " / " + p.lo + ")" + (!p.post.empty() ? " " + p.post : "");
  return !p.up.empty() || !p.lo.empty() ? main + " " + p.up + " / " + p.lo : main;
}
const char* const M1 = "\x01", *const M2 = "\x02", *const M3 = "\x03", *const M4 = "\x04";
std::string texteTolTrou(Ctx& c, const std::string& txt, const J& tol) {  // mepHoleTolText
  if (tol.is_null() || !vrai(tol, "m")) return txt;
  static const std::regex re("\xC3\x98\\s?([0-9]+(?:[.,][0-9]+)?)");
  std::smatch m;
  if (!std::regex_search(txt, m, re)) return txt;
  std::string s = m[1].str();
  std::replace(s.begin(), s.end(), ',', '.');
  const double nom = std::strtod(s.c_str(), nullptr);
  if (!(nom > 0)) return txt;
  DT d;
  d.kind = "dia", d.tol = tol;
  const Parts p = partiesSymbole(c, d, nom, "Ø");
  const std::string mode = chaine(tol, "m");
  std::string add;
  if (mode == "pm" && num(tol, "s") > 0) add = std::string(M1) + p.sym + M2;
  else if (mode == "dbl") add = std::string(M1) + M3 + p.up + M4 + p.lo + M2;
  else if (mode == "cls" && vrai(tol, "cls")) add = chaine(tol, "cls") + (p.par ? std::string(" ") + M1 + M3 + "(" + p.up + M4 + p.lo + M2 : std::string());
  if (add.empty()) return txt;
  const size_t e = static_cast<size_t>(m.position(0) + m.length(0));
  return txt.substr(0, e) + " " + add + txt.substr(e);
}
// Le premier « \1\3(?up\4lo\2 » d'une ligne
struct Pile {
  size_t debut = 0, fin = 0;
  bool par = false;
  std::string up, lo;
};
std::optional<Pile> chercherPile(const std::string& s, size_t depuis = 0) {
  for (size_t i = s.find(M1, depuis); i != std::string::npos; i = s.find(M1, i + 1)) {
    if (i + 1 >= s.size() || s[i + 1] != '\x03') continue;
    size_t k = i + 2;
    Pile P;
    P.debut = i;
    if (k < s.size() && s[k] == '(') P.par = true, k++;
    const size_t q4 = s.find(M4, k);
    if (q4 == std::string::npos || s.find(M2, k) < q4) continue;
    const size_t q2 = s.find(M2, q4 + 1);
    if (q2 == std::string::npos) continue;
    P.up = s.substr(k, q4 - k), P.lo = s.substr(q4 + 1, q2 - q4 - 1), P.fin = q2 + 1;
    return P;
  }
  return std::nullopt;
}
std::string marquesTolerance(std::string s) {  // mepTolMarks
  for (auto P = chercherPile(s); P; P = chercherPile(s, P->debut)) {
    const std::string r = P->par ? "(" + P->up + " / " + P->lo + ")" : P->up + " / " + P->lo;
    s = s.substr(0, P->debut) + r + s.substr(P->fin);
  }
  std::string o;
  for (char ch : s)
    if (ch != '\x01' && ch != '\x02') o += ch;
  return o;
}
double sousH(double th) { return th * 0.68; }
double hauteurLigneTol(Ctx& c) { return sousH(c.st.textHeight) * 0.855; }
double largeurPile(Ctx& c, const std::string& up, const std::string& lo, bool par, const std::string& post) {  // mepDimStackW
  const double th = c.st.textHeight, sub = sousH(th), lh = hauteurLigneTol(c);
  const double pw = par ? sub * 0.55 : 0, tw = std::max(longueurCar(up), longueurCar(lo)) * sub * 0.54;
  const double cw = par ? (sub + lh) * 0.4 + (!post.empty() ? (longueurCar(post) + 1) * sub * 0.54 : 0) : 0;
  return pw + tw + cw;
}
double ecartPile(Ctx& c) { return c.st.textHeight * 0.245; }
void dessinerPile(Ctx& c, const std::string& cls, double sx, double y, const std::string& up, const std::string& lo, const std::string& transform, bool par, const std::string& post) {  // mepDimDrawStack
  const double th = c.st.textHeight, sub = sousH(th), lh = hauteurLigneTol(c);
  const std::string st = "font-size:" + tx(sub) + "px;stroke-width:1";
  const double pw = par ? sub * 0.55 : 0;
  const auto coupe = [](const std::string& s) {
    const size_t i = s.find_first_of(".,");
    return i == std::string::npos ? std::array<std::string, 2>{s, ""} : std::array<std::string, 2>{s.substr(0, i), s.substr(i)};
  };
  const auto U = coupe(up), L = coupe(lo);
  const double cw = sub * 0.58;
  const double iw = std::max(longueurCar(U[0]), longueurCar(L[0])) * cw, xd = sx + pw + iw;
  const double tw = iw + std::max(longueurCar(U[1]), longueurCar(L[1])) * sub * 0.54;
  const auto texte = [&](double x, double yy, const char* anchor, const std::string& style, const std::string& s) {
    At a = c.mk("text").n("x", x).n("y", yy).s("text-anchor", anchor).s("class", cls).s("style", style);
    if (!transform.empty()) a.s("transform", transform);
    a.t(s);
  };
  const auto ligne = [&](const std::array<std::string, 2>& P, double yy) {
    if (!P[0].empty()) texte(xd, yy, "end", st, P[0]);
    if (!P[1].empty()) texte(xd, yy, "start", st, P[1]);
  };
  ligne(U, y - lh);
  ligne(L, y);
  if (par) {
    const double ph = sub + lh, py = y - lh * 0.5 - sub * 0.35 + ph * 0.26;
    const std::string sp = "font-size:" + js::fixe(ph, 2) + "px;stroke-width:1";
    texte(sx, py, "start", sp, "(");
    texte(sx + pw + tw, py, "start", sp, ")" + (!post.empty() ? " " + post : std::string()));
  }
}
// mepDimDrawText : rend la largeur du texte posé
double dessinerTexte(Ctx& c, const std::string& cls, const std::string& main, const Parts& p, double x, double y, const std::string& anchor, const std::string& transform) {
  const bool pile = !p.up.empty() || !p.lo.empty();
  const double shift = (anchor == "end" && pile) ? ecartPile(c) + largeurPile(c, p.up, p.lo, p.par, p.post) : 0;
  {
    At a = c.mk("text").n("x", x - shift).n("y", y).s("text-anchor", anchor);
    if (!transform.empty()) a.s("transform", transform);
    a.s("class", cls).t(main);
  }
  const double th = c.st.textHeight;
  double w = largeur(main, th);
  if (!p.sym.empty()) {
    const double fs = th * 0.85;
    Elt& e = c.mk("tspan").s("font-size", tx(fs)).t(" " + p.sym).e;
    e.niveau = 1;
    w += largeur(" " + p.sym, fs);
  }
  if (!pile) return w;
  const double gap = ecartPile(c), mw = std::max(7.0, longueurCar(main) * th * 0.62);
  const double sx = anchor == "middle" ? x + mw / 2 + gap : (anchor == "end" ? x - shift + gap : x + (w > 0 ? largeur(main, th) : longueurCar(main) * th * 0.6) + gap);
  dessinerPile(c, cls, sx, y, p.up, p.lo, transform, p.par, p.post);
  return w;
}
double decaleSous(double h) { return 0.3 * h + 0.9; }  // mepDimUnderOff

// ── cote linéaire ──
struct LigneCote {
  XY a1, b1, sa, sb, ea, eb;
  double dx = 0, dy = 0, L = 0, ux = 0, uy = 0, vx = 0, vy = 0;
};
std::optional<LigneCote> ligneCote(Ctx& c, J& d, const Monde& w) {  // mepDimLine
  const std::string orient = chaine(d, "orient", "a");
  LigneCote g;
  double dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
  const double off = num(d, "off", 8);
  if (orient == "h") {
    dy = 0;
    if (std::abs(dx) < 1e-9) return std::nullopt;
    g.ux = dx > 0 ? 1 : -1, g.uy = 0, g.vx = 0, g.vy = 1;
    const double cy = (w.a.y + w.b.y) / 2 + off;
    g.a1 = {w.a.x, cy}, g.b1 = {w.b.x, cy};
  } else if (orient == "v") {
    dx = 0;
    if (std::abs(dy) < 1e-9) return std::nullopt;
    g.ux = 0, g.uy = dy > 0 ? 1 : -1, g.vx = 1, g.vy = 0;
    const double cx = (w.a.x + w.b.x) / 2 + off;
    g.a1 = {cx, w.a.y}, g.b1 = {cx, w.b.y};
  } else {
    const double L0 = hyp(dx, dy);
    if (L0 < 1e-9) return std::nullopt;
    g.ux = dx / L0, g.uy = dy / L0, g.vx = -g.uy, g.vy = g.ux;
    g.a1 = {w.a.x + g.vx * off, w.a.y + g.vy * off};
    g.b1 = {w.b.x + g.vx * off, w.b.y + g.vy * off};
  }
  g.dx = dx, g.dy = dy, g.L = hyp(dx, dy);
  const double gap = c.st.gap, over = c.st.overrun, dir = off >= 0 ? 1 : -1;
  const auto bouts = [&](const XY& p, const XY& q, XY& s, XY& e) {
    const double t = (q.x - p.x) * g.vx + (q.y - p.y) * g.vy;
    const double sg = std::abs(t) < 1e-9 ? dir : (t > 0 ? 1 : -1);
    s = {p.x + g.vx * gap * sg, p.y + g.vy * gap * sg};
    e = {q.x + g.vx * over * sg, q.y + g.vy * over * sg};
  };
  bouts(w.a, g.a1, g.sa, g.ea);
  bouts(w.b, g.b1, g.sb, g.eb);
  const J& A = sous(d, "a");
  const J& B = sous(d, "b");
  if (chaine(d, "kind") == "dist" && chaine(sous(A, "hint"), "t") == "seg" && chaine(sous(B, "hint"), "t") == "seg") {
    const auto eA = entiteDeHint(c, *w.v1, A["hint"]), eB = entiteDeHint(c, *w.v1, B["hint"]);
    const auto parallele = [&](const std::optional<Ent>& e) {
      if (!e || e->t != 'L') return false;
      const double lx = e->x2 - e->x1, ly = e->y2 - e->y1;
      double ll = hyp(lx, ly);
      if (ll == 0) ll = 1;
      return std::abs((lx * g.vx + ly * g.vy) / ll) > 0.999;
    };
    if (parallele(eA) && parallele(eB)) {
      const auto bord = [&](const Ent& e, const XY& q, XY& s, XY& fin) {
        const XY p1 = versFeuille(*w.v1, e.x1, e.y1), p2 = versFeuille(*w.v1, e.x2, e.y2);
        const double d1 = (p1.x - q.x) * g.vx + (p1.y - q.y) * g.vy, d2 = (p2.x - q.x) * g.vx + (p2.y - q.y) * g.vy;
        if (std::min(d1, d2) < -1e-9 && std::max(d1, d2) > 1e-9) {
          s = q, fin = q;
          return;
        }
        bouts(std::abs(d1) <= std::abs(d2) ? p1 : p2, q, s, fin);
      };
      bord(*eA, g.a1, g.sa, g.ea);
      bord(*eB, g.b1, g.sb, g.eb);
    }
  }
  return g;
}
void prolongementsIntersection(Ctx& c, const std::string& cls, const J& v, const J& q) {  // mepDrawSnapExt, mepSnapExtPrims
  if (!q.is_object() || chaine(sous(q, "hint"), "t") != "int") return;
  const double qx = num(q, "x"), qy = num(q, "y");
  const double ov = c.st.overrun / num(v, "scale");
  const auto trait = [&](double a, double b, double e, double f) { c.mk("line").n("x1", a).n("y1", b).n("x2", e).n("y2", f).s("class", cls); };
  for (const J& s : q["hint"]["e"]) {
    const Ent e = entDeSnap(s);
    if (e.t == 'L') {
      const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, L2 = dx * dx + dy * dy;
      if (!(L2 > 1e-12)) continue;
      const double L = std::sqrt(L2), t = ((qx - e.x1) * dx + (qy - e.y1) * dy) / L2, tol = 1e-4 / L;
      if (!(t < -tol || t > 1 + tol)) continue;
      const double sg = t < 0 ? -1 : 1;
      const XY A = versFeuille(v, t < 0 ? e.x1 : e.x2, t < 0 ? e.y1 : e.y2), B = versFeuille(v, qx + sg * dx / L * ov, qy + sg * dy / L * ov);
      trait(A.x, A.y, B.x, B.y);
    } else if (e.t == 'A') {
      const double a = std::atan2(qy - e.cy, qx - e.cx);
      if (arcContient(e, a)) continue;
      const auto borne = [](double x) {
        while (x > PI) x -= 2 * PI;
        while (x <= -PI) x += 2 * PI;
        return x;
      };
      const double d0 = borne(a - e.a0), d1 = borne(a - e.a1);
      const bool useA0 = std::abs(d0) <= std::abs(d1);
      const double a0 = useA0 ? e.a0 : e.a1, dd = useA0 ? d0 : d1;
      const double dov = (dd > 0 ? 1 : (dd < 0 ? -1 : 0)) * ov / std::max(e.r, 1e-9), a1 = a0 + dd + dov;
      const XY C = versFeuille(v, e.cx, e.cy);
      const double r = e.r * num(v, "scale");
      const int n = std::max(4, static_cast<int>(std::ceil(std::abs(a1 - a0) * r / 2)));
      for (int k = 0; k < n; k++) {
        const double t0 = a0 + (a1 - a0) * k / n, t1 = a0 + (a1 - a0) * (k + 1) / n;
        trait(C.x + r * std::cos(t0), C.y + r * std::sin(t0), C.x + r * std::cos(t1), C.y + r * std::sin(t1));
      }
    }
  }
}
// Étendue d'un texte le long de sa ligne
void etendueTexte(Ctx& c, const J& d, double value, double& lo, double& hi) {  // mepDimLabelSpan
  const Parts p = partiesTexte(c, dtDe(d), value);
  const double th = c.st.textHeight;
  const std::string main = vrai(d, "ref") ? "(" + p.main + ")" : p.main;
  const double half = std::max(7.0, longueurCar(main) * th * 0.62) / 2;
  if (!p.sym.empty()) {
    const double h = half + (std::max(1.2, th * 0.14) + longueurCar(p.sym) * th * 0.85 * 0.54) / 2;
    lo = -h, hi = h;
    return;
  }
  lo = -half, hi = half;
  if (!p.up.empty() || !p.lo.empty()) hi = half + ecartPile(c) + largeurPile(c, p.up, p.lo, p.par, p.post);
}
void dessinerOrdonnees(Ctx& c, J& d, const std::string& LX, const std::string& T) {  // mepDrawOrd
  J* v = vueJ(c.sh, chaine(d, "vid"));
  if (!v || !vrai(d, "o")) return;
  try {
    rafraichirPoints(c, d);
  } catch (const std::exception&) {
  }
  const double hh = c.st.dimH, gap = std::max(0.8, c.st.gap != 0 ? c.st.gap : 1);
  const J& o = d["o"];
  const XY oS = versFeuille(*v, num(o, "x"), num(o, "y"));
  const bool axeY = chaine(d, "axis") == "y";
  const double line = (axeY ? oS.x : oS.y) + num(d, "off");
  const double sc = num(*v, "scale");
  const auto trait = [&](double a, double b, double e, double f) { c.mk("line").n("x1", a).n("y1", b).n("x2", e).n("y2", f).s("class", LX); };
  std::vector<const J*> pts{&o};
  if (sous(d, "pts").is_array())
    for (const J& p : d["pts"]) pts.push_back(&p);
  DT prec = dtDe(d);
  prec.kind = "ord";
  for (size_t k = 0; k < pts.size(); k++) {
    const J& p = *pts[k];
    const XY P = versFeuille(*v, num(p, "x"), num(p, "y"));
    const double val0 = axeY ? num(o, "y") - num(p, "y") : num(p, "x") - num(o, "x");
    const double a0 = std::abs(val0), val = a0 < 1e-9 ? 0 : a0;
    const std::string s = fmtNum(val, precCote(c, prec));
    std::optional<Parts> pp;
    if (k > 0 && vrai(p, "tol")) {
      DT q;
      q.kind = "len", q.tol = p["tol"], q.aPrec = prec.aPrec, q.prec = prec.prec;
      pp = partiesTexte(c, q, val);
    }
    const auto put = [&](double x, double y, const char* anchor, const std::string& tr) {
      if (!pp) {
        At a = c.mk("text").n("x", x).n("y", y).s("text-anchor", anchor);
        if (!tr.empty()) a.s("transform", tr);
        a.s("class", T).t(s);
        return;
      }
      dessinerTexte(c, T, pp->main, *pp, x, y, anchor, tr);
    };
    const double J0 = k > 0 && num(p, "jog") != 0 ? num(p, "jog") * sc : 0;
    if (axeY) {
      const double sg = line < P.x ? -1 : 1, y2 = P.y + J0;
      const bool cass = J0 != 0 && std::abs(line - P.x) > 8;
      if (cass) {
        const double b1 = line - sg * 7, b2 = line - sg * 4;
        trait(P.x + sg * gap, P.y, b1, P.y);
        trait(b1, P.y, b2, y2);
        trait(b2, y2, line, y2);
      } else {
        trait(P.x + sg * gap, P.y, line, P.y);
      }
      put(line + sg * 1, (cass ? y2 : P.y) + hh * 0.5, sg < 0 ? "end" : "start", "");
    } else {
      const double sg = line < P.y ? -1 : 1, x2 = P.x + J0;
      const bool cass = J0 != 0 && std::abs(line - P.y) > 8;
      const double xt = (cass ? x2 : P.x) + hh * 0.5, y = line + sg * 1;
      if (cass) {
        const double b1 = line - sg * 7, b2 = line - sg * 4;
        trait(P.x, P.y + sg * gap, P.x, b1);
        trait(P.x, b1, x2, b2);
        trait(x2, b2, x2, line);
      } else {
        trait(P.x, P.y + sg * gap, P.x, line);
      }
      put(xt, y, sg < 0 ? "start" : "end", "rotate(-90 " + js::fixe(xt, 3) + " " + js::fixe(y, 3) + ")");
    }
  }
}
}  // namespace

double largeurTexte(const std::string& s, double corps, bool gras) { return largeur(s, corps, gras); }

void dessinerAxesVue(Ctx& c, J& v) {  // mepDrawAxes, mepDrawAxisPrim
  const double vx = num(v, "x"), vy = num(v, "y"), sc = num(v, "scale");
  for (const Axe& p : lignesAxes(c, v)) {
    const std::string cls = (p.cls.empty() ? "mepAxis" : p.cls) + " " + (p.manuel ? "mepAxisManual" : "mepAxisAuto");
    if (p.t == 'L') c.mk("line").n("x1", arr3(vx + p.x1 * sc)).n("y1", arr3(vy + p.y1 * sc)).n("x2", arr3(vx + p.x2 * sc)).n("y2", arr3(vy + p.y2 * sc)).s("class", cls);
    else if (p.t == 'C') c.mk("circle").n("cx", arr3(vx + p.cx * sc)).n("cy", arr3(vy + p.cy * sc)).n("r", arr3(p.r * sc)).s("class", cls);
  }
}

void dessinerCote(Ctx& c, J& d) {  // mepDrawDim
  const auto w0 = mondeCote(c, d);
  if (!w0) return;
  const Monde w = *w0;
  const double val = d.contains("value") && !d["value"].is_null() ? num(d, "value") : mesureCote(c, d);
  std::string txt = texteCote(c, d, val);
  const std::string kind = chaine(d, "kind");
  const std::string L = "mepDimL", LX = "mepDimL mepDimX", T = std::string("mepDimT") + (vrai(d, "ref") ? " mepDimRef" : "");
  const char* AR = "url(#mepArr)";
  const char* ARS = "url(#mepArrS)";
  const auto trait = [&](double a, double b, double e, double f, const std::string& cls = "") { return c.mk("line").n("x1", a).n("y1", b).n("x2", e).n("y2", f).s("class", cls.empty() ? L : cls); };
  if (kind == "ord") {
    dessinerOrdonnees(c, d, LX, T);
    return;
  }
  if (kind == "note") txt = !chaine(d, "txt").empty() ? chaine(d, "txt") : "Texte";
  const J& A = sous(d, "a");
  if (kind == "hole" || kind == "note") {
    if (kind == "hole" && vrai(d, "holeFid"))
      if (const Trou* f = trouDe(c, chaine(d, "holeFid"))) {
        DT t0 = dtDe(d);
        d["holeText"] = texteTrou(*f, precCote(c, t0));
        const std::string fam = familleTrou(c, *f);
        const int hn = chaine(sous(A, "hint"), "t") == "seg" ? totalFamille(c, fam) : nombreDeTrous(c, *w.v1, fam);
        if (hn > 0) d["holeN"] = hn;
        const std::string ht0 = chaine(d, "holeText");
        const double n0 = num(d, "holeN");
        txt = !chaine(d, "txt").empty() ? chaine(d, "txt") : ((n0 > 1 ? js::texte(n0) + "× " : std::string()) + ht0);
      }
    const J ht = kind == "hole" && !vrai(d, "txt") ? tolDeTrou(c, d) : J();
    if (!ht.is_null()) txt = texteTolTrou(c, txt, ht);
    const auto e = entiteDeHint(c, *w.v1, sous(A, "hint"));
    double cx = w.a.x, cy = w.a.y, rr = 0;
    const double sc = num(*w.v1, "scale");
    if (e && (e->t == 'C' || e->t == 'A')) {
      const XY cS = versFeuille(*w.v1, e->cx, e->cy);
      rr = e->r * sc, cx = cS.x, cy = cS.y;
    } else if (kind == "hole" && e && e->t == 'L') {
      const XY p = versFeuille(*w.v1, e->x1, e->y1), q = versFeuille(*w.v1, e->x2, e->y2);
      const double dx = q.x - p.x, dy = q.y - p.y, l2 = dx * dx + dy * dy;
      const double k = l2 > 1e-12 ? std::max(0.0, std::min(1.0, ((cx - p.x) * dx + (cy - p.y) * dy) / l2)) : 0;
      cx = p.x + dx * k, cy = p.y + dy * k;
    }
    // mepHoleCallout
    const double px = w.b.x, py = w.b.y;
    double ux = px - cx, uy = py - cy, ul = hyp(ux, uy);
    if (ul < 1e-6) ux = 1, uy = 0, ul = 1;
    ux /= ul, uy /= ul;
    double ang = std::atan2(uy, ux);
    if (e && e->t == 'A') {  // mepHoleArcAng
      std::vector<const Ent*> same;
      for (const Ent& o : geoDe(c, *w.v1).els)
        if ((o.t == 'C' || o.t == 'A') && hyp(o.cx - e->cx, o.cy - e->cy) < 0.05 && std::abs(o.r - e->r) < 0.05) same.push_back(&o);
      const bool dedans = std::any_of(same.begin(), same.end(), [&](const Ent* o) { return o->t == 'C' || arcContient(*o, ang); });
      if (!dedans) {
        const auto ecart = [&](double a) {
          const double q = std::fmod(std::abs(a - ang), 2 * PI);
          return std::min(q, 2 * PI - q);
        };
        double best = ang, bd = 1e300;
        for (const Ent* o : same)
          for (double a : {o->a0, o->a1}) {
            const double q = ecart(a);
            if (q < bd) bd = q, best = a;
          }
        ang = best;
      }
    }
    const double ex = cx + rr * std::cos(ang), ey = cy + rr * std::sin(ang);
    std::vector<std::string> lignes;
    {
      size_t a = 0, b;
      while ((b = txt.find('\n', a)) != std::string::npos) {
        lignes.push_back(txt.substr(a, b - a));
        a = b + 1;
      }
      lignes.push_back(txt.substr(a));
    }
    const double fs = c.st.textHeight, h = c.st.dimH, lh = fs * 1.2;
    const size_t n = lignes.size();
    const double mid = py + h * 0.4, y0 = mid - (static_cast<double>(n) - 1) * lh / 2;
    const std::string anchor = ux < 0 ? "end" : "start";
    double tw0 = h;
    for (const std::string& s : lignes) tw0 = std::max(tw0, mesureTexte(marquesTolerance(s), fs));
    const double u00 = anchor == "end" ? px - tw0 : px, u10 = anchor == "end" ? px : px + tw0;
    const double lineY = y0 + (static_cast<double>(n) - 1) * lh + decaleSous(h);
    trait(px, lineY, ex, ey).s("marker-end", AR);
    c.mk("text").n("x", px).n("y", y0).s("text-anchor", anchor).s("class", T);
    double twM = 0;
    const double th = fs, gap = ecartPile(c);
    for (size_t k = 0; k < n; k++) {
      const std::string& s = lignes[k];
      if (const auto sm = chercherPile(s)) {
        const double yy = y0 + static_cast<double>(k) * lh;
        std::string bef = s.substr(0, sm->debut), aft = s.substr(sm->fin);
        while (!bef.empty() && std::isspace(static_cast<unsigned char>(bef.back()))) bef.pop_back();
        while (!aft.empty() && std::isspace(static_cast<unsigned char>(aft.front()))) aft.erase(aft.begin());
        const double w0x = mesureTexte(bef, th), ws = largeurPile(c, sm->up, sm->lo, sm->par, "");
        const double w2 = !aft.empty() ? mesureTexte(aft, th) : 0;
        const double tot = w0x + gap + ws + (!aft.empty() ? gap + w2 : 0), x0 = anchor == "end" ? px - tot : px;
        c.mk("text").n("x", x0).n("y", yy).s("text-anchor", "start").s("class", T).t(bef);
        if (!aft.empty()) c.mk("text").n("x", x0 + w0x + gap + ws + gap).n("y", yy).s("text-anchor", "start").s("class", T).t(aft);
        dessinerPile(c, T, x0 + w0x + gap, yy, sm->up, sm->lo, "", sm->par, "");
        twM = std::max(twM, tot);
        continue;
      }
      Elt& ts = c.mk("tspan").n("x", px).n("y", y0 + static_cast<double>(k) * lh).e;
      ts.niveau = 1;
      if (s.find('\x01') == std::string::npos) {
        ts.txt = s;
        twM = std::max(twM, mesureTexte(s, th));
        continue;
      }
      double largeurLigne = 0;
      size_t i = 0;
      while (i < s.size()) {
        const size_t a = s.find('\x01', i);
        if (a != i) {
          const std::string seg = s.substr(i, a == std::string::npos ? std::string::npos : a - i);
          Elt& q = c.mk("tspan").t(seg).e;
          q.niveau = 2;
          largeurLigne += largeur(seg, th);
          if (a == std::string::npos) break;
        }
        const size_t b = s.find('\x02', a);
        const std::string seg = marquesTolerance(s.substr(a, b == std::string::npos ? std::string::npos : b - a + 1));
        Elt& q = c.mk("tspan").s("font-size", tx(sousH(th))).t(seg).e;
        q.niveau = 2;
        largeurLigne += largeur(seg, sousH(th));
        if (b == std::string::npos) break;
        i = b + 1;
      }
      twM = std::max(twM, largeurLigne > 0 ? largeurLigne : longueurCar(s) * th * 0.6);
    }
    const double u0 = twM > 0 ? (anchor == "end" ? px - twM : px) : u00, u1 = twM > 0 ? (anchor == "end" ? px : px + twM) : u10;
    trait(u0, lineY, u1, lineY);
    return;
  }
  if (kind == "dia" || kind == "rad") {
    const auto e = entiteDeHint(c, *w.v1, sous(A, "hint"));
    double cx = w.a.x, cy = w.a.y, rr = 0;
    if (e && (e->t == 'C' || e->t == 'A')) {
      const XY cS = versFeuille(*w.v1, e->cx, e->cy);
      rr = e->r * num(*w.v1, "scale"), cx = cS.x, cy = cS.y;
    }
    const double px = w.b.x, py = w.b.y;
    double ux = px - cx, uy = py - cy, ul = hyp(ux, uy);
    if (ul < 1e-6) ux = 1, uy = 0, ul = 1;
    ux /= ul, uy /= ul;
    double ang = std::atan2(uy, ux);
    if (e && e->t == 'A') {
      const double lo = std::min(e->a0, e->a1), hi = std::max(e->a0, e->a1);
      double an = ang;
      while (an < lo) an += 2 * PI;
      while (an - 2 * PI >= lo) an -= 2 * PI;
      if (an > hi) ang = std::abs(ang - e->a0) < std::abs(ang - e->a1) ? e->a0 : e->a1;
      else ang = an;
    }
    const double ex = cx + rr * std::cos(ang), ey = cy + rr * std::sin(ang);
    const Parts pp = partiesSymbole(c, dtDe(d), val, kind == "dia" ? "Ø" : "R");
    const double fs = c.st.textHeight, hh = c.st.dimH, uOff = decaleSous(hh);
    const double tx0 = px, ty = py + hh * 0.4;
    trait(tx0, ty + uOff, ex, ey).s("marker-end", AR);
    if (kind == "dia") {
      const double lg = std::min(c.st.leaderGap, rr * 0.45);
      trait(ex - ux * lg, ey - uy * lg, cx - rr * std::cos(ang), cy - rr * std::sin(ang)).s("marker-end", ARS);
    }
    double tw = dessinerTexte(c, T, pp.main, pp, tx0, ty, ux < 0 ? "end" : "start", "");
    if (tw <= 0) tw = longueurCar(pp.main + (!pp.sym.empty() ? " " + pp.sym : "")) * fs * 0.6;
    if (!pp.up.empty() || !pp.lo.empty()) tw += ecartPile(c) + largeurPile(c, pp.up, pp.lo, pp.par, pp.post);
    tw = std::max(hh, tw);
    const double u0 = ux < 0 ? tx0 - tw : tx0, u1 = ux < 0 ? tx0 : tx0 + tw;
    trait(u0, ty + uOff, u1, ty + uOff);
    return;
  }
  if (kind == "ang") {
    const auto g = geoAngle(c, d);
    if (!g) return;
    const XY O = g->O;
    const double r = rayonAngle(d), aa = g->a1, bb = g->a2, dd = g->dd;
    const int sweep = dd > 0 ? 1 : 0, large = std::abs(dd) > PI ? 1 : 0;
    const double x1 = O.x + r * std::cos(aa), y1 = O.y + r * std::sin(aa), x2 = O.x + r * std::cos(bb), y2 = O.y + r * std::sin(bb);
    if (g->aExt) {
      const auto rappel = [&](double a, const std::array<double, 2>& ex) {
        const double ux = std::cos(a), uy = std::sin(a), gap = c.st.gap, ov = c.st.overrun;
        bool ok = false;
        double s0 = 0, s1 = 0;
        if (r > ex[1] + 0.05) s0 = ex[1] + gap, s1 = r + ov, ok = true;
        else if (r < ex[0] - 0.05) s0 = ex[0] - gap, s1 = r - ov, ok = true;
        if (ok && std::abs(s1 - s0) > 0.2) trait(O.x + ux * s0, O.y + uy * s0, O.x + ux * s1, O.y + uy * s1, LX);
      };
      rappel(aa, g->e1);
      rappel(bb, g->e2);
    }
    c.mk("path").s("d", "M" + tx(x1) + "," + tx(y1) + " A" + tx(r) + "," + tx(r) + " 0 " + std::to_string(large) + " " + std::to_string(sweep) + " " + tx(x2) + "," + tx(y2)).s("marker-start", ARS).s("marker-end", AR).s("class", L);
    // mepAngTextPos
    const double t = aa + dd / 2 + num(d, "txtOff") / r;
    double lo0, hi0;
    etendueTexte(c, d, val, lo0, hi0);
    const double hw = std::max(-lo0, hi0), H = c.st.dimH, hh = H / 2;
    const double nx = std::cos(t), ny = std::sin(t), k = r + 1.2 + std::abs(nx) * hw + std::abs(ny) * hh;
    const double bx = O.x + nx * k, by = O.y + ny * k + hh;
    const double lo = std::min(aa, aa + dd), hi = std::max(aa, aa + dd);
    if (t < lo || t > hi) {
      const double e0 = t < lo ? lo : hi, e1 = t;
      const int ne = std::max(4, static_cast<int>(std::ceil(std::abs(e1 - e0) * r / 2)));
      for (int q = 0; q < ne; q++) {
        const double t0 = e0 + (e1 - e0) * q / ne, t1 = e0 + (e1 - e0) * (q + 1) / ne;
        trait(O.x + r * std::cos(t0), O.y + r * std::sin(t0), O.x + r * std::cos(t1), O.y + r * std::sin(t1));
      }
    }
    const Parts pp = partiesTexte(c, dtDe(d), val);
    dessinerTexte(c, T, pp.main, pp, bx, by, "middle", "");
    return;
  }
  // len, dist
  if (kind != "len" && kind != "dist") return;
  const auto g0 = ligneCote(c, d, w);
  if (!g0) return;
  const LigneCote& g = *g0;
  if (hyp(g.ea.x - g.sa.x, g.ea.y - g.sa.y) > 1e-6) trait(g.sa.x, g.sa.y, g.ea.x, g.ea.y, LX);
  if (hyp(g.eb.x - g.sb.x, g.eb.y - g.sb.y) > 1e-6) trait(g.sb.x, g.sb.y, g.eb.x, g.eb.y, LX);
  prolongementsIntersection(c, LX, *w.v1, sous(d, "a"));
  if (vrai(d, "b")) prolongementsIntersection(c, LX, w.v2 ? *w.v2 : *w.v1, d["b"]);
  if (chaine(d, "arr") == "out") {
    const double ext = std::max(2.0, c.st.arrowLen);
    trait(g.a1.x - g.ux * ext, g.a1.y - g.uy * ext, g.a1.x, g.a1.y).s("marker-end", AR);
    trait(g.b1.x, g.b1.y, g.b1.x + g.ux * ext, g.b1.y + g.uy * ext).s("marker-start", ARS);
    trait(g.a1.x, g.a1.y, g.b1.x, g.b1.y);
  } else {
    trait(g.a1.x, g.a1.y, g.b1.x, g.b1.y).s("marker-start", ARS).s("marker-end", AR);
  }
  // mepDimLineExtent
  const double half = g.L / 2, toff = num(d, "txtOff");
  double start = -half, end = half;
  if (std::abs(toff) >= 1e-9) {
    double slo, shi;
    etendueTexte(c, d, val, slo, shi);
    const double a0 = std::atan2(g.dy, g.dx) * 180 / PI;
    const bool vert = std::abs(g.ux) < 1e-6;
    const int k = vert ? (g.uy > 0 ? -1 : 1) : ((a0 > 90 || a0 < -90) ? -1 : 1);
    if (k < 0) {
      const double q = slo;
      slo = -shi, shi = -q;
    }
    start = std::min(-half, toff + slo), end = std::max(half, toff + shi);
  }
  const double midX = (g.a1.x + g.b1.x) / 2, midY = (g.a1.y + g.b1.y) / 2;
  if (end > half + 1e-9) trait(g.b1.x, g.b1.y, midX + g.ux * end, midY + g.uy * end);
  if (start < -half - 1e-9) trait(midX + g.ux * start, midY + g.uy * start, g.a1.x, g.a1.y);
  // mepDimTextAnchorPos
  const double th = c.st.textHeight;
  const bool vertical = std::abs(g.ux) < 1e-6;
  double mx = midX + g.ux * toff, my = midY + g.uy * toff;
  const J& tl = sous(d, "tol");
  const std::string mt = chaine(tl, "m");
  const bool aPile = !vrai(d, "txt") && vrai(d, "tol") && (mt == "dbl" || (mt == "cls" && vrai(tl, "cls") && chaine(tl, "cls").find('/') == std::string::npos));
  if (vertical) mx -= std::max(2.0, th * 0.28);
  else if (aPile) my -= hauteurLigneTol(c);
  else my -= 2;
  double ang = std::atan2(g.dy, g.dx) * 180 / PI;
  bool flip = ang > 90 || ang < -90;
  if (vertical) ang = -90, flip = false;
  const std::string tr = "rotate(" + tx(flip ? ang + 180 : ang) + " " + tx(mx) + " " + tx(my) + ")";
  const Parts pp = partiesTexte(c, dtDe(d), val);
  const std::string main = vrai(d, "ref") ? "(" + pp.main + ")" : pp.main;
  dessinerTexte(c, T, main, pp, mx, my, "middle", tr);
}

// ---- Les gestes ----
void ceQuiSaisitLaCote(Ctx& c, J& d, CoteVue& q) {  // mepDimTextPos, mepDimArrowAt
  const auto w = mondeCote(c, d);
  if (!w) return;
  const std::string kind = chaine(d, "kind");
  if (kind == "dia" || kind == "rad" || kind == "hole" || kind == "note") {
    q.aTexte = true, q.tx = w->b.x, q.ty = w->b.y;
    return;
  }
  if (kind == "ord") {
    const J* v = vueDe(c.sh, chaine(d, "vid"));
    const XY o = v ? versFeuille(*v, num(sous(d, "o"), "x"), num(sous(d, "o"), "y")) : w->a;
    q.aTexte = true;
    if (chaine(d, "axis") == "y") q.tx = o.x + num(d, "off"), q.ty = o.y;
    else q.tx = o.x, q.ty = o.y + num(d, "off");
    return;
  }
  if (kind == "ang") {
    q.aTexte = true, q.tx = w->b.x, q.ty = w->b.y;
    if (const auto g = geoAngle(c, d)) {
      const double r = rayonAngle(d), t = g->a1 + g->dd / 2 + num(d, "txtOff") / r;
      const double val = d.contains("value") && !d["value"].is_null() ? num(d, "value") : mesureCote(c, d);
      double lo, hi;
      etendueTexte(c, d, val, lo, hi);
      const double hw = std::max(-lo, hi), hh = c.st.dimH / 2, nx = std::cos(t), ny = std::sin(t);
      const double k = r + 1.2 + std::abs(nx) * hw + std::abs(ny) * hh;
      q.tx = g->O.x + nx * k, q.ty = g->O.y + ny * k;
    }
    return;
  }
  const auto g = ligneCote(c, d, *w);
  if (!g) {
    q.aTexte = true, q.tx = w->a.x, q.ty = w->a.y;
    return;
  }
  q.aFleches = true, q.fx1 = g->a1.x, q.fy1 = g->a1.y, q.fx2 = g->b1.x, q.fy2 = g->b1.y;
  const double toff = num(d, "txtOff"), th = c.st.textHeight;
  q.aTexte = true;
  q.tx = (g->a1.x + g->b1.x) / 2 + g->ux * toff, q.ty = (g->a1.y + g->b1.y) / 2 + g->uy * toff;
  if (std::abs(g->ux) < 1e-6) q.tx -= std::max(2.0, th * 0.28);
  else q.ty -= 2;
}
GesteCote saisirCoteDans(Ctx& c, J& d, double x, double y, double zoom) {  // mepDimDragStart
  GesteCote g;
  g.sx = x, g.sy = y;
  g.aOff0 = d.contains("off") && !d["off"].is_null();
  g.off0 = num(d, "off");
  g.txtOff0 = num(d, "txtOff");
  const auto w = mondeCote(c, d);
  if (w) g.aCentre = true, g.cx = w->b.x, g.cy = w->b.y;
  CoteVue q;
  ceQuiSaisitLaCote(c, d, q);
  g.labelHit = q.aTexte && std::hypot(x - q.tx, y - q.ty) <= 18 / zoom;
  if (chaine(d, "kind") == "ang") {
    const double val = d.contains("value") && !d["value"].is_null() ? num(d, "value") : mesureCote(c, d);
    double lo, hi;
    etendueTexte(c, d, val, lo, hi);
    const double hw = std::max(-lo, hi), hh = c.st.dimH / 2, m = 1.5 / zoom;
    g.labelHit = q.aTexte && std::abs(x - q.tx) <= hw + m && std::abs(y - q.ty) <= hh + m;
  }
  return g;
}
namespace {
double decalageDepuisPoints(double ax, double ay, double bx, double by, const std::string& o, double x, double y) {  // mepDimOffsetFromPts
  if (o == "h") return y - (ay + by) / 2;
  if (o == "v") return x - (ax + bx) / 2;
  const double dx = bx - ax, dy = by - ay;
  double L = hyp(dx, dy);
  if (L == 0) L = 1;
  return (x - ax) * (-dy / L) + (y - ay) * (dx / L);
}
int secteurVers(double b1, double b2, double phi) {  // mepAngSectorAt
  for (int q = 0; q < 4; q++) {
    const double s1 = b1 + ((q & 1) ? PI : 0), s2 = b2 + ((q & 2) ? PI : 0);
    double dd = s2 - s1;
    while (dd <= -PI) dd += 2 * PI;
    while (dd > PI) dd -= 2 * PI;
    double t = (phi - s1) * (dd >= 0 ? 1 : -1);
    t = std::fmod(std::fmod(t, 2 * PI) + 2 * PI, 2 * PI);
    if (t <= std::abs(dd) + 1e-9) return q;
  }
  return 0;
}
}  // namespace
bool deplacerCoteDans(Ctx& c, J& d, double x, double y, const GesteCote& pk) {  // mepDimMoveTo
  const auto w = mondeCote(c, d);
  if (!w) return false;
  const std::string kind = chaine(d, "kind");
  if (kind == "len" || kind == "dist") {
    if (!vrai(d, "b")) return false;
    const std::string o = chaine(d, "orient", "a");
    // Le geste déplace la cote le long des rappels (décalage) et le long de sa ligne (valeur), en relatif
    if (pk.aOff0) {
      const auto offAt = [&](double qx, double qy) {
        if (o == "h" || o == "v") return decalageDepuisPoints(w->a.x, w->a.y, w->b.x, w->b.y, o, qx, qy);
        const double dx = w->b.x - w->a.x, dy = w->b.y - w->a.y, L = hyp(dx, dy);
        return L < 1e-9 ? 0.0 : (qx - w->a.x) * (-dy / L) + (qy - w->a.y) * (dx / L);
      };
      d["off"] = pk.off0 + offAt(x, y) - offAt(pk.sx, pk.sy);
      if (const auto w2 = mondeCote(c, d))
        if (const auto g = ligneCote(c, d, *w2)) {
          double to = pk.txtOff0 + (x - pk.sx) * g->ux + (y - pk.sy) * g->uy;
          // mepDimTxtOffSnap : entre les flèches ici comme au centre, le texte revient au centre
          if (g->L != 0) {
            const double value = d.contains("value") && !d["value"].is_null() ? num(d, "value") : mesureCote(c, d);
            double lo, hi;
            etendueTexte(c, d, value, lo, hi);
            const double ang = std::atan2(g->dy, g->dx) * 180 / PI;
            const int k = std::abs(g->ux) < 1e-6 ? (g->uy > 0 ? -1 : 1) : ((ang > 90 || ang < -90) ? -1 : 1);
            if (k < 0) {
              const double l0 = lo;
              lo = -hi, hi = -l0;
            }
            const double half = g->L / 2;
            const auto tient = [&](double q) { return q + lo >= -half - 1e-9 && q + hi <= half + 1e-9; };
            if (tient(to) && tient(0)) to = 0;
          }
          d["txtOff"] = to;
        }
      return true;
    }
    d["off"] = decalageDepuisPoints(w->a.x, w->a.y, w->b.x, w->b.y, o, x, y);
    return true;
  }
  if (kind == "ang") {
    auto g = geoAngle(c, d);
    if (!g) return false;
    if (pk.labelHit) {
      const double r = rayonAngle(d);
      const auto ang = [&](double qx, double qy) { return std::atan2(qy - g->O.y, qx - g->O.x); };
      double da = ang(x, y) - ang(pk.sx, pk.sy);
      while (da > PI) da -= 2 * PI;
      while (da <= -PI) da += 2 * PI;
      double to = pk.txtOff0 + da * r;
      if (std::abs(to) < 3) to = 0;
      if (to != 0) d["txtOff"] = js::arrondi(to, 3);
      else d.erase("txtOff");
      return true;
    }
    if (hyp(x - g->O.x, y - g->O.y) > 1e-6) {
      const int q = secteurVers(g->b1, g->b2, std::atan2(y - g->O.y, x - g->O.x)) ^ (vrai(d, "big") ? 3 : 0);
      if (q != (static_cast<int>(num(d, "q")) & 3)) {
        if (q) d["q"] = q;
        else d.erase("q");
        if (auto g2 = geoAngle(c, d)) g = g2;
      }
    }
    d["off"] = std::max(6.0, std::min(80.0, hyp(x - g->O.x, y - g->O.y)));
    return true;
  }
  J* v = vueParId(c.sh, chaine(d, "vid"));
  if (!v) return false;
  double sx = x, sy = y;
  if (pk.aCentre) sx = pk.cx + (x - pk.sx), sy = pk.cy + (y - pk.sy);
  if (kind == "dia" || kind == "rad" || kind == "hole" || kind == "note") {
    J b = J::object();
    b["x"] = (sx - num(*v, "x")) / num(*v, "scale");
    b["y"] = (sy - num(*v, "y")) / num(*v, "scale");
    d["b"] = b;
    return true;
  }
  if (kind == "ord" && pk.aOff0) {
    d["off"] = pk.off0 + (chaine(d, "axis") == "y" ? x - pk.sx : y - pk.sy);
    return true;
  }
  return false;
}
void inverserFleches(J& d) {  // mepDimToggleArrows
  d["arr"] = chaine(d, "arr") != "out" ? "out" : "in";
}
void inverserAngleDans(Ctx& c, J& d) {  // mepDimToggleBig : l'arc garde le même côté
  (void)c;
  const int q = static_cast<int>(num(d, "q")) & 3;
  const int q2 = q ^ 3;
  if (q2) d["q"] = q2;
  else d.erase("q");
  if (vrai(d, "big")) d.erase("big");
  else d["big"] = true;
}

// ---- La ligne de coupe ----
namespace {
struct ModeleCoupe {  // mepCutModel
  double tx = 0, ty = 0, nx = 0, ny = 0, s0 = 0, sE = 0;
  std::vector<double> c, steps;
  std::vector<J> refs;
};
std::vector<XY> pointsCoupe(const J& v) {  // mepCutPts
  const J& s = sous(v, "section");
  std::vector<XY> P;
  if (sous(s, "pts").is_array() && s["pts"].size() > 2) {
    for (const J& q : s["pts"]) P.push_back({nv(q[0]), nv(q[1])});
    return P;
  }
  if (!sous(s, "a").is_array() || !sous(s, "b").is_array()) return P;
  P.push_back({nv(s["a"][0]), nv(s["a"][1])});
  P.push_back({nv(s["b"][0]), nv(s["b"][1])});
  return P;
}
std::optional<ModeleCoupe> modeleCoupe(const J& v) {
  const std::vector<XY> P = pointsCoupe(v);
  if (P.size() < 2) return std::nullopt;
  const double tl = hyp(P[1].x - P[0].x, P[1].y - P[0].y);
  if (tl < 1e-9) return std::nullopt;
  ModeleCoupe M;
  M.tx = (P[1].x - P[0].x) / tl, M.ty = (P[1].y - P[0].y) / tl;
  M.nx = -M.ty, M.ny = M.tx;
  const auto S = [&](const XY& q) { return q.x * M.tx + q.y * M.ty; };
  const auto C = [&](const XY& q) { return q.x * M.nx + q.y * M.ny; };
  for (size_t j = 0; j + 1 < P.size(); j += 2) M.c.push_back(C(P[j]));
  for (size_t j = 1; j + 1 < P.size(); j += 2) M.steps.push_back(S(P[j]));
  M.s0 = S(P[0]), M.sE = S(P.back());
  const J& refs = sous(sous(v, "section"), "refs");
  if (refs.is_array())
    for (size_t i = 0; i < refs.size() && i < M.c.size(); i++) M.refs.push_back(refs[i]);
  while (M.refs.size() < M.c.size()) M.refs.push_back(J());
  return M;
}
void coupeDepuisModele(J& sh, J& v, const ModeleCoupe& M) {  // mepCutFromModel, mepCutSetPts
  J& s = v["section"];
  const J* par = vueDe(sh, chaine(s, "pid"));
  if (!par) return;
  const auto Q = [&](double sv, double cv) { return XY{M.tx * sv + M.nx * cv, M.ty * sv + M.ny * cv}; };
  std::vector<XY> P{Q(M.s0, M.c[0])};
  for (size_t k = 0; k < M.steps.size(); k++) {
    P.push_back(Q(M.steps[k], M.c[k]));
    P.push_back(Q(M.steps[k], M.c[k + 1]));
  }
  P.push_back(Q(M.sE, M.c.back()));
  const auto r4 = [](const XY& q) {
    J a = J::array();
    a.push_back(js::arrondi(q.x, 4));
    a.push_back(js::arrondi(q.y, 4));
    return a;
  };
  s["a"] = r4(P[0]);
  s["b"] = r4(P[1]);
  if (P.size() > 2) {
    J pts = J::array();
    for (const XY& q : P) pts.push_back(r4(q));
    s["pts"] = pts;
  } else {
    s.erase("pts");
  }
  const Base pb = baseDe(*par);
  const double x = nv(s["a"][0]), y = nv(s["a"][1]);
  J p3 = J::array();
  p3.push_back(pb.u[0] * x + pb.v[0] * y);
  p3.push_back(pb.u[1] * x + pb.v[1] * y);
  p3.push_back(pb.u[2] * x + pb.v[2] * y);
  s["p"] = p3;
  bool lien = false;
  J refs = J::array();
  for (const J& r : M.refs) {
    refs.push_back(r);
    if (!r.is_null()) lien = true;
  }
  if (lien) s["refs"] = refs;
  else s.erase("refs");
}
struct CandidatCoupe {
  J ref;
  double c = 0, s = 0;
};
std::vector<CandidatCoupe> candidatsCoupe(Ctx& c, J& par, const ModeleCoupe& M) {  // mepCutCands
  std::vector<CandidatCoupe> out;
  const Base b = baseDe(par);
  const V3 n3{b.u[0] * M.nx + b.v[0] * M.ny, b.u[1] * M.nx + b.v[1] * M.ny, b.u[2] * M.nx + b.v[2] * M.ny};
  for (const Trou& f : c.piece.trous) {
    if (!f.visible || std::abs(dot(f.dir, n3)) > 1e-3) continue;
    for (const PointTrou& P : f.pts) {
      const V3& w = P.p;
      const double lx = dot(w, b.u), ly = dot(w, b.v);
      J r = J::object();
      r["t"] = "hole", r["fid"] = f.fid, r["pid"] = P.id;
      out.push_back({r, lx * M.nx + ly * M.ny, lx * M.tx + ly * M.ty});
    }
  }
  for (const Axe& e : lignesAxes(c, par)) {
    if (e.t != 'L' || e.ak.empty()) continue;
    const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, l = hyp(dx, dy) != 0 ? hyp(dx, dy) : 1;
    if (std::abs((dx * M.nx + dy * M.ny) / l) > 1e-3) continue;
    J r = J::object();
    r["t"] = "ax", r["ak"] = e.ak;
    out.push_back({r, e.x1 * M.nx + e.y1 * M.ny, 0});
  }
  for (const Ent& e : c.calc.geoDe(par, c.sh, c.mep, c.piece).els) {
    if (e.t != 'L') continue;
    const double dx = e.x2 - e.x1, dy = e.y2 - e.y1, l = hyp(dx, dy) != 0 ? hyp(dx, dy) : 1;
    if (std::abs((dx * M.nx + dy * M.ny) / l) > 1e-3) continue;
    const double cv = e.x1 * M.nx + e.y1 * M.ny;
    J r = J::object();
    r["t"] = "edge", r["c"] = js::arrondi(cv, 4);
    out.push_back({r, cv, 0});
  }
  return out;
}
// Les deux bouts : mepCutEnds
struct BoutCoupeE {
  int end = 0;
  XY M, tail, lbl;
  double ux = 0, uy = 0, L = 0;
};
std::vector<BoutCoupeE> boutsCoupe(Ctx& c, const J& v) {
  std::vector<BoutCoupeE> out;
  const J& sec = sous(v, "section");
  if (!vrai(sec, "a") || !vrai(sec, "pid")) return out;
  const J* par = vueDe(c.sh, chaine(sec, "pid"));
  if (!par) return out;
  const XY A = versFeuille(*par, nv(sec["a"][0]), nv(sec["a"][1])), B0 = versFeuille(*par, nv(sous(sec, "b")[0]), nv(sous(sec, "b")[1]));
  const double dx = B0.x - A.x, dy = B0.y - A.y, L = hyp(dx, dy) != 0 ? hyp(dx, dy) : 1, tx = dx / L, ty = dy / L;
  XY B = B0;
  if (sous(sec, "pts").is_array() && sec["pts"].size() > 2) B = versFeuille(*par, nv(sec["pts"].back()[0]), nv(sec["pts"].back()[1]));
  const Base pb = baseDe(*par);
  const V3 nd = vrai(sec, "n") ? v3(sec["n"]) : v3(sous(v, "dir"));
  double ax = -dot(nd, pb.u), ay = -dot(nd, pb.v);
  const double La = hyp(ax, ay);
  if (La < 1e-6) ax = -ty, ay = tx;
  else ax /= La, ay /= La;
  const double off = c.st.lblH / 2 + 1.6;
  const J& shf = sous(sec, "sh");
  for (int end = 0; end < 2; end++) {
    const XY Pp = end ? B : A;
    const double sg = end ? 1 : -1, s0 = shf.is_array() && static_cast<int>(shf.size()) > end ? nv(shf[end]) : 0, ux = tx * sg, uy = ty * sg;
    const XY Q{Pp.x + ux * s0, Pp.y + uy * s0}, M{Q.x - ux, Q.y - uy};
    BoutCoupeE E;
    E.end = end, E.M = M, E.ux = ux, E.uy = uy, E.L = L;
    E.tail = {M.x - ax * 10, M.y - ay * 10};
    E.lbl = {M.x - ax * 6 + ux * off, M.y - ay * 6 + uy * off};
    out.push_back(E);
  }
  return out;
}
}  // namespace
void suivreLiensCoupes(Ctx& c) {
  for (J& v : c.sh["views"]) {
    if (chaine(v, "kind") != "section" || !sous(sous(v, "section"), "refs").is_array()) continue;
    J* par = vueParId(c.sh, chaine(v["section"], "pid"));
    auto M = par ? modeleCoupe(v) : std::nullopt;
    if (!M) continue;
    bool ch = false;
    for (size_t m = 0; m < M->refs.size(); m++) {
      J& r = M->refs[m];
      if (!r.is_object()) continue;
      const std::string t = chaine(r, "t");
      std::optional<double> cv;
      const auto cands = candidatsCoupe(c, *par, *M);
      if (t == "edge") {
        double best = 5;
        for (const CandidatCoupe& q : cands)
          if (chaine(q.ref, "t") == "edge" && std::abs(q.c - num(r, "c")) < best) best = std::abs(q.c - num(r, "c")), cv = q.c;
      } else {
        for (const CandidatCoupe& q : cands)
          if (chaine(q.ref, "t") == t && (t == "ax" ? chaine(q.ref, "ak") == chaine(r, "ak") : chaine(q.ref, "fid") == chaine(r, "fid") && chaine(q.ref, "pid") == chaine(r, "pid"))) {
            cv = q.c;
            break;
          }
      }
      if (cv && std::abs(*cv - M->c[m]) > 1e-4) {
        M->c[m] = *cv;
        ch = true;
        if (t == "edge") r["c"] = js::arrondi(*cv, 4);
      }
    }
    if (ch) coupeDepuisModele(c.sh, v, *M);
  }
}
bool flecheCoupeSous(J& mep, int planche, const Piece& p, Calcul& calc, double px, double py, double zoom, GesteCoupe& g) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  const double tol = 2 / zoom + 0.6;
  J& vs = c.sh["views"];
  for (size_t k = vs.size(); k-- > 0;) {
    const J& v = vs[k];
    if (chaine(v, "kind") != "section" || !vrai(v, "section")) continue;
    for (const BoutCoupeE& E : boutsCoupe(c, v)) {
      const double vx = E.M.x - E.tail.x, vy = E.M.y - E.tail.y, l2 = vx * vx + vy * vy != 0 ? vx * vx + vy * vy : 1;
      const double t = std::max(0.0, std::min(1.0, ((px - E.tail.x) * vx + (py - E.tail.y) * vy) / l2));
      const double dS = hyp(px - (E.tail.x + vx * t), py - (E.tail.y + vy * t)), dL = hyp(px - E.lbl.x, py - E.lbl.y);
      if (dS <= tol || dL <= c.st.lblH * 0.8) {
        g.vue = chaine(v, "id"), g.bout = E.end, g.sx = px, g.sy = py;
        const J& shf = sous(v["section"], "sh");
        g.s0 = shf.is_array() && static_cast<int>(shf.size()) > E.end ? nv(shf[E.end]) : 0;
        return true;
      }
    }
  }
  return false;
}
bool tronconCoupeSous(J& mep, int planche, const Piece& p, Calcul& calc, double px, double py, double zoom, GesteCoupe& g) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  const double tol = 1.5 / zoom + 0.4;
  J& vs = c.sh["views"];
  for (size_t k = vs.size(); k-- > 0;) {
    const J& v = vs[k];
    if (chaine(v, "kind") != "section" || !vrai(v, "section") || !vrai(v["section"], "pid")) continue;
    const J* par = vueDe(c.sh, chaine(v["section"], "pid"));
    if (!par) continue;
    const std::vector<XY> L = pointsCoupe(v);
    for (size_t j = 0; j + 1 < L.size(); j++) {
      const XY a = versFeuille(*par, L[j].x, L[j].y), b = versFeuille(*par, L[j + 1].x, L[j + 1].y);
      const double vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy != 0 ? vx * vx + vy * vy : 1;
      const double t = std::max(0.0, std::min(1.0, ((px - a.x) * vx + (py - a.y) * vy) / l2));
      if (hyp(px - (a.x + vx * t), py - (a.y + vy * t)) <= tol) {
        g.vue = chaine(v, "id"), g.j = static_cast<int>(j), g.sx = px, g.sy = py;
        const auto M = modeleCoupe(v);
        const double sc = num(*par, "scale");
        g.sG = M ? (px - num(*par, "x")) / sc * M->tx + (py - num(*par, "y")) / sc * M->ty : 0;
        return true;
      }
    }
  }
  return false;
}
bool bougerFlecheCoupe(J& mep, int planche, const Piece& p, Calcul& calc, GesteCoupe& g, double x, double y) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  J* v = vueParId(c.sh, g.vue);
  if (!v) return false;
  const auto bs = boutsCoupe(c, *v);
  if (g.bout < 0 || g.bout >= static_cast<int>(bs.size())) return false;
  const BoutCoupeE& E = bs[g.bout];
  double sv = g.s0 + (x - g.sx) * E.ux + (y - g.sy) * E.uy;
  sv = std::floor(std::max(-(E.L / 2 - 6), std::min(150.0, sv)) * 2 + 0.5) / 2;
  J& sec = (*v)["section"];
  J shf = sec.contains("sh") && sec["sh"].is_array() ? sec["sh"] : J::array({0, 0});
  while (shf.size() < 2) shf.push_back(0);
  if (nv(shf[g.bout]) == sv) return false;
  shf[g.bout] = sv;
  sec["sh"] = shf;
  return true;
}
void bougerTroncon(J& mep, int planche, const Piece& p, Calcul& calc, GesteCoupe& g, double x, double y, double zoom) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  J* v = vueParId(c.sh, g.vue);
  J* par = v ? vueParId(c.sh, chaine((*v)["section"], "pid")) : nullptr;
  const auto M = par ? modeleCoupe(*v) : std::nullopt;
  if (!M) return;
  const double sc = num(*par, "scale"), lx = (x - num(*par, "x")) / sc, ly = (y - num(*par, "y")) / sc;
  if (g.j % 2) {  // marche : glisse le long du 1er tronçon, entre ses voisines
    const int k = (g.j - 1) / 2;
    const double lo = k ? M->steps[k - 1] : M->s0, hi = k == static_cast<int>(M->steps.size()) - 1 ? M->sE : M->steps[k + 1];
    double sv = lx * M->tx + ly * M->ty;
    const double a = std::min(lo, hi) + 0.5, b = std::max(lo, hi) - 0.5;
    sv = std::max(a, std::min(b, std::floor(sv * 2 + 0.5) / 2));
    g.prev = GesteCoupe::MARCHE, g.k = k, g.valeur = sv;
    return;
  }
  // plan : brisure au point saisi, le morceau suivant s'accroche au centre / à la ligne visé(e)
  const double cv = lx * M->nx + ly * M->ny, tol = 4 / zoom / sc;
  const CandidatCoupe* best = nullptr;
  double bd = 0;
  const auto cands = candidatsCoupe(c, *par, *M);
  for (const CandidatCoupe& q : cands) {
    const double d = std::abs(q.c - cv);
    if (d <= tol && (!best || d < bd || (d == bd && chaine(q.ref, "t") == "hole"))) best = &q, bd = d;
  }
  g.prev = g.brk ? GesteCoupe::BRISURE : GesteCoupe::PLAN;
  g.k = g.j / 2;
  g.valeur = best ? best->c : std::floor(cv * 2 + 0.5) / 2;
  g.ref = best ? best->ref : J();
}
namespace {
bool briserCoupe(J& sh, J& v, int m, double sG, double cNew, const J& ref) {  // mepCutBreakAt
  auto M = modeleCoupe(v);
  if (!M) return false;
  const double lo = m ? M->steps[m - 1] : M->s0, hi = m == static_cast<int>(M->c.size()) - 1 ? M->sE : M->steps[m];
  if ((sG - lo) * (hi - sG) <= 0 || std::abs(cNew - M->c[m]) < 1e-6) return false;
  M->steps.insert(M->steps.begin() + m, sG);
  M->c.insert(M->c.begin() + m + 1, cNew);
  M->refs.insert(M->refs.begin() + m + 1, ref);
  coupeDepuisModele(sh, v, *M);
  return true;
}
}  // namespace
bool lacherTroncon(J& mep, int planche, const Piece& p, Calcul& calc, GesteCoupe& g) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  J* v = vueParId(c.sh, g.vue);
  if (!v) return false;
  auto M = modeleCoupe(*v);
  if (!M) return false;
  if (g.prev == GesteCoupe::RIEN) {
    if (!g.brk || (g.j % 2)) return false;
    // Ctrl + clic sans tirer : le morceau après le curseur part d'un décalage par défaut (mepCutBreakClick)
    const J* par = vueDe(c.sh, chaine((*v)["section"], "pid"));
    if (!par) return false;
    const int m = g.j / 2;
    const double hi = m == static_cast<int>(M->c.size()) - 1 ? M->sE : M->steps[m];
    const double L = std::abs(hi - g.sG), dc = std::max(2.0, std::min(10 / num(*par, "scale"), L / 2));
    return briserCoupe(c.sh, *v, m, g.sG, M->c[m] + dc, J());
  }
  if (g.prev == GesteCoupe::MARCHE) M->steps[g.k] = g.valeur;
  else if (g.prev == GesteCoupe::PLAN) {
    M->c[g.k] = g.valeur;
    M->refs[g.k] = g.ref;
  } else {
    return briserCoupe(c.sh, *v, g.k, g.sG, g.valeur, g.ref);
  }
  coupeDepuisModele(c.sh, *v, *M);
  return true;
}
bool retirerBrisure(J& mep, int planche, const Piece& p, Calcul& calc, const GesteCoupe& g) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  J* v = vueParId(c.sh, g.vue);
  auto M = v ? modeleCoupe(*v) : std::nullopt;
  if (!M || M->steps.empty()) return false;
  int k;
  bool garderApres;
  if (g.j % 2) {
    k = (g.j - 1) / 2, garderApres = false;
  } else {
    const int m = g.j / 2, kb = m - 1, ka = m;
    const double db = kb >= 0 ? std::abs(M->steps[kb] - g.sG) : 1e300, da = ka < static_cast<int>(M->steps.size()) ? std::abs(M->steps[ka] - g.sG) : 1e300;
    if (db <= da) k = kb, garderApres = true;
    else k = ka, garderApres = false;
  }
  if (k < 0 || k >= static_cast<int>(M->steps.size())) return false;
  const int drop = garderApres ? k : k + 1;
  M->steps.erase(M->steps.begin() + k);
  M->c.erase(M->c.begin() + drop);
  M->refs.erase(M->refs.begin() + drop);
  coupeDepuisModele(c.sh, *v, *M);
  return true;
}

// ---- Pour le panneau ----
int nombreBrisures(const J& v) {
  const auto M = modeleCoupe(v);
  return M ? static_cast<int>(M->steps.size()) : 0;
}
std::pair<int, int> liensCoupe(const J& v) {
  const auto M = modeleCoupe(v);
  if (!M) return {0, 0};
  int n = 0;
  for (const J& r : M->refs)
    if (r.is_object()) n++;
  return {n, static_cast<int>(M->c.size())};
}
bool ajouterBrisure(J& mep, int planche, const Piece& p, Calcul& calc, const std::string& id) {  // mepCutAddBreak, mepCutAutoRefs
  Ctx c = contexteGeste(mep, planche, p, calc);
  J* v = vueParId(c.sh, id);
  auto M = v ? modeleCoupe(*v) : std::nullopt;
  if (!M) return false;
  const int m = static_cast<int>(M->c.size()) - 1;
  const double lo = m ? M->steps[m - 1] : M->s0, L = std::abs(M->sE - lo);
  if (L < 1e-6) return false;
  M->steps.push_back((lo + M->sE) / 2);
  M->c.push_back(M->c[m] + std::max(2.0, L / 4));
  M->refs.push_back(J());
  coupeDepuisModele(c.sh, *v, *M);
  liensAutoCoupe(c, *v);
  return true;
}
bool enleverBrisure(J& mep, int planche, const Piece& p, Calcul& calc, const std::string& id) {  // mepCutDelBreak
  Ctx c = contexteGeste(mep, planche, p, calc);
  J* v = vueParId(c.sh, id);
  auto M = v ? modeleCoupe(*v) : std::nullopt;
  if (!M || M->steps.empty()) return false;
  M->steps.pop_back();
  M->c.pop_back();
  M->refs.pop_back();
  coupeDepuisModele(c.sh, *v, *M);
  return true;
}
std::string texteLuDeCote(J& mep, int planche, const Piece& p, Calcul& calc, J& d) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  return texteCote(c, d, mesureCote(c, d));
}
double accrocherTexteCote(J& mep, int planche, const Piece& p, Calcul& calc, J& d, double v) {
  Ctx c = contexteGeste(mep, planche, p, calc);
  const auto w = mondeCote(c, d);
  const auto g = w ? ligneCote(c, d, *w) : std::nullopt;
  if (!g || g->L == 0) return v;
  const double value = d.contains("value") && !d["value"].is_null() ? num(d, "value") : mesureCote(c, d);
  double lo, hi;
  etendueTexte(c, d, value, lo, hi);
  const double ang = std::atan2(g->dy, g->dx) * 180 / PI;
  const int k = std::abs(g->ux) < 1e-6 ? (g->uy > 0 ? -1 : 1) : ((ang > 90 || ang < -90) ? -1 : 1);
  if (k < 0) {
    const double l0 = lo;
    lo = -hi, hi = -l0;
  }
  const double half = g->L / 2;
  const auto tient = [&](double q) { return q + lo >= -half - 1e-9 && q + hi <= half + 1e-9; };
  return tient(v) && tient(0) ? 0 : v;
}
std::string toleranceAuto(J& mep, int planche, const Piece& p, Calcul& calc, const J& d) {  // mepHoleAutoTol
  Ctx c = contexteGeste(mep, planche, p, calc);
  const Trou* f = trouDe(c, chaine(d, "holeFid"));
  return f && f->kind == "ream" ? f->tolAlesage : std::string();
}
void liensAutoCoupe(Ctx& c, J& v) {  // mepCutAutoRefs
  J* par = vueParId(c.sh, chaine(sous(v, "section"), "pid"));
  auto N = par ? modeleCoupe(v) : std::nullopt;
  if (!N) return;
  std::vector<CandidatCoupe> cands;
  bool lus = false;
  for (size_t k = 0; k < N->c.size(); k++) {
    if (N->refs[k].is_object()) continue;
    if (!lus) cands = candidatsCoupe(c, *par, *N), lus = true;
    const double cv = N->c[k], lo2 = k == 0 ? N->s0 : N->steps[k - 1], hi2 = k == N->c.size() - 1 ? N->sE : N->steps[k];
    const double a = std::min(lo2, hi2), b = std::max(lo2, hi2);
    const CandidatCoupe* pick = nullptr;
    const auto prendre = [&](const char* t, bool dansLeMorceau) {
      if (pick) return;
      for (const CandidatCoupe& q : cands)
        if (std::abs(q.c - cv) < 0.05 && chaine(q.ref, "t") == t && (!dansLeMorceau || (q.s >= a - 0.05 && q.s <= b + 0.05))) {
          pick = &q;
          return;
        }
    };
    prendre("hole", true);
    prendre("hole", false);
    prendre("ax", false);
    prendre("edge", false);
    if (pick) N->refs[k] = pick->ref;
  }
  coupeDepuisModele(c.sh, v, *N);
}
Accroche accrocher(Ctx& c, double sx, double sy, double zoom) {  // mepSnapPt
  Accroche best;
  best.x = sx, best.y = sy;
  double bd = 6 / zoom;
  const auto consider = [&](double x, double y, const char* t, const std::string& vid) {
    const double d = std::hypot(x - sx, y - sy);
    if (d < bd) bd = d, best.x = x, best.y = y, best.hit = true, best.t = t, best.vid = vid;
  };
  for (J& v : c.sh["views"]) {
    const std::string id = chaine(v, "id");
    const double vx = num(v, "x"), vy = num(v, "y"), s = num(v, "scale");
    for (const Ent& e : geoDe(c, v).els) {
      if (e.t == 'L') {
        const double ax = vx + e.x1 * s, ay = vy + e.y1 * s, bx = vx + e.x2 * s, by = vy + e.y2 * s;
        consider(ax, ay, "end", id);
        consider(bx, by, "end", id);
        consider(vx + (e.x1 + e.x2) / 2 * s, vy + (e.y1 + e.y2) / 2 * s, "mid", id);
        const double dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        if (L2 > 1e-12) {
          const double t = std::max(0.0, std::min(1.0, ((sx - ax) * dx + (sy - ay) * dy) / L2));
          consider(ax + dx * t, ay + dy * t, "onSeg", id);
        }
      } else if (e.t == 'C' || e.t == 'A') {
        const double cx = vx + e.cx * s, cy = vy + e.cy * s, r = e.r * s;
        consider(cx, cy, "ctr", id);
        const double a = std::atan2(sy - cy, sx - cx);
        if (e.t == 'C') {
          consider(cx + r * std::cos(a), cy + r * std::sin(a), "onC", id);
        } else {
          double aa = a;
          const double lo = std::min(e.a0, e.a1), hi = std::max(e.a0, e.a1);
          double an = a;
          while (an < lo) an += 2 * PI;
          while (an - 2 * PI >= lo) an -= 2 * PI;
          if (an > hi) aa = std::abs(a - e.a0) < std::abs(a - e.a1) ? e.a0 : e.a1;
          else aa = an;
          consider(cx + r * std::cos(aa), cy + r * std::sin(aa), "onC", id);
        }
      }
    }
  }
  for (J& v : c.sh["views"]) {
    const std::string id = chaine(v, "id");
    const double vx = num(v, "x"), vy = num(v, "y"), s = num(v, "scale");
    for (const Axe& p : lignesAxes(c, v)) {
      if (p.t == 'L') {
        const double ax = vx + p.x1 * s, ay = vy + p.y1 * s, bx = vx + p.x2 * s, by = vy + p.y2 * s;
        for (const auto& q : {std::array<double, 2>{ax, ay}, std::array<double, 2>{bx, by}}) {  // extrémités prioritaires
          const double d = std::hypot(q[0] - sx, q[1] - sy) * 0.6;
          if (d < bd) bd = d, best.x = q[0], best.y = q[1], best.hit = true, best.t = "axEnd", best.vid = id;
        }
        consider((ax + bx) / 2, (ay + by) / 2, "axMid", id);
        const double dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        if (L2 > 1e-12) {
          const double t = std::max(0.0, std::min(1.0, ((sx - ax) * dx + (sy - ay) * dy) / L2));
          consider(ax + dx * t, ay + dy * t, "onAx", id);
        }
      } else if (p.t == 'C') {
        const double cx = vx + p.cx * s, cy = vy + p.cy * s, r = p.r * s;
        consider(cx, cy, "ctr", id);
        const double a = std::atan2(sy - cy, sx - cx);
        consider(cx + r * std::cos(a), cy + r * std::sin(a), "onAx", id);
      }
    }
  }
  if (vrai(c.sh, "sk") && sous(c.sh["sk"], "pts").is_object()) {
    for (auto it = c.sh["sk"]["pts"].begin(); it != c.sh["sk"]["pts"].end(); ++it) consider(num(it.value(), "x"), num(it.value(), "y"), "skPt", "");
  }
  return best;
}
std::optional<EntTouchee> entiteSousCurseur(Ctx& c, double sx, double sy, double zoom, bool avecAxes) {  // mepHitViewEnt
  std::optional<EntTouchee> best;
  double bd = 4 / zoom;
  const auto trait = [](double lx, double ly, double x1, double y1, double x2, double y2) {
    const double dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
    const double t = L2 > 1e-12 ? std::max(0.0, std::min(1.0, ((lx - x1) * dx + (ly - y1) * dy) / L2)) : 0;
    return std::hypot(lx - (x1 + dx * t), ly - (y1 + dy * t));
  };
  if (avecAxes) {
    for (J& v : c.sh["views"]) {
      const double s = num(v, "scale"), lx = (sx - num(v, "x")) / s, ly = (sy - num(v, "y")) / s;
      for (const Axe& p : lignesAxes(c, v)) {
        double d;
        if (p.t == 'L') d = trait(lx, ly, p.x1, p.y1, p.x2, p.y2) * s;
        else if (p.t == 'C') d = std::abs(std::hypot(lx - p.cx, ly - p.cy) - p.r) * s;
        else continue;
        if (d < bd) {
          bd = d;
          EntTouchee o;
          o.vid = chaine(v, "id"), o.i = -1, o.lx = lx, o.ly = ly;
          o.e.t = p.t, o.e.x1 = p.x1, o.e.y1 = p.y1, o.e.x2 = p.x2, o.e.y2 = p.y2, o.e.cx = p.cx, o.e.cy = p.cy, o.e.r = p.r;
          best = o;
        }
      }
    }
    if (best) bd *= 1.001;  // à égalité, l'arête réelle l'emporte
  }
  for (J& v : c.sh["views"]) {
    const double s = num(v, "scale"), lx = (sx - num(v, "x")) / s, ly = (sy - num(v, "y")) / s;
    const std::vector<Ent>& els = geoDe(c, v).els;
    for (int i = 0; i < static_cast<int>(els.size()); i++) {
      const Ent& e = els[i];
      double d;
      if (e.t == 'L') {
        d = trait(lx, ly, e.x1, e.y1, e.x2, e.y2) * s;
      } else if (e.t == 'C') {
        d = std::abs(std::hypot(lx - e.cx, ly - e.cy) - e.r) * s;
      } else if (e.t == 'A') {
        const double dx = lx - e.cx, dy = ly - e.cy, dh = std::hypot(dx, dy), a = std::atan2(dy, dx);
        const double lo = std::min(e.a0, e.a1), hi = std::max(e.a0, e.a1);
        double an = a;
        while (an < lo) an += 2 * PI;
        while (an - 2 * PI >= lo) an -= 2 * PI;
        if (dh < 1e-9 || an > hi) d = std::min(std::hypot(lx - (e.cx + e.r * std::cos(e.a0)), ly - (e.cy + e.r * std::sin(e.a0))), std::hypot(lx - (e.cx + e.r * std::cos(e.a1)), ly - (e.cy + e.r * std::sin(e.a1)))) * s;
        else d = std::abs(dh - e.r) * s;
      } else {
        continue;
      }
      if (d < bd) {
        bd = d;
        EntTouchee o;
        o.vid = chaine(v, "id"), o.i = i, o.e = e, o.lx = lx, o.ly = ly;
        best = o;
      }
    }
  }
  return best;
}
}  // namespace plan
