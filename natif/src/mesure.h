// La mesure à la souris (90-10-selection-mesure.js) : plans et cylindres exacts, entraxes, angles,
// distances entre arêtes. Aucun dessin ici : le calcul rend ce qu'il faut tracer et le texte à afficher.
#pragma once
#include <string>
#include <vector>

#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>
#include <gp_Dir.hxx>
#include <gp_Pnt.hxx>
#include <gp_Trsf.hxx>
#include <gp_Vec.hxx>

namespace mesure {

struct GeoFace {  // occFaceGeom
  enum Sorte { Aucune, Plan, Cylindre } sorte = Aucune;
  gp_Pnt p;      // point du plan, ou centre de l'axe
  gp_Vec n;      // normale du plan, ou direction de l'axe
  double r = 0;
};

struct GeoArete {  // edgeGeomOf
  enum Sorte { Droite, Cercle, Courbe } sorte = Courbe;
  gp_Pnt a, b, centre;
  gp_Vec u, axe;
  double r = 0;
  bool ferme = false;
  std::vector<gp_Pnt> pts;
};

struct Cote {  // dimPair
  gp_Pnt a, b;
  std::string texte;
};
struct Etiquette {  // tagAt
  std::string texte;
  gp_Pnt p;
};
struct Axe {  // drawAxis : centre, direction ; la longueur dépend de la vue
  gp_Pnt c;
  gp_Vec a;
};
struct Dessin {
  std::vector<Cote> cotes;
  std::vector<Etiquette> etiquettes;
  std::vector<Axe> axes;
  std::vector<std::vector<gp_Pnt>> aretes;  // les arêtes retenues, en orange
  std::vector<TopoDS_Shape> faces;          // les faces retenues, en orange
  bool vide() const { return cotes.empty() && etiquettes.empty() && axes.empty() && aretes.empty() && faces.empty(); }
};

GeoFace geoFace(const TopoDS_Face& f, const gp_Trsf& t = gp_Trsf());
// occListEdges : 11 points également répartis sur le paramètre de l'arête
std::vector<gp_Pnt> pointsArete(const TopoDS_Edge& e, const gp_Trsf& t = gp_Trsf());
GeoArete geoArete(const std::vector<gp_Pnt>& pts);

// « DROITE · longueur 12.00 mm », « CERCLE · Ø8.00 (R4.00) », « COURBE »
std::string decrireArete(const GeoArete& g);
// measurePair : vrai si les deux faces ont donné une mesure exacte
bool mesurerFaces(const GeoFace& A, const gp_Pnt& pA, const GeoFace& B, const gp_Pnt& pB, Dessin& d, std::string& texte);
// La suite de edgeSelect, pour une deuxième arête
std::string mesurerAretes(const GeoArete& A, const GeoArete& B, Dessin& d);
// shiftMeasure, pour une face cylindrique
std::string mesurerCylindre(const GeoFace& g, const gp_Pnt& p, Dessin& d);

}  // namespace mesure
