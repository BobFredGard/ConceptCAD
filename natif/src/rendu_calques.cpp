// Les calques pour la retouche (« Calques séparés ») : masque, profondeur, normales, identifiants des corps, ombre.
// Même cadrage que l'image finale. Ils sont calculés directement sur les triangles : ni matière, ni lumière, ni fond n'y entrent.
#include "rendu_moteur.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <thread>

#include <wx/image.h>

#include <BRepLib_ToolTriangulatedShape.hxx>
#include <BRep_Tool.hxx>
#include <Poly_Triangulation.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Face.hxx>

namespace {
const double PI_ = 3.14159265358979323846;
struct P3 {
  double x, y, z;
};
P3 moins(const P3& a, const P3& b) { return {a.x - b.x, a.y - b.y, a.z - b.z}; }
double scal(const P3& a, const P3& b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
P3 vect(const P3& a, const P3& b) { return {a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x}; }
P3 unit(const P3& a) {
  const double n = std::sqrt(scal(a, a));
  return n > 0 ? P3{a.x / n, a.y / n, a.z / n} : a;
}
struct Triangle3 {
  P3 s[3], n[3];
  int piece;
};
// Le triangle vu à l'écran
struct TriangleEcran {
  float x[3], y[3], iz[3];
  float n[3][3];
  int piece;
};
double halton(int i, int b) {
  double f = 1, r = 0;
  for (int k = i; k > 0; k /= b) {
    f /= b;
    r += f * (k % b);
  }
  return r;
}
void teinte(double h, double s, double l, unsigned char o[3]) {
  const double c = (1 - std::abs(2 * l - 1)) * s, hh = h * 6, x = c * (1 - std::abs(std::fmod(hh, 2.0) - 1)), m = l - c / 2;
  double r = 0, g = 0, b = 0;
  if (hh < 1) r = c, g = x;
  else if (hh < 2) r = x, g = c;
  else if (hh < 3) g = c, b = x;
  else if (hh < 4) g = x, b = c;
  else if (hh < 5) r = x, b = c;
  else r = c, b = x;
  o[0] = static_cast<unsigned char>(std::lround((r + m) * 255));
  o[1] = static_cast<unsigned char>(std::lround((g + m) * 255));
  o[2] = static_cast<unsigned char>(std::lround((b + m) * 255));
}
unsigned char octet(double v) { return static_cast<unsigned char>(std::clamp(std::lround(v * 255), 0L, 255L)); }

std::vector<Triangle3> trianglesDe(const std::vector<PieceRendu>& pieces) {
  std::vector<Triangle3> T;
  int rang = -1;
  for (const PieceRendu& p : pieces) {
    if (p.forme.IsNull()) continue;
    rang++;
    for (TopExp_Explorer ex(p.forme, TopAbs_FACE); ex.More(); ex.Next()) {
      const TopoDS_Face F = TopoDS::Face(ex.Current());
      TopLoc_Location loc;
      const occ::handle<Poly_Triangulation> M = BRep_Tool::Triangulation(F, loc);
      if (M.IsNull()) continue;
      if (!M->HasNormals()) BRepLib_ToolTriangulatedShape::ComputeNormals(F, M);
      const gp_Trsf t = loc.Transformation();
      const bool inverse = F.Orientation() == TopAbs_REVERSED;
      for (int i = 1; i <= M->NbTriangles(); i++) {
        int a, b, c;
        M->Triangle(i).Get(a, b, c);
        if (inverse) std::swap(b, c);
        Triangle3 q;
        q.piece = rang;
        const int K[3] = {a, b, c};
        for (int k = 0; k < 3; k++) {
          const gp_Pnt s = M->Node(K[k]).Transformed(t);
          q.s[k] = {s.X(), s.Y(), s.Z()};
          const gp_Dir n = M->HasNormals() ? M->Normal(K[k]).Transformed(t) : gp_Dir(0, 0, 1);
          q.n[k] = {n.X(), n.Y(), n.Z()};
        }
        // La normale d'une face retournée, celle d'une surface dans l'autre sens : le triangle tranche
        const P3 g = vect(moins(q.s[1], q.s[0]), moins(q.s[2], q.s[0]));
        for (int k = 0; k < 3; k++)
          if (M->HasNormals() ? scal(q.n[k], g) < 0 : true) q.n[k] = scal(g, g) > 0 ? unit(g) : q.n[k];
        T.push_back(q);
      }
    }
  }
  return T;
}
}  // namespace

bool MoteurRendu::calques(int w, int h, std::vector<std::pair<std::string, wxImage>>& L) {
  const std::vector<Triangle3> T = trianglesDe(pieces_);
  if (T.empty() || w <= 0 || h <= 0) return false;
  const double asp = 16.0 / 9, tanV = 18 / focale_ / asp;
  const P3 oeil{cam_.oeil[0], cam_.oeil[1], cam_.oeil[2]}, cible{cam_.cible[0], cam_.cible[1], cam_.cible[2]}, haut{cam_.haut[0], cam_.haut[1], cam_.haut[2]};
  const P3 f = unit(moins(cible, oeil)), d = unit(vect(f, haut)), u = vect(d, f);

  // Le dessin en quatre échantillons par pixel, pour des bords lisses
  const int SS = 2, W = w * SS, H = h * SS;
  std::vector<TriangleEcran> E;
  E.reserve(T.size());
  for (const Triangle3& t : T) {
    TriangleEcran e;
    bool devant = true;
    for (int k = 0; k < 3 && devant; k++) {
      const P3 q = moins(t.s[k], oeil);
      const double z = scal(q, f);
      if (z < 0.01) {
        devant = false;
        break;
      }
      e.x[k] = static_cast<float>((scal(q, d) / (z * tanV * asp) + 1) / 2 * W);
      e.y[k] = static_cast<float>((1 - scal(q, u) / (z * tanV)) / 2 * H);
      e.iz[k] = static_cast<float>(1 / z);
      // Le repère de la caméra : z vers l'œil
      e.n[k][0] = static_cast<float>(scal(t.n[k], d));
      e.n[k][1] = static_cast<float>(scal(t.n[k], u));
      e.n[k][2] = static_cast<float>(-scal(t.n[k], f));
    }
    if (!devant) continue;
    e.piece = t.piece;
    E.push_back(e);
  }
  std::vector<float> prof(static_cast<size_t>(W) * H, 0.f);
  std::vector<int> quel(static_cast<size_t>(W) * H, -1);
  for (size_t i = 0; i < E.size(); i++) {
    const TriangleEcran& e = E[i];
    const float aire = (e.x[1] - e.x[0]) * (e.y[2] - e.y[0]) - (e.x[2] - e.x[0]) * (e.y[1] - e.y[0]);
    if (aire == 0 || !std::isfinite(aire)) continue;
    const int x0 = std::max(0, static_cast<int>(std::floor(std::min({e.x[0], e.x[1], e.x[2]})))), x1 = std::min(W - 1, static_cast<int>(std::ceil(std::max({e.x[0], e.x[1], e.x[2]}))));
    const int y0 = std::max(0, static_cast<int>(std::floor(std::min({e.y[0], e.y[1], e.y[2]})))), y1 = std::min(H - 1, static_cast<int>(std::ceil(std::max({e.y[0], e.y[1], e.y[2]}))));
    for (int y = y0; y <= y1; y++)
      for (int x = x0; x <= x1; x++) {
        const float px = x + 0.5f, py = y + 0.5f;
        const float a = ((e.x[1] - px) * (e.y[2] - py) - (e.x[2] - px) * (e.y[1] - py)) / aire;
        const float b = ((e.x[2] - px) * (e.y[0] - py) - (e.x[0] - px) * (e.y[2] - py)) / aire;
        const float c = 1 - a - b;
        if (a < 0 || b < 0 || c < 0) continue;
        const float iz = a * e.iz[0] + b * e.iz[1] + c * e.iz[2];
        const size_t n = static_cast<size_t>(y) * W + x;
        if (iz > prof[n]) {
          prof[n] = iz;
          quel[n] = static_cast<int>(i);
        }
      }
  }

  // Les couleurs des corps : le nombre d'or les écarte
  int nb = 0;
  for (const PieceRendu& p : pieces_)
    if (!p.forme.IsNull()) nb++;
  std::vector<std::array<unsigned char, 3>> couleurs(nb);
  for (int i = 0; i < nb; i++) teinte(std::fmod(i * 0.618034, 1.0), 0.75, 0.55, couleurs[i].data());

  const P3 centre{(box_[0] + box_[3]) / 2, (box_[1] + box_[4]) / 2, (box_[2] + box_[5]) / 2};
  const P3 versC = moins(oeil, centre);
  const double dc = std::sqrt(scal(versC, versC)), uN = std::max(0.01, dc - R_), uF = dc + R_;

  wxImage masque(w, h), profondeur(w, h), normales(w, h), ids(w, h), ombre(w, h);
  std::vector<float> couvre(static_cast<size_t>(w) * h);
  for (int y = 0; y < h; y++)
    for (int x = 0; x < w; x++) {
      double m = 0, de = 0, no[3] = {0, 0, 0}, co[3] = {0, 0, 0};
      for (int sy = 0; sy < SS; sy++)
        for (int sx = 0; sx < SS; sx++) {
          const int X = x * SS + sx, Y = y * SS + sy;
          const size_t n = static_cast<size_t>(Y) * W + X;
          if (quel[n] < 0) {
            no[0] += 128 / 255.0, no[1] += 128 / 255.0, no[2] += 1;
            continue;
          }
          const TriangleEcran& e = E[quel[n]];
          m += 1;
          const double z = 1 / prof[n];
          de += 1 - std::clamp((z - uN) / (uF - uN), 0.0, 1.0);
          // La normale, corrigée de la perspective
          const float aire = (e.x[1] - e.x[0]) * (e.y[2] - e.y[0]) - (e.x[2] - e.x[0]) * (e.y[1] - e.y[0]);
          const float px = X + 0.5f, py = Y + 0.5f;
          const float a = ((e.x[1] - px) * (e.y[2] - py) - (e.x[2] - px) * (e.y[1] - py)) / aire;
          const float b = ((e.x[2] - px) * (e.y[0] - py) - (e.x[0] - px) * (e.y[2] - py)) / aire;
          const float c = 1 - a - b;
          double v[3];
          for (int k = 0; k < 3; k++) v[k] = (a * e.iz[0] * e.n[0][k] + b * e.iz[1] * e.n[1][k] + c * e.iz[2] * e.n[2][k]) * z;
          const double lon = std::sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
          for (int k = 0; k < 3; k++) no[k] += (lon > 0 ? v[k] / lon : 0) * 0.5 + 0.5;
          const auto& q = couleurs[e.piece];
          for (int k = 0; k < 3; k++) co[k] += q[k] / 255.0;
        }
      const double N = SS * SS;
      const size_t o = 3 * (static_cast<size_t>(y) * w + x);
      couvre[o / 3] = static_cast<float>(m / N);
      for (int k = 0; k < 3; k++) {
        masque.GetData()[o + k] = octet(m / N);
        profondeur.GetData()[o + k] = octet(de / N);
        normales.GetData()[o + k] = octet(no[k] / N);
        ids.GetData()[o + k] = octet(co[k] / N);
      }
    }
  // Plus besoin du grand dessin : l'ombre a le sien
  std::vector<float>().swap(prof);
  std::vector<int>().swap(quel);

  // L'ombre portée sur le sol : 48 positions de la lampe dans son disque, comme l'affinage de l'image
  const int NO = 1536, NL = 48;
  const double demi = R_ * 4, x0o = cx_ - demi, y0o = cy_ - demi, pasO = 2 * demi / NO;
  std::vector<std::uint16_t> somme(static_cast<size_t>(NO) * NO, 0);
  const int nf = std::max(1, std::min(NL, static_cast<int>(std::thread::hardware_concurrency())));
  std::vector<std::vector<std::uint16_t>> partiel(nf);
  std::vector<std::thread> fils;
  for (int k = 0; k < nf; k++)
    fils.emplace_back([&, k] {
      partiel[k].assign(static_cast<size_t>(NO) * NO, 0);
      std::vector<std::uint8_t> vu(static_cast<size_t>(NO) * NO);
      for (int i = k; i < NL; i += nf) {
        std::fill(vu.begin(), vu.end(), std::uint8_t(0));
        double aL = (cle_[0] + st_.envRot) * PI_ / 180, eL = cle_[1] * PI_ / 180;
        if (i > 0 && st_.douceur > 0) {
          const double s = st_.douceur * 0.4 * PI_ / 180, r1 = std::sqrt(halton(i, 5)), r2 = 2 * PI_ * halton(i, 7);
          aL += r1 * std::cos(r2) * s / std::max(0.2, std::cos(eL));
          eL += r1 * std::sin(r2) * s;
        }
        const P3 l{std::cos(eL) * std::cos(aL), std::cos(eL) * std::sin(aL), std::sin(eL)};
        if (l.z < 0.02) continue;
        for (const Triangle3& t : T) {
          float ax[3], ay[3];
          for (int q = 0; q < 3; q++) {
            const double r = (t.s[q].z - z0_) / l.z;
            ax[q] = static_cast<float>((t.s[q].x - l.x * r - x0o) / pasO);
            ay[q] = static_cast<float>((t.s[q].y - l.y * r - y0o) / pasO);
          }
          const float aire = (ax[1] - ax[0]) * (ay[2] - ay[0]) - (ax[2] - ax[0]) * (ay[1] - ay[0]);
          if (aire == 0) continue;
          const int xa = std::max(0, static_cast<int>(std::floor(std::min({ax[0], ax[1], ax[2]})))), xb = std::min(NO - 1, static_cast<int>(std::ceil(std::max({ax[0], ax[1], ax[2]}))));
          const int ya = std::max(0, static_cast<int>(std::floor(std::min({ay[0], ay[1], ay[2]})))), yb = std::min(NO - 1, static_cast<int>(std::ceil(std::max({ay[0], ay[1], ay[2]}))));
          for (int y = ya; y <= yb; y++)
            for (int x = xa; x <= xb; x++) {
              const float px = x + 0.5f, py = y + 0.5f;
              const float a = ((ax[1] - px) * (ay[2] - py) - (ax[2] - px) * (ay[1] - py)) / aire;
              const float b = ((ax[2] - px) * (ay[0] - py) - (ax[0] - px) * (ay[2] - py)) / aire;
              if (a >= 0 && b >= 0 && a + b <= 1) vu[static_cast<size_t>(y) * NO + x] = 1;
            }
        }
        for (size_t n = 0; n < vu.size(); n++) partiel[k][n] = static_cast<std::uint16_t>(partiel[k][n] + vu[n]);
      }
    });
  for (std::thread& t : fils) t.join();
  for (const auto& q : partiel)
    for (size_t n = 0; n < somme.size(); n++) somme[n] = static_cast<std::uint16_t>(somme[n] + q[n]);
  const auto lire = [&](double px, double py) {
    const double fx = px - 0.5, fy = py - 0.5;
    const int ix = static_cast<int>(std::floor(fx)), iy = static_cast<int>(std::floor(fy));
    if (ix < 0 || iy < 0 || ix >= NO - 1 || iy >= NO - 1) return 0.0;
    const double a = fx - ix, b = fy - iy;
    const std::uint16_t* s = &somme[static_cast<size_t>(iy) * NO + ix];
    return ((1 - b) * ((1 - a) * s[0] + a * s[1]) + b * ((1 - a) * s[NO] + a * s[NO + 1])) / NL;
  };
  for (int y = 0; y < h; y++) {
    const double ny = 1 - 2 * (y + 0.5) / h;
    for (int x = 0; x < w; x++) {
      const double nx = 2 * (x + 0.5) / w - 1;
      const P3 ray{f.x + d.x * nx * tanV * asp + u.x * ny * tanV, f.y + d.y * nx * tanV * asp + u.y * ny * tanV, f.z + d.z * nx * tanV * asp + u.z * ny * tanV};
      double s = 0;
      if (ray.z < -1e-9) {
        const double t = (z0_ - oeil.z) / ray.z;
        if (t > 0) s = lire((oeil.x + ray.x * t - x0o) / pasO, (oeil.y + ray.y * t - y0o) / pasO);
      }
      // La pièce n'écrit rien : elle cache le sol, là où elle est l'image reste blanche
      const double c = couvre[static_cast<size_t>(y) * w + x], v = 1 - (1 - c) * s;
      const size_t o = 3 * (static_cast<size_t>(y) * w + x);
      for (int k = 0; k < 3; k++) ombre.GetData()[o + k] = octet(v);
    }
  }
  L.push_back({"2 - masque.png", masque});
  L.push_back({"3 - profondeur.png", profondeur});
  L.push_back({"4 - normales.png", normales});
  L.push_back({"5 - identifiants.png", ids});
  L.push_back({"6 - ombre.png", ombre});
  return true;
}
