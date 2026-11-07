// Les thèmes de couleur du navigateur (MF_THEMES, src/97-interface-moderne.js).
// Tout le code écrit ses couleurs pour le thème Nuit : th() les traduit dans le thème choisi.
#pragma once
#include <wx/colour.h>
#include <wx/string.h>

namespace theme {

enum { NUIT, GRAPHITE, ATELIER, CLAIR, CONTRASTE, NB };

struct Palette {
  const wchar_t* nom;
  const char* cle;
  wxColour scene, bg, surface, bord, muted, texte, primary, bureau;
};

const Palette& palette(int i);
int courant();
void choisir(int i);   // sans enregistrer
void charger();        // le thème et le style d'icônes mémorisés
void enregistrer();
bool iconesCouleur();  // « Couleurs par famille »
void iconesCouleur(bool oui);

// Une couleur du thème Nuit, dans le thème choisi
wxColour traduire(const wxColour& nuit);
// Une couleur déjà posée, d'un thème à l'autre : les couleurs proches du thème changent, les autres restent
wxColour passer(const wxColour& c, int de, int vers);

}  // namespace theme

inline wxColour th(const wxColour& nuit) { return theme::courant() == theme::NUIT ? nuit : theme::traduire(nuit); }
