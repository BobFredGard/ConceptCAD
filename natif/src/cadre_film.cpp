// Le film de construction (src/98-film-construction.js) : la vue en plein écran entre deux bandes noires, la caméra tourne autour
// de la pièce finale, le marqueur de temps avance d'une fonction à la fois. Rien ne reste modifié à la fin.
// Les légendes sont dans les bandes : une fenêtre ne peut pas être transparente au-dessus de la vue 3D.
// La vidéo est un MP4 (le navigateur écrit un WebM) : le codeur vient de Windows.
#include <cwctype>
#include <wx/dcbuffer.h>
#include <wx/filedlg.h>
#include <wx/filename.h>
#include <wx/rawbmp.h>
#include <wx/stopwatch.h>

#include <algorithm>
#include <cmath>
#include <memory>

#include "cadre.h"
#include "interface_esquisse.h"
#include "video_mp4.h"

namespace {

// wxString::Upper laisse les lettres accentuées en minuscules
wxString enMajuscules(const wxString& t) {
  std::wstring m = t.ToStdWstring();
  for (wchar_t& c : m)
    c = (c >= 0xE0 && c <= 0xFE && c != 0xF7) ? static_cast<wchar_t>(c - 32) : c == 0x153 ? static_cast<wchar_t>(0x152) : static_cast<wchar_t>(std::towupper(c));
  return wxString(m);
}

wxString enTexte(const std::string& s) { return wxString::FromUTF8(s); }
wxFont policeFilm(double px, bool gras = false) {
  wxFontInfo f(wxSize(0, std::max(8, static_cast<int>(px))));
  f.FaceName(L"Segoe UI");
  if (gras) f.Bold();
  return wxFont(f);
}
struct MinuteurFilm : wxTimer {
  std::function<void()> f;
  void Notify() override {
    if (f) f();
  }
};
wxString deuxChiffres(int v) { return wxString::Format(L"%02d", v); }
}  // namespace

struct Cadre::FilmEtat {
  std::vector<std::string> ids;
  int phase = 0, k = 0;
  double reste = 0, ang = -M_PI / 2.6, vitesseOrbite = 0.22, rythme = 1, hold = 0;
  bool pause = false, stop = false, finEnCours = false, dansPas = false, bandes = false, carte = false, legende = false;
  wxString ck, ch, cs, legNom, legNature;
  wxColour legCouleur;
  int legI = 0;
  double centre[3] = {0, 0, 0}, distance = 150;
  Document sauve;
  std::string marque;
  wxPanel* haut = nullptr;
  wxPanel* bas = nullptr;
  wxPanel* carton = nullptr;
  BoutonEsquisse* boutonVideo = nullptr;
  BoutonEsquisse* boutonPause = nullptr;
  BoutonEsquisse* boutonStop = nullptr;
  std::vector<wxWindow*> masques;
  bool rubanVu = false, paramsVu = false;
  MinuteurFilm minuteur;
  wxStopWatch horloge;
  long dernier = 0;
  std::unique_ptr<VideoMp4> video;
  wxString cheminVideo, videoFaite;
  wxStopWatch horlogeVideo;
  int nbImages = 0;
};

void Cadre::filmDessin(wxDC& dc, int W, int H) {
  if (!film_) return;
  const FilmEtat& F = *film_;
  const int bh = static_cast<int>(H * 0.09);
  const double u = H / 1080.0;
  dc.SetPen(*wxTRANSPARENT_PEN);
  dc.SetBrush(*wxBLACK_BRUSH);
  dc.DrawRectangle(0, 0, W, bh);
  dc.DrawRectangle(0, H - bh, W, bh);
  dc.SetBackgroundMode(wxBRUSHSTYLE_TRANSPARENT);
  dc.SetFont(policeFilm(std::max(11.0, 18 * u)));
  dc.SetTextForeground(wxColour(0x8e, 0x8e, 0x93));
  const wxString aide = L"Échap = arrêter · Espace = pause";
  dc.DrawText(aide, static_cast<int>(W * 0.05), (bh - dc.GetTextExtent(aide).y) / 2);
  if (F.carte) {
    dc.SetBrush(wxBrush(wxColour(0x0b, 0x0d, 0x12)));
    dc.DrawRectangle(0, bh, W, H - 2 * bh);
    const auto centrer = [&](const wxString& t, const wxFont& f, const wxColour& c, int y) {
      dc.SetFont(f);
      dc.SetTextForeground(c);
      const wxSize s = dc.GetTextExtent(t);
      dc.DrawText(t, (W - s.x) / 2, y - s.y / 2);
    };
    centrer(enMajuscules(F.ck), policeFilm(std::max(12.0, 22 * u)), wxColour(0x98, 0x98, 0x9d), H / 2 - static_cast<int>(84 * u));
    centrer(F.ch, policeFilm(std::max(24.0, 74 * u), true), wxColour(0x0a, 0x84, 0xff), H / 2);
    centrer(F.cs, policeFilm(std::max(13.0, 26 * u)), wxColour(0xc7, 0xc7, 0xcc), H / 2 + static_cast<int>(80 * u));
    return;
  }
  if (!F.legende) return;
  const int n = static_cast<int>(F.ids.size());
  const int L = static_cast<int>(W * 0.05);
  const int y0 = H - bh, ht = std::max(30, bh - std::max(6, static_cast<int>(16 * u)));
  dc.SetFont(policeFilm(ht * 0.62, true));
  dc.SetTextForeground(wxColour(0xf5, 0xf5, 0xf7));
  const wxString num = deuxChiffres(F.legI + 1);
  const wxSize sn = dc.GetTextExtent(num);
  dc.DrawText(num, L, y0 + (ht - sn.y) / 2);
  dc.SetFont(policeFilm(ht * 0.28));
  dc.SetTextForeground(wxColour(0x98, 0x98, 0x9d));
  const wxString tot = L" / " + deuxChiffres(n);
  const wxSize st = dc.GetTextExtent(tot);
  dc.DrawText(tot, L + sn.x, y0 + (ht + sn.y) / 2 - st.y - ht / 10);
  const int bx = L + sn.x + st.x + static_cast<int>(ht * 0.25);
  dc.SetBrush(wxBrush(F.legCouleur));
  dc.DrawRectangle(bx, y0 + ht / 8, std::max(3, static_cast<int>(4 * u)), ht * 3 / 4);
  const int tx = bx + static_cast<int>(ht * 0.3);
  dc.SetFont(policeFilm(ht * 0.36, true));
  dc.SetTextForeground(wxColour(0xf5, 0xf5, 0xf7));
  dc.DrawText(F.legNom, tx, y0 + ht / 12);
  dc.SetFont(policeFilm(ht * 0.24));
  dc.SetTextForeground(F.legCouleur);
  dc.DrawText(enMajuscules(F.legNature), tx, y0 + ht * 55 / 100);
  // L'avancement
  const int py = H - std::max(4, static_cast<int>(10 * u)), pl = static_cast<int>(W * 0.9), eh = std::max(2, static_cast<int>(3 * u));
  dc.SetBrush(wxBrush(wxColour(0x2a, 0x2a, 0x2d)));
  dc.DrawRectangle(L, py, pl, eh);
  const int fait = n > 0 ? pl * (F.legI + 1) / n : 0;
  dc.GradientFillLinear(wxRect(L, py, std::max(1, fait), eh), wxColour(0x0a, 0x84, 0xff), wxColour(0x8a, 0x88, 0xff));
}

void Cadre::filmPlacer() {
  if (!film_) return;
  FilmEtat& F = *film_;
  const wxSize t = scene_->GetClientSize();
  const int bh = static_cast<int>(t.y * 0.09);
  vue_->SetSize(0, 0, t.x, t.y);
  vue_->Show();
  F.haut->SetSize(0, 0, t.x, bh);
  F.bas->SetSize(0, t.y - bh, t.x, bh);
  F.carton->SetSize(0, bh, t.x, std::max(1, t.y - 2 * bh));
  const int bh2 = std::min(bh - 4, F.haut->FromDIP(30));
  const int y = (bh - bh2) / 2;
  int x = t.x - F.haut->FromDIP(14);
  for (BoutonEsquisse* b : {F.boutonStop, F.boutonPause, F.boutonVideo}) {
    const int l = F.haut->FromDIP(b == F.boutonVideo ? 190 : b == F.boutonPause ? 44 : 100);
    x -= l;
    b->SetSize(x, y, l, bh2);
    x -= F.haut->FromDIP(8);
  }
  F.haut->Refresh();
  F.bas->Refresh();
  F.carton->Refresh();
}

void Cadre::filmAller(int k) {
  if (!film_) return;
  const auto& T = film_->ids;
  marqueTemps_ = k < static_cast<int>(T.size()) ? T[k] : std::string();
  recalculer();
}

namespace {
// filmKind : le libellé et la couleur d'une fonction, comme le bandeau
void natureDe(const Fonction& f, const nlohmann::ordered_json& j, wxString& nom, wxColour& c) {
  const std::string t = f.type, op = j.value("op", std::string("add"));
  const bool cut = op == "cut";
  const wxColour AJOUT(0x30, 0xd1, 0x58), RETIRE(0xff, 0x45, 0x3a), MOD(0x64, 0xd2, 0xff), REP(0xbf, 0x5a, 0xf2);
  c = MOD;
  nom = L"Fonction";
  if (t == "extrude") nom = L"Extrusion", c = cut ? RETIRE : AJOUT;
  else if (t == "revolve") nom = L"Révolution", c = cut ? RETIRE : AJOUT;
  else if (t == "sweep") nom = L"Balayage", c = cut ? RETIRE : AJOUT;
  else if (t == "hole") nom = L"Perçage", c = RETIRE;
  else if (t == "xthread") nom = L"Filetage";
  else if (t == "gear") nom = L"Engrenage", c = AJOUT;
  else if (t == "xfillet") nom = j.value("chamfer", false) ? L"Chanfrein" : L"Congé";
  else if (t == "fillet") nom = L"Congé";
  else if (t == "repeat") nom = L"Répétition", c = REP;
  else if (t == "combine") {
    nom = L"Combiner";
    if (j.value("mode", std::string()) == "cut") nom += L" · soustraction", c = RETIRE;
  } else if (t == "xmove") nom = L"Déplacer une face";
  else if (t == "xdelface") nom = L"Supprimer une face";
  else if (t == "xdraft") nom = L"Dépouille";
  else if (t == "xshell") nom = L"Coque", c = RETIRE;
  else if (t == "xsplit") nom = L"Scinder";
  else if (t == "bmove") nom = L"Déplacer le corps";
  else if (t == "bremove") nom = L"Retirer le corps", c = RETIRE;
  else if (t == "bscale") nom = L"Échelle";
  else if (t == "import") nom = L"Import";
  if ((t == "extrude" || t == "revolve" || t == "sweep") && cut) nom = L"Enlèvement · " + nom.Lower();
}
}  // namespace

void Cadre::filmLancer(double rythme, const wxString& video) {
  if (film_) return etat(L"Film déjà en cours.");
  if (atelier_ != Atelier::CAO) return etat(L"Le film de construction se lance depuis l'espace CAO.");
  if (esquisseOuverte_ >= 0) return etat(L"Fermez l'esquisse avant de lancer le film.");
  if (!docOuvert_ || !solideCalculable_) return etat(L"Le film de construction demande une pièce calculée.");
  auto F = std::make_shared<FilmEtat>();
  for (const Fonction& f : doc_.fonctions)
    if (f.repeatId.empty()) F->ids.push_back(f.id);
  if (F->ids.empty()) return etat(L"Fil vide : rien à rejouer — créez une esquisse puis une extrusion.");
  F->rythme = rythme;
  F->sauve = doc_;
  F->marque = marqueTemps_;
  // Les bandes, les boutons
  const auto panneau = [&](wxPanel*& p) {
    p = new wxPanel(scene_, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxNO_BORDER);
    p->SetBackgroundStyle(wxBG_STYLE_PAINT);
    p->SetBackgroundColour(*wxBLACK);
    p->Bind(wxEVT_PAINT, [this, p](wxPaintEvent&) {
      wxAutoBufferedPaintDC dc(p);
      dc.SetBackground(*wxBLACK_BRUSH);
      dc.Clear();
      const wxPoint o = p->GetPosition();
      dc.SetDeviceOrigin(-o.x, -o.y);
      const wxSize t = scene_->GetClientSize();
      filmDessin(dc, t.x, t.y);
    });
  };
  panneau(F->haut);
  panneau(F->bas);
  panneau(F->carton);
  const auto bouton = [&](BoutonEsquisse*& b, const wxString& t, const wxString& aide, std::function<void()> f) {
    b = new BoutonEsquisse(F->haut, wxID_ANY, t, aide, BoutonEsquisse::ENCADRE);
    b->titre(t);
    b->fond(*wxBLACK);
    b->surClic = std::move(f);
  };
  bouton(F->boutonVideo, L"● Enregistrer", L"Enregistrer le film en vidéo (MP4, légendes incrustées)", [this] { filmVideoBascule(); });
  bouton(F->boutonPause, L"⏸", L"Pause (Espace)", [this] { filmPause(); });
  bouton(F->boutonStop, L"✕ Arrêter", L"Arrêter (Échap)", [this] { filmStop(); });
  // Le reste s'efface
  Freeze();
  for (wxWindow* w : scene_->GetChildren())
    if (w != vue_ && w != F->haut && w != F->bas && w != F->carton && w->IsShown()) {
      F->masques.push_back(w);
      w->Hide();
    }
  F->rubanVu = ruban_->IsShown();
  F->paramsVu = miniParams_->IsShown();
  barreHaute_->Hide();
  ruban_->Hide();
  miniParams_->Hide();
  colonneDroite_->ShowItems(false);
  film_ = F;
  ShowFullScreen(true, wxFULLSCREEN_ALL);
  centre_->Layout();
  Thaw();
  filmPlacer();
  vue_->filmDebut();
  vue_->Enable(false);
  F->haut->Raise();
  F->bas->Raise();
  F->carton->Raise();
  // Le carton d'ouverture, la pièce finale pour cadrer l'orbite
  F->bandes = true;
  F->carte = true;
  F->ck = L"Film de construction";
  F->ch = enTexte(doc_.nom.empty() ? std::string("Sans titre") : doc_.nom);
  F->cs = wxString::Format(L"%zu fonction%s · %zu corps", F->ids.size(), F->ids.size() > 1 ? L"s" : L"", doc_.corps.size());
  F->carton->Show();
  filmPlacer();
  Update();
  filmAller(static_cast<int>(F->ids.size()));
  double b[6];
  if (vue_->boiteVisible(b)) {
    F->centre[0] = (b[0] + b[3]) / 2;
    F->centre[1] = (b[1] + b[4]) / 2;
    F->centre[2] = (b[2] + b[5]) / 2;
    const double dx = b[3] - b[0], dy = b[4] - b[1], dz = b[5] - b[2];
    const double r = std::sqrt(dx * dx + dy * dy + dz * dz) * 0.5;
    const wxSize t = vue_->GetClientSize();
    const double fv = vue_->options().fov * M_PI / 180, aspect = t.y > 0 ? static_cast<double>(t.x) / t.y : 1;
    const double s = std::max(std::sin(fv * 0.5), std::sin(std::atan(std::tan(fv * 0.5) * aspect)));
    F->distance = ((r > 0 ? r : 50) / std::max(s, 0.05)) * 1.35;
  }
  if (!video.IsEmpty()) filmVideoOuvrir(video);
  filmAller(0);
  F->phase = 0;
  F->reste = 1900;
  F->hold = std::max(900.0, std::min(2200.0, 25000.0 / F->ids.size()));
  F->horloge.Start();
  F->dernier = 0;
  F->minuteur.f = [this] { filmPas(); };
  F->minuteur.Start(33);
}

void Cadre::filmPause() {
  if (!film_) return;
  film_->pause = !film_->pause;
  film_->boutonPause->titre(film_->pause ? L"▶" : L"⏸");
}
void Cadre::filmStop() {
  if (film_) film_->stop = true;
}

bool Cadre::filmVideoOuvrir(const wxString& chemin) {
  FilmEtat& F = *film_;
  wxSize t = vue_->GetClientSize();
  if (t.x > 1920) t = wxSize(1920, t.y * 1920 / t.x);
  auto v = std::make_unique<VideoMp4>();
  if (!v->ouvrir(chemin, t.x & ~1, t.y & ~1)) return false;
  F.video = std::move(v);
  F.cheminVideo = chemin;
  F.horlogeVideo.Start();
  F.nbImages = 0;
  F.boutonVideo->titre(L"■ Arrêter l'enregistrement");
  return true;
}

void Cadre::filmVideoBascule() {
  if (!film_) return;
  FilmEtat& F = *film_;
  if (F.video) {
    if (F.video->fermer()) F.videoFaite = F.cheminVideo;
    F.video.reset();
    F.boutonVideo->titre(L"● Enregistrer");
    return;
  }
  const bool avant = F.pause;
  F.pause = true;
  wxFileDialog dlg(this, L"Enregistrer le film", wxEmptyString, enTexte(doc_.nom) + L" — film de construction.mp4", L"Vidéo MP4 (*.mp4)|*.mp4", wxFD_SAVE | wxFD_OVERWRITE_PROMPT);
  if (dlg.ShowModal() == wxID_OK && film_ && !filmVideoOuvrir(dlg.GetPath())) wxLogError(L"Windows n'a pas pu créer la vidéo.");
  if (film_) film_->pause = avant;
}

void Cadre::filmImageVideo() {
  FilmEtat& F = *film_;
  if (!F.video) return;
  wxImage im;
  if (!vue_->captureFilm(im, F.video->largeur(), F.video->hauteur())) return;
  wxBitmap bmp(im);
  {
    wxMemoryDC dc(bmp);
    filmDessin(dc, im.GetWidth(), im.GetHeight());
  }
  if (F.video->ajouter(bmp.ConvertToImage(), static_cast<double>(F.horlogeVideo.Time()))) F.nbImages++;
}

void Cadre::filmPas() {
  if (!film_ || film_->dansPas) return;
  std::shared_ptr<FilmEtat> P = film_;
  FilmEtat& F = *P;
  F.dansPas = true;
  const long ici = F.horloge.Time();
  const double dt = std::min(100.0, static_cast<double>(ici - F.dernier));
  F.dernier = ici;
  if (F.stop) {
    F.minuteur.Stop();
    F.dansPas = false;
    CallAfter([this] { filmFin(); });
    return;
  }
  if (!F.pause) {
    F.ang += dt / 1000 * F.vitesseOrbite;
    F.reste -= dt / F.rythme;
  }
  const double el = 0.42 + 0.08 * std::sin(F.ang * 0.7);
  vue_->filmOrbite(F.centre, F.distance, F.ang, el);
  filmImageVideo();
  if (F.reste <= 0) {
    const auto refaire = [&] {
      F.carton->Show(F.carte);
      F.haut->Refresh();
      F.bas->Refresh();
      F.carton->Refresh();
      if (!F.carte) F.carton->Lower();
      else F.carton->Raise();
    };
    switch (F.phase) {
      case 0:
        F.carte = false;
        refaire();
        F.phase = 1;
        F.reste = 500;
        break;
      case 1:
        F.phase = 2;
        F.k = 1;
        F.reste = 0;
        [[fallthrough]];
      case 2:
        if (F.k <= static_cast<int>(F.ids.size())) {
          filmAller(F.k);
          const std::string& id = F.ids[F.k - 1];
          for (const Fonction& f : doc_.fonctions)
            if (f.id == id) {
              nlohmann::ordered_json j = nlohmann::ordered_json::object();
              if (doc_.fonctionsJson) {
                const auto it = doc_.fonctionsJson->find(id);
                if (it != doc_.fonctionsJson->end()) j = nlohmann::ordered_json::parse(it->second);
              }
              natureDe(f, j, F.legNature, F.legCouleur);
              F.legNom = f.nom.empty() ? F.legNature : enTexte(f.nom);
            }
          F.legI = F.k - 1;
          F.legende = true;
          refaire();
          F.reste = F.hold;
          F.k++;
          F.horloge.Time();
        } else {
          F.phase = 3;
          F.reste = 600;
        }
        break;
      case 3:
        F.legende = false;
        F.vitesseOrbite = 0.34;
        F.carte = true;
        F.ck = L"Terminé";
        F.cs = wxString::Format(L"construite en %zu étape%s · ConceptCAD", F.ids.size(), F.ids.size() > 1 ? L"s" : L"");
        refaire();
        F.phase = 4;
        F.reste = 3200;
        break;
      default:
        F.stop = true;
        break;
    }
    F.dernier = F.horloge.Time();
  }
  F.dansPas = false;
}

void Cadre::filmFin() {
  if (!film_ || film_->finEnCours) return;
  std::shared_ptr<FilmEtat> P = film_;
  FilmEtat& F = *P;
  F.finEnCours = true;
  F.minuteur.Stop();
  if (F.video) {
    if (F.video->fermer()) F.videoFaite = F.cheminVideo;
    F.video.reset();
  }
  const bool arrete = F.phase < 4;
  film_.reset();
  Freeze();
  F.haut->Destroy();
  F.bas->Destroy();
  F.carton->Destroy();
  for (wxWindow* w : F.masques) w->Show();
  barreHaute_->Show();
  ruban_->Show(F.rubanVu);
  miniParams_->Show(F.paramsVu);
  colonneDroite_->ShowItems(true);
  ShowFullScreen(false);
  ::SetMenu(GetHWND(), nullptr);  // le plein écran remet la barre de menus, cachée comme à l'ouverture
  centre_->Layout();
  Thaw();
  vue_->Enable(true);
  // Tout revient comme avant : document, marqueur, caméra
  doc_ = std::move(F.sauve);
  marqueTemps_ = F.marque;
  placerScene();
  remplirArbre();
  montrerRien();
  recalculer();
  vue_->filmFin();
  vue_->SetFocus();
  dernierFilm_ = F.videoFaite;
  etat(!F.videoFaite.IsEmpty() ? L"🎬 Film enregistré : " + F.videoFaite : arrete ? wxString(L"Film de construction arrêté.") : wxString(L"🎬 Fin du film de construction."));
}
