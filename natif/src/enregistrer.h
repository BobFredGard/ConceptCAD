// Enregistrement sans rien perdre : le fichier d'origine est gardé tel quel, seuls les nombres
// modifiés sont remplacés dans son texte. Tout ce que ce programme ne connaît pas (parcours FAO,
// faces nommées, congés, mise en plan…) reste identique, octet pour octet.
#pragma once
#include <functional>
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <string>
#include <vector>

#include "projet.h"

// Le fichier a changé sur le disque depuis son ouverture : ne pas l'écraser sans le demander.
struct FichierChangeAilleurs : std::runtime_error {
  FichierChangeAilleurs() : std::runtime_error("le fichier a changé sur le disque depuis son ouverture") {}
};

struct Retouche {
  size_t fonction;  // rang dans « features »
  struct Valeur { const char* nom; std::string texte; };
  std::vector<Valeur> champs;  // texte JSON de chaque champ qui change
};
// Les nombres d'une esquisse qui ont changé
struct RetoucheEsquisse {
  size_t esquisse;  // rang dans « sketches »
  struct Point { std::string id; double x, y; };
  struct Element { size_t rang; bool aR; double r; bool aMid; Vec3 mid; std::string isect; };  // isect vide : inchangée
  struct Mesure { size_t rang; bool aValeur; double valeur; int sgn, ccw; };  // sgn 0 ou ccw -1 : inchangé
  std::vector<Point> points;
  std::vector<Element> elements;
  std::vector<Mesure> cotes;
  int visible = -1;  // -1 : inchangé
};
// Texte du projet avec ces seuls nombres remplacés. Lève std::runtime_error si le texte n'a pas la forme attendue.
std::string retoucher(const std::string& texte, const std::vector<Retouche>& retouches, const std::vector<RetoucheEsquisse>& esquisses = {});

// Le texte du fichier une fois toutes les modifications du document portées : éléments ajoutés ou retirés, puis nombres.
// Ce qui ne change pas garde ses octets. Lève std::runtime_error plutôt que d'écrire un doute.
std::string texteEnregistre(const Document& d, const std::string& texteFichier);

// Écrit dans un fichier temporaire, relit, garde l'ancienne version en « .bak », puis remplace d'un seul coup :
// en cas d'échec, le fichier existant reste intact. Met à jour le document (chemin, état « enregistré »).
// Lève FichierChangeAilleurs si cible est le fichier ouvert et a changé, sauf si forcer.
void enregistrerProjet(Document& d, const std::wstring& cible, bool forcer = false);

// Un changement de structure (renommer, masquer, supprimer…) : les modifications en cours sont reportées dans le texte,
// le changement s'y applique, les copies de répétition sont refaites, le document est relu. Rien n'est écrit sur le disque.
void modifierStructure(Document& d, const std::function<void(nlohmann::ordered_json&)>& changement);
// Le texte tel qu'il est sur le disque
std::string texteDuFichier(const Document& d);
