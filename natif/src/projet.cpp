#include "projet.h"

#include <cmath>
#include <cstdio>
#include <map>
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <zlib.h>

// ordered_json : garde l'ordre des clés du fichier, comme un objet JavaScript. L'ordre des points
// décide du point gardé quand deux points quasi confondus fusionnent (skLoopTrace, src/10-scene-3d.js).
using json = nlohmann::ordered_json;

Esquisse* Document::esquisse(const std::string& id) {
  for (auto& s : esquisses)
    if (s.id == id) return &s;
  return nullptr;
}
const Fonction* Document::fonction(const std::string& id) const {
  for (auto& f : fonctions)
    if (f.id == id) return &f;
  return nullptr;
}

bool memesLiens(const Esquisse& a, const Esquisse& b) {
  if (a.ordre != b.ordre || a.seq != b.seq || a.entites.size() != b.entites.size() || a.contraintes.size() != b.contraintes.size() || a.cotes.size() != b.cotes.size()) return false;
  for (size_t i = 0; i < a.entites.size(); i++) {
    const Entite& x = a.entites[i];
    const Entite& y = b.entites[i];
    if (x.id != y.id || x.t != y.t || x.p1 != y.p1 || x.p2 != y.p2 || x.pc != y.pc || x.pa != y.pa || x.pb != y.pb || x.p != y.p || x.construction != y.construction || x.poly != y.poly || x.pts != y.pts || x.closed != y.closed || x.knots != y.knots || x.handle != y.handle) return false;
  }
  for (size_t i = 0; i < a.contraintes.size(); i++) {
    const Contrainte& x = a.contraintes[i];
    const Contrainte& y = b.contraintes[i];
    if (x.id != y.id || x.type != y.type || x.p != y.p || x.line != y.line || x.ent != y.ent || x.a != y.a || x.b != y.b || x.mid != y.mid || x.c != y.c || x.d != y.d || x.s != y.s || x.inf != y.inf) return false;
  }
  for (size_t i = 0; i < a.cotes.size(); i++) {
    const Cote& x = a.cotes[i];
    const Cote& y = b.cotes[i];
    if (x.id != y.id || x.type != y.type || x.line != y.line || x.ent != y.ent || x.a != y.a || x.b != y.b || x.p != y.p || x.ref != y.ref || x.refV != y.refV || x.chk != y.chk || x.dia != y.dia) return false;
  }
  return true;
}

bool memesValeurs(const Esquisse& a, const Esquisse& b) {
  if (a.visible != b.visible) return false;
  if (a.ordre != b.ordre || a.seq != b.seq || a.entites.size() != b.entites.size() || a.contraintes.size() != b.contraintes.size() || a.cotes.size() != b.cotes.size()) return false;
  if (!memesLiens(a, b)) return false;
  for (const std::string& id : a.ordre) {
    const Pt* p = a.point(id);
    const Pt* q = b.point(id);
    if (!p || !q || p->x != q->x || p->y != q->y) return false;
  }
  for (size_t i = 0; i < a.entites.size(); i++)
    if (a.entites[i].id != b.entites[i].id || a.entites[i].r != b.entites[i].r || a.entites[i].srcMid != b.entites[i].srcMid) return false;
  for (size_t i = 0; i < a.cotes.size(); i++)
    if (a.cotes[i].id != b.cotes[i].id || a.cotes[i].type != b.cotes[i].type || a.cotes[i].value != b.cotes[i].value || a.cotes[i].sgn != b.cotes[i].sgn || a.cotes[i].ccw != b.cotes[i].ccw || a.cotes[i].ref != b.cotes[i].ref || a.cotes[i].chk != b.cotes[i].chk || a.cotes[i].dia != b.cotes[i].dia) return false;
  return true;
}

bool Document::profondeurModifiable(size_t i) const {
  const Esquisse* e = nullptr;
  for (const Esquisse& s : esquisses)
    if (s.id == fonctions[i].esquisse) e = &s;
  if (!e) return false;
  for (const Esquisse& s : esquisses) {
    bool lie = s.hote.existe;
    for (const Entite& x : s.entites) lie = lie || x.proj || x.ref;
    const double d = s.n[0] * e->n[0] + s.n[1] * e->n[1] + s.n[2] * e->n[2];
    if (lie && std::abs(d) < 1 - 1e-9) return false;
  }
  return true;
}

std::string lireOctets(const std::wstring& chemin) {
  FILE* f = _wfopen(chemin.c_str(), L"rb");
  if (!f) throw std::runtime_error("fichier introuvable ou illisible");
  std::string b;
  char tampon[65536];
  size_t n;
  while ((n = fread(tampon, 1, sizeof tampon, f)) > 0) b.append(tampon, n);
  fclose(f);
  return b;
}

std::string degonfler(const std::string& gz) {
  z_stream z{};
  if (inflateInit2(&z, 16 + MAX_WBITS) != Z_OK) throw std::runtime_error("décompression impossible");
  z.next_in = reinterpret_cast<Bytef*>(const_cast<char*>(gz.data()));
  z.avail_in = static_cast<uInt>(gz.size());
  std::string out;
  char tampon[262144];
  int r;
  do {
    z.next_out = reinterpret_cast<Bytef*>(tampon);
    z.avail_out = sizeof tampon;
    r = inflate(&z, Z_NO_FLUSH);
    if (r != Z_OK && r != Z_STREAM_END) {
      inflateEnd(&z);
      throw std::runtime_error("fichier compressé abîmé");
    }
    out.append(tampon, sizeof tampon - z.avail_out);
  } while (r != Z_STREAM_END);
  inflateEnd(&z);
  return out;
}

static std::string texte(const json& j, const char* k) {
  auto it = j.find(k);
  return it != j.end() && it->is_string() ? it->get<std::string>() : std::string();
}
static bool vrai(const json& j, const char* k) {
  auto it = j.find(k);
  if (it == j.end() || it->is_null()) return false;
  if (it->is_boolean()) return it->get<bool>();
  if (it->is_number()) return it->get<double>() != 0;
  if (it->is_string()) return !it->get<std::string>().empty();
  return true;
}
static bool vec3(const json& j, const char* k, Vec3& v) {
  auto it = j.find(k);
  if (it == j.end() || !it->is_array() || it->size() < 3 || !(*it)[0].is_number()) return false;
  for (int i = 0; i < 3; i++) v[i] = (*it)[i].get<double>();
  return true;
}

static void lireEsquisse(const json& js, Document& d, std::map<std::string, int>& refus) {
  Esquisse s;
  s.id = texte(js, "id");
  s.nom = texte(js, "name");
  s.plan = texte(js, "plane");
  s.visible = !(js.contains("visible") && js["visible"].is_boolean() && !js["visible"].get<bool>());
  if (auto x = js.find("seq"); x != js.end() && x->is_number() && x->get<int>() > 0) s.seq = x->get<int>();
  // planeBasis (src/10-scene-3d.js) : axes portés par l'esquisse, sinon les 3 plans d'origine
  Vec3 u, v, n;
  if (vec3(js, "axU", u) && vec3(js, "axV", v) && vec3(js, "axN", n)) {
    s.u = u;
    s.v = v;
    s.n = n;
  } else if (s.plan == "XZ") {
    s.u = {1, 0, 0};
    s.v = {0, 0, 1};
    s.n = {0, -1, 0};
  } else if (s.plan == "YZ") {
    s.u = {0, 1, 0};
    s.v = {0, 0, 1};
    s.n = {1, 0, 0};
  }
  vec3(js, "origin", s.o);
  if (js.contains("points") && js["points"].is_object())
    for (auto& [k, p] : js["points"].items()) {
      s.ordre.push_back(k);
      s.points[k] = Pt{p.value("x", 0.0), p.value("y", 0.0)};
    }
  if (js.contains("entities"))
    for (auto& je : js["entities"]) {
      Entite e;
      e.id = texte(je, "id");
      e.t = texte(je, "t");
      e.p1 = texte(je, "p1");
      e.p2 = texte(je, "p2");
      e.pc = texte(je, "pc");
      e.pa = texte(je, "pa");
      e.pb = texte(je, "pb");
      if (je.contains("r") && je["r"].is_number()) e.r = je["r"].get<double>();
      e.construction = vrai(je, "construction");
      e.ref = vrai(je, "ref");
      e.p = texte(je, "p");
      e.axe = vrai(je, "axis");
      e.handle = texte(je, "handle");
      e.poignee = !e.handle.empty();
      if (auto x = je.find("pts"); x != je.end() && x->is_array())
        for (auto& q : *x)
          if (q.is_string()) e.pts.push_back(q.get<std::string>());
      e.closed = vrai(je, "closed");
      e.mode = texte(je, "mode");
      if (auto x = je.find("knots"); x != je.end() && x->is_array())
        for (auto& q : *x)
          if (q.is_number()) e.knots.push_back(q.get<double>());
      if (auto x = je.find("deg"); x != je.end() && x->is_number()) e.deg = x->get<int>();
      e.proj = vrai(je, "proj");
      e.percage = vrai(je, "hole");
      e.ext = vrai(je, "isProj") || vrai(je, "isect") || vrai(je, "pierce") || vrai(je, "ext");
      e.aSrcMid = vec3(je, "srcMid", e.srcMid);
      e.suiviInconnu = e.ext || je.contains("srcNom") || je.contains("skSrc");
      if (auto x = je.find("poly"); x != je.end() && x->is_array())
        for (auto& q : *x)
          if (q.is_string()) e.poly.push_back(q.get<std::string>());
      if (e.t != "line" && e.t != "arc" && e.t != "circle" && e.t != "cpoint" && e.t != "spline" && !e.construction)
        refus["esquisse : « " + e.t + " »"]++;
      s.entites.push_back(std::move(e));
    }
  if (js.contains("constraints") && js["constraints"].is_array())
    for (auto& jc : js["constraints"]) {
      Contrainte c;
      c.id = texte(jc, "id");
      c.type = texte(jc, "type");
      c.c = texte(jc, "c");
      c.d = texte(jc, "d");
      c.inf = vrai(jc, "inf");
      if (auto x = jc.find("sa"); x != jc.end() && x->is_number()) c.sa = x->get<int>();
      if (auto x = jc.find("sb"); x != jc.end() && x->is_number()) c.sb = x->get<int>();
      c.p = texte(jc, "p");
      c.line = texte(jc, "line");
      c.ent = texte(jc, "ent");
      c.a = texte(jc, "a");
      c.b = texte(jc, "b");
      c.mid = texte(jc, "mid");
      c.s = texte(jc, "s");
      s.contraintes.push_back(std::move(c));
    }
  if (js.contains("dims") && js["dims"].is_array())
    for (auto& jd : js["dims"]) {
      Cote c;
      c.id = texte(jd, "id");
      c.type = texte(jd, "type");
      c.line = texte(jd, "line");
      c.ent = texte(jd, "ent");
      c.a = texte(jd, "a");
      c.b = texte(jd, "b");
      c.p = texte(jd, "p");
      c.orient = texte(jd, "orient");
      auto nb = [&](const char* k, double& v) {
        auto it = jd.find(k);
        if (it == jd.end() || !it->is_number()) return false;
        v = it->get<double>();
        return true;
      };
      nb("value", c.value);
      nb("ox", c.ox);
      nb("oy", c.oy);
      nb("sl", c.sl);
      c.aW = nb("w", c.w);
      double ccw = -1;
      if (nb("ccw", ccw)) c.ccw = static_cast<int>(ccw);
      double sgn = 0;
      if (nb("sgn", sgn) && (sgn == 1 || sgn == -1)) c.sgn = static_cast<int>(sgn);
      c.comp = vrai(jd, "comp");
      c.chk = vrai(jd, "chk");
      if (auto x = jd.find("refV"); x != jd.end() && x->is_number()) c.refV = x->get<int>();
      c.ref = vrai(jd, "ref");
      c.dia = vrai(jd, "dia");
      c.nom = texte(jd, "name");
      c.formuleFausse = jd.contains("exprErr") && !jd["exprErr"].is_null() && jd["exprErr"] != false && jd["exprErr"] != "";
      if (auto x = jd.find("expr"); x != jd.end() && !x->is_null()) {
        c.formule = !x->is_string() || x->get<std::string>().find_first_not_of(" \t\r\n") != std::string::npos;
      }
      s.cotes.push_back(std::move(c));
    }
  if (vrai(js, "cg")) refus["esquisse sur plan de construction"]++;
  if (js.contains("host") && js["host"].is_object()) {
    auto& h = js["host"];
    s.hote.feat = texte(h, "feat");
    s.hote.existe = !s.hote.feat.empty();
    if (h.contains("tag") && h["tag"].is_string()) s.hote.tag = h["tag"].get<std::string>();
    s.hote.edge = texte(h, "edge");
    s.hote.x = h.contains("x") && h["x"].is_number() ? h["x"].get<double>() : 0;
    s.hote.y = h.contains("y") && h["y"].is_number() ? h["y"].get<double>() : 0;
    if (h.contains("h") && h["h"].is_number()) {
      s.hote.h = h["h"].get<double>();
      s.hote.aH = true;
    }
  }
  d.esquisses.push_back(std::move(s));
}

// Le nom que connaît l'utilisateur : tous les types présents dans Exemples/. Un type inconnu reste affiché tel quel.
static std::string nomFonction(const std::string& t) {
  static const std::map<std::string, std::string> noms = {
      {"revolve", "révolution"}, {"hole", "perçage"}, {"xfillet", "congé ou chanfrein"}, {"xdraft", "dépouille"},
      {"bscale", "mise à l'échelle d'un corps"}, {"xsplit", "scission"}, {"bremove", "suppression d'un corps"},
      {"xmove", "déplacement de face"}, {"sweep", "balayage"}, {"combine", "combinaison de corps"},
      {"import", "pièce importée"}, {"bmove", "déplacement d'un corps"}, {"xdelface", "suppression de face"}};
  const auto it = noms.find(t);
  return it != noms.end() ? it->second : "fonction « " + t + " »";
}

static bool lireVec3(const json& j, const char* cle, Vec3& v) {
  auto x = j.find(cle);
  if (x == j.end() || !x->is_array() || x->size() != 3) return false;
  for (int k = 0; k < 3; k++) {
    if (!(*x)[k].is_number()) return false;
    v[k] = (*x)[k].get<double>();
  }
  return true;
}
static void lireConge(const json& jf, Fonction& f, std::map<std::string, int>& refus) {
  f.chamfer = vrai(jf, "chamfer");
  if (auto t = jf.find("tangent"); t != jf.end() && t->is_boolean()) f.tangent = t->get<bool>() ? 1 : 0;
  if (jf.contains("cmode") && jf["cmode"].is_string() && jf["cmode"].get<std::string>() != "eq" && f.visible) refus["chanfrein à deux distances ou à angle"]++;
  if (jf.contains("expr") && jf["expr"].is_object() && !jf["expr"].empty() && f.visible) refus["cote par formule"]++;
  if (!jf.contains("edges") || !jf["edges"].is_array()) return;
  for (auto& je : jf["edges"]) {
    if (!je.is_object()) continue;
    AreteConge a;
    const bool aPos = lireVec3(je, "pos", a.pos);
    a.aPos0 = lireVec3(je, "pos0", a.pos0);
    if (!aPos && a.aPos0) a.pos = a.pos0;
    if (je.contains("r") && je["r"].is_number()) a.r = je["r"].get<double>();
    if (je.contains("len") && je["len"].is_number()) a.len = je["len"].get<double>();
    a.seed = je.contains("seed") && (je["seed"].is_number() ? je["seed"].get<double>() != 0 : vrai(je, "seed"));
    a.nomAffiche = texte(je, "name");
    if (je.contains("expr") && je["expr"].is_object() && !je["expr"].empty() && f.visible) refus["cote par formule"]++;
    if (auto x = je.find("anchor"); x != je.end() && x->is_object()) {
      AncreArete& n = a.ancre;
      n.existe = true;
      n.t = texte(*x, "t");
      n.sk = texte(*x, "sk");
      n.id = texte(*x, "id");
      if (auto z = x->find("z"); z != x->end() && z->is_number()) {
        n.z = z->get<double>();
        n.aZ = true;
      }
      if (auto s = x->find("side"); s != x->end() && s->is_number()) {
        n.side = s->get<int>();
        n.aSide = true;
      }
      if (auto v = x->find("dist"); v != x->end() && v->is_number()) n.dist = v->get<double>();
      if (auto v = x->find("far"); v != x->end() && v->is_number()) n.loin = v->get<double>() != 0;
    }
    f.aretes.push_back(std::move(a));
  }
}

static void lireFonction(const json& jf, Document& d, std::map<std::string, int>& refus) {
  Fonction f;
  f.id = texte(jf, "id");
  f.type = texte(jf, "type");
  f.nom = texte(jf, "name");
  f.esquisse = texte(jf, "sketchId");
  f.corps = texte(jf, "body");
  if (jf.contains("op") && jf["op"].is_string()) f.op = jf["op"].get<std::string>();
  if (jf.contains("distance") && jf["distance"].is_number()) {
    f.distance = jf["distance"].get<double>();
    f.aDistance = true;
  }
  f.visible = !(jf.contains("visible") && jf["visible"].is_boolean() && !jf["visible"].get<bool>());
  f.mid = vrai(jf, "mid");
  f.flip = vrai(jf, "flip");
  f.through = vrai(jf, "through");
  if (f.type == "xfillet") lireConge(jf, f, refus);
  // La répétition se contente de créer des copies, rejouées comme des fonctions : sans effet ici.
  if (f.visible && f.type != "extrude" && f.type != "repeat" && f.type != "xfillet") refus[nomFonction(f.type)]++;
  if (f.visible && f.type == "extrude") {
    if (vrai(jf, "upto")) refus["extrusion « jusqu'à un objet »"]++;
    if (vrai(jf, "draft")) refus["extrusion avec dépouille"]++;
    if (vrai(jf, "repeatId")) refus["extrusion copiée par une répétition"]++;
    if (jf.contains("profiles") && jf["profiles"].is_array() && !jf["profiles"].empty())
      refus["extrusion limitée à certaines zones"]++;
    if (jf.contains("cutBodies") && jf["cutBodies"].is_array() && !jf["cutBodies"].empty())
      refus["découpe dans plusieurs corps"]++;
    if (jf.contains("expr") && jf["expr"].is_object() && !jf["expr"].empty()) refus["cote par formule"]++;
  }
  d.fonctions.push_back(std::move(f));
}

Document lireProjet(const std::wstring& chemin) {
  std::string octets = lireOctets(chemin);
  const bool compresse = octets.size() >= 2 && static_cast<unsigned char>(octets[0]) == 0x1f && static_cast<unsigned char>(octets[1]) == 0x8b;
  std::string b = compresse ? degonfler(octets) : octets;
  json racine;
  try {
    racine = json::parse(b);
  } catch (const std::exception&) {
    throw std::runtime_error("ce n'est pas un projet ConceptCAD lisible");
  }
  b.clear();
  b.shrink_to_fit();
  const bool lot = racine.contains("doc") && racine["doc"].is_object();
  const json& j = lot ? racine["doc"] : racine;
  if (!j.contains("features") || !j.contains("sketches")) throw std::runtime_error("ce fichier ne contient pas de pièce");

  Document d;
  std::map<std::string, int> refus;
  d.chemin = chemin;
  d.octets = std::move(octets);
  d.compresse = compresse;
  d.nom = texte(j, "name");
  if (j.contains("bodies"))
    for (auto& c : j["bodies"]) {
      d.corps.push_back(texte(c, "id"));
      d.nomsCorps.push_back(texte(c, "name"));
    }
  if (d.corps.empty()) d.corps.push_back("b1");
  // ensureActiveBody : l'actif s'il existe, sinon le premier
  d.corpsActif = texte(j, "activeBody");
  if (std::find(d.corps.begin(), d.corps.end(), d.corpsActif) == d.corps.end()) d.corpsActif = d.corps[0];
  if (auto x = j.find("entNames"); x != j.end() && x->is_object()) {
    if (auto y = x->find("face"); y != x->end() && y->is_number()) d.nomsFace = y->get<int>();
    if (auto y = x->find("edge"); y != x->end() && y->is_number()) d.nomsArete = y->get<int>();
  }
  for (auto& s : j["sketches"]) lireEsquisse(s, d, refus);
  for (auto& f : j["features"]) lireFonction(f, d, refus);
  if (j.contains("params") && j["params"].is_array() && !j["params"].empty()) refus["paramètres nommés"]++;
  if (lot && racine.contains("imports") && !racine["imports"].empty()) refus["fichier importé"]++;
  if (j.contains("asm") && j["asm"].is_object()) refus["assemblage"]++;
  if (j.contains("components") && j["components"].is_array() && !j["components"].empty()) refus["assemblage"]++;
  for (auto& [k, n] : refus) d.nonPrisEnCharge.push_back(k + " × " + std::to_string(n));
  d.esquissesFichier = d.esquisses;
  d.fonctionsFichier = d.fonctions;
  return d;
}
