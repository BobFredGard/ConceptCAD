// Journal d'erreurs local (src/01-journal-erreurs.js du navigateur). Tout reste sur l'ordinateur : aucun envoi.
// Message, emplacement, version et derniers boutons cliqués ; jamais le contenu du document ni les valeurs saisies.
#pragma once
#include <functional>
#include <string>

namespace journal {
void demarrer();  // relit le journal et note désormais les plantages
void ajouter(const std::string& genre, const std::string& message, const std::string& lieu);
void geste(const std::string& nomDuBouton);
std::string texte();    // journalTexte
size_t nombre();
std::string dernierMessage();
void vider();
extern std::function<void()> surErreur;  // une erreur rattrapée vient d'être notée : le dire à l'écran
}  // namespace journal
