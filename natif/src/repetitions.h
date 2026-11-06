// Régénération des copies de répétition à l'ouverture d'un fichier (src/40-20-repetitions.js).
#pragma once
#include <nlohmann/json.hpp>

// Refait les copies depuis leurs sources, dans le document lu (pas dans le texte du fichier).
// Rend false, sans rien changer, si la liste des fonctions, des esquisses ou des corps en serait modifiée.
bool regenererRepetitions(nlohmann::ordered_json& doc);
