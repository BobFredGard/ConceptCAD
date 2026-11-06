// Sinus, cosinus et arc tangente écrits à l'identique ici et dans mesures/solveur-reference.cjs (--communes).
// Seulement pour le banc : avec ces fonctions, le natif et le navigateur font exactement les mêmes opérations.
// Tout écart restant est alors une erreur de traduction, et non le dernier chiffre d'une bibliothèque de maths.
#pragma once
#include <cmath>
#include <limits>

namespace communes {
const double PI = 3.141592653589793, PIO2 = 1.5707963267948966, PIO2_B = 6.123233995736766e-17, RAC3 = 1.7320508075688772;

inline double sinPoly(double y) {
  const double z = y * y;
  double s = 1;  // y - y³/3! + y⁵/5! ... en partant du dernier terme
  for (int k = 19; k >= 3; k -= 2) s = 1 - s * z / (k * (k - 1));
  return y * s;
}
inline double cosPoly(double y) {
  const double z = y * y;
  double s = 1;
  for (int k = 20; k >= 2; k -= 2) s = 1 - s * z / (k * (k - 1));
  return s;
}
inline void reduire(double x, double& y, int& q) {
  const double k = std::floor(x / PIO2 + 0.5);
  y = x - k * PIO2 - k * PIO2_B;
  q = static_cast<int>(std::fmod(std::fmod(k, 4) + 4, 4));
}
inline double sin_(double x) {
  if (!std::isfinite(x)) return std::numeric_limits<double>::quiet_NaN();
  double y;
  int q;
  reduire(x, y, q);
  return q == 0 ? sinPoly(y) : q == 1 ? cosPoly(y) : q == 2 ? -sinPoly(y) : -cosPoly(y);
}
inline double cos_(double x) {
  if (!std::isfinite(x)) return std::numeric_limits<double>::quiet_NaN();
  double y;
  int q;
  reduire(x, y, q);
  return q == 0 ? cosPoly(y) : q == 1 ? -sinPoly(y) : q == 2 ? -cosPoly(y) : sinPoly(y);
}
inline double atanPetit(double t) {  // |t| <= tan(15°)
  const double z = t * t;
  double s = 0;
  for (int k = 33; k >= 1; k -= 2) s = 1.0 / k - z * s;
  return t * s;
}
inline double atan_(double t) {  // t >= 0
  if (t > 1) return PIO2 - atan_(1 / t);
  if (t > 0.2679491924311227) return PI / 6 + atanPetit((t * RAC3 - 1) / (t + RAC3));
  return atanPetit(t);
}
inline double atan2_(double y, double x) {
  if (std::isnan(x) || std::isnan(y)) return std::numeric_limits<double>::quiet_NaN();
  if (x == 0 && y == 0) return 0;
  const double ax = std::abs(x), ay = std::abs(y);
  double a;
  if (ax == 0) a = PIO2;
  else if (ay == 0) a = 0;
  else a = atan_(ay / ax);
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}
}  // namespace communes
