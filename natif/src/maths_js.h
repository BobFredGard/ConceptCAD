// Les fonctions de calcul du navigateur, au dernier chiffre près : communes au solveur et au dessin.
#pragma once
#include <cmath>
#include <limits>

#include "maths_communes.h"

// Même calcul que Math.hypot du moteur JavaScript, au dernier chiffre près : la somme de Kahan et l'échelle
// y sont propres, std::hypot donne un arrondi différent.
// Le banc peut remplacer ces trois fonctions par les mêmes des deux côtés (maths_communes.h)
#ifdef SOLVEUR_MATHS_COMMUNES
inline double m_atan2(double y, double x) { return communes::atan2_(y, x); }
inline double m_sin(double x) { return communes::sin_(x); }
inline double m_cos(double x) { return communes::cos_(x); }
#else
inline double m_atan2(double y, double x) { return std::atan2(y, x); }
inline double m_sin(double x) { return std::sin(x); }
inline double m_cos(double x) { return std::cos(x); }
#endif
inline double hyp(double a, double b) {
  a = std::abs(a);
  b = std::abs(b);
  if (std::isnan(a) || std::isnan(b)) return std::numeric_limits<double>::quiet_NaN();
  const double m = a > b ? a : b;
  if (m == std::numeric_limits<double>::infinity()) return m;
  if (m == 0) return 0;
  double somme = 0, comp = 0;
  double n = a / m, s = n * n - comp, pre = somme + s;
  comp = (pre - somme) - s;
  somme = pre;
  n = b / m;
  s = n * n - comp;
  pre = somme + s;
  somme = pre;
  return std::sqrt(somme) * m;
}
// Math.max et Math.min rendent NaN dès qu'un argument l'est
inline double jsmax(double a, double b) {
  if (std::isnan(a) || std::isnan(b)) return std::numeric_limits<double>::quiet_NaN();
  return a > b ? a : b;
}
inline double jsmin(double a, double b) {
  if (std::isnan(a) || std::isnan(b)) return std::numeric_limits<double>::quiet_NaN();
  return a < b ? a : b;
}
