#include "esquisse2d.h"

#include "parametres.h"

#include <wx/dcbuffer.h>
#include <wx/spinctrl.h>

#include "cote_geometrie.h"
#include "interface_esquisse.h"

#include <BRepAdaptor_Curve.hxx>
#include <GCPnts_TangentialDeflection.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>

#include <algorithm>
#include <cmath>
#include <map>
#include <memory>
#include <set>

namespace {
const double PI = 3.14159265358979323846, TAU = PI * 2;
const double ECHELLE_MIN = 0.02, ECHELLE_MAX = 4000;
const wxColour FOND_VUE(0x13, 0x15, 0x19), FOND(0x10, 0x10, 0x12), GRILLE(0x2a, 0x2a, 0x2e), AXE(0x0a, 0x84, 0xff), TRAIT(0xe8, 0xe8, 0xea), GRIS(0x8e, 0x8e, 0x93);
const wxColour VERT(0x30, 0xd1, 0x58), VERT_FOND(0x16, 0x26, 0x1b), ORANGE(0xff, 0xb3, 0x40), ORANGE_AXE(0xff, 0x9f, 0x0a), VIOLET(0xbf, 0x5a, 0xf2), CYAN(0x64, 0xd2, 0xff);


wxColour alpha(const wxColour& c, double a) { return wxColour(c.Red(), c.Green(), c.Blue(), static_cast<unsigned char>(a * 255)); }

wxGraphicsPen stylo(wxGraphicsContext& g, const wxColour& c, double largeur, const std::vector<double>& tirets = {}) {
  wxGraphicsPenInfo info(c, largeur);
  std::vector<wxDash> d;
  if (!tirets.empty()) {
    // wxWidgets compte les tirets en largeurs de trait, le SVG d'origine en pixels
    for (double t : tirets) d.push_back(static_cast<wxDash>(std::max(1.0, t / largeur)));
    info.Style(wxPENSTYLE_USER_DASH).Dashes(static_cast<int>(d.size()), d.data());
  }
  return g.CreatePen(info);
}
void ligne(wxGraphicsContext& g, const wxPoint2DDouble& a, const wxPoint2DDouble& b) { g.StrokeLine(a.m_x, a.m_y, b.m_x, b.m_y); }
void cercle(wxGraphicsContext& g, double x, double y, double l, double h) {
  wxGraphicsPath p = g.CreatePath();
  p.AddEllipse(x, y, l, h);
  g.StrokePath(p);
}

// Pointe en (x,y), axe (ux,uy) pointant vers la pointe : dimArrow (src/50-esquisse-4)
void fleche(wxGraphicsContext& g, double x, double y, double ux, double uy, const wxColour& c, double taille = 9) {
  const double L = std::hypot(ux, uy);
  if (L < 1e-12) return;
  ux /= L;
  uy /= L;
  const double bx = -uy * taille * 0.32, by = ux * taille * 0.32;
  wxGraphicsPath p = g.CreatePath();
  p.MoveToPoint(x, y);
  p.AddLineToPoint(x - ux * taille + bx, y - uy * taille + by);
  p.AddLineToPoint(x - ux * taille - bx, y - uy * taille - by);
  p.CloseSubpath();
  g.SetBrush(g.CreateBrush(wxBrush(c)));
  g.SetPen(wxNullGraphicsPen);
  g.FillPath(p);
}

// parDecor (src/51-parametres) : « nom=valeur », « ƒx valeur », ⚠ si la formule ne s'évalue plus
wxString habille(const Cote& d, wxString t) {
  if (d.formuleFausse) t = L"⚠" + t;
  if (!d.nom.empty()) return wxString::FromUTF8(d.nom) + "=" + t;
  if (d.formule) return L"ƒx " + t;
  return t;
}

wxString texteValeur(double v, bool ref) {
  wxString t = wxString::FromCDouble(v, 2);
  return ref ? "(" + t + ")" : t;
}

// Pastille de contrainte : les mêmes icônes que le navigateur (src/49), dessinées dans un carré de 24
void icone(wxGraphicsContext& g, const std::string& n) {
  auto L = [&](double a, double b, double c, double d) { g.StrokeLine(a, b, c, d); };
  if (n == "h") { L(3.5, 12, 20.5, 12); L(3.5, 8, 3.5, 16); L(20.5, 8, 20.5, 16); }
  else if (n == "v") { L(12, 3.5, 12, 20.5); L(8, 3.5, 16, 3.5); L(8, 20.5, 16, 20.5); }
  else if (n == "parallel") { L(5, 19, 13, 5); L(11, 19, 19, 5); }
  else if (n == "perpendicular") { L(4, 19.5, 20, 19.5); L(12, 19.5, 12, 4.5); L(12, 15, 16.5, 15); L(16.5, 15, 16.5, 19.5); }
  else if (n == "collinear") { L(3, 21, 9, 15); L(15, 9, 21, 3); L(11, 13, 13, 11); }
  else if (n == "equal") { L(5, 9, 19, 9); L(5, 15, 19, 15); }
  else if (n == "symmetric") { L(12, 3, 12, 5); L(12, 8, 12, 10); L(12, 13, 12, 15); L(12, 18, 12, 20); L(9, 6.5, 3.5, 12); L(3.5, 12, 9, 17.5); L(15, 6.5, 20.5, 12); L(20.5, 12, 15, 17.5); }
  else if (n == "fix") { g.StrokeLine(5.5, 10.5, 18.5, 10.5); L(18.5, 10.5, 18.5, 20.5); L(18.5, 20.5, 5.5, 20.5); L(5.5, 20.5, 5.5, 10.5); L(8.5, 10.5, 8.5, 7); L(15.5, 10.5, 15.5, 7); L(8.5, 7, 12, 3.8); L(12, 3.8, 15.5, 7); }
  else if (n == "midpoint") { L(3, 17, 21, 17); L(3, 14.5, 3, 19.5); L(21, 14.5, 21, 19.5); L(12, 16.5, 8.4, 10.5); L(8.4, 10.5, 15.6, 10.5); L(15.6, 10.5, 12, 16.5); }
  else if (n == "coaxial") { cercle(g, 3.5, 3.5, 17, 17); cercle(g, 7.5, 7.5, 9, 9); }
}

// Sommet d'une cote d'angle : angleVertex (src/50-esquisse-4)
bool sommetAngle(const Esquisse& s, const Cote& d, P2& V) {
  const Entite* A = s.entite(d.a);
  const Entite* B = s.entite(d.b);
  if (!A || !B || A->t != "line" || B->t != "line") return false;
  for (const std::string* q : {&A->p1, &A->p2})
    if (*q == B->p1 || *q == B->p2) {
      const Pt* c = s.point(*q);
      if (c) {
        V = {c->x, c->y};
        return true;
      }
    }
  const Pt* A1 = s.point(A->p1);
  const Pt* A2 = s.point(A->p2);
  const Pt* B1 = s.point(B->p1);
  const Pt* B2 = s.point(B->p2);
  if (!A1 || !A2 || !B1 || !B2) return false;
  const double ax = A2->x - A1->x, ay = A2->y - A1->y, bx = B2->x - B1->x, by = B2->y - B1->y, cr = ax * by - ay * bx;
  const double la = std::hypot(ax, ay), lb = std::hypot(bx, by);
  if (la > 1e-12 && lb > 1e-12 && std::abs(cr) / (la * lb) > 1e-4) {
    const double t = ((B1->x - A1->x) * by - (B1->y - A1->y) * bx) / cr;
    V = {A1->x + ax * t, A1->y + ay * t};
  } else {
    V = {((A1->x + A2->x) / 2 + (B1->x + B2->x) / 2) / 2, ((A1->y + A2->y) / 2 + (B1->y + B2->y) / 2) / 2};
  }
  return true;
}

void texteCentre(wxGraphicsContext& g, const wxString& t, double x, double y) {
  double L, H, dsc, ext;
  g.GetTextExtent(t, &L, &H, &dsc, &ext);
  g.DrawText(t, x - L / 2, y - H / 2);
}
}  // namespace

VueEsquisse::VueEsquisse(wxWindow* parent) : wxWindow(parent, 2004, wxDefaultPosition, wxDefaultSize, wxFULL_REPAINT_ON_RESIZE | wxWANTS_CHARS) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  Bind(wxEVT_PAINT, &VueEsquisse::surPeinture, this);
  Bind(wxEVT_LEFT_DOWN, &VueEsquisse::surGaucheBas, this);
  Bind(wxEVT_LEFT_UP, &VueEsquisse::surGaucheHaut, this);
  Bind(wxEVT_KEY_DOWN, &VueEsquisse::surTouche, this);
  Bind(wxEVT_CHAR, &VueEsquisse::surCaractere, this);
  Bind(wxEVT_RIGHT_DOWN, &VueEsquisse::surEnfonce, this);
  Bind(wxEVT_MIDDLE_DOWN, &VueEsquisse::surEnfonce, this);
  Bind(wxEVT_RIGHT_UP, &VueEsquisse::surRelache, this);
  Bind(wxEVT_MIDDLE_UP, &VueEsquisse::surRelache, this);
  Bind(wxEVT_MOTION, &VueEsquisse::surMouvement, this);
  Bind(wxEVT_MOUSEWHEEL, &VueEsquisse::surMolette, this);
  Bind(wxEVT_LEFT_DCLICK, &VueEsquisse::surDoubleClic, this);
  Bind(wxEVT_MOUSE_CAPTURE_LOST, [this](wxMouseCaptureLostEvent&) {
    geste_.actif = false;
    gauche_ = false;
  });
}

void VueEsquisse::lireBarrePolygone() {
  if (!dessin_ || !polyN_) return;
  dessin_->vue(echelle_);
  dessin_->lirePolygone(polyN_->GetValue(), std::string(polyD_->GetValue().ToUTF8()));
  if (surGeste) surGeste();
  Refresh();
}

namespace {
// Un choix du bandeau : le choix en cours est en bleu, comme dans le navigateur
class BoutonMode : public wxPanel {
 public:
  BoutonMode(wxWindow* parent, const wxString& libelle, const wxString& aide, std::function<void()> clic) : wxPanel(parent, wxID_ANY), libelle_(libelle), clic_(std::move(clic)) {
    SetBackgroundStyle(wxBG_STYLE_PAINT);
    SetToolTip(aide);
    wxClientDC dc(this);
    dc.SetFont(GetFont());
    const wxSize t = dc.GetTextExtent(libelle);
    SetMinSize(wxSize(t.x + FromDIP(16), t.y + FromDIP(10)));
    SetSize(GetMinSize());
    SetCursor(wxCursor(wxCURSOR_HAND));
    Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
      wxAutoBufferedPaintDC dc(this);
      const wxSize z = GetClientSize();
      dc.SetBackground(wxBrush(GetParent()->GetBackgroundColour()));
      dc.Clear();
      dc.SetPen(wxPen(actif_ ? wxColour(0x2f, 0x7f, 0xf0) : wxColour(0x55, 0x55, 0x5a)));
      dc.SetBrush(wxBrush(actif_ ? wxColour(0x2f, 0x7f, 0xf0) : survol_ ? wxColour(0x3a, 0x3a, 0x3e) : wxColour(0x2c, 0x2c, 0x2e)));
      dc.DrawRoundedRectangle(0, 0, z.x, z.y, FromDIP(4));
      dc.SetFont(GetFont());
      dc.SetTextForeground(actif_ ? *wxWHITE : wxColour(0xe8, 0xe8, 0xea));
      const wxSize t = dc.GetTextExtent(libelle_);
      dc.DrawText(libelle_, (z.x - t.x) / 2, (z.y - t.y) / 2);
    });
    Bind(wxEVT_LEFT_UP, [this](wxMouseEvent&) { clic_(); });
    Bind(wxEVT_ENTER_WINDOW, [this](wxMouseEvent&) {
      survol_ = true;
      Refresh();
    });
    Bind(wxEVT_LEAVE_WINDOW, [this](wxMouseEvent&) {
      survol_ = false;
      Refresh();
    });
  }
  void actif(bool a) {
    if (a == actif_) return;
    actif_ = a;
    Refresh();
  }

 private:
  wxString libelle_;
  std::function<void()> clic_;
  bool actif_ = false, survol_ = false;
};
}  // namespace

void VueEsquisse::choisirModeTrace(const std::string& code) {
  if (!dessin_) return;
  dessin_->vue(echelle_);
  dessin_->choisirMode(dessin_->outil(), code);
  apresGeste();
  majBarreTrace();
  SetFocus();
}

void VueEsquisse::majBarreTrace() {
  const int o = dessin_ ? static_cast<int>(dessin_->outil()) : -1;
  const char* titre = dessin_ ? Dessin::titreModes(dessin_->outil()) : nullptr;
  if (!titre) {
    if (barreTrace_ && barreTrace_->IsShown()) barreTrace_->Hide();
    return;
  }
  if (!barreTrace_) {
    barreTrace_ = new wxPanel(this, wxID_ANY, FromDIP(wxPoint(10, 10)));
    barreTrace_->SetBackgroundColour(wxColour(0x1e, 0x1e, 0x1e));
  }
  const Dessin::Outil outil = dessin_->outil();
  const std::vector<Dessin::ModeTrace>& modes = Dessin::modesDe(outil);
  if (outilBarre_ != o) {  // les boutons ne sont refaits qu'au changement d'outil
    outilBarre_ = o;
    barreTrace_->DestroyChildren();
    boutonsTrace_.clear();
    auto* ligne = new wxBoxSizer(wxHORIZONTAL);
    auto* l = new wxStaticText(barreTrace_, wxID_ANY, wxString::FromUTF8(titre));
    l->SetForegroundColour(wxColour(0xe8, 0xe8, 0xea));
    ligne->Add(l, 0, wxALIGN_CENTER_VERTICAL | wxLEFT | wxRIGHT, FromDIP(10));
    for (const Dessin::ModeTrace& m : modes) {
      const std::string code = m.code;
      auto* b = new BoutonMode(barreTrace_, wxString::FromUTF8(m.libelle), wxString::FromUTF8(m.aide), [this, code] { choisirModeTrace(code); });
      ligne->Add(b, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT | wxTOP | wxBOTTOM, FromDIP(6));
      boutonsTrace_.push_back(b);
    }
    ligne->AddSpacer(FromDIP(4));
    barreTrace_->SetSizerAndFit(ligne);
  }
  for (size_t i = 0; i < boutonsTrace_.size() && i < modes.size(); i++) static_cast<BoutonMode*>(boutonsTrace_[i])->actif(Dessin::modeDe(outil) == modes[i].code);
  if (!barreTrace_->IsShown()) barreTrace_->Show();
}

void VueEsquisse::majBarrePolygone() {
  majBarreTrace();
  const bool oui = dessin_ && dessin_->outil() == Dessin::POLYGONE;
  if (!barrePoly_) {
    if (!oui) return;
    const wxColour fond(0x1e, 0x1e, 0x1e), texte(0xe8, 0xe8, 0xea);
    barrePoly_ = new wxPanel(this, 2006, FromDIP(wxPoint(10, 10)));
    barrePoly_->SetBackgroundColour(fond);
    barrePoly_->SetForegroundColour(texte);
    auto* ligne = new wxBoxSizer(wxHORIZONTAL);
    const auto libelle = [&](const wxString& t) {
      auto* l = new wxStaticText(barrePoly_, wxID_ANY, t);
      l->SetForegroundColour(texte);
      return l;
    };
    const Dessin::ReglagesPolygone& reglages = Dessin::reglagesPolygone();
    polyN_ = new wxSpinCtrl(barrePoly_, 2007, wxEmptyString, wxDefaultPosition, FromDIP(wxSize(58, -1)), wxSP_ARROW_KEYS | wxTE_PROCESS_ENTER, 3, 64, reglages.n);
    polyN_->SetToolTip(L"Nombre de côtés (3 à 64)");
    polyD_ = new wxTextCtrl(barrePoly_, 2008, reglages.d > 0 ? wxString::FromCDouble(reglages.d) : wxString(), wxDefaultPosition, FromDIP(wxSize(92, -1)), wxTE_PROCESS_ENTER);
    polyD_->SetHint(L"à la souris");
    polyD_->SetToolTip(L"Ø du cercle tangent aux côtés (sur-plats). Vide : à la souris");
    ligne->Add(libelle(L"Côtés"), 0, wxALIGN_CENTER_VERTICAL | wxLEFT, FromDIP(10));
    ligne->Add(polyN_, 0, wxALIGN_CENTER_VERTICAL | wxLEFT | wxTOP | wxBOTTOM, FromDIP(6));
    ligne->Add(libelle(L"Ø intérieur"), 0, wxALIGN_CENTER_VERTICAL | wxLEFT, FromDIP(10));
    ligne->Add(polyD_, 0, wxALIGN_CENTER_VERTICAL | wxLEFT | wxRIGHT, FromDIP(6));
    barrePoly_->SetSizerAndFit(ligne);
    polyN_->Bind(wxEVT_SPINCTRL, [this](wxSpinEvent&) { lireBarrePolygone(); });
    polyN_->Bind(wxEVT_TEXT, [this](wxCommandEvent& e) {
      e.Skip();
      lireBarrePolygone();
    });
    polyD_->Bind(wxEVT_TEXT, [this](wxCommandEvent& e) {
      e.Skip();
      lireBarrePolygone();
    });
    const auto valider = [this](wxCommandEvent&) {
      lireBarrePolygone();
      SetFocus();
      if (!dessin_) return;
      dessin_->vue(echelle_);
      dessin_->entree();
      apresGeste();
    };
    polyN_->Bind(wxEVT_TEXT_ENTER, valider);
    polyD_->Bind(wxEVT_TEXT_ENTER, valider);
    const auto echap = [this](wxKeyEvent& e) {
      if (e.GetKeyCode() != WXK_ESCAPE) return e.Skip();
      SetFocus();
      echapDessin();
    };
    polyN_->Bind(wxEVT_CHAR_HOOK, echap);
    polyD_->Bind(wxEVT_CHAR_HOOK, echap);
  }
  if (barrePoly_->IsShown() != oui) barrePoly_->Show(oui);
}

void VueEsquisse::poserDessin(Dessin* d) {
  dessin_ = d;
  gauche_ = dblEnAttente_ = false;
  if (d) d->grille = accrocheGrille_;
  majBarrePolygone();
  Refresh();
}

void VueEsquisse::poserInfos(const InfosEsquisse& i) {
  infos_ = i;
  Refresh();
}

void VueEsquisse::basculerGrille() {
  grille_ = !grille_;
  Refresh();
}

void VueEsquisse::basculerFantome() {
  voirFantome_ = !voirFantome_;
  Refresh();
}

void VueEsquisse::reglerAccrocheGrille(bool oui) {
  accrocheGrille_ = oui;
  if (dessin_) dessin_->grille = oui;
}

void VueEsquisse::centrerSur(double x, double y) {
  cx_ = x;
  cy_ = y;
  Refresh();
}

void VueEsquisse::ouvrirCoteParId(const std::string& id) {
  Update();  // les zones des cotes doivent être à jour
  ouvrirCote(id);
}

void VueEsquisse::apresGeste() {
  if (!dessin_) return;
  majBarrePolygone();
  if (dessin_->aChange()) {
    dessin_->changeVu();
    if (surDessinChange) surDessinChange();
  }
  if (surGeste) surGeste();
  Refresh();
}

bool VueEsquisse::echapDessin() {
  if (!dessin_ || (dessin_->outil() == Dessin::SELECTION && !dessin_->enCours())) return false;
  dessin_->echap();
  apresGeste();
  return true;
}

bool VueEsquisse::abandonnerTrace() {
  if (!dessin_ || !dessin_->enCours()) return false;
  dessin_->annulerTrace();
  apresGeste();
  return true;
}

wxPoint2DDouble VueEsquisse::plan(const wxPoint& p) const {
  const wxPoint q = ToDIP(p);
  const wxSize t = ToDIP(GetClientSize());
  const double sx = q.x - t.x / 2.0, sy = q.y - t.y / 2.0;
  return wxPoint2DDouble(cx_ + (hautY_ * sx - hautX_ * sy) / echelle_, cy_ + (-hautX_ * sx - hautY_ * sy) / echelle_);
}

// La dernière dessinée est au-dessus
std::string VueEsquisse::zoneSous(const wxPoint& q) const {
  for (auto z = zonesCotes_.rbegin(); z != zonesCotes_.rend(); ++z) {
    const double dx = q.x - z->x, dy = q.y - z->y, c = std::cos(z->angle), n = std::sin(z->angle);
    if (std::abs(dx * c + dy * n) <= z->demiL && std::abs(-dx * n + dy * c) <= z->demiH) return z->id;
  }
  return "";
}

std::string VueEsquisse::ligneSous(const wxPoint& q) const {
  for (const ZoneLigne& z : zonesLignes_) {
    if (z.arc) {
      for (const wxPoint2DDouble& p : z.pts)
        if (std::hypot(p.m_x - q.x, p.m_y - q.y) < 7) return z.id;
    } else if (z.pts.size() == 2) {
      const double dx = z.pts[1].m_x - z.pts[0].m_x, dy = z.pts[1].m_y - z.pts[0].m_y, L2 = dx * dx + dy * dy;
      const double t = L2 > 0 ? std::clamp(((q.x - z.pts[0].m_x) * dx + (q.y - z.pts[0].m_y) * dy) / L2, 0.0, 1.0) : 0;
      if (std::hypot(q.x - (z.pts[0].m_x + t * dx), q.y - (z.pts[0].m_y + t * dy)) < 7) return z.id;
    }
  }
  return "";
}

void VueEsquisse::ouvrirCote(const std::string& id, const wxString& texteDepart) {
  for (const Cote& d : s_->cotes) {
    if (d.id != id) continue;
    for (const ZoneCote& z : zonesCotes_)
      if (z.id == id) {
        wxString texte;
        if (surDemandeCote && surDemandeCote(d, texte)) {
          ouvrirSaisie(d, texteDepart.empty() ? texte : texteDepart, z.x, z.y);
          if (!texteDepart.empty()) saisie_->SetInsertionPointEnd();
        }
        return;
      }
    return;
  }
}

// skDimEditPick : pendant la saisie, un clic sur une autre cote insère son nom. Une valeur seule est remplacée, une expression complétée au curseur.
void VueEsquisse::insererNomCote(const std::string& id) {
  if (id == coteEnSaisie_ || !surNomCote) {
    saisie_->SetFocus();
    return;
  }
  wxString nm;
  if (!surNomCote(id, nm) || nm.empty()) {
    saisie_->SetFocus();
    return;
  }
  const wxString cur = saisie_->GetValue();
  long debutDroite = 0;
  const int eg = cur.Find('=');
  if (eg != wxNOT_FOUND && (eg + 1 >= static_cast<int>(cur.length()) || cur[eg + 1] != '=')) {
    bool nom = eg > 0;
    for (int i = 0; i < eg; i++) nom = nom && (wxIsalnum(cur[i]) || cur[i] == '_' || cur[i] == ' ');
    if (nom) {
      debutDroite = eg + 1;
      while (debutDroite < static_cast<long>(cur.length()) && cur[debutDroite] == ' ') debutDroite++;
    }
  }
  wxString droite = cur.Mid(debutDroite);
  droite.Trim(true);
  for (const wchar_t* u : {L"mm", L"°", L"deg"})
    if (droite.Lower().EndsWith(u)) {
      droite = droite.Left(droite.length() - wcslen(u));
      droite.Trim(true);
      break;
    }
  if (parEstNombre(std::string(droite.utf8_str()))) {
    saisie_->ChangeValue(cur.Left(debutDroite) + nm);
    saisie_->SetInsertionPointEnd();
  } else {
    long a = 0, b = 0;
    saisie_->GetSelection(&a, &b);
    a = std::max(a, debutDroite);
    b = std::max(b, a);
    saisie_->Replace(a, b, nm);
    saisie_->SetInsertionPoint(a + static_cast<long>(nm.length()));
  }
  saisie_->SetFocus();
  const wxSize t = FromDIP(wxSize(std::max(80, std::min(320, 8 * static_cast<int>(saisie_->GetValue().length()) + 24)), 24));
  const wxRect r = saisie_->GetRect();
  saisie_->SetSize(r.x + r.width / 2 - t.x / 2, r.y, t.x, t.y);
}

void VueEsquisse::surGaucheBas(wxMouseEvent& ev) {
  if (enSaisie()) {
    const wxPoint dip = ToDIP(ev.GetPosition());
    std::string id = zoneSous(dip);
    if (id.empty()) id = ligneSous(dip);
    if (!id.empty()) {
      insererNomCote(id);
      return;
    }
  }
  SetFocus();
  if (!dessin_ || !s_) return;
  if (dessin_->outil() == Dessin::SELECTION) {
    const std::string id = zoneSous(ToDIP(ev.GetPosition()));
    if (!id.empty()) {  // une valeur se déplace au glisser, s'ouvre au double-clic
      if (!HasCapture()) CaptureMouse();
      gauche_ = true;
      const auto w = plan(ev.GetPosition());
      dessin_->vue(echelle_);
      dessin_->prendreCote(id, w.m_x, w.m_y);
      apresGeste();
      return;
    }
  }
  // Avec l'outil Cote, un clic sur une valeur existante l'ouvre, sans repasser par Sélection
  if (dessin_->outil() == Dessin::COTE && !dessin_->poseEnCours() && !dessin_->coteCommencee()) {
    const std::string id = zoneSous(ToDIP(ev.GetPosition()));
    if (!id.empty()) {
      dessin_->choisirCote(id);
      if (dessin_->rendrePilotante(id)) ouvrirCote(id);
      apresGeste();
      return;
    }
  }
  if (!HasCapture()) CaptureMouse();
  gauche_ = true;
  const auto w = plan(ev.GetPosition());
  dessin_->vue(echelle_);
  const bool select = dessin_->outil() == Dessin::SELECTION && !ev.LeftDClick();
  dessin_->majTenue = ev.ShiftDown() || essaiMaj;
  dessin_->enfonce(w.m_x, w.m_y, ev.ControlDown(), select ? ligneSous(ToDIP(ev.GetPosition())) : std::string());
  apresGeste();
}

void VueEsquisse::surGaucheHaut(wxMouseEvent& ev) {
  if (!dessin_ || !s_) return;
  const auto w = plan(ev.GetPosition());
  if (gauche_) {
    gauche_ = false;
    if (HasCapture() && !geste_.actif) ReleaseMouse();
    dessin_->vue(echelle_);
    dessin_->relache(w.m_x, w.m_y);
    apresGeste();
    ouvrirCoteDemandee();
  }
  if (dblEnAttente_) {
    dblEnAttente_ = false;
    const std::string id = dessin_->doubleClic(dblPlan_.m_x, dblPlan_.m_y);
    apresGeste();
    if (!id.empty()) {
      Update();  // les zones des cotes doivent être à jour
      ouvrirCote(id);
    }
  }
}

void VueEsquisse::commande(const std::function<void(Dessin&)>& f) {
  if (!dessin_ || enSaisie()) return;
  dessin_->vue(echelle_);
  f(*dessin_);
  apresGeste();
  SetFocus();
}

void VueEsquisse::ouvrirCoteDemandee() {
  if (!dessin_) return;
  const std::string id = dessin_->prendreCoteAOuvrir();
  if (id.empty()) return;
  Update();  // les zones des cotes doivent être à jour
  ouvrirCote(id);
}

// Longueur tapée pendant le tracé, valeur tapée pendant la pose d'une cote : le caractère vraiment produit, quel que soit le clavier
void VueEsquisse::surCaractere(wxKeyEvent& ev) {
  const wxChar c = ev.GetUnicodeKey();
  if (!dessin_ || enSaisie() || ev.ControlDown() || ev.AltDown() || c == WXK_NONE || c > 127) return ev.Skip();
  const char k = static_cast<char>(c);
  dessin_->vue(echelle_);
  if (dessin_->outil() == Dessin::POLYGONE && k >= '0' && k <= '9') {  // skPolyType : le chiffre part dans le champ Ø
    majBarrePolygone();
    if (polyD_) {
      polyD_->SetValue(wxString(k));
      polyD_->SetFocus();
      polyD_->SetInsertionPointEnd();
    }
    return;
  }
  if (dessin_->caractere(k)) {
    Refresh();
    return;
  }
  if (dessin_->poseEnCours() && ((k >= '0' && k <= '9') || k == '.' || k == ',' || k == '-')) {
    const std::string id = dessin_->poserCoteIci();
    apresGeste();
    if (!id.empty()) {
      Update();
      ouvrirCote(id, wxString(k == ',' ? '.' : k));
    }
    return;
  }
  ev.Skip();
}

void VueEsquisse::surTouche(wxKeyEvent& ev) {
  const int code = ev.GetKeyCode();
  if (dessin_ && !enSaisie()) {
    dessin_->vue(echelle_);
    if (code == WXK_TAB && dessin_->tabulation()) {
      Refresh();
      return;
    }
    if (code == WXK_RETURN || code == WXK_NUMPAD_ENTER) {
      if (dessin_->entree()) {
        apresGeste();
        return;
      }
      if (dessin_->poseEnCours()) {
        const std::string id = dessin_->poserCoteIci();
        apresGeste();
        if (!id.empty()) {
          Update();
          ouvrirCote(id);
        }
        return;
      }
    }
    if (code == WXK_BACK) {
      if (!dessin_->retourArriere()) dessin_->supprimer();
      apresGeste();
      return;
    }
  }
  if (dessin_ && ev.GetKeyCode() == WXK_DELETE && !enSaisie()) {
    dessin_->supprimer();
    apresGeste();
    return;
  }
  // Les raccourcis du navigateur : une lettre pour un outil, F1 à F12 pour les contraintes (skShortcut)
  if (dessin_ && !enSaisie() && !ev.ControlDown() && !ev.AltDown() && !dessin_->saisieTracee().actif) {
    if (code == WXK_F1) return commande([](Dessin& d) { d.toucheF1(); });
    if (code == WXK_F2) return commande([](Dessin& d) { d.toucheF2(); });
    const char* type = code == WXK_F3 ? "tangent" : code == WXK_F4 ? "equal" : code == WXK_F5 ? "parallel" : code == WXK_F6 ? "perpendicular" : code == WXK_F7 ? "midpoint" : code == WXK_F8 ? "coaxial" : code == WXK_F9 ? "collinear" : code == WXK_F10 ? "symmetric" : code == WXK_F12 ? "fix" : nullptr;
    if (type) return commande([type](Dessin& d) { d.poserContrainte(type); });
    if (!ev.ShiftDown()) {
      int o = -1;
      switch (code) {
        case 'A': o = Dessin::ARC; break;
        case 'L': o = Dessin::LIGNE; break;
        case 'C': o = Dessin::CERCLE; break;
        case 'G': o = Dessin::POLYGONE; break;
        case 'R': o = Dessin::RECTANGLE; break;
        case 'B': o = Dessin::OBLONG; break;
        case 'T': o = Dessin::AJUSTER; break;
        case 'D': o = Dessin::COTE; break;
        case 'F': o = Dessin::CONGE; break;
        case 'O': o = Dessin::DECALER; break;
        case 'H': o = Dessin::PERCAGE; break;
        case 'S': o = Dessin::SPLINE; break;
        case 'P': o = Dessin::PROJETER; break;
        case 'I': o = Dessin::INTERSECTION; break;
        default: break;
      }
      if (o >= 0) return commande([o](Dessin& d) { d.choisirOutil(static_cast<Dessin::Outil>(o)); });
    } else if (code == 'S') {
      return commande([](Dessin& d) { d.choisirOutil(Dessin::CSPLINE); });
    }
  }
  if (ev.GetKeyCode() == 'X' && !ev.HasAnyModifiers() && !(dessin_ && dessin_->saisieTracee().actif)) {
    commande([](Dessin& d) { d.poserContrainte("construction"); });
    return;
  }
  ev.Skip();
}

void VueEsquisse::montrer(const Esquisse* s, const TopoDS_Shape& piece) {
  s_ = s;
  infos_ = InfosEsquisse();
  annulerSaisie();
  zonesCotes_.clear();
  nonDessines_ = 0;
  hautX_ = 0;
  hautY_ = 1;
  if (s_) {
    // Vue à plat comme le navigateur (skOrbFrontUp) : Z du monde vers le haut ; plan horizontal : Y.
    const bool plat = std::abs(s_->n[2]) > 0.95;
    const double hx = plat ? s_->u[1] : s_->u[2], hy = plat ? s_->v[1] : s_->v[2], hl = std::hypot(hx, hy);
    if (hl > 1e-6) {
      hautX_ = hx / hl;
      hautY_ = hy / hl;
    }
    for (const Entite& en : s_->entites)
      if (en.t != "line" && en.t != "arc" && en.t != "circle" && en.t != "cpoint" && en.t != "spline") nonDessines_++;
  }
  fantomeDe(piece);
  ajuster();
}

// Fantôme : les arêtes de la pièce vues de face, projetées dans le plan de l'esquisse
void VueEsquisse::fantomeDe(const TopoDS_Shape& piece) {
  traitsFantome_.clear();
  if (!s_ || piece.IsNull()) return;
  const gp_Pnt o(s_->o[0], s_->o[1], s_->o[2]);
  const gp_Dir u(s_->u[0], s_->u[1], s_->u[2]), v(s_->v[0], s_->v[1], s_->v[2]);
  for (TopExp_Explorer x(piece, TopAbs_EDGE); x.More(); x.Next()) {
    const TopoDS_Edge a = TopoDS::Edge(x.Current());
    BRepAdaptor_Curve c;
    try {
      c.Initialize(a);
    } catch (const Standard_Failure&) {
      continue;
    }
    GCPnts_TangentialDeflection d(c, 0.2, 0.05);
    for (int i = 1; i < d.NbPoints(); i++) {
      const gp_Vec p(o, d.Value(i)), q(o, d.Value(i + 1));
      traitsFantome_.push_back({p.Dot(gp_Vec(u)), p.Dot(gp_Vec(v)), q.Dot(gp_Vec(u)), q.Dot(gp_Vec(v))});
    }
  }
}

void VueEsquisse::majPiece(const TopoDS_Shape& piece) {
  fantomeDe(piece);
  Refresh();
}

void VueEsquisse::noterZone(const Cote& d, double x, double y, double demiL, double demiH, double angle) const {
  zonesCotes_.push_back({d.id, x, y, demiL, demiH, angle});
}

bool VueEsquisse::positionCote(const std::string& id, wxPoint& p) const {
  for (const ZoneCote& z : zonesCotes_)
    if (z.id == id) {
      p = FromDIP(wxPoint(static_cast<int>(z.x), static_cast<int>(z.y)));
      return true;
    }
  return false;
}

void VueEsquisse::surDoubleClic(wxMouseEvent& ev) {
  if (!s_) return;
  SetFocus();
  const std::string id = (!dessin_ || dessin_->outil() == Dessin::SELECTION) ? zoneSous(ToDIP(ev.GetPosition())) : "";
  if (!id.empty()) return ouvrirCote(id);
  if (!dessin_) return;
  // Windows remplace le second « enfoncé » par ce double-clic : le navigateur, lui, voit les deux.
  surGaucheBas(ev);
  dblPlan_ = plan(ev.GetPosition());
  dblEnAttente_ = true;
}

void VueEsquisse::ouvrirSaisie(const Cote& c, const wxString& texte, double x, double y) {
  if (!saisie_) {
    saisie_ = new wxTextCtrl(this, 2005, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_ENTER | wxTE_CENTER);
    saisie_->Bind(wxEVT_TEXT_ENTER, [this](wxCommandEvent&) { validerSaisie(); });
    saisie_->Bind(wxEVT_KILL_FOCUS, [this](wxFocusEvent& e) {
      e.Skip();
      CallAfter([this] { annulerSaisie(); });
    });
    if (surChampFormule) surChampFormule(saisie_);
  }
  coteEnSaisie_ = c.id;
  const wxSize t = FromDIP(wxSize(std::max(80, std::min(260, 8 * static_cast<int>(texte.length()) + 24)), 24));
  const wxPoint p = FromDIP(wxPoint(static_cast<int>(x), static_cast<int>(y)));
  saisie_->SetSize(p.x - t.x / 2, p.y - t.y / 2, t.x, t.y);
  saisie_->ChangeValue(texte);
  saisie_->Show();
  saisie_->SetFocus();
  saisie_->SelectAll();
}

void VueEsquisse::validerSaisie() {
  if (!enSaisie()) return;
  const std::string id = coteEnSaisie_;
  const wxString t = saisie_->GetValue();
  annulerSaisie();
  if (surSaisieCote) CallAfter([this, id, t] { surSaisieCote(id, t); });  // jamais de calcul au milieu de l'événement du champ
}

void VueEsquisse::annulerSaisie() {
  if (!enSaisie()) return;
  saisie_->Hide();
  SetFocus();
}

// skFitView (src/50-esquisse-1) : l'origine n'entre pas dans le cadrage.
void VueEsquisse::ajuster() {
  if (!s_) return;
  const wxSize t = ToDIP(GetClientSize());
  const double W = std::max(100, t.x), H = std::max(100, t.y);
  double x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18;  // boîte dans le repère de l'écran
  for (const auto& [id, p] : s_->points) {
    if (id == "O") continue;
    const double a = hautY_ * p.x - hautX_ * p.y, b = hautX_ * p.x + hautY_ * p.y;
    x0 = std::min(x0, a);
    x1 = std::max(x1, a);
    y0 = std::min(y0, b);
    y1 = std::max(y1, b);
  }
  if (x0 > x1) {
    echelle_ = std::max(ECHELLE_MIN, std::min(W, H) / 130);
    cx_ = cy_ = 0;
  } else {
    const double bw = std::max(x1 - x0, 0.01), bh = std::max(y1 - y0, 0.01);
    echelle_ = std::max(ECHELLE_MIN, std::min(ECHELLE_MAX, std::min(W / bw, H / bh) * 0.7));
    const double a = (x0 + x1) / 2, b = (y0 + y1) / 2;
    cx_ = hautY_ * a + hautX_ * b;
    cy_ = -hautX_ * a + hautY_ * b;
  }
  Refresh();
}

wxPoint2DDouble VueEsquisse::e(double x, double y) const {
  const wxSize t = ToDIP(GetClientSize());
  const auto d = direction(x - cx_, y - cy_);
  return wxPoint2DDouble(t.x / 2.0 + d.m_x * echelle_, t.y / 2.0 + d.m_y * echelle_);
}

wxPoint2DDouble VueEsquisse::direction(double x, double y) const {
  return wxPoint2DDouble(hautY_ * x - hautX_ * y, -(hautX_ * x + hautY_ * y));
}

void VueEsquisse::surEnfonce(wxMouseEvent& ev) {
  SetFocus();
  if (!HasCapture()) CaptureMouse();
  geste_ = {ev.GetPosition(), cx_, cy_, true};
}
void VueEsquisse::surRelache(wxMouseEvent& ev) {
  const wxPoint d = ToDIP(ev.GetPosition() - geste_.depart);
  const bool clicDroit = geste_.actif && ev.RightUp() && std::abs(d.x) + std::abs(d.y) < 4;
  geste_.actif = false;
  if (HasCapture() && !gauche_) ReleaseMouse();
  // Clic droit sans glisser, comme le navigateur (écouteur contextmenu)
  if (clicDroit) clicDroitDessin(ev.GetPosition());
}

void VueEsquisse::essaiSouris(wxEventType type, double x, double y, bool ctrl) {
  const wxPoint2DDouble q = e(x, y);
  wxMouseEvent ev(type);
  ev.SetEventObject(this);
  ev.SetId(GetId());
  ev.SetPosition(FromDIP(wxPoint(static_cast<int>(std::lround(q.m_x)), static_cast<int>(std::lround(q.m_y)))));
  ev.SetControlDown(ctrl);
  ev.SetLeftDown(type == wxEVT_LEFT_DOWN);
  ev.SetRightDown(type == wxEVT_RIGHT_DOWN);
  GetEventHandler()->ProcessEvent(ev);
}
void VueEsquisse::essaiTouche(int code) {
  wxKeyEvent ev(wxEVT_KEY_DOWN);
  ev.SetEventObject(this);
  ev.m_keyCode = code;
  GetEventHandler()->ProcessEvent(ev);
}
void VueEsquisse::essaiCaractere(wxChar c) {
  wxKeyEvent ev(wxEVT_CHAR);
  ev.SetEventObject(this);
  ev.m_keyCode = c;
  ev.m_uniChar = c;
  GetEventHandler()->ProcessEvent(ev);
}
void VueEsquisse::essaiReglagesPolygone(const wxString& cotes, const wxString& diametre) {
  majBarrePolygone();
  if (!polyN_) return;
  long n = 0;
  if (cotes.ToLong(&n)) polyN_->SetValue(static_cast<int>(n));
  polyD_->SetValue(diametre);
  lireBarrePolygone();
}

void VueEsquisse::clicDroitDessin(const wxPoint& ou) {
  if (!dessin_ || enSaisie()) return;
  dessin_->vue(echelle_);
  if (dessin_->finirSpline()) {  // clic droit : fin du tracé
    apresGeste();
    return;
  }
  if (dessin_->poseEnCours()) {
    dessin_->annulerPoseCote();
    apresGeste();
    return;
  }
  const bool outilIsect = dessin_->outil() == Dessin::INTERSECTION;
  const std::string sous = outilIsect ? std::string() : zoneSous(ToDIP(ou));
  if (!sous.empty()) {
    dessin_->choisirCote(sous);
    apresGeste();
  }
  if (!outilIsect && !dessin_->aSelection()) {
    abandonnerTrace();
    return;
  }
  std::string titre;
  const std::vector<Dessin::EntreeMenu> entrees = dessin_->menuContextuel(titre);
  wxMenu menu;
  auto* entete = menu.Append(wxID_ANY, wxString::FromUTF8(titre));
  entete->Enable(false);
  menu.AppendSeparator();
  const int base = 7000;
  for (size_t i = 0; i < entrees.size(); i++) {
    auto* item = new wxMenuItem(&menu, base + static_cast<int>(i), wxString::FromUTF8(entrees[i].libelle));
    if (!entrees[i].icone.empty()) item->SetBitmap(iconeMenuEsquisse(entrees[i].icone));
    menu.Append(item);
    if (!entrees[i].disponible) item->Enable(false);
  }
  int choix = wxID_NONE;
  if (essaiSansMenu) {
    essaiEntreesMenu.clear();
    for (size_t i = 0; i < entrees.size(); i++) {
      essaiEntreesMenu.push_back(entrees[i].libelle);
      if (entrees[i].libelle == essaiChoixMenu && entrees[i].disponible) choix = base + static_cast<int>(i);
    }
  } else {
    choix = GetPopupMenuSelectionFromUser(menu, ou);
  }
  if (choix < base || choix >= base + static_cast<int>(entrees.size())) return;
  const std::string code = entrees[choix - base].code;
  if (code.empty()) return;
  if (code == "modifier") {
    const std::vector<Dessin::Choix>& sel = dessin_->selection();
    if (!sel.empty()) ouvrirCoteParId(sel[0].id);
    return;
  }
  commande([&code](Dessin& de) { de.actionMenu(code); });
}
void VueEsquisse::surMouvement(wxMouseEvent& ev) {
  if (!geste_.actif) {
    if (!dessin_ || !s_) return;
    const auto w = plan(ev.GetPosition());
    dessin_->vue(echelle_);
    const bool avant = dessin_->enCours() || dessin_->outil() != Dessin::SELECTION;
    dessin_->majTenue = ev.ShiftDown() || essaiMaj;
    dessin_->bouge(w.m_x, w.m_y, ev.LeftIsDown());
    if (avant || dessin_->enCours()) apresGeste();
    return;
  }
  const wxPoint d = ToDIP(ev.GetPosition() - geste_.depart);
  cx_ = geste_.cx - (hautY_ * d.x - hautX_ * d.y) / echelle_;
  cy_ = geste_.cy - (-hautX_ * d.x - hautY_ * d.y) / echelle_;
  Refresh();
}
void VueEsquisse::surMolette(wxMouseEvent& ev) {
  // Le point du monde sous le curseur ne bouge pas
  const wxPoint p = ToDIP(ev.GetPosition());
  const wxSize t = ToDIP(GetClientSize());
  const double sx = p.x - t.x / 2.0, sy = p.y - t.y / 2.0;
  const double dx = (hautY_ * sx - hautX_ * sy), dy = (-hautX_ * sx - hautY_ * sy);  // écran → plan
  const double wx0 = cx_ + dx / echelle_, wy0 = cy_ + dy / echelle_;
  const double k = std::pow(1.15, ev.GetWheelRotation() / 120.0);
  echelle_ = std::max(ECHELLE_MIN, std::min(ECHELLE_MAX, echelle_ * k));
  cx_ = wx0 - dx / echelle_;
  cy_ = wy0 - dy / echelle_;
  Refresh();
}

void VueEsquisse::surPeinture(wxPaintEvent&) {
  wxAutoBufferedPaintDC dc(this);
  dessiner(dc);
  std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::CreateFromUnknownDC(dc));
  if (!g) return;
  const wxSize t = GetClientSize();
  const double r = FromDIP(12);
  wxGraphicsPath coins = g->CreatePath();
  coins.MoveToPoint(0, 0);
  coins.AddLineToPoint(r, 0);
  coins.AddQuadCurveToPoint(0, 0, 0, r);
  coins.CloseSubpath();
  coins.MoveToPoint(t.x, 0);
  coins.AddLineToPoint(t.x - r, 0);
  coins.AddQuadCurveToPoint(t.x, 0, t.x, r);
  coins.CloseSubpath();
  g->SetBrush(g->CreateBrush(wxBrush(GetParent()->GetBackgroundColour())));
  g->SetPen(wxNullGraphicsPen);
  g->FillPath(coins);
}

bool VueEsquisse::enregistrer(const wxString& chemin) {
  const wxSize t = GetClientSize();
  wxBitmap image(t.x, t.y, 32);
  {
    wxMemoryDC dc(image);
    dessiner(dc);
  }
  return image.SaveFile(chemin, wxBITMAP_TYPE_PNG);
}

void VueEsquisse::dessiner(wxDC& dc) {
  dc.SetBackground(wxBrush(FOND_VUE));
  dc.Clear();
  if (!s_) return;
  std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::CreateFromUnknownDC(dc));
  if (!g) return;
  const double f = GetDPIScaleFactor();
  g->Scale(f, f);  // comme le SVG d'origine : tout est en pixels logiques
  g->SetAntialiasMode(wxANTIALIAS_DEFAULT);
  const wxSize t = ToDIP(GetClientSize());
  grille(*g, t.x, t.y);
  fantome(*g);
  zones(*g);
  entites(*g);
  halo(*g);
  points(*g);
  sante(*g);
  cotes(*g);
  projections(*g);
  sections(*g);
  survolPlan(*g);
  trace(*g);
}

// Outil Intersection : les courbes de section en bleu clair, les faces retenues en bleu, le survol en orange (skIsectDraw)
void VueEsquisse::sections(wxGraphicsContext& g) const {
  if (!dessin_ || dessin_->outil() != Dessin::INTERSECTION || !dessin_->sectionsCandidates) return;
  const std::vector<CourbeSection>* L = dessin_->sectionsCandidates();
  if (!L) return;
  const auto tracer = [&](const CourbeSection& c) {
    wxGraphicsPath p = g.CreatePath();
    if (c.sorte == CourbeSection::LIGNE) {
      p.MoveToPoint(e(c.x1, c.y1));
      p.AddLineToPoint(e(c.x2, c.y2));
    } else if (c.sorte == CourbeSection::COURBE) {
      for (size_t i = 0; i < c.dense.size(); i++) {
        if (i) p.AddLineToPoint(e(c.dense[i][0], c.dense[i][1]));
        else p.MoveToPoint(e(c.dense[i][0], c.dense[i][1]));
      }
    } else {
      double a1 = 0, dd = 2 * 3.14159265358979323846;
      if (c.sorte == CourbeSection::ARC) {
        a1 = std::atan2(c.y1 - c.cy, c.x1 - c.cx);
        dd = std::atan2(c.y2 - c.cy, c.x2 - c.cx) - a1;
        while (dd <= 0) dd += 2 * 3.14159265358979323846;
      }
      const int n = std::max(8, static_cast<int>(std::ceil(dd / 0.05)));
      for (int i = 0; i <= n; i++) {
        const double a = a1 + dd * i / n;
        const auto q = e(c.cx + c.r * std::cos(a), c.cy + c.r * std::sin(a));
        if (i) p.AddLineToPoint(q);
        else p.MoveToPoint(q);
      }
    }
    g.StrokePath(p);
  };
  g.SetBrush(wxNullGraphicsBrush);
  g.SetPen(stylo(g, alpha(wxColour(0x64, 0xd2, 0xff), 0.7), 1.5, {5, 3}));
  for (const CourbeSection& c : *L) tracer(c);
  g.SetPen(stylo(g, alpha(wxColour(0x0a, 0x84, 0xff), 0.95), 3));
  for (const CourbeSection& c : *L)
    if (dessin_->sectionRetenue(c)) tracer(c);
  g.SetPen(stylo(g, alpha(wxColour(0xff, 0x9f, 0x0a), 0.95), 3));
  for (const CourbeSection* c : dessin_->groupeSurvole()) tracer(*c);
}

// Outil Projeter : les autres esquisses en bleu, tiretées, et ce qui est sous la souris en orange (skpDessin)
void VueEsquisse::projections(wxGraphicsContext& g) const {
  if (!dessin_ || dessin_->outil() != Dessin::PROJETER) return;
  using P = Dessin::Projetable;
  const auto tracer = [&](const P& pr) {
    wxGraphicsPath p = g.CreatePath();
    if (pr.sorte == P::LIGNE) {
      p.MoveToPoint(e(pr.x1, pr.y1));
      p.AddLineToPoint(e(pr.x2, pr.y2));
    } else if (pr.sorte == P::CERCLE || pr.sorte == P::ARC) {
      double a1 = 0, dd = 2 * 3.14159265358979323846;
      if (pr.sorte == P::ARC) {
        a1 = std::atan2(pr.y1 - pr.cy, pr.x1 - pr.cx);
        const double a2 = std::atan2(pr.y2 - pr.cy, pr.x2 - pr.cx);
        dd = a2 - a1;
        while (dd <= 0) dd += 2 * 3.14159265358979323846;
      }
      const int n = std::max(8, static_cast<int>(std::ceil(dd / 0.05)));
      for (int i = 0; i <= n; i++) {
        const double a = a1 + dd * i / n;
        const auto q = e(pr.cx + pr.r * std::cos(a), pr.cy + pr.r * std::sin(a));
        if (i) p.AddLineToPoint(q);
        else p.MoveToPoint(q);
      }
    } else if (pr.sorte == P::COURBE && pr.pts.size() > 1) {
      p.MoveToPoint(e(pr.pts[0][0], pr.pts[0][1]));
      for (size_t i = 1; i < pr.pts.size(); i++) p.AddLineToPoint(e(pr.pts[i][0], pr.pts[i][1]));
    }
    g.StrokePath(p);
  };
  const wxColour BLEU(0x5a, 0xc8, 0xfa), ORANGE(0xff, 0x9f, 0x0a);
  g.SetBrush(wxNullGraphicsBrush);
  for (const Dessin::SourceProjection& it : dessin_->sourcesProjection()) {
    g.SetPen(stylo(g, alpha(BLEU, 0.9), 1.5, {3, 3}));
    for (const P& f : it.formes) tracer(f);
    g.SetPen(stylo(g, BLEU, 1.2));
    g.SetBrush(g.CreateBrush(wxBrush(wxColour(0x10, 0x10, 0x12))));
    for (const P2d& q : it.pts) {
      const auto c = e(q[0], q[1]);
      g.DrawRectangle(c.m_x - 2.5, c.m_y - 2.5, 5, 5);
    }
    g.SetBrush(wxNullGraphicsBrush);
  }
  const P& pr = dessin_->survolProjection();
  if (!pr) return;
  g.SetPen(stylo(g, ORANGE, 3));
  if (pr.sorte == P::UN_POINT) {
    const auto c = e(pr.x1, pr.y1);
    g.SetBrush(g.CreateBrush(wxBrush(ORANGE)));
    g.DrawRectangle(c.m_x - 4.5, c.m_y - 4.5, 9, 9);
    g.SetBrush(wxNullGraphicsBrush);
    return;
  }
  tracer(pr);
  if (pr.sorte == P::CERCLE || pr.sorte == P::ARC) {
    const auto c = e(pr.cx, pr.cy);
    g.SetPen(stylo(g, ORANGE, 1));
    g.DrawRectangle(c.m_x - 3, c.m_y - 3, 6, 6);
  }
}

// L'arête ou le point du solide sous la souris, en orange (skPlDrawHover) ; hors du plan : en tiretés
void VueEsquisse::survolPlan(wxGraphicsContext& g) const {
  if (!dessin_) return;
  const Dessin::CiblePlan& h = dessin_->survolPlan();
  const Dessin::Outil o = dessin_->outil();
  if (!h || o == Dessin::PROJETER || o == Dessin::INTERSECTION || o == Dessin::AJUSTER || o == Dessin::DECALER || o == Dessin::CONGE || o == Dessin::CHANFREIN || o == Dessin::COINCIDENT) return;
  using F = Dessin::FormePlan;
  const Dessin::CiblesPlan& T = dessin_->ciblesPlan();
  const wxColour C(0xff, 0x9f, 0x0a), FOND(0x10, 0x10, 0x12);
  std::vector<const F*> lit;
  if (!h.estPoint) {
    if (h.i >= 0 && h.i < static_cast<int>(T.E.size())) lit.push_back(&T.E[h.i]);
  } else {
    for (const int i : h.p.e)
      if (i >= 0 && i < static_cast<int>(T.E.size())) lit.push_back(&T.E[i]);
  }
  g.SetBrush(wxNullGraphicsBrush);
  for (const F* s : lit) {
    g.SetPen(s->loin ? stylo(g, alpha(C, 0.9), 3, {7, 4}) : stylo(g, alpha(C, 0.9), 3));
    wxGraphicsPath p = g.CreatePath();
    if (s->sorte == F::LIGNE) {
      p.MoveToPoint(e(s->x1, s->y1));
      p.AddLineToPoint(e(s->x2, s->y2));
    } else if (s->sorte == F::COURBE) {
      p.MoveToPoint(e(s->pts[0][0], s->pts[0][1]));
      for (size_t i = 1; i < s->pts.size(); i++) p.AddLineToPoint(e(s->pts[i][0], s->pts[i][1]));
    } else {
      double a1 = 0, dd = 2 * 3.14159265358979323846;
      if (s->sorte == F::ARC) {
        a1 = std::atan2(s->y1 - s->cy, s->x1 - s->cx);
        const double a2 = std::atan2(s->y2 - s->cy, s->x2 - s->cx);
        dd = a2 - a1;
        while (dd <= 0) dd += 2 * 3.14159265358979323846;
      }
      const int n = std::max(8, static_cast<int>(std::ceil(dd / 0.05)));
      for (int i = 0; i <= n; i++) {
        const double a = a1 + dd * i / n;
        const auto q = e(s->cx + s->r * std::cos(a), s->cy + s->r * std::sin(a));
        if (i) p.AddLineToPoint(q);
        else p.MoveToPoint(q);
      }
    }
    g.StrokePath(p);
  }
  // Les bouts des arêtes allumées : carrés creux
  g.SetPen(stylo(g, C, 1.5));
  g.SetBrush(g.CreateBrush(wxBrush(FOND)));
  for (const F* s : lit) {
    if (s->sorte == F::CERCLE) continue;
    const double bx[2] = {s->sorte == F::COURBE ? s->pts[0][0] : s->x1, s->sorte == F::COURBE ? s->pts.back()[0] : s->x2};
    const double by[2] = {s->sorte == F::COURBE ? s->pts[0][1] : s->y1, s->sorte == F::COURBE ? s->pts.back()[1] : s->y2};
    for (int k = 0; k < 2; k++) {
      const auto c = e(bx[k], by[k]);
      g.DrawRectangle(c.m_x - 4, c.m_y - 4, 8, 8);
    }
  }
  const auto c = e(h.x, h.y);
  g.SetPen(stylo(g, FOND, 1));
  g.SetBrush(g.CreateBrush(wxBrush(C)));
  if (h.estPoint && h.p.sorte == Dessin::PointPlan::TRAVERSEE) {
    wxGraphicsPath p = g.CreatePath();
    p.MoveToPoint(c.m_x, c.m_y - 6);
    p.AddLineToPoint(c.m_x + 6, c.m_y);
    p.AddLineToPoint(c.m_x, c.m_y + 6);
    p.AddLineToPoint(c.m_x - 6, c.m_y);
    p.CloseSubpath();
    g.DrawPath(p);
  } else if (h.estPoint) {
    g.DrawRectangle(c.m_x - 4.5, c.m_y - 4.5, 9, 9);
  } else if (o != Dessin::SELECTION) {
    g.DrawEllipse(c.m_x - 3.5, c.m_y - 3.5, 7, 7);
  }
  g.SetBrush(wxNullGraphicsBrush);
}

// Le tracé en cours, l'accroche et les guides, par-dessus tout
void VueEsquisse::trace(wxGraphicsContext& g) const {
  if (!dessin_) return;
  const Dessin::Boite& bx = dessin_->boite();
  if (bx.actif) {  // la fenêtre de sélection
    wxGraphicsPath p = g.CreatePath();
    p.MoveToPoint(e(bx.x0, bx.y0));
    p.AddLineToPoint(e(bx.x1, bx.y0));
    p.AddLineToPoint(e(bx.x1, bx.y1));
    p.AddLineToPoint(e(bx.x0, bx.y1));
    p.CloseSubpath();
    g.SetBrush(g.CreateBrush(wxBrush(alpha(AXE, 0.08))));
    g.SetPen(stylo(g, AXE, 1, {4, 3}));
    g.FillPath(p);
    g.StrokePath(p);
  }
  const Dessin::Brouillon& b = dessin_->brouillon();
  g.SetBrush(wxNullGraphicsBrush);
  g.SetPen(stylo(g, AXE, 1.6, {6, 4}));
  switch (b.sorte) {
    case Dessin::Brouillon::B_SPLINE: {
      const auto chemin = [&](const std::vector<wxPoint2DDouble>& v) {
        if (v.size() < 2) return;
        wxGraphicsPath p = g.CreatePath();
        p.MoveToPoint(v[0]);
        for (size_t i = 1; i < v.size(); i++) p.AddLineToPoint(v[i]);
        g.StrokePath(p);
      };
      if (b.ctrl) {  // points de contrôle : polygone vivant
        std::vector<wxPoint2DDouble> Q;
        for (const Pt& q : b.clics) Q.push_back(e(q.x, q.y));
        if (b.aCurseur) Q.push_back(e(b.curseur.x, b.curseur.y));
        else if (b.fermeture && !Q.empty()) Q.push_back(Q[0]);
        g.SetPen(stylo(g, VIOLET, 1.1, {3, 3}));
        chemin(Q);
      }
      std::vector<wxPoint2DDouble> C;
      for (const P2d& q : b.courbe) C.push_back(e(q[0], q[1]));
      g.SetPen(stylo(g, *wxWHITE, 2, {5, 3}));
      chemin(C);
      for (size_t i = 0; i < b.clics.size(); i++) {
        const auto q = e(b.clics[i].x, b.clics[i].y);
        g.SetBrush(g.CreateBrush(wxBrush(i == 0 && b.fermeture ? wxColour(255, 214, 10) : FOND)));
        g.SetPen(stylo(g, wxColour(255, 214, 10), 1.5));
        g.DrawRectangle(q.m_x - 4, q.m_y - 4, 8, 8);
      }
      g.SetBrush(wxNullGraphicsBrush);
      break;
    }
    case Dessin::Brouillon::B_LIGNE:
      ligne(g, e(b.x1, b.y1), e(b.x2, b.y2));
      break;
    case Dessin::Brouillon::B_RECT:
      ligne(g, e(b.x1, b.y1), e(b.x2, b.y1));
      ligne(g, e(b.x2, b.y1), e(b.x2, b.y2));
      ligne(g, e(b.x2, b.y2), e(b.x1, b.y2));
      ligne(g, e(b.x1, b.y2), e(b.x1, b.y1));
      break;
    case Dessin::Brouillon::B_OBLONG: {  // skSlotDrawDraft
      const wxColour jaune(0xff, 0xd6, 0x0a);
      const auto point = [&](const Pt& P) {
        const auto q = e(P.x, P.y);
        wxGraphicsPath c = g.CreatePath();
        c.AddCircle(q.m_x, q.m_y, 3);
        g.SetBrush(g.CreateBrush(wxBrush(jaune)));
        g.FillPath(c);
        g.SetBrush(wxNullGraphicsBrush);
      };
      const auto etiquette = [&](const Pt& m, const wxString& t) {
        const auto q = e(m.x, m.y);
        double L, H, dsc, ext;
        g.SetFont(g.CreateFont(wxFontInfo(10).Bold(), jaune));
        g.GetTextExtent(t, &L, &H, &dsc, &ext);
        g.DrawText(t, q.m_x - L / 2, q.m_y - 10 - H);
      };
      const auto axe = [&](const Pt& c1, const Pt& c2) {
        g.SetPen(stylo(g, jaune, 1, {6, 3, 1, 3}));
        ligne(g, e(c1.x, c1.y), e(c2.x, c2.y));
      };
      point(b.A);
      point(b.B);
      const double L = std::hypot(b.B.x - b.A.x, b.B.y - b.A.y);
      Pt c1, c2;
      if (!(b.r > 0) || !b.ok) {
        Dessin::centresOblong(b.mode, b.A, b.B, 0, c1, c2);
        axe(c1, c2);
        etiquette({(c1.x + c2.x) / 2, (c1.y + c2.y) / 2}, wxString::Format("%.2f", b.mode == "milieu" ? 2 * L : L));
        break;
      }
      Dessin::centresOblong(b.mode, b.A, b.B, b.r, c1, c2);
      const double D = std::hypot(c2.x - c1.x, c2.y - c1.y), a0 = std::atan2(c2.y - c1.y, c2.x - c1.x), pi = 3.141592653589793;
      wxGraphicsPath p = g.CreatePath();
      for (int k = 0; k <= 24; k++) {
        const double t = a0 + pi / 2 + k * pi / 24;
        const auto q = e(c1.x + b.r * std::cos(t), c1.y + b.r * std::sin(t));
        if (k == 0) p.MoveToPoint(q);
        else p.AddLineToPoint(q);
      }
      for (int k = 0; k <= 24; k++) {
        const double t = a0 - pi / 2 + k * pi / 24;
        p.AddLineToPoint(e(c2.x + b.r * std::cos(t), c2.y + b.r * std::sin(t)));
      }
      p.CloseSubpath();
      g.SetBrush(g.CreateBrush(wxBrush(wxColour(255, 255, 255, 15))));
      g.FillPath(p);
      g.SetBrush(wxNullGraphicsBrush);
      g.SetPen(stylo(g, *wxWHITE, 2, {5, 3}));
      g.StrokePath(p);
      axe(c1, c2);
      etiquette({(c1.x + c2.x) / 2, (c1.y + c2.y) / 2}, wxString::Format(L"%.2f · R%.2f", b.mode == "bouts" ? L : D, b.r));
      break;
    }
    case Dessin::Brouillon::B_TRACE: {  // skTrDrawDraft
      const wxColour jaune(0xff, 0xd6, 0x0a);
      const auto chemin = [&](const std::vector<Pt>& v, bool ferme) {
        wxGraphicsPath p = g.CreatePath();
        for (size_t i = 0; i < v.size(); i++) {
          const auto q = e(v[i].x, v[i].y);
          if (i == 0) p.MoveToPoint(q);
          else p.AddLineToPoint(q);
        }
        if (ferme) p.CloseSubpath();
        return p;
      };
      g.SetPen(stylo(g, wxColour(255, 214, 10, 190), 3));
      for (const std::vector<Pt>& v : b.surlignes) g.StrokePath(chemin(v, false));
      if (b.poly.size() > 1) {
        wxGraphicsPath p = chemin(b.poly, b.ferme);
        if (b.ferme) {
          g.SetBrush(g.CreateBrush(wxBrush(wxColour(255, 255, 255, 15))));
          g.FillPath(p);
          g.SetBrush(wxNullGraphicsBrush);
        }
        g.SetPen(stylo(g, *wxWHITE, 2, {5, 3}));
        g.StrokePath(p);
      }
      g.SetBrush(g.CreateBrush(wxBrush(jaune)));
      for (const Pt& m : b.marques) {
        const auto q = e(m.x, m.y);
        wxGraphicsPath c = g.CreatePath();
        c.AddCircle(q.m_x, q.m_y, 3);
        g.FillPath(c);
      }
      g.SetBrush(wxNullGraphicsBrush);
      if (!b.etiquette.empty() && !b.poly.empty()) {  // au-dessus du tracé, centrée
        double gx = 1e300, dx = -1e300, hy = 1e300;
        for (const Pt& m : b.poly) {
          const auto q = e(m.x, m.y);
          gx = std::min(gx, q.m_x);
          dx = std::max(dx, q.m_x);
          hy = std::min(hy, q.m_y);
        }
        const wxString t = wxString::FromUTF8(b.etiquette);
        double L, H, dsc, ext;
        g.SetFont(g.CreateFont(wxFontInfo(10).Bold(), jaune));
        g.GetTextExtent(t, &L, &H, &dsc, &ext);
        g.DrawText(t, (gx + dx) / 2 - L / 2, hy - 8 - H);
      }
      break;
    }
    case Dessin::Brouillon::B_POLYGONE: {
      const double a = 3.141592653589793 / b.n, R = b.r / std::cos(a);
      wxGraphicsPath p = g.CreatePath();
      for (int i = 0; i < b.n; i++) {
        const double t = b.a1 - a + i * 2 * a;
        const auto q = e(b.cx + R * std::cos(t), b.cy + R * std::sin(t));
        if (i == 0) p.MoveToPoint(q);
        else p.AddLineToPoint(q);
      }
      p.CloseSubpath();
      g.StrokePath(p);
      const wxColour jaune(0xff, 0xd6, 0x0a);
      const auto c = e(b.cx, b.cy);
      const double r = b.r * echelle_;
      g.SetPen(stylo(g, jaune, 1, {3, 3}));
      cercle(g, c.m_x - r, c.m_y - r, 2 * r, 2 * r);
      const wxString texte = wxString::Format(L"%d côtés · ⌀%.2f", b.n, 2 * b.r);
      double L, H, dsc, ext;
      g.SetFont(g.CreateFont(wxFontInfo(10).Bold(), jaune));
      g.GetTextExtent(texte, &L, &H, &dsc, &ext);
      g.DrawText(texte, c.m_x - L / 2, c.m_y - R * echelle_ - 10 - H);
      break;
    }
    case Dessin::Brouillon::B_CERCLE: {
      const auto c = e(b.cx, b.cy);
      const double r = b.r * echelle_;
      cercle(g, c.m_x - r, c.m_y - r, 2 * r, 2 * r);
      break;
    }
    case Dessin::Brouillon::B_ARC: {
      const int n = std::max(8, static_cast<int>(std::abs(b.a2 - b.a1) * 24));
      wxGraphicsPath p = g.CreatePath();
      for (int i = 0; i <= n; i++) {
        const double a = b.a1 + (b.a2 - b.a1) * i / n;
        const auto q = e(b.cx + b.r * std::cos(a), b.cy + b.r * std::sin(a));
        if (i == 0) p.MoveToPoint(q);
        else p.AddLineToPoint(q);
      }
      g.StrokePath(p);
      break;
    }
    default:
      break;
  }
  // Outil Ajuster : le morceau qui partira, en rouge
  const Dessin::ApercuCoupe& coupe = dessin_->apercu();
  if (coupe.sorte != Dessin::ApercuCoupe::RIEN) {
    g.SetPen(stylo(g, wxColour(0xff, 0x45, 0x3a), 3.5));
    if (coupe.sorte == Dessin::ApercuCoupe::TRAIT) {
      ligne(g, e(coupe.A.x, coupe.A.y), e(coupe.B.x, coupe.B.y));
    } else {
      const int n = std::max(8, static_cast<int>(std::abs(coupe.a2 - coupe.a1) * 24));
      wxGraphicsPath p = g.CreatePath();
      for (int i = 0; i <= n; i++) {
        const double a = coupe.a1 + (coupe.a2 - coupe.a1) * i / n;
        const auto q = e(coupe.C.x + coupe.r * std::cos(a), coupe.C.y + coupe.r * std::sin(a));
        if (i == 0) p.MoveToPoint(q);
        else p.AddLineToPoint(q);
      }
      g.StrokePath(p);
    }
  }
  const auto rond = [&](double x, double y) {
    const auto q = e(x, y);
    g.SetPen(stylo(g, VERT, 2));
    cercle(g, q.m_x - 6, q.m_y - 6, 12, 12);
  };
  if (b.accroche) rond(b.accroche.x, b.accroche.y);
  if (dessin_->aMarque()) rond(dessin_->marque().x, dessin_->marque().y);
  // La longueur ou l'angle en cours de frappe, au-dessus du trait
  const Dessin::Saisie& frappe = dessin_->saisieTracee();
  Pt depart;
  if (frappe.actif && dessin_->departTrace(depart)) {
    const bool enLigne = b.sorte == Dessin::Brouillon::B_LIGNE;
    const auto P = e(enLigne ? (b.x1 + b.x2) / 2 : depart.x, enLigne ? (b.y1 + b.y2) / 2 : depart.y);
    const bool decale = dessin_->outil() == Dessin::DECALER;
    const wxString libelle = (decale ? wxString("D = ") : frappe.angle ? wxString(L"∠ = ") : wxString("L = ")) + wxString::FromUTF8(frappe.texte) + (frappe.angle ? wxString(L"°") : wxString(" mm"));
    const wxString aide = decale ? wxString(L"La souris donne le côté · Entrée ou clic : valider · Échap : annuler") : wxString(L"Tab : angle ou longueur · Entrée : valider · Échap : annuler");
    const double larg = std::max(70.0, libelle.length() * 8.0 + 18);
    g.SetBrush(g.CreateBrush(wxBrush(wxColour(0x1e, 0x1e, 0x1e))));
    g.SetPen(stylo(g, wxColour(0x0a, 0x84, 0xff), 1.5));
    g.DrawRoundedRectangle(P.m_x - larg / 2, P.m_y - 44, larg, 24, 5);
    g.SetBrush(wxNullGraphicsBrush);
    double L, H, dsc, ext;
    g.SetFont(g.CreateFont(wxFontInfo(10).Bold(), *wxWHITE));
    g.GetTextExtent(libelle, &L, &H, &dsc, &ext);
    g.DrawText(libelle, P.m_x - L / 2, P.m_y - 32 - H / 2);
    g.SetFont(g.CreateFont(wxFontInfo(8), wxColour(0x8a, 0x8f, 0x99)));
    g.GetTextExtent(aide, &L, &H, &dsc, &ext);
    g.DrawText(aide, P.m_x - L / 2, P.m_y - 50 - H);
  }
  // Le guide du trait : horizontal, vertical, perpendiculaire...
  const Dessin::Guide& G = dessin_->guide();
  if (b.sorte == Dessin::Brouillon::B_LIGNE && G.actif()) {
    wxString t;
    if (G.h) t += "H ";
    if (G.v) t += "V ";
    if (!G.perp.empty()) t += L"⊥ ";
    if (!G.par.empty()) t += L"∥ ";
    if (!G.ext.empty()) t += L"prolongement ";
    if (!G.tan.empty()) t += "T ";
    const auto q = e((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2);
    g.SetFont(g.CreateFont(wxFontInfo(wxSize(0, 13)).Bold().FaceName("Segoe UI"), VERT));
    g.DrawText(t, q.m_x + 8, q.m_y + 6);
  }
}

void VueEsquisse::grille(wxGraphicsContext& g, double W, double H) const {
  double pas = 2000;
  for (double st : {0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1., 2., 5., 10., 20., 50., 100., 200., 500., 1000., 2000.})
    if (st * echelle_ >= 16) {
      pas = st;
      break;
    }
  // Zone visible : une demi-diagonale autour du centre couvre l'écran quelle que soit la rotation
  const double demi = std::hypot(W, H) / 2 / echelle_;
  const double x0 = cx_ - demi, x1 = cx_ + demi, y0 = cy_ - demi, y1 = cy_ + demi;
  const auto kx0 = std::floor(x0 / pas), kx1 = std::ceil(x1 / pas), ky0 = std::floor(y0 / pas), ky1 = std::ceil(y1 / pas);
  if (grille_) {  // masquée par défaut, comme le navigateur : les axes seuls
    g.SetPen(stylo(g, GRILLE, 1));
    if (kx1 - kx0 < 600)
      for (double k = kx0; k <= kx1; k++)
        if (std::abs(k * pas) > 1e-9) ligne(g, e(k * pas, y0), e(k * pas, y1));
    if (ky1 - ky0 < 600)
      for (double k = ky0; k <= ky1; k++)
        if (std::abs(k * pas) > 1e-9) ligne(g, e(x0, k * pas), e(x1, k * pas));
  }
  g.SetPen(stylo(g, AXE, 1.5));
  ligne(g, e(0, y0), e(0, y1));
  ligne(g, e(x0, 0), e(x1, 0));
}

void VueEsquisse::fantome(wxGraphicsContext& g) const {
  if (traitsFantome_.empty() || !voirFantome_) return;
  g.SetPen(stylo(g, wxColour(0xe6, 0xe6, 0xee, 107), 1.15));
  wxGraphicsPath p = g.CreatePath();
  for (const Trait& t : traitsFantome_) {
    const auto a = e(t.x1, t.y1), b = e(t.x2, t.y2);
    p.MoveToPoint(a);
    p.AddLineToPoint(b);
  }
  g.StrokePath(p);
}

// Zones fermées teintées (skDrawRegions, src/70) : un contour ouvert ne se teinte pas.
void VueEsquisse::zones(wxGraphicsContext& g) const {
  if (s_->entites.size() > 600) return;
  Trace T;
  try {
    T = tracerContours(*s_);
  } catch (const std::exception&) {
    return;
  }
  const auto ajouterChaine = [&](wxGraphicsPath& p, const Chaine& ch) {
    bool premier = true;
    for (const Pas& q : ch) {
      const Arete& A = T.aretes[q.arete];
      const bool sens = q.depuis == A.a;
      const std::string& vers = sens ? A.b : A.a;
      const auto itA = T.pts.find(q.depuis), itB = T.pts.find(vers);
      if (itA == T.pts.end() || itB == T.pts.end()) continue;
      if (premier) p.MoveToPoint(e(itA->second.x, itA->second.y));
      premier = false;
      if (A.spline) {
        for (const P2d& k : polyArete(A, q.depuis)) p.AddLineToPoint(e(k[0], k[1]));
      } else if (A.arc && A.e) {
        const Pt* C = s_->point(A.e->pc);
        const auto an = anglesArc(*s_, *A.e);
        if (C && an) {
          // L'arc va de pa vers pb dans le sens direct : dans quel sens le suit-on ici ?
          const Pt* debut = s_->point(A.e->pa);
          const bool endroit = !debut || std::hypot(debut->x - itA->second.x, debut->y - itA->second.y) <= std::hypot(debut->x - itB->second.x, debut->y - itB->second.y);
          const double a1 = endroit ? an->a1 : an->a2, a2 = endroit ? an->a2 : an->a1;
          const int n = std::max(6, static_cast<int>(std::ceil(std::abs(a2 - a1) / 0.1)));
          for (int i = 1; i < n; i++) {
            const double a = a1 + (a2 - a1) * i / n;
            p.AddLineToPoint(e(C->x + A.e->r * std::cos(a), C->y + A.e->r * std::sin(a)));
          }
        }
      }
      p.AddLineToPoint(e(itB->second.x, itB->second.y));
    }
    p.CloseSubpath();
  };
  g.SetBrush(g.CreateBrush(wxBrush(alpha(CYAN, 0.10))));
  g.SetPen(wxNullGraphicsPen);
  for (const ContourPlein& c : T.solides) {
    wxGraphicsPath p = g.CreatePath();
    ajouterChaine(p, c.chaine);
    for (const Chaine& tr : c.trous) ajouterChaine(p, tr);
    g.FillPath(p, wxODDEVEN_RULE);
  }
}

void VueEsquisse::pastilles(wxGraphicsContext& g, const std::vector<std::string>& noms, double x, double y) const {
  for (size_t i = 0; i < noms.size(); i++) {
    const double px = x + i * 17, py = y - 8;
    g.SetBrush(g.CreateBrush(wxBrush(VERT_FOND)));
    g.SetPen(stylo(g, VERT, 1));
    g.DrawRoundedRectangle(px, py, 16, 16, 4);
    g.PushState();
    g.Translate(px + 2, py + 2);
    g.Scale(0.5, 0.5);
    g.SetPen(stylo(g, VERT, 2.4));
    g.SetBrush(wxNullGraphicsBrush);
    icone(g, noms[i]);
    g.PopState();
  }
}

void VueEsquisse::entites(wxGraphicsContext& g) const {
  const Esquisse& s = *s_;
  // Bleu : encore libre. Blanc : entièrement déterminé (analyse de rang).
  const auto choisi = [&](const Entite& en) { return dessin_ && dessin_->estChoisi(Dessin::Choix::ENTITE, en.id); };
  const auto couleur = [&](const Entite& en) { return choisi(en) ? ORANGE_AXE : (!infos_.calculees || infos_.determinee(en)) ? TRAIT : CYAN; };
  const auto regler = [&](const Entite& en) {
    const double l = choisi(en) ? 3.5 : 2;
    if (en.construction) g.SetPen(stylo(g, alpha(couleur(en), 0.45), l, {7, 5}));
    else g.SetPen(stylo(g, couleur(en), l));
  };
  g.SetBrush(wxNullGraphicsBrush);
  const auto sigleT = [&](double x, double y) {
    const auto q = e(x, y);
    g.SetFont(g.CreateFont(GetFont().Bold().Scaled(1.0f), VERT));
    double L, H, dsc, ext;
    g.GetTextExtent("T", &L, &H, &dsc, &ext);
    g.DrawText("T", q.m_x + 6, q.m_y - 6 - (H - dsc));
  };
  for (const Entite& en : s.entites) {
    if (en.t == "line") {
      const Pt* A = s.point(en.p1);
      const Pt* B = s.point(en.p2);
      if (!A || !B) continue;
      auto a = e(A->x, A->y), b = e(B->x, B->y);
      if (en.axe) {
        const auto d = b - a;
        const double L = std::max(1e-9, std::hypot(d.m_x, d.m_y));
        const wxPoint2DDouble ext(d.m_x / L * 30, d.m_y / L * 30);
        g.SetPen(stylo(g, alpha(ORANGE_AXE, 0.95), 1.6, {16, 4, 3, 4}));
        ligne(g, a - ext, b + ext);
      } else if (en.poignee) {
        const Entite* S = s.entite(en.handle);
        const auto kk = S ? std::find(S->pts.begin(), S->pts.end(), en.p1) : std::vector<std::string>::const_iterator();
        const bool interieur = S && (S->closed || (kk != S->pts.end() && kk != S->pts.begin() && kk + 1 != S->pts.end()));  // symétrique à un point intérieur
        g.SetPen(stylo(g, choisi(en) ? ORANGE_AXE : alpha(VIOLET, 0.9), choisi(en) ? 2.4 : 1.3, {4, 3}));
        ligne(g, interieur ? wxPoint2DDouble(2 * a.m_x - b.m_x, 2 * a.m_y - b.m_y) : a, b);
        for (const Contrainte& k : s.contraintes)
          if (k.type == "stangent" && k.p == en.p1 && (k.s == en.handle || k.ent == en.handle)) {
            sigleT(A->x, A->y);
            break;
          }
      } else {
        regler(en);
        ligne(g, a, b);
      }
      std::vector<std::string> noms;
      const auto ajoute = [&](const std::string& n) {
        if (std::find(noms.begin(), noms.end(), n) == noms.end()) noms.push_back(n);
      };
      bool egal = false;
      for (const Contrainte& k : s.contraintes) {
        if ((k.type == "h" || k.type == "v") && k.line == en.id) ajoute(k.type);
        else if ((k.type == "parallel" || k.type == "perpendicular" || k.type == "collinear") && (k.a == en.id || k.b == en.id)) ajoute(k.type);
        else if (k.type == "symmetric" && (k.a == en.id || k.b == en.id || k.mid == en.id)) ajoute("symmetric");
        else if (k.type == "midpoint" && (k.line == en.id || k.a == en.id || k.b == en.id)) ajoute("midpoint");
        else if (k.type == "fix" && k.ent == en.id) ajoute("fix");
        if (k.type == "equal" && (k.a == en.id || k.b == en.id)) egal = true;
      }
      if (egal) ajoute("equal");
      if (!noms.empty()) {
        const auto m = e((A->x + B->x) / 2, (A->y + B->y) / 2);
        pastilles(g, noms, m.m_x + 8, m.m_y - 10);
        g.SetBrush(wxNullGraphicsBrush);
      }
      // Sigle T au point de contact (l'autre sigle est sur le cercle ou l'arc)
      const double dx = B->x - A->x, dy = B->y - A->y, l2 = dx * dx + dy * dy;
      for (const Contrainte& k : s.contraintes) {
        if (k.type != "tangent" || k.line != en.id || l2 < 1e-12) continue;
        const Entite* E = s.entite(k.ent);
        const Pt* C = E ? s.point(E->pc) : nullptr;
        if (!C) continue;
        const double t = std::max(0.0, std::min(1.0, ((C->x - A->x) * dx + (C->y - A->y) * dy) / l2));
        sigleT(A->x + t * dx, A->y + t * dy);
      }
    } else if (en.t == "spline") {
      BSpline f;
      if (!splineDe(s, en, f)) continue;
      const auto chemin = [&](const std::vector<P2d>& v) {
        if (v.size() < 2) return;
        wxGraphicsPath p = g.CreatePath();
        p.MoveToPoint(e(v[0][0], v[0][1]));
        for (size_t i = 1; i < v.size(); i++) p.AddLineToPoint(e(v[i][0], v[i][1]));
        g.StrokePath(p);
      };
      if (en.mode == "ctrl") {  // polygone de contrôle : pôles reliés en pointillé
        std::vector<P2d> Q;
        for (const std::string& id : en.pts)
          if (const Pt* q = s.point(id)) Q.push_back({q->x, q->y});
        if (en.closed && !Q.empty()) Q.push_back(Q[0]);
        g.SetPen(stylo(g, choisi(en) ? ORANGE_AXE : alpha(VIOLET, 0.75), 1.1, {3, 3}));
        chemin(Q);
        for (const Contrainte& k : s.contraintes)
          if (k.type == "stangent" && (k.s == en.id || k.ent == en.id))
            if (const Pt* q = s.point(k.p)) sigleT(q->x, q->y);
      }
      if (dessin_ && dessin_->peigneVisible(en.id)) {  // skSplineComb : peigne de courbure
        struct Dent {
          double x, y, k, nx, ny;
        };
        std::vector<Dent> D;
        double x0 = 1e308, x1 = -1e308, y0 = 1e308, y1 = -1e308, km = 0;
        for (int i = 0; i <= 120; i++) {
          const auto d = bsEval(f, f.a + (f.b - f.a) * i / 120, 2);
          const double L = hyp(d[1][0], d[1][1]);
          if (!(L > 1e-12)) continue;
          const double k = (d[1][0] * d[2][1] - d[1][1] * d[2][0]) / (L * L * L);
          D.push_back({d[0][0], d[0][1], k, -d[1][1] / L, d[1][0] / L});
          km = std::max(km, std::abs(k));
          x0 = std::min(x0, d[0][0]);
          x1 = std::max(x1, d[0][0]);
          y0 = std::min(y0, d[0][1]);
          y1 = std::max(y1, d[0][1]);
        }
        const double sc = km > 1e-12 ? 0.2 * std::max(hyp(x1 - x0, y1 - y0), 1e-6) / km : 0;
        std::vector<P2d> bord;
        const wxColour peigne(255, 159, 10);
        g.SetPen(stylo(g, alpha(peigne, 0.7), 0.8));
        for (size_t i = 0; i < D.size(); i++) {
          const double qx = D[i].x - D[i].nx * D[i].k * sc, qy = D[i].y - D[i].ny * D[i].k * sc;
          if (i % 2 == 0) ligne(g, e(D[i].x, D[i].y), e(qx, qy));
          bord.push_back({qx, qy});
        }
        g.SetPen(stylo(g, alpha(peigne, 0.85), 1.2));
        chemin(bord);
      }
      for (const Contrainte& k : s.contraintes)
        if (k.type == "scurv" && k.s == en.id)
          if (const Pt* q = s.point(k.p)) {
            const auto m = e(q->x, q->y);
            g.SetFont(g.CreateFont(GetFont().Bold(), VERT));
            g.DrawText("G2", m.m_x + 6, m.m_y + 4);
          }
      regler(en);
      chemin(bsSample(f, f.a, f.b, 16));
    } else if (en.t == "circle" || en.t == "arc") {
      const Pt* C = s.point(en.pc);
      if (!C) continue;
      const auto c = e(C->x, C->y);
      const double r = std::abs(en.r) * echelle_;
      if (en.t == "circle") {
        if (!en.construction) {
          g.SetBrush(g.CreateBrush(wxBrush(alpha(CYAN, 0.07))));
          g.SetPen(wxNullGraphicsPen);
          g.DrawEllipse(c.m_x - r, c.m_y - r, 2 * r, 2 * r);
          g.SetBrush(wxNullGraphicsBrush);
        }
        regler(en);
        cercle(g, c.m_x - r, c.m_y - r, 2 * r, 2 * r);
      } else {
        const auto an = anglesArc(s, en);
        if (!an) continue;
        regler(en);
        const int n = std::max(6, static_cast<int>(std::ceil((an->a2 - an->a1) * std::max(4.0, std::sqrt(r)))));
        wxGraphicsPath p = g.CreatePath();
        for (int i = 0; i <= n; i++) {
          const double a = an->a1 + (an->a2 - an->a1) * i / n;
          const auto q = e(C->x + en.r * std::cos(a), C->y + en.r * std::sin(a));
          if (i == 0) p.MoveToPoint(q);
          else p.AddLineToPoint(q);
        }
        g.StrokePath(p);
      }
      // Petit carré du centre, plein si le centre d'un cercle est fixe
      g.SetPen(stylo(g, couleur(en), 1));
      if (en.t == "circle" && infos_.fixes.count(en.pc)) g.SetBrush(g.CreateBrush(wxBrush(TRAIT)));
      g.DrawRectangle(c.m_x - 3, c.m_y - 3, 6, 6);
      g.SetBrush(wxNullGraphicsBrush);
      // Sigle T au point de contact avec chaque ligne tangente
      std::vector<std::string> noms;
      const auto ajoute = [&](const std::string& n) {
        if (std::find(noms.begin(), noms.end(), n) == noms.end()) noms.push_back(n);
      };
      for (const Contrainte& k : s.contraintes) {
        if (k.type == "tangent" && k.ent == en.id) {
          const Entite* L = s.entite(k.line);
          const Pt* A2 = L ? s.point(L->p1) : nullptr;
          const Pt* B2 = L ? s.point(L->p2) : nullptr;
          if (!A2 || !B2) continue;
          const double ex = B2->x - A2->x, ey = B2->y - A2->y, el2 = ex * ex + ey * ey;
          if (el2 < 1e-12) continue;
          const double t = ((C->x - A2->x) * ex + (C->y - A2->y) * ey) / el2;
          const double fx = A2->x + t * ex, fy = A2->y + t * ey;
          const double fd = std::max(1e-9, std::hypot(fx - C->x, fy - C->y));
          sigleT(C->x + (fx - C->x) / fd * en.r, C->y + (fy - C->y) / fd * en.r);
        } else if (k.type == "coaxial" && (k.a == en.id || k.b == en.id)) {
          ajoute("coaxial");
        } else if (k.type == "equal" && (k.a == en.id || k.b == en.id)) {
          ajoute("equal");
        } else if (k.type == "fix" && k.ent == en.id) {
          ajoute("fix");
        }
      }
      if (!noms.empty()) {
        pastilles(g, noms, c.m_x + 8, c.m_y - 10);
        g.SetBrush(wxNullGraphicsBrush);
      }
    } else if (en.t == "cpoint") {
      const Pt* Q = s.point(en.p);
      if (!Q) continue;
      const auto q = e(Q->x, Q->y);
      if (en.percage) {
        g.SetPen(stylo(g, ORANGE, 1.8));
        cercle(g, q.m_x - 7, q.m_y - 7, 14, 14);
        g.SetPen(stylo(g, ORANGE, 1.2));
        g.StrokeLine(q.m_x - 11, q.m_y, q.m_x + 11, q.m_y);
        g.StrokeLine(q.m_x, q.m_y - 11, q.m_x, q.m_y + 11);
      } else {
        g.SetPen(stylo(g, couleur(en), choisi(en) ? 3.5 : 2));
        g.StrokeLine(q.m_x - 6, q.m_y, q.m_x + 6, q.m_y);
        g.StrokeLine(q.m_x, q.m_y - 6, q.m_x, q.m_y + 6);
      }
    }
  }
}

void VueEsquisse::points(wxGraphicsContext& g) const {
  const Esquisse& s = *s_;
  // skFixed (src/50-esquisse-2) : points fixés, entités fixées, projections, origine
  std::set<std::string> fixes{"O"}, percages, poignees;
  for (const Contrainte& c : s.contraintes) {
    if (c.type != "fix") continue;
    if (!c.p.empty()) fixes.insert(c.p);
    if (const Entite* en = c.ent.empty() ? nullptr : s.entite(c.ent)) {
      if (en->t == "circle" || en->t == "arc") fixes.insert(en->pc);
      if (en->t == "cpoint") fixes.insert(en->p);
      if (en->t == "spline") {  // points de passage et poignées
        for (const std::string& q : en->pts) fixes.insert(q);
        for (const Entite& l : s.entites)
          if (l.handle == en->id) fixes.insert(l.p2);
      }
    }
  }
  std::map<std::string, int> usages;
  for (const Entite& en : s.entites) {
    if (en.proj)
      for (const std::string* q : {&en.p1, &en.p2, &en.pc, &en.pa, &en.pb, &en.p})
        if (!q->empty()) fixes.insert(*q);
    if (en.t == "cpoint" && en.percage) percages.insert(en.p);
    if (en.t == "line" && en.poignee) poignees.insert(en.p2);
    if (en.poignee) continue;
    for (const std::string* q : {&en.p1, &en.p2, &en.pc, &en.pa, &en.pb, &en.p})
      if (!q->empty()) usages[*q]++;
    for (const std::string& q : en.pts) usages[q]++;
  }
  for (const std::string& id : s.ordre) {
    const Pt* p = s.point(id);
    if (!p) continue;
    const auto q = e(p->x, p->y);
    const double a = q.m_x, b = q.m_y;
    const int nb = usages.count(id) ? usages[id] : 0;
    if (id == "O") {
      g.SetBrush(g.CreateBrush(wxBrush(TRAIT)));
      g.SetPen(stylo(g, GRIS, 1.5));
      g.DrawEllipse(a - 5, b - 5, 10, 10);
      g.SetBrush(wxNullGraphicsBrush);
      g.SetPen(stylo(g, alpha(nb >= 2 ? VERT : GRIS, 0.95), 1.4));
      cercle(g, a - 9, b - 9, 18, 18);
      continue;
    }
    const bool fixe = fixes.count(id) > 0;
    if (poignees.count(id)) {  // bout de poignée : petit losange
      const bool pris = dessin_ && dessin_->estChoisi(Dessin::Choix::POINT, id);
      wxGraphicsPath l = g.CreatePath();
      l.MoveToPoint(a, b - 5);
      l.AddLineToPoint(a + 5, b);
      l.AddLineToPoint(a, b + 5);
      l.AddLineToPoint(a - 5, b);
      l.CloseSubpath();
      g.SetBrush(g.CreateBrush(wxBrush(fixe ? TRAIT : pris ? ORANGE_AXE : FOND)));
      g.SetPen(stylo(g, pris ? ORANGE_AXE : VIOLET, 1.5));
      g.FillPath(l);
      g.StrokePath(l);
      g.SetBrush(wxNullGraphicsBrush);
      continue;
    }
    if (percages.count(id)) {
      g.SetBrush(g.CreateBrush(wxBrush(fixe ? ORANGE : FOND)));
      g.SetPen(stylo(g, ORANGE, 1.8));
      g.DrawEllipse(a - 4.5, b - 4.5, 9, 9);
    } else {
      const bool choisi = dessin_ && dessin_->estChoisi(Dessin::Choix::POINT, id);
      g.SetBrush(g.CreateBrush(wxBrush(fixe ? TRAIT : choisi ? ORANGE_AXE : FOND)));
      g.SetPen(stylo(g, choisi ? ORANGE_AXE : (!infos_.calculees || infos_.pointDetermine(id)) ? TRAIT : CYAN, 1.5));
      g.DrawRectangle(a - 4, b - 4, 8, 8);
    }
    g.SetBrush(wxNullGraphicsBrush);
    if (nb >= 2) {
      g.SetPen(stylo(g, alpha(VERT, 0.9), 1.2));
      cercle(g, a - 6, b - 6, 12, 12);
    }
    // Flèche : ce point peut encore bouger, tant que l'esquisse n'est pas entièrement contrainte
    if (infos_.calculees && infos_.libertes > 0 && !fixe) {
      g.SetPen(stylo(g, alpha(VERT, 0.85), 1.4));
      g.StrokeLine(a + 7, b - 7, a + 14, b - 7);
      g.StrokeLine(a + 10.5, b - 10.5, a + 14, b - 7);
      g.StrokeLine(a + 10.5, b - 3.5, a + 14, b - 7);
    }
  }
}

// Santé : bouts ouverts en rouge avec leur écart, croisements en losanges orange
void VueEsquisse::sante(wxGraphicsContext& g) const {
  const SanteEsquisse& H = infos_.sante;
  const wxColour ROUGE(0xff, 0x45, 0x3a);
  g.SetBrush(wxNullGraphicsBrush);
  g.SetPen(stylo(g, ROUGE, 2.5));
  for (const Pt& o : H.ouverts) {
    const auto q = e(o.x, o.y);
    cercle(g, q.m_x - 7, q.m_y - 7, 14, 14);
  }
  if (H.aEcart && H.ecart < 25) {
    const auto a = e(H.ecartA.x, H.ecartA.y), b = e(H.ecartB.x, H.ecartB.y);
    g.SetPen(stylo(g, ROUGE, 1.5, {4, 3}));
    ligne(g, a, b);
    g.SetFont(g.CreateFont(wxFontInfo(wxSize(0, 12)).Bold().FaceName("Segoe UI"), ROUGE));
    double L, H2, dsc, ext;
    const wxString t = wxString::Format(L"⚠ %.1f", H.ecart);
    g.GetTextExtent(t, &L, &H2, &dsc, &ext);
    g.DrawText(t, (a.m_x + b.m_x) / 2, (a.m_y + b.m_y) / 2 - 8 - (H2 - dsc));
  }
  g.SetPen(stylo(g, ORANGE_AXE, 2));
  for (const Pt& o : H.croisements) {
    const auto q = e(o.x, o.y);
    wxGraphicsPath p = g.CreatePath();
    p.MoveToPoint(q.m_x, q.m_y - 7);
    p.AddLineToPoint(q.m_x + 7, q.m_y);
    p.AddLineToPoint(q.m_x, q.m_y + 7);
    p.AddLineToPoint(q.m_x - 7, q.m_y);
    p.CloseSubpath();
    g.StrokePath(p);
  }
}

namespace {
// skConTargets : tous les champs qui peuvent nommer un point ou un élément
std::vector<std::string> refsContrainte(const Contrainte& k) { return {k.p, k.a, k.b, k.c, k.d, k.line, k.ent, k.mid}; }
std::vector<std::string> refsCote(const Cote& k) { return {k.p, k.a, k.b, k.line, k.ent}; }
}  // namespace

// skDrawConHalo : ce que vise la contrainte ou la cote choisie dans le panneau
void VueEsquisse::halo(wxGraphicsContext& g) const {
  if (!dessin_ || !s_) return;
  const wxColour J(0xff, 0xd6, 0x0a);
  std::set<std::string> pts, ents;
  const auto viser = [&](const std::string& v) {
    if (v.empty()) return;
    if (s_->point(v)) pts.insert(v);
    else if (s_->entite(v)) ents.insert(v);
  };
  for (const Dessin::Choix& c : dessin_->selection()) {
    if (c.sorte == Dessin::Choix::CONTRAINTE) {
      for (const Contrainte& k : s_->contraintes)
        if (k.id == c.id) for (const std::string& v : refsContrainte(k)) viser(v);
    } else if (c.sorte == Dessin::Choix::COTE) {
      for (const Cote& k : s_->cotes)
        if (k.id == c.id) for (const std::string& v : refsCote(k)) viser(v);
    }
  }
  if (pts.empty() && ents.empty()) return;
  g.SetBrush(wxNullGraphicsBrush);
  g.SetPen(g.CreatePen(wxGraphicsPenInfo(alpha(J, 0.45), 8).Cap(wxCAP_ROUND)));
  for (const std::string& id : ents) {
    const Entite& en = *s_->entite(id);
    if (en.t == "line") {
      const Pt* A = s_->point(en.p1);
      const Pt* B = s_->point(en.p2);
      if (A && B) ligne(g, e(A->x, A->y), e(B->x, B->y));
    } else if (en.t == "circle") {
      if (const Pt* C = s_->point(en.pc)) {
        const auto q = e(C->x, C->y);
        const double r = std::abs(en.r) * echelle_;
        cercle(g, q.m_x - r, q.m_y - r, 2 * r, 2 * r);
      }
    } else if (en.t == "arc") {
      const Pt* C = s_->point(en.pc);
      const auto an = anglesArc(*s_, en);
      if (C && an) {
        // Même découpage que les arcs de la vue : petits segments le long de l'arc
        wxGraphicsPath p = g.CreatePath();
        const int n = std::max(8, static_cast<int>((an->a2 - an->a1) * 24));
        for (int i = 0; i <= n; i++) {
          const double a = an->a1 + (an->a2 - an->a1) * i / n;
          const auto q = e(C->x + en.r * std::cos(a), C->y + en.r * std::sin(a));
          if (i == 0) p.MoveToPoint(q);
          else p.AddLineToPoint(q);
        }
        g.StrokePath(p);
      }
    } else if (en.t == "cpoint") {
      pts.insert(en.p);
    } else if (en.t == "spline") {
      BSpline f;
      if (splineDe(*s_, en, f)) {
        const std::vector<P2d> pl = bsSample(f, f.a, f.b, 16);
        wxGraphicsPath p = g.CreatePath();
        p.MoveToPoint(e(pl[0][0], pl[0][1]));
        for (size_t i = 1; i < pl.size(); i++) p.AddLineToPoint(e(pl[i][0], pl[i][1]));
        g.StrokePath(p);
      }
    }
  }
  g.SetBrush(g.CreateBrush(wxBrush(alpha(J, 0.18))));
  g.SetPen(stylo(g, J, 2.5));
  for (const std::string& id : pts) {
    if (const Pt* p = s_->point(id)) {
      const auto q = e(p->x, p->y);
      cercle(g, q.m_x - 11, q.m_y - 11, 22, 22);
    }
  }
  g.SetBrush(wxNullGraphicsBrush);
}

void VueEsquisse::cotes(wxGraphicsContext& g) const {
  zonesCotes_.clear();
  zonesLignes_.clear();
  g.SetBrush(wxNullGraphicsBrush);
  for (const Cote& d : s_->cotes) {
    if (d.type == "length" || d.type == "distance" || d.type == "gap" || d.type == "distline") coteLineaire(g, d);
    else if (d.type == "diameter" || d.type == "radius") coteRayon(g, d);
    else if (d.type == "angle") coteAngle(g, d);
  }
}

// Prolongement d'une ligne cotée jusqu'à sa cote, si celle-ci la dépasse (skDimExt)
void VueEsquisse::prolonge(wxGraphicsContext& g, const std::string& idLigne, double x, double y, const wxColour& c) const {
  const Entite* L = s_->entite(idLigne);
  if (!L || L->t != "line") return;
  const Pt* A = s_->point(L->p1);
  const Pt* B = s_->point(L->p2);
  if (!A || !B) return;
  const double dx = B->x - A->x, dy = B->y - A->y, L2 = dx * dx + dy * dy;
  if (L2 < 1e-12) return;
  const double t = ((x - A->x) * dx + (y - A->y) * dy) / L2;
  if (t >= -1e-6 && t <= 1 + 1e-6) return;
  const Pt* E = t < 0 ? A : B;
  const double len = std::sqrt(L2), sg = t < 0 ? -1 : 1, ov = 8 / echelle_;
  g.SetPen(stylo(g, alpha(c, 0.85), 1));
  ligne(g, e(E->x, E->y), e(A->x + dx * t + dx / len * sg * ov, A->y + dy * t + dy / len * sg * ov));
}

void VueEsquisse::coteLineaire(wxGraphicsContext& g, const Cote& d) const {
  Seg S;
  if (!segment(*s_, d, S)) return;
  zonesLignes_.push_back({d.id, false, {e(S.a.x, S.a.y), e(S.b.x, S.b.y)}});
  const wxColour c = dessin_ && dessin_->estChoisi(Dessin::Choix::COTE, d.id) ? ORANGE_AXE : d.ref ? GRIS : VERT;
  const double over = 10 / echelle_;
  const auto a = e(S.a.x, S.a.y), b = e(S.b.x, S.b.y);
  if (d.type == "length" || d.type == "distance") {
    const double off = S.w, sg = off >= 0 ? 1 : -1;
    P2 Aex, Bex;
    if (S.hv == 'h') {
      Aex = {S.A.x, S.cy + over * (S.cy >= S.A.y ? 1 : -1)};
      Bex = {S.B.x, S.cy + over * (S.cy >= S.B.y ? 1 : -1)};
    } else if (S.hv == 'v') {
      Aex = {S.cx + over * (S.cx >= S.A.x ? 1 : -1), S.A.y};
      Bex = {S.cx + over * (S.cx >= S.B.x ? 1 : -1), S.B.y};
    } else {
      Aex = {S.A.x + S.nx * (off + over * sg), S.A.y + S.ny * (off + over * sg)};
      Bex = {S.B.x + S.nx * (off + over * sg), S.B.y + S.ny * (off + over * sg)};
    }
    g.SetPen(stylo(g, alpha(c, 0.85), 1));
    ligne(g, e(S.A.x, S.A.y), e(Aex.x, Aex.y));
    ligne(g, e(S.B.x, S.B.y), e(Bex.x, Bex.y));
    g.SetPen(stylo(g, c, 1.4));
    ligne(g, a, b);
    fleche(g, a.m_x, a.m_y, a.m_x - b.m_x, a.m_y - b.m_y, c);
    fleche(g, b.m_x, b.m_y, b.m_x - a.m_x, b.m_y - a.m_y, c);
  } else {
    const double dl = std::max(1e-9, dist(S.a, S.b));
    const double ux = (S.b.x - S.a.x) / dl, uy = (S.b.y - S.a.y) / dl;
    if (d.type == "distline" && std::abs(S.w) > 0.5) {
      const double sg = S.w >= 0 ? 1 : -1;
      g.SetPen(stylo(g, alpha(c, 0.85), 1));
      ligne(g, e(S.A.x, S.A.y), e(S.A.x + S.nx * (S.w + over * sg), S.A.y + S.ny * (S.w + over * sg)));
      ligne(g, e(S.B.x, S.B.y), e(S.B.x + S.nx * (S.w + over * sg), S.B.y + S.ny * (S.w + over * sg)));
    }
    g.SetPen(stylo(g, c, 1.4));
    ligne(g, e(S.a.x - ux * over, S.a.y - uy * over), e(S.b.x + ux * over, S.b.y + uy * over));
    fleche(g, a.m_x, a.m_y, a.m_x - b.m_x, a.m_y - b.m_y, c, 8);
    fleche(g, b.m_x, b.m_y, b.m_x - a.m_x, b.m_y - a.m_y, c, 8);
    if (d.type == "gap") {
      prolonge(g, d.a, S.a.x, S.a.y, c);
      prolonge(g, d.b, S.b.x, S.b.y, c);
    } else {
      prolonge(g, d.line, S.b.x, S.b.y, c);
    }
  }
  // Valeur posée sur la ligne de cote, alignée, fond opaque (dimTextOnLine) ; glissée de d.sl sauf pour l'entraxe
  P2 T{(S.a.x + S.b.x) / 2, (S.a.y + S.b.y) / 2};
  if (d.type != "gap" && d.sl != 0) {
    const double L = std::max(1e-9, dist(S.a, S.b));
    T.x += (S.b.x - S.a.x) / L * d.sl;
    T.y += (S.b.y - S.a.y) / L * d.sl;
  }
  const auto q = e(T.x, T.y);
  double ang = std::atan2(b.m_y - a.m_y, b.m_x - a.m_x);
  if (ang > PI / 2 + 1e-4) ang -= PI;
  else if (ang < -PI / 2 - 1e-4) ang += PI;
  const wxString texte = texteValeur(d.dia ? 2 * d.value : d.value, d.ref);
  const wxString affiche = habille(d, d.dia ? L"Ø" + texte : texte);
  const double wpx = affiche.length() * 7.8 + 10;
  noterZone(d, q.m_x, q.m_y, wpx / 2, 11, ang);
  g.PushState();
  g.Translate(q.m_x, q.m_y);
  g.Rotate(ang);
  g.SetBrush(g.CreateBrush(wxBrush(FOND)));
  g.SetPen(wxNullGraphicsPen);
  g.DrawRoundedRectangle(-wpx / 2, -11, wpx, 21, 2);
  g.SetFont(g.CreateFont(wxFontInfo(wxSize(0, 13)).Bold().FaceName("Segoe UI"), c));
  texteCentre(g, affiche, 0, 0);
  g.PopState();
  g.SetBrush(wxNullGraphicsBrush);
}

// Rayon et diamètre : rdLayout et rdDraw (src/50-esquisse-4)
void VueEsquisse::coteRayon(wxGraphicsContext& g, const Cote& d) const {
  const Entite* en = s_->entite(d.ent);
  if (!en || !(en->r > 0)) return;
  const Pt* C = s_->point(en->pc);
  if (!C) return;
  P2 u{std::sqrt(0.5), std::sqrt(0.5)};
  if (en->t == "arc") {
    const auto an = anglesArc(*s_, *en);
    const double am = an ? (an->a1 + an->a2) / 2 : PI / 4;
    u = {std::cos(am), std::sin(am)};
  }
  const double ecart = (d.ox != 0 || d.oy != 0) ? 0 : 26 / echelle_;
  P2 K{C->x + u.x * (en->r + ecart) + d.ox, C->y + u.y * (en->r + ecart) + d.oy};
  double vx = K.x - C->x, vy = K.y - C->y, vl = std::hypot(vx, vy);
  if (vl < 1e-9) {
    vx = u.x;
    vy = u.y;
    vl = 1;
  }
  u = {vx / vl, vy / vl};
  const double minR = en->r + 10 / echelle_;
  if (vl < minR) K = {C->x + u.x * minR, C->y + u.y * minR};
  const auto ue = direction(u.x, u.y);
  const int cote = ue.m_x >= 0 ? 1 : -1;
  const auto P = e(C->x + u.x * en->r, C->y + u.y * en->r), Q = e(C->x - u.x * en->r, C->y - u.y * en->r), k = e(K.x, K.y);
  const wxColour c = dessin_ && dessin_->estChoisi(Dessin::Choix::COTE, d.id) ? ORANGE_AXE : d.ref ? GRIS : VERT;
  wxString t = (d.type == "diameter" ? wxString(L"Ø") : wxString("R")) + wxString::FromCDouble(d.value, 2);
  if (d.ref) t = "(" + t + ")";
  t = habille(d, t);
  const double tw = t.length() * 7.6 + 2;
  g.SetPen(stylo(g, c, 1.2));
  if (d.type == "diameter") {
    ligne(g, Q, k);
    fleche(g, P.m_x, P.m_y, ue.m_x, ue.m_y, c);
    fleche(g, Q.m_x, Q.m_y, -ue.m_x, -ue.m_y, c);
  } else {
    ligne(g, P, k);
    fleche(g, P.m_x, P.m_y, -ue.m_x, -ue.m_y, c);
  }
  g.SetPen(stylo(g, c, 1.2));
  g.StrokeLine(k.m_x, k.m_y, k.m_x + cote * (tw + 10), k.m_y);
  // Texte au-dessus du trait, avec son halo sombre
  double L, H, dsc, ext;
  g.SetFont(g.CreateFont(wxFontInfo(wxSize(0, 13)).Bold().FaceName("Segoe UI"), FOND));
  g.GetTextExtent(t, &L, &H, &dsc, &ext);
  const double x = cote > 0 ? k.m_x + 5 : k.m_x - 5 - L, y = k.m_y - 4 - H;
  noterZone(d, x + L / 2, y + H / 2, L / 2 + 3, H / 2 + 3, 0);
  for (int dx = -1; dx <= 1; dx++)
    for (int dy = -1; dy <= 1; dy++)
      if (dx || dy) g.DrawText(t, x + dx, y + dy);
  g.SetFont(g.CreateFont(wxFontInfo(wxSize(0, 13)).Bold().FaceName("Segoe UI"), c));
  g.DrawText(t, x, y);
  g.SetBrush(wxNullGraphicsBrush);
}

// Angle : angleFrame et angleArcInfo (src/50-esquisse-5 et 4)
void VueEsquisse::coteAngle(wxGraphicsContext& g, const Cote& d) const {
  P2 V;
  if (!sommetAngle(*s_, d, V)) return;
  const Entite* A = s_->entite(d.a);
  const Entite* B = s_->entite(d.b);
  const Pt* A1 = s_->point(A->p1);
  const Pt* A2 = s_->point(A->p2);
  const Pt* B1 = s_->point(B->p1);
  const Pt* B2 = s_->point(B->p2);
  if (!A1 || !A2 || !B1 || !B2) return;
  const Pt* fA = std::hypot(A1->x - V.x, A1->y - V.y) > std::hypot(A2->x - V.x, A2->y - V.y) ? A1 : A2;
  const Pt* fB = std::hypot(B1->x - V.x, B1->y - V.y) > std::hypot(B2->x - V.x, B2->y - V.y) ? B1 : B2;
  const double sA = std::atan2(fA->y - V.y, fA->x - V.x), sB = std::atan2(fB->y - V.y, fB->x - V.x);
  double delta = std::fmod(sB - sA, TAU);
  if (delta <= -PI) delta += TAU;
  else if (delta > PI) delta -= TAU;
  const double rr = d.aW ? std::abs(d.w) : 14 / echelle_;
  const int ccw = (d.ccw == 0 || d.ccw == 1) ? d.ccw : (delta >= 0 ? 1 : 0);
  const double dd = (ccw ? 1 : -1) * std::max(0.02, std::min(PI - 0.02, d.value));
  {
    ZoneLigne z{d.id, true, {}};
    for (int i = 0; i <= 16; i++) z.pts.push_back(e(V.x + rr * std::cos(sA + dd * i / 16), V.y + rr * std::sin(sA + dd * i / 16)));
    zonesLignes_.push_back(std::move(z));
  }
  const wxColour c = dessin_ && dessin_->estChoisi(Dessin::Choix::COTE, d.id) ? ORANGE_AXE : d.ref ? GRIS : VERT;
  g.SetPen(stylo(g, c, 1.5));
  const int n = std::max(8, static_cast<int>(std::abs(dd) * std::max(8.0, std::sqrt(rr * echelle_))));
  wxGraphicsPath p = g.CreatePath();
  for (int i = 0; i <= n; i++) {
    const double a = sA + dd * i / n;
    const auto q = e(V.x + rr * std::cos(a), V.y + rr * std::sin(a));
    if (i == 0) p.MoveToPoint(q);
    else p.AddLineToPoint(q);
  }
  g.StrokePath(p);
  const auto q1 = e(V.x + rr * std::cos(sA), V.y + rr * std::sin(sA)), q2 = e(V.x + rr * std::cos(sA + dd), V.y + rr * std::sin(sA + dd));
  const double sg = dd >= 0 ? 1 : -1;
  const auto t1 = direction(std::sin(sA) * sg, -std::cos(sA) * sg), t2 = direction(-std::sin(sA + dd) * sg, std::cos(sA + dd) * sg);
  fleche(g, q1.m_x, q1.m_y, t1.m_x, t1.m_y, c, 8);
  fleche(g, q2.m_x, q2.m_y, t2.m_x, t2.m_y, c, 8);
  const double am = sA + dd / 2;
  const auto w = e(V.x + rr * std::cos(am) + d.ox, V.y + rr * std::sin(am) + d.oy);
  wxString t = L"∠" + wxString::FromCDouble(d.value * 180 / PI, 1) + L"°";
  if (d.ref) t = "(" + t + ")";
  t = habille(d, t);
  double L, H, dsc, ext;
  g.SetFont(g.CreateFont(wxFontInfo(wxSize(0, 13)).Bold().FaceName("Segoe UI"), FOND));
  g.GetTextExtent(t, &L, &H, &dsc, &ext);
  const double x = w.m_x, y = w.m_y - 8 - (H - dsc);  // ligne de base à 8 px au-dessus, comme le SVG
  noterZone(d, x + L / 2, y + H / 2, L / 2 + 3, H / 2 + 3, 0);
  for (int dx = -1; dx <= 1; dx++)
    for (int dy = -1; dy <= 1; dy++)
      if (dx || dy) g.DrawText(t, x + dx, y + dy);
  g.SetFont(g.CreateFont(wxFontInfo(wxSize(0, 13)).Bold().FaceName("Segoe UI"), c));
  g.DrawText(t, x, y);
  g.SetBrush(wxNullGraphicsBrush);
  prolonge(g, d.a, V.x + rr * std::cos(sA), V.y + rr * std::sin(sA), c);
  prolonge(g, d.b, V.x + rr * std::cos(sA + dd), V.y + rr * std::sin(sA + dd), c);
}
