// La fonction Perçage (src/76-percage)
#pragma once
#include <TopoDS_Shape.hxx>

#include <string>
#include <vector>

#include "projet.h"

// Les corps de l'outil, un par centre de perçage de l'esquisse. base : la pièce déjà construite, pour les fins
// « débouchant ». Lève une exception si l'esquisse n'a aucun centre.
std::vector<TopoDS_Shape> formePercage(const Fonction& f, const Esquisse& s, const TopoDS_Shape& base, std::vector<std::string>& alertes);
