#include "theme.h"
#include "rendu_atelier.h"

#include <wx/mstream.h>
#include <wx/wfstream.h>
#include <wx/zipstrm.h>
#include "rendu_curseur.h"

#include <wx/checkbox.h>
#include <wx/choice.h>
#include <wx/clrpicker.h>
#include <wx/colordlg.h>
#include <wx/control.h>
#include <wx/dcbuffer.h>
#include <wx/dcmemory.h>
#include <wx/filedlg.h>
#include <wx/filename.h>
#include <wx/image.h>
#include <wx/menu.h>
#include <wx/progdlg.h>
#include <wx/stdpaths.h>
#include <cstring>

#include <algorithm>
#include <cmath>
#include <fstream>
#include <map>
#include <sstream>

#include <BRepBndLib.hxx>
#include <Bnd_Box.hxx>
#include <IntCurvesFace_ShapeIntersector.hxx>
#include <gp_Lin.hxx>

#include "interface_esquisse.h"

namespace {
const double PI = 3.14159265358979323846;
const wxColour FOND(0x24, 0x26, 0x2b), CHAMP(0x1e, 0x1f, 0x22), TEXTE(0xd6, 0xd8, 0xdc), DISCRET(0x9a, 0x9e, 0xa6), TRAIT(0x3a, 0x3c, 0x42), BLEU(0x0a, 0x84, 0xff);

using V = std::array<double, 3>;
V moins(const V& a, const V& b) { return {a[0] - b[0], a[1] - b[1], a[2] - b[2]}; }
V plus_(const V& a, const V& b, double k = 1) { return {a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k}; }
double scal(const V& a, const V& b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
double lon(const V& a) { return std::sqrt(scal(a, a)); }
V norme(const V& a) {
  const double l = lon(a);
  return l > 1e-12 ? V{a[0] / l, a[1] / l, a[2] / l} : V{0, 0, 1};
}
V vect(const V& a, const V& b) { return {a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]}; }

std::array<double, 3> hexVers(const std::string& s) {
  const unsigned v = s.size() > 1 ? static_cast<unsigned>(std::strtoul(s.c_str() + 1, nullptr, 16)) : 0;
  return {((v >> 16) & 255) / 255.0, ((v >> 8) & 255) / 255.0, (v & 255) / 255.0};
}
wxColour hexCouleur(const std::string& s) {
  const auto c = hexVers(s);
  return wxColour(static_cast<unsigned char>(c[0] * 255 + 0.5), static_cast<unsigned char>(c[1] * 255 + 0.5), static_cast<unsigned char>(c[2] * 255 + 0.5));
}
std::string couleurHex(const wxColour& c) {
  char t[16];
  snprintf(t, sizeof t, "#%02x%02x%02x", c.Red(), c.Green(), c.Blue());
  return t;
}
wxLongLong maintenant() { return wxGetLocalTimeMillis(); }
wxString virgule(double v, int d) {
  wxString t = wxString::Format("%.*f", d, v);
  t.Replace(".", ",");
  return t;
}
// RT_ECH du navigateur : la qualité en échantillons de lancer de rayons
int echantillons(double ech) { return ech <= 16 ? 128 : ech >= 256 ? 2048 : 512; }
std::string solStudio(const ReglagesRendu& s) { return s.solCol.empty() ? "#d9dbdf" : s.solCol; }

wxString cheminMemoire() { return wxStandardPaths::Get().GetUserConfigDir() + wxFileName::GetPathSeparator() + L"ConceptCADNatif-rendu.json"; }

plan::J versJson(const ReglagesRendu& s) {
  plan::J j;
#define C(n) j[#n] = s.n;
  C(amb) C(fond) C(fc1) C(fc2) C(tons) C(res) C(aretes) C(solCol) C(moteur) C(support) C(envRot) C(envInt) C(lum) C(ombre) C(douceur) C(focale) C(ev) C(ech) C(ouv) C(pDen) C(pHalo) C(pVig) C(pGrain) C(pCon) C(pSat) C(pTemp) C(solOn) C(miroir) C(ombreOn) C(calques)
#undef C
  if (s.hdri) j["hdri"] = wxString(s.hdri->chemin).utf8_string();
  return j;
}
void depuisJson(ReglagesRendu& s, const plan::J& j) {
#define C(n) if (j.contains(#n)) { try { j.at(#n).get_to(s.n); } catch (const std::exception&) {} }
  C(amb) C(fond) C(fc1) C(fc2) C(tons) C(res) C(aretes) C(solCol) C(moteur) C(support) C(envRot) C(envInt) C(lum) C(ombre) C(douceur) C(focale) C(ev) C(ech) C(ouv) C(map) C(pDen) C(pHalo) C(pVig) C(pGrain) C(pCon) C(pSat) C(pTemp) C(solOn) C(miroir) C(ombreOn) C(calques)
#undef C
}

// Le curseur du panneau : le rail et sa poignée, aux couleurs du panneau
}  // namespace

// ---- L'image ----
AtelierRendu::AtelierRendu(wxWindow* parent) : wxWindow(parent, wxID_ANY), minuteur_(this) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  Bind(wxEVT_PAINT, &AtelierRendu::peindre, this);
  Bind(wxEVT_TIMER, &AtelierRendu::pas, this, minuteur_.GetId());
  Bind(wxEVT_LEFT_DOWN, &AtelierRendu::souris, this);
  Bind(wxEVT_LEFT_UP, &AtelierRendu::souris, this);
  Bind(wxEVT_MIDDLE_DOWN, &AtelierRendu::souris, this);
  Bind(wxEVT_MIDDLE_UP, &AtelierRendu::souris, this);
  Bind(wxEVT_RIGHT_DOWN, &AtelierRendu::souris, this);
  Bind(wxEVT_RIGHT_UP, &AtelierRendu::souris, this);
  Bind(wxEVT_MOTION, &AtelierRendu::souris, this);
  Bind(wxEVT_MOUSEWHEEL, &AtelierRendu::souris, this);
  Bind(wxEVT_MOUSE_CAPTURE_LOST, [this](wxMouseCaptureLostEvent&) {
    bouton_ = 0;
    aBouge_ = false;
    vue();
  });
  Bind(wxEVT_SIZE, [this](wxSizeEvent& e) {
    Refresh(false);
    passesFaites_ = -1;
    e.Skip();
  });
  lireMemoire();
  // Une image disparue depuis la dernière fois : retour au studio
  if (st.amb == "hdri" && !st.hdri) st.amb = "studio";
  if (st.fond == "hdri" && (!st.hdri || st.amb != "hdri")) st.fond = "degrade";
}

AtelierRendu::~AtelierRendu() { minuteur_.Stop(); }

void AtelierRendu::lireMemoire() {
  std::ifstream f(cheminMemoire().ToStdWstring());
  if (!f) return;
  try {
    std::stringstream t;
    t << f.rdbuf();
    const plan::J j = plan::J::parse(t.str());
    depuisJson(st, j);
    if (j.contains("hdri") && j["hdri"].is_string()) {
      std::string e;
      st.hdri = lireHdri(wxString::FromUTF8(j["hdri"].get<std::string>()).ToStdWstring(), e);
    }
  } catch (const std::exception&) {
  }
}

void AtelierRendu::memoriser() { memoireSale_ = true; }

void AtelierRendu::lireEnv(const plan::J& j) {
  try {
    depuisJson(st, j);
  } catch (const std::exception&) {
  }
}

plan::J AtelierRendu::ecrireEnv() const {
  plan::J r = plan::J::object();
  r["amb"] = st.amb;
  r["envRot"] = st.envRot;
  r["envInt"] = st.envInt;
  r["lum"] = st.lum;
  r["fond"] = st.fond;
  r["fc1"] = st.fc1;
  r["fc2"] = st.fc2;
  r["ombre"] = st.ombre;
  r["douceur"] = st.douceur;
  r["solOn"] = st.solOn;
  r["solCol"] = st.solCol;
  r["miroir"] = st.miroir;
  r["ombreOn"] = st.ombreOn;
  r["support"] = st.support;
  return r;
}

bool AtelierRendu::importerHdri(const std::wstring& chemin, wxString& message) {
  std::string e;
  const auto h = lireHdri(chemin, e);
  if (!h) {
    message = L"HDRI illisible : " + wxString::FromUTF8(e);
    return false;
  }
  st.hdri = h;
  st.amb = "hdri";
  scene();
  message = wxString::Format(L"HDRI « %s » : %d × %d%s.", h->nom, h->w, h->h, h->soleil ? L", soleil repéré (il devient la lampe)" : L", sans soleil marqué");
  return true;
}

void AtelierRendu::calculerBoite() {
  Bnd_Box b;
  for (const PieceRendu& p : pieces_)
    if (!p.forme.IsNull()) BRepBndLib::Add(p.forme, b);
  if (!b.IsVoid()) b.Get(boite_[0], boite_[1], boite_[2], boite_[3], boite_[4], boite_[5]);
}

void AtelierRendu::ouvrir(const occ::handle<OpenGl_GraphicDriver>& pilote, const std::vector<PieceRendu>& L, const plan::J& doc, const std::array<double, 3>& oeil, const std::array<double, 3>& cible) {
  pilote_ = pilote;
  pieces_ = L;
  docRendu = doc;
  vp_++;
  calculerBoite();
  cam.oeil = oeil;
  cam.cible = cible;
  cam.haut = {0, 0, 1};
  reprendreCao();
  actif_ = true;
  minuteur_.StartOnce(15);
}

void AtelierRendu::fermer() {
  actif_ = false;
  minuteur_.Stop();
  if (memoireSale_) {
    memoireSale_ = false;
    std::ofstream(cheminMemoire().ToStdWstring()) << versJson(st).dump(1);
  }
  // Ne garde pas la mémoire de la carte graphique pour rien
  rayons_ = Etat();
  rapide_ = Etat();
  etatFini_ = nullptr;
}

void AtelierRendu::changerPieces(const std::vector<PieceRendu>& L, const plan::J& doc) {
  pieces_ = L;
  docRendu = doc;
  vp_++;
  calculerBoite();
  if (surPanneau) surPanneau();
}

void AtelierRendu::scene() {
  vs_++;
  memoriser();
}
void AtelierRendu::vue() { vc_++; }
void AtelierRendu::finition() {
  vf_++;
  memoriser();
}

void AtelierRendu::cadrer() {
  const V c{(boite_[0] + boite_[3]) / 2, (boite_[1] + boite_[4]) / 2, (boite_[2] + boite_[5]) / 2};
  double R = 0.5 * std::sqrt(std::pow(boite_[3] - boite_[0], 2) + std::pow(boite_[4] - boite_[1], 2) + std::pow(boite_[5] - boite_[2], 2));
  if (R <= 0) R = 50;
  const double tv = 18 / st.focale / (16.0 / 9), vf = 2 * std::atan(tv), hf = 2 * std::atan(tv * 16 / 9);
  const double d = R / std::sin(std::min(vf, hf) / 2) * 1.08;
  V dir = moins(cam.oeil, cam.cible);
  if (lon(dir) < 1e-6) dir = {1, -1, 0.8};
  dir = norme(dir);
  cam.cible = c;
  cam.oeil = plus_(c, dir, d);
  vue();
}

void AtelierRendu::reprendreCao() {
  st.map = 0;
  cadrer();
  scene();
}

void AtelierRendu::changerFocale(double f) {
  f = std::clamp(f, 12.0, 300.0);
  const double k = (18 / f) == 0 ? 1 : (18 / st.focale) / (18 / f);
  cam.oeil = plus_(cam.cible, moins(cam.oeil, cam.cible), k);
  if (st.map > 0) st.map *= k;
  st.focale = f;
  scene();
  vue();
}

void AtelierRendu::allerVue(const plan::J& k) {
  for (int i = 0; i < 3; i++) {
    cam.oeil[i] = k["p"][i].get<double>();
    cam.cible[i] = k["t"][i].get<double>();
  }
  if (k.contains("u")) for (int i = 0; i < 3; i++) cam.haut[i] = k["u"][i].get<double>();
  st.focale = k.value("f", 50.0);
  st.map = 0;
  scene();
  vue();
  if (surPanneau) surPanneau();
}

int AtelierRendu::nombrePasses() const { return st.moteur == "rayons" ? echantillons(st.ech) : static_cast<int>(st.ech); }

bool AtelierRendu::synchroniser(Etat& e, bool rayons) {
  if (!e.m) e.m = std::make_unique<MoteurRendu>(this, pilote_);
  if (e.vp != vp_) {
    e.m->pieces(pieces_);
    e.vp = vp_;
    e.vs = -1;
  }
  if (e.vs != vs_) {
    // L'ambiance coûte cher à refaire : dix fois par seconde au plus, pendant qu'on tire un curseur
    const wxLongLong t = maintenant();
    if (e.vs >= 0 && (t - e.dernier).ToDouble() < 100) return false;
    e.dernier = t;
    ReglagesRendu r = st;
    r.moteur = rayons ? "rayons" : "rapide";
    if (st.fond == "studio") {
      // Le fond courbe : un sol qui se fond dans un fond uni de la même couleur, sans bord visible
      r.fond = "uni";
      r.fc1 = r.fc2 = solStudio(st);
      r.solCol = r.fc1;
      r.solOn = true;
      r.ombreOn = true;
      r.support.clear();
    }
    e.m->appliquer(r);
    e.vs = vs_;
    e.vc = -1;
  }
  if (e.vc != vc_) {
    e.m->camera(cam, st.focale);
    e.vc = vc_;
  }
  return true;
}

Finition AtelierRendu::reglerFinition(bool rayons) const {
  Finition f;
  f.den = rayons ? st.pDen : 0;
  f.halo = st.pHalo;
  f.expo = std::pow(2.0, st.ev);
  f.vig = st.pVig;
  f.grain = st.pGrain;
  f.con = st.pCon;
  f.sat = st.pSat;
  f.temp = st.pTemp;
  f.tons = st.tons == "doux" ? 1 : st.tons == "cine" ? 2 : st.tons == "lin" ? 3 : 0;
  f.fond = st.fond == "transparent" ? 2 : st.fond == "degrade" ? 1 : 0;
  if (st.fond == "studio") f.c1 = f.c2 = hexVers(solStudio(st));
  else {
    f.c1 = hexVers(st.fc1);
    f.c2 = hexVers(st.fc2);
  }
  return f;
}

void AtelierRendu::poserFondImage(const ImageLineaire& im, std::vector<float>& sortie) const {
  std::vector<float> bg;
  fondPanorama(st, cam, st.focale, im.w, im.h, bg);
  sortie.resize(im.px.size());
  for (size_t n = 0, N = static_cast<size_t>(im.w) * im.h; n < N; n++) {
    const float a = im.px[4 * n + 3];
    for (int k = 0; k < 3; k++) sortie[4 * n + k] = im.px[4 * n + k] + bg[3 * n + k] * (1 - a);
    sortie[4 * n + 3] = 1;
  }
}

void AtelierRendu::montrerImage(const ImageLineaire& im, bool rayons) {
  std::vector<unsigned char> px;
  const bool image = st.fond == "hdri" && st.hdri;
  std::vector<float> avecFond;
  if (image) poserFondImage(im, avecFond);
  finir(image ? avecFond.data() : im.px.data(), im.w, im.h, reglerFinition(rayons), px);
  wxImage i(im.w, im.h);
  unsigned char* d = i.GetData();
  const bool transparent = st.fond == "transparent";
  for (int y = 0, n = 0; y < im.h; y++)
    for (int x = 0; x < im.w; x++, n++) {
      const unsigned char* s = &px[4 * static_cast<size_t>(n)];
      if (transparent) {
        // Le damier dit que le fond est vide, il ne part pas dans le fichier
        const int c = ((x / 12 + y / 12) & 1) ? 0x9c : 0x7c;
        for (int k = 0; k < 3; k++) d[3 * static_cast<size_t>(n) + k] = static_cast<unsigned char>((s[k] * s[3] + c * (255 - s[3])) / 255);
      } else {
        d[3 * static_cast<size_t>(n)] = s[0], d[3 * static_cast<size_t>(n) + 1] = s[1], d[3 * static_cast<size_t>(n) + 2] = s[2];
      }
    }
  image_ = wxBitmap(i);
}

// Le calcul se fait par morceaux sur le fil de la fenêtre : après chaque morceau, au moins autant de temps libre
// pour l'affichage et la souris (sur un portable, un morceau peut durer bien plus que les 15 ms du minuteur)
void AtelierRendu::pas(wxTimerEvent&) {
  const wxLongLong t0 = maintenant();
  pasDeCalcul();
  const long duree = static_cast<long>((maintenant() - t0).ToDouble());
  if (actif_) minuteur_.StartOnce(static_cast<int>(std::clamp(duree, 15L, 250L)));
}

void AtelierRendu::pasDeCalcul() {
  if (memoireSale_ && (maintenant() - dernierEcrit_).ToDouble() > 2000) {
    memoireSale_ = false;
    dernierEcrit_ = maintenant();
    std::ofstream(cheminMemoire().ToStdWstring()) << versJson(st).dump(1);
  }
  if (!actif_ || exporte_ || pieces_.empty()) return;
  const wxRect c = cadreImage();
  if (c.width < 32 || c.height < 18) return;
  const bool glisse = bouton_ != 0 && aBouge_;
  const bool rayons = st.moteur == "rayons" && !glisse;
  Etat& e = rayons ? rayons_ : rapide_;
  int w = c.width, h = c.height;
  if (glisse) w /= 2, h /= 2;
  if (!synchroniser(e, rayons)) return;
  const int N = glisse ? 1 : nombrePasses();
  const int avant = e.m->passes();
  const wxLongLong t0 = maintenant();
  // Une image incomplète de la bonne taille : on ne continue pas une autre taille
  while (e.m->passes() < N || e.m->image().w != w) {
    if (!e.m->passe(w, h)) {
      erreur_ = e.m->erreur;
      Refresh(false);
      return;
    }
    if ((maintenant() - t0).ToDouble() > 20) break;
  }
  const int n = e.m->passes();
  if (n == 0 || e.m->image().w <= 0) return;
  erreur_.clear();
  const bool neuf = n != avant || passesFaites_ != n || etatFini_ != &e;
  if (!neuf && vfFaite_ == vf_) return;
  const wxLongLong t = maintenant();
  // Sans se noyer : la finition coûte, surtout le débruitage
  const long attente = std::max(120L, dureeFini_ * 3);
  if ((t - dernierFini_).ToDouble() < attente && n < N && vfFaite_ == vf_) return;
  montrerImage(e.m->image(), rayons);
  dureeFini_ = static_cast<long>((maintenant() - t).ToDouble());
  dernierFini_ = maintenant();
  vfFaite_ = vf_;
  passesFaites_ = n;
  etatFini_ = &e;
  if (glisse) compteur_ = L"Aperçu";
  else compteur_ = rayons ? wxString::Format(L"Lancer de rayons : %d / %d échantillons", n, N) : wxString::Format(L"Affinage : %d / %d", n, N);
  Refresh(false);
}

void AtelierRendu::attendreFin() {
  // Essai automatique : les mêmes pas que le minuteur, jusqu'au bout
  bool fini = false;
  for (int i = 0; i < 200000 && !fini; i++) {
    pasDeCalcul();
    const Etat& e = st.moteur == "rayons" ? rayons_ : rapide_;
    fini = e.m && e.vs == vs_ && e.vc == vc_ && e.vp == vp_ && e.m->passes() >= nombrePasses() && passesFaites_ == e.m->passes() && vfFaite_ == vf_;
    if (!erreur_.empty()) return;
    if (!fini && e.m && e.vs != vs_) wxMilliSleep(20);
  }
}

wxRect AtelierRendu::cadreImage() const {
  const wxSize t = GetClientSize();
  const int m = FromDIP(14), haut = FromDIP(14), bas = FromDIP(46);
  int w = t.x - 2 * m, h = t.y - haut - bas;
  if (w <= 0 || h <= 0) return wxRect();
  if (w * 9 > h * 16) w = h * 16 / 9;
  else h = w * 9 / 16;
  w &= ~1, h &= ~1;
  return wxRect((t.x - w) / 2, haut + (t.y - haut - bas - h) / 2, w, h);
}

void AtelierRendu::peindre(wxPaintEvent&) {
  wxAutoBufferedPaintDC dc(this);
  dc.SetBackground(th(wxColour(0x16, 0x17, 0x1a)));
  dc.Clear();
  const wxRect c = cadreImage();
  const wxSize t = GetClientSize();
  if (c.width > 0 && image_.IsOk()) {
    wxMemoryDC mem(image_);
    dc.StretchBlit(c.x, c.y, c.width, c.height, &mem, 0, 0, image_.GetWidth(), image_.GetHeight());
    mem.SelectObject(wxNullBitmap);
  }
  dc.SetPen(wxPen(th(wxColour(0x3a, 0x3c, 0x42))));
  dc.SetBrush(*wxTRANSPARENT_BRUSH);
  dc.DrawRectangle(c.x - 1, c.y - 1, c.width + 2, c.height + 2);
  dc.SetFont(GetFont());
  const int y = c.GetBottom() + FromDIP(6);
  if (pieces_.empty()) {
    dc.SetTextForeground(TEXTE);
    dc.DrawLabel(L"Aucune pièce à l'écran.", c, wxALIGN_CENTER);
    return;
  }
  dc.SetTextForeground(erreur_.empty() ? TEXTE : th(wxColour(0xff, 0x6b, 0x60)));
  dc.DrawText(erreur_.empty() ? compteur_ : wxString::FromUTF8(erreur_), c.x, y);
  dc.SetTextForeground(DISCRET);
  const wxString indice = L"Glisser ou clic molette : tourner · clic droit : déplacer · clic droit sur une pièce : son matériau · molette : avancer / reculer · clic : mise au point — le cadre est l'image finale (16:9)";
  dc.DrawText(wxControl::Ellipsize(indice, dc, wxELLIPSIZE_END, t.x - 2 * c.x), c.x, y + FromDIP(18));
}

// ---- La souris : comme les commandes d'orbite de la page, Z en haut ----
void AtelierRendu::souris(wxMouseEvent& e) {
  const wxPoint p = e.GetPosition();
  const double H = std::max(1, cadreImage().height);
  if (e.GetEventType() == wxEVT_MOUSEWHEEL) {
    const double n = e.GetWheelRotation() / static_cast<double>(std::max(1, e.GetWheelDelta()));
    V o = moins(cam.oeil, cam.cible);
    double r = lon(o) * std::pow(0.95, n);
    const double R = 0.5 * std::sqrt(std::pow(boite_[3] - boite_[0], 2) + std::pow(boite_[4] - boite_[1], 2) + std::pow(boite_[5] - boite_[2], 2));
    r = std::max(r, std::max(R, 1.0) * 0.02);
    cam.oeil = plus_(cam.cible, norme(o), r);
    vue();
    return;
  }
  if (e.ButtonDown()) {
    SetFocus();
    if (bouton_) return;
    bouton_ = e.GetButton();
    depart_ = dernier_ = p;
    aBouge_ = false;
    CaptureMouse();
    return;
  }
  if (e.ButtonUp()) {
    if (e.GetButton() != bouton_) return;
    const int b = bouton_;
    const bool bouge = aBouge_;
    bouton_ = 0;
    aBouge_ = false;
    if (HasCapture()) ReleaseMouse();
    if (bouge) {
      vue();
      return;
    }
    double d = 0;
    if (b == wxMOUSE_BTN_LEFT) {
      if (viser(p, d) >= 0) {
        st.map = d;
        scene();
        if (surPanneau) surPanneau();
      }
    } else if (b == wxMOUSE_BTN_RIGHT) {
      const int i = viser(p, d);
      if (i >= 0) menuPiece(i, this);
    }
    return;
  }
  if (!bouton_ || !e.Dragging()) return;
  if (!aBouge_ && std::hypot(p.x - depart_.x, p.y - depart_.y) < FromDIP(4)) return;
  aBouge_ = true;
  const double dx = p.x - dernier_.x, dy = p.y - dernier_.y;
  dernier_ = p;
  V o = moins(cam.oeil, cam.cible);
  const double r = lon(o);
  if (bouton_ == wxMOUSE_BTN_RIGHT) {
    const double k = 2 * r * (18 / st.focale / (16.0 / 9)) / H;
    const V f = norme(moins(cam.cible, cam.oeil)), dr = norme(vect(f, cam.haut)), up = norme(vect(dr, f));
    V dep = plus_(V{dr[0] * -dx * k, dr[1] * -dx * k, dr[2] * -dx * k}, up, dy * k);
    cam.oeil = plus_(cam.oeil, dep);
    cam.cible = plus_(cam.cible, dep);
  } else {
    double th = std::atan2(o[1], o[0]), ph = std::acos(std::clamp(o[2] / std::max(r, 1e-9), -1.0, 1.0));
    th -= 2 * PI * dx / H;
    ph = std::clamp(ph - 2 * PI * dy / H, 0.01, PI - 0.01);
    cam.oeil = plus_(cam.cible, V{r * std::sin(ph) * std::cos(th), r * std::sin(ph) * std::sin(th), r * std::cos(ph)});
  }
  vue();
}

int AtelierRendu::viser(const wxPoint& p, double& distance) const {
  const wxRect c = cadreImage();
  if (c.width <= 0 || !c.Contains(p)) return -1;
  const double u = (p.x - c.x + 0.5) / c.width * 2 - 1, v = 1 - (p.y - c.y + 0.5) / c.height * 2;
  const double th = 18 / st.focale, tv = th / (16.0 / 9);
  const V f = norme(moins(cam.cible, cam.oeil)), dr = norme(vect(f, cam.haut)), up = norme(vect(dr, f));
  const V d = norme(plus_(plus_(f, dr, u * th), up, v * tv));
  const gp_Lin rayon(gp_Pnt(cam.oeil[0], cam.oeil[1], cam.oeil[2]), gp_Dir(d[0], d[1], d[2]));
  int meilleur = -1;
  double mini = 1e30;
  for (size_t i = 0; i < pieces_.size(); i++) {
    if (pieces_[i].forme.IsNull()) continue;
    IntCurvesFace_ShapeIntersector x;
    x.Load(pieces_[i].forme, 1e-3);
    x.PerformNearest(rayon, 0, 1e12);
    if (x.IsDone() && x.NbPnt() > 0 && x.WParameter(1) < mini) {
      mini = x.WParameter(1);
      meilleur = static_cast<int>(i);
    }
  }
  if (meilleur >= 0) distance = mini * scal(d, f);
  return meilleur;
}

void AtelierRendu::essaiGlisser(int bouton, double u0, double v0, double u1, double v1) {
  const wxRect c = cadreImage();
  const auto ev = [&](wxEventType t, double u, double v, bool tenu) {
    wxMouseEvent e(t);
    e.m_x = c.x + static_cast<int>(u * c.width);
    e.m_y = c.y + static_cast<int>(v * c.height);
    e.m_leftDown = tenu && bouton == 1;
    e.m_middleDown = tenu && bouton == 2;
    e.m_rightDown = tenu && bouton == 3;
    souris(e);
  };
  ev(bouton == 1 ? wxEVT_LEFT_DOWN : bouton == 2 ? wxEVT_MIDDLE_DOWN : wxEVT_RIGHT_DOWN, u0, v0, true);
  for (int i = 1; i <= 10; i++) {
    ev(wxEVT_MOTION, u0 + (u1 - u0) * i / 10, v0 + (v1 - v0) * i / 10, true);
    pasDeCalcul();
  }
  ev(bouton == 1 ? wxEVT_LEFT_UP : bouton == 2 ? wxEVT_MIDDLE_UP : wxEVT_RIGHT_UP, u1, v1, false);
}

void AtelierRendu::cliquer(double u, double v) {
  const wxRect c = cadreImage();
  double d = 0;
  if (viser(wxPoint(c.x + static_cast<int>(u * c.width), c.y + static_cast<int>(v * c.height)), d) >= 0) {
    st.map = d;
    scene();
    if (surPanneau) surPanneau();
  }
}

// Le matériau d'une pièce : le menu du clic droit et sa ligne dans le panneau
void AtelierRendu::preparerMenu(const std::vector<PieceRendu>& L, const plan::J& doc) {
  pieces_ = L;
  docRendu = doc;
}

void AtelierRendu::menuPiece(int i, wxWindow* ou) {
  if (i < 0 || i >= static_cast<int>(pieces_.size()) || (pieces_[i].id.empty() && pieces_[i].occ.empty())) return;
  const PieceRendu& P = pieces_[i];
  wxMenu m;
  enum { SANS = wxID_HIGHEST + 1, COULEUR, CAO_, TOUS, ECHELLE, REL_MAT, REL0, REL_FIN = REL0 + 20, DIR0, DIR_FIN = DIR0 + 3, PAT0, PAT_FIN = PAT0 + 10, BASE };
  std::vector<std::wstring> familles;
  std::map<std::wstring, wxMenu*> sous;
  const auto& B = bibliothequeRendu();
  for (size_t k = 0; k < B.size(); k++) {
    std::wstring fam = B[k].famille;
    if (!sous.count(fam)) {
      sous[fam] = new wxMenu;
      familles.push_back(fam);
    }
    wxMenuItem* it = sous[fam]->AppendCheckItem(BASE + static_cast<int>(k), B[k].nom);
    if (P.cle == B[k].cle) it->Check(true);
  }
  for (const auto& fam : familles) m.AppendSubMenu(sous[fam], fam);
  m.AppendSeparator();
  m.AppendCheckItem(SANS, L"Sans matériau")->Check(P.cle.empty());
  m.Append(COULEUR, L"Couleur…");
  {
    ReliefEffectif eff;
    const bool aEff = reliefEffectif(P.rel, P.cle, eff);
    auto* sr = new wxMenu;
    const std::string tMat = reliefDuMateriau(P.cle);
    wxString selon = L"Selon le matériau (aucun)";
    for (const ChoixTexte& c : typesRelief())
      if (tMat == c.cle) selon = wxString(L"Selon le matériau (") + c.nom + L")";
    sr->AppendCheckItem(REL_MAT, selon)->Check(P.rel.t.empty());
    int k = 0;
    for (const ChoixTexte& c : typesRelief()) sr->AppendCheckItem(REL0 + k++, c.nom)->Check(P.rel.t == c.cle);
    m.AppendSubMenu(sr, L"Relief");
    if (aEff) {
      auto* sd = new wxMenu;
      for (int a = 0; a < 3; a++) sd->AppendCheckItem(DIR0 + a, wxString(static_cast<wxChar>(L'X' + a)))->Check(eff.d == 'x' + a);
      m.AppendSubMenu(sd, L"Direction du motif");
      m.Append(ECHELLE, wxString::Format(L"Échelle du motif (%g mm)…", eff.e));
    }
    auto* sp = new wxMenu;
    k = 0;
    for (const ChoixTexte& c : typesPatine()) sp->AppendCheckItem(PAT0 + k++, c.nom)->Check(P.rel.p == c.cle);
    m.AppendSubMenu(sp, L"Patine");
  }
  wxMenuItem* retour = m.Append(CAO_, L"Reprendre l'apparence de la CAO");
  retour->Enable(P.propre);
  if (!P.occ.empty()) m.Append(TOUS, L"Même apparence pour toutes les occurrences de ce composant");
  const int id = ou->GetPopupMenuSelectionFromUser(m);
  if (id == wxID_NONE) return;
  if (id == REL_MAT || (id >= REL0 && id < REL_FIN) || (id >= DIR0 && id < DIR_FIN) || (id >= PAT0 && id < PAT_FIN) || id == ECHELLE) {
    ReliefChoisi r = P.rel;
    if (id == REL_MAT) r.t.clear();
    else if (id >= REL0 && id < REL_FIN) r.t = typesRelief()[id - REL0].cle;
    else if (id >= DIR0 && id < DIR_FIN) r.d = std::string(1, static_cast<char>('x' + (id - DIR0)));
    else if (id >= PAT0 && id < PAT_FIN) r.p = typesPatine()[id - PAT0].cle;
    else {
      ReliefEffectif eff;
      reliefEffectif(P.rel, P.cle, eff);
      wxString t = wxGetTextFromUser(L"Échelle du motif (mm), de 0,01 à 50", L"Relief", wxString::Format(L"%g", eff.e), ou);
      t.Replace(L",", L".");
      double v = 0;
      if (!t.ToCDouble(&v) || !(v > 0.005 && v < 50)) return;
      r.e = v;
    }
    poserRelief(i, r);
    return;
  }
  if (id == SANS) poserApparence(i, "", -1);
  else if (id == CAO_) effacerApparence(i);
  else if (id == TOUS) toutesOccurrences(i);
  else if (id == COULEUR) {
    const unsigned u = P.couleur;
    const wxColour c = wxGetColourFromUser(ou, wxColour((u >> 16) & 255, (u >> 8) & 255, u & 255), L"Couleur de la pièce");
    if (c.IsOk()) poserApparence(i, P.cle, (static_cast<long>(c.Red()) << 16) | (c.Green() << 8) | c.Blue());
  } else if (id >= BASE) poserApparence(i, B[id - BASE].cle, -1);
}

// relNorm : les champs valides seulement
void AtelierRendu::poserRelief(int i, const ReliefChoisi& r) {
  const PieceRendu& P = pieces_[i];
  plan::J o;
  o["mat"] = P.cle;
  o["col"] = P.couleur;
  plan::J rel = plan::J::object();
  if (!r.t.empty()) rel["t"] = r.t;
  if (r.e > 0) rel["e"] = std::round(r.e * 1000) / 1000;
  if (!r.d.empty()) rel["d"] = r.d;
  if (!r.p.empty()) rel["p"] = r.p;
  if (!rel.empty()) o["rel"] = rel;
  if (!P.occ.empty()) {
    if (surOccurrence) surOccurrence(P, &o, false);
    return;
  }
  if (!docRendu.is_object()) docRendu = plan::J::object();
  if (!docRendu.contains("corps")) docRendu["corps"] = plan::J::object();
  docRendu["corps"][P.id] = o;
  if (surDoc) surDoc(docRendu);
}

void AtelierRendu::poserApparence(int i, const std::string& mat, long couleur) {
  const PieceRendu& P = pieces_[i];
  const MatiereRendu* d = matiereRendu(mat);
  plan::J o;
  o["mat"] = d ? mat : std::string();
  o["col"] = couleur >= 0 ? static_cast<unsigned>(couleur) : d ? d->couleur : P.couleurCao;
  if (!P.occ.empty()) {
    if (surOccurrence) surOccurrence(P, &o, false);
    return;
  }
  if (docRendu.is_object() && docRendu.contains("corps") && docRendu["corps"].contains(P.id)) {
    const plan::J& av = docRendu["corps"][P.id];
    if (av.contains("rel") && av.value("mat", std::string()) == o["mat"].get<std::string>()) o["rel"] = av["rel"];
  }
  if (!docRendu.is_object()) docRendu = plan::J::object();
  if (!docRendu.contains("corps")) docRendu["corps"] = plan::J::object();
  docRendu["corps"][P.id] = o;
  if (surDoc) surDoc(docRendu);
}

void AtelierRendu::toutesOccurrences(int i) {
  const PieceRendu& P = pieces_[i];
  plan::J o;
  o["mat"] = P.cle;
  o["col"] = P.couleur;
  if (!P.rel.vide()) {  // même apparence, relief et patine compris
    plan::J rel = plan::J::object();
    if (!P.rel.t.empty()) rel["t"] = P.rel.t;
    if (P.rel.e > 0) rel["e"] = P.rel.e;
    if (!P.rel.d.empty()) rel["d"] = P.rel.d;
    if (!P.rel.p.empty()) rel["p"] = P.rel.p;
    o["rel"] = rel;
  }
  if (surOccurrence) surOccurrence(P, &o, true);
}

void AtelierRendu::effacerApparence(int i) {
  if (!pieces_[i].occ.empty()) {
    if (surOccurrence) surOccurrence(pieces_[i], nullptr, false);
    return;
  }
  if (docRendu.is_object() && docRendu.contains("corps")) {
    docRendu["corps"].erase(pieces_[i].id);
    if (docRendu["corps"].empty()) docRendu.erase("corps");
  }
  if (surDoc) surDoc(docRendu);
}

// ---- L'image finale ----
// L'archive pour la retouche : l'image finie et ses calques, sans compression (les PNG le sont déjà)
wxString AtelierRendu::ecrireCalques(MoteurRendu& m, const wxImage& beaute, int w, int h, const wxString& chemin) {
  wxBusyCursor attente;
  std::vector<std::pair<std::string, wxImage>> L;
  if (!m.calques(w, h, L)) return L"Calques impossibles : rien à dessiner.";
  L.insert(L.begin(), {"1 - beaute.png", beaute});
  wxFileOutputStream fichier(chemin);
  if (!fichier.IsOk()) return L"Écriture du fichier impossible.";
  wxZipOutputStream zip(fichier, 0);
  for (const auto& [nom, im] : L) {
    wxMemoryOutputStream png;
    if (!im.SaveFile(png, wxBITMAP_TYPE_PNG)) return L"Écriture du fichier impossible.";
    const size_t n = png.GetSize();
    std::vector<char> octets(n);
    png.CopyTo(octets.data(), n);
    if (!zip.PutNextEntry(wxString::FromUTF8(nom))) return L"Écriture du fichier impossible.";
    zip.Write(octets.data(), n);
  }
  if (!zip.Close() || !fichier.Close()) return L"Écriture du fichier impossible.";
  return wxString::Format(L"Image et calques enregistrés : %s", wxFileName(chemin).GetFullName());
}

wxString AtelierRendu::exporter(const wxString& chemin, bool avecDialogue) {
  const bool rayons = st.moteur == "rayons";
  Etat& e = rayons ? rayons_ : rapide_;
  const int W = st.res == "2160" ? 3840 : 1920, H = st.res == "2160" ? 2160 : 1080, N = nombrePasses();
  exporte_ = true;
  // Une ambiance tout juste changée : on attend qu'elle soit posée
  while (!synchroniser(e, rayons)) wxMilliSleep(20);
  e.m->reprendre();
  std::unique_ptr<wxProgressDialog> dlg;
  if (avecDialogue) dlg = std::make_unique<wxProgressDialog>(L"Rendu de l'image", wxString::Format(L"%d × %d — %d %s", W, H, N, rayons ? L"échantillons" : L"passes"), N, this, wxPD_APP_MODAL | wxPD_CAN_ABORT | wxPD_ELAPSED_TIME | wxPD_REMAINING_TIME | wxPD_AUTO_HIDE);
  wxString retour;
  bool ok = true;
  wxLongLong dernier = maintenant();
  for (int i = 0; i < N && ok; i++) {
    ok = e.m->passe(W, H);
    if (dlg && (maintenant() - dernier).ToDouble() > 150) {
      dernier = maintenant();
      if (!dlg->Update(i)) {
        retour = L"Rendu annulé : aucun fichier écrit.";
        break;
      }
    }
  }
  dlg.reset();
  if (!ok) retour = L"Rendu impossible : " + wxString::FromUTF8(e.m->erreur);
  if (retour.empty()) {
    std::vector<unsigned char> px;
    const bool image = st.fond == "hdri" && st.hdri;
    std::vector<float> avecFond;
    if (image) poserFondImage(e.m->image(), avecFond);
    finir(image ? avecFond.data() : e.m->image().px.data(), W, H, reglerFinition(rayons), px);
    wxImage im(W, H);
    const bool transparent = st.fond == "transparent";
    if (transparent) im.SetAlpha();
    for (int n = 0; n < W * H; n++) {
      im.GetData()[3 * static_cast<size_t>(n)] = px[4 * static_cast<size_t>(n)];
      im.GetData()[3 * static_cast<size_t>(n) + 1] = px[4 * static_cast<size_t>(n) + 1];
      im.GetData()[3 * static_cast<size_t>(n) + 2] = px[4 * static_cast<size_t>(n) + 2];
      if (transparent) im.GetAlpha()[n] = px[4 * static_cast<size_t>(n) + 3];
    }
    if (st.calques) retour = ecrireCalques(*e.m, im, W, H, chemin);
    else retour = im.SaveFile(chemin, wxBITMAP_TYPE_PNG) ? wxString::Format(L"Image enregistrée : %s", wxFileName(chemin).GetFullName()) : wxString(L"Écriture du fichier impossible.");
  }
  exporte_ = false;
  e.m->reprendre();
  passesFaites_ = -1;
  return retour;
}

bool AtelierRendu::enregistrerApercu(const wxString& chemin) { return image_.IsOk() && image_.ConvertToImage().SaveFile(chemin, wxBITMAP_TYPE_PNG); }

// ---- Le panneau ----
PanneauRendu::PanneauRendu(wxWindow* parent, AtelierRendu* a) : wxPanel(parent), a_(a) {
  SetBackgroundColour(FOND);
  auto* s = new wxBoxSizer(wxVERTICAL);
  defile_ = new wxScrolledWindow(this, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxVSCROLL | wxBORDER_NONE);
  defile_->SetScrollRate(0, FromDIP(14));
  defile_->ShowScrollbars(wxSHOW_SB_NEVER, wxSHOW_SB_ALWAYS);  // toujours là : la largeur des rangées ne change pas
  defile_->SetBackgroundColour(FOND);
  defile_->SetForegroundColour(TEXTE);
  racine_ = new wxBoxSizer(wxVERTICAL);
  defile_->SetSizer(racine_, false);
  defile_->Bind(wxEVT_SIZE, [this](wxSizeEvent& e) {
    ajusterDefile();
    e.Skip();
  });
  s->Add(defile_, 1, wxEXPAND);
  // Le pied reste visible : format retenu et bouton
  resume_ = new wxStaticText(this, wxID_ANY, wxEmptyString);
  resume_->SetForegroundColour(DISCRET);
  s->Add(resume_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxTOP, FromDIP(6));
  auto* go = new BoutonEsquisse(this, wxID_ANY, L"Rendre et enregistrer le PNG", L"Calcule l'image à sa taille finale, puis demande où l'écrire", BoutonEsquisse::PRINCIPAL);
  go->titre(L"Rendre et enregistrer le PNG");
  go->fond(FOND);
  go->SetMinSize(FromDIP(wxSize(-1, 30)));
  go->surClic = [this] { lancerExport(); };
  s->Add(go, 0, wxEXPAND | wxALL, FromDIP(6));
  message_ = new wxStaticText(this, wxID_ANY, wxEmptyString);
  message_->SetForegroundColour(TEXTE);
  s->Add(message_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(6));
  SetSizer(s);
}

void PanneauRendu::message(const wxString& t) {
  message_->SetLabel(t);
  message_->Wrap(FromDIP(240));
  Layout();
}

void PanneauRendu::aPres(std::function<void()> f) {
  CallAfter([this, f] {
    f();
    refaire();
  });
}

void PanneauRendu::titre(const wxString& t) {
  auto* l = new wxStaticText(defile_, wxID_ANY, t);
  wxFont f = l->GetFont();
  f.SetWeight(wxFONTWEIGHT_SEMIBOLD);
  l->SetFont(f);
  l->SetForegroundColour(*wxWHITE);
  auto* trait = new wxPanel(defile_, wxID_ANY, wxDefaultPosition, FromDIP(wxSize(-1, 1)));
  trait->SetBackgroundColour(TRAIT);
  if (!racine_->IsEmpty()) racine_->Add(trait, 0, wxEXPAND | wxTOP, FromDIP(8));
  else trait->Hide();
  racine_->Add(l, 0, wxLEFT | wxRIGHT | wxTOP, FromDIP(6));
  racine_->AddSpacer(FromDIP(3));
}

void PanneauRendu::sousTitre(const wxString& t) {
  auto* l = new wxStaticText(defile_, wxID_ANY, t);
  l->SetForegroundColour(DISCRET);
  racine_->Add(l, 0, wxLEFT | wxRIGHT | wxTOP, FromDIP(6));
}

wxBoxSizer* PanneauRendu::rang(const wxString& libelle) {
  auto* s = new wxBoxSizer(wxHORIZONTAL);
  if (!libelle.empty()) {
    auto* l = new wxStaticText(defile_, wxID_ANY, libelle);
    l->SetForegroundColour(TEXTE);
    l->SetMinSize(FromDIP(wxSize(60, -1)));
    s->Add(l, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(3));
  }
  racine_->Add(s, 0, wxEXPAND | wxLEFT | wxRIGHT | wxTOP, FromDIP(5));
  return s;
}

void PanneauRendu::note(const wxString& t) {
  auto* l = new wxStaticText(defile_, wxID_ANY, t);
  l->SetForegroundColour(DISCRET);
  l->Wrap(FromDIP(222));
  racine_->Add(l, 0, wxLEFT | wxRIGHT | wxTOP, FromDIP(6));
}

void PanneauRendu::curseur(const wxString& libelle, double* valeur, double mini, double maxi, double pas, std::function<wxString(double)> texte, std::function<void()> apres) {
  auto* s = rang(libelle);
  auto* c = new Curseur(defile_, *valeur, mini, maxi, pas);
  auto* v = new wxStaticText(defile_, wxID_ANY, texte(*valeur), wxDefaultPosition, FromDIP(wxSize(46, -1)), wxALIGN_RIGHT | wxST_NO_AUTORESIZE);
  v->SetForegroundColour(DISCRET);
  s->Add(c, 1, wxEXPAND);
  s->Add(v, 0, wxALIGN_CENTER_VERTICAL);
  c->surValeur = [valeur, v, texte, apres](double x) {
    *valeur = x;
    v->SetLabel(texte(x));
    apres();
  };
}

void PanneauRendu::segments(const wxString& libelle, const std::vector<std::pair<std::string, wxString>>& v, const std::string& actuel, std::function<void(const std::string&)> f) {
  auto* s = rang(libelle);
  for (const auto& [cle, t] : v) {
    auto* b = new BoutonEsquisse(defile_, wxID_ANY, t, t, BoutonEsquisse::ENCADRE);
    b->titre(t);
    b->fond(FOND);
    b->actif(cle == actuel);
    b->SetMinSize(wxSize(GetTextExtent(t).x + FromDIP(5), FromDIP(24)));
    const std::string k = cle;
    b->surClic = [this, f, k] { aPres([f, k] { f(k); }); };
    s->Add(b, static_cast<int>(t.length()) + 2, wxRIGHT, FromDIP(1));
  }
}

void PanneauRendu::choix(const wxString& libelle, const std::vector<std::pair<std::string, wxString>>& v, const std::string& actuel, std::function<void(const std::string&)> f) {
  auto* s = rang(libelle);
  auto* c = new wxChoice(defile_, wxID_ANY);
  int sel = 0;
  std::vector<std::string> cles;
  for (const auto& [cle, t] : v) {
    if (cle == actuel) sel = static_cast<int>(cles.size());
    c->Append(t);
    cles.push_back(cle);
  }
  c->SetSelection(sel);
  c->Bind(wxEVT_CHOICE, [this, c, cles, f](wxCommandEvent&) {
    const std::string k = cles[c->GetSelection()];
    aPres([f, k] { f(k); });
  });
  s->Add(c, 1, wxEXPAND);
}

void PanneauRendu::boutons(const std::vector<std::pair<wxString, std::function<void()>>>& v, int parLigne) {
  wxBoxSizer* s = nullptr;
  int n = 0;
  for (const auto& [t, f] : v) {
    if (!s || n % parLigne == 0) s = rang(wxEmptyString);
    n++;
    auto* b = new BoutonEsquisse(defile_, wxID_ANY, t, t, BoutonEsquisse::ENCADRE);
    b->titre(t);
    b->fond(FOND);
    b->SetMinSize(wxSize(GetTextExtent(t).x + FromDIP(5), FromDIP(24)));
    const auto g = f;
    b->surClic = [this, g] { aPres(g); };
    s->Add(b, 1, wxRIGHT, FromDIP(2));
  }
  if (s) while (n++ % parLigne) s->AddStretchSpacer(1);
}

void PanneauRendu::coche(wxSizer* s, const wxString& libelle, bool* valeur) {
  auto* c = new wxCheckBox(defile_, wxID_ANY, libelle);
  c->SetForegroundColour(TEXTE);
  c->SetValue(*valeur);
  c->Bind(wxEVT_CHECKBOX, [this, c, valeur](wxCommandEvent&) {
    *valeur = c->GetValue();
    a_->scene();
  });
  s->Add(c, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(5));
}

void PanneauRendu::couleur(wxSizer* s, std::string* valeur, const std::string& defaut) {
  auto* c = new wxColourPickerCtrl(defile_, wxID_ANY, hexCouleur(valeur->empty() ? defaut : *valeur), wxDefaultPosition, FromDIP(wxSize(34, 22)));
  c->Bind(wxEVT_COLOURPICKER_CHANGED, [this, c, valeur](wxColourPickerEvent&) {
    *valeur = couleurHex(c->GetColour());
    a_->scene();
  });
  s->Add(c, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(5));
}

void PanneauRendu::refaire() {
  int x = 0, y = 0;
  defile_->GetViewStart(&x, &y);
  defile_->Freeze();
  racine_->Clear(true);
  ReglagesRendu& st = a_->st;
  AtelierRendu* A = a_;
  const auto scene = [A] { A->scene(); };
  const auto fin = [A] { A->finition(); };
  const auto v2 = [](double v) { return virgule(v, 2); };
  const auto pct = [](double v) { return wxString::Format("%d %%", static_cast<int>(std::lround(v * 100))); };
  const auto sg = [](double v) {
    const int n = static_cast<int>(std::lround(v * 100));
    return n > 0 ? wxString::Format("+%d", n) : wxString::Format("%d", n);
  };
  const bool ray = st.moteur == "rayons";

  boutons({{L"Fermer", [A] { if (A->surFermer) A->surFermer(); }}}, 1);

  titre(L"Moteur");
  segments(L"Calcul", {{"rapide", L"Rapide"}, {"rayons", L"Lancer de rayons"}}, st.moteur, [A, &st](const std::string& k) {
    st.moteur = k;
    A->scene();
  });
  if (ray) note(L"Sans arêtes CAO. Pendant un glisser, l'aperçu rapide reprend la main.");

  titre(L"Ambiance");
  {
    std::vector<std::pair<std::string, wxString>> L = {{"studio", L"Studio"}, {"clair", L"Clair"}, {"atelier", L"Atelier"}, {"exterieur", L"Extérieur"}, {"noir", L"Noir"}};
    if (st.hdri) L.push_back({"hdri", wxString(L"Image HDRI : ") + st.hdri->nom});
    choix(L"Lumière", L, st.amb, [A, &st](const std::string& k) {
      st.amb = k;
      if (k != "hdri" && st.fond == "hdri") st.fond = "degrade";
      A->scene();
    });
  }
  boutons({{st.hdri ? L"Autre image HDRI…" : L"Importer une image HDRI…", [this, A] {
              wxFileDialog d(this, L"Image HDRI", wxEmptyString, wxEmptyString, L"Panorama HDR (*.hdr;*.exr)|*.hdr;*.exr", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
              if (d.ShowModal() != wxID_OK) return;
              wxString m;
              A->importerHdri(d.GetPath().ToStdWstring(), m);
              message(m);
            }}},
          1);
  curseur(L"Rotation", &st.envRot, 0, 360, 5, [](double v) { return wxString::Format(L"%d°", static_cast<int>(v)); }, scene);
  curseur(L"Reflets", &st.envInt, 0, 3, 0.05, v2, scene);
  curseur(L"Lampe", &st.lum, 0, 3, 0.05, v2, scene);
  curseur(L"Douceur", &st.douceur, 0, 20, 1, [](double v) { return v > 0 ? wxString::Format("%d", static_cast<int>(v)) : wxString(L"nette"); }, scene);
  curseur(L"Exposition", &st.ev, -3, 3, 0.1, [](double v) { return (v > 0 ? wxString("+") : wxString()) + virgule(v, 1) + L" EV"; }, fin);
  choix(L"Tons", {{"aces", L"Film (ACES)"}, {"doux", L"Doux (Reinhard)"}, {"cine", L"Cinéon"}, {"lin", L"Neutre (linéaire)"}}, st.tons, [A, &st](const std::string& k) {
    st.tons = k;
    A->finition();
  });

  titre(L"Fond et sol");
  {
    const auto f = [A, &st](const std::string& k) {
      st.fond = k;
      A->scene();
    };
    if (st.amb == "hdri" && st.hdri) {
      sousTitre(L"Fond");
      segments(wxEmptyString, {{"degrade", L"Dégradé"}, {"uni", L"Uni"}, {"studio", L"Studio"}, {"hdri", L"Image"}, {"transparent", L"Transp."}}, st.fond, f);
    } else segments(L"Fond", {{"degrade", L"Dégradé"}, {"uni", L"Uni"}, {"studio", L"Studio"}, {"transparent", L"Transp."}}, st.fond, f);
  }
  if (st.fond == "degrade" || st.fond == "uni") {
    auto* r = rang(L"Couleurs");
    couleur(r, &st.fc1, "#f2f3f5");
    if (st.fond == "degrade") couleur(r, &st.fc2, "#c3c7ce");
  }
  if (st.fond != "studio" && st.fond != "hdri") {
    const auto pre = [A, &st](const char* a, const char* b) {
      return [A, &st, a, b] {
        st.fc1 = a;
        st.fc2 = b;
        if (st.fond == "transparent") st.fond = "degrade";
        A->scene();
      };
    };
    boutons({{L"Blanc", pre("#f2f3f5", "#c3c7ce")}, {L"Gris", pre("#9aa0a8", "#4b5058")}, {L"Ardoise", pre("#3a4049", "#121417")}, {L"Noir", pre("#121214", "#000000")}, {L"Bleu nuit", pre("#24324a", "#0b111c")}}, 3);
  }
  sousTitre(st.fond == "studio" ? L"Studio" : L"Sol");
  if (st.fond == "studio") {
    auto* r = rang(L"Couleur");
    couleur(r, &st.solCol, "#d9dbdf");
    coche(r, L"Brillant", &st.miroir);
  } else {
    auto* r = rang(wxEmptyString);
    coche(r, L"Sol", &st.solOn);
    couleur(r, &st.solCol, st.fond == "degrade" ? st.fc2 : st.fond == "uni" ? st.fc1 : std::string("#9a9ea6"));
    coche(r, L"Miroir", &st.miroir);
    coche(r, L"Ombre", &st.ombreOn);
    curseur(L"Ombre", &st.ombre, 0, 1, 0.05, pct, scene);
    {
      auto* s = rang(L"Support");
      const SupportRendu* sup = st.support.empty() ? nullptr : supportRendu(st.support);
      const wxString nom = sup ? wxString(sup->nom) : wxString(L"Uni");
      auto* b = new BoutonEsquisse(defile_, wxID_ANY, L"Support", L"Matière du sol, à l'échelle réelle : pierre, bois, carrelage, métal, peintures, textiles, verres dépolis, LED…", BoutonEsquisse::ENCADRE);
      b->titre(nom);
      b->fond(FOND);
      b->SetMinSize(FromDIP(wxSize(-1, 24)));
      b->surClic = [this, b, A, &st] {
        wxMenu m;
        enum { UNI = wxID_HIGHEST + 1, BASE };
        const auto& L = supportsRendu();
        m.AppendCheckItem(UNI, L"Uni")->Check(st.support.empty());
        std::vector<std::wstring> ordre;
        std::map<std::wstring, wxMenu*> sous;
        for (size_t i = 0; i < L.size(); i++) {
          if (!sous.count(L[i].famille)) {
            sous[L[i].famille] = new wxMenu;
            ordre.push_back(L[i].famille);
          }
          sous[L[i].famille]->AppendCheckItem(BASE + static_cast<int>(i), L[i].nom)->Check(st.support == L[i].cle);
        }
        for (const auto& f : ordre) m.AppendSubMenu(sous[f], f);
        const int id = b->GetPopupMenuSelectionFromUser(m);
        if (id == wxID_NONE) return;
        aPres([A, &st, id] {
          st.support = id == UNI ? std::string() : std::string(supportsRendu()[id - BASE].cle);
          if (!st.support.empty()) st.solOn = true;
          A->scene();
        });
      };
      s->Add(b, 1);
    }
    boutons({{A->voirSols ? L"Cacher les sols" : L"Voir tous les sols", [A] { A->voirSols = !A->voirSols; }}}, 1);
    if (A->voirSols) {
      // Une vignette par sol, par famille
      std::wstring famille;
      wxBoxSizer* ligne = nullptr;
      int n = 0;
      const int cote = FromDIP(32), parLigne = 6;
      for (const SupportRendu& q : supportsRendu()) {
        if (famille != q.famille) {
          famille = q.famille;
          sousTitre(famille);
          n = 0;
        }
        if (n % parLigne == 0) ligne = rang(wxEmptyString);
        n++;
        const auto T = tuileSupport(q.cle, 48);
        wxImage im(48, 48);
        memcpy(im.GetData(), T->rgb.data(), T->rgb.size());
        const wxBitmap bm(im.Scale(cote, cote, wxIMAGE_QUALITY_BILINEAR));
        auto* v = new wxWindow(defile_, wxID_ANY, wxDefaultPosition, wxSize(cote, cote));
        v->SetBackgroundStyle(wxBG_STYLE_PAINT);
        v->SetToolTip(q.nom);
        const bool choisi = st.support == q.cle;
        v->Bind(wxEVT_PAINT, [v, bm, choisi](wxPaintEvent&) {
          wxAutoBufferedPaintDC dc(v);
          dc.DrawBitmap(bm, 0, 0);
          dc.SetBrush(*wxTRANSPARENT_BRUSH);
          dc.SetPen(wxPen(choisi ? BLEU : TRAIT, choisi ? v->FromDIP(2) : 1));
          dc.DrawRectangle(v->GetClientSize());
        });
        const std::string cle = q.cle;
        v->Bind(wxEVT_LEFT_UP, [this, A, &st, cle](wxMouseEvent&) {
          aPres([A, &st, cle] {
            st.support = cle;
            st.solOn = true;
            A->scene();
          });
        });
        ligne->Add(v, 0, wxRIGHT, FromDIP(3));
      }
    }
  }
  sousTitre(L"Dessin");
  segments(L"Arêtes", {{"non", L"Sans"}, {"cao", L"CAO"}}, st.aretes, [A, &st](const std::string& k) {
    st.aretes = k;
    A->scene();
  });

  titre(L"Appareil photo");
  {
    auto* s = rang(L"Focale");
    auto* c = new Curseur(defile_, st.focale, 14, 200, 1);
    auto* v = new wxStaticText(defile_, wxID_ANY, wxString::Format("%d mm", static_cast<int>(st.focale)), wxDefaultPosition, FromDIP(wxSize(46, -1)), wxALIGN_RIGHT | wxST_NO_AUTORESIZE);
    v->SetForegroundColour(DISCRET);
    s->Add(c, 1, wxEXPAND);
    s->Add(v, 0, wxALIGN_CENTER_VERTICAL);
    c->surValeur = [A, v](double f) {
      A->changerFocale(f);
      v->SetLabel(wxString::Format("%d mm", static_cast<int>(f)));
    };
  }
  {
    std::vector<std::pair<std::string, wxString>> L;
    for (int f : {24, 35, 50, 85, 135}) L.push_back({std::to_string(f), wxString::Format("%d", f)});
    segments(wxEmptyString, L, std::to_string(static_cast<int>(st.focale)), [A](const std::string& k) { A->changerFocale(std::stod(k)); });
  }
  {
    char t[16];
    snprintf(t, sizeof t, "%g", st.ouv);
    choix(L"Ouverture", {{"0", L"Tout net"}, {"1.4", L"f/1,4"}, {"2", L"f/2"}, {"2.8", L"f/2,8"}, {"4", L"f/4"}, {"5.6", L"f/5,6"}, {"8", L"f/8"}, {"11", L"f/11"}, {"16", L"f/16"}, {"22", L"f/22"}}, t, [A, &st](const std::string& k) {
      st.ouv = std::stod(k);
      A->scene();
    });
  }
  {
    auto* s = rang(L"Mise au point");
    auto* v = new wxStaticText(defile_, wxID_ANY, st.map > 0 ? wxString::Format("%d mm", static_cast<int>(std::lround(st.map))) : wxString(L"cible"));
    v->SetForegroundColour(DISCRET);
    s->Add(v, 1, wxALIGN_CENTER_VERTICAL | wxLEFT, FromDIP(8));
    if (st.map > 0) {
      auto* b = new BoutonEsquisse(defile_, wxID_ANY, L"Sur la cible", L"Sur la cible", BoutonEsquisse::ENCADRE);
      b->titre(L"Sur la cible");
      b->fond(FOND);
      b->SetMinSize(wxSize(GetTextExtent(L"Sur la cible").x + FromDIP(10), FromDIP(24)));
      b->surClic = [this, A, &st] {
        aPres([A, &st] {
          st.map = 0;
          A->scene();
        });
      };
      s->Add(b, 0);
    }
  }
  note(L"Clic sur la pièce : mise au point à cet endroit (visible avec une ouverture f/…).");
  boutons({{L"Cadrer la pièce", [A] { A->cadrer(); }}, {L"Reprendre la vue CAO", [A] { A->reprendreCao(); }}}, 2);

  titre(L"Vues enregistrées");
  {
    const bool a = A->docRendu.is_object() && A->docRendu.contains("cams") && A->docRendu["cams"].is_array() && !A->docRendu["cams"].empty();
    if (!a) note(L"Aucune vue enregistrée.");
    else {
      const int n = static_cast<int>(A->docRendu["cams"].size());
      for (int i = 0; i < n; i++) {
        const plan::J k = A->docRendu["cams"][i];
        auto* s = rang(wxEmptyString);
        const wxString nom = wxString::FromUTF8(k.value("n", std::string("Vue")));
        auto* b = new BoutonEsquisse(defile_, wxID_ANY, nom, wxString::Format(L"Aller à cette vue (focale %g mm)", k.value("f", 50.0)), BoutonEsquisse::ENCADRE);
        b->titre(nom);
        b->fond(FOND);
        b->SetMinSize(FromDIP(wxSize(-1, 24)));
        b->surClic = [this, A, k] { aPres([A, k] { A->allerVue(k); }); };
        auto* x = new BoutonEsquisse(defile_, wxID_ANY, L"×", wxString(L"Supprimer « ") + nom + L" »", BoutonEsquisse::ENCADRE);
        x->titre(L"×");
        x->fond(FOND);
        x->SetMinSize(FromDIP(wxSize(24, 24)));
        x->surClic = [this, A, i] {
          aPres([A, i] {
            A->docRendu["cams"].erase(static_cast<size_t>(i));
            if (A->docRendu["cams"].empty()) A->docRendu.erase("cams");
            if (A->surDoc) A->surDoc(A->docRendu);
          });
        };
        s->Add(b, 1, wxRIGHT, FromDIP(2));
        s->Add(x, 0);
      }
    }
    boutons({{L"+ Enregistrer la vue", [A] {
                if (!A->docRendu.is_object()) A->docRendu = plan::J::object();
                if (!A->docRendu.contains("cams")) A->docRendu["cams"] = plan::J::array();
                plan::J& cs = A->docRendu["cams"];
                if (cs.size() >= 40) return;
                int n = static_cast<int>(cs.size()) + 1;
                const auto pris = [&](int q) {
                  const std::string t = "Vue " + std::to_string(q);
                  for (const auto& c : cs)
                    if (c.value("n", std::string()) == t) return true;
                  return false;
                };
                while (pris(n)) n++;
                const auto r3 = [](double v) { return std::round(v * 1000) / 1000; };
                plan::J k;
                k["n"] = "Vue " + std::to_string(n);
                k["p"] = {r3(A->cam.oeil[0]), r3(A->cam.oeil[1]), r3(A->cam.oeil[2])};
                k["t"] = {r3(A->cam.cible[0]), r3(A->cam.cible[1]), r3(A->cam.cible[2])};
                k["u"] = {0, 0, 1};
                k["f"] = A->st.focale;
                cs.push_back(k);
                if (A->surDoc) A->surDoc(A->docRendu);
              }}},
            1);
  }

  titre(L"Matériaux et reliefs");
  {
    std::set<std::string> vues;  // une ligne par pièce d'occurrence, même répétée dans un sous-assemblage
    const auto& P = A->pieces();
    if (P.empty()) note(L"Aucune pièce à l'écran.");
    for (size_t i = 0; i < P.size(); i++) {
      if (P[i].id.empty() && P[i].occ.empty()) continue;
      if (!vues.insert(P[i].id + "|" + P[i].occ + "|" + P[i].bid).second) continue;
      const MatiereRendu* d = matiereRendu(P[i].cle);
      auto* l = new wxWindow(defile_, wxID_ANY, wxDefaultPosition, FromDIP(wxSize(-1, 26)));
      l->SetBackgroundStyle(wxBG_STYLE_PAINT);
      const wxString nom = wxString::FromUTF8(P[i].nom), m = wxString(d ? d->nom : L"sans matériau") + (P[i].propre ? L" •" : L"");
      const unsigned c = P[i].couleur;
      l->Bind(wxEVT_PAINT, [l, nom, m, c](wxPaintEvent&) {
        wxAutoBufferedPaintDC dc(l);
        dc.SetBackground(CHAMP);
        dc.Clear();
        const wxSize t = l->GetClientSize();
        const int q = l->FromDIP(12);
        dc.SetPen(wxPen(TRAIT));
        dc.SetBrush(wxBrush(wxColour((c >> 16) & 255, (c >> 8) & 255, c & 255)));
        dc.DrawRoundedRectangle(l->FromDIP(5), (t.y - q) / 2, q, q, l->FromDIP(3));
        dc.SetFont(l->GetFont());
        const int xn = l->FromDIP(23), lm = std::min(dc.GetTextExtent(m).x, t.x / 2);
        dc.SetTextForeground(TEXTE);
        const int hn = dc.GetCharHeight();
        dc.DrawText(wxControl::Ellipsize(nom, dc, wxELLIPSIZE_END, t.x - xn - lm - l->FromDIP(12)), xn, (t.y - hn) / 2);
        dc.SetTextForeground(DISCRET);
        dc.DrawText(wxControl::Ellipsize(m, dc, wxELLIPSIZE_END, lm), t.x - lm - l->FromDIP(5), (t.y - hn) / 2);
      });
      const int rangPiece = static_cast<int>(i);
      const auto clic = [this, A, l, rangPiece](wxMouseEvent&) {
        A->menuPiece(rangPiece, l);
        (void)this;
      };
      l->Bind(wxEVT_LEFT_UP, clic);
      l->Bind(wxEVT_RIGHT_UP, clic);
      racine_->Add(l, 0, wxEXPAND | wxLEFT | wxRIGHT | wxTOP, FromDIP(4));
    }
    note(L"Clic droit sur une pièce dans l'image (ou clic sur sa ligne) : matériau, couleur, relief, patine. • = apparence propre au rendu.");
  }

  titre(L"Finition");
  if (ray) curseur(L"Débruitage", &st.pDen, 0, 1, 0.01, pct, fin);
  curseur(L"Halo", &st.pHalo, 0, 1, 0.01, pct, fin);
  curseur(L"Vignettage", &st.pVig, 0, 1, 0.01, pct, fin);
  curseur(L"Grain", &st.pGrain, 0, 1, 0.01, pct, fin);
  curseur(L"Contraste", &st.pCon, -0.5, 0.5, 0.01, sg, fin);
  curseur(L"Saturation", &st.pSat, -1, 1, 0.01, sg, fin);
  curseur(L"Température", &st.pTemp, -1, 1, 0.01, [](double v) { return v < -0.02 ? wxString(L"froide") : v > 0.02 ? wxString(L"chaude") : wxString(L"neutre"); }, fin);
  {
    const auto pose = [A, &st](double h, double vi, double g, double c, double sa, double te) {
      return [=, &st] {
        st.pHalo = h, st.pVig = vi, st.pGrain = g, st.pCon = c, st.pSat = sa, st.pTemp = te;
        A->finition();
      };
    };
    boutons({{L"Neutre", pose(0, 0, 0, 0, 0, 0)}, {L"Photo", pose(0.3, 0.35, 0.2, 0.1, 0.05, 0)}, {L"Cinéma", pose(0.45, 0.55, 0.35, 0.2, -0.1, 0.35)}}, 3);
  }

  titre(L"Image");
  segments(L"Format", {{"1080", L"1920 × 1080"}, {"2160", L"4K"}}, st.res, [A, &st](const std::string& k) {
    st.res = k;
    A->memoriser();
  });
  {
    std::vector<std::pair<std::string, wxString>> L;
    for (int v : {16, 64, 256}) L.push_back({std::to_string(v), wxString::Format("%d", ray ? echantillons(v) : v)});
    segments(L"Qualité", L, std::to_string(static_cast<int>(st.ech)), [A, &st](const std::string& k) {
      st.ech = std::stod(k);
      A->memoriser();
    });
  }
  note(ray ? L"Échantillons : 128 brouillon · 512 bonne · 2048 haute. Le fond transparent (bloc Fond et sol) donne un PNG détouré." : L"Passes : 16 brouillon · 64 bonne · 256 haute. Le fond transparent (bloc Fond et sol) donne un PNG détouré.");
  {
    auto* r = rang(wxEmptyString);
    coche(r, L"Calques séparés (.zip)", &st.calques);
    if (st.calques) note(L"Archive .zip : beauté, masque, profondeur, normales, identifiants des corps, ombre — même cadrage.");
  }
  racine_->AddSpacer(FromDIP(8));

  ajusterDefile();
  defile_->Scroll(x, y);
  defile_->Thaw();
  pied();
}

// La largeur est celle du panneau : seule la hauteur défile
void PanneauRendu::ajusterDefile() {
  defile_->SetVirtualSize(defile_->GetClientSize().x, racine_->CalcMin().y);
  defile_->Layout();
}

void PanneauRendu::pied() {
  const ReglagesRendu& st = a_->st;
  resume_->SetLabel(wxString(st.res == "2160" ? L"3840 × 2160" : L"1920 × 1080") + L" · " + wxString::Format("%d", a_->nombrePasses()) + (st.moteur == "rayons" ? L" échantillons" : L" passes") + (st.fond == "transparent" ? L" · détouré" : L""));
  Layout();
}

void PanneauRendu::lancerExport() {
  const bool archive = a_->st.calques;
  wxFileDialog d(this, archive ? L"Enregistrer l'image et ses calques" : L"Enregistrer l'image", wxEmptyString, a_->GetName() + (archive ? L"-rendu - calques.zip" : L"-rendu.png"), archive ? L"Archive ZIP (*.zip)|*.zip" : L"Image PNG (*.png)|*.png", wxFD_SAVE | wxFD_OVERWRITE_PROMPT);
  if (d.ShowModal() != wxID_OK) return;
  message(a_->exporter(d.GetPath(), true));
}

bool PanneauRendu::essaiBouton(const wxString& libelle) {
  for (wxWindow* w : defile_->GetChildren())
    if (auto* b = dynamic_cast<BoutonEsquisse*>(w))
      if (b->GetLabel() == libelle && b->surClic) {
        b->surClic();
        return true;
      }
  return false;
}
