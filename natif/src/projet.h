// Lecture d'un projet .conceptcad (JSON, gzip possible) : même format que la version navigateur.
#pragma once
#include <array>
#include <string>
#include <unordered_map>
#include <vector>

struct Pt { double x = 0, y = 0; };

struct Entite {
  std::string id, t, p1, p2, pc, pa, pb;
  std::string p;  // point porté par un « cpoint »
  double r = 0;
  bool construction = false, ref = false, axe = false, poignee = false, proj = false, percage = false;
};

// Contrainte et cote d'esquisse : mêmes champs que le fichier (src/50-esquisse-2, 50-esquisse-4).
struct Contrainte {
  std::string type, p, line, ent, a, b, mid;
};
struct Cote {
  std::string id, type, line, ent, a, b, p, orient, nom;
  double value = 0, ox = 0, oy = 0, w = 0, sl = 0;
  bool aW = false, ref = false, dia = false, formule = false, formuleFausse = false;
  int ccw = -1;  // -1 : absent du fichier
};

struct Hote {
  bool existe = false;
  std::string feat, tag = "TOP", edge;
  double x = 0, y = 0, h = 0;
  bool aH = false;
};

using Vec3 = std::array<double, 3>;

struct Esquisse {
  std::string id, nom, plan;
  Vec3 o{0, 0, 0}, u{1, 0, 0}, v{0, 1, 0}, n{0, 0, 1};
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

struct Fonction {
  std::string id, type, nom, esquisse, corps, op = "add";
  double distance = 10;
  bool aDistance = false, visible = true, mid = false, flip = false, through = false;
};

struct Document {
  std::string nom;
  std::vector<std::string> corps;
  std::vector<Esquisse> esquisses;
  std::vector<Fonction> fonctions;
  std::vector<std::string> nonPrisEnCharge;  // vide = la pièce se rejoue entièrement
  Esquisse* esquisse(const std::string& id);
  const Fonction* fonction(const std::string& id) const;
};

// Lève std::runtime_error si le fichier est illisible.
Document lireProjet(const std::wstring& chemin);
