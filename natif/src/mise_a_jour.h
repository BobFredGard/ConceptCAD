// La mise à jour par Internet de la version native : au démarrage, la fiche natif-latest.json de la dernière Release
// GitHub dit quelle bêta est la plus récente. Si elle est plus récente que celle-ci, le programme propose de
// l'installer : il télécharge l'installateur, vérifie son empreinte, le lance et se ferme.
#pragma once
#include <wx/window.h>

#include <string>

namespace miseAJour {
// Le numéro de bêta : à augmenter à chaque installateur publié (fabriquer.ps1 le recopie dans natif-latest.json)
constexpr int BUILD = 5;
constexpr const wchar_t* VERSION = L"Bêta native 5";
// Vérifie en arrière-plan, sans jamais gêner le démarrage ; ne dit rien si tout est à jour ou hors ligne
void verifier(wxWindow* fenetre);
// Pour les essais, sans fenêtre : lit la fiche (adresse vide : la vraie), et si elle est plus récente que build,
// télécharge l'installateur et contrôle son empreinte sans le lancer. 0 à jour, 1 téléchargé et conforme, sinon raté.
int essai(const std::wstring& adresse, int build);
}  // namespace miseAJour
