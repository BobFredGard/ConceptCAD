#include "panneau_props.h"

#include <wx/dcbuffer.h>
#include <wx/graphics.h>
#include <wx/wrapsizer.h>

#include <cmath>

#include "theme.h"

namespace {
wxColour cCarte() { return th(wxColour(0x2a, 0x2c, 0x30)); }
wxColour cClair() { return th(wxColour(0xf5, 0xf5, 0xf7)); }
wxColour cGris() { return th(wxColour(0x98, 0x98, 0x9d)); }
wxColour cCase() { return th(wxColour(0x1c, 0x1c, 0x1e)); }
wxColour cTuile() { return th(wxColour(0x32, 0x34, 0x39)); }
wxColour cTuileSurvol() { return th(wxColour(0x3a, 0x3c, 0x42)); }
wxColour cBord() { return th(wxColour(0x44, 0x46, 0x4c)); }
wxColour cVert() { return th(wxColour(0x30, 0xd1, 0x58)); }
wxColour cBleu() { return th(wxColour(0x0a, 0x84, 0xff)); }
const int LARGEUR_CASE = 132;  // DIP : la colonne des cases, à droite
wxFont police(const wxWindow* w, double px, bool gras = false) {
  wxFontInfo i(wxSize(0, static_cast<int>(std::lround(px * w->GetDPIScaleFactor()))));
  i.FaceName("Arial");
  if (gras) i.Bold();
  return wxFont(i);
}
bool lectureSeule(const wxPGProperty* p) { return p->HasFlag(wxPGFlags::ReadOnly) || !p->IsEnabled(); }
// « ⊚ Simple » → symbole « ⊚ » et nom « Simple » : la tuile met le symbole au-dessus
void separerSymbole(const wxString& t, wxString& symbole, wxString& texte) {
  symbole.clear();
  texte = t;
  const int esp = t.Find(L' ');
  if (esp <= 0 || esp > 3) return;
  for (int k = 0; k < esp; k++)
    if (wxIsalnum(t[k]) || t[k] == L'(' || t[k] == L'-') return;
  symbole = t.Left(esp);
  texte = t.Mid(esp + 1);
}
// Les choix courts deviennent des tuiles, comme Type ou Fin du perçage dans le navigateur
bool enTuiles(const wxPGChoices& c) {
  if (c.GetCount() < 2 || c.GetCount() > 6) return false;
  for (unsigned k = 0; k < c.GetCount(); k++) {
    wxString s, t;
    separerSymbole(c.GetLabel(k), s, t);
    if (t.length() > 14 || t.Find(L':') != wxNOT_FOUND) return false;
  }
  return true;
}
wxStaticText* libelle(wxWindow* w, const wxString& t, double px = 12) {
  auto* s = new wxStaticText(w, wxID_ANY, t);
  s->SetFont(police(w, px));
  s->SetForegroundColour(cGris());
  return s;
}
}  // namespace

// ---------- tuile ----------
Tuile::Tuile(wxWindow* parent, const wxString& nom, const wxString& texte, const wxString& aide)
    : wxWindow(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxFULL_REPAINT_ON_RESIZE, nom) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  separerSymbole(texte, symbole_, texte_);
  fond_ = cCarte();
  if (!aide.empty() && aide != texte) SetToolTip(aide);
  SetFont(police(this, 11.5, true));
  wxClientDC dc(this);
  dc.SetFont(GetFont());
  const int l = std::max(FromDIP(62), dc.GetTextExtent(texte_).x + FromDIP(18));
  SetMinSize(wxSize(l, FromDIP(symbole_.empty() ? 32 : 46)));
  SetCursor(wxCursor(wxCURSOR_HAND));
  Bind(wxEVT_PAINT, &Tuile::peindre, this);
  Bind(wxEVT_ENTER_WINDOW, [this](wxMouseEvent&) { survol_ = true; Refresh(); });
  Bind(wxEVT_LEAVE_WINDOW, [this](wxMouseEvent&) { survol_ = false; Refresh(); });
  Bind(wxEVT_LEFT_UP, [this](wxMouseEvent&) {
    if (surClic) surClic();
  });
}
void Tuile::actif(bool oui) {
  if (oui == actif_) return;
  actif_ = oui;
  Refresh();
}
void Tuile::fond(const wxColour& c) { fond_ = c; }
void Tuile::themeChange(int de, int vers) {
  fond_ = theme::passer(fond_, de, vers);
  Refresh();
}
void Tuile::peindre(wxPaintEvent&) {
  wxAutoBufferedPaintDC dc(this);
  dc.SetBackground(wxBrush(fond_));
  dc.Clear();
  std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::Create(dc));
  const wxSize t = GetClientSize();
  const double e = actif_ ? FromDIP(2) : FromDIP(1);
  g->SetBrush(wxBrush(survol_ ? cTuileSurvol() : cTuile()));
  g->SetPen(wxPen(actif_ ? cVert() : cBord(), static_cast<int>(e)));
  g->DrawRoundedRectangle(e / 2, e / 2, t.x - e, t.y - e, FromDIP(7));
  const wxColour c = actif_ ? cBleu() : cClair();
  dc.SetTextForeground(c);
  dc.SetFont(GetFont());
  const wxSize m = dc.GetTextExtent(texte_);
  if (symbole_.empty()) {
    dc.DrawText(texte_, (t.x - m.x) / 2, (t.y - m.y) / 2);
    return;
  }
  wxFont fs(wxFontInfo(wxSize(0, FromDIP(14))).FaceName("Segoe UI Symbol"));
  dc.SetFont(fs);
  const wxSize ms = dc.GetTextExtent(symbole_);
  dc.DrawText(symbole_, (t.x - ms.x) / 2, FromDIP(5));
  dc.SetFont(GetFont());
  dc.DrawText(texte_, (t.x - m.x) / 2, t.y - m.y - FromDIP(6));
}

// ---------- panneau ----------
PanneauProps::PanneauProps(wxWindow* parent, wxPropertyGrid* grille) : g_(grille) {
  Create(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxVSCROLL | wxBORDER_NONE, L"panneauProps");
  SetScrollRate(0, FromDIP(14));
  ShowScrollbars(wxSHOW_SB_NEVER, wxSHOW_SB_DEFAULT);
  SetSizer(new wxBoxSizer(wxVERTICAL));
}

int PanneauProps::hauteurVoulue() const { return GetSizer()->CalcMin().y; }

std::string PanneauProps::signature(bool valeurs) const {
  std::string s;
  for (wxPropertyGridIterator it = g_->GetIterator(wxPG_ITERATE_VISIBLE); !it.AtEnd(); it++) {
    const wxPGProperty* p = *it;
    s += p->GetName().utf8_string() + '\x1f' + p->GetLabel().utf8_string() + '\x1f';
    if (valeurs) {
      s += p->GetValueAsString().utf8_string();
    } else {
      s += p->IsCategory() ? "c" : lectureSeule(p) ? "l" : dynamic_cast<const wxBoolProperty*>(p) ? "b" : dynamic_cast<const wxEnumProperty*>(p) ? "e" : "t";
      if (const auto* e = dynamic_cast<const wxEnumProperty*>(p))
        for (unsigned k = 0; k < e->GetChoices().GetCount(); k++) s += '\x1e' + e->GetChoices().GetLabel(k).utf8_string();
      s += '\x1e' + p->GetHelpString().utf8_string();
    }
    s += '\x1d';
  }
  return s;
}

bool PanneauProps::synchroniser() {
  const std::string st = signature(false);
  if (st != structure_) {
    structure_ = st;
    valeurs_ = signature(true);
    reconstruire();
    return true;
  }
  // Même structure, mais la grille a pu être vidée puis remplie : on reprend ses propriétés dans le même ordre
  size_t i = 0;
  for (wxPropertyGridIterator it = g_->GetIterator(wxPG_ITERATE_VISIBLE); !it.AtEnd() && i < lignes_.size(); it++) lignes_[i++].p = *it;
  const std::string v = signature(true);
  if (v != valeurs_) {
    valeurs_ = v;
    rafraichir();
  }
  return false;
}

void PanneauProps::changer(const wxString& nom, const wxVariant& v) {
  // Le réglage peut vider la grille et la remplir à nouveau : on sort d'abord de l'événement de ce bouton ou de ce champ
  CallAfter([this, nom, v] {
    if (wxPGProperty* q = g_->GetPropertyByName(nom)) g_->ChangePropertyValue(q, v);
    synchroniser();
  });
}

void PanneauProps::reconstruire() {
  nbRefaits++;
  Freeze();
  wxSizer* s = GetSizer();
  vidage_ = true;
  s->Clear(true);
  vidage_ = false;
  lignes_.clear();
  SetBackgroundColour(cCarte());
  bool premier = true;
  for (wxPropertyGridIterator it = g_->GetIterator(wxPG_ITERATE_VISIBLE); !it.AtEnd(); it++) {
    wxPGProperty* p = *it;
    Ligne L;
    L.p = p;
    L.titre = p->GetLabel();
    const wxString aide = p->GetHelpString();
    const wxString nom = p->GetName();
    if (p->IsCategory()) {
      L.sorte = Ligne::TITRE;
      auto* t = libelle(this, p->GetLabel().Upper(), 11.5);
      t->SetFont(police(this, 11.5, true));
      s->Add(t, 0, wxEXPAND | wxTOP | wxBOTTOM, FromDIP(premier ? 2 : 14));
    } else if (lectureSeule(p) && p->GetLabel().empty()) {
      L.sorte = Ligne::LECTURE;  // le nom de la fonction, sous le titre, comme dans le navigateur
      L.valeur = new wxStaticText(this, wxID_ANY, p->GetValueAsString());
      L.valeur->SetFont(police(this, 12, true));
      L.valeur->SetForegroundColour(cGris());
      L.valeur->Wrap(FromDIP(260));
      s->Add(L.valeur, 0, wxEXPAND | wxTOP, FromDIP(2));
    } else if (lectureSeule(p)) {
      L.sorte = Ligne::LECTURE;
      auto* r = new wxBoxSizer(wxHORIZONTAL);
      auto* t = libelle(this, p->GetLabel());
      L.valeur = new wxStaticText(this, wxID_ANY, p->GetValueAsString());
      L.valeur->SetFont(police(this, 12));
      L.valeur->SetForegroundColour(cClair());
      L.valeur->Wrap(FromDIP(LARGEUR_CASE));
      r->Add(t, 1, wxRIGHT, FromDIP(6));
      r->Add(L.valeur, 0);
      L.valeur->SetMinSize(wxSize(FromDIP(LARGEUR_CASE), -1));
      s->Add(r, 0, wxEXPAND | wxTOP, FromDIP(6));
      if (!aide.empty()) t->SetToolTip(aide), L.valeur->SetToolTip(aide);
    } else if (dynamic_cast<wxBoolProperty*>(p)) {
      L.sorte = Ligne::COCHE;
      L.coche = new wxStaticText(this, wxID_ANY, (p->GetValue().GetBool() ? L"☑  " : L"☐  ") + p->GetLabel());
      L.coche->SetName(nom);
      L.coche->SetFont(police(this, 12.5));
      L.coche->SetForegroundColour(cClair());
      L.coche->SetCursor(wxCursor(wxCURSOR_HAND));
      if (!aide.empty()) L.coche->SetToolTip(aide);
      L.coche->Bind(wxEVT_LEFT_UP, [this, nom](wxMouseEvent&) {
        if (const wxPGProperty* q = g_->GetPropertyByName(nom)) changer(nom, wxVariant(!q->GetValue().GetBool()));
      });
      s->Add(L.coche, 0, wxTOP, FromDIP(8));
    } else if (auto* e = dynamic_cast<wxEnumProperty*>(p)) {
      const wxPGChoices& c = e->GetChoices();
      const long v = p->GetValue().GetLong();
      std::vector<long> valeurs;
      for (unsigned k = 0; k < c.GetCount(); k++) valeurs.push_back(c.GetValue(k));
      auto* t = libelle(this, p->GetLabel());
      if (!aide.empty()) t->SetToolTip(aide);
      if (enTuiles(c)) {
        L.sorte = Ligne::TUILES;
        s->Add(t, 0, wxTOP, FromDIP(12));
        auto* r = new wxWrapSizer(wxHORIZONTAL);
        for (unsigned k = 0; k < c.GetCount(); k++) {
          auto* b = new Tuile(this, nom + wxString::Format(L"#%u", k), c.GetLabel(k), aide);
          b->fond(cCarte());
          b->actif(c.GetValue(k) == v);
          const long val = c.GetValue(k);
          b->surClic = [this, nom, val] { changer(nom, wxVariant(val)); };
          r->Add(b, 0, wxRIGHT | wxBOTTOM, FromDIP(5));
          L.tuiles.push_back(b);
        }
        s->Add(r, 0, wxEXPAND | wxTOP, FromDIP(6));
      } else {
        L.sorte = Ligne::LISTE;
        auto* r = new wxBoxSizer(wxHORIZONTAL);
        L.liste = new wxChoice(this, wxID_ANY);
        L.liste->SetName(nom);
        for (unsigned k = 0; k < c.GetCount(); k++) {
          L.liste->Append(c.GetLabel(k));
          if (c.GetValue(k) == v) L.liste->SetSelection(static_cast<int>(k));
        }
        L.liste->SetFont(police(this, 12));
        L.liste->SetMinSize(wxSize(FromDIP(LARGEUR_CASE), -1));
        L.liste->SetMaxSize(wxSize(FromDIP(LARGEUR_CASE), -1));
        L.liste->SetToolTip(aide.empty() ? L.liste->GetStringSelection() : aide);
        L.liste->Bind(wxEVT_CHOICE, [this, nom, valeurs](wxCommandEvent& ev) {
          const int k = ev.GetSelection();
          if (k >= 0 && k < static_cast<int>(valeurs.size())) changer(nom, wxVariant(valeurs[k]));
        });
        r->Add(t, 1, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(6));
        r->Add(L.liste, 0, wxALIGN_CENTER_VERTICAL);
        s->Add(r, 0, wxEXPAND | wxTOP, FromDIP(8));
      }
    } else {
      L.sorte = Ligne::TEXTE;
      auto* r = new wxBoxSizer(wxHORIZONTAL);
      auto* t = libelle(this, p->GetLabel());
      t->Wrap(FromDIP(118));
      auto* boite = new wxPanel(this, wxID_ANY);
      boite->SetBackgroundColour(cCase());
      boite->SetMinSize(wxSize(FromDIP(LARGEUR_CASE), -1));
      L.texte = new wxTextCtrl(boite, wxID_ANY, p->GetValueAsString(), wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_ENTER | wxBORDER_NONE);
      L.texte->SetName(nom);
      L.texte->SetBackgroundColour(cCase());
      L.texte->SetForegroundColour(cClair());
      L.texte->SetFont(police(this, 12.5));
      if (!aide.empty()) L.texte->SetToolTip(aide), t->SetToolTip(aide);
      auto* bs = new wxBoxSizer(wxHORIZONTAL);
      bs->Add(L.texte, 1, wxALIGN_CENTER_VERTICAL | wxLEFT | wxRIGHT, FromDIP(7));
      boite->SetSizer(bs);
      boite->SetMinSize(wxSize(FromDIP(LARGEUR_CASE), FromDIP(26)));
      r->Add(t, 1, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(6));
      r->Add(boite, 0, wxALIGN_CENTER_VERTICAL);
      s->Add(r, 0, wxEXPAND | wxTOP, FromDIP(8));
      wxTextCtrl* champ = L.texte;
      const auto valider = [this, nom, champ] {
        if (vidage_ || champ->IsBeingDeleted()) return;
        const wxPGProperty* q = g_->GetPropertyByName(nom);
        if (q && champ->GetValue() != q->GetValueAsString()) changer(nom, wxVariant(champ->GetValue()));
      };
      champ->Bind(wxEVT_TEXT_ENTER, [valider](wxCommandEvent&) { valider(); });
      champ->Bind(wxEVT_KILL_FOCUS, [valider](wxFocusEvent& ev) {
        ev.Skip();
        valider();
      });
      if (surChampTexte) surChampTexte(champ);
    }
    premier = false;
    lignes_.push_back(L);
  }
  FitInside();
  Layout();
  Thaw();
  if (surTaille) surTaille();
}

void PanneauProps::rafraichir() {
  nbRafraichis++;
  for (Ligne& L : lignes_) {
    wxPGProperty* p = L.p;
    if (L.valeur) {
      L.valeur->SetLabel(p->GetValueAsString());
      L.valeur->Wrap(FromDIP(p->GetLabel().empty() ? 260 : LARGEUR_CASE));
    }
    if (L.texte && wxWindow::FindFocus() != L.texte) L.texte->ChangeValue(p->GetValueAsString());
    if (L.coche) L.coche->SetLabel((p->GetValue().GetBool() ? L"☑  " : L"☐  ") + L.titre);
    if (auto* e = dynamic_cast<wxEnumProperty*>(p)) {
      const long v = p->GetValue().GetLong();
      const wxPGChoices& c = e->GetChoices();
      for (size_t k = 0; k < L.tuiles.size() && k < c.GetCount(); k++) L.tuiles[k]->actif(c.GetValue(static_cast<unsigned>(k)) == v);
      if (L.liste)
        for (unsigned k = 0; k < c.GetCount(); k++)
          if (c.GetValue(k) == v) L.liste->SetSelection(static_cast<int>(k));
    }
  }
  FitInside();
  Layout();
  if (surTaille) surTaille();
}

bool PanneauProps::essaiRegler(const wxString& nom, const wxString& valeur) {
  synchroniser();
  for (Ligne& L : lignes_) {
    if (L.p->GetName() != nom) continue;
    if (L.texte) {
      L.texte->ChangeValue(valeur);
      wxCommandEvent ev(wxEVT_TEXT_ENTER, L.texte->GetId());
      ev.SetEventObject(L.texte);
      L.texte->ProcessWindowEvent(ev);
      return true;
    }
    if (L.coche) {
      if ((valeur == L"1") != L.p->GetValue().GetBool()) {
        wxMouseEvent ev(wxEVT_LEFT_UP);
        ev.SetEventObject(L.coche);
        L.coche->ProcessWindowEvent(ev);
      }
      return true;
    }
    const auto* e = dynamic_cast<wxEnumProperty*>(L.p);
    if (!e) return false;
    for (unsigned k = 0; k < e->GetChoices().GetCount(); k++) {
      if (e->GetChoices().GetLabel(k) != valeur) continue;
      if (k < L.tuiles.size()) L.tuiles[k]->surClic();
      else if (L.liste) {
        L.liste->SetSelection(static_cast<int>(k));
        wxCommandEvent ev(wxEVT_CHOICE, L.liste->GetId());
        ev.SetInt(static_cast<int>(k));
        ev.SetEventObject(L.liste);
        L.liste->ProcessWindowEvent(ev);
      }
      return true;
    }
    return false;
  }
  return false;
}

std::vector<std::string> PanneauProps::essaiLignes() const {
  static const char* const sortes[] = {"titre", "lecture", "texte", "coche", "tuiles", "liste"};
  std::vector<std::string> l;
  for (const Ligne& L : lignes_) l.push_back(std::string(sortes[L.sorte]) + " [" + L.p->GetName().utf8_string() + "] " + L.titre.utf8_string() + " = " + L.p->GetValueAsString().utf8_string());
  return l;
}
