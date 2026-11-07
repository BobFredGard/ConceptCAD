// La Dérivée : paramètres et corps venus d'un autre fichier, traduction de src/52-derivee.js. Le fichier écrit est le même que celui du navigateur.
// Le lien va dans un seul sens : la source n'est que lue. Un corps dérivé est une fonction « import » (STEP écrit depuis le solide de la source)
// dans un corps neuf : ce qu'on ajoute ici après lui est gardé et rejoué sur la nouvelle forme.
#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/dialog.h>
#include <wx/filedlg.h>
#include <wx/filename.h>
#include <wx/menu.h>
#include <wx/msgdlg.h>
#include <wx/scrolwin.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/utils.h>

#include <TopLoc_Location.hxx>
#include <filesystem>
#include <fstream>
#include <set>

#include "assemblage.h"
#include "cadre.h"
#include "echanges.h"
#include "enregistrer.h"
#include "fiches.h"
#include "parametres.h"
#include "rejeu.h"
#include "structure.h"

namespace as = assemblage;
namespace fs = std::filesystem;
using J = nlohmann::ordered_json;

namespace {
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
std::string texteDe(const J& j, const char* k) {
  const auto x = j.find(k);
  return x != j.end() && x->is_string() ? x->get<std::string>() : std::string();
}
std::string texteSource(const std::wstring& chemin) {
  std::string b = lireOctets(chemin);
  return b.size() >= 2 && static_cast<unsigned char>(b[0]) == 0x1f && static_cast<unsigned char>(b[1]) == 0x8b ? degonfler(b) : b;
}
void tamponSource(const std::wstring& chemin, long long& date, long long& taille) {
  std::error_code ec;
  const auto t = fs::last_write_time(chemin, ec);
  date = ec ? 0 : t.time_since_epoch().count();
  const auto n = fs::file_size(chemin, ec);
  taille = ec ? -1 : static_cast<long long>(n);
}

// Ce que donne le fichier source
struct CorpsSource {
  std::string cle, nom, bid;
  TopoDS_Shape forme;
  unsigned couleur = 0;
};
struct Source {
  std::vector<CorpsSource> corps;
  std::vector<std::pair<std::string, double>> params;
};

// derReadParams : paramètres libres, cotes et valeurs de fonctions nommées
std::vector<std::pair<std::string, double>> paramsDe(const Document& d) {
  std::vector<std::pair<std::string, double>> L;
  for (const NomPropose& n : parNomsProposes(d, "")) {
    if (n.insere == "pi" || (!n.insere.empty() && n.insere.back() == '(')) continue;
    try {
      const double v = parValeurNom(d, n.insere);
      if (std::isfinite(v)) L.push_back({n.insere, v});
    } catch (const std::exception&) {
    }
  }
  return L;
}

// derTree, derInstances, derBodies : le fichier est rejoué sans rien afficher
Source lireSource(const std::wstring& chemin) {
  Source s;
  Document d = lireProjet(chemin);
  if (!d.assemblage) modifierStructure(d, [](J& j) { as::assurer(j); });
  const ResultatRejeu r = rejouer(d);
  as::Solides S;
  as::majSolides(S, d, r);
  auto a = std::make_shared<J>(*d.assemblage);
  d.assemblage = a;
  as::resoudre(*a, S);
  const std::string racine = as::racine(*a);
  const J* cr = as::composant(*a, racine);
  if (as::actif(*a) == racine || !cr || !cr->contains("doc")) s.params = paramsDe(d);
  else s.params = paramsDe(documentDeComposant((*cr)["doc"], d));
  for (const as::Instance& inst : as::instances(*a, racine)) {
    if (as::cheminMasque(*a, inst.chemin)) continue;
    const auto it = S.find(inst.comp);
    if (it == S.end()) continue;
    const J* cc = as::composant(*a, inst.comp);
    std::string prefixe, tete;
    for (const std::string& oid : inst.chemin) {
      tete += (tete.empty() ? "" : "/") + oid;
      if (const J* o = as::occurrence(*a, oid)) prefixe += texteDe(*o, "name") + " › ";
    }
    gp_Trsf t;
    t.SetValues(inst.F.x[0], inst.F.y[0], inst.F.z[0], inst.F.o[0], inst.F.x[1], inst.F.y[1], inst.F.z[1], inst.F.o[1], inst.F.x[2], inst.F.y[2], inst.F.z[2], inst.F.o[2]);
    for (const auto& [bid, forme] : it->second->corps) {
      if (forme.IsNull()) continue;
      CorpsSource q;
      q.bid = bid;
      q.cle = tete + "#" + bid;
      std::string nom = bid;
      if (cc && cc->contains("doc") && (*cc)["doc"].contains("bodies"))
        for (const J& e : (*cc)["doc"]["bodies"])
          if (texteDe(e, "id") == bid) {
            if (!texteDe(e, "name").empty()) nom = texteDe(e, "name");
            if (e.contains("color") && e["color"].is_number()) q.couleur = e["color"].get<unsigned>();
          }
      // Le composant actif n'a son document que dans le fichier lui-même
      if (inst.comp == as::actif(*a)) {
        const size_t i = std::find(d.corps.begin(), d.corps.end(), bid) - d.corps.begin();
        if (i < d.nomsCorps.size() && !d.nomsCorps[i].empty()) nom = d.nomsCorps[i];
        if (i < d.couleursCorps.size()) q.couleur = d.couleursCorps[i];
      }
      q.nom = prefixe + nom;
      q.forme = inst.chemin.empty() ? forme : forme.Moved(TopLoc_Location(t));
      s.corps.push_back(std::move(q));
    }
  }
  return s;
}

std::string octetsStep(const TopoDS_Shape& forme) {
  static int rang = 0;
  const fs::path p = fs::temp_directory_path() / (L"conceptcad_derive_" + std::to_wstring(wxGetProcessId()) + L"_" + std::to_wstring(++rang) + L".stp");
  exporterStep({forme}, p.wstring(), "AP214", false);
  std::string o = lireOctets(p.wstring());
  std::error_code ec;
  fs::remove(p, ec);
  if (o.empty()) throw std::runtime_error("écriture STEP impossible");
  return o;
}

// derStepSig : sans l'en-tête (date d'écriture) ni le compteur du noyau : même solide, même empreinte
std::string empreinteStep(const std::string& o) {
  const size_t debut = o.find("DATA;");
  std::string t = o.substr(debut == std::string::npos ? o.size() : debut);
  static const std::string M = "STEP translator ";
  for (size_t i = t.find(M); i != std::string::npos; i = t.find(M, i)) {
    size_t k = i + M.size();
    const size_t a = k;
    while (k < t.size() && (std::isdigit(static_cast<unsigned char>(t[k])) || t[k] == '.')) k++;
    if (k == a || k >= t.size() || t[k] != ' ') {
      i++;
      continue;
    }
    const size_t b = ++k;
    while (k < t.size() && std::isdigit(static_cast<unsigned char>(t[k]))) k++;
    if (k == b) {
      i++;
      continue;
    }
    t.erase(i, k - i);
  }
  return as::empreinteTexte(t);
}

std::string nomLibre(const std::set<std::string>& pris, const std::string& nm) {
  if (!pris.count(nm)) return nm;
  int k = 2;
  while (pris.count(nm + "_" + std::to_string(k))) k++;
  return nm + "_" + std::to_string(k);
}
std::set<std::string> nomsPris(const Document& d) {
  std::set<std::string> s;
  for (const NomPropose& n : parNomsProposes(d, ""))
    if (n.insere != "pi" && !n.insere.empty() && n.insere.back() != '(') s.insert(n.insere);
  return s;
}

// derSyncParams : les valeurs de la source ; true si quelque chose a changé
bool reporterParams(J& L, const std::vector<std::pair<std::string, double>>& liste, std::set<std::string>& pris) {
  bool ch = false;
  if (!L.contains("params") || !L["params"].is_array()) L["params"] = J::array();
  for (J& p : L["params"]) {
    const std::string src = texteDe(p, "src");
    const auto it = std::find_if(liste.begin(), liste.end(), [&](const auto& s) { return s.first == src; });
    if (it == liste.end()) {
      if (!p.value("miss", false)) {
        p["miss"] = true;
        ch = true;
      }
      continue;
    }
    if (p.contains("miss")) {
      p.erase("miss");
      ch = true;
    }
    if (std::abs(p.value("value", 0.0) - it->second) > 1e-12) {
      p["value"] = it->second;
      ch = true;
    }
  }
  if (L.value("auto", false))
    for (const auto& s : liste) {
      bool la = false;
      for (const J& p : L["params"]) la = la || texteDe(p, "src") == s.first;
      if (la) continue;
      const std::string nom = nomLibre(pris, s.first);
      pris.insert(nom);
      L["params"].push_back({{"src", s.first}, {"name", nom}, {"value", s.second}});
      ch = true;
    }
  return ch;
}

// derPickDlg
struct ChoixDerive {
  std::vector<std::string> params, corps;
  bool tous = false;
};
bool choisirDerive(wxWindow* parent, const wxString& nom, const Source& s, ChoixDerive& c) {
  const wxColour FOND(0x1c, 0x1c, 0x20), TEXTE(0xe8, 0xe8, 0xea), DISCRET(0xa0, 0xa0, 0xa6);
  wxDialog d(parent, wxID_ANY, L"🔗 Dériver", wxDefaultPosition, wxDefaultSize, wxDEFAULT_DIALOG_STYLE | wxRESIZE_BORDER);
  d.SetBackgroundColour(FOND);
  auto* tout = new wxBoxSizer(wxVERTICAL);
  const auto texte = [&](wxWindow* p, const wxString& t, const wxColour& k) {
    auto* e = new wxStaticText(p, wxID_ANY, t);
    e->SetForegroundColour(k);
    return e;
  };
  auto* intro = texte(&d, L"Depuis " + nom + L". Le lien va dans un seul sens : ce que vous ferez ici ne revient jamais vers ce fichier.", DISCRET);
  intro->Wrap(d.FromDIP(420));
  tout->Add(intro, 0, wxALL, d.FromDIP(12));
  auto* zone = new wxScrolledWindow(&d, wxID_ANY, wxDefaultPosition, d.FromDIP(wxSize(440, 340)), wxVSCROLL);
  zone->SetBackgroundColour(FOND);
  zone->SetScrollRate(0, d.FromDIP(10));
  auto* z = new wxBoxSizer(wxVERTICAL);
  std::vector<wxCheckBox*> P, C;
  const auto rang = [&](const wxString& t, bool oui, std::vector<wxCheckBox*>& L) {
    auto* r = new wxBoxSizer(wxHORIZONTAL);
    auto* k = new wxCheckBox(zone, wxID_ANY, wxEmptyString);
    k->SetValue(oui);
    r->Add(k, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, d.FromDIP(6));
    auto* e = texte(zone, t, TEXTE);
    e->Bind(wxEVT_LEFT_UP, [k](wxMouseEvent&) { k->SetValue(!k->GetValue()); });
    r->Add(e, 1, wxALIGN_CENTER_VERTICAL);
    z->Add(r, 0, wxEXPAND | wxTOP, d.FromDIP(3));
    L.push_back(k);
  };
  if (!s.params.empty()) {
    z->Add(texte(zone, L"Paramètres", TEXTE), 0, wxTOP, d.FromDIP(4));
    for (const auto& p : s.params) {
      std::string v = nombreJsFixe(p.second, 4);
      std::replace(v.begin(), v.end(), '.', ',');
      rang(tx(p.first + " = " + v), true, P);
    }
  }
  if (!s.corps.empty()) {
    z->Add(texte(zone, L"Corps", TEXTE), 0, wxTOP, d.FromDIP(10));
    for (const CorpsSource& k : s.corps) rang(tx(k.nom), false, C);
  }
  if (s.params.empty() && s.corps.empty()) z->Add(texte(zone, L"Ce fichier n'a ni paramètre nommé ni corps à dériver.", TEXTE));
  zone->SetSizer(z);
  zone->FitInside();
  tout->Add(zone, 1, wxEXPAND | wxLEFT | wxRIGHT, d.FromDIP(12));
  auto* bas = new wxBoxSizer(wxHORIZONTAL);
  bas->AddStretchSpacer();
  bas->Add(new wxButton(&d, wxID_CANCEL, L"Annuler"), 0, wxRIGHT, d.FromDIP(8));
  auto* ok = new wxButton(&d, wxID_OK, L"Dériver");
  ok->SetDefault();
  bas->Add(ok);
  tout->Add(bas, 0, wxEXPAND | wxALL, d.FromDIP(12));
  d.SetSizerAndFit(tout);
  d.CentreOnParent();
  for (;;) {
    if (d.ShowModal() != wxID_OK) return false;
    c = ChoixDerive{};
    for (size_t i = 0; i < P.size(); i++)
      if (P[i]->GetValue()) c.params.push_back(s.params[i].first);
    for (size_t i = 0; i < C.size(); i++)
      if (C[i]->GetValue()) c.corps.push_back(s.corps[i].cle);
    c.tous = c.params.size() == s.params.size() && !s.params.empty();
    if (!c.params.empty() || !c.corps.empty()) return true;
  }
}
}  // namespace

std::string Cadre::derInserer(const std::wstring& chemin, const std::vector<std::string>& params, const std::vector<std::string>& corps, bool tous) {
  wxBusyCursor attente;
  const Source s = lireSource(chemin);
  const std::string texte = texteSource(chemin);
  const J ref = asmLienRef(chemin);
  const std::string nomFichier = texteDe(ref, "name");
  // Les corps d'abord : un corps illisible ne laisse rien dans la pièce
  struct Fait {
    const CorpsSource* c;
    std::string cle, sig;
    size_t taille;
  };
  std::vector<Fait> faits;
  std::map<std::string, std::string> sources;
  for (const CorpsSource& c : s.corps) {
    if (std::find(corps.begin(), corps.end(), c.cle) == corps.end()) continue;
    const std::string o = octetsStep(c.forme);
    const std::string k = cleImport(o);
    sources[k] = base64Coder(o);
    faits.push_back({&c, k, empreinteStep(o), o.size()});
  }
  std::error_code ec;
  std::string lienExistant;
  for (const std::string& t : doc_.derivesJson) {
    const J L = J::parse(t);
    std::string pourquoi;
    const std::wstring ch = asmLienChemin(L, pourquoi);
    if (!ch.empty() && fs::equivalent(fs::path(ch), fs::path(chemin), ec)) lienExistant = texteDe(L, "id");
  }
  std::set<std::string> pris = nomsPris(doc_);
  auto avant = std::make_shared<Document>(doc_);
  const int marque = indiceMarque();
  size_t nCorps = 0, nParams = 0;
  std::string idLien = lienExistant;
  try {
    modifierStructure(doc_, [&](J& d) {
      if (!d.contains("derive") || !d["derive"].is_array()) d["derive"] = J::array();
      J* L = nullptr;
      for (J& q : d["derive"])
        if (texteDe(q, "id") == lienExistant && !lienExistant.empty()) L = &q;
      if (!L) {
        for (int k = 1;; k++) {
          idLien = "dv_nat" + std::to_string(k);
          bool pris2 = false;
          for (const J& q : d["derive"]) pris2 = pris2 || texteDe(q, "id") == idLien;
          if (!pris2) break;
        }
        J n = J::object();
        n["id"] = idLien;
        n["rel"] = ref["rel"];
        n["key"] = ref["key"];
        n["path"] = ref["path"];
        n["name"] = nomFichier;
        n["sig"] = "";
        n["auto"] = tous;
        n["params"] = J::array();
        d["derive"].push_back(std::move(n));
        L = &d["derive"].back();
      } else if (tous) (*L)["auto"] = true;
      for (const std::string& nm : params) {
        bool la = false;
        for (const J& p : (*L)["params"]) la = la || texteDe(p, "src") == nm;
        const auto it = std::find_if(s.params.begin(), s.params.end(), [&](const auto& q) { return q.first == nm; });
        if (la || it == s.params.end()) continue;
        const std::string nom = nomLibre(pris, nm);
        pris.insert(nom);
        (*L)["params"].push_back({{"src", nm}, {"name", nom}, {"value", it->second}});
      }
      reporterParams(*L, s.params, pris);
      (*L)["sig"] = as::empreinteTexte(texte);
      nParams = (*L)["params"].size();
      if (!d.contains("bodies") || !d["bodies"].is_array()) d["bodies"] = J::array();
      for (const Fait& f : faits) {
        int seq = d.value("bodySeq", 0);
        if (seq < 1) {
          seq = 1;
          for (const J& b : d["bodies"]) {
            const std::string id = texteDe(b, "id");
            if (id.size() > 1 && id[0] == 'b') seq = std::max(seq, std::atoi(id.c_str() + 1) + 1);
          }
        }
        d["bodySeq"] = seq + 1;
        const std::string bid = "b" + std::to_string(seq);
        const size_t cran = f.c->nom.rfind(" › ");
        const std::string base = cran == std::string::npos ? f.c->nom : f.c->nom.substr(cran + 5);
        J fiche = {{"id", bid}, {"name", base}, {"c", nullptr}, {"open", true}};
        if (f.c->couleur > 0) fiche["color"] = f.c->couleur;
        d["bodies"].push_back(std::move(fiche));
        J nf = J::object();
        nf["type"] = "import";
        nf["name"] = base + " (dérivé)";
        nf["visible"] = true;
        nf["body"] = bid;
        nf["src"] = {{"fmt", "step"}, {"key", f.cle}, {"size", f.taille}, {"file", nomFichier}, {"sig", f.sig}};
        nf["derive"] = {{"lk", idLien}, {"key", f.c->cle}, {"name", f.c->nom}};
        ajouterFonction(d, std::move(nf), "im", marque);
        nCorps++;
      }
    }, sources);
  } catch (const std::exception&) {
    doc_ = *avant;
    throw;
  }
  ModifCote m;
  m.docAvant = avant;
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  ajusterVue_ = forme_.IsNull();
  apresStructure();
  remplirArbre();
  long long dt, tl;
  tamponSource(chemin, dt, tl);
  EtatLien& E = derEtat_[idLien];
  E = EtatLien{};
  E.date = dt;
  E.taille = tl;
  E.sigVue = as::empreinteTexte(texte);
  wxString m2 = L"Dérivé de " + tx(nomFichier) + wxString::Format(L" : %d paramètre(s), %d corps.", static_cast<int>(nParams), static_cast<int>(nCorps));
  if (nCorps) m2 += L" Pour soustraire : Combiner → Soustraction, avec ce corps comme outil.";
  etat(m2);
  return idLien;
}

void Cadre::derCommande() {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  if (esquisseOuverte_ >= 0) return etat(L"Fermez d'abord l'esquisse.");
  wxFileDialog choix(this, L"Dériver depuis un fichier", wxEmptyString, wxEmptyString, L"Projets ConceptCAD (*.conceptcad;*.gz)|*.conceptcad;*.gz", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
  if (choix.ShowModal() != wxID_OK) return;
  const std::wstring chemin = choix.GetPath().ToStdWstring();
  std::error_code ec;
  if (!doc_.chemin.empty() && fs::equivalent(fs::path(chemin), fs::path(doc_.chemin), ec)) {
    wxMessageBox(L"Un fichier ne peut pas dériver de lui-même.", L"Dériver", wxOK | wxICON_WARNING, this);
    return;
  }
  try {
    Source s;
    {
      wxBusyCursor attente;
      s = lireSource(chemin);
    }
    ChoixDerive c;
    if (!choisirDerive(this, wxFileName(chemin).GetFullName(), s, c)) return;
    derInserer(chemin, c.params, c.corps, c.tous);
  } catch (const std::exception& e) {
    wxMessageBox(L"Dérivée impossible : " + tx(e.what()), L"Dériver", wxOK | wxICON_WARNING, this);
  }
}

// derCheck : la source a-t-elle changé ? Paramètres et corps suivent, les fonctions ajoutées ici sont rejouées dessus.
std::vector<std::string> Cadre::derVerifier(bool demander) {
  std::vector<std::string> misAJour;
  if (derOccupe_ || !docOuvert_) return misAJour;
  derOccupe_ = true;
  struct Lien {
    std::string comp;  // vide : le composant actif
    J L;
    std::wstring chemin;
    std::string texte, h;
  };
  std::vector<Lien> lus;
  const auto voir = [&](const std::string& comp, const J& L) {
    EtatLien& E = derEtat_[texteDe(L, "id")];
    std::string pourquoi;
    const std::wstring chemin = asmLienChemin(L, pourquoi);
    if (chemin.empty()) {
      E.alerte = true;
      E.message = pourquoi;
      return;
    }
    long long d, t;
    tamponSource(chemin, d, t);
    const std::string sig = texteDe(L, "sig");
    if (!E.alerte && d == E.date && t == E.taille && E.sigVue == sig) return;
    std::string texte;
    try {
      texte = texteSource(chemin);
    } catch (const std::exception&) {
      E.alerte = true;
      E.message = "lecture impossible";
      return;
    }
    const std::string h = as::empreinteTexte(texte);
    E.date = d;
    E.taille = t;
    if (h == sig) {
      E.alerte = !texteDe(L, "cw").empty();
      E.message = texteDe(L, "cw");
      E.sigVue = sig;
      return;
    }
    lus.push_back({comp, L, chemin, std::move(texte), h});
  };
  for (const std::string& t : doc_.derivesJson) voir("", J::parse(t));
  if (doc_.assemblage && doc_.assemblage->contains("comps")) {
    const std::string act = as::actif(*doc_.assemblage);
    for (const J& c : (*doc_.assemblage)["comps"]) {
      const std::string id = texteDe(c, "id");
      // Un composant lié a son propre fichier : c'est à l'ouverture de celui-ci que ses dérivées se mettent à jour
      if (id == act || (c.contains("link") && c["link"].is_object()) || !texteDe(c, "of").empty() || !c.contains("doc") || !c["doc"].contains("derive") || !c["doc"]["derive"].is_array()) continue;
      for (const J& L : c["doc"]["derive"]) voir(id, L);
    }
  }
  if (!lus.empty()) {
    wxBusyCursor attente;
    Document copie = doc_;
    J racine;
    const std::shared_ptr<const J> resolu = doc_.assemblage;
    modifierStructure(copie, [&](J& j) {
      if (resolu) j["asm"] = *resolu;
      racine = j;
    });
    std::map<std::string, std::string> sources;
    bool change = false;
    for (const Lien& k : lus) {
      EtatLien& E = derEtat_[texteDe(k.L, "id")];
      J* d = &racine;
      if (!k.comp.empty()) {
        J* c = as::composant(racine["asm"], k.comp);
        if (!c) continue;
        d = &(*c)["doc"];
      }
      J* L = nullptr;
      for (J& q : (*d)["derive"])
        if (texteDe(q, "id") == texteDe(k.L, "id")) L = &q;
      if (!L) continue;
      try {
        const Source s = lireSource(k.chemin);
        std::set<std::string> pris;
        if (k.comp.empty()) pris = nomsPris(doc_);
        else if (const J* c = as::composant(*resolu, k.comp)) pris = nomsPris(documentDeComposant((*c)["doc"], doc_));
        bool ch = reporterParams(*L, s.params, pris);
        std::vector<std::string> perdus;
        if (d->contains("features"))
          for (J& f : (*d)["features"]) {
            if (!f.is_object() || !f.contains("derive") || texteDe(f["derive"], "lk") != texteDe(*L, "id")) continue;
            const std::string cle = texteDe(f["derive"], "key");
            const auto it = std::find_if(s.corps.begin(), s.corps.end(), [&](const CorpsSource& c) { return c.cle == cle; });
            if (it == s.corps.end()) {
              const std::string nm = texteDe(f["derive"], "name");
              perdus.push_back(nm.empty() ? texteDe(f, "name") : nm);
              continue;
            }
            const std::string o = octetsStep(it->forme);
            const std::string sig = empreinteStep(o);
            if (f.contains("src") && texteDe(f["src"], "sig") == sig) continue;
            const std::string kk = cleImport(o);
            sources[kk] = base64Coder(o);
            f["src"] = {{"fmt", "step"}, {"key", kk}, {"size", o.size()}, {"file", texteDe(*L, "name")}, {"sig", sig}};
            ch = true;
          }
        (*L)["sig"] = k.h;
        std::string cw;
        if (!perdus.empty()) {
          cw = "corps disparu(s) de la source : ";
          for (size_t i = 0; i < perdus.size(); i++) cw += (i ? ", " : "") + perdus[i];
          cw += " (dernière forme gardée)";
        }
        std::string manquants;
        for (const J& p : (*L)["params"])
          if (p.value("miss", false)) manquants += (manquants.empty() ? "" : ", ") + texteDe(p, "src");
        if (!manquants.empty()) cw += (cw.empty() ? "" : " ; ") + std::string("paramètre(s) disparu(s) de la source : ") + manquants + " (dernière valeur gardée)";
        if (cw.empty()) L->erase("cw");
        else (*L)["cw"] = cw;
        E.alerte = !cw.empty();
        E.message = cw;
        E.sigVue = k.h;
        change = true;
        if (ch) misAJour.push_back(texteDe(*L, "name"));
      } catch (const Standard_Failure& e) {
        E.alerte = true;
        E.message = e.what();
      } catch (const std::exception& e) {
        E.alerte = true;
        E.message = e.what();
      }
    }
    if (change) {
      try {
        modifierStructure(doc_, [&](J& j) { j = racine; }, sources);
        if (!misAJour.empty()) {
          // Géométrie remplacée depuis le disque : les annulations qui la citaient ne valent plus
          annulations_.clear();
          retablissements_.clear();
        }
        apresStructure();
        remplirArbre();
      } catch (const std::exception& e) {
        etat(L"Dérivée : " + tx(e.what()));
      }
    }
    if (!misAJour.empty()) {
      std::set<std::string> vus;
      wxString t;
      for (const std::string& n : misAJour)
        if (vus.insert(n).second) t += (t.empty() ? L"" : L", ") + tx(n);
      etat(L"Dérivée mise à jour depuis : " + t + L".");
    }
  }
  derOccupe_ = false;
  if (demander && misAJour.empty()) {
    // Clic sur 🔄 sans mise à jour possible : la raison, et de quoi la lever
    for (const std::string& t : doc_.derivesJson) {
      const J L = J::parse(t);
      const std::string id = texteDe(L, "id");
      const EtatLien& E = derEtat_[id];
      if (!E.alerte || essaiMenu_) continue;
      wxMessageDialog q(this, L"« " + tx(texteDe(L, "name")) + L" » : " + tx(E.message), L"Dérivée à vérifier", wxYES_NO | wxICON_WARNING);
      q.SetYesNoLabels(L"Désigner le fichier source…", L"Fermer");
      if (q.ShowModal() == wxID_YES) derRelier(id);
    }
  }
  return misAJour;
}

// derRelink : source déplacée ou renommée
void Cadre::derRelier(const std::string& idLien, std::wstring chemin) {
  if (chemin.empty()) {
    wxFileDialog d(this, L"Désigner le fichier source", wxEmptyString, wxEmptyString, L"Projets ConceptCAD (*.conceptcad;*.gz)|*.conceptcad;*.gz", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
    if (d.ShowModal() != wxID_OK) return;
    chemin = d.GetPath().ToStdWstring();
  }
  const J ref = asmLienRef(chemin);
  changerStructure([&](J& d) {
    if (!d.contains("derive")) return;
    for (J& L : d["derive"])
      if (texteDe(L, "id") == idLien) {
        for (const char* k : {"rel", "key", "path", "name"}) L[k] = ref[k];
        L["sig"] = "";
      }
  });
  derEtat_.erase(idLien);
  derVerifier(false);
}

// derBreak : les valeurs deviennent des paramètres d'ici, les corps gardent leur forme actuelle
void Cadre::derRompre(const std::string& idLien) {
  std::string nom;
  changerStructure([&](J& d) {
    if (!d.contains("derive") || !d["derive"].is_array()) return;
    J garde = J::array();
    for (J& L : d["derive"]) {
      if (texteDe(L, "id") != idLien) {
        garde.push_back(L);
        continue;
      }
      nom = texteDe(L, "name");
      if (!d.contains("params") || !d["params"].is_array()) d["params"] = J::array();
      if (L.contains("params"))
        for (const J& p : L["params"]) d["params"].push_back({{"name", texteDe(p, "name")}, {"expr", nombreJs(p.value("value", 0.0))}, {"value", p.value("value", 0.0)}});
    }
    d["derive"] = std::move(garde);
    if (d.contains("features"))
      for (J& f : d["features"])
        if (f.is_object() && f.contains("derive") && texteDe(f["derive"], "lk") == idLien) f.erase("derive");
  }, L"Ctrl+Z : annuler.");
  derEtat_.erase(idLien);
  remplirArbre();
}

// La section « Dérivées » de la liste ƒx : un menu, à côté de « + Paramètre »
void Cadre::derMenu(wxWindow* ou) {
  wxMenu m;
  enum { AJOUT = wxID_HIGHEST + 7400, BASE = wxID_HIGHEST + 7401 };
  std::vector<J> liens;
  for (const std::string& t : doc_.derivesJson) liens.push_back(J::parse(t));
  for (size_t i = 0; i < liens.size(); i++) {
    const J& L = liens[i];
    const EtatLien& E = derEtat_[texteDe(L, "id")];
    const std::string rel = texteDe(L, "rel");
    wxString t = tx(rel.empty() ? texteDe(L, "name") : rel);
    if (E.alerte) t = L"⚠ " + t + L" — " + tx(E.message);
    auto* s = new wxMenu;
    s->Append(BASE + static_cast<int>(i) * 3, L"🔄 Vérifier maintenant");
    s->Append(BASE + static_cast<int>(i) * 3 + 1, L"🔗 Désigner le fichier source…");
    s->Append(BASE + static_cast<int>(i) * 3 + 2, L"✂ Rompre : les valeurs deviennent des paramètres d'ici, les corps gardent leur forme");
    t.Replace(L"&", L"&&");
    m.AppendSubMenu(s, t);
  }
  if (!liens.empty()) m.AppendSeparator();
  m.Append(AJOUT, L"+ Dériver depuis un fichier…");
  const int id = ou->GetPopupMenuSelectionFromUser(m);
  if (id == wxID_NONE) return;
  if (id == AJOUT) return derCommande();
  const int k = id - BASE, i = k / 3;
  if (k < 0 || i >= static_cast<int>(liens.size())) return;
  const std::string lien = texteDe(liens[i], "id");
  if (k % 3 == 0) derVerifier(true);
  else if (k % 3 == 1) derRelier(lien);
  else derRompre(lien);
}

// derProps : la fiche d'un corps dérivé
void Cadre::derFiche(const J& f, std::vector<ChampFiche>& champs, std::vector<std::pair<wxString, std::function<void()>>>& boutons) {
  if (!f.contains("derive") || !f["derive"].is_object()) return;
  const std::string lk = texteDe(f["derive"], "lk");
  std::string nomLien = "?";
  bool trouve = false;
  for (const std::string& t : doc_.derivesJson) {
    const J L = J::parse(t);
    if (texteDe(L, "id") == lk) {
      nomLien = texteDe(L, "name");
      trouve = true;
    }
  }
  const auto ligne = [&](const std::string& titre, const std::string& texte) {
    ChampFiche c;
    c.sorte = ChampFiche::LECTURE;
    c.titre = titre;
    c.texte = texte;
    c.categorie = "🔗 Dérivée";
    champs.push_back(c);
  };
  ligne("Dérivé de", nomLien);
  ligne("Corps", texteDe(f["derive"], "name"));
  ligne("Suit la source", "les fonctions ajoutées ici à ce corps sont gardées");
  const auto it = derEtat_.find(lk);
  if (it != derEtat_.end() && it->second.alerte) ligne("⚠", it->second.message.empty() ? "non vérifiée" : it->second.message);
  if (!trouve) return;
  boutons.push_back({L"🔄 Mettre à jour", [this] { derVerifier(true); }});
  boutons.push_back({L"✂ Rompre le lien", [this, lk] { derRompre(lk); }});
}
