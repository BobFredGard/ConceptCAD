#include "rendu_finition.h"

#include <algorithm>
#include <cmath>
#include <functional>
#include <thread>

namespace {
using V = std::array<float, 3>;

void parLignes(int h, const std::function<void(int)>& f) {
  const int n = std::max(1u, std::min(16u, std::thread::hardware_concurrency()));
  std::vector<std::thread> T;
  for (int t = 0; t < n; t++)
    T.emplace_back([&, t] {
      for (int y = t; y < h; y += n) f(y);
    });
  for (auto& t : T) t.join();
}

float rrt(float v) { return (v * (v + 0.0245786f) - 0.000090537f) / (v * (0.983729f * v + 0.4329510f) + 0.238081f); }
float clamp01(float v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
V aces(V c) {
  for (float& k : c) k *= 1.0f / 0.6f;
  // GLSL : mat3(colonnes) * c
  const float x = 0.59719f * c[0] + 0.35458f * c[1] + 0.04823f * c[2];
  const float y = 0.07600f * c[0] + 0.90834f * c[1] + 0.01566f * c[2];
  const float z = 0.02840f * c[0] + 0.13383f * c[1] + 0.83777f * c[2];
  const float a = rrt(x), b = rrt(y), d = rrt(z);
  return {clamp01(1.60475f * a - 0.53108f * b - 0.07367f * d), clamp01(-0.10208f * a + 1.10813f * b - 0.00605f * d), clamp01(-0.00327f * a - 0.07276f * b + 1.07602f * d)};
}
V tons(V c, int t) {
  if (t == 0) return aces(c);
  if (t == 1) return {clamp01(c[0] / (1 + c[0])), clamp01(c[1] / (1 + c[1])), clamp01(c[2] / (1 + c[2]))};
  if (t == 2) {
    for (float& k : c) {
      k = std::max(0.f, k - 0.004f);
      k = std::pow((k * (6.2f * k + 0.5f)) / (k * (6.2f * k + 1.7f) + 0.06f), 2.2f);
    }
    return c;
  }
  return {clamp01(c[0]), clamp01(c[1]), clamp01(c[2])};
}
float srgb(float c) {
  c = clamp01(c);
  return c < 0.0031308f ? c * 12.92f : 1.055f * std::pow(c, 1.0f / 2.4f) - 0.055f;
}
float linS(float c) { return c < 0.04045f ? c / 12.92f : std::pow((c + 0.055f) / 1.055f, 2.4f); }
float hashe(float x, float y) {
  float a = x * 0.1031f, b = y * 0.1031f, c = x * 0.1031f;
  a -= std::floor(a), b -= std::floor(b), c -= std::floor(c);
  const float d = a * (b + 33.33f) + b * (c + 33.33f) + c * (a + 33.33f);
  a += d, b += d, c += d;
  const float r = (a + b) * c;
  return r - std::floor(r);
}

struct Niveau {
  int w = 0, h = 0;
  std::vector<float> p;
};
void reduire(const Niveau& a, Niveau& b) {
  b.w = std::max(1, (a.w + 1) / 2), b.h = std::max(1, (a.h + 1) / 2);
  b.p.resize(4 * static_cast<size_t>(b.w) * b.h);
  parLignes(b.h, [&](int y) {
    for (int x = 0; x < b.w; x++)
      for (int k = 0; k < 4; k++) {
        float s = 0;
        for (int j = 0; j < 2; j++)
          for (int i = 0; i < 2; i++) {
            const int X = std::min(a.w - 1, 2 * x + i), Y = std::min(a.h - 1, 2 * y + j);
            s += a.p[4 * (static_cast<size_t>(Y) * a.w + X) + k];
          }
        b.p[4 * (static_cast<size_t>(y) * b.w + x) + k] = s / 4;
      }
  });
}
void flou(Niveau& n) {
  static const float P[5] = {0.0702703f, 0.3162162f, 0.2270270f, 0.3162162f, 0.0702703f};
  static const int D[5] = {-3, -1, 0, 1, 3};
  std::vector<float> t(n.p.size());
  parLignes(n.h, [&](int y) {
    for (int x = 0; x < n.w; x++)
      for (int k = 0; k < 4; k++) {
        float s = 0;
        for (int i = 0; i < 5; i++) s += P[i] * n.p[4 * (static_cast<size_t>(y) * n.w + std::clamp(x + D[i], 0, n.w - 1)) + k];
        t[4 * (static_cast<size_t>(y) * n.w + x) + k] = s;
      }
  });
  parLignes(n.h, [&](int y) {
    for (int x = 0; x < n.w; x++)
      for (int k = 0; k < 4; k++) {
        float s = 0;
        for (int i = 0; i < 5; i++) s += P[i] * t[4 * (static_cast<size_t>(std::clamp(y + D[i], 0, n.h - 1)) * n.w + x) + k];
        n.p[4 * (static_cast<size_t>(y) * n.w + x) + k] = s;
      }
  });
}
void lire(const Niveau& n, double u, double v, float* o) {
  const double X = u * n.w - 0.5, Y = v * n.h - 0.5;
  const int x0 = std::clamp(static_cast<int>(std::floor(X)), 0, n.w - 1), y0 = std::clamp(static_cast<int>(std::floor(Y)), 0, n.h - 1);
  const int x1 = std::min(n.w - 1, x0 + 1), y1 = std::min(n.h - 1, y0 + 1);
  const float fx = static_cast<float>(std::clamp(X - x0, 0.0, 1.0)), fy = static_cast<float>(std::clamp(Y - y0, 0.0, 1.0));
  for (int k = 0; k < 4; k++) {
    const float a = n.p[4 * (static_cast<size_t>(y0) * n.w + x0) + k], b = n.p[4 * (static_cast<size_t>(y0) * n.w + x1) + k];
    const float c = n.p[4 * (static_cast<size_t>(y1) * n.w + x0) + k], d = n.p[4 * (static_cast<size_t>(y1) * n.w + x1) + k];
    o[k] = (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  }
}
}  // namespace

void finir(const float* src, int w, int h, const Finition& o, std::vector<unsigned char>& sortie) {
  sortie.resize(4 * static_cast<size_t>(w) * h);
  const float* C = src;
  std::vector<float> debruit;
  if (o.den > 0.001) {
    // Filtre bilatéral : moyenne des voisins, coupée là où la couleur change franchement
    debruit.resize(4 * static_cast<size_t>(w) * h);
    const float sig = static_cast<float>(0.8 + 4.2 * o.den), thr = static_cast<float>(0.04 + 0.22 * o.den);
    const float is = 1 / (2 * sig * sig), it = 1 / (2 * thr * thr);
    parLignes(h, [&](int y) {
      for (int x = 0; x < w; x++) {
        const float* c0 = src + 4 * (static_cast<size_t>(y) * w + x);
        const float k0[3] = {c0[0] / (1 + c0[0]), c0[1] / (1 + c0[1]), c0[2] / (1 + c0[2])};
        float acc[4] = {0, 0, 0, 0}, z = 0;
        for (int j = -6; j <= 6; j++)
          for (int i = -6; i <= 6; i++) {
            const int r2 = i * i + j * j;
            if (r2 > 36) continue;
            const float* c = src + 4 * (static_cast<size_t>(std::clamp(y + j, 0, h - 1)) * w + std::clamp(x + i, 0, w - 1));
            const float a = c[0] / (1 + c[0]) - k0[0], b = c[1] / (1 + c[1]) - k0[1], d = c[2] / (1 + c[2]) - k0[2], da = c[3] - c0[3];
            const float q = std::exp(-r2 * is - (a * a + b * b + d * d + da * da) * it);
            for (int k = 0; k < 4; k++) acc[k] += q * c[k];
            z += q;
          }
        float* s = debruit.data() + 4 * (static_cast<size_t>(y) * w + x);
        for (int k = 0; k < 4; k++) s[k] = acc[k] / std::max(z, 1e-6f);
      }
    });
    C = debruit.data();
  }
  // Le halo : l'image exposée, réduite et floutée aux ¼, 1/16 et 1/64 de sa taille
  std::vector<Niveau> N;
  if (o.halo > 0.001) {
    Niveau base;
    base.w = w, base.h = h;
    base.p.assign(C, C + 4 * static_cast<size_t>(w) * h);
    for (size_t i = 0; i < base.p.size(); i += 4)
      for (int k = 0; k < 3; k++) base.p[i + k] *= static_cast<float>(o.expo);
    N.resize(7);
    N[0] = std::move(base);
    for (int i = 1; i <= 6; i++) {
      reduire(N[i - 1], N[i]);
      flou(N[i]);
    }
  }
  const float halo = o.halo > 0.001 ? static_cast<float>(o.halo * 0.4) : 0;
  const float temp = static_cast<float>(o.temp), sat = static_cast<float>(o.sat), con = static_cast<float>(o.con), vig = static_cast<float>(o.vig), grain = static_cast<float>(o.grain);
  const float asp = static_cast<float>(w) / h, nv = std::sqrt(asp * asp * 0.25f + 0.25f);
  const auto regard = [&](V c, float u, float v, int px, int py) {
    c[0] *= 1 + 0.12f * temp, c[1] *= 1 + 0.02f * temp, c[2] *= 1 - 0.12f * temp;
    const float l = 0.2126f * c[0] + 0.7152f * c[1] + 0.0722f * c[2];
    for (float& k : c) {
      k = l + (k - l) * (1 + sat);
      k = linS(clamp01((srgb(k) - 0.5f) * (1 + con) + 0.5f));
    }
    if (vig > 0) {
      const float dx = (u - 0.5f) * asp / nv, dy = (v - 0.5f) / nv, L = std::sqrt(dx * dx + dy * dy);
      const float t = clamp01((L - 0.35f) / 0.65f), ss = t * t * (3 - 2 * t);
      for (float& k : c) k *= 1 - vig * ss;
    }
    if (grain > 0) {
      const float g = (hashe(static_cast<float>(px), static_cast<float>(py)) - 0.5f) * grain * 0.12f * (0.35f + 0.65f * std::sqrt(std::max(l, 0.f)));
      for (float& k : c) k += g;
    }
    return V{clamp01(c[0]), clamp01(c[1]), clamp01(c[2])};
  };
  const float expo = static_cast<float>(o.expo);
  parLignes(h, [&](int y) {
    const float v = (y + 0.5f) / h;
    V bg{};
    for (int k = 0; k < 3; k++) {
      // v : du haut vers le bas ; c1 est le haut du dégradé
      const double m = o.fond == 1 ? o.c1[k] + (o.c2[k] - o.c1[k]) * v : o.c1[k];
      bg[k] = linS(static_cast<float>(m));
    }
    unsigned char* s = sortie.data() + 4 * static_cast<size_t>(y) * w;
    for (int x = 0; x < w; x++) {
      const float u = (x + 0.5f) / w;
      const float* a = C + 4 * (static_cast<size_t>(y) * w + x);
      V lin{a[0] * expo, a[1] * expo, a[2] * expo};
      float al = a[3];
      if (halo > 0) {
        float h1[4], h2[4], h3[4];
        lire(N[2], u, v, h1);
        lire(N[4], u, v, h2);
        lire(N[6], u, v, h3);
        for (int k = 0; k < 3; k++) lin[k] += ((h1[k] + h2[k] + h3[k]) / 3 - lin[k]) * halo;
        al += ((h1[3] + h2[3] + h3[3]) / 3 - al) * halo;
      }
      al = clamp01(al);
      V col{0, 0, 0};
      if (al > 1e-4f) col = tons({lin[0] / al, lin[1] / al, lin[2] / al}, o.tons);
      if (o.fond == 2) {
        const V c = regard(col, u, v, x, h - 1 - y);
        for (int k = 0; k < 3; k++) s[4 * x + k] = static_cast<unsigned char>(std::lround(srgb(c[k]) * 255));
        s[4 * x + 3] = static_cast<unsigned char>(std::lround(al * 255));
      } else {
        const V m{bg[0] + (col[0] - bg[0]) * al, bg[1] + (col[1] - bg[1]) * al, bg[2] + (col[2] - bg[2]) * al};
        const V c = regard(m, u, v, x, h - 1 - y);
        for (int k = 0; k < 3; k++) s[4 * x + k] = static_cast<unsigned char>(std::lround(srgb(c[k]) * 255));
        s[4 * x + 3] = 255;
      }
    }
  });
}
