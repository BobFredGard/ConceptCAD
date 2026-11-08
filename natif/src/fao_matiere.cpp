#include "fao_matiere.h"

#include <Graphic3d_Group.hxx>
#include <Graphic3d_MaterialAspect.hxx>
#include <Prs3d_Presentation.hxx>
#include <Quantity_Color.hxx>

#include <algorithm>
#include <cmath>
#include <cstring>

occ::handle<Graphic3d_AspectFillArea3d> aspectEclaire(unsigned couleur, unsigned reflet, double brillance) {
  const auto teinte = [](unsigned c) { return Quantity_Color((c >> 16) / 255.0, ((c >> 8) & 255) / 255.0, (c & 255) / 255.0, Quantity_TOC_sRGB); };
  // Les lumières de la vue sont réglées pour les pièces, bien plus fortes que celles de la page :
  // ce facteur redonne les couleurs mesurées sur le dessus et les parois de la matière
  const auto attenue = [](const Quantity_Color& q, double k) { return Quantity_Color(q.Red() * k, q.Green() * k, q.Blue() * k, Quantity_TOC_RGB); };
  const Quantity_Color c = teinte(couleur);
  Graphic3d_MaterialAspect M(Graphic3d_NameOfMaterial_UserDefined);
  M.SetAmbientColor(attenue(c, 0.1));
  M.SetDiffuseColor(attenue(c, 0.6));
  M.SetSpecularColor(attenue(teinte(reflet), 0.6));
  M.SetShininess(static_cast<float>(std::min(1.0, brillance / 128.0)));
  occ::handle<Graphic3d_AspectFillArea3d> A = new Graphic3d_AspectFillArea3d();
  A->SetInteriorStyle(Aspect_IS_SOLID);
  A->SetInteriorColor(c);
  A->SetBackInteriorColor(c);
  A->SetFrontMaterial(M);
  A->SetBackMaterial(M);
  A->SetDistinguish(false);
  A->SetSuppressBackFaces(false);
  A->SetShadingModel(Graphic3d_TypeOfShadingModel_Phong);
  return A;
}

// faoMatterRayHit (src/88-fao-77-matiere-cartes.js) : dans la boîte du brut, un point est dans la matière
// s'il est sous le dessus de sa colonne ; on avance d'une demi-maille, puis on resserre par dichotomie
bool MatiereFao::viser(const gp_Pnt& o, const gp_Dir& d, gp_Pnt& p) const {
  if (g_.nx <= 0 || g_.ny <= 0) return false;
  const double lo[3] = {g_.ox, g_.oy, g_.oz}, hi[3] = {g_.sx1, g_.sy1, g_.full};
  const double O[3] = {o.X(), o.Y(), o.Z()}, D[3] = {d.X(), d.Y(), d.Z()};
  double t0 = 0, t1 = 1e30;
  for (int k = 0; k < 3; k++) {
    if (std::abs(D[k]) < 1e-12) {
      if (O[k] < lo[k] || O[k] > hi[k]) return false;
      continue;
    }
    double a = (lo[k] - O[k]) / D[k], b = (hi[k] - O[k]) / D[k];
    if (a > b) std::swap(a, b);
    t0 = std::max(t0, a);
    t1 = std::min(t1, b);
    if (t0 > t1) return false;
  }
  const auto dedans = [&](double t) {
    const double x = O[0] + D[0] * t, y = O[1] + D[1] * t, z = O[2] + D[2] * t;
    const int ix = std::clamp(static_cast<int>(std::floor((x - g_.ox) / g_.pas)), 0, g_.nx - 1);
    const int iy = std::clamp(static_cast<int>(std::floor((y - g_.oy) / g_.pas)), 0, g_.ny - 1);
    return z >= g_.oz - 1e-9 && z <= dessus_[ix + iy * g_.nx];
  };
  const double h = std::max(g_.pas * 0.5, 1e-6);
  double avant = t0;
  for (double t = t0;; t += h) {
    const double u = std::min(t, t1);
    if (dedans(u)) {
      double a = avant, b = u;
      if (u > t0)
        for (int i = 0; i < 24; i++) {
          const double m = (a + b) / 2;
          (dedans(m) ? b : a) = m;
        }
      p = gp_Pnt(O[0] + D[0] * b, O[1] + D[1] * b, O[2] + D[2] * b);
      return true;
    }
    avant = u;
    if (u >= t1) return false;
  }
}

MatiereFao::MatiereFao(const GrilleFao& g) : g_(g), nc_(g.nx * g.ny) {
  dessus_.assign(nc_, static_cast<float>(g.full));
  normales_.assign(nc_ * 3, 0.f);
  for (int i = 0; i < nc_; i++) normales_[3 * i + 2] = 1.f;
  parois_.assign(nc_ * 2, 0.f);
  creusee_.assign(nc_, 0);
  vues_.assign(nc_, 0);
  sommets_ = new Graphic3d_AttribBuffer(Graphic3d_Buffer::DefaultAllocator());
  const Graphic3d_Attribute attributs[] = {{Graphic3d_TOA_POS, Graphic3d_TOD_VEC3}, {Graphic3d_TOA_NORM, Graphic3d_TOD_VEC3}};
  if (g.lisse) {
    construireLisse();
    return;
  }
  const int n = nc_ * 30 + 6;
  sommets_->SetMutable(true);
  sommets_->Init(n, attributs, 2);
  const float ox = static_cast<float>(g.ox), oy = static_cast<float>(g.oy), oz = static_cast<float>(g.oz);
  for (int i = 0; i < n; i++) poser(i, ox, oy, oz, 0, 0, 1);
  // Le fond plein du brut, vu de dessous
  const float X0 = ox, X1 = static_cast<float>(g.sx1), Y0 = oy, Y1 = static_cast<float>(g.sy1);
  int o = nc_ * 30;
  poser(o++, X0, Y0, oz, 0, 0, -1);
  poser(o++, X1, Y1, oz, 0, 0, -1);
  poser(o++, X1, Y0, oz, 0, 0, -1);
  poser(o++, X0, Y0, oz, 0, 0, -1);
  poser(o++, X0, Y1, oz, 0, 0, -1);
  poser(o++, X1, Y1, oz, 0, 0, -1);
}

void MatiereFao::poser(int i, float x, float y, float z, float nx, float ny, float nz) {
  float* s = sommet(i);
  s[0] = x;
  s[1] = y;
  s[2] = z;
  s[3] = nx;
  s[4] = ny;
  s[5] = nz;
}

// Même découpe que faoViewerMatterWriteCol : le dessus, et 4 côtés repliés si la voisine est plus haute
void MatiereFao::ecrireColonne(int c) {
  const int nx = g_.nx, ny = g_.ny;
  const double pas = g_.pas;
  const int ix = c % nx, iy = c / nx;
  const double x0d = std::min(g_.ox + ix * pas, g_.sx1), y0d = std::min(g_.oy + iy * pas, g_.sy1);
  const double x1d = std::min(g_.ox + (ix + 1) * pas, g_.sx1), y1d = std::min(g_.oy + (iy + 1) * pas, g_.sy1);
  if (!(x1d > x0d) || !(y1d > y0d)) return;
  const float x0 = static_cast<float>(x0d), x1 = static_cast<float>(x1d), y0 = static_cast<float>(y0d), y1 = static_cast<float>(y1d);
  const float oz = static_cast<float>(g_.oz), zt = dessus_[c];
  const bool cv = creusee_[c] != 0;
  const float zN = iy > 0 ? dessus_[c - nx] : oz, zS = iy < ny - 1 ? dessus_[c + nx] : oz, zW = ix > 0 ? dessus_[c - 1] : oz, zE = ix < nx - 1 ? dessus_[c + 1] : oz;
  const float n2 = cv ? zt : std::min(zN, zt), s2 = cv ? zt : std::min(zS, zt), w2 = cv ? zt : std::min(zW, zt), e2 = cv ? zt : std::min(zE, zt);
  struct V {
    float x, y, z;
  };
  const auto paroi = [&](int nb, float fx, float fy) -> V {
    if (nb >= 0) {
      const float wx = parois_[nb * 2], wy = parois_[nb * 2 + 1];
      if (wx * wx + wy * wy > 0.5f && wx * fx + wy * fy > 0.2f) return {wx, wy, 0};
    }
    return {fx, fy, 0};
  };
  const V tn{normales_[3 * c], normales_[3 * c + 1], normales_[3 * c + 2]};
  const V vN = paroi(iy > 0 ? c - nx : -1, 0, -1), vS = paroi(iy < ny - 1 ? c + nx : -1, 0, 1), vW = paroi(ix > 0 ? c - 1 : -1, -1, 0), vE = paroi(ix < nx - 1 ? c + 1 : -1, 1, 0);
  int o = c * 30;
  marquer(o);
  marquer(o + 29);
  const auto put = [&](float x, float y, float z, const V& n) { poser(o++, x, y, z, n.x, n.y, n.z); };
  put(x0, y0, zt, tn), put(x1, y0, zt, tn), put(x1, y1, zt, tn), put(x0, y0, zt, tn), put(x1, y1, zt, tn), put(x0, y1, zt, tn);
  put(x0, y0, n2, vN), put(x1, y0, n2, vN), put(x1, y0, zt, vN), put(x0, y0, n2, vN), put(x1, y0, zt, vN), put(x0, y0, zt, vN);
  put(x1, y1, s2, vS), put(x0, y1, s2, vS), put(x0, y1, zt, vS), put(x1, y1, s2, vS), put(x0, y1, zt, vS), put(x1, y1, zt, vS);
  put(x0, y1, w2, vW), put(x0, y0, w2, vW), put(x0, y0, zt, vW), put(x0, y1, w2, vW), put(x0, y0, zt, vW), put(x0, y1, zt, vW);
  put(x1, y0, e2, vE), put(x1, y1, e2, vE), put(x1, y1, zt, vE), put(x1, y0, e2, vE), put(x1, y1, zt, vE), put(x1, y0, zt, vE);
}

// Comme faoViewerMatterHFBuild : les nœuds, les murs de bord et le fond
void MatiereFao::construireLisse() {
  const int nx = g_.nx, ny = g_.ny;
  NX_ = nx + 1;
  NY_ = ny + 1;
  NV_ = NX_ * NY_;
  const int E = 2 * nx + 2 * ny, total = NV_ + 4 * E + 4;
  const Graphic3d_Attribute attributs[] = {{Graphic3d_TOA_POS, Graphic3d_TOD_VEC3}, {Graphic3d_TOA_NORM, Graphic3d_TOD_VEC3}};
  sommets_->SetMutable(true);
  sommets_->Init(total, attributs, 2);
  n2top_.assign(NV_ * 2, -1);
  vusN_.assign(NV_, 0);
  vusZ_.assign(NV_, 0);
  cumul_.assign(NV_ * 3, 0.f);
  indices_ = new Graphic3d_IndexBuffer(Graphic3d_Buffer::DefaultAllocator());
  indices_->Init<unsigned int>(nc_ * 6 + E * 6 + 6);
  unsigned int* idx = reinterpret_cast<unsigned int*>(indices_->ChangeData());
  const float full = static_cast<float>(g_.full), oz = static_cast<float>(g_.oz);
  const auto X = [&](int i) { return static_cast<float>(std::min(g_.ox + i * g_.pas, g_.sx1)); };
  const auto Y = [&](int j) { return static_cast<float>(std::min(g_.oy + j * g_.pas, g_.sy1)); };
  for (int j = 0; j < NY_; j++)
    for (int i = 0; i < NX_; i++) poser(j * NX_ + i, X(i), Y(j), full, 0, 0, 1);
  int io = 0;
  for (int j = 0; j < ny; j++)
    for (int i = 0; i < nx; i++) {
      const unsigned a = j * NX_ + i, b = a + 1, c = a + NX_, d = a + NX_ + 1;
      idx[io++] = a, idx[io++] = b, idx[io++] = d, idx[io++] = a, idx[io++] = d, idx[io++] = c;
    }
  int e = 0;
  const auto mur = [&](int A, int B, float ex, float ey) {
    const int w = NV_ + e * 4;
    const float ax = sommet(A)[0], ay = sommet(A)[1], bx = sommet(B)[0], by = sommet(B)[1];
    poser(w, ax, ay, full, ex, ey, 0);
    poser(w + 1, bx, by, full, ex, ey, 0);
    poser(w + 2, bx, by, oz, ex, ey, 0);
    poser(w + 3, ax, ay, oz, ex, ey, 0);
    idx[io++] = w, idx[io++] = w + 1, idx[io++] = w + 2, idx[io++] = w, idx[io++] = w + 2, idx[io++] = w + 3;
    if (n2top_[A * 2] < 0) n2top_[A * 2] = w;
    else n2top_[A * 2 + 1] = w;
    if (n2top_[B * 2] < 0) n2top_[B * 2] = w + 1;
    else n2top_[B * 2 + 1] = w + 1;
    e++;
  };
  for (int i = 0; i < nx; i++) mur(i, i + 1, 0, -1);
  for (int i = 0; i < nx; i++) mur(ny * NX_ + i, ny * NX_ + i + 1, 0, 1);
  for (int j = 0; j < ny; j++) mur(j * NX_, (j + 1) * NX_, -1, 0);
  for (int j = 0; j < ny; j++) mur(j * NX_ + nx, (j + 1) * NX_ + nx, 1, 0);
  const int b0 = NV_ + 4 * E;
  poser(b0, X(0), Y(0), oz, 0, 0, -1);
  poser(b0 + 1, static_cast<float>(g_.sx1), Y(0), oz, 0, 0, -1);
  poser(b0 + 2, static_cast<float>(g_.sx1), static_cast<float>(g_.sy1), oz, 0, 0, -1);
  poser(b0 + 3, X(0), static_cast<float>(g_.sy1), oz, 0, 0, -1);
  idx[io++] = b0, idx[io++] = b0 + 1, idx[io++] = b0 + 2, idx[io++] = b0, idx[io++] = b0 + 2, idx[io++] = b0 + 3;
}

// Comme faoViewerMatterHFUpdate : la hauteur des nœuds touchés, puis leurs normales
void MatiereFao::lisser(const std::vector<int>& chg) {
  const int nx = g_.nx, ny = g_.ny;
  std::vector<int> zListe;
  for (int c : chg) {
    const int i = c % nx, j = c / nx;
    for (int dj = 0; dj < 2; dj++)
      for (int di = 0; di < 2; di++) {
        const int ni = i + di, nj = j + dj, n = nj * NX_ + ni;
        if (vusZ_[n]) continue;
        vusZ_[n] = 1;
        zListe.push_back(n);
        float somme = 0;
        int cnt = 0;
        for (int cj = std::max(0, nj - 1); cj <= std::min(ny - 1, nj); cj++)
          for (int ci = std::max(0, ni - 1); ci <= std::min(nx - 1, ni); ci++) {
            somme += dessus_[ci + cj * nx];
            cnt++;
          }
        if (cnt) sommet(n)[2] = somme / cnt;
        for (int s = 0; s < 2; s++) {
          const int w = n2top_[n * 2 + s];
          if (w >= 0) {
            sommet(w)[2] = sommet(n)[2];
            marquer(w);
          }
        }
      }
  }
  std::vector<int> cListe, nListe;
  for (int n : zListe) {
    vusZ_[n] = 0;
    const int ni = n % NX_, nj = n / NX_;
    for (int cj = std::max(0, nj - 1); cj <= std::min(ny - 1, nj); cj++)
      for (int ci = std::max(0, ni - 1); ci <= std::min(nx - 1, ni); ci++) {
        const int c = ci + cj * nx;
        if (!vues_[c]) {
          vues_[c] = 1;
          cListe.push_back(c);
        }
      }
  }
  const auto triangle = [&](int a, int b, int c) {
    const float* A = sommet(a);
    const float* B = sommet(b);
    const float* C = sommet(c);
    const float ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const float x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    for (int q : {a, b, c}) {
      cumul_[q * 3] += x;
      cumul_[q * 3 + 1] += y;
      cumul_[q * 3 + 2] += z;
    }
  };
  for (int c : cListe) {
    vues_[c] = 0;
    const int i = c % nx, j = c / nx, a = j * NX_ + i, b = a + 1, cN = a + NX_, dN = a + NX_ + 1;
    for (int q : {a, b, cN, dN})
      if (!vusN_[q]) {
        vusN_[q] = 1;
        nListe.push_back(q);
      }
    triangle(a, b, dN);
    triangle(a, dN, cN);
  }
  for (int n : nListe) {
    vusN_[n] = 0;
    float* A = &cumul_[n * 3];
    const float L = std::sqrt(A[0] * A[0] + A[1] * A[1] + A[2] * A[2]);
    float* s = sommet(n);
    if (L > 1e-12f) {
      s[3] = A[0] / L;
      s[4] = A[1] / L;
      s[5] = A[2] / L;
    } else {
      s[3] = 0;
      s[4] = 0;
      s[5] = 1;
    }
    A[0] = A[1] = A[2] = 0;
    marquer(n);
  }
}

void MatiereFao::colonnes(const float* v, size_t n) {
  std::vector<int> chg;
  chg.reserve(n);
  for (size_t k = 0; k < n; k++, v += 8) {
    const int c = static_cast<int>(v[0]);
    if (c < 0 || c >= nc_) continue;
    dessus_[c] = v[1];
    normales_[3 * c] = v[2];
    normales_[3 * c + 1] = v[3];
    normales_[3 * c + 2] = v[4];
    parois_[2 * c] = v[5];
    parois_[2 * c + 1] = v[6];
    creusee_[c] = v[7] != 0;
    chg.push_back(c);
  }
  if (chg.empty()) return;
  if (g_.lisse) lisser(chg);
  else {
    // Une colonne qui descend change aussi les côtés de ses quatre voisines
    std::vector<int> liste;
    liste.reserve(chg.size() * 2);
    const auto voir = [&](int c) {
      if (c >= 0 && c < nc_ && !vues_[c]) {
        vues_[c] = 1;
        liste.push_back(c);
      }
    };
    for (int c : chg) {
      voir(c);
      if (c % g_.nx > 0) voir(c - 1);
      if (c % g_.nx < g_.nx - 1) voir(c + 1);
      voir(c - g_.nx);
      voir(c + g_.nx);
    }
    for (int c : liste) {
      vues_[c] = 0;
      ecrireColonne(c);
    }
  }
  if (haut_ >= bas_) sommets_->Invalidate(bas_, haut_);
  bas_ = 0x7fffffff;
  haut_ = -1;
}

void MatiereFao::Compute(const occ::handle<PrsMgr_PresentationManager>&, const occ::handle<Prs3d_Presentation>& prs, const int) {
  occ::handle<Graphic3d_Group> g = prs->CurrentGroup();
  g->SetGroupPrimitivesAspect(aspectEclaire(g_.couleur, g_.reflet, g_.brillance));
  g->AddPrimitiveArray(Graphic3d_TOPA_TRIANGLES, indices_, sommets_, occ::handle<Graphic3d_BoundBuffer>());
}
