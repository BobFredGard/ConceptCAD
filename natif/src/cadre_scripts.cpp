// Scripts JSON (src/53-scripts.js) : une liste de commandes {op, …} exécutées dans l'ordre sur le document.
// Atomique : une erreur remet le document tel qu'avant le script. Une seule étape d'annulation pour tout le script.
// Le pont de pilotage du navigateur (serveur MCP local) n'est pas repris.
#include <wx/wx.h>
#include <wx/config.h>
#include <wx/propgrid/propgrid.h>
#include <wx/treectrl.h>

#include <BRepBndLib.hxx>
#include <BRepGProp.hxx>
#include <Bnd_Box.hxx>
#include <GProp_GProps.hxx>

#include <algorithm>
#include <cmath>

#include "cadre.h"
#include "configurations.h"
#include "enregistrer.h"
#include "fiches.h"
#include "parametres.h"
#include "structure.h"
#include "theme.h"

namespace {
using O = nlohmann::ordered_json;
const char* const OPS = "new, param, sketch, extrude, revolve, config, info, undo";

double nombre(const O& v, const std::string& quoi) {
  if (v.is_number()) {
    const double n = v.get<double>();
    if (std::isfinite(n)) return n;
  }
  if (v.is_string()) {  // +v du navigateur : « 12 » vaut 12
    try {
      size_t fin = 0;
      const std::string t = v.get<std::string>();
      const double n = std::stod(t, &fin);
      if (fin == t.size() && std::isfinite(n)) return n;
    } catch (const std::exception&) {
    }
  }
  throw std::runtime_error(quoi + " : nombre attendu (" + v.dump(-1, ' ', false, O::error_handler_t::replace) + ")");
}
double arrondi3(double v) { return std::round(v * 1000) / 1000; }

// mfSketchShapes : points partagés, coins fermés
void formes(O& sk, const O& shapes) {
  int n = 0, e = 0;
  const auto P = [&](const O& x, const O& y) {
    const std::string id = "p" + std::to_string(++n);
    sk["points"][id] = {{"x", nombre(x, "x")}, {"y", nombre(y, "y")}};
    return id;
  };
  const auto E = [&](O o, bool cons) {
    O l = O::object();
    l["id"] = "e" + std::to_string(++e);
    for (auto& [k, v] : o.items()) l[k] = v;
    if (cons) l["construction"] = true;
    sk["entities"].push_back(std::move(l));
  };
  if (!shapes.is_array()) return;
  int k = 0;
  for (const O& s : shapes) {
    k++;
    const std::string rang = "forme " + std::to_string(k);
    if (!s.is_object()) throw std::runtime_error(rang + " : objet attendu");
    const bool c = s.contains("construction") && s["construction"].is_boolean() && s["construction"].get<bool>();
    if (s.contains("rect") && s["rect"].is_array()) {
      const O& r = s["rect"];
      if (r.size() < 4) throw std::runtime_error(rang + " : rectangle plat");
      const double x0 = nombre(r[0], "rect"), y0 = nombre(r[1], "rect"), x1 = nombre(r[2], "rect"), y1 = nombre(r[3], "rect");
      if (!(std::abs(x1 - x0) > 1e-9 && std::abs(y1 - y0) > 1e-9)) throw std::runtime_error(rang + " : rectangle plat");
      const std::string a = P(x0, y0), b = P(x1, y0), cc = P(x1, y1), d = P(x0, y1);
      for (const auto& [p1, p2] : std::vector<std::pair<std::string, std::string>>{{a, b}, {b, cc}, {cc, d}, {d, a}}) E({{"t", "line"}, {"p1", p1}, {"p2", p2}}, c);
    } else if (s.contains("circle") && s["circle"].is_array()) {
      const O& r = s["circle"];
      if (r.size() < 3) throw std::runtime_error(rang + " : rayon > 0 attendu");
      const double cx = nombre(r[0], "circle"), cy = nombre(r[1], "circle"), ra = nombre(r[2], "circle");
      if (!(ra > 0)) throw std::runtime_error(rang + " : rayon > 0 attendu");
      E({{"t", "circle"}, {"pc", P(cx, cy)}, {"r", ra}}, c);
    } else if (s.contains("poly") && s["poly"].is_array()) {
      const O& q = s["poly"];
      if (q.size() < 3) throw std::runtime_error(rang + " : au moins 3 sommets");
      std::vector<std::string> ids;
      for (const O& p : q) ids.push_back(P(p.at(0), p.at(1)));
      for (size_t i = 0; i < ids.size(); i++) E({{"t", "line"}, {"p1", ids[i]}, {"p2", ids[(i + 1) % ids.size()]}}, c);
    } else if (s.contains("line") && s["line"].is_array()) {
      const O& r = s["line"];
      if (r.size() < 4) throw std::runtime_error(rang + " : rect, circle, poly ou line attendu");
      const std::string a = P(r[0], r[1]), b = P(r[2], r[3]);
      E({{"t", "line"}, {"p1", a}, {"p2", b}}, c);
    } else {
      throw std::runtime_error(rang + " : rect, circle, poly ou line attendu");
    }
  }
  sk["seq"] = n + e + 1;  // la suite des numéros : un trait ajouté ensuite ne reprend pas un nom déjà pris
}

class FenetreScript : public wxDialog {
 public:
  FenetreScript(wxWindow* parent, std::function<std::string(const std::string&)> executer)
      : wxDialog(parent, wxID_ANY, L"📜 Script JSON", wxDefaultPosition, wxDefaultSize, wxDEFAULT_DIALOG_STYLE | wxRESIZE_BORDER), executer_(std::move(executer)) {
    const wxColour FOND = th(wxColour(0x1c, 0x1c, 0x20)), TEXTE = th(wxColour(0xe8, 0xe8, 0xea)), CHAMP = th(wxColour(0x10, 0x10, 0x12));
    SetBackgroundColour(FOND);
    auto* v = new wxBoxSizer(wxVERTICAL);
    auto* note = new wxStaticText(this, wxID_ANY, wxString(L"Liste de commandes {op, …} : ") + OPS + L". Le script est défait en entier à la première erreur ; une seule étape d’annulation.");
    note->SetForegroundColour(TEXTE);
    note->Wrap(FromDIP(620));
    v->Add(note, 0, wxALL, FromDIP(12));
    const wxFont fixe(wxFontInfo(10).Family(wxFONTFAMILY_TELETYPE));
    texte_ = new wxTextCtrl(this, wxID_ANY, wxEmptyString, wxDefaultPosition, FromDIP(wxSize(640, 240)), wxTE_MULTILINE | wxTE_DONTWRAP | wxTE_PROCESS_TAB);
    texte_->SetFont(fixe);
    texte_->SetBackgroundColour(CHAMP);
    texte_->SetForegroundColour(TEXTE);
    wxString memoire;
    wxConfig c(L"ConceptCADNatif");
    if (!c.Read(L"script", &memoire) || memoire.empty())
      memoire = L"[\n {\"op\":\"param\",\"name\":\"L\",\"expr\":\"60\"},\n {\"op\":\"sketch\",\"id\":\"s1\",\"plane\":\"XY\",\"shapes\":[{\"rect\":[0,0,60,40]},{\"circle\":[30,20,6]}]},\n {\"op\":\"extrude\",\"sketch\":\"s1\",\"distance\":10},\n {\"op\":\"info\"}\n]";
    texte_->SetValue(memoire);
    v->Add(texte_, 1, wxEXPAND | wxLEFT | wxRIGHT, FromDIP(12));
    auto* bar = new wxBoxSizer(wxHORIZONTAL);
    auto* run = new wxButton(this, wxID_ANY, L"▶ Exécuter");
    auto* fermer = new wxButton(this, wxID_CANCEL, L"Fermer");
    bar->AddStretchSpacer();
    bar->Add(run, 0, wxRIGHT, FromDIP(8));
    bar->Add(fermer, 0);
    v->Add(bar, 0, wxEXPAND | wxALL, FromDIP(12));
    sortie_ = new wxTextCtrl(this, wxID_ANY, wxEmptyString, wxDefaultPosition, FromDIP(wxSize(640, 170)), wxTE_MULTILINE | wxTE_READONLY | wxTE_DONTWRAP);
    sortie_->SetFont(fixe);
    sortie_->SetBackgroundColour(CHAMP);
    sortie_->SetForegroundColour(TEXTE);
    v->Add(sortie_, 1, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(12));
    SetSizerAndFit(v);
    CentreOnParent();
    run->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) {
      wxConfig k(L"ConceptCADNatif");
      k.Write(L"script", texte_->GetValue());
      k.Flush();
      wxBusyCursor attente;
      sortie_->SetValue(wxString::FromUTF8(executer_(std::string(texte_->GetValue().utf8_str()))));
    });
  }

 private:
  std::function<std::string(const std::string&)> executer_;
  wxTextCtrl* texte_ = nullptr;
  wxTextCtrl* sortie_ = nullptr;
};
}  // namespace

void Cadre::ouvrirScript() {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  FenetreScript f(this, [this](const std::string& t) {
    const nlohmann::ordered_json r = scriptExecuter(t);
    std::string s;
    if (r.value("ok", false)) s = "✓ ";
    else s = "✗ " + (r.contains("at") ? "commande " + std::to_string(r["at"].get<int>()) + " : " : std::string()) + r.value("error", std::string()) + "\n";
    return s + r["results"].dump(1, ' ', false, nlohmann::ordered_json::error_handler_t::replace);
  });
  f.ShowModal();
}

// mfInfo : l'état du document, le volume de chaque corps
nlohmann::ordered_json Cadre::scriptInfo() {
  O out = O::object();
  out["op"] = "info";
  out["name"] = doc_.nom;
  out["sketches"] = O::array();
  for (const Esquisse& s : doc_.esquisses) out["sketches"].push_back({{"id", s.id}, {"name", s.nom}, {"plane", s.plan}});
  out["features"] = O::array();
  for (const Fonction& f : doc_.fonctions) {
    if (!f.repeatId.empty()) continue;
    O o = {{"id", f.id}, {"name", f.nom}, {"type", f.type}};
    if (!f.visible) o["suppressed"] = true;
    out["features"].push_back(std::move(o));
  }
  out["params"] = O::array();
  for (const Parametre& p : doc_.params) {
    O o = {{"name", p.nom}, {"expr", p.expr}, {"value", p.value}};
    if (!p.err.empty()) o["error"] = p.err;
    out["params"].push_back(std::move(o));
  }
  out["configs"] = nullptr;
  if (doc_.configs && doc_.configs->is_object()) {
    O noms = O::array();
    if (doc_.configs->contains("rows"))
      for (const auto& r : (*doc_.configs)["rows"]) noms.push_back(r.value("name", std::string()));
    out["configs"] = {{"active", doc_.configs->contains("active") ? O((*doc_.configs)["active"]) : O()}, {"rows", noms}};
  }
  out["engine"] = "exact";
  out["bodies"] = O::array();
  const O j = documentJson(doc_);
  for (const auto& [id, forme] : formesCorps_) {
    if (forme.IsNull()) continue;
    GProp_GProps g;
    BRepGProp::VolumeProperties(forme, g);
    Bnd_Box b;
    BRepBndLib::AddOptimal(forme, b, false, false);
    b.SetGap(0);
    double a0 = 0, a1 = 0, a2 = 0, b0 = 0, b1 = 0, b2 = 0;
    if (!b.IsVoid()) b.Get(a0, a1, a2, b0, b1, b2);
    const gp_Pnt c = g.CentreOfMass();
    std::string nom = id;
    if (j.contains("bodies"))
      for (const auto& x : j["bodies"])
        if (x.value("id", std::string()) == id) nom = x.value("name", id);
    out["bodies"].push_back({{"id", id},
                             {"name", nom},
                             {"volume", arrondi3(g.Mass())},
                             {"center", {arrondi3(c.X()), arrondi3(c.Y()), arrondi3(c.Z())}},
                             {"box", {{"min", {arrondi3(a0), arrondi3(a1), arrondi3(a2)}}, {"max", {arrondi3(b0), arrondi3(b1), arrondi3(b2)}}}}});
  }
  return out;
}

// mfScriptRun : {ok, results, error?, at?}
nlohmann::ordered_json Cadre::scriptExecuter(const std::string& texte) {
  O res = {{"ok", false}, {"results", O::array()}};
  O cmds;
  try {
    cmds = O::parse(texte);
  } catch (const std::exception& e) {
    res["error"] = std::string("JSON illisible : ") + e.what();
    return res;
  }
  if (cmds.is_object() && cmds.contains("commands") && cmds["commands"].is_array()) cmds = O(cmds["commands"]);
  if (!cmds.is_array()) {
    res["error"] = "liste de commandes attendue";
    return res;
  }
  if (esquisseOuverte_ >= 0) quitterEsquisse();
  const auto avant = std::make_shared<Document>(doc_);
  const size_t u0 = annulations_.size();
  std::map<std::string, std::string> ids;
  bool change = false;
  int at = 0;
  const auto trouver = [&](const O& ref) -> const Esquisse* {
    if (ref.is_null()) return nullptr;
    const std::string r = ref.is_string() ? ref.get<std::string>() : ref.dump();
    const auto i = ids.find(r);
    const std::string id = i != ids.end() ? i->second : r;
    for (const Esquisse& s : doc_.esquisses)
      if (s.id == id) return &s;
    for (const Esquisse& s : doc_.esquisses)
      if (s.nom == r) return &s;
    return nullptr;
  };
  const auto texteDe = [](const O& c, const char* k, const std::string& defaut) {
    if (!c.contains(k) || c[k].is_null()) return defaut;
    return c[k].is_string() ? c[k].get<std::string>() : c[k].dump();
  };
  const auto vrai = [](const O& c, const char* k) { return c.contains(k) && !c[k].is_null() && c[k] != false && c[k] != 0 && c[k] != ""; };
  dynOccupe_++;
  try {
    for (const O& c : cmds) {
      at++;
      const std::string op = c.is_object() && c.contains("op") && c["op"].is_string() ? c["op"].get<std::string>() : std::string();
      if (op == "new") {
        const std::wstring chemin = doc_.chemin;
        doc_ = projetVide();
        doc_.chemin = chemin;
        const std::string nomDoc = texteDe(c, "name", "Script");
        modifierStructure(doc_, [&](O& d) {
          d["name"] = nomDoc;
          if (!d.contains("bodies") || !d["bodies"].is_array() || d["bodies"].empty()) stNouveauCorps(d);
        });
        change = true;
        res["results"].push_back({{"op", "new"}, {"name", doc_.nom}});
      } else if (op == "param") {
        const std::string nom = texteDe(c, "name", "");
        const EtatFormules etatAvant(doc_);
        Parametre* p = nullptr;
        for (Parametre& q : doc_.params)
          if (q.nom == nom) p = &q;
        if (!p) {
          const std::string refus = parControleNom(doc_, nom, nullptr, nullptr, nullptr);
          if (refus.rfind("Nom invalide", 0) == 0) throw std::runtime_error("param : nom invalide");
          if (!refus.empty()) throw std::runtime_error("param : " + refus);
          doc_.params.push_back(Parametre{nom, "0", "", 0, true});
          p = &doc_.params.back();
        }
        const std::string ex = c.contains("expr") && !c["expr"].is_null() ? texteDe(c, "expr", "") : texteDe(c, "value", "");
        std::string refus = parReglerParametre(doc_, *p, ex);
        if (refus.rfind("Expression : ", 0) == 0) refus.erase(0, 13);
        if (!refus.empty()) throw std::runtime_error("param " + nom + " : " + refus);
        if (!appliquerFormules(doc_, etatAvant, -1, nullptr, refus)) throw std::runtime_error("param " + nom + " : " + refus);
        double valeur = 0;
        for (const Parametre& q : doc_.params)
          if (q.nom == nom) valeur = q.value;
        change = true;
        res["results"].push_back({{"op", "param"}, {"name", nom}, {"value", valeur}});
      } else if (op == "sketch") {
        std::string plan = texteDe(c, "plane", "XY");
        std::transform(plan.begin(), plan.end(), plan.begin(), [](unsigned char x) { return static_cast<char>(std::toupper(x)); });
        if (plan != "XY" && plan != "XZ" && plan != "YZ") throw std::runtime_error("sketch : plan XY, XZ ou YZ");
        const Esquisse base = nouvelleEsquissePlan(doc_, plan);
        const std::string nom = texteDe(c, "name", "Esquisse " + std::to_string(doc_.esquisses.size() + 1));
        const double off = c.contains("offset") && !c["offset"].is_null() ? nombre(c["offset"], "offset") : 0;
        O sk = {{"id", base.id}, {"name", nom}, {"plane", plan}, {"entities", O::array()}, {"points", O::object()}, {"constraints", O::array()}, {"dims", O::array()}, {"seq", 1}, {"visible", true}};
        sk["origin"] = {base.n[0] * off, base.n[1] * off, base.n[2] * off};
        sk["axU"] = {base.u[0], base.u[1], base.u[2]};
        sk["axV"] = {base.v[0], base.v[1], base.v[2]};
        sk["axN"] = {base.n[0], base.n[1], base.n[2]};
        if (c.contains("shapes")) formes(sk, c["shapes"]);
        const size_t nbEnt = sk["entities"].size();
        modifierStructure(doc_, [&](O& d) { d["sketches"].push_back(sk); });
        if (c.contains("id") && !c["id"].is_null()) ids[texteDe(c, "id", "")] = base.id;
        change = true;
        res["results"].push_back({{"op", "sketch"}, {"id", base.id}, {"name", nom}, {"entities", nbEnt}});
      } else if (op == "extrude" || op == "revolve") {
        const Esquisse* s = trouver(c.contains("sketch") ? c["sketch"] : O());
        if (!s) throw std::runtime_error(op + " : esquisse « " + texteDe(c, "sketch", "") + " » introuvable");
        const std::string idS = s->id;
        std::string id;
        const bool cut = vrai(c, "cut");
        if (op == "extrude") {
          const double dist = nombre(c.contains("distance") ? c["distance"] : O(), "extrude.distance");
          if (!(std::abs(dist) > 1e-9)) throw std::runtime_error("extrude : distance non nulle attendue");
          modifierStructure(doc_, [&](O& d) {
            id = ajouterFonction(d, {{"type", "extrude"}, {"name", ""}, {"sketchId", idS}, {"distance", dist}, {"op", cut ? "cut" : "add"}, {"visible", true}, {"mid", vrai(c, "symmetric")}, {"upto", nullptr}}, "ex", -1);
            for (auto& x : d["sketches"])
              if (x.value("id", std::string()) == idS) x["visible"] = false;
          });
        } else {
          std::string ax = texteDe(c, "axis", "Z");
          std::transform(ax.begin(), ax.end(), ax.begin(), [](unsigned char x) { return static_cast<char>(std::toupper(x)); });
          if (ax != "X" && ax != "Y" && ax != "Z") throw std::runtime_error("revolve : axe X, Y ou Z");
          const double a = c.contains("angle") && !c["angle"].is_null() ? nombre(c["angle"], "revolve.angle") : 360;
          if (!(a > 0 && a <= 360)) throw std::runtime_error("revolve : angle dans ]0 ; 360]");
          modifierStructure(doc_, [&](O& d) {
            id = ajouterFonction(d, {{"type", "revolve"}, {"name", ""}, {"sketchId", idS}, {"axis", {{"k", "sys"}, {"d", ax}}}, {"angle", a}, {"op", cut ? "cut" : "add"}, {"visible", true}}, "rv", -1);
            for (auto& x : d["sketches"])
              if (x.value("id", std::string()) == idS) x["visible"] = false;
          });
        }
        std::string nom;
        for (Fonction& f : doc_.fonctions)
          if (f.id == id) {
            if (c.contains("name") && !c["name"].is_null()) f.nom = texteDe(c, "name", "");
            else if (op == "extrude") f.nom = nomExtrusion(doc_, f);
            nom = f.nom;
          }
        if (c.contains("id") && !c["id"].is_null()) ids[texteDe(c, "id", "")] = id;
        change = true;
        res["results"].push_back({{"op", op}, {"id", id}, {"name", nom}});
      } else if (op == "config") {
        const std::string nom = texteDe(c, "name", "");
        std::string idL, nomL;
        if (doc_.configs && doc_.configs->contains("rows"))
          for (const auto& r : (*doc_.configs)["rows"])
            if (idL.empty() && (r.value("name", std::string()) == nom || r.value("id", std::string()) == nom)) idL = r.value("id", std::string()), nomL = r.value("name", std::string());
        if (idL.empty()) throw std::runtime_error("config : « " + nom + " » introuvable");
        const auto av = std::make_shared<Document>(doc_);
        const EtatFormules etatAvant(doc_);
        modifierStructure(doc_, [&](O& j) {
          cfgStructureActive(j, idL);
          cfgRanger(j);
        });
        const std::vector<std::string> absents = cfgPoserValeurs(doc_, idL);
        std::string refus;
        if (!appliquerFormules(doc_, etatAvant, -1, nullptr, refus)) throw std::runtime_error("config : " + refus);
        change = true;
        res["results"].push_back({{"op", "config"}, {"name", nomL}});
      } else if (op == "undo") {
        const bool peut = !annulations_.empty();
        if (peut) annuler();
        change = true;
        res["results"].push_back({{"op", "undo"}, {"ok", peut}});
      } else if (op == "info") {
        if (change) {
          recalculer();
          change = false;
        }
        res["results"].push_back(scriptInfo());
      } else {
        throw std::runtime_error("op inconnue (" + (c.is_object() && c.contains("op") ? c["op"].dump() : std::string("null")) + ") — " + OPS);
      }
    }
  } catch (const std::exception& e) {
    dynOccupe_--;
    annulations_.erase(annulations_.begin() + static_cast<std::ptrdiff_t>(std::min(u0, annulations_.size())), annulations_.end());
    poserDocument(avant);
    res["error"] = e.what();
    res["at"] = at;
    return res;
  }
  dynOccupe_--;
  annulations_.erase(annulations_.begin() + static_cast<std::ptrdiff_t>(std::min(u0, annulations_.size())), annulations_.end());
  bool touche = change;
  if (!touche && !cmds.empty()) touche = documentJson(doc_).dump() != documentJson(*avant).dump();
  if (touche) {
    ModifCote m;
    m.docAvant = avant;
    annulations_.push_back(std::move(m));
    retablissements_.clear();
  }
  apresStructure();
  etat(wxString::Format(L"Script : %d commande(s) exécutée(s).", static_cast<int>(cmds.size())));
  res["ok"] = true;
  return res;
}
