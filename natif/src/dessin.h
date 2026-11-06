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
#include "spline.h"

class Dessin {
 public:
  enum Outil { SELECTION, LIGNE, RECTANGLE, CERCLE, ARC, COTE, AJUSTER, DECALER, OBLONG, POLYGONE, POINT_C, PERCAGE, CONGE, CHANFREIN, COINCIDENT, SPLINE, CSPLINE, PROJETER };  // les boutons connus d'abord : leurs numéros servent aux essais
  struct Accroche {
    enum Sorte { AUCUNE, POINT, MILIEU, SUR_LIGNE, SUR_CERCLE, SUR_SPLINE } sorte = AUCUNE;
    std::string id;  // le point, la ligne ou le cercle visé
    double x = 0, y = 0;
    explicit operator bool() const { return sorte != AUCUNE; }
  };
  // Le tracé en cours, pour l'écran
  struct Brouillon {
    enum Sorte { RIEN, B_LIGNE, B_RECT, B_CERCLE, B_ARC, B_OBLONG, B_POLYGONE, B_SPLINE } sorte = RIEN;
    double x1 = 0, y1 = 0, x2 = 0, y2 = 0;  // ligne et rectangle
    double cx = 0, cy = 0, r = 0, a1 = 0, a2 = 0;  // cercle et arc ; polygone : a1 est son orientation
    int n = 0;                                     // polygone
    Accroche accroche;
    // Spline en cours : les clics, le curseur, la courbe vivante
    std::vector<Pt> clics;
    std::vector<P2d> courbe;
    bool ctrl = false, aCurseur = false, fermeture = false;
    Pt curseur;
  };
  // Réglages du polygone (skPoly), gardés d'un polygone au suivant, même d'une esquisse à l'autre
  struct ReglagesPolygone {
    int n = 6;
    double d = 0;  // Ø intérieur ; 0 : à la souris
    double ang = 1.5707963267948966;
    bool aDernier = false;  // la souris a bougé depuis le centre
    Pt dernier;
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
    enum Sorte { ENTITE, POINT, COTE, CONTRAINTE } sorte = ENTITE;
    std::string id;
    bool operator==(const Choix& o) const { return sorte == o.sorte && id == o.id; }
  };

  // Outil Projeter : une arête 3D du solide, 11 points et son milieu ; ce qu'on projetterait sous la souris
  struct Arete3D {
    Vec3 mid{0, 0, 0};
    std::vector<Vec3> pts;
  };
  struct Projetable {
    enum Sorte { RIEN, LIGNE, CERCLE, ARC, COURBE, UN_POINT } sorte = RIEN;
    double x1 = 0, y1 = 0, x2 = 0, y2 = 0, cx = 0, cy = 0, r = 0;
    std::vector<P2d> pts;
    bool closed = false, aMid = false;
    int m = 0;
    Vec3 mid{0, 0, 0};
    std::string skSk, skPt, skEnt, srcNom;  // vient d'une autre esquisse
    explicit operator bool() const { return sorte != RIEN; }
  };
  struct SourceProjection {
    std::vector<Projetable> formes;
    std::vector<P2d> pts;
  };
  std::function<const std::vector<Arete3D>*()> aretes3D;   // nul ou rien : pas de solide
  const std::vector<Esquisse>* esquisses = nullptr;        // les autres esquisses du document
  int* nomsProj = nullptr;                                 // entNames.proj, entNames.edge
  int* nomsArete = nullptr;
  const Projetable& survolProjection() const { return survolProj_; }
  std::vector<SourceProjection> sourcesProjection() const;  // skpItems : le tracé bleu de l'outil

  Dessin(Esquisse& s, Edition& ed);

  void vue(double pixelsParMm);  // skUpdateTols
  bool grille = true;            // case « Grille 1 mm » du navigateur, cochée par défaut
  std::function<void()> avantModif;                     // skPushUndo : l'état est encore celui d'avant
  std::function<void()> annulerPas;                     // le dernier avantModif est sans objet : la modification est refusée
  std::function<void(const std::string&)> surMessage;   // skStatus

  Outil outil() const { return outil_; }
  void choisirOutil(Outil o);  // skCancelDraft, puis l'outil
  // ligneCote : la cote dont la ligne est sous la souris (la vue le sait, elle l'a dessinée)
  void enfonce(double x, double y, bool ctrl, const std::string& ligneCote = "");
  // Prendre une cote par sa valeur : glisser la déplace, sans toucher à la géométrie
  void prendreCote(const std::string& id, double wx, double wy);
  struct Boite {
    bool actif = false, ajoute = false;
    double x0 = 0, y0 = 0, x1 = 0, y1 = 0;
  };
  const Boite& boite() const { return boite_; }  // la fenêtre de sélection en cours
  void bouge(double x, double y, bool gaucheTenu = true);
  void relache(double x, double y);
  // Rend la cote à ouvrir en saisie, s'il y en a une
  std::string doubleClic(double x, double y);
  void echap();     // skEscapeToSelect
  void annulerTrace();  // skCancelDraft
  bool finirSpline();   // la fin d'un tracé de spline (clic droit, Entrée) ; rend false s'il n'y en avait pas
  bool peigneVisible(const std::string& id) const { return peignes_.count(id) > 0; }
  void supprimer();  // deleteSkSel
  // applyCon : h, v, equal, tangent, coaxial, parallel, perpendicular, collinear, symmetric, fix, midpoint, coincident, construction
  void poserContrainte(const std::string& type);
  void toucheF1();  // skShortcut : points fusionnés, ou point posé sur une courbe
  void toucheF2();  // H ou V selon l'inclinaison de chaque ligne
  void choisirCote(const std::string& id);
  // Le panneau de droite (renderSkPanel) : le clic sur une ligne remplace le choix principal et garde les éléments ajoutés au Ctrl
  void choisirLigneCote(const std::string& id);
  void choisirContrainte(const std::string& id);
  void retirerContrainte(const std::string& id);   // la croix de la liste ; une projection garde son « fixe »
  void retirerCote(const std::string& id);         // la croix de la liste
  bool basculerReference(const std::string& id);   // skDimToggleRef
  void reglerPoint(const std::string& id, double x, double y);  // les champs du cadre Sélection
  void reglerRayon(const std::string& id, double r);
  void reglerAngleArc(const std::string& id, bool fin, double degres);
  void refermerEcart();       // skCloseGap
  void fusionnerDoublons();   // Santé : points quasi dupliqués
  void supprimerDegeneres();  // Santé : éléments réduits à rien
  // Cote de référence ouverte en saisie : elle redevient pilotante si elle n'est plus en trop (editDim). Rend false sinon.
  bool rendrePilotante(const std::string& id);

  // Outil Ajuster : le morceau qui partirait si on cliquait ici. Rien n'est modifié.
  struct ApercuCoupe {
    enum Sorte { RIEN, TRAIT, ROND } sorte = RIEN;
    Pt A, B;                  // trait
    Pt C;                     // rond : centre, rayon, de a1 à a2 dans le sens trigonométrique
    double r = 0, a1 = 0, a2 = 0;
  };
  ApercuCoupe calculerApercu(double wx, double wy) const;
  const ApercuCoupe& apercu() const { return apercu_; }

  const Brouillon& brouillon() const { return brouillon_; }
  const Guide& guide() const { return guide_; }
  bool aMarque() const { return aMarque_; }
  Pt marque() const { return marque_; }
  const std::vector<Choix>& selection() const { return selection_; }
  bool estChoisi(Choix::Sorte s, const std::string& id) const;
  bool enCours() const { return bas_.actif || arcC_.size() || glisseP_.size() || glisseE_.actif || dyn_.actif || !dimPose_.empty() || !dimPoint_.empty() || !dimLigne_.empty() || offArme_ || !coinA_.empty() || glisseC_.actif || boite_.actif || !coinPt_.empty() || splActif_; }
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

  // Le bandeau de réglages du polygone (skPolyRead)
  static const ReglagesPolygone& reglagesPolygone() { return poly_; }
  void lirePolygone(int n, const std::string& diametre);

  // Le menu du clic droit (showSkCtx). Une entrée sans code n'est qu'un texte ; une entrée indisponible est montrée grisée.
  struct EntreeMenu {
    std::string libelle, code, icone;
    bool disponible = true;
  };
  bool aSelection() const { return selection_.size() > 1 || (selection_.size() == 1 && selection_[0].sorte != Choix::CONTRAINTE); }
  std::vector<EntreeMenu> menuContextuel(std::string& titre) const;
  void actionMenu(const std::string& code);
  // Le menu vise cette cote : clic droit sur une étiquette
  void annulerPoseCote() { annulerTrace(); message("Placement annulé."); }
  static double distanceAuto() { return offsetD_; }
  static void reglagesParDefaut() { poly_ = ReglagesPolygone{}; offsetD_ = 5; }  // pour le banc : la session suivante repart du même état

  // Pour les essais
  void premiere();
  void couperSansResoudre(double wx, double wy);  // la coupe seule, pour contrôler l'aperçu avant que le solveur ne déplace tout

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
  const Entite* entiteProche(double x, double y, double maxD, bool sansConstruction = false) const;  // nearestEntity
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
  struct GlisseCote {
    bool actif = false, etiquette = false, pousse = false;
    std::string id;
    double x0 = 0, y0 = 0, ox0 = 0, oy0 = 0, w0 = 0, sl0 = 0, gx = 0, gy = 0;
  };
  GlisseCote glisseC_;
  Boite boite_;
  std::string coinPt_;  // outil Coïncident : le premier point
  bool sansTete_ = false;  // skSel vide : tous les éléments choisis sont des ajouts (skSelX)
  void prendreLigneCote(const std::string& id, double wx, double wy);
  void bougerCoteSaisie(double wx, double wy);
  std::vector<Choix> dansBoite(const Boite& b) const;  // skBoxHits
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

  // Ajuster
  void clicAjuster(double wx, double wy);
  std::string ajusterElement(const std::string& id, double cx, double cy);  // trimEntity
  std::vector<Pt> croisements(const Entite& e) const;                        // entHits
  std::string pointCoupe(const std::string& soi, double x, double y);       // splitOtherAt
  void scinderLigne(const std::string& ligne, const std::string& pid);      // splitLineAt
  void recopierLiens(const std::string& ancienne, const std::vector<std::string>& neuves, bool retirer);  // cloneLineConstraints
  bool piedDans(const Contrainte& c, const std::string& ligne) const;       // tangentFootSegs
  void majCotesLigne(const std::string& ligne);                             // syncLineDims

  // Décaler
  void clicDecaler(double wx, double wy);
  std::vector<std::string> choixDecalables() const;
  bool decalerElements(const std::vector<std::string>& ids, double D, const Pt* S, std::string& msg);  // skOffsetApply ; S nul : côté automatique
  bool offArme_ = false;  // skOffArm : le prochain clic donne le côté
  void appliquerDecalage(const std::vector<std::string>& ids, double D, double wx, double wy);
  bool distanceTapee(double& D);  // la distance en cours de frappe ; si elle est invalide, le dit et l'oublie
  void validerDistance();
  Pt curseurDecalage_;

  // Ajuster en glissant : tout ce qui est traversé part, en une seule annulation
  void glisserAjuster(double wx, double wy);
  ApercuCoupe apercu_;
  bool coupeGlisse_ = false, coupePoussee_ = false, coupeFaite_ = false;
  int coupesGlissees_ = 0;
  Pt coupePrec_, coupeDerniere_;

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
  void creerOblong(double ax, double ay, double bx, double by, bool centre, const std::string& cPid);
  void poserPointSeul(double wx, double wy, bool percage);
  bool viserPolygone(double wx, double wy, bool& bouge, double& r);  // skPolyAim
  void brouillonPolygone(double r, double ang);                      // skPolyDraft
  void bougerPolygone(double wx, double wy);                         // skPolyMove
  void relacherPolygone(double wx, double wy);                       // skPolyUp
  void finirPolygone(double r, double ang);                          // skPolyFinish
  void creerPolygone(const std::string& pc, int n, double r, double ang);  // skPolyCreate
  bool entreePolygone();                                             // skPolyEnter
  // Congé et chanfrein d'esquisse
  void clicCoin(double wx, double wy, bool conge);    // la branche fillet/chamfer de pointerdown
  void congeSelection();                              // skApplyFilletSel
  void chanfreinSelection();                          // skApplyChamferSel
  bool coinCommun(const std::string& a, const std::string& b, std::string& pid, std::string& msg) const;  // skSharedCorner
  void garderCoinVirtuel(const std::string& pid, const std::string& a, const std::string& b);             // skKeepVirtualSharp
  void garderCotesHorsTout(const std::vector<std::string>& ids);                                          // skKeepOverallDims
  bool congeCoin(const std::string& a, const std::string& b, double r, std::string& nouveau, std::string& msg);     // skFilletCorner
  bool chanfreinCoin(const std::string& a, const std::string& b, double d, std::string& nouveau, std::string& msg);  // skChamferCorner
  bool lierCoin(bool conge, const std::string& nouveau);  // skCornerLink
  double longueurLigne(const std::string& id) const;
  std::string coinA_, passeCoin_;  // skCornA ; skFilletSess : le premier coin de la passe
  bool passeConge_ = false, coinOutilConge_ = false;
  static constexpr double filletR_ = 5, chamferD_ = 5;  // skFilletR, skChamferD
  static inline ReglagesPolygone poly_;
  static inline double offsetD_ = 5;  // skOffsetD : la distance « auto » du menu
  void reinitTexteCote(const std::string& id);  // skDimResetText
  void basculerAxe(const std::string& ligne);   // skToggleAxis
  void coteAngleMenu(const Entite& A, const Entite& B);  // createAngleDim
  void relacherCercle(double wx, double wy);
  void enfonceArc(double wx, double wy);

  // Spline (src/50-esquisse-6-spline.js)
  struct ClicSpline {
    double x = 0, y = 0;
    std::string pid;  // le point existant visé
  };
  std::vector<ClicSpline> spl_;
  bool splActif_ = false;
  std::set<std::string> peignes_;  // skComb : les peignes affichés, jamais enregistrés
  std::vector<std::string> pidsSpline(const Entite& e) const;  // skSplineAllPids
  const Entite* lignePoignee(const Entite& S, const std::string& pid) const;  // skSplineHandleLine
  bool paramSpline(const Entite& e, const std::string& pid, double& u) const;  // skSplineParam
  std::string pointTangente(const Entite& e, const std::string& pid) const;   // skSplineTanPid
  bool tangenteSpline(const Entite& e, const std::string& pid, double& x, double& y) const;  // skSplineTangent
  bool versLInterieur(const Entite& ent, const std::string& pid, double& x, double& y) const;  // skCurveIntoDir
  std::string ajouterPoignee(const std::string& S, const std::string& pid);  // skSplineAddHandle ; la ligne, vide si impossible
  void retirerPoignee(const std::string& S, const std::string& pid);         // skSplineRemoveHandle
  std::string tangenteVers(const std::string& S, const std::string& O, const std::string& pid);  // skSplineTangentTo ; un message si refusée
  std::string courbureVers(const std::string& S, const std::string& O, const std::string& pid);  // skSplineCurvTo
  std::string jointSpline(const Entite& S, const Entite& O) const;   // skSplineJoint
  int tangentesAuto(const std::string& S);                           // skSplineAutoTangent
  std::string validerSpline(const std::vector<ClicSpline>& d, bool ferme, bool ctrl);  // skSplineCommit ; l'identifiant, vide si rien
  void finirTraceSpline(bool ferme);                                 // skSplFinish
  void clicSpline(double wx, double wy);                             // skSplClick
  void bougerSpline(double wx, double wy);                           // skSplMove
  Projetable areteProjetable(double x, double y) const;              // projectEdgeAt
  Projetable sourceSous(double x, double y) const;                   // skpHit
  std::string creerProjection(const Projetable& pr);                 // skProjectCreate
  std::string creerDepuisEsquisse(const Projetable& pr);             // skpCreer
  std::string nomEntite(bool arete);                                 // entName
  void nommer(Entite& e, const Projetable& pr);                      // projNames
  void clicProjeter(double wx, double wy);
  void bougerProjeter(double wx, double wy);
  Projetable survolProj_;
  std::vector<P2d> apercuSpline(const std::vector<ClicSpline>& d, const Pt* cur, bool ferme, bool ctrl) const;  // skSplineDraftPoly
  bool attacherSpline(const std::string& pid, double x, double y, double tol);  // skSplineAttach
  void nettoyerSplines();                                            // skSplineCleanup
  std::vector<Pt> croiseSpline(const Entite& e, const Entite& o, std::vector<double>* us = nullptr) const;  // skSplineHits
  std::string pointCoupeTol(double x, double y);                     // pidAtTol
  Entite splineDepuis(const Entite& src, const BSpline& bs, const std::string& pa, const std::string& pb);  // skSplineFromBs
  std::string ajusterSpline(const std::string& id, double cx, double cy);    // skSplineTrim
  std::string decalerSpline(const std::string& id, double D, int cote, bool& fait, bool& rebroussement);  // skSplineOffset
  std::vector<std::string> splinesChoisies() const;
  double distanceSplines(const std::vector<std::string>& ids, double wx, double wy) const;

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
