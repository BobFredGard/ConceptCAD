// Fenêtre principale : l'environnement du navigateur autour de la vue 3D et de l'écran d'esquisse.
#pragma once
#include <map>
#include <memory>
#include <nlohmann/json.hpp>
#include "fenetre_parametres.h"
#include <wx/wx.h>
#include <wx/propgrid/propgrid.h>
#include <wx/treectrl.h>

#include <cstdio>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "assemblage.h"
#include "conges.h"
#include "coter.h"
#include "dessin.h"
#include "environnement.h"
#include "esquisse2d.h"
#include "infos_esquisse.h"
#include "interface_esquisse.h"
#include "rejeu.h"
#include "vue3d.h"

// Même suite de modifications que la version navigateur (natif/mesures/banc.cjs)
struct Protocole {
  bool actif = false;
  int total = 120, i = 0, fonction = -1;
  double base = 0, pas = 0.05;
  FILE* journal = nullptr;
  std::wstring signal;
};

// Une face retenue : sa référence durable (ce qui s'écrit dans le fichier) et, si elle est retrouvée, la face elle-même
struct Retenue {
  nlohmann::ordered_json ref;
  TopoDS_Face forme;
  std::string corps;
};
// Le mode de choix des faces (mvMode, draftMode, coqueMode, splitMode)
struct ChoixFaces {
  enum { DEPLACER, DEPOUILLE, COQUE, SUPPRESSION, SCINDER };
  int sorte = DEPLACER;
  std::string edition, marqueAvant, corps;
  std::vector<Retenue> faces;
  Retenue reference;
  bool phaseRef = false, tangent = true, flip = false, piocherPlan = false;
  double dist = 5, angle = 5, epaisseur = 2, decalage = 0;
  std::string mode = "face";
  nlohmann::ordered_json plan;
  // La face d'un congé : on règle sa taille
  std::string blendFonction, blendNom, blendCorps;
  std::vector<int> blendIdx;
  double blendRayon = 0;
  bool blendChanfrein = false;
  TopoDS_Face blendForme;
  // L'aperçu : recalculé seulement si le réglage a changé
  std::string signature;
  TopoDS_Shape apercu;
  wxString alerte;
};

#include "plan.h"

struct ChampFiche;
struct LienArbre;
namespace normalises { struct Piece; }
class FenetreNormalises;
class PlanVue;
class MoteurFao;
class VueDom;
class Cadre : public wxFrame {
 public:
  Cadre();
  ~Cadre() override;
  bool ouvrir(const std::wstring& chemin);
  bool lancerProtocole(const std::wstring& fichier, const std::wstring& journal, int total);

 private:
  // Toutes les esquisses, car celles qui suivent le solide bougent aussi ; et les fonctions si ce pas les a touchées
  struct ModifCote {
    std::vector<Esquisse> esquissesAvant, esquissesApres;
    bool creation = false;  // ce pas a ajouté une esquisse à la pièce
    bool avecFonctions = false;
    std::vector<Fonction> fonctionsAvant, fonctionsApres;
    bool avecFormules = false;
    std::vector<Parametre> paramsAvant, paramsApres;
    std::vector<PorteurFx> porteursAvant, porteursApres;
    std::shared_ptr<Document> docAvant, docApres;  // un changement de structure : le document entier
    bool planSeul = false;  // seule la mise en plan change : rien à recalculer
  };
  // parAfterChange : la modification, ses conséquences, le recalcul, une annulation. Rend le message de refus, vide si accepté.
  std::string changerFormules(const std::function<std::string()>& f);
  std::string reglerCoteListe(size_t esquisse, const std::string& idCote, const std::string& texte);
  ActionsFormules actionsFormules();
  void basculerMiniParametres();
  bool nomCotePourSaisie(const std::string& id, wxString& nom);
  void etat(const wxString& texte);
  void creerMenus();
  void creerEnvironnement();
  void placerScene();
  void changerAtelier(Atelier a);
  void renduEssai(const plan::J& e);
  void montrerAtelier();
  void indisponible(const wxString& nom);
  void boutonRuban(Atelier a, const wxString& nom);
  void menuEsquisse();
  void remplirFil();
  void menuGrille();
  void ajusterDroite();
  void remplirArbre();
  void editerConge(int i);
  std::string editionConge_, marqueAvantEdition_;
  void annulerDejaEnregistre();
  // Les deux recherches : cadre_recherche.cpp
  struct CommandeCherchee {
    wxString libelle, aide;
    std::function<void()> fn;
  };
  std::vector<CommandeCherchee> commandesCherchees();
  void rechercheInit();
  void filtrerArbre(const wxTreeItemId& racine);
  void cmdDessiner();
  void cmdFermer();
  void cmdLancer(int i);
  wxTextCtrl* rechercheArbre_ = nullptr;
  wxString filtreArbre_;
  std::vector<CommandeCherchee> resultatsCmd_;
  class wxPopupWindow* popCmd_ = nullptr;
  class wxListBox* listeCmd_ = nullptr;
  bool cmdClavier_ = false;
  void montrerRien();
  void montrerManques();
  void montrerFonction(int i);
  void montrerEsquisse(int i);
  void montrerForme(const TopoDS_Shape& s);
public:
  void entrerEsquisse(int i);
  void capturerEsquisses(const std::wstring& dossier);
  void demarrerVide() { nouveau(); }
  bool essaiEsquisse(const std::wstring& fichier, int rang, const std::wstring& sortie, const std::wstring& json, const std::wstring& dossier);
  void imageVue3D(const wxString& chemin);
  bool essaiGestesConge(const std::wstring& fichier, const std::wstring& sortie, const std::wstring& json, const std::wstring& dossier);
 private:
  void quitterEsquisse();
  void abandonnerEsquisse();  // Abandonner : l'esquisse revient à ce qu'elle était à son ouverture
  void modeEsquisse(bool oui);
  TopoDS_Shape formeAnterieure(int i);
  void rafraichirEsquisse(bool calculer);  // barre, panneau, bandeau et couleurs de la vue
  void messageBandeau(const wxString& m);
  void creerEsquisse(const std::string& plan);  // XY, XZ, YZ, ou vide pour la face choisie
  void brancherDessin();
  void faireSuivre();  // ce qui a été dessiné : les esquisses qui s'appuient sur le solide suivent, puis le solide
  double recalculer();
  void extruder();
  void entrerConge(bool chanfrein);
  void quitterConge();
  void cliqueConge(const TopoDS_Shape& s);
  void rafraichirConge();
  void appliquerChoixConge();
  bool proprieteConge(const wxString& nom, const wxVariant& valeur);
  // Le choix des faces (cadre_faces.cpp)
  void entrerFaces(int sorte, const std::string& edition = "");
  void quitterFaces();
  void quitterFacesSansCalcul();
  void cliqueFaces(const TopoDS_Shape& s);
  void rafraichirFaces();
  void reglerFaces(const std::string& cle, const std::string& valeur);
  void appliquerChoixFaces();
  bool supprimerFacesChoisies();
  void cliqueFacePres(const Vec3& p);
  bool chercherTaille(const TopoDS_Face& face, const std::string& corps);
  void planScission(Vec3& o, Vec3& n) const;
  bool normaleOk(const TopoDS_Face& f) const;
  std::string corpsDeForme(const TopoDS_Shape& s) const;
  TopoDS_Shape solideDuCorps(const std::string& id) const;
  static bool fonctionDeFaces(const Fonction& f);
  static int sorteDeFaces(const Fonction& f);
  bool enChoix() const { return choix_ || faces_; }
  std::unique_ptr<ChoixFaces> faces_;
  bool memoFacesTangentes_ = true;
  std::map<std::string, std::vector<std::string>> facesListes_;
  BoutonEsquisse* boutonOkChoix_ = nullptr;
  void capturerFenetre(const std::wstring& png);
  void modifierFonction(int i, const std::function<void(Fonction&)>& reglage);
  // Les menus contextuels (src/90-20-menus-contextuels.js)
  void changerStructure(const std::function<void(nlohmann::ordered_json&)>& changement, const wxString& message = wxString());
  void apresStructure();
  void poserDocument(const std::shared_ptr<Document>& d);
  // La mise en plan change : le fichier la reçoit, la pièce n'est pas recalculée
  void changerPlan(const nlohmann::ordered_json& mep);
  void reprendrePlan(const std::shared_ptr<Document>& d);
  int choisirMenu(wxMenu& m);
  wxString demanderNom(const wxString& actuel);
  bool confirmerSuppression(const wxString& question);
  void menuFonction(int i);
  void menuEsquisseArbre(int i);
  // Plans, axes, points, repères (79-construction-interface)
  void menuConstruction(const std::string& id);
  void montrerConstruction(const std::string& id);
  void choisirConstruction(const std::string& id);
  void creerConstructionRuban(const std::string& kind);
  void creerEsquisseConstruction(const std::string& id, const std::string& sous);
  void reglerConstruction(const std::string& id, const std::string& cle, const std::string& valeur);
  void piocherReference(const std::string& id, int rang);
  nlohmann::ordered_json referenceCliquee(const TopoDS_Shape& s, const std::string& type);
  void creerSurCylindre(bool clavette);
  void piocherCylindre(const std::string& fonction, const std::string& cle, const std::string& valeur);
  void dessinerConstruction();
  void poserChamps(const std::vector<ChampFiche>& champs, bool copie);
  std::string constructionMontree_;
  std::string refAttendue_;  // l'élément dont on attend une référence (clic dans la vue ou l'arbre)
  int rangAttendu_ = -1;
  std::map<std::string, wxTreeItemId> lignesConstruction_;
  void menuCorps(const std::string& id, bool vue3d = false);
  void surDroit3D(const TopoDS_Shape& sous);
  void surArbreMenu(wxTreeEvent& e);
  std::function<bool(const TopoDS_Shape&)> pioche_;  // le prochain clic dans la vue lui revient ; false : encore un
  void demanderClicFiche(const std::string& id, const std::string& cle, const std::string& valeur);
  void creerPercageVise();
  void creerFiletageVise(const std::string& idExistant = "");
  int esquisseDeLArbre();
  void montrerFiche(int i);
  void appliquerFiche(const std::string& id, const std::string& cle, const std::string& valeur);
  std::string esquisseVisee(bool profilFerme);
  void creerFonction(const std::function<std::string(nlohmann::ordered_json&)>& f, const wxString& message);
  std::string ficheId_;  // la fonction montrée dans le panneau
  std::map<std::string, std::vector<std::string>> ficheChoix_;  // cle → valeurs de la liste montrée
  void nouveauCorps();
  void importer();
  bool importerFichier(const std::wstring& chemin);
  void exporter(const std::string& format, const std::string& corps = "");
  bool ecrireExport(const std::string& format, const std::vector<TopoDS_Shape>& formes, const std::wstring& chemin, const std::string& schema, bool sansCourbes);
  std::string schemaStep_ = "AP214";  // stepSchema : le dernier choix
  bool stepSansCourbes2D_ = false;
  int indiceMarque() const;
  void marquerTemps(const std::string& id);
  void bougerMarqueur(int bouton);
  std::string marqueTemps_;  // tlMark : la première fonction exclue du rejeu ; jamais enregistré
  bool essaiSansBoite_ = false;
  std::string essaiChoix_, essaiNom_;  // l'essai automatique répond à la place de la souris
  bool essaiMenu_ = false;
  std::vector<std::string> messagesMontres_;  // les mêmes messages ne reviennent pas à chaque recalcul
  std::vector<std::string> essaiEntrees_;
  void choisirFonction(int i);
  void poserPas(const std::vector<Esquisse>& esquisses, bool avecFonctions, const std::vector<Fonction>& fonctions);
  bool demandeCote(const Cote& c, wxString& texte);
  void saisieCote(const std::string& id, const wxString& texte);
  void poserEsquisses(const std::vector<Esquisse>& v);
  void annuler();
  void retablir();
  void surOuvrir(wxCommandEvent&);
  void nouveau();
  void menuRecents();
  void retenirRecent(const std::wstring& chemin);
  void apresOuverture();
  void surFermer(wxCloseEvent&);
  bool enregistrer();
  bool enregistrerSous();
  bool ecrire(const std::wstring& cible);
  bool peutAbandonner();
  void majTitre();
  void surArbre(wxTreeEvent&);
  void surArbreActive(wxTreeEvent&);
  void surPropriete(wxPropertyGridEvent&);
  void pasProtocole(wxTimerEvent&);

  // L'assemblage (cadre_assemblage.cpp)
  struct RepereCandidat {
    nlohmann::ordered_json rel;
    std::string nom;
    assemblage::Repere F;
  };
  struct AlignEnCours {
    std::string occ;
    std::shared_ptr<nlohmann::ordered_json> avant;
    int etape = 0;  // 0 : le repère à poser ; 1 : la cible
    nlohmann::ordered_json src, dst;
    bool flip = false;
    double rz = 0, off[3] = {0, 0, 0};
    std::vector<std::string> cles;  // ce que veut dire chaque marque de la vue
    bool aFace = false;
    int coteFace = 0;
    assemblage::FaceAccroche face;
    std::vector<assemblage::PointAccroche> points;
    std::string nomFace;
    assemblage::Chemin cheminAbs, cheminRel;
  };
  bool asmOn() const;
  void asmApresRejeu(const ResultatRejeu& r, bool ajuster);
  void asmDessiner();
  void asmMontrerChoix();
  std::vector<std::string> asmLot() const;
  void asmAller(const assemblage::Chemin& chemin, const std::string& mode, const std::string& choisie = "");
  void asmBasculer();
  void asmRemonter();
  void changerAssemblage(const std::function<void(nlohmann::ordered_json&)>& f, const wxString& message = wxString());
  void asmCliqueOcc(const std::string& id, bool ctrl, bool maj);
  bool asmEchap();
  void asmNouveauComposant();
  void asmNouvelleOccurrence();
  void asmSupprimer(const std::vector<std::string>& ids);
  void asmLotChaque(const std::function<void(nlohmann::ordered_json&)>& f);
  void asmInserer();
  bool asmInsererFichier(const std::wstring& chemin);
  void remplirPiece(const wxTreeItemId& parent);
  void remplirComposants(const wxTreeItemId& parent);
  std::string nomRel(const std::string& cid, const nlohmann::ordered_json& r, bool normal) const;
  bool asmSurArbre(const LienArbre* l);
  bool asmSurArbreActive(const LienArbre* l);
  bool asmSurArbreMenu(const LienArbre* l);
  void asmMenuOccurrence(const assemblage::Chemin& chemin, const std::string& id, bool direct);
  void poserBoutonsPanneau(const std::vector<std::pair<wxString, std::function<void()>>>& L);
  void montrerAssemblage();
  void asmFiche(const std::string& cle, const std::string& valeur);
  void asmMenuTelleQueConstruite(const std::string& id);
  void asmAnimer(const std::string& id);
  void asmPasAnimation();
  void asmGizmo();
  void asmGeste(int phase, const std::string& sorte, int axe, const std::string& degre, double valeur, bool libre);
  std::vector<RepereCandidat> asmReperesSous(const std::string& cid, const std::string& saufOcc);
  void asmAlignDebut(const std::string& id);
  void asmAlignRafraichir();
  void asmAlignMarques();
  void asmPanneauAligner(std::vector<ChampFiche>& ch, std::vector<std::pair<wxString, std::function<void()>>>& B);
  bool asmAlignFiche(const std::string& cle, const std::string& valeur);
  void asmAlignPose(int cote, const nlohmann::ordered_json& rel);
  void asmAlignChoisirPoint(int i);
  void asmAlignClicMarque(int i);
  void asmAlignClicFace(const assemblage::Chemin& chemin, const gp_Pnt& pointActif, bool plan, const assemblage::V3& normaleLocale);
  void asmAlignValider();
  void asmAlignAnnuler(bool dessiner);
  struct PatEnCours {
    std::string owner, pat;
    std::shared_ptr<nlohmann::ordered_json> avant;
  };
  std::unique_ptr<PatEnCours> asmPatEd_;
  nlohmann::ordered_json* asmPatCourant();
  void asmRepetition();
  void asmPatDebut(const std::string& owner, const std::string& pat, std::shared_ptr<nlohmann::ordered_json> avant);
  void asmPatValider();
  void asmPatAnnuler(bool dessiner);
  void asmPatSupprimer(const std::string& owner, const std::string& pat);
  void asmPatRafraichir();
  bool asmPatFiche(const std::string& cle, const std::string& valeur);
  void asmPanneauRepetition(std::vector<ChampFiche>& ch, std::vector<std::pair<wxString, std::function<void()>>>& B);
  struct CorpsExact {
    std::string id, nom;
    TopoDS_Shape forme;
  };
  std::vector<CorpsExact> asmCorpsExacts(const std::string& cid) const;
  std::vector<assemblage::Instance> asmInstancesVisibles() const;
  std::vector<TopoDS_Shape> asmFormesStep(std::string& nom, std::vector<std::string>& manquants) const;
  struct Inspection {
    struct Item {
      std::string comp, nom, matiere;
      double rho = 0, v = 0, masse = 0;
      assemblage::V3 c{};
    };
    struct Inter {
      std::string a, b;
      double v = 0;
      TopoDS_Shape forme;
    };
    std::vector<Item> items;
    std::vector<Inter> inter;
    double volume = 0, masse = 0;
    assemblage::V3 com{};
  };
  std::unique_ptr<Inspection> asmInspect_;
  void asmInspecter();
  void asmInspectFermer();
  void asmPanneauInspection(std::vector<ChampFiche>& ch, std::vector<std::pair<wxString, std::function<void()>>>& B);
  // Les composants liés à un fichier (cadre_liens.cpp)
  struct EtatLien {
    bool alerte = false;
    std::string message;
    long long date = 0, taille = -1;
    std::string sigVue;
  };
  std::map<std::string, EtatLien> asmLiensEtat_;
  std::map<std::string, EtatLien> derEtat_;  // l'état des dérivées, jamais dans le fichier
  bool derOccupe_ = false;
  void derCommande();
  std::string derInserer(const std::wstring& chemin, const std::vector<std::string>& params, const std::vector<std::string>& corps, bool tous);
  std::vector<std::string> derVerifier(bool demander);
  void derRelier(const std::string& idLien, std::wstring chemin = std::wstring());
  void derRompre(const std::string& idLien);
  void derMenu(wxWindow* ou);
  void derFiche(const nlohmann::ordered_json& f, std::vector<ChampFiche>& champs, std::vector<std::pair<wxString, std::function<void()>>>& boutons);
  std::map<std::string, std::string> asmLiensBase_;
  bool asmLiensOccupe_ = false, asmLiensNeufs_ = false;
  nlohmann::ordered_json asmDocComplet() const;
  std::vector<std::string> asmLies() const;  // asmLinked
  bool asmLienSale(const std::string& cid);  // asmLinkDirty
  void asmLiensRefBase(const std::vector<std::string>& L);  // asmLinkRebase
  std::wstring asmLienChemin(const nlohmann::ordered_json& link, std::string& pourquoi) const;
  nlohmann::ordered_json asmLienRef(const std::wstring& chemin) const;
  std::string asmLienTexte(const nlohmann::ordered_json& haut, const std::string& cid, const std::string& cur) const;
  void asmAjouterSources(const nlohmann::ordered_json& racineFichier);
  void asmLiensVerifier(bool demander);
  void asmLienRelier(const std::string& cid, std::wstring chemin = L"");
  void asmLienRompre(const std::string& cid);
  bool asmLienInserer(const std::wstring& chemin);
  void asmLienExtraire(const std::string& cid, std::wstring chemin = L"");
  void asmLienRemplacer(const std::string& cid, std::wstring chemin = L"");
  void asmLiensEcrire();
  void asmLiensFenetreActive();
  void asmLiensEssai(const nlohmann::json& e, nlohmann::json& n);
  void asmLiensMesure(nlohmann::json& n);
  double asmDroiteDeTout() const;
  void asmDepuisCorps(std::vector<std::string> ids);
  void asmDeplacerVers(bool corps, const std::string& id);
  bool asmEtapeEssai(const nlohmann::json& e, nlohmann::json& n);
  // La mesure à la souris (cadre_mesure.cpp)
  struct MesureCoup {
    TopoDS_Shape s, corps;
    gp_Trsf t;
    gp_Pnt p;
    mesure::GeoFace g;
    std::string nom;
    int rang = 0;
    bool propre = false;
  };
  std::optional<MesureCoup> mesA_;
  std::vector<mesure::GeoArete> mesAretes_;
  mesure::Dessin mesDessin_;
  void mesureCoup(const Vue3D::CoupVue* c, bool ctrl, bool maj);
  void mesureEffacer(bool discret);
  MesureCoup mesureLire(const Vue3D::CoupVue& c) const;
  std::string mesureLibelleFace(const MesureCoup& m) const;
  std::string mesureOrigine(const TopoDS_Shape& corps, const std::vector<TopoDS_Shape>& faces) const;
  bool mesureEtapeEssai(const nlohmann::json& e, nlohmann::json& n);
  // Les composants normalisés (cadre_normalises.cpp)
  friend class FenetreNormalises;
  void asmNormalises(const std::string& cat = "");
  void asmNormModifier(const std::string& occ);
  bool asmNormInserer(const normalises::Piece& sp, wxString& msg);
  wxString asmNormRemplacer(const std::string& occ, const normalises::Piece& sp, bool toutes);
  void asmNormPoseDebut(const normalises::Piece& sp, const std::string& pinAt, const std::string& keyAt);
  void asmNormPoseAnnuler();
  bool asmNormRayon(const gp_Pnt& origine, const gp_Dir& direction);
  bool asmNormEtapeEssai(const nlohmann::json& e, nlohmann::json& n);
  FenetreNormalises* asmNormFen_ = nullptr;
  std::shared_ptr<normalises::Piece> asmNormPose_;
  std::string asmNormPinAt_, asmNormKeyAt_;
  void asmMesureEssai(nlohmann::json& n);
  assemblage::Solides asmSolides_;
  std::string asmMode_ = "part", asmSel_, asmAncre_;
  std::vector<std::string> asmLot_;
  std::map<std::string, wxTreeItemId> lignesOcc_;
  bool asmSansEvenement_ = false;
  std::unique_ptr<AlignEnCours> asmAlign_;
  std::shared_ptr<nlohmann::ordered_json> asmGesteAvant_;
  bool asmGesteBouge_ = false;
  wxTimer asmAnim_;
  std::string asmAnimOcc_, asmAnimK_;
  double asmAnimDir_ = 1;
  nlohmann::ordered_json asmImports_;
  wxBoxSizer* rangAsm_ = nullptr;
  int hauteurBoutonsAsm_ = 0;
  std::vector<std::pair<wxString, std::function<void()>>> boutonsAsm_;

  wxTreeCtrl* arbre_ = nullptr;
  wxPropertyGrid* props_ = nullptr;
  wxPanel* centre_ = nullptr;
  wxPanel* scene_ = nullptr;
  BarreHaute* barreHaute_ = nullptr;
  Ruban* ruban_ = nullptr;
  Carte* carteArbre_ = nullptr;
  Carte* carteFao_ = nullptr;
  // L'atelier FAO (cadre_fao.cpp)
  std::string faoTexteCourant();
  void faoEntrer();
  void faoQuitterVue();
  void faoMessage(const wxString& m);
  void faoRafraichir();
  void faoAppliquer(const plan::J& r);
  void faoToucher(long el, const std::string& sorte, const plan::J& valeur, bool ctrl, bool maj);
  void faoAction(const std::string& nom, const std::string& type);
  void faoEvenement(const plan::J& e);
  void faoFenetreOutils(const plan::J& d);
  void faoTraces(const std::string& rapides);
  void faoScene();
  void faoTouche(const std::string& cle, bool ctrl, bool maj);
  bool faoClic(const Vue3D::ClicFao& c);
  void faoFaireSuivre();
  wxPanel* barreSim_ = nullptr;
  VueDom* barreSimDom_ = nullptr;
  wxStaticText* tempsSim_ = nullptr;
  wxTimer minuteurSim_;
  wxLongLong simDernier_ = 0;
  bool simActif_ = false, simJoue_ = false, simEnAttente_ = false, simManuel_ = false;
  double simVox_ = 0;
  std::string simBarre_;
  void faoTrame(double dt);
  void faoOuvrirEsquisse(const std::string& id, const plan::J& sk);
  void faoFermerEsquisse();
  std::string faoEsqId_, faoEsqTexte_;
  int faoEsqRang_ = -1;
  void faoAppliquerTrame(const plan::J& r);
  void faoSimFin();
  void faoEssai(const plan::J& e);
  std::unique_ptr<MoteurFao> moteurFao_;
  VueDom* arbreFao_ = nullptr;
  VueDom* ficheFao_ = nullptr;
  VueDom* outilsFao_ = nullptr;
  wxFrame* fenetreOutilsFao_ = nullptr;
  bool faoOuvert_ = false, faoSale_ = false;
  int faoEnCours_ = 0, faoAbsentes_ = 0, faoMasquees_ = 0, faoSurvolDessine_ = -1;
  wxLongLong faoDernierSurvol_ = 0;
  std::string faoTexteOuvert_, faoSigTraces_;
  std::wstring faoSortieEssai_;
  Carte* carteDroite_ = nullptr;
  wxBoxSizer* colonneDroite_ = nullptr;
  int hauteurDroite_ = 0;
  bool noteMontree_ = false;
  wxStaticText* noteDroite_ = nullptr;
  BoutonEsquisse* boutonRendu_ = nullptr;
  BoutonEsquisse* repliArbre_ = nullptr;
  std::vector<BoutonEsquisse*> onglets_, boutonsVue_;
  EtatVue* etatVue_ = nullptr;
  FilFonctions* fil_ = nullptr;
  PageAtelier* page_ = nullptr;
  PlanVue* planVue_ = nullptr;
  class PanneauPlan* panneauPlan_ = nullptr;
  class AtelierRendu* atelierRendu_ = nullptr;
  class PanneauRendu* panneauRendu_ = nullptr;
  Atelier avantRendu_ = Atelier::CAO;
  std::vector<struct PieceRendu> renduPieces(const plan::J& racine);
  // Le Rendu direct et la fiche ⚙
  class FicheVue* ficheVue_ = nullptr;
  OptionsVue optionsVue_;
  bool envModifie_ = false;
  void majVueEnv(bool apparences = true);
  void ambianceVue();
  void lireEnvVue();
  void memoriserVue();
  void ecrireEnvVue();
  void basculerFicheVue();
  plan::J renduDocCourant(plan::J& racine);
  void montrerRendu(bool ouverture);
  void changerRendu(const plan::J& rendu);
  void changerRenduOccurrence(const std::string occ, const std::string bid, const plan::J* e, bool tous);
  ResultatRejeu dernierRejeu_;  // ce que voit la mise en plan
  void montrerPlan();
  Atelier atelier_ = Atelier::CAO;
  bool arbreReplie_ = false;
  Vue3D* vue_ = nullptr;
  VueEsquisse* vueEsquisse_ = nullptr;
  BarreEsquisse* barreEsquisse_ = nullptr;
  PanneauEsquisse* panneauEsquisse_ = nullptr;
  BandeauEsquisse* bandeauEsquisse_ = nullptr;
  InfosEsquisse infosEsquisse_;
  bool infosPerimees_ = false;
  wxString messageEsquisse_;  // le dernier message d'un outil ; il cède la place au prochain changement
  bool messageNeuf_ = false;
  std::string signaturePanneau_;
  std::vector<Esquisse> esquissesEntree_;  // ce qu'on retrouve en abandonnant
  size_t annulationsEntree_ = 0;
  bool enModeEsquisse_ = false;
  wxSizerItem* margeColonne_ = nullptr;
  wxSizerItem* margePanneau_ = nullptr;
  int esquisseOuverte_ = -1;
  std::unique_ptr<Edition> edition_;
  std::unique_ptr<Dessin> dessin_;  // déclaré après edition_ : il s'en sert et disparaît avant lui
  bool dessinModifie_ = false;      // des esquisses suivantes et le solide restent à mettre à jour
  std::string figee_;  // pourquoi l'esquisse ouverte ne peut pas changer
  TopoDS_Shape forme_;  // le solide affiché, pour le fantôme des esquisses
  std::vector<std::pair<std::string, TopoDS_Shape>> formesCorps_;  // le solide de chaque corps
  std::unique_ptr<ChoixConge> choix_;  // pendant le choix des arêtes d'un congé ou d'un chanfrein
  wxString messageConge_;
  wxBoxSizer* rangConge_ = nullptr;
  // filMemo : retenus le temps de la session
  double memoConge_ = 10, memoChanfrein_ = 1;
  OptChanfrein memoCham_;
  bool memoTangentes_ = true;
  TopoDS_Face faceChoisie_;  // dernière face cliquée sur le solide affiché
  wxTimer minuterie_;
  Document doc_;
  bool docOuvert_ = false, ajusterVue_ = true, solideCalculable_ = false;
  int fonctionMontree_ = -1;
  double msRejeu_ = 0, msMaillage_ = 0;
  std::vector<ModifCote> annulations_, retablissements_;
  MiniParametres* miniParams_ = nullptr;
  wxBoxSizer* colonneFx_ = nullptr;
  wxString saisieDepart_;  // le texte proposé à l'ouverture de la saisie : le laisser tel quel ne change rien
  std::vector<wxTreeItemId> lignesFonctions_, lignesEsquisses_;  // la ligne de l'arbre de chaque fonction, de chaque esquisse
  Protocole proto_;
};
