// L'atelier Rendu dans la fenêtre (src/98-rendu.js du navigateur) : l'image qui s'affine dans son cadre 16:9,
// la navigation à la souris, et le panneau de réglages à droite.
#pragma once

#include <wx/bitmap.h>
#include <wx/panel.h>
#include <wx/scrolwin.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/timer.h>
#include <wx/window.h>

#include <array>
#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "rendu_finition.h"
#include "rendu_moteur.h"
#include "plan.h"

class AtelierRendu : public wxWindow {
 public:
  AtelierRendu(wxWindow* parent);
  ~AtelierRendu() override;

  // À l'entrée dans l'atelier : les pièces, et la vue de la CAO (direction et cible) qu'on recadre
  void ouvrir(const occ::handle<OpenGl_GraphicDriver>& pilote, const std::vector<PieceRendu>& L, const plan::J& docRendu, const std::array<double, 3>& oeil, const std::array<double, 3>& cible);
  void fermer();
  // Le matériau d'une pièce a changé, ou le document a été rejoué : le cadrage reste
  void changerPieces(const std::vector<PieceRendu>& L, const plan::J& docRendu);

  ReglagesRendu st;
  CameraRendu cam;
  plan::J docRendu;  // doc.rendu : les apparences propres au rendu et les vues enregistrées

  // Ce qui vient de changer
  void scene();     // ambiance, sol, lampe : l'affinage repart
  void vue();       // caméra : l'affinage repart
  void finition();  // finition seule : rien à recalculer
  void cadrer();
  void reprendreCao();
  void changerFocale(double f);
  void allerVue(const plan::J& k);
  void memoriser();  // réglages gardés pour la prochaine fois
  bool importerHdri(const std::wstring& chemin, wxString& message);
  bool voirSols = false;

  const std::vector<PieceRendu>& pieces() const { return pieces_; }
  void menuPiece(int i, wxWindow* ou);
  void preparerMenu(const std::vector<PieceRendu>& L, const plan::J& doc);  // le même menu, atelier fermé (clic droit de la vue CAO)
  void poserApparence(int i, const std::string& mat, long couleur);
  void effacerApparence(int i);

  // Rend l'image finale et l'écrit. Rend le message à afficher.
  wxString exporter(const wxString& chemin, bool avecDialogue);
  bool enregistrerApercu(const wxString& chemin);
  int nombrePasses() const;  // le nombre visé par la qualité
  void attendreFin();        // essai automatique : affine jusqu'au bout
  void lireEnv(const plan::J& rd);
  plan::J ecrireEnv() const;
  void cliquer(double u, double v);  // essai automatique : un clic dans le cadre, en proportion
  void essaiGlisser(int bouton, double u0, double v0, double u1, double v1);

  std::function<void()> surPanneau;                  // le panneau doit se redessiner
  std::function<void(const plan::J&)> surDoc;        // doc.rendu a changé
  std::function<void()> surFermer;
  bool aPourMoteur(const char* m) const { return st.moteur == m; }

 private:
  struct Etat {
    std::unique_ptr<MoteurRendu> m;
    int vp = -1, vs = -1, vc = -1;
    wxLongLong dernier = 0;
  };
  void peindre(wxPaintEvent&);
  void pas(wxTimerEvent&);
  void pasDeCalcul();
  bool synchroniser(Etat& e, bool rayons);
  Finition reglerFinition(bool rayons) const;
  void montrerImage(const ImageLineaire& im, bool rayons);
  void poserFondImage(const ImageLineaire& im, std::vector<float>& sortie) const;
  wxRect cadreImage() const;
  void souris(wxMouseEvent& e);
  int viser(const wxPoint& p, double& distance) const;
  void lireMemoire();
  void calculerBoite();

  wxTimer minuteur_;
  occ::handle<OpenGl_GraphicDriver> pilote_;
  std::vector<PieceRendu> pieces_;
  Etat rapide_, rayons_;
  int vp_ = 0, vs_ = 0, vc_ = 0, vf_ = 0, vfFaite_ = -1, passesFaites_ = -1;
  const Etat* etatFini_ = nullptr;
  bool actif_ = false, exporte_ = false, memoireSale_ = false;
  double boite_[6] = {-50, -50, -50, 50, 50, 50};
  wxBitmap image_;
  wxLongLong dernierFini_ = 0, dernierEcrit_ = 0;
  long dureeFini_ = 0;
  wxString compteur_;
  std::string erreur_;
  int bouton_ = 0;
  bool aBouge_ = false;
  wxPoint depart_, dernier_;
};

class PanneauRendu : public wxPanel {
 public:
  PanneauRendu(wxWindow* parent, AtelierRendu* a);
  void refaire();
  void message(const wxString& t);
  void lancerExport();
  bool essaiBouton(const wxString& libelle);

 private:
  void titre(const wxString& t);
  void sousTitre(const wxString& t);
  wxBoxSizer* rang(const wxString& libelle);
  void note(const wxString& t);
  void curseur(const wxString& libelle, double* valeur, double mini, double maxi, double pas, std::function<wxString(double)> texte, std::function<void()> apres);
  void segments(const wxString& libelle, const std::vector<std::pair<std::string, wxString>>& v, const std::string& actuel, std::function<void(const std::string&)> f);
  void choix(const wxString& libelle, const std::vector<std::pair<std::string, wxString>>& v, const std::string& actuel, std::function<void(const std::string&)> f);
  void boutons(const std::vector<std::pair<wxString, std::function<void()>>>& v, int parLigne);
  void coche(wxSizer* s, const wxString& libelle, bool* valeur);
  void couleur(wxSizer* s, std::string* valeur, const std::string& defaut);
  void aPres(std::function<void()> f);
  void pied();
  void ajusterDefile();

  AtelierRendu* a_;
  wxScrolledWindow* defile_ = nullptr;
  wxBoxSizer* racine_ = nullptr;
  wxStaticText* resume_ = nullptr;
  wxStaticText* message_ = nullptr;
};
