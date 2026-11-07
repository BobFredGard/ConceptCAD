#include "fao_vue.h"

#include <wx/checkbox.h>
#include <wx/choice.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/wrapsizer.h>

#include <algorithm>
#include <memory>
#include <sstream>

#include "environnement.h"

namespace {
const wxColour CHAMP(0x1e, 0x1f, 0x22), TEXTE(0xd6, 0xd8, 0xdc), DISCRET(0x9a, 0x9e, 0xa6), BLEU(0x0a, 0x84, 0xff), CHOISI(0x2a, 0x3f, 0x5f), ORANGE(0xff, 0x9f, 0x0a);
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
bool classe(const plan::J& e, const char* c) {
  if (!e.contains("c")) return false;
  std::istringstream is(e["c"].get<std::string>());
  std::string m;
  while (is >> m)
    if (m == c) return true;
  return false;
}
std::string texteDe(const plan::J& e) {
  if (e.contains("x")) return e["x"].get<std::string>();
  std::string r;
  if (e.contains("ch"))
    for (const auto& c : e["ch"]) r += texteDe(c);
  return r;
}
// Une couleur écrite par la page : #rrggbb ou #rgb ; le reste (var(), rgba) garde la couleur prévue
bool couleurDe(const plan::J& e, const char* cle, wxColour& c) {
  if (!e.contains(cle)) return false;
  const std::string s = e[cle].get<std::string>();
  if (s.size() != 7 && s.size() != 4) return false;
  if (s[0] != '#') return false;
  c = wxColour(tx(s));
  return c.IsOk();
}
}  // namespace

VueDom::VueDom(wxWindow* parent, const wxColour& fond) : wxScrolledWindow(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxVSCROLL | wxBORDER_NONE), fond_(fond) {
  SetBackgroundColour(fond);
  SetForegroundColour(TEXTE);
  SetScrollRate(0, FromDIP(12));
}

void VueDom::toucher(long el, const std::string& sorte, const plan::J& v, const wxMouseEvent* m) {
  if (!surToucher) return;
  const bool ctrl = m && m->ControlDown(), maj = m && m->ShiftDown();
  // Après le geste : le moteur va remplacer ce contrôle, il ne faut pas le détruire pendant qu'il répond
  CallAfter([this, el, sorte, v, ctrl, maj] {
    if (surToucher) surToucher(el, sorte, v, ctrl, maj);
  });
}

void VueDom::montrer(const plan::J& racine) {
  racine_ = racine;
  int sx = 0, sy = 0;
  GetViewStart(&sx, &sy);
  Freeze();
  // Les champs valident en perdant le focus : rien ne doit partir de ceux qu'on retire
  auto garde = surToucher;
  surToucher = nullptr;
  SetSizer(nullptr);
  DestroyChildren();
  surToucher = garde;
  auto* s = new wxBoxSizer(wxVERTICAL);
  if (!racine.is_null()) {
    const int l = ToDIP(GetClientSize()).x;
    poser(this, s, racine, 0, l > 40 ? l : 240);
  }
  SetSizer(s);
  FitInside();
  Layout();
  Scroll(0, sy);
  Thaw();
}

void VueDom::poser(wxWindow* parent, wxSizer* s, const plan::J& e, long cliquable, int largeur) {
  const std::string t = e.value("t", std::string());
  const long n = e.value("n", 0L);
  const bool ici = e.contains("ck_");
  const long clic = ici ? n : cliquable;
  const wxString bulle = e.contains("ti") ? tx(e["ti"].get<std::string>()) : wxString();
  const int marge = FromDIP(2);
  auto* boite = dynamic_cast<wxBoxSizer*>(s);
  const int auMilieu = boite && boite->GetOrientation() == wxVERTICAL ? 0 : wxALIGN_CENTER_VERTICAL;
  if (t == "CANVAS" || t == "SVG" || t == "STYLE" || t == "SCRIPT" || t == "A") return;
  if (t == "SELECT") {
    auto* c = new wxChoice(parent, wxID_ANY);
    int cur = -1;
    const auto opts = e["opts"];
    const std::string v = e.value("v", std::string());
    for (size_t i = 0; i < opts.size(); i++) {
      c->Append(tx(opts[i][1].get<std::string>()));
      if (opts[i][0].get<std::string>() == v) cur = static_cast<int>(i);
    }
    if (cur >= 0) c->SetSelection(cur);
    if (!bulle.empty()) c->SetToolTip(bulle);
    c->Enable(!e.contains("off"));
    // La largeur de son texte, sans déborder de la fiche
    c->SetMinSize(wxSize(std::min(c->GetBestSize().x, FromDIP(150)), -1));
    c->SetMaxSize(wxSize(FromDIP(150), -1));
    c->Bind(wxEVT_CHOICE, [this, c, opts, n](wxCommandEvent&) {
      const int i = c->GetSelection();
      if (i >= 0) toucher(n, "change", opts[i][0], nullptr);
    });
    s->Add(c, 0, auMilieu | wxALL, marge);
    return;
  }
  if (t == "INPUT" && (e.value("ty", std::string()) == "checkbox" || e.value("ty", std::string()) == "radio")) {
    auto* c = new wxCheckBox(parent, wxID_ANY, wxEmptyString);
    c->SetValue(e.value("ck", false));
    if (!bulle.empty()) c->SetToolTip(bulle);
    c->Enable(!e.contains("off"));
    c->Bind(wxEVT_CHECKBOX, [this, c, n](wxCommandEvent&) { toucher(n, "change", plan::J(c->GetValue()), nullptr); });
    s->Add(c, 0, auMilieu | wxALL, marge);
    return;
  }
  if (t == "INPUT" || t == "TEXTAREA") {
    const wxString v = tx(e.value("v", std::string()));
    const bool nombre = classe(e, "fao-num");
    long st = wxTE_PROCESS_ENTER | wxBORDER_SIMPLE;
    if (nombre) st |= wxTE_RIGHT;
    if (t == "TEXTAREA") st = wxTE_MULTILINE | wxBORDER_SIMPLE;
    auto* c = new wxTextCtrl(parent, wxID_ANY, v, wxDefaultPosition, wxDefaultSize, st);
    c->SetBackgroundColour(CHAMP);
    c->SetForegroundColour(*wxWHITE);
    if (!bulle.empty()) c->SetToolTip(bulle);
    c->Enable(!e.contains("off"));
    c->SetMinSize(wxSize(FromDIP(t == "TEXTAREA" ? 200 : nombre ? 66 : 120), FromDIP(t == "TEXTAREA" ? 70 : 22)));
    auto initial = std::make_shared<wxString>(v);
    const auto valider = [this, c, initial, n] {
      if (c->GetValue() == *initial) return;
      *initial = c->GetValue();
      toucher(n, "change", plan::J(initial->ToStdString(wxConvUTF8)), nullptr);
    };
    if (t != "TEXTAREA") c->Bind(wxEVT_TEXT_ENTER, [valider](wxCommandEvent&) { valider(); });
    c->Bind(wxEVT_KILL_FOCUS, [valider](wxFocusEvent& ev) {
      ev.Skip();
      valider();
    });
    s->Add(c, t == "TEXTAREA" ? 1 : 0, auMilieu | wxALL, marge);
    return;
  }
  if (t == "BUTTON") {
    auto* b = new BoutonEsquisse(parent, wxID_ANY, tx(texteDe(e)), bulle, BoutonEsquisse::ENCADRE);
    b->fond(fond_);
    b->titre(tx(texteDe(e)));
    b->actif(classe(e, "on"));
    b->SetMinSize(wxSize(b->GetTextExtent(tx(texteDe(e))).x + FromDIP(14), FromDIP(24)));
    b->disponible(!e.contains("off"));
    b->surClic = [this, n] { toucher(n, "click", plan::J(), nullptr); };
    s->Add(b, 0, wxALL, marge);
    return;
  }
  const bool ligneOp = classe(e, "fao-op") || classe(e, "fao-setup") || classe(e, "fao-tl-it");
  const bool horizontal = ligneOp || classe(e, "fao-row") || classe(e, "fao-line") || classe(e, "fao-tabs") || classe(e, "fao-ctl") || classe(e, "fao-pair") || classe(e, "fao-win-h") || classe(e, "fao-actions") || t == "LABEL" || (t == "SPAN" && e.contains("ch"));
  // Une rangée de boutons : côte à côte, à la ligne s'il le faut
  bool queDesBoutons = e.contains("ch") && e["ch"].size() > 1;
  if (queDesBoutons)
    for (const auto& c : e["ch"])
      if (c.value("t", std::string()) != "BUTTON") queDesBoutons = false;
  const bool retour = queDesBoutons || classe(e, "fao-tabs") || (classe(e, "fao-row") && !classe(e, "fao-line"));
  if (!e.contains("ch")) {
    // Une feuille : du texte
    std::string texte = e.value("x", std::string());
    if (texte.empty() && t != "HR") return;
    const bool ligneSeule = !ligneOp && (classe(e, "fao-h") || classe(e, "fao-help") || classe(e, "fao-note") || classe(e, "fao-stats") || t == "DIV");
    auto* l = new wxStaticText(parent, wxID_ANY, tx(texte), wxDefaultPosition, wxDefaultSize, classe(e, "lb") || classe(e, "fao-lab") ? wxST_ELLIPSIZE_END | wxST_NO_AUTORESIZE : 0);
    wxColour c = TEXTE;
    wxFont f = l->GetFont();
    if (classe(e, "fao-h") || classe(e, "fao-win-t")) {
      f.SetWeight(wxFONTWEIGHT_SEMIBOLD);
      c = *wxWHITE;
    } else if (classe(e, "fao-help") || classe(e, "fao-note") || classe(e, "fao-stats")) {
      c = DISCRET;
      f.SetFractionalPointSize(f.GetFractionalPointSize() * 0.92);
    } else if (classe(e, "badge") || classe(e, "fao-tl-s")) {
      c = DISCRET;
    } else if (classe(e, "stalei")) {
      c = ORANGE;
    } else if (classe(e, "hbtn")) {
      c = classe(e, "on") ? BLEU : DISCRET;
    } else if (classe(e, "eye")) {
      c = classe(e, "off") ? DISCRET : wxColour(0x30, 0xd1, 0x58);
    }
    couleurDe(e, "co", c);
    if (e.contains("gr") && e["gr"].get<std::string>() != "normal" && e["gr"].get<std::string>() != "400") f.SetWeight(wxFONTWEIGHT_SEMIBOLD);
    l->SetFont(f);
    l->SetForegroundColour(c);
    if (!bulle.empty()) l->SetToolTip(bulle);
    if (ligneSeule) l->Wrap(FromDIP(std::max(120, largeur - 12)));
    if (clic) {
      l->SetCursor(wxCursor(wxCURSOR_HAND));
      l->Bind(wxEVT_LEFT_DOWN, [this, clic](wxMouseEvent& m) { toucher(clic, "click", plan::J(), &m); });
    }
    const bool extensible = classe(e, "lb") || (classe(e, "fao-lab") && false);
    s->Add(l, extensible ? 1 : 0, (ligneSeule ? wxEXPAND : auMilieu) | wxALL, marge);
    return;
  }
  // Un contenant
  wxWindow* hote = parent;
  wxSizer* interieur = nullptr;
  if (ligneOp) {
    auto* p = new wxPanel(parent, wxID_ANY);
    const bool choisi = classe(e, "sel");
    wxColour fd = choisi ? CHOISI : (parent == this ? fond_ : parent->GetBackgroundColour());
    p->SetBackgroundColour(fd);
    p->SetForegroundColour(TEXTE);
    if (!bulle.empty()) p->SetToolTip(bulle);
    if (clic) p->Bind(wxEVT_LEFT_DOWN, [this, clic](wxMouseEvent& m) { toucher(clic, "click", plan::J(), &m); });
    interieur = new wxBoxSizer(wxHORIZONTAL);
    p->SetSizer(interieur);
    hote = p;
    s->Add(p, 0, wxEXPAND);
  } else if (retour) {
    interieur = new wxWrapSizer(wxHORIZONTAL, wxEXTEND_LAST_ON_EACH_LINE * 0);
    s->Add(interieur, 0, wxEXPAND);
  } else if (horizontal) {
    interieur = new wxBoxSizer(wxHORIZONTAL);
    s->Add(interieur, 0, classe(e, "fao-ctl") || t == "SPAN" || t == "LABEL" ? auMilieu : wxEXPAND);
  } else {
    interieur = new wxBoxSizer(wxVERTICAL);
    s->Add(interieur, 0, wxEXPAND);
  }
  bool premierLibelle = classe(e, "fao-line");
  for (const auto& c : e["ch"]) {
    if (c.value("t", std::string()) == "#") {
      plan::J feuille = {{"t", "SPAN"}, {"x", c["x"]}};
      poser(hote, interieur, feuille, clic, largeur);
      continue;
    }
    poser(hote, interieur, c, clic, largeur);
    // Une ligne de réglage : le libellé à gauche, le champ tout à droite
    if (premierLibelle) {
      static_cast<wxBoxSizer*>(interieur)->AddStretchSpacer(1);
      premierLibelle = false;
    }
  }
  if (ligneOp && hote != parent) hote->Layout();
}

namespace {
bool chercherClic(const plan::J& e, const std::string& texte, int& rang, long& n) {
  if (e.contains("ch"))
    for (const auto& c : e["ch"])
      if (chercherClic(c, texte, rang, n)) return true;
  if ((e.contains("ck_") || e.value("t", std::string()) == "BUTTON") && texteDe(e).find(texte) != std::string::npos) {
    if (e.contains("x") || classe(e, "fao-op") || classe(e, "fao-setup")) {
      if (rang-- == 0) {
        n = e.value("n", 0L);
        return true;
      }
    }
  }
  return false;
}
bool chercherChamp(const plan::J& e, const std::string& libelle, long& n) {
  if (classe(e, "fao-line") && e.contains("ch") && texteDe(e["ch"][0]).rfind(libelle, 0) == 0) {
    std::function<bool(const plan::J&)> champ = [&](const plan::J& x) {
      const std::string t = x.value("t", std::string());
      if (t == "INPUT" || t == "SELECT" || t == "TEXTAREA") {
        n = x.value("n", 0L);
        return true;
      }
      if (x.contains("ch"))
        for (const auto& c : x["ch"])
          if (champ(c)) return true;
      return false;
    };
    return champ(e);
  }
  if (e.contains("ch"))
    for (const auto& c : e["ch"])
      if (chercherChamp(c, libelle, n)) return true;
  return false;
}
}  // namespace

bool VueDom::essaiCliquer(const std::string& texte, int rang) {
  long n = 0;
  if (racine_.is_null() || !chercherClic(racine_, texte, rang, n)) return false;
  if (surToucher) surToucher(n, "click", plan::J(), false, false);
  return true;
}
bool VueDom::essaiChamp(const std::string& libelle, const plan::J& valeur) {
  long n = 0;
  if (racine_.is_null() || !chercherChamp(racine_, libelle, n)) return false;
  if (surToucher) surToucher(n, "change", valeur, false, false);
  return true;
}
