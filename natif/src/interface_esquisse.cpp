#include "theme.h"
#include "interface_esquisse.h"

#include <wx/dcbuffer.h>
#include <wx/graphics.h>

#include <algorithm>
#include <cmath>
#include <memory>

#include "contours.h"

namespace {
// Couleurs relevées sur l'écran du navigateur, thème nuit
#define C_FOND th(wxColour(0x1c, 0x1c, 0x1e))
#define C_BARRE th(wxColour(0x2a, 0x2c, 0x30))
#define C_PANNEAU th(wxColour(0x28, 0x29, 0x2c))
#define C_RANG th(wxColour(0x33, 0x34, 0x36))
#define C_BORD th(wxColour(0x3d, 0x3e, 0x42))
#define C_BANDEAU th(wxColour(0x2a, 0x2a, 0x2d))
#define C_TEXTE th(wxColour(0xf5, 0xf5, 0xf7))
#define C_DISCRET th(wxColour(0x98, 0x98, 0x9d))
#define C_BLEU th(wxColour(0x0a, 0x84, 0xff))
#define C_VERT th(wxColour(0x30, 0xd1, 0x58))
#define C_JAUNE th(wxColour(0xff, 0xd6, 0x0a))
#define C_ROUGE th(wxColour(0xff, 0x45, 0x3a))
#define C_ORANGE th(wxColour(0xff, 0x9f, 0x0a))
#define C_GRIS_C th(wxColour(0xc7, 0xc7, 0xcc))

// src/49-esquisse-registre-icones.js : SK_ICONS
const std::map<std::string, std::string>& ICONES() {
  static const std::map<std::string, std::string> m = {
      {"select", R"(<path d="M6 3v15.5l4.2-4 2.9 6.5 2.6-1.1-2.9-6.4H19z" fill="currentColor" stroke="none"/>)"},
      {"line", R"(<path d="M5 19L19 5"/><circle cx="5" cy="19" r="2" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/>)"},
      {"rect", R"(<rect x="4" y="6.5" width="16" height="11"/><circle cx="4" cy="6.5" r="1.8" fill="currentColor" stroke="none"/><circle cx="20" cy="17.5" r="1.8" fill="currentColor" stroke="none"/>)"},
      {"slot", R"(<path d="M8.5 7h7a5 5 0 0 1 0 10h-7a5 5 0 0 1 0-10z"/><circle cx="8.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>)"},
      {"circle", R"(<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>)"},
      {"polygon", R"(<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><circle cx="12" cy="12" r="5.2" stroke-width="1.2" stroke-dasharray="1.6 1.8"/>)"},
      {"arc", R"(<path d="M20 18A12 12 0 0 0 8 6"/><path d="M8 18h12M8 18V6" stroke-dasharray="1.6 2.4" stroke-width="1.3"/><circle cx="8" cy="18" r="1.6" fill="currentColor" stroke="none"/>)"},
      {"spline", R"(<path d="M3.5 18C6 6 10 5 12 12s6 6 8.5-6"/><circle cx="3.5" cy="18" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="20.5" cy="6" r="1.7" fill="currentColor" stroke="none"/>)"},
      {"cspline", R"(<path d="M4 18C7 8 11 6 13 12s5 6 7-4" stroke-width="2"/><path d="M4 18L6.5 6l9.5 13L20 8" stroke-dasharray="1.6 2" stroke-width="1.2"/><rect x="5" y="4.5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="14.5" y="17.5" width="3" height="3" fill="currentColor" stroke="none"/>)"},
      {"cpoint", R"(<circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/><path d="M12 3.5v4.5M12 16v4.5M3.5 12H8M16 12h4.5"/>)"},
      {"hpoint", R"(<circle cx="12" cy="17" r="5.2" stroke-width="1.6"/><path d="M12 10.5v13M5.5 17h13" stroke-width="1"/><path d="M10.2 1.5h3.6v3.2h-3.6z" fill="currentColor" stroke="none"/><path d="M10 4.7h4v7l-2 4.3-2-4.3z" stroke-width="1.4"/><path d="M10 6.6l4 1.4M10 8.9l4 1.4" stroke-width="1.1"/>)"},
      {"project", R"(<path d="M12 2.8l6 2.6v5.4l-6 2.6-6-2.6V5.4z"/><path d="M6 5.4l6 2.6 6-2.6M12 8v5.4" stroke-width="1.3"/><path d="M12 15.5v3" stroke-dasharray="1.5 1.8"/><path d="M4 21h16"/>)"},
      {"isect", R"(<path d="M12 3l7 3.5v11L12 21l-7-3.5v-11z" stroke-width="1.2"/><path d="M5 6.5l7 3.5 7-3.5M12 10v11" stroke-width="1" stroke-dasharray="1.4 1.6"/><path d="M2.5 13.5l9.5 4.5 9.5-4.5" stroke-width="2.4"/>)"},
      {"dim", R"(<path d="M4 5v10M20 5v10"/><path d="M4 10h16"/><path d="M7.5 7.5L4 10l3.5 2.5M16.5 7.5L20 10l-3.5 2.5"/><path d="M9 19h6" stroke-width="2.4"/>)"},
      {"fillet", R"(<path d="M4 21v-8a9 9 0 0 1 9-9h8" stroke-width="2.2"/><path d="M4 9V4h5" stroke-dasharray="1.6 2.2" stroke-width="1.3"/><circle cx="13" cy="13" r="1.4" fill="currentColor" stroke="none"/>)"},
      {"chamfer", R"(<path d="M4 21V11l7-7h10" stroke-width="2.2"/><path d="M4 8V4h4" stroke-dasharray="1.6 2.2" stroke-width="1.3"/>)"},
      {"offset", R"(<path d="M3 19c3-9 15-9 18 0" stroke-width="2.2"/><path d="M7 21c2-5 8-5 10 0" stroke-dasharray="2.2 2" stroke-width="1.6"/><path d="M12 7.5v5M10 10.5l2 2 2-2" stroke-width="1.4"/>)"},
      {"trim", R"(<circle cx="6" cy="7" r="2.6"/><circle cx="6" cy="17" r="2.6"/><path d="M8.2 8.5L20 16.5M8.2 15.5L20 7.5"/>)"},
      {"h", R"(<path d="M3.5 12h17" stroke-width="2.4"/><path d="M3.5 8v8M20.5 8v8" stroke-width="1.4"/>)"},
      {"v", R"(<path d="M12 3.5v17" stroke-width="2.4"/><path d="M8 3.5h8M8 20.5h8" stroke-width="1.4"/>)"},
      {"parallel", R"(<path d="M5 19L13 5M11 19L19 5" stroke-width="2.2"/>)"},
      {"perpendicular", R"(<path d="M4 19.5h16M12 19.5V4.5" stroke-width="2.2"/><path d="M12 15h4.5v4.5" stroke-width="1.4"/>)"},
      {"collinear", R"(<path d="M3 21l6-6M15 9l6-6" stroke-width="2.4"/><path d="M9 15l6-6" stroke-dasharray="1.4 2.2" stroke-width="1.4"/>)"},
      {"equal", R"(<path d="M5 9h14M5 15h14" stroke-width="2.4"/>)"},
      {"symmetric", R"(<path d="M12 2.5v19" stroke-dasharray="2 2.2" stroke-width="1.4"/><path d="M9 6.5L3.5 12 9 17.5M15 6.5l5.5 5.5-5.5 5.5"/>)"},
      {"fix", R"(<rect x="5.5" y="10.5" width="13" height="10" rx="1.6"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>)"},
      {"tangent", R"(<circle cx="12" cy="14.5" r="6"/><path d="M2.5 8.5h19" stroke-width="2.2"/><circle cx="12" cy="8.5" r="1.6" fill="currentColor" stroke="none"/>)"},
      {"curvature", R"(<path d="M3 19c4-1 7-4 9-8s5-7 9-8" stroke-width="2.2"/><path d="M6 18.2v-4M9.5 16v-5.5M13 12.5V6.5M16.5 8.5V4.4" stroke-width="1.2"/>)"},
      {"tangent2", R"(<circle cx="7.5" cy="12" r="5"/><circle cx="17.5" cy="12" r="5"/><circle cx="12.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>)"},
      {"coaxial", R"(<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>)"},
      {"midpoint", R"(<path d="M3 17h18"/><path d="M12 16.5l-3.6-6h7.2z" fill="currentColor" stroke="none"/><path d="M3 14.5v5M21 14.5v5" stroke-width="1.4"/>)"},
      {"coincident", R"(<circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><path d="M2.5 12h4.5M17 12h4.5"/><path d="M5 9.5L7.5 12 5 14.5M19 9.5L16.5 12l2.5 2.5"/>)"},
      {"online", R"(<path d="M3 18L21 8"/><circle cx="12" cy="13" r="2.6" fill="currentColor" stroke="none"/>)"},
      {"oncircle", R"(<circle cx="11" cy="13" r="7"/><circle cx="16" cy="8.1" r="2.4" fill="currentColor" stroke="none"/>)"},
      {"construction", R"(<path d="M3 21L12 12" stroke-dasharray="2.6 2.2"/><circle cx="15.5" cy="8.5" r="5" stroke-dasharray="2.6 2.2"/>)"},
      {"length", R"(<path d="M4 5v10M20 5v10"/><path d="M4 10h16"/><path d="M7.5 7.5L4 10l3.5 2.5M16.5 7.5L20 10l-3.5 2.5"/><path d="M9 19h6" stroke-width="2.4"/>)"},
      {"distance", R"(<circle cx="5" cy="16" r="2" fill="currentColor" stroke="none"/><circle cx="19" cy="16" r="2" fill="currentColor" stroke="none"/><path d="M5 9h14"/><path d="M8 6.8L5 9l3 2.2M16 6.8L19 9l-3 2.2"/>)"},
      {"diameter", R"(<circle cx="12" cy="12" r="8"/><path d="M6.3 17.7L17.7 6.3"/><path d="M14.5 6.3h3.2v3.2M9.5 17.7H6.3v-3.2" stroke-width="1.4"/>)"},
      {"radius", R"(<circle cx="12" cy="12" r="8"/><path d="M12 12l5.6-5.6"/><path d="M14.4 6.4h3.2v3.2" stroke-width="1.4"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>)"},
      {"angle", R"(<path d="M4 19.5h16M4 19.5L15 5"/><path d="M12 19.5a8 8 0 0 0-2.4-5.7"/>)"},
      {"gap", R"(<path d="M3 6.5h18M3 17.5h18" stroke-width="2.2"/><path d="M12 7.5v9M9.8 9.8L12 7.5l2.2 2.3M9.8 14.2L12 16.5l2.2-2.3" stroke-width="1.4"/>)"},
      {"distline", R"(<path d="M3 19h18" stroke-width="2.2"/><circle cx="12" cy="5" r="2" fill="currentColor" stroke="none"/><path d="M12 7.5v9.5M9.8 14.7L12 17l2.2-2.3" stroke-width="1.4"/>)"},
      // Les boutons de vue, qui sont des caractères dans le navigateur
      {"cadrer", R"(<path d="M6 12l6-5.5 6 5.5M8 11v6.5h8V11" stroke-width="1.6"/>)"},
      {"orbite", R"(<path d="M18 8.5a7 7 0 1 0 1 6" stroke-width="1.7"/><path d="M18.6 4.5v4.3h-4.3" stroke-width="1.7"/>)"},
      {"grille", R"(<path d="M6.5 6.5h11v11h-11zM6.5 10.2h11M6.5 13.8h11M10.2 6.5v11M13.8 6.5v11" stroke-width="1.3"/>)"},
      {"oeil", R"(<path d="M4 12c2.5-4 5-5.5 8-5.5s5.5 1.5 8 5.5c-2.5 4-5 5.5-8 5.5S6.500 16 4 12z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2.4" fill="#2a2c30" stroke="none"/>)"},
      {"fx", R"(<path d="M10.500 6.500c-2-.6-3 .3-3.300 2.300L6 17.500c-.3 1.600-1.200 2.200-2.800 1.800M4.500 11h5" stroke-width="1.500"/><path d="M12.500 10.500l6.500 7M19 10.500l-6.500 7" stroke-width="1.500"/>)"},
  };
  return m;
}

// Toupper de Windows laisse les accents en minuscules selon la langue du programme
wxString majuscules(const wxString& t) {
  wxString u = t.Upper();
  const wchar_t* const paires[][2] = {{L"é", L"É"}, {L"è", L"È"}, {L"ê", L"Ê"}, {L"ë", L"Ë"}, {L"à", L"À"}, {L"â", L"Â"}, {L"ç", L"Ç"}, {L"î", L"Î"}, {L"ï", L"Ï"}, {L"ô", L"Ô"}, {L"ù", L"Ù"}, {L"û", L"Û"}};
  for (const auto& p : paires) u.Replace(p[0], p[1]);
  return u;
}

wxString hexa(const wxColour& c) { return c.GetAsString(wxC2S_HTML_SYNTAX); }

wxBitmapBundle imageSvg(const std::string& corps, const wxColour& couleur, int taille) {
  std::string b = corps;
  const std::string h = hexa(couleur).ToStdString();
  for (size_t p = 0; (p = b.find("currentColor", p)) != std::string::npos; p += h.size()) b.replace(p, 12, h);
  const std::string svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"" + std::to_string(taille) + "\" height=\"" + std::to_string(taille) + "\"><g fill=\"none\" stroke=\"" + h + "\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + b + "</g></svg>";
  return wxBitmapBundle::FromSVG(svg.c_str(), wxSize(taille, taille));
}

wxColour assombri(const wxColour& c, double a, const wxColour& fond) {
  const auto m = [a](int x, int y) { return static_cast<unsigned char>(y + (x - y) * a); };
  return wxColour(m(c.Red(), fond.Red()), m(c.Green(), fond.Green()), m(c.Blue(), fond.Blue()));
}

wxFont policeUI(double taille, bool gras = false) {
  wxFontInfo i(wxSize(0, static_cast<int>(std::lround(taille))));
  i.FaceName("Arial");  // ce que le navigateur prend sous Windows pour « sans-serif »
  if (gras) i.Bold();
  return wxFont(i);
}
wxFont policeTexte(const wxString& t, double taille, bool gras) {
  wxFont p = policeUI(taille, gras);
  if (t.Find(L"⇄") != wxNOT_FOUND || t.find_first_of(L"▶⏸⏹✕◼◻◈■") != wxString::npos || t.Find(L"🗑") != wxNOT_FOUND || t.Find(L"📐") != wxNOT_FOUND || t.Find(L"➤") != wxNOT_FOUND || t.Find(L"⟳") != wxNOT_FOUND || t.Find(L"⚙") != wxNOT_FOUND) p.SetFaceName("Segoe UI Symbol");
  return p;
}
// Tailles et positions en pixels logiques
void mesurer(const wxWindow* w, const wxString& t, double taille, bool gras, double* L, double* H) {
  const double f = w->GetDPIScaleFactor();
  wxClientDC dc(const_cast<wxWindow*>(w));
  dc.SetFont(policeTexte(t, taille * f, gras));
  const wxSize s = dc.GetTextExtent(t);
  if (L) *L = s.x / f;
  if (H) *H = s.y / f;
}
void ecrire(wxDC& dc, const wxWindow* w, const wxString& t, double x, double y, double taille, const wxColour& c, bool gras = false) {
  const double f = w->GetDPIScaleFactor();
  dc.SetFont(policeTexte(t, taille * f, gras));
  dc.SetTextForeground(c);
  dc.SetBackgroundMode(wxBRUSHSTYLE_TRANSPARENT);
  dc.DrawText(t, static_cast<int>(std::lround(x * f)), static_cast<int>(std::lround(y * f)));
}
}  // namespace

// ---------- Bouton ----------
BoutonEsquisse::BoutonEsquisse(wxWindow* parent, int id, const wxString& nom, const wxString& infobulle, Style style) : wxWindow(parent, id, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxFULL_REPAINT_ON_RESIZE), style_(style) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  SetLabel(nom);
  if (!infobulle.empty()) SetToolTip(infobulle);
  Bind(wxEVT_PAINT, &BoutonEsquisse::peindre, this);
  Bind(wxEVT_ENTER_WINDOW, [this](wxMouseEvent&) {
    survol_ = true;
    Refresh();
  });
  Bind(wxEVT_LEAVE_WINDOW, [this](wxMouseEvent&) {
    survol_ = enfonce_ = false;
    Refresh();
  });
  const auto bas = [this](wxMouseEvent&) {
    enfonce_ = true;
    Refresh();
  };
  Bind(wxEVT_LEFT_DOWN, bas);
  Bind(wxEVT_LEFT_DCLICK, bas);
  Bind(wxEVT_LEFT_UP, [this](wxMouseEvent&) {
    if (!enfonce_) return;
    enfonce_ = false;
    Refresh();
    if (surClic) surClic();
  });
}

wxBitmapBundle iconeMenuEsquisse(const std::string& nom) {
  const auto i = ICONES().find(nom);
  if (i == ICONES().end()) return wxBitmapBundle();
  return imageSvg(i->second, wxSystemSettings::GetColour(wxSYS_COLOUR_MENUTEXT), 16);
}

void BoutonEsquisse::icone(const std::string& corpsSvg, const wxColour& couleur) {
  const auto it = ICONES().find(corpsSvg);
  const std::string& corps = it == ICONES().end() ? corpsSvg : it->second;
  image_ = imageSvg(corps, couleur, 20);
  imageActive_ = imageSvg(corps, *wxWHITE, 20);
  svgIcone_ = corps;
  iconeEntiere_ = false;
  couleurIcone_ = couleur;
  Refresh();
}
wxBitmapBundle iconeSvgComplete(const std::string& svg, const wxColour& c, int taille) {
  std::string s = svg;
  const std::string h = hexa(c).ToStdString();
  for (size_t p = 0; (p = s.find("currentColor", p)) != std::string::npos; p += h.size()) s.replace(p, 12, h);
  return wxBitmapBundle::FromSVG(s.c_str(), wxSize(taille, taille));
}
void BoutonEsquisse::iconeComplete(const std::string& svg, const wxColour& couleur) {
  image_ = iconeSvgComplete(svg, couleur, 20);
  imageActive_ = iconeSvgComplete(svg, *wxWHITE, 20);
  svgIcone_ = svg;
  iconeEntiere_ = true;
  couleurIcone_ = couleur;
  Refresh();
}
void BoutonEsquisse::couleurIcone(const wxColour& c) {
  if (svgIcone_.empty()) return;
  const std::string svg = svgIcone_;
  if (iconeEntiere_) iconeComplete(svg, c);
  else icone(svg, c);
}
void BoutonEsquisse::themeChange(int de, int vers) {
  if (fond_.IsOk()) fond_ = theme::passer(fond_, de, vers);
  if (!svgIcone_.empty()) {
    const std::string svg = svgIcone_;
    const wxColour c = theme::passer(couleurIcone_, de, vers);
    if (iconeEntiere_) iconeComplete(svg, c);
    else icone(svg, c);
  }
  Refresh();
}
void BoutonEsquisse::fond(const wxColour& c) {
  fond_ = c;
  Refresh();
}
void BoutonEsquisse::titre(const wxString& t) {
  titre_ = t;
  Refresh();
}
void BoutonEsquisse::actif(bool oui) {
  if (actif_ == oui) return;
  actif_ = oui;
  Refresh();
}
void BoutonEsquisse::disponible(bool oui) {
  if (disponible_ == oui) return;
  disponible_ = oui;
  Refresh();
}

void BoutonEsquisse::peindre(wxPaintEvent&) {
  wxAutoBufferedPaintDC dc(this);
  dc.SetBackground(wxBrush(fond_.IsOk() ? fond_ : C_BARRE));
  dc.Clear();
  std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::CreateFromUnknownDC(dc));
  if (!g) return;
  const double f = GetDPIScaleFactor();
  g->Scale(f, f);
  const wxSize t = ToDIP(GetClientSize());
  const bool enColonne = style_ == RUBAN;
  wxColour fond = wxTransparentColour, bord = wxTransparentColour;
  if (style_ == PRINCIPAL) {
    fond = bord = disponible_ ? C_BLEU : th(wxColour(0x38, 0x3a, 0x3e));
  } else if (style_ == TEXTE || style_ == ENCADRE) {
    fond = th(wxColour(0x38, 0x3a, 0x3e));
    bord = th(wxColour(0x4a, 0x4c, 0x50));
  }
  if (actif_) fond = bord = C_BLEU;
  else if (disponible_ && survol_) fond = style_ == PRINCIPAL ? assombri(C_BLEU, 0.85, *wxWHITE) : th(wxColour(0x44, 0x46, 0x4b));
  if (fond.Alpha() != 0) {
    g->SetBrush(g->CreateBrush(wxBrush(fond)));
    g->SetPen(bord.Alpha() != 0 ? g->CreatePen(wxGraphicsPenInfo(bord, 1)) : wxNullGraphicsPen);
    g->DrawRoundedRectangle(0.5, 0.5, t.x - 1, t.y - 1, 8);
  }
  if (image_.IsOk()) {
    const double L = std::min(20, t.y - 2), x = (t.x - L) / 2, y = enColonne ? 5 : (t.y - L) / 2;
    wxBitmap b = (actif_ ? imageActive_ : image_).GetBitmap(FromDIP(wxSize(20, 20)));
    if (!disponible_) {
      wxImage im = b.ConvertToImage();
      if (im.HasAlpha()) {
        unsigned char* a = im.GetAlpha();
        for (int i = 0; i < im.GetWidth() * im.GetHeight(); i++) a[i] = static_cast<unsigned char>(a[i] * 0.3);
      }
      b = wxBitmap(im);
    }
    g->DrawBitmap(b, x, y, L, L);
  }
  g.reset();
  if (!titre_.empty()) {
    double L, H;
    const double taille = enColonne ? 10.5 : 12.5;
    const bool gras = style_ == PRINCIPAL || style_ == PASTILLE;
    mesurer(this, titre_, taille, gras, &L, &H);
    const wxColour c = !disponible_ ? (style_ == PRINCIPAL ? th(wxColour(0xc8, 0xd8, 0xee)) : th(wxColour(0x68, 0x6a, 0x70))) : style_ == PRINCIPAL || actif_ ? *wxWHITE : C_TEXTE;
    ecrire(dc, this, titre_, (t.x - L) / 2, enColonne ? t.y - H - 3 : (t.y - H) / 2, taille, c, gras);
  }
}

// ---------- Barre ----------
BarreEsquisse::BarreEsquisse(wxWindow* parent) : wxWindow(parent, 2009, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxFULL_REPAINT_ON_RESIZE) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  struct Fiche {
    int outil;  // -1 : pas encore repris
    const char* icone;
    const wchar_t* nom;
    const wchar_t* aide;
  };
  // Même ordre que le navigateur. Les identifiants 2010 à 2023 restent ceux des outils déjà connus des essais.
  const Fiche fiches[] = {
      {Dessin::SELECTION, "select", L"Sélection", L"Sélectionner / déplacer les points (Suppr = effacer)"},
      {Dessin::LIGNE, "line", L"Ligne", L"Ligne : clic 1 = départ, clic 2 = arrivée"},
      {Dessin::RECTANGLE, "rect", L"Rectangle", L"Rectangle (R) : 2 coins opposés, le centre et un coin, ou 3 points pour un rectangle en biais. Choisissez dans le bandeau en haut à gauche"},
      {Dessin::OBLONG, "slot", L"Oblong", L"Oblong (B) : trou allongé en 3 clics : 2 centres, 2 extrémités ou le centre et l’écartement, puis le rayon. Les cotes se posent au 3e clic"},
      {Dessin::CERCLE, "circle", L"Cercle", L"Cercle (C) : le centre et un point du tour, 2 points d’un diamètre, 3 points du tour, ou tangent à 2 ou 3 traits. Choisissez dans le bandeau en haut à gauche"},
      {Dessin::POLYGONE, "polygon", L"Polygone", L"Polygone : clic 1 = centre, clic 2 = milieu d'un côté (réglages en haut à gauche)"},
      {Dessin::ARC, "arc", L"Arc", L"Arc (A) : le centre et 2 points, 3 points, dans le prolongement d’un trait existant, ou tangent à 2 traits. Choisissez dans le bandeau en haut à gauche"},
      {Dessin::SPLINE, "spline", L"Spline", L"Spline (S) : cliquez les points de passage. Double-clic, Entrée ou clic droit : fin ; clic sur le 1er point : fermée. Clic droit sur un point : poignée de tangence"},
      {Dessin::CSPLINE, "cspline", L"Spline de contrôle", L"Spline par points de contrôle (Maj+S) : cliquez les pôles. Double-clic, Entrée ou clic droit : fin ; clic sur le 1er pôle : fermée"},
      {Dessin::POINT_C, "cpoint", L"Point", L"Point de construction : un clic par point"},
      {Dessin::PERCAGE, "hpoint", L"Centre de perçage", L"Centre de perçage : un clic, à coter, pour la fonction 3D « Perçage »"},
      {Dessin::PROJETER, "project", L"Projeter", L"Projeter (P) : survolez une arête 3D ou le tracé bleu d'une autre esquisse visible, clic pour la projeter en construction"},
      {Dessin::INTERSECTION, "isect", L"Intersection", L"Intersection (I) : courbes du plan d'esquisse avec des faces (clic, Ctrl+clic = plusieurs) ou un corps entier (Maj+clic)"},
      {Dessin::COTE, "dim", L"Cote", L"Cote : ligne = longueur, cercle = Ø, arc = rayon, 2 points = distance · Ctrl+clic 2 lignes = angle ou entraxe"},
      {Dessin::AJUSTER, "trim", L"Ajuster", L"Ajuster (T) : cliquez ou glissez sur le tronçon à retirer"},
      {Dessin::DECALER, "offset", L"Décaler", L"Décalage (O) : sélectionnez, cliquez, puis choisissez le côté ou tapez la distance"},
      {Dessin::CHANFREIN, "chamfer", L"Chanfrein", L"Chanfrein : cliquez 2 lignes en coin, ou leur coin. Une seule cote pour tous les coins de la passe"},
      {Dessin::CONGE, "fillet", L"Congé", L"Congé : cliquez 2 lignes en coin, ou leur coin. Une seule cote pour tous les coins de la passe"},
  };
  outils_.assign(19, nullptr);
  for (const Fiche& f : fiches) {
    const bool ok = f.outil >= 0;
    auto* b = new BoutonEsquisse(this, ok ? 2010 + f.outil : wxID_ANY, f.nom, ok ? wxString(f.aide) : wxString(f.aide) + L" : pas encore dans le logiciel Windows");
    b->icone(f.icone, wxString(f.icone) == "hpoint" ? C_ORANGE : C_TEXTE);
    if (ok) {
      outils_[f.outil] = b;
      const Dessin::Outil o = static_cast<Dessin::Outil>(f.outil);
      b->surClic = [this, o] {
        if (surOutil) surOutil(o);
      };
    } else {
      b->disponible(false);
      const wxString nom = f.nom;
      b->surClic = [this, nom] {
        if (surIndisponible) surIndisponible(nom);
      };
    }
    ordre_.push_back(b);
  }
  ordre_.push_back(nullptr);
  struct FicheC {
    const char* type;
    const wchar_t* nom;
    const wchar_t* aide;
  };
  const FicheC fichesC[] = {
      {"h", L"Horizontal", L"Horizontal : lignes sélectionnées"},
      {"v", L"Vertical", L"Vertical : lignes sélectionnées"},
      {"parallel", L"Parallèle", L"Parallèle : 2 lignes"},
      {"perpendicular", L"Perpendiculaire", L"Perpendiculaire : 2 lignes"},
      {"collinear", L"Colinéaire", L"Colinéaire : 2 lignes portées par la même droite"},
      {"equal", L"Égal", L"Égal : 2 lignes ou 2 cercles/arcs"},
      {"symmetric", L"Symétrie", L"Symétrie : 2 lignes + axe (3ᵉ ligne sélectionnée)"},
      {"fix", L"Fixe", L"Fixe : point / ligne / cercle sélectionné"},
      {"tangent", L"Tangence", L"Tangence : 1 ligne + 1 cercle/arc, ou 2 cercles"},
      {"coaxial", L"Coaxial", L"Coaxial : 2 cercles/arcs de mêmes centres"},
      {"coincident", L"Coïncident", L"Coïncident : 2 points, 1 point + 1 ligne, ou 1 point + 1 cercle/arc"},
      {"midpoint", L"Milieu", L"Milieu : 2 lignes, ou 1 point + 1 ligne"},
      {"construction", L"Construction", L"Construction : hors profil, trait discontinu (touche X)"},
  };
  for (const FicheC& f : fichesC) {
    auto* b = new BoutonEsquisse(this, wxID_ANY, f.nom, f.aide);
    b->icone(f.type, std::string(f.type) == "construction" ? C_GRIS_C : C_VERT);
    const std::string type = f.type;
    b->surClic = [this, type] {
      if (surContrainte) surContrainte(type);
    };
    contraintes_.push_back(b);
    ordre_.push_back(b);
  }
  ordre_.push_back(nullptr);
  auto* cadrer = new BoutonEsquisse(this, wxID_ANY, L"Cadrer", L"Cadrer l'esquisse (Ctrl+F)");
  cadrer->icone("cadrer", C_TEXTE);
  cadrer->surClic = [this] {
    if (surCadrer) surCadrer();
  };
  ordre_.push_back(cadrer);
  orbite_ = new BoutonEsquisse(this, wxID_ANY, L"Vue inclinée", L"Vue 3D inclinée en perspective. Orbite : clic-molette glissé. N = à plat", BoutonEsquisse::ENCADRE);
  orbite_->icone("orbite", C_TEXTE);
  orbite_->surClic = [this] {
    if (surVueInclinee) surVueInclinee();
  };
  ordre_.push_back(orbite_);
  grille_ = new BoutonEsquisse(this, wxID_ANY, L"Grille", L"Afficher / masquer la grille", BoutonEsquisse::ENCADRE);
  grille_->icone("grille", C_TEXTE);
  grille_->surClic = [this] {
    if (surGrille) surGrille();
  };
  grille_->SetToolTip(L"Afficher / masquer la grille. Clic droit : accrocher à la grille de 1 mm");
  grille_->Bind(wxEVT_RIGHT_UP, [this](wxMouseEvent&) {
    if (surGrilleMenu) surGrilleMenu();
  });
  ordre_.push_back(grille_);
  fantome_ = new BoutonEsquisse(this, wxID_ANY, L"Arêtes", L"Afficher / masquer les arêtes du solide derrière l'esquisse");
  fantome_->icone("oeil", C_TEXTE);
  fantome_->surClic = [this] {
    if (surFantome) surFantome();
  };
  ordre_.push_back(fantome_);
  auto* parametres = new BoutonEsquisse(this, wxID_ANY, L"Paramètres", L"Paramètres : clic, mini-liste à droite ; clic droit, liste complète");
  parametres->icone("fx", C_TEXTE);
  parametres->surClic = [this] {
    if (surParametres) surParametres();
  };
  parametres->Bind(wxEVT_RIGHT_UP, [this](wxMouseEvent&) {
    if (surParametresComplets) surParametresComplets();
  });
  ordre_.push_back(parametres);
  abandon_ = new BoutonEsquisse(this, wxID_ANY, L"Abandonner", L"Refermer l'esquisse en oubliant ce qui a été fait depuis son ouverture", BoutonEsquisse::TEXTE);
  abandon_->titre(L"Abandonner");
  abandon_->surClic = [this] {
    if (surAbandon) surAbandon();
  };
  terminer_ = new BoutonEsquisse(this, wxID_ANY, L"Terminer", L"Terminer l'esquisse", BoutonEsquisse::PRINCIPAL);
  terminer_->titre(L"✔ Terminer");
  terminer_->surClic = [this] {
    if (surTerminer) surTerminer();
  };
  Bind(wxEVT_SIZE, [this](wxSizeEvent& e) {
    placer();
    e.Skip();
  });
  Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(C_FOND));
    dc.Clear();
    std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::CreateFromUnknownDC(dc));
    if (!g) return;
    const double f = GetDPIScaleFactor();
    g->Scale(f, f);
    const wxSize t = ToDIP(GetClientSize());
    g->SetBrush(g->CreateBrush(wxBrush(C_BARRE)));
    g->SetPen(g->CreatePen(wxGraphicsPenInfo(th(wxColour(0x3a, 0x3a, 0x3d)), 1)));
    g->DrawRoundedRectangle(12.5, 8.5, t.x - 25, t.y - 13, 12);
    g->SetPen(g->CreatePen(wxGraphicsPenInfo(th(wxColour(0x44, 0x46, 0x4a)), 1)));
    for (int x : separateurs_) {
      const int y = (x >> 16) & 0x7fff;
      g->StrokeLine(x & 0xffff, y, x & 0xffff, y + 34);
    }
  });
  placer();
}

void BarreEsquisse::placer() {
  // Les boutons se suivent et passent à la ligne si la fenêtre est trop étroite, comme dans le navigateur.
  const int W = std::max(300, ToDIP(GetClientSize()).x);
  const int gauche = 23, droite = W - 23, finLigne = droite;
  int x = gauche, y = 15;
  const int H = 34, L = 32, pas = 34, largeursFin = 88 + 3 + 86 + 18;
  separateurs_.clear();
  for (wxWindow* b : ordre_) {
    if (!b) {
      if (x + 6 + L > finLigne) continue;
      x += 3;
      separateurs_.push_back(((y & 0x7fff) << 16) | x);
      x += 4;
      continue;
    }
    if (x + L > finLigne) {
      x = gauche;
      y += H + 2;
    }
    b->SetSize(wxRect(FromDIP(wxPoint(x, y)), FromDIP(wxSize(L, H))));
    x += pas;
  }
  // Abandonner et Terminer collés à droite, sur la dernière rangée s'il y a la place
  if (x + largeursFin > finLigne) {
    x = gauche;
    y += H + 2;
  }
  abandon_->SetSize(wxRect(FromDIP(wxPoint(droite - 86 - 3 - 88, y + 3)), FromDIP(wxSize(88, 28))));
  terminer_->SetSize(wxRect(FromDIP(wxPoint(droite - 86, y + 2)), FromDIP(wxSize(86, 30))));
  const int h = y + H + 12;
  if (h != hauteur_) {
    hauteur_ = h;
    SetMinSize(FromDIP(wxSize(-1, h)));
    if (GetParent()) GetParent()->CallAfter([p = GetParent()] { p->Layout(); });
  }
  Refresh();
}

bool BarreEsquisse::essaiCliquerOutil(Dessin::Outil o) {
  const size_t i = static_cast<size_t>(o);
  if (i >= outils_.size() || !outils_[i] || !outils_[i]->surClic) return false;
  outils_[i]->surClic();
  return true;
}

void BarreEsquisse::outilActif(Dessin::Outil o) {
  for (size_t i = 0; i < outils_.size(); i++)
    if (outils_[i]) outils_[i]->actif(static_cast<int>(i) == static_cast<int>(o));
}
void BarreEsquisse::lectureSeule(bool oui) {
  for (BoutonEsquisse* b : outils_)
    if (b) b->disponible(!oui);
  for (BoutonEsquisse* b : contraintes_) b->disponible(!oui);
}
void BarreEsquisse::grilleActive(bool oui) { grille_->actif(oui); }
void BarreEsquisse::vueInclineeActive(bool oui) { orbite_->actif(oui); }
void BarreEsquisse::fantomeActif(bool oui) { fantome_->icone("oeil", oui ? C_TEXTE : C_DISCRET); }

// ---------- Panneau ----------
PanneauEsquisse::PanneauEsquisse(wxWindow* parent) : wxScrolledWindow(parent, 2006, wxDefaultPosition, wxDefaultSize, wxVSCROLL | wxBORDER_NONE) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  SetScrollRate(0, FromDIP(12));
  EnableScrolling(false, false);  // on repeint tout, les champs sont replacés à la main
  champs_.resize(5);
  for (size_t i = 0; i < champs_.size(); i++) {
    auto* c = new wxTextCtrl(this, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_ENTER | wxTE_RIGHT);
    c->SetBackgroundColour(th(wxColour(0x1e, 0x1f, 0x22)));
    c->SetForegroundColour(C_TEXTE);
    c->SetFont(policeUI(12));
    c->Hide();
    const int k = static_cast<int>(i);
    c->Bind(wxEVT_TEXT_ENTER, [this, k](wxCommandEvent&) { validerChamp(k); });
    c->Bind(wxEVT_KILL_FOCUS, [this, k](wxFocusEvent& e) {
      e.Skip();
      CallAfter([this, k] { validerChamp(k); });
    });
    champs_[i].ctrl = c;
  }
  Bind(wxEVT_PAINT, &PanneauEsquisse::peindre, this);
  Bind(wxEVT_LEFT_DOWN, &PanneauEsquisse::surBas, this);
  Bind(wxEVT_LEFT_DCLICK, &PanneauEsquisse::surDouble, this);
  Bind(wxEVT_MOTION, &PanneauEsquisse::surMouvement, this);
  Bind(wxEVT_LEAVE_WINDOW, [this](wxMouseEvent&) {
    survol_ = wxPoint(-1, -1);
    Refresh();
  });
  Bind(wxEVT_SIZE, [this](wxSizeEvent& e) {
    e.Skip();
    CallAfter([this] { construire(); });
  });
  Bind(wxEVT_SCROLLWIN_THUMBTRACK, [this](wxScrollWinEvent& e) {
    e.Skip();
    CallAfter([this] { placerChamps(); Refresh(); });
  });
  Bind(wxEVT_MOUSEWHEEL, [this](wxMouseEvent& e) {
    e.Skip();
    CallAfter([this] { placerChamps(); Refresh(); });
  });
}

wxBitmapBundle PanneauEsquisse::iconeLigne(const std::string& nom) {
  const auto it = icones_.find(nom);
  if (it != icones_.end()) return it->second;
  const auto ic = ICONES().find(nom);
  const wxBitmapBundle b = imageSvg(ic == ICONES().end() ? ICONES().at("fix") : ic->second, C_VERT, 15);
  icones_[nom] = b;
  return b;
}

void PanneauEsquisse::vider() {
  s_ = nullptr;
  d_ = nullptr;
  rangs_.clear();
  for (Champ& c : champs_) c.ctrl->Hide();
}

void PanneauEsquisse::montrer(const wxString& titre, const Esquisse* s, Dessin* d, const InfosEsquisse& i, const std::string& lectureSeule) {
  titre_ = titre;
  s_ = s;
  d_ = d;
  infos_ = i;
  lecture_ = lectureSeule;
  construire();
}

namespace {
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
wxString deux(double v) { return wxString::Format("%.2f", v); }
}  // namespace

void PanneauEsquisse::construire() {
  if (!s_) return;
  const Esquisse& s = *s_;
  rangs_.clear();
  const int LARG = std::max(180, ToDIP(GetClientSize()).x);
  const int X0 = 15, W = LARG - 2 * X0;
  int y = 10;

  // Coupe un texte en lignes qui tiennent dans la largeur
  const auto couper = [&](const wxString& t, double largeur, double taille) {
    wxArrayString out;
    wxString ligne;
    wxString reste = t;
    while (!reste.empty()) {
      const wxString mot = reste.BeforeFirst(' ');
      reste = reste.AfterFirst(' ');
      const wxString essai = ligne.empty() ? mot : ligne + " " + mot;
      double L;
      mesurer(this, essai, taille, false, &L, nullptr);
      if (L > largeur && !ligne.empty()) {
        out.push_back(ligne);
        ligne = mot;
      } else {
        ligne = essai;
      }
    }
    if (!ligne.empty()) out.push_back(ligne);
    if (out.empty()) out.push_back(wxString());
    return out;
  };
  const auto tete = [&](const wxString& t, Rang::Sorte so = Rang::TETE) {
    Rang r;
    r.sorte = so;
    r.r = wxRect(X0, y, W, 16);
    r.lignes.push_back(majuscules(t));
    rangs_.push_back(std::move(r));
    y += 22;
  };
  const auto note = [&](const wxString& t) {
    Rang r;
    r.sorte = Rang::NOTE;
    r.lignes = couper(t, W, 12);
    const int h = static_cast<int>(r.lignes.size()) * 15;
    r.r = wxRect(X0, y, W, h);
    rangs_.push_back(std::move(r));
    y += h + 4;
  };
  // Une ligne de liste. Les actions se placent à droite, la dernière tout au bout.
  const auto ligne = [&](const wxString& t, const std::string& icone, std::vector<Action> actions, const wxColour& bord) -> Rang& {
    Rang r;
    r.sorte = Rang::LIGNE;
    r.icone = icone;
    r.bord = bord;
    int droite = X0 + W - 6;
    for (auto a = actions.rbegin(); a != actions.rend(); ++a) {
      double L;
      mesurer(this, a->texte, 12, false, &L, nullptr);
      const int l = static_cast<int>(L) + (a->bouton ? 16 : 6);
      a->r = wxRect(droite - l, 0, l, a->bouton ? 22 : 18);
      droite -= l + 2;
    }
    const int debut = X0 + 8 + (icone.empty() ? 0 : 28);
    r.lignes = couper(t, droite - debut - 2, 12);
    const int h = std::max(26, static_cast<int>(r.lignes.size()) * 15 + 10);
    r.r = wxRect(X0, y, W, h);
    for (Action& a : actions) a.r.y = y + (h - a.r.height) / 2;
    r.actions = std::move(actions);
    rangs_.push_back(std::move(r));
    y += h + 4;
    return rangs_.back();
  };
  const auto faireSur = [this](std::function<void(Dessin&)> f) {
    return [this, f] {
      if (faire) faire(f);
    };
  };
  const bool edite = d_ != nullptr;

  tete(titre_, Rang::TITRE);
  if (!lecture_.empty()) note(L"Lecture seule : " + tx(lecture_) + ".");

  // Santé
  tete(L"Santé");
  const SanteEsquisse& H = infos_.sante;
  {
    std::vector<Action> a;
    if (!H.ouverts.empty() && H.aEcart) a.push_back({wxRect(), L"Voir", wxString(), true, [this, H] {
      if (surVoir) surVoir((H.ecartA.x + H.ecartB.x) / 2, (H.ecartA.y + H.ecartB.y) / 2);
    }});
    ligne(tx(texteSante(H)), "", std::move(a), wxNullColour);
    if (H.aEcart && H.ecart < 5) {
      std::vector<Action> b;
      if (edite) b.push_back({wxRect(), L"Refermer", wxString(), true, faireSur([](Dessin& d) { d.refermerEcart(); })});
      ligne(wxString::Format(L"Écart %.2f mm en (%.1f, %.1f)", H.ecart, H.ecartA.x, H.ecartA.y), "", std::move(b), wxNullColour);
    }
    if (!H.doublons.empty()) {
      std::vector<Action> b;
      if (edite) b.push_back({wxRect(), L"Fusionner", wxString(), true, faireSur([](Dessin& d) { d.fusionnerDoublons(); })});
      ligne(wxString::Format(L"%zu point(s) quasi-dupliqué(s)", H.doublons.size()), "", std::move(b), wxNullColour);
    }
    if (!H.degeneres.empty()) {
      std::vector<Action> b;
      if (edite) b.push_back({wxRect(), L"Supprimer", wxString(), true, faireSur([](Dessin& d) { d.supprimerDegeneres(); })});
      ligne(wxString::Format(L"%zu entité(s) dégénérée(s)", H.degeneres.size()), "", std::move(b), wxNullColour);
    }
    for (size_t i = 0; i < H.croisements.size() && i < 5; i++) {
      const Pt p = H.croisements[i];
      std::vector<Action> b;
      b.push_back({wxRect(), L"Voir", wxString(), true, [this, p] {
        if (surVoir) surVoir(p.x, p.y);
      }});
      ligne(wxString::Format(L"Croisement en (%.1f, %.1f)", p.x, p.y), "", std::move(b), wxNullColour);
    }
  }
  y += 4;

  // Sélection
  tete(L"Sélection");
  int champ = 0;
  const auto champNum = [&](const wxString& nom, double v, std::function<void(double)> f) {
    if (champ >= static_cast<int>(champs_.size())) return;
    Rang r;
    r.sorte = Rang::CHAMP;
    r.lignes.push_back(nom);
    r.r = wxRect(X0, y, W, 24);
    r.champ = champ;
    Champ& c = champs_[champ];
    c.f = std::move(f);
    c.initial = deux(v);
    if (!c.ctrl->HasFocus()) c.ctrl->ChangeValue(c.initial);
    rangs_.push_back(std::move(r));
    y += 27;
    champ++;
  };
  const Dessin::Choix* sel = d_ && !d_->selection().empty() ? &d_->selection()[0] : nullptr;
  const auto boutonSupprimer = [&] {
    Rang r;
    r.sorte = Rang::NOTE;
    r.r = wxRect(X0, y, W, 26);
    r.actions.push_back({wxRect(X0, y, 96, 24), L"🗑 Supprimer", wxString(), true, faireSur([](Dessin& d) { d.supprimer(); })});
    rangs_.push_back(std::move(r));
    y += 30;
  };
  if (sel && sel->sorte == Dessin::Choix::ENTITE && s.entite(sel->id)) {
    const Entite& e = *s.entite(sel->id);
    const std::string id = e.id;
    note(tx(noteEntite(s, e)));
    const auto champPoint = [&](const wxString& nx, const wxString& ny, const std::string& p) {
      const Pt* q = s.point(p);
      if (!q) return;
      const double x = q->x, yy = q->y;
      champNum(nx, x, [this, p, yy](double v) { if (faire) faire([=](Dessin& d) { d.reglerPoint(p, v, yy); }); });
      champNum(ny, yy, [this, p, x](double v) { if (faire) faire([=](Dessin& d) { d.reglerPoint(p, x, v); }); });
    };
    if (e.t == "line") {
      champPoint("x1", "y1", e.p1);
      champPoint("x2", "y2", e.p2);
    } else if (e.t == "circle" || e.t == "arc") {
      champPoint("cx", "cy", e.pc);
      champNum("r", e.r, [this, id](double v) { if (faire) faire([=](Dessin& d) { d.reglerRayon(id, v); }); });
      if (e.t == "arc") {
        if (const auto an = anglesArc(s, e)) {
          champNum(L"a1°", an->a1 * 180 / 3.141592653589793, [this, id](double v) { if (faire) faire([=](Dessin& d) { d.reglerAngleArc(id, false, v); }); });
          champNum(L"a2°", an->a2 * 180 / 3.141592653589793, [this, id](double v) { if (faire) faire([=](Dessin& d) { d.reglerAngleArc(id, true, v); }); });
        }
      }
    } else if (e.t == "cpoint") {
      champPoint("x", "y", e.p);
    }
    boutonSupprimer();
  } else if (sel && sel->sorte == Dessin::Choix::POINT && s.point(sel->id)) {
    if (sel->id == "O") {
      note(L"Origine (0,0) : point fixe permanent, ancre des cotes et des centres.");
    } else {
      const std::string p = sel->id;
      note(infos_.fixes.count(p) ? L"Point fixe" : L"Point");
      const Pt* q = s.point(p);
      const double x = q->x, yy = q->y;
      champNum("x", x, [this, p, yy](double v) { if (faire) faire([=](Dessin& d) { d.reglerPoint(p, v, yy); }); });
      champNum("y", yy, [this, p, x](double v) { if (faire) faire([=](Dessin& d) { d.reglerPoint(p, x, v); }); });
      boutonSupprimer();
    }
  } else if (sel && (sel->sorte == Dessin::Choix::CONTRAINTE || sel->sorte == Dessin::Choix::COTE)) {
    note(L"Voir listes ci-dessous (✕ pour retirer).");
    boutonSupprimer();
  } else {
    note(L"Cliquez une entité (outil ➤). Ctrl/Cmd = multi-sélection.");
  }
  y += 6;

  // Contraintes
  tete(L"Contraintes");
  if (s.contraintes.empty()) note(L"Aucune.");
  for (const Contrainte& c : s.contraintes) {
    const std::string id = c.id;
    const auto it = infos_.ecarts.find(id);
    const bool mauvais = it != infos_.ecarts.end() && it->second > 0.05;
    wxString t = tx(descContrainte(s, c));
    if (mauvais) t += wxString::Format(L"  ⚠±%.2f", it->second);
    std::vector<Action> a;
    if (edite) a.push_back({wxRect(), L"✕", L"Retirer", false, faireSur([id](Dessin& d) { d.retirerContrainte(id); })});
    const bool choisi = d_ && d_->estChoisi(Dessin::Choix::CONTRAINTE, id);
    Rang& r = ligne(t, iconeContrainte(c.type), std::move(a), mauvais ? C_ROUGE : choisi ? C_JAUNE : wxNullColour);
    if (edite) r.clic = faireSur([id](Dessin& d) { d.choisirContrainte(id); });
  }
  y += 6;

  // Cotes
  tete(L"Cotes");
  if (s.cotes.empty()) note(L"Aucune — outil 📐.");
  for (const Cote& c : s.cotes) {
    const std::string id = c.id;
    const auto it = infos_.ecarts.find(id);
    const bool mauvais = it != infos_.ecarts.end() && it->second > 0.05;
    wxString t = tx(descCote(c));
    if (mauvais) t += wxString::Format(L"  ⚠±%.2f", it->second);
    std::vector<Action> a;
    if (edite) {
      a.push_back({wxRect(), c.ref ? L"( )" : L"⇄", c.ref ? L"Cote de référence (mesure seulement) : rendre pilotante" : L"Rendre cote de référence (mesure seulement)", false, faireSur([id](Dessin& d) { d.basculerReference(id); })});
      a.push_back({wxRect(), L"✕", L"Retirer", false, faireSur([id](Dessin& d) { d.retirerCote(id); })});
    }
    const bool choisi = d_ && d_->estChoisi(Dessin::Choix::COTE, id);
    const std::string icone = c.type;
    Rang& r = ligne(t, ICONES().count(icone) ? icone : "dim", std::move(a), mauvais ? C_ROUGE : choisi ? C_JAUNE : wxNullColour);
    if (edite) {
      r.clic = faireSur([id](Dessin& d) { d.choisirLigneCote(id); });
      r.dbl = [this, id] {
        if (surOuvrirCote) surOuvrirCote(id);
      };
    }
  }
  hauteur_ = y + 10;
  SetVirtualSize(-1, FromDIP(hauteur_));
  for (int i = champ; i < static_cast<int>(champs_.size()); i++) champs_[i].ctrl->Hide();
  placerChamps();
  Refresh();
}

void PanneauEsquisse::placerChamps() {
  const int defile = GetScrollPos(wxVERTICAL) * FromDIP(12);
  for (const Rang& r : rangs_) {
    if (r.sorte != Rang::CHAMP) continue;
    wxTextCtrl* c = champs_[r.champ].ctrl;
    const wxRect q(FromDIP(wxPoint(r.r.x + r.r.width - 96, r.r.y)), FromDIP(wxSize(96, 24)));
    c->SetSize(q.x, q.y - defile, q.width, q.height);
    c->Show();
  }
}

void PanneauEsquisse::validerChamp(int i) {
  Champ& c = champs_[i];
  if (!c.ctrl->IsShown() || !c.f) return;
  wxString t = c.ctrl->GetValue();
  if (t == c.initial) return;
  t.Trim(true).Trim(false);
  t.Replace(",", ".");
  double v = 0;
  if (!t.ToCDouble(&v) || !std::isfinite(v)) {  // comme le navigateur, un texte illisible est ignoré
    c.ctrl->ChangeValue(c.initial);
    return;
  }
  c.initial = c.ctrl->GetValue();
  const auto f = c.f;
  f(v);
}

wxPoint PanneauEsquisse::versContenu(const wxPoint& p) const {
  const wxPoint d = ToDIP(p);
  return wxPoint(d.x, d.y + ToDIP(GetScrollPos(wxVERTICAL) * FromDIP(12)));
}

const PanneauEsquisse::Rang* PanneauEsquisse::rangSous(const wxPoint& c) const {
  for (const Rang& r : rangs_)
    if (r.r.Contains(c)) return &r;
  return nullptr;
}

const PanneauEsquisse::Action* PanneauEsquisse::actionSous(const wxPoint& c, const Rang** rang) const {
  for (const Rang& r : rangs_)
    for (const Action& a : r.actions)
      if (a.r.Contains(c)) {
        if (rang) *rang = &r;
        return &a;
      }
  return nullptr;
}

void PanneauEsquisse::surBas(wxMouseEvent& e) {
  const wxPoint c = versContenu(e.GetPosition());
  // La fonction part d'abord : le panneau peut se refaire pendant son exécution
  if (const Action* a = actionSous(c)) {
    const auto f = a->f;
    if (f) CallAfter(f);
    return;
  }
  if (const Rang* r = rangSous(c))
    if (r->clic) CallAfter(r->clic);
}

void PanneauEsquisse::surDouble(wxMouseEvent& e) {
  const wxPoint c = versContenu(e.GetPosition());
  if (actionSous(c)) return surBas(e);
  if (const Rang* r = rangSous(c))
    if (r->dbl) CallAfter(r->dbl);
}

void PanneauEsquisse::surMouvement(wxMouseEvent& e) {
  survol_ = versContenu(e.GetPosition());
  const Action* a = actionSous(survol_);
  const wxString bulle = a ? a->infobulle : wxString();
  if (!GetToolTipText().IsSameAs(bulle)) SetToolTip(bulle);
  Refresh();
}

void PanneauEsquisse::peindre(wxPaintEvent&) {
  wxAutoBufferedPaintDC dc(this);
  dc.SetBackground(wxBrush(C_FOND));
  dc.Clear();
  std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::CreateFromUnknownDC(dc));
  if (!g) return;
  const double f = GetDPIScaleFactor();
  g->Scale(f, f);
  {
    const wxSize t = ToDIP(GetClientSize());
    g->SetBrush(g->CreateBrush(wxBrush(C_PANNEAU)));
    g->SetPen(g->CreatePen(wxGraphicsPenInfo(th(wxColour(0x3a, 0x3a, 0x3d)), 1)));
    g->DrawRoundedRectangle(0.5, 0.5, t.x - 1, t.y - 1, 12);
  }
  if (!s_) return;
  const int defile = ToDIP(GetScrollPos(wxVERTICAL) * FromDIP(12));
  g->Translate(0, -defile);
  // D'abord les formes
  for (const Rang& r : rangs_) {
    if (r.sorte == Rang::LIGNE) {
      const bool surv = r.r.Contains(survol_) && (r.clic || !r.actions.empty());
      g->SetBrush(g->CreateBrush(wxBrush(C_RANG)));
      const wxColour bord = r.bord.IsOk() ? r.bord : surv ? C_BLEU : C_BORD;
      g->SetPen(g->CreatePen(wxGraphicsPenInfo(bord, 1)));
      g->DrawRoundedRectangle(r.r.x + 0.5, r.r.y + 0.5, r.r.width - 1, r.r.height - 1, 6);
      if (!r.icone.empty()) g->DrawBitmap(iconeLigne(r.icone).GetBitmap(FromDIP(wxSize(15, 15))), r.r.x + 8, r.r.y + (r.r.height - 15) / 2.0, 15, 15);
    }
    for (const Action& a : r.actions) {
      if (!a.bouton) continue;
      g->SetBrush(g->CreateBrush(wxBrush(a.r.Contains(survol_) ? th(wxColour(0x44, 0x46, 0x4b)) : th(wxColour(0x38, 0x3a, 0x3e)))));
      g->SetPen(g->CreatePen(wxGraphicsPenInfo(th(wxColour(0x4a, 0x4c, 0x50)), 1)));
      g->DrawRoundedRectangle(a.r.x + 0.5, a.r.y + 0.5, a.r.width - 1, a.r.height - 1, 6);
    }
  }
  g.reset();
  // Puis les textes
  double L, H;
  for (const Rang& r : rangs_) {
    const double y0 = r.r.y - defile;
    switch (r.sorte) {
      case Rang::TITRE:
        ecrire(dc, this, r.lignes[0], r.r.x, y0, 11, C_DISCRET, true);
        break;
      case Rang::TETE:
        ecrire(dc, this, r.lignes[0], r.r.x, y0, 11, C_DISCRET);
        break;
      case Rang::NOTE: {
        double y = y0;
        for (const wxString& t : r.lignes) {
          ecrire(dc, this, t, r.r.x, y, 12, C_DISCRET);
          y += 15;
        }
        break;
      }
      case Rang::CHAMP:
        mesurer(this, r.lignes[0], 12, false, &L, &H);
        ecrire(dc, this, r.lignes[0], r.r.x, y0 + (r.r.height - H) / 2, 12, C_DISCRET);
        break;
      case Rang::LIGNE: {
        const int x = r.r.x + 8 + (r.icone.empty() ? 0 : 28);
        double y = y0 + (r.r.height - static_cast<int>(r.lignes.size()) * 15) / 2.0;
        for (const wxString& t : r.lignes) {
          ecrire(dc, this, t, x, y, 12, C_TEXTE);
          y += 15;
        }
        break;
      }
    }
    for (const Action& a : r.actions) {
      const bool surv = a.r.Contains(survol_);
      mesurer(this, a.texte, 12, false, &L, &H);
      ecrire(dc, this, a.texte, a.r.x + (a.r.width - L) / 2, a.r.y - defile + (a.r.height - H) / 2, 12, a.bouton ? C_TEXTE : surv && a.texte == L"✕" ? C_ROUGE : surv ? C_TEXTE : C_DISCRET);
    }
  }
}

// ---------- Bandeau ----------
BandeauEsquisse::BandeauEsquisse(wxWindow* parent) : wxWindow(parent, 2008, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE | wxFULL_REPAINT_ON_RESIZE) {
  SetBackgroundStyle(wxBG_STYLE_PAINT);
  SetMinSize(FromDIP(wxSize(-1, 24)));
  Bind(wxEVT_PAINT, [this](wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(C_FOND));
    dc.Clear();
    std::unique_ptr<wxGraphicsContext> g(wxGraphicsContext::CreateFromUnknownDC(dc));
    if (!g) return;
    const double f = GetDPIScaleFactor();
    g->Scale(f, f);
    const wxSize t = ToDIP(GetClientSize());
    g->SetBrush(g->CreateBrush(wxBrush(C_BANDEAU)));
    g->SetPen(wxNullGraphicsPen);
    g->DrawRoundedRectangle(0, -14, t.x, t.y + 14, 12);
    wxString texte = texte_;
    double x = 16;
    // Les pastilles de couleur du navigateur sont des émojis : on les dessine, Windows les rendrait en monochrome ici
    const auto pastille = [&](const wxColour& fond, const wxColour& bord) {
      g->SetBrush(g->CreateBrush(wxBrush(fond)));
      g->SetPen(g->CreatePen(wxGraphicsPenInfo(bord, 1)));
      g->DrawEllipse(x, t.y / 2.0 - 5.5, 11, 11);
      x += 18;
    };
    if (texte.StartsWith(L"⚫ ", &texte)) pastille(th(wxColour(0x3a, 0x3a, 0x3e)), th(wxColour(0x6a, 0x6a, 0x70)));
    else if (texte.StartsWith(L"🔵 ", &texte)) pastille(C_BLEU, th(wxColour(0x4f, 0xa8, 0xff)));
    g.reset();
    double H;
    mesurer(this, texte, 12, false, nullptr, &H);
    ecrire(dc, this, texte, x, (t.y - H) / 2, 12, C_DISCRET);
  });
}

void BandeauEsquisse::montrer(const wxString& texte) {
  if (texte == texte_) return;
  texte_ = texte;
  Refresh();
}
