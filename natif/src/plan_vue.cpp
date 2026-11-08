// L'atelier Mise en plan : les éléments d'une planche (plan::dessiner) dessinés à l'écran, avec les mêmes styles que le navigateur.
#include "theme.h"
#include "plan_vue.h"

#include <wx/base64.h>
#include <wx/menu.h>
#include <wx/filedlg.h>
#include <wx/filename.h>
#include <wx/print.h>
#include <wx/wfstream.h>
#include <wx/zstream.h>
#ifdef _WIN32
#include <windows.h>
#endif
#undef near
#undef far
#undef min
#undef max
#include <wx/checkbox.h>
#include <wx/choice.h>
#include <wx/clrpicker.h>
#include <wx/dialog.h>
#include <wx/sizer.h>
#include <wx/spinctrl.h>
#include <wx/stattext.h>
#include <wx/dcbuffer.h>
#include <wx/dcmemory.h>
#include <wx/image.h>
#include <wx/log.h>
#include <wx/msgdlg.h>
#include <wx/mstream.h>
#include <wx/textdlg.h>
#include "nombres_js.h"
#include <wx/time.h>
#include <wx/stopwatch.h>

#include <algorithm>
#include <cmath>
#include <set>
#include <sstream>

namespace {
const double PI = 3.14159265358979323846;
using J = plan::J;

wxColour hex(const std::string& s) {
  wxColour c;
  c.Set(wxString::FromUTF8(s));
  return c;
}
// Les couleurs et les épaisseurs du papier (MEP_PAPER, mepThemeApply, mepLwApply)
struct Palette {
  std::string papier, bord, encre, encre2, cache, cadre, texte, hachure, filet, axe, libre, cotes;
  double thick = .72, thin = .42, hid = .42, dim = .55, ext = .55, axeL = .42, axeX = .62;
  double corpsCote = 7, corpsLbl = 7;
};
Palette paletteDe(const J& mep) {
  const plan::Style s = plan::styleDe(mep);
  Palette p;
  if (s.papier == "dark") {
    p.papier = "#1e2126", p.bord = "#3a3f47", p.encre = "#e9eaec", p.encre2 = "#9aa0a8", p.cache = "#8a9098", p.cadre = "#c9ccd1", p.texte = "#e9eaec", p.hachure = "#b0b4ba", p.filet = "#6c727a", p.axe = "#ff0000", p.libre = "#64d2ff", p.cotes = "#4da3ff";
  } else {
    p.papier = "#ffffff", p.bord = "#b9c0c9", p.encre = "#151515", p.encre2 = "#6a6f76", p.cache = "#59606a", p.cadre = "#222222", p.texte = "#111111", p.hachure = "#333333", p.filet = "#a4a9b0", p.axe = "#ff0000", p.libre = "#0a84ff", p.cotes = "#0a6fd8";
  }
  if (!s.couleurCotes.empty()) p.cotes = s.couleurCotes;
  p.thick = s.thick, p.thin = s.thin, p.hid = s.hid, p.dim = s.dim;
  p.ext = s.ext > 0 ? s.ext : s.dim;
  p.axeL = s.axis > 0 ? s.axis : s.thin;
  p.axeX = s.axis > 0 ? s.axis : .62;
  const plan::TaillesCotes t = plan::taillesCotes(mep);
  p.corpsCote = t.corpsCote, p.corpsLbl = t.corpsLbl;
  return p;
}
// Ce qu'un élément obtient de ses classes, de ses attributs et de son style
struct Rendu {
  std::string trait, fond;  // "" : aucun
  double largeur = 1, opacite = 1, corps = 16, halo = 0;
  bool gras = false;
  wxPenCap cap = wxCAP_BUTT;
  wxPenJoin join = wxJOIN_MITER;
  std::vector<double> tirets;
  std::string ancre = "start";
};
std::set<std::string> classesDe(const std::string& c) {
  std::set<std::string> o;
  std::istringstream f(c);
  std::string m;
  while (f >> m) o.insert(m);
  return o;
}
const std::string* attrDe(const plan::Elt& e, const char* k) {
  for (const auto& a : e.at)
    if (a.first == k) return &a.second;
  return nullptr;
}
double nombre(const plan::Elt& e, const char* k, double d = 0) {
  const std::string* a = attrDe(e, k);
  return a ? std::strtod(a->c_str(), nullptr) : d;
}
Rendu renduDe(const plan::Elt& e, const Palette& P) {
  Rendu r;
  // Le SVG sans style : texte et formes pleines en noir
  r.fond = "#000000";
  if (const std::string* a = attrDe(e, "fill")) r.fond = *a == "none" ? "" : *a;
  if (const std::string* a = attrDe(e, "stroke")) r.trait = *a == "none" ? "" : *a;
  if (const std::string* a = attrDe(e, "stroke-width")) r.largeur = std::strtod(a->c_str(), nullptr);
  if (const std::string* a = attrDe(e, "font-size")) r.corps = std::strtod(a->c_str(), nullptr);
  if (const std::string* a = attrDe(e, "text-anchor")) r.ancre = *a;
  const std::string* cl = attrDe(e, "class");
  const std::set<std::string> C = cl ? classesDe(*cl) : std::set<std::string>();
  const auto a = [&](const char* n) { return C.count(n) > 0; };
  const auto trace = [&](const std::string& t, double l, const std::string& f = "") {
    r.trait = t, r.largeur = l, r.fond = f;
  };
  // Dans l'ordre de la feuille de style : la dernière règle l'emporte
  if (a("mepPage")) trace(P.bord, .5, P.papier);
  if (a("mepFrame")) trace(P.cadre, .9);
  if (a("mepFrame2")) trace(P.cadre, .45), r.tirets = {1.5, 2.5}, r.opacite = .6;
  if (a("mepTitleBlock")) trace(P.cadre, .8, P.papier);
  if (a("mepTitleText")) r.corps = 5, r.fond = P.texte;
  if (a("mepTitleVal")) r.corps = 7.5, r.fond = P.texte, r.gras = true;
  if (a("mepRevText")) r.corps = 3.6, r.fond = P.texte;
  if (a("mepEnt")) r.fond = "", r.cap = wxCAP_ROUND, r.join = wxJOIN_ROUND;
  if (a("mepSharp")) r.trait = P.encre, r.largeur = P.thick;
  if (a("mepTangent")) r.trait = P.encre2, r.largeur = P.thin, r.opacite = .92;
  if (a("mepBrk")) r.trait = P.encre, r.largeur = P.thin, r.fond = "", r.join = wxJOIN_ROUND;
  if (a("mepHidden")) r.trait = P.cache, r.largeur = P.hid, r.tirets = {2, 1.2}, r.cap = wxCAP_BUTT;
  if (a("mepSect")) r.trait = P.encre, r.largeur = P.thick * 1.22;
  if (a("mepThread")) r.fond = "", r.trait = P.filet, r.largeur = P.thin * .7;
  if (a("mepHatch")) r.trait = P.hachure, r.largeur = P.thin;
  if (a("mepHatch") && a("mepHatchFill")) r.fond = P.hachure, r.trait = "";
  if (a("mepDimL")) r.trait = P.cotes, r.largeur = P.dim, r.fond = "";
  if (a("mepDimL") && a("mepDimX")) r.largeur = P.ext;
  if (a("mepDimT")) r.corps = P.corpsCote, r.fond = P.cotes, r.gras = true, r.halo = 1.5;
  if (a("mepDimSel")) {
    if (a("mepDimL")) r.trait = "#ff3b30";
    else r.fond = "#ff3b30";
  }
  if (a("mepDimRef")) r.fond = P.cache;
  if (a("mepLbl")) r.corps = P.corpsLbl, r.fond = P.texte, r.gras = true, r.halo = 1.6;
  if (a("mepCutLine")) r.trait = P.encre, r.largeur = P.thin, r.tirets = {10, 2, 1.5, 2}, r.fond = "";
  if (a("mepCutEnd")) r.trait = P.encre, r.largeur = P.thick, r.fond = "", r.cap = wxCAP_BUTT;
  if (a("mepCutArr")) r.trait = P.encre, r.largeur = P.thin, r.fond = "";
  if (a("mepCutLbl")) r.fond = P.encre;
  if (a("mepFrameTxt")) r.fond = P.texte;
  if (a("mepDetailC")) r.trait = P.encre, r.largeur = P.thin, r.fond = "";
  if (a("mepDetailB")) r.trait = P.encre, r.largeur = P.thin, r.fond = "", r.tirets = {6, 1.5, 1, 1.5};
  if (a("mepSk")) r.fond = "", r.cap = wxCAP_ROUND;
  if (a("mepTbLine")) r.trait = P.cadre, r.largeur = P.thin, r.fond = "", r.cap = wxCAP_PROJECTING;
  if (a("mepTbThick") || a("mepSkThick")) r.largeur = P.thick;
  if (a("mepSkThin")) r.largeur = P.thin;
  if (a("mepLtHid")) r.tirets = {2, 1.2}, r.cap = wxCAP_BUTT;
  if (a("mepLtAxis")) r.tirets = {8, 2, 1.5, 2}, r.cap = wxCAP_BUTT;
  if (a("mepSkFull")) r.trait = P.encre;
  if (a("mepSkFree")) r.trait = P.libre;
  if (a("mepAxis")) r.fond = "", r.trait = P.axe, r.largeur = P.axeL, r.tirets = {8, 2, 1.5, 2}, r.cap = wxCAP_BUTT, r.join = wxJOIN_ROUND;
  if (a("mepAxisCross")) r.fond = "", r.trait = P.axe, r.largeur = P.axeX, r.cap = wxCAP_BUTT;
  // L'attribut style passe après la feuille de style
  if (const std::string* st = attrDe(e, "style")) {
    std::istringstream f(*st);
    std::string reg;
    while (std::getline(f, reg, ';')) {
      const size_t d = reg.find(':');
      if (d == std::string::npos) continue;
      std::string k = reg.substr(0, d), v = reg.substr(d + 1);
      if (k == "font-size") r.corps = std::strtod(v.c_str(), nullptr);
      else if (k == "fill") r.fond = v == "none" ? "" : v;
      else if (k == "stroke") r.trait = v == "none" ? "" : v;
      else if (k == "stroke-width") {
        const double w = std::strtod(v.c_str(), nullptr);
        if (r.halo > 0) r.halo = w;
        else r.largeur = w;
      } else if (k == "text-anchor") r.ancre = v;
    }
  }
  return r;
}
// Un chemin SVG (M, L, A, H, V, Z) en lignes brisées, assez fines pour le zoom le plus fort
void cheminEnPoints(const std::string& d, std::vector<std::vector<std::array<double, 2>>>& out, double tol = 0.004) {
  std::istringstream f;
  size_t i = 0;
  const auto suivant = [&](double& v) {
    while (i < d.size() && (d[i] == ' ' || d[i] == ',')) i++;
    char* fin = nullptr;
    v = std::strtod(d.c_str() + i, &fin);
    const size_t lu = static_cast<size_t>(fin - (d.c_str() + i));
    i += lu;
    return lu > 0;
  };
  char cmd = 0;
  double cx = 0, cy = 0;
  while (i < d.size()) {
    while (i < d.size() && (d[i] == ' ' || d[i] == ',')) i++;
    if (i >= d.size()) break;
    if (std::isalpha(static_cast<unsigned char>(d[i]))) cmd = d[i++];
    if (cmd == 'M') {
      double x, y;
      if (!suivant(x) || !suivant(y)) break;
      out.emplace_back();
      out.back().push_back({x, y});
      cx = x, cy = y;
      cmd = 'L';
    } else if (cmd == 'L' || cmd == 'H' || cmd == 'V') {
      double x = cx, y = cy;
      if (cmd != 'V' && !suivant(x)) break;
      if (cmd != 'H' && !suivant(y)) break;
      if (out.empty()) out.emplace_back();
      out.back().push_back({x, y});
      cx = x, cy = y;
    } else if (cmd == 'A') {
      double rx, ry, rot, gd, sens, x, y;
      if (!suivant(rx) || !suivant(ry) || !suivant(rot) || !suivant(gd) || !suivant(sens) || !suivant(x) || !suivant(y)) break;
      if (out.empty()) out.emplace_back();
      // Les arcs du plan sont des cercles : rx = ry
      const double dx = (cx - x) / 2, dy = (cy - y) / 2, r0 = std::max(rx, 1e-9);
      const double d2 = dx * dx + dy * dy, r = std::max(r0, std::sqrt(d2));
      const double k = std::sqrt(std::max(0.0, (r * r - d2) / std::max(d2, 1e-18))) * ((gd != 0) == (sens != 0) ? -1 : 1);
      const double xc = (cx + x) / 2 + k * dy, yc = (cy + y) / 2 - k * dx;
      const double a0 = std::atan2(cy - yc, cx - xc);
      double a1 = std::atan2(y - yc, x - xc);
      if (sens != 0 && a1 < a0) a1 += 2 * PI;
      if (sens == 0 && a1 > a0) a1 -= 2 * PI;
      const double pas = r > tol ? 2 * std::acos(1 - tol / r) : PI / 2;
      const int n = std::min(tol < 0.004 ? 4096 : 256, std::max(1, static_cast<int>(std::ceil(std::abs(a1 - a0) / std::max(pas, 1e-4)))));
      for (int q = 1; q < n; q++) {
        const double t = a0 + (a1 - a0) * q / n;
        out.back().push_back({xc + r * std::cos(t), yc + r * std::sin(t)});
      }
      out.back().push_back({x, y});
      cx = x, cy = y;
    } else if (cmd == 'Z' || cmd == 'z') {
      if (!out.empty() && !out.back().empty()) out.back().push_back(out.back().front());
      cmd = 0;
    } else {
      break;
    }
  }
}
// Le pointillé est découpé ici : il suit les mm de la feuille à tous les zooms
void decouper(const std::vector<std::array<double, 2>>& pts, const std::vector<double>& motif, std::vector<std::vector<std::array<double, 2>>>& out) {
  double tot = 0;
  for (double m : motif) tot += m;
  if (motif.empty() || tot <= 0) {
    out.push_back(pts);
    return;
  }
  size_t rang = 0;
  double reste = motif[0];
  bool plein = true;
  std::vector<std::array<double, 2>> cur;
  if (!pts.empty()) cur.push_back(pts[0]);
  for (size_t i = 0; i + 1 < pts.size(); i++) {
    double ax = pts[i][0], ay = pts[i][1];
    const double bx = pts[i + 1][0], by = pts[i + 1][1];
    double L = std::hypot(bx - ax, by - ay);
    if (L <= 0) continue;
    const double ux = (bx - ax) / L, uy = (by - ay) / L;
    while (L > reste) {
      ax += ux * reste, ay += uy * reste;
      L -= reste;
      if (plein) {
        cur.push_back({ax, ay});
        out.push_back(cur);
        cur.clear();
      } else {
        cur.clear();
        cur.push_back({ax, ay});
      }
      plein = !plein;
      rang = (rang + 1) % motif.size();
      reste = motif[rang];
    }
    reste -= L;
    if (plein) cur.push_back({bx, by});
  }
  if (plein && cur.size() > 1) out.push_back(cur);
}
void fleche(std::vector<std::array<double, 2>>& tri, double px, double py, double dx, double dy, double lg, double h, bool bout) {
  // bout : la pointe sur le point d'arrivée, la base en arrière ; sinon la pointe au départ, la base en avant
  const double L = std::hypot(dx, dy);
  if (L < 1e-12) return;
  const double ux = dx / L, uy = dy / L, sg = bout ? -1 : 1;
  const double bx = px + ux * lg * sg, by = py + uy * lg * sg;
  tri = {{px, py}, {bx - uy * h, by + ux * h}, {bx + uy * h, by - ux * h}, {px, py}};
}
std::shared_ptr<wxBitmap> imageDe(const std::string& href) {
  const size_t v = href.find("base64,");
  if (v == std::string::npos) return nullptr;
  const wxMemoryBuffer b = wxBase64Decode(wxString::FromUTF8(href.substr(v + 7)));
  if (b.GetDataLen() == 0) return nullptr;
  wxMemoryInputStream f(b.GetData(), b.GetDataLen());
  if (!wxImage::FindHandler(wxBITMAP_TYPE_PNG)) wxInitAllImageHandlers();
  wxImage im;
  wxLogNull silence;
  if (!im.LoadFile(f, wxBITMAP_TYPE_ANY) || !im.IsOk()) return nullptr;
  return std::make_shared<wxBitmap>(im);
}
}  // namespace

PlanVue::PlanVue(wxWindow* parent) : wxWindow(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxWANTS_CHARS) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  SetCursor(wxCursor(wxCURSOR_CROSS));
  calcul_.rendreImage = [this](const plan::DemandeImage& d) {
    wxImage im;
    if (rendreImage && rendreImage(d, im) && im.IsOk()) images3d_[d.cle] = std::make_shared<wxBitmap>(im);
  };
  Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    const wxSize t = GetClientSize();
    if (ajuster_) ajusterFeuille();
    if (aConstruire_) {
      redessiner();
      imageBonne_ = false;
    }
    if (!imageBonne_ || !image_.IsOk() || image_.GetWidth() != t.x || image_.GetHeight() != t.y) {
      image_ = wxBitmap(std::max(1, t.x), std::max(1, t.y), 24);
      wxMemoryDC m(image_);
      m.SetBackground(wxBrush(theme::palette(theme::courant()).bureau));
      m.Clear();
      {
        std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::Create(m));
        if (g) peindre(*g);
      }
      m.SelectObject(wxNullBitmap);
      imageBonne_ = true;
    }
    dc.SetBackground(wxBrush(theme::palette(theme::courant()).bureau));
    dc.Clear();
    dc.DrawBitmap(image_, decalage_.x, decalage_.y);
    peindreSelection(dc);
    peindreRegles(dc, t);
    // Les onglets restent en place pendant qu'on déplace la feuille
    const int ho = hauteurOnglets();
    dc.SetPen(*wxTRANSPARENT_PEN);
    dc.SetBrush(wxBrush(th(wxColour(0x1c, 0x1e, 0x23))));
    dc.DrawRectangle(0, 0, t.x, ho);
    onglets_.clear();
    const J& sheets = mep_.is_object() && mep_.contains("sheets") ? mep_["sheets"] : J();
    if (sheets.is_array()) {
      dc.SetFont(GetFont());
      int x = FromDIP(8);
      for (int i = 0; i < static_cast<int>(sheets.size()); i++) {
        const J& s = sheets[i];
        std::string nom = s.is_object() && s.contains("name") && s["name"].is_string() ? s["name"].get<std::string>() : "Planche";
        // mepFmtCode : le format et son sens
        if (s.is_object() && s.contains("format") && s["format"].is_string()) {
          const std::string f = s["format"].get<std::string>();
          nom += " · " + f;
          if (f != "Manuel") nom += s.contains("orient") && s["orient"].is_string() && s["orient"].get<std::string>() == "landscape" ? "H" : "V";
        }
        const wxString lib = wxString::FromUTF8(nom);
        const wxSize tl = dc.GetTextExtent(lib);
        const wxRect r(x, FromDIP(4), tl.x + FromDIP(18), ho - FromDIP(4));
        const bool actif = i == planche_;
        dc.SetBrush(wxBrush(actif ? th(wxColour(0x2b, 0x2e, 0x34)) : th(wxColour(0x1c, 0x1e, 0x23))));
        dc.SetPen(wxPen(th(wxColour(0x3a, 0x3f, 0x47))));
        dc.DrawRoundedRectangle(r.x, r.y, r.width, r.height + FromDIP(4), FromDIP(5));
        dc.SetTextForeground(actif ? th(wxColour(0x4d, 0xa3, 0xff)) : th(wxColour(0xc9, 0xcc, 0xd1)));
        dc.DrawText(lib, r.x + FromDIP(9), r.y + (r.height - tl.y) / 2);
        onglets_.push_back(r);
        x = r.GetRight() + FromDIP(3);
      }
      actionsOnglets_.clear();
      for (const wchar_t* lab : {L"＋", L"⧉", L"🗑"}) {
        const wxRect r(x + FromDIP(2), FromDIP(5), FromDIP(24), ho - FromDIP(9));
        dc.SetBrush(wxBrush(th(wxColour(0x2b, 0x2e, 0x34))));
        dc.SetPen(wxPen(th(wxColour(0x3a, 0x3f, 0x47))));
        dc.DrawRoundedRectangle(r, FromDIP(4));
        dc.SetTextForeground(th(wxColour(0xc9, 0xcc, 0xd1)));
        const wxSize tl = dc.GetTextExtent(lab);
        dc.DrawText(lab, r.x + (r.width - tl.x) / 2, r.y + (r.height - tl.y) / 2);
        actionsOnglets_.push_back(r);
        x = r.GetRight() + FromDIP(1);
      }
    }
  });
  Bind(wxEVT_SIZE, [this](wxSizeEvent& e) {
    ajuster_ = true;
    imageBonne_ = false;
    Refresh();
    e.Skip();
  });
  Bind(wxEVT_MOUSEWHEEL, [this](wxMouseEvent& e) {
    const bool inverse = mep_.is_object() && mep_.contains("prefs") && mep_["prefs"].is_object() && mep_["prefs"].contains("ls") && mep_["prefs"]["ls"].value("minifusion_mepZoomRev", std::string()) == "1";
    const double f = std::pow(1.0015, inverse ? -e.GetWheelRotation() : e.GetWheelRotation());
    const double z2 = std::max(0.05, std::min(400.0, zoom_ * f));
    const wxPoint p = e.GetPosition();
    ox_ = p.x - (p.x - ox_) * z2 / zoom_;
    oy_ = p.y - (p.y - oy_) * z2 / zoom_;
    zoom_ = z2;
    ajuster_ = false;
    imageBonne_ = false;
    Refresh();
  });
  const auto saisir = [this](wxMouseEvent& e) {
    saisie_ = e.GetPosition();
    glisse_ = true;
    if (!HasCapture()) CaptureMouse();
    SetCursor(wxCursor(wxCURSOR_SIZING));
  };
  const auto lacher = [this](wxMouseEvent&) {
    if (!glisse_) return;
    glisse_ = false;
    if (HasCapture()) ReleaseMouse();
    SetCursor(wxCursor(wxCURSOR_CROSS));
    ox_ += decalage_.x, oy_ += decalage_.y;
    decalage_ = wxPoint();
    ajuster_ = false;
    imageBonne_ = false;
    Refresh();
  };
  Bind(wxEVT_MIDDLE_DOWN, saisir);
  Bind(wxEVT_MIDDLE_UP, lacher);
  Bind(wxEVT_MOUSE_CAPTURE_LOST, [this](wxMouseCaptureLostEvent&) { glisse_ = false; });
  Bind(wxEVT_LEAVE_WINDOW, [this](wxMouseEvent& e) {
    curseurDedans_ = false;
    Refresh(false);
    e.Skip();
  });
  Bind(wxEVT_MOTION, [this](wxMouseEvent& e) {
    struct Differer {
      bool& b;
      ~Differer() { b = false; }
    } differer{differer_ = true};
    curseurX_ = (e.GetX() - ox_) / zoom_, curseurY_ = (e.GetY() - oy_) / zoom_;
    curseurDedans_ = e.GetY() >= hauteurOnglets() && curseurX_ >= 0 && curseurY_ >= 0 && curseurX_ <= largeurPage_ && curseurY_ <= hauteurPage_;
    if (!glisse_) {
      if (commandeActive_) {
        commande_.curX = curseurX_, commande_.curY = curseurY_, commande_.aCur = true, commande_.maj = e.ShiftDown();
      } else if (outilActif_ && geste_.sorte == Geste::RIEN && plan::estOutilEsquisse(outil_.tool)) {
        plan::survolEsquisse(mep_, planche_, piece_, calcul_, esq_, outil_, curseurX_, curseurY_, 7 / zoom_, zoomRelatif());
      } else if (outilActif_ && geste_.sorte == Geste::RIEN) {
        if (plan::survolOutil(mep_, planche_, piece_, calcul_, outil_, curseurX_, curseurY_, zoomRelatif())) redessiner();
      } else if (geste_.sorte != Geste::RIEN) {
        bouge(curseurX_, curseurY_, e.GetX(), e.GetY());
      } else if (mep_.is_object() && mep_.contains("sheets") && !mep_["sheets"].empty()) {
        // Le survol : un cadre en pointillés autour de la vue
        const std::string s = curseurDedans_ ? plan::vueSous(planche(), mep_, piece_, calcul_, curseurX_, curseurY_) : std::string();
        vueSurvol_ = s;
        esq_.hov = curseurDedans_ && plan::editionEsquisse(esq_, std::string(), sel_) ? plan::esquisseSous(mep_, planche_, piece_, calcul_, esq_, std::string(), sel_, curseurX_, curseurY_, 7 / zoom_) : std::string();
      }
      Refresh(false);
      e.Skip();
      return;
    }
    decalage_ = e.GetPosition() - saisie_;
    Refresh(false);
  });
  Bind(wxEVT_MIDDLE_DCLICK, [this](wxMouseEvent&) {
    ajuster_ = true;
    imageBonne_ = false;
    Refresh();
  });
  Bind(wxEVT_LEFT_DOWN, [this](wxMouseEvent& e) {
    SetFocus();
    const int i = ongletSous(e.GetPosition());
    if (i >= 0) return changerPlanche(i);
    for (size_t a = 0; a < actionsOnglets_.size(); a++) {
      if (!actionsOnglets_[a].Contains(e.GetPosition())) continue;
      if (a == 0) boutonRuban(L"Nouvelle");
      else if (a == 1) boutonRuban(L"Dupliquer");
      else if (mep_["sheets"].size() <= 1) {
        if (surEtat) surEtat(L"Il faut garder au moins une planche.");
      } else if (wxMessageBox(wxString(L"Supprimer « ") + wxString::FromUTF8(planche().value("name", std::string())) + L" » et toutes ses vues ?", L"Supprimer la planche", wxYES_NO | wxICON_QUESTION, this) == wxYES) {
        mep_["sheets"].erase(mep_["sheets"].begin() + planche_);
        mep_["cur"] = std::max(0, planche_ - 1);
        apresPlanche();
        valider(L"suppression de planche");
      }
      return;
    }
    if (e.GetY() < hauteurOnglets() || !mep_.is_object() || !mep_.contains("sheets") || mep_["sheets"].empty()) return;
    if (!HasCapture()) CaptureMouse();
    enfonce((e.GetX() - ox_) / zoom_, (e.GetY() - oy_) / zoom_, e.ShiftDown(), e.ControlDown(), e.GetX(), e.GetY());
  });
  Bind(wxEVT_LEFT_UP, [this](wxMouseEvent&) {
    if (HasCapture()) ReleaseMouse();
    relache();
  });
  Bind(wxEVT_RIGHT_UP, [this](wxMouseEvent& e) {
    if (e.GetY() < hauteurOnglets()) return e.Skip();
    SetFocus();
    menuContextuel((e.GetX() - ox_) / zoom_, (e.GetY() - oy_) / zoom_, "");
  });
  Bind(wxEVT_LEFT_DCLICK, [this](wxMouseEvent& e) {
    const int i = ongletSous(e.GetPosition());
    if (i >= 0) {  // mepTabsRender : renommer
      changerPlanche(i);
      wxTextEntryDialog dlg(this, L"Nom de la planche :", L"Planche", wxString::FromUTF8(planche().value("name", std::string())));
      if (dlg.ShowModal() == wxID_OK && !dlg.GetValue().empty()) {
        planche()["name"] = dlg.GetValue().utf8_string();
        valider(L"renommer planche");
        Refresh(false);
      }
      return;
    }
    wxMouseEvent appui(e);
    appui.SetEventType(wxEVT_LEFT_DOWN);
    GetEventHandler()->ProcessEvent(appui);
  });
  Bind(wxEVT_KEY_DOWN, [this](wxKeyEvent& e) {
    const int k = e.GetKeyCode();
    if (e.ControlDown() && !e.AltDown() && k == 'P') return imprimer();  // le raccourci de la planche
    if (k == WXK_ESCAPE) return void(echap());
    if (outilActif_) {
      if (outil_.tool == "axis" && (k == WXK_RETURN || k == WXK_NUMPAD_ENTER)) {
        std::string lib;
        const std::string t = plan::validerMotifAxe(mep_, planche_, piece_, calcul_, outil_, lib);
        if (!lib.empty()) {
          redessiner();
          valider(wxString::FromUTF8(lib));
        }
        if (surEtat && !t.empty()) surEtat(wxString::FromUTF8(t));
        return;
      }
      if ((k == WXK_RETURN || k == WXK_NUMPAD_ENTER) && (!outil_.ord.empty() || outil_.tool == "ordx" || outil_.tool == "ordy")) {
        quitterOutil();
        if (surEtat) surEtat(L"Cotation d’ordonnées terminée.");
        return;
      }
    }
    if (commandeActive_) {
      if (k == WXK_RETURN || k == WXK_NUMPAD_ENTER) {
        const std::string m = plan::validerCoupe(commande_);
        if (surEtat && !m.empty()) surEtat(wxString::FromUTF8(m));
        return Refresh(false);
      }
      if (k == WXK_BACK) {
        const std::string m = plan::annulerPointCoupe(commande_);
        if (surEtat && !m.empty()) surEtat(wxString::FromUTF8(m));
        return Refresh(false);
      }
    }
    if (k == WXK_DELETE || k == WXK_BACK) return supprimer();
    if (k == 'F' && e.ShiftDown()) {
      ajuster_ = true;
      imageBonne_ = false;
      return Refresh();
    }
    if (!e.ControlDown() && !e.AltDown()) {  // mepOnKey : les outils au clavier
      if (k == 'X' && !sel_.skSel.empty()) {  // lignes, cercles, arcs choisis ↔ construction
        std::vector<plan::J*> G;
        for (const std::string& c : sel_.skSel) {
          if (c.rfind("e:", 0) != 0) continue;
          plan::J* q = plan::elementEsquisse(planche(), esq_, c.substr(2));
          const std::string t = q ? q->value("t", std::string()) : "";
          if (t == "line" || t == "circle" || t == "arc") G.push_back(q);
        }
        if (!G.empty()) {
          bool tous = true;
          for (const plan::J* q : G)
            if (!q->value("cst", false)) tous = false;
          for (plan::J* q : G) {
            if (tous) q->erase("cst");
            else (*q)["cst"] = true;
          }
          redessiner();
          valider(tous ? L"trait normal" : L"construction");
          if (surEtat) surEtat(wxString::Format(L"%zu élément(s) ", G.size()) + (tous ? L"redevenu(s) normal(aux)." : L"en construction (invisibles hors édition)."));
          if (surSelection) surSelection();
        }
        return;
      }
      const char* outil = nullptr;
      switch (k) {
        case 'L': outil = "line"; break;
        case 'R': outil = e.ShiftDown() ? "rect" : "dim"; break;
        case 'C': outil = "circle"; break;
        case 'A': outil = "arc"; break;
        case 'P': outil = "point"; break;
        case 'T': outil = "trim"; break;
        case 'D': outil = "dim"; break;
        case 'H': outil = "hole"; break;
        case 'X': outil = "axis"; break;
        default: break;
      }
      if (outil) return lancerOutil(outil);
      if (k == 'V') {
        if (outilActif_) quitterOutil();
        return;
      }
    }
    e.Skip();
  });
}

int PlanVue::hauteurOnglets() const { return FromDIP(30); }

// ---- Le ruban : planches, nouvelles vues ----
void PlanVue::lancerCommande(const std::string& kind) {
  geste_ = Geste();
  outilActif_ = false;
  outil_ = plan::OutilPlan();
  // Sur une planche vide, les vues de départ arrivent d'abord (mepSetActive)
  bool rempli = false;
  try {
    rempli = plan::vuesAutomatiques(mep_, planche_, piece_, calcul_);
  } catch (const std::exception&) {
  }
  if (rempli) {
    const J& vs = planche()["views"];
    sel_ = plan::SelectionPlan();
    sel_.vue = vs.back().value("id", std::string());  // la dernière vue ajoutée reste choisie
    redessiner();
    if (surVuesAutomatiques) surVuesAutomatiques(mep_);
  }
  commande_ = plan::commencerCommande(planche(), kind, sel_.vue);
  commandeActive_ = true;
  if (surEtat) surEtat(wxString::FromUTF8(plan::conseilCommande(commande_)));
  Refresh(false);
}
void PlanVue::supprimerPointOrdonnee(const std::string& id, int i) {
  J* d = plan::coteParId(planche(), id);
  if (!d || !(*d)["pts"].is_array() || i < 0 || i >= static_cast<int>((*d)["pts"].size())) return;
  (*d)["pts"].erase(i);
  sel_.ordCote.clear(), sel_.ordPt = -2;
  if (surEtat) surEtat(wxString::Format(L"Point d’ordonnée supprimé (%zu restant(s)).", (*d)["pts"].size()));
  redessiner();
  valider(L"point d’ordonnée supprimé");
  if (surSelection) surSelection();
}
void PlanVue::supprimerLocale(const std::string& vid, const std::string& id) {  // mepLocDelete
  J* v = plan::vueParId(planche(), vid);
  if (!v || !v->contains("locals")) return;
  J reste = J::array();
  for (J& l : (*v)["locals"])
    if (l.value("id", std::string()) != id) reste.push_back(std::move(l));
  if (reste.empty()) v->erase("locals");
  else (*v)["locals"] = std::move(reste);
  sel_.locVue.clear(), sel_.locId.clear();
  redessiner();
  valider(L"suppression coupe locale");
  if (surEtat) surEtat(L"Coupe locale supprimée (Ctrl+Z pour la rétablir).");
  if (surSelection) surSelection();
}
void PlanVue::retirerPointLocale(const std::string& vid, const std::string& id, int i) {  // mepLocDelPt
  J* l = plan::coupeLocale(planche(), vid, id);
  if (!l) return;
  if ((*l)["pts"].size() <= 3) {
    if (surEtat) surEtat(L"Coupe locale : 3 points au moins — Suppr supprime la coupe entière.");
    return;
  }
  (*l)["pts"].erase(i);
  redessiner();
  valider(L"coupe locale : point retiré");
  if (surEtat) surEtat(L"Coupe locale : point retiré.");
}
void PlanVue::changerAreteLocale(const std::string& vid, const std::string& id) {  // mepBeginLocal(locId)
  lancerCommande("local");
  commande_.par = vid, commande_.loc = id, commande_.stage = 2;
  if (surEtat) surEtat(wxString::FromUTF8(plan::conseilCommande(commande_)));
  Refresh(false);
}
void PlanVue::choisirLocale(const std::string& vid, const std::string& id) {
  sel_ = plan::SelectionPlan();
  sel_.vue = vid, sel_.locVue = vid, sel_.locId = id;
  redessiner();
  if (surSelection) surSelection();
}
// mepHatchDialog : motif, angle, échelle, couleur — validé pour TOUTES les coupes
void PlanVue::dialogueHachures() {
  const plan::J h = mep_.contains("hatch") && mep_["hatch"].is_object() ? mep_["hatch"] : plan::J::object();
  wxDialog dlg(this, wxID_ANY, L"Hachures des coupes");
  auto* sz = new wxBoxSizer(wxVERTICAL);
  auto* gr = new wxFlexGridSizer(2, FromDIP(6), FromDIP(8));
  gr->AddGrowableCol(1);
  const std::vector<std::pair<const char*, const wchar_t*>> pats = {{"iso", L"Usage général (ISO 128-50)"}, {"acier", L"Acier — traits doubles"}, {"cuivre", L"Cuivre, bronze — trait + tireté"}, {"alu", L"Alliages légers — quadrillé"}, {"plast", L"Plastique, caoutchouc — tireté"}, {"plein", L"Plein (section mince)"}};
  auto* motif = new wxChoice(&dlg, wxID_ANY);
  int cur = 0;
  for (size_t i = 0; i < pats.size(); i++) {
    motif->Append(pats[i].second);
    if (h.value("pat", std::string()) == pats[i].first) cur = static_cast<int>(i);
  }
  motif->SetSelection(cur);
  const double a0 = h.contains("ang") && h["ang"].is_number() ? std::fmod(std::fmod(h["ang"].get<double>(), 180) + 180, 180) : 45;
  const double s0 = h.contains("sc") && h["sc"].is_number() && h["sc"].get<double>() > 0 ? std::min(10.0, std::max(0.1, h["sc"].get<double>())) : 1;
  auto* angle = new wxSpinCtrlDouble(&dlg, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxSP_ARROW_KEYS, -360, 360, a0, 15);
  auto* echelle = new wxSpinCtrlDouble(&dlg, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxSP_ARROW_KEYS, 0.1, 10, s0, 0.25);
  const std::string c0 = h.value("col", std::string());
  auto* couleur = new wxColourPickerCtrl(&dlg, wxID_ANY, c0.empty() ? th(wxColour(0x33, 0x33, 0x33)) : wxColour(wxString::FromUTF8(c0)));
  auto* theme = new wxCheckBox(&dlg, wxID_ANY, L"couleur du thème");
  theme->SetValue(c0.empty());
  couleur->Bind(wxEVT_COLOURPICKER_CHANGED, [theme](wxColourPickerEvent&) { theme->SetValue(false); });
  auto* pieces = new wxCheckBox(&dlg, wxID_ANY, L"Une hachure par pièce (angle alterné)");
  pieces->SetValue(!(h.contains("parts") && h["parts"].is_boolean() && !h["parts"].get<bool>()));
  gr->Add(new wxStaticText(&dlg, wxID_ANY, L"Motif"), 0, wxALIGN_CENTER_VERTICAL);
  gr->Add(motif, 1, wxEXPAND);
  gr->Add(new wxStaticText(&dlg, wxID_ANY, L"Angle (°)"), 0, wxALIGN_CENTER_VERTICAL);
  gr->Add(angle, 1, wxEXPAND);
  gr->Add(new wxStaticText(&dlg, wxID_ANY, L"Échelle"), 0, wxALIGN_CENTER_VERTICAL);
  gr->Add(echelle, 1, wxEXPAND);
  gr->Add(new wxStaticText(&dlg, wxID_ANY, L"Couleur"), 0, wxALIGN_CENTER_VERTICAL);
  auto* lc = new wxBoxSizer(wxHORIZONTAL);
  lc->Add(couleur, 0, wxRIGHT, FromDIP(6));
  lc->Add(theme, 0, wxALIGN_CENTER_VERTICAL);
  gr->Add(lc, 1, wxEXPAND);
  sz->Add(gr, 0, wxEXPAND | wxALL, FromDIP(12));
  sz->Add(pieces, 0, wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(12));
  sz->Add(dlg.CreateStdDialogButtonSizer(wxOK | wxCANCEL), 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(12));
  dlg.SetSizerAndFit(sz);
  if (dlg.ShowModal() != wxID_OK) return;
  plan::J n = plan::J::object();
  n["pat"] = pats[motif->GetSelection()].first;
  n["ang"] = angle->GetValue(), n["sc"] = echelle->GetValue();
  n["col"] = theme->GetValue() ? std::string() : couleur->GetColour().GetAsString(wxC2S_HTML_SYNTAX).Lower().utf8_string();
  if (!pieces->GetValue()) n["parts"] = false;
  mep_["hatch"] = std::move(n);
  redessiner();
  valider(L"hachures");
  if (surEtat) surEtat(wxString(L"Hachures : ") + pats[motif->GetSelection()].second + L" — toutes les coupes.");
}
void PlanVue::bullesAuto() { plan::bullesAutomatiques(mep_, planche_, piece_, calcul_); }
void PlanVue::basculerAjoutBulle() {
  ajoutBulle_ = !ajoutBulle_;
  if (surEtat) surEtat(ajoutBulle_ ? L"＋ Bulle : cliquez une pièce dans une vue « Assemblage » (Échap pour finir)." : L"＋ Bulle terminé.");
}
void PlanVue::commencerAlignement(const std::vector<std::string>& ids) {
  if (ids.empty()) return;
  alignement_ = ids;
  if (surEtat) surEtat(wxString::Format(L"Aligner %zu cote(s) : cliquez la cote de RÉFÉRENCE (Échap pour annuler).", ids.size()));
}
void PlanVue::ajouterPointsOrdonnees(const std::string& id, const std::string& outil) {
  sel_ = plan::SelectionPlan();
  sel_.cote = id;
  lancerOutil(outil);
}

void PlanVue::lancerOutil(const std::string& tool) {
  commandeActive_ = false;
  ajoutBulle_ = false;
  alignement_.clear();
  geste_ = Geste();
  outil_ = plan::commencerOutil(tool, sel_.cote, planche());
  outilActif_ = true;
  if (outil_.ord.empty()) sel_ = plan::SelectionPlan();
  if (!essaiEnCours_ && IsShownOnScreen()) SetFocus();  // Entrée, Suppr et les lettres vont au dessin, pas au bouton cliqué
  if (surEtat) {
    if (tool == "dim") surEtat(L"Cote : cliquez une arête, un cercle, ou un point (2 entités : distance, angle).");
    else if (tool == "hole") surEtat(L"Perçage : cliquez un trou, vu de bout (cercle, arc) ou de côté (paroi, axe, fond).");
    else if (tool == "note") surEtat(L"Note : cliquez la pointe de la flèche dans une vue.");
    else if (!outil_.ord.empty()) surEtat(L"Ordonnées : cliquez les points à AJOUTER au groupe sélectionné (Entrée ou Échap pour terminer).");
    else surEtat(L"Ordonnées : cliquez l’origine « 0 » dans une vue.");
  }
  redessiner();
  if (surSelection) surSelection();
}
void PlanVue::lancerAxes(const std::string& mode) {
  lancerOutil("axis");
  outil_.axisMode = mode;
  if (surEtat) surEtat(wxString::FromUTF8(plan::texteOutilAxe(outil_)));
  if (surSelection) surSelection();
}
void PlanVue::quitterOutil() {
  outilActif_ = false;
  outil_ = plan::OutilPlan();
  redessiner();
  if (surSelection) surSelection();
}
bool PlanVue::echapEsquisse() {
  if (outilActif_ && plan::estOutilEsquisse(outil_.tool) && outil_.skDebut) {
    outil_.skDebut = false, outil_.skPts.clear();
    Refresh(false);
    return true;
  }
  if (!sel_.skSel.empty()) {
    sel_.skSel.clear();
    redessiner();
    if (surSelection) surSelection();
    return true;
  }
  if (esq_.tbEdit) {
    if (outilActif_) quitterOutil();
    else basculerCartouche(false);
    return true;
  }
  return false;
}
void PlanVue::basculerCartouche(bool on) {  // mepTbEdit
  J& sh = planche();
  const bool nouveau = on && !plan::cartoucheDessine(sh);
  if (nouveau) {
    if (!sh.contains("title") || !sh["title"].is_object()) sh["title"] = J::object();
    sh["title"]["tb"] = plan::cartoucheStandard(sh);
  }
  esq_.tbEdit = on;
  sel_ = plan::SelectionPlan();
  if (outilActif_ && (!on || !plan::estOutilEsquisse(outil_.tool))) {
    outilActif_ = false;
    outil_ = plan::OutilPlan();
  } else if (outilActif_) {
    outil_.skDebut = false, outil_.skPts.clear();
  }
  redessiner();
  if (nouveau) valider(L"cartouche en esquisse");
  if (surEtat) surEtat(on ? L"Édition du cartouche : outils Ligne, Rectangle, Cercle, Arc, Texte/Champ ; sélectionnez pour contraindre. Échap ou « Terminer » pour sortir." : L"Cartouche enregistré sur la planche.");
  if (surSelection) surSelection();
}
void PlanVue::choisirSk(const std::vector<std::string>& cles) {
  sel_.skSel = cles;
  redessiner();
  if (surSelection) surSelection();
}
void PlanVue::appliquerContrainte(const std::string& id) {
  bool change = false;
  const std::string m = plan::appliquerContrainte(planche(), esq_, sel_, id, change);
  redessiner();
  if (change) valider(L"contrainte");
  if (surEtat && !m.empty()) surEtat(wxString::FromUTF8(m));
  if (surSelection) surSelection();
}
void PlanVue::valeurContrainte(const std::string& id, double v) {
  bool change = false;
  const std::string m = plan::valeurContrainte(planche(), esq_, id, v, change);
  redessiner();
  if (change) valider(L"cote pilotante");
  if (surEtat && !m.empty()) surEtat(wxString::FromUTF8(m));
  if (surSelection) surSelection();
}
void PlanVue::saisirNote(const std::string& id) {  // mepNoteEdit
  J& sh = planche();
  J* d = plan::coteParId(sh, id);
  if (!d) return;
  wxTextEntryDialog dlg(this, L"Note", L"Note", wxString::FromUTF8(d->value("txt", std::string())), wxOK | wxCANCEL | wxTE_MULTILINE);
  if (dlg.ShowModal() != wxID_OK) return;
  std::string s = dlg.GetValue().utf8_string();
  while (!s.empty() && (s.back() == ' ' || s.back() == '\n' || s.back() == '\r' || s.back() == '\t')) s.pop_back();
  if (!s.empty()) {
    (*d)["txt"] = s;
  } else {
    plan::J ds = plan::J::array();
    for (J& x : sh["dims"])
      if (x.value("id", std::string()) != id) ds.push_back(std::move(x));
    sh["dims"] = std::move(ds);
    sel_.cote.clear();
  }
  redessiner();
  valider(L"texte de note");
  if (surSelection) surSelection();
}
void PlanVue::menuContextuel(double x, double y, const std::string& essai) {
  if (outilActif_ && plan::estOutilEsquisse(outil_.tool)) {
    if (outil_.skDebut) {
      outil_.skDebut = false, outil_.skPts.clear();
      if (surEtat) surEtat(L"Tracé terminé.");
      Refresh(false);
    }
    return;
  }
  if (!mep_.is_object() || !mep_.contains("sheets") || mep_["sheets"].empty()) return;
  if (commandeActive_) return finirCommande(L"Commande annulée.");
  J& sh = planche();
  const auto peut = [](const J* d) {
    if (!d) return false;
    const std::string k = d->value("kind", std::string());
    return k == "dia" || k == "rad" || k == "len" || k == "dist";
  };
  const bool outilCote = outilActif_ && outil_.tool == "dim";
  const bool snap = outilCote && !(!outil_.dim.is_null() && outil_.dim.value("kind", std::string()) == "dist" && outil_.dim.contains("_pp"));
  J* brouillon = outilActif_ && !outil_.dim.is_null() && peut(&outil_.dim) ? &outil_.dim : nullptr;
  J* d = brouillon;
  bool avecSnap = false;
  if (brouillon) {
    avecSnap = snap;
  } else if (snap && outil_.enChaine) {
    avecSnap = true;
  } else {
    if (!outilActif_ || outil_.dim.is_null()) {
      const std::string id = plan::coteSous(sh, calcul_, x, y, zoomRelatif());
      if (!id.empty()) d = plan::coteParId(sh, id);
    }
    if (!peut(d)) d = nullptr;
    if (!d) {
      if (!snap) return;
      avecSnap = true;
    } else {
      sel_ = plan::SelectionPlan();
      sel_.cote = d->value("id", std::string());
      redessiner();
      if (surSelection) surSelection();
    }
  }
  struct Choix {
    wxString lab;
    bool coche;
    std::function<void()> faire;
  };
  std::vector<Choix> L;
  const std::string idCote = d && !brouillon ? d->value("id", std::string()) : std::string();
  const auto laCote = [this, idCote]() -> J* { return idCote.empty() ? (outil_.dim.is_null() ? nullptr : &outil_.dim) : plan::coteParId(planche(), idCote); };
  const bool enCours = brouillon != nullptr;
  if (d) {
    const std::string k = d->value("kind", std::string());
    const auto sorte = [&](const wchar_t* lab, const char* nk) {
      L.push_back({lab, k == nk, [=] {
        J* q = laCote();
        if (!q || q->value("kind", std::string()) == nk) return;
        (*q)["kind"] = nk;
        q->erase("txt");
        const bool dia = std::string(nk) == "dia";
        redessiner();
        if (enCours) {
          if (surEtat) surEtat(dia ? L"Cote Ø : cliquez pour poser." : L"Cote R : cliquez pour poser.");
          return;
        }
        valider(dia ? L"Cote diamètre" : L"Cote rayon");
        if (surEtat) surEtat(dia ? L"Cote diamètre — clic droit pour passer en R." : L"Cote rayon — clic droit pour passer en Ø.");
        if (surSelection) surSelection();
      }});
    };
    if (k == "dia" || k == "rad") {
      sorte(L"Rayon (R)", "rad");
      sorte(L"Diamètre (Ø)", "dia");
    }
    if ((k == "len" || k == "dist") && !(k == "dist" && !d->contains("b"))) {
      const std::string o = d->value("orient", std::string("a"));
      const auto axe = [&](const wchar_t* lab, const char* v, const wchar_t* nom) {
        L.push_back({lab, o == v, [=] {
          J* q = laCote();
          if (!q) return;
          if (enCours) (*q)["__orientLock"] = true;
          const wxString l(nom);
          if (q->value("orient", std::string("a")) != v) {
            plan::orienterCote(mep_, planche_, piece_, calcul_, *q, v);
            redessiner();
            if (!enCours) {
              valider(l);
              if (surEtat) surEtat(l + L" — clic droit pour changer l’orientation.");
              if (surSelection) surSelection();
              return;
            }
          }
          if (enCours && surEtat) surEtat(l + L" : cliquez pour poser.");
        }});
      };
      axe(L"Alignée (A)", "a", L"Cote alignée");
      axe(L"Horizontale (X)", "h", L"Cote horizontale (X)");
      axe(L"Verticale (Y)", "v", L"Cote verticale (Y)");
    }
  }
  const size_t nCote = L.size();
  if (avecSnap)
    for (const auto& m : plan::modesAccrochage()) {
      const std::string mode = m.first;
      L.push_back({wxString::FromUTF8(m.second), outil_.snapMode == mode, [this, mode] {
        const std::string t = plan::choisirAccrochage(mep_, planche_, piece_, calcul_, outil_, mode);
        if (surEtat) surEtat(wxString::FromUTF8(t));
        redessiner();
      }});
    }
  if (!d && !avecSnap && !outilActif_) {  // mepLocCtx
    const plan::ToucheLocale h = plan::localeSous(sh, sel_, x, y, zoomRelatif());
    if (h.ok) {
      choisirLocale(h.vid, h.id);
      L.clear();
      const J* v = plan::vueParId(sh, h.vid);
      const J* lo = plan::coupeLocale(sh, h.vid, h.id);
      if (h.i >= 0 && (*lo)["pts"].size() > 3) L.push_back({L"Retirer ce point", false, [this, h] { retirerPointLocale(h.vid, h.id, h.i); }});
      L.push_back({L"Arête du plan…", false, [this, h] { changerAreteLocale(h.vid, h.id); }});
      L.push_back({L"Supprimer la coupe locale", false, [this, h] { supprimerLocale(h.vid, h.id); }});
      if (!essai.empty()) {
        const wxString voulu = wxString::FromUTF8(essai);
        for (const Choix& q : L)
          if (q.lab == voulu) return q.faire();
        return;
      }
      size_t rang = 1;
      for (const J& q : (*v)["locals"]) {
        if (q.value("id", std::string()) == h.id) break;
        rang++;
      }
      wxMenu menuLoc(wxString::Format(L"Coupe locale n° %zu", rang));
      for (size_t i = 0; i < L.size(); i++) menuLoc.Append(wxID_HIGHEST + 500 + static_cast<int>(i), L[i].lab);
      const int rl = GetPopupMenuSelectionFromUser(menuLoc);
      if (rl >= wxID_HIGHEST + 500 && rl < wxID_HIGHEST + 500 + static_cast<int>(L.size())) L[rl - wxID_HIGHEST - 500].faire();
      return;
    }
  }
  if (L.empty()) return;
  if (!essai.empty()) {
    const wxString voulu = wxString::FromUTF8(essai);
    for (const Choix& q : L)
      if (q.lab == voulu) return q.faire();
    return;
  }
  wxMenu menu(d ? (enCours ? L"Cote en cours" : L"Cote") : L"Accrochage");
  for (size_t i = 0; i < L.size(); i++) {
    if (i == nCote && nCote > 0) menu.AppendSeparator();
    menu.AppendCheckItem(wxID_HIGHEST + 500 + static_cast<int>(i), L[i].lab)->Check(L[i].coche);
  }
  const int r = GetPopupMenuSelectionFromUser(menu);
  if (r >= wxID_HIGHEST + 500 && r < wxID_HIGHEST + 500 + static_cast<int>(L.size())) L[r - wxID_HIGHEST - 500].faire();
}
void PlanVue::finirCommande(const wxString& message) {
  commandeActive_ = false;
  commande_ = plan::CommandeVue();
  if (surEtat && !message.empty()) surEtat(message);
  Refresh(false);
}
void PlanVue::apresPlanche() {  // mepAfterSheetSwitch
  planche_ = mep_["cur"].get<int>();
  sel_ = plan::SelectionPlan();
  geste_ = Geste();
  vueSurvol_.clear();
  commandeActive_ = false;
  ajuster_ = true;
  plan::normaliser(mep_);
  redessiner();
  if (surSelection) surSelection();
}
void PlanVue::rejeter(const std::string& id) {
  wxBusyCursor attente;
  plan::rejeterVues(mep_, planche_, piece_, calcul_, id);
  redessiner();
  valider(L"rejeu des vues");
  if (surEtat) surEtat(id.empty() ? L"Toutes les vues rejetées." : L"Vue rejetée.");
  if (surSelection) surSelection();
}
void PlanVue::orienter(const std::string& id, const std::string& vk) {
  wxBusyCursor attente;
  if (!plan::orienterVue(mep_, planche_, piece_, calcul_, id, vk)) return;
  redessiner();
  valider(L"orientation de vue");
  if (surEtat) surEtat(L"Orientation changée — projections mises à jour.");
  if (surSelection) surSelection();
}
bool PlanVue::estRepris(const wxString& n) const {
  for (const wchar_t* q : {L"Ligne", L"Rectangle", L"Arc", L"Point", L"Ajuster", L"Texte", L"Cartouche", L"Nouvelle", L"Dupliquer", L"Face", L"ISO", L"Caméra", L"Projection", L"Coupe", L"Détail", L"Auxiliaire", L"Coupe locale", L"Cote", L"Perçage", L"Note", L"Ordonnées X", L"Ordonnées Y", L"Perçages auto", L"Trou", L"Cercle", L"Symétrie", L"SVG", L"PDF", L"DXF", L"DXF export", L"Imprimer", L"Cercle axes"})
    if (n == q) return true;
  return false;
}
bool PlanVue::boutonRuban(const wxString& nom) {
  if (!planPret()) return true;
  const auto apresVue = [this](const std::string& id) {
    sel_ = plan::SelectionPlan();
    sel_.vue = id;
    redessiner();
    valider(L"nouvelle vue");
    if (surSelection) surSelection();
  };
  if (nom == L"Nouvelle") {
    plan::nouvellePlanche(mep_);
    plan::appliquerCartoucheDefaut(mep_, mep_["sheets"].back());
    apresPlanche();
    valider(L"nouvelle planche");
    return true;
  }
  if (nom == L"Dupliquer") {
    plan::dupliquerPlanche(mep_, planche_);
    apresPlanche();
    valider(L"duplication de planche");
    return true;
  }
  if (nom == L"Face" || nom == L"ISO") {
    wxBusyCursor attente;
    apresVue(plan::ajouterVueStandard(mep_, planche_, piece_, calcul_, nom == L"Face" ? "front" : "iso"));
    return true;
  }
  if (nom == L"Caméra") {
    std::array<double, 3> dir{0, -1, 0};
    if (directionCamera) directionCamera(dir);
    wxBusyCursor attente;
    apresVue(plan::ajouterVueCamera(mep_, planche_, piece_, calcul_, dir));
    return true;
  }
  if (nom == L"Ligne") return lancerOutil("line"), true;
  if (nom == L"Rectangle") return lancerOutil("rect"), true;
  if (nom == L"Cercle") return lancerOutil("circle"), true;
  if (nom == L"Arc") return lancerOutil("arc"), true;
  if (nom == L"Point") return lancerOutil("point"), true;
  if (nom == L"Ajuster") return lancerOutil("trim"), true;
  if (nom == L"Texte") return lancerOutil("text"), true;
  if (nom == L"Logo") return lancerOutil("logo"), true;
  if (nom == L"Cartouche") return basculerCartouche(!esq_.tbEdit), true;
  if (nom == L"Trou") return lancerAxes("hole"), true;
  if (nom == L"Cercle axes") return lancerAxes("pitch"), true;
  if (nom == L"Alignement") return lancerAxes("align"), true;
  if (nom == L"Libre") return lancerAxes("free"), true;
  if (nom == L"Symétrie") return lancerAxes("sym"), true;
  if (nom == L"Cote") return lancerOutil("dim"), true;
  if (nom == L"Perçage") return lancerOutil("hole"), true;
  if (nom == L"Note") return lancerOutil("note"), true;
  if (nom == L"Ordonnées X") return lancerOutil("ordx"), true;
  if (nom == L"Ordonnées Y") return lancerOutil("ordy"), true;
  if (nom == L"Perçages auto") {
    wxBusyCursor attente;
    const int n = plan::percagesAuto(mep_, planche_, piece_, calcul_, sel_.vue);
    if (!n) {
      if (surEtat) surEtat(wxString(L"Perçages : rien à coter (aucun perçage vu de bout") + (sel_.vue.empty() ? L"" : L" dans cette vue") + L", ou déjà cotés).");
      return true;
    }
    redessiner();
    valider(L"cotes de perçage auto");
    if (surEtat) surEtat(wxString::Format(L"%d cote(s) de perçage posée(s) — glissez une étiquette pour l’ajuster.", n));
    return true;
  }
  if (nom == L"Projection") return lancerCommande("proj"), true;
  if (nom == L"Coupe") return lancerCommande("section"), true;
  if (nom == L"Détail") return lancerCommande("detail"), true;
  if (nom == L"Auxiliaire") return lancerCommande("aux"), true;
  if (nom == L"Coupe locale") return lancerCommande("local"), true;
  if (nom == L"DXF") return importerDxf(), true;
  if (nom == L"SVG") return exporter("svg"), true;
  if (nom == L"PDF") return exporter("pdf"), true;
  if (nom == L"DXF export") return exporter("dxf"), true;
  if (nom == L"Imprimer") return imprimer(), true;
  return false;
}

// ---- Pour le panneau ----
void PlanVue::editer(const wxString& libelle, const std::function<void()>& f) {
  try {
    f();
  } catch (const std::exception&) {
  }
  wxBusyCursor attente;
  redessiner();
  valider(libelle);
}
std::string PlanVue::logoDepuisFichier(const wxString& chemin) {
  wxImage im;
  wxLogNull silence;
  if (!im.LoadFile(chemin)) return "";
  const double k = std::min(1.0, 240.0 / std::max(im.GetWidth(), im.GetHeight()));
  im.Rescale(std::max(1, static_cast<int>(std::floor(im.GetWidth() * k + 0.5))), std::max(1, static_cast<int>(std::floor(im.GetHeight() * k + 0.5))), wxIMAGE_QUALITY_HIGH);
  wxMemoryOutputStream sortie;
  if (!im.SaveFile(sortie, wxBITMAP_TYPE_PNG)) return "";
  const size_t n = sortie.GetLength();
  std::string octets(n, '\0');
  sortie.CopyTo(octets.data(), n);
  return "data:image/png;base64," + std::string(wxBase64Encode(octets.data(), n).utf8_string());
}
void PlanVue::basculerGrille() {
  grille_ = !grille_;
  Refresh(false);
}
void PlanVue::zoomer(double k) {
  const wxSize t = GetClientSize();
  const double cx = (t.x / 2.0 - ox_) / zoom_, cy = (t.y / 2.0 - oy_) / zoom_;
  zoom_ = std::max(0.05, std::min(400.0, zoom_ * k));
  ox_ = t.x / 2.0 - cx * zoom_;
  oy_ = t.y / 2.0 - cy * zoom_;
  ajuster_ = false;
  imageBonne_ = false;
  Refresh(false);
}
void PlanVue::ajuster() {
  ajuster_ = true;
  imageBonne_ = false;
  Refresh(false);
}
void PlanVue::cadrerVue(const std::string& id) {  // mepFitViewContent
  J* v = vueCourante(id);
  double x, y, w, h;
  if (!v || !plan::boiteDeVue(*v, planche(), mep_, piece_, calcul_, x, y, w, h)) return;
  const wxSize t = GetClientSize();
  const int ho = hauteurOnglets();
  const double pad = 14, W = w + pad * 2, H = h + pad * 2;
  zoom_ = std::max(0.05, std::min(400.0, std::min(t.x / W, (t.y - ho) / H)));
  ajuster_ = false;
  ox_ = t.x / 2.0 - (x + w / 2) * zoom_;
  oy_ = ho + (t.y - ho) / 2.0 - (y + h / 2) * zoom_;
  imageBonne_ = false;
  Refresh(false);
}
void PlanVue::enleverVue(const std::string& id) {
  plan::supprimerVue(planche(), id);
  if (sel_.vue == id) sel_.vue.clear();
}
void PlanVue::enleverCote(const std::string& id) {
  J ds = J::array();
  for (J& d : planche()["dims"])
    if (d.value("id", std::string()) != id) ds.push_back(std::move(d));
  planche()["dims"] = std::move(ds);
  if (sel_.cote == id) sel_.cote.clear();
}
std::string PlanVue::texteDeCote(const std::string& id) {
  J* d = coteCourante(id);
  return d ? plan::texteLuDeCote(mep_, planche_, piece_, calcul_, *d) : std::string();
}
void PlanVue::viderSelection() {
  sel_ = plan::SelectionPlan();
  redessiner();
  if (surSelection) surSelection();
}

// ---- Les gestes (mepOnDown, mepOnMove, mepOnUp, mepOnKey) ----
void PlanVue::redessiner() {
  if (differer_) {  // un mouvement de souris : le calcul attend le prochain dessin, qui regroupe les mouvements rapprochés
    aConstruire_ = true;
    Refresh(false);
    return;
  }
  aConstruire_ = false;
  calcul_.selection = &sel_;
  if (esq_.tbEdit && !plan::cartoucheDessine(planche())) esq_.tbEdit = false;  // autre planche : pas de cartouche dessiné
  calcul_.esqCartouche = esq_.tbEdit;
  calcul_.esqPlanche = !esq_.tbEdit && plan::editionEsquisse(esq_, outilActif_ ? outil_.tool : std::string(), sel_);
  // La cote en cours de pose, le temps du dessin
  const bool brouillon = outilActif_ && !outil_.dim.is_null();
  J& feuille = planche();
  if (brouillon) {
    if (!feuille.contains("dims") || !feuille["dims"].is_array()) feuille["dims"] = J::array();
    J d = outil_.dim;
    d["id"] = "__brouillon";
    feuille["dims"].push_back(std::move(d));
  }
  construire();
  if (brouillon) feuille["dims"].erase(feuille["dims"].size() - 1);
  imageBonne_ = false;
  Refresh(false);
}

void PlanVue::valider(const wxString& libelle) {
  imageBonne_ = false;
  if (surChangement) surChangement(mep_, libelle);
}

void PlanVue::enfonce(double x, double y, bool maj, bool ctrl, double px, double py) {
  const bool ajout = maj || ctrl;
  J& sh = planche();
  const double z = zoomRelatif();
  if (commandeActive_) {
    wxBusyCursor attente;
    commande_.curX = x, commande_.curY = y, commande_.aCur = true;
    const plan::SuiteCommande r = plan::cliqueCommande(mep_, planche_, piece_, calcul_, commande_, x, y, maj, z);
    const bool choix = !r.select.empty() && r.select != sel_.vue;
    if (!r.select.empty()) {
      sel_ = plan::SelectionPlan();
      sel_.vue = r.select;
    }
    if (!r.selLoc.empty()) sel_.locVue = r.select, sel_.locId = r.selLoc;
    if (r.fini) commandeActive_ = false;
    if (r.change) {
      redessiner();
      valider(!r.selLoc.empty() ? L"coupe locale" : L"nouvelle vue");
    } else if (choix) {
      redessiner();
    }
    if (surEtat && !r.message.empty()) surEtat(wxString::FromUTF8(r.message));
    if ((r.change || choix) && surSelection) surSelection();
    Refresh(false);
    return;
  }
  if (ajoutBulle_) {  // mepBalloonAddAt
    wxBusyCursor attente;
    std::string msg;
    const bool ok = plan::ajouterBulle(mep_, planche_, piece_, calcul_, x, y, msg);
    if (ok) {
      redessiner();
      valider(L"bulle ajoutée");
    }
    if (surEtat) surEtat(wxString::FromUTF8(msg));
    Refresh(false);
    return;
  }
  if (!alignement_.empty() && !outilActif_) {  // l'outil Aligner : ce clic désigne la cote de référence
    const std::string ref = plan::coteSous(sh, calcul_, x, y, z);
    if (ref.empty()) {
      if (surEtat) surEtat(L"Aligner : cliquez une COTE de référence (Échap pour annuler).");
      return;
    }
    const std::vector<std::string> ids = alignement_;
    alignement_.clear();
    int n = 0, ign = 0;
    plan::alignerCotes(mep_, planche_, piece_, calcul_, ref, ids, n, ign);
    if (n) valider(L"alignement de cotes");
    if (surEtat) {
      if (n) surEtat(ign ? wxString::Format(L"%d cote(s) alignée(s) sur la référence ; %d ignorée(s) (non parallèle(s)).", n, ign) : wxString::Format(L"%d cote(s) alignée(s) sur la référence.", n));
      else surEtat(L"Aligner : aucune cote parallèle à la référence.");
    }
    sel_ = plan::SelectionPlan();
    sel_.cote = ref;
    redessiner();
    if (surSelection) surSelection();
    Refresh(false);
    return;
  }
  const auto toutEffacer = [&]() { sel_ = plan::SelectionPlan(); };
  Geste g;
  g.px0 = px, g.py0 = py, g.curX = x, g.curY = y, g.ajout = ajout;
  const double tolSk = 7 / zoom_;  // mepSkTol
  if (outilActif_ && plan::estOutilEsquisse(outil_.tool)) {
    wxBusyCursor attente;
    const plan::SuiteOutil r = plan::cliqueEsquisse(mep_, planche_, piece_, calcul_, esq_, outil_, sel_, x, y, tolSk, z);
    redessiner();
    if (r.change) valider(wxString::FromUTF8(r.libelle));
    if (surEtat && !r.message.empty()) surEtat(wxString::FromUTF8(r.message));
    if (surSelection) surSelection();
    return;
  }
  // Un outil actif : une cote déjà posée reste attrapable, tout le reste va à l'outil
  bool seulCote = false;
  if (outilActif_) {
    const bool attrape = outil_.tool == "dim" && !outil_.enChaine && outil_.dim.is_null() && outil_.snapMode.empty() && !plan::coteSous(sh, calcul_, x, y, z).empty();
    if (!attrape) {
      wxBusyCursor attente;
      const plan::SuiteOutil r = plan::cliqueOutil(mep_, planche_, piece_, calcul_, outil_, x, y, ctrl, maj, wxGetKeyState(WXK_ALT), z);
      if (r.effacerSelection) sel_ = plan::SelectionPlan();
      if (!r.selCote.empty()) {
        sel_ = plan::SelectionPlan();
        sel_.cote = r.selCote;
      }
      redessiner();
      if (r.change) valider(wxString::FromUTF8(r.libelle));
      if (surEtat && !r.message.empty()) surEtat(wxString::FromUTF8(r.message));
      if (surSelection) surSelection();
      if (r.saisirNote) {
        const std::string id = r.selCote;
        if (!essaiEnCours_) saisirNote(id);
      }
      return;
    }
    seulCote = true;
  }
  // Ordonnée + Ctrl : cassure — glisser décale la valeur le long de l'axe, Ctrl + clic sans glisser la retire
  if (ctrl && !maj && !seulCote && !outilActif_) {
    const std::string c = plan::coteSous(sh, calcul_, x, y, z);
    J* d = c.empty() ? nullptr : plan::coteParId(sh, c);
    if (d && d->value("kind", std::string()) == "ord") {
      const int i = plan::pointOrdonnee(sh, *d, x, y);
      if (i >= 0) {
        sel_ = plan::SelectionPlan();
        sel_.cote = c, sel_.ordCote = c, sel_.ordPt = i;
        g.sorte = Geste::COTE, g.id = c;
        g.jogI = i;
        const plan::J& q = (*d)["pts"][i];
        g.jogJ0 = q.contains("jog") && q["jog"].is_number() ? q["jog"].get<double>() : 0;
        g.cote.sx = x, g.cote.sy = y;
        geste_ = g;
        if (surEtat) surEtat(L"Cassure : glissez pour dégager la valeur (Ctrl + clic sans glisser : la retire).");
        redessiner();
        if (surSelection) surSelection();
        return;
      }
    }
  }
  // Maj ou Ctrl + clic sur une cote : sélection multiple
  if (seulCote) {
  } else if (ajout) {
    const std::string c = plan::coteSous(sh, calcul_, x, y, z);
    if (!c.empty()) {
      if (!sel_.cote.empty() && sel_.cote != c && sel_.lotCotes.empty()) sel_.lotCotes.insert(sel_.cote);
      if (sel_.lotCotes.count(c)) sel_.lotCotes.erase(c);
      else sel_.lotCotes.insert(c);
      sel_.cote.clear();
      sel_.vue.clear();
      if (surEtat) surEtat(wxString::Format(L"%zu cote(s) sélectionnée(s).", sel_.lotCotes.size()));
      redessiner();
      if (surSelection) surSelection();
      return;
    }
  } else {
    sel_.lotVues.clear();
    sel_.lotCotes.clear();
  }
  // L'esquisse (planche, ou cartouche en édition) : sélection, Maj = ajout, glisser = déplacer sous contraintes
  if (!seulCote) {
    // Pour que les étiquettes de contraintes soient à leur place
    plan::aidesEsquisse(mep_, planche_, piece_, calcul_, esq_, nullptr, sel_, 1 / zoom_);
    const std::string hk = plan::esquisseSous(mep_, planche_, piece_, calcul_, esq_, std::string(), sel_, x, y, tolSk);
    if (!hk.empty()) {
      // Un texte pas encore choisi : clic = le choisir, glisser = cadre (les textes couvrent presque tout le cartouche)
      if (plan::texteNonChoisi(sh, esq_, sel_, hk)) {
        g.sorte = Geste::CADRE, g.ox = x, g.oy = y, g.cleSk = hk;
        geste_ = g;
        return;
      }
      plan::choisirEsquisse(sel_, hk, ajout);
      if (!ajout && hk[0] != 'c') {
        g.sorte = Geste::ESQUISSE, g.cleSk = hk, g.ox = x, g.oy = y;
        g.baseSk = plan::photoEsquisse(sh, esq_);
        geste_ = g;
      }
      redessiner();
      if (surSelection) surSelection();
      return;
    }
    if (esq_.tbEdit) {
      g.sorte = Geste::CADRE, g.ox = x, g.oy = y;
      geste_ = g;
      return;
    }
    if (!ajout && !sel_.skSel.empty()) {
      sel_.skSel.clear();
      redessiner();
      if (surSelection) surSelection();
    }
  }
  // Une coupe locale : sa forme, ou un de ses points de contrôle (mepLocDown)
  if (!seulCote) {
    const plan::ToucheLocale h = plan::localeSous(sh, sel_, x, y, z);
    if (h.ok) {
      const bool dejaChoisie = sel_.locId == h.id && sel_.locVue == h.vid && sel_.vue == h.vid;
      sel_ = plan::SelectionPlan();
      sel_.vue = h.vid, sel_.locVue = h.vid, sel_.locId = h.id;
      if (h.i >= 0 && maj) {
        retirerPointLocale(h.vid, h.id, h.i);
        if (surSelection) surSelection();
        return;
      }
      J* v = plan::vueParId(sh, h.vid);
      J* l = plan::coupeLocale(sh, h.vid, h.id);
      if (h.i >= 0 || dejaChoisie) {
        g.sorte = Geste::LOCALE, g.id = h.id;
        for (const J& q : (*l)["pts"]) g.locPts.push_back({q[0].get<double>(), q[1].get<double>()});
        g.locI = h.i, g.locIns = h.i < 0;
        if (h.i < 0) {  // forme glissée : nouveau point
          g.locI = h.seg + 1;
          g.locPts.insert(g.locPts.begin() + g.locI, {(x - v->value("x", 0.0)) / v->value("scale", 1.0), (y - v->value("y", 0.0)) / v->value("scale", 1.0)});
        }
        if (surEtat) surEtat(wxString(L"Coupe locale : tirez le point") + (h.i < 0 ? L" ajouté" : L"") + L" — Maj + clic retire un point, Suppr supprime la coupe.");
      } else {
        g.sorte = Geste::VUE, g.id = h.vid;
        g.ox = x - v->value("x", 0.0), g.oy = y - v->value("y", 0.0);
        if (surEtat) surEtat(L"Coupe locale sélectionnée : tirez ses points (ou la forme pour en ajouter un), Suppr la supprime, clic droit pour le menu.");
      }
      geste_ = g;
      redessiner();
      if (surSelection) surSelection();
      return;
    }
  }
  // La flèche d'une coupe : elle glisse le long de la ligne
  plan::GesteCoupe gc;
  if (!seulCote && plan::flecheCoupeSous(mep_, planche_, piece_, calcul_, x, y, z, gc)) {
    sel_.vue = gc.vue, sel_.cote.clear(), sel_.bulle.clear();
    g.sorte = Geste::FLECHE, g.id = gc.vue, g.coupe = gc;
    geste_ = g;
    redessiner();
    if (surSelection) surSelection();
    return;
  }
  // Un tronçon de ligne de coupe : tirer le déplace, Ctrl le brise, Maj + clic retire une brisure
  gc = plan::GesteCoupe();
  if (!seulCote && plan::tronconCoupeSous(mep_, planche_, piece_, calcul_, x, y, z, gc)) {
    sel_.vue = gc.vue, sel_.cote.clear(), sel_.bulle.clear();
    if (maj) {
      wxBusyCursor attente;
      const bool ok = plan::retirerBrisure(mep_, planche_, piece_, calcul_, gc);
      if (surEtat) surEtat(ok ? L"Ligne de coupe : brisure retirée." : L"Ligne de coupe : aucune brisure à retirer.");
      redessiner();
      if (ok) valider(L"ligne de coupe : brisure retirée");
      if (surSelection) surSelection();
      return;
    }
    gc.brk = ctrl;
    g.sorte = Geste::TRONCON, g.id = gc.vue, g.coupe = gc;
    geste_ = g;
    redessiner();
    if (surSelection) surSelection();
    return;
  }
  // Une bulle : sélection, et glisser pour la placer
  const std::string bl = seulCote ? std::string() : plan::bulleSous(sh, x, y);
  if (!bl.empty()) {
    const J* b = plan::bulleParId(sh, bl);
    double ax, ay;
    plan::pointBulle(sh, *b, ax, ay);
    sel_.bulle = bl, sel_.vue.clear(), sel_.cote.clear();
    g.sorte = Geste::BULLE, g.id = bl;
    g.ox = x - (ax + b->value("dx", 0.0)), g.oy = y - (ay + b->value("dy", 0.0));
    geste_ = g;
    if (surEtat) surEtat(L"Bulle : glissez pour la placer, Suppr pour la retirer.");
    redessiner();
    if (surSelection) surSelection();
    return;
  }
  sel_.bulle.clear();
  // Le titre d'une vue : il glisse le long de son axe
  double ecart = 0;
  const std::string tv = seulCote ? std::string() : plan::titreSous(sh, mep_, piece_, calcul_, x, y, z, ecart);
  if (!tv.empty()) {
    sel_.vue = tv, sel_.cote.clear();
    g.sorte = Geste::TITRE, g.id = tv, g.oy = ecart;
    geste_ = g;
    redessiner();
    if (surSelection) surSelection();
    return;
  }
  // Une cote : sélection, glisser pour la déplacer ; deuxième appui rapproché : le double-clic
  const std::string fl = plan::flecheSous(sh, calcul_, x, y, z);
  const std::string dim = plan::coteSous(sh, calcul_, x, y, z);
  const std::string touche = !fl.empty() ? fl : dim;
  const wxLongLong t = wxGetLocalTimeMillis();
  if (!touche.empty() && touche == coteAppui_ && (t - tempsAppui_).ToLong() < 450 && std::hypot(px - appuiPx_, py - appuiPy_) < 6) {
    coteAppui_.clear();
    if (J* d = plan::coteParId(sh, touche)) {
      const std::string k = d->value("kind", std::string());
      if (k == "len" || k == "dist" || !fl.empty()) {
        plan::inverserFleches(*d);
        redessiner();
        valider(L"flèches");
      } else if (k == "ang") {
        plan::inverserAngle(mep_, planche_, piece_, calcul_, *d);
        redessiner();
        valider(L"angle rentrant");
      } else if (k != "ord") {
        // Un texte de note ou une valeur écrite à la main
        const wxString lib = k == "note" ? L"Texte de la note :" : L"Texte de cote (vide = calculé) :";
        wxTextEntryDialog dlg(this, lib, L"Mise en plan", wxString::FromUTF8(d->value("txt", std::string())));
        if (dlg.ShowModal() == wxID_OK) {
          const std::string s = dlg.GetValue().utf8_string();
          if (!s.empty()) (*d)["txt"] = s;
          else if (k != "note") d->erase("txt");
          else {
            J ds = J::array();
            for (J& x : sh["dims"])
              if (x.value("id", std::string()) != touche) ds.push_back(std::move(x));
            sh["dims"] = std::move(ds);
            sel_.cote.clear();
          }
          redessiner();
          valider(L"texte cote");
        }
      }
    }
    return;
  }
  coteAppui_ = touche, tempsAppui_ = t, appuiPx_ = px, appuiPy_ = py;
  if (!dim.empty()) {
    sel_.cote = dim, sel_.vue.clear();
    sel_.ordCote.clear(), sel_.ordPt = -2;
    if (J* d = plan::coteParId(sh, dim)) {
      if (d->value("kind", std::string()) == "ord") sel_.ordCote = dim, sel_.ordPt = plan::pointOrdonnee(sh, *d, x, y);
      g.cote = plan::saisirCote(mep_, planche_, piece_, calcul_, *d, x, y, z);
      if (outilActif_ && outil_.tool == "dim") g.rappel = plan::coteRappelSous(mep_, planche_, piece_, calcul_, *d, x, y, z);
    }
    g.sorte = Geste::COTE, g.id = dim;
    geste_ = g;
    redessiner();
    if (surSelection) surSelection();
    return;
  }
  // Un trait d'axe : sélection ; saisi près d'une extrémité, on la tire
  if (const auto ax = plan::axeSous(mep_, planche_, piece_, calcul_, x, y, z)) {
    sel_ = plan::SelectionPlan();
    sel_.axeVue = ax->vid, sel_.axeId = ax->id, sel_.axeAk = ax->ak;
    if (ax->end && (ax->libre || ax->ligne)) {
      g.sorte = Geste::AXE, g.axe = *ax;
      geste_ = g;
    }
    redessiner();
    if (surSelection) surSelection();
    return;
  }
  // Une vue : sélection, glisser pour la déplacer
  const std::string v = plan::vueSous(sh, mep_, piece_, calcul_, x, y);
  if (!v.empty() && !ajout && !outilActif_) {  // mepOnDbl
    const bool dbl = !essaiEnCours_ && v == vueAppui_ && (t - tempsVue_).ToLong() < 450 && std::hypot(px - vueAppuiPx_, py - vueAppuiPy_) < 6;
    vueAppui_ = v, tempsVue_ = t, vueAppuiPx_ = px, vueAppuiPy_ = py;
    if (dbl) {
      vueAppui_.clear();
      if (plan::hachureSous(sh, mep_, piece_, calcul_, x, y)) {
        dialogueHachures();
        return;
      }
      J* w = plan::vueParId(sh, v);
      wxTextEntryDialog dlg(this, L"Libellé de la vue :", L"Mise en plan", wxString::FromUTF8(w->value("label", std::string())));
      if (dlg.ShowModal() == wxID_OK) {
        (*w)["label"] = dlg.GetValue().utf8_string();
        redessiner();
        valider(L"libellé vue");
        if (surSelection) surSelection();
      }
      return;
    }
  }
  if (!v.empty()) {
    const J* w = plan::vueParId(sh, v);
    const bool avaitCote = !sel_.cote.empty();
    sel_.vue = v, sel_.cote.clear();
    g.sorte = Geste::VUE, g.id = v;
    g.ox = x - w->value("x", 0.0), g.oy = y - w->value("y", 0.0);
    geste_ = g;
    if (avaitCote) redessiner();
    else Refresh(false);
    if (surSelection) surSelection();
    return;
  }
  // Le fond de la planche : sélection au cadre
  const bool avaitCote = !sel_.cote.empty();
  if (!ajout) toutEffacer();
  g.sorte = Geste::CADRE, g.ox = x, g.oy = y;
  geste_ = g;
  if (avaitCote) redessiner();
  else Refresh(false);
  if (surSelection) surSelection();
}

void PlanVue::bouge(double x, double y, double px, double py) {
  J& sh = planche();
  geste_.curX = x, geste_.curY = y;
  // Un clic ne doit pas déplacer : 3 pixels avant de commencer
  if (!geste_.commence) {
    if (std::hypot(px - geste_.px0, py - geste_.py0) < 3) return;
    geste_.commence = true;
  }
  switch (geste_.sorte) {
    case Geste::LOCALE:
      if (J* v = plan::vueParId(sh, sel_.locVue)) {
        geste_.locPts[geste_.locI] = {(x - v->value("x", 0.0)) / v->value("scale", 1.0), (y - v->value("y", 0.0)) / v->value("scale", 1.0)};
        geste_.bouge = true;
        Refresh(false);
      }
      break;
    case Geste::ESQUISSE: {
      std::string m;
      if (plan::bougerEsquisse(sh, esq_, geste_.baseSk, geste_.cleSk, geste_.ox, geste_.oy, x, y, geste_.averti, m)) {
        geste_.bouge = true;
        redessiner();
      }
      if (surEtat && !m.empty()) surEtat(wxString::FromUTF8(m));
      break;
    }
    case Geste::FLECHE:
      if (plan::bougerFlecheCoupe(mep_, planche_, piece_, calcul_, geste_.coupe, x, y)) {
        geste_.bouge = true;
        redessiner();
      }
      break;
    case Geste::TRONCON:
      plan::bougerTroncon(mep_, planche_, piece_, calcul_, geste_.coupe, x, y, zoomRelatif());
      if (surEtat) surEtat(L"Ligne de coupe : relâchez pour la placer.");
      break;
    case Geste::VUE:
      if (J* v = plan::vueParId(sh, geste_.id)) {
        plan::deplacerVue(sh, *v, x - geste_.ox, y - geste_.oy);
        geste_.bouge = true;
        redessiner();
      }
      break;
    case Geste::AXE:
      if (!geste_.debut) {
        if (std::hypot(px - geste_.px0, py - geste_.py0) < 3) break;
        geste_.debut = true;
      }
      if (plan::tirerAxe(mep_, planche_, piece_, calcul_, geste_.axe, x, y, zoomRelatif())) {
        geste_.bouge = true;
        redessiner();
      }
      break;
    case Geste::COTE:
      if (J* d = plan::coteParId(sh, geste_.id)) {
        if (geste_.jogI >= 0) {
          J* v = vueCourante(d->value("vid", std::string()));
          if (!v || !(*d)["pts"].is_array() || geste_.jogI >= static_cast<int>((*d)["pts"].size())) break;
          J& q = (*d)["pts"][geste_.jogI];
          const double sc = v->value("scale", 1.0);
          const double jog = js::arrondi(geste_.jogJ0 + (d->value("axis", std::string()) == "y" ? y - geste_.cote.sy : x - geste_.cote.sx) / sc, 3);
          if (std::abs(jog) < 1e-3) q.erase("jog");
          else q["jog"] = jog;
          geste_.bouge = true;
          redessiner();
          break;
        }
        if (plan::deplacerCote(mep_, planche_, piece_, calcul_, *d, x, y, geste_.cote)) {
          geste_.bouge = true;
          redessiner();
        }
      }
      break;
    case Geste::BULLE:
      if (J* b = plan::bulleParId(sh, geste_.id)) {
        double ax, ay;
        plan::pointBulle(sh, *b, ax, ay);
        (*b)["dx"] = js::arrondi(x - geste_.ox - ax, 2);
        (*b)["dy"] = js::arrondi(y - geste_.oy - ay, 2);
        geste_.bouge = true;
        redessiner();
      }
      break;
    case Geste::TITRE:
      if (J* v = plan::vueParId(sh, geste_.id)) {
        plan::deplacerTitre(sh, mep_, piece_, calcul_, *v, y, geste_.oy);
        geste_.bouge = true;
        redessiner();
      }
      break;
    default:
      break;
  }
}

void PlanVue::relache() {
  const Geste g = geste_;
  geste_ = Geste();
  if (g.sorte == Geste::LOCALE) {  // mepLocUp
    if (g.bouge)
      if (J* l = plan::coupeLocale(planche(), sel_.locVue, sel_.locId)) {
        J pts = J::array();
        for (const auto& q : g.locPts) pts.push_back(J::array({js::arrondi(q[0], 3), js::arrondi(q[1], 3)}));
        (*l)["pts"] = std::move(pts);
        redessiner();
        valider(g.locIns ? L"coupe locale : point ajouté" : L"coupe locale : forme");
        if (surEtat) surEtat(L"Coupe locale : forme modifiée.");
      }
    Refresh(false);
    return;
  }
  if (g.sorte == Geste::COTE && g.jogI >= 0 && !g.bouge) {  // Ctrl + clic sans glisser : cassure retirée
    if (J* d = plan::coteParId(planche(), g.id))
      if ((*d)["pts"].is_array() && g.jogI < static_cast<int>((*d)["pts"].size()) && (*d)["pts"][g.jogI].contains("jog")) {
        (*d)["pts"][g.jogI].erase("jog");
        redessiner();
        valider(L"cassure retirée");
        if (surEtat) surEtat(L"Cassure retirée.");
      }
    return;
  }
  if (g.sorte == Geste::COTE && !g.bouge && !g.rappel.empty() && outilActif_) {  // un rappel cliqué : le départ d'une chaîne
    if (J* d = plan::coteParId(planche(), g.id))
      if (plan::commencerChaine(mep_, planche_, piece_, calcul_, outil_, *d, g.rappel)) {
        sel_ = plan::SelectionPlan();
        if (surEtat) surEtat(L"Chaîne de cotes : cliquez le point suivant (clic droit : accrochage, Échap termine).");
        redessiner();
        if (surSelection) surSelection();
        return;
      }
  }
  if (g.sorte == Geste::CADRE) {
    if (g.commence) {
      // De gauche à droite : ce qui est entièrement dans le cadre ; de droite à gauche : tout ce qu'il touche (mepBoxSelect)
      const double x0 = std::min(g.ox, g.curX), x1 = std::max(g.ox, g.curX), y0 = std::min(g.oy, g.curY), y1 = std::max(g.oy, g.curY);
      const bool capture = g.curX < g.ox;
      J& sh = planche();
      if (!g.ajout) sel_ = plan::SelectionPlan();
      int n = plan::cadreEsquisse(mep_, planche_, piece_, calcul_, esq_, sel_, x0, y0, x1, y1, capture);
      if (!esq_.tbEdit && sh["views"].is_array())
        for (const J& v : sh["views"]) {
          const std::string id = v.value("id", std::string());
          double x, y, w, h;
          if (sel_.lotVues.count(id) || !plan::boiteDeVue(v, sh, mep_, piece_, calcul_, x, y, w, h)) continue;
          const bool dans = x >= x0 && x + w <= x1 && y >= y0 && y + h <= y1;
          const bool touche = x <= x1 && x + w >= x0 && y <= y1 && y + h >= y0;
          if (capture ? touche : dans) sel_.lotVues.insert(id), n++;
        }
      if (!esq_.tbEdit && sh.contains("dims") && sh["dims"].is_array())
        for (const J& d : sh["dims"]) {
          const std::string id = d.value("id", std::string());
          const auto it = calcul_.cotesVues.find(id);
          if (sel_.lotCotes.count(id) || it == calcul_.cotesVues.end()) continue;
          bool tous = !it->second.traits.empty(), un = false;
          const auto inside = [&](double qx, double qy) { return qx >= x0 && qx <= x1 && qy >= y0 && qy <= y1; };
          for (const plan::CoteVue::Seg& s : it->second.traits) {
            const bool a = inside(s.x1, s.y1), b = inside(s.x2, s.y2);
            if (!(a && b)) tous = false;
            if (a || b) un = true;
          }
          const bool tin = it->second.aTexte && inside(it->second.tx, it->second.ty);
          if (it->second.aTexte && !tin) tous = false;
          if (capture ? (un || tin) : tous) sel_.lotCotes.insert(id), n++;
        }
      if (surEtat) surEtat(wxString::Format(L"%s : %d élément(s) ajouté(s) à la sélection.", capture ? L"Capture" : L"Fenêtre", n));
      redessiner();
      if (surSelection) surSelection();
    } else if (!g.cleSk.empty()) {  // un clic sur un texte : le choisir
      plan::choisirEsquisse(sel_, g.cleSk, g.ajout);
      redessiner();
      if (surSelection) surSelection();
    } else if (esq_.tbEdit && !g.ajout && !sel_.skSel.empty()) {
      sel_.skSel.clear();
      redessiner();
      if (surSelection) surSelection();
    } else {
      Refresh(false);
    }
    return;
  }
  if (g.sorte == Geste::TRONCON) {
    Geste h = g;
    wxBusyCursor attente;
    if (plan::lacherTroncon(mep_, planche_, piece_, calcul_, h.coupe)) {
      redessiner();
      valider(L"ligne de coupe");
    }
    return;
  }
  if (!g.bouge) return;
  if (g.sorte == Geste::ESQUISSE) {
    valider(L"déplacement esquisse");
    if (surSelection) surSelection();
    return;
  }
  valider(g.sorte == Geste::FLECHE ? L"flèche de coupe" : g.sorte == Geste::VUE ? L"déplacement vue" : g.sorte == Geste::COTE ? L"déplacement cote" : g.sorte == Geste::BULLE ? L"bulle" : g.sorte == Geste::AXE ? L"longueur axe" : L"titre de vue");
}

void PlanVue::supprimer() {
  J& sh = planche();
  if (sel_.lotVues.empty() && sel_.lotCotes.empty() && !sel_.skSel.empty()) {  // mepSkDeleteSel
    plan::supprimerEsquisse(sh, esq_, sel_);
    redessiner();
    valider(L"suppression esquisse");
  } else if (!sel_.lotVues.empty() || !sel_.lotCotes.empty()) {
    const size_t nv = sel_.lotVues.size(), nd = sel_.lotCotes.size();
    if (!sel_.skSel.empty()) plan::supprimerEsquisse(sh, esq_, sel_);
    if (!sel_.lotVues.empty()) plan::supprimerVues(sh, sel_.lotVues);
    J ds = J::array();
    if (sh.contains("dims") && sh["dims"].is_array())
      for (J& d : sh["dims"])
        if (!sel_.lotCotes.count(d.value("id", std::string()))) ds.push_back(std::move(d));
    sh["dims"] = std::move(ds);
    sel_ = plan::SelectionPlan();
    if (surEtat) surEtat(wxString::Format(L"Supprimé : %zu vue(s), %zu cote(s).", nv, nd));
    redessiner();
    valider(L"suppression de la sélection");
  } else if (sel_.pointOrd() >= 0) {  // mepOrdDelPt
    supprimerPointOrdonnee(sel_.cote, sel_.pointOrd());
  } else if (!sel_.locId.empty() && sel_.locVue == sel_.vue && plan::coupeLocale(sh, sel_.locVue, sel_.locId)) {
    supprimerLocale(sel_.locVue, sel_.locId);
  } else if (!sel_.bulle.empty()) {
    J bs = J::array();
    for (J& b : sh["balloons"])
      if (b.value("id", std::string()) != sel_.bulle) bs.push_back(std::move(b));
    sh["balloons"] = std::move(bs);
    sel_.bulle.clear();
    redessiner();
    valider(L"suppression bulle");
  } else if (!sel_.axeVue.empty()) {
    J* v = plan::vueParId(sh, sel_.axeVue);
    if (!v) return;
    if (sel_.axeId.empty()) {  // axe automatique : sa longueur d'origine
      if (v->contains("axExt") && (*v)["axExt"].is_object() && (*v)["axExt"].contains(sel_.axeAk)) {
        (*v)["axExt"].erase(sel_.axeAk);
        redessiner();
        valider(L"longueur axe d’origine");
      }
      return;
    }
    plan::enleverAxe(*v, sel_.axeId);
    sel_ = plan::SelectionPlan();
    redessiner();
    valider(L"suppression axe");
    if (surSelection) surSelection();
  } else if (!sel_.cote.empty()) {
    J ds = J::array();
    for (J& d : sh["dims"])
      if (d.value("id", std::string()) != sel_.cote) ds.push_back(std::move(d));
    sh["dims"] = std::move(ds);
    sel_.cote.clear();
    redessiner();
    valider(L"suppression cote");
  } else if (!sel_.vue.empty()) {
    plan::supprimerVue(sh, sel_.vue);
    sel_.vue.clear();
    redessiner();
    valider(L"suppression de vue");
  } else {
    return;
  }
  if (surSelection) surSelection();
}

// Le cadre bleu de la sélection, en pointillés pour le survol, et le cadre de sélection
void PlanVue::peindreSelection(wxDC& dc) {
  if (!mep_.is_object() || !mep_.contains("sheets") || mep_["sheets"].empty()) return;
  J& sh = planche();
  if (grille_) {  // tous les 10 mm
    dc.SetPen(wxPen(th(wxColour(0xb4, 0xb8, 0xc0))));
    dc.SetBrush(*wxTRANSPARENT_BRUSH);
    const double gx = ox_ + decalage_.x, gy = oy_ + decalage_.y;
    for (double x = 0; x <= largeurPage_; x += 10) dc.DrawLine(static_cast<int>(gx + x * zoom_), static_cast<int>(gy), static_cast<int>(gx + x * zoom_), static_cast<int>(gy + hauteurPage_ * zoom_));
    for (double y = 0; y <= hauteurPage_; y += 10) dc.DrawLine(static_cast<int>(gx), static_cast<int>(gy + y * zoom_), static_cast<int>(gx + largeurPage_ * zoom_), static_cast<int>(gy + y * zoom_));
  }
  const wxColour bleu(0x0a, 0x84, 0xff);
  dc.SetBrush(*wxTRANSPARENT_BRUSH);
  const double ox = ox_ + decalage_.x, oy = oy_ + decalage_.y;
  if (!sel_.locId.empty() && sel_.locVue == sel_.vue) {  // mepLocDraw : forme et points de la coupe choisie
    const J* lv = plan::vueParId(sh, sel_.locVue);
    const J* lo = plan::coupeLocale(sh, sel_.locVue, sel_.locId);
    if (lv && lo) {
      std::vector<std::array<double, 2>> P;
      if (geste_.sorte == Geste::LOCALE) P = geste_.locPts;
      else
        for (const J& q : (*lo)["pts"]) P.push_back({q[0].get<double>(), q[1].get<double>()});
      const double vx = lv->value("x", 0.0), vy = lv->value("y", 0.0), sc = lv->value("scale", 1.0);
      const auto C = plan::courbeLocale(P);
      dc.SetPen(wxPen(bleu, 1));
      std::vector<wxPoint> ptsL;
      for (const auto& q : C) ptsL.emplace_back(static_cast<int>(ox + (vx + q[0] * sc) * zoom_), static_cast<int>(oy + (vy + q[1] * sc) * zoom_));
      if (!ptsL.empty()) {
        ptsL.push_back(ptsL[0]);
        dc.DrawLines(static_cast<int>(ptsL.size()), ptsL.data());
      }
      dc.SetBrush(*wxWHITE_BRUSH);
      const int hs = FromDIP(4);
      for (const auto& q : P) dc.DrawRectangle(static_cast<int>(ox + (vx + q[0] * sc) * zoom_) - hs, static_cast<int>(oy + (vy + q[1] * sc) * zoom_) - hs, 2 * hs, 2 * hs);
      dc.SetBrush(*wxTRANSPARENT_BRUSH);
    }
  }
  const auto cadre = [&](const std::string& id, bool plein) {
    const J* v = plan::vueParId(sh, id);
    double x, y, w, h;
    if (!v || !plan::boiteDeVue(*v, sh, mep_, piece_, calcul_, x, y, w, h)) return;
    wxPen p(bleu, plein ? FromDIP(2) : FromDIP(1), plein ? wxPENSTYLE_SOLID : wxPENSTYLE_SHORT_DASH);
    dc.SetPen(p);
    dc.DrawRectangle(static_cast<int>(ox + (x - 4) * zoom_), static_cast<int>(oy + (y - 4) * zoom_), static_cast<int>((w + 8) * zoom_), static_cast<int>((h + 8) * zoom_));
  };
  if (!vueSurvol_.empty() && vueSurvol_ != sel_.vue && !sel_.lotVues.count(vueSurvol_)) cadre(vueSurvol_, false);
  if (!sel_.vue.empty()) cadre(sel_.vue, true);
  for (const std::string& id : sel_.lotVues) cadre(id, true);
  if (commandeActive_ || (outilActif_ && !plan::estOutilEsquisse(outil_.tool)) || !sel_.axeVue.empty()) {  // mepVcmdDraw, le survol des outils, l'axe choisi
    const plan::ApercuCommande a = commandeActive_ ? plan::apercuCommande(mep_, planche_, piece_, calcul_, commande_, zoomRelatif()) : outilActif_ ? plan::apercuOutil(mep_, planche_, piece_, calcul_, outil_, zoomRelatif()) : plan::apercuAxeChoisi(mep_, planche_, piece_, calcul_, sel_.axeVue, sel_.axeId, sel_.axeAk, zoomRelatif());
    const auto X = [&](double q) { return static_cast<int>(ox + q * zoom_); };
    const auto Y = [&](double q) { return static_cast<int>(oy + q * zoom_); };
    const auto L = [&](double q) { return static_cast<int>(q * zoom_); };
    for (const auto& r : a.cadres) {
      dc.SetPen(wxPen(bleu, 1, r.fantome ? wxPENSTYLE_SHORT_DASH : wxPENSTYLE_SOLID));
      dc.DrawRectangle(X(r.x), Y(r.y), L(r.w), L(r.h));
    }
    for (const auto& r : a.ronds) {
      dc.SetPen(wxPen(bleu, 1, r.fantome ? wxPENSTYLE_SHORT_DASH : wxPENSTYLE_SOLID));
      dc.DrawCircle(X(r.x), Y(r.y), std::max(1, L(r.r)));
    }
    for (const auto& s : a.traits) {
      const wxColour coul = s.mauvais ? th(wxColour(0xff, 0x45, 0x3a)) : bleu;
      dc.SetPen(wxPen(coul, FromDIP(2)));
      dc.DrawLine(X(s.x1), Y(s.y1), X(s.x2), Y(s.y2));
      if (s.fleche) {
        const double an = std::atan2(s.y2 - s.y1, s.x2 - s.x1), n = FromDIP(8);
        for (const double b : {an + 2.7, an - 2.7}) dc.DrawLine(X(s.x2), Y(s.y2), X(s.x2) + static_cast<int>(n * std::cos(b)), Y(s.y2) + static_cast<int>(n * std::sin(b)));
      }
    }
    if (a.aSnap) {
      const int h = FromDIP(5);
      dc.SetPen(wxPen(a.snapAxe ? th(wxColour(0xff, 0x45, 0x3a)) : th(wxColour(0xff, 0xd6, 0x0a)), FromDIP(2)));
      dc.DrawRectangle(X(a.snapX) - h, Y(a.snapY) - h, 2 * h, 2 * h);
    }
    dc.SetFont(GetFont());
    dc.SetTextForeground(bleu);
    if (!a.texte.empty()) dc.DrawText(wxString::FromUTF8(a.texte), X(a.tx), Y(a.ty));
    for (const plan::BoutonCoupe& b : a.boutons) {
      dc.SetBrush(wxBrush(b.act == "ok" ? th(wxColour(0x30, 0xd1, 0x58)) : th(wxColour(0x2b, 0x2e, 0x34))));
      dc.SetPen(wxPen(th(wxColour(0xc9, 0xcc, 0xd1))));
      dc.DrawRoundedRectangle(X(b.x), Y(b.y), L(b.w), L(b.h), FromDIP(3));
      dc.SetTextForeground(*wxWHITE);
      const wxString lab = b.act == "ok" ? wxString(L"✓") : wxString(L"↶");
      const wxSize tl = dc.GetTextExtent(lab);
      dc.DrawText(lab, X(b.x) + (L(b.w) - tl.x) / 2, Y(b.y) + (L(b.h) - tl.y) / 2);
    }
    dc.SetBrush(*wxTRANSPARENT_BRUSH);
  }
  {  // mepDrawSkCtx en édition, mepDrawDraft
    const plan::ApercuEsquisse a = plan::aidesEsquisse(mep_, planche_, piece_, calcul_, esq_, outilActif_ ? &outil_ : nullptr, sel_, 1 / zoom_);
    const wxColour orange(0xff, 0x9f, 0x0a), jaune(0xff, 0xd6, 0x0a);
    const auto PX = [&](double q) { return static_cast<int>(ox + q * zoom_); };
    const auto PY = [&](double q) { return static_cast<int>(oy + q * zoom_); };
    for (const auto& l : a.lignes) {
      wxColour coul = bleu;
      int larg = 1;
      wxPenStyle st = wxPENSTYLE_SOLID;
      if (l.genre == plan::ApercuEsquisse::AIDE_POINTILLE) st = wxPENSTYLE_SHORT_DASH;
      else if (l.genre == plan::ApercuEsquisse::CONSTRUCTION) coul = orange, st = wxPENSTYLE_SHORT_DASH;
      else if (l.genre == plan::ApercuEsquisse::CHOISI) coul = orange, larg = FromDIP(2);
      else if (l.genre == plan::ApercuEsquisse::SURVOL) larg = FromDIP(2);
      else if (l.genre == plan::ApercuEsquisse::BROUILLON) coul = jaune, st = wxPENSTYLE_SHORT_DASH;
      dc.SetPen(wxPen(coul, larg, st));
      for (size_t i = 0; i + 1 < l.pts.size(); i++) dc.DrawLine(PX(l.pts[i][0]), PY(l.pts[i][1]), PX(l.pts[i + 1][0]), PY(l.pts[i + 1][1]));
    }
    for (const auto& r : a.ronds) {
      const wxColour coul = r.genre == 1 ? orange : r.genre == 2 ? th(wxColour(0xbf, 0x5a, 0xf2)) : r.genre == 3 ? th(wxColour(0xff, 0x45, 0x3a)) : th(wxColour(0x64, 0xd2, 0xff));
      dc.SetPen(wxPen(coul, FromDIP(1)));
      dc.SetBrush(r.genre == 1 ? wxBrush(orange) : *wxWHITE_BRUSH);
      dc.DrawCircle(PX(r.x), PY(r.y), std::max(FromDIP(3), static_cast<int>(r.r * zoom_)));
    }
    if (!a.glyphes.empty()) {
      wxFont f = GetFont();
      f.SetWeight(wxFONTWEIGHT_BOLD);
      for (const auto& q : a.glyphes) {
        f.SetPixelSize(wxSize(0, std::max(9, static_cast<int>(q.fs * zoom_))));
        dc.SetFont(f);
        const wxColour coul = q.choisi ? orange : bleu;
        dc.SetPen(wxPen(coul));
        dc.SetBrush(q.choisi ? wxBrush(th(wxColour(0xff, 0xe6, 0xc2))) : wxBrush(th(wxColour(0xdc, 0xec, 0xff))));
        dc.DrawRoundedRectangle(PX(q.x - q.w / 2), PY(q.y - q.h / 2), static_cast<int>(q.w * zoom_), static_cast<int>(q.h * zoom_), 2);
        const wxString t = wxString::FromUTF8(q.texte);
        const wxSize e = dc.GetTextExtent(t);
        dc.SetTextForeground(bleu);
        dc.DrawText(t, PX(q.x) - e.x / 2, PY(q.y) - e.y / 2);
      }
      dc.SetFont(GetFont());
    }
    dc.SetBrush(*wxTRANSPARENT_BRUSH);
  }
  if (geste_.sorte == Geste::CADRE && geste_.commence) {
    const bool capture = geste_.curX < geste_.ox;
    dc.SetPen(wxPen(capture ? th(wxColour(0x30, 0xd1, 0x58)) : bleu, 1, capture ? wxPENSTYLE_SHORT_DASH : wxPENSTYLE_SOLID));
    const double x0 = std::min(geste_.ox, geste_.curX), y0 = std::min(geste_.oy, geste_.curY);
    dc.DrawRectangle(static_cast<int>(ox + x0 * zoom_), static_cast<int>(oy + y0 * zoom_), static_cast<int>(std::abs(geste_.curX - geste_.ox) * zoom_), static_cast<int>(std::abs(geste_.curY - geste_.oy) * zoom_));
  }
}

void PlanVue::reprendre(const std::string& texteDoc) {
  J racine;
  try {
    racine = J::parse(texteDoc);
  } catch (const std::exception&) {
    return;
  }
  top_ = racine.contains("doc") && racine["doc"].is_object() ? racine["doc"] : racine;
  mep_ = top_.contains("mep") ? top_["mep"] : J::object();
  plan::normaliser(mep_);
  plan::lireStyleEsquisse(mep_, esq_);
  if (planche_ >= static_cast<int>(mep_["sheets"].size())) planche_ = 0;
  sel_ = plan::SelectionPlan();
  geste_ = Geste();
  aJour_ = true;
  redessiner();
  if (surSelection) surSelection();
}

// {"presse":[x,y]}, {"glisse":[x,y]}, {"lache":1}, {"touche":"Suppr"}, en mm sur la feuille
// Échap, d'où que vienne le clavier (le cadre le renvoie ici même quand un bouton du panneau a le focus) :
// abandonne d'abord le geste en cours, puis l'outil, puis la sélection
bool PlanVue::echap() {
  if (ajoutBulle_) {
    ajoutBulle_ = false;
    if (surEtat) surEtat(L"＋ Bulle terminé.");
    if (surSelection) surSelection();
    return true;
  }
  if (!alignement_.empty()) {
    alignement_.clear();
    if (surEtat) surEtat(L"Alignement annulé.");
    return true;
  }
  if (!commandeActive_ && echapEsquisse()) return true;
  if (outilActif_) {
    if (outil_.aInt) {  // mepIntCancel
      outil_.aInt = false, outil_.aSnapHov = false;
      if (surEtat) surEtat(L"Intersection annulée : cliquez une ligne ou un cercle (clic droit pour un autre accrochage).");
      redessiner();
      return true;
    }
    if (!outil_.ord.empty() || outil_.tool == "ordx" || outil_.tool == "ordy") {
      quitterOutil();
      if (surEtat) surEtat(L"Cotation d’ordonnées terminée.");
      return true;
    }
    if (outil_.enChaine) {  // mepChainEnd : l'outil Cote reste actif
      const int n = outil_.chaineN;
      outil_.enChaine = false, outil_.dim = nullptr, outil_.snapMode.clear();
      if (surEtat) surEtat(n ? wxString::Format(L"Chaîne de cotes terminée : %d cote%s alignée%s.", n, n > 1 ? L"s" : L"", n > 1 ? L"s" : L"") : wxString(L"Chaîne de cotes terminée."));
      redessiner();
      return true;
    }
    quitterOutil();
    return true;
  }
  if (commandeActive_) {
    finirCommande(L"Commande annulée.");
    return true;
  }
  if (!sel_.locId.empty()) {
    sel_.locVue.clear(), sel_.locId.clear();
    Refresh(false);
    return true;
  }
  geste_ = Geste();
  sel_ = plan::SelectionPlan();
  redessiner();
  if (surSelection) surSelection();
  return true;
}

plan::J PlanVue::essaiPerf(int n) {
  J r;
  if (!planPret()) return r;
  n = std::max(1, n);
  if (ajuster_) ajusterFeuille();
  const wxSize t = GetClientSize();
  wxStopWatch c;
  for (int i = 0; i < n; i++) construire();
  r["construire"] = c.Time() / static_cast<double>(n);
  wxBitmap b(std::max(1, t.x), std::max(1, t.y), 24);
  c.Start();
  for (int i = 0; i < n; i++) {
    wxMemoryDC m(b);
    m.Clear();
    std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::Create(m));
    if (g) peindre(*g);
  }
  r["peindre"] = c.Time() / static_cast<double>(n);
  {  // ce que coûte chaque sorte de primitive : on la retire et on repeint
    const std::vector<Prim> tout = prims_;
    const char* noms[] = {"sansTraits", "sansRemplis", "sansTextes", "sansImages", "sansHalos"};
    for (int k = 0; k < 5; k++) {
      prims_.clear();
      for (const Prim& p : tout) {
        if (k < 4 && p.genre == static_cast<Prim::Genre>(k)) continue;
        prims_.push_back(p);
        if (k == 4) prims_.back().halo = 0;
      }
      c.Start();
      for (int i = 0; i < n; i++) {
        wxMemoryDC m(b);
        m.Clear();
        std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::Create(m));
        if (g) peindre(*g);
      }
      r[noms[k]] = c.Time() / static_cast<double>(n);
    }
    prims_ = tout;
    int nt = 0, nh = 0, np = 0;
    for (const Prim& p : tout) {
      if (p.genre == Prim::TEXTE) nt++, nh += p.halo > 0;
      if (p.genre == Prim::TRAITS) for (const Trait& t : p.traits) np += static_cast<int>(t.pts.size());
    }
    r["textes"] = nt, r["halos"] = nh, r["points"] = np;
  }
  r["prims"] = prims_.size();
  r["taille"] = {t.x, t.y};
  c.Start();
  for (int i = 0; i < n; i++) {
    wxMemoryDC m(b);
    peindreSelection(m);
  }
  r["selection"] = c.Time() / static_cast<double>(n);
  // Le survol pendant la pose d'une cote, sur une grille de points de la feuille
  lancerOutil("dim");
  int touche = 0;
  c.Start();
  for (int i = 0; i < n; i++) {
    const double x = largeurPage_ * (0.2 + 0.6 * (i % 7) / 6.0), y = hauteurPage_ * (0.2 + 0.6 * (i / 7 % 5) / 4.0);
    curseurX_ = x, curseurY_ = y;
    if (plan::survolOutil(mep_, planche_, piece_, calcul_, outil_, x, y, zoomRelatif())) touche++, redessiner();
  }
  r["survolCote"] = c.Time() / static_cast<double>(n);
  r["survolRedessine"] = touche;
  quitterOutil();
  c.Start();
  for (int i = 0; i < n; i++) {
    const double x = largeurPage_ * (0.2 + 0.6 * (i % 7) / 6.0), y = hauteurPage_ * (0.2 + 0.6 * (i / 7 % 5) / 4.0);
    plan::vueSous(planche(), mep_, piece_, calcul_, x, y);
  }
  r["survolVue"] = c.Time() / static_cast<double>(n);
  imageBonne_ = false;
  return r;
}

void PlanVue::essaiGeste(const J& e) {
  const auto pixelsX = [&](double x) { return ox_ + x * zoom_; };
  const auto pixelsY = [&](double y) { return oy_ + y * zoom_; };
  if (ajuster_) ajusterFeuille();
  if (e.contains("presse")) {
    const double x = e["presse"][0], y = e["presse"][1];
    essaiEnCours_ = true;
    enfonce(x, y, e.value("maj", false), e.value("ctrl", false), pixelsX(x), pixelsY(y));
    essaiEnCours_ = false;
  }
  if (e.contains("glisse")) {
    const double x = e["glisse"][0], y = e["glisse"][1];
    bouge(x, y, pixelsX(x), pixelsY(y));
  }
  if (e.contains("survol")) {
    curseurX_ = e["survol"][0], curseurY_ = e["survol"][1];
    if (commandeActive_) commande_.curX = curseurX_, commande_.curY = curseurY_, commande_.aCur = true;
    else if (outilActif_ && plan::estOutilEsquisse(outil_.tool)) plan::survolEsquisse(mep_, planche_, piece_, calcul_, esq_, outil_, curseurX_, curseurY_, 7 / zoom_, zoomRelatif());
    else if (outilActif_ && plan::survolOutil(mep_, planche_, piece_, calcul_, outil_, curseurX_, curseurY_, zoomRelatif())) redessiner();
  }
  if (e.contains("lache")) relache();
  if (e.contains("zoom")) {  // [facteur, x, y] : x, y (mm de la feuille) au centre de la vue
    ajuster_ = false;
    zoom_ *= e["zoom"][0].get<double>();
    const wxSize t = GetClientSize();
    ox_ = t.x / 2.0 - e["zoom"][1].get<double>() * zoom_, oy_ = t.y / 2.0 - e["zoom"][2].get<double>() * zoom_;
    imageBonne_ = false;
    Refresh();
    Update();
  }
  if (e.contains("importerDxf")) importerDxf(e["importerDxf"].get<std::string>());
  if (e.contains("remplacerDxf") && !sel_.vue.empty()) remplacerDxf(sel_.vue, e["remplacerDxf"].get<std::string>());
  if (e.contains("exporter")) exporterVers(e["exporter"].get<std::string>(), e.value("fichier", std::string()));
  if (e.contains("bouton")) boutonRuban(wxString::FromUTF8(e["bouton"].get<std::string>()));
  if (e.contains("menu")) menuContextuel(e.value("x", curseurX_), e.value("y", curseurY_), e["menu"].get<std::string>());
  if (e.contains("touche")) {
    const std::string t = e["touche"];
    if (t == "Suppr") supprimer();
    if (t == "Entree" && outilActif_ && outil_.tool == "axis") {
      std::string lib;
      plan::validerMotifAxe(mep_, planche_, piece_, calcul_, outil_, lib);
      if (!lib.empty()) redessiner(), valider(wxString::FromUTF8(lib));
    }
    if (t == "Entree" && outilActif_ && outil_.tool != "axis") quitterOutil();
    if (t == "Echap") echap();
    if (t == "Entree") plan::validerCoupe(commande_);
    if (t == "Retour") plan::annulerPointCoupe(commande_);
  }
}

// mepRulers, mepCoordShow : les règles en mm du papier, alignées sur la feuille quel que soit le zoom ; Y part du bas de la planche
void PlanVue::peindreRegles(wxDC& dc, const wxSize& t) {
  if (mep_.is_object() && mep_.contains("prefs") && mep_["prefs"].is_object() && mep_["prefs"].contains("ls") && mep_["prefs"]["ls"].value("mep_rulers", std::string()) == "0") return;
  const int E = FromDIP(16), ho = hauteurOnglets();
  const wxColour fond(0x18, 0x1a, 0x1e), encre(0xc9, 0xcc, 0xd1), accent(0x4d, 0xa3, 0xff);
  const double S = zoom_, ox = ox_ + decalage_.x, oy = oy_ + decalage_.y;
  dc.SetPen(*wxTRANSPARENT_PEN);
  dc.SetBrush(wxBrush(fond));
  dc.DrawRectangle(0, ho, t.x, E);
  dc.DrawRectangle(0, ho, E, t.y - ho);
  double st = 200;
  for (const double v : {1., 2., 5., 10., 20., 50., 100., 200.})
    if (v * S >= FromDIP(6)) {
      st = v;
      break;
    }
  const double big = st <= 2 ? 10 : st <= 10 ? 50 : st <= 50 ? 100 : 500;
  dc.SetPen(wxPen(encre));
  dc.SetTextForeground(encre);
  wxFont f = GetFont();
  f.SetPixelSize(wxSize(0, FromDIP(9)));
  dc.SetFont(f);
  const auto multiple = [](double v, double m) { return std::abs(std::fmod(v, m)) < 1e-6; };
  for (double x = 0; x <= largeurPage_ + 1e-6; x += st) {
    const int X = static_cast<int>(ox + x * S);
    if (X < E || X > t.x) continue;
    const bool M = multiple(x, big);
    const int h = M ? E : multiple(x, st * 5) ? FromDIP(9) : FromDIP(5);
    dc.DrawLine(X, ho + E - h, X, ho + E);
    if (M) dc.DrawText(wxString::Format("%g", x), X + FromDIP(2), ho);
  }
  for (double y = 0; y <= hauteurPage_ + 1e-6; y += st) {
    const int Y = static_cast<int>(oy + (hauteurPage_ - y) * S);
    if (Y < ho + E || Y > t.y) continue;
    const bool M = multiple(y, big);
    const int h = M ? E : multiple(y, st * 5) ? FromDIP(9) : FromDIP(5);
    dc.DrawLine(E - h, Y, E, Y);
    if (M) dc.DrawRotatedText(wxString::Format("%g", y), 0, Y - FromDIP(2), 90);
  }
  if (curseurDedans_) {
    const int cx = static_cast<int>(ox + curseurX_ * S), cy = static_cast<int>(oy + curseurY_ * S);
    dc.SetPen(wxPen(accent, FromDIP(1) + 1));
    if (cx >= E) dc.DrawLine(cx, ho, cx, ho + E);
    if (cy >= ho + E) dc.DrawLine(0, cy, E, cy);
    // Les coordonnées, en bas à droite
    const wxString lib = wxString::Format("X %.1f  Y %.1f mm", curseurX_, hauteurPage_ - curseurY_);
    wxFont fc = GetFont();
    fc.SetWeight(wxFONTWEIGHT_SEMIBOLD);
    dc.SetFont(fc);
    const wxSize tl = dc.GetTextExtent(lib);
    const wxRect r(t.x - tl.x - FromDIP(22), t.y - tl.y - FromDIP(10), tl.x + FromDIP(14), tl.y + FromDIP(4));
    dc.SetPen(*wxTRANSPARENT_PEN);
    dc.SetBrush(wxBrush(th(wxColour(0x30, 0x33, 0x39))));
    dc.DrawRoundedRectangle(r, FromDIP(6));
    dc.SetTextForeground(*wxWHITE);
    dc.DrawText(lib, r.x + FromDIP(7), r.y + FromDIP(2));
  }
  dc.SetPen(*wxTRANSPARENT_PEN);
  dc.SetBrush(wxBrush(fond));
  dc.DrawRectangle(0, ho, E, E);
}

int PlanVue::ongletSous(const wxPoint& p) const {
  for (size_t i = 0; i < onglets_.size(); i++)
    if (onglets_[i].Contains(p)) return static_cast<int>(i);
  return -1;
}

void PlanVue::oublier() {
  aJour_ = false;
  calcul_.oublier();
  images3d_.clear();
}

void PlanVue::charger(const std::string& texteDoc, const Document& d, const ResultatRejeu& r, const assemblage::Solides& S) {
  if (aJour_) return;
  wxBusyCursor attente;
  J racine;
  try {
    racine = J::parse(texteDoc);
  } catch (const std::exception&) {
    racine = J::object();
  }
  top_ = racine.contains("doc") && racine["doc"].is_object() ? racine["doc"] : racine;
  mep_ = top_.contains("mep") ? top_["mep"] : J::object();
  plan::normaliser(mep_);
  plan::lireStyleEsquisse(mep_, esq_);
  piece_ = plan::pieceDe(d, r, top_);
  plan::completerAssemblage(piece_, d, S);
  planche_ = mep_.contains("cur") && mep_["cur"].is_number() ? mep_["cur"].get<int>() : 0;
  if (planche_ < 0 || planche_ >= static_cast<int>(mep_["sheets"].size())) planche_ = 0;
  aJour_ = true;
  ajuster_ = true;
  // Une planche vide reçoit ses vues d'elle-même, sans étape d'annulation
  try {
    if (plan::vuesAutomatiques(mep_, planche_, piece_, calcul_)) {
      sel_ = plan::SelectionPlan();
      sel_.vue = planche()["views"].back().value("id", std::string());
      if (surVuesAutomatiques) surVuesAutomatiques(mep_);
    }
  } catch (const std::exception&) {
  }
  construire();
  imageBonne_ = false;
  Refresh();
}

wxString PlanVue::resume() const {
  if (!mep_.is_object() || !mep_.contains("sheets") || planche_ >= static_cast<int>(mep_["sheets"].size())) return wxEmptyString;
  const J& s = mep_["sheets"][planche_];
  const size_t nv = s.contains("views") && s["views"].is_array() ? s["views"].size() : 0;
  const size_t nc = s.contains("dims") && s["dims"].is_array() ? s["dims"].size() : 0;
  return wxString::Format(L"%zu planche(s). Celle-ci : %zu vue(s), %zu cote(s).", mep_["sheets"].size(), nv, nc);
}

void PlanVue::changerPlanche(int i) {
  if (i == planche_ || !mep_.contains("sheets") || i >= static_cast<int>(mep_["sheets"].size())) return;
  wxBusyCursor attente;
  planche_ = i;
  mep_["cur"] = i;
  sel_ = plan::SelectionPlan();
  geste_ = Geste();
  vueSurvol_.clear();
  commandeActive_ = false;
  ajuster_ = true;
  construire();
  imageBonne_ = false;
  Refresh();
  if (surSelection) surSelection();
}

void PlanVue::ajusterFeuille() {
  const wxSize t = GetClientSize();
  const int ho = hauteurOnglets(), m = FromDIP(14);
  const double l = std::max(10, t.x - 2 * m), h = std::max(10, t.y - ho - 2 * m);
  zoom_ = std::min(l / largeurPage_, h / hauteurPage_);
  zoomEntier_ = zoom_;
  ox_ = (t.x - largeurPage_ * zoom_) / 2;
  oy_ = ho + (t.y - ho - hauteurPage_ * zoom_) / 2;
  ajuster_ = false;
  imageBonne_ = false;
}

void PlanVue::construire() {
  prims_.clear();
  calcul_.selection = &sel_;
  if (!mep_.contains("sheets") || !mep_["sheets"].is_array() || mep_["sheets"].empty()) return;
  plan::tailleFeuille(mep_["sheets"][planche_], largeurPage_, hauteurPage_);
  std::vector<plan::Elt> els;
  try {
    els = plan::dessiner(mep_, planche_, piece_, calcul_);
  } catch (const std::exception&) {
    return;
  }
  Palette P = paletteDe(mep_);
  if (exportEnCours_) {  // mepExportPrep : palette du papier blanc, ou tout en noir
    const std::string* bw = nullptr;
    if (mep_.contains("prefs") && mep_["prefs"].is_object() && mep_["prefs"].contains("ls") && mep_["prefs"]["ls"].contains("mep_exp_bw") && mep_["prefs"]["ls"]["mep_exp_bw"].is_string()) bw = &mep_["prefs"]["ls"]["mep_exp_bw"].get_ref<const std::string&>();
    J blanc = mep_;
    if (blanc.contains("prefs") && blanc["prefs"].contains("ls")) blanc["prefs"]["ls"]["mep_paper"] = "light";
    const std::string cotes = P.cotes;
    P = paletteDe(blanc);
    if (!plan::styleDe(mep_).couleurCotes.empty()) P.cotes = cotes;
    noirSeul_ = bw && *bw == "1";
  } else {
    noirSeul_ = false;
  }
  const plan::TaillesCotes tc = plan::taillesCotes(mep_);
  const double hF = tc.fleche * std::tan(tc.angleFleche * PI / 360);
  const wxColour papier = hex(P.papier);

  const auto traits = [&](const Rendu& r, const std::vector<std::vector<std::array<double, 2>>>& lignes) {
    // Deux traits voisins du même style vont dans le même chemin : le dessin est bien plus rapide
    const wxColour c = hex(r.trait);
    if (prims_.empty() || prims_.back().genre != Prim::TRAITS || prims_.back().couleur != c || prims_.back().largeur != r.largeur || prims_.back().cap != r.cap || prims_.back().join != r.join || prims_.back().opacite != r.opacite) {
      Prim q;
      q.genre = Prim::TRAITS, q.couleur = c, q.largeur = r.largeur, q.cap = r.cap, q.join = r.join, q.opacite = r.opacite;
      prims_.push_back(std::move(q));
    }
    for (const auto& l : lignes) {
      std::vector<std::vector<std::array<double, 2>>> morceaux;
      decouper(l, r.tirets, morceaux);
      for (auto& m : morceaux) prims_.back().traits.push_back({std::move(m), false});
    }
  };
  const auto plein = [&](const std::string& couleur, std::vector<std::array<double, 2>> pts, double op = 1) {
    Prim q;
    q.genre = Prim::REMPLI, q.couleur = hex(couleur), q.opacite = op;
    q.traits.push_back({std::move(pts), true});
    prims_.push_back(std::move(q));
  };
  const auto fleches = [&](const plan::Elt& e, const Rendu& r, const std::vector<std::array<double, 2>>& l) {
    if (l.size() < 2) return;
    const auto couleur = [&](const std::string& m) { return m.find("Sel") != std::string::npos ? std::string("#ff3b30") : m.find("mepArrK") != std::string::npos ? P.encre : P.cotes; };
    if (const std::string* m = attrDe(e, "marker-end")) {
      std::vector<std::array<double, 2>> tri;
      const auto& a = l[l.size() - 2];
      const auto& b = l.back();
      fleche(tri, b[0], b[1], b[0] - a[0], b[1] - a[1], tc.fleche * r.largeur, hF * r.largeur, m->find("mepArrS") == std::string::npos);
      if (!tri.empty()) plein(couleur(*m), std::move(tri));
    }
    if (const std::string* m = attrDe(e, "marker-start")) {
      std::vector<std::array<double, 2>> tri;
      fleche(tri, l[0][0], l[0][1], l[1][0] - l[0][0], l[1][1] - l[0][1], tc.fleche * r.largeur, hF * r.largeur, m->find("mepArrS") == std::string::npos);
      if (!tri.empty()) plein(couleur(*m), std::move(tri));
    }
  };

  // Le texte : un morceau commence à chaque x posé ; l'ancrage vaut pour tout le morceau
  struct Morceau {
    wxString t;
    std::string texteU;
    double corps = 0;
  };
  size_t i = 0;
  while (i < els.size()) {
    const plan::Elt& e = els[i];
    if (e.aide) {
      i++;
      continue;
    }
    if (e.tag == "text") {
      const Rendu r0 = renduDe(e, P);
      double rot = 0, ax = 0, ay = 0;
      if (const std::string* tr = attrDe(e, "transform")) {
        if (tr->rfind("rotate(", 0) == 0) {
          std::istringstream f(tr->substr(7));
          f >> rot >> ax >> ay;
        }
      }
      double cx = nombre(e, "x"), cy = nombre(e, "y");
      std::vector<Morceau> chunk;
      const auto vider = [&]() {
        double tot = 0;
        for (const Morceau& m : chunk) tot += plan::largeurTexte(m.texteU, m.corps, r0.gras);
        double x = cx - (r0.ancre == "middle" ? tot / 2 : r0.ancre == "end" ? tot : 0);
        for (const Morceau& m : chunk) {
          Prim q;
          q.genre = Prim::TEXTE, q.texte = m.t, q.x = x, q.y = cy, q.corps = m.corps, q.gras = r0.gras;
          q.couleur = hex(r0.fond.empty() ? "#000000" : r0.fond), q.halo = r0.halo, q.couleurHalo = papier;
          q.angle = rot, q.axeX = ax, q.axeY = ay;
          prims_.push_back(std::move(q));
          x += plan::largeurTexte(m.texteU, m.corps, r0.gras);
        }
        chunk.clear();
      };
      if (!e.txt.empty()) chunk.push_back({wxString::FromUTF8(e.txt), e.txt, r0.corps});
      size_t k = i + 1;
      while (k < els.size() && els[k].niveau > 0) {
        const plan::Elt& s = els[k];
        const bool nvX = attrDe(s, "x") != nullptr;
        if (nvX) {
          vider();
          cx = nombre(s, "x");
          if (attrDe(s, "y")) cy = nombre(s, "y");
        }
        Rendu rs = r0;
        if (const std::string* a = attrDe(s, "font-size")) rs.corps = std::strtod(a->c_str(), nullptr);
        if (!s.txt.empty()) chunk.push_back({wxString::FromUTF8(s.txt), s.txt, rs.corps});
        k++;
      }
      vider();
      i = k;
      continue;
    }
    const Rendu r = renduDe(e, P);
    if (e.tag == "line") {
      const std::vector<std::array<double, 2>> l{{nombre(e, "x1"), nombre(e, "y1")}, {nombre(e, "x2"), nombre(e, "y2")}};
      if (!r.trait.empty()) traits(r, {l});
      fleches(e, r, l);
    } else if (e.tag == "path") {
      std::vector<std::vector<std::array<double, 2>>> lignes;
      if (const std::string* d = attrDe(e, "d")) cheminEnPoints(*d, lignes);
      if (!r.fond.empty())
        for (const auto& l : lignes) plein(r.fond, l, r.opacite);
      if (!r.trait.empty()) traits(r, lignes);
      if (!lignes.empty()) {
        fleches(e, r, lignes.front());
      }
    } else if (e.tag == "circle") {
      const double cx = nombre(e, "cx"), cy = nombre(e, "cy"), rr = nombre(e, "r");
      const int n = std::min(720, std::max(24, static_cast<int>(2 * PI * rr / 0.1)));
      std::vector<std::array<double, 2>> l;
      for (int q = 0; q <= n; q++) l.push_back({cx + rr * std::cos(2 * PI * q / n), cy + rr * std::sin(2 * PI * q / n)});
      // fill="currentColor" : la couleur du trait
      if (const std::string* fa = attrDe(e, "fill"); fa && *fa == "currentColor") plein(r.trait.empty() ? P.encre : r.trait, l);
      else if (!r.fond.empty() && attrDe(e, "class") && attrDe(e, "class")->find("mepEnt") == std::string::npos && r.fond != "#000000") plein(r.fond, l, r.opacite);
      if (!r.trait.empty()) traits(r, {l});
    } else if (e.tag == "rect") {
      const double x = nombre(e, "x"), y = nombre(e, "y"), w = nombre(e, "width"), h = nombre(e, "height");
      const std::vector<std::array<double, 2>> l{{x, y}, {x + w, y}, {x + w, y + h}, {x, y + h}, {x, y}};
      if (!r.fond.empty()) plein(r.fond, l, r.opacite);
      if (!r.trait.empty()) traits(r, {l});
    } else if (e.tag == "image") {
      if (const std::string* h = attrDe(e, "href")) {
        Prim q;
        q.genre = Prim::IMAGE, q.x = nombre(e, "x"), q.y = nombre(e, "y"), q.l = nombre(e, "width"), q.h = nombre(e, "height");
        if (h->rfind("vue:", 0) == 0) {
          // Le rendu d'une vue : il remplit exactement son cadre
          const auto it = images3d_.find(h->substr(4));
          if (it != images3d_.end()) {
            q.image = it->second;
            prims_.push_back(std::move(q));
          }
          i++;
          continue;
        }
        q.image = imageDe(*h);
        if (q.image && q.image->IsOk()) {
          // xMidYMid meet
          const double ri = static_cast<double>(q.image->GetWidth()) / std::max(1, q.image->GetHeight());
          if (q.l / q.h > ri) {
            const double l2 = q.h * ri;
            q.x += (q.l - l2) / 2, q.l = l2;
          } else {
            const double h2 = q.l / ri;
            q.y += (q.h - h2) / 2, q.h = h2;
          }
          prims_.push_back(std::move(q));
        }
      }
    }
    i++;
  }
  if (noirSeul_) {
    const wxColour noir(0x11, 0x11, 0x11);
    const auto foncer = [&](wxColour& c) {
      if (c != papier) c = noir;
    };
    for (Prim& q : prims_) foncer(q.couleur);
  }
}

void PlanVue::peindre(wxGraphicsContext& g) {
  g.SetAntialiasMode(wxANTIALIAS_DEFAULT);
  g.SetInterpolationQuality(wxINTERPOLATION_BEST);
  // L'ombre de la feuille
  g.SetPen(wxNullGraphicsPen);
  g.SetBrush(g.CreateBrush(wxBrush(wxColour(0, 0, 0, 70))));
  g.DrawRectangle(ox_ + 2, oy_ + 4, largeurPage_ * zoom_, hauteurPage_ * zoom_);
  g.Translate(ox_, oy_);
  g.Scale(zoom_, zoom_);
  // Une police à la taille de l'écran (le contexte n'a plus à agrandir une petite police), faite une fois par
  // taille et couleur : en refaire une à chaque texte coûtait plus que d'écrire le texte
  std::map<std::tuple<int, bool, unsigned long>, wxGraphicsFont> polices;
  const auto police = [&](double corps, bool gras, const wxColour& c) -> const wxGraphicsFont& {
    const std::tuple<int, bool, unsigned long> k{static_cast<int>(std::round(corps * 1000)), gras, (static_cast<unsigned long>(c.Alpha()) << 24) | c.GetRGB()};
    auto it = polices.find(k);
    if (it == polices.end()) {
      wxFont f(wxFontInfo().FaceName("Arial").Bold(gras));
      f.SetFractionalPointSize(std::max(0.5, corps * zoom_ * 72.0 / 96.0));
      it = polices.emplace(k, g.CreateFont(f, c)).first;
    }
    return it->second;
  };
  for (const Prim& p : prims_) {
    switch (p.genre) {
      case Prim::TRAITS: {
        wxColour c = p.couleur;
        if (p.opacite < 1) c.Set(c.Red(), c.Green(), c.Blue(), static_cast<unsigned char>(p.opacite * 255));
        wxGraphicsPenInfo info(c, p.largeur);
        info.Cap(p.cap).Join(p.join);
        g.SetPen(g.CreatePen(info));
        wxGraphicsPath chemin = g.CreatePath();
        for (const Trait& t : p.traits) {
          if (t.pts.size() < 2) continue;
          chemin.MoveToPoint(t.pts[0][0], t.pts[0][1]);
          for (size_t i = 1; i < t.pts.size(); i++) chemin.AddLineToPoint(t.pts[i][0], t.pts[i][1]);
        }
        g.StrokePath(chemin);
        break;
      }
      case Prim::REMPLI: {
        wxColour c = p.couleur;
        if (p.opacite < 1) c.Set(c.Red(), c.Green(), c.Blue(), static_cast<unsigned char>(p.opacite * 255));
        g.SetPen(wxNullGraphicsPen);
        g.SetBrush(g.CreateBrush(wxBrush(c)));
        wxGraphicsPath chemin = g.CreatePath();
        for (const Trait& t : p.traits) {
          if (t.pts.size() < 3) continue;
          chemin.MoveToPoint(t.pts[0][0], t.pts[0][1]);
          for (size_t i = 1; i < t.pts.size(); i++) chemin.AddLineToPoint(t.pts[i][0], t.pts[i][1]);
          chemin.CloseSubpath();
        }
        g.FillPath(chemin);
        break;
      }
      case Prim::TEXTE: {
        if (p.texte.empty() || p.corps * zoom_ < 1.2) break;
        // Le texte se pose en pixels d'écran, sans la mise à l'échelle
        const double sx = ox_ + p.x * zoom_, sy = oy_ + p.y * zoom_;
        const wxGraphicsMatrix avant = g.GetTransform();
        g.SetTransform(g.CreateMatrix());
        if (p.angle != 0) {
          const double ax = ox_ + p.axeX * zoom_, ay = oy_ + p.axeY * zoom_;
          g.Translate(ax, ay);
          g.Rotate(p.angle * PI / 180);
          g.Translate(-ax, -ay);
        }
        const double haut = sy - 0.905 * p.corps * zoom_;
        if (p.halo > 0) {
          g.SetFont(police(p.corps, p.gras, p.couleurHalo));
          const double r = p.halo / 2 * zoom_;
          for (int k = 0; k < 8; k++) g.DrawText(p.texte, sx + r * std::cos(k * PI / 4), haut + r * std::sin(k * PI / 4));
        }
        g.SetFont(police(p.corps, p.gras, p.couleur));
        g.DrawText(p.texte, sx, haut);
        g.SetTransform(avant);
        break;
      }
      case Prim::IMAGE: {
        // Posée à sa taille en pixels puis agrandie par le repère : wxWidgets range le cadre d'une image
        // agrandie dans un rectangle GDI+ en nombres entiers, ici des millimètres. L'image ombrée glissait
        // alors jusqu'à 1 mm sous ses traits (trous taraudés et lamages de Perçages)
        const int w = p.image->GetWidth(), h = p.image->GetHeight();
        if (w < 1 || h < 1) break;
        const wxGraphicsMatrix avant = g.GetTransform();
        g.Translate(p.x, p.y);
        g.Scale(p.l / w, p.h / h);
        g.DrawBitmap(*p.image, 0, 0, w, h);
        g.SetTransform(avant);
        break;
      }
    }
  }
}

#include "plan_export.inc"
