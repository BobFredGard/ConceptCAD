// Les composants liés à un fichier : traduction de src/47-composants-lies.js.
// Le fichier hôte garde une copie, la source fait foi : vérifiée à l'ouverture et au retour sur la fenêtre, réécrite à l'enregistrement si on l'a modifiée ici.
// Dans link : rel (le chemin dans le dossier de projets du navigateur) est cherché depuis le dossier du fichier hôte en remontant ; path (ajouté ici) est le chemin complet sur ce PC.
#include <wx/filedlg.h>
#include <wx/filename.h>
#include <wx/msgdlg.h>

#include <chrono>
#include <filesystem>

#include "assemblage.h"
#include "cadre.h"
#include "enregistrer.h"

namespace as = assemblage;
namespace fs = std::filesystem;
using J = nlohmann::ordered_json;

namespace {
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
std::string texteDe(const J& j, const char* k) {
  const auto x = j.find(k);
  return x != j.end() && x->is_string() ? x->get<std::string>() : std::string();
}
std::string texteFichier(const std::wstring& chemin, bool* compresse = nullptr) {
  std::string b = lireOctets(chemin);
  const bool gz = b.size() >= 2 && static_cast<unsigned char>(b[0]) == 0x1f && static_cast<unsigned char>(b[1]) == 0x8b;
  if (compresse) *compresse = gz;
  return gz ? degonfler(b) : b;
}
void tampon(const std::wstring& chemin, long long& date, long long& taille) {
  std::error_code ec;
  const auto t = fs::last_write_time(chemin, ec);
  date = ec ? 0 : t.time_since_epoch().count();
  const auto n = fs::file_size(chemin, ec);
  taille = ec ? -1 : static_cast<long long>(n);
}
std::string haveHash(const J& haut, const std::string& cid) {
  return as::empreinteTexte(as::sousArbreLien(haut, cid).dump(-1, ' ', false, J::error_handler_t::replace));
}
J racineLue(const std::string& texte, J& top) {
  J b = J::parse(texte);
  top = b.contains("doc") && b["doc"].is_object() ? b["doc"] : b;
  if (!top.contains("features") || !top["features"].is_array()) throw std::runtime_error("ce n'est pas un projet ConceptCAD");
  return b;
}
}  // namespace

J Cadre::asmDocComplet() const {
  Document copie = doc_;
  J out;
  const J resolu = *doc_.assemblage;
  modifierStructure(copie, [&](J& j) {
    j["asm"] = resolu;
    out = j;
  });
  return out;
}

std::vector<std::string> Cadre::asmLies() const {
  std::vector<std::string> r;
  if (!doc_.assemblage || !doc_.assemblage->contains("comps")) return r;
  for (const J& c : (*doc_.assemblage)["comps"])
    if (c.contains("link") && c["link"].is_object()) r.push_back(texteDe(c, "id"));
  return r;
}

bool Cadre::asmLienSale(const std::string& cid) {
  if (!doc_.assemblage) return false;
  const J& a = *doc_.assemblage;
  const J* c = as::composant(a, cid);
  if (!c || !c->contains("link") || !(*c)["link"].is_object()) return false;
  if ((*c)["link"].value("pend", false)) return true;
  // Sans le document du haut si le composant actif n'en fait pas partie
  const std::vector<std::string> mem = as::membresLien(a, cid);
  const bool actifDedans = std::find(mem.begin(), mem.end(), as::actif(a)) != mem.end();
  std::string h;
  if (actifDedans) h = haveHash(asmDocComplet(), cid);
  else {
    J haut = J::object();
    haut["asm"] = a;
    h = haveHash(haut, cid);
  }
  const auto it = asmLiensBase_.find(cid);
  if (it == asmLiensBase_.end()) {
    asmLiensBase_[cid] = h;  // la première fois : la référence
    return false;
  }
  return it->second != h;
}

void Cadre::asmLiensRefBase(const std::vector<std::string>& L) {
  if (!doc_.assemblage || L.empty()) return;
  const J haut = asmDocComplet();
  for (const std::string& cid : L)
    if (as::composant(haut["asm"], cid)) asmLiensBase_[cid] = haveHash(haut, cid);
}

// Où est la source sur ce PC : rel depuis le dossier du fichier hôte en remontant, sinon le chemin complet
std::wstring Cadre::asmLienChemin(const J& link, std::string& pourquoi) const {
  std::error_code ec;
  const std::string rel = texteDe(link, "rel"), complet = texteDe(link, "path");
  const auto essai = [&](const fs::path& p) -> std::wstring {
    if (fs::is_regular_file(p, ec)) return p.wstring();
    // Source renommée « x.conceptcad.gz » ↔ « x.conceptcad » : même fichier
    fs::path q = p;
    if (q.extension() == L".gz") q.replace_extension();
    else q += L".gz";
    return fs::is_regular_file(q, ec) ? q.wstring() : std::wstring();
  };
  if (!rel.empty() && !doc_.chemin.empty()) {
    const fs::path r = fs::u8path(rel);
    for (fs::path d = fs::path(doc_.chemin).parent_path();; d = d.parent_path()) {
      const std::wstring t = essai(d / r);
      if (!t.empty()) return t;
      if (d == d.parent_path()) break;
    }
  }
  if (!complet.empty()) {
    const std::wstring t = essai(fs::u8path(complet));
    if (!t.empty()) return t;
  }
  if (!rel.empty()) pourquoi = "source introuvable : " + rel;
  else if (!complet.empty()) pourquoi = "source introuvable : " + complet;
  else pourquoi = "source inconnue sur ce PC (lien créé hors du dossier de projets) : désignez le fichier";
  return L"";
}

// asmLinkRef : le chemin à partir du dossier commun avec le fichier hôte, et le chemin complet
J Cadre::asmLienRef(const std::wstring& chemin) const {
  J l = J::object();
  const fs::path s = fs::absolute(fs::path(chemin));
  J rel;
  if (!doc_.chemin.empty()) {
    const fs::path h = fs::absolute(fs::path(doc_.chemin)).parent_path();
    fs::path commun;
    auto a = h.begin();
    auto b = s.begin();
    for (; a != h.end() && b != s.end() && _wcsicmp(a->c_str(), b->c_str()) == 0; ++a, ++b) commun /= *a;
    if (commun != commun.root_path() && !commun.empty()) rel = fs::relative(s, commun).generic_u8string();
  }
  l["rel"] = rel;
  l["key"] = nullptr;
  l["path"] = s.u8string();
  l["name"] = s.filename().u8string();
  l["sig"] = "";
  l["map"] = J::object();
  l["srcRoot"] = nullptr;
  return l;
}

// asmLinkText : l'enveloppe de la source (trajectoires, imports) est gardée
std::string Cadre::asmLienTexte(const J& haut, const std::string& cid, const std::string& cur) const {
  J top = as::sousArbreLien(haut, cid);
  if (!cur.empty()) {
    try {
      J b = J::parse(cur);
      if (b.value("bundle", 0) == 1 && b.contains("doc")) {
        b["doc"] = std::move(top);
        b["at"] = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
        b["name"] = b["doc"].value("name", std::string());
        return b.dump(-1, ' ', false, J::error_handler_t::replace);
      }
    } catch (const std::exception&) {
    }
  }
  // Une source neuve : les sources d'import du fichier hôte que ses fonctions utilisent partent avec elle
  try {
    const std::string texte = !doc_.texteBase.empty() ? doc_.texteBase.str() : texteDuFichier(doc_);
    const J r = J::parse(texte);
    if (r.contains("imports") && r["imports"].is_object() && !r["imports"].empty()) {
      const std::string d = top.dump(-1, ' ', false, J::error_handler_t::replace);
      J im = J::object();
      for (auto it = r["imports"].begin(); it != r["imports"].end(); ++it)
        if (d.find(it.key()) != std::string::npos) im[it.key()] = it.value();
      if (!im.empty()) {
        J b = {{"app", "ConceptCAD"}, {"bundle", 1}, {"v", 1}, {"name", top.value("name", std::string())}};
        b["doc"] = std::move(top);
        b["nMoves"] = 0;
        b["moves"] = J::object();
        b["imports"] = std::move(im);
        return b.dump(-1, ' ', false, J::error_handler_t::replace);
      }
    }
  } catch (const std::exception&) {
  }
  return top.dump(2, ' ', false, J::error_handler_t::replace);
}

// asmLinksCheck
void Cadre::asmLiensVerifier(bool demander) {
  if (asmLiensOccupe_ || !doc_.assemblage) return;
  const std::vector<std::string> L0 = asmLies();
  if (L0.empty()) return;
  asmLiensOccupe_ = true;
  std::vector<std::string> misAJour, alertes, rompus, gardes;
  struct Charge {
    std::string cid, texte, sig;
    J top, racine;
  };
  std::vector<Charge> charges;
  std::map<std::string, std::string> nomsVus;
  for (const std::string& cid : L0) {
    const J* c = as::composant(*doc_.assemblage, cid);
    if (!c) continue;
    const J link = (*c)["link"];
    const std::string nom = texteDe(*c, "name");
    nomsVus[cid] = nom;
    EtatLien& E = asmLiensEtat_[cid];
    std::string pourquoi;
    const std::wstring chemin = asmLienChemin(link, pourquoi);
    if (chemin.empty()) {
      E.alerte = true;
      E.message = pourquoi;
      alertes.push_back(nom);
      continue;
    }
    long long d, t;
    tampon(chemin, d, t);
    const std::string sig = texteDe(link, "sig");
    if (d == E.date && t == E.taille && E.sigVue == sig && !E.alerte) continue;
    std::string texte;
    try {
      texte = texteFichier(chemin);
    } catch (const std::exception&) {
      E.alerte = true;
      E.message = "lecture impossible";
      alertes.push_back(nom);
      continue;
    }
    const std::string h = as::empreinteTexte(texte);
    E.date = d;
    E.taille = t;
    if (h == sig) {
      E.alerte = false;
      E.message.clear();
      E.sigVue = sig;
      continue;
    }
    std::string choix = "theirs";
    if (asmLienSale(cid)) {
      if (essaiMenu_) choix = essaiChoix_.empty() ? "mine" : essaiChoix_;
      else {
        wxMessageDialog q(this, L"« " + tx(nom) + L" » a changé sur le disque ET ici.\nGarder vos modifications (la source sera écrasée au prochain enregistrement), prendre la source (vos modifications sont perdues), ou rompre le lien ?", L"Composant lié", wxYES_NO | wxCANCEL | wxYES_DEFAULT | wxICON_QUESTION);
        q.SetYesNoCancelLabels(L"Garder les miennes", L"Prendre la source", L"Rompre le lien");
        const int r = q.ShowModal();
        choix = r == wxID_YES ? "mine" : r == wxID_NO ? "theirs" : "break";
      }
    }
    if (choix == "mine") {
      gardes.push_back(cid);
      E.sigVue = h;
      nomsVus[cid + "#sig"] = h;
    } else if (choix == "break") rompus.push_back(cid);
    else {
      try {
        Charge k;
        k.cid = cid;
        k.sig = h;
        k.racine = racineLue(texte, k.top);
        charges.push_back(std::move(k));
        E.sigVue = h;
      } catch (const std::exception& e) {
        E.alerte = true;
        E.message = e.what();
        alertes.push_back(nom);
      }
    }
  }
  if (!charges.empty() || !gardes.empty() || !rompus.empty()) {
    for (const Charge& k : charges) asmAjouterSources(k.racine);
    faireSuivre();
    changerStructure([&](J& d) {
      d["asm"] = *doc_.assemblage;
      for (const Charge& k : charges) {
        as::chargerLien(d, k.cid, k.top, k.sig);
        misAJour.push_back(nomsVus[k.cid]);
      }
      for (const std::string& cid : gardes) {
        J& lk = (*as::composant(d["asm"], cid))["link"];
        lk["sig"] = nomsVus[cid + "#sig"];
        lk["pend"] = true;
      }
      for (const std::string& cid : rompus) {
        (*as::composant(d["asm"], cid))["link"] = nullptr;
        for (J& c : d["asm"]["comps"])
          if (texteDe(c, "of") == cid) c.erase("of");
      }
    });
    if (!charges.empty()) {
      // Contenu remplacé depuis le disque : les annulations qui le citaient ne valent plus
      annulations_.clear();
      retablissements_.clear();
      std::vector<std::string> ids;
      for (const Charge& k : charges) {
        ids.push_back(k.cid);
        asmLiensEtat_[k.cid].alerte = false;
        asmLiensEtat_[k.cid].message.clear();
      }
      asmLiensRefBase(ids);
    }
    for (const std::string& cid : rompus) asmLiensEtat_.erase(cid);
  }
  asmLiensOccupe_ = false;
  remplirArbre();
  const auto liste = [](const std::vector<std::string>& v) {
    wxString m;
    for (const std::string& n : v) m += (m.empty() ? L"" : L", ") + tx(n);
    return m;
  };
  if (!misAJour.empty()) etat(L"Mis à jour depuis le disque : " + liste(misAJour) + L".");
  else if (!alertes.empty() && demander) etat(L"Liens non vérifiés : " + liste(alertes) + L".");
  else if (demander) etat(L"Liens vérifiés : les sources n'ont pas changé.");
  // asmLinksWarnAsk : la raison, et de quoi la lever
  if (demander && !alertes.empty() && misAJour.empty() && !essaiMenu_) {
    wxString txt = L"Composants liés non mis à jour :\n";
    std::vector<std::string> W;
    for (const std::string& cid : L0) {
      const auto it = asmLiensEtat_.find(cid);
      if (it == asmLiensEtat_.end() || !it->second.alerte) continue;
      W.push_back(cid);
      txt += L"• " + tx(nomsVus[cid]) + L" : " + tx(it->second.message) + L"\n";
    }
    wxMessageDialog q(this, txt + L"\nDésigner les fichiers sources ?", L"Composants liés", wxYES_NO | wxYES_DEFAULT | wxICON_WARNING);
    q.SetYesNoLabels(L"Désigner les fichiers sources…", L"Fermer");
    if (q.ShowModal() == wxID_YES)
      for (const std::string& cid : W) asmLienRelier(cid);
  }
}

void Cadre::asmLiensFenetreActive() {
  if (!docOuvert_ || !doc_.assemblage || essaiMenu_ || asmLiensOccupe_ || esquisseOuverte_ >= 0 || asmAlign_ || asmPatEd_ || asmLies().empty()) return;
  asmLiensVerifier(false);
}

// asmCmdRelink : source déplacée ou renommée
void Cadre::asmLienRelier(const std::string& cid, std::wstring chemin) {
  if (!doc_.assemblage) return;
  const J* c = as::composant(*doc_.assemblage, cid);
  if (!c) return;
  if (chemin.empty()) {
    wxFileDialog d(this, L"Désigner le fichier source de « " + tx(texteDe(*c, "name")) + L" »", wxEmptyString, wxEmptyString, L"Projets ConceptCAD (*.conceptcad;*.gz)|*.conceptcad;*.gz", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
    if (d.ShowModal() != wxID_OK) return;
    chemin = d.GetPath().ToStdWstring();
  }
  std::string texte;
  J top, racine;
  try {
    texte = texteFichier(chemin);
    racine = racineLue(texte, top);
  } catch (const std::exception& e) {
    if (!essaiMenu_) wxMessageBox(tx(e.what()), L"Lecture impossible", wxOK | wxICON_WARNING, this);
    return;
  }
  const J ref = asmLienRef(chemin);
  const std::string h = as::empreinteTexte(texte);
  const bool charger = h != texteDe((*c)["link"], "sig") && !asmLienSale(cid);
  const std::string nom = texteDe(*c, "name");
  if (charger) asmAjouterSources(racine);
  faireSuivre();
  changerStructure([&](J& d) {
    d["asm"] = *doc_.assemblage;
    J& lk = (*as::composant(d["asm"], cid))["link"];
    for (const char* k : {"rel", "key", "path", "name"}) lk[k] = ref[k];
    if (charger) as::chargerLien(d, cid, top, h);
  });
  asmLiensEtat_[cid] = EtatLien{};
  if (charger) asmLiensRefBase({cid});
  remplirArbre();
  etat(L"« " + tx(nom) + L" » relié à " + wxString(chemin) + L".");
}

void Cadre::asmLienRompre(const std::string& cid) {
  changerAssemblage([&](J& a) {
    if (J* c = as::composant(a, cid)) (*c)["link"] = nullptr;
    for (J& c : a["comps"])
      if (texteDe(c, "of") == cid) c.erase("of");
  });
  asmLiensEtat_.erase(cid);
  asmLiensBase_.erase(cid);
}

// asmLinkInsert : nouveau composant lié dans le composant actif ; même source déjà liée : une occurrence
bool Cadre::asmLienInserer(const std::wstring& chemin) {
  if (!docOuvert_) return false;
  std::string texte;
  J top, racine;
  try {
    texte = texteFichier(chemin);
    racine = racineLue(texte, top);
  } catch (const std::exception& e) {
    if (!essaiMenu_) wxMessageBox(tx(e.what()), L"Lien impossible", wxOK | wxICON_WARNING, this);
    return false;
  }
  if (esquisseOuverte_ >= 0) quitterEsquisse();
  if (!doc_.assemblage) {
    const bool etaitModifie = doc_.modifie();
    modifierStructure(doc_, [](J& d) { as::assurer(d); });
    doc_.basculeSeule = !etaitModifie;
  }
  std::error_code ec;
  for (const std::string& id : asmLies()) {
    const J* c = as::composant(*doc_.assemblage, id);
    std::string pq;
    const std::wstring p = asmLienChemin((*c)["link"], pq);
    if (!p.empty() && fs::equivalent(p, chemin, ec)) {
      const std::string base = texteDe(*c, "name");
      std::string idOcc;
      changerAssemblage([&](J& a) {
        as::Repere fr;
        fr.o[0] = asmDroiteDeTout();
        J o = as::nouvelleOccurrenceObjet(id, as::nomOccurrence(a, id), fr);
        idOcc = texteDe(o, "id");
        (*as::composant(a, as::actif(a)))["occ"].push_back(std::move(o));
      });
      asmSel_ = idOcc;
      asmLot_.clear();
      asmMontrerChoix();
      montrerRien();
      etat(L"« " + tx(base) + L" » est déjà lié : nouvelle occurrence.");
      return true;
    }
  }
  const std::string base = wxFileName(chemin).GetName().utf8_string();
  const double dx = asmDroiteDeTout();
  const J ref = asmLienRef(chemin);
  const std::string h = as::empreinteTexte(texte);
  asmAjouterSources(racine);
  std::string idOcc, cidNeuf;
  faireSuivre();
  bool echec = false;
  changerStructure([&](J& d) {
    d["asm"] = *doc_.assemblage;
    J& a = d["asm"];
    cidNeuf = as::nouvelIdentifiant("cp");
    J L = J::object();
    L["id"] = cidNeuf;
    L["kind"] = "comp";
    L["name"] = base;
    L["doc"] = as::documentVide(base);
    L["occ"] = J::array();
    L["link"] = ref;
    if (const J* P = as::proprietaireLien(a, as::actif(a))) L["of"] = texteDe(*P, "id");
    a["comps"].push_back(std::move(L));
    try {
      as::chargerLien(d, cidNeuf, top, h);
    } catch (const std::exception&) {
      echec = true;
      return;
    }
    as::Repere fr;
    fr.o[0] = dx;
    J o = as::nouvelleOccurrenceObjet(cidNeuf, base + ":1", fr);
    idOcc = texteDe(o, "id");
    (*as::composant(d["asm"], as::actif(d["asm"])))["occ"].push_back(std::move(o));
  });
  if (echec) return false;
  asmLiensRefBase({cidNeuf});
  if (asmMode_ != "asm") asmAller(as::cheminActif(*doc_.assemblage), "asm", idOcc);
  asmSel_ = idOcc;
  asmLot_.clear();
  asmMontrerChoix();
  montrerRien();
  etat(L"Lié : « " + tx(base) + L" ». Modifiable ici : la source est réécrite à l'enregistrement.");
  return true;
}

// asmCmdExtract, asmExtractTo : composant → fichier, et le composant devient lié à ce fichier
void Cadre::asmLienExtraire(const std::string& cid, std::wstring chemin) {
  if (!doc_.assemblage) return;
  const std::string why = as::refusExtraction(*doc_.assemblage, cid);
  if (!why.empty()) {
    if (!essaiMenu_) wxMessageBox(L"Extraction impossible : " + tx(why) + L".", L"Extraire", wxOK | wxICON_WARNING, this);
    etat(L"Extraction impossible : " + tx(why) + L".");
    return;
  }
  const J* C = as::composant(*doc_.assemblage, cid);
  const std::string nom = texteDe(*C, "name");
  if (chemin.empty()) {
    wxString propose = tx(nom);
    for (const wchar_t* k = L"\\/:*?\"<>|"; *k; k++) propose.Replace(wxString(*k), L"_");
    wxFileDialog d(this, L"Extraire vers un fichier", doc_.chemin.empty() ? wxString() : wxFileName(doc_.chemin).GetPath(), propose + L".conceptcad", L"Projets ConceptCAD (*.conceptcad)|*.conceptcad", wxFD_SAVE | wxFD_OVERWRITE_PROMPT);
    if (d.ShowModal() != wxID_OK) return;
    chemin = d.GetPath().ToStdWstring();
  }
  faireSuivre();
  J haut = asmDocComplet();
  const J ref = asmLienRef(chemin);
  const auto marque = [&](J& d) {
    const std::set<std::string> sub = as::sousComposants(d["asm"], cid);
    J& c = *as::composant(d["asm"], cid);
    c["link"] = ref;
    c["link"]["srcRoot"] = cid;
    for (const std::string& id : sub) (*as::composant(d["asm"], id))["of"] = cid;
  };
  marque(haut);
  std::string texte;
  try {
    texte = asmLienTexte(haut, cid, "");
    ecrireProjetSur(chemin, texte, true);
  } catch (const std::exception& e) {
    if (!essaiMenu_) wxMessageBox(L"Écriture impossible : " + tx(e.what()), L"Extraire", wxOK | wxICON_ERROR, this);
    etat(L"Écriture impossible : " + tx(e.what()));
    return;
  }
  const std::string h = as::empreinteTexte(texte);
  changerStructure([&](J& d) {
    d["asm"] = *doc_.assemblage;
    marque(d);
    (*as::composant(d["asm"], cid))["link"]["sig"] = h;
  });
  asmLiensEtat_[cid] = EtatLien{};
  asmLiensEtat_[cid].sigVue = h;
  tampon(chemin, asmLiensEtat_[cid].date, asmLiensEtat_[cid].taille);
  asmLiensRefBase({cid});
  remplirArbre();
  etat(L"« " + tx(nom) + L" » extrait vers " + wxString(chemin) + L" : c'est maintenant un composant lié.");
}

// asmCmdReplaceWithLink
void Cadre::asmLienRemplacer(const std::string& cid, std::wstring chemin) {
  if (!doc_.assemblage) return;
  const J* C = as::composant(*doc_.assemblage, cid);
  if (!C || cid == as::racine(*doc_.assemblage)) return;
  const std::string nom = texteDe(*C, "name");
  if (chemin.empty()) {
    wxFileDialog d(this, L"Remplacer « " + tx(nom) + L" » par un lien", wxEmptyString, wxEmptyString, L"Projets ConceptCAD (*.conceptcad;*.gz)|*.conceptcad;*.gz", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
    if (d.ShowModal() != wxID_OK) return;
    chemin = d.GetPath().ToStdWstring();
  }
  std::string texte;
  J top, racine;
  try {
    texte = texteFichier(chemin);
    racine = racineLue(texte, top);
  } catch (const std::exception& e) {
    if (!essaiMenu_) wxMessageBox(tx(e.what()), L"Lien impossible", wxOK | wxICON_WARNING, this);
    return;
  }
  if (!essaiMenu_ && wxMessageBox(L"Le contenu de « " + tx(nom) + L" » (et de ses sous-composants) sera remplacé par celui de " + wxFileName(chemin).GetFullName() + L", auquel il sera lié. Ses occurrences gardent leur place.\nContinuer ?", L"Remplacer par un lien", wxYES_NO | wxNO_DEFAULT | wxICON_QUESTION, this) != wxYES) return;
  const J ref = asmLienRef(chemin);
  const std::string h = as::empreinteTexte(texte);
  asmAjouterSources(racine);
  faireSuivre();
  changerStructure([&](J& d) {
    d["asm"] = *doc_.assemblage;
    const std::set<std::string> sub = as::sousComposants(d["asm"], cid);
    for (const std::string& id : sub) {
      J& c = *as::composant(d["asm"], id);
      if (!(c.contains("link") && c["link"].is_object())) c["of"] = cid;
    }
    (*as::composant(d["asm"], cid))["link"] = ref;
    as::chargerLien(d, cid, top, h);
  });
  asmLiensEtat_[cid] = EtatLien{};
  asmLiensRefBase({cid});
  remplirArbre();
  etat(L"« " + tx(nom) + L" » est maintenant lié à " + wxString(chemin) + L".");
}

// asmLinksWrite : les sources modifiées ici, avant l'hôte
void Cadre::asmLiensEcrire() {
  if (!doc_.assemblage) return;
  const std::vector<std::string> L = asmLies();
  if (L.empty()) return;
  std::vector<std::string> sales;
  for (const std::string& cid : L)
    if (asmLienSale(cid)) sales.push_back(cid);
  if (sales.empty()) return;
  J haut = asmDocComplet();
  std::vector<std::string> ecrites, ratees;
  std::map<std::string, std::string> sigs, pend;
  for (const std::string& cid : sales) {
    const J& c = *as::composant(haut["asm"], cid);
    const std::string nom = texteDe(c, "name");
    std::string pourquoi;
    const std::wstring chemin = asmLienChemin(c["link"], pourquoi);
    if (chemin.empty()) {
      ratees.push_back(nom + " (" + pourquoi + ")");
      pend[cid] = "1";
      continue;
    }
    try {
      bool gz = true;
      const std::string cur = texteFichier(chemin, &gz);
      if (as::empreinteTexte(cur) != texteDe(c["link"], "sig")) {
        const bool ecraser = essaiMenu_ ? essaiChoix_ == "over" : wxMessageBox(L"La source de « " + tx(nom) + L" » a aussi changé sur le disque depuis la dernière vérification.\nL'écraser avec vos modifications ?", L"Composant lié", wxYES_NO | wxNO_DEFAULT | wxICON_WARNING, this) == wxYES;
        if (!ecraser) {
          ratees.push_back(nom + " (non écrite)");
          pend[cid] = "1";
          continue;
        }
      }
      const std::string texte = asmLienTexte(haut, cid, cur);
      ecrireProjetSur(chemin, texte, gz);
      sigs[cid] = as::empreinteTexte(texte);
      ecrites.push_back(nom);
      EtatLien& E = asmLiensEtat_[cid];
      E = EtatLien{};
      E.sigVue = sigs[cid];
      tampon(chemin, E.date, E.taille);
    } catch (const std::exception& e) {
      ratees.push_back(nom + " (" + e.what() + ")");
      pend[cid] = "1";
    }
  }
  const J resolu = *doc_.assemblage;
  modifierStructure(doc_, [&](J& j) {
    j["asm"] = resolu;
    for (const auto& [cid, s] : sigs) {
      J& lk = (*as::composant(j["asm"], cid))["link"];
      lk["sig"] = s;
      lk.erase("pend");
    }
    for (const auto& [cid, s] : pend) (*as::composant(j["asm"], cid))["link"]["pend"] = true;
  });
  asmLiensRefBase([&] {
    std::vector<std::string> v;
    for (const auto& [cid, s] : sigs) v.push_back(cid);
    return v;
  }());
  if (!ratees.empty()) {
    wxString m = L"Sources non écrites :\n";
    for (const std::string& r : ratees) m += L"• " + tx(r) + L"\n";
    m += L"L'assemblage garde vos modifications ; elles seront écrites au prochain enregistrement.";
    if (!essaiMenu_) wxMessageBox(m, L"Composants liés", wxOK | wxICON_WARNING, this);
    etat(m);
  }
}

void Cadre::asmLiensMesure(nlohmann::json& n) {
  nlohmann::json L = nlohmann::json::array();
  for (const std::string& cid : asmLies()) {
    const J* c = as::composant(*doc_.assemblage, cid);
    const auto it = asmLiensEtat_.find(cid);
    nlohmann::json x = {{"id", cid}, {"name", texteDe(*c, "name")}, {"sig", texteDe((*c)["link"], "sig")}, {"rel", texteDe((*c)["link"], "rel")}, {"sale", asmLienSale(cid)}};
    x["alerte"] = it != asmLiensEtat_.end() && it->second.alerte;
    if (it != asmLiensEtat_.end()) x["message"] = it->second.message;
    L.push_back(std::move(x));
  }
  n["liens"] = std::move(L);
}
