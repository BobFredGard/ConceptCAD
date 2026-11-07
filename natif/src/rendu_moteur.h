// L'atelier Rendu : sa propre scène et son propre calcul, la vue de modélisation n'est jamais touchée
// (comme src/98-rendu.js du navigateur). Le dessin vient d'OCCT : matières physiques et lancer de rayons ;
// tout finit en nombres linéaires, repris par la finition (rendu_finition) pour l'exposition, les tons, le fond.
#pragma once

#include <array>
#include <memory>
#include <string>
#include <vector>

#include <wx/window.h>

#include <AIS_InteractiveContext.hxx>
#include <AIS_Shape.hxx>
#include <Graphic3d_CubeMap.hxx>
#include <OpenGl_GraphicDriver.hxx>
#include <TopoDS_Shape.hxx>
#include <V3d_DirectionalLight.hxx>
#include <V3d_View.hxx>
#include <V3d_Viewer.hxx>

#include "rendu_scene.h"

struct MatiereRendu {
  const char* cle;
  const wchar_t* nom;
  const wchar_t* famille;
  unsigned couleur;
  double metal, rugosite, vernis, vernisRugosite, transmission, indice, velours, densite;
};
const std::vector<MatiereRendu>& bibliothequeRendu();
const MatiereRendu* matiereRendu(const std::string& cle);

// Les réglages de l'atelier, mêmes noms et mêmes valeurs de départ que RD_DEF
struct ReglagesRendu {
  std::string amb = "studio", fond = "degrade", fc1 = "#f2f3f5", fc2 = "#c3c7ce", tons = "aces", res = "1080", aretes = "non", solCol, moteur = "rapide", support;
  double envRot = 0, envInt = 1, lum = 1, ombre = 0.45, douceur = 6, focale = 50, ev = 0, ech = 64, ouv = 0, map = 0;
  double pDen = 0.5, pHalo = 0, pVig = 0, pGrain = 0, pCon = 0, pSat = 0, pTemp = 0;
  bool solOn = true, miroir = true, ombreOn = true, calques = false;
  std::shared_ptr<const ImageHdri> hdri;  // quand amb vaut « hdri »
};

struct PieceRendu {
  TopoDS_Shape forme;
  std::string cle;      // le matériau ; vide : plastique de la CAO
  unsigned couleur = 0x9a9aa0;
  std::string id;       // le corps (clic droit)
  std::string occ, bid;  // l'occurrence d'un autre composant et son corps : l'apparence va sur l'occurrence
  std::string nom;
  unsigned couleurCao = 0x9a9aa0;  // l'apparence de la CAO
  bool propre = false;             // une apparence propre au rendu
};

struct CameraRendu {
  std::array<double, 3> oeil{}, cible{}, haut{0, 0, 1};
};

// Une image en nombres : rgb linéaires prémultipliés par a, a la couverture
struct ImageLineaire {
  int w = 0, h = 0;
  std::vector<float> px;  // 4 × w × h, du haut vers le bas
};

// Le fond « Image » : la lumière de l'image HDRI vue dans chaque direction de la caméra (rgb linéaires, du haut vers le bas)
void fondPanorama(const ReglagesRendu& s, const CameraRendu& c, double focale, int w, int h, std::vector<float>& rgb);

// Le ciel d'une ambiance pour la vue de modélisation, à multiplier par ECH_CUBE (l'intensité de sa lumière ambiante)
const double ECH_CUBE = 16;
occ::handle<Graphic3d_CubeMap> cubeVue(const std::string& amb, const ImageHdri* h, double rot, double hemi, std::array<double, 2>& cle);

class MoteurRendu {
 public:
  MoteurRendu(wxWindow* parent, const occ::handle<OpenGl_GraphicDriver>& pilote);
  ~MoteurRendu();
  void pieces(const std::vector<PieceRendu>& L);
  // Tout ce qui dépend des réglages : ambiance, lampe, sol, matières. Remet l'affinage à zéro.
  void appliquer(const ReglagesRendu& r);
  void camera(const CameraRendu& c, double focale);
  void boite(double b[6]) const;
  void reprendre() { passes_ = 0; somme_.clear(); }
  int passes() const { return passes_; }
  // Une passe de plus : le résultat moyen est dans image()
  bool passe(int w, int h);
  const ImageLineaire& image() const { return image_; }
  // Pour la retouche, même cadrage que l'image : masque, profondeur, normales, identifiants, ombre (nom de fichier, image)
  bool calques(int w, int h, std::vector<std::pair<std::string, wxImage>>& L);
  std::string erreur;
  double msPasse = 0;

 private:
  bool passeRayons(int w, int h);
  bool passeRapide(int w, int h);
  bool masque(int w, int h, const CameraRendu& c);
  bool rendre(const CameraRendu& c, double fovy, bool ortho, double echelle, int w, int h, std::vector<float>& px);
  double alphaSol(const double P[3]) const;
  std::string solHex() const;
  std::vector<float> pieces1_, reflet_, ombre_;
  void poserCamera(const CameraRendu& c);
  void reglerRayons(bool oui);
  occ::handle<V3d_Viewer> visu_;
  occ::handle<V3d_View> vue_;
  occ::handle<AIS_InteractiveContext> contexte_;
  occ::handle<V3d_DirectionalLight> lampe_;
  wxWindow* fenetre_ = nullptr;
  std::vector<PieceRendu> pieces_;
  std::vector<occ::handle<AIS_Shape>> objets_;
  occ::handle<AIS_Shape> sol_;
  ReglagesRendu st_;
  CameraRendu cam_;
  double focale_ = 50, cx_ = 0, cy_ = 0, z0_ = 0, R_ = 50, box_[6] = {-50, -50, 0, 50, 50, 50};
  int passes_ = 0;
  std::array<double, 2> cle_{-55, 45};
  std::vector<double> somme_;
  std::vector<float> masque_;
  int mw_ = 0, mh_ = 0;
  ImageLineaire image_;
  bool rayons_ = false;
  bool rayonsSansTexture_ = false;  // la carte graphique ne sait pas lire de texture dans le lancer de rayons
  occ::handle<Standard_Transient> tampon_, tamponOmbre_;
  int tw_ = 0, th_ = 0;
};
