// Les copies d'une répétition sont dérivées : elles sont régénérées à l'ouverture depuis leurs sources.
// Traduction de repGenChildren, repCloneFeature et repCloneSketch (src/40-20-repetitions.js).
// Le texte du fichier reste celui d'origine : seul le document en mémoire est refait, sur le JSON, avant sa lecture.
// Pas encore repris : la répétition suivant un profil (ses copies restent celles du fichier).
#include "repetitions.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <map>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "maths_js.h"

using json = nlohmann::ordered_json;

namespace {
using V3 = std::array<double, 3>;
const double PI_JS = 3.141592653589793;
const int REPEAT_MAX = 200;
double hyp3(double a, double b, double c) { return std::sqrt(a * a + b * b + c * c); }

double dbl(const json& x) {  // +x || 0
  if (x.is_number()) return x.get<double>();
  if (x.is_string()) return std::strtod(x.get<std::string>().c_str(), nullptr);
  if (x.is_boolean()) return x.get<bool>() ? 1 : 0;
  return 0;
}
double num(const json& o, const char* k) {
  const auto i = o.find(k);
  return i == o.end() ? 0 : dbl(*i);
}
std::string str(const json& o, const char* k) {
  const auto i = o.find(k);
  return i != o.end() && i->is_string() ? i->get<std::string>() : std::string();
}
bool tableau(const json& o, const char* k) {
  const auto i = o.find(k);
  return i != o.end() && i->is_array();
}
bool vraiJs(const json& o, const char* k) {
  const auto i = o.find(k);
  if (i == o.end() || i->is_null()) return false;
  if (i->is_boolean()) return i->get<bool>();
  if (i->is_number()) return i->get<double>() != 0;
  if (i->is_string()) return !i->get<std::string>().empty();
  return true;
}
V3 vec(const json& a) {
  V3 v{0, 0, 0};
  if (a.is_array())
    for (size_t i = 0; i < 3 && i < a.size(); i++) v[i] = dbl(a[i]);
  return v;
}
double fixe(double v, int n) {  // +v.toFixed(n)
  char b[64];
  snprintf(b, sizeof b, "%.*f", n, v);
  return std::strtod(b, nullptr);
}
json arrondi(const V3& v, int n) { return json::array({fixe(v[0], n), fixe(v[1], n), fixe(v[2], n)}); }
V3 norme(const V3& a) {
  double l = hyp3(a[0], a[1], a[2]);
  if (l == 0) l = 1;
  return {a[0] / l, a[1] / l, a[2] / l};
}
double scal(const V3& a, const V3& b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
V3 vectoriel(const V3& a, const V3& b) { return {a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]}; }
V3 plus(const V3& a, const V3& b) { return {a[0] + b[0], a[1] + b[1], a[2] + b[2]}; }
V3 fois(const V3& a, double s) { return {a[0] * s, a[1] * s, a[2] * s}; }
V3 tourne(const V3& v, const V3& axe, double deg) {
  const V3 u = norme(axe);
  const double t = deg * PI_JS / 180, c = m_cos(t), s = m_sin(t), ud = scal(u, v);
  return plus(plus(fois(v, c), fois(vectoriel(u, v), s)), fois(u, ud * (1 - c)));
}

// La transformation d'une copie
struct Transfo {
  std::string mode, axe, plan;
  bool aDir = false, aPlanN = false, aDecalage = false;
  V3 dir{}, planN{}, decalage{};
  double dist = 0, angle = 0, copies = 0;
};
Transfo transfoDe(const json& rp) {
  Transfo c;
  c.mode = str(rp, "mode");
  if (c.mode.empty()) c.mode = str(rp, "type");
  c.axe = str(rp, "axis");
  c.plan = str(rp, "plane");
  if (tableau(rp, "dir")) {
    c.aDir = true;
    c.dir = vec(rp["dir"]);
  }
  if (tableau(rp, "planeN")) {
    c.aPlanN = true;
    c.planN = vec(rp["planeN"]);
  }
  c.dist = num(rp, "dist");
  c.angle = num(rp, "angle");
  c.copies = num(rp, "copies");
  return c;
}
V3 axeDe(const std::string& axe, bool aDir, const V3& dir) {
  if (aDir) return norme(dir);
  if (axe == "Y") return {0, 1, 0};
  if (axe == "Z") return {0, 0, 1};
  return {1, 0, 0};
}
V3 axeDe(const Transfo& c) { return axeDe(c.axe, c.aDir, c.dir); }
V3 normalePlan(const Transfo& c) {
  if (c.aPlanN) return norme(c.planN);
  if (c.plan == "XY") return {0, 0, 1};
  if (c.plan == "XZ") return {0, 1, 0};
  return {1, 0, 0};
}
double pasCirculaire(const Transfo& c) {
  const double a = c.angle != 0 ? c.angle : 360, n = c.copies != 0 ? c.copies : 1;
  return std::abs(a) >= 360 - 1e-9 ? a / (n + 1) : a / n;
}
V3 transPoint(const V3& v, int i, const Transfo& c) {
  if (c.mode == "lin") return plus(v, c.aDecalage ? c.decalage : fois(axeDe(c), c.dist * i));
  if (c.mode == "circ") return tourne(v, axeDe(c), pasCirculaire(c) * i);
  const V3 n = normalePlan(c);
  return plus(v, fois(n, -2 * scal(v, n)));
}
V3 transVec(const V3& a, int i, const Transfo& c) {
  if (c.mode == "lin") return a;
  if (c.mode == "circ") return tourne(a, axeDe(c), pasCirculaire(c) * i);
  const V3 n = normalePlan(c);
  return plus(a, fois(n, -2 * scal(a, n)));
}
V3 transDim(const V3& a, int i, const Transfo& c) {
  const V3 e[3] = {transVec({1, 0, 0}, i, c), transVec({0, 1, 0}, i, c), transVec({0, 0, 1}, i, c)};
  V3 r{};
  for (int k = 0; k < 3; k++) r[k] = std::abs(e[0][k]) * a[0] + std::abs(e[1][k]) * a[1] + std::abs(e[2][k]) * a[2];
  return r;
}

// ── noms des références dans une copie ───────────────────────────────────────
using TableIds = std::vector<std::pair<std::string, std::string>>;  // dans l'ordre d'insertion
void poserId(TableIds& t, const std::string& k, const std::string& v) {
  for (auto& q : t)
    if (q.first == k) {
      q.second = v;
      return;
    }
  t.push_back({k, v});
}
const std::string* idDe(const TableIds& t, const std::string& k) {
  for (const auto& q : t)
    if (q.first == k) return &q.second;
  return nullptr;
}
std::string nomCle(const std::string& n) { return n.substr(0, n.find('<')); }
std::string nomPropre(const std::string& n) {  // sans #12 ni @id
  std::string r;
  for (size_t i = 0; i < n.size();) {
    if (n[i] == '#' && i + 1 < n.size() && isdigit(static_cast<unsigned char>(n[i + 1]))) {
      i++;
      while (i < n.size() && isdigit(static_cast<unsigned char>(n[i]))) i++;
    } else if (n[i] == '@' && i + 1 < n.size() && (isalnum(static_cast<unsigned char>(n[i + 1])) || n[i + 1] == '_')) {
      i++;
      while (i < n.size() && (isalnum(static_cast<unsigned char>(n[i])) || n[i] == '_')) i++;
    } else {
      r += n[i++];
    }
  }
  return r;
}
std::vector<std::string> nomDecoupe(const std::string& nom) {
  int prof = 0;
  std::string cur;
  std::vector<std::string> fa;
  for (char c : nom) {
    if (c == '[') prof++;
    else if (c == ']') prof--;
    if (!prof && c == '<') break;
    if (!prof && c == '|') {
      fa.push_back(cur);
      cur.clear();
      continue;
    }
    cur += c;
  }
  fa.push_back(cur);
  return fa;
}
void remplace(std::string& s, const std::string& a, const std::string& b) {
  for (size_t i = 0; (i = s.find(a, i)) != std::string::npos; i += b.size()) s.replace(i, a.size(), b);
}
void nomGarde(json& o, const std::string& nomSrc, const json* vieux, const std::string& cle) {
  const std::string de = cle + "De", c = nomCle(nomSrc);
  o.erase(cle);
  if (!c.empty()) o[de] = c;
  else o.erase(de);
  if (vieux && vieux->is_object() && vraiJs(*vieux, cle.c_str()) && !c.empty() && (!vieux->contains(de) || nomPropre(str(*vieux, de.c_str())) == nomPropre(c))) o[cle] = (*vieux)[cle];
}
bool nomCopieOk(const std::string& nomCopie, const std::string& nomSrc, const TableIds& ids) {
  if (nomCopie.empty() || nomSrc.empty()) return true;
  std::set<std::string> a;
  for (const std::string& x : nomDecoupe(nomCle(nomCopie))) a.insert(nomPropre(x));
  for (const std::string& brut : nomDecoupe(nomCle(nomSrc))) {
    const std::string x = nomPropre(brut);
    std::string y = x;
    for (const auto& q : ids) remplace(y, q.first, q.second);
    if (y != x && !a.count(y)) return false;
  }
  return true;
}
void nomsListe(const json& src, json& nouv, const json* vieux, const std::string& cle, const TableIds& ids) {
  if (!src.is_array() || !nouv.is_array()) return;
  for (size_t k = 0; k < nouv.size(); k++) {
    json& o = nouv[k];
    if (!o.is_object()) continue;
    const json* ov = vieux && vieux->is_array() && k < vieux->size() ? &(*vieux)[k] : nullptr;
    const json* s = k < src.size() && src[k].is_object() ? &src[k] : nullptr;
    const std::string ns = s ? str(*s, cle.c_str()) : std::string();
    nomGarde(o, ns, ov, cle);
    if (vraiJs(o, cle.c_str()) && s && !nomCopieOk(str(o, cle.c_str()), ns, ids)) o.erase(cle);
  }
}

// ── le document ──────────────────────────────────────────────────────────────
struct Regeneration {
  json& doc;
  json& fonctions;
  json& esquisses;
  int compteur = 0;

  json* fonction(const std::string& id) {
    for (json& f : fonctions)
      if (str(f, "id") == id) return &f;
    return nullptr;
  }
  json* esquisse(const std::string& id) {
    if (id.empty()) return nullptr;
    for (json& s : esquisses)
      if (str(s, "id") == id) return &s;
    return nullptr;
  }
  std::string neuf(const char* prefixe) { return std::string(prefixe) + "_rep" + std::to_string(++compteur); }

  json faceRef(const json& r, int i, const std::map<std::string, std::string>& skMap, const Transfo& c) {
    if (!r.is_object() || !tableau(r, "pos")) return r;
    json o = r;
    o.erase("_ord");
    o.erase("nom");
    o["pos"] = arrondi(transPoint(vec(r["pos"]), i, c), 3);
    if (tableau(r, "n")) o["n"] = arrondi(norme(transVec(vec(r["n"]), i, c)), 4);
    if (tableau(r, "dim")) o["dim"] = arrondi(transDim(vec(r["dim"]), i, c), 3);
    const auto a = r.find("anchor");
    const auto m = a != r.end() && a->is_object() ? skMap.find(str(*a, "sk")) : skMap.end();
    if (m != skMap.end()) o["anchor"]["sk"] = m->second;
    else o.erase("anchor");
    return o;
  }

  // Base de l'esquisse porteuse : ses axes, sinon le plan d'origine
  static void baseDe(const json& s, V3& u, V3& v, V3& n) {
    if (vraiJs(s, "axU") && vraiJs(s, "axV") && vraiJs(s, "axN")) {
      u = vec(s["axU"]);
      v = vec(s["axV"]);
      n = vec(s["axN"]);
      return;
    }
    const std::string p = str(s, "plane");
    if (p == "XZ") {
      u = {1, 0, 0};
      v = {0, 0, 1};
      n = {0, -1, 0};
    } else if (p == "YZ") {
      u = {0, 1, 0};
      v = {0, 0, 1};
      n = {1, 0, 0};
    } else {
      u = {1, 0, 0};
      v = {0, 1, 0};
      n = {0, 0, 1};
    }
  }

  std::string cloneEsquisse(const json& sk, int i, std::map<std::string, std::string>& skMap, const TableIds& featMap, const Transfo& c, json* reuse) {
    const std::string idSrc = str(sk, "id");
    if (!reuse) {
      const auto d = skMap.find(idSrc);
      if (d != skMap.end() && !d->second.empty()) return d->second;
    }
    json ns = sk;
    if (tableau(ns, "entities"))
      for (json& e : ns["entities"]) {
        if (!e.is_object()) continue;
        const std::string srcNom = str(e, "srcNom");
        const json* old = nullptr;
        if (reuse && tableau(*reuse, "entities"))
          for (const json& x : (*reuse)["entities"])
            if (str(x, "id") == str(e, "id")) {
              old = &x;
              break;
            }
        nomGarde(e, srcNom, old, "srcNom");
      }
    if (!ns.contains("origin") || !vraiJs(ns, "origin")) ns["origin"] = json::array({0, 0, 0});
    if (!(vraiJs(ns, "axU") && vraiJs(ns, "axV") && vraiJs(ns, "axN"))) {
      V3 u, v, n;
      const std::string p = str(ns, "plane");
      json nu = json::object();
      nu["plane"] = p;
      baseDe(nu, u, v, n);
      ns["axU"] = u;
      ns["axV"] = v;
      ns["axN"] = n;
    }
    ns["name"] = (str(sk, "name").empty() ? std::string("Esquisse") : str(sk, "name")) + " (rép " + std::to_string(i) + ")";
    ns["origin"] = arrondi(transPoint(vec(ns["origin"]), i, c), 6);
    ns["axU"] = arrondi(transVec(vec(ns["axU"]), i, c), 9);
    ns["axV"] = arrondi(transVec(vec(ns["axV"]), i, c), 9);
    ns["axN"] = arrondi(transVec(vec(ns["axN"]), i, c), 9);
    if (str(ns, "plane") == "CG") {
      ns["plane"] = "FACE";
      ns.erase("cg");
    }
    ns["visible"] = false;
    // L'hôte hors de la répétition : la copie reste dans le plan de sa face, décalée d'autant
    const auto garderHote = [&]() {
      json& h = ns["host"];
      const json* hf = fonction(str(h, "feat"));
      const json* hs = hf ? esquisse(str(*hf, "sketchId")) : nullptr;
      if (!hs || str(h, "tag") == "SIDE" || !vraiJs(sk, "origin")) return false;
      V3 bu, bv, bn;
      baseDe(*hs, bu, bv, bn);
      const V3 o0 = vec(sk["origin"]), o1 = vec(ns["origin"]);
      const V3 n1 = tableau(ns, "axN") ? vec(ns["axN"]) : V3{0, 0, 1};
      const V3 d{o1[0] - o0[0], o1[1] - o0[1], o1[2] - o0[2]};
      if (std::abs(std::abs(scal(n1, bn)) - 1) > 1e-6 || std::abs(scal(d, bn)) > 1e-4) return false;
      h["x"] = fixe(num(h, "x") + scal(d, bu), 3);
      h["y"] = fixe(num(h, "y") + scal(d, bv), 3);
      return true;
    };
    bool aHote = ns.contains("host") && ns["host"].is_object() && vraiJs(ns["host"], "feat");
    const std::string hoteFeat = aHote ? str(ns["host"], "feat") : std::string();
    if (aHote && idDe(featMap, hoteFeat) && !idDe(featMap, hoteFeat)->empty()) ns["host"]["feat"] = *idDe(featMap, hoteFeat);
    else if (!(aHote && garderHote())) ns.erase("host");
    if (ns.contains("host") && tableau(ns["host"], "mv"))
      for (json& m : ns["host"]["mv"])
        if (const std::string* q = idDe(featMap, str(m, "id"))) m["id"] = *q;
    if (reuse) {
      const std::string garde = str(*reuse, "id");
      ns["id"] = garde;
      *reuse = std::move(ns);
      skMap[idSrc] = garde;
      return garde;
    }
    const std::string id = neuf("sk");
    ns["id"] = id;
    esquisses.push_back(std::move(ns));
    skMap[idSrc] = id;
    return id;
  }

  // revolveAxis2D : point et direction 2D de l'axe, dans l'esquisse
  static bool axeRevolution(const json& sk, const json& f, double& px, double& py, double& dx, double& dy) {
    const auto ax = f.find("axis");
    if (ax == f.end() || !ax->is_object()) return false;
    if (str(*ax, "k") == "line") {
      if (!tableau(sk, "entities") || !sk.contains("points")) return false;
      for (const json& e : sk["entities"]) {
        if (str(e, "id") != str(*ax, "id")) continue;
        if (str(e, "t") != "line") return false;
        const auto& P = sk["points"];
        const auto a = P.find(str(e, "p1")), b = P.find(str(e, "p2"));
        if (a == P.end() || b == P.end()) return false;
        const double ex = num(*b, "x") - num(*a, "x"), ey = num(*b, "y") - num(*a, "y"), L = hyp(ex, ey);
        if (!(L > 1e-9)) return false;
        px = num(*a, "x");
        py = num(*a, "y");
        dx = ex / L;
        dy = ey / L;
        return true;
      }
      return false;
    }
    if (str(*ax, "k") != "sys" || str(*ax, "d").empty()) return false;
    const std::string want = str(*ax, "d");
    const V3 w = want == "X" ? V3{1, 0, 0} : want == "Y" ? V3{0, 1, 0} : V3{0, 0, 1};
    V3 u, v, n;
    baseDe(sk, u, v, n);
    const double d = scal(w, n);
    const V3 p{w[0] - n[0] * d, w[1] - n[1] * d, w[2] - n[2] * d};
    const double L = hyp3(p[0], p[1], p[2]);
    if (!(L > 1e-9)) return false;
    const V3 q{p[0] / L, p[1] / L, p[2] / L};
    px = py = 0;
    dx = scal(q, u);
    dy = scal(q, v);
    return true;
  }

  bool cloneFonction(const json& f, int i, std::map<std::string, std::string>& skMap, TableIds& featMap, const Transfo& c, json* reuse, json& nf) {
    nf = f;
    nf.erase("_m");
    nf.erase("_mesh");
    nf["visible"] = true;
    const std::string fid = str(f, "id"), type = str(f, "type");
    nf["_src"] = fid;
    const char* pre = type == "xfillet" ? "xf" : type == "hole" ? "ho" : type == "xdraft" ? "dr" : type == "revolve" ? "rv" : type == "sweep" ? "sw" : type == "xmove" ? "mv" : type == "xdelface" ? "df" : "ex";
    const std::string target = reuse ? str(*reuse, "id") : neuf(pre);
    if (type == "extrude" || type == "hole" || type == "revolve" || type == "sweep") {
      const json* skp = esquisse(str(f, "sketchId"));
      if (!skp) return false;
      const json sk = *skp;  // le clone peut agrandir la liste des esquisses
      poserId(featMap, fid, target);
      json* reuseSk = reuse ? esquisse(str(*reuse, "sketchId")) : nullptr;
      nf["sketchId"] = cloneEsquisse(sk, i, skMap, featMap, c, reuseSk);
      if (type == "sweep") {
        const json* pkp = esquisse(str(f, "pathId"));
        if (!pkp) return false;
        const json pk = *pkp;
        json* reusePk = reuse ? esquisse(str(*reuse, "pathId")) : nullptr;
        nf["pathId"] = cloneEsquisse(pk, i, skMap, featMap, c, reusePk);
      }
      if (nf.contains("upto") && nf["upto"].is_object() && vraiJs(nf["upto"], "ex")) {
        if (const std::string* q = idDe(featMap, str(nf["upto"], "ex"))) nf["upto"]["ex"] = *q;
        else nf["upto"] = nullptr;
      }
      if (type == "revolve") {
        double px = 0, py = 0, dx = 0, dy = 0;
        json* ns = esquisse(str(nf, "sketchId"));
        if (ns && axeRevolution(sk, f, px, py, dx, dy)) {
          const double inv = c.mode == "mir" ? -1 : 1;
          if (!ns->contains("points") || !(*ns)["points"].is_object()) (*ns)["points"] = json::object();
          (*ns)["points"]["_rvA"] = {{"x", px}, {"y", py}};
          (*ns)["points"]["_rvB"] = {{"x", px + 10 * inv * dx}, {"y", py + 10 * inv * dy}};
          json ents = json::array();
          if (tableau(*ns, "entities"))
            for (const json& e : (*ns)["entities"])
              if (str(e, "id") != "_rvax") ents.push_back(e);
          ents.push_back({{"id", "_rvax"}, {"t", "line"}, {"p1", "_rvA"}, {"p2", "_rvB"}, {"construction", true}});
          (*ns)["entities"] = std::move(ents);
          nf["axis"] = {{"k", "line"}, {"id", "_rvax"}};
        }
      }
    } else {
      poserId(featMap, fid, target);
      if (type == "xfillet" && tableau(f, "edges")) {
        json L = json::array();
        for (const json& s : f["edges"]) {
          json o = s;
          const auto an = s.find("anchor");
          const auto m = an != s.end() && an->is_object() ? skMap.find(str(*an, "sk")) : skMap.end();
          if (m != skMap.end()) o["anchor"]["sk"] = m->second;
          else o.erase("anchor");
          const V3 pos = vec(s.value("pos", json::array()));
          o["pos"] = arrondi(transPoint(pos, i, c), 6);
          // Fichier juste ouvert : la source est au repos, la copie part de l'endroit où elle est
          const V3 p0 = vraiJs(s, "pos0") ? vec(s["pos0"]) : pos;
          const bool loin = hyp3(pos[0] - p0[0], pos[1] - p0[1], pos[2] - p0[2]) > 2;
          o["pos0"] = loin ? o["pos"] : arrondi(transPoint(p0, i, c), 6);
          if (tableau(s, "fn") && s["fn"].size() == 3) o["fn"] = arrondi(norme(transVec(vec(s["fn"]), i, c)), 4);
          o.erase("_div");
          L.push_back(std::move(o));
        }
        nf["edges"] = std::move(L);
      }
      const auto listeFaces = [&]() {
        json L = json::array();
        if (tableau(f, "faces"))
          for (const json& r : f["faces"]) L.push_back(faceRef(r, i, skMap, c));
        return L;
      };
      if (type == "xdraft") {
        nf["faces"] = listeFaces();
        const json r0 = f.value("ref", json());
        const json r1 = faceRef(r0, i, skMap, c);
        bool meme = false;
        if (r0.is_object() && tableau(r0, "n") && r1.is_object() && tableau(r1, "n")) {
          const V3 n0 = norme(vec(r0["n"])), a = vec(r1["pos"]), b = vec(r0["pos"]);
          meme = scal(n0, vec(r1["n"])) > 0.9999 && std::abs(scal(n0, {a[0] - b[0], a[1] - b[1], a[2] - b[2]})) < 1e-3;
        }
        nf["ref"] = meme ? r0 : r1;
        nf.erase("_m");
      }
      if (type == "xmove") {
        nf["ref"] = faceRef(f.value("ref", json()), i, skMap, c);
        if (tableau(f, "faces")) nf["faces"] = listeFaces();
      }
      if (type == "xdelface") {
        nf["faces"] = listeFaces();
        nf.erase("_m");
        nf.erase("_err");
      }
    }
    // Noms des références : ceux de la copie, pas ceux de la source
    if (type == "xfillet" && tableau(f, "edges")) {
      const json* ve = reuse && tableau(*reuse, "edges") ? &(*reuse)["edges"] : nullptr;
      nomsListe(f["edges"], nf["edges"], ve, "nom", featMap);
      if (ve)
        for (size_t k = 0; k < nf["edges"].size() && k < ve->size(); k++)
          if (vraiJs(nf["edges"][k], "nom") && tableau((*ve)[k], "pos0")) nf["edges"][k]["pos0"] = (*ve)[k]["pos0"];
    }
    if ((type == "xdraft" || type == "xmove" || type == "xdelface") && tableau(f, "faces") && tableau(nf, "faces")) nomsListe(f["faces"], nf["faces"], reuse && tableau(*reuse, "faces") ? &(*reuse)["faces"] : nullptr, "nom", featMap);
    if ((type == "xmove" || type == "xdraft") && nf.contains("ref") && nf["ref"].is_object() && f.contains("ref") && f["ref"].is_object() && !vraiJs(nf["ref"], "nom"))
      nomGarde(nf["ref"], str(f["ref"], "nom"), reuse && reuse->contains("ref") ? &(*reuse)["ref"] : nullptr, "nom");
    nf["name"] = str(f, "name").empty() ? std::string("Fonction") : str(f, "name");
    nf["id"] = target;
    return true;
  }

  // ── corps des exemplaires (répétition « nouveau corps ») ──
  std::string corpsDeFonction(const json& f) {
    const std::string b = str(f, "body");
    if (doc.contains("bodies") && doc["bodies"].is_array()) {
      for (const json& e : doc["bodies"])
        if (!b.empty() && str(e, "id") == b) return b;
      if (!doc["bodies"].empty()) return str(doc["bodies"][0], "id");
    }
    return std::string();
  }
  std::string corpsPour(json& rp, const std::string& cle, const std::string& src) {
    if (!rp.contains("bodyMap") || !rp["bodyMap"].is_object()) rp["bodyMap"] = json::object();
    const std::string bid = str(rp["bodyMap"], cle.c_str());
    if (!doc.contains("bodies") || !doc["bodies"].is_array()) doc["bodies"] = json::array();
    if (!bid.empty())
      for (const json& e : doc["bodies"])
        if (str(e, "id") == bid) return bid;
    json se = json::object();
    for (const json& e : doc["bodies"])
      if (str(e, "id") == src) se = e;
    const int n = static_cast<int>(num(doc, "bodySeq"));
    doc["bodySeq"] = n + 1;
    std::string tag;
    for (size_t p = cle.find('@'); p != std::string::npos;) {
      const size_t q = cle.find('@', p + 1);
      tag += (tag.empty() ? "" : "·") + cle.substr(p + 1, q == std::string::npos ? q : q - p - 1);
      p = q;
    }
    json e = {{"id", "b" + std::to_string(n)}, {"name", (str(se, "name").empty() ? std::string("Corps") : str(se, "name")) + " (rép " + tag + ")"}, {"c", se.value("c", json())}};
    if (num(se, "color") > 0) e["color"] = se["color"];
    if (num(se, "op") > 0) e["op"] = se["op"];
    const std::string id = str(e, "id");
    doc["bodies"].push_back(std::move(e));
    rp["bodyMap"][cle] = id;
    return id;
  }

  std::vector<json> developpeSources(const std::vector<std::string>& ids, std::set<std::string>& vus) {
    std::vector<std::pair<int, const json*>> liste;
    for (const std::string& id : ids)
      for (size_t k = 0; k < fonctions.size(); k++)
        if (str(fonctions[k], "id") == id) {
          liste.push_back({static_cast<int>(k), &fonctions[k]});
          break;
        }
    std::stable_sort(liste.begin(), liste.end(), [](const auto& a, const auto& b) { return a.first < b.first; });
    std::vector<json> out;
    for (const auto& q : liste) {
      const json& f = *q.second;
      const std::string id = str(f, "id");
      if (vus.count(id)) continue;
      vus.insert(id);
      if (str(f, "type") != "repeat") {
        out.push_back(f);
        continue;
      }
      std::vector<std::string> base;
      if (tableau(f, "base"))
        for (const json& x : f["base"])
          if (x.is_string()) base.push_back(x.get<std::string>());
      for (json& g : developpeSources(base, vus)) out.push_back(std::move(g));
      for (const json& k : fonctions)
        if (str(k, "repeatId") == id && !vus.count(str(k, "id"))) {
          vus.insert(str(k, "id"));
          out.push_back(k);
        }
    }
    return out;
  }

  void regenerer(const std::string& idRep) {
    json* prp = fonction(idRep);
    if (!prp) return;
    const std::string mode = str(*prp, "mode");
    if (mode == "path") return;  // pas encore repris : les copies du fichier restent
    std::vector<json> olds;
    for (const json& f : fonctions)
      if (str(f, "repeatId") == idRep) olds.push_back(f);
    json rp = *prp;
    // Une répétition source (pas soi-même, pas une instance) est développée en son motif
    std::vector<std::string> baseIds;
    {
      json nb = json::array();
      if (tableau(rp, "base"))
        for (const json& x : rp["base"]) {
          if (!x.is_string()) continue;
          const std::string id = x.get<std::string>();
          const json* b = fonction(id);
          if (b && id != idRep && str(*b, "repeatId").empty()) {
            nb.push_back(x);
            baseIds.push_back(id);
          }
        }
      rp["base"] = std::move(nb);
    }
    if (!baseIds.empty()) {
      const json* s0 = fonction(baseIds[0]);
      if (s0 && vraiJs(*s0, "body")) rp["body"] = (*s0)["body"];
    }
    const auto maxCopies = [](double v) {
      const double n = std::floor(v != 0 ? v : 1);
      return static_cast<int>(std::min<double>(REPEAT_MAX, std::max(1.0, n)));
    };
    const int n = mode == "mir" ? 1 : maxCopies(num(rp, "copies"));
    std::set<std::string> vus{idRep};
    const std::vector<json> base = developpeSources(baseIds, vus);
    const bool mir2 = mode == "mir" && vraiJs(rp, "plane2");
    Transfo cfg = transfoDe(rp), cfg2 = cfg;
    bool memePlan = false;
    if (mir2) {
      cfg2.plan = str(rp, "plane2");
      cfg2.aPlanN = tableau(rp, "planeN2");
      if (cfg2.aPlanN) cfg2.planN = vec(rp["planeN2"]);
      const V3 n1 = normalePlan(cfg), n2 = normalePlan(cfg2);
      memePlan = !(std::abs(scal(n1, n2)) < 0.999);
      rp["_samePlane"] = memePlan;
    } else {
      rp.erase("_samePlane");
    }
    // Recyclage : (index, type), priorité à celle dont la source correspond
    std::map<std::string, std::vector<const json*>> g;
    for (const json& c : olds) {
      const int ri = static_cast<int>(num(c, "repIndex"));
      g[std::to_string(ri ? ri : 1) + "|" + str(c, "type")].push_back(&c);
    }
    const auto prendre = [&](int i, const std::string& t, const std::string& src) -> const json* {
      auto& arr = g[std::to_string(i) + "|" + t];
      auto it = std::find_if(arr.begin(), arr.end(), [&](const json* x) { return str(*x, "_src") == src; });
      if (it == arr.end()) it = arr.begin();
      if (it == arr.end()) return nullptr;
      const json* c = *it;
      arr.erase(it);
      return c;
    };
    std::set<std::string> gardes;  // ids d'instances recyclées
    std::set<std::string> corpsUtiles;
    const bool nouveauCorps = str(rp, "op") == "new";
    const auto poserCorps = [&](json& nf, const json& src, int idx) {
      if (!nouveauCorps) {
        nf.erase("repBodyKey");
        return true;
      }
      nf.erase("cutBodies");
      const std::string sb = corpsDeFonction(src);
      const bool deRep = str(src, "repeatId") == idRep && vraiJs(src, "repBodyKey");
      const std::string cle = (deRep ? str(src, "repBodyKey") : sb) + "@" + std::to_string(idx);
      if (tableau(rp, "dropKeys"))
        for (const json& x : rp["dropKeys"])
          if (x.is_string() && x.get<std::string>() == cle) return false;
      nf["repBodyKey"] = cle;
      const std::string corps = corpsPour(rp, cle, deRep ? str(src, "repBodyKey").substr(0, str(src, "repBodyKey").find('@')) : sb);
      nf["body"] = corps;
      corpsUtiles.insert(corps);
      return true;
    };
    std::vector<json> kids;
    const auto passe = [&](const std::vector<json>& sources, const Transfo& c, int idx) {
      std::map<std::string, std::string> skMap;
      TableIds featMap;
      std::vector<json> L;
      for (const json& f : sources) {
        const json* old = prendre(idx, str(f, "type"), str(f, "id"));
        json nf, copie;
        if (old) copie = *old;
        if (!cloneFonction(f, idx, skMap, featMap, c, old ? &copie : nullptr, nf)) continue;
        nf["repeatId"] = idRep;
        nf["repIndex"] = idx;
        if (!poserCorps(nf, f, idx)) continue;
        if (old) gardes.insert(str(*old, "id"));
        L.push_back(std::move(nf));
      }
      return L;
    };
    json enfants = json::array();
    if (mode == "mir") {
      std::vector<json> k1 = passe(base, cfg, 1), k2;
      if (mir2 && !memePlan) {
        std::vector<json> s2;
        for (const json& f : base) {
          s2.push_back(f);
          for (const json& k : k1)
            if (str(k, "_src") == str(f, "id")) {
              s2.push_back(k);
              break;
            }
        }
        k2 = passe(s2, cfg2, 2);
      }
      kids = std::move(k1);
      for (json& k : k2) kids.push_back(std::move(k));
      for (const json& k : kids) enfants.push_back(k["id"]);
    } else {
      // Linéaire : une instance par case de grille (une seule direction = une ligne)
      std::vector<V3> cases;
      if (mode == "lin") {
        const int n1 = maxCopies(num(rp, "copies"));
        const V3 d1 = fois(axeDe(cfg), num(rp, "dist"));
        if (!vraiJs(rp, "lin2")) {
          for (int i = 1; i <= n1; i++) cases.push_back(fois(d1, i));
        } else {
          const int n2 = maxCopies(num(rp, "copies2"));
          const bool aDir2 = tableau(rp, "dir2");
          const V3 d2 = fois(axeDe(str(rp, "axis2"), aDir2, aDir2 ? vec(rp["dir2"]) : V3{}), num(rp, "dist2"));
          for (int j = 0; j <= n2 && static_cast<int>(cases.size()) < REPEAT_MAX; j++)
            for (int i = 0; i <= n1 && static_cast<int>(cases.size()) < REPEAT_MAX; i++)
              if (i || j) cases.push_back(plus(fois(d1, i), fois(d2, j)));
        }
      }
      const int N = mode == "lin" ? static_cast<int>(cases.size()) : n;
      for (int i = 1; i <= N; i++) {
        Transfo c = cfg;
        if (mode == "lin") {
          c.aDecalage = true;
          c.decalage = cases[i - 1];
        }
        std::vector<json> L = passe(base, c, i);
        for (json& k : L) {
          enfants.push_back(k["id"]);
          kids.push_back(std::move(k));
        }
      }
    }
    rp["children"] = std::move(enfants);
    // Esquisses des instances perdues
    for (const json& c : olds) {
      if (gardes.count(str(c, "id"))) continue;
      for (const char* cle : {"sketchId", "pathId"}) {
        const std::string sid = str(c, cle);
        if (sid.empty()) continue;
        bool ailleurs = false;
        for (const json& x : fonctions)
          if (str(x, "id") != str(c, "id") && (str(x, "sketchId") == sid || str(x, "pathId") == sid)) ailleurs = true;
        if (ailleurs) continue;
        json reste = json::array();
        for (json& s : esquisses)
          if (str(s, "id") != sid) reste.push_back(std::move(s));
        esquisses = std::move(reste);
      }
    }
    json liste = json::array();
    for (json& f : fonctions) {
      if (str(f, "repeatId") == idRep) continue;
      if (str(f, "id") == idRep) {
        liste.push_back(rp);
        for (json& k : kids) liste.push_back(std::move(k));
      } else {
        liste.push_back(std::move(f));
      }
    }
    fonctions = std::move(liste);
    // Corps d'exemplaires devenus inutiles
    json* r2 = fonction(idRep);
    if (r2 && r2->contains("bodyMap") && (*r2)["bodyMap"].is_object()) {
      json nouvelle = json::object();
      for (auto it = (*r2)["bodyMap"].begin(); it != (*r2)["bodyMap"].end(); ++it) {
        const std::string b = it->is_string() ? it->get<std::string>() : std::string();
        if (corpsUtiles.count(b)) {
          nouvelle[it.key()] = *it;
          continue;
        }
        bool porte = b.empty();
        for (const json& x : fonctions) {
          if (str(x, "body") == b || str(x, "newBody") == b) porte = true;
          if (str(x, "type") == "combine" && tableau(x, "tools"))
            for (const json& t : x["tools"])
              if (t.is_string() && t.get<std::string>() == b) porte = true;
        }
        if (!porte && doc.contains("bodies") && doc["bodies"].is_array()) {
          json reste = json::array();
          for (json& e : doc["bodies"])
            if (str(e, "id") != b) reste.push_back(std::move(e));
          doc["bodies"] = std::move(reste);
        }
      }
      if (nouvelle.empty()) r2->erase("bodyMap");
      else (*r2)["bodyMap"] = std::move(nouvelle);
    }
  }
};

std::vector<std::string> idsDe(const json& liste) {
  std::vector<std::string> v;
  if (liste.is_array())
    for (const json& x : liste) v.push_back(str(x, "id"));
  return v;
}
}  // namespace

bool regenererRepetitions(json& doc) {
  if (!doc.contains("features") || !doc["features"].is_array() || !doc.contains("sketches") || !doc["sketches"].is_array()) return false;
  std::vector<std::string> ids;
  for (const json& f : doc["features"])
    if (str(f, "type") == "repeat") ids.push_back(str(f, "id"));
  if (ids.empty()) return false;
  // Le fichier s'enregistre par rang : si les listes changent, ses copies restent telles quelles
  json essai = doc;
  const auto idsF = idsDe(doc["features"]), idsS = idsDe(doc["sketches"]), idsC = idsDe(doc.value("bodies", json::array()));
  try {
    Regeneration r{essai, essai["features"], essai["sketches"]};
    for (const std::string& id : ids) r.regenerer(id);
  } catch (const std::exception&) {
    return false;
  }
  if (idsDe(essai["features"]) != idsF || idsDe(essai["sketches"]) != idsS || idsDe(essai.value("bodies", json::array())) != idsC) return false;
  doc = std::move(essai);
  return true;
}
