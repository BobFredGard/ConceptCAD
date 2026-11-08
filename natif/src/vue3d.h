// Vue 3D : une fenêtre wxWidgets dans laquelle OCCT dessine ; souris comme la version navigateur
// (gauche ou milieu : tourner, droit : déplacer, molette : zoomer) ; survol et clic sur les faces et arêtes.
#pragma once
#include "flou_vue.h"
#include <wx/wx.h>
#include <wx/timer.h>

#include <array>
#include <functional>
#include <memory>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include <AIS_InteractiveContext.hxx>
#include <AIS_Shape.hxx>
#include <AIS_ViewCube.hxx>
#include <Graphic3d_ClipPlane.hxx>
#include <Graphic3d_CubeMap.hxx>
#include <Graphic3d_TextureSet.hxx>
#include <Image_PixMap.hxx>
#include <V3d_AmbientLight.hxx>
#include <V3d_DirectionalLight.hxx>
#include <Aspect_DisplayConnection.hxx>
#include <OpenGl_GraphicDriver.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>
#include <V3d_View.hxx>
#include <V3d_Viewer.hxx>
#include <gp_Pnt.hxx>
#include <gp_Trsf.hxx>
#include <Quantity_Color.hxx>

#include "mesure.h"
#include "plan.h"
#include "fao_matiere.h"
#include "rendu_scene.h"

// La fiche ⚙ : ce que la vue de modélisation montre (collectView et vEnvCollect du navigateur)
struct OptionsVue {
  std::string env = "actuel";  // actuel, rendu, studio, clair, atelier, exterieur, noir
  bool sol = true, miroir = true, ombre = true, aretes = true, axes = true, zoomInverse = false, orbiteLibre = false;
  double fov = 50;
  bool coupe = false, coupeInverse = false, coupeRemplie = true, coupePlan = false;
  int coupeAxe = 2;
  double coupePos = 0;
  // L'ambiance réglée par vEnvCfg (Cadre::majVueEnv)
  std::string amb = "studio", fond1 = "#d3d6db", fond2 = "#9a9fa7", solCouleur = "#b4b8bf", support;
  double rot = 0, force = 1;
  std::shared_ptr<const ImageHdri> hdri;
};
// L'apparence de rendu d'un corps
struct ApparenceVue {
  TopoDS_Shape forme;
  std::string cle;
  unsigned couleur = 0x9a9aa0;
};

// Ce qui décrit le sol pour ses deux programmes (le disque et les reflets)
struct ParamSol {
  Quantity_Color fond;
  gp_Pnt centre;
  double rayon = 1, ombreK = 0, ombreO[2] = {0, 0}, ombreT = 1;
  bool tuile = false;
  double tuileT = 100, tuileK = 1, refletK = 1;
  bool coupe = false, disque = true;
  Quantity_Color haut, bas;  // le fond derrière le sol
  double cn[3] = {0, 0, 0}, cd = 0;
  gp_Dir ax[3] = {gp_Dir(1, 0, 0), gp_Dir(0, 1, 0), gp_Dir(0, 0, 1)};  // le repère du sol : son Z est le haut de la vue
};

class Vue3D : public wxWindow {
 public:
  explicit Vue3D(wxWindow* parent);
  // teintes : le solide de chaque corps et sa couleur (0xRRVVBB) ; sans elles, le bleu des pièces.
  void afficher(const TopoDS_Shape& forme, bool ajusterVue, const std::vector<std::pair<TopoDS_Shape, unsigned>>& teintes = {}, const std::vector<std::pair<TopoDS_Shape, double>>& transparences = {});
  // Pour les essais : la vue dans une image, et le temps des arêtes et du reflet au dernier affichage
  bool image(const wxString& chemin);
  // L'image ombrée d'une vue de mise en plan : hors écran, fond transparent, seulement ces corps
  bool imagePlan(const plan::DemandeImage& d, wxImage& sortie, const OptionsVue* reel = nullptr, const std::vector<ApparenceVue>* apparences = nullptr);
  // mepAddCameraView : de la cible vers l'œil
  bool directionCamera(std::array<double, 3>& d) const;
  // Les zones de l'extrusion dans la vue (extProfTick) : un clic en ajoute ou en retire une
  struct ZoneVue {
    std::vector<std::vector<gp_Pnt>> anneaux;  // l'extérieur dans le sens direct, puis les trous dans l'autre
    gp_Pnt o;
    gp_Dir u, v;
    bool choisie = false, survol = false;
  };
  void montrerZones(const std::vector<ZoneVue>& L);
  std::function<bool(const wxPoint&, bool clic)> surZone;
  void rayonEcran(int x, int y, gp_Pnt& o, gp_Dir& d) const { rayon(x, y, o, d); }
  // Essai : enfonce en (x,y), glisse de (dx,dy), relâche ; r = pivot (3), son écran avant (2) et après (2)
  void essaiOrbite3D(int x, int y, int dx, int dy, double r[7]);
  // Essai : survoler ou cliquer un point de la vue 3D
  void essaiSurvol3D(int x, int y) {
    if (!placer_) preparerSelection();
    survoler(wxPoint(x, y));
  }
  void essaiClic3D(int x, int y) { cliquerEn(wxPoint(x, y)); }
  bool areteSurvolee() const { return survolArete_; }
  wxPoint ecranDe(const gp_Pnt& p) const;
  void montrerFilets(const std::vector<std::vector<gp_Pnt>>& helices, const std::vector<std::vector<gp_Pnt>>& anneaux);
  // Ceux des autres composants de l'assemblage (asmThrLines), déjà placés
  void montrerFiletsAutres(const std::vector<std::vector<gp_Pnt>>& helices, const std::vector<std::vector<gp_Pnt>>& anneaux);
  // Les esquisses visibles (drawSketchHelpers) : traits forts, construction en tiretés, axes en tiretés longs
  void montrerEsquisses(const std::vector<std::vector<gp_Pnt>>& forts, const std::vector<std::vector<gp_Pnt>>& aides, const std::vector<std::vector<gp_Pnt>>& axes, const Quantity_Color& couleurForts);
  // cgDraw : plans translucides, axes en pointillés, points, repères. Rien de tout cela ne se clique ici : on les choisit dans l'arbre ou les listes.
  struct DessinConstruction {
    std::string kind;
    double o[3], x[3], y[3], z[3];
    bool choisi = false;
  };
  void montrerConstruction(const std::vector<DessinConstruction>& L, const double centre[3], double h);
  wxPoint dernierClic() const { return dernierClic_; }
  // Le point de la pièce sous le dernier clic
  void dernierPoint(double p[3]) const {
    p[0] = dernierPoint_[0];
    p[1] = dernierPoint_[1];
    p[2] = dernierPoint_[2];
  }
  double msAffichage() const { return msAffichage_; }
  double msImage() const { return msImage_; }
  double msOmbre() const { return msOmbre_; }
  void ajuster();
  void vueInitiale();
  void vueStandard(const std::string& quelle);  // iso, top, front, right
  // Le film de construction : la caméra gardée, le cube retiré ; l'orbite autour d'un point ; une image de la vue
  void filmDebut();
  void filmFin();
  void filmOrbite(const double centre[3], double distance, double angle, double elevation);
  bool captureFilm(wxImage& sortie, int largeur, int hauteur);
  const OptionsVue& options() const { return opt_; }
  void options(const OptionsVue& o);
  void apparences(const std::vector<ApparenceVue>& L);
  void poserApparences(const std::vector<ApparenceVue>& L) { apparences_ = L; }  // sans dessin : options() suit
  bool boiteVisible(double b[6]) const;
  // Prépare la sélection de la forme affichée (fait tout seul au premier passage de la souris).
  void preparerSelection();
  // Appelé après un clic : la face ou l'arête choisie, ou une forme vide.
  std::function<void(const TopoDS_Shape&)> surSelection;
  // Clic droit sans déplacement : ce qui est sous la souris, ou une forme vide
  std::function<void(const TopoDS_Shape&)> surDroit;
  std::function<void(const TopoDS_Shape&)> surAltDouble;  // Alt + double-clic : isoler ce corps
  void recentrerEn(const wxPoint& p);                     // Ctrl + clic droit
  void droitEn(const wxPoint& p);
  // Le choix des arêtes d'un congé : arêtes vives en noir, tangentes en gris ; les clics restent sur la pièce d'origine, même quand l'aperçu la remplace.
  void debutChoix(const TopoDS_Shape& vives, const TopoDS_Shape& tangentes);
  void montrerChoix(const TopoDS_Shape& choisies, const TopoDS_Shape& apercu, const std::vector<TopoDS_Face>& nouvelles);
  void finChoix();
  // Le choix de faces : seules les faces se cliquent ; les retenues en orange, la référence en bleu, par-dessus la pièce
  void debutChoixFaces();
  void montrerFaces(const std::vector<TopoDS_Face>& retenues, const std::vector<TopoDS_Face>& reference, const TopoDS_Shape& apercu, unsigned couleurApercu, const TopoDS_Shape& plan);
  std::vector<TopoDS_Face> facesChoisies() const;  // hors choix : les faces sélectionnées (Ctrl+clic pour en ajouter)
  // Pour les essais : là où un point de la pièce tombe à l'écran, et un clic à cet endroit
  wxPoint pixelDe(double x, double y, double z) const;
  void cliquerEn(const wxPoint& p);

  // L'assemblage : chaque instance placée, autour de la pièce du composant actif
  struct OccVue {
    TopoDS_Shape forme;
    gp_Trsf t;
    std::vector<std::pair<TopoDS_Shape, unsigned>> teintes;
    std::vector<std::pair<TopoDS_Shape, double>> transparences;
    double transparence = -1;  // celle de l'occurrence, sinon celles des corps
    bool fantome = false, cliquable = false;
    std::string cle;  // l'enfant direct du composant actif auquel elle appartient
    std::vector<std::string> chemin;
    bool aretes = false;
    TopoDS_Shape vives, lisses;
    std::vector<std::array<float, 9>> traits;  // lignes de champ d'un aimant : a, b, couleur
  };
  void montrerOccurrences(const std::vector<OccVue>& L);
  void modePlacer(bool oui);
  void cheminPiece(const std::vector<std::string>& c) { cheminPiece_ = c; }
  void choisirOccurrences(const std::set<std::string>& cles);
  std::function<void(const std::string& cle, bool ctrl, bool maj)> surOccurrence;  // cle vide : rien sous le clic
  std::function<void(const std::string& cle)> surOccDouble, surOccDroit;
  // Le manipulateur : flèches et anneaux de taille constante à l'écran, saisis au plus près du pixel
  struct Gizmo {
    bool actif = false;
    std::array<double, 3> o{0, 0, 0};
    std::array<std::array<double, 3>, 3> ax{};
    bool fleche[3] = {false, false, false}, anneau[3] = {false, false, false};
    std::string degreFleche[3], degreAnneau[3];
  };
  void poserGizmo(const Gizmo& g);
  bool gizmoActif() const { return gizmo_.actif; }
  bool gizmoEnMain() const { return gizmoSaisi_ >= 0; }
  void deplacerGizmo(const std::array<double, 3>& o, const std::array<double, 3>& axe);  // la poignée suit pendant le geste
  wxPoint pointeGizmo() const;                                                           // la pointe de la flèche ou de l'anneau, à l'écran
  bool essaiTirer(const wxPoint& a, const wxPoint& b, bool libre);                       // pour les essais : un vrai geste, du pixel a au pixel b
  std::function<void(int phase, const std::string& sorte, int axe, const std::string& degre, double valeur, bool libre)> surGeste;
  // Les marques de la commande Aligner : triades et points, cliquables
  struct Marque {
    std::array<double, 3> o{0, 0, 0}, x{1, 0, 0}, y{0, 1, 0}, z{0, 0, 1};
    bool point = false, orange = false, grand = false;
  };
  void poserMarques(const std::vector<Marque>& L);
  // L'inspection : les volumes en interférence en rouge, le centre de gravité en jaune
  void montrerInspection(const std::vector<TopoDS_Shape>& rouges, bool aCentre, const gp_Pnt& centre);
  std::function<void(int)> surMarque;
  // Une commande qui prend le rayon du clic (pose sur des trous) : rend vrai si le clic est consommé
  std::function<bool(const gp_Pnt& o, const gp_Dir& d)> surRayon;
  std::function<void(const std::vector<std::string>& chemin, const gp_Pnt& p, bool plan, const std::array<double, 3>& normaleLocale)> surFaceOcc;
  // La mesure : la face ou l'arête sous le clic (propre : la pièce affichée, sinon une occurrence), et ce qu'il faut tracer
  struct CoupVue {
    TopoDS_Shape s;
    gp_Trsf t;
    gp_Pnt p;
    bool propre = false;
    std::vector<std::string> chemin;
  };
  std::function<void(const CoupVue* c, bool ctrl, bool maj)> surMesure;
  void montrerMesure(const mesure::Dessin& d);
  // La FAO : traces en couleurs dans le repère du posage, et le brut
  struct DessinFao {
    std::vector<float> coupe, rapides, remontees, plongees;  // des segments : x y z x y z
    double x[3] = {1, 0, 0}, y[3] = {0, 1, 0}, z[3] = {0, 0, 1}, o[3] = {0, 0, 0};
    bool fondu = false, masque = false;
  };
  void montrerFao(const DessinFao& d);
  // Le reste de la scène FAO, déjà en coordonnées de la pièce : traits, faces translucides, points
  struct ObjetFao {
    char sorte = 'S';  // S : segments ; L : ligne ; B : boucle ; T : triangles ; P : points
    std::vector<float> a;
    unsigned couleur = 0xffffff;
    double alpha = 1, taille = 0;
    bool profondeur = true;
    std::vector<float> n;  // des normales : la matière est alors éclairée
    bool ancre = false;   // un repère : même taille à l'écran quel que soit le zoom, posé en ax ay az
    double ax = 0, ay = 0, az = 0;
    unsigned reflet = 0x111111;
    double brillance = 30;
    bool brut = false;  // le brut du posage : le sol miroir passe sous lui (floorMeshes)
  };
  void montrerSceneFao(const std::vector<ObjetFao>& L);
  // La lecture d'usinage : la matière, l'outil qui suit le parcours, le bout de trace derrière lui
  void simMatiere(const GrilleFao& g, const float* cols, size_t n, const double* racine);
  void simColonnes(const float* cols, size_t n);
  void simSansMatiere();
  void simOutil(const std::vector<ObjetFao>& fixes, const std::vector<ObjetFao>& tournants);
  void simPoseOutil(const double m[16], double angle);
  void simLigne(const std::vector<float>& xyzrgb, const double* racine);
  void simMasquerPiece(bool oui);
  void simFin();
  void simDessiner();
  // L'atelier FAO prend les clics de la vue, avec la caméra
  struct ClicFao {
    int x = 0, y = 0, w = 0, h = 0, bouton = 0;
    bool ctrl = false, maj = false, persp = true, survol = false;
    double proj[16], vue[16], pres = 0.1, loin = 1000;
  };
  const occ::handle<OpenGl_GraphicDriver>& pilote() const { return pilote_; }
  std::array<double, 3> oeil() const;
  std::array<double, 3> cibleVue() const;
  std::function<bool(const ClicFao&)> surClicFao;
  bool faoSurvol = false;
  void cliquerFao(const wxPoint& p, int bouton, bool ctrl, bool maj, bool survol = false);
  void faoModeChoix(const std::string& mode);
  // Le haut de la vue (viewUpSync) : Z monde, ou Z du posage / de l'opération 3+2 en FAO. Le sol miroir lui est
  // perpendiculaire, posé sous le point le plus bas de la pièce le long de cet axe ; l'orbite contrainte tourne autour.
  void hautVue(const gp_Dir& U);
  // Le flou sous un panneau en vitre (backdrop-filter du navigateur) : la zone en fractions de la vue
  void flouSous(bool actif, double x = 0, double y = 0, double l = 0, double h = 0, double rayon = 0);  // "chaine" : le survol allume les arêtes ; "point" : curseur en croix
  int essaiCtrl = -1, essaiMaj = -1;  // l'essai automatique tient les touches à la place de l'utilisateur

 private:
  void surPeinture(wxPaintEvent&);
  void surTaille(wxSizeEvent&);
  void surEnfonce(wxMouseEvent&);
  void surRelache(wxMouseEvent&);
  void surMouvement(wxMouseEvent&);
  void surMolette(wxMouseEvent&);
  void surPerteSouris(wxMouseCaptureLostEvent&);
  void tournerZ(double dx, double dy);
  void tournerLibre(double dx, double dy);  // orbitRotate libre : autour des axes de l'écran
  void tourner(double dx, double dy) { opt_.orbiteLibre ? tournerLibre(dx, dy) : tournerZ(dx, dy); }
  // orbitTick : le glissé s'accumule, 20 % du reste par image (ORBIT_ROT_DAMP), l'inertie finit le geste
  wxTimer minuterieOrbite_;
  double resteX_ = 0, resteY_ = 0;
  bool orbiteTenue_ = false;
  void surTicOrbite(wxTimerEvent&);
  void arreterOrbite();
  ParamSol paramSol() const;
  void majReflets();
  occ::handle<Graphic3d_Camera> cameraFilm_;
  void surDouble(wxMouseEvent&);
  void refaireReflets();
  void majMatieres();
  void majSol();
  void majCoupe();
  void majAretes();
  void majAxes();
  void majAmbiance();
  void calculerOmbre(const std::vector<std::pair<TopoDS_Shape, gp_Trsf>>& L);
  OptionsVue opt_;
  std::string sigAmbiance_ = "actuel", sigOptions_;
  bool coupeAppliquee_ = false, matieresRendues_ = false;
  std::array<double, 2> cleAmbiance_{-34, 59};
  occ::handle<V3d_AmbientLight> lumAmbiante_;
  occ::handle<V3d_DirectionalLight> lumCle_, lumCiel_;
  occ::handle<Graphic3d_CubeMap> cubeStudio_;
  std::vector<ApparenceVue> apparences_;
  std::vector<std::pair<TopoDS_Shape, double>> transparencesPiece_;
  occ::handle<AIS_Shape> disque_, planCoupe_;
  occ::handle<AIS_InteractiveObject> axes_;
  occ::handle<Graphic3d_ClipPlane> coupe_;
  occ::handle<Image_PixMap> imageOmbre_;
  occ::handle<Graphic3d_TextureSet> texturesSol_;
  int coucheSol_ = 0;
  double ombreO_[2] = {0, 0}, ombreT_ = 1, rayonSol_ = 1, centreSol_[2] = {0, 0}, sigOmbre_ = 0;
  gp_Pnt pivot_;
  // viewHitAt : le pivot de la rotation est le point visé (matière simulée, pièce), sinon le centre de la scène
  gp_Pnt pointPivot(const wxPoint& p);
  occ::handle<AIS_InteractiveObject> marquePivot_;  // orbitMarkShow : point orange pendant la rotation
  void cacherPivot();
  // hoverMove : une face survolée en voile bleu, une arête en orange-rouge (edgeHoverDraw)
  void survoler(const wxPoint& p);
  bool survolArete_ = false;
  void majTailles();
  double echelleEn(const gp_Pnt& p) const;
  void rayon(int x, int y, gp_Pnt& o, gp_Dir& d) const;
  bool lireCoup(const wxPoint& p, CoupVue& c);
  bool coupMesure(const wxPoint& p, CoupVue& c);
  std::vector<occ::handle<AIS_InteractiveObject>> mesureAis_;
  bool saisirGizmo(const wxPoint& p, wxMouseEvent& e);
  void bougerGizmo(const wxPoint& p, bool libre);
  int marqueSous(const wxPoint& p) const;
  struct OccAffichee {
    occ::handle<AIS_Shape> piece, vives, lisses;
    occ::handle<AIS_InteractiveObject> traits;
    OccVue v;
  };
  std::vector<OccAffichee> occs_;
  std::vector<occ::handle<AIS_InteractiveObject>> faoAis_, faoScene_;
  occ::handle<MatiereFao> simMatiere_;
  occ::handle<AIS_InteractiveObject> simLigne_;
  std::vector<occ::handle<AIS_InteractiveObject>> simFixes_, simTournants_, simCaches_;
  bool simPieceMasquee_ = false;
  bool faoPrisClic_ = false;
  bool placer_ = false, ignorerRelache_ = false, aligner_ = false;
  std::vector<std::string> cheminPiece_;
  std::vector<std::pair<TopoDS_Shape, unsigned>> teintesPiece_;
  TopoDS_Shape formePiece_;
  std::vector<occ::handle<AIS_Shape>> gizmoAis_, inspectionAis_;
  Gizmo gizmo_, gizmoTenu_;  // gizmoTenu_ : tel qu'à la saisie, la référence du geste
  int gizmoSaisi_ = -1;  // 0..2 : flèche ; 3..5 : anneau
  bool gizmoBouge_ = false;
  double gizmoT0_ = 0;
  gp_Vec gizmoP0_;
  std::vector<occ::handle<AIS_Shape>> marquesAis_;
  std::vector<Marque> marques_;

  occ::handle<Aspect_DisplayConnection> connexion_;
  occ::handle<OpenGl_GraphicDriver> pilote_;
  occ::handle<V3d_Viewer> visu_, visuImage_;
  occ::handle<V3d_View> vueImage_;
  occ::handle<AIS_InteractiveContext> contexteImage_;
  occ::handle<V3d_AmbientLight> imageAmbiante_;
  occ::handle<V3d_DirectionalLight> imageCle_, imageCiel_;
  occ::handle<Graphic3d_CubeMap> imageCube_;
  std::string imageSigCube_, imageSigActif_ = "cao";
  wxWindow* fenetreImage_ = nullptr;
  occ::handle<V3d_View> vue_;
  occ::handle<AIS_InteractiveContext> contexte_;
  occ::handle<AIS_ViewCube> cube_;
  occ::handle<AIS_Shape> affichee_;
  occ::handle<AIS_Shape> traitsVifs_, traitsLisses_, traitsChoisis_, apercu_;
  occ::handle<AIS_Shape> facesRetenues_, faceReference_, planChoix_;
  bool modeFaces_ = false;
  occ::handle<AIS_Shape> filetsHelices_, filetsAnneaux_;
  std::vector<occ::handle<AIS_Shape>> construction_, traitsEsquisses_, zonesVue_;
  bool mainZone_ = false;
  wxPoint dernierClic_;
  double dernierPoint_[3] = {0, 0, 0};  // les filets cosmétiques
  occ::handle<AIS_Shape> filetsAutresH_, filetsAutresA_;
  occ::handle<AIS_Shape> aretesVives_, aretesLisses_;  // les traits de la pièce, hors du choix d'un congé
  std::vector<occ::handle<AIS_Shape>> reflets_;  // chaque corps renversé sous le sol
  gp_Dir haut_{0, 0, 1}, solX_{1, 0, 0}, solY_{0, 1, 0};
  occ::handle<FlouVue> flou_;
  std::vector<gp_Pnt> pointsSol_;  // le brut affiché en FAO : le sol se pose aussi sous lui
  double sol_ = 0, msAffichage_ = 0, msImage_ = 0, msOmbre_ = 0;
  bool refletsVus_ = false;
  bool enChoix_ = false;
  double toleranceAvant_ = 2;
  bool selectionPrete_ = false, aBouge_ = false;
  wxPoint depart_, precedent_;
};
