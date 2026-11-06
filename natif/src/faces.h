// Fonctions de la pièce qui travaillent sur un solide déjà construit : retrouver une face, la déplacer, la supprimer,
// scinder, mettre à l'échelle, déplacer un corps, balayer. Traduction de src/20-30-faces.js, src/20-40-scission-depouille.js,
// src/75-balayage.js, src/85-deplacer-corps.js et src/85-echelle-corps.js.
#pragma once
#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>
#include <TopoDS_Wire.hxx>

#include <optional>
#include <string>
#include <vector>

#include "contours.h"
#include "projet.h"

struct DescSurf {  // occSurfDesc
  char k = '?';    // p plan, c cylindre, o cône
  Vec3 n{}, p{}, a{}, X{}, Y{}, apex{};
  double r = 0, semi = 0, u0 = 0, u1 = 0, v0 = 0, v1 = 0;
  bool direct = true;
};
DescSurf descSurf(const TopoDS_Face& f);
bool memeSurface(const DescSurf& a, const DescSurf& b);  // occSameSurf

void boiteFace(const TopoDS_Face& f, Vec3& pos, Vec3& dim);  // occFaceBox
std::optional<TopoDS_Face> trouverFace(const Document& d, const TopoDS_Shape& solide, const RefFace& ref);  // occFindFace : le nom, puis la géométrie

TopoDS_Shape appliquerDeplacementFace(const Document& d, const Fonction& f, const TopoDS_Shape& solide, std::vector<std::string>& msgs);  // occApplyMoveFace
TopoDS_Shape appliquerSuppressionFaces(const Document& d, const Fonction& f, const TopoDS_Shape& solide, std::vector<std::string>& msgs);  // occApplyDeleteFaces
// côtéPos : le côté qui va dans le corps neuf. Rend une forme nulle s'il n'y a rien de ce côté.
TopoDS_Shape appliquerScission(const Document& d, const Fonction& f, const TopoDS_Shape& solide, bool cotePos, std::vector<std::string>& msgs);  // occApplySplit
TopoDS_Shape appliquerDeplacementCorps(const Fonction& f, const TopoDS_Shape& solide, std::vector<std::string>& msgs);  // occApplyBodyMove
TopoDS_Shape appliquerEchelle(const Fonction& f, const TopoDS_Shape& solide, std::vector<std::string>& msgs);  // occApplyBodyScale
TopoDS_Shape formeBalayage(const Document& d, const Fonction& f, std::vector<std::string>& alertes);  // occShapeOfSweep
TopoDS_Shape sansMiettes(const TopoDS_Shape& s);  // occSansMiettes
TopoDS_Shape communFormes(const TopoDS_Shape& a, const TopoDS_Shape& b);  // occCommon

// Donnés par rejeu.cpp
TopoDS_Shape unifierForme(const TopoDS_Shape& s);
TopoDS_Shape fusionFormes(const TopoDS_Shape& a, const TopoDS_Shape& b);
TopoDS_Shape coupeFormes(const TopoDS_Shape& a, const TopoDS_Shape& b);
std::optional<gp_Dir> normaleDeFace(const TopoDS_Face& f);
struct CoteNom;
TopoDS_Wire contourEsquisse(const Esquisse& s, const Trace& tr, const Chaine& chaine, std::vector<CoteNom>* cotes = nullptr);
gp_Pnt pointMonde(const Esquisse& s, double x, double y);
