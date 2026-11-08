// La copie de secours : comme le brouillon du navigateur (autosave de 90-50-document-sauvegarde.js,
// bandeau de démarrage de 99-init.js). Tant qu'une pièce a des modifications non enregistrées, son
// texte est gardé dans %APPDATA%\ConceptCADNatif, jamais à la place du fichier d'origine. Après un
// arrêt brutal, le démarrage suivant propose de le rouvrir, sans jamais le rouvrir tout seul : c'est
// peut-être lui qui a fait tomber le programme.
//
// Plusieurs fenêtres peuvent tourner en même temps : chaque session a ses fichiers et tient un verrou
// que Windows libère quand le programme meurt, même brutalement. Un brouillon sans verrou tenu n'a
// plus de propriétaire.
#include <wx/button.h>
#include <wx/dialog.h>
#include <wx/filedlg.h>
#include <wx/filename.h>
#include <wx/msgdlg.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/utils.h>

#ifdef _WIN32
#include <windows.h>
#endif
#ifndef _WIN32
#include <fcntl.h>
#include <sys/file.h>
#include <unistd.h>
#endif
#include <chrono>
#include <ctime>
#include <filesystem>
#include <fstream>

#include "cadre.h"
#include "enregistrer.h"

namespace fs = std::filesystem;
using J = nlohmann::ordered_json;

namespace {
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }

std::wstring dossierSecours() {
  std::wstring d;
  if (const wchar_t* e = _wgetenv(L"CC_SECOURS")) d = e;  // les essais écrivent ailleurs
  else {
    if (const wchar_t* a = _wgetenv(L"APPDATA")) d = a;
    d += SEPW L"ConceptCADNatif" SEPW L"secours";
  }
  std::error_code ec;
  fs::create_directories(d, ec);
  return d;
}

// Écrit d'un seul coup : un arrêt pendant l'écriture laisse l'ancien brouillon entier
bool ecrireEntier(const std::wstring& cible, const std::string& octets) {
  const std::wstring temp = cible + L".tmp";
  {
    std::ofstream f(fs::path(temp), std::ios::binary | std::ios::trunc);
    if (!f) return false;
    f.write(octets.data(), static_cast<std::streamsize>(octets.size()));
    f.flush();
    if (!f) {
      f.close();
      _wremove(temp.c_str());
      return false;
    }
  }
  if (MoveFileExW(temp.c_str(), cible.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) return true;
  _wremove(temp.c_str());
  return false;
}

std::string lireTexte(const std::wstring& chemin) {
  std::string b = lireOctets(chemin);
  const bool gz = b.size() >= 2 && static_cast<unsigned char>(b[0]) == 0x1f && static_cast<unsigned char>(b[1]) == 0x8b;
  return gz ? degonfler(b) : b;
}

struct Orphelin {
  std::wstring texte, meta;
  std::wstring chemin;  // le fichier d'origine, vide pour une pièce jamais enregistrée
  std::string nom, date;
};

// Les brouillons dont le propriétaire n'existe plus, le plus récent d'abord
std::vector<Orphelin> orphelins() {
  std::vector<Orphelin> l;
  std::error_code ec;
  std::vector<std::pair<fs::file_time_type, Orphelin>> trouves;
  for (const auto& e : fs::directory_iterator(dossierSecours(), ec)) {
    const fs::path p = e.path();
    if (p.extension() != L".conceptcad") continue;
    const std::wstring base = p.stem().wstring();
    if (base.rfind(L"brouillon-", 0) != 0) continue;
    const std::wstring verrou = (p.parent_path() / (L"session-" + base.substr(10) + L".verrou")).wstring();
    // Un verrou tenu ne se laisse pas supprimer ; après une coupure de courant il reste là, mais plus personne ne le tient
#ifdef _WIN32
    if (!DeleteFileW(verrou.c_str()) && GetLastError() == ERROR_SHARING_VIOLATION) continue;
#else
    // Mac : le verrou d'une session vivante est tenu (flock) ; sinon on le retire
    {
      const std::string v8 = portable::u8(verrou.c_str());
      const int fd = ::open(v8.c_str(), O_RDWR);
      if (fd >= 0) {
        const bool tenu = ::flock(fd, LOCK_EX | LOCK_NB) != 0;
        ::close(fd);
        if (tenu) continue;
        ::unlink(v8.c_str());
      }
    }
#endif
    Orphelin o;
    o.texte = p.wstring();
    o.meta = (p.parent_path() / (base + L".json")).wstring();
    try {
      const J m = J::parse(lireOctets(o.meta));
      o.chemin = wxString::FromUTF8(m.value("chemin", std::string())).ToStdWstring();
      o.nom = m.value("nom", std::string());
      o.date = m.value("date", std::string());
    } catch (const std::exception&) {
    }
    trouves.emplace_back(fs::last_write_time(p, ec), std::move(o));
  }
  std::sort(trouves.begin(), trouves.end(), [](const auto& a, const auto& b) { return a.first > b.first; });
  for (auto& t : trouves) l.push_back(std::move(t.second));
  return l;
}

void oublier(const Orphelin& o) {
  _wremove(o.texte.c_str());
  _wremove(o.meta.c_str());
}
}  // namespace

// Le texte complet de la pièce telle qu'elle est maintenant, sans rien changer au document
std::string Cadre::secoursTexte() {
  std::string t = faoTexteCourant();
  if (t.empty() || !doc_.assemblage) return t;
  J racine = J::parse(t);
  J& j = racine.contains("doc") && racine["doc"].is_object() ? racine["doc"] : racine;
  j["asm"] = *doc_.assemblage;
  return racine.dump(-1, ' ', false, J::error_handler_t::replace);
}

void Cadre::secoursEffacer() {
  secoursEmpreinte_ = 0;
  if (secoursId_.empty()) return;
  const std::wstring d = dossierSecours() + SEPW L"brouillon-" + secoursId_;
  _wremove((d + L".conceptcad").c_str());
  _wremove((d + L".json").c_str());
}

// Une copie seulement si la pièce a changé depuis la dernière, et jamais au milieu d'un geste ou d'un calcul.
// force : même au milieu d'un geste (à la demande des essais)
void Cadre::secoursEcrire(bool force) {
  if (secoursId_.empty()) return;
  if (!force) {
    if (wxIsBusy() || wxGetMouseState().LeftIsDown()) return;
    if (std::chrono::steady_clock::now() < secoursProchain_) return;
  }
  if (!docOuvert_ || !doc_.modifie()) {
    if (secoursEmpreinte_) secoursEffacer();
    return;
  }
  const auto t0 = std::chrono::steady_clock::now();
  try {
    const std::string t = secoursTexte();
    if (t.empty()) return;
    const size_t h = std::hash<std::string>{}(t);
    if (h == secoursEmpreinte_ && !force) return;
    const std::wstring d = dossierSecours() + SEPW L"brouillon-" + secoursId_;
    wxString date = wxDateTime::Now().Format(L"%d/%m/%Y à %H:%M");
    const J m = {{"chemin", wxString(doc_.chemin).utf8_string()}, {"nom", doc_.nom}, {"date", date.utf8_string()}};
    if (ecrireEntier(d + L".json", m.dump()) && ecrireEntier(d + L".conceptcad", t)) secoursEmpreinte_ = h;
  } catch (const std::exception&) {
    // Une copie de secours ratée ne doit jamais gêner le travail : la suivante réessaiera
  }
  // Une pièce énorme ne doit pas ralentir les gestes : la copie prend au plus 5 % du temps
  secoursProchain_ = std::chrono::steady_clock::now() + (std::chrono::steady_clock::now() - t0) * 20;
}

void Cadre::secoursDemarrer() {
  if (!secoursId_.empty()) return;
  secoursId_ = std::to_wstring(GetCurrentProcessId()) + L"-" + std::to_wstring(GetTickCount64());
  const std::wstring verrou = dossierSecours() + SEPW L"session-" + secoursId_ + L".verrou";
  // Gardé ouvert jusqu'à la fin du programme : Windows le ferme et l'efface, même après un plantage
#ifdef _WIN32
  secoursVerrou_ = CreateFileW(verrou.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_TEMPORARY | FILE_FLAG_DELETE_ON_CLOSE, nullptr);
#else
  // Mac : verrou tenu tant que le programme vit ; le système le relâche même après un plantage
  {
    const int fd = ::open(portable::u8(verrou.c_str()).c_str(), O_RDWR | O_CREAT, 0644);
    if (fd >= 0) ::flock(fd, LOCK_EX | LOCK_NB);
    secoursVerrou_ = reinterpret_cast<void*>(static_cast<intptr_t>(fd + 1));
  }
#endif
  secoursMinuteur_.SetOwner(this);
  Bind(wxEVT_TIMER, [this](wxTimerEvent&) { secoursEcrire(false); }, secoursMinuteur_.GetId());
  secoursMinuteur_.Start(4000);
  if (!essaiSansBoite_) CallAfter([this] { secoursProposer(); });
}

// Reprend un brouillon : la pièce revient avec le chemin de son fichier, Ctrl+S le remplacera (avec sa copie .bak).
bool Cadre::secoursRouvrir(const std::wstring& brouillon, const std::wstring& meta, const std::wstring& origine) {
  if (!peutAbandonner()) return false;
  try {
    const std::string texte = lireTexte(brouillon);
    Document d = lireProjet(brouillon);
    dessinModifie_ = false;
    quitterConge();
    quitterEsquisse();
    std::error_code ec;
    if (!origine.empty() && fs::exists(fs::path(origine), ec)) {
      const std::string surDisque = lireOctets(origine);
      d.chemin = origine;
      d.octets = surDisque;
      d.compresse = surDisque.size() >= 2 && static_cast<unsigned char>(surDisque[0]) == 0x1f && static_cast<unsigned char>(surDisque[1]) == 0x8b;
    } else {
      d.chemin = L"";  // jamais enregistrée, ou fichier disparu : Ctrl+S demandera où
    }
    d.texteBase = texte;  // la pièce est « modifiée » tant qu'elle n'est pas enregistrée
    doc_ = std::move(d);
  } catch (const std::exception& e) {
    if (!essaiSansBoite_) wxMessageBox(tx(e.what()) + L"\n\nLe brouillon est conservé.", L"Brouillon illisible", wxOK | wxICON_ERROR, this);
    return false;
  }
  apresOuverture();
  secoursProchain_ = {};
  secoursEcrire(true);  // sa copie est prise par cette session avant d'effacer l'ancienne
  _wremove(brouillon.c_str());
  _wremove(meta.c_str());
  majTitre();
  etat(doc_.chemin.empty() ? wxString(L"Brouillon rouvert : enregistrez-le (Ctrl+S) pour le garder.")
                           : L"Brouillon rouvert. Ctrl+S remplacera " + wxString(doc_.chemin) + L" ; sinon, Enregistrer sous.");
  return true;
}

// La question après un arrêt brutal, une fenêtre par brouillon. Fermer la fenêtre = décider plus tard : il reste pour le prochain démarrage.
wxDialog* Cadre::secoursProposer() {
  const std::vector<Orphelin> l = orphelins();
  if (l.empty() || secoursRang_ >= l.size()) return nullptr;
  const Orphelin o = l[secoursRang_];
  auto* dlg = new wxDialog(this, wxID_ANY, L"Le programme s'est arrêté sans enregistrer");
  auto* v = new wxBoxSizer(wxVERTICAL);
  // Le nom du fichier : dans un assemblage, doc.name est celui du composant actif
  const wxString nomVu = !o.chemin.empty() ? wxFileName(o.chemin).GetName() : o.nom.empty() ? wxString(L"Sans titre") : tx(o.nom);
  wxString dit = L"Un brouillon de « " + nomVu + L" » a été gardé";
  if (!o.date.empty()) dit += L" (" + tx(o.date) + L")";
  dit += L".\n";
  dit += o.chemin.empty() ? wxString(L"Cette pièce n'avait jamais été enregistrée.") : L"Le fichier d'origine n'a pas été touché : " + wxString(o.chemin);
  dit += L"\n\nIl n'a pas été rouvert tout seul : il a peut-être fait tomber le programme.";
  v->Add(new wxStaticText(dlg, wxID_ANY, dit), 0, wxALL, FromDIP(14));
  auto* h = new wxBoxSizer(wxHORIZONTAL);
  auto* rouvrir = new wxButton(dlg, wxID_ANY, L"Rouvrir le brouillon");
  auto* sous = new wxButton(dlg, wxID_ANY, L"Enregistrer le brouillon sous…");
  auto* jeter = new wxButton(dlg, wxID_ANY, L"Le supprimer");
  h->Add(rouvrir, 0, wxRIGHT, FromDIP(8));
  h->Add(sous, 0, wxRIGHT, FromDIP(8));
  h->Add(jeter, 0);
  v->Add(h, 0, wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(14));
  dlg->SetSizerAndFit(v);
  dlg->CentreOnParent();
  // Ce qui ne s'est pas résolu reste sur le disque : on passe au suivant de la liste
  const auto suivant = [this, dlg](bool garde) {
    dlg->Destroy();
    if (garde) secoursRang_++;
    CallAfter([this] { secoursProposer(); });
  };
  rouvrir->Bind(wxEVT_BUTTON, [this, o, suivant](wxCommandEvent&) { suivant(!secoursRouvrir(o.texte, o.meta, o.chemin)); });
  sous->Bind(wxEVT_BUTTON, [this, o, dlg, suivant](wxCommandEvent&) {
    const wxFileName n(o.chemin);
    wxFileDialog d(dlg, L"Enregistrer le brouillon sous", n.GetPath(), o.chemin.empty() ? wxString(L"Brouillon.conceptcad") : n.GetName() + L" (brouillon).conceptcad",
                   L"Projets ConceptCAD (*.conceptcad)|*.conceptcad", wxFD_SAVE | wxFD_OVERWRITE_PROMPT);
    if (d.ShowModal() != wxID_OK) return;
    if (!ecrireEntier(d.GetPath().ToStdWstring(), lireTexte(o.texte))) {
      wxMessageBox(L"Écriture impossible à cet endroit. Le brouillon est conservé.", L"Enregistrement impossible", wxOK | wxICON_ERROR, dlg);
      return;
    }
    oublier(o);
    etat(L"Brouillon enregistré dans " + d.GetPath() + L".");
    suivant(false);
  });
  jeter->Bind(wxEVT_BUTTON, [o, dlg, suivant](wxCommandEvent&) {
    wxMessageDialog q(dlg, L"Supprimer ce brouillon pour de bon ?", L"ConceptCAD natif", wxYES_NO | wxNO_DEFAULT | wxICON_WARNING);
    q.SetYesNoLabels(L"Supprimer", L"Le garder");
    if (q.ShowModal() != wxID_YES) return;
    oublier(o);
    suivant(false);
  });
  dlg->Bind(wxEVT_CLOSE_WINDOW, [suivant](wxCloseEvent&) { suivant(true); });
  dlg->Show();
  return dlg;
}

// Pour les essais : { "secours": "demarrer" | "ecrire" | "etat" | "rouvrir" | "effacer" }
nlohmann::json Cadre::secoursEssai(const std::string& quoi) {
  nlohmann::json n;
  if (quoi == "demarrer") secoursDemarrer();
  if (quoi == "ecrire") {
    const auto t0 = std::chrono::steady_clock::now();
    secoursEcrire(true);
    n["ms"] = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
  }
  if (quoi == "effacer") secoursEffacer();
  if (quoi == "tenter") secoursEcrire(false);
  if (quoi == "rouvrir") {
    const std::vector<Orphelin> l = orphelins();
    n["rouvert"] = !l.empty() && secoursRouvrir(l[0].texte, l[0].meta, l[0].chemin);
    n["chemin"] = wxString(doc_.chemin).utf8_string();
    n["nom"] = doc_.nom;
    n["modifie"] = doc_.modifie();
    n["fonctions"] = doc_.fonctions.size();
  }
  n["id"] = wxString(secoursId_).utf8_string();
  if (!secoursId_.empty()) {
    std::error_code ec;
    n["brouillon"] = fs::exists(fs::path(dossierSecours() + SEPW L"brouillon-" + secoursId_ + L".conceptcad"), ec);
  }
  nlohmann::json o = nlohmann::json::array();
  for (const Orphelin& x : orphelins()) o.push_back({{"nom", x.nom}, {"chemin", wxString(x.chemin).utf8_string()}, {"date", x.date}});
  n["orphelins"] = o;
  return n;
}
