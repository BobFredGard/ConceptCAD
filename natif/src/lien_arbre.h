// Ce que porte une ligne de l'arbre
#pragma once
#include <wx/treectrl.h>

#include <string>
#include <vector>

struct LienArbre : wxTreeItemData {
  LienArbre(bool f, int n, const std::string& p = "", const std::string& c = "", const std::string& g = "") : estFonction(f), i(n), plan(p), corps(c), cg(g) {}
  std::string corps;  // la ligne d'un corps
  std::string cg;     // la ligne d'un élément de construction
  bool estFonction;
  int i;  // -1 : une ligne de l'Origine
  std::string plan;  // XY, XZ ou YZ : un double-clic y ouvre une esquisse
  // Assemblage : la ligne d'une instance, d'une ligne de son contenu en lecture seule, d'un groupe ou d'une liaison
  enum Sorte { PIECE, INSTANCE, CONTENU, GROUPE, LIAISON } sorte = PIECE;
  std::vector<std::string> chemin;
  std::string occ;  // l'occurrence au bout du chemin
  bool direct = false;  // enfant direct du composant actif
};
