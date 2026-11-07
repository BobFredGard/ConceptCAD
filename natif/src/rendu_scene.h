// La scène de l'atelier Rendu (src/98-rendu-scene.js, 98-rendu-supports.js) : image HDRI importée et supports texturés.
#pragma once

#include <memory>
#include <string>
#include <vector>

// Une image panoramique : rgb linéaires, ligne 0 en haut, réduite à 2048 de large au plus
struct ImageHdri {
  std::wstring chemin;
  std::wstring nom;
  int w = 0, h = 0;
  std::vector<float> rgb;
  bool soleil = false;
  double su = 0, sv = 0, sl = 0;       // où il est, et sa luminance
  double az = 0, el = 0, E = 0;        // sa direction en degrés, avant rotation, et son éclairement
  double sol[3] = {0.3, 0.3, 0.3};     // radiance moyenne du sol de l'image (5 à 35° sous l'horizon)
};
// Rend nullptr si le fichier ne peut pas être lu ; erreur dit pourquoi
std::shared_ptr<const ImageHdri> lireHdri(const std::wstring& chemin, std::string& erreur);

struct SupportRendu {
  const char* cle;
  const wchar_t* nom;
  const wchar_t* famille;
  double t;   // la tuile, en mm
  double r;   // rugosité
  double m;   // métal
  double cc;  // vernis (lancer de rayons)
  double k;   // force du reflet (calcul rapide)
  double b;   // flou du reflet
  double em;  // lumière émise
};
const std::vector<SupportRendu>& supportsRendu();
const SupportRendu* supportRendu(const std::string& cle);
// La tuile : N × N pixels rgb sRGB, calculée à la demande et gardée (N = 1024). Avec n, une vignette jamais gardée.
struct TuileSupport {
  int n = 0;
  double t = 100;
  std::vector<unsigned char> rgb;
};
std::shared_ptr<const TuileSupport> tuileSupport(const std::string& cle, int n = 0);
