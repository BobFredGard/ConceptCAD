#include "fiches.h"

#include <algorithm>
#include <cmath>
#include <cctype>
#include <cstdio>
#include <set>
#include <stdexcept>

#include "construction.h"
#include "engrenage.h"
#include "filets.h"
#include "projet.h"

using json = nlohmann::ordered_json;

namespace {
std::string str(const json& o, const char* k) {
  const auto i = o.find(k);
  return i != o.end() && i->is_string() ? i->get<std::string>() : std::string();
}
double num(const json& o, const char* k, double d = 0) {
  const auto i = o.find(k);
  return i != o.end() && i->is_number() ? i->get<double>() : d;
}
bool vrai(const json& o, const char* k) {
  const auto i = o.find(k);
  return i != o.end() && i->is_boolean() && i->get<bool>();
}
json* parId(json& L, const std::string& id) {
  if (L.is_array())
    for (json& x : L)
      if (str(x, "id") == id) return &x;
  return nullptr;
}
const json* parId(const json& L, const std::string& id) {
  if (L.is_array())
    for (const json& x : L)
      if (str(x, "id") == id) return &x;
  return nullptr;
}
json& liste(json& d, const char* k) {
  if (!d.contains(k) || !d[k].is_array()) d[k] = json::array();
  return d[k];
}
// bmFmt : au plus n décimales, virgule
std::string fmt(double v, int n = 3) {
  char b[64];
  std::snprintf(b, sizeof b, "%.*f", n, v);
  std::string s = b;
  if (s.find('.') != std::string::npos) {
    while (s.back() == '0') s.pop_back();
    if (s.back() == '.') s.pop_back();
  }
  if (s == "-0") s = "0";
  std::replace(s.begin(), s.end(), '.', ',');
  return s;
}
std::string nomCorps(const json& d, const std::string& id) {
  if (d.contains("bodies"))
    if (const json* e = parId(d["bodies"], id)) return str(*e, "name");
  return "corps";
}
std::string nomEsquisse(const json& d, const std::string& id) {
  if (d.contains("sketches"))
    if (const json* s = parId(d["sketches"], id)) return str(*s, "name");
  return id;
}
size_t nbFaces(const json& f) { return f.contains("faces") && f["faces"].is_array() ? f["faces"].size() : 0; }
std::string libellePlan(const json& d, const json& pl) {
  const std::string s = pl.is_object() ? str(pl, "src") : "";
  if (s == "XY" || s == "XZ" || s == "YZ") return "plan " + s;
  if (s == "cg") {
    if (d.contains("cgeo"))
      if (const json* c = parId(d["cgeo"], str(pl, "cg"))) return str(*c, "name");
    return "plan de construction supprimé";
  }
  if (s == "face") return "face plane";
  return "plan ?";
}

// Le nom automatique de chaque fonction : combineName, revolveName, sweepName, bmName, bsName, splitName, mvName, draftName, shellName
// repTypeName
std::string nomRepetition(const json& f) {
  const std::string m = str(f, "mode");
  if (m == "mir" && !str(f, "plane2").empty()) return "Symétrie double";
  if (m == "lin" && vrai(f, "lin2")) return "Linéaire 2 directions";
  return m == "mir" ? "Symétrie" : m == "circ" ? "Circulaire" : m == "path" ? "Suivant un profil" : "Linéaire";
}
double percageTaraud(const std::string& taille, double p) {  // tapDrill
  const json* t = filetageDe(taille);
  if (!t) return 0;
  const json* I = infoFiletage(taille);
  if (I && num(*I, "drill") > 0 && (p == 0 || std::fabs(p - (*t)[2].get<double>()) < 1e-6)) return num(*I, "drill");
  return std::round(((*t)[1].get<double>() - (p != 0 ? p : (*t)[2].get<double>())) * 100) / 100;
}
std::string nombreJs(double v) {  // String(v), avec un point
  std::string s = fmt(v, 6);
  std::replace(s.begin(), s.end(), ',', '.');
  return s;
}
std::string libelleFiletage(const json& th) {  // holeThreadLabel
  const std::string size = str(th, "size");
  if (size.empty()) return "";
  const json* t = filetageDe(size);
  std::string pas = nombreJs(num(th, "p"));
  std::replace(pas.begin(), pas.end(), '.', ',');
  return size + (t && num(th, "p") != (*t)[2].get<double>() ? "×" + pas : std::string()) + (vrai(th, "lh") ? "-LH" : "");
}
std::string nomFiletage(const json& f) {  // threadName
  std::string l = libelleFiletage(f);
  std::string L = " (toute la face)";
  if (str(f, "lenMode") == "len") L = " × " + fmt(std::round(num(f, "len") * 100) / 100, 2);
  return "Filetage " + l + L;
}
// holeNorm, juste ce que montrent le nom et le panneau
double ou0(double x, double y) { return x == 0 || !std::isfinite(x) ? y : x; }
double percageAlesage(const json& f) {  // holeReamDrill
  const double D = std::max(0.2, ou0(num(f, "reamD"), 6)), off = num(f, "reamOff");
  const double dd = off > 0 ? D - off : ou0(num(f, "d"), D - 0.5);
  return std::round(std::min(D - 0.05, std::max(0.2, dd)) * 1000) / 1000;
}
std::string casAlesage(const json& f) {  // holeReamPilot
  const std::string p = str(f, "pilot");
  return p == "blind" || p == "through" || p == "open" ? p : "none";
}
size_t nbCentres(const json& d, const std::string& esquisse) {  // holePoints
  size_t n = 0;
  if (d.contains("sketches"))
    if (const json* s = parId(d["sketches"], esquisse); s && s->contains("entities") && (*s)["entities"].is_array() && s->contains("points") && (*s)["points"].is_object())
      for (const json& e : (*s)["entities"])
        if (str(e, "t") == "cpoint" && vrai(e, "hole") && (*s)["points"].contains(str(e, "p"))) n++;
  return n;
}
std::string nomPercage(const json& d, const json& f) {  // holeName
  const std::string n = std::to_string(nbCentres(d, str(f, "sketchId")));
  const std::string k = str(f, "kind");
  if (k == "ream") {
    const std::string pil = casAlesage(f);
    const double D = std::max(0.2, ou0(num(f, "reamD"), 6));
    const std::string tol = str(f, "reamTol").empty() ? "H7" : str(f, "reamTol");
    const double dd = pil == "none" || pil == "open" ? D : percageAlesage(f);
    return "Alésé Ø" + fmt(D, 2) + " " + tol + (pil == "none" ? std::string(" fond plat") : pil == "open" ? std::string(" débouchant") : " + Ø" + fmt(dd, 2) + (pil == "through" ? " débouchant" : "")) + " ×" + n;
  }
  const bool taraude = f.contains("thread") && f["thread"].is_object() && !str(f["thread"], "size").empty();
  std::string t = taraude ? "Taraudé " + libelleFiletage(f["thread"]) : "Ø" + fmt(num(f, "d"), 2);
  if (k == "cbore") t += " lamé Ø" + fmt(num(f, "cbD"), 2);
  if (k == "csink") t += " fraisé Ø" + fmt(num(f, "csD"), 2);
  if (k == "step") {
    const double d0 = std::max(0.2, ou0(num(f, "d"), 6.6));
    t = "Ø" + fmt(std::max(d0 + 0.2, ou0(num(f, "stD"), std::max(8.0, d0 * 2))), 2) + " ↧" + fmt(std::max(0.1, ou0(num(f, "stH"), 5)), 2) + " + " + t;
  }
  const std::string e = str(f, "end");
  return "Perçage " + t + (e == "through" ? " débouchant tout" : e == "next" ? " débouchant" : e == "upto" ? " jusqu’à la face" : "") + " ×" + n;
}

std::string nomAuto(const json& d, const json& f) {
  const std::string t = str(f, "type");
  if (t == "combine") {
    const std::string m = str(f, "mode");
    std::string r = m == "cut" ? "⊖ Soustraction" : m == "intersect" ? "⊗ Intersection" : "⊕ Union";
    r += " : ";
    bool premier = true;
    if (f.contains("tools") && f["tools"].is_array())
      for (const json& x : f["tools"]) {
        if (!premier) r += ", ";
        premier = false;
        r += nomCorps(d, x.is_string() ? x.get<std::string>() : std::string());
      }
    return r + " → " + nomCorps(d, str(f, "body"));
  }
  if (t == "revolve") {
    const double a = std::min(360.0, std::fabs(num(f, "angle", 360) != 0 ? num(f, "angle", 360) : 360));
    char b[32];
    std::snprintf(b, sizeof b, "%.0f°", a >= 359.9 ? 360.0 : std::round(a));
    return std::string(str(f, "op") == "cut" ? "Révolution (découpe) " : "Révolution ") + nomEsquisse(d, str(f, "sketchId")) + " " + b;
  }
  if (t == "sweep") {
    std::string r = std::string(str(f, "op") == "cut" ? "Balayage (découpe) " : "Balayage ") + nomEsquisse(d, str(f, "sketchId"));
    if (!str(f, "pathId").empty()) r += " le long de " + nomEsquisse(d, str(f, "pathId"));
    return r;
  }
  if (t == "bmove") return "Déplacer « " + nomCorps(d, str(f, "body")) + " »";
  if (t == "bscale") {
    const bool uni = !(f.contains("uni") && f["uni"].is_boolean() && !f["uni"].get<bool>());
    const std::string k = uni ? fmt(num(f, "s", 1), 4) : fmt(num(f, "sx", 1), 4) + " × " + fmt(num(f, "sy", 1), 4) + " × " + fmt(num(f, "sz", 1), 4);
    return "Échelle " + k + " « " + nomCorps(d, str(f, "body")) + " »" + (vrai(f, "copy") ? " (copie)" : "");
  }
  if (t == "xsplit") {
    const double o = num(f, "off");
    const std::string off = o != 0 ? std::string(" ") + (o > 0 ? "+" : "") + fmt(std::round(o * 1000) / 1000) + " mm" : "";
    const std::string plan = libellePlan(d, f.contains("pl") ? f["pl"] : json());
    if (str(f, "mode") == "body") return "Scinder le corps · " + plan + off;
    const size_t n = nbFaces(f);
    return "Scinder " + (n > 1 ? std::to_string(n) + " faces" : std::string("la face")) + " · " + plan + off;
  }
  if (t == "xmove") {
    const double v = num(f, "dist");
    const size_t n = nbFaces(f);
    return "Déplacement " + (n > 1 ? "de " + std::to_string(n) + " faces" : std::string("de face")) + " " + (v > 0 ? "+" : "") + fmt(v, 6) + " mm";
  }
  if (t == "xdraft") {
    const double a = (vrai(f, "flip") ? -1 : 1) * num(f, "angle");
    std::string s = fmt(std::round(a * 100) / 100, 2);
    if (s[0] == '-') s = "−" + s.substr(1);
    return "Dépouillage " + s + "° · " + std::to_string(nbFaces(f)) + " face(s)";
  }
  if (t == "xdelface") return nbFaces(f) > 1 ? "Suppression de " + std::to_string(nbFaces(f)) + " faces" : std::string("Suppression de face");
  if (t == "xfillet") return std::string(vrai(f, "chamfer") ? "Chanfrein exact" : "Congé exact") + " (" + std::to_string(f.contains("edges") && f["edges"].is_array() ? f["edges"].size() : 0) + " arête(s))";
  if (t == "xshell") return "Coque " + fmt(std::round(num(f, "thick") * 100) / 100, 2) + " mm · " + std::to_string(nbFaces(f)) + " face(s) retirée(s)";
  if (t == "repeat") return nomRepetition(f);
  if (t == "hole") return nomPercage(d, f);
  if (t == "xthread") return nomFiletage(f);
  return str(f, "name");
}

// Un champ
ChampFiche lecture(const std::string& titre, const std::string& texte, const std::string& cat = "") {
  ChampFiche c;
  c.titre = titre;
  c.texte = texte;
  c.categorie = cat;
  return c;
}
ChampFiche nombre(const std::string& titre, const std::string& cle, double v, const std::string& cat = "") {
  ChampFiche c;
  c.sorte = ChampFiche::NOMBRE;
  c.titre = titre;
  c.cle = cle;
  c.nombre = v;
  c.categorie = cat;
  return c;
}
ChampFiche booleen(const std::string& titre, const std::string& cle, bool v, const std::string& cat = "") {
  ChampFiche c;
  c.sorte = ChampFiche::BOOLEEN;
  c.titre = titre;
  c.cle = cle;
  c.oui = v;
  c.categorie = cat;
  return c;
}
ChampFiche choix(const std::string& titre, const std::string& cle, const std::string& v, std::vector<std::pair<std::string, std::string>> l, const std::string& cat = "") {
  ChampFiche c;
  c.sorte = ChampFiche::CHOIX;
  c.titre = titre;
  c.cle = cle;
  c.texte = v;
  c.choix = std::move(l);
  c.categorie = cat;
  return c;
}
std::vector<std::pair<std::string, std::string>> listeCorps(const Document& d, const std::string& sauf = "") {
  std::vector<std::pair<std::string, std::string>> l;
  for (size_t i = 0; i < d.corps.size(); i++)
    if (d.corps[i] != sauf) l.push_back({d.corps[i], i < d.nomsCorps.size() ? d.nomsCorps[i] : d.corps[i]});
  return l;
}
std::vector<std::pair<std::string, std::string>> listeEsquisses(const Document& d, const std::string& sauf = "") {
  std::vector<std::pair<std::string, std::string>> l;
  for (const Esquisse& s : d.esquisses)
    if (s.id != sauf) l.push_back({s.id, s.nom.empty() ? s.id : s.nom});
  return l;
}
const std::vector<std::pair<std::string, std::string>> OPERATIONS = {{"add", "Plot : ajoute de la matière"}, {"cut", "Poche : retire de la matière"}};

void etapesDeplacement(const json& f, std::vector<ChampFiche>& c) {
  const json vide = json::array();
  const json& S = f.contains("steps") && f["steps"].is_array() ? f["steps"] : vide;
  if (S.empty()) c.push_back(lecture("Étapes", "Aucune étape : le corps reste en place."));
  for (size_t i = 0; i < S.size(); i++) {
    const json& s = S[i];
    const std::string k = str(s, "k"), n = std::to_string(i);
    const std::string cat = n == "" ? "" : "Étape " + std::to_string(i + 1) + (k == "t" ? " : translation" : k == "d" ? " : suivant « " + (str(s, "name").empty() ? std::string("direction") : str(s, "name")) + " »" : k == "r" ? " : rotation autour de « " + (str(s, "name").empty() ? std::string("axe") : str(s, "name")) + " »" : " : point à point");
    if (k == "t") {
      const char* const noms[3] = {"X (mm)", "Y (mm)", "Z (mm)"};
      for (int j = 0; j < 3; j++) c.push_back(nombre(noms[j], "n/steps/" + n + "/v/" + std::to_string(j), s.contains("v") && s["v"].is_array() && s["v"].size() > static_cast<size_t>(j) && s["v"][j].is_number() ? s["v"][j].get<double>() : 0, cat));
    } else if (k == "d") {
      c.push_back(nombre("Distance (mm)", "n/steps/" + n + "/dist", num(s, "dist"), cat));
    } else if (k == "r") {
      c.push_back(nombre("Angle (°)", "n/steps/" + n + "/deg", num(s, "deg"), cat));
    } else {
      c.push_back(lecture("Trajet", (str(s, "na").empty() ? "?" : str(s, "na")) + " → " + (str(s, "nb").empty() ? "?" : str(s, "nb")), cat));
    }
    std::vector<std::pair<std::string, std::string>> a = {{"", "—"}, {"suppr", "Supprimer l'étape"}};
    if (i > 0) a.push_back({"monter", "Monter l'étape"});
    c.push_back(choix("Action", "x/etape/" + n, "", a, cat));
  }
  c.push_back(choix("Ajouter une étape", "x/ajout", "", {{"", "—"}, {"t", "Translation X Y Z"}, {"rx", "Rotation autour de X (origine)"}, {"ry", "Rotation autour de Y (origine)"}, {"rz", "Rotation autour de Z (origine)"}}, "Ajouter"));
}

const std::vector<std::pair<std::string, std::string>> POINTES = {{"118", "Pointe 118°"}, {"135", "Pointe 135°"}, {"140", "Pointe 140°"}, {"90", "Pointe 90°"}, {"0", "Fond plat"}};
std::string texteAngle(double v) { return std::to_string(static_cast<int>(std::lround(v))); }
double fraisureVis(const json& v) {  // fhcCsD
  const double a = v.size() > 3 ? v[3].get<double>() : 90;
  return std::ceil((v[2].get<double>() + 2 * 0.2 * std::tan(a * 3.141592653589793 / 360)) * 10 - 1e-6) / 10;
}
std::string visDe(const json& f) {  // holeScrewOf
  if (f.contains("thread") && f["thread"].is_object() && !str(f["thread"], "size").empty()) return "";
  const auto eq = [](double a, double b) { return std::fabs(a - b) < 1e-6; };
  const std::string k = str(f, "kind");
  const json& T = tablesPercage();
  for (const char* tab : {"chc", "achc"})
    for (const json& x : T[tab])
      if (k == "cbore" && eq(num(f, "d"), x[1].get<double>()) && eq(num(f, "cbD"), x[2].get<double>()) && eq(num(f, "cbH"), x[3].get<double>())) return x[0].get<std::string>();
  for (const char* tab : {"fhc", "afhc"})
    for (const json& x : T[tab])
      if (k == "csink" && eq(num(f, "d"), x[1].get<double>()) && eq(num(f, "csD"), fraisureVis(x)) && eq(num(f, "csA", 90), x.size() > 3 ? x[3].get<double>() : 90)) return x[0].get<std::string>();
  return "";
}
std::string libelleTaraud(const json& t, size_t k) {  // threadOptLabel
  const std::string nom = t[0];
  const json* I = infoFiletage(nom);
  if (I) return nom + " (" + nombreJs(num(*I, "tpi")) + " filets/po" + (vrai(*I, "cone") ? ", conique" : "") + ")";
  return k > 2 ? nom + "×" + fmt(t[k].get<double>(), 6) + " (fin)" : nom + " (pas " + fmt(t[2].get<double>(), 6) + ")";
}
void champsPercage(const Document& d, const json& f, std::vector<ChampFiche>& c) {
  const std::string kind = str(f, "kind").empty() ? "simple" : str(f, "kind");
  const Esquisse* s = const_cast<Document&>(d).esquisse(str(f, "sketchId"));
  size_t nP = 0;
  if (s)
    for (const Entite& e : s->entites)
      if (e.t == "cpoint" && e.percage) nP++;
  c.push_back(lecture("Centres", std::to_string(nP) + " dans « " + (s ? s->nom : str(f, "sketchId")) + " »"));
  c.push_back(choix("Type", "x/kind", kind, {{"simple", "⊚ Simple"}, {"cbore", "⊡ Lamage"}, {"csink", "⊽ Fraisure"}, {"step", "◎ Double"}, {"ream", "⌀ Alésé"}}));
  const std::string sens = vrai(f, "flip") ? "1" : "0";
  const std::vector<std::pair<std::string, std::string>> SENS = {{"0", "Vers la matière (auto)"}, {"1", "Inversé"}};
  const json& T = tablesPercage();
  if (kind == "ream") {
    const std::string pil = casAlesage(f);
    const double D = std::max(0.2, ou0(num(f, "reamD"), 6)), H = std::max(0.1, ou0(num(f, "reamH"), D * 1.5));
    c.push_back(choix("Cas", "x/pilot", pil, {{"none", "Alésage fond plat seul"}, {"blind", "+ perçage non débouchant"}, {"through", "+ perçage débouchant"}, {"open", "Alésage débouchant"}}));
    c.push_back(nombre("Ø alésage (mm)", "n/reamD", D));
    std::string tol = str(f, "reamTol").empty() ? "H7" : str(f, "reamTol");
    size_t rang = 0;
    while (rang < tol.size() && !std::isdigit(static_cast<unsigned char>(tol[rang]))) rang++;
    const std::string L = tol.substr(0, rang), G = tol.substr(rang);
    std::vector<std::pair<std::string, std::string>> lettres, qualites;
    for (const json& x : T["lettres"]) lettres.push_back({x.get<std::string>(), x.get<std::string>()});
    if (T["qualites"].contains(L))
      for (const json& x : T["qualites"][L]) qualites.push_back({x.get<std::string>(), x.get<std::string>()});
    c.push_back(choix("Tolérance (écart)", "x/tolL", L, lettres));
    c.push_back(choix("Qualité (IT)", "x/tolG", G, qualites));
    if (pil != "open") c.push_back(nombre("Profondeur alésage (mm)", "n/reamH", H));
    if (pil == "blind" || pil == "through") {
      const double off = num(f, "reamOff");
      const std::string mode = !(off > 0) ? "" : (vrai(f, "reamOffFree") || (off != 0.5 && off != 1)) ? "other" : off == 0.5 ? "0.5" : "1";
      c.push_back(choix("Ø perçage", "x/ecart", mode.empty() ? "libre" : mode, {{"0.5", "Ø alésage − 0,5 (" + fmt(D - 0.5) + ")"}, {"1", "Ø alésage − 1 (" + fmt(D - 1) + ")"}, {"other", "Autre écart"}, {"libre", "Libre"}}));
      if (mode == "other") c.push_back(nombre("Jeu sur le Ø (mm)", "n/reamOff", off));
      if (mode.empty()) c.push_back(nombre("Ø du perçage (mm)", "n/d", percageAlesage(f)));
    }
    if (pil == "blind") {
      c.push_back(nombre("Prof. perçage, plein Ø (mm)", "n/depth", std::max(H + 0.1, ou0(num(f, "depth"), H + 2 * D))));
      c.push_back(choix("Fond du perçage", "x/tip", texteAngle(num(f, "tip", 118)), POINTES));
    }
    c.push_back(choix("Sens", "x/flip", sens, SENS));
    return;
  }
  // Taraudage
  const bool taraude = f.contains("thread") && f["thread"].is_object() && !str(f["thread"], "size").empty();
  std::vector<std::pair<std::string, std::string>> liste = {{"", "Aucun (trou lisse)"}};
  for (const char* tab : {"iso", "un", "gaz"})
    for (const json& t : T[tab])
      for (size_t k = 2; k < t.size(); k++) liste.push_back({t[0].get<std::string>() + "|" + nombreJs(t[k].get<double>()), libelleTaraud(t, k)});
  c.push_back(choix("Taraudage", "x/thread", taraude ? str(f["thread"], "size") + "|" + nombreJs(num(f["thread"], "p")) : "", liste));
  // Vis
  const std::string vis = visDe(f);
  const auto listeVis = [&](const char* a, const char* b, bool chc) {
    std::vector<std::pair<std::string, std::string>> l = {{"", "—"}};
    for (const char* tab : {a, b})
      for (const json& x : T[tab]) {
        const std::string n = x[0];
        l.push_back({n, chc ? n + " : Ø" + fmt(x[1].get<double>()) + " / lamage Ø" + fmt(x[2].get<double>()) + " × " + fmt(x[3].get<double>())
                            : n + " : Ø" + fmt(x[1].get<double>()) + " / fraisure Ø" + fmt(fraisureVis(x)) + " × " + texteAngle(x.size() > 3 ? x[3].get<double>() : 90) + "° (tête −0,2)"});
      }
    return l;
  };
  if (kind == "cbore") c.push_back(choix("Vis CHC", "x/chc", vis, listeVis("chc", "achc", true)));
  if (kind == "csink") c.push_back(choix("Vis FHC", "x/fhc", vis, listeVis("fhc", "afhc", false)));
  c.push_back(nombre(taraude ? "Ø taraud " + libelleFiletage(f["thread"]) + " (mm)" : "Ø du trou (mm)", "n/d", num(f, "d")));
  if (taraude) {
    const json& th = f["thread"];
    c.push_back(choix("Sens du filet", "x/lh", vrai(th, "lh") ? "lh" : "rh", {{"rh", "À droite"}, {"lh", "À gauche (LH)"}}));
    const std::string tm = str(th, "lenMode").empty() ? "len" : str(th, "lenMode");
    c.push_back(choix("Longueur filetée", "x/thlen", tm, {{"len", "Longueur"}, {"through", "Débouchant tout (à travers)"}, {"upto", "Jusqu'à la face…"}, {"next", "Prochaine face"}}));
    if (tm == "len") c.push_back(nombre("Longueur (mm)", "n/thread/len", num(th, "len") > 0 ? num(th, "len") : num(f, "depth")));
    if (tm == "upto") c.push_back(choix("Face de fin du filet", "x/facethr", "", {{"", vrai(th, "aFace") || th.contains("uptoPlane") ? "retenue" : "à choisir"}, {"pick", "🎯 Cliquer une face"}}));
    if (const std::string ts = str(th, "size"); !filetModelable(ts)) {
      const json* I = infoFiletage(ts);
      c.push_back(lecture("Filet", std::string(I && vrai(*I, "cone") ? "Conique, c" : "C") + "osmétique seulement (profil non modélisé)"));
    } else {
      c.push_back(choix("Filet", "x/filet", vrai(th, "model") ? "model" : "cosmetic", {{"model", "Modélisé : profil ISO dans le corps"}, {"cosmetic", "Cosmétique : dessin seul, trou lisse"}}));
      if (vrai(th, "model")) {
        c.push_back(nombre("Jeu (Ø mm, impression 3D)", "n/thread/clear", num(th, "clear")));
        if (const auto F = filetInterieur(ts, num(th, "p"), num(th, "clear")))
          c.push_back(lecture("Profil", std::string(infoFiletage(ts) ? "ASME B1.1" : "ISO 261 / ISO 965-1") + " : Ø mineur " + fmt(F->D1) + " / Ø majeur " + fmt(F->D) + ", pas " + fmt(F->P) + " mm"));
      }
    }
  }
  if (kind == "cbore") {
    c.push_back(nombre("Ø lamage (mm)", "n/cbD", num(f, "cbD")));
    c.push_back(nombre("Profondeur lamage (mm)", "n/cbH", num(f, "cbH")));
  }
  if (kind == "step") {
    const double d0 = std::max(0.2, ou0(num(f, "d"), 6.6));
    c.push_back(nombre("Ø avant-trou (mm)", "n/stD", ou0(num(f, "stD"), std::max(d0 + 0.2, std::max(8.0, d0 * 2)))));
    c.push_back(nombre("Prof. avant-trou, plein Ø (mm)", "n/stH", ou0(num(f, "stH"), 5)));
    c.push_back(choix("Fond avant-trou", "x/stTip", texteAngle(num(f, "stTip", 118)), POINTES));
  }
  if (kind == "csink") {
    c.push_back(nombre("Ø fraisure (mm)", "n/csD", num(f, "csD")));
    c.push_back(choix("Angle", "x/csA", texteAngle(num(f, "csA", 90)), {{"90", "90°"}, {"82", "82° (UNC)"}, {"100", "100°"}, {"120", "120°"}}));
  }
  const std::string fin = str(f, "end").empty() ? "blind" : str(f, "end");
  c.push_back(choix("Fin", "x/end", fin, {{"blind", "Borgne : profondeur donnée"}, {"upto", "Jusqu'à la face"}, {"next", "Débouchant : prochaine face"}, {"through", "Tout : traverse tout"}}));
  if (fin == "upto") c.push_back(choix("Face de fin", "x/facefin", "", {{"", f.contains("uptoPlane") ? "retenue" : "à choisir"}, {"pick", "🎯 Cliquer une face"}}));
  if (fin == "blind") {
    c.push_back(nombre("Profondeur, plein Ø (mm)", "n/depth", num(f, "depth")));
    c.push_back(choix("Fond", "x/tip", texteAngle(num(f, "tip", 118)), POINTES));
  }
  c.push_back(choix("Sens", "x/flip", sens, SENS));
}

// repCanFeature
bool repetableTypes(const std::string& t) { return t == "repeat" || t == "extrude" || t == "revolve" || t == "sweep" || t == "hole" || t == "xfillet" || t == "xdraft" || t == "xmove" || t == "xdelface"; }
bool repetable(const json& f) { return str(f, "repeatId").empty() && repetableTypes(str(f, "type")); }
std::vector<std::pair<std::string, std::string>> listeAxes(bool plan, bool definie) {
  std::vector<std::pair<std::string, std::string>> l;
  if (plan) l = {{"YZ", "YZ"}, {"XZ", "XZ"}, {"XY", "XY"}};
  else l = {{"X", "X"}, {"Y", "Y"}, {"Z", "Z"}};
  l.push_back({"Face", std::string(definie ? "Face / arête retenue" : "🎯 Cliquer une face") + (plan ? "" : " ou une arête")});
  if (definie) l.push_back({"Face+", plan ? "🎯 Cliquer une autre face" : "🎯 Cliquer une autre face ou arête"});
  return l;
}
void champsRepetition(const Document& d, const json& f, std::vector<ChampFiche>& c) {
  const std::string mode = str(f, "mode").empty() ? "lin" : str(f, "mode");
  size_t instances = 0;
  std::set<std::string> corpsCopies;
  const std::vector<Fonction>& F = d.fonctions;
  int ici = -1;
  for (size_t i = 0; i < F.size(); i++) {
    if (F[i].id == str(f, "id")) ici = static_cast<int>(i);
    if (F[i].repeatId == str(f, "id")) {
      instances++;
      corpsCopies.insert(F[i].corps);
    }
  }
  c.push_back(lecture("Copies", std::to_string(instances) + " instance(s)"));
  std::vector<std::pair<std::string, std::string>> types = {{"lin", "Linéaire"}, {"circ", "Circulaire"}, {"mir", "Symétrie"}};
  if (mode == "path") types.push_back({"path", "Suivant un profil"});
  c.push_back(choix("Type", "x/mode", mode, types));
  const bool neuf = str(f, "op") == "new";
  c.push_back(choix("Opération", "x/opr", neuf ? "new" : "join", {{"join", "➕ Unir : au corps de la source"}, {"new", "◧ Nouveau corps par exemplaire"}}));
  if (neuf) {
    c.push_back(lecture("Corps créés", std::to_string(corpsCopies.size()) + ", un par exemplaire"));
    if (f.contains("dropKeys") && f["dropKeys"].is_array() && !f["dropKeys"].empty()) c.push_back(choix("Exemplaires supprimés", "x/retablir", "", {{"", std::to_string(f["dropKeys"].size())}, {"oui", "↺ Les rétablir"}}));
  }
  if (mode != "mir") c.push_back(nombre("Quantité, original compris", "n/qty", std::min(200.0, std::max(1.0, std::floor(num(f, "copies", 1)))) + 1));
  if (mode == "path") {
    c.push_back(lecture("Courbe guide", "Ce réglage n'est pas encore repris ici"));
  } else if (mode == "mir") {
    const std::string pl = str(f, "plane").empty() ? "YZ" : str(f, "plane");
    c.push_back(choix("Plan", "x/rep1", pl, listeAxes(true, pl == "Face" && f.contains("planeN"))));
    const std::string p2 = str(f, "plane2");
    c.push_back(booleen("2ᵉ plan (double)", "x/dbl", !p2.empty()));
    if (!p2.empty()) c.push_back(choix("2ᵉ plan", "x/rep2", p2, listeAxes(true, p2 == "Face" && f.contains("planeN2"))));
  } else {
    const bool aDir = f.contains("dir") && f["dir"].is_array();
    const std::string ax = aDir && str(f, "axis").empty() ? "Face" : str(f, "axis").empty() ? "X" : str(f, "axis");
    c.push_back(choix("Axe", "x/rep1", ax, listeAxes(false, ax == "Face" && aDir)));
    c.push_back(choix("Sens", "x/inv1", "", {{"", "—"}, {"oui", "⇄ Inverser la direction"}}));
    if (mode == "lin") {
      c.push_back(nombre("Distance (mm)", "n/dist", num(f, "dist")));
      const bool l2 = vrai(f, "lin2");
      c.push_back(booleen("2ᵉ direction (grille)", "x/lin2", l2));
      if (l2) {
        const bool aDir2 = f.contains("dir2") && f["dir2"].is_array();
        const std::string a2 = str(f, "axis2").empty() ? "Y" : str(f, "axis2");
        c.push_back(choix("2ᵉ axe", "x/rep2", a2, listeAxes(false, a2 == "Face" && aDir2)));
        c.push_back(choix("2ᵉ sens", "x/inv2", "", {{"", "—"}, {"oui", "⇄ Inverser la 2ᵉ direction"}}));
        const int q1 = static_cast<int>(std::min(200.0, std::max(1.0, std::floor(num(f, "copies", 1))))) + 1, q2 = static_cast<int>(std::min(200.0, std::max(1.0, std::floor(num(f, "copies2", 1))))) + 1;
        c.push_back(nombre("Quantité 2", "n/qty2", q2));
        c.push_back(nombre("Distance 2 (mm)", "n/dist2", num(f, "dist2")));
        c.push_back(lecture("Grille", std::to_string(q1) + " × " + std::to_string(q2) + " = " + std::to_string(q1 * q2) + " exemplaires, original compris" + (q1 * q2 - 1 > 200 ? " : limité à 200 copies" : "")));
      }
    } else {
      c.push_back(nombre("Angle total (°)", "n/angle", num(f, "angle", 360)));
    }
  }
  // Les sources : seules les fonctions en amont sont proposées ; une source déjà cochée en aval reste visible, marquée ⚠
  const std::string cat = "Fonctions à répéter";
  std::set<std::string> base;
  if (f.contains("base") && f["base"].is_array())
    for (const json& x : f["base"])
      if (x.is_string()) base.insert(x.get<std::string>());
  size_t cochees = 0, nb = 0;
  std::vector<ChampFiche> cases;
  for (size_t i = 0; i < F.size(); i++) {
    if (!repetableTypes(F[i].type) || !F[i].repeatId.empty()) continue;
    const std::string id = F[i].id;
    const bool amont = ici < 0 || static_cast<int>(i) < ici;
    if (!amont && !base.count(id)) continue;
    nb++;
    if (base.count(id)) cochees++;
    cases.push_back(booleen(std::string(amont ? "" : "⚠ ") + (F[i].nom.empty() ? id : F[i].nom), "x/src/" + id, base.count(id) > 0, cat));
  }
  c.push_back(lecture("Cochées", std::to_string(cochees) + " sur " + std::to_string(nb), cat));
  if (cases.empty()) c.push_back(lecture("Aucune", "Aucune fonction répétable en amont", cat));
  c.insert(c.end(), cases.begin(), cases.end());
}
}  // namespace

namespace {
void champsFiletage(const json& f, std::vector<ChampFiche>& c) {  // renderThreadProps
  const double D = f.contains("cyl") && f["cyl"].is_object() ? 2 * num(f["cyl"], "r") : 0;
  c.push_back(lecture("Axe", "Ø" + fmt(D)));
  std::vector<std::pair<std::string, std::string>> tailles;
  const auto ajoute = [&](const json& t) {
    const std::string n = t[0];
    if (!infoFiletage(n)) {
      for (size_t k = 2; k < t.size(); k++) tailles.push_back({n + "|" + nombreJs(t[k].get<double>()), libelleTaraud(t, k)});
    } else {
      tailles.push_back({n + "|" + nombreJs(t[2].get<double>()), libelleTaraud(t, 2)});
    }
  };
  const json& T = tablesPercage();
  const auto conique = [](const json& t) {
    const json* I = infoFiletage(t[0].get<std::string>());
    return I && vrai(*I, "cone");
  };
  for (const char* k : {"iso", "un", "gaz"})  // celles proches du Ø de l'axe d'abord
    for (const json& t : T[k])
      if (!conique(t) && std::fabs(t[1].get<double>() - D) < std::max(0.6, 0.08 * D)) ajoute(t);
  for (const char* k : {"iso", "un", "gaz"})
    for (const json& t : T[k])
      if (!conique(t)) ajoute(t);
  std::vector<std::pair<std::string, std::string>> uniques;
  for (const auto& x : tailles)
    if (std::none_of(uniques.begin(), uniques.end(), [&](const auto& y) { return y.first == x.first; })) uniques.push_back(x);
  c.push_back(choix("Taille", "x/taille", str(f, "size") + "|" + nombreJs(num(f, "p")), uniques));
  c.push_back(choix("Sens du filet", "x/sens", vrai(f, "lh") ? "lh" : "rh", {{"rh", "À droite"}, {"lh", "À gauche (LH)"}}));
  const std::string lm = str(f, "lenMode") == "len" ? "len" : "full";
  c.push_back(choix("Longueur filetée", "x/lenMode", lm, {{"full", "Toute la face"}, {"len", "Longueur"}}));
  if (lm == "len") c.push_back(nombre("Longueur (mm)", "n/len", num(f, "len") > 0 ? num(f, "len") : 10));
  c.push_back(choix("Départ", "x/depart", vrai(f, "flip") ? "1" : "0", {{"0", "Bout libre (auto)"}, {"1", "Autre bout"}}));
  if (filetModelable(str(f, "size"))) {
    c.push_back(choix("Filet", "x/filet", vrai(f, "model") ? "model" : "cosmetic", {{"cosmetic", "Cosmétique : spirale dessinée, axe lisse"}, {"model", "Modélisé : profil ISO dans le corps"}}));
    if (vrai(f, "model")) c.push_back(nombre("Jeu (Ø mm, impression 3D)", "n/clear", num(f, "clear")));
  } else {
    c.push_back(lecture("Filet", "Filet gaz (55°) : cosmétique seulement"));
  }
  c.push_back(choix("Face de l'axe", "x/face", "", {{"", "retenue"}, {"pick", "🎯 Changer la face"}}));
}
// threadSizeFor : la taille la plus proche du Ø (métrique ISO d'abord, à Ø égal), pas gros
json tailleProche(double D, double* ecart) {
  json best;
  double bd = 1e9;
  for (const char* k : {"iso", "un", "gaz"})
    for (const json& t : tablesPercage()[k]) {
      const json* I = infoFiletage(t[0].get<std::string>());
      if (I && vrai(*I, "cone")) continue;
      const double e = std::fabs(t[1].get<double>() - D) + (!I || str(*I, "fam") == "M" ? 0 : 1e-3);
      if (e < bd) {
        bd = e;
        best = t;
      }
    }
  if (ecart) *ecart = bd;
  return best;
}
std::string appliquerFiletage(json& f, const std::string& cle, const std::string& v) {
  if (cle == "x/taille") {
    const size_t b = v.find('|');
    if (b == std::string::npos) return "";
    f["size"] = v.substr(0, b);
    f["p"] = std::stod(v.substr(b + 1));
    if (!filetModelable(str(f, "size"))) f["model"] = false;
  } else if (cle == "x/sens") {
    f["lh"] = v == "lh";
  } else if (cle == "x/lenMode") {
    f["lenMode"] = v;
  } else if (cle == "x/depart") {
    f["flip"] = v == "1";
  } else if (cle == "x/filet") {
    f["model"] = v == "model";
  } else if (cle == "x/face") {
    return "";  // le clic dans la vue est demandé par le cadre
  } else if (cle == "x/cyl") {
    const json q = json::parse(v);
    f["cyl"] = q["cyl"];
    if (!str(q, "body").empty()) f["body"] = q["body"];
    double e = 0;
    const json z = tailleProche(2 * num(f["cyl"], "r"), &e);
    if (!z.is_null() && e < 0.5) {
      f["size"] = z[0];
      f["p"] = z[2];
    }
  } else {
    return "Réglage inconnu.";
  }
  return "";
}
}  // namespace

std::vector<ChampFiche> ficheFonction(const Document& d, const json& f) {
  std::vector<ChampFiche> c;
  const std::string t = str(f, "type");
  if (t == "combine") {
    const std::string body = str(f, "body");
    const std::string outil = f.contains("tools") && f["tools"].is_array() && !f["tools"].empty() && f["tools"][0].is_string() ? f["tools"][0].get<std::string>() : "";
    c.push_back(choix("Corps cible", "x/cible", body, listeCorps(d)));
    c.push_back(choix("Corps outil", "x/outil", outil, listeCorps(d, body)));
    c.push_back(choix("Opération", "s/mode", str(f, "mode").empty() ? "union" : str(f, "mode"), {{"union", "⊕ Union (joindre)"}, {"cut", "⊖ Soustraction (couper)"}, {"intersect", "⊗ Intersection (garder le commun)"}}));
    c.push_back(booleen("Garder le corps outil", "b/keep", vrai(f, "keep")));
  } else if (t == "revolve") {
    c.push_back(choix("Profil", "s/sketchId", str(f, "sketchId"), listeEsquisses(d)));
    c.push_back(choix("Opération", "s/op", str(f, "op").empty() ? "add" : str(f, "op"), OPERATIONS));
    std::vector<std::pair<std::string, std::string>> axes;
    if (const Esquisse* s = const_cast<Document&>(d).esquisse(str(f, "sketchId")))
      for (const Entite& e : s->entites)
        if (e.t == "line") axes.push_back({"L:" + e.id, (e.axe ? "⟲ axe " : e.construction ? "constr. " : "ligne ") + e.id});
    axes.push_back({"S:X", "axe X"});
    axes.push_back({"S:Y", "axe Y"});
    axes.push_back({"S:Z", "axe Z"});
    std::string v = "S:X";
    if (f.contains("axis") && f["axis"].is_object()) v = str(f["axis"], "k") == "line" ? "L:" + str(f["axis"], "id") : "S:" + str(f["axis"], "d");
    c.push_back(choix("Axe", "x/axe", v, axes));
    c.push_back(nombre("Angle (°)", "n/angle", std::min(360.0, std::fabs(num(f, "angle", 360) != 0 ? num(f, "angle", 360) : 360))));
  } else if (t == "sweep") {
    c.push_back(choix("Opération", "s/op", str(f, "op").empty() ? "add" : str(f, "op"), OPERATIONS));
    c.push_back(choix("Profil (fermé)", "s/sketchId", str(f, "sketchId"), listeEsquisses(d)));
    c.push_back(choix("Chemin", "s/pathId", str(f, "pathId"), listeEsquisses(d, str(f, "sketchId"))));
  } else if (t == "bmove") {
    c.push_back(choix("Corps", "s/body", str(f, "body"), listeCorps(d)));
    etapesDeplacement(f, c);
  } else if (t == "bscale") {
    const std::string nb = str(f, "newBody");
    c.push_back(choix("Corps", "s/body", str(f, "body"), listeCorps(d, nb)));
    c.push_back(choix("Résultat", "x/resultat", vrai(f, "copy") ? "new" : "mod", {{"mod", "Modifier le corps"}, {"new", "Nouveau corps (copie)"}}));
    const bool uni = !(f.contains("uni") && f["uni"].is_boolean() && !f["uni"].get<bool>());
    c.push_back(choix("Type", "x/uni", uni ? "u" : "n", {{"u", "Uniforme (homothétie)"}, {"n", "Non uniforme (X, Y, Z)"}}));
    if (uni) {
      c.push_back(nombre("Facteur", "n/s", num(f, "s", 1)));
    } else {
      c.push_back(nombre("Facteur X", "n/sx", num(f, "sx", 1)));
      c.push_back(nombre("Facteur Y", "n/sy", num(f, "sy", 1)));
      c.push_back(nombre("Facteur Z", "n/sz", num(f, "sz", 1)));
    }
    const char* const noms[3] = {"X (mm)", "Y (mm)", "Z (mm)"};
    for (int j = 0; j < 3; j++) c.push_back(nombre(noms[j], "n/o/" + std::to_string(j), f.contains("o") && f["o"].is_array() && f["o"].size() > static_cast<size_t>(j) && f["o"][j].is_number() ? f["o"][j].get<double>() : 0, "Centre"));
  } else if (t == "xsplit") {
    const bool corps = str(f, "mode") == "body";
    c.push_back(lecture("Coupe", corps ? "le corps en deux" : std::to_string(nbFaces(f)) + " face(s), le solide reste entier"));
    if (corps) c.push_back(choix("Corps coupé", "s/body", str(f, "body"), listeCorps(d, str(f, "newBody"))));
    std::string v = "XY";
    if (f.contains("pl") && f["pl"].is_object()) v = str(f["pl"], "src") == "cg" ? "cg:" + str(f["pl"], "cg") : str(f["pl"], "src");
    std::vector<std::pair<std::string, std::string>> plans = {{"XY", "Plan XY (origine)"}, {"XZ", "Plan XZ (origine)"}, {"YZ", "Plan YZ (origine)"}};
    for (const ElementConstruction& e : d.construction)
      if (e.kind == "plane") plans.push_back({"cg:" + e.id, "▱ " + e.nom});
    if (v == "face") plans.push_back({"face", "Face plane (cliquée)"});
    c.push_back(choix("Plan", "x/plan", v, plans));
    c.push_back(nombre("Décalage (mm)", "n/off", num(f, "off")));
    c.push_back(booleen("Inverser", "b/flip", vrai(f, "flip")));
  } else if (t == "xmove") {
    c.push_back(lecture("Faces visées", std::to_string(std::max<size_t>(nbFaces(f), f.contains("ref") ? 1 : 0))));
    c.push_back(nombre("Distance (mm)", "n/dist", num(f, "dist")));
    c.push_back(lecture("Sens", "Positif : la face avance. Négatif : elle rentre."));
  } else if (t == "xdraft") {
    c.push_back(lecture("Faces", std::to_string(nbFaces(f))));
    c.push_back(nombre("Angle (°)", "n/angle", num(f, "angle")));
    c.push_back(booleen("Inverser le sens", "b/flip", vrai(f, "flip")));
  } else if (t == "xshell") {
    c.push_back(lecture("Faces retirées", std::to_string(nbFaces(f))));
    c.push_back(nombre("Épaisseur (mm)", "n/thick", num(f, "thick")));
  } else if (t == "xdelface") {
    c.push_back(lecture("Faces supprimées", std::to_string(nbFaces(f))));
  } else if (t == "bremove") {
    c.push_back(choix("Corps retiré", "s/body", str(f, "body"), listeCorps(d)));
  } else if (t == "xfillet") {
    const bool ch = vrai(f, "chamfer");
    const std::string dp = ch ? "D" : "R";
    std::vector<std::pair<std::string, std::string>> retrait{{"", "Choisir…"}};
    if (f.contains("edges") && f["edges"].is_array()) {
      for (size_t i = 0; i < f["edges"].size(); i++) {
        const json& e = f["edges"][i];
        const std::string nm = str(e, "name").empty() ? "Arête " + std::to_string(i + 1) : str(e, "name");
        c.push_back(nombre(nm + " · " + dp, "n/edges/" + std::to_string(i) + "/r", num(e, "r")));
        retrait.push_back({std::to_string(i), nm});
      }
      if (!f["edges"].empty()) {
        c.push_back(nombre(std::string(ch ? "Distance" : "Rayon") + " (toutes)", "x/toutes", num(f["edges"][0], "r") > 0 ? num(f["edges"][0], "r") : 1));
        c.push_back(choix("Retirer une arête", "x/retirer", "", retrait));
      }
    }
    if (ch) {
      const std::string m = str(f, "cmode");
      const std::string mode = m == "d2" || m == "da" ? m : "eq";
      c.push_back(choix("Type de chanfrein", "s/cmode", mode, {{"eq", "Distance égale"}, {"d2", "Deux distances"}, {"da", "Distance + angle"}}));
      if (mode == "d2") c.push_back(nombre("Distance 2 (mm)", "n/cd2", num(f, "cd2")));
      if (mode == "da") c.push_back(nombre("Angle (°)", "n/cang", num(f, "cang") > 0 ? num(f, "cang") : 45));
      if (mode != "eq") c.push_back(booleen("⇄ Inverser les faces", "b/cflip", vrai(f, "cflip")));
    }
  } else if (t == "import") {
    if (f.contains("src") && f["src"].is_object()) {
      c.push_back(lecture("Fichier", str(f["src"], "file")));
      c.push_back(lecture("Format", str(f["src"], "fmt") == "stl" ? "STL (maillage)" : "STEP (solide exact)"));
      c.push_back(lecture("Taille", fmt(num(f["src"], "size") / 1024, 1) + " Ko"));
    }
  } else if (t == "extrude" && (vrai(f, "kw") || !str(f, "kwKey").empty())) {
    ficheClavette(d, f, c);
  } else if (t == "gear") {
    // renderGearProps : on change la roue depuis l'assemblage, le panneau ne fait que la décrire
    const Fonction* fn = nullptr;
    for (const Fonction& x : d.fonctions)
      if (x.id == str(f, "id")) fn = &x;
    try {
      if (!fn) throw std::runtime_error("fonction introuvable");
      const GeoEngrenage g = geoEngrenage(fn->engrenage);
      const std::string main = g.hand == "L" ? " main gauche" : " main droite";
      c.push_back(lecture(g.rack ? "Crémaillère" : g.internal ? "Couronne" : "Engrenage", g.rack ? "à crémaillère" : g.internal ? "à denture intérieure" : "à denture extérieure"));
      c.push_back(lecture(g.betaDeg != 0 && !g.rack ? "Module normal" : "Module", fmt(g.m) + " mm"));
      c.push_back(lecture("Dents", std::to_string(g.z)));
      c.push_back(lecture("Angle de pression", fmt(g.aDeg) + "°"));
      if (g.betaDeg != 0) c.push_back(lecture(g.rack ? "Inclinaison" : "Hélice", fmt(g.betaDeg) + "°" + main));
      if (g.rack) {
        c.push_back(lecture("Largeur", fmt(g.b) + " mm"));
        c.push_back(lecture("Pas", fmt(g.pt) + " mm"));
        c.push_back(lecture("Longueur", fmt(g.L) + " mm"));
        c.push_back(lecture("Hauteur totale", fmt(g.ya - g.yb) + " mm"));
      } else {
        if (g.betaDeg != 0) c.push_back(lecture("Module apparent", fmt(g.mt) + " mm"));
        c.push_back(lecture("Déport x", fmt(g.x)));
        c.push_back(lecture("Largeur", fmt(g.b) + " mm"));
        c.push_back(lecture("Ø primitif", fmt(2 * g.rp) + " mm"));
        c.push_back(lecture("Ø de tête", fmt(2 * g.ra) + " mm"));
        c.push_back(lecture("Ø de pied", fmt(2 * g.rf) + " mm"));
        c.push_back(lecture("Ø de base", fmt(2 * g.rb) + " mm"));
        if (g.internal) c.push_back(lecture("Ø extérieur", fmt(g.D) + " mm"));
      }
      for (const auto& [bon, txt] : controlesEngrenage(g)) c.push_back(lecture(bon ? "✓" : "⚠", txt));
      c.push_back(lecture("Modifier", "En assemblage, clic droit sur la pièce"));
    } catch (const std::exception& e) {
      c.push_back(lecture("⚠", e.what()));
    }
  } else if (t == "xthread") {
    champsFiletage(f, c);
  } else if (t == "hole") {
    champsPercage(d, f, c);
  } else if (t == "repeat") {
    champsRepetition(d, f, c);
  }
  return c;
}

namespace {
json planDeTexte(const std::string& v) {  // « px,py,pz,nx,ny,nz »
  double a[6] = {0, 0, 0, 0, 0, 0};
  std::sscanf(v.c_str(), "%lf,%lf,%lf,%lf,%lf,%lf", &a[0], &a[1], &a[2], &a[3], &a[4], &a[5]);
  return {{"p", {a[0], a[1], a[2]}}, {"n", {a[3], a[4], a[5]}}};
}
std::string appliquerPercage(json& f, const std::string& cle, const std::string& v) {
  if (cle == "x/kind") {
    const std::string av = str(f, "kind");
    if (v == "ream" && av != "ream") {
      f["thread"] = nullptr;
      if (!(num(f, "reamD") > 0)) f["reamD"] = std::max(1.0, std::round(ou0(num(f, "d"), 6)));
      if (!(num(f, "reamH") > 0)) f["reamH"] = std::max(1.0, std::min(ou0(num(f, "depth"), 15), num(f, "reamD") * 1.5));
      if (str(f, "reamTol").empty()) f["reamTol"] = "H7";
      if (!f.contains("reamOff")) f["reamOff"] = 0.5;
      if (str(f, "pilot").empty()) f["pilot"] = "none";
      if (num(f, "reamOff") > 0) f["d"] = percageAlesage(f);
    }
    if (v == "step" && av != "step") {
      const bool taraude = f.contains("thread") && f["thread"].is_object() && !str(f["thread"], "size").empty();
      if (num(f, "d") == 6.6 && !taraude) {
        f["d"] = 1.5;
        f["end"] = "through";
      }
      if (!(num(f, "stD") > num(f, "d"))) f["stD"] = num(f, "d") < 6 ? 8.0 : std::round(1.6 * num(f, "d"));
      if (!(num(f, "stH") > 0)) f["stH"] = 5;
      if (!f.contains("stTip")) f["stTip"] = 118;
    }
    f["kind"] = v;
  } else if (cle == "x/pilot") {
    f["pilot"] = v;
    const double D = std::max(0.2, ou0(num(f, "reamD"), 6)), H = std::max(0.1, ou0(num(f, "reamH"), D * 1.5));
    if (v == "blind" && !(num(f, "depth") > H)) f["depth"] = std::round((H + 2 * D) * 100) / 100;
    if ((v == "blind" || v == "through") && num(f, "reamOff") > 0) f["d"] = percageAlesage(f);
  } else if (cle == "x/tolL" || cle == "x/tolG") {
    std::string tol = str(f, "reamTol").empty() ? "H7" : str(f, "reamTol");
    size_t rang = 0;
    while (rang < tol.size() && !std::isdigit(static_cast<unsigned char>(tol[rang]))) rang++;
    const std::string L = cle == "x/tolL" ? v : tol.substr(0, rang), G = tol.substr(rang);
    if (cle == "x/tolG") {
      f["reamTol"] = L + v;
    } else {
      const json& Q = tablesPercage()["qualites"];
      std::vector<std::string> gs;
      if (Q.contains(L))
        for (const json& x : Q[L]) gs.push_back(x.get<std::string>());
      const auto a = [&](const std::string& g) { return std::find(gs.begin(), gs.end(), g) != gs.end(); };
      f["reamTol"] = L + (a(G) ? G : a("7") ? std::string("7") : gs.empty() ? G : gs[gs.size() / 2]);
    }
  } else if (cle == "x/ecart") {
    const double D = std::max(0.2, ou0(num(f, "reamD"), 6));
    const double dAv = percageAlesage(f);
    if (v == "other") {
      f["reamOffFree"] = true;
      f["reamOff"] = num(f, "reamOff") > 0 ? num(f, "reamOff") : std::round(std::max(0.05, D - dAv) * 1000) / 1000;
    } else {
      f.erase("reamOffFree");
      if (v == "libre") f["reamOff"] = nullptr;
      else f["reamOff"] = v == "1" ? 1.0 : 0.5;
    }
    if (num(f, "reamOff") > 0) f["d"] = percageAlesage(f);
    else f["d"] = dAv;
  } else if (cle == "x/tip" || cle == "x/stTip" || cle == "x/csA") {
    f[cle.substr(2)] = std::stoi(v);
  } else if (cle == "x/flip") {
    f["flip"] = v == "1";
  } else if (cle == "x/end") {
    f["end"] = v;
  } else if (cle == "x/thread") {
    if (v.empty()) {
      f["thread"] = nullptr;
    } else {
      const size_t b = v.find('|');
      const std::string size = v.substr(0, b);
      const double pz = std::stod(v.substr(b + 1));
      json th = f.contains("thread") && f["thread"].is_object() ? f["thread"] : json::object();
      th["size"] = size;
      th["p"] = pz;
      if (!filetModelable(size)) th["model"] = false;  // pas du gaz : filet cosmétique seulement
      const json* t = filetageDe(size);
      const double dn = t ? (*t)[1].get<double>() : 0;
      if (!(num(th, "len") > 0)) th["len"] = std::max(2 * dn, num(f, "depth") - 2 * pz);
      f["thread"] = th;
      f["d"] = percageTaraud(size, pz);
      if (str(f, "kind") == "csink") f["csD"] = std::round((dn * 1.1 + 0.4) * 100) / 100;
    }
  } else if (cle == "x/chc" || cle == "x/fhc") {
    if (v.empty()) return "";
    const json& T = tablesPercage();
    const char* const tabs[2] = {cle == "x/chc" ? "chc" : "fhc", cle == "x/chc" ? "achc" : "afhc"};
    for (const char* tab : tabs)
      for (const json& x : T[tab])
        if (x[0] == v) {
          f["thread"] = nullptr;
          f["d"] = x[1];
          if (cle == "x/chc") {
            f["cbD"] = x[2];
            f["cbH"] = x[3];
          } else {
            f["csD"] = fraisureVis(x);
            f["csA"] = x.size() > 3 ? x[3].get<double>() : 90.0;
          }
          return "";
        }
  } else if (cle == "x/lh") {
    if (v == "lh") f["thread"]["lh"] = true;
    else f["thread"].erase("lh");
  } else if (cle == "x/thlen") {
    f["thread"]["lenMode"] = v;
  } else if (cle == "x/uptoplan") {
    f["uptoPlane"] = planDeTexte(v);
    f["end"] = "upto";
  } else if (cle == "x/filet") {
    f["thread"]["model"] = v == "model";
    if (v == "model" && !f["thread"].contains("clear")) f["thread"]["clear"] = 0;
  } else if (cle == "x/uptofil") {
    f["thread"]["uptoPlane"] = planDeTexte(v);
    f["thread"]["lenMode"] = "upto";
  } else if (cle == "x/facefin" || cle == "x/facethr") {
    return "";  // le clic dans la vue est demandé par le cadre
  } else {
    return "Réglage inconnu.";
  }
  return "";
}
json tableauDe(const std::string& v) {  // « Face:x,y,z »
  double a[3] = {1, 0, 0};
  std::sscanf(v.c_str(), "Face:%lf,%lf,%lf", &a[0], &a[1], &a[2]);
  return {a[0], a[1], a[2]};
}
std::string appliquerRepetition(json& f, const std::string& cle, const std::string& v) {
  const bool mir = str(f, "mode") == "mir";
  const auto axeVec = [&](const char* axe, const char* dir) {  // repAxisVec, repAxis2Vec
    json r = json::array({1, 0, 0});
    if (f.contains(dir) && f[dir].is_array()) {
      const json& a = f[dir];
      const double x = a[0].get<double>(), y = a[1].get<double>(), z = a[2].get<double>(), l = std::sqrt(x * x + y * y + z * z);
      const double m = l > 0 ? l : 1;
      r = json::array({x / m, y / m, z / m});
    } else if (str(f, axe) == "Y") {
      r = json::array({0, 1, 0});
    } else if (str(f, axe) == "Z") {
      r = json::array({0, 0, 1});
    }
    return r;
  };
  if (cle == "x/mode") {
    f["mode"] = v;
  } else if (cle == "x/opr") {
    if (v == "new") f["op"] = "new";
    else f.erase("op");
  } else if (cle == "x/retablir") {
    f.erase("dropKeys");
  } else if (cle == "x/rep1" || cle == "x/rep2") {
    const bool deux = cle == "x/rep2";
    const bool face = v.rfind("Face:", 0) == 0;
    if (v == "Face" || v == "Face+") return "";  // le clic dans la vue est demandé par le cadre
    if (mir) {
      f[deux ? "plane2" : "plane"] = face ? std::string("Face") : v;
      if (face) f[deux ? "planeN2" : "planeN"] = tableauDe(v);
      else f.erase(deux ? "planeN2" : "planeN");
    } else {
      f[deux ? "axis2" : "axis"] = face ? std::string("Face") : v;
      if (face) f[deux ? "dir2" : "dir"] = tableauDe(v);
      else f.erase(deux ? "dir2" : "dir");
    }
  } else if (cle == "x/inv1" || cle == "x/inv2") {
    const bool deux = cle == "x/inv2";
    const json a = axeVec(deux ? "axis2" : "axis", deux ? "dir2" : "dir");
    f[deux ? "dir2" : "dir"] = json::array({-a[0].get<double>(), -a[1].get<double>(), -a[2].get<double>()});
    f[deux ? "axis2" : "axis"] = "Face";
  } else if (cle == "x/dbl") {
    if (v == "1") {
      if (str(f, "plane2").empty()) f["plane2"] = str(f, "plane") == "XZ" ? "YZ" : "XZ";
    } else {
      f.erase("plane2");
      f.erase("planeN2");
    }
  } else if (cle == "x/lin2") {
    if (v == "1") {
      f["lin2"] = true;
      if (str(f, "axis2").empty()) f["axis2"] = (str(f, "axis").empty() || str(f, "axis") == "X") ? "Y" : "X";
      if (!(num(f, "copies2") > 0)) f["copies2"] = 1;
      if (!f.contains("dist2") || f["dist2"].is_null()) f["dist2"] = num(f, "dist") != 0 ? num(f, "dist") : 10;
    } else {
      f.erase("lin2");
    }
  } else if (cle.rfind("x/src/", 0) == 0) {
    const std::string id = cle.substr(6);
    json b = json::array();
    if (f.contains("base") && f["base"].is_array())
      for (const json& x : f["base"])
        if (x != id) b.push_back(x);
    if (v == "1") b.push_back(id);
    f["base"] = b;
  } else {
    return "Réglage inconnu.";
  }
  return "";
}
}  // namespace

std::string ficheAppliquer(json& d, const std::string& id, const std::string& cle, const std::string& valeur) {
  json* pf = parId(liste(d, "features"), id);
  if (!pf) return "Fonction introuvable.";
  json& f = *pf;
  if (cle.rfind("z/", 0) == 0) {  // le plan tangent d'un perçage sur cylindre ou d'une rainure
    const json copie = f;
    return appliquerCylindre(d, copie, cle, valeur);
  }
  const bool nomEtaitAuto = str(f, "name").empty() || str(f, "name") == nomAuto(d, f);
  const std::string t = str(f, "type");
  const std::string sorte = cle.substr(0, 1), chemin = cle.size() > 2 ? cle.substr(2) : "";
  if (t == "xfillet" && cle == "x/retirer") {
    if (valeur.empty() || !f.contains("edges")) return "";
    const size_t i = std::stoul(valeur);
    if (i < f["edges"].size()) f["edges"].erase(i);
    if (nomEtaitAuto) f["name"] = nomAuto(d, f);
    return "";
  }
  if (t == "xfillet" && cle == "x/toutes") {
    std::string texte = valeur;
    std::replace(texte.begin(), texte.end(), ',', '.');
    double v = 0;
    try {
      v = std::stod(texte);
    } catch (const std::exception&) {
    }
    if (!(v > 0) || !std::isfinite(v)) return vrai(f, "chamfer") ? "Distance invalide." : "Rayon invalide.";
    for (json& e : f["edges"]) e["r"] = v;
    return "";
  }
  if (t == "xfillet" && cle == "s/cmode") {
    f["cmode"] = valeur;
    if (valeur == "d2" && !(num(f, "cd2") > 0)) f["cd2"] = f.contains("edges") && !f["edges"].empty() && num(f["edges"][0], "r") > 0 ? num(f["edges"][0], "r") : 1.0;
    if (valeur == "da" && !(num(f, "cang") > 0 && num(f, "cang") < 90)) f["cang"] = 45.0;
    if (valeur == "eq") f.erase("cflip");
    return "";
  }
  if (sorte == "n") {
    std::string texte = valeur;
    std::replace(texte.begin(), texte.end(), ',', '.');
    double v = 0;
    try {
      size_t lu = 0;
      v = std::stod(texte, &lu);
      if (lu != texte.size()) return "Nombre non reconnu : " + valeur + ".";
    } catch (const std::exception&) {
      return "Nombre non reconnu : " + valeur + ".";
    }
    if (!std::isfinite(v)) return "Nombre non reconnu : " + valeur + ".";
    if (t == "revolve" && chemin == "angle" && !(v > 0)) return "L'angle doit être positif.";
    if (t == "revolve" && chemin == "angle") v = std::min(360.0, v);
    if (t == "bscale" && (chemin == "s" || chemin == "sx" || chemin == "sy" || chemin == "sz") && !(v > 0)) return "Échelle : le facteur doit être strictement positif.";
    if (t == "xdraft" && chemin == "angle" && !(std::fabs(v) > 1e-9 && std::fabs(v) < 90)) return "Angle hors bornes : −90 < a < 90°, non nul (négatif = sens inversé).";
    if (t == "xshell" && chemin == "thick" && !(v > 0)) return "L'épaisseur doit être positive.";
    if (t == "xfillet" && chemin == "cang" && !(v > 0 && v < 90)) return "Angle du chanfrein : 0 < a < 90°.";
    if (t == "xfillet" && chemin == "cd2" && !(v > 0)) return "Distance 2 : valeur strictement positive.";
    if (t == "xfillet" && chemin.rfind("edges/", 0) == 0 && !(v > 0)) return vrai(f, "chamfer") ? "Distance invalide." : "Rayon invalide.";
    if (chemin == "thread/clear" || (t == "xthread" && chemin == "clear")) {
      if (!(v >= 0)) return "La valeur ne peut pas être négative.";
    } else if (t == "hole" && !(v > 0)) {
      return "La valeur doit être positive.";
    }
    if (t == "xthread" && chemin == "len" && !(v >= 0.1)) return "La longueur doit valoir au moins 0,1 mm.";
    if (t == "repeat" && (chemin == "qty" || chemin == "qty2")) {
      const double q = std::floor(v - 1);
      f[chemin == "qty" ? "copies" : "copies2"] = static_cast<int>(std::min(200.0, std::max(1.0, q)));
    } else if (t == "repeat" && chemin == "angle") {
      f["angle"] = v != 0 ? v : 360;
    } else {
      f[json::json_pointer("/" + chemin)] = v;
    }
    if (t == "hole" && chemin == "reamD" && num(f, "reamOff") > 0) f["d"] = percageAlesage(f);
    if (t == "hole" && chemin == "reamOff") f["d"] = percageAlesage(f);
  } else if (sorte == "b") {
    f[chemin] = valeur == "1";
  } else if (sorte == "s") {
    f[chemin] = valeur;
    if (chemin == "sketchId" || chemin == "pathId")
      if (json* s = parId(liste(d, "sketches"), valeur)) (*s)["visible"] = false;  // hide(v) du panneau
    if (t == "sweep" && chemin == "sketchId" && str(f, "pathId") == valeur) return "Le profil et le chemin doivent être deux esquisses différentes.";
  } else if (t == "xthread" && cle.rfind("x/", 0) == 0) {
    const std::string r = appliquerFiletage(f, cle, valeur);
    if (!r.empty()) return r;
  } else if (t == "hole" && cle.rfind("x/", 0) == 0 && !cle.empty()) {
    const std::string r = appliquerPercage(f, cle, valeur);
    if (!r.empty()) return r;
  } else if (t == "repeat" && cle.rfind("x/", 0) == 0) {
    const std::string r = appliquerRepetition(f, cle, valeur);
    if (!r.empty()) return r;
  } else if (cle == "x/cible") {
    f["body"] = valeur;
    if (f.contains("tools") && f["tools"].is_array()) {
      json g = json::array();
      for (const json& x : f["tools"])
        if (x != valeur) g.push_back(x);
      if (g.empty())
        for (const json& b : liste(d, "bodies"))
          if (str(b, "id") != valeur) {
            g.push_back(b["id"]);
            break;
          }
      f["tools"] = g;
    }
  } else if (cle == "x/outil") {
    f["tools"] = json::array({valeur});
  } else if (cle == "x/axe") {
    if (valeur.size() < 3) return "";
    f["axis"] = valeur[0] == 'L' ? json{{"k", "line"}, {"id", valeur.substr(2)}} : json{{"k", "sys"}, {"d", valeur.substr(2)}};
  } else if (cle == "x/resultat") {
    if (valeur == "new") {
      f["copy"] = true;
      if (str(f, "newBody").empty() || !parId(liste(d, "bodies"), str(f, "newBody"))) {
        const int n = d.contains("bodySeq") && d["bodySeq"].is_number() ? d["bodySeq"].get<int>() : 1;
        d["bodySeq"] = n + 1;
        const std::string nb = "b" + std::to_string(n);
        liste(d, "bodies").push_back({{"id", nb}, {"name", nomCorps(d, str(f, "body")) + " (2)"}, {"c", nullptr}});
        f["newBody"] = nb;
      }
    } else {
      f["copy"] = false;
      const std::string nb = str(f, "newBody");
      f.erase("newBody");
      // splitOnDelete : le corps neuf part s'il ne porte rien d'autre
      bool porte = nb.empty();
      for (const json& x : liste(d, "features"))
        if (str(x, "body") == nb || str(x, "newBody") == nb) porte = true;
      if (!porte) {
        json r = json::array();
        for (json& b : liste(d, "bodies"))
          if (str(b, "id") != nb) r.push_back(std::move(b));
        d["bodies"] = std::move(r);
      }
    }
  } else if (cle == "x/uni") {
    if (valeur == "n") {
      const double s = num(f, "s", 1);
      f["uni"] = false;
      f["sx"] = f["sy"] = f["sz"] = s;
    } else {
      f["uni"] = true;
      f["s"] = num(f, "sx", 1);
    }
  } else if (cle == "x/plan") {
    if (valeur == "face") return "";
    if (valeur.rfind("cg:", 0) == 0) {
      const std::string cg = valeur.substr(3);
      json pl = {{"src", "cg"}, {"cg", cg}};
      if (d.contains("cgeo"))
        if (const json* c = parId(d["cgeo"], cg); c && c->contains("fr") && (*c)["fr"].is_object()) {
          pl["o"] = (*c)["fr"].value("o", json());
          pl["n"] = (*c)["fr"].value("z", json());
        }
      f["pl"] = pl;
    } else {
      f["pl"] = {{"src", valeur}};
    }
  } else if (cle == "x/ajout") {
    if (!f.contains("steps") || !f["steps"].is_array()) f["steps"] = json::array();
    if (valeur == "t") {
      f["steps"].push_back({{"k", "t"}, {"v", {0, 0, 0}}});
    } else if (valeur.size() == 2 && valeur[0] == 'r') {
      const char ax = valeur[1];
      f["steps"].push_back({{"k", "r"}, {"o", {0, 0, 0}}, {"d", {ax == 'x' ? 1 : 0, ax == 'y' ? 1 : 0, ax == 'z' ? 1 : 0}}, {"deg", 90}, {"name", std::string(1, static_cast<char>(ax - 'a' + 'A'))}});
    }
  } else if (cle.rfind("x/etape/", 0) == 0) {
    const size_t i = static_cast<size_t>(std::stoul(cle.substr(8)));
    json& S = f["steps"];
    if (!S.is_array() || i >= S.size()) return "";
    if (valeur == "suppr") S.erase(S.begin() + static_cast<std::ptrdiff_t>(i));
    else if (valeur == "monter" && i > 0) std::swap(S[i - 1], S[i]);
  } else {
    return "Réglage inconnu.";
  }
  if (nomEtaitAuto) f["name"] = nomAuto(d, f);
  return "";
}

namespace {
std::string idLibre(json& F, const char* prefixe) {
  for (int k = 1;; k++) {
    const std::string id = std::string(prefixe) + "_nat" + std::to_string(k);
    if (!parId(F, id)) return id;
  }
}
std::string ajouter(json& d, json f, const char* prefixe, int marque) {
  json& F = liste(d, "features");
  const std::string id = idLibre(F, prefixe);
  f["id"] = id;
  if (!f.contains("body")) f["body"] = str(d, "activeBody");
  f["name"] = nomAuto(d, f);
  const size_t n = marque < 0 ? F.size() : std::min<size_t>(marque, F.size());
  F.insert(F.begin() + static_cast<std::ptrdiff_t>(n), std::move(f));
  return id;
}
void cacherEsquisse(json& d, const std::string& id) {
  if (json* s = parId(liste(d, "sketches"), id)) (*s)["visible"] = false;
}
std::string corpsVise(json& d, const std::string& voulu, const char* action) {
  const std::string id = !voulu.empty() ? voulu : str(d, "activeBody");
  if (!parId(liste(d, "bodies"), id)) throw std::runtime_error(std::string(action) + " : aucun corps.");
  bool plein = false;
  for (const json& f : liste(d, "features"))
    if (str(f, "body") == id && !(f.contains("visible") && f["visible"].is_boolean() && !f["visible"].get<bool>())) plein = true;
  if (!plein) throw std::runtime_error(std::string(action) + " : « " + nomCorps(d, id) + " » est vide.");
  return id;
}
}  // namespace

std::string ajouterFonction(json& d, json f, const char* prefixe, int marque) { return ajouter(d, std::move(f), prefixe, marque); }
std::string nomAutoFonction(const json& d, const json& f) { return nomAuto(d, f); }
std::string corpsNeufScission(json& d, const std::string& source) {
  const int n = d.contains("bodySeq") && d["bodySeq"].is_number() ? d["bodySeq"].get<int>() : 1;
  d["bodySeq"] = n + 1;
  const std::string nb = "b" + std::to_string(n);
  liste(d, "bodies").push_back({{"id", nb}, {"name", nomCorps(d, source) + " (2)"}, {"c", nullptr}});
  return nb;
}

std::string creerCombiner(json& d, int marque) {
  const json& B = liste(d, "bodies");
  if (B.size() < 2) throw std::runtime_error("Combiner : il faut au moins 2 corps (bouton Corps, ou extrusion dans un nouveau corps).");
  const std::string act = parId(B, str(d, "activeBody")) ? str(d, "activeBody") : str(B[0], "id");
  std::string outil;
  for (const json& b : B)
    if (str(b, "id") != act) {
      outil = str(b, "id");
      break;
    }
  return ajouter(d, {{"type", "combine"}, {"name", ""}, {"body", act}, {"tools", json::array({outil})}, {"mode", "union"}, {"keep", false}, {"visible", true}}, "cb", marque);
}

std::string creerRevolution(json& d, const std::string& esquisse, int marque) {
  json* s = parId(liste(d, "sketches"), esquisse);
  if (!s) throw std::runtime_error("Révolution : dessinez d'abord un profil fermé dans une esquisse.");
  // L'axe : la ligne marquée « axe » de l'esquisse, sinon sa première ligne de construction, sinon l'axe X
  json axe = {{"k", "sys"}, {"d", "X"}};
  if (s->contains("entities") && (*s)["entities"].is_array()) {
    bool trouve = false;
    for (const json& e : (*s)["entities"])
      if (str(e, "t") == "line" && vrai(e, "axis")) {
        axe = {{"k", "line"}, {"id", str(e, "id")}};
        trouve = true;
        break;
      }
    if (!trouve)
      for (const json& e : (*s)["entities"])
        if (str(e, "t") == "line" && vrai(e, "construction")) {
          axe = {{"k", "line"}, {"id", str(e, "id")}};
          break;
        }
  }
  const std::string id = ajouter(d, {{"type", "revolve"}, {"name", ""}, {"sketchId", esquisse}, {"axis", axe}, {"angle", 360}, {"op", "add"}, {"visible", true}}, "rv", marque);
  cacherEsquisse(d, esquisse);
  return id;
}

std::string creerBalayage(json& d, const std::string& profil, const std::string& chemin, int marque) {
  if (liste(d, "sketches").size() < 2 || profil.empty() || chemin.empty() || profil == chemin)
    throw std::runtime_error("Balayage : il faut deux esquisses — le PROFIL (fermé) et le CHEMIN (lignes, arcs et splines bout à bout), sur des plans différents.");
  const std::string id = ajouter(d, {{"type", "sweep"}, {"name", ""}, {"sketchId", profil}, {"pathId", chemin}, {"op", "add"}, {"visible", true}}, "sw", marque);
  cacherEsquisse(d, profil);
  cacherEsquisse(d, chemin);
  return id;
}

std::string creerFiletage(json& d, const json& cyl, const std::string& corps, int marque) {  // threadCreate
  double e = 0;
  const double D = 2 * num(cyl, "r");
  const json z = tailleProche(D, &e);
  const double p = z.is_null() ? 1.25 : z[2].get<double>();
  json f = {{"type", "xthread"}, {"name", ""}, {"cyl", cyl}, {"size", z.is_null() ? json("M8") : z[0]}, {"p", p}, {"lh", false}, {"model", false}, {"clear", 0},
            {"lenMode", "full"}, {"len", std::round(std::max(p * 3, D * 1.5) * 10) / 10}, {"flip", false}, {"visible", true}};
  if (!corps.empty()) f["body"] = corps;
  return ajouterFonction(d, f, "th", marque);
}

std::string creerPercage(json& d, const std::string& esquisse, bool inverse, int marque) {
  if (!nbCentres(d, esquisse)) throw std::runtime_error("Perçage : placez d'abord des centres de perçage dans une esquisse (outil ⊕ de la barre d'esquisse), puis sélectionnez-la.");
  const std::string id = ajouter(d, {{"type", "hole"}, {"name", ""}, {"sketchId", esquisse}, {"kind", "simple"}, {"d", 6.6}, {"thread", nullptr}, {"cbD", 11}, {"cbH", 6.4}, {"csD", 13}, {"csA", 90}, {"end", "blind"}, {"depth", 15}, {"tip", 118}, {"flip", inverse}, {"op", "cut"}, {"visible", true}}, "ho", marque);
  cacherEsquisse(d, esquisse);
  return id;
}

std::string creerRepetition(json& d, const std::string& source, int marque) {
  json base = json::array();
  if (!source.empty())
    if (const json* s = parId(liste(d, "features"), source); s && repetable(*s)) base.push_back(source);
  return ajouter(d, {{"type", "repeat"}, {"name", ""}, {"mode", "lin"}, {"copies", 2}, {"q", 1}, {"dist", 20}, {"angle", 360}, {"axis", "X"}, {"plane", "YZ"}, {"base", base}, {"children", json::array()}, {"visible", true}}, "rp", marque);
}

std::string creerDeplacement(json& d, const std::string& corps, int marque) {
  const std::string id = corpsVise(d, corps, "Déplacer");
  return ajouter(d, {{"type", "bmove"}, {"name", ""}, {"body", id}, {"steps", json::array()}, {"visible", true}}, "bm", marque);
}

std::string creerEchelle(json& d, const std::string& corps, int marque) {
  const std::string id = corpsVise(d, corps, "Échelle");
  return ajouter(d, {{"type", "bscale"}, {"name", ""}, {"body", id}, {"o", {0, 0, 0}}, {"oname", "Origine"}, {"s", 2}, {"uni", true}, {"sx", 1}, {"sy", 1}, {"sz", 1}, {"copy", false}, {"visible", true}}, "bs", marque);
}

std::string creerScission(json& d, const std::string& corps, int marque) {
  const std::string id = corpsVise(d, corps, "Scinder");
  const int n = d.contains("bodySeq") && d["bodySeq"].is_number() ? d["bodySeq"].get<int>() : 1;
  d["bodySeq"] = n + 1;
  const std::string nb = "b" + std::to_string(n);
  liste(d, "bodies").push_back({{"id", nb}, {"name", nomCorps(d, id) + " (2)"}, {"c", nullptr}});
  return ajouter(d, {{"type", "xsplit"}, {"name", ""}, {"mode", "body"}, {"body", id}, {"pl", {{"src", "XY"}}}, {"off", 0}, {"flip", false}, {"newBody", nb}, {"visible", true}}, "sp", marque);
}
