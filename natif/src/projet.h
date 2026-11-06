// Lecture d'un projet .conceptcad (JSON, gzip possible) : même format que la version navigateur.
#pragma once
#include <array>
#include <string>
#include <unordered_map>
#include <vector>

struct Pt { double x = 0, y = 0; };
using Vec3 = std::array<double, 3>;

struct Entite {
  std::string id, t, p1, p2, pc, pa, pb;
  std::string p;  // point porté par un « cpoint »
  double r = 0;
  bool construction = false, ref = false, axe = false, poignee = false, proj = false, percage = false;
  bool ext = false;  // tenue par une source extérieure à l'esquisse (intersection, perçage...)
  std::vector<std::string> poly;  // sommets d'un polygone : ils suivent son diamètre
  bool aSrcMid = false;  // milieu 3D de l'arête source d'une projection : c'est par lui qu'on la retrouve
  Vec3 srcMid{0, 0, 0};
  bool suiviInconnu = false;  // projection qui suit autre chose qu'une arête retrouvée par position (nom, intersection, autre esquisse)
};

// Contrainte et cote d'esquisse : mêmes champs que le fichier (src/50-esquisse-2, 50-esquisse-4).
struct Contrainte {
  std::string id, type, p, line, ent, a, b, mid, c, d;
  bool inf = false;
  int sa = 0, sb = 0;
};
struct Cote {
  std::string id, type, line, ent, a, b, p, orient, nom;
  std::string oa, ob;  // cote d'angle en pose : les deux lignes d'origine (skDimAngleAt)
  double value = 0, ox = 0, oy = 0, w = 0, sl = 0;
  bool aW = false, ref = false, dia = false, formule = false, formuleFausse = false, comp = false;
  bool chk = false;  // déjà contrôlée (skCheckNewDims)
  int refV = 0;      // 2 : référence posée automatiquement
  int ccw = -1;  // -1 : absent du fichier
  int sgn = 0;   // côté mémorisé d'un entraxe, 0 : absent
};

struct Hote {
  bool existe = false;
  std::string feat, tag = "TOP", edge;
  double x = 0, y = 0, h = 0;
  bool aH = false;
  std::string nom;  // nom de la face, écrit seulement quand l'esquisse est créée ici
};

struct Esquisse {
  std::string id, nom, plan;
  std::string at;  // esquisse créée ici : la fonction après laquelle elle se place (cgAtNow), vide si aucune
  int seq = 1;  // prochain numéro d'identifiant
  Vec3 o{0, 0, 0}, u{1, 0, 0}, v{0, 1, 0}, n{0, 0, 1};
  bool visible = true;
  std::vector<std::string> ordre;  // ordre d'enregistrement des points : il décide des fusions de noeuds
  std::unordered_map<std::string, Pt> points;
  std::vector<Entite> entites;
  std::vector<Contrainte> contraintes;
  std::vector<Cote> cotes;
  Hote hote;
  const Pt* point(const std::string& id) const {
    auto it = points.find(id);
    return it == points.end() ? nullptr : &it->second;
  }
  const Entite* entite(const std::string& id) const {
    for (const Entite& e : entites)
      if (e.id == id) return &e;
    return nullptr;
  }
};

// Les nombres et la structure d'une esquisse : ce que le logiciel sait changer et enregistrer
bool memesValeurs(const Esquisse& a, const Esquisse& b);
// La structure seule : éléments, identifiants, liens entre eux ; pas les coordonnées, rayons et valeurs de cotes
bool memesLiens(const Esquisse& a, const Esquisse& b);

struct Fonction {
  std::string id, type, nom, esquisse, corps, op = "add";
  double distance = 10;
  bool aDistance = false, visible = true, mid = false, flip = false, through = false;
};
// Ce que le logiciel sait changer et enregistrer dans une fonction
inline bool memesReglages(const Fonction& a, const Fonction& b) {
  return a.id == b.id && a.distance == b.distance && a.op == b.op && a.nom == b.nom && a.mid == b.mid && a.flip == b.flip && a.through == b.through;
}

struct Document {
  std::string nom;
  std::vector<std::string> corps;
  std::vector<std::string> nomsCorps;  // même rang que corps
  std::vector<Esquisse> esquisses;
  std::vector<Esquisse> esquissesFichier;  // telles qu'écrites dans le fichier : ce qui en diffère reste à enregistrer
  std::vector<Fonction> fonctions;
  std::vector<Fonction> fonctionsFichier;  // telles qu'écrites dans le fichier
  std::string corpsActif;  // où naît une nouvelle fonction
  std::vector<std::string> nonPrisEnCharge;  // vide = la pièce se rejoue entièrement
  std::wstring chemin;
  std::string octets;  // le fichier tel qu'il est sur le disque : l'enregistrement en repart
  bool compresse = false;
  int nomsFace = 0;  // entNames.face : compteur des noms « Face n », jamais réemployés
  bool modifie() const {
    if (esquisses.size() != esquissesFichier.size() || fonctions.size() != fonctionsFichier.size()) return true;
    for (size_t i = 0; i < fonctions.size(); i++)
      if (!memesReglages(fonctions[i], fonctionsFichier[i])) return true;
    for (size_t i = 0; i < esquisses.size(); i++)
      if (!memesValeurs(esquisses[i], esquissesFichier[i])) return true;
    return false;
  }
  Esquisse* esquisse(const std::string& id);
  const Fonction* fonction(const std::string& id) const;
  // Changer cette profondeur laisse-t-il les autres esquisses justes sans le solveur ? Une esquisse liée au solide
  // (projection, face d'appui) dans un plan non parallèle suit les arêtes qui bougent : le navigateur la recalcule, pas ce programme.
  bool profondeurModifiable(size_t i) const;
};

// Lève std::runtime_error si le fichier est illisible.
Document lireProjet(const std::wstring& chemin);
std::string lireOctets(const std::wstring& chemin);
std::string degonfler(const std::string& gz);
