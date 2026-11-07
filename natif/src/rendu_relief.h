// Reliefs et patine de l'atelier Rendu : traduction de 98-rendu-reliefs.js et 98-rendu-surface.js.
// Comme le lancer de rayons du navigateur (rtSurfMesh), pour les deux moteurs : textures périodiques
// calculées ici (teinte, rugosité, normales), posées par projection sur le plan dominant de chaque triangle.
// Une différence : usure et salissure ne passent pas par les sommets (le lancer de rayons d'OCCT ne les lit
// pas) mais par quelques niveaux de teinte, un matériau par niveau.
#pragma once

#include <memory>
#include <string>
#include <vector>

#include <Image_PixMap.hxx>
#include <Graphic3d_TextureSet.hxx>
#include <TopoDS_Shape.hxx>

// Le réglage d'une pièce, tel que dans le fichier (rel) : t type, e échelle en mm, d direction, p patine
struct ReliefChoisi {
  std::string t, d, p;
  double e = 0;
  bool vide() const { return t.empty() && d.empty() && p.empty() && !(e > 0); }
};

// relOf : le relief qui s'applique, celui de la pièce sinon celui de son matériau
struct ReliefEffectif {
  std::string t;
  double e = 1;
  char d = 'x';
};
bool reliefEffectif(const ReliefChoisi& r, const std::string& cleMatiere, ReliefEffectif& sortie);
std::string reliefDuMateriau(const std::string& cleMatiere);  // son type, vide s'il n'en a pas

struct Patine {
  double v = 0.5, w = 0, s = 0;  // variation de teinte et de rugosité, usure des arêtes, salissure des creux
};
Patine patineDe(const std::string& p);

struct Paillettes {
  double t = 0, i = 0;
};
bool paillettesDe(const std::string& cleMatiere, Paillettes& sortie);

// sfKit : les textures d'un sens de faces, mises en commun. Tuile commune en mm : uv = position / tuile
struct KitSurface {
  occ::handle<Image_PixMap> teinte, rugosite, normales;
  double tuile = 48, cMax = 1, rMax = 0;
  mutable occ::handle<Graphic3d_TextureSet> jeu;  // les cartes prêtes pour l'affichage, partagées
};
std::shared_ptr<const KitSurface> kitSurface(const ReliefEffectif* rel, const Paillettes* fl, double v, double rugo, bool bout);

// surfGeo : triangles du corps, recoupés le long des arêtes vives, avec (usure, salissure) par sommet
struct TriangleSurface {
  float p[3][3], n[3][3], usage[3][2];
};
std::vector<TriangleSurface> maillageSurface(const TopoDS_Shape& forme, bool usure);

// Les choix des listes de l'atelier
struct ChoixTexte {
  const char* cle;
  const wchar_t* nom;
};
const std::vector<ChoixTexte>& typesRelief();
const std::vector<ChoixTexte>& typesPatine();
