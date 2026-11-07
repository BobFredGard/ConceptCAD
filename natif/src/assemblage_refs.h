// Les références entre composants (src/46-assemblage-modele.js, 79-construction-interface.js).
// Un élément de construction ou une esquisse d'un composant s'appuie sur un autre : ils suivent quand celui-ci bouge ou change.
#pragma once
#include <map>
#include <string>
#include <vector>

#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>

#include "assemblage.h"
#include "conges.h"

namespace assemblage {

// asmSkCaptureFaces : une face plane ou de révolution d'un composant, dans SON repère
struct FaceCapturee {
  J ref;
  std::string nom;
  bool plan = false;
  V3 o{}, n{};   // plan
  V3 ao{}, ad{};  // axe
  double rad = -1;  // cylindre seulement
};
// Faux si la face n'est ni plane, ni un cylindre, ni un cône
bool capturerFace(const TopoDS_Shape& forme, const TopoDS_Face& f, FaceCapturee& out);
J localisationFace(const FaceCapturee& f);

// Pendant le rejeu d'un composant qui n'est pas l'actif : l'assemblage et ses solides, et qui l'on rejoue
class PoseRefs {
 public:
  PoseRefs(const J& a, Solides& S, const std::string& cid);
  ~PoseRefs();
};

// asmXfEval, asmXeEval : la face ou l'arête visée, et le passage de son repère à celui du composant en cours. Rend faux si elle n'existe plus.
bool faceExterne(const Document& d, J& ref, FaceCapturee& F, Repere& passage);
bool areteExterne(const Document& d, J& ref, AreteListee& E, Repere& passage);
// asmExtFrame
bool repereExterne(const Document& d, const J& ext, Repere& F);
// asmSkExtEdges : les arêtes de l'instance visée, dans le repère du composant en cours
bool aretesExternes(const Document& d, const J& x, std::vector<AreteListee>& L, std::map<std::string, std::string>& alias);

// cgExtCandidates : les éléments des autres instances qu'on peut viser ; valeur : { ctx, path, cg, o, frozen }
struct CandidatExterne {
  J valeur;
  std::string titre;
};
std::vector<CandidatExterne> candidatsExternes(const J& a, const std::string& kind);

// asmSkExtLists : chaque instance visible hors composant actif, pour l'outil Projeter et les clics
struct ListeExterne {
  J ext;  // { ctx, path }
  Chemin chemin;
  std::string nom;
  std::string comp;
  Repere passage;
  std::vector<AreteListee> aretes;
};
std::vector<ListeExterne> listesExternes(const J& a, Solides& S);

// asmExtStale, par signature : ce que voient les références d'un composant. Vide s'il n'en a aucune.
std::string signatureDocument(const J& a, Solides& S, const std::string& cid, const J& doc);
std::string signatureActif(const Document& haut, Solides& S);
bool aDesReferences(const J& a);
// Rejoue les composants non actifs dont une référence a bougé. Rend vrai si l'un l'a été (asmExtSync).
bool majReferences(Solides& S, Document& haut);
bool suivreExternesActif(Document& d);
// L'essai : ce que chaque composant montre aux autres
nlohmann::json bilanReferences(const J& a, Solides& S);
}  // namespace assemblage
