#include "fiche_vue.h"

#include <algorithm>
#include <cmath>

#include <wx/dcbuffer.h>

#include "interface_esquisse.h"
#include "rendu_curseur.h"
#include "rendu_scene.h"

namespace {
const wxColour FOND(0x2a, 0x2c, 0x30), TEXTE(0xf5, 0xf5, 0xf7), DISCRET(0x98, 0x98, 0x9d);
wxString enTexte(double v) {
  wxString t = wxString::Format("%.2f", v);
  t.Replace(".", ",");
  while (t.EndsWith("0")) t.RemoveLast();
  if (t.EndsWith(",")) t.RemoveLast();
  return t;
}
}  // namespace

FicheVue::FicheVue(wxWindow* parent, Vue3D* vue) : wxPanel(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxBORDER_SIMPLE | wxCLIP_CHILDREN), vue_(vue) {
  SetBackgroundColour(FOND);
  SetForegroundColour(TEXTE);
}

void FicheVue::change(bool refaireApres) {
  if (surChange) surChange();
  if (refaireApres) CallAfter([this] { refaire(); });
}

wxBoxSizer* FicheVue::rang() {
  auto* s = new wxBoxSizer(wxHORIZONTAL);
  boite_->Add(s, 0, wxEXPAND | wxLEFT | wxRIGHT | wxTOP, FromDIP(3));
  return s;
}

void FicheVue::titre(const wxString& t) {
  auto* l = new wxStaticText(this, wxID_ANY, t);
  l->SetForegroundColour(DISCRET);
  wxFont f = l->GetFont();
  f.MakeBold();
  l->SetFont(f);
  boite_->Add(l, 0, wxLEFT | wxTOP, FromDIP(5));
}

void FicheVue::coche(wxSizer* s, const wxString& t, bool* v) {
  auto* c = new wxCheckBox(this, wxID_ANY, t);
  c->SetForegroundColour(TEXTE);
  c->SetValue(*v);
  c->Bind(wxEVT_CHECKBOX, [this, c, v](wxCommandEvent&) {
    *v = c->GetValue();
    change();
    if (surFin) surFin();
  });
  s->Add(c, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(8));
}

void FicheVue::liste(const wxString& t, const std::vector<std::pair<std::string, wxString>>& L, const std::string& actuel, std::function<void(const std::string&)> f) {
  auto* s = rang();
  auto* l = new wxStaticText(this, wxID_ANY, t);
  l->SetForegroundColour(TEXTE);
  s->Add(l, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(5));
  auto* c = new wxChoice(this, wxID_ANY);
  std::vector<std::string> cles;
  int sel = 0;
  for (const auto& [k, n] : L) {
    if (k == actuel) sel = static_cast<int>(cles.size());
    c->Append(n);
    cles.push_back(k);
  }
  c->SetSelection(sel);
  c->Bind(wxEVT_CHOICE, [this, c, cles, f](wxCommandEvent&) {
    const std::string k = cles[c->GetSelection()];
    CallAfter([this, f, k] {
      f(k);
      if (surFin) surFin();
    });
  });
  s->Add(c, 1, wxEXPAND);
}

void FicheVue::refaire() {
  if (!o) return;
  Freeze();
  DestroyChildren();
  boite_ = new wxBoxSizer(wxVERTICAL);
  titre(L"Vues");
  {
    auto* s = rang();
    const std::pair<const wchar_t*, const char*> V[] = {{L"Iso", "iso"}, {L"Dessus", "top"}, {L"Face", "front"}, {L"Droite", "right"}};
    const auto bouton = [&](const wxString& t, std::function<void()> f) {
      auto* b = new BoutonEsquisse(this, wxID_ANY, t, t, BoutonEsquisse::ENCADRE);
      b->titre(t);
      b->fond(FOND);
      b->SetMinSize(wxSize(GetTextExtent(t).x + FromDIP(8), FromDIP(22)));
      b->surClic = f;
      s->Add(b, 1, wxRIGHT, FromDIP(2));
    };
    for (const auto& [t, k] : V) {
      const std::string q = k;
      bouton(t, [this, q] { vue_->vueStandard(q); });
    }
    bouton(L"Tout afficher", [this] { vue_->ajuster(); });
  }
  titre(L"Affichage");
  liste(L"Environnement", {{"actuel", L"Actuel (CAO)"}, {"rendu", L"Rendu direct (réglages RENDU)"}, {"studio", L"Studio"}, {"clair", L"Studio lumineux"}, {"atelier", L"Atelier"}, {"exterieur", L"Extérieur"}, {"noir", L"Scène noire"}}, o->env, [this](const std::string& k) {
    o->env = k;
    change();
  });
  {
    std::vector<std::pair<std::string, wxString>> L{{"", L"Aucun (couleur de l'ambiance)"}};
    for (const SupportRendu& b : supportsRendu()) L.push_back({b.cle, wxString(b.famille) + L" : " + b.nom});
    liste(L"Support", L, support ? *support : std::string(), [this](const std::string& k) {
      if (support) *support = k;
      if (!k.empty()) o->sol = true;  // un support choisi se voit
      change(true);
    });
  }
  {
    auto* s = rang();
    coche(s, L"Sol", &o->sol);
    coche(s, L"Miroir", &o->miroir);
    coche(s, L"Ombre", &o->ombre);
  }
  liste(L"Arêtes", {{"off", L"Masquées"}, {"on", L"Vives noires / tangentes grises"}}, o->aretes ? "on" : "off", [this](const std::string& k) {
    o->aretes = k == "on";
    change();
  });
  {
    auto* s = rang();
    coche(s, L"Repère (axes XYZ)", &o->axes);
    coche(s, L"Inverser le zoom", &o->zoomInverse);
  }
  liste(L"Orbite", {{"contrainte", L"Contrainte (Z en haut)"}, {"libre", L"Libre (tous les sens)"}}, o->orbiteLibre ? "libre" : "contrainte", [this](const std::string& k) {
    o->orbiteLibre = k == "libre";
    change();
  });
  {
    auto* s = rang();
    auto* l = new wxStaticText(this, wxID_ANY, L"Perspective");
    l->SetForegroundColour(TEXTE);
    s->Add(l, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(5));
    auto* c = new Curseur(this, o->fov, 5, 90, 1);
    auto* v = new wxStaticText(this, wxID_ANY, wxString::Format(L"%d°", static_cast<int>(std::lround(o->fov))), wxDefaultPosition, FromDIP(wxSize(30, -1)), wxALIGN_RIGHT | wxST_NO_AUTORESIZE);
    v->SetForegroundColour(DISCRET);
    s->Add(c, 1, wxEXPAND);
    s->Add(v, 0, wxALIGN_CENTER_VERTICAL);
    c->surValeur = [this, v](double x) {
      o->fov = x;
      v->SetLabel(wxString::Format(L"%d°", static_cast<int>(std::lround(x))));
      change();
    };
    c->surFin = [this] {
      if (surFin) surFin();
    };
    c->Bind(wxEVT_LEFT_DCLICK, [this](wxMouseEvent&) {  // double-clic : retour à 50°
      o->fov = 50;
      change(true);
      if (surFin) surFin();
    });
  }
  titre(L"Coupe");
  {
    auto* s = rang();
    coche(s, L"Activer la coupe", &o->coupe);
    auto* l = new wxStaticText(this, wxID_ANY, L"Axe");
    l->SetForegroundColour(TEXTE);
    s->Add(l, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(4));
    auto* c = new wxChoice(this, wxID_ANY);
    c->Append(L"X");
    c->Append(L"Y");
    c->Append(L"Z (hauteur)");
    c->SetSelection(o->coupeAxe);
    c->Bind(wxEVT_CHOICE, [this, c](wxCommandEvent&) {
      o->coupeAxe = c->GetSelection();
      CallAfter([this] {
        // le curseur couvre l'emprise des corps sur l'axe choisi : on repart du milieu
        double b[6];
        if (vue_->boiteVisible(b)) o->coupePos = (b[o->coupeAxe] + b[o->coupeAxe + 3]) / 2;
        change(true);
      });
    });
    s->Add(c, 1, wxEXPAND);
  }
  {
    double b[6] = {-100, -100, -100, 100, 100, 100};
    vue_->boiteVisible(b);
    const double a = b[o->coupeAxe], z = b[o->coupeAxe + 3], m = std::max((z - a) * 0.02, 0.01);
    const double mini = a - m, maxi = z + m, pas = std::max((maxi - mini) / 400, 0.001);
    auto* s = rang();
    auto* c = new Curseur(this, std::clamp(o->coupePos, mini, maxi), mini, maxi, pas);
    auto* n = new wxTextCtrl(this, wxID_ANY, enTexte(o->coupePos), wxDefaultPosition, FromDIP(wxSize(64, -1)), wxTE_PROCESS_ENTER);
    s->Add(c, 1, wxEXPAND | wxRIGHT, FromDIP(4));
    s->Add(n, 0);
    c->surValeur = [this, n](double x) {
      o->coupePos = x;
      n->ChangeValue(enTexte(x));
      change();
    };
    c->surFin = [this] {
      if (surFin) surFin();
    };
    const auto valider = [this, n] {
      wxString t = n->GetValue();
      t.Replace(",", ".");
      double x;
      if (t.ToCDouble(&x) && x != o->coupePos) {
        o->coupePos = x;
        change(true);
        if (surFin) surFin();
      }
    };
    n->Bind(wxEVT_TEXT_ENTER, [valider](wxCommandEvent&) { valider(); });
    n->Bind(wxEVT_KILL_FOCUS, [valider](wxFocusEvent& e) {
      valider();
      e.Skip();
    });
  }
  {
    auto* s = rang();
    coche(s, L"Inverser côté", &o->coupeInverse);
    coche(s, L"Remplir la coupe", &o->coupeRemplie);
  }
  {
    auto* s = rang();
    coche(s, L"Afficher le plan", &o->coupePlan);
  }
  auto* note = new wxStaticText(this, wxID_ANY, L"Plan de coupe global sur les corps visibles ; le curseur couvre l'emprise des corps sur l'axe choisi.");
  note->SetForegroundColour(DISCRET);
  note->Wrap(FromDIP(286));
  boite_->Add(note, 0, wxALL, FromDIP(5));
  SetSizer(boite_, true);
  hauteur_ = boite_->CalcMin().y + FromDIP(4);
  Layout();
  Thaw();
}
