// Le dossier de projets (mffFolderPanel, src/97-fichiers-projets.js) : la liste des pièces du dossier où on les range.
#include <wx/config.h>
#include <wx/dir.h>
#include <wx/dirdlg.h>
#include <wx/filename.h>
#include <wx/listctrl.h>
#include <wx/textdlg.h>

#include <algorithm>
#include <regex>

#include "cadre.h"

namespace {
wxString lireDossierProjets() {
  wxConfig c(L"ConceptCADNatif");
  wxString v;
  c.Read(L"dossierProjets", &v);
  return v;
}
void ecrireDossierProjets(const wxString& v) {
  wxConfig c(L"ConceptCADNatif");
  c.Write(L"dossierProjets", v);
}
}  // namespace

std::vector<Cadre::ProjetDossier> Cadre::projetsDuDossier(const wxString& dossier) {
  std::vector<ProjetDossier> L;
  wxDir d(dossier);
  if (!d.IsOpened()) return L;
  wxString nom;
  for (bool ok = d.GetFirst(&nom, wxEmptyString, wxDIR_FILES); ok; ok = d.GetNext(&nom)) {
    const wxString bas = nom.Lower();
    if (!(bas.EndsWith(L".conceptcad") || bas.EndsWith(L".conceptcad.gz") || bas.EndsWith(L".minifusion") || bas.EndsWith(L".json"))) continue;
    wxFileName f(dossier, nom);
    ProjetDossier p;
    p.nom = nom;
    p.chemin = f.GetFullPath();
    p.quand = f.GetModificationTime();
    L.push_back(p);
  }
  std::sort(L.begin(), L.end(), [](const ProjetDossier& a, const ProjetDossier& b) { return a.quand.IsValid() && (!b.quand.IsValid() || a.quand.IsLaterThan(b.quand)); });
  return L;
}

void Cadre::panneauDossier() {
  wxDialog dlg(this, wxID_ANY, L"Dossier de projets", wxDefaultPosition, FromDIP(wxSize(560, 520)), wxDEFAULT_DIALOG_STYLE | wxRESIZE_BORDER);
  auto* v = new wxBoxSizer(wxVERTICAL);
  auto* barre = new wxBoxSizer(wxHORIZONTAL);
  auto* changer = new wxButton(&dlg, wxID_ANY, L"Choisir un dossier…");
  auto* ici = new wxButton(&dlg, wxID_ANY, L"Enregistrer ici");
  ici->SetToolTip(L"Enregistrer la pièce courante dans ce dossier");
  barre->Add(changer, 0, wxRIGHT, FromDIP(8));
  barre->Add(ici);
  v->Add(barre, 0, wxALL, FromDIP(12));
  auto* note = new wxStaticText(&dlg, wxID_ANY, wxEmptyString);
  v->Add(note, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(12));
  auto* liste = new wxListCtrl(&dlg, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxLC_REPORT | wxLC_SINGLE_SEL);
  liste->AppendColumn(L"Projet", wxLIST_FORMAT_LEFT, FromDIP(340));
  liste->AppendColumn(L"Modifié le", wxLIST_FORMAT_LEFT, FromDIP(170));
  v->Add(liste, 1, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(12));
  dlg.SetSizer(v);
  std::vector<ProjetDossier> projets;
  const auto dessiner = [&] {
    const wxString dossier = lireDossierProjets();
    changer->SetLabel(dossier.IsEmpty() ? L"Choisir un dossier…" : L"Changer de dossier…");
    ici->Enable(!dossier.IsEmpty() && docOuvert_);
    liste->DeleteAllItems();
    projets.clear();
    if (dossier.IsEmpty()) {
      note->SetLabel(L"Choisissez le dossier où vous rangez vos pièces : la liste de ses projets apparaîtra ici (double-clic pour ouvrir).");
    } else {
      projets = projetsDuDossier(dossier);
      note->SetLabel(projets.empty() ? L"📁 " + dossier + L"\nAucun projet (.conceptcad ou .miniFusion) dans ce dossier." : L"📁 " + dossier);
      for (size_t i = 0; i < projets.size(); i++) {
        const long l = liste->InsertItem(static_cast<long>(i), projets[i].nom);
        liste->SetItem(l, 1, projets[i].quand.IsValid() ? projets[i].quand.Format(L"%d/%m/%Y %H:%M") : wxString());
        if (!doc_.chemin.empty() && _wcsicmp(wxString(projets[i].chemin).wc_str(), doc_.chemin.c_str()) == 0) liste->SetItemFont(l, liste->GetFont().Bold());
      }
    }
    note->Wrap(dlg.GetClientSize().x - FromDIP(24));
    dlg.Layout();
  };
  changer->Bind(wxEVT_BUTTON, [&](wxCommandEvent&) {
    wxDirDialog d(&dlg, L"Le dossier de vos projets", lireDossierProjets());
    if (d.ShowModal() != wxID_OK) return;
    ecrireDossierProjets(d.GetPath());
    dessiner();
  });
  ici->Bind(wxEVT_BUTTON, [&](wxCommandEvent&) {
    wxString proposé = doc_.nom.empty() ? wxString(L"piece") : wxString::FromUTF8(doc_.nom);
    for (const wchar_t c : wxString(L"\\/:*?\"<>|")) proposé.Replace(wxString(c), L"_");
    wxTextEntryDialog q(&dlg, L"Nom du fichier :", L"Enregistrer ici", proposé);
    if (q.ShowModal() != wxID_OK || q.GetValue().Trim().IsEmpty()) return;
    wxString nom = q.GetValue().Trim();
    for (const wchar_t* fin : {L".conceptcad.gz", L".conceptcad"})
      if (nom.Lower().EndsWith(fin)) nom = nom.Left(nom.length() - wxStrlen(fin));
    const wxFileName cible(lireDossierProjets(), nom + L".conceptcad");
    if (cible.FileExists() && wxMessageBox(L"« " + cible.GetFullName() + L" » existe déjà. Le remplacer ?", L"Dossier de projets", wxYES_NO | wxNO_DEFAULT | wxICON_QUESTION, &dlg) != wxYES) return;
    const std::string n8 = nom.utf8_string();
    changerStructure([&](nlohmann::ordered_json& j) { j["name"] = n8; });
    ecrireEnvVue();
    if (ecrire(cible.GetFullPath().ToStdWstring())) dessiner();
  });
  liste->Bind(wxEVT_LIST_ITEM_ACTIVATED, [&](wxListEvent& e) {
    const long i = e.GetIndex();
    if (i < 0 || i >= static_cast<long>(projets.size())) return;
    const wxString chemin = projets[i].chemin;
    if (!peutAbandonner()) return;
    dlg.EndModal(wxID_OK);
    CallAfter([this, chemin] { ouvrir(chemin.ToStdWstring()); });
  });
  dessiner();
  dlg.CentreOnParent();
  dlg.ShowModal();
}
