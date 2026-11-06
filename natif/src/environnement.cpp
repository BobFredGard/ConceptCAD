#include "environnement.h"

#include <wx/dcbuffer.h>
#include <wx/graphics.h>

#include <algorithm>
#include <cmath>
#include <memory>

namespace {
struct FicheRuban {
  const wchar_t* texte;
  const wchar_t* titre;
  const char* svg;
  const wchar_t* couleur;
  bool groupe;
};
struct FicheHaut {
  const wchar_t* titre;
  const char* svg;
};
#include "environnement_donnees.inc"

const wxColour C_FOND(0x1c, 0x1c, 0x1e), C_BARRE(0x2a, 0x2c, 0x30), C_BORD(0x3a, 0x3a, 0x3d), C_TEXTE(0xf5, 0xf5, 0xf7), C_DISCRET(0x98, 0x98, 0x9d), C_BLEU(0x0a, 0x84, 0xff), C_VERT(0x30, 0xd1, 0x58), C_ROUGE(0xff, 0x45, 0x3a), C_ORANGE(0xff, 0x9f, 0x0a), C_CHAMP(0x38, 0x3a, 0x3e);

wxFont police(double px, bool gras = false) {
  wxFontInfo i(wxSize(0, static_cast<int>(std::lround(px))));
  i.FaceName("Arial");
  if (gras) i.Bold();
  return wxFont(i);
}
void ecrire(wxDC& dc, const wxWindow* w, const wxString& t, double x, double y, double taille, const wxColour& c, bool gras = false) {
  const double f = w->GetDPIScaleFactor();
  dc.SetFont(police(taille * f, gras));
  dc.SetTextForeground(c);
  dc.SetBackgroundMode(wxBRUSHSTYLE_TRANSPARENT);
  dc.DrawText(t, static_cast<int>(std::lround(x * f)), static_cast<int>(std::lround(y * f)));
}
wxSize mesure(const wxWindow* w, const wxString& t, double taille, bool gras = false) {
  const double f = w->GetDPIScaleFactor();
  wxClientDC dc(const_cast<wxWindow*>(w));
  dc.SetFont(police(taille * f, gras));
  const wxSize s = dc.GetTextExtent(t);
  return wxSize(static_cast<int>(s.x / f), static_cast<int>(s.y / f));
}
wxRect rectDip(const wxWindow* w, int x, int y, int l, int h) { return wxRect(w->FromDIP(wxPoint(x, y)), w->FromDIP(wxSize(l, h))); }
std::unique_ptr<wxGraphicsContext> contexte(wxDC& dc, const wxWindow* w) {
  std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::CreateFromUnknownDC(dc));
  if (g) {
    const double f = w->GetDPIScaleFactor();
    g->Scale(f, f);
  }
  return g;
}
}  // namespace

const char* iconeVue(int i) { return BOUTONS_VUE[i].svg; }
const char* iconeRubanCao(int i) { return RUBAN_CAO[i].svg; }

// ---------- Barre du haut ----------
BarreHaute::BarreHaute(wxWindow* parent) : wxWindow(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxFULL_REPAINT_ON_RESIZE) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  SetMinSize(FromDIP(wxSize(-1, 53)));
  const struct {
    const wchar_t* nom;
    const wchar_t* aide;
    Atelier a;
  } lesAteliers[] = {{L"CAO", L"Modélisation : esquisses, solides", Atelier::CAO},
                     {L"FAO", L"Usinage : posages, opérations, simulation, G-code", Atelier::FAO},
                     {L"PLAN", L"Mise en plan : planches, vues projetées, cotes, dessin 2D", Atelier::PLAN},
                     {L"RENDU", L"Rendu : image réaliste 1920×1080 — matériaux, ambiances, appareil photo", Atelier::RENDU}};
  for (const auto& x : lesAteliers) {
    auto* b = new BoutonEsquisse(this, wxID_ANY, x.nom, x.aide, BoutonEsquisse::PASTILLE);
    b->titre(x.nom);
    b->fond(C_CHAMP);
    const Atelier a = x.a;
    b->surClic = [this, a] {
      if (surAtelier) surAtelier(a);
    };
    ateliers_.push_back(b);
  }
  // Annuler, Rétablir | Nouveau, Ouvrir, Récent, Enregistrer, Sous, Dossier
  std::vector<std::function<void()>*> actions = {&surAnnuler, &surRetablir, nullptr, &surOuvrir, nullptr, &surEnregistrer, &surEnregistrerSous, nullptr};
  for (size_t i = 0; i < actions.size() && BARRE_HAUTE[i].titre; i++) {
    const wxString titre = BARRE_HAUTE[i].titre;
    auto* a = actions[i];
    auto* b = new BoutonEsquisse(this, wxID_ANY, titre.BeforeFirst(L'(').Trim(), a ? titre : titre + L" : pas encore dans le logiciel Windows");
    b->iconeComplete(BARRE_HAUTE[i].svg, C_TEXTE);
    if (a) {
      b->surClic = [a, b] {
        if (b->estDisponible() && *a) (*a)();
      };
    } else {
      b->disponible(false);
      b->surClic = [this, titre] {
        if (surIndisponible) surIndisponible(titre);
      };
    }
    icones_.push_back(b);
  }
  regenerer_ = new BoutonEsquisse(this, wxID_ANY, L"Régénérer", L"Régénérer tout le modèle", BoutonEsquisse::TEXTE);
  regenerer_->titre(L"⟳ Régénérer");
  regenerer_->surClic = [this] {
    if (regenerer_->estDisponible() && surRegenerer) surRegenerer();
  };
  theme_ = new BoutonEsquisse(this, wxID_ANY, L"Couleurs", L"Couleurs et icônes de l'interface : pas encore dans le logiciel Windows", BoutonEsquisse::ENCADRE);
  for (size_t i = 0; BARRE_HAUTE[i].titre; i++)
    if (wxString(BARRE_HAUTE[i].titre).StartsWith(L"Couleurs")) theme_->iconeComplete(BARRE_HAUTE[i].svg, C_TEXTE);
  theme_->disponible(false);
  theme_->surClic = [this] {
    if (surIndisponible) surIndisponible(L"Couleurs et icônes");
  };
  Bind(wxEVT_SIZE, [this](wxSizeEvent& e) {
    placer();
    e.Skip();
  });
  Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(C_FOND));
    dc.Clear();
    const wxSize t = ToDIP(GetClientSize());
    {
      auto g = contexte(dc, this);
      if (!g) return;
      g->SetBrush(g->CreateBrush(wxBrush(C_BARRE)));
      g->SetPen(g->CreatePen(wxGraphicsPenInfo(C_BORD, 1)));
      g->DrawRoundedRectangle(12.5, 10.5, t.x - 25, 42, 12);
      // Le logo : un carré arrondi coupé en deux
      g->SetPen(g->CreatePen(wxGraphicsPenInfo(C_TEXTE, 1.6)));
      g->SetBrush(wxNullGraphicsBrush);
      g->DrawRoundedRectangle(26, 25, 12, 14, 3);
      g->SetBrush(g->CreateBrush(wxBrush(C_TEXTE)));
      g->DrawRectangle(28, 26, 3.5, 12);
      // Le cadre des ateliers
      g->SetPen(wxNullGraphicsPen);
      g->SetBrush(g->CreateBrush(wxBrush(C_CHAMP)));
      g->DrawRoundedRectangle(165, 19, 251, 26, 10);
      g->SetPen(g->CreatePen(wxGraphicsPenInfo(wxColour(0x44, 0x46, 0x4a), 1)));
      g->StrokeLine(508.5, 22, 508.5, 42);
      // Le champ de recherche, pas encore repris
      g->SetBrush(g->CreateBrush(wxBrush(wxColour(0x33, 0x35, 0x39))));
      g->DrawRoundedRectangle(753.5, 18.5, 104, 27, 7);
    }
    ecrire(dc, this, L"Concept", 47, 24, 16.5, C_TEXTE, true);
    const int L = mesure(this, L"Concept", 16.5, true).x;
    ecrire(dc, this, L"CAD", 47 + L, 24, 16.5, C_BLEU, true);
    ecrire(dc, this, L"Rechercher", 765, 25, 12.5, wxColour(0x70, 0x70, 0x75));
    ecrire(dc, this, document_, 883, 25, 12.5, C_DISCRET);
    // Le numéro : ce programme n'a pas encore de version à lui
    ecrire(dc, this, L"Essai Windows", t.x - 165, 25, 11.5, C_TEXTE, true);
  });
  placer();
}

void BarreHaute::placer() {
  const int W = std::max(600, ToDIP(GetClientSize()).x);
  const int xa[] = {167, 224, 279, 342}, la[] = {55, 53, 61, 72};
  for (size_t i = 0; i < ateliers_.size(); i++) ateliers_[i]->SetSize(rectDip(this, xa[i], 21, la[i], 22));
  const int xi[] = {428, 466, 513, 551, 589, 627, 665, 703};
  for (size_t i = 0; i < icones_.size(); i++) icones_[i]->SetSize(rectDip(this, xi[i], 18, 38, 28));
  regenerer_->SetSize(rectDip(this, W - 278, 21, 92, 22));
  theme_->SetSize(rectDip(this, W - 63, 18, 38, 28));
  Refresh();
}

void BarreHaute::atelier(Atelier a) {
  for (size_t i = 0; i < ateliers_.size(); i++) ateliers_[i]->actif(static_cast<int>(a) == static_cast<int>(i));
}

void BarreHaute::etats(bool annuler, bool retablir, bool enregistrer, bool document) {
  icones_[0]->disponible(annuler);
  icones_[1]->disponible(retablir);
  icones_[5]->disponible(enregistrer);
  icones_[6]->disponible(document);
  regenerer_->disponible(document);
}

void BarreHaute::document(const wxString& nom) {
  document_ = nom;
  Refresh();
}

// ---------- Ruban ----------
Ruban::Ruban(wxWindow* parent) : wxWindow(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxFULL_REPAINT_ON_RESIZE) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  const struct {
    Atelier a;
    const FicheRuban* t;
  } tables[] = {{Atelier::CAO, RUBAN_CAO}, {Atelier::FAO, RUBAN_FAO}, {Atelier::PLAN, RUBAN_PLAN}};
  for (const auto& x : tables) {
    Groupe g;
    g.atelier = x.a;
    for (const FicheRuban* f = x.t; f->texte; f++) {
      auto* b = new BoutonEsquisse(this, wxID_ANY, f->texte, f->titre, BoutonEsquisse::RUBAN);
      b->titre(f->texte);
      const wxString c = f->couleur;
      b->iconeComplete(f->svg, c.empty() ? C_TEXTE : wxColour(c));
      b->Hide();
      const wxString nom = f->texte;
      const Atelier a = x.a;
      b->surClic = [this, a, nom, b] {
        if (b->estDisponible()) {
          if (surBouton) surBouton(a, nom);
        } else if (surIndisponible) {
          surIndisponible(nom);
        }
      };
      g.boutons.push_back(b);
      g.coupes.push_back(f->groupe);
    }
    groupes_.push_back(std::move(g));
  }
  Bind(wxEVT_SIZE, [this](wxSizeEvent& e) {
    placer();
    e.Skip();
  });
  Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(C_FOND));
    dc.Clear();
    auto g = contexte(dc, this);
    if (!g) return;
    const wxSize t = ToDIP(GetClientSize());
    g->SetBrush(g->CreateBrush(wxBrush(C_BARRE)));
    g->SetPen(g->CreatePen(wxGraphicsPenInfo(C_BORD, 1)));
    g->DrawRoundedRectangle(12.5, 6.5, t.x - 25, t.y - 12, 12);
    g->SetPen(g->CreatePen(wxGraphicsPenInfo(wxColour(0x44, 0x46, 0x4a), 1)));
    for (const wxRect& r : traits_) g->StrokeLine(r.x + 0.5, r.y, r.x + 0.5, r.y + r.height);
  });
}

void Ruban::atelier(Atelier a) {
  courant_ = a;
  for (const Groupe& g : groupes_)
    for (size_t i = 0; i < g.boutons.size(); i++) {
      const bool ici = g.atelier == a;
      g.boutons[i]->Show(ici);
      if (ici && estRepris) g.boutons[i]->disponible(estRepris(a, g.boutons[i]->GetLabel()));
    }
  placer();
}

void Ruban::placer() {
  const int W = std::max(300, ToDIP(GetClientSize()).x);
  const int H = 44, gauche = 25, droite = W - 25;
  int x = gauche, y = 13;
  traits_.clear();
  for (const Groupe& g : groupes_) {
    if (g.atelier != courant_) continue;
    for (size_t i = 0; i < g.boutons.size(); i++) {
      BoutonEsquisse* b = g.boutons[i];
      const int L = std::max(38, mesure(this, b->GetLabel(), 10.5).x + 4);
      if (g.coupes[i] && x > gauche) {
        x += 3;
        traits_.push_back(wxRect(x, y + 2, 1, H - 4));
        x += 6;
      }
      if (x + L > droite) {
        x = gauche;
        y += H + 4;
      }
      b->SetSize(rectDip(this, x, y, L, H));
      x += L + 2;
    }
  }
  const int h = y + H + 12;
  if (h != hauteur_) {
    hauteur_ = h;
    SetMinSize(FromDIP(wxSize(-1, h)));
    if (GetParent()) GetParent()->CallAfter([p = GetParent()] { p->Layout(); });
  }
  Refresh();
}

// ---------- Carte ----------
Carte::Carte(wxWindow* parent, const wxString& titre, const wxColour& fond, bool grand) : wxPanel(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxFULL_REPAINT_ON_RESIZE), titre_(titre), fond_(fond), grand_(grand) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  SetBackgroundColour(fond);  // les textes posés dessus la reprennent
  auto* s = new wxBoxSizer(wxVERTICAL);
  s->AddSpacer(FromDIP(grand ? 46 : 34));
  contenu_ = new wxBoxSizer(wxVERTICAL);
  s->Add(contenu_, 1, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(10));
  SetSizer(s);
  Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(GetParent()->GetBackgroundColour()));
    dc.Clear();
    const wxSize t = ToDIP(GetClientSize());
    {
      auto g = contexte(dc, this);
      if (!g) return;
      g->SetBrush(g->CreateBrush(wxBrush(fond_)));
      g->SetPen(g->CreatePen(wxGraphicsPenInfo(C_BORD, 1)));
      g->DrawRoundedRectangle(0.5, 0.5, t.x - 1, t.y - 1, 12);
    }
    if (!grand_) {
      if (!titre_.empty()) ecrire(dc, this, titre_, 15, 13, 11, C_DISCRET, true);
    } else {
      // Le titre revient à la ligne sur un espace, sans jamais dépasser deux lignes
      wxString ligne1 = titre_, ligne2;
      const int maxi = t.x - 24;
      while (mesure(this, ligne1, 12.5, true).x > maxi && ligne1.Find(L' ') != wxNOT_FOUND) {
        ligne2 = ligne1.AfterLast(L' ') + (ligne2.empty() ? L"" : L" ") + ligne2;
        ligne1 = ligne1.BeforeLast(L' ');
      }
      ecrire(dc, this, ligne1, 12, 10, 12.5, C_TEXTE, true);
      if (!ligne2.empty()) ecrire(dc, this, ligne2, 12, 25, 12.5, C_TEXTE, true);
    }
  });
}

void Carte::titre(const wxString& t) {
  titre_ = t;
  Refresh();
}

// ---------- Fil des fonctions ----------
namespace {
const int FIL_X0 = 150, FIL_PAS = 37, FIL_L = 34;
}

FilFonctions::FilFonctions(wxWindow* parent) : wxWindow(parent, 2007, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxFULL_REPAINT_ON_RESIZE) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(wxColour(0x13, 0x15, 0x19)));
    dc.Clear();
    const wxSize t = ToDIP(GetClientSize());
    const int yi = (t.y - FIL_L) / 2;
    {
      auto g = contexte(dc, this);
      if (!g) return;
      g->SetBrush(g->CreateBrush(wxBrush(wxColour(0x2a, 0x2c, 0x30))));
      g->SetPen(g->CreatePen(wxGraphicsPenInfo(C_BORD, 1)));
      g->DrawRoundedRectangle(0.5, 0.5, t.x - 1, t.y - 1, 12);
      const size_t fin = std::min(elements_.size(), static_cast<size_t>(debut_ + visibles()));
      for (size_t i = debut_; i < fin; i++) {
        const Element& e = elements_[i];
        const double x = FIL_X0 + static_cast<double>(i - debut_) * FIL_PAS;
        wxColour c = C_DISCRET;
        if (!e.estFonction) c = C_ORANGE;
        else if (e.type == "extrude") c = e.op == "cut" ? C_ROUGE : C_VERT;
        g->SetBrush(g->CreateBrush(wxBrush(wxColour(c.Red(), c.Green(), c.Blue(), static_cast<int>(i) == survol_ ? 60 : 26))));
        g->SetPen(g->CreatePen(wxGraphicsPenInfo(wxColour(c.Red(), c.Green(), c.Blue(), 70), 1)));
        g->DrawRoundedRectangle(x + 0.5, yi + 0.5, FIL_L - 1, FIL_L - 1, 7);
        g->DrawBitmap(image(e, c), x + 7, yi + 7, 20, 20);
      }
      // Le marqueur de fin de fil
      const double xm = FIL_X0 + static_cast<double>(fin - debut_) * FIL_PAS + 1;
      g->SetBrush(g->CreateBrush(wxBrush(wxColour(0xff, 0xd6, 0x0a))));
      g->SetPen(wxNullGraphicsPen);
      g->DrawRectangle(xm, yi - 4, 4, FIL_L + 6);
      // Début, précédent, suivant, fin, film : grisés, le marqueur n'est pas encore repris
      g->SetBrush(g->CreateBrush(wxBrush(wxColour(0x68, 0x6a, 0x70))));
      const double yc = t.y / 2.0;
      const auto triangle = [&](double x, double sens) {
        wxGraphicsPath p = g->CreatePath();
        p.MoveToPoint(x, yc - 5);
        p.AddLineToPoint(x + sens * 8, yc);
        p.AddLineToPoint(x, yc + 5);
        p.CloseSubpath();
        g->FillPath(p);
      };
      g->DrawRectangle(20, yc - 5, 2, 10);
      triangle(31, -1);
      triangle(52, -1);
      triangle(68, 1);
      triangle(90, 1);
      g->DrawRectangle(99, yc - 5, 2, 10);
      g->DrawRoundedRectangle(113, yc - 4, 12, 9, 1.5);
    }
    const wxString n = wxString::Format(L"%d fonction(s)", nb_);
    ecrire(dc, this, n, t.x - 10 - mesure(this, n, 11).x, t.y / 2.0 - 7, 11, C_DISCRET);
  });
  Bind(wxEVT_MOUSEWHEEL, [this](wxMouseEvent& e) {
    debut_ += e.GetWheelRotation() > 0 ? -3 : 3;
    bornerDebut();
    Refresh();
  });
  Bind(wxEVT_SIZE, [this](wxSizeEvent& e) {
    bornerDebut();
    e.Skip();
  });
  Bind(wxEVT_MOTION, [this](wxMouseEvent& e) {
    const int s = sous(e.GetPosition());
    if (s != survol_) {
      survol_ = s;
      SetToolTip(s >= 0 ? elements_[s].nom : wxString());
      Refresh();
    }
  });
  Bind(wxEVT_LEAVE_WINDOW, [this](wxMouseEvent&) {
    survol_ = -1;
    Refresh();
  });
  Bind(wxEVT_LEFT_DOWN, [this](wxMouseEvent& e) {
    const int s = sous(e.GetPosition());
    if (s >= 0) {
      const Element el = elements_[s];
      if (surClic) CallAfter([this, el] { surClic(el); });
    } else if (ToDIP(e.GetPosition()).x < FIL_X0 && surIndisponible) {
      surIndisponible(L"Marqueur du fil et film de construction");
    }
  });
  Bind(wxEVT_LEFT_DCLICK, [this](wxMouseEvent& e) {
    const int s = sous(e.GetPosition());
    if (s >= 0) {
      const Element el = elements_[s];
      if (surDouble) CallAfter([this, el] { surDouble(el); });
    }
  });
}

int FilFonctions::sous(const wxPoint& p) const {
  const wxPoint q = ToDIP(p);
  if (q.x < FIL_X0) return -1;
  const int i = (q.x - FIL_X0) / FIL_PAS + debut_;
  return i < static_cast<int>(elements_.size()) && (q.x - FIL_X0) % FIL_PAS < FIL_L ? i : -1;
}

int FilFonctions::visibles() const { return std::max(1, (ToDIP(GetClientSize()).x - FIL_X0 - 110) / FIL_PAS); }

void FilFonctions::bornerDebut() { debut_ = std::max(0, std::min(debut_, static_cast<int>(elements_.size()) - visibles())); }

const wxBitmap& FilFonctions::image(const Element& e, const wxColour& c) {
  const std::string cle = c.GetAsString(wxC2S_HTML_SYNTAX).ToStdString() + (e.estFonction ? "f" : "e");
  auto it = images_.find(cle);
  if (it == images_.end()) {
    const char* svg = e.estFonction ? RUBAN_CAO[1].svg : RUBAN_CAO[0].svg;
    it = images_.emplace(cle, iconeSvgComplete(svg, c, 20).GetBitmap(FromDIP(wxSize(20, 20)))).first;
  }
  return it->second;
}

void FilFonctions::montrer(const std::vector<Element>& e, int nbFonctions) {
  elements_ = e;
  nb_ = nbFonctions;
  survol_ = -1;
  debut_ = static_cast<int>(e.size());  // le bout du fil d'abord, là où l'on travaille
  bornerDebut();
  Refresh();
}

// ---------- État ----------
EtatVue::EtatVue(wxWindow* parent, int id, const wxColour& fond) : wxWindow(parent, id, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxFULL_REPAINT_ON_RESIZE), fond_(fond) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(fond_));
    dc.Clear();
    const wxSize t = ToDIP(GetClientSize());
    const wxSize m = mesure(this, texte_, 12);
    ecrire(dc, this, texte_, std::max(2, t.x - m.x - 2), (t.y - m.y) / 2.0, 12, C_DISCRET);
  });
}

int EtatVue::largeurVoulue() const { return mesure(this, texte_, 12).x; }

void EtatVue::montrer(const wxString& t) {
  texte_ = t;
  Refresh();
}

// ---------- Atelier à venir ----------
PageAtelier::PageAtelier(wxWindow* parent) : wxWindow(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxFULL_REPAINT_ON_RESIZE) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(wxColour(0x13, 0x15, 0x19)));
    dc.Clear();
    const wxSize t = ToDIP(GetClientSize());
    if (feuille_) {
      auto g = contexte(dc, this);
      if (g) {
        // Une planche A3 vide, au format du navigateur
        const double H = std::max(100, t.y - 100), L = std::min(H * 420 / 297, t.x - 100.0), x = (t.x - L) / 2, y = (t.y - L * 297 / 420) / 2;
        g->SetBrush(g->CreateBrush(*wxWHITE_BRUSH));
        g->SetPen(wxNullGraphicsPen);
        g->DrawRectangle(x, y, L, L * 297 / 420);
      }
    }
    const wxSize a = mesure(this, titre_, 18, true);
    ecrire(dc, this, titre_, (t.x - a.x) / 2.0, t.y / 2.0 - 34, 18, feuille_ ? wxColour(0x22, 0x22, 0x24) : C_TEXTE, true);
    const wxSize b = mesure(this, texte_, 13);
    ecrire(dc, this, texte_, (t.x - b.x) / 2.0, t.y / 2.0, 13, feuille_ ? wxColour(0x60, 0x60, 0x65) : C_DISCRET);
  });
}

void PageAtelier::montrer(const wxString& titre, const wxString& texte, bool feuille) {
  titre_ = titre;
  texte_ = texte;
  feuille_ = feuille;
  Refresh();
}
