// Changer une cote d'esquisse dans une pièce : le solveur, puis les esquisses suivantes qui s'appuient sur
// les arêtes du solide (updateAllProjections, src/50-esquisse-1). Sans fenêtre : les essais passent par le même chemin.
#pragma once
#include <string>

#include "projet.h"
#include "solveur.h"

// Vide si l'esquisse peut être modifiée, sinon la raison, à montrer telle quelle.
std::string esquisseFigee(const Document& d, size_t i);
std::string coteFigee(const Cote& c);

// Le solveur reste vivant tant que l'esquisse est ouverte : sa mémoire compte, comme dans le navigateur.
struct Edition {
  explicit Edition(const Esquisse& s) : solveur(s) {}
  Solveur solveur;
  bool resolue = false;  // le navigateur résout à l'ouverture de l'esquisse
};

// Rend false si le solveur refuse la valeur : rien n'a changé, raison dit pourquoi.
// Les esquisses suivantes qui s'appuient sur le solide suivent l'esquisse i
void suivreEsquisses(Document& d, size_t i);
bool saisirCote(Document& d, size_t i, Edition& ed, const std::string& idCote, double valeur, std::string& raison);
