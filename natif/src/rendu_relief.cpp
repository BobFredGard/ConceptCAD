#include "rendu_relief.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <functional>
#include <map>
#include <mutex>
#include <thread>
#include <unordered_map>

#include <BRepLib_ToolTriangulatedShape.hxx>
#include <BRep_Tool.hxx>
#include <Poly_Triangulation.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Face.hxx>

namespace {
struct DefRelief {
  const char* t;
  double e, a, r;
};
// REL_DEF : e échelle par défaut (mm), a profondeur (mm), r rugosité ajoutée quand le motif est plus fin que le pixel
const DefRelief REL_DEF[] = {{"brosse", 0.12, 0.012, 0.06}, {"sable", 0.07, 0.013, 0.16}, {"molete", 1.0, 0.16, 0.02}, {"bois", 2.2, 0.02, 0.04},
                             {"grain", 0.3, 0.018, 0.08},   {"stries", 0.2, 0.008, 0.04}, {"couches", 0.2, 0.045, 0.05}};
const DefRelief* defRelief(const std::string& t) {
  for (const DefRelief& d : REL_DEF)
    if (t == d.t) return &d;
  return nullptr;
}
struct MatRelief {
  const char* k;
  const char* t;
  double e;
  char d;
};
// MAT_REL (12-materiaux.js)
const MatRelief MAT_REL[] = {{"acier", "stries", 0, 0}, {"inox", "brosse", 0, 0}, {"acier-zingue", "grain", 0.15, 0}, {"fonte", "sable", 0.12, 0},
  {"alu", "stries", 0, 0}, {"alu-sable", "sable", 0, 0}, {"alu-anod-nat", "sable", 0, 0}, {"alu-anod-noir", "sable", 0, 0}, {"alu-anod-rouge", "sable", 0, 0},
  {"alu-anod-bleu", "sable", 0, 0}, {"alu-anod-or", "sable", 0, 0}, {"alu-anod-titane", "sable", 0, 0}, {"titane", "brosse", 0, 0},
  {"abs-noir", "grain", 0, 0}, {"abs-blanc", "grain", 0, 0}, {"abs-gris", "grain", 0, 0}, {"pla-mat", "couches", 0, 'z'}, {"pla-brillant", "couches", 0, 'z'},
  {"petg", "couches", 0, 'z'}, {"pom", "grain", 0.15, 0}, {"pa-nylon", "grain", 0, 0}, {"pe-hd", "grain", 0, 0}, {"caoutchouc", "grain", 0.4, 0},
  {"silicone", "grain", 0.4, 0}, {"tpu", "couches", 0, 'z'}, {"peint-mat", "grain", 0.2, 0}, {"peint-epoxy", "grain", 0.6, 0},
  {"bois-hetre", "bois", 0, 0}, {"bois-chene", "bois", 3, 0}, {"bois-noyer", "bois", 2.6, 0}, {"mdf", "grain", 0.5, 0}, {"verre-depoli", "sable", 0.05, 0}};
const MatRelief* matRelief(const std::string& k) {
  for (const MatRelief& m : MAT_REL)
    if (k == m.k) return &m;
  return nullptr;
}

// Le bruit du navigateur, entier 32 bits compris (Math.imul)
double sfHash(int i, int j, int s) {
  uint32_t h = static_cast<uint32_t>(i) * 374761393u + static_cast<uint32_t>(j) * 668265263u + static_cast<uint32_t>(s) * 1442695041u;
  h = (h ^ (h >> 13)) * 1274126177u;
  h ^= h >> 16;
  return h / 4294967296.0;
}
int modulo(int a, int p) { return ((a % p) + p) % p; }
double sfNoise(double x, double y, int px, int py, int s) {
  const int i = static_cast<int>(std::floor(x)), j = static_cast<int>(std::floor(y));
  const double fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const int i0 = modulo(i, px), i1 = modulo(i + 1, px), j0 = modulo(j, py), j1 = modulo(j + 1, py);
  const double a = sfHash(i0, j0, s), b = sfHash(i1, j0, s), c = sfHash(i0, j1, s), d = sfHash(i1, j1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
double sfFbm(double x, double y, int px, int py, int s) {
  return sfNoise(x, y, px, py, s) * 0.6 + sfNoise(x * 2, y * 2, px * 2, py * 2, s + 1) * 0.3 + sfNoise(x * 4, y * 4, px * 4, py * 4, s + 2) * 0.1;
}
double sfTri(double x) { return std::abs(x - std::floor(x) - 0.5) * 2; }
int rond(double x) { return std::max(1, static_cast<int>(std::lround(x))); }

using Hauteur = std::function<double(double, double)>;
// sfHeight : hauteur (0..1) en (u, v) mm d'une tuile T ; bout : faces ⟂ à la direction du motif
Hauteur sfHeight(const ReliefEffectif* rel, bool bout, double T) {
  if (!rel) return nullptr;
  const double f = 1 / rel->e, e = rel->e;
  const int c = rond(T * f);
  const std::string& t = rel->t;
  const Hauteur iso = [=](double u, double v) {
    const int c2 = rond(c * 0.25);
    return sfFbm(u / T * c, v / T * c, c, c, 1) * 0.7 + sfNoise(u / T * c2, v / T * c2, c2, c2, 4) * 0.3;
  };
  if (t == "sable" || t == "grain") return iso;
  if (t == "molete") return [=](double u, double v) { return 1 - std::max(sfTri((u + v) * f * std::sqrt(0.5)), sfTri((u - v) * f * std::sqrt(0.5))); };
  if (t == "brosse") {
    const int cu = rond(T * f * 0.02), cu2 = rond(T * f * 0.005), cv2 = rond(T * f * 0.2);
    return [=](double u, double v) { return sfFbm(u / T * cu, v / T * c, cu, c, 1) * 0.65 + sfNoise(u / T * cu2, v / T * cv2, cu2, cv2, 2) * 0.35; };
  }
  if (t == "bois") {
    if (bout) return iso;
    const int cw = rond(T * f * 0.05);
    return [=](double u, double v) { return sfTri((v + (sfFbm(u / T * cw, v / T * c, cw, c, 3) - 0.5) * 1.6 * e) * f); };
  }
  if (t == "stries") return [=](double, double v) { return sfTri(v * f); };
  if (t == "couches") {
    if (bout) return nullptr;
    return [=](double, double v) { return std::pow(sfTri(v * f), 0.6); };
  }
  return nullptr;
}

// Un calcul par rangée d'image, sur tous les cœurs
void parRangees(int h, const std::function<void(int)>& rangee) {
  const int n = std::clamp(static_cast<int>(std::thread::hardware_concurrency()), 1, 16);
  std::vector<std::thread> L;
  for (int k = 0; k < n; k++)
    L.emplace_back([=, &rangee] {
      for (int y = k; y < h; y += n) rangee(y);
    });
  for (std::thread& t : L) t.join();
}

occ::handle<Image_PixMap> image(int N) {
  occ::handle<Image_PixMap> im = new Image_PixMap();
  im->SetTopDown(false);
  im->InitTrash(Image_Format_RGB, N, N);
  return im;
}
unsigned char octet(double x) { return static_cast<unsigned char>(std::clamp(static_cast<int>(std::lround(x)), 0, 255)); }

// Les faces, triangles non indexés avec leurs normales, repère et sens de la face compris
void lireTriangles(const TopoDS_Shape& forme, std::vector<double>& P, std::vector<double>& N) {
  for (TopExp_Explorer x(forme, TopAbs_FACE); x.More(); x.Next()) {
    const TopoDS_Face f = TopoDS::Face(x.Current());
    TopLoc_Location loc;
    const occ::handle<Poly_Triangulation> T = BRep_Tool::Triangulation(f, loc);
    if (T.IsNull()) continue;
    BRepLib_ToolTriangulatedShape::ComputeNormals(f, T);
    const gp_Trsf tr = loc.Transformation();
    const bool inverse = f.Orientation() == TopAbs_REVERSED;
    for (int t = 1; t <= T->NbTriangles(); t++) {
      int a, b, c;
      T->Triangle(t).Get(a, b, c);
      if (inverse) std::swap(b, c);
      for (const int i : {a, b, c}) {
        const gp_Pnt p = T->Node(i).Transformed(tr);
        gp_Dir n = T->Normal(i);
        n.Transform(tr);
        if (inverse) n.Reverse();
        P.insert(P.end(), {p.X(), p.Y(), p.Z()});
        N.insert(N.end(), {n.X(), n.Y(), n.Z()});
      }
    }
  }
}

using V = std::array<double, 3>;
using U2 = std::array<double, 2>;
V lerp(const V& a, const V& b, double k) { return {a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k}; }
double dist(const V& a, const V& b) { return std::hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
double sm(double x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }
}  // namespace

const std::vector<ChoixTexte>& typesRelief() {
  static const std::vector<ChoixTexte> L = {{"aucun", L"Aucun"}, {"brosse", L"Brossé"}, {"sable", L"Sablé / microbillé"}, {"molete", L"Moleté"}, {"bois", L"Veinage bois"},
                                            {"grain", L"Grain (plastique, peinture)"}, {"stries", L"Stries d’usinage"}, {"couches", L"Couches d’impression 3D"}};
  return L;
}
const std::vector<ChoixTexte>& typesPatine() {
  static const std::vector<ChoixTexte> L = {{"", L"Propre"}, {"aucune", L"Aucune (aspect CAO)"}, {"legere", L"Légère"}, {"usee", L"Usée"}, {"tres", L"Très usée"}};
  return L;
}

std::string reliefDuMateriau(const std::string& k) {
  const MatRelief* m = matRelief(k);
  return m ? m->t : std::string();
}

bool reliefEffectif(const ReliefChoisi& r, const std::string& cle, ReliefEffectif& s) {
  const MatRelief* m = matRelief(cle);
  std::string t = r.t;
  if (t.empty()) t = m ? m->t : "aucun";
  const DefRelief* D = defRelief(t);
  if (!D) return false;
  const bool duMat = m && t == m->t;
  s.t = t;
  s.e = r.e > 0 ? r.e : duMat && m->e > 0 ? m->e : D->e;
  s.d = !r.d.empty() ? r.d[0] : duMat && m->d ? m->d : 'x';
  return true;
}

Patine patineDe(const std::string& p) {
  if (p == "aucune") return {0, 0, 0};
  if (p == "legere") return {0.8, 0.45, 0.35};
  if (p == "usee") return {1, 0.8, 0.65};
  if (p == "tres") return {1.25, 1.1, 1};
  return {0.5, 0, 0};
}

bool paillettesDe(const std::string& k, Paillettes& s) {
  if (k == "peint-metal") s = {0.06, 0.45};
  else if (k == "peint-paillettes") s = {0.18, 0.9};
  else if (k == "peint-nacre") s = {0.05, 0.25};
  else return false;
  return true;
}

std::shared_ptr<const KitSurface> kitSurface(const ReliefEffectif* rel, const Paillettes* fl, double v, double rugo, bool bout) {
  char cle[160];
  snprintf(cle, sizeof cle, "%s|%.4f|%.3f|%.3f|%.3f|%.3f|%d", rel ? rel->t.c_str() : "", rel ? rel->e : 0.0, fl ? fl->t : 0.0, fl ? fl->i : 0.0, v, rugo, bout ? 1 : 0);
  static std::mutex verrou;
  static std::map<std::string, std::shared_ptr<const KitSurface>> cache;
  {
    std::lock_guard<std::mutex> g(verrou);
    const auto it = cache.find(cle);
    if (it != cache.end()) return it->second;
    if (cache.size() >= 12) cache.clear();  // chaque jeu pèse plusieurs dizaines de Mo
  }
  auto K = std::make_shared<KitSurface>();
  // Une seule tuile pour les trois cartes : OCCT n'applique qu'une répétition par matériau.
  // Le navigateur prend ~4 mm pour les normales et ~48 mm pour la teinte : ici ~24 mm et plus de points.
  double T = 48;
  const Hauteur essai = sfHeight(rel, bout, 24);
  const bool normalesVoulues = static_cast<bool>(essai) || fl;
  if (rel) {
    const double k = rel->t == "molete" ? rel->e * std::sqrt(2.0) : rel->e;
    T = k * std::max(1.0, std::round(24 / k));
  } else if (fl) {
    T = 24;
  }
  K->tuile = T;
  const bool bois = rel && rel->t == "bois" && !bout;
  const double cM = 1 + 0.11 * v;
  if (v > 0 || bois) {
    const int R = bois ? 1024 : 512;
    const int c1 = rond(T * 0.14), c2 = rond(T * 0.6);
    const Hauteur hW = bois ? sfHeight(rel, bout, T) : nullptr;
    K->cMax = bois ? 1.1 * cM : cM;
    K->teinte = image(R);
    parRangees(R, [&, R](int y) {
      for (int x = 0; x < R; x++) {
        double m = 1 + v * ((sfFbm(1.0 * x / R * c1, 1.0 * y / R * c1, c1, c1, 7) - 0.5) * 0.16 + (sfNoise(1.0 * x / R * c2, 1.0 * y / R * c2, c2, c2, 9) - 0.5) * 0.06);
        if (hW) m *= 0.62 + 0.46 * hW(1.0 * x / R * T, 1.0 * y / R * T);
        const unsigned char b = octet(255 * m / K->cMax);
        unsigned char* o = K->teinte->ChangeRawValue(y, x);
        o[0] = o[1] = o[2] = b;
      }
    });
  }
  if (v > 0 && rugo >= 0) {
    const int R = 512, cr = rond(T * 0.2);
    const double rMax = std::min(1.0, rugo + 0.11 * v);
    K->rMax = rMax;
    K->rugosite = image(R);
    parRangees(R, [&, R](int y) {
      for (int x = 0; x < R; x++) {
        const double r = std::clamp(rugo + v * (sfFbm(1.0 * x / R * cr, 1.0 * y / R * cr, cr, cr, 11) - 0.5) * 0.22, 0.02, 1.0);
        unsigned char* o = K->rugosite->ChangeRawValue(y, x);
        o[0] = o[2] = 255;
        o[1] = octet(255 * r / rMax);
      }
    });
  }
  if (normalesVoulues) {
    const Hauteur H = sfHeight(rel, bout, T);
    const int N = 2048;
    const double du = T / N;
    const DefRelief* P = rel ? defRelief(rel->t) : nullptr;
    const double A = P ? P->a * (rel->e / P->e) : 0;
    std::vector<float> hv;
    if (H) {
      hv.resize(static_cast<size_t>(N) * N);
      parRangees(N, [&, N, du](int y) {
        for (int x = 0; x < N; x++) hv[static_cast<size_t>(y) * N + x] = static_cast<float>(H(x * du, y * du));
      });
    }
    const int cf = fl ? rond(T / fl->t) : 0;
    K->normales = image(N);
    parRangees(N, [&, N, du, A, cf](int y) {
      for (int x = 0; x < N; x++) {
        double nx = 0, ny = 0;
        if (H) {
          const int xp = (x + 1) % N, xm = (x + N - 1) % N, yp = (y + 1) % N, ym = (y + N - 1) % N;
          nx = -(hv[static_cast<size_t>(y) * N + xp] - hv[static_cast<size_t>(y) * N + xm]) * A / (2 * du);
          ny = -(hv[static_cast<size_t>(yp) * N + x] - hv[static_cast<size_t>(ym) * N + x]) * A / (2 * du);
        }
        if (fl) {
          const int cx = x * cf / N, cy = y * cf / N;
          nx += (sfHash(cx, cy, 21) * 2 - 1) * 0.55 * fl->i;
          ny += (sfHash(cx, cy, 22) * 2 - 1) * 0.55 * fl->i;
        }
        const double l = std::hypot(nx, ny, 1.0);
        unsigned char* o = K->normales->ChangeRawValue(y, x);
        o[0] = octet((nx / l * 0.5 + 0.5) * 255);
        o[1] = octet((ny / l * 0.5 + 0.5) * 255);
        o[2] = octet((1 / l * 0.5 + 0.5) * 255);
      }
    });
  }
  std::lock_guard<std::mutex> g(verrou);
  cache[cle] = K;
  return K;
}

std::vector<TriangleSurface> maillageSurface(const TopoDS_Shape& forme, bool usure) {
  std::vector<double> P, N;
  lireTriangles(forme, P, N);
  std::vector<TriangleSurface> sortie;
  const int n = static_cast<int>(P.size() / 9);
  sortie.reserve(n);
  V bmin{1e30, 1e30, 1e30}, bmax{-1e30, -1e30, -1e30};
  for (size_t i = 0; i + 2 < P.size(); i += 3)
    for (int k = 0; k < 3; k++) {
      bmin[k] = std::min(bmin[k], P[i + k]);
      bmax[k] = std::max(bmax[k], P[i + k]);
    }
  const auto Vt = [&](int t, int i) { const size_t a = static_cast<size_t>(t) * 9 + i * 3; return V{P[a], P[a + 1], P[a + 2]}; };
  const auto Nt = [&](int t, int i) { const size_t a = static_cast<size_t>(t) * 9 + i * 3; return V{N[a], N[a + 1], N[a + 2]}; };
  std::array<V, 3> sp, sn;
  std::array<U2, 3> su;
  int si = 0;
  const auto put = [&](const V& p, const V& q, const U2& u) {
    const double l = std::max(1e-30, std::hypot(q[0], q[1], q[2]));
    sp[si] = p;
    sn[si] = {q[0] / l, q[1] / l, q[2] / l};
    su[si] = u;
    if (++si == 3) {
      si = 0;
      TriangleSurface t;
      for (int a = 0; a < 3; a++) {
        for (int k = 0; k < 3; k++) {
          t.p[a][k] = static_cast<float>(sp[a][k]);
          t.n[a][k] = static_cast<float>(sn[a][k]);
        }
        t.usage[a][0] = static_cast<float>(su[a][0]);
        t.usage[a][1] = static_cast<float>(su[a][1]);
      }
      sortie.push_back(t);
    }
  };
  if (!usure) {
    for (int t = 0; t < n; t++)
      for (int i = 0; i < 3; i++) put(Vt(t, i), Nt(t, i), {0, 0});
    return sortie;
  }
  // surfBand : la largeur de la bande suit la taille du corps
  const double rayon = n ? 0.5 * dist(bmin, bmax) : 30;
  const double band = std::clamp(rayon * 0.015, 0.25, 1.5);
  // Sommets soudés, puis arêtes → triangles voisins
  std::unordered_map<std::string, int> ids;
  std::vector<int> vid(static_cast<size_t>(n) * 3);
  char cle[80];
  for (size_t i = 0; i < vid.size(); i++) {
    snprintf(cle, sizeof cle, "%ld,%ld,%ld", std::lround(P[i * 3] * 1e3), std::lround(P[i * 3 + 1] * 1e3), std::lround(P[i * 3 + 2] * 1e3));
    const auto r = ids.emplace(cle, static_cast<int>(ids.size()));
    vid[i] = r.first->second;
  }
  std::vector<double> FN(static_cast<size_t>(n) * 3);
  for (int t = 0; t < n; t++) {
    const size_t a = static_cast<size_t>(t) * 9;
    const double ux = P[a + 3] - P[a], uy = P[a + 4] - P[a + 1], uz = P[a + 5] - P[a + 2], vx = P[a + 6] - P[a], vy = P[a + 7] - P[a + 1], vz = P[a + 8] - P[a + 2];
    double x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    const double l = std::max(1e-30, std::hypot(x, y, z));
    x /= l, y /= l, z /= l;
    if (x * (N[a] + N[a + 3] + N[a + 6]) + y * (N[a + 1] + N[a + 4] + N[a + 7]) + z * (N[a + 2] + N[a + 5] + N[a + 8]) < 0) x = -x, y = -y, z = -z;
    FN[t * 3ull] = x, FN[t * 3ull + 1] = y, FN[t * 3ull + 2] = z;
  }
  std::unordered_map<uint64_t, std::vector<int>> E;
  E.reserve(static_cast<size_t>(n) * 2);
  for (int t = 0; t < n; t++)
    for (int i = 0; i < 3; i++) {
      const uint64_t a = vid[t * 3ull + (i + 1) % 3], b = vid[t * 3ull + (i + 2) % 3];  // arête opposée au sommet i
      const uint64_t k = a < b ? (a << 32) | b : (b << 32) | a;
      std::vector<int>& L = E[k];
      L.push_back(t);
      L.push_back(i);
    }
  std::vector<unsigned char> VF(ids.size(), 0), FL(static_cast<size_t>(n) * 3, 0);
  const double cos25 = std::cos(25 * 3.14159265358979323846 / 180);
  for (const auto& e : E) {
    const std::vector<int>& L = e.second;
    if (L.size() != 4) continue;
    const int t1 = L[0], i1 = L[1], t2 = L[2], i2 = L[3];
    if (FN[t1 * 3ull] * FN[t2 * 3ull] + FN[t1 * 3ull + 1] * FN[t2 * 3ull + 1] + FN[t1 * 3ull + 2] * FN[t2 * 3ull + 2] > cos25) continue;
    const size_t o = t2 * 9ull + i2 * 3ull, a = t1 * 9ull + ((i1 + 1) % 3) * 3ull;  // sommet de t2 hors de l'arête, un point de l'arête
    const double s = (P[o] - P[a]) * FN[t1 * 3ull] + (P[o + 1] - P[a + 1]) * FN[t1 * 3ull + 1] + (P[o + 2] - P[a + 2]) * FN[t1 * 3ull + 2];
    const unsigned char f = s < 0 ? 1 : 2;
    FL[t1 * 3ull + i1] = f;
    FL[t2 * 3ull + i2] = f;
    VF[vid[t1 * 3ull + (i1 + 1) % 3]] |= f;
    VF[vid[t1 * 3ull + (i1 + 2) % 3]] |= f;
  }
  const auto vuB = [](int vf, const U2& u) { return vf ? U2{vf & 1 ? 1.0 : u[0], vf & 2 ? 1.0 : u[1]} : u; };
  const auto bw = [band](int f) { return f & 1 ? band : band * 1.8; };
  // Un sommet posé sur une arête vive reçoit un petit triangle à lui, jamais tout le triangle
  const auto coins = [&](const std::array<V, 3>& p3, const std::array<V, 3>& q3, const std::array<double, 3>& cut, const std::array<U2, 3>& u3, const U2& base) {
    if (!cut[0] && !cut[1] && !cut[2]) {
      for (int i = 0; i < 3; i++) put(p3[i], q3[i], u3[i]);
      return;
    }
    struct S {
      V p, q;
      U2 u;
    };
    std::vector<S> ring;
    for (int i = 0; i < 3; i++) {
      if (!cut[i]) {
        ring.push_back({p3[i], q3[i], u3[i]});
        continue;
      }
      const int j = (i + 1) % 3, h = (i + 2) % 3;
      const double ka = std::min(0.45, cut[i] / std::max(1e-9, dist(p3[i], p3[j]))), kb = std::min(0.45, cut[i] / std::max(1e-9, dist(p3[i], p3[h])));
      const S A{lerp(p3[i], p3[j], ka), lerp(q3[i], q3[j], ka), base}, B{lerp(p3[i], p3[h], kb), lerp(q3[i], q3[h], kb), base};
      put(p3[i], q3[i], u3[i]);
      put(A.p, A.q, A.u);
      put(B.p, B.q, B.u);
      ring.push_back(B);
      ring.push_back(A);
    }
    for (size_t i = 1; i + 1 < ring.size(); i++) {
      put(ring[0].p, ring[0].q, ring[0].u);
      put(ring[i].p, ring[i].q, ring[i].u);
      put(ring[i + 1].p, ring[i + 1].q, ring[i + 1].u);
    }
  };
  std::function<void(const std::array<V, 3>&, const std::array<V, 3>&, const std::array<int, 3>&, const std::array<int, 3>&, const U2&, int)> proc;
  proc = [&](const std::array<V, 3>& p, const std::array<V, 3>& q, const std::array<int, 3>& fl, const std::array<int, 3>& vf, const U2& base, int depth) {
    const int nf = (fl[0] ? 1 : 0) + (fl[1] ? 1 : 0) + (fl[2] ? 1 : 0);
    const auto hgt = [&](int i) {
      const V& c = p[i];
      const V& a = p[(i + 1) % 3];
      const V& b = p[(i + 2) % 3];
      const double abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
      return std::hypot(aby * acz - abz * acy, abz * acx - abx * acz, abx * acy - aby * acx) / std::max(1e-30, std::hypot(abx, aby, abz));
    };
    if (nf >= 2 && depth < 10 && std::max({hgt(0), hgt(1), hgt(2)}) > 2 * band) {
      // Bordé de plusieurs arêtes vives : coupé au milieu du plus grand côté
      int i = 0;
      double best = -1;
      for (int k = 0; k < 3; k++) {
        const double d = dist(p[(k + 1) % 3], p[(k + 2) % 3]);
        if (d > best) best = d, i = k;
      }
      const int j = (i + 1) % 3, h = (i + 2) % 3;
      const V M = lerp(p[j], p[h], 0.5), qM = lerp(q[j], q[h], 0.5);
      const int vfM = fl[i];
      proc({p[i], p[j], M}, {q[i], q[j], qM}, {fl[i], 0, fl[h]}, {vf[i], vf[j], vfM}, base, depth + 1);
      proc({p[i], M, p[h]}, {q[i], qM, q[h]}, {fl[i], fl[j], 0}, {vf[i], vfM, vf[h]}, base, depth + 1);
      return;
    }
    if (nf == 1) {  // bande le long de l'arête vive du triangle
      const int i = fl[0] ? 0 : fl[1] ? 1 : 2, ia = (i + 1) % 3, ib = (i + 2) % 3, f = fl[i];
      const V& c = p[i];
      const V& a = p[ia];
      const V& b = p[ib];
      const double tt = bw(f) / std::max(1e-9, hgt(i));
      const U2 eU = f == 1 ? U2{1, base[1]} : U2{base[0], 1};
      if (tt < 0.5) {
        const V a2 = lerp(a, c, tt), b2 = lerp(b, c, tt), qa2 = lerp(q[ia], q[i], tt), qb2 = lerp(q[ib], q[i], tt);
        put(a2, qa2, base);
        put(a, q[ia], vuB(vf[ia], eU));
        put(b, q[ib], vuB(vf[ib], eU));
        put(a2, qa2, base);
        put(b, q[ib], vuB(vf[ib], eU));
        put(b2, qb2, base);
        coins({c, a2, b2}, {q[i], qa2, qb2}, {vf[i] ? bw(vf[i]) : 0.0, 0.0, 0.0}, {vuB(vf[i], base), base, base}, base);
        return;
      }
    }
    if (nf == 0) {
      coins(p, q, {vf[0] ? bw(vf[0]) : 0.0, vf[1] ? bw(vf[1]) : 0.0, vf[2] ? bw(vf[2]) : 0.0}, {vuB(vf[0], base), vuB(vf[1], base), vuB(vf[2], base)}, base);
      return;
    }
    for (int i = 0; i < 3; i++) {  // petit triangle : sommets des arêtes vives à 1
      U2 u = base;
      for (int e = 0; e < 3; e++)
        if (fl[e] && e != i) u = fl[e] == 1 ? U2{1, u[1]} : U2{u[0], 1};
      put(p[i], q[i], u);
    }
  };
  for (int t = 0; t < n; t++) {
    const std::array<V, 3> p{Vt(t, 0), Vt(t, 1), Vt(t, 2)}, q{Nt(t, 0), Nt(t, 1), Nt(t, 2)};
    // Courbure signée (convexe > 0), moyenne des trois côtés
    double k = 0;
    for (int i = 0; i < 3; i++) {
      const int j = (i + 1) % 3;
      const double dx = p[i][0] - p[j][0], dy = p[i][1] - p[j][1], dz = p[i][2] - p[j][2];
      double d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= 0) d2 = 1e-12;
      k += ((q[i][0] - q[j][0]) * dx + (q[i][1] - q[j][1]) * dy + (q[i][2] - q[j][2]) * dz) / d2;
    }
    k /= 3;
    const U2 base{sm((k - 0.125) / 0.54), sm((-k - 0.125) / 0.54)};
    proc(p, q, {FL[t * 3ull], FL[t * 3ull + 1], FL[t * 3ull + 2]}, {VF[vid[t * 3ull]], VF[vid[t * 3ull + 1]], VF[vid[t * 3ull + 2]]}, base, 0);
  }
  return sortie;
}
