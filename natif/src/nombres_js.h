// Les nombres écrits comme en JavaScript : les désignations et les clés des pièces normalisées doivent être les mêmes au caractère près
#pragma once
#include <charconv>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <string>

namespace js {
// String(v)
inline std::string texte(double v) {
  if (std::isnan(v)) return "NaN";
  if (std::isinf(v)) return v > 0 ? "Infinity" : "-Infinity";
  if (v == 0) return "0";
  char b[64];
  const auto r = std::to_chars(b, b + sizeof b, v);
  return std::string(b, r.ptr);
}
// v.toFixed(n) : à égalité exacte, on s'éloigne de zéro (printf choisirait le chiffre pair)
inline std::string fixe(double v, int n) {
  if (v == 0) v = 0.0;  // (-0).toFixed(n) s'écrit sans signe
  char b[512];
  std::snprintf(b, sizeof b, "%.*f", n + 40, v);
  const std::string s = b;
  const size_t pt = s.find('.');
  bool egalite = s[pt + 1 + n] == '5';
  for (size_t i = pt + 2 + n; egalite && i < s.size(); i++) egalite = s[i] == '0';
  const double w = egalite ? std::nextafter(v, v > 0 ? std::numeric_limits<double>::infinity() : -std::numeric_limits<double>::infinity()) : v;
  std::snprintf(b, sizeof b, "%.*f", n, w);
  return b;
}
// +v.toFixed(n)
inline double arrondi(double v, int n) { return std::strtod(fixe(v, n).c_str(), nullptr); }
// +texte : "" vaut 0, ce qui n'est pas un nombre vaut NaN
inline double nombre(const std::string& s) {
  size_t i = 0, f = s.size();
  while (i < f && (s[i] == ' ' || s[i] == '\t')) i++;
  while (f > i && (s[f - 1] == ' ' || s[f - 1] == '\t')) f--;
  if (i == f) return 0;
  const std::string t = s.substr(i, f - i);
  char* fin = nullptr;
  const double v = std::strtod(t.c_str(), &fin);
  return *fin ? std::numeric_limits<double>::quiet_NaN() : v;
}
}  // namespace js
