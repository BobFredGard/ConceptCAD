// Solveur d'esquisse : traduction ligne à ligne de src/50-esquisse-2-modele-solveur.js et de l'audit de
// src/50-esquisse-5-panneau-audit.js. Sans fenêtre ni noyau. BancSolveur le compare, avec les références de
// mesures/solveur-reference.cjs, au solveur du navigateur : toute modification ici doit y rester juste.
// Seule différence voulue : pas de budget de 400 ms, le calcul s'arrête après un nombre de pas, comme le banc.
#pragma once
#include <map>
#include <string>
#include <vector>

#include "projet.h"
#include "spline.h"

class Solveur {
 public:
  // Reprend l'état de l'esquisse et applique ce que font le chargement et l'ouverture dans le navigateur.
  explicit Solveur(const Esquisse& s);

  // Faux pour ce que la traduction ne couvre pas encore (splines) : l'esquisse reste alors en lecture seule.
  bool prisEnCharge() const { return raisonRefus_.empty(); }
  const std::string& raisonRefus() const { return raisonRefus_; }
  // Une ancienne cote d'entraxe a été changée en angle à l'ouverture : le fichier ne saurait pas encore le dire
  bool coteConvertie() const { return coteConvertie_; }

  // Ce que l'ouverture a ajouté (identifiants provisoires « +n ») ou retiré parmi les contraintes lues (migrateSketch)
  std::vector<Contrainte> contraintesNouvelles(std::vector<std::string>& retirees, const std::vector<Contrainte>& lues) const;
  // skGapToAngle en cours d'édition : rend true si une cote a changé de nature
  bool convertirEntraxes();

  // Comme ci-dessus, en reprenant la mémoire du solveur précédent de la même esquisse, dont la structure a changé :
  // le navigateur la garde sur chaque objet, et un objet nouveau n'en a pas.
  Solveur(const Esquisse& s, const Solveur& memoire);

  // solveSketch. Moins de 100 pas : le glisser, sans petits pas de cote ni dernier bon état.
  void resoudre(int iters = 120, const std::vector<int>* ancre = nullptr);
  double residu();  // skResid : le plus grand écart, en mm
  // skDofInfo : ce qui reste libre ; ce qu'on ne cite pas est entièrement déterminé
  struct Libertes {
    int nombre = 0;
    std::vector<std::string> points, rayons;
  };
  Libertes libertes();
  std::map<std::string, double> ecarts();  // skAudit : l'écart de chaque contrainte et cote, par identifiant
  // Écarts au-delà du seuil d'alerte, du plus grand au plus petit (3 au plus)
  std::string pireEcart();

  // Ce que rétablit une annulation (skPushUndo) : les coordonnées et les valeurs, pas la mémoire du solveur
  struct Saisie {
    std::vector<double> x, y, r, valeurs;
    std::vector<int> sgn, ccw;
  };
  Saisie instantane() const;
  void restaurer(const Saisie& s);  // sans résoudre : la mémoire liée aux objets de l'état quitté repart à zéro

  // Une valeur tapée par l'utilisateur (editDim et skSolveOrRevert) : si l'esquisse était résolue et ne l'est plus,
  // ou si une ligne est écrasée en un point, tout revient à l'état d'avant et la raison est rendue. Rend false en cas de refus.
  bool saisir(const std::string& id, double valeur, std::string* raison = nullptr, const Esquisse* formules = nullptr);
  // Les cotes à formule prennent les valeurs de cette esquisse : parResolve vient de les changer
  void poserFormules(const Esquisse& s);
  // skRevertTo, une fois l'esquisse rétablie et le solveur refait dessus : les valeurs sont notées, rien n'est résolu
  void apresRefus() { refuser(instantane()); }
  // L'annulation du navigateur (skUndoTrans) : l'état d'avant, puis une résolution
  void annuler(const Saisie& s) {
    restaurer(s);
    resoudre();
    nettoyer();
  }
  // cleanupSk : les contraintes en double disparaissent, ce qui change le poids de leurs voisines
  void nettoyer();
  bool poserCote(const std::string& id, double valeur);  // sans résoudre

  // Ce qui peut changer dans le fichier : à recopier dans le modèle affiché
  void recopierDans(Esquisse& s) const;

  // Glisser (skDragWalkTo). vueS : l'échelle de la vue, en pixels par mm, car le pas ne descend jamais sous 2 pixels.
  void glisserOublier() { marche_.actif = false; }
  void glisserPoint(const std::string& id, double x, double y, double vueS);
  // Un groupe, décalé depuis sa position d'origine. En bloc : simple translation ; sinon le solveur ajuste le reste.
  void glisserGroupe(const std::vector<std::string>& ids, const std::vector<Pt>& depart, const std::vector<std::string>& ancre, double dx, double dy, bool bloc, double vueS);
  bool pointFixe(const std::string& id) const;
  bool lirePoint(const std::string& id, double& x, double& y) const;
  std::vector<std::string> centresSymetrie() const;  // skSymCenters

  // Analyse de rang (skJacobian, skRref, skDofInfo)
  int degresLibres();
  bool coteRedondante(const std::string& id);  // skCheckNewDims : retirer cette cote ne change rien au rang
  void poserReference(const std::string& id);
  // skDimCanDrive et skDimMeasure : la cote de référence ajouterait-elle du rang en pilotant ? valeur : ce qu'elle mesure
  bool pilotanteSiPossible(const std::string& id, double& valeur);
  // Les points encore libres, pour le bleu du navigateur
  std::vector<std::string> pointsLibres();

  // Pour le banc
  const std::vector<std::string>& idsPoints() const { return idP_; }
  void etat(std::vector<double>& pts, std::vector<double>& rayons) const;
  void deplacerProjections(double dx, double dy);
  // Les arêtes projetées ont bougé dans l'esquisse : on reprend ses points sans perdre la mémoire du solveur,
  // qui dit de quel côté restait chaque élément libre.
  void reprendrePoints(const Esquisse& s);

 private:
  Solveur(const Esquisse& s, bool ouverture);
  void refuser(const Saisie& s);  // restaurer, comme skRevertTo
  struct P2 { double x = 0, y = 0; };
  enum TypeE { LIGNE, ARC, CERCLE, CPOINT, SPLINE, AUTRE };
  struct E {
    std::string id;
    TypeE t = AUTRE;
    int p1 = -1, p2 = -1, pc = -1, pa = -1, pb = -1, p = -1;
    double r = 0;
    bool proj = false, ref = false, ext = false, construction = false, verrouille = false, conduit = false;
    std::vector<int> poly;
    // Spline
    std::vector<int> pts;
    bool closed = false, ctrl = false;
    std::vector<double> knots;
    int deg = 0;
    int handle = -1;  // ligne poignée : la spline qu'elle pilote
    // La courbe se recalcule seulement si ses points ont bougé (SK_SPL_CACHE)
    mutable bool cacheVu = false, cacheOk = false;
    mutable std::vector<P2d> cacheQ, cacheH;
    mutable std::vector<char> cacheA;
    mutable BSpline cacheF;
  };
  enum TypeC { H, V, COINCIDENT, ONCIRCLE, ONLINE, MIDPOINT, PARALLEL, PERPENDICULAR, COLLINEAR, EQUAL, OFFSET, TANGENT, TANGENT2, COAXIAL, SYMMETRIC, FIX, STANGENT, SCURV, ONSPLINE, INCONNU };
  struct C {
    std::string id;
    TypeC type = INCONNU;
    int p = -1, line = -1, ent = -1, a = -1, b = -1, mid = -1, c = -1, d = -1, s = -1;
    bool aP = false, aA = false, aB = false, inf = false;
    mutable bool aU = false;  // SK_ONSPL_U : le dernier pied sur la spline, départ du suivant
    mutable double u = 0;
    int sa = 0, sb = 0;
    int cote = 0;                                  // SK_TAN_SIDE
    bool surCote = false, partage1 = false, partage2 = false;  // tangence : ligne cotée, bouts partagés
  };
  enum TypeD { LENGTH, DISTANCE, DIAMETER, RADIUS, ANGLE, GAP, DISTLINE, AUTRE_COTE };
  struct D {
    std::string id;
    TypeD type = AUTRE_COTE;
    int line = -1, ent = -1, a = -1, b = -1, p = -1;
    char orient = 0;
    double value = 0;
    bool ref = false, comp = false;
    int sgn = 0, ccw = -1;
    bool aVal = false;  // SK_VALS
    double val = 0;
  };
  struct Instantane {
    std::vector<P2> P;
    std::vector<double> R;
  };
  struct Cadre {
    P2 V;
    double sA, sB, delta, rA, rB;
  };
  struct Bilan {
    double residual = 0, score = 0;
  };
  struct Violation {
    const char* desc;
    double viol;
    std::string id;
  };
  struct Build {
    std::vector<int> pts, rad;
    std::vector<double> r0;
    std::vector<char> slide;
    int n = 0;
  };

  P2* pt(int i) { return i >= 0 ? &P_[i] : nullptr; }
  E* en(int i) { return i >= 0 ? &E_[i] : nullptr; }
  int indexPoint(const std::string& s) const;
  int indexEntite(const std::string& s) const;

  // Le modèle
  void ensureOrigin();
  void calculerStructure();  // ce qui ne dépend que des liens : fixes, rayons verrouillés, voisinages
  void skDimSides();
  void skProjFixRepair();
  void skFixSurProjRepair();
  void skGapToAngle();
  void symetriesSurDroites();
  void noterValeurs();  // skValsNote
  void premiereCoteEchelle(const D& d, double nv);  // skFirstDimScale
  bool lignesParalleles(const E& A, const E& B);
  std::vector<int> pidsEntite(const E& e) const;
  const P2* ptC(int i) const { return i >= 0 ? &P_[i] : nullptr; }
  const E* enC(int i) const { return i >= 0 ? &E_[i] : nullptr; }
  int boutPoignee(const E& e, int q) const;
  std::vector<int> pidsSpline(const E& e) const;
  const BSpline* courbe(const E& e) const;
  bool paramSpline(const E& e, int q, double& u) const;
  int pointTangente(const E& e, int q) const;
  bool courbureSpline(const E& e, int q, double& k, double& tx, double& ty) const;
  bool residuTangenceSpline(const C& c, double& r) const;
  void relacheTangenceSpline(const C& c);
  bool residuCourbure(const C& c, double& r) const;
  bool residuSurSpline(const C& c, double& r);
  void relacheSurSpline(const C& c);
  std::vector<char> composante(const E& l);  // skDragComp

  // Mesures
  bool angleVertex(const D& d, P2& V);
  bool angleFrame(const D& d, Cadre& fr);
  bool angleFrame(int a, int b, Cadre& fr);
  static double angleWant(const D& d, double delta);
  bool offsetVal(int a, int b, int sgn, double& v);
  bool dimSigne(const D& d, double& v);
  double lineLen(const E& l);
  Bilan audit(std::vector<Violation>* tout = nullptr);

  // Relaxation
  void scaleLine(E& l, double target);
  void scaleLineDist(E& l, double target);
  void scaleAxisPts(int pa, int pb, double val, int axis);
  void relax(int iters);

  // Moindres carrés
  Build sklsBuild();
  void sklsApply(const Build& B, const std::vector<double>& x);
  void collect(std::vector<double>& out, const Build& B);
  void lm(const Build& B, std::vector<double>& x, int iters);

  // Résolution
  Instantane snap() const;
  void restaure(const Instantane& s);
  void tangentExtend();
  void tangentSlide();
  void solveFinal();
  void solve1(int iters, const std::vector<int>* ancre = nullptr);
  void bonReprise(const std::vector<int>* ancre);
  void bonNote(int iters = 120);
  void ptsNote();
  void tanSideRec();

  std::string cleContrainte(const C& c) const;  // skConKey
  std::string raisonRefus_;
  bool coteConvertie_ = false;
  std::vector<std::string> idP_;
  int origine_ = -1;
  std::vector<P2> P_;
  std::vector<E> E_;
  std::vector<C> C_;
  std::vector<D> D_;
  std::vector<char> fix_;
  std::vector<char> fixA_;  // avec l'ancre du glisser en cours
  bool pourRang_ = false;
  std::vector<char> degen_;
  struct Rang {
    int rang = 0, n = 0;
    std::vector<char> determine;  // par inconnue
    Build B;
  };
  Rang analyseRang(int sauterCote, bool detail);
  struct Marche {
    bool actif = false;
    Instantane last;
    double r = 0, step = 0;
    P2 at;
    std::vector<std::pair<bool, P2>> vec;
  } marche_;
  std::vector<std::pair<bool, P2>> vecteursBranche() const;  // skBranchVecs
  double pasGlisser(const std::vector<int>& pids, double vueS) const;  // skDragStep
  template <class F>
  void marcher(P2 de, P2 vers, F placer, const std::vector<int>& ancre, const std::vector<int>& pids, double vueS);  // skDragWalkTo
  std::vector<int> tenus(std::vector<int> ancre) const;  // skDragHold
  int suivant_ = 0;

  // Mémoire entre résolutions (WeakMap du navigateur, jamais dans le fichier)
  bool aPts_ = false;
  std::vector<P2> memPts_;  // SK_PTS
  bool aBon_ = false, bonMauvais_ = false;
  Instantane bonSnap_;
  std::vector<std::pair<int, double>> bonVals_;
  bool aPat_ = false;
  std::string patSig_;
  std::vector<std::vector<int>> pat_;  // SK_JPAT
};
