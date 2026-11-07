// La fenêtre d'Aide : raccourcis, astuces et journal d'erreurs (src/96-aide-raccourcis.js du navigateur)
#include "aide.h"

#include <wx/clipbrd.h>
#include <wx/filedlg.h>
#include <wx/statline.h>
#include <wx/wfstream.h>
#include <wx/wx.h>

#include <ctime>
#include <fstream>
#include <utility>
#include <vector>

#include "journal.h"
#include "theme.h"

#include "aide_donnees.inc"

namespace {
class FenetreAide : public wxDialog {
 public:
  explicit FenetreAide(wxWindow* parent) : wxDialog(parent, wxID_ANY, L"❔ Aide — raccourcis et astuces", wxDefaultPosition, wxDefaultSize, wxDEFAULT_DIALOG_STYLE | wxRESIZE_BORDER) {
    const wxColour FOND = th(wxColour(0x1c, 0x1c, 0x20)), TEXTE = th(wxColour(0xe8, 0xe8, 0xea)), DISCRET = th(wxColour(0x9a, 0x9a, 0xa2));
    const wxColour ORANGE(0xff, 0x9f, 0x0a), TOUCHE = th(wxColour(0x2c, 0x2c, 0x32));
    SetBackgroundColour(FOND);
    auto* corps = new wxScrolledWindow(this, wxID_ANY, wxDefaultPosition, FromDIP(wxSize(900, 620)), wxVSCROLL);
    corps->SetBackgroundColour(FOND);
    corps->SetScrollRate(0, FromDIP(12));
    auto* v = new wxBoxSizer(wxVERTICAL);
    const auto texte = [&](const wxString& t, const wxColour& c, int largeur = 0) {
      auto* s = new wxStaticText(corps, wxID_ANY, t);
      s->SetForegroundColour(c);
      if (largeur) s->Wrap(FromDIP(largeur));
      return s;
    };
    // Deux colonnes, à peu près de même hauteur
    auto* colonnes = new wxBoxSizer(wxHORIZONTAL);
    wxBoxSizer* cols[2] = {new wxBoxSizer(wxVERTICAL), new wxBoxSizer(wxVERTICAL)};
    size_t total = 0, faits = 0;
    for (const auto& s : AIDE_SECTIONS) total += s.lignes.size() + 2;
    for (const auto& s : AIDE_SECTIONS) {
      wxBoxSizer* c = cols[faits * 2 < total ? 0 : 1];
      faits += s.lignes.size() + 2;
      auto* titre = texte(s.titre, ORANGE);
      titre->SetFont(titre->GetFont().Bold());
      c->Add(titre, 0, wxTOP | wxBOTTOM, FromDIP(5));
      auto* g = new wxFlexGridSizer(2, FromDIP(3), FromDIP(8));
      for (const auto& [k, t] : s.lignes) {
        auto* cle = texte(k, TEXTE, 150);
        cle->SetBackgroundColour(TOUCHE);
        g->Add(cle, 0, wxALIGN_TOP);
        g->Add(texte(t, TEXTE, 250), 0, wxALIGN_TOP);
      }
      c->Add(g, 0, wxBOTTOM, FromDIP(6));
    }
    colonnes->Add(cols[0], 1, wxEXPAND | wxRIGHT, FromDIP(14));
    colonnes->Add(cols[1], 1, wxEXPAND);
    v->Add(colonnes, 0, wxEXPAND | wxALL, FromDIP(14));
    v->Add(new wxStaticLine(corps), 0, wxEXPAND | wxLEFT | wxRIGHT, FromDIP(14));
    // Le journal
    auto* jt = texte(L"🩺 Journal d’erreurs", ORANGE);
    jt->SetFont(jt->GetFont().Bold());
    v->Add(jt, 0, wxLEFT | wxTOP, FromDIP(14));
    etat_ = texte(wxEmptyString, TEXTE);
    v->Add(etat_, 0, wxLEFT | wxRIGHT | wxTOP, FromDIP(14) / 2 + 2);
    auto* lb = new wxBoxSizer(wxHORIZONTAL);
    enr_ = new wxButton(corps, wxID_ANY, L"💾 Enregistrer…");
    cop_ = new wxButton(corps, wxID_ANY, L"📋 Copier");
    vid_ = new wxButton(corps, wxID_ANY, L"✕ Vider");
    msg_ = texte(wxEmptyString, DISCRET);
    lb->Add(enr_, 0, wxRIGHT, FromDIP(8));
    lb->Add(cop_, 0, wxRIGHT, FromDIP(8));
    lb->Add(vid_, 0, wxRIGHT, FromDIP(8));
    lb->Add(msg_, 0, wxALIGN_CENTER_VERTICAL);
    v->Add(lb, 0, wxLEFT | wxTOP, FromDIP(14));
    v->Add(texte(L"Reste sur cet ordinateur : rien n’est envoyé. Contient les messages d’erreur et les derniers boutons cliqués, jamais votre pièce.", DISCRET, 860), 0, wxLEFT | wxTOP, FromDIP(14));
    v->Add(texte(L"F1 (hors esquisse) ou « ? » rouvrent cette aide · Échap pour fermer.", DISCRET, 860), 0, wxALL, FromDIP(14));
    corps->SetSizer(v);
    corps->FitInside();
    auto* tout = new wxBoxSizer(wxVERTICAL);
    tout->Add(corps, 1, wxEXPAND);
    auto* fermer = new wxButton(this, wxID_CANCEL, L"Fermer");
    tout->Add(fermer, 0, wxALIGN_RIGHT | wxALL, FromDIP(10));
    SetSizerAndFit(tout);
    fermer->SetFocus();
    majJournal();
    enr_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) {
      char nom[64];
      std::time_t t = std::time(nullptr);
      std::tm g{};
      localtime_s(&g, &t);
      std::strftime(nom, sizeof nom, "ConceptCAD-journal-%Y-%m-%d-%H-%M.txt", &g);
      wxFileDialog d(this, L"Enregistrer le journal d’erreurs", wxEmptyString, wxString::FromUTF8(nom), L"Texte (*.txt)|*.txt", wxFD_SAVE | wxFD_OVERWRITE_PROMPT);
      if (d.ShowModal() != wxID_OK) return;
      std::ofstream f(d.GetPath().ToStdWstring(), std::ios::binary);
      f << journal::texte();
      msg_->SetLabel(f ? L"Fichier enregistré." : L"Enregistrement impossible.");
      Layout();
    });
    cop_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) {
      bool ok = false;
      if (wxTheClipboard->Open()) {
        ok = wxTheClipboard->SetData(new wxTextDataObject(wxString::FromUTF8(journal::texte())));
        wxTheClipboard->Close();
      }
      msg_->SetLabel(ok ? L"Copié." : L"Copie refusée : utilisez Enregistrer.");
      Layout();
    });
    vid_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) {
      journal::vider();
      majJournal();
      msg_->SetLabel(L"Journal vidé.");
      Layout();
    });
    CentreOnParent();
  }

 private:
  void majJournal() {
    const size_t n = journal::nombre();
    wxString t = L"Aucune erreur notée.";
    if (n == 1) t = L"1 erreur notée : " + wxString::FromUTF8(journal::dernierMessage());
    else if (n > 1) t = wxString::Format(L"%d erreurs différentes notées. Dernière : ", static_cast<int>(n)) + wxString::FromUTF8(journal::dernierMessage());
    etat_->SetLabel(t);
    etat_->Wrap(FromDIP(860));
    enr_->Enable(n > 0);
    cop_->Enable(n > 0);
    vid_->Enable(n > 0);
  }
  wxStaticText* etat_ = nullptr;
  wxStaticText* msg_ = nullptr;
  wxButton* enr_ = nullptr;
  wxButton* cop_ = nullptr;
  wxButton* vid_ = nullptr;
};
}  // namespace

wxDialog* creerAide(wxWindow* parent) { return new FenetreAide(parent); }

void ouvrirAide(wxWindow* parent) {
  FenetreAide f(parent);
  f.ShowModal();
}
