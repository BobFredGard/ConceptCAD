// La finition de l'image (src/98-rendu-post.js du navigateur) : du linéaire accumulé jusqu'aux pixels.
// Débruitage, halo, tons, fond, étalonnage, vignettage, grain, sRGB.
#pragma once

#include <array>
#include <vector>

struct Finition {
  double den = 0, halo = 0, expo = 1, vig = 0, grain = 0, con = 0, sat = 0, temp = 0;
  int tons = 0;   // 0 ACES, 1 Reinhard, 2 Cinéon, 3 linéaire
  int fond = 1;   // 0 uni, 1 dégradé, 2 transparent
  std::array<double, 3> c1{}, c2{};  // valeurs sRGB 0..1
};

// src : w × h × 4 flottants linéaires, prémultipliés ; sortie : w × h × 4 octets (RGBA, sRGB, du haut vers le bas).
// Fond transparent : alpha prémultiplié dans le calcul, puis ramené en droit pour le PNG.
void finir(const float* src, int w, int h, const Finition& o, std::vector<unsigned char>& sortie);
