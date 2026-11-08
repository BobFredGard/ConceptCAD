#include "rendu_scene.h"

#include <zlib.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <functional>
#include <map>
#include <sstream>
#include <thread>

namespace {
const double PI = 3.14159265358979323846;

// ---- .hdr (Radiance) ----
bool lireRadiance(const std::string& o, int& w, int& h, std::vector<float>& rgb, std::string& erreur) {
  size_t p = 0;
  const auto ligne = [&]() {
    size_t f = o.find('\n', p);
    if (f == std::string::npos) f = o.size();
    std::string l = o.substr(p, f - p);
    p = std::min(o.size(), f + 1);
    return l;
  };
  std::string l = ligne();
  if (l.rfind("#?", 0) != 0) {
    erreur = "ce n'est pas un fichier .hdr";
    return false;
  }
  while (p < o.size() && !(l = ligne()).empty()) {
  }
  l = ligne();
  char s1 = 0, a1 = 0, s2 = 0, a2 = 0;
  if (sscanf(l.c_str(), "%c%c %d %c%c %d", &s1, &a1, &h, &s2, &a2, &w) != 6 || a1 != 'Y' || a2 != 'X' || w <= 0 || h <= 0 || w > 32768 || h > 32768) {
    erreur = "taille d'image non reconnue";
    return false;
  }
  rgb.assign(3 * static_cast<size_t>(w) * h, 0.f);
  std::vector<unsigned char> ligneRgbe(4 * static_cast<size_t>(w));
  for (int yy = 0; yy < h; yy++) {
    const int y = s1 == '-' ? yy : h - 1 - yy;
    if (p + 4 > o.size()) {
      erreur = "fichier tronqué";
      return false;
    }
    const unsigned char* d = reinterpret_cast<const unsigned char*>(o.data()) + p;
    if (w >= 8 && w < 32768 && d[0] == 2 && d[1] == 2 && ((d[2] << 8) | d[3]) == w) {
      p += 4;
      for (int c = 0; c < 4; c++) {
        int x = 0;
        while (x < w) {
          if (p >= o.size()) {
            erreur = "fichier tronqué";
            return false;
          }
          int n = static_cast<unsigned char>(o[p++]);
          if (n > 128) {
            n -= 128;
            if (p >= o.size() || x + n > w) {
              erreur = "fichier abîmé";
              return false;
            }
            const unsigned char v = static_cast<unsigned char>(o[p++]);
            for (int i = 0; i < n; i++) ligneRgbe[4 * static_cast<size_t>(x++) + c] = v;
          } else {
            if (p + n > o.size() || x + n > w || n == 0) {
              erreur = "fichier abîmé";
              return false;
            }
            for (int i = 0; i < n; i++) ligneRgbe[4 * static_cast<size_t>(x++) + c] = static_cast<unsigned char>(o[p++]);
          }
        }
      }
    } else {
      if (p + 4 * static_cast<size_t>(w) > o.size()) {
        erreur = "fichier tronqué";
        return false;
      }
      memcpy(ligneRgbe.data(), o.data() + p, 4 * static_cast<size_t>(w));
      p += 4 * static_cast<size_t>(w);
    }
    float* s = rgb.data() + 3 * static_cast<size_t>(y) * w;
    for (int x = 0; x < w; x++) {
      const unsigned char* q = &ligneRgbe[4 * static_cast<size_t>(x)];
      if (q[3]) {
        const float f = static_cast<float>(std::ldexp(1.0, q[3] - 136));
        s[3 * x] = q[0] * f, s[3 * x + 1] = q[1] * f, s[3 * x + 2] = q[2] * f;
      }
    }
  }
  return true;
}

// ---- .exr (OpenEXR) : lignes sans compression ou en ZIP ----
float demiVersFlottant(uint16_t v) {
  const int s = (v >> 15) & 1, e = (v >> 10) & 31, m = v & 1023;
  double r;
  if (e == 0) r = std::ldexp(static_cast<double>(m), -24);
  else if (e == 31) r = 0;  // infini ou non-nombre : rien à éclairer
  else r = std::ldexp(1.0 + m / 1024.0, e - 15);
  return static_cast<float>(s ? -r : r);
}

bool lireExr(const std::string& o, int& w, int& h, std::vector<float>& rgb, std::string& erreur) {
  const auto lu32 = [&](size_t p) {
    int32_t v;
    memcpy(&v, o.data() + p, 4);
    return v;
  };
  if (o.size() < 8 || lu32(0) != 20000630) {
    erreur = "ce n'est pas un fichier .exr";
    return false;
  }
  if (lu32(4) & 0x200) {
    erreur = "image .exr en tuiles : enregistrez-la en .hdr";
    return false;
  }
  size_t p = 8;
  struct Canal {
    std::string nom;
    int type;
  };
  std::vector<Canal> canaux;
  int comp = -1, x0 = 0, y0 = 0, x1 = -1, y1 = -1;
  while (p < o.size() && o[p]) {
    const std::string nom = o.c_str() + p;
    p += nom.size() + 1;
    const std::string type = o.c_str() + p;
    p += type.size() + 1;
    if (p + 4 > o.size()) break;
    const int n = lu32(p);
    p += 4;
    if (n < 0 || p + n > o.size()) break;
    if (nom == "channels") {
      size_t q = p;
      while (q < p + n && o[q]) {
        Canal c;
        c.nom = o.c_str() + q;
        q += c.nom.size() + 1;
        c.type = lu32(q);
        q += 16;
        canaux.push_back(c);
      }
    } else if (nom == "compression") comp = static_cast<unsigned char>(o[p]);
    else if (nom == "dataWindow") x0 = lu32(p), y0 = lu32(p + 4), x1 = lu32(p + 8), y1 = lu32(p + 12);
    p += n;
  }
  p++;
  w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (w <= 0 || h <= 0 || w > 32768 || h > 32768 || canaux.empty()) {
    erreur = "en-tête .exr non reconnu";
    return false;
  }
  if (comp != 0 && comp != 2 && comp != 3) {
    erreur = "compression .exr non lue (seules « aucune » et ZIP le sont) : enregistrez l'image en .hdr";
    return false;
  }
  const int parBloc = comp == 3 ? 16 : 1, blocs = (h + parBloc - 1) / parBloc;
  rgb.assign(3 * static_cast<size_t>(w) * h, 0.f);
  size_t tailleLigne = 0;
  for (const Canal& c : canaux) tailleLigne += static_cast<size_t>(w) * (c.type == 1 ? 2 : 4);
  std::vector<unsigned char> brut(tailleLigne * parBloc), inter(tailleLigne * parBloc);
  for (int b = 0; b < blocs; b++) {
    if (p + 8 * static_cast<size_t>(b) + 8 > o.size()) {
      erreur = "fichier tronqué";
      return false;
    }
    int64_t pos;
    memcpy(&pos, o.data() + p + 8 * static_cast<size_t>(b), 8);
    if (pos < 0 || static_cast<size_t>(pos) + 8 > o.size()) {
      erreur = "fichier tronqué";
      return false;
    }
    const int yBloc = lu32(pos) - y0;
    const int taille = lu32(pos + 4);
    const int nl = std::min(parBloc, h - yBloc);
    if (yBloc < 0 || nl <= 0 || taille < 0 || static_cast<size_t>(pos) + 8 + taille > o.size()) {
      erreur = "fichier abîmé";
      return false;
    }
    const size_t attendu = tailleLigne * nl;
    const unsigned char* d = reinterpret_cast<const unsigned char*>(o.data()) + pos + 8;
    if (static_cast<size_t>(taille) >= attendu) memcpy(brut.data(), d, attendu);  // le bloc n'a pas pu être compressé
    else {
      uLongf sortie = static_cast<uLongf>(attendu);
      if (uncompress(inter.data(), &sortie, d, taille) != Z_OK || sortie != attendu) {
        erreur = "décompression .exr impossible";
        return false;
      }
      for (size_t i = 1; i < attendu; i++) inter[i] = static_cast<unsigned char>(inter[i - 1] + inter[i] - 128);
      size_t a = 0, m = (attendu + 1) / 2;
      for (size_t i = 0; i < attendu; i++) brut[i] = (i & 1) ? inter[m++] : inter[a++];
    }
    size_t q = 0;
    for (int l = 0; l < nl; l++) {
      float* s = rgb.data() + 3 * static_cast<size_t>(yBloc + l) * w;
      for (const Canal& c : canaux) {
        const int k = c.nom == "R" ? 0 : c.nom == "G" ? 1 : c.nom == "B" ? 2 : c.nom == "Y" ? 3 : -1;
        const size_t pas = c.type == 1 ? 2 : 4;
        for (int x = 0; x < w; x++, q += pas) {
          if (k < 0) continue;
          float v = 0;
          if (c.type == 1) {
            uint16_t u;
            memcpy(&u, &brut[q], 2);
            v = demiVersFlottant(u);
          } else if (c.type == 2) memcpy(&v, &brut[q], 4);
          else {
            uint32_t u;
            memcpy(&u, &brut[q], 4);
            v = static_cast<float>(u);
          }
          if (k == 3) s[3 * x] = s[3 * x + 1] = s[3 * x + 2] = v;
          else s[3 * x + k] = v;
        }
      }
    }
  }
  return true;
}

// rdHdriDir : pixel de l'image → direction du monde, Z en haut
std::array<double, 3> directionImage(double u, double v) {
  const double th = (u - 0.5) * 2 * PI, ph = v * PI;
  const double x = std::sin(ph) * std::cos(th), y = std::cos(ph), z = std::sin(ph) * std::sin(th);
  return {x, -z, y};
}

// ---- Les bruits périodiques (src/98-rendu-surface.js) ----
double sfHash(int i, int j, int s) {
  uint32_t h = static_cast<uint32_t>(i) * 374761393u + static_cast<uint32_t>(j) * 668265263u + static_cast<uint32_t>(s) * 1442695041u;
  h = (h ^ (h >> 13)) * 1274126177u;
  h ^= h >> 16;
  return h / 4294967296.0;
}
double modp(double a, double p) { return std::fmod(std::fmod(a, p) + p, p); }
double sfNoise(double x, double y, double px, double py, int s) {
  const double i = std::floor(x), j = std::floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const int i0 = static_cast<int>(modp(i, px)), i1 = static_cast<int>(modp(i + 1, px)), j0 = static_cast<int>(modp(j, py)), j1 = static_cast<int>(modp(j + 1, py));
  const double a = sfHash(i0, j0, s), b = sfHash(i1, j0, s), c = sfHash(i0, j1, s), d = sfHash(i1, j1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
double sfFbm(double x, double y, double px, double py, int s) { return sfNoise(x, y, px, py, s) * 0.6 + sfNoise(x * 2, y * 2, px * 2, py * 2, s + 1) * 0.3 + sfNoise(x * 4, y * 4, px * 4, py * 4, s + 2) * 0.1; }
double sfTri(double x) { return std::abs(x - std::floor(x) - 0.5) * 2; }

using C = std::array<double, 3>;
using Gen = std::function<C(double u, double v, double T, int x, int y)>;

double sN(double u, double v, double c, int s) { return sfNoise(u * c, v * c, c, c, s); }
double sF(double u, double v, double c, int s) { return sfFbm(u * c, v * c, c, c, s); }
double sA(double u, double v, double cx, double cy, int s) { return sfNoise(u * cx, v * cy, cx, cy, s); }
C sK(const C& c, double k) { return {c[0] * k, c[1] * k, c[2] * k}; }
C sMix(const C& a, const C& b, double t) { return {a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t}; }
struct Cellule {
  double d1 = 9, d2 = 9, h = 0;
};
Cellule sCell(double u, double v, int c, int s) {
  const double x = u * c, y = v * c, i = std::floor(x), j = std::floor(y);
  Cellule R;
  for (int dj = -1; dj <= 1; dj++)
    for (int di = -1; di <= 1; di++) {
      const int a = static_cast<int>(modp(i + di, c)), b = static_cast<int>(modp(j + dj, c));
      const double d = std::hypot(i + di + sfHash(a, b, s) - x, j + dj + sfHash(a, b, s + 1) - y);
      if (d < R.d1) {
        R.d2 = R.d1;
        R.d1 = d;
        R.h = sfHash(a, b, s + 2);
      } else if (d < R.d2) R.d2 = d;
    }
  return R;
}
C sLames(double u, double v, int n, const C& c, int s) {
  const double ld = std::floor(v * n), vv = v * n - ld;
  const int l = static_cast<int>(ld);
  const double du = std::fmod(u + sfHash(l, 0, s + 7), 1.0);
  const double cerne = sfTri(vv * 9 + (sfFbm(u * 8, vv * 2 + l * 3.1, 8, 1e6, s + l) - 0.5) * 3), trait = sfNoise(u * 6, vv * 60, 6, 1e6, s + 20 + l);
  const double t = 0.8 + 0.14 * cerne * cerne + 0.1 * (trait - 0.5) + (sfHash(l, 0, s + 1) - 0.5) * 0.2;
  return sK(c, t * (vv < 0.012 || vv > 0.988 || du < 0.002 || du > 0.998 ? 0.35 : 1));
}
C sChevrons(double u, double v, const C& c, int s) {
  const double xx = u * 4;
  const int col = static_cast<int>(std::floor(xx));
  const double fx = xx - col, w = v * 8 + (col % 2 ? fx : 1 - fx), rowd = std::floor(w), fw = w - rowd;
  const int id = static_cast<int>(modp(rowd, 8));
  const double t = 0.8 + 0.12 * sfNoise(fx * 5, fw * 30, 1e6, 1e6, s + col * 11 + id) + (sfHash(col, id, s) - 0.5) * 0.22;
  return sK(c, t * (fw < 0.03 || fw > 0.97 || fx < 0.01 || fx > 0.99 ? 0.4 : 1));
}
C sCarr(double u, double v, int nx, int ny, double dec, double jx, double jy, const C& jc, const std::function<C(int, int, double, double)>& fc) {
  const double yy = v * ny, jd = std::floor(yy), fy = yy - jd;
  const int j = static_cast<int>(jd);
  const double xx = u * nx + (j % 2 ? dec : 0), fx = xx - std::floor(xx);
  const int i = static_cast<int>(modp(std::floor(xx), nx));
  if (fx < jx || fx > 1 - jx || fy < jy || fy > 1 - jy) return jc;
  return fc(i, j, fx, fy);
}
C sTisse(double u, double v, int n, const C& a, const C& b, bool serge = false) {
  const double X = u * n, Y = v * n;
  const int i = static_cast<int>(std::floor(X)), j = static_cast<int>(std::floor(Y));
  const double fx = X - i, fy = Y - j;
  const bool top = serge ? (i + j) % 4 < 2 : (i + j) % 2 == 0;
  const double ombre = 0.62 + 0.38 * std::sin(PI * (top ? fx : fy));
  return sK(top ? a : b, ombre * (0.94 + 0.12 * sfHash(top ? i : j, top ? 0 : 1, 77)));
}
C sTartan(double t, const std::vector<std::pair<double, C>>& B) {
  double c = 0;
  for (const auto& q : B) {
    c += q.first;
    if (t * 16 < c) return q.second;
  }
  return B.back().second;
}
C sLuxe(double u, double v, const C& c, int s) { return sK(c, 0.72 + 0.56 * sF(u, v, 5, s) + 0.1 * (sN(u, v, 256, s + 5) - 0.5)); }
C sPaillette(int x, int y, int s, const C& c, double f) {
  const double h = sfHash(x, y, s);
  return h > 1 - f ? sMix(c, {255, 255, 255}, 0.55) : h < f ? sK(c, 0.72) : c;
}
Gen sMet(const C& c, int s) {
  return [c, s](double u, double v, double, int x, int y) { return sPaillette(x, y, s, sK(c, 0.92 + 0.16 * sF(u, v, 4, s + 1)), 0.03); };
}
Gen sUni(const C& c, int s, double a = 0.015) {
  return [c, s, a](double u, double v, double, int, int) { return sK(c, 1 + a * (sF(u, v, 6, s) - 0.5)); };
}
Gen sNacre(const C& a, const C& b, int s) {
  return [a, b, s](double u, double v, double, int x, int y) { return sPaillette(x, y, s, sMix(a, b, std::min(1.0, std::max(0.0, sF(u, v, 5, s + 1) * 2 - 0.5))), 0.015); };
}
Gen sLed(int pas, const std::function<C(int, int)>& coul, double rayon, const C& fond) {
  return [=](double u, double v, double, int, int) {
    const double X = u * pas, Y = v * pas;
    const int i = static_cast<int>(std::floor(X)), j = static_cast<int>(std::floor(Y));
    const double d = std::hypot(X - i - 0.5, Y - j - 0.5);
    const double coeur = d < rayon ? 1 : std::exp(-(d - rayon) * (d - rayon) * 40) * 0.55;
    return sMix(fond, coul(i, j), coeur);
  };
}
std::function<C(int, int)> fixe(const C& c) {
  return [c](int, int) { return c; };
}
double grille(double u, double v, double T, double p) {
  const double X = u * T, Y = v * T;
  return std::min(std::min(std::fmod(X, p), p - std::fmod(X, p)), std::min(std::fmod(Y, p), p - std::fmod(Y, p)));
}

struct Def {
  SupportRendu s;
  Gen g;
};
struct Tenue {
  double r, m, cc, k, b;
};
const Tenue MATE{0.92, 0, 0, 0, 0}, SATIN{0.4, 0, 0.3, 0.35, 0.012}, BRILLANTE{0.08, 0, 1, 0.9, 0}, METALLISE{0.32, 0.45, 1, 0.7, 0}, NACRE{0.2, 0, 1, 0.75, 0.004};

const std::vector<Def>& catalogue() {
  static const std::vector<Def> L = [] {
    std::vector<Def> D;
    const auto a = [&D](const char* k, const wchar_t* n, const wchar_t* f, double t, double r, double m, double cc, double kk, double b, double em, Gen g) { D.push_back({SupportRendu{k, n, f, t, r, m, cc, kk, b, em}, std::move(g)}); };
    const auto p = [&a](const char* k, const wchar_t* n, double t, const Tenue& q, Gen g) { a(k, n, L"Peintures", t, q.r, q.m, q.cc, q.k, q.b, 1, std::move(g)); };
    const wchar_t* PB = L"Pierre et béton";
    // Les quatre premiers : leur tuile suit la taille réelle (rdSupTex)
    a("beton", L"Béton", PB, 400, 0.85, 0, 0, 1, 0, 1, [](double u, double v, double T, int, int) {
      const double c1 = std::round(T / 60), c2 = std::round(T / 6), n = sfFbm(u * c1, v * c1, c1, c1, 31) * 0.7 + sfNoise(u * c2, v * c2, c2, c2, 32) * 0.3, q = std::round(T / 1.2), pr = sfNoise(u * T / 1.2, v * T / 1.2, q, q, 33);
      const double g = 150 + (n - 0.5) * 55 - (pr > 0.93 ? 28 : 0);
      return C{g, g * 0.98, g * 0.95};
    });
    a("marbre", L"Marbre", PB, 500, 0.2, 0, 0, 1, 0, 1, [](double u, double v, double T, int, int) {
      const double c = std::round(T / 90), w = sfFbm(u * c, v * c, c, c, 51) * 2.2, vein = std::pow(sfTri(u * 3 + v * 2 + w), 6);
      const double g = 232 - vein * 120 + (sfNoise(u * c * 4, v * c * 4, c * 4, c * 4, 52) - 0.5) * 14;
      return C{g, g * 0.99, g * 0.97};
    });
    a("beton2", L"Béton sombre", PB, 400, 0.8, 0, 0, 0.25, 0.012, 1, [](double u, double v, double, int, int) {
      const double n = sF(u, v, 7, 131) * 0.7 + sN(u, v, 64, 134) * 0.3, q = sN(u, v, 320, 135), c = 78 + (n - 0.5) * 40 - (q > 0.93 ? 16 : 0);
      return C{c, c, c * 1.02};
    });
    a("marbreNoir", L"Marbre noir", PB, 500, 0.15, 0, 1, 1, 0, 1, [](double u, double v, double, int, int) {
      const double w = sF(u, v, 6, 141) * 2.2, f = std::pow(sfTri(u * 3 + v * 2 + w), 14), c = 18 + f * 205 + (sN(u, v, 32, 142) - 0.5) * 6;
      return C{c, c, c * 1.02};
    });
    a("ardoise", L"Ardoise", PB, 500, 0.75, 0, 0, 0.2, 0.015, 1, [](double u, double v, double, int, int) {
      const double n = sA(u, v, 6, 64, 151) * 0.6 + sF(u, v, 8, 152) * 0.4, c = 46 + (n - 0.5) * 42;
      return C{c, c * 1.05, c * 1.14};
    });
    a("granit", L"Granit", PB, 200, 0.3, 0, 0.5, 0.6, 0, 1, [](double u, double v, double, int x, int y) {
      const double h = sfHash(x >> 1, y >> 1, 161), n = sN(u, v, 128, 162), c = h > 0.8 ? 205 : h < 0.25 ? 38 : 125 + (n - 0.5) * 50;
      return C{c, c * 0.98, c * 0.97};
    });
    a("granitNoir", L"Granit noir (marbre de contrôle)", PB, 200, 0.12, 0, 1, 1, 0, 1, [](double u, double v, double, int x, int y) {
      const double h = sfHash(x >> 1, y >> 1, 171), c = h > 0.965 ? 130 : h > 0.86 ? 56 : 20 + sN(u, v, 128, 172) * 12;
      return C{c, c, c * 1.05};
    });
    a("terrazzo", L"Terrazzo", PB, 300, 0.25, 0, 1, 0.6, 0, 1, [](double u, double v, double, int, int) -> C {
      const Cellule A = sCell(u, v, 48, 181), B = sCell(u, v, 20, 185);
      if (B.d2 - B.d1 > 0.3 && B.d1 < 0.42) return sMix({120, 84, 66}, {208, 190, 168}, B.h);
      if (A.d2 - A.d1 > 0.14 && A.d1 < 0.38) return A.h > 0.66 ? C{64, 68, 74} : A.h > 0.33 ? C{176, 126, 100} : C{232, 228, 220};
      const double c = 206 + (sF(u, v, 8, 189) - 0.5) * 12;
      return {c, c * 0.98, c * 0.94};
    });
    a("travertin", L"Travertin", PB, 600, 0.55, 0, 0, 0.3, 0.012, 1, [](double u, double v, double, int, int) {
      const double n = sA(u, v, 6, 48, 191), t = sfTri(v * 12 + (sF(u, v, 4, 192) - 0.5) * 1.4), q = sA(u, v, 32, 128, 194);
      return sK({222, 202, 170}, (0.86 + 0.1 * t + 0.08 * (n - 0.5)) * (q > 0.86 ? 0.72 : 1));
    });
    a("sable", L"Sable", PB, 300, 1, 0, 0, 0, 0, 1, [](double u, double v, double, int x, int y) {
      const double q = sfTri(v * 18 + (sF(u, v, 4, 201) - 0.5) * 3);
      return sPaillette(x, y, 202, sK({214, 186, 138}, 0.88 + 0.14 * q + (sN(u, v, 256, 203) - 0.5) * 0.1), 0.05);
    });
    a("asphalte", L"Asphalte", PB, 200, 0.95, 0, 0, 0, 0, 1, [](double, double, double, int x, int y) {
      const double h = sfHash(x >> 1, y >> 1, 211), c = h > 0.9 ? 108 : h > 0.5 ? 56 : 34;
      return C{c, c, c};
    });
    const wchar_t* BO = L"Bois";
    a("bois", L"Plateau de bois", BO, 600, 0.45, 0, 0, 1, 0, 1, [](double u, double v, double T, int, int) {
      const double ld = std::floor(v * 5), vv = v * 5 - ld;
      const int lame = static_cast<int>(ld);
      const double cw = std::round(T / 80), cs = std::round(T / 3);
      const double cerne = sfTri(((vv * 120) + (sfFbm(u * cw, vv * 2 + lame * 3.1, cw, 1e6, 40 + lame) - 0.5) * 40) / 11);
      const double trait = sfNoise(u * cs * 0.04, vv * 120 / 0.7, std::max(1.0, std::round(cs * 0.04)), 1e6, 44 + lame);
      const double t = 0.8 + 0.12 * std::pow(cerne, 2) + 0.08 * (trait - 0.5) + (sfHash(lame, 0, 41) - 0.5) * 0.16;
      const double joint = vv < 0.012 || vv > 0.988 ? 0.35 : 1;
      return C{190 * t * joint, 138 * t * joint, 92 * t * joint};
    });
    a("noyer", L"Noyer", BO, 720, 0.4, 0, 0.5, 0.6, 0, 1, [](double u, double v, double, int, int) { return sLames(u, v, 6, {112, 74, 50}, 221); });
    a("chene", L"Chêne clair", BO, 800, 0.5, 0, 0, 0.4, 0.008, 1, [](double u, double v, double, int, int) { return sLames(u, v, 4, {214, 178, 130}, 231); });
    a("hetre", L"Établi en hêtre", BO, 320, 0.55, 0, 0, 0.25, 0.012, 1, [](double u, double v, double, int, int) { return sLames(u, v, 8, {220, 180, 136}, 241); });
    a("wenge", L"Wengé", BO, 600, 0.35, 0, 0.6, 0.7, 0, 1, [](double u, double v, double, int, int) { return sLames(u, v, 5, {70, 48, 38}, 251); });
    a("chevrons", L"Parquet à chevrons", BO, 640, 0.35, 0, 0.6, 0.6, 0, 1, [](double u, double v, double, int, int) { return sChevrons(u, v, {186, 136, 90}, 261); });
    const wchar_t* CA = L"Carrelage et construction";
    a("brique", L"Brique", CA, 480, 0.9, 0, 0, 0, 0, 1, [](double u, double v, double, int, int) {
      return sCarr(u, v, 2, 8, 0.5, 0.02, 0.08, {150, 144, 134}, [&](int i, int j, double, double) {
        const double b = sfHash(i, static_cast<int>(modp(j, 8)), 271);
        return sK(sMix({142, 62, 42}, {176, 92, 62}, b), 0.9 + 0.2 * sF(u, v, 16, 272));
      });
    });
    a("metro", L"Carrelage métro", CA, 600, 0.1, 0, 1, 0.8, 0, 1, [](double u, double v, double, int, int) {
      return sCarr(u, v, 4, 8, 0.5, 0.012, 0.024, {148, 148, 146}, [&](int i, int j, double, double) {
        const double c = 238 + (sfHash(i, static_cast<int>(modp(j, 8)), 281) - 0.5) * 14;
        return C{c, c, c * 0.99};
      });
    });
    a("damier", L"Damier noir et blanc", CA, 400, 0.12, 0, 1, 0.9, 0, 1, [](double u, double v, double, int, int) {
      return sCarr(u, v, 4, 4, 0, 0.006, 0.006, {80, 80, 80}, [&](int i, int j, double, double) {
        const double w = sF(u, v, 8, 291);
        return (i + j) % 2 ? sK({38, 38, 42}, 0.8 + 0.4 * w) : sK({236, 234, 228}, 0.92 + 0.1 * w);
      });
    });
    a("ciment", L"Carreaux de ciment", CA, 400, 0.5, 0, 0, 0.3, 0.012, 1, [](double u, double v, double, int, int) {
      return sCarr(u, v, 4, 4, 0, 0.008, 0.008, {176, 170, 158}, [](int, int, double fx, double fy) -> C {
        const double r = std::hypot(fx - 0.5, fy - 0.5), l = std::abs(fx - 0.5) + std::abs(fy - 0.5), q = std::min({std::hypot(fx, fy), std::hypot(1 - fx, fy), std::hypot(fx, 1 - fy), std::hypot(1 - fx, 1 - fy)});
        return r < 0.13 ? C{188, 92, 62} : l < 0.42 ? C{46, 78, 102} : q < 0.2 ? C{46, 78, 102} : C{226, 216, 194};
      });
    });
    const wchar_t* ME = L"Métal";
    a("tole", L"Tôle larmée", ME, 120, 0.4, 0.5, 0, 0.45, 0.012, 1, [](double u, double v, double, int, int) {
      const double X = u * 4, Y = v * 4;
      const int i = static_cast<int>(std::floor(X)), j = static_cast<int>(std::floor(Y)), s = (i + j) % 2 ? 1 : -1;
      const double aa = X - i - 0.5, b = Y - j - 0.5, q1 = (aa + s * b) * std::sqrt(0.5), q2 = (aa - s * b) * std::sqrt(0.5), d = std::hypot(q1 / 0.42, q2 / 0.1);
      const C n = sK({136, 140, 146}, 0.94 + 0.12 * sF(u, v, 8, 301));
      return d < 1 ? sK(n, 1.28 - 0.5 * d + (q1 + q2) * 0.5) : d < 1.2 ? sK(n, 0.7) : n;
    });
    a("acier", L"Acier brossé", ME, 200, 0.35, 0.6, 0, 0.5, 0.018, 1, [](double u, double v, double, int, int) {
      const double c = 146 + (sA(u, v, 6, 512, 311) - 0.5) * 44 + (sA(u, v, 16, 128, 312) - 0.5) * 16;
      return C{c, c * 1.01, c * 1.03};
    });
    a("laiton", L"Laiton brossé", ME, 200, 0.3, 0.6, 0, 0.55, 0.015, 1, [](double u, double v, double, int, int) { return sK({200, 164, 86}, 0.92 + 0.3 * (sA(u, v, 6, 512, 321) - 0.5)); });
    a("cuivre", L"Cuivre brossé", ME, 200, 0.3, 0.6, 0, 0.55, 0.015, 1, [](double u, double v, double, int, int) { return sK({190, 112, 76}, 0.92 + 0.3 * (sA(u, v, 6, 512, 331) - 0.5)); });
    a("perfore", L"Tôle perforée", ME, 100, 0.4, 0.5, 0, 0.3, 0.015, 1, [](double u, double v, double, int, int) {
      const double yy = v * 10, jd = std::floor(yy);
      const int j = static_cast<int>(jd);
      const double xx = u * 10 + (j % 2 ? 0.5 : 0), d = std::hypot(xx - std::floor(xx) - 0.5, yy - jd - 0.5);
      return d < 0.3 ? C{14, 14, 16} : d < 0.34 ? C{86, 88, 92} : sK({168, 171, 176}, 0.95 + 0.1 * sA(u, v, 6, 256, 341));
    });
    p("pMateNoir", L"Peinture mate noire", 200, MATE, sUni({30, 30, 32}, 351));
    p("pMateBlanc", L"Peinture mate blanche", 200, MATE, sUni({232, 231, 226}, 352));
    p("pMateRouge", L"Peinture mate rouge", 200, MATE, sUni({164, 42, 36}, 353));
    p("pMateSauge", L"Peinture mate vert sauge", 200, MATE, sUni({132, 150, 124}, 354));
    p("pMateBleu", L"Peinture mate bleu nuit", 200, MATE, sUni({36, 52, 84}, 355));
    p("pSatinAnth", L"Peinture satinée anthracite", 200, SATIN, sUni({62, 66, 72}, 356));
    p("pSatinCreme", L"Peinture satinée crème", 200, SATIN, sUni({228, 216, 190}, 357));
    p("pBrilNoir", L"Laque noire brillante", 200, BRILLANTE, sUni({12, 12, 14}, 358, 0));
    p("pBrilBlanc", L"Laque blanche brillante", 200, BRILLANTE, sUni({240, 240, 238}, 359, 0));
    p("pBrilRouge", L"Laque rouge brillante", 200, BRILLANTE, sUni({176, 18, 22}, 360, 0));
    p("pBrilBleu", L"Laque bleue brillante", 200, BRILLANTE, sUni({16, 64, 150}, 361, 0));
    p("pMetArgent", L"Peinture métallisée argent", 100, METALLISE, sMet({176, 180, 186}, 362));
    p("pMetGraph", L"Peinture métallisée graphite", 100, METALLISE, sMet({70, 74, 80}, 363));
    p("pMetBleu", L"Peinture métallisée bleue", 100, METALLISE, sMet({34, 70, 136}, 364));
    p("pMetRouge", L"Peinture métallisée rouge", 100, METALLISE, sMet({146, 24, 32}, 365));
    p("pMetOr", L"Peinture pailletée or", 100, METALLISE, sMet({190, 150, 70}, 366));
    p("pNacre", L"Peinture nacrée blanche", 200, NACRE, sNacre({236, 232, 226}, {218, 226, 240}, 367));
    p("pNacreViolet", L"Peinture nacrée violette", 200, NACRE, sNacre({86, 44, 126}, {42, 70, 140}, 368));
    a("pMartele", L"Peinture martelée", L"Peintures", 100, 0.4, 0.3, 0.6, 0.45, 0.012, 1, [](double u, double v, double, int, int) { return sK({84, 104, 108}, 0.72 + 0.75 * sCell(u, v, 24, 369).d1); });
    a("pCraquele", L"Peinture craquelée", L"Peintures", 200, 0.85, 0, 0, 0, 0, 1, [](double u, double v, double, int, int) {
      const Cellule A = sCell(u, v, 28, 373);
      return A.d2 - A.d1 < 0.05 ? C{52, 42, 32} : sK({206, 190, 158}, 0.92 + 0.14 * A.h);
    });
    a("pEpoxy", L"Sol époxy d'atelier", L"Peintures", 300, 0.2, 0, 1, 0.7, 0, 1, [](double u, double v, double, int, int) -> C {
      const Cellule A = sCell(u, v, 64, 377);
      if (A.d1 < 0.2) return A.h > 0.66 ? C{230, 230, 226} : A.h > 0.33 ? C{36, 38, 42} : C{160, 164, 170};
      return sK({118, 124, 132}, 0.96 + 0.08 * sF(u, v, 6, 381));
    });
    const wchar_t* TX = L"Textiles";
    a("feutre", L"Feutre gris", TX, 100, 1, 0, 0, 0, 0, 1, [](double u, double v, double, int x, int y) { return sK({122, 124, 128}, 0.82 + 0.24 * sF(u, v, 16, 392) + (sfHash(x, y, 391) - 0.5) * 0.2); });
    a("lin", L"Toile de lin", TX, 64, 0.95, 0, 0, 0, 0, 1, [](double u, double v, double, int, int) { return sK(sTisse(u, v, 64, {208, 196, 172}, {194, 180, 154}), 0.94 + 0.12 * sA(u, v, 4, 64, 401)); });
    a("jute", L"Toile de jute", TX, 80, 1, 0, 0, 0, 0, 1, [](double u, double v, double, int, int) { return sK(sTisse(u, v, 32, {172, 136, 88}, {150, 114, 68}), 0.85 + 0.3 * sF(u, v, 16, 411)); });
    a("denim", L"Denim", TX, 48, 0.95, 0, 0, 0, 0, 1, [](double u, double v, double, int, int) { return sK(sTisse(u, v, 64, {46, 72, 116}, {192, 198, 206}, true), 0.88 + 0.24 * sA(u, v, 4, 32, 421)); });
    a("velRouge", L"Velours rouge", TX, 300, 1, 0, 0, 0, 0, 1, [](double u, double v, double, int, int) { return sLuxe(u, v, {132, 18, 34}, 431); });
    a("velNoir", L"Velours noir", TX, 300, 1, 0, 0, 0, 0, 1, [](double u, double v, double, int, int) { return sLuxe(u, v, {26, 26, 30}, 441); });
    a("velBleu", L"Velours bleu roi", TX, 300, 1, 0, 0, 0, 0, 1, [](double u, double v, double, int, int) { return sLuxe(u, v, {28, 48, 120}, 451); });
    a("soie", L"Soie ivoire", TX, 200, 0.35, 0, 0, 0.25, 0.02, 1, [](double u, double v, double, int, int) { return sK({234, 222, 196}, 0.82 + 0.3 * sF(u, v, 4, 461) + 0.05 * (sA(u, v, 4, 256, 464) - 0.5)); });
    a("tweed", L"Tweed", TX, 64, 1, 0, 0, 0, 0, 1, [](double u, double v, double, int x, int y) { return sPaillette(x, y, 471, sTisse(u, v, 64, {116, 104, 88}, {72, 78, 74}, true), 0.04); });
    a("tartan", L"Écossais", TX, 160, 0.95, 0, 0, 0, 0, 1, [](double u, double v, double, int, int) {
      static const std::vector<std::pair<double, C>> B = {{4, {28, 60, 44}}, {1, {20, 20, 28}}, {4, {24, 40, 88}}, {1, {20, 20, 28}}, {1, {176, 36, 36}}, {1, {20, 20, 28}}, {3, {28, 60, 44}}, {1, {210, 190, 110}}};
      return sTisse(u, v, 128, sTartan(u, B), sTartan(v, B), true);
    });
    a("moquette", L"Moquette", TX, 100, 1, 0, 0, 0, 0, 1, [](double u, double v, double, int, int) { return sK({104, 92, 84}, 0.62 + 0.5 * sN(u, v, 128, 481) + 0.22 * sF(u, v, 8, 482)); });
    a("alcantara", L"Alcantara", TX, 150, 1, 0, 0, 0, 0, 1, [](double u, double v, double, int x, int y) { return sK({54, 56, 60}, 0.82 + 0.34 * sF(u, v, 8, 491) + (sfHash(x, y, 492) - 0.5) * 0.14); });
    a("cuir", L"Cuir noir", TX, 100, 0.5, 0, 0.1, 0.2, 0.02, 1, [](double u, double v, double, int, int) {
      const Cellule A = sCell(u, v, 48, 501);
      const double c = A.d2 - A.d1 < 0.07 ? 16 : 30 + A.d1 * 18;
      return C{c, c, c * 1.02};
    });
    a("cuirFauve", L"Cuir fauve", TX, 100, 0.5, 0, 0.1, 0.2, 0.02, 1, [](double u, double v, double, int, int) {
      const Cellule A = sCell(u, v, 48, 505);
      return sK({150, 92, 52}, A.d2 - A.d1 < 0.07 ? 0.55 : 0.84 + 0.3 * A.d1);
    });
    a("carbone", L"Tissu de carbone", TX, 48, 0.22, 0, 1, 0.55, 0, 1, [](double u, double v, double, int, int) {
      const double X = u * 24, Y = v * 24;
      const int i = static_cast<int>(std::floor(X)), j = static_cast<int>(std::floor(Y));
      const bool top = (i + j) % 4 < 2;
      const double f = top ? X - i : Y - j, c = 18 + 44 * std::pow(std::sin(PI * f), 2) * (top ? 1 : 0.55);
      return C{c, c, c * 1.05};
    });
    const wchar_t* VE = L"Verres dépolis";
    a("verreDep", L"Verre dépoli", VE, 200, 0.5, 0, 0, 0.45, 0.03, 1, [](double u, double v, double, int x, int y) { return sK({222, 232, 232}, 0.96 + 0.05 * sF(u, v, 4, 511) + (sfHash(x, y, 512) - 0.5) * 0.03); });
    a("verreBleu", L"Verre dépoli bleuté", VE, 200, 0.5, 0, 0, 0.45, 0.03, 1, [](double u, double v, double, int x, int y) { return sK({172, 206, 226}, 0.96 + 0.06 * sF(u, v, 4, 521) + (sfHash(x, y, 522) - 0.5) * 0.03); });
    a("verreFume", L"Verre dépoli fumé", VE, 200, 0.45, 0, 0, 0.5, 0.025, 1, [](double u, double v, double, int x, int y) { return sK({62, 66, 70}, 0.94 + 0.1 * sF(u, v, 4, 531) + (sfHash(x, y, 532) - 0.5) * 0.05); });
    a("verreGivre", L"Verre givré", VE, 150, 0.55, 0, 0, 0.35, 0.035, 1, [](double u, double v, double, int, int) {
      const Cellule A = sCell(u, v, 32, 541);
      return sK({226, 236, 240}, 0.84 + 0.2 * std::min(1.0, A.d2 - A.d1) + 0.04 * sN(u, v, 128, 545));
    });
    a("verreStrie", L"Verre strié", VE, 120, 0.3, 0, 0.6, 0.45, 0.02, 1, [](double u, double v, double, int, int) {
      const double f = u * 24 - std::floor(u * 24);
      return sK({214, 228, 226}, 0.8 + 0.24 * std::sin(PI * f));
    });
    const wchar_t* LE = L"LED";
    a("ledBlanc", L"Matrice de LED blanches", LE, 160, 0.7, 0, 0, 0.15, 0, 2.5, sLed(16, fixe({255, 250, 236}), 0.14, {14, 14, 16}));
    a("ledRvb", L"Matrice de LED RVB", LE, 160, 0.7, 0, 0, 0.15, 0, 2.5, sLed(18, [](int i, int j) { return (i + j) % 3 == 0 ? C{255, 40, 40} : (i + j) % 3 == 1 ? C{40, 255, 70} : C{50, 90, 255}; }, 0.14, {10, 10, 12}));
    a("ledBleu", L"Matrice de LED bleues", LE, 160, 0.7, 0, 0, 0.15, 0, 2.5, sLed(16, fixe({50, 120, 255}), 0.14, {8, 10, 16}));
    a("ledAmbre", L"Matrice de LED ambre", LE, 160, 0.7, 0, 0, 0.15, 0, 2.5, sLed(16, fixe({255, 160, 40}), 0.14, {14, 10, 8}));
    a("ledBande", L"Bandeaux de LED", LE, 240, 0.7, 0, 0, 0.15, 0, 2, [](double, double v, double, int, int) {
      const double f = v * 6 - std::floor(v * 6), d = std::abs(f - 0.5);
      return sMix({18, 18, 22}, {255, 250, 236}, std::exp(-d * d * 220));
    });
    a("ledDalle", L"Dalle lumineuse", LE, 200, 0.5, 0, 0, 0.2, 0.03, 1.6, [](double u, double v, double, int, int) {
      const double c = 246 + 6 * sF(u, v, 4, 551);
      return C{c, c, c * 0.98};
    });
    a("ledNeon", L"Néons en grille", LE, 300, 0.7, 0, 0, 0.15, 0, 2, [](double u, double v, double, int, int) {
      const auto d = [](double q) {
        const double f = q * 3 - std::floor(q * 3);
        return std::abs(f - 0.5);
      };
      const double e = std::min(d(u), d(v));
      return sMix({12, 8, 20}, {255, 70, 220}, std::exp(-e * e * 700));
    });
    const wchar_t* AT = L"Atelier";
    a("tapis", L"Tapis de découpe", AT, 100, 0.7, 0, 0, 1, 0, 1, [](double u, double v, double T, int, int) -> C {
      const double X = u * T, Y = v * T, dx = std::min(std::fmod(X, 10.0), 10 - std::fmod(X, 10.0)), dy = std::min(std::fmod(Y, 10.0), 10 - std::fmod(Y, 10.0)), DX = std::min(std::fmod(X, 50.0), 50 - std::fmod(X, 50.0)), DY = std::min(std::fmod(Y, 50.0), 50 - std::fmod(Y, 50.0));
      const double n = (sfNoise(u * 40, v * 40, 40, 40, 61) - 0.5) * 10;
      if (std::min(DX, DY) < 0.35) return {222, 234, 226};
      if (std::min(dx, dy) < 0.18) return {150 + n, 196 + n, 170 + n};
      return {38 + n, 110 + n, 78 + n};
    });
    a("caoutchouc", L"Tapis caoutchouc strié", AT, 100, 0.75, 0, 0, 0.1, 0.02, 1, [](double u, double v, double, int, int) {
      const double c = 28 + 22 * std::pow(std::sin(PI * (v * 20 - std::floor(v * 20))), 2) + (sN(u, v, 64, 561) - 0.5) * 5;
      return C{c, c, c};
    });
    a("papier", L"Papier millimétré", AT, 100, 0.9, 0, 0, 0, 0, 1, [](double u, double v, double T, int, int) -> C {
      if (grille(u, v, T, 10) < 0.13) return {226, 120, 70};
      if (grille(u, v, T, 5) < 0.08) return {236, 160, 118};
      if (grille(u, v, T, 1) < 0.05) return {244, 206, 178};
      return {250, 246, 234};
    });
    a("planBleu", L"Plan bleu", AT, 100, 0.7, 0, 0, 0.05, 0, 1, [](double u, double v, double T, int, int) -> C {
      if (grille(u, v, T, 50) < 0.3) return {214, 228, 246};
      if (grille(u, v, T, 10) < 0.13) return {118, 156, 212};
      return sK({26, 70, 136}, 0.94 + 0.12 * sF(u, v, 8, 571));
    });
    a("kraft", L"Carton kraft", AT, 150, 0.9, 0, 0, 0, 0, 1, [](double u, double v, double, int x, int y) { return sPaillette(x, y, 581, sK({176, 132, 88}, 0.88 + 0.2 * sA(u, v, 8, 256, 582)), 0.02); });
    a("liege", L"Liège", AT, 120, 0.85, 0, 0, 0, 0, 1, [](double u, double v, double, int, int) {
      const Cellule A = sCell(u, v, 64, 591);
      return sK(sMix({146, 100, 62}, {206, 164, 112}, A.h), A.d2 - A.d1 < 0.06 ? 0.62 : 1);
    });
    return D;
  }();
  return L;
}
}  // namespace

std::shared_ptr<const ImageHdri> lireHdri(const std::wstring& chemin, std::string& erreur) {
  std::ifstream f(cheminFlux(chemin), std::ios::binary);
  if (!f) {
    erreur = "fichier introuvable";
    return nullptr;
  }
  std::stringstream t;
  t << f.rdbuf();
  const std::string o = t.str();
  int w = 0, h = 0;
  std::vector<float> src;
  const size_t pt = chemin.find_last_of(L'.');
  std::wstring ext = pt == std::wstring::npos ? L"" : chemin.substr(pt + 1);
  for (auto& c : ext) c = static_cast<wchar_t>(towlower(c));
  if (!(ext == L"exr" ? lireExr(o, w, h, src, erreur) : lireRadiance(o, w, h, src, erreur))) return nullptr;
  auto R = std::make_shared<ImageHdri>();
  R->chemin = chemin;
  const size_t bs = chemin.find_last_of(L"\\/");
  R->nom = chemin.substr(bs == std::wstring::npos ? 0 : bs + 1, pt == std::wstring::npos ? std::wstring::npos : pt - (bs == std::wstring::npos ? 0 : bs + 1));
  const int k = std::max(1, (w + 2047) / 2048);
  R->w = w / k, R->h = h / k;
  R->rgb.assign(3 * static_cast<size_t>(R->w) * R->h, 0.f);
  for (int y = 0; y < R->h; y++)
    for (int x = 0; x < R->w; x++) {
      double c[3] = {0, 0, 0};
      for (int j = 0; j < k; j++)
        for (int i = 0; i < k; i++) {
          const float* s = &src[3 * (static_cast<size_t>(y * k + j) * w + x * k + i)];
          for (int q = 0; q < 3; q++) c[q] += std::isfinite(s[q]) ? std::max(0.f, s[q]) : 0.f;
        }
      float* o2 = &R->rgb[3 * (static_cast<size_t>(y) * R->w + x)];
      for (int q = 0; q < 3; q++) o2[q] = static_cast<float>(c[q] / (k * k));
    }
  // Le soleil : le plus lumineux, lissé sur 4 × 4, s'il dépasse 30 fois la moyenne
  const auto lum = [&](int x, int y) {
    const float* p = &R->rgb[3 * (static_cast<size_t>(y) * R->w + x)];
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
  };
  double best = -1, bu = 0, bv = 0, somme = 0;
  for (int y = 0; y < R->h; y += 4)
    for (int x = 0; x < R->w; x += 4) {
      double l = 0;
      for (int j = 0; j < 4 && y + j < R->h; j++)
        for (int i = 0; i < 4 && x + i < R->w; i++) l += lum(x + i, y + j);
      l /= 16;
      somme += l;
      if (l > best) best = l, bu = (x + 2.0) / R->w, bv = (y + 2.0) / R->h;
    }
  const double moyenne = somme / ((R->w / 4.0) * (R->h / 4.0));
  if (best > 30 * moyenne) {
    R->soleil = true;
    R->su = bu, R->sv = bv, R->sl = best;
    const auto d = directionImage(bu, bv);
    const double sc = std::cos(4 * PI / 180);
    double E = 0;
    for (int y = 0; y < R->h; y++) {
      const double dO = (2 * PI / R->w) * (PI / R->h) * std::sin((y + 0.5) / R->h * PI);
      for (int x = 0; x < R->w; x++) {
        const auto q = directionImage((x + 0.5) / R->w, (y + 0.5) / R->h);
        if (q[0] * d[0] + q[1] * d[1] + q[2] * d[2] >= sc) E += lum(x, y) * dO;
      }
    }
    R->az = std::atan2(d[1], d[0]) * 180 / PI;
    R->el = std::asin(std::clamp(d[2], -1.0, 1.0)) * 180 / PI;
    R->E = E;
  }
  double g[3] = {0, 0, 0};
  long n = 0;
  for (int y = static_cast<int>(R->h * (0.5 + 5.0 / 180)); y < static_cast<int>(R->h * (0.5 + 35.0 / 180)); y++)
    for (int x = 0; x < R->w; x += 2) {
      const float* p = &R->rgb[3 * (static_cast<size_t>(y) * R->w + x)];
      for (int q = 0; q < 3; q++) g[q] += p[q];
      n++;
    }
  if (n)
    for (int q = 0; q < 3; q++) R->sol[q] = g[q] / n;
  return R;
}

const std::vector<SupportRendu>& supportsRendu() {
  static const std::vector<SupportRendu> L = [] {
    std::vector<SupportRendu> R;
    for (const Def& d : catalogue()) R.push_back(d.s);
    return R;
  }();
  return L;
}

const SupportRendu* supportRendu(const std::string& cle) {
  for (const SupportRendu& s : supportsRendu())
    if (cle == s.cle) return &s;
  return nullptr;
}

std::shared_ptr<const TuileSupport> tuileSupport(const std::string& cle, int n0) {
  static std::map<std::string, std::shared_ptr<const TuileSupport>> memo;
  if (!n0) {
    const auto it = memo.find(cle);
    if (it != memo.end()) return it->second;
  }
  const Def* d = nullptr;
  for (const Def& q : catalogue())
    if (cle == q.s.cle) d = &q;
  if (!d) return nullptr;
  auto R = std::make_shared<TuileSupport>();
  const int N = n0 ? n0 : 1024;
  R->n = N;
  R->t = d->s.t;
  R->rgb.resize(3 * static_cast<size_t>(N) * N);
  const auto ligne = [&](int y) {
    unsigned char* o = &R->rgb[3 * static_cast<size_t>(y) * N];
    for (int x = 0; x < N; x++) {
      const C c = d->g(static_cast<double>(x) / N, static_cast<double>(y) / N, d->s.t, x, y);
      for (int k = 0; k < 3; k++) o[3 * x + k] = static_cast<unsigned char>(std::clamp(std::lround(c[k]), 0L, 255L));
    }
  };
  const int nt = N < 128 ? 1 : std::max(1u, std::min(16u, std::thread::hardware_concurrency()));
  if (nt == 1) {
    for (int y = 0; y < N; y++) ligne(y);
  } else {
    std::vector<std::thread> T;
    for (int t = 0; t < nt; t++)
      T.emplace_back([&, t] {
        for (int y = t; y < N; y += nt) ligne(y);
      });
    for (auto& t : T) t.join();
  }
  if (!n0) memo[cle] = R;
  return R;
}
