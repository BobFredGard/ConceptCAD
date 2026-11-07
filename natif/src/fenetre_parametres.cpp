#include "configurations.h"
#include "theme.h"
#include "fenetre_parametres.h"

#include <wx/dcbuffer.h>
#include <wx/display.h>
#include <wx/popupwin.h>
#include <wx/scrolwin.h>

#include <algorithm>
#include <cmath>
#include <map>
#include <memory>
#include <vector>

#include "interface_esquisse.h"
#include "parametres.h"

namespace {
const wxColour FOND(0x1c, 0x1c, 0x20), CHAMP(0x10, 0x10, 0x12), BORD(0x3a, 0x3a, 0x40), TEXTE(0xe8, 0xe8, 0xea), DISCRET(0x98, 0x98, 0x9d), ORANGE(0xff, 0x9f, 0x0a), BLEU(0x0a, 0x84, 0xff);
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
std::string u8(const wxString& s) { return std::string(s.utf8_str()); }
std::string avecVirgule(std::string t) {
  std::replace(t.begin(), t.end(), '.', ',');
  return t;
}

// La liste ne prend jamais le focus : le champ continue de recevoir ce qu'on tape
class ListeDessinee : public wxPopupWindow {
 public:
  explicit ListeDessinee(wxWindow* parent) : wxPopupWindow(parent, wxBORDER_NONE) {
    SetBackgroundStyle(wxBG_STYLE_PAINT);
    Bind(wxEVT_PAINT, &ListeDessinee::peindre, this);
    Bind(wxEVT_LEFT_DOWN, [this](wxMouseEvent& e) {
      const int i = e.GetY() / hauteur();
      if (i >= 0 && i < static_cast<int>(lignes.size()) && surChoix) surChoix(i);
    });
    Bind(wxEVT_MOTION, [this](wxMouseEvent& e) {
      const int i = std::min(e.GetY() / hauteur(), static_cast<int>(lignes.size()) - 1);
      if (i != choisi && i >= 0) {
        choisi = i;
        Refresh();
      }
    });
  }
  int hauteur() const { return FromDIP(19); }
  void placer(wxWindow* champ) {
    wxClientDC dc(this);
    dc.SetFont(GetFont());
    int l = FromDIP(170);
    for (const NomPropose& n : lignes) l = std::max(l, dc.GetTextExtent(tx(n.affiche + "     " + n.info + " · " + n.sorte)).x + FromDIP(30));
    const int h = static_cast<int>(lignes.size()) * hauteur() + FromDIP(2);
    const wxPoint p = champ->ClientToScreen(wxPoint(0, champ->GetClientSize().y + 2));
    const wxRect ecran = wxDisplay(champ).GetClientArea();
    SetSize(std::min(p.x, ecran.GetRight() - l), p.y + h > ecran.GetBottom() ? champ->ClientToScreen(wxPoint(0, 0)).y - h - 2 : p.y, l, h);
    Refresh();
  }
  std::vector<NomPropose> lignes;
  int choisi = 0;
  std::function<void(int)> surChoix;

 private:
  void peindre(wxPaintEvent&) {
    wxAutoBufferedPaintDC dc(this);
    const wxSize t = GetClientSize();
    dc.SetBrush(wxBrush(FOND));
    dc.SetPen(wxPen(BLEU));
    dc.DrawRectangle(t);
    for (size_t i = 0; i < lignes.size(); i++) {
      const int y = 1 + static_cast<int>(i) * hauteur();
      if (static_cast<int>(i) == choisi) {
        dc.SetBrush(wxBrush(BLEU));
        dc.SetPen(*wxTRANSPARENT_PEN);
        dc.DrawRectangle(1, y, t.x - 2, hauteur());
      }
      dc.SetTextForeground(static_cast<int>(i) == choisi ? *wxWHITE : TEXTE);
      dc.DrawText(tx(lignes[i].affiche), FromDIP(8), y + FromDIP(2));
      const wxString droite = tx((lignes[i].info.empty() ? "" : avecVirgule(lignes[i].info) + " · ") + lignes[i].sorte);
      dc.SetTextForeground(static_cast<int>(i) == choisi ? *wxWHITE : DISCRET);
      dc.DrawText(droite, t.x - dc.GetTextExtent(droite).x - FromDIP(8), y + FromDIP(2));
    }
  }
};

wxTextCtrl* champSombre(wxWindow* parent, const wxString& v, long style = wxTE_PROCESS_ENTER) {
  auto* c = new wxTextCtrl(parent, wxID_ANY, v, wxDefaultPosition, wxDefaultSize, style | wxBORDER_SIMPLE);
  c->SetBackgroundColour(CHAMP);
  c->SetForegroundColour(*wxWHITE);
  return c;
}
wxStaticText* texteSombre(wxWindow* parent, const wxString& v, const wxColour& c = TEXTE) {
  auto* t = new wxStaticText(parent, wxID_ANY, v);
  t->SetForegroundColour(c);
  return t;
}

// featLbl : le nom de chaque valeur de fonction dans la colonne Origine
wxString libelle(const std::string& k) {
  static const std::map<std::string, const wchar_t*> L = {{"distance", L"distance"}, {"draft", L"dépouille"}, {"angle", L"angle"}, {"dist", L"distance"}, {"thick", L"épaisseur"}, {"radius", L"rayon"}, {"r", L"rayon"}, {"d", L"Ø"}, {"depth", L"profondeur"}, {"cbD", L"Ø lamage"}, {"cbH", L"prof. lamage"}, {"csD", L"Ø fraisure"}, {"stD", L"Ø avant-trou"}, {"stH", L"prof. avant-trou"}, {"len", L"longueur filetée"}, {"qty", L"quantité"}, {"qty2", L"quantité 2"}};
  const auto it = L.find(k);
  return it == L.end() ? tx(k) : wxString(it->second);
}

class FenetreParametres : public wxDialog {
 public:
  FenetreParametres(wxWindow* parent, const ActionsFormules& a) : wxDialog(parent, wxID_ANY, L"ƒx Paramètres", wxDefaultPosition, wxDefaultSize, wxDEFAULT_DIALOG_STYLE | wxRESIZE_BORDER), a_(a) {
    SetBackgroundColour(FOND);
    auto* tout = new wxBoxSizer(wxVERTICAL);
    auto* aide = texteSombre(this, L"Nommez une cote en tapant « nom = valeur » dans sa saisie ; utilisez le nom dans d’autres cotes (« nom*2 », « (L-2*nom)/3 »). Angles en degrés. Un paramètre n’a pas d’unité : c’est le champ qui la donne (mm, °, ou nombre pour une quantité, arrondie à l’entier).", DISCRET);
    aide->Wrap(-1);
    aide->Wrap(FromDIP(760));
    tout->Add(aide, 0, wxEXPAND | wxALL, FromDIP(12));
    corps_ = new wxScrolledWindow(this, wxID_ANY, wxDefaultPosition, FromDIP(wxSize(780, 300)), wxVSCROLL);
    corps_->SetBackgroundColour(FOND);
    corps_->SetScrollRate(0, FromDIP(10));
    tout->Add(corps_, 1, wxEXPAND | wxLEFT | wxRIGHT, FromDIP(12));
    auto* cst = texteSombre(this, L"Constantes (toujours disponibles) : pi = 3,141592653590 ; ex. « pi*D », « 2*pi*R », « D*pi/4 ».\nConditions : if(L > 100 ; 5 ; 3) ; comparaisons < > <= >= == != , and( ; ) or( ; ) not( ). Arrondis au pas : roundmoins(x ; 0,5) roundplus(x ; 5) round(x ; 0,1).", DISCRET);
    cst->Wrap(-1);
    cst->Wrap(FromDIP(760));
    tout->Add(cst, 0, wxEXPAND | wxALL, FromDIP(12));
    auto* bas = new wxBoxSizer(wxHORIZONTAL);
    erreur_ = texteSombre(this, wxEmptyString, ORANGE);
    bas->Add(erreur_, 1, wxALIGN_CENTER_VERTICAL);
    auto* plus = new wxButton(this, wxID_ANY, L"+ Paramètre");
    auto* fermer = new wxButton(this, wxID_CANCEL, L"Fermer");
    auto* derivees = new wxButton(this, wxID_ANY, L"🔗 Dérivées");
    derivees->SetToolTip(L"Les fichiers dont celui-ci dérive : vérifier, rompre, ou en ajouter un");
    derivees->Bind(wxEVT_BUTTON, [this, derivees](wxCommandEvent&) {
      if (a_.menuDerivees) a_.menuDerivees(derivees);
      remplir();
    });
    bas->Add(derivees, 0, wxLEFT, FromDIP(8));
    bas->Add(plus, 0, wxLEFT, FromDIP(8));
    bas->Add(fermer, 0, wxLEFT, FromDIP(8));
    tout->Add(bas, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(12));
    SetSizerAndFit(tout);
    plus->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) {
      appliquer([this] {
        Document& d = a_.document();
        int k = 1;
        while (parControleNom(d, "P" + std::to_string(k), nullptr, nullptr, nullptr) != "") k++;
        d.params.push_back(Parametre{"P" + std::to_string(k), "10", "", 10, true});
        return std::string();
      });
    });
    remplir();
    CentreOnParent();
  }

 private:
  struct Ligne {
    std::string nom, expr, origine, err, unite;
    double valeur = 0;
    bool lectureSeule = false;
    std::function<std::string(const std::string&)> renommer, regler;
    std::function<std::string()> supprimer;
  };
  std::vector<Ligne> lignes() {
    Document& d = a_.document();
    std::vector<Ligne> L;
    for (const ParamDerive& p : d.derives) {
      Ligne l;
      l.nom = p.nom;
      l.expr = avecVirgule(nombreJsFixe(p.value, 12));
      l.valeur = p.value;
      l.err = p.absent ? "disparu de la source" : "";
      l.origine = u8(L"🔗 ") + p.lien;
      l.lectureSeule = true;
      L.push_back(l);
    }
    for (size_t i = 0; i < d.params.size(); i++) {
      const Parametre& p = d.params[i];
      Ligne l;
      l.nom = p.nom;
      l.expr = p.expr;
      l.valeur = p.value;
      l.err = p.err;
      l.origine = u8(L"Paramètre");
      l.renommer = [this, i](const std::string& nm) -> std::string {
        Document& d = a_.document();
        if (nm.empty()) return "Nom requis.";
        const std::string ok = parControleNom(d, nm, nullptr, &d.params[i], nullptr);
        if (!ok.empty()) return ok;
        parRenommer(d, d.params[i].nom, nm);
        d.params[i].nom = nm;
        return "";
      };
      l.regler = [this, i](const std::string& ex) {
        Document& d = a_.document();
        return parReglerParametre(d, d.params[i], ex);
      };
      l.supprimer = [this, i]() {
        Document& d = a_.document();
        d.params.erase(d.params.begin() + i);
        return std::string();
      };
      L.push_back(l);
    }
    for (size_t j = 0; j < d.esquisses.size(); j++)
      for (size_t k = 0; k < d.esquisses[j].cotes.size(); k++) {
        const Cote& c = d.esquisses[j].cotes[k];
        if (c.nom.empty() && c.expr.empty()) continue;
        Ligne l;
        l.nom = c.nom;
        l.expr = !c.expr.empty() ? c.expr : nombreJsFixe(parDimUser(c), 4);
        l.valeur = parDimUser(c);
        l.unite = c.type == "angle" ? u8(L"°") : (c.dia || c.type == "diameter") ? u8(L" (Ø)") : "";
        l.err = c.exprErr;
        l.origine = (d.esquisses[j].nom.empty() ? d.esquisses[j].id : d.esquisses[j].nom) + u8(L" · cote");
        const std::string idc = c.id;
        l.renommer = [this, j, k](const std::string& nm) -> std::string {
          Document& d = a_.document();
          Cote& c = d.esquisses[j].cotes[k];
          if (nm.empty()) {
            c.nom.clear();
            return "";
          }
          const std::string ok = parControleNom(d, nm, &c, nullptr, nullptr);
          if (!ok.empty()) return ok;
          parRenommer(d, c.nom, nm);
          c.nom = nm;
          return "";
        };
        const size_t rangEsquisse = j;
        l.regler = [this, rangEsquisse, idc](const std::string& ex) { return a_.reglerCote(rangEsquisse, idc, ex); };
        L.push_back(l);
      }
    for (size_t i = 0; i < d.porteurs.size(); i++) {
      const PorteurFx& h = d.porteurs[i];
      if (h.nom.empty() && h.expr.empty()) continue;
      Ligne l;
      l.nom = h.nom;
      l.expr = !h.expr.empty() ? h.expr : nombreJsFixe(h.valeur, 4);
      l.valeur = h.valeur;
      l.unite = h.cle.find("angle") != std::string::npos || h.cle.find("draft") != std::string::npos ? u8(L"°") : "";
      l.err = h.err;
      l.origine = h.origine + u8(L" · ") + u8(libelle(h.cle));
      l.renommer = [this, i](const std::string& nm) -> std::string {
        Document& d = a_.document();
        PorteurFx& h = d.porteurs[i];
        if (nm.empty()) {
          h.nom.clear();
          return "";
        }
        const std::string ok = parControleNom(d, nm, nullptr, nullptr, &h);
        if (!ok.empty()) return ok;
        parRenommer(d, h.nom, nm);
        h.nom = nm;
        return "";
      };
      l.regler = [this, i](const std::string& ex) {
        Document& d = a_.document();
        return parReglerPorteur(d, d.porteurs[i], ex);
      };
      L.push_back(l);
    }
    return L;
  }
  void appliquer(const std::function<std::string()>& f) {
    const std::string m = a_.changer(f);
    erreur_->SetLabel(m.empty() ? wxString() : tx("⚠ " + m));
    Layout();
    CallAfter([this] { remplir(); });
  }
  void configurer(const std::function<void(nlohmann::ordered_json&)>& c, const std::string& activer) {
    const std::string m = a_.configurer(c, activer);
    erreur_->SetLabel(m.empty() ? wxString() : tx("⚠ " + m));
    Layout();
    CallAfter([this] { remplir(); });
  }
  // cfgSection : une ligne par variante, valeurs des paramètres et fonctions supprimées
  void sectionConfigurations(wxBoxSizer* tout) {
    using J = nlohmann::ordered_json;
    const Document& d = a_.document();
    auto* tete = new wxBoxSizer(wxHORIZONTAL);
    auto* titre = texteSombre(corps_, L"Configurations");
    titre->SetFont(titre->GetFont().Bold());
    tete->Add(titre, 0, wxALIGN_BOTTOM | wxRIGHT, FromDIP(10));
    tete->Add(texteSombre(corps_, L"une ligne par variante : valeurs des paramètres, fonctions supprimées ; le rond coché = active", DISCRET), 0, wxALIGN_BOTTOM);
    tout->Add(tete, 0, wxTOP | wxBOTTOM, FromDIP(8));
    const J* tp = cfgDe(d);
    if (tp) {
      const J t = *tp;  // chaque action relit le document
      const std::string actif = t["active"].is_string() ? t["active"].get<std::string>() : std::string();
      auto* g = new wxFlexGridSizer(static_cast<int>(t["cols"].size()) + 4, FromDIP(3), FromDIP(8));
      g->AddGrowableCol(1, 1);
      g->AddSpacer(0);
      g->Add(texteSombre(corps_, L"Variante", DISCRET), 0, wxALIGN_CENTER_VERTICAL);
      for (const J& c : t["cols"]) {
        const std::string nom = c.get<std::string>();
        auto* h = new wxBoxSizer(wxHORIZONTAL);
        h->Add(texteSombre(corps_, tx(nom), DISCRET), 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(4));
        auto* x = new wxButton(corps_, wxID_ANY, L"✕", wxDefaultPosition, wxDefaultSize, wxBU_EXACTFIT);
        x->SetToolTip(L"Retirer la colonne");
        x->Bind(wxEVT_BUTTON, [this, nom](wxCommandEvent&) { configurer([nom](J& j) { cfgSupprimerColonne(j, nom); }, ""); });
        h->Add(x, 0, wxALIGN_CENTER_VERTICAL);
        g->Add(h, 0, wxALIGN_CENTER_VERTICAL);
      }
      g->Add(texteSombre(corps_, L"Supprimées", DISCRET), 0, wxALIGN_CENTER_VERTICAL);
      g->AddSpacer(0);
      bool premiere = true;
      for (const J& r : t["rows"]) {
        const std::string id = r["id"].get<std::string>();
        auto* rb = new wxRadioButton(corps_, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, premiere ? wxRB_GROUP : 0);
        premiere = false;
        rb->SetValue(id == actif);
        rb->SetToolTip(L"Activer cette configuration");
        rb->Bind(wxEVT_RADIOBUTTON, [this, id](wxCommandEvent&) { configurer(nullptr, id); });
        g->Add(rb, 0, wxALIGN_CENTER_VERTICAL);
        auto* nomLigne = champSombre(corps_, tx(r["name"].get<std::string>()));
        nomLigne->SetMinSize(FromDIP(wxSize(140, -1)));
        const std::string n0 = r["name"].get<std::string>();
        const auto validerNom = [this, nomLigne, n0, id] {
          const std::string v = u8(wxString(nomLigne->GetValue()).Trim(true).Trim(false));
          if (v.empty() || v == n0) return;
          configurer([id, v](J& j) { cfgRenommerLigne(j, id, v); }, "");
        };
        nomLigne->Bind(wxEVT_TEXT_ENTER, [validerNom](wxCommandEvent&) { validerNom(); });
        nomLigne->Bind(wxEVT_KILL_FOCUS, [validerNom](wxFocusEvent& e) {
          e.Skip();
          validerNom();
        });
        g->Add(nomLigne, 0, wxEXPAND);
        for (const J& c : t["cols"]) {
          const std::string nom = c.get<std::string>();
          const std::string v0 = r["vals"].contains(nom) ? r["vals"][nom].get<std::string>() : std::string();
          auto* x = champSombre(corps_, tx(v0));
          x->SetHint(L"—");
          x->SetMinSize(FromDIP(wxSize(70, -1)));
          brancherListeNoms(x, [this]() -> const Document& { return a_.document(); });
          const auto valider = [this, x, v0, id, nom, actif] {
            const std::string v = u8(wxString(x->GetValue()).Trim(true).Trim(false));
            if (v == v0) return;
            configurer([id, nom, v](J& j) { cfgPoserCellule(j, id, nom, v); }, actif == id ? id : "");
          };
          x->Bind(wxEVT_TEXT_ENTER, [valider](wxCommandEvent&) { valider(); });
          x->Bind(wxEVT_KILL_FOCUS, [valider](wxFocusEvent& e) {
            e.Skip();
            valider();
          });
          g->Add(x, 0, wxEXPAND);
        }
        const size_t nb = r["off"].size();
        auto* so = new wxButton(corps_, wxID_ANY, nb ? wxString::Format(L"%d fonction(s)", static_cast<int>(nb)) : wxString(L"aucune"), wxDefaultPosition, wxDefaultSize, wxBU_EXACTFIT);
        so->SetToolTip(L"Fonctions supprimées dans cette variante");
        std::set<std::string> off;
        for (const J& x : r["off"]) off.insert(x.get<std::string>());
        so->Bind(wxEVT_BUTTON, [this, so, id, off, actif](wxCommandEvent&) {
          wxMenu m;
          std::vector<std::string> ids;
          for (const Fonction& f : a_.document().fonctions) {
            if (!f.repeatId.empty()) continue;
            auto* it = m.AppendCheckItem(wxID_HIGHEST + 100 + static_cast<int>(ids.size()), tx(f.nom.empty() ? f.id : f.nom));
            it->Check(off.count(f.id) > 0);
            ids.push_back(f.id);
          }
          if (ids.empty()) m.Append(wxID_ANY, L"Aucune fonction")->Enable(false);
          const int r2 = so->GetPopupMenuSelectionFromUser(m);
          const int k = r2 - (wxID_HIGHEST + 100);
          if (k < 0 || k >= static_cast<int>(ids.size())) return;
          const std::string fid = ids[static_cast<size_t>(k)];
          configurer([id, fid](J& j) { cfgBasculerSupprimee(j, id, fid); }, actif == id ? id : "");
        });
        g->Add(so, 0, wxALIGN_CENTER_VERTICAL);
        auto* del = new wxButton(corps_, wxID_ANY, L"🗑", wxDefaultPosition, wxDefaultSize, wxBU_EXACTFIT);
        del->SetToolTip(L"Supprimer la configuration");
        del->Bind(wxEVT_BUTTON, [this, id](wxCommandEvent&) { configurer([id](J& j) { cfgSupprimerLigne(j, id); }, ""); });
        g->Add(del, 0, wxALIGN_CENTER_VERTICAL);
      }
      tout->Add(g, 0, wxEXPAND);
    }
    auto* bar = new wxBoxSizer(wxHORIZONTAL);
    auto* add = new wxButton(corps_, wxID_ANY, L"+ Configuration");
    add->SetToolTip(L"Nouvelle variante = l’état actuel du modèle");
    add->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { configurer([this](J& j) { cfgAjouterLigne(a_.document(), j); }, ""); });
    bar->Add(add, 0, wxRIGHT, FromDIP(8));
    const std::vector<std::string> libres = cfgNomsLibres(d);
    if (!libres.empty()) {
      auto* s = new wxChoice(corps_, wxID_ANY);
      s->Append(L"+ Colonne…");
      for (const std::string& n : libres) s->Append(tx(n));
      s->SetSelection(0);
      s->Bind(wxEVT_CHOICE, [this, libres](wxCommandEvent& e) {
        const int k = e.GetSelection() - 1;
        if (k < 0 || k >= static_cast<int>(libres.size())) return;
        const std::string nom = libres[static_cast<size_t>(k)];
        configurer([this, nom](J& j) { cfgAjouterColonne(a_.document(), j, nom); }, "");
      });
      bar->Add(s, 0, wxRIGHT, FromDIP(8));
    }
    if (tp && (*tp)["active"].is_string()) {
      const std::string actif = (*tp)["active"].get<std::string>();
      auto* cap = new wxButton(corps_, wxID_ANY, L"Mémoriser l’état actuel");
      cap->SetToolTip(L"Les valeurs actuelles du modèle et les fonctions masquées deviennent celles de la configuration active");
      cap->Bind(wxEVT_BUTTON, [this, actif](wxCommandEvent&) { configurer([this, actif](J& j) { cfgCapturer(a_.document(), j, actif); }, ""); });
      bar->Add(cap, 0);
    }
    tout->Add(bar, 0, wxTOP | wxBOTTOM, FromDIP(8));
  }
  void remplir() {
    corps_->Freeze();
    corps_->DestroyChildren();
    auto* g = new wxFlexGridSizer(5, FromDIP(3), FromDIP(8));
    g->AddGrowableCol(1, 1);
    g->AddGrowableCol(3, 1);
    for (const wxString& t : {wxString(L"Nom"), wxString(L"Expression"), wxString(L"Valeur"), wxString(L"Origine"), wxString()}) g->Add(texteSombre(corps_, t, DISCRET));
    for (const Ligne& l : lignes()) {
      auto* n = champSombre(corps_, tx(l.nom));
      n->SetHint(L"nom");
      n->SetMinSize(FromDIP(wxSize(120, -1)));
      auto* x = champSombre(corps_, tx(l.expr));
      x->SetMinSize(FromDIP(wxSize(220, -1)));
      brancherListeNoms(x, [this]() -> const Document& { return a_.document(); });
      if (l.lectureSeule) {
        n->Disable();
        x->Disable();
      }
      g->Add(n, 0, wxEXPAND);
      g->Add(x, 0, wxEXPAND);
      const wxString v = !l.err.empty() ? tx("⚠ " + l.err) : std::isfinite(l.valeur) ? tx(avecVirgule(nombreJsFixe(l.valeur, 12)) + l.unite) : wxString();
      g->Add(texteSombre(corps_, v, l.err.empty() ? TEXTE : ORANGE), 0, wxALIGN_CENTER_VERTICAL);
      g->Add(texteSombre(corps_, tx(l.origine), DISCRET), 0, wxALIGN_CENTER_VERTICAL);
      if (l.supprimer) {
        auto* b = new wxButton(corps_, wxID_ANY, L"Suppr.", wxDefaultPosition, wxDefaultSize, wxBU_EXACTFIT);
        b->SetToolTip(L"Supprimer");
        const auto sup = l.supprimer;
        b->Bind(wxEVT_BUTTON, [this, sup](wxCommandEvent&) { appliquer(sup); });
        g->Add(b);
      } else {
        g->AddSpacer(0);
      }
      if (l.lectureSeule) continue;
      // change du navigateur : Entrée ou sortie du champ, seulement si le texte a changé
      const auto valider = [this](wxTextCtrl* c, const std::string& depart, const std::function<std::string(const std::string&)>& f) {
        const std::string t = u8(wxString(c->GetValue()).Trim(true).Trim(false));
        if (t == depart) return;
        c->ChangeValue(tx(t));
        appliquer([f, t] { return f(t); });
      };
      const std::string n0 = l.nom, x0 = l.expr;
      const auto ren = l.renommer, reg = l.regler;
      n->Bind(wxEVT_TEXT_ENTER, [=](wxCommandEvent&) { valider(n, n0, ren); });
      x->Bind(wxEVT_TEXT_ENTER, [=](wxCommandEvent&) { valider(x, x0, reg); });
      n->Bind(wxEVT_KILL_FOCUS, [=](wxFocusEvent& e) {
        e.Skip();
        valider(n, n0, ren);
      });
      x->Bind(wxEVT_KILL_FOCUS, [=](wxFocusEvent& e) {
        e.Skip();
        valider(x, x0, reg);
      });
    }
    auto* tout = new wxBoxSizer(wxVERTICAL);
    tout->Add(g, 0, wxEXPAND);
    sectionConfigurations(tout);
    corps_->SetSizer(tout, true);
    corps_->FitInside();
    corps_->Layout();
    corps_->Thaw();
  }
  ActionsFormules a_;
  wxScrolledWindow* corps_ = nullptr;
  wxStaticText* erreur_ = nullptr;
};
}  // namespace

void brancherListeNoms(wxTextCtrl* champ, std::function<const Document&()> document) {
  struct Etat {
    ListeDessinee* liste = nullptr;
    long debut = 0, fin = 0;
  };
  auto e = std::make_shared<Etat>();
  const auto fermer = [e] {
    if (e->liste) e->liste->Hide();
  };
  const auto inserer = [champ, e, fermer](int i) {
    if (!e->liste || i < 0 || i >= static_cast<int>(e->liste->lignes.size())) return;
    const wxString ins = tx(e->liste->lignes[i].insere);
    champ->Replace(e->debut, e->fin, ins);
    champ->SetInsertionPoint(e->debut + static_cast<long>(ins.length()));
    fermer();
    champ->SetFocus();
  };
  champ->Bind(wxEVT_TEXT, [champ, e, document, fermer, inserer](wxCommandEvent& ev) {
    ev.Skip();
    long a = 0, b = 0;
    std::string mot;
    long d = 0, f = 0;
    champ->GetSelection(&a, &b);
    std::vector<NomPropose> L;
    if (a == b && parMotEnCours(champ->GetValue().ToStdWstring(), a, d, f, mot)) L = parNomsProposes(document(), mot);
    if (L.empty()) return fermer();
    if (!e->liste) {
      e->liste = new ListeDessinee(champ);
      e->liste->surChoix = inserer;
    }
    e->debut = d;
    e->fin = f;
    e->liste->lignes = std::move(L);
    e->liste->choisi = 0;
    e->liste->placer(champ);
    e->liste->Show();
  });
  champ->Bind(wxEVT_CHAR_HOOK, [e, fermer, inserer](wxKeyEvent& ev) {
    if (!e->liste || !e->liste->IsShown()) return ev.Skip();
    const int n = static_cast<int>(e->liste->lignes.size());
    switch (ev.GetKeyCode()) {
      case WXK_DOWN:
        e->liste->choisi = (e->liste->choisi + 1) % n;
        e->liste->Refresh();
        return;
      case WXK_UP:
        e->liste->choisi = (e->liste->choisi - 1 + n) % n;
        e->liste->Refresh();
        return;
      case WXK_RETURN:
      case WXK_NUMPAD_ENTER:
      case WXK_TAB:
        inserer(e->liste->choisi);
        return;
      case WXK_ESCAPE:
        fermer();
        return;
      case WXK_LEFT:
      case WXK_RIGHT:
      case WXK_HOME:
      case WXK_END:
        fermer();
        ev.Skip();
        return;
      default:
        ev.Skip();
    }
  });
  champ->Bind(wxEVT_KILL_FOCUS, [fermer](wxFocusEvent& ev) {
    ev.Skip();
    fermer();
  });
}

wxDialog* creerFenetreParametres(wxWindow* parent, const ActionsFormules& a) { return new FenetreParametres(parent, a); }

void ouvrirFenetreParametres(wxWindow* parent, const ActionsFormules& a) {
  FenetreParametres f(parent, a);
  f.ShowModal();
}

MiniParametres::MiniParametres(wxWindow* parent, const ActionsFormules& a) : wxPanel(parent), a_(a) {
  SetBackgroundColour(th(wxColour(0x28, 0x29, 0x2c)));
  auto* tout = new wxBoxSizer(wxVERTICAL);
  auto* tete = new wxBoxSizer(wxHORIZONTAL);
  tete->Add(texteSombre(this, L"ƒx PARAMÈTRES", DISCRET), 1, wxALIGN_CENTER_VERTICAL);
  auto* complet = new wxButton(this, wxID_ANY, L"≡", wxDefaultPosition, FromDIP(wxSize(24, 22)), wxBU_EXACTFIT);
  complet->SetToolTip(L"Liste complète");
  auto* fermer = new wxButton(this, wxID_ANY, L"×", wxDefaultPosition, FromDIP(wxSize(24, 22)), wxBU_EXACTFIT);
  fermer->SetToolTip(L"Fermer");
  complet->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) {
    if (surListeComplete) surListeComplete();
  });
  fermer->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) {
    if (surFermer) surFermer();
  });
  tete->Add(complet, 0, wxLEFT, FromDIP(4));
  tete->Add(fermer, 0, wxLEFT, FromDIP(4));
  tout->Add(tete, 0, wxEXPAND | wxALL, FromDIP(8));
  liste_ = new wxScrolledWindow(this, wxID_ANY, wxDefaultPosition, FromDIP(wxSize(272, -1)), wxVSCROLL);
  liste_->SetScrollRate(0, FromDIP(10));
  liste_->SetBackgroundColour(GetBackgroundColour());
  tout->Add(liste_, 1, wxEXPAND | wxLEFT | wxRIGHT, FromDIP(8));
  erreur_ = texteSombre(this, wxEmptyString, ORANGE);
  tout->Add(erreur_, 0, wxEXPAND | wxALL, FromDIP(8));
  SetSizer(tout);
  reconstruire();
}

void MiniParametres::rafraichir() {
  if (!enReconstruction_) reconstruire();
}

void MiniParametres::reconstruire() {
  enReconstruction_ = true;
  struct Rang {
    wxString nom, valeur, bulle;
    std::string edition;
    bool attention = false;
    std::function<std::string(const std::string&)> regler;
  };
  std::vector<Rang> R;
  Document& d = a_.document();
  const auto fmt = [](double v, const char* u = "") { return std::isfinite(v) ? tx(avecVirgule(nombreJsFixe(v, 4)) + u) : wxString(); };
  for (const ParamDerive& p : d.derives)
    R.push_back({L"🔗 " + tx(p.nom), fmt(p.value), L"Dérivé de " + tx(p.lien) + (p.absent ? L" : disparu de la source" : L" : à modifier dans ce fichier"), "", p.absent, nullptr});
  for (size_t i = 0; i < d.params.size(); i++) {
    const Parametre& p = d.params[i];
    if (p.nom.empty()) continue;
    R.push_back({tx(p.nom), p.err.empty() ? fmt(p.value) : wxString(), tx(p.err.empty() ? p.expr : p.err), p.expr, !p.err.empty(), [this, i](const std::string& ex) {
                   return a_.changer([this, i, ex] {
                     Document& q = a_.document();
                     return parReglerParametre(q, q.params[i], ex);
                   });
                 }});
  }
  for (size_t j = 0; j < d.esquisses.size(); j++)
    for (const Cote& c : d.esquisses[j].cotes) {
      if (c.nom.empty()) continue;
      const std::string id = c.id;
      R.push_back({tx(c.nom), fmt(parDimUser(c), c.type == "angle" ? "\xC2\xB0" : ""), tx(d.esquisses[j].nom) + L" · cote" + (c.ref ? L" de référence (mesurée, non modifiable)" : L"") + (c.expr.empty() ? wxString() : L" : " + tx(c.expr)), !c.expr.empty() ? c.expr : avecVirgule(nombreJsFixe(parDimUser(c), 12)), !c.exprErr.empty(), c.ref ? std::function<std::string(const std::string&)>() : [this, j, id](const std::string& ex) { return a_.changer([this, j, id, ex] { return a_.reglerCote(j, id, ex); }); }});
    }
  for (size_t i = 0; i < d.porteurs.size(); i++) {
    const PorteurFx& h = d.porteurs[i];
    if (h.nom.empty()) continue;
    const bool ang = h.cle.find("angle") != std::string::npos || h.cle.find("draft") != std::string::npos;
    R.push_back({tx(h.nom), fmt(h.valeur, ang ? "\xC2\xB0" : ""), tx(h.origine) + (h.expr.empty() ? wxString() : L" : " + tx(h.expr)), !h.expr.empty() ? h.expr : avecVirgule(nombreJsFixe(h.valeur, 12)), !h.err.empty(), !h.pris ? std::function<std::string(const std::string&)>() : [this, i](const std::string& ex) {
                   return a_.changer([this, i, ex] {
                     Document& q = a_.document();
                     return parReglerPorteur(q, q.porteurs[i], ex);
                   });
                 }});
  }
  liste_->Freeze();
  liste_->DestroyChildren();
  auto* g = new wxFlexGridSizer(2, FromDIP(1), FromDIP(10));
  g->AddGrowableCol(0, 1);
  if (R.empty()) g->Add(texteSombre(liste_, L"Aucun paramètre. Clic droit sur ƒx : liste complète.", DISCRET));
  for (const Rang& r : R) {
    auto* n = texteSombre(liste_, r.nom);
    n->SetToolTip(r.bulle);
    g->Add(n, 0, wxALIGN_CENTER_VERTICAL);
    if (!r.regler) {
      g->Add(texteSombre(liste_, (r.attention ? L"⚠ " : L"") + r.valeur, r.attention ? ORANGE : TEXTE), 0, wxALIGN_RIGHT);
      continue;
    }
    auto* c = new wxTextCtrl(liste_, wxID_ANY, r.valeur.empty() ? tx(r.edition) : r.valeur, wxDefaultPosition, FromDIP(wxSize(96, -1)), wxTE_PROCESS_ENTER | wxTE_RIGHT | wxBORDER_SIMPLE);
    c->SetBackgroundColour(th(wxColour(0x28, 0x29, 0x2c)));
    c->SetForegroundColour(r.attention ? ORANGE : TEXTE);
    c->SetToolTip(r.bulle);
    brancherListeNoms(c, [this]() -> const Document& { return a_.document(); });
    const wxString montre = c->GetValue();
    const std::string depart = r.edition;
    const auto regler = r.regler;
    // Au clic, le champ montre l'expression ; Entrée ou la sortie du champ valident, Échap annule
    c->Bind(wxEVT_SET_FOCUS, [c, depart](wxFocusEvent& e) {
      e.Skip();
      c->ChangeValue(tx(depart));
      c->CallAfter([c] { c->SelectAll(); });
    });
    const auto valider = [this, c, montre, depart, regler]() {
      if (enReconstruction_) return;
      const std::string t = u8(wxString(c->GetValue()).Trim(true).Trim(false));
      if (t.empty() || t == depart) {
        c->ChangeValue(montre);
        return;
      }
      const std::string m = regler(t);
      erreur_->SetLabel(m.empty() ? wxString() : tx("⚠ " + m));
      Layout();
      CallAfter([this] { rafraichir(); });
    };
    c->Bind(wxEVT_TEXT_ENTER, [valider, this](wxCommandEvent&) {
      valider();
      liste_->SetFocus();
    });
    c->Bind(wxEVT_KILL_FOCUS, [valider](wxFocusEvent& e) {
      e.Skip();
      valider();
    });
    c->Bind(wxEVT_CHAR_HOOK, [c, montre, this](wxKeyEvent& e) {
      if (e.GetKeyCode() != WXK_ESCAPE) return e.Skip();
      c->ChangeValue(montre);
      liste_->SetFocus();
    });
    g->Add(c, 0, wxALIGN_RIGHT);
  }
  liste_->SetSizer(g, true);
  liste_->FitInside();
  liste_->Layout();
  liste_->Thaw();
  Layout();
  enReconstruction_ = false;
}
