// Petits calculs partagés par dessin.cpp et traces.cpp, traduits du navigateur au dernier chiffre près.
#pragma once
#include <charconv>
#include <cmath>
#include <cstdio>
#include <string>

#include "maths_js.h"
#include "projet.h"

constexpr double PI_ = 3.141592653589793;

// Number.prototype.toFixed : le plus proche, et le plus grand en cas d'égalité exacte (printf choisit le pair)
inline double fixe(double v, int chiffres) {
  char b[512];
  snprintf(b, sizeof b, "%.*f", chiffres + 60, v);  // tous les chiffres exacts du nombre
  std::string t(b);
  const size_t coupe = t.size() - 60;
  const bool plus = t[coupe] >= '5';
  t.resize(coupe);
  if (plus) {
    for (size_t i = t.size(); i-- > 0;) {
      if (t[i] == '.' || t[i] == '-') continue;
      if (t[i] == '9') {
        t[i] = '0';
        if (i == 0 || (i == 1 && t[0] == '-')) t.insert(i, 1, '1');
        else continue;
        break;
      }
      t[i]++;
      break;
    }
  }
  double r = 0;
  cc::from_chars(t.data(), t.data() + t.size(), r);  // sans dépendre des réglages régionaux
  return r;
}

inline bool dansArc(double a, double a1, double a2) {  // angInArc
  const double T = PI_ * 2;
  double d = std::fmod(a2 - a1, T);
  if (d < 0) d += T;
  double r = std::fmod(a - a1, T);
  if (r < 0) r += T;
  return r <= d;
}

struct An {
  double a1, a2;
};
inline bool anglesArc2(const Esquisse& s, const Entite& e, An& o) {  // arcAngles
  const Pt* C = s.point(e.pc);
  const Pt* A = s.point(e.pa);
  const Pt* B = s.point(e.pb);
  if (!C || !A || !B) return false;
  const double a1 = m_atan2(A->y - C->y, A->x - C->x);
  if (e.pa == e.pb) {
    o = {a1, a1 + PI_ * 2};
    return true;
  }
  const double a2 = m_atan2(B->y - C->y, B->x - C->x);
  double d = std::fmod(a2 - a1, PI_ * 2);
  if (d <= 0) d += PI_ * 2;
  o = {a1, a1 + d};
  return true;
}

inline Contrainte contrainte(const char* type) {
  Contrainte c;
  c.type = type;
  return c;
}
