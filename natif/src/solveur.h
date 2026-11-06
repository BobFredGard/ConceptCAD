// Solveur d'esquisse : traduction ligne à ligne de src/50-esquisse-2-modele-solveur.js et de l'audit de
// src/50-esquisse-5-panneau-audit.js. Sans fenêtre ni noyau. BancSolveur le compare, avec les références de
// mesures/solveur-reference.cjs, au solveur du navigateur : toute modification ici doit y rester juste.
// Seule différence voulue : pas de budget de 400 ms, le calcul s'arrête après un nombre de pas, comme le banc.
#pragma once
#include <string>
#include <vector>

#include "projet.h"

class Solveur {
 public:
  // Reprend l'état de l'esquisse et applique ce que font le chargement et l'ouverture dans le navigateur.
  explicit Solveur(const Esquisse& s);

  // Faux pour ce que la traduction ne couvre pas encore (splines) : l'esquisse reste alors en lecture seule.
  bool prisEnCharge() const { return raisonRefus_.empty(); }
  const std::string& raisonRefus() const { return raisonRefus_; }
  // Une ancienne cote d'entraxe a été changée en angle à l'ouverture : le fichier ne saurait pas encore le dire
  bool coteConvertie() const { return coteConvertie_; }

  void resoudre();  // solveSketch
  double residu();  // skResid : le plus grand écart, en mm
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
  bool saisir(const std::string& id, double valeur, std::string* raison = nullptr);
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

  // Pour le banc
  const std::vector<std::string>& idsPoints() const { return idP_; }
  void etat(std::vector<double>& pts, std::vector<double>& rayons) const;
  void deplacerProjections(double dx, double dy);
  // Les arêtes projetées ont bougé dans l'esquisse : on reprend ses points sans perdre la mémoire du solveur,
  // qui dit de quel côté restait chaque élément libre.
  void reprendrePoints(const Esquisse& s);

 private:
  void refuser(const Saisie& s);  // restaurer, comme skRevertTo
  struct P2 { double x = 0, y = 0; };
  enum TypeE { LIGNE, ARC, CERCLE, CPOINT, AUTRE };
  struct E {
    std::string id;
    TypeE t = AUTRE;
    int p1 = -1, p2 = -1, pc = -1, pa = -1, pb = -1, p = -1;
    double r = 0;
    bool proj = false, ref = false, ext = false, construction = false, verrouille = false, conduit = false;
    std::vector<int> poly;
  };
  enum TypeC { H, V, COINCIDENT, ONCIRCLE, ONLINE, MIDPOINT, PARALLEL, PERPENDICULAR, COLLINEAR, EQUAL, OFFSET, TANGENT, TANGENT2, COAXIAL, SYMMETRIC, FIX, INCONNU };
  struct C {
    std::string id;
    TypeC type = INCONNU;
    int p = -1, line = -1, ent = -1, a = -1, b = -1, mid = -1, c = -1, d = -1;
    bool aP = false, aA = false, aB = false, inf = false;
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
  void solve1(int iters);
  void bonReprise();
  void bonNote();
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
