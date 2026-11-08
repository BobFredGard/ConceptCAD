// La fenêtre dynamique (src/70-extrusion-dynamique.js, src/71-fenetre-dynamique.js) : aperçu immédiat, poignée dans la vue,
// champ flottant, OK / Annuler / Échap. Annuler remet le document exactement comme à l'ouverture de la fenêtre.
#include <wx/wx.h>
#include <wx/propgrid/propgrid.h>
#include <wx/treectrl.h>

#include <BRepBndLib.hxx>
#include <Bnd_Box.hxx>

#include <algorithm>
#include <cmath>

#include "cadre.h"
#include "enregistrer.h"
#include "faces.h"
#include "fiches.h"
#include "panneau_props.h"
#include "structure.h"
#include "theme.h"

namespace {
wxString tx8(const std::string& s) { return wxString::FromUTF8(s); }
const wxColour C_CARTE_DYN(0x2a, 0x2c, 0x30);
using J = nlohmann::ordered_json;

bool typeDynamique(const Fonction& f) {
  if (!f.repeatId.empty()) return false;
  if (f.type == "extrude") return !f.kwKey.empty() ? false : true;  // une rainure de clavette a sa propre fiche
  return f.type == "revolve" || f.type == "sweep" || f.type == "hole" || f.type == "xfillet";
}
std::string nombreTexte(double v) {
  char b[64];
  snprintf(b, sizeof b, "%.10g", v);
  return b;
}
wxString affiche(double v) {  // String(+v.toFixed(3)) avec une virgule
  char b[64];
  snprintf(b, sizeof b, "%.3f", v);
  std::string s = b;
  while (s.back() == '0') s.pop_back();
  if (s.back() == '.') s.pop_back();
  std::replace(s.begin(), s.end(), '.', ',');
  return tx8(s);
}
bool lireNombre(wxString t, double& v) {
  t.Trim(true).Trim(false);
  t.Replace(",", ".");
  return t.ToCDouble(&v) && std::isfinite(v);
}
}  // namespace

void Cadre::dynCreer() {
  rangDyn_ = new wxBoxSizer(wxHORIZONTAL);
  auto* non = new BoutonEsquisse(carteDroite_, wxID_ANY, L"Annuler", L"Revenir aux valeurs d'avant (Échap)", BoutonEsquisse::ENCADRE);
  auto* oui = new BoutonEsquisse(carteDroite_, wxID_ANY, L"OK", L"Valider", BoutonEsquisse::PRINCIPAL);
  for (BoutonEsquisse* b : {non, oui}) {
    b->SetMinSize(FromDIP(wxSize(76, 28)));
    b->fond(th(C_CARTE_DYN));
  }
  non->titre(L"Annuler");
  oui->titre(L"OK");
  non->surClic = [this] { CallAfter([this] { dynAnnuler(); }); };
  oui->surClic = [this] { CallAfter([this] { dynOk(); }); };
  rangDyn_->AddStretchSpacer(1);  // à droite, comme Annuler / OK du navigateur
  rangDyn_->Add(non, 0, wxEXPAND | wxRIGHT, FromDIP(6));
  rangDyn_->Add(oui, 0, wxEXPAND);
  segDyn_ = new wxBoxSizer(wxVERTICAL);
  carteDroite_->contenu()->Add(segDyn_, 0, wxEXPAND);
  carteDroite_->contenu()->Show(segDyn_, false);
  carteDroite_->contenu()->Add(rangDyn_, 0, wxEXPAND | wxTOP, FromDIP(12));
  carteDroite_->contenu()->Show(rangDyn_, false);
  rangFonction_ = new wxBoxSizer(wxHORIZONTAL);
  auto* voir = new BoutonEsquisse(carteDroite_, wxID_ANY, L"Visible", L"Afficher / masquer la fonction", BoutonEsquisse::ENCADRE);
  auto* suppr = new BoutonEsquisse(carteDroite_, wxID_ANY, L"Supprimer", L"Supprimer la fonction (Ctrl+Z : annuler)", BoutonEsquisse::ENCADRE);
  voir->titre(L"👁 Visible");
  suppr->titre(L"🗑 Supprimer");
  suppr->couleurIcone(th(wxColour(0xff, 0x45, 0x3a)));
  for (BoutonEsquisse* b : {voir, suppr}) {
    b->SetMinSize(FromDIP(wxSize(96, 28)));
    b->fond(th(C_CARTE_DYN));
  }
  voir->surClic = [this] { CallAfter([this] {
    const std::string id = fonctionDuPanneau();
    if (!id.empty()) changerStructure([&](J& d) { stBasculerVisible(d, "features", id); });
  }); };
  suppr->surClic = [this] { CallAfter([this] {
    const std::string id = fonctionDuPanneau();
    if (id.empty() || !confirmerSuppression(L"Supprimer ?")) return;
    if (marqueTemps_ == id) marqueTemps_.clear();
    changerStructure([&](J& d) { stSupprimerFonction(d, id); }, L"Ctrl+Z : annuler.");
  }); };
  rangFonction_->Add(voir, 0, wxRIGHT, FromDIP(6));
  rangFonction_->Add(suppr, 0);
  carteDroite_->contenu()->Add(rangFonction_, 0, wxTOP, FromDIP(12));
  carteDroite_->contenu()->Show(rangFonction_, false);

  // Le champ flottant, à côté de la pointe de la poignée
  champDyn_ = new wxPanel(vue_, wxID_ANY);
  champDyn_->SetBackgroundColour(th(wxColour(0x1e, 0x1e, 0x22)));
  auto* h = new wxBoxSizer(wxHORIZONTAL);
  champDynNom_ = new wxStaticText(champDyn_, wxID_ANY, L"Distance");
  champDynNom_->SetForegroundColour(th(wxColour(0xe8, 0xe8, 0xea)));
  champDynTexte_ = new wxTextCtrl(champDyn_, wxID_ANY, wxEmptyString, wxDefaultPosition, FromDIP(wxSize(64, -1)), wxTE_PROCESS_ENTER);
  champDynUnite_ = new wxStaticText(champDyn_, wxID_ANY, L"mm");
  champDynUnite_->SetForegroundColour(th(wxColour(0xe8, 0xe8, 0xea)));
  h->Add(champDynNom_, 0, wxALIGN_CENTER_VERTICAL | wxLEFT | wxRIGHT, FromDIP(6));
  h->Add(champDynTexte_, 0, wxALIGN_CENTER_VERTICAL | wxTOP | wxBOTTOM, FromDIP(3));
  h->Add(champDynUnite_, 0, wxALIGN_CENTER_VERTICAL | wxLEFT | wxRIGHT, FromDIP(6));
  champDyn_->SetSizerAndFit(h);
  champDyn_->Hide();
  brancherListeNoms(champDynTexte_, [this]() -> const Document& { return doc_; });
  champDynTexte_->Bind(wxEVT_TEXT_ENTER, [this](wxCommandEvent&) {
    const wxString t = champDynTexte_->GetValue();
    vue_->SetFocus();
    CallAfter([this, t] { dynSaisie(t); });
  });
}

// La fonction dont le panneau est ouvert (vide pour une copie de répétition, qui ne se règle pas à part)
std::string Cadre::fonctionDuPanneau() const {
  const wxPGProperty* p = props_->GetPropertyByName(L"nomFonction");
  return p ? p->GetAttribute(L"id").GetString().utf8_string() : std::string();
}

// extSeg : les rangées de boutons du panneau. Reconstruites seulement quand leur état change (un geste rappelle ceci à chaque pas).
void Cadre::dynPanneau(int i) {
  struct Choix {
    wxString titre, aide;
    bool actif;
    std::function<void()> faire;
  };
  std::vector<std::pair<wxString, std::vector<Choix>>> rangs;
  std::string sig;
  if (i >= 0 && i < static_cast<int>(doc_.fonctions.size())) {
    const Fonction& f = doc_.fonctions[i];
    const std::string id = f.id;
    const bool reglable = f.visible && solideCalculable_ && typeDynamique(f);
    if (reglable && f.type == "extrude" && !f.kw && (doc_.profondeurModifiable(i) || f.upto)) {
      sig = id + "|" + f.op + "|" + (f.corpsPropre ? "n" : "") + (f.mid ? "m" : "") + (f.flip ? "f" : "") + (f.upto ? "u" : "") + (f.through ? "t" : "");
      const auto op = [this, id](const std::string& q) {
        return [this, id, q] {
          const Fonction* g = doc_.fonction(id);
          if (!g) return;
          if (q == "new" || g->corpsPropre) return dynOperation(id, q);
          dynRegler(id, [q](Fonction& x) { reglerOperation(x, q); });
        };
      };
      rangs.push_back({L"Opération",
                       {{L"➕ Plot", L"Ajoute de la matière (bossage)", !f.corpsPropre && f.op != "cut", op("add")},
                        {L"➖ Poche", L"Retire de la matière", !f.corpsPropre && f.op == "cut", op("cut")},
                        {L"■ Nouveau corps", L"Solide séparé", f.corpsPropre, op("new")}}});
      const bool flip = f.flip;
      rangs.push_back({L"Direction",
                       {{L"→ Un côté", L"Depuis le plan de l’esquisse, d’un seul côté", !f.mid, [this, id] { dynRegler(id, [](Fonction& x) { x.mid = false; }); }},
                        {L"↕ Symétrique", L"De part et d’autre du plan (la distance est la course totale)", f.mid, [this, id] { dynRegler(id, [](Fonction& x) { x.mid = true; }); }},
                        {L"⇄ Inverser", L"Inverser le sens", flip, [this, id] { dynRegler(id, [](Fonction& x) { x.flip = !x.flip; }); }}}});
      rangs.push_back({L"Étendue",
                       {{L"📏 Distance", L"Une distance donnée", !f.upto && !f.through, [this, id] { dynEtendue(id, "dist"); }},
                        {L"🎯 Jusqu’à la face", L"S’arrête sur une face du corps cible", f.upto, [this, id] { dynEtendue(id, "upto"); }},
                        {L"↑ À travers", L"Traverse toute la matière", f.through, [this, id] { dynEtendue(id, "through"); }}}});
    } else if (reglable && f.type == "revolve") {
      const double a = f.angle != 0 ? std::min(360.0, std::abs(f.angle)) : 360;
      sig = id + "|" + f.op + "|" + nombreTexte(a);
      const auto poser = [this, id](const char* cle, const char* val) { return [this, id, cle, val] { appliquerFiche(id, cle, val); }; };
      rangs.push_back({L"Opération",
                       {{L"➕ Plot", L"Ajoute de la matière", f.op != "cut", poser("s/op", "add")},
                        {L"➖ Poche", L"Retire de la matière", f.op == "cut", poser("s/op", "cut")}}});
      rangs.push_back({L"Angle",
                       {{L"90°", L"", a == 90, poser("n/angle", "90")},
                        {L"180°", L"", a == 180, poser("n/angle", "180")},
                        {L"270°", L"", a == 270, poser("n/angle", "270")},
                        {L"360°", L"Tour complet", a == 360, poser("n/angle", "360")}}});
    }
  }
  if (sig == segSignature_) return;
  segSignature_ = sig;
  segDyn_->Clear(true);
  hauteurSeg_ = 0;
  // Les tuiles du navigateur (.seg) : symbole au-dessus du nom, cadre vert sur le choix en cours
  for (const auto& [nom, choix] : rangs) {
    auto* t = new wxStaticText(carteDroite_, wxID_ANY, nom);
    t->SetForegroundColour(th(wxColour(0x98, 0x98, 0x9d)));
    segDyn_->Add(t, 0, wxTOP, FromDIP(12));
    auto* h = new wxWrapSizer(wxHORIZONTAL);
    int x = 0, lignes = 1, haut = 0;
    const int large = FromDIP(264);
    for (const Choix& c : choix) {
      auto* b = new Tuile(carteDroite_, c.titre, c.titre, c.aide);
      b->fond(th(C_CARTE_DYN));
      b->actif(c.actif);
      const auto faire = c.faire;
      b->surClic = [this, faire] { CallAfter([faire] { faire(); }); };
      h->Add(b, 0, wxTOP | wxRIGHT, FromDIP(5));
      const wxSize m = b->GetMinSize();
      if (x > 0 && x + m.x > large) lignes++, x = 0;
      x += m.x + FromDIP(5);
      haut = std::max(haut, m.y);
    }
    segDyn_->Add(h, 0, wxEXPAND);
    hauteurSeg_ += 12 + ToDIP(t->GetBestSize().y) + lignes * (ToDIP(haut) + 5);
  }
  carteDroite_->contenu()->Show(segDyn_, !rangs.empty());
  carteDroite_->Layout();

  carteDroite_->Refresh();
}

void Cadre::dynRegler(const std::string& id, const std::function<void(Fonction&)>& reglage) {
  for (size_t k = 0; k < doc_.fonctions.size(); k++)
    if (doc_.fonctions[k].id == id) return modifierFonction(static_cast<int>(k), reglage);
}

// Distance, jusqu'à la face, à travers tout
void Cadre::dynEtendue(const std::string& id, const std::string& quoi) {
  const Fonction* f = doc_.fonction(id);
  if (!f) return;
  if (quoi == "upto") return uptoChoisir(id);
  const bool oui = quoi == "through";
  if (f->upto) {
    // Quitter « Jusqu'à la face » : la fonction change de nature, le document suit
    changerStructure([&](J& d) {
      for (J& x : d["features"])
        if (x.value("id", std::string()) == id) {
          x["upto"] = nullptr;
          x["through"] = oui;
          if (oui) x["distance"] = nullptr;
        }
    }, L"Ctrl+Z : annuler.");
    for (size_t q = 0; q < doc_.fonctions.size(); q++)
      if (doc_.fonctions[q].id == id) {
        doc_.fonctions[q].nom = nomExtrusion(doc_, doc_.fonctions[q]);
        choisirFonction(static_cast<int>(q));
      }
    return;
  }
  dynRegler(id, [oui](Fonction& x) { reglerATravers(x, oui); });
}

// À chaque sélection d'une fonction : la session s'ouvre, ou continue si c'est la même
void Cadre::dynSelection(int i) {
  const Fonction& f = doc_.fonctions[i];
  dynPCalculee_ = false;
  if (!typeDynamique(f)) {
    dynSel_.clear();
    return;
  }
  dynSel_ = f.id;
  const bool vue = !dynVus_.insert(f.id).second;
  if (dyn_ && dyn_->id == f.id) return;
  SessionDyn S;
  S.id = f.id;
  S.annul = annulations_.size();
  // La fonction vient de naître : l'annulation qui l'a créée donne l'état d'avant (extDynNew, fdynStart)
  if (!vue && !annulations_.empty()) {
    const ModifCote& m = annulations_.back();
    const auto sans = [&](const std::vector<Fonction>& L) { return std::none_of(L.begin(), L.end(), [&](const Fonction& x) { return x.id == f.id; }); };
    if (m.docAvant && sans(m.docAvant->fonctions)) {
      S.neuf = true;
      S.snap = m.docAvant;
    } else if (!m.docAvant && m.avecFonctions && sans(m.fonctionsAvant)) {
      S.neuf = true;
      S.snap = std::make_shared<Document>(doc_);
      S.snap->fonctions = m.fonctionsAvant;
      S.snap->esquisses = m.esquissesAvant;
    }
    if (S.neuf) S.annul--;
  }
  if (!S.neuf) S.snap = std::make_shared<Document>(doc_);
  const bool neuf = S.neuf;
  dyn_ = std::move(S);
  if (neuf) {
    if (f.type == "extrude") etat(L"Extrusion : tirez la flèche ou tapez la distance, puis OK (Échap = annuler).");
    else if (f.type == "revolve") etat(L"Révolution : tournez la poignée ou tapez l’angle, puis OK (Échap = annuler).");
    else if (f.type == "hole") etat(L"Perçage : tirez la flèche ou tapez la profondeur, puis OK (Échap = annuler).");
    else if (f.type == "xfillet") etat(tx8(f.nom) + L" : tirez la flèche ou tapez la valeur, puis OK (Échap = annuler).");
  }
}

// extArrowGeom, fdynHandle
void Cadre::dynCalculer() {
  dynP_ = PoigneeDyn{};
  dynPCalculee_ = true;
  int i = -1;
  for (size_t k = 0; k < doc_.fonctions.size(); k++)
    if (doc_.fonctions[k].id == dynSel_) i = static_cast<int>(k);
  if (i < 0) return;
  const Fonction& f = doc_.fonctions[i];
  if (!f.visible || !solideCalculable_) return;
  const Esquisse* s = doc_.esquisse(f.esquisse);
  PoigneeDyn P;
  if (f.type == "extrude") {
    if (f.upto || f.through || !s || !doc_.profondeurModifiable(i)) return;
    double x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
    const auto ajoute = [&](double x, double y) {
      x0 = std::min(x0, x), y0 = std::min(y0, y), x1 = std::max(x1, x), y1 = std::max(y1, y);
    };
    for (const Entite& e : s->entites) {
      if (e.construction) continue;
      if (e.t == "line") {
        for (const std::string* id : {&e.p1, &e.p2})
          if (const Pt* q = s->point(*id)) ajoute(q->x, q->y);
      } else if (e.t == "circle" || e.t == "arc") {
        if (const Pt* q = s->point(e.pc)) {
          ajoute(q->x - e.r, q->y - e.r);
          ajoute(q->x + e.r, q->y + e.r);
        }
      } else if (e.t == "spline") {
        for (const std::string& id : e.pts)
          if (const Pt* q = s->point(id)) ajoute(q->x, q->y);
      }
    }
    if (!(x1 >= x0)) return;
    P.extrusion = true;
    P.C = pointMonde(*s, (x0 + x1) / 2, (y0 + y1) / 2);
    P.n = gp_Vec(s->n[0], s->n[1], s->n[2]);
    P.n.Normalize();
    P.fin = f.mid ? std::abs(f.distance) / 2 : (f.flip ? -f.distance : f.distance);
    P.val = std::abs(f.distance);
    P.P = P.C.Translated(P.n * P.fin);
    P.A = P.fin < 0 ? -P.n : P.n;
    P.label = L"Distance";
    P.unite = L"mm";
    P.cle = "n/distance";
    P.step = 1;
    P.mini = 0.1;
    P.maxi = 1e9;
  } else if (f.type == "hole") {
    if (!s) return;
    const J d = documentJson(doc_);
    const J* x = nullptr;
    for (const J& k : d["features"])
      if (k.value("id", std::string()) == f.id) x = &k;
    if (!x) return;
    const std::string kind = x->value("kind", std::string()), end = x->contains("end") && (*x)["end"].is_string() ? (*x)["end"].get<std::string>() : std::string();
    const std::string pil = kind == "ream" ? piloteAlesage(*x) : std::string();
    if (kind == "ream" && pil == "open") return;
    const bool ream = kind == "ream" && pil != "blind";
    if (!ream && kind != "ream" && !end.empty() && end != "blind") return;
    const Pt* q = nullptr;
    for (const Entite& e : s->entites)
      if (!q && e.t == "cpoint" && e.percage) q = s->point(e.p);
    if (!q) return;
    const auto nombre = [&](const char* c, double defaut) {
      const double v = x->contains(c) && (*x)[c].is_number() ? (*x)[c].get<double>() : 0;
      return v != 0 ? v : defaut;
    };
    P.C = pointMonde(*s, q->x, q->y);
    P.n = gp_Vec(s->n[0], s->n[1], s->n[2]);
    P.n.Normalize();
    P.n *= f.flip ? 1 : -1;
    if (ream) {
      const double D = std::max(0.2, nombre("reamD", 6));
      P.val = std::max(0.1, nombre("reamH", D * 1.5));
      P.label = L"Profondeur alésage";
      P.cle = "n/reamH";
      P.mini = 0.1;
    } else {
      P.val = nombre("depth", 10);
      P.label = L"Profondeur";
      P.cle = "n/depth";
      P.mini = 0.5;
    }
    P.unite = L"mm";
    P.step = 1;
    P.maxi = 2000;
    P.P = P.C.Translated(P.n * P.val);
    P.A = P.n;
  } else if (f.type == "xfillet") {
    if (f.aretes.empty()) return;
    const AreteConge& E = f.aretes[0];
    P.C = gp_Pnt(E.pos[0], E.pos[1], E.pos[2]);
    P.n = gp_Vec(0, 0, 1);
    if (!forme_.IsNull()) {
      Bnd_Box b;
      BRepBndLib::Add(forme_, b);
      if (!b.IsVoid()) {
        double a0, a1, a2, b0, b1, b2;
        b.Get(a0, a1, a2, b0, b1, b2);
        const gp_Vec d(gp_Pnt((a0 + b0) / 2, (a1 + b1) / 2, (a2 + b2) / 2), P.C);
        if (d.SquareMagnitude() > 1e-9) P.n = d.Normalized();
      }
    }
    P.val = E.r > 0 ? E.r : 1;
    P.label = f.chamfer ? L"Distance" : L"Rayon";
    P.unite = L"mm";
    P.step = 0.1;
    P.mini = 0.05;
    P.maxi = 500;
    P.P = P.C.Translated(P.n * P.val);
    P.A = P.n;
    P.toutesAretes = true;
  } else if (f.type == "revolve") {
    if (!s) return;
    gp_Pnt A;
    gp_Vec d;
    if (f.axeK == "line") {
      const Entite* e = nullptr;
      for (const Entite& x : s->entites)
        if (x.id == f.axeId) e = &x;
      const Pt* a = e ? s->point(e->p1) : nullptr;
      const Pt* b = e ? s->point(e->p2) : nullptr;
      if (!a || !b) return;
      A = pointMonde(*s, a->x, a->y);
      d = gp_Vec(A, pointMonde(*s, b->x, b->y));
    } else if (f.axeK == "sys") {
      const Vec3 w = f.axeD == "X" ? Vec3{1, 0, 0} : f.axeD == "Y" ? Vec3{0, 1, 0} : Vec3{0, 0, 1};
      const double dn = w[0] * s->n[0] + w[1] * s->n[1] + w[2] * s->n[2];
      A = pointMonde(*s, 0, 0);
      d = gp_Vec(w[0] - s->n[0] * dn, w[1] - s->n[1] * dn, w[2] - s->n[2] * dn);
    } else {
      return;
    }
    if (d.Magnitude() < 1e-9) return;
    d.Normalize();
    double mieux = -1;
    gp_Pnt R0;
    for (const Entite& e : s->entites) {
      if (e.construction) continue;
      for (const std::string* id : {&e.p1, &e.p2, &e.pc}) {
        const Pt* q = s->point(*id);
        if (!q) continue;
        const gp_Pnt v = pointMonde(*s, q->x, q->y);
        const gp_Vec r(A, v);
        const double l = (r - d * r.Dot(d)).Magnitude();
        if (l > mieux) mieux = l, R0 = v;
      }
    }
    if (!(mieux > 1e-6)) return;
    P.rot = true;
    P.C = A;
    P.n = d;
    P.P = A.Translated(d * gp_Vec(A, R0).Dot(d));
    P.A = d;
    P.val = f.angle != 0 ? std::min(360.0, std::abs(f.angle)) : 360;
    P.label = L"Angle";
    P.unite = L"°";
    P.cle = "n/angle";
    P.step = 1;
    P.mini = 1;
    P.maxi = 360;
  } else {
    return;  // balayage : OK et Annuler seulement
  }
  P.actif = true;
  dynP_ = P;
}

// extDynTick, fdynTick : à chaque temps libre
void Cadre::dynTick() {
  if (dynOccupe_ > 0 || !rangDyn_) return;
  if (dyn_ && dynSel_ != dyn_->id) dyn_.reset();
  const bool ouverte = dyn_ && atelier_ == Atelier::CAO && esquisseOuverte_ < 0 && asmMode_ != "asm" && !asmInspect_ && !enChoix() && docOuvert_;
  if (ouverte != rangDynMontre_) {
    rangDynMontre_ = ouverte;
    carteDroite_->contenu()->Show(rangDyn_, ouverte);
    carteDroite_->Layout();
  }
  if (ouverte && !dynPCalculee_) {
    dynCalculer();
    dynPosee_ = dynPosee_ && vue_->gizmoEnMain();  // la poignée se repose au lâcher
    if (vue_->gizmoEnMain() && dynP_.actif) vue_->deplacerGizmo({dynP_.P.X(), dynP_.P.Y(), dynP_.P.Z()}, {dynP_.A.X(), dynP_.A.Y(), dynP_.A.Z()});
  }
  const bool poignee = ouverte && dynP_.actif && !pioche_;
  if (poignee && (!dynPosee_ || !vue_->gizmoActif()) && !vue_->gizmoEnMain()) {
    Vue3D::Gizmo g;
    g.actif = true;
    g.o = {dynP_.P.X(), dynP_.P.Y(), dynP_.P.Z()};
    g.ax[2] = {dynP_.A.X(), dynP_.A.Y(), dynP_.A.Z()};
    g.ax[0] = g.ax[1] = g.ax[2];
    (dynP_.rot ? g.anneau : g.fleche)[2] = true;
    vue_->poserGizmo(g);
    dynPosee_ = true;
  } else if (!poignee && dynPosee_ && !vue_->gizmoEnMain()) {
    vue_->poserGizmo(Vue3D::Gizmo{});
    dynPosee_ = false;
  }
  // Le champ flottant
  bool champ = poignee && dynPosee_;
  if (champ) {
    const wxPoint p = vue_->pointeGizmo();
    const wxSize t = vue_->GetClientSize();
    champ = p.x > -2000 && p.x < t.x && p.y > -2000 && p.y < t.y;
    if (champ) {
      if (champDynNom_->GetLabel() != dynP_.label || champDynUnite_->GetLabel() != dynP_.unite) {
        champDynNom_->SetLabel(dynP_.label);
        champDynUnite_->SetLabel(dynP_.unite);
        champDyn_->Fit();
      }
      if (FindFocus() != champDynTexte_ && champDynTexte_->GetValue() != affiche(dynP_.val)) champDynTexte_->ChangeValue(affiche(dynP_.val));
      const wxPoint q(p.x + FromDIP(14), p.y - FromDIP(14));
      if (champDyn_->GetPosition() != q) champDyn_->Move(q);
    }
  }
  if (champ != champDyn_->IsShown()) champDyn_->Show(champ);
}

// Le geste : une seule étape d'annulation, une seule application en attente
void Cadre::dynGeste(int phase, double v, bool libre) {
  if (phase == 0) {
    dynBase_ = annulations_.size();
    dynV0_ = dynP_.extrusion ? dynP_.fin : dynP_.val;
    dynSens_ = dynP_.extrusion && dynP_.fin < 0 ? -1 : 1;
    dynGesteEnCours_ = true;
    return;
  }
  if (phase == 2) {
    dynGesteEnCours_ = false;
    if (!dynAttente_) dynPCalculee_ = false;
    dynFinGeste_ = true;
    if (!dynAttente_) dynPosee_ = false;
    return;
  }
  dynV_ = v;
  dynLibre_ = libre;
  if (dynAttente_) return;
  dynAttente_ = true;
  CallAfter([this] { dynAppliquerGeste(); });
}

void Cadre::dynAppliquerGeste() {
  if (!dynAttente_) return;
  dynAttente_ = false;
  int i = -1;
  for (size_t k = 0; k < doc_.fonctions.size(); k++)
    if (doc_.fonctions[k].id == dynSel_) i = static_cast<int>(k);
  if (i < 0 || !dynP_.actif) return;
  dynOccupe_++;
  const PoigneeDyn P = dynP_;
  const double v = dynV_;
  const bool libre = dynLibre_;
  if (P.extrusion) {
    // extDragApply : pas de 1 mm (Maj : libre), l'autre côté du plan inverse le sens
    const Fonction& f = doc_.fonctions[i];
    const double t = dynV0_ + dynSens_ * v;
    double m = f.mid ? 2 * std::abs(t) : std::abs(t);
    m = libre ? std::round(m * 100) / 100 : std::round(m);
    if (!(m >= 0.1)) m = f.mid ? 2 : 1;
    Fonction essai = f;
    reglerProfondeur(essai, m);
    if (!essai.mid) {
      const double fin = essai.flip ? -essai.distance : essai.distance;
      if (fin * t < 0) essai.flip = !essai.flip;
    }
    if (essai.distance != f.distance || essai.flip != f.flip) {
      const double dist = essai.distance;
      const bool flip = essai.flip;
      modifierFonction(i, [dist, flip](Fonction& g) {
        g.distance = dist;
        g.aDistance = true;
        g.flip = flip;
      });
    }
  } else {
    double a = P.rot ? P.val : dynV0_ + v;
    if (P.rot) {
      a = dynV0_ + v;
      while (a <= 0) a += 360;
      while (a > 360) a -= 360;
    }
    const double pas = libre ? P.step / 10 : P.step;
    a = std::round(a / pas) * pas;
    a = std::min(P.maxi, std::max(P.mini, a));
    if (std::abs(a - P.val) >= 1e-9) dynPoser(a);
  }
  // Une seule étape d'annulation pour tout le geste
  while (annulations_.size() > dynBase_ + 1) annulations_.erase(annulations_.begin() + static_cast<std::ptrdiff_t>(dynBase_) + 1);
  dynOccupe_--;
  if (!dynGesteEnCours_) dynPosee_ = false;
  dynPCalculee_ = false;
  dynTick();
}

// Poser une valeur venue de la poignée ou du champ, hors extrusion
void Cadre::dynPoser(double a) {
  const std::string id = dynSel_;
  const std::string t = nombreTexte(a);
  if (dynP_.toutesAretes) {
    changerStructure([&](J& d) {
      for (const J& x : d["features"]) {
        if (x.value("id", std::string()) != id) continue;
        const size_t n = x.contains("edges") && x["edges"].is_array() ? x["edges"].size() : 0;
        for (size_t k = 0; k < n; k++) {
          const std::string refus = ficheAppliquer(d, id, "n/edges/" + std::to_string(k) + "/r", t);
          if (!refus.empty()) throw std::runtime_error(refus);
        }
        break;
      }
    });
    for (size_t k = 0; k < doc_.fonctions.size(); k++)
      if (doc_.fonctions[k].id == id) choisirFonction(static_cast<int>(k));
    return;
  }
  appliquerFiche(id, dynP_.cle, t);
}

void Cadre::dynSaisie(const wxString& texte) {
  if (dynSel_.empty() || !dynP_.actif) return;
  const std::string id = dynSel_, t(texte.utf8_str());
  const PoigneeDyn P = dynP_;
  if (!P.toutesAretes && ficheFormule(id, P.cle, t)) return;
  double v = 0;
  if (!lireNombre(texte, v) || v == 0) {
    etat(L"ƒx : saisissez un nombre ou une expression.");
    dynPCalculee_ = false;
    champDynTexte_->ChangeValue(affiche(P.val));
    return;
  }
  v = std::abs(v);
  if (P.extrusion) {
    for (size_t k = 0; k < doc_.fonctions.size(); k++)
      if (doc_.fonctions[k].id == id) modifierFonction(static_cast<int>(k), [v](Fonction& f) { reglerProfondeur(f, v); });
    return;
  }
  dynPoser(std::min(P.maxi, std::max(P.mini, v)));
}

// Après une annulation : la fenêtre reste ouverte tant que la fonction existe
void Cadre::dynRetrouver(const std::string& id) {
  if (id.empty() || dynSel_ == id) return;
  for (size_t k = 0; k < doc_.fonctions.size(); k++)
    if (doc_.fonctions[k].id == id) choisirFonction(static_cast<int>(k));
}

void Cadre::dynFermer() {
  dyn_.reset();
  dynSel_.clear();
  dynPCalculee_ = false;
  dynP_ = PoigneeDyn{};
  dynTick();
}

void Cadre::dynOk() {
  if (!dyn_) return;
  std::string nom = "Fonction", type;
  for (const Fonction& f : doc_.fonctions)
    if (f.id == dyn_->id) nom = f.nom, type = f.type;
  dynFermer();
  selectionVide();
  etat(type == "extrude" ? wxString(L"Extrusion validée.") : tx8(nom) + L" validée.");
}

void Cadre::dynAnnuler() {
  if (!dyn_) return;
  const SessionDyn E = *dyn_;
  std::string type;
  for (const Fonction& f : doc_.fonctions)
    if (f.id == E.id) type = f.type;
  dynFermer();
  if (E.neuf || annulations_.size() > E.annul) {
    annulations_.erase(annulations_.begin() + static_cast<std::ptrdiff_t>(std::min(E.annul, annulations_.size())), annulations_.end());
    retablissements_.clear();
    poserDocument(E.snap);
  } else {
    selectionVide();
  }
  dynSel_.clear();
  if (type == "extrude") etat(E.neuf ? L"Extrusion annulée." : L"Modifications annulées.");
  else etat(E.neuf ? L"Création annulée." : L"Modifications annulées.");
}

bool Cadre::dynEchap() {
  if (!dyn_ || dynSel_ != dyn_->id || atelier_ != Atelier::CAO || esquisseOuverte_ >= 0) return false;
  wxWindow* w = FindFocus();
  if (w == champDynTexte_) {
    vue_->SetFocus();
    dynPCalculee_ = false;
    return true;
  }
  if (dynamic_cast<wxTextCtrl*>(w) || dynamic_cast<wxChoice*>(w) || dynamic_cast<wxComboBox*>(w)) {
    vue_->SetFocus();  // premier Échap : on quitte la case (sa valeur d'avant revient), le second abandonne la fonction
    return true;
  }
  dynAnnuler();
  return true;
}

// Plot, Poche, Nouveau corps (extDynPanel) : le signe de la distance suit l'opération
void Cadre::dynOperation(const std::string& id, const std::string& op) {
  changerStructure([&](J& d) {
    for (J& g : d["features"]) {
      if (g.value("id", std::string()) != id) continue;
      const bool neuf = g.contains("newBody") && !g["newBody"].is_null() && g["newBody"] != false;
      if (op == "new") {
        if (!neuf) {
          g["_bodyPrev"] = g.contains("body") ? g["body"] : J();
          g["body"] = stCorpsSupplementaire(d);
          g["newBody"] = true;
        }
        g["op"] = "add";
      } else {
        if (neuf) {
          std::string prec = g.contains("_bodyPrev") && g["_bodyPrev"].is_string() ? g["_bodyPrev"].get<std::string>() : std::string();
          if (prec.empty() && d.contains("bodies") && d["bodies"].is_array() && !d["bodies"].empty()) prec = d["bodies"][0].value("id", std::string());
          g["body"] = prec;
          g.erase("_bodyPrev");
          g.erase("newBody");
        }
        g["op"] = op;
      }
      const bool upto = g.contains("upto") && !g["upto"].is_null();
      const bool through = g.value("through", false);
      if (!upto && !through) {
        const double v = g.contains("distance") && g["distance"].is_number() ? std::abs(g["distance"].get<double>()) : 0;
        g["distance"] = (v != 0 ? v : 20) * (g.value("op", std::string()) == "cut" ? -1 : 1);
      }
    }
  }, L"Ctrl+Z : annuler.");
  for (size_t q = 0; q < doc_.fonctions.size(); q++)
    if (doc_.fonctions[q].id == id) {
      doc_.fonctions[q].nom = nomExtrusion(doc_, doc_.fonctions[q]);
      choisirFonction(static_cast<int>(q));
    }
}

void Cadre::dynDepouille(const std::string& id, const wxString& texte) {
  const std::string t(texte.utf8_str());
  if (ficheFormule(id, "n/draft", t)) return;
  double v = 0;
  if (!lireNombre(texte, v)) return;
  if (std::abs(v) < 1e-9) v = 0;
  char b[64];
  snprintf(b, sizeof b, "%.3f", v);
  v = strtod(b, nullptr);
  changerStructure([&](J& d) {
    for (J& g : d["features"])
      if (g.value("id", std::string()) == id) g["draft"] = v;
  }, L"Ctrl+Z : annuler.");
  for (size_t q = 0; q < doc_.fonctions.size(); q++)
    if (doc_.fonctions[q].id == id) {
      doc_.fonctions[q].nom = nomExtrusion(doc_, doc_.fonctions[q]);
      choisirFonction(static_cast<int>(q));
    }
}

// {"dyn":{"lire":1}} {"dyn":{"tirer":12,"libre":false}} {"dyn":{"souris":[dx,dy]}} {"dyn":{"saisir":"35"}} {"dyn":{"ok":1}} {"dyn":{"annuler":1}} {"dyn":{"echap":1}} {"dyn":{"operation":"new"}} {"dyn":{"depouille":"3"}}
void Cadre::dynEssai(const nlohmann::json& e, nlohmann::json& n) {
  const auto rejouer = [&] {
    dynTick();
    if (dynAttente_) dynAppliquerGeste();
    dynTick();
  };
  rejouer();
  if (e.contains("tirer")) {
    dynGeste(0, 0, false);
    dynGeste(1, e["tirer"].get<double>(), e.value("libre", false));
    dynAppliquerGeste();
    dynGeste(2, 0, false);
    rejouer();
  }
  if (e.contains("souris")) {
    const wxPoint a = vue_->pointeGizmo(), dep = wxPoint(e["souris"][0].get<int>(), e["souris"][1].get<int>());
    const wxPoint o = vue_->ecranDe(gp_Pnt(dynP_.P));
    const wxPoint depart(o.x + (a.x - o.x) * 7 / 10, o.y + (a.y - o.y) * 7 / 10);
    n["saisie"] = vue_->essaiTirer(depart, depart + dep, e.value("libre", false));
    dynAppliquerGeste();
    rejouer();
  }
  if (e.contains("saisir")) {
    dynSaisie(tx8(e["saisir"].get<std::string>()));
    rejouer();
  }
  if (e.contains("operation") && !dynSel_.empty()) {
    dynOperation(std::string(dynSel_), e["operation"].get<std::string>());
    rejouer();
  }
  if (e.contains("depouille") && !dynSel_.empty()) {
    dynDepouille(std::string(dynSel_), tx8(e["depouille"].get<std::string>()));
    rejouer();
  }
  if (e.contains("bouton")) {
    const std::string q = e["bouton"].get<std::string>(), id = dynSel_;
    if (q == "cut" || q == "add" || q == "new") {
      const Fonction* g = doc_.fonction(id);
      if (q == "new" || (g && g->corpsPropre)) dynOperation(id, q);
      else dynRegler(id, [q](Fonction& x) { reglerOperation(x, q); });
    } else if (q == "one" || q == "mid") dynRegler(id, [q](Fonction& x) { x.mid = q == "mid"; });
    else if (q == "flip") dynRegler(id, [](Fonction& x) { x.flip = !x.flip; });
    else dynEtendue(id, q);
    rejouer();
  }
  n["hauteurSeg"] = hauteurSeg_;
  if (e.contains("ok")) dynOk();
  if (e.contains("annuler")) dynAnnuler();
  if (e.contains("echap")) n["echap"] = dynEchap();
  rejouer();
  n["session"] = static_cast<bool>(dyn_);
  n["neuf"] = dyn_ ? dyn_->neuf : false;
  n["sel"] = dynSel_;
  n["ok_montre"] = rangDynMontre_;
  n["poignee"] = dynP_.actif;
  n["pose"] = dynPosee_;
  n["rot"] = dynP_.rot;
  n["val"] = dynP_.val;
  n["label"] = std::string(dynP_.label.utf8_str());
  n["unite"] = std::string(dynP_.unite.utf8_str());
  n["champ"] = champDyn_->IsShown();
  n["pointe"] = {vue_->pointeGizmo().x, vue_->pointeGizmo().y, vue_->GetClientSize().x, vue_->GetClientSize().y};
  n["texte"] = std::string(champDynTexte_->GetValue().utf8_str());
  n["annulations"] = annulations_.size();
  n["etat"] = std::string(etatVue_->texte().utf8_str());
  n["nb"] = doc_.fonctions.size();
  n["forme"] = !forme_.IsNull();
  if (!dynSel_.empty())
    for (const Fonction& f : doc_.fonctions)
      if (f.id == dynSel_) {
        n["nom"] = f.nom;
        n["distance"] = f.distance;
        n["flip"] = f.flip;
        n["mid"] = f.mid;
        n["op"] = f.op;
        n["corps"] = f.corps;
        n["draft"] = f.draft;
      }
}
