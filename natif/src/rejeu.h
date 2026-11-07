// Rejeu des fonctions d'une pièce avec le noyau OCCT natif :
// traduction de occFinalShapeGen / occReplayBodyGen (src/20-70) pour esquisses, extrusions et découpes.
#pragma once
#include "filets.h"
#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>
#include "projet.h"

struct FiletDuPlan {
  std::string fonction, corps;
  double longueur = 0;
};
struct ResultatRejeu {
  TopoDS_Shape forme;  // composé si plusieurs corps
  std::vector<std::pair<std::string, TopoDS_Shape>> corps;  // le solide de chaque corps
  std::vector<std::pair<std::string, TopoDS_Shape>> corpsVus;  // ce qui s'en voit : sans les pièces importées masquées
  std::vector<std::string> messages;
  std::vector<SpiraleFilet> spirales;  // les filets cosmétiques à dessiner
  std::vector<FiletDuPlan> filetsCosmetiques;  // ce que la mise en plan dessine des perçages taraudés
};

struct Mesures {
  double volume = 0, aire = 0;
  int faces = 0, aretes = 0, sommets = 0, solides = 0;
  bool valide = false;
  double boite[6] = {0, 0, 0, 0, 0, 0};
};

// Les tranches [lo, hi] le long de la normale des extrusions visibles qui se servent de cette esquisse (extrudeSpan)
std::vector<std::pair<double, double>> plagesExtrusions(const Document& d, const std::string& idEsquisse);
// Replace les esquisses posées sur une face (resolveAllSketchHosts) puis rejoue la pièce,
// ou seulement ses n premières fonctions : ce que voit l'esquisse de la fonction suivante.
ResultatRejeu rejouer(Document& d, int n = -1);
// Sans recalculer les éléments de construction : le solide sur lequel on les pose
ResultatRejeu rejouerSansConstruction(Document& d, int n);
// newSketch et newSketchOnFace (src/50-esquisse-1) : l'esquisse vide, pas encore ajoutée à la pièce.
Esquisse nouvelleEsquissePlan(const Document& d, const std::string& plan);
// solide : la forme affichée. Rend false si la face n'est pas plane. Prend un nom « Face n » si la face a une porteuse.
bool nouvelleEsquisseFace(Document& d, const TopoDS_Shape& solide, const TopoDS_Face& face, Esquisse& out);
// Un point à l'intérieur de la face (son centre si possible). Rend false si elle n'en a pas.
bool nouvelleEsquisseConstruction(const Document& d, const std::string& id, const std::string& sous, Esquisse& out);
bool pointDansFace(const TopoDS_Face& face, double p[3]);
// extDynNew (src/70-extrusion-dynamique) : la fonction telle qu'elle naît, 20 mm vers le haut, pas encore ajoutée à la pièce.
Fonction nouvelleExtrusion(const Document& d, const Esquisse& s);
// extName (src/70-extrusion) : à rappeler après chaque réglage
std::string nomExtrusion(const Document& d, const Fonction& f);
// Les réglages du panneau de l'extrusion, mêmes règles que le navigateur : le signe de la distance vient de l'opération
void reglerOperation(Fonction& f, const std::string& op);
void reglerProfondeur(Fonction& f, double valeur);
void reglerATravers(Fonction& f, bool oui);
// Pourquoi cette esquisse ne donne pas de volume ; vide si elle en donne un
std::string raisonSansVolume(const Esquisse& s);
Mesures mesurer(const TopoDS_Shape& s);
// Maillage d'affichage, aux mêmes finesses que occDisplayDefl (src/20-60).
void mailler(const TopoDS_Shape& s, bool parallele);
void reglerParallele(bool actif);
bool parallele();
