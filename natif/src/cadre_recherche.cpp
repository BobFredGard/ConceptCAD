// Les deux recherches de la version navigateur : treeFilter (src/42-arbre-modele.js), la ligne reste si elle correspond
// ou si une ligne plus profonde correspond ; mfCommands et mfSearchBox (src/97-interface-moderne.js), Ctrl+K.
#include "theme.h"
#include <wx/listbox.h>
#include <wx/popupwin.h>
#include <wx/textctrl.h>
#include <windows.h>

#include <set>

#include "cadre.h"

namespace {
// Sans accents ni casse, comme treeNorm
std::wstring sansAccents(const wxString& s) {
  const std::wstring w = s.ToStdWstring();
  std::wstring d(w.size() * 3 + 8, L'\0');
  const int n = FoldStringW(MAP_COMPOSITE, w.c_str(), static_cast<int>(w.size()), d.data(), static_cast<int>(d.size()));
  d.resize(n > 0 ? n : 0);
  std::wstring out;
  for (const wchar_t c : d)
    if (c < 0x300 || c > 0x36f) out.push_back(c);
  return wxString(out).Lower().ToStdWstring();
}
bool contient(const wxString& texte, const std::wstring& q) { return sansAccents(texte).find(q) != std::wstring::npos; }
}  // namespace

// ---------- Rechercher dans l'arbre ----------
void Cadre::filtrerArbre(const wxTreeItemId& racine) {
  const std::wstring q = sansAccents(wxString(filtreArbre_).Trim().Trim(false));
  if (q.empty()) return;
  std::set<void*> restent;
  bool trouve = false;
  const std::function<bool(const wxTreeItemId&)> garder = [&](const wxTreeItemId& l) {
    bool dedans = false;
    wxTreeItemIdValue c;
    for (wxTreeItemId e = arbre_->GetFirstChild(l, c); e.IsOk();) {
      const wxTreeItemId suite = arbre_->GetNextSibling(e);
      dedans = garder(e) || dedans;
      e = suite;
    }
    const bool lui = l != racine && contient(arbre_->GetItemText(l), q);
    if (!lui && !dedans && l != racine) {
      arbre_->Delete(l);
      return false;
    }
    restent.insert(l.GetID());
    if (lui) {
      arbre_->SetItemBold(l);
      trouve = true;
    }
    if (dedans && l != racine) arbre_->Expand(l);
    return true;
  };
  garder(racine);
  // Les lignes retirées ne doivent plus servir
  const auto vider = [&](std::vector<wxTreeItemId>& L) {
    for (wxTreeItemId& i : L)
      if (i.IsOk() && !restent.count(i.GetID())) i = wxTreeItemId();
  };
  vider(lignesFonctions_);
  vider(lignesEsquisses_);
  const auto retirer = [&](std::map<std::string, wxTreeItemId>& M) {
    for (auto it = M.begin(); it != M.end();) it = restent.count(it->second.GetID()) ? std::next(it) : M.erase(it);
  };
  retirer(lignesOcc_);
  retirer(lignesConstruction_);
  if (!trouve) {
    const wxTreeItemId l = arbre_->AppendItem(racine, L"Aucun résultat pour « " + wxString(filtreArbre_).Trim().Trim(false) + L" ».");
    arbre_->SetItemTextColour(l, th(wxColour(0x8e, 0x8e, 0x93)));
  }
}

// ---------- Rechercher une commande ----------
std::vector<Cadre::CommandeCherchee> Cadre::commandesCherchees() {
  std::vector<CommandeCherchee> L;
  std::set<std::wstring> vus;
  const auto ajouter = [&](const wxString& libelle, std::function<void()> fn, const wxString& aide = wxString()) {
    if (vus.insert(libelle.Lower().ToStdWstring()).second) L.push_back({libelle, aide, std::move(fn)});
  };
  for (const CommandeRuban& c : ruban_->commandes()) {
    const Atelier a = c.a;
    const wxString nom = c.nom;
    const wxString pre = a == Atelier::FAO ? L"FAO · " : a == Atelier::PLAN ? L"Plan · " : L"";
    ajouter(pre + nom, [this, a, nom] {
      if (atelier_ != a) changerAtelier(a);
      boutonRuban(a, nom);
    }, c.aide);
  }
  const auto ici = [](std::function<void()>& f) { return [&f] { if (f) f(); }; };
  ajouter(L"Annuler", ici(barreHaute_->surAnnuler));
  ajouter(L"Rétablir", ici(barreHaute_->surRetablir));
  ajouter(L"Nouveau projet", ici(barreHaute_->surNouveau));
  ajouter(L"Ouvrir…", ici(barreHaute_->surOuvrir));
  ajouter(L"Ouvrir récent", ici(barreHaute_->surRecent));
  ajouter(L"Enregistrer", ici(barreHaute_->surEnregistrer));
  ajouter(L"Enregistrer sous…", ici(barreHaute_->surEnregistrerSous));
  ajouter(L"Dossier de projets…", ici(barreHaute_->surDossier));
  ajouter(L"Script JSON…", [this] { ouvrirScript(); });
  for (int t = 0; t < theme::NB; t++) ajouter(wxString(L"Thème : ") + theme::palette(t).nom, [this, t] { appliquerTheme(t); });
  ajouter(L"Régénérer le modèle", ici(barreHaute_->surRegenerer));
  ajouter(L"Tout afficher (cadrer)", [this] { vue_->vueInitiale(); });
  ajouter(L"Réglages de visualisation", [this] { basculerFicheVue(); });
  ajouter(L"Film de construction", [this] { filmLancer(); }, L"Rejouer l'historique de la pièce comme un petit film");
  const auto construire = [&](const wxString& libelle, const wchar_t* nom) {
    const wxString n = nom;
    ajouter(libelle, [this, n] {
      if (atelier_ != Atelier::CAO) changerAtelier(Atelier::CAO);
      boutonRuban(Atelier::CAO, n);
    }, L"Construire");
  };
  construire(L"Plan de construction", L"Plan");
  construire(L"Axe de construction", L"Axe");
  construire(L"Point de construction", L"Point");
  construire(L"Repère de construction", L"Repère");
  const auto vue = [&](const wxString& libelle, const char* q) {
    const std::string s = q;
    ajouter(libelle, [this, s] { vue_->vueStandard(s); });
  };
  vue(L"Vue iso", "iso");
  vue(L"Vue de dessus", "top");
  vue(L"Vue de face", "front");
  vue(L"Vue de droite", "right");
  ajouter(L"Espace CAO", [this] { changerAtelier(Atelier::CAO); });
  ajouter(L"Espace FAO", [this] { changerAtelier(Atelier::FAO); });
  ajouter(L"Espace PLAN", [this] { changerAtelier(Atelier::PLAN); });
  ajouter(L"Rendu (image réaliste)", [this] { changerAtelier(Atelier::RENDU); });
  return L;
}

void Cadre::cmdFermer() {
  if (popCmd_ && popCmd_->IsShown()) popCmd_->Hide();
}

void Cadre::cmdDessiner() {
  wxTextCtrl* champ = barreHaute_->champRecherche();
  const std::wstring q = sansAccents(wxString(champ->GetValue()).Trim().Trim(false));
  resultatsCmd_.clear();
  if (!q.empty())
    for (CommandeCherchee& c : commandesCherchees())
      if ((contient(c.libelle, q) || contient(c.aide, q)) && resultatsCmd_.size() < 12) resultatsCmd_.push_back(std::move(c));
  if (resultatsCmd_.empty()) return cmdFermer();
  if (!popCmd_) {
    popCmd_ = new wxPopupWindow(this, wxBORDER_SIMPLE);
    listeCmd_ = new wxListBox(popCmd_, wxID_ANY, wxDefaultPosition, wxDefaultSize, 0, nullptr, wxLB_SINGLE | wxBORDER_NONE);
    { wxFontInfo fi(wxSize(0, static_cast<int>(std::lround(12.5 * GetDPIScaleFactor())))); fi.FaceName("Arial"); listeCmd_->SetFont(wxFont(fi)); }
    listeCmd_->SetBackgroundColour(th(wxColour(0x2c, 0x2c, 0x2e)));
    listeCmd_->SetForegroundColour(th(wxColour(0xe5, 0xe5, 0xea)));
    listeCmd_->Bind(wxEVT_LISTBOX, [this](wxCommandEvent& e) {
      const int i = e.GetSelection();
      if (!cmdClavier_) cmdLancer(i);
    });
  }
  listeCmd_->Freeze();
  listeCmd_->Clear();
  for (const CommandeCherchee& c : resultatsCmd_) listeCmd_->Append(c.libelle);
  cmdClavier_ = true;
  listeCmd_->SetSelection(0);
  cmdClavier_ = false;
  listeCmd_->Thaw();
  const int largeur = FromDIP(340), ligne = listeCmd_->GetCharHeight() + FromDIP(4);
  const wxSize t(largeur, ligne * static_cast<int>(resultatsCmd_.size()) + FromDIP(4));
  popCmd_->SetSize(champ->ClientToScreen(wxPoint(-FromDIP(9), champ->GetSize().y + FromDIP(6))).x, champ->ClientToScreen(wxPoint(0, champ->GetSize().y + FromDIP(6))).y, t.x, t.y);
  listeCmd_->SetSize(popCmd_->GetClientSize());
  if (!popCmd_->IsShown()) popCmd_->Show();
}

void Cadre::cmdLancer(int i) {
  if (i < 0 || i >= static_cast<int>(resultatsCmd_.size())) return;
  const std::function<void()> fn = resultatsCmd_[i].fn;
  cmdFermer();
  barreHaute_->champRecherche()->ChangeValue(wxString());
  vue_->SetFocus();
  CallAfter([fn] { fn(); });  // la liste se ferme d'abord
}

void Cadre::rechercheInit() {
  // L'arbre : la liste se refait à chaque lettre
  rechercheArbre_->Bind(wxEVT_TEXT, [this](wxCommandEvent&) {
    filtreArbre_ = rechercheArbre_->GetValue();
    remplirArbre();
  });
  rechercheArbre_->Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& e) {
    if (e.GetKeyCode() == WXK_ESCAPE && !rechercheArbre_->IsEmpty()) rechercheArbre_->Clear();
    else e.Skip();
  });
  // Les commandes
  wxTextCtrl* champ = barreHaute_->champRecherche();
  champ->Bind(wxEVT_TEXT, [this](wxCommandEvent&) { cmdDessiner(); });
  champ->Bind(wxEVT_KILL_FOCUS, [this](wxFocusEvent& e) {
    // Un clic dans la liste : elle garde la main le temps du choix
    CallAfter([this] {
      if (!listeCmd_ || FindFocus() != listeCmd_) cmdFermer();
    });
    e.Skip();
  });
  champ->Bind(wxEVT_CHAR_HOOK, [this, champ](wxKeyEvent& e) {
    const int k = e.GetKeyCode();
    const bool ouvert = popCmd_ && popCmd_->IsShown();
    if (k == WXK_DOWN || k == WXK_UP) {
      if (ouvert) {
        const int n = listeCmd_->GetCount();
        cmdClavier_ = true;
        listeCmd_->SetSelection(std::clamp(listeCmd_->GetSelection() + (k == WXK_DOWN ? 1 : -1), 0, n - 1));
        cmdClavier_ = false;
      }
    } else if (k == WXK_RETURN || k == WXK_NUMPAD_ENTER) {
      if (ouvert) cmdLancer(listeCmd_->GetSelection());
      else {
        champ->ChangeValue(wxString());
        vue_->SetFocus();
      }
    } else if (k == WXK_ESCAPE) {
      cmdFermer();
      champ->ChangeValue(wxString());
      vue_->SetFocus();
    } else e.Skip();
  });
  Bind(wxEVT_MOVE, [this](wxMoveEvent& e) { cmdFermer(); e.Skip(); });
  Bind(wxEVT_ICONIZE, [this](wxIconizeEvent& e) { cmdFermer(); e.Skip(); });
}
