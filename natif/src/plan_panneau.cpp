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
}  // namespace

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
  if (!s.lotVues.empty() || !s.lotCotes.empty()) lot();
  else if (!s.vue.empty() && vue_->vueCourante(s.vue)) {
    vueChoisie(s.vue);
    finir("view");
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
    r = rang();
    boutonPasEncore(r, L"Charger un cartouche…");
    boutonPasEncore(r, L"Exporter…");
    r = rang();
    boutonPasEncore(r, plan::cartoucheDessine(sh) ? L"Éditer le cartouche…" : L"Dessiner le cartouche…");
    boutonPasEncore(r, L"Enregistrer…");
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
        boutonPasEncore(r, L"Bulles automatiques");
        bouton(r, L"Effacer les bulles", [this] { editer(L"bulles", [this] { vue_->planche()["balloons"] = J::array(); }); }, L"Retire toutes les bulles de la planche");
        boutonPasEncore(r, L"＋ Bulle");
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
    for (const wchar_t* l : {L"Ligne", L"Rectangle", L"Cercle", L"Arc", L"Point"}) boutonPasEncore(r, l);
    r = rang();
    for (const wchar_t* l : {L"Ajuster", L"Texte", L"Cote", L"Perçage"}) boutonPasEncore(r, l);
    r = rang();
    for (const wchar_t* l : {L"Axes", L"Note", L"Ord. X", L"Ord. Y"}) boutonPasEncore(r, l);
    r = rang();
    boutonPasEncore(r, L"Coter les perçages");
  }
  section(L"Axes");
  {
    auto* r = rang();
    for (const wchar_t* l : {L"Trou", L"Alignement", L"Cercle", L"Libre", L"Symétrie"}) boutonPasEncore(r, l);
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
    const wxString fichier = dossierReglages() + L"\\plan-defaut.json";
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
    boutonPasEncore(r, L"⟳ Rejeter");
    boutonPasEncore(r, L"SVG");
    boutonPasEncore(r, L"🖨");
    boutonPasEncore(r, L"PDF");
    boutonPasEncore(r, L"DXF");
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
  if (kind == "dxf") return;
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
  if (kind == "base") {
    const std::string vk = chaine(v, "vk");
    if (vk == "front" || vk == "rear" || vk == "left" || vk == "right" || vk == "top" || vk == "bottom") {
      auto* r = rang();
      libelle(r, L"Orientation");
      boutonPasEncore(r, wxString(L"Changer (") + tx(vk) + L")");
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
  boutonPasEncore(r, L"Rejeter");
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
void PanneauPlan::tolerance(const std::string& idc) {
  J* pd = vue_->coteCourante(idc);
  const J& d = *pd;
  const auto mod = [this, idc](const wxString& lab, const std::function<void(J&)>& f) {
    editer(lab, [this, idc, f] {
      if (J* q = vue_->coteCourante(idc)) f(*q);
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
  if (m == "cls") classeIso(idc);
}
void PanneauPlan::classeIso(const std::string& idc) {
  J* pd = vue_->coteCourante(idc);
  const J& d = *pd;
  const bool percage = chaine(d, "kind") == "hole";
  const std::string cur = chaine(d["tol"], "cls");
  const bool ajust = cur.find('/') != std::string::npos;
  const auto P0 = ajust ? std::nullopt : lireClasse(cur);
  const std::string fam = percage ? "hole" : ajust ? "fit" : P0 && !P0->hole ? "shaft" : "hole";
  const auto poser = [this, idc](const std::string& v, const wxString& lab) {
    editer(lab, [this, idc, v] {
      if (J* q = vue_->coteCourante(idc)) (*q)["tol"]["cls"] = v;
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
      note(wxString::Format(L"%zu point(s) depuis l’origine « 0 ». Glisser une valeur ou un trait : tout le groupe se déplace ; cliquer une valeur la désigne.", n));
      precision();
      auto* r = rang();
      boutonPasEncore(r, L"+ Points");
      bouton(r, L"− Dernier", [mod] { mod(L"point d’ordonnée retiré", [](J& q) { q["pts"].erase(q["pts"].size() - 1); }); }, L"Retirer le dernier point coté", false, n == 0);
      bouton(r, L"Supprimer", supprimer);
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

void PanneauPlan::lot() {
  const plan::SelectionPlan& s = vue_->selection();
  section(L"Sélection");
  wxString t;
  if (!s.lotVues.empty()) t += wxString::Format(L"%zu vue(s)", s.lotVues.size());
  if (!s.lotCotes.empty()) t += (t.empty() ? wxString() : wxString(L" · ")) + wxString::Format(L"%zu cote(s)", s.lotCotes.size());
  note(t.empty() ? wxString(L"—") : t);
  auto* r = rang();
  bouton(r, L"Supprimer", [this] { vue_->supprimerSelection(); }, L"Supprimer toute la sélection (Suppr)");
  bouton(r, L"Désélectionner", [this] { vue_->viderSelection(); }, L"Échap");
  if (!s.lotCotes.empty()) {
    r = rang();
    boutonPasEncore(r, L"Aligner sur une cote…");
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
