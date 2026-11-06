// Changer une cote d'esquisse dans une pièce : le solveur, puis les esquisses suivantes qui s'appuient sur
// les arêtes du solide (updateAllProjections, src/50-esquisse-1). Sans fenêtre : les essais passent par le même chemin.
#pragma once
#include <string>

#include "projet.h"
#include "solveur.h"

// Vide si l'esquisse peut être modifiée, sinon la raison, à montrer telle quelle.
std::string esquisseFigee(const Document& d, size_t i);
// La fonction qui se sert de cette esquisse, -1 si aucune
int fonctionConsommatrice(const Document& d, const std::string& id);
std::string coteFigee(const Cote& c);

// Le solveur reste vivant tant que l'esquisse est ouverte : sa mémoire compte, comme dans le navigateur.
struct Edition {
  explicit Edition(const Esquisse& s) : solveur(s) {}
  Solveur solveur;
  bool resolue = false;  // le navigateur résout à l'ouverture de l'esquisse
};

// Les arêtes du solide que voit cette esquisse : la pièce juste avant la fonction qui s'en sert, sinon la pièce finie
struct AreteProjetable {
  Vec3 mid{0, 0, 0};
  std::vector<Vec3> pts;
};
std::vector<AreteProjetable> aretesPourProjeter(const Document& d, size_t i);

// Rend false si le solveur refuse la valeur : rien n'a changé, raison dit pourquoi.
// Les esquisses suivantes qui s'appuient sur le solide suivent l'esquisse i
void suivreEsquisses(Document& d, size_t i);
bool saisirCote(Document& d, size_t i, Edition& ed, const std::string& idCote, double valeur, std::string& raison);
// La saisie telle que tapée : « [nom =] valeur|expression » (parDimCommit, parApplyAll, skSolveOrRevert)
bool saisirCoteTexte(Document& d, size_t i, Edition& ed, const std::string& idCote, const std::string& texte, std::string& raison);
// Après un changement de paramètre ou de nom (parAfterChange). Rend false si une conséquence est refusée : le document reprend l'état donné.
struct EtatFormules {
  std::vector<Esquisse> esquisses;
  std::vector<Fonction> fonctions;
  std::vector<Parametre> params;
  std::vector<PorteurFx> porteurs;
  explicit EtatFormules(const Document& d) : esquisses(d.esquisses), fonctions(d.fonctions), params(d.params), porteurs(d.porteurs) {}
  void poser(Document& d) const;
};
bool appliquerFormules(Document& d, const EtatFormules& avant, int ouverte, Edition* ed, std::string& raison);
