// Configurations : tables de variantes d'une pièce (src/52-configurations.js du navigateur)
#include "configurations.h"

#include <algorithm>
#include <cctype>
#include <map>
#include <memory>
#include <set>

#include "parametres.h"

using J = nlohmann::ordered_json;

namespace {
std::string sansBlancsAuxBouts(const std::string& s) {
  size_t a = 0, b = s.size();
  while (a < b && std::isspace(static_cast<unsigned char>(s[a]))) a++;
  while (b > a && std::isspace(static_cast<unsigned char>(s[b - 1]))) b--;
  return s.substr(a, b - a);
}
J* ligneDe(J& table, const std::string& id) {
  for (J& r : table["rows"])
    if (r.value("id", std::string()) == id) return &r;
  return nullptr;
}
std::string dixiemes(double v) { return nombreJsFixe(v, 6); }
const std::string VIDE;
}  // namespace

const J* cfgDe(const Document& d) { return d.configs && d.configs->is_object() ? d.configs.get() : nullptr; }

std::vector<std::string> cfgNomsLibres(const Document& d) {
  // L'ordre de parAll : un nom repris garde sa place, la dernière sorte l'emporte
  std::vector<std::string> ordre;
  std::map<std::string, bool> derive;
  const auto ajouter = [&](const std::string& n, bool estDerive) {
    if (n.empty()) return;
    if (!derive.count(n)) ordre.push_back(n);
    derive[n] = estDerive;
  };
  for (const ParamDerive& p : d.derives) ajouter(p.nom, true);
  for (const Parametre& p : d.params) ajouter(p.nom, false);
  for (const Esquisse& s : d.esquisses)
    for (const Cote& c : s.cotes) ajouter(c.nom, false);
  for (const PorteurFx& h : d.porteurs) ajouter(h.nom, false);
  std::set<std::string> pris;
  if (const J* t = cfgDe(d))
    for (const J& n : (*t)["cols"]) pris.insert(n.get<std::string>());
  std::vector<std::string> L;
  for (const std::string& n : ordre)
    if (!derive[n] && !pris.count(n)) L.push_back(n);
  return L;
}

std::string cfgCourant(const Document& d, const std::string& nom) {
  if (nom.empty()) return "";
  for (auto h = d.porteurs.rbegin(); h != d.porteurs.rend(); ++h)
    if (h->nom == nom) return !sansBlancsAuxBouts(h->expr).empty() ? h->expr : dixiemes(h->valeur);
  for (auto s = d.esquisses.rbegin(); s != d.esquisses.rend(); ++s)
    for (auto c = s->cotes.rbegin(); c != s->cotes.rend(); ++c)
      if (c->nom == nom) return !sansBlancsAuxBouts(c->expr).empty() ? c->expr : dixiemes(parDimUser(*c));
  for (auto p = d.params.rbegin(); p != d.params.rend(); ++p)
    if (p->nom == nom) return p->expr;
  for (auto p = d.derives.rbegin(); p != d.derives.rend(); ++p)
    if (p->nom == nom) return nombreJs(p->value);
  return "";
}

namespace {
// cfgSetExpr. Faux si le nom est absent du modèle ; une valeur dérivée reste à sa source.
bool poserExpression(Document& d, const std::string& nom, const std::string& brut) {
  const std::string ex = sansBlancsAuxBouts(brut);
  for (auto h = d.porteurs.rbegin(); h != d.porteurs.rend(); ++h)
    if (h->nom == nom) {
      h->expr = ex;
      return true;
    }
  for (auto s = d.esquisses.rbegin(); s != d.esquisses.rend(); ++s)
    for (auto c = s->cotes.rbegin(); c != s->cotes.rend(); ++c)
      if (c->nom == nom) {
        c->expr = ex;
        return true;
      }
  for (auto p = d.params.rbegin(); p != d.params.rend(); ++p)
    if (p->nom == nom) {
      p->expr = ex;
      p->exprNombre = false;
      return true;
    }
  for (const ParamDerive& p : d.derives)
    if (p.nom == nom) return true;
  return false;
}
}  // namespace

void cfgRenommerColonne(Document& d, const std::string& ancien, const std::string& nouveau) {
  const J* t = cfgDe(d);
  if (!t || ancien.empty() || ancien == nouveau) return;
  bool present = false;
  for (const J& n : (*t)["cols"]) present = present || n == ancien;
  if (!present) return;
  J c = *t;
  for (J& n : c["cols"])
    if (n == ancien) n = nouveau;
  for (J& r : c["rows"])
    if (r["vals"].contains(ancien)) {
      // La colonne garde sa place dans la ligne : le navigateur écrit le nouveau nom à la fin
      J v = r["vals"][ancien];
      r["vals"].erase(ancien);
      r["vals"][nouveau] = std::move(v);
    }
  d.configs = std::make_shared<const J>(std::move(c));
  d.configsChangees = true;
  d.structureTouchee = true;  // Ctrl+Z reprend tout le document, la table avec
}

J& cfgAssurer(J& j) {
  J t = j.contains("configs") ? cfgNorm(j["configs"]) : J(nullptr);
  if (t.is_null()) {
    t = J::object();
    t["active"] = nullptr;
    t["cols"] = J::array();
    t["rows"] = J::array();
  }
  j["configs"] = std::move(t);
  return j["configs"];
}

void cfgRanger(J& j) {
  if (j.contains("configs") && (!j["configs"].is_object() || !j["configs"].contains("rows") || j["configs"]["rows"].empty())) j.erase("configs");
}

void cfgCapturer(const Document& d, J& j, const std::string& id) {
  J& t = cfgAssurer(j);
  J* r = ligneDe(t, id);
  if (!r) return;
  for (const J& n : t["cols"]) {
    const std::string v = cfgCourant(d, n.get<std::string>());
    if (!v.empty()) (*r)["vals"][n.get<std::string>()] = v;
  }
  J off = J::array();
  if (j.contains("features") && j["features"].is_array())
    for (const J& f : j["features"])
      if (f.is_object() && !f.contains("repeatId") && f.contains("visible") && f["visible"] == false) off.push_back(f.value("id", std::string()));
  (*r)["off"] = std::move(off);
}

std::string cfgAjouterLigne(const Document& d, J& j) {
  J& t = cfgAssurer(j);
  size_t k = t["rows"].size() + 1;
  while (ligneDe(t, "cf" + std::to_string(k))) k++;
  const std::string id = "cf" + std::to_string(k);
  J r = J::object();
  r["id"] = id;
  r["name"] = "Configuration " + std::to_string(k);
  r["vals"] = J::object();
  r["off"] = J::array();
  t["rows"].push_back(std::move(r));
  cfgCapturer(d, j, id);
  J& t2 = j["configs"];
  if (!t2["active"].is_string()) t2["active"] = id;
  return id;
}

void cfgAjouterColonne(const Document& d, J& j, const std::string& nom) {
  if (!j.contains("configs") || cfgNorm(j["configs"]).is_null()) cfgAjouterLigne(d, j);
  J& t = cfgAssurer(j);
  for (const J& n : t["cols"])
    if (n == nom) return;
  const std::string v = cfgCourant(d, nom);
  t["cols"].push_back(nom);
  for (J& r : t["rows"])
    if (!r["vals"].contains(nom)) r["vals"][nom] = v;
}

void cfgSupprimerLigne(J& j, const std::string& id) {
  J& t = cfgAssurer(j);
  J rows = J::array();
  for (J& r : t["rows"])
    if (r.value("id", std::string()) != id) rows.push_back(r);
  if (t["active"] == id) t["active"] = rows.empty() ? J(nullptr) : rows[0]["id"];
  t["rows"] = std::move(rows);
}

void cfgSupprimerColonne(J& j, const std::string& nom) {
  J& t = cfgAssurer(j);
  J cols = J::array();
  for (const J& n : t["cols"])
    if (n != nom) cols.push_back(n);
  t["cols"] = std::move(cols);
  for (J& r : t["rows"]) r["vals"].erase(nom);
}

void cfgRenommerLigne(J& j, const std::string& id, const std::string& nom) {
  J& t = cfgAssurer(j);
  const std::string n = sansBlancsAuxBouts(nom);
  if (J* r = ligneDe(t, id))
    if (!n.empty()) (*r)["name"] = n;
}

void cfgPoserCellule(J& j, const std::string& id, const std::string& nom, const std::string& valeur) {
  J& t = cfgAssurer(j);
  J* r = ligneDe(t, id);
  if (!r) return;
  const std::string v = sansBlancsAuxBouts(valeur);
  if (!v.empty()) (*r)["vals"][nom] = v;
  else (*r)["vals"].erase(nom);
}

void cfgBasculerSupprimee(J& j, const std::string& id, const std::string& fonction) {
  J& t = cfgAssurer(j);
  J* r = ligneDe(t, id);
  if (!r) return;
  J off = J::array();
  bool etait = false;
  for (const J& x : (*r)["off"]) {
    if (x == fonction) etait = true;
    else off.push_back(x);
  }
  if (!etait) off.push_back(fonction);
  (*r)["off"] = std::move(off);
}

void cfgStructureActive(J& j, const std::string& id) {
  J& t = cfgAssurer(j);
  J* row = ligneDe(t, id);
  if (!row) throw std::runtime_error("configuration introuvable");
  std::set<std::string> pilotees, supprimees;
  for (const J& r : t["rows"])
    for (const J& x : r["off"]) pilotees.insert(x.get<std::string>());
  for (const J& x : (*row)["off"]) supprimees.insert(x.get<std::string>());
  if (j.contains("features") && j["features"].is_array()) {
    J& F = j["features"];
    for (J& f : F) {
      if (!f.is_object() || f.contains("repeatId")) continue;
      const std::string fid = f.value("id", std::string());
      if (!pilotees.count(fid)) continue;
      const bool on = !supprimees.count(fid);
      f["visible"] = on;
      if (f.value("type", std::string()) == "repeat")
        for (J& k : F)
          if (k.is_object() && k.value("repeatId", std::string()) == fid) k["visible"] = on;
    }
  }
  t["active"] = id;
}

std::vector<std::string> cfgPoserValeurs(Document& d, const std::string& id) {
  std::vector<std::string> absents;
  const J* t = cfgDe(d);
  if (!t) return absents;
  const J* row = nullptr;
  for (const J& r : (*t)["rows"])
    if (r["id"] == id) row = &r;
  if (!row) return absents;
  const J cols = (*t)["cols"];
  const J vals = (*row)["vals"];
  for (const J& n : cols) {
    const std::string nom = n.get<std::string>();
    if (!vals.contains(nom)) continue;
    const std::string ex = vals[nom].get<std::string>();
    if (sansBlancsAuxBouts(ex).empty()) continue;
    if (!poserExpression(d, nom, ex)) absents.push_back(nom);
  }
  return absents;
}

std::string cfgMessage(const Document& d, const std::string& id, const std::vector<std::string>& absents) {
  std::string nom = id;
  if (const J* t = cfgDe(d))
    for (const J& r : (*t)["rows"])
      if (r["id"] == id) nom = r["name"].get<std::string>();
  std::string m = u8"Configuration « " + nom + u8" »";
  const auto joindre = [](const std::vector<std::string>& L, const char* sep) {
    std::string s;
    for (size_t i = 0; i < L.size(); i++) s += (i ? sep : "") + L[i];
    return s;
  };
  if (!absents.empty()) m += u8" — absent(s) du modèle : " + joindre(absents, ", ");
  std::vector<std::string> errs;
  for (const Parametre& p : d.params)
    if (!p.err.empty()) errs.push_back(p.nom + " : " + p.err);
  for (const Esquisse& s : d.esquisses)
    for (const Cote& c : s.cotes)
      if (!c.exprErr.empty()) errs.push_back((c.nom.empty() ? std::string("cote") : c.nom) + " : " + c.exprErr);
  if (!errs.empty()) m += u8" — ⚠ " + joindre(errs, " ; ");
  return m + ".";
}
