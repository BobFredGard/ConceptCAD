// Configurations : tables de variantes d'une pièce (src/52-configurations.js du navigateur).
// doc.configs = {active, cols:[nom…], rows:[{id, name, vals:{nom:expression}, off:[id de fonction…]}]}
#pragma once
#include <nlohmann/json.hpp>

#include <string>
#include <vector>

#include "projet.h"

// cfgNorm : la table relue d'un fichier, champs valides seulement ; null si elle est vide
nlohmann::ordered_json cfgNorm(const nlohmann::ordered_json& c);
// cfgOf : la table du document, ou nul s'il n'y en a pas
const nlohmann::ordered_json* cfgDe(const Document& d);
// Les noms qu'on peut mettre en colonne, hors valeurs venues d'un autre fichier et colonnes déjà prises
std::vector<std::string> cfgNomsLibres(const Document& d);
std::string cfgCourant(const Document& d, const std::string& nom);  // cfgCurrent
void cfgRenommerColonne(Document& d, const std::string& ancien, const std::string& nouveau);  // cfgRename

// Sur le JSON du document (dans un modifierStructure). d donne les valeurs actuelles du modèle.
nlohmann::ordered_json& cfgAssurer(nlohmann::ordered_json& j);  // cfgEnsure, à partir de la table normalisée
void cfgRanger(nlohmann::ordered_json& j);                      // plus aucune variante : plus de table
std::string cfgAjouterLigne(const Document& d, nlohmann::ordered_json& j);  // cfgAddRow : rend l'id
void cfgAjouterColonne(const Document& d, nlohmann::ordered_json& j, const std::string& nom);  // cfgAddCol, avec sa première ligne au besoin
void cfgCapturer(const Document& d, nlohmann::ordered_json& j, const std::string& id);  // cfgCapture
void cfgSupprimerLigne(nlohmann::ordered_json& j, const std::string& id);  // cfgDelRow
void cfgSupprimerColonne(nlohmann::ordered_json& j, const std::string& nom);  // cfgDelCol
void cfgRenommerLigne(nlohmann::ordered_json& j, const std::string& id, const std::string& nom);
void cfgPoserCellule(nlohmann::ordered_json& j, const std::string& id, const std::string& nom, const std::string& valeur);
void cfgBasculerSupprimee(nlohmann::ordered_json& j, const std::string& id, const std::string& fonction);

// cfgApply, en deux temps : la variante active et ce qu'elle supprime, sur le JSON ; puis ses valeurs, dans le document
void cfgStructureActive(nlohmann::ordered_json& j, const std::string& id);
std::vector<std::string> cfgPoserValeurs(Document& d, const std::string& id);  // rend les noms absents du modèle
// Le message du navigateur, une fois les valeurs résolues
std::string cfgMessage(const Document& d, const std::string& id, const std::vector<std::string>& absents);
