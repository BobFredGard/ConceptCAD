// La fenêtre des composants normalisés et leur pose dans l'assemblage (stdDlg, stdInsert, stdHolePickAt de src/48-composants-normalises.js)
#include <BRepAdaptor_Surface.hxx>
#include <IntCurvesFace_ShapeIntersector.hxx>
#include <gp_Lin.hxx>
#include <gp_Vec.hxx>

#include <wx/config.h>
#include <wx/dcbuffer.h>
#include <wx/dcmemory.h>
#include <wx/graphics.h>
#include <wx/statline.h>
#include <wx/msw/wrapwin.h>

#include <algorithm>
#include <cmath>
#include <map>

#include "cadre.h"
#include "enregistrer.h"
#include "normalises.h"
#include "nombres_js.h"

namespace as = assemblage;
using J = nlohmann::ordered_json;
using normalises::Piece;

namespace {
const wxColour FOND(0x1c, 0x1c, 0x20), TEXTE(0xe8, 0xe8, 0xea), DISCRET(0x98, 0x98, 0x9d), ORANGE(0xff, 0x9f, 0x0a), ROUGE(0xff, 0x6b, 0x60), BLEU(0x0a, 0x84, 0xff);
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
std::string texteDe(const J& j, const char* k) {
  const auto it = j.find(k);
  return it != j.end() && it->is_string() ? it->get<std::string>() : std::string();
}
wxString nombreFr(double v) {  // stdF
  std::string s = js::texte(js::arrondi(v, 3));
  std::replace(s.begin(), s.end(), '.', ',');
  return tx(s);
}

// Ce que la fenêtre retient d'une fois à l'autre (stdUi)
struct Memoire {
  std::string cat = "iso", keyAt = "face", pinAt = "auto";
  J st = J::object();
  bool lue = false;
};
Memoire gUi;
void lireMemoire() {
  if (gUi.lue) return;
  gUi.lue = true;
  wxConfig c(L"ConceptCADNatif");
  wxString t;
  if (!c.Read(L"normalises", &t)) return;
  try {
    const J v = J::parse(t.utf8_string());
    if (v.contains("cat") && v["cat"].is_string()) gUi.cat = v["cat"].get<std::string>();
    if (v.contains("st") && v["st"].is_object()) gUi.st = v["st"];
    gUi.keyAt = v.value("keyAt", gUi.keyAt);
    gUi.pinAt = v.value("pinAt", gUi.pinAt);
  } catch (const std::exception&) {
  }
}
void ecrireMemoire() {
  J v = J::object();
  v["cat"] = gUi.cat;
  v["st"] = gUi.st;
  v["keyAt"] = gUi.keyAt;
  v["pinAt"] = gUi.pinAt;
  wxConfig c(L"ConceptCADNatif");
  c.Write(L"normalises", tx(v.dump()));
}

// L'aperçu (stdSvg) : une silhouette à l'échelle de la place disponible
class Apercu : public wxPanel {
 public:
  explicit Apercu(wxWindow* parent) : wxPanel(parent, wxID_ANY, wxDefaultPosition, parent->FromDIP(wxSize(250, 230))) {
    SetBackgroundStyle(wxBG_STYLE_PAINT);
    Bind(wxEVT_PAINT, &Apercu::peindre, this);
  }
  void poser(const normalises::Apercu& a) {
    a_ = a;
    Refresh();
  }

 private:
  void peindre(wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    dc.SetBackground(wxBrush(wxColour(0x10, 0x10, 0x12)));
    dc.Clear();
    double x0 = 1e300, x1 = -1e300, y0 = 1e300, y1 = -1e300;
    const auto voir = [&](const std::vector<std::vector<std::array<double, 2>>>& L) {
      for (const auto& f : L)
        for (const auto& q : f) {
          x0 = std::min(x0, q[0]);
          x1 = std::max(x1, q[0]);
          y0 = std::min(y0, q[1]);
          y1 = std::max(y1, q[1]);
        }
    };
    voir(a_.formes);
    if (x1 < x0) return;
    const wxSize T = GetClientSize();
    const double marge = FromDIP(14), k = std::min((T.x - 2 * marge) / std::max(x1 - x0, 1e-6), (T.y - 2 * marge) / std::max(y1 - y0, 1e-6));
    const double ox = T.x / 2.0 - k * (x0 + x1) / 2, oy = T.y / 2.0 + k * (y0 + y1) / 2;
    const auto points = [&](const std::vector<std::array<double, 2>>& f) {
      std::vector<wxPoint> P;
      for (const auto& q : f) P.emplace_back(static_cast<int>(std::lround(ox + k * q[0])), static_cast<int>(std::lround(oy - k * q[1])));
      return P;
    };
    dc.SetPen(wxPen(wxColour(0xc8, 0xcc, 0xd2), 1));
    dc.SetBrush(wxBrush(wxColour(0x5a, 0x62, 0x6c)));
    for (const auto& f : a_.formes) {
      const auto P = points(f);
      if (P.size() >= 3) dc.DrawPolygon(static_cast<int>(P.size()), P.data());
    }
    dc.SetBrush(wxBrush(wxColour(0x10, 0x10, 0x12)));
    for (const auto& f : a_.trous) {
      const auto P = points(f);
      if (P.size() >= 3) dc.DrawPolygon(static_cast<int>(P.size()), P.data());
    }
    dc.SetPen(wxPen(wxColour(0xe8, 0xe8, 0xea), 1, wxPENSTYLE_SHORT_DASH));
    for (const auto& f : a_.caches) {
      const auto P = points(f);
      if (P.size() >= 2) dc.DrawLines(static_cast<int>(P.size()), P.data());
    }
    if (a_.axe) {
      dc.SetPen(wxPen(wxColour(0xff, 0x9f, 0x0a), 1, wxPENSTYLE_DOT_DASH));
      const int x = static_cast<int>(std::lround(ox));
      dc.DrawLine(x, FromDIP(4), x, T.y - FromDIP(4));
    }
  }
  normalises::Apercu a_;
};
}  // namespace

class FenetreNormalises : public wxDialog {
 public:
  FenetreNormalises(Cadre* c, const std::string& occ) : wxDialog(c, wxID_ANY, L"🔩 Composants normalisés", wxDefaultPosition, wxDefaultSize, wxDEFAULT_DIALOG_STYLE), cadre_(c), edit_(occ) {
    SetBackgroundColour(FOND);
    auto* tout = new wxBoxSizer(wxVERTICAL);
    if (edit_.empty()) {
      onglets_ = new wxBoxSizer(wxHORIZONTAL);
      for (const normalises::Categorie& k : normalises::categories()) {
        auto* b = new wxButton(this, wxID_ANY, tx(k.lib), wxDefaultPosition, wxDefaultSize, wxBU_EXACTFIT);
        const std::string cle = k.k;
        b->Bind(wxEVT_BUTTON, [this, cle](wxCommandEvent&) {
          gUi.cat = cle;
          sauver();
          redessiner();
        });
        boutonsOnglets_.push_back({cle, b});
        onglets_->Add(b, 0, wxRIGHT, FromDIP(3));
      }
      tout->Add(onglets_, 0, wxALL, FromDIP(10));
    }
    auto* milieu = new wxBoxSizer(wxHORIZONTAL);
    form_ = new wxPanel(this);
    form_->SetBackgroundColour(FOND);
    milieu->Add(form_, 1, wxEXPAND | wxLEFT | wxRIGHT, FromDIP(10));
    apercu_ = new Apercu(this);
    milieu->Add(apercu_, 0, wxRIGHT, FromDIP(10));
    tout->Add(milieu, 1, wxEXPAND);
    auto* bas = new wxBoxSizer(wxHORIZONTAL);
    msg_ = new wxStaticText(this, wxID_ANY, wxEmptyString, wxDefaultPosition, FromDIP(wxSize(260, -1)), wxST_NO_AUTORESIZE);
    msg_->SetForegroundColour(DISCRET);
    bas->Add(msg_, 1, wxALIGN_CENTER_VERTICAL);
    b1_ = new wxButton(this, wxID_ANY, L"🎯 Sur des trous…");
    b2_ = new wxButton(this, wxID_ANY, L"➕ Insérer");
    auto* fermer = new wxButton(this, wxID_ANY, L"Fermer");
    bas->Add(b1_, 0, wxLEFT, FromDIP(6));
    bas->Add(b2_, 0, wxLEFT, FromDIP(6));
    bas->Add(fermer, 0, wxLEFT, FromDIP(6));
    tout->Add(bas, 0, wxEXPAND | wxALL, FromDIP(10));
    SetSizer(tout);
    fermer->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { Close(); });
    b1_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { bouton1(); });
    b2_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { bouton2(); });
    Bind(wxEVT_CLOSE_WINDOW, [this](wxCloseEvent&) {
      if (cadre_->asmNormFen_ == this) cadre_->asmNormFen_ = nullptr;
      Destroy();
    });
    Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& e) {
      if (e.GetKeyCode() == WXK_ESCAPE) Close();
      else e.Skip();
    });
    redessiner();
    CentreOnParent();
  }
  void message(const wxString& m) { msg_->SetLabel(m); }
  // L'essai automatique répond à la place de la souris
  void essaiEtat(const std::string& cat, const J& st) {
    gUi.cat = cat;
    gUi.st[cat] = st;
    redessiner();
  }
  void redessiner() {
    if (fini_) return;
    if (!edit_.empty() && (!cadre_->doc_.assemblage || !as::occurrence(*cadre_->doc_.assemblage, edit_))) return (void)Close();
    if (!edit_.empty()) {
      const J& a = *cadre_->doc_.assemblage;
      const J* o = as::occurrence(a, edit_);
      const std::string cid = texteDe(*o, "comp");
      int n = 0;
      for (const as::Instance& I : as::instances(a, as::racine(a)))
        if (I.comp == cid && !I.chemin.empty()) n++;
      SetTitle(L"🔩 Modifier « " + tx(texteDe(*o, "name")) + L" »");
      nbOcc_ = 0;
      for (const J& c : a["comps"])
        if (c.contains("occ"))
          for (const J& q : c["occ"])
            if (texteDe(q, "comp") == cid) nbOcc_++;
      b1_->SetLabel(wxString::Format(L"✔ Toutes les occurrences (%d)", nbOcc_));
      b2_->SetLabel(L"Celle-ci seulement");
      b2_->Show(nbOcc_ > 1);
    }
    const normalises::Categorie& C = normalises::categorie(gUi.cat);
    gUi.st[C.k] = normalises::etatNormalise(C.k, gUi.st.contains(C.k) ? gUi.st[C.k] : J::object());
    J& st = gUi.st[C.k];
    for (auto& [k, b] : boutonsOnglets_) {
      const bool ici = k == C.k;
      b->SetForegroundColour(ici ? *wxWHITE : wxNullColour);
      b->SetBackgroundColour(ici ? BLEU : wxNullColour);
    }
    // le formulaire est refait à chaque changement
    reconstruction_ = true;
    form_->DestroyChildren();
    reconstruction_ = false;
    auto* col = new wxBoxSizer(wxVERTICAL);
    auto* grille = new wxFlexGridSizer(2, FromDIP(4), FromDIP(8));
    grille->AddGrowableCol(1, 1);
    const auto ligne = [&](const std::string& lib, wxWindow* w) {
      auto* l = new wxStaticText(form_, wxID_ANY, tx(lib));
      l->SetForegroundColour(TEXTE);
      grille->Add(l, 0, wxALIGN_CENTER_VERTICAL);
      grille->Add(w, 1, wxEXPAND);
    };
    const auto liste = [&](const std::vector<normalises::Option>& O, const std::string& v, const std::function<void(const std::string&)>& f) {
      auto* ch = new wxChoice(form_, wxID_ANY);
      for (const normalises::Option& q : O) ch->Append(tx(q.lib));
      for (size_t i = 0; i < O.size(); i++)
        if (O[i].v == v) ch->SetSelection(static_cast<int>(i));
      ch->Bind(wxEVT_CHOICE, [this, O, f](wxCommandEvent& e) {
        const int i = e.GetSelection();
        if (i < 0 || i >= static_cast<int>(O.size())) return;
        f(O[i].v);
        sauver();
        CallAfter([this] { redessiner(); });
      });
      return ch;
    };
    for (const normalises::Champ& f : C.champs) {
      if (f.visible && !f.visible(st)) continue;
      const std::string cle = f.k, cat = C.k;
      if (f.num) {
        const wxString val = tx(texteDe(st, cle.c_str()));
        wxTextEntry* entree = nullptr;
        wxWindow* w = nullptr;
        if (!f.propositions.empty()) {
          wxArrayString sug;
          for (double v : f.propositions) sug.Add(tx(js::texte(v)));
          auto* cb = new wxComboBox(form_, wxID_ANY, val, wxDefaultPosition, wxDefaultSize, sug, wxTE_PROCESS_ENTER);
          entree = cb;
          w = cb;
          cb->Bind(wxEVT_COMBOBOX, [this, cat, cle, cb](wxCommandEvent&) { valeurLibre(cat, cle, cb->GetValue()); });
        } else {
          auto* t = new wxTextCtrl(form_, wxID_ANY, val, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_ENTER);
          entree = t;
          w = t;
        }
        w->Bind(wxEVT_TEXT_ENTER, [this, cat, cle, entree](wxCommandEvent&) { valeurLibre(cat, cle, entree->GetValue()); });
        w->Bind(wxEVT_KILL_FOCUS, [this, cat, cle, entree](wxFocusEvent& e) {
          e.Skip();
          if (!reconstruction_) valeurLibre(cat, cle, entree->GetValue());
        });
        ligne(f.lib, w);
        continue;
      }
      ligne(f.lib, liste(f.options(st), texteDe(st, cle.c_str()), [cat, cle](const std::string& v) { gUi.st[cat][cle] = v; }));
    }
    col->Add(grille, 0, wxEXPAND);
    std::string motif;
    try {
      piece_ = std::make_unique<Piece>(normalises::specification(C.k, st));
    } catch (const std::exception& e) {
      piece_.reset();
      motif = e.what();
    }
    const int largeur = FromDIP(430);
    const auto texte = [&](const wxString& t, const wxColour& c, int haut = 3, bool gras = false) {
      auto* l = new wxStaticText(form_, wxID_ANY, t);
      l->SetForegroundColour(c);
      if (gras) l->SetFont(l->GetFont().Bold());
      l->Wrap(largeur);
      col->Add(l, 0, wxTOP, FromDIP(haut));
    };
    texte(piece_ ? tx(piece_->name) : wxString(L"—"), TEXTE, 8, true);
    if (piece_ && normalises::estClavette(*piece_) && edit_.empty()) {
      auto* g2 = new wxFlexGridSizer(2, FromDIP(4), FromDIP(8));
      auto* l = new wxStaticText(form_, wxID_ANY, L"Attacher par (Dans une rainure)");
      l->SetForegroundColour(TEXTE);
      g2->Add(l, 0, wxALIGN_CENTER_VERTICAL);
      g2->Add(liste({{"face", u8Txt(L"Centre de face (milieu de la rainure)")}, {"arc", u8Txt(L"Centre du cercle (bout le plus proche du clic)")}}, gUi.keyAt, [](const std::string& v) { gUi.keyAt = v; }));
      col->Add(g2, 0, wxTOP, FromDIP(6));
    }
    if (piece_ && piece_->seat == "mid" && edit_.empty()) {
      auto* g2 = new wxFlexGridSizer(2, FromDIP(4), FromDIP(8));
      auto* l = new wxStaticText(form_, wxID_ANY, L"Position dans le trou (Sur des trous)");
      l->SetForegroundColour(TEXTE);
      g2->Add(l, 0, wxALIGN_CENTER_VERTICAL);
      g2->Add(liste({{"auto", u8Txt(L"Au plus court (selon le clic)")}, {"mid", u8Txt(L"Milieu du cylindre")}, {"top", u8Txt(L"Arête haute (entrée)")}, {"bot", u8Txt(L"Arête basse (fond)")}}, gUi.pinAt, [](const std::string& v) { gUi.pinAt = v; }));
      col->Add(g2, 0, wxTOP, FromDIP(6));
    }
    if (piece_) texte(tx(piece_->norm + " · " + piece_->info), DISCRET);
    if (piece_ && piece_->aControles) {
      for (const normalises::Controle& k : piece_->checks) texte((k.ok ? L"✓ " : L"⚠ ") + tx(k.txt), k.ok ? DISCRET : ORANGE);
      texte(L"Contrôle de la géométrie seulement, pas de la résistance.", DISCRET);
    } else if (!piece_ && !motif.empty()) texte(L"⛔ " + tx(motif), ROUGE);
    form_->SetSizer(col, true);
    apercu_->poser(piece_ ? normalises::apercuDe(*piece_) : normalises::Apercu());
    if (edit_.empty()) {
      const bool cle = piece_ && normalises::estClavette(*piece_);
      b1_->SetLabel(cle ? L"🎯 Dans une rainure…" : L"🎯 Sur des trous…");
      b1_->Enable(piece_ && (!piece_->seat.empty() || cle));
      b2_->Enable(piece_ != nullptr);
    } else {
      b1_->Enable(piece_ != nullptr);
      b2_->Enable(piece_ != nullptr);
    }
    Fit();
    Layout();
  }

 private:
  static std::string u8Txt(const wchar_t* w) { return wxString(w).utf8_string(); }
  void sauver() {
    if (!cadre_->essaiSansBoite_ && !cadre_->essaiMenu_) ecrireMemoire();
  }
  void valeurLibre(const std::string& cat, const std::string& cle, const wxString& t) {
    const std::string v = t.utf8_string();
    if (gUi.st[cat].contains(cle) && texteDe(gUi.st[cat], cle.c_str()) == v) return;
    gUi.st[cat][cle] = v;
    sauver();
    CallAfter([this] { redessiner(); });
  }
  void bouton1() {
    if (!piece_) return;
    if (!edit_.empty()) return appliquer(true);
    message(normalises::estClavette(*piece_) ? L"Cliquez le fond d’une rainure…" : L"Cliquez un trou dans la vue…");
    cadre_->asmNormPoseDebut(*piece_, gUi.pinAt, gUi.keyAt);
  }
  void bouton2() {
    if (!piece_) return;
    if (!edit_.empty()) return appliquer(false);
    wxString m;
    cadre_->asmNormInserer(*piece_, m);
    message(m);
  }
  void appliquer(bool toutes) {
    message(cadre_->asmNormRemplacer(edit_, *piece_, toutes));
    redessiner();
  }
  Cadre* cadre_;
  std::string edit_;
  wxBoxSizer* onglets_ = nullptr;
  std::vector<std::pair<std::string, wxButton*>> boutonsOnglets_;
  wxPanel* form_ = nullptr;
  Apercu* apercu_ = nullptr;
  wxStaticText* msg_ = nullptr;
  wxButton* b1_ = nullptr;
  wxButton* b2_ = nullptr;
  std::unique_ptr<Piece> piece_;
  bool reconstruction_ = false, fini_ = false;
  int nbOcc_ = 0;
};

void Cadre::asmNormalises(const std::string& cat) {
  if (asmNormFen_) {
    asmNormFen_->Close();
    return;
  }
  lireMemoire();
  if (gUi.st.contains("gear") && gUi.st["gear"].is_object()) {
    gUi.st["gear"].erase("j");
    gUi.st["gear"].erase("ks");
  }
  if (!cat.empty()) gUi.cat = cat;
  asmNormFen_ = new FenetreNormalises(this, "");
  if (essaiMenu_ || essaiSansBoite_) asmNormFen_->ShowWithoutActivating();
  else asmNormFen_->Show();
}
void Cadre::asmNormModifier(const std::string& occ) {
  if (asmNormFen_) asmNormFen_->Close();
  lireMemoire();
  const J* o = doc_.assemblage ? as::occurrence(*doc_.assemblage, occ) : nullptr;
  const J* c = o ? as::composant(*doc_.assemblage, texteDe(*o, "comp")) : nullptr;
  std::optional<std::pair<std::string, J>> S;
  if (c && c->contains("doc") && (*c)["doc"].is_object() && (*c)["doc"].contains("std")) S = normalises::etatDe((*c)["doc"]["std"]);
  if (!S) {
    etat(L"Ce composant n’est pas une pièce normalisée (ou ses réglages sont illisibles).");
    return;
  }
  gUi.cat = S->first;
  gUi.st[S->first] = S->second;
  asmNormFen_ = new FenetreNormalises(this, occ);
  if (essaiMenu_ || essaiSansBoite_) asmNormFen_->ShowWithoutActivating();
  else asmNormFen_->Show();
}

// stdInsert, stdInsertPair
bool Cadre::asmNormInserer(const Piece& sp, wxString& msg) {
  if (esquisseOuverte_ >= 0) {
    msg = L"Insertion impossible ici.";
    etat(L"Fermez d’abord l’esquisse.");
    return false;
  }
  if (!doc_.assemblage) {
    const bool etaitModifie = doc_.modifie();
    modifierStructure(doc_, [](J& d) { as::assurer(d); });
    doc_.basculeSeule = !etaitModifie;
  }
  if (asmMode_ != "asm") asmAller(as::cheminActif(*doc_.assemblage), "asm");
  const double droite = asmDroiteDeTout(), dx = droite != 0 ? droite + sp.reach : 0;
  std::string idOcc, nomOcc, nomPorteur;
  bool frais = false;
  changerAssemblage([&](J& a) {
    const std::string owner = as::actif(a);
    nomPorteur = texteDe(*as::composant(a, owner), "name");
    if (!sp.paire.empty()) {
      for (const normalises::MembrePaire& P : sp.paire) {
        as::Repere fr = P.fr;
        fr.o[0] += dx;
        const std::string id = normalises::ajouterOccurrence(a, P.sp, owner, fr);
        if (idOcc.empty()) idOcc = id;
      }
    } else {
      as::Repere fr;
      fr.o[0] = dx;
      idOcc = normalises::ajouterOccurrence(a, sp, owner, fr, &frais);
    }
    if (const J* o = as::occurrence(a, idOcc)) nomOcc = texteDe(*o, "name");
  });
  if (idOcc.empty()) {
    msg = L"Insertion impossible ici.";
    return false;
  }
  asmSel_ = idOcc;
  asmLot_.clear();
  asmMontrerChoix();
  montrerRien();
  if (!sp.paire.empty()) {
    etat(L"« " + tx(sp.name) + L" » insérée : dents logées, au bon entraxe. Les deux pièces restent libres : déplacez-les ensemble.");
    msg = L"✓ " + tx(sp.name) + L" : les deux pièces sont posées";
  } else {
    etat((frais ? L"Inséré « " : L"Nouvelle occurrence « ") + tx(nomOcc) + L" » dans « " + tx(nomPorteur) + L" ». Placez-la, ou alignez un point d’accroche.");
    msg = L"✓ " + tx(nomOcc) + L" inséré";
  }
  return true;
}

// « Modifier… » : la pièce change, les liaisons restent
wxString Cadre::asmNormRemplacer(const std::string& occ, const Piece& sp, bool toutes) {
  if (!doc_.assemblage) return L"Modification impossible.";
  J copie = *doc_.assemblage;
  const auto R = normalises::remplacer(copie, occ, sp, toutes);
  if (!R) return L"Modification impossible.";
  if (R->comment == "same") return L"Déjà cette pièce.";
  changerAssemblage([&](J& a) { a = copie; });
  asmMontrerChoix();
  montrerRien();
  etat(wxString::Format(L"Pièce normalisée modifiée : %d occurrence(s) → « ", R->n) + tx(sp.name) + L" » (liaisons gardées). Ctrl+Z pour annuler.");
  return wxString::Format(L"✓ %d occurrence(s) → ", R->n) + tx(sp.name);
}

// stdHoleStart
void Cadre::asmNormPoseDebut(const Piece& sp, const std::string& pinAt, const std::string& keyAt) {
  const bool cle = normalises::estClavette(sp);
  if (sp.seat.empty() && !cle) {
    etat(L"Cette pièce ne se pose pas dans un trou.");
    return;
  }
  if (esquisseOuverte_ >= 0) {
    etat(L"Fermez d’abord l’esquisse.");
    return;
  }
  if (!doc_.assemblage) {
    const bool etaitModifie = doc_.modifie();
    modifierStructure(doc_, [](J& d) { as::assurer(d); });
    doc_.basculeSeule = !etaitModifie;
  }
  if (asmMode_ != "asm") asmAller(as::cheminActif(*doc_.assemblage), "asm");
  asmNormPose_ = std::make_shared<Piece>(sp);
  asmNormPinAt_ = pinAt;
  asmNormKeyAt_ = keyAt;
  vue_->SetCursor(wxCursor(wxCURSOR_CROSS));
  etat(cle ? L"« " + tx(sp.name) + L" » : cliquez le FOND d’une rainure — les rainures identiques de la pièce la recevront aussi. Échap = annuler."
           : L"« " + tx(sp.name) + L" » : cliquez un trou (sa paroi) — tous les trous identiques de la pièce le recevront. Échap = annuler.");
}
void Cadre::asmNormPoseAnnuler() {
  asmNormPose_.reset();
  vue_->SetCursor(wxNullCursor);
  etat(L"Pose sur des trous annulée.");
}

// stdHolePickAt : le rayon du clic traverse tout ce qui est affiché, du plus près au plus loin
bool Cadre::asmNormRayon(const gp_Pnt& origine, const gp_Dir& direction) {
  if (!asmNormPose_) return false;
  if (!doc_.assemblage) {
    asmNormPose_.reset();
    return false;
  }
  const std::shared_ptr<Piece> poseEnCours = asmNormPose_;
  const Piece& sp = *poseEnCours;
  const J& a0 = *doc_.assemblage;
  const bool cle = normalises::estClavette(sp);
  struct Coup {
    double t;
    size_t inst;
    as::V3 p, ld, n;
    bool aN;
  };
  const std::vector<as::Instance> L = as::instances(a0, as::actif(a0));
  const as::Chemin P0 = as::cheminActif(a0);
  std::vector<Coup> coups;
  for (size_t i = 0; i < L.size(); i++) {
    const as::Instance& I = L[i];
    const auto it = asmSolides_.find(I.comp);
    if (it == asmSolides_.end() || it->second->forme.IsNull()) continue;
    as::Chemin abs = P0;
    abs.insert(abs.end(), I.chemin.begin(), I.chemin.end());
    if (!I.chemin.empty() && as::cheminMasque(a0, abs)) continue;
    const as::Repere Fi = as::inverser(I.F);
    const as::V3 ol = as::appliquer(Fi, {origine.X(), origine.Y(), origine.Z()}), dl = as::tourner(Fi, {direction.X(), direction.Y(), direction.Z()});
    IntCurvesFace_ShapeIntersector inter;
    inter.Load(it->second->forme, 1e-6);
    const gp_Lin lg(gp_Pnt(ol[0], ol[1], ol[2]), gp_Dir(dl[0], dl[1], dl[2]));
    inter.Perform(lg, 0, 1e7);
    if (!inter.IsDone()) continue;
    for (int k = 1; k <= inter.NbPnt(); k++) {
      const gp_Pnt q = inter.Pnt(k);
      Coup c;
      c.t = inter.WParameter(k);
      c.inst = i;
      c.p = {q.X(), q.Y(), q.Z()};
      c.ld = dl;
      c.aN = false;
      try {
        const TopoDS_Face& F = inter.Face(k);
        BRepAdaptor_Surface S(F, true);
        gp_Pnt q2;
        gp_Vec du, dv;
        S.D1(inter.UParameter(k), inter.VParameter(k), q2, du, dv);
        gp_Vec nn = du.Crossed(dv);
        if (nn.Magnitude() > 1e-12) {
          nn.Normalize();
          if (F.Orientation() == TopAbs_REVERSED) nn.Reverse();
          c.n = {nn.X(), nn.Y(), nn.Z()};
          c.aN = true;
        }
      } catch (const Standard_Failure&) {
      }
      coups.push_back(c);
    }
  }
  std::stable_sort(coups.begin(), coups.end(), [](const Coup& x, const Coup& y) { return x.t < y.t; });
  for (const Coup& h : coups) {
    const as::Instance& I = L[h.inst];
    const J* c = as::composant(a0, I.comp);
    if (!c) continue;
    const J* dc = c->contains("doc") && (*c)["doc"].is_object() ? &(*c)["doc"] : nullptr;
    // une vis déjà posée : on regarde derrière. Exception : la rainure d'une roue dentée reçoit sa clavette
    if (dc && dc->contains("std") && (*dc)["std"].is_object() && !(cle && texteDe((*dc)["std"], "cat") == "gear")) continue;
    const std::vector<as::FaceAccroche>& G = as::accrochesDe(*asmSolides_[I.comp]);
    const std::string nomC = texteDe(*c, "name");
    if (cle) {
      const auto R = normalises::choisirRainure(G, h.p, h.aN ? &h.n : nullptr, asmNormKeyAt_);
      if (!R) continue;
      std::vector<std::string> ids;
      changerAssemblage([&](J& a) { ids = normalises::poserDansRainures(a, sp, as::actif(a), I.chemin, *R); });
      asmNormPose_.reset();
      vue_->SetCursor(wxNullCursor);
      if (!ids.empty()) {
        asmSel_ = ids[0];
        asmLot_.clear();
        asmMontrerChoix();
      }
      montrerRien();
      const normalises::Operation* key = nullptr;
      for (const normalises::Operation& o : sp.ops)
        if (o.k == "key") key = &o;
      wxString aviser;
      if (std::abs(R->K.w - key->b) > 0.05) aviser += L" ⚠ largeur de rainure " + nombreFr(R->K.w) + L" ≠ b " + nombreFr(key->b);
      if (key->L > R->K.len + 0.01) aviser += L" ⚠ clavette plus longue que la rainure (" + nombreFr(R->K.len) + L")";
      etat(!ids.empty() ? L"« " + tx(sp.name) + wxString::Format(L" » posée dans %zu rainure(s) ", ids.size()) + nombreFr(R->K.w) + L" × " + nombreFr(R->K.len) + L" de « " + tx(nomC) + L" », " + (R->mode == "arc" ? L"contre le bout rond" : L"au centre") + L", liaison rigide." + aviser : wxString(L"Pose impossible dans cette rainure."));
      if (asmNormFen_) asmNormFen_->message(!ids.empty() ? wxString::Format(L"✓ %zu × ", ids.size()) + tx(sp.name) : wxString());
      return true;
    }
    const std::vector<normalises::Trou> H = normalises::trousDe(G);
    const normalises::Trou* t = normalises::trouSous(H, h.p, &h.ld);
    if (!t) continue;
    std::string at;
    if (sp.seat == "mid") {
      at = asmNormPinAt_.empty() ? "auto" : asmNormPinAt_;
      if (at == "auto") at = normalises::positionGoupille(*t, h.p);
    }
    const std::vector<const normalises::Trou*> pareils = normalises::trousPareils(H, *t);
    std::vector<std::string> ids;
    changerAssemblage([&](J& a) { ids = normalises::poserSurTrous(a, sp, as::actif(a), I.chemin, pareils, at); });
    asmNormPose_.reset();
    vue_->SetCursor(wxNullCursor);
    if (!ids.empty()) {
      asmSel_ = ids[0];
      asmLot_.clear();
      asmMontrerChoix();
    }
    montrerRien();
    const wxString lab = t->sorte == "simple" ? L"simples" : t->sorte == "cbore" ? L"lamés" : L"fraisés";
    const wxString ou = at == "mid" ? L", centre au milieu du cylindre" : at == "top" ? L", centre sur l’arête haute" : at == "bot" ? L", centre sur l’arête basse" : L"";
    etat(!ids.empty() ? L"« " + tx(sp.name) + wxString::Format(L" » posé sur %zu trou(s) ", ids.size()) + lab + L" Ø" + nombreFr(2 * t->r) + L" de « " + tx(nomC) + L" »" + ou + L", liaison rigide (suit la pièce)." : wxString(L"Pose impossible sur ce trou."));
    if (asmNormFen_) asmNormFen_->message(!ids.empty() ? wxString::Format(L"✓ %zu × ", ids.size()) + tx(sp.name) : wxString());
    return true;
  }
  etat(cle ? L"Pas de rainure ici : cliquez le fond plat d’une rainure (bouts ronds ou droits). Échap = annuler." : L"Pas de trou ici : cliquez la paroi d’un trou (simple, lamé ou fraisé). Échap = annuler.");
  return true;
}

// Les gestes de l'essai automatique
bool Cadre::asmNormEtapeEssai(const nlohmann::json& e, nlohmann::json& n) {
  const auto versJ = [](const nlohmann::json& s) { return J::parse(s.dump()); };
  const auto piece = [&](const nlohmann::json& q) { return Piece(normalises::specification(q["cat"].get<std::string>(), versJ(q["st"]))); };
  if (e.contains("normInserer")) {
    wxString m;
    n["ok"] = asmNormInserer(piece(e["normInserer"]), m);
    n["msg"] = m.utf8_string();
    return true;
  }
  if (e.contains("normRayon")) {
    const auto& q = e["normRayon"];
    asmNormPoseDebut(piece(q), q.value("pinAt", std::string("auto")), q.value("keyAt", std::string("face")));
    const auto& o = q["o"];
    const auto& d = q["d"];
    n["ok"] = asmNormRayon(gp_Pnt(o[0].get<double>(), o[1].get<double>(), o[2].get<double>()), gp_Dir(d[0].get<double>(), d[1].get<double>(), d[2].get<double>()));
    n["encore"] = asmNormPose_ != nullptr;
    return true;
  }
  if (e.contains("normModifier")) {
    const auto& q = e["normModifier"];
    std::string id = q["occ"].get<std::string>();
    if (doc_.assemblage)
      for (const J& c : (*doc_.assemblage)["comps"])
        if (c.contains("occ"))
          for (const J& o : c["occ"])
            if (texteDe(o, "name") == id) id = texteDe(o, "id");
    n["msg"] = asmNormRemplacer(id, piece(q), q.value("tout", true)).utf8_string();
    return true;
  }
  if (e.contains("normFenetre")) {
    const auto& q = e["normFenetre"];
    asmNormalises(q.value("cat", std::string()));
    if (asmNormFen_ && q.contains("st")) asmNormFen_->essaiEtat(q["cat"].get<std::string>(), versJ(q["st"]));
    wxYield();
    return true;
  }
  if (e.contains("normFermer")) {
    if (asmNormFen_) asmNormFen_->Close();
    return true;
  }
  if (e.contains("normCapture")) {
    if (asmNormFen_) {
      asmNormFen_->Raise();
      asmNormFen_->Refresh();
      asmNormFen_->Update();
      wxYield();
      const wxSize T = asmNormFen_->GetSize();
      wxBitmap b(T);
      wxMemoryDC m(b);
      using ImprimerFenetre = BOOL(WINAPI*)(HWND, HDC, UINT);
      if (const auto imprimer = reinterpret_cast<ImprimerFenetre>(GetProcAddress(GetModuleHandleW(L"user32.dll"), "PrintWindow"))) imprimer(asmNormFen_->GetHWND(), static_cast<HDC>(m.GetHDC()), 2 /* PW_RENDERFULLCONTENT */);
      m.SelectObject(wxNullBitmap);
      b.ConvertToImage().SaveFile(wxString(e["normCapture"].get<std::string>()), wxBITMAP_TYPE_PNG);
    }
    return true;
  }
  return false;
}
