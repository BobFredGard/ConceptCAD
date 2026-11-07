// La mise en plan : planches, nouvelles vues et leurs commandes à la souris
// (src/98-mep-20-vues.js, 98-mep-30-planches-cartouche.js, 98-mep-50-vues-interactives.js).
#include <windows.h>

#include <BRepBndLib.hxx>
#include <Bnd_Box.hxx>

#include <algorithm>
#include <cmath>
#include <ctime>
#include <map>
#include <optional>

#include "plan_interne.h"

namespace plan {
namespace {
const std::vector<std::pair<double, std::string>> ECHELLES = {{1, "1:1"}, {2, "2:1"}, {5, "5:1"}, {0.5, "1:2"}, {0.2, "1:5"}, {2.5, "5:2"}, {0.25, "1:4"}, {0.1, "1:10"}, {1.25, "5:4"}, {0.4, "2:5"}, {0.75, "3:4"}};
J jv(const V3& a) { return J::array({a[0], a[1], a[2]}); }
XY depuis(const J& v, double x, double y) {  // mepFromSheet
  const double s = num(v, "scale");
  return {(x - num(v, "x")) / s, (y - num(v, "y")) / s};
}
XY vers(const J& v, double x, double y) { return {num(v, "x") + x * num(v, "scale"), num(v, "y") + y * num(v, "scale")}; }  // mepToSheet
std::string base36(unsigned long long n) {
  std::string s;
  do {
    s.insert(s.begin(), "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36]);
    n /= 36;
  } while (n);
  return s;
}
std::string dateFr() {
  const std::time_t t = std::time(nullptr);
  std::tm m{};
  localtime_s(&m, &t);
  char b[16];
  std::strftime(b, sizeof b, "%d/%m/%Y", &m);
  return b;
}
J* vueCmd(J& sh, const std::string& id) { return vueParId(sh, id); }
bool boiteGeo(const Geo& g, double& minx, double& miny, double& maxx, double& maxy) {  // mepAABBOf
  minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  bool any = false;
  for (const Ent& e : g.els) {
    double a, b, c, d;
    if (!boiteEnt(e, a, b, c, d)) continue;
    minx = std::min(minx, a), maxx = std::max(maxx, c), miny = std::min(miny, b), maxy = std::max(maxy, d);
    any = true;
  }
  return any;
}
const Geo& geoVue(Ctx& c, const J& v) { return c.calc.geoDe(v, c.sh, c.mep, c.piece); }
void echelleAuto(Ctx& c, J& view, double iw, double ih) {  // mepAutoScale
  double minx, miny, maxx, maxy;
  if (!boiteGeo(geoVue(c, view), minx, miny, maxx, maxy)) return;
  const double w = maxx - minx != 0 ? maxx - minx : 1, h = maxy - miny != 0 ? maxy - miny : 1;
  const double s = std::min({1.0, iw * 0.42 / w, ih * 0.8 / h});
  if (s > 0 && s < 1) {
    for (const auto& e : ECHELLES)
      if (e.first <= s) {
        view["scale"] = e.first;
        return;
      }
    view["scale"] = std::max(0.05, std::floor(s * 20 + 0.5) / 20);
  }
}
void placerPres(Ctx& c, J& view, double gx, double gy, double ix, double iy, double iw, double ih) {  // mepPlaceNear
  const double pad = 18;
  view["x"] = gx, view["y"] = gy;
  double bx0, by0, bx1, by1;
  if (!boiteGeo(geoVue(c, view), bx0, by0, bx1, by1)) return;
  for (int it = 0; it < 40; it++) {
    bool hit = false;
    for (J& o : c.sh["views"]) {
      if (chaine(o, "id") == chaine(view, "id")) continue;
      double ox0, oy0, ox1, oy1;
      if (!boiteGeo(geoVue(c, o), ox0, oy0, ox1, oy1)) continue;
      const XY s1 = vers(view, bx0, by0), s2 = vers(view, bx1, by1), o1 = vers(o, ox0, oy0), o2 = vers(o, ox1, oy1);
      if (s1.x < o2.x + pad && s2.x + pad > o1.x && s1.y < o2.y + pad && s2.y + pad > o1.y) {
        view["x"] = num(view, "x") + (s2.x < o1.x + (o2.x - o1.x) / 2 ? -(s2.x - o1.x + pad) : (o2.x - s1.x + pad));
        hit = true;
      }
    }
    if (!hit) break;
  }
  view["x"] = std::max(ix + 8, std::min(ix + iw - 8, num(view, "x")));
  view["y"] = std::max(iy + 8, std::min(iy + ih - 8, num(view, "y")));
}
double etendueVue(Ctx& c, const J& v) {  // mepViewSpan
  double mx = 10;
  for (const Ent& e : geoVue(c, v).els) {
    double a, b, d, f;
    if (!boiteEnt(e, a, b, d, f)) continue;
    mx = std::max({mx, std::abs(a), std::abs(d), std::abs(b), std::abs(f)});
  }
  return mx * std::max(0.2, num(v, "scale"));
}
struct PosePar {
  double x = 0, y = 0;
  bool aX = false, aY = false;
  double lockX = 0, lockY = 0;
};
// mepAddView : ce qui n'est pas donné prend la valeur d'une nouvelle vue
J& ajouterVue(Ctx& c, const J& opts, const PosePar* at, bool garderEchelle, double ix, double iy, double iw, double ih) {
  J view = {{"id", identifiantPlan("v")}, {"kind", "base"}, {"vk", "front"}, {"bodyId", nullptr}, {"dir", J::array({0, -1, 0})}, {"u", J::array({1, 0, 0})}, {"v", J::array({0, 0, -1})},
            {"x", 0}, {"y", 0}, {"scale", 1}, {"mode", "hide"}, {"tangent", true}, {"hlrExact", true}, {"flip", false}, {"label", ""}, {"parent", nullptr}, {"section", nullptr},
            {"detail", nullptr}, {"autoAxes", false}, {"autoPitch", false}, {"axes", J::array()}};
  for (auto it = opts.begin(); it != opts.end(); ++it) view[it.key()] = it.value();
  if (chaine(view, "kind") == "base" && !chaine(view, "vk").empty()) {
    const Base b = baseDe(view);
    view["dir"] = jv(b.dir), view["u"] = jv(b.u), view["v"] = jv(b.v);
  }
  if (!c.sh.contains("views") || !c.sh["views"].is_array()) c.sh["views"] = J::array();
  c.sh["views"].push_back(std::move(view));
  J& v = c.sh["views"].back();
  if (!garderEchelle) echelleAuto(c, v, iw, ih);
  if (at) {  // mepViewCenterAt
    double minx, miny, maxx, maxy;
    const bool b = boiteGeo(geoVue(c, v), minx, miny, maxx, maxy);
    const double cx = b ? (minx + maxx) / 2 : 0, cy = b ? (miny + maxy) / 2 : 0, s = num(v, "scale");
    v["x"] = at->aX ? at->lockX : at->x - cx * s;
    v["y"] = at->aY ? at->lockY : at->y - cy * s;
  } else {
    placerPres(c, v, ix + iw * (0.28 + 0.16 * (static_cast<int>(c.sh["views"].size()) % 3)), iy + ih * (chaine(v, "kind") == "detail" ? 0.3 : 0.45), ix, iy, iw, ih);
  }
  return v;
}
std::string libelleSuivant(const J& sh) {  // mepNextLabel
  std::set<std::string> pris;
  if (sh.contains("views"))
    for (const J& v : sh["views"])
      if (!chaine(v, "label").empty()) pris.insert(chaine(v, "label"));
  for (int i = 0; i < 26; i++) {
    const std::string L(1, static_cast<char>('A' + i));
    if (!pris.count(L)) return L;
  }
  return "V" + std::to_string(sh["views"].size());
}
Base baseProjetee(const Base& b, const std::string& w) {  // MEP_PROJ
  Base r;
  if (w == "top") r.dir = {-b.v[0], -b.v[1], -b.v[2]}, r.u = b.u;
  else if (w == "bottom") r.dir = b.v, r.u = b.u;
  else if (w == "left") r.dir = {-b.u[0], -b.u[1], -b.u[2]}, r.u = b.dir;
  else r.dir = b.u, r.u = {-b.dir[0], -b.dir[1], -b.dir[2]};
  r.dir = norme(r.dir), r.u = norme(r.u), r.v = norme(cross(r.u, r.dir));
  return r;
}
Base basePapier(const J& par, const XY& t, const XY& np, double s, V3* Eo = nullptr) {  // mepPaperBasis
  const Base b = baseDe(par);
  const V3 E = norme({b.u[0] * t.x + b.v[0] * t.y, b.u[1] * t.x + b.v[1] * t.y, b.u[2] * t.x + b.v[2] * t.y});
  const V3 Pd = norme(b.dir);
  Base r;
  r.u = norme({t.x * E[0] + s * np.x * Pd[0], t.x * E[1] + s * np.x * Pd[1], t.x * E[2] + s * np.x * Pd[2]});
  r.v = norme({t.y * E[0] + s * np.y * Pd[0], t.y * E[1] + s * np.y * Pd[1], t.y * E[2] + s * np.y * Pd[2]});
  r.dir = norme(cross(r.v, r.u));
  if (Eo) *Eo = E;
  return r;
}
// mepModelBoxIn : l'encombrement de la pièce dans une base, pour l'ombre de la vue
bool boiteModele(Ctx& c, const V3& u, const V3& v, double scale, const std::string& bodyId, double& w, double& h) {
  Bnd_Box B;
  for (const Corps& k : c.piece.corps)
    if (bodyId.empty() || k.id == bodyId) BRepBndLib::Add(k.forme, B, false);
  if (B.IsVoid()) return false;
  double a0, b0, d0, a1, b1, d1;
  B.Get(a0, b0, d0, a1, b1, d1);
  double x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (int i = 0; i < 8; i++) {
    const V3 p = {i & 1 ? a1 : a0, i & 2 ? b1 : b0, i & 4 ? d1 : d0};
    const double a = dot(p, u), b = dot(p, v);
    x0 = std::min(x0, a), x1 = std::max(x1, a), y0 = std::min(y0, b), y1 = std::max(y1, b);
  }
  w = (x1 - x0) * scale, h = (y1 - y0) * scale;
  return true;
}
struct BoiteC {
  double x, y, w, h;
};
BoiteC centreMere(Ctx& c, const J& par) {  // mepParBBC
  double x, y, w, h;
  if (boiteDeVue(par, c.sh, c.mep, c.piece, c.calc, x, y, w, h)) return {x + w / 2, y + h / 2, w, h};
  return {num(par, "x"), num(par, "y"), 40, 40};
}
std::string sensProjection(Ctx& c, const J& par, double x, double y) {  // mepVcmdProjWhich
  const BoiteC b = centreMere(c, par);
  const double dx = x - b.x, dy = y - b.y, ax = std::abs(dx) - b.w / 2, ay = std::abs(dy) - b.h / 2;
  if (ax < 4 && ay < 4) return "";
  if (ax > 4 && ay > 4 && std::min(ax, ay) > 0.35 * std::max(ax, ay)) return "iso";
  if (ax > ay) return dx > 0 ? "left" : "right";  // 1er angle : vue de gauche posée à droite
  return dy > 0 ? "top" : "bottom";               // vue de dessus posée dessous
}
struct G {  // mepVcmdGeom
  bool valide = false;
  std::string which;
  PosePar at;
  bool aBox = false;
  double bx = 0, by = 0, bw = 0, bh = 0;
  XY A, B, C, t, np;
  std::vector<XY> pts;
  bool ok = false, aNp = false;
  double s = 1, R = 0, rr = 0;
};
G geomCommande(Ctx& c, const CommandeVue& m, double x, double y, bool maj, double zoom) {
  G g;
  J* par = m.par.empty() ? nullptr : vueCmd(c.sh, m.par);
  if (!par) return g;
  const double scale = num(*par, "scale");
  const std::string bodyId = chaine(*par, "bodyId");
  if (m.kind == "proj") {
    const std::string w = sensProjection(c, *par, x, y);
    if (w.empty()) return g;
    const BoiteC bc = centreMere(c, *par);
    g.valide = true, g.which = w, g.aBox = true;
    if (w == "iso") {
      const Base ib = baseDeDirection({0.62, -0.62, 0.48});
      double bw = bc.w, bh = bc.h;
      boiteModele(c, ib.u, ib.v, scale, bodyId, bw, bh);
      g.at.x = x, g.at.y = y, g.bx = x, g.by = y, g.bw = bw, g.bh = bh;
      return g;
    }
    const bool lr = w == "left" || w == "right";
    g.at.x = lr ? x : bc.x, g.at.y = lr ? bc.y : y;
    if (lr) g.at.aY = true, g.at.lockY = num(*par, "y");
    else g.at.aX = true, g.at.lockX = num(*par, "x");
    const Base pr = baseProjetee(baseDe(*par), w);
    double bw = bc.w, bh = bc.h;
    boiteModele(c, pr.u, pr.v, scale, bodyId, bw, bh);
    g.bx = g.at.x, g.by = g.at.y, g.bw = bw, g.bh = bh;
    return g;
  }
  if (m.kind == "section" && !m.pts.empty()) {
    for (const auto& q : m.pts) g.pts.push_back(vers(*par, q[0], q[1]));
    if (m.stage == 1) {
      const Accroche sn = accrocher(c, x, y, zoom);
      XY B{sn.x, sn.y};
      const XY A = g.pts[0], Lp = g.pts.back();
      bool ok = true;
      if (g.pts.size() == 1) {
        if (!maj) {  // 2e point : alignement H/V à ±8°, Maj : libre
          const double a = std::abs(std::atan2(B.y - A.y, B.x - A.x) * 180 / PI);
          if (a < 8 || a > 172) B.y = A.y;
          else if (std::abs(a - 90) < 8) B.x = A.x;
        }
      } else {
        const XY Q = g.pts[g.pts.size() - 2];
        const double dl0 = std::hypot(Lp.x - Q.x, Lp.y - Q.y), dl = dl0 != 0 ? dl0 : 1;
        const double px = -(Lp.y - Q.y) / dl, py = (Lp.x - Q.x) / dl, k = (B.x - Lp.x) * px + (B.y - Lp.y) * py;
        B = {Lp.x + px * k, Lp.y + py * k};
        if ((g.pts.size() - 1) % 2 == 0) ok = (B.x - Lp.x) * (g.pts[1].x - A.x) + (B.y - Lp.y) * (g.pts[1].y - A.y) > 0;  // tronçon de coupe : même sens que le 1er
      }
      if (std::hypot(B.x - Lp.x, B.y - Lp.y) < 2) ok = false;
      g.valide = true, g.A = A, g.B = B, g.ok = ok;
      return g;
    }
    const XY A = vers(*par, m.Ax, m.Ay), B = vers(*par, m.Bx, m.By);
    const double L0 = std::hypot(B.x - A.x, B.y - A.y), L = L0 != 0 ? L0 : 1;
    const XY t{(B.x - A.x) / L, (B.y - A.y) / L}, np{-t.y, t.x}, M{(A.x + B.x) / 2, (A.y + B.y) / 2};
    const double side = (x - M.x) * np.x + (y - M.y) * np.y >= 0 ? 1 : -1;
    const BoiteC bc = centreMere(c, *par);
    const double d = (x - bc.x) * np.x + (y - bc.y) * np.y;
    g.valide = true, g.A = A, g.B = B, g.t = t, g.np = np, g.aNp = true, g.s = side;
    g.at.x = bc.x + np.x * d, g.at.y = bc.y + np.y * d;
    const Base B2 = basePapier(*par, t, np, side);
    double bw = bc.w, bh = bc.h;
    boiteModele(c, B2.u, B2.v, scale, bodyId, bw, bh);
    g.aBox = true, g.bx = g.at.x, g.by = g.at.y, g.bw = bw, g.bh = bh;
    return g;
  }
  if (m.kind == "detail" && m.stage >= 1) {
    g.valide = true;
    g.C = vers(*par, m.Cx, m.Cy);
    if (m.stage == 1) {
      g.R = std::hypot(x - g.C.x, y - g.C.y);
    } else {
      g.R = m.R * scale, g.at.x = x, g.at.y = y, g.rr = m.R * m.echelle;
    }
    return g;
  }
  if (m.kind == "aux" && m.aEdge) {
    const XY A = vers(*par, m.e[0], m.e[1]), B = vers(*par, m.e[2], m.e[3]);
    const double L0 = std::hypot(B.x - A.x, B.y - A.y), L = L0 != 0 ? L0 : 1;
    const XY t{(B.x - A.x) / L, (B.y - A.y) / L}, np{-t.y, t.x}, M{(A.x + B.x) / 2, (A.y + B.y) / 2};
    const double side = (x - M.x) * np.x + (y - M.y) * np.y >= 0 ? 1 : -1;
    const double d = (x - M.x) * np.x + (y - M.y) * np.y;
    g.valide = true, g.A = A, g.B = B, g.t = t, g.np = np, g.aNp = true, g.s = side;
    g.at.x = M.x + np.x * d, g.at.y = M.y + np.y * d;
    const Base B2 = basePapier(*par, t, np, side);
    double bw = std::max(L, 20.0), bh = 20;
    boiteModele(c, B2.u, B2.v, scale, bodyId, bw, bh);
    g.aBox = true, g.bx = g.at.x, g.by = g.at.y, g.bw = bw, g.bh = bh;
  }
  return g;
}
std::vector<BoutonCoupe> boutonsCoupe(const std::vector<XY>& pts, double zoom) {  // mepSecBtnRects
  std::vector<BoutonCoupe> o;
  if (pts.empty()) return o;
  const double w = 7 / zoom, gp = 1.5 / zoom, x0 = pts.back().x + 4 / zoom, y0 = pts.back().y - 4 / zoom - w;
  o.push_back({"undo", x0, y0, w, w});
  if (pts.size() >= 2 && pts.size() % 2 == 0) o.push_back({"ok", x0 + w + gp, y0, w, w});
  return o;
}
J heritage(const J& par) {  // ce qu'une vue reçoit de sa mère
  return {{"bodyId", par.contains("bodyId") ? par["bodyId"] : J()}, {"asm", vrai(par, "asm")}, {"mode", chaine(par, "mode", "hide")}, {"tangent", vrai(par, "tangent")},
          {"hlrExact", !(par.contains("hlrExact") && par["hlrExact"].is_boolean() && !par["hlrExact"].get<bool>())}};
}
}  // namespace

std::string identifiantPlan(const char* p) {  // mepUid
  static int seq = 0;
  const unsigned long long ms = static_cast<unsigned long long>(std::time(nullptr)) * 1000ull + GetTickCount() % 1000;
  return std::string(p) + std::to_string(++seq) + "_" + base36(ms);
}
// ---- Les planches ----
void nouvellePlanche(J& mep) {  // mepAddSheetCmd, mepNewSheet
  const size_t n = mep["sheets"].size() + 1;
  J sh = {{"id", "sh" + base36(static_cast<unsigned long long>(std::time(nullptr)) * 1000ull) + std::to_string(GetTickCount() % 10000)},
          {"name", "Planche " + std::to_string(n)},
          {"format", "A3"},
          {"orient", "landscape"},
          {"views", J::array()},
          {"dims", J::array()},
          {"sk", nullptr},
          {"title", {{"projet", "ConceptCAD — Plan"}, {"auteur", "—"}, {"date", dateFr()}, {"tb", nullptr}}},
          {"seq", 1},
          {"dseq", 1}};
  if (mep.contains("prefs") && mep["prefs"].is_object() && mep["prefs"].contains("ls")) {
    const std::string f = chaine(mep["prefs"]["ls"], "mep_frame_def");
    if (!f.empty()) {
      try {
        const J o = J::parse(f);
        if (o.is_object()) sh["frame"] = o;
      } catch (const std::exception&) {
      }
    }
  }
  mep["sheets"].push_back(std::move(sh));
  mep["cur"] = mep["sheets"].size() - 1;
  normaliser(mep);
}
void dupliquerPlanche(J& mep, int cur) {  // mepDupSheetCmd
  const J src = mep["sheets"][cur];
  J c = {{"views", src.contains("views") ? src["views"] : J::array()}, {"dims", src.contains("dims") ? src["dims"] : J::array()}};
  const size_t n = mep["sheets"].size() + 1;
  J ns = {{"id", "sh" + base36(static_cast<unsigned long long>(std::time(nullptr)) * 1000ull) + std::to_string(GetTickCount() % 10000)}, {"name", "Planche " + std::to_string(n)},
          {"format", src.value("format", std::string("A3"))}, {"orient", src.value("orient", std::string("landscape"))}, {"views", J::array()}, {"dims", J::array()},
          {"sk", src.contains("sk") ? src["sk"] : J()}, {"title", src.contains("title") ? src["title"] : J::object()}, {"seq", 1}, {"dseq", 1}};
  if (src.contains("frame")) ns["frame"] = src["frame"];
  if (vrai(src, "bom")) ns["bom"] = src["bom"];
  if (chaine(src, "format") == "Manuel") ns["fw"] = src["fw"], ns["fh"] = src["fh"];
  std::map<std::string, std::string> ids;
  for (J& v : c["views"]) {
    const std::string nid = identifiantPlan("v");
    ids[chaine(v, "id")] = nid;
    v["id"] = nid;
    const std::string p = chaine(v, "parent");
    v["parent"] = ids.count(p) ? J(ids[p]) : J();
    if (vrai(v, "section")) {
      const std::string q = chaine(v["section"], "pid");
      v["section"]["pid"] = ids.count(q) ? J(ids[q]) : J();
    }
  }
  for (J& d : c["dims"]) {
    d["id"] = identifiantPlan("d");
    if (ids.count(chaine(d, "vid"))) d["vid"] = ids[chaine(d, "vid")];
    if (vrai(d, "vid2") && ids.count(chaine(d, "vid2"))) d["vid2"] = ids[chaine(d, "vid2")];
  }
  ns["views"] = c["views"], ns["dims"] = c["dims"];
  mep["sheets"].insert(mep["sheets"].begin() + cur + 1, std::move(ns));
  mep["cur"] = cur + 1;
  normaliser(mep);
}

// ---- Les nouvelles vues ----
std::string ajouterVueStandard(J& mep, int planche, const Piece& p, Calcul& calc, const std::string& vk) {  // mepAddStandardView
  Ctx c = contexteGeste(mep, planche, p, calc);
  double ix, iy, iw, ih;
  surfaceUtile(c.sh, ix, iy, iw, ih);
  static const std::map<std::string, std::string> LAB = {{"front", "Face"}, {"top", "Dessus"}, {"bottom", "Dessous"}, {"right", "Côté droit"}, {"left", "Côté gauche"}, {"rear", "Arrière"}, {"iso", "ISO"}};
  const J opts = {{"kind", "base"}, {"vk", vk}, {"bodyId", nullptr}, {"label", LAB.at(vk)}};
  return chaine(ajouterVue(c, opts, nullptr, false, ix, iy, iw, ih), "id");
}
std::string ajouterVueCamera(J& mep, int planche, const Piece& p, Calcul& calc, const std::array<double, 3>& dir) {  // mepAddCameraView
  Ctx c = contexteGeste(mep, planche, p, calc);
  double ix, iy, iw, ih;
  surfaceUtile(c.sh, ix, iy, iw, ih);
  const Base b = baseDeDirection({dir[0], dir[1], dir[2]});
  const J opts = {{"kind", "base"}, {"vk", ""}, {"camera", true}, {"dir", jv(b.dir)}, {"u", jv(b.u)}, {"v", jv(b.v)}, {"label", ""}};
  return chaine(ajouterVue(c, opts, nullptr, false, ix, iy, iw, ih), "id");
}

bool vuesAutomatiques(J& mep, int planche, const Piece& p, Calcul& calc) {  // mepAutoViews
  J& feuille = mep["sheets"][planche];
  if (feuille.contains("views") && feuille["views"].is_array() && !feuille["views"].empty()) return false;
  if (p.corps.empty()) return false;
  const std::string id = ajouterVueStandard(mep, planche, p, calc, "front");
  Ctx c = contexteGeste(mep, planche, p, calc);
  double ix, iy, iw, ih;
  surfaceUtile(c.sh, ix, iy, iw, ih);
  for (const char* w : {"top", "right"}) {
    J* par = vueCmd(c.sh, id);
    const Base b = baseProjetee(baseDe(*par), w);
    J o = {{"kind", "proj"}, {"vk", ""}, {"proj", w}, {"dir", jv(b.dir)}, {"u", jv(b.u)}, {"v", jv(b.v)}, {"parent", id}, {"label", libelleSuivant(c.sh)}, {"scale", num(*par, "scale")}, {"autoAxes", vrai(*par, "autoAxes")}, {"autoPitch", vrai(*par, "autoPitch")}};
    const J h = heritage(*par);
    for (auto it = h.begin(); it != h.end(); ++it) o[it.key()] = it.value();
    J& v = ajouterVue(c, o, nullptr, false, ix, iy, iw, ih);
    par = vueCmd(c.sh, id);  // mepPlaceProj
    v["scale"] = num(*par, "scale");
    const double off = etendueVue(c, *par) + etendueVue(c, v) + 30;
    if (std::string(w) == "top") v["x"] = num(*par, "x"), v["y"] = num(*par, "y") + off;
    else v["x"] = num(*par, "x") - off, v["y"] = num(*par, "y");
  }
  return true;
}

// ---- Les commandes ----
CommandeVue commencerCommande(const J& sh, const std::string& kind, const std::string& selection) {  // mepVcmdStart
  CommandeVue m;
  m.kind = kind;
  J& s = const_cast<J&>(sh);
  if (!selection.empty() && vueParId(s, selection)) m.par = selection;
  if (kind == "proj" && !m.par.empty()) m.stage = 1;
  return m;
}
std::string conseilCommande(const CommandeVue& m) {  // mepVcmdHint
  static const std::map<std::string, std::vector<std::string>> T = {
      {"proj", {"Projection : cliquez la vue mère.", "Projection : déplacez la souris autour de la vue (droite/gauche/dessus/dessous, diagonale = ISO) et cliquez. Échap termine."}},
      {"section", {"Coupe : cliquez le 1er point de la ligne de coupe sur une vue.", "Coupe : cliquez le point suivant (Maj = sans alignement H/V) — ✓ / Entrée valide la ligne, ↶ / Retour arrière enlève le dernier point.", "Coupe : placez la vue — le côté de la souris choisit le sens du regard. Échap annule."}},
      {"detail", {"Détail : cliquez le centre de la zone à agrandir.", "Détail : cliquez pour fixer le rayon.", "Détail : placez la vue de détail."}},
      {"aux", {"Auxiliaire : cliquez une arête inclinée d’une vue.", "Auxiliaire : placez la vue de part ou d’autre de l’arête. Échap annule."}}};
  const auto it = T.find(m.kind);
  return it != T.end() && m.stage < static_cast<int>(it->second.size()) ? it->second[m.stage] : std::string();
}
std::string annulerPointCoupe(CommandeVue& m) {  // mepSecUndo
  if (m.kind != "section" || m.stage != 1) return "";
  if (m.pts.size() > 1) {
    m.pts.pop_back();
    return "Coupe : dernier point enlevé (" + std::to_string(m.pts.size()) + " restant" + (m.pts.size() > 1 ? "s" : "") + ").";
  }
  m.pts.clear(), m.stage = 0;
  return conseilCommande(m);
}
std::string validerCoupe(CommandeVue& m) {  // mepSecValidate
  if (m.kind != "section" || m.stage != 1) return "";
  if (m.pts.size() < 2) return "Coupe : il faut au moins 2 points.";
  if (m.pts.size() % 2) return "Coupe : la ligne doit finir par un tronçon parallèle au 1er — ajoutez un point (ou ↶).";
  m.Ax = m.pts[0][0], m.Ay = m.pts[0][1], m.Bx = m.pts[1][0], m.By = m.pts[1][1], m.stage = 2;
  return conseilCommande(m);
}
SuiteCommande cliqueCommande(J& mep, int planche, const Piece& p, Calcul& calc, CommandeVue& m, double x, double y, bool maj, double zoom) {  // mepVcmdDown
  SuiteCommande r;
  Ctx c = contexteGeste(mep, planche, p, calc);
  double ix, iy, iw, ih;
  surfaceUtile(c.sh, ix, iy, iw, ih);
  J* par = m.par.empty() ? nullptr : vueCmd(c.sh, m.par);
  const auto annule = [&]() {
    r.fini = true;
    r.message = "Commande annulée.";
    return r;
  };
  if (m.kind == "proj") {
    if (m.stage == 0) {
      const std::string v = vueSous(c.sh, c.mep, c.piece, c.calc, x, y);
      if (v.empty()) return r.message = "Projection : cliquez sur une vue.", r;
      m.par = v, m.stage = 1, r.select = v, r.message = conseilCommande(m);
      return r;
    }
    if (!par) return annule();
    const G g = geomCommande(c, m, x, y, false, zoom);
    if (!g.valide) return r.message = "Projection : éloignez la souris de la vue mère pour choisir le sens.", r;
    std::string lab;
    const J h = heritage(*par);
    const double sc = num(*par, "scale");
    if (g.which == "iso") {
      J o = {{"kind", "base"}, {"vk", "iso"}, {"label", ""}, {"scale", sc}};
      for (auto it = h.begin(); it != h.end(); ++it) o[it.key()] = it.value();
      PosePar at = g.at;
      ajouterVue(c, o, &at, true, ix, iy, iw, ih);
    } else {
      const Base b = baseProjetee(baseDe(*par), g.which);
      lab = libelleSuivant(c.sh);
      J o = {{"kind", "proj"}, {"vk", ""}, {"proj", g.which}, {"dir", jv(b.dir)}, {"u", jv(b.u)}, {"v", jv(b.v)}, {"parent", m.par}, {"label", lab}, {"scale", sc}, {"autoAxes", vrai(*par, "autoAxes")}, {"autoPitch", vrai(*par, "autoPitch")}};
      for (auto it = h.begin(); it != h.end(); ++it) o[it.key()] = it.value();
      PosePar at = g.at;
      ajouterVue(c, o, &at, true, ix, iy, iw, ih);
    }
    r.change = true, r.select = m.par;
    r.message = "Vue « " + (lab.empty() ? std::string("ISO") : lab) + " » posée — autre projection, ou Échap.";
    return r;
  }
  if (m.kind == "section") {
    if (m.stage == 0) {
      const Accroche s = accrocher(c, x, y, zoom);
      std::string vid = vueSous(c.sh, c.mep, c.piece, c.calc, x, y);
      if (vid.empty() && s.hit && !s.vid.empty()) vid = s.vid;
      if (vid.empty()) return r.message = "Coupe : cliquez sur une vue (ou un trait d’axe).", r;
      J* v = vueCmd(c.sh, vid);
      if (chaine(*v, "kind") == "detail") return r.message = "Coupe : choisissez une vue complète (pas un détail).", r;
      const XY q = depuis(*v, s.x, s.y);
      m.par = vid, m.pts = {{q.x, q.y}}, m.stage = 1, r.message = conseilCommande(m);
      return r;
    }
    if (!par) return annule();
    if (m.stage == 1) {
      std::vector<XY> pts;
      for (const auto& q : m.pts) pts.push_back(vers(*par, q[0], q[1]));
      for (const BoutonCoupe& b : boutonsCoupe(pts, zoom))
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          r.message = b.act == "undo" ? annulerPointCoupe(m) : validerCoupe(m);
          return r;
        }
      const G g = geomCommande(c, m, x, y, maj, zoom);
      if (!g.ok) {
        r.message = g.pts.size() > 1 && (g.pts.size() - 1) % 2 == 0 ? "Coupe : le tronçon doit avancer dans le sens du 1er." : "Coupe : tronçon trop court.";
        return r;
      }
      const XY q = depuis(*par, g.B.x, g.B.y);
      m.pts.push_back({q.x, q.y});
      r.message = "Coupe : " + std::to_string(m.pts.size()) + " points — point suivant (à l’équerre), ✓ / Entrée valide, ↶ / Retour arrière.";
      return r;
    }
    // mepSectionFromPicks
    const G g = geomCommande(c, m, x, y, maj, zoom);
    const double L = std::hypot(m.Bx - m.Ax, m.By - m.Ay);
    r.fini = true;
    if (L < 1e-6) return r.message = "Coupe : les deux points sont confondus.", r;
    const XY t{(m.Bx - m.Ax) / L, (m.By - m.Ay) / L}, np{-t.y, t.x};
    const Base Bs = basePapier(*par, t, np, g.s), pb = baseDe(*par);
    const V3 wA = {pb.u[0] * m.Ax + pb.v[0] * m.Ay, pb.u[1] * m.Ax + pb.v[1] * m.Ay, pb.u[2] * m.Ax + pb.v[2] * m.Ay};
    const std::string label = libelleSuivant(c.sh);
    J sec = {{"p", jv(wA)}, {"n", jv(Bs.dir)}, {"a", J::array({m.Ax, m.Ay})}, {"b", J::array({m.Bx, m.By})}, {"pid", m.par}, {"s", g.s}};
    if (m.pts.size() > 2) {
      J a = J::array();
      for (const auto& q : m.pts) a.push_back(J::array({js::arrondi(q[0], 4), js::arrondi(q[1], 4)}));
      sec["pts"] = a;
    }
    J o = {{"kind", "section"}, {"vk", ""}, {"dir", jv(Bs.dir)}, {"u", jv(Bs.u)}, {"v", jv(Bs.v)}, {"parent", m.par}, {"label", label}, {"scale", num(*par, "scale")}, {"align", {{"x", np.x * g.s}, {"y", np.y * g.s}}}, {"autoAxes", vrai(*par, "autoAxes")}, {"autoPitch", vrai(*par, "autoPitch")}, {"section", sec}};
    const J h = heritage(*par);
    for (auto it = h.begin(); it != h.end(); ++it) o[it.key()] = it.value();
    PosePar at = g.at;
    J& v = ajouterVue(c, o, &at, true, ix, iy, iw, ih);
    const std::string id = chaine(v, "id");
    try {
      liensAutoCoupe(c, v);
    } catch (const std::exception&) {
    }
    r.change = true, r.select = id;
    r.message = "Coupe " + label + "-" + label + " posée — glisser contraint sur sa ligne de rappel. Tirer sur la ligne de coupe la brise jusqu’au centre / à la ligne visé(e).";
    return r;
  }
  if (m.kind == "detail") {
    if (m.stage == 0) {
      const std::string vid = vueSous(c.sh, c.mep, c.piece, c.calc, x, y);
      if (vid.empty()) return r.message = "Détail : cliquez dans une vue.", r;
      J* v = vueCmd(c.sh, vid);
      const XY q = depuis(*v, x, y);
      m.par = vid, m.Cx = q.x, m.Cy = q.y, m.stage = 1, r.message = conseilCommande(m);
      return r;
    }
    if (!par) return annule();
    const double sc = num(*par, "scale");
    if (m.stage == 1) {
      const G g = geomCommande(c, m, x, y, false, zoom);
      const double R = g.R / sc;
      if (R < 0.5) return r.message = "Détail : rayon trop petit.", r;
      m.R = R;
      const double want = std::max(sc * 2, std::min(sc * 10, 35 / R));
      std::vector<double> S;
      for (const auto& e : ECHELLES) S.push_back(e.first);
      S.push_back(10);
      std::sort(S.begin(), S.end());
      m.echelle = S.back();
      for (double q : S)
        if (q >= want - 1e-9) {
          m.echelle = q;
          break;
        }
      m.stage = 2, r.message = conseilCommande(m);
      return r;
    }
    const std::string label = libelleSuivant(c.sh);
    const Base src = baseDe(*par);
    J o = {{"kind", "detail"}, {"vk", ""}, {"dir", jv(src.dir)}, {"u", jv(src.u)}, {"v", jv(src.v)}, {"parent", m.par}, {"label", label}, {"scale", m.echelle}, {"detail", {{"cx", m.Cx}, {"cy", m.Cy}, {"r", m.R}}}, {"autoAxes", vrai(*par, "autoAxes")}, {"autoPitch", vrai(*par, "autoPitch")}};
    const J h = heritage(*par);
    for (auto it = h.begin(); it != h.end(); ++it) o[it.key()] = it.value();
    PosePar at;
    at.x = x, at.y = y;
    J& v = ajouterVue(c, o, &at, true, ix, iy, iw, ih);
    r.fini = true, r.change = true, r.select = chaine(v, "id");
    r.message = "Détail " + label + " (" + js::texte(js::arrondi(m.R * 2, 2)) + " Ø) créé.";
    return r;
  }
  if (m.kind == "aux") {
    if (m.stage == 0) {
      const auto hit = entiteSousCurseur(c, x, y, zoom, false);
      if (!hit || hit->e.t != 'L') return r.message = "Auxiliaire : cliquez une ARÊTE droite (inclinée) d’une vue.", r;
      m.par = hit->vid, m.aEdge = true, m.e[0] = hit->e.x1, m.e[1] = hit->e.y1, m.e[2] = hit->e.x2, m.e[3] = hit->e.y2, m.stage = 1, r.message = conseilCommande(m);
      return r;
    }
    if (!par) return annule();
    const G g = geomCommande(c, m, x, y, false, zoom);
    // mepAddAuxFromEdge
    const double L0 = std::hypot(m.e[2] - m.e[0], m.e[3] - m.e[1]), L = L0 != 0 ? L0 : 1;
    const XY t{(m.e[2] - m.e[0]) / L, (m.e[3] - m.e[1]) / L}, np{-t.y, t.x};
    const Base B = basePapier(*par, t, np, g.s);
    const std::string label = libelleSuivant(c.sh);
    J o = {{"kind", "aux"}, {"vk", ""}, {"dir", jv(B.dir)}, {"u", jv(B.u)}, {"v", jv(B.v)}, {"parent", m.par}, {"label", label}, {"scale", num(*par, "scale")}, {"align", {{"x", np.x * g.s}, {"y", np.y * g.s}}},
           {"auxEdge", {{"a", J::array({m.e[0], m.e[1]})}, {"b", J::array({m.e[2], m.e[3]})}, {"s", g.s}, {"pid", m.par}}}, {"autoAxes", vrai(*par, "autoAxes")}, {"autoPitch", vrai(*par, "autoPitch")}};
    const J h = heritage(*par);
    for (auto it = h.begin(); it != h.end(); ++it) o[it.key()] = it.value();
    PosePar at = g.at;
    J& v = ajouterVue(c, o, &at, true, ix, iy, iw, ih);
    r.fini = true, r.change = true, r.select = chaine(v, "id");
    r.message = "Vue auxiliaire « " + label + " » posée.";
    return r;
  }
  return annule();
}
ApercuCommande apercuCommande(J& mep, int planche, const Piece& p, Calcul& calc, const CommandeVue& m, double zoom) {  // mepVcmdDraw
  ApercuCommande a;
  if (!m.aCur) return a;
  Ctx c = contexteGeste(mep, planche, p, calc);
  const double x = m.curX, y = m.curY;
  const G g = geomCommande(c, m, x, y, m.maj, zoom);
  if (!m.par.empty())
    if (J* par = vueCmd(c.sh, m.par)) {
      double bx, by, bw, bh;
      if (boiteDeVue(*par, c.sh, c.mep, c.piece, c.calc, bx, by, bw, bh)) a.cadres.push_back({bx - 4, by - 4, bw + 8, bh + 8, false});
    }
  if (m.kind == "section" && m.stage < 2) {
    const Accroche sn = accrocher(c, x, y, zoom);
    if (sn.hit) a.aSnap = true, a.snapX = sn.x, a.snapY = sn.y, a.snapAxe = sn.t.rfind("ax", 0) == 0 || sn.t == "onAx";
  }
  if (m.kind == "aux" && m.stage == 0) {
    const auto hit = entiteSousCurseur(c, x, y, zoom, false);
    if (hit && hit->e.t == 'L') {
      if (J* v = vueCmd(c.sh, hit->vid)) {
        const XY A = vers(*v, hit->e.x1, hit->e.y1), B = vers(*v, hit->e.x2, hit->e.y2);
        a.traits.push_back({A.x, A.y, B.x, B.y, false, false});
      }
    }
  }
  if (!g.valide) return a;
  if (g.aBox) a.cadres.push_back({g.bx - g.bw / 2, g.by - g.bh / 2, g.bw, g.bh, true});
  if (m.kind == "proj" && !g.which.empty()) {
    static const std::map<std::string, std::string> N = {{"left", "Côté gauche"}, {"right", "Côté droit"}, {"top", "Dessus"}, {"bottom", "Dessous"}, {"iso", "ISO"}};
    a.texte = N.at(g.which), a.tx = x + 4, a.ty = y - 4;
  }
  if (m.kind == "section") {
    std::vector<XY> poly = g.pts;
    if (m.stage == 1) poly.push_back(g.B);
    for (size_t i = 0; i + 1 < poly.size(); i++) a.traits.push_back({poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y, m.stage == 1 && i + 2 == poly.size() && !g.ok, false});
    if (g.aNp)
      for (const XY& Q : {poly.front(), poly.back()}) a.traits.push_back({Q.x, Q.y, Q.x + g.np.x * g.s * 9, Q.y + g.np.y * g.s * 9, false, true});
    if (m.stage == 1) a.boutons = boutonsCoupe(g.pts, zoom);
  }
  if (m.kind == "detail") {
    a.ronds.push_back({g.C.x, g.C.y, std::max(0.5, g.R), false});
    if (m.stage == 2) a.ronds.push_back({g.at.x, g.at.y, g.rr, true});
  }
  if (m.kind == "aux") {
    a.traits.push_back({g.A.x, g.A.y, g.B.x, g.B.y, false, false});
    const XY M{(g.A.x + g.B.x) / 2, (g.A.y + g.B.y) / 2};
    a.traits.push_back({M.x, M.y, M.x + g.np.x * g.s * 12, M.y + g.np.y * g.s * 12, false, true});
  }
  return a;
}
}  // namespace plan
