// Enregistrement sans rien perdre : le fichier d'origine est gardé tel quel, seuls les nombres
// modifiés sont remplacés dans son texte. Tout ce que ce programme ne connaît pas (parcours FAO,
// faces nommées, congés, mise en plan…) reste identique, octet pour octet.
#pragma once
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
  double distance;
};
// Texte du projet avec les seules valeurs de « distance » remplacées. Lève std::runtime_error si le texte n'a pas la forme attendue.
std::string retoucher(const std::string& texte, const std::vector<Retouche>& retouches);

// Écrit dans un fichier temporaire, relit, garde l'ancienne version en « .bak », puis remplace d'un seul coup :
// en cas d'échec, le fichier existant reste intact. Met à jour le document (chemin, état « enregistré »).
// Lève FichierChangeAilleurs si cible est le fichier ouvert et a changé, sauf si forcer.
void enregistrerProjet(Document& d, const std::wstring& cible, bool forcer = false);
