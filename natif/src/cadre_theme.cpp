// Le bouton Couleurs : thème de l'interface et style d'icônes (mfTheme, mfIcons)
#include "theme.h"

#include <wx/wx.h>
#include <wx/treectrl.h>

#include <functional>

#include "cadre.h"
#include "panneau_props.h"
#include "environnement.h"
#include "interface_esquisse.h"

void Cadre::menuTheme() {
  wxMenu m;
  enum { T0 = wxID_HIGHEST + 6100, I0 = T0 + 20 };
  m.Append(wxID_ANY, L"Thème")->Enable(false);
  for (int t = 0; t < theme::NB; t++) {
    wxMenuItem* l = m.AppendRadioItem(T0 + t, theme::palette(t).nom);
    l->Check(t == theme::courant());
  }
  m.AppendSeparator();
  m.Append(wxID_ANY, L"Icônes")->Enable(false);
  wxMenuItem* a = m.AppendRadioItem(I0, L"Au trait");
  wxMenuItem* b = m.AppendRadioItem(I0 + 1, L"Couleurs par famille");
  a->Check(!theme::iconesCouleur());
  b->Check(theme::iconesCouleur());
  const int r = GetPopupMenuSelectionFromUser(m);
  if (r >= T0 && r < T0 + theme::NB) appliquerTheme(r - T0);
  else if (r == I0 || r == I0 + 1) appliquerIcones(r == I0 + 1);
}

void Cadre::appliquerTheme(int t) {
  const int de = theme::courant();
  if (t == de) return;
  theme::choisir(t);
  if (!essaiMenu_) theme::enregistrer();
  wxTheApp->SetAppearance(t == theme::CLAIR ? wxApp::Appearance::Light : wxApp::Appearance::Dark);
  Freeze();
  std::function<void(wxWindow*)> passer = [&](wxWindow* w) {
    if (w->UseBgCol()) w->SetBackgroundColour(theme::passer(w->GetBackgroundColour(), de, t));
    if (w->UseForegroundColour()) w->SetForegroundColour(theme::passer(w->GetForegroundColour(), de, t));
    if (auto* b = dynamic_cast<BoutonEsquisse*>(w)) b->themeChange(de, t);
    if (auto* c = dynamic_cast<Carte*>(w)) c->themeChange(de, t);
    if (auto* q = dynamic_cast<Tuile*>(w)) q->themeChange(de, t);
    for (wxWindow* k : w->GetChildren()) passer(k);
    w->Refresh();
  };
  passer(this);
  stylerProps();
  remplirArbre();
  Thaw();
  majVueEnv();
  dessinerEsquisses();
  Refresh();
  Update();
  etat(wxString(L"Thème : ") + theme::palette(t).nom);
}

void Cadre::appliquerIcones(bool couleur) {
  theme::iconesCouleur(couleur);
  if (!essaiMenu_) theme::enregistrer();
  ruban_->couleursFamilles();
  ruban_->Update();
  etat(couleur ? L"Icônes : couleurs par famille" : L"Icônes : au trait");
}
