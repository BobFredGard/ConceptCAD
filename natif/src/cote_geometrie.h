// La géométrie d'une cote : commune à la vue, qui la dessine, et au dessin, qui la déplace.
#pragma once
#include <string>

#include "maths_js.h"
#include "projet.h"

struct P2 {
  double x, y;
};
inline double dist(const P2& a, const P2& b) { return hyp(a.x - b.x, a.y - b.y); }

// Géométrie d'une cote linéaire : dimSeg (src/50-esquisse-4). Rend false s'il manque une référence.
struct Seg {
  P2 a{}, b{}, A{}, B{};
  double nx = 0, ny = 0, w = 0, ux = 0, uy = 0;
  char hv = 0;
  double cx = 0, cy = 0;
};
inline bool segment(const Esquisse& s, const Cote& d, Seg& S) {
  auto pt = [&](const std::string& id, P2& o) {
    const Pt* q = s.point(id);
    if (!q) return false;
    o = {q->x, q->y};
    return true;
  };
  if (d.type == "length" || d.type == "distance") {
    if (d.type == "length") {
      const Entite* l = s.entite(d.line);
      if (!l || !pt(l->p1, S.A) || !pt(l->p2, S.B)) return false;
    } else if (!pt(d.a, S.A) || !pt(d.b, S.B)) {
      return false;
    }
    const double w = d.aW ? d.w : (d.type == "length" ? 5 : 0);
    S.w = w;
    if (d.orient == "h") {
      S.cy = (S.A.y + S.B.y) / 2 + w;
      S.a = {S.A.x, S.cy};
      S.b = {S.B.x, S.cy};
      S.nx = 0;
      S.ny = 1;
      S.hv = 'h';
    } else if (d.orient == "v") {
      S.cx = (S.A.x + S.B.x) / 2 + w;
      S.a = {S.cx, S.A.y};
      S.b = {S.cx, S.B.y};
      S.nx = 1;
      S.ny = 0;
      S.hv = 'v';
    } else {
      double L = dist(S.A, S.B);
      if (L == 0) L = 1e-9;
      S.nx = -(S.B.y - S.A.y) / L;
      S.ny = (S.B.x - S.A.x) / L;
      S.a = {S.A.x + S.nx * w, S.A.y + S.ny * w};
      S.b = {S.B.x + S.nx * w, S.B.y + S.ny * w};
    }
    return true;
  }
  if (d.type == "gap") {
    const Entite* A = s.entite(d.a);
    const Entite* B = s.entite(d.b);
    P2 A1, A2, B1, B2;
    if (!A || !B || !pt(A->p1, A1) || !pt(A->p2, A2) || !pt(B->p1, B1) || !pt(B->p2, B2)) return false;
    double L = dist(A1, A2);
    if (L == 0) L = 1e-9;
    S.ux = (A2.x - A1.x) / L;
    S.uy = (A2.y - A1.y) / L;
    S.nx = -S.uy;
    S.ny = S.ux;
    const P2 Am{(A1.x + A2.x) / 2, (A1.y + A2.y) / 2}, Bm{(B1.x + B2.x) / 2, (B1.y + B2.y) / 2};
    const double ecart = (Bm.x - Am.x) * S.nx + (Bm.y - Am.y) * S.ny;
    S.a = {Am.x + S.ux * d.sl, Am.y + S.uy * d.sl};
    S.b = {S.a.x + S.nx * ecart, S.a.y + S.ny * ecart};
    return true;
  }
  if (d.type == "distline") {
    const Entite* l = s.entite(d.line);
    P2 Q, A, B;
    if (!l || l->t != "line" || !pt(d.p, Q) || !pt(l->p1, A) || !pt(l->p2, B)) return false;
    const double dx = B.x - A.x, dy = B.y - A.y;
    double L2 = dx * dx + dy * dy;
    if (L2 == 0) L2 = 1e-9;
    const double t = ((Q.x - A.x) * dx + (Q.y - A.y) * dy) / L2;
    const P2 F{A.x + dx * t, A.y + dy * t};
    double L = dist(Q, F);
    if (L > 1e-9) {
      S.nx = -(F.y - Q.y) / L;
      S.ny = (F.x - Q.x) / L;
    } else {
      L = hyp(dx, dy);
      if (L == 0) L = 1e-9;
      S.nx = dx / L;
      S.ny = dy / L;
    }
    S.w = d.aW ? d.w : 0;
    S.a = {Q.x + S.nx * S.w, Q.y + S.ny * S.w};
    S.b = {F.x + S.nx * S.w, F.y + S.ny * S.w};
    S.A = Q;
    S.B = F;
    return true;
  }
  return false;
}
