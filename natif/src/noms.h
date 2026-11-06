// Noms uniques des faces et des arêtes : traduction de src/20-05-noms.js.
// Une face reçoit un nom à sa naissance et le garde quand une opération la modifie ; une arête se nomme par les faces
// qu'elle sépare. Ce module observe : il ne change jamais un solide, et aucune de ses erreurs ne remonte.
#pragma once
#include <BRepTools_History.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>
#include <TopTools_IndexedDataMapOfShapeListOfShape.hxx>
#include <TopTools_ListOfShape.hxx>

#include <functional>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "conges.h"
#include "faces.h"

// Table d'un solide : le nom de chaque face par rang dans la carte des faces, et ancien nom → nom gardé
struct TableNoms {
  std::vector<std::string> f;  // vide : pas de nom
  std::map<std::string, std::string> a;
};
// Ce que le noyau sait dire d'une opération
struct HistoireNoms {
  std::function<TopTools_ListOfShape(const TopoDS_Shape&)> modifie;
  std::function<TopoDS_Shape(const TopoDS_Shape&)> modifieForme;  // dépouille seulement
};
template <class Api>
HistoireNoms histoireDe(Api& api) {
  HistoireNoms h;
  h.modifie = [&api](const TopoDS_Shape& x) { return api.Modified(x); };
  return h;
}
using CarteFaces = TopTools_IndexedDataMapOfShapeListOfShape;
using NaissanceNoms = std::function<void(const CarteFaces&, std::vector<std::string>&)>;
struct CoteNom {  // un côté d'un contour : son arête, l'entité d'esquisse dont il vient
  TopoDS_Shape e;
  std::string id;
};
struct InstantaneNoms {
  struct Ligne {
    std::string nom;
    DescSurf d;
    Vec3 c;
  };
  std::vector<Ligne> L;
  std::map<std::string, std::string> a;
};

bool nomsConnus(const TopoDS_Shape& s);
void nomsPartage(const TopoDS_Shape& src, const TopoDS_Shape& dst);  // dst : copie exacte de src
void nomsTransmet(const std::vector<TopoDS_Shape>& entrees, const HistoireNoms& api, const TopoDS_Shape& res, const NaissanceNoms& nais = nullptr);
void nomsNomme(const TopoDS_Shape& res, const NaissanceNoms& fn);
void nomsApresUnify(const Handle(BRepTools_History)& h, const TopoDS_Shape& s, const TopoDS_Shape& r);
void nomsPrefixe(const TopoDS_Shape& s, const std::string& pre);
// Vaut pour le prisme, la révolution et le balayage
void nomsPrismeFaces(const std::function<TopTools_ListOfShape(const TopoDS_Shape&)>& genere, const std::function<TopoDS_Shape()>& premiere, const std::function<TopoDS_Shape()>& derniere,
                     const TopoDS_Shape& res, const std::vector<CoteNom>& cotes);
void nomsApresConge(const std::function<TopTools_ListOfShape(const TopoDS_Shape&)>& genere, const HistoireNoms& api, const TopoDS_Shape& base, const TopoDS_Shape& s, bool chanfrein);
void nomsCompose(const std::vector<TopoDS_Shape>& parts, const TopoDS_Shape& res, const std::vector<std::string>& ids = {});
void nomsMemeRangs(const TopoDS_Shape& src, const TopoDS_Shape& dst);
std::optional<InstantaneNoms> nomsInstantane(const TopoDS_Shape& s);
void nomsCompleter(const TopoDS_Shape& res, const std::string& fid, const InstantaneNoms* snap);
void nomsFaceSurSurface(const TopoDS_Shape& res, const std::string& nom, const DescSurf& nd);
std::string nomsFaceDe(const TopoDS_Shape& shape, const TopoDS_Shape& face);
std::optional<TopoDS_Face> nomsRefFace(const TopoDS_Shape& shape, const std::string& nom, const Vec3* pos);
// Pose .nom sur la liste des arêtes, rend la table des anciens noms
std::map<std::string, std::string> nomsSurAretes(const TopoDS_Shape& shape, std::vector<AreteListee>& aretes);
int nomsTrouveArete(const std::vector<AreteListee>& aretes, const std::map<std::string, std::string>& alias, const std::string& nom, const Vec3* pos);
std::string nomsPos(const Vec3& p);
// Pertes de la fonction en cours de rejeu
std::vector<std::string> nomsPerteLue();
// Fin d'un rejeu : seules les tables des solides finaux restent en mémoire
void nomsFinDeRejeu(const std::vector<TopoDS_Shape>& finales);
