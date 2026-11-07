// L'assemblage : traduction de src/46-assemblage-modele.js et 48-assemblage-accroches.js.
// Tout reste dans le bloc « asm » du fichier, tel que le navigateur l'écrit : ces fonctions le lisent et le modifient directement.
#pragma once
#include <TopoDS_Shape.hxx>

#include <array>
#include <functional>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "projet.h"
#include "rejeu.h"

namespace assemblage {
using J = nlohmann::ordered_json;
using V3 = std::array<double, 3>;
using Chemin = std::vector<std::string>;

struct Repere {
  V3 o{0, 0, 0}, x{1, 0, 0}, y{0, 1, 0}, z{0, 0, 1};
};
Repere repereDe(const J& j);
J jsonDe(const Repere& r);
V3 appliquer(const Repere& F, const V3& p);
V3 tourner(const Repere& F, const V3& v);
Repere composer(const Repere& A, const Repere& B);
Repere inverser(const Repere& F);
Repere arrondir(const Repere& F);  // asmRound

// Les faces d'accroche d'un composant (asmSnapExtract)
struct AreteAccroche {
  std::string k;  // line, circ, other
  V3 p0{}, p1{}, m{}, d{}, c{}, n{}, x{};
  double r = 0;
  bool complet = false;
};
struct FaceAccroche {
  std::string k;  // plane, cyl
  V3 n{}, c{}, l{}, x{}, y{};
  double r = 0, aire = 0, rect[4] = {0, 0, 0, 0}, t[2] = {0, 0};
  std::vector<AreteAccroche> aretes;
};
struct PointAccroche {
  std::string w, nom;
  Repere fr;
  bool aArete = false;
  std::string ek;
  V3 em{};
  double er = 0;
  bool aEr = false;
};
std::vector<FaceAccroche> extraireAccroches(const std::vector<TopoDS_Shape>& formes);
std::vector<PointAccroche> pointsDe(const FaceAccroche& F);  // asmSnapItems
std::string nomFace(const FaceAccroche& F);
J referenceAccroche(const FaceAccroche& F, const PointAccroche& p);  // asmSnapRef
const FaceAccroche* faceSous(const std::vector<FaceAccroche>& G, const V3& p, const V3* n);  // asmSnapHitFace

// Ce qui a été calculé pour un composant
struct SolideComposant {
  std::string empreinte;  // le document qui a donné ce solide
  std::string nom;
  TopoDS_Shape forme;
  std::vector<std::pair<std::string, TopoDS_Shape>> corps;
  std::vector<std::pair<TopoDS_Shape, unsigned>> teintes;       // corps visibles et leur couleur
  std::vector<std::pair<TopoDS_Shape, double>> transparences;   // leur transparence
  std::vector<SpiraleFilet> spirales;
  std::vector<std::string> messages;
  std::vector<ElementConstruction> construction;
  bool accrochesFaites = false;
  std::vector<FaceAccroche> accroches;
  bool aretesFaites = false;
  TopoDS_Shape vives, lisses;
  bool maille = false;
};
using Solides = std::map<std::string, std::shared_ptr<SolideComposant>>;
// bodyColorOf : la fiche du corps, sinon la teinte de la pièce, sinon la palette selon le rang
void poserTeintes(const Document& d, SolideComposant& s);
const std::vector<FaceAccroche>& accrochesDe(SolideComposant& s);

// ---- Lecture de l'arbre (a = le bloc asm) ----
J* composant(J& a, const std::string& id);
const J* composant(const J& a, const std::string& id);
J* occurrence(J& a, const std::string& id);
const J* occurrence(const J& a, const std::string& id);
J* porteur(J& a, const std::string& idOcc);
std::string racine(const J& a);
std::string actif(const J& a);
Chemin cheminActif(const J& a);
bool aDesEnfants(const J& a);  // asmOn
struct Instance {
  Chemin chemin;
  std::string comp;
  Repere F;
  int profondeur = 0;
};
std::vector<Instance> instances(const J& a, const std::string& depuis);  // asmInstances
bool repereChemin(const J& a, const std::string& cid, const Chemin& chemin, Repere& F, std::string& fin);  // asmPathFrame
bool monde(const J& a, const Chemin& chemin, Repere& F);  // asmWorld
std::string compDuChemin(const J& a, const Chemin& chemin);  // asmPathComp, "" si rompu
bool cheminMasque(const J& a, const Chemin& chemin);
Chemin premierChemin(const J& a, const std::string& cid);  // asmFirstPath
bool contient(const J& a, const std::string& gros, const std::string& petit);  // asmContains
void apparenceDe(const J& a, const Chemin& chemin, double& op, double& gl, std::string& aretes);  // asmLookOf (-1 : pas de réglage)
std::vector<std::string> dofs(const J& align);
const char* nomLiaison(const std::string& type);

// ---- Calcul ----
// Remplit les solides manquants : le composant actif vient du rejeu qu'on vient de faire, les autres sont rejoués s'ils ont changé.
void majSolides(Solides& S, Document& haut, const ResultatRejeu& rActif);
// asmResolve : place toutes les occurrences liées. Rend true si l'une a bougé ; asmResolve remet aussi à jour les points d'accroche.
bool resoudre(J& a, Solides& S);
// asmJointTarget : le repère de la liaison côté cible, dans le repère du porteur
bool cibleLiaison(J& a, Solides& S, const std::string& porteur, J& align, Repere& T);
// Bascule le composant actif dans le JSON du haut du fichier (asmActivate)
void activer(J& haut, const std::string& cid, const Chemin& chemin);

// ---- Modifications (asmNewComp, asmAddOcc, asmDeleteOcc…) ----
// Crée le bloc asm autour du document s'il n'existe pas encore (asmEnsure)
J& assurer(J& haut);
std::string nouvelIdentifiant(const char* prefixe);
J nouvelleOccurrenceObjet(const std::string& cid, const std::string& nom, const Repere& fr);
std::string nomOccurrence(const J& a, const std::string& cid);  // asmOccName
void supprimerOccurrence(J& a, const std::string& id);          // asmDeleteOcc, sans le changement de composant actif
J alignementTelQueConstruit(const J& occ, const std::string& type, const std::string& axe);  // asmAsBuilt
void renommerComposant(J& a, const std::string& idOcc, const std::string& nom);              // asmRename
}  // namespace assemblage

// La pièce d'un composant, à partir du document rangé dans l'arbre
Document documentDeComposant(const nlohmann::ordered_json& doc, const Document& modele);
