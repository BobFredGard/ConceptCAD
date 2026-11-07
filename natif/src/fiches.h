// Les réglages de chaque fonction de la CAO, décrits une fois : le panneau Paramètres les montre, le document JSON les reçoit.
// Comme le panneau du navigateur (src/40-50-panneau-proprietes.js et les panneaux de chaque fonction).
#pragma once
#include <nlohmann/json.hpp>

#include <string>
#include <utility>
#include <vector>

struct Document;

struct ChampFiche {
  enum Sorte { LECTURE, NOMBRE, BOOLEEN, CHOIX } sorte = LECTURE;
  std::string categorie;
  std::string cle;     // « n/angle », « b/flip », « s/op », « x/… » : voir ficheAppliquer
  std::string titre;   // UTF-8
  std::string texte;   // LECTURE : la valeur ; CHOIX : la valeur choisie
  double nombre = 0;
  bool oui = false;
  std::vector<std::pair<std::string, std::string>> choix;  // valeur, libellé
};

// Vide : ce type de fonction n'a pas de fiche
std::vector<ChampFiche> ficheFonction(const Document& d, const nlohmann::ordered_json& f);
// Applique un réglage à la fonction id du document JSON, renomme ce qui porte un nom automatique. Rend le refus, vide si fait.
std::string ficheAppliquer(nlohmann::ordered_json& d, const std::string& id, const std::string& cle, const std::string& valeur);

// Les créations du ruban : la fonction naît tout de suite, au marqueur, avec des réglages par défaut (comme le navigateur).
// Chacune rend son identifiant, ou lève std::runtime_error avec le message à montrer.
std::string creerCombiner(nlohmann::ordered_json& d, int marque);
std::string ajouterFonction(nlohmann::ordered_json& d, nlohmann::ordered_json f, const char* prefixe, int marque);
std::string nomAutoFonction(const nlohmann::ordered_json& d, const nlohmann::ordered_json& f);
std::string corpsNeufScission(nlohmann::ordered_json& d, const std::string& source);  // splitNewBodyFor
std::string creerRevolution(nlohmann::ordered_json& d, const std::string& esquisse, int marque);
std::string creerBalayage(nlohmann::ordered_json& d, const std::string& profil, const std::string& chemin, int marque);
std::string creerPercage(nlohmann::ordered_json& d, const std::string& esquisse, bool inverse, int marque);
std::string creerRepetition(nlohmann::ordered_json& d, const std::string& source, int marque);
std::string creerDeplacement(nlohmann::ordered_json& d, const std::string& corps, int marque);
std::string creerEchelle(nlohmann::ordered_json& d, const std::string& corps, int marque);
std::string creerScission(nlohmann::ordered_json& d, const std::string& corps, int marque);
