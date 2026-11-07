// La fonction Perçage (src/76-percage)
#pragma once
#include <TopoDS_Shape.hxx>

#include <string>
#include <vector>

#include "filets.h"
#include "projet.h"

// Les corps de l'outil, un par centre de perçage de l'esquisse. base : la pièce déjà construite, pour les fins
// « débouchant ». Lève une exception si l'esquisse n'a aucun centre.
// fil : ce qui revient au filet. Sans lui, les vides ne sont pas construits (rejeu partiel), le perçage garde la même forme.
struct FiletsPercage {
  TopoDS_Shape vides;  // filet modélisé : creusé à la fin du rejeu du corps, le perçage n'est ici qu'un avant-trou lisse
  std::vector<SpiraleFilet> spirales;  // filet cosmétique
};
std::vector<TopoDS_Shape> formePercage(const Fonction& f, const Esquisse& s, const TopoDS_Shape& base, std::vector<std::string>& alertes, FiletsPercage* fil = nullptr);
