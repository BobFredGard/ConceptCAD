// Les composants normalisés : vis, bouchons, goupilles, clavettes, engrenages et aimants (src/48-composants-normalises, 48-aimants-*).
// Ce module ne fait que du calcul : il décrit la pièce et écrit son document, tel que le navigateur l'écrit.
#pragma once
#include <array>
#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

#include "assemblage.h"
#include "projet.h"

namespace normalises {
using J = nlohmann::ordered_json;
struct Option {
  std::string v, lib;
};
struct Champ {
  std::string k, lib;
  bool num = false, entier = false;
  double mini = 0, maxi = 0, pas = 0;
  std::vector<double> propositions;  // sug
  std::function<std::vector<Option>(const J&)> options;
  std::function<std::string(const J&)> defaut;  // absent : la première option
  std::function<bool(const J&)> visible;        // absent : toujours
};
struct Categorie {
  std::string k, lib;
  std::vector<Champ> champs;
};
const std::vector<Categorie>& categories();  // STD_CATS
const Categorie& categorie(const std::string& k);  // stdCat

struct Sommet {
  double x = 0, y = 0;
  bool arc = false;
  double cx = 0, cy = 0;
  int sens = -1;  // ccw : -1 pas donné, 0 non, 1 oui
};
struct Operation {
  std::string k;  // hex, slot, key, gear, bore, mbox
  double z = 0, s = 0, t = 0;
  double x0 = 0, x1 = 0, w = 0, L = 0, z0 = 0;
  std::string forme;
  double b = 0, h = 0, a = 0, d = 0, t2 = 0;
  ReglageEngrenage gear;
};
struct Filetage {
  std::string size, lenMode;
  double p = 0, r = 0, z = 0, len = 0;
  bool model = false;
};
struct Controle {
  bool ok = true;
  std::string txt;
};
struct Piece;
struct MembrePaire;
struct Piece {  // stdSpec
  std::string key, norm, desig, name, info, seat, cat;
  double sink = 0, reach = 0;
  std::vector<Sommet> prof;
  std::vector<Operation> ops;
  std::optional<Filetage> thr;
  std::vector<Controle> checks;
  bool aControles = false;
  J st, mag, mat;
  std::optional<unsigned> couleur;
  std::vector<MembrePaire> paire;
};
struct MembrePaire {
  Piece sp;
  assemblage::Repere fr;
  ReglageEngrenage o;
};

J etatNormalise(const std::string& cat, const J& st);  // stdNormState
Piece specification(const std::string& cat, const J& st);  // stdSpec : lève une exception si la pièce est impossible, avec son motif
std::optional<std::pair<std::string, J>> etatDe(const J& std_);  // stdStateOf
J documentDe(const Piece& sp);  // stdDoc
bool estClavette(const Piece& sp);  // stdIsKey

// L'aperçu de la fenêtre (stdSvg) : les formes, dans le repère de la pièce
struct Apercu {
  std::vector<std::vector<std::array<double, 2>>> formes, trous, caches;
  bool axe = false;
};
Apercu apercuDe(const Piece& sp);

// ---- Insertion dans l'assemblage (a = le bloc asm) ----
// stdAddOcc : composant neuf, ou nouvelle occurrence d'une pièce identique déjà là. Rend l'identifiant de l'occurrence, "" si refusé.
std::string ajouterOccurrence(J& a, const Piece& sp, const std::string& porteur, const assemblage::Repere& fr, bool* neuf = nullptr);
struct Trou {  // stdHoles
  assemblage::FaceAccroche entree, assise;
  assemblage::V3 ec{}, en{}, sc{}, sn{};
  double er = 0, sr = 0;
  std::string sorte;  // simple, cbore, csink
  assemblage::V3 n{};
  double r = 0, d0 = 0, d1 = 0;
  assemblage::FaceAccroche cyl;
  bool aCyl = false;
  std::string sig;
};
std::vector<Trou> trousDe(const std::vector<assemblage::FaceAccroche>& G);
const Trou* trouSous(const std::vector<Trou>& H, const assemblage::V3& p, const assemblage::V3* regard);  // stdHoleAt
std::vector<const Trou*> trousPareils(const std::vector<Trou>& H, const Trou& h);  // stdSameHoles
std::string positionGoupille(const Trou& h, const assemblage::V3& p);  // stdPinAt
// stdAddOnHoles : une occurrence par trou, en liaison rigide. Rend leurs identifiants.
std::vector<std::string> poserSurTrous(J& a, const Piece& sp, const std::string& porteur, const assemblage::Chemin& relatif, const std::vector<const Trou*>& trous, const std::string& at);
struct Rainure {  // stdKeyway
  assemblage::FaceAccroche F;
  std::string forme;  // A, open, rect
  assemblage::V3 c{}, ax{};
  double w = 0, len = 0;
  std::vector<std::pair<assemblage::V3, double>> arcs;
  std::string sig;
};
std::optional<Rainure> rainureDe(const assemblage::FaceAccroche& F);
struct RainureChoisie {
  Rainure K;
  bool aBout = false;
  std::pair<assemblage::V3, double> bout;
};
struct PoseRainure {
  Rainure K;
  std::vector<RainureChoisie> items;
  std::string mode;
};
std::optional<PoseRainure> choisirRainure(const std::vector<assemblage::FaceAccroche>& G, const assemblage::V3& p, const assemblage::V3* n, const std::string& keyAt);  // stdKeyPick
std::vector<std::string> poserDansRainures(J& a, const Piece& sp, const std::string& porteur, const assemblage::Chemin& relatif, const PoseRainure& pose);  // stdAddInKeyways
struct Remplacement {
  std::string comp, comment;  // rebuilt, moved, same
  int n = 0;
};
std::optional<Remplacement> remplacer(J& a, const std::string& occ, const Piece& sp, bool toutes);  // stdReplace

// ---- Les aimants ----
bool aimantDe(const J& doc, J& m);        // magOfComp
double champFaceNord(const J& m);         // magPoleField
struct SegmentChamp {
  std::array<double, 3> a, b;
  std::array<float, 3> couleur;
};
std::vector<SegmentChamp> lignesChamp(const J& m);  // magLineGeo
std::vector<std::pair<std::string, std::string>> caracteristiques(const J& m);  // magCtxRows
}  // namespace normalises
