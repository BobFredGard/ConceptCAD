#include "cadre.h"

#include <wx/filedlg.h>
#include <wx/propgrid/advprops.h>

#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepGProp.hxx>
#include <GProp_GProps.hxx>
#include <Standard_Failure.hxx>
#include <TopoDS.hxx>

#include <algorithm>
#include <chrono>

namespace {
enum { ID_ANNULER = wxID_HIGHEST + 1, ID_RETABLIR, ID_AJUSTER, ID_QUITTER_ESQUISSE };
// Identifiants fixes : natif/mesures/verifier-fenetre.ps1 retrouve ces fenêtres par eux.
enum { ID_ARBRE = 2001, ID_PROPS = 2002, ID_ETAT = 2003 };
const char* const PROP_PROFONDEUR = "profondeur";

struct LienArbre : wxTreeItemData {
  LienArbre(bool f, int n) : estFonction(f), i(n) {}
  bool estFonction;
  int i;
};

double msDepuis(std::chrono::steady_clock::time_point t0) {
  return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
}
wxString tx(const std::string& s) { return wxString::FromUTF8(s); }
wxString nombre(double v) { return wxString::Format("%.3f", v); }

wxString nomType(const Fonction& f) {
  if (f.type == "extrude") return f.op == "cut" ? L"Découpe" : L"Extrusion";
  if (f.type == "repeat") return L"Répétition";
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

Cadre::Cadre() : wxFrame(nullptr, wxID_ANY, L"ConceptCAD natif"), minuterie_(this) {
  SetClientSize(FromDIP(wxSize(1400, 900)));
  Move(FromDIP(wxPoint(40, 40)));
  aui_.SetManagedWindow(this);
  creerMenus();

  arbre_ = new wxTreeCtrl(this, ID_ARBRE, wxDefaultPosition, FromDIP(wxSize(280, 500)), wxTR_DEFAULT_STYLE | wxTR_HIDE_ROOT | wxTR_LINES_AT_ROOT | wxTR_SINGLE | wxBORDER_NONE);
  props_ = new wxPropertyGrid(this, ID_PROPS, wxDefaultPosition, FromDIP(wxSize(280, 300)), wxPG_DEFAULT_STYLE);
  // La vue 3D et la vue d'esquisse occupent la même place, l'une à la fois.
  centre_ = new wxPanel(this);
  vue_ = new Vue3D(centre_);
  vueEsquisse_ = new VueEsquisse(centre_);
  vueEsquisse_->surQuitter = [this] { quitterEsquisse(); };
  auto* rangee = new wxBoxSizer(wxVERTICAL);
  rangee->Add(vue_, 1, wxEXPAND);
  rangee->Add(vueEsquisse_, 1, wxEXPAND);
  centre_->SetSizer(rangee);
  vueEsquisse_->Hide();
  vue_->surSelection = [this](const TopoDS_Shape& s) { montrerForme(s); };

  aui_.AddPane(arbre_, wxAuiPaneInfo().Name("arbre").Caption(L"Pièce").Left().Layer(1).Position(0).BestSize(FromDIP(wxSize(280, 500))).CloseButton(false));
  aui_.AddPane(props_, wxAuiPaneInfo().Name("props").Caption(L"Propriétés").Left().Layer(1).Position(1).BestSize(FromDIP(wxSize(280, 300))).CloseButton(false));
  aui_.AddPane(centre_, wxAuiPaneInfo().Name("vue").CenterPane());
  aui_.Update();

  CreateStatusBar(1, wxSTB_DEFAULT_STYLE, ID_ETAT);
  etat(L"Aucune pièce ouverte. Ctrl+O pour ouvrir. Clic gauche : tourner ou choisir. Clic droit : déplacer. Molette : zoom.");

  arbre_->Bind(wxEVT_TREE_SEL_CHANGED, &Cadre::surArbre, this);
  arbre_->Bind(wxEVT_TREE_ITEM_ACTIVATED, &Cadre::surArbreActive, this);
  props_->Bind(wxEVT_PG_CHANGED, &Cadre::surPropriete, this);
  Bind(wxEVT_TIMER, &Cadre::pasProtocole, this);
  montrerRien();
}

Cadre::~Cadre() {
  minuterie_.Stop();
  aui_.UnInit();
  if (proto_.journal) fclose(proto_.journal);
}

void Cadre::etat(const wxString& texte) {
  SetStatusText(texte);
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
  fichier->AppendSeparator();
  fichier->Append(wxID_EXIT, L"&Quitter");
  auto* edition = new wxMenu;
  edition->Append(ID_ANNULER, L"&Annuler\tCtrl+Z");
  edition->Append(ID_RETABLIR, L"&Rétablir\tCtrl+Y");
  auto* affichage = new wxMenu;
  affichage->Append(ID_AJUSTER, L"&Ajuster la vue\tCtrl+F");
  affichage->Append(ID_QUITTER_ESQUISSE, L"&Terminer l'esquisse\tEsc");
  auto* barre = new wxMenuBar;
  barre->Append(fichier, L"&Fichier");
  barre->Append(edition, L"&Édition");
  barre->Append(affichage, L"&Affichage");
  SetMenuBar(barre);
  Bind(wxEVT_MENU, &Cadre::surOuvrir, this, wxID_OPEN);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { Close(); }, wxID_EXIT);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { annuler(); }, ID_ANNULER);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { retablir(); }, ID_RETABLIR);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) {
    if (esquisseOuverte_ >= 0) vueEsquisse_->ajuster();
    else vue_->ajuster();
  }, ID_AJUSTER);
  Bind(wxEVT_MENU, [this](wxCommandEvent&) { quitterEsquisse(); }, ID_QUITTER_ESQUISSE);
  Bind(wxEVT_UPDATE_UI, [this](wxUpdateUIEvent& e) { e.Enable(esquisseOuverte_ >= 0); }, ID_QUITTER_ESQUISSE);
  Bind(wxEVT_UPDATE_UI, [this](wxUpdateUIEvent& e) { e.Enable(!annulations_.empty()); }, ID_ANNULER);
  Bind(wxEVT_UPDATE_UI, [this](wxUpdateUIEvent& e) { e.Enable(!retablissements_.empty()); }, ID_RETABLIR);
}

void Cadre::surOuvrir(wxCommandEvent&) {
  wxFileDialog d(this, L"Ouvrir une pièce ConceptCAD", wxEmptyString, wxEmptyString, L"Projets ConceptCAD (*.conceptcad)|*.conceptcad|Tous les fichiers (*.*)|*.*", wxFD_OPEN | wxFD_FILE_MUST_EXIST);
  if (d.ShowModal() == wxID_OK) ouvrir(d.GetPath().ToStdWstring());
}

bool Cadre::ouvrir(const std::wstring& chemin) {
  try {
    Document d = lireProjet(chemin);
    doc_ = std::move(d);
  } catch (const std::exception& e) {
    if (!proto_.actif) wxMessageBox(tx(e.what()), L"Ouverture impossible", wxOK | wxICON_ERROR, this);
    return false;
  }
  quitterEsquisse();
  forme_.Nullify();
  docOuvert_ = true;
  ajusterVue_ = true;
  solideCalculable_ = doc_.nonPrisEnCharge.empty();
  annulations_.clear();
  retablissements_.clear();
  const size_t p = chemin.find_last_of(L"\\/");
  SetTitle(wxString(chemin.substr(p == std::wstring::npos ? 0 : p + 1)) + L" — ConceptCAD natif");
  remplirArbre();
  if (solideCalculable_) {
    montrerRien();
    recalculer();
    return true;
  }
  // Pièce dont le logiciel natif ne sait pas tout rejouer : on montre son contenu, jamais un solide faux.
  vue_->afficher(TopoDS_Shape(), true);
  montrerManques();
  etat(tx(doc_.nom) + L"  |  Solide non calculé : voir le panneau Propriétés.");
  return false;
}

void Cadre::remplirArbre() {
  arbre_->Freeze();
  arbre_->DeleteAllItems();
  const wxTreeItemId racine = arbre_->AddRoot(tx(doc_.nom));
  const wxTreeItemId esquisses = arbre_->AppendItem(racine, wxString::Format(L"Esquisses (%zu)", doc_.esquisses.size()));
  for (size_t i = 0; i < doc_.esquisses.size(); i++) {
    const std::string& n = doc_.esquisses[i].nom;
    arbre_->AppendItem(esquisses, n.empty() ? wxString(tx(doc_.esquisses[i].id)) : tx(n), -1, -1, new LienArbre(false, static_cast<int>(i)));
  }
  for (size_t c = 0; c < doc_.corps.size(); c++) {
    const wxTreeItemId corps = arbre_->AppendItem(racine, wxString::Format(L"Corps %zu", c + 1));
    for (size_t i = 0; i < doc_.fonctions.size(); i++) {
      const Fonction& f = doc_.fonctions[i];
      const bool ici = f.corps == doc_.corps[c] || (c == 0 && std::find(doc_.corps.begin(), doc_.corps.end(), f.corps) == doc_.corps.end());
      if (!ici) continue;
      const wxTreeItemId n = arbre_->AppendItem(corps, f.nom.empty() ? nomType(f) : tx(f.nom), -1, -1, new LienArbre(true, static_cast<int>(i)));
      if (!f.visible) arbre_->SetItemTextColour(n, wxSystemSettings::GetColour(wxSYS_COLOUR_GRAYTEXT));
    }
    arbre_->Expand(corps);
  }
  arbre_->Expand(esquisses);
  arbre_->Thaw();
}

void Cadre::montrerRien() {
  fonctionMontree_ = -1;
  props_->Clear();
  props_->CenterSplitter();
  props_->Append(new wxPropertyCategory(L"Sélection"));
  lectureSeule(props_, L"Choix", L"Rien de choisi");
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
  const Fonction& f = doc_.fonctions[i];
  props_->Clear();
  props_->CenterSplitter();
  props_->Append(new wxPropertyCategory(L"Fonction"));
  lectureSeule(props_, L"Nom", tx(f.nom));
  lectureSeule(props_, L"Type", nomType(f));
  if (!f.visible) lectureSeule(props_, L"État", L"Désactivée");
  fonctionMontree_ = -1;
  if (f.type != "extrude") return;
  const Esquisse* e = doc_.esquisse(f.esquisse);
  lectureSeule(props_, L"Esquisse", tx(e && !e->nom.empty() ? e->nom : f.esquisse));
  if (f.through) {
    lectureSeule(props_, L"Profondeur", L"À travers tout");
  } else if (f.visible && solideCalculable_) {
    props_->Append(new wxStringProperty(L"Profondeur (mm)", PROP_PROFONDEUR, wxString::Format("%g", f.distance)));
    fonctionMontree_ = i;
  } else {
    lectureSeule(props_, L"Profondeur (mm)", wxString::Format("%g", f.distance));
  }
}

void Cadre::montrerEsquisse(int i) {
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
}

// Double-clic dans l'arbre : même repère que le navigateur, sans modification possible à cette étape.
void Cadre::entrerEsquisse(int i) {
  const Esquisse& s = doc_.esquisses[i];
  esquisseOuverte_ = i;
  vue_->Hide();
  vueEsquisse_->Show();
  centre_->Layout();
  vueEsquisse_->montrer(&s, forme_);
  vueEsquisse_->SetFocus();
  montrerEsquisse(i);
  wxString t = L"Esquisse « " + tx(s.nom) + L" » en lecture seule. Clic droit : déplacer. Molette : zoom. Échap : terminer.";
  if (vueEsquisse_->nonDessines() > 0) t += wxString::Format(L"  |  ⚠ %d élément(s) pas encore dessiné(s), comme les splines.", vueEsquisse_->nonDessines());
  etat(t);
}

void Cadre::capturerEsquisses(const std::wstring& dossier) {
  for (size_t i = 0; i < doc_.esquisses.size(); i++) {
    entrerEsquisse(static_cast<int>(i));
    wxYield();
    vueEsquisse_->enregistrer(wxString::Format(L"%s\\%03zu.png", dossier, i));
  }
  quitterEsquisse();
}

void Cadre::quitterEsquisse() {
  if (esquisseOuverte_ < 0) return;
  esquisseOuverte_ = -1;
  vueEsquisse_->montrer(nullptr, TopoDS_Shape());
  vueEsquisse_->Hide();
  vue_->Show();
  centre_->Layout();
  vue_->Refresh();
  etat(tx(doc_.nom));
}

void Cadre::montrerForme(const TopoDS_Shape& s) {
  fonctionMontree_ = -1;
  props_->Clear();
  props_->CenterSplitter();
  if (s.IsNull()) {
    montrerRien();
    etat(L"Rien de choisi.");
    return;
  }
  GProp_GProps g;
  if (s.ShapeType() == TopAbs_FACE) {
    const TopoDS_Face f = TopoDS::Face(s);
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

// Rejoue et affiche. Rend la durée totale en ms (calcul + maillage + dessin).
double Cadre::recalculer() {
  wxBusyCursor attente;
  const auto t0 = std::chrono::steady_clock::now();
  ResultatRejeu r;
  try {
    r = rejouer(doc_);
    msRejeu_ = msDepuis(t0);
    if (!r.forme.IsNull()) mailler(r.forme, parallele());
  } catch (const Standard_Failure& e) {
    r.messages.push_back(e.what());
  }
  const double tCalcul = msDepuis(t0);
  msMaillage_ = tCalcul - msRejeu_;
  forme_ = r.forme;
  vue_->afficher(r.forme, ajusterVue_);
  ajusterVue_ = false;
  // Le banc compte aussi le prix de la sélection, que le programme paierait dès que la souris passe sur la vue.
  if (proto_.actif) vue_->preparerSelection();
  const double total = msDepuis(t0);
  if (proto_.actif) return total;
  if (r.forme.IsNull() && r.messages.empty()) {
    etat(tx(doc_.nom) + L"  |  Aucun solide dans ce fichier (esquisses seules).");
    return total;
  }
  const Mesures m = mesurer(r.forme);
  etat(wxString::Format(L"%s  |  Volume %.3f mm³  |  %d faces  |  calcul %.0f ms, total %.0f ms%s", tx(doc_.nom), m.volume, m.faces, tCalcul, total, r.messages.empty() ? L"" : L"  |  ⚠ voir message"));
  if (!r.messages.empty()) {
    wxString t;
    for (const std::string& x : r.messages) t += tx(x) + L"\n";
    wxMessageBox(t, L"Messages du rejeu", wxOK | wxICON_WARNING, this);
  }
  return total;
}

void Cadre::changerCote(int fonction, double valeur, bool memoriser) {
  Fonction& f = doc_.fonctions[fonction];
  if (memoriser) {
    annulations_.push_back({fonction, f.distance, valeur});
    retablissements_.clear();
  }
  f.distance = valeur;
  recalculer();
  if (fonctionMontree_ == fonction) props_->SetPropertyValue(PROP_PROFONDEUR, wxString::Format("%g", valeur));
}

void Cadre::annuler() {
  if (annulations_.empty()) return;
  const ModifCote m = annulations_.back();
  annulations_.pop_back();
  retablissements_.push_back(m);
  changerCote(m.fonction, m.avant, false);
}

void Cadre::retablir() {
  if (retablissements_.empty()) return;
  const ModifCote m = retablissements_.back();
  retablissements_.pop_back();
  annulations_.push_back(m);
  changerCote(m.fonction, m.apres, false);
}

void Cadre::surArbre(wxTreeEvent& e) {
  const auto* lien = dynamic_cast<LienArbre*>(arbre_->GetItemData(e.GetItem()));
  if (!lien) return montrerRien();
  if (lien->estFonction) montrerFonction(lien->i);
  else montrerEsquisse(lien->i);
}

void Cadre::surArbreActive(wxTreeEvent& e) {
  const auto* lien = dynamic_cast<LienArbre*>(arbre_->GetItemData(e.GetItem()));
  if (lien && !lien->estFonction) entrerEsquisse(lien->i);
  else e.Skip();  // dépliage habituel des dossiers
}

void Cadre::surPropriete(wxPropertyGridEvent& e) {
  if (e.GetPropertyName() != PROP_PROFONDEUR || fonctionMontree_ < 0) return;
  const int fonction = fonctionMontree_;
  wxString t = e.GetValue().GetString();
  t.Replace(",", ".");
  double v = 0;
  if (!t.ToCDouble(&v) || v == 0) {
    wxMessageBox(L"Saisir un nombre différent de zéro, en millimètres.", L"Cote incorrecte", wxOK | wxICON_WARNING, this);
    props_->SetPropertyValue(PROP_PROFONDEUR, wxString::Format("%g", doc_.fonctions[fonction].distance));
    return;
  }
  CallAfter([this, fonction, v] { changerCote(fonction, v, true); });  // jamais de recalcul au milieu de l'événement de la grille
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
