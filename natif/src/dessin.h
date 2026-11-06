// Dessiner à la souris dans une esquisse : traduction des gestes de la version navigateur
// (src/60-trim-et-souris.js, src/50-esquisse-3 et 50-esquisse-2), sans fenêtre. BancDessin rejoue les mêmes
// gestes que mesures/dessin-reference.cjs fait faire au navigateur et compare toute l'esquisse après chacun.
#pragma once
#include <functional>
#include <map>
#include <set>
#include <string>
#include <vector>

#include "coter.h"
#include "projet.h"

class Dessin {
 public:
  enum Outil { SELECTION, LIGNE, RECTANGLE, CERCLE, ARC, COTE };
  struct Accroche {
    enum Sorte { AUCUNE, POINT, MILIEU, SUR_LIGNE, SUR_CERCLE } sorte = AUCUNE;
    std::string id;  // le point, la ligne ou le cercle visé
    double x = 0, y = 0;
    explicit operator bool() const { return sorte != AUCUNE; }
  };
  // Le tracé en cours, pour l'écran
  struct Brouillon {
    enum Sorte { RIEN, B_LIGNE, B_RECT, B_CERCLE, B_ARC } sorte = RIEN;
    double x1 = 0, y1 = 0, x2 = 0, y2 = 0;  // ligne et rectangle
    double cx = 0, cy = 0, r = 0, a1 = 0, a2 = 0;  // cercle et arc
    Accroche accroche;
  };
  // Le trait tiré est guidé (skInfer) : horizontal, vertical, perpendiculaire...
  struct Guide {
    bool h = false, v = false;
    double x = 0, y = 0;
    std::string perp, par, ext, tan;
    Pt depuis;
    bool actif() const { return h || v || !perp.empty() || !par.empty() || !ext.empty() || !tan.empty(); }
  };
  struct Choix {
    enum Sorte { ENTITE, POINT, COTE } sorte = ENTITE;
    std::string id;
    bool operator==(const Choix& o) const { return sorte == o.sorte && id == o.id; }
  };

  Dessin(Esquisse& s, Edition& ed);

  void vue(double pixelsParMm);  // skUpdateTols
  bool grille = true;            // case « Grille 1 mm » du navigateur, cochée par défaut
  std::function<void()> avantModif;                     // skPushUndo : l'état est encore celui d'avant
  std::function<void()> annulerPas;                     // le dernier avantModif est sans objet : la modification est refusée
  std::function<void(const std::string&)> surMessage;   // skStatus

  Outil outil() const { return outil_; }
  void choisirOutil(Outil o);  // skCancelDraft, puis l'outil
  void enfonce(double x, double y, bool ctrl);
  void bouge(double x, double y);
  void relache(double x, double y);
  // Rend la cote à ouvrir en saisie, s'il y en a une
  std::string doubleClic(double x, double y);
  void echap();     // skEscapeToSelect
  void annulerTrace();  // skCancelDraft
  void supprimer();  // deleteSkSel
  // applyCon : h, v, equal, tangent, coaxial, parallel, perpendicular, collinear, symmetric, fix, midpoint, coincident, construction
  void poserContrainte(const std::string& type);
  void toucheF1();  // skShortcut : points fusionnés, ou point posé sur une courbe
  void toucheF2();  // H ou V selon l'inclinaison de chaque ligne
  void choisirCote(const std::string& id);
  // Cote de référence ouverte en saisie : elle redevient pilotante si elle n'est plus en trop (editDim). Rend false sinon.
  bool rendrePilotante(const std::string& id);

  const Brouillon& brouillon() const { return brouillon_; }
  const Guide& guide() const { return guide_; }
  bool aMarque() const { return aMarque_; }
  Pt marque() const { return marque_; }
  const std::vector<Choix>& selection() const { return selection_; }
  bool estChoisi(Choix::Sorte s, const std::string& id) const;
  bool enCours() const { return bas_.actif || arcC_.size() || glisseP_.size() || glisseE_.actif || dyn_.actif || !dimPose_.empty() || !dimPoint_.empty() || !dimLigne_.empty(); }
  // Le centre de l'arc en cours, pour l'écran
  const std::string& centreArc() const { return arcC_; }
  // Le départ du tracé en cours
  bool departTrace(Pt& p) const;
  bool aChange() const { return change_; }
  void changeVu() { change_ = false; }

  // Outil Cote : une cote à ouvrir en saisie après ce clic, une seule fois ; la cote qui suit la souris ; un premier choix en attente
  std::string prendreCoteAOuvrir();
  bool poseEnCours() const { return !dimPose_.empty(); }
  bool coteCommencee() const { return !dimPoint_.empty() || !dimLigne_.empty(); }
  const std::string& pointCoteEnAttente() const { return dimPoint_; }
  // Pendant la pose, une valeur tapée ou Entrée : la cote reste là où elle est, sa saisie s'ouvre
  std::string poserCoteIci();

  // Longueur ou angle tapés pendant le tracé d'une ligne
  struct Saisie {
    bool actif = false, angle = false;
    std::string texte;
  };
  const Saisie& saisieTracee() const { return dyn_; }
  bool caractere(char c);  // chiffres et séparateur ; rend true s'il a servi
  bool tabulation();
  bool entree();
  bool retourArriere();

  // Pour les essais
  void premiere();

 private:
  struct Bas {  // skDown
    bool actif = false;
    std::string pid;
    double x = 0, y = 0;
    bool depuisChaine = false, clique = false, centre = false;
    double wx = 0, wy = 0;  // position de la souris au moment du clic
  };
  struct GlisseE {  // skDragEnt
    bool actif = false, pousse = false, rigide = false;
    double x0 = 0, y0 = 0;
    std::vector<std::string> pids, ancre;
    std::vector<Pt> orig;
  };
  struct Compo {
    std::vector<std::string> pids, ents;
  };

  // Le modèle
  void pousser();  // skPushUndo
  void message(const std::string& m) const {
    if (surMessage) surMessage(m);
  }
  void sync();
  void resoudre(int iters = 120);
  void apresEdition();  // afterEdit
  void nettoyer();      // cleanupSk
  void controlerCotes();  // skCheckNewDims
  void dedoublonner();    // skDedupConstraints
  std::string nouvelE() { return "e" + std::to_string(s_.seq++); }
  std::string ajouterPoint(double x, double y);
  std::string pointA(double x, double y);  // pidAt
  void lier(Contrainte c);                 // pose la contrainte, avec un nouvel identifiant
  bool aContrainte(const std::function<bool(const Contrainte&)>& f) const;
  bool aHV(const std::string& ligne, const char* t) const;
  std::vector<std::string> ptsEntite(const Entite& e) const;  // skEntPids
  Entite* entite(const std::string& id);

  // Accroches
  std::string pointProche(double x, double y, double maxD, const std::string& sauf = "") const;  // nearestPoint
  const Entite* entiteProche(double x, double y, double maxD) const;                             // nearestEntity
  Accroche accroche(double x, double y, const std::string& sauf = "") const;                     // findSnap
  Accroche accrocheGlisse(double x, double y, const std::string& pid) const;                     // skDragSnapFind
  std::string pointAccroche(double x, double y);                                                 // snapNewPoint
  double pasGrille() const;                                                                      // skSnapStep
  double surGrille(double v) const;                                                              // skSnapVal
  double longueurMini() const;                                                                   // skMinLen
  void accrocher(const std::string& pid, double x, double y, double tol);                        // skAutoAttach
  bool attacherCourbe(const std::string& pid, double x, double y, double tol);                   // skAttachOnCurve
  void epinglerTangence(const std::string& ligne, const std::string& ent);                       // skPinTangent
  bool lacher(const std::string& pid, const Accroche& a);                                        // skDragRelease

  // Outil Cote
  void enfonceCote(double wx, double wy, bool ctrl);  // branche skTool==='dim' de pointerdown
  void clicCote(double x, double y, bool ctrl);       // dimClick
  bool etendreCote(const std::string& id, const Entite* ent, const std::string& pid);  // tryExtendDim
  bool versDistanceLigne(const std::string& id, const std::string& pt, const std::string& ligne);
  void versDistanceCentres(const std::string& id, const std::string& a, const std::string& b, const char* quoi);
  std::string poserCote(const std::string id);       // skDimPlaceCommit, sans la saisie : l'identifiant, ou vide si c'était un doublon
  void suivreCote(Cote& d, double wx, double wy);     // la cote de pose suit le curseur
  void orienterCote(Cote& d, double wx, double wy);   // skDimOrientAt
  void angleCote(Cote& d, double wx, double wy);      // skDimAngleAt
  Cote* cote(const std::string& id);
  bool lignesParalleles(const Entite& A, const Entite& B) const;  // skParallelPair
  void validerSaisie();                               // skDynCommit
  std::string dimPose_, dimPoint_, dimLigne_, coteAOuvrir_;
  Saisie dyn_;

  // Contraintes
  void pousserAvant();                               // skPushUndo, en gardant de quoi revenir
  bool resoudreOuRefuser(const std::string& quoi);   // skSolveOrRevert
  std::vector<std::string> pointsChoisis() const;
  std::vector<const Entite*> entitesChoisies() const;  // skSelectedEnts
  bool fusionner(std::string de, std::string vers);  // mergePoints
  void basculerConstruction();                       // toggleConstr
  Esquisse avant_;

  // Glisser
  Compo composante(const std::vector<std::string>& graines) const;  // skDragComp
  bool rigide(const Compo& c);                                      // skDragRigid

  // Tracés
  void bougerLigne(double wx, double wy);
  std::string validerLigne(const std::string& depuis, const Accroche& a, double ex, double ey);  // skCommitLine : l'identifiant de la nouvelle ligne
  void relacherLigne(double wx, double wy);
  void relacherRectangle(double wx, double wy);
  void relacherCercle(double wx, double wy);
  void enfonceArc(double wx, double wy);

  Esquisse& s_;
  Edition& ed_;
  bool structure_ = false, premiereFaite_ = false, change_ = false;
  double echelle_ = 1;
  double SNAP_ = 10, PICK_ = 8, PT_ = 10, INF_ = 6;
  std::map<std::string, std::string> signatures_;  // SK_DIM_SIG

  Outil outil_ = SELECTION;
  Bas bas_;
  std::string chaine_;
  Brouillon brouillon_;
  Guide guide_;
  bool aMarque_ = false;
  Pt marque_;
  std::string arcC_, arcPa_;
  bool arcA1Pose_ = false;
  double arcA1_ = 0;
  std::string glisseP_;
  bool glisseBouge_ = false, glissePousse_ = false;
  double deWx_ = 0, deWy_ = 0, deX_ = 0, deY_ = 0;
  Accroche glisseAcc_;
  GlisseE glisseE_;
  std::vector<Choix> selection_;
};
