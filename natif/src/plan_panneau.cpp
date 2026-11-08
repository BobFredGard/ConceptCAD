// Le panneau de droite de la mise en plan (src/98-mep-90-proprietes.js).
#include "plan_panneau.h"

#include <wx/choice.h>
#include <wx/checkbox.h>
#include <wx/clrpicker.h>
#include <wx/datetime.h>
#include <wx/filedlg.h>
#include <wx/msgdlg.h>
#include <wx/stattext.h>
#include <wx/stdpaths.h>
#include <wx/textctrl.h>
#include <wx/textdlg.h>
#include <wx/wrapsizer.h>

#include <algorithm>
#include <cmath>
#include <fstream>
#include <iterator>
#include <memory>
#include <optional>
#include <regex>
#include <sstream>

#include "interface_esquisse.h"
#include "iso286.h"
#include "nombres_js.h"
#include "plan_vue.h"

using plan::J;

namespace {
const wxColour FOND(0x24, 0x26, 0x2b), CHAMP(0x1e, 0x1f, 0x22), TEXTE(0xd6, 0xd8, 0xdc), DISCRET(0x9a, 0x9e, 0xa6), ORANGE(0xff, 0x9f, 0x0a);
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
std::string ut(const wxString& s) { return s.utf8_string(); }
std::string chaine(const J& o, const char* k, const std::string& d = "") {
  if (!o.is_object() || !o.contains(k)) return d;
  const J& v = o[k];
  if (v.is_string()) return v.get<std::string>();
  if (v.is_number()) return js::texte(v.get<double>());
  return d;
}
double num(const J& o, const char* k, double d = 0) {
  if (!o.is_object() || !o.contains(k) || !o[k].is_number()) return d;
  return o[k].get<double>();
}
const J& sous(const J& o, const char* k) {
  static const J rien;
  return o.is_object() && o.contains(k) ? o[k] : rien;
}
bool vrai(const J& o, const char* k) {
  if (!o.is_object() || !o.contains(k)) return false;
  const J& v = o[k];
  if (v.is_boolean()) return v.get<bool>();
  if (v.is_null()) return false;
  if (v.is_number()) return v.get<double>() != 0;
  if (v.is_string()) return !v.get<std::string>().empty();
  return true;
}
double lireNombre(wxString s, double defaut) {
  s.Replace(",", ".");
  double v;
  return s.Trim().Trim(false).ToCDouble(&v) ? v : defaut;
}
wxString nb(double v) { return tx(js::texte(v)); }

const std::vector<std::string> FORMATS = {"A4H", "A4V", "A3H", "A3V", "A2H", "A2V", "A1H", "A1V", "A0H", "A0V", "Manuel"};
const std::vector<std::pair<double, const wchar_t*>> ECHELLES = {{1, L"1:1"}, {2, L"2:1"}, {5, L"5:1"}, {0.5, L"1:2"}, {0.2, L"1:5"}, {2.5, L"5:2"}, {0.25, L"1:4"}, {0.1, L"1:10"}, {1.25, L"5:4"}, {0.4, L"2:5"}, {0.75, L"3:4"}};
const std::vector<std::string> CLES_CADRE = {"l", "r", "t", "b", "lw", "inner", "centre", "zones", "trim", "col", "mcol", "zw", "zh", "zx0", "zy0"};
J cadreStd(double l, double r, double t, double b, double lw, bool inner, bool marques, const char* col, const char* mcol) {
  J f = J::object();
  f["l"] = l, f["r"] = r, f["t"] = t, f["b"] = b, f["lw"] = lw, f["inner"] = inner, f["centre"] = marques, f["zones"] = marques, f["trim"] = marques, f["col"] = col, f["mcol"] = mcol;
  return f;
}
const J& cadreDefaut() {
  static const J f = cadreStd(12, 12, 12, 12, 0.9, true, false, "", "");
  return f;
}
const J& cadreJustet() {
  static const J f = cadreStd(20, 10, 10, 10, 1, false, true, "#6b6ba1", "#3e2b2c");
  return f;
}
const J& cadreIso() {
  static const J f = cadreStd(20, 10, 10, 10, 0.7, false, true, "", "");
  return f;
}
J cadreDeLaPlanche(const J& sh) {  // mepFrameOf
  J f = cadreDefaut();
  if (sh.contains("frame") && sh["frame"].is_object())
    for (auto it = sh["frame"].begin(); it != sh["frame"].end(); ++it) f[it.key()] = it.value();
  for (const char* k : {"col", "mcol"}) {
    static const std::regex hexa("^#[0-9a-fA-F]{6}$");
    if (!std::regex_match(chaine(f, k), hexa)) f[k] = "";
  }
  for (const char* k : {"l", "r", "t", "b"}) f[k] = std::min(40.0, std::max(0.0, num(f, k)));
  f["lw"] = std::min(2.0, std::max(0.1, num(f, "lw") != 0 ? num(f, "lw") : 0.9));
  return f;
}
bool memeCadre(const J& f, const J& p) {
  for (const std::string& k : CLES_CADRE) {
    const bool a = f.contains(k), b = p.contains(k);
    if (a != b) return false;
    if (!a) continue;
    if (f[k].is_number() && p[k].is_number()) {
      if (f[k].get<double>() != p[k].get<double>()) return false;
    } else if (f[k] != p[k]) {
      return false;
    }
  }
  return true;
}

// Les réglages : mep.prefs.ls, des chaînes (localStorage dans le navigateur)
J& reglages(J& mep) {
  if (!mep.contains("prefs") || !mep["prefs"].is_object()) {
    mep["prefs"] = J::object();
    mep["prefs"]["v"] = 1;
  }
  if (!mep["prefs"].contains("ls") || !mep["prefs"]["ls"].is_object()) mep["prefs"]["ls"] = J::object();
  return mep["prefs"]["ls"];
}
std::string lu(const J& mep, const char* k, const std::string& d = "") {
  if (!mep.contains("prefs") || !mep["prefs"].is_object() || !mep["prefs"].contains("ls")) return d;
  return chaine(mep["prefs"]["ls"], k, d);
}
J luJson(const J& mep, const char* k) {
  const std::string s = lu(mep, k);
  if (s.empty()) return J();
  try {
    return J::parse(s);
  } catch (const std::exception&) {
    return J();
  }
}
struct Trait {
  const char* cle;
  const wchar_t* lab;
  double thick, thin, hid, dim;
};
const std::vector<Trait> TRAITS = {{"ecran", L"Écran (fin)", .72, .42, .42, .55}, {"iso7", L"ISO 128 — 0,7 / 0,35", .7, .35, .35, .35}, {"iso5", L"ISO 128 — 0,5 / 0,25", .5, .25, .25, .25}};
J traitsLus(const J& mep) {  // mepLwGet
  J o = luJson(mep, "mep_lw");
  if (o.is_object() && o.contains("thick") && o["thick"].is_number()) return o;
  o = J::object();
  o["preset"] = "ecran", o["thick"] = .72, o["thin"] = .42, o["hid"] = .42, o["dim"] = .55;
  return o;
}
// MEP_DIM_STYLE, MEP_TEXT_STYLE tels que mémorisés (mepDimStyleLoad)
J styleLu(const J& mep) {
  J o = J::object();
  o["dimH"] = 3.5, o["lblH"] = 5, o["noteH"] = 3.5, o["color"] = "theme", o["arrowAngle"] = 36, o["arrowLen"] = 7, o["prec"] = 2;
  const J s = luJson(mep, "minifusion_mepDimStyle");
  if (s.is_object())
    for (auto it = s.begin(); it != s.end(); ++it)
      if (!it.value().is_null()) o[it.key()] = it.value();
  return o;
}
std::string dateDuJour() { return ut(wxDateTime::Now().Format("%d/%m/%Y")); }
std::string revisionIndice(const std::string& fmt, int k) {  // mepRevIdx
  if (fmt == "0" || fmt == "1") return std::to_string(k + (fmt == "1" ? 1 : 0));
  if (fmt == "O") return k ? revisionIndice("A", k - 1) : "O";
  std::string s;
  int n = k + 1;
  while (n > 0) {
    n--;
    s.insert(s.begin(), static_cast<char>('A' + n % 26));
    n /= 26;
  }
  return s;
}
std::string revisionSuivante(const std::string& fmt, const J& revs) {  // mepRevNext
  std::string last = revs.empty() ? "" : ut(tx(chaine(revs.back(), "i")).Trim().Trim(false));
  const bool chiffres = !last.empty() && std::all_of(last.begin(), last.end(), [](char c) { return c >= '0' && c <= '9'; });
  const bool lettres = !last.empty() && std::all_of(last.begin(), last.end(), [](char c) { return c >= 'A' && c <= 'Z'; });
  if (fmt == "0" || fmt == "1") {
    if (chiffres) return std::to_string(std::stoi(last) + 1);
  } else if (fmt == "O" && last == "O") {
    return "A";
  } else if (lettres) {
    int n = 0;
    for (char c : last) n = n * 26 + (c - 'A' + 1);
    return revisionIndice("A", n);
  }
  return revisionIndice(fmt, static_cast<int>(revs.size()));
}
wxString hauteurIso(double x) {
  wxString s = tx(js::fixe(x, 2));
  while (s.Contains(".") && s.EndsWith("0")) s.RemoveLast();
  if (s.EndsWith(".")) s.RemoveLast();
  s.Replace(".", ",");
  return s;
}
bool estIso(double h) {
  for (double x : {1.8, 2.5, 3.5, 5.0, 7.0, 10.0, 14.0, 20.0})
    if (std::abs(x - h) < 0.06) return true;
  return false;
}
// mepIsoSelect : la valeur courante et les options
std::pair<std::vector<std::pair<std::string, wxString>>, std::string> listeIso(double h) {
  std::vector<double> vals = {1.8, 2.5, 3.5, 5, 7, 10, 14, 20};
  if (!estIso(h)) vals.push_back(js::arrondi(h, 2));
  std::sort(vals.begin(), vals.end());
  std::vector<std::pair<std::string, wxString>> o;
  std::string cur = js::texte(vals[0]);
  for (double x : vals) {
    o.push_back({js::texte(x), hauteurIso(x) + (estIso(x) ? (x < 2.5 ? wxString(L"  (A4 seulement)") : wxString()) : wxString(L"  (hors série)"))});
    if (std::abs(x - h) < 0.06) cur = js::texte(x);
  }
  return {o, cur};
}
// src/05-iso286.js
const std::vector<std::string>& lettresAlesage() {
  static const std::vector<std::string> L = {"A", "B", "C", "CD", "D", "E", "EF", "F", "FG", "G", "H", "JS", "J", "K", "M", "N", "P", "R", "S", "T", "U", "V", "X", "Y", "Z", "ZA", "ZB", "ZC"};
  return L;
}
std::string minuscules(std::string s) {
  std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return s;
}
std::string majuscules(std::string s) {
  std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
  return s;
}
struct ClasseIso {
  std::string L, g;
  bool hole = false;
};
std::optional<ClasseIso> lireClasse(const std::string& cls) {  // iso286Parse
  static const std::regex re("^([A-Za-z]{1,2})(01|0|[1-9]|1[0-8])$");
  std::smatch m;
  std::string s = ut(tx(cls).Trim().Trim(false));
  if (!std::regex_match(s, m, re)) return std::nullopt;
  const std::string L = m[1], up = majuscules(L);
  if (L != up && L != minuscules(L)) return std::nullopt;
  if (std::find(lettresAlesage().begin(), lettresAlesage().end(), up) == lettresAlesage().end()) return std::nullopt;
  return ClasseIso{L, m[2], L == up};
}
std::vector<std::string> qualites(const std::string& L) {  // iso286Grades
  static const std::map<std::string, std::pair<int, int>> G = {
      {"A", {9, 13}}, {"B", {8, 13}}, {"C", {8, 13}}, {"CD", {6, 10}}, {"D", {6, 13}}, {"E", {5, 10}}, {"EF", {3, 10}}, {"F", {3, 10}}, {"FG", {3, 10}}, {"G", {3, 10}},
      {"J", {6, 8}}, {"K", {3, 10}}, {"M", {3, 10}}, {"N", {3, 11}}, {"P", {3, 10}}, {"R", {3, 10}}, {"S", {3, 10}}, {"T", {5, 8}}, {"U", {5, 10}}, {"V", {5, 8}},
      {"X", {5, 10}}, {"Y", {6, 10}}, {"Z", {6, 11}}, {"ZA", {6, 11}}, {"ZB", {7, 11}}, {"ZC", {7, 11}},
      {"a", {9, 13}}, {"b", {8, 13}}, {"c", {8, 13}}, {"cd", {5, 10}}, {"d", {5, 13}}, {"e", {5, 10}}, {"ef", {3, 10}}, {"f", {3, 10}}, {"fg", {3, 10}}, {"g", {3, 10}},
      {"j", {5, 7}}, {"k", {3, 13}}, {"m", {3, 9}}, {"n", {3, 9}}, {"p", {3, 10}}, {"r", {3, 10}}, {"s", {3, 10}}, {"t", {5, 8}}, {"u", {5, 9}}, {"v", {5, 8}},
      {"x", {5, 10}}, {"y", {6, 10}}, {"z", {6, 11}}, {"za", {6, 11}}, {"zb", {7, 11}}, {"zc", {7, 11}}};
  std::vector<std::string> o;
  if (L == "H" || L == "JS" || L == "h" || L == "js") {
    o = {"01", "0"};
    for (int i = 1; i <= 18; i++) o.push_back(std::to_string(i));
    return o;
  }
  const auto it = G.find(L);
  if (it != G.end())
    for (int i = it->second.first; i <= it->second.second; i++) o.push_back(std::to_string(i));
  return o;
}
std::string normerClasse(const std::string& cls) {  // mepTolClsNorm
  std::string s;
  for (char c : cls)
    if (!std::isspace(static_cast<unsigned char>(c))) s += c;
  const size_t i = s.find('/');
  if (i == std::string::npos) return lireClasse(s) ? s : "";
  if (s.find('/', i + 1) != std::string::npos) return "";
  const auto a = lireClasse(s.substr(0, i)), b = lireClasse(s.substr(i + 1));
  return a && b && a->hole && !b->hole ? s : "";
}
const std::vector<std::string> AJUSTEMENTS = {"H7/g6", "H7/h6", "H7/js6", "H7/k6", "H7/m6", "H7/n6", "H7/p6", "H7/r6", "H7/s6", "H8/f7", "H8/h7", "H8/e8", "H9/d9", "H9/h9", "H11/c11", "H11/h11", "G7/h6", "F8/h7", "K7/h6", "N7/h6", "P7/h6"};
wxString dossierReglages() {
  wxString d = wxStandardPaths::Get().GetUserDataDir();
  if (!wxDirExists(d)) wxMkdir(d);
  return d;
}
// ---- La bibliothèque de cartouches (mepTbLib, mepTbPack, mepTbUnpack, mepTbApply) ----
wxString fichierBibliotheque() { return dossierReglages() + SEPW L"cartouches.json"; }
J bibliotheque() {
  J b;
  std::ifstream e(fichierBibliotheque().ToStdWstring());
  if (e) {
    try {
      b = J::parse(e);
    } catch (const std::exception&) {
    }
  }
  if (!b.is_object()) b = J::object();
  if (!b.contains("tbs") || !b["tbs"].is_object()) b["tbs"] = J::object();
  return b;
}
void ecrireBibliotheque(const J& b) { std::ofstream(fichierBibliotheque().ToStdWstring()) << b.dump(1); }
const char* const CLES_VALEURS[] = {"projet", "client", "societe", "quantite", "nplan", "auteur", "verif", "matiere", "traitement", "tth", "tolgen", "etat", "masse", "revFmt"};
bool modeleValide(const J& o) {
  if (!o.is_object()) return false;
  const std::string k = chaine(o, "kind");
  return (k == "sk" && vrai(o, "sk") && vrai(o["sk"], "pts")) || k == "std";
}
J paquetCartouche(const J& sh, const std::string& nom) {  // mepTbPack
  const J& tt = sous(sh, "title");
  J o;
  if (plan::cartoucheDessine(sh)) {
    o = tt["tb"];
  } else {
    o = J{{"kind", "std"}};
    if (vrai(tt, "revSt")) o["revSt"] = tt["revSt"];
  }
  o["name"] = !nom.empty() ? nom : !chaine(o, "name").empty() ? chaine(o, "name") : chaine(o, "kind") == "std" ? std::string("Standard") : std::string("Cartouche");
  if (vrai(tt, "logo")) o["logo"] = tt["logo"];
  else o.erase("logo");
  J v = J::object();
  for (const char* k : CLES_VALEURS)
    if (tt.is_object() && tt.contains(k) && !tt[k].is_null() && tt[k] != "") v[k] = tt[k];
  o["vals"] = v;
  if (vrai(tt, "cust") && tt["cust"].is_object() && !tt["cust"].empty()) o["cust"] = tt["cust"];
  else o.erase("cust");
  return o;
}
void appliquerModele(J& sh, const J& o) {  // mepTbApply, mepTbUnpack
  if (!modeleValide(o)) return;
  if (!sh.contains("title") || !sh["title"].is_object()) sh["title"] = J::object();
  J& tt = sh["title"];
  J tb = o;
  tb.erase("logo"), tb.erase("vals"), tb.erase("cust");
  if (chaine(o, "kind") == "std") {
    tt["tb"] = nullptr;
    if (vrai(tb, "revSt")) tt["revSt"] = tb["revSt"];
  } else {
    tt["tb"] = tb;
  }
  if (vrai(o, "logo")) tt["logo"] = o["logo"];
  if (o.contains("vals") && o["vals"].is_object())
    for (const char* k : CLES_VALEURS)
      if (o["vals"].contains(k) && !o["vals"][k].is_null()) tt[k] = o["vals"][k];
  if (o.contains("cust") && o["cust"].is_object()) {
    if (!tt.contains("cust") || !tt["cust"].is_object()) tt["cust"] = J::object();
    for (auto it = o["cust"].begin(); it != o["cust"].end(); ++it) tt["cust"][it.key()] = it.value();
  }
  if (chaine(o, "kind") == "std") tt["tbName"] = chaine(o, "name");
  else tt.erase("tbName");
  const std::string fmt = chaine(sous(o, "page"), "format");
  if (fmt == "A0" || fmt == "A1" || fmt == "A2" || fmt == "A3" || fmt == "A4") {
    sh["format"] = fmt;
    sh["orient"] = chaine(o["page"], "orient") == "portrait" ? "portrait" : "landscape";
  }
  if (o.contains("frame") && o["frame"].is_object()) sh["frame"] = o["frame"];
  // Un modèle qui dessine son tableau des révisions : la première révision est créée d'office
  if (plan::cartoucheDessine(sh) && !(tt.contains("revs") && tt["revs"].is_array() && !tt["revs"].empty())) {
    bool aRev = false;
    for (const J& e : tt["tb"]["sk"]["ents"])
      if (chaine(e, "f") == "rev") aRev = true;
    if (aRev) {
      const std::string au = chaine(tt, "auteur");
      tt["revs"] = J::array({J{{"i", revisionIndice(chaine(tt, "revFmt", "A"), 0)}, {"d", chaine(tt, "date")}, {"n", au != "—" ? au : ""}, {"t", ""}}});
    }
  }
}
}  // namespace

void plan::lireStyleEsquisse(const J& mep, EtatEsquisse& et) {
  const J o = luJson(mep, "mep_sk_style");
  if (o.is_object()) et.style = o;
}
void plan::appliquerCartoucheDefaut(const J& mep, J& sh) {
  const J b = bibliotheque();
  std::string d = lu(mep, "mep_tb_def");
  if (d.empty()) d = chaine(b, "def");
  if (!d.empty() && b["tbs"].contains(d)) appliquerModele(sh, b["tbs"][d]);
}

void PanneauPlan::modelesCartouche() {
  J& sh = vue_->planche();
  const J& tt = sh["title"];
  const J lib = bibliotheque()["tbs"];
  Options o = {{"std", L"Standard"}};
  for (auto it = lib.begin(); it != lib.end(); ++it) o.push_back({"l:" + it.key(), wxString(L"★ ") + tx(it.key())});
  std::string cur = "std";
  if (plan::cartoucheDessine(sh)) {
    const std::string n = chaine(tt["tb"], "name");
    cur = !n.empty() && lib.contains(n) ? "l:" + n : "cur";
    if (cur == "cur") o.push_back({"cur", (n.empty() ? wxString(L"Personnalisé") : tx(n)) + L" (cette planche)"});
  } else {
    const std::string n = chaine(tt, "tbName");
    if (!n.empty() && lib.contains(n) && chaine(lib[n], "kind") == "std") cur = "l:" + n;
  }
  choix(L"Modèle", o, cur, [this](const std::string& v) {
    if (v == "cur") return;
    editer(L"modèle de cartouche", [this, v] {
      J& s = vue_->planche();
      if (v == "std") {
        s["title"]["tb"] = nullptr;
        s["title"].erase("tbName");
      } else {
        const J q = bibliotheque()["tbs"];
        if (q.contains(v.substr(2))) appliquerModele(s, q[v.substr(2)]);
      }
      vue_->redessinerPlan();
    });
  });
  auto* r = rang();
  bouton(r, L"Charger un cartouche…", [this] {
    wxFileDialog dlg(this, L"Charger un cartouche", wxEmptyString, wxEmptyString, L"Cartouches (*.mfcartouche;*.json)|*.mfcartouche;*.json", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
    if (dlg.ShowModal() != wxID_OK) return;
    J f;
    std::ifstream e(dlg.GetPath().ToStdWstring());
    try {
      f = J::parse(e);
    } catch (const std::exception&) {
      return vue_->etat(L"Fichier de cartouches illisible.");
    }
    J tbs;
    if (chaine(f, "format") == "miniFusion-cartouches" && vrai(f, "tbs")) tbs = f["tbs"];
    else if (modeleValide(f)) tbs = J{{!chaine(f, "name").empty() ? chaine(f, "name") : ut(dlg.GetFilename().BeforeLast('.')), f}};
    else return vue_->etat(L"Ce fichier ne contient pas de cartouche ConceptCAD.");
    J b = bibliotheque();
    std::vector<std::string> pris;
    for (auto it = tbs.begin(); it != tbs.end(); ++it) {
      if (!modeleValide(it.value())) continue;
      J m = it.value();
      m["name"] = it.key();
      b["tbs"][it.key()] = m;
      pris.push_back(it.key());
    }
    ecrireBibliotheque(b);
    if (pris.size() == 1) {
      const J m = b["tbs"][pris[0]];
      editer(L"cartouche extérieur", [this, m] {
        appliquerModele(vue_->planche(), m);
        vue_->redessinerPlan();
      });
      vue_->etat(wxString(L"Cartouche « ") + tx(pris[0]) + L" » chargé et appliqué à la planche (ajouté à la bibliothèque).");
    } else {
      vue_->etat(wxString::Format(L"%zu cartouche(s) chargé(s) dans la bibliothèque.", pris.size()));
      CallAfter([this] { refaire(); });
    }
  }, L"Charger un cartouche extérieur (fichier .mfcartouche, ex. un dossier partagé) : ajouté à la bibliothèque et appliqué à cette planche — un modèle du même nom est remplacé");
  bouton(r, L"Exporter…", [this] {
    J tbs = bibliotheque()["tbs"];
    const J& s = vue_->planche();
    std::string n = plan::cartoucheDessine(s) ? chaine(s["title"]["tb"], "name") : std::string();
    if (n.empty()) n = "Cartouche de la planche";
    tbs[n] = paquetCartouche(s, n);
    std::string fic = tbs.size() == 1 ? n : "cartouches";
    for (char& c : fic)
      if (std::strchr("\\/:*?\"<>|", c)) c = '-';
    wxFileDialog dlg(this, L"Exporter les cartouches", wxEmptyString, tx(fic) + L".mfcartouche", L"Cartouches (*.mfcartouche)|*.mfcartouche", wxFD_SAVE | wxFD_OVERWRITE_PROMPT);
    if (dlg.ShowModal() != wxID_OK) return;
    std::ofstream(dlg.GetPath().ToStdWstring()) << J{{"format", "miniFusion-cartouches"}, {"v", 1}, {"tbs", tbs}}.dump(1);
    vue_->etat(wxString::Format(L"%zu cartouche(s) exporté(s) : ", tbs.size()) + dlg.GetFilename());
  }, L"Enregistrer les modèles de cartouche (bibliothèque + celui de cette planche) dans un fichier .mfcartouche");
  const std::vector<std::string> partis = plan::pointsHorsFeuille(sh);
  if (!partis.empty()) {
    const wxColour orange(0xff, 0x9f, 0x0a);
    note(wxString::Format(L"⚠ %zu point(s) du cartouche sont hors de la feuille (solveur parti au loin) : ils sont ignorés pour la hauteur du cartouche.", partis.size()), &orange);
    r = rang();
    bouton(r, L"Supprimer les éléments hors feuille", [this] {
      editer(L"cartouche : éléments hors feuille", [this] {
        plan::retirerHorsFeuille(vue_->planche());
        vue_->redessinerPlan();
      });
    }, L"Supprime ces points, leurs lignes et leurs contraintes (annulable)");
  }
}

PanneauPlan::PanneauPlan(wxWindow* parent, PlanVue* vue) : wxScrolledWindow(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxVSCROLL | wxBORDER_NONE), vue_(vue) {
  SetScrollRate(0, FromDIP(14));
  SetBackgroundColour(FOND);
  SetForegroundColour(TEXTE);
  racine_ = new wxBoxSizer(wxVERTICAL);
  SetSizer(racine_);
}

// ---- Les briques ----
void PanneauPlan::section(const wxString& titre) {
  auto* s = new wxBoxSizer(wxVERTICAL);
  sections_.push_back({titre, s});
  racine_->Add(s, 0, wxEXPAND);
  cible_ = s;
  auto* t = new wxStaticText(this, wxID_ANY, titre);
  wxFont f = t->GetFont();
  f.SetWeight(wxFONTWEIGHT_SEMIBOLD);
  t->SetFont(f);
  t->SetForegroundColour(*wxWHITE);
  s->Add(t, 0, wxLEFT | wxRIGHT | wxTOP | wxBOTTOM, FromDIP(4));
}
wxBoxSizer* PanneauPlan::rang() {
  auto* r = new wxBoxSizer(wxHORIZONTAL);
  (cible_ ? cible_ : racine_)->Add(r, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(3));
  return r;
}
wxWindow* PanneauPlan::libelle(wxBoxSizer* r, const wxString& t) {
  auto* l = new wxStaticText(this, wxID_ANY, t);
  l->SetForegroundColour(TEXTE);
  l->Wrap(FromDIP(116));
  l->SetMinSize(wxSize(FromDIP(116), -1));
  r->Add(l, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(4));
  return l;
}
void PanneauPlan::note(const wxString& t, const wxColour* c) {
  auto* l = new wxStaticText(this, wxID_ANY, t);
  l->SetForegroundColour(c ? *c : DISCRET);
  l->Wrap(FromDIP(250));
  (cible_ ? cible_ : racine_)->Add(l, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(4));
}
void PanneauPlan::texte(const wxString& lab, const wxString& valeur, const std::function<void(const wxString&)>& f, const wxString& indice) {
  auto* r = rang();
  libelle(r, lab);
  auto* c = new wxTextCtrl(this, wxID_ANY, valeur, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_ENTER | wxBORDER_SIMPLE);
  c->SetBackgroundColour(CHAMP);
  c->SetForegroundColour(*wxWHITE);
  if (!indice.empty()) c->SetToolTip(indice);
  c->SetMinSize(wxSize(FromDIP(60), -1));
  auto initial = std::make_shared<wxString>(valeur);
  const auto valider = [c, initial, f] {
    if (c->GetValue() == *initial) return;
    *initial = c->GetValue();
    f(*initial);
  };
  c->Bind(wxEVT_TEXT_ENTER, [valider](wxCommandEvent&) { valider(); });
  c->Bind(wxEVT_KILL_FOCUS, [valider](wxFocusEvent& e) {
    e.Skip();
    valider();
  });
  r->Add(c, 1, wxEXPAND);
  champs_[lab] = f;
}
void PanneauPlan::nombre(const wxString& lab, double valeur, const std::function<void(double)>& f, const wxString& indice, bool videPossible) {
  texte(lab, std::isnan(valeur) ? wxString() : nb(valeur), [f, videPossible](const wxString& s) {
    if (s.empty() && videPossible) return f(NAN);
    f(lireNombre(s, NAN));
  }, indice);
}
void PanneauPlan::choix(const wxString& lab, const Options& o, const std::string& cur, const std::function<void(const std::string&)>& f) {
  auto* r = rang();
  libelle(r, lab);
  auto* c = new wxChoice(this, wxID_ANY);
  c->SetMinSize(wxSize(FromDIP(60), -1));
  int rangCourant = -1;
  for (size_t i = 0; i < o.size(); i++) {
    c->Append(o[i].second);
    if (o[i].first == cur) rangCourant = static_cast<int>(i);
  }
  if (rangCourant >= 0) c->SetSelection(rangCourant);
  c->Bind(wxEVT_CHOICE, [o, c, f](wxCommandEvent&) {
    const int i = c->GetSelection();
    if (i >= 0) f(o[i].first);
  });
  r->Add(c, 1, wxEXPAND);
  champs_[lab] = [f](const wxString& s) { f(ut(s)); };
}
void PanneauPlan::coche(const wxString& lab, bool v, const std::function<void(bool)>& f, const wxString& indice) {
  auto* r = rang();
  libelle(r, lab);
  auto* c = new wxCheckBox(this, wxID_ANY, wxEmptyString);
  c->SetValue(v);
  if (!indice.empty()) c->SetToolTip(indice);
  c->Bind(wxEVT_CHECKBOX, [c, f](wxCommandEvent&) { f(c->GetValue()); });
  r->Add(c, 0, wxALIGN_CENTER_VERTICAL);
  champs_[lab] = [f](const wxString& s) { f(s == "1" || s == "true"); };
}
void PanneauPlan::couleur(const wxString& lab, const std::string& v, const std::string& defaut, const std::function<void(const std::string&)>& f) {
  auto* r = rang();
  libelle(r, lab);
  wxColour c0(tx(v.empty() ? defaut : v));
  auto* c = new wxColourPickerCtrl(this, wxID_ANY, c0, wxDefaultPosition, FromDIP(wxSize(46, 24)));
  c->Enable(!v.empty());
  c->Bind(wxEVT_COLOURPICKER_CHANGED, [c, f](wxColourPickerEvent&) { f(minuscules(ut(c->GetColour().GetAsString(wxC2S_HTML_SYNTAX)))); });
  r->Add(c, 0, wxRIGHT, FromDIP(6));
  auto* e = new wxCheckBox(this, wxID_ANY, L"encre");
  e->SetForegroundColour(TEXTE);
  e->SetValue(v.empty());
  e->SetToolTip(L"Encre de la planche");
  e->Bind(wxEVT_CHECKBOX, [e, c, f](wxCommandEvent&) { f(e->GetValue() ? "" : minuscules(ut(c->GetColour().GetAsString(wxC2S_HTML_SYNTAX)))); });
  r->Add(e, 0, wxALIGN_CENTER_VERTICAL);
  champs_[lab] = [f](const wxString& s) { f(ut(s)); };
}
void PanneauPlan::bouton(wxBoxSizer* r, const wxString& lab, const std::function<void()>& f, const wxString& indice, bool actif, bool grise) {
  auto* b = new BoutonEsquisse(this, wxID_ANY, lab, indice, BoutonEsquisse::ENCADRE);
  b->fond(FOND);
  b->titre(lab);
  b->actif(actif);
  b->SetMinSize(FromDIP(wxSize(-1, 24)));
  b->disponible(!grise);
  b->surClic = [this, f] { CallAfter(f); };
  r->Add(b, 1, wxRIGHT, FromDIP(3));
  if (!grise) boutons_[lab] = f;
}
void PanneauPlan::boutonPasEncore(wxBoxSizer* r, const wxString& lab) {
  bouton(r, lab, [this, lab] {
    if (surIndisponible) surIndisponible(lab);
  }, lab + L" : pas encore repris dans ce programme.");
}
// mepEdit : le plan change, l'annulation suit, le panneau est refait
void PanneauPlan::editer(const wxString& lab, const std::function<void()>& f) {
  vue_->editer(lab, f);
  CallAfter([this] { refaire(); });
}
void PanneauPlan::reglage(const std::function<void()>& f) {
  vue_->editer(L"réglage", f);
  CallAfter([this] { refaire(); });
}
void PanneauPlan::finir(const std::string& cle) {
  // mepSideTabs : à partir de 3 sections, une section = un onglet
  if (sections_.size() < 3) {
    FitInside();
    Layout();
    return;
  }
  auto* barre = new wxWrapSizer(wxHORIZONTAL, 0);
  racine_->Insert(0, barre, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(3));
  wxString choisi = ongletChoisi_[cle];
  if (std::none_of(sections_.begin(), sections_.end(), [&](const Sect& s) { return s.titre == choisi; })) choisi = sections_[0].titre;
  for (const Sect& s : sections_) {
    auto* b = new BoutonEsquisse(this, wxID_ANY, s.titre, s.titre, BoutonEsquisse::ENCADRE);
    b->fond(FOND);
    b->titre(s.titre);
    b->actif(s.titre == choisi);
    const wxString t = s.titre;
    b->surClic = [this, cle, t] {
      ongletChoisi_[cle] = t;
      CallAfter([this] { refaire(); });
    };
    wxClientDC dc(this);
    b->SetMinSize(wxSize(dc.GetTextExtent(s.titre).x + FromDIP(14), FromDIP(22)));
    barre->Add(b, 0, wxRIGHT | wxBOTTOM, FromDIP(2));
    racine_->Show(s.s, s.titre == choisi, true);
  }
  Layout();
  FitInside();
}

void PanneauPlan::refaire() {
  if (!vue_->planPret()) return;
  const int y = GetScrollPos(wxVERTICAL);
  Freeze();
  racine_->Clear(true);
  sections_.clear();
  champs_.clear();
  boutons_.clear();
  cible_ = nullptr;
  const plan::SelectionPlan& s = vue_->selection();
  const std::string outil = vue_->outilCourant();
  if (!s.lotVues.empty() || !s.lotCotes.empty()) lot();
  else if (!s.skSel.empty()) esquisse();
  else if (vue_->esq().tbEdit && plan::cartoucheDessine(vue_->planche())) cartoucheEdition();
  else if (plan::estOutilEsquisse(outil) && outil != "trim" && outil != "logo") esquisse();
  else if (!s.vue.empty() && vue_->vueCourante(s.vue)) {
    vueChoisie(s.vue);
    finir("view");
  } else if (!s.axeVue.empty() && plan::vueParId(vue_->planche(), s.axeVue)) {
    axeChoisi();
  } else if (!s.cote.empty() && vue_->coteCourante(s.cote)) {
    coteChoisie(s.cote);
    finir("dim");
  } else {
    accueil();
    finir("home");
  }
  Layout();
  FitInside();
  Scroll(0, y);
  Thaw();
  Refresh();
}

// ---- La planche ----
void PanneauPlan::accueil() {
  J& sh = vue_->planche();
  J& mep = vue_->mep();
  section(L"Planche");
  {
    Options o;
    for (const std::string& c : FORMATS) o.push_back({c, tx(c)});
    const std::string cur = chaine(sh, "format") == "Manuel" ? "Manuel" : chaine(sh, "format") + (chaine(sh, "orient") == "landscape" ? "H" : "V");
    choix(L"Format", o, cur, [this](const std::string& code) {
      editer(L"format", [this, code] {
        J& q = vue_->planche();
        if (code == "Manuel") {
          if (chaine(q, "format") != "Manuel") {
            double W, H;
            plan::tailleFeuille(q, W, H);
            q["fw"] = W, q["fh"] = H, q["format"] = "Manuel";
          }
        } else {
          q["format"] = code.substr(0, code.size() - 1);
          q["orient"] = code.back() == 'H' ? "landscape" : "portrait";
          q.erase("fw");
          q.erase("fh");
        }
      });
    });
  }
  if (chaine(sh, "format") == "Manuel") {
    for (const auto& [lab, k] : std::vector<std::pair<wxString, std::string>>{{L"Largeur (mm)", "fw"}, {L"Hauteur (mm)", "fh"}}) {
      const std::string cle = k;
      nombre(lab, num(sh, cle.c_str()), [this, cle](double v) {
        editer(L"format manuel", [this, cle, v] {
          J& q = vue_->planche();
          const double W = cle == "fw" ? v : num(q, "fw"), H = cle == "fh" ? v : num(q, "fh");
          q["format"] = "Manuel";
          q["fw"] = std::min(5000.0, std::max(50.0, std::isfinite(W) && W != 0 ? W : (num(q, "fw") != 0 ? num(q, "fw") : 420)));
          q["fh"] = std::min(5000.0, std::max(50.0, std::isfinite(H) && H != 0 ? H : (num(q, "fh") != 0 ? num(q, "fh") : 297)));
          q["orient"] = num(q, "fw") >= num(q, "fh") ? "landscape" : "portrait";
        });
      });
    }
  }
  {
    const J f = cadreDeLaPlanche(sh);
    const auto setF = [this](const J& o, const wxString& lab) {
      editer(lab, [this, o] {
        J& q = vue_->planche();
        J n = cadreDeLaPlanche(q);
        for (auto it = o.begin(); it != o.end(); ++it) n[it.key()] = it.value();
        q["frame"] = n;
      });
    };
    auto* r = rang();
    libelle(r, L"Cadre");
    r = rang();
    bouton(r, L"Justet", [setF] { setF(cadreJustet(), L"cadre Justet"); }, L"Comme SIRAP-13-001 : marges 20 / 10 mm, trait 1 mm bleu-gris #6B6BA1, zones 1…8 / A…F, centrage, coins de coupe", memeCadre(f, cadreJustet()));
    bouton(r, L"ISO 5457", [setF] { setF(cadreIso(), L"cadre ISO 5457"); }, L"Marge 20 mm à gauche (reliure), 10 mm ailleurs, trait 0,7 mm, zones, centrage, coins de coupe", memeCadre(f, cadreIso()));
    bouton(r, L"Classique", [setF] { setF(cadreDefaut(), L"cadre classique"); }, L"Marges 12 mm, liseré intérieur", memeCadre(f, cadreDefaut()));
    for (const auto& [lab, k] : std::vector<std::pair<wxString, std::string>>{{L"Marge gauche (mm)", "l"}, {L"Marge droite (mm)", "r"}, {L"Marge haute (mm)", "t"}, {L"Marge basse (mm)", "b"}, {L"Trait du cadre (mm)", "lw"}}) {
      const std::string cle = k;
      nombre(lab, num(f, cle.c_str()), [setF, cle](double v) {
        J o = J::object();
        o[cle] = std::isfinite(v) ? v : 0.0;
        setF(o, L"cadre");
      });
    }
    for (const auto& [lab, k] : std::vector<std::pair<wxString, std::string>>{{L"Liseré intérieur", "inner"}, {L"Repères de centrage", "centre"}, {L"Zones de repérage", "zones"}, {L"Coins de coupe", "trim"}}) {
      const std::string cle = k;
      coche(lab, vrai(f, cle.c_str()), [setF, cle](bool v) {
        J o = J::object();
        o[cle] = v;
        setF(o, L"cadre");
      });
    }
    couleur(L"Couleur du cadre", chaine(f, "col"), "#6b6ba1", [setF](const std::string& v) {
      J o = J::object();
      o["col"] = v;
      setF(o, L"cadre");
    });
    couleur(L"Couleur des repères", chaine(f, "mcol"), "#3e2b2c", [setF](const std::string& v) {
      J o = J::object();
      o["mcol"] = v;
      setF(o, L"cadre");
    });
    r = rang();
    const J def = luJson(mep, "mep_frame_def");
    bool same = def.is_object();
    if (same) {
      for (const std::string& k : CLES_CADRE) {
        const J* a = def.contains(k) ? &def[k] : cadreDefaut().contains(k) ? &cadreDefaut()[k] : nullptr;
        const J* b = f.contains(k) ? &f[k] : nullptr;
        if ((a == nullptr) != (b == nullptr) || (a && *a != *b)) same = false;
      }
    }
    bouton(r, same ? L"✓ Cadre par défaut" : L"Cadre par défaut", [this, same, f] {
      reglage([this, same, f] {
        J& ls = reglages(vue_->mep());
        if (same) {
          ls.erase("mep_frame_def");
        } else {
          J o = J::object();
          for (const std::string& k : CLES_CADRE)
            if (f.contains(k)) o[k] = f[k];
          ls["mep_frame_def"] = o.dump();
        }
      });
    }, L"Utiliser ce cadre pour les nouvelles planches");
  }
  {
    auto* r = rang();
    libelle(r, L"Papier (écran)");
    const std::string pm = lu(mep, "mep_paper") == "dark" ? "dark" : "white";
    for (const auto& [m, l] : std::vector<std::pair<std::string, wxString>>{{"white", L"Blanc"}, {"dark", L"Sombre"}}) {
      const std::string val = m;
      bouton(r, l, [this, val] { reglage([this, val] { reglages(vue_->mep())["mep_paper"] = val; }); }, val == "dark" ? L"Planche sombre et traits clairs pour le confort à l’écran — export et impression restent sur papier blanc" : L"Planche blanche", pm == val);
    }
    r = rang();
    libelle(r, L"Export PDF / SVG");
    const bool bw = lu(mep, "mep_exp_bw") == "1";
    for (const auto& [v, l] : std::vector<std::pair<bool, wxString>>{{false, L"Couleur"}, {true, L"Noir"}}) {
      const bool val = v;
      bouton(r, l, [this, val] { reglage([this, val] { reglages(vue_->mep())["mep_exp_bw"] = val ? "1" : "0"; }); }, val ? L"Tout en noir sur blanc (ISO), couleurs d’entités comprises" : L"Garder les couleurs : cotes, axes, traits colorés (papier blanc)", bw == val);
    }
    coche(L"Règles en mm", lu(mep, "mep_rulers") != "0", [this](bool v) { reglage([this, v] { reglages(vue_->mep())["mep_rulers"] = v ? "1" : "0"; }); });
  }
  {
    const J cur = traitsLus(mep);
    Options o;
    for (const Trait& t : TRAITS) o.push_back({t.cle, t.lab});
    o.push_back({"perso", L"Personnalisé"});
    const std::string p = chaine(cur, "preset");
    const bool connu = std::any_of(TRAITS.begin(), TRAITS.end(), [&](const Trait& t) { return p == t.cle; });
    choix(L"Traits", o, connu ? p : "perso", [this](const std::string& v) {
      for (const Trait& t : TRAITS)
        if (v == t.cle) reglage([this, v, t] {
          const J c = traitsLus(vue_->mep());
          J n = J::object();
          n["preset"] = v, n["thick"] = t.thick, n["thin"] = t.thin, n["hid"] = t.hid, n["dim"] = t.dim;
          if (num(c, "axis") > 0) n["axis"] = c["axis"];
          if (num(c, "ext") > 0) n["ext"] = c["ext"];
          reglages(vue_->mep())["mep_lw"] = n.dump();
        });
    });
    for (const auto& [lab, k] : std::vector<std::pair<wxString, std::string>>{{L"Trait épais (mm)", "thick"}, {L"Trait fin (mm)", "thin"}, {L"Trait caché (mm)", "hid"}, {L"Lignes de cote (mm)", "dim"}}) {
      const std::string cle = k;
      const double c0 = num(cur, cle.c_str());
      nombre(lab, c0, [this, cle, c0](double x) {
        reglage([this, cle, c0, x] {
          J n = traitsLus(vue_->mep());
          n["preset"] = "perso";
          n[cle] = std::min(2.0, std::max(.1, std::isfinite(x) && x != 0 ? x : c0));
          reglages(vue_->mep())["mep_lw"] = n.dump();
        });
      });
    }
    for (const auto& [lab, k, dk, tip] : std::vector<std::tuple<wxString, std::string, std::string, wxString>>{
             {L"Lignes de rappel (mm)", "ext", "dim", L"Épaisseur des lignes de rappel (et d’attache des cotes ordonnées) — vide : comme les lignes de cote"},
             {L"Axes de trous (mm)", "axis", "thin", L"Épaisseur des axes et des croix de centre des trous — vide : trait fin (croix 0,62)"}}) {
      const std::string cle = k, cd = dk;
      nombre(lab, num(cur, cle.c_str()) > 0 ? num(cur, cle.c_str()) : num(cur, cd.c_str()), [this, cle, cd](double x) {
        reglage([this, cle, cd, x] {
          J n = traitsLus(vue_->mep());
          if (std::isnan(x)) n.erase(cle);
          else n[cle] = std::min(2.0, std::max(.1, x != 0 ? x : num(n, cd.c_str())));
          reglages(vue_->mep())["mep_lw"] = n.dump();
        });
      }, tip, true);
    }
  }
  // ---- cartouche ----
  section(L"Cartouche");
  if (!sh.contains("title") || !sh["title"].is_object()) sh["title"] = J::object();
  const J& tt = sh["title"];
  const auto tit = [this, &tt](const wxString& lab, const std::string& key) {
    const std::string k = key;
    texte(lab, tx(chaine(tt, k.c_str())), [this, k](const wxString& v) {
      editer(L"cartouche", [this, k, v] { vue_->planche()["title"][k] = ut(v); });
    });
  };
  tit(L"Projet", "projet");
  tit(L"Client", "client");
  tit(L"Société", "societe");
  tit(L"Quantité", "quantite");
  tit(L"N° de plan", "nplan");
  tit(L"Auteur", "auteur");
  tit(L"Date", "date");
  tit(L"Matière", "matiere");
  tit(L"TTS (surface)", "traitement");
  tit(L"TTH (thermique)", "tth");
  {
    Options o;
    for (const char* v : {"", "ISO 2768-f", "ISO 2768-m", "ISO 2768-c", "ISO 2768-v", "ISO 2768-mK", "ISO 2768-fH"}) o.push_back({v, *v ? tx(v) : wxString(L"—")});
    std::string cur = chaine(tt, "tolgen");
    if (std::none_of(o.begin(), o.end(), [&](const auto& q) { return q.first == cur; })) cur.clear();
    choix(L"Tol. générales", o, cur, [this](const std::string& v) {
      editer(L"tolérances générales", [this, v] { vue_->planche()["title"]["tolgen"] = v; });
    });
  }
  {
    auto* r = rang();
    libelle(r, L"Logo");
    const bool aLogo = vrai(tt, "logo");
    bouton(r, aLogo ? L"Changer…" : L"Choisir…", [this] {
      wxFileDialog dlg(this, L"Image du cartouche", wxEmptyString, wxEmptyString, L"Images|*.png;*.jpg;*.jpeg;*.bmp;*.gif;*.webp", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
      if (dlg.ShowModal() != wxID_OK) return;
      const std::string url = vue_->logoDepuisFichier(dlg.GetPath());
      if (url.empty()) {
        if (surIndisponible) surIndisponible(L"Cette image illisible");
        return;
      }
      editer(L"logo", [this, url] { vue_->planche()["title"]["logo"] = url; });
    }, L"Image du cartouche (réduite à 240 px)");
    if (aLogo) bouton(r, L"Retirer", [this] { editer(L"logo", [this] { vue_->planche()["title"].erase("logo"); }); }, L"Retirer le logo");
    modelesCartouche();
    r = rang();
    bouton(r, plan::cartoucheDessine(sh) ? L"Éditer le cartouche…" : L"Dessiner le cartouche…", [this] { vue_->basculerCartouche(true); }, L"Lignes, rectangles, textes et champs (matière, TTS, TTH…), contraintes et cotes pilotantes");
    const std::string nomCourant = plan::cartoucheDessine(sh) ? chaine(tt["tb"], "name") : chaine(tt, "tbName");
    bouton(r, L"Enregistrer…", [this, nomCourant] {
      wxTextEntryDialog dlg(this, L"Nom du modèle de cartouche (bibliothèque de ce poste) :", L"Cartouche", nomCourant.empty() ? wxString(L"Mon cartouche") : tx(nomCourant));
      if (dlg.ShowModal() != wxID_OK) return;
      const std::string n = ut(dlg.GetValue().Strip(wxString::both));
      if (n.empty()) return;
      J b = bibliotheque();
      b["tbs"][n] = paquetCartouche(vue_->planche(), n);
      ecrireBibliotheque(b);
      editer(L"modèle de cartouche", [this, n] {
        J& t = vue_->planche()["title"];
        if (plan::cartoucheDessine(vue_->planche())) t["tb"]["name"] = n;
        else t["tbName"] = n;
      });
      vue_->etat(wxString(L"Modèle « ") + tx(n) + L" » enregistré (traits, textes, logo et valeurs des champs).");
    }, L"Ajouter ce cartouche à la bibliothèque — traits, textes, logo et valeurs des champs : réutilisable dans toutes les pièces");
    {
      const J b = bibliotheque();
      if (!nomCourant.empty() && b["tbs"].contains(nomCourant)) {
        const bool estDefaut = (lu(vue_->mep(), "mep_tb_def").empty() ? chaine(b, "def") : lu(vue_->mep(), "mep_tb_def")) == nomCourant;
        r = rang();
        bouton(r, estDefaut ? L"✓ Par défaut" : L"Par défaut", [this, nomCourant, estDefaut] {
          J q = bibliotheque();
          if (estDefaut) q.erase("def");
          else q["def"] = nomCourant;
          ecrireBibliotheque(q);
          if (estDefaut) reglages(vue_->mep()).erase("mep_tb_def");
          else reglages(vue_->mep())["mep_tb_def"] = nomCourant;
          CallAfter([this] { refaire(); });
        }, L"Modèle des nouvelles planches");
        bouton(r, L"Retirer de la bibliothèque", [this, nomCourant] {
          if (wxMessageBox(wxString(L"Retirer « ") + tx(nomCourant) + L" » de la bibliothèque ? La planche garde son cartouche.", L"Cartouche", wxYES_NO | wxICON_QUESTION, this) != wxYES) return;
          J q = bibliotheque();
          q["tbs"].erase(nomCourant);
          if (chaine(q, "def") == nomCourant) q.erase("def");
          ecrireBibliotheque(q);
          CallAfter([this] { refaire(); });
        });
      }
    }
  }
  // ---- révisions ----
  {
    const J revs = tt.contains("revs") && tt["revs"].is_array() ? tt["revs"] : J::array();
    Options o = {{"A", L"A, B, C…"}, {"O", L"O, A, B…"}, {"0", L"0, 1, 2…"}, {"1", L"1, 2, 3…"}};
    choix(L"Révisions", o, chaine(tt, "revFmt", "A"), [this](const std::string& v) {
      editer(L"indices des révisions", [this, v] {
        J& t = vue_->planche()["title"];
        t["revFmt"] = v;
        if (t.contains("revs") && t["revs"].is_array())
          for (size_t k = 0; k < t["revs"].size(); k++) t["revs"][k]["i"] = revisionIndice(v, static_cast<int>(k));
      });
    });
    for (size_t k = 0; k < revs.size(); k++) {
      const size_t i = k;
      const auto champ = [this, i, &revs](const wxString& lab, const char* key) {
        const std::string cle = key;
        texte(wxString::Format(L"%s %zu", lab, i + 1), tx(chaine(revs[i], key)), [this, i, cle](const wxString& v) {
          editer(L"révision", [this, i, cle, v] { vue_->planche()["title"]["revs"][i][cle] = ut(v); });
        });
      };
      champ(L"Indice", "i");
      champ(L"Date", "d");
      champ(L"Nom", "n");
      champ(L"Modification", "t");
      auto* r = rang();
      bouton(r, wxString::Format(L"× Révision %zu", i + 1), [this, i] {
        editer(L"révision", [this, i] {
          J& a = vue_->planche()["title"]["revs"];
          a.erase(a.begin() + static_cast<std::ptrdiff_t>(i));
        });
      }, L"Supprimer la révision");
    }
    auto* r = rang();
    bouton(r, L"+ Révision", [this] {
      editer(L"révision", [this] {
        J& t = vue_->planche()["title"];
        if (!t.contains("revs") || !t["revs"].is_array()) t["revs"] = J::array();
        J n = J::object();
        n["i"] = revisionSuivante(chaine(t, "revFmt", "A"), t["revs"]);
        n["d"] = dateDuJour();
        const std::string a = chaine(t, "auteur");
        n["n"] = !a.empty() && a != "—" ? a : "";
        n["t"] = "";
        t["revs"].push_back(n);
      });
    }, L"Ajouter une ligne au tableau des révisions");
    const auto setR = [this](const char* k, double v, const wxString& lab) {
      const std::string cle = k;
      editer(lab, [this, cle, v] {
        J& t = vue_->planche()["title"];
        J& ow = plan::cartoucheDessine(vue_->planche()) ? t["tb"] : t;
        if (!ow.contains("revSt") || !ow["revSt"].is_object()) ow["revSt"] = J::object();
        ow["revSt"][cle] = v;
      });
    };
    J st = J::object();
    st["w"] = 0, st["h"] = 2.5, st["lw"] = 0.8;
    const auto lire = [&st](const J& o) {
      if (o.is_object())
        for (auto it = o.begin(); it != o.end(); ++it) st[it.key()] = it.value();
    };
    if (tt.contains("revSt")) lire(tt["revSt"]);
    if (plan::cartoucheDessine(sh) && tt["tb"].contains("revSt")) lire(tt["tb"]["revSt"]);
    const double stw = std::max(0.0, num(st, "w")), sth = std::min(10.0, std::max(1.8, num(st, "h") != 0 ? num(st, "h") : 2.5)), stlw = std::min(2.0, std::max(0.1, num(st, "lw") != 0 ? num(st, "lw") : 0.8));
    nombre(L"Largeur totale (mm)", stw != 0 ? stw : NAN, [setR](double v) { setR("w", std::max(0.0, std::isfinite(v) ? v : 0.0), L"tableau des révisions"); }, L"Largeur totale du tableau des révisions — vide : automatique", true);
    r = rang();
    bouton(r, L"= cartouche", [this, setR] { setR("w", js::arrondi(plan::largeurCartouche(vue_->planche()), 2), L"révisions alignées sur le cartouche"); }, L"Même largeur que le cartouche (aligné à droite sur le cadre)");
    const auto iso = listeIso(sth);
    choix(L"Hauteur h (mm)", iso.first, iso.second, [setR](const std::string& v) { setR("h", std::strtod(v.c_str(), nullptr), L"tableau des révisions"); });
    nombre(L"Trait (mm)", stlw, [setR](double v) { setR("lw", std::min(2.0, std::max(0.1, std::isfinite(v) && v != 0 ? v : 0.8)), L"tableau des révisions"); }, L"Épaisseur des traits du tableau des révisions");
  }
  // ---- nomenclature ----
  {
    const J& bom = sh.contains("bom") ? sh["bom"] : J::object();
    const bool on = vrai(bom, "on");
    coche(L"Nomenclature", on, [this](bool v) {
      editer(L"nomenclature", [this, v] {
        J& q = vue_->planche();
        J n = J::object();
        n["mat"] = J::object();
        if (q.contains("bom") && q["bom"].is_object())
          for (auto it = q["bom"].begin(); it != q["bom"].end(); ++it) n[it.key()] = it.value();
        n["on"] = v;
        q["bom"] = n;
      });
    });
    const std::string lvl = chaine(bom, "lvl");
    if (on && (vue_->assemblage() || (!lvl.empty() && lvl != "corps"))) {
      choix(L"Contenu", {{"corps", L"Corps du composant"}, {"comp1", L"Composants (1er niveau)"}, {"all", L"Composants (tous niveaux)"}, {"parts", L"Pièces seules"}}, lvl.empty() ? "corps" : lvl, [this](const std::string& v) {
        editer(L"nomenclature", [this, v] { vue_->planche()["bom"]["lvl"] = v; });
      });
      if (!lvl.empty() && lvl != "corps") {
        auto* r = rang();
        bouton(r, L"Bulles automatiques", [this] {
          wxBusyCursor attente;
          editer(L"bulles", [this] { vue_->bullesAuto(); });
          CallAfter([this] { refaire(); });
        }, L"Une bulle par ligne de la nomenclature, sur la première vue « Assemblage » de la planche");
        bouton(r, L"Effacer les bulles", [this] { editer(L"bulles", [this] { vue_->planche()["balloons"] = J::array(); }); }, L"Retire toutes les bulles de la planche");
        bouton(r, vue_->ajoutBulle() ? L"＋ Bulle (actif)" : L"＋ Bulle", [this] {
          vue_->basculerAjoutBulle();
          CallAfter([this] { refaire(); });
        }, L"Ajoute une bulle sur la pièce cliquée ; une bulle se glisse, Suppr la retire");
      }
    }
    if (on) {
      for (const plan::RangNomenclature& q : vue_->nomenclature()) {
        const std::string id = q.id;
        texte(tx(q.nom) + (q.qte > 1 ? wxString::Format(L" ×%d", q.qte) : wxString()), tx(chaine(bom.contains("mat") ? bom["mat"] : J::object(), id.c_str())), [this, id](const wxString& v) {
          editer(L"nomenclature", [this, id, v] {
            J& b = vue_->planche()["bom"];
            if (!b.contains("mat") || !b["mat"].is_object()) b["mat"] = J::object();
            b["mat"][id] = ut(v);
          });
        });
      }
    }
  }
  // ---- dessin ----
  section(L"Dessin 2D");
  {
    auto* r = rang();
    const auto ruban = [&](const wchar_t* lab, const wchar_t* nom) {
      const wxString n(nom);
      bouton(r, lab, [this, n] { vue_->boutonRuban(n); });
    };
    for (const wchar_t* l : {L"Ligne", L"Rectangle", L"Cercle", L"Arc", L"Point"}) ruban(l, l);
    r = rang();
    for (const wchar_t* l : {L"Ajuster", L"Texte"}) ruban(l, l);
    ruban(L"Cote", L"Cote");
    ruban(L"Perçage", L"Perçage");
    r = rang();
    bouton(r, L"Axes", [this] { vue_->lancerAxes("hole"); });
    ruban(L"Note", L"Note");
    ruban(L"Ord. X", L"Ordonnées X");
    ruban(L"Ord. Y", L"Ordonnées Y");
    r = rang();
    ruban(L"Coter les perçages", L"Perçages auto");
  }
  section(L"Axes");
  {
    auto* r = rang();
    const std::string mode = vue_->modeAxes();
    for (const auto& q : std::vector<std::pair<const wchar_t*, const char*>>{{L"Trou", "hole"}, {L"Alignement", "align"}, {L"Cercle", "pitch"}, {L"Libre", "free"}, {L"Symétrie", "sym"}}) {
      const std::string m = q.second;
      bouton(r, q.first, [this, m] { vue_->lancerAxes(m); }, wxString(), mode == m);
    }
  }
  // ---- écriture ----
  section(L"Écriture (ISO 3098)");
  const J style = styleLu(mep);
  const auto ecrireStyle = [this](const std::string& k, const J& v) {
    reglage([this, k, v] {
      J n = styleLu(vue_->mep());
      n[k] = v;
      J o = J::object();
      for (const char* c : {"dimH", "lblH", "noteH", "color", "arrowAngle", "arrowLen", "prec"}) o[c] = n[c];
      reglages(vue_->mep())["minifusion_mepDimStyle"] = o.dump();
    });
  };
  for (const auto& [lab, k] : std::vector<std::pair<wxString, std::string>>{{L"Cotes h (mm)", "dimH"}, {L"Repères, titres de vue h (mm)", "lblH"}, {L"Nouveaux textes h (mm)", "noteH"}}) {
    const std::string cle = k;
    const auto iso = listeIso(num(style, cle.c_str()));
    choix(lab, iso.first, iso.second, [ecrireStyle, cle](const std::string& v) { ecrireStyle(cle, std::strtod(v.c_str(), nullptr)); });
  }
  {
    auto* r = rang();
    bouton(r, L"Valeurs ISO (3,5 / 5 / 3,5)", [this] {
      reglage([this] {
        J n = styleLu(vue_->mep());
        n["dimH"] = 3.5, n["lblH"] = 5, n["noteH"] = 3.5;
        J o = J::object();
        for (const char* c : {"dimH", "lblH", "noteH", "color", "arrowAngle", "arrowLen", "prec"}) o[c] = n[c];
        reglages(vue_->mep())["minifusion_mepDimStyle"] = o.dump();
      });
    }, L"Cotes et textes 3,5 mm, repères et titres de vue 5 mm");
    note(L"h = hauteur des majuscules. Série ISO 3098 : 1,8 · 2,5 · 3,5 · 5 · 7 · 10 · 14 · 20 (rapport √2). Cotes et notes : 3,5 usuel, 2,5 mini (1,8 toléré en A4). Repères de coupe et titres de vue : un cran au-dessus. Même hauteur pour toutes les cotes d’un dessin.");
  }
  // ---- cotation ----
  section(L"Cotation");
  {
    const std::string col = chaine(style, "color", "theme");
    const bool thm = col.empty() || col == "theme";
    couleur(L"Couleur", thm ? "" : col, "#0a84ff", [ecrireStyle](const std::string& v) { ecrireStyle("color", v.empty() ? std::string("theme") : v); });
    nombre(L"Hauteur du texte (mm)", num(style, "dimH"), [ecrireStyle](double x) {
      if (std::isfinite(x)) ecrireStyle("dimH", std::floor(std::min(20.0, std::max(1.8, x)) * 100 + 0.5) / 100);
    }, L"Hauteur des majuscules des cotes (mm) — série ISO 3098 : 2,5 · 3,5 · 5 · 7 ; toute valeur de 1,8 à 20 est acceptée");
    nombre(L"Angle des flèches (°)", num(style, "arrowAngle"), [ecrireStyle](double x) {
      if (std::isfinite(x)) ecrireStyle("arrowAngle", std::min(90.0, std::max(10.0, x)));
    });
    nombre(L"Longueur des flèches (mm)", num(style, "arrowLen"), [ecrireStyle](double x) {
      if (std::isfinite(x)) ecrireStyle("arrowLen", std::min(30.0, std::max(2.0, x)));
    });
    choix(L"Précision (par défaut)", {{"0", "0"}, {"1", "0.1"}, {"2", "0.01"}, {"3", "0.001"}}, js::texte(num(style, "prec")), [ecrireStyle](const std::string& v) { ecrireStyle("prec", std::atoi(v.c_str())); });
    auto* r = rang();
    bouton(r, L"Réinitialiser", [this] {
      reglage([this] {
        J o = J::object();
        o["dimH"] = 3.5, o["lblH"] = 5, o["noteH"] = 3.5, o["color"] = "theme", o["arrowAngle"] = 36, o["arrowLen"] = 7, o["prec"] = 2;
        reglages(vue_->mep())["minifusion_mepDimStyle"] = o.dump();
      });
    }, L"Rétablir la hauteur, la couleur et les flèches par défaut");
  }
  // ---- paramètres ----
  section(L"Paramètres");
  {
    note(L"Tous les réglages du plan (écriture, cotes, traits, export, papier, cadre et cartouche par défaut) sont enregistrés avec la pièce (.conceptcad). « Sauvegarder par défaut » : ces réglages sont repris par chaque nouveau plan (une pièce qui a déjà les siens les garde).");
    const wxString fichier = dossierReglages() + SEPW L"plan-defaut.json";
    auto* r = rang();
    bouton(r, L"Sauvegarder par défaut", [this, fichier] {
      std::ofstream(fichier.ToStdWstring()) << vue_->mep()["prefs"].dump();
      vue_->etat(L"Réglages du plan enregistrés par défaut : repris par chaque nouveau plan.");
    }, L"Mémoriser tous les réglages actuels du plan comme réglages par défaut");
    bouton(r, L"Appliquer les défauts", [this, fichier] {
      std::ifstream e(fichier.ToStdWstring());
      if (!e) return;
      J p;
      try {
        p = J::parse(e);
      } catch (const std::exception&) {
        return;
      }
      reglage([this, p] { vue_->mep()["prefs"] = p; });
      vue_->etat(L"Réglages par défaut appliqués à ce plan.");
    }, L"Remplacer les réglages de ce plan par les réglages par défaut", false, !wxFileExists(fichier));
    r = rang();
    bouton(r, L"Exporter… ", [this] {
      wxFileDialog dlg(this, L"Paramètres plan", wxEmptyString, L"paramètres plan.mfplan", L"Paramètres plan (*.mfplan)|*.mfplan", wxFD_SAVE | wxFD_OVERWRITE_PROMPT);
      if (dlg.ShowModal() != wxID_OK) return;
      J o = J::object();
      o["format"] = "miniFusion-plan-params", o["v"] = 1, o["prefs"] = vue_->mep()["prefs"], o["tbLib"] = J::object();
      std::ofstream(dlg.GetPath().ToStdWstring()) << o.dump(1);
      vue_->etat(L"Paramètres plan exportés : " + dlg.GetPath());
    }, L"Sauvegarder les paramètres plan dans un fichier .mfplan");
    bouton(r, L"Importer…", [this] {
      wxFileDialog dlg(this, L"Paramètres plan", wxEmptyString, wxEmptyString, L"Paramètres plan (*.mfplan;*.json)|*.mfplan;*.json", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
      if (dlg.ShowModal() != wxID_OK) return;
      J o;
      try {
        std::ifstream e(dlg.GetPath().ToStdWstring());
        o = J::parse(e);
      } catch (const std::exception&) {
        return vue_->etat(L"Fichier de paramètres illisible.");
      }
      if (chaine(o, "format") != "miniFusion-plan-params" || !vrai(o, "prefs")) return vue_->etat(L"Ce fichier ne contient pas de paramètres plan ConceptCAD.");
      const J p = o["prefs"];
      reglage([this, p] { vue_->mep()["prefs"] = p; });
      vue_->etat(L"Paramètres plan importés — appliqués à ce projet.");
    }, L"Charger des paramètres plan depuis un fichier .mfplan");
  }
  // ---- vue ----
  section(L"Vue");
  {
    auto* r = rang();
    bouton(r, wxString(vue_->grille() ? L"▣" : L"▢") + L" grille", [this] {
      vue_->basculerGrille();
      refaire();
    }, L"Grille 10 mm");
    bouton(r, wxString(lu(mep, "minifusion_mepZoomRev") == "1" ? L"▣" : L"▢") + L" zoom ↕", [this] {
      reglage([this] { reglages(vue_->mep())["minifusion_mepZoomRev"] = lu(vue_->mep(), "minifusion_mepZoomRev") == "1" ? "0" : "1"; });
    }, L"Inverser le sens du zoom de la molette (haut = avant ou arrière)");
    r = rang();
    bouton(r, L"−", [this] { vue_->zoomer(1 / 1.3); }, L"Zoom arrière");
    bouton(r, L"Ajuster", [this] { vue_->ajuster(); }, L"Toute la feuille");
    bouton(r, L"+", [this] { vue_->zoomer(1.3); }, L"Zoom avant");
  }
  // ---- sortie ----
  section(L"Sortie");
  {
    auto* r = rang();
    bouton(r, L"⟳ Rejeter", [this] { vue_->rejeter(""); }, L"Rejeter toutes les vues");
    bouton(r, L"SVG", [this] { vue_->exporter("svg"); }, L"Exporter la planche en SVG");
    bouton(r, L"🖨", [this] { vue_->imprimer(); }, L"Imprimer la planche");
    bouton(r, L"PDF", [this] { vue_->exporter("pdf"); }, L"PDF vectoriel au format exact de la planche");
    bouton(r, L"DXF", [this] { vue_->exporter("dxf"); }, L"Exporter la planche en DXF R12 (calques CONTOUR, CACHE, AXE, COTES, CADRE…)");
    const size_t nv = sh.contains("views") && sh["views"].is_array() ? sh["views"].size() : 0, nd = sh.contains("dims") && sh["dims"].is_array() ? sh["dims"].size() : 0;
    note(wxString::Format(L"%zu vue(s) · %zu cote(s) · outil actif : sélection", nv, nd));
  }
}

// ---- La vue choisie ----
void PanneauPlan::vueChoisie(const std::string& id) {
  J* pv = vue_->vueCourante(id);
  const J& v = *pv;
  J& sh = vue_->planche();
  const std::string kind = chaine(v, "kind"), label = chaine(v, "label");
  static const std::map<std::string, const wchar_t*> PROJ = {{"top", L"Dessus"}, {"bottom", L"Dessous"}, {"left", L"Côté gauche"}, {"right", L"Côté droit"}};
  wxString titre;
  if (kind == "dxf") titre = wxString(L"Vue DXF « ") + tx(chaine(v.value("dxf", J::object()), "name", "?")) + L" »";
  else if (kind == "section") titre = L"Coupe " + tx(label);
  else if (kind == "detail") titre = L"Détail " + tx(label);
  else if (kind == "proj") {
    const auto it = PROJ.find(chaine(v, "proj"));
    titre = L"Projection " + tx(label) + L" (" + (it != PROJ.end() ? wxString(it->second) : wxString("?")) + L")";
  } else titre = L"Vue " + tx(!label.empty() ? label : chaine(v, "vk"));
  section(titre);
  const auto mod = [this, id](const wxString& lab, const std::function<void(J&)>& f) {
    editer(lab, [this, id, f] {
      if (J* q = vue_->vueCourante(id)) f(*q);
    });
  };
  texte(L"Libellé", tx(label), [mod](const wxString& s) { mod(L"libellé", [s](J& q) { q["label"] = ut(s); }); });
  if (kind == "section" && vrai(v, "section") && vrai(v["section"], "pid")) {
    const int nbr = plan::nombreBrisures(v);
    auto* r = rang();
    libelle(r, wxString::Format(L"Brisures (%d)", nbr));
    bouton(r, L"+ Brisure", [this, id] { editer(L"brisure ajoutée", [this, id] { vue_->ajouterBrisure(id); }); }, L"Ajoute une marche à l’équerre au milieu du dernier tronçon (la fin de la ligne est décalée)");
    bouton(r, L"− Brisure", [this, id] { editer(L"brisure retirée", [this, id] { vue_->enleverBrisure(id); }); }, L"Retire la dernière marche : la fin revient sur le plan précédent", false, nbr == 0);
    const auto refs = plan::liensCoupe(v);
    note(wxString::Format(L"Liens : %d / %d plan(s) accroché(s) à un centre de perçage, un trait d’axe ou une arête — la ligne suit la pièce. Tirer sur un tronçon le déplace (il s’accroche au centre ou à la ligne visé(e)). Ctrl + clic : brise au curseur (Ctrl + tirer : place le morceau). Maj + clic : enlève la brisure la plus proche. Une marche glisse le long de la ligne.", refs.first, refs.second));
  }
  {
    std::vector<std::pair<double, const wchar_t*>> tri = ECHELLES;
    std::sort(tri.begin(), tri.end(), [](const auto& a, const auto& b) { return a.first > b.first; });
    Options o;
    std::string cur;
    for (const auto& [s, lab] : tri) {
      o.push_back({js::texte(s), lab});
      if (std::abs(s - num(v, "scale")) < 1e-6) cur = js::texte(s);
    }
    choix(L"Échelle", o, cur, [mod](const std::string& x) { mod(L"échelle", [x](J& q) { q["scale"] = std::strtod(x.c_str(), nullptr); }); });
  }
  if (kind == "dxf") {
    auto* r = rang();
    bouton(r, L"Remplacer le DXF…", [this, id] { vue_->remplacerDxf(id); }, L"Charger un autre DXF dans cette vue (cotes et position gardées)");
    bouton(r, L"Cadrer", [this, id] { vue_->cadrerVue(id); });
    bouton(r, L"Supprimer", [this, id] { editer(L"suppression de vue", [this, id] { vue_->enleverVue(id); }); });
    const J& D = sous(v, "dxf");
    wxString n = wxString::Format(L"%d élément(s), ", static_cast<int>(num(D, "n"))) + tx(plan::nombreAffiche(num(sous(D, "bbox"), "w"), 1)) + L" × " + tx(plan::nombreAffiche(num(sous(D, "bbox"), "h"), 1)) + L" mm (vraie grandeur)";
    const J& sk = sous(D, "skipped");
    if (sk.is_object()) {
      wxString t;
      for (auto it = sk.begin(); it != sk.end(); ++it) t += (t.empty() ? L" — ignorés : " : L", ") + wxString::Format("%d ", it.value().get<int>()) + tx(it.key());
      n += t;
    }
    note(n + L". Cotes, axes, perçages et esquisse de planche (lignes, cercles…) s’y accrochent comme sur une vue projetée ; Détail possible.");
    return;
  }
  {
    Options o = {{"", L"Assemblée"}};
    std::string cur = vrai(v, "asm") ? "__asm" : chaine(v, "bodyId");
    if (vue_->assemblage() || vrai(v, "asm")) o.push_back({"__asm", L"🧩 Assemblage (avec les composants)"});
    for (const auto& b : vue_->corpsDuDoc()) o.push_back({b.first, tx(b.second)});
    choix(L"Corps", o, cur, [mod](const std::string& x) {
      mod(L"corps", [x](J& q) {
        q["asm"] = x == "__asm";
        if (x == "__asm" || x.empty()) q["bodyId"] = nullptr;
        else q["bodyId"] = x;
      });
    });
  }
  choix(L"Rendu", {{"wire", L"Fil de fer (tout)"}, {"hide", L"Cachées supprimées"}, {"dash", L"Cachées en pointillé"}}, chaine(v, "mode", "hide"), [mod](const std::string& x) { mod(L"rendu", [x](J& q) { q["mode"] = x; }); });
  const auto cas = [this, &v, mod](const wxString& lab, const char* key, const wxString& tip = wxString(), const char* seul = nullptr) {
    const std::string k = key;
    const bool unSeul = seul != nullptr;
    coche(lab, vrai(v, key), [mod, lab, k, unSeul](bool x) {
      mod(lab, [k, x, unSeul](J& q) {
        q[k] = x;
        if (unSeul && x)
          for (const char* o : {"shade", "render3d", "real"})
            if (k != o) q[o] = false;
      });
    }, tip);
  };
  if (kind != "section" && kind != "detail") {
    cas(L"Ombrage (faces)", "shade", wxString(), "1");
    cas(L"Rendu 3D (image)", "render3d", L"Rendu de la vue depuis la 3D (couleurs et transparence des corps)", "1");
    cas(L"Rendu réaliste", "real", L"Image de la vue comme le Rendu direct : ambiance et reflets de la fenêtre RENDU, matériau de rendu de chaque pièce — arêtes par-dessus", "1");
    if (vrai(v, "render3d") || vrai(v, "real")) cas(L"Miroir", "mirror", L"Reflet de la pièce sous elle-même, estompé vers le bas (sans sol ni ombre)");
  }
  if (v.contains("locals") && v["locals"].is_array() && !v["locals"].empty()) {  // une ligne par coupe locale
    note(L"Coupes locales");
    for (size_t k = 0; k < v["locals"].size(); k++) {
      const J& l = v["locals"][k];
      const std::string lid = chaine(l, "id"), vid = id;
      const wxString nom = wxString::Format(L"n° %zu", k + 1) + (vrai(l, "lost") ? L" ⚠" : L"");
      const wxString tip = vrai(l, "lost") ? wxString(L"L’arête du plan n’est plus retrouvée : le dernier plan connu est gardé — « Arête… » pour en choisir une autre")
                                           : wxString(L"Plan de coupe parallèle à la vue, à la profondeur de l’arête choisie — clic : sélectionner la forme pour tirer ses points");
      auto* rl = rang();
      bouton(rl, nom, [this, vid, lid] { vue_->choisirLocale(vid, lid); }, tip);
      bouton(rl, L"Arête…", [this, vid, lid] { vue_->changerAreteLocale(vid, lid); }, L"Choisir une autre arête pour placer le plan de coupe");
      bouton(rl, L"✕", [this, vid, lid] { vue_->supprimerLocale(vid, lid); }, L"Supprimer cette coupe locale");
    }
  }
  if (kind == "base") {
    const std::string vk = chaine(v, "vk");
    if (vk == "front" || vk == "rear" || vk == "left" || vk == "right" || vk == "top" || vk == "bottom") {
      choix(L"Orientation", {{"front", L"Face"}, {"rear", L"Arrière"}, {"left", L"Côté gauche"}, {"right", L"Côté droit"}, {"top", L"Dessus"}, {"bottom", L"Dessous"}}, vk, [this, id](const std::string& x) { vue_->orienter(id, x); });
    }
    choix(L"Projection", {{"", L"Orthogonale"}, {"persp", L"Perspective (comme la 3D)"}, {"obl", L"Oblique (cavalière)"}}, vrai(v, "persp") ? "persp" : vrai(v, "obl") ? "obl" : "", [mod](const std::string& x) {
      mod(L"projection", [x](J& q) {
        q.erase("obl");
        q.erase("persp");
        if (x == "obl") {
          J o = J::object();
          o["a"] = 45, o["k"] = 0.5;
          q["obl"] = o;
        }
        if (x == "persp") {
          J o = J::object();
          o["fov"] = 35;
          q["persp"] = o;
        }
      });
    });
    if (vrai(v, "persp")) {
      nombre(L"Fuyante (angle °)", num(v["persp"], "fov", 35), [mod](double x) {
        if (std::isfinite(x)) mod(L"fuyante", [x](J& q) { q["persp"]["fov"] = std::max(5.0, std::min(120.0, x)); });
      }, L"Angle de champ de la perspective (°) : plus il est grand, plus les fuyantes convergent");
      note(L"Perspective comme la vue 3D : le plan passant par le centre de la pièce reste en vraie grandeur. Arêtes exactes, parties cachées calculées sur le maillage ; les axes automatiques et les filetages conventionnels ne s’appliquent pas.");
    }
    if (vrai(v, "obl")) {
      nombre(L"Angle fuyante (°)", num(v["obl"], "a", 45), [mod](double x) {
        if (std::isfinite(x)) mod(L"fuyante", [x](J& q) { q["obl"]["a"] = x; });
      }, L"Angle des fuyantes depuis l’horizontale (cavalière : 45° ; 30° ou 60° possibles)");
      nombre(L"Coef. fuyante", num(v["obl"], "k", 0.5), [mod](double x) {
        if (std::isfinite(x) && x > 0) mod(L"fuyante", [x](J& q) { q["obl"]["k"] = std::min(2.0, x); });
      }, L"Coefficient de réduction des fuyantes (0,5 usuel ; 1 = cavalière vraie grandeur)");
      note(L"Plan de face en vraie grandeur, profondeur le long des fuyantes. HLR exact OCCT requis ; ombrage et rendu 3D suivent la projection ; les axes automatiques ne s’appliquent pas.");
    }
  }
  cas(L"Arêtes tangentielles", "tangent");
  coche(L"HLR exact OCCT", !(v.contains("hlrExact") && v["hlrExact"].is_boolean() && !v["hlrExact"].get<bool>()), [mod](bool x) { mod(L"HLR exact", [x](J& q) { q["hlrExact"] = x; }); });
  cas(L"Inverser (flip)", "flip");
  cas(L"Axes des perçages", "autoAxes", L"Croix ISO 15786 dans les trous vus de dessus, axes 04.1 et alignements ; oblongs repérés par leurs 2 centres");
  cas(L"Cercles de perçage", "autoPitch", L"Cercle primitif 04.1 et axes radiaux des répartitions circulaires");
  if (v.contains("axes") && v["axes"].is_array() && !v["axes"].empty()) {
    auto* r = rang();
    bouton(r, wxString::Format(L"Effacer les axes manuels (%zu)", v["axes"].size()), [mod] { mod(L"suppression axes manuels", [](J& q) { q["axes"] = J::array(); }); });
  }
  if (vrai(v, "align") || vrai(v, "_alignOff")) {
    coche(L"Alignée sur la mère", vrai(v, "align"), [mod](bool x) {
      mod(L"alignement vue", [x](J& q) {
        if (x) {
          q["align"] = q["_alignOff"];
          q.erase("_alignOff");
        } else {
          q["_alignOff"] = q["align"];
          q["align"] = nullptr;
        }
      });
    });
  }
  auto* r = rang();
  bouton(r, L"Cadrer", [this, id] { vue_->cadrerVue(id); });
  bouton(r, L"Rejeter", [this, id] { vue_->rejeter(id); });
  bouton(r, L"Supprimer", [this, id] { editer(L"suppression de vue", [this, id] { vue_->enleverVue(id); }); });
  wxString n;
  const auto rond = [](const J& a) {
    wxString s;
    if (a.is_array())
      for (size_t i = 0; i < a.size(); i++) s += (i ? "," : "") + tx(js::fixe(a[i].is_number() ? a[i].get<double>() : 0.0, 3));
    return s;
  };
  if (vrai(v, "section")) n = L"Plan de coupe : normale " + rond(v["section"].value("n", J::array()));
  else if (kind == "detail") n = wxString(L"Détail ×") + tx(js::fixe(num(v, "scale"), 2));
  else if (kind == "proj") n = L"1er angle — glissement contraint, échelle liée à la mère";
  else n = L"dir " + rond(v.value("dir", J::array()));
  if (kind != "section" && kind != "detail") {
    if (vrai(v, "real")) n += L" · rendu réaliste : image du Rendu direct (réglages RENDU) + arêtes";
    else if (vrai(v, "render3d")) n += L" · rendu 3D : image de la vue + arêtes, transparence par corps";
    else if (vrai(v, "shade")) n += L" · ombrage : couleur et transparence des corps reprises";
  }
  note(n);
  (void)sh;
}

// ---- La cote choisie ----
void PanneauPlan::axeChoisi() {  // mepSideAxis, mepSideAxisAuto
  const plan::SelectionPlan s = vue_->selection();
  const std::string vid = s.axeVue, id = s.axeId, ak = s.axeAk;
  J* v = plan::vueParId(vue_->planche(), vid);
  if (!v) return;
  if (id.empty()) {
    section(L"Axe automatique");
    note(L"Tirez une extrémité pour l’allonger ou le raccourcir · norme ISO 128-2 (04.1)");
    auto* q = rang();
    const bool ext = v->contains("axExt") && (*v)["axExt"].is_object() && (*v)["axExt"].contains(ak);
    bouton(q, L"Longueur d’origine", [this, vid, ak] {
      editer(L"longueur axe d’origine", [this, vid, ak] {
        if (J* w = plan::vueParId(vue_->planche(), vid); w && w->contains("axExt")) (*w)["axExt"].erase(ak);
      });
    }, wxString(), false, !ext);
    return;
  }
  const J* a = nullptr;
  if (v->contains("axes") && (*v)["axes"].is_array())
    for (const J& x : (*v)["axes"])
      if (x.value("id", std::string()) == id) a = &x;
  if (!a) return;
  const std::string k = a->value("kind", std::string());
  const J ref = a->contains("ref") ? (*a)["ref"] : J();
  const bool rAx = ref.is_object() && ref.contains("ax"), rC = ref.is_object() && ref.contains("c");
  section(k == "hole" ? (rAx ? L"Axe de révolution" : rC ? L"Axe de cercle" : L"Axe de trou") : k == "slot" ? L"Axe d’oblong" : k == "align" ? L"Axe commun" : k == "pitch" ? L"Cercle de perçage" : k == "free" ? (a->value("sym", false) ? L"Axe de symétrie (figé)" : L"Axe libre") : k == "sym" ? L"Axe de symétrie" : L"Axe");
  const size_t n = k == "hole" ? 1 : (a->contains("refs") ? (*a)["refs"].size() : 0);
  const wxString debut = k == "free" ? wxString(L"Tracé libre") : k == "slot" ? wxString(L"2 centres de l’oblong — suivent ses modifications") : k == "sym" ? wxString(L"Entre 2 droites — suit leurs déplacements") : (k == "hole" && rAx) ? wxString(L"Forme de révolution du modèle — suit ses modifications") : (k == "hole" && rC) ? wxString(L"Cercle de la vue — suit ses déplacements") : wxString::Format(L"%zu cercle(s)", n);
  note(debut + L" · norme ISO 128-2 (04.1)");
  auto* q = rang();
  bool ext = false;
  if (k != "free" && v->contains("axExt") && (*v)["axExt"].is_object())
    for (auto it = (*v)["axExt"].begin(); it != (*v)["axExt"].end(); ++it)
      if (it.key().rfind("m" + id + ".", 0) == 0) ext = true;
  if (ext)
    bouton(q, L"Longueur d’origine", [this, vid, id] {
      editer(L"longueur axe d’origine", [this, vid, id] {
        if (J* w = plan::vueParId(vue_->planche(), vid)) plan::retirerAllongements(*w, id);
      });
    }, L"Annule l’allongement des traits de cet axe");
  bouton(q, L"Supprimer", [this, vid, id] {
    editer(L"suppression axe", [this, vid, id] {
      if (J* w = plan::vueParId(vue_->planche(), vid)) plan::enleverAxe(*w, id);
      vue_->effacerAxeChoisi();
    });
  });
  bouton(q, L"Tous les axes manuels", [this, vid] {
    editer(L"suppression axes manuels", [this, vid] {
      if (J* w = plan::vueParId(vue_->planche(), vid)) (*w)["axes"] = J::array();
      vue_->effacerAxeChoisi();
    });
  });
}
void PanneauPlan::tolerance(const std::string& idc, int point) {
  J* pd = vue_->coteCourante(idc);
  if (point >= 0) pd = &(*pd)["pts"][point];  // la tolérance de CETTE valeur d'ordonnée
  const J& d = *pd;
  const auto mod = [this, idc, point](const wxString& lab, const std::function<void(J&)>& f) {
    editer(lab, [this, idc, point, f] {
      if (J* q = vue_->coteCourante(idc)) f(point >= 0 ? (*q)["pts"][point] : *q);
    });
  };
  const J& tol = d.contains("tol") ? d["tol"] : J();
  const std::string m = tol.is_object() ? chaine(tol, "m") : "";
  Options o = {{"", L"—"}, {"pm", L"± symétrique"}, {"dbl", L"Double"}, {"cls", L"Classe ISO 286"}};
  const std::string autoCls = chaine(d, "kind") == "hole" ? vue_->toleranceAutoPercage(d) : "";
  const bool isAuto = !autoCls.empty() && !tol.is_object() && !vrai(d, "tolManual");
  if (!autoCls.empty()) o.insert(o.begin(), {"auto", wxString(L"Automatique (") + tx(autoCls) + L")"});
  choix(L"Tolérance", o, isAuto ? "auto" : m, [mod, autoCls](const std::string& x) {
    mod(L"tolérance", [x, autoCls](J& q) {
      if (chaine(q, "kind") == "hole") {
        if (x == "auto") q.erase("tolManual");
        else q["tolManual"] = true;
      }
      if (x.empty() || x == "auto") {
        q["tol"] = nullptr;
        return;
      }
      J t = J::object();
      t["m"] = x, t["s"] = 0.1, t["hi"] = 0.1, t["lo"] = -0.1;
      t["cls"] = x == "cls" ? (!autoCls.empty() ? autoCls : std::string("H7")) : std::string();
      q["tol"] = t;
    });
  });
  if (m == "pm") nombre(L"± mm", num(tol, "s"), [mod](double x) { mod(L"±", [x](J& q) { q["tol"]["s"] = std::isfinite(x) ? x : 0.0; }); });
  if (m == "dbl") {
    nombre(L"+", num(tol, "hi"), [mod](double x) { mod(L"+", [x](J& q) { q["tol"]["hi"] = std::isfinite(x) ? x : 0.0; }); });
    nombre(L"−", num(tol, "lo"), [mod](double x) { mod(L"−", [x](J& q) { q["tol"]["lo"] = std::isfinite(x) ? x : 0.0; }); });
  }
  if (m == "cls") classeIso(idc, point);
}
void PanneauPlan::classeIso(const std::string& idc, int point) {
  J* pd = vue_->coteCourante(idc);
  if (point >= 0) pd = &(*pd)["pts"][point];
  const J& d = *pd;
  const bool percage = chaine(d, "kind") == "hole";
  const std::string cur = chaine(d["tol"], "cls");
  const bool ajust = cur.find('/') != std::string::npos;
  const auto P0 = ajust ? std::nullopt : lireClasse(cur);
  const std::string fam = percage ? "hole" : ajust ? "fit" : P0 && !P0->hole ? "shaft" : "hole";
  const auto poser = [this, idc, point](const std::string& v, const wxString& lab) {
    editer(lab, [this, idc, point, v] {
      if (J* q = vue_->coteCourante(idc)) (point >= 0 ? (*q)["pts"][point] : *q)["tol"]["cls"] = v;
    });
  };
  if (!percage) choix(L"Type", {{"hole", L"Alésage (A … ZC)"}, {"shaft", L"Arbre (a … zc)"}, {"fit", L"Ajustement"}}, fam, [poser](const std::string& v) { poser(v == "fit" ? "H7/g6" : v == "shaft" ? "h7" : "H7", L"type de classe"); });
  if (fam == "fit") {
    Options o;
    if (std::find(AJUSTEMENTS.begin(), AJUSTEMENTS.end(), cur) == AJUSTEMENTS.end() && !cur.empty()) o.push_back({cur, tx(cur)});
    for (const std::string& a : AJUSTEMENTS) o.push_back({a, tx(a)});
    choix(L"Ajustement", o, cur, [poser](const std::string& v) { poser(v, L"ajustement"); });
  } else {
    const ClasseIso P = P0 ? *P0 : ClasseIso{fam == "shaft" ? "h" : "H", "7", fam != "shaft"};
    Options o;
    for (const std::string& L : lettresAlesage()) {
      const std::string l = fam == "shaft" ? minuscules(L) : L;
      o.push_back({l, tx(l)});
    }
    const std::string g0 = P.g;
    choix(L"Écart", o, P.L, [poser, g0](const std::string& L) {
      const auto gs = qualites(L);
      const std::string g = std::find(gs.begin(), gs.end(), g0) != gs.end() ? g0 : std::find(gs.begin(), gs.end(), "7") != gs.end() ? "7" : gs[gs.size() / 2];
      poser(L + g, L"écart");
    });
    const auto gs = qualites(P.L);
    Options og;
    for (const std::string& g : gs) og.push_back({g, tx(g)});
    const std::string L0 = P.L;
    choix(L"Qualité (IT)", og, std::find(gs.begin(), gs.end(), P.g) != gs.end() ? P.g : (gs.empty() ? "" : gs[0]), [poser, L0](const std::string& g) { poser(L0 + g, L"qualité"); });
  }
  texte(L"Saisie", tx(cur), [this, poser, percage](const wxString& s) {
    const std::string v = normerClasse(ut(s));
    const auto p = !v.empty() && v.find('/') == std::string::npos ? lireClasse(v) : std::nullopt;
    if (v.empty() || (percage && !(p && p->hole))) {
      vue_->etat(wxString(L"Classe ISO 286 inconnue : « ") + s + L" »" + (percage ? L" (perçage : alésage, majuscules A … ZC)" : L"") + L".");
      CallAfter([this] { refaire(); });
      return;
    }
    poser(v, L"classe");
  });
}
void PanneauPlan::coteChoisie(const std::string& idc) {
  J* pd = vue_->coteCourante(idc);
  const J& d = *pd;
  const std::string kind = chaine(d, "kind");
  static const std::map<std::string, const wchar_t*> T = {{"len", L"Longueur"}, {"dist", L"Distance"}, {"rad", L"Rayon"}, {"dia", L"Diamètre"}, {"ang", L"Angle"}, {"hole", L"Cotation perçage"}, {"note", L"Note"}};
  wxString titre = L"Cote";
  if (kind == "ord") titre = wxString(L"Cotation d’ordonnées ") + tx(majuscules(chaine(d, "axis", "x")));
  else if (T.count(kind)) titre = T.at(kind);
  section(titre);
  const auto mod = [this, idc](const wxString& lab, const std::function<void(J&)>& f) {
    editer(lab, [this, idc, f] {
      if (J* q = vue_->coteCourante(idc)) f(*q);
    });
  };
  const auto supprimer = [this, idc] { editer(L"suppression cote", [this, idc] { vue_->enleverCote(idc); }); };
  const auto precision = [this, mod, &d, kind] {
    const double p = d.contains("prec") && d["prec"].is_number() ? d["prec"].get<double>() : -1;
    const int cur = p == 0 || p == 1 || p == 2 || p == 3 ? static_cast<int>(p) : kind == "ang" ? 1 : static_cast<int>(num(styleLu(vue_->mep()), "prec", 2));
    choix(L"Précision", {{"0", "0"}, {"1", "0.1"}, {"2", "0.01"}, {"3", "0.001"}}, std::to_string(cur), [mod](const std::string& v) { mod(L"précision de la cote", [v](J& q) { q["prec"] = std::atoi(v.c_str()); }); });
  };
  if (kind == "note" || kind == "ord") {
    if (kind == "note") {
      note(tx(chaine(d, "txt")) + L"\nDouble-clic ou « Texte… » pour le modifier ; glisser pour déplacer le texte.");
      auto* r = rang();
      bouton(r, L"Texte…", [this, idc, mod] {
        J* q = vue_->coteCourante(idc);
        if (!q) return;
        wxTextEntryDialog dlg(this, L"Note", L"Note", tx(chaine(*q, "txt")), wxOK | wxCANCEL | wxTE_MULTILINE);
        if (dlg.ShowModal() != wxID_OK) return;
        wxString t = dlg.GetValue();
        t.Replace("\r", "");
        t.Trim();
        if (t.empty()) return editer(L"texte de note", [this, idc] { vue_->enleverCote(idc); });
        mod(L"texte de note", [t](J& x) { x["txt"] = ut(t); });
      }, L"Modifier le texte (plusieurs lignes possibles)");
      bouton(r, L"Supprimer", supprimer);
    } else {
      const size_t n = d.contains("pts") && d["pts"].is_array() ? d["pts"].size() : 0;
      const int op = vue_->selection().cote == idc ? vue_->selection().pointOrd() : -2;
      wxString texteOrd = wxString::Format(L"%zu point(s) depuis l’origine « 0 ». Glisser une valeur ou un trait : tout le groupe se déplace ; cliquer une valeur la désigne.", n);
      if (op >= 0 && op < static_cast<int>(n)) {
        const J& o = sous(d, "o");
        const J& q = d["pts"][op];
        const double val = chaine(d, "axis") == "y" ? num(o, "y") - num(q, "y") : num(q, "x") - num(o, "x");  // mepOrdValue
        texteOrd += wxString(L"\nPoint désigné : ") + tx(plan::nombreAffiche(std::abs(val), 2)) + L" (Suppr pour le retirer).";
      } else if (op == -1) {
        texteOrd += L"\nOrigine « 0 » désignée : supprimez le groupe pour la retirer.";
      }
      note(texteOrd);
      precision();
      auto* r = rang();
      const std::string idOrd = idc, outilOrd = chaine(d, "axis") == "y" ? "ordy" : "ordx";
      bouton(r, L"+ Points", [this, idOrd, outilOrd] { vue_->ajouterPointsOrdonnees(idOrd, outilOrd); }, L"Ajouter des valeurs à ce groupe : cliquez les points, Entrée termine (aussi : groupe sélectionné + outil Ordonnées)");
      bouton(r, L"− Dernier", [mod] { mod(L"point d’ordonnée retiré", [](J& q) { q["pts"].erase(q["pts"].size() - 1); }); }, L"Retirer le dernier point coté", false, n == 0);
      bouton(r, L"Supprimer", supprimer);
      if (op >= 0 && op < static_cast<int>(n)) {
        r = rang();
        bouton(r, L"Supprimer ce point", [this, idc, op] { vue_->supprimerPointOrdonnee(idc, op); }, L"Retire la valeur désignée du groupe (Suppr)");
        tolerance(idc, op);
      }
    }
    return;
  }
  note(tx(vue_->texteDeCote(idc)));
  const auto bout = [mod](const wxString& lab, const char* key) {
    const std::string k = key;
    return [mod, lab, k](const wxString& s) {
      wxString t = s;
      t.Trim().Trim(false);
      mod(lab, [t, k](J& q) {
        if (t.empty()) q.erase(k);
        else q[k] = ut(t);
      });
    };
  };
  texte(L"Texte avant", tx(chaine(d, "pre")), bout(L"texte avant", "pre"));
  texte(L"Texte après", tx(chaine(d, "post")), bout(L"texte après", "post"));
  precision();
  tolerance(idc);
  if (kind != "hole") coche(L"Cote de référence", vrai(d, "ref"), [mod](bool x) { mod(L"référence", [x](J& q) { q["ref"] = x; }); });
  const double to0 = std::floor(num(d, "txtOff") * 100 + 0.5) / 100;
  if (kind == "ang" || kind == "len" || kind == "dist") {
    if (kind != "ang") {
      auto* r = rang();
      libelle(r, L"Flèches");
      bouton(r, chaine(d, "arr") == "out" ? L"Flèches intérieures" : L"Flèches extérieures", [mod] { mod(L"sens des flèches", [](J& q) { q["arr"] = chaine(q, "arr") == "out" ? "in" : "out"; }); });
    }
    nombre(L"Décalage texte (mm)", to0, [this, idc, mod, kind](double x) {
      double v = std::isfinite(x) ? x : 0;
      if (kind == "ang") {
        if (std::abs(v) < 3) v = 0;
      } else if (J* q = vue_->coteCourante(idc)) {
        v = vue_->accrocherTexte(*q, v);
      }
      mod(L"décalage texte", [v](J& q) {
        if (v != 0) q["txtOff"] = v;
        else q.erase("txtOff");
      });
    });
    auto* r = rang();
    bouton(r, L"Centrer", [mod] { mod(L"centrage texte", [](J& q) { q.erase("txtOff"); }); });
  }
  auto* r = rang();
  bouton(r, L"Supprimer", supprimer);
}

// ---- L'esquisse ----
namespace {
const std::vector<std::pair<std::string, const wchar_t*>> CHAMPS = {{"txt", L"Texte libre"}, {"projet", L"Projet"}, {"nplan", L"N° de plan"}, {"societe", L"Société"}, {"client", L"Client"}, {"quantite", L"Quantité"}, {"planche", L"PLANCHE"}, {"echelle", L"ÉCHELLE"}, {"format", L"FORMAT"}, {"date", L"Date"}, {"auteur", L"Dessiné par"}, {"verif", L"Vérifié par"}, {"matiere", L"Matière"}, {"traitement", L"TTS (surface)"}, {"tth", L"TTH (thermique)"}, {"tolgen", L"Tol. générales"}, {"etat", L"État de surface"}, {"masse", L"Masse"}, {"indice", L"INDICE"}, {"perso", L"CHAMP PERSO"}};
wxString nomCons(const std::string& t) {
  static const std::map<std::string, const wchar_t*> M = {{"horizontal", L"Horizontal"}, {"vertical", L"Vertical"}, {"parallel", L"Parallèle"}, {"perp", L"Perpendiculaire"}, {"equal", L"Égal"}, {"eqR", L"Rayons égaux"}, {"midpoint", L"Milieu"}, {"onLine", L"Sur ligne"}, {"onCircle", L"Sur cercle"}, {"tangent", L"Tangent"}, {"fix", L"Fixe"}, {"coincident", L"Coïncident"}, {"dist", L"Distance"}, {"distX", L"Distance horizontale"}, {"distY", L"Distance verticale"}, {"distPL", L"Distance point–ligne"}, {"radius", L"Rayon"}, {"angle", L"Angle"}};
  const auto it = M.find(t);
  return it == M.end() ? wxString::FromUTF8(t) : wxString(it->second);
}
}  // namespace
void PanneauPlan::esquisseOutils() {
  plan::EtatEsquisse& et = vue_->esq();
  const std::string cur = vue_->outilCourant();
  struct O {
    const wchar_t* lab;
    const char* t;
    const wchar_t* tip;
  };
  std::vector<O> outils = {{L"▲", "", L"Sélection / déplacement (Maj+clic : ajouter)"}, {L"━", "line", L"Ligne (enchaînée, Échap termine)"}, {L"▭", "rect", L"Rectangle"}, {L"○", "circle", L"Cercle"}, {L"◠", "arc", L"Arc : centre, départ, arrivée"}, {L"·", "point", L"Point"}, {L"✂", "trim", L"Ajuster"}, {L"T", "text", L"Texte ou champ"}};
  if (et.tbEdit) outils.push_back({L"Logo", "logo", L"Zone du logo (2 coins)"});
  auto* r = rang();
  for (const O& o : outils) {
    const std::string t = o.t;
    bouton(r, o.lab, [this, t] {
      if (t.empty()) vue_->quitterOutil();
      else vue_->lancerOutil(t);
      refaire();
    }, o.tip, cur == t);
  }
  r = rang();
  libelle(r, L"Afficher");
  bouton(r, L"Contraintes", [this] { vue_->esq().visCons = !vue_->esq().visCons; vue_->redessinerPlan(); refaire(); }, L"Glyphes H, V, ∥, ⊥, =, M, ⚓… — un élément sélectionné garde les siennes", et.visCons);
  bouton(r, L"Cotes", [this] { vue_->esq().visDims = !vue_->esq().visDims; vue_->redessinerPlan(); refaire(); }, L"Cotes pilotantes (distances, rayons, angles) — un élément sélectionné garde les siennes", et.visDims);
  bouton(r, L"Textes", [this] { vue_->esq().visTxt = !vue_->esq().visTxt; vue_->redessinerPlan(); refaire(); }, L"Cotes et contraintes de placement des textes (sinon visibles à la sélection du texte)", et.visTxt);
  if (cur == "text") {
    Options oc;
    for (const auto& q : CHAMPS) oc.push_back({q.first, q.second});
    choix(L"Champ", oc, et.textF, [this](const std::string& v) {
      vue_->esq().textF = v;
      refaire();
    });
    if (et.textF == "txt") texte(L"Texte", tx(et.textS), [this](const wxString& v) { vue_->esq().textS = ut(v); });
    const auto iso = listeIso(et.textH != 0 ? et.textH : 3.5);
    choix(L"Hauteur h (mm)", iso.first, iso.second, [this](const std::string& v) { vue_->esq().textH = std::strtod(v.c_str(), nullptr); });
    note(L"Cliquez pour poser le texte ; il s’accroche aux points et lignes, puis se contraint comme un point.");
  }
}
void PanneauPlan::esquisseStyle(const std::vector<std::string>* ids, bool tb) {
  plan::EtatEsquisse& et = vue_->esq();
  const bool courant = !ids;
  std::vector<J*> S;
  if (courant) S.push_back(&et.style);
  else
    for (const std::string& id : *ids)
      if (J* e = plan::elementEsquisse(vue_->planche(), et, id)) S.push_back(e);
  if (S.empty()) return;
  section(courant ? wxString(L"Style des nouveaux éléments") : wxString::Format(L"Style (%zu)", S.size()));
  const std::string wDef = tb ? "thin" : "thick";
  std::vector<J*> traits;
  for (J* x : S)
    if (courant || chaine(*x, "t") != "text") traits.push_back(x);
  const std::vector<std::string> idsCopie = ids ? *ids : std::vector<std::string>();
  const auto modifier = [this, courant, idsCopie](const std::function<void(J&)>& fn) {
    if (courant) {
      fn(vue_->esq().style);
      reglages(vue_->mep())["mep_sk_style"] = vue_->esq().style.dump();
      CallAfter([this] { refaire(); });
      return;
    }
    editer(L"style du trait", [this, idsCopie, fn] {
      for (const std::string& id : idsCopie)
        if (J* e = plan::elementEsquisse(vue_->planche(), vue_->esq(), id)) fn(*e);
    });
  };
  const auto surTrait = [modifier](const std::function<void(J&)>& fn) {
    modifier([fn](J& x) {
      if (chaine(x, "t") != "text") fn(x);
    });
  };
  if (!traits.empty()) {
    auto* r = rang();
    libelle(r, L"Épaisseur");
    for (const auto& q : std::vector<std::pair<const char*, const wchar_t*>>{{"thin", L"Fin"}, {"thick", L"Épais"}}) {
      const std::string v = q.first;
      const bool actif = std::all_of(traits.begin(), traits.end(), [&](J* x) { return !(num(*x, "lw") > 0) && (chaine(*x, "w").empty() ? wDef : chaine(*x, "w")) == v; });
      bouton(r, q.second, [surTrait, v] {
        surTrait([v](J& x) {
          x["w"] = v;
          x.erase("lw");
        });
      }, wxString(L"Trait ") + (v == "thick" ? L"épais" : L"fin") + L" de la planche (réglages « Traits »)", actif);
    }
    double lv = num(*traits[0], "lw");
    for (J* x : traits)
      if (num(*x, "lw") != lv) lv = 0;
    nombre(L"Épaisseur (mm)", lv > 0 ? lv : NAN, [surTrait](double v) {
      surTrait([v](J& x) {
        if (v > 0) x["lw"] = std::min(3.0, std::max(0.05, v));
        else x.erase("lw");
      });
    }, L"Épaisseur libre en mm papier — vide : Fin / Épais", true);
    r = rang();
    libelle(r, L"Type");
    for (const auto& q : std::vector<std::pair<const char*, const wchar_t*>>{{"", L"Continu"}, {"hid", L"Interrompu"}, {"axis", L"Mixte"}}) {
      const std::string v = q.first;
      const bool actif = std::all_of(traits.begin(), traits.end(), [&](J* x) { return chaine(*x, "lt") == v; });
      bouton(r, q.second, [surTrait, v] {
        surTrait([v](J& x) {
          if (!v.empty()) x["lt"] = v;
          else x.erase("lt");
        });
      }, wxString(), actif);
    }
    std::vector<J*> geo;
    for (J* x : traits) {
      const std::string t = chaine(*x, "t");
      if (courant || t == "line" || t == "circle" || t == "arc") geo.push_back(x);
    }
    if (!geo.empty()) {
      r = rang();
      libelle(r, L"Construction");
      const bool on = std::all_of(geo.begin(), geo.end(), [](J* x) { return vrai(*x, "cst"); });
      bouton(r, on ? L"Oui" : L"Non", [modifier, courant, on] {
        modifier([courant, on](J& x) {
          const std::string t = chaine(x, "t");
          if (!courant && !(t == "line" || t == "circle" || t == "arc")) return;
          if (on) x.erase("cst");
          else x["cst"] = true;
        });
      }, L"Élément de construction : pointillé en édition, invisible sur la planche, à l’impression et à l’export", on);
    }
  }
  std::string cv = chaine(*S[0], "col");
  for (J* x : S)
    if (chaine(*x, "col") != cv) cv.clear();
  couleur(L"Couleur", cv, "#151515", [modifier](const std::string& v) {
    modifier([v](J& x) {
      if (v.empty()) x.erase("col");
      else x["col"] = v;
    });
  });
}
void PanneauPlan::esquisse() {
  plan::EtatEsquisse& et = vue_->esq();
  J& sh = vue_->planche();
  const plan::SelectionPlan& s = vue_->selection();
  const plan::InfosEsquisse q = plan::infosEsquisse(sh, et, s);
  section(q.tb ? L"Cartouche — esquisse" : L"Esquisse de planche");
  esquisseOutils();
  if (!q.existe) return esquisseStyle(nullptr, q.tb);
  const size_t n = s.skSel.size();
  if (!n) esquisseStyle(nullptr, q.tb);
  section(wxString::Format(L"Sélection (%zu)", n));
  const auto valeur = [this, &et, &sh](const wxString& lab, const std::string& id) {
    J* c = plan::contrainteEsquisse(sh, et, id);
    if (!c) return;
    const bool angle = chaine(*c, "type") == "angle";
    const double v = js::arrondi(angle ? std::abs(num(*c, "val")) * 180 / 3.14159265358979323846 : std::abs(num(*c, "val")), 3);
    nombre(lab + (angle ? L" (°)" : L" (mm)"), v, [this, id](double x) {
      if (std::isfinite(x)) CallAfter([this, id, x] { vue_->valeurContrainte(id, x); });
    });
  };
  if (q.contraintes.size() == 1 && n == 1) {
    J* c = plan::contrainteEsquisse(sh, et, q.contraintes[0]);
    if (c) {
      const std::string t = chaine(*c, "type");
      if (c->contains("val") && !(*c)["val"].is_null() && t != "fix") valeur(nomCons(t), q.contraintes[0]);
      else note(nomCons(t));
    }
  }
  if (!q.lies.empty()) {
    section(wxString::Format(L"Lié à la vue (%zu)", q.lies.size()));
    static const std::map<std::string, const wchar_t*> nm = {{"p1", L"extrémité"}, {"p2", L"extrémité"}, {"mid", L"milieu"}, {"f", L"point du trait"}, {"ctr", L"centre"}, {"ang", L"point du cercle"}};
    for (size_t i = 0; i < q.lies.size() && i < 6; i++) {
      const J* p = plan::pointEsquisse(sh, et, q.lies[i]);
      if (!p) continue;
      const J& L = (*p)["lk"];
      const J* v = plan::vueParId(sh, chaine(L, "vid"));
      const auto it = nm.find(chaine(L, "k"));
      note((it == nm.end() ? wxString(L"point") : wxString(it->second)) + L" — vue " + (v ? tx(chaine(*v, "label").empty() ? chaine(*v, "id") : chaine(*v, "label")) : wxString(L"supprimée")) + (L.contains("i") && L["i"].is_string() ? L" (trait d’axe)" : L""));
    }
    auto* r = rang();
    const std::vector<std::string> lies = q.lies;
    bouton(r, L"Détacher de la vue", [this, lies] { editer(L"esquisse : détacher de la vue", [this, lies] { plan::detacherDeLaVue(vue_->planche(), vue_->esq(), lies); }); }, L"Le point garde sa position mais ne suit plus la vue");
  }
  if (q.contraintes.empty() && !q.cotes.empty()) {
    section(wxString::Format(L"Cotes (%zu)", q.cotes.size()));
    for (size_t i = 0; i < q.cotes.size() && i < 10; i++) {
      J* c = plan::contrainteEsquisse(sh, et, q.cotes[i]);
      if (c) valeur(nomCons(chaine(*c, "type")), q.cotes[i]);
    }
  }
  if (q.textes.size() == 1 && n == 1) {
    const std::string id = q.textes[0];
    J* e0 = plan::elementEsquisse(sh, et, id);
    const J e = e0 ? *e0 : J::object();
    const auto surTexte = [this, id](const std::function<void(J&)>& fn) {
      editer(L"texte", [this, id, fn] {
        if (J* x = plan::elementEsquisse(vue_->planche(), vue_->esq(), id)) fn(*x);
      });
    };
    Options oc;
    for (const auto& c : CHAMPS) oc.push_back({c.first, c.second});
    const std::string f = chaine(e, "f", "txt");
    if (f == "rev") oc.push_back({"rev", L"RÉV"});
    choix(L"Champ", oc, f, [surTexte](const std::string& v) {
      surTexte([v](J& x) {
        x["f"] = v;
        if (v == "txt" && !vrai(x, "s")) x["s"] = "TEXTE";
        if (v == "perso" && !vrai(x, "k")) x["k"] = plan::identifiantPlan("c"), x["lab"] = "CHAMP";
      });
    });
    if (f == "txt") texte(L"Texte", tx(chaine(e, "s")), [surTexte](const wxString& v) { surTexte([v](J& x) { x["s"] = ut(v); }); });
    if (f == "perso") texte(L"Nom du champ", tx(chaine(e, "lab")), [surTexte](const wxString& v) { surTexte([v](J& x) { x["lab"] = ut(v); }); });
    const double h0 = num(e, "h") != 0 ? num(e, "h") : 3.5;
    const auto iso = listeIso(js::arrondi(h0 * 0.716, 2));
    choix(L"Hauteur h (mm)", iso.first, iso.second, [surTexte](const std::string& v) {
      const double h = std::strtod(v.c_str(), nullptr);
      surTexte([h](J& x) { x["h"] = js::arrondi(h / 0.716, 3); });
    });
    nombre(L"Largeur maxi (mm)", num(e, "mw"), [surTexte](double v) {
      surTexte([v](J& x) {
        if (v > 0) x["mw"] = v;
        else x.erase("mw");
      });
    }, L"Largeur maximale (mm) — 0 = libre ; au-delà, le texte est tronqué (…)");
    auto* r = rang();
    libelle(r, L"Graisse");
    for (const auto& c : std::vector<std::pair<const char*, const wchar_t*>>{{"lab", L"Libellé"}, {"val", L"Valeur"}}) {
      const std::string v = c.first;
      bouton(r, c.second, [surTexte, v] { surTexte([v](J& x) { x["st"] = v; }); }, v == "lab" ? L"Texte maigre" : L"Texte gras", chaine(e, "st", "lab") == v);
    }
    r = rang();
    libelle(r, L"Ancrage");
    for (const auto& c : std::vector<std::pair<const char*, const wchar_t*>>{{"start", L"⇤"}, {"middle", L"↔"}, {"end", L"⇥"}}) {
      const std::string v = c.first;
      bouton(r, c.second, [surTexte, v] { surTexte([v](J& x) { x["al"] = v; }); }, wxString(L"Ancrage : ") + (v == "start" ? L"début" : v == "middle" ? L"centre" : L"fin"), chaine(e, "al", "start") == v);
    }
  }
  if (!q.lignes.empty() || !q.cercles.empty() || !q.textes.empty()) {
    std::vector<std::string> ids = q.lignes;
    ids.insert(ids.end(), q.cercles.begin(), q.cercles.end());
    ids.insert(ids.end(), q.textes.begin(), q.textes.end());
    esquisseStyle(&ids, q.tb);
  }
  const auto lesBoutons = [&](bool dim) {
    auto* r = rang();
    int k = 0;
    for (const plan::ContrainteEsquisse& D : plan::contraintesEsquisse()) {
      if (D.dim != dim) continue;
      if (k && k % 3 == 0) r = rang();
      k++;
      const std::string id = D.id;
      bouton(r, tx(D.lab), [this, id] { vue_->appliquerContrainte(id); }, tx(D.tip), false, !plan::contrainteAdmise(sh, et, s, id));
    }
  };
  section(L"Contraintes");
  lesBoutons(false);
  section(L"Cotes pilotantes");
  lesBoutons(true);
  auto* r = rang();
  bouton(r, L"Supprimer", [this] { vue_->supprimerSelection(); }, L"Supprimer la sélection (Suppr)");
  bouton(r, L"Désélectionner", [this] { vue_->choisirSk({}); }, L"Échap");
  if (q.tb) {
    r = rang();
    bouton(r, L"Terminer l’édition du cartouche", [this] { vue_->basculerCartouche(false); }, L"Échap");
  }
  note(L"Maj+clic : ajouter à la sélection. Glisser un point ou un trait : l’esquisse suit ses contraintes. Une cote se pose à la valeur actuelle, puis se modifie ici.");
}
void PanneauPlan::cartoucheEdition() {
  plan::EtatEsquisse& et = vue_->esq();
  J& sh = vue_->planche();
  const plan::SelectionPlan& s = vue_->selection();
  section(L"Édition du cartouche");
  esquisseOutils();
  esquisseStyle(nullptr, true);
  const plan::InfosEsquisse q = plan::infosEsquisse(sh, et, s);
  note(wxString::Format(L"Origine (croix) = coin bas-droit intérieur du cadre : le cartouche garde ses cotes sur tous les formats. Hauteur actuelle : %s mm, largeur : %s mm.", nb(js::arrondi(plan::hauteurCartouche(sh), 1)), nb(js::arrondi(plan::largeurCartouche(sh), 1))));
  note(wxString::Format(L"%zu contrainte(s), %zu élément(s). Cliquez un élément pour le contraindre ; les champs ({MATIÈRE}, {TTS}, {TTH}…) prennent les valeurs de la planche.", q.nbCons, q.nbEnts));
  auto* r = rang();
  bouton(r, L"Terminer", [this] { vue_->basculerCartouche(false); }, L"Quitter l’édition (Échap)", true);
  bouton(r, L"Repartir du Standard", [this] {
    if (wxMessageBox(L"Remplacer le cartouche par le modèle Standard (annulable) ?", L"Cartouche", wxYES_NO | wxICON_QUESTION, this) != wxYES) return;
    editer(L"cartouche standard", [this] {
      J copie = vue_->planche();
      copie["title"].erase("tb");
      vue_->planche()["title"]["tb"] = plan::cartoucheStandard(copie);
    });
  }, L"Recrée l’esquisse du cartouche Standard");
}

void PanneauPlan::lot() {
  const plan::SelectionPlan& s = vue_->selection();
  section(L"Sélection");
  wxString t;
  if (!s.lotVues.empty()) t += wxString::Format(L"%zu vue(s)", s.lotVues.size());
  if (!s.lotCotes.empty()) t += (t.empty() ? wxString() : wxString(L" · ")) + wxString::Format(L"%zu cote(s)", s.lotCotes.size());
  if (!s.skSel.empty()) t += (t.empty() ? wxString() : wxString(L" · ")) + wxString::Format(L"%zu élément(s) d’esquisse", s.skSel.size());
  note(t.empty() ? wxString(L"—") : t);
  auto* r = rang();
  bouton(r, L"Supprimer", [this] { vue_->supprimerSelection(); }, L"Supprimer toute la sélection (Suppr)");
  bouton(r, L"Désélectionner", [this] { vue_->viderSelection(); }, L"Échap");
  if (!s.lotCotes.empty()) {
    r = rang();
    const std::vector<std::string> lotIds(s.lotCotes.begin(), s.lotCotes.end());
    bouton(r, L"Aligner sur une cote…", [this, lotIds] { vue_->commencerAlignement(lotIds); }, L"Pose la ligne de chaque cote sélectionnée (parallèle) sur celle d’une cote de référence : cliquez-la ensuite");
  }
  note(L"Cadre de gauche à droite : éléments entièrement dedans. De droite à gauche : tout ce qui touche le cadre. Maj : ajouter. Maj/Ctrl + clic sur une cote : l’ajoute ou la retire.");
  Layout();
  FitInside();
}

bool PanneauPlan::essai(const J& e) {
  bool ok = false;
  if (e.contains("champ")) {
    const auto it = champs_.find(wxString::FromUTF8(e["champ"].get<std::string>()));
    if (it != champs_.end()) {
      const auto f = it->second;
      f(wxString::FromUTF8(e.value("valeur", std::string())));
      ok = true;
    }
  }
  if (e.contains("bouton")) {
    const auto it = boutons_.find(wxString::FromUTF8(e["bouton"].get<std::string>()));
    if (it != boutons_.end()) {
      const auto f = it->second;
      f();
      ok = true;
    }
  }
  wxYield();
  refaire();
  return ok;
}
