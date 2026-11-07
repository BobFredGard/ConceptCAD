// La table des configurations relue d'un fichier (cfgNorm, src/52-configurations.js). Sans le reste : les bancs lisent aussi les fichiers.
#include <cctype>
#include <cmath>
#include <set>

#include "configurations.h"

using J = nlohmann::ordered_json;

namespace {
bool nomValide(const std::string& s) {
  if (s.empty() || std::isdigit(static_cast<unsigned char>(s[0]))) return false;
  return std::all_of(s.begin(), s.end(), [](unsigned char c) { return c == '_' || (c < 128 && std::isalnum(c)); });
}
std::string sansBlancsAuxBouts(const std::string& s) {
  size_t a = 0, b = s.size();
  while (a < b && std::isspace(static_cast<unsigned char>(s[a]))) a++;
  while (b > a && std::isspace(static_cast<unsigned char>(s[b - 1]))) b--;
  return s.substr(a, b - a);
}
// String(v) du navigateur
std::string enTexte(const J& v) {
  if (v.is_string()) return v.get<std::string>();
  if (v.is_number()) {
    const double x = v.get<double>();
    if (x == std::floor(x) && std::abs(x) < 9e15) return std::to_string(static_cast<long long>(x));
    return v.dump();
  }
  if (v.is_boolean()) return v.get<bool>() ? "true" : "false";
  return "";
}
}  // namespace

J cfgNorm(const J& c) {
  if (!c.is_object() || !c.contains("rows") || !c["rows"].is_array()) return nullptr;
  J cols = J::array();
  std::vector<std::string> noms;
  if (c.contains("cols") && c["cols"].is_array())
    for (const J& n : c["cols"])
      if (n.is_string() && nomValide(n.get<std::string>())) noms.push_back(n.get<std::string>());
  std::set<std::string> vus;
  for (const std::string& n : noms)
    if (vus.insert(n).second) cols.push_back(n);
  J rows = J::array();
  bool actifConnu = false;
  const bool aActif = c.contains("active") && c["active"].is_string();
  for (const J& r : c["rows"]) {
    if (!r.is_object() || !r.contains("id") || !r["id"].is_string()) continue;
    J o = J::object();
    o["id"] = r["id"];
    const std::string nom = r.contains("name") ? enTexte(r["name"]) : std::string();
    o["name"] = nom.empty() ? r["id"].get<std::string>() : nom;
    J vals = J::object();
    if (r.contains("vals") && r["vals"].is_object())
      for (const std::string& n : noms)
        if (r["vals"].contains(n)) {
          const std::string v = enTexte(r["vals"][n]);
          if (!sansBlancsAuxBouts(v).empty()) vals[n] = v;
        }
    o["vals"] = std::move(vals);
    J off = J::array();
    if (r.contains("off") && r["off"].is_array())
      for (const J& x : r["off"])
        if (x.is_string()) off.push_back(x);
    o["off"] = std::move(off);
    if (aActif && o["id"] == c["active"]) actifConnu = true;
    rows.push_back(std::move(o));
  }
  if (rows.empty()) return nullptr;
  J t = J::object();
  t["active"] = actifConnu ? c["active"] : J(nullptr);
  t["cols"] = std::move(cols);
  t["rows"] = std::move(rows);
  return t;
}

