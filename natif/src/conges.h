// Congés et chanfreins exacts : traduction de occApplyXFillets (src/20-60), occFilletRun et occSingleEdgeTool (src/20-20),
// xAnchorFor et xAnchorMatch (src/20-60), xTangentChainOf (src/80).
// Pas encore repris : les chanfreins à deux distances ou à angle, le texte « paroi mince » d'occWallAt.
#pragma once
#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>

#include <set>
#include <string>
#include <utility>
#include <vector>

#include "projet.h"

struct AreteListee {  // une ligne d'occListEdges
  Vec3 mid{0, 0, 0};
  std::vector<Vec3> pts;
  double len = 0;
  int src = 0;  // rang dans l'explorateur des arêtes
  std::string nom;  // nomsSurAretes
};
std::vector<AreteListee> listerAretes(const TopoDS_Shape& s);
// cgFindEdge : l'arête visée par une référence de construction { pos, len, nom, anchor }, -1 si elle n'existe plus
int chercherAreteParReference(const Document& d, nlohmann::ordered_json& ref, const std::vector<AreteListee>& aretes, const std::map<std::string, std::string>& alias);
// Chaîne tangente d'une arête, elle comprise
std::vector<int> chaineTangente(const std::vector<AreteListee>& liste, int depart);
// L'étendue d'une extrusion le long de la normale de son esquisse (extrudeSpan), donnée par rejeu.cpp
struct Etendue {
  double lo = 0, hi = 0;
};
std::vector<Etendue> etenduesEsquisse(const Document& d, const std::string& esquisse);
// xAnchorFor : l'ancre d'esquisse d'un point du solide. Rend false s'il n'y en a pas.
bool ancrePour(const Document& d, const Vec3& m, AncreArete& out);
// occApplyXFillets pour une fonction : rend le solide obtenu, ou base si rien n'a pu être fait. Les messages disent pourquoi.
TopoDS_Shape appliquerConge(const Document& d, Fonction& f, const TopoDS_Shape& base, std::vector<std::string>& messages);
// Identifiant neuf d'une fonction (uid), donné par rejeu.cpp
std::string idFonction(const Document& d, const char* prefixe);

// occSharpEdges : les arêtes de la pièce telles qu'on les voit, vives (noires) ou tangentes (grises), sans les coutures
struct AreteVue {
  Vec3 mid{0, 0, 0};
  double len = 0;
  bool vive = false;
  TopoDS_Edge arete;
};
std::vector<AreteVue> aretesVisibles(const TopoDS_Shape& s);

struct SelConge {
  Vec3 pos{0, 0, 0};
  double r = 0, len = 0;
  AncreArete ancre;
};
struct ApercuConge {
  TopoDS_Shape forme;  // vide : pas d'aperçu
  std::vector<TopoDS_Face> nouvelles;  // les faces nées du congé, en orange
  std::string message;  // pourquoi il n'y a pas d'aperçu
};
// Ce que la personne a choisi pendant le mode Congé ou Chanfrein, sans fenêtre : filModeX du navigateur
class ChoixConge {
 public:
  ChoixConge(const Document& d, const TopoDS_Shape& base, bool chanfrein, double rayon, bool tangent);
  bool chanfrein() const { return chanfrein_; }
  bool tangent() const { return tangent_; }
  double rayon() const { return rayon_; }
  std::string libelle() const;
  const std::vector<AreteVue>& vives() const { return vives_; }
  const std::vector<AreteVue>& lisses() const { return tangentes_; }
  const std::vector<int>& germes() const { return germes_; }
  const std::vector<SelConge>& selection() const { return sel_; }
  void basculer(int i);
  // Un clic sur une arête ou une face de la pièce (exactToggle) : rend le message à montrer
  std::string cliquer(const TopoDS_Shape& s);
  void rayonDefaut(double r);
  void rayonArete(size_t i, double r);
  void tangentes(bool oui);
  const ApercuConge& apercu();
  // corps : le solide de chaque corps ; le compteur des noms d'arêtes du document avance
  Fonction creer(Document& d, const std::vector<std::pair<std::string, TopoDS_Shape>>& corps) const;

 private:
  void synchroniser();
  const Document& doc_;
  TopoDS_Shape base_;
  bool chanfrein_ = false;
  double rayon_ = 10;
  bool tangent_ = true;
  std::vector<AreteVue> vives_, tangentes_;
  std::vector<int> germes_;
  std::vector<SelConge> sel_;
  std::set<std::string> clesBase_;
  std::string signature_;
  ApercuConge apercu_;
};
