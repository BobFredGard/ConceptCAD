// La mise en plan (src/98-mep-*.js) : planches, vues projetées, cotes.
// Le dessin d'une planche est une liste d'éléments, les mêmes que ceux que le navigateur pose dans son SVG :
// c'est elle qu'on compare au navigateur, qu'on affiche et qu'on exporte.
#pragma once
#include <BRepAdaptor_Curve.hxx>
#include <TopoDS_Shape.hxx>

#include <array>
#include <functional>
#include <map>
#include <memory>
#include <nlohmann/json.hpp>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "assemblage.h"
#include "projet.h"
#include "rejeu.h"

namespace plan {
using J = nlohmann::ordered_json;
using V3 = std::array<double, 3>;
using P2 = std::array<double, 2>;

// Un élément SVG : son nom, ses attributs dans l'ordre et son texte
struct Elt {
  std::string tag;
  std::vector<std::pair<std::string, std::string>> at;
  std::string txt;
  bool aide = false;  // calque d'aide (mepGHlp) : jamais exporté
  int niveau = 0;  // 1 : tspan du texte qui précède ; 2 : tspan de ce tspan
  const std::string* attr(const std::string& n) const {
    for (const auto& a : at)
      if (a.first == n) return &a.second;
    return nullptr;
  }
};

// Une entité projetée (e.t : L, C, A, P ; e.k : sharp, tangent, hidden, sect, thread, threadH, brk)
struct Ent {
  char t = 'L';
  double x1 = 0, y1 = 0, x2 = 0, y2 = 0, cx = 0, cy = 0, r = 0, a0 = 0, a1 = 0;
  std::string k;
  bool aW = false;
  double w = 0;
  std::vector<P2> pts;
};
using Boucle = std::vector<P2>;
struct Geo {
  struct HachureLocale {
    std::vector<Boucle> loops;
    Boucle poly;
  };
  struct RefLocale {  // l'arête retrouvée pour une coupe locale
    std::string id;
    J s;
    double w = 0;
    bool aW = false, lost = false;
  };
  std::vector<HachureLocale> hatchLoc;
  std::vector<RefLocale> locales;
  std::vector<Ent> els;
  std::vector<Boucle> hatch;
  std::vector<std::vector<Boucle>> hatchG;  // une boucle de hachures par pièce
  std::string src;
};

// Les corps : ce que la pièce rejouée montre
struct Corps {
  std::string id;
  TopoDS_Shape forme;
  bool import = false;  // fait de pièces importées seules
  std::array<double, 3> taille{0, 0, 0};  // dimensions de sa boîte (nomenclature)
  unsigned couleur = 0x9a9aa0;
  double opacite = 1;
};
// Un perçage : ce que les axes et les cotes en lisent (holeNorm, holeAxis)
struct PointTrou {
  std::string id;
  V3 p{0, 0, 0};
};
struct Trou {
  std::string fid, corps, kind, end, pilot, taille, lenMode, repetition, tolAlesage;
  bool visible = true, modele = false, lh = false, aPasDifferent = false, aFiletIso = false, aPlan = false, aPlanFilet = false;
  double d = 0, stD = 0, stH = 0, cbD = 0, cbH = 0, csD = 0, csA = 0, depth = 0, pas = 0, longueurFilet = 0, lenFilet = 0, thD = 0, thD1 = 0, thC = 0;
  V3 dir{0, 0, 0}, planP{0, 0, 0}, planN{0, 0, 0}, planFiletP{0, 0, 0}, planFiletN{0, 0, 0};
  std::vector<PointTrou> pts;
  double tip = 0;
};
// Un axe de révolution d'un solide (mepShapeRevs)
struct RevAxe {
  V3 o{0, 0, 0}, d{0, 0, 0};
  double t0 = 0, t1 = 0, r = 0, u = 0;
  std::vector<double> rs;
};
// Le filet cosmétique d'un perçage (mepThreadEls)
struct Filet {
  std::string corps, taille, lenMode;
  double D = 0, d = 0, depth = 0, entree = 0, len = 0;
  V3 dir{0, 0, 0};
  std::vector<V3> centres;
};
// L'hélice d'un filet, comme dans la vue 3D : pour l'image ombrée d'une vue
struct FiletImage {
  std::string corps;
  std::vector<V3> helice, anneau;
};
// Pour les vues « Assemblage » (48-composants-plan) : un corps d'une instance, déjà placé
struct CorpsInstance {
  std::string comp, id, chemin;
  TopoDS_Shape forme;
  unsigned couleur = 0x9a9aa0;
  double opacite = 1;
};
// Une instance dans la nomenclature des composants
struct LigneInstance {
  std::string comp, nom, mat, dims;
  int profondeur = 1;
  bool feuille = true;
};
struct Piece {
  std::vector<Corps> corps;
  std::vector<FiletImage> helices;
  bool assemblage = false;  // asmPlanOn : le composant actif a des occurrences
  std::vector<CorpsInstance> instances;
  std::vector<LigneInstance> lignesInstances;
  std::vector<Filet> filets;
  std::vector<Trou> trous;
  std::vector<std::pair<std::string, std::string>> nomsCorps;  // doc.bodies : id, nom
};
// doc : le fichier, pour ce que le modèle ne garde pas
Piece pieceDe(const Document& d, const ResultatRejeu& r, const J& doc);
// Ajoute ce que montrent les vues « Assemblage » : les corps des instances sous le composant actif
void completerAssemblage(Piece& p, const Document& d, const assemblage::Solides& S);

// doc.mep : les planches, complétées comme à l'ouverture (mepEnsure, mepNormSheet)
void normaliser(J& mep);

// Ce qu'il faut pour l'image ombrée d'une vue (mepRender3dImage). Le cadre (l, t, r, b) est en mm modèle, repère de la vue.
struct DemandeImage {
  std::string cle;
  V3 u{1, 0, 0}, v{0, 0, -1}, dir{0, -1, 0};
  bool persp = false;
  V3 oeil{0, 0, 0}, vise{0, 0, 0};
  double fov = 35;
  double l = 0, t = 0, r = 0, b = 0;
  int W = 64, H = 64;
  struct Teinte {
    TopoDS_Shape forme;
    unsigned couleur = 0;
    double opacite = 1;
  };
  std::vector<Teinte> corps;
  std::vector<FiletImage> filets;
  bool reel = false;  // « Rendu réaliste » : comme le Rendu direct
  bool miroir = false;  // le reflet de la pièce sous son point le plus bas, estompé vers le bas
  double zBas = 0, fondu = 1;
};
struct CadreImage {
  bool ok = false;
  double l = 0, t = 0, largeur = 0, hauteur = 0;
  std::string cle;
};

// Ce qui est sélectionné dans la planche (mepSt.sel, selDim, selBl, lot)
struct SelectionPlan {
  std::string vue, cote, bulle;
  std::string axeVue, axeId, axeAk;  // le trait d'axe choisi (axeId : axe manuel, sinon le seul trait automatique)
  std::set<std::string> lotVues, lotCotes;
  std::vector<std::string> skSel;  // mepSt.skSel, dans l'ordre : « p:id », « e:id », « c:id »
  std::string locVue, locId;  // mepSt.selLoc
  std::string ordCote;  // mepSt.ordPt : la valeur désignée d'un groupe d'ordonnées (-1 : l'origine)
  int ordPt = -2;
  int pointOrd() const { return !ordCote.empty() && ordCote == cote ? ordPt : -2; }
  bool vide() const { return vue.empty() && cote.empty() && bulle.empty() && axeVue.empty() && lotVues.empty() && lotCotes.empty() && skSel.empty(); }
};
// Une cote telle qu'elle vient d'être dessinée : ce qui sert à la saisir (mepDimHits, mepDimTextPos)
struct CoteVue {
  struct Seg {
    double x1, y1, x2, y2;
  };
  std::vector<Seg> traits;
  bool aTexte = false, aFleches = false;
  double tx = 0, ty = 0, fx1 = 0, fy1 = 0, fx2 = 0, fy2 = 0;
};

// Les vues calculées d'un document : refaites seulement si la vue change
class Calcul {
 public:
  void oublier() {
    images_.clear();
    cache_.clear();
    cylindres.clear();
    revolutions.clear();
  }
  const Geo& geoDe(const J& vue, const J& planche, const J& mep, const Piece& p);
  // L'image ombrée d'une vue, refaite seulement si la vue change ; sans fonction de rendu, pas d'image
  const CadreImage& imageDe(const J& vue, const Piece& p);
  std::function<void(const DemandeImage&)> rendreImage;
  std::string sigReel;  // ce qui change l'image réaliste : les réglages de la fenêtre RENDU
  std::map<std::string, std::vector<RevAxe>> cylindres, revolutions;
  const SelectionPlan* selection = nullptr;  // à montrer au prochain dessin
  std::map<std::string, CoteVue> cotesVues;  // remplie par le dessin
  bool esqPlanche = false, esqCartouche = false;  // en édition : les champs vides se montrent {COMME CECI}

 private:
  std::map<std::string, std::pair<std::string, CadreImage>> images_;
  int compteurImages_ = 0;
  std::map<std::string, std::pair<std::string, std::shared_ptr<Geo>>> cache_;
};

// Le dessin de la planche courante, sans les aides de la souris (mepRenderCorps)
// Les points de cote suivent la géométrie : mep est mis à jour comme dans le navigateur.
std::vector<Elt> dessiner(J& mep, int planche, const Piece& p, Calcul& c);
// Les gestes de la souris sur la planche (src/98-mep-80-souris.js). x, y : mm papier ; zoom : 1 = la feuille entière.
bool boiteDeVue(const J& v, const J& sh, const J& mep, const Piece& p, Calcul& c, double& x, double& y, double& w, double& h);  // mepViewSheetBBox
std::string vueSous(const J& sh, const J& mep, const Piece& p, Calcul& c, double x, double y);  // mepViewAt
std::string titreSous(const J& sh, const J& mep, const Piece& p, Calcul& c, double x, double y, double zoom, double& ecartY);  // mepViewTitleAt
std::string coteSous(const J& sh, const Calcul& c, double x, double y, double zoom);  // mepDimAt
std::string flecheSous(const J& sh, const Calcul& c, double x, double y, double zoom);  // mepDimArrowAt
bool hachureSous(const J& sh, const J& mep, const Piece& p, Calcul& c, double x, double y);  // mepHatchAt
std::string bulleSous(const J& sh, double x, double y);  // mepBalloonAt
J* vueParId(J& sh, const std::string& id);
J* coteParId(J& sh, const std::string& id);
J* bulleParId(J& sh, const std::string& id);
void deplacerVue(J& sh, J& v, double nx, double ny);  // le glisser d'une vue : contrainte de projection, mepProjFollow
void deplacerTitre(J& sh, const J& mep, const Piece& p, Calcul& c, J& v, double y, double dy);  // ttlDrag
void supprimerVue(J& sh, const std::string& id);  // mepDelView : la vue, ses filles directes, ses cotes
void supprimerVues(J& sh, const std::set<std::string>& ids);  // mepDeleteLot : avec les filles et leurs cotes
void pointBulle(const J& sh, const J& b, double& ax, double& ay);
// Le début du glisser d'une cote (mepDimDragStart), puis chaque mouvement (mepDimMoveTo)
struct GesteCote {
  double sx = 0, sy = 0, off0 = 0, txtOff0 = 0, cx = 0, cy = 0;
  bool aOff0 = false, aCentre = false, labelHit = false;
};
int pointOrdonnee(J& sh, const J& d, double x, double y);  // mepOrdPtAt
std::string nombreAffiche(double v, int dp);  // mepFmtNum
GesteCote saisirCote(J& mep, int planche, const Piece& p, Calcul& c, J& d, double x, double y, double zoom);
bool deplacerCote(J& mep, int planche, const Piece& p, Calcul& c, J& d, double x, double y, const GesteCote& g);
// La ligne de coupe sur la vue mère : la flèche d'un bout (cutDrag), un tronçon (cutSeg)
struct GesteCoupe {
  std::string vue;
  int bout = -1, j = -1;
  double s0 = 0, sx = 0, sy = 0, sG = 0;
  bool brk = false;
  enum Sorte { RIEN, MARCHE, PLAN, BRISURE } prev = RIEN;
  int k = 0;
  double valeur = 0;
  J ref;
};
bool flecheCoupeSous(J& mep, int planche, const Piece& p, Calcul& c, double x, double y, double zoom, GesteCoupe& g);  // mepCutArrowAt
bool tronconCoupeSous(J& mep, int planche, const Piece& p, Calcul& c, double x, double y, double zoom, GesteCoupe& g);  // mepCutSegAt
bool bougerFlecheCoupe(J& mep, int planche, const Piece& p, Calcul& c, GesteCoupe& g, double x, double y);
void bougerTroncon(J& mep, int planche, const Piece& p, Calcul& c, GesteCoupe& g, double x, double y, double zoom);
bool lacherTroncon(J& mep, int planche, const Piece& p, Calcul& c, GesteCoupe& g);
bool retirerBrisure(J& mep, int planche, const Piece& p, Calcul& c, const GesteCoupe& g);  // mepCutDelBreakAt
void inverserFleches(J& d);  // mepDimToggleArrows
// Les outils de cotation (plan_outils.inc)
struct SelEnt {
  std::string vid, ak, sig;
  int i = -1;
  char t = 0;
  double lx = 0, ly = 0;
};
// Un point donné à un outil d'esquisse (mepSkSnap)
struct SkPoint {
  double x = 0, y = 0;
  std::string pid, midA, midB, onT, onId;
  J vw;
};
struct OutilPlan {
  std::string tool;  // dim, hole, note, ordx, ordy, axis, et ceux de l'esquisse
  bool skDebut = false;  // tracé commencé
  SkPoint skStart, skCur;
  std::vector<SkPoint> skPts;
  J dim;             // la cote en cours de pose
  std::vector<SelEnt> entSel;
  std::string ord;
  bool hov = false, enChaine = false;
  Ent hovEnt;
  std::string hovVue;
  std::string axisMode = "hole";  // hole, align, pitch, free, sym
  std::vector<J> axisPick;
  bool aFree = false, aSym = false;
  double freeX = 0, freeY = 0;
  std::string freeVue, symVue;
  Ent symEnt;
  int symI = -1;
  std::string snapMode;  // accrochage imposé, vide = automatique
  bool aSnapHov = false, aInt = false, aDimLine = false, aCur = false;
  double hovX = 0, hovY = 0, hovQx = 0, hovQy = 0, curX = 0, curY = 0;
  std::string hovMode, hovVueS, intVue, intAk;
  int intI = -1;
  Ent intEnt, dimLineEnt;
  std::vector<Ent> hovExt;
  SelEnt dimLine;
  std::string chaineVue, chaineOrient;
  J chaineA;
  double chaineLx = 0, chaineLy = 0;
  int chaineN = 0;
};
struct SuiteOutil {
  bool change = false, effacerSelection = false, saisirNote = false;
  std::string libelle, selCote, message;
};
OutilPlan commencerOutil(const std::string& tool, const std::string& coteSelection, const J& sh);
SuiteOutil cliqueOutil(J& mep, int planche, const Piece& p, Calcul& c, OutilPlan& o, double x, double y, bool ctrl, bool maj, bool alt, double zoom);
bool survolOutil(J& mep, int planche, const Piece& p, Calcul& c, OutilPlan& o, double x, double y, double zoom);
std::string coteRappelSous(J& mep, int planche, const Piece& p, Calcul& c, J& d, double x, double y, double zoom);
bool commencerChaine(J& mep, int planche, const Piece& p, Calcul& c, OutilPlan& o, J& d, const std::string& bout);
int percagesAuto(J& mep, int planche, const Piece& p, Calcul& c, const std::string& vueChoisie);
// L'esquisse de planche et le cartouche dessiné (plan_esquisse.cpp)
struct EtatEsquisse {
  bool tbEdit = false;
  std::string hov;
  J style = J::object();
  bool visCons = true, visDims = true, visTxt = false;
  std::string textF = "txt", textS = "TEXTE";
  double textH = 0;
  bool focusVal = false;
  struct ConHit {
    std::string id;
    double x, y, w, h;
  };
  std::vector<ConHit> conHits;
};
struct ContrainteEsquisse {
  std::string id, lab, tip;
  bool dim;
};
struct InfosEsquisse {
  bool existe = false, tb = false;
  std::vector<std::string> textes, lignes, cercles, contraintes, lies, cotes;
  size_t nbCons = 0, nbEnts = 0;
};
struct ApercuEsquisse {
  enum Genre { AIDE, AIDE_POINTILLE, CONSTRUCTION, CHOISI, SURVOL, BROUILLON };
  struct Ligne {
    std::vector<std::array<double, 2>> pts;
    Genre genre = AIDE;
  };
  struct Rond {
    double x = 0, y = 0, r = 0;
    int genre = 0;  // 0 ordinaire, 1 choisi, 2 lié à une vue, 3 fixe
  };
  struct Glyphe {
    double x = 0, y = 0, w = 0, h = 0, fs = 0;
    std::string texte;
    bool choisi = false;
  };
  std::vector<Ligne> lignes;
  std::vector<Rond> ronds;
  std::vector<Glyphe> glyphes;
};
bool estOutilEsquisse(const std::string& t);
bool editionEsquisse(const EtatEsquisse& et, const std::string& outil, const SelectionPlan& sel);
double resoudreEsquisse(J& sk, int iters, const std::vector<std::string>& ancres = {});
SuiteOutil cliqueEsquisse(J& mep, int planche, const Piece& p, Calcul& c, const EtatEsquisse& et, OutilPlan& o, SelectionPlan& sel, double x, double y, double tol, double zoom);
bool survolEsquisse(J& mep, int planche, const Piece& p, Calcul& c, const EtatEsquisse& et, OutilPlan& o, double x, double y, double tol, double zoom);
std::string esquisseSous(J& mep, int planche, const Piece& p, Calcul& c, EtatEsquisse& et, const std::string& outil, const SelectionPlan& sel, double x, double y, double tol);
void choisirEsquisse(SelectionPlan& sel, const std::string& cle, bool ajout);
bool texteNonChoisi(J& sh, const EtatEsquisse& et, const SelectionPlan& sel, const std::string& cle);
J photoEsquisse(J& sh, const EtatEsquisse& et);
bool bougerEsquisse(J& sh, const EtatEsquisse& et, const J& base, const std::string& cle, double sx, double sy, double x, double y, bool& averti, std::string& message);
int cadreEsquisse(J& mep, int planche, const Piece& p, Calcul& c, const EtatEsquisse& et, SelectionPlan& sel, double x0, double y0, double x1, double y1, bool capture);
void supprimerEsquisse(J& sh, const EtatEsquisse& et, SelectionPlan& sel);
const std::vector<ContrainteEsquisse>& contraintesEsquisse();
bool contrainteAdmise(J& sh, const EtatEsquisse& et, const SelectionPlan& sel, const std::string& id);
std::string appliquerContrainte(J& sh, EtatEsquisse& et, SelectionPlan& sel, const std::string& id, bool& change);
std::string valeurContrainte(J& sh, const EtatEsquisse& et, const std::string& idC, double v, bool& change);
void detacherDeLaVue(J& sh, const EtatEsquisse& et, const std::vector<std::string>& pts);
InfosEsquisse infosEsquisse(J& sh, const EtatEsquisse& et, const SelectionPlan& sel);
J* elementEsquisse(J& sh, const EtatEsquisse& et, const std::string& id);
J* contrainteEsquisse(J& sh, const EtatEsquisse& et, const std::string& id);
const J* pointEsquisse(J& sh, const EtatEsquisse& et, const std::string& id);
J cartoucheStandard(const J& sh);  // mepTbFromStd
std::vector<std::string> pointsHorsFeuille(const J& sh);  // mepTbStray
void retirerHorsFeuille(J& sh);  // mepTbDropStray
void limitesCartouche(const J& sh, double& w, double& h);  // mepTbLim
void appliquerCartoucheDefaut(const J& mep, J& sh);  // mepNewSheet : le modèle par défaut (plan_panneau.cpp)
void lireStyleEsquisse(const J& mep, EtatEsquisse& et);  // mep_sk_style dans les réglages du projet
// Les coupes locales
std::vector<std::array<double, 2>> courbeLocale(const std::vector<std::array<double, 2>>& pts, int n = 12);  // mepLocCurve
J formeEntite(const Ent& e);  // mepIdxSnap
struct ToucheLocale {  // mepLocHit
  bool ok = false;
  std::string vid, id;
  int i = -1, seg = -1;
};
ToucheLocale localeSous(J& sh, const SelectionPlan& sel, double x, double y, double zoom);
J* coupeLocale(J& sh, const std::string& vid, const std::string& id);
// Les bulles d'une vue « Assemblage »
int bullesAutomatiques(J& mep, int planche, const Piece& p, Calcul& c);  // mepBalloonsAuto
bool ajouterBulle(J& mep, int planche, const Piece& p, Calcul& c, double x, double y, std::string& message);  // mepBalloonAddAt
// Aligner des cotes parallèles sur une cote de référence : rend le nombre alignées et ignorées
void alignerCotes(J& mep, int planche, const Piece& p, Calcul& c, const std::string& ref, const std::vector<std::string>& ids, int& n, int& ignorees);  // mepDimAlignTo
void ancreCartouche(const J& sh, double& x, double& y);  // mepTbAnchor
double hauteurCartouche(const J& sh);  // mepTbH
ApercuEsquisse aidesEsquisse(J& mep, int planche, const Piece& p, Calcul& c, EtatEsquisse& et, const OutilPlan* o, const SelectionPlan& sel, double pxMm);
// Les planches et les nouvelles vues (plan_commandes.cpp)
std::string identifiantPlan(const char* prefixe);  // mepUid
void nouvellePlanche(J& mep);
void dupliquerPlanche(J& mep, int cur);
bool vuesAutomatiques(J& mep, int planche, const Piece& p, Calcul& c);
double decalagePoints(double ax, double ay, double bx, double by, const std::string& o, double x, double y);  // mepDimOffsetFromPts
J lireDxf(const std::string& texte);  // mepDxfParse
std::string importerDxf(J& mep, int planche, const Piece& p, Calcul& c, const J& lu, const std::string& nom, int& cotes, int& perdues);  // mepImportDxf
void remplacerDxf(J& vue, const J& lu, const std::string& nom);  // mepDxfReplace
std::string ajouterVueStandard(J& mep, int planche, const Piece& p, Calcul& c, const std::string& vk);
std::string ajouterVueCamera(J& mep, int planche, const Piece& p, Calcul& c, const std::array<double, 3>& dir);
// Une commande à la souris : Projection, Coupe, Détail, Auxiliaire (mepSt.vcmd)
struct CommandeVue {
  std::string kind, par, loc;
  int stage = 0;
  bool aCur = false, maj = false, aEdge = false;
  double curX = 0, curY = 0;
  std::vector<std::array<double, 2>> pts;  // locaux à la vue mère
  double Ax = 0, Ay = 0, Bx = 0, By = 0, Cx = 0, Cy = 0, R = 0, echelle = 2;
  double e[4] = {0, 0, 0, 0};
};
struct SuiteCommande {
  bool change = false, fini = false;
  std::string select, message, selLoc;
};
struct BoutonCoupe {
  std::string act;
  double x = 0, y = 0, w = 0, h = 0;
};
struct ApercuCommande {
  struct Trait {
    double x1, y1, x2, y2;
    bool mauvais, fleche;
  };
  struct Rect {
    double x, y, w, h;
    bool fantome;
  };
  struct Rond {
    double x, y, r;
    bool fantome;
  };
  std::vector<Trait> traits;
  std::vector<Rect> cadres;
  std::vector<Rond> ronds;
  std::vector<BoutonCoupe> boutons;
  std::string texte;
  double tx = 0, ty = 0, snapX = 0, snapY = 0;
  bool aSnap = false, snapAxe = false;
};
void rejeterVues(J& mep, int planche, const Piece& p, Calcul& c, const std::string& id);  // mepReproject ; "" : toutes
bool orienterVue(J& mep, int planche, const Piece& p, Calcul& c, const std::string& id, const std::string& vk);  // mepSetBaseOrient
CommandeVue commencerCommande(const J& sh, const std::string& kind, const std::string& selection);
std::string conseilCommande(const CommandeVue& m);
std::string annulerPointCoupe(CommandeVue& m);
std::string validerCoupe(CommandeVue& m);
SuiteCommande cliqueCommande(J& mep, int planche, const Piece& p, Calcul& c, CommandeVue& m, double x, double y, bool maj, double zoom);
ApercuCommande apercuCommande(J& mep, int planche, const Piece& p, Calcul& c, const CommandeVue& m, double zoom);
ApercuCommande apercuOutil(J& mep, int planche, const Piece& p, Calcul& c, const OutilPlan& o, double zoom);
struct AxeTouche {
  std::string vid, id, ak;
  int end = 0;  // 1 ou 2 : près d'une extrémité
  bool ligne = false, libre = false;
};
std::string texteOutilAxe(const OutilPlan& o);
std::string validerMotifAxe(J& mep, int planche, const Piece& p, Calcul& c, OutilPlan& o, std::string& libelle);
std::optional<AxeTouche> axeSous(J& mep, int planche, const Piece& p, Calcul& c, double x, double y, double zoom);
bool tirerAxe(J& mep, int planche, const Piece& p, Calcul& c, const AxeTouche& h, double x, double y, double zoom);
void enleverAxe(J& v, const std::string& id);
void retirerAllongements(J& v, const std::string& id);
ApercuCommande apercuAxeChoisi(J& mep, int planche, const Piece& p, Calcul& c, const std::string& vid, const std::string& id, const std::string& ak, double zoom);
const std::vector<std::pair<std::string, std::string>>& modesAccrochage();
std::string choisirAccrochage(J& mep, int planche, const Piece& p, Calcul& c, OutilPlan& o, const std::string& mode);
void orienterCote(J& mep, int planche, const Piece& p, Calcul& c, J& d, const std::string& orient);
// Pour le panneau
bool cartoucheDessine(const J& sh);  // mepTbIsSk
double largeurCartouche(const J& sh);  // mepTbW
int nombreBrisures(const J& v);  // mepCutBreaks
std::pair<int, int> liensCoupe(const J& v);  // plans accrochés, plans
bool ajouterBrisure(J& mep, int planche, const Piece& p, Calcul& c, const std::string& vue);  // mepCutAddBreak
bool enleverBrisure(J& mep, int planche, const Piece& p, Calcul& c, const std::string& vue);  // mepCutDelBreak
struct RangNomenclature {
  std::string id, nom;
  int qte = 1;
};
std::vector<RangNomenclature> rangsNomenclature(J& mep, int planche, const Piece& p, Calcul& c);  // mepBomRows
std::string texteLuDeCote(J& mep, int planche, const Piece& p, Calcul& c, J& d);  // mepDimText(d, mepDimMeasure)
double accrocherTexteCote(J& mep, int planche, const Piece& p, Calcul& c, J& d, double v);  // mepDimTxtOffSnap
std::string toleranceAuto(J& mep, int planche, const Piece& p, Calcul& c, const J& d);  // mepHoleAutoTol
void inverserAngle(J& mep, int planche, const Piece& p, Calcul& c, J& d);  // mepDimToggleBig

// Taille de la feuille en mm
void tailleFeuille(const J& planche, double& w, double& h);
// Couleurs et épaisseurs réglées dans le fichier
struct Style {
  std::string papier = "white";
  double thick = .72, thin = .42, hid = .42, dim = .55, ext = 0, axis = 0;
  std::string couleurCotes;  // vide : l'accent du thème
};
Style styleDe(const J& mep);
// Tailles lues dans le style des cotes
struct TaillesCotes {
  double corpsCote = 4.888, corpsLbl = 6.983, fleche = 7, angleFleche = 36;
};
TaillesCotes taillesCotes(const J& mep);
// La largeur d'un texte en Arial, comme le navigateur la mesure
double largeurTexte(const std::string& s, double corps, bool gras = true);
double hauteurCapitale();  // MEP_TEXT_STYLE.capRatio
// occCurvePts
std::vector<V3> pointsDeCourbe(const BRepAdaptor_Curve& ad, double u0, double u1, double tol, size_t cap);

// Vers le fichier SVG, comme l'export du navigateur (mepExportSvg)
std::string versSvg(const std::vector<Elt>& e, const J& planche, const Style& s);
}  // namespace plan
