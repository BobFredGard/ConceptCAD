// L'atelier Mise en plan : les éléments d'une planche (plan::dessiner) dessinés à l'écran, avec les mêmes styles que le navigateur.
#include "plan_vue.h"

#include <wx/base64.h>
#include <wx/dcbuffer.h>
#include <wx/dcmemory.h>
#include <wx/image.h>
#include <wx/log.h>
#include <wx/mstream.h>
#include <wx/textdlg.h>
#include "nombres_js.h"
#include <wx/time.h>

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
void cheminEnPoints(const std::string& d, std::vector<std::vector<std::array<double, 2>>>& out) {
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
      const double tol = 0.004;
      const double pas = r > tol ? 2 * std::acos(1 - tol / r) : PI / 2;
      const int n = std::min(256, std::max(1, static_cast<int>(std::ceil(std::abs(a1 - a0) / std::max(pas, 1e-4)))));
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
    if (!imageBonne_ || !image_.IsOk() || image_.GetWidth() != t.x || image_.GetHeight() != t.y) {
      image_ = wxBitmap(std::max(1, t.x), std::max(1, t.y), 24);
      wxMemoryDC m(image_);
      m.SetBackground(wxBrush(bureau_));
      m.Clear();
      {
        std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::Create(m));
        if (g) peindre(*g);
      }
      m.SelectObject(wxNullBitmap);
      imageBonne_ = true;
    }
    dc.SetBackground(wxBrush(bureau_));
    dc.Clear();
    dc.DrawBitmap(image_, decalage_.x, decalage_.y);
    peindreSelection(dc);
    peindreRegles(dc, t);
    // Les onglets restent en place pendant qu'on déplace la feuille
    const int ho = hauteurOnglets();
    dc.SetPen(*wxTRANSPARENT_PEN);
    dc.SetBrush(wxBrush(wxColour(0x1c, 0x1e, 0x23)));
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
        dc.SetBrush(wxBrush(actif ? wxColour(0x2b, 0x2e, 0x34) : wxColour(0x1c, 0x1e, 0x23)));
        dc.SetPen(wxPen(wxColour(0x3a, 0x3f, 0x47)));
        dc.DrawRoundedRectangle(r.x, r.y, r.width, r.height + FromDIP(4), FromDIP(5));
        dc.SetTextForeground(actif ? wxColour(0x4d, 0xa3, 0xff) : wxColour(0xc9, 0xcc, 0xd1));
        dc.DrawText(lib, r.x + FromDIP(9), r.y + (r.height - tl.y) / 2);
        onglets_.push_back(r);
        x = r.GetRight() + FromDIP(3);
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
    curseurX_ = (e.GetX() - ox_) / zoom_, curseurY_ = (e.GetY() - oy_) / zoom_;
    curseurDedans_ = e.GetY() >= hauteurOnglets() && curseurX_ >= 0 && curseurY_ >= 0 && curseurX_ <= largeurPage_ && curseurY_ <= hauteurPage_;
    if (!glisse_) {
      if (geste_.sorte != Geste::RIEN) {
        bouge(curseurX_, curseurY_, e.GetX(), e.GetY());
      } else if (mep_.is_object() && mep_.contains("sheets") && !mep_["sheets"].empty()) {
        // Le survol : un cadre en pointillés autour de la vue
        const std::string s = curseurDedans_ ? plan::vueSous(planche(), mep_, piece_, calcul_, curseurX_, curseurY_) : std::string();
        vueSurvol_ = s;
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
    if (e.GetY() < hauteurOnglets() || !mep_.is_object() || !mep_.contains("sheets") || mep_["sheets"].empty()) return;
    if (!HasCapture()) CaptureMouse();
    enfonce((e.GetX() - ox_) / zoom_, (e.GetY() - oy_) / zoom_, e.ShiftDown(), e.ControlDown(), e.GetX(), e.GetY());
  });
  Bind(wxEVT_LEFT_UP, [this](wxMouseEvent&) {
    if (HasCapture()) ReleaseMouse();
    relache();
  });
  Bind(wxEVT_KEY_DOWN, [this](wxKeyEvent& e) {
    const int k = e.GetKeyCode();
    if (k == WXK_DELETE || k == WXK_BACK) return supprimer();
    if (k == WXK_ESCAPE) {
      geste_ = Geste();
      sel_ = plan::SelectionPlan();
      redessiner();
      if (surSelection) surSelection();
      return;
    }
    if (k == 'F' && e.ShiftDown()) {
      ajuster_ = true;
      imageBonne_ = false;
      return Refresh();
    }
    e.Skip();
  });
}

int PlanVue::hauteurOnglets() const { return FromDIP(30); }

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
  calcul_.selection = &sel_;
  construire();
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
  const auto toutEffacer = [&]() { sel_ = plan::SelectionPlan(); };
  Geste g;
  g.px0 = px, g.py0 = py, g.curX = x, g.curY = y, g.ajout = ajout;
  // Maj ou Ctrl + clic sur une cote : sélection multiple
  if (ajout) {
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
  // La flèche d'une coupe : elle glisse le long de la ligne
  plan::GesteCoupe gc;
  if (plan::flecheCoupeSous(mep_, planche_, piece_, calcul_, x, y, z, gc)) {
    sel_.vue = gc.vue, sel_.cote.clear(), sel_.bulle.clear();
    g.sorte = Geste::FLECHE, g.id = gc.vue, g.coupe = gc;
    geste_ = g;
    redessiner();
    if (surSelection) surSelection();
    return;
  }
  // Un tronçon de ligne de coupe : tirer le déplace, Ctrl le brise, Maj + clic retire une brisure
  gc = plan::GesteCoupe();
  if (plan::tronconCoupeSous(mep_, planche_, piece_, calcul_, x, y, z, gc)) {
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
  const std::string bl = plan::bulleSous(sh, x, y);
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
  const std::string tv = plan::titreSous(sh, mep_, piece_, calcul_, x, y, z, ecart);
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
    if (J* d = plan::coteParId(sh, dim)) g.cote = plan::saisirCote(mep_, planche_, piece_, calcul_, *d, x, y, z);
    g.sorte = Geste::COTE, g.id = dim;
    geste_ = g;
    redessiner();
    if (surSelection) surSelection();
    return;
  }
  // Une vue : sélection, glisser pour la déplacer
  const std::string v = plan::vueSous(sh, mep_, piece_, calcul_, x, y);
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
    case Geste::COTE:
      if (J* d = plan::coteParId(sh, geste_.id)) {
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
  if (g.sorte == Geste::CADRE) {
    if (g.commence) {
      // De gauche à droite : ce qui est entièrement dans le cadre ; de droite à gauche : tout ce qu'il touche (mepBoxSelect)
      const double x0 = std::min(g.ox, g.curX), x1 = std::max(g.ox, g.curX), y0 = std::min(g.oy, g.curY), y1 = std::max(g.oy, g.curY);
      const bool capture = g.curX < g.ox;
      J& sh = planche();
      if (!g.ajout) sel_ = plan::SelectionPlan();
      int n = 0;
      if (sh["views"].is_array())
        for (const J& v : sh["views"]) {
          const std::string id = v.value("id", std::string());
          double x, y, w, h;
          if (sel_.lotVues.count(id) || !plan::boiteDeVue(v, sh, mep_, piece_, calcul_, x, y, w, h)) continue;
          const bool dans = x >= x0 && x + w <= x1 && y >= y0 && y + h <= y1;
          const bool touche = x <= x1 && x + w >= x0 && y <= y1 && y + h >= y0;
          if (capture ? touche : dans) sel_.lotVues.insert(id), n++;
        }
      if (sh.contains("dims") && sh["dims"].is_array())
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
  valider(g.sorte == Geste::FLECHE ? L"flèche de coupe" : g.sorte == Geste::VUE ? L"déplacement vue" : g.sorte == Geste::COTE ? L"déplacement cote" : g.sorte == Geste::BULLE ? L"bulle" : L"titre de vue");
}

void PlanVue::supprimer() {
  J& sh = planche();
  if (!sel_.lotVues.empty() || !sel_.lotCotes.empty()) {
    const size_t nv = sel_.lotVues.size(), nd = sel_.lotCotes.size();
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
  } else if (!sel_.bulle.empty()) {
    J bs = J::array();
    for (J& b : sh["balloons"])
      if (b.value("id", std::string()) != sel_.bulle) bs.push_back(std::move(b));
    sh["balloons"] = std::move(bs);
    sel_.bulle.clear();
    redessiner();
    valider(L"suppression bulle");
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
    dc.SetPen(wxPen(wxColour(0xb4, 0xb8, 0xc0)));
    dc.SetBrush(*wxTRANSPARENT_BRUSH);
    const double gx = ox_ + decalage_.x, gy = oy_ + decalage_.y;
    for (double x = 0; x <= largeurPage_; x += 10) dc.DrawLine(static_cast<int>(gx + x * zoom_), static_cast<int>(gy), static_cast<int>(gx + x * zoom_), static_cast<int>(gy + hauteurPage_ * zoom_));
    for (double y = 0; y <= hauteurPage_; y += 10) dc.DrawLine(static_cast<int>(gx), static_cast<int>(gy + y * zoom_), static_cast<int>(gx + largeurPage_ * zoom_), static_cast<int>(gy + y * zoom_));
  }
  const wxColour bleu(0x0a, 0x84, 0xff);
  dc.SetBrush(*wxTRANSPARENT_BRUSH);
  const double ox = ox_ + decalage_.x, oy = oy_ + decalage_.y;
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
  if (geste_.sorte == Geste::CADRE && geste_.commence) {
    const bool capture = geste_.curX < geste_.ox;
    dc.SetPen(wxPen(capture ? wxColour(0x30, 0xd1, 0x58) : bleu, 1, capture ? wxPENSTYLE_SHORT_DASH : wxPENSTYLE_SOLID));
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
  if (planche_ >= static_cast<int>(mep_["sheets"].size())) planche_ = 0;
  sel_ = plan::SelectionPlan();
  geste_ = Geste();
  aJour_ = true;
  redessiner();
  if (surSelection) surSelection();
}

// {"presse":[x,y]}, {"glisse":[x,y]}, {"lache":1}, {"touche":"Suppr"}, en mm sur la feuille
void PlanVue::essaiGeste(const J& e) {
  const auto pixelsX = [&](double x) { return ox_ + x * zoom_; };
  const auto pixelsY = [&](double y) { return oy_ + y * zoom_; };
  if (ajuster_) ajusterFeuille();
  if (e.contains("presse")) {
    const double x = e["presse"][0], y = e["presse"][1];
    enfonce(x, y, e.value("maj", false), e.value("ctrl", false), pixelsX(x), pixelsY(y));
  }
  if (e.contains("glisse")) {
    const double x = e["glisse"][0], y = e["glisse"][1];
    bouge(x, y, pixelsX(x), pixelsY(y));
  }
  if (e.contains("lache")) relache();
  if (e.contains("touche")) {
    const std::string t = e["touche"];
    if (t == "Suppr") supprimer();
    if (t == "Echap") viderSelection();
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
    dc.SetBrush(wxBrush(wxColour(0x30, 0x33, 0x39)));
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
  piece_ = plan::pieceDe(d, r, top_);
  plan::completerAssemblage(piece_, d, S);
  planche_ = mep_.contains("cur") && mep_["cur"].is_number() ? mep_["cur"].get<int>() : 0;
  if (planche_ < 0 || planche_ >= static_cast<int>(mep_["sheets"].size())) planche_ = 0;
  aJour_ = true;
  ajuster_ = true;
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
  sel_ = plan::SelectionPlan();
  geste_ = Geste();
  vueSurvol_.clear();
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
  const Palette P = paletteDe(mep_);
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
      fleche(tri, b[0], b[1], b[0] - a[0], b[1] - a[1], tc.fleche * r.largeur, hF * r.largeur, true);
      if (!tri.empty()) plein(couleur(*m), std::move(tri));
    }
    if (const std::string* m = attrDe(e, "marker-start")) {
      std::vector<std::array<double, 2>> tri;
      fleche(tri, l[0][0], l[0][1], l[1][0] - l[0][0], l[1][1] - l[0][1], tc.fleche * r.largeur, hF * r.largeur, false);
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
  std::map<std::pair<int, bool>, wxFont> polices;
  const auto police = [&](double corps, bool gras) -> const wxFont& {
    const std::pair<int, bool> k{static_cast<int>(std::round(corps * 1000)), gras};
    auto it = polices.find(k);
    if (it == polices.end()) {
      // Une police à la taille de l'écran : le contexte n'a plus à agrandir une petite police
      wxFont f(wxFontInfo().FaceName("Arial").Bold(gras));
      f.SetFractionalPointSize(std::max(0.5, corps * zoom_ * 72.0 / 96.0));
      it = polices.emplace(k, f).first;
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
          g.SetFont(police(p.corps, p.gras), p.couleurHalo);
          const double r = p.halo / 2 * zoom_;
          for (int k = 0; k < 8; k++) g.DrawText(p.texte, sx + r * std::cos(k * PI / 4), haut + r * std::sin(k * PI / 4));
        }
        g.SetFont(police(p.corps, p.gras), p.couleur);
        g.DrawText(p.texte, sx, haut);
        g.SetTransform(avant);
        break;
      }
      case Prim::IMAGE:
        g.DrawBitmap(*p.image, p.x, p.y, p.l, p.h);
        break;
    }
  }
}
