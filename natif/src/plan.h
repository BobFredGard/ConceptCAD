// La mise en plan (src/98-mep-*.js) : planches, vues projetées, cotes.
// Le dessin d'une planche est une liste d'éléments, les mêmes que ceux que le navigateur pose dans son SVG :
// c'est elle qu'on compare au navigateur, qu'on affiche et qu'on exporte.
#pragma once
#include <BRepAdaptor_Curve.hxx>
#include <TopoDS_Shape.hxx>

#include <array>
#include <functional>
#include <map>
#include <memory>
#include <nlohmann/json.hpp>
#include <string>
#include <utility>
#include <vector>

#include "projet.h"
#include "rejeu.h"

namespace plan {
using J = nlohmann::ordered_json;
using V3 = std::array<double, 3>;
using P2 = std::array<double, 2>;

// Un élément SVG : son nom, ses attributs dans l'ordre et son texte
struct Elt {
  std::string tag;
  std::vector<std::pair<std::string, std::string>> at;
  std::string txt;
  bool aide = false;  // calque d'aide (mepGHlp) : jamais exporté
  int niveau = 0;  // 1 : tspan du texte qui précède ; 2 : tspan de ce tspan
  const std::string* attr(const std::string& n) const {
    for (const auto& a : at)
      if (a.first == n) return &a.second;
    return nullptr;
  }
};

// Une entité projetée (e.t : L, C, A, P ; e.k : sharp, tangent, hidden, sect, thread, threadH, brk)
struct Ent {
  char t = 'L';
  double x1 = 0, y1 = 0, x2 = 0, y2 = 0, cx = 0, cy = 0, r = 0, a0 = 0, a1 = 0;
  std::string k;
  bool aW = false;
  double w = 0;
  std::vector<P2> pts;
};
using Boucle = std::vector<P2>;
struct Geo {
  std::vector<Ent> els;
  std::vector<Boucle> hatch;
  std::vector<std::vector<Boucle>> hatchG;  // une boucle de hachures par pièce
  std::string src;
};

// Les corps : ce que la pièce rejouée montre
struct Corps {
  std::string id;
  TopoDS_Shape forme;
  bool import = false;  // fait de pièces importées seules
  std::array<double, 3> taille{0, 0, 0};  // dimensions de sa boîte (nomenclature)
  unsigned couleur = 0x9a9aa0;
  double opacite = 1;
};
// Un perçage : ce que les axes et les cotes en lisent (holeNorm, holeAxis)
struct PointTrou {
  std::string id;
  V3 p{0, 0, 0};
};
struct Trou {
  std::string fid, corps, kind, end, pilot, taille, lenMode, repetition, tolAlesage;
  bool visible = true, modele = false, lh = false, aPasDifferent = false, aFiletIso = false, aPlan = false, aPlanFilet = false;
  double d = 0, stD = 0, stH = 0, cbD = 0, cbH = 0, csD = 0, csA = 0, depth = 0, pas = 0, longueurFilet = 0, lenFilet = 0, thD = 0, thD1 = 0, thC = 0;
  V3 dir{0, 0, 0}, planP{0, 0, 0}, planN{0, 0, 0}, planFiletP{0, 0, 0}, planFiletN{0, 0, 0};
  std::vector<PointTrou> pts;
};
// Un axe de révolution d'un solide (mepShapeRevs)
struct RevAxe {
  V3 o{0, 0, 0}, d{0, 0, 0};
  double t0 = 0, t1 = 0, r = 0, u = 0;
  std::vector<double> rs;
};
// Le filet cosmétique d'un perçage (mepThreadEls)
struct Filet {
  std::string corps, taille, lenMode;
  double D = 0, d = 0, depth = 0, entree = 0, len = 0;
  V3 dir{0, 0, 0};
  std::vector<V3> centres;
};
// L'hélice d'un filet, comme dans la vue 3D : pour l'image ombrée d'une vue
struct FiletImage {
  std::string corps;
  std::vector<V3> helice, anneau;
};
struct Piece {
  std::vector<Corps> corps;
  std::vector<FiletImage> helices;
  std::vector<Filet> filets;
  std::vector<Trou> trous;
  std::vector<std::pair<std::string, std::string>> nomsCorps;  // doc.bodies : id, nom
};
// doc : le fichier, pour ce que le modèle ne garde pas
Piece pieceDe(const Document& d, const ResultatRejeu& r, const J& doc);

// doc.mep : les planches, complétées comme à l'ouverture (mepEnsure, mepNormSheet)
void normaliser(J& mep);

// Ce qu'il faut pour l'image ombrée d'une vue (mepRender3dImage). Le cadre (l, t, r, b) est en mm modèle, repère de la vue.
struct DemandeImage {
  std::string cle;
  V3 u{1, 0, 0}, v{0, 0, -1}, dir{0, -1, 0};
  bool persp = false;
  V3 oeil{0, 0, 0}, vise{0, 0, 0};
  double fov = 35;
  double l = 0, t = 0, r = 0, b = 0;
  int W = 64, H = 64;
  struct Teinte {
    TopoDS_Shape forme;
    unsigned couleur = 0;
    double opacite = 1;
  };
  std::vector<Teinte> corps;
  std::vector<FiletImage> filets;
};
struct CadreImage {
  bool ok = false;
  double l = 0, t = 0, largeur = 0, hauteur = 0;
  std::string cle;
};

// Les vues calculées d'un document : refaites seulement si la vue change
class Calcul {
 public:
  void oublier() {
    images_.clear();
    cache_.clear();
    cylindres.clear();
    revolutions.clear();
  }
  const Geo& geoDe(const J& vue, const J& planche, const J& mep, const Piece& p);
  // L'image ombrée d'une vue, refaite seulement si la vue change ; sans fonction de rendu, pas d'image
  const CadreImage& imageDe(const J& vue, const Piece& p);
  std::function<void(const DemandeImage&)> rendreImage;
  std::map<std::string, std::vector<RevAxe>> cylindres, revolutions;

 private:
  std::map<std::string, std::pair<std::string, CadreImage>> images_;
  int compteurImages_ = 0;
  std::map<std::string, std::pair<std::string, std::shared_ptr<Geo>>> cache_;
};

// Le dessin de la planche courante, sans les aides de la souris (mepRenderCorps)
// Les points de cote suivent la géométrie : mep est mis à jour comme dans le navigateur.
std::vector<Elt> dessiner(J& mep, int planche, const Piece& p, Calcul& c);
// Taille de la feuille en mm
void tailleFeuille(const J& planche, double& w, double& h);
// Couleurs et épaisseurs réglées dans le fichier
struct Style {
  std::string papier = "white";
  double thick = .72, thin = .42, hid = .42, dim = .55, ext = 0, axis = 0;
  std::string couleurCotes;  // vide : l'accent du thème
};
Style styleDe(const J& mep);
// Tailles lues dans le style des cotes
struct TaillesCotes {
  double corpsCote = 4.888, corpsLbl = 6.983, fleche = 7, angleFleche = 36;
};
TaillesCotes taillesCotes(const J& mep);
// La largeur d'un texte en Arial, comme le navigateur la mesure
double largeurTexte(const std::string& s, double corps, bool gras = true);
// occCurvePts
std::vector<V3> pointsDeCourbe(const BRepAdaptor_Curve& ad, double u0, double u1, double tol, size_t cap);

// Vers le fichier SVG, comme l'export du navigateur (mepExportSvg)
std::string versSvg(const std::vector<Elt>& e, const J& planche, const Style& s);
}  // namespace plan
