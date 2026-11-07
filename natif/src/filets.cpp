// Traduction de occHoleThreadVoid, occShaftThreadVoid et threadCompute (src/76-percage, src/76-filetage)
#include "filets.h"

#include <BRepAdaptor_Surface.hxx>
#include <BRepAlgoAPI_Cut.hxx>
#include <BRepBuilderAPI_MakeEdge.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakePolygon.hxx>
#include <BRepBuilderAPI_MakeSolid.hxx>
#include <BRepBuilderAPI_MakeWire.hxx>
#include <BRepBuilderAPI_Sewing.hxx>
#include <BRepBuilderAPI_Transform.hxx>
#include <BRepClass3d_SolidClassifier.hxx>
#include <BRepFill.hxx>
#include <BRepGProp.hxx>
#include <BRepLib.hxx>
#include <BRepPrimAPI_MakeCone.hxx>
#include <BRep_Builder.hxx>
#include <GProp_GProps.hxx>
#include <Geom2d_Line.hxx>
#include <Geom_CylindricalSurface.hxx>
#include <Standard_Failure.hxx>
#include <TopAbs_State.hxx>
#include <TopExp_Explorer.hxx>
#include <TopTools_ListOfShape.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Compound.hxx>
#include <TopoDS_Iterator.hxx>
#include <gp_Ax2.hxx>
#include <gp_Ax3.hxx>
#include <gp_Circ.hxx>
#include <gp_Pnt2d.hxx>
#include <gp_Trsf.hxx>
#include <gp_Vec.hxx>

#include <algorithm>
#include <cmath>
#include <stdexcept>

#include "noms.h"
#include "tables_percage.h"

using json = nlohmann::ordered_json;

const json& tablesPercage() {
  static const json T = json::parse(TABLES_PERCAGE);
  return T;
}
const json* filetageDe(const std::string& taille) {
  const json& T = tablesPercage();
  for (const char* k : {"iso", "un", "gaz"})
    for (const json& l : T[k])
      if (l[0] == taille) return &l;
  return nullptr;
}
const json* infoFiletage(const std::string& taille) {
  const json& I = tablesPercage()["info"];
  const auto it = I.find(taille);
  return it == I.end() ? nullptr : &*it;
}
bool filetModelable(const std::string& taille) {
  const json* I = infoFiletage(taille);
  return !I || I->value("model", false);
}

namespace {
const double PI = 3.141592653589793;

gp_Dir repereU(const gp_Dir& D) {  // départ tourné de ~37° : jamais aligné sur la couture des cylindres
  const gp_Vec d(D), ref = std::abs(D.Z()) < 0.9 ? gp_Vec(0, 0, 1) : gp_Vec(1, 0, 0);
  const gp_Vec U0 = d.Crossed(ref).Normalized(), V0 = d.Crossed(U0);
  return gp_Dir(U0 * std::cos(0.65) + V0 * std::sin(0.65));
}

// Les outils communs aux deux vides : un tour d'hélice au rayon r, décalé de s le long de l'axe
struct Hélices {
  gp_Pnt P;
  gp_Dir D, U;
  double z0, p;
  int sens;
  gp_Pnt en(double r, double s) const {
    const double a = z0 + s;
    return gp_Pnt(P.X() + D.X() * a + U.X() * r, P.Y() + D.Y() * a + U.Y() * r, P.Z() + D.Z() * a + U.Z() * r);
  }
  TopoDS_Edge helice(double r, double s) const {
    if (r < 1e-9) return BRepBuilderAPI_MakeEdge(en(0, s), en(0, s + p)).Edge();
    occ::handle<Geom_CylindricalSurface> surf = new Geom_CylindricalSurface(gp_Ax3(en(0, s), D, U), r);
    occ::handle<Geom2d_Line> ligne = new Geom2d_Line(gp_Pnt2d(0, 0), gp_Dir2d(sens * 2 * PI, p));
    BRepBuilderAPI_MakeEdge me(ligne, surf, 0, std::hypot(2 * PI, p));
    if (!me.IsDone()) throw std::runtime_error("hélice impossible");
    TopoDS_Edge e = me.Edge();
    BRepLib::BuildCurves3d(e);
    return e;
  }
  TopoDS_Shape deplace(const TopoDS_Shape& s, int k) const {
    if (!k) return s;
    gp_Trsf g;
    g.SetTranslation(gp_Vec(D.X() * p * k, D.Y() * p * k, D.Z() * p * k));
    return BRepBuilderAPI_Transform(s, g, true).Shape();
  }
  TopoDS_Face bouchon(int k, const std::vector<std::pair<double, double>>& pts) const {
    BRepBuilderAPI_MakePolygon pl;
    for (const auto& [r, s] : pts) pl.Add(en(r, s + k * p));
    pl.Close();
    BRepBuilderAPI_MakeFace mf(pl.Wire(), true);
    if (!mf.IsDone()) throw std::runtime_error("bouchon de filet impossible");
    return mf.Face();
  }
};

TopoDS_Shape solideCousu(BRepBuilderAPI_Sewing& sew) {
  sew.Perform();
  if (sew.NbFreeEdges() > 0) throw std::runtime_error("filet non fermé (" + std::to_string(sew.NbFreeEdges()) + " arêtes libres)");
  TopExp_Explorer ex(sew.SewedShape(), TopAbs_SHELL);
  if (!ex.More()) throw std::runtime_error("coque de filet introuvable");
  BRepBuilderAPI_MakeSolid ms;
  ms.Add(TopoDS::Shell(ex.Current()));
  TopoDS_Shape sol = ms.Solid();
  GProp_GProps gp;
  BRepGProp::VolumeProperties(sol, gp, false, false, false);
  if (gp.Mass() < 0) sol = sol.Reversed();
  return sol;
}

// threadDims : filet extérieur ISO 68-1
struct FiletExterieur {
  double d, P, d1, rC, rR, w, h;
};
std::optional<FiletExterieur> filetExterieur(const std::string& taille, double p, double jeu, double R) {
  const json* t = filetageDe(taille);
  if (!t) return std::nullopt;
  const double d = (*t)[1].get<double>(), P = p != 0 ? p : (*t)[2].get<double>();
  if (!(d > 0) || !(P > 0)) return std::nullopt;
  const double c = std::max(0.0, jeu) / 2, d1 = d - 1.082532 * P;
  const double rC = std::min((R > 0 ? R : d / 2) - 0.01, d / 2 - c), rR = d1 / 2 - c;
  if (!(rC - rR > 0.1 * P) || !(rR > 0)) return std::nullopt;
  return FiletExterieur{d, P, d1, rC, rR, P / 8, P / 8 + (rC - rR) * std::tan(PI / 6)};
}

// occShaftThreadVoid : le même vide retourné, de la paroi filetée vers l'extérieur jusqu'au rayon Rout
TopoDS_Shape videFiletage(const gp_Pnt& P, const gp_Dir& D, double zStart, int nT, const FiletExterieur& th, double Rout, bool lh) {
  const double p = th.P, rC = th.rC, rR = th.rR, w = th.w, h = th.h;
  if (!(nT >= 1) || !(Rout > rC + 1e-3) || !(h < p / 2)) return TopoDS_Shape();
  const Hélices H{P, D, repereU(D), zStart + h, p, lh ? -1 : 1};
  const std::vector<std::pair<double, double>> q = {{Rout, -h}, {rC, -h}, {rR, -w}, {rR, w}, {rC, h}, {rC, p - h}, {Rout, p - h}};
  std::vector<TopoDS_Edge> E;
  for (const auto& [r, s] : q) E.push_back(H.helice(r, s));
  const auto regle = [&](int i, int j) { return BRepFill::Face(E[i], E[j]); };
  const TopoDS_Face tour[5] = {regle(1, 2), regle(2, 3), regle(3, 4), regle(4, 5), regle(0, 6)};
  BRepBuilderAPI_Sewing sew(1e-4, true, true, true, false);
  for (int k = 0; k < nT; k++)
    for (const TopoDS_Face& s : tour) sew.Add(H.deplace(s, k));
  sew.Add(regle(0, 1));
  sew.Add(H.bouchon(0, q));
  sew.Add(H.deplace(regle(5, 6), nT - 1));
  sew.Add(H.bouchon(nT, q));
  return solideCousu(sew);
}

struct Cylindre {
  gp_Pnt c;
  gp_Dir u;
  double r, v0, v1;
};
std::optional<Cylindre> cylindreDe(const TopoDS_Face& face) {  // threadCylOf
  try {
    BRepAdaptor_Surface ad(face, true);
    if (ad.GetType() != GeomAbs_Cylinder) return std::nullopt;
    const gp_Cylinder cy = ad.Cylinder();
    const double a = ad.FirstVParameter(), b = ad.LastVParameter();
    return Cylindre{cy.Axis().Location(), cy.Axis().Direction(), cy.Radius(), std::min(a, b), std::max(a, b)};
  } catch (const Standard_Failure&) {
    return std::nullopt;
  }
}
gp_Vec moins(const gp_Pnt& a, const gp_Pnt& b) { return gp_Vec(b, a); }

// threadResolve : l'étendue [a, b] du tronçon cylindrique, comptée le long de l'axe de référence
struct Troncon {
  gp_Pnt c, p;
  gp_Dir u;
  double r, a, b;
};
Troncon resoudre(const TopoDS_Shape& shape, const CylindreFiletage& ref) {
  if (!ref.lu || !(ref.r > 0)) throw std::runtime_error("face de l'axe non définie");
  Troncon T{gp_Pnt(ref.c[0], ref.c[1], ref.c[2]), gp_Pnt(ref.p[0], ref.p[1], ref.p[2]), gp_Dir(ref.u[0], ref.u[1], ref.u[2]), ref.r, 0, 0};
  const gp_Vec U(T.u);
  // La face par son nom : l'axe et le rayon la suivent si la pièce a bougé
  if (!ref.nom.empty())
    if (const auto h = nomsRefFace(shape, ref.nom, nullptr))
      if (const auto C = cylindreDe(*h)) {
        const gp_Vec w = moins(C->c, T.c);
        const gp_Vec q = w - U * w.Dot(U);
        if (q.Magnitude() > 1e-6 && std::abs(gp_Vec(C->u).Dot(U)) > 0.9999) {
          T.c.Translate(q);
          if (ref.aP) T.p.Translate(q);
        }
        if (std::abs(C->r - T.r) > 1e-6) T.r = C->r;
      }
  std::vector<std::pair<double, double>> spans;
  for (TopExp_Explorer ex(shape, TopAbs_FACE); ex.More(); ex.Next()) {
    const auto C = cylindreDe(TopoDS::Face(ex.Current()));
    if (!C || std::abs(C->r - T.r) > 0.02) continue;
    const double dot = gp_Vec(C->u).Dot(U);
    if (std::abs(dot) < 0.9999) continue;
    const gp_Vec w = moins(C->c, T.c);
    const double t = w.Dot(U);
    if ((w - U * t).Magnitude() > 0.02) continue;
    const double ta = t + dot * C->v0, tb = t + dot * C->v1;
    spans.push_back({std::min(ta, tb), std::max(ta, tb)});
  }
  if (spans.empty()) {
    char b[64];
    std::snprintf(b, sizeof b, "%g", 2 * T.r);
    throw std::runtime_error(std::string("face cylindrique Ø") + b + " introuvable");
  }
  std::sort(spans.begin(), spans.end());
  std::vector<std::pair<double, double>> M;
  for (const auto& s : spans) {
    if (!M.empty() && s.first <= M.back().second + 0.01) M.back().second = std::max(M.back().second, s.second);
    else M.push_back(s);
  }
  const double tp = ref.aP ? moins(T.p, T.c).Dot(U) : (M[0].first + M[0].second) / 2;
  auto best = M[0];
  double bd = 1e18;
  for (const auto& s : M) {
    const double d = tp < s.first ? s.first - tp : (tp > s.second ? tp - s.second : 0);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  T.a = best.first;
  T.b = best.second;
  return T;
}

// threadFreeDist : distance où la matière cesse au rayon r, ou rien si elle continue au-delà de maxD (épaulement, tête)
std::optional<double> bout(BRepClass3d_SolidClassifier& cl, const Troncon& T, double t0, double sg, double r, double maxD) {
  const gp_Vec u(T.u), ref = std::abs(T.u.Z()) < 0.9 ? gp_Vec(0, 0, 1) : gp_Vec(1, 0, 0);
  const gp_Vec U = u.Crossed(ref).Normalized(), V = u.Crossed(U);
  for (double s = 0.02; s <= maxD; s += 0.05) {
    const double t = t0 + sg * s;
    int n = 0;
    for (int k = 0; k < 3; k++) {
      const double a = k * 2 * PI / 3;
      const gp_Vec o = u * t + (U * std::cos(a) + V * std::sin(a)) * r;
      cl.Perform(T.c.Translated(o), 1e-7);
      if (cl.State() == TopAbs_IN) n++;
    }
    if (n == 0) return s;
  }
  return std::nullopt;
}
}  // namespace

std::optional<FiletInterieur> filetInterieur(const std::string& taille, double p, double jeu) {
  const json* t = filetageDe(taille);
  if (!t || !filetModelable(taille)) return std::nullopt;
  FiletInterieur f;
  f.D = (*t)[1].get<double>();
  f.P = p != 0 ? p : (*t)[2].get<double>();
  if (!(f.D > 0) || !(f.P > 0)) return std::nullopt;
  f.c = std::max(0.0, jeu) / 2;
  f.D1 = f.D - 1.082532 * f.P;
  f.rCrete = f.D1 / 2 + f.c;
  f.rRacine = f.D / 2 + f.c;
  return f;
}

TopoDS_Shape videTaraude(const gp_Pnt& P, const gp_Dir& D, double zStart, int nT, const FiletInterieur& th, double rb, double zEnd, double tip) {
  const double p = th.P, r2 = th.rRacine;
  if (!(nT >= 1) || !(rb > 0 && rb < r2 - 1e-3) || !(zEnd > zStart + (nT + 1) * p + 1e-3)) return TopoDS_Shape();
  const gp_Dir U = repereU(D);
  const double h = p / 16 + (r2 - rb) * std::tan(PI / 6);  // demi-largeur du creux au rayon de crête
  const Hélices H{P, D, U, zStart + h, p, th.lh ? -1 : 1};
  // profil d'un tour, de l'axe à l'axe : crête p/4 entière, pas de demi-crêtes
  const std::vector<std::pair<double, double>> q = {{0, -h}, {rb, -h}, {r2, -p / 16}, {r2, p / 16}, {rb, h}, {rb, p - h}, {0, p - h}};
  std::vector<TopoDS_Edge> E;
  for (const auto& [r, s] : q) E.push_back(H.helice(r, s));
  const auto regle = [&](int i, int j) { return BRepFill::Face(E[i], E[j]); };
  const TopoDS_Face paroi[4] = {regle(1, 2), regle(2, 3), regle(3, 4), regle(4, 5)};
  BRepBuilderAPI_Sewing sew(1e-4, true, true, true, false);
  for (int k = 0; k < nT; k++)
    for (const TopoDS_Face& w : paroi) sew.Add(H.deplace(w, k));
  sew.Add(regle(0, 1));
  sew.Add(H.bouchon(0, q));
  // fût : cercle du fond (même départ angulaire que les hélices) relié à la dernière crête
  const gp_Pnt oE(P.X() + D.X() * zEnd, P.Y() + D.Y() * zEnd, P.Z() + D.Z() * zEnd);
  const gp_Circ cercle(gp_Ax2(oE, th.lh ? D.Reversed() : D, U), rb);
  const TopoDS_Edge ce = BRepBuilderAPI_MakeEdge(cercle).Edge();
  sew.Add(BRepFill::Face(TopoDS::Edge(H.deplace(E[5], nT - 1)), ce));
  sew.Add(H.bouchon(nT, {q[1], q[2], q[3], q[4]}));  // fin du dernier creux
  if (tip > 0) {
    const TopoDS_Shape cone = BRepPrimAPI_MakeCone(gp_Ax2(oE, D, U), rb, 0, rb / std::tan(tip * PI / 360)).Shape();
    for (TopExp_Explorer fx(cone, TopAbs_FACE); fx.More(); fx.Next())
      if (BRepAdaptor_Surface(TopoDS::Face(fx.Current()), true).GetType() != GeomAbs_Plane) sew.Add(fx.Current());
  } else {
    sew.Add(BRepBuilderAPI_MakeFace(BRepBuilderAPI_MakeWire(ce).Wire(), true).Face());
  }
  return solideCousu(sew);
}

FiletageCalcule calculerFiletage(const TopoDS_Shape& piece, const Fonction& f) {
  FiletageCalcule out;
  const ReglageFilet& F = f.filetage;
  const Troncon S = resoudre(piece, f.cylindre);
  const json* t = filetageDe(F.size);
  if (!t) throw std::runtime_error("taille de filet inconnue (" + F.size + ")");
  const double P = F.p != 0 ? F.p : (*t)[2].get<double>(), R = S.r;
  const bool modelable = filetModelable(F.size);
  const auto th = filetExterieur(F.size, P, modelable && F.model ? F.clear : 0, R);
  const auto fr = [](double v) {
    char b[32];
    std::snprintf(b, sizeof b, "%g", std::round(v * 100) / 100);
    std::string s = b;
    std::replace(s.begin(), s.end(), '.', ',');
    return s;
  };
  if (!th) throw std::runtime_error("profil de filet impossible sur Ø" + fr(2 * R));
  if (std::abs(2 * R - th->d) > std::max(0.3, 0.06 * th->d)) out.alertes.push_back("Ø de l'axe " + fr(2 * R) + " éloigné du Ø nominal " + fr(th->d) + " du " + F.size);
  // bouts libres (rien au-delà, ou seulement un chanfrein) : le filet y débouche
  BRepClass3d_SolidClassifier cl(piece);
  const double maxD = std::max(3 * P, 0.4 * R);
  const auto fa = bout(cl, S, S.a, -1, th->rR + 0.02, maxD), fb = bout(cl, S, S.b, 1, th->rR + 0.02, maxD);
  // départ : le bout libre (à égalité, le bas de l'axe de référence) ; inversé : l'autre
  bool atA = fa.has_value() || !fb.has_value();
  if (f.flip) atA = !atA;
  const double t0 = atA ? S.a : S.b, sg = atA ? 1 : -1, span = S.b - S.a;
  const auto free0 = atA ? fa : fb, free1 = atA ? fb : fa;
  const gp_Pnt o = S.c.Translated(gp_Vec(S.u) * t0);
  const gp_Dir d = atA ? S.u : S.u.Reversed();
  // fin du vide (depuis le départ, vers l'intérieur) : jamais dans un épaulement
  const double full = free1 ? span + *free1 + P + 0.1 : span - 0.05;
  const bool enLongueur = F.lenMode == "len";
  const double lim = enLongueur ? std::min(std::max(P, F.len), full) : full;
  const double zStart = free0 ? -(*free0 + P + 0.05) : 0.05;
  const double len = enLongueur ? std::min(std::max(P, F.len), span) : span;
  if (F.model && modelable) {
    const int nT = static_cast<int>(std::floor((lim - zStart) / P + 1e-9)) - 1;
    if (nT < 1) out.alertes.push_back("filet modélisé ignoré : longueur filetée trop courte");
    else {
      try {
        out.vide = videFiletage(o, d, zStart, nT, *th, R + std::max(0.3, 0.3 * P), F.lh);
      } catch (const Standard_Failure& e) {
        out.alertes.push_back(std::string("filet modélisé impossible (axe lisse) : ") + e.what());
      } catch (const std::exception& e) {
        out.alertes.push_back(std::string("filet modélisé impossible (axe lisse) : ") + e.what());
      }
    }
  } else if (F.model) {
    const json* I = infoFiletage(F.size);
    out.alertes.push_back(std::string("filet ") + (I && I->value("cone", false) ? "conique " : "") + "cosmétique seulement (profil non modélisé)");
  }
  if (!free0) out.alertes.push_back("aucun bout libre : le filet part du bout de la face et s'y arrête net");
  // threadShaftPaths
  out.cosmetique = !(F.model && modelable);
  if (out.cosmetique) {
    const gp_Vec D(d), ref = std::abs(d.Z()) < 0.9 ? gp_Vec(0, 0, 1) : gp_Vec(1, 0, 0);
    const gp_Vec U = D.Crossed(ref).Normalized(), V = D.Crossed(U);
    const double rh = R + 0.04, tours = len / P;
    const int pas = std::max(24, static_cast<int>(std::ceil(tours * 24)));
    for (int i = 0; i <= pas; i++) {
      const double a = (F.lh ? -1 : 1) * static_cast<double>(i) / pas * tours * 2 * PI;
      out.spirale.helice.push_back(o.Translated(D * (static_cast<double>(i) / pas * len) + (U * std::cos(a) + V * std::sin(a)) * rh));
    }
    for (int k = 0; k <= 48; k++) {
      const double a = k / 48.0 * 2 * PI;
      out.spirale.anneau.push_back(o.Translated(D * len + (U * std::cos(a) + V * std::sin(a)) * rh));
    }
  }
  return out;
}

json cylindreDeFiletage(const TopoDS_Shape& piece, const TopoDS_Face& face, const double point[3], std::string& erreur) {
  const auto C = cylindreDe(face);
  if (!C) {
    erreur = "choisissez une face CYLINDRIQUE (l'axe à fileter)";
    return nullptr;
  }
  const gp_Pnt p(point[0], point[1], point[2]);
  const gp_Vec u(C->u);
  const double t = moins(p, C->c).Dot(u);
  const gp_Pnt ax = C->c.Translated(u * t);
  gp_Vec rd(ax, p);
  const double L = rd.Magnitude() > 0 ? rd.Magnitude() : 1;
  // extérieure : juste au-delà de la paroi, on est hors matière (un trou : dans la matière)
  bool dehors = true;
  try {
    BRepClass3d_SolidClassifier cl(piece);
    cl.Perform(ax.Translated(rd * ((C->r + std::min(0.2, 0.1 * C->r)) / L)), 1e-7);
    dehors = cl.State() != TopAbs_IN;
  } catch (const Standard_Failure&) {
  }
  if (!dehors) {
    erreur = "c'est un trou : son taraudage se règle dans la fonction Perçage";
    return nullptr;
  }
  const auto r6 = [](double v) { return std::round(v * 1e6) / 1e6; };
  return {{"c", {r6(ax.X()), r6(ax.Y()), r6(ax.Z())}}, {"u", {r6(u.X()), r6(u.Y()), r6(u.Z())}}, {"r", r6(C->r)}, {"p", {r6(p.X()), r6(p.Y()), r6(p.Z())}}};
}

TopoDS_Shape composeFilets(const std::vector<TopoDS_Shape>& v) {
  if (v.empty()) return TopoDS_Shape();
  if (v.size() == 1) return v[0];
  BRep_Builder bd;
  TopoDS_Compound c;
  bd.MakeCompound(c);
  for (const TopoDS_Shape& s : v) bd.Add(c, s);
  return c;
}

TopoDS_Shape creuserFilets(const TopoDS_Shape& a, const TopoDS_Shape& b) {
  std::vector<TopoDS_Shape> enfants;
  if (b.ShapeType() == TopAbs_COMPOUND)
    for (TopoDS_Iterator it(b, true, true); it.More(); it.Next()) enfants.push_back(it.Value());
  else
    enfants.push_back(b);
  if (!enfants.empty() && std::all_of(enfants.begin(), enfants.end(), [](const TopoDS_Shape& k) { return k.ShapeType() == TopAbs_COMPOUND; })) {
    TopoDS_Shape r = a;
    for (const TopoDS_Shape& k : enfants) r = creuserFilets(r, k);
    return r;
  }
  TopTools_ListOfShape la, lt;
  la.Append(a);
  for (const TopoDS_Shape& k : enfants) lt.Append(k);
  BRepAlgoAPI_Cut c;
  c.SetArguments(la);
  c.SetTools(lt);
  c.SetCheckInverted(false);
  c.Build();
  if (!c.IsDone() || c.Shape().IsNull()) throw std::runtime_error("découpe impossible");
  return c.Shape();
}

std::optional<std::array<double, 3>> dimsFiletExterieur(const std::string& taille, double p, double jeu, double R) {
  const auto t = filetExterieur(taille, p, jeu, R);
  if (!t) return std::nullopt;
  return std::array<double, 3>{t->rC, t->rR, t->P};
}
