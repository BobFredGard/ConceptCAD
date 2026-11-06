#include "esquisse2d.h"

#include <wx/dcbuffer.h>

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
const wxColour FOND_VUE(0x1c, 0x1c, 0x1e), FOND(0x10, 0x10, 0x12), GRILLE(0x2a, 0x2a, 0x2e), AXE(0x0a, 0x84, 0xff), TRAIT(0xe8, 0xe8, 0xea), GRIS(0x8e, 0x8e, 0x93);
const wxColour VERT(0x30, 0xd1, 0x58), VERT_FOND(0x16, 0x26, 0x1b), ORANGE(0xff, 0xb3, 0x40), ORANGE_AXE(0xff, 0x9f, 0x0a), VIOLET(0xbf, 0x5a, 0xf2), CYAN(0x64, 0xd2, 0xff);

struct P2 {
  double x, y;
};
double dist(const P2& a, const P2& b) { return std::hypot(a.x - b.x, a.y - b.y); }

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

// Géométrie d'une cote linéaire : dimSeg (src/50-esquisse-4). Rend false s'il manque une référence.
struct Seg {
  P2 a{}, b{}, A{}, B{};
  double nx = 0, ny = 0, w = 0, ux = 0, uy = 0;
  char hv = 0;
  double cx = 0, cy = 0;
};
bool segment(const Esquisse& s, const Cote& d, Seg& S) {
  auto pt = [&](const std::string& id, P2& o) {
    const Pt* q = s.point(id);
    if (!q) return false;
    o = {q->x, q->y};
    return true;
  };
  if (d.type == "length" || d.type == "distance") {
    if (d.type == "length") {
      const Entite* l = s.entite(d.line);
      if (!l || !pt(l->p1, S.A) || !pt(l->p2, S.B)) return false;
    } else if (!pt(d.a, S.A) || !pt(d.b, S.B)) {
      return false;
    }
    const double w = d.aW ? d.w : (d.type == "length" ? 5 : 0);
    S.w = w;
    if (d.orient == "h") {
      S.cy = (S.A.y + S.B.y) / 2 + w;
      S.a = {S.A.x, S.cy};
      S.b = {S.B.x, S.cy};
      S.nx = 0;
      S.ny = 1;
      S.hv = 'h';
    } else if (d.orient == "v") {
      S.cx = (S.A.x + S.B.x) / 2 + w;
      S.a = {S.cx, S.A.y};
      S.b = {S.cx, S.B.y};
      S.nx = 1;
      S.ny = 0;
      S.hv = 'v';
    } else {
      double L = dist(S.A, S.B);
      if (L == 0) L = 1e-9;
      S.nx = -(S.B.y - S.A.y) / L;
      S.ny = (S.B.x - S.A.x) / L;
      S.a = {S.A.x + S.nx * w, S.A.y + S.ny * w};
      S.b = {S.B.x + S.nx * w, S.B.y + S.ny * w};
    }
    return true;
  }
  if (d.type == "gap") {
    const Entite* A = s.entite(d.a);
    const Entite* B = s.entite(d.b);
    P2 A1, A2, B1, B2;
    if (!A || !B || !pt(A->p1, A1) || !pt(A->p2, A2) || !pt(B->p1, B1) || !pt(B->p2, B2)) return false;
    double L = dist(A1, A2);
    if (L == 0) L = 1e-9;
    S.ux = (A2.x - A1.x) / L;
    S.uy = (A2.y - A1.y) / L;
    S.nx = -S.uy;
    S.ny = S.ux;
    const P2 Am{(A1.x + A2.x) / 2, (A1.y + A2.y) / 2}, Bm{(B1.x + B2.x) / 2, (B1.y + B2.y) / 2};
    const double ecart = (Bm.x - Am.x) * S.nx + (Bm.y - Am.y) * S.ny;
    S.a = {Am.x + S.ux * d.sl, Am.y + S.uy * d.sl};
    S.b = {S.a.x + S.nx * ecart, S.a.y + S.ny * ecart};
    return true;
  }
  if (d.type == "distline") {
    const Entite* l = s.entite(d.line);
    P2 Q, A, B;
    if (!l || l->t != "line" || !pt(d.p, Q) || !pt(l->p1, A) || !pt(l->p2, B)) return false;
    const double dx = B.x - A.x, dy = B.y - A.y;
    double L2 = dx * dx + dy * dy;
    if (L2 == 0) L2 = 1e-9;
    const double t = ((Q.x - A.x) * dx + (Q.y - A.y) * dy) / L2;
    const P2 F{A.x + dx * t, A.y + dy * t};
    double L = dist(Q, F);
    if (L > 1e-9) {
      S.nx = -(F.y - Q.y) / L;
      S.ny = (F.x - Q.x) / L;
    } else {
      L = std::hypot(dx, dy);
      if (L == 0) L = 1e-9;
      S.nx = dx / L;
      S.ny = dy / L;
    }
    S.w = d.aW ? d.w : 0;
    S.a = {Q.x + S.nx * S.w, Q.y + S.ny * S.w};
    S.b = {F.x + S.nx * S.w, F.y + S.ny * S.w};
    S.A = Q;
    S.B = F;
    return true;
  }
  return false;
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
  terminer_ = new wxButton(this, wxID_ANY, L"Terminer l'esquisse", FromDIP(wxPoint(12, 12)));
  terminer_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) {
    if (surQuitter) surQuitter();
  });
  // Identifiants fixes : natif/mesures/verifier-dessin.ps1 retrouve ces boutons par leur nom.
  const std::pair<Dessin::Outil, const wchar_t*> noms[] = {{Dessin::SELECTION, L"Sélection"}, {Dessin::LIGNE, L"Ligne"}, {Dessin::RECTANGLE, L"Rectangle"}, {Dessin::CERCLE, L"Cercle"}, {Dessin::ARC, L"Arc"}};
  int idBouton = 2010;
  for (const auto& [outil, nom] : noms) {
    auto* b = new wxToggleButton(this, idBouton++, nom);
    const Dessin::Outil o = outil;
    b->Bind(wxEVT_TOGGLEBUTTON, [this, o](wxCommandEvent&) {
      if (dessin_) {
        dessin_->vue(echelle_);
        dessin_->choisirOutil(o);
        apresGeste();
      }
      SetFocus();
    });
    b->Hide();
    outils_.push_back(b);
  }
  caseGrille_ = new wxCheckBox(this, 2015, L"Grille 1 mm");
  caseGrille_->SetValue(true);
  caseGrille_->Hide();
  caseGrille_->Bind(wxEVT_CHECKBOX, [this](wxCommandEvent&) {
    if (dessin_) dessin_->grille = caseGrille_->GetValue();
    SetFocus();
  });
  placerOutils();
  Bind(wxEVT_PAINT, &VueEsquisse::surPeinture, this);
  Bind(wxEVT_LEFT_DOWN, &VueEsquisse::surGaucheBas, this);
  Bind(wxEVT_LEFT_UP, &VueEsquisse::surGaucheHaut, this);
  Bind(wxEVT_KEY_DOWN, &VueEsquisse::surTouche, this);
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

void VueEsquisse::placerOutils() {
  int x = terminer_->GetPosition().x + terminer_->GetSize().x + FromDIP(16);
  const int y = terminer_->GetPosition().y;
  for (wxToggleButton* b : outils_) {
    b->SetSize(x, y, FromDIP(82), terminer_->GetSize().y);
    x += b->GetSize().x + FromDIP(2);
  }
  caseGrille_->SetPosition(wxPoint(x + FromDIP(14), y + FromDIP(4)));
}

void VueEsquisse::poserDessin(Dessin* d) {
  dessin_ = d;
  gauche_ = dblEnAttente_ = false;
  for (wxToggleButton* b : outils_) b->Show(d != nullptr);
  caseGrille_->Show(d != nullptr);
  if (d) d->grille = caseGrille_->GetValue();
  synchroniserOutils();
  Refresh();
}

void VueEsquisse::synchroniserOutils() {
  if (!dessin_) return;
  for (size_t i = 0; i < outils_.size(); i++) outils_[i]->SetValue(static_cast<int>(dessin_->outil()) == static_cast<int>(i));
}

void VueEsquisse::apresGeste() {
  if (!dessin_) return;
  synchroniserOutils();
  if (dessin_->aChange()) {
    dessin_->changeVu();
    if (surDessinChange) surDessinChange();
  }
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

void VueEsquisse::ouvrirCote(const std::string& id) {
  for (const Cote& d : s_->cotes) {
    if (d.id != id) continue;
    for (const ZoneCote& z : zonesCotes_)
      if (z.id == id) {
        wxString texte;
        if (surDemandeCote && surDemandeCote(d, texte)) ouvrirSaisie(d, texte, z.x, z.y);
        return;
      }
    return;
  }
}

void VueEsquisse::surGaucheBas(wxMouseEvent& ev) {
  SetFocus();
  if (!dessin_ || !s_) return;
  if (dessin_->outil() == Dessin::SELECTION) {
    const std::string id = zoneSous(ToDIP(ev.GetPosition()));
    if (!id.empty()) {
      dessin_->choisirCote(id);
      Refresh();
      return;
    }
  }
  if (!HasCapture()) CaptureMouse();
  gauche_ = true;
  const auto w = plan(ev.GetPosition());
  dessin_->vue(echelle_);
  dessin_->enfonce(w.m_x, w.m_y, ev.ControlDown());
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

void VueEsquisse::surTouche(wxKeyEvent& ev) {
  if (dessin_ && ev.GetKeyCode() == WXK_DELETE && !enSaisie()) {
    dessin_->supprimer();
    apresGeste();
    return;
  }
  if (ev.GetKeyCode() == 'X' && !ev.HasAnyModifiers()) {
    commande([](Dessin& d) { d.poserContrainte("construction"); });
    return;
  }
  ev.Skip();
}

void VueEsquisse::montrer(const Esquisse* s, const TopoDS_Shape& piece) {
  s_ = s;
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
      if (en.t != "line" && en.t != "arc" && en.t != "circle" && en.t != "cpoint") nonDessines_++;
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
  // Clic droit sans glisser : fin du tracé, comme le navigateur
  if (geste_.actif && ev.RightUp() && std::abs(d.x) + std::abs(d.y) < 4) abandonnerTrace();
  geste_.actif = false;
  if (HasCapture() && !gauche_) ReleaseMouse();
}
void VueEsquisse::surMouvement(wxMouseEvent& ev) {
  if (!geste_.actif) {
    if (!dessin_ || !s_) return;
    const auto w = plan(ev.GetPosition());
    dessin_->vue(echelle_);
    const bool avant = dessin_->enCours() || dessin_->outil() != Dessin::SELECTION;
    dessin_->bouge(w.m_x, w.m_y);
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
  points(*g);
  cotes(*g);
  trace(*g);
}

// Le tracé en cours, l'accroche et les guides, par-dessus tout
void VueEsquisse::trace(wxGraphicsContext& g) const {
  if (!dessin_) return;
  const Dessin::Brouillon& b = dessin_->brouillon();
  g.SetBrush(wxNullGraphicsBrush);
  g.SetPen(stylo(g, AXE, 1.6, {6, 4}));
  switch (b.sorte) {
    case Dessin::Brouillon::B_LIGNE:
      ligne(g, e(b.x1, b.y1), e(b.x2, b.y2));
      break;
    case Dessin::Brouillon::B_RECT:
      ligne(g, e(b.x1, b.y1), e(b.x2, b.y1));
      ligne(g, e(b.x2, b.y1), e(b.x2, b.y2));
      ligne(g, e(b.x2, b.y2), e(b.x1, b.y2));
      ligne(g, e(b.x1, b.y2), e(b.x1, b.y1));
      break;
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
  const auto rond = [&](double x, double y) {
    const auto q = e(x, y);
    g.SetPen(stylo(g, VERT, 2));
    cercle(g, q.m_x - 6, q.m_y - 6, 12, 12);
  };
  if (b.accroche) rond(b.accroche.x, b.accroche.y);
  if (dessin_->aMarque()) rond(dessin_->marque().x, dessin_->marque().y);
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
  if (traitsFantome_.empty()) return;
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
      if (A.arc && A.e) {
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
  // Sans le calcul de rang (étape du solveur), on ne distingue pas encore le libre (bleu) du déterminé (blanc).
  const auto regler = [&](const Entite& en) {
    if (dessin_ && dessin_->estChoisi(Dessin::Choix::ENTITE, en.id)) g.SetPen(stylo(g, ORANGE_AXE, 2.6));
    else if (en.construction) g.SetPen(stylo(g, alpha(TRAIT, 0.45), 2, {7, 5}));
    else g.SetPen(stylo(g, TRAIT, 2));
  };
  g.SetBrush(wxNullGraphicsBrush);
  const auto sigleT = [&](double x, double y) {
    const auto q = e(x, y);
    g.SetFont(g.CreateFont(GetFont().Bold().Scaled(1.0f), VERT));
    g.DrawText("T", q.m_x + 6, q.m_y - 18);
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
        g.SetPen(stylo(g, alpha(VIOLET, 0.9), 1.3, {4, 3}));
        ligne(g, a, b);
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
      // Petit carré du centre
      g.SetPen(stylo(g, TRAIT, 1));
      g.StrokeLine(c.m_x - 3, c.m_y - 3, c.m_x + 3, c.m_y - 3);
      g.StrokeLine(c.m_x + 3, c.m_y - 3, c.m_x + 3, c.m_y + 3);
      g.StrokeLine(c.m_x + 3, c.m_y + 3, c.m_x - 3, c.m_y + 3);
      g.StrokeLine(c.m_x - 3, c.m_y + 3, c.m_x - 3, c.m_y - 3);
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
        g.SetPen(stylo(g, TRAIT, 2));
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
    if (poignees.count(id)) continue;
    if (percages.count(id)) {
      g.SetBrush(g.CreateBrush(wxBrush(fixe ? ORANGE : FOND)));
      g.SetPen(stylo(g, ORANGE, 1.8));
      g.DrawEllipse(a - 4.5, b - 4.5, 9, 9);
    } else {
      const bool choisi = dessin_ && dessin_->estChoisi(Dessin::Choix::POINT, id);
      g.SetBrush(g.CreateBrush(wxBrush(choisi ? ORANGE_AXE : fixe ? TRAIT : FOND)));
      g.SetPen(stylo(g, choisi ? ORANGE_AXE : TRAIT, 1.5));
      g.DrawRectangle(a - 4, b - 4, 8, 8);
    }
    g.SetBrush(wxNullGraphicsBrush);
    if (nb >= 2) {
      g.SetPen(stylo(g, alpha(VERT, 0.9), 1.2));
      cercle(g, a - 6, b - 6, 12, 12);
    }
  }
}

void VueEsquisse::cotes(wxGraphicsContext& g) const {
  zonesCotes_.clear();
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
