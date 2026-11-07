// Ce qui change la liste des fonctions, des esquisses ou des corps, écrit sur le document JSON comme dans le navigateur :
// delFeature, delBody, bodyRemoveAdd (src/40-30-corps-fonctions.js), repRemoveRepeat (src/40-20-repetitions.js),
// les entrées du menu contextuel (src/90-20-menus-contextuels.js).
#include "structure.h"

#include "construction.h"

#include <algorithm>
#include <set>
#include <string>
#include <vector>

using json = nlohmann::ordered_json;

namespace {
std::string str(const json& o, const char* k) {
  const auto i = o.find(k);
  return i != o.end() && i->is_string() ? i->get<std::string>() : std::string();
}
json& liste(json& d, const char* k) {
  if (!d.contains(k) || !d[k].is_array()) d[k] = json::array();
  return d[k];
}
json* parId(json& L, const std::string& id) {
  if (L.is_array())
    for (json& x : L)
      if (str(x, "id") == id) return &x;
  return nullptr;
}
template <class F>
void filtrer(json& L, F garder) {
  json r = json::array();
  for (json& x : L)
    if (garder(x)) r.push_back(std::move(x));
  L = std::move(r);
}
bool porteEsquisse(const json& f, const std::string& id) { return str(f, "sketchId") == id || str(f, "pathId") == id; }
bool dansTexte(const json& o, const char* k, const std::string& v) {
  const auto i = o.find(k);
  if (i == o.end() || !i->is_array()) return false;
  return std::any_of(i->begin(), i->end(), [&](const json& x) { return x.is_string() && x.get<std::string>() == v; });
}
void retirerTexte(json& o, const char* k, const std::string& v) {
  if (o.contains(k) && o[k].is_array()) filtrer(o[k], [&](const json& x) { return !(x.is_string() && x.get<std::string>() == v); });
}
// repDropBody : le corps part s'il ne porte plus rien
void corpsSiVide(json& d, const std::string& b) {
  if (b.empty()) return;
  for (const json& x : liste(d, "features"))
    if (str(x, "body") == b || str(x, "newBody") == b || (str(x, "type") == "combine" && dansTexte(x, "tools", b))) return;
  filtrer(liste(d, "bodies"), [&](const json& e) { return str(e, "id") != b; });
  if (!d["bodies"].empty() && !parId(d["bodies"], str(d, "activeBody"))) d["activeBody"] = d["bodies"][0]["id"];
}
void retirerRepetition(json& d, const std::string& idRep) {
  json& F = liste(d, "features");
  json rp;
  std::vector<std::string> esquisses;
  for (const json& f : F) {
    if (str(f, "id") == idRep) rp = f;
    if (str(f, "repeatId") == idRep)
      for (const char* k : {"sketchId", "pathId"})
        if (!str(f, k).empty()) esquisses.push_back(str(f, k));
  }
  filtrer(F, [&](const json& f) { return str(f, "id") != idRep && str(f, "repeatId") != idRep; });
  for (const std::string& id : esquisses)
    if (std::none_of(F.begin(), F.end(), [&](const json& x) { return porteEsquisse(x, id); })) filtrer(liste(d, "sketches"), [&](const json& s) { return str(s, "id") != id; });
  if (rp.is_object() && rp.contains("bodyMap") && rp["bodyMap"].is_object())
    for (const auto& b : rp["bodyMap"].items())
      if (b.value().is_string()) corpsSiVide(d, b.value().get<std::string>());
}
}  // namespace

void stRenommer(json& d, const char* liste_, const std::string& id, const std::string& nom) {
  if (json* x = parId(liste(d, liste_), id)) (*x)["name"] = nom;
}

void stBasculerVisible(json& d, const char* liste_, const std::string& id) {
  if (json* x = parId(liste(d, liste_), id)) {
    const bool vu = !(x->contains("visible") && (*x)["visible"].is_boolean() && !(*x)["visible"].get<bool>());
    (*x)["visible"] = !vu;
  }
}

void stBasculerVueCorps(json& d, const std::string& id) {
  if (!d.contains("bodyVis") || !d["bodyVis"].is_object()) d["bodyVis"] = json::object();
  json& v = d["bodyVis"];
  if (v.contains(id) && v[id].is_boolean() && !v[id].get<bool>()) v.erase(id);
  else v[id] = false;
}

void stCorpsMasques(json& d, const std::vector<std::string>& ids) {
  d["bodyVis"] = json::object();
  for (const std::string& id : ids) d["bodyVis"][id] = false;
}

void stNouveauCorps(json& d) {
  json& B = liste(d, "bodies");
  int n = d.contains("bodySeq") && d["bodySeq"].is_number() ? d["bodySeq"].get<int>() : 1;
  while (parId(B, "b" + std::to_string(n))) n++;
  d["bodySeq"] = n + 1;
  const std::string id = "b" + std::to_string(n);
  B.push_back({{"id", id}, {"name", "Corps " + std::to_string(n)}, {"c", nullptr}});
  d["activeBody"] = id;
}

std::string stImporter(json& d, const std::string& nom, const std::string& fmt, const std::string& cle, size_t taille, const std::string& fichier, int indiceMarque) {
  json& F = liste(d, "features");
  std::string fid;
  for (int k = 1;; k++) {
    fid = "im_nat" + std::to_string(k);
    if (!parId(F, fid)) break;
  }
  json f = {{"id", fid}, {"type", "import"}, {"name", nom}, {"visible", true},
            {"src", {{"fmt", fmt}, {"key", cle}, {"size", taille}, {"file", fichier}}}, {"body", str(d, "activeBody")}};
  const size_t n = indiceMarque < 0 ? F.size() : std::min<size_t>(indiceMarque, F.size());
  F.insert(F.begin() + n, std::move(f));
  return fid;
}

void stCorpsActif(json& d, const std::string& id) { d["activeBody"] = id; }

void stReglerCorps(json& d, const std::string& id, const char* champ, double valeur) {
  if (json* e = parId(liste(d, "bodies"), id)) {
    if (valeur > 0 || std::string(champ) == "op") (*e)[champ] = valeur;
    else e->erase(champ);
  }
}

void stSupprimerFonction(json& d, const std::string& id) {
  json& F = liste(d, "features");
  json* f = parId(F, id);
  if (!f) return;
  if (str(*f, "type") == "repeat") return retirerRepetition(d, id);
  const json copie = *f;
  filtrer(F, [&](const json& x) { return str(x, "id") != id; });
  if (copie.value("kw", false) || !str(copie, "kwKey").empty()) clavetteSupprimee(d, copie);
  for (json& rp : F)
    if (str(rp, "type") == "repeat") retirerTexte(rp, "base", id);
  // splitOnDelete : le corps neuf d'une scission ou d'une échelle part avec elle s'il ne porte rien d'autre
  if ((str(copie, "type") == "xsplit" || str(copie, "type") == "bscale") && !str(copie, "newBody").empty()) corpsSiVide(d, str(copie, "newBody"));
}

void stSupprimerEsquisse(json& d, const std::string& id) {
  filtrer(liste(d, "sketches"), [&](const json& s) { return str(s, "id") != id; });
  filtrer(liste(d, "features"), [&](const json& f) { return str(f, "sketchId") != id; });
}

void stSupprimerCorps(json& d, const std::string& id) {
  json& F = liste(d, "features");
  // 1) exemplaire d'une répétition « nouveau corps » : retiré de la répétition, qui part s'il n'en reste aucun
  {
    std::vector<std::string> ids;
    for (const json& rp : F)
      if (str(rp, "type") == "repeat" && rp.contains("bodyMap") && rp["bodyMap"].is_object()) ids.push_back(str(rp, "id"));
    for (const std::string& idRep : ids) {
      json* rp = parId(F, idRep);
      if (!rp) continue;
      std::vector<std::string> cles;
      for (const auto& b : (*rp)["bodyMap"].items())
        if (b.value().is_string() && b.value().get<std::string>() == id) cles.push_back(b.key());
      if (cles.empty()) continue;
      if (!rp->contains("dropKeys") || !(*rp)["dropKeys"].is_array()) (*rp)["dropKeys"] = json::array();
      for (const std::string& k : cles)
        if (!dansTexte(*rp, "dropKeys", k)) (*rp)["dropKeys"].push_back(k);
      // Reste-t-il un exemplaire ? La régénération qui suit retire ses copies
      size_t restants = 0;
      for (const auto& b : (*rp)["bodyMap"].items())
        if (!dansTexte(*rp, "dropKeys", b.key())) restants++;
      if (!restants) retirerRepetition(d, idRep);
    }
  }
  // 2) répétitions qui consomment des fonctions de ce corps
  std::set<std::string> sources;
  for (const json& f : F)
    if (str(f, "body") == id && str(f, "repeatId").empty()) sources.insert(str(f, "id"));
  {
    std::vector<std::string> ids;
    for (const json& rp : F)
      if (str(rp, "type") == "repeat" && rp.contains("base") && rp["base"].is_array())
        for (const json& b : rp["base"])
          if (b.is_string() && sources.count(b.get<std::string>())) {
            ids.push_back(str(rp, "id"));
            break;
          }
    for (const std::string& idRep : ids) {
      json* rp = parId(F, idRep);
      if (!rp) continue;
      json garde = json::array();
      for (const json& b : (*rp)["base"])
        if (b.is_string() && !sources.count(b.get<std::string>())) garde.push_back(b);
      if (!garde.empty()) {
        (*rp)["base"] = garde;
        if (str(*rp, "body") == id)
          if (const json* k0 = parId(F, garde[0].get<std::string>())) (*rp)["body"] = str(*k0, "body");
        continue;
      }
      // repDetachCopies : les copies rangées ailleurs deviennent des fonctions ordinaires
      for (json& f : F)
        if (str(f, "repeatId") == idRep && str(f, "body") != id)
          for (const char* k : {"repeatId", "repIndex", "repBodyKey", "_src"}) f.erase(k);
      retirerRepetition(d, idRep);
    }
  }
  // 3) ses fonctions : une découpe qui traverse aussi d'autres corps y reste
  {
    std::vector<std::string> aRetirer;
    for (json& f : F) {
      if (str(f, "body") != id) continue;
      std::vector<std::string> autres;
      if (f.contains("cutBodies") && f["cutBodies"].is_array())
        for (const json& b : f["cutBodies"])
          if (b.is_string() && b.get<std::string>() != id && parId(liste(d, "bodies"), b.get<std::string>())) autres.push_back(b.get<std::string>());
      if (!autres.empty() && str(f, "repeatId").empty()) {
        f["body"] = autres[0];
        if (autres.size() > 1) f["cutBodies"] = json(std::vector<std::string>(autres.begin() + 1, autres.end()));
        else f.erase("cutBodies");
        continue;
      }
      aRetirer.push_back(str(f, "id"));
    }
    for (const std::string& x : aRetirer) stSupprimerFonction(d, x);
  }
  // 4) références des autres corps à celui-ci
  {
    std::vector<std::string> aRetirer;
    for (json& f : liste(d, "features")) {
      if (f.contains("cutBodies") && f["cutBodies"].is_array()) {
        retirerTexte(f, "cutBodies", id);
        if (f["cutBodies"].empty()) f.erase("cutBodies");
      }
      if (str(f, "type") == "combine" && dansTexte(f, "tools", id)) {
        retirerTexte(f, "tools", id);
        if (f["tools"].empty()) aRetirer.push_back(str(f, "id"));
      }
    }
    for (const std::string& x : aRetirer) stSupprimerFonction(d, x);
  }
  json& B = liste(d, "bodies");
  filtrer(B, [&](const json& e) { return str(e, "id") != id; });
  if (B.empty()) {
    const int n = d.contains("bodySeq") && d["bodySeq"].is_number() ? d["bodySeq"].get<int>() : 1;
    d["bodySeq"] = n + 1;
    B.push_back({{"id", "b" + std::to_string(n)}, {"name", "Corps " + std::to_string(n)}, {"c", nullptr}});
  }
  if (!parId(B, str(d, "activeBody"))) d["activeBody"] = B[0]["id"];
}

std::string stRetirerCorps(json& d, const std::string& id, int indiceMarque) {
  json* e = parId(liste(d, "bodies"), id);
  if (!e) return "";
  json& F = liste(d, "features");
  const size_t n = indiceMarque < 0 ? F.size() : std::min<size_t>(indiceMarque, F.size());
  for (size_t k = 0; k < n; k++)
    if (str(F[k], "type") == "bremove" && str(F[k], "body") == id) return "« " + str(*e, "name") + " » est déjà retiré à cet instant de la timeline.";
  std::string fid;
  for (int k = 1;; k++) {
    fid = "br_nat" + std::to_string(k);
    if (!parId(F, fid)) break;
  }
  json f = {{"id", fid}, {"type", "bremove"}, {"name", "Retirer « " + str(*e, "name") + " »"}, {"body", id}, {"visible", true}};
  F.insert(F.begin() + n, std::move(f));
  if (str(d, "activeBody") == id)
    for (const json& o : d["bodies"])
      if (str(o, "id") != id) {
        d["activeBody"] = o["id"];
        break;
      }
  return "";
}
