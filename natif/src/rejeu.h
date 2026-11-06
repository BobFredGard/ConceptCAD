// Rejeu des fonctions d'une pièce avec le noyau OCCT natif :
// traduction de occFinalShapeGen / occReplayBodyGen (src/20-70) pour esquisses, extrusions et découpes.
#pragma once
#include <TopoDS_Shape.hxx>
#include "projet.h"

struct ResultatRejeu {
  TopoDS_Shape forme;  // composé si plusieurs corps
  std::vector<std::string> messages;
};

struct Mesures {
  double volume = 0, aire = 0;
  int faces = 0, aretes = 0, sommets = 0, solides = 0;
  bool valide = false;
  double boite[6] = {0, 0, 0, 0, 0, 0};
};

// Replace les esquisses posées sur une face (resolveAllSketchHosts) puis rejoue la pièce,
// ou seulement ses n premières fonctions : ce que voit l'esquisse de la fonction suivante.
ResultatRejeu rejouer(Document& d, int n = -1);
Mesures mesurer(const TopoDS_Shape& s);
// Maillage d'affichage, aux mêmes finesses que occDisplayDefl (src/20-60).
void mailler(const TopoDS_Shape& s, bool parallele);
void reglerParallele(bool actif);
bool parallele();
