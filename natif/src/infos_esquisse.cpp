#include "infos_esquisse.h"

#include <cmath>
#include <cstdio>

#include "contours.h"
#include "solveur.h"

namespace {
std::string fixe(double v, int n) {
  char b[64];
  std::snprintf(b, sizeof b, "%.*f", n, v);
  return b;
}
std::string fin3(const std::string& id) { return id.size() > 3 ? id.substr(id.size() - 3) : id; }

struct FicheContrainte {
  const char* type;
  const char* nom;
  const char* icone;
};
const FicheContrainte FICHES[] = {
    {"h", "Horizontal", "h"},
    {"v", "Vertical", "v"},
    {"parallel", "Parallèle", "parallel"},
    {"perpendicular", "Perpendiculaire", "perpendicular"},
    {"collinear", "Colinéaire", "collinear"},
    {"equal", "Égal", "equal"},
    {"symmetric", "Symétrie", "symmetric"},
    {"fix", "Fixe", "fix"},
    {"tangent", "Tangence", "tangent"},
    {"tangent2", "Tangence", "tangent2"},
    {"coaxial", "Coaxial", "coaxial"},
    {"coincident", "Coïncident", "coincident"},
    {"midpoint", "Milieu", "midpoint"},
    {"online", "Point sur ligne", "online"},
    {"oncircle", "Point sur courbe", "oncircle"},
    {"stangent", "Tangence", "tangent"},
    {"onspline", "Point sur courbe", "oncircle"},
    {"scurv", "Courbure (G2)", "curvature"},
    {"offset", "Décalage égal", "offset"},
};
}  // namespace

std::string nomContrainte(const std::string& type) {
  for (const FicheContrainte& f : FICHES)
    if (type == f.type) return f.nom;
  return type;
}
std::string iconeContrainte(const std::string& type) {
  for (const FicheContrainte& f : FICHES)
    if (type == f.type) return f.icone;
  return "fix";
}

bool InfosEsquisse::determinee(const Entite& e) const {
  for (const std::string* q : {&e.p1, &e.p2, &e.p, &e.pc, &e.pa, &e.pb})
    if (!q->empty() && !pointDetermine(*q)) return false;
  for (const std::string& q : e.pts)
    if (!pointDetermine(q)) return false;
  for (const std::string& q : poigneesDe_(e))
    if (!pointDetermine(q)) return false;
  if ((e.t == "circle" || e.t == "arc") && rayonsLibres.count(e.id)) return false;
  return true;
}

// skHealth
SanteEsquisse santeDe(const Esquisse& s) {
  SanteEsquisse H;
  const Trace tr = tracerContours(s);
  H.ouverts = tr.ouverts;
  for (size_t i = 0; i < H.ouverts.size(); i++)
    for (size_t j = i + 1; j < H.ouverts.size(); j++) {
      const double d = std::hypot(H.ouverts[i].x - H.ouverts[j].x, H.ouverts[i].y - H.ouverts[j].y);
      if (d < H.ecart) {
        H.ecart = d;
        H.aEcart = true;
        H.ecartA = H.ouverts[i];
        H.ecartB = H.ouverts[j];
      }
    }
  std::set<std::string> coinc;  // points volontairement coïncidents : pas des doublons
  for (const Contrainte& c : s.contraintes)
    if (c.type == "coincident") {
      if (!c.a.empty()) coinc.insert(c.a);
      if (!c.b.empty()) coinc.insert(c.b);
    }
  for (size_t i = 0; i < s.ordre.size(); i++)
    for (size_t j = i + 1; j < s.ordre.size(); j++) {
      const std::string& a = s.ordre[i];
      const std::string& b = s.ordre[j];
      if (a == "O" || b == "O") continue;
      if (coinc.count(a) && coinc.count(b)) continue;
      const Pt* A = s.point(a);
      const Pt* B = s.point(b);
      if (A && B && std::hypot(A->x - B->x, A->y - B->y) < 1e-3) H.doublons.push_back({a, b});
    }
  for (const Entite& e : s.entites) {
    if (e.construction || e.ref) continue;
    if (e.t == "line") {
      const Pt* A = s.point(e.p1);
      const Pt* B = s.point(e.p2);
      if (A && B && std::hypot(B->x - A->x, B->y - A->y) < 1e-6) H.degeneres.push_back(e.id);
    }
    if ((e.t == "circle" || e.t == "arc") && !(e.r > 1e-6)) H.degeneres.push_back(e.id);
  }
  std::vector<const Entite*> segs;
  for (const Entite& e : s.entites)
    if (e.t == "line" && !e.construction && !e.ref && s.point(e.p1) && s.point(e.p2)) segs.push_back(&e);
  for (size_t i = 0; i < segs.size(); i++)
    for (size_t j = i + 1; j < segs.size(); j++) {
      const Entite& a = *segs[i];
      const Entite& b = *segs[j];
      if (a.p1 == b.p1 || a.p1 == b.p2 || a.p2 == b.p1 || a.p2 == b.p2) continue;  // jonction normale
      const Pt& A = *s.point(a.p1);
      const Pt& B = *s.point(a.p2);
      const Pt& C = *s.point(b.p1);
      const Pt& D = *s.point(b.p2);
      const double dx1 = B.x - A.x, dy1 = B.y - A.y, dx2 = D.x - C.x, dy2 = D.y - C.y, den = dx1 * dy2 - dy1 * dx2;
      if (std::abs(den) < 1e-12) continue;
      const double t = ((C.x - A.x) * dy2 - (C.y - A.y) * dx2) / den, u = ((C.x - A.x) * dy1 - (C.y - A.y) * dx1) / den;
      if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) H.croisements.push_back(Pt{A.x + dx1 * t, A.y + dy1 * t});
    }
  int trous = static_cast<int>(tr.trousRonds.size());
  for (const ContourPlein& c : tr.solides) trous += static_cast<int>(c.trous.size());
  H.contours = static_cast<int>(tr.solides.size() + tr.cerclesSeuls.size());
  H.trous = trous;
  return H;
}

InfosEsquisse infosDe(const Esquisse& s) {
  InfosEsquisse I;
  try {
    I.sante = santeDe(s);
  } catch (const std::exception&) {
  }
  Solveur v(s);
  if (!v.prisEnCharge()) return I;
  const Solveur::Libertes L = v.libertes();
  I.libertes = L.nombre;
  I.pointsLibres.insert(L.points.begin(), L.points.end());
  I.rayonsLibres.insert(L.rayons.begin(), L.rayons.end());
  I.ecarts = v.ecarts();
  I.residu = v.residu();
  // skFixed : la vue s'en sert pour les petits carrés pleins et les flèches
  I.fixes.insert("O");
  for (const Contrainte& c : s.contraintes) {
    if (c.type != "fix") continue;
    if (!c.p.empty()) I.fixes.insert(c.p);
    if (const Entite* e = c.ent.empty() ? nullptr : s.entite(c.ent)) {
      if (e->t == "circle" || e->t == "arc") I.fixes.insert(e->pc);
      if (e->t == "cpoint") I.fixes.insert(e->p);
    }
  }
  for (const Entite& e : s.entites)
    if (e.proj)
      for (const std::string* q : {&e.p1, &e.p2, &e.pc, &e.pa, &e.pb, &e.p})
        if (!q->empty()) I.fixes.insert(*q);
  for (const Entite& l : s.entites)
    if (!l.handle.empty()) I.poignees[l.handle].push_back(l.p2);
  I.calculees = true;
  return I;
}

std::string descContrainte(const Esquisse& s, const Contrainte& c) {
  const auto nm = [&](const std::string& id) -> std::string {
    const Entite* e = s.entite(id);
    if (!e) return "?";
    const char* n = e->poignee ? "poignée" : (e->t == "cpoint" && e->percage) ? "perçage" : e->t == "line" ? "ligne" : e->t == "circle" ? "cercle" : e->t == "arc" ? "arc" : e->t == "cpoint" ? "point" : e->t == "spline" ? "spline" : "?";
    return std::string(n) + "…" + fin3(id);
  };
  const auto pt = [&](const std::string& id) -> std::string {
    for (const Entite& e : s.entites)
      if (e.t == "cpoint" && e.percage && e.p == id) return "perçage…" + fin3(id);
    return "pt…" + fin3(id);
  };
  const std::string N = nomContrainte(c.type);
  const std::string& t = c.type;
  if (t == "h" || t == "v") return N + " " + nm(c.line);
  if (t == "fix") return N + " " + (!c.p.empty() ? pt(c.p) : nm(c.ent));
  if (t == "tangent") return N + " " + nm(c.line) + " / " + nm(c.ent);
  if (t == "symmetric") return N + " " + nm(c.a) + " / " + nm(c.b) + " | axe " + nm(c.mid);
  if (t == "coincident") return N + " " + pt(c.a) + " / " + pt(c.b) + (c.a == "O" || c.b == "O" ? " (origine)" : "");
  if (t == "oncircle" || t == "onspline") return "Point " + pt(c.p) + " sur " + nm(c.ent);
  if (t == "online") return "Point " + pt(c.p) + " sur " + nm(c.line);
  if (t == "midpoint") return !c.p.empty() ? "Milieu : " + pt(c.p) + " au centre de " + nm(c.line) : "Milieux égaux " + nm(c.a) + " / " + nm(c.b);
  if (t == "offset") return N + " " + nm(c.c) + "→" + nm(c.d) + " = " + nm(c.a) + "→" + nm(c.b);
  if (!c.a.empty() && !c.b.empty()) return N + " " + nm(c.a) + " / " + nm(c.b);
  return N;
}

std::string descCote(const Cote& d) {
  const std::string v = fixe(d.value, 2);
  if (d.type == "length") return "Longueur = " + v;
  if (d.type == "distance") return "Distance = " + v;
  if (d.type == "diameter") return "Ø = " + v;
  if (d.type == "radius") return "R = " + v;
  if (d.type == "angle") return "Angle = " + fixe(d.value * 180 / 3.141592653589793, 1) + "°";
  if (d.type == "gap") return "Entraxe = " + v;
  if (d.type == "distline") return "Point ↔ ligne = " + v;
  return d.type;
}

std::string texteSante(const SanteEsquisse& h) {
  std::string t = "Contours : " + std::to_string(h.contours);
  if (h.trous) t += " · trous : " + std::to_string(h.trous);
  if (!h.ouverts.empty()) t += " · ⚠ " + std::to_string(h.ouverts.size()) + " bout(s) ouvert(s)";
  return t;
}

bool sousContrainte(const Esquisse& s, const InfosEsquisse& i) { return !(i.libertes <= 0 && !s.points.empty()); }

std::string statutEsquisse(const Esquisse& s, const InfosEsquisse& i) {
  std::string t;
  if (i.residu > 0.05 && i.libertes <= 0) t = "⚠ Sur-contrainte probable (résidu " + fixe(i.residu, 2) + " mm — voir lignes rouges)";
  else if (i.residu > 0.05) t = "🔵 Sous-contrainte · résidu " + fixe(i.residu, 2) + " mm";
  else if (!sousContrainte(s, i)) t = "⚫ Entièrement contrainte";
  else t = "🔵 Sous-contrainte (" + std::to_string(i.libertes > 0 ? i.libertes : 0) + " libertés)";
  t += " · " + std::to_string(s.entites.size()) + " entités · " + std::to_string(s.contraintes.size()) + " contraintes · " + std::to_string(s.cotes.size()) + " cotes";
  const SanteEsquisse& h = i.sante;
  if (!h.ouverts.empty()) t += " · ⚠ " + std::to_string(h.ouverts.size()) + " bout(s) ouvert(s)";
  else t += " · ✓ " + std::to_string(h.contours) + " contour(s)" + (h.trous ? " · " + std::to_string(h.trous) + " trou(s)" : "");
  return t;
}

std::string noteEntite(const Esquisse& s, const Entite& e) {
  const std::string constr = e.construction ? " (construction)" : "";
  if (e.t == "line") {
    const Pt* A = s.point(e.p1);
    const Pt* B = s.point(e.p2);
    const double L = A && B ? std::hypot(B->x - A->x, B->y - A->y) : 0;
    return std::string("Ligne") + (e.ref ? " (référence 3D)" : constr) + " · L=" + fixe(L, 2) + " mm";
  }
  if (e.t == "circle") return "Cercle" + constr + " · Ø=" + fixe(e.r * 2, 2) + " mm";
  if (e.t == "arc") return "Arc" + constr + " · R=" + fixe(e.r, 2) + " mm";
  if (e.t == "cpoint") return e.percage ? "Centre de perçage (fonction 3D « Perçage »)" : "Point de construction";
  if (e.t == "spline") {
    int nh = 0;
    for (const Entite& l : s.entites)
      if (l.handle == e.id) nh++;
    const std::string ferme = e.closed ? " fermée" : "";
    if (e.mode == "ctrl") return "Spline par points de contrôle" + ferme + constr + " · " + std::to_string(e.pts.size()) + " pôles : clic droit, peigne de courbure";
    return "Spline" + ferme + constr + " · " + std::to_string(e.pts.size()) + " points de passage" + (nh ? " · " + std::to_string(nh) + " poignée(s)" : "") + " : clic droit sur un point, poignée de tangence";
  }
  return e.t;
}
