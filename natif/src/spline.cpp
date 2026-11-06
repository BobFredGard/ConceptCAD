#include "spline.h"

#include <algorithm>
#include <cmath>

#include "maths_js.h"
#include "projet.h"

namespace {
int bsSpan(int n, int p, double u, const std::vector<double>& U) {
  if (u >= U[n + 1]) return n;
  if (u <= U[p]) return p;
  int lo = p, hi = n + 1, mid = (lo + hi) >> 1;
  while (u < U[mid] || u >= U[mid + 1]) {
    if (u < U[mid]) hi = mid;
    else lo = mid;
    mid = (lo + hi) >> 1;
  }
  return mid;
}

// Fonctions de base non nulles et leurs dérivées (Piegl et Tiller, A2.3)
std::vector<std::vector<double>> bsDersBasis(int i, double u, int p, int nd, const std::vector<double>& U) {
  std::vector<std::vector<double>> ndu(p + 1, std::vector<double>(p + 1, 0));
  std::vector<double> left(p + 1, 0), right(p + 1, 0);
  ndu[0][0] = 1;
  for (int j = 1; j <= p; j++) {
    left[j] = u - U[i + 1 - j];
    right[j] = U[i + j] - u;
    double saved = 0;
    for (int r = 0; r < j; r++) {
      ndu[j][r] = right[r + 1] + left[j - r];
      const double t = ndu[r][j - 1] / ndu[j][r];
      ndu[r][j] = saved + right[r + 1] * t;
      saved = left[j - r] * t;
    }
    ndu[j][j] = saved;
  }
  std::vector<std::vector<double>> ders(nd + 1, std::vector<double>(p + 1, 0));
  for (int j = 0; j <= p; j++) ders[0][j] = ndu[j][p];
  std::vector<std::vector<double>> a(2, std::vector<double>(p + 1, 0));
  for (int r = 0; r <= p; r++) {
    int s1 = 0, s2 = 1;
    a[0][0] = 1;
    for (int k = 1; k <= nd; k++) {
      double d = 0;
      const int rk = r - k, pk = p - k;
      if (r >= k) {
        a[s2][0] = a[s1][0] / ndu[pk + 1][rk];
        d = a[s2][0] * ndu[rk][pk];
      }
      const int j1 = rk >= -1 ? 1 : -rk, j2 = (r - 1 <= pk) ? k - 1 : p - r;
      for (int j = j1; j <= j2; j++) {
        a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j];
        d += a[s2][j] * ndu[rk + j][pk];
      }
      if (r <= pk) {
        a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r];
        d += a[s2][k] * ndu[r][pk];
      }
      ders[k][r] = d;
      std::swap(s1, s2);
    }
  }
  double f = p;
  for (int k = 1; k <= nd; k++) {
    for (int j = 0; j <= p; j++) ders[k][j] *= f;
    f *= (p - k);
  }
  return ders;
}

// Élimination de Gauss à pivot partiel
bool bsSolve(std::vector<std::vector<double>>& A, std::vector<double>& bx, std::vector<double>& by, std::vector<P2d>& out) {
  const int n = static_cast<int>(A.size());
  for (int c = 0; c < n; c++) {
    int b = c;
    double bv = std::abs(A[c][c]);
    for (int r = c + 1; r < n; r++) {
      const double v = std::abs(A[r][c]);
      if (v > bv) {
        bv = v;
        b = r;
      }
    }
    if (!(bv > 1e-14)) return false;
    if (b != c) {
      std::swap(A[b], A[c]);
      std::swap(bx[b], bx[c]);
      std::swap(by[b], by[c]);
    }
    for (int r = c + 1; r < n; r++) {
      const double f = A[r][c] / A[c][c];
      if (f == 0) continue;
      for (int k = c; k < n; k++) A[r][k] -= f * A[c][k];
      bx[r] -= f * bx[c];
      by[r] -= f * by[c];
    }
  }
  out.assign(n, P2d{0, 0});
  for (int r = n - 1; r >= 0; r--) {
    double sx = bx[r], sy = by[r];
    for (int k = r + 1; k < n; k++) {
      sx -= A[r][k] * out[k][0];
      sy -= A[r][k] * out[k][1];
    }
    out[r] = {sx / A[r][r], sy / A[r][r]};
  }
  return true;
}
}  // namespace

std::vector<P2d> bsEval(const BSpline& bs, double u, int nd) {
  const int p = bs.p, n = static_cast<int>(bs.P.size()) - 1, nk = std::min(nd, p);
  const int s = bsSpan(n, p, u, bs.U);
  const auto D = bsDersBasis(s, u, p, nk, bs.U);
  std::vector<P2d> out;
  for (int k = 0; k <= nk; k++) {
    double x = 0, y = 0;
    for (int j = 0; j <= p; j++) {
      const P2d& q = bs.P[s - p + j];
      x += D[k][j] * q[0];
      y += D[k][j] * q[1];
    }
    out.push_back({x, y});
  }
  while (static_cast<int>(out.size()) <= nd) out.push_back({0, 0});
  return out;
}

bool bsInterpolate(const std::vector<P2d>& Q, const std::vector<P2d>& H, const std::vector<char>& aH, bool closed, BSpline& out) {
  if (Q.size() < 2) return false;
  std::vector<P2d> X = Q, HH = H;
  std::vector<char> A = aH;
  if (closed) {
    X.push_back(Q[0]);
    HH.push_back(H[0]);
    A.push_back(aH[0]);
  }
  const int n = static_cast<int>(X.size()) - 1;
  std::vector<double> d{0}, u{0};
  for (int k = 1; k <= n; k++) d.push_back(jsmax(hyp(X[k][0] - X[k - 1][0], X[k][1] - X[k - 1][1]), 1e-6));
  for (int k = 1; k <= n; k++) u.push_back(u[k - 1] + d[k]);
  const auto deriv = [&](int k, P2d& v) {  // la dérivée imposée par la poignée du point k
    if (!A[k]) return false;
    const double vx = HH[k][0] - X[k][0], vy = HH[k][1] - X[k][1];
    if (!closed && k == 0) {
      v = {-3 * vx / d[1], -3 * vy / d[1]};
      return true;
    }
    if (!closed && k == n) {
      v = {3 * vx / d[n], 3 * vy / d[n]};
      return true;
    }
    const double dp = k > 0 ? d[k] : d[n], dn = k < n ? d[k + 1] : d[1], a = (dp + dn) / 2;
    v = {3 * vx / a, 3 * vy / a};
    return true;
  };
  const int p = 3;
  std::vector<double> U{u[0], u[0], u[0], u[0]};
  for (int k = 1; k < n; k++) {
    U.push_back(u[k]);
    if (A[k]) U.push_back(u[k]);
  }
  for (int i = 0; i < 4; i++) U.push_back(u[n]);
  const int nP = static_cast<int>(U.size()) - p - 1;
  std::vector<std::vector<double>> rows;
  std::vector<double> bx, by;
  const auto row = [&](double t, int o, double rx, double ry, const double* sub) {
    std::vector<double> r(nP, 0);
    const auto add = [&](double tt, double sg) {
      const int s = bsSpan(nP - 1, p, tt, U);
      const auto D = bsDersBasis(s, tt, p, o, U);
      for (int j = 0; j <= p; j++) r[s - p + j] += sg * D[o][j];
    };
    add(t, 1);
    if (sub) add(*sub, -1);
    rows.push_back(std::move(r));
    bx.push_back(rx);
    by.push_back(ry);
  };
  for (int k = 0; k <= n; k++) row(u[k], 0, X[k][0], X[k][1], nullptr);
  P2d D;
  for (int k = 1; k < n; k++)
    if (deriv(k, D)) row(u[k], 1, D[0], D[1], nullptr);
  if (closed) {
    if (deriv(0, D)) {
      row(u[0], 1, D[0], D[1], nullptr);
      row(u[n], 1, D[0], D[1], nullptr);
    } else {
      row(u[0], 1, 0, 0, &u[n]);
      row(u[0], 2, 0, 0, &u[n]);
    }
  } else {
    if (deriv(0, D)) row(u[0], 1, D[0], D[1], nullptr);
    else row(u[0], 2, 0, 0, nullptr);
    if (deriv(n, D)) row(u[n], 1, D[0], D[1], nullptr);
    else row(u[n], 2, 0, 0, nullptr);
  }
  if (static_cast<int>(rows.size()) != nP) return false;
  std::vector<P2d> P;
  if (!bsSolve(rows, bx, by, P)) return false;
  P[0] = X[0];  // bouts exacts : jonctions au bit près avec les lignes voisines
  P[nP - 1] = X[n];
  out = BSpline{};
  out.U = U;
  out.P = P;
  out.u = u;
  out.d = d;
  out.closed = closed;
  out.n = n;
  out.p = p;
  out.a = U.front();
  out.b = U.back();
  return true;
}

bool bsControl(const std::vector<P2d>& Q, bool closed, const std::vector<double>* knots, int deg, BSpline& out) {
  const int m = static_cast<int>(Q.size());
  out = BSpline{};
  out.ctrl = true;
  if (!closed && knots) {
    const int p = deg ? deg : 3;
    if (static_cast<int>(knots->size()) == m + p + 1 && p >= 1 && p < m) {
      out.U = *knots;
      out.P = Q;
      out.p = p;
      out.closed = false;
      out.a = (*knots)[p];
      out.b = (*knots)[m];
      return true;
    }
  }
  if (!closed) {
    const int p = std::min(3, m - 1);
    if (p < 1) return false;
    const int n = m - 1;
    for (int i = 0; i <= p; i++) out.U.push_back(0);
    for (int k = 1; k <= n - p; k++) out.U.push_back(k);
    for (int i = 0; i <= p; i++) out.U.push_back(n - p + 1);
    out.P = Q;
    out.p = p;
    out.a = 0;
    out.b = n - p + 1;
    return true;
  }
  const int p = std::min(3, m - 1);
  if (m < 3) return false;
  out.P = Q;
  for (int i = 0; i < p; i++) out.P.push_back(Q[i]);
  for (int i = 0; i < static_cast<int>(out.P.size()) + p + 1; i++) out.U.push_back(i);
  out.p = p;
  out.closed = true;
  out.a = out.U[p];
  out.b = out.U[out.P.size()];
  return true;
}

std::vector<EchantillonU> bsSampleU(const BSpline& bs, double u0, double u1, int per) {
  std::vector<EchantillonU> out;
  std::vector<double> br{u0};
  for (const double v : bs.U)
    if (v > u0 + 1e-12 && v < u1 - 1e-12 && std::find(br.begin(), br.end(), v) == br.end()) br.push_back(v);
  br.push_back(u1);
  for (size_t i = 0; i + 1 < br.size(); i++) {
    const double a = br[i], b = br[i + 1];
    for (int k = i ? 1 : 0; k <= per; k++) {
      const double u = a + (b - a) * k / per;
      const P2d c = bsEval(bs, u, 0)[0];
      out.push_back({u, c[0], c[1]});
    }
  }
  return out;
}

std::vector<P2d> bsSample(const BSpline& bs, double u0, double u1, int per) {
  std::vector<P2d> out;
  for (const EchantillonU& e : bsSampleU(bs, u0, u1, per)) out.push_back({e.x, e.y});
  return out;
}

double bsNewtonClosest(const BSpline& f, double u, double x, double y) {
  for (int it = 0; it < 12; it++) {
    const auto D = bsEval(f, u, 2);
    const double rx = D[0][0] - x, ry = D[0][1] - y, g = rx * D[1][0] + ry * D[1][1], h = D[1][0] * D[1][0] + D[1][1] * D[1][1] + rx * D[2][0] + ry * D[2][1];
    if (!(h > 1e-18)) break;
    const double nu = jsmin(f.b, jsmax(f.a, u - g / h));
    if (std::abs(nu - u) < 1e-13 * (1 + std::abs(u))) {
      u = nu;
      break;
    }
    u = nu;
  }
  return u;
}

PiedSpline bsClosest(const BSpline& f, double x, double y, const double* u0) {
  double u = 0;
  bool ok = u0 && *u0 >= f.a && *u0 <= f.b;
  if (ok) u = *u0;
  if (!ok) {
    const auto S = bsSampleU(f, f.a, f.b, 10);
    double bd = 1e308;
    for (size_t i = 0; i + 1 < S.size(); i++) {
      const auto& A = S[i];
      const auto& B = S[i + 1];
      const double dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
      double t = L2 > 1e-24 ? ((x - A.x) * dx + (y - A.y) * dy) / L2 : 0;
      t = jsmax(0, jsmin(1, t));
      const double d = hyp(A.x + t * dx - x, A.y + t * dy - y);
      if (d < bd) {
        bd = d;
        u = A.u + t * (B.u - A.u);
      }
    }
  }
  u = bsNewtonClosest(f, u, x, y);
  const auto D = bsEval(f, u, 1);
  const double L0 = hyp(D[1][0], D[1][1]), L = L0 != 0 ? L0 : 1e-12, nx = -D[1][1] / L, ny = D[1][0] / L;
  PiedSpline r;
  r.u = u;
  r.x = D[0][0];
  r.y = D[0][1];
  r.d = hyp(x - D[0][0], y - D[0][1]);
  r.s = (x - D[0][0]) * nx + (y - D[0][1]) * ny;
  r.nx = nx;
  r.ny = ny;
  return r;
}

std::vector<double> bsRoots(const BSpline& f, const std::function<double(double)>& g, int per) {
  const auto S = bsSampleU(f, f.a, f.b, per);
  std::vector<double> out;
  double pu = S[0].u, pg = g(pu);
  if (std::abs(pg) < 1e-9) out.push_back(pu);
  for (size_t i = 1; i < S.size(); i++) {
    const double u = S[i].u, gu = g(u);
    if (std::abs(gu) < 1e-9) {
      out.push_back(u);
    } else if (pg * gu < 0 && std::abs(pg) >= 1e-9) {
      double a = pu, b = u, ga = pg;
      for (int k = 0; k < 60; k++) {
        const double m = (a + b) / 2, gm = g(m);
        if (ga * gm <= 0) {
          b = m;
        } else {
          a = m;
          ga = gm;
        }
      }
      out.push_back((a + b) / 2);
    }
    pu = u;
    pg = gu;
  }
  return out;
}

BSpline bsInsertKnot(const BSpline& bs, double u) {
  const int p = bs.p, n = static_cast<int>(bs.P.size()) - 1, k = bsSpan(n, p, u, bs.U);
  BSpline r;
  r.p = p;
  r.U.assign(bs.U.begin(), bs.U.begin() + k + 1);
  r.U.push_back(u);
  r.U.insert(r.U.end(), bs.U.begin() + k + 1, bs.U.end());
  for (int i = 0; i <= n + 1; i++) {
    if (i <= k - p) {
      r.P.push_back(bs.P[i]);
    } else if (i > k) {
      r.P.push_back(bs.P[i - 1]);
    } else {
      const double a = (u - bs.U[i]) / (bs.U[i + p] - bs.U[i]);
      r.P.push_back({(1 - a) * bs.P[i - 1][0] + a * bs.P[i][0], (1 - a) * bs.P[i - 1][1] + a * bs.P[i][1]});
    }
  }
  return r;
}

void bsSplit(const BSpline& bs, double u, const P2d* Pu, BSpline& gauche, BSpline& droite) {
  const int p = bs.p;
  BSpline c;
  c.U = bs.U;
  c.P = bs.P;
  c.p = p;
  int s = static_cast<int>(std::count(c.U.begin(), c.U.end(), u));
  while (s < p) {
    c = bsInsertKnot(c, u);
    s++;
  }
  const int r = static_cast<int>(std::find(c.U.begin(), c.U.end(), u) - c.U.begin());
  if (Pu) c.P[r - 1] = *Pu;
  gauche = BSpline{};
  gauche.p = p;
  gauche.U.assign(c.U.begin(), c.U.begin() + r + p);
  gauche.U.push_back(u);
  gauche.P.assign(c.P.begin(), c.P.begin() + r);
  droite = BSpline{};
  droite.p = p;
  droite.U.push_back(u);
  droite.U.insert(droite.U.end(), c.U.begin() + r, c.U.end());
  droite.P.assign(c.P.begin() + r - 1, c.P.end());
}

BSpline bsRange(const BSpline& bs, double u0, double u1, const P2d* P0, const P2d* P1) {
  const int p = bs.p;
  const double a = bs.U[p], b = bs.U[bs.P.size()];
  const size_t L = bs.U.size() - 1;
  BSpline c;
  c.U = bs.U;
  c.P = bs.P;
  c.p = p;
  BSpline g, d;
  if (u0 > a + 1e-12 || bs.U[0] != bs.U[p]) {
    bsSplit(c, u0, P0, g, d);
    c = d;
  }
  if (u1 < b - 1e-12 || bs.U[L] != bs.U[L - p]) {
    bsSplit(c, u1, P1, g, d);
    c = g;
  }
  return c;
}

BSpline bsJoin(const BSpline& A, const BSpline& B) {
  const int p = A.p;
  const double ke = A.U.back(), s2 = B.U[0];
  BSpline r;
  r.p = p;
  r.U.assign(A.U.begin(), A.U.end() - 1);
  for (size_t i = p + 1; i < B.U.size(); i++) r.U.push_back(B.U[i] - s2 + ke);
  r.P = A.P;
  r.P.insert(r.P.end(), B.P.begin() + 1, B.P.end());
  return r;
}

bool splineDe(const Esquisse& s, const Entite& e, BSpline& f) {
  if (e.t != "spline" || e.pts.size() < 2) return false;
  const bool ctrl = e.mode == "ctrl";
  std::vector<P2d> Q, H;
  std::vector<char> A;
  for (const std::string& id : e.pts) {
    const Pt* q = s.point(id);
    if (!q) return false;
    Q.push_back({q->x, q->y});
    const Pt* h = nullptr;
    if (!ctrl)
      for (const Entite& l : s.entites)
        if (l.t == "line" && l.handle == e.id && l.p1 == id && !l.p2.empty()) h = s.point(l.p2);
    H.push_back(h ? P2d{h->x, h->y} : P2d{0, 0});
    A.push_back(h != nullptr);
  }
  const bool ferme = e.closed && e.pts.size() >= 3;
  return ctrl ? bsControl(Q, ferme, e.knots.empty() ? nullptr : &e.knots, e.deg, f) : bsInterpolate(Q, H, A, ferme, f);
}
