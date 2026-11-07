#include "aide.h"
#include "journal.h"
#include "configurations.h"
#include "theme.h"
#include <wx/config.h>
#include "cadre.h"
#include "anteriorite.h"
#include "rendu_moteur.h"
#include "rendu_finition.h"
#include "rendu_atelier.h"
#include "fiche_vue.h"
#include <wx/stdpaths.h>
#include "plan_panneau.h"
#include "plan_vue.h"
#include "construction.h"

#include <BRepBndLib.hxx>
#include <Bnd_Box.hxx>

#include "parametres.h"

#include <wx/dcmemory.h>
#include <wx/file.h>
#include <wx/filedlg.h>
#include <wx/filename.h>
#include <wx/propgrid/advprops.h>

#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepGProp.hxx>
#include <BRep_Builder.hxx>
#include <TopoDS_Compound.hxx>
#include <GProp_GProps.hxx>
#include <Standard_Failure.hxx>
#include <TopExp.hxx>
#include <TopTools_IndexedMapOfShape.hxx>
#include <TopoDS.hxx>

#include <wx/imaglist.h>

#include <algorithm>
#include <chrono>
#include <cmath>

#include <fstream>
#include <nlohmann/json.hpp>

#include "fao_moteur.h"
#include "fao_vue.h"
#include "enregistrer.h"
#include "echanges.h"
#include "fiches.h"
#include "structure.h"
#include <wx/colordlg.h>
#include <wx/numdlg.h>
#include <wx/gauge.h>
#include <wx/textdlg.h>

#include "lien_arbre.h"
#include "assemblage_refs.h"

namespace {
enum { ID_ANNULER = wxID_HIGHEST + 1, ID_RETABLIR, ID_AJUSTER, ID_QUITTER_ESQUISSE, ID_ESQUISSE_XY, ID_ESQUISSE_XZ, ID_ESQUISSE_YZ, ID_ESQUISSE_FACE, ID_EXTRUDER, ID_CONTRAINTE_1, ID_ACCROCHE_GRILLE = wxID_HIGHEST + 100 };
// Identifiants fixes : natif/mesures/verifier-fenetre.ps1 retrouve ces fenêtres par eux.
enum { ID_ARBRE = 2001, ID_PROPS = 2002, ID_ETAT = 2003 };
const char* const PROP_CHAM_TYPE = "cham_type", * const PROP_CHAM_VALEUR = "cham_valeur", * const PROP_CHAM_FLIP = "cham_flip";
const char* const PROP_CONGE_RAYON = "conge_rayon", * const PROP_CONGE_TANGENTES = "conge_tangentes", * const PROP_CONGE_ARETE = "conge_arete_";
const char* const PROP_PROFONDEUR = "profondeur";

wxString memoireVue() { return wxStandardPaths::Get().GetUserConfigDir() + wxFileName::GetPathSeparator() + L"ConceptCADNatif-vue.json"; }
#define C_SCENE th(wxColour(0x13, 0x15, 0x19))
#define C_CARTE th(wxColour(0x2a, 0x2c, 0x30))
#define C_CLAIR th(wxColour(0xf5, 0xf5, 0xf7))
#define C_GRIS th(wxColour(0x98, 0x98, 0x9d))
wxFont policeArial(const wxWindow* w, double px, bool gras = false) {
  wxFontInfo i(wxSize(0, static_cast<int>(std::lround(px * w->GetDPIScaleFactor()))));
  i.FaceName("Arial");
  if (gras) i.Bold();
  return wxFont(i);
}
const wchar_t* const PAS_ENCORE = L" : pas encore dans le logiciel Windows";

double msDepuis(std::chrono::steady_clock::time_point t0) {
  return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
}
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
wxString nombre(double v) { return wxString::Format("%.3f", v); }

wxString nomType(const Fonction& f) {
  if (f.type == "extrude") return f.op == "cut" ? L"Découpe" : L"Extrusion";
  if (f.type == "repeat") return L"Répétition";
  if (f.type == "xfillet") return f.chamfer ? L"Chanfrein" : L"Congé";
  if (f.type == "xmove") return L"Déplacement de face";
  if (f.type == "xdraft") return L"Dépouillage";
  if (f.type == "xshell") return L"Coque";
  if (f.type == "xdelface") return L"Suppression de face";
  if (f.type == "xsplit") return L"Scission";
  if (f.type == "revolve") return f.op == "cut" ? L"Révolution (découpe)" : L"Révolution";
  if (f.type == "sweep") return f.op == "cut" ? L"Balayage (découpe)" : L"Balayage";
  if (f.type == "hole") return L"Perçage";
  if (f.type == "xthread") return L"Filetage";
  if (f.type == "gear") return L"Engrenage";
  if (f.type == "combine") return L"Combinaison de corps";
  if (f.type == "bmove") return L"Déplacement de corps";
  if (f.type == "bscale") return L"Échelle de corps";
  if (f.type == "bremove") return L"Retrait de corps";
  if (f.type == "import") return L"Pièce importée";
  return tx(f.type);
}
wxString nomSurface(const TopoDS_Face& f) {
  switch (BRepAdaptor_Surface(f).GetType()) {
    case GeomAbs_Plane: return L"Plane";
    case GeomAbs_Cylinder: return L"Cylindre";
    case GeomAbs_Cone: return L"Cône";
    case GeomAbs_Sphere: return L"Sphère";
    case GeomAbs_Torus: return L"Tore";
    default: return L"Surface libre";
  }
}
wxString nomCourbe(const TopoDS_Edge& e) {
  switch (BRepAdaptor_Curve(e).GetType()) {
    case GeomAbs_Line: return L"Droite";
    case GeomAbs_Circle: return L"Cercle ou arc";
    case GeomAbs_Ellipse: return L"Ellipse";
    default: return L"Courbe libre";
  }
}
wxPGProperty* lectureSeule(wxPropertyGrid* g, const wxString& nom, const wxString& valeur) {
  wxPGProperty* p = g->Append(new wxStringProperty(nom, wxPG_LABEL, valeur));
  p->ChangeFlag(wxPGFlags::ReadOnly, true);
  return p;
}
}  // namespace

Cadre::Cadre() : wxFrame(nullptr, wxID_ANY, L"ConceptCAD natif"), asmAnim_(this), minuterie_(this) {
  SetClientSize(FromDIP(wxSize(1500, 900)));
  SetMinClientSize(FromDIP(wxSize(1000, 600)));
  Move(FromDIP(wxPoint(20, 20)));
  creerMenus();
  // Les menus restent là pour les raccourcis clavier, mais l'écran est celui du navigateur, qui n'en a pas
  ::SetMenu(GetHWND(), nullptr);

  centre_ = new wxPanel(this);
  // La scène et la vue d'esquisse occupent la même place, l'une à la fois.
  scene_ = new wxPanel(centre_);
  scene_->SetBackgroundColour(C_SCENE);
  vue_ = new Vue3D(scene_);
  vueEsquisse_ = new VueEsquisse(centre_);
  vueEsquisse_->surQuitter = [this] { quitterEsquisse(); };
  vueEsquisse_->surDemandeCote = [this](const Cote& c, wxString& t) { return demandeCote(c, t); };
  vueEsquisse_->surSaisieCote = [this](const std::string& id, const wxString& t) { saisieCote(id, t); };
  vueEsquisse_->surNomCote = [this](const std::string& id, wxString& nom) { return nomCotePourSaisie(id, nom); };
  vueEsquisse_->surChampFormule = [this](wxTextCtrl* c) { brancherListeNoms(c, [this]() -> const Document& { return doc_; }); };
  barreEsquisse_ = new BarreEsquisse(centre_);
  panneauEsquisse_ = new PanneauEsquisse(centre_);
  bandeauEsquisse_ = new BandeauEsquisse(centre_);
  panneauEsquisse_->SetMinSize(wxSize(FromDIP(288) + wxSystemSettings::GetMetric(wxSYS_VSCROLL_X, this), -1));
  centre_->SetBackgroundColour(th(wxColour(0x1c, 0x1c, 0x1e)));
  barreHaute_ = new BarreHaute(centre_);
  ruban_ = new Ruban(centre_);
  carteDroite_ = new Carte(centre_, L"PARAMÈTRES", C_CARTE);
  carteDroite_->SetMinSize(FromDIP(wxSize(288, -1)));
  props_ = new wxPropertyGrid(carteDroite_, ID_PROPS, wxDefaultPosition, wxDefaultSize, wxPG_DEFAULT_STYLE | wxPG_HIDE_MARGIN | wxBORDER_NONE);
  props_->SetMinSize(wxSize(-1, 0));
  noteDroite_ = new wxStaticText(carteDroite_, wxID_ANY, wxEmptyString);
  carteDroite_->contenu()->Add(props_, 1, wxEXPAND);
  carteDroite_->contenu()->Add(noteDroite_, 0, wxEXPAND | wxLEFT | wxRIGHT, FromDIP(5));
  // Appliquer et Quitter du mode Congé
  rangConge_ = new wxBoxSizer(wxHORIZONTAL);
  {
    auto* ok = new BoutonEsquisse(carteDroite_, wxID_ANY, L"Appliquer", L"Créer la fonction", BoutonEsquisse::PRINCIPAL);
    auto* q = new BoutonEsquisse(carteDroite_, wxID_ANY, L"Quitter", L"Quitter sans rien créer (Échap)", BoutonEsquisse::ENCADRE);
    for (BoutonEsquisse* b : {ok, q}) {
      b->SetMinSize(FromDIP(wxSize(-1, 30)));
      b->fond(C_CARTE);
    }
    ok->titre(L"Appliquer");
    q->titre(L"Quitter");
    boutonOkChoix_ = ok;
    ok->surClic = [this] { appliquerChoixConge(); };
    q->surClic = [this] { quitterConge(); };
    rangConge_->Add(ok, 1, wxEXPAND | wxRIGHT, FromDIP(6));
    rangConge_->Add(q, 1, wxEXPAND);
  }
  carteDroite_->contenu()->Add(rangConge_, 0, wxEXPAND | wxTOP, FromDIP(12));
  carteDroite_->contenu()->Show(rangConge_, false);
  rangAsm_ = new wxBoxSizer(wxVERTICAL);
  carteDroite_->contenu()->Add(rangAsm_, 0, wxEXPAND | wxTOP, FromDIP(6));
  carteDroite_->contenu()->Show(rangAsm_, false);
  dynCreer();
  auto* colonne = new wxBoxSizer(wxVERTICAL);
  colonne->Add(scene_, 1, wxEXPAND);
  colonne->Add(vueEsquisse_, 1, wxEXPAND);
  colonne->Add(bandeauEsquisse_, 0, wxEXPAND);
  auto* rangee = new wxBoxSizer(wxHORIZONTAL);
  margeColonne_ = rangee->Add(colonne, 1, wxEXPAND | wxLEFT | wxBOTTOM, FromDIP(12));
  colonneDroite_ = new wxBoxSizer(wxVERTICAL);
  colonneDroite_->Add(carteDroite_, 0, wxEXPAND);
  colonneDroite_->AddStretchSpacer(1);
  rangee->Add(colonneDroite_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(12));
  margePanneau_ = rangee->Add(panneauEsquisse_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, FromDIP(12));
  miniParams_ = new MiniParametres(centre_, actionsFormules());
  miniParams_->surFermer = [this] { basculerMiniParametres(); };
  miniParams_->surListeComplete = [this] { ouvrirFenetreParametres(this, actionsFormules()); };
  miniParams_->Hide();
  rangee->Add(miniParams_, 0, wxEXPAND | wxRIGHT | wxBOTTOM, FromDIP(12));
  auto* tout = new wxBoxSizer(wxVERTICAL);
  tout->Add(barreHaute_, 0, wxEXPAND);
  tout->Add(ruban_, 0, wxEXPAND);
  tout->Add(barreEsquisse_, 0, wxEXPAND);
  tout->AddSpacer(FromDIP(3));
  tout->Add(rangee, 1, wxEXPAND);
  centre_->SetSizer(tout);
  auto* cadreSizer = new wxBoxSizer(wxVERTICAL);
  cadreSizer->Add(centre_, 1, wxEXPAND);
  SetSizer(cadreSizer);
  creerEnvironnement();
  vueEsquisse_->Hide();
  barreEsquisse_->Hide();
  panneauEsquisse_->Hide();
  bandeauEsquisse_->Hide();
  barreEsquisse_->surOutil = [this](Dessin::Outil o) {
    vueEsquisse_->commande([o](Dessin& d) { d.choisirOutil(o); });
    vueEsquisse_->SetFocus();
  };
  barreEsquisse_->surContrainte = [this](const std::string& type) {
    vueEsquisse_->commande([&type](Dessin& d) { d.poserContrainte(type); });
    vueEsquisse_->SetFocus();
  };
  barreEsquisse_->surIndisponible = [this](const wxString& nom) {
    messageBandeau(nom + L" : pas encore dans le logiciel Windows.");
    vueEsquisse_->SetFocus();
  };
  barreEsquisse_->surParametres = [this] { basculerMiniParametres(); };
  barreEsquisse_->surParametresComplets = [this] { ouvrirFenetreParametres(this, actionsFormules()); };
  barreEsquisse_->surCadrer = [this] {
    vueEsquisse_->ajuster();
    vueEsquisse_->SetFocus();
  };
  barreEsquisse_->surGrille = [this] {
    vueEsquisse_->basculerGrille();
    barreEsquisse_->grilleActive(vueEsquisse_->grilleVisible());
    vueEsquisse_->SetFocus();
  };
  barreEsquisse_->surGrilleMenu = [this] { menuGrille(); };
  barreEsquisse_->surVueInclinee = [this] {
    vueEsquisse_->basculerVueInclinee();
    vueEsquisse_->SetFocus();
  };
  vueEsquisse_->surVueChange = [this] { barreEsquisse_->vueInclineeActive(!vueEsquisse_->vueAPlat()); };
  barreEsquisse_->surFantome = [this] {
    vueEsquisse_->basculerFantome();
    barreEsquisse_->fantomeActif(vueEsquisse_->fantomeVisible());
    vueEsquisse_->SetFocus();
  };
  // Depuis un bouton qui disparaît avec l'écran : la sortie attend la fin du clic
  barreEsquisse_->surAbandon = [this] { CallAfter([this] { abandonnerEsquisse(); }); };
  barreEsquisse_->surTerminer = [this] { CallAfter([this] { quitterEsquisse(); }); };
  barreEsquisse_->surEffacerTout = [this] {
    if (!essaiSansBoite_) {
      wxMessageDialog q(this, L"Tout effacer ?", L"ConceptCAD natif", wxYES_NO | wxNO_DEFAULT | wxICON_WARNING);
      q.SetYesNoLabels(L"Effacer", L"Garder");
      if (q.ShowModal() != wxID_YES) return;
    }
    vueEsquisse_->commande([](Dessin& d) { d.effacerTout(); });
    vueEsquisse_->SetFocus();
  };
  panneauEsquisse_->faire = [this](const std::function<void(Dessin&)>& f) {
    vueEsquisse_->commande(f);
    vueEsquisse_->SetFocus();
  };
  panneauEsquisse_->surOuvrirCote = [this](const std::string& id) { vueEsquisse_->ouvrirCoteParId(id); };
  panneauEsquisse_->surVoir = [this](double x, double y) { vueEsquisse_->centrerSur(x, y); };
  vueEsquisse_->surGeste = [this] { rafraichirEsquisse(false); };
  vue_->surDroit = [this](const TopoDS_Shape& s) { surDroit3D(s); };
  vue_->surAltDouble = [this](const TopoDS_Shape& sous) {
    if (enChoix() || esquisseOuverte_ >= 0 || !docOuvert_ || sous.IsNull()) return;
    for (const auto& [id, s] : formesCorps_) {
      TopTools_IndexedMapOfShape carte;
      TopExp::MapShapes(s, sous.ShapeType(), carte);
      if (!carte.Contains(sous)) continue;
      std::vector<std::string> autres;
      for (const std::string& c : doc_.corps)
        if (c != id) autres.push_back(c);
      changerStructure([&](nlohmann::ordered_json& d) { stCorpsMasques(d, autres); });
      return;
    }
  };
  journal::surErreur = [this] { CallAfter([this] { etat(L"⚠ Une erreur interne a été notée dans le journal (bouton Aide)."); }); };
  vue_->surOccurrence = [this](const std::string& cle, bool ctrl, bool maj) { asmCliqueOcc(cle, ctrl, maj); };
  vue_->surOccDouble = [this](const std::string& cle) {
    if (cle.empty() || !doc_.assemblage) return;
    assemblage::Chemin P = assemblage::cheminActif(*doc_.assemblage);
    P.push_back(cle);
    CallAfter([this, P] { asmAller(P, "part"); });
  };
  vue_->surOccDroit = [this](const std::string& cle) {
    if (cle.empty() || !doc_.assemblage) return;
    assemblage::Chemin P = assemblage::cheminActif(*doc_.assemblage);
    P.push_back(cle);
    asmMenuOccurrence(P, cle, true);
  };
  vue_->surGeste = [this](int phase, const std::string& sorte, int axe, const std::string& degre, double valeur, bool libre) {
    if (dynPosee_) return dynGeste(phase, valeur, libre);
    asmGeste(phase, sorte, axe, degre, valeur, libre);
  };
  vue_->surMarque = [this](int i) { asmAlignClicMarque(i); };
  vue_->surRayon = [this](const gp_Pnt& o, const gp_Dir& d) { return asmNormRayon(o, d) || cgPiocheAutre(o, d); };
  vue_->surMesure = [this](const Vue3D::CoupVue* c, bool ctrl, bool maj) { mesureCoup(c, ctrl, maj); };
  vue_->surFaceOcc = [this](const assemblage::Chemin& c, const gp_Pnt& p, bool plan, const assemblage::V3& n) { asmAlignClicFace(c, p, plan, n); };
  Bind(wxEVT_TIMER, [this](wxTimerEvent&) { asmPasAnimation(); }, asmAnim_.GetId());
  vue_->surSelection = [this](const TopoDS_Shape& s) {
    if (pioche_) {
      const auto p = pioche_;
      pioche_ = nullptr;
      if (!p(s)) pioche_ = p;
    } else if (faces_) cliqueFaces(s);
    else if (choix_) cliqueConge(s);
    else montrerForme(s);
  };
  Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& e) {
    if (film_) {  // aucun raccourci de l'application pendant le film
      if (e.GetKeyCode() == WXK_ESCAPE) filmStop();
      else if (e.GetKeyCode() == WXK_SPACE) filmPause();
      return;
    }
    if (e.ControlDown() && !e.ShiftDown() && e.GetKeyCode() == 'K') {
      barreHaute_->champRecherche()->SetFocus();
      barreHaute_->champRecherche()->SelectAll();
      return;
    }
    {
      // Le caractère tapé, selon le clavier : « ? » est Maj + virgule sur un clavier français
      wchar_t car = 0;
      if (e.ShiftDown() && !e.ControlDown() && !e.AltDown()) {
        BYTE touches[256] = {};
        wchar_t b[4] = {};
        if (GetKeyboardState(touches) && ToUnicode(e.GetRawKeyCode(), MapVirtualKeyW(e.GetRawKeyCode(), MAPVK_VK_TO_VSC), touches, b, 4, 4) == 1) car = b[0];
      }
      if (raccourciGlobal(e.GetKeyCode(), car, e.ControlDown(), e.AltDown(), e.ShiftDown(), (e.GetRawKeyFlags() & (1u << 30)) != 0)) return;
    }
    // La FAO garde ses raccourcis, sauf quand on tape dans un champ
    if (atelier_ == Atelier::FAO && !dynamic_cast<wxTextCtrl*>(FindFocus())) {
      const int k = e.GetKeyCode();
      const bool c = e.ControlDown();
      std::string cle;
      if (k == WXK_ESCAPE) cle = "Escape";
      else if (k == WXK_DELETE) cle = "Delete";
      else if (k == WXK_RETURN || k == WXK_NUMPAD_ENTER) cle = "Enter";
      else if (c && (k == 'C' || k == 'V' || k == 'Z' || k == 'Y')) cle = std::string(1, static_cast<char>(k + 32));
      if (!cle.empty()) return faoTouche(cle, c, e.ShiftDown());
    }
    if (atelier_ == Atelier::RENDU && e.GetKeyCode() == WXK_ESCAPE) return changerAtelier(avantRendu_);
    if (pioche_ && e.GetKeyCode() == WXK_ESCAPE) {
      pioche_ = nullptr;
      if (piocheAnnulee_) {
        const auto a = piocheAnnulee_;
        piocheAnnulee_ = nullptr;
        a();
        return;
      }
      etat(L"Choix dans la vue annulé.");
    } else if (enChoix() && e.GetKeyCode() == WXK_ESCAPE) quitterConge();
    else if (e.GetKeyCode() == WXK_ESCAPE && dynEchap()) return;
    else if (e.GetKeyCode() == WXK_ESCAPE && esquisseOuverte_ < 0 && asmEchap()) return;
    else if (e.GetKeyCode() == WXK_ESCAPE && esquisseOuverte_ < 0 && lotVider()) return;
    else if (e.GetKeyCode() == WXK_DELETE && asmMode_ == "asm" && !asmSel_.empty() && esquisseOuverte_ < 0 && (FindFocus() == vue_ || FindFocus() == arbre_)) asmSupprimer(asmLot());
    else if (faces_ && (e.GetKeyCode() == WXK_RETURN || e.GetKeyCode() == WXK_NUMPAD_ENTER) && FindFocus() == vue_) appliquerChoixFaces();
    else if (e.GetKeyCode() == WXK_DELETE && FindFocus() == vue_ && supprimerFacesChoisies()) return;
    else if (e.GetKeyCode() == WXK_DELETE && esquisseOuverte_ < 0 && !enChoix() && (FindFocus() == arbre_ || (FindFocus() == vue_ && !lotArbre_.empty())) && lotSupprimer()) return;
    else e.Skip();
  });

  etat(L"Noyau OCCT 8.0.1 · exact   Aucune pièce ouverte : Ouvrir (Ctrl+O). Clic gauche : tourner ou choisir. Clic droit : déplacer. Molette : zoom.");

  arbre_->Bind(wxEVT_TREE_SEL_CHANGED, &Cadre::surArbre, this);
  arbre_->Bind(wxEVT_TREE_ITEM_ACTIVATED, &Cadre::surArbreActive, this);
  arbre_->Bind(wxEVT_TREE_ITEM_MENU, &Cadre::surArbreMenu, this);
  arbre_->Bind(wxEVT_TREE_BEGIN_DRAG, [this](wxTreeEvent& e) {
    const auto* l = dynamic_cast<LienArbre*>(arbre_->GetItemData(e.GetItem()));
    if (!l || !l->estFonction || l->i < 0 || enChoix() || esquisseOuverte_ >= 0 || !doc_.fonctions[l->i].repeatId.empty()) return;
    tireeArbre_ = doc_.fonctions[l->i].id;
    e.Allow();
  });
  arbre_->Bind(wxEVT_TREE_END_DRAG, [this](wxTreeEvent& e) {
    const std::string id = tireeArbre_;
    tireeArbre_.clear();
    if (id.empty() || !e.GetItem().IsOk()) return;
    const auto* l = dynamic_cast<LienArbre*>(arbre_->GetItemData(e.GetItem()));
    if (!l) return;
    if (l->estFonction && l->i >= 0) {
      const std::string cible = doc_.fonctions[l->i].id;
      if (cible != id) CallAfter([this, id, cible] { changerStructure([&](nlohmann::ordered_json& d) { anteriorite::deplacerSur(d, id, cible); }, L"Ctrl+Z : annuler."); });
    } else if (!l->corps.empty()) {
      const std::string corps = l->corps;
      CallAfter([this, id, corps] { fonctionVersCorps(id, corps); });
    }
  });
  arbre_->Bind(wxEVT_TREE_ITEM_GETTOOLTIP, [this](wxTreeEvent& e) {
    const auto* l = e.GetItem().IsOk() ? dynamic_cast<LienArbre*>(arbre_->GetItemData(e.GetItem())) : nullptr;
    if (l && l->estFonction && l->i >= 0 && l->i < static_cast<int>(doc_.fonctions.size())) {
      const auto a = antAvert_.find(doc_.fonctions[l->i].id);
      if (a != antAvert_.end()) e.SetToolTip(tx(a->second));
    }
  });
  props_->Bind(wxEVT_PG_CHANGED, &Cadre::surPropriete, this);
  Bind(wxEVT_TIMER, &Cadre::pasProtocole, this, minuterie_.GetId());
  Bind(wxEVT_IDLE, [this](wxIdleEvent& e) {
    barreHaute_->etats(atelier_ == Atelier::FAO || !annulations_.empty(), atelier_ == Atelier::FAO || !retablissements_.empty(), docOuvert_ && doc_.modifie(), docOuvert_);
    dynTick();
    ajusterDroite();
    majZones();
    e.Skip();
  });
  montrerRien();
  changerAtelier(Atelier::CAO);
}

// L'environnement du navigateur, recopié élément par élément. Ce qui n'est pas encore repris est là, grisé, et le dit.
void Cadre::creerEnvironnement() {
  barreHaute_->surAtelier = [this](Atelier a) { changerAtelier(a); };
  vue_->surClicFao = [this](const Vue3D::ClicFao& c) { return faoClic(c); };
  vue_->surZone = [this](const wxPoint& p, bool clic) { return zoneSousSouris(p, clic); };
  barreHaute_->surAnnuler = [this] { annuler(); };
  barreHaute_->surRetablir = [this] { retablir(); };
  barreHaute_->surOuvrir = [this] {
    wxCommandEvent e;
    surOuvrir(e);
  };
  barreHaute_->surNouveau = [this] { nouveau(); };
  barreHaute_->surRecent = [this] { menuRecents(); };
  barreHaute_->surEnregistrer = [this] { enregistrer(); };
  barreHaute_->surEnregistrerSous = [this] { enregistrerSous(); };
  barreHaute_->surDossier = [this] { panneauDossier(); };
  barreHaute_->surTheme = [this] { menuTheme(); };
  barreHaute_->surAide = [this] { ouvrirAide(this); };
  barreHaute_->surRegenerer = [this] {
    quitterConge();
    if (esquisseOuverte_ < 0) recalculer();
  };
  barreHaute_->surIndisponible = [this](const wxString& n) { indisponible(n); };
  ruban_->estRepris = [this](Atelier a, const wxString& n) { if (a == Atelier::PLAN) return planVue_->estRepris(n); if (a == Atelier::FAO) return true; return a == Atelier::CAO && (n == L"Esquisse" || n == L"Extrusion" || n == L"Congé" || n == L"Chanfrein" || n == L"Paramètres" || n == L"Corps" || n == L"Perçage" || n == L"Filetage" || n == L"Clavette" || n == L"Plan" || n == L"Axe" || n == L"Point" || n == L"Repère" || n == L"Répétition" || n == L"Révolution" || n == L"Balayage" || n == L"Face" || n == L"Dépouille" || n == L"Coque" || n == L"Combiner" || n == L"Déplacer" || n == L"Échelle" || n == L"Scinder" || n == L"Importer" || n == L"Dériver" || n == L"STEP" || n == L"STL" || n == L"OBJ" || n == L"Assembler" || n == L"Modéliser" || n == L"Composant" || n == L"Occurrence" || n == L"Insérer" || n == L"Inspecter" || n == L"Normalisés" || n == L"Aimants" || n == L"Depuis corps"); };
  ruban_->surBouton = [this](Atelier a, const wxString& n) { boutonRuban(a, n); };
  ruban_->surIndisponible = [this](const wxString& n) { indisponible(n); };

  // Les onglets au-dessus de l'arbre
  const wchar_t* const nomsOnglets[] = {L"Modèle", L"Usinage", L"Plan"};
  const Atelier ateliersOnglets[] = {Atelier::CAO, Atelier::FAO, Atelier::PLAN};
  for (int i = 0; i < 3; i++) {
    auto* b = new BoutonEsquisse(scene_, wxID_ANY, nomsOnglets[i], wxEmptyString, BoutonEsquisse::PASTILLE);
    b->titre(nomsOnglets[i]);
    b->fond(C_SCENE);
    const Atelier a = ateliersOnglets[i];
    b->surClic = [this, a] { changerAtelier(a); };
    onglets_.push_back(b);
  }
  repliArbre_ = new BoutonEsquisse(scene_, wxID_ANY, L"Replier l'arbre", L"Replier ou déplier l'arborescence", BoutonEsquisse::TEXTE);
  repliArbre_->titre(L"‹");
  repliArbre_->fond(C_SCENE);
  repliArbre_->surClic = [this] {
    arbreReplie_ = !arbreReplie_;
    repliArbre_->titre(arbreReplie_ ? L"›" : L"‹");
    placerScene();
  };

  // L'arbre flottant
  carteArbre_ = new Carte(scene_, L"Arborescence", C_CARTE, true);
  rechercheArbre_ = new wxTextCtrl(carteArbre_, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxBORDER_NONE);
  rechercheArbre_->SetBackgroundColour(th(wxColour(0x33, 0x35, 0x39)));
  rechercheArbre_->SetForegroundColour(C_CLAIR);
  rechercheArbre_->SetFont(policeArial(this, 12.5));
  rechercheArbre_->SetHint(L"Rechercher dans l'arbre (nom, type…)");
  arbre_ = new wxTreeCtrl(carteArbre_, ID_ARBRE, wxDefaultPosition, wxDefaultSize, wxTR_HAS_BUTTONS | wxTR_NO_LINES | wxTR_HIDE_ROOT | wxTR_SINGLE | wxTR_FULL_ROW_HIGHLIGHT | wxBORDER_NONE);
  ::SendMessageW(arbre_->GetHWND(), 0x111B /* TVM_SETITEMHEIGHT */, FromDIP(23), 0);
  {
    // Les petites images de l'arbre : celles du ruban, et les couleurs des plans et des axes
    const int cote = FromDIP(16);
    auto* images = new wxImageList(cote, cote, true);
    const auto ajouter = [&](const std::string& svg, const wxColour& c) { images->Add(iconeSvgComplete(svg, c, 16).GetBitmap(wxSize(cote, cote))); };
    const auto point = [&](const wxColour& c) { ajouter("<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"6\" fill=\"currentColor\"/></svg>", c); };
    const auto trait = [&](const wxColour& c) { ajouter("<svg viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"10\" width=\"18\" height=\"4\" rx=\"1\" fill=\"currentColor\"/></svg>", c); };
    ajouter(iconeRubanCao(0), th(wxColour(0xff, 0x9f, 0x0a)));  // 0 esquisse
    ajouter(iconeRubanCao(1), th(wxColour(0x30, 0xd1, 0x58)));  // 1 extrusion
    ajouter(iconeRubanCao(1), th(wxColour(0xff, 0x45, 0x3a)));  // 2 découpe
    ajouter(iconeRubanCao(6), th(wxColour(0x0a, 0x84, 0xff)));  // 3 corps
    point(th(wxColour(0x40, 0x62, 0x8c)));  // 4 plan XY
    point(th(wxColour(0x3c, 0x84, 0x55)));  // 5 plan XZ
    point(th(wxColour(0x9c, 0x6c, 0x28)));  // 6 plan YZ
    point(th(wxColour(0x70, 0x70, 0x75)));  // 7 repère
    trait(th(wxColour(0xff, 0x6b, 0x6b)));  // 8 axe X
    trait(th(wxColour(0x5e, 0xdc, 0x7a)));  // 9 axe Y
    trait(th(wxColour(0x4d, 0xa3, 0xff)));  // 10 axe Z
    ajouter(iconeRubanCao(8), C_GRIS);  // 11 origine
    const char* const cube = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 8l8-4 8 4v8l-8 4-8-4z\"/><path d=\"M4 8l8 4 8-4M12 12v8\"/></svg>";
    ajouter(cube, th(wxColour(0xc8, 0xa8, 0x6a)));  // 12 occurrence
    ajouter(cube, th(wxColour(0x0a, 0x84, 0xff)));  // 13 composant actif
    ajouter("<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 3v4M12 17v4M3 12h4M17 12h4\"/></svg>", th(wxColour(0x98, 0x98, 0x9d)));  // 14 liaison
    ajouter("<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><rect x=\"3\" y=\"3\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"15\" y=\"3\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"3\" y=\"15\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"15\" y=\"15\" width=\"6\" height=\"6\" rx=\"1\"/></svg>", th(wxColour(0x98, 0x98, 0x9d)));  // 15 répétition
    arbre_->AssignImageList(images);
    // L'œil de chaque ligne : ouvert, barré
    auto* etats = new wxImageList(cote, cote, true);
    etats->Add(iconeSvgComplete("<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>", th(wxColour(0xa0, 0xa0, 0xa8)), 16).GetBitmap(wxSize(cote, cote)));
    etats->Add(iconeSvgComplete("<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M3 3l18 18\"/></svg>", th(wxColour(0x5a, 0x5a, 0x62)), 16).GetBitmap(wxSize(cote, cote)));
    arbre_->AssignStateImageList(etats);
    arbre_->Bind(wxEVT_TREE_STATE_IMAGE_CLICK, [this](wxTreeEvent& e) { oeilArbre(e.GetItem()); });
  }
  arbre_->SetBackgroundColour(C_CARTE);
  arbre_->SetForegroundColour(C_CLAIR);
  arbre_->SetFont(policeArial(this, 12.5));
  auto* aide = new wxStaticText(carteArbre_, wxID_ANY, L"Double-clic sur un plan ou une esquisse : dessiner");
  aide->SetForegroundColour(C_GRIS);
  aide->SetFont(policeArial(this, 11));
  carteArbre_->contenu()->Add(rechercheArbre_, 0, wxEXPAND | wxBOTTOM, FromDIP(6));
  rechercheInit();
  ligneConfig_ = new wxBoxSizer(wxHORIZONTAL);
  auto* etiquetteConfig = new wxStaticText(carteArbre_, wxID_ANY, L"⚙ Configuration");
  etiquetteConfig->SetForegroundColour(C_CLAIR);
  choixConfig_ = new wxChoice(carteArbre_, wxID_ANY);
  ligneConfig_->Add(etiquetteConfig, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, FromDIP(6));
  ligneConfig_->Add(choixConfig_, 1, wxALIGN_CENTER_VERTICAL);
  carteArbre_->contenu()->Add(ligneConfig_, 0, wxEXPAND | wxBOTTOM, FromDIP(6));
  carteArbre_->contenu()->Show(ligneConfig_, false);
  choixConfig_->Bind(wxEVT_CHOICE, [this](wxCommandEvent& e) {
    const nlohmann::ordered_json* t = cfgDe(doc_);
    if (!t) return;
    const int k = e.GetSelection() - ((*t)["active"].is_string() ? 0 : 1);
    if (k < 0 || k >= static_cast<int>((*t)["rows"].size())) return;
    const std::string id = (*t)["rows"][static_cast<size_t>(k)]["id"].get<std::string>();
    const std::string m = configurer(nullptr, id);
    if (!m.empty()) {
      etat(L"⚠ " + tx(m));
      majChoixConfig();
    }
  });
  carteArbre_->contenu()->Add(arbre_, 1, wxEXPAND);
  carteArbre_->contenu()->Add(aide, 0, wxEXPAND | wxTOP, FromDIP(6));

  // Les posages de l'atelier FAO
  carteFao_ = new Carte(scene_, L"FAO · POSAGES", C_CARTE, true);
  arbreFao_ = new VueDom(carteFao_, C_CARTE);
  arbreFao_->surToucher = [this](long el, const std::string& s, const plan::J& v, bool c, bool m) { faoToucher(el, s, v, c, m); };
  carteFao_->contenu()->Add(arbreFao_, 1, wxEXPAND);
  // Mise à part du titre, sur une seule ligne : le texte remonte
  carteFao_->GetSizer()->GetItem(size_t(0))->AssignSpacer(1, FromDIP(30));

  // Les boutons de la vue
  const struct {
    const wchar_t* nom;
    const char* icone;
  } vueIcones[] = {{L"Rendu", nullptr}, {L"Rendu direct", nullptr}, {L"Réglages de la vue", nullptr}, {L"Vue initiale", "cadrer"}, {L"Mode d'orbite", "orbite"}};
  for (const auto& v : vueIcones) {
    auto* b = new BoutonEsquisse(scene_, wxID_ANY, v.nom, wxString(v.nom) + (wxString(v.nom).StartsWith(L"Annuler") ? PAS_ENCORE : L""), BoutonEsquisse::ENCADRE);
    b->fond(C_SCENE);
    if (v.icone) b->icone(v.icone, C_CLAIR);
    boutonsVue_.push_back(b);
  }
  boutonsVue_[0]->iconeComplete(iconeVue(0), C_CLAIR);
  boutonsVue_[1]->iconeComplete(iconeVue(1), C_CLAIR);
  boutonsVue_[2]->titre(L"⚙");
  const auto majOrbite = [this] {
    boutonsVue_[4]->actif(optionsVue_.orbiteLibre);
    boutonsVue_[4]->SetToolTip(optionsVue_.orbiteLibre ? L"Orbite LIBRE : la pièce tourne dans tous les sens — cliquer pour l'orbite contrainte (Z en haut)" : L"Orbite contrainte : Z reste en haut — cliquer pour l'orbite libre (tour complet)");
  };
  boutonsVue_[4]->surClic = [this, majOrbite] {
    optionsVue_.orbiteLibre = !optionsVue_.orbiteLibre;
    majOrbite();
    majVueEnv();
    memoriserVue();
  };
  CallAfter(majOrbite);
  if (theme::iconesCouleur()) CallAfter([this] { ruban_->couleursFamilles(); });
  boutonsVue_[3]->surClic = [this] { vue_->vueInitiale(); };
  boutonsVue_[0]->surClic = [this] { changerAtelier(Atelier::RENDU); };
  boutonsVue_[1]->SetToolTip(L"Rendu direct : la vue rendue comme dans l'atelier RENDU (lumière, reflets, fond, matériaux de chaque pièce). Fond et ambiance se règlent dans la fenêtre RENDU.");
  boutonsVue_[1]->surClic = [this] {
    optionsVue_.env = optionsVue_.env == "actuel" ? "rendu" : "actuel";
    envModifie_ = true;
    majVueEnv();
    memoriserVue();
    if (ficheVue_->IsShown()) ficheVue_->refaire();
  };
  boutonsVue_[2]->surClic = [this] { basculerFicheVue(); };
  ficheVue_ = new FicheVue(scene_, vue_);
  ficheVue_->Show(false);
  ficheVue_->o = &optionsVue_;
  ficheVue_->surChange = [this] {
    envModifie_ = true;
    majVueEnv();
  };
  ficheVue_->surFin = [this] { memoriserVue(); };
  {
    bool essai = false;
    for (int i = 1; i < wxTheApp->argc; i++) essai = essai || wxString(wxTheApp->argv[i]).StartsWith(L"--");
    std::ifstream f(memoireVue().ToStdWstring());
    if (f && !essai) {
      try {
        std::stringstream t;
        t << f.rdbuf();
        const plan::J j = plan::J::parse(t.str());
        OptionsVue& o = optionsVue_;
        o.env = j.value("env", o.env);
        o.sol = j.value("sol", o.sol);
        o.miroir = j.value("miroir", o.miroir);
        o.ombre = j.value("ombre", o.ombre);
        o.aretes = j.value("aretes", o.aretes);
        o.axes = j.value("axes", o.axes);
        o.zoomInverse = j.value("zoomInv", o.zoomInverse);
        o.orbiteLibre = j.value("libre", o.orbiteLibre);
        o.fov = j.value("fov", o.fov);
      } catch (const std::exception&) {
      }
    }
  }

  etatVue_ = new EtatVue(scene_, ID_ETAT, C_SCENE);
  fil_ = new FilFonctions(scene_);
  fil_->surIndisponible = [this](const wxString& n) { indisponible(n); };
  fil_->surClic = [this](const FilFonctions::Element& e) {
    if (e.estFonction) choisirFonction(e.i);
    else if (!e.cg.empty()) {
      const auto l = lignesConstruction_.find(e.cg);
      if (l != lignesConstruction_.end() && l->second.IsOk()) arbre_->SelectItem(l->second);
    } else if (e.i < static_cast<int>(lignesEsquisses_.size()) && lignesEsquisses_[e.i].IsOk()) arbre_->SelectItem(lignesEsquisses_[e.i]);
  };
  fil_->surDouble = [this](const FilFonctions::Element& e) {
    // tlbDbl : chaque ligne s'ouvre comme dans l'arbre
    if (esquisseOuverte_ >= 0 || enChoix()) return;
    if (!e.cg.empty()) choisirConstruction(e.cg);
    else if (!e.estFonction) entrerEsquisse(e.i);
    else if (e.i >= 0 && e.i < static_cast<int>(doc_.fonctions.size()) && fonctionDeFaces(doc_.fonctions[e.i])) entrerFaces(sorteDeFaces(doc_.fonctions[e.i]), doc_.fonctions[e.i].id);
  };
  fil_->surDroit = [this](const FilFonctions::Element& e) {
    if (esquisseOuverte_ >= 0 || enChoix()) return;
    if (e.estFonction) menuFonction(e.i);
    else if (!e.cg.empty()) menuConstruction(e.cg);
    else menuEsquisseArbre(e.i);
  };
  fil_->surMarqueur = [this](int b) { bougerMarqueur(b); };
  fil_->surDepot = [this](const std::vector<FilFonctions::Element>& L, int source, int gap) {
    if (esquisseOuverte_ >= 0 || enChoix()) return;
    deposerDansFil(L, source, gap);
  };
  fil_->surFilm = [this] { filmLancer(); };
  page_ = new PageAtelier(scene_);
  planVue_ = new PlanVue(scene_);
  planVue_->Hide();
  planVue_->rendreImage = [this](const plan::DemandeImage& d, wxImage& im) {
    if (!d.reel) return vue_->imagePlan(d, im);
    OptionsVue o = optionsVue_;
    const std::string avant = o.env;
    optionsVue_.env = "rendu";
    ambianceVue();
    o = optionsVue_;
    optionsVue_.env = avant;
    ambianceVue();
    plan::J racine;
    renduDocCourant(racine);
    std::vector<ApparenceVue> L;
    for (const PieceRendu& p : renduPieces(racine)) L.push_back({p.forme, p.cle, p.couleur});
    return vue_->imagePlan(d, im, &o, &L);
  };
  planVue_->surChangement = [this](const plan::J& mep, const wxString&) { changerPlan(mep); };
  planVue_->surEtat = [this](const wxString& t) { etat(t); };
  planVue_->surVuesAutomatiques = [this](const plan::J& mep) { modifierStructure(doc_, [&](nlohmann::ordered_json& d) { d["mep"] = mep; }); };
  planVue_->directionCamera = [this](std::array<double, 3>& d) { return vue_->directionCamera(d); };
  ficheFao_ = new VueDom(carteDroite_, th(wxColour(0x24, 0x26, 0x2b)));
  ficheFao_->Hide();
  carteDroite_->contenu()->Add(ficheFao_, 1, wxEXPAND);
  ficheFao_->surToucher = [this](long el, const std::string& s, const plan::J& v, bool c, bool m) { faoToucher(el, s, v, c, m); };
  // La barre de lecture d'usinage, en bas de la vue comme dans la page
  barreSim_ = new wxPanel(scene_);
  barreSim_->SetBackgroundColour(th(wxColour(18, 20, 24)));
  barreSimDom_ = new VueDom(barreSim_, wxColour(18, 20, 24));
  barreSimDom_->surToucher = [this](long el, const std::string& s, const plan::J& v, bool c, bool m) { faoToucher(el, s, v, c, m); };
  tempsSim_ = new wxStaticText(barreSim_, wxID_ANY, wxEmptyString);
  tempsSim_->SetForegroundColour(th(wxColour(220, 222, 226)));
  {
    auto* s = new wxBoxSizer(wxHORIZONTAL);
    s->Add(barreSimDom_, 1, wxEXPAND);
    s->Add(tempsSim_, 0, wxALIGN_CENTER_VERTICAL | wxLEFT | wxRIGHT, FromDIP(8));
    barreSim_->SetSizer(s);
  }
  barreSim_->Hide();
  minuteurSim_.Bind(wxEVT_TIMER, [this](wxTimerEvent&) {
    if (!simActif_ || !simJoue_ || simEnAttente_ || simManuel_) return;
    const wxLongLong t = wxGetLocalTimeMillis();
    double dt = (t - simDernier_).ToDouble() / 1000.0;
    simDernier_ = t;
    faoTrame(std::min(0.25, dt));
  });
  panneauPlan_ = new PanneauPlan(carteDroite_, planVue_);
  panneauPlan_->Hide();
  carteDroite_->contenu()->Add(panneauPlan_, 1, wxEXPAND);
  panneauPlan_->surIndisponible = [this](const wxString& n) { indisponible(n); };
  atelierRendu_ = new AtelierRendu(scene_);
  atelierRendu_->Hide();
  panneauRendu_ = new PanneauRendu(carteDroite_, atelierRendu_);
  panneauRendu_->Hide();
  carteDroite_->contenu()->Add(panneauRendu_, 1, wxEXPAND);
  atelierRendu_->surPanneau = [this] { CallAfter([this] { if (atelier_ == Atelier::RENDU) panneauRendu_->refaire(); }); };
  atelierRendu_->surDoc = [this](const plan::J& r) { changerRendu(r); };
  atelierRendu_->surOccurrence = [this](const PieceRendu& p, const plan::J* e, bool tous) { changerRenduOccurrence(p.occ, p.bid, e, tous); };
  atelierRendu_->surFermer = [this] { changerAtelier(avantRendu_); };
  CallAfter([this] { majVueEnv(false); });
  planVue_->surSelection = [this] {
    CallAfter([this] {
      if (atelier_ == Atelier::PLAN) panneauPlan_->refaire();
    });
  };
  page_->Hide();

  // Les fenêtres posées sur la vue 3D : OpenGL n'a pas le droit de les recouvrir
  for (wxWindow* w : scene_->GetChildren()) {
    const HWND h = w->GetHWND();
    ::SetWindowLongPtrW(h, GWL_STYLE, ::GetWindowLongPtrW(h, GWL_STYLE) | WS_CLIPSIBLINGS);
    ::SetWindowPos(h, nullptr, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
    if (w != vue_) w->Raise();
  }

  stylerProps();
  noteDroite_->SetForegroundColour(C_GRIS);
  noteDroite_->SetFont(policeArial(this, 12.5));

  scene_->Bind(wxEVT_SIZE, [this](wxSizeEvent& e) {
    placerScene();
    const wxSize t = scene_->GetClientSize();
    const int r = FromDIP(24);
    ::SetWindowRgn(scene_->GetHWND(), ::CreateRoundRectRgn(0, 0, t.x + 1, t.y + 1, r, r), TRUE);
    e.Skip();
  });
}

// La grille de propriétés, aux couleurs du panneau du navigateur
void Cadre::stylerProps() {
  props_->SetMarginColour(C_CARTE);
  props_->SetCaptionBackgroundColour(C_CARTE);
  props_->SetCaptionTextColour(C_GRIS);
  props_->SetCellBackgroundColour(C_CARTE);
  props_->SetCellTextColour(C_CLAIR);
  props_->SetCellDisabledTextColour(C_GRIS);
  props_->SetEmptySpaceColour(C_CARTE);
  props_->SetLineColour(th(wxColour(0x3a, 0x3a, 0x3d)));
  props_->SetSelectionBackgroundColour(th(wxColour(0x0a, 0x84, 0xff)));
  props_->SetSelectionTextColour(*wxWHITE);
  props_->SetFont(policeArial(this, 12.5));
}

// Les mêmes emplacements que dans le navigateur, à partir des bords de la scène
void Cadre::placerScene() {
  if (!fil_) return;
  if (film_) return filmPlacer();
  const wxSize t = scene_->ToDIP(scene_->GetClientSize());
  if (t.x < 50 || t.y < 50) return;
  const auto poser = [&](wxWindow* w, int x, int y, int l, int h) { w->SetSize(wxRect(scene_->FromDIP(wxPoint(x, y)), scene_->FromDIP(wxSize(l, h)))); };
  const bool cao = atelier_ == Atelier::CAO, fao = atelier_ == Atelier::FAO, rendu = atelier_ == Atelier::RENDU;
  const bool volume = cao || fao;
  poser(vue_, 0, 0, t.x, t.y);
  vue_->Show(volume);
  poser(page_, 0, 0, t.x, t.y);
  page_->Show(false);
  poser(atelierRendu_, 0, 0, t.x, t.y);
  atelierRendu_->Show(rendu);
  poser(planVue_, 0, 0, t.x, t.y);
  planVue_->Show(atelier_ == Atelier::PLAN);
  const int xo[] = {8, 72, 140}, lo[] = {63, 67, 48};
  for (int i = 0; i < 3; i++) {
    poser(onglets_[i], xo[i], 14, lo[i], 20);
    onglets_[i]->Show(!rendu);
  }
  poser(repliArbre_, 5, 41, 22, 88);
  repliArbre_->Show(volume);
  const int basFil = cao ? t.y - 64 : t.y - 34;
  poser(carteArbre_, 32, 41, 300, std::max(120, basFil - 41));
  carteArbre_->Show(cao && !arbreReplie_);
  poser(carteFao_, 32, 41, 300, std::max(120, std::min(560, t.y - 41 - 34)));
  carteFao_->Show(fao && !arbreReplie_);
  poser(boutonsVue_[0], t.x - 214, 16, 36, 24);
  poser(boutonsVue_[1], t.x - 173, 16, 36, 24);
  poser(boutonsVue_[2], t.x - 132, 16, 32, 24);
  poser(boutonsVue_[3], t.x - 104, 7, 18, 18);
  poser(boutonsVue_[4], t.x - 104, 27, 18, 18);
  for (BoutonEsquisse* b : boutonsVue_) b->Show(volume);
  if (ficheVue_ && ficheVue_->IsShown()) {
    if (!volume) ficheVue_->Show(false);
    else {
      const int h = std::min(t.y - 50, scene_->ToDIP(wxSize(0, ficheVue_->hauteurVoulue())).y);
      poser(ficheVue_, t.x - 392, 46, 296, h);
      ficheVue_->Raise();
    }
  }
  poser(fil_, 13, t.y - 60, t.x - 26, 48);
  fil_->Show(cao);
  const int largeurEtat = std::min(t.x - 40, etatVue_->largeurVoulue() + 8);
  poser(etatVue_, t.x - 12 - largeurEtat, (cao ? t.y - 82 : t.y - 26), largeurEtat, 20);
  etatVue_->Show(volume);
  {
    const int l = std::min(t.x - 24, 820);
    poser(barreSim_, (t.x - l) / 2, t.y - (l < 780 ? 112 : 78), l, l < 780 ? 76 : 42);
    barreSim_->Show(fao && simActif_);
    if (fao && simActif_) barreSim_->Raise();
  }
  scene_->Refresh();
}

void Cadre::changerAtelier(Atelier a) {
  quitterConge();
  if (esquisseOuverte_ >= 0 && a != Atelier::CAO) quitterEsquisse();
  if (atelier_ == Atelier::FAO && a != Atelier::FAO) {
    faoFaireSuivre();
    faoQuitterVue();
  }
  if (a == Atelier::RENDU && atelier_ != Atelier::RENDU) avantRendu_ = atelier_;
  if (atelier_ == Atelier::RENDU && a != Atelier::RENDU) atelierRendu_->fermer();
  const bool sortRendu = atelier_ == Atelier::RENDU;
  atelier_ = a;
  barreHaute_->atelier(a);
  ruban_->atelier(a);
  for (int i = 0; i < 3; i++) onglets_[i]->actif(static_cast<int>(a) == i);
  montrerAtelier();
  placerScene();
  centre_->Layout();
  if (sortRendu || a == Atelier::CAO || a == Atelier::FAO) majVueEnv();
  dessinerEsquisses();
}

// Molette : zoom. Bouton du milieu : déplacer ; double-clic du milieu : toute la feuille.
void Cadre::montrerPlan() {
  const std::string base = !doc_.texteBase.empty() ? doc_.texteBase.str() : texteDuFichier(doc_);
  std::string texte = base;
  try {
    if (!base.empty()) texte = texteEnregistre(doc_, base);
  } catch (const std::exception&) {
  }
  {
    const ReglagesRendu& st = atelierRendu_->st;
    planVue_->sigReel(st.amb + "|" + std::to_string(st.envRot) + "|" + std::to_string(st.envInt) + "|" + std::to_string(reinterpret_cast<uintptr_t>(st.hdri.get())));
  }
  planVue_->charger(texte, doc_, dernierRejeu_, asmSolides_);
  panneauPlan_->refaire();
  noteDroite_->SetLabel(planVue_->resume() + L"\n\nMolette : zoom. Bouton du milieu : déplacer la feuille ; double-clic du milieu : la voir en entier.\n\nPour l'instant on regarde : modifier les vues et les cotes viendra ensuite.");
}

// Le texte du fichier, et doc.rendu dedans
plan::J Cadre::renduDocCourant(plan::J& racine) {
  racine = plan::J::object();
  try {
    const std::string t = faoTexteCourant();
    if (!t.empty()) racine = plan::J::parse(t);
  } catch (const std::exception&) {
  }
  const plan::J& d = racine.contains("doc") && racine["doc"].is_object() ? racine["doc"] : racine;
  return d.contains("rendu") && d["rendu"].is_object() ? d["rendu"] : plan::J::object();
}

void Cadre::montrerRendu(bool ouverture) {
  plan::J racine;
  const plan::J r = renduDocCourant(racine);
  const std::vector<PieceRendu> L = renduPieces(racine);
  atelierRendu_->SetName(docOuvert_ && !doc_.chemin.empty() ? wxFileName(doc_.chemin).GetName() : wxString(L"piece"));
  if (ouverture) {
    atelierRendu_->ouvrir(vue_->pilote(), L, r, vue_->oeil(), vue_->cibleVue());
    panneauRendu_->refaire();
  } else atelierRendu_->changerPieces(L, r);  // le panneau se refait juste après : on est peut-être dans une de ses lignes
}

// doc.rendu : sans recalculer la pièce, annulable, enregistré avec elle
void Cadre::changerRendu(const plan::J& rendu) {
  auto avant = std::make_shared<Document>(doc_);
  try {
    modifierStructure(doc_, [&](nlohmann::ordered_json& d) {
      if (rendu.is_object() && !rendu.empty()) d["rendu"] = rendu;
      else d.erase("rendu");
    });
  } catch (const std::exception& e) {
    doc_ = *avant;
    if (!essaiMenu_) wxMessageBox(tx(e.what()), L"Modification impossible", wxOK | wxICON_WARNING, this);
    return;
  }
  ModifCote m;
  m.docAvant = avant;
  m.planSeul = true;
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  majTitre();
  if (atelier_ == Atelier::RENDU) montrerRendu(false);
  else majVueEnv();
}

// vEnvCfg : l'ambiance de la vue ; en Rendu direct, celle de la fenêtre RENDU
void Cadre::majVueEnv(bool apparences) {
  if (!atelierRendu_ || !ficheVue_) return;  // pendant la construction de la fenêtre
  ambianceVue();
  OptionsVue& o = optionsVue_;
  if (o.env != "actuel" && apparences && docOuvert_) {
    plan::J racine;
    renduDocCourant(racine);
    std::vector<ApparenceVue> L;
    for (const PieceRendu& p : renduPieces(racine)) L.push_back({p.forme, p.cle, p.couleur});
    vue_->poserApparences(L);
  }
  vue_->options(o);
  const bool actif = o.env != "actuel";
  boutonsVue_[1]->fond(actif ? th(wxColour(0xff, 0x9f, 0x0a)) : C_SCENE);
  boutonsVue_[1]->iconeComplete(iconeVue(1), actif ? th(wxColour(0x1c, 0x1c, 0x1e)) : C_CLAIR);
  boutonsVue_[1]->Refresh();
}

void Cadre::ambianceVue() {
  static const std::map<std::string, std::string> SOL{{"studio", "#b4b8bf"}, {"clair", "#e2e4e8"}, {"atelier", "#272b31"}, {"exterieur", "#7d8894"}, {"noir", "#0b0b0d"}};
  static const std::map<std::string, std::pair<std::string, std::string>> FOND{{"studio", {"#d3d6db", "#9a9fa7"}}, {"clair", {"#f4f5f7", "#cdd1d7"}}, {"atelier", {"#3a4049", "#121417"}}, {"exterieur", {"#b7c5d4", "#6a7684"}}, {"noir", {"#1b1b1e", "#000000"}}};
  OptionsVue& o = optionsVue_;
  const ReglagesRendu& st = atelierRendu_->st;
  const auto dans = [](const auto& M, const std::string& k) { return M.count(k) ? k : std::string("studio"); };
  o.hdri = nullptr;
  o.support = st.support;
  if (o.env == "rendu") {
    o.amb = st.amb == "hdri" && st.hdri ? "hdri" : dans(SOL, st.amb);
    o.hdri = o.amb == "hdri" ? st.hdri : nullptr;
    o.rot = st.envRot;
    o.force = st.envInt;
    const std::string amb = dans(SOL, st.amb);
    if (st.fond == "degrade") o.fond1 = st.fc1, o.fond2 = st.fc2;
    else if (st.fond == "uni") o.fond1 = o.fond2 = st.fc1;
    else o.fond1 = FOND.at(amb).first, o.fond2 = FOND.at(amb).second;
    o.solCouleur = !st.solCol.empty() ? st.solCol : st.fond == "degrade" || st.fond == "uni" ? o.fond2 : SOL.at(amb);
  } else if (o.env != "actuel") {
    o.amb = dans(SOL, o.env);
    o.rot = 0;
    o.force = 1;
    o.fond1 = FOND.at(o.amb).first;
    o.fond2 = FOND.at(o.amb).second;
    o.solCouleur = SOL.at(o.amb);
  }
}

void Cadre::basculerFicheVue() {
  if (ficheVue_->IsShown()) {
    ficheVue_->Show(false);
    return;
  }
  ficheVue_->support = &atelierRendu_->st.support;
  ficheVue_->refaire();
  ficheVue_->Show(true);
  placerScene();
}

// Les préférences d'affichage suivent l'utilisateur d'une pièce à l'autre ; les essais automatiques partent toujours des réglages de départ
void Cadre::memoriserVue() {
  if (essaiMenu_) return;
  const OptionsVue& o = optionsVue_;
  plan::J j = {{"env", o.env}, {"sol", o.sol}, {"miroir", o.miroir}, {"ombre", o.ombre}, {"aretes", o.aretes}, {"axes", o.axes}, {"zoomInv", o.zoomInverse}, {"libre", o.orbiteLibre}, {"fov", o.fov}};
  std::ofstream f(memoireVue().ToStdWstring());
  f << j.dump();
}

// À l'ouverture d'une pièce : son environnement (clé env) et son affichage (clé view), s'ils existent
void Cadre::lireEnvVue() {
  plan::J racine;
  renduDocCourant(racine);
  const plan::J& d = racine.contains("doc") && racine["doc"].is_object() ? racine["doc"] : racine;
  OptionsVue& o = optionsVue_;
  envModifie_ = false;
  if (d.contains("env") && d["env"].is_object()) {
    const plan::J& e = d["env"];
    o.env = e.value("v", std::string("actuel"));
    o.sol = e.value("sol", true);
    o.miroir = e.value("miroir", true);
    o.ombre = e.value("ombre", true);
    if (e.contains("rd") && e["rd"].is_object()) atelierRendu_->lireEnv(e["rd"]);
  }
  if (d.contains("view") && d["view"].is_object()) {
    const plan::J& v = d["view"];
    if (v.contains("edges") && v["edges"].is_string()) o.aretes = v["edges"].get<std::string>() != "off";
    if (v.contains("mirror") && v["mirror"].is_boolean() && !(d.contains("env") && d["env"].is_object())) o.miroir = v["mirror"].get<bool>();
    if (v.contains("axes") && v["axes"].is_boolean()) o.axes = v["axes"].get<bool>();
    if (v.contains("zoomInv") && v["zoomInv"].is_boolean()) o.zoomInverse = v["zoomInv"].get<bool>();
    o.coupe = v.contains("clipOn") && v["clipOn"].is_boolean() && v["clipOn"].get<bool>();
    if (v.contains("clipPos") && v["clipPos"].is_number()) o.coupePos = v["clipPos"].get<double>();
    if (v.contains("clipFlip") && v["clipFlip"].is_boolean()) o.coupeInverse = v["clipFlip"].get<bool>();
    if (v.contains("clipCap") && v["clipCap"].is_boolean()) o.coupeRemplie = v["clipCap"].get<bool>();
    if (v.contains("clipAxis") && v["clipAxis"].is_string()) {
      const std::string x = v["clipAxis"].get<std::string>();
      o.coupeAxe = x == "X" ? 0 : x == "Y" ? 1 : 2;
    }
  }
  majVueEnv(false);
  if (ficheVue_->IsShown()) ficheVue_->refaire();
}

// Une pièce dont la vue n'a pas été touchée garde son fichier à l'identique
void Cadre::ecrireEnvVue() {
  if (!envModifie_) return;
  envModifie_ = false;
  const OptionsVue& o = optionsVue_;
  plan::J rd = atelierRendu_->ecrireEnv();
  try {
    modifierStructure(doc_, [&](nlohmann::ordered_json& d) {
      nlohmann::ordered_json e = nlohmann::ordered_json::object();
      e["v"] = o.env;
      e["sol"] = o.sol;
      e["miroir"] = o.miroir;
      e["ombre"] = o.ombre;
      e["rd"] = rd;
      d["env"] = e;
      nlohmann::ordered_json v = d.contains("view") && d["view"].is_object() ? d["view"] : nlohmann::ordered_json::object();
      v["edges"] = o.aretes ? "on" : "off";
      v["mirror"] = o.miroir;
      v["axes"] = o.axes;
      v["zoomInv"] = o.zoomInverse;
      v["clipOn"] = o.coupe;
      v["clipPos"] = o.coupePos;
      v["clipFlip"] = o.coupeInverse;
      v["clipAxis"] = o.coupeAxe == 0 ? "X" : o.coupeAxe == 1 ? "Y" : "Z";
      v["clipCap"] = o.coupeRemplie;
      d["view"] = v;
    });
  } catch (const std::exception&) {
  }
}

void Cadre::montrerAtelier() {
  const bool enEsquisse = esquisseOuverte_ >= 0;
  if (atelier_ != Atelier::FAO) vue_->faoModeChoix("");
  ruban_->Show(!enEsquisse && atelier_ != Atelier::RENDU);
  const bool cao = atelier_ == Atelier::CAO;
  props_->Show(cao);
  panneauPlan_->Show(atelier_ == Atelier::PLAN);
  ficheFao_->Show(atelier_ == Atelier::FAO);
  panneauRendu_->Show(atelier_ == Atelier::RENDU);
  noteMontree_ = noteDroite_->IsShown();
  switch (atelier_) {
    case Atelier::CAO:
      carteDroite_->titre(L"PARAMÈTRES");
      noteDroite_->SetLabel(L"Sélectionnez un plan, une esquisse ou une fonction dans l'arbre.");
      break;
    case Atelier::FAO:
      carteDroite_->titre(L"PARAMÈTRES");
      noteDroite_->SetLabel(wxEmptyString);
      faoEntrer();
      break;
    case Atelier::PLAN:
      carteDroite_->titre(L"PARAMÈTRES");
      montrerPlan();
      break;
    case Atelier::RENDU:
      carteDroite_->titre(L"PARAMÈTRES — RENDU");
      noteDroite_->SetLabel(wxEmptyString);
      montrerRendu(true);
      break;
  }
  noteDroite_->Wrap(FromDIP(255));
  noteDroite_->InvalidateBestSize();
  noteDroite_->SetMinSize(noteDroite_->GetBestSize());
  hauteurDroite_ = 0;
  ajusterDroite();
  carteDroite_->Layout();
}

// La carte de droite a la hauteur de ce qu'elle contient, comme dans le navigateur
void Cadre::ajusterDroite() {
  if (esquisseOuverte_ >= 0) return;
  const bool cao = atelier_ == Atelier::CAO, rendu = atelier_ == Atelier::RENDU;
  int rangs = 0;
  if (cao)
    for (wxPropertyGridIterator it = props_->GetGrid()->GetIterator(wxPG_ITERATE_VISIBLE); !it.AtEnd(); it++) rangs++;
  const bool asmPanneau = cao && !boutonsAsm_.empty();
  const bool surPlan = atelier_ == Atelier::PLAN || atelier_ == Atelier::FAO || rendu;
  const bool note = (!cao || rangs <= 1 || enChoix()) && !asmPanneau && !surPlan;
  if (note != noteMontree_) {
    noteMontree_ = note;
    noteDroite_->Show(note);
    carteDroite_->Layout();
  }
  int h = 34 + 12;
  if (rangs) h += rangs * ToDIP(props_->GetRowHeight()) + 4;
  if (note) h += ToDIP(noteDroite_->GetBestSize().y) + 6;
  if (rendu || enChoix() || rangDynMontre_) h += 42;
  if (cao) h += hauteurSeg_;
  if (asmPanneau) h += hauteurBoutonsAsm_ + 6;
  if (surPlan) h = 100000;
  h = std::min(h, ToDIP(centre_->GetClientSize().y) - 90);
  if (h == hauteurDroite_) return;
  hauteurDroite_ = h;
  carteDroite_->SetMinSize(FromDIP(wxSize(288, h)));
  centre_->Layout();
}

void Cadre::indisponible(const wxString& nom) { etat(nom + PAS_ENCORE + L"."); }

void Cadre::boutonRuban(Atelier a, const wxString& nom) {
  if (a == Atelier::PLAN) {
    if (!planVue_->boutonRuban(nom)) indisponible(nom);
    return;
  }
  if (a == Atelier::FAO) {
    if (nom == L"Posage") return faoAction("posage", "");
    if (nom == L"Outils") return faoAction("outils", "");
    if (nom == L"Rapides") return faoAction("rapides", "");
    if (nom == L"Régénérer") return faoAction("regenerer", "");
    if (nom == L"Usinage") return faoAction("usinage", "");
    if (nom == L"Esquisse") return faoAction("esquisse", "");
    if (nom == L"Extrusion") return faoAction("extrusion", "");
    if (nom == L"G-code") return faoAction("gcode", "");
    if (nom == L"Surfaçage" || nom == L"Chanfrein" || nom == L"Contour" || nom == L"Perçage" || nom == L"Ébauche 3D" || nom == L"Finition" || nom == L"Géodésique") return faoAction("ajout", nom.ToStdString(wxConvUTF8));
    return indisponible(nom);
  }
  if (a != Atelier::CAO) return;
  if (nom == L"Assembler") return asmBasculer();
  if (nom == L"Composant") return asmNouveauComposant();
  if (nom == L"Occurrence") return asmNouvelleOccurrence();
  if (nom == L"Répétition" && (ruban_->enAssemblage())) return asmRepetition();
  if (nom == L"Depuis corps") return asmDepuisCorps({});
  if (nom == L"Inspecter") return asmInspecter();
  if (nom == L"Normalisés") return asmNormalises();
  if (nom == L"Aimants") return asmNormalises("magnet");
  if (nom == L"Insérer") return asmInserer();
  if (nom == L"Paramètres") return basculerMiniParametres();
  if (nom == L"Congé") return entrerConge(false);
  if (nom == L"Chanfrein") return entrerConge(true);
  if (nom == L"Face") return entrerFaces(ChoixFaces::DEPLACER);
  if (nom == L"Dépouille") return entrerFaces(ChoixFaces::DEPOUILLE);
  if (nom == L"Coque") return entrerFaces(ChoixFaces::COQUE);
  if (nom == L"Scinder") return entrerFaces(ChoixFaces::SCINDER);
  quitterConge();
  if (nom == L"Extrusion") extruder();
  else if (nom == L"Esquisse") menuEsquisse();
  else if (nom == L"Clavette") creerSurCylindre(true);
  else if (nom == L"Plan") creerConstructionRuban("plane");
  else if (nom == L"Axe") creerConstructionRuban("axis");
  else if (nom == L"Point") creerConstructionRuban("point");
  else if (nom == L"Repère") creerConstructionRuban("frame");
  else if (nom == L"Corps") nouveauCorps();
  else if (nom == L"Perçage") creerPercageVise();
  else if (nom == L"Filetage") creerFiletageVise();
  else if (nom == L"Répétition") {
    const int choisie = fonctionMontree_ >= 0 ? fonctionMontree_ : -1;
    std::string source;
    if (const wxTreeItemId ligne = arbre_->GetSelection(); ligne.IsOk())
      if (const auto* lien = dynamic_cast<LienArbre*>(arbre_->GetItemData(ligne)); lien && lien->estFonction && lien->i >= 0) source = doc_.fonctions[lien->i].id;
    if (source.empty() && choisie >= 0) source = doc_.fonctions[choisie].id;
    creerFonction([&](nlohmann::ordered_json& d) { return creerRepetition(d, source, indiceMarque()); }, L"Répétition : cochez les fonctions à répéter et réglez le type dans Paramètres. Le résultat se voit tout de suite. Ctrl+Z : annuler.");
  }
  else if (nom == L"Combiner") creerFonction([this](nlohmann::ordered_json& d) { return creerCombiner(d, indiceMarque()); }, L"Combiner : réglez la cible, l'outil et l'opération dans Paramètres. Ctrl+Z : annuler.");
  else if (nom == L"Déplacer") creerFonction([this](nlohmann::ordered_json& d) { return creerDeplacement(d, "", indiceMarque()); }, L"Déplacer : ajoutez une translation ou une rotation dans Paramètres. Ctrl+Z : annuler.");
  else if (nom == L"Échelle") creerFonction([this](nlohmann::ordered_json& d) { return creerEchelle(d, "", indiceMarque()); }, L"Échelle : réglez le facteur et le centre dans Paramètres. Ctrl+Z : annuler.");
  else if (nom == L"Révolution") {
    if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
    const std::string id = esquisseVisee(true);
    if (id.empty()) return etat(L"Révolution : dessinez d'abord un profil fermé dans une esquisse.");
    creerFonction([&, id](nlohmann::ordered_json& d) { return creerRevolution(d, id, indiceMarque()); }, L"Révolution : réglez l'axe et l'angle dans Paramètres. Ctrl+Z : annuler.");
  } else if (nom == L"Balayage") {
    if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
    const std::string profil = esquisseVisee(true);
    std::string chemin;
    for (size_t i = doc_.esquisses.size(); i-- > 0 && chemin.empty();)
      if (doc_.esquisses[i].id != profil && !raisonSansVolume(doc_.esquisses[i]).empty() && !doc_.esquisses[i].entites.empty()) chemin = doc_.esquisses[i].id;
    for (size_t i = doc_.esquisses.size(); i-- > 0 && chemin.empty();)
      if (doc_.esquisses[i].id != profil) chemin = doc_.esquisses[i].id;
    creerFonction([&, profil, chemin](nlohmann::ordered_json& d) { return creerBalayage(d, profil, chemin, indiceMarque()); }, L"Balayage : vérifiez le profil et le chemin dans Paramètres. Ctrl+Z : annuler.");
  }
  else if (nom == L"Importer") importer();
  else if (nom == L"Dériver") derCommande();
  else if (nom == L"STEP") exporter("step");
  else if (nom == L"STL") exporter("stl");
  else if (nom == L"OBJ") exporter("obj");
}

int Cadre::esquisseDeLArbre() {
  if (const wxTreeItemId ligne = arbre_->GetSelection(); ligne.IsOk())
    if (const auto* lien = dynamic_cast<LienArbre*>(arbre_->GetItemData(ligne)); lien && !lien->estFonction && lien->i >= 0 && lien->corps.empty()) return lien->i;
  return -1;
}

// L'esquisse sélectionnée dans l'arbre, sinon la dernière qui n'est pas une copie de répétition (et fermée si demandé)
std::string Cadre::esquisseVisee(bool profilFerme) {
  if (const wxTreeItemId ligne = arbre_->GetSelection(); ligne.IsOk()) {
    const auto* lien = dynamic_cast<LienArbre*>(arbre_->GetItemData(ligne));
    if (lien && !lien->estFonction && lien->i >= 0 && lien->corps.empty() && (!profilFerme || raisonSansVolume(doc_.esquisses[lien->i]).empty())) return doc_.esquisses[lien->i].id;
  }
  for (size_t i = doc_.esquisses.size(); i-- > 0;) {
    const std::string& n = doc_.esquisses[i].nom;
    const size_t r = n.rfind("(r\xC3\xA9p");
    if (r != std::string::npos && n.back() == ')') continue;
    if (!profilFerme || raisonSansVolume(doc_.esquisses[i]).empty()) return doc_.esquisses[i].id;
  }
  return "";
}

void Cadre::creerFonction(const std::function<std::string(nlohmann::ordered_json&)>& f, const wxString& message) {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  quitterEsquisse();
  std::string id;
  changerStructure([&](nlohmann::ordered_json& d) { id = f(d); });
  if (id.empty()) return;
  for (size_t i = 0; i < doc_.fonctions.size(); i++)
    if (doc_.fonctions[i].id == id) {
      choisirFonction(static_cast<int>(i));
      if (fonctionMontree_ < 0 && ficheId_ != id) montrerFonction(static_cast<int>(i));
    }
  if (!dyn_ || !dyn_->neuf || dyn_->id != id) etat(etatVue_->texte() + L"  |  " + message);
}

// Le panneau d'une fonction : les réglages que décrit sa fiche
void Cadre::montrerFiche(int i) {
  const Fonction& f = doc_.fonctions[i];
  ficheChoix_.clear();
  ficheId_.clear();
  if (!doc_.fonctionsJson) return;
  const auto it = doc_.fonctionsJson->find(f.id);
  if (it == doc_.fonctionsJson->end()) return;
  const bool copie = !f.repeatId.empty();
  const nlohmann::ordered_json fj = nlohmann::ordered_json::parse(it->second);
  std::vector<ChampFiche> champs = ficheFonction(doc_, fj);
  std::vector<std::pair<wxString, std::function<void()>>> boutons;
  derFiche(fj, champs, boutons);
  if (f.type == "xfillet" && !copie) boutons.push_back({L"✏️ Modifier la sélection", [this, i] { editerConge(i); }});
  if (!copie) boutonsDeplacer(f, boutons);
  champsDe_ = f.id;
  poserChamps(champs, copie);
  champsDe_.clear();
  if (!boutons.empty() || !boutonsAsm_.empty()) poserBoutonsPanneau(boutons);
  if (!copie) ficheId_ = f.id;
}

void Cadre::poserChamps(const std::vector<ChampFiche>& champs, bool copie) {
  std::string categorie;
  for (const ChampFiche& c : champs) {
    if (c.categorie != categorie) {
      categorie = c.categorie;
      if (!categorie.empty()) props_->Append(new wxPropertyCategory(tx(categorie)));
    }
    const wxString nom = L"fiche:" + wxString::FromUTF8(c.cle);
    if (c.libre) {
      props_->Append(new wxStringProperty(tx(c.titre), nom, tx(c.texte)));
    } else if (c.sorte == ChampFiche::LECTURE || copie) {
      wxString v = tx(c.texte);
      if (c.sorte == ChampFiche::NOMBRE) v = wxString::Format("%g", c.nombre);
      else if (c.sorte == ChampFiche::BOOLEEN) v = c.oui ? L"Oui" : L"Non";
      else if (c.sorte == ChampFiche::CHOIX)
        for (const auto& [val, lib] : c.choix)
          if (val == c.texte) v = tx(lib);
      lectureSeule(props_, tx(c.titre), v);
    } else if (c.sorte == ChampFiche::NOMBRE) {
      wxString montre = wxString::Format("%.6g", c.nombre);
      if (const PorteurFx* h = champsDe_.empty() ? nullptr : porteurDuChamp(champsDe_, c.cle); h && (!h->nom.empty() || !h->expr.empty()))
        montre = tx((h->nom.empty() ? std::string() : h->nom + " = ") + (h->expr.empty() ? nombreJsFixe(h->valeur, 4) : h->expr));
      wxPGProperty* pr = props_->Append(new wxStringProperty(tx(c.titre), nom, montre));
      props_->SetPropertyHelpString(pr, L"ƒx : valeur, expression (L/2 + 3) ou « nom = valeur » pour la nommer");
    } else if (c.sorte == ChampFiche::BOOLEEN) {
      props_->SetPropertyAttribute(props_->Append(new wxBoolProperty(tx(c.titre), nom, c.oui)), wxPG_BOOL_USE_CHECKBOX, true);
    } else {
      wxPGChoices l;
      std::vector<std::string> valeurs;
      int choisi = 0;
      for (size_t k = 0; k < c.choix.size(); k++) {
        l.Add(tx(c.choix[k].second), static_cast<int>(k));
        valeurs.push_back(c.choix[k].first);
        if (c.choix[k].first == c.texte) choisi = static_cast<int>(k);
      }
      props_->Append(new wxEnumProperty(tx(c.titre), nom, l, choisi));
      ficheChoix_[c.cle] = std::move(valeurs);
    }
  }
}

// Le porteur ƒx d'un champ de fiche : « n/dist », « n/thread/len », « n/edges/2/r », « n/d » d'un élément de construction
static bool champPorteur(const std::string& cle, bool construction, int& arete, std::string& k) {
  if (cle.rfind("n/", 0) != 0) return false;
  k = cle.substr(2);
  arete = construction ? -3 : -1;
  if (k.rfind("thread/", 0) == 0) arete = -2, k = k.substr(7);
  else if (k.rfind("edges/", 0) == 0) {
    const size_t b = k.find('/', 6);
    if (b == std::string::npos || k.substr(b + 1) != "r") return false;
    arete = std::atoi(k.c_str() + 6);
    k = "r";
  }
  return k.find('/') == std::string::npos;
}

const PorteurFx* Cadre::porteurDuChamp(const std::string& id, const std::string& cle) const {
  bool construction = false;
  for (const ElementConstruction& c : doc_.construction) construction = construction || c.id == id;
  int arete;
  std::string k;
  if (!champPorteur(cle, construction, arete, k)) return nullptr;
  for (const PorteurFx& h : doc_.porteurs)
    if (h.fonction == id && h.arete == arete && h.cle == k) return &h;
  return nullptr;
}

// parFx : « [nom =] expression » dans un champ. Un nombre seul, sans formule en place, suit le chemin ordinaire.
bool Cadre::ficheFormule(const std::string& id, const std::string& cle, const std::string& valeur) {
  bool construction = false;
  for (const ElementConstruction& c : doc_.construction) construction = construction || c.id == id;
  int arete;
  std::string k;
  if (!champPorteur(cle, construction, arete, k)) return false;
  const PorteurFx* deja = porteurDuChamp(id, cle);
  if (parEstNombre(valeur) && (!deja || (deja->expr.empty() && deja->nom.empty()))) return false;
  const std::string raison = changerFormules([&]() -> std::string {
    PorteurFx* h = nullptr;
    for (PorteurFx& q : doc_.porteurs)
      if (q.fonction == id && q.arete == arete && q.cle == k) h = &q;
    if (!h) {
      PorteurFx n;
      n.fonction = id;
      n.arete = arete;
      n.cle = k;
      const nlohmann::ordered_json j = documentJson(doc_);
      const char* liste = construction ? "cgeo" : "features";
      for (const auto& x : j[liste]) {
        if (x.value("id", std::string()) != id) continue;
        n.origine = x.value("name", std::string());
        const nlohmann::ordered_json& H = arete == -3 ? x["p"] : arete == -2 ? x["thread"] : arete >= 0 ? x["edges"][arete] : x;
        const std::string lue = k == "qty" ? "copies" : k == "qty2" ? "copies2" : k;
        if (H.contains(lue) && H[lue].is_number()) n.valeur = H[lue].get<double>();
        if (k == "qty" || k == "qty2") n.valeur = std::min(200.0, std::max(1.0, std::floor(n.valeur != 0 ? n.valeur : 1))) + 1;
        if (k == "distance") n.valeur = std::abs(n.valeur);
      }
      for (const Fonction& f : doc_.fonctions)
        if (f.id == id) n.pris = f.type == "extrude" && arete < 0 && k == "distance";
      doc_.porteurs.push_back(n);
      h = &doc_.porteurs.back();
    }
    try {
      return parReglerPorteur(doc_, *h, valeur);
    } catch (const std::exception& e) {
      return e.what();
    }
  });
  if (!raison.empty()) etat(L"ƒx : " + tx(raison));
  if (construction) choisirConstruction(id);
  else
    for (size_t i = 0; i < doc_.fonctions.size(); i++)
      if (doc_.fonctions[i].id == id) choisirFonction(static_cast<int>(i)), montrerFonction(static_cast<int>(i));
  return true;
}

void Cadre::appliquerFiche(const std::string& id, const std::string& cle, const std::string& valeur) {
  if (id == "@asm") return asmFiche(cle, valeur);
  if (ficheFormule(id, cle, valeur)) return;
  for (const ElementConstruction& c : doc_.construction)
    if (c.id == id) return reglerConstruction(id, cle, valeur);
  pioche_ = nullptr;
  if ((cle == "z/dir" && valeur == "ref") || (cle == "z/ref" && (valeur == "pick" || valeur == "none"))) return piocherCylindre(id, cle, valeur);
  demanderClicFiche(id, cle, valeur);
  changerStructure([&](nlohmann::ordered_json& d) {
    const std::string refus = ficheAppliquer(d, id, cle, valeur);
    if (!refus.empty()) throw std::runtime_error(refus);
  });
  for (size_t i = 0; i < doc_.fonctions.size(); i++)
    if (doc_.fonctions[i].id == id) choisirFonction(static_cast<int>(i)), montrerFonction(static_cast<int>(i));
}

void Cadre::nouveauCorps() {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  quitterEsquisse();
  changerStructure([](nlohmann::ordered_json& d) { stNouveauCorps(d); });
  const size_t i = std::find(doc_.corps.begin(), doc_.corps.end(), doc_.corpsActif) - doc_.corps.begin();
  etat(L"« " + (i < doc_.nomsCorps.size() ? tx(doc_.nomsCorps[i]) : wxString()) + L" » créé et ACTIF (●) : esquissez puis extrudez — la fonction naîtra dedans.");
}

void Cadre::importer() {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  wxFileDialog choix(this, L"Importer une pièce", wxEmptyString, wxEmptyString, L"Pièces (*.step;*.stp;*.stl)|*.step;*.stp;*.STEP;*.STP;*.stl;*.STL", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
  if (choix.ShowModal() == wxID_OK) importerFichier(choix.GetPath().ToStdWstring());
}

bool Cadre::importerFichier(const std::wstring& chemin) {
  quitterEsquisse();
  std::string octets;
  {
    std::ifstream e(chemin, std::ios::binary);
    octets.assign(std::istreambuf_iterator<char>(e), {});
  }
  if (octets.empty()) {
    etat(L"Import : fichier vide ou illisible.");
    return false;
  }
  const wxFileName nom(chemin);
  const std::string fmt = nom.GetExt().Lower() == L"stl" ? "stl" : "step";
  const std::string cle = cleImport(octets), base = nom.GetName().utf8_string(), fichier = nom.GetFullName().utf8_string();
  // La source d'abord : un fichier illisible ne laisse rien dans la pièce
  auto avant = std::make_shared<Document>(doc_);
  const int marque = indiceMarque();
  std::string id;
  try {
    modifierStructure(doc_, [&](nlohmann::ordered_json& d) { id = stImporter(d, base, fmt, cle, octets.size(), fichier, marque); }, {{cle, base64Coder(octets)}});
    for (const Fonction& f : doc_.fonctions)
      if (f.id == id && formeImportee(doc_, f).IsNull()) throw std::runtime_error("source absente");
  } catch (const std::exception& e) {
    doc_ = *avant;
    if (!essaiMenu_) wxMessageBox(tx(e.what()), L"Import impossible", wxOK | wxICON_WARNING, this);
    etat(L"Import impossible : " + tx(e.what()));
    return false;
  }
  ModifCote m;
  m.docAvant = avant;
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  ajusterVue_ = forme_.IsNull();
  apresStructure();
  etat(etatVue_->texte() + L"  |  " + tx(fmt == "stl" ? "STL" : "STEP") + L" importé : " + nom.GetFullName());
  return true;
}

void Cadre::exporter(const std::string& format, const std::string& corps) {
  // Vue d'assemblage, ou composant sans solide propre mais qui en contient : tout ce qui est visible, placé
  const bool toutAssemblage = format == "step" && corps.empty() && doc_.assemblage && (asmMode_ == "asm" || (forme_.IsNull() && assemblage::aDesEnfants(*doc_.assemblage)));
  if (forme_.IsNull() && !toutAssemblage) return etat(L"Solide vide, rien à exporter.");
  std::vector<TopoDS_Shape> formes;
  wxString nomFichier = tx(doc_.nom);
  std::vector<std::string> manquants;
  if (toutAssemblage) {
    std::string nomAsm;
    wxBusyCursor attente;
    formes = asmFormesStep(nomAsm, manquants);
    nomFichier = tx(nomAsm);
  } else
  for (const auto& [id, s] : formesCorps_)
    if (corps.empty() ? std::find(doc_.corpsMasques.begin(), doc_.corpsMasques.end(), id) == doc_.corpsMasques.end() : id == corps) {
      formes.push_back(s);
      if (id == corps) {
        const size_t i = std::find(doc_.corps.begin(), doc_.corps.end(), id) - doc_.corps.begin();
        if (i < doc_.nomsCorps.size()) nomFichier = tx(doc_.nomsCorps[i]);
      }
    }
  if (formes.empty()) return etat(L"Rien à exporter : tous les corps sont masqués.");
  std::string schema = schemaStep_;
  bool sansCourbes = stepSansCourbes2D_;
  if (format == "step") {
    wxDialog dlg(this, wxID_ANY, L"Export STEP");
    auto* c = new wxBoxSizer(wxVERTICAL);
    c->Add(new wxStaticText(&dlg, wxID_ANY, L"Format du fichier :"), 0, wxALL, 10);
    auto* r1 = new wxRadioButton(&dlg, wxID_ANY, L"AP214 — automotive design (lu par tous les logiciels récents)", wxDefaultPosition, wxDefaultSize, wxRB_GROUP);
    auto* r2 = new wxRadioButton(&dlg, wxID_ANY, L"AP203 — config control design (logiciels plus anciens)");
    (schema == "AP203" ? r2 : r1)->SetValue(true);
    auto* sc = new wxCheckBox(&dlg, wxID_ANY, L"Sans courbes 2D (pour les vieux logiciels : arêtes en 3D seulement)");
    sc->SetValue(sansCourbes);
    c->Add(r1, 0, wxLEFT | wxRIGHT | wxBOTTOM, 10);
    c->Add(r2, 0, wxLEFT | wxRIGHT | wxBOTTOM, 10);
    c->Add(sc, 0, wxLEFT | wxRIGHT | wxBOTTOM, 10);
    c->Add(dlg.CreateStdDialogButtonSizer(wxOK | wxCANCEL), 0, wxEXPAND | wxALL, 10);
    dlg.SetSizerAndFit(c);
    if (dlg.ShowModal() != wxID_OK) return;
    schema = schemaStep_ = r2->GetValue() ? "AP203" : "AP214";
    sansCourbes = stepSansCourbes2D_ = sc->GetValue();
  }
  const wxString filtre = format == "step" ? L"STEP (*.step)|*.step" : format == "stl" ? L"STL (*.stl)|*.stl" : L"OBJ (*.obj)|*.obj";
  wxFileDialog choix(this, L"Exporter", wxFileName(doc_.chemin).GetPath(), nomFichier + L"." + wxString::FromUTF8(format), filtre, wxFD_SAVE | wxFD_OVERWRITE_PROMPT);
  if (choix.ShowModal() != wxID_OK) return;
  const bool ecrit = ecrireExport(format, formes, choix.GetPath().ToStdWstring(), schema, sansCourbes);
  if (ecrit && toutAssemblage) etat(wxString::Format(L"STEP exporté : %d solides.", static_cast<int>(formes.size())));
  if (ecrit && !manquants.empty()) {
    wxString noms;
    for (const std::string& m : manquants) noms += (noms.empty() ? L"" : L", ") + tx(m);
    wxMessageBox(L"Attention : pièce(s) sans solide exact, absentes du fichier STEP : " + noms + L".", L"Export STEP", wxOK | wxICON_WARNING, this);
  }
}

bool Cadre::ecrireExport(const std::string& format, const std::vector<TopoDS_Shape>& formes, const std::wstring& chemin, const std::string& schema, bool sansCourbes) {
  wxBusyCursor attente;
  try {
    if (format == "step") exporterStep(formes, chemin, schema, sansCourbes);
    else if (format == "stl") exporterStl(formes, chemin);
    else exporterObj(formes, chemin);
  } catch (const std::exception& e) {
    if (!essaiMenu_) wxMessageBox(tx(e.what()), L"Export impossible", wxOK | wxICON_WARNING, this);
    etat(L"Export impossible : " + tx(e.what()));
    return false;
  }
  etat(L"Exporté : " + wxString(chemin));
  return true;
}

// Une face choisie sur le solide : l'esquisse y va tout droit. Sinon, on choisit le plan, comme dans l'arbre.
void Cadre::menuEsquisse() {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  if (!faceChoisie_.IsNull()) return creerEsquisse("");
  wxMenu m;
  m.Append(ID_ESQUISSE_XY, L"Plan XY · dessus");
  m.Append(ID_ESQUISSE_XZ, L"Plan XZ · face");
  m.Append(ID_ESQUISSE_YZ, L"Plan YZ · côté");
  std::vector<std::string> plans;
  for (const ElementConstruction& e : doc_.construction)
    if ((e.kind == "plane" || e.kind == "frame") && e.aRepere) {
      if (plans.empty()) m.AppendSeparator();
      m.Append(wxID_HIGHEST + 5000 + static_cast<int>(plans.size()), tx(libelleConstruction(e)));
      plans.push_back(e.id);
    }
  const int choix = choisirMenu(m);
  if (choix == ID_ESQUISSE_XY) creerEsquisse("XY");
  else if (choix == ID_ESQUISSE_XZ) creerEsquisse("XZ");
  else if (choix == ID_ESQUISSE_YZ) creerEsquisse("YZ");
  else if (choix >= wxID_HIGHEST + 5000 && choix < wxID_HIGHEST + 5000 + static_cast<int>(plans.size())) creerEsquisseConstruction(plans[choix - wxID_HIGHEST - 5000], "");
}

void Cadre::menuGrille() {
  const bool oui = GetMenuBar()->IsChecked(ID_ACCROCHE_GRILLE);
  wxMenu m;
  m.AppendCheckItem(ID_ACCROCHE_GRILLE + 500, L"Accrocher à la grille de 1 mm")->Check(oui);
  if (GetPopupMenuSelectionFromUser(m) == ID_ACCROCHE_GRILLE + 500) {
    GetMenuBar()->Check(ID_ACCROCHE_GRILLE, !oui);
    vueEsquisse_->reglerAccrocheGrille(!oui);
  }
}

// L'esquisse d'abord, puis la fonction qui s'en sert, comme le fil du navigateur
void Cadre::remplirFil() {
  // tlbSteps : 4·i+2 la fonction i, 4·i+1 l'esquisse qu'elle consomme, 4·p+3 ce qui vient après la fonction p, 4·n une esquisse de place inconnue
  struct Etape {
    int cle, sous;
    FilFonctions::Element e;
  };
  std::vector<Etape> S;
  const int n = static_cast<int>(doc_.fonctions.size()), marque = indiceMarque();
  const auto rang = [&](const std::string& id) {
    for (int i = 0; i < n; i++)
      if (doc_.fonctions[i].id == id) return i;
    return -1;
  };
  int nb = 0;
  for (int i = 0; i < n; i++) {
    const Fonction& f = doc_.fonctions[i];
    if (!f.repeatId.empty()) continue;
    nb++;
    FilFonctions::Element e;
    e.estFonction = true;
    e.i = i;
    e.type = f.type;
    e.op = f.op;
    e.nom = f.nom.empty() ? nomType(f) : tx(f.nom);
    if (f.type == "repeat") {
      int copies = 0;
      for (const Fonction& c : doc_.fonctions) copies += c.repeatId == f.id;
      e.nom += wxString::Format(L" · %d instance(s)", copies);
    }
    iconeFonction(f.type, f.op, f.modeFonction, f.chamfer, f.derive, e.ruban, e.couleur, e.moins);
    e.apresMarque = marque >= 0 && i >= marque;
    e.grise = !f.visible || e.apresMarque;
    S.push_back({4 * i + 2, 0, e});
  }
  std::map<std::string, int> cleCg;
  int k = 0;
  for (const ElementConstruction& c : doc_.construction) {
    FilFonctions::Element e;
    e.i = -1;
    e.cg = c.id;
    e.ruban = c.kind == "axis" ? 8 : c.kind == "point" ? 9 : c.kind == "frame" ? 10 : 7;
    e.couleur = th(wxColour(0xff, 0xd6, 0x0a));
    e.nom = tx(libelleConstruction(c));
    const int p = rangConstruction(doc_, c);
    e.apresMarque = marque >= 0 && 4 * p + 3 > 4 * marque;
    e.grise = !c.visible || e.apresMarque;
    cleCg[c.id] = 4 * p + 3;
    S.push_back({4 * p + 3, k++, e});
  }
  for (size_t i = 0; i < doc_.esquisses.size(); i++) {
    const Esquisse& s = doc_.esquisses[i];
    if (s.fao || esquisseCopieRepetition(doc_, s.id)) continue;
    int cle = -1;
    for (int j = 0; j < n && cle < 0; j++) {  // tlHostFeatureOfSketch
      const Fonction& f = doc_.fonctions[j];
      if (((f.type == "extrude" || f.type == "revolve" || f.type == "sweep" || f.type == "hole") && f.esquisse == s.id) || (f.type == "sweep" && f.chemin == s.id)) cle = 4 * j + 1;
    }
    if (cle < 0) {
      const int hote = s.hote.existe ? rang(s.hote.feat) : -1;
      const auto cg = s.plan == "CG" ? cleCg.find(s.plan_cg) : cleCg.end();
      const int support = cg != cleCg.end() ? cg->second : hote >= 0 ? 4 * hote + 3 : -1000;
      if (!s.at.empty() || s.aAt) cle = std::max(support, 4 * rang(s.at.empty() ? s.atLu : s.at) + 3);
      else cle = support > -1000 ? support : 4 * n;
    }
    FilFonctions::Element e;
    e.i = static_cast<int>(i);
    e.ruban = 0;
    e.couleur = th(wxColour(0xff, 0x9f, 0x0a));
    e.nom = (s.nom.empty() ? tx(s.id) : tx(s.nom)) + L" · esquisse";
    e.apresMarque = marque >= 0 && cle > 4 * marque;
    e.grise = !s.visible || e.apresMarque;
    S.push_back({cle, 1000000 + static_cast<int>(i), e});
  }
  std::stable_sort(S.begin(), S.end(), [](const Etape& a, const Etape& b) { return a.cle != b.cle ? a.cle < b.cle : a.sous < b.sous; });
  std::vector<FilFonctions::Element> l;
  for (Etape& e : S) l.push_back(std::move(e.e));
  fil_->montrer(l, nb);
}

Cadre::~Cadre() {
  minuterie_.Stop();
  if (proto_.journal) fclose(proto_.journal);
}

void Cadre::etat(const wxString& texte) {
  etatVue_->montrer(texte);
  placerScene();
  // Windows ne laisse pas relire la barre d'état depuis un autre programme : journal pour natif/mesures/verifier-fenetre.ps1.
  if (const wchar_t* chemin = _wgetenv(L"CONCEPTCAD_JOURNAL_ETAT")) {
    if (FILE* f = _wfopen(chemin, L"ab")) {
      fprintf(f, "%s\n", texte.utf8_str().data());
      fclose(f);
    }
  }
}

void Cadre::creerMenus() {
  auto* fichier = new wxMenu;
  fichier->Append(wxID_OPEN, L"&Ouvrir…\tCtrl+O");
  fichier->Append(wxID_SAVE, L"&Enregistrer\tCtrl+S");
  fichier->Append(wxID_SAVEAS, L"Enregistrer &sous…\tCtrl+Shift+S");
  fichier->AppendSeparator();
  fichier->Append(wxID_EXIT, L"&Quitter");
  auto* edition = new wxMenu;
  edition->Append(ID_ANNULER, L"&Annuler\tCtrl+Z");
  edition->Append(ID_RETABLIR, L"&Rétablir\tCtrl+Y");
  auto* affichage = new wxMenu;
  affichage->Append(ID_AJUSTER, L"&Ajuster la vue\tCtrl+F");
  affichage->Append(ID_QUITTER_ESQUISSE, L"&Terminer l'esquisse\tEsc");
  affichage->AppendCheckItem(ID_ACCROCHE_GRILLE, L"&Accrocher à la grille de 1 mm");  // aussi au clic droit sur le bouton Grille
  affichage->Check(ID_ACCROCHE_GRILLE, true);
  auto* esquisse = new wxMenu;
  esquisse->Append(ID_ESQUISSE_XY, L"Nouvelle esquisse sur le plan &XY");
  esquisse->Append(ID_ESQUISSE_XZ, L"Nouvelle esquisse sur le plan X&Z");
  esquisse->Append(ID_ESQUISSE_YZ, L"Nouvelle esquisse sur le plan &YZ");
  esquisse->Append(ID_ESQUISSE_FACE, L"Nouvelle esquisse sur la &face choisie");
  auto* fonctions = new wxMenu;
  fonctions->Append(ID_EXTRUDER, L"E&xtruder l'esquisse\tCtrl+E");
  struct LigneContrainte {
    const char* type;
    const wchar_t* texte;
  };
  static const LigneContrainte lignesContrainte[] = {
      {"f1", L"&Coïncident : 2 points, ou point et courbe\tF1"},
      {"f2", L"&Horizontal ou vertical, selon la ligne\tF2"},
      {"tangent", L"&Tangent\tF3"},
      {"equal", L"É&gal\tF4"},
      {"parallel", L"&Parallèle\tF5"},
      {"perpendicular", L"P&erpendiculaire\tF6"},
      {"midpoint", L"&Milieu\tF7"},
      {"coaxial", L"C&oncentrique\tF8"},
      {"collinear", L"Co&linéaire\tF9"},
      {"symmetric", L"&Symétrique : 2 lignes et l'axe\tF10"},
      {"fix", L"&Fixe\tF12"},
      {"construction", L"Basculer en co&nstruction (touche X)"},
  };
  auto* contraintes = new wxMenu;
  int idContrainte = ID_CONTRAINTE_1;
  for (const LigneContrainte& l : lignesContrainte) {
    contraintes->Append(idContrainte, l.texte);
    const std::string type = l.type;
    Bind(wxEVT_MENU, [this, type](wxCommandEvent&) {
      vueEsquisse_->commande([&](Dessin& d) {
        if (type == "f1") d.toucheF1();
        else if (type == "f2") d.toucheF2();
        else d.poserContrainte(type);
      });
    }, idContrainte);
    Bind(wxEVT_UPDATE_UI, [this](wxUpdateUIEvent& e) { e.Enable(dessin_ != nullptr); }, idContrainte);
    idContrainte++;
  }
  auto* barre = new wxMenuBar;
  barre->Append(fichier, L"&Fichier");
  barre->Append(edition, L"&Édition");
  barre->Append(esquisse, L"E&squisse");
  barre->Append(contraintes, L"&Contraintes");
  barre->Append(fonctions, L"Fo&nctions");
  barre->Append(affichage, L"&Affichage");
  SetMenuBar(barre);
  Bind(wxEVT_MENU, &Cadre::surOuvrir, this, wxID_OPEN);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { enregistrer(); }, wxID_SAVE);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { enregistrerSous(); }, wxID_SAVEAS);
  Bind(wxEVT_UPDATE_UI, [this](wxUpdateUIEvent& e) { e.Enable(docOuvert_ && doc_.modifie()); }, wxID_SAVE);
  Bind(wxEVT_UPDATE_UI, [this](wxUpdateUIEvent& e) { e.Enable(docOuvert_); }, wxID_SAVEAS);
  Bind(wxEVT_CLOSE_WINDOW, &Cadre::surFermer, this);
  Bind(wxEVT_ACTIVATE, [this](wxActivateEvent& e) {
    e.Skip();
    if (e.GetActive()) CallAfter([this] { asmLiensFenetreActive(); });
  });
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { Close(); }, wxID_EXIT);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { annuler(); }, ID_ANNULER);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { retablir(); }, ID_RETABLIR);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) {
    if (esquisseOuverte_ >= 0) vueEsquisse_->ajuster();
    else vue_->ajuster();
  }, ID_AJUSTER);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) {
    // Échap pendant une saisie ou un tracé : abandonne cela seulement
    if (vueEsquisse_->enSaisie()) vueEsquisse_->annulerSaisie();
    else if (!vueEsquisse_->echapDessin()) quitterEsquisse();
  }, ID_QUITTER_ESQUISSE);
  Bind(wxEVT_MENU, [this](wxCommandEvent& e) { vueEsquisse_->reglerAccrocheGrille(e.IsChecked()); }, ID_ACCROCHE_GRILLE);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { creerEsquisse("XY"); }, ID_ESQUISSE_XY);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { creerEsquisse("XZ"); }, ID_ESQUISSE_XZ);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { creerEsquisse("YZ"); }, ID_ESQUISSE_YZ);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { creerEsquisse(""); }, ID_ESQUISSE_FACE);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { extruder(); }, ID_EXTRUDER);
  Bind(wxEVT_UPDATE_UI, [this](wxUpdateUIEvent& e) { e.Enable(docOuvert_); }, ID_ESQUISSE_XY, ID_ESQUISSE_FACE);
  Bind(wxEVT_UPDATE_UI, [this](wxUpdateUIEvent& e) { e.Enable(docOuvert_ && !doc_.esquisses.empty()); }, ID_EXTRUDER);
  Bind(wxEVT_UPDATE_UI, [this](wxUpdateUIEvent& e) { e.Enable(esquisseOuverte_ >= 0); }, ID_QUITTER_ESQUISSE);
  Bind(wxEVT_UPDATE_UI, [this](wxUpdateUIEvent& e) { e.Enable(!annulations_.empty()); }, ID_ANNULER);
  Bind(wxEVT_UPDATE_UI, [this](wxUpdateUIEvent& e) { e.Enable(!retablissements_.empty()); }, ID_RETABLIR);
}

void Cadre::majTitre() {
  const size_t p = doc_.chemin.find_last_of(L"\\/");
  const wxString nom(doc_.chemin.substr(p == std::wstring::npos ? 0 : p + 1));
  SetTitle((doc_.modifie() ? L"● " : L"") + nom + L" — ConceptCAD natif");
  barreHaute_->document((doc_.modifie() ? L"● " : L"") + tx(doc_.nom));
}

bool Cadre::ecrire(const std::wstring& cible) {
  retenirRecent(cible);
  faireSuivre();
  faoFaireSuivre();
  try {
    asmLiensEcrire();
    if (doc_.assemblage) {
      const nlohmann::ordered_json resolu = *doc_.assemblage;
      modifierStructure(doc_, [&](nlohmann::ordered_json& j) { j["asm"] = resolu; });
    }
    try {
      enregistrerProjet(doc_, cible);
    } catch (const FichierChangeAilleurs&) {
      wxMessageDialog q(this, L"Le fichier a changé sur le disque depuis son ouverture, peut-être enregistré depuis le navigateur.\n\nRemplacer quand même ? L'autre version sera gardée dans le fichier .bak.", L"Fichier modifié ailleurs", wxYES_NO | wxNO_DEFAULT | wxICON_WARNING);
      q.SetYesNoLabels(L"Remplacer", L"Ne rien écrire");
      if (q.ShowModal() != wxID_YES) return false;
      enregistrerProjet(doc_, cible, true);
    }
  } catch (const std::exception& e) {
    wxMessageBox(tx(e.what()) + L"\n\nLe fichier existant n'a pas été touché.", L"Enregistrement impossible", wxOK | wxICON_ERROR, this);
    return false;
  }
  secoursEffacer();
  majTitre();
  etat(L"Enregistré dans " + wxString(cible) + L".");
  return true;
}

bool Cadre::enregistrer() {
  if (!docOuvert_) return false;
  if (doc_.chemin.empty()) return enregistrerSous();  // pièce nouvelle
  ecrireEnvVue();
  return ecrire(doc_.chemin);
}

bool Cadre::enregistrerSous() {
  if (!docOuvert_) return false;
  wxFileName n(doc_.chemin);
  wxFileDialog d(this, L"Enregistrer la pièce sous", n.GetPath(), doc_.chemin.empty() ? wxString(L"Sans titre.conceptcad") : n.GetFullName(), L"Projets ConceptCAD (*.conceptcad)|*.conceptcad", wxFD_SAVE | wxFD_OVERWRITE_PROMPT);
  if (d.ShowModal() != wxID_OK) return false;
  const std::wstring cible = d.GetPath().ToStdWstring();
  // La pièce nouvelle prend le nom de son fichier (doc.name=mffName)
  if (doc_.chemin.empty()) {
    const std::string nom = wxFileName(cible).GetName().utf8_string();
    changerStructure([&](nlohmann::ordered_json& j) { j["name"] = nom; });
  }
  ecrireEnvVue();
  return ecrire(cible);
}

// Des modifications non enregistrées seraient perdues : on demande d'abord.
bool Cadre::peutAbandonner() {
  if (!docOuvert_ || proto_.actif || !doc_.modifie()) return true;
  wxMessageDialog q(this, L"Enregistrer les modifications de cette pièce ?", L"ConceptCAD natif", wxYES_NO | wxCANCEL | wxYES_DEFAULT | wxICON_QUESTION);
  q.SetYesNoCancelLabels(L"Enregistrer", L"Ne pas enregistrer", L"Annuler");
  const int r = q.ShowModal();
  if (r == wxID_YES) return enregistrer();
  return r == wxID_NO;
}

void Cadre::surFermer(wxCloseEvent& e) {
  if (e.CanVeto() && !peutAbandonner()) {
    e.Veto();
    return;
  }
  secoursEffacer();  // fermeture voulue : la question vient d'être posée
  if (atelierRendu_) atelierRendu_->fermer();  // la carte graphique pendant que tout existe encore
  Destroy();
}

void Cadre::surOuvrir(wxCommandEvent&) {
  if (!peutAbandonner()) return;
  wxFileDialog d(this, L"Ouvrir une pièce ConceptCAD", wxEmptyString, wxEmptyString, L"Projets ConceptCAD (*.conceptcad)|*.conceptcad|Tous les fichiers (*.*)|*.*", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
  if (d.ShowModal() == wxID_OK) ouvrir(d.GetPath().ToStdWstring());
}

bool Cadre::ouvrir(const std::wstring& chemin) {
  try {
    Document d = lireProjet(chemin);
    dessinModifie_ = false;  // peutAbandonner a déjà posé la question
    quitterConge();
    quitterEsquisse();
    doc_ = std::move(d);
  } catch (const std::exception& e) {
    if (!proto_.actif) wxMessageBox(tx(e.what()), L"Ouverture impossible", wxOK | wxICON_ERROR, this);
    return false;
  }
  retenirRecent(chemin);
  apresOuverture();
  if (solideCalculable_) return true;
  return false;
}

void Cadre::nouveau() {
  if (!peutAbandonner()) return;
  dessinModifie_ = false;
  quitterConge();
  quitterEsquisse();
  doc_ = projetVide();
  apresOuverture();
  etat(L"Nouveau modèle. Créez une esquisse.");
}

// La liste des fichiers ouverts ou enregistrés (mffRecent) : gardée dans les réglages de Windows, sans les essais automatiques
static std::vector<std::wstring> lireRecents() {
  std::vector<std::wstring> l;
  wxConfig c(L"ConceptCADNatif");
  for (int i = 0; i < 10; i++) {
    wxString v;
    if (c.Read(wxString::Format(L"recents/%d", i), &v) && !v.empty()) l.push_back(v.ToStdWstring());
  }
  return l;
}
static void ecrireRecents(const std::vector<std::wstring>& l) {
  wxConfig c(L"ConceptCADNatif");
  c.DeleteGroup(L"recents");
  for (size_t i = 0; i < l.size() && i < 10; i++) c.Write(wxString::Format(L"recents/%d", static_cast<int>(i)), wxString(l[i]));
}
void Cadre::retenirRecent(const std::wstring& chemin) {
  if (essaiSansBoite_ || proto_.actif || chemin.empty()) return;
  std::vector<std::wstring> l = lireRecents();
  l.erase(std::remove_if(l.begin(), l.end(), [&](const std::wstring& x) { return _wcsicmp(x.c_str(), chemin.c_str()) == 0; }), l.end());
  l.insert(l.begin(), chemin);
  ecrireRecents(l);
}
void Cadre::menuRecents() {
  const std::vector<std::wstring> l = lireRecents();
  wxMenu m;
  for (size_t i = 0; i < l.size(); i++) {
    const size_t p = l[i].find_last_of(L"\\/");
    m.Append(wxID_HIGHEST + 6000 + static_cast<int>(i), wxString(p == std::wstring::npos ? l[i] : l[i].substr(p + 1)), wxString(l[i]));
  }
  if (l.empty()) m.Append(wxID_HIGHEST + 5999, L"Aucun fichier récent")->Enable(false);
  else {
    m.AppendSeparator();
    m.Append(wxID_HIGHEST + 5998, L"✕ Vider la liste");
  }
  const int choix = choisirMenu(m);
  if (choix == wxID_HIGHEST + 5998) return ecrireRecents({});
  if (choix < wxID_HIGHEST + 6000 || choix >= wxID_HIGHEST + 6000 + static_cast<int>(l.size())) return;
  if (!peutAbandonner()) return;
  ouvrir(l[choix - wxID_HIGHEST - 6000]);
}

void Cadre::apresOuverture() {
  secoursEffacer();  // autre pièce : celle d'avant a eu sa question
  asmAlign_.reset();
  asmAnim_.Stop();
  vue_->poserMarques({});
  asmInspectFermer();
  asmLiensEtat_.clear();
  asmLiensBase_.clear();
  asmLiensNeufs_ = true;
  derEtat_.clear();
  if (!essaiMenu_) CallAfter([this] { derVerifier(false); });
  asmSolides_.clear();
  asmSel_.clear();
  asmLot_.clear();
  asmMode_ = "part";
  ruban_->modeAssemblage(false);
  forme_.Nullify();
  docOuvert_ = true;
  ajusterVue_ = true;
  solideCalculable_ = doc_.nonPrisEnCharge.empty();
  annulations_.clear();
  retablissements_.clear();
  marqueTemps_.clear();
  messagesMontres_.clear();
  majTitre();
  remplirArbre();
  lireEnvVue();
  if (!antBilan_.empty()) journalOuverture_ = antBilan_;
  if (solideCalculable_) {
    montrerRien();
    recalculer();
    return;
  }
  // Pièce dont le logiciel natif ne sait pas tout rejouer : on montre son contenu, jamais un solide faux.
  vue_->afficher(TopoDS_Shape(), true);
  montrerManques();
  etat(tx(doc_.nom) + L"  |  Solide non calculé : voir le panneau Paramètres.");
}

void Cadre::remplirArbre() {
  majChoixConfig();
  arbre_->Freeze();
  arbre_->DeleteAllItems();
  lignesFonctions_.assign(doc_.fonctions.size(), wxTreeItemId());
  lignesEsquisses_.assign(doc_.esquisses.size(), wxTreeItemId());
  carteArbre_->titre(L"Arborescence — " + tx(doc_.nom));
  const wxTreeItemId racineArbre = arbre_->AddRoot(tx(doc_.nom));
  asmSansEvenement_ = true;
  lignesOcc_.clear();
  if (asmOn()) remplirComposants(racineArbre);
  else remplirPiece(racineArbre);
  if (!filtreArbre_.empty()) filtrerArbre(racineArbre);
  asmSansEvenement_ = false;
  arbre_->Thaw();
  { auto& L = lotArbre_; L.erase(std::remove_if(L.begin(), L.end(), [&](const std::string& id) { return !lignesConstruction_.count(id) && std::none_of(doc_.fonctions.begin(), doc_.fonctions.end(), [&](const auto& f) { return f.id == id; }) && std::none_of(doc_.esquisses.begin(), doc_.esquisses.end(), [&](const auto& s) { return s.id == id; }); }), L.end()); if (!L.empty()) lotMontrer(); }
  remplirFil();
}

// Le libellé d'une fonction dans l'arbre : une répétition dit son genre, ses instances et ses sources
wxString Cadre::libelleArbre(const Fonction& f) const {
  const wxString nom = f.nom.empty() ? nomType(f) : tx(f.nom);
  if (f.type != "repeat") return nom;
  int copies = 0;
  for (const Fonction& k : doc_.fonctions)
    if (k.repeatId == f.id && (indiceMarque() < 0 || &k - doc_.fonctions.data() < indiceMarque())) copies++;
  wxString genre = L"Linéaire";
  size_t sources = 0;
  if (doc_.fonctionsJson) {
    const auto it = doc_.fonctionsJson->find(f.id);
    if (it != doc_.fonctionsJson->end()) {
      const nlohmann::ordered_json j = nlohmann::ordered_json::parse(it->second);
      const std::string m = j.value("mode", std::string());
      const auto oui = [&](const char* c) { return j.contains(c) && !j[c].is_null() && j[c] != false; };
      genre = m == "mir" ? (oui("plane2") ? L"Symétrie double" : L"Symétrie") : m == "circ" ? L"Circulaire" : m == "path" ? L"Suivant un profil" : oui("lin2") ? L"Linéaire 2 directions" : L"Linéaire";
      if (j.contains("base") && j["base"].is_array()) sources = j["base"].size();
    }
  }
  return nom + L" · " + genre + wxString::Format(L" · %d instance(s) ◀ %zu", copies, sources);
}

int Cadre::imageFonctionArbre(const Fonction& f) {
  int ruban = 1;
  wxColour c;
  bool moins = false;
  iconeFonction(f.type, f.op, f.modeFonction, f.chamfer, f.derive, ruban, c, moins);
  const std::string cle = c.GetAsString(wxC2S_HTML_SYNTAX).ToStdString() + std::to_string(ruban);
  const auto it = imagesArbre_.find(cle);
  if (it != imagesArbre_.end()) return it->second;
  wxImageList* images = arbre_->GetImageList();
  int l = 16, h = 16;
  images->GetSize(0, l, h);
  const int n = images->Add(iconeSvgComplete(iconeRubanCao(ruban), c, 16).GetBitmap(wxSize(l, h)));
  imagesArbre_[cle] = n;
  return n;
}

// treeFeatToBody : extrusion, révolution, balayage et perçage seulement. Les autres visent des faces de leur corps.
void Cadre::fonctionVersCorps(const std::string& id, const std::string& corps) {
  int i = -1;
  for (size_t k = 0; k < doc_.fonctions.size(); k++)
    if (doc_.fonctions[k].id == id) i = static_cast<int>(k);
  if (i < 0 || doc_.fonctions[i].corps == corps) return;
  const Fonction f = doc_.fonctions[i];
  const wxString nom = f.nom.empty() ? nomType(f) : tx(f.nom);
  if (f.type != "extrude" && f.type != "revolve" && f.type != "sweep" && f.type != "hole")
    return etat(wxString::Format(L"« %s » vise des faces ou arêtes de son corps : elle ne change pas de corps (seules extrusion, révolution et perçage le peuvent).", nom));
  bool verrou = false;
  changerStructure([&](nlohmann::ordered_json& d) {
    for (const auto& r : d["features"]) {
      if (r.value("type", std::string()) != "repeat" || !r.contains("base") || !r["base"].is_array()) continue;
      const bool nouveauCorps = r.value("op", std::string()) == "new";  // repIsNewBody
      if (nouveauCorps)
        for (const auto& b : r["base"])
          if (b == id) verrou = true;
    }
    if (verrou) throw anteriorite::Refus("« " + nom.utf8_string() + " » est la source d’une répétition « nouveau corps » : la changer de corps recréerait ses exemplaires.");
    for (auto& k : d["features"])
      if (k.value("id", std::string()) == id) k["body"] = corps;
  }, L"Ctrl+Z : annuler.");
}

void Cadre::remplirPiece(const wxTreeItemId& racine) {
  // Le ⚠ des liens vers une fonction placée plus loin (antTag), relu seulement si la structure a changé
  if (antPour_ != doc_.fonctionsJson || !antLu_) {
    antPour_ = doc_.fonctionsJson;
    antLu_ = true;
    antAvert_.clear();
    antBilan_.clear();
    try {
      const nlohmann::ordered_json j = documentJson(doc_);
      antAvert_ = anteriorite::avertissements(j);
      antBilan_ = anteriorite::bilanOuverture(j);
    } catch (const std::exception&) {
    }
  }
  const wxColour grise(0x78, 0x78, 0x7d);
  const wxTreeItemId origine = arbre_->AppendItem(racine, L"Origine", 11);
  arbre_->SetItemBold(origine);
  arbre_->SetItemTextColour(arbre_->AppendItem(origine, L"Repère · X Y Z + plans", 7), grise);
  arbre_->SetItemTextColour(arbre_->AppendItem(origine, L"Plan XY · dessus", 4, -1, new LienArbre(false, -1, "XY")), grise);
  arbre_->SetItemTextColour(arbre_->AppendItem(origine, L"Plan XZ · face", 5, -1, new LienArbre(false, -1, "XZ")), grise);
  arbre_->SetItemTextColour(arbre_->AppendItem(origine, L"Plan YZ · côté", 6, -1, new LienArbre(false, -1, "YZ")), grise);
  arbre_->AppendItem(origine, L"Axe X · droite", 8, -1, new LienArbre(false, -1, "X"));
  arbre_->AppendItem(origine, L"Axe Y · arrière", 9, -1, new LienArbre(false, -1, "Y"));
  arbre_->AppendItem(origine, L"Axe Z · haut", 10, -1, new LienArbre(false, -1, "Z"));
  arbre_->Expand(origine);
  lignesConstruction_.clear();
  {  // cgTreeModel : après l'origine, sans ce qui vient après le marqueur
    std::vector<const ElementConstruction*> L;
    for (const ElementConstruction& e : doc_.construction)
      if (indiceMarque() < 0 || rangConstruction(doc_, e) < indiceMarque()) L.push_back(&e);
    if (!L.empty()) {
      const wxTreeItemId sec = arbre_->AppendItem(racine, wxString::Format(L"Construction (%zu)", L.size()), 11);
      arbre_->SetItemBold(sec);
      for (const ElementConstruction* e : L) {
        const std::string alerte = e->j.value("st", std::string()) == "warn" ? " ⚠" : "";
        const wxTreeItemId n = arbre_->AppendItem(sec, tx(std::string(iconeConstruction(e->kind)) + " " + libelleConstruction(*e) + alerte), e->kind == "plane" ? 4 : e->kind == "axis" ? 10 : 7, -1, new LienArbre(false, -1, "", "", e->id));
        lignesConstruction_[e->id] = n;
        arbre_->SetItemState(n, e->visible ? 0 : 1);
        if (!e->visible) arbre_->SetItemTextColour(n, grise);
      }
      arbre_->Expand(sec);
    }
  }
  size_t nbEsquisses = 0;
  for (const Esquisse& s : doc_.esquisses) nbEsquisses += !s.fao && !esquisseCopieRepetition(doc_, s.id);
  const wxTreeItemId esquisses = arbre_->AppendItem(racine, wxString::Format(L"Esquisses (%zu)", nbEsquisses), 0);
  arbre_->SetItemBold(esquisses);
  for (size_t i = 0; i < doc_.esquisses.size(); i++) {
    if (doc_.esquisses[i].fao || esquisseCopieRepetition(doc_, doc_.esquisses[i].id)) continue;
    const std::string& n = doc_.esquisses[i].nom;
    lignesEsquisses_[i] = arbre_->AppendItem(esquisses, n.empty() ? wxString(tx(doc_.esquisses[i].id)) : tx(n), 0, -1, new LienArbre(false, static_cast<int>(i)));
    arbre_->SetItemState(lignesEsquisses_[i], doc_.esquisses[i].visible ? 0 : 1);
    if (!doc_.esquisses[i].visible) arbre_->SetItemTextColour(lignesEsquisses_[i], grise);
  }
  if (const int m = indiceMarque(); m >= 0) {  // le temps est bloqué : un clic rejoue tout
    const wxTreeItemId t = arbre_->AppendItem(racine, wxString::Format(L"⏱ Temps bloqué avant « %s » — %d fonction(s) rejouée(s) · clic = rejouer tout", libelleArbre(doc_.fonctions[m]), m), -1, -1, new LienArbre(false, -1, "temps"));
    arbre_->SetItemTextColour(t, th(wxColour(0xe8, 0xb3, 0x4a)));
  }
  for (size_t c = 0; c < doc_.corps.size(); c++) {
    const bool corpsActif = doc_.corps[c] == doc_.corpsActif;
    const wxString nomCorps = c < doc_.nomsCorps.size() && !doc_.nomsCorps[c].empty() ? tx(doc_.nomsCorps[c]) : wxString::Format(L"Corps %zu", c + 1);
    const wxTreeItemId corps = arbre_->AppendItem(racine, nomCorps, 3, -1, new LienArbre(false, -1, "", doc_.corps[c]));
    arbre_->SetItemBold(corps);
    if (corpsActif) arbre_->SetItemTextColour(corps, th(wxColour(0x0a, 0x84, 0xff)));
    const bool corpsMasque = std::find(doc_.corpsMasques.begin(), doc_.corpsMasques.end(), doc_.corps[c]) != doc_.corpsMasques.end();
    arbre_->SetItemState(corps, corpsMasque ? 1 : 0);
    if (corpsMasque) arbre_->SetItemTextColour(corps, grise);
    int nbDuCorps = 0;
    for (size_t i = 0; i < doc_.fonctions.size(); i++) {
      const Fonction& f = doc_.fonctions[i];
      const bool ici = f.corps == doc_.corps[c] || (c == 0 && std::find(doc_.corps.begin(), doc_.corps.end(), f.corps) == doc_.corps.end());
      if (!ici || !f.repeatId.empty()) continue;  // les copies vont sous leur répétition
      if (indiceMarque() >= 0 && static_cast<int>(i) >= indiceMarque()) continue;  // tlLocked
      const bool alerte = antAvert_.count(f.id) > 0;
      const wxTreeItemId n = arbre_->AppendItem(corps, libelleArbre(f) + (alerte ? L" ⚠" : L""), imageFonctionArbre(f), -1, new LienArbre(true, static_cast<int>(i)));
      lignesFonctions_[i] = n;
      nbDuCorps++;
      if (alerte) arbre_->SetItemTextColour(n, wxColour(0xff, 0x9f, 0x0a));
      arbre_->SetItemState(n, f.visible ? 0 : 1);
      if (!f.visible) arbre_->SetItemTextColour(n, grise);
      if (f.type != "repeat") continue;
      for (const Fonction& k : doc_.fonctions) {
        if (k.repeatId != f.id) continue;
        const wxTreeItemId e = arbre_->AppendItem(n, k.nom.empty() ? nomType(k) : tx(k.nom), imageFonctionArbre(k), -1, new LienArbre(true, static_cast<int>(i)));
        if (!k.visible) arbre_->SetItemTextColour(e, grise);
      }
    }
    arbre_->SetItemText(corps, nomCorps + (corpsActif ? L" ●" : L"") + wxString::Format(L" · %d fonction%s", nbDuCorps, nbDuCorps > 1 ? L"s" : L""));
    arbre_->Expand(corps);
  }
  arbre_->Expand(esquisses);
}

void Cadre::selectionVide() {
  const wxTreeItemId l = arbre_->GetSelection();
  if (l.IsOk()) arbre_->Unselect();
  montrerRien();
}

void Cadre::montrerRien() {
  dynSel_.clear();
  dynPanneau(-1);
  if ((asmMode_ == "asm" || asmInspect_) && doc_.assemblage && esquisseOuverte_ < 0) return montrerAssemblage();
  if (!boutonsAsm_.empty()) poserBoutonsPanneau({});
  fonctionMontree_ = -1;
  props_->Clear();
  props_->CenterSplitter();
  if (docOuvert_) lectureSeule(props_, L"Nom du document", tx(doc_.nom));
}

void Cadre::montrerManques() {
  fonctionMontree_ = -1;
  props_->Clear();
  props_->Append(new wxPropertyCategory(L"Pas encore repris dans le natif"));
  int n = 0;
  for (const std::string& m : doc_.nonPrisEnCharge) lectureSeule(props_, wxString::Format("%d", ++n), tx(m));
  props_->SetSplitterPosition(FromDIP(30));  // ces lignes n'ont pas de nom : toute la largeur pour le texte
}

void Cadre::montrerFonction(int i) {
  dynSelection(i);
  dynPanneau(i);
  const Fonction& f = doc_.fonctions[i];
  props_->Clear();
  props_->CenterSplitter();
  props_->Append(new wxPropertyCategory(L"Fonction"));
  lectureSeule(props_, L"Nom", tx(f.nom));
  lectureSeule(props_, L"Type", nomType(f));
  if (!f.visible) lectureSeule(props_, L"État", L"Désactivée");
  fonctionMontree_ = -1;
  ficheId_.clear();
  if ((f.type != "xfillet" && f.type != "extrude") || f.kw || !f.kwKey.empty()) return montrerFiche(i);
  if (f.type == "xfillet") {
    lectureSeule(props_, L"Arêtes tangentes", f.tangent != 0 ? L"Suivies" : L"Non suivies");
    if (f.visible && f.congeTotal > 0 && f.congeTrouvees < f.congeTotal) lectureSeule(props_, L"Trouvées", wxString::Format(L"%d sur %d", f.congeTrouvees, f.congeTotal));
    if (!f.congeAjuste.empty()) lectureSeule(props_, L"Ajusté", tx(f.congeAjuste));
    if (!f.congeErreur.empty()) lectureSeule(props_, L"Erreur", tx(f.congeErreur));
    return montrerFiche(i);
  }
  if (f.type != "extrude") return;
  const Esquisse* e = doc_.esquisse(f.esquisse);
  lectureSeule(props_, L"Esquisse", tx(e && !e->nom.empty() ? e->nom : f.esquisse));
  if (e && f.repeatId.empty()) {  // extProfPanel
    try {
      const Trace tr = tracerContours(*e);
      std::vector<ZoneEsq> Z = zonesEsquisse(*e, tr);
      completerZones(*e, tr, Z);
      wxString t = L"⚠ aucune zone fermée dans l’esquisse";
      if (!Z.empty()) {
        std::set<int> pris;
        int perdues = 0;
        for (const auto& q : f.profils) {
          const int k = zoneEn(Z, q[0], q[1]);
          if (k >= 0) pris.insert(k);
          else perdues++;
        }
        if (f.profils.empty())
          for (size_t k = 0; k < Z.size(); k++)
            if (Z[k].parDefaut) pris.insert(static_cast<int>(k));
        const size_t k = pris.size();
        t = wxString::Format(L"▦ %zu zone%s sur %zu%s", k, k > 1 ? L"s" : L"", Z.size(), f.profils.empty() ? L" (auto)" : L"");
        if (perdues) t += wxString::Format(L" — ⚠ %d zone%s perdue%s", perdues, perdues > 1 ? L"s" : L"", perdues > 1 ? L"s" : L"");
      }
      lectureSeule(props_, L"Profil", t);
    } catch (const std::exception&) {
    }
    if (!f.profils.empty()) {
      const std::string idZ = f.id;
      poserBoutonsPanneau({{L"↺ Auto", [this, idZ, i] {
        changerStructure([&](nlohmann::ordered_json& d) {
          for (auto& k : d["features"])
            if (k.value("id", std::string()) == idZ) k.erase("profiles");
        });
        if (i < static_cast<int>(doc_.fonctions.size())) montrerFonction(i);
      }}});
    }
  }
  if (f.visible && solideCalculable_ && (doc_.profondeurModifiable(i) || (f.upto && f.repeatId.empty()))) {
    // Le panneau de l'extrusion du navigateur : opération, direction et étendue sont des boutons (dynPanneau)
    if (f.upto) {
      lectureSeule(props_, L"Face cible", f.uptoFace ? wxString::Format(L"🎯 face choisie — %g mm", std::abs(f.distance)) : wxString(L"🎯 cliquez une face dans la vue"));
      const std::string idF = f.id;
      poserBoutonsPanneau({{L"🎯 Choisir une autre face", [this, idF] { uptoChoisir(idF); }}});
    } else if (!f.through) props_->Append(new wxStringProperty(f.mid ? L"Course totale (mm)" : L"Distance (mm)", PROP_PROFONDEUR, wxString::Format("%.10g", std::abs(f.distance))));
    props_->Append(new wxStringProperty(L"Dépouille (°)", L"depouille", wxString::Format("%.10g", f.draft)));
    fonctionMontree_ = i;
  } else if (f.through) {
    lectureSeule(props_, L"Profondeur", L"À travers tout");
  } else {
    lectureSeule(props_, L"Profondeur (mm)", wxString::Format("%g", f.distance));
    if (f.visible && solideCalculable_) lectureSeule(props_, L"Modification", L"Pas encore : une esquisse posée de biais suit cette profondeur");
  }
}

void Cadre::montrerEsquisse(int i) {
  dynSel_.clear();
  dynPanneau(-1);
  const Esquisse& s = doc_.esquisses[i];
  fonctionMontree_ = -1;
  props_->Clear();
  props_->CenterSplitter();
  props_->Append(new wxPropertyCategory(L"Esquisse"));
  lectureSeule(props_, L"Nom", tx(s.nom));
  lectureSeule(props_, L"Plan", tx(s.plan));
  lectureSeule(props_, L"Points", wxString::Format("%zu", s.points.size()));
  lectureSeule(props_, L"Éléments", wxString::Format("%zu", s.entites.size()));
  lectureSeule(props_, L"Contraintes", wxString::Format("%zu", s.contraintes.size()));
  lectureSeule(props_, L"Cotes", wxString::Format("%zu", s.cotes.size()));
  const std::string raison = esquisseFigee(doc_, i);
  if (!raison.empty() && !Solveur(s).coteConvertie()) lectureSeule(props_, L"Modification", L"Pas encore : " + tx(raison));
}

// Double-clic dans l'arbre : même repère que le navigateur.
void Cadre::entrerEsquisse(int i) {
  quitterConge();
  if (atelier_ != Atelier::CAO) changerAtelier(Atelier::CAO);
  // skGapToAngle : un entraxe entre deux lignes non parallèles devient une cote d'angle à la valeur mesurée, rien ne bouge
  wxString coteChangee;
  try {
    const Solveur S(doc_.esquisses[i]);
    if (S.coteConvertie() && S.prisEnCharge()) {
      Esquisse apres = doc_.esquisses[i];
      S.recopierDans(apres);
      const std::string idE = apres.id;
      int nb = 0;
      changerStructure([&](nlohmann::ordered_json& d) {
        for (auto& sk : d["sketches"]) {
          if (sk.value("id", std::string()) != idE || !sk.contains("dims")) continue;
          for (auto& x : sk["dims"])
            for (const Cote& c : apres.cotes)
              if (c.id == x.value("id", std::string()) && c.type == "angle" && x.value("type", std::string()) == "gap") {
                x["type"] = "angle";
                x["value"] = c.value;
                x["ccw"] = c.ccw;
                x.erase("sgn");
                x.erase("sl");
                x.erase("orient");
                x.erase("w");
                nb++;
              }
        }
      });
      if (nb) coteChangee = wxString::Format(L"%d cote(s) d’entraxe entre lignes non parallèles changée(s) en cote(s) d’angle (valeur mesurée).", nb);
    }
  } catch (const std::exception&) {
  }
  if (solideCalculable_) {
    wxBusyCursor attente;
    nommerProjections(doc_);
  }
  const Esquisse& s = doc_.esquisses[i];
  esquisseOuverte_ = i;
  dessinerEsquisses();
  figee_ = esquisseFigee(doc_, i);
  edition_ = figee_.empty() ? std::make_unique<Edition>(s) : nullptr;
  esquissesEntree_ = doc_.esquisses;
  annulationsEntree_ = annulations_.size();
  brancherDessin();
  modeEsquisse(true);
  vueEsquisse_->montrer(&s, formeAnterieure(i));
  vueEsquisse_->SetFocus();
  montrerEsquisse(i);
  messageEsquisse_.clear();
  rafraichirEsquisse(true);
  wxString t = L"Esquisse « " + tx(s.nom) + (figee_.empty() ? L" ». Outils en haut pour dessiner. Double-clic sur une cote pour la changer, sur un élément pour le coter. Suppr : effacer." : L" » en lecture seule : " + tx(figee_) + L".") + L" Clic droit : déplacer. Molette : zoom. Échap : outil Sélection, puis terminer.";
  if (vueEsquisse_->nonDessines() > 0) t += wxString::Format(L"  |  ⚠ %d élément(s) pas encore dessiné(s).", vueEsquisse_->nonDessines());
  if (!coteChangee.IsEmpty()) t += L"  |  " + coteChangee;
  etat(t);
  // Pour natif/mesures/verifier-cote.ps1 : où se trouve chaque valeur à l'écran
  if (const wchar_t* chemin = _wgetenv(L"CONCEPTCAD_JOURNAL_ETAT")) {
    vueEsquisse_->Update();
    if (FILE* f = _wfopen(chemin, L"ab")) {
      for (const Cote& c : s.cotes) {
        wxPoint p;
        if (vueEsquisse_->positionCote(c.id, p)) {
          p = vueEsquisse_->ClientToScreen(p);
          fprintf(f, "cote %s %d %d\n", c.id.c_str(), p.x, p.y);
        }
      }
      fclose(f);
    }
  }
}

bool Cadre::demandeCote(const Cote& c, wxString& texte) {
  if (c.ref && dessin_) {
    if (!dessin_->rendrePilotante(c.id)) return false;
    majTitre();
  }
  const std::string raison = figee_.empty() ? coteFigee(c) : figee_;
  if (!raison.empty()) {
    etat(L"Cote non modifiable : " + tx(raison) + L".");
    return false;
  }
  // parDimInputText : « nom = expression », en degrés et en diamètres ; le fichier a des radians et des rayons
  texte = tx(parTexteSaisie(c));
  saisieDepart_ = texte;
  return true;
}

// skDimEditPick : pendant la saisie, le nom d'une autre cote, qui est nommée d<n> au besoin
bool Cadre::nomCotePourSaisie(const std::string& id, wxString& nom) {
  if (esquisseOuverte_ < 0) return false;
  Esquisse& s = doc_.esquisses[esquisseOuverte_];
  const auto it = std::find_if(s.cotes.begin(), s.cotes.end(), [&](const Cote& c) { return c.id == id; });
  if (it == s.cotes.end()) return false;
  if (it->ref) {
    messageBandeau(L"Une cote de RÉFÉRENCE mesure sans piloter : elle ne sert pas de paramètre.");
    return false;
  }
  std::string nm = it->nom;
  if (nm.empty()) {
    ModifCote m;
    m.esquissesAvant = doc_.esquisses;
    nm = parNomAutomatique(doc_, *it);
    if (nm.empty()) return false;
    m.esquissesApres = doc_.esquisses;
    annulations_.push_back(std::move(m));
    retablissements_.clear();
    majTitre();
    vueEsquisse_->Refresh();
  }
  nom = tx(nm);
  messageBandeau(L"« " + nom + L" » inséré dans la saisie : Entrée pour valider.");
  return true;
}

ActionsFormules Cadre::actionsFormules() {
  ActionsFormules a;
  a.document = [this]() -> Document& { return doc_; };
  a.changer = [this](const std::function<std::string()>& f) { return changerFormules(f); };
  a.reglerCote = [this](size_t j, const std::string& id, const std::string& t) { return reglerCoteListe(j, id, t); };
  a.menuDerivees = [this](wxWindow* ou) { derMenu(ou); };
  a.configurer = [this](const std::function<void(nlohmann::ordered_json&)>& c, const std::string& id) { return configurer(c, id); };
  return a;
}

std::string Cadre::reglerCoteListe(size_t j, const std::string& id, const std::string& texte) {
  // parSetDim : l'esquisse est résolue, et une valeur impossible est refusée comme dans l'esquisse
  const std::string fige = esquisseFigee(doc_, j);
  if (!fige.empty()) return fige;
  std::string raison;
  if (static_cast<int>(j) == esquisseOuverte_ && edition_) {
    saisirCoteTexte(doc_, j, *edition_, id, texte, raison);
    return raison;
  }
  Edition ed(doc_.esquisses[j]);
  saisirCoteTexte(doc_, j, ed, id, texte, raison);
  return raison;
}

// cfgApply et les changements de la table : tout le document revient en arrière si une conséquence est refusée
std::string Cadre::configurer(const std::function<void(nlohmann::ordered_json&)>& changement, const std::string& activer) {
  if (esquisseOuverte_ >= 0) return std::string(wxString(L"Quittez d’abord l’esquisse.").utf8_str());
  const auto avant = std::make_shared<Document>(doc_);
  const EtatFormules etatAvant(doc_);
  std::string message;
  try {
    wxBusyCursor attente;
    modifierStructure(doc_, [&](nlohmann::ordered_json& j) {
      if (changement) changement(j);
      if (!activer.empty()) cfgStructureActive(j, activer);
      cfgRanger(j);
    });
    if (!activer.empty()) {
      const std::vector<std::string> absents = cfgPoserValeurs(doc_, activer);
      std::string raison;
      if (!appliquerFormules(doc_, etatAvant, -1, nullptr, raison)) throw std::runtime_error(raison);
      message = cfgMessage(doc_, activer, absents);
    }
  } catch (const std::exception& e) {
    doc_ = *avant;
    return e.what();
  }
  doc_.structureTouchee = false;
  ModifCote m;
  m.docAvant = avant;
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  suivreCopies();
  apresStructure();
  if (!message.empty()) etat(tx(message));
  return "";
}

// Les raccourcis de l'application (src/90-10-selection-mesure, src/95-toolbar, src/96-aide-raccourcis) ; jamais pendant une saisie
bool Cadre::raccourciGlobal(int code, wchar_t caractere, bool ctrl, bool alt, bool maj, bool repete) {
  const wxWindow* f = FindFocus();
  if (dynamic_cast<const wxTextCtrl*>(f) || dynamic_cast<const wxChoice*>(f) || dynamic_cast<const wxComboBox*>(f)) return false;
  if (!IsActive() && !essaiMenu_) return false;
  const bool enEsquisse = esquisseOuverte_ >= 0;
  if (ctrl && maj && !alt && code == 'R') {
    if (barreHaute_->surRegenerer && docOuvert_ && !enEsquisse) barreHaute_->surRegenerer();
    return true;
  }
  if (ctrl || alt) return false;
  if (caractere == L'?' || (code == WXK_F1 && !enEsquisse)) {
    ouvrirAide(this);
    return true;
  }
  if (enEsquisse) return false;
  if (code == WXK_F5 && (atelier_ == Atelier::CAO || atelier_ == Atelier::FAO)) {
    vue_->vueInitiale();
    vue_->ajuster();
    return true;
  }
  if (atelier_ != Atelier::CAO || maj || repete || enChoix() || pioche_ || !docOuvert_) return false;
  const wxString nom = code == 'E' ? L"Extrusion" : code == 'H' ? L"Perçage" : code == 'R' ? L"Révolution" : code == 'F' ? L"Congé" : code == 'C' ? L"Chanfrein" : code == 'M' ? L"Répétition" : L"";
  if (nom.empty()) return false;
  boutonRuban(Atelier::CAO, nom);
  return true;
}

// cfgTreeRow : le sélecteur en tête de l'arbre, seulement s'il y a une table
void Cadre::majChoixConfig() {
  if (!choixConfig_) return;
  const nlohmann::ordered_json* t = cfgDe(doc_);
  choixConfig_->Clear();
  if (t) {
    int choisi = -1;
    const bool actif = (*t)["active"].is_string();
    if (!actif) {
      choixConfig_->Append(L"—");
      choisi = 0;
    }
    for (const auto& r : (*t)["rows"]) {
      if (actif && r["id"] == (*t)["active"]) choisi = static_cast<int>(choixConfig_->GetCount());
      choixConfig_->Append(tx(r["name"].get<std::string>()));
    }
    choixConfig_->SetSelection(choisi);
  }
  const bool montrer = t != nullptr;
  if (ligneConfig_ && carteArbre_->contenu()->IsShown(ligneConfig_) != montrer) {
    carteArbre_->contenu()->Show(ligneConfig_, montrer);
    carteArbre_->contenu()->Layout();
    carteArbre_->Layout();
  }
}

std::string Cadre::changerFormules(const std::function<std::string()>& f) {
  const EtatFormules avant(doc_);
  const auto docComplet = std::make_shared<Document>(doc_);
  doc_.structureTouchee = false;
  ModifCote m;
  m.esquissesAvant = doc_.esquisses;
  m.avecFonctions = true;
  m.fonctionsAvant = doc_.fonctions;
  m.avecFormules = true;
  m.paramsAvant = doc_.params;
  m.porteursAvant = doc_.porteurs;
  std::string raison = f();
  if (!raison.empty()) {
    avant.poser(doc_);
    return raison;
  }
  {
    wxBusyCursor attente;
    if (!appliquerFormules(doc_, avant, esquisseOuverte_, edition_.get(), raison)) return raison;
  }
  m.esquissesApres = doc_.esquisses;
  m.fonctionsApres = doc_.fonctions;
  m.paramsApres = doc_.params;
  m.porteursApres = doc_.porteurs;
  if (doc_.structureTouchee) {
    doc_.structureTouchee = false;
    m = ModifCote();
    m.docAvant = docComplet;
  }
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  majTitre();
  suivreCopies();
  recalculer();
  if (esquisseOuverte_ >= 0) {
    vueEsquisse_->majPiece(formeAnterieure(esquisseOuverte_));
    rafraichirEsquisse(false);
    vueEsquisse_->Refresh();
  }
  if (miniParams_->IsShown()) CallAfter([this] { miniParams_->rafraichir(); });
  return "";
}

void Cadre::basculerMiniParametres() {
  const bool montrer = !miniParams_->IsShown();
  if (montrer) miniParams_->rafraichir();
  miniParams_->Show(montrer);
  centre_->Layout();
  placerScene();
}

void Cadre::saisieCote(const std::string& id, const wxString& texte) {
  if (esquisseOuverte_ < 0 || !edition_) return;
  Esquisse& s = doc_.esquisses[esquisseOuverte_];
  const auto it = std::find_if(s.cotes.begin(), s.cotes.end(), [&](const Cote& c) { return c.id == id; });
  if (it == s.cotes.end()) return;
  // parDimCommit : « [nom =] valeur|expression ». Refus au bandeau, comme le navigateur. Le texte laissé tel quel ne change rien.
  wxString t = texte;
  t.Trim(true).Trim(false);
  if (t == saisieDepart_) return;
  ModifCote m;
  m.esquissesAvant = doc_.esquisses;
  m.avecFonctions = true;
  m.fonctionsAvant = doc_.fonctions;
  m.avecFormules = true;
  m.paramsAvant = doc_.params;
  m.porteursAvant = doc_.porteurs;
  std::string raison;
  const auto docComplet = std::make_shared<Document>(doc_);
  doc_.structureTouchee = false;
  {
    wxBusyCursor attente;
    if (!saisirCoteTexte(doc_, esquisseOuverte_, *edition_, id, std::string(t.utf8_str()), raison)) {
      messageBandeau(L"⛔ " + tx(raison));
      vueEsquisse_->Refresh();
      return;
    }
  }
  m.esquissesApres = doc_.esquisses;
  m.fonctionsApres = doc_.fonctions;
  m.paramsApres = doc_.params;
  m.porteursApres = doc_.porteurs;
  if (doc_.structureTouchee) {
    doc_.structureTouchee = false;
    m = ModifCote();
    m.docAvant = docComplet;
  }
  Esquisse& s2 = doc_.esquisses[esquisseOuverte_];  // le document a pu être relu
  if (const auto cote = std::find_if(s2.cotes.begin(), s2.cotes.end(), [&](const Cote& c) { return c.id == id; }); cote != s2.cotes.end() && !cote->nom.empty())
    messageBandeau(L"Cote nommée « " + tx(cote->nom) + L" » : utilisable dans les autres cotes (ƒx).");
  if (miniParams_->IsShown()) CallAfter([this] { miniParams_->rafraichir(); });
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  majTitre();
  recalculer();
  vueEsquisse_->majPiece(formeAnterieure(esquisseOuverte_));
}

// Comme le navigateur : derrière l'esquisse, le solide d'avant la fonction qui s'en sert, pas le résultat de l'esquisse elle-même
TopoDS_Shape Cadre::formeAnterieure(int i) {
  if (!solideCalculable_) return forme_;
  const int n = fonctionConsommatrice(doc_, doc_.esquisses[i].id);
  if (n < 0) return forme_;
  if (n == 0) return TopoDS_Shape();
  try {
    return rejouer(doc_, n).forme;
  } catch (const std::exception&) {
  } catch (const Standard_Failure&) {
  }
  return forme_;
}

void Cadre::modeEsquisse(bool oui) {
  if (enModeEsquisse_ == oui) return;
  enModeEsquisse_ = oui;
  Freeze();
  // Comme dans le navigateur : la barre du haut reste, le ruban, l'arbre, le fil et les paramètres laissent la place
  scene_->Show(!oui);
  ruban_->Show(!oui && atelier_ != Atelier::RENDU);
  colonneDroite_->ShowItems(!oui);
  vueEsquisse_->Show(oui);
  barreEsquisse_->Show(oui);
  panneauEsquisse_->Show(oui);
  bandeauEsquisse_->Show(oui);
  if (!oui) panneauEsquisse_->vider();
  centre_->Layout();
  placerScene();
  Thaw();
}

void Cadre::messageBandeau(const wxString& m) {
  messageEsquisse_ = m;
  messageNeuf_ = true;
  bandeauEsquisse_->montrer(m);
  etat(m);
}

// Le calcul de santé et de libertés attend que le bouton de la souris soit relâché : le glisser reste fluide.
void Cadre::rafraichirEsquisse(bool calculer) {
  if (esquisseOuverte_ < 0) return;
  if (calculer) infosPerimees_ = true;
  const Esquisse& s = doc_.esquisses[esquisseOuverte_];
  Dessin* d = vueEsquisse_->dessin();
  bool refaire = false;
  if (infosPerimees_ && !vueEsquisse_->boutonEnfonce()) {
    infosPerimees_ = false;
    infosEsquisse_ = infosDe(s);
    vueEsquisse_->poserInfos(infosEsquisse_);
    refaire = true;
    if (!messageNeuf_) messageEsquisse_.clear();
  }
  messageNeuf_ = false;
  barreEsquisse_->lectureSeule(d == nullptr);
  barreEsquisse_->outilActif(d ? d->outil() : Dessin::SELECTION);
  barreEsquisse_->grilleActive(vueEsquisse_->grilleVisible());
  // sketchFaceLabel
  wxString plan = tx(s.plan);
  if (s.plan == "FACE") plan = wxString::Format(L"FACE @(%.1f, %.1f, %.1f)", s.o[0], s.o[1], s.o[2]) + (s.hote.nom.empty() ? wxString() : L" · " + tx(s.hote.nom));
  const wxString nomAffiche = s.nom.empty() ? tx(s.id) : tx(s.nom);
  // Le panneau ne se refait que s'il a changé : pas à chaque mouvement de la souris
  std::string signature = d ? std::to_string(d->outil()) : "-";
  if (d)
    for (const Dessin::Choix& c : d->selection()) signature += "|" + std::to_string(c.sorte) + c.id;
  if (refaire || signature != signaturePanneau_) {
    signaturePanneau_ = signature;
    panneauEsquisse_->montrer(L"Esquisse — " + nomAffiche + L" (plan " + plan + L")", &s, d, infosEsquisse_, figee_);
  }
  if (!figee_.empty()) bandeauEsquisse_->montrer(L"Lecture seule : " + tx(figee_) + L".");
  else if (!messageEsquisse_.empty()) bandeauEsquisse_->montrer(messageEsquisse_);
  else bandeauEsquisse_->montrer(tx(statutEsquisse(s, infosEsquisse_)));
}

// Le dessin vit sur l'édition du moment ; le geste qui va modifier l'esquisse se note d'abord pour l'annulation.
void Cadre::brancherDessin() {
  panneauEsquisse_->vider();
  signaturePanneau_.clear();
  infosPerimees_ = true;
  vueEsquisse_->poserDessin(nullptr);
  dessin_.reset();
  if (esquisseOuverte_ < 0 || !edition_) return;
  dessin_ = std::make_unique<Dessin>(doc_.esquisses[esquisseOuverte_], *edition_);
  dessin_->avantModif = [this] {
    ModifCote m;
    m.esquissesAvant = doc_.esquisses;
    annulations_.push_back(std::move(m));
    retablissements_.clear();
    dessinModifie_ = true;
  };
  dessin_->annulerPas = [this] {
    if (!annulations_.empty()) annulations_.pop_back();
  };
  dessin_->surMessage = [this](const std::string& m) { messageBandeau(tx(m)); };
  dessin_->esquisses = &doc_.esquisses;
  dessin_->nomsProj = &doc_.nomsProj;
  dessin_->nomsArete = &doc_.nomsArete;
  dessin_->nomsIsect = &doc_.nomsIsect;
  auto sections = std::make_shared<std::unique_ptr<SectionsEsquisse>>();
  const auto lesSections = [this, sections]() -> SectionsEsquisse& {
    if (!*sections) *sections = std::make_unique<SectionsEsquisse>(doc_, esquisseOuverte_);
    return **sections;
  };
  dessin_->sectionsCandidates = [lesSections]() -> const std::vector<CourbeSection>* { return &lesSections().candidates(); };
  dessin_->sectionsDe = [lesSections](const SourceIntersection& s, std::vector<CourbeSection>& L, SourceIntersection& r) { return lesSections().courbesDe(s, L, r); };
  dessin_->aretes3D = [this, liste = std::make_shared<std::vector<Dessin::Arete3D>>(), faite = std::make_shared<bool>(false)]() -> const std::vector<Dessin::Arete3D>* {
    if (!*faite) {
      *faite = true;
      for (AreteProjetable& a : aretesPourProjeter(doc_, esquisseOuverte_)) liste->push_back({a.mid, std::move(a.pts), std::string()});
      if (doc_.assemblage)  // asmSkExtLists : les arêtes des autres instances
        for (assemblage::ListeExterne& L : assemblage::listesExternes(*doc_.assemblage, asmSolides_)) {
          const std::string ext = L.ext.dump();
          for (AreteListee& e : L.aretes) liste->push_back({e.mid, std::move(e.pts), ext});
        }
    }
    return liste->empty() ? nullptr : liste.get();
  };
  vueEsquisse_->surDessinChange = [this] {
    majTitre();
    infosPerimees_ = true;
  };
  vueEsquisse_->poserDessin(dessin_.get());
}

void Cadre::faireSuivre() {
  if (!dessinModifie_) return;
  dessinModifie_ = false;
  if (esquisseOuverte_ < 0) return;
  wxBusyCursor attente;
  suivreEsquisses(doc_, esquisseOuverte_);
  recalculer();
  vueEsquisse_->majPiece(formeAnterieure(esquisseOuverte_));
}

void Cadre::poserEsquisses(const std::vector<Esquisse>& v) {
  if (v.size() != doc_.esquisses.size()) {  // création annulée ou rétablie : les adresses changent, on revient à la pièce
    dessinModifie_ = false;
    if (esquisseOuverte_ >= 0) {
      // La vue lâche d'abord l'esquisse : sinon le retrait des esquisses vides toucherait à ce qu'on va remplacer
      vueEsquisse_->poserDessin(nullptr);
      dessin_.reset();
      edition_.reset();
      esquisseOuverte_ = -1;
      vueEsquisse_->montrer(nullptr, TopoDS_Shape());
      modeEsquisse(false);
    }
    doc_.esquisses = v;
    remplirArbre();
    montrerRien();
    majTitre();
    recalculer();
    vue_->Refresh();
    return;
  }
  doc_.esquisses = v;  // même taille : l'esquisse montrée ne change pas d'adresse
  dessinModifie_ = false;  // ces esquisses ont déjà suivi, ou seront remises à jour au prochain geste
  if (esquisseOuverte_ >= 0) {
    const Dessin::Outil outil = dessin_ ? dessin_->outil() : Dessin::SELECTION;  // Ctrl+Z garde l'outil, comme le navigateur
    vueEsquisse_->poserDessin(nullptr);
    dessin_.reset();
    edition_ = figee_.empty() ? std::make_unique<Edition>(doc_.esquisses[esquisseOuverte_]) : nullptr;
    brancherDessin();
    if (dessin_) vueEsquisse_->commande([outil](Dessin& d) { d.choisirOutil(outil); });
  }
  majTitre();
  recalculer();
  if (esquisseOuverte_ >= 0) {
    vueEsquisse_->majPiece(formeAnterieure(esquisseOuverte_));
    rafraichirEsquisse(true);
  }
}

void Cadre::capturerEsquisses(const std::wstring& dossier) {
  for (size_t i = 0; i < doc_.esquisses.size(); i++) {
    entrerEsquisse(static_cast<int>(i));
    wxYield();
    vueEsquisse_->enregistrer(wxString::Format(L"%s\\%03zu.png", dossier, i));
  }
  quitterEsquisse();
}

void Cadre::creerEsquisse(const std::string& plan) {
  if (!docOuvert_) return;
  if (esquisseOuverte_ >= 0) quitterEsquisse();
  Esquisse s;
  if (!plan.empty()) {
    s = nouvelleEsquissePlan(doc_, plan);
  } else if (faceChoisie_.IsNull() || !nouvelleEsquisseFace(doc_, forme_, faceChoisie_, s)) {
    etat(L"Esquisse sur face : cliquez d'abord une face plane du solide, puis reprenez le bouton Esquisse.");
    return;
  }
  ModifCote m;
  m.esquissesAvant = doc_.esquisses;
  m.creation = true;
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  doc_.esquisses.push_back(std::move(s));
  remplirArbre();
  majTitre();
  entrerEsquisse(static_cast<int>(doc_.esquisses.size()) - 1);
}

// Dans le navigateur, Abandonner garde aujourd'hui ce qui a été dessiné. Ici le mot dit ce qu'il fait.
void Cadre::abandonnerEsquisse() {
  if (esquisseOuverte_ < 0) return;
  if (vueEsquisse_->enSaisie()) vueEsquisse_->annulerSaisie();
  vueEsquisse_->abandonnerTrace();
  if (annulations_.size() <= annulationsEntree_ && !dessinModifie_) return quitterEsquisse();
  vueEsquisse_->poserDessin(nullptr);
  dessin_.reset();
  edition_.reset();
  doc_.esquisses = esquissesEntree_;
  if (annulations_.size() > annulationsEntree_) annulations_.resize(annulationsEntree_);
  retablissements_.clear();
  dessinModifie_ = false;
  quitterEsquisse();
  if (docOuvert_) {
    majTitre();
    recalculer();
  }
}

void Cadre::quitterEsquisse() {
  if (esquisseOuverte_ < 0) return;
  const int i = esquisseOuverte_;
  bool suivre = dessinModifie_;
  dessinModifie_ = false;
  if (vueEsquisse_->enSaisie()) vueEsquisse_->annulerSaisie();
  vueEsquisse_->poserDessin(nullptr);
  dessin_.reset();
  esquisseOuverte_ = -1;
  edition_.reset();
  vueEsquisse_->montrer(nullptr, TopoDS_Shape());
  modeEsquisse(false);
  dessinerEsquisses();
  vue_->Refresh();
  montrerEsquisse(i);
  etat(tx(doc_.nom));
  if (!faoEsqId_.empty()) return faoFermerEsquisse();
  // skIsGhost : créée puis refermée sans rien dessiner, elle ne reste pas dans la pièce, ni dans les annulations
  const Esquisse& fin = doc_.esquisses[i];
  const bool rienQueOrigine = fin.ordre.empty() || (fin.ordre.size() == 1 && fin.ordre[0] == "O");
  const bool citee = std::any_of(doc_.fonctions.begin(), doc_.fonctions.end(), [&](const Fonction& f) { return f.esquisse == fin.id; });
  if (!citee && static_cast<size_t>(i) >= doc_.esquissesFichier.size() && static_cast<size_t>(i) + 1 == doc_.esquisses.size() && fin.entites.empty() && fin.contraintes.empty() && fin.cotes.empty() && rienQueOrigine) {
    doc_.esquisses.pop_back();
    const size_t n = doc_.esquisses.size();
    while (!annulations_.empty() && !annulations_.back().avecFonctions && annulations_.back().esquissesAvant.size() > n) annulations_.pop_back();
    if (!annulations_.empty() && annulations_.back().creation && annulations_.back().esquissesAvant.size() == n) annulations_.pop_back();
    retablissements_.clear();
    suivre = false;
    remplirArbre();
    montrerRien();
    majTitre();
  }
  if (suivre) {
    wxBusyCursor attente;
    const EtatFormules avant(doc_);
    std::string raison;
    if (!appliquerFormules(doc_, avant, -1, nullptr, raison)) etat(tx(doc_.nom) + L"  |  " + tx(raison));
    suivreCopies(i);
    recalculer();
  }
}

void Cadre::montrerForme(const TopoDS_Shape& s) {
  fonctionMontree_ = -1;
  props_->Clear();
  props_->CenterSplitter();
  if (s.IsNull()) {
    faceChoisie_.Nullify();
    montrerRien();
    etat(L"Rien de choisi.");
    return;
  }
  GProp_GProps g;
  faceChoisie_.Nullify();
  if (s.ShapeType() == TopAbs_FACE) {
    const TopoDS_Face f = TopoDS::Face(s);
    faceChoisie_ = f;
    BRepGProp::SurfaceProperties(f, g);
    props_->Append(new wxPropertyCategory(L"Face"));
    lectureSeule(props_, L"Forme", nomSurface(f));
    lectureSeule(props_, L"Aire (mm²)", nombre(g.Mass()));
    etat(L"Face " + nomSurface(f) + L"  |  Aire " + nombre(g.Mass()) + L" mm²");
  } else if (s.ShapeType() == TopAbs_EDGE) {
    const TopoDS_Edge e = TopoDS::Edge(s);
    BRepGProp::LinearProperties(e, g);
    props_->Append(new wxPropertyCategory(L"Arête"));
    lectureSeule(props_, L"Forme", nomCourbe(e));
    lectureSeule(props_, L"Longueur (mm)", nombre(g.Mass()));
    etat(L"Arête " + nomCourbe(e) + L"  |  Longueur " + nombre(g.Mass()) + L" mm");
  }
}

namespace {
// regenUi : rien sur une petite pièce, une barre passé 0,3 s. Le calcul ne rend pas la main : la barre se repeint elle-même.
class BarreRejeu {
 public:
  explicit BarreRejeu(wxWindow* vue) : vue_(vue), t0_(std::chrono::steady_clock::now()) {
    gSuiviRejeu = [this](int n, int total, const Fonction& f) {
      montrer(n, total, tx(f.nom.empty() ? f.type : f.nom));
    };
  }
  ~BarreRejeu() {
    gSuiviRejeu = nullptr;
    if (cadre_) cadre_->Destroy();
  }
  void fin() {
    gSuiviRejeu = nullptr;
    if (cadre_) montrer(0, 0, L"Affichage…");
  }

 private:
  void montrer(int n, int total, const wxString& nom) {
    const auto t = std::chrono::steady_clock::now();
    if (t - t0_ < std::chrono::milliseconds(300) || !vue_->IsShownOnScreen()) return;
    if (cadre_ && t - dernier_ < std::chrono::milliseconds(40)) return;
    dernier_ = t;
    if (!cadre_) {
      cadre_ = new wxFrame(wxGetTopLevelParent(vue_), wxID_ANY, wxString(), wxDefaultPosition, wxDefaultSize, wxFRAME_TOOL_WINDOW | wxFRAME_FLOAT_ON_PARENT | wxFRAME_NO_TASKBAR | wxBORDER_SIMPLE);
      auto* p = new wxPanel(cadre_);
      auto* s = new wxBoxSizer(wxVERTICAL);
      titre_ = new wxStaticText(p, wxID_ANY, L"⟳ Régénération du modèle…");
      nom_ = new wxStaticText(p, wxID_ANY, wxString(), wxDefaultPosition, wxDefaultSize, wxST_NO_AUTORESIZE | wxST_ELLIPSIZE_END);
      barre_ = new wxGauge(p, wxID_ANY, 100, wxDefaultPosition, p->FromDIP(wxSize(360, 10)));
      s->Add(titre_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxTOP, p->FromDIP(10));
      s->Add(barre_, 0, wxEXPAND | wxALL, p->FromDIP(10));
      s->Add(nom_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, p->FromDIP(10));
      p->SetSizer(s);
      s->SetSizeHints(cadre_);
      const wxRect v = vue_->GetScreenRect();
      const wxSize c = cadre_->GetSize();
      cadre_->SetPosition(wxPoint(v.x + (v.width - c.x) / 2, v.y + (v.height - c.y) / 2));
      cadre_->ShowWithoutActivating();
    }
    if (total > 0) {
      titre_->SetLabel(wxString::Format(L"⟳ Régénération du modèle… %d / %d", n, total));
      barre_->SetValue(std::min(100, n * 100 / std::max(1, total)));
    } else {
      barre_->SetValue(100);
    }
    nom_->SetLabel(nom);
    cadre_->Update();
    cadre_->Refresh();
    cadre_->Update();
  }
  wxWindow* vue_;
  std::chrono::steady_clock::time_point t0_, dernier_;
  wxFrame* cadre_ = nullptr;
  wxStaticText* titre_ = nullptr;
  wxStaticText* nom_ = nullptr;
  wxGauge* barre_ = nullptr;
};
}  // namespace

// Rejoue et affiche. Rend la durée totale en ms (calcul + maillage + dessin).
double Cadre::recalculer() {
  wxBusyCursor attente;
  mesureEffacer(true);  // les faces mesurées ne sont peut-être plus les mêmes
  const auto t0 = std::chrono::steady_clock::now();
  ResultatRejeu r;
  BarreRejeu barre(vue_);
  try {
    r = rejouer(doc_, indiceMarque());
    msRejeu_ = msDepuis(t0);
    barre.fin();
    if (!r.forme.IsNull()) mailler(r.forme, parallele());
  } catch (const Standard_Failure& e) {
    r.messages.push_back(e.what());
  } catch (const std::exception& e) {
    r.messages.push_back(e.what());
  }
  const double tCalcul = msDepuis(t0);
  msMaillage_ = tCalcul - msRejeu_;
  forme_ = r.forme;
  formesCorps_ = r.corps;
  dernierRejeu_ = r;
  if (planVue_) {
    planVue_->oublier();
    if (atelier_ == Atelier::PLAN) montrerPlan();
  }
  if (atelier_ == Atelier::RENDU) montrerRendu(false);
  {
    // bodyColorOf : la fiche du corps, sinon la teinte de la pièce, sinon la palette automatique selon le rang
    static const unsigned PALETTE[] = {0x0a84ff, 0x30d158, 0xff9f0a, 0xbf5af2, 0xff453a, 0x64d2ff, 0xffd60a, 0x5e5ce6};
    std::vector<std::pair<TopoDS_Shape, unsigned>> teintes;
    std::vector<std::pair<TopoDS_Shape, double>> transparences;
    std::vector<TopoDS_Shape> vus;
    for (const auto& [id, s] : r.corpsVus) {
      if (std::find(doc_.corpsMasques.begin(), doc_.corpsMasques.end(), id) != doc_.corpsMasques.end()) continue;  // l'œil du corps : la vue seule
      vus.push_back(s);
      const size_t i = std::find(doc_.corps.begin(), doc_.corps.end(), id) - doc_.corps.begin();
      if (i < doc_.opacitesCorps.size() && doc_.opacitesCorps[i] < 1) transparences.push_back({s, 1 - doc_.opacitesCorps[i]});
      unsigned c = i < doc_.couleursCorps.size() ? doc_.couleursCorps[i] : 0;
      if (!c) c = doc_.teinte;
      if (!c) c = PALETTE[(i < doc_.corps.size() ? i : 0) % 8];
      teintes.push_back({s, c});
    }
    TopoDS_Shape montree = r.forme;
    if (vus.size() != r.corps.size()) {
      montree.Nullify();
      if (vus.size() == 1) {
        montree = vus[0];
      } else if (!vus.empty()) {
        BRep_Builder bd;
        TopoDS_Compound comp;
        bd.MakeCompound(comp);
        for (const TopoDS_Shape& s : vus) bd.Add(comp, s);
        montree = comp;
      }
    }
    vue_->afficher(montree, ajusterVue_ && !doc_.assemblage, teintes, transparences);
    if (optionsVue_.env != "actuel") {
      plan::J racine;
      renduDocCourant(racine);
      std::vector<ApparenceVue> L;
      for (const PieceRendu& p : renduPieces(racine)) L.push_back({p.forme, p.cle, p.couleur});
      vue_->apparences(L);
    }
    std::vector<std::vector<gp_Pnt>> helices, anneaux;
    for (const SpiraleFilet& s : r.spirales) {
      if (std::find(doc_.corpsMasques.begin(), doc_.corpsMasques.end(), s.corps) != doc_.corpsMasques.end()) continue;
      helices.push_back(s.helice);
      anneaux.push_back(s.anneau);
    }
    vue_->montrerFilets(helices, anneaux);
    dessinerConstruction();
    asmApresRejeu(r, ajusterVue_);
  }
  dessinerEsquisses();
  ajusterVue_ = false;
  // Le banc compte aussi le prix de la sélection, que le programme paierait dès que la souris passe sur la vue.
  if (proto_.actif) vue_->preparerSelection();
  const double total = msDepuis(t0);
  if (proto_.actif) return total;
  if (r.forme.IsNull() && r.messages.empty()) {
    if (doc_.assemblage) etat(tx(doc_.nom) + L"  |  Assemblage");
    else etat(tx(doc_.nom) + L"  |  Aucun solide dans ce fichier (esquisses seules).");
    return total;
  }
  const Mesures m = mesurer(r.forme);
  etat(wxString::Format(L"%s  |  Volume %.3f mm³  |  %d faces  |  calcul %.0f ms, total %.0f ms%s", tx(doc_.nom), m.volume, m.faces, tCalcul, total, r.messages.empty() ? L"" : L"  |  ⚠ voir message"));
  // Pendant le dessin, une esquisse encore ouverte n'est pas une erreur : le message attend la fin de l'esquisse
  if (!journalOuverture_.empty() && esquisseOuverte_ < 0) {
    etat(etatVue_->texte() + L"  |  " + tx(journalOuverture_));
    journalOuverture_.clear();
  }
  const bool dejaMontres = r.messages == messagesMontres_;
  if (esquisseOuverte_ < 0) messagesMontres_ = r.messages;
  if (!r.messages.empty() && esquisseOuverte_ < 0 && !dejaMontres && !essaiSansBoite_) {
    wxString t;
    for (const std::string& x : r.messages) t += tx(x) + L"\n";
    wxMessageBox(t, L"Messages du rejeu", wxOK | wxICON_WARNING, this);
  }
  return total;
}

// Ctrl+E : l'esquisse ouverte, sinon celle choisie dans l'arbre, sinon la dernière (askExtrude). La fonction naît tout de suite : ce qu'on voit est le résultat.
void Cadre::extruder() {
  if (!docOuvert_ || doc_.esquisses.empty()) return;
  if (!solideCalculable_) {
    etat(L"Extrusion : le solide de cette pièce n'est pas encore calculé par ce programme.");
    return;
  }
  std::string id;
  if (esquisseOuverte_ >= 0) {
    id = doc_.esquisses[esquisseOuverte_].id;
  } else if (const wxTreeItemId ligne = arbre_->GetSelection(); ligne.IsOk()) {
    const auto* lien = dynamic_cast<LienArbre*>(arbre_->GetItemData(ligne));
    if (lien && !lien->estFonction && lien->i >= 0) id = doc_.esquisses[lien->i].id;
  }
  if (id.empty()) {
    id = doc_.esquisses.back().id;
    for (size_t i = doc_.esquisses.size(); i-- > 0;) {  // repCloneSkName : les copies d'une répétition ne sont jamais la source
      const std::string& n = doc_.esquisses[i].nom;
      const size_t r = n.rfind("(r\xC3\xA9p");
      if (r == std::string::npos || n.back() != ')') {
        id = doc_.esquisses[i].id;
        break;
      }
    }
  }
  quitterEsquisse();  // peut retirer une esquisse restée vide
  Esquisse* s = doc_.esquisse(id);
  if (!s) {
    etat(L"Extrusion : dessinez d'abord un contour fermé dans l'esquisse.");
    return;
  }
  const std::string raison = raisonSansVolume(*s);
  if (!raison.empty()) {
    etat(L"Extrusion impossible pour « " + tx(s->nom) + L" » : " + tx(raison) + L".");
    return;
  }
  ModifCote m;
  m.esquissesAvant = doc_.esquisses;
  m.avecFonctions = true;
  m.fonctionsAvant = doc_.fonctions;
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  doc_.fonctions.push_back(nouvelleExtrusion(doc_, *s));
  s->visible = false;
  ajusterVue_ = forme_.IsNull();
  remplirArbre();
  majTitre();
  recalculer();
  choisirFonction(static_cast<int>(doc_.fonctions.size()) - 1);
}

void Cadre::choisirFonction(int i) {
  if (i < 0 || i >= static_cast<int>(lignesFonctions_.size())) return;
  if (!doc_.fonctions[i].repeatId.empty())
    for (size_t r = 0; r < doc_.fonctions.size(); r++)
      if (doc_.fonctions[r].id == doc_.fonctions[i].repeatId) i = static_cast<int>(r);
  if (!lignesFonctions_[i].IsOk()) return;
  if (arbre_->GetSelection() == lignesFonctions_[i]) montrerFonction(i);
  else arbre_->SelectItem(lignesFonctions_[i]);
}

// Après un changement de source : les esquisses qui en dépendent, les copies, puis celles qui dépendent des copies
void Cadre::suivreCopies(int esquisse) {
  if (esquisseOuverte_ >= 0 || doc_.sourcesRepetees.empty()) {
    if (esquisse >= 0) suivreEsquisses(doc_, esquisse);
    return;
  }
  try {
    if (esquisse >= 0) suivreEsquisses(doc_, esquisse);
    refaireCopies(doc_);
    if (esquisse >= 0) {
      suivreEsquisses(doc_, esquisse);
      refaireCopies(doc_);
    }
    remplirArbre();
  } catch (const std::exception& e) {
    etat(tx(e.what()));
  }
}

void Cadre::modifierFonction(int i, const std::function<void(Fonction&)>& reglage) {
  ModifCote m;
  m.esquissesAvant = doc_.esquisses;
  m.avecFonctions = true;
  m.fonctionsAvant = doc_.fonctions;
  Fonction& f = doc_.fonctions[i];
  if (solideCalculable_) nommerProjections(doc_);
  reglage(f);
  if (memesReglages(f, m.fonctionsAvant[i])) {
    montrerFonction(i);
    return;
  }
  f.nom = nomExtrusion(doc_, f);  // extDynSet : le nom suit toujours les réglages
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  if (lignesFonctions_[i].IsOk()) arbre_->SetItemText(lignesFonctions_[i], libelleArbre(f));
  remplirFil();
  majTitre();
  {
    wxBusyCursor attente;
    int sk = -1;
    for (size_t j = 0; j < doc_.esquisses.size(); j++)
      if (doc_.esquisses[j].id == doc_.fonctions[i].esquisse) sk = static_cast<int>(j);
    suivreCopies(sk);
  }
  recalculer();
  montrerFonction(i);
}

void Cadre::poserPas(const std::vector<Esquisse>& esquisses, bool avecFonctions, const std::vector<Fonction>& fonctions) {
  const int montree = fonctionMontree_;
  if (avecFonctions) doc_.fonctions = fonctions;
  poserEsquisses(esquisses);
  if (!avecFonctions) return;
  const std::string garde = dynSel_;
  dynOccupe_++;
  remplirArbre();
  montrerRien();
  choisirFonction(montree);
  if (dynSel_.empty() && !garde.empty())  // la fenêtre dynamique reste ouverte tant que la fonction existe
    for (size_t k = 0; k < doc_.fonctions.size(); k++)
      if (doc_.fonctions[k].id == garde) choisirFonction(static_cast<int>(k));
  dynOccupe_--;
}

void Cadre::annuler() {
  if (atelier_ == Atelier::FAO) return faoTouche("z", true, false);
  const std::string gardeDyn = dynSel_;
  if (enChoix()) return quitterConge();
  if (vueEsquisse_->enSaisie()) return vueEsquisse_->annulerSaisie();
  if (vueEsquisse_->abandonnerTrace()) return;
  if (annulations_.empty()) return;
  if (annulations_.back().docAvant) {
    if (esquisseOuverte_ >= 0) return etat(L"Quittez l'esquisse pour annuler ce changement de la pièce.");
    ModifCote m = annulations_.back();
    annulations_.pop_back();
    m.docApres = std::make_shared<Document>(doc_);
    retablissements_.push_back(m);
    if (m.planSeul) return reprendrePlan(m.docAvant);
    poserDocument(m.docAvant);
    dynRetrouver(gardeDyn);
    return;
  }
  // Créée puis enregistrée : elle sort du fichier par le même chemin que Supprimer
  if ((annulations_.back().creation && annulations_.back().esquissesAvant.size() < doc_.esquissesFichier.size()) ||
      (annulations_.back().avecFonctions && annulations_.back().fonctionsAvant.size() < doc_.fonctionsFichier.size())) return annulerDejaEnregistre();
  ModifCote m = annulations_.back();
  annulations_.pop_back();
  faireSuivre();  // l'état à rétablir est complet
  m.esquissesApres = doc_.esquisses;
  if (m.avecFonctions) m.fonctionsApres = doc_.fonctions;
  retablissements_.push_back(m);
  if (m.avecFormules) {
    doc_.params = m.paramsAvant;
    doc_.porteurs = m.porteursAvant;
  }
  poserPas(m.esquissesAvant, m.avecFonctions, m.fonctionsAvant);
  if (m.avecFormules && miniParams_->IsShown()) miniParams_->rafraichir();
  if (esquisseOuverte_ < 0 && !doc_.sourcesRepetees.empty()) {
    dynOccupe_++;
    suivreCopies();
    recalculer();
    dynOccupe_--;
    dynRetrouver(gardeDyn);
  }
}

void Cadre::annulerDejaEnregistre() {
  const ModifCote m = annulations_.back();
  std::vector<std::string> fonctions, esquisses;
  if (m.avecFonctions)
    for (const Fonction& f : doc_.fonctions)
      if (std::none_of(m.fonctionsAvant.begin(), m.fonctionsAvant.end(), [&](const Fonction& a) { return a.id == f.id; })) fonctions.push_back(f.id);
  for (const Esquisse& e : doc_.esquisses)
    if (std::none_of(m.esquissesAvant.begin(), m.esquissesAvant.end(), [&](const Esquisse& a) { return a.id == e.id; })) esquisses.push_back(e.id);
  const auto refaire = retablissements_;
  const size_t nb = annulations_.size();
  faireSuivre();
  changerStructure([&](nlohmann::ordered_json& d) {
    for (const std::string& id : fonctions) stSupprimerFonction(d, id);
    for (const std::string& id : esquisses) stSupprimerEsquisse(d, id);
  }, wxString());
  retablissements_ = refaire;
  if (annulations_.size() != nb + 1) return;  // refusé : le message est déjà parti
  ModifCote r;
  r.docApres = annulations_.back().docAvant;
  annulations_.pop_back();
  annulations_.pop_back();
  r.docAvant = std::make_shared<Document>(doc_);
  retablissements_.push_back(std::move(r));
}

void Cadre::retablir() {
  if (atelier_ == Atelier::FAO) return faoTouche("y", true, false);
  const std::string gardeDyn = dynSel_;
  if (retablissements_.empty()) return;
  if (retablissements_.back().docApres && esquisseOuverte_ >= 0) return etat(L"Quittez l'esquisse pour rétablir ce changement de la pièce.");
  const ModifCote m = retablissements_.back();
  retablissements_.pop_back();
  annulations_.push_back(m);
  if (m.planSeul) return reprendrePlan(m.docApres);
  if (m.docApres) {
    poserDocument(m.docApres);
    dynRetrouver(gardeDyn);
    return;
  }
  if (m.avecFormules) {
    doc_.params = m.paramsApres;
    doc_.porteurs = m.porteursApres;
  }
  poserPas(m.esquissesApres, m.avecFonctions, m.fonctionsApres);
  if (m.avecFormules && miniParams_->IsShown()) miniParams_->rafraichir();
  if (esquisseOuverte_ < 0 && !doc_.sourcesRepetees.empty()) {
    dynOccupe_++;
    suivreCopies();
    recalculer();
    dynOccupe_--;
    dynRetrouver(gardeDyn);
  }
}

// ---- Les menus contextuels de l'arbre et du fil ----
int Cadre::indiceMarque() const {
  if (marqueTemps_.empty()) return -1;
  for (size_t i = 0; i < doc_.fonctions.size(); i++)
    if (doc_.fonctions[i].id == marqueTemps_) return static_cast<int>(i);
  return -1;
}

void Cadre::marquerTemps(const std::string& id) {
  marqueTemps_ = id;
  remplirArbre();
  montrerRien();
  if (solideCalculable_) recalculer();
}

void Cadre::bougerMarqueur(int bouton) {
  if (esquisseOuverte_ >= 0 || enChoix() || doc_.fonctions.empty()) return;
  const int n = static_cast<int>(doc_.fonctions.size());
  const int ici = indiceMarque() < 0 ? n : indiceMarque();
  int cible = bouton == 0 ? 0 : bouton == 3 ? n : ici;
  if (bouton == 1) {
    cible = 0;
    for (int i = ici - 1; i > 0 && !cible; i--)
      if (doc_.fonctions[i].repeatId.empty()) cible = i;
  } else if (bouton == 2) {
    cible = n;
    for (int i = n - 1; i > ici; i--)
      if (doc_.fonctions[i].repeatId.empty()) cible = i;
  }
  if (cible != ici) marquerTemps(cible < n ? doc_.fonctions[cible].id : std::string());
}

void Cadre::apresStructure() {
  dynOccupe_++;  // la sélection revient juste après : la session continue
  solideCalculable_ = doc_.nonPrisEnCharge.empty();
  if (indiceMarque() < 0) marqueTemps_.clear();
  remplirArbre();
  montrerRien();
  majTitre();
  if (solideCalculable_) {
    recalculer();
  } else {
    vue_->afficher(TopoDS_Shape(), false);
    montrerManques();
  }
  dynOccupe_--;
}

// Un enregistrement a pu avoir lieu depuis : ce document n'est plus celui du disque, il reste à enregistrer
void Cadre::poserDocument(const std::shared_ptr<Document>& d) {
  Document n = *d;
  if (n.octets != doc_.octets || n.chemin != doc_.chemin) {
    if (n.texteBase.empty()) n.texteBase = texteDuFichier(n);
    n.octets = doc_.octets;
    n.chemin = doc_.chemin;
    n.compresse = doc_.compresse;
  }
  doc_ = std::move(n);
  apresStructure();
}

void Cadre::changerStructure(const std::function<void(nlohmann::ordered_json&)>& changement, const wxString& message) {
  auto avant = std::make_shared<Document>(doc_);
  try {
    modifierStructure(doc_, changement);
  } catch (const anteriorite::Refus& e) {
    doc_ = *avant;
    etat(tx(e.what()));
    return;
  } catch (const std::exception& e) {
    doc_ = *avant;
    if (!essaiMenu_) wxMessageBox(tx(e.what()), L"Modification impossible", wxOK | wxICON_WARNING, this);
    return;
  }
  ModifCote m;
  m.docAvant = avant;
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  apresStructure();
  if (!message.empty()) etat(etatVue_->texte() + L"  |  " + message);
}

void Cadre::changerPlan(const nlohmann::ordered_json& mep) {
  auto avant = std::make_shared<Document>(doc_);
  try {
    modifierStructure(doc_, [&](nlohmann::ordered_json& d) { d["mep"] = mep; });
  } catch (const std::exception& e) {
    doc_ = *avant;
    if (!essaiMenu_) wxMessageBox(tx(e.what()), L"Modification impossible", wxOK | wxICON_WARNING, this);
    return;
  }
  ModifCote m;
  m.docAvant = avant;
  m.planSeul = true;
  annulations_.push_back(std::move(m));
  retablissements_.clear();
}

void Cadre::reprendrePlan(const std::shared_ptr<Document>& d) {
  doc_ = *d;
  if (atelier_ == Atelier::RENDU) montrerRendu(false);
  if (atelier_ != Atelier::PLAN) {
    if (planVue_) planVue_->oublier();
    return;
  }
  const std::string base = !doc_.texteBase.empty() ? doc_.texteBase.str() : texteDuFichier(doc_);
  planVue_->reprendre(base);
}

int Cadre::choisirMenu(wxMenu& m) {
  if (!essaiMenu_) return GetPopupMenuSelectionFromUser(m);
  int choix = wxID_NONE;
  essaiEntrees_.clear();
  for (wxMenuItem* it : m.GetMenuItems()) {
    if (it->IsSeparator()) continue;
    const std::string l = it->GetItemLabelText().utf8_string();
    essaiEntrees_.push_back(l + (it->IsEnabled() ? "" : " (grisé)"));
    if (choix == wxID_NONE && it->IsEnabled() && !essaiChoix_.empty() && l.find(essaiChoix_) != std::string::npos) choix = it->GetId();
  }
  return choix;
}

wxString Cadre::demanderNom(const wxString& actuel) {
  if (essaiMenu_) return wxString::FromUTF8(essaiNom_);
  return wxGetTextFromUser(L"Nouveau nom :", L"Renommer", actuel, this);
}

bool Cadre::confirmerSuppression(const wxString& question) {
  return essaiMenu_ || wxMessageBox(question, L"Supprimer", wxYES_NO | wxNO_DEFAULT | wxICON_QUESTION, this) == wxYES;
}

namespace {
enum { M_RENOMMER = wxID_HIGHEST + 700, M_VOIR, M_EDITER, M_TEMPS, M_FIN, M_SUPPRIMER, M_ACTIF, M_COULEUR, M_TRANSPARENCE, M_RETIRER, M_FANTOME, M_ISOLER, M_TOUT, M_STEP, M_DEPLACER, M_ECHELLE, M_RESELECTION, M_DEPUIS_CORPS, M_VERS_COMPOSANT_CORPS, M_MONTER, M_DESCENDRE };
}

// tlbMoveTo : la fonction va dans l'interstice, par crans, en restant dans son corps
void Cadre::deposerDansFil(const std::vector<FilFonctions::Element>& L, int source, int gap) {
  if (source < 0 || source >= static_cast<int>(L.size()) || !L[source].estFonction || gap == source || gap == source + 1) return;
  const std::string id = doc_.fonctions[L[source].i].id;
  const bool droite = gap > source;
  std::string voisine;
  if (droite) {
    for (size_t k = gap; k < L.size() && voisine.empty(); k++)
      if (L[k].estFonction && doc_.fonctions[L[k].i].id != id) voisine = doc_.fonctions[L[k].i].id;
  } else {
    for (int k = std::min<int>(gap, static_cast<int>(L.size())) - 1; k >= 0 && voisine.empty(); k--)
      if (L[k].estFonction && doc_.fonctions[L[k].i].id != id) voisine = doc_.fonctions[L[k].i].id;
  }
  changerStructure([&](nlohmann::ordered_json& d) { anteriorite::deplacerDansFil(d, id, droite, voisine); }, L"Ctrl+Z : annuler.");
}

void Cadre::menuFonction(int i) {
  const Fonction f = doc_.fonctions[i];
  const bool copie = !f.repeatId.empty();  // refaite depuis sa source : elle ne se règle pas à part
  wxMenu m;
  m.Append(M_RENOMMER, L"✏️ Renommer")->Enable(!copie);
  m.Append(M_VOIR, L"👁 Afficher / masquer")->Enable(!copie);
  m.Append(M_EDITER, L"🔧 Éditer l'esquisse")->Enable(!copie && !f.esquisse.empty() && doc_.esquisse(f.esquisse));
  if (fonctionDeFaces(f)) m.Append(M_RESELECTION, L"🎯 Re-sélectionner les faces");
  if (f.type == "xfillet" && !copie) m.Append(M_RESELECTION, L"✏️ Modifier la sélection");
  m.Append(M_MONTER, L"▲ Monter dans le corps")->Enable(!copie);
  m.Append(M_DESCENDRE, L"▼ Descendre dans le corps")->Enable(!copie);
  m.Append(M_TEMPS, L"⏱ Bloquer le temps à ce point");
  m.Append(M_FIN, L"↗ Fin : rejouer tout")->Enable(!marqueTemps_.empty());
  m.Append(M_SUPPRIMER, L"🗑 Supprimer")->Enable(!copie);
  const int choix = choisirMenu(m);
  if (choix == M_MONTER || choix == M_DESCENDRE) {
    const int dir = choix == M_MONTER ? -1 : 1;
    changerStructure([&](nlohmann::ordered_json& d) { anteriorite::deplacerCran(d, f.id, dir); }, L"Ctrl+Z : annuler.");
  } else if (choix == M_RESELECTION && f.type == "xfillet") {
    editerConge(i);
  } else if (choix == M_RESELECTION) {
    entrerFaces(sorteDeFaces(f), f.id);
  } else if (choix == M_RENOMMER) {
    const wxString n = demanderNom(tx(f.nom));
    if (n.empty()) return;
    const std::string nom = n.utf8_string();
    changerStructure([&](nlohmann::ordered_json& d) { stRenommer(d, "features", f.id, nom); });
  } else if (choix == M_VOIR) {
    changerStructure([&](nlohmann::ordered_json& d) { stBasculerVisible(d, "features", f.id); });
  } else if (choix == M_EDITER) {
    if (indiceMarque() >= 0 && i >= indiceMarque()) marquerTemps("");
    for (size_t k = 0; k < doc_.esquisses.size(); k++)
      if (doc_.esquisses[k].id == f.esquisse) return entrerEsquisse(static_cast<int>(k));
  } else if (choix == M_TEMPS) {
    marquerTemps(f.id);
  } else if (choix == M_FIN) {
    marquerTemps("");
  } else if (choix == M_SUPPRIMER) {
    if (!confirmerSuppression(L"Supprimer ?")) return;
    if (marqueTemps_ == f.id) marqueTemps_.clear();
    changerStructure([&](nlohmann::ordered_json& d) { stSupprimerFonction(d, f.id); }, L"Ctrl+Z : annuler.");
  }
}

void Cadre::menuEsquisseArbre(int i) {
  const std::string id = doc_.esquisses[i].id, nomActuel = doc_.esquisses[i].nom;
  wxMenu m;
  m.Append(M_RENOMMER, L"✏️ Renommer");
  m.Append(M_VOIR, L"👁 Afficher / masquer");
  m.Append(M_EDITER, L"🔧 Éditer l'esquisse");
  m.Append(M_FIN, L"↗ Fin : rejouer tout")->Enable(!marqueTemps_.empty());
  m.Append(M_SUPPRIMER, L"🗑 Supprimer");
  enum { M_VERS_COMPOSANT = wxID_HIGHEST + 7300 };
  m.Append(M_VERS_COMPOSANT, L"➡ Déplacer vers un composant…");
  const int choix = choisirMenu(m);
  if (choix == M_VERS_COMPOSANT) return asmDeplacerVers(false, id);
  if (choix == M_RENOMMER) {
    const wxString n = demanderNom(tx(nomActuel));
    if (n.empty()) return;
    const std::string nom = n.utf8_string();
    changerStructure([&](nlohmann::ordered_json& d) { stRenommer(d, "sketches", id, nom); });
  } else if (choix == M_VOIR) {
    changerStructure([&](nlohmann::ordered_json& d) { stBasculerVisible(d, "sketches", id); });
  } else if (choix == M_EDITER) {
    entrerEsquisse(i);
  } else if (choix == M_FIN) {
    marquerTemps("");
  } else if (choix == M_SUPPRIMER) {
    if (!confirmerSuppression(L"Supprimer ?")) return;
    changerStructure([&](nlohmann::ordered_json& d) { stSupprimerEsquisse(d, id); }, L"Ctrl+Z : annuler.");
  }
}

void Cadre::montrerConstruction(const std::string& id) {
  for (const ElementConstruction& e : doc_.construction)
    if (e.id == id) {
      fonctionMontree_ = -1;
      props_->Clear();
      props_->CenterSplitter();
      ficheChoix_.clear();
      props_->Append(new wxPropertyCategory(tx(nomSorteConstruction(e.kind))));
      champsDe_ = e.id;
      poserChamps(ficheConstruction(doc_, e), false);
      champsDe_.clear();
      ficheId_ = id;
      constructionMontree_ = id;
      dessinerConstruction();
      const wxString a = tx(e.j.value("msg", std::string()));
      etat(tx(libelleConstruction(e)) + (a.empty() ? wxString() : L" — ⚠ " + a) + (e.kind == "plane" || e.kind == "frame" ? L"  |  double-clic dans l'arbre : esquisse dessus" : L""));
      return;
    }
}

void Cadre::choisirConstruction(const std::string& id) {
  const auto it = lignesConstruction_.find(id);
  if (it != lignesConstruction_.end() && it->second.IsOk() && arbre_->GetSelection() != it->second) arbre_->SelectItem(it->second);
  montrerConstruction(id);
}

gp_Pnt pointMonde(const Esquisse& s, double x, double y);  // faces.h

void Cadre::dessinerEsquisses() {  // drawSketchHelpers : l'esquisse ouverte se dessine à plat dans son écran
  std::vector<std::vector<gp_Pnt>> forts, aides, axes;
  if (docOuvert_ && atelier_ == Atelier::CAO)
    for (size_t i = 0; i < doc_.esquisses.size(); i++) {
      const Esquisse& s = doc_.esquisses[i];
      if (!s.visible || static_cast<int>(i) == esquisseOuverte_) continue;
      for (const Entite& e : s.entites) {
        std::vector<gp_Pnt> P;
        const auto monde = [&](double x, double y) { P.push_back(pointMonde(s, x, y)); };
        if (e.t == "line") {
          const Pt* a = s.point(e.p1);
          const Pt* b = s.point(e.p2);
          if (!a || !b || e.poignee) continue;
          monde(a->x, a->y);
          monde(b->x, b->y);
        } else if (e.t == "circle" || e.t == "arc") {
          const Pt* c = s.point(e.pc);
          if (!c || !(e.r > 0)) continue;
          double a1 = 0, d = 2 * M_PI;
          int n = 48;
          if (e.t == "arc") {
            const auto an = anglesArc(s, e);
            if (!an) continue;
            a1 = an->a1;
            d = an->a2 - an->a1;
            n = std::max(2, static_cast<int>(std::ceil(d / (2 * M_PI) * 48)));
          }
          for (int k = 0; k <= n; k++) {
            const double a = a1 + d * k / n;
            monde(c->x + std::cos(a) * e.r, c->y + std::sin(a) * e.r);
          }
        } else if (e.t == "spline") {
          BSpline f;
          if (!splineDe(s, e, f)) continue;
          for (const P2d& q : bsSample(f, f.a, f.b, 16)) monde(q[0], q[1]);
        } else {
          continue;
        }
        (e.axe ? axes : e.construction ? aides : forts).push_back(std::move(P));
      }
    }
  const Quantity_Color fort = theme::courant() == theme::CLAIR ? Quantity_Color(0x2a / 255.0, 0x2d / 255.0, 0x33 / 255.0, Quantity_TOC_sRGB) : Quantity_Color(1, 1, 1, Quantity_TOC_sRGB);
  vue_->montrerEsquisses(forts, aides, axes, fort);
}

void Cadre::majZones() {
  const bool libre = docOuvert_ && atelier_ == Atelier::CAO && esquisseOuverte_ < 0 && !enChoix() && !pioche_ && fonctionMontree_ >= 0 && fonctionMontree_ < static_cast<int>(doc_.fonctions.size());
  const Fonction* f = libre ? &doc_.fonctions[fonctionMontree_] : nullptr;
  const Esquisse* s = f && f->type == "extrude" && f->visible && f->repeatId.empty() ? doc_.esquisse(f->esquisse) : nullptr;
  if (!s) {
    if (!zonesCle_.empty()) {
      zonesCle_.clear();
      zonesFonction_.clear();
      zones_.clear();
      zoneSurvol_ = -1;
      vue_->montrerZones({});
    }
    return;
  }
  const std::string cle = f->id + "|" + std::to_string(reinterpret_cast<uintptr_t>(doc_.fonctionsJson.get())) + "|" + std::to_string(zoneSurvol_) + "|" + std::to_string(f->profils.size());
  if (cle == zonesCle_) return;
  std::vector<Vue3D::ZoneVue> L;
  try {
    const Trace tr = tracerContours(*s);
    zones_ = zonesEsquisse(*s, tr);
    completerZones(*s, tr, zones_);
    std::set<int> pris;
    if (!f->profils.empty()) {
      for (const auto& p : f->profils)
        if (const int k = zoneEn(zones_, p[0], p[1]); k >= 0) pris.insert(k);
    } else {
      for (size_t i = 0; i < zones_.size(); i++)
        if (zones_[i].parDefaut) pris.insert(static_cast<int>(i));
    }
    const gp_Pnt O(s->o[0], s->o[1], s->o[2]);
    const auto monde = [&](const Anneau& r, bool direct) {
      double a = 0;
      for (size_t i = 0; i < r.size(); i++) a += r[i][0] * r[(i + 1) % r.size()][1] - r[(i + 1) % r.size()][0] * r[i][1];
      std::vector<gp_Pnt> P;
      for (const auto& q : r) P.push_back(pointMonde(*s, q[0], q[1]));
      if ((a > 0) != direct) std::reverse(P.begin(), P.end());
      return P;
    };
    for (size_t i = 0; i < zones_.size(); i++) {
      Vue3D::ZoneVue z;
      z.o = O;
      z.u = gp_Dir(s->u[0], s->u[1], s->u[2]);
      z.v = gp_Dir(s->v[0], s->v[1], s->v[2]);
      z.choisie = pris.count(static_cast<int>(i)) > 0;
      z.survol = static_cast<int>(i) == zoneSurvol_;
      z.anneaux.push_back(monde(zones_[i].K.ring, true));
      for (const BordZone& t : zones_[i].trous) z.anneaux.push_back(monde(t.ring, false));
      L.push_back(std::move(z));
    }
  } catch (const std::exception&) {
    zones_.clear();
    L.clear();
  }
  zonesCle_ = cle;
  zonesFonction_ = f->id;
  vue_->montrerZones(L);
}

bool Cadre::zoneSousSouris(const wxPoint& p, bool clic) {
  if (zones_.empty() || zonesCle_.empty() || fonctionMontree_ < 0 || fonctionMontree_ >= static_cast<int>(doc_.fonctions.size())) return false;
  const Fonction& f = doc_.fonctions[fonctionMontree_];
  const Esquisse* s = f.id == zonesFonction_ ? doc_.esquisse(f.esquisse) : nullptr;
  if (!s) return false;
  gp_Pnt ro;
  gp_Dir rd;
  vue_->rayonEcran(p.x, p.y, ro, rd);
  const gp_Vec n(s->n[0], s->n[1], s->n[2]);
  const double den = n.Dot(gp_Vec(rd));
  int best = -1;
  if (std::abs(den) >= 1e-6) {  // plan vu par la tranche : rien
    const gp_Pnt O(s->o[0], s->o[1], s->o[2]);
    const double t = n.Dot(gp_Vec(ro, O)) / den;
    if (t > 0) {
      const gp_Vec P(O, ro.Translated(gp_Vec(rd) * t));
      best = zoneEn(zones_, P.Dot(gp_Vec(s->u[0], s->u[1], s->u[2])), P.Dot(gp_Vec(s->v[0], s->v[1], s->v[2])));
    }
  }
  if (!clic) {
    if (best != zoneSurvol_) {
      zoneSurvol_ = best;
      zonesCle_.clear();
      majZones();
    }
    return best >= 0;
  }
  if (best < 0) return false;
  if (!zones_[best].aPoint) {
    etat(L"Zone trop fine pour être choisie.");
    return true;
  }
  std::set<int> pris;
  if (!f.profils.empty()) {
    for (const auto& q : f.profils)
      if (const int k = zoneEn(zones_, q[0], q[1]); k >= 0) pris.insert(k);
  } else {
    for (size_t i = 0; i < zones_.size(); i++)
      if (zones_[i].parDefaut) pris.insert(static_cast<int>(i));
  }
  if (pris.count(best)) {
    if (pris.size() <= 1) {
      etat(L"Extrusion : il faut au moins une zone — choisissez-en une autre avant de retirer celle-ci.");
      return true;
    }
    pris.erase(best);
  } else {
    pris.insert(best);
  }
  nlohmann::ordered_json pts = nlohmann::ordered_json::array();
  size_t nb = 0;
  for (size_t i = 0; i < zones_.size(); i++)
    if (pris.count(static_cast<int>(i)) && zones_[i].aPoint) {
      const auto arrondi = [](double v) { return std::round(v * 10000) / 10000; };
      pts.push_back({arrondi(zones_[i].pt[0]), arrondi(zones_[i].pt[1])});
      nb++;
    }
  const std::string id = f.id;
  const int rang = fonctionMontree_;
  const size_t total = zones_.size();
  changerStructure([&](nlohmann::ordered_json& d) {
    for (auto& k : d["features"])
      if (k.value("id", std::string()) == id) k["profiles"] = pts;
  });
  if (rang < static_cast<int>(doc_.fonctions.size()) && doc_.fonctions[rang].id == id) montrerFonction(rang);
  etat(wxString::Format(L"Extrusion : %zu zone%s sur %zu. Cliquez une zone pour l’ajouter ou la retirer.", nb, nb > 1 ? L"s" : L"", total));
  return true;
}

void Cadre::dessinerConstruction() {
  std::vector<Vue3D::DessinConstruction> L;
  for (const ElementConstruction& e : doc_.construction) {
    if (!e.visible || !e.aRepere) continue;
    if (indiceMarque() >= 0 && rangConstruction(doc_, e) >= indiceMarque()) continue;
    Vue3D::DessinConstruction d;
    d.kind = e.kind;
    for (int k = 0; k < 3; k++) {
      d.o[k] = e.o[k];
      d.x[k] = e.x[k];
      d.y[k] = e.y[k];
      d.z[k] = e.z[k];
    }
    d.choisi = e.id == constructionMontree_;
    L.push_back(d);
  }
  double c[3] = {0, 0, 0}, h = 25;  // cgModelExtent
  if (!forme_.IsNull()) {
    Bnd_Box b;
    try {
      BRepBndLib::Add(forme_, b);
      if (!b.IsVoid()) {
        double x0, y0, z0, x1, y1, z1;
        b.Get(x0, y0, z0, x1, y1, z1);
        c[0] = (x0 + x1) / 2;
        c[1] = (y0 + y1) / 2;
        c[2] = (z0 + z1) / 2;
        h = std::max(25.0, 0.6 * std::max({x1 - x0, y1 - y0, z1 - z0}));
      }
    } catch (const Standard_Failure&) {
    }
  }
  vue_->montrerConstruction(L, c, h);
}

// Le bouton du ruban : l'élément naît tout de suite avec sa méthode par défaut (cgStart), reprend la ligne choisie dans l'arbre, puis on attend les références qui manquent
void Cadre::creerConstructionRuban(const std::string& kind) {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  if (esquisseOuverte_ >= 0) return etat(L"Fermez d'abord l'esquisse.");
  nlohmann::ordered_json ref0 = nullptr;
  if (const wxTreeItemId ligne = arbre_->GetSelection(); ligne.IsOk())
    if (const auto* lien = dynamic_cast<LienArbre*>(arbre_->GetItemData(ligne))) {
      const bool veutPlan = kind == "plane", veutAxe = kind == "axis";
      if (lien->plan.size() == 2 && veutPlan) ref0 = {{"k", "o"}, {"id", lien->plan}};
      else if (lien->plan.size() == 1 && veutAxe) ref0 = {{"k", "o"}, {"id", lien->plan}};
      else if (!lien->cg.empty()) {
        for (const ElementConstruction& e : doc_.construction)
          if (e.id == lien->cg && ((veutPlan && (e.kind == "plane" || e.kind == "frame")) || (veutAxe && (e.kind == "axis" || e.kind == "frame")) || (kind == "frame") || (kind == "point" && e.kind == "frame"))) ref0 = {{"k", "cg"}, {"id", lien->cg}};
      }
    }
  std::string id;
  changerStructure([&](nlohmann::ordered_json& d) { id = creerConstruction(d, kind, indiceMarque(), ref0); });
  if (id.empty()) return;
  choisirConstruction(id);
  for (const ElementConstruction& e : doc_.construction)
    if (e.id == id) {
      const int v = emplacementVide(e);
      if (v >= 0) piocherReference(id, v);
    }
}

void Cadre::creerEsquisseConstruction(const std::string& id, const std::string& sous) {
  if (!docOuvert_) return;
  if (esquisseOuverte_ >= 0) quitterEsquisse();
  Esquisse s;
  if (!nouvelleEsquisseConstruction(doc_, id, sous, s)) return etat(L"Esquisse : cet élément n'est pas résolu, réglez d'abord ses références.");
  ModifCote m;
  m.esquissesAvant = doc_.esquisses;
  m.creation = true;
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  doc_.esquisses.push_back(std::move(s));
  remplirArbre();
  majTitre();
  entrerEsquisse(static_cast<int>(doc_.esquisses.size()) - 1);
}

void Cadre::reglerConstruction(const std::string& id, const std::string& cle, const std::string& valeur) {
  pioche_ = nullptr;
  refAttendue_.clear();
  if (cle.rfind("r/", 0) == 0 && valeur == "pick") return piocherReference(id, std::stoi(cle.substr(2)));
  changerStructure([&](nlohmann::ordered_json& d) {
    const std::string refus = appliquerConstruction(d, id, cle, valeur);
    if (!refus.empty()) throw std::runtime_error(refus);
  });
  choisirConstruction(id);
  if (cle.rfind("r/", 0) == 0 || cle == "x/how")  // cgNextSlot : on enchaîne sur la référence suivante
    for (const ElementConstruction& e : doc_.construction)
      if (e.id == id) {
        const int v = emplacementVide(e);
        if (v >= 0) piocherReference(id, v);
      }
}

void Cadre::menuConstruction(const std::string& id) {  // cgCtxAct
  const ElementConstruction* e = nullptr;
  for (const ElementConstruction& c : doc_.construction)
    if (c.id == id) e = &c;
  if (!e) return;
  const std::string nomActuel = e->nom, kind = e->kind;
  enum { C_XY = wxID_HIGHEST + 780, C_XZ, C_YZ };
  wxMenu m;
  m.Append(M_EDITER, L"🔧 Modifier");
  m.Append(M_RENOMMER, L"✏️ Renommer");
  m.Append(M_VOIR, L"👁 Afficher / masquer");
  if (kind == "plane") m.Append(C_XY, L"✏️ Esquisse dessus");
  if (kind == "frame") {
    m.Append(C_XY, L"✏️ Esquisse sur XY");
    m.Append(C_XZ, L"✏️ Esquisse sur XZ");
    m.Append(C_YZ, L"✏️ Esquisse sur YZ");
  }
  m.Append(M_SUPPRIMER, L"🗑 Supprimer");
  const int choix = choisirMenu(m);
  if (choix == M_RENOMMER) {
    const wxString n = demanderNom(tx(nomActuel));
    if (n.empty()) return;
    const std::string nom = n.utf8_string();
    changerStructure([&](nlohmann::ordered_json& d) { stRenommer(d, "cgeo", id, nom); });
    choisirConstruction(id);
  } else if (choix == M_VOIR) {
    changerStructure([&](nlohmann::ordered_json& d) { stBasculerVisible(d, "cgeo", id); });
    choisirConstruction(id);
  } else if (choix == M_EDITER) {
    choisirConstruction(id);
  } else if (choix == C_XY) {
    creerEsquisseConstruction(id, kind == "frame" ? "XY" : "");
  } else if (choix == C_XZ) {
    creerEsquisseConstruction(id, "XZ");
  } else if (choix == C_YZ) {
    creerEsquisseConstruction(id, "YZ");
  } else if (choix == M_SUPPRIMER) {
    if (!confirmerSuppression(tx(questionSuppressionConstruction(doc_, id)))) return;
    changerStructure([&](nlohmann::ordered_json& d) { supprimerConstruction(d, id); }, L"Ctrl+Z : annuler.");
  }
}

// Clic droit dans la vue 3D : le corps sous la souris (showCtx3D)
void Cadre::surDroit3D(const TopoDS_Shape& sous) {
  if (enChoix() || esquisseOuverte_ >= 0 || !docOuvert_) return;
  if (!sous.IsNull())
    for (const auto& [id, s] : formesCorps_) {
      TopTools_IndexedMapOfShape carte;
      TopExp::MapShapes(s, sous.ShapeType(), carte);
      if (carte.Contains(sous)) return menuCorps(id, true);
    }
  if (doc_.corpsMasques.empty()) return;
  wxMenu m;
  m.Append(M_TOUT, L"✅ Tout afficher");
  if (choisirMenu(m) == M_TOUT) changerStructure([](nlohmann::ordered_json& d) { stCorpsMasques(d, {}); });
}

void Cadre::menuCorps(const std::string& id, bool vue3d) {
  const size_t rang = std::find(doc_.corps.begin(), doc_.corps.end(), id) - doc_.corps.begin();
  if (rang >= doc_.corps.size()) return;
  const wxString nomActuel = rang < doc_.nomsCorps.size() ? tx(doc_.nomsCorps[rang]) : wxString();
  int nb = 0;
  for (const Fonction& f : doc_.fonctions)
    if (f.corps == id && f.repeatId.empty()) nb++;
  wxMenu m;
  if (vue3d) {
    m.Append(wxID_ANY, nomActuel)->Enable(false);
    m.Append(M_VOIR, L"🙈 Masquer");
    m.Append(M_FANTOME, L"👻 Transparent (25 %)");
    m.Append(M_ISOLER, L"🎯 Isoler");
    m.Append(M_TOUT, L"✅ Tout afficher");
  } else {
    m.Append(M_RENOMMER, L"✏️ Renommer");
    m.Append(M_VOIR, L"👁 Afficher / masquer");
    m.Append(M_ACTIF, L"● Corps actif")->Enable(id != doc_.corpsActif);
  }
  m.AppendSeparator();
  if (vue3d) m.Append(wxID_HIGHEST + 7390, L"✨ Matériau de rendu…");
  m.Append(M_COULEUR, L"🎨 Couleur…");
  m.Append(wxID_HIGHEST + 7391, L"🔆 Intensité…");
  m.Append(M_TRANSPARENCE, L"👻 Transparence…");
  m.AppendSeparator();
  m.Append(M_DEPLACER, L"✥ Déplacer…");
  m.Append(M_ECHELLE, L"⤡ Échelle…");
  m.Append(M_STEP, L"⬇ Exporter ce corps en STEP…");
  m.Append(M_RETIRER, L"⊘ Retirer (étape de la timeline)");
  if (!vue3d) m.Append(M_SUPPRIMER, L"🗑 Supprimer");
  if (!vue3d) {
    m.Append(M_DEPUIS_CORPS, L"🧩 Créer un composant depuis ce corps");
    m.Append(M_VERS_COMPOSANT_CORPS, L"➡ Déplacer vers un composant…");
  }
  const int choix = choisirMenu(m);
  if (choix == wxID_HIGHEST + 7390) {
    // Le menu des matériaux de l'atelier Rendu ; la vue en ambiance suit tout de suite
    plan::J racine;
    const plan::J r = renduDocCourant(racine);
    const std::vector<PieceRendu> L = renduPieces(racine);
    atelierRendu_->preparerMenu(L, r);
    for (size_t i = 0; i < L.size(); i++)
      if (L[i].id == id) atelierRendu_->menuPiece(static_cast<int>(i), this);
  } else if (choix == M_STEP) {
    exporter("step", id);
  } else if (choix == M_DEPLACER) {
    creerFonction([&](nlohmann::ordered_json& d) { return creerDeplacement(d, id, indiceMarque()); }, L"Déplacer : ajoutez une translation ou une rotation dans Paramètres.");
  } else if (choix == M_ECHELLE) {
    creerFonction([&](nlohmann::ordered_json& d) { return creerEchelle(d, id, indiceMarque()); }, L"Échelle : réglez le facteur et le centre dans Paramètres.");
  } else if (choix == M_FANTOME) {
    changerStructure([&](nlohmann::ordered_json& d) { stReglerCorps(d, id, "op", 0.25); });
  } else if (choix == M_ISOLER) {
    std::vector<std::string> autres;
    for (const std::string& c : doc_.corps)
      if (c != id) autres.push_back(c);
    changerStructure([&](nlohmann::ordered_json& d) { stCorpsMasques(d, autres); });
  } else if (choix == M_TOUT) {
    changerStructure([](nlohmann::ordered_json& d) { stCorpsMasques(d, {}); });
  } else if (choix == M_RENOMMER) {
    const wxString n = demanderNom(nomActuel);
    if (n.empty()) return;
    const std::string nom = n.utf8_string();
    changerStructure([&](nlohmann::ordered_json& d) { stRenommer(d, "bodies", id, nom); });
  } else if (choix == M_VOIR) {
    changerStructure([&](nlohmann::ordered_json& d) { stBasculerVueCorps(d, id); });
  } else if (choix == M_DEPUIS_CORPS) {
    asmDepuisCorps({id});
  } else if (choix == M_VERS_COMPOSANT_CORPS) {
    asmDeplacerVers(true, id);
  } else if (choix == M_ACTIF) {
    changerStructure([&](nlohmann::ordered_json& d) { stCorpsActif(d, id); });
  } else if (choix == M_COULEUR) {
    const unsigned c0 = rang < doc_.couleursCorps.size() ? doc_.couleursCorps[rang] : 0;
    const wxColour c = essaiMenu_ ? wxColour(std::stoi(essaiNom_, nullptr, 16) >> 16, (std::stoi(essaiNom_, nullptr, 16) >> 8) & 255, std::stoi(essaiNom_, nullptr, 16) & 255) : wxGetColourFromUser(this, wxColour((c0 >> 16) & 255, (c0 >> 8) & 255, c0 & 255));
    if (!c.IsOk()) return;
    const double v = (c.Red() << 16) | (c.Green() << 8) | c.Blue();
    changerStructure([&](nlohmann::ordered_json& d) { stReglerCorps(d, id, "color", v); });
  } else if (choix == M_TRANSPARENCE) {
    // On voit l'intérieur de la pièce : poches, perçages, arêtes cachées
    const int t0 = static_cast<int>(std::lround((1 - (rang < doc_.verresCorps.size() ? doc_.verresCorps[rang] : 1)) * 100));
    const long t = essaiMenu_ ? std::stol(essaiNom_) : wxGetNumberFromUser(L"0 % : opaque. On voit au travers de la pièce : poches, perçages, arêtes cachées.", L"Transparence (%) :", L"Transparence", t0, 0, 90, this);
    if (t < 0) return;
    changerStructure([&](nlohmann::ordered_json& d) { stReglerCorps(d, id, "gl", t > 0 ? 1 - t / 100.0 : 0.0); });
  } else if (choix == wxID_HIGHEST + 7391) {
    // La pièce s'estompe sur le fond sans montrer son intérieur
    const int op0 = static_cast<int>(std::lround((rang < doc_.intensitesCorps.size() ? doc_.intensitesCorps[rang] : 1) * 100));
    const long op = essaiMenu_ ? std::stol(essaiNom_) : wxGetNumberFromUser(L"100 % : opaque. La pièce s'estompe sur le fond sans perdre son éclat.", L"Intensité (%) :", L"Intensité", op0, 15, 100, this);
    if (op < 0) return;
    changerStructure([&](nlohmann::ordered_json& d) { stReglerCorps(d, id, "op", op / 100.0); });
  } else if (choix == M_RETIRER) {
    std::string refus;
    const int marque = indiceMarque();
    changerStructure([&](nlohmann::ordered_json& d) { refus = stRetirerCorps(d, id, marque); }, L"Corps retiré à partir de cette étape : supprimez l'étape pour le faire revenir.");
    if (!refus.empty()) etat(tx(refus));
  } else if (choix == M_SUPPRIMER) {
    const wxString q = wxString::Format(L"Supprimer « %s »%s ? Les autres corps sont conservés.", nomActuel, nb ? wxString::Format(L" et ses %d fonction(s)", nb) : wxString());
    if (!confirmerSuppression(q)) return;
    changerStructure([&](nlohmann::ordered_json& d) { stSupprimerCorps(d, id); }, L"Ctrl+Z : annuler.");
  }
}

// L'œil d'une ligne : la même bascule que « Afficher / masquer » de son menu
void Cadre::oeilArbre(const wxTreeItemId& ligne) {
  if (!ligne.IsOk() || enChoix() || esquisseOuverte_ >= 0) return;
  const auto* lien = dynamic_cast<LienArbre*>(arbre_->GetItemData(ligne));
  if (!lien) return;
  const std::string corps = lien->corps, cg = lien->cg;
  const bool estFonction = lien->estFonction;
  const int i = lien->i;
  if (!cg.empty()) {
    const std::string id = cg;
    changerStructure([&](nlohmann::ordered_json& d) { stBasculerVisible(d, "cgeo", id); });
  } else if (!corps.empty()) {
    changerStructure([&](nlohmann::ordered_json& d) { stBasculerVueCorps(d, corps); });
  } else if (i >= 0 && estFonction) {
    const std::string id = doc_.fonctions[i].id;
    changerStructure([&](nlohmann::ordered_json& d) { stBasculerVisible(d, "features", id); });
  } else if (i >= 0) {
    const std::string id = doc_.esquisses[i].id;
    changerStructure([&](nlohmann::ordered_json& d) { stBasculerVisible(d, "sketches", id); });
  }
}

void Cadre::surArbreMenu(wxTreeEvent& e) {
  if (enChoix() || esquisseOuverte_ >= 0 || !docOuvert_) return;
  const auto* lien = dynamic_cast<LienArbre*>(arbre_->GetItemData(e.GetItem()));
  if (!lien) return;
  if (asmSurArbreMenu(lien)) return;
  const std::string corps = lien->corps, cg = lien->cg;
  const bool estFonction = lien->estFonction;
  const int i = lien->i;
  if (!cg.empty()) return menuConstruction(cg);
  // Le menu peut refaire l'arbre : rien de la ligne n'est gardé
  if (!corps.empty()) return menuCorps(corps);
  if (i < 0) return;
  if (estFonction) menuFonction(i);
  else menuEsquisseArbre(i);
}

void Cadre::surArbre(wxTreeEvent& e) {
  if (enChoix()) return;  // le panneau reste celui du congé en cours
  const auto* lien = dynamic_cast<LienArbre*>(arbre_->GetItemData(e.GetItem()));
  if (asmSansEvenement_ || asmSurArbre(lien)) return;
  if (!pioche_ && lotClic(lien, wxGetKeyState(WXK_CONTROL), wxGetKeyState(WXK_SHIFT))) return;
  if (pioche_ && !refAttendue_.empty() && lien && (!lien->plan.empty() || !lien->cg.empty()) && lien->cg != refAttendue_) {  // cgTreePick
    const std::string id = refAttendue_, cle = "r/" + std::to_string(rangAttendu_), val = lien->cg.empty() ? "o:" + lien->plan : "cg:" + lien->cg;
    CallAfter([this, id, cle, val] { reglerConstruction(id, cle, val); });
    return;
  }
  if (lien && lien->plan == "temps") {
    CallAfter([this] { marquerTemps(std::string()); });
    return;
  }
  if (lien && !lien->cg.empty()) return montrerConstruction(lien->cg);
  if (!lien || lien->i < 0) return montrerRien();
  if (lien->estFonction) montrerFonction(lien->i);
  else montrerEsquisse(lien->i);
}

std::string Cadre::idDeLigne(const LienArbre* l, std::string* sorte) const {
  if (!l || l->sorte != LienArbre::PIECE || !l->corps.empty()) return {};
  const auto dit = [&](const char* s) {
    if (sorte) *sorte = s;
  };
  if (!l->cg.empty()) return dit("cg"), l->cg;
  if (l->i < 0) return {};
  if (l->estFonction) return l->i < static_cast<int>(doc_.fonctions.size()) ? (dit("f"), doc_.fonctions[l->i].id) : std::string();
  return l->i < static_cast<int>(doc_.esquisses.size()) ? (dit("s"), doc_.esquisses[l->i].id) : std::string();
}

// treeSelClick : vrai si le clic a fait le lot. Le panneau suit la ligne cliquée, comme le navigateur.
bool Cadre::lotClic(const LienArbre* l, bool ctrl, bool maj) {
  std::string sorte;
  const std::string id = idDeLigne(l, &sorte);
  if (id.empty() || (!ctrl && !maj)) {
    lotVider();
    lotAncre_ = lotDernier_ = id;
    return false;
  }
  if (maj) {
    std::vector<std::string> ord;
    if (sorte == "f") for (const auto& f : doc_.fonctions) ord.push_back(f.id);
    if (sorte == "s") for (const auto& s : doc_.esquisses) ord.push_back(s.id);
    if (sorte == "cg") for (const auto& c : doc_.construction) ord.push_back(c.id);
    const auto rang = [&](const std::string& x) {
      const auto k = std::find(ord.begin(), ord.end(), x);
      return k == ord.end() ? -1 : static_cast<int>(k - ord.begin());
    };
    int a = rang(lotAncre_) >= 0 ? rang(lotAncre_) : rang(lotDernier_);
    const int b = rang(id);
    if (b < 0) return false;
    if (a < 0) a = b;
    if (!ctrl) lotArbre_.clear();
    for (int k = std::min(a, b); k <= std::max(a, b); k++)
      if (std::find(lotArbre_.begin(), lotArbre_.end(), ord[k]) == lotArbre_.end()) lotArbre_.push_back(ord[k]);
  } else {
    // le clic simple d'avant n'est pas encore dans le lot : il en fait partie
    if (lotArbre_.empty() && !lotDernier_.empty() && lotDernier_ != id) lotArbre_.push_back(lotDernier_);
    const auto k = std::find(lotArbre_.begin(), lotArbre_.end(), id);
    if (k != lotArbre_.end()) lotArbre_.erase(k);
    else lotArbre_.push_back(id);
    lotAncre_ = id;
  }
  lotDernier_ = id;
  lotMontrer();
  etat(lotArbre_.empty() ? wxString(L"Sélection vidée.") : wxString::Format(L"%zu élément(s) sélectionné(s) — Suppr pour supprimer, Échap pour désélectionner.", lotArbre_.size()));
  return false;  // le panneau de propriétés suit le dernier clic
}

void Cadre::lotMontrer() {
  const auto dedans = [&](const std::string& id) { return std::find(lotArbre_.begin(), lotArbre_.end(), id) != lotArbre_.end(); };
  const auto peindre = [&](const wxTreeItemId& l, const std::string& id) {
    if (l.IsOk()) arbre_->SetItemBackgroundColour(l, dedans(id) ? th(wxColour(0x0a, 0x4a, 0x8a)) : wxNullColour);
  };
  for (size_t i = 0; i < lignesFonctions_.size() && i < doc_.fonctions.size(); i++) peindre(lignesFonctions_[i], doc_.fonctions[i].id);
  for (size_t i = 0; i < lignesEsquisses_.size() && i < doc_.esquisses.size(); i++) peindre(lignesEsquisses_[i], doc_.esquisses[i].id);
  for (const auto& [id, l] : lignesConstruction_) peindre(l, id);
}

bool Cadre::lotVider() {
  if (lotArbre_.empty()) return false;
  lotArbre_.clear();
  lotMontrer();
  etat(L"Sélection vidée.");
  return true;
}

// treeDeleteSel
bool Cadre::lotSupprimer() {
  std::vector<std::string> lot = lotArbre_;
  if (lot.empty()) {
    const wxTreeItemId ligne = arbre_->GetSelection();
    const std::string id = ligne.IsOk() ? idDeLigne(dynamic_cast<LienArbre*>(arbre_->GetItemData(ligne))) : std::string();
    if (id.empty()) return false;
    lot.push_back(id);
  }
  const nlohmann::ordered_json j = documentJson(doc_);
  const BilanLot b = stBilanLot(j, lot);
  if (!b.total()) return false;
  wxString msg;
  if (b.total() == 1 && b.constructions.size() == 1) msg = tx(questionSuppressionConstruction(doc_, b.constructions[0]));
  else if (b.total() == 1) msg = L"Supprimer « " + tx(b.noms[0]) + L" » ?";
  else {
    wxArrayString p;
    if (!b.esquisses.empty()) p.Add(wxString::Format(L"%zu esquisse(s)", b.esquisses.size()));
    if (!b.constructions.empty()) p.Add(wxString::Format(L"%zu élément(s) de construction", b.constructions.size()));
    if (b.fonctions.size() + b.dependances.size()) p.Add(wxString::Format(L"%zu fonction(s)", b.fonctions.size() + b.dependances.size()));
    msg = L"Supprimer ";
    for (size_t k = 0; k < p.size(); k++) msg += (k ? L", " : L"") + p[k];
    msg += L" ?\n";
    for (const std::string& n : b.noms) msg += L"\n· " + tx(n);
  }
  if (!b.dependances.empty()) msg += wxString::Format(L"\n\n%zu fonction(s) en dépendent : elles seront supprimées aussi.", b.dependances.size());
  if (b.sansHote) msg += wxString::Format(L"\n%d esquisse(s) sont posées sur ses faces : elles resteront, sans hôte.", b.sansHote);
  if (!confirmerSuppression(msg)) return true;
  if (std::find(b.fonctions.begin(), b.fonctions.end(), marqueTemps_) != b.fonctions.end() || std::find(b.dependances.begin(), b.dependances.end(), marqueTemps_) != b.dependances.end()) marqueTemps_.clear();
  wxString noms;
  for (const std::string& n : b.noms) noms += (noms.empty() ? L"" : L", ") + tx(n);
  lotArbre_.clear();
  lotAncre_.clear(), lotDernier_.clear();
  changerStructure([&](nlohmann::ordered_json& d) { stSupprimerLot(d, b); }, L"🗑 Supprimé : " + noms + L"  —  Ctrl+Z pour annuler.");
  return true;
}

void Cadre::surArbreActive(wxTreeEvent& e) {
  const auto* lien = dynamic_cast<LienArbre*>(arbre_->GetItemData(e.GetItem()));
  if (asmSurArbreActive(lien)) return;
  if (lien && !lien->cg.empty()) {
    for (const ElementConstruction& c : doc_.construction)
      if (c.id == lien->cg && (c.kind == "plane" || c.kind == "frame")) return creerEsquisseConstruction(c.id, c.kind == "frame" ? "XY" : "");
  } else if (lien && lien->plan.size() == 2) creerEsquisse(lien->plan);
  else if (lien && !lien->estFonction && lien->i >= 0) entrerEsquisse(lien->i);
  else if (lien && lien->estFonction && lien->i >= 0 && fonctionDeFaces(doc_.fonctions[lien->i])) entrerFaces(sorteDeFaces(doc_.fonctions[lien->i]), doc_.fonctions[lien->i].id);
  else e.Skip();  // dépliage habituel des dossiers
}

void Cadre::surPropriete(wxPropertyGridEvent& e) {
  if (faces_) {
    const std::string cle = e.GetPropertyName().utf8_string();
    std::string valeur;
    if (const auto it = facesListes_.find(cle); it != facesListes_.end()) {
      const long k = e.GetValue().GetLong();
      if (k >= 0 && k < static_cast<long>(it->second.size())) valeur = it->second[k];
    } else if (e.GetValue().GetType() == L"bool") {
      valeur = e.GetValue().GetBool() ? "1" : "0";
    } else {
      valeur = e.GetValue().GetString().utf8_string();
    }
    CallAfter([this, cle, valeur] { reglerFaces(cle, valeur); });
    return;
  }
  if (choix_) {
    proprieteConge(e.GetPropertyName(), e.GetValue());
    return;
  }
  if (e.GetPropertyName().StartsWith(L"fiche:")) {
    const std::string cle = e.GetPropertyName().Mid(6).utf8_string();
    std::string valeur;
    if (const auto it = ficheChoix_.find(cle); it != ficheChoix_.end()) {
      const long k = e.GetValue().GetLong();
      if (k >= 0 && k < static_cast<long>(it->second.size())) valeur = it->second[k];
      if (valeur.empty() && (cle.rfind("x/", 0) == 0 || cle.rfind("r/", 0) == 0)) return;  // « — » : rien à faire
    } else if (e.GetValue().GetType() == L"bool") {
      valeur = e.GetValue().GetBool() ? "1" : "0";
    } else {
      valeur = e.GetValue().GetString().utf8_string();
    }
    const std::string id = ficheId_;
    if (!id.empty()) CallAfter([this, id, cle, valeur] { appliquerFiche(id, cle, valeur); });
    return;
  }
  if (fonctionMontree_ < 0) return;
  const int fonction = fonctionMontree_;
  const wxString nom = e.GetPropertyName();
  std::function<void(Fonction&)> reglage;
  if (nom == PROP_PROFONDEUR) {
    wxString t = e.GetValue().GetString();
    t.Replace(",", ".");
    double v = 0;
    if (!t.ToCDouble(&v) || !std::isfinite(v) || v == 0) {
      wxMessageBox(L"Saisir un nombre différent de zéro, en millimètres.", L"Cote incorrecte", wxOK | wxICON_WARNING, this);
      props_->SetPropertyValue(PROP_PROFONDEUR, wxString::Format("%.10g", std::abs(doc_.fonctions[fonction].distance)));
      return;
    }
    reglage = [v](Fonction& f) { reglerProfondeur(f, v); };
  } else if (nom == L"depouille") {
    const std::string idF = doc_.fonctions[fonction].id;
    const wxString t = e.GetValue().GetString();
    CallAfter([this, idF, t] { dynDepouille(idF, t); });
    return;
  } else {
    return;
  }
  CallAfter([this, fonction, reglage] { modifierFonction(fonction, reglage); });  // jamais de recalcul au milieu de l'événement de la grille
}

// ---- Congé et chanfrein : le choix des arêtes (enterExactFilletMode, renderExactPanel, applyExactFillet) ----
void Cadre::entrerConge(bool chanfrein) {
  if (!docOuvert_) return etat(L"Ouvrez d'abord une pièce (Ctrl+O).");
  if (esquisseOuverte_ >= 0) quitterEsquisse();
  quitterConge();
  const wxString nom = chanfrein ? L"Chanfrein" : L"Congé";
  if (!solideCalculable_ || forme_.IsNull()) return etat(nom + L" : le solide de cette pièce n'est pas encore calculé par ce programme.");
  wxBusyCursor attente;
  auto c = std::make_unique<ChoixConge>(doc_, forme_, chanfrein, chanfrein ? memoChanfrein_ : memoConge_, memoTangentes_);
  if (chanfrein) {
    OptChanfrein oc = memoCham_;
    oc.flip = false;
    c->optionsChanfrein(oc);
  }
  if (c->vives().empty()) return etat(nom + L" : aucune arête vive (que du tangentiel lisse).");
  choix_ = std::move(c);
  const auto compose = [](const std::vector<AreteVue>& l) {
    TopoDS_Compound k;
    BRep_Builder b;
    b.MakeCompound(k);
    for (const AreteVue& a : l) b.Add(k, a.arete);
    return k;
  };
  vue_->debutChoix(compose(choix_->vives()), compose(choix_->lisses()));
  messageConge_ = tx(choix_->libelle()) + wxString::Format(L" : cliquez des arêtes vives (%zu, affichées noires — les grises sont des raccords lisses) ou une face (toute sa boucle).", choix_->vives().size());
  rafraichirConge();
}

void Cadre::quitterConge() {
  if (faces_) quitterFaces();
  if (!choix_) return;
  choix_.reset();
  vue_->finChoix();
  carteDroite_->contenu()->Show(rangConge_, false);
  montrerAtelier();
  montrerRien();
  carteDroite_->Layout();
  etat(tx(doc_.nom));
  // Une modification abandonnée : la pièce revient entière
  if (!editionConge_.empty()) {
    editionConge_.clear();
    marquerTemps(marqueAvantEdition_);
  }
}

// enterExactFilletMode(f) : la pièce rejouée jusque juste avant la fonction, ses arêtes déjà choisies
void Cadre::editerConge(int i) {
  if (esquisseOuverte_ >= 0) quitterEsquisse();
  quitterConge();
  const Fonction f = doc_.fonctions[i];
  const std::string avant = marqueTemps_;
  marquerTemps(f.id);
  entrerConge(f.chamfer);
  if (!choix_) return marquerTemps(avant);
  marqueAvantEdition_ = avant;
  editionConge_ = f.id;
  choix_->charger(f);
  messageConge_ = L"Édition « " + tx(f.nom) + wxString::Format(L" » : clic sur une arête ou une face : ajouter ou retirer · %zu arêtes · OK valide, Échap restitue.", choix_->vives().size());
  rafraichirConge();
}

void Cadre::cliqueConge(const TopoDS_Shape& s) {
  messageConge_ = tx(choix_->cliquer(s));
  rafraichirConge();
}

// Le panneau, le trait des arêtes choisies, l'aperçu
void Cadre::rafraichirConge() {
  ChoixConge& c = *choix_;
  const bool ch = c.chanfrein();
  const wxString dp = ch ? L"D" : L"R";
  fonctionMontree_ = -1;
  wxBusyCursor attente;
  const ApercuConge& a = c.apercu();
  if (!a.forme.IsNull()) mailler(a.forme, parallele());
  TopoDS_Compound k;
  BRep_Builder b;
  b.MakeCompound(k);
  int nb = 0;
  for (int i : c.germes()) {
    b.Add(k, c.vives()[i].arete);
    nb++;
  }
  vue_->montrerChoix(nb ? TopoDS_Shape(k) : TopoDS_Shape(), a.forme, a.nouvelles);

  props_->Freeze();
  props_->Clear();
  props_->CenterSplitter();
  props_->Append(new wxPropertyCategory(tx(c.libelle())));
  props_->Append(new wxStringProperty(ch ? L"Distance par défaut (mm)" : L"Rayon par défaut (mm)", PROP_CONGE_RAYON, wxString::Format("%.10g", c.rayon())));
  if (ch) {
    const OptChanfrein& oc = c.optionsChanfrein();
    wxPGChoices types;
    types.Add(L"Distance égale", 0);
    types.Add(L"Deux distances", 1);
    types.Add(L"Distance + angle", 2);
    props_->Append(new wxEnumProperty(L"Type", PROP_CHAM_TYPE, types, oc.mode == "d2" ? 1 : oc.mode == "da" ? 2 : 0));
    if (oc.actif()) {
      const bool da = oc.mode == "da";
      props_->Append(new wxStringProperty(da ? L"Angle (°)" : L"Distance 2 (mm)", PROP_CHAM_VALEUR, wxString::Format("%.10g", da ? oc.ang : oc.d2)));
      props_->SetPropertyAttribute(props_->Append(new wxBoolProperty(L"⇄ Inverser les faces", PROP_CHAM_FLIP, oc.flip)), wxPG_BOOL_USE_CHECKBOX, true);
    }
  }
  props_->SetPropertyAttribute(props_->Append(new wxBoolProperty(L"Arêtes tangentes", PROP_CONGE_TANGENTES, c.tangent())), wxPG_BOOL_USE_CHECKBOX, true);
  for (size_t i = 0; i < c.selection().size(); i++) {
    const SelConge& s = c.selection()[i];
    props_->Append(new wxStringProperty(wxString::Format(L"%zu : %s · L%.1f", i + 1, dp, s.len), wxString::Format("%s%zu", PROP_CONGE_ARETE, i), wxString::Format("%.10g", s.r)));
  }
  props_->SetSplitterPosition(FromDIP(170));
  props_->Thaw();

  wxString note = c.tangent() ? wxString(L"Clic = une arête (le ") + (ch ? L"chanfrein" : L"congé") + L" suit sa chaîne tangente) · clic sur une arête choisie = la retirer."
                              : wxString(L"Clic = ajouter / retirer une arête, sans recherche de tangences.");
  if (ch && c.optionsChanfrein().actif())
    note += (c.optionsChanfrein().mode == "da" ? wxString(L"\nD1 (distance par arête) sur la première face, angle mesuré entre le chanfrein et cette face.") : wxString(L"\nD1 (distance par arête) sur la première face, D2 sur l'autre.")) + L" Première face : celle qui regarde le plus vers le haut, sinon vers +X puis +Y.";
  if (!c.selection().empty()) {
    note += wxString::Format(L"\n%zu arête(s) retenue(s).\n", c.selection().size());
    if (!a.forme.IsNull()) note += L"Aperçu : la pièce telle qu'elle sera, les nouvelles faces en orange.";
    else if (!a.message.empty()) note += L"Aperçu impossible — " + tx(a.message);
    else note += L"Aperçu indisponible.";
  }
  noteDroite_->SetMinSize(wxDefaultSize);
  noteDroite_->SetLabel(note);
  noteDroite_->Wrap(-1);  // sans cela, wxWidgets ne recoupe pas le nouveau texte à la même largeur
  noteDroite_->Wrap(FromDIP(255));
  noteDroite_->InvalidateBestSize();
  noteDroite_->SetMinSize(noteDroite_->GetBestSize());
  noteMontree_ = !noteMontree_;  // que ajusterDroite remette la note à sa nouvelle taille
  carteDroite_->contenu()->Show(rangConge_, true);
  hauteurDroite_ = 0;
  ajusterDroite();
  carteDroite_->Layout();
  etat(!a.message.empty() ? tx(c.libelle()) + L" : " + tx(a.message) : messageConge_);
}

void Cadre::appliquerChoixConge() {
  if (faces_) return appliquerChoixFaces();
  if (!choix_) return;
  const wxString nom = tx(choix_->libelle());
  if (choix_->selection().empty()) return etat(nom + L" : sélectionnez au moins une arête.");
  for (const SelConge& s : choix_->selection())
    if (!(s.r > 0)) return etat(nom + (choix_->chanfrein() ? L" : distance invalide." : L" : rayon invalide."));
  if (!editionConge_.empty()) {
    // Édition en place : pas de seconde fonction
    Document copie = doc_;
    const Fonction g = choix_->creer(copie, formesCorps_);
    const std::string id = editionConge_;
    const nlohmann::ordered_json neuf = nlohmann::ordered_json::parse(texteCongeCree(g));
    const int nomsArete = copie.nomsArete;
    editionConge_.clear();
    quitterConge();
    marqueTemps_ = marqueAvantEdition_;
    changerStructure([&](nlohmann::ordered_json& d) {
      for (auto& x : d["features"])
        if (x.value("id", std::string()) == id) {
          x["edges"] = neuf["edges"];
          x["tangent"] = neuf["tangent"];
          x["name"] = neuf["name"];
          for (const char* k : {"cmode", "cd2", "cang", "cflip"}) {
            if (neuf.contains(k)) x[k] = neuf[k];
            else x.erase(k);
          }
        }
      d["entNames"]["edge"] = nomsArete;
    }, L"Ctrl+Z : annuler.");
    for (size_t k = 0; k < doc_.fonctions.size(); k++)
      if (doc_.fonctions[k].id == id) choisirFonction(static_cast<int>(k));
    return;
  }
  Fonction f = choix_->creer(doc_, formesCorps_);
  quitterConge();
  ModifCote m;
  m.esquissesAvant = doc_.esquisses;
  m.avecFonctions = true;
  m.fonctionsAvant = doc_.fonctions;
  annulations_.push_back(std::move(m));
  retablissements_.clear();
  doc_.fonctions.push_back(std::move(f));
  remplirArbre();
  majTitre();
  recalculer();
  choisirFonction(static_cast<int>(doc_.fonctions.size()) - 1);
}

bool Cadre::proprieteConge(const wxString& nom, const wxVariant& valeur) {
  const auto lire = [&](double& v) {
    wxString t = valeur.GetString();
    t.Replace(",", ".");
    return t.ToCDouble(&v) && std::isfinite(v) && v > 0;
  };
  ChoixConge* c = choix_.get();
  double v = 0;
  if (nom == PROP_CHAM_TYPE) {
    OptChanfrein o = c->optionsChanfrein();
    const long k = valeur.GetLong();
    o.mode = k == 1 ? "d2" : k == 2 ? "da" : "eq";
    c->optionsChanfrein(o);
    memoCham_ = o;
  } else if (nom == PROP_CHAM_FLIP) {
    OptChanfrein o = c->optionsChanfrein();
    o.flip = valeur.GetBool();
    c->optionsChanfrein(o);
  } else if (nom == PROP_CHAM_VALEUR) {
    OptChanfrein o = c->optionsChanfrein();
    const bool da = o.mode == "da";
    if (!lire(v) || (da && v >= 90)) {
      etat(da ? L"Angle du chanfrein : 0 < a < 90°." : L"Distance 2 : valeur strictement positive.");
      CallAfter([this] { if (choix_) rafraichirConge(); });
      return true;
    }
    (da ? o.ang : o.d2) = v;
    c->optionsChanfrein(o);
    memoCham_ = o;
    memoCham_.flip = false;
  } else if (nom == PROP_CONGE_TANGENTES) {
    memoTangentes_ = valeur.GetBool();
    c->tangentes(memoTangentes_);
  } else if (nom == PROP_CONGE_RAYON) {
    if (!lire(v)) {
      etat(L"Saisir un nombre positif, en millimètres.");
      CallAfter([this] { if (choix_) rafraichirConge(); });
      return true;
    }
    (c->chanfrein() ? memoChanfrein_ : memoConge_) = v;
    c->rayonDefaut(v);
  } else if (nom.StartsWith(PROP_CONGE_ARETE)) {
    if (!lire(v)) {
      etat(L"Saisir un nombre positif, en millimètres.");
      CallAfter([this] { if (choix_) rafraichirConge(); });
      return true;
    }
    unsigned long i = 0;
    nom.Mid(strlen(PROP_CONGE_ARETE)).ToULong(&i);
    c->rayonArete(i, v);
  } else {
    return false;
  }
  CallAfter([this] { if (choix_) rafraichirConge(); });  // jamais de recalcul au milieu de l'événement de la grille
  return true;
}

// Essai de l'écran d'esquisse sans prendre la main : les boutons et la vue reçoivent de vrais événements.
// Scénario : une liste d'étapes {"outil":n} {"clic":[x,y],"ctrl":b} {"bouge":[x,y]} {"droit":[x,y],"choix":"libellé"}
// {"touche":"Enter"|"Escape"} {"texte":"12"} {"poly":[n,"d"]} {"capture":"nom"} {"annuler":1}. Le bilan note l'état après chaque étape.
bool Cadre::essaiEsquisse(const std::wstring& fichier, int rang, const std::wstring& sortie, const std::wstring& json, const std::wstring& dossier) {
  std::ifstream entree(json);
  const nlohmann::json etapes = nlohmann::json::parse(entree);
  essaiSansBoite_ = true;
  if (!ouvrir(fichier)) return false;
  wxYield();
  if (rang >= 0) entrerEsquisse(rang);
  else if (rang == -1) creerEsquisse("XY");  // -2 : aucune esquisse ouverte, pour les menus de la pièce
  wxYield();
  Dessin* d = vueEsquisse_->dessin();
  if (!d && rang != -2) return false;
  vueEsquisse_->essaiSansMenu = true;
  nlohmann::json bilan = nlohmann::json::array();
  std::string dernierMessage;
  for (const auto& e : etapes) {
    nlohmann::json n = e;
    if (e.contains("outil")) n["ok"] = barreEsquisse_->essaiCliquerOutil(static_cast<Dessin::Outil>(e["outil"].get<int>()));
    if (e.contains("bouge")) vueEsquisse_->essaiSouris(wxEVT_MOTION, e["bouge"][0], e["bouge"][1]);
    if (e.contains("clic")) {
      const bool ctrl = e.value("ctrl", false);
      vueEsquisse_->essaiMaj = e.value("maj", false);
      vueEsquisse_->essaiSouris(wxEVT_MOTION, e["clic"][0], e["clic"][1], ctrl);
      vueEsquisse_->essaiSouris(wxEVT_LEFT_DOWN, e["clic"][0], e["clic"][1], ctrl);
      vueEsquisse_->essaiSouris(wxEVT_LEFT_UP, e["clic"][0], e["clic"][1], ctrl);
    }
    if (e.contains("glisse")) {
      const auto& g = e["glisse"];
      const bool ctrl = e.value("ctrl", false);
      vueEsquisse_->essaiSouris(wxEVT_MOTION, g[0], g[1], ctrl);
      vueEsquisse_->essaiSouris(wxEVT_LEFT_DOWN, g[0], g[1], ctrl);
      vueEsquisse_->essaiSouris(wxEVT_MOTION, g[2], g[3], ctrl);
      if (e.contains("captureEnCours")) {
        wxYield();
        vueEsquisse_->Update();
        capturerFenetre(dossier + L"\\" + wxString::FromUTF8(e["captureEnCours"].get<std::string>()).ToStdWstring() + L".png");
      }
      vueEsquisse_->essaiSouris(wxEVT_LEFT_UP, g[2], g[3], ctrl);
      n["selection"] = d->selection().size();
    }
    if (e.contains("droit")) {
      vueEsquisse_->essaiChoixMenu = e.value("choix", std::string());
      vueEsquisse_->essaiEntreesMenu.clear();
      vueEsquisse_->essaiSouris(wxEVT_RIGHT_DOWN, e["droit"][0], e["droit"][1]);
      vueEsquisse_->essaiSouris(wxEVT_RIGHT_UP, e["droit"][0], e["droit"][1]);
      n["menu"] = vueEsquisse_->essaiEntreesMenu;
    }
    if (e.contains("touche")) {
      const std::string t = e["touche"];
      if (t == "Escape") vueEsquisse_->echapDessin();  // Échap passe par le cadre
      else vueEsquisse_->essaiTouche(t == "Enter" ? WXK_RETURN : t == "Delete" ? WXK_DELETE : (t[0] == 'F' && t.size() > 1) ? WXK_F1 + std::stoi(t.substr(1)) - 1 : t[0]);
    }
    if (e.contains("texte"))
      for (const char c : e["texte"].get<std::string>()) vueEsquisse_->essaiCaractere(c);
    if (e.contains("poly")) vueEsquisse_->essaiReglagesPolygone(wxString::Format("%d", e["poly"][0].get<int>()), wxString::FromUTF8(e["poly"][1].get<std::string>()));
    if (e.contains("mode")) vueEsquisse_->choisirModeTrace(e["mode"].get<std::string>());
    asmEtapeEssai(e, n);
    if (e.contains("nouveau")) nouveau();
    if (e.contains("nouvelleEsquisse")) creerEsquisse(e["nouvelleEsquisse"].get<std::string>());
    if (e.contains("quitterEsquisse")) quitterEsquisse();
    if (e.contains("menuFonction") || e.contains("menuEsquisse") || e.contains("menuCorps")) {
      essaiMenu_ = true;
      essaiChoix_ = e.value("choix", std::string());
      essaiNom_ = e.value("nom", std::string());
      const auto rangId = [](const auto& liste, const std::string& id) {
        for (size_t k = 0; k < liste.size(); k++)
          if (liste[k].id == id) return static_cast<int>(k);
        return -1;
      };
      if (e.contains("menuFonction")) menuFonction(rangId(doc_.fonctions, e["menuFonction"].get<std::string>()));
      else if (e.contains("menuEsquisse")) menuEsquisseArbre(rangId(doc_.esquisses, e["menuEsquisse"].get<std::string>()));
      else menuCorps(e["menuCorps"].get<std::string>());
      essaiMenu_ = false;
      n["etat"] = std::string(etatVue_->texte().utf8_str());
      n["menu"] = essaiEntrees_;
    }
    if (e.contains("marqueur")) bougerMarqueur(e["marqueur"].get<int>());
    if (e.contains("nouveauCorps")) nouveauCorps();
    if (e.contains("facePres")) cliqueFacePres({e["facePres"][0].get<double>(), e["facePres"][1].get<double>(), e["facePres"][2].get<double>()});
    if (e.contains("clic3d")) {
      wxYield();
      vue_->cliquerEn(vue_->pixelDe(e["clic3d"][0].get<double>(), e["clic3d"][1].get<double>(), e["clic3d"][2].get<double>()));
    }
    if (e.contains("champFaces")) reglerFaces(e["champFaces"][0].get<std::string>(), e["champFaces"][1].get<std::string>());
    if (e.contains("appliquerFaces")) {
      essaiMenu_ = true;
      appliquerChoixFaces();
      essaiMenu_ = false;
    }
    if (e.contains("quitterFaces")) quitterConge();
    if (e.contains("editerFaces"))
      for (const Fonction& f : doc_.fonctions)
        if (f.id == e["editerFaces"].get<std::string>()) {
          entrerFaces(sorteDeFaces(f), f.id);
          break;
        }
    if (e.contains("supprFaces")) {
      essaiMenu_ = true;
      n["suppr"] = supprimerFacesChoisies();
      essaiMenu_ = false;
    }
    if (faces_) {
      n["facesRetenues"] = faces_->faces.size();
      n["etat"] = std::string(etatVue_->texte().utf8_str());
    }
    if (e.contains("creer")) {
      essaiMenu_ = true;
      boutonRuban(Atelier::CAO, wxString::FromUTF8(e["creer"].get<std::string>()));
      essaiMenu_ = false;
      n["etat"] = std::string(etatVue_->texte().utf8_str());
      n["creee"] = ficheId_;
    }
    if (e.contains("fiche")) {
      essaiMenu_ = true;
      appliquerFiche(e["fiche"][0].get<std::string>() == "@" ? ficheId_ : e["fiche"][0].get<std::string>(), e["fiche"][1].get<std::string>(), e["fiche"][2].get<std::string>());
      essaiMenu_ = false;
      n["etat"] = std::string(etatVue_->texte().utf8_str());
    }
    if (e.contains("theme")) { essaiMenu_ = true; appliquerTheme(e["theme"].get<int>()); essaiMenu_ = false; }
    if (e.contains("iconesCouleur")) { essaiMenu_ = true; appliquerIcones(e["iconesCouleur"].get<bool>()); essaiMenu_ = false; }
    if (e.contains("dossierProjets")) {
      nlohmann::ordered_json l = nlohmann::ordered_json::array();
      for (const ProjetDossier& p : projetsDuDossier(wxString::FromUTF8(e["dossierProjets"].get<std::string>()))) l.push_back(std::string(p.nom.utf8_str()));
      n["projets"] = l;
    }
    if (e.contains("film")) {
      const plan::J& q = e["film"];
      const std::string v = q.value("mp4", std::string());
      filmLancer(q.value("rythme", 1.0), wxString::FromUTF8(v));
      n["etatLancement"] = std::string(etatVue_->texte().utf8_str());
      const int arret = q.value("arretApres", 0);
      int tours = 0;
      n["pleinEcran"] = IsFullScreen();
      const std::string avant = doc_.fonctions.empty() ? std::string() : marqueTemps_;
      while (film_) {
        filmPas();
        wxYield();
        wxMilliSleep(33);
        if (arret && tours == arret) filmStop();
        if (++tours > 100000) break;
      }
      n["pleinEcranApres"] = IsFullScreen();
      n["marque"] = marqueTemps_;
      n["etat"] = std::string(etatVue_->texte().utf8_str());
      n["modifie"] = doc_.modifie();
    }
    if (e.contains("uptoFace")) {
      const plan::J& q = e["uptoFace"];
      uptoChoisir(q["id"].get<std::string>());
      vue_->cliquerEn(vue_->pixelDe(q["p"][0].get<double>(), q["p"][1].get<double>(), q["p"][2].get<double>()));
      wxYield();
      n["etat"] = std::string(etatVue_->texte().utf8_str());
      for (const Fonction& f : doc_.fonctions)
        if (f.id == q["id"].get<std::string>()) {
          n["upto"] = f.upto;
          n["distance"] = f.distance;
          n["nom"] = f.nom;
        }
    }
    if (e.contains("congeEditer")) {
      const plan::J& q = e["congeEditer"];
      for (size_t k = 0; k < doc_.fonctions.size(); k++)
        if (doc_.fonctions[k].id == q["id"].get<std::string>()) {
          editerConge(static_cast<int>(k));
          break;
        }
      wxYield();
      if (choix_) {
        n["germes"] = choix_->germes().size();
        n["selection"] = choix_->selection().size();
        n["apercu"] = !choix_->apercu().forme.IsNull();
        n["cmode"] = choix_->optionsChanfrein().mode;
        n["message"] = std::string(messageConge_.utf8_str());
        if (q.contains("r")) { choix_->rayonDefaut(q["r"].get<double>()); rafraichirConge(); }
        if (q.value("capture", false)) capturerFenetre(dossier + L"\\t_edition.png");
        if (q.value("abandon", false)) quitterConge();
        else appliquerChoixConge();
        wxYield();
      }
      n["etat"] = std::string(etatVue_->texte().utf8_str());
      n["nbFonctions"] = doc_.fonctions.size();
      n["marque"] = marqueTemps_;
    }
    if (e.contains("annuler")) {
      annuler();
      wxYield();
      n["etat"] = std::string(etatVue_->texte().utf8_str());
      n["nbFonctions"] = doc_.fonctions.size();
      n["nbEsquisses"] = doc_.esquisses.size();
    }
    if (e.contains("retablir")) {
      retablir();
      wxYield();
      n["nbFonctions"] = doc_.fonctions.size();
      n["nbEsquisses"] = doc_.esquisses.size();
    }
    if (e.contains("figees")) {
      n["figees"] = plan::J::array();
      for (size_t k = 0; k < doc_.esquisses.size(); k++) n["figees"].push_back(esquisseFigee(doc_, k));
      n["profondeurs"] = plan::J::array();
      for (size_t k = 0; k < doc_.fonctions.size(); k++)
        if (doc_.fonctions[k].type == "extrude" && doc_.fonctions[k].visible && !doc_.profondeurModifiable(k)) n["profondeurs"].push_back(doc_.fonctions[k].id);
      n["nb"] = doc_.fonctions.size();
    }
    if (e.contains("arbreCherche")) {
      rechercheArbre_->SetValue(wxString::FromUTF8(e["arbreCherche"].get<std::string>()));
      n["lignes"] = plan::J::array();
      const std::function<void(const wxTreeItemId&)> voir = [&](const wxTreeItemId& l) {
        wxTreeItemIdValue c;
        for (wxTreeItemId x = arbre_->GetFirstChild(l, c); x.IsOk(); x = arbre_->GetNextChild(l, c)) {
          n["lignes"].push_back(std::string(arbre_->GetItemText(x).utf8_str()));
          voir(x);
        }
      };
      voir(arbre_->GetRootItem());
    }
    if (e.contains("bmPick")) {  // choisit dans le menu des options fixes, ou demande le clic sur une face
      const plan::J& q = e["bmPick"];
      essaiMenu_ = true;
      essaiChoix_ = q.value("choix", std::string());
      if (q.contains("id")) bmDemarrer(q["id"].get<std::string>(), q["want"].get<std::string>());
      else bmEtape();
      n["entrees"] = essaiEntrees_;
      if (q.contains("clic")) {
        essaiChoix_ = q["clic"]["choix"].get<std::string>();
        const auto& P = q["clic"]["p"];
        vue_->cliquerEn(vue_->pixelDe(P[0].get<double>(), P[1].get<double>(), P[2].get<double>()));
        wxYield();
        n["entreesFace"] = essaiEntrees_;
      }
      essaiMenu_ = false;
      n["etat"] = std::string(etatVue_->texte().utf8_str());
      for (const Fonction& f : doc_.fonctions)
        if (f.type == "bmove" || f.type == "bscale") n["nom"] = f.nom;
    }
    if (e.contains("choisir") && e["choisir"].is_string()) {
      for (size_t k = 0; k < doc_.fonctions.size(); k++)
        if (doc_.fonctions[k].id == e["choisir"].get<std::string>()) {
          choisirFonction(static_cast<int>(k));
          montrerFonction(static_cast<int>(k));
        }
      n["fonctionMontree"] = fonctionMontree_;
    }
    if (e.contains("zoneClic")) {
      majZones();
      n["zones"] = zones_.size();
      const Esquisse* s = fonctionMontree_ >= 0 && fonctionMontree_ < static_cast<int>(doc_.fonctions.size()) ? doc_.esquisse(doc_.fonctions[fonctionMontree_].esquisse) : nullptr;
      if (s) {
        const wxPoint p = vue_->ecranDe(pointMonde(*s, e["zoneClic"][0].get<double>(), e["zoneClic"][1].get<double>()));
        n["pris"] = zoneSousSouris(p, true);
      }
      majZones();
      n["etat"] = std::string(etatVue_->texte().utf8_str());
    }
    if (e.contains("lotClic")) {  // {"lotClic":{"id":"…","ctrl":1,"maj":0}}
      const auto& q = e["lotClic"];
      const std::string id = q["id"].get<std::string>();
      const wxTreeItemId* ligne = nullptr;
      for (size_t i = 0; i < doc_.fonctions.size() && i < lignesFonctions_.size(); i++) if (doc_.fonctions[i].id == id) ligne = &lignesFonctions_[i];
      for (size_t i = 0; i < doc_.esquisses.size() && i < lignesEsquisses_.size(); i++) if (doc_.esquisses[i].id == id) ligne = &lignesEsquisses_[i];
      if (const auto it = lignesConstruction_.find(id); it != lignesConstruction_.end()) ligne = &it->second;
      if (ligne && ligne->IsOk()) lotClic(dynamic_cast<LienArbre*>(arbre_->GetItemData(*ligne)), q.value("ctrl", 0) != 0, q.value("maj", 0) != 0);
      n["lot"] = lotArbre_;
    }
    if (e.contains("lotSuppr")) {
      essaiMenu_ = true;
      const nlohmann::ordered_json j = documentJson(doc_);
      n["lotAvant"] = lotArbre_;
      n["lotBilan"] = stBilanLot(j, lotArbre_).noms;
      n["lotSuppr"] = lotSupprimer();
      essaiMenu_ = false;
      n["nFonctions"] = doc_.fonctions.size();
      n["nEsquisses"] = doc_.esquisses.size();
    }
    if (e.contains("lotVider")) n["lotVide"] = lotVider();
    if (e.contains("filDouble")) {  // {"filDouble":"id"} : ce que ferait le double-clic sur le fil
      const std::string id = e["filDouble"].get<std::string>();
      for (const auto& x : std::vector<FilFonctions::Element>(fil_->liste()))
        if ((x.estFonction && x.i >= 0 && doc_.fonctions[x.i].id == id) || (!x.estFonction && x.cg.empty() && x.i >= 0 && doc_.esquisses[x.i].id == id) || x.cg == id) {
          fil_->surDouble(x);
          break;
        }
      n["filOuvert"] = {{"esquisse", esquisseOuverte_}, {"choix", enChoix()}, {"faces", static_cast<bool>(faces_)}};
    }
    if (e.contains("ficheLire")) {
      const std::string id = e["ficheLire"].get<std::string>() == "@" ? ficheId_ : e["ficheLire"].get<std::string>();
      if (doc_.fonctionsJson)
        if (const auto it = doc_.fonctionsJson->find(id); it != doc_.fonctionsJson->end())
          for (const ChampFiche& c : ficheFonction(doc_, nlohmann::ordered_json::parse(it->second))) {
            nlohmann::json x = {{"titre", c.titre}, {"cle", c.cle}, {"valeur", c.texte}};
            for (const auto& o : c.choix) x["choix"].push_back({o.first, o.second});
            n["champs"].push_back(x);
          }
    }
    if (e.contains("dyn")) dynEssai(e["dyn"], n);
    if (e.contains("script")) {
      const nlohmann::ordered_json r = scriptExecuter(e["script"].dump());
      n["script"] = nlohmann::json::parse(r.dump(-1, ' ', false, nlohmann::ordered_json::error_handler_t::replace));
      n["etat"] = std::string(etatVue_->texte().utf8_str());
      n["nb"] = doc_.fonctions.size();
      n["nbAnnul"] = annulations_.size();
    }
    if (e.contains("aide")) {
      wxDialog* f = creerAide(this);
      f->Show();
      wxYield();
      f->Update();
      const wxSize tf = f->GetSize();
      wxBitmap imageF(tf.x, tf.y, 32);
      {
        wxMemoryDC dc(imageF);
        PrintWindow(f->GetHWND(), static_cast<HDC>(dc.GetHDC()), 2);
      }
      imageF.ConvertToImage().SaveFile(dossier + L"\\" + wxString::FromUTF8(e["aide"].get<std::string>()).ToStdWstring() + L".png", wxBITMAP_TYPE_PNG);
      f->Destroy();
    }
    if (e.contains("journal")) journal::ajouter("essai", e["journal"].get<std::string>(), "D:\\Dossier\\Secret\\essai.cpp");
    if (e.contains("journalLire")) n["journal"] = journal::texte();
    if (e.contains("effacerTout") && barreEsquisse_->surEffacerTout) barreEsquisse_->surEffacerTout();
    if (e.contains("secours")) n["secours"] = secoursEssai(e["secours"].get<std::string>());
    if (e.contains("secoursBoite")) {
      wxDialog* b = secoursProposer();
      n["boite"] = b != nullptr;
      if (b) {
        for (int k = 0; k < 15; k++) {
          wxYield();
          b->Refresh();
          b->Update();
          Sleep(60);
        }
        wxBitmap image(b->GetSize().x, b->GetSize().y, 32);
        {
          wxMemoryDC dc(image);
          PrintWindow(b->GetHWND(), static_cast<HDC>(dc.GetHDC()), 2);
        }
        image.ConvertToImage().SaveFile(dossier + L"\\" + wxString::FromUTF8(e["secoursBoite"].get<std::string>()).ToStdWstring() + L".png", wxBITMAP_TYPE_PNG);
        b->Destroy();
      }
    }
    if (e.contains("planter")) {
      volatile int* zero = nullptr;
      *zero = 1;
    }
    if (e.contains("erreurBoucle")) CallAfter([] { throw std::runtime_error("erreur d'essai dans la boucle"); });
    if (e.contains("raccourci")) {
      essaiMenu_ = true;
      const std::string t = e["raccourci"].get<std::string>();
      const int code = t == "F5" ? WXK_F5 : t[0];
      n["pris"] = raccourciGlobal(code, 0, false, false, false, false);
      essaiMenu_ = false;
      n["etat"] = std::string(etatVue_->texte().utf8_str());
      n["choix"] = enChoix();
    }
    if (e.contains("cfg")) {
      const auto& c = e["cfg"];
      const auto tabl = [this]() { return cfgDe(doc_) ? *cfgDe(doc_) : nlohmann::ordered_json(); };
      std::string m;
      std::string actif;
      if (c.contains("ajouter")) m = configurer([&](nlohmann::ordered_json& j) { cfgAjouterLigne(doc_, j); }, "");
      if (c.contains("colonne")) m = configurer([&](nlohmann::ordered_json& j) { cfgAjouterColonne(doc_, j, c["colonne"].get<std::string>()); }, "");
      if (c.contains("cellule")) {
        const auto t = tabl();
        const std::string id = c["cellule"][0].get<std::string>();
        m = configurer([&](nlohmann::ordered_json& j) { cfgPoserCellule(j, id, c["cellule"][1].get<std::string>(), c["cellule"][2].get<std::string>()); }, t["active"] == id ? id : "");
      }
      if (c.contains("off")) {
        const auto t = tabl();
        const std::string id = c["off"][0].get<std::string>();
        m = configurer([&](nlohmann::ordered_json& j) { cfgBasculerSupprimee(j, id, c["off"][1].get<std::string>()); }, t["active"] == id ? id : "");
      }
      if (c.contains("activer")) m = configurer(nullptr, c["activer"].get<std::string>());
      if (c.contains("capturer")) m = configurer([&](nlohmann::ordered_json& j) { cfgCapturer(doc_, j, j["configs"]["active"].get<std::string>()); }, "");
      if (c.contains("supprLigne")) m = configurer([&](nlohmann::ordered_json& j) { cfgSupprimerLigne(j, c["supprLigne"].get<std::string>()); }, "");
      if (c.contains("supprColonne")) m = configurer([&](nlohmann::ordered_json& j) { cfgSupprimerColonne(j, c["supprColonne"].get<std::string>()); }, "");
      if (c.contains("renommerParam")) {
        const std::string de = c["renommerParam"][0].get<std::string>(), vers = c["renommerParam"][1].get<std::string>();
        m = changerFormules([&]() -> std::string {
          for (Parametre& p : doc_.params)
            if (p.nom == de) {
              parRenommer(doc_, de, vers);
              p.nom = vers;
            }
          return "";
        });
      }
      n["refus"] = m;
      n["table"] = tabl();
      n["libres"] = cfgNomsLibres(doc_);
      n["etat"] = std::string(etatVue_->texte().utf8_str());
      n["choix"] = std::string(choixConfig_->GetStringSelection().utf8_str());
    }
    if (e.contains("oeilArbre")) {
      const std::string id = e["oeilArbre"].get<std::string>();
      for (size_t k = 0; k < doc_.fonctions.size(); k++)
        if (doc_.fonctions[k].id == id && lignesFonctions_[k].IsOk()) {
          n["etatAvant"] = arbre_->GetItemState(lignesFonctions_[k]);
          oeilArbre(lignesFonctions_[k]);
          break;
        }
      for (size_t k = 0; k < doc_.fonctions.size(); k++)
        if (doc_.fonctions[k].id == id && lignesFonctions_[k].IsOk()) n["etatApres"] = arbre_->GetItemState(lignesFonctions_[k]);
      n["etat"] = std::string(etatVue_->texte().utf8_str());
    }
    if (e.contains("bsCentre")) {
      bsCentreCorps(e["bsCentre"].get<std::string>());
      n["etat"] = std::string(etatVue_->texte().utf8_str());
    }
    if (e.contains("deplacer")) {
      const plan::J& q = e["deplacer"];
      const std::string id = q.value("id", std::string());
      if (q.contains("sur")) {
        const std::string cible = q["sur"].get<std::string>();
        changerStructure([&](nlohmann::ordered_json& d) { anteriorite::deplacerSur(d, id, cible); });
      } else if (q.contains("fil")) {
        const int gap = q["fil"].get<int>();
        std::vector<FilFonctions::Element> L = fil_->liste();
        int source = -1;
        for (size_t k = 0; k < L.size(); k++)
          if (L[k].estFonction && doc_.fonctions[L[k].i].id == id) source = static_cast<int>(k);
        deposerDansFil(L, source, gap);
      } else if (q.contains("corps")) {
        fonctionVersCorps(id, q["corps"].get<std::string>());
      } else {
        const int dir = q.value("dir", 1);
        changerStructure([&](nlohmann::ordered_json& d) { anteriorite::deplacerCran(d, id, dir); });
      }
      wxYield();
      n["etat"] = std::string(etatVue_->texte().utf8_str());
      n["ordre"] = plan::J::array();
      for (const Fonction& f : doc_.fonctions) n["ordre"].push_back(f.id);
    }
    if (e.contains("anteriorite")) {
      n["avert"] = plan::J::object();
      for (const auto& [k, v] : antAvert_) n["avert"][k] = v;
      n["bilan"] = antBilan_;
    }
    if (e.contains("cmdCherche")) {
      const plan::J& q = e["cmdCherche"];
      barreHaute_->champRecherche()->SetValue(wxString::FromUTF8(q["texte"].get<std::string>()));
      n["resultats"] = plan::J::array();
      for (const CommandeCherchee& c : resultatsCmd_) n["resultats"].push_back(std::string(c.libelle.utf8_str()));
      if (q.contains("choisir")) {
        essaiMenu_ = true;
        cmdLancer(q["choisir"].get<int>());
        wxYield();
        essaiMenu_ = false;
        n["atelier"] = static_cast<int>(atelier_);
        n["etat"] = std::string(etatVue_->texte().utf8_str());
      }
    }
    if (e.contains("deriver")) {
      essaiMenu_ = true;
      const plan::J& q = e["deriver"];
      try {
        if (q.contains("liste")) {
          // Ce que propose un fichier : par le même chemin que la fenêtre de choix
          const std::string id = derInserer(wxString::FromUTF8(q["fichier"].get<std::string>()).ToStdWstring(), q.value("params", std::vector<std::string>()), q.value("corps", std::vector<std::string>()), q.value("tous", false));
          n["lien"] = id;
        } else if (q.value("verifier", false)) {
          n["maj"] = derVerifier(false);
        } else if (q.contains("rompre")) {
          derRompre(q["rompre"].get<std::string>());
        } else if (q.contains("relier")) {
          derRelier(q["relier"][0].get<std::string>(), wxString::FromUTF8(q["relier"][1].get<std::string>()).ToStdWstring());
        }
        n["etat"] = std::string(etatVue_->texte().utf8_str());
        n["derives"] = plan::J::array();
        for (const std::string& t : doc_.derivesJson) n["derives"].push_back(plan::J::parse(t));
        n["corps"] = doc_.corps;
      } catch (const std::exception& x) {
        n["erreur"] = x.what();
      }
      essaiMenu_ = false;
    }
    if (e.contains("importer")) {
      essaiMenu_ = true;
      n["ok"] = importerFichier(wxString::FromUTF8(e["importer"].get<std::string>()).ToStdWstring());
      essaiMenu_ = false;
    }
    if (e.contains("exporter")) {
      essaiMenu_ = true;
      std::vector<TopoDS_Shape> fs;
      if (doc_.assemblage && asmMode_ == "asm") {
        std::string nomAsm;
        std::vector<std::string> manquants;
        fs = asmFormesStep(nomAsm, manquants);
        n["manquants"] = manquants;
        n["nFormes"] = fs.size();
      } else
      for (const auto& [id, s] : formesCorps_) fs.push_back(s);
      n["ok"] = ecrireExport(e["exporter"][0].get<std::string>(), fs, wxString::FromUTF8(e["exporter"][1].get<std::string>()).ToStdWstring(), e.value("schema", std::string("AP214")), e.value("sansCourbes", false));
      essaiMenu_ = false;
    }
    if (e.contains("droit3d")) {
      essaiMenu_ = true;
      essaiChoix_ = e.value("choix", std::string());
      essaiEntrees_.clear();
      const auto& p = e["droit3d"];
      vue_->droitEn(vue_->pixelDe(p[0], p[1], p[2]));
      essaiMenu_ = false;
      n["menu"] = essaiEntrees_;
    }
    if (e.contains("vue3d")) {
      wxYield();
      vue_->image(wxString(dossier) + L"\\" + wxString::FromUTF8(e["vue3d"].get<std::string>()) + L".png");
    }
    if (e.contains("mesure")) {
      const Mesures me = mesurer(forme_);
      n["volume"] = me.volume;
      n["faces"] = me.faces;
      n["messages"] = messagesMontres_;
      n["fonctions"] = doc_.fonctions.size();
      n["esquisses"] = doc_.esquisses.size();
      n["corps"] = doc_.corps.size();
      n["modifie"] = doc_.modifie();
      asmMesureEssai(n);
    }
    if (e.contains("asmRefs") && doc_.assemblage) {
      n["refs"] = assemblage::bilanReferences(*doc_.assemblage, asmSolides_);
      n["passes"] = asmPassesRefs_;
      n["filets"] = asmNbFilets_;
    }
    if (e.contains("orbite")) vueEsquisse_->essaiOrbite(e["orbite"][0], e["orbite"][1]);
    if (e.contains("inclinee")) vueEsquisse_->basculerVueInclinee();
    // La saisie d'une cote telle que tapée, la mini-liste, la liste complète en photo
    if (e.contains("coteTexte")) {
      demandeCote(*std::find_if(doc_.esquisses[esquisseOuverte_].cotes.begin(), doc_.esquisses[esquisseOuverte_].cotes.end(), [&](const Cote& c) { return c.id == e["coteTexte"][0].get<std::string>(); }), saisieDepart_);
      saisieCote(e["coteTexte"][0], wxString::FromUTF8(e["coteTexte"][1].get<std::string>()));
      n["message"] = std::string(messageEsquisse_.utf8_str());
    }
    if (e.contains("miniFx")) basculerMiniParametres();
    if (e.contains("listeFx")) {
      wxDialog* f = creerFenetreParametres(this, actionsFormules());
      f->Show();
      wxYield();
      f->Update();
      capturerFenetre(dossier + L"\\" + wxString::FromUTF8(e["listeFx"].get<std::string>()).ToStdWstring() + L".png");
      {
        const wxSize tf = f->GetSize();
        wxBitmap imageF(tf.x, tf.y, 32);
        {
          wxMemoryDC dc(imageF);
          PrintWindow(f->GetHWND(), static_cast<HDC>(dc.GetHDC()), 2);
        }
        imageF.ConvertToImage().SaveFile(dossier + L"\\" + wxString::FromUTF8(e["listeFx"].get<std::string>()).ToStdWstring() + L"-f.png", wxBITMAP_TYPE_PNG);
      }
      f->Destroy();
    }
    wxYield();
    d = vueEsquisse_->dessin();
    if (e.contains("plan")) {
      planVue_->essaiGeste(e["plan"]);
      wxYield();
    }
    if (e.contains("reglagePlan")) {
      wxYield();
      panneauPlan_->refaire();
      try {
        n["trouve"] = panneauPlan_->essai(e["reglagePlan"]);
      } catch (const std::exception& ex) {
        std::ofstream(dossier + L"\\erreur.txt") << ex.what();
        throw;
      }
    }
    if (e.contains("renduEssai")) renduEssai(e["renduEssai"]);
    if (e.contains("vue")) {
      const plan::J& q = e["vue"];
      OptionsVue& o = optionsVue_;
      if (q.contains("reglages")) atelierRendu_->lireEnv(q["reglages"]);
      if (q.contains("env")) o.env = q["env"].get<std::string>();
      if (q.contains("sol")) o.sol = q["sol"].get<bool>();
      if (q.contains("miroir")) o.miroir = q["miroir"].get<bool>();
      if (q.contains("ombre")) o.ombre = q["ombre"].get<bool>();
      if (q.contains("aretes")) o.aretes = q["aretes"].get<bool>();
      if (q.contains("axes")) o.axes = q["axes"].get<bool>();
      if (q.contains("fov")) o.fov = q["fov"].get<double>();
      if (q.contains("coupe")) o.coupe = q["coupe"].get<bool>();
      if (q.contains("axe")) o.coupeAxe = q["axe"].get<int>();
      if (q.contains("pos")) o.coupePos = q["pos"].get<double>();
      if (q.contains("inverse")) o.coupeInverse = q["inverse"].get<bool>();
      if (q.contains("remplir")) o.coupeRemplie = q["remplir"].get<bool>();
      if (q.contains("plan")) o.coupePlan = q["plan"].get<bool>();
      majVueEnv();
      if (q.contains("vue")) vue_->vueStandard(q["vue"].get<std::string>());
      if (q.value("fiche", false) != ficheVue_->IsShown()) basculerFicheVue();
      if (q.contains("temps")) {
        std::ofstream f(wxString::FromUTF8(q["temps"].get<std::string>()).ToStdWstring());
        f << vue_->msOmbre() << " ms\n";
      }
    }
    if (e.contains("rendu")) {
      const plan::J& q = e["rendu"];
      AtelierRendu& A = *atelierRendu_;
      if (q.contains("reglages")) {
        plan::J j = q["reglages"];
        #define C(n) if (j.contains(#n)) j.at(#n).get_to(A.st.n);
        C(amb) C(fond) C(fc1) C(fc2) C(tons) C(res) C(aretes) C(solCol) C(moteur) C(support) C(envRot) C(envInt) C(lum) C(ombre) C(douceur) C(focale) C(ev) C(ech) C(ouv) C(map) C(pDen) C(pHalo) C(pVig) C(pGrain) C(pCon) C(pSat) C(pTemp) C(solOn) C(miroir) C(ombreOn) C(calques)
        #undef C
        A.scene();
        A.vue();
        A.finition();
        panneauRendu_->refaire();
      }
      if (q.contains("bouton")) {
        wxWindow* moi = this;
        (void)moi;
        if (!panneauRendu_->essaiBouton(wxString::FromUTF8(q["bouton"].get<std::string>()))) throw std::runtime_error("bouton du rendu absent : " + q["bouton"].get<std::string>());
      }
      if (q.contains("pause")) {
        const wxLongLong fin = wxGetLocalTimeMillis() + q["pause"].get<long>();
        while (wxGetLocalTimeMillis() < fin) {
          wxYield();
          wxMilliSleep(5);
        }
      }
      if (q.contains("hdri")) {
        wxString m;
        if (!A.importerHdri(wxString::FromUTF8(q["hdri"].get<std::string>()).ToStdWstring(), m)) throw std::runtime_error(m.utf8_string());
        panneauRendu_->message(m);
        panneauRendu_->refaire();
      }
      if (q.contains("glisser")) {
        const plan::J& g = q["glisser"];
        A.essaiGlisser(g[0].get<int>(), g[1].get<double>(), g[2].get<double>(), g[3].get<double>(), g[4].get<double>());
      }
      if (q.contains("matiere")) A.poserApparence(q.value("piece", 0), q["matiere"].get<std::string>(), q.value("couleur", -1L));
      if (q.contains("relief")) {
        const plan::J& g = q["relief"];
        ReliefChoisi r;
        r.t = g.value("t", std::string());
        r.d = g.value("d", std::string());
        r.p = g.value("p", std::string());
        r.e = g.value("e", 0.0);
        A.poserRelief(q.value("piece", 0), r);
      }
      if (q.value("effacer", false)) A.effacerApparence(q.value("piece", 0));
      if (q.value("tous", false)) A.toutesOccurrences(q.value("piece", 0));
      if (q.contains("clic")) A.cliquer(q["clic"][0].get<double>(), q["clic"][1].get<double>());
      if (q.value("attendre", false)) {
        wxYield();
        A.attendreFin();
      }
      if (q.contains("apercu")) A.enregistrerApercu(wxString::FromUTF8(q["apercu"].get<std::string>()));
      if (q.contains("exporter")) panneauRendu_->message(A.exporter(wxString::FromUTF8(q["exporter"].get<std::string>()), false));
      if (q.contains("etat")) {
        plan::J s;
        s["map"] = A.st.map;
        s["focale"] = A.st.focale;
        s["oeil"] = A.cam.oeil;
        s["cible"] = A.cam.cible;
        s["doc"] = A.docRendu;
        s["modifie"] = doc_.modifie();
        s["pieces"] = plan::J::array();
        for (const PieceRendu& p : A.pieces()) s["pieces"].push_back({{"id", p.id}, {"occ", p.occ}, {"bid", p.bid}, {"nom", p.nom}, {"cle", p.cle}, {"couleur", p.couleur}, {"propre", p.propre}});
        std::ofstream(wxString::FromUTF8(q["etat"].get<std::string>()).ToStdWstring()) << s.dump(1);
      }
    }
    if (e.contains("atelier")) {
      const std::string a = e["atelier"].get<std::string>();
      changerAtelier(a == "plan" ? Atelier::PLAN : a == "fao" ? Atelier::FAO : a == "rendu" ? Atelier::RENDU : Atelier::CAO);
      wxYield();
    }
    if (e.contains("fao")) faoEssai(e["fao"]);
    if (e.contains("imageVue")) vue_->image(wxString(dossier) + L"\\" + wxString::FromUTF8(e["imageVue"].get<std::string>()) + L".png");
    if (e.contains("capture")) {
      vueEsquisse_->Update();
      capturerFenetre(dossier + L"\\" + wxString::FromUTF8(e["capture"].get<std::string>()).ToStdWstring() + L".png");
    }
    if (d) {
      const Esquisse* s = esquisseOuverte_ >= 0 ? &doc_.esquisses[esquisseOuverte_] : nullptr;
      n["outilApres"] = static_cast<int>(d->outil());
      n["barrePolygone"] = vueEsquisse_->essaiBarrePolygoneVisible();
      if (s) {
        n["entites"] = s->entites.size();
        n["contraintes"] = s->contraintes.size();
        n["cotes"] = s->cotes.size();
      }
    }
    bilan.push_back(std::move(n));
  }
  std::ofstream(dossier + L"\\bilan.json") << bilan.dump(1, ' ', false, nlohmann::json::error_handler_t::replace);
  quitterEsquisse();
  wxYield();
  faoFaireSuivre();
  try {
    enregistrerProjet(doc_, sortie);
  } catch (const std::exception& e) {
    std::ofstream(dossier + L"\\erreur.txt") << e.what();
    throw;
  }
  return true;
}

// Essai sans vraie souris : de vrais clics passés à la vue, à l'emplacement de chaque arête à l'écran. Ne prend pas la main.
// mids.json : {"chanfrein":false,"r":2,"tangent":true,"mids":[[x,y,z],...]}
bool Cadre::essaiGestesConge(const std::wstring& fichier, const std::wstring& sortie, const std::wstring& json, const std::wstring& dossier) {
  std::ifstream entree(json);
  const nlohmann::json j = nlohmann::json::parse(entree);
  if (!ouvrir(fichier)) return false;
  wxYield();
  nlohmann::json bilan;
  const Mesures avant = mesurer(forme_);
  // Quitter : plus rien du mode ne reste à l'écran, ni dans le document
  entrerConge(true);
  wxYield();
  capturerFenetre(dossier + L"\\0-chanfrein.png");
  quitterConge();
  wxYield();
  capturerFenetre(dossier + L"\\0-quitte.png");
  bilan["fonctionsApresQuitter"] = doc_.fonctions.size();
  entrerConge(j.value("chanfrein", false));
  if (!choix_) return false;
  if (j.contains("cham")) {
    OptChanfrein oc;
    oc.mode = j["cham"].value("mode", std::string("d2"));
    oc.d2 = j["cham"].value("d2", 1.0);
    oc.ang = j["cham"].value("ang", 45.0);
    oc.flip = j["cham"].value("flip", false);
    choix_->optionsChanfrein(oc);
  }
  memoTangentes_ = j.value("tangent", true);
  choix_->tangentes(memoTangentes_);
  choix_->rayonDefaut(j.value("r", 2.0));
  rafraichirConge();
  wxYield();
  // Un clic sur une face prend toute sa boucle, un second la retire
  if (j.contains("face")) {
    const auto& m = j["face"];
    const wxPoint px = vue_->pixelDe(m[0].get<double>(), m[1].get<double>(), m[2].get<double>());
    vue_->cliquerEn(px);
    wxYield();
    bilan["faceMessage"] = messageConge_.utf8_string();
    bilan["faceGermes"] = choix_->germes().size();
    capturerFenetre(dossier + L"\\0-face.png");
    vue_->cliquerEn(px);
    wxYield();
    bilan["faceGermesApres"] = choix_->germes().size();
  }
  nlohmann::json rapport = nlohmann::json::array();
  for (const auto& m : j["mids"]) {
    const Vec3 p{m[0].get<double>(), m[1].get<double>(), m[2].get<double>()};
    const size_t avant = choix_->germes().size();
    const wxPoint px = vue_->pixelDe(p[0], p[1], p[2]);
    vue_->cliquerEn(px);
    wxYield();
    bool juste = false;
    if (choix_->germes().size() == avant + 1) {
      const Vec3 g = choix_->vives()[choix_->germes().back()].mid;
      juste = std::abs(g[0] - p[0]) + std::abs(g[1] - p[1]) + std::abs(g[2] - p[2]) < 1e-6;
    }
    rapport.push_back({{"px", {px.x, px.y}}, {"germes", choix_->germes().size()}, {"juste", juste}, {"message", messageConge_.utf8_string()}});
  }
  bilan["clics"] = rapport;
  bilan["note"] = noteDroite_->GetLabel().utf8_string();
  bilan["selection"] = choix_->selection().size();
  bilan["apercu"] = !choix_->apercu().forme.IsNull();
  bilan["nouvelles"] = choix_->apercu().nouvelles.size();
  capturerFenetre(dossier + L"\\1-choix.png");
  appliquerChoixConge();
  wxYield();
  capturerFenetre(dossier + L"\\2-applique.png");
  bilan["fonctions"] = doc_.fonctions.size();
  bilan["erreur"] = doc_.fonctions.back().congeErreur;
  bilan["volumeApplique"] = mesurer(forme_).volume;
  annuler();
  wxYield();
  bilan["apresAnnuler"] = doc_.fonctions.size();
  bilan["volumeAvant"] = avant.volume;
  bilan["volumeAnnule"] = mesurer(forme_).volume;
  capturerFenetre(dossier + L"\\3-annule.png");
  retablir();
  wxYield();
  bilan["apresRetablir"] = doc_.fonctions.size();
  bilan["volumeRetabli"] = mesurer(forme_).volume;
  enregistrerProjet(doc_, sortie);
  std::ofstream(dossier + L"\\bilan.json") << bilan.dump(1);
  return true;
}

void Cadre::capturerFenetre(const std::wstring& png) {
  const wxSize t = GetSize();
  wxBitmap image(t.x, t.y, 32);
  {
    wxMemoryDC dc(image);
    PrintWindow(GetHWND(), static_cast<HDC>(dc.GetHDC()), 2);  // 2 : PW_RENDERFULLCONTENT, avec ce que dessine OpenGL
  }
  image.ConvertToImage().SaveFile(png, wxBITMAP_TYPE_PNG);
}

bool Cadre::lancerProtocole(const std::wstring& fichier, const std::wstring& journal, int total) {
  proto_.actif = true;
  proto_.total = total;
  proto_.journal = _wfopen(journal.c_str(), L"wb");
  proto_.signal = journal + L".go";
  if (!proto_.journal || !ouvrir(fichier)) return false;
  for (size_t i = 0; i < doc_.fonctions.size() && proto_.fonction < 0; i++) {
    const Fonction& f = doc_.fonctions[i];
    if (f.type == "extrude" && f.visible && !f.through) proto_.fonction = static_cast<int>(i);
  }
  if (proto_.fonction < 0) return false;
  proto_.base = doc_.fonctions[proto_.fonction].distance;
  fprintf(proto_.journal, "pret\n");
  fflush(proto_.journal);
  minuterie_.Start(200);  // attend le feu vert du mesureur : la mesure « au repos » se fait avant
  return true;
}

void Cadre::pasProtocole(wxTimerEvent&) {
  Protocole& P = proto_;
  if (!P.signal.empty()) {
    if (GetFileAttributesW(P.signal.c_str()) == INVALID_FILE_ATTRIBUTES) return;
    P.signal.clear();
    minuterie_.Start(20);
  }
  if (P.i >= P.total) {
    minuterie_.Stop();
    doc_.fonctions[P.fonction].distance = P.base;
    fprintf(P.journal, "fin\n");
    fflush(P.journal);
    return;
  }
  P.i++;
  doc_.fonctions[P.fonction].distance = P.base + (P.base < 0 ? -1 : 1) * P.pas * P.i;
  const double ms = recalculer();
  fprintf(P.journal, "modif %d %.3f %.3f %.3f\n", P.i, ms, msRejeu_, msMaillage_);
  fflush(P.journal);
}

// --image3d : la vue seule, à comparer à la version navigateur ; le temps des arêtes et du reflet à côté de l'image
void Cadre::imageVue3D(const wxString& chemin) {
  vue_->image(chemin);
  wxFile f(chemin + ".txt", wxFile::write);
  if (f.IsOpened()) f.Write(wxString::Format("%.0f ms pour afficher, %.1f ms par image\n", vue_->msAffichage(), vue_->msImage()));
}

// Une image de l'atelier Rendu, pour l'essai automatique
void Cadre::renduEssai(const plan::J& e) {
  MoteurRendu m(vue_, vue_->pilote());
  std::vector<PieceRendu> L;
  for (const auto& [id, s] : dernierRejeu_.corpsVus) {
    PieceRendu p;
    p.forme = s;
    p.id = id;
    p.cle = e.value("mat", std::string());
    const MatiereRendu* dm = matiereRendu(p.cle);
    p.couleur = e.value("col", dm ? dm->couleur : 0x9a9aa0u);
    p.rel = reliefDeJson(e);
    L.push_back(p);
  }
  m.pieces(L);
  ReglagesRendu st;
  st.moteur = e.value("moteur", st.moteur);
  st.amb = e.value("amb", st.amb);
  st.fond = e.value("fond", st.fond);
  st.solOn = e.value("sol", st.solOn);
  st.miroir = e.value("miroir", st.miroir);
  st.focale = e.value("focale", st.focale);
  st.pHalo = e.value("halo", 0.0);
  st.pVig = e.value("vig", 0.0);
  m.appliquer(st);
  CameraRendu c;
  c.oeil = vue_->oeil();
  c.cible = vue_->cibleVue();
  double b[6];
  m.boite(b);
  c.cible = {(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2};
  const double dx = c.oeil[0] - c.cible[0], dy = c.oeil[1] - c.cible[1], dz = c.oeil[2] - c.cible[2], L0 = std::sqrt(dx * dx + dy * dy + dz * dz);
  const double R = 0.5 * std::sqrt((b[3] - b[0]) * (b[3] - b[0]) + (b[4] - b[1]) * (b[4] - b[1]) + (b[5] - b[2]) * (b[5] - b[2]));
  const double D = R * 2.6 * 50 / 24;
  c.oeil = {c.cible[0] + dx / L0 * D, c.cible[1] + dy / L0 * D, c.cible[2] + dz / L0 * D};
  if (e.contains("oeil")) {
    for (int k = 0; k < 3; k++) c.oeil[k] = e["oeil"][k], c.cible[k] = e["cible"][k];
  }
  m.camera(c, st.focale);
  const int w = e.value("w", 960), h = e.value("h", 540), n = e.value("passes", 16);
  double total = 0;
  bool ok = true;
  for (int i = 0; i < n && ok; i++) {
    ok = m.passe(w, h);
    total += m.msPasse;
  }
  std::vector<unsigned char> px;
  Finition f;
  f.halo = st.pHalo;
  f.vig = st.pVig;
  f.den = st.moteur == "rayons" ? e.value("den", 0.5) : 0;
  const auto hex = [](const std::string& s) {
    const unsigned v = static_cast<unsigned>(std::strtoul(s.c_str() + 1, nullptr, 16));
    return std::array<double, 3>{((v >> 16) & 255) / 255.0, ((v >> 8) & 255) / 255.0, (v & 255) / 255.0};
  };
  f.c1 = hex(st.fc1), f.c2 = hex(st.fc2);
  if (ok) {
    finir(m.image().px.data(), w, h, f, px);
    wxImage im(w, h);
    for (int i = 0; i < w * h; i++) im.SetRGB(i % w, i / w, px[4 * i], px[4 * i + 1], px[4 * i + 2]);
    im.SaveFile(wxString::FromUTF8(e["image"].get<std::string>()), wxBITMAP_TYPE_PNG);
  }
  std::ofstream(wxString::FromUTF8(e["image"].get<std::string>() + ".txt").ToStdWstring()) << "ok " << ok << " passes " << m.passes() << " ms/passe " << total / std::max(1, n) << " erreur " << m.erreur << "\n";
}
