// Les changements de structure du document : renommer, masquer, supprimer, sur le JSON de la pièce.
#pragma once
#include <nlohmann/json.hpp>

#include <string>
#include <vector>

void stRenommer(nlohmann::ordered_json& d, const char* liste, const std::string& id, const std::string& nom);  // "sketches", "features" ou "bodies"
void stBasculerVisible(nlohmann::ordered_json& d, const char* liste, const std::string& id);
void stBasculerVueCorps(nlohmann::ordered_json& d, const std::string& id);  // doc.bodyVis : la vue seule
void stCorpsMasques(nlohmann::ordered_json& d, const std::vector<std::string>& ids);  // Isoler, Tout afficher
void stCorpsActif(nlohmann::ordered_json& d, const std::string& id);
void stReglerCorps(nlohmann::ordered_json& d, const std::string& id, const char* champ, double valeur);  // "color" ou "op"
void stSupprimerFonction(nlohmann::ordered_json& d, const std::string& id);
void stSupprimerEsquisse(nlohmann::ordered_json& d, const std::string& id);
void stSupprimerCorps(nlohmann::ordered_json& d, const std::string& id);
// Une étape « Retirer » au marqueur (indice -1 : à la fin). Rend le refus, vide si fait.
std::string stRetirerCorps(nlohmann::ordered_json& d, const std::string& id, int indiceMarque);
