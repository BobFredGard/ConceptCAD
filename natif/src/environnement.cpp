#include "mise_a_jour.h"
#include "theme.h"
#include "environnement.h"

#include <wx/dcbuffer.h>
#include <wx/msw/wrapwin.h>
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

#define C_FOND th(wxColour(0x1c, 0x1c, 0x1e))
#define C_BARRE th(wxColour(0x2a, 0x2c, 0x30))
namespace {
// Le bandeau du haut, en retrait sous le ruban (V0.69.3 du navigateur : --topbar), souligné à la couleur du thème
wxColour fondBandeau() {
  const std::string c = theme::palette(theme::courant()).cle;
  if (c == "graphite") return wxColour(0x1a, 0x1b, 0x1d);
  if (c == "atelier") return wxColour(0x15, 0x12, 0x0f);
  if (c == "clair") return wxColour(0xdd, 0xe2, 0xea);
  if (c == "contraste") return wxColour(0, 0, 0);
  return wxColour(0x18, 0x18, 0x1a);
}
}  // namespace
#define C_BORD th(wxColour(0x3a, 0x3a, 0x3d))
#define C_TEXTE th(wxColour(0xf5, 0xf5, 0xf7))
#define C_DISCRET th(wxColour(0x98, 0x98, 0x9d))
#define C_BLEU th(wxColour(0x0a, 0x84, 0xff))
#define C_VERT th(wxColour(0x30, 0xd1, 0x58))
#define C_ROUGE th(wxColour(0xff, 0x45, 0x3a))
#define C_ORANGE th(wxColour(0xff, 0x9f, 0x0a))
#define C_CHAMP th(wxColour(0x38, 0x3a, 0x3e))

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
  std::vector<std::function<void()>*> actions = {&surAnnuler, &surRetablir, &surNouveau, &surOuvrir, &surRecent, &surEnregistrer, &surEnregistrerSous, &surDossier};
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
  aide_ = new BoutonEsquisse(this, wxID_ANY, L"Aide", L"Raccourcis clavier et informations utiles (F1 hors esquisse, ou « ? »)", BoutonEsquisse::TEXTE);
  aide_->titre(L"❔ Aide");
  aide_->surClic = [this] {
    if (surAide) surAide();
  };
  theme_ = new BoutonEsquisse(this, wxID_ANY, L"Couleurs", L"Couleurs et icônes de l'interface", BoutonEsquisse::ENCADRE);
  for (size_t i = 0; BARRE_HAUTE[i].titre; i++)
    if (wxString(BARRE_HAUTE[i].titre).StartsWith(L"Couleurs")) theme_->iconeComplete(BARRE_HAUTE[i].svg, C_TEXTE);
  theme_->surClic = [this] {
    if (surTheme) surTheme();
  };
  recherche_ = new wxTextCtrl(this, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE);
  recherche_->SetBackgroundColour(th(wxColour(0x33, 0x35, 0x39)));
  recherche_->SetForegroundColour(C_TEXTE);
  recherche_->SetFont(police(12.5));
  recherche_->SetHint(L"Rechercher");
  recherche_->SetToolTip(L"Rechercher une commande…  Ctrl+K");
  Bind(wxEVT_SIZE, [this](wxSizeEvent& e) {
    placer();
    e.Skip();
  });
  Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
    if (themeBandeau_ != theme::courant()) fondsBandeau();
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(C_FOND));
    dc.Clear();
    const wxSize t = ToDIP(GetClientSize());
    {
      auto g = contexte(dc, this);
      if (!g) return;
      g->SetBrush(g->CreateBrush(wxBrush(fondBandeau())));
      g->SetPen(g->CreatePen(wxGraphicsPenInfo(C_BORD, 1)));
      g->DrawRoundedRectangle(12.5, 10.5, t.x - 25, 42, 12);
      {  // le trait de 2 px dessous, qui suit les coins arrondis comme une bordure CSS
        const double x0 = 13, x1 = t.x - 13, y1 = 52, r = 11.5;
        wxGraphicsPath p = g->CreatePath();
        p.AddArc(x0 + r, y1 - r, r, 3.14159265358979 * 0.75, 3.14159265358979 * 0.5, false);
        p.AddLineToPoint(x1 - r, y1);
        p.AddArc(x1 - r, y1 - r, r, 3.14159265358979 * 0.5, 3.14159265358979 * 0.25, false);
        g->SetPen(g->CreatePen(wxGraphicsPenInfo(theme::palette(theme::courant()).primary, 2)));
        g->StrokePath(p);
      }
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
      g->SetPen(g->CreatePen(wxGraphicsPenInfo(th(wxColour(0x44, 0x46, 0x4a)), 1)));
      g->StrokeLine(508.5, 22, 508.5, 42);
      // Le cadre du champ de recherche
      g->SetBrush(g->CreateBrush(wxBrush(th(wxColour(0x33, 0x35, 0x39)))));
      g->DrawRoundedRectangle(753.5, 18.5, 104, 27, 7);
    }
    ecrire(dc, this, L"Concept", 47, 24, 16.5, C_TEXTE, true);
    const int L = mesure(this, L"Concept", 16.5, true).x;
    ecrire(dc, this, L"CAD", 47 + L, 24, 16.5, C_BLEU, true);
    ecrire(dc, this, document_, 883, 25, 12.5, C_DISCRET);
    // Le numéro : ce programme n'a pas encore de version à lui
    ecrire(dc, this, miseAJour::VERSION, t.x - 165, 25, 11.5, C_TEXTE, true);
  });
  placer();
}

void BarreHaute::fondsBandeau() {
  themeBandeau_ = theme::courant();
  for (BoutonEsquisse* b : icones_) b->fond(fondBandeau());
  for (BoutonEsquisse* b : {regenerer_, aide_, theme_})
    if (b) b->fond(fondBandeau());
}

void BarreHaute::placer() {
  const int W = std::max(600, ToDIP(GetClientSize()).x);
  const int xa[] = {167, 224, 279, 342}, la[] = {55, 53, 61, 72};
  for (size_t i = 0; i < ateliers_.size(); i++) ateliers_[i]->SetSize(rectDip(this, xa[i], 21, la[i], 22));
  const int xi[] = {428, 466, 513, 551, 589, 627, 665, 703};
  for (size_t i = 0; i < icones_.size(); i++) icones_[i]->SetSize(rectDip(this, xi[i], 18, 38, 28));
  regenerer_->SetSize(rectDip(this, W - 278, 21, 92, 22));
  aide_->SetSize(rectDip(this, W - 338, 21, 56, 22));
  theme_->SetSize(rectDip(this, W - 63, 18, 38, 28));
  recherche_->SetSize(rectDip(this, 763, 24, 90, 17));
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
// La couleur de chaque famille, atelier par atelier (MF_GC, src/97-interface-icones.js)
void Ruban::couleursFamilles() {
  static const std::vector<unsigned> FAM[] = {
      {0x22c55e, 0x3b82f6, 0xf59e0b, 0xa855f7, 0x14b8a6, 0x94a3b8, 0xec4899},  // Esquisse, Créer, Construire, Modifier, Ensembles, Fichier, Composants
      {0x06b6d4, 0xf43f5e, 0xf59e0b, 0x22c55e, 0xef4444, 0x3b82f6},            // Posage, Limites, Opérations, Simulation, Calcul, Export
      {0x94a3b8, 0x06b6d4, 0x22c55e, 0xf59e0b, 0xa855f7, 0x3b82f6}};           // Planches, Vues, Dessin, Cotes, Axes, Sortie
  int n = 0;
  for (Groupe& g : groupes_) {
    const std::vector<unsigned>& L = FAM[std::min(n++, 2)];
    size_t k = 0;
    for (size_t i = 0; i < g.boutons.size(); i++) {
      if (i < g.coupes.size() && g.coupes[i] && i > 0) k++;
      auto* f = static_cast<const FicheRuban*>(g.boutons[i]->GetClientData());
      const unsigned c = L[std::min(k, L.size() - 1)];
      const wxString o = f ? wxString(f->couleur) : wxString();
      g.boutons[i]->couleurIcone(theme::iconesCouleur() ? wxColour((c >> 16) & 255, (c >> 8) & 255, c & 255) : o.empty() ? C_TEXTE : wxColour(o));
    }
  }
}

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
      b->SetClientData(const_cast<FicheRuban*>(f));
      wxString nom = f->texte;
      // Deux boutons de même nom dans la mise en plan : ils se distinguent par leur bulle
      if (x.a == Atelier::PLAN && nom == L"Cercle" && wxString(f->titre).StartsWith(L"Axes")) nom = L"Cercle axes";
      if (x.a == Atelier::PLAN && nom == L"DXF" && wxString(f->titre).StartsWith(L"Exporter")) nom = L"DXF export";
      const Atelier a = x.a;
      b->surClic = [this, a, nom, b] {
        if (b->estDisponible()) {
          if (surBouton) surBouton(a, nom);
        } else if (surIndisponible) {
          surIndisponible(nom);
        }
      };
      b->SetName(nom);
      g.boutons.push_back(b);
      g.coupes.push_back(f->groupe);
    }
    groupes_.push_back(std::move(g));
  }
  // Le groupe Composants : en modélisation, seul « Assembler »
  const auto carreIcone = [](const char* d) { return wxString("<svg class=\"mfIcT mfIcH\" viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">") + d + "</svg>"; };
  const struct { const wchar_t* nom; const wchar_t* titre; const char* d; } asmB[] = {
      {L"Composant", L"Nouveau composant dans le composant actif (on entre aussitôt dedans)", "<path d=\"M4 8l8-4 8 4v8l-8 4-8-4z\"/><path d=\"M4 8l8 4 8-4M12 12v8\"/>"},
      {L"Occurrence", L"Nouvelle occurrence du composant sélectionné", "<path d=\"M3 9l6-3 6 3v6l-6 3-6-3z\"/><path d=\"M17 10v8M13 14h8\"/>"},
      {L"Répétition", L"Répéter l'occurrence sélectionnée (ou le lot) : linéaire, 2 directions, circulaire, symétrie", "<rect x=\"3\" y=\"3\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"15\" y=\"3\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"3\" y=\"15\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"15\" y=\"15\" width=\"6\" height=\"6\" rx=\"1\"/>"},
      {L"Inspecter", L"Interférences entre corps / composants, masses et centre de gravité", "<circle cx=\"10\" cy=\"10\" r=\"6\"/><path d=\"M14.5 14.5L21 21\"/><path d=\"M7 10h6M10 7v6\"/>"},
      {L"Depuis corps", L"Créer un composant depuis le corps sélectionné (ou depuis chaque corps)", "<path d=\"M3 14l5-3 5 3v5l-5 3-5-3z\"/><path d=\"M14 6l4-2 4 2v4l-4 2-4-2z\"/><path d=\"M12 12l3-3M15 9h-2.5M15 9v2.5\"/>"},
      {L"Normalisés", L"Vis, bouchons, goupilles, clavettes, engrenages : insérés comme composants du composant actif", "<path d=\"M7 3h10v4l-2 2H9L7 7z\"/><path d=\"M10.5 3v2.5M13.5 3v2.5\"/><path d=\"M9.5 9v12h5V9\"/><path d=\"M9.5 12l5 1.5M9.5 15l5 1.5M9.5 18l5 1.5\"/>"},
      {L"Aimants", L"Bibliothèque d'aimants permanents", "<path d=\"M5 4h5v9a2 2 0 0 0 4 0V4h5v9a7 7 0 0 1-14 0z\"/><path d=\"M5 8h5M14 8h5\"/>"},
      {L"Insérer", L"Insérer un fichier .conceptcad comme composant du composant actif (copié)", "<path d=\"M12 3v11M8 10l4 4 4-4\"/><path d=\"M4 16v4h16v-4\"/>"}};
  for (const auto& d : asmB) {
    auto* b = new BoutonEsquisse(this, wxID_ANY, d.nom, d.titre, BoutonEsquisse::RUBAN);
    b->titre(d.nom);
    b->iconeComplete(carreIcone(d.d).utf8_string().c_str(), C_TEXTE);
    b->Hide();
    const wxString nom = d.nom;
    b->surClic = [this, nom, b] {
      if (b->estDisponible()) {
        if (surBouton) surBouton(Atelier::CAO, nom);
      } else if (surIndisponible) surIndisponible(nom);
    };
    boutonsAsm_.push_back(b);
  }
  for (Groupe& g : groupes_)
    if (g.atelier == Atelier::CAO)
      for (BoutonEsquisse* b : g.boutons)
        if (b->GetLabel() == L"Assembler") boutonAssembler_ = b;
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
    g->SetPen(g->CreatePen(wxGraphicsPenInfo(th(wxColour(0x44, 0x46, 0x4a)), 1)));
    for (const wxRect& r : traits_) g->StrokeLine(r.x + 0.5, r.y, r.x + 0.5, r.y + r.height);
    for (const auto& l : libelles_) {
      const wxSize m = mesure(this, l.second, 9);
      ecrire(dc, this, l.second, l.first.x + (l.first.width - m.x) / 2.0, l.first.y, 9, C_DISCRET);
    }
  });
}

std::vector<CommandeRuban> Ruban::commandes() const {
  std::vector<CommandeRuban> L;
  for (const Groupe& g : groupes_)
    for (BoutonEsquisse* b : g.boutons) {
      if (assemblage_ && g.atelier == Atelier::CAO && b != boutonAssembler_) continue;
      if (!estRepris || estRepris(g.atelier, b->GetName())) L.push_back({g.atelier, b->GetName(), b->GetToolTipText()});
    }
  if (assemblage_)
    for (BoutonEsquisse* b : boutonsAsm_)
      if (!estRepris || estRepris(Atelier::CAO, b->GetLabel())) L.push_back({Atelier::CAO, b->GetLabel(), b->GetToolTipText()});
  return L;
}

void Ruban::atelier(Atelier a) {
  courant_ = a;
  for (const Groupe& g : groupes_)
    for (size_t i = 0; i < g.boutons.size(); i++) {
      const bool ici = g.atelier == a && (!assemblage_ || a != Atelier::CAO || g.boutons[i] == boutonAssembler_);
      g.boutons[i]->Show(ici);
      if (ici && estRepris) g.boutons[i]->disponible(estRepris(a, g.boutons[i]->GetName()));
    }
  for (BoutonEsquisse* b : boutonsAsm_) {
    const bool ici = assemblage_ && a == Atelier::CAO;
    b->Show(ici);
    if (ici && estRepris) b->disponible(estRepris(a, b->GetLabel()));
  }
  placer();
}

void Ruban::modeAssemblage(bool oui) {
  if (oui == assemblage_) return;
  assemblage_ = oui;
  if (boutonAssembler_) boutonAssembler_->titre(oui ? L"Modéliser" : L"Assembler");
  atelier(courant_);
}

void Ruban::placer() {
  const int W = std::max(300, ToDIP(GetClientSize()).x);
  // Sous chaque groupe, son nom (mfRibbon)
  const int H = 44, NOM = 13, gauche = 25, droite = W - 25;
  int x = gauche, y = 13;
  traits_.clear();
  libelles_.clear();
  static const std::vector<const wchar_t*> NOMS[] = {
      {L"ESQUISSE", L"CRÉER", L"CONSTRUIRE", L"MODIFIER", L"ENSEMBLES", L"FICHIER", L"COMPOSANTS"},
      {L"POSAGE", L"LIMITES", L"OPÉRATIONS", L"SIMULATION", L"CALCUL", L"EXPORT"},
      {L"PLANCHES", L"VUES", L"DESSIN", L"COTES", L"AXES", L"SORTIE"}};
  const int rangAtelier = courant_ == Atelier::CAO ? 0 : courant_ == Atelier::FAO ? 1 : 2;
  int debut = -1, rang = 0;
  const auto fermer = [&](int fin) {
    if (debut >= 0 && rang < static_cast<int>(NOMS[rangAtelier].size())) libelles_.push_back({wxRect(debut, y + H, fin - debut, NOM), NOMS[rangAtelier][rang]});
    debut = -1;
  };
  for (const Groupe& g : groupes_) {
    if (g.atelier != courant_) continue;
    for (size_t i = 0; i < g.boutons.size(); i++) {
      BoutonEsquisse* b = g.boutons[i];
      const bool coupe = g.coupes[i] && i > 0;
      if (coupe) {
        if (debut >= 0) {
          fermer(x - 2);
          x += 3;
          traits_.push_back(wxRect(x, y + 2, 1, H + NOM - 6));
          x += 6;
        }
        rang++;
      }
      if (!b->IsShown()) continue;
      const int L = std::max(38, mesure(this, b->GetLabel(), 10.5).x + 4);
      if (x + L > droite) {
        fermer(x - 2);
        x = gauche;
        y += H + NOM + 4;
      }
      if (debut < 0) debut = x;
      b->SetSize(rectDip(this, x, y, L, H));
      x += L + 2;
    }
  }
  fermer(x - 2);
  if (assemblage_ && courant_ == Atelier::CAO) {
    rang = 6;
    x += 3;
    traits_.push_back(wxRect(x, y + 2, 1, H + NOM - 6));
    x += 6;
    for (BoutonEsquisse* b : boutonsAsm_) {
      const int L = std::max(38, mesure(this, b->GetLabel(), 10.5).x + 4);
      if (x + L > droite) {
        fermer(x - 2);
        x = gauche;
        y += H + NOM + 4;
      }
      if (debut < 0) debut = x;
      b->SetSize(rectDip(this, x, y, L, H));
      x += L + 2;
    }
    fermer(x - 2);
  }
  const int h = y + H + NOM + 12;
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
    // En vitre, les coins hors de l'arrondi prennent la couleur clé : Windows les laisse vides
    dc.SetBackground(wxBrush(vitre_ ? wxColour(1, 0, 1) : GetParent()->GetBackgroundColour()));
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

void Carte::vitre(int opacite) {
  // Une fenêtre fille translucide : Windows 8 et suivants, déclaré dans conceptcad.manifest
#ifdef _WIN32
  const HWND h = static_cast<HWND>(GetHWND());
  ::SetWindowLongPtrW(h, GWL_EXSTYLE, ::GetWindowLongPtrW(h, GWL_EXSTYLE) | WS_EX_LAYERED);
  vitre_ = ::SetLayeredWindowAttributes(h, RGB(1, 0, 1), static_cast<BYTE>(opacite), LWA_ALPHA | LWA_COLORKEY) != 0;
#else
  (void)opacite;  // Mac : pas encore de vitre, la carte reste opaque
  vitre_ = false;
#endif
  Refresh();
}

void Carte::titre(const wxString& t) {
  titre_ = t;
  Refresh();
}

// ---------- Fil des fonctions ----------
namespace {
const int FIL_X0 = 150, FIL_PAS = 37, FIL_L = 34;
}

void iconeFonction(const std::string& type, const std::string& op, const std::string& mode, bool chanfrein, bool derive, int& ruban, wxColour& c, bool& moins) {
  const wxColour ajout(0x30, 0xd1, 0x58), retrait(0xff, 0x45, 0x3a), modif(0x64, 0xd2, 0xff), motif(0xbf, 0x5a, 0xf2);
  const bool cut = op == "cut";
  ruban = 1;
  c = modif;
  moins = false;
  const auto parOp = [&](int r) {
    ruban = r;
    c = cut ? retrait : ajout;
    moins = cut;
  };
  if (type == "extrude") parOp(1);
  else if (type == "revolve") parOp(2);
  else if (type == "sweep") parOp(3);
  else if (type == "hole") { ruban = 4; c = retrait; }
  else if (type == "xthread") ruban = 16;
  else if (type == "gear") { ruban = 1; c = ajout; }
  else if (type == "xfillet") ruban = chanfrein ? 12 : 11;
  else if (type == "fillet") ruban = 11;
  else if (type == "repeat") { ruban = 18; c = motif; }
  else if (type == "combine") {
    ruban = 19;
    if (mode == "cut") { c = retrait; moins = true; }
  }
  else if (type == "xmove" || type == "xdelface") ruban = 13;
  else if (type == "xdraft") ruban = 14;
  else if (type == "xshell") { ruban = 15; c = retrait; }
  else if (type == "xsplit") ruban = 17;
  else if (type == "bmove") ruban = 20;
  else if (type == "bremove") { ruban = 6; c = retrait; moins = true; }
  else if (type == "bscale") ruban = 21;
  else if (type == "import") ruban = derive ? 24 : 23;
}

FilFonctions::FilFonctions(wxWindow* parent) : wxWindow(parent, 2007, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxFULL_REPAINT_ON_RESIZE) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(th(wxColour(0x13, 0x15, 0x19))));
    dc.Clear();
    const wxSize t = ToDIP(GetClientSize());
    const int yi = (t.y - FIL_L) / 2;
    {
      auto g = contexte(dc, this);
      if (!g) return;
      g->SetBrush(g->CreateBrush(wxBrush(th(wxColour(0x2a, 0x2c, 0x30)))));
      g->SetPen(g->CreatePen(wxGraphicsPenInfo(C_BORD, 1)));
      g->DrawRoundedRectangle(0.5, 0.5, t.x - 1, t.y - 1, 12);
      const size_t fin = std::min(elements_.size(), static_cast<size_t>(debut_ + visibles()));
      for (size_t i = debut_; i < fin; i++) {
        const Element& e = elements_[i];
        const double x = FIL_X0 + static_cast<double>(i - debut_) * FIL_PAS;
        wxColour c = e.couleur.IsOk() ? e.couleur : C_DISCRET;
        if (e.apresMarque) c = th(wxColour(0x58, 0x5a, 0x60));
        else if (e.grise) c = wxColour(c.Red() * 6 / 10 + 8, c.Green() * 6 / 10 + 8, c.Blue() * 6 / 10 + 8);  // masquée : .hid, atténuée
        g->SetBrush(g->CreateBrush(wxBrush(wxColour(c.Red(), c.Green(), c.Blue(), static_cast<int>(i) == survol_ ? 60 : 26))));
        g->SetPen(g->CreatePen(wxGraphicsPenInfo(wxColour(c.Red(), c.Green(), c.Blue(), 70), 1)));
        g->DrawRoundedRectangle(x + 0.5, yi + 0.5, FIL_L - 1, FIL_L - 1, 7);
        g->DrawBitmap(image(e, c), x + 7, yi + 7, 20, 20);
        if (e.moins) {
          g->SetBrush(g->CreateBrush(wxBrush(c)));
          g->SetPen(wxNullGraphicsPen);
          g->DrawRectangle(x + FIL_L - 9, yi + FIL_L - 5, 7, 2);
        }
      }
      // Le marqueur de fin de fil
      size_t posMarque = fin;
      for (size_t i = debut_; i < fin; i++)
        if (elements_[i].apresMarque) {
          posMarque = i;
          break;
        }
      const double xm = FIL_X0 + static_cast<double>(posMarque - debut_) * FIL_PAS + (posMarque < fin ? -3 : 1);
      g->SetBrush(g->CreateBrush(wxBrush(th(wxColour(0xff, 0xd6, 0x0a)))));
      g->SetPen(wxNullGraphicsPen);
      g->DrawRectangle(xm, yi - 4, 4, FIL_L + 6);
      // Début, précédent, suivant, fin ; le film reste grisé
      g->SetBrush(g->CreateBrush(wxBrush(th(wxColour(0xc8, 0xca, 0xd0)))));
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
      g->SetBrush(g->CreateBrush(wxBrush(th(wxColour(0x68, 0x6a, 0x70)))));
      g->DrawRoundedRectangle(113, yc - 4, 12, 9, 1.5);
      if (depot_ >= 0) {  // le trait de dépôt (tlbD)
        g->SetPen(*wxTRANSPARENT_PEN);
        g->SetBrush(g->CreateBrush(wxBrush(th(wxColour(0x0a, 0x84, 0xff)))));
        g->DrawRectangle(FIL_X0 + (depot_ - debut_) * FIL_PAS - 3, yi - 2, 2, FIL_L + 4);
      }
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
  Bind(wxEVT_LEFT_UP, [this](wxMouseEvent&) {
    if (HasCapture()) ReleaseMouse();
    const int source = tire_, gap = depot_;
    tire_ = -1, depot_ = -1;
    if (source < 0 || gap < 0) return;
    Refresh();
    const std::vector<Element> L = elements_;
    if (surDepot) CallAfter([this, L, source, gap] { surDepot(L, source, gap); });
  });
  Bind(wxEVT_MOUSE_CAPTURE_LOST, [this](wxMouseCaptureLostEvent&) {
    tire_ = -1, depot_ = -1;
    Refresh();
  });
  Bind(wxEVT_MOTION, [this](wxMouseEvent& e) {
    if (tire_ >= 0 && e.LeftIsDown() && (depot_ >= 0 || std::abs(e.GetPosition().x - tireX0_) >= FromDIP(5))) {
      depot_ = interstice(e.GetPosition());
      Refresh();
      return;
    }
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
      if (el.estFonction) {
        tire_ = s, tireX0_ = e.GetPosition().x, depot_ = -1;
        CaptureMouse();
      }
      if (surClic) CallAfter([this, el] { surClic(el); });
    } else if (const int x = ToDIP(e.GetPosition()).x; x < FIL_X0) {
      // Les quatre boutons du marqueur, puis le film
      const int b = x < 15 ? -1 : x < 40 ? 0 : x < 60 ? 1 : x < 82 ? 2 : x < 106 ? 3 : -1;
      if (b >= 0 && surMarqueur) CallAfter([this, b] { surMarqueur(b); });
      else if (b < 0 && x >= 106 && surFilm) CallAfter([this] { surFilm(); });
    }
  });
  Bind(wxEVT_RIGHT_DOWN, [this](wxMouseEvent& e) {
    const int s = sous(e.GetPosition());
    if (s >= 0) {
      const Element el = elements_[s];
      if (surDroit) CallAfter([this, el] { surDroit(el); });
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

int FilFonctions::interstice(const wxPoint& p) const {
  const int g = (ToDIP(p).x - FIL_X0 + FIL_PAS / 2) / FIL_PAS + debut_;
  return std::max(debut_, std::min(g, static_cast<int>(elements_.size())));
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
  const std::string cle = c.GetAsString(wxC2S_HTML_SYNTAX).ToStdString() + std::to_string(e.ruban);
  auto it = images_.find(cle);
  if (it == images_.end()) {
    const char* svg = RUBAN_CAO[e.ruban].svg;
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
void Carte::themeChange(int de, int vers) {
  fond_ = theme::passer(fond_, de, vers);
  Refresh();
}

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
    dc.SetBackground(wxBrush(th(wxColour(0x13, 0x15, 0x19))));
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
    ecrire(dc, this, titre_, (t.x - a.x) / 2.0, t.y / 2.0 - 34, 18, feuille_ ? th(wxColour(0x22, 0x22, 0x24)) : C_TEXTE, true);
    const wxSize b = mesure(this, texte_, 13);
    ecrire(dc, this, texte_, (t.x - b.x) / 2.0, t.y / 2.0, 13, feuille_ ? th(wxColour(0x60, 0x60, 0x65)) : C_DISCRET);
  });
}

void PageAtelier::montrer(const wxString& titre, const wxString& texte, bool feuille) {
  titre_ = titre;
  texte_ = texte;
  feuille_ = feuille;
  Refresh();
}
