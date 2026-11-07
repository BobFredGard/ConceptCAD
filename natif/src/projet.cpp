#include "configurations.h"
#include "projet.h"
#include "repetitions.h"

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
    if (x.id != y.id || x.type != y.type || x.p != y.p || x.line != y.line || x.ent != y.ent || x.a != y.a || x.b != y.b || x.mid != y.mid || x.c != y.c || x.d != y.d || x.s != y.s || x.inf != y.inf || x.inner != y.inner) return false;
  }
  for (size_t i = 0; i < a.cotes.size(); i++) {
    const Cote& x = a.cotes[i];
    const Cote& y = b.cotes[i];
    if (x.id != y.id || x.type != y.type || x.line != y.line || x.ent != y.ent || x.a != y.a || x.b != y.b || x.p != y.p || x.ref != y.ref || x.refV != y.refV || x.chk != y.chk || x.dia != y.dia || x.nom != y.nom || x.expr != y.expr || x.exprErr != y.exprErr) return false;
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
    if (a.entites[i].id != b.entites[i].id || a.entites[i].r != b.entites[i].r || a.entites[i].srcMid != b.entites[i].srcMid || a.entites[i].isectJson != b.entites[i].isectJson) return false;
  for (size_t i = 0; i < a.cotes.size(); i++)
    if (a.cotes[i].id != b.cotes[i].id || a.cotes[i].type != b.cotes[i].type || a.cotes[i].value != b.cotes[i].value || a.cotes[i].sgn != b.cotes[i].sgn || a.cotes[i].ccw != b.cotes[i].ccw || a.cotes[i].ref != b.cotes[i].ref || a.cotes[i].chk != b.cotes[i].chk || a.cotes[i].dia != b.cotes[i].dia) return false;
  return true;
}

bool Document::profondeurModifiable(size_t i) const {
  const Esquisse* e = nullptr;
  for (const Esquisse& s : esquisses)
    if (s.id == fonctions[i].esquisse) e = &s;
  if (!e) return false;
  // Une copie suit sa source ; une extrusion jusqu'à un objet n'a pas de profondeur à elle
  if (!fonctions[i].repeatId.empty() || fonctions[i].upto) return false;
  for (const Esquisse& s : esquisses) {
    // Posée de biais, elle suit la profondeur, sauf une projection dont le suivi n'est pas encore repris
    bool inconnu = false;
    for (const Entite& x : s.entites) inconnu = inconnu || x.suiviInconnu;
    const double d = s.n[0] * e->n[0] + s.n[1] * e->n[1] + s.n[2] * e->n[2];
    if (inconnu && std::abs(d) < 1 - 1e-9) return false;
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
  s.fao = js.contains("fao") && !js["fao"].is_null() && js["fao"] != false;
  s.aAt = js.contains("at");
  if (s.aAt) s.atLu = texte(js, "at");
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
      e.projName = texte(je, "projName");
      e.srcName = texte(je, "srcName");
      if (auto x = je.find("skSrc"); x != je.end() && x->is_object()) {
        e.skSrcSk = texte(*x, "sk");
        e.skSrcPt = texte(*x, "pt");
        e.skSrcEnt = texte(*x, "ent");
        if (auto m = x->find("m"); m != x->end() && m->is_number()) e.skSrcM = m->get<int>();
      }
      e.percage = vrai(je, "hole");
      e.ext = vrai(je, "isProj") || vrai(je, "isect") || vrai(je, "pierce") || vrai(je, "ext");
      e.aSrcMid = vec3(je, "srcMid", e.srcMid);
      // Suivis repris : arête retrouvée par position, autre esquisse, intersection. Pas encore : arête nommée, autre composant, traversée.
      e.pierce = vrai(je, "pierce");
      e.srcNom = texte(je, "srcNom");
      e.suiviInconnu = vrai(je, "isProj") || vrai(je, "ext") || je.contains("seg");
      if (auto x = je.find("isect"); x != je.end() && x->is_object()) {
        e.isectJson = x->dump();
        if (x->value("mode", "") == "mesh") e.suiviInconnu = true;
      }
      if (auto x = je.find("isplN"); x != je.end() && x->is_number()) e.isplN = x->get<int>();
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
      c.inner = vrai(jc, "inner");
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
      c.exprErr = texte(jd, "exprErr");
      if (auto x = jd.find("expr"); x != jd.end() && !x->is_null()) {
        c.expr = x->is_string() ? x->get<std::string>() : x->dump();
        c.formule = c.expr.find_first_not_of(" \t\r\n") != std::string::npos;
      }
      s.cotes.push_back(std::move(c));
    }
  if (auto c = js.find("cg"); c != js.end() && c->is_object()) {
    s.plan_cg = texte(*c, "id");
    s.plan_cg_sous = texte(*c, "sub");
  }
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
    if (h.contains("mv") && h["mv"].is_array())
      for (const auto& m : h["mv"]) s.hote.mv.push_back({texte(m, "id"), m.contains("s") && m["s"].is_number() ? m["s"].get<double>() : 1.0});
  }
  d.esquisses.push_back(std::move(s));
}

// Le nom que connaît l'utilisateur : tous les types présents dans Exemples/. Un type inconnu reste affiché tel quel.
static std::string nomFonction(const std::string& t) {
  static const std::map<std::string, std::string> noms = {
      {"revolve", "révolution"}, {"hole", "perçage"}, {"xfillet", "congé ou chanfrein"}, {"xdraft", "dépouille"},
      {"bscale", "mise à l'échelle d'un corps"}, {"xsplit", "scission"}, {"bremove", "suppression d'un corps"},
      {"xmove", "déplacement de face"}, {"xshell", "coque"}, {"sweep", "balayage"}, {"combine", "combinaison de corps"},
      {"import", "pièce importée"}, {"bmove", "déplacement d'un corps"}, {"xdelface", "suppression de face"}};
  const auto it = noms.find(t);
  return it != noms.end() ? it->second : "fonction « " + t + " »";
}

static bool lireVec3(const json& j, const char* cle, Vec3& v);
static void lireFilet(const json& t, ReglageFilet& F) {
  const auto nb = [&](const char* k, double& v) {
    if (auto x = t.find(k); x != t.end()) {
      if (x->is_number()) v = x->get<double>();
      else if (x->is_string()) {
        try { v = std::stod(x->get<std::string>()); } catch (const std::exception&) {}
      }
    }
  };
  const auto oui = [&](const char* k) { auto x = t.find(k); return x != t.end() && x->is_boolean() && x->get<bool>(); };
  const auto mot = [&](const char* k) { auto x = t.find(k); return x != t.end() && x->is_string() ? x->get<std::string>() : std::string(); };
  F.size = mot("size");
  F.lenMode = mot("lenMode");
  nb("p", F.p);
  nb("clear", F.clear);
  nb("len", F.len);
  F.lh = oui("lh");
  F.model = oui("model");
  if (auto p = t.find("uptoPlane"); p != t.end() && p->is_object()) F.aPlan = lireVec3(*p, "p", F.planP) && lireVec3(*p, "n", F.planN);
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
// parHolders : la fonction, son taraudage, chaque arête d'un congé. Une clé par nom ou par formule.
static void lirePorteursDe(const json& h, const Fonction& f, int arete, Document& d) {
  std::vector<std::string> cles;
  const auto ajouter = [&](const char* quoi) {
    if (auto x = h.find(quoi); x != h.end() && x->is_object())
      for (auto it = x->begin(); it != x->end(); ++it)
        if (std::find(cles.begin(), cles.end(), it.key()) == cles.end()) cles.push_back(it.key());
  };
  ajouter("expr");
  ajouter("pname");
  for (const std::string& k : cles) {
    PorteurFx p;
    p.fonction = f.id;
    p.origine = f.nom.empty() ? f.id : f.nom;
    p.cle = k;
    p.arete = arete;
    p.pris = f.type == "extrude" && arete < 0 && k == "distance";
    if (auto x = h.find("expr"); x != h.end() && x->is_object() && x->contains(k) && (*x)[k].is_string()) p.expr = (*x)[k].get<std::string>();
    if (auto x = h.find("pname"); x != h.end() && x->is_object() && x->contains(k) && (*x)[k].is_string()) p.nom = (*x)[k].get<std::string>();
    if (auto x = h.find("exprErr"); x != h.end() && x->is_object() && x->contains(k) && (*x)[k].is_string()) p.err = (*x)[k].get<std::string>();
    const bool qte = k == "qty" || k == "qty2";
    const std::string lue = k == "qty" ? "copies" : k == "qty2" ? "copies2" : k;
    if (auto v = h.find(lue); v != h.end() && v->is_number()) p.valeur = v->get<double>();
    if (qte) p.valeur = std::min(200.0, std::max(1.0, std::floor(p.valeur != 0 ? p.valeur : 1))) + 1;
    if (k == "distance") p.valeur = std::abs(p.valeur);
    d.porteurs.push_back(std::move(p));
  }
}
static void lirePorteurs(const json& jf, const Fonction& f, Document& d) {
  if (vrai(jf, "repeatId")) return;  // instances de répétition : elles suivent leur source
  lirePorteursDe(jf, f, -1, d);
  if (auto t = jf.find("thread"); t != jf.end() && t->is_object()) lirePorteursDe(*t, f, -2, d);
  if (auto e = jf.find("edges"); e != jf.end() && e->is_array())
    for (size_t i = 0; i < e->size(); i++)
      if ((*e)[i].is_object()) lirePorteursDe((*e)[i], f, static_cast<int>(i), d);
}
static void lireAncre(const json& x, AncreArete& n) {
  n.existe = true;
  n.t = texte(x, "t");
  n.sk = texte(x, "sk");
  n.id = texte(x, "id");
  if (auto z = x.find("z"); z != x.end() && z->is_number()) {
    n.z = z->get<double>();
    n.aZ = true;
  }
  if (auto s = x.find("side"); s != x.end() && s->is_number()) {
    n.side = s->get<int>();
    n.aSide = true;
  }
  if (auto v = x.find("dist"); v != x.end() && v->is_number()) n.dist = v->get<double>();
  if (auto v = x.find("far"); v != x.end() && v->is_number()) n.loin = v->get<double>() != 0;
}
static RefFace lireRefFace(const json& j) {
  RefFace r;
  if (!j.is_object()) return r;
  r.lue = lireVec3(j, "pos", r.pos);
  r.aNormale = lireVec3(j, "n", r.n);
  lireVec3(j, "dim", r.dim);
  r.st = texte(j, "st");
  r.nom = texte(j, "nom");
  if (auto x = j.find("anchor"); x != j.end() && x->is_object()) lireAncre(*x, r.ancre);
  return r;
}
RefFace lireRefFaceJson(const nlohmann::ordered_json& j) { return lireRefFace(j); }
static void lireConge(const json& jf, Fonction& f, std::map<std::string, int>& refus) {
  f.chamfer = vrai(jf, "chamfer");
  if (auto t = jf.find("tangent"); t != jf.end() && t->is_boolean()) f.tangent = t->get<bool>() ? 1 : 0;
  if (jf.contains("cmode") && jf["cmode"].is_string()) f.cmode = jf["cmode"].get<std::string>();
  if (auto v = jf.find("cd2"); v != jf.end() && v->is_number()) f.cd2 = v->get<double>();
  if (auto v = jf.find("cang"); v != jf.end() && v->is_number()) f.cang = v->get<double>();
  f.cflip = vrai(jf, "cflip");
  if (!jf.contains("edges") || !jf["edges"].is_array()) return;
  for (auto& je : jf["edges"]) {
    if (!je.is_object()) continue;
    AreteConge a;
    const bool aPos = lireVec3(je, "pos", a.pos);
    a.aPos0 = lireVec3(je, "pos0", a.pos0);
    a.aFn = lireVec3(je, "fn", a.fn);
    if (!aPos && a.aPos0) a.pos = a.pos0;
    if (je.contains("r") && je["r"].is_number()) a.r = je["r"].get<double>();
    if (je.contains("len") && je["len"].is_number()) a.len = je["len"].get<double>();
    a.seed = je.contains("seed") && (je["seed"].is_number() ? je["seed"].get<double>() != 0 : vrai(je, "seed"));
    if (je.contains("nom") && je["nom"].is_string()) a.nom = je["nom"].get<std::string>();
    a.nomAffiche = texte(je, "name");
    if (auto x = je.find("anchor"); x != je.end() && x->is_object()) lireAncre(*x, a.ancre);
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
  f.kw = vrai(jf, "kw");
  f.kwKey = texte(jf, "kwKey");
  f.flip = vrai(jf, "flip");
  f.through = vrai(jf, "through");
  f.repeatId = texte(jf, "repeatId");
  f.derive = jf.contains("derive") && !jf["derive"].is_null() && jf["derive"] != false;
  if (f.type == "xshell") {
    if (auto a = jf.find("thick"); a != jf.end() && a->is_number()) f.epaisseur = a->get<double>();
    if (auto c = jf.find("faces"); c != jf.end() && c->is_array())
      for (const auto& x : *c) f.facesVisees.push_back(lireRefFace(x));
  }
  if (f.type == "xdraft" || f.type == "xmove" || f.type == "xdelface" || f.type == "xsplit") {
    if (auto a = jf.find("angle"); f.type == "xdraft" && a != jf.end() && a->is_number()) f.angleDepouille = a->get<double>();
    if (auto r = jf.find("ref"); r != jf.end()) f.refFace = lireRefFace(*r);
    if (auto c = jf.find("faces"); c != jf.end() && c->is_array())
      for (const auto& x : *c) f.facesVisees.push_back(lireRefFace(x));
  }
  const auto nombre = [&jf](const char* k, double defaut) {
    auto a = jf.find(k);
    return a != jf.end() && a->is_number() ? a->get<double>() : defaut;
  };
  if (f.type == "xmove") {
    f.dist = nombre("dist", 0);
    f.facesTangentes = vrai(jf, "tangent");
  }
  if (f.type == "sweep") f.chemin = texte(jf, "pathId");
  if (f.type == "combine") {
    f.modeFonction = texte(jf, "mode");
    f.garder = vrai(jf, "keep");
    if (auto c = jf.find("tools"); c != jf.end() && c->is_array())
      for (const auto& x : *c)
        if (x.is_string()) f.outils.push_back(x.get<std::string>());
  }
  if (f.type == "xsplit" || f.type == "bscale") f.corpsNeuf = texte(jf, "newBody");
  if (f.type == "xsplit") {
    f.modeFonction = texte(jf, "mode");
    f.decalage = nombre("off", 0);
    if (auto p = jf.find("pl"); p != jf.end() && p->is_object()) {
      f.planSrc = texte(*p, "src");
      f.planCg = texte(*p, "cg");
      f.aPlanON = lireVec3(*p, "o", f.planO) && lireVec3(*p, "n", f.planN);
    }
  }
  if (f.type == "bscale") {
    lireVec3(jf, "o", f.centre);
    f.echelle = nombre("s", 1);
    f.echelleX = nombre("sx", 1);
    f.echelleY = nombre("sy", 1);
    f.echelleZ = nombre("sz", 1);
    f.echelleUni = !(jf.contains("uni") && jf["uni"].is_boolean() && !jf["uni"].get<bool>());
    f.copie = vrai(jf, "copy");
  }
  if (f.type == "bmove")
    if (auto c = jf.find("steps"); c != jf.end() && c->is_array())
      for (const auto& x : *c) {
        if (!x.is_object()) continue;
        EtapeDeplacement e;
        e.k = texte(x, "k");
        lireVec3(x, "v", e.v);
        lireVec3(x, "o", e.o);
        lireVec3(x, "d", e.d);
        lireVec3(x, "a", e.a);
        lireVec3(x, "b", e.b);
        if (auto v = x.find("dist"); v != x.end() && v->is_number()) e.dist = v->get<double>();
        if (auto v = x.find("deg"); v != x.end() && v->is_number()) e.deg = v->get<double>();
        f.etapes.push_back(e);
      }
  if (f.type == "extrude") {
    if (auto a = jf.find("draft"); a != jf.end() && a->is_number()) f.draft = a->get<double>();
    if (auto a = jf.find("newBody"); a != jf.end() && a->is_boolean()) f.corpsPropre = a->get<bool>();
    f.upto = vrai(jf, "upto");
    if (auto u = jf.find("upto"); u != jf.end() && u->is_object()) {
      f.uptoEx = texte(*u, "ex");
      f.uptoNom = texte(*u, "nom");
      if (auto q = u->find("faceId"); q != u->end() && q->is_object()) f.uptoCorps = texte(*q, "bid");
      if (auto q = u->find("faceProps"); q != u->end() && q->is_object()) {
        const auto v3 = [](const nlohmann::ordered_json& o, Vec3& v) {
          if (!o.is_object()) return false;
          v = {o.value("x", 0.0), o.value("y", 0.0), o.value("z", 0.0)};
          return true;
        };
        const bool a = q->contains("center") && v3((*q)["center"], f.uptoCentre);
        const bool b = q->contains("normal") && v3((*q)["normal"], f.uptoNormale);
        if (auto ar = q->find("area"); ar != q->end() && ar->is_number()) f.uptoAire = ar->get<double>();
        f.uptoFace = a && b;
      }
    }
  }
  if (auto c = jf.find("cutBodies"); c != jf.end() && c->is_array())
    for (const auto& x : *c)
      if (x.is_string()) f.corpsEnPlus.push_back(x.get<std::string>());
  if (f.type == "revolve") {
    if (auto a = jf.find("axis"); a != jf.end() && a->is_object()) {
      f.axeK = texte(*a, "k");
      f.axeId = texte(*a, "id");
      f.axeD = texte(*a, "d");
    }
    if (auto a = jf.find("angle"); a != jf.end() && a->is_number()) f.angle = a->get<double>();
  }
  if (f.type == "xfillet") lireConge(jf, f, refus);
  if (f.type == "gear") {
    ReglageEngrenage& g = f.engrenage;
    const auto nb = [&](const char* k, double& v, bool garde0 = true) {
      if (auto x = jf.find(k); x != jf.end()) {
        if (x->is_number()) v = x->get<double>();
        else if (x->is_string()) {
          try { v = std::stod(x->get<std::string>()); } catch (const std::exception&) {}
        }
      }
      (void)garde0;
    };
    nb("m", g.m); nb("z", g.z); nb("alpha", g.alpha); nb("b", g.b); nb("x", g.x); nb("beta", g.beta); nb("D", g.D); nb("H", g.H); nb("j", g.j); nb("ks", g.ks);
    g.hand = texte(jf, "hand");
    g.kind = texte(jf, "kind");
  }
  if (f.type == "xthread") {
    lireFilet(jf, f.filetage);
    if (auto c = jf.find("cyl"); c != jf.end() && c->is_object()) {
      f.cylindre.lu = lireVec3(*c, "c", f.cylindre.c) && lireVec3(*c, "u", f.cylindre.u);
      f.cylindre.aP = lireVec3(*c, "p", f.cylindre.p);
      if (auto r = c->find("r"); r != c->end() && r->is_number()) f.cylindre.r = r->get<double>();
      f.cylindre.nom = texte(*c, "nom");
    }
  }
  if (f.type == "hole") {
    ReglagePercage& h = f.percage;
    h.kind = texte(jf, "kind");
    h.end = texte(jf, "end");
    h.pilot = texte(jf, "pilot");
    const auto nb = [&](const char* k, double& v) {
      if (auto x = jf.find(k); x != jf.end()) {
        if (x->is_number()) v = x->get<double>();
        else if (x->is_string()) {
          try { v = std::stod(x->get<std::string>()); } catch (const std::exception&) {}
        }
      }
    };
    nb("d", h.d); nb("stD", h.stD); nb("stH", h.stH); nb("stTip", h.stTip); nb("cbD", h.cbD); nb("cbH", h.cbH); nb("csD", h.csD);
    nb("csA", h.csA); nb("depth", h.depth); nb("tip", h.tip); nb("reamD", h.reamD); nb("reamH", h.reamH); nb("reamOff", h.reamOff);
    if (auto p = jf.find("uptoPlane"); p != jf.end() && p->is_object()) h.aPlan = lireVec3(*p, "p", h.planP) && lireVec3(*p, "n", h.planN);
    if (auto t = jf.find("thread"); h.kind != "ream" && t != jf.end() && t->is_object()) lireFilet(*t, h.filet);
  }
  // La répétition se contente de créer des copies, rejouées comme des fonctions : sans effet ici.
  if (f.visible && f.type != "extrude" && f.type != "repeat" && f.type != "xfillet" && f.type != "hole" && f.type != "xthread" && f.type != "gear" && f.type != "revolve" && f.type != "xdraft" &&
      f.type != "xshell" && f.type != "xmove" && f.type != "xdelface" && f.type != "xsplit" && f.type != "bmove" && f.type != "bscale" && f.type != "bremove" && f.type != "sweep" && f.type != "combine" && f.type != "import")
    refus[nomFonction(f.type)]++;
  if (auto x = jf.find("src"); f.type == "import" && x != jf.end() && x->is_object()) {
    f.importFmt = texte(*x, "fmt");
    f.importCle = texte(*x, "key");
  }
  if (auto p = jf.find("profiles"); f.type == "extrude" && p != jf.end() && p->is_array())
    for (const auto& q : *p)
      if (q.is_array() && q.size() >= 2 && q[0].is_number() && q[1].is_number()) f.profils.push_back({q[0].get<double>(), q[1].get<double>()});
  if (f.type == "repeat")
    if (auto b = jf.find("base"); b != jf.end() && b->is_array())
      for (const auto& x : *b)
        if (x.is_string()) d.sourcesRepetees.push_back(x.get<std::string>());
  lirePorteurs(jf, f, d);
  d.fonctions.push_back(std::move(f));
}

static Document documentDepuis(json& racine);

bool esquisseCopieRepetition(const Document& d, const std::string& id) {
  bool copie = false;
  for (const Fonction& f : d.fonctions)
    if (f.esquisse == id || f.chemin == id) {
      if (f.repeatId.empty()) return false;
      copie = true;
    }
  return copie;
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
  Document d = documentDepuis(racine);
  d.chemin = chemin;
  d.octets = std::move(octets);
  d.compresse = compresse;
  return d;
}

Document projetVide() {
  std::string texte = R"({"app":"ConceptCAD","bundle":1,"v":"natif","name":"Sans titre","doc":{"name":"Sans titre","tint":0,"sketches":[],"features":[],"cgeo":[],"bodyVis":{},"bodies":[],"bodySeq":1,"activeBody":null,"mep":null},"nMoves":0,"moves":[],"imports":{}})";
  json racine = json::parse(texte);
  Document d = documentDepuis(racine);
  d.octets = std::move(texte);
  return d;
}

Document documentDeComposant(const json& doc, const Document& modele) {
  json copie = doc;
  Document d = documentDepuis(copie);
  d.imports = modele.imports;
  return d;
}

Document lireTexteProjet(const Document& modele, const std::string& texte) {
  json racine = json::parse(texte);
  Document d = documentDepuis(racine);
  d.chemin = modele.chemin;
  d.octets = modele.octets;
  d.compresse = modele.compresse;
  d.texteBase = texte;
  d.projNommees = modele.projNommees && std::none_of(d.fonctions.begin(), d.fonctions.end(), [](const Fonction& f) { return f.upto && f.repeatId.empty() && f.uptoNom.empty(); });
  return d;
}

static Document documentDepuisDoc(json& racine);

static Document documentDepuis(json& racine) {
  Document d = documentDepuisDoc(racine);
  {
    const json& j = racine.contains("doc") && racine["doc"].is_object() ? racine["doc"] : racine;
    auto m = std::make_shared<std::map<std::string, std::string>>();
    if (auto x = j.find("features"); x != j.end() && x->is_array())
      for (const json& f : *x)
        if (f.is_object()) (*m)[texte(f, "id")] = f.dump(-1, ' ', false, json::error_handler_t::replace);
    d.fonctionsJson = m;
  }
  if (auto x = racine.find("imports"); x != racine.end() && x->is_object()) {
    auto m = std::make_shared<std::map<std::string, std::string>>();
    for (const auto& v : x->items())
      if (v.value().is_string()) (*m)[v.key()] = v.value().get<std::string>();
    d.imports = m;
  }
  return d;
}

static Document documentDepuisDoc(json& racine) {
  const bool lot = racine.contains("doc") && racine["doc"].is_object();
  json& j = lot ? racine["doc"] : racine;
  if (!j.contains("features") || !j.contains("sketches")) throw std::runtime_error("ce fichier ne contient pas de pièce");
  regenererRepetitions(j);  // les copies sont dérivées de leurs sources, comme à l'ouverture dans le navigateur

  Document d;
  std::map<std::string, int> refus;
  d.nom = texte(j, "name");
  if (j.contains("bodies"))
    for (auto& c : j["bodies"]) {
      d.corps.push_back(texte(c, "id"));
      d.nomsCorps.push_back(texte(c, "name"));
      d.couleursCorps.push_back(c.contains("color") && c["color"].is_number() ? c["color"].get<unsigned>() : 0u);
      d.opacitesCorps.push_back(c.contains("op") && c["op"].is_number() && c["op"].get<double>() > 0 ? c["op"].get<double>() : 1.0);
    }
  if (auto x = j.find("bodyVis"); x != j.end() && x->is_object())
    for (const auto& v : x->items())
      if (v.value().is_boolean() && !v.value().get<bool>()) d.corpsMasques.push_back(v.key());
  if (j.contains("tint") && j["tint"].is_number()) d.teinte = j["tint"].get<unsigned>();
  if (j.contains("mat") && j["mat"].is_object()) {
    if (j["mat"].contains("name") && j["mat"]["name"].is_string()) d.matiere = j["mat"]["name"].get<std::string>();
    if (j["mat"].contains("rho") && j["mat"]["rho"].is_number()) d.densite = j["mat"]["rho"].get<double>();
  }
  if (d.corps.empty()) d.corps.push_back("b1");
  // ensureActiveBody : l'actif s'il existe, sinon le premier
  d.corpsActif = texte(j, "activeBody");
  if (std::find(d.corps.begin(), d.corps.end(), d.corpsActif) == d.corps.end()) d.corpsActif = d.corps[0];
  if (auto x = j.find("entNames"); x != j.end() && x->is_object()) {
    if (auto y = x->find("face"); y != x->end() && y->is_number()) d.nomsFace = y->get<int>();
    if (auto y = x->find("edge"); y != x->end() && y->is_number()) d.nomsArete = d.nomsAreteLu = y->get<int>();
    if (auto y = x->find("proj"); y != x->end() && y->is_number()) d.nomsProj = d.nomsProjLu = y->get<int>();
    if (auto y = x->find("isect"); y != x->end() && y->is_number()) d.nomsIsect = d.nomsIsectLu = y->get<int>();
  }
  if (auto x = j.find("cgeo"); x != j.end() && x->is_array())
    for (const auto& c : *x) {
      if (!c.is_object()) continue;
      ElementConstruction e;
      e.j = c;
      e.lireRepere();
      d.construction.push_back(std::move(e));
    }
  for (auto& s : j["sketches"]) lireEsquisse(s, d, refus);
  for (auto& f : j["features"]) lireFonction(f, d, refus);
  for (Fonction& f : d.fonctions) f.repetee = !f.repeatId.empty() || std::find(d.sourcesRepetees.begin(), d.sourcesRepetees.end(), f.id) != d.sourcesRepetees.end();
  if (auto x = j.find("params"); x != j.end() && x->is_array())
    for (auto& jp : *x) {
      if (!jp.is_object()) continue;
      Parametre p;
      p.nom = texte(jp, "name");
      p.err = texte(jp, "err");
      if (auto e = jp.find("expr"); e != jp.end() && !e->is_null()) {
        p.exprNombre = !e->is_string();
        p.expr = e->is_string() ? e->get<std::string>() : e->dump();
      }
      if (auto v = jp.find("value"); v != jp.end() && v->is_number()) {
        p.value = v->get<double>();
        p.aValeur = true;
      }
      d.params.push_back(std::move(p));
    }
  if (auto x = j.find("derive"); x != j.end() && x->is_array())
    for (auto& L : *x)
      d.derivesJson.push_back(L.dump(-1, ' ', false, nlohmann::ordered_json::error_handler_t::replace));
  if (auto x = j.find("derive"); x != j.end() && x->is_array())
    for (auto& L : *x)
      if (auto y = L.find("params"); y != L.end() && y->is_array())
        for (auto& jp : *y) {
          ParamDerive p;
          p.nom = texte(jp, "name");
          p.lien = texte(L, "name");
          p.absent = vrai(jp, "miss");
          if (auto v = jp.find("value"); v != jp.end() && v->is_number()) p.value = v->get<double>();
          d.derives.push_back(std::move(p));
        }
  if (auto x = j.find("cgeo"); x != j.end() && x->is_array())
    for (auto& c : *x)
      if (auto p = c.find("p"); p != c.end() && p->is_object()) {
        Fonction f;
        f.id = texte(c, "id");
        f.nom = texte(c, "name");
        lirePorteursDe(*p, f, -3, d);
      }
  if (j.contains("asm") && j["asm"].is_object()) {
    if (j["asm"].contains("comps") && j["asm"]["comps"].is_array() && !j["asm"]["comps"].empty()) d.assemblage = std::make_shared<json>(j["asm"]);
    else refus["assemblage ancien"]++;
  }
  if (j.contains("components") && j["components"].is_array() && !j["components"].empty()) refus["assemblage"]++;
  if (j.contains("configs")) {
    nlohmann::ordered_json table = cfgNorm(j["configs"]);
    if (!table.is_null()) d.configs = std::make_shared<const nlohmann::ordered_json>(std::move(table));
  }
  for (auto& [k, n] : refus) d.nonPrisEnCharge.push_back(k + " × " + std::to_string(n));
  d.esquissesFichier = d.esquisses;
  d.fonctionsFichier = d.fonctions;
  d.paramsFichier = d.params;
  d.porteursFichier = d.porteurs;
  return d;
}

void ElementConstruction::lireRepere() {
  const auto texteDe = [](const nlohmann::ordered_json& q, const char* k) {
    const auto x = q.find(k);
    return x != q.end() && x->is_string() ? x->get<std::string>() : std::string();
  };
  const auto vecteur = [](const nlohmann::ordered_json& q, const char* k) {
    Vec3 v{0, 0, 0};
    const auto x = q.find(k);
    if (x != q.end() && x->is_array() && x->size() >= 3)
      for (size_t i = 0; i < 3; i++) v[i] = (*x)[i].is_number() ? (*x)[i].get<double>() : 0.0;
    return v;
  };
  aRepere = false;
  surPiece = false;
  surElements.clear();
  id = texteDe(j, "id");
  kind = texteDe(j, "kind");
  nom = texteDe(j, "name");
  const auto vis = j.find("visible");
  visible = vis == j.end() || !vis->is_boolean() || vis->get<bool>();
  if (auto fr = j.find("fr"); fr != j.end() && fr->is_object()) {
    o = vecteur(*fr, "o");
    z = vecteur(*fr, "z");
    x = vecteur(*fr, "x");
    y = vecteur(*fr, "y");
    aRepere = fr->contains("o") && fr->contains("z");
  }
  if (auto r = j.find("refs"); r != j.end() && r->is_array())
    for (const auto& q : *r) {
      if (!q.is_object()) continue;
      const std::string k = texteDe(q, "k");
      if (k == "cg") surElements.push_back(texteDe(q, "id"));
      else if (k != "o") surPiece = true;
    }
}
